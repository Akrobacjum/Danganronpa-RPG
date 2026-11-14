/**
 * The item sheet (E54, the sheet's family): Daggerheart's item sheet cut to what an item is - its tabs, editors and
 * heading dropped, its kind labelled, name and description locked - with the wear line (`wearMarkup`), a Truth Bullet's
 * badges (`bulletBadges`, `classSafe`) and the tab dropper the character sheet shares (`dropTab`).
 */

import { MODULE_ID, ITEM_CATEGORIES } from "./config.mjs";
import { truthBulletData } from "./truth-bullets.mjs";
import { isBroken, durabilityOf, durabilityLeft, ITEM_FLAGS } from "./inventory.mjs";
import { isEquippable, tierOf } from "./use-items.mjs";

export function dropTab(app, element, part, name) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;
    const group = part.dataset.group || "primary";
    if (part.classList.contains("active") || app?.tabGroups?.[group] === name) {
        if (typeof app?.changeTab === "function") {
            app.changeTab("features", group, { force: true, updatePosition: false });
        } else {
            for (const el of root.querySelectorAll("[data-tab]")) {
                if ((el.dataset.group || group) === group) el.classList.toggle("active", el.dataset.tab === "features");
            }
            if (app?.tabGroups) app.tabGroups[group] = "features";
        }
    }
    root.querySelectorAll(`nav [data-tab="${name}"], .sheet-tabs [data-tab="${name}"]`).forEach(link => link.remove());
    part.replaceChildren();
}

/* ==========================================================================
 * ITEM SHEETS
 * --------------------------------------------------------------------------
 * Double-clicking anything in the inventory opened Daggerheart's own item
 * sheet, untouched: four tabs, of which three are for a game this one is not
 * playing. Settings edits quantity, weight and the system's own item mechanics;
 * Actions attaches Daggerheart activities; Effects manages Active Effects. None
 * of the three has a meaning in Danganronpa RPG - an item here is a thing you
 * are carrying, and a Truth Bullet is a thing you know - and all three offer a
 * player controls that silently desync this module's own metadata when used.
 *
 * What is left is what an item IS: its picture, its name, and what it says.
 * ========================================================================== */

/** Tabs with nothing to do in this game. */
const ITEM_TABS_CUT = ["settings", "actions", "effects"];

export function trimItemSheet(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    root.classList.add("drpg-item-sheet");

    for (const key of ITEM_TABS_CUT) {
        root.querySelector(`.tab-navigation a[data-tab="${key}"]`)?.remove();
        root.querySelector(`section.tab.${key}`)?.remove();
    }

    // Whatever survived, one of them has to be showing. Cutting the active tab
    // - which happens the moment somebody leaves a sheet open on Settings and
    // it re-renders - otherwise leaves a sheet with a header and a blank body.
    const tabs = [...root.querySelectorAll("section.tab")];
    if (tabs.length && !tabs.some(t => t.classList.contains("active"))) {
        tabs[0].classList.add("active");
        root.querySelector(`.tab-navigation a[data-tab="${tabs[0].dataset.tab}"]`)
            ?.classList.add("active");
    }

    // One tab is not a choice, so it does not need a row of buttons above it.
    const links = root.querySelectorAll(".tab-navigation a");
    if (links.length <= 1) root.querySelector(".tab-navigation")?.remove();

    dropTypeHeading(root);
    dropItemEditors(root);
    labelItemKind(root, app.document);
    lockItemName(root);
    lockItemDescription(root);
}

