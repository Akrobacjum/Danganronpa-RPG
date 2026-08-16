/**
 * Danganronpa RPG — voice per region.
 * ---------------------------------------------------------------------------
 * Rooms are private conversations. Text already enforces that — see
 * visibility.mjs (you cannot see who is not in your room) and
 * private-rolls.mjs (your dice are nobody else's business) — this does the
 * same for voice: every Scene Region becomes its own LiveKit breakout room,
 * and a player's voice client follows the moment their token crosses into a
 * different one.
 *
 * This file is the DECIDING half: which room does each person belong in, and
 * who needs to be told. The applying half — actually moving a voice client —
 * lives in voice-client.mjs and runs on every client, including this one. That
 * split is the fix for the whole subsystem; the reasoning is written out at the
 * top of that file, and the short version is that this side used to emit
 * avclient-livekit's own breakout message and record success immediately,
 * which meant every message that arrived before a client was listening was lost
 * permanently.
 *
 * Built on avclient-livekit's own breakout mechanism — not a fork of it, not a
 * patch to it. `breakoutRoom` plus `game.webrtc.connect()` is exactly what a GM
 * right-clicking "Start A/V breakout" in the Players list already does; what
 * this module no longer borrows is its socket, because that socket is only
 * listened to between `ready` and a page refresh.
 *
 * Entirely optional. Without avclient-livekit installed and active, and without
 * the world setting turned on, every function below is a no-op — nothing else
 * in this module depends on any of it.
 *
 * A Monokuma follows the same rule as a student: wherever the token stands is
 * whose voice they hear. Which GM that is comes from the SAME map the Despair
 * panel already uses (`poolUserFor` in monokuma.mjs) — a Monokuma spends one
 * GM's Despair and speaks with that GM's voice, not two separate assignments
 * to keep in sync. A token dragged off every mapped room sends that GM back
 * to the main room, free to use the eavesdrop dialog below on whatever they
 * like without their own token dragging them back out of it.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS, getSetting } from "./settings.mjs";
// `allRooms` only — the per-actor lookup is `locateActor`, imported lazily in
// `reconcileNow`, because it is the one that does not depend on which scene
// this GM happens to be looking at.
import { allRooms } from "./movement.mjs";
import { isMonokuma, poolUserFor } from "./monokuma.mjs";
import { VOICE, ROOM_PREFIX, applyLocally, forgetDesiredRoom } from "./voice-client.mjs";
import { isPrimaryGm, debug, error, plural } from "./utils.mjs";

const AV_MODULE = "avclient-livekit";
const SOCKET_EVENT = `module.${MODULE_ID}`;

/** Coalesces a burst of token moves (a drag, several players placing at once)
 *  into a single reassignment pass rather than reconnecting mid-drag. */
const RECONCILE_DEBOUNCE_MS = 1500;

/**
 * How long to wait for a client to confirm, and how many times to say it again.
 *
 * A client that is still loading answers "deferred" and applies the room when
 * its A/V comes up, so these retries are not for slow startup — they are for
 * the message that never arrived at all, and for the client whose reconnect
 * failed. Three tries over twenty seconds, then the heartbeat takes over.
 */
const RETRY_MS = [2000, 6000, 12000];

/** A slow re-assert, so nothing can be wrong for longer than this. */
const HEARTBEAT_MS = 60000;

export function registerVoice() {
    Hooks.on("updateToken", (doc, changes) => {
        if (!followsVoice(doc)) return;
        if (changes.x !== undefined || changes.y !== undefined) scheduleReconcile();
    });
    // A token dragged onto the map from the sidebar is a `createToken`, not an
    // `updateToken`, and placing one during an Eclipse is the single most common
    // way a character arrives in a room. Removing one likewise has to release
    // whoever was following it.
    Hooks.on("createToken", doc => { if (followsVoice(doc)) scheduleReconcile(); });
    Hooks.on("deleteToken", doc => { if (followsVoice(doc)) scheduleReconcile(); });
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
        if (!isPrimaryGm()) return;
        forget(user.id);
        if (!connected) return;
        scheduleReconcile({ force: true });
    });
    // Dying takes a voice away and opting in as a Monocub gives it back, and
    // neither of those moves a token — so without this the change would not
    // land until the next time somebody happened to walk somewhere.
    Hooks.on("updateActor", (actor, changes) => {
        const flags = changes?.flags?.[MODULE_ID];
        if (!flags) return;
        if (!(FLAGS.deceased in flags) && !(FLAGS.monocub in flags)) return;
        scheduleReconcile({ immediate: true });
    });
    // An Eclipse is a placement window: everyone repositions at once. Reconciling
    // on every intermediate move would mean each client reconnecting to LiveKit
    // over and over while the table is still shuffling tokens, so this waits
    // for it to end and applies the result in a single pass.
    Hooks.on("drpgEclipseChanged", active => {
        if (!active) scheduleReconcile({ immediate: true });
    });

    Hooks.once("ready", () => {
        game.socket.on(SOCKET_EVENT, onVoiceSocket);
        suppressBreakoutToasts();
        startHeartbeat();
        warnIfMisconfigured();
    });
}

