/**
 * Danganronpa RPG - character sheet surgery.
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
    MODULE_ID, FLAGS, ACTIONS, ACTION_GRID, STARTING, ITEM_CATEGORIES, LIMIT_GROUPS, USABLE_KINDS, MONOCUB,
    TIMES_OF_DAY,
    EQUIPPABLE,
    BEDROOM_KEY_FLAG, HOPE_CALLS, DESPAIR_CALLS, PRICE_CHAINS, SHEET_SIZE, STATES } from "./config.mjs";
import { SETTINGS, isMutedDead, myMastermindLair, actionsTabHeight, callsHeight } from "./settings.mjs";
import { actionsLeft, actionsMax, actionBudget, hasFreeMove, setActions,
    canPayFor, freeActionsLeft, freeMovesLeft, nextCrossingPrice } from "./actions.mjs";
import { resourceMax, resourceValue, initCharacter, needsStartingResources, RESERVES, reserveOf, reserveView, reserveRow }
    from "./character.mjs";
import { standingOffers, advanceKindName } from "./level-up.mjs";
import { isMonokuma, isNotInClass, isSpectator, poolUserFor } from "./monokuma.mjs";
import { spendableDespair } from "./despair.mjs";
import { hopeHeld, hopeMax, affordableHopeCalls, despairCallsFor, callAsksGm } from "./calls.mjs";
import { isEclipse, movesLeft as eclipseMovesLeft } from "./eclipse.mjs";
import {
    isTruthBullet, truthBulletData, isAnalysable, isIdentified, TRUTH_BULLET_FLAGS
} from "./truth-bullets.mjs";
import { getClock } from "./clock.mjs";
import { inClassTrial } from "./trial.mjs";
import { presentRefusal, trialFloor } from "./trial-floor.mjs";
import { stashRoomsFor, stashItemsIn, openStashesHere } from "./vault.mjs";
import { restShutReason } from "./rest.mjs";
// `availableCrisisActions` and `isTheirTurn` went to the Direct Murder tile's
// menu with the crisis grid - see `openCrisisMenu` in action-murder.mjs.
import { murderState, sideOf, betrayalTarget, isTheirTurn, crisisTileLabel } from "./murder.mjs";
import { incidentTurnText, actingActor } from "./events.mjs";
// Two different rules, each under its own name since 1.2.69 (E33 C9, D39): the
// crime-witness marker on a Monocub (information only - it refuses nothing) and
// the Despair Call "Silence" on a living student (no Hope Calls until the time of
// day ends). Until then both arrived under one bare name and were renamed at this door,
// which is how a reader of this file took one for the other.
import { isMonocub, isCrimeSilenced, cubBlockSaid, purseOf, cubPanelLines } from "./monocub.mjs";
import { isCallSilenced, isChained, pendingGather, armedCallsShown, alreadyArmed } from "./call-effects.mjs";
import { isDeceased, isDeadForGm } from "./chapter.mjs";

import { isStashed, ITEM_FLAGS, isBroken, durabilityOf, wearOf,
    durabilityLeft } from "./inventory.mjs";
// `equippedFor` went with the clean-up panel's "what you have readied" note -
// the Tamper menu says it now, where the roll it applies to is chosen.
import { isUsable, isEquippable, isEquipped, equippedIn, usableKindOf, tierOf, noDiscardNow, usedCreatively }
    from "./use-items.mjs";
import { countInGroup, categoriesInGroup, rolesOf } from "./inventory.mjs";
// `bodyIsHere` moved with the three Stage 6 actions - the Tamper menu asks it
// now (action-rolls.mjs), because that is where the body tile lives.
import { isCleaner, tamperQuote, witnessesTo, freeTonightText } from "./cleanup.mjs";
// The price a tile is about to charge, quoted from the same table the charge
// reads (T-1). Synchronous by design - this file calls it from a render path.
import { quotePrice, priceLabel, stripeKindFor } from "./price.mjs";
import { roomOfActor, neighbouringRooms, othersInRoom, locateActor, sceneOfActor, passageRooms, passageOpenFor,
    roomsKnownToMe, tunnelVerdict, tunnelRefusalText, tunnelStepTarget, whenAtRest, isPlacing, gmSpotWhy, isLocked } from "./movement.mjs";
import { isMoveChange, levelOf, roomRegions } from "./rooms.mjs";
// The sheet's 'Known passages' (E79 C7): this browser's passages, the Mastermind as the GMs hold it, and the
// rooms named as Listen names them - a room this viewer has not found is "Unexplored room n".
import { passagesKnownBy, passageSpot, viewPassage, tunnelEndsFor } from "./passages.mjs";
import { isMastermindActor } from "./passages-gm.mjs";
import { listenLabels, moveLine } from "./action-rolls.mjs";
import { SearchTokens } from "./search-tokens.mjs";
// `sabotageTargetsIn` used to be imported here for the tile that no longer
// exists; the question is asked in action-rolls.mjs now, where the menu is.
import { rules } from "./rules.mjs";
import { safeword } from "./safeword.mjs";
import { spentSince, markSpent } from "./motion.mjs";
import { debug, error, plural, proseOf, markLanguage, GM_ROUTE_CLASS, markFired } from "./utils.mjs";
import { drpgConfirm } from "./ui-kit.mjs";
import { markStatName, statOfTrait } from "./stat-glyphs.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { announceSheetSteps } from "./requirements.mjs";
import { overflowBlocksCalls, overflowBlocksFreeMove } from "./overflow.mjs";
import { stateHeld } from "./states.mjs";
import { effectBadges as timedBadges } from "./timed-effects.mjs";

import { tipAttr } from "./ui-kit.mjs";

/*
 * ONE SHEET MODE (E45 C1, 08.11.2026; audit S17-37, S03-33; the owner's A8 of 11.10). The gates of the sheet asked
 * their own questions in 27 functions - 57 lines on E24's tip that tested death, a Monocub, a Monokuma, "Not in the
 * class", the mastermind, ownership, the GM's role or `isEditable` each where it drew - and the curtain's strip, the
 * HUD's Objection, the redaction and the room tile asked theirs again. E24 C3a named the row's and the header's in
 * two helpers; this is the one place all of them are built, once a render (`onRenderCharacterSheet` hands the answer
 * to every step through `SHEET_STEPS`; `modeOf` reads it back for a row builder during that render). The answers are
 * the ones those predicates gave (R1455's matrix runs unchanged; R1471 holds every gate), with one change the plan
 * names: a Monokuma's sheet without a student's groups, headings and biography (S03-33).
 *
 * Dead as the person looking may know it (E05 C9, rule C; code.md "Death is two predicates"): on a sheet the viewer
 * owns - their own, or any sheet on a GM - what their browser holds; on anybody else's, the table's fact - so the
 * victim's own player sees the dead panel before anybody has found the body, and nobody else does (E05 C10).
 *
 * Client gates are courtesy: the GM's guards judge every request (D2); the redaction still fails closed
 * (anonymity.mjs `onRenderSheet` closes the sheet on a throw, R1474). The suite hands `facts` ({ clock, record }, as
 * settings.mjs `isMutedDead` takes them) for the trial's phase and its muted dead.
 *
 * @param {Actor} actor
 * @param {User} [user] whose view: this browser's by default
 * @param {{app?: object, editable?: boolean, facts?: object}} [options] `app`, the sheet: its `isEditable` decides the
 *   editable parts; `editable` the suite's answer for it; with neither, whether the user owns the actor
 * @returns {Readonly<object>} the mode; see the fields below
 */
export function sheetMode(actor, user = game.user, { app = null, editable, facts = {} } = {}) {
    const gm = Boolean(user?.isGM);
    const owner = gm || Boolean(typeof actor?.testUserPermission === "function"
        ? actor.testUserPermission(user, "OWNER") : user === game.user && actor?.isOwner);
    const canEdit = editable !== undefined ? Boolean(editable) : app ? Boolean(app.isEditable) : owner;
    // A stand-in with no flags at all (a Party sheet's member read by its uuid, the suite's) is a student of the class.
    const flagged = typeof actor?.getFlag === "function";
    const monokuma = flagged && isMonokuma(actor);
    // A Spectator (E92 C5): a watcher's sheet - no student's panel, Calls, rows, Level Up, strip, OBJECTION! or tile.
    const spectator = flagged && !monokuma && isSpectator(actor);
    const npc = flagged && !spectator && isNotInClass(actor);
    const monocub = flagged && isMonocub(actor);
    const dead = owner ? isDeadForGm(actor) : isDeceased(actor);
    const mode = monokuma ? "monokuma" : spectator ? "spectator" : npc ? "npc" : monocub ? "monocub" : dead ? "dead" : "student";
    // A Monocub's sheet plays on; the dead's and an NPC's header is still (E24 C3a).
    const cub = dead && monocub;
    const header = Object.freeze({ acts: (!dead || cub) && !npc && !spectator, dead, mark: dead && !cub, npc });
    // The action panel, by the order it always asked: a Monokuma's Despair Calls, an NPC's line (to a GM), a Monocub's
    // two tiles, the dead's panel, the student's grid; nothing on a sheet the viewer may not edit.
    const actions = !canEdit || spectator ? null : monokuma ? "calls" : npc ? (gm ? "npc" : null) : monocub ? "monocub" : dead ? "dead" : "grid";
    // The row buttons (D15: a Monocub's body keeps its items, so no Use, Discard or Stash for it either).
    const live = canEdit && !monokuma && !dead && !spectator;
    const rows = Object.freeze({ use: live, equip: live, discard: live, stash: live, give: live, bullets: live });
    // Present (E70 C10): hidden outside a trial, for the table's dead and the trial's muted dead; held by the floor
    // with trial-floor.mjs `presentRefusal`'s line, the Present window's own (trial.mjs). Asked only by the Present
    // button: in a trial the muted dead are the trial's record (`trialProgress`), a setting the strip and the tile do
    // not redraw on, so a mode built for them must not read it (R1013 inside a Class Trial; E45 C1 fix).
    const presentFor = () => (facts.clock ?? getClock())?.phase === "classTrial" && !isDeceased(actor) && !isMutedDead(actor, facts);
    const present = (floor = trialFloor()) => {
        const shown = presentFor();
        return { shown, held: shown ? presentRefusal(floor, actor?.id) : null };
    };
    return Object.freeze({
        mode, gm, owner, viewer: !owner, editable: canEdit, dead, monokuma, npc, monocub, spectator,
        // Dead, and nobody has found them yet (E05 C10): the victim's own player, and a GM.
        unfound: dead && !isDeceased(actor),
        header, actions, rows,
        calls: actions === "grid" || actions === "calls",
        levelUp: !npc && !spectator, offers: owner, init: gm && !monokuma, itemButton: gm && !monokuma, classControls: gm,
        // The Stop is a player's (E49 B2, S03-31): a Monokuma's sheet, a GM's character, draws none.
        safeword: !monokuma && !spectator,
        pipEdit: gm, realBullets: gm, otherRemove: gm && canEdit, creators: gm,
        // A Monokuma's sheet is no student's (S03-33): no student groups, no Equipped or Experience, no biography.
        groups: !monokuma, equipped: !monokuma, experience: !monokuma, biography: !monokuma, inventory: !monokuma,
        passages: owner && !monokuma, mastermind: gm && isMastermindActor(actor),
        // The Mastermind's own room, on their player's browser alone (E91 C4, C5; D038; `injectKnownPassages`).
        lair: owner && !gm && !monokuma ? myMastermindLair() : null,
        present,
        get presentShown() {
            return presentFor();
        },
        // The redaction (anonymity.mjs): another player's sheet, when the table enforces anonymity. Read when asked, so
        // the strip and the tile, which never ask, read no setting that does not redraw them (R1013). A setting that
        // cannot be read redacts: the redaction fails closed (E24 fix G2B; security N-3, R1474).
        get redact() {
            if (owner) return false;
            try {
                return Boolean(game.settings.get(MODULE_ID, SETTINGS.enforceAnonymity));
            } catch {
                return true;
            }
        },
        // The reserve's field (`paintReserves`; E24 C1a, Q-E24-1): on a sheet the viewer may edit, a GM's, or the
        // owner's while "Lock player resources" is off; never on the dead's (a Monocub's plays on) or a Monokuma's
        // (E24 fix G2B; general m1, R1497). Read when asked, as `redact` is; a setting that cannot be read gives none.
        get reserveField() {
            if (!canEdit || monokuma || (dead && !cub)) return false;
            if (gm) return true;
            if (!owner) return false;
            try {
                return !game.settings.get(MODULE_ID, SETTINGS.lockPlayerResources);
            } catch {
                return false;
            }
        },
        // The curtain's strip (player-status.mjs): nothing for a Monokuma or an NPC, the dead's one row, else full.
        strip: monokuma || npc || spectator ? "none" : dead && !monocub ? "dead" : "full",
        // The HUD's OBJECTION! (hud.mjs `objectionControl`): a living student of the class.
        objection: mode === "student",
        // The room tile (room-tile.mjs `viewerRoom`): a body lies in its room and a Monocub walks; an NPC is no student.
        tile: !npc && !spectator
    });
}

/** The mode of the render in progress for `app` (`onRenderCharacterSheet`), or one computed now. */
const RENDER_MODES = new WeakMap();
function modeOf(app) {
    return RENDER_MODES.get(app) ?? sheetMode(app?.document, game.user, { app });
}

/**
 * Whether an item row on this sheet carries buttons: an editable sheet, no Monokuma, nobody dead - a Monocub included.
 * Exported with `headerGate` for the suite (R1455); both read `sheetMode` since E45 C1.
 */
export function rowGate(app) {
    return modeOf(app).rows.use;
}

/**
 * What the header says of this character: `acts`, whether Hope, the Actions pips and the free Move are live (a flash,
 * a budget's tooltip, a GM's correction) - the living and a Monocub, never the dead or an NPC not in the class;
 * `dead`, dead as this viewer may know it; `mark`, the death mark on the portrait - the dead, not a Monocub, whose
 * sheet plays on; `npc`, not in the class.
 */
export function headerGate(actor) {
    return sheetMode(actor).header;
}

/*
 * A MONOKUMA'S SHEET IS NO STUDENT'S (E45 C1, 08.11.2026; audit S03-33). Daggerheart draws the sidebar's Equipped and
 * Experience headings and the Biography tab on every character; on a Monokuma the first two were headings over nothing
 * and the third a student's backstory form on a GM's mask. The sections are hidden in place (Daggerheart's own markup,
 * left in the DOM for whatever reads it by its selector); the biography's link leaves the tab bar, its part is emptied,
 * and a sheet that came up on it is moved to the Actions tab (`features`) as `leaveLoadoutTab` moves one off Loadout.
 */
function hideSidebarSection(element, name) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const section = root?.querySelector(`.character-sidebar-sheet .${name}`);
    if (!section) return;
    section.hidden = true;
    section.style.display = "none";
}

function dropBiographyTab(app, element, part) {
    dropTab(app, element, part, "biography");
}

/*
 * NO INVENTORY ON A MONOKUMA'S SHEET (E95 C7, 10.11.2026; the owner: "Usunmy z karty postaci monokumy zakladke
 * inventory"). The same drop as the Biography's: the link leaves the tab bar, the part is emptied (what `groupInventory`
 * drew goes with it), a sheet that came up on it moves to the Actions tab. Nothing is deleted or moved in the data: a
 * character marked Monokuma keeps what it held and the tab, with the items, is back when it is unmarked. A step of its
 * own, after the ones that draw into the part.
 */
function tidyInventoryTab(app, element, mode = modeOf(app)) {
    if (mode.inventory) return;
    const part = element?.querySelector?.('section[data-application-part="inventory"]');
    if (part) dropTab(app, element, part, "inventory");
}