/**
 * The two buttons on an item card that belong to another game (Dawid, 28.08).
 *
 * "Add GM note" is Daggerheart's own mechanic, in the same family as the three
 * tabs this file already cuts: it is a place to keep rules text about an item
 * that has rules. An item here is a thing you are carrying.
 *
 * The pencil beside the description goes for a different reason. What an item
 * SAYS is authored in the item tables, where it is written once and drawn from
 * by every Search - an item card that offers to edit its own copy is offering
 * to make this one differ from the row it came from, silently, with nothing to
 * say which is right afterwards.
 *
 * FOR EVERYBODY, NOT ONLY PLAYERS. `lockItemDescription` below leaves early for
 * a GM, because its job is the read-only guard rather than the shape of the
 * card. It also removes `a.editor-edit`, which is the OLD markup: in
 * Daggerheart 2.6.5 the toggle is a `<button class="icon toggle">`, so that
 * line has been matching nothing. Left in place, because a world upgraded from
 * an older system still carries the anchor.
 */
function dropItemEditors(root) {
    root.querySelectorAll('[data-action="editGMNote"]').forEach(node => node.remove());
    root.querySelectorAll("button.icon.toggle").forEach(node => node.remove());
}

/**
 * Daggerheart's type heading, removed.
 *
 * It printed the system's own item type - "Loot" - directly under the name, at
 * 16px, which is a bigger and louder statement than the name it sat beneath. It
 * also says nothing: every ordinary item in this game is a `loot`, and the line
 * that actually distinguishes them is the one `labelItemKind` puts above.
 */
function dropTypeHeading(root) {
    root.querySelector(".item-description > h3")?.remove();
}

/*
 * WHY THERE IS NO FITTER HERE.
 *
 * The obvious fix for a name that overflows is to measure it and step the font
 * down until it fits, the way `fitActionTiles` does for the action grid. It was
 * written, and it does not work on this element: the name field ignores a
 * font-size set from script entirely. Measured, and worth writing down so nobody
 * spends the afternoon on it again - with `style.setProperty("font-size",
 * "12px", "important")` on the live, attached input, `getComputedStyle` still
 * reported 20px and `scrollWidth` did not move a pixel across sizes 20 down to
 * 12. The stylesheet CAN size it (that is what took Daggerheart's 30px down to
 * the 20px below); script cannot.
 *
 * So the size is a constant in the stylesheet and a long name is cut with an
 * ellipsis. Real item names are "Bent pipe" and "Bleach"; the forty-six
 * character case that started this was a stress test, not a session.
 */

/**
 * How many bad rolls are left in a thing, drawn where it is carried.
 *
 * DURABILITY WAS INVISIBLE (Dawid, 29.08). It was recorded on the item, spent
 * by `wearItem`, whispered once at the moment it was spent - and then nowhere.
 * A player holding a tier 3 tool that had taken two Despairs had no way to know
 * they were one bad roll from losing it, which turns a rule about pressing your
 * luck into a rule about being surprised.
 *
 * Pips rather than "1/3", because that is how this module counts everything a
 * player can spend: actions, Hope, Health. Filled is what is left, hollow is
 * what has been taken - the same direction of travel as the action tray, so a
 * row that is going dark reads as going dark.
 *
 * Nothing is drawn for a broken item: its row already says BROKEN in crimson,
 * and three hollow pips beside that word only says it again, more quietly.
 *
 * A TIER 0 THING HAS NO TRACK (the owner's amend of 25.09.2026; E13 C8). It is spent by the
 * first roll it is used in, whatever the roll (use-items.mjs `rollSpends`), so one pip would
 * read as "one Despair and it is gone", which is no longer the rule; the row says "Single use"
 * instead, its tooltip the rule. Tier is read as the rule reads it (`tierOf`: no tier recorded
 * is 0). Where the words sit in a narrow row is not measured: no layout here (R439 reads the
 * markup only).
 *
 * @param {Item} item
 * @returns {string} HTML, or "" when there is nothing worth saying.
 */
