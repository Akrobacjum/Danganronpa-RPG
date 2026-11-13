/**
 * Danganronpa RPG - the item tables window and Install.
 * ---------------------------------------------------------------------------
 * `installTables()`, which builds the module's RollTables in a world from the
 * built-in pools (`tableJobs`) and leaves a receipt in chat, and the window a
 * GM edits them in (`openItemTables`): every table the module knows on the
 * left, what is in the selected one on the right - its rows, a result added,
 * edited, dropped or placed (`tableRowHtml`, `addResult`, `editResult`,
 * `dropResult`, `placeResultDialog`), a pool's pane and its heading
 * (`poolPaneHtml`, `wirePaneHeading`, `wirePaneRows`), a table named
 * (`promptForTableName`) or created (`createPoolFrom`) - and the form that
 * puts a new item, with its picture, into as many tables as the GM ticks
 * (`newItemPaneHtml`, `wireItemPicture`, `addItemFrom`). The two are one file
 * because they call each other: Install ends on the sidebar's tables tab
 * (`openTablesTab`), and the window's Install button runs `installTables`.
 *
 * WHERE IT SITS. Moved out of tables.mjs by E41 C8 (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. tables.mjs re-exports the
 * four names here it exported before (`installTables`, `promptForTableName`,
 * `poolPaneHtml`, `openItemTables`), so every importer still imports
 * tables.mjs, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). Of the item tables' family it reads nineteen names
 * of tables-pools.mjs: a table's name and shape, the pools, the roles and the
 * index.
 */

import { MODULE_ID, ITEM_CATEGORIES, EQUIPPABLE, ITEM_TIERS, itemIcon } from "./config.mjs";
import { cardWarn } from "./chat-card.mjs";
import { whisperToGms, log, error, plural, esc}
    from "./utils.mjs";