/**
 * Say so, once, when regional voice is on and cannot possibly work.
 *
 * Both halves of this are silent by design — an assignment nobody can apply is
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
 * A room auto-follows every token crossing here, so its notices — all written
 * for the rare manual right-click breakout — fire on every single crossing, for
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
 * matched by PREFIX — an exact-match set would miss every variant of it.
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

    const exact = new Set([
        game.i18n.localize("LIVEKITAVCLIENT.joiningAVBreakout"),
        game.i18n.localize("LIVEKITAVCLIENT.leavingAVBreakout")
    ]);
    // `${onDisconnected}: ${reason}` — see LiveKitAVClient#onDisconnected.
    const prefixes = [game.i18n.localize("LIVEKITAVCLIENT.onDisconnected")];

    const muted = message => {
        // Only while THIS module is the thing causing the churn.
        //
        // The patch is installed once at `ready`, but the reason for it —
        // "a room auto-follows every token crossing" — is only true when
        // regional voice is switched on. Checked at call time rather than at
        // install time so a table using avclient-livekit's own breakout menu
        // with this feature off keeps its notifications, and so toggling the
        // setting mid-session takes effect without a reload.
        try {
            if (!getSetting(SETTINGS.voiceEnabled)) return false;
        } catch {
            return false;
        }
        const text = String(message ?? "");
        return exact.has(text) || prefixes.some(p => p && text.startsWith(p));
    };

    for (const level of ["info", "warn"]) {
        const current = ui.notifications[level];
        if (current?.__drpgVoicePatched) continue;   // idempotent — safely() may retry

        const original = current.bind(ui.notifications);
        const patched = function drpgFilteredNotification(message, options) {
            if (muted(message)) return;
            return original(message, options);
        };
        patched.__drpgVoicePatched = true;
        ui.notifications[level] = patched;
    }
}

function avclientActive() {
    return Boolean(game.modules.get(AV_MODULE)?.active);
}

/**
 * Is this token one whose position anybody's voice follows?
 *
 * Only character tokens are. Without this filter every Remnant this module drops
 * scheduled a full reconcile pass — and an incident drops one on almost every
 * crisis action, success or failure, for both sides. The pass would then find
 * nothing to do, having walked every actor and located every token to get there.
 */
function followsVoice(tokenDoc) {
    return tokenDoc?.actor?.type === "character";
}

/* ==========================================================================
 * WHAT WE HAVE TOLD EACH CLIENT, AND WHAT THEY CONFIRMED
 * --------------------------------------------------------------------------
 * `settled` is the only thing that lets this side skip a user. It is written
 * when a client says it applied a room, never when we merely sent one — which
 * is the difference between "they are in the Kitchen" and "a message about the
 * Kitchen left this browser". The old code recorded the second and believed the
 * first, and every message lost in flight became a player permanently in the
 * main room.
 *
 * Module-level and deliberately not persisted: it describes this GM browser's
 * session, and a fresh session should re-assert everything rather than trust a
 * note left by a previous one.
 * ========================================================================== */

/** userId -> the room that client last confirmed. `null` is the main room. */
const settled = new Map();

/** userId -> { room, requestId, attempt, timer } for assignments in flight. */
const inFlight = new Map();

function forget(userId) {
    settled.delete(userId);
    const pending = inFlight.get(userId);
    if (pending?.timer) clearTimeout(pending.timer);
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
    // Already asking this same client for this same room — do not stack a
    // second conversation on top of the first.
    if (!force && inFlight.get(userId)?.room === target) return false;

    forget(userId);
    return send(userId, target, 0);
}

