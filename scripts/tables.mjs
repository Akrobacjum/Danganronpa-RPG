/**
 * Danganronpa RPG - item tables.
 * ---------------------------------------------------------------------------
 * The guide gives one or two examples per tier and tells the GM to improvise
 * the rest. These lists are that improvisation done in advance, so a Search
 * never stalls waiting for someone to invent a mop.
 *
 * Everything here is deliberately mundane and school-shaped: the horror in a
 * killing game comes from what students do with ordinary objects.
 *
 * Installed into the world as RollTables by `installTables()`, which the GM can
 * then edit freely - once they exist, these definitions are only a fallback.
 */

import { MODULE_ID, ITEM_CATEGORIES, EQUIPPABLE, ITEM_TIERS, USABLE_KINDS, itemIcon,
    TABLE_NAME_WORDS, TABLE_COPY_WORDS }
    from "./config.mjs";
import { dialogContent, wirePortraitPickers, panelTabs, wirePanelTabs, whisperToGms, log, error, plural, esc}
    from "./utils.mjs";
import { pickableCategories } from "./inventory.mjs";
import { alreadyOpen, reopen } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

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
 * answered by its name since before the flags existed. Each table once.
 */
export function tierTablesFor(category, tier, goal = null) {
    const found = flaggedTables(category, tier, goal);
    // Not a table whose flags name another pool (E14 fix e1-G2, 25.10.2026; the review's E14p2-R4): a Tier 2 weapons
    // pool renamed "DRPG Tools - Tier 1" in the sidebar answered a Tier 1 Tool's draw by that name, and the find was
    // a Tier 1 Murder Weapon. The module's own rename refuses that name (`renameOtherPool`); the sidebar does not.
    const another = table => {
        const own = tierPoolOf(table);
        return Boolean(own) && (own.category !== category || own.tier !== Number(tier) || (own.goal ?? null) !== (goal ?? null));
    };
    for (const name of tableNameCandidates(category, tier, goal)) {
        const table = game.tables?.getName?.(name);
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
function tableDescription(category, tier, goal = null) {
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
function poolShapeOf(table) {
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

/** One random item name for a category and tier. */
export function randomItem(category, tier, goal = null) {
    const goalPool = USABLE_GOALS[goal]?.pool;
    const pool = goalPool?.[tier] ?? goalPool?.[0]
        ?? ITEM_POOLS[category]?.[tier] ?? ITEM_POOLS[category]?.[0] ?? [];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
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
function roomTableNames(base, category, tier) {
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
 * Roll on the world's table if one exists, otherwise fall back to the built-in
 * pool. The GM editing a table has to actually change what Search produces.
 * What was drawn comes back with its own category, tier and goal (C3, above `foundAs`).
 *
 * @returns {Promise<{name: string, fromTable: boolean, category: string, tier: number, goal: string|null}|null>}
 */
export async function drawItem(category, tier, { goal = null, room = null, scene = null } = {}) {
    const asked = { category, tier: Number(tier), goal: goal ?? null };
    // The room's own table first, when it has one. A kitchen and a boiler room
    // should not be drawing from the same bag - the guide says outright that
    // what turns up can depend on where you are.
    //
    // It falls THROUGH to the global pool when the room has nothing to give: a
    // room the GM never got round to configuring, or one whose tables are all
    // empty, behaves exactly as it did before. A silent empty-handed Search in a
    // room somebody forgot to set up would just look like a broken action. A room
    // that does stock something answers with it, though, whatever was asked for
    // (D15, below) - since E14 part 2 C2 it no longer hands over the world's
    // healing items beside its own crime tools.
    // A room's table can be split by category the same way the global ones are,
    // and for the same reason: a single "Kitchen" table asked for a crime tool
    // would hand back an apple and then label it a weapon. So "Kitchen - Murder
    // Weapons" (or an older or Polish plural, `roomPluralsOf`) is tried before
    // plain "Kitchen". A GM who does not want that precision makes one flat
    // table and it answers everything.
    // THE ROLL MATTERS IN ROOMS TOO (F5.5, Dawid 2026-08-25). A room table can
    // be split by tier the same way it can be split by category: "Kuchnia -
    // Tier 2" answers a Tier 2 roll in the Kuchnia before the flat "Kuchnia"
    // does. A GM who does not want that precision keeps one flat table and the
    // lookup falls straight through - same bargain as the category split.
    const roomBase = room ? await tableForRoom(room, scene) : null;

    /*
     * THREE STEPS, IN THIS ORDER (D15, the owner: "tabele pokoju mają pierwszeństwo przed pulami świata"; E14 part 2 C2,
     * 24.10.2026): the room's own tables, then the GM's tier pools, then the built-in pools. Until C2 the world's tier
     * pools were asked between the room's named tables and the rest of the room's, so the paragraph below that
     * promises the room answers before the world was not true: an armoury stocked with "Armoury - Murder Weapons" and
     * asked for something to patch you up handed over the world's bandage (audit S08-05; E14-T13 read it at b94e1cac).
     */
    if (roomBase) {
        for (const name of roomTableNames(roomBase, category, tier)) {
            const table = game.tables?.getName?.(name);
            // A tier pool is never a room's stock, whatever its name (E14 fix e1-G2): a room pointed at one before
            // Room Setup read the flags answered every Search there from that pool, at any roll.
            const found = table && !tierPoolOf(table) ? await drawFrom(table) : null;
            if (found) return { ...found, ...roomEntryAs(roomBase, table, found.name, asked) };
        }

        /*
         * THE ROOM ANSWERS WITH WHAT IT HAS, BEFORE THE WORLD ANSWERS AT ALL.
         *
         * The names above ask the room for the tier and the category. For a room the GM DID stock, asking the world
         * next produces the wrong kind of wrong: ask an armoury for something to patch you up and, if the GM built
         * "Armoury - Murder Weapons" and no flat "Armoury", the lookup walks straight past the room and hands over a
         * bandage. In an armoury.
         *
         * So before the world's pools: every table this room owns, picked at random. A player who asks a room for
         * something it does not stock gets what it does stock - which is both funnier and truer than either "nothing"
         * or "a bandage from nowhere". A table is the room's by a suffix this module reads (`isRoomTableOf`), never by
         * its first words alone: "Kitchen - Back room" is another room's pool, not the Kitchen's (S08-45), and a
         * "Kitchen - Tier 3" does not answer a Tier 1 roll.
         *
         * `substitute` travels with it so the card can say so. It is not a failure:
         * the roll was made and beaten, an action and a search token are spent, and
         * something real came out. It is simply not what was asked for.
         */
        const owned = (game.tables?.contents ?? []).filter(t => isRoomTableOf(roomBase, t.name, tier) && !tierPoolOf(t));
        // Shuffled rather than "the first one": the room's tables are named by
        // category and taking the first would silently favour whichever
        // category sorts earliest.
        for (const table of owned.sort(() => Math.random() - 0.5)) {
            const found = await drawFrom(table, { substitute: true });
            if (found) return { ...found, ...roomEntryAs(roomBase, table, found.name, asked) };
        }
    }

    // The GM's tier pools by their flags, then by every name these have ever been
    // called - see `tierTablesFor` and LEGACY_PLURALS. A world whose tables
    // were built before a label was reworded, or by a client in another
    // language, or renamed by its GM, is still the world whose tables answer.
    const pools = [...tierTablesFor(category, tier, goal), ...(goal ? tierTablesFor(category, tier) : [])]
        .filter((table, at, all) => all.indexOf(table) === at);
    for (const table of pools) {
        const found = await drawFrom(table);
        if (found) return { ...found, ...poolEntryAs(table, asked) };
    }

    const picked = randomItem(category, tier, goal);
    if (picked) return { name: picked, fromTable: false, roles: rolesForPoolItem(picked), ...asked };

    // Nothing in the asked-for category anywhere, which is a world with a gap
    // in it rather than a room with a character. Any other category, at random,
    // rather than sending somebody away empty-handed from a roll they beat.
    for (const other of Object.keys(ITEM_CATEGORIES).sort(() => Math.random() - 0.5)) {
        if (other === category || other === "truthBullet") continue;
        const spare = randomItem(other, tier, null);
        if (spare) {
            // Its own category (C3): until then an apple from here was granted as the category nobody stocks.
            return { name: spare, fromTable: false, substitute: true,
                     roles: rolesForPoolItem(spare), category: other, tier: asked.tier, goal: null };
        }
    }
    return null;
}

/** The RollTable a room on this scene draws from, if the GM pointed it at one. */
async function tableForRoom(room, scene) {
    try {
        const { roomTable } = await import("./vault.mjs");
        return roomTable(room, scene);
    } catch {
        return null;
    }
}

/**
 * Every table this module knows how to build: crime tools, cleaning tools, and
 * one table per usable kind so "what mends you" and "what calms you down" are
 * curated separately.
 *
 * No generic usable table any more. Usables are split into healing and stress
 * relief BY table - that assignment is what decides what the item does when it
 * is drunk - so a mixed pool would be a pool of items whose effects nobody
 * chose. A world that already has "DRPG Usables - Tier N" keeps it: `drawItem`
 * still consults it as a fallback, and `usableKindFor` never reads it.
 */
function tableJobs() {
    return [
        ...Object.entries(ITEM_POOLS)
            .filter(([category]) => category !== "usable")
            .flatMap(([category, tiers]) =>
                Object.entries(tiers).map(([tier, names]) => ({ category, tier, names, goal: null }))),
        ...Object.entries(USABLE_GOALS).flatMap(([goal, { pool }]) =>
            Object.entries(pool).map(([tier, names]) => ({ category: "usable", tier, names, goal })))
    ];
}

/**
 * Create the RollTables in the world. Idempotent: tables that already exist are
 * left alone, so a GM's edits are never overwritten.
 *
 * That idempotence is also why the button looked broken. Pressed a second time
 * it did exactly what it promised - nothing - and said so in a single toast that
 * is easy to miss, with no way to force a rebuild short of the console. So the
 * "everything is already here" case now asks what the GM actually wants, every
 * run leaves a receipt in chat, and a table that fails to build is reported
 * instead of vanishing into the loop.
 *
 * @param {object} [options]
 * @param {boolean} [options.overwrite]  Delete and rebuild tables that exist.
 * @param {boolean} [options.prompt]     Ask before doing nothing. Off for API use.
 */
export async function installTables({ overwrite = false, prompt = true } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const jobs = tableJobs();

    // Already complete: offer the rebuild rather than reporting a silent no-op.
    if (prompt && !overwrite) {
        const present = jobs.filter(j => game.tables.getName(existingTableName(j.category, j.tier, j.goal)));
        if (present.length === jobs.length) {
            const choice = await DialogV2.wait({
                window: { title: game.i18n.localize("DRPG.Panel.installTables") },
                classes: ["drpg-panel"],
                content: `<p>${game.i18n.format("DRPG.Tables.allPresent", { n: present.length })}</p>
                          <p class="notes">${game.i18n.localize("DRPG.Tables.rebuildNote")}</p>`,
                buttons: [
                    { action: "keep", label: game.i18n.localize("DRPG.Tables.keep"), default: true },
                    { action: "recreate", label: game.i18n.localize("DRPG.Tables.recreate") },
                    { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
                ],
                rejectClose: false
            });

            if (!choice || choice === "cancel") return null;
            if (choice === "keep") {
                ui.notifications.warn(game.i18n.format("DRPG.Tables.allPresent", { n: present.length }));
                await openTablesTab();
                return { created: [], skipped: present.map(j => existingTableName(j.category, j.tier, j.goal)), failed: [] };
            }
            overwrite = true;
        }
    }

    let folder = game.folders.find(f => f.type === "RollTable" && f.name === "Danganronpa RPG");
    if (!folder) {
        try {
            folder = await Folder.create({ name: "Danganronpa RPG", type: "RollTable", color: "#9d4edd" });
        } catch (err) {
            // A folder is a convenience, not a requirement - the tables are found
            // by name. Losing it must not lose the tables with it.
            error("Could not create the Danganronpa RPG table folder", err);
            folder = null;
        }
    }

    const created = [];
    const skipped = [];
    const failed = [];

    for (const { category, tier, names, goal } of jobs) {
        // Under whatever name it is ALREADY sitting, or today's if it is new -
        // otherwise a world whose tables predate a reworded label gets a second
        // parallel set built beside the ones the GM has been editing.
        const name = existingTableName(category, tier, goal);
        const existing = game.tables.getName(name);

        if (existing && !overwrite) {
            skipped.push(name);
            continue;
        }

        try {
            if (existing && overwrite) await existing.delete();

            await RollTable.create({
                name,
                folder: folder?.id ?? null,
                description: tableDescription(category, tier, goal),
                formula: `1d${names.length}`,
                replacement: true,
                displayRoll: false,
                flags: { [MODULE_ID]: { category, tier: Number(tier), goal } },
                // THE ROW CARRIES THE PICTURE, so the table reads as the
                // module's own and `drawItem` (which takes `result.img`) hands
                // the drawn item an icon without asking the category twice.
                results: names.map((text, index) => ({
                    img: itemIcon(category),
                    // Since v13 a TableResult carries `name` and `description`;
                    // `text` is only kept here for a world still on the old shape.
                    type: CONST.TABLE_RESULT_TYPES?.TEXT ?? "text",
                    text,
                    name: text,
                    description: text,
                    range: [index + 1, index + 1],
                    weight: 1,
                    // The roles ride on the ENTRY, so a found screwdriver
                    // arrives knowing it can be swung and nobody has to
                    // remember. Written once here; edited afterwards on the
                    // table, which is then the only authority.
                    flags: { [MODULE_ID]: { roles: rolesForPoolItem(text) } }
                }))
            });
            created.push(name);
        } catch (err) {
            error(`Could not create the item table "${name}"`, err);
            failed.push(name);
        }
    }

    log(`Item tables: ${created.length} created, ${skipped.length} left alone, ${failed.length} failed.`);

    if (failed.length) {
        ui.notifications.error(plural("DRPG.Tables.someFailed", { n: failed.length }));
    } else {
        ui.notifications.info(game.i18n.format("DRPG.Tables.installed", {
            created: created.length,
            skipped: skipped.length
        }));
    }

    // A receipt that survives the toast, so "did that do anything?" has an answer.
    const list = items => `<ul>${items.map(n => `<li>${foundry.utils.escapeHTML(n)}</li>`).join("")}</ul>`;
    await whisperToGms(`<h3>${game.i18n.localize("DRPG.Panel.installTables")}</h3>
        <p>${game.i18n.format("DRPG.Tables.installed", { created: created.length, skipped: skipped.length })}</p>
        ${created.length ? list(created) : ""}
        ${failed.length ? `<p class="drpg-warning">${plural("DRPG.Tables.someFailed", { n: failed.length })}</p>${list(failed)}` : ""}
        <p><small>${game.i18n.localize("DRPG.Tables.whereNote")}</small></p>`);

    await openTablesTab();
    return { created, skipped, failed };
}

/* ==========================================================================
 * THE TABLE EDITOR
 * --------------------------------------------------------------------------
 * `installTables()` was what the GM-panel tile did, and installing is a thing
 * you do once. Everything after that first minute - adding the knife somebody
 * invented at the table, taking out the item that turned out to be a bad idea,
 * checking what a room can actually produce - meant the Rollable Tables
 * sidebar, with the module's naming convention held in the GM's head.
 *
 * So the installer stays an installer and this is the door: every table the
 * module knows about on the left, what is in the selected one on the right,
 * and one form that puts a new item into as many of them as the GM ticks.
 *
 * THE CONTRACT IS THE TABLE, not an Item document. What a Search produces is a
 * TableResult, `drawItem` reads its name, and `grantItem` builds the Item from
 * the category and tier at the moment it lands on a sheet. Writing Items here
 * instead would be a second, parallel model of the same thing - so the icon and
 * the description go onto the TableResult (`img` and `description`), and
 * `drawItem` carries them across when the item is actually found.
 * ========================================================================== */

const DEFAULT_RESULT_IMG = "icons/svg/item-bag.svg";

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
const ROOM_GROUP_ORDER = [
    "crimeTool", "cleaningTool", "tool", "usable:healing", "usable:stress"
];

/** The group key for a classification: usables split by what they mend. */
function groupKeyOf({ category, goal }) {
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
function groupLabel(key, { short = false } = {}) {
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
function classifyEntryName(name) {
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

function tableItemsHtml(table) {
    const results = Array.from(table?.results ?? []);
    if (!results.length) {
        return `<p class="notes">${game.i18n.localize("DRPG.Tables.tableEmpty")}</p>`;
    }


    if (isTierPoolTable(table)) {
        const shape = poolShapeOf(table);
        const tier = shape?.tier ?? Number(table.getFlag(MODULE_ID, "tier"));
        const home = shape?.category ?? table.getFlag(MODULE_ID, "category");
        return `<ul class="drpg-table-items">${
            results.map(r => tableRowHtml(table, r, { home, tier })).join("")}</ul>`;
    }

    const { chips, unfiledChip, body, unfiledHtml } = roomPoolGroupsHtml(table, results);

    return `<div class="drpg-room-summary">${chips}${unfiledChip}
            <span class="drpg-room-chip drpg-room-chip-total">${
                esc(game.i18n.localize("DRPG.Tables.roomTotal"))} <b>${results.length}</b></span>
        </div>
        <p class="notes">${game.i18n.localize("DRPG.Tables.roomBreakdown")}</p>
        <div class="drpg-room-groups">${body}${unfiledHtml}</div>`;
}

/**
 * The entry list for one table.
 *
 * A TIER pool is one flat list, because every entry in it is the same category
 * at the same tier - that is what the pool is. A ROOM pool is grouped by type
 * and then by tier, with a count on every heading, because "how many weapons
 * are in this room, and how good are they" is the question a room pool is for
 * and a flat list of thirty names cannot answer it.
 */
// EDITED IN PLACE, not in a second window.
//
// The list was read-only, which meant fixing a typo in an item's name was:
// delete the entry, retype it in the form below, tick the same three tables
// again. Every field here is the field itself, saved when it loses focus -
// the same pattern the Remnant card on the map uses, and for the same
// reason: there is nothing here worth a two-step commit.
/*
 * THE ROLES ARE ON THE ROW, because an entry that cannot be inspected is an
 * entry nobody can trust. They were settable when an item was ADDED and
 * invisible ever after - so a GM wanting to know whether their screwdriver
 * could be swung had to delete it and add it again to find out.
 *
 * Gated on the entry's tier: two jobs start at tier 2 (E9), so the boxes on
 * a Tier 0 or Tier 1 entry are disabled and say why rather than being
 * absent - a control that vanishes teaches nothing about the rule that
 * removed it. In a tier pool that tier is the TABLE's; in a room pool it is
 * whatever the tier pools say about this name, and an entry no pool claims
 * gets no boxes, because there is no rule to gate them on.
 *
 * Only the three equippable categories, and not the one the entry itself
 * is: something in the Murder Weapons table is already a Murder Weapon, and
 * a box saying so would be a box that cannot be unticked.
 */
function tableRowHtml(table, r, { home = null, tier = NaN, badge = "" } = {}) {
        const name = r.name ?? r.text ?? "";
        const note = r.description && r.description !== name ? r.description : "";
        const roles = r.getFlag(MODULE_ID, "roles") ?? [];
        const rolesAllowed = Number.isFinite(tier) && tier >= MULTI_ROLE_TIER;
        const offerable = EQUIPPABLE.filter(key => key !== home);
        const roleBoxes = offerable.length && EQUIPPABLE.includes(home)
            ? `<span class="drpg-table-item-roles"${rolesAllowed ? "" : ` data-tooltip="${
                    esc(game.i18n.format("DRPG.Tables.rolesTierOnly", { tier: MULTI_ROLE_TIER }))}"`
              }>${offerable.map(key =>
                `<label class="drpg-check${rolesAllowed ? "" : " drpg-locked"}"><input type="checkbox"
                    data-drpg-role="${key}"${roles.includes(key) ? " checked" : ""}${
                    rolesAllowed ? "" : " disabled"} />${
                    esc(ITEM_CATEGORIES[key]?.label ?? key)}</label>`).join("")}</span>`
            : "";
        return `<li data-drpg-result="${r.id}" data-drpg-table="${table.id}">
            <img src="${esc(r.img || DEFAULT_RESULT_IMG)}" alt="" class="drpg-table-item-icon"
                 data-drpg-result-img="${r.id}"
                 title="${esc(game.i18n.localize("DRPG.Tables.changeIcon"))}" />
            <input type="text" class="drpg-table-item-name" data-drpg-field="name"
                   aria-label="${esc(game.i18n.localize("DRPG.Items.name"))}"
                   data-drpg-owns-table="${table.id}" data-drpg-owns-result="${r.id}"
                   data-drpg-initial="${esc(name)}"
                   value="${esc(name)}" />
            <input type="text" class="drpg-table-item-note notes" data-drpg-field="description"
                   aria-label="${esc(game.i18n.localize("DRPG.Items.description"))}: ${esc(name)}"
                   data-drpg-owns-table="${table.id}" data-drpg-owns-result="${r.id}"
                   data-drpg-initial="${esc(note)}"
                   value="${esc(note)}"
                   placeholder="${esc(game.i18n.localize("DRPG.Items.descriptionPlaceholder"))}" />
            ${badge}
            ${roleBoxes}
            <button type="button" class="drpg-mini-button" data-drpg-place="${r.id}"
                data-drpg-place-table="${table.id}" title="${
                    esc(game.i18n.localize("DRPG.Tables.placeTooltip"))}">⇄</button>
            <button type="button" class="drpg-mini-button" data-drpg-drop="${r.id}"
                data-drpg-drop-table="${table.id}" title="${
                    esc(game.i18n.localize("DRPG.Tables.removeItem"))}">✕</button>
        </li>`;
}

// ---- a room pool: grouped ------------------------------------------
function roomPoolGroupsHtml(table, results) {
    const groups = new Map(ROOM_GROUP_ORDER.map(key => [key, []]));
    const unfiled = [];
    for (const r of results) {
        const found = classifyEntryName(r.name ?? r.text ?? "");
        if (found && groups.has(found.key)) groups.get(found.key).push({ r, found });
        else unfiled.push({ r, found: null });
    }

    /*
     * THE ZEROES ARE THE POINT. A room with no cleaning tools in it is exactly
     * what a GM wants to see at a glance, and a chip that is only drawn when it
     * has something to say cannot say that.
     */
    const chips = ROOM_GROUP_ORDER.map(key => {
        const n = groups.get(key).length;
        return `<span class="drpg-room-chip${n ? "" : " drpg-room-chip-empty"}" data-kind="${key}">${
            esc(groupLabel(key, { short: true }))} <b>${n}</b></span>`;
    }).join("");
    const unfiledChip = unfiled.length
        ? `<span class="drpg-room-chip drpg-room-chip-unfiled">${
            esc(game.i18n.localize("DRPG.Tables.unfiled"))} <b>${unfiled.length}</b></span>`
        : "";

    const tiersOf = rows => {
        const byTier = new Map();
        for (const row of rows) {
            const tier = row.found.tier;
            if (!byTier.has(tier)) byTier.set(tier, []);
            byTier.get(tier).push(row);
        }
        return [...byTier.entries()].sort((a, b) => a[0] - b[0]);
    };

    const body = ROOM_GROUP_ORDER.filter(key => groups.get(key).length).map(key => {
        const rows = groups.get(key);
        const home = key.startsWith("usable:") ? "usable" : key;
        return `<section class="drpg-room-group" data-kind="${key}">
            <h5>${esc(groupLabel(key))}<span class="notes">${rows.length}</span></h5>
            ${tiersOf(rows).map(([tier, mine]) => `<div class="drpg-room-tier">
                <h6>${esc(game.i18n.format("DRPG.Items.tierN", { n: tier }))}
                    <span class="notes">${mine.length}</span></h6>
                <ul class="drpg-table-items">${mine.map(({ r, found }) => tableRowHtml(table, r, {
                    home, tier,
                    badge: found.others.length
                        ? `<span class="drpg-table-item-also" data-tooltip="${
                            esc(found.others.map(o => o.table ?? groupLabel(groupKeyOf(o)))
                                .join(", "))}">+${found.others.length}</span>`
                        : ""
                })).join("")}</ul>
            </div>`).join("")}
        </section>`;
    }).join("");

    /*
     * WHAT "UNFILED" MEANS, and it is not "broken". A name no tier pool holds
     * is a name the module cannot put a category or a tier on - so in a FLAT
     * room table it can come up for any category a Search asks for, which is
     * sometimes exactly what a GM wants and should never be a surprise.
     */
    const unfiledHtml = unfiled.length
        ? `<section class="drpg-room-group drpg-room-group-unfiled" data-kind="unfiled">
            <h5>${esc(game.i18n.localize("DRPG.Tables.unfiled"))}<span class="notes">${
                unfiled.length}</span></h5>
            <p class="notes">${game.i18n.localize("DRPG.Tables.unfiledNote")}</p>
            <ul class="drpg-table-items">${
                unfiled.map(({ r }) => tableRowHtml(table, r)).join("")}</ul>
        </section>`
        : "";
    return { chips, unfiledChip, body, unfiledHtml };
}

/**
 * Add one entry to a table and keep it rollable.
 *
 * `normalize()` is what makes this safe to call on a table a GM has been
 * editing by hand: it re-ranges every result and rewrites the formula, so a
 * table that was `1d4` with four entries becomes `1d5` with five rather than a
 * table whose fifth item can never come up.
 */
async function addResult(table, { name, description = "", img = null, roles = null }) {
    if (!table || !name) return false;
    try {
        const next = (table.results?.size ?? 0) + 1;
        await table.createEmbeddedDocuments("TableResult", [{
            type: CONST.TABLE_RESULT_TYPES?.TEXT ?? "text",
            // `text` as well as `name`, for the same reason `installTables`
            // writes both: a world still on the old shape reads `text`.
            text: name,
            name,
            description: description || name,
            // A GM's own entry gets the category's placeholder unless they
            // picked something, for the same reason the installed rows do.
            img: img || itemIcon(table.getFlag(MODULE_ID, "category")),
            weight: 1,
            // An entry the GM typed gets whatever roles they ticked; one they
            // did not think about falls back to the built-in map, so adding
            // "Hammer" by hand still produces a hammer that works.
            flags: { [MODULE_ID]: { roles: roles ?? rolesForPoolItem(name) } },
            // v14 validates `range` at creation ("cannot have fewer than 2
            // elements"), so it cannot be left for `normalize()` to invent -
            // the write below is provisional and normalize re-ranges the lot.
            range: [next, next]
        }]);
        await table.normalize();
        return true;
    } catch (err) {
        error(`Could not add "${name}" to "${table.name}"`, err);
        return false;
    }
}

/**
 * Write one field of one entry back.
 *
 * `name` and `text` move together: `text` is the pre-v13 shape and `drawItem`
 * still reads it as a fallback, so a name saved into only one of the two would
 * come out of the table differently depending on which world it was rolled in.
 */
async function editResult(table, resultId, field, value) {
    const result = table?.results?.get(resultId);
    if (!result) return false;

    /*
     * AN EMPTIED DESCRIPTION STAYS EMPTIED (Dawid, 31.08).
     *
     * This used to fall back to the entry's own name, so clearing the box put
     * the name back into it and the GM could not delete a description at all.
     * Measured: "A soft, sad little roll." -> cleared -> "Toilet paper".
     *
     * The rule it was reaching for is real, but it belongs at the other end:
     * `drawItem` and `gmGiveItemDialog` both already refuse to print a
     * description that is only the name again. Enforcing it on the WRITE turned
     * a display rule into a field that will not take an edit.
     */
    const patch = field === "name"
        ? { name: value, text: value }
        : { description: value };

    try {
        await result.update(patch);
        return true;
    } catch (err) {
        error(`Could not edit "${table.name}"`, err);
        return false;
    }
}

/** Take one entry out, and re-range what is left. Same reasoning as `addResult`. */
async function dropResult(table, resultId) {
    if (!table || !resultId) return false;
    try {
        await table.deleteEmbeddedDocuments("TableResult", [resultId]);
        await table.normalize();
        return true;
    } catch (err) {
        error("Could not remove a table entry", err);
        return false;
    }
}

/**
 * WHICH POOLS HOLD THIS ITEM, asked on the row itself (Dawid, 01.09).
 *
 * A NEW item could always go into several pools at once - the New item tab has
 * a checkbox for every room pool and works out the tier one. An item that
 * already existed could not: there was no way to put it in a second pool, and
 * no way to move it out of the one it was in except deleting it and typing it
 * again somewhere else, which loses its description, its picture and its roles.
 *
 * So this is that same list of checkboxes, opened on a row instead of on a
 * blank form and pre-ticked with the pools that already hold it. Ticking a pool
 * copies the entry there; unticking one takes it out; and unticking the pool
 * you are looking at is exactly what "move it" means.
 *
 * MATCHED BY NAME, NOT BY ID, because a copy in another table is a different
 * TableResult that happens to be called the same thing - that is all a copy
 * ever is here. Two entries of one name in a pool go together when it is
 * unticked, because "this item is not in that pool" has to be true afterwards.
 *
 * WHAT TRAVELS: the description, the picture and the roles. The roles are
 * trimmed to what the destination allows rather than refused - a tier pool
 * below MULTI_ROLE_TIER takes none (E9: two jobs start at tier 2), and no pool
 * takes a role that is its own category, because an entry in the Murder Weapons
 * table is already a Murder Weapon. A room pool has neither, so it takes them
 * as they are.
 *
 * @returns {Promise<boolean>} whether anything actually moved.
 */
async function placeResultDialog(table, resultId) {
    const source = table?.results?.get(resultId);
    if (!source) return false;

    const name = source.name ?? source.text ?? "";
    const wanted = String(name).trim().toLowerCase();
    if (!wanted) return false;

    const sameName = r => String(r.name ?? r.text ?? "").trim().toLowerCase() === wanted;
    const holds = t => Array.from(t.results ?? []).some(sameName);

    const all = moduleTables();
    const tierList = all.filter(t => isTierPoolTable(t));
    const roomList = all.filter(t => !isTierPoolTable(t));

    const group = (list, label) => list.length
        ? `<fieldset><legend>${esc(label)}</legend>
            <div class="drpg-place-grid">${list.map(t =>
                `<label class="drpg-inline-check"><input type="checkbox"
                    name="table:${t.id}"${holds(t) ? " checked" : ""} /> ${
                    esc(String(t.name).replace(/^DRPG\s+/, ""))}</label>`).join("")}</div>
           </fieldset>`
        : "";

    const picked = await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Tables.placeTitle", { name }) },
        classes: ["drpg-panel", "drpg-wide"],
        position: { height: "auto" },
        modal: true,
        content: `<form>
            <p class="notes">${game.i18n.localize("DRPG.Tables.placeIntro")}</p>
            ${group(tierList, game.i18n.localize("DRPG.Tables.tabTierPools"))}
            ${group(roomList, game.i18n.localize("DRPG.Tables.tabRoomPools"))}
            <p class="notes">${game.i18n.localize("DRPG.Tables.placeRolesNote")}</p>
        </form>`,
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Tables.placeSave"), default: true,
                callback: (e, b, d) => all
                    .filter(t => d.element
                        .querySelector(`[name="table:${CSS.escape(t.id)}"]`)?.checked)
                    .map(t => t.id)
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return false;

    // AN ITEM HAS TO LIVE SOMEWHERE. Clearing every box would delete it from the
    // world, which is what the row's own ✕ is for - and doing it from a window
    // titled "where does this live" would be a surprise, not a shortcut.
    if (!picked.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Tables.placeNone"));
        return false;
    }

    const roles = source.getFlag(MODULE_ID, "roles") ?? [];
    const description = source.description && source.description !== name
        ? source.description : "";
    const rolesFor = target => {
        const home = target.getFlag(MODULE_ID, "category");
        const tier = Number(target.getFlag(MODULE_ID, "tier"));
        if (Number.isFinite(tier) && tier < MULTI_ROLE_TIER) return [];
        return roles.filter(key => key !== home);
    };

    const keep = new Set(picked);
    let added = 0;
    let removed = 0;

    for (const target of all) {
        const has = holds(target);
        if (keep.has(target.id) && !has) {
            if (await addResult(target, {
                name, description, img: source.img ?? null, roles: rolesFor(target)
            })) added++;
        } else if (!keep.has(target.id) && has) {
            for (const r of Array.from(target.results).filter(sameName)) {
                if (await dropResult(target, r.id)) removed++;
            }
        }
    }

    if (!added && !removed) {
        ui.notifications.warn(game.i18n.format("DRPG.Tables.placeUnchanged", { name }));
        return false;
    }

    ui.notifications.info(game.i18n.format("DRPG.Tables.placeDone",
        { name, added, removed }));
    return true;
}

/**
 * Ask for a table's new name, with the warning attached to the asking.
 *
 * @returns {Promise<string|null>} the trimmed name, or `null` if cancelled.
 */
async function promptForTableName(currentName, check = () => null) {
    /* ASKED AGAIN WITH THE REFUSAL UNDER THE FIELD (E14 part 2 C5, S13-09). A refused name used to end in a toast and
       the GM's typing gone; now the prompt comes back holding what they typed, the sentence under it, until a name
       passes `check`, the name is left as it was, or the prompt is closed. */
    let value = currentName, refusal = null;
    for (;;) {
        const result = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("DRPG.Tables.renameTable") },
            classes: ["drpg-panel", "drpg-rename-table"],
            content: `
                <p class="notes">${game.i18n.localize("DRPG.Tables.renameNote")}</p>
                ${nameFieldHtml({ name: "tableName", value, error: refusal?.text })}`,
            ok: {
                label: game.i18n.localize("DRPG.Tables.renameTable"),
                callback: (event, button, dialog) =>
                    dialog.element.querySelector("[name=tableName]")?.value.trim() ?? ""
            },
            rejectClose: false,
            modal: true
        });
        if (typeof result !== "string") return null;
        if (result === currentName) return result;
        refusal = check(result);
        if (!refusal) return result;
        value = result;
    }
}