import { kitTabs, wireKitTabs, drpgWindow, drpgConfirm, drpgPrompt, dataTable, box } from "./ui-kit.mjs";
import { pickableCategories } from "./inventory.mjs";
import { alreadyOpen, reopen, RAISED } from "./live.mjs";
import { showRoomGroup } from "./ui-hold.mjs";
import {
    classifyTableName, tierTablesFor, existingTableName, tableDescription, isTierPoolTable, poolShapeOf,
    poolNameRefusal, USABLE_GOALS, ITEM_POOLS, MULTI_ROLE_TIER, rolesForPoolItem, tierTableIdFor, roomTableNames,
    tableForRoom, moduleTables, ROOM_GROUP_ORDER, groupKeyOf, groupLabel, classifyEntryName
} from "./tables-pools.mjs";


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
            // Keep the primary; Delete and rebuild destructive, never the default; Cancel (E21 C2b, E22).
            const choice = await drpgWindow({
                title: game.i18n.localize("DRPG.Panel.installTables"),
                classes: ["drpg-panel", "drpg-window-install-tables"],
                body: `<p>${plural("DRPG.Tables.allPresent", { n: present.length })}</p>
                          <p class="notes">${game.i18n.localize("DRPG.Tables.rebuildNote")}</p>`,
                footer: {
                    primary: { action: "keep", label: game.i18n.localize("DRPG.Tables.keep") },
                    destructive: [{ action: "recreate", label: game.i18n.localize("DRPG.Tables.recreate") }],
                    close: { role: "cancel", action: "cancel" }
                },
                rejectClose: false
            });

            if (!choice || choice === "cancel") return null;
            /* KEEP MINE IS AN ANSWER, NOT A FAULT (E46-C3, S08-46): it said so as a warning and switched the sidebar to
               the tables, as an install does, though nothing was installed - the GM stays where they were, told in blue. */
            if (choice === "keep") {
                ui.notifications.info(plural("DRPG.Tables.allPresent", { n: present.length }));
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
    await whisperToGms({
        title: game.i18n.localize("DRPG.Panel.installTables"), tone: failed.length ? "warning" : "info", body: `
        <p>${game.i18n.format("DRPG.Tables.installed", { created: created.length, skipped: skipped.length })}</p>
        ${created.length ? list(created) : ""}
        ${failed.length ? `${cardWarn(plural("DRPG.Tables.someFailed", { n: failed.length }))}${list(failed)}` : ""}
        <p><small>${game.i18n.localize("DRPG.Tables.whereNote")}</small></p>`
    });

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

/*
 * CORE'S BAG IS NOT AN ITEM'S PICTURE (E105 FT-13, the owner's 11.11.2026 "pozbyc sie [...] miejsc gdzie przebija sie
 * grafika [...] z foundry"). An entry with no picture of its own, or with core's item bag (the file browser's starting
 * point above, and Foundry's default for an Item) or core's d20 (its default for a TableResult), was drawn as that
 * core file: the survey read 41 of 41 rows of the harness's room pool wearing the bag (item-tables--rooms, 54493dbf).
 * Such a row now draws the module's drawing of its group's category (config.mjs `itemIcon`, the drawing `addResult`
 * gives a new entry), in both themes as every item drawing is. Only the row's picture: the TableResult's `img` is not
 * written, the file browser still opens on what is stored, and any other picture - one somebody chose - is drawn as it is.
 */
const CORE_RESULT_IMGS = new Set([DEFAULT_RESULT_IMG, "icons/svg/d20-black.svg"]);
function shownResultImg(img, home) {
    return !img || CORE_RESULT_IMGS.has(img) ? itemIcon(home) : img;
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
        return entryTableHtml(table, results.map(r => tableRowHtml(table, r, { home, tier })));
    }

    const { counts, body, unfiledHtml } = roomPoolGroupsHtml(table, results);

    /* ONE PICKER, NOT A ROW OF CHIPS (E49 A4, 11.11.2026; the owner's [14] (2): "Everything" ran onto a second row; [16] 3:
       a dropdown instead, no sideways scroll). Everything first and picked, then every group with its count - a group
       with none is still an option, disabled: the zero is the reading the chips gave (below) - and the unfiled names
       when there are any. A pick shows that group alone (`wireRoomFilter`, ui-hold.mjs `showRoomGroup`), and the
       groups' box keeps its height with all of them, so the window does not move with the pick (the rule of 10.11). */
    const option = (key, label, n, picked = false) => `<option value="${esc(key)}"${n ? "" : " disabled"}${picked ? " selected" : ""}>${
        esc(label)} (${n})</option>`;
    return `<label class="drpg-room-filter"><span>${esc(game.i18n.localize("DRPG.Tables.roomFilter"))}</span>
            <select data-drpg-room-filter>${option("all", game.i18n.localize("DRPG.Tables.roomTotal"), results.length, true)}${
                counts.map(({ key, label, n }) => option(key, label, n)).join("")}</select></label>
        <p class="notes">${game.i18n.localize("DRPG.Tables.roomBreakdown")}</p>
        <div class="drpg-room-groups" data-drpg-room-groups>${body}${unfiledHtml}</div>`;
}

/** A room pool's picker wired to its groups (E49 A4): `root` holds what `tableItemsHtml` drew; a tier pool has neither. */
export function wireRoomFilter(root) {
    const picker = root?.querySelector?.("select[data-drpg-room-filter]");
    const box = root?.querySelector?.("[data-drpg-room-groups]");
    if (!picker || !box) return;
    picker.addEventListener("change", () => showRoomGroup(box, picker.value));
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
        /* A row of the kit's `dataTable` since E46-C3b (09.11.2026; it was an `li` of a grid of six areas): the icon,
           the name and the "+n" of other pools in the name's cell, the description, the roles, place and remove in the
           actions' cell - the same pieces in the same order. `entryTableHtml` puts `data-drpg-result` and
           `data-drpg-table` on the `tr` (`rowAttrs`), where every handler of `wirePaneRows` looks for them. */
        return { result: r.id, table: table.id, roles: roleBoxes,
            name: `<span class="drpg-table-item-cell"><img src="${esc(shownResultImg(r.img, home))}" alt="" class="drpg-table-item-icon"
                 data-drpg-result-img="${r.id}"
                 title="${esc(game.i18n.localize("DRPG.Tables.changeIcon"))}" />
            <input type="text" class="drpg-table-item-name" data-drpg-field="name"
                   aria-label="${esc(game.i18n.localize("DRPG.Items.name"))}"
                   data-drpg-owns-table="${table.id}" data-drpg-owns-result="${r.id}"
                   data-drpg-initial="${esc(name)}"
                   value="${esc(name)}" />${badge}</span>`,
            note: `<input type="text" class="drpg-table-item-note notes" data-drpg-field="description"
                   aria-label="${esc(game.i18n.localize("DRPG.Items.description"))}: ${esc(name)}"
                   data-drpg-owns-table="${table.id}" data-drpg-owns-result="${r.id}"
                   data-drpg-initial="${esc(note)}"
                   value="${esc(note)}"
                   placeholder="${esc(game.i18n.localize("DRPG.Items.descriptionPlaceholder"))}" />`,
            act: `<button type="button" class="drpg-mini-button" data-drpg-place="${r.id}"
                data-drpg-place-table="${table.id}" title="${
                    esc(game.i18n.localize("DRPG.Tables.placeTooltip"))}">⇄</button>
            <button type="button" class="drpg-mini-button" data-drpg-drop="${r.id}"
                data-drpg-drop-table="${table.id}" title="${
                    esc(game.i18n.localize("DRPG.Tables.removeItem"))}">✕</button>` };
}