/** @returns {boolean} true if the message actually left this browser. */
function send(userId, room, attempt) {
    const requestId = foundry.utils.randomID();

    try {
        game.socket.emit(SOCKET_EVENT, {
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

    const timer = setTimeout(() => {
        const pending = inFlight.get(userId);
        if (!pending || pending.requestId !== requestId) return;

        if (attempt + 1 >= RETRY_MS.length) {
            inFlight.delete(userId);
            debug(`Voice: ${game.users.get(userId)?.name ?? userId} never confirmed "${
                room ?? "the main room"}"; leaving it to the heartbeat.`);
            return;
        }
        send(userId, room, attempt + 1);
    }, RETRY_MS[attempt]);

    inFlight.set(userId, { room, requestId, attempt, timer });
    return true;
}

/**
 * A client answering. `deferred` is not an answer — the client is still coming
 * up and will report again once its A/V is ready — so it neither settles nor
 * cancels the retries.
 */
function onVoiceSocket(payload, senderId) {
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
    const state = payload.state;

    // Not an answer: the client is still coming up and will report again once
    // its A/V is ready. Neither settles nor stops the retries.
    if (state === "deferred") return;

    const pending = inFlight.get(userId);

    /*
     * Which conversation is this answering?
     *
     * Confirmations can arrive late — a client that was still loading applies a
     * parked room seconds after we have already moved on and sent it somewhere
     * else. Cancelling the in-flight retries on ANY confirmation meant that late
     * answer silently killed the newer assignment's retries, and settling on the
     * room it named told this browser the player was somewhere they had just
     * been moved out of. The next pass corrects it, but the pass in between is a
     * player sitting in the wrong room with a GM who believes otherwise.
     *
     * So: an answer only closes the conversation it belongs to. A request id
     * that matches, or no id at all (an unsolicited re-report after a deferred
     * apply) naming the room we are actually waiting on.
     */
    const answersCurrent = pending
        && (payload.requestId === pending.requestId
            || (!payload.requestId && room === pending.room));

    if (answersCurrent) {
        clearTimeout(pending.timer);
        inFlight.delete(userId);
    }

    if (state === "applied" || state === "unchanged" || state === "unavailable") {
        // A stale confirmation is still true — that client really is in that
        // room — so it is worth recording, and recording it is what makes the
        // next pass notice the mismatch and re-send.
        settled.set(userId, room);
        debug(`Voice: ${user.name} confirmed "${room ?? "the main room"}" (${state})${
            pending && !answersCurrent ? ", but we are waiting on another room" : ""}.`);
        return;
    }

    // "failed" — their reconnect did not take. Leave `settled` alone so the next
    // pass and the heartbeat both try again.
    debug(`Voice: ${user.name} could not join "${room ?? "the main room"}".`);
}

/**
 * A client asking where it belongs.
 *
 * This is the path that fixes joining and refreshing, and the reason it works is
 * that it is driven by the one client that knows when it is ready. Answered even
 * while an Eclipse is running: somebody arriving mid-placement should still hear
 * the room they are standing in.
 */
async function onWhoAmI(userId) {
    if (!isPrimaryGm()) return;
    if (!getSetting(SETTINGS.voiceEnabled)) return;
    if (!avclientActive()) return;
    if (userId === game.user.id) return;

    const room = await targetForUser(userId);
    forget(userId);
    send(userId, room, 0);
}

/**
 * Which LiveKit room this user's character puts them in, whoever they are.
 *
 * Shares every rule with `reconcileNow` below — the Monokuma mapping, the
 * silence of the dead, the scene the token is actually on — because a client
 * asking must not get a different answer from the one it would be pushed.
 *
 * Including the tie-break. A user who owns two characters has two answers, and
 * `reconcileNow` walks the whole actor list and lets the LAST one win. Returning
 * the first here would have meant a client that asked and a client that was told
 * ending up in different rooms, which is the worst possible way for these two to
 * disagree: it would look like the assignment "randomly" not sticking.
 */
async function targetForUser(userId) {
    const { locateActor } = await import("./movement.mjs");

    let answer = null;
    for (const actor of game.actors.filter(a => a.type === "character")) {
        const monokuma = isMonokuma(actor);
        const owner = monokuma ? poolUserFor(actor) : activeOwnerOf(actor);
        if (owner?.id !== userId) continue;

        if (!monokuma && silencedByDeath(actor)) {
            answer = null;
            continue;
        }

        const where = locateActor(actor);
        answer = liveKitRoomFor(where?.scene?.id ?? null, where?.room ?? null);
    }
    return answer;
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
function liveKitRoomFor(sceneId, drpgRoom) {
    if (!sceneId || !drpgRoom) return null;
    // ROOM_PREFIX comes from voice-client.mjs because that is where it is read
    // back: `landedCorrectly` decides "am I in the main room?" by asking whether
    // the room name is one of OURS. Two copies of the string would let those two
    // answers drift apart, and the symptom would be every return-to-main-room
    // reporting as a failure.
    return `${ROOM_PREFIX}${sceneId}-${slug(drpgRoom)}`;
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
 * same player on the same move would be a race — two messages telling one client
 * to switch, in whatever order they happen to arrive — not a feature. The same
 * reasoning movement.mjs already applies to who pays for a room crossing.
 * ========================================================================== */

let reconcileTimer = null;
let heartbeatTimer = null;

/**
 * True while the primary GM has manually chosen a room from the eavesdrop
 * dialog. Suppresses auto-follow for their OWN voice only, and only while
 * their own Monokuma token is off every mapped room — dragging it INTO a room
 * always wins over a stale manual choice. Cleared by `stopEavesdropping()` and
 * by `resetAllVoice()`.
 */
let manualEavesdrop = false;

/**
 * @param {object} [options]
 * @param {boolean} [options.immediate]  Skip the debounce.
 * @param {boolean} [options.force]      Re-send every assignment even when the
 *   client already confirmed it. For the moments where a client's own idea of
 *   which room it is in has been reset underneath us — a reconnect, the world
 *   loading, voice being switched on.
 */
export function scheduleReconcile({ immediate = false, force = false } = {}) {
    if (reconcileTimer) {
        clearTimeout(reconcileTimer);
        reconcileTimer = null;
    }
    if (immediate) {
        reconcileNow({ force });
        return;
    }
    reconcileTimer = setTimeout(() => {
        reconcileTimer = null;
        reconcileNow({ force });
    }, RECONCILE_DEBOUNCE_MS);
}

/**
 * The slow re-assert.
 *
 * Cheap: a pass over the actor list that sends nothing at all when everybody has
 * confirmed where they are. It exists for the states nothing else can observe —
 * a LiveKit server restarted underneath the table, a client whose reconnect
 * failed after its last retry — where the alternative is silence until somebody
 * happens to walk through a door.
 */
function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (!isPrimaryGm()) return;
        if (!getSetting(SETTINGS.voiceEnabled)) return;
        reconcileNow();
    }, HEARTBEAT_MS);
}

async function reconcileNow({ force = false } = {}) {
    try {
        if (!isPrimaryGm()) return;
        if (!getSetting(SETTINGS.voiceEnabled)) return;
        if (!avclientActive()) return;

        const { isEclipse } = await import("./eclipse.mjs");
        if (isEclipse()) return; // batched reconcile fires when it ends

        // Located without the canvas, per actor.
        //
        // This used to read `canvas.scene.id` once and `roomOfActor()` per
        // actor, and both only ever see the scene the GM is LOOKING AT. A GM
        // reviewing a different map — the trial room, a scratch scene, the
        // world's default on load — made every player read as "in no room at
        // all", which sent the entire table back to the main room and kept them
        // there. The scene also has to come from the actor, or two players on
        // two maps would be given the same LiveKit room name for two different
        // "Kitchen"s.
        const { locateActor } = await import("./movement.mjs");

        let changed = 0;
        for (const actor of game.actors.filter(a => a.type === "character")) {
            // Isolated per actor, on purpose. The primary GM's own assignment
            // runs a full LiveKit disconnect/reconnect — the one call in this
            // loop most likely to reject, whether from a slow server or a
            // dropped connection. With one try/catch around the whole loop that
            // single rejection aborted every actor still left to process, and
            // nothing ran again until another token move scheduled a fresh pass.
            try {
                const monokuma = isMonokuma(actor);
                // A student's voice follows their active owner; a Monokuma's
                // follows whichever GM its Despair pool is pointed at — the
                // same relationship, read from the same setting, not a second
                // one.
                const user = monokuma ? poolUserFor(actor) : activeOwnerOf(actor);
                if (!user?.active) continue;

                // The dead do not talk.
                //
                // A murdered student's player stays at the table and keeps
                // watching, but their voice leaves the room with them — a body
                // that can still be heard from the crime scene it is lying in
                // gives away everything an investigation is meant to uncover.
                // They get it back the moment they opt in as a Monocub, which
                // is the guide's own re-entry point (p. 16), and a Monocub is
                // routed like any other student from there on.
                if (!monokuma && silencedByDeath(actor)) {
                    if (await assignUserToRoom(user.id, null, { force })) changed += 1;
                    continue;
                }

                const where = locateActor(actor);
                const room = where?.room ?? null;
                const isSelf = user.id === game.user.id;

                // Your own Monokuma, off the map, while you are manually
                // listening to a room you picked from the dialog: leave it alone.
                if (monokuma && isSelf && !room && manualEavesdrop) continue;
                // Dragging the token INTO a room always wins over a stale choice.
                if (monokuma && isSelf && room) manualEavesdrop = false;

                const target = liveKitRoomFor(where?.scene?.id ?? null, room);
                const didChange = await assignUserToRoom(user.id, target, { force });
                if (!didChange) continue;
                changed += 1;

                // Walking your own Monokuma INTO a room means "let me talk to
                // these players" — undo the mute an earlier eavesdrop left you in,
                // so arriving does not silently leave you unheard. Only on the
                // actual transition, not on every later pass while you are still
                // standing there — a mute you choose mid-conversation must stick.
                if (monokuma && isSelf && room) {
                    try {
                        await game.webrtc.client.toggleAudio(true);
                    } catch {
                        // Not fatal — the room switch itself already succeeded.
                    }
                }
            } catch (err) {
                error(`Voice reconcile failed for "${actor.name}"; continuing with the rest`, err);
            }
        }
        if (changed) debug(`Voice: reassigned ${changed} participant(s).`);
    } catch (err) {
        error("Voice reconcile failed", err);
    }
}

/**
 * Point one user's voice at a room, whoever they are.
 *
 * The primary GM's own client is not sent a socket message — there is nobody to
 * receive one aimed at yourself with any confidence — so it goes straight to the
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

/** Active owner only — an offline player has no AV client to move. */
function activeOwnerOf(actor) {
    return game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER")) ?? null;
}

/**
 * Dead, and not yet back as a Monocub.
 *
 * Read straight off the two flags rather than through `chapter.mjs`/`monocub.mjs`
 * — this runs inside the reconcile loop on every token move, and a dynamic
 * import per actor per pass is a lot of churn for two boolean reads.
 */
function silencedByDeath(actor) {
    const dead = Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.deceased));
    if (!dead) return false;
    return !actor.getFlag(MODULE_ID, FLAGS.monocub);
}

