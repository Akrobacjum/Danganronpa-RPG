/**
 * Danganronpa RPG — character sheet surgery.
 * ---------------------------------------------------------------------------
 * The guide's sheet has no class, subclass, ancestry or community. What sits
 * under the character's name is their Ultimate: "the thing this character does
 * best". Daggerheart renders that row as `.character-details`, so we replace
 * its contents with an editable Ultimate line.
 *
 * Everything else that gets removed (Loadout tab, armour, proficiency, damage
 * thresholds, the Daggerheart level pill) is handled in danganronpa.css. Only
 * the parts that need real behaviour live here.
 */

import {
    MODULE_ID, FLAGS, ACTIONS, STARTING, ITEM_CATEGORIES, LIMIT_GROUPS, USABLE_KINDS, MONOCUB,
    ECLIPSE_MOVES,
    EQUIPPABLE,
    BEDROOM_KEY_FLAG, callEffect, HOPE_CALLS, DESPAIR_CALLS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { actionsLeft, actionsMax, actionBudget, hasFreeMove, setActions,
    canPayFor, freeActionsLeft, freeMovesLeft } from "./actions.mjs";
import { resourceMax, initCharacter } from "./character.mjs";
import { isMonokuma, poolUserFor } from "./monokuma.mjs";
import { getDespair } from "./despair.mjs";
import { hopeHeld, hopeMax, affordableHopeCalls, despairCallsFor } from "./calls.mjs";
import { isEclipse, movesLeft as eclipseMovesLeft } from "./eclipse.mjs";
import {
    isTruthBullet, truthBulletData, isAnalysable, isIdentified, TRUTH_BULLET_FLAGS
} from "./truth-bullets.mjs";
import { getClock } from "./clock.mjs";
import { inClassTrial } from "./trial.mjs";
import { stashRoomsFor, stashItemsIn, openStashesHere } from "./vault.mjs";
// `availableCrisisActions` and `isTheirTurn` went to the Direct Murder tile's
// menu with the crisis grid — see `openCrisisMenu` in action-rolls.mjs.
import { murderState, sideOf, betrayalTarget } from "./murder.mjs";
// Two different silences, so both are renamed at the door rather than one of
// them shadowing the other: a Monocub silenced for the chapter may not speak,
// a player silenced by a Despair Call may not spend Hope.
import { isMonocub, isSilenced, isSilenced as cubSilenced } from "./monocub.mjs";
import { isSilenced as callSilenced, isChained, pendingGather } from "./call-effects.mjs";
import { isDeceased } from "./chapter.mjs";
import { isStashed, ITEM_FLAGS, isBroken, durabilityOf, wearOf,
    durabilityLeft } from "./inventory.mjs";
// `equippedFor` went with the clean-up panel's "what you have readied" note —
// the Tamper menu says it now, where the roll it applies to is chosen.
import { isUsable, isEquippable, isEquipped, equippedIn, usableKindOf }
    from "./use-items.mjs";
import { countInGroup, categoriesInGroup, rolesOf } from "./inventory.mjs";
// `bodyIsHere` moved with the three Stage 6 actions — the Tamper menu asks it
// now (action-rolls.mjs), because that is where the body tile lives.
import { isCleaner } from "./cleanup.mjs";
import { roomOfActor, neighbouringRooms, othersInRoom } from "./movement.mjs";
import { SearchTokens } from "./search-tokens.mjs";
// `sabotageTargetsIn` used to be imported here for the tile that no longer
// exists; the question is asked in action-rolls.mjs now, where the menu is.
import { rules } from "./rules.mjs";
import { safeword } from "./safeword.mjs";
import { spentSince, markSpent } from "./motion.mjs";
import { debug, error, plural } from "./utils.mjs";

export function registerSheetTweaks() {
    // ApplicationV2 fires a render hook per class in the inheritance chain,
    // so the concrete Daggerheart sheet class name is the precise target.
    Hooks.on("renderCharacterSheet", onRenderCharacterSheet);

    // The flicker. See the block comment above `onlyResourceKeys` for what
    // these two do and, more importantly, for the measurement that decides
    // which of them does what — the order is not the one it looks like.
    Hooks.on("preUpdateActor", markResourceOnlyUpdate);
    Hooks.on("updateActor", repaintAfterResourceUpdate);

    /*
     * WHEN A CACHED TAMPER ANSWER STOPS BEING TRUE.
     *
     * The cache key already covers the two ordinary ways it goes stale — the
     * character walked out, or the clock turned. What it cannot see is the
     * ledger itself changing under a character who has not moved: a trace
     * erased, one planted, a chapter's sweep. All three are writes to
     * `remnantSecrets`.
     *
     * `clientSettingChanged`, NOT `updateSetting`, AND THIS LISTENER DID
     * NOTHING AT ALL UNTIL E17. `updateSetting` is a DOCUMENT hook, and
     * `remnantSecrets` is client-scoped: Foundry writes it straight to
     * localStorage without ever creating a Setting document, so the hook never
     * fires. Measured — a world setting fired it twice for two writes, this one
     * fired zero times for two. dice-sync.mjs found the same trap a fortnight
     * ago and the knowledge did not travel, which is why there is now a tier-0
     * criterion (R14) standing over every listener of this shape.
     *
     * The argument is the full "namespace.key" id, not a document.
     *
     * Narrow on purpose. Forgetting on every module setting would mean a socket
     * question per open sheet after every action in the game, which is the cost
     * the note above `roomBlockFor` was right to refuse.
     */
    Hooks.on("clientSettingChanged", key => {
        if (key === `${MODULE_ID}.${SETTINGS.remnantSecrets}`) forgetTamper();
    });

    // Every item sheet, whatever Daggerheart calls the class. `renderItemSheetV2`
    // is Foundry's own rung of that ladder, so it catches LootSheet, FeatureSheet
    // and anything the system adds later — one hook instead of a list that goes
    // stale. See `trimItemSheet`.
    Hooks.on("renderItemSheetV2", (app, element) => {
        try {
            trimItemSheet(app, element);
        } catch (err) {
            error("Could not trim an item sheet", err);
        }
    });
}

/* ==========================================================================
 * ITEM SHEETS
 * --------------------------------------------------------------------------
 * Double-clicking anything in the inventory opened Daggerheart's own item
 * sheet, untouched: four tabs, of which three are for a game this one is not
 * playing. Settings edits quantity, weight and the system's own item mechanics;
 * Actions attaches Daggerheart activities; Effects manages Active Effects. None
 * of the three has a meaning in Danganronpa RPG — an item here is a thing you
 * are carrying, and a Truth Bullet is a thing you know — and all three offer a
 * player controls that silently desync this module's own metadata when used.
 *
 * What is left is what an item IS: its picture, its name, and what it says.
 * ========================================================================== */

/** Tabs with nothing to do in this game. */
const ITEM_TABS_CUT = ["settings", "actions", "effects"];

function trimItemSheet(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    root.classList.add("drpg-item-sheet");

    for (const key of ITEM_TABS_CUT) {
        root.querySelector(`.tab-navigation a[data-tab="${key}"]`)?.remove();
        root.querySelector(`section.tab.${key}`)?.remove();
    }

    // Whatever survived, one of them has to be showing. Cutting the active tab
    // — which happens the moment somebody leaves a sheet open on Settings and
    // it re-renders — otherwise leaves a sheet with a header and a blank body.
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
 * by every Search — an item card that offers to edit its own copy is offering
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
 * It printed the system's own item type — "Loot" — directly under the name, at
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
 * spends the afternoon on it again — with `style.setProperty("font-size",
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
 * Say what kind of thing this is, under its name.
 *
 * The window showed a name, a picture and a description, and nothing at all
 * about which of the four kinds it was — so a Murder Weapon and a Usable looked
 * identical once opened, and the only place the difference appeared was the
 * group header back on the inventory tab.
 *
 * A Truth Bullet gets more than a word: it gets the SAME badges its row on the
 * character sheet carries, from the same function, because a player who opens a
 * piece of evidence must not be shown a second, differently-worded account of it.
 */
/**
 * How many bad rolls are left in a thing, drawn where it is carried.
 *
 * DURABILITY WAS INVISIBLE (Dawid, 29.08). It was recorded on the item, spent
 * by `wearItem`, whispered once at the moment it was spent — and then nowhere.
 * A player holding a tier 3 tool that had taken two Despairs had no way to know
 * they were one bad roll from losing it, which turns a rule about pressing your
 * luck into a rule about being surprised.
 *
 * Pips rather than "1/3", because that is how this module counts everything a
 * player can spend: actions, Hope, Health. Filled is what is left, hollow is
 * what has been taken — the same direction of travel as the action tray, so a
 * row that is going dark reads as going dark.
 *
 * Nothing is drawn for a broken item: its row already says BROKEN in crimson,
 * and three hollow pips beside that word only says it again, more quietly.
 *
 * @param {Item} item
 * @returns {string} HTML, or "" when there is nothing worth saying.
 */
function wearMarkup(item) {
    if (!item || isBroken(item)) return "";

    /*
     * ONLY WHAT CAN ACTUALLY BE WORN DOWN.
     *
     * `durabilityOf` answers 1 for anything with no tier recorded, so every
     * object in the pack could draw a pip — and a bedroom key with one hollow
     * socket beside it says "one bad roll and this is gone", which is not true
     * of a key and never will be. Despair wear is spent by `breakOnDespair` on
     * the tool that was READIED for the roll, and only a Crime Tool, a Cleaning
     * Tool or a Tool can be readied at all. Everything else in the pack is spent
     * by being used, or by being taken.
     */
    if (!isEquippable(item)) return "";

    const total = durabilityOf(item);
    if (!(total > 0)) return "";

    const left = durabilityLeft(item);
    const tip = game.i18n.format("DRPG.Items.durabilityTooltip", { left, total });

    let pips = "";
    for (let i = 0; i < total; i++) {
        pips += `<span class="drpg-wear-pip${i < left ? " filled" : ""}"></span>`;
    }
    return `<span class="drpg-item-wear${wearOf(item) ? " is-worn" : ""}" data-tooltip="${
        foundry.utils.escapeHTML(tip)}" aria-label="${
        foundry.utils.escapeHTML(tip)}">${pips}</span>`;
}

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
            badges.innerHTML = bulletBadges(data);
            line.append(badges);
        }
    }

    info.prepend(line);
}

/**
 * The name is the GM's to write.
 *
 * An item's name is what everybody else at the table will hear it called, and
 * on a Truth Bullet it is half the evidence — "Bent pipe" and "Bent pipe, wiped
 * clean" are different claims about the same object. A player renaming their own
 * copy rewrites the record for the trial.
 *
 * Made read-only rather than hidden: seeing the field and finding it locked says
 * "this is not yours to set", where a missing field says "this item has no name"
 * and reads as a bug. The write itself is refused in resource-guard.mjs, which
 * is what actually holds — this is the half a player can see.
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
 * The description is the GM's to write too, same reasoning as the name — see
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
 * That wrapper still exists in Daggerheart 2.6.5 — so this returned nothing and
 * failed silently rather than loudly — but the editor moved out of it into
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

/* ==========================================================================
 * THE FLICKER
 * --------------------------------------------------------------------------
 * Every write to `system.resources.*` made the WHOLE SHEET redraw. Not an
 * animation problem — a full re-render, which also replays every injection this
 * file makes: the action panel, the tabs, `tidyBiography`, `paintResourceBars`.
 * One cause, two symptoms: the equipped tab blinking on a roll (a roll spends
 * Hope, and Hope is a resource) and the whole window blinking on a Health or
 * Sanity change.
 *
 * The repair is to stop rendering for those updates and repaint the bar in
 * place instead — `paintResourceBars` already exists and already knows how to
 * resume a half-finished animation.
 *
 * WHERE THE PLAN HAD IT BACKWARDS, AND THE MEASUREMENT THAT SHOWED IT.
 *
 * The plan put the "skip the next render" mark in `updateActor`. Instrumented
 * on 14.365, the real order of one `actor.update()` is:
 *
 *     preUpdateActor  →  render (the sheet)  →  updateActor  →  render (sidebar)
 *
 * The render being skipped has ALREADY HAPPENED by the time `updateActor`
 * runs. So the mark goes down in `preUpdateActor`, which is the only hook that
 * fires early enough, and `updateActor` does the repainting afterwards.
 *
 * A NO-OP UPDATE IS THE TRAP THIS OPENS. Setting a resource to the value it
 * already holds fires `preUpdateActor` and then NOTHING — no render, no
 * `updateActor` — so a mark laid down for it would still be armed when
 * something legitimate rendered next, and would eat that instead. Measured, not
 * imagined: `orderNoop` was exactly `["preUpdateActor"]`. Hence the value
 * comparison below; the mark is only laid for an update that will really change
 * something and therefore really render.
 *
 * THE CONDITION IS STRICT ON PURPOSE. Anything else in the same package — a
 * flag, an item, an effect — and the render happens. A skipped render that was
 * needed is a sheet showing something untrue, which is worse than a blink.
 *
 * "RESOURCES" IS NARROWER THAN IT SOUNDS, AND THAT MATTERS.
 *
 * `system.resources` holds five things here: hitPoints, stress, hope, actions
 * and armor. Only the first three are drawn by something that can be repainted
 * without a render — the two bars in the sidebar and the Hope diamonds in the
 * header. Actions are drawn by this file's own action panel and again by the
 * player's status strip; armor by the system's template. Skipping a render for
 * one of those would leave a number on screen that is no longer true, which is
 * the failure this whole apparatus exists to avoid, so they are left alone and
 * still render exactly as they did.
 *
 * A SKIPPED RENDER LEAVES THE OLD NUMBERS IN THE DOM. Obvious in hindsight and
 * not obvious while writing it: `paintResourceBars` reads the `<progress>` and
 * the number input, both of which the render would have rewritten. Repainting
 * from them repaints the OLD value — measured, the bar sat at 0 while the actor
 * held 1. So the inputs are fed from the actor first, and only then painted.
 * ========================================================================== */

/** Sheets holding a one-shot "do not render" mark. */
const skipNextRender = new WeakSet();

const RESOURCE_PREFIX = "system.resources.";

/**
 * The resources this file can redraw in place — see the note above.
 *
 * Adding one here is a promise that `repaintInPlace` below draws it.
 */
const REPAINTABLE = new Set(["hitPoints", "stress", "hope"]);

/**
 * Is every key in this update a resource this file can repaint itself?
 *
 * `_id` and `_stats` are not part of the answer. MEASURED: the package handed
 * to `preUpdateActor` is exactly what the caller wrote, but by `updateActor`
 * the server has added `_stats.modifiedTime` — so a predicate that only
 * forgives `_id` says "no" on the second hook and the repaint never runs. That
 * failure is silent and looks exactly like the flicker fix working, except the
 * numbers stop moving.
 */
function onlyResourceKeys(changes) {
    const keys = Object.keys(foundry.utils.flattenObject(changes ?? {}))
        .filter(key => key !== "_id" && !key.startsWith("_stats."));
    if (!keys.length) return false;

    return keys.every(key => {
        if (!key.startsWith(RESOURCE_PREFIX)) return false;
        const name = key.slice(RESOURCE_PREFIX.length).split(".")[0];
        return REPAINTABLE.has(name);
    });
}

/**
 * Will this update actually change a value — that is, will it render at all?
 *
 * ONLY ANSWERABLE BEFORE THE WRITE. Asked from `updateActor` it is always
 * false, because by then the actor already holds the new values, and a repaint
 * gated on it would never happen. That is why the two hooks below do not share
 * one predicate: the earlier one asks this, the later one must not.
 */
function willReallyChange(actor, changes) {
    const flat = foundry.utils.flattenObject(changes ?? {});
    return Object.keys(flat)
        .filter(key => key !== "_id" && !key.startsWith("_stats."))
        .some(key => foundry.utils.getProperty(actor, key) !== flat[key]);
}

/** Every open character sheet for this actor. */
function sheetsFor(actor) {
    return Object.values(actor?.apps ?? {})
        .filter(app => app?.document?.type === "character" && app.element);
}

/**
 * Give an instance its own `render` that eats one mark and then behaves.
 *
 * On the INSTANCE rather than on `ApplicationV2.prototype`: this concerns
 * character sheets and nothing else, and a global wrap would put every window
 * in the application through a check that can only ever be true for one kind.
 * An own property shadows the prototype's method for this object alone.
 */
function armRenderGuard(app) {
    if (Object.hasOwn(app, "render")) return;

    const proto = Object.getPrototypeOf(app);
    const original = proto?.render;
    if (typeof original !== "function") return;

    Object.defineProperty(app, "render", {
        configurable: true,
        writable: true,
        value: function(...args) {
            if (skipNextRender.has(this)) {
                skipNextRender.delete(this);
                return Promise.resolve(this);
            }
            return original.apply(this, args);
        }
    });
}

/** Before the write, because the sheet redraws before `updateActor` runs. */
function markResourceOnlyUpdate(actor, changes) {
    try {
        if (!onlyResourceKeys(changes)) return;
        if (!willReallyChange(actor, changes)) return;
        for (const app of sheetsFor(actor)) {
            armRenderGuard(app);
            skipNextRender.add(app);
        }
    } catch (err) {
        // A sheet that renders is the safe failure, so this never rethrows.
        error("Could not mark a resource-only update", err);
    }
}

/**
 * Everything the skipped render would have redrawn, drawn here instead.
 *
 * Two surfaces, because that is how many the three repaintable resources have:
 * the sidebar bars (whose own controls have to be fed from the actor first —
 * see the note above) and the Hope diamonds in the header, which the module
 * paints from `:has(> i.fa-solid)`, so the class on the inner glyph IS the
 * state and toggling it is the whole repaint.
 */
