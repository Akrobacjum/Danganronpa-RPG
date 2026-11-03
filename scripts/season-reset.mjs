/**
 * Danganronpa RPG - the registry of a season's state.
 * ---------------------------------------------------------------------------
 * Every owner of something a season reset clears registers it here, at its
 * module's top level: the group of the reset's window it belongs to, what the
 * window counts of it (`tally`), how it is cleared (`clear`) and what an
 * unticked group still does (`keep`). The reset (season-setup.mjs `wipeSeason`)
 * walks these entries in its order, `RESET_STEPS`, and its window draws its
 * counts from the same entries - one place for what goes, where until E42 the
 * reset held a run per group in its own body and the window a hand list of
 * counts beside it (audit S17-30: "each new feature must remember the reset").
 * A group with no entry here is a red test (R1254), not a tick that silently
 * clears nothing.
 *
 * D36 = option 2 (the owner): the season's state is everything the reset clears,
 * the students' assignment to the Monokumas among it (its entry is E42 C4's);
 * what a campaign builds - its name, the scenes' roles, Room Setup, the item
 * tables, the theme and the enforced settings, the remembered exceptions - is
 * kept by every reset and has no entry.
 *
 * The amends of the plan, each here: A7 - the notice history is client state,
 * cleared by the epoch's fingerprint (notice-history.mjs `EPOCH_GROUPS` over
 * the reset's cuts), so its entry only describes (`describes`) and has no
 * tally and no clear: a GM neither sees nor clears the players' histories.
 * A10 - the passages group is passages-gm.mjs's entry, after the Mastermind's
 * in the order, and its clear gives every project's breach its wall back
 * before it takes anything of its own. E70 - the trial's record is
 * trial-progress.mjs's entry, written whole in a step of its key. E51 - a GM
 * store's group is read off the store table (gm-stores.mjs `resetGroup`), and
 * the reset's cut takes it; an entry does not list its stores a second time.
 *
 * A LEAF, like bridge-guards.mjs. This file imports season-exceptions.mjs (the
 * groups) and nothing else, and the static closure of what it may import -
 * config.mjs, utils.mjs, settings.mjs and season-exceptions.mjs - holds no
 * owner of season state, so every owner imports it statically without closing
 * a cycle (R161), and registers before `init` (R1254 holds both). An owner
 * that could not reach it without a cycle would register from another file of
 * its role, never through `import()` at load: an entry registered late is a
 * reset that ran without it.
 *
 * NO ENTRY ARGUES ITS OWN GUARD (E42 fix FG3; the end review's S-M5): the walk runs on the primary GM alone and stops
 * before any step once this browser is no longer it (season-wipe.mjs `wipeSeason`'s `stop`), so an entry has no
 * `primaryOnly` of its own - the key, kept until the fix and read by nothing, is refused (R1258).
 *
 * Every `clear`, `tally` and `keep` is a named top-level function of its
 * owner's file, handed by name: the census tests read the writes by the
 * function that holds them (R191, R220, R311, R346, R1020), and a function
 * declared inline in the registration would be nobody's. Each clear reads its
 * target from the world as it stands, so a clear run a second time finds
 * nothing left and writes nothing.
 */

import { RESET_GROUPS } from "./season-exceptions.mjs";

/** The groups an entry may name: the reset window's, and nothing else. */
const GROUPS = new Set(RESET_GROUPS.map(group => group.key));

/** The entries by group, and the descriptive ones by what they describe, as registered. */
const ENTRIES = new Map();
const DESCRIBED = new Map();

/**
 * Register what a season holds of one owner (at the owner's top level).
 *
 * - `group`: a key of `RESET_GROUPS`; a second entry for a group throws. `null` with `describes` (a name) is a
 *   descriptive entry: a line in the window and nothing else - it takes no tally, no clear and no keep.
 * - `label`: the translation key of the entry's line; a group's defaults to its tick's (`DRPG.Season.group.<key>`).
 * - `clear(ctx)`: clears the group on the primary GM. `ctx` is the reset's: `{ plan, everyStudent(key), left,
 *   stayed }` - a cast group's part on each student's sheet stays the reset's own (`wipeStudent`) and is reached
 *   through `ctx.everyStudent`, so no owner imports the reset. What it answers is not read: a throw is its failure.
 * - `tally()`: the lines the window's row shows (each a `plural()` of the group's), or []; none, no count.
 * - `keep(ctx)`: what an unticked group still does (the Key Remnant plan's trim), before the clock's step.
 * - `settings`: the world settings the entry clears (E42 C4's lifetimes read it).
 * A registration naming `primaryOnly` throws (the header's last paragraph): the one key this checks for being there at all.
 */
