/**
 * Danganronpa RPG - the GM hands things out, and takes them away.
 * ---------------------------------------------------------------------------
 * Search puts items into an inventory on its own, but plenty of things arrive
 * by other routes: a project that produced a tool, a reward, a Truth Bullet the
 * GM is issuing for a Remnant somebody Observed, or a crime tool being confiscated
 * after the trial. All of those were console work before this.
 *
 * Truth Bullets matter most here. They are the one category nothing in the module
 * creates automatically, so until the investigation loop exists this dialog is
 * how evidence reaches a player's sheet - and it writes the same category flag
 * the sheet groups on, which is exactly what the old hand-rolled macro did not.
 */

import {
    MODULE_ID, ITEM_CATEGORIES, LIMIT_GROUPS, ITEM_TIERS, TIER_EFFECTS, USABLE_KINDS,
    USABLE_KIND_EFFECTS, EQUIPPABLE,
    TRUTH_BULLET_TYPES, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS
} from "./config.mjs";
import { grantItem, itemsInCategory, countInCategory, countInGroup, inventorySummary,
    pickableCategories, isStashed }
    from "./inventory.mjs";
// `BULLET_CATEGORY` went with the hand-rolled category list: excluding Truth
// Bullets is `pickableCategories`'s job now, not this file's.
import { createTruthBullet, issueAutopsy, copiedRemnants }
    from "./truth-bullets.mjs";
import { ITEM_POOLS, USABLE_GOALS, moduleTables, rolesOfResult, MULTI_ROLE_TIER }
    from "./tables.mjs";
import { studentActors } from "./monokuma.mjs";
import { whisperToOwner, dialogContent, panelTabs, wirePanelTabs, workingScene,
    log, error, plural, cardHead, esc} from "./utils.mjs";
import { alreadyOpen } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * ENTRY POINT
 * ========================================================================== */

/**
 * Open the item manager. GM only.
 *
 * @param {Actor} [actor]  Skip the character picker when the caller knows who.
 */
