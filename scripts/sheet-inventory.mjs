/**
 * The inventory (E54, the sheet's family): the system's create buttons removed, the groups the player chose,
 * the rows and their buttons (use, equip, discard, stash, present, hand over; `guardRow` among them), the open stashes and
 * the Truth Bullets' groups, order and folds (`bulletGroups`).
 */

import { MODULE_ID, BEDROOM_KEY_FLAG, ITEM_CATEGORIES, LIMIT_GROUPS, EQUIPPABLE, TIMES_OF_DAY } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { isTruthBullet, TRUTH_BULLET_FLAGS, isIdentified, truthBulletData, isAnalysable } from "./truth-bullets.mjs";
import { getClock } from "./clock.mjs";
import { inClassTrial } from "./trial.mjs";
import { stashRoomsFor, openStashesHere, stashItemsIn } from "./vault.mjs";
import { murderState, sideOf } from "./murder.mjs";
import { isStashed, categoriesInGroup, isBroken, countInGroup } from "./inventory.mjs";
import { isEquipped, isUsable, usedCreatively, isEquippable, noDiscardNow } from "./use-items.mjs";
import { sceneOfActor, roomOfActor } from "./movement.mjs";
import { GM_ROUTE_CLASS, error } from "./utils.mjs";
import { drpgConfirm } from "./ui-kit.mjs";
import { modeOf, rowGate, sheetMode } from "./sheet-mode.mjs";
import { dropTab, wearMarkup, classSafe, bulletBadges } from "./sheet-item.mjs";
import { itemTags, guardRow, GEAR_GROUP, INVENTORY_GROUPS } from "./sheet-sidebar.mjs";

/* ==========================================================================
   THE PACK, CUT INTO GROUPS THE PLAYER CHOSE
   ==========================================================================
   A case is argued in two currencies - "what happened in chapter 2" and "who
   was in the kitchen" - and a flat list of thirty Truth Bullets serves neither.
   So the pack is cut into groups, one of them open and the rest folded, and the
   player says which currency (Dawid, 16.09).

   BOTH MODES HAVE THE SAME SHAPE, which is the whole of the design: the group
   that is about NOW is open, every other group is a fold with its count on it,
   and inside every group the newest evidence is at the top. Learn it once and
   it reads the same whichever switch is down.

   "NOW" is the current chapter in one mode and the room the character is
   standing in in the other. When they are nowhere the module can name - between
   rooms, or on a scene with no regions - the group holding the newest evidence
   opens instead, so the fold is never all shut.
   ========================================================================== */

/** Which groups this player has folded open, so a re-render does not shut them. */
const BULLET_FOLDS = new Map();

/*
 * NO INVENTORY ON A MONOKUMA'S SHEET (E95 C7, 10.11.2026; the owner: "Usunmy z karty postaci monokumy zakladke
 * inventory"). The same drop as the Biography's: the link leaves the tab bar, the part is emptied (what `groupInventory`
 * drew goes with it), a sheet that came up on it moves to the Actions tab. Nothing is deleted or moved in the data: a
 * character marked Monokuma keeps what it held and the tab, with the items, is back when it is unmarked. A step of its
 * own, after the ones that draw into the part.
 */
export function tidyInventoryTab(app, element, mode = modeOf(app)) {
    if (mode.inventory) return;
    const part = element?.querySelector?.('section[data-application-part="inventory"]');
    if (part) dropTab(app, element, part, "inventory");
}

/** A key to somebody's bedroom - see vault.mjs. */
function isBedroomKey(item) {
    return Boolean(item?.getFlag?.(MODULE_ID, BEDROOM_KEY_FLAG));
}

/** The items of one group, carried (not stashed), in the order the group reads best in. */
function groupItems(actor, group, inGroup) {
    // Carried only. What is in the stash gets its own section below, or the
    // counts would say "Gear 4 / 3" for somebody obeying the rules.
    const items = actor.items.filter(i => {
        if (isStashed(i)) return false;
        const key = i.getFlag(MODULE_ID, "category");
        return inGroup ? inGroup.has(key) : key === group.key;
    });

    /*
     * SORTED BY HOME, so one row still reads like three.
     *
     * Weapons, then cleaning gear, then tools - the order they had as
     * headings, kept as an order within the list. Without it a knife, a rag
     * and a second knife arrive in creation order and the row is a pile.
     * Stable within a home, so nothing else anybody cares about moves.
     */
    if (inGroup) {
        const rank = categoriesInGroup(group.group);
        items.sort((a, b) =>
            rank.indexOf(a.getFlag(MODULE_ID, "category"))
            - rank.indexOf(b.getFlag(MODULE_ID, "category")));
    }


    // Truth Bullets are not ordered here any more: they are cut into groups by
    // chapter or by room and ordered inside each one - see `bulletGroups`. The
    // murder's own evidence still floats, but to the top of its GROUP rather
    // than to the top of a flat list it no longer has.
    return items;
}