/**
 * One name field, with its refusal under it when there is one (E14 part 2 C5, S13-09): the field keeps what was typed,
 * says it is invalid to a screen reader and points at the sentence, which is where the GM is looking - a toast alone
 * sat over the window's tabs and was gone in seconds.
 */
function nameFieldHtml({ name, value = "", placeholder = "", error = null }) {
    const errorId = `drpg-name-error-${name.replace(/[^\w-]/g, "-")}`;
    return `<label>${game.i18n.localize("DRPG.Items.name")}
                <input type="text" name="${esc(name)}" value="${esc(value)}"${
                    placeholder ? ` placeholder="${esc(placeholder)}"` : ""}${
                    error ? ` aria-invalid="true" aria-describedby="${errorId}"` : ""} /></label>${
                error ? `
            <p class="drpg-field-error" id="${errorId}" role="alert">${esc(error)}</p>` : ""}`;
}

/**
 * The item tables, editable.
 *
 * @param {object} [options]
 * @param {object} [options.preset]  Prefill for the "add an item" form:
 *   `{ category, tier, room, name }`. Handed in by the ruling card a Search for
 *   "something specific" produces - the GM pressed "Create an item" while
 *   reading a roll that already says which category, which tier and which room,
 *   and re-picking all three here would be answering a question they have just
 *   answered.
 */
