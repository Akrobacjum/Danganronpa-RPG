/**
 * Danganronpa RPG - action economy.
 * ---------------------------------------------------------------------------
 * Guide:
 *   "Each player has 2 actions per time of day by default."
 *   "Move: one free move per time of day. Every further move costs an action."
 *   "Losing all Health during Daily Life costs the character -1 action per time of day."
 *
 * The budget is derived, never stored: a character who heals mid-day gets their
 * action back on the next reset instead of being stuck at one.
 */

import { MODULE_ID, FLAGS, ACTIONS_RESOURCE, STARTING } from "./config.mjs";
import { isWounded } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { debug, plural } from "./utils.mjs";
import { overflowActionPenalty, overflowFloor, overflowBlocksFreeMove } from "./overflow.mjs";
import { playSfx } from "./sfx.mjs";

/**
 * How many actions this character should get when a new time of day starts.
 * @returns {{total: number, wounded: boolean}}
 */
export function actionBudget(actor) {
    const wounded = isWounded(actor);

    /*
     * A DARKENED TIME OF DAY COSTS AN ACTION (Z10), and it stacks with Wounded
     * on purpose - a hurt student in a darkened hour is exactly the situation
     * the rule is for. The floor is what stops the two of them reaching zero
     * together: a budget of nothing is not a harder game, it is a player with
     * nothing to do until the clock moves.
     */
    const dark = overflowActionPenalty();
    const floor = dark ? overflowFloor("panic") : 0;
    const total = Math.max(floor, STARTING.actions - (wounded ? 1 : 0) - dark);

    return { total, wounded, darkened: dark > 0 };
}

/** Actions still available right now. */
export function actionsLeft(actor) {
    return actor?.system?.resources?.[ACTIONS_RESOURCE]?.value ?? 0;
}

/** The maximum currently shown on the sheet. */
export function actionsMax(actor) {
    return actor?.system?.resources?.[ACTIONS_RESOURCE]?.max ?? STARTING.actions;
}

/* ==========================================================================
 * GRANTS - crossings and actions bought with Hope
 * --------------------------------------------------------------------------
 * Sprint and Burst (E13) buy something that lasts rather than something the
 * next roll consumes, so neither goes through `FLAGS.pendingCall` - that is the
 * list of Calls armed for the NEXT roll (CALL-02), spent by the roll that uses
 * them, and a Sprint parked there would be used up by a Search that has nothing
 * to do with crossing a room. They bank into counters instead, spent by the two
 * functions below that charge for a crossing and for an action.
 *
 * Nothing clears them on a timer. `resetActionsFor` empties both alongside the
 * action budget, which is what makes "until the end of this time of day" true
 * without anything measuring time.
 * ========================================================================== */

/** Free actions this character has bought and not yet used. */
export function freeActionsLeft(actor) {
    return Math.max(0, Number(actor?.getFlag?.(MODULE_ID, FLAGS.freeActionGrants)) || 0);
}

/** Free room crossings this character has bought and not yet used. */
export function freeMovesLeft(actor) {
    return Math.max(0, Number(actor?.getFlag?.(MODULE_ID, FLAGS.freeMoveGrants)) || 0);
}

/**
 * Can this character pay for an action costing `cost` right now?
 *
 * THE QUESTION IS NOT "HOW MANY PIPS ARE LEFT" any more, and four places were
 * asking it that way: the guard at the top of every action, the tile's dimming,
 * the tile's tooltip and the crossing charge. A player holding a Burst and no
 * actions would have seen the entire grid greyed out with nothing to spend it
 * on - a Call for four Hope that cannot be used is a Call that took the Hope
 * (trap 96).
 *
 * A grant covers a whole call whatever it costs, so having one is enough on its
 * own; the amount only matters when actions are what is paying.
 */
export function canPayFor(actor, cost = 1) {
    if (cost <= 0) return true;
    return freeActionsLeft(actor) > 0 || actionsLeft(actor) >= cost;
}

