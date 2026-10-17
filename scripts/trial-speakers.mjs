/**
 * Danganronpa RPG - who is speaking in the Class Trial, as the primary GM's LiveKit Room hears it (E79 C16, 1.2.79).
 * ---------------------------------------------------------------------------
 * The owner, 17.10.2026: an Objection is no longer aimed by the player. It is thrown at whoever is speaking now, or,
 * when nobody is, at the last player who spoke - and the Truth Bullet is chosen after it (trial.mjs `objectOnPrimary`,
 * `evidenceOnPrimary`). This file is the reading that answers "who": a record of the trial's speakers on every
 * browser, of which the primary GM's alone decides (the bridge's runs are the primary's). A player's own record is
 * the trial bar's preview of whom OBJECTION! would be aimed at (trial.mjs `objectionButtonState`), never a claim:
 * nothing of it travels, and a second GM's is its own and nobody asks it.
 *
 * WHAT COUNTS AS SPEAKING. LiveKit's `activeSpeakersChanged`, loudest first, on this browser's own Room - the event
 * voice-tile.mjs follows, and the only one: nothing here reads Foundry's table-wide speaking signal (R544). A
 * participant counts once they have stayed in the list for `TRIAL.speakerMs` (1000 ms) without a break, so a cough
 * or a "hm" is not the floor; whether a second is right at a real table, and how soon after the first word LiveKit
 * lists somebody, is LIVE-E79-22 - no LiveKit runs headless, and the harness's shim lists a speaker the moment it is
 * told to.
 *
 * WHAT IS KEPT, in memory only - a reading of the moment, not world data and not a GM store:
 *   heard   the users in the Room's list now, loudest first, with the time each run began (`since`);
 *   done    each finished run that counted, newest last (at most `DONE_KEPT`), which is "the last who spoke".
 * Nothing is recorded outside a Class Trial, and the record is emptied whenever the table goes into one or comes
 * out of one (`followPhase`), so "the last who spoke" is always of this trial. A new Room - avclient-livekit moving
 * this GM, a reconnect - ends every run in the old one (a run that had counted goes into `done`), so "now" is never
 * somebody of a Room this browser has left, and "last" survives the move.
 *
 * WHICH ROOM IS FOLLOWED. avclient-livekit's client's Room as it stands (`followClient`), looked at on four
 * occasions: `liveKitClientInitialized`, the phase moving into a Class Trial, the end of a move of the Room by the
 * module (voice-client.mjs `drpgVoiceApplying` false) and every read of the target. Until fix r4-G1 (17.10.2026)
 * only the hook and the read did, and the harness's stand-in fires the hook after it has made the Room
 * (lib/livekit.mjs `initialize`) - the order this record relied on, not measured on avclient-livekit: were the
 * Room made after the hook, the trial's Room would be heard only from the first press on, and that press refused
 * for nobody counted. Which order avclient-livekit keeps is LIVE-E79-22.
 *
 * WHO MAY BE THE TARGET is decided at the read (`objectionTarget`), not at the event, so a death or a Monocub's
 * mark that lands mid-trial is read as it stands then: a student a player owns, alive as the table knows it
 * (`isDeceased`, the published death), no Monocub and no Monokuma, never a GM's account, an account with no
 * student, the objector, or an account that owns the objector (a player of two students is not aimed at their
 * other one; fix r4-G1). The student is the one the voice surfaces name the account by (camera-view.mjs
 * `voiceActorFor`), never a token. THE TABLE'S DEAD, NOT THE GMS' (the orchestrator, round 4, 17.10.2026): until
 * fix r4-G1 a death the GMs keep unpublished (`isDeadForGm`) was skipped on the primary, so a refusal for nobody, or
 * the card naming somebody other than the speaker the button previewed, told the objector of a death the table has
 * not been told - and the card goes to every browser, which CLAUDE.md's death rule gives to `isDeceased`. For the
 * table such a student is alive, and may be objected to.
 *
 * WHAT IS EXTERNAL: avclient-livekit's private Room (`game.webrtc.client._liveKitClient.liveKitRoom`) and its
 * participant-to-user map, read through voice-tile.mjs `participantUser`, as the tile reads them.
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { SETTINGS, isDeceased } from "./settings.mjs";
import { error } from "./utils.mjs";
import { participantUser } from "./voice-tile.mjs";
import { voiceActorFor } from "./camera-view.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isMonocub } from "./monocub.mjs";

/** How long somebody has to stay in LiveKit's list to count as speaking (config.mjs `TRIAL.speakerMs`). */
export const SPEAKER_MS = TRIAL.speakerMs;

