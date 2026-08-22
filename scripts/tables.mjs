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
import { whisperToGms, log, error, plural } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Table name pattern: "DRPG Usable Items — Tier 2", or "… (Healing) — Tier 2". */
export function tableName(category, tier, goal = null) {
    const base = ITEM_CATEGORIES[category]?.plural ?? category;
    const suffix = USABLE_GOALS[goal] ? ` (${USABLE_GOALS[goal].label})` : "";
    return `DRPG ${base}${suffix} — Tier ${tier}`;
}

/**
 * Usable items, split by what the player was looking for.
 *
 * The guide's tier text says an item "restores 1 point of HP *or* Stress" — one
 * object, either use. But the player declares which they want before rolling,
 * and handing someone chewing gum when they asked for something to patch a cut
 * reads as a bug even when it is rules-legal. So the guide's own examples are
 * sorted by which they obviously are: food and medicine mend the body, calming
 * things settle the nerves.
 *
 * Tier 3 appears in both because the guide's Tier 3 usable restores HP, Stress
 * and Hope at once.
 */
export const USABLE_GOALS = {
    healing: {
        label: "Healing",
        pool: {
            0: ["Spoiled cheese", "Half a sandwich", "Flat lemonade", "Stale crackers"],
            1: ["Apple", "Cereal bar", "Instant noodles", "Sports drink"],
            2: ["Canned soup", "First aid kit", "Burn cream", "Vacuum-packed bento"],
            3: ["Candy floss"]
        }
    },
    stress: {
        label: "Stress Relief",
        pool: {
            0: ["Fidget spinner", "Torn magazine", "Cracked handheld game", "Dried-out marker"],
            1: ["Chewing gum", "Cold tea", "Cigarettes", "Worn paperback"],
            2: ["Pills", "Music player", "Instant coffee", "Photo album"],
            3: ["Candy floss"]
        }
    }
};

/**
 * Item pools, keyed by category then tier.
 *
 * The guide's own examples are the first entry of each tier; the rest are the
 * "GM improvises the rest" that the guide asks for, done in advance and kept in
 * the same register — school property, maintenance cupboards, kitchen drawers.
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
    crimeTool: {
        0: ["Scissors", "Letter opener", "Broken bottle", "Skipping rope"],
        1: ["Bent pipe", "Hammer", "Baseball bat", "Kitchen knife"],
        2: ["Axe", "Bolt cutters", "Fire extinguisher", "Chemistry acid"],
        3: ["Handgun", "Crossbow", "Industrial saw"]
    },
    cleaningTool: {
        0: ["Toilet paper", "Old newspaper", "Gym towel"],
        1: ["Rope", "Rubber gloves", "Bin bags", "Bucket and sponge"],
        2: ["Mop", "Bleach", "Vacuum cleaner", "Blowtorch"],
        3: ["Cleaning agent", "Pressure washer", "Incinerator key"]
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
export function randomItem(category, tier, goal = null) {
    const goalPool = USABLE_GOALS[goal]?.pool;
    const pool = goalPool?.[tier] ?? goalPool?.[0]
        ?? ITEM_POOLS[category]?.[tier] ?? ITEM_POOLS[category]?.[0] ?? [];
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Roll on the world's table if one exists, otherwise fall back to the built-in
 * pool. The GM editing a table has to actually change what Search produces.
 *
 * @returns {Promise<{name: string, fromTable: boolean}|null>}
 */
