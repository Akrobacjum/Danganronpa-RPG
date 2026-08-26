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

import { MODULE_ID, ITEM_CATEGORIES, ITEM_TIERS, TIER_EFFECTS, USABLE_KINDS, USABLE_KIND_EFFECTS }
    from "./config.mjs";
import { dialogContent, wirePortraitPickers, panelTabs, wirePanelTabs, whisperToGms, log, error, plural }
    from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/** Table name pattern: "DRPG Usables — Tier 2", or "… (Healing) — Tier 2". */
export function tableName(category, tier, goal = null) {
    const base = ITEM_CATEGORIES[category]?.plural ?? category;
    const suffix = USABLE_GOALS[goal] ? ` (${USABLE_GOALS[goal].label})` : "";
    return `DRPG ${base}${suffix} — Tier ${tier}`;
}

/**
 * WHAT THESE TABLES USED TO BE CALLED, and why it has to be written down.
 *
 * A table is found by NAME, and its name is built out of labels that are
 * ordinary display copy — the kind that gets reworded. Every time one was, the
 * lookup started missing a table that was sitting right there: "Crime Tools"
 * became "Murder Weapons", "Usable Items" became "Usables", and (26.08)
 * "Stress Relief" became "Sanity Relief". Measured in the QA world before this
 * was written: ZERO of the eight usable tier tables were being found, and the
 * crime tool tables none either.
 *
 * It failed silently, which is the worst part. `drawItem` falls through to the
 * built-in pools when no table answers, so a Search still produced an item —
 * just never one the GM had put in a table. Everything they curated was being
 * ignored, and `installTables` would have gone on to build a second, parallel
 * set under the new names beside the ones already there.
 *
 * So every label these names have ever carried lives here, oldest last, and
 * lookups try the current name first and then the history. Nothing is renamed
 * in anybody's world: a table the GM has been editing for a season keeps the
 * name they know it by, and a fresh world gets today's. Add to this list — do
 * not edit it — whenever a label above changes.
 */
const LEGACY_PLURALS = {
    usable: ["Usable Items"],
    crimeTool: ["Crime Tools"]
};

const LEGACY_GOAL_LABELS = {
    stress: ["Stress Relief"]
};

/**
 * Every name this table could be sitting under, current one first.
 *
 * @returns {string[]}
 */
export function tableNameCandidates(category, tier, goal = null) {
    const bases = [ITEM_CATEGORIES[category]?.plural ?? category, ...(LEGACY_PLURALS[category] ?? [])];
    const suffixes = USABLE_GOALS[goal]
        ? [USABLE_GOALS[goal].label, ...(LEGACY_GOAL_LABELS[goal] ?? [])].map(l => ` (${l})`)
        : [""];

    const names = [];
    for (const base of bases) {
        for (const suffix of suffixes) names.push(`DRPG ${base}${suffix} — Tier ${tier}`);
    }
    return names;
}

/** The one that actually exists in this world, if any — else today's name. */
export function existingTableName(category, tier, goal = null) {
    const names = tableNameCandidates(category, tier, goal);
    return names.find(n => game.tables?.getName?.(n)) ?? names[0];
}

/**
 * A TIER pool feeds dice draws and is never a room's pool.
 *
 * Two families of table, two jobs. Tier pools — everything `tableName()`
 * produces — answer "a Tier N roll came up, what was found". Room pools —
 * the global fallthrough plus whatever the GM creates — answer "what does
 * THIS room stock". Room Setup's "Draws from" only offers the second family;
 * offering the first let a room be pointed at "DRPG Crime Tools — Tier 2",
 * which then answered every Search in that room regardless of the roll.
 */
const TIER_POOL_PATTERN = /^DRPG .+ — Tier \d+$/;

export function isTierPool(name) {
    return TIER_POOL_PATTERN.test(String(name ?? ""));
}

