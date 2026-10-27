/**
 * Danganronpa RPG - voice per region.
 * ---------------------------------------------------------------------------
 * Rooms are private conversations. Text already enforces that - see
 * visibility.mjs (you cannot see who is not in your room) and
 * private-rolls.mjs (your dice are nobody else's business) - this does the
 * same for voice: every Scene Region becomes its own LiveKit breakout room,
 * and a player's voice client follows the moment their token crosses into a
 * different one.
 *
 * This file is the DECIDING half: which room does each person belong in, and
 * who needs to be told. The applying half - actually moving a voice client -
 * lives in voice-client.mjs and runs on every client, including this one. That
 * split is the fix for the whole subsystem; the reasoning is written out at the
 * top of that file, and the short version is that this side used to emit
 * avclient-livekit's own breakout message and record success immediately,
 * which meant every message that arrived before a client was listening was lost
 * permanently.
 *
 * Built on avclient-livekit's own breakout mechanism - not a fork of it, not a
 * patch to it. `breakoutRoom` plus `game.webrtc.connect()` is exactly what a GM
 * right-clicking "Start A/V breakout" in the Players list already does; what
 * this module no longer borrows is its socket, because that socket is only
 * listened to between `ready` and a page refresh.
 *
 * Entirely optional. Without avclient-livekit installed and active, and without
 * the world setting turned on, every function below is a no-op - nothing else
 * in this module depends on any of it.
 *
 * A Monokuma follows the same rule as a student: wherever the token stands is
 * whose voice they hear. Which GM that is comes from the SAME map the Despair
 * panel already uses (`poolUserFor` in monokuma.mjs) - a Monokuma spends one
 * GM's Despair and speaks with that GM's voice, not two separate assignments
 * to keep in sync. A token dragged off every mapped room sends that GM back
 * to the main room. (There is no "listen in by hand" any more - Dawid, 13.09:
 * LiveKit shows the listener's tile to the room, so it was never a secret.
 * Since E78 the voice tile takes that dock off the screen, and what shows a
 * listener now is the number on the tile's speaker button: every participant
 * of the viewer's own LiveKit room, silent ones included - voice-tile.mjs
 * `channelCount`, R550, E78 fix r1-G1.)
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS, getSetting, getClock, isDeadForGm, isDeceased, isEclipse, deathRecordFor, seasonEpoch } from "./settings.mjs";
// `allRooms` only - the per-actor lookup is `locateActor`, imported lazily in
// `reconcileNow`, because it is the one that does not depend on which scene
// this GM happens to be looking at.
import { allRooms, moveRefused, moveVerdict, whenAtRest } from "./movement.mjs";
import { roomPieces, roomRegions, isMoveChange, isTrialScene } from "./rooms.mjs";
import { isMonokuma, poolUserFor } from "./monokuma.mjs";
import { VOICE, ROOM_PREFIX, DEAD_ROOM, applyLocally, forgetDesiredRoom, avclientActive, desiredRoom, externalAV, silentRoomFor } from "./voice-client.mjs";
import { isPrimaryGm, primaryGmId, debug, warn, error, plural, gmReport } from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";
// E88 C6: a token outside every room counted, and its room kept (`keepRoomsThroughGaps`); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";

const AV_MODULE = "avclient-livekit";
const SOCKET_EVENT = `module.${MODULE_ID}`;

/** Coalesces a burst of token moves (a drag, several players placing at once)
 *  into a single reassignment pass rather than reconnecting mid-drag. A settled
 *  move is decided at once besides (the updateToken hook, H82-02), and this pass
 *  after it is the backstop. */
const RECONCILE_DEBOUNCE_MS = 1500;

/**
 * How long to wait for a client to confirm, and how many times to say it again.
 *
 * A client that is still loading answers "deferred" and applies the room when
 * its A/V comes up, so these retries are not for slow startup - they are for
 * the message that never arrived at all, and for the client whose reconnect
 * failed. Three tries over twenty seconds, then the heartbeat takes over.
 */
const RETRY_MS = [2000, 6000, 12000];

/** A slow re-assert, so nothing can be wrong for longer than this. */
const HEARTBEAT_MS = 60000;

/**
 * The character tokens whose last move update this browser heard was a step of a drag still in flight (waypoints
 * pending), by token id, each with the timer that drops it (H82 fix r1, 23.10.2026; finding H82-C2-R1). While one is
 * here no immediate pass is asked: a pass reads every token as it stands, a dragged one on its pending step, so until
 * this fix another character's settled move during a drag sent the dragger the room the drag was only passing, and the
 * drag's end then queued a second reconnect behind it (scenario 75 I, red with this hook as 4e20bf6b left it, once: Botan's
 * step 209 ms into Aiko's pending step through Dorm A sent p1 Dorm A at +211 ms, and the drag's end Dorm B at +616). The
 * drag's own settled last step takes its token out and asks the pass,
 * which places everybody who settled meanwhile. An entry is dropped RECONCILE_DEBOUNCE_MS after its step - a drag that
 * never settles holds the immediate passes no longer than the backstop waits - and when its token is deleted.
 */
const draggedNow = new Map();
/** Each character token's move updates as this browser heard them, so a pass asked late knows whether a newer one came. */
const moveTurns = new Map();

/**
 * The room each character's token last stood in on this browser's passes (E88 C6, 27.10.2026; triage C3, the owner's
 * voice cut-outs "as if it disconnected", and Q3's default): actor id -> `{ sceneId, level, room, gap }`. In memory
 * only (no world data, the stage's rule): a reload, or a new primary GM, starts it empty, and a token outside every
 * room is then placed as before E88 - the main room.
 *
 * WHY. Every change of voice room is a whole LiveKit disconnect and connect (voice-client.mjs `applyBreakout`), and a
 * token outside every region was `CLAIM.nowhere`, the main room. A crossing over a doorway square or an undrawn
 * corridor was two reconnects for one crossing - into the main room, then into the next room - and a step into the
 * gap and back two for none. Scenario 75 I at addc1522 (1.2.88's voice.mjs), 27.10.2026: Aiko from the Gym onto a
 * square between the Gym and Dorm B, then into Dorm B - p1 sent the main room at +2 ms and Dorm B at +1804, two
 * connects in p1's Debug log; Dorm B, the gap and Dorm B again - the same two for no change of room. With this map:
 * one send and one connect, and none (the commit's message has the run).
 */
const roomsKept = new Map();

/**
 * Empty `roomsKept` on a browser that is not the primary GM now (E88 fix G1, 27.10.2026; finding E88-SEC-1). The map is
 * a primary's own: it follows the passes the primary runs on every settled move, and a browser that is not the primary
 * runs none, so what it holds goes stale the moment another GM takes over. Until this fix it was emptied only inside
 * `voiceTargets`, which every caller but a GM's dry run (`voicePlan`) reaches on the primary alone - so a GM that
 * stopped being the primary kept its map and used it again when it was the primary once more: scenario 17 V1 at
 * 001e9af5, the Assistant alone kept Aiko in Dorm A, a full Gamemaster came and went while she walked into the Gym
 * and out, and the Assistant's first pass after placed her in Dorm A again. Asked wherever the primary can change -
 * a user connecting or leaving, a user's role written - and by the heartbeat, on every browser, before any of them
 * returns for not being the primary; so a GM that becomes the primary starts with nothing kept (a token outside every
 * room: the main room, as before E88).
 */
function standDownRoomsKept() {
    if (!isPrimaryGm()) roomsKept.clear();
}

/**
 * `locate` for `placeVoices` that keeps a token's last room while it stands outside every room (E88 C6): `{ locate,
 * done }`. `locate(actor)` asks `where(actor)` (movement.mjs `locateActor`); a token in a room is remembered and
 * answered as it stands, and a token outside every room on the scene and the floor its remembered room is on, while
 * that room is still a room there (`stands`), is answered as standing in it, `kept: true`. A token on another scene or
 * floor, a room deleted, no token, or nothing remembered: as it stands - the main room, as before. `done()` after the
 * pass forgets every character `locate` was not asked about in it: `voiceClaim` asks only for the living, connected
 * and placed by their tokens, so an Eclipse, the trial, a death or a lost connection clears what it remembered, and
 * nobody comes out of one into a room they left before it. A token dragged by a GM into a corridor on purpose keeps
 * its room too (Q3's default asks no reason); a move into another room, off the scene, or a pass in an Eclipse or the
 * trial ends it. Counted for `fps()` and scenario 75: `voice.gap` each time a token outside every room is located,
 * `voice.gap.kept` each time its room is kept; the first pass that keeps one says so in the Debug log.
 *
 * WHO KEEPS, AND FROM WHAT (E88 fix G1, 27.10.2026). A living player's token only (`keeps`; the spec's C6 line, findings
 * E88-END-03 and E88R-06): a Monokuma's token is a GM's voice, and a GM who walks it out of a room into a corridor
 * means to leave that room, so it is placed as it stands - the main room - and nothing of it is remembered. And a room
 * is remembered only from a token whose latest move this browser has judged and not refused (`settled`, movement.mjs
 * `moveVerdict`; finding E88-SEC-2): a refused entry from a doorway square, read by a pass another token's settled move
 * asked before the put-back landed, is placed where it stands for that pass, as before E88, and not remembered - so
 * after the put-back the token keeps the room it came from, not the room it was refused.
 *
 * @param {Map<string, object>} memory   `roomsKept`, or a test's own
 * @param {(actor: object) => object|null} where  actor -> `{ scene, room, level, tokenDoc }` or null
 * @param {object} [options]
 * @param {(scene: object, room: string) => boolean} [options.stands]  whether `room` is still a room on `scene`
 * @param {(actor: object) => boolean} [options.keeps]  whether this character keeps a room through a gap at all
 * @param {(place: object) => boolean} [options.settled]  whether the token's room may be remembered
 * @returns {{locate: (actor: object) => object|null, done: () => void}}
 */
export function keepRoomsThroughGaps(memory, where, { stands = (scene, room) => roomRegions(scene, room).length > 0,
    keeps = actor => !isMonokuma(actor), settled = place => moveVerdict(place.tokenDoc) === false } = {}) {
    const seen = new Set();
    const locate = actor => {
        const place = where(actor);
        if (!actor?.id) return place;
        seen.add(actor.id);
        if (!place?.scene || !keeps(actor)) {
            memory.delete(actor.id);
            return place;
        }
        const level = place.level ?? null;
        if (place.room) {
            if (settled(place)) memory.set(actor.id, { sceneId: place.scene.id, level, room: place.room, gap: false });
            return place;
        }
        count("voice.gap");
        const last = memory.get(actor.id);
        if (!last || last.sceneId !== place.scene.id || last.level !== level || !stands(place.scene, last.room)) {
            memory.delete(actor.id);
            return place;
        }
        count("voice.gap.kept");
        if (!last.gap) debug(`Voice: "${actor.name ?? actor.id}" stands outside every room - keeps the voice of "${last.room}" until the next room.`);
        last.gap = true;
        return { ...place, room: last.room, kept: true };
    };
    const done = () => {
        for (const id of [...memory.keys()]) if (!seen.has(id)) memory.delete(id);
    };
    return { locate, done };
}

function markDragged(tokenId, pending) {
    clearTimeout(draggedNow.get(tokenId));
    if (!pending) {
        draggedNow.delete(tokenId);
        return;
    }
    draggedNow.set(tokenId, setTimeout(() => draggedNow.delete(tokenId), RECONCILE_DEBOUNCE_MS));
}

/**
 * The immediate pass for a settled move (H82-02), asked from the updateToken hook and once more at rest; true when it
 * was asked. Not while a drag is in flight (`draggedNow`), not once a newer move of the token came, and not for a route
 * this browser reads as refused (movement.mjs `moveRefused`; H82 fix r1, finding H82-C2-R2): its put-back is its own
 * settled move and asks the pass for the room paid for, and the backstop it re-arms covers a put-back that never comes.
 * Read a tick after the hook, when every updateToken listener has run, movement.mjs's judge among them. The backstop is
 * armed again after the pass, so it still follows the last pass asked by RECONCILE_DEBOUNCE_MS.
 */
