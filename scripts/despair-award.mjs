/**
 * Danganronpa RPG - Despair earned from rolls.
 * ---------------------------------------------------------------------------
 * Guide: "A higher Hope die gives the player +1 Hope, a higher Despair die
 * gives one GM +1 Despair."
 *
 * Which GM is not arbitrary: it is the Monokuma who looks after that student
 * (see assignments.mjs). Daggerheart only knows one shared Fear pool, so the
 * award is read off the finished roll rather than hooked into the system's own
 * Fear plumbing - that keeps working whatever the system does internally.
 *
 * Only one client may write, or two GMs would both credit the same roll.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { adjustDespair, getDespair, despairMax, spillFrom } from "./despair.mjs";
import { monokumaFor } from "./assignments.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isPrimaryGm, debug, error } from "./utils.mjs";

export function registerDespairAwards() {
    Hooks.on("createChatMessage", onChatMessage);
}

async function onChatMessage(message) {
    try {
        if (!isPrimaryGm()) return;

        const outcome = readDuality(message);
        if (!outcome) {
            debug("Message carried no duality dice; no Despair awarded.", message?.type);
            return;
        }

        /*
         * A REACTION ROLL PAYS NOTHING, AND THIS IS WHERE THAT IS TRUE.
         *
         * Every bare statistic click on a character sheet is forced to a
         * reaction (see `forceReaction` in roll-dialog.mjs), because it is not
         * an action: nothing was declared, nothing was spent. Without this line
         * that made no difference at all - this hook fires on any duality
         * message, so clicking a statistic fed a Monokuma's pool on a Fear
         * result and paid the critical's second Hope on a crit, over and over,
         * for free.
         *
         * Read off the ROLL rather than the dialog, because the dialog is an
         * interface and this is a rule. `options.actionType` is what Daggerheart
         * serialises into the message and it survives a reload.
         */
        if (message.rolls?.[0]?.options?.actionType === "reaction") {
            debug("Reaction roll: no Hope, no Despair.");
            return;
        }

        // A roll thrown with no GM connected (E08+E28 C18, roll-draw.mjs `UNWITNESSED_FLAG`) is
        // the GMs' card's to grant, its Despair with it: awarded here as well, a Grant all paid it
        // twice. A stamp is its roller's word, so one written while a GM is here asks that GM too.
        if (message.getFlag?.(MODULE_ID, "unwitnessed")) {
            debug("A roll thrown with no GM connected: its Despair waits for the GMs' card.");
            return;
        }

        const actor = await resolveActor(message);
        if (!actor || actor.type !== "character") {
            debug("Roll had no character behind it; nothing awarded.", message?.speaker);
            return;
        }

        /*
         * NO CRIT HOPE IS PAID HERE, AND THAT IS THE FIX FOR A DOUBLE PAYMENT.
         *
         * This used to add the second point of a critical's Hope, back when
         * Daggerheart's pipeline paid one and the guide asked for two. It is
         * not the payer any more: `critical.mjs` wraps
         * `DualityRoll#addDualityResourceUpdates` and makes the pipeline itself
         * pay the guide's full `CRITICAL.hope`, at the funnel, before the card
         * is ever posted.
         *
         * Both were live at once, so every fresh critical paid 2 + 1 = 3 Hope.
         * Measured end to end: Hope 0 -> 3 on one critical action, against a
         * guide that says 2. Hope buys Calls, so that is a real drift in the
         * economy rather than a rounding error.
         *
         * The reroll path is the exception and it still needs a top-up, which
         * is why `adjustCritHopeTopUp` below stays exported: a reroll is settled
         * by reroll.mjs's port of `updateResourcesForDualityReroll`, which the
         * funnel never sees and which pays the system's own 1, and reroll.mjs
         * adds the second - behind the gate the funnel has, Daggerheart's
         * `hopeFear.players` (E08+E28 C4b). See `settleCritHope` in reroll.mjs.
         */

        if (outcome.withFear) await awardRollDespair(actor, 1);
    } catch (err) {
        error("Could not award Despair from a roll", err);
    }
}