/**
 * Usable items, split by kind.
 *
 * This split used to be cosmetic — a courtesy so a Search for "something to
 * patch me up" did not hand over chewing gum. Since 2026-08-26 it is the rules:
 * which table an item belongs to IS what the item does. A healing usable
 * restores Health, a stress-relief one clears Sanity, and nobody is asked which at
 * the moment of use — `usableKindFor` below is how the Use action reads the
 * answer back off these tables.
 *
 * Tier 3 appears in both because it is the one tier where the kinds meet: it
 * restores 2 Health or 2 Sanity at the player's choice, plus 2 Hope.
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
 * The world's Healing and Sanity Relief tables are the authority — they are
 * what the GM edits, so an item moved from one to the other changes what it
 * does the next time anybody drinks it, with no flag to chase. The built-in
 * pools only answer when no world table knows the name at all (a world where
 * the tables were never installed).
 *
 * @returns {"healing"|"stress"|"both"|null} `"both"` when the name sits in
 *   tables of both kinds — genuinely ambiguous, the caller decides what that
 *   means — and `null` when nothing anywhere claims it.
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

    const worldPools = [];
    for (const table of game.tables ?? []) {
        const goal = table.getFlag(MODULE_ID, "goal");
        if (!USABLE_GOALS[goal]) continue;
        worldPools.push([goal, Array.from(table.results ?? []).map(r => r.name ?? r.text ?? "")]);
    }

    let kinds = matches(worldPools);
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
        { name: "Sleeping draught", note: "Restores 3 Sanity, or puts a victim to sleep." },
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
    // THE ROLL MATTERS IN ROOMS TOO (F5.5, Dawid 2026-08-25). A room table can
    // be split by tier the same way it can be split by category: "Kuchnia —
    // Tier 2" answers a Tier 2 roll in the Kuchnia before the flat "Kuchnia"
    // does. A GM who does not want that precision keeps one flat table and the
    // lookup falls straight through — same bargain as the category split.
    const roomBase = room ? await tableForRoom(room) : null;
    const roomNames = roomBase
        ? [
            `${roomBase} — Tier ${tier}`,
            `${roomBase} — ${ITEM_CATEGORIES[category]?.plural ?? category}`,
            roomBase
        ]
        : [];

    const names = [
        ...roomNames,
        // Every name these have ever been called — see LEGACY_PLURALS. A world
        // whose tables were built before a label was reworded is still the
        // world whose tables answer.
        ...tableNameCandidates(category, tier, goal),
        ...tableNameCandidates(category, tier)
    ].filter(Boolean);

    for (const name of names) {
        const table = game.tables?.getName?.(name);
        if (!table) continue;
        try {
            const draw = await table.draw({ displayChat: false });
            const result = draw?.results?.[0];
            const drawn = result?.name ?? result?.text ?? result?.description;
            if (drawn) {
                return {
                    name: drawn,
                    fromTable: true,
                    // Carried onto the Item when it is granted. `installTables`
                    // writes the name into `description` as well, so a
                    // description that is only the name again is dropped here
                    // rather than overwriting the tier line every found item
                    // gets — see `grantItem`.
                    img: result?.img ?? result?.icon ?? null,
                    description: result?.description && result.description !== drawn
                        ? result.description : null
                };
            }
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
 * Every table this module knows how to build: crime tools, cleaning tools, and
 * one table per usable kind so "what mends you" and "what calms you down" are
 * curated separately.
 *
 * No generic usable table any more. Usables are split into healing and stress
 * relief BY table — that assignment is what decides what the item does when it
 * is drunk — so a mixed pool would be a pool of items whose effects nobody
 * chose. A world that already has "DRPG Usables — Tier N" keeps it: `drawItem`
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
                ui.notifications.info(game.i18n.format("DRPG.Tables.allPresent", { n: present.length }));
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
        // Under whatever name it is ALREADY sitting, or today's if it is new —
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
                description: `${ITEM_CATEGORIES[category]?.label ?? category}${
                    USABLE_KINDS[goal] ? ` (${USABLE_KINDS[goal].label})` : ""
                }, Tier ${tier}. ${
                    USABLE_KIND_EFFECTS[goal]?.[tier] ?? TIER_EFFECTS[category]?.[tier] ?? ""}`,
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

/* ==========================================================================
 * THE TABLE EDITOR
 * --------------------------------------------------------------------------
 * `installTables()` was what the GM-panel tile did, and installing is a thing
 * you do once. Everything after that first minute — adding the knife somebody
 * invented at the table, taking out the item that turned out to be a bad idea,
 * checking what a room can actually produce — meant the Rollable Tables
 * sidebar, with the module's naming convention held in the GM's head.
 *
 * So the installer stays an installer and this is the door: every table the
 * module knows about on the left, what is in the selected one on the right,
 * and one form that puts a new item into as many of them as the GM ticks.
 *
 * THE CONTRACT IS THE TABLE, not an Item document. What a Search produces is a
 * TableResult, `drawItem` reads its name, and `grantItem` builds the Item from
 * the category and tier at the moment it lands on a sheet. Writing Items here
 * instead would be a second, parallel model of the same thing — so the icon and
 * the description go onto the TableResult (`img` and `description`), and
 * `drawItem` carries them across when the item is actually found.
 * ========================================================================== */

