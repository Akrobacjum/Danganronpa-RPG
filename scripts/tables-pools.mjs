/**
 * Danganronpa RPG - item tables: their names, the pools and the draw.
 * ---------------------------------------------------------------------------
 * The guide gives one or two examples per tier and tells the GM to improvise
 * the rest. These lists are that improvisation done in advance, so a Search
 * never stalls waiting for someone to invent a mop.
 *
 * Everything here is deliberately mundane and school-shaped: the horror in a
 * killing game comes from what students do with ordinary objects.
 *
 * Installed into the world as RollTables by `installTables()`
 * (tables-editor.mjs), which the GM can then edit freely - once they exist,
 * these definitions are only a fallback.
 *
 * What lives here: a table's name and every name it has carried (`tableName`,
 * `LEGACY_PLURALS`, `LOCALIZED_PLURALS`, `LEGACY_GOAL_LABELS`,
 * `tableNameCandidates`, `classifyTableName`, `refreshTableCopy`); the tier
 * pools and a room's tables (`isTierPool`, `tierPoolOf`, `poolShapeOf`,
 * `poolNameRefusal`, `roomStockTables`, `roomTableBases` ...); the built-in
 * pools and what a usable mends (`ITEM_POOLS`, `USABLE_GOALS`,
 * `usableKindFor`); an item's roles (`POOL_ROLES`, `rolesForPoolItem`,
 * `rolesOfResult`); the draw (`DRAW_STEPS`, each step answering through
 * `resultFrom`, and `drawItem`); the tables the editor lists (`moduleTables`)
 * and the one index of every entry's name (`tableIndex`,
 * `classifyEntryName`).
 *
 * WHERE IT SITS. Moved out of tables.mjs by E41 C8 (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. tables.mjs re-exports the
 * 28 names here it exported before, so every importer still imports
 * tables.mjs, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). tools/check.mjs part `text` reads T14's legacy lists
 * (`LEGACY_PLURALS`, `LEGACY_GOAL_LABELS`) out of this file's text.
 */

import { MODULE_ID, ITEM_CATEGORIES, ITEM_TIERS, USABLE_KINDS, TABLE_NAME_WORDS, TABLE_COPY_WORDS } from "./config.mjs";
import { log, error } from "./utils.mjs";

/**
 * A category's plural and a goal's label as a NAME reads them: the English copy config.mjs froze before any language
 * was applied (`TABLE_NAME_WORDS`, E14 part 2 C1), never `ITEM_CATEGORIES.*.plural`, which a client in Polish has
 * rewritten by the time anything asks. Every name this file still builds reads these two.
 */
const pluralOf = category => TABLE_NAME_WORDS.plural[category] ?? category;
const goalWordOf = goal => (USABLE_GOALS[goal] ? TABLE_NAME_WORDS.kind[goal] ?? USABLE_GOALS[goal].label : null);

/** Table name pattern: "DRPG Usables - Tier 2", or "… (Healing) - Tier 2". The same English in every language. */
export function tableName(category, tier, goal = null) {
    const word = goalWordOf(goal);
    return `DRPG ${pluralOf(category)}${word ? ` (${word})` : ""} - Tier ${tier}`;
}

/**
 * WHAT THESE TABLES USED TO BE CALLED, and why it has to be written down.
 *
 * A table is found by NAME, and its name is built out of labels that are
 * ordinary display copy - the kind that gets reworded. Every time one was, the
 * lookup started missing a table that was sitting right there: "Crime Tools"
 * became "Murder Weapons", "Usable Items" became "Usables", and (26.08)
 * "Stress Relief" became "Sanity Relief". Measured in the QA world before this
 * was written: ZERO of the eight usable tier tables were being found, and the
 * crime tool tables none either.
 *
 * It failed silently, which is the worst part. `drawItem` falls through to the
 * built-in pools when no table answers, so a Search still produced an item -
 * just never one the GM had put in a table. Everything they curated was being
 * ignored, and `installTables` would have gone on to build a second, parallel
 * set under the new names beside the ones already there.
 *
 * So every label these names have ever carried lives here, oldest last, and
 * lookups try the current name first and then the history. Nothing is renamed
 * in anybody's world: a table the GM has been editing for a season keeps the
 * name they know it by, and a fresh world gets today's. Add to this list - do
 * not edit it - whenever a label above changes.
 */
const LEGACY_PLURALS = {
    usable: ["Usable Items", "Użytkowe"],
    crimeTool: ["Crime Tools", "Narzędzia zbrodni"],
    cleaningTool: ["Narzędzia do sprzątania"],
    tool: ["Narzędzia"]
};

/*
 * THE POLISH ONES ARE NOT OLDER WORDINGS, and that is why they are named apart (E14 part 2 C1, 24.10.2026).
 *
 * Until E14 a client whose module language was Polish built every table name out of the plural `localizeConfig` had
 * rewritten, so a world a GM in Polish installed holds "DRPG Narzędzia zbrodni - Tier 2" and "DRPG Użytkowe (Healing) -
 * Tier 1" (the goal stayed English: `USABLE_GOALS` copied its label at evaluation). Those are pl.json's plurals of
 * 272db28, the same in each of 13 revisions of pl.json read on 24.10 across its history, and they are in the lists
 * above so such a world is found. They are the GM's tables under the names that GM's client gave them, not this module's English
 * renamed: `refreshTableCopy` brings only an English wording up to date, and a table found through one of these keeps
 * its name (the owner's risk on E14: "refreshTableCopy nie może przemianować tabel GM-a").
 */
const LOCALIZED_PLURALS = new Set(["Użytkowe", "Narzędzia zbrodni", "Narzędzia do sprzątania", "Narzędzia"]);

const LEGACY_GOAL_LABELS = {
    stress: ["Stress Relief"]
};

/**
 * Every name this table could be sitting under, current one first. `{ localized: false }` leaves out the names a
 * client in Polish built (`LOCALIZED_PLURALS`): the module's own English wordings only, which `refreshTableCopy` reads.
 *
 * @returns {string[]}
 */
export function tableNameCandidates(category, tier, goal = null, { localized = true } = {}) {
    const bases = [pluralOf(category), ...(LEGACY_PLURALS[category] ?? [])]
        .filter(base => localized || !LOCALIZED_PLURALS.has(base));
    const suffixes = USABLE_GOALS[goal]
        ? [goalWordOf(goal), ...(LEGACY_GOAL_LABELS[goal] ?? [])].map(l => ` (${l})`)
        : [""];

    const names = [];
    for (const base of bases) {
        for (const suffix of suffixes) names.push(`DRPG ${base}${suffix} - Tier ${tier}`);
    }
    return names;
}

/**
 * Which table a name IS, read back off the name (TABLES-01, 20.09).
 *
 * The Tier pools tab created its table with `roomPool: true` and no category,
 * tier or goal - the same flags a ROOM pool gets - because one code path serves
 * both tabs. A GM who added a tier of their own therefore got a table the module
 * could not file: `tableIndex` put its contents under the room-pool branch, so
 * `classifyEntryName` showed every item in it unfiled, and `usableKindFor` reads
 * the goal flag, so a usable drawn from it had no kind at all - which since 26.08
 * is not cosmetic but the rules, because the kind IS what the item does.
 *
 * The name is the only thing there is to go on, and it is enough: the whole module
 * already finds its tables BY NAME (see `tableNameCandidates` and the aliases
 * above it), so asking that machinery in reverse cannot disagree with the lookup.
 *
 * THE TIER IS BOUNDED BY ITEM_TIERS. `tableNameCandidates` interpolates whatever
 * number it is handed, so an unbounded parse would happily "recognise"
 * "DRPG Tools - Tier 9" - a tier nothing draws from - and file a table under it.
 *
 * AND A GOAL ONLY EVER PAIRS WITH `usable`. The name builder appends the goal
 * suffix for any category it is given, so iterating the cross product would make
 * "DRPG Murder Weapons (Healing) - Tier 2" a legal answer. The two goals belong to
 * the usable pool and nowhere else.
 *
 * Returns `{ category, tier, goal }` with the tier as a number, or null for a name
 * this module does not own - which is not an error: a room pool's name is meant to
 * be anything the table likes.
 */