/** One carried item's row: portrait, name, the broken and ready marks, its badges, wear, tier, and the row buttons. */
function buildItemRow(li, item, app, actor, inGroup) {
    const tier = item.getFlag(MODULE_ID, "tier");
    const ready = isEquipped(item);
    const broken = isBroken(item);
    const tags = itemTags(item, Boolean(inGroup));
    if (ready) li.classList.add("drpg-item-equipped");
    // The row is still the row. A used-up thing is the same
    // object in the same slot - what changes is that it says so,
    // and that the two buttons which would use it are refused.
    if (broken) li.classList.add("drpg-item-broken-row");
    li.innerHTML = `<img src="${foundry.utils.escapeHTML(item.img ?? "")}" alt="" />
                    <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>
                    ${broken ? `<span class="drpg-item-broken" data-tooltip="${
                        foundry.utils.escapeHTML(game.i18n.localize("DRPG.Items.brokenTooltip"))
                    }">${foundry.utils.escapeHTML(
                        game.i18n.localize("DRPG.Items.broken"))}</span>` : ""}
                    ${ready ? `<span class="drpg-item-ready" data-tooltip="${
                        foundry.utils.escapeHTML(game.i18n.localize("DRPG.Items.readyTooltip"))
                    }"><i class="fa-solid fa-hand-fist" inert></i></span>` : ""}
                    ${tags.length ? `<span class="drpg-tb-badges">${tags.map(tag =>
                        `<span class="drpg-tb-badge drpg-role-${classSafe(tag.key)}" data-tooltip="${
                            foundry.utils.escapeHTML(tag.hint)
                        }">${foundry.utils.escapeHTML(tag.label)}</span>`).join("")
                    }</span>` : ""}
                    ${wearMarkup(item)}
                    ${tier !== undefined && tier !== null
                        ? `<span class="drpg-item-tier">T${foundry.utils.escapeHTML(String(tier))}</span>` : ""}`;
    addUseButton(li, item, app);
    addEquipButton(li, item, app);
    addDiscardButton(li, item, app);
    // A key is COPIED, like a Truth Bullet: letting somebody
    // into your room is not the same as giving your room away,
    // and the guide's whole social engine runs on the first.
    addHandoverButton(li, item, app, { copying: isBedroomKey(item) });
    // Any stash anywhere, exactly as before - `stow` is what
    // decides whether you are standing at one. Location-gating
    // the button would be a different rule, not a translation.
    if (stashRoomsFor(actor, sceneOfActor(actor)).length) addStashButton(li, item, app, { stowing: true });
}

export function groupInventory(app, element, mode = modeOf(app)) {
    const tab = element.querySelector('section[data-application-part="inventory"]');
    if (!tab) return;

    tab.querySelector(".drpg-inventory-groups")?.remove();

    const actor = app.document;
    const box = document.createElement("div");
    box.className = "drpg-inventory-groups";

    for (const group of INVENTORY_GROUPS) {
        const cat = group.key ? ITEM_CATEGORIES[group.key] : null;
        const inGroup = group.group ? new Set(categoriesInGroup(group.group)) : null;
        const items = groupItems(actor, group, inGroup);
        // A Monokuma's sheet is no student's (E45 C1, S03-33): a group only for what it holds, and no student's limit.
        if (!mode.groups && !items.length) continue;

        /*
         * THE COUNTER IS THE BUDGET, NOT THE ROW (E8, trap 69).
         *
         * Murder Weapons, Cleaning Tools and Tools share three slots between
         * them, so each of those three rows shows the SAME "2 / 3" - the number
         * of things in your hands and how many you may hold. Showing the row's
         * own count against the shared cap would put "1 / 3" over a full
         * inventory in three places at once, which is three lies rather than
         * one. Ungrouped rows are unchanged: Usables still count their own.
         */
        const group_ = mode.groups ? group.group ?? cat?.limitGroup ?? null : null;
        const limit = !mode.groups ? null : group_ ? LIMIT_GROUPS[group_]?.limit : cat?.limit;
        const counted = group_ ? countInGroup(actor, group_) : items.length;

        const section = document.createElement("div");
        section.className = "drpg-inventory-group";
        section.dataset.category = group.key ?? group.group;

        const head = document.createElement("h4");
        head.innerHTML = `<span>${game.i18n.localize(group.labelKey)}</span>
                          <span class="drpg-group-count${limit && counted >= limit ? " full" : ""}"${
                              group_ ? ` data-tooltip="${game.i18n.format("DRPG.Sheet.sharedSlots", { n: limit })}"` : ""
                          }>${counted}${limit ? ` / ${limit}` : ""}</span>`;
        section.append(head);

        // Carrying one and holding one are different things, and only the second
        // does anything now: an unreadied Crime Tool arms nobody, and an
        // unreadied Cleaning Tool helps with nothing in Stage 6. That is a rule
        // worth stating on the sheet rather than one to be discovered mid-murder.
        if (items.length && (group.group === GEAR_GROUP || EQUIPPABLE.includes(group.key))
            && !items.some(isEquipped)) {
            const nudge = document.createElement("p");
            nudge.className = "notes drpg-equip-nudge";
            nudge.textContent = game.i18n.localize("DRPG.Items.noneReadied");
            section.append(nudge);
        }

        /* ONE ROW BUILDER, WHATEVER IT IS PUT INSIDE. The Truth Bullets group
           draws its rows inside folds and every other group draws them in one
           list, and neither may grow its own idea of what a row is. */
        const rowFor = item => {
            const li = document.createElement("li");
            li.dataset.itemUuid = item.uuid;

            if (isTruthBullet(item)) {
                buildBulletRow(li, item, app);
            } else {
                buildItemRow(li, item, app, actor, inGroup);
            }

            // The row's buttons live inside the row, and the row itself opens
            // the item sheet - so each button has to be able to say "not me".
            // `guardRow` sits in front of all of them; see its own note.
            guardRow(li, item, app);
            li.addEventListener("click", event => {
                if (event.target.closest("[data-drpg-row-action]")) return;
                item.sheet?.render(true);
            });
            return li;
        };

        if (group.key === "truthBullet" && items.length) {
            section.append(bulletSortSwitch(app));
            const { mode, groups } = bulletGroups(items, actor);
            for (const bullets of groups) {
                section.append(bulletFold(bullets, rowFor, actor, mode));
            }
        } else {
            const list = document.createElement("ul");
            list.className = "drpg-inventory-list";

            if (!items.length) {
                const empty = document.createElement("li");
                empty.className = "drpg-inventory-empty";
                empty.textContent = game.i18n.localize("DRPG.Sheet.groupEmpty");
                list.append(empty);
            } else {
                for (const item of items) list.append(rowFor(item));
            }
            section.append(list);
        }

        box.append(section);
    }

    buildOtherSection(box, actor, app);
    buildStashSection(box, actor, app);
    buildOpenStashSection(box, actor, app);
    tab.prepend(box);
}

