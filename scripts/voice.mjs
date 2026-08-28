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
import { isPrimaryGm, primaryGmId, debug, warn, error, plural } from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";

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
        // Their manual choice belonged to the browser session that just ended.
        manualUsers.delete(user.id);
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
    // Both edges, and both immediate. Starting an Eclipse takes every voice off
    // the rooms at once — a placement window that begins with the table still
    // mid-conversation is a placement window everybody can hear — and ending it
    // puts them all back in a single pass.
    Hooks.on("drpgEclipseChanged", () => scheduleReconcile({ immediate: true, force: true }));

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
    // A GM saying "I picked a room by hand" or "I have stopped".
    //
    // Accepted from GMs only, and only by the client running the loop. It is a
    // claim about the SENDER's own voice — like every other message in this
    // file, whose id is taken from Foundry's own second argument rather than
    // from anything inside the payload.
    if (payload?.action === VOICE.manual) {
        if (!isPrimaryGm()) return;
        if (!game.users.get(senderId)?.isGM) return;
        if (payload.manual) manualUsers.add(senderId);
        else manualUsers.delete(senderId);
        debug(`Voice: ${game.users.get(senderId)?.name} ${
            payload.manual ? "is listening in by hand" : "handed their voice back"}.`);
        return;
    }

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

    // A client that is asking has just come up, so whatever room it had chosen
    // by hand went with the page it was chosen on.
    manualUsers.delete(userId);

    const room = await targetForUser(userId);
    forget(userId);
    send(userId, room, 0);
}

/**
 * Which LiveKit room this user's character puts them in, whoever they are.
 *
 * One line, because the decision is `voiceTargets()` and there is exactly one of
 * it. This used to be a second implementation of the same rules — the Monokuma
 * mapping, the silence of the dead, the scene the token is actually on — with a
 * comment promising it agreed with the reconcile loop. It did not: the loop had
 * a rule for a GM listening in by hand and this did not, so a GM who refreshed
 * mid-eavesdrop was answered with a room they had not asked for. A promise in a
 * comment is not a shared implementation.
 */
