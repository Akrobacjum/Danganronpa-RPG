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
    USABLE_KIND_EFFECTS, EQUIPPABLE, itemIcon,
    TRUTH_BULLET_TYPES, REMNANT_VISIBILITY, REMNANT_VISIBILITY_LABELS
} from "./config.mjs";
import { grantItem, itemsInCategory, countInCategory, countInGroup, inventorySummary,
    pickableCategories, isStashed, isBroken, ITEM_FLAGS }
    from "./inventory.mjs";
// `BULLET_CATEGORY` went with the hand-rolled category list: excluding Truth
// Bullets is `pickableCategories`'s job now, not this file's.
import { createTruthBullet, issueAutopsy, copiedRemnants }
    from "./truth-bullets.mjs";
import { ITEM_POOLS, USABLE_GOALS, moduleTables, rolesOfResult, MULTI_ROLE_TIER, usableKindFor, entryAs }
    from "./tables.mjs";
import { studentActors } from "./monokuma.mjs";

/** The student <option> list every give/take window opens with (ITEM-18). */
function recipientOptions(students, selectedId) {
    /* The actor a window was opened for is in its list even when it is no student (E47-KFb; E47-C8's Open 3): the
       Students window's Items on a Monokuma's or an NPC's row opened the hub with its select on the first student,
       which the hub's doors then read as the one it is about. That actor first, then the students as before. */
    const own = selectedId && !students.some(a => a.id === selectedId) ? game.actors.get(selectedId) : null;
    return [...(own ? [own] : []), ...students]
        .map(a => `<option value="${a.id}"${a.id === selectedId ? " selected" : ""}>${esc(a.name)}</option>`)
        .join("");
}
import { whisperToOwner, log, error, plural, cardHead, esc, serialWrite } from "./utils.mjs";
import { kitTabs, wireKitTabs, shownTab, drpgWindow, box, emptyOption, formGrid } from "./ui-kit.mjs";
import { alreadyOpen, keepLive, RAISED } from "./live.mjs";
import { homeScene } from "./rooms.mjs";


/* ==========================================================================
 * ENTRY POINT
 * ========================================================================== */

/**
 * Open the item manager. GM only.
 *
 * @param {Actor} [actor]  Skip the character picker when the caller knows who.
 */
/*
 * ONE WINDOW: WHO, WHAT THEY HAVE, GIVE OR TAKE (Dawid, 03.09).
 *
 * This was a menu of five buttons that each opened somewhere else, and the
 * one thing a GM wants to see before pressing any of them - what the
 * student is actually holding, and what is in their stash - was behind a
 * sixth ("Look inside the stashes"). The holdings are on the window now,
 * and the only choice left at this level is the verb.
 *
 * TWO TABS AND A FOOTER THAT FOLLOWS THEM, which is what the kit's
 * `wireKitTabs` is for and what Item Tables and Sound already do. Nothing underneath
 * changed: `gmGiveItemDialog`, `giveTruthBulletDialog`, `giveKeyDialog` and
 * `takeItemDialog` are the same windows, reached from the tab that matches
 * what they do.
 *
 * A stashed item is an ordinary item on its owner's sheet, so the stash
 * needs no separate reader - it is a flag on a row this list already walks.
 * `openVaultInspector` stays on the console for a GM who wants every
 * stash at once rather than one student's.
 */
/* Exported for R2025 (E46-C3): the summary in the body's ink, the headings plural. */
export function holdingsHtml(who) {
        const groups = [];
        for (const [key, cat] of Object.entries(ITEM_CATEGORIES)) {
            const all = itemsInCategory(who, key);
            if (!all.length) continue;
            const rows = all.map(item => {
                const tier = item.getFlag(MODULE_ID, "tier");
                return `<li>${esc(item.name)}${
                    tier !== undefined && tier !== null
                        ? ` <span class="notes">T${esc(String(tier))}</span>` : ""
                }${isStashed(item)
                    ? ` <span class="notes">${esc(game.i18n.localize("DRPG.Items.inStash"))}</span>`
                    : ""}</li>`;
            }).join("");
            // A group of what they hold, named in the plural (E46-C3, S13-36 (5)): "Tool" over three tools read as one.
            groups.push(`<div class="drpg-holdings-group"><h4>${esc(cat.plural ?? cat.label)}</h4>`
                + `<ul>${rows}</ul></div>`);
        }
        // The summary is what the window is for, not fine print (E46-C3, S13-36 (5)): in the body's ink.
        return `<p class="drpg-holdings-summary">${esc(inventorySummary(who))}</p>`
            + (groups.length
                ? `<div class="drpg-holdings">${groups.join("")}</div>`
                : `<p class="notes">${esc(game.i18n.format("DRPG.Items.carriesNothing",
                    { actor: who.name }))}</p>`);
}

/** The tabs' buttons, the select that changes whose pockets are shown, and the live read-out. */
function wireItemManager(dialog, target) {
    // `win` and `app` (E21 C2b): the bar may widen the window, and a press puts it back on the screen (C1b).
    wireKitTabs(dialog.element, {
        win: dialog.element,
        app: dialog,
        buttons: {
            give: ["give", "bullet", "key"],
            take: ["take", "takeBullet", "takeKey"]
        },
        always: ["cancel"]
    });

    /* WHOSE POCKETS, AND WHAT IS IN THEM - two questions, and only the first
       of them was ever answered twice.

       The read-out follows the person, or a GM who changes their mind reads the
       last student's pockets under a new name. It did not follow the POCKETS:
       giving somebody a thing, taking one away, or a player picking something up
       mid-Daily-Life all left this line saying what they used to be carrying.
       Measured on 11.09 - "Usables: 1/3" with two of them in the actor.

       That matters here more than on most windows, because the buttons under it
       are what CHANGES the holdings: the hub gives an item and comes straight
       back to itself, so the number it shows is the one the GM is about to act
       on again.

       `chosen` is looked up fresh each time rather than closed over: the select
       is the answer now (see the buttons below), and the element itself is
       re-queried because `keepLive` REPLACES the region and a reference captured
       at render time would be pointing at a detached node by the second refresh. */
    const form = dialog.element.querySelector("form");
    const chosen = () => game.actors.get(form?.elements?.who?.value) ?? target;
    const holdings = () =>
        `<div class="drpg-holdings-live">${holdingsHtml(chosen())}</div>`;

    form?.elements?.who?.addEventListener("change", () => {
        const live = dialog.element.querySelector(".drpg-holdings-live");
        if (live) live.outerHTML = holdings();
    });

    keepLive(dialog, {
        region: ".drpg-holdings-live",
        build: holdings,
        // Items for what they are carrying, actors because a stash lives on the
        // sheet and the summary counts it.
        watch: { items: true, actors: true }
    });
}