function repaintInPlace(actor, element) {
    for (const bar of element.querySelectorAll(
        ".character-sidebar-sheet .resources-section .status-bar")) {
        const input = bar.querySelector("input.bar-input");
        const progress = bar.querySelector("progress.progress-bar");
        const name = input?.name;
        if (!name) continue;

        const value = Number(foundry.utils.getProperty(actor, name) ?? 0);
        const max = Number(
            foundry.utils.getProperty(actor, name.replace(/\.value$/, ".max"))
            ?? progress?.max ?? 0);

        // The system's own controls, which the render would have rewritten.
        // Left stale they say something untrue right next to a correct bar.
        input.value = String(value);
        if (progress) {
            progress.max = max;
            progress.value = value;
        }
    }

    const hope = Number(foundry.utils.getProperty(actor, "system.resources.hope.value") ?? 0);
    for (const slot of element.querySelectorAll(".hope-section .hope-value")) {
        const n = Number(slot.dataset.value);
        const glyph = slot.querySelector("i");
        if (!glyph || !Number.isFinite(n)) continue;
        glyph.classList.toggle("fa-solid", n <= hope);
        glyph.classList.toggle("fa-regular", n > hope);
    }

    // AND THE CALLS, WHICH ARE WHAT THE NUMBER DECIDES (Dawid, 28.08).
    //
    // The comment on REPAINTABLE says adding a resource here is a promise that
    // this function draws it. `hope` was in the set and this function drew the
    // bar and the pips and stopped — so topping a player up moved the number
    // and left every newly affordable Call greyed out. The render that would
    // have fixed it is the one deliberately skipped to stop the sidebar
    // flickering, which means nothing was ever going to fix it.
    //
    // Same shape as the GM panel's murder tile: half a surface live, half of it
    // a photograph, and no way to tell them apart from the outside.
    refreshCallsPanels(actor, element);

    // AFTER the glyphs, because the mark is counted off them. A repaint stands
    // in for a render and owes what the render owed — including saying that
    // something moved. See `markHopeChange`.
    markHopeChange(actor, element);
}

/**
 * Redraw the Hope and Despair drawers from what the character now holds.
 *
 * Built from the same two functions the injection uses — `affordableHopeCalls`
 * / `despairCallsFor` and `callButton` — so there is one answer to "is this
 * Call available" and one tile that says so, rather than a second copy here
 * that drifts.
 */
function refreshCallsPanels(actor, element) {
    for (const panel of element.querySelectorAll(".drpg-calls-panel")) {
        const monokuma = panel.classList.contains("drpg-despair-panel");
        const held = monokuma ? monokumaPool(actor) : hopeHeld(actor);
        const max = monokuma ? STARTING.despairMax : hopeMax(actor);
        const locked = isEclipse();

        panel.classList.toggle("drpg-silenced", callSilenced(actor));

        const pool = panel.querySelector(".drpg-calls-pool");
        if (pool) pool.textContent = `${held} / ${max}`;

        const grid = panel.querySelector(".drpg-action-grid");
        if (!grid) continue;
        grid.replaceChildren(
            ...(monokuma ? despairCallsFor(held) : affordableHopeCalls(actor))
                .map(call => callButton(call, monokuma, locked)));
    }
}

/** After the write: what the skipped render would have drawn. */
function repaintAfterResourceUpdate(actor, changes) {
    // Shape only. The value test belongs to the hook before this one, and a
    // no-op never reaches here anyway — Foundry does not fire `updateActor`
    // for an update that changed nothing.
    if (!onlyResourceKeys(changes)) return;

    for (const app of sheetsFor(actor)) {
        try {
            repaintInPlace(actor, app.element);
            paintResourceBars(app, app.element);
        } catch (err) {
            error("Could not repaint a resource in place", err);
        }
    }
}

/**
 * @param {object} options  The render's own options. `isFirstRender` is the one
 *   that matters here: it is set by ApplicationV2 itself from the app's state,
 *   and closing a sheet drops that state — so reopening one counts as a first
 *   render again. That is exactly the line the spend flashes need. Without it,
 *   opening a sheet would replay every action spent while it was shut, as
 *   though they had just happened.
 */
/**
 * Run the module's injections with the system's transitions held still.
 *
 * See the SETTLING block in danganronpa.css for the measurement behind this.
 * Short version: Daggerheart puts `transition: all 0.3s` on the sidebar's
 * resource inputs, and everything this file does to a freshly rendered sheet
 * changes their layout — so every redraw animated the whole left column for
 * 300ms. The work is the same; it just stops being a journey.
 *
 * The class comes off on the next frame rather than immediately, and the
 * layout is read back before that to force the style recalculation while it is
 * still on. Without that read the browser can coalesce both changes into one
 * pass and animate after all, which is the version of this fix that looks like
 * it works and does not.
 */
function settle(root, work) {
    if (!root?.classList) return work();

    root.classList.add("drpg-settling");
    try {
        work();
    } finally {
        // Read, to commit the new styles while transitions are still off.
        void root.offsetWidth;
        requestAnimationFrame(() => root.classList.remove("drpg-settling"));
    }
}

function onRenderCharacterSheet(app, element, context, options) {
    try {
        if (app?.document?.type !== "character") return;
        // A first draw has nothing to compare against and nothing to announce.
        const fresh = Boolean(options?.isFirstRender);
        // CSS keys off this to grey out the parts a Monokuma does not use.
        const root = element instanceof HTMLElement ? element : element?.[0];
        root?.classList?.toggle("drpg-monokuma", isMonokuma(app.document));

        settle(root, () => {
            frameTraits(element);
            injectUltimate(app, element);
            injectInitButton(app, element);
            injectAdvanceButton(app, element);
            injectItemButton(app, element);
            injectActionBar(app, element, fresh);
            flashHope(app, element, fresh);
            injectActionPanel(app, element);
            growForCalls(app);
            fitActionTiles(element);
            watchTileFit(element);
            tidySidebar(element);
            paintResourceBars(app, element);
            injectEquippedTools(app, element);
            injectSafeword(app, element);
            tidyBiography(app, element);
            groupInventory(app, element);
            replaceEffectsTab(app, element);
            removeSystemCreators(app, element);
        });
    } catch (err) {
        error("Failed to render the Danganronpa sheet parts", err);
    }
}

/**
 * TAKE THE "+" OUT OF THE DOM, not out of the paint.
 * ---------------------------------------------------------------------------
 * The buttons that create a Feature or an Item by hand have been hidden in the
 * stylesheet for several versions, matched three different ways because the
 * system keeps moving them: `.add-feature`, then `[data-action="createItem"]`,
 * then `legend a[data-action="addNewItem"]`. Each time the markup moved, the
 * button came back — silently, because a rule that matches nothing looks
 * exactly like a rule that is working.
 *
 * Reported back on screen on 2026-08-23, so the approach changes rather than
 * the selector list: whatever this finds is REMOVED. A node that is not there
 * cannot be un-hidden by a system update, a cascade layer or a theme, and the
 * failure mode of removing too little is the same as today rather than worse.
 *
 * WHAT COUNTS AS A CREATOR: an element whose `data-action` is one of the
 * system's create verbs, or one that carries `data-type="feature"`. Matched on
 * a substring so a rename to `addNewItemV2` does not restart this cycle.
 *
 * FEATURES for everybody, INVENTORY for players only — the same split the
 * stylesheet already makes. Features in this game come from the module's own
 * grid, so a hand-made one is noise even for the GM; a GM handing out an item
 * by hand is an ordinary ruling.
 */
const CREATE_ACTIONS = ["addnewitem", "createitem", "createdoc", "additem", "newitem"];

function removeSystemCreators(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    const sections = [
        ...root.querySelectorAll('section[data-application-part="features"], section.tab[data-tab="features"]')
    ];
    if (!game.user.isGM) {
        sections.push(...root.querySelectorAll(
            'section[data-application-part="inventory"], section.tab[data-tab="inventory"]'));
    }

    for (const section of sections) {
        for (const el of section.querySelectorAll("[data-action], [data-type]")) {
            const action = (el.dataset.action ?? "").toLowerCase();
            const type = (el.dataset.type ?? "").toLowerCase();
            const creates = CREATE_ACTIONS.some(verb => action.includes(verb));
            if (!creates && type !== "feature") continue;
            // A creator that is the only child of its legend takes the empty
            // legend with it — otherwise the fieldset keeps a blank caption bar
            // where the button used to be.
            const legend = el.closest("legend");
            if (legend && legend.querySelectorAll("a, button").length === 1) legend.remove();
            else el.remove();
        }
    }
}

/* ==========================================================================
 * TILE FIT
 * --------------------------------------------------------------------------
 * A tile is square by design and its label is floored at 11px, and between
 * those two there is a band of sheet widths where the text simply does not fit.
 * Measured rather than guessed: at a tile width of 84px "Direct Murder" needs
 * 108px of content — an icon, a two-line name and a two-line cost — and the
 * square gives it 84. `overflow: hidden` then cut the cost line off entirely.
 *
 * The obvious test is the wrong one. Nothing overflows HORIZONTALLY — the
 * labels wrap, `scrollWidth` equals `clientWidth` on every button at every
 * width — so a `scrollWidth > clientWidth` check reports a clean sheet while
 * the bottom line of six tiles is missing. The overflow is vertical, and it is
 * the aspect ratio that causes it.
 *
 * Nor is the answer smaller type: the type scale bottoms out at 11px because
 * the pixel face stops being readable below that, and shrinking the label to
 * fit would undo the reason the floor exists.
 *
 * So the square gives way instead, and only where it has to. Each grid is
 * measured; one whose tiles cannot hold their content is marked, and the mark
 * turns off `aspect-ratio` and equalises the rows. Per GRID, not per tile —
 * one rectangle among nine squares reads as a rendering fault, while a grid of
 * slightly tall tiles reads as a grid.
 * ========================================================================== */

/**
 * A tile label with break points marked inside its long words.
 *
 * "Determination" is 143px of pixel font against an 80px tile. It has no space
 * to wrap at, so the only choices are to break it mid-word or to rename a Hope
 * Call the handbook already named — and the handbook wins.
 *
 * `hyphens: auto` is the textbook answer and does not work here: measured on
 * this build with `lang="en"` set on the root, "Determination" stays on one
 * 143px line and is clipped. Foundry's Electron ships no hyphenation
 * dictionary, so the property is inert. `overflow-wrap: anywhere` does break
 * it, but silently — "Observ / e", "Sabota / ge" — which is what the tiles were
 * doing and what looks broken.
 *
 * A soft hyphen is neither: it is a break point the layout engine takes only
 * when it needs to, and it draws a hyphen when it does. Invisible otherwise, so
 * a word that fits is untouched.
 *
 * Only words too long for the narrowest tile are marked, and only from the
 * fifth character, so the break never leaves an orphaned letter or two.
 */
const SHY = "­";
const LONG_WORD = 9;      // characters — below this, every label fits a tile
// Six, not five: it puts the break where the word reads best — "Experi-ence"
// and "Contri-bution" rather than "Exper-ience" and "Contr-ibution".
const BREAK_EVERY = 6;

function softWrap(label) {
    return String(label).split(/(\s+)/).map(part => {
        if (part.length < LONG_WORD || /\s/.test(part)) return part;
        // A word that already carries a hyphen has a break point of its own,
        // and it is a better one than counting to six can find: "Self-defence"
        // was coming out as "Self-d­efence", which reads as a typo rather than
        // as a hyphenation.
        if (part.includes("-")) return part;
        let out = "";
        for (let i = 0; i < part.length; i++) {
            // Never offer a break in the last four characters: "Determinatio-n"
            // is worse than no hyphen at all.
            if (i > 0 && i % BREAK_EVERY === 0 && part.length - i >= 4) out += SHY;
            out += part[i];
        }
        return out;
    }).join("");
}

/** Does any tile in this grid need more room than it has? */
function tileOverflows(grid) {
    for (const tile of grid.querySelectorAll(".drpg-action-button")) {
        // A hidden tile measures zero and would report a false positive.
        if (!tile.clientHeight) continue;

        const style = getComputedStyle(tile);
        const gap = parseFloat(style.rowGap) || 0;
        const needed = [...tile.children]
                .reduce((total, child) => total + child.getBoundingClientRect().height, 0)
            + (parseFloat(style.paddingTop) || 0)
            + (parseFloat(style.paddingBottom) || 0)
            + Math.max(0, tile.children.length - 1) * gap;

        // A pixel of slack: sub-pixel layout noise must not flip the grid.
        if (needed - tile.clientHeight > 1) return true;
    }
    return false;
}

/**
 * Clear the marks, measure, mark again.
 *
 * Both passes run in the same task. Reading `clientHeight` forces the layout
 * synchronously, so the cleared state is measured for real, and nothing is
 * painted in between — the grid does not flicker on its way to the answer.
 * Clearing first is what makes this idempotent: a sheet dragged wider is
 * measured as a square again and drops the mark when it no longer needs it.
 */
function fitActionTiles(element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    const grids = [...root.querySelectorAll(".drpg-action-grid")];
    if (!grids.length) return;

    // ONE SIZE FOR EVERY GRID, and that is the point of doing it here rather
    // than inside the loop. See `fitTileText`.
    fitTileText(grids);

    for (const grid of grids) delete grid.dataset.drpgTight;
    for (const grid of grids) {
        if (tileOverflows(grid)) grid.dataset.drpgTight = "";
    }
}

/*
 * HOW SMALL THE TYPE HAS TO GET FOR THE NAMES TO SURVIVE.
 * --------------------------------------------------------------------------
 * The grid is five across and the tiles are square, which is the shape Dawid
 * chose and the shape a row of tiles should be. At the pixel face that leaves a
 * tile about a hundred pixels of inner width, and the longest label in the game
 * wants more — so the type gives way. It was the column count for half a day
 * (four columns, a sheet widened to 920) and Dawid, 28.08: keep the old size,
 * shrink the names and the costs instead.
 *
 * He is right, and the reason is worth keeping. The column count is a SHAPE —
 * a panel that silently has four tiles where the one below it has five reads as
 * two different interfaces. Type a point smaller reads as nothing at all. When
 * something has to give, it should be the thing nobody can name afterwards.
 *
 * ONE SIZE FOR THE WHOLE MODULE, not one per panel. This measured each grid
 * separately at first, which is worse in the way that is easy to miss: the
 * Actions panel kept 11px while the Hope Calls under it sat at 8, so the same
 * sheet carried two sizes of the same thing and the difference looked like a
 * mistake rather than a fit. Dawid, 28.08: make the actions and the Despair
 * Calls agree with the Hope Calls.
 *
 * So the constraint is the longest word ANY tile in the module can carry —
 * `LONGEST_TILE_WORD`, taken from the definitions themselves — and every grid
 * on the sheet gets the answer. That also makes the size stable: it does not
 * change when a panel happens to be on a hidden tab, and a Monokuma's sheet
 * and a student's come out the same.
 *
 * Measured off the widest WORD, not the widest label: "Dynamic action" has a
 * space and is happy to wrap at it, so only a word with nowhere to break is
 * allowed to push the type down. And with a FLOOR — below about seven pixels
 * the pixel face stops being readable, and an unreadable whole word is worse
 * than a hyphenated one, so `softWrap` goes back to being the last resort it
 * was written to be.
 */
const TILE_TEXT_FLOOR = 0.68;

/**
 * The longest unbreakable word any tile in this module can be asked to draw.
 *
 * From the definitions rather than a constant, so renaming a Call moves this
 * with it — which is exactly what happened on 28.08, when "Determination"
 * became "Resolve" and stopped being the word every other tile was paying for.
 */
const LONGEST_TILE_WORD = (() => {
    const labels = [
        ...Object.values(ACTIONS ?? {}),
        ...Object.values(HOPE_CALLS ?? {}),
        ...Object.values(DESPAIR_CALLS ?? {}),
        MONOCUB?.meddle
    ].map(def => def?.label).filter(Boolean);

    let longest = "";
    for (const label of labels) {
        for (const word of String(label).split(/\s+/)) {
            if (word.length > longest.length) longest = word;
        }
    }
    return longest;
})();

function fitTileText(grids) {
    const live = grids.filter(g => g.querySelector(".drpg-action-button")?.clientWidth);
    if (!live.length) return;

    // Measured at full size, whatever the grids are wearing now. Without this
    // the second pass measures the shrunk type, concludes it fits, and the
    // tiles creep smaller on every resize.
    for (const grid of grids) grid.style.removeProperty("--drpg-tile-text");

    const grid = live[0];
    const tile = grid.querySelector(".drpg-action-button");
    const sample = grid.querySelector(".drpg-action-name");
    if (!tile || !sample) return;

    // The longest word rendered in the real face at the real size, inside the
    // real tile — a probe rather than arithmetic, because the pixel font's
    // advance width is not something to hard-code.
    const probe = sample.cloneNode(false);
    probe.textContent = LONGEST_TILE_WORD;
    probe.style.cssText = "position:absolute;visibility:hidden;width:min-content;white-space:normal";
    tile.appendChild(probe);
    const needed = probe.getBoundingClientRect().width;
    probe.remove();
    if (!needed) return;

    const style = getComputedStyle(tile);
    const room = tile.getBoundingClientRect().width
        - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
        - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0);
    if (room <= 0 || needed <= room) return;

    const scale = Math.max(TILE_TEXT_FLOOR, room / needed).toFixed(3);
    for (const one of grids) one.style.setProperty("--drpg-tile-text", scale);
}

/**
 * Re-fit when the sheet is resized.
 *
 * The width a tile ends up with is not a function of the sheet width alone —
 * the grid drops columns as it narrows, so tiles get SMALLER and then abruptly
 * larger again. There is no width to hard-code; the only honest answer is to
 * measure whenever the box changes.
 */
function watchTileFit(element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root || root.dataset.drpgTileFit) return;
    root.dataset.drpgTileFit = "1";

    // Re-entrancy guard: the fitter changes the height of the very boxes the
    // observer is watching, which would otherwise call it straight back.
    let fitting = false;
    const observer = new ResizeObserver(() => {
        if (fitting) return;
        fitting = true;
        requestAnimationFrame(() => {
            try {
                fitActionTiles(root);
            } finally {
                fitting = false;
            }
        });
    });

    observer.observe(root);
}

