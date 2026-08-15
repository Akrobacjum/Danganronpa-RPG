/**
 * Danganronpa RPG — telling Monokumas apart from students.
 * ---------------------------------------------------------------------------
 * The guide has the GMs walking the map as two Monokumas: "in their free time
 * they move around the map as two distinguishable, equivalent Monokuma. In this
 * form they interact with players, spend Despair to hinder their actions, or
 * help if they want to."
 *
 * A Monokuma is a `character` actor carrying a flag, not a new actor type.
 * They still want a portrait, a name and the occasional trait roll, and a
 * bespoke type would mean reimplementing the sheet and losing everything
 * Daggerheart keys off `type === "character"`.
 *
 * What the flag changes:
 *   · no action economy — the pips and free Move are greyed out
 *   · no Hope — they spend Despair instead
 *   · the action grid is replaced by Despair Calls
 *   · movement is unrestricted: no room costs, no walls, no Eclipse limit
 *   · room visibility never hides them from themselves
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
// Statically imported: `poolUserFor` is synchronous and read at render time by
// the sheet and by the voice reconciler. despair.mjs does not reach back into
// this file, so there is no cycle.
import { monokumas as poolHolders } from "./despair.mjs";
import { log } from "./utils.mjs";

/** Is this actor a Monokuma rather than a student? */
export function isMonokuma(actor) {
    return Boolean(actor?.getFlag?.(MODULE_ID, FLAGS.monokuma));
}

/** Every Monokuma actor in the world. */
export function monokumaActors() {
    return game.actors.filter(a => a.type === "character" && isMonokuma(a));
}

/** Every student — a character that is not a Monokuma. */
export function studentActors() {
    return game.actors.filter(a => a.type === "character" && !isMonokuma(a));
}

/**
 * Mark or unmark an actor as a Monokuma. GM only.
 *
 * Marking one also clears their action budget and Hope: those are student
 * resources, and leaving stale values on the sheet invites someone to spend
 * them.
 */
export async function setMonokuma(actor, value = true) {
    if (!game.user.isGM || !actor) return null;

    await actor.setFlag(MODULE_ID, FLAGS.monokuma, Boolean(value));

    if (value) {
        const { automatedUpdate } = await import("./resource-guard.mjs");
        const { ACTIONS_RESOURCE } = await import("./config.mjs");
        await automatedUpdate(actor, {
            [`system.resources.${ACTIONS_RESOURCE}.value`]: 0,
            "system.resources.hope.value": 0
        }).catch(() => {});
    }

    log(`${actor.name} is ${value ? "now" : "no longer"} a Monokuma.`);
    ui.notifications.info(game.i18n.format(
        value ? "DRPG.Monokuma.marked" : "DRPG.Monokuma.unmarked",
        { name: actor.name }
    ));

    actor.sheet?.render(false);
    return actor;
}

/* ==========================================================================
 * WHOSE POOL
 * --------------------------------------------------------------------------
 * Stated, not guessed. The map is world state — `{ [actorId]: userId }` — so
 * every client agrees on which Monokuma spends whose Despair, and the Despair
 * Calls panel on each sheet shows that Monokuma's pool rather than the pool of
 * whoever happens to be looking at it.
 *
 * Guessing was the bug: the old version derived the link from ownership, and
 * `testUserPermission(gm, "OWNER")` is true for every GM on every actor. With
 * two Gamemasters the answer collapsed to "the viewer", so Monokuma and Monomi
 * shared one pool and a change to the other GM's Despair appeared nowhere.
 * ========================================================================== */

/** Raw map: { [actorId]: gmUserId }. */
export function pools() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.monokumaPools) ?? {};
    } catch {
        return {};
    }
}

/** The user id configured for this Monokuma actor, or null. */
export function poolFor(actor) {
    return pools()[actor?.id] ?? null;
}

/** Write the whole map at once — used by the Monokuma panel. GM only. */
export async function setPools(map) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.monokumaPools, { ...map });
    log(`Monokuma pools set for ${Object.keys(map).length} actor(s).`);
    return map;
}

/** Point one Monokuma at one Gamemaster's pool. GM only. */
export async function setPoolFor(actor, userId) {
    if (!game.user.isGM || !actor) return null;
    const map = { ...pools() };
    if (userId) map[actor.id] = userId;
    else delete map[actor.id];
    return setPools(map);
}

/**
 * Which Despair pool this Monokuma actor draws on.
 *
 * The configured answer wins. Everything below it is a fallback for a world
 * that has not opened the Monokuma panel yet, and none of it is trusted once
 * an answer exists.
 */
export function poolUserFor(actor) {
    if (!actor) return null;

    // "Has a pool" is despair.mjs's question, not a role test. An Assistant GM
    // explicitly granted one (`addPool`) is offered as a pool in the GM team
    // panel and counted by `monokumasWithoutPool`, so refusing them here meant
    // a Monokuma pointed at that pool silently spent somebody else's Despair.
    const holders = poolHolders();
    const configured = game.users.get(poolFor(actor) ?? "");
    if (configured && holders.some(u => u.id === configured.id)) return configured;

    const gms = holders.length ? holders : game.users.filter(u => u.role === CONST.USER_ROLES.GAMEMASTER);
    if (!gms.length) return game.user.isGM ? game.user : null;

    // One Gamemaster, one pool — nothing to disambiguate.
    if (gms.length === 1) return gms[0];

    // More than one and nothing configured: an explicit OWNER entry on the actor
    // is the only remaining signal that means anything, since GMs bypass the
    // ownership test itself.
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const ownership = actor.ownership ?? {};
    const declared = gms.filter(u => ownership[u.id] === OWNER);
    if (declared.length === 1) return declared[0];

    // Genuinely ambiguous. The acting GM spends their own, and the panel exists
    // to stop the table ever being in this state.
    return declared.find(u => u.id === game.user.id)
        ?? gms.find(u => u.id === game.user.id)
        ?? gms[0];
}

/**
 * Every Monokuma actor that has no pool configured. For the GM's attention.
 *
 * Measured against the same roster `poolUserFor` accepts — "is a GM" was a
 * looser test than the one that actually decides whose Despair is spent, so an
 * actor could read as configured here and still be ignored there.
 */
export function monokumasWithoutPool() {
    const map = pools();
    const holders = new Set(poolHolders().map(u => u.id));
    return monokumaActors().filter(a => !holders.has(map[a.id] ?? ""));
}

/** Add a "Mark as Monokuma" toggle to the actor directory context menu. */
export function registerMonokuma() {
    Hooks.on("getActorContextOptions", (directory, options) => {
        if (!game.user.isGM) return;

        options.push({
            name: "DRPG.Monokuma.toggle",
            icon: '<i class="fa-solid fa-masks-theater"></i>',
            condition: li => {
                const actor = game.actors.get(li.dataset?.entryId ?? li.dataset?.documentId);
                return actor?.type === "character";
            },
            callback: li => {
                const actor = game.actors.get(li.dataset?.entryId ?? li.dataset?.documentId);
                if (actor) setMonokuma(actor, !isMonokuma(actor));
            }
        });
    });
}