async function passForSettledMove(doc, turn) {
    await null;
    if (draggedNow.size || moveTurns.get(doc.id) !== turn) return false;
    const refused = await moveRefused(doc).catch(() => false);
    if (refused || draggedNow.size || moveTurns.get(doc.id) !== turn) return false;
    scheduleReconcile({ immediate: true });
    scheduleReconcile();
    return true;
}

/**
 * How long a witness's assignment waits for the victim's own `voice.applied` before it is sent anyway (E19 C3; the
 * owner's A9 of 11.10 names 1500 ms): long enough for a victim's browser that answers to have left the room, short
 * enough that the witness does not stand in silence when the victim's browser never answers. A design number, not
 * measured at a table.
 */
const WITNESS_WAIT_MS = 1500;

export function registerVoice() {
    Hooks.on("updateToken", (doc, changes) => {
        if (!followsVoice(doc)) return;
        // A change of floor is a move (rooms.mjs `isMoveChange`, E12 C9): x and y alone missed a climb.
        if (!isMoveChange(changes)) return;
        // A settled move - no waypoints pending, the test fog.mjs `onUpdateToken` and movement.mjs `judgeMove` read
        // for a move that has ended - is decided at once (H82-02; the owner's 21.10.2026 "Delay przy laczeniu z nowym
        // pokojem"). Until H82 every move only re-armed the one module-wide debounce below, so a crossing waited
        // RECONCILE_DEBOUNCE_MS before anybody's room was decided, and any other character's step started the wait
        // again: scenario 75 I measured the GM's voice.assign at +1507 ms after the GM's update, and at +5518 ms with
        // Botan stepping inside the Cafeteria every second (896f6bf); decided here, +8 ms and +3-5 ms (two runs). The
        // pass sends only the accounts whose room changed (`assignUser`'s `settled` and `inFlight`). The debounced
        // pass stays after it as a backstop that reads the token where it stands. A step of a drag still in flight asks
        // no pass, and while one is in flight nobody's settled move asks one either (`draggedNow`), so no voice is
        // reconnected mid-drag - as far as v14 marks a drag's steps pending on the primary's copy (LIVE-E78-14,
        // LIVE-E79-19, LIVE-H82-02 (c)). Nor does a route the primary reads as refused (`passForSettledMove`).
        // At rest the pass is asked once more (H82 fix r1, finding H82-C2-R3), as fog.mjs and movement.mjs read the room
        // again then: the owner's v14 report of 14.10.2026 (movement.mjs `whenAtRest`) has the hook reading the room
        // before the drag ended, and a pass that finds every room placed sends nothing. A last step v14 still marks
        // pending (the report's other reading) asks none and waits for the backstop, as in 1.2.81 - LIVE-H82-02 (b) asks
        // the primary's "read again at rest" Debug line to tell the two apart.
        const pending = Boolean(doc.movement?.pending?.waypoints?.length);
        const turn = (moveTurns.get(doc.id) ?? 0) + 1;
        moveTurns.set(doc.id, turn);
        markDragged(doc.id, pending);
        if (!pending) {
            passForSettledMove(doc, turn).catch(err => error("Could not decide the voice rooms after a move", err));
            if (isPrimaryGm() && getSetting(SETTINGS.voiceEnabled)) {
                whenAtRest(doc).then(() => passForSettledMove(doc, turn))
                    .catch(err => error("Could not decide the voice rooms after a move came to rest", err));
            }
        }
        scheduleReconcile();
    });
    // A token dragged onto the map from the sidebar is a `createToken`, not an
    // `updateToken`, and placing one during an Eclipse is the single most common
    // way a character arrives in a room. Removing one likewise has to release
    // whoever was following it.
    Hooks.on("createToken", doc => { if (followsVoice(doc)) scheduleReconcile(); });
    Hooks.on("deleteToken", doc => {
        markDragged(doc.id, false);
        moveTurns.delete(doc.id);
        if (followsVoice(doc)) scheduleReconcile();
    });
    Hooks.on("canvasReady", () => scheduleReconcile({ immediate: true, force: true }));
    Hooks.on("drpgTimeOfDayChanged", () => scheduleReconcile({ immediate: true }));

    /**
     * A client that has just (re)connected starts in the main room.
     *
     * Their LiveKit client is brand new, so whatever we last told them is void.
     * Forgetting them is what makes the next pass actually re-send. The pass is
     * a backstop rather than the mechanism: the joining client asks for its own
     * room as soon as it can (see `askWhereIBelong` in voice-client.mjs), which
     * is the path that does not depend on this GM guessing when they are ready.
     */
    Hooks.on("userConnected", (user, connected) => {
        standDownRoomsKept();
        if (!isPrimaryGm()) return;
        forget(user.id);
        if (!connected) return;
        scheduleReconcile({ force: true });
    });
    // A role written can change the primary (`primaryGmId` prefers a full Gamemaster): the kept rooms are a primary's own.
    Hooks.on("updateUser", (user, changes) => {
        if ("role" in (changes ?? {})) standDownRoomsKept();
    });
    // What changes whose voice goes where without moving a token (`reconcileTrigger`): without these the change
    // would not land until the next time somebody happened to walk somewhere, or the heartbeat.
    for (const hook of RECONCILE_HOOKS) {
        Hooks.on(hook, (doc, changes) => {
            const options = reconcileTrigger(hook, doc, changes);
            if (options) scheduleReconcile(options);
        });
    }
    // A death kept by the GMs writes nothing on the actor (E05 C10): its store's change
    // is the one sign of it, on the GM that wrote it and on each that merged it.
    Hooks.on("drpgDeathsChanged", () => {
        if (game.user?.isGM) scheduleReconcile({ immediate: true });
    });
    // The dead channel's triggers that write no setting of the world (E19 C3; A9): the GMs' cast changed (a
    // castStore write, or another GM's merged in - E67's `silencedDead` among its fields), and the cast arriving
    // after a load or a change of primary, while which the dead of this chapter keep their rooms (`deathVoiceGone`'s null).
    Hooks.on("drpgCastChanged", () => {
        if (isPrimaryGm()) scheduleReconcile();
    });
    // Both edges, and both immediate. Starting an Eclipse takes every voice off
    // the rooms at once - a placement window that begins with the table still
    // mid-conversation is a placement window everybody can hear - and ending it
    // puts them all back in a single pass.
    Hooks.on("drpgEclipseChanged", () => scheduleReconcile({ immediate: true, force: true }));

    Hooks.once("ready", () => {
        game.socket.on(SOCKET_EVENT, onVoiceSocket);
        suppressBreakoutToasts();
        startHeartbeat();
        warnIfMisconfigured();
        if (game.user?.isGM) {
            import("./gm-stores.mjs")
                .then(({ castStore }) => castStore.whenHydrated())
                .then(() => scheduleReconcile({ immediate: true }))
                .catch(err => error("Could not place the voices once the cast arrived", err));
        }
    });
}

/** The document hooks `reconcileTrigger` answers. */
const RECONCILE_HOOKS = ["updateActor", "updateUser", "createRegion", "updateRegion", "deleteRegion", "createSetting", "updateSetting"];

/**
 * Whether a document change moves somebody's voice, and how soon: the options for `scheduleReconcile`, or null.
 *
 * Dying takes a voice away and opting in as a Monocub gives it back (at once, as before E19 C2). Since C2 (audit
 * S11-33 (d)) also, debounced like a token's move: an actor's ownership (whose voice a student is, `activeOwnerOf`),
 * a user's character or role, a Scene Region made, changed or deleted (the rooms a voice room is named for), and
 * the two settings that say whose voice a Monokuma is (monokuma.mjs `poolUserFor`: the Monokuma pools and the
 * Despair pools). Since C3 (A9) at once, the dead channel's triggers that are world settings: the incident's
 * public half (`murderState`: an incident opened or closed) and the discoveries' stamps (`bodiesFound`). Since C4
 * at once, the clock (an Eclipse begun or ended by any write of it, besides the roads that announce one with
 * `drpgEclipseChanged`; a time of day or a phase too, a pass that sends nothing where nothing moved). Pure, so
 * R813, R815 and R818 ask it a table.
 *
 * @param {string} hook
 * @param {object} doc
 * @param {object} [changes]  an update's changes; a create's or a delete's options, not read
 * @returns {{immediate?: boolean}|null}
 */
export function reconcileTrigger(hook, doc, changes) {
    switch (hook) {
        case "updateActor": {
            // A flag deleted counts as one set (E15 part 1 fix e1-G3): a revive's `unsetFlag` may arrive as
            // `-=deceased` (LIVE-E30-03), and states.mjs `namesFlag` reads the same spellings; R980 asks both.
            const all = changes?.flags;
            const flags = all?.[MODULE_ID];
            const named = key => Boolean(flags && typeof flags === "object" && (key in flags || `-=${key}` in flags));
            if ((all && typeof all === "object" && `-=${MODULE_ID}` in all) || named(FLAGS.deceased) || named(FLAGS.monocub)) return { immediate: true };
            return changes && typeof changes === "object" && "ownership" in changes ? {} : null;
        }
        case "updateUser":
            return changes && typeof changes === "object" && ("character" in changes || "role" in changes) ? {} : null;
        case "createRegion":
        case "updateRegion":
        case "deleteRegion":
            return {};
        case "createSetting":
        case "updateSetting":
            if ([SETTINGS.murderState, SETTINGS.bodiesFound, SETTINGS.clock].some(key => doc?.key === `${MODULE_ID}.${key}`)) return { immediate: true };
            return [SETTINGS.monokumaPools, SETTINGS.despairPools].some(key => doc?.key === `${MODULE_ID}.${key}`) ? {} : null;
        default:
            return null;
    }
}

/**
 * Say so, once, when regional voice is on and cannot possibly work.
 *
 * Both halves of this are silent by design - an assignment nobody can apply is
 * reported as "unavailable" and settles, which is right and produces no noise at
 * all. That leaves a GM who switched the setting on, heard nothing, and has no
 * way to tell "working" from "off": the failure is two settings apart and
 * neither of them mentions the other.
 */
function warnIfMisconfigured() {
    if (!isPrimaryGm()) return;
    if (!getSetting(SETTINGS.voiceEnabled)) return;

    if (!avclientActive()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Voice.needsAvclient"));
        return;
    }
    if (game.webrtc?.mode === foundry.av.AVSettings.AV_MODES.DISABLED) {
        ui.notifications.warn(game.i18n.localize("DRPG.Voice.avDisabled"));
    }
}

/**
 * Silence avclient-livekit's own room-change chatter.
 *
 * A room auto-follows every token crossing here, so its notices - all written
 * for the rare manual right-click breakout - fire on every single crossing, for
 * every player, all session:
 *
 *   "Disconnected from LiveKit A/V Server: CLIENT_..."  warn
 *   "Joining A/V breakout room"                        info
 *   "Leaving A/V breakout room"                        info
 *
 * The first is the loudest, the most misleading, and now the only one this
 * module's own path can raise: switching rooms IS a disconnect and a reconnect,
 * so a perfectly healthy crossing announces itself as a failure in a warning
 * banner. `onDisconnected` appends the reason to the localized string, so it is
 * matched by PREFIX - an exact-match set would miss every variant of it. Until
 * E19 C2 that prefix took every reason with it, a server gone and a network lost
 * as well, and nothing else said so (audit S11-09). Since C2 a real drop is
 * voice-client.mjs's card, kept in the notice history (A7: toasts stay out of
 * it), so the warning is muted with the setting off too - the card is shown either
 * way, and the toast would say it twice.
 *
 * The other two live inside avclient-livekit's `breakout()`, which this module
 * stopped calling when the transport moved to voice-client.mjs. They are still
 * filtered because the Players-list context menu can raise them, and a GM using
 * it does not want a banner either.
 *
 * There is no setting for any of this and no hook to cancel a notification, so
 * the two methods are filtered at the source. Nothing else routed through them
 * is touched, and a genuine connection failure still reaches `error()`.
 */
function suppressBreakoutToasts() {
    if (!avclientActive()) return;

    for (const level of ["info", "warn"]) {
        const current = ui.notifications[level];
        if (current?.__drpgVoicePatched) continue;   // idempotent - safely() may retry

        const original = current.bind(ui.notifications);
        const patched = function drpgFilteredNotification(message, options) {
            if (breakoutToastMuted(message)) return;
            return original(message, options);
        };
        patched.__drpgVoicePatched = true;
        ui.notifications[level] = patched;
    }
}