/**
 * Which tables the preset points at: the ones this category and tier would
 * actually be drawn from, plus the room's own if it has one. Ticked, not
 * forced - the GM can add or clear any of them before pressing Add.
 */
async function presetTargetsFor(tables, preset) {
    const presetTargets = new Set();
    presetTargets.roomNote = null;
    // The pools this category and tier draw from, by their flags first, as `drawItem` finds them (E14 part 2 C1).
    const pools = new Set(preset?.category
        ? tierTablesFor(preset.category, preset.tier ?? 0, preset.goal ?? null).map(t => t.id) : []);
    /*
     * THE ROOM WITHOUT A CATEGORY (E14 part 2 C6, S08-21). This read the room inside the category's branch, and the
     * one card that sends a preset - a Search for "something specific" (messenger-app.mjs `ruleCreateItem`) - sends no
     * category, so the room the player searched was never ticked. Now the room's tables are the names `drawItem` reads
     * for it (`roomTableNames`: "<room> - Tier N", a plural when there is a category, the flat table), and the window
     * says when the room has none, or when the tier's own is not made yet - "<room> - Tier N", the name offered.
     */
    if (preset?.room) {
        const { sceneOfRoom } = await import("./rooms.mjs");
        const base = await tableForRoom(preset.room, sceneOfRoom(preset.room));
        const tier = preset.tier ?? 0;
        const wanted = base ? (preset.category ? roomTableNames(base, preset.category, tier) : [`${base} - Tier ${tier}`, base]) : [];
        for (const t of tables) if (wanted.includes(t.name)) presetTargets.add(t.id);
        if (!base) {
            presetTargets.roomNote = game.i18n.format("DRPG.Tables.presetRoomNoTable", { room: preset.room });
        } else if (!tables.some(t => t.name === `${base} - Tier ${tier}`)) {
            presetTargets.roomNote = game.i18n.format("DRPG.Tables.presetRoomTier", { room: preset.room, name: `${base} - Tier ${tier}` });
        }
    }
    for (const t of tables) if (pools.has(t.id)) presetTargets.add(t.id);
    return presetTargets;
}