function dropTab(app, element, part, name) {
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

export function registerSheetTweaks() {
    // ApplicationV2 fires a render hook per class in the inheritance chain,
    // so the concrete Daggerheart sheet class name is the precise target.
    Hooks.on("renderCharacterSheet", onRenderCharacterSheet);
    // Daggerheart's Party sheet (2.10.5 module/applications/sheets/actors/party-sheet.mjs, class PartySheet): its
    // members' Health and Sanity as the reserve (E24 C1b; patches.mjs `hook-party-sheet-render`).
    Hooks.on("renderPartySheet", (app, element) => {
        markFired("renderPartySheet");
        try { paintPartyReserves(app, element); } catch (err) { error("Could not draw the Party sheet's reserves", err); }
    });
    // The sheet's 'Known passages' follows this browser's copy of the passages (E79 C7).
    Hooks.on("drpgPassagesChanged", redrawPassageSheets);
    // The row's Present follows the floor (E70 C10): painted in place, no sheet rendered.
    Hooks.on("updateSetting", setting => {
        if (setting?.key === `${MODULE_ID}.${SETTINGS.trialQueue}`) repaintPresentButtons();
    });
    // A token moved onto a tunnel's end goes through it as 'Go through' does (H81-13; `onTunnelStep`'s note).
    Hooks.on("preUpdateToken", noteStepStart);
    Hooks.on("updateToken", (tokenDoc, changes, options, userId) => {
        onTunnelStep(tokenDoc, changes, options, userId).catch(err => error("Could not go through a secret passage", err));
    });
    // The tile-fit observer dies with its sheet (UI-14): ApplicationV2 builds
    // a new root on every open, so an observer left on the old root watched a
    // detached element for the rest of the session, one per open/close.
    Hooks.on("closeCharacterSheet", app => {
        try { app?._drpgTileFit?.disconnect(); } catch { /* already gone */ }
        if (app) app._drpgTileFit = null;
        // The backstory typed and not yet saved goes with the close (E24 C2): from the app, as the element is gone.
        try { saveBiography(app); } catch (err) { error("Could not save the backstory", err); }
    });

    // The flicker is decided inside the sheet's own render now (E45 C2): no hook here - see "THE FLICKER".

    /*
     * WHEN A CACHED TAMPER ANSWER STOPS BEING TRUE.
     *
     * The cache key already covers the two ordinary ways it goes stale - the
     * character walked out, or the clock turned. What it cannot see is the
     * ledger itself changing under a character who has not moved: a trace
     * erased, one planted, a chapter's sweep. All three are writes to
     * `remnantSecrets`.
     *
     * `clientSettingChanged`, NOT `updateSetting`, AND THIS LISTENER DID
     * NOTHING AT ALL UNTIL E17. `updateSetting` is a DOCUMENT hook, and
     * `remnantSecrets` is client-scoped: Foundry writes it straight to
     * localStorage without ever creating a Setting document, so the hook never
     * fires. Measured - a world setting fired it twice for two writes, this one
     * fired zero times for two. dice-sync.mjs had found the same trap a fortnight
     * earlier (its listener went in E16) and the knowledge did not travel, which is why there is now a tier-0
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
    // and anything the system adds later - one hook instead of a list that goes
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
 * of the three has a meaning in Danganronpa RPG - an item here is a thing you
 * are carrying, and a Truth Bullet is a thing you know - and all three offer a
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

/* ==========================================================================
 * THE FLICKER
 * --------------------------------------------------------------------------
 * Every write to `system.resources.*` made the WHOLE SHEET redraw. Not an
 * animation problem - a full re-render, which also replays every injection this
 * file makes: the action panel, the tabs, `tidyBiography`, `paintReserves`.
 * One cause, two symptoms: the equipped tab blinking on a roll (a roll spends
 * Hope, and Hope is a resource) and the whole window blinking on a Health or
 * Sanity change.
 *
 * The repair is not to render for those updates and to repaint in place
 * instead - the bars' painter (`paintReserves` since E24 C1a) already exists
 * and already knows how to resume a half-finished animation.
 *
 * THE ORDER, MEASURED ON 14.365. One `actor.update()` runs
 *
 *     preUpdateActor  ->  render (the sheet)  ->  updateActor  ->  render (sidebar)
 *
 * so the sheet's render comes after the actor holds the new values and before
 * `updateActor`. From E4 to E45 that order was answered with state: a "skip the
 * next render" mark laid on the sheet in `preUpdateActor` (the only hook early
 * enough), eaten by an own `render`, and the repaint done in `updateActor`. A
 * no-op update - `orderNoop` was exactly `["preUpdateActor"]` - fired no render
 * to eat the mark, so the mark waited for the next legitimate render; a value
 * comparison before the write kept it out of that one.
 *
 * WHY THE MARK WENT (E45 C2, 08.11.2026; audit S03-07, a bug seen at the table:
 * lost renders, frozen pips). The mark was laid before overflow.mjs and
 * resource-guard.mjs cut the write in their own `preUpdateActor` (this file's
 * hook was registered first), so a write they emptied updated nothing and
 * rendered nothing, and the mark ate the next render of anything: an item found
 * by Search did not appear. And `preUpdateActor` fires only on the writer's
 * browser, so only the writer skipped; every other client blinked.
 *
 * WHAT DECIDES NOW: THE RENDER'S OWN ARGUMENTS. Foundry hands every client that
 * holds the sheet open the same render, with its options: `renderContext`
 * "updateActor" and `renderData`, the changes (v13/v14's notes, not v14's
 * source; E45's live check of the render's options confirms them at a table,
 * AUDIT 9.2). `renderPlan` reads them and the
 * sheet's own `render` (`installRenderPlan`, an own property from its first
 * render) repaints in place or renders. Nothing is laid before a write and read
 * after it, so a write cut in preUpdate leaves nothing behind, and every client
 * repaints, not only the writer.
 *
 * THE CONDITION IS STRICT ON PURPOSE. Anything else in the same package - a
 * flag, an item, an effect - and the render happens; so does any shape of the
 * arguments `renderPlan` does not know (no options, `force`, a first render, no
 * `renderData`, another context). A skipped render that was needed is a sheet
 * showing something untrue, which is worse than a blink - and when Daggerheart's
 * or Foundry's render signature changes, the way out is a blink.
 *
 * "RESOURCES" IS NARROWER THAN IT SOUNDS, AND THAT MATTERS.
 *
 * `system.resources` holds five things here: hitPoints, stress, hope, actions
 * and armor. Only the first three are drawn by something that can be repainted
 * without a render - the two bars in the sidebar and the Hope diamonds in the
 * header. Actions are drawn by this file's own action panel and again by the
 * player's status strip; armor by the system's template. Skipping a render for
 * one of those would leave a number on screen that is no longer true, which is
 * the failure this whole apparatus exists to avoid, so they are left alone and
 * still render exactly as they did.
 *
 * A SKIPPED RENDER LEAVES THE OLD NUMBERS IN THE DOM. Obvious in hindsight and
 * not obvious while writing it: the painter before E24 (`paintResourceBars`)
 * read the `<progress>` and the number input, both of which the render would
 * have rewritten. Repainting from them repainted the OLD value - measured, the
 * bar sat at 0 while the actor held 1. So the inputs were fed from the actor
 * first, and only then painted. Since E24 C1a the painter (`paintReserves`)
 * reads the actor itself and the system's controls are hidden, so nothing is
 * fed: a render and a repaint draw through the one function.
 * ========================================================================== */

const RESOURCE_PREFIX = "system.resources.";

/**
 * The resources this file can redraw in place - see the note above.
 *
 * Adding one here is a promise that `repaintInPlace` below draws it: Health and
 * Sanity through the painter a render calls (`paintReserves`, both layouts, E24
 * C1a), Hope through its diamonds and the Calls and tiles it prices. Each by the
 * fields it is drawn from: a reserve's value and maximum (the painter reads
 * both), Hope's value alone - the repaint toggles the diamonds already drawn,
 * so a new maximum renders (E24 fix G2B; general n1, R1477).
 */
const REPAINTABLE = new Map([["hitPoints", ["value", "max"]], ["stress", ["value", "max"]], ["hope", ["value"]]]);

/**
 * Is every key in this update a resource this file can repaint itself?
 *
 * `_id` and `_stats` are not part of the answer. MEASURED: the package handed
 * to `preUpdateActor` is exactly what the caller wrote, but by `updateActor`
 * the server has added `_stats.modifiedTime` - so a predicate that only
 * forgives `_id` says "no" on the changes Foundry hands on after the write,
 * which are `renderData`'s, and the repaint never runs. That failure is silent
 * and looks exactly like the flicker fix working, except the numbers stop
 * moving.
 */
function onlyResourceKeys(changes) {
    const keys = Object.keys(foundry.utils.flattenObject(changes ?? {}))
        .filter(key => key !== "_id" && !key.startsWith("_stats."));
    if (!keys.length) return false;

    return keys.every(key => {
        if (!key.startsWith(RESOURCE_PREFIX)) return false;
        const [name, field, ...rest] = key.slice(RESOURCE_PREFIX.length).split(".");
        return !rest.length && Boolean(REPAINTABLE.get(name)?.includes(field));
    });
}

const isOptions = value => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * "repaint" or "render", from a render's own arguments (E45 C2; pure, for the suite). `args` is what the sheet's
 * `render` was called with; `rendered` whether the sheet is on screen now (a first render renders).
 *
 * Two shapes are known: `render(options)`, ApplicationV2's, and `render(false, options)`, the one Foundry's document
 * hands its apps after a write (v13's `ClientDocument#render(force, context)`, as remembered; ApplicationV2 reads a
 * boolean first argument as `force`, so `false` asks for nothing more than the options say). Anything else renders:
 * `render(true, ...)`, `render()`, `force`, `parts`, a context other than "updateActor", no `renderData`, a key in it
 * that is not a repaintable resource.
 */
export function renderPlan(args, { rendered = true } = {}) {
    const list = Array.isArray(args) ? args : [];
    let options = null;
    if (list.length === 1 && isOptions(list[0])) options = list[0];
    else if (list.length === 2 && list[0] === false && isOptions(list[1])) options = list[1];
    if (!options || !rendered) return "render";
    if (options.force || options.parts !== undefined || options.renderContext !== "updateActor") return "render";
    if (!isOptions(options.renderData)) return "render";
    return onlyResourceKeys(options.renderData) ? "repaint" : "render";
}

/** The mark the sheet's own `render` carries, read by the contract (patches.mjs `sheet-render-guard`). */
export const RENDER_PLAN = Symbol.for("drpgRenderPlan");

/** Every open character sheet for this actor. */
function sheetsFor(actor) {
    return Object.values(actor?.apps ?? {})
        .filter(app => app?.document?.type === "character" && app.element);
}

/**
 * Give a character sheet its own `render` that asks `renderPlan` first (E45 C2): on "repaint" it repaints in place
 * - `repaintInPlace`, inside `settle` - and resolves with the app, as a render does; otherwise, and whenever the
 * repaint throws, it calls the render it shadows. Installed from the sheet's first render (`SHEET_STEPS`
 * "installRenderPlan"), once.
 *
 * On the INSTANCE rather than on `ApplicationV2.prototype`: this concerns
 * character sheets and nothing else, and a global wrap would put every window
 * in the application through a check that can only ever be true for one kind.
 * An own property shadows the prototype's method for this object alone.
 */
export function installRenderPlan(app) {
    if (!app || Object.hasOwn(app, "render")) return;

    const original = Object.getPrototypeOf(app)?.render;
    if (typeof original !== "function") return;

    const render = function (...args) {
        const root = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        if (this.document?.type === "character" && root
            && renderPlan(args, { rendered: Boolean(this.rendered) }) === "repaint") {
            try {
                settle(root, () => repaintInPlace(this.document, root, this));
                return Promise.resolve(this);
            } catch (err) {
                // A sheet that renders is the safe failure.
                error("Could not repaint a resource in place; the sheet renders", err);
            }
        }
        return original.apply(this, args);
    };
    render[RENDER_PLAN] = true;
    Object.defineProperty(app, "render", { configurable: true, writable: true, value: render });
}

/**
 * Everything a render would have redrawn for a resource-only update, drawn here instead (the wrapper's
 * "repaint", `installRenderPlan`).
 *
 * Two surfaces, because that is how many the three repaintable resources have:
 * Health and Sanity in the sidebar, drawn by the same painter a render calls
 * (`paintReserves`, which reads the actor - E24 C1a; until then this fed the
 * system's own controls from the actor and the bar read them back), and the Hope
 * diamonds in the header, which the module paints from `:has(> i.fa-solid)`, so
 * the class on the inner glyph IS the state and toggling it is the whole repaint.
 */
function repaintInPlace(actor, element, app = null) {
    paintReserves(app, element, actor);

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
    // bar and the pips and stopped - so topping a player up moved the number
    // and left every newly affordable Call greyed out. The render that would
    // have fixed it is the one deliberately skipped to stop the sidebar
    // flickering, which means nothing was ever going to fix it.
    //
    // Same shape as the GM panel's murder tile: half a surface live, half of it
    // a photograph, and no way to tell them apart from the outside.
    refreshCallsPanels(actor, element);

    // AND THE PRICED TILES, FOR THE SAME REASON (T-1). Since the chains exist,
    // a Hope-only or Sanity-only change moves what the Objection, Analyze and
    // Tamper tiles cost - so a repaint that redrew the drawers and left the grid
    // alone would show a price that stopped being true one pip ago.
    refreshPricedTiles(actor, element);

    // AND A MONOCUB'S TILES (E45 C2; audit S03-07): Confusion costs Hope, and its tile's affordability is drawn when
    // the grid is built - so a Hope-only change left it as the render before had drawn it.
    refreshMonocubTiles(actor, element);

    // AFTER the glyphs, because the mark is counted off them. A repaint stands
    // in for a render and owes what the render owed - including saying that
    // something moved. See `markHopeChange`. And no more than the render owed:
    // the dead's and an NPC's header is still, counted and never marked, as
    // `flashHope` keeps it - since E45 C2 every client holding the sheet
    // repaints (E24 fix G2B; general m3, R1479).
    const mode = sheetMode(actor);
    markHopeChange(actor, element, !mode.header.acts || mode.redact);
}

/**
 * Rebuild the tiles whose price depends on a resource that just moved.
 *
 * Safe to replace the node because the grid is wired by ONE delegated listener
 * on the sheet root rather than by per-button handlers - see
 * `attachActionDelegate`.
 *
 * EXCEPT A TILE THAT IS IN FLIGHT. That same listener sets `disabled` for the
 * duration of an action, and a roll's Hope write lands while it is still true -
 * so a blind replacement would re-enable the tile mid-action and a second click
 * would fire the same action again.
 */
function refreshPricedTiles(actor, element) {
    for (const node of element.querySelectorAll("[data-drpg-action]")) {
        const key = node.dataset.drpgAction;
        if (!PRICE_CHAINS[key] || node.disabled) continue;
        const def = key === "dynamic" ? null : ACTIONS[key];
        if (!def) continue;
        try {
            node.replaceWith(actionButton(actor, key, def));
        } catch (err) {
            debug("Could not repaint a priced action tile", err);
        }
    }
}

/**
 * Redraw the Hope and Despair drawers from what the character now holds.
 *
 * Built from the same two functions the injection uses - `affordableHopeCalls`
 * / `despairCallsFor` and `callButton` - so there is one answer to "is this
 * Call available" and one tile that says so, rather than a second copy here
 * that drifts.
 */
function refreshCallsPanels(actor, element) {
    for (const panel of element.querySelectorAll(".drpg-calls-panel")) {
        const monokuma = panel.classList.contains("drpg-despair-panel");
        const held = monokuma ? monokumaPool(actor) : hopeHeld(actor);
        const max = monokuma ? STARTING.despairMax : hopeMax(actor);
        const lockNote = callLockNote(monokuma);

        panel.classList.toggle("drpg-silenced", isCallSilenced(actor) || (!monokuma && overflowBlocksCalls()));

        const pool = panel.querySelector(".drpg-calls-pool");
        if (pool) pool.textContent = `${held} / ${max}`;

        const grid = panel.querySelector(".drpg-action-grid");
        if (!grid) continue;
        grid.replaceChildren(
            ...(monokuma ? despairCallsFor(held) : affordableHopeCalls(actor))
                .map(call => callButton(call, monokuma, lockNote)));
    }
}

/**
 * A Monocub's grid rebuilt from what it now holds (E45 C2): the tiles `injectMonocubPanel` draws, from the same
 * `monocubTiles`. Until E103 a tile in flight was kept as it was: the Move, the one tile the delegate disables while its
 * action runs (`[data-drpg-action]`, as `refreshPricedTiles` reads it). The ability tiles carry no action key and open
 * their own window (`cubAbilityDialog`), so with the Move gone there is nothing in flight to keep.
 */
function refreshMonocubTiles(actor, element) {
    for (const grid of element.querySelectorAll(".drpg-monocub-panel .drpg-action-grid")) grid.replaceChildren(...monocubTiles(actor));
    // Move's line follows the Free Move (the r112 review's P2).
    for (const note of element.querySelectorAll(".drpg-monocub-panel .drpg-monocub-move")) note.replaceWith(monocubMoveNote(actor));
}

/**
 * @param {object} options  The render's own options. `isFirstRender` is the one
 *   that matters here: it is set by ApplicationV2 itself from the app's state,
 *   and closing a sheet drops that state - so reopening one counts as a first
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
 * changes their layout - so every redraw animated the whole left column for
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

/*
 * ONE STEP AT A TIME (E24 C3b, 08.11.2026; E24-21, audit S03-42). The injections ran in one try, so the first one
 * to throw - a Daggerheart that moved a part one of them reads, on the newer systems D1 lets the module start on -
 * took every one after it with it: a sheet with an Actions tab and no Calls, or Daggerheart's own "+" back. Each step
 * is now `[name, run]`, run in its own try inside `settle`, in the order they always ran, with `removeSystemCreators`
 * first: its job is a guard (what it removes must not be there whatever else fails), and nothing after it creates a
 * creator. A failed step is logged under its name, and the primary GM is told once a load which steps failed, beside
 * the newer-Daggerheart warning (requirements.mjs `announceSheetSteps`) - never a player, whose console has the error.
 * `run` takes `{ app, element, fresh, mode }`, `mode` the render's `sheetMode` (E45 C1). The table is the suite's to read
 * and to plant a throwing step in (R1456); E54 moves it into the thin sheet.mjs.
 */
export const SHEET_STEPS = [
    ["removeSystemCreators", ({ app, element, mode }) => removeSystemCreators(app, element, mode)],
    ["leaveLoadoutTab", ({ app, element }) => leaveLoadoutTab(app, element)],
    ["frameTraits", ({ element }) => frameTraits(element)],
    ["markTraitGlyphs", ({ element }) => markTraitGlyphs(element)],
    ["injectUltimate", ({ app, element, mode }) => injectUltimate(app, element, mode)],
    ["markSheetState", ({ app, element, mode }) => markSheetState(app, element, mode)],
    ["injectInitButton", ({ app, element, mode }) => injectInitButton(app, element, mode)],
    ["injectAdvanceButton", ({ app, element, mode }) => injectAdvanceButton(app, element, mode)],
    ["injectClassControls", ({ app, element, mode }) => injectClassControls(app, element, mode)],
    ["injectItemButton", ({ app, element, mode }) => injectItemButton(app, element, mode)],
    ["injectActionBar", ({ app, element, fresh, mode }) => injectActionBar(app, element, fresh, mode)],
    ["flashHope", ({ app, element, fresh, mode }) => flashHope(app, element, fresh, mode)],
    ["injectActionPanel", ({ app, element, mode }) => injectActionPanel(app, element, mode)],
    ["growForCalls", ({ app }) => growForCalls(app)],
    ["fitActionTiles", ({ element }) => fitActionTiles(element)],
    ["watchTileFit", ({ app, element }) => watchTileFit(app, element)],
    ["holdActionsTab", ({ app, element }) => holdActionsTab(app, element)],
    ["tidySidebar", ({ element }) => tidySidebar(element)],
    ["paintReserves", ({ app, element }) => paintReserves(app, element)],
    ["injectEquippedTools", ({ app, element, mode }) => injectEquippedTools(app, element, mode)],
    ["noteEmptyExperience", ({ app, element, mode }) => noteEmptyExperience(app, element, mode)],
    ["injectKnownPassages", ({ app, element, mode }) => injectKnownPassages(app, element, mode)],
    ["injectSafeword", ({ app, element, mode }) => injectSafeword(app, element, mode)],
    ["tidyBiography", ({ app, element, mode }) => tidyBiography(app, element, mode)],
    ["groupInventory", ({ app, element, mode }) => groupInventory(app, element, mode)],
    ["tidyInventoryTab", ({ app, element, mode }) => tidyInventoryTab(app, element, mode)],
    ["replaceEffectsTab", ({ app, element }) => replaceEffectsTab(app, element)],
    // The render's own decision, installed once per sheet (E45 C2; "THE FLICKER").
    ["installRenderPlan", ({ app }) => installRenderPlan(app)],
    // Last: the tab's scroll back where it was, once everything above has drawn into it.
    ["keepTabScroll", ({ app, element }) => keepTabScroll(app, element)]
];

/** Run each of `SHEET_STEPS` in its own try; the names of the steps that threw, in their order. */
function runSheetSteps(ctx) {
    const failed = [];
    for (const [name, run] of SHEET_STEPS) {
        try {
            run(ctx);
        } catch (err) {
            failed.push(name);
            error(`Sheet step ${name} failed`, err);
        }
    }
    return failed;
}

function onRenderCharacterSheet(app, element, context, options) {
    try {
        if (app?.document?.type !== "character") return;
        // A first draw has nothing to compare against and nothing to announce.
        const fresh = Boolean(options?.isFirstRender);
        // The one gate of this render (E45 C1): every step reads it, a row builder through `modeOf`.
        const mode = sheetMode(app.document, game.user, { app });
        // CSS keys off this to grey out the parts a Monokuma does not use.
        const root = element instanceof HTMLElement ? element : element?.[0];
        root?.classList?.toggle("drpg-monokuma", mode.monokuma);
        // The sheet's language, the page's (E66 C1): the module draws most of what it shows, its renamed traits and
        // resources included. Daggerheart's own words on it are in Foundry's language and carry no mark of their own.
        // ON THE ROOT, NOT ON THE MODULE'S PARTS (E66 fix r1 F2, STATUS Open 4; read 01.11.2026): lang/en.json and pl.json
        // each override 94 of Daggerheart's own keys - among them its traits' names, short labels and verbs (30), Health
        // (3), Sanity, Despair for Fear and the Actions tab - which Daggerheart's own markup draws, on the sheet as
        // elsewhere, in the module's language; and `tidySidebar` writes the module's heading into Daggerheart's element in
        // place. A `lang` on the blocks this hook injects alone would label those words with Foundry's language; which of
        // Daggerheart's words come from its own keys cannot be told in its markup here (no template of its is in this
        // repository or the harness). A table reads it: LIVE-E66-02.
        markLanguage(root);

        let failed = [];
        RENDER_MODES.set(app, mode);
        try {
            settle(root, () => {
                failed = runSheetSteps({ app, element, fresh, mode });
            });
        } finally {
            RENDER_MODES.delete(app);
        }
        if (failed.length) announceSheetSteps(failed);
    } catch (err) {
        error("Failed to render the Danganronpa sheet parts", err);
    }
}

/*
 * THE LOADOUT TAB IS NEVER THE ONE SHOWN (E24 C3b, 08.11.2026; E24-22, audit S03-47, S12-45). Its link is hidden in
 * the stylesheet (danganronpa.css "Loadout") because this game has no domain cards, but the part still rendered, and a
 * sheet that came up on it - a tab Daggerheart remembered, a macro's `changeTab` - showed a pane of controls with no
 * way back to it. At render, an active `loadout` tab is changed to the Actions tab (`features`, the one this module
 * draws into) through the app's own `changeTab`, which keeps `tabGroups` and the nav in step; a stand-in without one
 * gets the classes moved by hand. The part stays in the DOM, empty, for whatever reads it by its selector.
 */
function leaveLoadoutTab(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;
    const part = root.querySelector('section[data-application-part="loadout"], section.tab[data-tab="loadout"]');
    if (!part) return;
    const group = part.dataset.group || "primary";
    if (part.classList.contains("active") || app?.tabGroups?.[group] === "loadout") {
        if (typeof app?.changeTab === "function") {
            app.changeTab("features", group, { force: true, updatePosition: false });
        } else {
            for (const el of root.querySelectorAll(`[data-group="${group}"][data-tab]`)) {
                el.classList.toggle("active", el.dataset.tab === "features");
            }
            if (app?.tabGroups) app.tabGroups[group] = "features";
        }
    }
    part.replaceChildren();
}

/*
 * A TAB KEEPS ITS SCROLL (E24 C3b, 08.11.2026; E24-22, audit S03-14). Under the glass `section.tab` is the pane that
 * scrolls (stained-glass.css "THE SHEET'S TABS SCROLL"), and every render draws a new one at the top: a player halfway
 * down the Inventory was put back at its first row by any write to their sheet. Daggerheart keeps the scroll of its
 * own inner lists only (`.items-section`, `.features-sections`). Each tab's `scrollTop` is kept here per app id and tab
 * name, by one scroll listener on the window's root (which outlives its parts' renders; scroll does not bubble, so it
 * is caught on the way down), and the active tab's is put back as the render's last step. Under Monokuma Legacy the
 * same `section.tab` does not scroll: it keeps 0, and putting 0 back changes nothing.
 */
const tabScrolls = new Map();

function keepTabScroll(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const id = app?.id;
    if (!root || !id) return;
    if (!root.dataset.drpgTabScroll) {
        root.dataset.drpgTabScroll = "1";
        root.addEventListener("scroll", event => {
            const tab = event.target;
            if (!tab?.matches?.("section.tab[data-tab]")) return;
            tabScrolls.set(`${id}|${tab.dataset.tab}`, tab.scrollTop);
        }, { capture: true, passive: true });
    }
    const active = root.querySelector("section.tab.active[data-tab]");
    const kept = active ? tabScrolls.get(`${id}|${active.dataset.tab}`) : undefined;
    if (Number.isFinite(kept) && kept > 0 && active.scrollTop !== kept) active.scrollTop = kept;
}

/**
 * TAKE THE "+" OUT OF THE DOM, not out of the paint.
 * ---------------------------------------------------------------------------
 * The buttons that create a Feature or an Item by hand have been hidden in the
 * stylesheet for several versions, matched three different ways because the
 * system keeps moving them: `.add-feature`, then `[data-action="createItem"]`,
 * then `legend a[data-action="addNewItem"]`. Each time the markup moved, the
 * button came back - silently, because a rule that matches nothing looks
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
 * FEATURES for everybody, INVENTORY for players only - the same split the
 * stylesheet already makes. Features in this game come from the module's own
 * grid, so a hand-made one is noise even for the GM; a GM handing out an item
 * by hand is an ordinary ruling.
 */
const CREATE_ACTIONS = ["addnewitem", "createitem", "createdoc", "additem", "newitem"];

function removeSystemCreators(app, element, mode = modeOf(app)) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;

    const sections = [
        ...root.querySelectorAll('section[data-application-part="features"], section.tab[data-tab="features"]')
    ];
    if (!mode.creators) {
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
            // legend with it - otherwise the fieldset keeps a blank caption bar
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
 * 108px of content - an icon, a two-line name and a two-line cost - and the
 * square gives it 84. `overflow: hidden` then cut the cost line off entirely.
 *
 * The obvious test is the wrong one. Nothing overflows HORIZONTALLY - the
 * labels wrap, `scrollWidth` equals `clientWidth` on every button at every
 * width - so a `scrollWidth > clientWidth` check reports a clean sheet while
 * the bottom line of six tiles is missing. The overflow is vertical, and it is
 * the aspect ratio that causes it.
 *
 * Nor is the answer smaller type: the type scale bottoms out at 11px because
 * the pixel face stops being readable below that, and shrinking the label to
 * fit would undo the reason the floor exists.
 *
 * So the square gives way instead, and only where it has to. Each grid is
 * measured; one whose tiles cannot hold their content is marked, and the mark
 * turns off `aspect-ratio` and equalises the rows. Per GRID, not per tile -
 * one rectangle among nine squares reads as a rendering fault, while a grid of
 * slightly tall tiles reads as a grid.
 * ========================================================================== */

/**
 * A tile label with break points marked inside its long words.
 *
 * "Determination" is 143px of pixel font against an 80px tile. It has no space
 * to wrap at, so the only choices are to break it mid-word or to rename a Hope
 * Call the handbook already named - and the handbook wins.
 *
 * `hyphens: auto` is the textbook answer and does not work here: measured on
 * this build with `lang="en"` set on the root, "Determination" stays on one
 * 143px line and is clipped. Foundry's Electron ships no hyphenation
 * dictionary, so the property is inert. `overflow-wrap: anywhere` does break
 * it, but silently - "Observ / e", "Sabota / ge" - which is what the tiles were
 * doing and what looks broken.
 *
 * A soft hyphen is neither: it is a break point the layout engine takes only
 * when it needs to, and it draws a hyphen when it does. Invisible otherwise, so
 * a word that fits is untouched.
 *
 * Only words too long for the narrowest tile are marked, and only from the
 * fifth character, so the break never leaves an orphaned letter or two.
 */
const SHY = "\u00AD"; // soft hyphen, written as an escape so an editor can see it (UI-15)
const LONG_WORD = 9;      // characters - below this, every label fits a tile
// Six, not five: it puts the break where the word reads best - "Experi-ence"
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
 * painted in between - the grid does not flicker on its way to the answer.
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
 * wants more - so the type gives way. It was the column count for half a day
 * (four columns, a sheet widened to 920) and Dawid, 28.08: keep the old size,
 * shrink the names and the costs instead.
 *
 * He is right, and the reason is worth keeping. The column count is a SHAPE -
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
 * So the constraint is the longest word ANY tile in the module can carry -
 * `LONGEST_TILE_WORD`, taken from the definitions themselves - and every grid
 * on the sheet gets the answer. That also makes the size stable: it does not
 * change when a panel happens to be on a hidden tab, and a Monokuma's sheet
 * and a student's come out the same.
 *
 * Measured off the widest WORD, not the widest label: "Dynamic action" has a
 * space and is happy to wrap at it, so only a word with nowhere to break is
 * allowed to push the type down. And with a FLOOR - below about seven pixels
 * the pixel face stops being readable, and an unreadable whole word is worse
 * than a hyphenated one, so `softWrap` goes back to being the last resort it
 * was written to be.
 */
const TILE_TEXT_FLOOR = 0.68;

/**
 * The longest unbreakable word any tile in this module can be asked to draw.
 *
 * From the definitions rather than a constant, so renaming a Call moves this
 * with it - which is exactly what happened on 28.08, when "Determination"
 * became "Resolve" and stopped being the word every other tile was paying for.
 */
const LONGEST_TILE_WORD = (() => {
    const labels = [
        ...Object.values(ACTIONS ?? {}),
        ...Object.values(HOPE_CALLS ?? {}),
        ...Object.values(DESPAIR_CALLS ?? {}),
        // One tile per row of the Monocub's table (E33 C10): a second ability's word is paid for here too.
        ...Object.values(MONOCUB?.abilities ?? {})
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
    // real tile - a probe rather than arithmetic, because the pixel font's
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
 * The width a tile ends up with is not a function of the sheet width alone -
 * the grid drops columns as it narrows, so tiles get SMALLER and then abruptly
 * larger again. There is no width to hard-code; the only honest answer is to
 * measure whenever the box changes.
 */
function watchTileFit(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root || root.dataset.drpgTileFit) return;
    root.dataset.drpgTileFit = "1";
    // A previous root of this app (a re-open) - its observer goes first.
    try { app?._drpgTileFit?.disconnect(); } catch { /* already gone */ }

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
    if (app) app._drpgTileFit = observer;
}

/* ==========================================================================
 * TRAIT FRAMES
 * --------------------------------------------------------------------------
 * The purple rectangle around each trait value used to be pure CSS, hung off
 * Daggerheart's `.trait-value-area`. That worked on one install and not on
 * another with the identical stylesheet, which means the selector - not the
 * rule - is what varies: a system build, a UI module or a sheet replacement
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

/*
 * EACH STATISTIC'S GLYPH IN ITS MARK (E49, the owner's ask of 11.11.2026 night and his answer of 12.11.2026; stat-glyphs.mjs).
 * Daggerheart 2.6.5's header (header.hbs:107) draws `.character-traits > .trait[data-attribute="<its key>"]`, and in each
 * `.trait-name` a `.tier-mark` before the name's span: a disc half outside the plate's left end that shows
 * `system.traits.<key>.tierMarked` as the class `marked` (a gold dot) - set only by Daggerheart's own level-up automation
 * (character.mjs `prepareBaseData`), which the module never feeds, and with no action of its own (a click on it is the
 * trait's `rollAttribute`). The owner: enlarge the marks and put the glyph inside them. So the glyph goes in the mark, the
 * mark is marked `drpg-stat-mark` and its plate `drpg-stat-named` (danganronpa.css and stained-glass.css size and paint them
 * by those, the plate padded clear of the larger mark), and `marked` is left as Daggerheart drew it, so the state still
 * shows: marked, the holder is drawn in reverse (R3594). A sheet whose trait has no mark gets the glyph first in its name
 * instead. The statistic is read off `data-attribute`, not off the label (a translation). Every render draws the header
 * anew, and `markStatName` keeps a glyph already there, so a step that runs again adds nothing.
 */
function markTraitGlyphs(element) {
    for (const trait of element.querySelectorAll(".character-traits .trait[data-attribute]")) {
        const plate = trait.querySelector(".trait-name"), mark = plate?.querySelector(":scope > .tier-mark");
        const key = statOfTrait(trait.dataset.attribute);
        if (!key || !plate) continue;
        if (mark) {
            mark.classList.add("drpg-stat-mark");
            plate.classList.add("drpg-stat-named");
        }
        markStatName(mark ?? plate.querySelector(":scope > span"), key);
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
 * Hope is Daggerheart's own track and this module only restyles it - the pixel
 * diamonds in the stylesheet are masks over the system's markup, not a widget
 * of ours. So the flash is a class added to the system's slots after it has
 * drawn them, which is also why there is nothing to clean up: the sheet rebuilds
 * them from scratch on the next render.
 *
 * The count comes from the DOM rather than from `hopeHeld`, because the DOM is
 * what is being animated. A slot is filled when the system has put a solid
 * glyph in it - the same test the stylesheet's `:has()` makes to choose the
 * filled sprite - so the two cannot disagree about which diamonds are lit.
 */
function flashHope(app, element, fresh = false, mode = modeOf(app)) {
    // Still for the dead and an NPC (E24 C3a; the mode's header since E45 C1): counted, never marked, as a first draw is.
    // And on a sheet the redaction takes (E45-C3b): see `markHopeChange`.
    markHopeChange(app.document, element, fresh || !mode.header.acts || mode.redact);
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
 * called toggling the glyph "the whole repaint", which was the mistake - the
 * mark is part of what a render does, and a repaint that stands in for a render
 * owes everything the render owed.
 *
 * `spentSince` is called even on a first draw, and only the MARKING is skipped:
 * a surface that never learned where the count started would flash the whole
 * difference on its second draw.
 */
function markHopeChange(actor, element, fresh = false) {
    /*
     * NEVER ON A REDACTED SHEET (E45-C3b, 09.11.2026; found by scenario 71 J3). The count comes from the glyphs, and the
     * redaction (anonymity.mjs `redactValues`) takes them out after the render counted them: the first repaint read 0
     * held and marked every diamond the render had seen as spent - on p2's view of Aiko, three marked for her three
     * Hope ({"hopeText":"??????","hopeClasses":3}), and a mark the redaction never strips. Its callers pass `fresh`
     * for a sheet the mode redacts, so nothing on it is marked; counted as a first draw is.
     */
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
     * the old ones. Since E4 a Hope change SKIPS the render - `repaintInPlace`
     * stands in for it - and these same six diamonds live on across every
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

// Always draw the full base budget. A wounded character keeps both circles,
// but the one they have lost shows as a locked red slot - clearer than
// silently rendering "1 / 1", which reads like an action already spent.
function actionPips(actor, { left, max, spentActions, fresh, viewer = false, still = false, gm = false }) {
    const pips = [];
    const budget = Math.max(max, 1);
    for (let i = 1; i <= Math.max(STARTING.actions, budget); i++) {
        const locked = i > budget;
        const filled = !locked && i <= left;

        const pip = document.createElement("span");
        pip.className = `drpg-action-pip${filled ? " filled" : ""}${locked ? " locked" : ""}`;
        // The pips between the old reading and the new one: the ones just paid.
        // Built empty like any other unspent socket; the mark only says how
        // they got that way. See the keyframes in the stylesheet.
        markSpent(pip, fresh || still ? null : spentActions, i);
        pip.dataset.value = String(i);
        pip.innerHTML = `<i class="fa-${filled ? "solid" : "regular"} fa-circle" inert></i>`;

        if (still) {
            // The dead's and an NPC's pips are drawn still (E24 C3a, the mode's header): no budget to read, none to correct.
        } else if (locked) {
            // A viewer's pips say nothing (S03-06, the mode's `viewer`); the redaction marks them.
            if (!viewer) pip.dataset.tooltip = game.i18n.localize("DRPG.Actions.lockedTooltip");
        } else if (gm) {
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
        } else if (!viewer) {
            pip.dataset.tooltip = plural("DRPG.Actions.pipReadOnly", { left, max: budget }, "max");
        }
        pips.push(pip);
    }
    return pips;
}

/* ---- free move ---- */

/**
 * THE MOVE IS TWO FEET, ALWAYS (E49 B2; the owner, 10.11.2026: "dwie stópki: jedna taka jak teraz, druga w kolorze
 * eclipse, by było wiadomo czemu gracz ma 2 sloty ruchu w porze dnia, ale tylko 1 dostępny ... zależy nam na stałych
 * layoutach"). Until B2 the sheet drew one foot from `hasFreeMove` and read nothing of the Eclipse, while the HUD strip
 * drew one foot per crossing LEFT (none left: one outlined) - a row that changed its length with the Eclipse and with
 * every crossing. Now both draw these two slots in the same places: the first the time of day's free Move, the second
 * the Eclipse's own colour. Outside an Eclipse the second is `off` (drawn, dimmed: the slot exists and is not yours
 * now); in one the two are its crossings, the first lit while one is left and the second while two are (eclipse.mjs
 * `movesLeft`; a Call that grants a third shows two lit and says the number in the tooltip), and a free placement
 * (`null`, D197) is `anywhere` on both. Nothing appears, vanishes or moves when the Eclipse starts or ends.
 *
 * A MONOCUB'S FEET ARE ALWAYS THERE TO TAKE (E103, 13.11.2026; the owner: "u monocuba zawsze zaznaczamy ruch w karcie
 * postaci, ze jest dostepny (chodzi o glif)"). A Monocub pays nothing for a crossing and counts no Eclipse crossing
 * (movement.mjs `cubStep`, `chargeRoute`, E72 C10), so `cub` reads neither `free`, `fog` nor a count: out of an Eclipse
 * the first foot `available` and the second `off`, as everyone's (the stable layout); in one both `available`, and
 * `anywhere` in free placement, where nothing holds a Monocub to the connected rooms either. Both of the Eclipse's
 * defaults are the stage's, owner to confirm. Until E103 a Monocub's feet were a student's.
 *
 * @param {{eclipse?: boolean, moves?: number|null, free?: boolean, fog?: boolean, cub?: boolean}} state
 * @returns {{slot: "free"|"eclipse", state: "available"|"spent"|"fogged"|"off"|"anywhere"}[]}
 */
export function moveSlots({ eclipse = false, moves = null, free = false, fog = false, cub = false } = {}) {
    if (cub) {
        if (!eclipse) return [{ slot: "free", state: "available" }, { slot: "eclipse", state: "off" }];
        const state = moves === null ? "anywhere" : "available";
        return [{ slot: "free", state }, { slot: "eclipse", state }];
    }
    if (!eclipse) return [{ slot: "free", state: free ? "available" : fog ? "fogged" : "spent" }, { slot: "eclipse", state: "off" }];
    if (moves === null) return [{ slot: "free", state: "anywhere" }, { slot: "eclipse", state: "anywhere" }];
    const n = Math.max(0, Number(moves) || 0);
    return [{ slot: "free", state: n >= 1 ? "available" : "spent" }, { slot: "eclipse", state: n >= 2 ? "available" : "spent" }];
}

/** The two feet's markup: solid while a slot can be taken, outlined otherwise (the action pips' pair). */
export function moveFeetHtml(slots) {
    return slots.map(({ slot, state }) => `<i class="fa-${state === "available" || state === "anywhere" ? "solid" : "regular"} fa-shoe-prints drpg-move-slot" data-drpg-slot="${slot}" data-drpg-state="${state}" inert></i>`).join("");
}

/** What the two feet mean, said once beside the row's own sentence (S03-31's legend). */
export function moveLegend() {
    return game.i18n.localize("DRPG.Actions.moveLegend");
}

function freeMovePip(actor, { spentMove, fresh, viewer = false, still = false, cub = false }) {
    const move = document.createElement("span");
    // A Monocub's crossings cost nothing (E103; `moveSlots`): its feet are lit whatever the flag, Fog or the Eclipse's
    // count. `cub` is the sheet mode's answer (`mode.monocub`, R1470: no mode predicate outside `sheetMode`).
    const freeMove = hasFreeMove(actor);
    /* FOG IS A THIRD STATE (E24 C3b, 08.11.2026; E24-24, audit S03-13). `hasFreeMove` answers no under the Overflow's
       Fog, and the pip said "Free Move used" of a Move nobody spent. Drawn as a spent one (it is not there to take),
       with `drpg-fogged` and Fog's reason in the tooltip. Fog takes no Monocub's Move: its crossing never paid one. */
    const fog = !cub && !freeMove && overflowBlocksFreeMove();
    const eclipse = isEclipse();
    const moves = eclipse ? eclipseMovesLeft(actor) : null;
    const slots = moveSlots({ eclipse, moves, free: freeMove, fog: fog && !eclipse, cub });
    const lit = slots.some(({ state }) => state === "available" || state === "anywhere");
    move.className = `drpg-free-move${lit ? " available" : " spent"}${fog && !eclipse ? " drpg-fogged" : ""}`;
    // Nothing of a Monocub's goes out on a crossing, so nothing flashes: a flag reset under it is not a spend.
    markSpent(move, fresh || still || cub ? null : spentMove);
    if (!viewer && !still) {
        const says = cub
            ? game.i18n.localize("DRPG.Actions.cubMovesFree")
            : eclipse
                ? `${moves === null ? game.i18n.localize("DRPG.Actions.eclipseFreePlacement") : plural("DRPG.Actions.eclipseMovesLeft", { n: moves })}.`
                : game.i18n.localize(freeMove ? "DRPG.Actions.freeMoveAvailable" : fog ? "DRPG.SheetNotes.fogFreeMove" : "DRPG.Actions.freeMoveSpent");
        move.dataset.tooltip = `${says} ${moveLegend()}`;
    }
    // Solid while it is there, OUTLINED once it is gone - the same pair the
    // action pips use (`fa-solid fa-circle` / `fa-regular fa-circle`), so a
    // spent Move and a spent action say the same thing in the same way. Foundry
    // ships Font Awesome Pro, which carries every icon in both weights.
    move.innerHTML = moveFeetHtml(slots);
    return move;
}

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
export function pendingStack(actor) {
    const stack = document.createElement("div");
    stack.className = "drpg-pending-stack";

    // WHAT IS ON THEM NOW, not only what is riding on the next roll.
    //
    // The badge shipped in 17.5 read `pendingCall` and nothing else, so it
    // showed the half of this that is about dice and silently dropped the half
    // that is about the rest of the turn. Silenced and chained do not arrive
    // through `pendingCall` at all - they live in the world's `restrictions`
    // setting - and a Monocub silenced for the chapter is a flag on the actor.
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

    // One badge per armed Call: they stack (CALL-02), and the sheet has drawn a
    // list here since before they did. A Confusion's from the GMs' store or the
    // owner's copy, not the flag (E06 fix r2-G4).
    for (const entry of armedCallsShown(actor)) {
        const despair = entry.kind === "despair";
        // The badge wears the CALL'S NAME - "Determination", "Obstacle" - not
        // the grant phrase behind it. The phrases were written for sentences
        // ("waiting on your next roll: …") and did not fit the sheet, which is
        // exactly where Dawid met "a statistic of their choice" overflowing
        // its badge. The armed entry has carried the call's key all along; the
        // phrase stays as the fallback for an entry old enough not to.
        const call = (despair ? DESPAIR_CALLS : HOPE_CALLS)[entry.key];
        // The nominative, standing alone on the badge and after the tooltip's colon (call-effects.mjs `grantWords`, E66 C3).
        const label = call?.label ?? game.i18n.localize(`DRPG.Calls.grantsNom.${entry.grants}`);
        const badge = document.createElement("div");
        badge.className = `drpg-pending-call drpg-pending-${despair ? "despair" : "hope"}`;
        badge.dataset.tooltip = game.i18n.format("DRPG.Calls.pendingTooltip", {
            what: game.i18n.localize(`DRPG.Calls.grantsNom.${entry.grants}`)
        });
        badge.innerHTML = `<i class="fa-solid ${despair ? "fa-skull" : "fa-hand-sparkles"}" inert></i>
                           <span>${foundry.utils.escapeHTML(label)}</span>`;
        stack.append(badge);
    }

    // A room action's timed effects (the owner's answer to Q-E93-3; the owner's asks of 12.11.2026, "w podobnym miejscu co
    // efekty hope calls", then a name of one or two words, the rest in the tooltip, and white): a Call's badge as a white
    // chip, apart from the Hope Calls' gold - its short name on it, what it does and until when in the tooltip - read on a
    // GM off the GMs' store and on an owner's browser off their copy (timed-effects.mjs `effectBadges`). Stained Glass
    // wears the candle on it (tools/glyphs.json glass "timed-effect").
    for (const { short, what, until } of timedBadges(actor)) {
        const badge = document.createElement("div");
        badge.className = "drpg-pending-call drpg-pending-timed drpg-timed-badge";
        badge.dataset.tooltip = game.i18n.format("DRPG.Facility.timedBadge", { what, until });
        badge.innerHTML = `<i class="fa-solid fa-hourglass-half" inert></i>
                           <span>${foundry.utils.escapeHTML(short)}</span>`;
        stack.append(badge);
    }
    return stack;
}

/**
 * The header's Actions section. A viewer - somebody looking at a sheet that is not theirs, neither a GM nor an owner
 * (the mode's `viewer`, E45 C1) - is drawn no tooltip and no stack:
 *
 * A VIEWER IS DRAWN NOTHING THE REDACTION WOULD HAVE TO TAKE BACK (E05 C15,
 * 27.09.2026; audit S03-06). anonymity.mjs turns a viewer's pips and free Move
 * into question marks, and their tooltips stayed - "1 of 2 actions this time of
 * day", "Free Move used" - a hover away; and the stack beside them showed the
 * Calls armed on the owner's next roll, whispered to the owner and the GM
 * everywhere else, with nothing on the sheet taking it off. So the three are not
 * drawn for a viewer at all, whether or not the table enforces anonymity, and the
 * redaction strips them too (`redactValues`) for anything a later hand adds.
 */
function injectActionBar(app, element, fresh = false, mode = modeOf(app)) {
    const row = element.querySelector(".character-header-sheet .character-row");
    if (!row || row.querySelector(".drpg-actions-section")) return;

    const actor = app.document;
    const { viewer, pipEdit: gm } = mode;
    const still = !mode.header.acts;
    const left = actionsLeft(actor);
    const max = actionsMax(actor);
    // The lost action's mark, not the state's (E64 C1c): Wounded takes no action in the Class Trial.
    const { costsAction: wounded } = actionBudget(actor);

    // What went out since this sheet last drew itself. Recorded even when it is
    // not shown - a first draw still has to know where the count started, or
    // the NEXT draw would flash the whole difference.
    const spentActions = spentSince("sheet:actions", actor.id, left);
    const spentMove = spentSince("sheet:move", actor.id, hasFreeMove(actor) ? 1 : 0);

    const section = document.createElement("div");
    section.className = `drpg-actions-section${still ? " drpg-still" : ""}`;

    /* ---- action pips ---- */
    const actions = document.createElement("div");
    actions.className = "drpg-actions";

    const label = document.createElement("h4");
    label.textContent = game.i18n.localize("DRPG.Actions.label");
    if (wounded && !still) {
        label.classList.add("drpg-wounded");
        label.dataset.tooltip = game.i18n.localize("DRPG.Actions.woundedTooltip");
    }
    actions.append(label);

    for (const pip of actionPips(actor, { left, max, spentActions, fresh, viewer, still, gm })) actions.append(pip);

    actions.append(freeMovePip(actor, { spentMove, fresh, viewer, still, cub: mode.monocub }));

    section.append(actions);

    const stack = viewer || still ? null : pendingStack(actor);
    if (stack?.children.length) section.append(stack);

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
 *   silenced (Call)   world `restrictions`, until this time of day ends
 *   chained           world `restrictions`, until this time of day ends
 *   silenced (cub)    a flag on the actor, for the rest of the chapter
 *
 * Read rather than cached: all three can be lifted by somebody else's screen
 * between one render of this sheet and the next.
 */
function standingEffects(actor) {
    const out = [];
    if (!actor) return out;

    if (isCallSilenced(actor)) {
        out.push({ icon: "fa-comment-slash", label: "DRPG.Calls.silencedBadge",
                   tooltip: "DRPG.Calls.silencedNotice" });
    }
    if (isChained(actor)) {
        out.push({ icon: "fa-link", label: "DRPG.Calls.chainedBadge",
                   tooltip: "DRPG.Calls.chainedNotice" });
    }
    // The Monocub's is a different silence - it is about speaking at the table,
    // not about spending Hope - so it says so rather than sharing a label.
    if (isCrimeSilenced(actor)) {
        out.push({ icon: "fa-user-slash", label: "DRPG.Monocub.silencedBadge",
                   tooltip: "DRPG.Monocub.silencedTooltip" });
    }
    return out;
}

/* ==========================================================================
 * STARTING RESOURCES
 * --------------------------------------------------------------------------
 * Daggerheart derives max Health and Sanity from a class, and this game has no
 * classes - so `initCharacter` is the only thing that ever writes them. Until
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
    // Below, not different: an advanced sheet is a set-up sheet (SEASON-01).
    return needsStartingResources(actor);
}

function injectInitButton(app, element, mode = modeOf(app)) {
    if (!mode.init) return;
    const actor = app.document;
    // A Monokuma has no tracks worth setting - `setMonokuma` deliberately zeroes
    // what a student uses, so this would light up permanently on the GM's own sheet.
    if (!needsInit(actor)) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-init]")) return;

    const tip = game.i18n.format("DRPG.Character.initTooltip", {
        hp: STARTING.hp, stress: STARTING.stress, hope: STARTING.hope
    });

    const button = headerButton({ cls: "drpg-init-button", data: { drpgInit: "" }, icon: "fa-wand-sparkles", tip });

    button.addEventListener("click", async () => {
        // A question on the kit's frame (E21 C5a).
        const confirmed = await drpgConfirm({
            yes: { label: game.i18n.localize("DRPG.Dialog.yes") },
            title: game.i18n.localize("DRPG.Character.initTitle"),
            classes: ["drpg-panel", "drpg-narrow"],
            body: `<p>${game.i18n.format("DRPG.Character.initConfirm", {
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

function injectAdvanceButton(app, element, mode = modeOf(app)) {
    /*
     * THE PLAYER GETS THIS BUTTON TOO, WHEN ONE IS WAITING FOR THEM (N-2, 20.09).
     *
     * It was the GM's alone, because advancement is the GM's to award. It still is:
     * what a player can reach is an OFFER the GM left on their character, and even
     * then the picks they make are sent to the GM's client to be checked and
     * written (see `openAdvancement` and `requestAdvancement`). No offer, no button.
     *
     * LIT UP RATHER THAN MERELY PRESENT. A player does not watch the top of their
     * own sheet for new controls; the class below is what makes it read as
     * something waiting to be answered, and the tooltip says which kind was earned.
     */
    // The owner's alone. Another player opening this sheet used to see the lit badge
    // and read the kind off its tooltip - after a wrong verdict, the Blackened's
    // Reinforced Level Up, on the one character who has it (review of stage D).
    //
    // AND THE GM'S (E10 C6, 1.2.71; audit S03-17). A GM was handed no offer here, so the
    // GM's button never lit and nothing said one stood: it lights from the GMs' store now,
    // and says how many stand; its menu takes one back (level-up.mjs `openAdvancementFor`).
    const offers = !mode.offers ? [] : standingOffers(app.document);
    const [offer] = offers;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    const standing = nameRow?.querySelector("[data-drpg-advance]");
    // No Level Up for an NPC not in the class (E24 C3a, E24-20): no verdict offers one, and the GM's button would.
    if (!mode.levelUp) {
        standing?.remove();
        return;
    }
    // A player with nothing on offer has no button: a header drawn again after the offer
    // was spent or taken back used to keep the lit one, whose press said "GM only" (S03-17).
    if (!mode.gm && !offer) {
        standing?.remove();
        return;
    }
    if (!nameRow) return;

    const count = offers.length > 1 ? plural("DRPG.Advance.standing", { n: offers.length }) : "";
    const tip = mode.gm
        ? (offer ? plural("DRPG.Advance.standing", { n: offers.length }) : game.i18n.localize("DRPG.Advance.buttonTooltip"))
        : [game.i18n.format("DRPG.Advance.offerTooltip", { kind: advanceKindName(offer.kind) }), count]
            .filter(Boolean).join(" ");
    if (standing) {
        // A sheet re-rendered after the offer was taken must not keep the glow.
        standing.classList.toggle("is-offered", Boolean(offer));
        standing.dataset.tooltip = tip;
        standing.setAttribute("aria-label", tip);
        return;
    }

    const button = headerButton({ data: { drpgAdvance: "" }, icon: "fa-angles-up", tip, caption: game.i18n.localize("DRPG.Advance.caption") });
    if (offer) button.classList.add("is-offered");

    button.addEventListener("click", async () => {
        const { openAdvancementFor, openAdvancement } = await import("./level-up.mjs");
        // The GM is asked which kind and who picks; the player is not asked
        // anything - the offer already says which kind, and they are the who.
        if (mode.gm) await openAdvancementFor(app.document);
        else await openAdvancement(app.document);
    });

    nameRow.append(button);
}


/* ==========================================================================
 * WHO THIS IS: THE DEATH MARK AND THE GM'S CONTROLS
 * --------------------------------------------------------------------------
 * E24 C3a, 08.11.2026 (audit S03-15, S03-36; E24-18, E24-19; the owner's
 * answer to Q-E24-5 and STAGE.md "Amend 08.11" A2).
 * ========================================================================== */

/**
 * The sheet's state on its root, for the stylesheet: `drpg-sheet-still` while the header is still (the mode's header),
 * `drpg-dead-sheet` and the stamp on the portrait for the dead (a Monocub's sheet plays on and carries neither),
 * `drpg-npc-sheet` for an NPC not in the class. Dead as the viewer may know it, so a player who does not know of a
 * death sees no mark (`sheetMode`'s death: the table's fact on anybody else's sheet).
 */
function markSheetState(app, element, mode = modeOf(app)) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root?.classList) return;
    const { acts, mark, npc } = mode.header;
    root.classList.toggle("drpg-sheet-still", !acts);
    root.classList.toggle("drpg-dead-sheet", mark);
    root.classList.toggle("drpg-npc-sheet", npc);
    const portrait = root.querySelector(".character-sidebar-sheet .portrait");
    portrait?.querySelectorAll(".drpg-death-mark").forEach(stamp => stamp.remove());
    if (!mark || !portrait) return;
    const stamp = document.createElement("span");
    stamp.className = "drpg-death-mark";
    stamp.textContent = game.i18n.localize("DRPG.Class.deathMark");
    portrait.append(stamp);
}

/**
 * THE GM'S CONTROLS OF WHO IS A STUDENT, ON THE SHEET'S HEADER. "Not in the class" (`FLAGS.notInClass`, a toggle, its
 * state on `aria-pressed`) on every character, and Mark as Monokuma on a student or Unmark as Monokuma on a Monokuma -
 * each in the state it changes. Mark and Unmark were the Actors directory's right-click entries (monokuma.mjs, E22
 * C3b); the mark of a player's character still asks first (`markFromSheet`), Unmark does not. A GM's only: a player's
 * sheet draws none, and the writes refuse a player (`setNotInClass`, `setMonokuma`) whatever a console calls.
 * Redrawn each render, so a control shows the state the sheet was drawn in.
 */
function injectClassControls(app, element, mode = modeOf(app)) {
    const nameRow = element.querySelector(".character-header-sheet .name-row");
    nameRow?.querySelectorAll("[data-drpg-class-control]").forEach(button => button.remove());
    if (!mode.classControls || !nameRow) return;
    const actor = app.document;
    const { npc: out, monokuma } = mode;
    const control = (kind, icon, tip, run, pressed = null) => {
        const button = headerButton({ cls: "drpg-class-control", data: { drpgClassControl: kind }, icon, tip });
        if (pressed !== null) button.setAttribute("aria-pressed", String(pressed));
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                await run();
            } catch (err) {
                error("Could not change who is a student", err);
            } finally {
                button.disabled = false;
            }
        });
        nameRow.append(button);
    };
    control("notInClass", "fa-user-slash", game.i18n.localize(out ? "DRPG.Class.inTooltip" : "DRPG.Class.outTooltip"), async () => {
        const { setNotInClass } = await import("./monokuma.mjs");
        await setNotInClass(actor, !sheetMode(actor).npc);
    }, out);
    if (monokuma) {
        control("unmark", "fa-masks-theater", game.i18n.localize("DRPG.Monokuma.unmark"), async () => {
            const { setMonokuma } = await import("./monokuma.mjs");
            await setMonokuma(actor, false);
        });
    } else {
        control("mark", "fa-masks-theater", game.i18n.localize("DRPG.Monokuma.toggle"), async () => {
            const { markFromSheet } = await import("./monokuma.mjs");
            await markFromSheet(actor);
        });
    }
}

/* ==========================================================================
 * GIVE / TAKE ITEMS
 * --------------------------------------------------------------------------
 * Right where the GM is already looking when they decide somebody should have
 * something - or should stop having it.
 * ========================================================================== */

function injectItemButton(app, element, mode = modeOf(app)) {
    if (!mode.itemButton) return;

    const nameRow = element.querySelector(".character-header-sheet .name-row");
    if (!nameRow || nameRow.querySelector("[data-drpg-items]")) return;

    const button = headerButton({ cls: "drpg-items-button", data: { drpgItems: "" }, icon: "fa-box-open",
        tip: game.i18n.localize("DRPG.Items.buttonTooltip"), caption: game.i18n.localize("DRPG.Items.caption") });

    button.addEventListener("click", async () => {
        const { openItemManager } = await import("./gm-items.mjs");
        await openItemManager(app.document);
    });

    nameRow.append(button);
}

/**
 * ONE BUILDER FOR THE NAME ROW'S BUTTONS (E49 B2, S03-31: "buttons without captions: Level Up and Give/Take are bare
 * glyphs"). Initialise, Level Up, the class controls and Give / take were four copies of the same eight lines, each
 * an icon with its words in the tooltip alone. `caption` draws the words beside the icon as well, for the two a player
 * or a GM meets on every sheet (Level Up, Give / take); the GM's one-off controls keep the icon and the tooltip.
 */
function headerButton({ cls = "", data = {}, icon, tip, caption = "" }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-advance-button${cls ? ` ${cls}` : ""}`;
    for (const [key, value] of Object.entries(data)) button.dataset[key] = value;
    button.dataset.tooltip = tip;
    button.setAttribute("aria-label", tip);
    button.innerHTML = `<i class="fa-solid ${icon}" inert></i>`
        + (caption ? `<span class="drpg-header-caption">${foundry.utils.escapeHTML(caption)}</span>` : "");
    return button;
}

/* ==========================================================================
 * ULTIMATE
 * ========================================================================== */

function injectUltimate(app, element, mode = modeOf(app)) {
    const details = element.querySelector(".character-header-sheet .character-details");
    if (!details) return;

    const actor = app.document;
    const ultimate = actor.getFlag(MODULE_ID, FLAGS.ultimate) ?? "";
    const editable = mode.editable;

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
    // textContent, never innerHTML - this string is player-supplied.
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
        await trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.ultimate}`]: next }, { reason: "ultimate" });
        debug(`Ultimate for ${actor.name} set to "${next}".`);
    } catch (err) {
        error("Could not save the Ultimate", err);
        field.textContent = current;
    }
}