/** Six doors and a Close: each answers with what to do and to whom. */
/*
 * THE HUB'S FOOTER BY ROLE (E21 C2b): six doors, each opening its own window - secondary, none of them the answer;
 * Close, since the hub answers nothing (E21 rule 3), the answer "cancel" as before, and the default.
 */
function itemManagerButtons(target) {
    const doors = [
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
        }))
    ];
    return { secondary: doors, close: { role: "close", action: "cancel" } };
}

export async function openItemManager(actor = null) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-items")) return RAISED;

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


    const whoOptions = recipientOptions(students, target.id);

    const choice = await drpgWindow({
        title: game.i18n.localize("DRPG.Items.manage"),
        classes: ["drpg-panel", "drpg-window-items"],
        body: `<form>
            <label>${game.i18n.localize("DRPG.Items.whichCharacterHub")}
                <select name="who">${whoOptions}</select></label>
            <div class="drpg-holdings-live">${holdingsHtml(target)}</div>
            ${kitTabs([
                { key: "give", label: game.i18n.localize("DRPG.Items.tabGive"),
                  html: `<p class="notes">${game.i18n.localize("DRPG.Items.giveNote")}</p>` },
                { key: "take", label: game.i18n.localize("DRPG.Items.tabTake"),
                  html: `<p class="notes">${game.i18n.localize("DRPG.Items.takeNote")}</p>` }
            ])}
        </form>`,
        render: (event, dialog) => wireItemManager(dialog, target),
        footer: itemManagerButtons(target),
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
export async function giveKeyDialog(actor, { bedrooms = null } = {}) {
    // Bedrooms, not stashes - a stash in somebody else's room must never
    // produce a key to it. See `allBedrooms` and trap 79.
    // Across every scene (ITEM-16): the dorms are usually not the scene the GM is looking at.
    // `bedrooms`, the list read in their place, is the suite's (E14 fix e1-G7: a world of one bedroom, the student's own,
    // which no test could make of a live world - the review's E14p2-END-08, R6).
    const { allBedroomsAnywhere, grantBedroomKey, keysHeldBy } = await import("./vault.mjs");
    const allBedrooms = typeof bedrooms === "function" ? bedrooms : allBedroomsAnywhere;

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
    /*
     * NO KEY LEFT IS A LINE UNDER THE FIELD, AND THE BUTTON OFF (E14 part 2 C6, 24.10.2026; audit S08-22). It was the
     * select's one option, cut off at the select's width, with the button live and a toast for pressing it; and it said
     * "already holds one for every bedroom" to a student whose only bedroom with an owner is their own. Two sentences
     * now, each true of the person picked, and the button follows the person.
     */
    const choicesFor = who => {
        // A key in their stash too (E14 part 1 C2): it is theirs to take out, and `grantBedroomKey` makes no second one.
        const held = keysHeldBy(who, { stashed: true });
        const others = allBedrooms().filter(v => v.owner && v.owner.id !== who.id);
        const rooms = others.filter(v => !held.has(v.room));
        return {
            options: rooms.map(v =>
                `<option value="${foundry.utils.escapeHTML(v.room)}">${
                    foundry.utils.escapeHTML(v.room)} - ${
                    foundry.utils.escapeHTML(v.owner.name)}</option>`).join(""),
            empty: rooms.length ? null : game.i18n.format(others.length ? "DRPG.Vault.hasEveryKey" : "DRPG.Vault.onlyOwnBedroom",
                { name: who.name })
        };
    };
    const shown = choicesFor(initial);
    const showChoices = (form, ok, who) => {
        const { options, empty } = choicesFor(who);
        form.elements.room.innerHTML = options;
        form.elements.room.disabled = Boolean(empty);
        const line = form.querySelector("[data-drpg-key-empty]");
        line.textContent = empty ?? "";
        line.hidden = !empty;
        if (ok) ok.disabled = Boolean(empty);
    };

    const recipients = recipientOptions(students, initial.id);

    const result = await drpgWindow({
        // Generic on purpose (ITEM-13): the form carries its own recipient
        // select, and a title naming the argument lied as soon as it changed.
        title: game.i18n.localize("DRPG.Vault.giveKey"),
        classes: ["drpg-panel", "drpg-give-key"],
        body: `<form>
            <label>${game.i18n.localize("DRPG.Items.recipient")}
                <select name="recipient">${recipients}</select></label>
            <label>${game.i18n.localize("DRPG.Vault.whichKey")}
                <select name="room"${shown.empty ? " disabled" : ""}>${shown.options}</select></label>
            <p class="notes" data-drpg-key-empty${shown.empty ? "" : " hidden"}>${
                foundry.utils.escapeHTML(shown.empty ?? "")}</p>
            <p class="notes">${game.i18n.localize("DRPG.Vault.giveKeyNote")}</p>
        </form>`,
        render: (event, dialog) => {
            const form = dialog.element.querySelector("form");
            const ok = dialog.element.querySelector('footer button[data-action="ok"]');
            if (form) showChoices(form, ok, initial);
            form?.elements?.recipient?.addEventListener("change", () => {
                const who = game.actors.get(form.elements.recipient.value);
                if (who) showChoices(form, ok, who);
            });
        },
        footer: {
            primary: {
                // The window's own words (S08-22): it read "Give an item" on a window that gives a key.
                action: "ok", label: game.i18n.localize("DRPG.Vault.giveKey"),
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        room: f.elements.room.value,
                        recipient: f.elements.recipient.value
                    };
                }
            },
            close: { role: "cancel", action: "cancel" }
        },
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
 * `foundry.utils.escapeHTML` is the same escape `esc` wraps; this was a closure
 * inside the dialog once, written before `esc` reached it, and the spelling stayed.
 */
function giveCategoryOptions(who) {
    return pickableCategories().map(choice => {
        const cat = ITEM_CATEGORIES[choice.key];
        // The shared budget, where there is one: rows drawing on the same
        // slots have to show the same number, or the GM reads "1/1" beside a
        // free slot and believes it. See `capacityLabel`.
        const group = cat?.limitGroup ?? null;
        const held = who
            ? (group ? countInGroup(who, group) : countInCategory(who, choice.key))
            : null;
        const limit = group ? LIMIT_GROUPS[group]?.limit : cat?.limit;
        // The group named with its count (E14 part 2 C8; audit S13-21): "Cleaning Tool - 0/2" read as two slots of the
        // Cleaning Tool's own, where the summary above says "Gear: 0/2" of the same two.
        const count = limit ? `${held}/${limit}` : `${held}`;
        const cap = held === null ? "" : group ? ` (${LIMIT_GROUPS[group]?.label ?? group} ${count})` : ` - ${count}`;
        return `<option value="${choice.value}">${
            foundry.utils.escapeHTML(choice.label)}${cap}</option>`;
    }).join("");
}

/** The entries of one table, as options for the item select. */
function giveItemOptionsFor(table) {
    return Array.from(table?.results ?? [])
        .map(r => `<option value="${r.id}">${esc(r.name ?? r.text ?? "")}</option>`).join("");
}

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
function giveExistingPane(catalogue, categories, tiers) {
    const EX_UNSET = emptyOption("DRPG.Items.chooseOne");
    const tableOptions = catalogue.map(table => {
        const cat = table.getFlag(MODULE_ID, "category") ?? "";
        const tier = table.getFlag(MODULE_ID, "tier");
        const goal = table.getFlag(MODULE_ID, "goal") ?? "";
        return `<option value="${table.id}" data-category="${esc(cat)}" data-tier="${
            tier ?? ""}" data-goal="${esc(goal)}">${esc(table.name)} (${table.results.size})</option>`;
    }).join("");

    // On the kit's `formGrid` (E46-C3b, 09.11.2026): the same fields in the same order, a label column beside them.
    return catalogue.length
        ? formGrid([
            { label: game.i18n.localize("DRPG.Items.pickTable"), id: "drpg-give-ex-table",
              field: `<select name="exTable" id="drpg-give-ex-table">${tableOptions}</select>` },
            { label: game.i18n.localize("DRPG.Items.pickExisting"), id: "drpg-give-ex-item",
              field: `<select name="exItem" id="drpg-give-ex-item">${giveItemOptionsFor(catalogue[0])}</select>` },
            { label: game.i18n.localize("DRPG.Items.category"), id: "drpg-give-ex-category",
              field: `<select name="exCategory" id="drpg-give-ex-category" aria-describedby="drpg-give-to-set">${EX_UNSET}${categories}</select>` },
            { full: kindNote("exCategory") },
            { label: game.i18n.localize("DRPG.Items.tier"), id: "drpg-give-ex-tier",
              field: `<select name="exTier" id="drpg-give-ex-tier" aria-describedby="drpg-give-to-set">${EX_UNSET}${tiers}</select>` },
            { full: `<div id="drpg-give-to-set" data-drpg-to-set hidden>${box("warning", esc(game.i18n.localize("DRPG.Items.setCategoryTier")))}</div>` },
            { full: `<p class="notes">${game.i18n.localize("DRPG.Items.existingNote")}</p>` }])
        : `<p class="notes">${game.i18n.localize("DRPG.Items.existingEmpty")}</p>`;
}

/*
 * THE ICON BEFORE THE PRESS (E47-FC, 09.11.2026; the owner on comparison 2, question q-create-icon: Change). The item
 * Create new hands over takes its category's drawing (`grantItem` writes `itemIcon(category)`, one drawing per
 * category; E47-T7 holds it), and the window showed none before Give. The picture stands beside the category select,
 * drawn with the first category's and repainted on every change (`wireGiveForm`); `alt=""`, as the select beside it
 * already names the category. It is the select's sibling in the field cell, and components.css stands it at the free
 * end of the label column, left of the select: beside it in the field it took 40 px from the select, and Legacy's
 * "Usable - Healing - 0/3" broke over two lines (1366x768, measured on the first draw).
 */
const giveIconOf = value => itemIcon(String(value ?? "").split(":")[0]);

/** The "create new" tab: category, tier, a name with every built-in as autocomplete, description, roles. */
function giveCreatePane({ categories, tiers, suggestions }) {
    const first = pickableCategories()[0]?.value ?? "";
    return formGrid([
        { label: game.i18n.localize("DRPG.Items.category"), id: "drpg-give-category",
          field: `<select name="category" id="drpg-give-category">${categories}</select><img
                class="drpg-give-icon" data-drpg-give-icon src="${esc(giveIconOf(first))}" alt="" width="32" height="32" />` },
        { full: kindNote("category") },
        { label: game.i18n.localize("DRPG.Items.tier"), id: "drpg-give-tier", field: `<select name="tier" id="drpg-give-tier">${tiers}</select>` },
        { label: game.i18n.localize("DRPG.Items.name"), id: "drpg-give-name",
          field: `<input type="text" name="name" id="drpg-give-name" list="drpg-item-names"
                       placeholder="${game.i18n.localize("DRPG.Items.namePlaceholder")}" /><datalist id="drpg-item-names">${
                suggestions.map(n => `<option value="${esc(n)}"></option>`).join("")}</datalist>` },
        { label: game.i18n.localize("DRPG.Items.description"), id: "drpg-give-description",
          field: `<textarea name="description" id="drpg-give-description" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Items.descriptionPlaceholder")}"></textarea>` },
        { full: `<span class="drpg-role-picker" data-drpg-roles>
                <span class="drpg-role-label">${game.i18n.localize("DRPG.Items.alsoServesAs")}</span>
                ${EQUIPPABLE.map(key => `<label class="drpg-check"><input type="checkbox"
                    data-drpg-role="${key}" />${esc(ITEM_CATEGORIES[key]?.label ?? key)}</label>`).join("")}
            </span>` },
        { full: `<p class="notes" data-drpg-roles-note></p>` }]);
}

/* A category's kind note (E14 part 1 C5; on the kit's warning box since E46-C3b): `wireKindNotes` shows it and writes
   its words into the box. */
function kindNote(field) {
    return `<div data-drpg-kind-note="${field}" hidden>${box("warning", "")}</div>`;
}

/* The rows under a window's tabs, true of both (the recipient, the tell switch, the note), on the kit's formGrid. */
function recipientRows(recipients, noteKey, prefix) {
    return formGrid([
        { label: game.i18n.localize("DRPG.Items.recipient"), id: `${prefix}-recipient`,
          field: `<select name="recipient" id="${prefix}-recipient">${recipients}</select>` },
        { full: `<label class="drpg-checkbox">
                <input type="checkbox" name="tell" checked />
                ${game.i18n.localize("DRPG.Items.tellPlayer")}</label>` },
        { full: `<p class="notes">${game.i18n.localize(noteKey)}</p>` }]);
}

/** The give form's own rules: the table drives the item list, category and tier; the recipient rebuilds the counts; the roles follow tier and home. */
function wireGiveForm(dialog, tables = game.tables) {
    const form = dialog.element.querySelector("form");
    const paintGate = () => gateGive(dialog, form);
    wireKitTabs(dialog.element, { win: dialog.element, app: dialog, onSwitch: paintGate });
    if (!form) return;

    /*
     * THE ENTRY DRIVES THE CATEGORY AND THE TIER (E46-C3, 09.11.2026; audit S08-42).
     *
     * Picking a table refills the item list; picking a table or an item moves the category and the tier to what the
     * picked entry is - `entryAs`, the draw's own answer (tables-pools.mjs `resultFrom`), so the hammer given by hand
     * and the one a Search finds are one item: a tier pool's flags, a room pool's entry as the tier pools file its name
     * or as the table's name says. Until E46-C3 only a table's flags moved them, so a room pool's entry kept the last
     * table's category and tier. Where nothing says, both read "- choose -" with the line under them, and Give waits
     * for the GM's answer (`gateGive`). Both stay editable.
     */
    const tableSelect = form.elements.exTable;
    if (tableSelect) {
        const syncFromEntry = ({ refillItems = true } = {}) => {
            const table = tables?.get?.(tableSelect.value) ?? null;
            if (refillItems) form.elements.exItem.innerHTML = giveItemOptionsFor(table);
            const entry = table?.results?.get?.(form.elements.exItem.value) ?? null;
            const as = entryAs(table, entry);
            let value = as.category;
            // A usable pool with no goal: the kind the tables give the name (`usableKindFor`, as `grantItem` reads it).
            if (value === "usable") {
                const goal = as.goal ?? usableKindFor(entry?.name ?? entry?.text ?? "");
                value = goal ? `usable:${goal}` : null;
            }
            const offered = v => v && form.elements.exCategory.querySelector(`option[value="${CSS.escape(v)}"]`);
            form.elements.exCategory.value = offered(value) ? value : "";
            form.elements.exTier.value = as.tier === null ? "" : String(as.tier);
            for (const select of [form.elements.exCategory, form.elements.exTier]) select.dispatchEvent(new Event("change"));
        };
        tableSelect.addEventListener("change", () => syncFromEntry());
        form.elements.exItem.addEventListener("change", () => syncFromEntry({ refillItems: false }));
        for (const name of ["exCategory", "exTier"]) form.elements[name].addEventListener("change", paintGate);
        // On open the item list is already right, so only the two read-along selects need moving.
        syncFromEntry({ refillItems: false });
    }
    paintGate();

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
            select.innerHTML = (name === "exCategory" ? emptyOption("DRPG.Items.chooseOne") : "") + giveCategoryOptions(who);
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

    // The icon the new item will get, at once (E47-FC; `giveIconOf` above). `input` too: a keyboard moving through the
    // select's options fires it before `change` in some browsers.
    const icon = form.querySelector("[data-drpg-give-icon]");
    const paintIcon = () => { if (icon && form.elements.category) icon.src = giveIconOf(form.elements.category.value); };
    for (const type of ["change", "input"]) form.elements.category?.addEventListener(type, paintIcon);
    // The recipient's change rebuilds the select's options (above) and may leave it on another category.
    form.elements.recipient?.addEventListener("change", paintIcon);
    paintIcon();
}

/*
 * GIVE WAITS FOR A CATEGORY AND A TIER (E46-C3, S08-42): on Give existing, while either select reads "- choose -",
 * each is marked (`aria-invalid`), the line under them shows, and Give is disabled with that line as its title; on
 * Create new, Give is as it was. `giveFromResult` refuses the same answer, should one arrive.
 */
function gateGive(dialog, form) {
    const selects = [form?.elements?.exCategory, form?.elements?.exTier].filter(Boolean);
    const existing = (shownTab(dialog.element) ?? "existing") === "existing" && selects.length > 0;
    const missing = existing && selects.some(s => !s.value);
    for (const select of selects) {
        if (existing && !select.value) select.setAttribute("aria-invalid", "true");
        else select.removeAttribute("aria-invalid");
    }
    const line = form?.querySelector("[data-drpg-to-set]");
    if (line) line.hidden = !missing;
    const ok = dialog.element.querySelector('footer button[data-action="ok"]');
    if (ok) {
        ok.disabled = missing;
        if (missing) ok.title = game.i18n.localize("DRPG.Items.setCategoryTier");
        else ok.removeAttribute("title");
    }
    return !missing;
}

/** The give form's warnings of a usable's kind (`paintKinds`), wired whether or not the world has tables to give from. */
function wireKindNotes(dialog) {
    const form = dialog.element.querySelector("form");
    if (!form) return;
    /*
     * THE TABLES' KIND UNDER THE PICK (E14 part 1 C5, 24.10.2026; audit S08-14). A usable's kind is the item tables'
     * where they know its name (inventory.mjs `grantItem`), so Pills given as Healing are still Sanity Relief. Said
     * under each category select when the name and the pick disagree, before Give, not found out at the first use.
     */
    const paintKinds = () => {
        for (const note of form.querySelectorAll("[data-drpg-kind-note]")) {
            const select = form.elements[note.dataset.drpgKindNote];
            const [category, picked = null] = String(select?.value ?? "").split(":");
            const name = note.dataset.drpgKindNote === "category"
                ? form.elements.name?.value : form.elements.exItem?.selectedOptions?.[0]?.textContent;
            const tables = category === "usable" ? usableKindFor(name) : null;
            const differs = Boolean(USABLE_KINDS[tables]) && tables !== picked;
            note.hidden = !differs;
            (note.querySelector(".drpg-box") ?? note).textContent = differs ? game.i18n.format("DRPG.Items.kindFromTables", {
                item: String(name ?? "").trim(), kind: USABLE_KINDS[tables].label }) : "";
        }
    };
    for (const name of ["category", "exCategory", "exItem", "exTable", "recipient"]) form.elements[name]?.addEventListener("change", paintKinds);
    form.elements.name?.addEventListener("input", paintKinds);
    paintKinds();
}

/** What Give hands back: whichever pane is showing, read as one shape with a `mode`. */
function readGiveForm(d) {
    const f = d.element.querySelector("form");
    const active = shownTab(d.element) ?? "create";

    if (active === "existing" && f.elements.exTable) {
        const [category, kind = null] = f.elements.exCategory.value.split(":");
        return {
            mode: "existing",
            tableId: f.elements.exTable.value,
            resultId: f.elements.exItem.value,
            category, kind,
            // "- choose -" is no tier: `Number("")` is 0, a Tier 0 nobody picked.
            tier: f.elements.exTier.value === "" ? NaN : Number(f.elements.exTier.value),
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

    // Both tabs funnel into one shape, so everything below - the grant, the
    // receipt, the log line - cannot diverge between them.
// Exported for R2022 (E46-C3); `tables` the world's.
export function giveFromResult(result, tables = game.tables) {
    let give;
    if (result.mode === "existing") {
        const entry = tables?.get?.(result.tableId)?.results?.get(result.resultId);
        if (!entry) {
            ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
            return null;
        }
        if (!result.category || !ITEM_TIERS.includes(result.tier)) {
            ui.notifications.warn(game.i18n.localize("DRPG.Items.setCategoryTier"));
            return null;
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
            // different objects. From `MULTI_ROLE_TIER` up only, as Create new
            // offers them (E46-C3, S08-42): an Axe given at Tier 0 was two jobs.
            roles: result.tier >= MULTI_ROLE_TIER ? rolesOfResult(entry) : [],
            img: entry.img ?? null
        };
    } else {
        if (!result.name) {
            ui.notifications.warn(game.i18n.localize("DRPG.Items.needsName"));
            return null;
        }
        give = { ...result, img: null };
    }
    return give;
}

/**
 * The receipt the player sees: what it is, what it does - the kind the item was made with (`item`'s flag, the tables'
 * where they know the name: inventory.mjs `grantItem`), not the GM's pick, so the receipt says what the use will do
 * (E14 part 1 C5; audit S08-14: Pills given as Healing were told "Restores 2 Health" and restored Sanity).
 */
async function tellGiven(actor, give, item = null) {
    const kind = item ? item.getFlag(MODULE_ID, ITEM_FLAGS.kind) ?? null : give.kind;
    const effect = USABLE_KIND_EFFECTS[kind]?.[give.tier]
        ?? TIER_EFFECTS[give.category]?.[give.tier] ?? "";
    const label = USABLE_KINDS[kind]
        ? `${ITEM_CATEGORIES[give.category]?.label} - ${USABLE_KINDS[kind].label}`
        : ITEM_CATEGORIES[give.category]?.label ?? give.category;
    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Items.received")}</h3>
        <p><strong>${esc(give.name)}</strong> - ${esc(label)
        }, ${game.i18n.format("DRPG.Items.tierN", { n: give.tier })}</p>
        ${give.description ? `<p>${esc(give.description)}</p>` : ""}
        ${effect ? `<p><em>${esc(effect)}</em></p>` : ""}`);
}

export async function gmGiveItemDialog(actor) {
    // Truth Bullets have their own dialog. They share nothing with a physical
    // item but the word "give": no tier, no carry limit, and half a dozen fields
    // this form has no place for.
    // Everyone this can be handed to. The one who came in from the hub is
    // selected; opened from the hub there is nobody, and the first student
    // stands in - so the counts below always describe whoever the select is
    // actually showing.
    const students = studentActors();
    const initial = actor ?? students[0] ?? null;
    const categories = giveCategoryOptions(initial);
    const recipients = recipientOptions(students, initial?.id);

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

    const existingPane = giveExistingPane(catalogue, categories, tiers);

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Items.give"),
        // A class of its own (E14 part 2 C7, S08-27): the form rules of styles/danganronpa.css lay its labels out as one
        // grid, and they find the window by it.
        classes: ["drpg-panel", "drpg-window-give"],
        // Two tabs, one verb (Dawid, 2026-08-26). The footer's Give reads
        // whichever pane is showing; the tell-player switch and the cap note
        // sit below the tabs because they are true of both.
        body: `<form>${kitTabs([
            { key: "existing", label: game.i18n.localize("DRPG.Items.tabGiveExisting"),
              html: existingPane },
            { key: "create", label: game.i18n.localize("DRPG.Items.tabCreateNew"),
              html: giveCreatePane({ categories, tiers, suggestions }) }
        ])}${recipientRows(recipients, "DRPG.Items.overCapNote", "drpg-give")}</form>`,
        render: (event, dialog) => { wireGiveForm(dialog); wireKindNotes(dialog); },
        footer: {
            primary: { action: "ok", label: game.i18n.localize("DRPG.Items.give"), callback: (e, b, d) => readGiveForm(d) },
            close: { role: "cancel", action: "cancel" }
        },
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

    const give = giveFromResult(result);
    if (!give) return false;

    const item = await grantItem(actor, {
        reason: "gmRuling",
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

    if (result.tell) await tellGiven(actor, give, item);

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
/** The traces on the scene as options, marking the ones this student already holds a copy of. */
function bulletTraceOptions(traces, who, traceContextLine) {
        const copied = copiedRemnants(who);
        const option = ({ token, data, label }) => {
            const name = label ?? data.public?.name ?? "";
            const context = traceContextLine(data);
            // Said rather than hidden. A second copy is a legitimate thing to
            // hand out - two students may both have seen the same thing - so a
            // missing row would read as a missing trace.
            const held = copied.has(token.id)
                ? ` · ${game.i18n.localize("DRPG.TruthBullet.alreadyHeld")}` : "";
            return `<option value="${token.id}" data-scene="${token.parent?.id ?? ""}" data-name="${esc(name)}">${
                esc(name)}${context ? ` · ${esc(context)}` : ""}${esc(held)}</option>`;
        };
        // Grouped under their scene when the traces lie on more than one (E12 C5): the group is the scene select.
        const scenes = [...new Set(traces.map(entry => entry.token.parent))];
        if (scenes.length <= 1) return traces.map(option).join("");
        return scenes.map(scene => `<optgroup label="${esc(game.i18n.format("DRPG.TruthBullet.onScene", { scene: scene?.name ?? "" }))}">${
            traces.filter(entry => entry.token.parent === scene).map(option).join("")}</optgroup>`).join("");
}

/** The "shown as" select: let the rules decide, Neutral, or the real type. */
function bulletShownSelect(name) {
    return `<select name="${name}" id="drpg-bullet-${name}">
                <option value="auto" selected>${game.i18n.localize("DRPG.TruthBullet.shownAuto")}</option>
                <option value="neutral">${game.i18n.localize("DRPG.TruthBullet.shownNeutral")}</option>
                <option value="real">${game.i18n.localize("DRPG.TruthBullet.shownReal")}</option>
            </select>`;
}

/** The "from a Remnant" tab: pick a trace, rename it, say how it shows. */
function bulletExistingPane(traces, initial, traceContextLine) {
    const firstName = traces.length
        ? (traces[0].label ?? traces[0].data.public?.name ?? "")
        : "";

    return traces.length
        ? formGrid([
            { label: game.i18n.localize("DRPG.TruthBullet.pickRemnant"), id: "drpg-bullet-remnant",
              field: `<select name="remnant" id="drpg-bullet-remnant">${bulletTraceOptions(traces, initial, traceContextLine)}</select>` },
            { label: game.i18n.localize("DRPG.TruthBullet.name"), id: "drpg-bullet-ex-name",
              field: `<input type="text" name="exName" id="drpg-bullet-ex-name" value="${esc(firstName)}" />` },
            { label: game.i18n.localize("DRPG.TruthBullet.shown"), id: "drpg-bullet-exShown", field: bulletShownSelect("exShown") },
            { full: `<p class="notes">${game.i18n.localize("DRPG.TruthBullet.remnantNote")}</p>` }])
        : `<p class="notes">${game.i18n.localize("DRPG.TruthBullet.remnantEmpty")}</p>`;
}

/** The "write new" tab: every field a fresh Truth Bullet needs. */
function bulletCreatePane() {
    const row = (key, id, field) => ({ label: game.i18n.localize(key), id, field });
    const text = (name, key) => `<textarea name="${name}" id="drpg-bullet-${name}" rows="2"
                    placeholder="${game.i18n.localize(key)}"></textarea>`;
    const check = (name, key) => ({ full: `<label class="drpg-checkbox">
                <input type="checkbox" name="${name}" />
                ${game.i18n.localize(key)}</label>` });
    return formGrid([
        row("DRPG.TruthBullet.name", "drpg-bullet-name", `<input type="text" name="name" id="drpg-bullet-name"
                       placeholder="${game.i18n.localize("DRPG.TruthBullet.namePlaceholder")}" />`),
        row("DRPG.TruthBullet.realType", "drpg-bullet-realType", `<select name="realType" id="drpg-bullet-realType">${typeOptions("neutral")}</select>`),
        row("DRPG.TruthBullet.shown", "drpg-bullet-shown", bulletShownSelect("shown")),
        row("DRPG.TruthBullet.visibility", "drpg-bullet-visibility", `<select name="visibility" id="drpg-bullet-visibility">${visibilityOptions("evident")}</select>`),
        check("faint", "DRPG.TruthBullet.faintField"),
        check("tied", "DRPG.TruthBullet.tiedField"),
        row("DRPG.TruthBullet.playerText", "drpg-bullet-playerText", text("playerText", "DRPG.TruthBullet.playerTextPlaceholder")),
        /* A bullet invented here has no trace to inherit a reading from, so this is the only place one can be written
           for it. The Autopsy dialog further down deliberately has no twin of this box: an autopsy identifies itself,
           so no Analyze will ever be thrown at it - see SELF_EVIDENT in truth-bullets.mjs. */
        row("DRPG.TruthBullet.analyzedText", "drpg-bullet-analyzedText", text("analyzedText", "DRPG.TruthBullet.analyzedTextPlaceholder")),
        row("DRPG.TruthBullet.gmNote", "drpg-bullet-gmNote", text("gmNote", "DRPG.TruthBullet.gmNotePlaceholder"))]);
}

/** The name follows the picked trace; the trace list follows the recipient. */
function wireBulletForm(dialog, traces, traceContextLine) {
    wireKitTabs(dialog.element, { win: dialog.element, app: dialog });
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
        picker.innerHTML = bulletTraceOptions(traces, who, traceContextLine);
        if ([...picker.options].some(o => o.value === keep)) picker.value = keep;
    });
}

/** What Give hands back: whichever tab is showing, with the recipient and the tell switch. */
function readBulletForm(d) {
    const f = d.element.querySelector("form");
    const active = shownTab(d.element) ?? "create";
    const common = {
        recipient: f.elements.recipient?.value ?? null,
        tell: f.elements.tell.checked
    };

    if (active === "existing" && f.elements.remnant) {
        return { ...common, mode: "existing",
                 remnantId: f.elements.remnant.value,
                 sceneId: f.elements.remnant.selectedOptions?.[0]?.dataset.scene || null,
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
        analyzedText: f.elements.analyzedText.value.trim(),
        gmNote: f.elements.gmNote.value.trim()
    };
}

/**
 * The bullet a picked trace becomes. A rename is written back to the trace
 * first, so the next copy of it carries the same name. Answers null when the
 * trace is gone.
 */
// Exported for R2023 (E46-C3), which holds E51 C5's comparison: the road's writers are its arguments.
export async function bulletFromRemnant(result, traces, { setRemnantPublicById, markRemnantEditedById, tieForCopy }) {
    const entry = traces.find(t => t.token.id === result.remnantId && (!result.sceneId || t.token.parent?.id === result.sceneId));
    if (!entry) {
        ui.notifications.warn(game.i18n.localize("DRPG.TruthBullet.remnantGone"));
        return null;
    }
    const { token, data } = entry;
    // The trace's own scene, wherever the GM's camera is (E12 C5).
    const scene = token.parent ?? null;
    const pub = data.public ?? null;

    // A rename is written back to the trace, the way Observe writes back the
    // sentence the GM types. Otherwise the second student to be handed this
    // same trace would get the old name, and the two copies of one object
    // would disagree in the pack that is meant to prove things.
    // Against what the window showed (`label`): an undescribed trace's name is empty, and its box read the word (E51 C5).
    if (result.name !== (entry.label ?? pub?.name)) {
        try {
            await setRemnantPublicById(scene?.id, token.id, { name: result.name });
            // Named by a GM, so it is decided (E7).
            await markRemnantEditedById(scene?.id, token.id);
        } catch (err) {
            error("Could not record the new name on the Remnant", err);
        }
    }

    return {
        name: result.name,
        realType: data.type,
        /*
         * THE GM'S EXPLICIT "HAND IT OVER AS NEUTRAL" HAS TO BEAT
         * `SELF_EVIDENT` (T-2, 18.09). Without this a Key or Final realType
         * handed over as Neutral still came out `analyzed: true`, so it
         * published `sourceAction`, `tiedToCrime` and the lab reading below on
         * a bullet the GM deliberately withheld. `null` everywhere else keeps
         * the rules' own answer.
         *
         * AND "THE REAL TYPE" IS THE WHOLE OF IT, reading included (21.09). The
         * option says "no analysis needed", and a Key or a Final showing its kind
         * still has its reading to buy - so `true` says the analysis is done.
         */
        analyzed: result.shown === "neutral" ? false : (result.shown === "real" ? true : null),
        shownType: result.shown === "auto" ? null
            : (result.shown === "real" ? data.type : "neutral"),
        visibility: data.visibility,
        faint: Boolean(data.faint),
        playerText: pub?.playerText ?? "",
        // The trace's lab reading travels with it. `createTruthBullet` decides
        // whether it reaches the item or waits in the secret, by the same
        // `identified` test that governs `sourceAction` below - so a GM handing
        // this out as Neutral hands out nothing analysis has not been paid for.
        analyzedText: pub?.analyzedText ?? "",
        img: pub?.img ?? null,
        gmNote: data.note ?? "",
        remnantId: token.id,
        sceneId: scene?.id ?? null,
        // Passed explicitly, as Observe passes it: without it the bullet
        // takes the room its holder stands in (truth-bullets.mjs `roomOfActor`).
        room: data.room ?? null,
        // Both into the bullet's secret; public on the item only once it is
        // identified, like every other tie.
        sourceAction: data.action ?? null,
        // Undecided while the trace's tie waits for a death nobody has found, read off the trace as
        // it stands now and not as this window opened, as Observe's copy is (remnants.mjs
        // `tieForCopy`; E09 fix r1-G1): `Boolean()` handed the ledger's tie over.
        tiedToCrime: tieForCopy(data, { sceneId: scene?.id, tokenId: token.id })
    };
}

/** The bullet the "write new" tab describes. */
function bulletFromForm(result) {
    return {
        name: result.name,
        realType: result.realType,
        // As in `bulletFromRemnant`: a deliberate Neutral is not identified,
        // whatever the real type would otherwise entitle it to (T-2), and the
        // real type is identified AND read.
        analyzed: result.shown === "neutral" ? false : (result.shown === "real" ? true : null),
        // "auto" means "let the rules decide" - Key, Autopsy and Final
        // bullets arrive identified (a Key's or a Final's reading still
        // waiting for an Analyze), everything else starts Neutral. See
        // createTruthBullet.
        shownType: result.shown === "auto" ? null
            : (result.shown === "real" ? result.realType : "neutral"),
        visibility: result.visibility,
        faint: result.faint,
        // The GM's manual verdict (Dawid, 26.08). Into the bullet's secret
        // at creation; public on the item only once identified.
        tiedToCrime: result.tied,
        playerText: result.playerText,
        // No trace behind this one, so nothing will reconcile it afterwards -
        // what the GM typed is what the bullet keeps. It still waits in the
        // secret until the holder identifies it, like every other reading.
        analyzedText: result.analyzedText,
        gmNote: result.gmNote
    };
}

/** The receipt the player sees. */
async function tellBulletGiven(who, payload) {
    await whisperToOwner(who, `
        <h3>${game.i18n.localize("DRPG.TruthBullet.received")}</h3>
        <p><strong>${esc(payload.name)}</strong></p>
        ${payload.playerText ? `<p>${esc(payload.playerText)}</p>` : ""}
        <p><small>${game.i18n.localize("DRPG.TruthBullet.whereToFind")}</small></p>`);
}

/** What `giveBullet` answers for a receiver who holds a copy of the trace already (E60 C4b). */
export const GIVEN_ALREADY = Symbol("drpg.givenAlready");

/**
 * THE GM'S GIVE, IN THE RECEIVER'S FINDS' QUEUE (E60 C4b, 03.11.2026; D153, SIER-R1 of 31.10). Give a Truth Bullet
 * made its bullet with no queue and no check: a give from a Remnant beside an Observe's find of the same trace, or
 * beside a hand-over of a copy of it, made two copies on one receiver (tier 2 E60-T9 at C4a's tree). The check -
 * whether `who` holds a copy of the trace `payload.remnantId` names already - and the bullet are one step of the
 * receiver's queue now (utils.mjs `serialWrite` under observe.mjs `observeFindKey`), as Observe's find, Monokuma's
 * Reveal and a hand-over are (tier 0 R1289). A bullet written by hand names no trace and is only queued. Answers the
 * bullet, `GIVEN_ALREADY`, or null when none could be made. Exported for the suite.
 * ON ONE GM'S BROWSER (E60's fix round, FG6; the end review's C-m8, S-m4): the queue is this browser's memory, and the
 * give runs on whichever GM opened the window, while Observe's find and a hand-over run on the primary - a give on a
 * second GM's browser beside the primary's find of the same trace for the same receiver can still make two copies.
 * No road a GM's give could take to the primary exists; the race across GMs is E38's (row 1.2.126).
 */
export async function giveBullet(who, payload) {
    const { observeFindKey } = await import("./observe.mjs");
    return serialWrite(observeFindKey(who.id), () =>
        payload?.remnantId && copiedRemnants(who).has(payload.remnantId) ? GIVEN_ALREADY : createTruthBullet(who, payload));
}

export async function giveTruthBulletDialog(actor, { scenes: only = null } = {}) {

    const students = studentActors();
    const initial = actor ?? students[0] ?? null;
    if (!initial) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.noCharacters"));
        return false;
    }

    const recipients = recipientOptions(students, initial.id);

    const { remnantsOn, remnantData, traceContextLine, traceLabel, setRemnantPublicById,
        markRemnantEditedById, tieForCopy } =
        await import("./remnants.mjs");

    /* EVERY SCENE'S TRACES, NOT THE ONE ON SCREEN (E12 C5, 1.2.74; audit S08-43). The list was
       the traces of the scene the GM was looking at, so a trace on another map could not be given
       as a bullet without moving the camera there first. The school's come first (rooms.mjs
       `homeScene`), each scene's grouped under its name (`bulletTraceOptions`), and the bullet is
       written against the picked trace's own scene. `remnantData` is GM-side by construction - a
       player's client holds these tokens but has never held what they mean - and this whole
       window is GM-only, so there is nothing to gate here. */
    const home = homeScene();
    // `only`, the scenes read in their place, is the suite's (E14 fix e1-G7): a world with no trace on any scene, which
    // the suite's world never is (the review's E14p2-END-08, R6).
    const scenes = Array.isArray(only) ? only
        : [...(home ? [home] : []), ...Array.from(game.scenes ?? []).filter(scene => scene !== home)];
    const traces = scenes.flatMap(scene => remnantsOn(scene))
        .map(token => ({ token, data: remnantData(token) }))
        .filter(entry => entry.data)
        // What each trace is called in this window: its described name, or the neutral word (remnants.mjs `traceLabel`, E51 C5).
        .map(entry => ({ ...entry, label: traceLabel(entry.data) }));

    const existingPane = bulletExistingPane(traces, initial, traceContextLine);

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.TruthBullet.give"),
        classes: ["drpg-panel", "drpg-window-bullet"],
        // On Write a new one when no trace lies on any scene (E14 part 2 C6, S08-22): From a Remnant then holds only
        // the line saying so, and the window opened there with Give a Truth Bullet live under it.
        body: `<form>${kitTabs([
            { key: "existing", label: game.i18n.localize("DRPG.TruthBullet.tabFromRemnant"),
              html: existingPane },
            { key: "create", label: game.i18n.localize("DRPG.TruthBullet.tabWriteNew"),
              html: bulletCreatePane() }
        ], { active: traces.length ? "existing" : "create" })}${recipientRows(recipients, "DRPG.TruthBullet.secretNote", "drpg-bullet")}</form>`,
        render: (event, dialog) => wireBulletForm(dialog, traces, traceContextLine),
        footer: {
            primary: { action: "ok", label: game.i18n.localize("DRPG.TruthBullet.give"), callback: (e, b, d) => readBulletForm(d) },
            close: { role: "cancel", action: "cancel" }
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const who = game.actors.get(result.recipient) ?? initial;
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.TruthBullet.needsName"));
        return false;
    }

    const payload = result.mode === "existing"
        ? await bulletFromRemnant(result, traces, { setRemnantPublicById, markRemnantEditedById, tieForCopy })
        : bulletFromForm(result);
    if (!payload) return false;

    const item = await giveBullet(who, payload);

    if (item === GIVEN_ALREADY) {
        ui.notifications.warn(game.i18n.format("DRPG.TruthBullet.alreadyGiven", { actor: who.name }));
        return false;
    }
    if (!item) {
        ui.notifications.error(game.i18n.localize("DRPG.Items.failed"));
        return false;
    }

    ui.notifications.info(game.i18n.format("DRPG.TruthBullet.gave", {
        item: payload.name, actor: who.name
    }));

    if (result.tell) await tellBulletGiven(who, payload);

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

    const { isDeadForGm } = await import("./chapter.mjs");
    const rows = actors.map(a => {
        const dead = isDeadForGm(a);
        return `<label class="drpg-checkbox">
            <input type="checkbox" name="target" value="${a.id}"${dead ? "" : " checked"} />
            ${foundry.utils.escapeHTML(a.name)}${
                dead ? ` - <em>${game.i18n.localize("DRPG.Chapter.deadShort")}</em>` : ""
            }</label>`;
    }).join("");

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.TruthBullet.autopsyTitle"),
        classes: ["drpg-panel", "drpg-window-autopsy"],
        body: `<form>
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
        </form>`,
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.TruthBullet.autopsyIssue"),
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
            close: { role: "cancel", action: "cancel" }
        },
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
    const { keyRoomOf, bedroomOwnerAnywhere } = await import("./vault.mjs");

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
            category !== "bedroomKey" || bedroomOwnerAnywhere(keyRoomOf(item)) !== who.id);

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
            // Where it is and what state it is in, as the holdings list above
            // says them (ITEM-12): two "Kitchen knife (T1)" rows told the GM
            // nothing about which was in the drawer or which was ruined.
            const label = `${ITEM_CATEGORIES[category]?.label ?? category} · ${item.name}${
                tier !== undefined && tier !== null ? ` (T${tier})` : ""
            }${isStashed(item) ? ` - ${game.i18n.localize("DRPG.Items.inStash")}` : ""}${
                isBroken(item) ? ` - ${game.i18n.localize("DRPG.Items.broken")}` : ""}`;
            return `<option value="${item.id}">${foundry.utils.escapeHTML(label)}</option>`;
        }).join("");
    };

    const recipients = recipientOptions(students, initial.id);

    const result = await drpgWindow({
        // The title says which of the three buttons opened this - see
        // `FILTERED` above.
        title: filtered
            ? game.i18n.localize(filtered.title)
            : actor
                ? game.i18n.format("DRPG.Items.takeFrom", { actor: actor.name })
                : game.i18n.localize("DRPG.Items.take"),
        classes: ["drpg-panel", "drpg-window-take"],
        body: `<form>
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
        footer: {
            primary: {
                action: "ok", label: game.i18n.localize("DRPG.Items.take"),
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
            close: { role: "cancel", action: "cancel" }
        },
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
