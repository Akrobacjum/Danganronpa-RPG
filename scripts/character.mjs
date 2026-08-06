/**
 * Danganronpa RPG — character helpers.
 * ---------------------------------------------------------------------------
 * Daggerheart derives a character's max HP from their class. We have no
 * classes, so the starting resources from the guide have to be written onto
 * the actor directly: HP 4, Stress 6, Hope 2.
 *
 * Max Hope (6) and the GM's max Despair (12) already default to exactly the
 * guide's numbers in Daggerheart's homebrew settings, so they are left alone.
 */

import { STARTING, TRAITS, TRAIT_ARRAY } from "./config.mjs";
import { log } from "./utils.mjs";

/**
 * Give an actor the guide's starting resources. Safe to re-run; it only
 * writes the fields it owns.
 *
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.resetValues]  Also refill HP/Stress and reset Hope.
 */
export async function initCharacter(actor, { resetValues = true } = {}) {
    if (!actor || actor.type !== "character") {
        ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
        return null;
    }

    const update = {
        "system.resources.hitPoints.max": STARTING.hp,
        "system.resources.stress.max": STARTING.stress
    };

    if (resetValues) {
        // hitPoints and stress are `reverse: true` resources: 0 means unharmed
        // and value counts up toward max as the character takes damage.
        update["system.resources.hitPoints.value"] = 0;
        update["system.resources.stress.value"] = 0;
        update["system.resources.hope.value"] = STARTING.hope;
    }

    await actor.update(update);
    log(`Initialised ${actor.name}: HP ${STARTING.hp}, Stress ${STARTING.stress}, Hope ${STARTING.hope}.`);
    return actor;
}

/** Effective max of a resource, accounting for Daggerheart's nullable max. */
export function resourceMax(actor, key) {
    return actor?.system?.resources?.[key]?.max ?? 0;
}

/** Current value of a resource. */
export function resourceValue(actor, key) {
    return actor?.system?.resources?.[key]?.value ?? 0;
}

/**
 * Remaining HP/Stress as the players read it on the sheet. Both are reverse
 * resources, so "how much is left" is max minus marks.
 */
export function remaining(actor, key) {
    return resourceMax(actor, key) - resourceValue(actor, key);
}

/** True when the character has taken every point of Stress (Daggerheart: vulnerable). */
export function isBrokenDown(actor) {
    return remaining(actor, "stress") <= 0;
}

/** True when the character has taken every point of HP. */
export function isWounded(actor) {
    return remaining(actor, "hitPoints") <= 0;
}

/**
 * Whether the trait spread matches the guide's array (+2, +1, +1, 0, 0, -1).
 * Character creation is a conversation with the GM, not a wizard, so this only
 * reports — it never blocks.
 */
export function validateTraitSpread(actor) {
    const values = Object.values(TRAITS)
        .map(t => actor?.system?.traits?.[t.dh]?.value ?? 0)
        .sort((a, b) => b - a);
    const expected = [...TRAIT_ARRAY].sort((a, b) => b - a);
    const ok = values.length === expected.length && values.every((v, i) => v === expected[i]);
    return { ok, actual: values, expected };
}

/** Experiences as a plain array, with their object keys attached. */
export function listExperiences(actor) {
    const experiences = actor?.system?.experiences ?? {};
    return Object.entries(experiences).map(([id, data]) => ({ id, ...data }));
}
