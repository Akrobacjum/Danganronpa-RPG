/**
 * Danganronpa RPG - Facilities: a room's actions, beside the two rests.
 * ---------------------------------------------------------------------------
 * E93 (12.11.2026; the owner's audit entry E93, its amendments of 05.11 and 08.11; docs/dev/e93/SPEC.md). The Rest tile
 * became the Facilities tile: its window offers the Short and the Long rest as before (rest.mjs) and the actions of the
 * room the character stands in, from two sources:
 *
 *   - A GM'S ACTION, set per room in Room Setup's Facilities tab and held on every piece of the room as the region
 *     flag `FACILITIES.flag` (rest.mjs holds the rest flags the same way). It is rolled - its trait and difficulty
 *     are the GM's - and costs an action. One person per time of day: once anyone used it, a failed roll too, it is
 *     closed for everyone until the next time of day (05.11, "limits").
 *   - A COMPLETED PROJECT'S ACTION, set by a GM on the project (projectMeta `facility`), standing in the project's room
 *     for the project's lifetime after it was completed (`completedAt`, written by projects.mjs's completion row
 *     `facility`). Not rolled. Once per person per time of day, blocking nobody else; it costs an action unless the
 *     GM's switch says it costs none (08.11).
 *
 * This file is what every browser reads: the cleaning of what a GM typed (`cleanAction`, `cleanFacility`), the room's
 * actions (`roomActions`), a project's action and whether its lifetime runs (`projectAction`, `facilityLive`), the
 * marks that say which time of day a use belongs to (`facilityMark`, `facilityOrdinal`), what is closed now
 * (`closedNow`), and what an action costs and whether the Despair Overflow shuts it (`facilityCost`, `facilityShut`).
 * The use itself is judged and carried out on the primary GM (facilities-gm.mjs, the bridge's `facility.use`); a
 * player's browser only asks. Nothing here writes but `setRoomActions` and `setProjectFacility`, a GM's.
 *
 * WHAT A CONSOLE CAN READ. The GM's actions are region flags, which every browser holds, so a console reads every
 * room's list wherever its character stands; the window lists them only to a character in the room (the owner's
 * Q-E93-2, default taken: "like the room's description", which is a region flag too). A project's action is projectMeta,
 * which every browser holds as well, and a secret project's is listed only to those who can see the project. Who used
 * an action is the GMs' (`facilityUseStore`); the public `facilityClosed` names which GM actions are closed, never by whom.
 */

import { MODULE_ID, FACILITIES, TRAITS, TIMES_OF_DAY } from "./config.mjs";
import { SETTINGS, getClock } from "./settings.mjs";
import { plural } from "./utils.mjs";
import { roomFlag, writablePieces } from "./rooms.mjs";
import { metaFor, secretsOf } from "./projects-secrecy.mjs";
import { cardMeta } from "./secret.mjs";

/* ==========================================================================
 * WHAT A GM TYPED, CLEANED
 * ========================================================================== */

const clip = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const whole = (value, min, max) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

/**
 * One effect as the closed list allows it, or null: a kind of `FACILITIES.effects`, its `n` from 1 to the kind's
 * `amount` (a kind with an amount and none given is 1), its `text` cut to `maxText` for the kind that carries one, and
 * its scope one of `FACILITIES.scopes` (`self` when none is named; a kind that acts once, on the room or the table,
 * keeps `self`). Pure.
 */
export function cleanEffect(raw) {
    const kind = typeof raw?.kind === "string" && Object.hasOwn(FACILITIES.effects, raw.kind) ? raw.kind : null;
    if (!kind) return null;
    const rule = FACILITIES.effects[kind];
    const scope = !rule.once && FACILITIES.scopes.includes(raw.scope) ? raw.scope : "self";
    if (rule.text) {
        const text = clip(raw.text, FACILITIES.maxText);
        return text ? { kind, text, scope } : null;
    }
    const out = { kind, n: whole(raw.n ?? 1, 1, rule.amount) ?? 1, scope };
    // A named effect (an Experience): its name from the line's text box, none and it is no effect.
    if (rule.label) {
        const label = clip(raw.label ?? raw.text, FACILITIES.maxLabel);
        if (!label) return null;
        out.label = label;
    }
    // A timed effect's fields (timed-effects.mjs): the statistic it names, and its end among those its kind allows.
    if (rule.trait) out.trait = typeof raw.trait === "string" && Object.hasOwn(TRAITS, raw.trait) ? raw.trait : Object.keys(TRAITS)[0];
    if (rule.untils) out.until = rule.untils.includes(raw.until) ? raw.until : rule.untils[0];
    return out;
}