/**
 * Whether `suppressBreakoutToasts` keeps a notification off the screen: avclient-livekit's disconnect warning,
 * any reason (`${onDisconnected}: ${reason}`, LiveKitAVClient#onDisconnected), always since E19 C2; its join and
 * leave notices only while regional voice is on.
 *
 * @param {*} message
 * @returns {boolean}
 */
export function breakoutToastMuted(message) {
    const text = String(message ?? "");
    const disconnected = game.i18n.localize("LIVEKITAVCLIENT.onDisconnected");
    if (disconnected && text.startsWith(disconnected)) return true;
    // The join and leave notices only while THIS module is the thing causing the churn.
    //
    // The patch is installed once at `ready`, but the reason for it -
    // "a room auto-follows every token crossing" - is only true when
    // regional voice is switched on. Checked at call time rather than at
    // install time so a table using avclient-livekit's own breakout menu
    // with this feature off keeps its notifications, and so toggling the
    // setting mid-session takes effect without a reload.
    try {
        if (!getSetting(SETTINGS.voiceEnabled)) return false;
    } catch {
        return false;
    }
    return [game.i18n.localize("LIVEKITAVCLIENT.joiningAVBreakout"), game.i18n.localize("LIVEKITAVCLIENT.leavingAVBreakout")]
        .includes(text);
}

/**
 * Is this token one whose position anybody's voice follows?
 *
 * Only character tokens are. Without this filter every Remnant this module drops
 * scheduled a full reconcile pass - and an incident drops one on almost every
 * crisis action, success or failure, for both sides. The pass would then find
 * nothing to do, having walked every actor and located every token to get there.
 */
function followsVoice(tokenDoc) {
    // Nor is a token in the trial hall (E13 C1): nobody stands there (rooms.mjs), so no move of
    // one changes a voice room, and the students shown and hidden there at the trial's start
    // would each schedule a pass that finds nothing to do.
    return tokenDoc?.actor?.type === "character" && !isTrialScene(tokenDoc.parent);
}

/* ==========================================================================
 * WHAT WE HAVE TOLD EACH CLIENT, AND WHAT THEY CONFIRMED
 * --------------------------------------------------------------------------
 * `settled` is the only thing that lets this side skip a user. It is written
 * when a client says it applied a room, never when we merely sent one - which
 * is the difference between "they are in the Kitchen" and "a message about the
 * Kitchen left this browser". The old code recorded the second and believed the
 * first, and every message lost in flight became a player permanently in the
 * main room.
 *
 * Module-level and deliberately not persisted: it describes this GM browser's
 * session, and a fresh session should re-assert everything rather than trust a
 * note left by a previous one.
 *
 * Built by `createVoiceLedger` since E19 C2 (19.10.2026), so R813 drives the
 * conversation with a socket and timers of its own; the module holds one.
 * ========================================================================== */

/**
 * The primary GM's record of each client's voice: what it confirmed (`settled`) and what is being asked of it
 * (`inFlight`), with the asking and the answers.
 *
 * A FAILED ANSWER IS ASKED AGAIN (E19 C2; audit S11-33 (a)). Until C2 a "failed" closed the conversation it
 * answered - its no-answer timer cancelled, nothing sent again - and left `settled` as it was, so a client whose
 * reconnect failed waited for the heartbeat, up to a minute, and one whose `settled` still named the room was
 * skipped by the heartbeat too. Now a failed answer to the room being asked is asked again after `steps[attempt]`,
 * the same waits as an answer that never came, until the steps run out; and any "failed" - one answering an older
 * request, or a client's own reconnect after a drop (voice-client.mjs `reconnect`, no request id) - unsettles that
 * client, so the next pass sends again. A client is only ever unsettled by its own answer (`onVoiceSocket` keys
 * it by Foundry's sender).
 *
 * A VICTIM'S ANSWER RELEASES A WITNESS (E19 C3; A9). `waitApplied` is how the reconcile holds a witness's room until
 * the victim it would hear has left it (`sendInPasses`): it answers "applied" once that client's own answer settles
 * it in the room it was sent, or "timeout" after `witnessMs`. An answer is only ever the sender's own (`onVoiceSocket`
 * keys it by Foundry's sender), so one account's packet cannot release a witness on another's behalf.
 *
 * @param {object} [io]
 * @param {Function} [io.emit]    Foundry's `game.socket.emit(event, packet, options)`
 * @param {Function} [io.later]   `setTimeout(fn, ms)`, its answer what `cancel` takes
 * @param {Function} [io.cancel]  `clearTimeout(id)`
 * @param {number[]} [io.steps]   the waits, `RETRY_MS`
 * @param {number} [io.witnessMs] the longest `waitApplied` waits, `WITNESS_WAIT_MS`
 */
export function createVoiceLedger({ emit = (event, packet, { recipients }) => game.socket.emit(event, packet, { recipients }),
    later = (fn, ms) => setTimeout(fn, ms),
    cancel = id => clearTimeout(id), steps = RETRY_MS, witnessMs = WITNESS_WAIT_MS } = {}) {
    /** userId -> the room that client last confirmed. `null` is the main room. */
    const settled = new Map();

    /** userId -> { room, requestId, attempt, timer } for assignments in flight. */
    const inFlight = new Map();

    /** userId -> the `waitApplied` calls still waiting on that client: { room, done }. */
    const waiting = new Map();

    /**
     * Until `userId`'s own answer settles it in `room` (`null` the main room), or `witnessMs`.
     *
     * @returns {Promise<"applied"|"timeout">} "applied" at once when it is settled there already
     */
    function waitApplied(userId, room) {
        const target = room ?? null;
        if (settled.has(userId) && settled.get(userId) === target) return Promise.resolve("applied");
        return new Promise(resolve => {
            const entry = { room: target, done: null };
            const timer = later(() => entry.done("timeout"), witnessMs);
            entry.done = said => {
                cancel(timer);
                const list = waiting.get(userId) ?? [];
                const left = list.filter(other => other !== entry);
                if (left.length) waiting.set(userId, left);
                else waiting.delete(userId);
                resolve(said);
            };
            waiting.set(userId, [...(waiting.get(userId) ?? []), entry]);
        });
    }

    /** `userId` settled in `room`: every wait on that client for that room is over. */
    function release(userId, room) {
        for (const entry of [...(waiting.get(userId) ?? [])]) if (entry.room === room) entry.done("applied");
    }

    function forget(userId) {
        settled.delete(userId);
        const pending = inFlight.get(userId);
        if (pending?.timer) cancel(pending.timer);
        inFlight.delete(userId);
    }

    function forgetEveryone() {
        for (const userId of [...inFlight.keys()]) forget(userId);
        settled.clear();
    }

    /**
     * Tell one client where its voice belongs, and keep saying it until it answers.
     *
     * @returns {boolean} true if an assignment was actually sent.
     */
    function assignUser(userId, room, { force = false } = {}) {
        const target = room ?? null;

        if (!force && settled.get(userId) === target) return false;
        // Already asking this same client for this same room - do not stack a
        // second conversation on top of the first.
        if (!force && inFlight.get(userId)?.room === target) return false;

        forget(userId);
        return send(userId, target, 0);
    }

    /** @returns {boolean} true if the message actually left this browser. */
    function send(userId, room, attempt) {
        const requestId = foundry.utils.randomID();

        try {
            emit(SOCKET_EVENT, {
                action: VOICE.assign,
                target: userId,
                requestId,
                room
            }, { recipients: [userId] });
        } catch (err) {
            error(`Could not tell ${userId} which voice room to join`, err);
            inFlight.delete(userId);
            return false;
        }

        const timer = later(() => {
            const pending = inFlight.get(userId);
            if (!pending || pending.requestId !== requestId) return;

            if (attempt + 1 >= steps.length) {
                inFlight.delete(userId);
                debug(`Voice: ${game.users.get(userId)?.name ?? userId} never confirmed "${
                    room ?? "the main room"}"; leaving it to the heartbeat.`);
                return;
            }
            send(userId, room, attempt + 1);
        }, steps[attempt]);

        inFlight.set(userId, { room, requestId, attempt, timer });
        return true;
    }

    /**
     * A client answering about its own voice. `deferred` is not an answer - the client is still coming up and
     * will report again once its A/V is ready - so it neither settles nor cancels the retries.
     *
     * @returns {"waiting"|"settled"|"retry"|"gaveUp"|"unsettled"|"ignored"} what the answer did
     */
    function answer(userId, { room = null, state, requestId = null } = {}) {
        if (state === "deferred") return "waiting";
        if (!["applied", "unchanged", "unavailable", "failed"].includes(state)) return "ignored";

        const pending = inFlight.get(userId);

        /*
         * Which conversation is this answering?
         *
         * Confirmations can arrive late - a client that was still loading applies a
         * parked room seconds after we have already moved on and sent it somewhere
         * else. Cancelling the in-flight retries on ANY confirmation meant that late
         * answer silently killed the newer assignment's retries, and settling on the
         * room it named told this browser the player was somewhere they had just
         * been moved out of. The next pass corrects it, but the pass in between is a
         * player sitting in the wrong room with a GM who believes otherwise.
         *
         * So: an answer only closes the conversation it belongs to. A request id
         * that matches, or no id at all (an unsolicited re-report after a deferred
         * apply, or a client's own reconnect) naming the room we are actually waiting on.
         */
        const answersCurrent = Boolean(pending)
            && (requestId === pending.requestId
                || (!requestId && room === pending.room));

        if (answersCurrent) {
            cancel(pending.timer);
            inFlight.delete(userId);
        }

        if (state !== "failed") {
            // A stale confirmation is still true - that client really is in that
            // room - so it is worth recording, and recording it is what makes the
            // next pass notice the mismatch and re-send.
            settled.set(userId, room);
            release(userId, room);
            return "settled";
        }

        // "failed" - their reconnect did not take: not where `settled` says, whatever it says.
        settled.delete(userId);
        if (!answersCurrent) return "unsettled";
        const next = pending.attempt + 1;
        if (next >= steps.length) return "gaveUp";
        const timer = later(() => {
            if (inFlight.get(userId)?.timer !== timer) return;
            send(userId, pending.room, next);
        }, steps[pending.attempt]);
        inFlight.set(userId, { room: pending.room, requestId: null, attempt: next, timer });
        return "retry";
    }

    return { settled, inFlight, forget, forgetEveryone, assignUser, answer, waitApplied };
}

const voiceLedger = createVoiceLedger();
const { settled, forget, assignUser, waitApplied } = voiceLedger;

/**
 * A client answering. Only the primary GM keeps the record (`createVoiceLedger`).
 *
 * Exported with the ledger it answers into as a third argument (E19 C3), so R815 hands a packet from one account
 * about another to a ledger of its own; Foundry calls it with two, and the module's ledger answers.
 */
export function onVoiceSocket(payload, senderId, ledger = voiceLedger) {
    // A GM saying "I picked a room by hand" or "I have stopped".
    //
    if (payload?.action === VOICE.whoAmI) {
        // Not returned: a socket callback's return value goes nowhere, so an
        // async handler handed back raw becomes an unhandled rejection the first
        // time a scene lookup throws.
        onWhoAmI(senderId).catch(err => error("Could not answer a voice room query", err));
        return;
    }
    if (payload?.action !== VOICE.applied) return;
    if (!isPrimaryGm()) return;

    // Only ever about the sender's own voice. A payload claiming otherwise is
    // one client trying to rewrite this GM's picture of another.
    const userId = senderId;
    const user = game.users.get(userId);
    if (!user) return;

    const room = payload.room ?? null;
    const did = ledger.answer(userId, { room, state: payload.state, requestId: payload.requestId ?? null });
    if (did !== "waiting" && did !== "ignored") {
        debug(`Voice: ${user.name} answered "${room ?? "the main room"}" (${payload.state}): ${did}.`);
    }
}

/**
 * A client asking where it belongs.
 *
 * This is the path that fixes joining and refreshing, and the reason it works is
 * that it is driven by the one client that knows when it is ready. Answered even
 * while an Eclipse is running: somebody arriving mid-placement should still hear
 * the room they are standing in. The answer is `answerWhoAmI`'s, on this GM's ledger.
 */
