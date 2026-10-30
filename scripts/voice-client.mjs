/**
 * Danganronpa RPG - the receiving half of per-region voice.
 * ---------------------------------------------------------------------------
 * `voice.mjs` decides which room each person belongs in. This is what actually
 * moves a voice client there, and it runs on EVERY client - the players', the
 * GMs', all of them.
 *
 * WHY THIS FILE EXISTS AT ALL. The previous design pointed a player's client at
 * a room by emitting avclient-livekit's own breakout socket message and hoping.
 * Three things were wrong with hoping, and between them they are the whole of
 * "voice per region does not work":
 *
 *   1. avclient-livekit registers its socket listener inside `Hooks.on("ready")`
 *      and drops anything that arrives before `game.webrtc.client._liveKitClient`
 *      exists. Foundry tells the GM about a joining player when their SOCKET
 *      connects, which is many seconds before that player reaches `ready`. The
 *      GM waited 1.5s and emitted into a client that was not listening yet.
 *      Socket messages are not queued, so the assignment was simply lost.
 *   2. Nothing ever confirmed anything. The GM recorded "told them" the moment
 *      it emitted, and its own equality guard then skipped that player until
 *      their target CHANGED. One dropped message meant one player stuck in the
 *      main room until they happened to walk somewhere else.
 *   3. avclient-livekit's `breakout()` clears `breakoutRoom` back to undefined
 *      when the reconnect it starts rejects - quietly returning the player to
 *      the main room while the GM still believed they were in the Kitchen.
 *
 * So the module carries the message itself, and this side owns the apply:
 *
 *   · a room that arrives too early is REMEMBERED and applied from
 *     `liveKitClientInitialized`, the hook avclient-livekit fires at the end of
 *     its own `initialize()`. No guessing at timing.
 *   · every apply is confirmed back to the GM, and only a confirmation lets the
 *     GM stop re-sending.
 *   · this client ASKS where it belongs on its own `ready` and again whenever
 *     its A/V comes up, so joining, refreshing and reconnecting fix themselves
 *     without the GM having to catch the right moment.
 *   · applies are serialised. Ending an Eclipse reassigns the whole table at
 *     once, and two overlapping `game.webrtc.connect()` calls on one client is a
 *     race, not a feature.
 *
 * Everything here is a no-op without avclient-livekit installed and active.
 */

import { MODULE_ID } from "./config.mjs";
import { activeGmIds, primaryGmId, debug, error, markFired } from "./utils.mjs";
import { showPopup } from "./popup.mjs";
// E88 C6: each connect this page runs and the ms it took, for `fps()` and scenario 75 (perf-counters.mjs, a leaf).
import { count } from "./perf-counters.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const AV_MODULE = "avclient-livekit";

/** The three messages per-region voice sends. Shared with voice.mjs. */
export const VOICE = {
    /** GM -> one user: "your voice belongs in this room". */
    assign: "voice.assign",
    /** user -> GM: "I applied it" / "I could not". */
    applied: "voice.applied",
    /** user -> GM: "where do I belong?" - sent on join and on A/V startup. */
    whoAmI: "voice.whoAmI",
};

/**
 * What this client has been told to be in. `undefined` means nobody has said;
 * `null` means the main room.
 */
let desired;

/** The assignment we have not yet been able to apply, if any. */
let parkedRequestId = null;

/** Applies run one at a time - see the note about the Eclipse above. */
let chain = Promise.resolve();

/**
 * True while THIS file is inside `game.webrtc.connect()`.
 *
 * `AVMaster#connect()` calls `client.initialize()` on every connect, and
 * avclient-livekit fires `liveKitClientInitialized` at the end of that. So every
 * room switch re-fires the hook below - the one whose whole job is to react to
 * A/V coming up - and without this it would queue a second, pointless apply and
 * a second confirmation for a room we are already in the middle of joining.
 */
let applying = false;

/** The connects and disconnects `applyBreakout` ran on this page since it loaded (E88 C6), for its Debug line. */
let connectsHere = 0;