/**
 * A roll's point of Despair to the Monokuma who looks after `actor`, or (`delta` -1) that point
 * given back. Answers `{ monokuma, pool, overflow }` - what moved where - or null when nothing
 * was owed. GM only: the pool and the overflow are written by a GM.
 *
 * ONE FUNCTION FOR A FRESH ROLL AND A REROLL (E08+E28 C4b, 03.10.2026; audit S02-22). The fresh
 * award had three rules the Reroll's settlement did not: "Rolls grant Despair", a Monokuma's
 * own roll, and a full pool's spill. A Reroll into a Despair result fed a pool with the setting
 * off, and a point given back at a full pool came off the pool rather than the overflow it had
 * spilled to. Both now run these lines (`onChatMessage` above, reroll.mjs `settleDespair`).
 */
export async function awardRollDespair(actor, delta) {
    if (!game.user?.isGM || !actor || !delta) return null;

    // Monokumas roll too - a trait check to walk somewhere, a forced roll a
    // player triggered against them - but they are not students. Hope and
    // Despair pools are guide resources for the two sides of the table, not
    // for the actor playing the antagonist; a Monokuma's crit was quietly
    // refilling the Hope `setMonokuma` had zeroed out, and a Monokuma's
    // Despair roll was feeding its own controller's pool.
    if (isMonokuma(actor)) {
        debug(`${actor.name} is a Monokuma; rolls do not grant Hope or feed a Despair pool.`);
        return null;
    }
    if (!game.settings.get(MODULE_ID, SETTINGS.despairFromRolls)) return null;

    const monokuma = monokumaFor(actor);
    if (!monokuma) return null;

    const before = getDespair(monokuma.id);
    if (delta < 0) {
        /*
         * THE POINT GIVEN BACK COMES OFF THE OVERFLOW FIRST, AT A FULL POOL. Only a full pool
         * spills, so only a full pool gives back to the overflow: there the point the roll
         * earned went to the counter (or paid what the pool owed), and taking it off the pool
         * left the pool one short (E32+E07 fix r1-G3's first build, e32run g3f1, 02.10). An
         * empty counter gives back off the pool. Not inferred: whether this roll's point was
         * the one that filled the pool, or paid a debt rather than spilled - the pool keeps no
         * record of which roll fed it.
         */
        if (before >= despairMax()) {
            const { takeOverflow } = await import("./overflow.mjs");
            if (await takeOverflow(1, { reason: `a Reroll gave back ${monokuma.name}'s point` })) return { monokuma, pool: 0, overflow: -1 };
        }
        if (before <= 0) return null;
        await adjustDespair(monokuma.id, -1);
        return { monokuma, pool: -1, overflow: 0 };
    }

    if (before >= despairMax()) {
        /*
         * IT USED TO GRANT NOTHING, AND THAT WAS TWO THIRDS OF THE INCOME
         * (Z10). The season run measured 628 of 950 points dying on this
         * line. They now feed the Despair Overflow instead: the cap still
         * stops a Monokuma banking a chapter's worth of Calls, but the
         * Despair itself stops evaporating.
         *
         * What the pool owes for a conversion is paid first (E05 C12,
         * despair.mjs `spillFrom`): a full pool that owes two stood at ten.
         */
        const next = await spillFrom(monokuma.id, before, 1, `roll spill from ${monokuma.name}`);
        debug(`${monokuma.name} is at maximum Despair; the roll ${next?.spill ? "fed the overflow" : "paid what the pool owes"}.`);
        return { monokuma, pool: 0, overflow: next?.spill ?? 0 };
    }

    await adjustDespair(monokuma.id, 1);
    debug(`${actor.name} rolled with Despair -> +1 to ${monokuma.name} (${before + 1}/${despairMax()}).`);
    return { monokuma, pool: 1, overflow: 0 };
}

/**
 * Apply or reverse this module's +1 crit top-up, by a signed delta.
 *
 * Exported so Reroll can use the same logic: rerolling rewrites the existing
 * chat message with `message.update()` rather than creating a new one, so it
 * never runs through `onChatMessage` below and the top-up would otherwise never
 * apply to a roll that becomes a crit on its second try - nor get reversed when
 * a crit stops being one.
 *
 * Clamped to [0, max] so neither direction overflows or goes negative.
 *
 * Moved from the Hope the GMs hold, as a job of the character's audit queue
 * (sheet-audit.mjs `gmMeansWrite`, E29 fix r2-H5): read off the document, it
 * moved a forged Hope the audit had not put back yet, and the GMs took the
 * write as their value - reroll.mjs `makeReroll` says what that measured.
 */
