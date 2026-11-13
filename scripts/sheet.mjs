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
 *
 * E54 (the file split, wave 3): this file is the sheet family's facade. It keeps the registration
 * (`registerSheetTweaks`), the step table (`SHEET_STEPS`, `runSheetSteps`) and the render hook (`onRenderCharacterSheet`);
 * every other name it exported is re-exported from the family's files - sheet-mode, sheet-item, sheet-repaint, sheet-fit,
 * sheet-header, sheet-sidebar, sheet-inventory and sheet-actions - which never import it.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";

// `availableCrisisActions` and `isTheirTurn` went to the Direct Murder tile's
// menu with the crisis grid - see `openCrisisMenu` in action-murder.mjs.

// Two different rules, each under its own name since 1.2.69 (E33 C9, D39): the
// crime-witness marker on a Monocub (information only - it refuses nothing) and
// the Despair Call "Silence" on a living student (no Hope Calls until the time of
// day ends). Until then both arrived under one bare name and were renamed at this door,
// which is how a reader of this file took one for the other.

// `equippedFor` went with the clean-up panel's "what you have readied" note -
// the Tamper menu says it now, where the roll it applies to is chosen.

// `bodyIsHere` moved with the three Stage 6 actions - the Tamper menu asks it
// now (action-rolls.mjs), because that is where the body tile lives.

// The price a tile is about to charge, quoted from the same table the charge
// reads (T-1). Synchronous by design - this file calls it from a render path.

// The sheet's 'Known passages' (E79 C7): this browser's passages, the Mastermind as the GMs hold it, and the
// rooms named as Listen names them - a room this viewer has not found is "Unexplored room n".

// `sabotageTargetsIn` used to be imported here for the tile that no longer
// exists; the question is asked in action-rolls.mjs now, where the menu is.

import { error, markLanguage, markFired } from "./utils.mjs";

import { announceSheetSteps } from "./requirements.mjs";
import { sheetMode, RENDER_MODES } from "./sheet-mode.mjs";
import { trimItemSheet } from "./sheet-item.mjs";
import { installRenderPlan, settle } from "./sheet-repaint.mjs";
import { leaveLoadoutTab, keepTabScroll, removeSystemCreators, fitActionTiles, watchTileFit, holdActionsTab, growForCalls } from "./sheet-fit.mjs";
import { frameTraits, markTraitGlyphs, flashHope, injectActionBar, injectInitButton, injectAdvanceButton, markSheetState, injectClassControls, injectItemButton, injectUltimate } from "./sheet-header.mjs";
import { paintPartyReserves, noteStepStart, onTunnelStep, redrawPassageSheets, saveBiography, tidySidebar, paintReserves, injectEquippedTools, noteEmptyExperience, injectKnownPassages, injectSafeword, tidyBiography } from "./sheet-sidebar.mjs";
import { repaintPresentButtons, tidyInventoryTab, groupInventory } from "./sheet-inventory.mjs";
import { forgetTamper, replaceEffectsTab, injectActionPanel } from "./sheet-actions.mjs";
export { sheetMode, rowGate, headerGate } from "./sheet-mode.mjs";
export { wearMarkup, bulletBadges } from "./sheet-item.mjs";
export { renderPlan, RENDER_PLAN, installRenderPlan } from "./sheet-repaint.mjs";
export { moveSlots, moveFeetHtml, moveLegend, pendingStack, getUltimate, setUltimate, findDuplicateUltimates } from "./sheet-header.mjs";
export { paintReserves, writeReserve, paintPartyReserves, knownPassageRows, knownPassageItem, saveBiography, tidyBiography } from "./sheet-sidebar.mjs";
export { bulletGroups } from "./sheet-inventory.mjs";
export { monocubMoveNote, moveDragSaid, budgetLine, roomBlockFor, forgetTamper, actionButton, stillMoveTile } from "./sheet-actions.mjs";

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