export async function drawItem(category, tier, { goal = null, room = null } = {}) {
    // The room's own table first, when it has one. A kitchen and a boiler room
    // should not be drawing from the same bag — the guide says outright that
    // what turns up can depend on where you are.
    //
    // It falls THROUGH to the global pool rather than replacing it, and that is
    // deliberate: a room can carry its own crime tools and still inherit the
    // ordinary healing items, and a room the GM never got round to configuring
    // behaves exactly as it did before. A silent empty-handed Search in a room
    // somebody forgot to set up would just look like a broken action.
    // A room's table can be split by category the same way the global ones are,
    // and for the same reason: a single "Kitchen" table asked for a crime tool
    // would hand back an apple and then label it a weapon. So "Kitchen — Crime
    // Tools" is tried before plain "Kitchen". A GM who does not want that
    // precision makes one flat table and it answers everything.
    const roomBase = room ? await tableForRoom(room) : null;
    const roomNames = roomBase
        ? [`${roomBase} — ${ITEM_CATEGORIES[category]?.plural ?? category}`, roomBase]
        : [];

    const names = [
        ...roomNames,
        tableName(category, tier, goal),
        tableName(category, tier)
    ].filter(Boolean);

    for (const name of names) {
        const table = game.tables?.getName?.(name);
        if (!table) continue;
        try {
            const draw = await table.draw({ displayChat: false });
            const result = draw?.results?.[0];
            const drawn = result?.name ?? result?.text ?? result?.description;
            if (drawn) return { name: drawn, fromTable: true };
        } catch {
            // A broken table should not stop the action — fall through.
        }
    }

    const picked = randomItem(category, tier, goal);
    return picked ? { name: picked, fromTable: false } : null;
}

/** The RollTable a room draws from, if the GM pointed it at one. */
async function tableForRoom(room) {
    try {
        const { roomTable } = await import("./vault.mjs");
        return roomTable(room);
    } catch {
        return null;
    }
}

/**
 * Every table this module knows how to build: crime tools, cleaning tools and
 * the generic usable list, plus one table per usable goal so a GM can curate
 * "what mends you" separately from "what calms you down".
 */
function tableJobs() {
    return [
        ...Object.entries(ITEM_POOLS).flatMap(([category, tiers]) =>
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
 * it did exactly what it promised — nothing — and said so in a single toast that
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
        const present = jobs.filter(j => game.tables.getName(tableName(j.category, j.tier, j.goal)));
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
                ui.notifications.info(game.i18n.format("DRPG.Tables.allPresent", { n: present.length }));
                await openTablesTab();
                return { created: [], skipped: present.map(j => tableName(j.category, j.tier, j.goal)), failed: [] };
            }
            overwrite = true;
        }
    }

    let folder = game.folders.find(f => f.type === "RollTable" && f.name === "Danganronpa RPG");
    if (!folder) {
        try {
            folder = await Folder.create({ name: "Danganronpa RPG", type: "RollTable", color: "#9d4edd" });
        } catch (err) {
            // A folder is a convenience, not a requirement — the tables are found
            // by name. Losing it must not lose the tables with it.
            error("Could not create the Danganronpa RPG table folder", err);
            folder = null;
        }
    }

    const created = [];
    const skipped = [];
    const failed = [];

    for (const { category, tier, names, goal } of jobs) {
        const name = tableName(category, tier, goal);
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
                description: `${ITEM_CATEGORIES[category]?.label ?? category}, Tier ${tier}. ${TIER_EFFECTS[category]?.[tier] ?? ""}`,
                formula: `1d${names.length}`,
                replacement: true,
                displayRoll: false,
                flags: { [MODULE_ID]: { category, tier: Number(tier), goal } },
                results: names.map((text, index) => ({
                    // Since v13 a TableResult carries `name` and `description`;
                    // `text` is only kept here for a world still on the old shape.
                    type: CONST.TABLE_RESULT_TYPES?.TEXT ?? "text",
                    text,
                    name: text,
                    description: text,
                    range: [index + 1, index + 1],
                    weight: 1
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

/** Put the tables in front of the GM, so the button visibly did something. */
async function openTablesTab() {
    try {
        await globalThis.ui?.sidebar?.changeTab?.("tables", "primary");
    } catch {
        // An older sidebar, or a UI module that reshuffled it. The chat receipt
        // and the notification already said what happened.
    }
}