/**
 * Whether this file is moving the client between rooms now (`applying`), for the voice tile's state word (E79
 * C15, 1.2.79; the owner's N10 of 14.10.2026: "switching rooms shows an error ... instead 'Pending...' while
 * switching"). Until then the tile could not see a switch: avclient-livekit's Room still said "connected" while
 * `game.webrtc.connect()` was taking it down, and the tile's note said "You are not connected to voice." once it
 * had. `drpgVoiceApplying` is called with the new value each time it flips (`setApplying`), and the tile repaints
 * its word on it (voice-tile.mjs `onVoiceApplying`); nothing else listens.
 *
 * @returns {boolean}
 */
export function voiceApplying() {
    return applying;
}

function setApplying(value) {
    if (applying === value) return;
    applying = value;
    Hooks.callAll("drpgVoiceApplying", value);
}

export function registerVoiceClient() {
    // A/V comes up (or comes back up) - this is the moment a parked room can
    // finally be applied, and the moment a fresh client should ask where it
    // belongs. Deliberately `on`, not `once`: re-initialising A/V from the
    // settings menu goes through here again and must not be the one case that
    // silently stops working.
    //
    // It can also fire BEFORE `ready`, while the socket listener below is not up
    // yet - asking then would be asking into a reply nobody could receive. The
    // `ready` handler does the asking in that case.
    Hooks.on("liveKitClientInitialized", () => {
        markFired("liveKitClientInitialized");
        // Every initialize builds a new Room, ours included: each is watched for a drop (E19 C2).
        watchForDrops();
        if (applying) return;               // our own reconnect - see `applying`
        debug("Voice: A/V client initialised.");
        // Foundry's own connect at setup comes right after this hook: alone, not in the main room (`landAloneFirst`).
        landAloneFirst();
        if (!game.ready) return;
        if (desired !== undefined) enqueue(() => applyAndReport(desired, parkedRequestId));
        else askWhereIBelong();
    });

    // A GM arriving after this client did. `askWhereIBelong` is addressed to the
    // GMs, so asking while none is connected asks nobody - and the player who
    // logs in first is exactly the one who does that. This is the second half of
    // the pull: whoever turns up last starts the conversation.
    //
    // Asked again even when this client already knows its room: the GM that just
    // arrived is a fresh browser with no record of anybody, and the primary-GM
    // role may have just moved to them. Cheap, and the answer is idempotent.
    Hooks.on("userConnected", (user, connected) => {
        if (!connected || !user.isGM) return;
        if (!avclientActive()) return;
        askWhereIBelong();
    });

    // Registered at `ready` rather than `init`: the socket itself is up at
    // init (sfx.mjs and safeword.mjs listen from there), but a voice packet
    // arriving before the AV client and the world's users exist has nothing
    // to act on, so the listener waits for both.
    Hooks.once("ready", () => {
        game.socket.on(SOCKET_EVENT, onVoiceSocket);
        startSelfCheck();
        watchForDrops();
        if (!avclientActive()) return;
        catchUpVoice();
    });
}

/**
 * What this browser does with its voice at `ready` (E19 C2, 19.10.2026; audit S11-33 (c)): a room parked before
 * `ready` is applied now, else it asks where it belongs. The primary GM's own room is parked on `canvasReady`,
 * which comes before `ready`; `liveKitClientInitialized` may have fired before `ready` too and returned without
 * applying it, and the GM's own `whoAmI` is never answered (`onWhoAmI` skips the asker's own id), so until C2
 * that room waited for the heartbeat, up to a minute. Returns the apply's answer, or null when it asked.
 *
 * @returns {Promise<string|null>}
 */
export function catchUpVoice() {
    if (desired !== undefined && clientReady()) return enqueue(() => applyAndReport(desired, parkedRequestId));
    askWhereIBelong();
    // Nobody can answer: no GM is connected. A page that landed alone (`landAloneFirst`) joins the main room as every
    // page did before E19 fix r1-G1, unremembered; the GM who arrives is asked again (`userConnected` above).
    if (landedAlone && !activeGmIds().length) return enqueue(() => applyBreakout(null, { remember: false }));
    return Promise.resolve(null);
}

/** Whether this page's first connect was pointed at a room of its own by `landAloneFirst`, and no room since. */
let landedAlone = false;