/** The "add an item" tab: what the entry is, where it can go, what else it can do. */
function newItemPaneHtml(preset, presetTargets, roomTablesList) {
    /*
     * WHAT ELSE THIS ENTRY CAN DO (E8).
     *
     * The roles ride on the table entry rather than being set on each item
     * afterwards (Dawid, 27.08), so a screwdriver drawn from a Search arrives
     * already knowing it can be swung. Only the three equippable categories are
     * offered: a role is about what you do with a thing in your hands, and
     * "also a Truth Bullet" means nothing.
     *
     * The item's own category is left in the list on purpose rather than
     * filtered out live - ticking a role an item already has by being what it
     * is changes nothing (`servesAs` checks the home first), and a checkbox
     * list that reshuffles as the category dropdown moves is a worse thing to
     * use than one redundant box.
     */
    const roleChecks = EQUIPPABLE.map(key =>
        `<label class="drpg-check"><input type="checkbox" name="role:${key}" />
            ${foundry.utils.escapeHTML(ITEM_CATEGORIES[key]?.label ?? key)}</label>`).join("");

    /*
     * SPLIT BY KIND, AND NO ROOM KEYS (audit A22).
     *
     * This list used to be `ITEM_CATEGORIES` minus Truth Bullets, which offered
     * a flat "Usable" and a "Room Key". Neither could make a working item here:
     * `tierTableIdFor` resolves a bare `usable` to the retired mixed pool, so
     * the entry either landed in a table `usableKindFor` never reads or nowhere
     * at all - and a key with no room flag opens nothing. `pickableCategories`
     * is the one list all four of the module's item forms now ask.
     *
     * A preset names a bare category (`usable`), never a kind: the only card
     * that sends one is a Search for "something specific", which by definition
     * asked for no category at all. Matching on the key as well as the value is
     * what makes such a preset land on that category's first kind rather than
     * on nothing.
     */
    const categoryList = pickableCategories();
    const presetValue = preset?.category ?? null;
    // Exactly one row carries `selected`. Matching the key as well would mark
    // BOTH usable kinds when a preset says `usable`, and a select with two
    // selected options quietly keeps the last one.
    const presetChoice = categoryList.find(c => c.value === presetValue)
        ?? categoryList.find(c => c.key === presetValue)
        ?? null;
    const categories = categoryList.map(c =>
        `<option value="${esc(c.value)}"${
            c === presetChoice ? " selected" : ""}>${esc(c.label)}</option>`).join("");

    const tiers = ITEM_TIERS.map(t => `<option value="${t}"${
        t === Number(preset?.tier ?? 2) ? " selected" : ""}>${
        game.i18n.format("DRPG.Items.tierN", { n: t })}</option>`).join("");

    const roomChecks = roomTablesList.map(t => `<label class="drpg-inline-check">
        <input type="checkbox" name="target:${t.id}"${
            presetTargets.has(t.id) ? " checked" : ""} /> ${esc(t.name)}</label>`).join(" ");

    return `
            <fieldset class="drpg-tables-new">
                <legend>${game.i18n.localize("DRPG.Tables.addItem")}</legend>
                <div class="drpg-tables-new-head">
                    <img src="${esc(preset?.img || DEFAULT_RESULT_IMG)}" alt=""
                         class="drpg-project-portrait" data-drpg-portrait="new" />
                    <input type="hidden" name="img.new" value="${esc(preset?.img || "")}" />
                    <label>${game.i18n.localize("DRPG.Items.name")}
                        <input type="text" name="newName" value="${esc(preset?.name ?? "")}"
                               placeholder="${esc(game.i18n.localize("DRPG.Items.namePlaceholder"))}" /></label>
                </div>
                <label>${game.i18n.localize("DRPG.Items.description")}
                    <textarea name="newText" rows="2"
                        placeholder="${esc(game.i18n.localize("DRPG.Items.descriptionPlaceholder"))}"></textarea></label>
                <label>${game.i18n.localize("DRPG.Items.category")}
                    <select name="newCategory">${categories}</select></label>
                <label>${game.i18n.localize("DRPG.Items.tier")}
                    <select name="newTier">${tiers}</select></label>
                <p class="notes" data-drpg-tier-target></p>
                <div class="drpg-tables-roles">
                    <span class="notes" data-drpg-roles-note>${
                        game.i18n.localize("DRPG.Tables.rolesNote")}</span>
                    ${roleChecks}
                </div>
                <div class="drpg-tables-targets">
                    <span class="notes">${game.i18n.localize("DRPG.Tables.roomTargets")}</span>
                    ${roomChecks || `<span class="notes">${game.i18n.localize("DRPG.Tables.noRoomTables")}</span>`}
                </div>${presetTargets.roomNote ? `
                <p class="notes" data-drpg-room-note>${esc(presetTargets.roomNote)}</p>` : ""}
                <p class="notes">${game.i18n.localize("DRPG.Tables.addNote")}</p>
            </fieldset>`;
}