/** How many finished runs are kept: the newest eligible one is the target, so a short list is enough. */
const DONE_KEPT = 50;

/** Whether the table is in a Class Trial now - the one phase this record holds anything in. */
function inTrial() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.clock)?.phase === "classTrial";
    } catch {
        return false;
    }
}

/**
 * A record, empty. `clock.now()` is read for every time and `trial()` for whether a Class Trial is in session; the
 * live record's are `Date` and the clock's phase, the suite's a hand it moves and a switch it throws (R590), so a
 * read-only tier can walk a trial in and out without writing the clock. `source()` answers the client whose Room the
 * record follows by itself (`followClient`): the live record's is avclient-livekit's, the suite's a stand-in; a
 * record with none follows only what `attachSpeakers` is handed.
 *
 * @param {{clock?: {now: () => number}, trial?: () => boolean, source?: (() => object|null)|null}} [options]
 */
export function speakerRecord({ clock = Date, trial = inTrial, source = null } = {}) {
    return { clock, trial, source, client: null, room: null, detach: null, phase: null, heard: [], since: new Map(), done: [] };
}

/** This browser's record (`registerTrialSpeakers`). */
const live = speakerRecord({ source: liveKitClient });

/** Empty the record: nobody now, nobody last. */
export function resetSpeakers(record = live) {
    record.heard = [];
    record.since.clear();
    record.done = [];
}

/**
 * The table went into a trial, came out of one, or neither: the record is emptied on the first two, so what it
 * holds is always of the trial in session (and nothing outside one); on the way into a trial it follows its
 * client's Room as it stands then (`followClient`). Answers whether that followed a new Room - whose list
 * `attachSpeakers` has read already.
 */
export function followPhase(record = live) {
    const phase = record.trial() ? "classTrial" : "other";
    if (record.phase === phase) return false;
    record.phase = phase;
    resetSpeakers(record);
    return phase === "classTrial" ? followClient(record) : false;
}

/**
 * Follow the record's own client's Room (`source`) when it is not the one followed: a new client, or a new Room
 * on the same client, that came with no hook. Answers whether it attached.
 */
export function followClient(record = live) {
    if (typeof record.source !== "function") return false;
    const client = record.source() ?? null;
    if (record.client === client && record.room === (client?.liveKitRoom ?? null)) return false;
    attachSpeakers(client, record);
    return true;
}

/** End every run in progress: a run that had counted goes into `done` as ended now. */
function endRuns(record, now) {
    for (const [userId, start] of record.since) {
        if (now - start >= SPEAKER_MS) record.done.push({ userId, end: now });
    }
    if (record.done.length > DONE_KEPT) record.done.splice(0, record.done.length - DONE_KEPT);
    record.since.clear();
    record.heard = [];
}

/**
 * The Room's list as it stands (loudest first): who left it ends their run, who joined it starts one. Outside a
 * trial nothing is recorded.
 *
 * @param {object} record
 * @param {Array} speakers  LiveKit's participants
 */
export function noteSpeakers(record, speakers) {
    // A new Room followed on the way into the trial has had its own list read; this event may be the old Room's.
    if (followPhase(record) || record.phase !== "classTrial") return;
    const now = record.clock.now(), ids = [];
    for (const participant of Array.isArray(speakers) ? speakers : []) {
        const id = participantUser(record.client, participant, record.room)?.id;
        if (id && !ids.includes(id)) ids.push(id);
    }
    for (const [userId, start] of [...record.since]) {
        if (ids.includes(userId)) continue;
        if (now - start >= SPEAKER_MS) record.done.push({ userId, end: now });
        record.since.delete(userId);
    }
    if (record.done.length > DONE_KEPT) record.done.splice(0, record.done.length - DONE_KEPT);
    for (const id of ids) if (!record.since.has(id)) record.since.set(id, now);
    record.heard = ids;
}

/**
 * Follow `client`'s current Room: the old Room's listeners off and its runs ended first (`endRuns` - "now" is
 * cleared, "last" keeps what counted), then the new Room's list read as it stands. No client, no Room or a Room
 * without `on` follows nothing. An event the old Room still emits is checked against the record's Room and changes
 * nothing, as voice-tile.mjs `attachRoom` does.
 *
 * @param {object|null} client  avclient-livekit's `LiveKitClient`
 * @param {object} [record]
 * @returns {boolean} whether a Room is followed
 */