/*
 * WHAT NO HEADING FILES (E14 part 2 C6, 24.10.2026; audit S03-18).
 *
 * The groups above are drawn by category, and the stylesheet hides Daggerheart's own inventory lists, so an item with
 * no category flag - dragged on from the sidebar or a compendium - or with one this module does not have was on the
 * actor and on no screen: nothing to use, hand over or remove, and a GM took the drop for failed. They are drawn here,
 * carried ones only, each row opening the item's sheet, with a line saying what to do. Give / take items lists by
 * category and cannot take such an item (gm-items.mjs `holdingsHtml`, `takeItemDialog`), so a GM's row has its own Remove,
 * asked first, and the line says to give it again as what it is; a player is told to ask the GM. The item types are the ones that sit in an inventory - the two this module makes
 * (inventory.mjs `grantItem`: "consumable" and "loot") and Daggerheart's "weapon" and "armor" (its type names as the
 * system declares them; not read in this repository) - so a feature, a domain card or a class is never listed.
 */
const CARRIED_TYPES = new Set(["consumable", "loot", "weapon", "armor"]);

function buildOtherSection(box, actor, app) {
    const items = actor.items.filter(item => CARRIED_TYPES.has(item.type) && !isStashed(item)
        && !ITEM_CATEGORIES[item.getFlag(MODULE_ID, "category")]);
    if (!items.length) return;

    const section = document.createElement("div");
    section.className = "drpg-inventory-group drpg-other-group";
    section.dataset.category = "other";
    const head = document.createElement("h4");
    head.innerHTML = `<span>${game.i18n.localize("DRPG.Sheet.groupOther")}</span>
                      <span class="drpg-group-count">${items.length}</span>`;
    section.append(head);

    const hint = document.createElement("p");
    hint.className = "notes";
    hint.textContent = game.i18n.localize(modeOf(app).gm ? "DRPG.Sheet.otherHintGm" : "DRPG.Sheet.otherHint");
    section.append(hint);

    const list = document.createElement("ul");
    list.className = "drpg-inventory-list";
    for (const item of items) {
        const li = document.createElement("li");
        li.dataset.itemUuid = item.uuid;
        li.innerHTML = `<img src="${foundry.utils.escapeHTML(item.img ?? "")}" alt="" />
                        <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>`;
        if (modeOf(app).otherRemove) {
            const tip = game.i18n.localize("DRPG.Sheet.otherRemove");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "drpg-row-button drpg-row-discard";
            button.dataset.drpgRowAction = "remove";
            button.dataset.tooltip = tip;
            button.setAttribute("aria-label", tip);
            button.innerHTML = `<i class="fa-solid fa-trash" inert></i>`;
            button.addEventListener("click", async () => {
                /* A question on the kit's frame (E21 C5a): the item is deleted, which cannot be undone - the destructive
                   role, Cancel the default (E22). */
                const sure = await drpgConfirm({
                    classes: ["drpg-panel"],
                    yes: { role: "destructive", label: game.i18n.localize("DRPG.Dialog.yes") },
                    title: tip,
                    body: `<p>${game.i18n.format("DRPG.Sheet.otherRemoveAsk", {
                        item: foundry.utils.escapeHTML(item.name), actor: foundry.utils.escapeHTML(actor.name) })}</p>`,
                    rejectClose: false, modal: true
                });
                // The write is the GM's road: its own guard, whatever drew the button (R220's census reads it).
                if (!sure || !game.user.isGM) return;
                await item.delete();
                app.render(false);
            });
            li.append(button);
        }
        guardRow(li, item, app);
        li.addEventListener("click", event => {
            if (event.target.closest("[data-drpg-row-action]")) return;
            item.sheet?.render(true);
        });
        list.append(li);
    }
    section.append(list);
    box.append(section);
}

/**
 * "There is somebody else's stash in this room, and it is not hidden."
 *
 * Only drawn when all of that is true, so it is not a permanent control - it
 * appears because of where the character is standing, which is the point. A
 * concealed stash does not show up here at all: finding one of those is what
 * the Search action's own stash branch is for.
 */