/**
 * A PAGE THAT LOADS IS IN NO CHANNEL UNTIL THE PRIMARY GM SAYS WHICH (E19 fix r1-G1, 19.10.2026; the review's sec-3).
 * Foundry connects A/V during its setup, before `ready`, and avclient-livekit connects to the world's own room - the
 * main room - when nothing has set `breakoutRoom` (this file's header). Nothing had: `desired` lives in this page's
 * memory, so after a reload a dead student, or a victim in the crime room, sat in the main room from that connect
 * until `ready`, its question and the primary's answer - heard by every player there, and named on their tiles,
 * which broke E19-18 ("never the main room") and E19-19. Now this hook, which avclient-livekit fires at the end of its
 * own `initialize()`, right before that connect reads `breakoutRoom`, points it at this account's own room of one
 * (`silentRoomFor`, the Eclipse's word, which nobody else is sent), while regional voice is on and before anybody has
 * told this page a room. Nobody hears it there and it hears nobody; the primary's answer moves it, and with no GM
 * connected at `ready` it joins the main room (`catchUpVoice`). Nothing is stored: a page remembers no room across a
 * reload, so a stale one can put nobody anywhere. Where avclient-livekit 0.6.8 reads `breakoutRoom` in its connect is
 * this file's header's reading, not measured at a table (E19-19's live check, which AUDIT 9.2 has no item of yet).
 *
 * The facts can be handed in, so R834 asks it on a client of its own.
 *
 * @returns {boolean} whether it pointed the connect at the room of one
 */
export function landAloneFirst({ ready = game.ready, told = desired !== undefined, voiceOn = regionalVoiceOn(),
    client = liveKitClient(), userId = game.user?.id } = {}) {
    if (ready || told || !voiceOn || !client || !userId) return false;
    client.breakoutRoom = silentRoomFor(userId);
    landedAlone = client === liveKitClient();
    return true;
}

/** The world's regional voice switch (settings.mjs `SETTINGS.voiceEnabled`), read by its key: settings.mjs is not imported here. */
function regionalVoiceOn() {
    try {
        return game.settings.get(MODULE_ID, "voiceEnabled") === true;
    } catch {
        return false;
    }
}

/**
 * Notice when this client has fallen out of the room it belongs in, or out of voice altogether.
 *
 * The GM's heartbeat cannot see this. It skips anyone whose room it has a
 * confirmation for, and a confirmation stays true right up until something
 * outside Foundry breaks it - a LiveKit server restarted under the table, a
 * network drop, a token that expired. avclient-livekit's `onDisconnected` does
 * not clear `breakoutRoom` and does not reconnect, so from the GM's side
 * everything still looks settled while the player hears nobody.
 *
 * This is the client noticing on its own behalf. It costs a few property reads a
 * minute and sends nothing at all unless something is actually wrong; when
 * something is, it re-applies and tells the GM, so `settled` stops lying too.
 * Until E19 C2 it read the room's NAME only (audit S11-09), and a drop keeps the
 * name, so a dead connection passed as "in the right room" for as long as the
 * page stayed open. Now a connection that is not live is a drop - the card, and
 * a reconnect - whether or not anybody ever gave this browser a room; a Room
 * livekit-client is still reconnecting on its own is left to it; and a drop the
 * voice server or another window of the same account closed is not fought.
 */
const SELF_CHECK_MS = 45000;
let selfCheckTimer = null;

function startSelfCheck() {
    if (selfCheckTimer) clearInterval(selfCheckTimer);
    selfCheckTimer = setInterval(selfCheck, SELF_CHECK_MS);
}

export function selfCheck() {
    if (applying) return null;                  // mid-switch; not a verdict yet
    if (!avclientActive() || !clientReady()) return null;
    if (game.webrtc?.mode === foundry.av.AVSettings.AV_MODES.DISABLED || usingLiveKit() === false) return null;
    // Out of voice on purpose (an Eclipse, E19 C4): no connection is the right state, and a connected one is left again.
    if (silentFor(desired)) return landedCorrectly(desired) ? null : enqueue(() => applyAndReport(desired, null));
    if (lost && !lost.retry) return null;       // closed for us: the card says reload
    if (PENDING_STATES.includes(roomState())) return null;
    if (!externalAV() && !live()) {
        voiceDropped(true);
        if (lost?.timer) return null;           // a reconnect step is already waiting
        return enqueue(reconnect);
    }
    if (desired === undefined) return null;     // nobody has told us anything
    if (landedCorrectly(desired)) return null;

    debug(`Voice: drifted out of "${desired ?? "the main room"}" - re-applying.`);
    return enqueue(() => applyAndReport(desired, null));
}

