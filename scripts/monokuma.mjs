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

/**
 * Which Despair pool this Monokuma actor draws on.
 *
 * An actor is tied to a GM by ownership: whoever owns the Monokuma actor spends
 * from their own pool. Falls back to the acting user when the actor is shared,
 * so a single GM running both Monokumas still works.
 */
export function poolUserFor(actor) {
    if (!actor) return null;

    const owners = game.users.filter(u =>
        u.role === CONST.USER_ROLES.GAMEMASTER && actor.testUserPermission(u, "OWNER"));

    if (owners.length === 1) return owners[0];
    if (owners.some(u => u.id === game.user.id)) return game.user;
    return owners[0] ?? (game.user.isGM ? game.user : null);
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