async function onWhoAmI(userId) {
    if (!isPrimaryGm()) return;
    if (!getSetting(SETTINGS.voiceEnabled)) return;
    if (!avclientActive()) return;
    if (userId === game.user.id) return;

    await answerWhoAmI(userId, await voiceTargets(), {
        assign: (id, room, force) => assignUser(id, room, { force }),
        waitFor: (id, room) => waitApplied(id, room)
    });
}

/**
 * The answer to one browser asking where its voice belongs, from the reconcile's own decision (`voiceTargets`), in
 * the reconcile's order (E19 fix r1-G1, 19.10.2026; the review's E19-C3-2, E19-C3-3 and sec-1). Until the fix this
 * road answered every asker at once with its target and read neither `waits` nor the cast's absence: a witness who
 * asked inside the witness's wait was sent the crime room before the victim had left it, and a kept dead account
 * (the cast not here yet) was sent nothing, so its new page stayed in the main room, where the living heard it.
 *   - an account `held` (a player's, in a kept account's room, while the cast is unknown): nothing, as the pass
 *     sends it nothing - the pass after the cast arrives does;
 *   - a kept dead account: its `standIn`, the room after A9's trigger (the dead channel for a death kept secret, the
 *     main room for a public one), never the main room for a secret death; the pass after the cast arrives sends the
 *     room it belongs in, the room it died in included;
 *   - a witness (`waits`): the victims it would hear are sent their rooms first and its own answer waits for each
 *     victim's own `voice.applied` there, or `WITNESS_WAIT_MS`, as `sendInPasses` waits;
 *   - anybody else: its target at once (`targetForUser`).
 * The asker's own room is sent with `force` (its page is new); a victim's without, so one already on its way or
 * settled there is not sent twice. Each room goes to its own account alone (`send`); the asker is Foundry's sender.
 *
 * @param {string} userId
 * @param {{byUser: Map<string, object>, waits?: Map<string, string[]>, held?: Set<string>}} targets  `voiceTargets()`
 * @param {object} io
 * @param {(userId: string, room: string|null, force: boolean) => unknown} io.assign
 * @param {(userId: string, room: string|null) => Promise<unknown>} io.waitFor
 * @returns {Promise<"held"|"kept"|"waited"|"sent">}
 */
export async function answerWhoAmI(userId, { byUser, waits, held }, { assign, waitFor }) {
    if (held?.has(userId)) return "held";
    const row = byUser.get(userId);
    if (row?.keep) {
        await assign(userId, row.standIn ?? null, true);
        return "kept";
    }
    const victims = (waits?.get(userId) ?? []).filter(id => id !== userId && byUser.has(id));
    for (const id of victims) await assign(id, targetForUser(byUser, id), false);
    if (victims.length) await Promise.all(victims.map(id => waitFor(id, targetForUser(byUser, id))));
    await assign(userId, targetForUser(byUser, userId), true);
    return victims.length ? "waited" : "sent";
}

/**
 * Which LiveKit room this user's character puts them in, whoever they are.
 *
 * One line, because the decision is `voiceTargets()` and there is exactly one of
 * it. This used to be a second implementation of the same rules - the Monokuma
 * mapping, the silence of the dead, the scene the token is actually on - with a
 * comment promising it agreed with the reconcile loop. It did not: the two
 * drifted on a rule one of them had and the other lacked, so a GM who refreshed
 * was answered with a room they had not asked for. A promise in a comment is
 * not a shared implementation. Since E19 fix r1-G1 it is handed that decision
 * (`answerWhoAmI`), which says first whether the account is kept or held.
 */
function targetForUser(byUser, userId) {
    return byUser.get(userId)?.target ?? null;
}

/* ==========================================================================
 * WHO BELONGS WHERE
 * --------------------------------------------------------------------------
 * The whole decision, computed once, in one place. Three callers need it and
 * they must not disagree: the loop that pushes assignments, the answer given to
 * a client that asks, and `voicePlan()` which prints it without applying it. A
 * dry run that runs different code from the thing it is describing is worse than
 * no dry run at all.
 *
 * ONE ACCOUNT, ONE ROOM. A LiveKit client is in a single breakout at a time, so
 * an account that owns two characters standing in two rooms is a question with
 * no honest answer. The old loop did not notice it was being asked: it walked
 * the ACTOR list and assigned per actor, so that account was sent to room A and
 * then to room B on every pass - two full disconnect/reconnects a minute,
 * forever, which at the table is an audio dropout every sixty seconds for the
 * one player who happens to own a spare character. Deciding per USER is what
 * makes that one assignment; the ranking below is what makes it the same one
 * every time, rather than "whichever actor sorted last".
 * ========================================================================== */

/** How strong a claim on an account's voice each situation makes. */
const CLAIM = {
    none: 0,      // nobody is holding this character
    dead: 1,      // silenced - the dead channel or the main room (D8), but a live character outranks it
    nowhere: 2,   // alive, no token, or standing outside every region (since E88 C6 not when the room it came from is kept)
    inRoom: 3,    // alive and standing somewhere: the only claim with a room of its own
    trial: 4      // the Class Trial: the main room for everybody (D8); in a trial every connected account makes it
};

/**
 * @returns {Promise<{rows: Array, byUser: Map<string, object>, contested: Map<string, Array>, eclipse: boolean, trial: boolean,
 *   waits: Map<string, string[]>, held: Set<string>}>}
 *   `rows` is every character and what it wants, in actor order - for reporting.
 *   `byUser` is the decision: one entry per connected account.
 *   `contested` is the accounts whose characters disagreed, for the warning.
 *   `eclipse` and `trial` say which of the two rules that place nobody by their
 *   token is in force (`voiceClaim`).
 *   `waits` is the witnesses whose rooms wait for the victims they would hear (`placeVoices`).
 *   `held` is the players' accounts sent nothing while the cast is unknown here (`placeVoices`).
 */
export async function voiceTargets() {
    const { locateActor } = await import("./movement.mjs");
    const { isEclipse } = await import("./eclipse.mjs");
    const eclipse = isEclipse();
    const trial = getClock().phase === "classTrial";

    // A token outside every room keeps the room it came from (E88 C6, `keepRoomsThroughGaps`) - on the primary GM
    // alone, whose passes follow every settled move. Anywhere else the map is emptied (`standDownRoomsKept`, here for a
    // dry run's `voicePlan` and at every change of primary), so a GM who becomes the primary starts with nothing kept.
    standDownRoomsKept();
    const gaps = keepRoomsThroughGaps(isPrimaryGm() ? roomsKept : new Map(), actor => locateActor(actor));
    const { rows, byUser, claims, waits, held } = await placeVoices({
        actors: game.actors.filter(a => a.type === "character"), eclipse, trial,
        death: eclipse || trial ? null : await deathFacts(),
        locate: gaps.locate,
        users: game.users.filter(u => u.active)
    });
    gaps.done();

    // Only a real disagreement counts. Two characters in the same room, or two
    // that both want the main room, are not a conflict - they are one answer
    // arrived at twice.
    const contested = new Map();
    for (const [userId, list] of claims) {
        if (new Set(list.map(r => r.target ?? null)).size > 1) contested.set(userId, list);
    }

    return { rows, byUser, contested, eclipse, trial, waits, held };
}

/**
 * The decision `voiceTargets` makes, from the facts it hands in (E19 C3, 19.10.2026; S11-26, D8, the owner's A9 of
 * 11.10): each character's row (`voiceClaim`), each connected account's voice (`voiceRowFor`), and the dead channel.
 * Asked of plain objects by R815, as `voiceClaim` is by R117.
 *
 * THE DEAD CHANNEL. A student dead in the GMs' records, and not back as a Monocub, keeps the voice of the room they
 * lie in until the first of A9's triggers (`deathVoiceGone`): until then they play the scene out with the killer.
 * After it a death kept secret (`!isDeceased`) talks in the dead channel (`DEAD_ROOM`), where the living hear nothing
 * of it, and a public one in the main room, as before C3 every death did at once - which put a secret victim beside
 * every player in the main room (known-leaks A9-K3, closed here). While the cast is unknown on this browser (null),
 * the row is `keep`: the reconcile sends that account nothing, and the cast's arrival runs the pass again.
 *
 * THE WITNESS IS THE SECOND PASS. "A living student from outside the cast in the same room" can only be read once
 * every account's room is known, and the actors come in no useful order; so after the ranking each dead row still in
 * a room is asked again with `witnessed` when an account's voice row there is a player's living student who is not
 * in the cast - no Monokuma (a GM's) and no Monocub (dead). The victim's account is ranked again, and each witness's
 * account waits for it (`waits`: witness -> the victims whose room it shares), so that its room is sent only after
 * the victim's (`sendInPasses`).
 *
 * @param {object} facts
 * @param {Actor[]} facts.actors         the characters
 * @param {boolean} [facts.eclipse]
 * @param {boolean} [facts.trial]
 * @param {object|null} [facts.death]    `deathFacts()`'s answer; read here when left out, never in an Eclipse or the trial
 * @param {Function} [facts.locate]      actor -> `{ scene, room }` or null (movement.mjs `locateActor`)
 * @param {Function} [facts.userOf]      actor -> the account whose voice it is (`voiceUserOf`)
 * @param {Function} [facts.dead]        the GMs' record (`isDeadForGm`)
 * @param {Function} [facts.monokumaOf]  `isMonokuma`
 * @param {User[]} [facts.users]         the connected accounts, each given a row of its own when no character gives one
 * @returns {Promise<{rows: Array, byUser: Map<string, object>, claims: Map<string, Array>, waits: Map<string, string[]>,
 *   held: Set<string>}>}  `held`: the players' accounts sent nothing while the cast is unknown (a kept account's room)
 */