export function registerSeasonState(spec = {}) {
    if (spec && Object.hasOwn(spec, "primaryOnly")) {
        throw new Error("A season state entry names primaryOnly, which the registry does not take: the walk is the primary GM's for every entry");
    }
    const { group = null, label = null, tally = null, clear = null, keep = null, settings = [], describes = null } = spec ?? {};
    const named = (what, fn) => {
        if (fn !== null && typeof fn !== "function") throw new Error(`A season state entry's ${what} is not a function`);
    };
    named("tally", tally);
    named("clear", clear);
    named("keep", keep);
    if (group === null || group === undefined) {
        if (typeof describes !== "string" || !describes) {
            throw new Error("A season state entry names no reset group and describes nothing");
        }
        if (DESCRIBED.has(describes)) throw new Error(`A second season state entry describes "${describes}"`);
        if (tally || clear || keep) throw new Error(`The descriptive season state entry "${describes}" counts or clears something`);
        const entry = { group: null, describes, label, tally: null, clear: null, keep: null, settings: Object.freeze([]) };
        DESCRIBED.set(describes, entry);
        return entry;
    }
    if (!GROUPS.has(group)) throw new Error(`A season state entry names the reset group "${group}", which the window does not offer`);
    if (ENTRIES.has(group)) throw new Error(`A second season state entry for the reset group "${group}"`);
    if (!clear) throw new Error(`The season state entry for the reset group "${group}" clears nothing`);
    const entry = { group, describes: null, label: label ?? `DRPG.Season.group.${group}`, tally, clear, keep,
        settings: Object.freeze([...(settings ?? [])].map(String)) };
    ENTRIES.set(group, entry);
    return entry;
}

/**
 * The entries in the order handed (the reset hands `RESET_STEPS`; a key with no entry is left out), else in the
 * window's order (`RESET_GROUPS`), the descriptive entries last.
 */
export function seasonStateEntries(order = null) {
    const keys = Array.isArray(order) ? order : RESET_GROUPS.map(group => group.key);
    return [...keys.map(key => ENTRIES.get(key)).filter(Boolean), ...DESCRIBED.values()];
}

/** The entry of one reset group, or null. */
export function seasonStateFor(group) {
    return ENTRIES.get(group) ?? null;
}

/**
 * A clear stored in several places tries each part (E11 C9's `each`): one that throws - a setting an older world
 * never registered - does not keep the others, and the clear fails with the first throw once every part was tried.
 */
export async function everyPart(...parts) {
    let failure = null;
    for (const part of parts) {
        try {
            await part();
        } catch (err) {
            failure ??= err;
        }
    }
    if (failure) throw failure;
}

/** The lifetimes a world setting may have (settings.mjs `WORLD_LIFETIMES`). */
export const LIFETIMES = Object.freeze(["season", "campaign", "table"]);

/**
 * WHAT THE LIFETIMES SAY AGAINST THE REGISTRY (E42 C4, 1.2.97; E42-16; D36 = option 2). Pure: `registered` is the
 * module's world settings by key, `lifetimes` settings.mjs `WORLD_LIFETIMES` (key -> lifetime) and `entries` this
 * registry's (`seasonStateEntries()`). Answers a sentence per fault, [] for none: a registered setting with no
 * lifetime, a lifetime that is none of `LIFETIMES`, a tag for a setting nobody registers, a season setting no entry
 * clears or more than one entry clears, and an entry that clears a setting the reset keeps (campaign or table). Tier 0
 * R1256 reads it on a planted world first, then on the module's.
 */
export function lifetimeProblems({ registered = [], lifetimes = {}, entries = [] } = {}) {
    const out = [];
    const known = new Set(registered);
    const clearing = new Map();
    for (const entry of entries) {
        if (!entry?.group) continue;
        for (const key of entry.settings ?? []) clearing.set(key, [...(clearing.get(key) ?? []), entry.group]);
    }
    for (const key of registered) if (!Object.hasOwn(lifetimes, key)) out.push(`${key}: no lifetime`);
    for (const [key, lifetime] of Object.entries(lifetimes)) {
        if (!LIFETIMES.includes(lifetime)) out.push(`${key}: its lifetime "${lifetime}" is none of ${LIFETIMES.join(", ")}`);
    }
    for (const key of Object.keys(lifetimes)) if (!known.has(key)) out.push(`${key}: tagged, and the module registers no such world setting`);
    for (const [key, lifetime] of Object.entries(lifetimes)) {
        const groups = clearing.get(key) ?? [];
        if (lifetime === "season" && !groups.length) out.push(`${key}: a season setting no entry of the registry clears`);
        else if (lifetime === "season" && groups.length > 1) out.push(`${key}: a season setting ${groups.length} entries clear (${groups.join(", ")})`);
        else if (lifetime !== "season" && LIFETIMES.includes(lifetime) && groups.length) {
            out.push(`${key}: a ${lifetime} setting, and the entry "${groups.join(", ")}" clears it`);
        }
    }
    return out;
}
