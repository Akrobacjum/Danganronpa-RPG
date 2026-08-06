/**
 * Danganronpa RPG — item tables.
 * ---------------------------------------------------------------------------
 * The guide gives one or two examples per tier and tells the GM to improvise
 * the rest. These lists are that improvisation done in advance, so a Search
 * never stalls waiting for someone to invent a mop.
 *
 * Everything here is deliberately mundane and school-shaped: the horror in a
 * killing game comes from what students do with ordinary objects.
 *
 * Installed into the world as RollTables by `installTables()`, which the GM can
 * then edit freely — once they exist, these definitions are only a fallback.
 */

import { MODULE_ID, ITEM_CATEGORIES, TIER_EFFECTS } from "./config.mjs";
import { log } from "./utils.mjs";

/** Table name pattern: "DRPG Usable Items — Tier 2". */
export function tableName(category, tier) {
    return `DRPG ${ITEM_CATEGORIES[category]?.plural ?? category} — Tier ${tier}`;
}

/**
 * Item pools, keyed by category then tier.
 *
 * These are the guide's own examples, translated, and nothing else. The guide
 * is explicit that it "does not supply a list of items" and that the GM should
 * improvise — so this stays a short, faithful seed rather than an invented
 * catalogue. Add your own by editing the RollTables in the world; the module
 * reads those first.
 *
 * Tier 0 is "a random, seemingly useless object, open to creative use".
 */
export const ITEM_POOLS = {
    usable: {
        0: ["Spoiled cheese", "Fidget spinner"],
        1: ["Apple", "Chewing gum"],
        2: ["Canned soup", "Pills"],
        3: ["Candy floss"]
    },
    crimeTool: {
        0: ["Scissors"],
        1: ["Bent pipe"],
        2: ["Axe"],
        3: ["Handgun"]
    },
    cleaningTool: {
        0: ["Toilet paper"],
        1: ["Rope"],
        2: ["Mop"],
        3: ["Cleaning agent"]
    }
};

/**
 * Items the guide names as project results rather than search finds. Offered to
 * the GM as suggestions; not part of the Search tables.
 */
export const PROJECT_ITEMS = {
    3: [
        { name: "Sleeping draught", note: "Restores 3 Stress, or puts a victim to sleep." },
        { name: "Lethal poison", note: "A Desperate project." },
        { name: "Gift", note: "Must be handed over immediately. Grants the maker 3 Hope." }
    ]
};

/** One random item name for a category and tier. */
export function randomItem(category, tier) {
    const pool = ITEM_POOLS[category]?.[tier] ?? ITEM_POOLS[category]?.[0] ?? [];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Roll on the world's table if one exists, otherwise fall back to the built-in
 * pool. The GM editing a table has to actually change what Search produces.
 *
 * @returns {Promise<{name: string, fromTable: boolean}|null>}
 */
export async function drawItem(category, tier) {
    const table = game.tables?.getName?.(tableName(category, tier));

    if (table) {
        try {
            const draw = await table.draw({ displayChat: false });
            const result = draw?.results?.[0];
            const name = result?.name ?? result?.text ?? result?.description;
            if (name) return { name, fromTable: true };
        } catch {
            // A broken table should not stop the action — fall through.
        }
    }

    const name = randomItem(category, tier);
    return name ? { name, fromTable: false } : null;
}

/**
 * Create the RollTables in the world. Idempotent: tables that already exist are
 * left alone, so a GM's edits are never overwritten.
 */
export async function installTables({ overwrite = false } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    let folder = game.folders.find(f => f.type === "RollTable" && f.name === "Danganronpa RPG");
    if (!folder) {
        folder = await Folder.create({ name: "Danganronpa RPG", type: "RollTable", color: "#9d4edd" });
    }

    const created = [];
    const skipped = [];

    for (const [category, tiers] of Object.entries(ITEM_POOLS)) {
        for (const [tier, names] of Object.entries(tiers)) {
            const name = tableName(category, tier);
            const existing = game.tables.getName(name);

            if (existing && !overwrite) {
                skipped.push(name);
                continue;
            }
            if (existing && overwrite) await existing.delete();

            await RollTable.create({
                name,
                folder: folder.id,
                description: `${ITEM_CATEGORIES[category]?.label ?? category}, Tier ${tier}. ${TIER_EFFECTS[category]?.[tier] ?? ""}`,
                formula: `1d${names.length}`,
                replacement: true,
                displayRoll: false,
                flags: { [MODULE_ID]: { category, tier: Number(tier) } },
                results: names.map((text, index) => ({
                    type: CONST.TABLE_RESULT_TYPES?.TEXT ?? "text",
                    text,
                    name: text,
                    range: [index + 1, index + 1],
                    weight: 1
                }))
            });
            created.push(name);
        }
    }

    log(`Item tables: ${created.length} created, ${skipped.length} left alone.`);
    ui.notifications.info(game.i18n.format("DRPG.Tables.installed", {
        created: created.length,
        skipped: skipped.length
    }));

    return { created, skipped };
}