/* ==========================================================================
 * SIDEBAR
 * --------------------------------------------------------------------------
 * "Equipment" becomes "Equipped" - in this game the word equipment means the
 * whole inventory, and the sidebar block only lists what is in hand. Loadout is
 * removed outright: it holds domain cards, which do not exist here.
 * ========================================================================== */

function tidySidebar(element) {
    const sidebar = element.querySelector(".character-sidebar-sheet");
    if (!sidebar) return;

    // Structural selectors first - the template's own `.equipment-section` and
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

/* ==========================================================================
 * THE RESERVE ON THE SHEET (E24 C1a, 08.11.2026)
 * --------------------------------------------------------------------------
 * The owner's D5 (option 1): Health and Sanity are said as their reserve
 * everywhere - "N left", a full bar a full reserve. D46 (option 2): with
 * Daggerheart's pips on (its client setting useResourcePips), the module draws
 * its own pips counting the reserve; without, its bar; both from one helper and
 * one painter, which a render and a repaint both call.
 *
 * UNTIL E24 THE BAR DREW MARKS. Daggerheart stores both as marks counted up -
 * 0/4 untouched, 4/4 the wound - and `paintResourceBars`, which this replaces,
 * read the marks off the system's `<progress>` and filled the bar by them: a
 * bar at 100 % was a student out of road, and the pip layout was not touched
 * at all (S17-38). Measured at E24 C0 on `?sheet=parts`: Health 1 of 4 marked
 * drew a 25 % bar, Sanity 2 of 6 a 33.3 % one.
 *
 * WHAT IT READS. The numbers come off the actor through character.mjs
 * `reserveView`, never off the DOM, so a render and a repaint draw the same
 * thing (the repaint used to feed the system's input and progress from the
 * actor first, then read them back). Each block is found by its system key,
 * never by its order: the bar layout by its number field's `name`, the pip
 * layout by its slots' toggle (`RESERVE_PIPS`), and once painted by the
 * `data-drpg-reserve` this writes on it, which the stylesheets colour by - and
 * which a redacted sheet still carries after anonymity.mjs took the toggles'
 * `data-action` away.
 *
 * WHAT IT HIDES. Daggerheart's progress, number field, "/" and maximum (the
 * bar layout), and its slots and their "n / max" (the pip layout), each by a
 * class (`drpg-reserve-hidden`): kept in the DOM, since the system may still
 * write to them, and no longer read by anybody. The pips this draws are for
 * reading only; a click on them does nothing.
 *
 * THE FIELD. For an editor - the mode's `reserveField`: on a sheet the viewer
 * may edit, a GM always, a player who owns the student only with "Lock player
 * resources" off (Q-E24-1's default); never on the dead's or a Monokuma's - the
 * number in the row is a field of the reserve, 0 to the maximum; a change writes the marks it
 * comes to (`writeReserve`, the road resource-guard.mjs names `sheetReserve`).
 * Nobody else gets one.
 *
 * WHAT A VIEWER READS. Sanity is another player's to keep (the owner, 28.10):
 * for a user `reserveView` does not show it to, the block says "?", its track is
 * empty, no pip is drawn and no number is written into an attribute - the track
 * no longer carries `data-value`/`data-max` for anybody. The system's own
 * controls of it are emptied and its slots removed (`emptyReserveControls`,
 * EMPTIED, NOT HIDDEN), with anonymity enforced or not; anonymity.mjs empties
 * them again on a sheet it redacts.
 * ========================================================================== */

/** The pip layout's slot of each reserve, by the toggle Daggerheart 2.10.5 puts on it (resource-bar.hbs). */
const RESERVE_PIPS = Object.freeze({
    hitPoints: ".slot[data-action='toggleHitPoints']",
    stress: ".slot[data-action='toggleStress']"
});

/** What the field says it is (its label and its tooltip). */
const RESERVE_FIELD = Object.freeze({
    hitPoints: "DRPG.Reserve.fieldHealth",
    stress: "DRPG.Reserve.fieldSanity"
});

/** The class that hides the system's own controls of a reserve, which stay in the DOM. */
const RESERVE_HIDDEN = "drpg-reserve-hidden";

/**
 * A reserve's block in the sidebar's resources: painted before, the bar layout's (among `bars`, by its number field's
 * name), or the pip layout's (by its slots' toggle).
 */
function reserveBlock(section, key, bars) {
    return section.querySelector(`[data-drpg-reserve="${key}"]`)
        ?? bars.find(bar => bar.querySelector(`input.bar-input[name="system.resources.${key}.value"]`))
        ?? section.querySelector(RESERVE_PIPS[key])?.closest(".slot-value")
        ?? null;
}

/**
 * Health and Sanity on the sheet, as the reserve, in whichever layout the system drew (see the block above). Called
 * by the render (`onRenderCharacterSheet`) and by the repaint (`repaintInPlace`); `user` is whose eyes it draws for.
 */
export function paintReserves(app, element, actor = app?.document, user = game.user) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const section = root?.querySelector?.(".character-sidebar-sheet .resources-section");
    if (!section || !actor) return;
    // Whether `user` may type the reserves: the mode's (`reserveField`), the sheet's editability read off `app`; with
    // no app, ownership, as the mode reads a sheet it is not handed.
    const editor = sheetMode(actor, user, { app }).reserveField;
    // The bar layout's blocks, as patches.mjs SHEET_ANCHORS names them for the contract.
    const bars = [...root.querySelectorAll(".character-sidebar-sheet .resources-section .status-bar")];

    for (const key of Object.keys(RESERVES)) {
        const block = reserveBlock(section, key, bars);
        if (!block) continue;
        const view = reserveView(actor, key, user);
        block.dataset.drpgReserve = key;
        // The flare's memory is the reserve held, so a band or a pip lights the part that moved; nothing is
        // remembered of a view this user may not read.
        const change = view.shown && actor.id ? spentSince(`resource:${key}`, actor.id, view.left) : null;
        if (block.classList.contains("slot-value")) paintReservePips(block, view, change);
        else paintReserveBar(block, view, change);
        if (!view.shown) emptyReserveControls(block);
        paintReserveRow(block, view, actor, editor);
    }
    paintStateBadges(section, actor);
}