export function wearMarkup(item) {
    if (!item || isBroken(item)) return "";

    /*
     * ONLY WHAT CAN ACTUALLY BE WORN DOWN.
     *
     * `durabilityOf` answers 1 for anything with no tier recorded, so every
     * object in the pack could draw a pip - and a bedroom key with one hollow
     * socket beside it says "one bad roll and this is gone", which is not true
     * of a key and never will be. Despair wear is spent by `breakOnDespair` on
     * the tool that was READIED for the roll, and only a Crime Tool, a Cleaning
     * Tool or a Tool can be readied at all. Everything else in the pack is spent
     * by being used, or by being taken.
     */
    if (!isEquippable(item)) return "";

    if (tierOf(item) === 0) {
        const hint = game.i18n.localize("DRPG.Items.singleUseTooltip");
        return `<span class="drpg-item-wear drpg-single-use" data-tooltip="${
            foundry.utils.escapeHTML(hint)}" aria-label="${
            foundry.utils.escapeHTML(hint)}">${
            foundry.utils.escapeHTML(game.i18n.localize("DRPG.Items.singleUse"))}</span>`;
    }

    const total = durabilityOf(item);
    if (!(total > 0)) return "";

    const left = durabilityLeft(item);
    const tip = game.i18n.format("DRPG.Items.durabilityTooltip", { left, total });

    /*
     * THE TRACK ONLY EVER GOES DOWN, and the socket stays behind (Dawid,
     * 29.08). Every pip is drawn for the whole life of the thing; wear takes
     * the SOLID ink out of the rightmost one and leaves the empty frame where
     * it was. So a tier 3 tool that has taken two Despairs reads as one dot and
     * two rings, and the rings say what it used to have - which is the whole
     * point of showing this at all.
     *
     * This is the action tray's own idiom, by name: `.drpg-action-pip` draws
     * every action a character has and hollows out the ones they spent. Same
     * sprite pair, same direction of travel.
     */
    let pips = "";
    for (let i = 0; i < total; i++) {
        pips += `<span class="drpg-wear-pip${i < left ? " filled" : ""}"></span>`;
    }
    return `<span class="drpg-item-wear" data-tooltip="${
        foundry.utils.escapeHTML(tip)}" aria-label="${
        foundry.utils.escapeHTML(tip)}">${pips}</span>`;
}

/**
 * Say what kind of thing this is, under its name.
 *
 * The window showed a name, a picture and a description, and nothing at all
 * about which of the four kinds it was - so a Murder Weapon and a Usable looked
 * identical once opened, and the only place the difference appeared was the
 * group header back on the inventory tab.
 *
 * A Truth Bullet gets more than a word: it gets the SAME badges its row on the
 * character sheet carries, from the same function, because a player who opens a
 * piece of evidence must not be shown a second, differently-worded account of it.
 */
function labelItemKind(root, item) {
    if (!item || root.querySelector(".drpg-item-kind")) return;

    const info = root.querySelector(".item-sheet-header .item-info");
    if (!info) return;

    const category = item.getFlag(MODULE_ID, ITEM_FLAGS.category) ?? null;
    const isBullet = category === "truthBullet";
    const label = ITEM_CATEGORIES[category]?.label
        ?? (isBullet ? game.i18n.localize("DRPG.TruthBullet.title") : null);
    if (!label) return;

    const line = document.createElement("div");
    line.className = `drpg-item-kind${isBullet ? " is-bullet" : ""}`;
    line.dataset.drpgCategory = category;

    const kind = document.createElement("span");
    kind.className = "drpg-item-kind-label";
    kind.textContent = label;
    line.append(kind);

    // The window opened from a row that said Broken has to say it too. Without
    // this, the one screen that shows an item in full was the one screen that
    // did not mention the only thing that had changed about it.
    if (isBroken(item)) {
        const tag = document.createElement("span");
        tag.className = "drpg-item-broken";
        tag.dataset.tooltip = game.i18n.localize("DRPG.Items.brokenTooltip");
        tag.textContent = game.i18n.localize("DRPG.Items.broken");
        line.append(tag);
    }

    // The window opened from the row shows what the row shows. A Truth Bullet
    // is not a tool and never takes wear, so it is the one thing here without.
    if (!isBullet) {
        const wear = wearMarkup(item);
        if (wear) line.insertAdjacentHTML("beforeend", wear);
    }

    if (isBullet) {
        const data = truthBulletData(item);
        if (data) {
            const badges = document.createElement("span");
            badges.className = "drpg-tb-badges";
            badges.innerHTML = bulletBadges(data, { gm: game.user.isGM });
            line.append(badges);
        }
    }

    info.prepend(line);
}