export function classifyTableName(name) {
    const text = String(name ?? "");
    const tail = text.match(/ - Tier (\d+)$/);
    if (!tail) return null;
    const tier = Number(tail[1]);
    if (!ITEM_TIERS.includes(tier)) return null;

    const shapes = [
        ...Object.keys(ITEM_POOLS).map(category => ({ category, goal: null })),
        ...Object.keys(USABLE_GOALS).map(goal => ({ category: "usable", goal }))
    ];
    for (const { category, goal } of shapes) {
        if (tableNameCandidates(category, tier, goal).includes(text)) return { category, tier, goal };
    }
    return null;
}

/**
 * THE TIER POOLS OF ONE CATEGORY, TIER AND GOAL, FOUND BY THE FLAGS THE INSTALLER WRITES (E14 part 2 C1, 24.10.2026).
 *
 * A name is a display: a GM renames a pool in the sidebar, a client in Polish built another name for the same pool
 * until E14, and the editor warns that the lookup may miss a renamed one. What `installTables` and the Tier pools tab
 * write on the table - `category`, `tier` and `goal` - says which pool it is in every language and under any name, and
 * `refreshTableCopy` has walked the tables by those flags since 26.08. A goal is matched exactly, a missing one as
 * none: a Sanity Relief pool never answers a Healing draw, and "a usable with no goal" is the old mixed pool only.
 *
 * Two tables with one set of flags (a pool duplicated in the sidebar, or the two sets one world got from a GM in each
 * language) are both returned, in a fixed order so a draw is not a coin toss between them: under today's English
 * name, then under an older or a Polish one (`tableNameCandidates`' order), then by name.
 *
 * @param {Iterable} [tables]  The tables to read; the world's by default.
 * @returns {object[]}
 */
export function flaggedTables(category, tier, goal = null, tables = game.tables ?? []) {
    const names = tableNameCandidates(category, tier, goal);
    const rank = table => { const at = names.indexOf(table.name); return at < 0 ? names.length : at; };
    return Array.from(tables)
        .filter(table => table.getFlag?.(MODULE_ID, "category") === category
            && Number(table.getFlag(MODULE_ID, "tier")) === Number(tier)
            && (table.getFlag(MODULE_ID, "goal") ?? null) === (goal ?? null))
        .sort((a, b) => (rank(a) - rank(b)) || String(a.name).localeCompare(String(b.name)));
}

/**
 * Every table that answers for this category, tier and goal: by its flags first, then by a name it could be sitting
 * under (`tableNameCandidates`) - a table the GM made in the sidebar under a pool's name carries no flags, and has
 * answered by its name since before the flags existed. Each table once. `tables` is the world's by default; a draw hands
 * its own (`drawItem`, E41 C1c).
 */
export function tierTablesFor(category, tier, goal = null, tables = game.tables) {
    const found = flaggedTables(category, tier, goal, tables ?? []);
    // Not a table whose flags name another pool (E14 fix e1-G2, 25.10.2026; the review's E14p2-R4): a Tier 2 weapons
    // pool renamed "DRPG Tools - Tier 1" in the sidebar answered a Tier 1 Tool's draw by that name, and the find was
    // a Tier 1 Murder Weapon. The module's own rename refuses that name (`renameOtherPool`); the sidebar does not.
    const another = table => {
        const own = tierPoolOf(table);
        return Boolean(own) && (own.category !== category || own.tier !== Number(tier) || (own.goal ?? null) !== (goal ?? null));
    };
    for (const name of tableNameCandidates(category, tier, goal)) {
        const table = tables?.getName?.(name);
        if (table && !found.includes(table) && !another(table)) found.push(table);
    }
    return found;
}

/** The one that actually exists in this world, if any - else today's name. */
export function existingTableName(category, tier, goal = null) {
    return tierTablesFor(category, tier, goal)[0]?.name ?? tableNameCandidates(category, tier, goal)[0];
}

/**
 * The description `installTables` writes for one table. One reader, two callers. In English on every client, from the
 * copy frozen before `localizeConfig` (config.mjs `TABLE_COPY_WORDS`, E14 fix e1-G6): it is world data every GM reads,
 * as the name is (`TABLE_NAME_WORDS`).
 */
export function tableDescription(category, tier, goal = null) {
    const W = TABLE_COPY_WORDS;
    return `${W.label[category] ?? category}${
        W.kind[goal] ? ` (${W.kind[goal]})` : ""
    }, Tier ${tier}. ${
        W.kindEffect[goal]?.[tier] ?? W.tierEffect[category]?.[tier] ?? ""}`;
}

/**
 * Bring already-installed tables up to today's wording.
 *
 * The aliases above keep a renamed label from BREAKING anything, and that is a
 * different job from this one: a table called "DRPG Usable Items (Stress
 * Relief) - Tier 1", described as "Restores 1 HP or 1 Stress", still says
 * Stress and HP to every GM who opens the sidebar. Dawid asked for the rename
 * everywhere (26.08), and a world already in play is part of everywhere.
 *
 * WHAT IT WILL AND WILL NOT TOUCH. Only a table carrying this module's own
 * `category`/`tier` flags, sitting under a name this module is known to have
 * generated, is considered - a GM's own table that merely looks similar is not
 * ours to rename. The description is only rewritten when it still matches the
 * shape `installTables` writes ("<Label>, Tier N. …"), which is the signature
 * of boilerplate nobody has edited; a description somebody has written over is
 * theirs and is left exactly as it is, even though it may still say Stress.
 *
 * Idempotent, and silent when there is nothing to do - it runs at `ready` on
 * every GM client, and a migration that announces itself every session is one
 * people learn to click past.
 *
 * @returns {Promise<{renamed: string[], redescribed: string[]}>}
 */