/*
 * THE TWO STATES ARE PUBLIC ON THE SHEET (E95 C5, 10.11.2026; the owner's "Breakdown i wounded maja byc publiczne w
 * karcie postaci, tak jak np. imie albo hp"). The same commit took both icons off every token (states.mjs
 * `effectIconShown`), so the sheet is where a table reads them. Measured on bc750112 before (STATUS E95-C5): no reader
 * of either layout - the owner, a GM, another player, an Observer - found Breakdown anywhere on the sheet, and Wounded
 * only as the Actions label's class and tooltip. Now a badge of each state the character is in stands under the
 * reserves, for every reader, a student's, a Monokuma's and an NPC's alike: its icon, its name and a tooltip saying
 * what it does (`DRPG.States.<id>.description`). The row sits after the reserves' section, outside every reserve's
 * block, so anonymity.mjs `redactValues`, which strips the Sanity block's tooltips, leaves it whole: the state is
 * public, the Sanity number is not ("?" as before), though a Breakdown badge tells another player Sanity is gone (the
 * owner asked for that). Read from the rule (`stateHeld`, the reading `syncOnce` writes the status from), so a sheet
 * drawn before the status lands already says it; redrawn by every paint, so a repaint takes a lifted state off. The row
 * itself is never taken off (E95 C5 fix): its height is reserved, so no state moves the sheet.
 */
function paintStateBadges(section, actor) {
    const held = Object.values(STATES).filter(state => stateHeld(actor, state));
    // The row stays in every state, empty when none is held, and the stylesheet gives it its height either way: a badge
    // that comes or goes moves nothing below it (E95 C5 fix; the owner's 10.11: "layout karty powinien uwzgledac puste miejsce").
    let row = section.parentElement?.querySelector(":scope > .drpg-state-badges") ?? null;
    if (!row) {
        row = document.createElement("div");
        row.className = "drpg-state-badges";
        section.after(row);
    }
    row.replaceChildren(...held.map(state => {
        const badge = document.createElement("span");
        badge.className = "drpg-state-badge";
        badge.dataset.drpgState = state.id;
        badge.dataset.tooltip = game.i18n.localize(`DRPG.States.${state.id}.description`);
        badge.tabIndex = 0;
        const icon = document.createElement("img");
        icon.src = state.img;
        icon.alt = "";
        const name = document.createElement("span");
        name.textContent = game.i18n.localize(`DRPG.States.${state.id}.name`);
        badge.append(icon, name);
        return badge;
    }));
}

/**
 * EMPTIED, NOT HIDDEN, whatever the anonymity setting (E24 fix G2B; general m2, security N-2; E24-06, R1445). The class
 * hides the system's controls of a reserve; for a view not shown they also held it - the progress's `value` and `max`,
 * the number field's, the label's maximum, and in the pip layout one slot a point, the marked ones `filled` - which
 * anonymity.mjs empties only on a sheet it redacts, so with "Enforce anonymity" off another player's sheet kept
 * Sanity in its DOM. Here they are emptied on every such sheet, and the slots go: their count is the maximum.
 */
function emptyReserveControls(block) {
    for (const progress of block.querySelectorAll("progress")) {
        progress.removeAttribute("value");
        progress.removeAttribute("max");
    }
    for (const input of block.querySelectorAll("input.bar-input")) {
        input.removeAttribute("value");
        input.removeAttribute("max");
        input.value = "";
    }
    for (const label of block.querySelectorAll(".bar-label, .slot-label .value")) label.textContent = "";
    for (const slot of block.querySelectorAll(".slot")) slot.remove();
}

/**
 * The bar layout: the module's flat bar filled to what is LEFT, the band over the part that just moved, the system's
 * controls hidden.
 *
 * THE BAR IS UPDATED, NOT REBUILT (Dawid's flicker, kept from `paintResourceBars`). A MutationObserver over one
 * Health change found the bar removed and added again, twice; a new element has no width to travel from, so the fill
 * snapped instead of sliding. So the track is kept and its fill's width moved; a render builds it once.
 *
 * THE FLARE IS THE PIPS' ONE, aimed at the piece that changed, resuming mid-animation on a redraw (`markSpent`
 * carries the age). `spentSince` counts what is HELD, which is now what the bar draws, so its range is the band.
 */
function paintReserveBar(block, view, change) {
    const value = block.querySelector(".status-value") ?? block;
    const progress = value.querySelector("progress.progress-bar");
    const pct = view.shown ? view.pct : 0;
    // The system's controls, kept: hidden by a class, in the DOM, read by nobody.
    for (const el of value.children) {
        if (el.matches("input.bar-input") || el.matches(".bar-label") || (el.localName === "span" && el.textContent.trim() === "/")) {
            el.classList.add(RESERVE_HIDDEN);
        }
    }
    if (progress) {
        progress.classList.add("drpg-bar-replaced");
        progress.style.setProperty("--drpg-bar-pct", `${pct}%`);
    }

    for (const stale of value.querySelectorAll(".drpg-resource-bar")) {
        if (stale.dataset.resource !== view.key) stale.remove();
    }
    let track = value.querySelector(".drpg-resource-bar");
    let fill = track?.querySelector(".drpg-resource-fill") ?? null;
    if (!track || !fill) {
        track?.remove();
        track = document.createElement("div");
        track.className = "drpg-resource-bar";
        fill = document.createElement("span");
        fill.className = "drpg-resource-fill";
        track.append(fill);
        if (progress) progress.after(track);
        else value.append(track);
    }
    // The band from last time goes whatever happens: it describes a change that is no longer the latest.
    track.querySelectorAll(".drpg-resource-delta").forEach(band => band.remove());
    track.dataset.resource = view.key;
    // No number in an attribute (E24 C1a): the track carried `data-value` and `data-max` until E24.
    delete track.dataset.value;
    delete track.dataset.max;
    fill.style.width = `${pct}%`;

    if (change && view.max > 0) {
        const from = Math.max(0, change.from - 1);
        const to = Math.min(view.max, change.to);
        if (to > from) {
            const band = document.createElement("span");
            band.className = "drpg-resource-delta";
            band.style.left = `${(from / view.max) * 100}%`;
            band.style.width = `${((to - from) / view.max) * 100}%`;
            markSpent(band, change, change.from);
            track.append(band);
        }
    }
}

/**
 * The pip layout (D46 = 2): the module's own pips, `max` of them with `left` filled, in place of the system's slots,
 * which are hidden. For reading only - no `data-action`, no listener. A view not shown draws none.
 */
function paintReservePips(block, view, change) {
    const slots = block.querySelector(".slot-bar");
    slots?.classList.add(RESERVE_HIDDEN);
    block.querySelector(".slot-label .value")?.classList.add(RESERVE_HIDDEN);
    let pips = block.querySelector(".drpg-reserve-pips");
    if (!pips) {
        pips = document.createElement("div");
        pips.className = "drpg-reserve-pips";
        pips.setAttribute("aria-hidden", "true");
        if (slots) slots.after(pips);
        else block.prepend(pips);
    }
    const count = view.shown ? view.max : 0;
    pips.replaceChildren(...Array.from({ length: count }, (_, i) => {
        const pip = document.createElement("span");
        pip.className = i < view.left ? "drpg-reserve-pip drpg-pip-full" : "drpg-reserve-pip";
        return markSpent(pip, change, i + 1);
    }));
}

/**
 * The row under the bar or the pips: "3 / 4" (`reserveRow`), "?" for a view not shown, and for an editor the
 * number is the field. A field that has the focus keeps what is being typed into it; its maximum still follows.
 */
function paintReserveRow(block, view, actor, editor) {
    let row = block.querySelector(".drpg-reserve-row");
    if (!row) {
        row = document.createElement("div");
        row.className = "drpg-reserve-row";
        const host = block.querySelector(".status-value") ?? block.querySelector(".drpg-reserve-pips") ?? null;
        if (host?.classList.contains("status-value")) host.append(row);
        else if (host) host.after(row);
        else block.append(row);
    }
    if (!editor || !view.shown) {
        row.textContent = reserveRow(view);
        return;
    }
    const typing = row.querySelector("input.drpg-reserve-field");
    if (typing && typing === document.activeElement) {
        typing.max = String(view.max);
        return;
    }
    const field = document.createElement("input");
    field.type = "number";
    field.className = "drpg-reserve-field";
    field.min = "0";
    field.max = String(view.max);
    field.step = "1";
    field.value = String(view.left);
    const label = game.i18n.localize(RESERVE_FIELD[view.key]);
    field.setAttribute("aria-label", label);
    field.dataset.tooltip = label;
    // Not the system's form: the field has no `name`, and its change goes no further than here, so Daggerheart's
    // submit-on-change sends nothing for it; Enter writes it rather than submitting the sheet.
    field.addEventListener("change", event => {
        event.stopPropagation();
        // Nothing written: the field shows the reserve again - unless a repaint has replaced it (the new one was drawn
        // from the actor) or it is being typed into again (E24 fix G2B; general n3, R1497).
        writeReserve(actor, view.key, field.valueAsNumber)
            .then(done => {
                if (done === null && field.isConnected && field !== document.activeElement) field.value = String(reserveView(actor, view.key).left);
            })
            .catch(err => error("Could not write a reserve from the sheet", err));
    });
    field.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        field.blur();
    });
    // The row's text around the number, in the page's language (" / 4" since 1.2.102): the field stands where `{n}` stands.
    const [before, after = ""] = game.i18n.format("DRPG.Reserve.leftRow", { n: "{n}", max: view.max }).split("{n}");
    row.replaceChildren(before, field, after);
}

/**
 * The field's write (E24 C1a; MARKED): `n` is the reserve typed, held to 0..max, and the marks it comes to are
 * written - `max - n` - through resource-guard.mjs's road as `sheetReserve`. A GM's write is the GM's own. A player's
 * goes as a plain write, which the GMs' audit treats as it treated Daggerheart's own number field, and which this
 * browser's guard cuts while "Lock player resources" is on (the reason is not in `JUDGED`, and the road marks it as a
 * hand edit: resource-guard.mjs's note). Nothing to write answers null.
 */
export async function writeReserve(actor, key, n) {
    if (!RESERVES[key] || !actor) return null;
    const { max, left } = reserveOf(actor, key);
    const want = Math.min(max, Math.max(0, Math.round(Number(n))));
    if (!Number.isFinite(want) || want === left) return null;
    return trustedWrite(actor, { [`system.resources.${key}.value`]: max - want }, { reason: "sheetReserve" });
}

/* The Party sheet's two slot sections of a member, by the label's tooltip key (party-members.hbs, Daggerheart 2.10.5):
   found with no slot drawn too (a maximum of 0). */
const PARTY_RESERVES = Object.freeze({ hitPoints: "DAGGERHEART.GENERAL.HitPoints.plural", stress: "DAGGERHEART.GENERAL.stress" });

/**
 * THE PARTY SHEET AS THE RESERVE (E24 C1b, 08.11.2026; Q-E24-3's default, the owner's D5 option 1 and 28.10).
 * Daggerheart's Party sheet (templates/sheets/actors/party/party-members.hbs) draws each member's Health and Stress as
 * the marks: `.current` the marks, a slot `filled` per point marked, and every slot a toggle (`toggleHitPoints`,
 * `toggleStress`) whose `data-value` is the marks it sets. For every character member - a student, and since E24 fix
 * G2B an NPC kept out of the class and a Monokuma, as their sheets read (general m4; the token side is states.mjs's) -
 * through `reserveView` for `user`: `.current` what is left, the first `left` slots filled. For a GM (the mode's
 * `pipEdit`) each
 * slot's `data-value` is turned (`max - i + 1` on the i-th), so that Daggerheart's own toggle - "a point at or below
 * the value takes it to one less, any other sets it" - fills or empties the reserve up to the pip pressed; for a player
 * the toggles go (a player changes their reserve on their own sheet, where Lock player resources allows). Sanity not
 * shown to `user` is emptied, not hidden: "?" in place of its numbers and no slot, since their count is its maximum.
 * Exported for R1447 and R1484, which hand `find` a stand-in's member.
 */