/* ==========================================================================
 * THE GM'S OWN VOICE — eavesdropping on a room
 * --------------------------------------------------------------------------
 * Same apply as everybody else's (voice-client.mjs), aimed by hand instead of
 * by a token. The one thing that needs care here is WHICH scene's rooms are on
 * offer: a GM listening in is very often looking at a different map from the
 * players, and naming a room on the wrong scene produces a valid LiveKit room
 * that nobody is in.
 * ========================================================================== */

/**
 * The scene whose rooms this GM should be offered.
 *
 * Their own Monokuma's token first — that is where they are in the fiction —
 * then the canvas. Both can be wrong; between them they are right almost always,
 * and the dialog names the scene so a mismatch is visible rather than silent.
 */
async function eavesdropScene() {
    const { locateActor } = await import("./movement.mjs");

    const mine = game.actors.find(a =>
        a.type === "character" && isMonokuma(a) && poolUserFor(a)?.id === game.user.id);
    const where = mine ? locateActor(mine) : null;
    return where?.scene ?? canvas?.scene ?? null;
}

/**
 * Join a room's LiveKit channel as a listener, muted on entry. Pass `null` to
 * leave, return to the main room, and hand control back to your own
 * Monokuma's token position.
 */
export async function eavesdropRoom(drpgRoom, scene = null) {
    if (!game.user.isGM) return false;
    if (!avclientActive()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Voice.notActive"));
        return false;
    }

    const target = drpgRoom
        ? liveKitRoomFor((scene ?? await eavesdropScene())?.id ?? null, drpgRoom)
        : null;

    const result = await applyLocally(target);

    if (result === "unavailable" || result === "deferred") {
        ui.notifications.warn(game.i18n.localize("DRPG.Voice.notActive"));
        return false;
    }
    // Anything that is not one of the two success states is a failure. Written
    // as an allow-list on purpose: the old version listed the failures instead,
    // so any state it had not thought of — including the `undefined` a swallowed
    // rejection produced — announced "you are listening in" for a room this
    // client had not joined.
    if (result !== "applied" && result !== "unchanged") {
        ui.notifications.error(game.i18n.localize("DRPG.Voice.eavesdropFailed"));
        return false;
    }

    manualEavesdrop = Boolean(drpgRoom);
    settled.set(game.user.id, target);

    // Politeness, not a guarantee: mute on entry, only when a reconnect
    // actually happened. A GM who wants to talk can unmute as always.
    if (drpgRoom && result === "applied") {
        try {
            await game.webrtc.client.toggleAudio(false);
        } catch {
            // Not fatal — the room switch itself already succeeded.
        }
    }
    return true;
}