/* ==========================================================================
 * TRAIT FRAMES
 * --------------------------------------------------------------------------
 * The purple rectangle around each trait value used to be pure CSS, hung off
 * Daggerheart's `.trait-value-area`. That worked on one install and not on
 * another with the identical stylesheet, which means the selector — not the
 * rule — is what varies: a system build, a UI module or a sheet replacement
 * that renders the trait block under different class names leaves the CSS with
 * nothing to match and no way to say so.
 *
 * So the frame is claimed here instead. The element is found by several routes,
 * tagged with our own class, and styled off that. A class this file puts there
 * cannot be renamed by anyone else, and the fallback below means even a sheet
 * that has no `.trait-value-area` at all still gets framed around whatever holds
 * the number.
 * ========================================================================== */

const TRAIT_AREA_SELECTORS = [
    ".character-header-sheet .character-traits .trait .trait-value-area",
    ".character-traits .trait .trait-value-area",
    ".character-traits .trait-value-area",
    ".trait .trait-value-area"
];

function frameTraits(element) {
    for (const selector of TRAIT_AREA_SELECTORS) {
        const areas = element.querySelectorAll(selector);
        if (!areas.length) continue;
        areas.forEach(area => area.classList.add("drpg-trait-frame"));
        return;
    }

    // Nothing named `trait-value-area` on this sheet. Frame the box the trait
    // number sits in, whatever it is called.
    const values = element.querySelectorAll(".character-traits .trait-value, .trait .trait-value");
    for (const value of values) {
        (value.closest(".trait") ?? value.parentElement ?? value).classList.add("drpg-trait-frame");
    }
}

/* ==========================================================================
 * ACTION BAR + TIME OF DAY
 * --------------------------------------------------------------------------
 * Daggerheart only shows extra resources inside a pop-out tooltip, which is no
 * good for something spent twice per time of day. This draws the budget right
 * next to Hope, with the current time of day beside it.
 * ========================================================================== */

/**
 * Flash the Hope that was just spent.
 *
 * Hope is Daggerheart's own track and this module only restyles it — the pixel
 * diamonds in the stylesheet are masks over the system's markup, not a widget
 * of ours. So the flash is a class added to the system's slots after it has
 * drawn them, which is also why there is nothing to clean up: the sheet rebuilds
 * them from scratch on the next render.
 *
 * The count comes from the DOM rather than from `hopeHeld`, because the DOM is
 * what is being animated. A slot is filled when the system has put a solid
 * glyph in it — the same test the stylesheet's `:has()` makes to choose the
 * filled sprite — so the two cannot disagree about which diamonds are lit.
 */
function flashHope(app, element, fresh = false) {
    markHopeChange(app.document, element, fresh);
}

/**
 * Mark the Hope diamonds that just moved.
 *
 * SPLIT OUT BECAUSE THE FLARE HAD TWO WAYS IN AND ONLY ONE OF THEM WORKED.
 *
 * E4's flicker fix skips the whole render for an update that touches nothing
 * but a repaintable resource, and `repaintInPlace` draws what the render would
 * have drawn. It drew the diamonds correctly and never announced the change:
 * Hope moved, the pip count followed, and nothing flashed. The comment there
 * called toggling the glyph "the whole repaint", which was the mistake — the
 * mark is part of what a render does, and a repaint that stands in for a render
 * owes everything the render owed.
 *
 * `spentSince` is called even on a first draw, and only the MARKING is skipped:
 * a surface that never learned where the count started would flash the whole
 * difference on its second draw.
 */
function markHopeChange(actor, element, fresh = false) {
    const slots = element?.querySelectorAll?.(
        ".character-header-sheet .hope-section .hope-value") ?? [];
    if (!slots.length) return;

    const held = Array.from(slots).filter(s => s.querySelector("i.fa-solid")).length;
    const spent = spentSince("sheet:hope", actor.id, held);
    if (fresh || !spent) return;

    /*
     * WIPE THE LAST MARK BEFORE MAKING A NEW ONE.
     *
     * `markSpent` adds a class and never takes it off, which was always true
     * and never mattered: a render builds new elements, so the mark went with
     * the old ones. Since E4 a Hope change SKIPS the render — `repaintInPlace`
     * stands in for it — and these same six diamonds live on across every
     * change. Two things then went wrong at once, and together they are
     * exactly "it does not fire and it shows the wrong thing":
     *
     *   the class stayed, so a pip spent an hour ago still read as spent, and a
     *   pip that was spent and later regained carried BOTH marks;
     *
     *   and adding a class an element already has does not restart a CSS
     *   animation, so the second spend of the same diamond flashed nothing.
     *
     * Cleared on every slot rather than only the ones about to be marked: the
     * stale mark is on whichever pips moved LAST time, which is not the set
     * moving now. The read of `offsetWidth` is what makes the browser commit the
     * removal, so re-adding counts as a change and the animation runs again.
     */
    for (const slot of slots) {
        slot.classList.remove("drpg-spent", "drpg-gained");
        slot.style.removeProperty("animation-delay");
        slot.style.removeProperty("--drpg-spent-age");
    }
    void slots[0].offsetWidth;

    for (let i = spent.from; i <= Math.min(spent.to, slots.length); i++) {
        markSpent(slots[i - 1], spent, i);
    }
}

function injectActionBar(app, element, fresh = false) {
    const row = element.querySelector(".character-header-sheet .character-row");
    if (!row || row.querySelector(".drpg-actions-section")) return;

    const actor = app.document;
    const left = actionsLeft(actor);
    const max = actionsMax(actor);
    const { wounded } = actionBudget(actor);

    // What went out since this sheet last drew itself. Recorded even when it is
    // not shown — a first draw still has to know where the count started, or
    // the NEXT draw would flash the whole difference.
    const spentActions = spentSince("sheet:actions", actor.id, left);
    const spentMove = spentSince("sheet:move", actor.id, hasFreeMove(actor) ? 1 : 0);

    const section = document.createElement("div");
    section.className = "drpg-actions-section";

    /* ---- action pips ---- */
    const actions = document.createElement("div");
    actions.className = "drpg-actions";

    const label = document.createElement("h4");
    label.textContent = game.i18n.localize("DRPG.Actions.label");
    if (wounded) {
        label.classList.add("drpg-wounded");
        label.dataset.tooltip = game.i18n.localize("DRPG.Actions.woundedTooltip");
    }
    actions.append(label);

    // Always draw the full base budget. A wounded character keeps both circles,
    // but the one they have lost shows as a locked red slot — clearer than
    // silently rendering "1 / 1", which reads like an action already spent.
    const budget = Math.max(max, 1);
    for (let i = 1; i <= Math.max(STARTING.actions, budget); i++) {
        const locked = i > budget;
        const filled = !locked && i <= left;

        const pip = document.createElement("span");
        pip.className = `drpg-action-pip${filled ? " filled" : ""}${locked ? " locked" : ""}`;
        // The pips between the old reading and the new one: the ones just paid.
        // Built empty like any other unspent socket; the mark only says how
        // they got that way. See the keyframes in the stylesheet.
        markSpent(pip, fresh ? null : spentActions, i);
        pip.dataset.value = String(i);
        pip.innerHTML = `<i class="fa-${filled ? "solid" : "regular"} fa-circle" inert></i>`;

        if (locked) {
            pip.dataset.tooltip = game.i18n.localize("DRPG.Actions.lockedTooltip");
        } else if (game.user.isGM) {
            // GM only: players spend actions by taking actions, not by clicking.
            pip.classList.add("gm-editable");
            pip.dataset.tooltip = game.i18n.format("DRPG.Actions.pipTooltip", { n: i });
            // A `<span>` with a click handler is invisible to the keyboard, and
            // this is the only way a GM corrects somebody's budget by hand.
            pip.tabIndex = 0;
            pip.setAttribute("role", "button");
            pip.setAttribute("aria-label", game.i18n.format("DRPG.Actions.pipTooltip", { n: i }));
            const set = () => setActions(actor, i === left ? i - 1 : i);
            pip.addEventListener("click", set);
            pip.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                set();
            });
        } else {
            pip.dataset.tooltip = game.i18n.format("DRPG.Actions.pipReadOnly", { left, max: budget });
        }
        actions.append(pip);
    }

    /* ---- free move ---- */
    const move = document.createElement("span");
    const freeMove = hasFreeMove(actor);
    move.className = `drpg-free-move${freeMove ? " available" : " spent"}`;
    markSpent(move, fresh ? null : spentMove);
    move.dataset.tooltip = game.i18n.localize(
        freeMove ? "DRPG.Actions.freeMoveAvailable" : "DRPG.Actions.freeMoveSpent"
    );
    // Solid while it is there, OUTLINED once it is gone — the same pair the
    // action pips use (`fa-solid fa-circle` / `fa-regular fa-circle`), so a
    // spent Move and a spent action say the same thing in the same way. Foundry
    // ships Font Awesome Pro, which carries every icon in both weights.
    move.innerHTML = `<i class="fa-${freeMove ? "solid" : "regular"} fa-shoe-prints" inert></i>`;
    actions.append(move);

    section.append(actions);

    /* ---- a Call waiting on the next roll ---- */
    //
    // Until now the only place an armed Call was visible was inside the roll
    // window. That is too late twice over: a player who has banked a Free
    // Critical forgets it is there, and a player a Monokuma has just saddled
    // with Obstacle has no idea until the dice are already in front of them.
    //
    // BESIDE the pips, not below them.
    //
    // Underneath, the badge pushed the whole header down and read as a footnote
    // to the action count. What it actually is, is the other half of the same
    // sentence: this is what you have, and this is what is riding on your next
    // roll. Side by side is where a player reads them together.
    //
    // A column, not a single slot: a Hope Call the player armed and a Despair
    // Call or a Monocub's Meddle landing on them are two different facts about
    // the same turn, and the layout has room for both stacked without moving
    // anything else.
    const stack = document.createElement("div");
    stack.className = "drpg-pending-stack";

    // WHAT IS ON THEM NOW, not only what is riding on the next roll.
    //
    // The badge shipped in 17.5 read `pendingCall` and nothing else, so it
    // showed the half of this that is about dice and silently dropped the half
    // that is about the rest of the turn. Silenced and chained do not arrive
    // through `pendingCall` at all — they live in the world's `restrictions`
    // setting — and a Monocub silenced for the chapter is a flag on the actor.
    // A player under all three saw an empty corner.
    //
    // Same pink treatment as a Despair Call: these are all things done TO them.
    for (const effect of standingEffects(actor)) {
        const badge = document.createElement("div");
        badge.className = "drpg-pending-call drpg-pending-despair";
        badge.dataset.tooltip = game.i18n.localize(effect.tooltip);
        badge.innerHTML = `<i class="fa-solid ${effect.icon}" inert></i>
                           <span>${foundry.utils.escapeHTML(game.i18n.localize(effect.label))}</span>`;
        stack.append(badge);
    }

    const pending = actor.getFlag(MODULE_ID, FLAGS.pendingCall);
    for (const entry of (Array.isArray(pending) ? pending : [pending]).filter(p => p?.grants)) {
        const despair = entry.kind === "despair";
        // The badge wears the CALL'S NAME — "Determination", "Obstacle" — not
        // the grant phrase behind it. The phrases were written for sentences
        // ("waiting on your next roll: …") and did not fit the sheet, which is
        // exactly where Dawid met "a statistic of their choice" overflowing
        // its badge. The armed entry has carried the call's key all along; the
        // phrase stays as the fallback for an entry old enough not to.
        const call = (despair ? DESPAIR_CALLS : HOPE_CALLS)[entry.key];
        const label = call?.label ?? game.i18n.localize(`DRPG.Calls.grants.${entry.grants}`);
        const badge = document.createElement("div");
        badge.className = `drpg-pending-call drpg-pending-${despair ? "despair" : "hope"}`;
        badge.dataset.tooltip = game.i18n.format("DRPG.Calls.pendingTooltip", {
            what: game.i18n.localize(`DRPG.Calls.grants.${entry.grants}`)
        });
        badge.innerHTML = `<i class="fa-solid ${despair ? "fa-skull" : "fa-hand-sparkles"}" inert></i>
                           <span>${foundry.utils.escapeHTML(label)}</span>`;
        stack.append(badge);
    }
    if (stack.children.length) section.append(stack);

    // Sit right after Hope, before the domains/downtime buttons.
    const hope = row.querySelector(".resource-section");
    if (hope) hope.after(section);
    else row.prepend(section);
}

/**
 * Restrictions currently in force on this character.
 *
 * Three separate stores, because they are three separate rules with three
 * separate lifetimes, and merging them would be a lie about how long each one
 * lasts:
 *
 *   silenced (Call)   world `restrictions`, until the clock moves
 *   chained           world `restrictions`, until the clock moves
 *   silenced (cub)    a flag on the actor, for the rest of the chapter
 *
 * Read rather than cached: all three can be lifted by somebody else's screen
 * between one render of this sheet and the next.
 */
function standingEffects(actor) {
    const out = [];
    if (!actor) return out;

    if (callSilenced(actor)) {
        out.push({ icon: "fa-comment-slash", label: "DRPG.Calls.silencedBadge",
                   tooltip: "DRPG.Calls.silencedNotice" });
    }
    if (isChained(actor)) {
        out.push({ icon: "fa-link", label: "DRPG.Calls.chainedBadge",
                   tooltip: "DRPG.Calls.chainedNotice" });
    }
    // The Monocub's is a different silence — it is about speaking at the table,
    // not about spending Hope — so it says so rather than sharing a label.
    if (cubSilenced(actor)) {
        out.push({ icon: "fa-user-slash", label: "DRPG.Monocub.silencedBadge",
                   tooltip: "DRPG.Monocub.silencedTooltip" });
    }
    return out;
}

/* ==========================================================================
 * STARTING RESOURCES
 * --------------------------------------------------------------------------
 * Daggerheart derives max Health and Sanity from a class, and this game has no
 * classes — so `initCharacter` is the only thing that ever writes them. Until
 * it runs, a fresh student reads `max: 0` on both tracks, which means
 * `remaining() <= 0` on both: Wounded AND Breakdown, one action instead of two,
 * and disadvantage forced onto every roll. Every one of those is correct
 * behaviour for a character who has been through something; none of it is
 * correct for a character who has not been set up yet.
 *
 * The button only exists while that is true, so it is a warning as much as a
 * control: a sheet showing it is a sheet that is not ready to play, and it
 * disappears the moment it is used.
 * ========================================================================== */

/** Has this character been given the guide's starting resources? */
function needsInit(actor) {
    return resourceMax(actor, "hitPoints") !== STARTING.hp
        || resourceMax(actor, "stress") !== STARTING.stress;
}

function injectInitButton(app, element) {
    if (!game.user.isGM) return;
    const actor = app.document;
    // A Monokuma has no tracks worth setting — `setMonokuma` deliberately zeroes
    // what a student uses, so this would light up permanently on the GM's own sheet.
    if (isMonokuma(actor)) return;
    if (!needsInit(actor)) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-init]")) return;

    const tip = game.i18n.format("DRPG.Character.initTooltip", {
        hp: STARTING.hp, stress: STARTING.stress, hope: STARTING.hope
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-advance-button drpg-init-button";
    button.dataset.drpgInit = "";
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid fa-wand-sparkles" inert></i>`;

    button.addEventListener("click", async () => {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("DRPG.Character.initTitle") },
            classes: ["drpg-panel", "drpg-narrow"],
            content: `<p>${game.i18n.format("DRPG.Character.initConfirm", {
                actor: foundry.utils.escapeHTML(actor.name),
                hp: STARTING.hp, stress: STARTING.stress, hope: STARTING.hope
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Character.initNote")}</p>`,
            rejectClose: false
        });
        if (!confirmed) return;

        await initCharacter(actor);
        // The two conditions key off the tracks this just wrote, so they have to
        // be re-derived rather than left showing the pre-init state.
        const { syncStates } = await import("./states.mjs");
        await syncStates(actor).catch(() => {});
        app.render(false);
    });

    nameRow.append(button);
}

/* ==========================================================================
 * ADVANCEMENT BUTTON
 * --------------------------------------------------------------------------
 * The Daggerheart level pill is hidden, so advancement needs its own way in.
 * A button on the sheet beats a macro the GM has to install by hand.
 * ========================================================================== */

function injectAdvanceButton(app, element) {
    if (!game.user.isGM) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-advance]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-advance-button";
    button.dataset.drpgAdvance = "";
    button.dataset.tooltip = game.i18n.localize("DRPG.Advance.buttonTooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.Advance.buttonTooltip"));
    button.innerHTML = `<i class="fa-solid fa-angles-up" inert></i>`;

    button.addEventListener("click", async () => {
        const { openAdvancementFor } = await import("./level-up.mjs");
        await openAdvancementFor(app.document);
    });

    nameRow.append(button);
}

/* ==========================================================================
 * GIVE / TAKE ITEMS
 * --------------------------------------------------------------------------
 * Right where the GM is already looking when they decide somebody should have
 * something — or should stop having it.
 * ========================================================================== */

function injectItemButton(app, element) {
    if (!game.user.isGM) return;
    if (isMonokuma(app.document)) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-items]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-advance-button drpg-items-button";
    button.dataset.drpgItems = "";
    button.dataset.tooltip = game.i18n.localize("DRPG.Items.buttonTooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.Items.buttonTooltip"));
    button.innerHTML = `<i class="fa-solid fa-box-open" inert></i>`;

    button.addEventListener("click", async () => {
        const { openItemManager } = await import("./gm-items.mjs");
        await openItemManager(app.document);
    });

    nameRow.append(button);
}

/* ==========================================================================
 * ULTIMATE
 * ========================================================================== */