export function paintPartyReserves(app, element, user = game.user, find = uuid => globalThis.fromUuidSync?.(uuid) ?? null) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    for (const member of root?.querySelectorAll?.(".actor-resources") ?? []) {
        const uuid = member.querySelector("[data-action='openDocument'][data-uuid]")?.dataset.uuid
            ?? member.querySelector("[data-actor-id]")?.dataset.actorId ?? null;
        const actor = uuid ? find(uuid) : null;
        if (actor?.type !== "character") continue;
        const toggles = sheetMode(actor, user).pipEdit;
        for (const [key, tip] of Object.entries(PARTY_RESERVES)) {
            const section = member.querySelector(`.slot-label[data-tooltip="${tip}"]`)?.closest(".slot-section");
            if (!section) continue;
            const view = reserveView(actor, key, user);
            const value = section.querySelector(".slot-label .value");
            const slots = [...section.querySelectorAll(".slot")];
            if (!view.shown) {
                // No slot: their count is the maximum (E24 fix G2B; security S-2, R1484).
                slots.forEach(slot => slot.remove());
                if (value) value.textContent = "?";
                continue;
            }
            slots.forEach((slot, i) => {
                slot.classList.toggle("filled", i < view.left);
                if (toggles) slot.dataset.value = String(view.max - i);
                else {
                    delete slot.dataset.action;
                    delete slot.dataset.value;
                }
            });
            const current = value?.querySelector(".current"), top = value?.querySelector(".max");
            if (current) current.textContent = String(view.left);
            if (top) top.textContent = String(view.max);
        }
    }
}

/**
 * Put the readied Crime and Cleaning Tool into the sidebar's Equipped list.
 *
 * That list is Daggerheart's `equippedItems`, which means its own weapons and
 * armour. This module's tools are `loot` with a category flag, so nothing put
 * them there - and "Equipped" showing everything except the two things the
 * module calls equipped is worse than not renaming the heading at all. It also
 * made the one mechanic that now depends on readying something (see
 * `equippedWeapon` in murder-rules.mjs) invisible in the place a player looks to
 * check it.
 *
 * Rows are built to match `daggerheart.inventory-item-compact` - same classes,
 * same order - so they inherit the system's styling instead of needing a
 * parallel set of rules that would drift from it.
 */
/**
 * A row about something that has stopped existing (trap 91).
 *
 * A SILENT STEAL LEAVES ONE. An unseen steal or rifle (palm.mjs
 * `stealFromPerson`, stash-reach.mjs `stealFromVault`, through inventory.mjs `transferItem`
 * since E35 C3) deletes the item with `render: false` so the victim's open
 * sheet does not redraw for it - the thing has really gone, and what is
 * suppressed is the refresh. Until something else
 * redraws the sheet the row is still on screen, and every control on it is
 * pointing at a document that is not there: readying it, using it, handing it
 * over, opening its sheet. An exception in the victim's console is a worse
 * notification than the notification it was avoiding.
 *
 * Registered in the CAPTURE phase on the row itself, so it runs before the
 * row's own listener AND before any button inside it - one guard covering
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
        // again" - this IS looking again.
        app?.render(false);
    }, true);
}

function injectEquippedTools(app, element, mode = modeOf(app)) {
    const actor = app.document;
    if (!mode.equipped) {
        hideSidebarSection(element, "equipment-section");
        return;
    }

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
        /* BOTH TAGS (E24 C3b, 08.11.2026; E24-23, the owner's 28.10): the row drew its slot's label alone, so a
           Murder Weapon that is also a Tool read as a Murder Weapon only. The gear row's own tags (`itemTags`: the
           home and the other roles, each once), the tier after them; the slot's label where an item has none. */
        const tags = itemTags(item, true);
        // One line, as the slot's label was: the tags side by side, not a block each (shots/c3b: three stacked lines).
        const labels = (tags.length ? tags : [{ key: category, label: ITEM_CATEGORIES[category]?.label ?? category, hint: null }])
            .map(tag => `<span class="drpg-equipped-tag" data-drpg-role="${classSafe(tag.key)}"${tag.hint
                ? ` data-tooltip="${foundry.utils.escapeHTML(tag.hint)}"` : ""}>${foundry.utils.escapeHTML(tag.label)}</span>`).join(" · ");
        const tierLabel = tier !== undefined && tier !== null
            ? `<span class="drpg-equipped-tier"> - T${foundry.utils.escapeHTML(String(tier))}</span>` : "";
        const li = document.createElement("li");
        li.className = "inventory-item inventory-item-compact drpg-equipped-tool";
        li.dataset.drpgEquipped = category;
        li.dataset.itemId = item.id;
        li.dataset.itemUuid = item.uuid;
        li.draggable = false;
        li.innerHTML = `
            <div class="img-portait" data-tooltip="#item#${item.uuid}">
                <img src="${foundry.utils.escapeHTML(item.img ?? "")}" class="item-img" alt="" />
            </div>
            <span class="item-name">${foundry.utils.escapeHTML(item.name)}</span>
            <div class="item-labels"><div class="label">${labels}${tierLabel}</div></div>`;

        guardRow(li, item, app);
        li.addEventListener("click", event => {
            if (event.target.closest("[data-drpg-row-action]")) return;
            item.sheet?.render(true);
        });

        list.append(li);
    }

    // Daggerheart's own rows in this list are hidden by CSS - "Equipped" here
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

/*
 * AN EMPTY EXPERIENCE SAYS SO (E24 C3b, 08.11.2026; E24-23, audit S15-02, S03-29). A student with no experiences
 * showed the Experience heading over nothing, which reads as a part that failed to draw. One line, as the Equipped
 * list says its own empty state (`drpg-experience-empty`), worded from the player handbook (two at +2 at the start,
 * one more from a Level Up). Not for a Monokuma, whose sheet has no experiences to keep.
 */
function noteEmptyExperience(app, element, mode = modeOf(app)) {
    const actor = app?.document;
    if (!actor) return;
    if (!mode.experience) {
        hideSidebarSection(element, "experience-section");
        return;
    }
    const list = element.querySelector(".character-sidebar-sheet .experience-section .experience-list");
    if (!list) return;
    list.querySelectorAll(".drpg-experience-empty").forEach(row => row.remove());
    if (Object.keys(actor.system?.experiences ?? {}).length) return;
    const empty = document.createElement("p");
    empty.className = "notes drpg-experience-empty";
    empty.textContent = game.i18n.localize("DRPG.SheetNotes.noExperiences");
    list.append(empty);
}

/*
 * KNOWN PASSAGES (E79 C7, 15.10.2026; the E79 plan's P9-0 and P10-0, the mockup of 14.10). The secret
 * passages this character knows, under its Experience, on its owners' sheets: each named by the two
 * rooms it joins as this viewer may name them, 'the way is shut' where the veto would turn the
 * character back now (movement.mjs `passageOpenFor`, the frame's own question), a click on the name
 * taking this browser's camera there, and 'Show the passage' to a student in the same room. Read from
 * this browser's copy (passages.mjs `passagesKnownBy`) - a GM's browser reads the GMs' records - and
 * drawn again when the copy changes (`drpgPassagesChanged`). The page holds the rooms' names and the
 * two words; the passage's id and its stretch stay in this function's closures (R562, scenario 76 G).
 */

/**
 * The list's rows, `[{ passage, label, shut, way }]` sorted by `label`: `passage` the stretch
 * (`passagesKnownBy`'s row), `label` "Room - Room" as `listenLabels` names them for this viewer, `shut`
 * whether the passage does not open for the character from where it stands, `way` a one-way tunnel's
 * `{ from, to }` named as the label names them, null for one that goes both ways (H81-02). A passage on a scene this
 * world no longer holds is left out. `deps` are the suite's (R562).
 */
export function knownPassageRows(actor, { known, mastermind = false, sceneOf = id => game.scenes?.get(id) ?? null,
    sides = passageRooms, knownRooms = roomsKnownToMe, opens = passageOpenFor, place = locateActor } = {}) {
    const given = known === undefined ? {} : { known };
    const here = place(actor);
    const rows = [];
    for (const passage of passagesKnownBy(actor, { mastermind, ...given })) {
        const scene = sceneOf(passage.sceneId);
        if (!scene) continue;
        const rooms = sides(scene, passage, passage.level) ?? [];
        const names = listenLabels(rooms.filter(Boolean), knownRooms(scene));
        const label = [rooms[0], rooms[1]].map(room => (room ? names.get(room) : "-")).join(" - ");
        // A one-way tunnel's two rooms in its direction, as the label names them (H81-02); null both ways.
        const one = passage.oneWay === 0 || passage.oneWay === 1 ? passage.oneWay : null;
        const way = one === null ? null : { from: rooms[one] ? names.get(rooms[one]) : "-", to: rooms[1 - one] ? names.get(rooms[1 - one]) : "-" };
        const from = here?.scene?.id === scene.id ? here.room : null;
        // The frame's own question, asked as the frame asks it (fog-doorways.mjs): no mover but on a GM's
        // browser for the Mastermind, whom only the GMs' record names there; at the token's height, where `from`
        // was read (H81 fix r1, movement.mjs `passageRooms`' note). The label's rooms are the map's, for no token.
        const elevation = from !== null && Number.isFinite(here?.tokenDoc?.elevation) ? here.tokenDoc.elevation : null;
        const shut = !opens(actor, passage, scene, { from, level: passage.level, mover: mastermind ? { mastermind: true } : null, elevation, ...given });
        rows.push({ passage, label, shut, way, rooms: [rooms[0] ?? null, rooms[1] ?? null] });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * This browser's camera to a passage, on its scene and floor (passages.mjs `viewPassage`, E80 fix r1-G2): a
 * stretch's middle, or a tunnel's end on the floor on screen when it has one there, else its first end, that
 * end's floor viewed.
 */
async function panToPassage(passage) {
    return viewPassage(level => passageSpot(passage, level));
}

/** 'Show the passage': who in the room to show it to (handover.mjs `askWhoIsHere`), then the primary GM's judgement. */
async function showPassageDialog(actor, row) {
    const { askWhoIsHere } = await import("./handover.mjs");
    const targetId = await askWhoIsHere(actor, {
        title: game.i18n.format("DRPG.Passage.show.title", { passage: row.label }),
        intro: room => game.i18n.format("DRPG.Passage.show.intro", { room }),
        note: game.i18n.localize("DRPG.Passage.show.note"),
        okLabel: game.i18n.localize("DRPG.Passage.show.button"),
        listBox: true
    });
    if (!targetId) return;
    const { requestPassageShare } = await import("./gm-bridge.mjs");
    const res = await requestPassageShare({ actorId: actor.id, targetId, passageId: row.passage.id });
    if (!res.ok) debug("A secret passage was not shown", res.reason);
}

/**
 * 'Go through' (E80 C2): a tunnel's row asks first on this browser, by the doors' rules as this browser holds them
 * (movement.mjs `tunnelVerdict`, the price included), and a refusal is said here in its key's words, as the bridge
 * says it (`tunnelRefusalText`: `DRPG.Bridge.why.<code>`, "that room" for the room); then the primary GM judges it
 * again and moves the token (gm-bridge.mjs `passage.cross`), and says its refusal through the bridge. The button
 * waits for the answer, so one click asks once. Scenario 76 U clicks it.
 *
 * ENABLED WHEREVER THE TOKEN STANDS (H81-03, 20.10.2026; the owner's item 4b and the design A10's step 11, which
 * disables it away from an end). A disabled button says the truth only while the row is drawn again as the token
 * moves, and nothing draws it then: of this file's hooks (`registerSheetTweaks`) none draws the list on a token's move -
 * the list is drawn on the sheet's own render and on `drpgPassagesChanged`; `onTunnelStep` hears a move (H81-13), and
 * goes through, but draws nothing - and a linked token's move is no update of its
 * actor, which is what renders an actor's sheet (Foundry's rule as this module reads it; Daggerheart's sheet is not on
 * this machine). Read off the source, not a table. So the click says where to stand instead: `notAtPassage`'s words.
 * A token moved onto an end takes this road too, with no button (`onTunnelStep`), and the bridge's `hush` for it.
 *
 * ONE ASK PER CHARACTER AT A TIME, FROM EITHER ROAD (H81 fix C3, 21.10.2026; the review's H81-C3-R2). The button stopped
 * a second ask only for itself; a drag asks with no button, and the primary judges each ask from where the token stands
 * when its turn comes (`crossTunnel`'s `serialWrite`), so a click while a drag's ask was on its way went through twice -
 * two prices, and back where she started. While `crossingsAsked` holds the character, another ask here, a drag's or a
 * click's from any open sheet, is not sent.
 */
const crossingsAsked = new Set();

async function goThrough(actor, row, button, mastermind, { hush = [] } = {}) {
    if (crossingsAsked.has(actor.id)) return;
    const scene = game.scenes?.get(row.passage.sceneId) ?? null;
    const ask = token => tunnelVerdict(actor, { id: row.passage.id, sceneId: row.passage.sceneId }, token,
        { mover: mastermind ? { gm: true, mastermind: true } : null });
    // As the primary picks it (passages-gm.mjs `crossTunnel`): of two tokens on the scene, the one at an end.
    const verdicts = Array.from(scene?.tokens ?? []).filter(t => t.actorId === actor.id).map(ask);
    const verdict = verdicts.find(v => !v?.code) ?? verdicts[0] ?? ask(null);
    if (verdict?.code) {
        ui.notifications.warn(tunnelRefusalText(verdict));
        return;
    }
    crossingsAsked.add(actor.id);
    if (button) button.disabled = true;
    try {
        const { requestPassageCross } = await import("./gm-bridge.mjs");
        const res = await requestPassageCross({ actorId: actor.id, passageId: row.passage.id }, { hush });
        if (!res.ok) debug("A tunnel was not gone through", res.reason);
    } finally {
        crossingsAsked.delete(actor.id);
        if (button) button.disabled = false;
    }
}

/*
 * A TOKEN MOVED ONTO A TUNNEL'S END GOES THROUGH IT (H81-13 and H81-14, 21.10.2026; the owner's call of 21.10, the
 * token chosen over a click on the mark: a GM's browser draws no mark, and a click on one cannot be measured headless).
 * The mover's browser alone reads the move - the user whose update it is, Foundry's `userId` - once the token is at rest
 * (movement.mjs `whenAtRest`, as fog.mjs reads a room, so the landing does not race the drag's animation), decides it
 * with movement.mjs `tunnelStepTarget`, and takes the button's road: `goThrough`'s own check and words, then the
 * bridge's `passage.cross`, judged and written on the primary GM. Nothing new goes on the wire and nothing is written
 * here. Where the move started is read before it is written (`preUpdateToken` runs on the writer's browser alone) and
 * kept through the updates of one move until it rests; a move vetoed before it is written leaves nothing waiting, and
 * the next one reads its start again. Only for a student whose sheet shows 'Known passages' to this user
 * (`injectKnownPassages`: its owner, never a Monokuma), the Mastermind as the sheet asks for it. Scenario 76 U drags one.
 *
 * WHAT IS NOT THIS USER'S STEP (H81 fix C3, 21.10.2026; the review's H81-C3-R1 and H81-C3-R3). A token this browser
 * places itself through Foundry's region teleport (movement.mjs `isPlacing`: the gather, the cast's placing, a
 * Clean-up's body) is never a step, whatever options Foundry writes. A move of the token by anybody else - the
 * primary's landing, the GMs' put-back, a GM's hand - while this browser's move comes to rest ends that move's wait:
 * where the token rests is no longer where this user put it, and a click's landing read as a drag onto the far end was a
 * second crossing. At rest, a put-back this browser sent is on its way (`gmSpotWhy` = "putBack", filled in the
 * refusing hook, before its write): the refusal has said its words, and the drag asks nothing. One the GMs send that
 * lands after the ask is refused by the primary as `cannotNow`, which the drag's road keeps quiet (`hush`): the
 * put-back says its own line. Tier 2 "H81 C3 drag" and scenario 76 U.
 */
const tunnelSteps = new Map();

const stepSpot = tokenDoc => ({ x: tokenDoc.x, y: tokenDoc.y, level: levelOf(tokenDoc), width: tokenDoc.width ?? 1, height: tokenDoc.height ?? 1 });

/** Before this browser writes a token's move: where it starts, unless a move of the same token is still coming to rest. */
function noteStepStart(tokenDoc, changes) {
    if (!tokenDoc?.id || !isMoveChange(changes) || isPlacing(tokenDoc) || tunnelSteps.get(tokenDoc.id)?.waiting) return;
    tunnelSteps.set(tokenDoc.id, { from: stepSpot(tokenDoc), turn: 0, waiting: false });
}

/** After it: once the token rests, the newest update of the move decides whether it goes through a tunnel. */
async function onTunnelStep(tokenDoc, changes, options, userId) {
    if (!isMoveChange(changes)) return;
    if (userId !== game.user?.id || isPlacing(tokenDoc)) {
        tunnelSteps.delete(tokenDoc?.id);
        return;
    }
    const entry = tunnelSteps.get(tokenDoc?.id);
    if (!entry) return;
    const scene = tokenDoc.parent ?? null;
    const actor = tokenDoc.actorId ? game.actors?.get(tokenDoc.actorId) ?? null : null;
    const mode = actor?.type === "character" ? sheetMode(actor) : null;
    if (!scene || !mode?.passages) {
        tunnelSteps.delete(tokenDoc.id);
        return;
    }
    const turn = ++entry.turn;
    entry.waiting = true;
    await whenAtRest(tokenDoc);
    if (tunnelSteps.get(tokenDoc.id) !== entry || entry.turn !== turn) return;
    tunnelSteps.delete(tokenDoc.id);
    if (gmSpotWhy(tokenDoc) === "putBack") return;
    const mastermind = mode.mastermind;
    const step = tunnelStepTarget({ changes, options, from: entry.from, to: stepSpot(tokenDoc), ends: tunnelEndsFor(actor, scene.id, null, { mastermind }),
        grid: scene.grid?.size ?? 100, userId, me: game.user.id });
    if (step) await goThrough(actor, { passage: { id: step.id, sceneId: scene.id } }, null, mastermind, { hush: ["cannotNow"] });
}

/**
 * One row of 'Known passages', `knownPassageRows`' `row` drawn, its buttons not yet wired (`injectKnownPassages` wires
 * them): the rooms as a link, 'the way is shut' where it is, a line under them saying what a player does with it -
 * walk through the gap of a passage in a wall, which has no button (H81-04), or which way a one-way tunnel goes
 * (H81-02) - 'Go through' for a tunnel and 'Show the passage'. Each line holds while the row stands: which way a
 * passage goes is in the copy, and a changed copy draws the list again (`drpgPassagesChanged`). R904 draws it.
 */
export function knownPassageItem(row) {
    const t = key => foundry.utils.escapeHTML(game.i18n.localize(key));
    const li = document.createElement("li");
    li.className = `drpg-passage-row${row.shut ? " is-shut" : ""}`;
    const tunnel = Array.isArray(row.passage?.ends);
    const note = tunnel
        ? (row.way ? `<span class="drpg-passage-note" data-drpg-passage-note="oneWay">${foundry.utils.escapeHTML(game.i18n.format("DRPG.Passage.list.oneWay", row.way))}</span>` : "")
        : `<span class="drpg-passage-note" data-drpg-passage-note="walk">${t("DRPG.Passage.list.walk")}</span>`;
    li.innerHTML = `<a class="drpg-passage-where" role="button" tabindex="0" title="${t("DRPG.Passage.list.where")}">${
        foundry.utils.escapeHTML(row.label)}</a>${row.shut ? `<span class="drpg-passage-shut">${t("DRPG.Passage.list.shut")}</span>` : ""}${note}`
        + (tunnel ? `<button type="button" class="drpg-mini-button drpg-passage-cross"${tipAttr("DRPG.Tips.Setup.goThroughTooltip")}>${t("DRPG.Passage.list.cross")}</button>` : "")
        + `<button type="button" class="drpg-mini-button drpg-passage-show"${tipAttr("DRPG.Tips.Setup.showThePassageTooltip")}>${t("DRPG.Passage.show.button")}</button>`
        // The Mastermind's Seal on a passage at their door (E91 C5, D038; `injectKnownPassages` marks the row).
        + (row.seal ? `<button type="button" class="drpg-mini-button drpg-passage-seal" data-tooltip="${t("DRPG.Passage.list.sealTip")}">${
            t("DRPG.Passage.list.seal")}</button>` : "");
    return li;
}

/**
 * THE MASTERMIND'S DOOR ON THEIR SHEET (E91 C4, C5; D038, 12.11.2026). On the browser of the player who holds the part
 * (settings.mjs `myMastermindLair`; a GM locks rooms in Room Setup and closes passages in the tab): a line naming the
 * room and whether its door is locked, with Lock or Unlock, and a Seal on every passage the sheet lists with a side in
 * it. The lock is the GM's room lock (`isLocked`, as the door reads it), asked of the primary GM (bridge-asks.mjs
 * `requestLairLock`, `requestLairSeal`). Nothing here is drawn on anybody else's browser.
 */
function lairLocked(room) {
    return [...(game.scenes ?? [])].some(scene => roomRegions(scene, room).length && isLocked(scene, room));
}

function lairBlock(actor, room) {
    const t = key => foundry.utils.escapeHTML(game.i18n.localize(key));
    const locked = lairLocked(room);
    const div = document.createElement("div");
    div.className = "drpg-lair-line";
    div.innerHTML = `<span class="drpg-lair-room">${foundry.utils.escapeHTML(game.i18n.format("DRPG.Mastermind.lair.room", { room }))}</span>`
        + `<span class="drpg-lair-state">${t(locked ? "DRPG.Mastermind.lair.locked" : "DRPG.Mastermind.lair.open")}</span>`
        + `<button type="button" class="drpg-mini-button drpg-lair-lock">${t(locked ? "DRPG.Mastermind.lair.unlock" : "DRPG.Mastermind.lair.lock")}</button>`;
    const button = div.querySelector(".drpg-lair-lock");
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        try {
            const { requestLairLock } = await import("./gm-bridge.mjs");
            await requestLairLock({ actorId: actor.id, lock: !locked });
        } catch (err) {
            error("Could not change the room's lock", err);
        } finally {
            actor.sheet?.render(false);
        }
    });
    return div;
}