export async function refreshTableCopy() {
    const renamed = [];
    const redescribed = [];
    if (!game.user.isGM) return { renamed, redescribed };

    // The shape installTables writes, under ANY label this module has used -
    // that is what marks a description as untouched boilerplate.
    // The English ones too (E14 fix e1-G6), so a GM in Polish recognises the English boilerplate it keeps, and the
    // live ones, so on a GM in Polish a description an earlier one wrote in Polish this way is brought back to English.
    const labels = [...new Set(Object.values(ITEM_CATEGORIES).map(c => c.label)
        .concat(Object.values(TABLE_COPY_WORDS.label), ["Usable Item", "Crime Tool"]))];
    const generated = new RegExp(`^(${labels.map(l =>
        l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})( \\([^)]*\\))?, Tier \\d+\\.`);

    // BY FLAG, NOT BY TODAY'S JOB LIST. Walking `tableJobs()` would only visit
    // the tables this version still builds, and miss every one it used to: the
    // mixed "DRPG Usable Items - Tier N" pools stopped being generated when
    // usables split by kind, and they are exactly the tables still carrying the
    // oldest wording. What makes a table ours is its flags, so that is what is
    // walked - retired shapes included.
    for (const table of Array.from(game.tables ?? [])) {
        const category = table.getFlag(MODULE_ID, "category");
        const tier = table.getFlag(MODULE_ID, "tier");
        const goal = table.getFlag(MODULE_ID, "goal") ?? null;
        if (!category || tier === undefined || tier === null) continue;

        const update = {};
        // Today's English name in every language (E14 part 2 C1): until then a GM in Polish was "brought up to date"
        // to the Polish plural, so an old "DRPG Crime Tools - Tier 3" became "DRPG Narzędzia zbrodni - Tier 3" and was
        // lost to every English client (measured by E14-T12 at 8307cb7b).
        const wanted = tableName(category, tier, goal);
        // Only a name this module itself gave the table under an older ENGLISH
        // wording is brought up to date (ITEM-15). A GM who renamed a pool in the
        // editor - warned there that the lookup may miss it - keeps their name
        // rather than finding it silently reverted on the next load, and so does a
        // table a client in Polish built: it is found by its flags or through its
        // Polish alias, and it is the GM's (`LOCALIZED_PLURALS`).
        const ours = tableNameCandidates(category, tier, goal, { localized: false }).includes(table.name);
        if (ours && table.name !== wanted && !game.tables.getName(wanted)) update.name = wanted;

        const description = tableDescription(category, tier, goal);
        if (table.description !== description && generated.test(table.description ?? "")) {
            update.description = description;
        }

        if (!Object.keys(update).length) continue;
        try {
            const was = table.name;
            await table.update(update);
            if (update.name) renamed.push(`${was} → ${update.name}`);
            if (update.description) redescribed.push(table.name);
        } catch (err) {
            error(`Could not bring "${table.name}" up to date`, err);
        }
    }

    if (renamed.length || redescribed.length) {
        log(`Item tables: ${renamed.length} renamed, ${redescribed.length} re-described.`);
    }
    return { renamed, redescribed };
}

/**
 * A TIER pool feeds dice draws and is never a room's pool.
 *
 * Two families of table, two jobs. Tier pools - everything `tableName()`
 * produces - answer "a Tier N roll came up, what was found". Room pools -
 * the global fallthrough plus whatever the GM creates - answer "what does
 * THIS room stock". Room Setup's "Draws from" only offers the second family;
 * offering the first let a room be pointed at "DRPG Crime Tools - Tier 2",
 * which then answered every Search in that room regardless of the roll.
 */
const TIER_POOL_PATTERN = /^DRPG .+ - Tier \d+$/;

export function isTierPool(name) {
    return TIER_POOL_PATTERN.test(String(name ?? ""));
}

/**
 * WHICH FAMILY A TABLE IS IN, BY ITS FLAGS (E14 fix e1-G2, 25.10.2026; the review's E14p2-END-04 and R3).
 *
 * C1 made a tier pool answer a draw by the flags the installer writes, whatever its name, and left everything that
 * sorts tables into the two families reading the name (`isTierPool`). So a pool the GM renamed in the sidebar -
 * "DRPG Murder Weapons - Tier 2" to "Kitchen knives", flags crimeTool and 2 - still answered a Tier 2 weapon's draw,
 * and was missing from the Item tables window (`moduleTables` keeps a "DRPG " name), offered by Room Setup as a
 * room's stock (where it answered every Search of that room from a Tier 2 pool), listed on neither tab's side it
 * belongs to, and its entries filed by nothing (`tableIndex`): a cleaver it alone holds, handed over by a room's own
 * table to a Search for a Healing usable, was granted as a Healing usable, and `usableKindFor` read no kind for a
 * name a renamed Healing pool alone holds. Now:
 *   - `tierPoolOf`: the pool a table's flags name - a category the pools hold and a tier of `ITEM_TIERS` - or null;
 *   - `isTierPoolTable`: a table with such flags is a tier pool under any name; one marked `roomPool` is a room's;
 *     one with neither is read by its name, as every table was before the flags existed.
 */
export function tierPoolOf(table) {
    const category = table?.getFlag?.(MODULE_ID, "category");
    const tier = Number(table?.getFlag?.(MODULE_ID, "tier"));
    if (!category || !Object.hasOwn(ITEM_POOLS, category) || !ITEM_TIERS.includes(tier)) return null;
    return { category, tier, goal: table.getFlag(MODULE_ID, "goal") ?? null };
}

export function isTierPoolTable(table) {
    if (tierPoolOf(table)) return true;
    if (table?.getFlag?.(MODULE_ID, "roomPool")) return false;
    return isTierPool(table?.name);
}

/** The names Room Setup's "Draws from" offers: every table but a tier pool (`isTierPoolTable`), sorted (vault.mjs). */
export function roomStockTables(tables = game.tables ?? []) {
    return Array.from(tables).filter(t => !isTierPoolTable(t)).map(t => t.name).sort();
}

/** The pool a tier pool table is, by its flags, else, for a table with none, by its name (`classifyTableName`). */
export function poolShapeOf(table) {
    const flagged = tierPoolOf(table);
    if (flagged) return flagged;
    if (table?.getFlag?.(MODULE_ID, "category") || table?.getFlag?.(MODULE_ID, "roomPool")) return null;
    return classifyTableName(table?.name);
}

/**
 * WHETHER A NAME MAY GO ON A TABLE OF THIS TAB, and if not, the sentence that says why (E14 part 2 C5, 24.10.2026; S08-45).
 *
 * Until E14 the Tier pools tab asked `isTierPool` only - "DRPG <anything> - Tier <digits>" - so "DRPG Weapons - Tier 2"
 * and "DRPG Tools - Tier 5" went through, `classifyTableName` read neither, and `createPoolFrom` filed each as a room
 * table with the sentence "Room table created, point a room at it": a table Room Setup does not offer (its list leaves
 * out `isTierPool` names) and no draw reads. A rename asked nothing about the shape at all, so a room table could become
 * "DRPG Tools - Tier 2" and a tier pool "Kitchen". One check for both roads now:
 *   - the Tier pools tab takes a name `classifyTableName` reads, Polish aliases included, and a refusal lists the names
 *     it reads (`tierPoolForms`); a rename of a table that carries a tier pool's flags must read as that same pool, since
 *     the draw goes by the flags (C1) and a name saying another category or tier would only mislead the GM;
 *   - the Room pools tab takes any name but a tier pool's, as at Base (`roomPool: true`, the TABLES-01 test in tier 0);
 *   - either tab: a name, and one no other table has (`table`, the one renamed, does not count against itself).
 *
 * @param {string} name
 * @param {"tiers"|"rooms"} family   the tab the name was typed on
 * @param {object} [options]
 * A ROOM'S OWN "- Tier N" UNDER A "DRPG " NAME (E14 fix e1-G5, 25.10.2026; the review's E14p2-END-05, R4). The Room pools
 * tab took "DRPG Kitchen" (no tier pool's shape) and a room could be pointed at it; then Create an item's note
 * (`presetTargetsFor`, `DRPG.Tables.presetRoomTier`) said to make "DRPG Kitchen - Tier 2" on the Room pools tab, which
 * refused it as a tier pool's name (`isTierPool`), and the Tier pools tab refused it as no name it reads: the window's own
 * advice could not be followed, and that room could never get the tier split `drawItem` reads. A "<base> - Tier N" whose
 * base is a room's table (`roomTableBases`) is a room table now, on the Room pools tab and in a rename there; it is
 * created as one (`roomPool: true`) and filed as one by its flag (`isTierPoolTable`).
 *
 * @param {object}   [options.table]   the table being renamed, if this is a rename
 * @param {Iterable} [options.tables]  the tables a name is checked against; the world's by default
 * @param {Set<string>} [options.bases]  the names of the rooms' tables (`roomTableBases`); the world's by default
 * @returns {{key: string, data: object, text: string}|null}  null when the name may be used
 */