function injectUltimate(app, element) {
    const details = element.querySelector(".character-header-sheet .character-details");
    if (!details) return;

    const actor = app.document;
    const ultimate = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
    const editable = app.isEditable;

    details.classList.add("drpg-ultimate");
    details.replaceChildren(buildUltimateRow(ultimate, editable));

    if (!editable) return;

    const field = details.querySelector("[data-drpg-ultimate]");
    if (!field) return;

    // Commit on blur, and let Enter mean "done" rather than "new line".
    field.addEventListener("blur", () => commitUltimate(actor, field));
    field.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            field.blur();
        } else if (event.key === "Escape") {
            event.preventDefault();
            field.textContent = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
            field.blur();
        }
    });
}

function buildUltimateRow(ultimate, editable) {
    const row = document.createElement("div");
    row.className = "drpg-ultimate-row";

    const label = document.createElement("span");
    label.className = "drpg-ultimate-label";
    label.textContent = game.i18n.localize("DRPG.Sheet.ultimateLabel");
    row.append(label);

    const value = document.createElement("span");
    value.className = "drpg-ultimate-value";
    // textContent, never innerHTML — this string is player-supplied.
    value.textContent = ultimate;
    value.dataset.drpgUltimate = "";
    value.dataset.placeholder = game.i18n.localize("DRPG.Sheet.ultimatePlaceholder");

    if (editable) {
        value.contentEditable = "plaintext-only";
        value.spellcheck = false;
        value.setAttribute("role", "textbox");
        value.setAttribute("aria-label", game.i18n.localize("DRPG.Sheet.ultimateLabel"));
    }

    row.append(value);
    return row;
}

async function commitUltimate(actor, field) {
    const next = field.textContent.trim();
    const current = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
    if (next === current) return;

    try {
        await actor.setFlag(MODULE_ID, FLAGS.ultimate, next);
        debug(`Ultimate for ${actor.name} set to "${next}".`);
    } catch (err) {
        error("Could not save the Ultimate", err);
        field.textContent = current;
    }
}

/* ==========================================================================
 * SIDEBAR
 * --------------------------------------------------------------------------
 * "Equipment" becomes "Equipped" — in this game the word equipment means the
 * whole inventory, and the sidebar block only lists what is in hand. Loadout is
 * removed outright: it holds domain cards, which do not exist here.
 * ========================================================================== */

function tidySidebar(element) {
    const sidebar = element.querySelector(".character-sidebar-sheet");
    if (!sidebar) return;

    // Structural selectors first — the template's own `.equipment-section` and
    // `.loadout-section` wrappers, not the English caption text they happen to
    // render today. Matching by text meant a language pack translating
    // "Equipment"/"Loadout" would silently stop this from finding either block;
    // the system has only ever shipped English, so that never surfaced, but it
    // was one `lang/*.json` away from failing quietly. The text match is kept
    // as a fallback for a template that renders without those wrapper classes.
    const equipment = sidebar.querySelector(".equipment-section h3")
        ?? findHeadingByText(sidebar, "equipment");
    if (equipment && !equipment.dataset.drpgRenamed) {
        equipment.textContent = game.i18n.localize("DRPG.Sheet.equipped");
        equipment.dataset.drpgRenamed = "1";
    }

    const loadoutHeading = sidebar.querySelector(".loadout-section h3") ?? findHeadingByText(sidebar, "loadout");
    const loadoutBlock = loadoutHeading?.closest(".loadout-section, section, fieldset") ?? loadoutHeading?.parentElement;
    loadoutBlock?.classList.add("drpg-hidden-block");
}

/**
 * Publish how full each resource bar is, so the stylesheet can draw it.
 *
 * Health and Sanity are `<progress>` elements, and the module styles them with
 * `appearance: none` to get rid of the platform look. That switch also removes
 * the element's native shadow DOM, which is where `::-webkit-progress-value`
 * lives — so the fill cannot be coloured from CSS at all. The rules for it were
 * being written and silently discarded, which is why both bars kept whatever
 * the system had painted.
 *
 * The fill is a plain background gradient instead, and the only thing CSS
 * cannot work out for itself is where to stop it: `value` and `max` are
 * attributes, and there is no `attr()` in a background position. So the ratio
 * is written here as a custom property and the stylesheet does the rest.
 *
 * Both are reverse resources in this game — `value` counts what has been
 * MARKED, not what is left — so a bar at 100% is a student out of road.
 */
/**
 * Health and Sanity as one flat bar apiece, filled by proportion.
 *
 * These were pips for a while — countable points, one per mark — and Dawid
 * asked for the bar back (26.08): a plain rectangle that fills the fraction of
 * itself the numerals beside it already state. Flat and square, drawn by this
 * module rather than by Daggerheart's `<progress>`, because `appearance: none`
 * on a progress element removes the shadow DOM its fill lives in and the fill
 * then cannot be coloured from CSS at all — which is the bug the pips were
 * originally routed around. Two spans obey a stylesheet; a progress element
 * argues with one.
 *
 * Both are REVERSE resources: `value` is what has been MARKED, not what is
 * left, so a bar at 100% is a student out of road.
 *
 * WHICH ROW IS WHICH, WITHOUT COUNTING ROWS. The stylesheet reaches these two
 * through `:nth-child(1)` and `:nth-child(2)` — the risk the audit flagged —
 * but script does not have to: each row carries an input whose `name` is
 * `system.resources.<key>.value`, which says what it is no matter what order
 * the system renders them in or what a future version puts between them.
 *
 * THE FLARE IS THE ONE THE PIPS HAD, aimed at the piece that changed. A pip
 * that went out flashed; here the BAND between the old fill and the new one
 * flashes, in the same colours, on the same beat, resuming mid-animation on a
 * redraw exactly as a pip did (`markSpent` carries the age). `spentSince`
 * counts what is HELD, which for a reverse resource is the capacity still
 * unmarked — so its `from`/`to` are mirrored back into marked units here.
 *
 * The system's own controls are untouched. The number input, its `/`, the max
 * and the +/- it wires up all stay exactly where they were; only the bar is
 * hidden, and it is hidden rather than removed so nothing the system does to
 * it later lands on a missing element.
 */
function paintResourceBars(app, element) {
    const actorId = app?.document?.id ?? null;

    for (const bar of element.querySelectorAll(".character-sidebar-sheet .resources-section .status-bar")) {
        const progress = bar.querySelector("progress.progress-bar");
        if (!progress) continue;

        const max = Number(progress.max) || 0;
        const value = Math.max(0, Math.min(max, Number(progress.value) || 0));

        // Kept fed: a stale percentage on a bar that comes back is a wrong bar.
        const pct = max > 0 ? (value / max) * 100 : 0;
        progress.style.setProperty("--drpg-bar-pct", `${pct}%`);

        bar.querySelectorAll(".drpg-resource-pips").forEach(el => el.remove());

        const key = bar.querySelector("input.bar-input")?.name
            ?.match(/resources\.([A-Za-z]+)\./)?.[1] ?? null;

        if (!key || max < 1) {
            progress.classList.remove("drpg-bar-replaced");
            bar.querySelectorAll(".drpg-resource-bar").forEach(el => el.remove());
            continue;
        }
        progress.classList.add("drpg-bar-replaced");

        const held = max - value;
        const change = actorId ? spentSince(`resource:${key}`, actorId, held) : null;

        /*
         * THE BAR IS UPDATED, NOT REBUILT — AND THAT IS THE REST OF THE FLICKER.
         *
         * Skipping the sheet's re-render (see THE FLICKER above) removed most
         * of the blink and left a shorter one, which is what Dawid reported.
         * A MutationObserver over one Health change found the whole of what was
         * left: `div.drpg-resource-bar` removed and re-added, twice — once per
         * bar. A brand-new element has no previous width to travel from, so its
         * transition has nothing to animate and the fill snaps into place.
         *
         * Keeping the element and moving its width is what makes the change a
         * movement instead of a replacement. On a full render there is nothing
         * to reuse and this builds one exactly as before.
         */
        for (const stale of bar.querySelectorAll(".drpg-resource-bar")) {
            if (stale.dataset.resource !== key) stale.remove();
        }

        let track = bar.querySelector(".drpg-resource-bar");
        let fill = track?.querySelector(".drpg-resource-fill") ?? null;

        if (!track || !fill) {
            track?.remove();
            track = document.createElement("div");
            track.className = "drpg-resource-bar";
            fill = document.createElement("span");
            fill.className = "drpg-resource-fill";
            track.append(fill);
            progress.after(track);
        }

        // The band from last time goes whatever happens: it describes a change
        // that is no longer the most recent one.
        track.querySelectorAll(".drpg-resource-delta").forEach(band => band.remove());

        track.dataset.resource = key;
        track.dataset.value = String(value);
        track.dataset.max = String(max);
        fill.style.width = `${pct}%`;

        // The band that just changed, laid over the fill.
        //
        // `spentSince` counts HELD sockets and reports the range of them that
        // moved; the bar is drawn in MARKED units, and the two run in opposite
        // directions — held socket `h` is marked slot `max - h + 1`. So the
        // range flips end for end: held [from..to] is marked
        // [max - to + 1 .. max - from + 1], which is the band that just changed
        // colour whichever way it went.
        if (change) {
            const lo = max - change.to + 1;
            const hi = max - change.from + 1;
            const from = Math.max(0, lo - 1);
            const to = Math.min(max, hi);
            if (to > from) {
                const band = document.createElement("span");
                band.className = "drpg-resource-delta";
                band.style.left = `${(from / max) * 100}%`;
                band.style.width = `${((to - from) / max) * 100}%`;
                // Same helper the pips used, so the class, the resume offset
                // and the "is this one of the ones that moved" test are all
                // the module's one implementation rather than a second copy.
                markSpent(band, change, change.from);
                track.append(band);
            }
        }
    }
}

/**
 * Put the readied Crime and Cleaning Tool into the sidebar's Equipped list.
 *
 * That list is Daggerheart's `equippedItems`, which means its own weapons and
 * armour. This module's tools are `loot` with a category flag, so nothing put
 * them there — and "Equipped" showing everything except the two things the
 * module calls equipped is worse than not renaming the heading at all. It also
 * made the one mechanic that now depends on readying something (see
 * `equippedWeapon` in murder.mjs) invisible in the place a player looks to
 * check it.
 *
 * Rows are built to match `daggerheart.inventory-item-compact` — same classes,
 * same order — so they inherit the system's styling instead of needing a
 * parallel set of rules that would drift from it.
 */
/**
 * A row about something that has stopped existing (trap 91).
 *
 * A SILENT STEAL LEAVES ONE. `stealFromPerson` deletes the item with
 * `render: false` so the victim's open sheet does not redraw for it — the thing
 * has really gone, and what is suppressed is the refresh. Until something else
 * redraws the sheet the row is still on screen, and every control on it is
 * pointing at a document that is not there: readying it, using it, handing it
 * over, opening its sheet. An exception in the victim's console is a worse
 * notification than the notification it was avoiding.
 *
 * Registered in the CAPTURE phase on the row itself, so it runs before the
 * row's own listener AND before any button inside it — one guard covering
 * seven controls, rather than seven guards that could drift apart.
 *
 * And it is not only about theft. A GM taking something away by hand, a Reroll
 * unwinding a Search, an item spent on another client: every one of them can
 * leave a row behind for a moment. This is what that moment does.
 */
function guardRow(li, item, app) {
    li.addEventListener("click", event => {
        if (item?.actor?.items?.get(item.id)) return;

        event.stopPropagation();
        event.preventDefault();
        li.remove();
        ui.notifications.info(game.i18n.format("DRPG.Items.rowGone", {
            item: item?.name ?? "?"
        }));
        // Which is how they find out. The rule was always "not until they look
        // again" — this IS looking again.
        app?.render(false);
    }, true);
}

function injectEquippedTools(app, element) {
    const actor = app.document;
    if (isMonokuma(actor)) return;

    const list = element.querySelector(".character-sidebar-sheet .equipment-section .items-sidebar-list");
    if (!list) return;

    // Rebuilt every render, like the action panels: what is readied changes and
    // a stale row is a lie about what is in the character's hand.
    list.querySelectorAll("[data-drpg-equipped], .drpg-equipped-empty").forEach(row => row.remove());

    let readied = 0;
    for (const category of EQUIPPABLE) {
        const item = equippedIn(actor, category);
        if (!item) continue;
        readied++;

        const tier = item.getFlag(MODULE_ID, "tier");
        const li = document.createElement("li");
        li.className = "inventory-item inventory-item-compact drpg-equipped-tool";
        li.dataset.drpgEquipped = category;
        li.dataset.itemId = item.id;
        li.dataset.itemUuid = item.uuid;
        li.draggable = false;
        li.innerHTML = `
            <div class="img-portait" data-tooltip="#item#${item.uuid}">
                <img src="${item.img}" class="item-img" alt="" />
            </div>
            <span class="item-name">${foundry.utils.escapeHTML(item.name)}</span>
            <div class="item-labels"><div class="label">${
                foundry.utils.escapeHTML(ITEM_CATEGORIES[category]?.label ?? category)
            }${tier !== undefined && tier !== null ? ` — T${tier}` : ""}</div></div>`;

        guardRow(li, item, app);
        li.addEventListener("click", event => {
            if (event.target.closest("[data-drpg-row-action]")) return;
            item.sheet?.render(true);
        });

        list.append(li);
    }

    // Daggerheart's own rows in this list are hidden by CSS — "Equipped" here
    // means the two things this game lets you ready, not the system's weapons
    // and armour. That leaves an empty box when nothing is readied, so say so,
    // and say why it matters rather than just that it is empty.
    if (!readied) {
        const empty = document.createElement("li");
        empty.className = "drpg-equipped-empty";
        empty.textContent = game.i18n.localize("DRPG.Items.noneReadied");
        list.append(empty);
    }
}

/**
 * The safeword, bottom-left of the sheet.
 *
 * On the sheet rather than in the HUD or a floating launcher for one reason:
 * the sheet is the window a player already has open and already looks at, and
 * the moment this is needed is not the moment to go hunting for a control.
 *
 * Present for everyone — a Monokuma's player is at the same table, and a
 * character who died an hour ago does not stop being someone's evening.
 * Anchored to the window content, so it does not depend on Daggerheart's
 * internal layout holding still.
 */
function injectSafeword(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const host = root?.querySelector(".window-content") ?? root;
    if (!host) return;

    host.querySelector(".drpg-safeword-button")?.remove();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-safeword-button";
    button.dataset.tooltip = game.i18n.localize("DRPG.Safeword.tooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.Safeword.tooltip"));
    /*
     * THE WORD IS THE TABLE'S, NOT THE MODULE'S (E15).
     *
     * It used to be `DRPG.Safeword.word` — a string in the language file, and
     * therefore one word for everybody who installs this. That is wrong for the
     * one control in the module whose whole job is to be reached without
     * thinking: a table that has never met this group's in-joke reads an
     * unfamiliar word and hesitates, and the hesitation is precisely what the
     * button exists to remove.
     *
     * Read at render rather than cached, and the setting's `onChange` redraws
     * every open sheet — otherwise the button would keep offering the old word
     * to everyone who has not reopened their character since it changed.
     */
    button.innerHTML = `<i class="fa-solid fa-hand" inert></i>
        <span>${foundry.utils.escapeHTML(safeword())}</span>`;

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const { safewordDialog } = await import("./safeword.mjs");
        await safewordDialog(app.document);
    });

    host.append(button);
}

/** Fallback when the structural class cannot be found: match the caption text. */
function findHeadingByText(root, text) {
    for (const heading of root.querySelectorAll("h3, .title h3, .title")) {
        if (heading.textContent.trim().toLowerCase() === text) return heading;
    }
    return null;
}

/**
 * Biography: the guide asks for three sentences of backstory. Pronouns, Age,
 * Faith and Connections belong to a different game.
 *
 * Structural first: pronouns/age/faith are `system.biography.characteristics.*`
 * fields and connections is `system.biography.connections`, so every one of
 * them can be found by its `name` attribute regardless of what language the
 * caption next to it is rendered in. That match climbs to `.input` — the actual
 * wrapper the characteristics fields sit in — rather than the `fieldset`/
 * `.form-group` this used to look for and never found there, which is exactly
 * how "hiding the input alone left the word floating on its own" happened: the
 * caption's wrapper was never being hidden at all, only whatever `.closest()`
 * happened to land on.
 *
 * The caption-text match stays as a fallback for a template that renders these
 * fields under different names.
 */
const BIOGRAPHY_CUTS = ["pronouns", "age", "faith", "connections"];
const BIOGRAPHY_ANCESTORS = "fieldset, .form-group, .biography-field, .input, label";

/**
 * HTML to something a textarea can hold, keeping the line breaks.
 *
 * One direction only, and never written back on its own: a field that has held
 * formatting since before this change keeps holding it until somebody edits it,
 * and what they see meanwhile is the text without the markup. Flattening on
 * open would be this module rewriting a player's backstory because they looked
 * at it.
 */