export function stopEavesdropping() {
    return eavesdropRoom(null);
}

/* ==========================================================================
 * RESET
 * ========================================================================== */

/**
 * Send every connected participant back to the main room.
 *
 * Primary GM only. This used to run on `game.user.isGM`, so at a table with two
 * GMs both of them reset — two sets of assignments and two sets of retries aimed
 * at the same clients, in whatever order they arrived. That is precisely the
 * race the note above `reconcileNow` exists to prevent, reintroduced by the one
 * function whose job is to fix drift.
 */
export async function resetAllVoice() {
    // `null`, not `0`. The GM panel reports the number sent back, and an
    // assistant GM clicking this used to be told "0 player(s) sent back to the
    // main voice room" — a sentence that describes a working reset of an empty
    // table rather than a button that did nothing for them.
    if (!avclientActive()) return null;
    if (!isPrimaryGm()) return null;

    // Forget FIRST. This used to run at the end, which cancelled the retry
    // timers for the very assignments it had just sent — "start again" wiped its
    // own restart. Clearing up front means every user below is unsettled and
    // therefore actually re-sent.
    forgetEveryone();
    manualEavesdrop = false;
    forgetDesiredRoom();

    // Everyone who is actually here, rather than everyone this browser happens
    // to have a note about: "send them all back" is also how a GM says "this has
    // drifted, start again", and the drift may well be a client we lost track of.
    let n = 0;
    for (const user of game.users.filter(u => u.active && u.id !== game.user.id)) {
        if (assignUser(user.id, null, { force: true })) n += 1;
    }

    if (await assignUserToRoom(game.user.id, null, { force: true })) n += 1;

    return n;
}