export function poolNameRefusal(name, family, { table = null, tables = game.tables ?? [], bases = null } = {}) {
    const say = (key, data = {}) => ({ key, data, text: game.i18n.format(key, data) });
    const text = String(name ?? "").trim();
    if (!text) return say("DRPG.Tables.needsName");
    // A table that carries a tier pool's flags is one wherever its name has put it: a pool renamed before C5 sits on
    // the Room pools tab (the window sorts by name), and the GM renaming it back must be let through.
    const flag = key => table?.getFlag?.(MODULE_ID, key);
    const flagged = Boolean(table && flag("category") && Number.isInteger(flag("tier")));
    if (flagged || family === "tiers") {
        const known = classifyTableName(text);
        if (!known) return say("DRPG.Tables.newTierPoolForms", { name: text, forms: tierPoolForms().join(", "),
            low: ITEM_TIERS[0], high: ITEM_TIERS[ITEM_TIERS.length - 1] });
        if (flagged && (known.category !== flag("category") || known.tier !== flag("tier") || (known.goal ?? null) !== (flag("goal") ?? null))) {
            return say("DRPG.Tables.renameOtherPool", { name: text, pool: tableName(flag("category"), flag("tier"), flag("goal") ?? null) });
        }
    } else if (isTierPool(text) && !roomTierName(text, bases ?? roomTableBases(tables))) {
        return say("DRPG.Tables.newPoolTierName");
    }
    if (Array.from(tables).some(other => other !== table && other?.name === text)) return say("DRPG.Tables.newPoolExists", { name: text });
    return null;
}

/** Is this "<base> - Tier N", its base a room's table and N a tier (`poolNameRefusal`, E14 fix e1-G5)? */
function roomTierName(text, bases) {
    const parts = String(text ?? "").match(/^(.+) - Tier (\d+)$/);
    return Boolean(parts) && ITEM_TIERS.includes(Number(parts[2])) && bases.has(parts[1]);
}

/** The tables a room of any scene is pointed at (its region's `drpgItemTable`), by name (`moduleTables`, `roomTableBases`). */
function roomsPointedAt() {
    const names = new Set();
    try {
        for (const scene of game.scenes ?? []) {
            for (const region of scene.regions ?? []) {
                const name = region.getFlag?.(MODULE_ID, "drpgItemTable");
                if (name) names.add(name);
            }
        }
    } catch (err) {
        // A room pointing at a table is a convenience here, not the subject.
        error("Could not read the rooms' item tables", err);
    }
    return names;
}

/**
 * THE NAMES OF THE ROOMS' TABLES: what a room is pointed at (`roomsPointedAt`), and every table marked a room's
 * (`roomPool`). `poolNameRefusal` lets a "<base> - Tier N" of one through on the Room pools tab (E14 fix e1-G5).
 */
export function roomTableBases(tables = game.tables ?? []) {
    const bases = roomsPointedAt();
    for (const table of tables) if (table?.getFlag?.(MODULE_ID, "roomPool") && table.name) bases.add(table.name);
    return bases;
}

/**
 * The names a tier pool may carry, a tier written N: one a category, and for a usable one a goal. The same shapes
 * `classifyTableName` walks, in today's English (the installer's names, C1), so a refusal never offers a name it
 * would not read back.
 */
export function tierPoolForms() {
    return [
        ...Object.keys(ITEM_POOLS).map(category => tableName(category, "N")),
        ...Object.keys(USABLE_GOALS).map(goal => tableName("usable", "N", goal))
    ];
}

/**
 * Usable items, split by kind.
 *
 * This split used to be cosmetic - a courtesy so a Search for "something to
 * patch me up" did not hand over chewing gum. Since 2026-08-26 it is the rules:
 * which table an item belongs to IS what the item does. A healing usable
 * restores Health, a stress-relief one clears Sanity, and nobody is asked which at
 * the moment of use - `usableKindFor` below is how the Use action reads the
 * answer back off these tables.
 *
 * Tier 3's one name appears in both. It was the tier where the kinds met (2 Health or 2 Sanity at the player's
 * choice, plus 2 Hope) until the owner's ruling of 15.10.2026 made it 3 of its kind and nothing else (E14 part 1
 * C5): a Candy floss drawn from either table has that table's kind (the Search's goal), and one handed over with
 * no kind is asked which at its use, as any item of no known kind is (`usableKindFor` answers "both").
 */
export const USABLE_GOALS = {
    healing: {
        label: USABLE_KINDS.healing.label,
        pool: {
            0: ["Spoiled cheese", "Half a sandwich", "Flat lemonade", "Stale crackers"],
            1: ["Apple", "Cereal bar", "Instant noodles", "Sports drink"],
            2: ["Canned soup", "First aid kit", "Burn cream", "Vacuum-packed bento"],
            3: ["Candy floss"]
        }
    },
    stress: {
        label: USABLE_KINDS.stress.label,
        pool: {
            0: ["Fidget spinner", "Torn magazine", "Cracked handheld game", "Dried-out marker"],
            1: ["Chewing gum", "Cold tea", "Cigarettes", "Worn paperback"],
            2: ["Pills", "Music player", "Instant coffee", "Photo album"],
            3: ["Candy floss"]
        }
    }
};

/**
 * Which kind of usable an item of this name is, read off the tables.
 *
 * The world's Healing and Sanity Relief tables are the authority on a name -
 * they are what the GM edits. An item already made keeps the kind it was made
 * with (its flag, which outranks this since E29 fix r2-H8: use-items.mjs
 * `usableKindOf`), so a name moved from one table to the other changes the items
 * made after it. The built-in pools only answer when no world table knows the
 * name at all (a world where the tables were never installed).
 *
 * @returns {"healing"|"stress"|"both"|null} `"both"` when the name sits in
 *   tables of both kinds - genuinely ambiguous, the caller decides what that
 *   means - and `null` when nothing anywhere claims it.
 */
export function usableKindFor(name) {
    const wanted = String(name ?? "").trim().toLowerCase();
    if (!wanted) return null;

    const matches = pools => {
        const kinds = new Set();
        for (const [goal, names] of pools) {
            if (names.some(n => String(n ?? "").trim().toLowerCase() === wanted)) {
                kinds.add(goal);
            }
        }
        return kinds;
    };

    // One lookup in the shared index rather than a walk over every table and
    // every result per call - see `tableIndex` (audit D2).
    let kinds = new Set(tableIndex().get(wanted)?.kinds ?? []);
    if (!kinds.size) {
        kinds = matches(Object.entries(USABLE_GOALS)
            .map(([goal, { pool }]) => [goal, Object.values(pool).flat()]));
    }

    if (!kinds.size) return null;
    return kinds.size === 1 ? kinds.values().next().value : "both";
}

/**
 * Item pools, keyed by category then tier.
 *
 * The guide's own examples are the first entry of each tier; the rest are the
 * "GM improvises the rest" that the guide asks for, done in advance and kept in
 * the same register - school property, maintenance cupboards, kitchen drawers.
 *
 * Why more than one per tier. Every tool tier used to hold exactly the guide's
 * single example, so every Tier 2 weapon found in a whole season was an axe and
 * every Tier 2 cleaning tool was a mop. Three search tokens per room per time of
 * day is a lot of draws for a one-item bag, and a killing game's evidence turns
 * on *which* object was used. Add your own by editing the RollTables in the
 * world; the module reads those first.
 *
 * Tier 0 is "a random, seemingly useless object, open to creative use".
 */