/** The list, after the Experience, on an owner's sheet of a student that knows a passage; none for a Monokuma. */
function injectKnownPassages(app, element, mode = modeOf(app)) {
    const actor = app.document;
    const root = element instanceof HTMLElement ? element : element?.[0];
    const host = root?.querySelector(".character-sidebar-sheet .shortcut-items-section");
    if (!host) return;
    host.querySelector(".drpg-passages-section")?.remove();
    if (!actor || !mode.passages) return;
    const { mastermind } = mode;
    // The Mastermind's own room, on their player's browser alone (`lairBlock`).
    const lair = mode.lair ?? null;
    const rows = knownPassageRows(actor, { mastermind }).map(row => ({ ...row, seal: Boolean(lair) && row.rooms.includes(lair) }));
    if (!rows.length && !lair) return;

    const t = key => foundry.utils.escapeHTML(game.i18n.localize(key));
    const section = document.createElement("div");
    section.className = "drpg-passages-section";
    section.innerHTML = (rows.length ? `<div class="title"><side-line-div class="invert"></side-line-div><h3>${t("DRPG.Passage.list.title")}</h3>`
        + `<side-line-div></side-line-div></div>` : "") + `<ul class="drpg-passage-list"></ul>`;
    const list = section.querySelector("ul");
    if (lair) list.before(lairBlock(actor, lair));
    for (const row of rows) {
        const li = knownPassageItem(row);
        li.querySelector(".drpg-passage-seal")?.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.disabled = true;
            try {
                const { requestLairSeal } = await import("./gm-bridge.mjs");
                await requestLairSeal({ actorId: actor.id, passageId: row.passage.id });
            } catch (err) {
                error("Could not seal a secret passage", err);
            }
        });
        const where = li.querySelector(".drpg-passage-where");
        const pan = event => {
            event.preventDefault();
            event.stopPropagation();
            panToPassage(row.passage).catch(err => debug("Could not show a secret passage on the map", err));
        };
        where.addEventListener("click", pan);
        where.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") pan(event); });
        li.querySelector(".drpg-passage-show").addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            showPassageDialog(actor, row).catch(err => error("Could not show a secret passage", err));
        });
        const cross = li.querySelector(".drpg-passage-cross");
        cross?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            goThrough(actor, row, cross, mastermind).catch(err => error("Could not go through a secret passage", err));
        });
        list.append(li);
    }
    const experience = host.querySelector(".experience-section");
    if (experience) experience.after(section);
    else host.append(section);
}

/** This browser's copy of the passages changed: the open sheets of its own students are drawn again. */
function redrawPassageSheets() {
    for (const actor of game.actors ?? []) {
        if (actor.type === "character" && actor.sheet?.rendered && sheetMode(actor).owner) actor.sheet.render(false);
    }
}

/**
 * The safeword, bottom-left of the sheet.
 *
 * On the sheet rather than in the HUD or a floating launcher for one reason:
 * the sheet is the window a player already has open and already looks at, and
 * the moment this is needed is not the moment to go hunting for a control.
 *
 * Present for everyone - a Monokuma's player is at the same table, and a
 * character who died an hour ago does not stop being someone's evening.
 * Anchored to the window content, so it does not depend on Daggerheart's
 * internal layout holding still.
 */
function injectSafeword(app, element, mode = modeOf(app)) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const host = root?.querySelector(".window-content") ?? root;
    if (!host) return;

    host.querySelector(".drpg-safeword-button")?.remove();
    // A Monokuma's sheet is the GM's, and the Stop is the players' (E49 B2, S03-31).
    if (mode && !mode.safeword) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "drpg-safeword-button";
    button.dataset.tooltip = game.i18n.localize("DRPG.Safeword.tooltip");
    button.setAttribute("aria-label", game.i18n.localize("DRPG.Safeword.tooltip"));
    /*
     * THE WORD IS THE TABLE'S, NOT THE MODULE'S (E15).
     *
     * It used to be `DRPG.Safeword.word` - a string in the language file, and
     * therefore one word for everybody who installs this. That is wrong for the
     * one control in the module whose whole job is to be reached without
     * thinking: a table that has never met this group's in-joke reads an
     * unfamiliar word and hesitates, and the hesitation is precisely what the
     * button exists to remove.
     *
     * Read at render rather than cached, and the setting's `onChange` redraws
     * every open sheet - otherwise the button would keep offering the old word
     * to everyone who has not reopened their character since it changed.
     */
    // The table's word alone (E100, 12.11.2026; the owner at a table on 1.2.108: "SAFEWO RD MISIUBOMBO" wrapped across
    // two lines in the narrow button - only the safeword's own name, as it was before E49 B2 put the caption above it).
    // What the button is stays in its tooltip and its aria-label.
    button.innerHTML = `<i class="fa-solid fa-hand" inert></i>
        <span class="drpg-safeword-word">${foundry.utils.escapeHTML(safeword())}</span>`;

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
 * caption next to it is rendered in. That match climbs to `.input` - the actual
 * wrapper the characteristics fields sit in - rather than the `fieldset`/
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

/**
 * Save the backstory once, from what the player typed (E24 C2; S03-25, S17-39, A6).
 *
 * The value comes from the app, not from the textarea: `tidyBiography` keeps what was typed and not yet saved on
 * `app._drpgBiography`, so this needs no element and saves the same whether it runs on `focusout`, on a tab change or
 * after the sheet's close, when Foundry has already taken the window out of the page (v13's ApplicationV2 runs the
 * close hooks after it removes the element, as remembered; the harness's shim fires no `closeCharacterSheet` at all
 * and removes the element first; a table reads v14's order, E24's live check of the saves in AUDIT 9.2). Cleared before the write, so a focusout
 * followed by a close is one write, not two. Compared against the FLATTENED current value (`plainBiography`): a
 * formatted backstory merely opened, focused and left is not rewritten.
 */
export function saveBiography(app) {
    const held = app?._drpgBiography;
    if (!held) return null;
    const actor = app.document ?? null;
    if (!actor) {
        app._drpgBiography = null;
        return null;
    }
    const next = String(held.value ?? "").trim();
    const now = plainBiography(foundry.utils.getProperty(actor, "system.biography.background"));
    /*
     * SOMEBODY ELSE WROTE IT MEANWHILE (E45-C3b, 09.11.2026; general n6; Q-E45-C3b-1's default). `held.base` is the
     * backstory as this browser last knew it stored when the typing began (`tidyBiography`). A save that finds another
     * text stored writes nothing: the other write stands, the typed text stays held - the field keeps it, unsaved - and
     * the typist is told once; their next save writes theirs, as the base is now what they were told of. Scenario 71
     * I2 read on da8e8a3b: the player's save wrote their text over the GM's edit, no word said.
     */
    if (held.base !== undefined && held.base !== now && next !== now) {
        app._drpgBiography = { ...held, base: now };
        ui.notifications?.warn(game.i18n.localize("DRPG.Sheet.biographyChanged"));
        return null;
    }
    app._drpgBiography = null;
    // The same text already on its way (a tab's click, then the field's focusout, before the write is back) is not a second write.
    if (next === now || next === app._drpgBiographySending) return null;
    app._drpgBiographySending = next;
    app._drpgBiographyBase = next;
    return trustedWrite(actor, { "system.biography.background": next }, { reason: "sheetText" })
        .catch(err => error("Could not save the backstory", err))
        .finally(() => { if (app._drpgBiographySending === next) app._drpgBiographySending = null; });
}