export function attachSpeakers(client, record = live) {
    record.detach?.();
    record.detach = null;
    endRuns(record, record.clock.now());
    record.client = client ?? null;
    record.room = null;
    const room = client?.liveKitRoom ?? null;
    if (!room || typeof room.on !== "function") return false;
    record.room = room;
    const handlers = [
        ["activeSpeakersChanged", speakers => noteSpeakers(record, speakers)],
        ["disconnected", () => endRuns(record, record.clock.now())]
    ].map(([event, fn]) => [event, arg => {
        if (record.room !== room) return;
        try {
            fn(arg);
        } catch (err) {
            error("Could not follow who is speaking in the trial", err);
        }
    }]);
    for (const [event, fn] of handlers) room.on(event, fn);
    record.detach = () => {
        for (const [event, fn] of handlers) (room.off ?? room.removeListener)?.call(room, event, fn);
    };
    noteSpeakers(record, room.activeSpeakers);
    return true;
}

/** avclient-livekit's client, when it is the A/V client (external; voice-tile.mjs reads the same field); the live record's `source`. */
function liveKitClient() {
    return game.webrtc?.client?._liveKitClient ?? null;
}

/**
 * Whether this browser has a LiveKit Room it is connected to - the question that decides whether an objection's
 * target is the record's (a Room) or the packet's (none: no A/V, another A/V client, not connected; trial.mjs
 * `objectOnPrimary`).
 */
export function speakerRoomOpen(client = liveKitClient()) {
    const room = client?.liveKitRoom ?? null;
    return Boolean(room && typeof room.on === "function" && room.state === "connected");
}

/**
 * The student a speaking account stands for, or `null` when it may not be objected to: never a GM's account; the
 * student the voice surfaces name the account by (`voiceActorFor`), owned by that account, no Monokuma, no Monocub,
 * and alive as the table knows it (`isDeceased`; the header says why not the GMs' predicate).
 */
export function speakingStudent(userId) {
    const user = game.users.get(userId);
    if (!user || user.isGM) return null;
    const actor = voiceActorFor(user);
    if (!actor || actor.type !== "character" || isMonokuma(actor) || isMonocub(actor)) return null;
    if (actor.testUserPermission?.(user, "OWNER") !== true) return null;
    return isDeceased(actor) ? null : actor;
}

/**
 * Who an objection made now is aimed at: `{ actorId, userId, how }`, `how` "now" for the loudest counted speaker
 * in the Room's list, "last" for the newest finished run that counted; `null` when nobody may be named. Each
 * speaker is weighed in that order and the first that `actorOf` answers - and that is not `exclude`, the objector,
 * nor spoken by an account other than a GM's that owns the objector - is the target. Outside a Class Trial, null.
 * The primary's run and the trial bar's preview both ask it, so the two skip alike.
 *
 * @param {{exclude?: string|null, record?: object, actorOf?: (userId: string) => (Actor|null)}} [options]
 */
export function objectionTarget({ exclude = null, record = live, actorOf = speakingStudent } = {}) {
    followPhase(record);
    if (record.phase !== "classTrial") return null;
    followClient(record);
    const now = record.clock.now();
    const seen = new Set();
    const objector = exclude ? (game.actors?.get?.(exclude) ?? null) : null;
    const ownsObjector = userId => {
        const user = objector ? game.users.get(userId) : null;
        return Boolean(user && !user.isGM && objector.testUserPermission?.(user, "OWNER") === true);
    };
    const weigh = (userId, how) => {
        if (seen.has(userId)) return null;
        seen.add(userId);
        if (ownsObjector(userId)) return null;
        const actor = actorOf(userId);
        return actor && actor.id !== exclude ? { actorId: actor.id, userId, how } : null;
    };
    for (const userId of record.heard) {
        if (now - (record.since.get(userId) ?? now) < SPEAKER_MS) continue;
        const found = weigh(userId, "now");
        if (found) return found;
    }
    // A speaker still talking but not counted yet is not "the last who spoke" either: their run has not counted.
    seen.clear();
    for (let i = record.done.length - 1; i >= 0; i--) {
        const found = weigh(record.done[i].userId, "last");
        if (found) return found;
    }
    return null;
}

/**
 * The record's triggers, on every browser (module.mjs `ready`): a new Room on every `liveKitClientInitialized`, the
 * Room as it stands when voice-client.mjs has finished moving it (`drpgVoiceApplying` false), and the clock's world
 * setting, whose phase empties the record on the way into a trial and out of it.
 */
export function registerTrialSpeakers() {
    Hooks.on("liveKitClientInitialized", client => attachSpeakers(liveKitClient() ?? client ?? null));
    Hooks.on("drpgVoiceApplying", applying => {
        if (applying) return;
        try {
            followClient();
        } catch (err) {
            error("Could not follow the voice Room after it moved", err);
        }
    });
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.clock}`) followPhase();
    });
    followPhase();
    attachSpeakers(liveKitClient());
}