/** An action's effects, cleaned (`cleanEffect`), at most `maxEffects`. Pure. */
export function cleanEffects(list) {
    return (Array.isArray(list) ? list : []).map(cleanEffect).filter(Boolean).slice(0, FACILITIES.maxEffects);
}

/**
 * A GM's room action as it is stored, or null: `{ id, label, trait, dc, effects }` - an id of letters and digits (a new
 * one where none is given), a label of at most `maxLabel` characters (none, no action), a trait of `TRAITS`, a
 * difficulty in `FACILITIES.dc` (`defaultDc` where it is no number) and its effects (`cleanEffects`). Pure but for the id
 * it makes.
 */
export function cleanAction(raw) {
    const label = clip(raw?.label, FACILITIES.maxLabel);
    if (!label) return null;
    const id = typeof raw?.id === "string" && /^[A-Za-z0-9]{1,24}$/.test(raw.id) ? raw.id : foundry.utils.randomID(12);
    const trait = typeof raw?.trait === "string" && Object.hasOwn(TRAITS, raw.trait) ? raw.trait : Object.keys(TRAITS)[0];
    const dc = whole(raw?.dc, FACILITIES.dc.min, FACILITIES.dc.max) ?? FACILITIES.defaultDc;
    return { id, label, trait, dc, effects: cleanEffects(raw?.effects) };
}

/** A room's list, cleaned: each action once by id, at most `maxActions`. Pure but for the ids it makes. */
export function cleanActions(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map(cleanAction).filter(action => {
        if (!action || seen.has(action.id)) return false;
        seen.add(action.id);
        return true;
    }).slice(0, FACILITIES.maxActions);
}

/**
 * A project's action as it is stored, or null: `{ label, effects, costsAction, lifetime }` - the label as a GM's
 * action's, `costsAction` true unless it is `false` (the owner's 08.11 default "yes"), and `lifetime` `{ kind, n }`, a
 * kind of `FACILITIES.lifetimes` (`forever` where none is named) and for the other two an `n` from 1 to `maxLifetime`.
 * Pure.
 */
export function cleanFacility(raw) {
    const label = clip(raw?.label, FACILITIES.maxLabel);
    if (!label) return null;
    const kind = FACILITIES.lifetimes.includes(raw?.lifetime?.kind) ? raw.lifetime.kind : "forever";
    const lifetime = kind === "forever" ? { kind } : { kind, n: whole(raw?.lifetime?.n ?? 1, 1, FACILITIES.maxLifetime) ?? 1 };
    return { label, effects: cleanEffects(raw?.effects), costsAction: raw?.costsAction !== false, lifetime };
}

/* ==========================================================================
 * WHEN
 * ========================================================================== */

/**
 * The time of day a use belongs to, as one string: the season, the chapter, the session, the day and the time of day,
 * as stash-reach.mjs `rifleMark` reads them - the phase is not in it. A use of another mark counts nothing. Pure.
 */
export function facilityMark(clock = getClock()) {
    return [clock?.seasonStartedAt ?? 0, clock?.chapter ?? 1, clock?.session ?? 0, clock?.day ?? 1, clock?.timeOfDay ?? ""].join(".");
}

/**
 * Where a time of day stands in its chapter, `{ season, chapter, at }`: `at` counts times of day from the chapter's
 * first morning (day 1's morning is 0, its noon 1, day 2's morning `TIMES_OF_DAY.length`). A project's lifetime is
 * measured on it (`facilityLive`). Pure.
 */
export function facilityOrdinal(clock = getClock()) {
    const tod = Math.max(0, TIMES_OF_DAY.indexOf(clock?.timeOfDay));
    const day = Math.max(1, Number(clock?.day) || 1);
    return { season: clock?.seasonStartedAt ?? 0, chapter: clock?.chapter ?? 1, at: (day - 1) * TIMES_OF_DAY.length + tod };
}

/**
 * Whether a completed project's action still stands at `clock`: its `completedAt` (`facilityOrdinal` of the time of day
 * it was completed in) and its lifetime. `forever` stands while the project is there; `timesOfDay` n stands for the
 * time of day it was completed in and the n - 1 after it; `days` n for n days of times of day from then. Neither outlives
 * its chapter or its season. A project with no `completedAt` (completed before E93, or by a write no completion row saw)
 * stands as completed now - the next completion row writes the stamp. Pure.
 */
export function facilityLive(facility, completedAt, clock = getClock()) {
    if (!facility) return false;
    const kind = facility.lifetime?.kind ?? "forever";
    if (kind === "forever" || !completedAt) return true;
    const now = facilityOrdinal(clock);
    if (now.season !== completedAt.season || now.chapter !== completedAt.chapter) return false;
    const span = lifetimeSpan(facility);
    return now.at >= completedAt.at && now.at < completedAt.at + span;
}