export function tidyBiography(app, element, mode = modeOf(app)) {
    const tab = element.querySelector('section[data-application-part="biography"]');
    if (!tab) return;
    if (!mode.biography) {
        dropBiographyTab(app, element, tab);
        return;
    }

    /*
     * THREE SENTENCES OF BACKSTORY DO NOT NEED BOLD.
     *
     * The field arrives as a `<prose-mirror>` with its own edit toggle: an
     * editor to open, a toolbar to read, and a save step to remember, for a
     * paragraph. It becomes a textarea that writes itself on `focusout` -
     * exactly how the item tables edit their rows and how the pre-session note
     * already works, so this is the module's one way of editing text rather
     * than a third one.
     *
     * The toggle goes with it because it lives INSIDE the element being
     * replaced. Nothing is left to restyle, which is a better outcome than the
     * plan's - that asked for the button to be re-dressed in the module's own
     * skin, and a button nobody needs is better removed than repainted.
     *
     * NOT A FIELD OF DAGGERHEART'S FORM (E24 C2, 08.11.2026; S03-25, S17-39). The textarea carried the system's
     * `name`, so the sheet's `submitOnChange` form sent the flattened text with ANY field's change: a formatted
     * backstory rewritten as plain text, and two writes and two renders for one edit. It has no `name` now
     * (`data-drpg-field` instead) and saves through `saveBiography` alone: on `focusout`, on a tab change (the tab
     * bar's click, in the capture phase, before the switch) and on the sheet's close (`registerSheetTweaks`). What is
     * typed and not yet saved lives on the app (`app._drpgBiography`: the text, the selection, whether it had the
     * focus), so a render while somebody types - a GM writing their Hope - draws the new textarea with the text, the
     * selection and the focus the old one had. A sheet its viewer cannot edit gets a read-only field and no listener.
     */
    const actor = app?.document ?? null;
    const editor = tab.querySelector('prose-mirror[name="system.biography.background"]');

    if (actor && editor) {
        const area = document.createElement("textarea");
        area.dataset.drpgField = "biography";
        area.className = "drpg-biography-text";
        area.rows = 8;
        area.placeholder = game.i18n.localize("DRPG.Sheet.biographyPlaceholder");
        // Daggerheart's legend over the field, on the module's own key (A6, D10): the word is the module's.
        const legend = editor.closest("fieldset")?.querySelector(":scope > legend");
        if (legend) legend.textContent = game.i18n.localize("DRPG.Sheet.biographyLabel");

        const held = app._drpgBiography ?? null;
        const editable = mode.editable;
        // Read once the field is in the sheet (below): whether it is in the page, and the text it was drawn with.
        let inPage = false, drawn = "";
        const stored = plainBiography(foundry.utils.getProperty(actor, "system.biography.background"));
        // The stored text the next typing starts from (`saveBiography`'s base): what this draw shows, unless typed text is held.
        if (!held) app._drpgBiographyBase = stored;
        area.value = editable && held ? held.value : stored;

        if (!editable) {
            area.readOnly = true;
        } else {
            const remember = () => {
                app._drpgBiography = { value: area.value, start: area.selectionStart, end: area.selectionEnd,
                    focused: document.activeElement === area, base: app._drpgBiography?.base ?? app._drpgBiographyBase };
            };
            area.addEventListener("input", remember);
            // The caret moved without a keystroke that typed: kept only while there is something unsaved.
            for (const type of ["keyup", "pointerup"]) area.addEventListener(type, () => { if (app._drpgBiography) remember(); });
            area.addEventListener("focusout", () => {
                /* A textarea a render or the close took out of the page is not a player leaving the field: the
                   render's new textarea takes the text, the close hook saves it. Asked once the removal is done. A
                   root that was never in the page (a stand-in's) has nothing to be taken out of. A value set without
                   an `input` (a script's) is what the old field saved on focusout, and still is. */
                queueMicrotask(() => {
                    if (inPage && !area.isConnected) return;
                    if (!app._drpgBiography && area.value !== drawn) remember();
                    saveBiography(app);
                });
            });
        }

        editor.replaceWith(area);
        inPage = area.isConnected;
        drawn = area.value;

        if (editable && held?.focused) {
            try {
                area.focus({ preventScroll: true });
                area.setSelectionRange(held.start ?? area.value.length, held.end ?? area.value.length);
            } catch { /* a field the page cannot focus keeps its text */ }
        }
    }

    // A tab change saves before the switch; bound once per window, as the window outlives its renders.
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (root && !root.dataset.drpgBiographyTabs) {
        root.dataset.drpgBiographyTabs = "1";
        root.addEventListener("click", ev => {
            if (ev.target?.closest?.("nav [data-tab]")) saveBiography(app);
        }, { capture: true });
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
 * the carry limit shown - a player should be able to see "Weapons 1/1" without
 * counting.
 * ========================================================================== */

/*
 * ONE ROW FOR EVERYTHING YOU HOLD (E9, Dawid 27.08).
 *
 * E8 gave the three gear categories one shared budget of three, which left the
 * sheet drawing the same "2 / 3" three times under three headings - three
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
 * first - the category is the tag tied to the table the thing came out of - and
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
     * item's own category, and that is deliberate - see the note above
     * `roleChecks` in tables-editor.mjs. The reasoning there is about MECHANICS and it
     * still holds: `servesAs` checks the home first, so ticking "Tool" on a
     * tool changes nothing about what the thing can do, and a list that
     * reshuffles as the category dropdown moves is worse to use than one
     * redundant box.
     *
     * What that note could not know is that these tags would later become
     * VISIBLE. Once a badge is drawn per role, a redundant tick stops being
     * harmless: the row grows a duplicate "Tool · Tool", and an item Dawid
     * capped at two tags shows three. So the display de-duplicates rather than
     * the form growing a rule - the form's reasoning is still right, and this
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

function groupInventory(app, element, mode = modeOf(app)) {
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
       what the player writes (use-items.mjs `useCreatively`) - the GM's chip beside the flask (E107 part 2; until then a
       `drpg-gm-route` class that painted nothing on this button) and the GM's word in its tooltip, where "Use this
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
    // The GM's chip beside the flask (E107 part 2, R5434): the class alone painted nothing on this button.
    button.innerHTML = `<i class="fa-solid fa-flask" inert></i>${askGm ? `<span class="drpg-action-gm">${game.i18n.localize("DRPG.Action.waitsForGm")}</span>` : ""}`;

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

/**
 * One Truth Bullet, as a row.
 *
 * A bullet has no tier - the old `T2` pill was a visibility index the previous
 * macro smuggled through the tier field. What matters instead is what the player
 * currently believes it is, how hard the original was to spot (the number Analyze
 * will be rolled against), and which chapter it belongs to.
 *
 * The GM reading the same sheet gets one extra badge: the truth. It is drawn
 * from `truthBulletData`, which returns it only to a GM - a player's client
 * never had it to begin with.
 */
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
function classSafe(value) {
    return String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "");
}

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
function repaintPresentButtons() {
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

/* ==========================================================================
 * THE KILLING GAME'S RULES
 * --------------------------------------------------------------------------
 * Daggerheart's Effects tab lists magical conditions applied by spells and
 * armour. This game has two conditions, both automatic (see states.mjs), and
 * no spells - so the tab was an empty box on every sheet in the world.
 *
 * What every sheet should carry instead is the thing every character is
 * actually bound by: Monokuma's standing rules. They were being announced once
 * in chat and then scrolling away, which for a rule is the same as not having
 * one.
 *
 * The tab is TAKEN OVER rather than removed and rebuilt. ApplicationV2 owns
 * the tab machinery - which part is active, what a click does, how the nav is
 * rendered - and adding or deleting a part from outside is how you end up with
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
 * Matched by `[data-tab="effects"]` inside the tab bar specifically - the same
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

    // "Monokuma's rules", not the tab's "Rules" again (E49 B2, S03-39 and S12-67).
    const title = document.createElement("h3");
    title.className = "drpg-keep";
    title.textContent = game.i18n.localize("DRPG.Rules.sheetTitle");
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
            // textContent, never innerHTML - a rule is free text a GM typed.
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
     * - so it arrived unannounced in the middle of a session, most often right
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
 * rolls the right trait, resolves the threshold and reports back privately -
 * no GM required for the repeatable ones.
 * ========================================================================== */

function injectActionPanel(app, element, mode = modeOf(app)) {
    if (!mode.actions) return;

    // Must be the CONTENT section, never the navigation link.
    //
    // `[data-tab="features"]` also matches the <a> in the tab bar, which comes
    // first in the DOM - so a looser selector put the whole panel inside a
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

    // A Monokuma has no action economy at all. Their sheet is Despair Calls.
    if (mode.actions === "calls") {
        injectCallsPanel(tab, actor, true);
        attachActionDelegate(app, element);
        return;
    }

    // Not in the class (E24 C3a, E24-20): an NPC the GMs play takes no actions and buys no Calls, and its sheet
    // says so to the GM in the panel's place. A player's sheet of one draws nothing here.
    if (mode.actions === "npc") {
        const note = document.createElement("div");
        note.className = "drpg-action-panel drpg-npc-panel";
        const line = document.createElement("p");
        line.className = "notes drpg-keep";
        line.textContent = game.i18n.localize("DRPG.Class.npcLine");
        note.append(line);
        tab.prepend(note);
        return;
    }

    // A Monocub keeps the normal action budget but only two things to spend it
    // on. Its own panel entirely, not a filtered version of the student grid -
    // Meddle targets another actor and has no place in the generic delegate.
    if (mode.actions === "monocub") {
        injectMonocubPanel(tab, actor);
        attachActionDelegate(app, element);
        return;
    }

    // Dead, and not promoted to a Monocub. Both branches above are about what
    // somebody IS; this one is about somebody who has stopped.
    //
    // Nothing used to catch this case, so a student who had been executed or
    // murdered kept the whole living grid - Search, Rest, Work on Project, even
    // Direct Murder - plus their Hope Calls, and `resetActionsFor` refilled the
    // budget every time of day because it only ever skipped Monokumas. Becoming
    // a Monocub is a separate GM step that may come a whole trial later, or
    // never, and that gap is exactly where a corpse could keep taking turns.
    if (mode.actions === "dead") {
        const note = document.createElement("div");
        note.className = "drpg-action-panel drpg-dead-panel";
        const heading = document.createElement("h3");
        heading.className = "drpg-keep";
        heading.textContent = game.i18n.localize("DRPG.Chapter.deadPanelTitle");
        const body = document.createElement("p");
        body.className = "notes";
        body.textContent = game.i18n.localize("DRPG.Chapter.deadPanelNote");
        // What the dead still do (E24 C3a, E24-18): speak outside the trial; in it, no microphone and no ballot.
        const still = document.createElement("p");
        still.className = "notes drpg-dead-still";
        still.textContent = game.i18n.localize("DRPG.Class.deadStill");
        note.append(heading, body, still);
        // Dead, and nobody has found them yet (E05 C10): the victim's own player, and a GM.
        if (mode.unfound) {
            const unfound = document.createElement("p");
            unfound.className = "notes";
            unfound.textContent = game.i18n.localize(mode.gm ? "DRPG.Chapter.deadUnfound" : "DRPG.Chapter.nobodyFoundYou");
            note.append(unfound);
        }
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
     * still works is Direct Murder - which is where the incident's own actions
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

    // THE BUDGET IS THE PANEL'S FIRST ROW (E49 B2, S03-38: "the ACTIONS bar repeats the open tab and pushes the Hope
    // Calls under the sheet's edge"). The panel's own "Actions" heading stood under a tab of the same name; the line
    // that says what is left ("2 of 2 actions - Free Move unused") is the row it keeps, and the heading's word is the
    // panel's name for a screen reader.
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", game.i18n.localize("DRPG.Action.panelTitle"));
    panel.append(budgetLine(actor));

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";

    // Dynamic actions are the guide's catch-all: describe it, the GM sets a
    // threshold, and the reward scale is deliberately gentler. Built here
    // because its three strings are localised and ACTIONS is evaluated before
    // `game.i18n` exists - the table carries a placeholder row (`deferred`)
    // holding its PLACE in the order, and this is what fills it.
    const dynamic = {
        label: game.i18n.localize("DRPG.Action.dynamicLabel"),
        hint: game.i18n.localize("DRPG.Action.dynamicHint"),
        icon: "fa-wand-magic-sparkles",
        cost: 1,
        // Describing something and waiting for a threshold IS the GM branch -
        // this one is defined inline rather than in ACTIONS, so it has to say so
        // for itself.
        callsGm: true
    };

    // ONE LOOP, AND ONE LIST IS THE LAYOUT. The dynamic tile used to be
    // appended after this, which is why it sat last whatever config.mjs said -
    // and "last" is a position somebody has to be able to choose. Since E103
    // the place is config.mjs `ACTION_GRID`'s (the owner's order of 13.11.2026),
    // not ACTIONS' key order; a key it names that is no universal entry draws
    // nothing.
    for (const key of ACTION_GRID) {
        const def = ACTIONS[key];
        if (def?.kind !== "universal") continue;
        grid.append(actionButton(actor, key, def.deferred ? dynamic : def));
    }

    panel.append(grid);
    tab.prepend(panel);

    // Hope Calls sit underneath the actions, in the colour of the Hope die.
    injectCallsPanel(tab, actor, false);
    attachActionDelegate(app, element);
}

/**
 * The Monocub's abilities, one tile each (`monocubTiles`): bespoke, because Confusion needs a target and a Help/Hinder
 * choice before there is anything to roll. No Move tile since E103 (the owner, 13.11.2026: "kafel move u monocuba
 * usuwamy"): its click only showed the Move's briefing, and a Monocub's Move is its token crossing a room, which costs
 * it nothing (movement.mjs `cubStep`, E72 C10) - the header's two feet say so (`freeMovePip`).
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
    // it costs - a third copy of the same number, plus a sentence about who is
    // allowed to top it up, was telling the player something they can see and
    // something they cannot act on.

    const grid = document.createElement("div");
    grid.className = "drpg-action-grid";
    grid.append(...monocubTiles(actor));
    panel.append(grid);

    // THE PURSE (E72 C14; DC37): Hope a Bribe or a Bounty paid, kept by the GMs beside the sheet's and spent first.
    const purse = purseOf(actor);
    if (purse > 0) {
        const line = document.createElement("p");
        line.className = "notes drpg-monocub-purse";
        line.textContent = game.i18n.format("DRPG.Monocub.purseLine", { n: purse });
        panel.append(line);
    }

    /* PART B, UNDER THE TILES (E72 C19): each Bribe waiting with its Accept and Refuse (the same answer as the window,
       monocub.mjs `openBribeOffer`), each open Bounty, and the Monocub's own Ghost Bet (`cubPanelLines`). Words only, as
       the purse's line: no side, colour or title (DC39). */
    for (const item of cubPanelLines(actor)) {
        const line = document.createElement("p");
        line.className = `notes drpg-monocub-${item.kind}`;
        const words = document.createElement("span");
        words.textContent = item.kind === "offer" ? game.i18n.format("DRPG.Monocub.panelOffer", { name: item.name, cost: item.cost })
            : item.kind === "bounty" ? game.i18n.format("DRPG.Monocub.panelBounty", { name: item.name, reward: item.reward })
                : game.i18n.format("DRPG.Monocub.panelBet", { name: item.name, n: item.value });
        line.append(words);
        // Wherever the panel is drawn (sheetMode's question, asked once above): the GM side judges the answer's sender.
        if (item.kind === "offer") {
            for (const accept of [true, false]) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "drpg-mini-button";
                button.textContent = game.i18n.localize(accept ? "DRPG.Monocub.bribeAccept" : "DRPG.Monocub.bribeRefuse");
                button.addEventListener("click", async () => {
                    button.disabled = true;
                    const { requestBribeAnswer } = await import("./gm-bridge.mjs");
                    await requestBribeAnswer({ cubId: actor.id, bribeId: item.id, accept });
                });
                line.append(" ", button);
            }
        }
        panel.append(line);
    }

    if (isCrimeSilenced(actor)) {
        const note = document.createElement("p");
        note.className = "notes drpg-monocub-silenced";
        note.textContent = game.i18n.localize("DRPG.Monocub.silencedNoteShort");
        panel.append(note);
    }

    // Move's line, on screen (E100, R4107): its window is gone; the owner wants "Free" here, not the whole description.
    panel.append(monocubMoveNote(actor));

    tab.prepend(panel);
}

/*
 * MOVE'S DESCRIPTION STAYS ON SCREEN (E100, 12.11.2026; the owner's rule on E100's review: an action's description is
 * never hidden, folded or collapsed - "nie chowajmy w oknach akcji ... opisu akcji NIGDY"). Item 1 took Move's window
 * away, the one place its description stood; the tile says the name, the price and "Drag your token", its tooltip the
 * hint. The description is a line of the Monocub's panel under its tiles, as the silenced note is. R4107.
 * CUT DOWN THE SAME DAY: the owner, passed on by the coordinator - on the Monocub's panel Move needs only "za darmo",
 * not the whole description. The line reads `DRPG.Move.free` ("Free" / "Za darmo"), still a line of its own, not folded.
 */
export function monocubMoveNote(actor = null) {
    const note = document.createElement("p");
    note.className = "notes drpg-monocub-move";
    /* "Free" while it is (the r112 review's P2, 13.11.2026): a Monocub pays its crossings as a student does (actions.mjs
       `takeMove`), so once the Free Move is spent the line says what the next crossing takes (action-briefing.mjs
       `moveLine`), and the panel's repaint draws it again (`refreshMonocubTiles`). With no character, the owner's word. */
    note.textContent = !actor || nextCrossingPrice(actor) === "free" ? game.i18n.localize("DRPG.Move.free") : moveLine(actor);
    return note;
}

/**
 * Whether Move's "drag your token" is true for this character now (the r112 review's P2, 13.11.2026): not in a Class
 * Trial, where the drag is refused (movement.mjs `trialLocked`), nor in an incident the character is in
 * (`lockedInIncident`); the tile is locked in both (`actionButton`). The HUD's Move row and the Monocub's Move tile ask
 * it. `trial` and `incident` are for the suite (R4472).
 */
export function moveDragSaid(actor, { trial = inClassTrial(), incident = Boolean(murderState()?.stage === "incident" && sideOf(actor)) } = {}) {
    return !trial && !incident;
}

/* A Monocub's tiles: one per row of its table (E33 C10), in the table's order - Confusion, Redeem, Ask for Hope,
   Tinker, Ghost Bet. The Move drawn first until E103 is gone (the owner, 13.11.2026). The panel's build and the
   repaint's (`refreshMonocubTiles`, E45 C2) both draw these. */
function monocubTiles(actor) {
    return Object.entries(MONOCUB.abilities).map(([key, def]) => abilityButton(actor, key, def));
}

function abilityButton(actor, key, def) {
    // The sheet's Hope and the purse's (E72 C14; DC37): a price may be paid from either.
    const held = hopeHeld(actor) + purseOf(actor);
    const affordable = actionsLeft(actor) >= def.cost && held >= def.hopeCost;
    /* SHUT, AND WHY (E72 C9, 12.11.2026; audit S18-62, DC22): a row's blocks this browser can read - Redeem used today,
       the Hope full, an Ask for Hope still open (monocub.mjs `cubBlockSaid`, the owner's copy of the GMs' row) - grey
       the tile with the block's own sentence. The GM asks them again before the price; this is the courtesy. */
    const shut = cubBlockSaid(actor, def);
    const free = def.cost === 0 && def.hopeCost === 0;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-action-button${affordable && !shut ? "" : " unaffordable"}`;
    // Counted on the actions (E66 C2; S18-36): Hope agrees with nothing in either language.
    // The grid's own words for a price with no Hope (`costLabelFor`): "free", "1 action".
    const price = free ? game.i18n.localize("DRPG.Action.costFree") : def.hopeCost === 0 ? plural("DRPG.Action.costActions", { n: def.cost })
        : plural("DRPG.Monocub.meddleCost", { actions: def.cost, hope: def.hopeCost }, "actions");
    const why = shut ? game.i18n.localize(shut) : affordable ? "" : game.i18n.localize("DRPG.Monocub.cannotMeddle");
    button.dataset.tooltip = `${foundry.utils.escapeHTML(price)}${why ? `<br><em>${foundry.utils.escapeHTML(why)}</em>` : ""}`;
    // "1 · 1◆" was unreadable without already knowing which number was which.
    // Confusion is the only action in the game that costs two different things,
    // so the tile spells both out in the same order the tooltip does.
    button.innerHTML = `
        <i class="fa-solid ${def.icon} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(def.label))}</span>
        <span class="drpg-action-cost">${free ? game.i18n.localize("DRPG.Action.costFree") : def.hopeCost === 0
            ? plural("DRPG.Action.costActions", { n: def.cost })
            : plural("DRPG.Monocub.meddleCostShort", { actions: def.cost, hope: def.hopeCost }, "actions")}</span>`;

    button.addEventListener("click", async () => {
        const { cubAbilityDialog } = await import("./monocub.mjs");
        await cubAbilityDialog(actor, key);
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
 * budget that is not interchangeable - it buys a room crossing and nothing else,
 * and a player who does not know they still have it will pay an action for a
 * door they could have walked through.
 */
export function budgetLine(actor, state = murderState()) {
    const line = document.createElement("p");
    line.className = "notes drpg-keep drpg-budget-line";

    /*
     * IN A FIGHT THIS ROW SAYS WHOSE TURN IT IS (E49 B2's turn line; audit S03-30, "the victim, at the start of their
     * turn, sees only the sheet and nothing says 'your turn'"; its fix: "in an incident, the turn's banner in the sheet
     * itself"). The same row, not a new one: the owner's rule of 10.11 is that a state changes the look and never the
     * layout, and in an incident the budget has nothing to say - every tile but the fight's is shut and a crisis action
     * spends no action (`costOf`). The words are the incident card's (events.mjs `incidentTurnText`), so the card and
     * the sheet cannot disagree; the light is `isTheirTurn`'s, the predicate that dims the fight's tile under it. Every
     * seat `sideOf` names (a third party who walked in too: their tiles are shut as well) reads it; anyone outside the
     * incident reads the budget as before.
     */
    if (state?.stage === "incident" && sideOf(actor, state)) {
        const mine = isTheirTurn(actor, state);
        line.textContent = incidentTurnText({ state, mine: actor.id, myTurn: mine, acting: actingActor(state) });
        line.classList.add("drpg-budget-turn");
        if (mine) line.classList.add("drpg-budget-mine");
        return line;
    }

    const left = actionsLeft(actor);
    const parts = [plural("DRPG.Actions.leftOf", {
        left, max: actionsMax(actor)
    }, "max")];

    if (hasFreeMove(actor)) parts.push(game.i18n.localize("DRPG.Actions.freeMoveLeft"));
    // Fog took it (E24 C3b; E24-24): said, so a Move that is not there reads as the weather's and not as spent.
    else if (overflowBlocksFreeMove()) parts.push(game.i18n.localize("DRPG.SheetNotes.fogBudget"));

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
        // count to report - saying "null crossings" or "0 crossings" would both
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

/*
 * THE STAGE 6 PANEL IS GONE ENTIRELY (Dawid, 29.08).
 *
 * It had already lost its three clean-up actions to the Tamper tile on 28.08,
 * which left one tile in a panel of its own: "Turn on your partner". That has
 * now moved inside Direct Murder, where it belongs - turning on your partner
 * IS a direct murder, and the only one the guide lets you commit without
 * declaring it in an Eclipse first. See `performBetrayal` in action-murder.mjs.
 *
 * So a killer in Stage 6 reads ONE grid of ten tiles, which is what the grid
 * was always for. Nothing here decides placement any more because there is
 * nothing left to place.
 */
function injectCallsPanel(tab, actor, monokuma) {
    const held = monokuma ? monokumaPool(actor) : hopeHeld(actor);
    const max = monokuma ? STARTING.despairMax : hopeMax(actor);

    const panel = document.createElement("div");
    // A Despair Call that silences somebody closes this whole menu until the
    // clock moves, and until now it closed it INVISIBLY: `calls.mjs` refuses a
    // silenced player's Call with a notification, and every button on the panel
    // went on looking exactly as available as it had a moment earlier. The
    // stylesheet has had the greyed-out state written for it the whole time -
    // `.drpg-calls-panel.drpg-silenced`, dimmed with a `not-allowed` cursor on
    // the buttons - and nothing ever put the class on. Found by sweeping for
    // CSS classes the code never names.
    //
    // Refusal stays where it is. The dimming says "not now"; pressing anyway is
    // still how a player is told why.
    panel.className = `drpg-calls-panel ${monokuma ? "drpg-despair-panel" : "drpg-hope-panel"}${
        isCallSilenced(actor) || (!monokuma && overflowBlocksCalls()) ? " drpg-silenced" : ""}`;

    // The pool is on the bar for a Monokuma and nowhere else: Despair is the
    // only thing their sheet is about, and the number is not repeated anywhere
    // they can see. A student already reads their Hope twice over - the pips in
    // the sheet header and the player strip in the corner - so a third copy on
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

    // A Call is not a room crossing either - see spendHopeCall/spendDespairCallFor
    // in calls.mjs, which refuse it outright while the Eclipse is running.
    //
    // And a Despair Call is shut for the length of a Class Trial (T-1), which a
    // Hope Call is not - so the note is per drawer rather than per sheet.
    const lockNote = callLockNote(monokuma);

    const calls = monokuma ? despairCallsFor(held) : affordableHopeCalls(actor);
    for (const call of calls) grid.append(callButton(call, monokuma, lockNote));

    panel.append(grid);
    tab.append(panel);
}

/**
 * A Call tile, built to exactly the same template as an action tile: icon on
 * top, name, price underneath. Only the colour and the icon differ, so a player
 * reads the whole sheet the same way rather than learning two layouts.
 */
/**
 * Why every Call on one drawer is grey right now, or null.
 *
 * One reader for the injection and the repaint, so the two cannot disagree about
 * a drawer the player is looking at.
 */
function callLockNote(monokuma) {
    if (isEclipse()) return game.i18n.localize("DRPG.Eclipse.callsLocked");
    if (monokuma && inClassTrial()) return game.i18n.localize("DRPG.Trial.callsLocked");
    /* SILENCE, THE WEATHER, ON THE DRAWER (E24 C3b, 08.11.2026; E24-24, audit S03-13). calls.mjs refuses every Hope
       Call while the Overflow's Silence runs (`overflowBlocksCalls`, `DRPG.Overflow.silenced`), and the drawer went
       on looking open: a player read six Hope and seven live tiles and learnt the rule from the refusal. A Despair
       Call is not a Hope Call, so a Monokuma's drawer stays as it is. */
    if (!monokuma && overflowBlocksCalls()) return game.i18n.localize("DRPG.Overflow.silenced");
    return null;
}

function callButton(call, monokuma, lockNote = null) {
    const button = document.createElement("button");
    button.type = "button";

    /*
     * ONE TILE, TWO JOBS - AND THAT IS DELIBERATE (E14).
     *
     * While an assembly is pending, Public Announcement becomes the button
     * that calls it off. Not a control in the GM panel: the person who wants
     * to cancel is the person looking at the tile they bought it with, and
     * making them find another window to undo a thing they did here is how a
     * pending order gets left standing by accident.
     *
     * The whole state is computed once, here, because both the price and the
     * grey depend on it - see trap 103 immediately below.
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
     * allowed to grey it out - and the pool is at its emptiest exactly when
     * somebody wants to cancel, because they have just spent six on the thing
     * they are cancelling. Affordability drops out of the class entirely while
     * the tile is in its pending state.
     *
     * BONE, NOT RED. Red already means one thing in this module - the Call
     * hands the turn to a GM (`GM_ROUTE_CLASS`, below) - and gold is Hope's. A third
     * meaning on red is the mistake the stylesheet's note about outline colour
     * warns against. Bone plus the pulsing dot reads as "this is standing and
     * about to go off", which is what it is.
     */
    // `drpg-locked-eclipse` whatever shut it: the class is the LOOK of a Call
    // that is closed until something ends, and the reason is in the note. A
    // second class would be a second stylesheet rule for the same grey.
    /* A CALL A GM RULES IS RED, WITH THE GM'S CHIP (E22 C5c; A4, audit S03-26, S09-22): Experience and Ultimate
       (`needsGm`) wait for a GM's yes before anything is spent (calls.mjs: their window's Send is on the GM's road,
       `callWindow`'s `gmRoute`), and their tiles looked like every Call a player simply buys. The flag that makes the
       window's Send red makes the tile red, and the chip under the cost says who it waits for, as an action tile's. */
    // And Talent's tile, whose two Calls a GM rules (E72; calls.mjs `callAsksGm`).
    const askGm = callAsksGm(call, monokuma ? "despair" : "hope") && !pending;
    button.className = `drpg-action-button drpg-call-button${
        pending ? " drpg-call-pending"
            : lockNote ? " drpg-locked-eclipse"
            : call.affordable ? "" : " unaffordable"}${askGm ? ` ${GM_ROUTE_CLASS}` : ""}`;
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
        : lockNote
        ? `<br><em>${foundry.utils.escapeHTML(lockNote)}</em>`
        : call.affordable ? "" : `<br><em>${game.i18n.localize("DRPG.Calls.cannotAfford")}</em>`;
    const summary = pending
        ? game.i18n.format("DRPG.Calls.gatherBody", {
            room: foundry.utils.escapeHTML(pending.room)
        })
        : foundry.utils.escapeHTML(proseOf(call, "effect"));
    // Same as the action tiles: `costLabel` is on the face of this button, so
    // the hover carries what the Call does and, when it applies, why it cannot
    // be taken (E3).
    button.dataset.tooltip = `${summary}${note}`;

    const label = pending
        ? game.i18n.localize("DRPG.Calls.gatherCancel")
        : call.label;

    button.innerHTML = `
        <i class="fa-solid ${call.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(label))}</span>
        <span class="drpg-action-cost">${costLabel}</span>${askGm
            ? `<span class="drpg-action-gm">${game.i18n.localize("DRPG.Action.waitsForGm")}</span>` : ""}`;

    return button;
}

/** What the Despair pool backing a Monokuma actor can spend: less what it owes (E05 C12). */
function monokumaPool(actor) {
    try {
        const user = poolUserFor(actor);
        return user ? spendableDespair(user.id) : 0;
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
    const { confirmCall, spendHopeCall, spendDespairCallFor, hopeHeld, callBarred } =
        await import("./calls.mjs");

    const despair = kind === "despair";
    let call = despair ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return;
    /* A tile of two Calls asks which first (call-pickers.mjs `pickChoice`, E72); the rest runs on the chosen Call's own
       row. A tile whose two a GM rules (Talent) asks it in its confirmation instead, with the note (`confirmCall`'s
       `choices`, R3818): the rest runs on the tile's row up to there. */
    const table = despair ? DESPAIR_CALLS : HOPE_CALLS;
    const ruled = Array.isArray(call.choices) && callAsksGm(call, despair ? "despair" : "hope");
    if (Array.isArray(call.choices) && !ruled) {
        const { pickChoice } = await import("./call-pickers.mjs");
        const chosen = await pickChoice(call, despair ? "despair" : "hope");
        if (!chosen) return;
        key = chosen;
        call = table[key];
    }

    /*
     * ONE PURCHASE OF A CALL AT A TIME (E51 fix round FG7, 31.10.2026; review goal G2). A sheet redrawn while this
     * Call's picker or confirmation stands puts its tile back live (the delegate above disables only the element that
     * was pressed), and a second press opened a second window of the same purchase. Raised instead, and nothing more
     * (call-pickers.mjs `callWindowOpen`; each window also refuses a twin of itself, `callWindow`'s `once`).
     */
    const { callWindowOpen } = await import("./call-pickers.mjs");
    if (callWindowOpen(call, despair ? "despair" : "hope")) return;

    /*
     * WHAT SHUTS THE WHOLE MENU IS ASKED FIRST (CALL-17, 20.09).
     *
     * An Eclipse, the overflow's Silence, a Class Trial for a Monokuma, a dead
     * student: all four were only asked inside the spenders, which this function
     * reaches after the target picker and the confirmation. So the answer to "may I
     * do this at all" arrived three windows late, and the player had by then chosen
     * a victim and read a price. `callBarred` is the same reader the spenders use -
     * see the note on it for why they go on asking as well.
     */
    const barred = await callBarred(actor, { despair });
    if (barred) {
        ui.notifications.warn(barred);
        return;
    }

    /*
     * TRAP 102, AND IT HAS TO BE THE FIRST THING IN THIS FUNCTION.
     *
     * Everything below - the affordability check, the target picker, the
     * confirmation, `spendDespairCallFor` - assumes a purchase. Calling off an
     * assembly is not one: it costs nothing and there is nothing left to point
     * at. Reached one line later, through `spendDespairCallFor`, it would have
     * taken a second six Despair for the privilege of undoing the first.
     */
    const standing = call.defers ? pendingGather() : null;
    if (standing) {
        const { cancelGather } = await import("./call-effects.mjs");
        // A Call window (E51 C2; call-pickers.mjs `callWindow`): the Despair Call's own, with no header -
        // nothing is bought - and buttons saying what each does: the default calls the assembly off, as the
        // confirm's yes did, and the other keeps it.
        const { callWindow, callWindowClass } = await import("./call-pickers.mjs");
        const answer = await callWindow({
            call, kind,
            body: `<p>${game.i18n.format("DRPG.Calls.gatherCancelAsk", {
                room: foundry.utils.escapeHTML(standing.room)
            })}</p><p class="notes">${game.i18n.localize("DRPG.Calls.gatherNoRefund")}</p>`,
            // The kit's slots (E21 C5a): Call it off the primary; the closing word is the kit's Cancel, which keeps it.
            footer: { primary: { action: "yes", label: game.i18n.localize("DRPG.Calls.gatherCallOff") } },
            modal: true,
            /* ONE AT A TIME (E44 C2c, 04.11.2026; D176): the call-off window as the confirmation step of its Call, so
               `callWindowOpen` above raises it on a second press, and `callWindow` refuses a twin of it (null: kept). */
            once: callWindowClass(call, "despair", "confirm")
        });
        if (answer !== "yes") return;
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

    // Silence, the Despair Call, is `callBarred`'s above since E15 C4 (audit S09-35).

    // Experience buys the use of an experience. With none written on the sheet
    // there is nothing to buy, and the Call would have been paid for, armed, and
    // then met a roll window with no chips to tick.
    if (call.grants === "experience" && !Object.keys(actor.system?.experiences ?? {}).length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.noExperiences"));
        return;
    }

    // Hope granted under the Despair darkening lands nowhere - said before the
    // picker rather than after it and the confirmation (review of CALL-05).
    if (despair && call.grantsHope) {
        const { overflowBlocksHope } = await import("./overflow.mjs");
        if (overflowBlocksHope()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Overflow.noHopeNow"));
            return;
        }
    }

    /*
     * A SECOND COPY IS REFUSED BEFORE THE PRICE (E15 C4, 25.10.2026; audit S09-35). A second Loaded
     * Die or Experience on a student already holding one went through the confirmation and the
     * Spend, and was refused only then (an Experience after the GM's decision). A Call with no
     * target arms its buyer, so the question is answerable here; one with a target is asked after
     * the picker by `refusalBeforePaying` (Despair) and by the GM (`call.arm`). By the row's key,
     * which is how its entry is stored.
     */
    if (call.target === "none" && call.grants && alreadyArmed(actor, { ...call, key })) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadyArmed", { name: actor.name, call: call.label }));
        return;
    }

    // Point it at something first: a player, a project, a room, an item.
    const { pickTarget, refusalBeforePaying } = await import("./call-effects.mjs");
    const choice = await pickTarget(actor, call, despair ? "despair" : "hope");
    if (choice === null) return;

    // And the target-specific refusals before the confirmation, not after it.
    // `spendDespairCallFor` asks again: the world can move while a window is open.
    if (despair) {
        const refusal = refusalBeforePaying(call, choice);
        if (refusal) {
            ui.notifications.warn(refusal);
            return;
        }
    }

    /* Talent's rows (`ruled`, above): one shut with its reason - Experience with none on the sheet, a Call already held -
       stays greyed in the window, as an action's row, and the checks below the window are asked again of the one picked. */
    const shut = {};
    if (ruled) for (const k of call.choices) {
        if (table[k].grants === "experience" && !Object.keys(actor.system?.experiences ?? {}).length) shut[k] = game.i18n.localize("DRPG.Calls.rowNoExperiences");
        else if (table[k].grants && alreadyArmed(actor, { ...table[k], key: k })) shut[k] = game.i18n.localize("DRPG.Calls.rowArmed");
    }
    let note = await confirmCall(call, { kind: despair ? "despair" : "hope", held, choice, actor, ...(ruled ? { choices: call.choices, shut } : {}) });
    if (note === null) return;
    if (ruled) {
        if (!call.choices.includes(note.key) || shut[note.key]) return;
        key = note.key;
        call = table[key];
        note = note.note;
    }

    if (despair) await spendDespairCallFor(actor, key, { note, choice });
    else await spendHopeCall(actor, key, { note, choice });

    actor.sheet?.render(false);
}

/**
 * Why this action would fail here, if it would - before anybody spends a click.
 *
 * Every one of these checks already existed; they just ran on the far side of
 * the button. A player picked Search, watched the briefing open, read the
 * options, rolled, and only then learned the room had been picked clean - and
 * in the unanswered case the module had to hand the action back afterwards.
 * The knowledge was there the whole time. This asks the same questions while
 * the tile is being drawn.
 *
 * Returns a reason string to show, or null when the action is fine.
 *
 * Deliberately NOT a hard block: the tile stays clickable and still opens its
 * briefing, because "what would this have done" is worth reading even when the
 * answer is "nothing here". The dimming is advice, not a gate - and the real
 * guards downstream stay exactly where they are, since a room's state can
 * change between a sheet render and a click.
 */
export function roomBlockFor(actor, key) {
    try {
        // Rest is about the actor, and is dimmed only when neither of its rows can be taken: the tooltip names both
        // reasons, and the window shows both rows greyed (E16 part 2 C4, 26.10.2026; audit S02-26). The tile looked
        // live and its press answered "Nothing here can be done right now." alone.
        if (key === "rest") return restShutReason(actor);

        // Only the five actions whose subject lives in the room can be blocked
        // by the room. Move and the rest are about the actor. Not Projects (E16 part 2 C4; audit S03-24): it
        // was on this list, so outside every room its tile was struck through with "You are not in any room",
        // while proposing a project works anywhere (the note at the end of this function) - the corridor hid
        // the one road to the first project. `performProject` still shuts its "work on" row by itself.
        const roomBound = ["search", "observe", "listen", "palm", "tamper"];
        if (!roomBound.includes(key)) return null;

        // `roomOfActor` answers with the room's NAME, not a region document -
        // every other caller in the module treats it as a string, and reading
        // `.name` off it silently yields undefined, which reads as "outside
        // every room" no matter where the token is standing.
        const place = locateActor(actor);
        const here = place?.room ?? null;

        // SABOTAGE USED TO BE ANSWERED HERE, and is not any more: it has no
        // tile to dim. It is the third row of the Projects menu now, where
        // "nothing here to break" is a struck-through option with the reason
        // written beside it - which is the same information said better, and
        // said in the window where the alternative is one row away. The check
        // itself moved verbatim into `performProject`.

        if (!here) return game.i18n.localize("DRPG.Action.noRoomNote");

        // Sealed first: it outranks the counter, and it is the more useful
        // sentence. A room with nothing to find in it reading "already picked
        // clean" sends the player back at the next time of day to try again.
        if (key === "search" && SearchTokens.sealed(here, place?.scene))
            return game.i18n.localize("DRPG.SearchTokens.sealed");

        // `exhausted`, not `pickedClean` - the latter says "the action is
        // spent", which is true after a roll and a lie before one.
        if (key === "search" && SearchTokens.left(here, place?.scene) <= 0)
            return game.i18n.localize("DRPG.SearchTokens.exhausted");

        if (key === "listen" && neighbouringRooms(place?.scene, here).length === 0)
            return game.i18n.localize("DRPG.Listen.noNeighbours");

        // Palm needs a pocket, and a pocket needs somebody standing in it -
        // true of both directions. The same question `performPalm` asks, on
        // the scene the character stands on (`othersInRoom`, E12 C3), so the
        // tile tells the truth about the room rather than guessing.
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
        // true and it is this line - the strike-through was appearing inside
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
        // one - and the first one is always proposed from a room with none.
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
 *   frame  - is there anybody left to point at? `framingCandidates` reads the
 *            living cast on this client. Free, so it is asked every render.
 *   cover  - is there a trace of yours here that is not reinforced? Only the
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
 * answer mid-scene - a trace erased, one planted - arrives as a settings
 * update, which `forgetTamper` below hangs on.
 * ========================================================================== */

const tamperAnswers = new Map();   // actorId -> { key, blocked }
const tamperAsking = new Set();    // actorId - one question in flight at a time

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

    /*
     * BEING WATCHED WITH A FULL TRACK IS THE FIRST ANSWER, and it is free
     * (Dawid, 17.09, correcting 29.08).
     *
     * A full Sanity track used to refuse every Tamper outright, which was the old
     * double price showing through: the attempt is paid for by the chain now, and
     * an action pays it perfectly well. What a full track cannot pay for is the
     * CONCEALMENT - so the refusal is about who can see you, and it exempts a
     * killer's accomplices exactly as `witnessesTo` does for the roll.
     *
     * Asked before the ledger, because a tile that waits on a socket round trip to
     * say "you have nothing left" makes the player press it to find out. The
     * PRICE's own refusal is not here at all: `actionButton` has the quote.
     */
    if (resourceValue(actor, "stress") >= resourceMax(actor, "stress")
        && witnessesTo(actor, othersInRoom(actor)).length) {
        return game.i18n.localize("DRPG.Tamper.watchedNoSanity");
    }

    const key = tamperKey(actor);
    const seen = tamperAnswers.get(actor.id);
    if (seen?.key === key) return seen.blocked;

    // No answer for this room yet. Go and get one - and say nothing in the
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

        // The same two questions `performTamper` asks, in the same shapes -
        // including `mine`, which is what separates an ordinary character
        // tidying after themselves from a killer standing on their own scene.
        const stageSix = cleanup.isCleaner(actor);
        const [mine, candidates] = await Promise.all([
            // Quiet: the sheet asks as it draws, and a message here would be for nothing the player pressed.
            requestCleanableTraces(actor.id, { mine: !stageSix, quiet: true }),
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
 * every time, for one class on one button - and it would fight `growForCalls`
 * and the tile fitter for the frame it happens to land in.
 */
function paintTamper(actor, blocked) {
    for (const app of sheetsFor(actor)) {
        for (const tile of app.element.querySelectorAll('[data-drpg-action="tamper"]')) {
            tile.classList.toggle("drpg-no-subject", Boolean(blocked));

            /*
             * REBUILT FROM THE TWO HALVES THE TILE KEPT, NOT BY CUTTING THE LAST
             * LINE OFF WHAT IS THERE.
             *
             * It used to strip the final `<br><em>…</em>` and put its own back -
             * which ate whatever the last line happened to be. Measured on the
             * player's sheet in a Class Trial (19.09): every tile carried "The
             * Class Trial is in session…", and a second after the ledger answered,
             * the Tamper tile alone lost its reason and sat there dimmed and
             * silent. The same cut would have eaten the Eclipse's line, and the
             * fight's.
             *
             * `actionButton` stores the head (the hint plus whatever locks the
             * tile) and the tail (the killer's free-tonight line) so this can put
             * its own sentence between them, which is where it belongs.
             */
            const head = tile.dataset.drpgTipHead ?? tile.dataset.tooltip ?? "";
            const tail = tile.dataset.drpgTipTail ?? "";
            const why = blocked ? `<br><em>${foundry.utils.escapeHTML(blocked)}</em>` : "";
            tile.dataset.tooltip = `${head}${why}${tail}`;
        }
    }
}

/** Exported for the suite, which reads the tile a fight draws (E32+E07 C16). */
export function actionButton(actor, key, def) {
    const button = document.createElement("button");
    button.type = "button";

    // An action the budget cannot pay for is dimmed exactly the way an
    // unaffordable Hope Call is - same class, same look. The tile stays visible
    // and still opens its briefing, because knowing what an action would do is
    // half of deciding whether to save an action for it.
    const cost = costOf(actor, key, def);
    /*
     * CAN THIS BE PAID FOR AT ALL - and for a priced action that is the whole
     * chain, not the action step (T-1). A student with no actions and one Hope
     * can still object and still analyse in a trial, so the tile must not be
     * dimmed; the same student with nothing at all is dimmed with the chain's own
     * sentence under it.
     *
     * The stripe still says "1 action" when an action is what pays, even with a
     * banked Burst covering it - that IS what it costs. See `canPayFor`.
     */
    const priced = PRICE_CHAINS[key] ? priceQuoteFor(actor, key) : null;
    const affordable = priced ? !priced.blocked : canPayFor(actor, cost);
    const eclipse = isEclipse();

    // Nothing here to do it to - a separate state from "cannot pay for it",
    // because the answer is different: one is fixed by waiting for the next
    // time of day, the other by walking into another room.
    const blocked = roomBlockFor(actor, key);

    // `nothingToBreak` lived here: the sabotage tile went out entirely when its
    // room held nothing to break, because unlike every other dimmed tile it had
    // no second half to offer. It has a second half now - it is one row of the
    // Projects menu, next to "work on" and "propose" - so the tile it used to
    // switch off does not exist and neither does the rule.

    // WHICH TILES ARE OUT, AND WHY EACH ONE IS.
    //
    // The Eclipse is placement-only - see the guard in action-rolls.mjs's
    // `performAction`. Move is exempt there; it was exempt here too while the
    // Monocub's panel drew a Move tile, and no tile draws it since E103.
    //
    // Direct Murder is exempt the other way round, and this tile is the reason
    // the rule needs stating twice: the guard refuses the action, but a tile
    // that looks pressable and then refuses is worse than one that says no in
    // advance. Greyed outside an Eclipse, live inside one - the exact inverse
    // of every other tile on the sheet.
    /*
     * IN AN INCIDENT, EVERYTHING BUT DIRECT MURDER IS SHUT.
     *
     * The guide's turn structure assumes the two people in a fight are doing
     * nothing else, and `performAction` has always refused them - but a tile
     * that looks pressable and then refuses is worse than one that says no in
     * advance, which is the rule this file has applied to the Eclipse since it
     * was written. Direct Murder is the exception because it is no longer only
     * Direct Murder: during an incident it opens that incident's own actions.
     */
    const inIncident = Boolean(murderState()?.stage === "incident" && sideOf(actor));

    /*
     * DIRECT MURDER HAS A THIRD OPEN WINDOW NOW (Dawid, 29.08): Stage 6 with a
     * partner still standing, where it means "turn on them". Without this the
     * tile stayed greyed out for exactly the person the guide gives that
     * decision to - the rule would have existed with no way to reach it.
     */
    const canBetray = key === "directMurder" && Boolean(betrayalTarget(actor));

    /*
     * AND IN A CLASS TRIAL, ONE TILE (T-1, Dawid 17.09).
     *
     * Analyze. The other nine are shut, Move included, and the reason the player
     * reads is the trial rather than the Eclipse - the same rule `performAction`
     * enforces, said here in advance so nobody presses a tile to be told no.
     * Direct Murder keeps its inverted rule and needs no branch: it is open only
     * in an Eclipse, a fight or a betrayal, none of which a trial is.
     */
    const inTrial = inClassTrial();

    const locked = key === "directMurder"
        ? (!eclipse && !inIncident && !canBetray)
        : (inIncident || eclipse || (inTrial && key !== "analyze"));

    /*
     * AND THE OTHER HALF: WHICH TILE IS THE MOVE (D12, Dawid 29.08).
     *
     * Dimming nine tiles says what you cannot do. It does not say what you can,
     * and in both of these moments the player is looking at a sheet that has
     * just changed under them and needs an answer, not an elimination.
     *
     * TWO MOMENTS, AND THE SECOND IS THE ONE THAT EARNS THIS.
     *
     *   In an incident: everything is shut except Direct Murder, which is no
     *   longer Direct Murder - it opens the incident's own actions. Lighting it
     *   turns "why is everything grey" into "press this".
     *
     *   After the kill: nothing is shut. The killer has their whole budget and
     *   no reason to suspect that one tile now behaves differently - Tamper is
     *   free of the action economy for the rest of this time of day (D3). A
     *   rule nobody is told about is a rule that does not exist at the table,
     *   and this is the only place it can be said at the moment it applies.
     *
     * `isCleaner` is the same window D3 charges by, read from the same module,
     * so the light and the discount cannot disagree.
     */
    const cleaningNow = key === "tamper" && isCleaner(actor);
    // Lit in all three of its open windows: the fight, and the betrayal, and
    // the killer's own clean-up on the tile next to it. A door nobody can see
    // is the same as a locked one (D12).
    const theMove = (key === "directMurder" && (inIncident || canBetray)) || cleaningNow;

    /*
     * IN A FIGHT THE TILE IS THE FIGHT'S (E32+E07 C16, 03.10.2026; audit S02-33, measured at
     * a table of three). It read "Direct Murder / 1 action / GM" for both sides: the victim
     * was told their crisis actions were under Actions and found a tile offering to murder
     * somebody, and the cost and the chip were both wrong - a crisis action spends no action
     * (`costOf`) and asks no ruling of the tile (config.mjs `murderParksForGm`). It is named
     * for the side now (`crisisTileLabel`), lit as it was, and off-turn it is dimmed with the
     * sentence the press answers (`openCrisisMenu`) - `aria-disabled` and not `disabled`,
     * because a disabled button takes no pointer, so its tooltip never shows (read, not
     * measured here: the harness draws no tooltip), and the press is what says it in words.
     */
    const fightTile = key === "directMurder" && inIncident;
    const offTurn = fightTile && !isTheirTurn(actor);

    button.className = `drpg-action-button${(affordable && !locked && !offTurn) ? "" : " unaffordable"}${
        blocked ? " drpg-no-subject" : ""}${theMove ? " drpg-action-hot" : ""}`;
    if (offTurn) button.setAttribute("aria-disabled", "true");

    // NOT `data-action`: ApplicationV2 claims that attribute for its own action
    // dispatch and swallows the click looking for a handler it does not have.
    button.dataset.drpgAction = key;

    // What this tile costs you, as a stripe rather than a sentence.
    //
    // Three kinds, and a player picks differently for each: one is free and can
    // always be taken, one spends a slice of a budget of two, and one hands the
    // turn to the GM and comes back at their pace. The cost line underneath
    // already says which - but it says it in words, at 11px, on ten tiles at
    // once, which is a paragraph to read before every decision.
    //
    // Derived from the definition rather than listed here, so an action whose
    // cost or GM involvement changes in config.mjs brings its stripe with it.
    const callsGm = callsGmFor(actor, def);
    // Four kinds and no fifth: a Sanity step takes the "stress" stripe both
    // stylesheets already carry, and a Hope step keeps whatever this tile would
    // have had - there is no `hope` stripe, and adding one means a new rule in
    // danganronpa.css AND in stained-glass.css for a colour a player meets once a
    // season (T-1).
    const ordinary = cost === 0 ? "free" : callsGm ? "gm" : "action";
    button.dataset.drpgCostKind = priced ? stripeKindFor(priced, ordinary) : ordinary;

    const costLabel = costLabelFor(actor, key, def);
    // Order matters: an Eclipse stops everything, so it is said first; not
    // being able to pay comes next; and "nothing here" is the one worth adding
    // even when something else already applies, because it is the only reason
    // that will still be true after the Eclipse ends.
    // The trial reason comes after the two that outrank it and before the
    // Eclipse's, so a trial running inside an Eclipse still says "the lights are
    // out" - that is the one the player can do something about.
    const lockReason = inIncident
        ? "DRPG.Murder.actionsLocked"
        : key === "directMurder"
            ? "DRPG.Eclipse.murderOnlyInEclipse"
            : inTrial && !eclipse
                ? "DRPG.Trial.actionsLocked"
                : "DRPG.Eclipse.actionsLocked";
    const note = locked
        ? `<br><em>${inIncident ? game.i18n.format(lockReason, { tile: crisisTileLabel(actor) }) : game.i18n.localize(lockReason)}</em>`
        : offTurn
            ? `<br><em>${game.i18n.localize("DRPG.Murder.offTurn")}</em>`
        : affordable
            ? ""
            // The chain's own sentence when there is one: "no action, no Hope and
            // no Sanity left" is a different refusal from "you have 0 of 1 action",
            // and it is the one that tells the player what to do about it.
            : `<br><em>${priced?.blocked
                ?? plural("DRPG.Action.cannotAfford",
                    { left: actionsLeft(actor), needed: cost }, "left")}</em>`;
    const why = blocked ? `<br><em>${foundry.utils.escapeHTML(blocked)}</em>` : "";
    // The light says "press this"; this says why it is free, because a discount
    // nobody can read is a discount nobody counts on (D3 + D12). Last, because
    // it is the only line here that is good news.
    const bonus = cleaningNow
        ? `<br><em>${freeTonightText()}</em>` : "";
    /*
     * THE TOOLTIP DOES NOT REPEAT THE COST (E3).
     *
     * `costLabel` is printed on the face of this very tile, three lines down,
     * and the stripe above says what kind of cost it is. Saying it a third time
     * in the hover made the tooltip two lines where one would do - on ten tiles
     * at once, which is how a player learns to stop reading them.
     *
     * What is left is the hint plus whatever is true right now and CANNOT be
     * read off the tile: why it is locked, why it cannot be paid for, why there
     * is nothing here to do it to, and why it is free tonight. Those appear one
     * at a time and only when they apply, so the ordinary hover is one line.
     */
    /*
     * KEPT IN TWO HALVES as well as composed, because `paintTamper` writes the
     * middle line a second later when the GM's ledger answers - see the note
     * there. Without these it cut off whatever the last line was.
     */
    // In a fight the definition's hint - "Open a direct murder" - is about another tile, and
    // off-turn the sentence is the whole of it.
    const hint = !fightTile ? def.hint ?? "" : offTurn ? "" : game.i18n.localize("DRPG.Murder.yourTurn");
    button.dataset.drpgTipHead = hint ? `${foundry.utils.escapeHTML(hint)}${note}` : note.replace(/^<br>/, "");
    button.dataset.drpgTipTail = bonus;
    button.dataset.tooltip = `${button.dataset.drpgTipHead}${why}${bonus}`;

    // Say what the stripe means, or the stripe means nothing.
    //
    // Four tiles read "1 action" and carry a grey stripe; five read "1 action"
    // and carry a red one. From the outside that is the same label with two
    // random colours. The difference is real - the grey ones hand the turn to
    // the GM - but it was only ever in the tooltip, and a colour whose key is
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

    // No cost line in a fight: nothing is spent, and "Free" on the one live tile reads as a discount.
    button.innerHTML = `
        <i class="fa-solid ${def.icon ?? "fa-circle"} drpg-action-icon" inert></i>
        <span class="drpg-action-name">${softWrap(foundry.utils.escapeHTML(fightTile ? crisisTileLabel(actor) : def.label))}</span>${
        fightTile ? "" : `
        <span class="drpg-action-cost">${costLabel}</span>`}${gmMark}`;

    return key === "move" ? stillMoveTile(button, locked) : button;
}

/*
 * THE MOVE TILE OPENS NOTHING (E100 item 1, 12.11.2026; the owner on the player-screens review, #2: the Move window had
 * one button, Got it, and only said "drag your token"). The tile a Monocub's panel draws keeps its price and its
 * tooltip, and says on its face what to do (`DRPG.Move.dragShort`); it is a `div`, not a button, with no
 * `data-drpg-action`, so the delegate (`attachActionDelegate`) has nothing to press and the stylesheets' hover, which
 * reads `:not(.drpg-action-still)`, does not light it as if it could be pressed. R4100.
 */
export function stillMoveTile(button, locked = false) {
    const tile = document.createElement("div");
    tile.className = button.className;
    tile.classList.add("drpg-action-still");
    for (const [k, v] of Object.entries(button.dataset)) if (k !== "drpgAction") tile.dataset[k] = v;
    tile.dataset.drpgTile = "move";
    tile.innerHTML = button.innerHTML;
    // No "Drag your token" where the tile is locked: a Class Trial or an incident refuses the drag (the r112 review's P2).
    if (!locked) {
        const line = document.createElement("span");
        line.className = "drpg-action-cost";
        line.textContent = game.i18n.localize("DRPG.Move.dragShort");
        tile.append(line);
    }
    /* Reached by the keyboard (the r112 review's P4): a `div` takes no focus, and Foundry shows `data-tooltip` on focus, so
       the hint and a lock's reason were the mouse's alone. Its words as its label, for a screen reader. Exported for R4472. */
    tile.tabIndex = 0;
    tile.setAttribute("role", "note");
    tile.setAttribute("aria-label", [tile.textContent.replace(/\s+/g, " ").trim(), button.dataset.tooltip ?? ""].filter(Boolean).join(". "));
    return tile;
}

/**
 * Does this action hand the turn to the GM - for THIS character, right now?
 *
 * `callsGm` used to be a constant, and for some of the actions carrying it that
 * is still the truth. For the others it was a half-truth that showed on the tile
 * as a promise the action often did not keep - Analyze with three unidentified
 * bullets in the bag is a roll, Work on Project in a room with a project in it is
 * a roll, and Direct Murder waits for the GM only as a declaration: in a fight it
 * opens the crisis actions, and at Stage 6 outside an Eclipse it is the betrayal,
 * which the player decides (E32+E07 C16; config.mjs `murderParksForGm`).
 *
 * So the flag may also be a predicate, and both forms are read here, in the one
 * place both consumers can share: the cost stripe and the "waits for the GM"
 * mark on the tile. Anything that throws counts as false - see the note on the
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
 * Until E103 a Move tile (the Monocub's) read its price here too - free in an
 * Eclipse, else the free Move or an action. No tile draws the Move since
 * (the owner, 13.11.2026), so every tile's price is its definition's, a chain's
 * quote or Direct Murder's free cases.
 */
function costOf(actor, key, def) {
    /*
     * A PRICED ACTION IS QUOTED, NOT COUNTED (T-1).
     *
     * The killer's own night still skips the action step (D3) - but that is now
     * `tamperPriceSkip`, the same list `chargeTamper` reads (through `tamperQuote`,
     * which also knows a critical Finishing blow's free attempt), rather than a
     * separate `isCleaner` test in this file that had to be kept in step by hand.
     * What comes back is the step that will really pay, so a Tamper about to cost
     * a Sanity mark no longer reads "1 action".
     */
    if (PRICE_CHAINS[key]) {
        const quote = priceQuoteFor(actor, key);
        return quote.pay === "action" ? quote.amount : 0;
    }

    if (key === "directMurder" && directMurderIsFree(actor)) return 0;
    return def.cost ?? 1;
}

/**
 * Whether Direct Murder spends nothing for this character now (E32+E07 C16, 03.10.2026; audit
 * S02-33): in a fight it opens the crisis actions, which `takeCrisisAction` charges nothing
 * for, and at Stage 6 outside an Eclipse it is the betrayal, which `performBetrayal` charges
 * only in an Eclipse. The tile said "1 action" for both, and dimmed itself as unaffordable for
 * a killer with no action left at the one moment it was the only thing to press.
 */
function directMurderIsFree(actor) {
    if (murderState()?.stage === "incident" && sideOf(actor)) return true;
    return !isEclipse() && Boolean(betrayalTarget(actor));
}

/**
 * One quote per tile, per render, from the table the charge reads.
 *
 * The skip list is what expresses D3 - the killer's own clean-up pays no action
 * step - and it lives in cleanup.mjs beside the charge, so the tile and the
 * charge cannot disagree about the price the way they did on the E23 round.
 */
function priceQuoteFor(actor, key) {
    return key === "tamper" ? tamperQuote(actor) : quotePrice(actor, key);
}

/**
 * A tile's price in words: a chain's step that will pay, else a flat price.
 *
 * Until E103 the Monocub's Move tile showed its live state here, an Eclipse's
 * crossings left ("1 / 2 crossings", "any room"); the header's two feet say that
 * now (`freeMovePip`), and no tile draws the Move (the owner, 13.11.2026).
 */
function costLabelFor(actor, key, def) {
    // The step that will pay, in words: "1 action", "1 Hope", "1 Sanity" (T-1).
    if (PRICE_CHAINS[key]) {
        const quote = priceQuoteFor(actor, key);
        return quote.blocked
            ? game.i18n.localize("DRPG.Action.costFree")
            : priceLabel(quote);
    }

    const cost = costOf(actor, key, def);
    return cost === 0
        ? game.i18n.localize("DRPG.Action.costFree")
        : plural("DRPG.Action.costActions", { n: cost });
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
    return actor ? trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.ultimate}`]: String(value ?? "").trim() }, { reason: "ultimate" }) : undefined;
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
 * Daggerheart opens a character sheet at its own default size (850 wide - see
 * `scaleWindow` in settings.mjs), which fitted when the Calls
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
 * afterwards keeps their size - the alternative, re-asserting on every render,
 * would undo a deliberate resize several times a turn.
 */