/** Bank some. Both Calls come through here - see `applyCall`. */
export async function grantFreeActions(actor, n = 1) {
    if (!actor || n <= 0) return false;
    await actor.setFlag(MODULE_ID, FLAGS.freeActionGrants, freeActionsLeft(actor) + n);
    return true;
}

export async function grantFreeMoves(actor, n = 1) {
    if (!actor || n <= 0) return false;
    await actor.setFlag(MODULE_ID, FLAGS.freeMoveGrants, freeMovesLeft(actor) + n);
    return true;
}

/**
 * Spend actions. Returns false and leaves the actor untouched when the budget
 * cannot cover the cost, so callers can refuse the action outright.
 *
 * Otherwise returns a RECEIPT, `{ grant, amount }` - truthy, so every
 * `if (!await spendAction(...))` reads it as before - that says what paid, so
 * `refundAction` can give back the same thing (trap 98): a Burst that paid for
 * an action the player then backed out of comes back as a Burst, not as an
 * action out of thin air.
 *
 * IT USED TO BE ONE SLOT PER ACTOR (review of ACT-07, 17.09). A client-local
 * "last spend" Map, which was true while a spend and its refund were
 * milliseconds apart. Paying before the roll put a non-modal roll window between
 * them, and a second tile or a paid Move in that window overwrote the slot: a
 * Burst came back as an action, an action as a Burst, or the second refund found
 * nothing. The receipt travels with the action that holds it instead.
 */
export async function spendAction(actor, amount = 1, { quiet = false } = {}) {
    if (!actor || amount <= 0) return false;

    /*
     * A BURST COVERS THE WHOLE CALL, WHATEVER IT WAS CHARGING FOR.
     *
     * "Your next action is free" is a sentence about the action, not about one
     * point of it - a Long Rest costs two and goes on a single Burst. So the
     * grant is consumed here, before the amount is even looked at.
     *
     * And exactly ONE call: an action that charges twice (there are none today,
     * and that is not a guarantee) pays normally the second time. A grant that
     * covered every spend until the turn ended would be a Long Rest plus
     * anything else at all for four Hope - trap 97.
     */
    if (freeActionsLeft(actor) > 0) {
        await actor.setFlag(MODULE_ID, FLAGS.freeActionGrants, freeActionsLeft(actor) - 1);
        // Same sound, and it is worth saying why the comment below no longer
        // covers this branch: the pips do NOT move here. What the player is
        // listening for is the cost being paid, and on the one turn they spent
        // four Hope to skip it, silence would read as "did my Burst fire?".
        if (!quiet) playSfx("actionSpent");
        debug(`${actor.name} spent a Burst instead of ${amount} action(s).`);
        return { grant: true, amount };
    }

    const left = actionsLeft(actor);
    if (left < amount) {
        /*
         * QUIET IS FOR A SPEND MADE ON SOMEBODY ELSE'S BEHALF (T-1).
         *
         * An Objection is charged to the objector's sheet by the primary GM's
         * client, because that is the only client allowed to write it. A pip
         * sound on the GM's speakers and a toast on the GM's screen say nothing
         * to the player who clicked, and that player is told in the whisper
         * `price.mjs` sends instead.
         */
        if (!quiet) {
            ui.notifications.warn(plural("DRPG.Actions.notEnough", {
                actor: actor.name,
                left,
                needed: amount
            }, "left"));
        }
        return false;
    }

    await automatedUpdate(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: left - amount });

    /*
     * EVERY SPEND, NOT ONLY THE ACTION GRID - trap 44, decided here.
     *
     * This function is also how a Rest, a Move beyond the free one and the
     * crisis actions take their price. The sound means "an action just left
     * your budget", and that is equally true of all of them: the player is
     * watching the same three pips go down. Restricting it to the grid would
     * make the pip drop SILENTLY in exactly the cases nobody is expecting it
     * to drop at all, which is the opposite of what a sound is for.
     *
     * Local and unguarded. It plays wherever the spend was made, which is the
     * acting player's browser almost always and a GM's when they correct
     * somebody's budget by hand - where a click is honest feedback that the
     * write landed.
     */
    if (!quiet) playSfx("actionSpent");

    debug(`${actor.name} spent ${amount} action(s); ${left - amount} left.`);
    return { grant: false, amount };
}

