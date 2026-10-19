/**
 * Danganronpa RPG - Frisk, a Palm's third direction: seeing what somebody carries (E80 part 2, the A11 design).
 * ---------------------------------------------------------------------------
 * What the primary GM holds of an open Frisk. The asks live in this GM's memory, never in a store, a flag or a
 * setting: a reload or a new primary ends them with no dice thrown (the design's risk 3; E18 may move them). C0
 * builds only what a drawn roll asks of them - whether a searcher may force one now - and the map stays empty
 * until the ask's road (C3) writes it. C1 adds what the primary reads of the people in the room: whether one person
 * may act on another now (`personActionRefusal`) and who else stands there to see it (`roomWitnessesOnGm`).
 */

import { SETTINGS, getSetting, isEclipse, isDeadForGm, incidentParticipants } from "./settings.mjs";
import { MODULE_ID, FLAGS } from "./config.mjs";
import { gmPlaceOf, lawfulRoomOf } from "./movement.mjs";
import { witnessesOf } from "./chapter.mjs";
import { studentActors } from "./monokuma.mjs";
import { flagsHeldNow } from "./sheet-audit.mjs";
import { inClassTrial } from "./trial.mjs";

/**
 * The asks this primary GM holds, by ask id: `{ searcherId, targetId, state, forceUntil }`. `state` is "refused" or
 * "noAnswer" once the target refused or the answer's clock ran out, and from then until `forceUntil` (epoch ms) the
 * searcher may force it; any other state is no force.
 */
export const friskAsks = new Map();

/** The states of an ask that open a force (the owner's 1 = a: after a refusal or no answer, never before). */
const FORCEABLE = Object.freeze(["refused", "noAnswer"]);

/**
 * Whether `searcherId` may draw a Frisk's force now: the GMs' `friskForce` is on and an ask of theirs stands refused or
 * unanswered inside its window. Asked by roll-draw.mjs `drawRefusal` before a `frisk` roll takes its ticket.
 */
export function friskForceOpen(searcherId, now = Date.now()) {
    if (!searcherId || getSetting(SETTINGS.friskForce) !== true) return false;
    for (const row of friskAsks.values()) {
        if (row?.searcherId === searcherId && FORCEABLE.includes(row.state) && Number(row.forceUntil) > now) return true;
    }
    return false;
}

/** A floor as `gmPlaceOf` hands it - an id or a Level document - as one comparable id. */
const floorKey = level => level?.id ?? level ?? null;

/**
 * Why `asker` may not act on `target` now, as an English reason of the bridge's closed list (bridge-guards.mjs
 * `REASON_PATTERNS`), or null. The primary GM's one gate of an action one living student takes on another in their
 * room (the A11 design's step 3), asked before the price; E80 asks it for a Frisk only (E14 wires it into the person
 * gate of `transferItem`). In the design's order: both characters exist and differ; neither is a Monokuma nor a
 * Monocub, read off the GMs' mark (sheet-audit.mjs `flagsHeldNow`); the asker is alive for the GMs (`isDeadForGm`);
 * both stand where the GMs read them (movement.mjs `gmPlaceOf`: scene, floor and room, so a room of the same name on
 * another scene is not this one), the target on a token the GMs have not hidden; no Eclipse; no Class Trial; the
 * asker is no side of the running incident (`incidentParticipants`, the GMs' cast).
 *
 * What it does not ask, on purpose: whether the target is dead, and whether the target is a side of an incident.
 * Either refusal would answer a question a player may not ask (a death nobody has found, a secret incident), so a
 * target the GMs alone know dead, or caught in an incident, passes here exactly as a living bystander does and its
 * caller treats it so (the design's step 8). Chained and Silenced block nothing: Chained pins a move, Silenced a Call.
 * Every reason maps to an existing code - cannotNow, notThere or missing - and none names who or why (R164).
 */
export function personActionRefusal(asker, target) {
    if (!asker || !target || asker.type !== "character" || target.type !== "character") return "no such character";
    if (asker.id === target.id) return "a character cannot do that to itself";
    const [mine, theirs] = [flagsHeldNow(asker), flagsHeldNow(target)];
    if (mine.getFlag(MODULE_ID, FLAGS.monokuma)) return "a Monokuma takes no part in that";
    if (mine.getFlag(MODULE_ID, FLAGS.monocub) || theirs.getFlag(MODULE_ID, FLAGS.monocub)) return "a Monocub takes no part in that";
    if (isDeadForGm(asker)) return "that cannot be done now";
    const here = gmPlaceOf(asker);
    if (!here?.room) return "the character has no token on a scene";
    // A Monokuma on the map is the GM standing there, and a hidden token is nobody the room can see: neither is
    // somebody in the room, as movement.mjs `othersInRoom` offers the asker's window its targets.
    const there = theirs.getFlag(MODULE_ID, FLAGS.monokuma) ? null : gmPlaceOf(target);
    if (!there?.room || there.tokenDoc?.hidden || there.scene?.id !== here.scene?.id || floorKey(there.level) !== floorKey(here.level)
        || there.room !== here.room) return "the character is not in that room";
    if (isEclipse()) return "an Eclipse is running";
    if (inClassTrial()) return "that waits until the Class Trial is over";
    if (incidentParticipants().includes(asker.id)) return "the character is a side of the running incident";
    return null;
}

/**
 * The students who see what happens in `room` on `scene`, as the GMs read them: chapter.mjs `witnessesOf`, the rule a
 * walk-in on a body counts its witnesses by - a student's character (no Monokuma), on a token the GMs have not hidden,
 * alive for the GMs or a Monocub, standing where the witness judge reads it (movement.mjs `lawfulRoomOf`), one a
 * student however many tokens - less the ids of `except` (the two the event is about). A Monocub sees, as it sees a
 * body found. World actors, in the scene's token order. On the primary GM: the marks are its (`flagsHeldNow`).
 */
export function roomWitnessesOnGm(room, scene, { except = [] } = {}) {
    if (!room || !scene) return [];
    const left = new Set(except);
    const students = new Set(studentActors().map(actor => actor.id));
    return witnessesOf({ tokens: scene.tokens ?? [], room, students, held: flagsHeldNow, roomOf: lawfulRoomOf })
        .map(token => game.actors.get(token.actor?.id) ?? null).filter(actor => actor && !left.has(actor.id));
}