/*
 * A table's entries on the kit's `dataTable` (E46-C3b, 09.11.2026; S/stages/E46 "Item tables": name, description,
 * roles, actions). `rows` are `tableRowHtml`'s cells, or a room pool's `{ group, count }` heading rows (a tier with
 * its count). The roles' column only where a row has boxes: a pool of Usables or Keys has none, and a column of empty
 * cells would be a column the window never had. The wrapper keeps `drpg-table-items`, the name every reader knew.
 */
function entryTableHtml(table, rows) {
    const any = rows.some(r => r.roles);
    const columns = [
        { key: "name", label: game.i18n.localize("DRPG.Items.name") },
        { key: "note", label: game.i18n.localize("DRPG.Tables.col.description") },
        ...(any ? [{ key: "roles", label: game.i18n.localize("DRPG.Items.alsoServesAs") }] : []),
        { key: "act", label: game.i18n.localize("DRPG.Tables.col.actions"), act: true }
    ];
    return `<div class="drpg-table-items">${dataTable({ columns, rows, empty: "DRPG.Tables.tableEmpty",
        rowAttrs: r => ({ "data-drpg-result": r.result, "data-drpg-table": r.table }) })}</div>`;
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
     * what a GM wants to see at a glance, and a count that is only given when it
     * has something to say cannot say that. Chips until E49 A4; the picker's
     * options since (`tableItemsHtml`).
     */
    const counts = [
        ...ROOM_GROUP_ORDER.map(key => ({ key, label: groupLabel(key, { short: true }), n: groups.get(key).length })),
        ...(unfiled.length ? [{ key: "unfiled", label: game.i18n.localize("DRPG.Tables.unfiled"), n: unfiled.length }] : [])
    ];

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
            ${entryTableHtml(table, tiersOf(rows).flatMap(([tier, mine]) => [
                { group: game.i18n.format("DRPG.Items.tierN", { n: tier }), count: mine.length },
                ...mine.map(({ r, found }) => tableRowHtml(table, r, {
                    home, tier,
                    badge: found.others.length
                        ? `<span class="drpg-table-item-also" data-tooltip="${
                            esc(found.others.map(o => o.table ?? groupLabel(groupKeyOf(o)))
                                .join(", "))}">+${found.others.length}</span>`
                        : ""
                }))]))}
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
            ${entryTableHtml(table, unfiled.map(({ r }) => tableRowHtml(table, r)))}
        </section>`
        : "";
    return { counts, body, unfiledHtml };
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

/*
 * AN EMPTIED NAME IS NOT WRITTEN (E46-C3, 09.11.2026; audit S08-46). A description may be emptied (above); a name may
 * not: an entry with no name is drawn as nothing, and `editResult` wrote `{ name: "", text: "" }`. The field takes back
 * the name it held (`data-drpg-initial`) with `DRPG.Tables.needsName` under it, and nothing is written. Answers whether
 * it refused.
 */
function refuseEmptyName(field) {
    if (field?.dataset?.drpgField !== "name" || field.value.trim()) return false;
    field.value = field.dataset.drpgInitial ?? "";
    let said = field.parentElement?.querySelector(":scope > [data-drpg-name-refused]") ?? null;
    if (!said && field.parentElement) {
        said = document.createElement("span");
        said.className = "drpg-field-error";
        said.dataset.drpgNameRefused = "";
        said.id = `drpg-name-refused-${field.dataset.drpgOwnsResult ?? "entry"}`;
        field.after(said);
    }
    if (said) {
        said.textContent = game.i18n.localize("DRPG.Tables.needsName");
        field.setAttribute("aria-describedby", said.id);
    }
    return true;
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

    const picked = await drpgWindow({
        title: game.i18n.format("DRPG.Tables.placeTitle", { name }),
        classes: ["drpg-panel", "drpg-window-place-result"],
        width: "wide",
        modal: true,
        body: `<form>
            <p class="notes">${game.i18n.localize("DRPG.Tables.placeIntro")}</p>
            ${group(tierList, game.i18n.localize("DRPG.Tables.tabTierPools"))}
            ${group(roomList, game.i18n.localize("DRPG.Tables.tabRoomPools"))}
            <p class="notes">${game.i18n.localize("DRPG.Tables.placeRolesNote")}</p>
        </form>`,
        footer: {
            primary: {
                action: "save", label: game.i18n.localize("DRPG.Tables.placeSave"),
                callback: (e, b, d) => all
                    .filter(t => d.element
                        .querySelector(`[name="table:${CSS.escape(t.id)}"]`)?.checked)
                    .map(t => t.id)
            },
            close: { role: "cancel", action: "cancel" }
        },
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
export async function promptForTableName(currentName, check = () => null) {
    /* ASKED AGAIN WITH THE REFUSAL UNDER THE FIELD (E14 part 2 C5, S13-09). A refused name used to end in a toast and
       the GM's typing gone; now the prompt comes back holding what they typed, the sentence under it, until a name
       passes `check`, the name is left as it was, or the prompt is closed. Exported for the suite (E14 fix e1-G7). */
    let value = currentName, refusal = null;
    for (;;) {
        // The kit's one-answer question (E21 C2b): answers the callback's value, null when closed, as DialogV2.prompt did.
        const result = await drpgPrompt({
            title: game.i18n.localize("DRPG.Tables.renameTable"),
            classes: ["drpg-panel", "drpg-rename-table"],
            body: `
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

/*
 * THE ITEM'S PICTURE IS PICKED AS A PROJECT'S ICON IS (H83, the owner's 26.10.2026 note: "Bardzo mi sie podoba wybor
 * ikonek w projekcie - czy w tworzeniu itema w item tables tez mozemy zrobic cos takiego?", and "Chodzi mi o uzycie juz
 * istniejacych ikonek w module").
 *
 * Until 1.2.86 the pane had one thumbnail that opened a file browser, so giving a new screwdriver the Tools drawing
 * meant finding modules/<module>/icons/ by hand. Now it is a grid of `.drpg-choice` radio cells, as projects-ui.mjs
 * `glyphGrid` draws a project's: one cell per drawing the module ships for its categories (config.mjs `itemIcon`, one
 * file per category: six at 1.2.86), and around them two that are not drawings.
 *
 * The first is the category's own and stores NOTHING, as the glyph grid's default does: `img.new` stays "", and
 * `addResult` gives the entry `itemIcon` of its table's category, exactly as before this grid. A GM who never touches
 * it leaves no choice behind, so "no choice" stays tellable from "chose the Usable drawing". The last is Another file:
 * the file browser as it was (the owner's default, kept), and the file it returns is shown in that cell.
 *
 * `img.new` is still the record and the only thing Add reads (`readNewItemForm`); the radios are a view of it, painted
 * from it (`paintItemPicture`), so a preset's picture lights its drawing's cell, or Another file with the file in it.
 * In a `<details>`, as the glyph grid is, open when a picture is stored (a preset's), and its closed line names the
 * cell that is lit. Against 1.2.85's tab, closed it adds 20 to 34 px and open 126 to 237 px, the eight cells three
 * rows of the label grid's field column (read in the stand-in: Chromium, 1366x768, both themes, a 13 and a 16 px root,
 * English and Polish; under Stained Glass the tab was already taller than the window there, and scrolls further).
 */
const OTHER_PICTURE = "file";

/** The drawings a new entry may wear: one per category's file, each named by its first category. */
function itemDrawings() {
    const seen = new Map();
    for (const [key, cat] of Object.entries(ITEM_CATEGORIES)) {
        const path = itemIcon(key);
        if (!seen.has(path)) seen.set(path, { path, label: cat.label ?? key });
    }
    return [...seen.values()];
}

function itemPictureGrid(current) {
    const cell = (value, swatch, label) => `<label class="drpg-choice drpg-glyph-choice drpg-item-picture-choice"
                title="${esc(label)}">
            <input type="radio" name="newImgChoice" value="${esc(value)}" />
            ${swatch}
            <span class="drpg-glyph-name">${esc(label)}</span>
        </label>`;
    const img = (src, data = "") => `<img class="drpg-item-picture-swatch"${src ? ` src="${esc(src)}"` : ""} alt=""${data} />`;
    const label = game.i18n.localize("DRPG.Tables.picture");
    // The swatches carry their sources here; which cell is lit is painted from `img.new` once the window is up.
    const cells = [
        cell("", img(itemIcon(null), " data-drpg-picture-own"), game.i18n.localize("DRPG.Tables.pictureOwn")),
        ...itemDrawings().map(d => cell(d.path, img(d.path), d.label)),
        cell(OTHER_PICTURE, `${img(current, " data-drpg-picture-file hidden")}
            <i class="fa-solid fa-folder-open" inert></i>`, game.i18n.localize("DRPG.Tables.pictureFile"))
    ];
    return `<div class="drpg-tables-picture">
                    <span class="drpg-tables-picture-label">${esc(label)}</span>
                    <details class="drpg-glyph-picker drpg-item-picture-picker"${current ? " open" : ""}>
                        <summary data-drpg-picture-summary>${esc(pictureName(current))}</summary>
                        <div class="drpg-glyph-grid drpg-item-picture-grid" role="radiogroup" aria-label="${esc(label)}"
                             data-drpg-item-pictures>${cells.join("")}</div>
                    </details>
                </div>`;
}

/** What the closed picker's line says: the name of the cell `img.new` lights. */
function pictureName(stored) {
    if (!stored) return game.i18n.localize("DRPG.Tables.pictureOwn");
    return itemDrawings().find(d => d.path === stored)?.label ?? game.i18n.localize("DRPG.Tables.pictureFile");
}

/** The cells and the preview, painted from `img.new`: the record wins, whatever was clicked last. */
function paintItemPicture(root) {
    const stored = root.querySelector('[name="img.new"]')?.value ?? "";
    const own = itemIcon(String(root.querySelector("[name=newCategory]")?.value ?? "").split(":")[0]);
    const lit = !stored ? "" : itemDrawings().some(d => d.path === stored) ? stored : OTHER_PICTURE;
    for (const radio of root.querySelectorAll('[name="newImgChoice"]')) radio.checked = radio.value === lit;
    root.querySelector(".drpg-tables-new-head > img")?.setAttribute("src", stored || own);
    root.querySelector("[data-drpg-picture-own]")?.setAttribute("src", own);
    const summary = root.querySelector("[data-drpg-picture-summary]");
    if (summary) summary.textContent = pictureName(stored);
    const file = root.querySelector("[data-drpg-picture-file]");
    if (file) {
        const shown = lit === OTHER_PICTURE;
        if (shown) file.setAttribute("src", stored);
        file.hidden = !shown;
        const glyph = file.parentElement?.querySelector(":scope > i");
        if (glyph) glyph.hidden = shown;
        file.closest(".drpg-choice")?.setAttribute("title", shown ? stored : game.i18n.localize("DRPG.Tables.pictureFile"));
    }
}

function wireItemPicture(root) {
    const grid = root.querySelector("[data-drpg-item-pictures]");
    if (!grid) return;
    if (!grid.dataset.drpgWired) {
        grid.dataset.drpgWired = "1";
        grid.addEventListener("change", ev => {
            const radio = ev.target.closest?.('[name="newImgChoice"]');
            if (!radio || radio.value === OTHER_PICTURE) return;
            const field = root.querySelector('[name="img.new"]');
            if (field) field.value = radio.value;
            paintItemPicture(root);
        });
        /*
         * ANOTHER FILE IS A COMMAND, NOT A STATE. Its click is cancelled, so the cell lit stays the one `img.new` names
         * until the browser answers: a browser closed without a pick leaves the old choice lit and stored, never a lit
         * Another file over a field that still says the category's own. A click on the cell's text reaches the radio
         * as the label's own click, and Space or an arrow key landing on it is a click too (read in Chromium: an arrow
         * onto the cell opens the browser and leaves the earlier cell lit), so this one listener hears them all. The
         * cells are painted back at once as well: a cancelled radio click puts back the group's earlier choice in
         * Chromium (read), and jsdom only unticks the clicked one (read in the harness: no cell lit). The answer is
         * looked up in `root` when it arrives, as `wirePortraitPickers` does (F13).
         */
        grid.addEventListener("click", ev => {
            const radio = ev.target.closest?.(`[name="newImgChoice"][value="${OTHER_PICTURE}"]`);
            if (!radio) return;
            ev.preventDefault();
            paintItemPicture(root);
            new foundry.applications.apps.FilePicker.implementation({
                type: "image",
                current: root.querySelector('[name="img.new"]')?.value || DEFAULT_RESULT_IMG,
                callback: path => {
                    const live = root.querySelector('[name="img.new"]');
                    if (live) live.value = path;
                    paintItemPicture(root);
                }
            }).render(true);
        });
        // The category's own follows the category: the preview and the first cell show what Add would give.
        root.querySelector("[name=newCategory]")?.addEventListener("change", () => paintItemPicture(root));
    }
    paintItemPicture(root);
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
                    <img src="${esc(preset?.img || itemIcon(presetChoice?.key ?? categoryList[0]?.key))}" alt=""
                         class="drpg-tables-preview" />
                    <input type="hidden" name="img.new" value="${esc(preset?.img || "")}" />
                    <label>${game.i18n.localize("DRPG.Items.name")}
                        <input type="text" name="newName" value="${esc(preset?.name ?? "")}"
                               placeholder="${esc(game.i18n.localize("DRPG.Items.namePlaceholder"))}" /></label>
                </div>
                ${itemPictureGrid(preset?.img || "")}
                <label>${game.i18n.localize("DRPG.Items.description")}
                    <textarea name="newText" rows="2"
                        placeholder="${esc(game.i18n.localize("DRPG.Items.descriptionPlaceholder"))}"></textarea></label>
                <label>${game.i18n.localize("DRPG.Items.category")}
                    <select name="newCategory">${categories}</select></label>
                <label>${game.i18n.localize("DRPG.Items.tier")}
                    <select name="newTier">${tiers}</select></label>
                <div data-drpg-tier-target></div>
                <div class="drpg-tables-roles">
                    <div class="notes" data-drpg-roles-note>${
                        game.i18n.localize("DRPG.Tables.rolesNote")}</div>
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
/*
 * THE PICK LIST ON THE KIT (E46-C3b, 09.11.2026): a `dataTable` of the pool's short name and its entries - the two
 * things its row said. The slice's category and tier columns were drawn and taken out: in a left column of 20rem
 * four columns did not fit (Chromium, 1366x768: under the glass the name broke letter by letter; under Legacy in
 * Polish "Przedmioty" and "Narzędzie" ran into the next column), and a tier pool's name says both. The row's first
 * cell is the pick button, as the `li` was: every handler finds it by `[data-drpg-table]` and the entries' count by
 * `[data-drpg-table-count]` in its row.
 */
function poolListHtml(family, mine, first) {
    const columns = [
        { key: "name", label: game.i18n.localize("DRPG.Tables.col.table") },
        { key: "count", label: game.i18n.localize("DRPG.Tables.col.items"), num: true }
    ];
    const rows = mine.map(t => ({
        name: `<button type="button" class="drpg-table-pick${t.id === first?.id ? " active" : ""}" data-drpg-table="${
            t.id}" title="${esc(t.name)}"><span>${esc(shortPoolName(t.name))}</span></button>`,
        count: `<span data-drpg-table-count>${t.results.size}</span>`
    }));
    return dataTable({ columns, rows });
}

export function poolPaneHtml(family, mine, selected, refusal = null) {
    const first = mine.find(t => t.id === selected?.id) ?? mine[0] ?? null;
    const list = mine.length
        ? `<div class="drpg-tables-list">${poolListHtml(family, mine, first)}</div>`
        : `<p class="notes">${esc(game.i18n.localize(family === "tiers"
            ? "DRPG.Tables.noTierPools" : "DRPG.Tables.noRoomPools"))}</p>`;

    /* `data-drpg-pool-pane`, not the `data-drpg-pane` it was until E44 C4a: that attribute is the kit's tab pane now
       (ui-kit.mjs `kitTabs`), and a pool's pane sits inside one - the kit, which hides every pane but the shown one,
       would have hidden it too. */
    return `<div data-drpg-pool-pane="${family}">
        <p class="notes">${game.i18n.localize("DRPG.Tables.editorIntro")}</p>
        <div class="drpg-tables-layout">
            <div class="drpg-tables-left">${list}</div>
            <div class="drpg-tables-right">
                <div class="drpg-table-heading">
                    <h4 data-drpg-table-name title="${esc(first?.name ?? "")}">${esc(shortPoolName(first?.name))}</h4>
                    <span class="drpg-table-actions" role="group"><button type="button" class="drpg-mini-button" data-drpg-rename-table>${
                        esc(game.i18n.localize("DRPG.Tables.renameTable"))}</button><button type="button" class="drpg-mini-button" data-drpg-delete-table>${
                        esc(game.i18n.localize("DRPG.Tables.deleteTable"))}</button></span>
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
        .querySelector(".drpg-tab-pane:not([hidden]) [data-drpg-pool-pane]")
        ?.dataset.drpgPoolPane;
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
        const said = table
            // The pool as the list names it (E46-C3, S13-36 (3)): "Goes into DRPG Usables (Healing) - Tier 2" read the prefix the list drops.
            ? game.i18n.format("DRPG.Tables.tierTargetIs", { table: shortPoolName(table.name) })
            : game.i18n.localize("DRPG.Tables.tierTargetNone");
        // No pool to go into is the kit's warning box (E46-C3b; E21's carried warning site), a pool a plain line.
        tierLine.innerHTML = table ? `<p class="notes">${esc(said)}</p>` : box("warning", esc(said));
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
        // Under the roles' tier the note is the kit's warning box (E46-C3b), at it the plain line it was.
        const note = root.querySelector("[data-drpg-roles-note]");
        if (note) note.innerHTML = allowed ? esc(game.i18n.localize("DRPG.Tables.rolesNote"))
            : box("warning", esc(game.i18n.localize("DRPG.Tables.rolesNote")));
    };
    tierSelect?.addEventListener("change", gateRoles);
    // ONE EXTRA ROLE, NOT TWO. The home is a tag as well, so a second
    // tick would make three: ticking one unticks the others below (the rule
    // is this handler's alone).
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
        const family = pane.dataset.drpgPoolPane === "tiers" ? "tiers" : "rooms";
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
        // What cannot be undone (E22): the kit's destructive question, Cancel the default (E21 C2b).
        const ok = await drpgConfirm({
            classes: ["drpg-panel", "drpg-window-delete-table"],
            yes: { role: "destructive", label: game.i18n.localize("DRPG.Tables.deleteTable") },
            title: game.i18n.localize("DRPG.Tables.deleteTable"),
            body: `<p>${plural("DRPG.Tables.deleteConfirm", {
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

        /* THE NEXT TABLE FROM THE LIST (E46-C3, S08-46): `[data-drpg-table]` alone also matched the deleted table's own
           rows in the body (each row carries its table's id), so after the last table of a tab the pane "clicked" a row
           of a table that no longer exists and kept showing it, Rename and Delete live over nothing. */
        root.querySelector(`.drpg-tables-list [data-drpg-table="${CSS.escape(gone.id)}"]`)
            ?.closest("li, tr")?.remove();
        const next = pane.querySelector(".drpg-tables-list [data-drpg-table]");
        if (next) next.click();
        else await show(null);
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
                    const badge = button.closest("tr")?.querySelector("[data-drpg-table-count]");
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
        if (refuseEmptyName(field)) return;
        field.parentElement?.querySelector(":scope > [data-drpg-name-refused]")?.remove();

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
            if (refuseEmptyName(field)) {
                ui.notifications.warn(game.i18n.localize("DRPG.Tables.needsName"));
                continue;
            }
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
        bodyEl.innerHTML = table ? tableItemsHtml(table)
            : `<p class="notes">${game.i18n.localize("DRPG.Tables.noneYet")}</p>`;
        wireRoomFilter(bodyEl);
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

    log(`Item tables: "${action.name}" added to ${added} of ${action.tables.length} table(s).`);
    /* FEWER THAN ASKED IS A FAILURE (E46-C3, S08-46): "added to 0 tables" came in blue, as a success. The tables it
       could not write are in the console (`addResult`). */
    if (added < action.tables.length) ui.notifications.warn(game.i18n.localize("DRPG.Items.failed"));
    else ui.notifications.info(plural("DRPG.Tables.itemAdded", { name: action.name, n: added }));
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
export async function openItemTables({ preset = null, poolError = null } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-tables")) return RAISED;

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

    // Not a `fit` window: there is no table in here to measure. Its two panes
    // are a list and a form, and a window sized by a measure with nothing to
    // measure keeps whatever width the dialog opened at - which is 400px, and
    // half of what this layout needs. So it states its width, the kit's
    // `tables` (58rem: ui-kit.mjs WINDOW_WIDTHS; danganronpa.css's
    // `.drpg-wide` and `.drpg-window-tables` rules until E21 W1).
    const action = await drpgWindow({
        title: game.i18n.localize("DRPG.Tables.editorTitle"),
        classes: ["drpg-panel", "drpg-projects", "drpg-window-tables"],
        width: "tables",
        // Three tabs (Dawid, 26.08; trimmed from four in E10): editing what a
        // tier table holds, the same for room tables, and making a new item.
        // The footer buttons act across tabs - each reads its own pane's
        // inputs, which stay in the DOM whichever tab is showing (see
        // `kitTabs` in ui-kit.mjs).
        //
        // A refused table name comes back on the tab it was typed on, kept in its field
        // with the refusal under it (E14 part 2 C5, S13-09): the window used to reopen on
        // the first tab with the field empty, so on the Room pools tab the GM saw neither.
        // A preset opens on Add an item, where its name and tier are (C6, S08-21): it
        // opened on Tier pools, with Create table and Install in the footer.
        body: `<form>${kitTabs([
            { key: "editTiers", label: game.i18n.localize("DRPG.Tables.tabTierPools"),
              html: poolPaneHtml("tiers", tierTables, selected, poolError?.family === "tiers" ? poolError : null) },
            { key: "editRooms", label: game.i18n.localize("DRPG.Tables.tabRoomPools"),
              html: poolPaneHtml("rooms", roomTablesList, selected, poolError?.family === "rooms" ? poolError : null) },
            { key: "newItem", label: game.i18n.localize("DRPG.Tables.tabNewItem"),
              html: newItemPaneHtml(preset, presetTargets, roomTablesList) }
        ], { active: poolError ? (poolError.family === "rooms" ? "editRooms" : "editTiers") : preset ? "newItem" : null })}</form>`,
        /* THE FOOTER BY ROLE (E21 C2b, E22): Add an item the primary; Create table secondary; Install / reinstall
           destructive (it rebuilds the default set: never the default); Close, since every row saves itself. */
        footer: {
            primary: {
                action: "add", label: game.i18n.localize("DRPG.Tables.addItem"),
                callback: (e, b, d) => readNewItemForm(d, roomTablesList)
            },
            secondary: [{
                // "Create table", not "New room table": the tab is called that
                // already, and a button repeating its tab's name says nothing
                // about what pressing it does.
                action: "newPool", label: game.i18n.localize("DRPG.Tables.createTable"),
                // Each pane has its own field, and the one with something in it
                // is the one that was meant - a GM types in the tab they are
                // looking at. The family travels with the name because it
                // decides what the name is allowed to be.
                callback: (e, b, d) => readNewPoolName(d)
            }],
            destructive: [{ action: "install", label: game.i18n.localize("DRPG.Tables.installAction") }],
            close: { role: "close", action: "close" }
        },
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
            // `win` and `app` (E21 C2b): the bar may widen the window, and a press puts it back on the screen (C1b).
            wireKitTabs(root, {
                win: root,
                app: dialog,
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
            wireItemPicture(root);

            for (const pane of root.querySelectorAll("[data-drpg-pool-pane]")) wirePoolPane(pane, root);
            root.querySelector('[data-drpg-pool-pane] input[aria-invalid="true"]')?.focus();
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