/* ==========================================================================
 * TALKING TO THE GM
 * ========================================================================== */

/**
 * Both of these go to the GMs and nowhere else.
 *
 * Not tidiness - a room name identifies a Scene Region, so a broadcast
 * "I am now in drpg-<scene>-kitchen" would tell every player's console exactly
 * which room every other player is standing in. That is the one thing
 * visibility.mjs exists to hide.
 */
function toGms(payload) {
    const recipients = activeGmIds();
    if (!recipients.length) return;
    game.socket.emit(SOCKET_EVENT, payload, { recipients });
}

/**
 * "Where do I belong?" - the pull that replaces the GM's guesswork.
 *
 * Costs one socket message per join, and it is the only thing in this subsystem
 * that does not depend on the GM having noticed something. A client that has
 * just loaded, refreshed, or had its A/V restarted is exactly the client whose
 * state the GM cannot see.
 */
function askWhereIBelong() {
    try {
        toGms({ action: VOICE.whoAmI, userId: game.user.id });
    } catch (err) {
        error("Could not ask which voice room this client belongs in", err);
    }
}

function report(requestId, room, state) {
    try {
        toGms({
            action: VOICE.applied,
            userId: game.user.id,
            requestId: requestId ?? null,
            room: room ?? null,
            state
        });
    } catch (err) {
        error("Could not confirm a voice room assignment", err);
    }
}

/**
 * @param {object} payload
 * @param {string} senderId  Foundry's own second argument: who actually sent
 *   this. Used for the permission check rather than anything inside the payload,
 *   which is a claim a player's console could make.
 */
function onVoiceSocket(payload, senderId) {
    if (payload?.action !== VOICE.assign) return;
    // Addressed to somebody else. `recipients` already narrows this; the check
    // costs nothing and covers a broadcast.
    if (payload.target && payload.target !== game.user.id) return;

    // The PRIMARY GM, not any GM. Only one client is supposed to be running this
    // automation - voice.mjs says so at length about why - and accepting from
    // every GM would quietly undo that the moment a second one is at the table
    // with a stale module state. Both sides compute the same answer from the
    // same user list; see `primaryGmId`.
    if (senderId !== primaryGmId()) return;

    const room = payload.room ?? null;
    desired = room;
    enqueue(() => applyAndReport(room, payload.requestId ?? null));
}

/* ==========================================================================
 * APPLYING
 * ========================================================================== */

function enqueue(fn) {
    chain = chain.then(fn).catch(err => error("Voice apply failed", err));
    return chain;
}

/** Whether the LiveKit AV client module is enabled at all. Shared with voice.mjs. */
export function avclientActive() {
    return Boolean(game.modules.get(AV_MODULE)?.active);
}

function liveKitClient() {
    return game.webrtc?.client?._liveKitClient ?? null;
}

/**
 * Is LiveKit the A/V client this world is actually using?
 *
 * `AVMaster` builds `this.client` from `CONFIG.WebRTC.clientClass` in its
 * constructor, and `LiveKitAVClient`'s own constructor creates `_liveKitClient`
 * - so if the A/V client exists and has no `_liveKitClient`, some other class is
 * in charge and no amount of waiting will change that.
 *
 * The distinction matters: "not LiveKit" has to settle as unavailable, while
 * "LiveKit, not initialised yet" has to defer and be retried. Collapsing the two
 * into "not ready" left a client that could never be ready deferring forever,
 * once a minute, silently.
 */
function usingLiveKit() {
    const client = game.webrtc?.client;
    if (!client) return null;                 // too early to tell
    return Boolean(client._liveKitClient);
}

/**
 * Can this client be told where to go yet?
 *
 * `initState` is avclient-livekit's own string enum ("uninitialized" ->
 * "initializing" -> "initialized"); it is set to the last of those immediately
 * before the `liveKitClientInitialized` hook this file listens for. Calling
 * `game.webrtc.connect()` before then reaches a client with no room object and
 * no local tracks, which is how an assignment can "succeed" and change nothing.
 */
function clientReady() {
    const client = liveKitClient();
    return Boolean(client) && client.initState === "initialized";
}

/**
 * The Room's own connection state: livekit-client's `Room#state` ("connected", "disconnected", "connecting",
 * "reconnecting"; the names voice-tile.mjs `voiceWord` reads), else avclient-livekit's `connectionState`, else null
 * when neither is a string - a client this file does not know, read as live, as it was before E19 C2.
 *
 * @returns {string|null}
 */
