/**
 * Danganronpa RPG - what a season reset is allowed to keep.
 * ---------------------------------------------------------------------------
 * R-1 (Dawid, 18.09): "W reset sezonu pozwolmy zachowac wyjatki od resetu.
 * Dowolne wyjatki, wybrane przez game mastera."
 *
 * The reset used to be one button and one typed word: everything this module had
 * written about a season went, in one pass, and a GM who wanted to keep the cast's
 * advancement or last season's traces had no answer except not pressing it. Every
 * step of the wipe is now a GROUP with a tick of its own, and an unticked group is
 * an exception - the reset leaves it exactly as it is.
 *
 * ONE ROW PER STEP, and that is the invariant a test holds: a step nobody named
 * here would be ungated, and the GM's tick would silently not apply to it. The
 * order is the order the wipe runs in, so the window reads like what is about to
 * happen rather than like a settings page.
 *
 * THE EXCEPTIONS ARE REMEMBERED, AND THEY COME BACK UNTICKED (Dawid, 18.09:
 * "Okno resetu ma pamietac wyjatki, ale pozwalac je odznaczyc. Domyslnie
 * znikac"). A table that keeps its advancement between seasons keeps it every
 * time without re-deciding; a GM who changes their mind ticks the box and it goes.
 * Anything this file learns to clear LATER starts ticked, because a new group
 * nobody has excepted is part of the reset.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { debug } from "./utils.mjs";

/**
 * The five parts of a season, in the order the wipe clears them.
 *
 * Sections are for the window only - a list of twenty-six ticks with no headings
 * is a list nobody reads to the end.
 */
export const RESET_SECTIONS = ["case", "cast", "board", "log", "world"];

/**
 * Every group the reset can clear, and nothing else.
 *
 * `key` is what the plan carries and what the memory stores, so renaming one
 * silently drops a table's exception - which is why the keys read like the thing
 * rather than like the step.
 */
export const RESET_GROUPS = [
    { key: "remnants", section: "case" },
    { key: "bullets", section: "case" },
    { key: "incident", section: "case" },
    { key: "trialFloor", section: "case" },
    { key: "trialProgress", section: "case" },
    { key: "keyPlan", section: "case" },
    { key: "searchTokens", section: "case" },
    { key: "discovered", section: "case" },
    { key: "bodyFound", section: "case" },

    { key: "deaths", section: "cast" },
    { key: "items", section: "cast" },
    { key: "advancement", section: "cast" },
    { key: "actions", section: "cast" },
    { key: "preNotes", section: "cast" },
    { key: "sheetNotes", section: "cast" },
    /* 1.2.47 added this step ("I have found X's hiding place" was cleared by
       nothing) after this table was written, and the merge brought the step
       without the row. `step` runs only what the plan names, so until the row
       existed the reset silently stopped clearing it - see R50. */
    { key: "stashesFound", section: "cast" },

    { key: "projects", section: "board" },
    { key: "mastermind", section: "board" },
    { key: "seals", section: "board" },
    { key: "motive", section: "board" },
    { key: "rules", section: "board" },
    { key: "doors", section: "board" },
    { key: "eclipseMoves", section: "board" },
    // The same story: a standing assembly order, cleared by 1.2.47's reset so a
    // new season does not gather its cast into last season's room.
    { key: "assembly", section: "board" },

    { key: "cards", section: "log" },
    { key: "chatRest", section: "log" },

    { key: "despair", section: "world" },
    { key: "overflow", section: "world" },
    { key: "clock", section: "world" }
];

/** Every key, for bounding whatever comes back out of the setting. */
const KNOWN = new Set(RESET_GROUPS.map(group => group.key));

/** The label a row shows. */
export function groupLabel(key) {
    return game.i18n.localize(`DRPG.Season.group.${key}`);
}

/** The heading a section shows. */
export function sectionLabel(section) {
    return game.i18n.localize(`DRPG.Season.section.${section}`);
}

/**
 * The exceptions the last reset was given, as a Set of group keys.
 *
 * Bounded on the way out: a key this version no longer knows is dropped rather
 * than carried into a plan, so a group renamed in a later release cannot leave a
 * world with an exception nothing can untick.
 */
export function rememberedExceptions() {
    let stored = [];
    try {
        stored = game.settings.get(MODULE_ID, SETTINGS.seasonExceptions) ?? [];
    } catch (err) {
        debug("No remembered season exceptions yet", err);
        return { keys: new Set(), dropped: 0 };
    }
    const list = Array.isArray(stored) ? stored : [];
    const keys = new Set(list.filter(key => KNOWN.has(key)));
    return { keys, dropped: list.length - keys.size };
}

/**
 * Remember this reset's exceptions.
 *
 * Written AFTER the word is accepted and BEFORE the wipe runs: everything stored
 * here is by definition what the wipe is about to leave alone, so nothing the
 * wipe does can lose it.
 */
export async function rememberExceptions(keys) {
    if (!game.user.isGM) return null;
    const list = [...new Set([...(keys ?? [])].filter(key => KNOWN.has(key)))];
    return game.settings.set(MODULE_ID, SETTINGS.seasonExceptions, list);
}

/**
 * Turn what the window was given into the plan the wipe reads.
 *
 * `groups` is what will be cleared; `keep` is the exceptions, in table order so
 * the log and the memory line read the same way twice running.
 */
export function planFrom(ticked) {
    const wanted = new Set([...(ticked ?? [])].filter(key => KNOWN.has(key)));
    return {
        groups: wanted,
        keep: RESET_GROUPS.map(group => group.key).filter(key => !wanted.has(key))
    };
}