export const ITEM_POOLS = {
    usable: {
        0: ["Spoiled cheese", "Fidget spinner", "Flat lemonade", "Torn magazine"],
        1: ["Apple", "Chewing gum", "Cereal bar", "Cold tea"],
        2: ["Canned soup", "Pills", "First aid kit", "Music player"],
        3: ["Candy floss"]
    },
    /*
     * TIER IS WHAT AN OBJECT CAN DO, NOT ONLY HOW WELL (E9, Dawid 27.08).
     *
     * Tiers 0 and 1 do one job. **Every** entry at tier 2 and 3 does two - that
     * is what the tier buys, alongside the number. The first pass gave a second
     * tag to about half of the high-tier entries, which read as an oversight
     * rather than a rule: a Bolt cutters that doubles as a tool sitting beside a
     * Fire extinguisher that does not teaches nobody anything.
     *
     * Three entries were REPLACED rather than tagged, because the second job had
     * to be invented for them and an invented job is worse than a missing item:
     * Handgun and Crossbow (a firearm is not a tool and not a cleaner) and
     * Incinerator key (a key, which was always an odd thing to hold in a hand as
     * a cleaning tool). Their replacements do two jobs honestly.
     */
    crimeTool: {
        0: ["Scissors", "Letter opener", "Broken bottle", "Skipping rope"],
        1: ["Bent pipe", "Hammer", "Baseball bat", "Kitchen knife"],
        2: ["Axe", "Bolt cutters", "Fire extinguisher", "Chemistry acid"],
        3: ["Industrial saw", "Nail gun", "Quicklime barrel"]
    },
    cleaningTool: {
        0: ["Toilet paper", "Old newspaper", "Gym towel"],
        1: ["Rope", "Rubber gloves", "Bin bags", "Bucket and sponge"],
        2: ["Mop", "Bleach", "Vacuum cleaner", "Blowtorch"],
        3: ["Cleaning agent", "Pressure washer", "Lye drum"]
    },
    tool: {
        0: ["Bent nail", "Plastic ruler", "Blunt pencil", "Paperclip chain"],
        1: ["Screwdriver", "Pliers", "Hand drill", "Sewing kit"],
        2: ["Duct tape", "Spanner set", "Soldering iron", "Crowbar"],
        3: ["Angle grinder", "Master toolkit", "Steam cleaner"]
    }
};

/**
 * Which of the built-in items can do more than one job.
 *
 * Read once, at INSTALL time: the roles are written onto the TableResult as
 * flags, and from then on the table is the authority, not this map. That is
 * what keeps it from becoming the fragile thing it looks like - a lookup by
 * display name would break the moment a GM renamed an entry, and here the
 * rename simply keeps whatever flag the entry already had.
 *
 * The choices are meant to be arguable rather than exhaustive. A crowbar is a
 * tool that opens skulls; duct tape cleans as readily as it fixes; a hammer has
 * been a murder weapon in every story ever told. Anything not listed does one
 * job, which is the honest default - a fire extinguisher is a weapon and not a
 * workshop.
 */
export const POOL_ROLES = {
    // --- Murder Weapons, tier 2 and 3 -------------------------------------
    "Axe": ["tool"],
    "Bolt cutters": ["tool"],
    "Fire extinguisher": ["cleaningTool"],
    "Chemistry acid": ["cleaningTool"],
    "Industrial saw": ["tool"],
    "Nail gun": ["tool"],
    "Quicklime barrel": ["cleaningTool"],

    // --- Cleaning Tools, tier 2 and 3 -------------------------------------
    "Mop": ["tool"],
    "Bleach": ["crimeTool"],
    "Vacuum cleaner": ["tool"],
    "Blowtorch": ["crimeTool"],
    "Cleaning agent": ["crimeTool"],
    "Pressure washer": ["tool"],
    "Lye drum": ["crimeTool"],

    // --- Tools, tier 2 and 3 ----------------------------------------------
    "Duct tape": ["cleaningTool"],
    "Spanner set": ["crimeTool"],
    "Soldering iron": ["crimeTool"],
    "Crowbar": ["crimeTool"],
    "Angle grinder": ["crimeTool"],
    "Master toolkit": ["crimeTool"],
    "Steam cleaner": ["cleaningTool"]
};

/** No item may carry more than this many roles beside its home. */
export const MAX_EXTRA_ROLES = 1;

/**
 * The lowest tier at which an item may do two jobs.
 *
 * A two-tag item is unconditionally better than a one-tag one, so it has no
 * business lying at the bottom of the table (Dawid, 27.08). Duct tape moved up
 * to tier 2 rather than losing its second tag - it is still worth finding, and
 * two tags are meant to cost something.
 */
export const MULTI_ROLE_TIER = 2;

/** The roles a built-in pool entry carries. Empty for anything unlisted. */
export function rolesForPoolItem(name) {
    return POOL_ROLES[name] ? [...POOL_ROLES[name]] : [];
}

/*
 * `PROJECT_ITEMS` STOOD HERE and is gone (Dawid, question Q12 of the 1.2.13
 * audit).
 *
 * Three items the guide names as project results rather than search finds -
 * Sleeping draught, Lethal poison, Gift. Nothing ever read them: no screen
 * offered them, and the note that used to sit here argued they were guide
 * content rather than dead code and should stay. Asked directly, Dawid's answer
 * was that they do not need wiring up, so the rule lives where the rest of the
 * guide's unimplemented content lives - the handbook, and the audit that
 * records the decision - rather than as an export nothing imports.
 */

/**
 * The roles written on one table entry.
 *
 * Falls back to the built-in map for an entry that predates roles entirely -
 * a world whose tables were installed before E8 has no flags on them, and a
 * hammer drawn from such a table should still be a hammer. That fallback is by
 * NAME, which is fragile, and it is deliberately the last resort rather than
 * the mechanism.
 */
export function rolesOfResult(result) {
    const flagged = result?.getFlag?.(MODULE_ID, "roles");
    if (Array.isArray(flagged)) return [...flagged];
    return rolesForPoolItem(result?.name ?? result?.text ?? "");
}

/**
 * The tier pool an item of this category and tier belongs in.
 *
 * `"usable:healing"` carries the goal after the colon, the shape the category
 * select uses. Returns null when no such pool exists yet, which is a real state
 * in a world where the tables were never installed.
 */
export function tierTableIdFor(categoryValue, tier) {
    const [category, goal = null] = String(categoryValue ?? "").split(":");
    if (!category || !Number.isFinite(tier)) return null;
    return tierTablesFor(category, tier, goal)[0]?.id ?? null;
}

/** One random item name for a category and tier. `rng` is the draw's (`drawItem`), `Math.random` by default. */
export function randomItem(category, tier, goal = null, rng = Math.random) {
    const goalPool = USABLE_GOALS[goal]?.pool;
    const pool = goalPool?.[tier] ?? goalPool?.[0]
        ?? ITEM_POOLS[category]?.[tier] ?? ITEM_POOLS[category]?.[0] ?? [];
    if (!pool.length) return null;
    return pool[Math.floor(rng() * pool.length)];
}

/** What one table hands a Search: its first result's name and what travels with it, or null for an empty or broken table. */
async function drawFrom(table, extra = {}) {
    try {
        const draw = await table.draw({ displayChat: false });
        const result = draw?.results?.[0];
        const drawn = result?.name ?? result?.text ?? result?.description;
        if (!drawn) return null;
        return {
            name: drawn,
            fromTable: true,
            ...extra,
            // What else the thing can do - see POOL_ROLES. Read off the
            // entry, so a GM who ticked "also a weapon" on their own
            // screwdriver gets a weapon.
            roles: rolesOfResult(result),
            // Carried onto the Item when it is granted. `installTables`
            // writes the name into `description` as well, so a
            // description that is only the name again is dropped here
            // rather than overwriting the tier line every found item
            // gets - see `grantItem`.
            img: result?.img ?? result?.icon ?? null,
            description: result?.description && result.description !== drawn
                ? result.description : null
        };
    } catch {
        // A broken table should not stop the action - fall through.
        return null;
    }
}