/*
 * THE LIST SHOWS THE NAME, NOT THE PREFIX.
 *
 * Every tier pool is called "DRPG something - Tier N", and in a column this
 * narrow those five characters cost a whole wrapped line on all twenty-five
 * of them. Display only: rename, delete and every lookup still use the real
 * name, because the name is how `drawItem` finds the table.
 */
function shortPoolName(name) {
    return String(name ?? "").replace(/^DRPG\s+/, "");
}

/* ONE FORM OF THE NAME (E14 part 2 C7, S08-24): the heading over a pool's entries read "DRPG CLEANING TOOLS - TIER 0"
   above a list that says "Cleaning Tools - Tier 0". The heading drops the prefix now, as the list does, and the whole
   name - what Rename shows and what the draw reads - is the tooltip of both. */
function showPoolName(el, name) {
    if (!el) return;
    el.textContent = shortPoolName(name);
    el.title = name ?? "";
}

/*
 * ONE PANE, BUILT TWICE (Dawid, 31.08).
 *
 * Tier pools answer "what can a Search turn up for this category and tier";
 * room pools answer "what is lying about in this room". A GM works on one
 * or on the other and never on both at once, and a single list mixed
 * twenty-five entries from the two families together.
 *
 * The two tabs are the same component with a different list and a different
 * rule about what a new pool may be called - see `wirePoolPane`, which is also
 * written once and run twice.
 */
export function poolPaneHtml(family, mine, selected, refusal = null) {
    const first = mine.find(t => t.id === selected?.id) ?? mine[0] ?? null;
    const list = mine.length
        ? `<ul class="drpg-tables-list">${mine.map(t =>
            `<li><button type="button" class="drpg-table-pick${
                t.id === first?.id ? " active" : ""}" data-drpg-table="${t.id}" title="${esc(t.name)}">
                <span>${esc(shortPoolName(t.name))}</span>
                <span class="notes">${t.results.size}</span>
            </button></li>`).join("")}</ul>`
        : `<p class="notes">${esc(game.i18n.localize(family === "tiers"
            ? "DRPG.Tables.noTierPools" : "DRPG.Tables.noRoomPools"))}</p>`;

    return `<div data-drpg-pane="${family}">
        <p class="notes">${game.i18n.localize("DRPG.Tables.editorIntro")}</p>
        <div class="drpg-tables-layout">
            <div class="drpg-tables-left">${list}</div>
            <div class="drpg-tables-right">
                <div class="drpg-table-heading">
                    <h4 data-drpg-table-name title="${esc(first?.name ?? "")}">${esc(shortPoolName(first?.name))}</h4>
                    <button type="button" class="drpg-mini-button" data-drpg-rename-table>${
                        esc(game.i18n.localize("DRPG.Tables.renameTable"))}</button>
                    <button type="button" class="drpg-mini-button" data-drpg-delete-table>${
                        esc(game.i18n.localize("DRPG.Tables.deleteTable"))}</button>
                </div>
                <div data-drpg-table-body>${
                    first ? tableItemsHtml(first)
                        : `<p class="notes">${game.i18n.localize("DRPG.Tables.noneYet")}</p>`
                }</div>
            </div>
        </div>
        <fieldset class="drpg-tables-new">
            <legend>${esc(game.i18n.localize(family === "tiers"
                ? "DRPG.Tables.newTierPool" : "DRPG.Tables.newPool"))}</legend>
            ${nameFieldHtml({ name: `newPool:${family}`, value: refusal?.name ?? "",
                placeholder: game.i18n.localize(family === "tiers"
                    ? "DRPG.Tables.newTierPoolPlaceholder" : "DRPG.Tables.newPoolPlaceholder"),
                error: refusal?.text })}
            <p class="notes">${game.i18n.localize(family === "tiers"
                ? "DRPG.Tables.newTierPoolNote" : "DRPG.Tables.newPoolNote")}</p>
        </fieldset>
        ${family === "tiers" ? `
        <p class="notes">${game.i18n.localize("DRPG.Tables.whereNote")} ${
            game.i18n.localize("DRPG.Tables.installTabNote")}</p>` : ""}
    </div>`;
}