export async function placeVoices({ actors = [], eclipse = false, trial = false, death, locate = () => null,
    userOf = actor => voiceUserOf(actor, isMonokuma(actor)), dead = isDeadForGm, monokumaOf = isMonokuma, users = [] } = {}) {
    // Nobody's death is asked in an Eclipse or the trial (`voiceClaim`; R117), so nor are the facts of one.
    const asked = !eclipse && !trial;
    const facts = asked ? death ?? await deathFacts() : null;
    const rowOf = (actor, monokuma, user, fallen, gone) => {
        const row = {
            actor, monokuma, user: user ?? null, fallen, gone, keep: fallen && gone === null,
            ...voiceClaim({
                user, monokuma, eclipse, trial,
                silenced: () => gone === true,
                secret: () => !isDeceased(actor),
                locate: () => locate(actor)
            })
        };
        // A kept row's answer to its own browser's question (`answerWhoAmI`, E19 fix r1-G1): the room after A9's
        // trigger - the dead channel for a death kept secret, the main room for a public one - which no living
        // player in a room hears. Never the room it keeps, which the cast may already have closed to it.
        if (row.keep) row.standIn = voiceClaim({ user, silenced: () => true, secret: () => !isDeceased(actor) }).target ?? null;
        return row;
    };

    const rows = [];
    for (const actor of actors) {
        const monokuma = monokumaOf(actor);
        const user = userOf(actor);
        const fallen = asked && !monokuma && silencedByDeath(actor, dead);
        rows.push(rowOf(actor, monokuma, user, fallen, fallen ? await deathVoiceGone(actor, facts) : false));
    }

    const byUser = new Map();
    const claims = new Map();
    for (const row of rows) {
        if (!row.user?.active) continue;
        if (!claims.has(row.user.id)) claims.set(row.user.id, []);
        claims.get(row.user.id).push(row);
    }
    // In the order each account's first row came, as the inline ranking this replaced filled it (E78 C2).
    for (const userId of claims.keys()) byUser.set(userId, voiceRowFor(rows, userId));

    // EVERY CONNECTED ACCOUNT HAS A ROW (E19 C4, 19.10.2026; audit S11-11). Everyone else here is reached through a
    // character, so an account with none - a spectator, a player between chapters, a GM holding no Monokuma pool - was
    // given a row only in an Eclipse (no channel; the GMs' room) and in the trial (E13 C4), and after an Eclipse it was
    // sent nothing again: it stayed in the Eclipse's room, out of voice or among the GMs, until a reload. Outside both
    // its room is the main room. No character, so never a witness and never contested.
    for (const user of users) {
        if (!user?.active || byUser.has(user.id)) continue;
        const row = { actor: null, monokuma: false, user, ...voiceClaim({ user, eclipse, trial }) };
        if (asked) row.why = "no character - the main room";
        byUser.set(user.id, row);
    }

    const waits = new Map();
    const held = new Set();
    if (!asked) return { rows, byUser, claims, waits, held };
    // WHILE THE CAST IS UNKNOWN, NOBODY JOINS A KEPT ROOM (E19 fix r1-G1; the review's sec-1). A kept dead account - a
    // death of this chapter; one of an earlier chapter is placed at once (`olderDeath`, fix r2-G1) - is
    // sent nothing (`keep`), so its browser stays where it was - in the room it died in, beside the killer. Whether
    // a living player arriving there is a witness or the killer is the cast's to say, and this browser does not hold
    // it yet; so every player's account whose room is a kept account's is sent nothing either until the cast arrives
    // (`held`; the pass after `whenHydrated` places it), not the room, where it would hear the victim. A GM's account
    // (a Monokuma) is not held: the GMs know the death.
    const keptRooms = new Set([...byUser.values()].filter(row => row.keep && row.target).map(row => row.target));
    for (const [userId, row] of byUser) {
        if (!row.keep && !row.user?.isGM && row.target && keptRooms.has(row.target)) held.add(userId);
    }
    const cast = facts?.cast ?? new Set();
    const witness = row => Boolean(row?.actor && row.user && !row.user.isGM && !row.monokuma
        && !dead(row.actor) && !cast.has(row.actor.id));
    for (const [index, row] of rows.entries()) {
        if (!row.fallen || row.gone !== false || !row.target || !row.user?.active) continue;
        const near = [...byUser].filter(([userId, other]) => userId !== row.user.id && other.target === row.target && witness(other));
        if (!near.length) continue;
        const gone = await deathVoiceGone(row.actor, { ...facts, witnessed: true });
        if (gone !== true) continue;
        const was = byUser.get(row.user.id)?.target ?? null;
        rows[index] = rowOf(row.actor, row.monokuma, row.user, true, gone);
        claims.set(row.user.id, claims.get(row.user.id).map(r => (r === row ? rows[index] : r)));
        byUser.set(row.user.id, voiceRowFor(rows, row.user.id));
        if (was !== row.target || byUser.get(row.user.id)?.target === row.target) continue;
        for (const [userId] of near) waits.set(userId, [...new Set([...(waits.get(userId) ?? []), row.user.id])]);
    }
    return { rows, byUser, claims, waits, held };
}

/**
 * What `deathVoiceGone` reads, read once for a pass (E19 C3): the running incident (`murderState`, null when none
 * runs), whether this browser holds the GMs' cast (`castStore`), who is in it (`participantIds`) and the reader of a
 * body's discovery (chapter.mjs `deathAnnounced`). Imported here, as `locateActor` is in `voiceTargets`. Since E19
 * fix r2-G1 also the clock's chapter and season (`getClock`, `seasonEpoch`) and the reader of a death's record
 * (`deathRecordFor`: the flag, else the GMs' row), which tell a death older than the running incident without the cast.
 */
export async function deathFacts() {
    const [{ murderState, participantIds }, { castStore }, { deathAnnounced }] = await Promise.all([
        import("./incident-store.mjs"), import("./gm-stores.mjs"), import("./chapter.mjs")]);
    const state = murderState();
    return { state, hydrated: castStore.isHydrated(), cast: participantIds(state), announced: deathAnnounced,
        chapter: getClock().chapter, epoch: seasonEpoch(), recordOf: deathRecordFor };
}

/**
 * Whether a death's `record` is of another chapter or season than the clock's (`chapter`, `epoch`), so no death of
 * the incident running now (E19 fix r2-G1, 19.10.2026; the review's E19-FIX1-1). A record with no chapter or no season
 * is taken as this chapter's and this season's, as chapter.mjs `bodiesToDiscover` takes it; no record, or no clock
 * handed in, is no answer (false). Pure.
 *
 * @param {object|null} record  `deathRecordFor`'s answer
 * @param {{chapter?: number, epoch?: number}} clock
 * @returns {boolean}
 */
export function olderDeath(record, { chapter = null, epoch = null } = {}) {
    if (!record || chapter === null || chapter === undefined) return false;
    if ((record.chapter ?? chapter) !== chapter) return true;
    return epoch !== null && epoch !== undefined && (record.epoch ?? epoch) !== epoch;
}

/**
 * Whether a dead student's voice has left the room they died in, on the primary GM (E19 C3, 19.10.2026; S11-26, the
 * owner's A9 of 11.10): `null` while it cannot be told, else `true` from the first of A9's triggers, else `false`.
 *   - null: an incident runs and this browser does not hold the GMs' cast yet (a load, a change of primary). The
 *     cast is what says who is in the incident, and an empty one would read the victim as outside it. But a death
 *     whose record is of an earlier chapter or season (`olderDeath`) is no death of this incident, cast or not, and
 *     is true at once (E19 fix r2-G1; the review's E19-FIX1-1): until the fix it was null too, kept, so a student dead
 *     since chapter 1 outranked its player's living character (`voiceRowFor`'s `stillThere`), sent that account its
 *     own `standIn` (`answerWhoAmI`) and held back every living player walking into the room its token stands in;
 *   - true: outside the running incident's cast (`participantIds`) - the incident it died in is over, or it died
 *     outside one; its body found this chapter (`deathAnnounced`); a GM's "Silence now" (`silencedDead`, which E67
 *     writes in the cast; read only); or a living student from outside the cast in the same room (`witnessed`,
 *     `placeVoices`' second pass);
 *   - false: in the cast of the incident that runs, and none of the above.
 * Only the primary asks it, of the GMs' records: no player's browser reads or is told any of it, and the dead
 * account is sent nothing but its own room (`send`). The facts are `deathFacts()`'s unless handed in.
 *
 * @param {Actor} actor
 * @param {object} [facts]
 * @returns {Promise<boolean|null>}
 */
export async function deathVoiceGone(actor, facts) {
    const known = facts ?? await deathFacts();
    const { state = null, hydrated = true, cast = new Set(), witnessed = false } = known;
    if (state && !hydrated) return olderDeath(known.recordOf?.(actor) ?? null, known) ? true : null;
    return !cast.has(actor.id) || Boolean(await known.announced?.(actor)) || Boolean(state?.silencedDead?.[actor.id]) || witnessed === true;
}

/**
 * Which of an account's characters speaks for it: of the `rows` whose user is `userId` and connected, the strongest
 * claim; of two equal claims a dead student whose voice is still in the room it died in (`stillThere`); then the
 * lowest actor id; `null` when there is none (E78 C2, 13.10.2026).
 *
 * THE VICTIM'S ROOM BEFORE A SPARE'S (E19 fix r1-G2, 19.10.2026; the review's E19-COR-2). While the incident a
 * student died in runs, their row keeps the crime room (`CLAIM.inRoom`, A9: "a victim in a running incident keeps the
 * crime room", E19-15), and so does a kept row while the cast is not here (`keep`). A living spare of the same account
 * standing in another room is the same claim, and until the fix the lowest actor id chose: the same table sent the
 * player to the Dorm or left the killer to play A9's scene alone, by the ids Foundry generated. Until A9's trigger the
 * victim's row wins; after it (`gone` true) its claim is `dead` and the living spare outranks it, as before.
 *
 * The ranking `voiceTargets` ran inline until E78, moved here unchanged, so that the two questions E78 asks about one
 * account - does the module hold this viewer's microphone (`micHold`), may a GM block this person (`moduleHoldsMic`) -
 * are asked of the same character the reconcile places, not of a second idea of "their character". R537 holds it
 * equal to the inline loop on E13's trial rows and R544 that nothing else in scripts/ ranks.
 */
export function voiceRowFor(rows, userId) {
    let held = null;
    for (const row of rows) {
        if (!row.user?.active || row.user.id !== userId) continue;
        // Strongest claim wins; then a victim still in its room; then the lowest actor id, so the answer is the same on
        // every client and the same on every pass.
        if (!held
            || row.claim > held.claim
            || (row.claim === held.claim && stillThere(row) !== stillThere(held) && stillThere(row))
            || (row.claim === held.claim && stillThere(row) === stillThere(held) && row.actor.id < held.actor.id)) {
            held = row;
        }
    }
    return held;
}

/** A dead student's row whose voice has not left the room it died in yet (`placeVoices`: `gone` false, or null and kept). */
const stillThere = row => Boolean(row?.fallen && row.gone !== true);

/**
 * Whether the module holds THIS browser's own microphone, and why: `null`, or `{ reason, held }` (E78 C2, 13.10.2026;
 * the owner's answers Q1 and Q15 of 11.10).
 *
 * Q1: the microphone button is grey and struck through only when the MODULE silences the player, with the reason;
 * a GM's block by hand and a lost connection look different, because neither is the module (Q15, the design's P6).
 * So `held` is true for the module's own reasons and for nothing else:
 *   - "external": avclient-livekit sends this browser's audio from its own window (`useExternalAV`) - not held;
 *   - "offline": no LiveKit Room in this browser, or one that is not connected - not held;
 *   - "eclipse": HELD - the primary GM took this account out of voice for the Eclipse (`voiceClaim`; E19 C4: no
 *     channel, before C4 a room of its own), connected or not. Never a GM: the GMs share one Eclipse room;
 *   - "gmBlock": a GM blocked this microphone for everybody (Foundry's `canBroadcastAudio`) - a person's choice, not
 *     held; the module's own reason is named first when both stand;
 *   - "eclipseHeard": a Monocub in an Eclipse - out of voice like every player (E19 C4), so the tile must not pretend
 *     somebody hears it, but a Monocub is never held (the design's P6), so this is a line of information.
 *   - "deadAlone": the primary GM put this account in the dead channel (E19 C3; A9): its voice character's death is
 *     not public, and the living neither hear it nor are heard there - a line of information, not held (E19 fix
 *     r1-G1; the review's E19-C3-1). The dead channel is one room for every secret death until E67's channel per
 *     account, so with two victims each hears the other: the module silences nobody there, and the microphone stays
 *     its owner's to open and mute, as a Monocub's in an Eclipse. Until the fix it was held, which froze it as it
 *     was - a muted victim could not speak to the other, an open one could not mute. A GM's block is named over it.
 *     Until A9's first trigger a dead student talks in the room they died in, and nothing is said (Q2); E67 adds
 *     "deadMuted".
 *
 * From this browser's own facts only - the room the primary GM sent it (`desiredRoom`), its own A/V state, its own
 * characters and the flags on them - and never from GmStore: on a player `isDeadForGm` and `pendingDeath` read the
 * player's copy of the GMs' records (`readMine`), and the incident's state is completed from the GMs' cast store.
 * Every fact can be handed in, as `voiceClaim`'s are, so R537 asks it the table of states without a world to write;
 * left out, each is read here. Whether Foundry 14.365 and avclient-livekit 0.6.8 name `canBroadcastAudio`,
 * `useExternalAV` and the Room's `state` as read below is the A9 design's reading of their files on 11.10 (external,
 * not re-read here); each read is guarded, so a renamed `canBroadcastAudio` or `useExternalAV` reads as not blocked
 * and not external, and a renamed Room or `state` as offline.
 */
export function micHold({ user = game.user, room = desiredRoom(), external = externalAV(), connected = roomConnected(),
    canBroadcastAudio = broadcastAllowed(user), actors } = {}) {
    if (!user) return null;
    if (external) return { reason: "external", held: false };
    const eclipse = !user.isGM && room === eclipseRoomFor(user);
    // In an Eclipse a player's browser is out of voice on purpose (E19 C4): no connection is the Eclipse's, not "offline".
    if (!connected && !eclipse) return { reason: "offline", held: false };
    // Inside its Eclipse room the voice character is the account's lowest actor id, as `voiceRowFor` ranks every
    // claim of an Eclipse alike; `silenced` and `locate` are never asked there.
    const voice = eclipse ? accountRow(user, { actors, eclipse: true, silenced: () => false })?.actor : null;
    const monocub = Boolean(voice && isDeceased(voice) && voice.getFlag?.(MODULE_ID, FLAGS.monocub));
    if (eclipse && !monocub) return { reason: "eclipse", held: true };
    if (canBroadcastAudio === false) return { reason: "gmBlock", held: false };
    if (eclipse) return { reason: "eclipseHeard", held: false };
    if (!user.isGM && room === DEAD_ROOM) return { reason: "deadAlone", held: false };
    return null;
}