/** How many times of day a lifetime spans: n, or n days of them; null for one that stands for good. Pure. */
function lifetimeSpan(facility) {
    const kind = facility?.lifetime?.kind ?? "forever";
    if (kind === "forever") return null;
    return (Number(facility.lifetime?.n) || 1) * (kind === "days" ? TIMES_OF_DAY.length : 1);
}

/**
 * How many times of day a completed project's action has left, counting this one, or null for one that stands for good
 * (the window's "time left", 05.11 option A); with no `completedAt` yet, its whole span. Pure.
 */
export function facilityTimesLeft(facility, completedAt, clock = getClock()) {
    const span = lifetimeSpan(facility);
    if (span === null) return null;
    if (!completedAt) return span;
    if (!facilityLive(facility, completedAt, clock)) return 0;
    return completedAt.at + span - facilityOrdinal(clock).at;
}

/* ==========================================================================
 * WHERE
 * ========================================================================== */

/** The GM's actions of a room on a scene, cleaned as they are read (a flag edited by hand is held to the list too). */
export function roomActions(scene, room) {
    if (!scene || !room) return [];
    const stored = roomFlag(scene, room, FACILITIES.flag);
    return Array.isArray(stored) ? cleanActions(stored) : [];
}

/** The id a packet and a Facilities row name a completed project's action by: `project:<projectId>`. */
export const PROJECT_PREFIX = "project:";

/** The key a GM's action's use is kept under, in the GMs' store and in the public `facilityClosed`. */
export function gmActionKey(sceneId, room, actionId) {
    return `g:${sceneId}:${room}:${actionId}`;
}

/** The key a project's action's use by one character is kept under in the GMs' store. */
export function projectActionKey(projectId, actorId) {
    return `p:${projectId}:${actorId}`;
}

/**
 * Write a room's GM actions on every piece of the room that can be a room (rooms.mjs `writablePieces`), cleaned.
 * A GM's; answers the list written, or null where nothing was (a player, no piece).
 */
export async function setRoomActions(scene, room, list) {
    if (!game.user?.isGM || !scene) return null;
    const pieces = writablePieces(scene, room);
    if (!pieces.length) return null;
    const actions = cleanActions(list);
    await scene.updateEmbeddedDocuments("Region", pieces.map(piece => ({ _id: piece.id, [`flags.${MODULE_ID}.${FACILITIES.flag}`]: actions })));
    return actions;
}

/**
 * Give a project its action, or take it off (`null`). A GM's, in the project's own step on the primary
 * (projects.mjs `applyProjectChange`'s meta, which `setProjectMeta` puts in the GMs' half while the project is secret,
 * PROJECT_SECRET_WHILE_SECRET). A project completed before it was given its action starts the lifetime now: no
 * completion row will stamp it. Answers the action written, null for one taken off or not written.
 */
export async function setProjectFacility(projectId, raw) {
    if (!game.user?.isGM || typeof projectId !== "string") return null;
    const facility = raw === null ? null : cleanFacility(raw);
    if (raw !== null && !facility) return null;
    const { allProjects, applyProjectChange } = await import("./projects.mjs");
    const done = allProjects().find(p => p.id === projectId)?.complete === true;
    const stamp = facility && done && !metaFor(projectId).completedAt ? { completedAt: facilityOrdinal() } : {};
    const result = await applyProjectChange(projectId, { meta: { facility, ...stamp } });
    return result ? facility : null;
}

/**
 * A project's action as this browser may read it: projectMeta's, or on a GM the GMs' half's while the project is
 * secret (projects-secrecy.mjs `secretsOf`), cleaned; with `completedAt`, the time of day its completion row stamped.
 * `{ facility, completedAt }`, `facility` null for a project with none.
 */
export function projectFacilityOf(projectId) {
    const meta = metaFor(projectId);
    const raw = secretsOf(projectId).facility ?? meta.facility ?? (game.user?.isGM ? null : toldFacility(projectId));
    return { facility: raw ? cleanFacility(raw) : null, completedAt: meta.completedAt ?? null };
}

/** The meta key of a GM's private card that carries a secret project's room action to its insiders (projects.mjs `tellFacility`). */
export const PROJECT_FACILITY_CARD = "projectFacility";

