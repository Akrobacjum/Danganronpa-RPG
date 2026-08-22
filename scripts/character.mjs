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

import { MODULE_ID, FLAGS, STARTING, TRAITS, TRAIT_ARRAY } from "./config.mjs";
import { log } from "./utils.mjs";

/**
 * Give an actor the guide's starting resources. Safe to re-run; it only
 * writes the fields it owns.
 *
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.resetValues]  Also refill HP/Stress and reset Hope.
 * @param {string|null} [options.startingItem]  Name of the Tier 2 item this
 *   student begins with. The guide gives everybody one — "rozpoczyna grę z
 *   jednym przedmiotem Tier 2 związanym z jego Ultimate" — and in the same
 *   breath says it is "do uzgodnienia z każdym graczem z osobna". So it is a
 *   parameter rather than a table: the module cannot invent an object that is
 *   meaningfully tied to "Ultimate Baseballista", and should not pretend to.
 *   Omitted, nothing is granted and the GM is reminded.
 */
export async function initCharacter(actor, { resetValues = true, startingItem = null } = {}) {
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

    // Through the automation channel, not a bare update. HP and Stress became
    // GM-only in 1.0.1, and this writes both — so a plain `update()` from a
    // player pressing the set-up wand on their own sheet would be stripped by
    // the guard and the character would come out with the maxima set and the
    // values untouched. Setting a character up IS automation; it just happens to
    // be the kind a human presses a button for.
    const { automatedUpdate } = await import("./resource-guard.mjs");
    await automatedUpdate(actor, update);

    // The Tier 2 opening item, when one was agreed.
    //
    // `override: true` on purpose: this is the GM writing down something the two
    // of them settled before the season, not a Search result, so the carry cap
    // must not silently drop it. It is granted once — re-running `initCharacter`
    // without a name leaves whatever they already have alone.
    if (startingItem) {
        const { grantItem } = await import("./inventory.mjs");
        await grantItem(actor, {
            name: startingItem,
            category: "usable",
            tier: STARTING.startingItemTier,
            override: true,
            description: game.i18n.format("DRPG.Character.startingItemNote", {
                ultimate: actor.getFlag(MODULE_ID, FLAGS.ultimate) || "—"
            })
        });
        log(`${actor.name} starts with "${startingItem}" (Tier ${STARTING.startingItemTier}).`);
    } else if (game.user.isGM) {
        ui.notifications.info(game.i18n.localize("DRPG.Character.startingItemMissing"));
    }

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