/**
 * The plurals a room table's name may end in for a category: today's English (`pluralOf`), then every older and
 * every Polish one (`LEGACY_PLURALS`), so "Kuchnia - Narzędzia zbrodni", named by a GM in Polish, is the Kuchnia's
 * weapons on every client (E14 part 2 C2).
 */
function roomPluralsOf(category) {
    return [pluralOf(category), ...(LEGACY_PLURALS[category] ?? [])];
}

/** The names a room's table answers a draw under, in the order asked: the tier, the category, then the flat table. */
export function roomTableNames(base, category, tier) {
    return [`${base} - Tier ${tier}`, ...roomPluralsOf(category).map(plural => `${base} - ${plural}`), base];
}

/**
 * Is this table one of the room's? The flat table, or the room's name and a suffix this module reads: " - Tier N" for
 * a tier the roll reaches (no higher), or " - " and the plural of a category a Search draws, an alias included (S08-45's
 * draw part).
 *
 * A SEARCH DRAWS ONLY WHAT A SEARCH ASKS FOR (E14 fix e1-G4, 25.10.2026; the review's E14p2-END-02, R5).
 * Every key of `ITEM_CATEGORIES` was a suffix here, and since C3 the suffix is the find's category (`roomEntryAs`): a
 * "Library - Truth Bullets" table handed a Search for a weapon a Truth Bullet with no trace behind it, ready for the
 * trial, and "Dorm - Room Keys" a key with no room on it - against the module's own rulings (vault.mjs Room Setup, A24:
 * "Truth Bullets are not searched for, and neither are bedroom keys"; `pickableCategories`; `drawItem`'s spare, which
 * skips the Truth Bullet). Only the categories the pools hold (`ITEM_POOLS`) are a room table's suffix now.
 */
function isRoomTableOf(base, name, tier) {
    if (name === base) return true;
    if (!String(name ?? "").startsWith(`${base} - `)) return false;
    const suffix = name.slice(base.length + 3);
    const tierOf = suffix.match(/^Tier (\d+)$/);
    if (tierOf) return ITEM_TIERS.includes(Number(tierOf[1])) && Number(tierOf[1]) <= Number(tier);
    return Object.keys(ITEM_POOLS).some(category => roomPluralsOf(category).includes(suffix));
}

/*
 * WHAT A DRAW IS, NOT WHAT WAS ASKED FOR (E14 part 2 C3, 24.10.2026; audit S08-09; E14's doneWhen: "drawItem zwraca
 * kategorię i tier"). `drawItem` answered a name, and the find was made with the category, tier and goal the searcher
 * asked for: a mop out of "<room> - Murder Weapons" became a Tier 3 murder weapon, a Tier 0 snack from a room's Usables
 * a Tier 2 one, and whatever a room handed over in place of what was asked became what was asked (E14-T14 read all
 * three at 4fb2cced). Each road of `drawItem` now says what it drew:
 *   - a tier pool, its flags (by name, `classifyTableName`, for a table the GM made under a pool's name with none);
 *     the old mixed usable pool, which has no goal, keeps the goal the draw asked for, as the find did at Base;
 *   - a room's table, the entry as the tier pools file it (`foundAs`), else what the table's name says - "Tier N" its
 *     tier, a plural its category - else the request;
 *   - a built-in pool, the request, which is the pool it drew from.
 * The tier is the item's, which can be above the roll's: "Kitchen - Tier 3" also answers a Tier 1 roll as a
 * substitute. `grantDrawn` (action-rolls.mjs) gives it no higher than the tier the Search earned, and the GM still
 * judges that tier (sheet-audit.mjs `searchFind`).
 */

/**
 * The category, tier and goal an entry of this name is filed under in the tier pools (`classifyEntryName`), or
 * `fallback` when no pool files it. An entry filed twice (an axe that is also a tool) answers as the pool asked for
 * when it is one of them. Exported: a plant's name is read the same way (action-rolls.mjs `searchDraw`), so a planted
 * item lands on the sheet as the same entry drawn from a table would (trap 166).
 *
 * @param {string} name
 * @param {{category: string, tier: number, goal: string|null}} asked
 * @returns {{category: string, tier: number, goal: string|null}}
 */
export function foundAs(name, asked, fallback = asked) {
    const read = classifyEntryName(name);
    if (!read) return { category: fallback.category, tier: fallback.tier, goal: fallback.goal ?? null };
    const homes = [read, ...(read.others ?? [])];
    const home = homes.find(h => h.category === asked.category && (h.goal ?? null) === (asked.goal ?? null))
        ?? homes.find(h => h.category === asked.category) ?? read;
    return { category: home.category, tier: home.tier, goal: home.goal ?? null };
}

/** What a room table's entry is: as the pools file it, else as the table's suffix says, else the request. */
function roomEntryAs(base, table, name, asked) {
    const suffix = table.name === base ? "" : String(table.name).slice(base.length + 3);
    const tierOf = suffix.match(/^Tier (\d+)$/);
    // A category a Search draws only (`isRoomTableOf`, E14 fix e1-G4): any other suffix leaves the request standing.
    const category = tierOf ? null : Object.keys(ITEM_POOLS).find(key => roomPluralsOf(key).includes(suffix));
    const bySuffix = tierOf ? { ...asked, tier: Number(tierOf[1]) }
        : category && category !== asked.category ? { category, tier: asked.tier, goal: null } : asked;
    return foundAs(name, asked, bySuffix);
}

/** What a tier pool's entry is: the pool's flags, else its name, else the request; a goalless usable pool keeps the goal asked. */
function poolEntryAs(table, asked) {
    const category = table.getFlag?.(MODULE_ID, "category");
    const tier = Number(table.getFlag?.(MODULE_ID, "tier"));
    const read = category && ITEM_TIERS.includes(tier) ? { category, tier, goal: table.getFlag(MODULE_ID, "goal") ?? null }
        : classifyTableName(table.name) ?? asked;
    return read.category === "usable" && !read.goal && asked.category === "usable" ? { ...read, goal: asked.goal ?? null } : read;
}

/**
 * WHAT A DRAW ANSWERS (E41 C1c; audit S17-29): the one place an answer is built, for each of `DRAW_STEPS`. `found` is
 * what the step drew (`drawFrom`'s row, or a built-in pool's name with its roles), `how.from` the road it came by -
 * "room" (a room's table, `how.table`: the entry as the tier pools file it, else as the table's name says, else the
 * request - `roomEntryAs`), "pool" (a GM's tier pool, `how.table`: its flags, else its name - `poolEntryAs`), "builtIn"
 * (the request, which is the pool it drew from) or "spare" (`how.category`, another category's pool, at the tier
 * asked and no goal). Each the shape `drawItem` answered on that road before the steps were a list.
 */
function resultFrom(found, ctx, how) {
    if (how.from === "room") return { ...found, ...roomEntryAs(ctx.roomBase, how.table, found.name, ctx.asked) };
    if (how.from === "pool") return { ...found, ...poolEntryAs(how.table, ctx.asked) };
    if (how.from === "spare") return { ...found, category: how.category, tier: ctx.asked.tier, goal: null };
    return { ...found, ...ctx.asked };
}

