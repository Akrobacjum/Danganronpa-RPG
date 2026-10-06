/**
 * Danganronpa RPG - character helpers.
 * ---------------------------------------------------------------------------
 * Daggerheart derives a character's max Health from their class. We have no
 * classes, so the starting resources from the guide have to be written onto
 * the actor directly: Health 4, Sanity 6, Hope 2.
 *
 * Max Hope (6) and the GM's max Despair (12) already default to exactly the
 * guide's numbers in Daggerheart's homebrew settings, so they are left alone.
 */

import { MODULE_ID, FLAGS, STARTING, TRAITS, TRAIT_ARRAY } from "./config.mjs";
import { log, plural } from "./utils.mjs";
import { moduleLanguage } from "./settings.mjs";

/**
 * Does this character still need the starting maxima?
 *
 * BELOW the starting numbers, not different from them (17.09, SEASON-01). A Level Up
 * writes +1 Health or +1 Sanity onto the maximum, so strict equality called every
 * advanced student "not set up": the season checklist listed them, the sheet offered
 * its set-up wand, and one Do it put the maximum back to the start, zeroed the damage,
 * reset Hope and re-stamped the season's baseline - the advance gone without a word.
 * Reproduced on 16.09 with Health max 5. One predicate for the three places that ask.
 *
 * With it, a repair only ever reaches a sheet below the starting numbers - never set
 * up, or reset by Daggerheart's own Reset Character - and re-stamping the season's
 * baseline is right for exactly those.
 */
export function needsStartingResources(actor) {
    return resourceMax(actor, "hitPoints") < STARTING.hp
        || resourceMax(actor, "stress") < STARTING.stress;
}

/**
 * Give an actor the guide's starting resources. Safe to re-run; it only
 * writes the fields it owns.
 *
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.resetValues]  Also refill Health/Sanity and reset Hope.
 * @param {string|null} [options.startingItem]  Name of the Tier 2 item this
 *   student begins with. The guide gives everybody one - "rozpoczyna grę z
 *   jednym przedmiotem Tier 2 związanym z jego Ultimate" - and in the same
 *   breath says it is "do uzgodnienia z każdym graczem z osobna". So it is a
 *   parameter rather than a table: the module cannot invent an object that is
 *   meaningfully tied to "Ultimate Baseballista", and should not pretend to.
 *   Omitted, nothing is granted and the GM is reminded.
 */
export async function initCharacter(actor, {
    resetValues = true, startingItem = null, quiet = false
} = {}) {
    /* A GM'S, BEFORE ANY WRITE (E29 C2, 05.10.2026; audit S03-45). This writes the maxima,
       Health, Sanity and Hope, grants the opening item and stamps the season's baseline, and it
       is on `game.drpg` - the sheet's wand is drawn only for a GM, but the function behind it
       answered any console that called it on a character it owns. The same gate as
       `applyAdvancement`: with it, every road that writes a student's traits or Health and
       Sanity maxima is a GM's (this, `restoreStartingSheet` and `applyAdvancement` are the
       only module code that writes those paths - grepped 05.10.2026). R221 reads that the gate
       comes before the first write here and in `restoreStartingSheet`. A console that writes
       those paths by hand is put back by the primary GM since E29 C3 (sheet-audit.mjs). */
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
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

    // Through the one road, named `setup` (E29 C1). Until E29 C2 this comment said the
    // road was there for a player pressing the wand on their own sheet, whose plain
    // `update()` the resource guard would have half-stripped; the wand was a GM's even
    // then, and the gate above makes the whole function one, where the guard stands aside.
    const { trustedWrite } = await import("./resource-guard.mjs");
    await trustedWrite(actor, update, { reason: "setup" });

    // The Tier 2 opening item, when one was agreed.
    //
    // `override: true` on purpose: this is the GM writing down something the two
    // of them settled before the season, not a Search result, so the carry cap
    // must not silently drop it. It is granted once - re-running `initCharacter`
    // without a name leaves whatever they already have alone.
    if (startingItem) {
        const { grantItem } = await import("./inventory.mjs");
        await grantItem(actor, {
            reason: "setup",
            name: startingItem,
            category: "usable",
            tier: STARTING.startingItemTier,
            override: true,
            description: game.i18n.format("DRPG.Character.startingItemNote", {
                ultimate: actor.getFlag(MODULE_ID, FLAGS.ultimate) || "-"
            })
        });
        log(`${actor.name} starts with "${startingItem}" (Tier ${STARTING.startingItemTier}).`);
    } else if (game.user.isGM && !quiet) {
        // Worth saying once, from the season checklist. Said once per student
        // during a reset, it is a wall of notices about something the reset was
        // not asked to do.
        ui.notifications.warn(game.i18n.localize("DRPG.Character.startingItemMissing"));
    }

    // What this sheet looks like now, so a season reset has something to come
    // back to. See `restoreStartingSheet`.
    await stampStartingSheet(actor);

    log(`Initialised ${actor.name}: Health ${STARTING.hp}, Sanity ${STARTING.stress}, Hope ${STARTING.hope}.`);
    return actor;
}

