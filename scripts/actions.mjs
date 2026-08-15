/**
 * Danganronpa RPG — action economy.
 * ---------------------------------------------------------------------------
 * Guide:
 *   "Each player has 2 actions per time of day by default."
 *   "Move: one free move per time of day. Every further move costs an action."
 *   "Losing all HP during Daily Life costs the character -1 action per time of day."
 *
 * The budget is derived, never stored: a character who heals mid-day gets their
 * action back on the next reset instead of being stuck at one.
 */

import { MODULE_ID, FLAGS, ACTIONS_RESOURCE, STARTING } from "./config.mjs";
import { isWounded } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { debug } from "./utils.mjs";

/**
 * How many actions this character should get when a new time of day starts.
 * @returns {{total: number, wounded: boolean}}
 */
export function actionBudget(actor) {
    const wounded = isWounded(actor);
    const total = Math.max(0, STARTING.actions - (wounded ? 1 : 0));
    return { total, wounded };
}

/** Actions still available right now. */
export function actionsLeft(actor) {
    return actor?.system?.resources?.[ACTIONS_RESOURCE]?.value ?? 0;
}

/** The maximum currently shown on the sheet. */
export function actionsMax(actor) {
    return actor?.system?.resources?.[ACTIONS_RESOURCE]?.max ?? STARTING.actions;
}

/**
 * Spend actions. Returns false and leaves the actor untouched when the budget
 * cannot cover the cost, so callers can refuse the action outright.
 */
export async function spendAction(actor, amount = 1) {
    if (!actor || amount <= 0) return false;

    const left = actionsLeft(actor);
    if (left < amount) {
        ui.notifications.warn(game.i18n.format("DRPG.Actions.notEnough", {
            actor: actor.name,
            left,
            needed: amount
        }));
        return false;
    }

    await automatedUpdate(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: left - amount });
    debug(`${actor.name} spent ${amount} action(s); ${left - amount} left.`);
    return true;
}

/** Hand an action back — criticals on Project and Meddle both do this. */
export async function refundAction(actor, amount = 1) {
    if (!actor || amount <= 0) return false;
    const next = Math.min(actionsMax(actor), actionsLeft(actor) + amount);
    await automatedUpdate(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: next });
    return true;
}

/**
 * Set the remaining actions directly. GM only — the pips on the sheet are a
 * correction tool for the GM, not a dial for the player. Players spend actions
 * by taking actions.
 */
export async function setActions(actor, value) {
    if (!actor) return false;
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Guard.blocked"));
        return false;
    }
    const clamped = Math.max(0, Math.min(actionsMax(actor), value));
    await automatedUpdate(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: clamped });
    return true;
}

/* ==========================================================================
 * FREE MOVE
 * ========================================================================== */

/** Has this character still got their free Move this time of day? */
export function hasFreeMove(actor) {
    return !actor?.getFlag(MODULE_ID, FLAGS.freeMoveUsed);
}

/**
 * Take a Move. Uses the free one if it is still available, otherwise spends an
 * action. Returns what it ended up costing, or null when it could not happen.
 */
export async function takeMove(actor) {
    if (!actor) return null;

    if (hasFreeMove(actor)) {
        await actor.setFlag(MODULE_ID, FLAGS.freeMoveUsed, true);
        return "free";
    }

    const paid = await spendAction(actor, 1);
    return paid ? "action" : null;
}

/** Give the free Move back (undo, or a GM correction). */
export function restoreFreeMove(actor) {
    return actor?.setFlag(MODULE_ID, FLAGS.freeMoveUsed, false);
}

/* ==========================================================================
 * RESET
 * ========================================================================== */

/**
 * Refill one character for a new time of day. The max is rewritten too, so a
 * wounded character reads "1 / 1" rather than a misleading "1 / 2".
 */
export async function resetActionsFor(actor) {
    if (!actor || actor.type !== "character") return null;

    // A Monokuma has no action economy — `setMonokuma` zeroes the budget on
    // purpose. Refilling everyone handed it straight back, so a sheet that is
    // supposed to read "no actions" showed a full row again after every reset.
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return null;

    // Neither do the dead.
    //
    // `performAction` and the sheet both already refuse a corpse, but this pass
    // kept handing one a full budget every time of day — so the GM panel's
    // roster read "2 / 2" next to a dead student's name, and any route that
    // skips the sheet found the actions really were there. A Monocub is the
    // deliberate exception: the guide gives them "tyle akcji co gracze", and
    // they are spent on Move and Meddle.
    //
    // Both flags are read directly rather than through `chapter.mjs` and
    // `monocub.mjs`, because monocub.mjs already imports THIS file — going the
    // other way would close an import cycle.
    const dead = Boolean(actor.getFlag(MODULE_ID, FLAGS.deceased));
    if (dead && !actor.getFlag(MODULE_ID, FLAGS.monocub)) return null;

    const { total, wounded } = actionBudget(actor);
    await automatedUpdate(actor, {
        [`system.resources.${ACTIONS_RESOURCE}.value`]: total,
        [`system.resources.${ACTIONS_RESOURCE}.max`]: total,
        [`flags.${MODULE_ID}.${FLAGS.freeMoveUsed}`]: false
    });

    return { actor, total, wounded };
}

/**
 * Refill every character. GM only — players cannot write to other actors.
 * @returns {Promise<Array<{actor: Actor, total: number, wounded: boolean}>>}
 */
export async function resetAllActions() {
    if (!game.user.isGM) return [];

    const results = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        const result = await resetActionsFor(actor);
        if (result) results.push(result);
    }
    return results;
}
