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
import { activeGmIds, primaryGmId, debug, error } from "./utils.mjs";

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
    /**
     * GM -> primary GM: "I picked a room by hand; leave my voice where it is"
     * (or "I have stopped, steer me again"). Only a GM sends this, and only the
     * client running the assignment loop acts on it - see `manualUsers` in
     * voice.mjs.
     */
    manual: "voice.manual"
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
        if (applying) return;               // our own reconnect - see `applying`
        debug("Voice: A/V client initialised.");
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

    // Registered here rather than at `init`: `game.socket` does not exist yet
    // when the module wires itself up.
    Hooks.once("ready", () => {
        game.socket.on(SOCKET_EVENT, onVoiceSocket);
        startSelfCheck();
        if (!avclientActive()) return;
        askWhereIBelong();
    });
}

/**
 * Notice when this client has fallen out of the room it belongs in.
 *
 * The GM's heartbeat cannot see this. It skips anyone whose room it has a
 * confirmation for, and a confirmation stays true right up until something
 * outside Foundry breaks it - a LiveKit server restarted under the table, a
 * network drop, a token that expired. avclient-livekit's `onDisconnected` does
 * not clear `breakoutRoom` and does not reconnect, so from the GM's side
 * everything still looks settled while the player hears nobody.
 *
 * This is the client noticing on its own behalf. It costs one property read a
 * minute and sends nothing at all unless something is actually wrong; when
 * something is, it re-applies and tells the GM, so `settled` stops lying too.
 */
const SELF_CHECK_MS = 45000;
let selfCheckTimer = null;

function startSelfCheck() {
    if (selfCheckTimer) clearInterval(selfCheckTimer);
    selfCheckTimer = setInterval(() => {
        if (desired === undefined) return;      // nobody has told us anything
        if (applying) return;                   // mid-switch; not a verdict yet
        if (!avclientActive() || !clientReady()) return;
        if (landedCorrectly(desired)) return;

        debug(`Voice: drifted out of "${desired ?? "the main room"}" - re-applying.`);
        enqueue(() => applyAndReport(desired, null));
    }, SELF_CHECK_MS);
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

function avclientActive() {
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
 * Every room this module invents starts with this. Exported so voice.mjs builds
 * its names from the same constant `landedCorrectly` recognises them by.
 */
export const ROOM_PREFIX = "drpg-";

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
 * @returns {Promise<"applied"|"unchanged"|"deferred"|"unavailable"|"failed">}
 */
export async function applyBreakout(room) {
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
        desired = target;
        debug(`Voice: A/V not ready, parking "${target ?? "the main room"}".`);
        return "deferred";
    }

    desired = target;
    if (landedCorrectly(target)) return "unchanged";

    const client = liveKitClient();
    let connected = false;
    applying = true;
    try {
        client.breakoutRoom = room ?? undefined;
        connected = await game.webrtc.connect();
    } catch (err) {
        // `breakout()` in avclient-livekit clears `breakoutRoom` on a failed
        // connect. `desired` is deliberately left alone, so the GM's next pass -
        // or its heartbeat - puts this client back where it belongs instead of
        // treating the main room as the answer.
        error(`Could not move this client's voice to "${target ?? "the main room"}"`, err);
        return "failed";
    } finally {
        applying = false;
    }

    if (connected === false) {
        debug(`Voice: A/V refused to connect for "${target ?? "the main room"}".`);
        return "failed";
    }
    if (!landedCorrectly(target)) {
        debug(`Voice: asked for "${target ?? "the main room"}" but landed in "${
            currentRoomLabel()}".`);
        return "failed";
    }

    debug(`Voice: now in "${target ?? "the main room"}".`);
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
 * the eavesdrop dialog used to announce success for a switch that threw.
 */
export async function applyLocally(room) {
    const state = await enqueue(() => applyBreakout(room));
    return state ?? "failed";
}

/** For `resetAllVoice` and the settings toggle: forget what we were told. */
export function forgetDesiredRoom() {
    desired = undefined;
    parkedRequestId = null;
}
