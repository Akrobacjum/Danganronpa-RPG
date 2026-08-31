/**
 * Danganronpa RPG - dividing the students between Monokumas.
 * ---------------------------------------------------------------------------
 * Guide: "There are at least two GMs. They divide the players they take under
 * their 'care' strictly between them - e.g. two GMs each take 8 players."
 *
 * That division is not just bookkeeping: a roll that lands with Despair feeds
 * the pool of *that student's* Monokuma, so who owns whom decides where the
 * Despair goes.
 *
 * Stored as { [actorId]: gmUserId }. Unassigned characters fall back to the
 * first Monokuma so nothing is ever silently dropped.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { monokumas } from "./despair.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { log, warn } from "./utils.mjs";

/**
 * Sentinel meaning "this student feeds nobody's Despair".
 *
 * Distinct from simply being absent from the map: absent means "never divided
 * up yet", which still falls back to a Monokuma so no Despair is lost. This
 * value is a deliberate choice - useful for the Mastermind, for a retired or
 * NPC-run character, or for a template actor that should never move a pool.
 */
export const NO_MONOKUMA = "none";

/** Raw map: { [actorId]: gmUserId | NO_MONOKUMA }. */
export function assignments() {
    return game.settings.get(MODULE_ID, SETTINGS.gmAssignments) ?? {};
}

/**
 * Every STUDENT in the world, in a stable order.
 *
 * Monokumas are `character` actors carrying a flag, so a plain type filter swept
 * them in: the gear on the Despair widget counted them towards a Monokuma's
 * roster, and `autoAssign` cheerfully put one Monokuma under another Monokuma's
 * care. They are the people running the killing game, not students in it.
 */
export function students() {
    return game.actors
        .filter(a => a.type === "character" && !isMonokuma(a))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Which Monokuma looks after this character.
 *
 * Returns null when the student is explicitly set to NO_MONOKUMA - their rolls
 * then feed nobody. Otherwise falls back to the first Monokuma so Despair from
 * an undivided roster is never silently lost.
 */
export function monokumaFor(actor) {
    if (!actor) return null;

    const assignedId = assignments()[actor.id];
    if (assignedId === NO_MONOKUMA) return null;

    const gms = monokumas();
    if (!gms.length) return null;

    return gms.find(u => u.id === assignedId) ?? gms[0];
}

/** True when this student deliberately feeds no Despair pool. */
export function feedsNobody(actor) {
    return assignments()[actor?.id] === NO_MONOKUMA;
}

/** Characters looked after by one Monokuma, fallback included. */
export function studentsOf(userId) {
    return students().filter(a => monokumaFor(a)?.id === userId);
}

/** Characters explicitly excluded from every Despair pool. */
export function excludedStudents() {
    return students().filter(feedsNobody);
}

/** Assign one character. GM only. */
export async function assign(actorId, gmUserId) {
    if (!game.user.isGM) return null;

    const map = { ...assignments() };
    if (gmUserId) map[actorId] = gmUserId;
    else delete map[actorId];

    await game.settings.set(MODULE_ID, SETTINGS.gmAssignments, map);
    return map;
}

/** Write a whole map at once - used by the assignment dialog. */
export async function setAssignments(map) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.gmAssignments, { ...map });
    return map;
}

/**
 * Split the students evenly between Monokumas, in name order. With two GMs and
 * eight students that is four each; a remainder goes to the earlier GM.
 *
 * Students explicitly set to NO_MONOKUMA keep that choice - an even split
 * should not quietly drag the Mastermind back into a pool.
 */
export async function autoAssign() {
    if (!game.user.isGM) return null;

    const gms = monokumas();
    if (!gms.length) {
        warn("No full Gamemasters, so there is nobody to assign students to.");
        return null;
    }

    const existing = assignments();
    const map = {};
    let index = 0;

    for (const actor of students()) {
        if (existing[actor.id] === NO_MONOKUMA) {
            map[actor.id] = NO_MONOKUMA;
            continue;
        }
        map[actor.id] = gms[index % gms.length].id;
        index++;
    }

    await setAssignments(map);
    log(`Split ${index} student(s) between ${gms.length} Monokuma(s).`);
    return map;
}

/**
 * Characters with no explicit assignment. They still resolve to a Monokuma via
 * the fallback, but the GM should know they were never divided up. Students
 * deliberately excluded are not "unassigned" - that was a decision.
 */
export function unassigned() {
    const map = assignments();
    const gmIds = new Set(monokumas().map(u => u.id));
    return students().filter(a => map[a.id] !== NO_MONOKUMA && !gmIds.has(map[a.id]));
}

/** Drop assignments for actors or users that no longer exist. */
export async function pruneAssignments() {
    if (!game.user.isGM) return null;

    const map = assignments();
    const gmIds = new Set(monokumas().map(u => u.id));
    const cleaned = {};

    for (const [actorId, userId] of Object.entries(map)) {
        if (!game.actors.get(actorId)) continue;
        if (userId === NO_MONOKUMA || gmIds.has(userId)) cleaned[actorId] = userId;
    }

    if (Object.keys(cleaned).length === Object.keys(map).length) return map;
    await setAssignments(cleaned);
    return cleaned;
}