function buildOpenStashSection(box, actor, app) {
    // The dead rifle nothing, a Monocub included (D15, S08-30): it offered a
    // Rifle the GM's side then refused (stash-reach.mjs `stealFromVault`). The row's gate: an editable sheet, no
    // Monokuma, nobody dead (`sheetMode`).
    if (!modeOf(app).rows.stash) return;

    /*
     * ONE HEADING PER STASH, ONE BUTTON FOR THE ROOM.
     *
     * A room can hold several now, and drawing only the first would hide the
     * fact that there is a second - which is exactly the information this
     * panel exists to give. The button stays single because `rifleStashDialog`
     * lists all of them in one grouped picker: two buttons doing the same thing
     * would be two roads to one dialog.
     */
    const stashes = openStashesHere(actor).filter(entry => entry.items.length);
    if (!stashes.length) return;

    const section = document.createElement("div");
    section.className = "drpg-inventory-group drpg-open-stash-group";
    section.dataset.category = "openStash";

    for (const entry of stashes) {
        const head = document.createElement("h4");
        head.innerHTML = `<span>${game.i18n.format("DRPG.Vault.openStashSection", {
            who: foundry.utils.escapeHTML(entry.owner.name),
            room: foundry.utils.escapeHTML(entry.room)
        })}</span><span class="drpg-group-count">${entry.items.length}</span>`;
        section.append(head);
    }

    const note = document.createElement("p");
    note.className = "notes";
    note.textContent = game.i18n.localize("DRPG.Vault.openStashNote");
    section.append(note);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-action-button drpg-rifle-button";
    button.innerHTML = `<i class="fa-solid fa-hand" inert></i>
        <span class="drpg-action-name">${game.i18n.localize("DRPG.Vault.rifle")}</span>`;
    button.addEventListener("click", async () => {
        const { rifleStashDialog } = await import("./vault.mjs");
        await rifleStashDialog(actor);
        app.render(false);
    });
    section.append(button);

    box.append(section);
}

/**
 * "Stash - <room>", under the carried groups.
 *
 * Only drawn when this character actually has a bedroom assigned. Uncapped, so
 * there is no count to show - what matters is which room it is in, because that
 * is where they have to be standing to reach it.
 */
function buildStashSection(box, actor, app) {
    // One section per stash you own, in room order. A character with two of
    // them has two drawers in two places, and merging them into one list would
    // hide the only thing that matters about a stash: where you have to be
    // standing to reach it. On the scene the character stands on (E12 C6), where `stow` and
    // `retrieve` reach them; until 1.2.74 the sheet listed the stashes of the scene on screen.
    const scene = sceneOfActor(actor);
    for (const entry of stashRoomsFor(actor, scene)) {
        buildOneStashSection(box, actor, app, entry.room, scene);
    }
}

function buildOneStashSection(box, actor, app, room, scene) {
    const items = stashItemsIn(actor, room, scene);

    const section = document.createElement("div");
    section.className = "drpg-inventory-group drpg-stash-group";
    section.dataset.category = "vault";

    const head = document.createElement("h4");
    head.innerHTML = `<span>${game.i18n.format("DRPG.Vault.section", {
        room: foundry.utils.escapeHTML(room)
    })}</span><span class="drpg-group-count">${items.length}</span>`;
    section.append(head);

    const list = document.createElement("ul");
    list.className = "drpg-inventory-list";

    if (!items.length) {
        const empty = document.createElement("li");
        empty.className = "drpg-inventory-empty";
        empty.textContent = game.i18n.localize("DRPG.Sheet.groupEmpty");
        list.append(empty);
    } else {
        for (const item of items) {
            const li = document.createElement("li");
            li.dataset.itemUuid = item.uuid;
            const tier = item.getFlag(MODULE_ID, "tier");
            // Putting a ruined thing in a drawer is one of the two ways out of
            // carrying it, so the drawer has to admit what is in it - otherwise
            // the stash is where broken tools go to become anonymous again.
            const broken = isBroken(item);
            if (broken) li.classList.add("drpg-item-broken-row");
            li.innerHTML = `<img src="${foundry.utils.escapeHTML(item.img ?? "")}" alt="" />
                            <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>
                            ${broken ? `<span class="drpg-item-broken" data-tooltip="${
                                foundry.utils.escapeHTML(game.i18n.localize("DRPG.Items.brokenTooltip"))
                            }">${foundry.utils.escapeHTML(
                                game.i18n.localize("DRPG.Items.broken"))}</span>` : ""}
                            ${wearMarkup(item)}
                            ${tier !== undefined && tier !== null
                                ? `<span class="drpg-item-tier">T${foundry.utils.escapeHTML(String(tier))}</span>` : ""}`;
            addStashButton(li, item, app, { stowing: false });
            guardRow(li, item, app);
            li.addEventListener("click", event => {
                if (event.target.closest("[data-drpg-row-action]")) return;
                item.sheet?.render(true);
            });
            list.append(li);
        }
    }

    section.append(list);
    box.append(section);
}

/**
 * Drink it, eat it, apply it.
 *
 * Only on Usable Items, and only for somebody who can act - a corpse's first
 * aid kit is not a first aid kit. Free: the guide charges actions for finding
 * and making things, not for opening what you already carry.
 */