/**
 * Hand an action back - criticals on Project and Meddle both do this.
 *
 * @param {object} [receipt]  What `spendAction` returned for the spend being
 *   undone. A Burst receipt gives the Burst back. Without one - a GM-side refund
 *   for a spend made on somebody else's client - it is refunded as an action.
 *   A ruling card posted by 1.2.43 says `paid: "grant"` rather than carrying a
 *   receipt (ROLL-13), so the card's reader builds `{ grant: true }` from those
 *   words before it calls this; nothing here reads a card.
 */
export async function refundAction(actor, amount = 1, receipt = null) {
    if (!actor || amount <= 0) return false;
    if (receipt?.grant) return grantFreeActions(actor, 1);

    const next = Math.min(actionsMax(actor), actionsLeft(actor) + amount);
    await automatedUpdate(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: next });
    return true;
}

/**
 * Take back a refund a Reroll has just made untrue - the mirror of `refundAction`.
 *
 * A critical on Work on Project hands its action back; a Reroll that loses the
 * critical takes it again, and `spendAction` would spend a banked Burst first
 * whatever had been refunded (review of ACT-07's receipts, 17.09). This takes
 * what the receipt says was given back, and only falls back to an ordinary spend
 * when that is no longer there.
 *
 * @returns {Promise<object|false>}  A receipt, or false when nothing could be taken.
 */
export async function takeBackRefund(actor, amount = 1, receipt = null) {
    if (!actor || amount <= 0) return false;
    if (receipt?.grant && freeActionsLeft(actor) > 0) {
        await actor.setFlag(MODULE_ID, FLAGS.freeActionGrants, freeActionsLeft(actor) - 1);
        playSfx("actionSpent");
        return { grant: true, amount };
    }
    if (!receipt?.grant && actionsLeft(actor) >= amount) {
        await automatedUpdate(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: actionsLeft(actor) - amount });
        playSfx("actionSpent");
        return { grant: false, amount };
    }
    return spendAction(actor, amount);
}

/**
 * Set the remaining actions directly. GM only - the pips on the sheet are a
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
    // FOG TAKES IT AWAY (Z10). Asked here rather than at the call sites because
    // this is already the single answer: `takeMove` reads it to decide what a
    // crossing costs, and the sheet reads it to draw the Move tile's price. The
    // action-priced crossings are untouched - Fog makes moving cost something,
    // it does not stop it.
    if (overflowBlocksFreeMove()) return false;
    return !actor?.getFlag(MODULE_ID, FLAGS.freeMoveUsed);
}

/**
 * Take a Move. Uses the free one if it is still available, otherwise spends an
 * action. Returns what it ended up costing, or null when it could not happen.
 */