/** What the Add button hands back: the new-item form, read as a plain object. */
function readNewItemForm(d, roomTablesList) {
    const f = d.element.querySelector("form");
    return {
        name: f.newName.value.trim(),
        description: f.newText.value.trim(),
        img: f.querySelector('[name="img.new"]')?.value ?? "",
        category: f.newCategory.value,
        tier: Number(f.newTier.value),
        roles: EQUIPPABLE.filter(key =>
            f.querySelector(`[name="role:${key}"]`)?.checked),
        tables: [
            tierTableIdFor(f.newCategory.value, Number(f.newTier.value)),
            ...roomTablesList
                .filter(t => f.querySelector(`[name="target:${CSS.escape(t.id)}"]`)?.checked)
                .map(t => t.id)
        ].filter(Boolean)
    };
}

/** What the Create-table button hands back: the name typed on the pane that is showing, and which pane. */
function readNewPoolName(d) {
    // The pane on screen answers first. Both editing tabs carry
    // this field and both keep their value while the other tab
    // is showing, so "whichever is not empty" would hand the
    // tier pane's leftover text to a GM looking at the room one.
    const open = d.element
        .querySelector(".drpg-gmt-section.active [data-drpg-pane]")
        ?.dataset.drpgPane;
    const families = open ? [open, ...["tiers", "rooms"].filter(f => f !== open)]
        : ["tiers", "rooms"];
    for (const family of families) {
        const value = d.element
            .querySelector(`[name="newPool:${family}"]`)?.value.trim() ?? "";
        if (value) return { newPool: value, family };
    }
    return { newPool: "", family: open ?? "rooms" };
}

/** The new-item form's own rules: the tier pool it resolves to, said out loud, and roles gated by tier. */
function wireNewItemForm(root) {
    /*
     * TWO TAGS START AT TIER 2 (Dawid, 27.08).
     *
     * Enforced where the choice is made rather than checked afterwards:
     * a rule that only complains once the entry exists is a rule the GM
     * meets as an error message. Below the threshold the boxes go grey
     * and clear themselves, so moving the tier down cannot leave a tick
     * behind that nobody can see any more.
     */
    const tierSelect = root.querySelector("[name=newTier]");
    const roleBoxes = [...root.querySelectorAll('[name^="role:"]')];
    /*
     * WHICH TIER POOL THIS LANDS IN, said out loud.
     *
     * Derived rather than picked now, and a derived thing the GM cannot
     * see is one they cannot check - so the pane names the pool it
     * resolved to, and says plainly when there is none rather than
     * failing quietly on Add.
     */
    const tierLine = root.querySelector("[data-drpg-tier-target]");
    const paintTierTarget = () => {
        if (!tierLine) return;
        const form = root.querySelector("form");
        const id = tierTableIdFor(form?.newCategory?.value, Number(form?.newTier?.value));
        const table = id ? game.tables.get(id) : null;
        tierLine.textContent = table
            ? game.i18n.format("DRPG.Tables.tierTargetIs", { table: table.name })
            : game.i18n.localize("DRPG.Tables.tierTargetNone");
        tierLine.classList.toggle("drpg-warning", !table);
    };
    root.querySelector("[name=newCategory]")?.addEventListener("change", paintTierTarget);
    root.querySelector("[name=newTier]")?.addEventListener("change", paintTierTarget);
    paintTierTarget();

    const gateRoles = () => {
        const allowed = Number(tierSelect?.value) >= MULTI_ROLE_TIER;
        for (const box of roleBoxes) {
            box.disabled = !allowed;
            if (!allowed) box.checked = false;
            box.closest("label")?.classList.toggle("drpg-locked", !allowed);
        }
        root.querySelector("[data-drpg-roles-note]")
            ?.classList.toggle("drpg-warning", !allowed);
    };
    tierSelect?.addEventListener("change", gateRoles);
    // ONE EXTRA ROLE, NOT TWO. The home is a tag as well, so a second
    // tick would make three - see MAX_EXTRA_ROLES.
    for (const box of roleBoxes) {
        box.addEventListener("change", () => {
            if (!box.checked) return;
            const ticked = roleBoxes.filter(b => b.checked);
            for (const other of ticked) {
                if (other !== box) other.checked = false;
            }
        });
    }
    gateRoles();
}

/*
 * ONE PANE'S WIRING, RUN FOR EACH PANE.
 *
 * Everything below was written against a single list and found its
 * pieces with `root.querySelector`. With two lists that would have
 * bound the tier pane's buttons to the room pane's body, so the
 * lookups are scoped to a pane and the whole thing runs twice. `root`
 * is only for what reaches across panes: the counts in the other list.
 */
/*
 * A RENAME IS CHECKED LIKE A NEW TABLE (E14 part 2 C5, S08-45).
 *
 * Until E14 this module found its tier pools by name, so a pool renamed to
 * something the lookup did not build stopped being drawn from, and this asked
 * before it wrote for that reason alone - while taking any name at all. The
 * draw goes by the flags since C1, but the tables window and Room Setup still
 * sort a table into its family by its name, so a tier pool renamed "Kitchen"
 * moved to the Room pools tab and a room table renamed "DRPG Tools - Tier 2"
 * left Room Setup's list. `poolNameRefusal` is the one check, for the pane's
 * family, and the prompt keeps the typed name with the refusal under it.
 */
function wirePaneHeading(pane, root, { current, show, nameEl }) {
    /* ITS OWN TWO BUTTONS, LOOKED UP HERE (22.09). When this was split out of
       `wirePoolPane` (1.2.44) the listeners came with it and the two lookups stayed
       behind, so the first line threw `ReferenceError: renameButton is not defined`
       during render - the window-at-0,0 failure the note on `wirePaneRows` describes,
       in the piece next to it: the Item tables window opened pinned to the top left
       corner and could not be dragged. Seen on Forge on 1.2.50. */
    const renameButton = pane.querySelector("[data-drpg-rename-table]");
    const deleteButton = pane.querySelector("[data-drpg-delete-table]");

    renameButton?.addEventListener("click", async ev => {
        ev.preventDefault();
        if (!current()) return;

        // The pane's family, unless the table's flags say it is a tier pool (see `poolNameRefusal`).
        const family = pane.dataset.drpgPane === "tiers" ? "tiers" : "rooms";
        const name = await promptForTableName(current().name,
            typed => poolNameRefusal(typed, family, { table: current() }));
        if (name === null || name === current().name) return;

        try {
            await current().update({ name });
            showPoolName(nameEl, name);
            const button = root.querySelector(`[data-drpg-table="${CSS.escape(current().id)}"]`);
            const entry = button?.querySelector("span");
            if (entry) entry.textContent = shortPoolName(name);
            if (button) button.title = name;
            ui.notifications.info(game.i18n.format("DRPG.Tables.renamed", { name }));
        } catch (err) {
            error("Could not rename an item table", err);
        }
    });

    deleteButton?.addEventListener("click", async ev => {
        ev.preventDefault();
        if (!current()) return;

        // The count is the point of the question. "Delete this table?"
        // and "delete this table and the fourteen items in it?" deserve
        // different answers, and only one of them is on screen.
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("DRPG.Tables.deleteTable") },
            content: `<p>${game.i18n.format("DRPG.Tables.deleteConfirm", {
                name: esc(current().name), n: current().results.size
            })}</p>`,
            rejectClose: false, modal: true
        });
        if (!ok) return;

        const gone = current();
        try {
            await gone.delete();
        } catch (err) {
            error("Could not delete an item table", err);
            return;
        }

        root.querySelector(`[data-drpg-table="${CSS.escape(gone.id)}"]`)
            ?.closest("li")?.remove();
        const next = pane.querySelector("[data-drpg-table]");
        if (next) next.click();
        else show(null);
        ui.notifications.info(game.i18n.format("DRPG.Tables.deleted", { name: gone.name }));
    });
}

/*
 * DELEGATED, AND BOUND TO THE PANE (Dawid, 01.09).
 *
 * The entry list is rebuilt whenever a table is picked or an entry
 * is dropped, so listeners bound to the rows themselves would go
 * with them. `focusout` is here for the same reason: it bubbles
 * where `blur` does not.
 *
 * ON THE PANE, NOT ON `root`. The comment that used to stand here
 * said these three were pane-agnostic and could live outside the
 * pane's own wiring; the code did not agree with it. Every one of
 * them reaches for `show`, which belongs to `wirePoolPane` - it is
 * handed down as an argument now, and when it was a closure the
 * first line of the first handler threw `ReferenceError: bodyEl is
 * not defined` during render, before Foundry had placed the window.
 *
 * That is what pinned this window to the top left corner and made
 * it undraggable: a render that throws never reaches `setPosition`,
 * so no `left`/`top` is ever written, and the drag handler has
 * nothing to add its delta to. Measured at 1440x900: inline style
 * `z-index: 103` and nothing else, rect at 0,0. Every row control
 * was dead for the same reason - deleting an entry, ticking a role
 * and renaming in place are all in these three listeners.
 */