function addUseButton(li, item, app) {
    // Not the dead's, a Monocub too (D15, S08-30): what they carried in life is on the body,
    // the body's to be found - `useItem` refuses the dead as well (`rowGate`).
    if (!rowGate(app)) return;
    if (!isUsable(item)) return;

    // SHOWN, AND DEAD. An opened kit keeps its button so the row does not
    // quietly change shape when it is spent - the player looks at the same
    // three controls and one of them has stopped working, which is the fact.
    // Hiding it would read as the item having changed into something else.
    const broken = isBroken(item);
    /* A TIER 0 THING'S USE IS A REQUEST TO THE GM (E22 C5c; A4, audit S03-26): it has no table row, so a GM rules on
       what the player writes (use-items.mjs `useCreatively`) - red, with the GM's word in its tooltip, where "Use this
       item." promised the item would simply work. In a fight it is a crisis action, which no GM rules (below), so it
       is the plain Use there. */
    const askGm = !broken && usedCreatively(item) && !inCrisis(app.document);
    const tip = game.i18n.localize(broken
        ? "DRPG.Items.brokenTooltip" : askGm ? "DRPG.Items.useTier0Tooltip" : "DRPG.Items.useTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-row-button drpg-row-use${broken ? " is-broken" : ""}${askGm ? ` ${GM_ROUTE_CLASS}` : ""}`;
    button.dataset.drpgRowAction = "use";
    button.disabled = broken;
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid fa-flask" inert></i>`;

    button.addEventListener("click", async () => {
        /*
         * DURING AN INCIDENT THIS IS A CRISIS ACTION (E9, G-21).
         *
         * `useItem` had no idea a murder was happening. Every other act in the
         * incident pays a turn, a roll and a threshold; this one was reachable
         * straight from the row, so a victim drank a first aid kit mid-murder
         * for nothing while the killer spent their turn swinging.
         *
         * The same button, because it is the same intention. What changes is
         * what happens after it: threshold 15 on Hand, a trace either way, and
         * the item only actually goes in on a critical or a success with Hope.
         */
        if (inCrisis(app.document)) {
            const { takeCrisisAction } = await import("./murder.mjs");
            await takeCrisisAction(app.document, "useItem", { itemId: item.id });
            app.render(false);
            return;
        }

        const { useItem } = await import("./use-items.mjs");
        await useItem(app.document, item);
        app.render(false);
    });

    li.append(button);
}

/**
 * Is this character inside a running incident, on a side that acts?
 *
 * Not "is there an incident" - a third party who has walked in has their own
 * four decisions and using a pocketful of bandages is not among them, and
 * anybody outside it entirely is just a student having a drink.
 */
function inCrisis(actor) {
    try {
        const state = murderState();
        if (!state || state.stage !== "incident") return false;
        const side = sideOf(actor);
        return side === "victim" || side === "killer";
    } catch {
        return false;
    }
}

/**
 * Hold this one ready.
 *
 * The incident engine asks "which weapon" and, without this, could only answer
 * "the highest tier you happen to own" - which is wrong the moment a killer is
 * carrying a Tier 3 axe they mean to frame somebody with and a Tier 1 pipe they
 * mean to swing.
 */
function addEquipButton(li, item, app) {
    // The dead ready nothing (E14 part 1 C3, S08-12): `toggleEquipped` refuses them too (`rowGate`).
    if (!rowGate(app)) return;
    if (!isEquippable(item)) return;

    const ready = isEquipped(item);
    const broken = isBroken(item);
    const tip = game.i18n.localize(broken
        ? "DRPG.Items.brokenTooltip"
        : ready ? "DRPG.Items.unequipTooltip" : "DRPG.Items.equipTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-row-button drpg-row-equip${ready ? " active" : ""}${
        broken ? " is-broken" : ""}`;
    button.dataset.drpgRowAction = "equip";
    button.disabled = broken;
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-${ready ? "solid" : "regular"} fa-hand-fist" inert></i>`;

    button.addEventListener("click", async () => {
        const { toggleEquipped } = await import("./use-items.mjs");
        await toggleEquipped(app.document, item);
        app.render(false);
    });

    li.append(button);
}

/**
 * Throw the ruined thing away, and leave the trace of having done it.
 *
 * Only ever on a broken item, because it is not a general "delete from
 * inventory" - the guide has no such move, and one would let a killer make the
 * murder weapon cease to exist for free. This is the priced version: a Shadow
 * roll decides how obvious the trace is, and the trace stays on the map for the
 * investigation to find. See `discardBroken` in use-items.mjs.
 *
 * The other way out of the same problem is the stash button already on this
 * row, which costs nothing and hides nothing from anybody who searches the
 * bedroom.
 */
function addDiscardButton(li, item, app) {
    // A corpse throws nothing away. Same gate as the Use button, a Monocub
    // included: the trace was laid at the Monocub's token, not at the body (S08-30).
    if (!rowGate(app)) return;
    if (!isBroken(item)) return;
    // The stash is the OTHER answer, not a place to act from: something already
    // put away has to be taken back out before it can be thrown away.
    if (isStashed(item)) return;

    /* GREYED IN THE CLASS TRIAL, WITH ITS REASON (E51 C6; E51-41): `aria-disabled` and not `disabled`, as the fight's tile
       (`actionButton`), so the tooltip that says why still shows; the press is refused by `discardBroken` in the
       same words. */
    const trial = noDiscardNow();
    const tip = trial ?? game.i18n.localize("DRPG.Items.discardTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-row-button drpg-row-discard";
    button.dataset.drpgRowAction = "discard";
    if (trial) button.setAttribute("aria-disabled", "true");
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid fa-trash" inert></i>`;

    button.addEventListener("click", async () => {
        const { discardBroken } = await import("./use-items.mjs");
        await discardBroken(app.document, item);
        app.render(false);
    });

    li.append(button);
}

/**
 * Put away, or take back out. Free, and only from the room itself - the check
 * that matters lives in vault.mjs, this just offers the button.
 */
function addStashButton(li, item, app, { stowing }) {
    // The dead put nothing away and take nothing out, a Monocub included (S08-12,
    // D15): a thing put away is off the body, and a body's loot takes none of those (`rowGate`).
    if (!rowGate(app)) return;

    const tip = game.i18n.localize(stowing ? "DRPG.Vault.stowTooltip" : "DRPG.Vault.takeTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-row-button drpg-row-stash";
    button.dataset.drpgRowAction = "stash";
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid fa-${stowing ? "box-archive" : "hand-back-fist"}" inert></i>`;

    button.addEventListener("click", async () => {
        const { stow, retrieve } = await import("./vault.mjs");
        if (stowing) await stow(app.document, item);
        else await retrieve(app.document, item);
        app.render(false);
    });

    li.append(button);
}

/** "chapter" or "room", this browser's own. */
function bulletSortMode() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.bulletSort) === "room" ? "room" : "chapter";
    } catch {
        // Before `ready`, or on a client that has never stored it: the default.
        return "chapter";
    }
}