/* ==========================================================================
 * GM DIALOG
 * ========================================================================== */

export async function openEavesdropDialog() {
    if (!game.user.isGM) return;
    if (!avclientActive()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Voice.notActive"));
        return;
    }

    const scene = await eavesdropScene();
    const rooms = allRooms(scene);
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Voice.noRooms"));
        return;
    }

    const options = rooms
        .map(r => `<option value="${foundry.utils.escapeHTML(r)}">${foundry.utils.escapeHTML(r)}</option>`)
        .join("");

    const DialogV2 = foundry.applications.api.DialogV2;
    const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Voice.eavesdropTitle") },
        classes: ["drpg-panel"],
        content: `<form>
            <p>${game.i18n.localize("DRPG.Voice.eavesdropPrompt")}</p>
            <p class="notes">${game.i18n.format("DRPG.Voice.onScene", {
                scene: foundry.utils.escapeHTML(scene?.name ?? "—")
            })}</p>
            <label>${game.i18n.localize("DRPG.Voice.room")}
                <select name="room">${options}</select></label>
        </form>`,
        buttons: [
            {
                action: "join", label: game.i18n.localize("DRPG.Voice.join"), default: true,
                callback: (event, button, dialog) => dialog.element.querySelector("[name=room]").value
            },
            { action: "stop", label: game.i18n.localize("DRPG.Voice.stopEavesdrop") },
            // Used to be its own GM-panel tile. It is the same subject as this
            // window — where everybody's voice currently is — and the moment you
            // want it is the moment you are already looking at this list.
            { action: "resetAll", label: game.i18n.localize("DRPG.Panel.voiceReset") },
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!choice || choice === "cancel") return;

    if (choice === "stop") {
        await stopEavesdropping();
        ui.notifications.info(game.i18n.localize("DRPG.Voice.stopped"));
        return;
    }

    if (choice === "resetAll") {
        const n = await resetAllVoice();
        // `null` means it refused — voice is off, LiveKit is inactive, or another
        // GM's client is the one running it. Reporting "0 sent back" for that is
        // a success message for a button that did nothing.
        ui.notifications[n === null ? "warn" : "info"](n === null
            ? game.i18n.localize("DRPG.Voice.resetRefused")
            : plural("DRPG.Voice.resetDone", { n }));
        return;
    }

    if (await eavesdropRoom(choice, scene)) {
        ui.notifications.info(game.i18n.format("DRPG.Voice.joined", { room: choice }));
    }
}