/*
 * THE STEPS OF A DRAW, IN THIS ORDER (D15, the owner: "tabele pokoju mają pierwszeństwo przed pulami świata"; E14 part 2
 * C2, 24.10.2026; a list since E41 C1c, audit S17-29): the room's own tables, then the GM's tier pools, then the
 * built-in pools, then any other category. Until E14 part 2 C2 the world's tier pools were asked between the room's
 * named tables and the rest of the room's, so the promise that the room answers before the world was not true: an
 * armoury stocked with "Armoury - Murder Weapons" and asked for something to patch you up handed over the world's
 * bandage (audit S08-05; E14-T13 read it at b94e1cac). Each step is `async (ctx) => answer | null` over the draw's
 * context (`drawItem`) and answers through `resultFrom`; the first that answers is the draw.
 */

/**
 * The room's tables by name: the tier, the category (an older or a Polish plural too, `roomPluralsOf`), then the flat
 * table - "Kitchen - Tier 2" answers a Tier 2 roll before "Kitchen - Murder Weapons", and that before plain "Kitchen".
 * The guide says outright that what turns up can depend on where you are, so a kitchen and a boiler room do not draw
 * from the same bag; a single "Kitchen" table asked for a crime tool would hand back an apple and then label it a
 * weapon, so the split by category and by tier (F5.5, Dawid 25.08) is asked first. A GM who does not want that
 * precision keeps one flat table and it answers everything. A room with nothing to give - never set up, or its tables
 * empty - falls through to the world's pools as it did before (D15).
 */
async function drawRoomNamed(ctx) {
    if (!ctx.roomBase) return null;
    for (const name of roomTableNames(ctx.roomBase, ctx.category, ctx.tier)) {
        const table = ctx.tables?.getName?.(name);
        // A tier pool is never a room's stock, whatever its name (E14 fix e1-G2): a room pointed at one before
        // Room Setup read the flags answered every Search there from that pool, at any roll.
        const found = table && !tierPoolOf(table) ? await drawFrom(table) : null;
        if (found) return resultFrom(found, ctx, { from: "room", table });
    }
    return null;
}

/**
 * THE ROOM ANSWERS WITH WHAT IT HAS, BEFORE THE WORLD ANSWERS AT ALL.
 *
 * The names above ask the room for the tier and the category. For a room the GM DID stock, asking the world next
 * produces the wrong kind of wrong: ask an armoury for something to patch you up and, if the GM built "Armoury -
 * Murder Weapons" and no flat "Armoury", the lookup walks straight past the room and hands over a bandage. In an
 * armoury.
 *
 * So before the world's pools: every table this room owns, picked at random. A player who asks a room for something it
 * does not stock gets what it does stock - which is both funnier and truer than either "nothing" or "a bandage from
 * nowhere". A table is the room's by a suffix this module reads (`isRoomTableOf`), never by its first words alone:
 * "Kitchen - Back room" is another room's pool, not the Kitchen's (S08-45), and a "Kitchen - Tier 3" does not answer a
 * Tier 1 roll.
 *
 * `substitute` travels with it so the card can say so. It is not a failure: the roll was made and beaten, an action
 * and a search token are spent, and something real came out. It is simply not what was asked for.
 */
async function drawRoomAny(ctx) {
    if (!ctx.roomBase) return null;
    const owned = (ctx.tables?.contents ?? []).filter(t => isRoomTableOf(ctx.roomBase, t.name, ctx.tier) && !tierPoolOf(t));
    // Shuffled rather than "the first one": the room's tables are named by category and taking the first would
    // silently favour whichever category sorts earliest. The shuffle is today's, `sort` on the draw's `rng`: a fair
    // one (Fisher-Yates) waits for the balance after sessions 0 (D21, E64).
    for (const table of owned.sort(() => ctx.rng() - 0.5)) {
        const found = await drawFrom(table, { substitute: true });
        if (found) return resultFrom(found, ctx, { from: "room", table });
    }
    return null;
}

/**
 * The GM's tier pools by their flags, then by every name these have ever been called - see `tierTablesFor` and
 * LEGACY_PLURALS. A world whose tables were built before a label was reworded, or by a client in another language, or
 * renamed by its GM, is still the world whose tables answer. With a goal, the goal's pools and then the category's.
 */
async function drawTierPools(ctx) {
    const pools = [...tierTablesFor(ctx.category, ctx.tier, ctx.goal, ctx.tables),
        ...(ctx.goal ? tierTablesFor(ctx.category, ctx.tier, null, ctx.tables) : [])]
        .filter((table, at, all) => all.indexOf(table) === at);
    for (const table of pools) {
        const found = await drawFrom(table);
        if (found) return resultFrom(found, ctx, { from: "pool", table });
    }
    return null;
}

/** The built-in pool of the category, tier and goal asked (`randomItem` on the draw's `rng`). */
async function drawBuiltIn(ctx) {
    const picked = randomItem(ctx.category, ctx.tier, ctx.goal, ctx.rng);
    return picked ? resultFrom({ name: picked, fromTable: false, roles: rolesForPoolItem(picked) }, ctx, { from: "builtIn" }) : null;
}

/**
 * Nothing in the asked-for category anywhere, which is a world with a gap in it rather than a room with a character.
 * Any other category, at random (today's shuffle on the draw's `rng`, as the room's; D21, E64), rather than sending
 * somebody away empty-handed from a roll they beat - never a Truth Bullet. Its own category (E14 part 2 C3): until
 * then an apple from here was granted as the category nobody stocks.
 */
async function drawSpare(ctx) {
    for (const other of Object.keys(ITEM_CATEGORIES).sort(() => ctx.rng() - 0.5)) {
        if (other === ctx.category || other === "truthBullet") continue;
        const name = randomItem(other, ctx.tier, null, ctx.rng);
        if (name) return resultFrom({ name, fromTable: false, substitute: true, roles: rolesForPoolItem(name) }, ctx, { from: "spare", category: other });
    }
    return null;
}

/** The steps a draw runs, in order, each by its name (R1234 reads the order). */
export const DRAW_STEPS = Object.freeze([
    Object.freeze({ name: "roomNamed", run: drawRoomNamed }),
    Object.freeze({ name: "roomAny", run: drawRoomAny }),
    Object.freeze({ name: "tierPools", run: drawTierPools }),
    Object.freeze({ name: "builtIn", run: drawBuiltIn }),
    Object.freeze({ name: "spare", run: drawSpare })
]);

/**
 * Roll on the world's table if one exists, otherwise fall back to the built-in
 * pool. The GM editing a table has to actually change what Search produces.
 * What was drawn comes back with its own category, tier and goal (C3, above `foundAs`).
 *
 * `DRAW_STEPS` in order, the first answer the draw (E41 C1c). `rng` is the draw's chance - both shuffles and the
 * built-in pools' pick - and `tables` the tables it reads, the world's by default; both are handed by the suite
 * (R1234), as is `trail`, an array each step's name is pushed to as the step runs.
 *
 * @returns {Promise<{name: string, fromTable: boolean, category: string, tier: number, goal: string|null}|null>}
 */
export async function drawItem(category, tier, { goal = null, room = null, scene = null, rng = Math.random, tables = game.tables, trail = null } = {}) {
    const asked = { category, tier: Number(tier), goal: goal ?? null };
    // The room's tables' name (vault.mjs Room Setup's "Draws from"), read once before the steps.
    const roomBase = room ? await tableForRoom(room, scene) : null;
    const ctx = { asked, category, tier, goal, room, scene, roomBase, rng, tables };
    for (const step of DRAW_STEPS) {
        trail?.push(step.name);
        const answer = await step.run(ctx);
        if (answer) return answer;
    }
    return null;
}