const grown = new WeakSet();
const SHEET_MIN_HEIGHT = SHEET_SIZE.minHeight;

/**
 * THE ACTIONS TAB FITS ITS WINDOW, MEASURED RATHER THAN PREDICTED (22.09).
 *
 * Under the glass the sheet's size is a statement - `SHEET_SIZE.glass` times the
 * interface scale, see `scaleWindow` - and it has no handle to correct it with. The
 * statement is right at 100 %, but not everything inside it scales with it: type has a
 * floor, a masked icon has a floor, borders and gaps do not shrink. At 80 % on a live
 * client (Dawid's, on 1.2.50) the Actions tab wanted 654 px and was given 642, so the
 * last row of Hope Calls stood under the frame and the tab scrolled by twelve pixels
 * ("pozwalaja na delikatny scroll").
 *
 * So the window grows by what the tab is short, once it is drawn and whenever the tab is
 * opened again - never past the screen, where a sheet that scrolls is still better than
 * one whose bottom is off the display, and never smaller. Stained Glass only: Monokuma
 * Legacy keeps its handle, and re-asserting a height on every render would undo a
 * deliberate resize (see `growForCalls`).
 */
function holdActionsTab(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root || typeof app?.setPosition !== "function") return;
    if (!document.body.classList.contains("drpg-theme-stained-glass")) return;

    const fit = () => {
        try {
            if (!root.isConnected) return;
            /* Asked again here, not only on the way in: the theme switches live, the sheet's
               root outlives the switch, and the listener below was bound under the glass. */
            if (!document.body.classList.contains("drpg-theme-stained-glass")) return;
            const tab = root.querySelector('section.tab[data-tab="features"].active');
            if (!tab) return;
            const short = tab.scrollHeight - tab.clientHeight;
            if (short <= 0) return;
            const now = root.getBoundingClientRect().height;
            const want = actionsTabHeight(now, short, window.innerHeight);
            if (want > now + 0.5) app.setPosition({ height: want });
        } catch {
            // Cosmetic. A tab that scrolls still works.
        }
    };
    /* After `scaleWindow` has written the scaled size (it runs on the same render, from a
       later hook) and after the tiles' own fit has settled their text; and once more when
       the faces have loaded, which is when a line can still wrap. */
    const later = () => requestAnimationFrame(() => requestAnimationFrame(fit));
    later();
    document.fonts?.ready?.then(later);

    if (root.dataset.drpgHoldActions) return;
    root.dataset.drpgHoldActions = "1";
    root.addEventListener("click", ev => {
        if (ev.target.closest?.('nav [data-tab="features"]')) later();
    });
}

function growForCalls(app) {
    try {
        if (!app || grown.has(app)) return;
        grown.add(app);
        const height = app.position?.height;
        if (typeof height !== "number" || height >= SHEET_MIN_HEIGHT) return;
        // Never past the window: a sheet taller than the screen is worse than a
        // sheet that scrolls (settings.mjs `callsHeight`).
        app.setPosition({ height: callsHeight(window.innerHeight) });
    } catch {
        // Cosmetic. A sheet that opens at its old size still works.
    }
}