function roomState() {
    const client = liveKitClient();
    const state = client?.liveKitRoom?.state ?? client?.connectionState;
    return typeof state === "string" ? state : null;
}

/** The states in which livekit-client is still getting there on its own: not a verdict yet. */
const PENDING_STATES = ["connecting", "reconnecting", "signalReconnecting"];

/** Whether this browser's voice is connected now (E19 C2): see `roomState`. */
function live() {
    const state = roomState();
    return state === null || state === "connected";
}

/**
 * avclient-livekit's own setting for a browser that sends its audio from the LiveKit web client (the design's
 * reading). Here since E19 C2, so `landedCorrectly` can ask it; voice.mjs `micHold` imports it from here.
 */
export function externalAV() {
    try {
        return game.settings.settings?.has?.(`${AV_MODULE}.useExternalAV`) === true
            && game.settings.get(AV_MODULE, "useExternalAV") === true;
    } catch {
        return false;
    }
}

/**
 * Every room this module invents starts with this. Exported so voice.mjs builds
 * its names from the same constant `landedCorrectly` recognises them by.
 */
export const ROOM_PREFIX = "drpg-";

/**
 * The dead channel (E19 C3; S11-26, D8, the owner's A9 of 11.10): one room for every student whose death is not
 * public, from the first of its triggers on (voice.mjs `deathVoiceGone`). One of ours by the prefix, so
 * `landedCorrectly` reads it as a breakout; a room `liveKitRoomFor` names carries a scene id, a slug and a hash
 * after the prefix, and an Eclipse room `eclipse-`, so none is named the same. `micHold` reads it off `desiredRoom()` for the tile's "deadAlone".
 */
export const DEAD_ROOM = `${ROOM_PREFIX}dead`;

/**
 * Where a player's voice goes in an Eclipse: nowhere (E19 C4, 19.10.2026; the owner's answer of 25.09, audit S11-11).
 * The primary GM sends this name, and the browser it names leaves voice on it rather than joining it (`applyBreakout`).
 * Until C4 the browser joined it, a LiveKit room of one, connected through the whole placement window. Still one
 * name per account, and still the room LiveKit is pointed at while out: a connect this file did not ask for (Foundry's
 * own after an A/V settings change) lands alone, as before C4, and the self-check leaves it again. The GMs' shared
 * room is voice.mjs `eclipseRoomFor`'s other name, which no browser leaves on.
 *
 * @param {string} userId
 * @returns {string}
 */
export function silentRoomFor(userId) {
    return `${ROOM_PREFIX}eclipse-${userId}`;
}

/** Whether `room` is this browser's own `silentRoomFor`: the primary GM's word for "be in no voice channel". */
function silentFor(room) {
    return typeof room === "string" && Boolean(game.user?.id) && room === silentRoomFor(game.user.id);
}

/**
 * Did this client end up where it was asked to?
 *
 * `LiveKitAVClient#connect()` sets `this.room` to the breakout room when one is
 * set and to the world's configured room otherwise - so it, and not
 * `breakoutRoom`, is the honest answer. `breakoutRoom` is the property we write
 * ourselves one line earlier: reading it back proves that the assignment
 * statement executed and nothing else, which is exactly what the first version
 * of this check did.
 *
 * "The main room" is deliberately expressed as "not one of ours" rather than as
 * an equality against `liveKitConnectionSettings.room`. That setting is `{}` on
 * a world whose GM has not configured A/V yet - the room name is generated on
 * the first connect - so comparing against it would call a perfectly good
 * return-to-main a failure at exactly the moment a table is setting up.
 */
function landedCorrectly(target) {
    // A drop keeps the name (lib/livekit.mjs `drop`, as the module reads avclient-livekit's `onDisconnected`), so
    // the name alone answered "unchanged" for a browser that hears nobody (E19 C2; audit S11-09). Not asked of a
    // browser that joins voice in LiveKit's own page (`useExternalAV`): Foundry's Room never connects there, and
    // a connect for it opens another Join window rather than a voice.
    // Out of voice (an Eclipse): landed once the Room says it is disconnected, whatever name it keeps. LiveKit's own
    // page (`useExternalAV`) is not left from here, so there the name is read as for any room.
    if (silentFor(target) && !externalAV()) return roomState() === "disconnected";
    if (!externalAV() && !live()) return false;
    const room = game.webrtc?.client?.room ?? null;
    if (target) return room === target;
    return !String(room ?? "").startsWith(ROOM_PREFIX);
}