/**
 * On a GM's client, whether the module holds ANOTHER account's microphone, so that the GM's block for everybody
 * (E78 C5, Foundry's `BROADCAST_AUDIO`) neither lifts nor reveals it: `null`, or `{ reason, held: true }` (E78 C2,
 * 13.10.2026; the owner's answer Q4 of 11.10: the GM's block is never offered on a microphone the module holds, nor for
 * a death kept secret).
 *   - "secretDead": the account's voice character is dead in the GMs' records and not on its sheet (`isDeadForGm`
 *     without `isDeceased`) - a block drawn on it would tell the table what the GMs keep.
 * E67 adds "deadMuted". The Eclipse, a lost connection and avclient-livekit's own window are the other browser's
 * facts and mean nothing here. `null` on a player's client, where `isDeadForGm` reads only that player's copy.
 * The voice character is `voiceTargets`' (`voiceClaim`, `voiceRowFor`), asked without where anybody stands: outside
 * an Eclipse and the trial a living character outranks a dead one wherever either stands (CLAIM), so only whether
 * every character of the account is dead decides, and which one then is the lowest id; in an Eclipse and the trial
 * nobody is located at all. The facts can be handed in, as `micHold`'s.
 */
export function moduleHoldsMic(user, { actors, eclipse = isEclipse(), trial = getClock().phase === "classTrial",
    dead = isDeadForGm } = {}) {
    if (!game.user?.isGM || !user) return null;
    const row = accountRow(user, { actors, eclipse, trial, silenced: actor => silencedByDeath(actor, dead) });
    const actor = row?.actor;
    if (actor && !row.monokuma && dead(actor) && !isDeceased(actor)) return { reason: "secretDead", held: true };
    return null;
}

/**
 * One account's voice row, as `voiceTargets` builds and ranks it, from the characters whose voice is this account's
 * (`voiceUserOf`) - or the `actors` handed in - with nobody located (`micHold`, `moduleHoldsMic` say why that is the
 * same answer for their questions).
 */
function accountRow(user, { actors, eclipse = false, trial = false, silenced }) {
    const mine = actors ?? game.actors.filter(a => a.type === "character" && voiceUserOf(a, isMonokuma(a))?.id === user.id);
    const rows = mine.map(actor => {
        const monokuma = isMonokuma(actor);
        return { actor, monokuma, user, ...voiceClaim({ user, monokuma, eclipse, trial,
            silenced: () => !monokuma && silenced(actor), locate: () => null }) };
    });
    return voiceRowFor(rows, user.id);
}

/** This browser's LiveKit Room, connected - the Room the voice tile (E78 C3) reads speakers from. */
function roomConnected() {
    return game.webrtc?.client?._liveKitClient?.liveKitRoom?.state === "connected";
}

/**
 * Foundry's answer for this user's microphone, from the user's A/V row (`getUser`), as the design read it; a GM's
 * block clears it. No row, or a row without the field (the harness's LiveKit shim has none), reads as not blocked.
 * Not `user.can(...)` beside it: that would be a second reader of the block's permission, a BLOCK road of R534's.
 */
function broadcastAllowed(user) {
    return game.webrtc?.settings?.getUser?.(user?.id)?.canBroadcastAudio ?? true;
}

/**
 * One person's claim on their account's voice: the room, the strength of the
 * claim and why, decided from what the caller hands in (E13 C4, 12.10.2026).
 * `voiceTargets` asks it once per character and, during an Eclipse or the Class
 * Trial, once per connected account that has no character. It reads no document
 * itself, so R117 asks it the trial's question for each kind of person a trial
 * holds - the living in two rooms, the dead, a Monocub, Monokuma, an account with
 * no character - without a world to write. `silenced` and `locate` are asked only
 * by the branch that needs them: nothing here asks where anybody stands, or who
 * is dead, during an Eclipse or the trial. `secret` (E19 C3) is asked of the
 * silenced alone: a death the table has not been told of talks in the dead
 * channel, a public one in the main room (D8).
 */
export function voiceClaim({ user, monokuma = false, eclipse = false, trial = false,
    silenced = () => false, secret = () => false, locate = () => null }) {
    const row = { scene: null, room: null, target: null, claim: CLAIM.none, why: "" };

    // Every reason for NOT placing somebody, said out loud - "nobody is in
    // the Kitchen" looks the same on screen whether the module decided that
    // or simply never looked.
    if (!user) {
        row.why = monokuma
            ? "no GM holds this Monokuma's Despair pool"
            : "no owner is connected";
    } else if (!user.active) {
        row.why = `${user.name} is not connected`;
    } else if (eclipse) {
        // NOBODY TALKS DURING AN ECLIPSE, and nothing here even asks where
        // anybody is standing.
        //
        // The Eclipse is the placement window: the lights go out and every
        // student moves in secret. A voice channel that still followed the
        // rooms would be the one thing in the building that could see in the
        // dark - you would hear who walked in with you, and hear the room go
        // quiet when somebody left. Freezing the assignments instead (which
        // is what this used to do) is not much better: everyone simply keeps
        // the room they were in when the lights went out, so the group that
        // was together stays on an open channel through the whole thing.
        //
        // So no player is in any channel (the owner, 25.09; E19 C4): the room
        // named here for a player is the word its browser leaves voice on
        // (voice-client.mjs `silentRoomFor`); until C4 it joined it, alone. The
        // GMs share one, because the Eclipse is exactly when they need to talk
        // to each other.
        row.target = eclipseRoomFor(user);
        row.claim = CLAIM.inRoom;
        row.why = user.isGM ? "Eclipse - the GMs' own channel" : "Eclipse - in no voice channel";
    } else if (trial) {
        // ONE ROOM FOR THE CLASS TRIAL (D8, the owner's decision; S11-10). The
        // trial is the one scene everybody is meant to hear: the living argue,
        // Monokuma presides, the GMs run it, and the dead are at the table too.
        // So nobody is placed by their token - not in the trial hall, which is a
        // place for nobody (E13 C1), nor in the school room a token was left in
        // when the table moved (the living would otherwise sit in their old
        // breakouts and hear only their roommates) - and everybody gets the main
        // room. The main room is LiveKit's own, so nothing has to be named or
        // made for the trial: a client that connects mid-trial starts there
        // anyway (`userConnected` above). The dead keep their seat but not their
        // voice: "the dead listen but do not speak" is the table's rule, not
        // this file's - D8 puts it in the handbooks and beside Start the Class
        // Trial (E13 C6, C9).
        //
        // After the Eclipse, not before it, though neither road meets the other
        // any more: `startEclipse` refuses in a trial (E13 fix r1-F3) and
        // `setClock` refuses to open a trial in an Eclipse (E10 fix r2-G5). A
        // clock written by hand with both still takes every voice off.
        row.claim = CLAIM.trial;
        row.why = game.i18n.localize("DRPG.Voice.claimTrial");
    } else if (silenced()) {
        // The dead do not talk. A murdered student's player stays at the
        // table and keeps watching, but their voice leaves the room with
        // them - a body that can still be heard from the crime scene it is
        // lying in gives away everything an investigation is meant to
        // uncover. They get it back the moment they opt in as a Monocub,
        // which is the guide's own re-entry point (p. 16).
        //
        // Silenced is the dead channel's trigger since E19 C3 (`placeVoices`).
        // Not the main room for a death kept secret (D8, S11-26): every player
        // there would hear the victim, and the tile would name them (A9-K3).
        row.claim = CLAIM.dead;
        if (secret()) {
            row.target = DEAD_ROOM;
            row.why = "dead, the death not public - the dead channel";
        } else {
            row.why = "dead, and not back as a Monocub - the main room";
        }
    } else {
        // Located without the canvas, per actor. Reading `canvas.scene`
        // instead only ever sees the scene the GM is LOOKING AT, so a GM
        // reviewing a different map made every player read as "in no room at
        // all" and sent the whole table back to the main room. The scene has
        // to come from the actor for the second reason too: two players on
        // two maps must not be handed the same room name for two different
        // "Kitchen"s.
        const where = locate();
        row.scene = where?.scene ?? null;
        row.room = where?.room ?? null;
        row.target = liveKitRoomFor(row.scene?.id ?? null, row.room);
        row.claim = row.room ? CLAIM.inRoom : CLAIM.nowhere;
        row.kept = Boolean(where?.kept);
        row.why = row.room
            ? `${row.scene?.name ?? "?"} · ${row.room}${row.kept ? " (outside every room: the room it came from)" : ""}`
            : "no room - token outside every region, or no token";
    }
    return row;
}

/* ==========================================================================
 * ROOM NAMES
 * ========================================================================== */

/**
 * A DRPG room name -> a stable LiveKit room name for this scene. `null` when
 * the character is not in any mapped room, which clears the assignment and
 * sends them back to the main room rather than inventing a "lobby" nobody
 * asked for.
 */
export function liveKitRoomFor(sceneId, drpgRoom) {
    if (!sceneId || !drpgRoom) return null;
    // ROOM_PREFIX comes from voice-client.mjs because that is where it is read
    // back: `landedCorrectly` decides "am I in the main room?" by asking whether
    // the room name is one of OURS. Two copies of the string would let those two
    // answers drift apart, and the symptom would be every return-to-main-room
    // reporting as a failure.
    return `${ROOM_PREFIX}${sceneId}-${slug(drpgRoom)}-${hash4(drpgRoom)}`;
}

/**
 * Where a person's voice goes while the lights are out.
 *
 * A player's is voice-client.mjs `silentRoomFor`: their browser leaves voice on
 * it (E19 C4; until then it joined it, a room with exactly one person in it). One
 * shared room for the GMs, who have to be able to talk while they run it.
 *
 * Carries no scene and no region, on purpose: this is the one assignment in the
 * module that must not encode where anybody is standing, because during an
 * Eclipse that is the secret.
 */
function eclipseRoomFor(user) {
    return user?.isGM ? `${ROOM_PREFIX}eclipse-gm` : silentRoomFor(user.id);
}

/**
 * Four characters that depend on the room's EXACT name.
 *
 * `slug` throws away everything that is not a letter or a digit, which is right
 * for a room's NAME and wrong for its IDENTITY. Every other file in this module
 * compares region names as strings - `sameRoom`, `occupantsOf`, `allRooms` - so
 * "Kitchen" and "Kitchen " are two different rooms everywhere in the game, and
 * both of them slugged to `kitchen`. Two rooms, one LiveKit channel, everybody
 * in them hearing each other, in the one subsystem whose entire purpose is that
 * they should not. The same held for "Dorm A" and "Dorm-A", and for any two
 * rooms named in a script with no ASCII at all: both became `room`.
 *
 * FNV-1a over the raw name, base 36. Not a security hash - it only has to differ
 * when the names differ and to be computed identically on every client, which
 * rules out anything asynchronous like SubtleCrypto. Nothing stores a room name,
 * so changing the format costs one reconnect on the upgrade and nothing after.
 */
function hash4(text) {
    let h = 0x811c9dc5;
    for (const ch of String(text ?? "")) {
        h ^= ch.codePointAt(0);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36).padStart(4, "0").slice(-4);
}

function slug(name) {
    return String(name ?? "")
        .toLowerCase()
        .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents (ą, ę, ć…)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "room";
}

/* ==========================================================================
 * RECONCILING
 * --------------------------------------------------------------------------
 * The primary GM's client watches every player's room and keeps LiveKit in
 * step. Has to be one client, and has to be a GM: two GMs both reassigning the
 * same player on the same move would be a race - two messages telling one client
 * to switch, in whatever order they happen to arrive - not a feature. The same
 * reasoning movement.mjs already applies to who pays for a room crossing.
 * ========================================================================== */

let reconcileTimer = null;
let heartbeatTimer = null;