function plainBiography(html) {
    if (!html) return "";
    const box = document.createElement("div");
    box.innerHTML = String(html)
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n");
    return (box.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function tidyBiography(app, element) {
    const tab = element.querySelector('section[data-application-part="biography"]');
    if (!tab) return;

    /*
     * THREE SENTENCES OF BACKSTORY DO NOT NEED BOLD.
     *
     * The field arrives as a `<prose-mirror>` with its own edit toggle: an
     * editor to open, a toolbar to read, and a save step to remember, for a
     * paragraph. It becomes a textarea that writes itself on `focusout` —
     * exactly how the item tables edit their rows and how the pre-session note
     * already works, so this is the module's one way of editing text rather
     * than a third one.
     *
     * The toggle goes with it because it lives INSIDE the element being
     * replaced. Nothing is left to restyle, which is a better outcome than the
     * plan's — that asked for the button to be re-dressed in the module's own
     * skin, and a button nobody needs is better removed than repainted.
     */
    const actor = app?.document ?? null;
    const editor = tab.querySelector('prose-mirror[name="system.biography.background"]');

    if (actor && editor) {
        const area = document.createElement("textarea");
        area.name = "system.biography.background";
        area.className = "drpg-biography-text";
        area.rows = 8;
        area.value = plainBiography(
            foundry.utils.getProperty(actor, "system.biography.background"));
        area.placeholder = game.i18n.localize("DRPG.Sheet.biographyPlaceholder");

        area.addEventListener("focusout", () => {
            const next = area.value.trim();
            const now = plainBiography(
                foundry.utils.getProperty(actor, "system.biography.background"));
            // Nothing typed is not a save. Compared against the FLATTENED
            // current value, so merely opening a formatted backstory and
            // clicking away does not rewrite it.
            if (next === now) return;

            actor.update({ "system.biography.background": next })
                .catch(err => error("Could not save the backstory", err));
        });

        editor.replaceWith(area);
    }

    // Every characteristics field, plus connections, found by name.
    for (const field of tab.querySelectorAll('[name*="characteristics"], [name*="connections"]')) {
        (field.closest(BIOGRAPHY_ANCESTORS) ?? field).classList.add("drpg-hidden-block");
    }

    // Fallback: anything whose own text is one of the unwanted captions, for a
    // template shape the name-based pass above did not anticipate.
    for (const node of tab.querySelectorAll("h1, h2, h3, h4, label, legend, span, div")) {
        const text = node.textContent?.trim().toLowerCase().replace(/[:*]/g, "");
        if (!text || text.length > 12) continue;
        if (!BIOGRAPHY_CUTS.includes(text)) continue;

        // Take the labelled block, not just the caption.
        const block = node.closest(BIOGRAPHY_ANCESTORS) ?? node;
        block.classList.add("drpg-hidden-block");
        // The input usually sits next to the caption rather than inside it.
        const sibling = block.nextElementSibling;
        if (sibling && sibling.querySelector?.("input, select, textarea, [contenteditable]")) {
            sibling.classList.add("drpg-hidden-block");
        }
    }
}

/* ==========================================================================
 * INVENTORY GROUPS
 * --------------------------------------------------------------------------
 * The guide's inventory is three capped categories, not one flat list. Items
 * carry their category as a flag, so they are sorted into labelled groups with
 * the carry limit shown — a player should be able to see "Weapons 1/1" without
 * counting.
 * ========================================================================== */

/*
 * ONE ROW FOR EVERYTHING YOU HOLD (E9, Dawid 27.08).
 *
 * E8 gave the three gear categories one shared budget of three, which left the
 * sheet drawing the same "2 / 3" three times under three headings — three
 * statements of one fact, and a player reading "1 / 3" over a full inventory in
 * three places has been told three contradictory things by one window.
 *
 * So they become one row, and what an item IS moves onto the item, as tags.
 * The category has not gone anywhere: it is still the key to the search table,
 * to Stage 6's confiscation and to the item manager. It is simply no longer
 * what decides which heading a thing sits under.
 */
const GEAR_GROUP = "gear";

const INVENTORY_GROUPS = [
    { key: "usable", labelKey: "DRPG.Sheet.groupUsables" },
    { group: GEAR_GROUP, labelKey: "DRPG.Sheet.groupGear" },
    { key: "truthBullet", labelKey: "DRPG.Sheet.groupTruthBullets" },
    // Last, under the evidence: a key is not something you found or made, it is
    // something a door means. See the note on keys in vault.mjs.
    { key: "bedroomKey", labelKey: "DRPG.Sheet.groupKeys" }
];

/**
 * The chips on one inventory row: what this is, then what else it can do.
 *
 * ONE PLACE, because three kinds of row want tags for three different reasons
 * and each of them would otherwise grow its own version. Gear names its home
 * first — the category is the tag tied to the table the thing came out of — and
 * then its extra roles. A Usable names the resource it refills, which is the
 * only thing anybody wants to know about one at a glance. Truth Bullets and
 * keys get nothing here: bullets carry their own richer badges (see
 * `bulletBadges`) and a key row that said "Room Key" under a heading reading
 * Room Keys would be furniture.
 *
 * @returns {{key: string, label: string, hint: string}[]}
 */
function itemTags(item, inGearRow) {
    const named = (key, label, hint) => ({ key, label, hint });

    if (isUsable(item)) {
        const kind = usableKindOf(item);
        const def = kind ? USABLE_KINDS[kind] : null;
        return def
            ? [named(kind, def.chip ?? def.label,
                game.i18n.format("DRPG.Items.restores", { what: def.chip ?? def.label }))]
            : [];
    }

    if (!inGearRow) return [];

    const home = item.getFlag(MODULE_ID, "category");
    const label = role => ITEM_CATEGORIES[role]?.label ?? role;

    /*
     * THE HOME IS NEVER DRAWN TWICE, AND IT CAN ARRIVE TWICE.
     *
     * "Add an item" offers every equippable role as a tick box INCLUDING the
     * item's own category, and that is deliberate — see the note above
     * `roleChecks` in tables.mjs. The reasoning there is about MECHANICS and it
     * still holds: `servesAs` checks the home first, so ticking "Tool" on a
     * tool changes nothing about what the thing can do, and a list that
     * reshuffles as the category dropdown moves is worse to use than one
     * redundant box.
     *
     * What that note could not know is that these tags would later become
     * VISIBLE. Once a badge is drawn per role, a redundant tick stops being
     * harmless: the row grows a duplicate "Tool · Tool", and an item Dawid
     * capped at two tags shows three. So the display de-duplicates rather than
     * the form growing a rule — the form's reasoning is still right, and this
     * is the half that changed.
     *
     * The seeded pool has never carried one (measured: 24 tables, 0 hits), so
     * nothing in the box is wrong today. This is for the GM who adds their own.
     */
    const extra = Array.from(new Set(rolesOf(item))).filter(role => role !== home);
    return [
        named(home, label(home), game.i18n.format("DRPG.Items.isA", { role: label(home) })),
        ...extra.map(role =>
            named(role, label(role), game.i18n.format("DRPG.Items.alsoServes", { role: label(role) })))
    ];
}

/** A key to somebody's bedroom — see vault.mjs. */
function isBedroomKey(item) {
    return Boolean(item?.getFlag?.(MODULE_ID, BEDROOM_KEY_FLAG));
}

function groupInventory(app, element) {
    const tab = element.querySelector('section[data-application-part="inventory"]');
    if (!tab) return;

    tab.querySelector(".drpg-inventory-groups")?.remove();

    const actor = app.document;
    const box = document.createElement("div");
    box.className = "drpg-inventory-groups";

    for (const group of INVENTORY_GROUPS) {
        const cat = group.key ? ITEM_CATEGORIES[group.key] : null;
        const inGroup = group.group ? new Set(categoriesInGroup(group.group)) : null;
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
         * Weapons, then cleaning gear, then tools — the order they had as
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

        /*
         * THE COUNTER IS THE BUDGET, NOT THE ROW (E8, trap 69).
         *
         * Murder Weapons, Cleaning Tools and Tools share three slots between
         * them, so each of those three rows shows the SAME "2 / 3" — the number
         * of things in your hands and how many you may hold. Showing the row's
         * own count against the shared cap would put "1 / 3" over a full
         * inventory in three places at once, which is three lies rather than
         * one. Ungrouped rows are unchanged: Usables still count their own.
         */
        const group_ = group.group ?? cat?.limitGroup ?? null;
        const limit = group_ ? LIMIT_GROUPS[group_]?.limit : cat?.limit;
        const counted = group_ ? countInGroup(actor, group_) : items.length;

        // Evidence of the murder floats to the top of the pack — but only
        // evidence whose holder has EARNED that fact: `tiedToCrime` sits on
        // the item exclusively once the bullet is identified (analyze.mjs),
        // so an unanalysed bullet cannot leak its relevance through its place
        // in the list. The sort is stable; everything else keeps its order.
        if (group.key === "truthBullet" && items.length > 1) {
            const chapter = getClock().chapter;
            const ofTheMurder = i => Number(isIdentified(i)
                && i.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.tiedToCrime) === true
                && i.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.chapter) === chapter);
            items.sort((a, b) => ofTheMurder(b) - ofTheMurder(a));
        }

        const section = document.createElement("div");
        section.className = "drpg-inventory-group";
        section.dataset.category = group.key ?? group.group;

        const head = document.createElement("h4");
        head.innerHTML = `<span>${game.i18n.localize(group.labelKey)}</span>
                          <span class="drpg-group-count${limit && counted >= limit ? " full" : ""}"${
                              group_ ? ` data-tooltip="${game.i18n.localize("DRPG.Sheet.sharedSlots")}"` : ""
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

                if (isTruthBullet(item)) {
                    buildBulletRow(li, item, app);
                } else {
                    const tier = item.getFlag(MODULE_ID, "tier");
                    const ready = isEquipped(item);
                    const broken = isBroken(item);
                    const tags = itemTags(item, Boolean(inGroup));
                    if (ready) li.classList.add("drpg-item-equipped");
                    // The row is still the row. A used-up thing is the same
                    // object in the same slot — what changes is that it says so,
                    // and that the two buttons which would use it are refused.
                    if (broken) li.classList.add("drpg-item-broken-row");
                    li.innerHTML = `<img src="${item.img}" alt="" />
                                    <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>
                                    ${broken ? `<span class="drpg-item-broken" data-tooltip="${
                                        foundry.utils.escapeHTML(game.i18n.localize("DRPG.Items.brokenTooltip"))
                                    }">${foundry.utils.escapeHTML(
                                        game.i18n.localize("DRPG.Items.broken"))}</span>` : ""}
                                    ${ready ? `<span class="drpg-item-ready" data-tooltip="${
                                        foundry.utils.escapeHTML(game.i18n.localize("DRPG.Items.readyTooltip"))
                                    }"><i class="fa-solid fa-hand-fist" inert></i></span>` : ""}
                                    ${tags.length ? `<span class="drpg-tb-badges">${tags.map(tag =>
                                        `<span class="drpg-tb-badge drpg-role-${tag.key}" data-tooltip="${
                                            foundry.utils.escapeHTML(tag.hint)
                                        }">${foundry.utils.escapeHTML(tag.label)}</span>`).join("")
                                    }</span>` : ""}
                                    ${wearMarkup(item)}
                                    ${tier !== undefined && tier !== null
                                        ? `<span class="drpg-item-tier">T${tier}</span>` : ""}`;
                    addUseButton(li, item, app);
                    addEquipButton(li, item, app);
                    addDiscardButton(li, item, app);
                    // A key is COPIED, like a Truth Bullet: letting somebody
                    // into your room is not the same as giving your room away,
                    // and the guide's whole social engine runs on the first.
                    addHandoverButton(li, item, app, { copying: isBedroomKey(item) });
                    // Any stash anywhere, exactly as before — `stow` is what
                    // decides whether you are standing at one. Location-gating
                    // the button would be a different rule, not a translation.
                    if (stashRoomsFor(actor).length) addStashButton(li, item, app, { stowing: true });
                }

                // The row's buttons live inside the row, and the row itself opens
                // the item sheet — so each button has to be able to say "not me".
                // `guardRow` sits in front of all of them; see its own note.
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

    buildStashSection(box, actor, app);
    buildOpenStashSection(box, actor, app);
    tab.prepend(box);
}

/**
 * "There is somebody else's stash in this room, and it is not hidden."
 *
 * Only drawn when all of that is true, so it is not a permanent control — it
 * appears because of where the character is standing, which is the point. A
 * concealed stash does not show up here at all: finding one of those is what
 * the Search action's own stash branch is for.
 */
function buildOpenStashSection(box, actor, app) {
    if (!app.isEditable || isMonokuma(actor)) return;
    if (isDeceased(actor) && !isMonocub(actor)) return;

    /*
     * ONE HEADING PER STASH, ONE BUTTON FOR THE ROOM.
     *
     * A room can hold several now, and drawing only the first would hide the
     * fact that there is a second — which is exactly the information this
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
 * "Stash — <room>", under the carried groups.
 *
 * Only drawn when this character actually has a bedroom assigned. Uncapped, so
 * there is no count to show — what matters is which room it is in, because that
 * is where they have to be standing to reach it.
 */
function buildStashSection(box, actor, app) {
    // One section per stash you own, in room order. A character with two of
    // them has two drawers in two places, and merging them into one list would
    // hide the only thing that matters about a stash: where you have to be
    // standing to reach it.
    for (const entry of stashRoomsFor(actor)) {
        buildOneStashSection(box, actor, app, entry.room);
    }
}

function buildOneStashSection(box, actor, app, room) {
    const items = stashItemsIn(actor, room);

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
            // carrying it, so the drawer has to admit what is in it — otherwise
            // the stash is where broken tools go to become anonymous again.
            const broken = isBroken(item);
            if (broken) li.classList.add("drpg-item-broken-row");
            li.innerHTML = `<img src="${item.img}" alt="" />
                            <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>
                            ${broken ? `<span class="drpg-item-broken" data-tooltip="${
                                foundry.utils.escapeHTML(game.i18n.localize("DRPG.Items.brokenTooltip"))
                            }">${foundry.utils.escapeHTML(
                                game.i18n.localize("DRPG.Items.broken"))}</span>` : ""}
                            ${wearMarkup(item)}
                            ${tier !== undefined && tier !== null
                                ? `<span class="drpg-item-tier">T${tier}</span>` : ""}`;
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
 * Only on Usable Items, and only for somebody who can act — a corpse's first
 * aid kit is not a first aid kit. Free: the guide charges actions for finding
 * and making things, not for opening what you already carry.
 */