/*
 * NEWEST BY THE GAME'S CLOCK, NOT BY THE SERVER'S.
 *
 * A Truth Bullet is stamped with the chapter, the day and the time of day it
 * was picked up, and in a game whose endgame is a timeline that is what "newest"
 * has to mean: the bullet from last night is newer than the one from the morning
 * whatever order the documents were written in. A copy handed to you carries the
 * ORIGINAL discovery's stamp (`handover.mjs`), so a pack reads as the story it
 * came from rather than as the order things landed in your inventory.
 *
 * `createdTime` is the tiebreak and not the key, because two finds in the same
 * time of day is the common case and the clock cannot separate them. The index
 * in `actor.items` is the last resort: Foundry ids are random, so they order
 * nothing, but the collection keeps creation order.
 */
function bulletRecency(item, index) {
    const flag = key => item.getFlag(MODULE_ID, key);
    const tod = TIMES_OF_DAY.indexOf(flag(TRUTH_BULLET_FLAGS.timeOfDay));
    return [
        Number(flag(TRUTH_BULLET_FLAGS.chapter) ?? 0),
        Number(flag(TRUTH_BULLET_FLAGS.day) ?? 0),
        tod < 0 ? 0 : tod,
        Number(item._stats?.createdTime ?? 0),
        index
    ];
}

/** Newest first, with the murder's own evidence ahead of it inside a group. */
function orderBullets(items, chapterNow) {
    /*
     * THE MURDER'S EVIDENCE STILL FLOATS, and it floats inside its group now.
     * `tiedToCrime` reaches a player's item only once they have analysed the
     * bullet (analyze.mjs), so an unanalysed one cannot leak its relevance
     * through its place in the list - that rule is older than this grouping and
     * it is why the test is `isIdentified` and not the flag alone.
     */
    const ofTheMurder = i => Number(isIdentified(i)
        && i.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.tiedToCrime) === true
        && i.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.chapter) === chapterNow);

    const keyed = items.map((item, index) => ({ item, index, at: bulletRecency(item, index) }));
    keyed.sort((a, b) => {
        const float = ofTheMurder(b.item) - ofTheMurder(a.item);
        if (float) return float;
        for (let i = 0; i < a.at.length; i++) {
            if (a.at[i] !== b.at[i]) return b.at[i] - a.at[i];   // descending: newest first
        }
        return 0;
    });
    return keyed.map(k => k.item);
}

/**
 * The pack as groups, in the order they are drawn.
 *
 * Exported for the suite and for nothing else: this is the whole of the
 * grouping rule, and a rule about which evidence a player is shown first is
 * worth a test that does not have to render a character sheet to ask it.
 *
 * @returns {{mode: string, groups: {key: string, label: string, here: boolean, items: Item[]}[]}}
 */