/**
 * @param {object} [options]
 * @param {boolean} [options.immediate]  Skip the debounce.
 * @param {boolean} [options.force]      Re-send every assignment even when the
 *   client already confirmed it. For the moments where a client's own idea of
 *   which room it is in has been reset underneath us - a reconnect, the world
 *   loading, voice being switched on.
 */
export function scheduleReconcile({ immediate = false, force = false } = {}) {
    if (reconcileTimer) {
        clearTimeout(reconcileTimer);
        reconcileTimer = null;
    }
    // The pass itself when immediate (E19 C4), so `resetAllVoice` can say how many it sent; a caller that only
    // schedules ignores it, as before.
    if (immediate) return reconcileNow({ force });
    reconcileTimer = setTimeout(() => {
        reconcileTimer = null;
        reconcileNow({ force });
    }, RECONCILE_DEBOUNCE_MS);
    return null;
}

/**
 * The slow re-assert.
 *
 * Cheap: a pass over the actor list that sends nothing at all when everybody has
 * confirmed where they are. It exists for the states nothing else can observe -
 * a LiveKit server restarted underneath the table, a client whose reconnect
 * failed after its last retry - where the alternative is silence until somebody
 * happens to walk through a door.
 */
function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        standDownRoomsKept();
        if (!isPrimaryGm()) return;
        if (!getSetting(SETTINGS.voiceEnabled)) return;
        reconcileNow();
    }, HEARTBEAT_MS);
}

/** @returns {Promise<number|null>} how many assignments the pass sent or applied; null when it did not run */
async function reconcileNow({ force = false } = {}) {
    try {
        if (!isPrimaryGm()) return null;
        if (!getSetting(SETTINGS.voiceEnabled)) return null;
        if (!avclientActive()) return null;

        // Deliberately NOT skipped during an Eclipse any more.
        //
        // It used to return here, on the grounds that everyone repositions at
        // once and reconciling mid-drag means reconnecting mid-drag. That reason
        // no longer holds: during an Eclipse the target does not depend on where
        // anybody is standing (see `voiceTargets`), so a hundred token moves
        // produce a hundred passes that all decide the same thing and send
        // nothing. And the old behaviour left every group that was talking when
        // the lights went out still talking.
        const { byUser, contested, waits, held } = await voiceTargets();
        reportContested(contested, byUser);

        const changed = await sendInPasses(applyOrder(byUser, game.user.id), waits, {
            ownId: game.user.id, held,
            assign: (userId, row) => assignUserToRoom(userId, row.target, { force }),
            waitFor: (userId, room) => waitApplied(userId, room)
        });
        if (changed) debug(`Voice: reassigned ${changed} participant(s).`);
        return changed;
    } catch (err) {
        error("Voice reconcile failed", err);
        return null;
    }
}

/**
 * Send the pass's rooms in their order (E19 C3; A9): every account but the witnesses and this GM's own, then - once
 * each victim a witness would hear has answered from its new room, or `WITNESS_WAIT_MS` - the witnesses, then this
 * GM's own (`applyOrder` keeps it last). An account whose room is kept (`keep`, a death the cast cannot judge yet) is
 * sent nothing, and since E19 fix r1-G1 nor is a player's account placed in a kept account's room (`held`). Its ways
 * in are handed in, so R815 and R832 read the order on a ledger of their own.
 *
 * @param {Array<[string, object]>} order  `applyOrder`'s answer
 * @param {Map<string, string[]>} waits    witness -> the victims it waits for (`placeVoices`)
 * @param {object} io
 * @param {string} io.ownId
 * @param {(userId: string, row: object) => Promise<boolean>|boolean} io.assign  true when something was sent or applied
 * @param {(userId: string, room: string|null) => Promise<unknown>} io.waitFor
 * @param {Set<string>} [io.held]  the accounts sent nothing while the cast is unknown (`placeVoices`)
 * @returns {Promise<number>} how many were sent or applied
 */
export async function sendInPasses(order, waits, { ownId, assign, waitFor, held }) {
    let changed = 0;
    const send = async list => {
        for (const [userId, row] of list) {
            if (row?.keep || held?.has(userId)) continue;
            // Isolated per user, on purpose. The primary GM's own assignment
            // runs a full LiveKit disconnect/reconnect - the one call in this
            // loop most likely to reject, whether from a slow server or a
            // dropped connection. With one try/catch around the whole loop that
            // single rejection aborted everybody still left to process, and
            // nothing ran again until another token move scheduled a fresh pass.
            try {
                const didChange = await assign(userId, row);
                if (!didChange) continue;
                changed += 1;

                // No microphone is moved here (E78 C2, 13.10.2026; S16-10, "the
                // module never moves a microphone"). Until E78 a GM walking their own
                // Monokuma into a room had `toggleAudio(true)` called "to undo a mute
                // you may still be wearing" - the only place the module touched a
                // microphone on its own, and one meant to undo the GM's own mute.
                // The A9 design read avclient-livekit 0.6.8's `toggleAudio` as
                // doing nothing for that call (11.10; external, not re-read here). A
                // microphone moves on its owner's click or key only (E78 C4,
                // `toggleOwnMic`; R544).
            } catch (err) {
                error(`Voice reconcile failed for "${row.actor?.name ?? userId}"; continuing with the rest`, err);
            }
        }
    };
    const own = order.filter(([userId]) => userId === ownId);
    const others = order.filter(([userId]) => userId !== ownId);
    await send(others.filter(([userId]) => !waits?.has(userId)));
    const witnesses = others.filter(([userId]) => waits?.has(userId));
    if (witnesses.length) {
        const victims = [...new Set(witnesses.flatMap(([userId]) => waits.get(userId)))];
        const rooms = new Map(order);
        await Promise.all(victims.map(userId => waitFor(userId, rooms.get(userId)?.target ?? null)));
        await send(witnesses);
    }
    await send(own);
    return changed;
}

/**
 * The order the reconcile applies its rows in: everybody else's first, this GM's own last (E19 C2; audit S11-33
 * (b)). The GM's own apply is a full LiveKit disconnect and reconnect awaited in the loop, and a connect that hangs
 * (a microphone prompt, a slow server) held back every player's assignment behind it; the others are only sent
 * and answered later, so they lose nothing by going first.
 *
 * @param {Map<string, object>} byUser
 * @param {string} ownId
 * @returns {Array<[string, object]>}
 */
export function applyOrder(byUser, ownId) {
    const rows = [...byUser];
    return [...rows.filter(([userId]) => userId !== ownId), ...rows.filter(([userId]) => userId === ownId)];
}

/** The accounts we last complained about, so a standing conflict is said once. */
let lastContested = "";

/**
 * Say out loud that an account is being pulled two ways.
 *
 * Through `warn()`, so it lands in the GM panel's failure log rather than only
 * in a console nobody has open - this is precisely the class of fault that
 * subsystem exists for. Once per change in the set of affected accounts: the
 * heartbeat runs every minute and the situation usually lasts all session, and a
 * log that repeats itself sixty times an hour is a log nobody reads.
 */
function reportContested(contested, byUser) {
    const key = [...contested.keys()].sort().join(",");
    if (key === lastContested) return;
    lastContested = key;

    for (const [userId, list] of contested) warn(contestedWarning(userId, list, byUser.get(userId)));
}

/**
 * The words of `reportContested`'s warning for one account pulled two ways (E19 fix r1-G1): each character and where
 * it would put the account, and where the account goes. A row is named by where it SENDS the account (`placeName`):
 * since E19 C3 a death kept secret goes to the dead channel with no room of its own (`row.room` null), and until the
 * fix it was named "the main room" here (the review's E19-C3-5) - the leak C3 closed, said to the GM as if open.
 *
 * @param {string} userId
 * @param {Array} list    the account's rows
 * @param {object} [chosen]  the row `voiceRowFor` picked
 * @returns {string}
 */
export function contestedWarning(userId, list, chosen) {
    const words = { main: game.i18n.localize("DRPG.Voice.mainRoom"), dead: game.i18n.localize("DRPG.Voice.deadRoom") };
    const name = game.users.get(userId)?.name ?? userId;
    const places = list.map(r => `${r.actor.name} → ${placeName(r, words)}`).join("; ");
    return game.i18n.format("DRPG.Voice.contested", { name, places, room: placeName(chosen, words) });
}

/**
 * Where a voice row sends its account, in the words handed in (E19 fix r1-G1; the review's E19-C3-5): `dead` for the
 * dead channel, the row's room by name, else `main`. The one namer of a place for the GM's displays of the
 * assignment - `voicePlan`'s groups and conflicts, `contestedWarning` - so none of them can call the dead channel the
 * main room again.
 *
 * @param {object|null} row
 * @param {{main: string, dead: string}} words
 * @returns {string}
 */
export function placeName(row, { main, dead }) {
    if (row?.target === DEAD_ROOM) return dead;
    return row?.room ?? main;
}

/**
 * Point one user's voice at a room, whoever they are.
 *
 * The primary GM's own client is not sent a socket message - there is nobody to
 * receive one aimed at yourself with any confidence - so it goes straight to the
 * same apply every other client runs, and settles itself on the result.
 *
 * @returns {Promise<boolean>} true if an assignment was made or sent.
 */
async function assignUserToRoom(userId, room, options = {}) {
    if (userId !== game.user.id) return assignUser(userId, room, options);

    const target = room ?? null;
    if (!options.force && settled.get(userId) === target) return false;

    const state = await applyLocally(target);
    if (state === "applied" || state === "unchanged" || state === "unavailable") {
        settled.set(userId, target);
        return state === "applied";
    }
    // Deferred or failed: do not settle, so the next pass tries again.
    settled.delete(userId);
    return false;
}

/**
 * Whose voice a character is: a student's follows their active owner; a Monokuma's
 * follows whichever GM its Despair pool is pointed at - the same relationship, read
 * from the same setting, not a second one. `voiceTargets` and `accountRow` ask it.
 */
function voiceUserOf(actor, monokuma) {
    return monokuma ? poolUserFor(actor) : activeOwnerOf(actor);
}

/** Active owner only - an offline player has no AV client to move. */
function activeOwnerOf(actor) {
    return game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER")) ?? null;
}

/**
 * Dead, and not yet back as a Monocub.
 *
 * Death is asked of settings.mjs, the leaf (E05 C9), and the Monocub flag read
 * directly rather than through `monocub.mjs` - this runs inside the reconcile loop
 * on every token move, and a dynamic import per actor per pass is a lot of churn
 * for two boolean reads. `dead` is the GMs' record unless a caller hands in another
 * reader: `moduleHoldsMic` takes one, so R537 asks it of a table (E78 C2).
 */
function silencedByDeath(actor, dead = isDeadForGm) {
    if (!dead(actor)) return false;
    return !actor.getFlag(MODULE_ID, FLAGS.monocub);
}

/* ==========================================================================
 * DIAGNOSTICS - what the loop would do, and why it might not
 * ========================================================================== */

function sceneRoomWarnings() {
    const lines = [];
    for (const scene of game.scenes) {
        const peopled = scene.tokens.some(t => t.actor?.type === "character");
        if (!peopled) continue;
        // The trial hall holds no rooms on purpose (rooms.mjs, E13 C1): its students are not
        // split by room there, and the warning below would tell the GM to name its regions.
        if (isTrialScene(scene)) continue;

        // Rooms only (E12 C2a): a named region with a Teleport, or one a GM marked as not a
        // room, splits nobody's voice.
        const names = roomPieces(scene).map(r => r.name);
        if (!names.length) {
            lines.push("");
            lines.push(`"${scene.name}" has characters on it and no rooms - everybody`);
            lines.push("   standing there shares the main room. Name the regions to split them up.");
            continue;
        }
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        if (dupes.length) {
            lines.push("");
            lines.push(`"${scene.name}" has more than one region named ${
                [...new Set(dupes)].map(n => `"${n}"`).join(", ")} - they are ONE voice room.`);
            lines.push("   Intended for a corridor drawn in two pieces; a mistake otherwise.");
        }
    }
    return lines;
}