export async function adjustCritHopeTopUp(actor, delta) {
    if (!actor || !delta) return;
    try {
        const { STARTING } = await import("./config.mjs");
        const { trustedWrite } = await import("./resource-guard.mjs");
        const { gmMeansWrite } = await import("./sheet-audit.mjs");

        await gmMeansWrite(actor, async ({ hope: held }) => {
            const max = actor.system?.resources?.hope?.max || STARTING.hopeMax;
            const next = Math.min(max, Math.max(0, held + delta));
            if (next === held) return;
            await trustedWrite(actor, { "system.resources.hope.value": next }, { reason: "gmRuling" });
            debug(`${actor.name}: crit top-up ${delta > 0 ? "paid" : "reversed"}, now ${next}/${max}.`);
        });
    } catch (err) {
        error("Could not adjust the critical's second Hope", err);
    }
}

/**
 * Pull the Hope/Despair outcome off a chat message.
 *
 * The dice are checked FIRST, on purpose. Daggerheart exposes `withHope` and
 * `withFear` as getters that bail out to `undefined` when the roll is not
 * evaluated or is a guaranteed critical, and `message.system.roll` is itself a
 * getter that resolves by `instanceof DualityRoll` - which can come back null
 * depending on how the roll reached chat. Comparing the two d12s is the one
 * signal that is always present once the dice have landed.
 *
 * A tie is a critical: it grants Hope, never Despair.
 */
export function readDuality(message) {
    const dice = findDualityDice(message);
    if (dice) {
        const { hope, fear } = dice;
        return {
            withFear: fear > hope,
            withHope: hope > fear,
            isCritical: hope === fear,
            source: "dice"
        };
    }

    // Fall back to the flags if the dice could not be located.
    for (const candidate of [message?.system?.roll, message?.rolls?.[0]]) {
        if (typeof candidate?.withFear === "boolean" || typeof candidate?.withHope === "boolean") {
            return {
                withFear: Boolean(candidate.withFear) && !candidate.isCritical,
                withHope: Boolean(candidate.withHope),
                isCritical: Boolean(candidate.isCritical),
                source: "flags"
            };
        }
    }

    return null;
}

/**
 * Locate the Hope and Despair d12 totals on a message.
 *
 * Tries the named accessors, then any roll carrying them, then falls back to
 * scanning the raw dice terms for the two twelve-sided dice a duality roll is
 * built from. The raw scan is what keeps trait rolls working regardless of how
 * the system happens to package them.
 */
function findDualityDice(message) {
    const rolls = message?.rolls ?? [];
    const candidates = [message?.system?.roll, ...rolls].filter(Boolean);

    for (const roll of candidates) {
        const hope = roll?.dHope?.total;
        const fear = roll?.dFear?.total;
        if (typeof hope === "number" && typeof fear === "number") return { hope, fear };
    }

    // Raw scan: a duality roll is two d12s, in Hope-then-Despair order.
    for (const roll of candidates) {
        const d12s = (roll?.dice ?? []).filter(d => d?.faces === 12);
        if (d12s.length < 2) continue;

        const hope = d12s[0]?.total ?? d12s[0]?.values?.[0];
        const fear = d12s[1]?.total ?? d12s[1]?.values?.[0];
        if (typeof hope === "number" && typeof fear === "number") return { hope, fear };
    }

    return null;
}

/**
 * The actor a chat message came from: `rollSubject` in private-rolls.mjs (E06
 * C5a), which tries every route this function used to try itself - the speaker's
 * actor and token, Daggerheart's `system.source.actor` - after the subject the
 * roller reported, and ends at the author's one living character rather than
 * `user.character` (a player's assigned character, dead or not).
 *
 * A roll the module threw is waited for, up to four seconds: this runs as the
 * message is created, and its report leaves as the roller's browser sees the
 * message created - before Dice So Nice's animation, which until E06 fix r1-G2
 * it followed (private-rolls.mjs `reportClaimedRoll`). Four is the wait
 * secret.mjs gives a card's document to arrive, not a measured delay.
 * Imported when asked, because private-rolls.mjs imports this file.
 */
async function resolveActor(message) {
    const { rollSubject } = await import("./private-rolls.mjs");
    return rollSubject(message, { waitMs: 4000 });
}