/** For logging: what room the client believes it is in. */
function currentRoomLabel() {
    const room = game.webrtc?.client?.room ?? null;
    return room && String(room).startsWith(ROOM_PREFIX) ? room : "the main room";
}

/**
 * Point this client's voice at a room, or at the main room with `null`.
 *
 * Sets the same `breakoutRoom` property avclient-livekit's own `breakout()`
 * sets and then calls the public `game.webrtc.connect()`, which reads it when
 * it works out the room name (see `LiveKitAVClient#connect`). Switching rooms
 * IS a disconnect and a reconnect - that is not a failure, and `voice.mjs`
 * silences the warning avclient-livekit raises about it.
 *
 * THREE THINGS `AVMaster#connect()` DOES THAT THIS HAS TO ACCOUNT FOR, all read
 * off the core source in `client/av/master.mjs`:
 *
 *   · it RETURNS FALSE rather than throwing when A/V is disabled for the world
 *     or when the client could not connect (bad credentials, dead server, a
 *     rejected token). Ignoring the return value is how every client at a table
 *     with misconfigured A/V used to report success.
 *   · it DE-DUPLICATES: `if (this.#connecting) return this.#connecting`. A
 *     connect already in flight - started by the A/V config app, by a settings
 *     change, or by avclient-livekit itself - means our call resolves with
 *     somebody else's result and our room never gets applied. Only comparing
 *     the room actually connected to catches that.
 *   · it calls `client.initialize()` on EVERY connect, which re-fires
 *     `liveKitClientInitialized`. `applying` below keeps that from bouncing
 *     straight back into here.
 *
 * `remember: false` is the reconnect of a browser nobody gave a room (`reconnect`): the room LiveKit had, applied
 * without making it this browser's `desired`, which would say "the main room" where nobody said anything.
 *
 * @returns {Promise<"applied"|"unchanged"|"deferred"|"unavailable"|"failed">}
 */
export async function applyBreakout(room, { remember = true } = {}) {
    if (!avclientActive()) return "unavailable";

    // A/V is switched off for the whole world. `AVMaster#connect()` returns
    // false in that state without ever reaching LiveKit, which this file would
    // otherwise read as a failed room switch - and a failure is retried, so a
    // world with regional voice on and A/V off would have every client refusing
    // the same assignment once a minute, forever, with nothing saying why.
    // "Unavailable" settles instead: nothing more to do until somebody turns A/V
    // on, and turning it on fires `liveKitClientInitialized`, which re-asks.
    if (game.webrtc?.mode === foundry.av.AVSettings.AV_MODES.DISABLED) return "unavailable";

    // Some other A/V client class is in charge of this world. Nothing here can
    // ever apply, so say so once rather than deferring forever - see
    // `usingLiveKit`.
    if (usingLiveKit() === false) return "unavailable";

    const target = room ?? null;

    if (!clientReady()) {
        // Not a failure - the client is still coming up. Remember it; the
        // `liveKitClientInitialized` listener above will finish the job.
        if (remember) desired = target;
        debug(`Voice: A/V not ready, parking "${target ?? "the main room"}".`);
        return "deferred";
    }

    if (remember) desired = target;
    if (landedCorrectly(target)) {
        voiceBack();
        return "unchanged";
    }

    const client = liveKitClient();
    // How long the switch itself took (H82-03): avclient-livekit's disconnect, new tracks, token and connect - the part
    // the tile shows as "Connecting", which no harness can time (its shim connects at once). Said in the Debug log on
    // every connect, whatever its outcome, for a table to read (LIVE-H82-02).
    const startedAt = performance.now();
    let connected = false;
    // An Eclipse's word for this player (`silentFor`): Foundry's `AVMaster#disconnect` (fvtt-types 14.366 types it
    // `Promise<boolean>`, "whether an existing connection was terminated"), whose answer is not the verdict - the
    // Room's state is, below. `breakoutRoom` still names the account's own room, so a connect not asked here lands alone.
    const leave = silentFor(target) && !externalAV();
    setApplying(true);
    landedAlone = false;
    try {
        client.breakoutRoom = room ?? undefined;
        if (leave) await game.webrtc.disconnect();
        else connected = await game.webrtc.connect();
    } catch (err) {
        // `breakout()` in avclient-livekit clears `breakoutRoom` on a failed
        // connect. `desired` is deliberately left alone, so the GM's next pass -
        // or its heartbeat - puts this client back where it belongs instead of
        // treating the main room as the answer.
        error(`Could not move this client's voice to "${target ?? "the main room"}"`, err);
        return "failed";
    } finally {
        setApplying(false);
        // E88 C6 (E88-12): which connect of this page it was (`connectsHere`, which `game.drpg.counters({ reset: true })`
        // does not zero), so that a table's Debug log counts the reconnects a crossing cost without lining the lines up
        // by hand; `voice.connect.ms` adds up the time this line already took.
        const took = Math.round(performance.now() - startedAt);
        connectsHere += 1;
        count("voice.connect");
        count("voice.connect.ms", took);
        debug(`Voice: the connect for "${target ?? "the main room"}" took ${took} ms (connect ${connectsHere} on this page).`);
    }

    if (!leave && connected === false) {
        debug(`Voice: A/V refused to connect for "${target ?? "the main room"}".`);
        return "failed";
    }
    if (!landedCorrectly(target)) {
        debug(`Voice: asked for "${target ?? "the main room"}" but landed in "${
            currentRoomLabel()}".`);
        return "failed";
    }

    debug(`Voice: now in "${target ?? "the main room"}".`);
    voiceBack();
    return "applied";
}