function wirePaneRows(pane, root, show) {
    pane.addEventListener("click", async ev => {
        const place = ev.target.closest("[data-drpg-place]");
        if (place) {
            ev.preventDefault();
            const owner = game.tables.get(place.dataset.drpgPlaceTable);
            if (await placeResultDialog(owner, place.dataset.drpgPlace)) {
                show(owner);
                // The counts in BOTH lists move when an entry is copied
                // out of one pool into another, and the pane that is not
                // on screen is the one a GM is most likely to check next.
                for (const button of root.querySelectorAll("[data-drpg-table]")) {
                    const t = game.tables.get(button.dataset.drpgTable);
                    const badge = button.querySelector(".notes");
                    if (t && badge) badge.textContent = t.results.size;
                }
            }
            return;
        }

        const drop = ev.target.closest("[data-drpg-drop]");
        if (drop) {
            ev.preventDefault();
            const table = game.tables.get(drop.dataset.drpgDropTable);
            if (await dropResult(table, drop.dataset.drpgDrop)) show(table);
            return;
        }

        const icon = ev.target.closest("[data-drpg-result-img]");
        if (!icon) return;
        ev.preventDefault();

        const row = icon.closest("[data-drpg-result]");
        const table = game.tables.get(row?.dataset.drpgTable);
        const result = table?.results?.get(row?.dataset.drpgResult);
        if (!result) return;

        new foundry.applications.apps.FilePicker.implementation({
            type: "image",
            current: result.img || DEFAULT_RESULT_IMG,
            callback: async path => {
                try {
                    await result.update({ img: path });
                    icon.src = path;
                } catch (err) {
                    error("Could not change a table entry's icon", err);
                }
            }
        }).render(true);
    });

    /*
     * Ticking a role saves it immediately, like every other field here.
     *
     * `change`, not `focusout`: a checkbox that waits for the blur is a
     * checkbox the GM has to click away from to commit, and half of
     * them will not.
     *
     * ONE EXTRA ROLE. The home is a tag too, so a second tick would
     * make three - the other boxes in the row clear themselves, which
     * reads as "moving the choice" rather than as a refusal.
     */
    pane.addEventListener("change", async ev => {
        const box = ev.target.closest("[data-drpg-role]");
        if (!box) return;

        const row = box.closest("[data-drpg-result]");
        const table = game.tables.get(row?.dataset.drpgTable);
        const result = table?.results?.get(row?.dataset.drpgResult);
        if (!result) return;

        const siblings = [...row.querySelectorAll("[data-drpg-role]")];
        if (box.checked) {
            for (const other of siblings) {
                if (other !== box) other.checked = false;
            }
        }
        const roles = siblings.filter(b => b.checked).map(b => b.dataset.drpgRole);

        try {
            await result.setFlag(MODULE_ID, "roles", roles);
            box.closest("label")?.classList.add("drpg-saved");
            setTimeout(() => box.closest("label")?.classList.remove("drpg-saved"), 1200);
        } catch (err) {
            error(`Could not change the roles on "${result.name ?? result.text}"`, err);
        }
    });

    /*
     * WHAT WRITES A ROW. Enter, and a window closing under a focused
     * field, are both handled for every module window at once by
     * `guardTextFields` in utils.mjs - this window is where they were
     * found and measured, and the note there says so.
     */
    pane.addEventListener("focusout", async ev => {
        const field = ev.target.closest("[data-drpg-field]");
        if (!field) return;

        /*
         * ONLY A FIELD SOMEBODY CHANGED IS WRITTEN (Dawid, 31.08).
         *
         * A default entry ships with `description === name`, and a
         * description that is only the name again renders as an EMPTY
         * box - so every untouched row in the window is a blank field
         * sitting over a stored value. Until 1.2.4 committing one of
         * those wrote the name back and was a harmless no-op; 1.2.4
         * made empty mean empty, which is right, and in the same
         * version the text guard started letting focus pass through
         * fields far more often. Between them, switching from one table
         * to another wiped the descriptions of rows nobody had touched.
         *
         * Measured: "Bent nail", box renders "", stored "Bent nail",
         * one focusout with no edit at all -> stored "".
         *
         * The rule that was missing is this one, and it is the rule the
         * window always meant: a commit with no difference is not a
         * write.
         */
        if (field.value.trim() === (field.dataset.drpgInitial ?? "")) return;

        // The ids live on the FIELD as well as on the row. Switching
        // tables redraws the whole list, and a field that is blurred by
        // that click has already been orphaned by the time this runs -
        // `closest` would find nothing and the edit would vanish.
        const row = field.closest("[data-drpg-result]");
        const table = game.tables.get(field.dataset.drpgOwnsTable ?? row?.dataset.drpgTable);
        const resultId = field.dataset.drpgOwnsResult ?? row?.dataset.drpgResult;
        if (!table || !resultId) return;

        const saved = await editResult(
            table, resultId, field.dataset.drpgField, field.value.trim());
        if (saved) {
            // What was just written is what this field now holds, so a
            // second blur over it is a no-op like any other untouched
            // field.
            field.dataset.drpgInitial = field.value.trim();

            // The same brief mark the Remnant card uses for "that
            // landed", removed again so a window left open does not
            // keep claiming it.
            field.classList.add("drpg-saved");
            setTimeout(() => field.classList.remove("drpg-saved"), 1200);
        }
    });
}

function wirePoolPane(pane, root) {
    const nameEl = pane.querySelector("[data-drpg-table-name]");
    const bodyEl = pane.querySelector("[data-drpg-table-body]");
    const renameButton = pane.querySelector("[data-drpg-rename-table]");
    const deleteButton = pane.querySelector("[data-drpg-delete-table]");

    /* THE HIGHLIGHTED ONE, NOT THE FIRST (E14 part 2 C6, S08-21). `poolPaneHtml` highlights the table a preset ticked,
       and this took the first button of the list, so Rename and Delete acted on a table the pane was not showing. */
    const firstButton = pane.querySelector("[data-drpg-table].active") ?? pane.querySelector("[data-drpg-table]");
    let current = game.tables.get(firstButton?.dataset.drpgTable) ?? null;

    /*
     * WRITE WHAT IS ON SCREEN BEFORE TAKING IT OFF SCREEN.
     *
     * Switching tables replaces the whole list, and a field blurred by
     * that click has already been orphaned by the time its `focusout`
     * arrives - a detached node bubbles to nothing, so the listener on
     * `bodyEl` never sees it and the edit is gone. Measured: typed a
     * description, clicked another table, the entry kept its old text.
     *
     * The text guard catches this in a real browser by blurring on
     * `pointerdown`, before the click. This does not depend on that
     * order at all: the list is the only thing that knows its rows are
     * about to stop existing, so it is the thing that writes them.
     */
    const flush = async () => {
        for (const field of bodyEl.querySelectorAll("[data-drpg-field]")) {
            const value = field.value.trim();
            if (value === (field.dataset.drpgInitial ?? "")) continue;
            const table = game.tables.get(field.dataset.drpgOwnsTable);
            if (!table || !field.dataset.drpgOwnsResult) continue;
            await editResult(table, field.dataset.drpgOwnsResult,
                field.dataset.drpgField, value);
            field.dataset.drpgInitial = value;
        }
    };

    const show = async table => {
        await flush();
        current = table ?? null;
        showPoolName(nameEl, table?.name ?? "");
        bodyEl.innerHTML = table ? tableItemsHtml(table) : "";
        // Nothing selected is a real state - an empty world has no
        // tables at all - and a live button over nothing is a trap.
        if (renameButton) renameButton.disabled = !table;
        if (deleteButton) deleteButton.disabled = !table;
    };
    show(current);

    for (const button of pane.querySelectorAll("[data-drpg-table]")) {
        button.addEventListener("click", ev => {
            ev.preventDefault();
            for (const b of pane.querySelectorAll("[data-drpg-table]")) {
                b.classList.toggle("active", b === button);
            }
            show(game.tables.get(button.dataset.drpgTable));
        });
    }

    wirePaneHeading(pane, root, { current: () => current, show, nameEl });
    wirePaneRows(pane, root, show);
}

/**
 * Make the pool the Create-table button asked for, or say why not.
 *
 * @returns {Promise<object|null>}  the refusal, with the name typed and the tab it was typed on, for the window to
 *   show at the field when it comes back; null when a table was made.
 */
