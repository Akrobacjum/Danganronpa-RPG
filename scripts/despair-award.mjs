/**
 * Danganronpa RPG — Despair earned from rolls.
 * ---------------------------------------------------------------------------
 * Guide: "A higher Hope die gives the player +1 Hope, a higher Despair die
 * gives one GM +1 Despair."
 *
 * Which GM is not arbitrary: it is the Monokuma who looks after that student
 * (see assignments.mjs). Daggerheart only knows one shared Fear pool, so the
 * award is read off the finished roll rather than hooked into the system's own
 * Fear plumbing — that keeps working whatever the system does internally.
 *
 * Only one client may write, or two GMs would both credit the same roll.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { adjustDespair, getDespair, despairMax } from "./despair.mjs";
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
         * that made no difference at all — this hook fires on any duality
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

        const actor = resolveActor(message);
        if (!actor || actor.type !== "character") {
            debug("Roll had no character behind it; nothing awarded.", message?.speaker);
            return;
        }

        // Monokumas roll too — a trait check to walk somewhere, a forced roll a
        // player triggered against them — but they are not students. Hope and
        // Despair pools are guide resources for the two sides of the table, not
        // for the actor playing the antagonist; a Monokuma's crit was quietly
        // refilling the Hope `setMonokuma` had zeroed out, and a Monokuma's
        // Despair roll was feeding its own controller's pool.
        if (isMonokuma(actor)) {
            debug(`${actor.name} is a Monokuma; rolls do not grant Hope or feed a Despair pool.`);
            return;
        }

        // A crit is worth 2 Hope in this game; Daggerheart pays 1. This is
        // independent of the "rolls grant Despair" setting below — that setting
        // is about the DM's currency, not the player's, and turning off Despair
        // must not silently take back half of every critical's Hope.
        if (outcome.isCritical) await topUpCritHope(actor);

        if (!outcome.withFear) return;
        if (!game.settings.get(MODULE_ID, SETTINGS.despairFromRolls)) return;

        const monokuma = monokumaFor(actor);
        if (!monokuma) return;

        const before = getDespair(monokuma.id);
        if (before >= despairMax()) {
            debug(`${monokuma.name} is already at maximum Despair; the roll granted nothing.`);
            return;
        }

        await adjustDespair(monokuma.id, 1);
        debug(`${actor.name} rolled with Despair -> +1 to ${monokuma.name} (${before + 1}/${despairMax()}).`);
    } catch (err) {
        error("Could not award Despair from a roll", err);
    }
}

/**
 * Pay the second point of Hope a critical is worth.
 *
 * Guide: "A crit gives the player +2 hope." Daggerheart's own duality pipeline
 * pushes `{ key: 'hope', value: 1 }` on a critical (plus a Sanity clear), so one
 * point is already in place by the time this runs and only the difference is
 * owed.
 */
async function topUpCritHope(actor) {
    return adjustCritHopeTopUp(actor, 1);
}

/**
 * Apply or reverse this module's +1 crit top-up, by a signed delta.
 *
 * Exported so Reroll can use the same logic: rerolling rewrites the existing
 * chat message with `message.update()` rather than creating a new one, so it
 * never runs through `onChatMessage` below and the top-up would otherwise never
 * apply to a roll that becomes a crit on its second try — nor get reversed when
 * a crit stops being one.
 *
 * Clamped to [0, max] so neither direction overflows or goes negative.
 */
export async function adjustCritHopeTopUp(actor, delta) {
    if (!actor || !delta) return;
    try {
        const { STARTING } = await import("./config.mjs");
        const { automatedUpdate } = await import("./resource-guard.mjs");

        const hope = actor.system?.resources?.hope;
        const held = hope?.value ?? 0;
        const max = hope?.max || STARTING.hopeMax;
        const next = Math.min(max, Math.max(0, held + delta));
        if (next === held) return;

        await automatedUpdate(actor, { "system.resources.hope.value": next });
        debug(`${actor.name}: crit top-up ${delta > 0 ? "paid" : "reversed"}, now ${next}/${max}.`);
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
 * getter that resolves by `instanceof DualityRoll` — which can come back null
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
 * The actor a chat message came from. Trait rolls, action rolls and item rolls
 * all identify their actor differently, so every route is tried.
 */
function resolveActor(message) {
    const speaker = message?.speaker;

    if (speaker?.actor) {
        const actor = game.actors.get(speaker.actor);
        if (actor) return actor;
    }

    if (speaker?.token && speaker?.scene) {
        const scene = game.scenes.get(speaker.scene);
        const token = scene?.tokens?.get(speaker.token);
        if (token?.actor) return token.actor;
    }

    // Daggerheart records the originating actor as a UUID on action rolls.
    const sourceUuid = message?.system?.source?.actor;
    if (sourceUuid) {
        const doc = fromUuidSync(sourceUuid);
        const actor = doc?.documentName === "Actor" ? doc : doc?.actor ?? null;
        if (actor) return actor;
    }

    // Finally, the rolling user's own character.
    const user = game.users.get(message?.author?.id ?? message?.user?.id);
    return user?.character ?? null;
}