export function bulletGroups(items, actor) {
    const mode = bulletSortMode();
    const clock = getClock();
    const chapterNow = clock.chapter;

    const bucket = new Map();
    items.forEach((item, index) => {
        const key = mode === "room"
            ? (item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.room) || "")
            : String(item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.chapter) ?? "");
        if (!bucket.has(key)) bucket.set(key, []);
        bucket.get(key).push({ item, index });
    });

    let hereKey = mode === "room" ? (roomOfActor(actor) || "") : String(chapterNow ?? "");
    // Nowhere the module can name, or nothing found there yet: open the group
    // holding the newest evidence rather than leaving every fold shut.
    if (!bucket.has(hereKey)) {
        let best = null;
        for (const [key, rows] of bucket) {
            for (const row of rows) {
                const at = bulletRecency(row.item, row.index);
                if (!best || compareRecency(at, best.at) > 0) best = { key, at };
            }
        }
        hereKey = best?.key ?? hereKey;
    }

    const groups = [...bucket.entries()].map(([key, rows]) => ({
        key,
        label: key === ""
            ? game.i18n.localize(mode === "room"
                ? "DRPG.Sheet.bulletsNoRoom" : "DRPG.Sheet.bulletsNoChapter")
            : (mode === "room" ? key : game.i18n.format("DRPG.TruthBullet.chapterShort", { n: key })),
        here: key === hereKey,
        items: orderBullets(rows.map(r => r.item), chapterNow),
        newest: rows.reduce((best, row) => {
            const at = bulletRecency(row.item, row.index);
            return !best || compareRecency(at, best) > 0 ? at : best;
        }, null)
    }));

    /* The open one first, then the rest newest-group-first, and the group with no
       answer at all last - "no location" is not a place and "no chapter" is not a
       time, so neither belongs in the middle of an ordering by place or time. */
    groups.sort((a, b) => {
        if (a.here !== b.here) return a.here ? -1 : 1;
        const empty = (a.key === "") - (b.key === "");
        if (empty) return empty;
        return compareRecency(b.newest, a.newest);
    });

    return { mode, groups };
}

/** Lexicographic on the recency tuples: positive when `a` is newer than `b`. */
function compareRecency(a, b) {
    if (!a) return b ? -1 : 0;
    if (!b) return 1;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
}