/**
 * Write down the spread a character begins with.
 *
 * Traits and experiences are the one part of a character this module never
 * writes on its own - they are settled in conversation with the GM, and
 * `validateTraitSpread` only ever reports on them. Advancement is the
 * exception: it adds `+delta` to both and bumps `FLAGS.advances`.
 *
 * That leaves a season reset with nothing to restore and two bad choices -
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
 * existed then, and clears the advance counter - those three move together, and
 * clearing one without the others is what leaves a sheet arguing with itself.
 *
 * Experiences ADDED by an advance keep their names and whatever value they
 * hold. An experience is a sentence about who somebody is, which puts it on the
 * far side of the line this reset draws - the same side as the portrait and the
 * Ultimate. Their values are not restored because there is nothing to restore
 * them to; they did not exist on day one.
 *
 * A character never run through `initCharacter` has no record, and gets no
 * silent guess: the caller is told nothing was restored and says so in the log.
 */
export async function restoreStartingSheet(actor) {
    // A GM's, before any write - the advance counter below is the first (E29 C2; see `initCharacter`).
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
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
        // The one road, named `setup`. Not for the resource guard: it strips a
        // player's trait writes on the player's own browser, and this runs on a GM's.
        const { trustedWrite } = await import("./resource-guard.mjs");
        await trustedWrite(actor, update, { reason: "setup" });
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
 * Remaining Health/Sanity. Both are reverse resources, so "how much is left" is
 * max minus marks.
 *
 * FOR RULES, NOT FOR SCREENS (W-1, Dawid 16.09). The sheet, and Daggerheart,
 * count marks UP: 0/6 is untouched and 6/6 is the wound. Three places used to
 * print this number instead, so the same victim read "2 Health left" in the
 * incident tracker and "4/6" on their own sheet, and a GM reading both had to
 * subtract to know which way either was going. Use `marksOf` for anything a
 * person reads; this stays for the thresholds that are about what is left.
 */
export function remaining(actor, key) {
    return resourceMax(actor, key) - resourceValue(actor, key);
}

/** Marks over maximum, the way the sheet shows them: `2/6` (W-1). */
export function marksOf(actor, key) {
    return `${resourceValue(actor, key)}/${resourceMax(actor, key)}`;
}

/** True when the character has taken every point of Sanity (Daggerheart: vulnerable). */
export function isBrokenDown(actor) {
    return remaining(actor, "stress") <= 0;
}

/** True when the character has taken every point of Health. */
export function isWounded(actor) {
    return remaining(actor, "hitPoints") <= 0;
}

/* ==========================================================================
 * RESERVE
 * --------------------------------------------------------------------------
 * What is LEFT of Health and Sanity, and what a change to it came to (E32+E07 C7,
 * 28.09.2026; the owner's D5, design N5, audit S04-05). Daggerheart stores both as
 * marks counted up; the table talks about what a character has left. The notes a hit
 * wrote read the marks' side: "Aiko takes 1 STRESS" - the system's key in capitals -
 * for a hit that landed nothing on a full Sanity, and the drain said the amount asked
 * for, not the amount marked. Everything that moves a reserve and says so asks here
 * now: what landed, what could not (`overflow`, which the incident puts on Health), and
 * the sentence, with a label from the language file. This stage builds what the
 * incident's notes need; the sheet, the Event panel and the tracker still show marks
 * (`marksOf`) until E24/E25 move them onto it.
 * ========================================================================== */

/** The two reserves, by their resource key: the one place that knows `stress` means Sanity. */
export const RESERVES = Object.freeze({
    hitPoints: Object.freeze({ label: "DRPG.Reserve.health" }),
    stress: Object.freeze({ label: "DRPG.Reserve.sanity" })
});

/**
 * A reserve from marks and a maximum: `{ max, marks, left, pct, empty }`. `left` is
 * held to 0..max, so a sheet edited past either end reads as empty or full rather than
 * as a negative reserve; a missing maximum is 0.
 */
export function reserveFrom(marks, max) {
    const top = Math.max(0, Number(max) || 0);
    const marked = Number(marks) || 0;
    const left = Math.min(top, Math.max(0, top - marked));
    return { max: top, marks: marked, left, pct: top ? left / top * 100 : 0, empty: left <= 0 };
}

/** An actor's reserve of `key` (`hitPoints` or `stress`). */
export function reserveOf(actor, key) {
    return reserveFrom(resourceValue(actor, key), resourceMax(actor, key));
}

/**
 * What changing a reserve by `delta` would come to, written nowhere: a negative delta
 * is a loss, a positive one a recovery. `landed` is how much of it the reserve took
 * (never more than is left to lose or missing to regain), `overflow` the rest, and
 * `update` the actor update that makes it so - empty when nothing landed. `key` comes
 * back with it, for `reserveNote`.
 */
export function reserveChange(actor, key, delta, held = null) {
    const want = Math.trunc(Number(delta) || 0);
    // `held`, `{ marks, max }`: the reserve as a caller read it in the GMs' job (murder.mjs `takeReserves`, E29 fix r2-H24).
    const { max, left } = held ? reserveFrom(held.marks, held.max) : reserveOf(actor, key);
    const landed = want < 0 ? Math.min(left, -want) : Math.min(max - left, want);
    const after = want < 0 ? left - landed : left + landed;
    return {
        key,
        update: landed ? { [`system.resources.${key}.value`]: max - after } : {},
        landed,
        overflow: Math.abs(want) - landed
    };
}

/**
 * The sentence for what a loss came to: "You lose 1 Health and 1 Sanity." for the one
 * it happened to (`you`), "{name} loses ..." for everyone else - `name` as it is to be
 * printed, escaped by the caller. `changes` are `reserveChange` results (or `{ key,
 * landed }`); one that landed nothing is left out, and nothing landed at all is "".
 * Losses only: nothing in this stage says a recovery through it (E24 adds that).
 */
export function reserveNote({ name = "", you = false } = {}, changes = []) {
    const parts = changes
        .filter(change => RESERVES[change?.key] && change.landed > 0)
        .map(change => plural(RESERVES[change.key].label, { n: change.landed }));
    if (!parts.length) return "";
    let what;
    try {
        what = new Intl.ListFormat(moduleLanguage(), { type: "conjunction" }).format(parts);
    } catch {
        // No ListFormat for the tag: the English list reads, and the amounts stay right.
        what = parts.join(", ");
    }
    return you
        ? game.i18n.format("DRPG.Murder.youLose", { what })
        : game.i18n.format("DRPG.Murder.theyLose", { name, what });
}

/**
 * Whether the trait spread matches the guide's array (+2, +1, +1, 0, 0, -1).
 * Character creation is a conversation with the GM, not a wizard, so this only
 * reports - it never blocks.
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