function addUseButton(li, item, app) {
    if (!app.isEditable || isMonokuma(app.document)) return;
    if (!isUsable(item)) return;
    if (isDeceased(app.document) && !isMonocub(app.document)) return;

    // SHOWN, AND DEAD. An opened kit keeps its button so the row does not
    // quietly change shape when it is spent — the player looks at the same
    // three controls and one of them has stopped working, which is the fact.
    // Hiding it would read as the item having changed into something else.
    const broken = isBroken(item);
    const tip = game.i18n.localize(broken
        ? "DRPG.Items.brokenTooltip" : "DRPG.Items.useTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-row-button drpg-row-use${broken ? " is-broken" : ""}`;
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
 * Not "is there an incident" — a third party who has walked in has their own
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
 * "the highest tier you happen to own" — which is wrong the moment a killer is
 * carrying a Tier 3 axe they mean to frame somebody with and a Tier 1 pipe they
 * mean to swing.
 */
function addEquipButton(li, item, app) {
    if (!app.isEditable || isMonokuma(app.document)) return;
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
 * inventory" — the guide has no such move, and one would let a killer make the
 * murder weapon cease to exist for free. This is the priced version: a Shadow
 * roll decides how obvious the trace is, and the trace stays on the map for the
 * investigation to find. See `discardBroken` in use-items.mjs.
 *
 * The other way out of the same problem is the stash button already on this
 * row, which costs nothing and hides nothing from anybody who searches the
 * bedroom.
 */
function addDiscardButton(li, item, app) {
    if (!app.isEditable || isMonokuma(app.document)) return;
    if (!isBroken(item)) return;
    // A corpse throws nothing away. Same gate as the Use button, and a Monocub
    // is on the other side of it for the same reason.
    if (isDeceased(app.document) && !isMonocub(app.document)) return;
    // The stash is the OTHER answer, not a place to act from: something already
    // put away has to be taken back out before it can be thrown away.
    if (isStashed(item)) return;

    const tip = game.i18n.localize("DRPG.Items.discardTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-row-button drpg-row-discard";
    button.dataset.drpgRowAction = "discard";
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
 * Put away, or take back out. Free, and only from the room itself — the check
 * that matters lives in vault.mjs, this just offers the button.
 */
function addStashButton(li, item, app, { stowing }) {
    if (!app.isEditable || isMonokuma(app.document)) return;

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

/**
 * One Truth Bullet, as a row.
 *
 * A bullet has no tier — the old `T2` pill was a visibility index the previous
 * macro smuggled through the tier field. What matters instead is what the player
 * currently believes it is, how hard the original was to spot (the number Analyze
 * will be rolled against), and which chapter it belongs to.
 *
 * The GM reading the same sheet gets one extra badge: the truth. It is drawn
 * from `truthBulletData`, which returns it only to a GM — a player's client
 * never had it to begin with.
 */
/**
 * The badges a Truth Bullet wears, as one string.
 *
 * Extracted so the inventory row and the item window are not two descriptions of
 * one object that drift apart — they are the same call. A player comparing the
 * row on their sheet with the window they just opened from it must not find two
 * different accounts of the same piece of evidence; in a game whose endgame is
 * people comparing notes, that is a contradiction the table has to spend the
 * trial resolving.
 */
export function bulletBadges(data) {
    if (!data) return "";

    const badge = (text, cls, tooltip = "") =>
        `<span class="drpg-tb-badge ${cls}"${
            tooltip ? ` data-tooltip="${foundry.utils.escapeHTML(tooltip)}"` : ""
        }>${foundry.utils.escapeHTML(text)}</span>`;

    const badges = [
        badge(data.shownLabel, `type ${data.shownType}`, data.shownHint),
        badge(data.visibilityLabel, "visibility",
            game.i18n.localize("DRPG.TruthBullet.visibilityTooltip"))
    ];

    if (data.chapter !== null) {
        badges.push(badge(game.i18n.format("DRPG.TruthBullet.chapterShort", { n: data.chapter }),
            "chapter"));
    }
    if (data.faint) {
        badges.push(badge(game.i18n.localize("DRPG.TruthBullet.faint"), "faint",
            game.i18n.localize("DRPG.TruthBullet.faintTooltip")));
    }
    // A burned attempt is worth showing rather than silently removing the
    // button: "I already tried this one" is information the player needs when
    // deciding what to spend the next action on.
    if (data.lockedChapter !== null && data.lockedChapter === data.chapterNow) {
        badges.push(badge(game.i18n.localize("DRPG.TruthBullet.locked"), "locked",
            game.i18n.localize("DRPG.TruthBullet.lockedTooltip")));
    }
    // GM only, and only worth showing while it still differs from what the
    // player sees — once a bullet is identified the two badges say the same thing.
    if (game.user.isGM && data.realType && data.realType !== data.shownType) {
        badges.push(badge(game.i18n.format("DRPG.TruthBullet.really", { type: data.realLabel }),
            "real", data.gmNote || game.i18n.localize("DRPG.TruthBullet.reallyTooltip")));
    }

    return badges.join("");
}

function buildBulletRow(li, item, app) {
    const data = truthBulletData(item);
    if (!data) return;

    li.classList.add("drpg-truth-bullet");
    li.dataset.bulletType = data.shownType;

    li.innerHTML = `<img src="${item.img}" alt="" />
                    <span class="drpg-item-name">${foundry.utils.escapeHTML(item.name)}</span>
                    <span class="drpg-tb-badges">${bulletBadges(data)}</span>`;

    if (!app.isEditable || isMonokuma(app.document)) return;

    // Evidence is worth passing on whatever state it is in — an unidentified
    // copy is exactly what you hand to somebody whose analysis has not been
    // burned yet. So this button is offered regardless of the lock.
    addHandoverButton(li, item, app, { copying: true });
    addPresentButton(li, item, app);

    // Nothing to analyse once the type is confirmed — a Key or Autopsy bullet
    // arrives identified, an analysed one is resolved, and one this character
    // already failed on this chapter is closed to them until the next.
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
 * Only during a Class Trial. It reaches the whole table at once, and outside
 * the trial the cast is spread across rooms that are meant to stay separate —
 * the same-room Share button covers those phases instead.
 *
 * ONE BUTTON, TWO ACTS, and which one it is depends on whether a debate is
 * open — see `presentDialog`. The window behind it decides for real; this
 * matches it so the player is not told one thing on the row and another in the
 * window. Read straight off the setting rather than through trial-floor.mjs:
 * this file is on the render path and the shape is one boolean.
 */
function addPresentButton(li, item, app) {
    if (!inClassTrial()) return;

    // A floor open at all means evidence takes it.
    let objecting = false;
    try {
        objecting = Boolean(game.settings.get(MODULE_ID, "trialQueue")?.active);
    } catch {
        // Present is the quieter of the two and the safer thing to promise.
    }

    const tip = game.i18n.localize(objecting
        ? "DRPG.Trial.objectionTooltip" : "DRPG.Trial.presentTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-row-button drpg-row-present${objecting ? " is-objection" : ""}`;
    button.dataset.drpgRowAction = "present";
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid ${objecting ? "fa-hand" : "fa-gavel"}" inert></i>`;

    button.addEventListener("click", async () => {
        const { presentDialog } = await import("./trial.mjs");
        await presentDialog(app.document, item);
    });

    li.append(button);
}

/**
 * "Hand this to somebody standing here."
 *
 * One button, two meanings, and the tooltip says which: a Truth Bullet is
 * copied and an item changes hands.
 *
 * Shown to the GM as well. They have Give / take items, which is the stronger
 * tool, but this one obeys the fiction's rules — same room, carry limits — and
 * a GM running a character or testing the table needs the same door the players
 * use, not a different one.
 */
function addHandoverButton(li, item, app, { copying }) {
    if (!app.isEditable || isMonokuma(app.document)) return;

    const tip = game.i18n.localize(copying ? "DRPG.Handover.shareTooltip" : "DRPG.Handover.giveTooltip");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-row-button drpg-row-handover";
    button.dataset.drpgRowAction = "handover";
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid fa-${copying ? "share-nodes" : "hand-holding"}" inert></i>`;

    button.addEventListener("click", async () => {
        const { shareBulletDialog, giveItemDialog } = await import("./handover.mjs");
        // TWO THINGS ARE COPIED, AND ONLY ONE OF THEM IS A TRUTH BULLET.
        // `copying` above chooses the icon and the wording; it does not choose
        // the route. `shareBulletDialog` refuses anything that is not a Truth
        // Bullet on its first line, so sending a bedroom key down it made the
        // share button on a key do nothing at all — no dialog, no error, no
        // console line. A key goes the ordinary way and is turned into a copy
        // by `giveItem` on the GM side, which is the only place that can see
        // both sheets anyway.
        if (copying && isTruthBullet(item)) await shareBulletDialog(app.document, item);
        else await giveItemDialog(app.document, item, { copying });
    });

    li.append(button);
}

/* ==========================================================================
 * THE KILLING GAME'S RULES
 * --------------------------------------------------------------------------
 * Daggerheart's Effects tab lists magical conditions applied by spells and
 * armour. This game has two conditions, both automatic (see states.mjs), and
 * no spells — so the tab was an empty box on every sheet in the world.
 *
 * What every sheet should carry instead is the thing every character is
 * actually bound by: Monokuma's standing rules. They were being announced once
 * in chat and then scrolling away, which for a rule is the same as not having
 * one.
 *
 * The tab is TAKEN OVER rather than removed and rebuilt. ApplicationV2 owns
 * the tab machinery — which part is active, what a click does, how the nav is
 * rendered — and adding or deleting a part from outside is how you end up with
 * a sheet that cannot switch tabs. Relabelling the nav entry and replacing the
 * section's contents leaves all of that untouched.
 * ========================================================================== */

function replaceEffectsTab(app, element) {
    const section = element.querySelector('section[data-application-part="effects"]')
        ?? element.querySelector('section.tab[data-tab="effects"]');
    if (!section) return;

    relabelEffectsNav(element);

    section.classList.add("drpg-rules-tab");
    section.replaceChildren(buildRulesPanel(app));
}

/**
 * The nav entry keeps its slot and loses its name.
 *
 * Matched by `[data-tab="effects"]` inside the tab bar specifically — the same
 * attribute is on the content section, and grabbing that one instead is how
 * the action panel once ended up rendered inside a navigation link.
 */
function relabelEffectsNav(element) {
    const nav = element.querySelector("nav.sheet-tabs, .sheet-tabs, nav.tabs");
    const link = nav?.querySelector('[data-tab="effects"]');
    if (!link || link.dataset.drpgRules) return;
    link.dataset.drpgRules = "1";

    const label = game.i18n.localize("DRPG.Rules.tab");
    link.setAttribute("aria-label", label);
    link.dataset.tooltip = label;

    // Foundry renders these as an icon plus a caption, and which of the two is
    // present varies with the UI module in play. Replace whichever exists.
    const icon = link.querySelector("i");
    if (icon) icon.className = "fa-solid fa-gavel";

    for (const node of link.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = ` ${label}`;
            return;
        }
    }
    const caption = link.querySelector("span");
    if (caption) caption.textContent = label;
    else if (!icon) link.textContent = label;
}

/** The list itself. Read-only for players; the GM gets a way in. */
function buildRulesPanel(app) {
    const panel = document.createElement("div");
    panel.className = "drpg-rules-panel";

    const title = document.createElement("h3");
    title.className = "drpg-keep";
    title.textContent = game.i18n.localize("DRPG.Rules.tab");
    panel.append(title);

    const intro = document.createElement("p");
    intro.className = "notes";
    intro.textContent = game.i18n.localize("DRPG.Rules.sheetIntro");
    panel.append(intro);

    const current = rules();

    if (!current.length) {
        const empty = document.createElement("p");
        empty.className = "drpg-rules-empty";
        empty.textContent = game.i18n.localize("DRPG.Rules.none");
        panel.append(empty);
    } else {
        const list = document.createElement("ol");
        list.className = "drpg-rules-list";
        for (const rule of current) {
            const li = document.createElement("li");

            const text = document.createElement("div");
            text.className = "drpg-rule-text";
            // textContent, never innerHTML — a rule is free text a GM typed.
            text.textContent = rule.text;
            li.append(text);

            if (rule.chapter) {
                const stamp = document.createElement("div");
                stamp.className = "drpg-rule-stamp";
                stamp.textContent = game.i18n.format("DRPG.Rules.added", { chapter: rule.chapter });
                li.append(stamp);
            }

            list.append(li);
        }
        panel.append(list);
    }

    /*
     * NO EDIT BUTTON HERE (Dawid, 28.08).
     *
     * A character sheet is where the handbook is READ. It was edited from here
     * too, for a GM, and the button was invisible until the first rule existed
     * — so it arrived unannounced in the middle of a session, most often right
     * after a New Rule was announced, on a sheet somebody had open for another
     * reason entirely.
     *
     * The rules manager has a door already: the Rules tile in the GM panel,
     * where the rest of the GM's tools are. Two doors to one window is the
     * thing that made this one a surprise.
     */

    return panel;
}

/* ==========================================================================
 * ACTION PANEL
 * --------------------------------------------------------------------------
 * The guide's actions, as buttons at the top of the Features tab. Clicking one
 * rolls the right trait, resolves the threshold and reports back privately —
 * no GM required for the repeatable ones.
 * ========================================================================== */

function injectActionPanel(app, element) {
    if (!app.isEditable) return;

    // Must be the CONTENT section, never the navigation link.
    //
    // `[data-tab="features"]` also matches the <a> in the tab bar, which comes
    // first in the DOM — so a looser selector put the whole panel inside a
    // navigation link. That made it collapse to the link's width and, worse,
    // silently swallowed every click: ApplicationV2 treats clicks inside
    // `[data-tab]` as "switch to this tab" and never reached our handler.
    const tab = element.querySelector('section[data-application-part="features"]')
        ?? element.querySelector('section.tab[data-tab="features"]')
        ?? element.querySelector('.tab[data-tab="features"]');
    if (!tab || tab.matches("a, nav, .sheet-tabs")) return;

    // Panels are rebuilt every render so costs and affordability stay current.
    tab.querySelectorAll(".drpg-action-panel, .drpg-calls-panel").forEach(p => p.remove());

    const actor = app.document;
    const monokuma = isMonokuma(actor);

    // A Monokuma has no action economy at all. Their sheet is Despair Calls.
    if (monokuma) {
        injectCallsPanel(tab, actor, true);
        attachActionDelegate(app, element);
        return;
    }

    // A Monocub keeps the normal action budget but only two things to spend it
    // on. Its own panel entirely, not a filtered version of the student grid —
    // Meddle targets another actor and has no place in the generic delegate.
    if (isMonocub(actor)) {
        injectMonocubPanel(tab, actor);
        attachActionDelegate(app, element);
        return;
    }

    // Dead, and not promoted to a Monocub. Both branches above are about what
    // somebody IS; this one is about somebody who has stopped.
    //
    // Nothing used to catch this case, so a student who had been executed or
    // murdered kept the whole living grid — Search, Rest, Work on Project, even
    // Direct Murder — plus their Hope Calls, and `resetActionsFor` refilled the
    // budget every time of day because it only ever skipped Monokumas. Becoming
    // a Monocub is a separate GM step that may come a whole trial later, or
    // never, and that gap is exactly where a corpse could keep taking turns.
    if (isDeceased(actor)) {
        const note = document.createElement("div");
        note.className = "drpg-action-panel drpg-dead-panel";
        const heading = document.createElement("h3");
        heading.className = "drpg-keep";
        heading.textContent = game.i18n.localize("DRPG.Chapter.deadPanelTitle");
        const body = document.createElement("p");
        body.className = "notes";
        body.textContent = game.i18n.localize("DRPG.Chapter.deadPanelNote");
        note.append(heading, body);
        tab.prepend(note);
        return;
    }

    /*
     * IN A FIGHT, THE GRID STAYS UP AND GOES DARK (Dawid, 28.08).
     *
     * This used to replace the whole grid with a crisis panel, because ten
     * tiles that all refuse you is ten wrong answers. The fix was right about
     * the problem and wrong about the shape: the answer is not a different grid
     * in the same place, it is the SAME grid saying what is happening. Every
     * tile greys out with "you are in an incident" on it, and the one that
     * still works is Direct Murder — which is where the incident's own actions
     * now live, on the tile whose whole subject is killing somebody.
     *
     * Nothing about who may do what changed. `availableCrisisActions` still
     * decides what is offered and `performAction`'s own guard still refuses the
     * rest; see `actionButton`, which draws the lock, and `openCrisisMenu`.
     *
     * Hope Calls stay live, as before: they are bought with Hope rather than
     * actions, they go through a different path entirely, and they are what a
     * cornered player reaches for.
     */

    const panel = document.createElement("div");
    panel.className = "drpg-action-panel";

    const title = document.createElement("h3");
    // `drpg-keep` exempts it from the rule that hides Daggerheart's own section
    // headings from players — see styles/danganronpa.css.
    title.className = "drpg-keep";
    title.textContent = game.i18n.localize("DRPG.Action.panelTitle");
    panel.append(title);
    panel.append(budgetLine(actor));

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";

    // Dynamic actions are the guide's catch-all: describe it, the GM sets a
    // threshold, and the reward scale is deliberately gentler. Built here
    // because its three strings are localised and ACTIONS is evaluated before
    // `game.i18n` exists — the table carries a placeholder row (`deferred`)
    // holding its PLACE in the order, and this is what fills it.
    const dynamic = {
        label: game.i18n.localize("DRPG.Action.dynamicLabel"),
        hint: game.i18n.localize("DRPG.Action.dynamicHint"),
        icon: "fa-wand-magic-sparkles",
        cost: 1,
        // Describing something and waiting for a threshold IS the GM branch —
        // this one is defined inline rather than in ACTIONS, so it has to say so
        // for itself.
        callsGm: true
    };

    // ONE LOOP, AND THE TABLE IS THE LAYOUT. The dynamic tile used to be
    // appended after this, which is why it sat last whatever config.mjs said —
    // and "last" is a position somebody has to be able to choose.
    for (const [key, def] of Object.entries(ACTIONS)) {
        if (def.kind !== "universal") continue;
        grid.append(actionButton(actor, key, def.deferred ? dynamic : def));
    }

    panel.append(grid);
    tab.prepend(panel);

    // An incident replaces the ordinary economy for the two people in it, so
    // their crisis actions sit ABOVE the normal grid while one is running.
    injectCrisisPanel(tab, actor);

    // Hope Calls sit underneath the actions, in the colour of the Hope die.
    injectCallsPanel(tab, actor, false);
    attachActionDelegate(app, element);
}

/**
 * Move and Meddle. Move reuses the normal action button and the generic
 * delegate — its click just shows the same briefing every player gets, since
 * the guide's Move is applied when a token crosses a room, not when a button
 * is pressed. Meddle is bespoke: it needs a target and a Help/Hinder choice
 * before there is anything to roll.
 */
function injectMonocubPanel(tab, actor) {
    const panel = document.createElement("div");
    panel.className = "drpg-action-panel drpg-monocub-panel";

    const title = document.createElement("h3");
    title.className = "drpg-keep";
    title.textContent = game.i18n.localize("DRPG.Monocub.panelTitle");
    panel.append(title);

    // No Hope read-out here. The Hope pips are already on the sheet header,
    // right next to this panel, and the Meddle tile's own price line says what
    // it costs — a third copy of the same number, plus a sentence about who is
    // allowed to top it up, was telling the player something they can see and
    // something they cannot act on.

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";
    grid.append(actionButton(actor, "move", ACTIONS.move));
    grid.append(meddleButton(actor));
    panel.append(grid);

    if (isSilenced(actor)) {
        const note = document.createElement("p");
        note.className = "notes drpg-monocub-silenced";
        note.textContent = game.i18n.localize("DRPG.Monocub.silencedNoteShort");
        panel.append(note);
    }

    tab.prepend(panel);
}

function meddleButton(actor) {
    const def = MONOCUB.meddle;
    const held = hopeHeld(actor);
    const affordable = actionsLeft(actor) >= def.cost && held >= def.hopeCost;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-action-button${affordable ? "" : " unaffordable"}`;
    button.dataset.tooltip = `${game.i18n.format("DRPG.Monocub.meddleCost", {
        actions: def.cost, hope: def.hopeCost
    })}${affordable ? "" : `<br><em>${game.i18n.localize("DRPG.Monocub.cannotMeddle")}</em>`}`;
    // "1 · 1◆" was unreadable without already knowing which number was which.
    // Confusion is the only action in the game that costs two different things,
    // so the tile spells both out in the same order the tooltip does.
    button.innerHTML = `
        <i class="fa-solid ${def.icon} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(def.label))}</span>
        <span class="drpg-action-cost">${game.i18n.format("DRPG.Monocub.meddleCostShort", {
            actions: def.cost, hope: def.hopeCost
        })}</span>`;

    button.addEventListener("click", async () => {
        const { meddleDialog } = await import("./monocub.mjs");
        await meddleDialog(actor);
    });

    return button;
}

/**
 * What the player has to spend, stated before the grid rather than inferred
 * from it.
 *
 * The grid dims what you cannot afford, which answers "can I press this" one
 * button at a time and never answers the question actually being asked, which is
 * "what can I get done this time of day". Ten tiles carrying a small `1 · 0◆` in
 * the corner is a lot of arithmetic for a decision the numbers could just state.
 *
 * The free Move is called out separately because it is the one piece of the
 * budget that is not interchangeable — it buys a room crossing and nothing else,
 * and a player who does not know they still have it will pay an action for a
 * door they could have walked through.
 */
function budgetLine(actor) {
    const line = document.createElement("p");
    line.className = "notes drpg-keep drpg-budget-line";

    const left = actionsLeft(actor);
    const parts = [game.i18n.format("DRPG.Actions.leftOf", {
        left, max: actionsMax(actor)
    })];

    if (hasFreeMove(actor)) parts.push(game.i18n.localize("DRPG.Actions.freeMoveLeft"));

    // What Hope has already bought, next to what the day gave you.
    //
    // On the budget line rather than on the tiles, for the same reason the
    // action count is: the question a player is asking here is "what can I get
    // done", and a banked Burst is part of that answer everywhere at once
    // rather than on any one tile.
    const burst = freeActionsLeft(actor);
    if (burst) parts.push(plural("DRPG.Actions.burstBanked", { n: burst }));
    const sprint = freeMovesLeft(actor);
    if (sprint) parts.push(plural("DRPG.Actions.sprintBanked", { n: sprint }));

    if (isEclipse()) {
        const left = eclipseMovesLeft(actor);
        // `null` is a Morning or Night Eclipse: free placement, so there is no
        // count to report — saying "null crossings" or "0 crossings" would both
        // be worse than saying what the rule actually is.
        parts.push(left === null
            ? game.i18n.localize("DRPG.Actions.eclipseFreePlacement")
            : plural("DRPG.Actions.eclipseMovesLeft", { n: left }));
    }

    line.textContent = parts.join(" · ");
    // "Empty" means nothing left to spend, and a banked Burst is something.
    if (!left && !burst) line.classList.add("drpg-budget-empty");
    return line;
}

/**
 * Stage 6's panel, and nothing else in it any more.
 *
 * THE CRISIS GRID MOVED TO THE DIRECT MURDER TILE (Dawid, 28.08) — see
 * `openCrisisMenu` in action-rolls.mjs. What is left here is the decision about
 * WHERE the Stage 6 panel sits, which is still worth making.
 */
function injectCrisisPanel(tab, actor) {
    // Stage 6 is not a turn and has no crisis actions, so it gets its own panel.
    //
    // WHERE it sits is decided by whether the body has been found yet, because
    // Stage 6 does not end when the cleaning does. `discoverBody` switches the
    // phase to Investigation but never closes the murder, so `isCleaner` stays
    // true — and the panel stayed pinned above the action grid for the rest of
    // the chapter, on the one sheet whose owner most needs to look like an
    // ordinary student searching rooms and taking rests.
    //
    //   body not found yet   above the actions.
    //   Investigation begun  below the actions, above the Hope Calls.
    //
    // Before any murder the question does not arise: `isCleaner` is false and
    // nothing here is built at all.
    if (!isCleaner(actor)) return;

    // The clock is read straight off the setting rather than through clock.mjs:
    // this file is on the render path that clock.mjs itself calls back into
    // (`refreshSheets`), and one field is not worth closing that loop.
    const phase = game.settings.get(MODULE_ID, "clock")?.phase ?? "dailyLife";
    injectBetrayalPanel(tab, actor, { onTop: phase === "dailyLife" });
}

/**
 * What is left of the Stage 6 panel: the betrayal, and nothing else.
 *
 * THE THREE CLEAN-UP ACTIONS MOVED TO THE TAMPER TILE (Dawid, 28.08). They were
 * always the same three things — erase a trace, plant a false one, carry the
 * body — and having them in a panel of their own meant a killer in Stage 6 read
 * a grid of ten tiles and then a second grid underneath with the actions that
 * actually mattered. Tamper is where they live now, and the tile knows which
 * stage it is in: in Stage 6 it charges Sanity and an action and shows the
 * whole room's traces, outside it charges an action and shows only what the
 * character has found.
 *
 * The betrayal stayed because it was never clean-up. It opens a SECOND MURDER,
 * and it is here for two reasons that have nothing to do with tidying a scene:
 * the guide gives the decision to the newcomer who threw in with the killer,
 * and it is on offer for exactly as long as Stage 6 lasts. Filing that under
 * "Tamper" would be a worse home than the one it had.
 */
function injectBetrayalPanel(tab, actor, { onTop = true } = {}) {
    const partner = betrayalTarget(actor);
    if (!partner) return;

    const panel = document.createElement("div");
    // `active` is the loud treatment. It belongs to the urgent window only —
    // once the body is found this is a tool, not an alarm.
    panel.className = `drpg-action-panel drpg-crisis-panel${onTop ? " active" : ""}`;

    const title = document.createElement("h3");
    title.className = "drpg-keep";
    title.textContent = game.i18n.localize("DRPG.Murder.betrayTileLabel");
    panel.append(title);

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";
    // Stage 9.5 gave the betrayal to the GM's post-incident checklist, which
    // made it something a GM had to remember to offer — and it is not their
    // decision. The guide gives it to the newcomer who threw in with the
    // killer: the body is on the floor and the only witness is standing next to
    // them.
    //
    // Red, because it opens a second murder. NOT GM-routed any more: the guide
    // gives this decision to the newcomer, and the confirmation that used to sit
    // in front of it turned their choice into a request — one the GM could
    // answer four times if the tile had been clicked four times.
    const tiles = [{
        icon: "fa-user-slash", gmRoute: true,
        label: "DRPG.Murder.betrayTileLabel", tip: "DRPG.Murder.betrayTileHint",
        run: async () => {
            const { requestBetrayal } = await import("./gm-bridge.mjs");
            return requestBetrayal({ actorId: actor.id });
        }
    }];

    for (const tile of tiles) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `drpg-action-button${tile.off ? " drpg-locked" : ""}${
            tile.gmRoute ? " drpg-gm-route" : ""}`;
        button.disabled = Boolean(tile.off);
        if (tile.off) tile.tip = tile.offTip;
        // Stage 6 is paid for in Sanity AND in one of the day's two actions —
        // the Sanity is what makes a long clean-up hurt, the action is what
        // makes it finite. The stripe names the Sanity because that is the part
        // this stage adds on top of the ordinary economy.
        button.dataset.drpgCostKind = "gm";
        button.dataset.tooltip = game.i18n.localize(tile.tip);
        button.innerHTML = `<i class="fa-solid ${tile.icon}" inert></i>
            <span class="drpg-action-name">${
                softWrap(foundry.utils.escapeHTML(game.i18n.localize(tile.label)))}</span>`;
        // ONE PRESS PER PRESS.
        //
        // Every tile here opens a dialog or sends a request, and both take long
        // enough for a second click to land. The betrayal was the one that hurt:
        // each click emitted its own socket message, and each message opened its
        // own incident with an opening roll nobody can skip. Disabled for the
        // duration of the handler, re-enabled in `finally` so a refusal or a
        // cancelled dialog does not leave a dead button behind.
        button.addEventListener("click", async () => {
            if (button.disabled) return;
            button.disabled = true;
            try {
                await tile.run(await import("./cleanup.mjs"));
            } finally {
                if (!tile.off) button.disabled = false;
            }
        });
        grid.append(button);
    }

    panel.append(grid);

    if (onTop) {
        tab.prepend(panel);
        return;
    }

    // Directly after the ordinary action grid, which `injectActionPanel` has
    // already prepended — and therefore before the Hope Calls, which are
    // appended after this function returns.
    const actions = tab.querySelector(".drpg-action-panel:not(.drpg-crisis-panel)");
    if (actions) actions.after(panel);
    else tab.prepend(panel);
}

/* ==========================================================================
 * HOPE CALLS  /  DESPAIR CALLS
 * --------------------------------------------------------------------------
 * The same grid as the actions, in the colour of the die that pays for it:
 * gold for Hope, purple for Despair. Calls you cannot afford stay visible but
 * dimmed — half the point of the menu is seeing what you are saving towards.
 * ========================================================================== */

/*
 * NOTHING FOLDS ANY MORE.
 *
 * Hope Calls were a `<details>` a player had to open, with the open/closed
 * state kept per client because the panel is rebuilt on every render. The
 * drawer is gone: a Call is what a cornered player reaches for, and a menu you
 * have to remember to open is a menu you forget under pressure. The sheet is
 * taller instead — see `--drpg-sheet-height` in the stylesheet.
 */

function injectCallsPanel(tab, actor, monokuma) {
    const held = monokuma ? monokumaPool(actor) : hopeHeld(actor);
    const max = monokuma ? STARTING.despairMax : hopeMax(actor);

    const panel = document.createElement("div");
    // A Despair Call that silences somebody closes this whole menu until the
    // clock moves, and until now it closed it INVISIBLY: `calls.mjs` refuses a
    // silenced player's Call with a notification, and every button on the panel
    // went on looking exactly as available as it had a moment earlier. The
    // stylesheet has had the greyed-out state written for it the whole time —
    // `.drpg-calls-panel.drpg-silenced`, dimmed with a `not-allowed` cursor on
    // the buttons — and nothing ever put the class on. Found by sweeping for
    // CSS classes the code never names.
    //
    // Refusal stays where it is. The dimming says "not now"; pressing anyway is
    // still how a player is told why.
    panel.className = `drpg-calls-panel ${monokuma ? "drpg-despair-panel" : "drpg-hope-panel"}${
        callSilenced(actor) ? " drpg-silenced" : ""}`;

    // The pool is on the bar for a Monokuma and nowhere else: Despair is the
    // only thing their sheet is about, and the number is not repeated anywhere
    // they can see. A student already reads their Hope twice over — the pips in
    // the sheet header and the player strip in the corner — so a third copy on
    // the drawer was noise on the one line that has to stay scannable.
    const title = document.createElement("h3");
    title.className = "drpg-keep";
    const heading = game.i18n.localize(
        monokuma ? "DRPG.Calls.despairTitle" : "DRPG.Calls.hopeTitle");
    title.innerHTML = monokuma
        ? `<span>${heading}</span><span class="drpg-calls-pool">${held} / ${max}</span>`
        : `<span>${heading}</span>`;
    panel.append(title);

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";

    // A Call is not a room crossing either — see spendHopeCall/spendDespairCallFor
    // in calls.mjs, which refuse it outright while the Eclipse is running.
    const locked = isEclipse();

    const calls = monokuma ? despairCallsFor(held) : affordableHopeCalls(actor);
    for (const call of calls) grid.append(callButton(call, monokuma, locked));

    panel.append(grid);
    tab.append(panel);
}

/**
 * A Call tile, built to exactly the same template as an action tile: icon on
 * top, name, price underneath. Only the colour and the icon differ, so a player
 * reads the whole sheet the same way rather than learning two layouts.
 */
function callButton(call, monokuma, locked = false) {
    const button = document.createElement("button");
    button.type = "button";

    /*
     * ONE TILE, TWO JOBS — AND THAT IS DELIBERATE (E14).
     *
     * While an assembly is pending, Public Announcement becomes the button
     * that calls it off. Not a control in the GM panel: the person who wants
     * to cancel is the person looking at the tile they bought it with, and
     * making them find another window to undo a thing they did here is how a
     * pending order gets left standing by accident.
     *
     * The whole state is computed once, here, because both the price and the
     * grey depend on it — see trap 103 immediately below.
     */
    const pending = call.defers ? pendingGather() : null;
    // Two reasons a Call is grey, and they are not the same reason.
    //
    // "You cannot afford it" is fixed by holding Hope; "the Eclipse is running"
    // is fixed by waiting, and applies to every Call at once regardless of the
    // pool. Sharing one look meant a player with six Hope saw seven identical
    // grey tiles next to a full pool and had nothing to read but the tooltip.
    /*
     * TRAP 103. A cancel costs nothing, so "you cannot afford it" cannot be
     * allowed to grey it out — and the pool is at its emptiest exactly when
     * somebody wants to cancel, because they have just spent six on the thing
     * they are cancelling. Affordability drops out of the class entirely while
     * the tile is in its pending state.
     *
     * BONE, NOT RED. Red already means one thing in this module — the Call
     * hands the turn to a GM (`GM_ROUTE_CLASS`) — and gold is Hope's. A third
     * meaning on red is the mistake the stylesheet's note about outline colour
     * warns against. Bone plus the pulsing dot reads as "this is standing and
     * about to go off", which is what it is.
     */
    button.className = `drpg-action-button drpg-call-button${
        pending ? " drpg-call-pending"
            : locked ? " drpg-locked-eclipse"
            : call.affordable ? "" : " unaffordable"}`;
    button.dataset.drpgCall = call.key;
    button.dataset.drpgCallKind = monokuma ? "despair" : "hope";

    const costLabel = pending
        ? game.i18n.localize("DRPG.Calls.freeShort")
        : game.i18n.format(
            monokuma ? "DRPG.Calls.costsDespairShort" : "DRPG.Calls.costsHopeShort",
            { cost: call.cost }
        );
    const note = pending
        ? `<br><em>${game.i18n.localize("DRPG.Calls.gatherNoRefund")}</em>`
        : locked
        ? `<br><em>${game.i18n.localize("DRPG.Eclipse.callsLocked")}</em>`
        : call.affordable ? "" : `<br><em>${game.i18n.localize("DRPG.Calls.cannotAfford")}</em>`;
    const summary = pending
        ? game.i18n.format("DRPG.Calls.gatherBody", {
            room: foundry.utils.escapeHTML(pending.room)
        })
        : foundry.utils.escapeHTML(callEffect(call));
    button.dataset.tooltip = `${summary}<br><em>${costLabel}</em>${note}`;

    const label = pending
        ? game.i18n.localize("DRPG.Calls.gatherCancel")
        : call.label;

    button.innerHTML = `
        <i class="fa-solid ${call.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(label))}</span>
        <span class="drpg-action-cost">${costLabel}</span>`;

    return button;
}

/** The Despair pool backing a Monokuma actor. */
function monokumaPool(actor) {
    try {
        const user = poolUserFor(actor);
        return user ? getDespair(user.id) : 0;
    } catch {
        return 0;
    }
}

/**
 * One delegated listener on the sheet root, instead of one per button.
 *
 * Per-button listeners were being lost: ApplicationV2 replaces the innerHTML of
 * a part when it re-renders, so any node we had attached to was discarded while
 * a visually identical one took its place. Delegation survives that, and the
 * `capture` phase means the sheet's own handlers cannot swallow the click
 * first.
 */
function attachActionDelegate(app, element) {
    if (element.dataset.drpgActionDelegate) return;
    element.dataset.drpgActionDelegate = "1";

    element.addEventListener("click", async event => {
        const button = event.target.closest?.("[data-drpg-action], [data-drpg-call]");
        if (!button || !element.contains(button)) return;

        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;

        button.disabled = true;
        try {
            if (button.dataset.drpgCall) {
                await runCall(app.document, button.dataset.drpgCall, button.dataset.drpgCallKind);
            } else {
                const { performAction } = await import("./action-rolls.mjs");
                await performAction(app.document, button.dataset.drpgAction);
            }
        } catch (err) {
            error("Action failed", err);
            ui.notifications.error(game.i18n.localize("DRPG.Action.failed"));
        } finally {
            button.disabled = false;
        }
    }, { capture: true });
}

/** Confirm and pay for a Hope Call or a Despair Call. */
async function runCall(actor, key, kind) {
    const { HOPE_CALLS, DESPAIR_CALLS } = await import("./config.mjs");
    const { confirmCall, spendHopeCall, spendDespairCallFor, hopeHeld } = await import("./calls.mjs");

    const despair = kind === "despair";
    const call = despair ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return;

    /*
     * TRAP 102, AND IT HAS TO BE THE FIRST THING IN THIS FUNCTION.
     *
     * Everything below — the affordability check, the target picker, the
     * confirmation, `spendDespairCallFor` — assumes a purchase. Calling off an
     * assembly is not one: it costs nothing and there is nothing left to point
     * at. Reached one line later, through `spendDespairCallFor`, it would have
     * taken a second six Despair for the privilege of undoing the first.
     */
    const standing = call.defers ? pendingGather() : null;
    if (standing) {
        const { cancelGather } = await import("./call-effects.mjs");
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: call.label },
            classes: ["drpg-panel", "drpg-despair-dialog"],
            content: `<p>${game.i18n.format("DRPG.Calls.gatherCancelAsk", {
                room: foundry.utils.escapeHTML(standing.room)
            })}</p><p class="notes">${game.i18n.localize("DRPG.Calls.gatherNoRefund")}</p>`,
            rejectClose: false,
            modal: true
        });
        if (!ok) return;
        await cancelGather();
        actor.sheet?.render(false);
        return;
    }

    const held = despair ? monokumaPool(actor) : hopeHeld(actor);
    if (held < call.cost) {
        ui.notifications.warn(game.i18n.format(
            despair ? "DRPG.Calls.costsDespair" : "DRPG.Calls.costsHope",
            { cost: call.cost, held }
        ));
        return;
    }

    // Silence closes the whole Hope menu. Checked here rather than inside
    // `spendHopeCall`, which only reached it after the target picker and the
    // confirmation — three dialogs to be told the menu was shut all along.
    if (!despair) {
        const { isSilenced } = await import("./call-effects.mjs");
        if (isSilenced(actor)) {
            ui.notifications.warn(game.i18n.localize("DRPG.Calls.silencedNotice"));
            return;
        }
    }

    // Experience buys the use of an experience. With none written on the sheet
    // there is nothing to buy, and the Call would have been paid for, armed, and
    // then met a roll window with no chips to tick.
    if (call.grants === "experience" && !Object.keys(actor.system?.experiences ?? {}).length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.noExperiences"));
        return;
    }

    // Point it at something first: a player, a project, a room, an item.
    const { pickTarget } = await import("./call-effects.mjs");
    const choice = await pickTarget(actor, call, despair ? "despair" : "hope");
    if (choice === null) return;

    const note = await confirmCall(call, { kind: despair ? "despair" : "hope", held, choice });
    if (note === null) return;

    if (despair) await spendDespairCallFor(actor, key, { note, choice });
    else await spendHopeCall(actor, key, { note, choice });

    actor.sheet?.render(false);
}

/**
 * Why this action would fail here, if it would — before anybody spends a click.
 *
 * Every one of these checks already existed; they just ran on the far side of
 * the button. A player picked Search, watched the briefing open, read the
 * options, rolled, and only then learned the room had been picked clean — and
 * in the unanswered case the module had to hand the action back afterwards.
 * The knowledge was there the whole time. This asks the same questions while
 * the tile is being drawn.
 *
 * Returns a reason string to show, or null when the action is fine.
 *
 * Deliberately NOT a hard block: the tile stays clickable and still opens its
 * briefing, because "what would this have done" is worth reading even when the
 * answer is "nothing here". The dimming is advice, not a gate — and the real
 * guards downstream stay exactly where they are, since a room's state can
 * change between a sheet render and a click.
 */
function roomBlockFor(actor, key) {
    try {
        // Only the five actions whose subject lives in the room can be blocked
        // by the room. Move, Rest and the rest are about the actor.
        const roomBound = ["search", "observe", "listen", "project", "palm", "tamper"];
        if (!roomBound.includes(key)) return null;

        // `roomOfActor` answers with the room's NAME, not a region document —
        // every other caller in the module treats it as a string, and reading
        // `.name` off it silently yields undefined, which reads as "outside
        // every room" no matter where the token is standing.
        const here = roomOfActor(actor);

        // SABOTAGE USED TO BE ANSWERED HERE, and is not any more: it has no
        // tile to dim. It is the third row of the Projects menu now, where
        // "nothing here to break" is a struck-through option with the reason
        // written beside it — which is the same information said better, and
        // said in the window where the alternative is one row away. The check
        // itself moved verbatim into `performProject`.

        if (!here) return game.i18n.localize("DRPG.Action.noRoomNote");

        // Sealed first: it outranks the counter, and it is the more useful
        // sentence. A room with nothing to find in it reading "already picked
        // clean" sends the player back at the next time of day to try again.
        if (key === "search" && SearchTokens.sealed(here))
            return game.i18n.localize("DRPG.SearchTokens.sealed");

        // `exhausted`, not `pickedClean` — the latter says "the action is
        // spent", which is true after a roll and a lie before one.
        if (key === "search" && SearchTokens.left(here) <= 0)
            return game.i18n.localize("DRPG.SearchTokens.exhausted");

        if (key === "listen" && neighbouringRooms(here).length === 0)
            return game.i18n.localize("DRPG.Listen.noNeighbours");

        // Palm needs a pocket, and a pocket needs somebody standing in it —
        // true of both directions. The same question `performPalm` asks;
        // `othersInRoom` reads the canvas, so this is the tile telling the
        // truth about the room the player is looking at rather than guessing.
        if (key === "palm" && othersInRoom(actor).length === 0)
            return game.i18n.localize("DRPG.Steal.nobodyHere");

        // TAMPER IS ANSWERED, AND IT USED TO SAY IT COULD NOT BE.
        //
        // The note that stood here said Tamper has "a second branch which
        // always works", so asking the GM's ledger would be "a socket round
        // trip to dim nothing". The second branch does not always work:
        // `framingCandidates` is empty in a cast down to its last two, and
        // both branches being shut is exactly the case a player needs told.
        //
        // Dawid, 28.08: the tile greys out only after you click it. That is
        // true and it is this line — the strike-through was appearing inside
        // the variant window, on two struck rows, one click too late.
        //
        // So the answer is cached rather than skipped. See `tamperBlock`: the
        // free half is computed here every render, the half that needs the
        // ledger is asked once per room per time of day and repainted onto the
        // tile when it lands.
        if (key === "tamper") return tamperBlock(actor);

        // NOT the project tile. An empty room is a reason there is nothing to
        // work ON, and the tile has two branches: working on a project and
        // proposing one. Proposing works anywhere, so striking the tile through
        // in a room with no projects hid the only route to creating the first
        // one — and the first one is always proposed from a room with none.
        // `performProject` still refuses the "work on it" half by itself.

        return null;
    } catch (err) {
        // A tile that cannot work out whether it is blocked is shown as normal.
        // Guessing "blocked" would hide a legal action; guessing "fine" only
        // means the existing guard downstream does its job.
        debug("Could not decide whether an action is blocked here", err);
        return null;
    }
}

/* ==========================================================================
 * WHETHER TAMPER HAS ANYTHING TO WORK ON
 * --------------------------------------------------------------------------
 * Two branches, two costs to find out.
 *
 *   frame  — is there anybody left to point at? `framingCandidates` reads the
 *            living cast on this client. Free, so it is asked every render.
 *   cover  — is there a trace of yours here that is not reinforced? Only the
 *            GM's ledger knows, and on a player's client that is a socket
 *            round trip. Asked once per room per time of day, cached, and
 *            painted onto the tile when the answer arrives.
 *
 * The tile is struck through only when EVERY branch is shut. A tile dimmed
 * because one of two routes is closed would be lying in the more expensive
 * direction: it would hide the route that still works.
 *
 * THE CACHE KEY IS THE STATE THE ANSWER DEPENDS ON, not a duration. Traces
 * belong to rooms, so the room is in it; they are laid and swept as the clock
 * turns, so the time of day is in it. Anything else that could change the
 * answer mid-scene — a trace erased, one planted — arrives as a settings
 * update, which `forgetTamper` below hangs on.
 * ========================================================================== */

const tamperAnswers = new Map();   // actorId -> { key, blocked }
const tamperAsking = new Set();    // actorId — one question in flight at a time

function tamperKey(actor) {
    const clock = getClock();
    return `${roomOfActor(actor) ?? "-"}|${clock.timeOfDay}|${clock.day}|${clock.session}`;
}

/** Drop every cached answer. Anything that could have changed a trace. */
export function forgetTamper() {
    tamperAnswers.clear();
}

function tamperBlock(actor) {
    // Nowhere to do it is answered by the caller's own `here` check, which runs
    // before this. Reaching here means the character is standing in a room.
    const key = tamperKey(actor);
    const seen = tamperAnswers.get(actor.id);
    if (seen?.key === key) return seen.blocked;

    // No answer for this room yet. Go and get one — and say nothing in the
    // meantime, because a tile dimmed on a guess is worse than one that is a
    // beat late. See the note above `roomBlockFor` on why this is advice.
    askTamper(actor, key);
    return null;
}

async function askTamper(actor, key) {
    if (tamperAsking.has(actor.id)) return;
    tamperAsking.add(actor.id);
    try {
        const cleanup = await import("./cleanup.mjs");
        const { requestCleanableTraces } = await import("./gm-bridge.mjs");

        // The same two questions `performTamper` asks, in the same shapes —
        // including `mine`, which is what separates an ordinary character
        // tidying after themselves from a killer standing on their own scene.
        const stageSix = cleanup.isCleaner(actor);
        const [mine, candidates] = await Promise.all([
            requestCleanableTraces(actor.id, { mine: !stageSix }),
            cleanup.framingCandidates(actor)
        ]);

        const erasable = mine.filter(t => !t.reinforced);
        // A killer standing over their own body has a third route, and it is
        // the one they are most likely to want.
        const body = stageSix && cleanup.bodyIsHere(actor);

        const blocked = (erasable.length || candidates.length || body)
            ? null
            : game.i18n.localize(mine.length
                ? "DRPG.Tamper.onlyReinforced" : "DRPG.Tamper.nothingOfYours");

        // The world may have moved while the socket was out. Storing an answer
        // under the key it was ASKED for means a stale one is simply never
        // matched again, rather than being believed for the wrong room.
        tamperAnswers.set(actor.id, { key, blocked });
        paintTamper(actor, blocked);
    } catch (err) {
        // No answer is the same as "no reason to dim it", which is where the
        // tile already is. The guard inside `performTamper` is untouched.
        debug("Could not work out whether Tamper has anything to work on", err);
    } finally {
        tamperAsking.delete(actor.id);
    }
}

/**
 * Paint the answer onto the tile without re-rendering the sheet.
 *
 * A full render here would be a sheet redrawing itself a moment after opening,
 * every time, for one class on one button — and it would fight `growForCalls`
 * and the tile fitter for the frame it happens to land in.
 */
function paintTamper(actor, blocked) {
    for (const app of sheetsFor(actor)) {
        for (const tile of app.element.querySelectorAll('[data-drpg-action="tamper"]')) {
            tile.classList.toggle("drpg-no-subject", Boolean(blocked));
            const tip = tile.dataset.tooltip ?? "";
            const bare = tip.replace(/<br><em>[^<]*<\/em>$/, "");
            tile.dataset.tooltip = blocked
                ? `${bare}<br><em>${foundry.utils.escapeHTML(blocked)}</em>`
                : bare;
        }
    }
}

function actionButton(actor, key, def) {
    const button = document.createElement("button");
    button.type = "button";

    // An action the budget cannot pay for is dimmed exactly the way an
    // unaffordable Hope Call is — same class, same look. The tile stays visible
    // and still opens its briefing, because knowing what an action would do is
    // half of deciding whether to save an action for it.
    const cost = costOf(actor, key, def);
    // The stripe still says "1 action" — that IS what it costs — but a banked
    // Burst is what will pay it, so the tile must not be dimmed. See `canPayFor`.
    const affordable = canPayFor(actor, cost);
    const eclipse = isEclipse();

    // Nothing here to do it to — a separate state from "cannot pay for it",
    // because the answer is different: one is fixed by waiting for the next
    // time of day, the other by walking into another room.
    const blocked = roomBlockFor(actor, key);

    // `nothingToBreak` lived here: the sabotage tile went out entirely when its
    // room held nothing to break, because unlike every other dimmed tile it had
    // no second half to offer. It has a second half now — it is one row of the
    // Projects menu, next to "work on" and "propose" — so the tile it used to
    // switch off does not exist and neither does the rule.

    // WHICH TILES ARE OUT, AND WHY EACH ONE IS.
    //
    // The Eclipse is placement-only — see the guard in action-rolls.mjs's
    // `performAction`. Move is exempt there and stays exempt here, since it is
    // the one thing the Eclipse actually is for.
    //
    // Direct Murder is exempt the other way round, and this tile is the reason
    // the rule needs stating twice: the guard refuses the action, but a tile
    // that looks pressable and then refuses is worse than one that says no in
    // advance. Greyed outside an Eclipse, live inside one — the exact inverse
    // of every other tile on the sheet.
    /*
     * IN AN INCIDENT, EVERYTHING BUT DIRECT MURDER IS SHUT.
     *
     * The guide's turn structure assumes the two people in a fight are doing
     * nothing else, and `performAction` has always refused them — but a tile
     * that looks pressable and then refuses is worse than one that says no in
     * advance, which is the rule this file has applied to the Eclipse since it
     * was written. Direct Murder is the exception because it is no longer only
     * Direct Murder: during an incident it opens that incident's own actions.
     */
    const inIncident = Boolean(murderState()?.stage === "incident" && sideOf(actor));

    const locked = key === "directMurder"
        ? (!eclipse && !inIncident)
        : (inIncident || (key !== "move" && eclipse));

    button.className = `drpg-action-button${(affordable && !locked) ? "" : " unaffordable"}${
        blocked ? " drpg-no-subject" : ""}`;

    // NOT `data-action`: ApplicationV2 claims that attribute for its own action
    // dispatch and swallows the click looking for a handler it does not have.
    button.dataset.drpgAction = key;

    // What this tile costs you, as a stripe rather than a sentence.
    //
    // Three kinds, and a player picks differently for each: one is free and can
    // always be taken, one spends a slice of a budget of two, and one hands the
    // turn to the GM and comes back at their pace. The cost line underneath
    // already says which — but it says it in words, at 11px, on ten tiles at
    // once, which is a paragraph to read before every decision.
    //
    // Derived from the definition rather than listed here, so an action whose
    // cost or GM involvement changes in config.mjs brings its stripe with it.
    const callsGm = callsGmFor(actor, def);
    button.dataset.drpgCostKind = cost === 0 ? "free" : callsGm ? "gm" : "action";

    const costLabel = costLabelFor(actor, key, def);
    // Order matters: an Eclipse stops everything, so it is said first; not
    // being able to pay comes next; and "nothing here" is the one worth adding
    // even when something else already applies, because it is the only reason
    // that will still be true after the Eclipse ends.
    const note = locked
        ? `<br><em>${game.i18n.localize(inIncident
            ? "DRPG.Murder.actionsLocked"
            : key === "directMurder"
                ? "DRPG.Eclipse.murderOnlyInEclipse" : "DRPG.Eclipse.actionsLocked")}</em>`
        : affordable
            ? ""
            : `<br><em>${plural("DRPG.Action.cannotAfford", { left: actionsLeft(actor), needed: cost }, "left")}</em>`;
    const why = blocked ? `<br><em>${foundry.utils.escapeHTML(blocked)}</em>` : "";
    button.dataset.tooltip =
        `${foundry.utils.escapeHTML(def.hint ?? "")}<br><em>${costLabel}</em>${note}${why}`;

    // Say what the stripe means, or the stripe means nothing.
    //
    // Four tiles read "1 action" and carry a grey stripe; five read "1 action"
    // and carry a red one. From the outside that is the same label with two
    // random colours. The difference is real — the grey ones hand the turn to
    // the GM — but it was only ever in the tooltip, and a colour whose key is
    // hidden is decoration.
    /*
     * ITS OWN LINE, UNDER THE COST (Dawid, 28.08).
     *
     * It used to sit inside the cost span, so the tile read "1 action GM" on
     * one line and the badge looked like part of the price rather than a fact
     * about who resolves it. Below the cost it reads as what it is: the cost,
     * and then who the tile hands the turn to.
     */
    const gmMark = callsGm
        ? `<span class="drpg-action-gm">${game.i18n.localize("DRPG.Action.waitsForGm")}</span>`
        : "";

    button.innerHTML = `
        <i class="fa-solid ${def.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(def.label))}</span>
        <span class="drpg-action-cost">${costLabel}</span>${gmMark}`;

    return button;
}

/**
 * Does this action hand the turn to the GM — for THIS character, right now?
 *
 * `callsGm` used to be a constant, and for four of the five actions carrying it
 * that is still the truth: a Direct Murder always waits for a ruling. For the
 * other two it was a half-truth that showed on the tile as a promise the action
 * often did not keep — Analyze with three unidentified bullets in the bag is a
 * roll, and Work on Project in a room with a project in it is a roll.
 *
 * So the flag may also be a predicate, and both forms are read here, in the one
 * place both consumers can share: the cost stripe and the "waits for the GM"
 * mark on the tile. Anything that throws counts as false — see the note on the
 * predicates in config.mjs.
 */
function callsGmFor(actor, def) {
    const flag = def?.callsGm;
    if (typeof flag !== "function") return Boolean(flag);
    try {
        return Boolean(flag(actor));
    } catch {
        return false;
    }
}

/**
 * What this action would cost right now.
 *
 * During an Eclipse the action economy is suspended entirely — crossings come
 * out of the two the placement window grants, not out of actions — so Move is
 * free regardless of whether the ordinary free Move has been spent.
 */
function costOf(actor, key, def) {
    if (key !== "move") return def.cost ?? 1;
    if (isEclipse()) return 0;
    return hasFreeMove(actor) ? 0 : 1;
}

/**
 * Move shows its live state; everything else shows a flat price.
 *
 * In an Eclipse "Free" is true but useless — the number that decides whether
 * you can still get where you are going is how many of the two crossings are
 * left, and it was only visible in a whisper after each one.
 */
function costLabelFor(actor, key, def) {
    if (key === "move" && isEclipse()) {
        const left = eclipseMovesLeft(actor);
        return left === null
            ? game.i18n.localize("DRPG.Action.costAnyRoom")
            : game.i18n.format("DRPG.Action.costCrossings", { left, max: ECLIPSE_MOVES });
    }

    const cost = costOf(actor, key, def);
    return cost === 0
        ? game.i18n.localize("DRPG.Action.costFree")
        : game.i18n.format("DRPG.Action.costActions", { n: cost });
}

/* ==========================================================================
 * PUBLIC HELPERS
 * ========================================================================== */

/** Read a character's Ultimate. */
export function getUltimate(actor) {
    return actor?.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
}

/** Set a character's Ultimate. */
export function setUltimate(actor, value) {
    return actor?.setFlag(MODULE_ID, FLAGS.ultimate, String(value ?? "").trim());
}

/**
 * Ultimates must be unique for a season. Returns every character whose
 * Ultimate collides with another, so the GM can catch duplicates at creation.
 */
export function findDuplicateUltimates() {
    const seen = new Map();
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        const ultimate = getUltimate(actor).trim().toLowerCase();
        if (!ultimate) continue;
        if (!seen.has(ultimate)) seen.set(ultimate, []);
        seen.get(ultimate).push(actor);
    }
    return Array.from(seen.entries())
        .filter(([, actors]) => actors.length > 1)
        .map(([ultimate, actors]) => ({ ultimate, actors }));
}


/**
 * Give the sheet room for the Hope Calls.
 *
 * Daggerheart opens a character sheet at 850x830, which fitted when the Calls
 * were a closed drawer and does not now: the panel sits under ten action tiles
 * and a clean-up block, and a menu a cornered player has to scroll to find is
 * a menu they do not use.
 *
 * HEIGHT ONLY, AND WIDTH WAS TRIED. For half a day this also grew the sheet to
 * 920 wide, to buy the tile grid a fourth column wide enough for
 * "Determination". Dawid, 28.08: keep the old size and shrink the type instead.
 * The width is Daggerheart's again and `fitTileText` does the fitting.
 *
 * Grown ONCE per sheet, and only upwards. A GM who drags the window smaller
 * afterwards keeps their size — the alternative, re-asserting on every render,
 * would undo a deliberate resize several times a turn.
 */
const grown = new WeakSet();
const SHEET_MIN_HEIGHT = 980;

function growForCalls(app) {
    try {
        if (!app || grown.has(app)) return;
        grown.add(app);
        const height = app.position?.height;
        if (typeof height !== "number" || height >= SHEET_MIN_HEIGHT) return;
        // Never past the window: a sheet taller than the screen is worse than a
        // sheet that scrolls.
        const room = Math.max(0, window.innerHeight - 40);
        app.setPosition({ height: Math.min(SHEET_MIN_HEIGHT, room) });
    } catch {
        // Cosmetic. A sheet that opens at its old size still works.
    }
}