async function createPoolFrom(action) {
    const name = action.newPool;
    /*
     * THE NAME HAS TO MATCH THE TAB, AND ON THE TIER POOLS TAB IT HAS TO BE ONE THE MODULE READS (E14 part 2 C5).
     *
     * A room table named like a tier pool leaves Room Setup's list, and a tier pool named like nothing the module reads
     * was filed as a room table here until E14 (S08-45) - see `poolNameRefusal`. The toast stays for a GM looking
     * elsewhere; the sentence that stays is the one at the field (S13-09).
     */
    const refusal = poolNameRefusal(name, action.family === "tiers" ? "tiers" : "rooms");
    if (refusal) {
        ui.notifications.warn(refusal.text);
        return { ...refusal, name: name ?? "", family: action.family === "tiers" ? "tiers" : "rooms" };
    }
    /*
     * THE FLAGS SAY WHICH FAMILY IT IS IN (TABLES-01, 20.09).
     *
     * Both tabs came through here and both got `roomPool: true` with no
     * category, tier or goal - so a tier pool a GM made was a table the
     * module could not file: its items showed up unfiled in the index, and a
     * usable drawn from it had no kind, which is what decides whether it
     * restores Health or Sanity.
     *
     * READ BACK OFF THE NAME. A name this module does not recognise keeps
     * `roomPool: true` and the room receipt - that is honest rather than a
     * guess, and it is what the Room pools tab is for. Since E14 part 2 C5
     * the Tier pools tab refuses such a name before this (`poolNameRefusal`),
     * so only the Room pools tab reaches it.
     */
    const known = classifyTableName(name);
    await RollTable.create({
        name,
        formula: "1d1",
        flags: {
            [MODULE_ID]: known
                ? { category: known.category, tier: known.tier, goal: known.goal }
                : { roomPool: true }
        }
    });
    ui.notifications.info(game.i18n.format(known
        ? "DRPG.Tables.tierPoolCreated"
        : "DRPG.Tables.poolCreated", { name }));
    log(`Item tables: ${known
        ? `tier pool "${name}" created (${known.category}, tier ${known.tier}${
            known.goal ? `, ${known.goal}` : ""})`
        : `room pool "${name}" created`}.`);
    return null;
}

/** Put the new entry into every table the form ticked. */
async function addItemFrom(action) {
    let added = 0;
    for (const id of action.tables) {
        const table = game.tables.get(id);
        if (await addResult(table, {
            name: action.name, description: action.description, img: action.img,
            // An empty tick-list means "just what it is", which is different
            // from "nobody said" - so it is passed as [] rather than null, and
            // the built-in fallback in `addResult` stays out of the way.
            roles: action.roles ?? []
        })) added++;
    }

    log(`Item tables: "${action.name}" added to ${added} table(s).`);
    ui.notifications.info(plural("DRPG.Tables.itemAdded", { name: action.name, n: added }));
}

export async function openItemTables({ preset = null, poolError = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-tables")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const tables = moduleTables();

    const presetTargets = await presetTargetsFor(tables, preset);

    const selected = tables.find(t => presetTargets.has(t.id)) ?? tables[0] ?? null;

    // ONE tier table, ANY number of room tables (F5.5, 2026-08-25).
    //
    // An item lives in exactly one tier pool - that is what the tier is - so
    // the tier family is a dropdown with a single choice ("-" for an item that
    // only ever appears in rooms). Room tables keep the checkboxes: a knife can
    // sit in the Kitchen and the Workshop at once.
    // By the flags (E14 fix e1-G2): a tier pool the GM renamed in the sidebar is still on the Tier pools tab.
    const tierTables = tables.filter(t => isTierPoolTable(t));
    const roomTablesList = tables.filter(t => !isTierPoolTable(t));

    // Not `tableDialog()`: there is no table in here to measure. Its two panes
    // are a list and a form, and a window sized by `fitWindowToTable` with
    // nothing to measure keeps whatever width the dialog opened at - which is
    // 400px, and half of what this layout needs. `drpg-wide` is the manual
    // override that exists for exactly this case.
    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Tables.editorTitle") },
        classes: ["drpg-panel", "drpg-projects", "drpg-wide", "drpg-window-tables"],
        position: { height: "auto" },
        // Three tabs (Dawid, 26.08; trimmed from four in E10): editing what a
        // tier table holds, the same for room tables, and making a new item.
        // The footer buttons act across tabs - each reads its own pane's
        // inputs, which stay in the DOM whichever tab is showing (see
        // `panelTabs` in utils.mjs).
        //
        // A refused table name comes back on the tab it was typed on, kept in its field
        // with the refusal under it (E14 part 2 C5, S13-09): the window used to reopen on
        // the first tab with the field empty, so on the Room pools tab the GM saw neither.
        // A preset opens on Add an item, where its name and tier are (C6, S08-21): it
        // opened on Tier pools, with Create table and Install in the footer.
        content: dialogContent(`<form>${panelTabs([
            { key: "editTiers", label: game.i18n.localize("DRPG.Tables.tabTierPools"),
              html: poolPaneHtml("tiers", tierTables, selected, poolError?.family === "tiers" ? poolError : null) },
            { key: "editRooms", label: game.i18n.localize("DRPG.Tables.tabRoomPools"),
              html: poolPaneHtml("rooms", roomTablesList, selected, poolError?.family === "rooms" ? poolError : null) },
            { key: "newItem", label: game.i18n.localize("DRPG.Tables.tabNewItem"),
              html: newItemPaneHtml(preset, presetTargets, roomTablesList) }
        ], { active: poolError ? (poolError.family === "rooms" ? "editRooms" : "editTiers") : preset ? "newItem" : null })}</form>`),
        buttons: [
            {
                action: "add", label: game.i18n.localize("DRPG.Tables.addItem"), default: true,
                callback: (e, b, d) => readNewItemForm(d, roomTablesList)
            },
            {
                // "Create table", not "New room table": the tab is called that
                // already, and a button repeating its tab's name says nothing
                // about what pressing it does.
                action: "newPool", label: game.i18n.localize("DRPG.Tables.createTable"),
                // Each pane has its own field, and the one with something in it
                // is the one that was meant - a GM types in the tab they are
                // looking at. The family travels with the name because it
                // decides what the name is allowed to be.
                callback: (e, b, d) => readNewPoolName(d)
            },
            { action: "install", label: game.i18n.localize("DRPG.Tables.installAction") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (event, dialog) => {
            const root = dialog.element;
            wireNewItemForm(root);
            /*
             * ONE FOOTER, FOUR TABS, AND UNTIL NOW ALL FOUR BUTTONS ON EACH.
             *
             * The default button said "Add an item" on the Edit tab and read
             * the new-item form from a pane that was not on screen - press the
             * obvious button and the window answers about a question you cannot
             * see. Editing has no footer action at all: its rows save
             * themselves, and the two things it does need are beside the
             * heading, where the thing they act on is.
             */
            /*
             * THE KEYS ARE THE TAB KEYS, and they were the OLD tab keys.
             *
             * When the one editing tab became two (`edit` -> `editTiers` and
             * `editRooms`) and the "New room table" tab was folded into them,
             * this map was left behind. `buttons[key] ?? []` then answered with
             * nothing on both editing tabs, so the only footer button either of
             * them showed was Close - and Create table, which is what the field
             * at the bottom of each pane is for, could not be reached at all.
             *
             * Both editing tabs carry `newPool` because both have that field.
             * Which pane the name is read from is decided on the way out, by
             * the tab that is open - see the button's callback.
             */
            wirePanelTabs(root, {
                buttons: {
                    // "Install the default set" sits on the Tier pools tab
                    // rather than on a tab of its own (E10): the whole Install
                    // tab was two sentences and this button, and the sentences
                    // are about the tier tables the tab already shows.
                    editTiers: ["newPool", "install"],
                    editRooms: ["newPool"],
                    newItem: ["add"]
                },
                always: ["close"]
            });
            wirePortraitPickers(root, { defaultImg: DEFAULT_RESULT_IMG });

            for (const pane of root.querySelectorAll("[data-drpg-pane]")) wirePoolPane(pane, root);
            root.querySelector('[data-drpg-pane] input[aria-invalid="true"]')?.focus();
        },
        rejectClose: false
    });

    if (!action || action === "close") return null;

    if (action === "install") {
        await installTables();
        return openItemTables({ preset });
    }

    if (typeof action.newPool === "string") {
        const refused = await createPoolFrom(action);
        /*
         * THROUGH `reopen`, BECAUSE THREE OF THE FOUR PATHS IN `createPoolFrom`
         * WAIT ON NOTHING (LIVE-REOPEN-01, 20.09).
         *
         * A warning - no name, a name that does not match the tab, a name already
         * taken - comes back here with nothing awaited but the function itself,
         * while the window it is trying to reopen can still be on screen. Then
         * `alreadyOpen` refused, this returned null, the old copy closed a moment
         * later, and the GM was left with no window and their typed name gone.
         * `reopen` closes the old copy first, so how many ticks have passed stops
         * mattering. See the note on `reopen` for the measurement.
         */
        return reopen("drpg-window-tables", () => openItemTables({ preset, poolError: refused }));
    }

    if (!action.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Tables.needsName"));
        return reopen("drpg-window-tables", () => openItemTables({ preset }));
    }
    if (!action.tables.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Tables.needsTable"));
        return reopen("drpg-window-tables", () => openItemTables({ preset }));
    }

    await addItemFrom(action);

    // The preset is spent: it described one ruling, and the GM is now looking
    // at a window that has already acted on it.
    return openItemTables({ preset: null });
}

/** Put the tables in front of the GM, so the button visibly did something. */
async function openTablesTab() {
    try {
        await globalThis.ui?.sidebar?.changeTab?.("tables", "primary");
    } catch {
        // An older sidebar, or a UI module that reshuffled it. The chat receipt
        // and the notification already said what happened.
    }
}