async function applyAndReport(room, requestId) {
    const state = await applyBreakout(room);

    if (state === "deferred") {
        parkedRequestId = requestId;
        return state;
    }

    parkedRequestId = null;
    report(requestId, room, state);
    return state;
}

/**
 * The GM's own client moving its own voice. Same path as everybody else's, so
 * there is one apply in this module rather than two that can drift.
 *
 * Never resolves to `undefined`: `enqueue` swallows a rejection into one, and a
 * caller reading that as "not one of the failure strings, so it worked" is how
 * a GM window once announced success for a switch that threw.
 */
export async function applyLocally(room) {
    const state = await enqueue(() => applyBreakout(room));
    return state ?? "failed";
}

/* ==========================================================================
 * A DROPPED CONNECTION (E19 C2, 19.10.2026; audit S11-09; the owner's A7 of 11.10)
 * --------------------------------------------------------------------------
 * Until C2 a drop was silent twice over: the self-check read the room's name, which a drop keeps, and voice.mjs
 * filtered avclient-livekit's own "Disconnected from LiveKit" warning by its prefix, every reason of it. The
 * player heard nobody until a reload and was never told. Now a drop is a card, through popup.mjs `showPopup`, so
 * it is kept in this browser's notice history (A7: the cards E19 adds go there; toasts stay out of it), and this
 * browser reconnects itself, with or without a GM connected.
 *
 * WHAT IS A DROP. The Room says `disconnected` and, a turn of the event loop later, is still this client's Room,
 * still disconnected, and this file is not moving it (`applying`). A switch of rooms - ours, Foundry's own after
 * an A/V settings change, avclient-livekit's breakout menu - disconnects the old Room and builds a new one, and
 * Foundry's `AVMaster#connect` disconnects first: the reason livekit-client gives a leave this browser asked for,
 * CLIENT_INITIATED, is no drop either. Two reasons are not fought: DUPLICATE_IDENTITY (the same account joined
 * from another window, which a reconnect here would throw out in turn, and it us) and PARTICIPANT_REMOVED (the
 * voice server's operator took this browser out). The reasons are livekit-client's DisconnectReason as this file
 * reads it - CLIENT_INITIATED 1, DUPLICATE_IDENTITY 2, PARTICIPANT_REMOVED 4, or their names - not read off
 * livekit-client's source on this machine (LIVE-E19-01 is a drop at a table).
 * ========================================================================== */

/**
 * This browser's own reconnect after a drop, in ms: the first step after the drop's card, each next one after the
 * step before failed. After the last one the self-check (45 s) and the GM's heartbeat keep trying. The steps are a
 * choice, not a reading of LiveKit: a blip is back at the first, a server restart has fifteen seconds before the
 * self-check takes over. Measured in scenario 75's phase H on the harness's LiveKit, every connect refused (one
 * run, 19.10.2026): the three reconnects started 1103, 5101 and 15102 ms after the drop.
 */