/**
 * Somebody else moving the audio.
 *
 * This module decides which ROOM each participant is in. It does not touch how
 * loud anybody is, and another module doing that can silence a table while every
 * check here reports success - which is exactly the shape of bug a GM cannot
 * diagnose and a solo tester cannot reproduce.
 *
 * Proximity Voice Chat is named because it is installed here and because its
 * default is the dangerous one: it walks every connected user, starts them at
 * volume 0, and raises them only for tokens carrying its own `userlist` flag
 * near a token you control. Configure nothing and the whole table is at zero.
 * Watch a room you have no token in, and it is
 * zero for you specifically, while LiveKit, Foundry and this module all agree you
 * are correctly connected to the right room.
 *
 * Named FIRST in both diagnoses since E19 C2 (`voicePlan`, diagnostics.mjs
 * `voiceDiagnosis`; the plan's risk: "proximity-voice-chat mutes everyone and is
 * checked first"): until then it came after every room line, and the voice
 * diagnosis did not reach it at all with LiveKit off. The lines start and end
 * with text; a caller puts its own blank line after them.
 */
export function competingModuleWarnings() {
    const lines = [];

    const proximity = game.modules.get("proximity-voice-chat");
    if (proximity?.active) {
        lines.push("Proximity Voice Chat is also active.");
        lines.push("   It sets each participant's volume from token distance, on top of the room");
        lines.push("   this module puts them in. Unconfigured, that volume is zero for everyone.");
        let escape = "";
        try {
            if (game.settings.get("proximity-voice-chat", "globalListen")) {
                escape = "   Its \"global listen\" setting is ON, so it is not muting anybody right now.";
            }
        } catch {
            // Not registered on this client - nothing to report either way.
        }
        if (canvas?.scene?.getFlag?.("proximity-voice-chat", "disabled")) {
            escape = `   It is switched off on "${canvas.scene.name}", so it is not muting anybody there.`;
        }
        lines.push(escape || "   Turn it off, or set \"global listen\", unless you are deliberately using both.");
    }

    // Anything else that sounds like it moves audio around. Named rather than
    // judged: this cannot know what an unfamiliar module does, only that it is
    // worth looking at first when the audio is wrong and the rooms are right. Read through `values()`, which
    // Foundry's Collection and a plain Map both have: the headless harness's `game.modules` is a Map with no
    // `filter`, and the voice diagnosis that now opens with these lines threw there (E19 C2).
    const others = [...game.modules.values()].filter(m => m.active
        && !["proximity-voice-chat", AV_MODULE, MODULE_ID].includes(m.id)
        && /voice|webrtc|\bav\b|audio.?chat/i.test(`${m.id} ${m.title ?? ""}`));
    if (others.length) {
        if (lines.length) lines.push("");
        lines.push(`Other active modules that mention voice: ${others.map(m => m.title ?? m.id).join(", ")}.`);
        lines.push("   Worth ruling out first if the rooms below are right and the audio is not.");
    }

    return lines;
}

/**
 * A self-hosted LiveKit server's API secret, kept in a world setting (E05 C15,
 * 27.09.2026; audit S11-59). Pure: the value of avclient-livekit's
 * `liveKitConnectionSettings` in, the warning's lang key or `null` out.
 *
 * WHAT WAS READ, AND WHAT WAS NOT. avclient-livekit 0.6.8's source (its main branch,
 * read 27.09.2026; its manifest says verified on Foundry 14) registers the setting at
 * world scope - so every browser receives it - as `{ serverType, url, room, username,
 * password }`, with two server types: "custom", which needs the API key and secret
 * (`username`, `password`) and signs its own access tokens with them, and "tavern",
 * which needs neither. A world with no `serverType` is given the default, "custom", by
 * the first GM to connect. So: a secret filled in and any type but "tavern". Not
 * measured against a live install here (no Foundry, no LiveKit): AUDIT §9's
 * LIVE-E05-11. This module cannot move another module's setting; it tells the GM.
 */
export function liveKitSecretWarning(settings) {
    if (!settings || typeof settings !== "object") return null;
    const secret = typeof settings.password === "string" && settings.password.trim() !== "";
    return secret && settings.serverType !== "tavern" ? "DRPG.Voice.liveKitSecret" : null;
}

/** avclient-livekit's connection setting on this browser, or `null` when it is not there to read. */
export function liveKitConnectionSettings() {
    if (!game.modules.get(AV_MODULE)?.active) return null;
    try {
        return game.settings.get(AV_MODULE, "liveKitConnectionSettings") ?? null;
    } catch {
        // Not registered on this client - nothing to warn about.
        return null;
    }
}

/**
 * Where everybody WOULD be sent, without sending anybody anywhere.
 *
 *     game.drpg.voicePlan()
 *
 * Regional voice is the one subsystem in this module that cannot be judged from
 * one machine: hearing whether two people in two rooms are actually separated
 * takes two people. But that is the SECOND question. The first is whether the
 * module has decided correctly who belongs where - and that is pure bookkeeping
 * over tokens, owners, death flags and Despair pools, none of which needs a
 * microphone.
 *
 * So this runs the same decision the reconcile loop runs, on the same inputs,
 * and prints it instead of applying it. It works with A/V switched off, with
 * the regional-voice setting off, and with nobody else connected - which turns
 * most of "test the voice chat" into something one person can do in a minute.
 *
 * What it still cannot tell you: whether the audio actually routes. That needs a
 * second client, and the answer is in `diagnoseVoice()` on that client.
 *
 * `targets` is `voiceTargets()`'s answer unless handed in (E19 fix r1-G1), so R833 reads the plan of a table of rows
 * without a death written into the world. A row is grouped and named by where it sends its account (`placeName`):
 * the dead channel is its own group, never "(main room)".
 */
export async function voicePlan({ toChat = false, targets } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    // What mutes everybody whatever the rooms say, first (E19 C2; `competingModuleWarnings`).
    const lines = competingModuleWarnings();
    if (lines.length) lines.push("");

    lines.push(`Regional voice setting: ${getSetting(SETTINGS.voiceEnabled) ? "on" : "OFF - nothing is being applied"}`);
    lines.push(`A/V mode: ${game.webrtc?.mode === foundry.av.AVSettings.AV_MODES.DISABLED
        ? "DISABLED - nothing can connect" : game.webrtc?.mode}`);
    lines.push(`This client runs the assignment loop: ${isPrimaryGm() ? "yes" : "no"}`);

    // The same decision the loop runs, on the same inputs - literally the same
    // function. A dry run computed separately from the thing it describes is a
    // second implementation that agrees right up until it matters.
    const { rows, byUser, contested, eclipse, held } = targets ?? await voiceTargets();

    if (eclipse) {
        lines.push("");
        lines.push("AN ECLIPSE IS RUNNING. Nobody is being placed by their token - the rooms are");
        lines.push("not even being read. No player is in any voice channel; the GMs share one.");
        lines.push("It goes back to normal the moment it ends.");
    }
    lines.push("");

    const rooms = new Map();
    for (const row of rows) {
        const key = eclipse ? "(Eclipse - no player in voice)" : placeName(row, { main: "(main room)", dead: "(dead channel)" });
        if (!rooms.has(key)) rooms.set(key, []);
        const chosen = byUser.get(row.user?.id);
        // An account pulled two ways is only actually going to one of them, and
        // the plan has to show which - otherwise it reads as though both apply.
        const ignored = chosen && chosen !== row ? "   ← ignored, see CONFLICTS" : "";
        // Sent nothing until the GMs' cast arrives here (`keep`, `held`; E19 C3 and fix r1-G1).
        const waiting = chosen === row && (row.keep || held?.has(row.user?.id)) ? "   ← sent nothing until the cast arrives" : "";
        rooms.get(key).push(`${row.actor.name}${row.monokuma ? " [Monokuma]" : ""} - ${
            row.user?.name ?? "nobody"} · ${row.why}${ignored}${waiting}`);
    }

    for (const [room, who] of [...rooms.entries()].sort()) {
        lines.push(`${room}  (${who.length})`);
        for (const line of who) lines.push(`   ${line}`);
    }

    // ONE ACCOUNT, ONE ROOM. Found by this very function on the test world - one
    // account owning a student and a spare template, one in the Closet and one in
    // the Dinner Hall. The loop now picks one of them deterministically instead
    // of sending both every pass, but the situation is still a mistake at the
    // table rather than a thing to be resolved in code.
    if (contested.size) {
        lines.push("");
        lines.push("CONFLICTS - these accounts own characters in more than one place:");
        for (const [userId, list] of contested) {
            const name = game.users.get(userId)?.name ?? userId;
            lines.push(`   ${name}`);
            for (const row of list) {
                const chosen = byUser.get(userId) === row;
                lines.push(`      ${chosen ? "→" : " "} ${row.actor.name} · ${placeName(row, { main: "the main room", dead: "the dead channel" })}${
                    chosen ? "   (this one is applied)" : ""}`);
            }
        }
        lines.push("   A voice client can only be in one room. Give the spare characters to");
        lines.push("   another account, or leave their tokens off the map.");
    }

    for (const line of sceneRoomWarnings()) lines.push(line);

    lines.push("");
    lines.push("This is the decision, not the audio. Whether two of these rooms can actually");
    lines.push("hear each other needs a second connected client - run game.drpg.diagnoseVoice()");
    lines.push("there and compare the room it reports with the one named above.");

    const text = lines.join("\n");
    console.log(`${MODULE_ID} | Voice plan\n${text}`);
    /* To a words store, not a message's (E05 C10): the plan names who is silenced by
       death, a death nobody has found among them, and a whispered message is received by
       every console (utils.mjs `privately`). Since E06 C11 to the GM who asked alone, as
       every report asked for at a console (`gmReport`). */
    if (toChat) {
        await gmReport(game.i18n.localize("DRPG.Diagnostics.title.voice"),
            `<pre style="white-space:pre-wrap;font-size:.85em">${foundry.utils.escapeHTML(text)}</pre>`);
    }
    return text;
}

/* ==========================================================================
 * RESET
 * ========================================================================== */

/**
 * Re-send every connected account its voice room: the GM panel's "Re-send everybody's voice room" and the console's
 * `game.drpg.resetAllVoice()` (E19 C4, 19.10.2026; audit S11-25). Answers how many assignments it sent or applied,
 * or `null` when this browser cannot (LiveKit AVClient off, or not the primary GM).
 *
 * A RESYNC, NOT A RETURN TO THE MAIN ROOM. Until C4 it sent everybody to the main room, and the next pass - or the
 * heartbeat, up to a minute later - sent each back to their room: at the table a minute of the whole cast in one
 * room, the crime scene included, to repair one browser that had drifted. Now it forgets what every client confirmed
 * (`forgetEveryone`) and runs one forced pass at once, so each account is sent the room it belongs in. With regional
 * voice off that room is the main room for everybody, and that is what it sends - which is also how switching the
 * setting off lets everyone go (settings.mjs, `voiceEnabled`'s `onChange`).
 *
 * Primary GM only. This used to run on `game.user.isGM`, so at a table with two GMs both of them reset - two sets of
 * assignments and two sets of retries aimed at the same clients. The ledger, the pass and the setting can be handed
 * in, so R819 reads the resync without a socket.
 *
 * @param {object} [io]
 * @param {object} [io.ledger]       `createVoiceLedger`'s, the module's own
 * @param {Function} [io.reconcile]  `scheduleReconcile`
 * @param {boolean} [io.enabled]     the `voiceEnabled` setting
 * @returns {Promise<number|null>}
 */
export async function resetAllVoice({ ledger = voiceLedger, reconcile = scheduleReconcile,
    enabled = getSetting(SETTINGS.voiceEnabled) } = {}) {
    // `null`, not `0`: the panel says why nothing was sent rather than "sent to 0 people".
    if (!avclientActive()) return null;
    if (!isPrimaryGm()) return null;

    // Forget FIRST: every account below is unsettled, so the pass sends each one again.
    ledger.forgetEveryone();
    if (enabled) return (await reconcile({ immediate: true, force: true })) ?? 0;

    // Regional voice off: no pass runs, and the room every account belongs in is the main room.
    forgetDesiredRoom();
    let n = 0;
    for (const user of game.users.filter(u => u.active && u.id !== game.user.id)) {
        if (ledger.assignUser(user.id, null, { force: true })) n += 1;
    }
    if (await assignUserToRoom(game.user.id, null, { force: true })) n += 1;
    return n;
}