/**
 * The name is the GM's to write.
 *
 * An item's name is what everybody else at the table will hear it called, and
 * on a Truth Bullet it is half the evidence - "Bent pipe" and "Bent pipe, wiped
 * clean" are different claims about the same object. A player renaming their own
 * copy rewrites the record for the trial.
 *
 * Made read-only rather than hidden: seeing the field and finding it locked says
 * "this is not yours to set", where a missing field says "this item has no name"
 * and reads as a bug. The write itself is refused in resource-guard.mjs, which
 * is what actually holds - this is the half a player can see.
 */
function lockItemName(root) {
    if (game.user.isGM) return;
    for (const field of root.querySelectorAll('input[name="name"]')) {
        field.readOnly = true;
        field.classList.add("drpg-locked-field");
        field.dataset.tooltip = game.i18n.localize("DRPG.Guard.nameLocked");
    }
}

/**
 * The description is the GM's to write too, same reasoning as the name - see
 * resource-guard.mjs, which is what actually refuses the write. This is the
 * half a player can see: an editor left active would keep taking edits that
 * the server was silently discarding, which reads as a broken module rather
 * than a locked field.
 *
 * Two shapes, because Foundry's rich-text editor comes in either depending on
 * version and system upgrade path: the ProseMirror custom element in newer
 * builds, or a plain textarea behind a "click to edit" link in older ones.
 * Both get the same read-only treatment `lockItemName` gives the name field;
 * the edit-toggle link is removed outright rather than disabled, since a
 * removed control cannot be clicked by anybody reading their own sheet.
 *
 * SEARCHED FROM THE ROOT, LIKE `lockItemName`, AND NOT INSIDE `.item-description`.
 * That wrapper still exists in Daggerheart 2.6.5 - so this returned nothing and
 * failed silently rather than loudly - but the editor moved out of it into
 * `.description-section`. Measured on a player's client: the name field came
 * back read-only and locked, the editor came back untouched, and the writes it
 * accepted were discarded server-side by resource-guard.mjs. A live editor
 * whose edits vanish is the "looks like a broken module" report. Matching on
 * the field NAME rather than on a container is what stops the next reshuffle of
 * the system's markup from breaking this again.
 */
function lockItemDescription(root) {
    if (game.user.isGM) return;

    const label = game.i18n.localize("DRPG.Guard.descriptionLocked");

    for (const editor of root.querySelectorAll('prose-mirror[name^="system.description"]')) {
        editor.toggleAttribute("readonly", true);
        editor.classList.add("drpg-locked-field");
        editor.dataset.tooltip = label;
    }
    for (const field of root.querySelectorAll('textarea[name^="system.description"]')) {
        field.readOnly = true;
        field.classList.add("drpg-locked-field");
        field.dataset.tooltip = label;
    }
    root.querySelector("a.editor-edit")?.remove();
}

/**
 * A value fit to stand in a `class` attribute: letters, digits, `-` and `_` only.
 *
 * E02, 24.09.2026; audit S03-05. A role key and a bullet's shown type were
 * printed straight into `class="..."` inside `innerHTML`, and both live in item
 * flags a player's console can write - a quote in either closed the attribute
 * and opened an `onerror`. Every key this module itself writes (the categories,
 * the usable kinds, the bullet types) already fits, so the real classes and the
 * styles on them are untouched; anything else loses the characters it could
 * break out with.
 */
export function classSafe(value) {
    return String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "");
}