const DEFAULT_RESULT_IMG = "icons/svg/item-bag.svg";

/**
 * Every table this window is willing to show.
 *
 * Two families: the module's own, which follow `tableName()`, and whatever a
 * room has been pointed at in Room Setup — those carry arbitrary names and are
 * every bit as much a part of what a Search can produce (see `drawItem`).
 *
 * Exported for the GM's give-item window, whose "give existing" tab is this
 * same catalogue read the other way round: not "what can a Search produce"
 * but "what is there to hand over".
 */
export function moduleTables() {
    const roomTables = new Set();
    try {
        for (const scene of game.scenes) {
            for (const region of scene.regions ?? []) {
                const name = region.getFlag(MODULE_ID, "drpgItemTable");
                if (name) roomTables.add(name);
            }
        }
    } catch (err) {
        // A room pointing at a table is a convenience here, not the subject.
        error("Could not read the rooms' item tables", err);
    }

    return Array.from(game.tables ?? [])
        .filter(t => t.name.startsWith("DRPG ")
            || roomTables.has(t.name)
            || Array.from(roomTables).some(base => t.name.startsWith(`${base} — `))
            // A room pool the GM created here but has not pointed a room at
            // yet — without this clause it vanished from the very window that
            // made it until Room Setup used it once.
            || t.getFlag(MODULE_ID, "roomPool"))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** The entries of one table, as the right-hand column renders them. */
function tableItemsHtml(table) {
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const results = Array.from(table?.results ?? []);
    if (!results.length) {
        return `<p class="notes">${game.i18n.localize("DRPG.Tables.tableEmpty")}</p>`;
    }

    // EDITED IN PLACE, not in a second window.
    //
    // The list was read-only, which meant fixing a typo in an item's name was:
    // delete the entry, retype it in the form below, tick the same three tables
    // again. Every field here is the field itself, saved when it loses focus —
    // the same pattern the Remnant card on the map uses, and for the same
    // reason: there is nothing here worth a two-step commit.
    return `<ul class="drpg-table-items">${results.map(r => {
        const name = r.name ?? r.text ?? "";
        const note = r.description && r.description !== name ? r.description : "";
        return `<li data-drpg-result="${r.id}" data-drpg-table="${table.id}">
            <img src="${esc(r.img || DEFAULT_RESULT_IMG)}" alt="" class="drpg-table-item-icon"
                 data-drpg-result-img="${r.id}"
                 title="${esc(game.i18n.localize("DRPG.Tables.changeIcon"))}" />
            <input type="text" class="drpg-table-item-name" data-drpg-field="name"
                   value="${esc(name)}" />
            <input type="text" class="drpg-table-item-note notes" data-drpg-field="description"
                   value="${esc(note)}"
                   placeholder="${esc(game.i18n.localize("DRPG.Items.descriptionPlaceholder"))}" />
            <button type="button" class="drpg-mini-button" data-drpg-drop="${r.id}"
                data-drpg-drop-table="${table.id}" title="${
                    esc(game.i18n.localize("DRPG.Tables.removeItem"))}">✕</button>
        </li>`;
    }).join("")}</ul>`;
}