export async function takeMove(actor) {
    if (!actor) return null;

    /*
     * THE FREE ONE FIRST, THEN A SPRINT, THEN AN ACTION.
     *
     * Mechanically the first two are interchangeable - `resetActionsFor` clears
     * both at the same moment, so neither can be saved past the other - and the
     * order is chosen for legibility rather than for advantage. Burning a thing
     * somebody paid three Hope for while the free one sits unused is a report
     * waiting to be filed, whether or not it costs anything.
     */
    if (hasFreeMove(actor)) {
        await actor.setFlag(MODULE_ID, FLAGS.freeMoveUsed, true);
        return "free";
    }

    if (freeMovesLeft(actor) > 0) {
        await actor.setFlag(MODULE_ID, FLAGS.freeMoveGrants, freeMovesLeft(actor) - 1);
        return "sprint";
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
 *
 * `keepGrants` leaves the free Move and the banked Sprints and Bursts where they
 * are, for a caller that refills the budget without ending the time of day: a GM
 * correcting a roster, and a season reset where the GM ticked the grants as an
 * exception (R-1). The default is still to clear them, because clearing them is
 * what makes them expire.
 */
export async function resetActionsFor(actor, { keepGrants = false } = {}) {
    if (!actor || actor.type !== "character") return null;

    // A Monokuma has no action economy - `setMonokuma` zeroes the budget on
    // purpose. Refilling everyone handed it straight back, so a sheet that is
    // supposed to read "no actions" showed a full row again after every reset.
    if (actor.getFlag(MODULE_ID, FLAGS.monokuma)) return null;

    // Neither do the dead.
    //
    // `performAction` and the sheet both already refuse a corpse, but this pass
    // kept handing one a full budget every time of day - so the GM panel's
    // roster read "2 / 2" next to a dead student's name, and any route that
    // skips the sheet found the actions really were there. A Monocub is the
    // deliberate exception: the guide gives them "tyle akcji co gracze", and
    // they are spent on Move and Meddle.
    //
    // Both flags are read directly rather than through `chapter.mjs` and
    // `monocub.mjs`, because monocub.mjs already imports THIS file - going the
    // other way would close an import cycle.
    const dead = Boolean(actor.getFlag(MODULE_ID, FLAGS.deceased));
    if (dead && !actor.getFlag(MODULE_ID, FLAGS.monocub)) return null;

    const { total, wounded } = actionBudget(actor);
    await automatedUpdate(actor, {
        [`system.resources.${ACTIONS_RESOURCE}.value`]: total,
        [`system.resources.${ACTIONS_RESOURCE}.max`]: total,
        ...(keepGrants ? {} : {
            [`flags.${MODULE_ID}.${FLAGS.freeMoveUsed}`]: false,
            // What makes Sprint and Burst last "until the end of this time of
            // day" without anything measuring time - see the note above
            // `freeActionsLeft`. Zeroed rather than deleted: `-=key` does
            // nothing in this Foundry without a forced replacement, and a grant
            // that survived its own expiry is a Call the player gets to spend
            // twice.
            [`flags.${MODULE_ID}.${FLAGS.freeMoveGrants}`]: 0,
            [`flags.${MODULE_ID}.${FLAGS.freeActionGrants}`]: 0
        })
    });

    return { actor, total, wounded };
}

/**
 * Refill every character. GM only - players cannot write to other actors.
 * @returns {Promise<Array<{actor: Actor, total: number, wounded: boolean}>>}
 */
export async function resetAllActions({ keepGrants = false } = {}) {
    if (!game.user.isGM) return [];

    const results = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        const result = await resetActionsFor(actor, { keepGrants });
        if (result) results.push(result);
    }
    return results;
}

/**
 * The allowance a Class Trial opens with (T-1, Dawid 17.09).
 *
 * A trial is a seam in play, and since T-1 there are two things to spend actions
 * on inside one - Analyze and an Objection - both paid out of a real budget. So
 * the trial hands out the time of day's allowance: two, minus a Wound, minus a
 * darkened hour, exactly what `actionBudget` computes for everyone else.
 *
 * `keepGrants`, because this is the one refill in the module that is NOT a new
 * time of day. A Burst and a Sprint were bought with four Hope each and "until the
 * end of this time of day" has not arrived - the trial is inside it.
 *
 * Called from one place: the `to === "classTrial"` branch of `reconcilePhase`
 * in clock.mjs, which `setClock` runs on every route into a trial
 * (`startClassTrial`, `setPhase` - which `startFloor` goes through - the clock
 * editor and the season reset), and only when the phase really changed. That
 * guard is what makes it idempotent, so a trial's second and third debate
 * refill nothing.
 */
export async function openTrialBudget() {
    return resetAllActions({ keepGrants: true });
}