/**
 * A SECRET PROJECT'S ROOM ACTION ON AN INSIDER'S BROWSER (the owner's DRPG-D1 answer, 12.11.2026: "Dostaja"): the action
 * the newest of the GMs' private cards to this user carries for it (projects.mjs `tellFacility`), whose words and meta
 * reach their readers alone (secret.mjs); null when none does, or the newest says it has none. A card a GM did not write
 * counts for nothing. The GM's run judges a use again on its own half (bridge-runs-acts.mjs `handleFacilityUse`).
 */
function toldFacility(projectId) {
    let best = null, at = -1;
    for (const message of game.messages ?? []) {
        if (!message?.flags?.[MODULE_ID]?.secret || !message.author?.isGM) continue;
        const told = cardMeta(message, PROJECT_FACILITY_CARD);
        if (told?.id !== projectId) continue;
        const when = Number(message.timestamp) || 0;
        if (when >= at) { at = when; best = told.facility ?? null; }
    }
    return best;
}

/**
 * The completed projects' actions standing where `place` is (movement.mjs `locateActor`'s `{ room, scene }`) for `user`:
 * each project complete, in that room on that scene (projects.mjs `standsAtProject`), seen by `user` (`canSee`), not an
 * indirect murder, with an action whose lifetime runs at `clock`. `[{ project, facility, completedAt, timesLeft }]`.
 * Reaches projects.mjs by `import()`: it imports this file, so a static import here would close a cycle.
 */
export async function projectActionsAt(place, user = game.user, clock = getClock()) {
    if (!place?.room || !place.scene) return [];
    return projectActionsWith(await import("./projects.mjs"), place, user, clock);
}

/**
 * `projectActionsAt` with projects.mjs's three readers handed in (`{ allProjects, standsAtProject, canSee }`), so a file
 * that imports projects.mjs statically reads the same rows without waiting (action-facilities.mjs `facilityRows`, which
 * the sheet's Facilities tile reads as it draws; fix line 113f, 13.11.2026). Every one of the three is synchronous.
 */
export function projectActionsWith({ allProjects, standsAtProject, canSee }, place, user = game.user, clock = getClock()) {
    if (!place?.room || !place.scene) return [];
    const out = [];
    for (const project of allProjects()) {
        if (!project.complete || project.indirectMurder || !standsAtProject(place, project.id) || !canSee(project.id, user)) continue;
        const { facility, completedAt } = projectFacilityOf(project.id);
        if (!facility || !facilityLive(facility, completedAt, clock)) continue;
        out.push({ project, facility, completedAt, timesLeft: facilityTimesLeft(facility, completedAt, clock) });
    }
    return out;
}

/**
 * The line the Projects window adds to a completed project that gives a room action (the owner's 05.11 option A: "the
 * Projects window shows the time left and that its action is in Facilities"), in this browser's language; "" for a
 * project with none this browser holds, or one whose lifetime has run out.
 */
export function facilityLineFor(projectId, clock = getClock()) {
    const { facility, completedAt } = projectFacilityOf(projectId);
    if (!facility || !facilityLive(facility, completedAt, clock)) return "";
    const left = facilityTimesLeft(facility, completedAt, clock);
    const life = left === null ? game.i18n.localize("DRPG.Facility.forGood") : plural("DRPG.Facility.timesLeft", { n: left });
    return game.i18n.format("DRPG.Facility.projectLine", { action: facility.label, life });
}

/* ==========================================================================
 * WHAT IS OPEN
 * ========================================================================== */

/** The GM actions closed now, by key (`facilityClosed`; a list of another mark is none). */
export function closedNow(clock = getClock()) {
    const stored = game.settings.get(MODULE_ID, SETTINGS.facilityClosed) ?? {};
    return new Set(stored.mark === facilityMark(clock) && Array.isArray(stored.keys) ? stored.keys : []);
}

/**
 * What a room action costs in actions now: a GM's `FACILITIES.gmCost`, a project's `projectCost` or none as its switch
 * says, and under the Overflow's Toll its `by` more (the owner's 08.11: "Toll makes a 0-cost action cost 1"). The Toll's
 * reader is overflow.mjs `overflowFacilityToll`, handed in so this file imports no overflow code. Pure.
 */
export function facilityCost(source, facility, toll = 0) {
    const base = source === "gm" ? FACILITIES.gmCost : (facility?.costsAction === false ? 0 : FACILITIES.projectCost);
    return base + Math.max(0, Number(toll) || 0);
}

/**
 * Why the Despair Overflow shuts a room action now, or null: Lockdown every room action, Power cut a completed project's.
 * `states` is overflow.mjs `overflowFacilityStates()`, `{ lockdown, powercut }`. Pure.
 */
export function facilityShut(source, states) {
    if (states?.lockdown) return "lockdown";
    if (source === "project" && states?.powercut) return "powercut";
    return null;
}