/**
 * Add one entry to a table and keep it rollable.
 *
 * `normalize()` is what makes this safe to call on a table a GM has been
 * editing by hand: it re-ranges every result and rewrites the formula, so a
 * table that was `1d4` with four entries becomes `1d5` with five rather than a
 * table whose fifth item can never come up.
 */
async function addResult(table, { name, description = "", img = null }) {
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
            img: img || undefined,
            weight: 1,
            // v14 validates `range` at creation ("cannot have fewer than 2
            // elements"), so it cannot be left for `normalize()` to invent —
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

    const patch = field === "name"
        ? { name: value, text: value }
        : { description: value || (result.name ?? result.text ?? "") };

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
 * The item tables, editable.
 *
 * @param {object} [options]
 * @param {object} [options.preset]  Prefill for the "add an item" form:
 *   `{ category, tier, room, name }`. Handed in by the ruling card a Search for
 *   "something specific" produces — the GM pressed "Create an item" while
 *   reading a roll that already says which category, which tier and which room,
 *   and re-picking all three here would be answering a question they have just
 *   answered.
 */
export async function openItemTables({ preset = null } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const tables = moduleTables();

    // Which tables the preset points at: the ones this category and tier would
    // actually be drawn from, plus the room's own if it has one. Ticked, not
    // forced — the GM can add or clear any of them before pressing Add.
    const presetTargets = new Set();
    if (preset?.category) {
        const wanted = tableNameCandidates(preset.category, preset.tier ?? 0);
        if (preset.room) {
            const base = await tableForRoom(preset.room);
            if (base) {
                wanted.push(base, `${base} — ${ITEM_CATEGORIES[preset.category]?.plural ?? ""}`);
            }
        }
        for (const t of tables) if (wanted.includes(t.name)) presetTargets.add(t.id);
    }

    const selected = tables.find(t => presetTargets.has(t.id)) ?? tables[0] ?? null;

    const listHtml = tables.length
        ? `<ul class="drpg-tables-list">${tables.map(t => `
            <li><button type="button" class="drpg-table-pick${
                t.id === selected?.id ? " active" : ""}" data-drpg-table="${t.id}">
                <span>${esc(t.name)}</span>
                <span class="notes">${t.results.size}</span>
            </button></li>`).join("")}</ul>`
        : `<p class="notes">${game.i18n.localize("DRPG.Tables.noneYet")}</p>`;

    const categories = Object.entries(ITEM_CATEGORIES)
        .filter(([key]) => key !== "truthBullet")
        .map(([key, cat]) => `<option value="${key}"${
            key === preset?.category ? " selected" : ""}>${esc(cat.label)}</option>`).join("");

    const tiers = ITEM_TIERS.map(t => `<option value="${t}"${
        t === Number(preset?.tier ?? 2) ? " selected" : ""}>${
        game.i18n.format("DRPG.Items.tierN", { n: t })}</option>`).join("");

    // ONE tier table, ANY number of room tables (F5.5, 2026-08-25).
    //
    // An item lives in exactly one tier pool — that is what the tier is — so
    // the tier family is a dropdown with a single choice ("—" for an item that
    // only ever appears in rooms). Room tables keep the checkboxes: a knife can
    // sit in the Kitchen and the Workshop at once.
    const tierTables = tables.filter(t => isTierPool(t.name));
    const roomTablesList = tables.filter(t => !isTierPool(t.name));

    const tierOptions = `<option value="">—</option>` + tierTables.map(t =>
        `<option value="${t.id}"${presetTargets.has(t.id) ? " selected" : ""}>${
            esc(t.name)}</option>`).join("");
    const roomChecks = roomTablesList.map(t => `<label class="drpg-inline-check">
        <input type="checkbox" name="target:${t.id}"${
            presetTargets.has(t.id) ? " checked" : ""} /> ${esc(t.name)}</label>`).join(" ");

    // Not `tableDialog()`: there is no table in here to measure. Its two panes
    // are a list and a form, and a window sized by `fitWindowToTable` with
    // nothing to measure keeps whatever width the dialog opened at — which is
    // 400px, and half of what this layout needs. `drpg-wide` is the manual
    // override that exists for exactly this case.
    const action = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Tables.editorTitle") },
        classes: ["drpg-panel", "drpg-projects", "drpg-wide"],
        position: { height: "auto" },
        // Four tabs (Dawid, 26.08): editing what a table holds, the three
        // creation jobs behind it. The footer buttons act across tabs — each
        // reads its own pane's inputs, which stay in the DOM whichever tab is
        // showing (see `panelTabs` in utils.mjs).
        content: dialogContent(`<form>${panelTabs([
            { key: "edit", label: game.i18n.localize("DRPG.Tables.tabEdit"), html: `
            <p class="notes">${game.i18n.localize("DRPG.Tables.editorIntro")}</p>
            <div class="drpg-tables-layout">
                <div class="drpg-tables-left">${listHtml}</div>
                <div class="drpg-tables-right">
                    <h4 data-drpg-table-name>${esc(selected?.name ?? "")}</h4>
                    <div data-drpg-table-body>${
                        selected ? tableItemsHtml(selected)
                            : `<p class="notes">${game.i18n.localize("DRPG.Tables.noneYet")}</p>`
                    }</div>
                </div>
            </div>` },
            { key: "newItem", label: game.i18n.localize("DRPG.Tables.tabNewItem"), html: `
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
                <label>${game.i18n.localize("DRPG.Tables.tierTarget")}
                    <select name="tierTarget">${tierOptions}</select></label>
                <div class="drpg-tables-targets">
                    <span class="notes">${game.i18n.localize("DRPG.Tables.roomTargets")}</span>
                    ${roomChecks || `<span class="notes">${game.i18n.localize("DRPG.Tables.noRoomTables")}</span>`}
                </div>
                <p class="notes">${game.i18n.localize("DRPG.Tables.addNote")}</p>
            </fieldset>` },
            { key: "newRoom", label: game.i18n.localize("DRPG.Tables.newPool"), html: `
            <fieldset class="drpg-tables-new">
                <legend>${game.i18n.localize("DRPG.Tables.newPool")}</legend>
                <label>${game.i18n.localize("DRPG.Items.name")}
                    <input type="text" name="newPoolName"
                        placeholder="${esc(game.i18n.localize("DRPG.Tables.newPoolPlaceholder"))}" /></label>
                <p class="notes">${game.i18n.localize("DRPG.Tables.newPoolNote")}</p>
            </fieldset>` },
            { key: "install", label: game.i18n.localize("DRPG.Tables.tabInstall"), html: `
            <p class="notes">${game.i18n.localize("DRPG.Tables.whereNote")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Tables.installTabNote")}</p>` }
        ])}</form>`),
        buttons: [
            {
                action: "add", label: game.i18n.localize("DRPG.Tables.addItem"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.newName.value.trim(),
                        description: f.newText.value.trim(),
                        img: f.querySelector('[name="img.new"]')?.value ?? "",
                        category: f.newCategory.value,
                        tier: Number(f.newTier.value),
                        tables: [
                            f.tierTarget?.value || null,
                            ...roomTablesList
                                .filter(t => f.querySelector(`[name="target:${CSS.escape(t.id)}"]`)?.checked)
                                .map(t => t.id)
                        ].filter(Boolean)
                    };
                }
            },
            {
                action: "newPool", label: game.i18n.localize("DRPG.Tables.newPool"),
                callback: (e, b, d) => ({ newPool: d.element.querySelector("[name=newPoolName]")?.value.trim() ?? "" })
            },
            { action: "install", label: game.i18n.localize("DRPG.Panel.installTables") },
            { action: "close", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        render: (event, dialog) => {
            const root = dialog.element;
            wirePanelTabs(root);
            wirePortraitPickers(root, { defaultImg: DEFAULT_RESULT_IMG });

            const nameEl = root.querySelector("[data-drpg-table-name]");
            const bodyEl = root.querySelector("[data-drpg-table-body]");

            const show = table => {
                nameEl.textContent = table?.name ?? "";
                bodyEl.innerHTML = table ? tableItemsHtml(table) : "";
            };

            for (const button of root.querySelectorAll("[data-drpg-table]")) {
                button.addEventListener("click", ev => {
                    ev.preventDefault();
                    for (const b of root.querySelectorAll("[data-drpg-table]")) {
                        b.classList.toggle("active", b === button);
                    }
                    show(game.tables.get(button.dataset.drpgTable));
                });
            }

            // Delegated, because the entry list is rebuilt whenever a table is
            // picked or an entry is dropped — listeners bound to the old rows
            // would go with them. The same delegation carries the editing:
            // `focusout` bubbles where `blur` does not, which is exactly why it
            // exists.
            bodyEl?.addEventListener("click", async ev => {
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

            bodyEl?.addEventListener("focusout", async ev => {
                const field = ev.target.closest("[data-drpg-field]");
                if (!field) return;

                const row = field.closest("[data-drpg-result]");
                const table = game.tables.get(row?.dataset.drpgTable);
                if (!table) return;

                const saved = await editResult(
                    table, row.dataset.drpgResult, field.dataset.drpgField, field.value.trim());
                if (saved) {
                    // The same brief mark the Remnant card uses for "that
                    // landed", removed again so a window left open does not
                    // keep claiming it.
                    field.classList.add("drpg-saved");
                    setTimeout(() => field.classList.remove("drpg-saved"), 1200);
                }
            });
        },
        rejectClose: false
    });

    if (!action || action === "close") return null;

    if (action === "install") {
        await installTables();
        return openItemTables({ preset });
    }

    if (typeof action.newPool === "string") {
        const name = action.newPool;
        if (!name) {
            ui.notifications.warn(game.i18n.localize("DRPG.Tables.needsName"));
        } else if (isTierPool(name)) {
            // A pool NAMED like a tier table would be picked up by the draw
            // order's tier lookup and shadow the real one. Refused at the door.
            ui.notifications.warn(game.i18n.localize("DRPG.Tables.newPoolTierName"));
        } else if (game.tables.getName(name)) {
            ui.notifications.warn(game.i18n.format("DRPG.Tables.newPoolExists", { name }));
        } else {
            await RollTable.create({
                name,
                formula: "1d1",
                flags: { [MODULE_ID]: { roomPool: true } }
            });
            ui.notifications.info(game.i18n.format("DRPG.Tables.poolCreated", { name }));
            log(`Item tables: room pool "${name}" created.`);
        }
        return openItemTables({ preset });
    }

    if (!action.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Tables.needsName"));
        return openItemTables({ preset });
    }
    if (!action.tables.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Tables.needsTable"));
        return openItemTables({ preset });
    }

    let added = 0;
    for (const id of action.tables) {
        const table = game.tables.get(id);
        if (await addResult(table, {
            name: action.name, description: action.description, img: action.img
        })) added++;
    }

    log(`Item tables: "${action.name}" added to ${added} table(s).`);
    ui.notifications.info(game.i18n.format("DRPG.Tables.itemAdded", { name: action.name, n: added }));

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