/** The two-button switch over the pack. Writes one client setting and redraws. */
function bulletSortSwitch(app) {
    const mode = bulletSortMode();
    const box = document.createElement("div");
    box.className = "drpg-bullet-sort";

    const label = document.createElement("span");
    label.className = "drpg-bullet-sort-label";
    label.textContent = game.i18n.localize("DRPG.Sheet.bulletSortLabel");
    box.append(label);

    for (const [key, labelKey] of [
        ["chapter", "DRPG.Sheet.bulletsByChapter"],
        ["room", "DRPG.Sheet.bulletsByRoom"]
    ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `drpg-bullet-sort-button${mode === key ? " is-on" : ""}`;
        /* `aria-pressed` rather than a disabled button for the one that is on: a
           reader has to be able to move onto it to hear which of the two is
           chosen, and a disabled control is not in the tab order. */
        button.setAttribute("aria-pressed", String(mode === key));
        button.textContent = game.i18n.localize(labelKey);
        button.addEventListener("click", async event => {
            event.stopPropagation();
            if (mode === key) return;
            try {
                await game.settings.set(MODULE_ID, SETTINGS.bulletSort, key);
            } catch (err) {
                error("Could not change how Truth Bullets are grouped", err);
                return;
            }
            app.render(false);
        });
        box.append(button);
    }
    return box;
}

/** One fold: its name, its count, and the rows inside it. */
function bulletFold(group, rowFor, actor, mode) {
    /* Remembered per actor, per mode, per group. The sheet re-renders on every
       clock write and every item change, and a fold that shut itself each time
       would be unusable exactly while somebody is reading through their pack.
       Keyed by mode as well, so the two modes do not inherit each other's folds -
       "the kitchen is open" says nothing about which chapter should be. */
    const foldKey = `${actor.id}:${mode}:${group.key}`;
    const details = document.createElement("details");
    details.className = `drpg-bullet-group${group.here ? " is-here" : ""}`;
    details.open = BULLET_FOLDS.get(foldKey) ?? group.here;
    details.addEventListener("toggle", () => BULLET_FOLDS.set(foldKey, details.open));

    const summary = document.createElement("summary");
    const name = document.createElement("span");
    name.className = "drpg-bullet-group-name";
    name.textContent = group.label;
    const count = document.createElement("span");
    count.className = "drpg-group-count";
    count.textContent = String(group.items.length);
    summary.append(name, count);
    if (group.here) {
        summary.dataset.tooltip = game.i18n.localize(mode === "room"
            ? "DRPG.Sheet.bulletsHereRoom" : "DRPG.Sheet.bulletsHereChapter");
    }
    details.append(summary);

    const list = document.createElement("ul");
    list.className = "drpg-inventory-list";
    for (const item of group.items) list.append(rowFor(item));
    details.append(list);
    return details;
}

function buildBulletRow(li, item, app) {
    const data = truthBulletData(item);
    if (!data) return;

    li.classList.add("drpg-truth-bullet");
    li.dataset.bulletType = data.shownType;

    li.innerHTML = `<img src="${foundry.utils.escapeHTML(item.img ?? "")}" alt="" />
                    <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>
                    <span class="drpg-tb-badges">${bulletBadges(data, { gm: modeOf(app).realBullets })}</span>`;

    // Nor the dead's, a Monocub included (E24 C3a, `rowGate`): Share, Present and Analyze are a living student's.
    if (!rowGate(app)) return;

    // Evidence is worth passing on whatever state it is in - an unidentified
    // copy is exactly what you hand to somebody whose analysis has not been
    // burned yet. So this button is offered regardless of the lock.
    // NOT IN THE CLASS TRIAL (E70 C10, 28.10.2026; B6, the owner's "Share znika z wiersza rozprawy"): a Present hands
    // every participant a copy as it was shown (trial.mjs `presentOnPrimary`), so Share there is a second road to the
    // same copy with none of the table watching. A bedroom key's row keeps its own button (`buildItemRow`).
    if (!inClassTrial()) addHandoverButton(li, item, app, { copying: true });
    addPresentButton(li, item, app);

    // Nothing to analyse once it is read - an Autopsy bullet arrives whole, an
    // analysed one is resolved, and one this character already failed on this
    // chapter is closed to them until the next. A Key or a Final keeps the
    // button until its reading is bought (21.09).
    if (!isAnalysable(item, data.chapterNow)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-row-button drpg-tb-analyze";
    button.dataset.drpgRowAction = "analyze";
    button.dataset.tooltip = game.i18n.localize("DRPG.TruthBullet.analyzeTooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.TruthBullet.analyzeTooltip"));
    button.innerHTML = `<i class="fa-solid fa-brain" inert></i>`;

    button.addEventListener("click", async () => {
        const { performAction } = await import("./action-rolls.mjs");
        await performAction(app.document, "analyze", { bulletId: item.id });
    });

    li.append(button);
}

/**
 * "Put this in front of everyone."
 *
 * Only during a Class Trial, and only for the living. It reaches the whole
 * table at once, and outside the trial the cast is spread across rooms that are
 * meant to stay separate - the same-room Share button covers those phases
 * instead. A dead student's row has no button (E10 C16, 1.2.71; audit S06-35):
 * a character killed with their bullets kept still drew one and put evidence on
 * every screen. `presentDialog` refuses them as well, and `seizeFloor` refuses
 * their Objection on the primary GM.
 *
 * ONE BUTTON, ONE ACT, since 1.2.79 (E79 C16; the owner, 17.10.2026). Until
 * then the row's button was Present outside a debate and an Objection inside
 * one, repainted in place as the floor moved (E10 C16, S03-27, S06-43). An
 * Objection is raised now with OBJECTION! on the HUD and its Truth Bullet is
 * chosen after it (trial.mjs `raiseObjection`), so the row only ever presents:
 * free, the floor untouched, in a debate as outside one.
 */
function addPresentButton(li, item, app) {
    // Nor for a student on the trial's list of the dead (E70 fix p1-G1): a death nobody has found too (TR30).
    if (!modeOf(app).presentShown) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.drpgRowAction = "present";
    button.className = "drpg-row-button drpg-row-present";
    button.innerHTML = `<i class="fa-solid fa-gavel" inert></i>`;

    button.dataset.drpgActorId = app.document.id;
    paintPresentButton(button, app.document);

    button.addEventListener("click", async () => {
        const { presentDialog } = await import("./trial.mjs");
        await presentDialog(app.document, item);
    });

    li.append(button);
}

/**
 * The row's Present by the mode's row (E70 C10; TR2 = 1): held, with the row's line as its tooltip ("Only {name} can
 * present right now."), while somebody else holds the floor of a mode with a speaker; the window says the same if it is
 * pressed. Painted in place when the floor moves (`repaintPresentButtons`), so a turn's change renders no sheet.
 */
function paintPresentButton(button, actor) {
    const { held } = sheetMode(actor).present();
    const tip = held ?? game.i18n.localize("DRPG.Trial.presentTooltip");
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    if (held) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
}

/** Every drawn row's Present painted again for the floor as it stands (the floor's setting written). */
export function repaintPresentButtons() {
    for (const button of document.querySelectorAll(".drpg-row-present[data-drpg-actor-id]")) {
        const actor = game.actors.get(button.dataset.drpgActorId);
        if (actor) paintPresentButton(button, actor);
    }
}

/**
 * "Hand this to somebody standing here."
 *
 * One button, two meanings, and the tooltip says which: a Truth Bullet is
 * copied and an item changes hands.
 *
 * Shown to the GM as well. They have Give / take items, which is the stronger
 * tool, but this one obeys the fiction's rules - same room, carry limits - and
 * a GM running a character or testing the table needs the same door the players
 * use, not a different one.
 */
function addHandoverButton(li, item, app, { copying }) {
    // Nor the dead's, a Monocub included (E24 C3a, D15): what is on the body is the body's (`rowGate`).
    if (!rowGate(app)) return;

    const tip = game.i18n.localize(copying ? "DRPG.Handover.shareTooltip" : "DRPG.Handover.giveTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-row-button drpg-row-handover";
    button.dataset.drpgRowAction = "handover";
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid fa-${copying ? "share-nodes" : "hand-holding"}" inert></i>`;

    button.addEventListener("click", async () => {
        const { shareBulletDialog, handOverDialog } = await import("./handover.mjs");
        // TWO THINGS ARE COPIED, AND ONLY ONE OF THEM IS A TRUTH BULLET.
        // `copying` above chooses the icon and the wording; it does not choose
        // the route. `shareBulletDialog` refuses anything that is not a Truth
        // Bullet on its first line, so sending a bedroom key down it made the
        // share button on a key do nothing at all - no dialog, no error, no
        // console line. A key goes the ordinary way and is turned into a copy
        // by `giveItem` on the GM side, which is the only place that can see
        // both sheets anyway.
        if (copying && isTruthBullet(item)) await shareBulletDialog(app.document, item);
        else await handOverDialog(app.document, item, { copying });
    });

    li.append(button);
}