/** The RollTable a room on this scene draws from, if the GM pointed it at one. */
export async function tableForRoom(room, scene) {
    try {
        const { roomTable } = await import("./vault.mjs");
        return roomTable(room, scene);
    } catch {
        return null;
    }
}

/**
 * Every table this window is willing to show.
 *
 * Two families: the module's own, which follow `tableName()`, and whatever a
 * room has been pointed at in Room Setup - those carry arbitrary names and are
 * every bit as much a part of what a Search can produce (see `drawItem`).
 *
 * Exported for the GM's give-item window, whose "give existing" tab is this
 * same catalogue read the other way round: not "what can a Search produce"
 * but "what is there to hand over".
 */
export function moduleTables() {
    const roomTables = roomsPointedAt();

    return Array.from(game.tables ?? [])
        .filter(t => t.name.startsWith("DRPG ")
            // A tier pool under the name its GM gave it in the sidebar (E14 fix e1-G2): it is one by its flags.
            || Boolean(tierPoolOf(t))
            || roomTables.has(t.name)
            || Array.from(roomTables).some(base => t.name.startsWith(`${base} - `))
            // A room pool the GM created here but has not pointed a room at
            // yet - without this clause it vanished from the very window that
            // made it until Room Setup used it once.
            || t.getFlag(MODULE_ID, "roomPool"))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The order the room breakdown reads in, and the one an entry's home is
 * chosen by when several pools claim it.
 *
 * Weapons first because that is the question a killing game asks of a room.
 */
export const ROOM_GROUP_ORDER = [
    "crimeTool", "cleaningTool", "tool", "usable:healing", "usable:stress"
];

/** The group key for a classification: usables split by what they mend. */
export function groupKeyOf({ category, goal }) {
    return category === "usable" ? `usable:${goal ?? "healing"}` : category;
}

/**
 * What a group is called on screen.
 *
 * `short` for the counter strip, where seven chips share one line and
 * "Usables (Sanity Relief)" spends half of it saying the word Usables three
 * times over. The headings inside keep the full name, because there the word
 * is doing work.
 */
export function groupLabel(key, { short = false } = {}) {
    if (!key.startsWith("usable:")) {
        return ITEM_CATEGORIES[key]?.plural ?? key;
    }
    const goal = key.slice("usable:".length);
    const kind = USABLE_GOALS[goal]?.label ?? goal;
    return short ? kind : `${ITEM_CATEGORIES.usable.plural} (${kind})`;
}

/**
 * WHAT AN ENTRY IN A ROOM POOL IS - worked out, not stored.
 *
 * A room pool is one flat list. Its entries carry a name, a picture, a note and
 * their roles, and nothing that says "this is a Tier 2 murder weapon", because
 * category and tier are flags on the TIER tables - which is where those two
 * facts are decided.
 *
 * So they are read back off the tier pools, by name, exactly the way
 * `usableKindFor` reads what a usable does. The tables stay the authority: move
 * a knife from Tier 1 to Tier 2 and the room that stocks it says Tier 2 the
 * next time it is opened, with nothing to migrate.
 *
 * The built-in pools answer only when no world table knows the name at all,
 * which is a world whose tables were never installed.
 *
 * @returns {{category: string, tier: number, goal: string|null, key: string,
 *            others: object[]}|null} `null` when nothing claims the name.
 */
export function classifyEntryName(name) {
    const wanted = String(name ?? "").trim().toLowerCase();
    if (!wanted) return null;
    // One lookup in the shared index - see `tableIndex`, which keeps the
    // "usable pool with no goal says nothing" rule (measured on "Apple").
    const found = [...(tableIndex().get(wanted)?.pools ?? [])];

    if (!found.length) {
        const hit = names => names.some(n => String(n).trim().toLowerCase() === wanted);
        for (const [goal, { pool }] of Object.entries(USABLE_GOALS)) {
            for (const [tier, names] of Object.entries(pool)) {
                if (hit(names)) found.push({ category: "usable", tier: Number(tier), goal, table: null });
            }
        }
        for (const [category, tiers] of Object.entries(ITEM_POOLS)) {
            if (category === "usable") continue;
            for (const [tier, names] of Object.entries(tiers)) {
                if (hit(names)) found.push({ category, tier: Number(tier), goal: null, table: null });
            }
        }
    }

    if (!found.length) return null;

    // ONE HOME, and the rest said out loud on the row. An item can honestly sit
    // in two tier pools - an axe that is also a tool - and counting it under
    // both would make the breakdown add up to more than the room holds, which
    // is the one thing this list exists to get right.
    found.sort((a, b) =>
        (ROOM_GROUP_ORDER.indexOf(groupKeyOf(a)) - ROOM_GROUP_ORDER.indexOf(groupKeyOf(b)))
        || (a.tier - b.tier));
    const home = found[0];
    return { ...home, key: groupKeyOf(home), others: found.slice(1) };
}

/*
 * ONE PASS OVER THE TABLES, NOT ONE PER ROW (audit D2).
 *
 * `usableKindFor` and `classifyEntryName` each walked every table and every
 * result to answer for one name, and both are asked per row - the sheet for
 * each usable it draws, the editor for each entry of a room pool. Thirty rows
 * over twenty-five tables was three thousand comparisons a render.
 *
 * The index is built on first use and dropped whenever a table or one of its
 * results changes; the hooks are registered the first time it is asked for,
 * so this file needs no register call of its own. Keyed by the same
 * lower-cased, trimmed name the two readers compare on.
 *
 * A USABLE POOL WITH NO GOAL SAYS NOTHING, and that is the module's own
 * ruling rather than a new one: a world from before the split still has
 * "DRPG Usables - Tier N", and `usableKindFor` never read it, because a pool
 * that mixes what mends you with what calms you down cannot decide which an
 * item is. Counting it would put every usable still listed in it under
 * Healing and hang a "+1" on the row saying so - measured on "Apple".
 */
let nameIndex = null;
let indexHooked = false;

function tableIndex() {
    if (nameIndex) return nameIndex;
    if (!indexHooked) {
        indexHooked = true;
        for (const hook of ["createRollTable", "updateRollTable", "deleteRollTable",
                            "createTableResult", "updateTableResult", "deleteTableResult"]) {
            Hooks.on(hook, () => { nameIndex = null; });
        }
    }

    const index = new Map();
    const add = (name, goal, pool) => {
        const key = String(name ?? "").trim().toLowerCase();
        if (!key) return;
        if (!index.has(key)) index.set(key, { kinds: new Set(), pools: [] });
        const row = index.get(key);
        if (USABLE_GOALS[goal]) row.kinds.add(goal);
        if (pool) row.pools.push(pool);
    };

    for (const table of game.tables ?? []) {
        const goal = table.getFlag(MODULE_ID, "goal") ?? null;
        // The row `classifyEntryName` files an entry under: a tier pool, by its flags under any name (E14 fix e1-G2;
        // `isTierPool` on the name until then, so a renamed pool's entries were filed by nothing) or, with none, by
        // its name; minus the goalless usable pool ruled out above.
        const shape = isTierPoolTable(table) ? poolShapeOf(table) : null;
        const pool = shape && !(shape.category === "usable" && !shape.goal)
            ? { category: shape.category, tier: shape.tier, goal: shape.goal ?? null, table: table.name }
            : null;
        for (const r of table.results ?? []) add(r.name ?? r.text ?? "", shape?.goal ?? goal, pool);
    }

    nameIndex = index;
    return index;
}
