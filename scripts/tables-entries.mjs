/**
 * Danganronpa RPG - an item table's entries added, edited, dropped and placed.
 * ---------------------------------------------------------------------------
 * WHERE IT SITS. Moved out of tables-editor.mjs by a pure move (1.2.122 line WORLD, 21.11.2026; the owner's answer
 * on STG-61, "Akceptujemy wyjatki do 1750": tables-editor.mjs stood at 1895 lines), proved by
 * `node tools/moved-only.mjs`. tables-editor.mjs imports these five from here and nothing here imports it back;
 * tables.mjs re-exports none of them, as it re-exported none before. They read the pools (tables-pools.mjs) and
 * nothing else of the family.
 */

import { MODULE_ID, itemIcon } from "./config.mjs";
import { error, esc } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";
import { isTierPoolTable, MULTI_ROLE_TIER, rolesForPoolItem, moduleTables } from "./tables-pools.mjs";

/**
 * Add one entry to a table and keep it rollable.
 *
 * `normalize()` is what makes this safe to call on a table a GM has been
 * editing by hand: it re-ranges every result and rewrites the formula, so a
 * table that was `1d4` with four entries becomes `1d5` with five rather than a
 * table whose fifth item can never come up.
 */
export async function addResult(table, { name, description = "", img = null, roles = null }) {
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
export async function editResult(table, resultId, field, value) {
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
export function refuseEmptyName(field) {
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
export async function dropResult(table, resultId) {
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
export async function placeResultDialog(table, resultId) {
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
