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
export async function initCharacter(actor, {
    resetValues = true, startingItem = null, quiet = false
} = {}) {
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
    } else if (game.user.isGM && !quiet) {
        // Worth saying once, from the season checklist. Said once per student
        // during a reset, it is a wall of notices about something the reset was
        // not asked to do.
        ui.notifications.info(game.i18n.localize("DRPG.Character.startingItemMissing"));
    }

    // What this sheet looks like now, so a season reset has something to come
    // back to. See `restoreStartingSheet`.
    await stampStartingSheet(actor);

    log(`Initialised ${actor.name}: HP ${STARTING.hp}, Stress ${STARTING.stress}, Hope ${STARTING.hope}.`);
    return actor;
}

/**
 * Write down the spread a character begins with.
 *
 * Traits and experiences are the one part of a character this module never
 * writes on its own — they are settled in conversation with the GM, and
 * `validateTraitSpread` only ever reports on them. Advancement is the
 * exception: it adds `+delta` to both and bumps `FLAGS.advances`.
 *
 * That leaves a season reset with nothing to restore and two bad choices —
 * zero the counter and leave the bonuses, so the sheet says "no advances" over
 * advanced numbers, or re-deal `TRAIT_ARRAY` and scramble a spread the player
 * chose. This is the third choice, and it is the same one Room Setup makes for
 * locks: record the opening state next to the current one.
 */
async function stampStartingSheet(actor) {
    const traits = {};
    for (const trait of Object.values(TRAITS)) {
        traits[trait.dh] = actor.system?.traits?.[trait.dh]?.value ?? 0;
    }

    const experiences = {};
    for (const [id, entry] of Object.entries(actor.system?.experiences ?? {})) {
        experiences[id] = entry?.value ?? 0;
    }

    await actor.setFlag(MODULE_ID, FLAGS.sheetAtStart, { traits, experiences, at: Date.now() });
}

/**
 * Put a character back to the sheet they started the season on.
 *
 * Restores the recorded trait spread and the values of the experiences that
 * existed then, and clears the advance counter — those three move together, and
 * clearing one without the others is what leaves a sheet arguing with itself.
 *
 * Experiences ADDED by an advance keep their names and whatever value they
 * hold. An experience is a sentence about who somebody is, which puts it on the
 * far side of the line this reset draws — the same side as the portrait and the
 * Ultimate. Their values are not restored because there is nothing to restore
 * them to; they did not exist on day one.
 *
 * A character never run through `initCharacter` has no record, and gets no
 * silent guess: the caller is told nothing was restored and says so in the log.
 */
export async function restoreStartingSheet(actor) {
    if (!actor || actor.type !== "character") return null;

    const snapshot = actor.getFlag(MODULE_ID, FLAGS.sheetAtStart);
    const hadAdvances = Number(actor.getFlag(MODULE_ID, FLAGS.advances) ?? 0);
    await actor.setFlag(MODULE_ID, FLAGS.advances, 0);

    if (!snapshot?.traits) return { restored: false, advances: hadAdvances };

    const update = {};
    for (const [key, value] of Object.entries(snapshot.traits)) {
        update[`system.traits.${key}.value`] = value;
    }
    for (const [id, value] of Object.entries(snapshot.experiences ?? {})) {
        if (actor.system?.experiences?.[id]) update[`system.experiences.${id}.value`] = value;
    }

    if (Object.keys(update).length) {
        // `system.traits` is guarded against hand-editing, so a plain update
        // would have the trait writes stripped and the rest go through — the
        // same half-application `applyAdvancement` guards against.
        const { automatedUpdate } = await import("./resource-guard.mjs");
        await automatedUpdate(actor, update);
    }

    return { restored: true, advances: hadAdvances };
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