async function targetForUser(userId) {
    const { byUser } = await voiceTargets();
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
 * then to room B on every pass — two full disconnect/reconnects a minute,
 * forever, which at the table is an audio dropout every sixty seconds for the
 * one player who happens to own a spare character. Deciding per USER is what
 * makes that one assignment; the ranking below is what makes it the same one
 * every time, rather than "whichever actor sorted last".
 * ========================================================================== */

/** How strong a claim on an account's voice each situation makes. */
const CLAIM = {
    none: 0,      // nobody is holding this character
    dead: 1,      // silenced — the main room, but a live character outranks it
    nowhere: 2,   // alive, no token, or standing outside every region
    inRoom: 3     // alive and standing somewhere: the only claim with an answer
};

/**
 * @returns {Promise<{rows: Array, byUser: Map<string, object>, contested: Map<string, Array>}>}
 *   `rows` is every character and what it wants, in actor order — for reporting.
 *   `byUser` is the decision: one entry per connected account.
 *   `contested` is the accounts whose characters disagreed, for the warning.
 */
export async function voiceTargets() {
    const { locateActor } = await import("./movement.mjs");
    const { isEclipse } = await import("./eclipse.mjs");
    const eclipse = isEclipse();

    const rows = [];
    for (const actor of game.actors.filter(a => a.type === "character")) {
        const monokuma = isMonokuma(actor);
        // A student's voice follows their active owner; a Monokuma's follows
        // whichever GM its Despair pool is pointed at — the same relationship,
        // read from the same setting, not a second one.
        const user = monokuma ? poolUserFor(actor) : activeOwnerOf(actor);
        const row = {
            actor, monokuma, user: user ?? null,
            scene: null, room: null, target: null,
            claim: CLAIM.none, why: ""
        };

        // Every reason for NOT placing somebody, said out loud — "nobody is in
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
            // dark — you would hear who walked in with you, and hear the room go
            // quiet when somebody left. Freezing the assignments instead (which
            // is what this used to do) is not much better: everyone simply keeps
            // the room they were in when the lights went out, so the group that
            // was together stays on an open channel through the whole thing.
            //
            // So each player is put in a room of their own, which is what "voice
            // is unavailable" means when the transport has no mute of its own.
            // GMs share one, because the Eclipse is exactly when they need to
            // talk to each other.
            row.target = eclipseRoomFor(user);
            row.claim = CLAIM.inRoom;
            row.why = user.isGM ? "Eclipse — the GMs' own channel" : "Eclipse — alone, hearing nobody";
        } else if (!monokuma && silencedByDeath(actor)) {
            // The dead do not talk. A murdered student's player stays at the
            // table and keeps watching, but their voice leaves the room with
            // them — a body that can still be heard from the crime scene it is
            // lying in gives away everything an investigation is meant to
            // uncover. They get it back the moment they opt in as a Monocub,
            // which is the guide's own re-entry point (p. 16).
            row.claim = CLAIM.dead;
            row.why = "dead, and not back as a Monocub — the main room";
        } else {
            // Located without the canvas, per actor. Reading `canvas.scene`
            // instead only ever sees the scene the GM is LOOKING AT, so a GM
            // reviewing a different map made every player read as "in no room at
            // all" and sent the whole table back to the main room. The scene has
            // to come from the actor for the second reason too: two players on
            // two maps must not be handed the same room name for two different
            // "Kitchen"s.
            const where = locateActor(actor);
            row.scene = where?.scene ?? null;
            row.room = where?.room ?? null;
            row.target = liveKitRoomFor(row.scene?.id ?? null, row.room);
            row.claim = row.room ? CLAIM.inRoom : CLAIM.nowhere;
            row.why = row.room
                ? `${row.scene?.name ?? "?"} · ${row.room}`
                : "no room — token outside every region, or no token";
        }
        rows.push(row);
    }

    const byUser = new Map();
    const claims = new Map();
    for (const row of rows) {
        if (!row.user?.active) continue;

        if (!claims.has(row.user.id)) claims.set(row.user.id, []);
        claims.get(row.user.id).push(row);

        const held = byUser.get(row.user.id);
        // Strongest claim wins; ties go to the lowest actor id, so the answer is
        // the same on every client and the same on every pass.
        if (!held
            || row.claim > held.claim
            || (row.claim === held.claim && row.actor.id < held.actor.id)) {
            byUser.set(row.user.id, row);
        }
    }

    // An Eclipse silences PEOPLE, not characters. Everyone else in this file is
    // reached through the character they own, so an account with no character —
    // a spectator, a player between chapters, a GM holding no Monokuma pool —
    // would otherwise be the one person left on an open channel.
    if (eclipse) {
        for (const user of game.users.filter(u => u.active)) {
            if (byUser.has(user.id)) continue;
            byUser.set(user.id, {
                actor: null, monokuma: false, user, scene: null, room: null,
                target: eclipseRoomFor(user), claim: CLAIM.inRoom,
                why: user.isGM ? "Eclipse — the GMs' own channel" : "Eclipse — alone, hearing nobody"
            });
        }
    }

    // Only a real disagreement counts. Two characters in the same room, or two
    // that both want the main room, are not a conflict — they are one answer
    // arrived at twice.
    const contested = new Map();
    for (const [userId, list] of claims) {
        if (new Set(list.map(r => r.target ?? null)).size > 1) contested.set(userId, list);
    }

    return { rows, byUser, contested, eclipse };
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
 * One room per player, so the room has exactly one person in it — the closest
 * thing to "no voice at all" that a transport with only rooms can express. One
 * shared room for the GMs, who have to be able to talk while they run it.
 *
 * Carries no scene and no region, on purpose: this is the one assignment in the
 * module that must not encode where anybody is standing, because during an
 * Eclipse that is the secret.
 */
function eclipseRoomFor(user) {
    return user?.isGM ? `${ROOM_PREFIX}eclipse-gm` : `${ROOM_PREFIX}eclipse-${user.id}`;
}

/**
 * Four characters that depend on the room's EXACT name.
 *
 * `slug` throws away everything that is not a letter or a digit, which is right
 * for a room's NAME and wrong for its IDENTITY. Every other file in this module
 * compares region names as strings — `sameRoom`, `occupantsOf`, `allRooms` — so
 * "Kitchen" and "Kitchen " are two different rooms everywhere in the game, and
 * both of them slugged to `kitchen`. Two rooms, one LiveKit channel, everybody
 * in them hearing each other, in the one subsystem whose entire purpose is that
 * they should not. The same held for "Dorm A" and "Dorm-A", and for any two
 * rooms named in a script with no ASCII at all: both became `room`.
 *
 * FNV-1a over the raw name, base 36. Not a security hash — it only has to differ
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
 * same player on the same move would be a race — two messages telling one client
 * to switch, in whatever order they happen to arrive — not a feature. The same
 * reasoning movement.mjs already applies to who pays for a room crossing.
 * ========================================================================== */

let reconcileTimer = null;
let heartbeatTimer = null;

/**
 * GMs who have chosen a room by hand from the eavesdrop dialog.
 *
 * Auto-follow is suppressed for them, and only while their Monokuma is off every
 * mapped room — dragging that token INTO a room always wins over a stale manual
 * choice. Cleared by `stopEavesdropping()`, by `resetAllVoice()`, and by that
 * client asking where it belongs (a client that asks has just come up, so
 * whatever it had chosen is gone with the page).
 *
 * A SET, not a boolean, and that is the fix. It used to be one flag meaning "I,
 * this browser, am listening in" — which worked for the primary GM and for
 * nobody else. An assistant GM holding a Monokuma pool is steered by the primary
 * GM's loop like anyone else, and their own flag lives in their own browser
 * where that loop cannot see it: they picked a room, and within sixty seconds
 * the heartbeat put them back in the main room without either GM being told why.
 * The claim now travels (`VOICE.manual`), so the client running the loop is the
 * client that knows.
 */
const manualUsers = new Set();

/**
 * Record a manual choice and, when this browser is not the one running the loop,
 * tell the browser that is.
 */
function setManual(userId, on) {
    if (on) manualUsers.add(userId);
    else manualUsers.delete(userId);

    if (userId !== game.user.id) return;
    const primary = primaryGmId();
    if (!primary || primary === game.user.id) return;
    try {
        game.socket.emit(SOCKET_EVENT,
            { action: VOICE.manual, manual: on }, { recipients: [primary] });
    } catch (err) {
        error("Could not tell the primary GM about a manual voice choice", err);
    }
}

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

        // Deliberately NOT skipped during an Eclipse any more.
        //
        // It used to return here, on the grounds that everyone repositions at
        // once and reconciling mid-drag means reconnecting mid-drag. That reason
        // no longer holds: during an Eclipse the target does not depend on where
        // anybody is standing (see `voiceTargets`), so a hundred token moves
        // produce a hundred passes that all decide the same thing and send
        // nothing. And the old behaviour left every group that was talking when
        // the lights went out still talking.
        const { byUser, contested, eclipse } = await voiceTargets();
        reportContested(contested, byUser);

        let changed = 0;
        for (const [userId, row] of byUser) {
            // Isolated per user, on purpose. The primary GM's own assignment
            // runs a full LiveKit disconnect/reconnect — the one call in this
            // loop most likely to reject, whether from a slow server or a
            // dropped connection. With one try/catch around the whole loop that
            // single rejection aborted everybody still left to process, and
            // nothing ran again until another token move scheduled a fresh pass.
            try {
                // Off every mapped room, while listening in by hand: leave them
                // alone. Dragging the token INTO a room always wins over a stale
                // choice, so arriving somewhere is what ends the eavesdrop.
                if (!row.target && manualUsers.has(userId)) continue;
                if (row.target) manualUsers.delete(userId);

                const didChange = await assignUserToRoom(userId, row.target, { force });
                if (!didChange) continue;
                changed += 1;

                // Walking your own Monokuma INTO a room means "let me talk to
                // these players" — undo the mute an earlier eavesdrop left you in,
                // so arriving does not silently leave you unheard. Only on the
                // actual transition, not on every later pass while you are still
                // standing there — a mute you choose mid-conversation must stick.
                if (row.monokuma && row.room && userId === game.user.id) {
                    try {
                        await game.webrtc.client.toggleAudio(true);
                    } catch {
                        // Not fatal — the room switch itself already succeeded.
                    }
                }
            } catch (err) {
                error(`Voice reconcile failed for "${row.actor?.name ?? userId}"; continuing with the rest`, err);
            }
        }
        if (changed) debug(`Voice: reassigned ${changed} participant(s).`);
    } catch (err) {
        error("Voice reconcile failed", err);
    }
}