export async function openItemManager(actor = null) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-items")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /*
     * NOBODY IS PICKED ON THE WAY IN (Dawid, 31.08).
     *
     * This used to ask which student before it opened anything, and then offer
     * a menu whose buttons are not all about a student: the stash inspector
     * reads every stash in the world. A GM who wanted it had to name somebody
     * first and then watch that answer be ignored.
     *
     * The question moved to where it is used. Each of the four routes below
     * asks for its own person, inside its own form, where it can still be
     * changed after the thing has been built - which is the same correction
     * `gmGiveItemDialog` already got, applied to the rest of them.
     *
     * A character is still ACCEPTED, because opening this from a sheet knows
     * perfectly well who it is about. It just is not demanded any more.
     */
    const students = studentActors();
    const target = actor ?? students[0] ?? null;
    if (!target) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return null;
    }

    /*
     * ONE WINDOW: WHO, WHAT THEY HAVE, GIVE OR TAKE (Dawid, 03.09).
     *
     * This was a menu of five buttons that each opened somewhere else, and the
     * one thing a GM wants to see before pressing any of them - what the
     * student is actually holding, and what is in their stash - was behind a
     * sixth ("Look inside the stashes"). The holdings are on the window now,
     * and the only choice left at this level is the verb.
     *
     * TWO TABS AND A FOOTER THAT FOLLOWS THEM, which is what `wirePanelTabs`
     * is for and what Item Tables and Sound already do. Nothing underneath
     * changed: `gmGiveItemDialog`, `giveTruthBulletDialog`, `giveKeyDialog` and
     * `takeItemDialog` are the same windows, reached from the tab that matches
     * what they do.
     *
     * A stashed item is an ordinary item on its owner's sheet, so the stash
     * needs no separate reader - it is a flag on a row this list already walks.
     * `openVaultInspector` stays on the console for a GM who wants every
     * stash at once rather than one student's.
     */
    const holdingsFor = who => {
        const groups = [];
        for (const [key, cat] of Object.entries(ITEM_CATEGORIES)) {
            const all = itemsInCategory(who, key);
            if (!all.length) continue;
            const rows = all.map(item => {
                const tier = item.getFlag(MODULE_ID, "tier");
                return `<li>${esc(item.name)}${
                    tier !== undefined && tier !== null
                        ? ` <span class="notes">T${tier}</span>` : ""
                }${isStashed(item)
                    ? ` <span class="notes">${esc(game.i18n.localize("DRPG.Items.inStash"))}</span>`
                    : ""}</li>`;
            }).join("");
            groups.push(`<div class="drpg-holdings-group"><h4>${esc(cat.label)}</h4>`
                + `<ul>${rows}</ul></div>`);
        }
        return `<p class="notes">${esc(inventorySummary(who))}</p>`
            + (groups.length
                ? `<div class="drpg-holdings">${groups.join("")}</div>`
                : `<p class="notes">${esc(game.i18n.format("DRPG.Items.carriesNothing",
                    { actor: who.name }))}</p>`);
    };

    const whoOptions = students
        .map(a => `<option value="${a.id}"${a.id === target.id ? " selected" : ""}>${
            esc(a.name)}</option>`).join("");

    const choice = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Items.manage") },
        classes: ["drpg-panel", "drpg-window-items"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Items.whichCharacterHub")}
                <select name="who">${whoOptions}</select></label>
            <div class="drpg-holdings-live">${holdingsFor(target)}</div>
            ${panelTabs([
                { key: "give", label: game.i18n.localize("DRPG.Items.tabGive"),
                  html: `<p class="notes">${game.i18n.localize("DRPG.Items.giveNote")}</p>` },
                { key: "take", label: game.i18n.localize("DRPG.Items.tabTake"),
                  html: `<p class="notes">${game.i18n.localize("DRPG.Items.takeNote")}</p>` }
            ])}
        </form>`),
        render: (event, dialog) => {
            wirePanelTabs(dialog.element, {
                buttons: {
                    give: ["give", "bullet", "key"],
                    take: ["take", "takeBullet", "takeKey"]
                },
                always: ["cancel"]
            });

            // The read-out follows the person, or a GM who changes their mind
            // reads the last student's pockets under a new name.
            const form = dialog.element.querySelector("form");
            const live = dialog.element.querySelector(".drpg-holdings-live");
            form?.elements?.who?.addEventListener("change", () => {
                const who = game.actors.get(form.elements.who.value);
                if (who && live) live.innerHTML = holdingsFor(who);
            });
        },
        buttons: [
            // Each returns the verb AND who it is about, because the select
            // above is the answer now - the argument this function was called
            // with is only its default.
            ...[["give", "DRPG.Items.give"],
                ["bullet", "DRPG.TruthBullet.give"],
                ["key", "DRPG.Vault.giveKey"],
                ["take", "DRPG.Items.take"],
                // A FILTER, NOT A SECOND DIALOG. `takeItemDialog` already lists
                // Truth Bullets - it walks every category - so this is that
                // window with everything else hidden. A GM removing a bullet is
                // looking for one of three among fifteen things.
                ["takeBullet", "DRPG.TruthBullet.takeAway"],
                // The same filter for keys. Give has a door for them, so Take
                // has one too (Dawid, 03.09).
                ["takeKey", "DRPG.Vault.takeKey"]
            ].map(([action, labelKey]) => ({
                action,
                label: game.i18n.localize(labelKey),
                callback: (e, b, d) => ({
                    go: action,
                    who: d.element.querySelector("[name=who]")?.value ?? target.id
                })
            })),
            { action: "cancel", label: game.i18n.localize("DRPG.Panel.close") }
        ],
        rejectClose: false
    });

    if (!choice || choice === "cancel") return null;
    const chosen = game.actors.get(choice.who) ?? target;

    /*
     * CANCELLING A STEP COMES BACK HERE (D-F5-2).
     *
     * Every branch used to read `made ? openItemManager(target) : null`, so
     * succeeding returned to the hub and CANCELLING closed the whole thing -
     * and with it the character this window is about. A GM who opened Give,
     * thought better of it and pressed Cancel was put back in the GM panel
     * having to pick the student again, which is the one thing the hub exists
     * to save them.
     *
     * Two different depths for the same gesture, and the wrong one was the
     * cheaper to reach. Now every step returns to the hub whatever the answer,
     * and the hub's own Close is the single way out - one exit, at the level
     * the GM opened.
     */
    const step = {
        give: () => gmGiveItemDialog(chosen),
        bullet: () => giveTruthBulletDialog(chosen),
        key: () => giveKeyDialog(chosen),
        take: () => takeItemDialog(chosen),
        takeBullet: () => takeItemDialog(chosen, { only: "truthBullet" }),
        takeKey: () => takeItemDialog(chosen, { only: "bedroomKey" })
    }[choice.go];

    if (!step) return null;
    await step();
    // Straight back to the hub, so handing over three things is three clicks
    // rather than three trips through the menu - and the holdings underneath
    // are rebuilt with whatever just changed.
    return openItemManager(chosen);
}

/**
 * Hand this character a key to somebody's bedroom.
 *
 * Only rooms that HAVE an owner are offered: a room nobody sleeps in is not a
 * bedroom and its door is not shut in the first place, so a key to it would
 * open nothing. Each option says whose room it is, because "Room 3" is not how
 * anybody at the table refers to it.
 */
async function giveKeyDialog(actor) {
    // Bedrooms, not stashes - a stash in somebody else's room must never
    // produce a key to it. See `allBedrooms` and trap 79.
    const { allBedrooms, grantBedroomKey, keysHeldBy } = await import("./vault.mjs");

    const students = studentActors();
    const initial = actor ?? students[0] ?? null;
    if (!initial) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return false;
    }

    // Nobody sleeps anywhere yet, so there is no such thing as a bedroom key.
    // Checked once, for everybody, because it is a fact about the map rather
    // than about the person receiving.
    if (!allBedrooms().some(v => v.owner)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noKeysToGive"));
        return false;
    }

    /*
     * WHICH KEYS ARE WORTH OFFERING DEPENDS ON WHO IS TAKING ONE. Their own
     * bedroom is not a key they need, and neither is one already on their ring.
     * So the list is built for a person and rebuilt when the person changes -
     * the same rule as the carry counts in `gmGiveItemDialog`.
     */
    const optionsFor = who => {
        const held = keysHeldBy(who);
        const rooms = allBedrooms()
            .filter(v => v.owner && v.owner.id !== who.id && !held.has(v.room));
        if (!rooms.length) {
            // An empty select would read as a window that failed to load. This
            // says what is true: there is no key this person is missing.
            return `<option value="">${foundry.utils.escapeHTML(
                game.i18n.localize("DRPG.Vault.noKeysToGive"))}</option>`;
        }
        return rooms.map(v =>
            `<option value="${foundry.utils.escapeHTML(v.room)}">${
                foundry.utils.escapeHTML(v.room)} - ${
                foundry.utils.escapeHTML(v.owner.name)}</option>`).join("");
    };

    const recipients = students
        .map(a => `<option value="${a.id}"${a.id === initial.id ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: actor
            ? game.i18n.format("DRPG.Vault.giveKeyTo", { actor: actor.name })
            : game.i18n.localize("DRPG.Vault.giveKey") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Items.recipient")}
                <select name="recipient">${recipients}</select></label>
            <label>${game.i18n.localize("DRPG.Vault.whichKey")}
                <select name="room">${optionsFor(initial)}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Vault.giveKeyNote")}</p>
        </form>`),
        render: (event, dialog) => {
            const form = dialog.element.querySelector("form");
            form?.elements?.recipient?.addEventListener("change", () => {
                const who = game.actors.get(form.elements.recipient.value);
                if (who) form.elements.room.innerHTML = optionsFor(who);
            });
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.give"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        room: f.elements.room.value,
                        recipient: f.elements.recipient.value
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const who = game.actors.get(result.recipient) ?? initial;
    if (!result.room) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vault.noKeysToGive"));
        return false;
    }

    const made = await grantBedroomKey(who, result.room);
    if (made) {
        ui.notifications.info(game.i18n.format("DRPG.Vault.keyGivenGm",
            { room: result.room, actor: who.name }));
    }
    return Boolean(made);
}

/* The character picker that used to stand in front of the hub lived here.
 * Every window it fed asks for its own recipient now - in the form, where the
 * answer can still be changed. See the note on `target` in `openItemManager`.
 */

/* ==========================================================================
 * GIVING
 * ========================================================================== */

/**
 * Hand over one item.
 *
 * The carry limit is shown rather than silently enforced: a GM putting something
 * on a sheet is making a ruling, and being told "Crime Tools 1/1" is more useful
 * than being refused. Going over the cap is deliberate and flagged.
 */
export async function gmGiveItemDialog(actor) {
    // Truth Bullets have their own dialog. They share nothing with a physical
    // item but the word "give": no tier, no carry limit, and half a dozen fields
    // this form has no place for.
    /*
     * THE CARRY COUNTS BELONG TO A PERSON, so they are built for one rather
     * than once. Changing the recipient rebuilds them - a row reading "2/2"
     * about somebody who is no longer getting the item is worse than a row
     * with no numbers on it at all.
     */
    /*
     * The list itself comes from `pickableCategories` - the one place that
     * decides which categories a form may offer, and which splits usables into
     * Healing and Sanity Relief because that split IS what a usable does. This
     * window had the split first and three others did not; sharing the list is
     * what stops them drifting again (audit A22-A24).
     *
     * What stays here is the only thing that is this window's own: the carry
     * count on each row.
     *
     * `foundry.utils.escapeHTML` rather than the local `esc`, which is declared
     * further down this function - the first call to this closure happens
     * before that line runs, so reaching for it would throw.
     */
    const categoriesFor = who => pickableCategories().map(choice => {
        const cat = ITEM_CATEGORIES[choice.key];
        // The shared budget, where there is one: rows drawing on the same
        // slots have to show the same number, or the GM reads "1/1" beside a
        // free slot and believes it. See `capacityLabel`.
        const group = cat?.limitGroup ?? null;
        const held = who
            ? (group ? countInGroup(who, group) : countInCategory(who, choice.key))
            : null;
        const limit = group ? LIMIT_GROUPS[group]?.limit : cat?.limit;
        const cap = held === null ? "" : (limit ? ` - ${held}/${limit}` : ` - ${held}`);
        return `<option value="${choice.value}">${
            foundry.utils.escapeHTML(choice.label)}${cap}</option>`;
    }).join("");

    // Everyone this can be handed to. The one who came in from the hub is
    // selected; opened from the hub there is nobody, and the first student
    // stands in - so the counts below always describe whoever the select is
    // actually showing.
    const students = studentActors();
    const initial = actor ?? students[0] ?? null;
    const categories = categoriesFor(initial);
    const recipients = students
        .map(a => `<option value="${a.id}"${a.id === initial?.id ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const tiers = ITEM_TIERS
        .map(t => `<option value="${t}"${t === 2 ? " selected" : ""}>${
            game.i18n.format("DRPG.Items.tierN", { n: t })
        }</option>`).join("");

    // Every built-in name, offered as autocomplete. The GM can type anything.
    const suggestions = Array.from(new Set([
        ...Object.values(ITEM_POOLS).flatMap(byTier => Object.values(byTier).flat()),
        ...Object.values(USABLE_GOALS).flatMap(({ pool }) => Object.values(pool).flat())
    ])).sort();

    // THE CATALOGUE - the item tables read the other way round: not "what can
    // a Search produce" but "what is there to hand over". Giving from here is
    // what keeps a hand-out consistent with the world: the entry's own icon
    // and description come along, and a usable's kind is whatever its table
    // already says. (Dawid, 2026-08-26: create-new was the only mode, so every
    // give retyped an item the tables already knew.)
    const catalogue = moduleTables().filter(t => t.results.size);

    /*
     * THE TABLE FIRST, THEN WHAT IS IN IT (Dawid, 03.09).
     *
     * This was one select carrying every result of every table, with the table
     * as an `<optgroup>` label. A world with the default set installed puts
     * several hundred rows in it, so a GM who knew exactly which table they
     * wanted still had to find one line inside a list of everything - and the
     * category and tier beside it followed the ITEM, which is the wrong end:
     * the table is what knows those two.
     *
     * Two selects, and the second is rebuilt from the first. The item options
     * are built here rather than rendered hidden, because a `<select>` with
     * hidden options is a control that reports values nobody can see.
     */
    const tableOptions = catalogue.map(table => {
        const cat = table.getFlag(MODULE_ID, "category") ?? "";
        const tier = table.getFlag(MODULE_ID, "tier");
        const goal = table.getFlag(MODULE_ID, "goal") ?? "";
        return `<option value="${table.id}" data-category="${esc(cat)}" data-tier="${
            tier ?? ""}" data-goal="${esc(goal)}">${esc(table.name)} (${table.results.size})</option>`;
    }).join("");

    const itemOptionsFor = table => Array.from(table?.results ?? [])
        .map(r => `<option value="${r.id}">${esc(r.name ?? r.text ?? "")}</option>`).join("");

    const existingPane = catalogue.length
        ? `<label>${game.i18n.localize("DRPG.Items.pickTable")}
                <select name="exTable">${tableOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Items.pickExisting")}
                <select name="exItem">${itemOptionsFor(catalogue[0])}</select></label>
            <label>${game.i18n.localize("DRPG.Items.category")}
                <select name="exCategory">${categories}</select></label>
            <label>${game.i18n.localize("DRPG.Items.tier")}
                <select name="exTier">${tiers}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Items.existingNote")}</p>`
        : `<p class="notes">${game.i18n.localize("DRPG.Items.existingEmpty")}</p>`;

    const result = await DialogV2.wait({
        window: { title: actor
            ? game.i18n.format("DRPG.Items.giveTo", { actor: actor.name })
            : game.i18n.localize("DRPG.Items.give") },
        classes: ["drpg-panel"],
        // Two tabs, one verb (Dawid, 2026-08-26). The footer's Give reads
        // whichever pane is showing; the tell-player switch and the cap note
        // sit below the tabs because they are true of both.
        content: dialogContent(`<form>${panelTabs([
            { key: "existing", label: game.i18n.localize("DRPG.Items.tabGiveExisting"),
              html: existingPane },
            { key: "create", label: game.i18n.localize("DRPG.Items.tabCreateNew"), html: `
            <label>${game.i18n.localize("DRPG.Items.category")}
                <select name="category">${categories}</select></label>
            <label>${game.i18n.localize("DRPG.Items.tier")}
                <select name="tier">${tiers}</select></label>
            <label>${game.i18n.localize("DRPG.Items.name")}
                <input type="text" name="name" list="drpg-item-names"
                       placeholder="${game.i18n.localize("DRPG.Items.namePlaceholder")}" /></label>
            <datalist id="drpg-item-names">${
                suggestions.map(n => `<option value="${esc(n)}"></option>`).join("")
            }</datalist>
            <label>${game.i18n.localize("DRPG.Items.description")}
                <textarea name="description" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Items.descriptionPlaceholder")}"></textarea></label>
            <span class="drpg-role-picker" data-drpg-roles>
                <span class="drpg-role-label">${game.i18n.localize("DRPG.Items.alsoServesAs")}</span>
                ${EQUIPPABLE.map(key => `<label class="drpg-check"><input type="checkbox"
                    data-drpg-role="${key}" />${esc(ITEM_CATEGORIES[key]?.label ?? key)}</label>`).join("")}
            </span>
            <p class="notes" data-drpg-roles-note></p>` }
        ])}
            <label>${game.i18n.localize("DRPG.Items.recipient")}
                <select name="recipient">${recipients}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Items.overCapNote")}</p>
        </form>`),
        render: (event, dialog) => {
            wirePanelTabs(dialog.element);

            /*
             * THE TABLE DRIVES THE OTHER THREE.
             *
             * Picking a table refills the item list and moves the category and
             * tier to whatever that table is. All three stay editable
             * afterwards: a room pool carries no category of its own, and there
             * the GM's answer is the only one there is.
             */
            const form = dialog.element.querySelector("form");
            const tableSelect = form?.elements?.exTable;
            if (!tableSelect) return;

            const syncFromTable = ({ refillItems = true } = {}) => {
                const opt = tableSelect.selectedOptions?.[0];
                if (!opt) return;

                if (refillItems) {
                    const table = game.tables.get(tableSelect.value);
                    form.elements.exItem.innerHTML = itemOptionsFor(table);
                }

                const { category, tier, goal } = opt.dataset;
                if (category) {
                    const value = category === "usable" && goal ? `${category}:${goal}` : category;
                    if (form.elements.exCategory.querySelector(`option[value="${CSS.escape(value)}"]`)) {
                        form.elements.exCategory.value = value;
                    }
                }
                if (tier !== "") form.elements.exTier.value = tier;
            };

            tableSelect.addEventListener("change", () => syncFromTable());
            // On open the item list is already right, so only the two
            // read-along selects need moving.
            syncFromTable({ refillItems: false });

            // Both category selects carry the counts, and both are rebuilt when
            // the recipient changes. The picked value is kept across the swap.
            form.elements.recipient?.addEventListener("change", () => {
                const who = game.actors.get(form.elements.recipient.value);
                for (const name of ["category", "exCategory"]) {
                    const select = form.elements[name];
                    if (!select) continue;
                    // The chosen value survives the swap - the options are
                    // rebuilt for their counts, not for their identity.
                    const keep = select.value;
                    select.innerHTML = categoriesFor(who);
                    if ([...select.options].some(o => o.value === keep)) select.value = keep;
                }
            });

            /*
             * A SECOND ROLE, ON THE SAME TERMS AS THE TABLES (Dawid, 31.08).
             *
             * Two rules, both borrowed rather than reinvented so the two places
             * a GM can make an item cannot disagree: a role is offered only
             * from `MULTI_ROLE_TIER` up, because a two-tag item is
             * unconditionally better than a one-tag one and has no business at
             * the bottom of the range; and an item is never offered its own
             * home, which would be a box that cannot be unticked.
             *
             * Repainted on every change to either select, because both of them
             * decide what is on offer.
             */
            const rolePicker = form.querySelector("[data-drpg-roles]");
            const roleNote = form.querySelector("[data-drpg-roles-note]");
            const paintRoles = () => {
                if (!rolePicker) return;
                const [home] = String(form.elements.category?.value ?? "").split(":");
                const tier = Number(form.elements.tier?.value);
                const allowed = Number.isFinite(tier) && tier >= MULTI_ROLE_TIER;

                for (const box of rolePicker.querySelectorAll("[data-drpg-role]")) {
                    const isHome = box.dataset.drpgRole === home;
                    const off = isHome || !allowed;
                    box.disabled = off;
                    if (off) box.checked = false;
                    box.closest("label")?.classList.toggle("drpg-locked", off);
                    box.closest("label")?.toggleAttribute("hidden", isHome);
                }
                if (roleNote) {
                    roleNote.textContent = allowed
                        ? ""
                        : game.i18n.format("DRPG.Tables.rolesTierOnly", { tier: MULTI_ROLE_TIER });
                }
            };
            form.elements.category?.addEventListener("change", paintRoles);
            form.elements.tier?.addEventListener("change", paintRoles);
            paintRoles();
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.give"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    const active = d.element.querySelector(".drpg-gmt-section.active")
                        ?.dataset.drpgGmtSection ?? "create";

                    if (active === "existing" && f.elements.exTable) {
                        const [category, kind = null] = f.elements.exCategory.value.split(":");
                        return {
                            mode: "existing",
                            tableId: f.elements.exTable.value,
                            resultId: f.elements.exItem.value,
                            category, kind,
                            tier: Number(f.elements.exTier.value),
                            tell: f.elements.tell.checked,
                            recipient: f.elements.recipient?.value ?? null
                        };
                    }

                    // "usable:healing" carries the kind after the colon; the
                    // plain categories have nothing to split.
                    const [category, kind = null] = f.elements.category.value.split(":");
                    return {
                        mode: "create",
                        category,
                        kind,
                        tier: Number(f.elements.tier.value),
                        name: f.elements.name.value.trim(),
                        description: f.elements.description.value.trim(),
                        roles: [...f.querySelectorAll("[data-drpg-role]:checked")]
                            .map(b => b.dataset.drpgRole),
                        tell: f.elements.tell.checked,
                        recipient: f.elements.recipient?.value ?? null
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    /*
     * THE WINDOW'S OWN ANSWER WINS over the one it was opened with (Dawid,
     * 31.08). Picking the student used to happen before the window, so changing
     * your mind after building the item meant closing everything and walking
     * the whole route again. The field is the point; the argument is only its
     * default.
     */
    const chosen = game.actors.get(result.recipient) ?? actor ?? initial;
    if (!chosen) {
        ui.notifications.warn(game.i18n.localize("DRPG.Items.needsRecipient"));
        return false;
    }
    actor = chosen;

    // Both tabs funnel into one shape, so everything below - the grant, the
    // receipt, the log line - cannot diverge between them.
    let give;
    if (result.mode === "existing") {
        const entry = game.tables.get(result.tableId)?.results?.get(result.resultId);
        if (!entry) {
            ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
            return false;
        }
        const name = entry.name ?? entry.text ?? "";
        give = {
            name,
            category: result.category,
            kind: result.kind,
            tier: result.tier,
            // The same rule drawItem applies: a description that is only the
            // name again adds nothing over the tier line the item will get.
            description: entry.description && entry.description !== name ? entry.description : "",
            // The same roles a Search would have handed over. Without this the
            // hammer given by hand and the hammer found in a room were two
            // different objects.
            roles: rolesOfResult(entry),
            img: entry.img ?? null
        };
    } else {
        if (!result.name) {
            ui.notifications.warn(game.i18n.localize("DRPG.Items.needsName"));
            return false;
        }
        give = { ...result, img: null };
    }

    const item = await grantItem(actor, {
        name: give.name,
        category: give.category,
        tier: give.tier,
        goal: give.kind,
        roles: give.roles?.length ? give.roles : null,
        img: give.img,
        description: give.description
            ? `<p>${esc(give.description)}</p>`
            : "",
        // A GM handing something over outranks the carry limit.
        override: true
    });

    if (!item) {
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    log(`GM gave ${actor.name} "${give.name}" (${give.category}, Tier ${give.tier}).`);
    ui.notifications.info(game.i18n.format("DRPG.Items.gave", {
        item: give.name, actor: actor.name
    }));

    if (result.tell) {
        const effect = USABLE_KIND_EFFECTS[give.kind]?.[give.tier]
            ?? TIER_EFFECTS[give.category]?.[give.tier] ?? "";
        const label = USABLE_KINDS[give.kind]
            ? `${ITEM_CATEGORIES[give.category]?.label} - ${USABLE_KINDS[give.kind].label}`
            : ITEM_CATEGORIES[give.category]?.label ?? give.category;
        await whisperToOwner(actor, `
            <h3>${game.i18n.localize("DRPG.Items.received")}</h3>
            <p><strong>${esc(give.name)}</strong> - ${esc(label)
            }, ${game.i18n.format("DRPG.Items.tierN", { n: give.tier })}</p>
            ${give.description ? `<p>${esc(give.description)}</p>` : ""}
            ${effect ? `<p><em>${esc(effect)}</em></p>` : ""}`);
    }

    return true;
}

/* ==========================================================================
 * TRUTH BULLETS
 * --------------------------------------------------------------------------
 * A separate dialog rather than a branch of the one above. What a bullet needs
 * - what it really is, what the player is told it is, how visible the original
 * was - has no overlap with tier and carry limits, and the two forms would have
 * had to hide each other's fields.
 * ========================================================================== */

/** Options shared by both dialogs below. */
function typeOptions(selected = "neutral") {
    return Object.entries(TRUTH_BULLET_TYPES)
        .map(([key, t]) => `<option value="${key}"${key === selected ? " selected" : ""}>${
            foundry.utils.escapeHTML(t.label)
        }</option>`).join("");
}

function visibilityOptions(selected = "evident") {
    return REMNANT_VISIBILITY
        .map(key => `<option value="${key}"${key === selected ? " selected" : ""}>${
            foundry.utils.escapeHTML(REMNANT_VISIBILITY_LABELS[key] ?? key)
        }</option>`).join("");
}

/**
 * Hand one Truth Bullet over - copied from a trace, or written out by hand.
 *
 * TWO TABS, AND THE FIRST ONE IS THE HONEST ROUTE (Dawid, 31.08).
 *
 * Writing the bullet out was the only way through here, and it is the one way
 * that can disagree with the map: the GM retypes a name the Remnant already
 * has, picks a visibility it already carries, and the result comes out
 * unattached. No `remnantId` means the marker stays hidden from the person now
 * holding evidence of it, and nothing ever ties the bullet to the trace it
 * documents - not the Investigation dashboard, not the trial's evidence card.
 *
 * Observe has never done it that way: it reads the trace and hands over what
 * the trace says. So does this pane, with the same fields in the same order, so
 * a bullet given by hand and a bullet found by rolling are the same object.
 *
 * Writing one by hand stays, because a GM inventing evidence that is not on the
 * map yet is a real thing to want.
 */
async function giveTruthBulletDialog(actor) {

    const students = studentActors();
    const initial = actor ?? students[0] ?? null;
    if (!initial) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return false;
    }

    const recipients = students
        .map(a => `<option value="${a.id}"${a.id === initial.id ? " selected" : ""}>${
            esc(a.name)}</option>`).join("");

    const { remnantsOn, remnantData, traceContextLine, setRemnantPublicById,
        markRemnantEditedById } =
        await import("./remnants.mjs");

    // The scene the GM is looking at. `remnantData` is GM-side by construction -
    // a player's client holds these tokens but has never held what they mean -
    // and this whole window is GM-only, so there is nothing to gate here.
    const scene = workingScene();
    const traces = remnantsOn(scene)
        .map(token => ({ token, data: remnantData(token) }))
        .filter(entry => entry.data);

    const traceOptionsFor = who => {
        const copied = copiedRemnants(who);
        return traces.map(({ token, data }) => {
            const name = data.public?.name || game.i18n.localize("DRPG.Remnant.tokenName");
            const context = traceContextLine(data);
            // Said rather than hidden. A second copy is a legitimate thing to
            // hand out - two students may both have seen the same thing - so a
            // missing row would read as a missing trace.
            const held = copied.has(token.id)
                ? ` · ${game.i18n.localize("DRPG.TruthBullet.alreadyHeld")}` : "";
            return `<option value="${token.id}" data-name="${esc(name)}">${
                esc(name)}${context ? ` · ${esc(context)}` : ""}${esc(held)}</option>`;
        }).join("");
    };

    const shownSelect = name => `<select name="${name}">
                <option value="auto" selected>${game.i18n.localize("DRPG.TruthBullet.shownAuto")}</option>
                <option value="neutral">${game.i18n.localize("DRPG.TruthBullet.shownNeutral")}</option>
                <option value="real">${game.i18n.localize("DRPG.TruthBullet.shownReal")}</option>
            </select>`;

    const firstName = traces.length
        ? (traces[0].data.public?.name || game.i18n.localize("DRPG.Remnant.tokenName"))
        : "";

    const existingPane = traces.length
        ? `<label>${game.i18n.localize("DRPG.TruthBullet.pickRemnant")}
                <select name="remnant">${traceOptionsFor(initial)}</select></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.name")}
                <input type="text" name="exName" value="${esc(firstName)}" /></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.shown")}
                ${shownSelect("exShown")}</label>
            <p class="notes">${game.i18n.localize("DRPG.TruthBullet.remnantNote")}</p>`
        : `<p class="notes">${game.i18n.localize("DRPG.TruthBullet.remnantEmpty")}</p>`;

    const result = await DialogV2.wait({
        window: { title: actor
            ? game.i18n.format("DRPG.TruthBullet.giveTo", { actor: actor.name })
            : game.i18n.localize("DRPG.TruthBullet.give") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>${panelTabs([
            { key: "existing", label: game.i18n.localize("DRPG.TruthBullet.tabFromRemnant"),
              html: existingPane },
            { key: "create", label: game.i18n.localize("DRPG.TruthBullet.tabWriteNew"), html: `
            <label>${game.i18n.localize("DRPG.TruthBullet.name")}
                <input type="text" name="name"
                       placeholder="${game.i18n.localize("DRPG.TruthBullet.namePlaceholder")}" /></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.realType")}
                <select name="realType">${typeOptions("neutral")}</select></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.shown")}
                ${shownSelect("shown")}</label>
            <label>${game.i18n.localize("DRPG.TruthBullet.visibility")}
                <select name="visibility">${visibilityOptions("evident")}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="faint" />
                ${game.i18n.localize("DRPG.TruthBullet.faintField")}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="tied" />
                ${game.i18n.localize("DRPG.TruthBullet.tiedField")}</label>
            <label>${game.i18n.localize("DRPG.TruthBullet.playerText")}
                <textarea name="playerText" rows="2"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.playerTextPlaceholder")}"></textarea></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.gmNote")}
                <textarea name="gmNote" rows="2"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.gmNotePlaceholder")}"></textarea></label>` }
        ])}
            <label>${game.i18n.localize("DRPG.Items.recipient")}
                <select name="recipient">${recipients}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>
            <p class="notes">${game.i18n.localize("DRPG.TruthBullet.secretNote")}</p>
        </form>`),
        render: (event, dialog) => {
            wirePanelTabs(dialog.element);
            const form = dialog.element.querySelector("form");
            if (!form) return;

            // The name field follows the picked trace, because the GM is
            // renaming a thing rather than naming one: what is already on the
            // trace is the answer until they say otherwise.
            const picker = form.elements.remnant;
            picker?.addEventListener("change", () => {
                const opt = picker.selectedOptions?.[0];
                if (opt && form.elements.exName) form.elements.exName.value = opt.dataset.name ?? "";
            });

            // Whether a trace is already copied is a fact about the recipient,
            // so the list is rebuilt when the recipient changes - and the
            // selection is kept across the swap.
            form.elements.recipient?.addEventListener("change", () => {
                if (!picker) return;
                const who = game.actors.get(form.elements.recipient.value);
                if (!who) return;
                const keep = picker.value;
                picker.innerHTML = traceOptionsFor(who);
                if ([...picker.options].some(o => o.value === keep)) picker.value = keep;
            });
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.TruthBullet.give"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    const active = d.element.querySelector(".drpg-gmt-section.active")
                        ?.dataset.drpgGmtSection ?? "create";
                    const common = {
                        recipient: f.elements.recipient?.value ?? null,
                        tell: f.elements.tell.checked
                    };

                    if (active === "existing" && f.elements.remnant) {
                        return { ...common, mode: "existing",
                                 remnantId: f.elements.remnant.value,
                                 name: f.elements.exName.value.trim(),
                                 shown: f.elements.exShown.value };
                    }

                    return {
                        ...common,
                        mode: "create",
                        // `f.name` reads this same field - HTMLFormElement
                        // carries [LegacyOverrideBuiltIns], so its named getter
                        // beats the built-in `name`. `f.elements` does not have
                        // that clause, which is the trap two functions down.
                        // Neither collides here; both forms are spelled the
                        // same way for the sake of reading them together.
                        name: f.elements.name.value.trim(),
                        realType: f.elements.realType.value,
                        shown: f.elements.shown.value,
                        visibility: f.elements.visibility.value,
                        faint: f.elements.faint.checked,
                        tied: f.elements.tied.checked,
                        playerText: f.elements.playerText.value.trim(),
                        gmNote: f.elements.gmNote.value.trim()
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const who = game.actors.get(result.recipient) ?? initial;
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.TruthBullet.needsName"));
        return false;
    }

    let payload = null;

    if (result.mode === "existing") {
        const entry = traces.find(t => t.token.id === result.remnantId);
        if (!entry) {
            ui.notifications.warn(game.i18n.localize("DRPG.TruthBullet.remnantGone"));
            return false;
        }
        const { token, data } = entry;
        const pub = data.public ?? null;

        // A rename is written back to the trace, the way Observe writes back the
        // sentence the GM types. Otherwise the second student to be handed this
        // same trace would get the old name, and the two copies of one object
        // would disagree in the pack that is meant to prove things.
        if (result.name !== pub?.name) {
            try {
                await setRemnantPublicById(scene?.id, token.id, { name: result.name });
                // Named by a GM, so it is decided (E7).
                await markRemnantEditedById(scene?.id, token.id);
            } catch (err) {
                error("Could not record the new name on the Remnant", err);
            }
        }

        payload = {
            name: result.name,
            realType: data.type,
            shownType: result.shown === "auto" ? null
                : (result.shown === "real" ? data.type : "neutral"),
            visibility: data.visibility,
            faint: Boolean(data.faint),
            playerText: pub?.playerText ?? "",
            img: pub?.img ?? null,
            tags: pub?.tags ?? [],
            gmNote: data.note ?? "",
            remnantId: token.id,
            sceneId: scene?.id ?? null,
            // Passed explicitly for the reason Observe passes it: the room
            // lookup is canvas-bound, and this may not be the scene on screen.
            room: data.room ?? null,
            // Both into the bullet's secret; public on the item only once it is
            // identified, like every other tie.
            sourceAction: data.action ?? null,
            tiedToCrime: Boolean(data.tiedToCrime)
        };
    } else {
        payload = {
            name: result.name,
            realType: result.realType,
            // "auto" means "let the rules decide" - Key, Autopsy and Final
            // bullets arrive identified, everything else starts Neutral. See
            // createTruthBullet.
            shownType: result.shown === "auto" ? null
                : (result.shown === "real" ? result.realType : "neutral"),
            visibility: result.visibility,
            faint: result.faint,
            // The GM's manual verdict (Dawid, 26.08). Into the bullet's secret
            // at creation; public on the item only once identified.
            tiedToCrime: result.tied,
            playerText: result.playerText,
            gmNote: result.gmNote
        };
    }

    const item = await createTruthBullet(who, payload);

    if (!item) {
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    ui.notifications.info(game.i18n.format("DRPG.TruthBullet.gave", {
        item: payload.name, actor: who.name
    }));

    if (result.tell) {
        await whisperToOwner(who, `
            <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
            <p><strong>${esc(payload.name)}</strong></p>
            ${payload.playerText ? `<p>${esc(payload.playerText)}</p>` : ""}
            <p><small>${game.i18n.localize("DRPG.TruthBullet.whereToFind")}</small></p>`);
    }

    return true;
}

/**
 * The Autopsy bullet, handed to everyone at once.
 *
 * Decision D2: issued by hand, never rolled for - which is why the `autopsy`
 * column is absent from both OBSERVE_DC and ANALYZE_DC.
 *
 * Everyone still alive gets one. The dead are listed but start unticked rather
 * than hidden: a GM correcting a mis-marked death should not have to go and
 * find a different screen to do it from.
 */
export async function issueAutopsyDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return false;
    }

    const actors = studentActors();
    if (!actors.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return false;
    }

    const { isDeceased } = await import("./chapter.mjs");
    const rows = actors.map(a => {
        const dead = isDeceased(a);
        return `<label class="drpg-checkbox">
            <input type="checkbox" name="target" value="${a.id}"${dead ? "" : " checked"} />
            ${foundry.utils.escapeHTML(a.name)}${
                dead ? ` - <em>${game.i18n.localize("DRPG.Chapter.deadShort")}</em>` : ""
            }</label>`;
    }).join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.TruthBullet.autopsyTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="notes">${game.i18n.localize("DRPG.TruthBullet.autopsyHint")}</p>
            <label>${game.i18n.localize("DRPG.TruthBullet.name")}
                <input type="text" name="name" autofocus
                       placeholder="${game.i18n.localize("DRPG.TruthBullet.autopsyNamePlaceholder")}" /></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.playerText")}
                <textarea name="playerText" rows="3"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.autopsyTextPlaceholder")}"></textarea></label>
            <label>${game.i18n.localize("DRPG.TruthBullet.gmNote")}
                <textarea name="gmNote" rows="2"
                    placeholder="${game.i18n.localize("DRPG.TruthBullet.gmNotePlaceholder")}"></textarea></label>
            <fieldset><legend>${game.i18n.localize("DRPG.TruthBullet.autopsyWho")}</legend>${rows}</fieldset>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.TruthBullet.autopsyIssue"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        playerText: f.playerText.value.trim(),
                        gmNote: f.gmNote.value.trim(),
                        targets: Array.from(f.querySelectorAll("[name=target]:checked")).map(i => i.value)
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;
    if (!result.targets.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.TruthBullet.autopsyNobody"));
        return false;
    }

    const name = result.name || TRUTH_BULLET_TYPES.autopsy.label;
    const issued = await issueAutopsy(
        result.targets.map(id => game.actors.get(id)).filter(Boolean),
        { name, playerText: result.playerText, gmNote: result.gmNote }
    );

    ui.notifications.info(plural("DRPG.TruthBullet.autopsyIssued", { n: issued }));
    return issued > 0;
}

/* ==========================================================================
 * TAKING AWAY
 * ========================================================================== */

/** Remove one item the module knows about. */
/**
 * @param {Actor} [actor]        Whose pockets, as a default the window can change.
 * @param {object} [options]
 * @param {?string} [options.only]  One category key, or null for everything.
 *   `"truthBullet"` is what the hub's second Take button passes: the same
 *   window with everything else hidden, because removing a bullet means
 *   finding one of three among fifteen things (Dawid, 03.09).
 */
async function takeItemDialog(actor, { only = null } = {}) {
    // A key is a room fact, and the room's owner is asked below.
    const { keyRoomOf, vaultOwnerOf } = await import("./vault.mjs");

    /*
     * A FILTERED WINDOW SAYS WHAT IT IS FILTERED TO. The title and the
     * "nothing here" line both name the thing, or a GM who pressed "Take a
     * Truth Bullet away" reads a window called "Take an item away", finds it
     * empty and wonders where the rest of the pockets went.
     */
    const FILTERED = {
        truthBullet: { title: "DRPG.TruthBullet.takeAway", empty: "DRPG.TruthBullet.noneToTake" },
        bedroomKey: { title: "DRPG.Vault.takeKey", empty: "DRPG.Vault.noKeysToTake" }
    };
    const filtered = FILTERED[only] ?? null;

    const students = studentActors();
    const initial = actor ?? students[0] ?? null;
    if (!initial) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return false;
    }

    /*
     * WHOSE POCKETS, ASKED IN THE WINDOW (Dawid, 31.08).
     *
     * The list is everything one person is carrying, so it is built for one and
     * rebuilt when the GM changes their mind. A picker still showing somebody
     * else's belongings under a new name would delete the wrong item without
     * ever looking wrong, which is the one failure worth writing code against.
     */
    const ownedFor = who => Object.keys(ITEM_CATEGORIES)
        .filter(key => !only || key === only)
        .flatMap(key => itemsInCategory(who, key).map(item => ({ item, category: key })))
        // Their own bedroom's key is not theirs to lose: the owner never needs
        // it (`mayEnterBedroom`), and `reconcileBedroomKeys` hands it back at
        // the next load. Offering it here would be a removal that quietly
        // undoes itself.
        .filter(({ item, category }) =>
            category !== "bedroomKey" || vaultOwnerOf(keyRoomOf(item)) !== who.id);

    const optionsFor = who => {
        const owned = ownedFor(who);
        if (!owned.length) {
            return `<option value="">${foundry.utils.escapeHTML(game.i18n.format(
                filtered?.empty ?? "DRPG.Items.nothingToTake",
                { actor: who.name }))}</option>`;
        }
        return owned.map(({ item, category }) => {
            // A Truth Bullet carries `tier: null` on purpose, and `!== undefined`
            // let that through - every bullet in this picker read "(Tnull)".
            const tier = item.getFlag(MODULE_ID, "tier");
            const label = `${ITEM_CATEGORIES[category]?.label ?? category} · ${item.name}${
                tier !== undefined && tier !== null ? ` (T${tier})` : ""
            }`;
            return `<option value="${item.id}">${foundry.utils.escapeHTML(label)}</option>`;
        }).join("");
    };

    const recipients = students
        .map(a => `<option value="${a.id}"${a.id === initial.id ? " selected" : ""}>${
            foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        // The title says which of the three buttons opened this - see
        // `FILTERED` above.
        window: { title: filtered
            ? game.i18n.localize(filtered.title)
            : actor
                ? game.i18n.format("DRPG.Items.takeFrom", { actor: actor.name })
                : game.i18n.localize("DRPG.Items.take") },
        classes: ["drpg-panel"],
        content: `<form>
            <label>${game.i18n.localize("DRPG.Items.takeFromWhom")}
                <select name="recipient">${recipients}</select></label>
            <label>${game.i18n.localize("DRPG.Items.whichItem")}
                <select name="item">${optionsFor(initial)}</select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>
        </form>`,
        render: (event, dialog) => {
            const form = dialog.element.querySelector("form");
            form?.elements?.recipient?.addEventListener("change", () => {
                const who = game.actors.get(form.elements.recipient.value);
                // `namedItem`, not `form.elements.item` - see the note on the
                // callback below.
                if (who) form.elements.namedItem("item").innerHTML = optionsFor(who);
            });
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Items.take"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    /*
                     * `namedItem("item")`, BECAUSE THE FIELD IS CALLED "item".
                     *
                     * Measured on 14.365: `form.elements` is an
                     * HTMLFormControlsCollection, which carries its own
                     * `item()`, `namedItem()` and `length` - and access by name
                     * does NOT override them. So `f.elements.item` hands back
                     * the collection's method and the select is unreachable
                     * through it. The form itself behaves the other way round
                     * (`[LegacyOverrideBuiltIns]`), which is why `f.item` used
                     * to work here and why the difference is worth a note
                     * rather than a rename.
                     */
                    return {
                        id: f.elements.namedItem("item").value,
                        recipient: f.elements.recipient.value,
                        tell: f.elements.tell.checked
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const who = game.actors.get(result.recipient) ?? initial;
    const item = who.items.get(result.id);
    if (!item) {
        ui.notifications.warn(game.i18n.format("DRPG.Items.nothingToTake", { actor: who.name }));
        return false;
    }

    const name = item.name;
    // The answer key is keyed by item uuid, so deleting the item without this
    // would leave an entry nothing can ever reach or clear again.
    const uuid = item.uuid;
    try {
        await item.delete();
        const { dropSecret } = await import("./truth-bullets.mjs");
        await dropSecret(uuid);
    } catch (err) {
        error("Could not remove the item", err);
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    log(`GM took "${name}" from ${who.name}.`);
    ui.notifications.info(game.i18n.format("DRPG.Items.took", { item: name, actor: who.name }));

    if (result.tell) {
        await whisperToOwner(who, `${cardHead({
            action: game.i18n.localize("DRPG.Items.lostTitle")
        })}<p>${
            game.i18n.format("DRPG.Items.lost", { item: foundry.utils.escapeHTML(name) })
        }</p>`);
    }

    return true;
}