/**
 * The badges a Truth Bullet wears, as one string.
 *
 * Extracted so the inventory row and the item window are not two descriptions of
 * one object that drift apart - they are the same call. A player comparing the
 * row on their sheet with the window they just opened from it must not find two
 * different accounts of the same piece of evidence; in a game whose endgame is
 * people comparing notes, that is a contradiction the table has to spend the
 * trial resolving.
 */
export function bulletBadges(data, { gm = false } = {}) {
    if (!data) return "";

    const badge = (text, cls, tooltip = "") =>
        `<span class="drpg-tb-badge ${cls}"${
            tooltip ? ` data-tooltip="${foundry.utils.escapeHTML(tooltip)}"` : ""
        }>${foundry.utils.escapeHTML(text)}</span>`;

    const badges = [badge(data.shownLabel, `type ${classSafe(data.shownType)}`, data.shownHint)];

    /*
     * FAINT SITS WITH THE TYPE, AND ONLY ONCE THERE IS A TYPE TO SIT WITH.
     *
     * It reads as a second half of what the thing IS - "Prep, and doubtful" -
     * so it belongs beside the type rather than after the chapter, where it
     * used to sit between the chapter and the GM's "Really:" chip and read as a
     * third unrelated fact.
     *
     * `identified` and not `faint` alone: since 1.2.47 the flag is published
     * onto the item only by `identify`, so on a bullet made since then the two
     * cannot disagree - but a world made before it still carries the flag on
     * unanalysed bullets until `migrateFaintIntoSecrets` has run, and a player's
     * client renders from the item. Asking both is what makes the badge correct
     * on the first load of an old world rather than on the second.
     */
    if (data.faint && data.identified) {
        badges.push(badge(game.i18n.localize("DRPG.TruthBullet.faint"), "faint",
            game.i18n.localize("DRPG.TruthBullet.faintTooltip")));
    }

    badges.push(badge(data.visibilityLabel, "visibility",
        game.i18n.localize("DRPG.TruthBullet.visibilityTooltip")));

    if (data.chapter !== null) {
        badges.push(badge(game.i18n.format("DRPG.TruthBullet.chapterShort", { n: data.chapter }),
            "chapter"));
    }
    /*
     * WHERE IT WAS PICKED UP, WHICH THE PACK COULD NOT SAY UNTIL NOW.
     *
     * The room has been on the bullet since it was created (`TRUTH_BULLET_FLAGS
     * .room`) and the trial's evidence card has shown it all along; the
     * inventory row, which is where a player actually reads their pack, did
     * not. A case is argued in rooms - "who was in the kitchen" - and a pack
     * that can be sorted by room (see the inventory's grouping) needs to say
     * the room on the row as well, or the grouping is the only place the fact
     * exists (Dawid, 16.09).
     *
     * Not secret: `room` is written onto the item at creation, unlike
     * `sourceAction` beside it, because WHERE you found something is what you
     * were doing when you found it - the finder already knows.
     */
    if (data.room) badges.push(badge(data.room, "room",
        game.i18n.localize("DRPG.TruthBullet.roomTooltip")));
    // A burned attempt is worth showing rather than silently removing the
    // button: "I already tried this one" is information the player needs when
    // deciding what to spend the next action on.
    if (data.lockedChapter !== null && data.lockedChapter === data.chapterNow) {
        badges.push(badge(game.i18n.localize("DRPG.TruthBullet.locked"), "locked",
            game.i18n.localize("DRPG.TruthBullet.lockedTooltip")));
    }
    // GM only, and only worth showing while it still differs from what the
    // player sees - once a bullet is identified the two badges say the same thing.
    if (gm && data.realType && data.realType !== data.shownType) {
        badges.push(badge(game.i18n.format("DRPG.TruthBullet.really", { type: data.realLabel }),
            "real", data.gmNote || game.i18n.localize("DRPG.TruthBullet.reallyTooltip")));
    }

    return badges.join("");
}