/** The accounts we last complained about, so a standing conflict is said once. */
let lastContested = "";

/**
 * Say out loud that an account is being pulled two ways.
 *
 * Through `warn()`, so it lands in the GM panel's failure log rather than only
 * in a console nobody has open — this is precisely the class of fault that
 * subsystem exists for. Once per change in the set of affected accounts: the
 * heartbeat runs every minute and the situation usually lasts all session, and a
 * log that repeats itself sixty times an hour is a log nobody reads.
 */
function reportContested(contested, byUser) {
    const key = [...contested.keys()].sort().join(",");
    if (key === lastContested) return;
    lastContested = key;

    for (const [userId, list] of contested) {
        const name = game.users.get(userId)?.name ?? userId;
        const chosen = byUser.get(userId);
        const places = list.map(r => `${r.actor.name} → ${r.room ?? "the main room"}`).join("; ");
        warn(`Voice: ${name} owns characters in more than one place (${places}). `
            + `A voice client can only be in one room, so ${name} is being sent to `
            + `"${chosen?.room ?? "the main room"}" and the rest are ignored. `
            + `Give the spare characters to another account, or leave their tokens off the map.`);
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
 * Rooms that will not do what the GM thinks they do.
 *
 * A scene with no named regions is the failure that looks most like this
 * subsystem being broken: every character on it is "in no room", so everybody
 * shares the main room and the module reports perfect success while doing it.
 * Two regions sharing a name are one voice room, which is usually deliberate —
 * a corridor drawn in two pieces — and occasionally a duplicated region the GM
 * has forgotten about.
 */
function sceneRoomWarnings() {
    const lines = [];
    for (const scene of game.scenes) {
        const peopled = scene.tokens.some(t => t.actor?.type === "character");
        if (!peopled) continue;

        const names = Array.from(scene.regions ?? []).map(r => r.name).filter(Boolean);
        if (!names.length) {
            lines.push("");
            lines.push(`"${scene.name}" has characters on it and no named regions — everybody`);
            lines.push("   standing there shares the main room. Name the regions to split them up.");
            continue;
        }
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        if (dupes.length) {
            lines.push("");
            lines.push(`"${scene.name}" has more than one region named ${
                [...new Set(dupes)].map(n => `"${n}"`).join(", ")} — they are ONE voice room.`);
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
 * check here reports success — which is exactly the shape of bug a GM cannot
 * diagnose and a solo tester cannot reproduce.
 *
 * Proximity Voice Chat is named because it is installed here and because its
 * default is the dangerous one: it walks every connected user, starts them at
 * volume 0, and raises them only for tokens carrying its own `userlist` flag
 * near a token you control. Configure nothing and the whole table is at zero.
 * Watch a room you have no token in — which is what eavesdropping IS — and it is
 * zero for you specifically, while LiveKit, Foundry and this module all agree you
 * are correctly connected to the right room.
 */
export function competingModuleWarnings() {
    const lines = [];

    const proximity = game.modules.get("proximity-voice-chat");
    if (proximity?.active) {
        lines.push("");
        lines.push("Proximity Voice Chat is also active.");
        lines.push("   It sets each participant's volume from token distance, on top of the room");
        lines.push("   this module puts them in. Unconfigured, that volume is zero for everyone.");
        let escape = "";
        try {
            if (game.settings.get("proximity-voice-chat", "globalListen")) {
                escape = "   Its \"global listen\" setting is ON, so it is not muting anybody right now.";
            }
        } catch {
            // Not registered on this client — nothing to report either way.
        }
        if (canvas?.scene?.getFlag?.("proximity-voice-chat", "disabled")) {
            escape = `   It is switched off on "${canvas.scene.name}", so it is not muting anybody there.`;
        }
        lines.push(escape || "   Turn it off, or set \"global listen\", unless you are deliberately using both.");
    }

    // Anything else that sounds like it moves audio around. Named rather than
    // judged: this cannot know what an unfamiliar module does, only that it is
    // worth looking at first when the audio is wrong and the rooms are right.
    const others = game.modules.filter(m => m.active
        && !["proximity-voice-chat", AV_MODULE, MODULE_ID].includes(m.id)
        && /voice|webrtc|\bav\b|audio.?chat/i.test(`${m.id} ${m.title ?? ""}`));
    if (others.length) {
        lines.push("");
        lines.push(`Other active modules that mention voice: ${others.map(m => m.title ?? m.id).join(", ")}.`);
        lines.push("   Worth ruling out first if the rooms below are right and the audio is not.");
    }

    return lines;
}

/**
 * Where everybody WOULD be sent, without sending anybody anywhere.
 *
 *     game.drpg.voicePlan()
 *
 * Regional voice is the one subsystem in this module that cannot be judged from
 * one machine: hearing whether two people in two rooms are actually separated
 * takes two people. But that is the SECOND question. The first is whether the
 * module has decided correctly who belongs where — and that is pure bookkeeping
 * over tokens, owners, death flags and Despair pools, none of which needs a
 * microphone.
 *
 * So this runs the same decision the reconcile loop runs, on the same inputs,
 * and prints it instead of applying it. It works with A/V switched off, with
 * the regional-voice setting off, and with nobody else connected — which turns
 * most of "test the voice chat" into something one person can do in a minute.
 *
 * What it still cannot tell you: whether the audio actually routes. That needs a
 * second client, and the answer is in `diagnoseVoice()` on that client.
 */
export async function voicePlan({ toChat = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const lines = [];

    lines.push(`Regional voice setting: ${getSetting(SETTINGS.voiceEnabled) ? "on" : "OFF — nothing is being applied"}`);
    lines.push(`A/V mode: ${game.webrtc?.mode === foundry.av.AVSettings.AV_MODES.DISABLED
        ? "DISABLED — nothing can connect" : game.webrtc?.mode}`);
    lines.push(`This client runs the assignment loop: ${isPrimaryGm() ? "yes" : "no"}`);

    // The same decision the loop runs, on the same inputs — literally the same
    // function. A dry run computed separately from the thing it describes is a
    // second implementation that agrees right up until it matters.
    const { rows, byUser, contested, eclipse } = await voiceTargets();

    if (eclipse) {
        lines.push("");
        lines.push("AN ECLIPSE IS RUNNING. Nobody is being placed by their token — the rooms are");
        lines.push("not even being read. Every player is in a channel of their own and hears");
        lines.push("nobody; the GMs share one. It goes back to normal the moment it ends.");
    }
    lines.push("");

    const rooms = new Map();
    for (const row of rows) {
        const key = eclipse ? "(Eclipse — everyone alone)" : (row.room ?? "(main room)");
        if (!rooms.has(key)) rooms.set(key, []);
        const held = byUser.get(row.user?.id);
        // An account pulled two ways is only actually going to one of them, and
        // the plan has to show which — otherwise it reads as though both apply.
        const ignored = held && held !== row ? "   ← ignored, see CONFLICTS" : "";
        rooms.get(key).push(`${row.actor.name}${row.monokuma ? " [Monokuma]" : ""} — ${
            row.user?.name ?? "nobody"} · ${row.why}${ignored}`);
    }

    for (const [room, who] of [...rooms.entries()].sort()) {
        lines.push(`${room}  (${who.length})`);
        for (const line of who) lines.push(`   ${line}`);
    }

    for (const userId of manualUsers) {
        lines.push("");
        lines.push(`${game.users.get(userId)?.name ?? userId} is listening in by hand — the loop `
            + "leaves them where they are until their Monokuma walks into a room.");
    }

    // ONE ACCOUNT, ONE ROOM. Found by this very function on the test world — one
    // account owning a student and a spare template, one in the Closet and one in
    // the Dinner Hall. The loop now picks one of them deterministically instead
    // of sending both every pass, but the situation is still a mistake at the
    // table rather than a thing to be resolved in code.
    if (contested.size) {
        lines.push("");
        lines.push("CONFLICTS — these accounts own characters in more than one place:");
        for (const [userId, list] of contested) {
            const name = game.users.get(userId)?.name ?? userId;
            lines.push(`   ${name}`);
            for (const row of list) {
                const chosen = byUser.get(userId) === row;
                lines.push(`      ${chosen ? "→" : " "} ${row.actor.name} · ${row.room ?? "the main room"}${
                    chosen ? "   (this one is applied)" : ""}`);
            }
        }
        lines.push("   A voice client can only be in one room. Give the spare characters to");
        lines.push("   another account, or leave their tokens off the map.");
    }

    for (const line of sceneRoomWarnings()) lines.push(line);
    for (const line of competingModuleWarnings()) lines.push(line);

    lines.push("");
    lines.push("This is the decision, not the audio. Whether two of these rooms can actually");
    lines.push("hear each other needs a second connected client — run game.drpg.diagnoseVoice()");
    lines.push("there and compare the room it reports with the one named above.");

    const text = lines.join("\n");
    console.log(`${MODULE_ID} | Voice plan\n${text}`);
    if (toChat) {
        ChatMessage.create({
            content: `<h3>Voice plan</h3><pre style="white-space:pre-wrap;font-size:.85em">${
                foundry.utils.escapeHTML(text)}</pre>`,
            whisper: [game.user.id]
        });
    }
    return text;
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

    // Refused during an Eclipse rather than silently joining an empty channel.
    // Every player is alone while the lights are out, so the room this would
    // connect to has nobody in it — and a GM who heard nothing would reasonably
    // conclude the eavesdrop was broken rather than that it had worked.
    if (drpgRoom) {
        const { isEclipse } = await import("./eclipse.mjs");
        if (isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Voice.eclipseSilent"));
            return false;
        }
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

    setManual(game.user.id, Boolean(drpgRoom));
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
    // Every manual claim, not just this browser's: "send everybody back" means
    // the assistant GM who wandered off into a room by hand as well.
    for (const userId of [...manualUsers]) setManual(userId, false);
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
    // ONE OF THESE, NOT FOUR — see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-eavesdrop")) return null;

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
        classes: ["drpg-panel", "drpg-window-eavesdrop"],
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