const RECONNECT_MS = [1000, 4000, 10000];

const OWN_LEAVE = [1, "CLIENT_INITIATED"];
const NOT_FOUGHT = [2, "DUPLICATE_IDENTITY", 4, "PARTICIPANT_REMOVED"];

/** The Room whose `disconnected` this file listens for. */
let watchedRoom = null;

/** The drop being told, or null: `{ retry, step, timer, dismiss }`. */
let lost = null;

function watchForDrops() {
    const room = liveKitClient()?.liveKitRoom ?? null;
    if (room === watchedRoom) return;
    watchedRoom = room;
    if (!room || typeof room.on !== "function") return;
    room.on("disconnected", reason => onRoomDisconnected(room, reason));
}

function onRoomDisconnected(room, reason) {
    if (applying || externalAV() || OWN_LEAVE.includes(reason) || silentFor(desired)) return;
    setTimeout(() => {
        if (applying || liveKitClient()?.liveKitRoom !== room || room.state !== "disconnected") return;
        voiceDropped(!NOT_FOUGHT.includes(reason));
    }, 0);
}

/** The card, once per drop, and the reconnect's first step. A drop not fought stops the steps of one that was. */
function voiceDropped(retry) {
    if (!lost) {
        lost = { retry, step: 0, timer: null, dismiss: dropCard(retry) };
        debug(`Voice: the connection dropped${retry ? "; reconnecting" : ", closed by the server or another window"}.`);
    } else if (!retry && lost.retry) {
        lost.retry = false;
        if (lost.timer) clearTimeout(lost.timer);
        lost.timer = null;
    }
    if (lost.retry && lost.timer === null) nextReconnect();
}

function dropCard(retry) {
    try {
        return showPopup(`<p>${game.i18n.localize(retry ? "DRPG.Voice.drop.retry" : "DRPG.Voice.drop.closed")}</p>`, {
            title: game.i18n.localize("DRPG.Voice.drop.title"), kind: "error", sticky: true
        });
    } catch (err) {
        error("Could not show the card about the dropped voice connection", err);
        return null;
    }
}

function nextReconnect() {
    if (!lost?.retry || lost.step >= RECONNECT_MS.length) return;
    const wait = RECONNECT_MS[lost.step++];
    const timer = setTimeout(() => {
        if (lost?.timer !== timer) return;
        lost.timer = null;
        enqueue(reconnect).then(() => {
            if (lost?.retry && lost.timer === null) nextReconnect();
        });
    }, wait);
    lost.timer = timer;
}

/** Back where this browser was: its `desired` room (reported to the GMs), else the room LiveKit had. */
function reconnect() {
    if (!lost && live()) return Promise.resolve("unchanged");
    if (desired !== undefined) return applyAndReport(desired, null);
    return applyBreakout(liveKitClient()?.breakoutRoom ?? null, { remember: false });
}

/** Connected again: the card goes and the steps stop. Its entry stays in the history. */
function voiceBack() {
    if (!lost) return;
    const { timer, dismiss } = lost;
    lost = null;
    if (timer) clearTimeout(timer);
    try {
        dismiss?.();
    } catch (err) {
        debug("The card about the dropped voice connection could not be closed", err);
    }
    debug("Voice: connected again.");
}

/**
 * The drop being told, read-only, for the suite and a console: null, or whether this browser reconnects itself
 * and how many of its steps have started.
 *
 * @returns {{retry: boolean, step: number, waiting: boolean}|null}
 */
export function voiceDrop() {
    return lost ? { retry: lost.retry, step: lost.step, waiting: lost.timer !== null } : null;
}

/**
 * The room the primary GM last sent this browser, read-only (E78 C2, 13.10.2026): `undefined` while nobody has
 * said, `null` for the main room. `micHold` reads it to know an Eclipse room from the facts this browser already
 * holds. No new writer: `desired` is still written only by `onVoiceSocket`, behind its primary-GM check, and by
 * `applyBreakout`, which that socket and a GM's own `applyLocally` reach.
 */
export function desiredRoom() {
    return desired;
}

/** For `resetAllVoice` and the settings toggle: forget what we were told. */
export function forgetDesiredRoom() {
    desired = undefined;
    parkedRequestId = null;
}
