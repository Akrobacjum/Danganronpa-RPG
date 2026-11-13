/**
 * The slider scaling of a module window box (E54, the plan W3): `registerWindows` stands `scaleWindow` on the two render
 * hooks with the readers module.mjs hands it (the slider, the layout height, whether the settings are registered), the
 * memo that keeps a re-render from compounding the scale (`scaleMemo`), the box a window asks for scaled and held on
 * the screen (`scaledBox`, `sheetBox`), and the sheet heights (`actionsTabHeight`, `callsHeight`, Q-E54-7). Moved out of
 * settings.mjs, which re-exports what it exported. windows.mjs (W1) holds the width that shows a table.
 */

import { SHEET_SIZE } from "./config.mjs";

/**
 * Every character sheet standing open, asked again for its box (E21 C5a, 06.11.2026; audit S01-06). A sheet sized on a
 * taller screen kept that height after a resize - the memo `drpgScaled` keyed on the slider alone - so a window dragged
 * to a 768 px screen, or a browser made shorter, left the sheet's foot and the Stop below the screen until the slider
 * moved. Each sheet goes through `scaleWindow`, whose memo (`scaleMemo`) now holds the layout height beside the slider.
 */
export function rescaleSheets() {
    for (const app of globalThis.foundry?.applications?.instances?.values?.() ?? []) {
        if (app?.document?.type !== "character") continue;
        const el = app.element instanceof HTMLElement ? app.element : app.element?.[0];
        if (el) scaleWindow(app, el);
    }
}

/*
 * THE OTHER THEME'S SWITCHES ARE NOT SHOWN.
 *
 * Three of the look settings only exist under Stained Glass - the pulse, the ticker and
 * the blur - and the pixel face only exists under Monokuma Legacy, which has no second
 * face of its own to swap. Reduced motion is in neither list: it is for both themes since
 * W-3. Whichever theme is on, the other's switches still sat in Foundry's settings window
 * looking live, and changing one did nothing.
 *
 * HIDDEN, not greyed (Dawid, 08.09). They were greyed here and simply absent from the
 * Look window, which builds the same switches from the same settings - so the two
 * windows disagreed about whether a switch existed at all. One of them had to change,
 * and the Look window is the one a player actually opens. The row is hidden, never
 * disabled: a disabled field is left out of the form Foundry submits on Save, and a
 * setting that is merely irrelevant to this theme must keep the value it has.
 *
 * Off the SELECT, not the stored setting. Somebody who picks the other theme in this
 * window has not saved yet, and the switches follow the choice as it is made.
 */
/* ==========================================================================
   A WINDOW IS PART OF THE INTERFACE, SO THE SLIDER MOVES IT TOO
   ==========================================================================
   The scale multiplies the theme's own type and block sizes, which is what makes the
   CONTENTS of a window grow - and for a window that sizes itself to its contents that was
   the whole job. Sheets and dialogs do not: Foundry writes their width and height in pixels
   from the class's own defaults, so at 140 % the text grew inside a box that did not, and at
   80 % nothing moved at all ("zawartosc okien poprawnie sie powieksza, ale same okna juz
   nie", 07.09). The box is scaled here, once per render, from the size the application asked
   for rather than from whatever it is now - so re-rendering never compounds it, and a window
   the user has dragged wider keeps that width until it is rendered again.
   `auto` is left alone: a window that measures itself is already right. */

/**
 * The box a window asks for (`want`, its width and height), scaled by the slider `scale` and held inside a screen of
 * `vw` x `vh` less 48 px: what `scaleWindow` hands `setPosition`. Pure, so the fit sweep's sheet stand-in reads the
 * same numbers (E21 C1c, `sheetBox`). Answers the dimensions it could read, each a whole number of pixels.
 */
export function scaledBox(want, vw, vh, scale) {
    const size = {};
    for (const dim of ["width", "height"]) {
        const n = Number(want?.[dim]);
        if (Number.isFinite(n) && n > 0) size[dim] = Math.round(n * scale);
    }
    /* A window may not be taller than the screen it is on. At 140 % a 1160 px sheet asks for
       1624, and Foundry will happily place a window whose bottom is off the display. */
    if (size.height) size.height = Math.min(size.height, Math.round(vh - 48));
    if (size.width) size.width = Math.min(size.width, Math.round(vw - 48));
    return size;
}

/**
 * The height the glass sheet grows to when its Actions tab is `short` px short of its content and the window is `now`
 * px tall: two px over what the tab wants, never past a screen `vh` px tall less 48 (sheet-fit.mjs `holdActionsTab`, which
 * hands it `window.innerHeight`). Pure; the arithmetic is the one holdActionsTab did itself until E54 (Q-E54-7, the
 * plan's default: one family decides a window's size, R4803).
 */
export function actionsTabHeight(now, short, vh) {
    return Math.min(Math.ceil(now + short + 2), Math.max(0, vh - 48));
}

/**
 * The height a sheet opened shorter than the Legacy minimum grows to, once: `SHEET_SIZE.minHeight`, never past a
 * screen `vh` px tall less 40 (sheet-fit.mjs `growForCalls`, which hands it `window.innerHeight`). Pure; moved here from
 * growForCalls by E54 (Q-E54-7, R4803), the numbers as they were.
 */
export function callsHeight(vh) {
    return Math.min(SHEET_SIZE.minHeight, Math.max(0, vh - 40));
}

/** Daggerheart's own size for a character sheet, as the note in `scaleWindow` reads it (850 x 800): Monokuma Legacy
    keeps it. Read from the sheet class at a table; here for `sheetBox`, which has no class to read. */
const DAGGERHEART_SHEET = Object.freeze({ width: 850, height: 800 });

/**
 * The character sheet's box on a screen of `vw` x `vh` at the slider's `scale`, in `theme` ("glass" or "legacy"), as
 * `scaleWindow` sizes it (E21 C1c): the fit sweep's sheet stand-in (audit/style-harness.html `?sheet=1`) is drawn at
 * these numbers, since the sheet itself is Daggerheart's and is drawn neither headless nor on a harness page.
 */
/**
 * The memo a window's scaled box is kept under (E21 C5a): the slider and the layout height (`layoutHeight`, which an
 * on-screen keyboard does not lower), so a resize that changes the height sizes the window again and a second render
 * at the same numbers writes nothing. Until C5a the key was the slider alone.
 */
export function scaleMemo(scale, h = windowHeight()) {
    return `${scale}@${Math.round(Number(h) || 0)}`;
}

export function sheetBox(vw, vh, scale = 1, theme = "glass") {
    return scaledBox(theme === "glass" ? SHEET_SIZE.glass : DAGGERHEART_SHEET, vw, vh, scale);
}

/* THE SHEET OPENS BELOW THE CURTAIN'S BAND (S03-30, a B leftover of E49 built in E48 K6's run, 11.11.2026; the audit:
   "the sheet opens on the curtain and covers the Despair pools, the debate's timer and the incident's turn signal").
   The band is what stands at the top of the screen in the middle: Despair's pools and the Event panel (the debate's
   clock, the incident's turn), each where drawn; the sheet's top goes SHEET_BELOW_BAND under the lowest of them, on a
   first render only, so a sheet a player moved stays where it was put. Null with neither drawn: Foundry's place. A
   band whose foot is below the screen's middle is no band (a panel down a side), and is left alone. */
const SHEET_BELOW_BAND = 8;
export function sheetBandFoot() {
    const feet = ["#drpg-despair", "#drpg-events"].map(q => document.querySelector(q))
        .filter(e => e && e.offsetWidth > 0 && e.offsetHeight > 0).map(e => e.getBoundingClientRect().bottom);
    return feet.length ? Math.round(Math.max(...feet) + SHEET_BELOW_BAND) : null;
}

export function scaleWindow(app, element, _context, options) {
    if (!windowReaders?.registered()) return;
    const el = element instanceof HTMLElement ? element : element?.[0];
    /*
     * THE BOX IS BOTH THEMES' NOW (W-2, Dawid 19.09).
     *
     * It was the glass's alone, so on a Legacy client 140 % grew the type inside a
     * box that did not move and 80 % moved nothing at all - and because the
     * sheet's box never changed, the ResizeObserver in sheet.mjs never fired and
     * the action tiles were never re-measured either. At 100 % this writes the
     * numbers the window already has, and the `drpgScaled` memo below swallows
     * the repeat.
     */
    if (!el) return;
    const s = windowReaders.scale();
    const h = windowReaders.height();
    const key = scaleMemo(s, h);
    if (el.dataset.drpgScaled === key) return;
    el.dataset.drpgScaled = key;
    const want = { ...(app?.constructor?.DEFAULT_OPTIONS?.position ?? {}), ...(app?.options?.position ?? {}) };
    /* THE CHARACTER SHEET HAS A SIZE OF ITS OWN.
       Daggerheart opens it at 850 x 800, which was right for its own type; at the theme's
       floor the five-tile action grid does not fit that width and the last column is cut off
       at the frame (Dawid's screen, 07.09). The theme states the size the sheet is DRAWN for
       - the audit page's proportions, one grid wide and one deep - and the interface scale
       multiplies it like everything else, so 140 % opens a bigger sheet rather than the same
       box with bigger text in it. */
    /* AND IT IS A STATEMENT ABOUT THIS THEME ONLY (W-2, 19.09). 1120 x 1160 is
       VT323 at 17px and a five-tile grid under the glass; handing it to Monokuma
       Legacy would open a pixel-font sheet two thirds empty and take its resize
       handle away for a size nobody measured. Legacy keeps Daggerheart's own
       850 x 800 multiplied by the slider, and keeps the handle - the rule that hides
       it names the glass.

       AND ABOUT ONE WINDOW, ASKED BY ITS DOCUMENT (UI-09). A class-name match on
       "actor" also caught Foundry's Actors sidebar tab and any window with the word
       in its name, and `documentName === "Actor"` caught NPC sheets - all of them
       were forced to this size and lost their resize handle. */
    if (document.body.classList.contains("drpg-theme-stained-glass")
        && app?.document?.type === "character") {
        /* 1160 high, NOT 940. Measured on the sheet: the tallest tab wants 820 px of room and
           was given 607, so the last row of Hope Calls was simply below the fold - the window
           was sized for the old, smaller type. The extra 213 px is that shortfall. The numbers
           live in config.mjs (SHEET_SIZE) beside the Legacy minimum. */
        want.width = SHEET_SIZE.glass.width;
        want.height = SHEET_SIZE.glass.height;
    }
    const size = scaledBox(want, window.innerWidth, h, s);
    /* THE SHEET IS NOT RESIZED BY HAND UNDER THE GLASS - its size is a statement of that
       theme - and the handle is hidden by a THEME RULE in stained-glass.css rather than
       taken out of the DOM here. Removed here, it stayed gone after a switch to Monokuma
       Legacy, which keeps Daggerheart's size and was promised its handle (review of
       stage D): a one-way edit cannot follow a two-way switch, and a rule can. */
    if (!Object.keys(size).length) return;
    if (options?.isFirstRender && app?.document?.type === "character") {
        const foot = sheetBandFoot();
        if (foot !== null && foot < h / 2) {
            size.top = foot;
            if (size.height) size.height = Math.min(size.height, Math.round(h - foot - SHEET_BELOW_BAND));
        }
    }
    /* THROUGH `setPosition`, NOT THE ELEMENT'S STYLE. An ApplicationV2 writes its own
       `position` onto the element after every render, so an inline width set from the render
       hook was overwritten a moment later and the box never moved at all. Going through the
       application means the number it will write IS the scaled one, and it stays through the
       next re-render and through a drag. */
    if (typeof app.setPosition === "function") app.setPosition(size);
    else for (const [k, v] of Object.entries(size)) el.style[k] = v + "px";
}

/*
 * THE WINDOWS' SIZE IS REGISTERED AT INIT, HANDED ITS READERS (E54 W2, 13.11.2026; the plan's F2). The two hooks stood
 * at this file's foot, so they were registered at import, and `scaleWindow` and `scaleMemo` read this file's own
 * `sliderScale`, `layoutHeight` and `settingsRegistered` - which held the window's size to this file: moved out, the
 * code would import its facade back. module.mjs calls `registerWindows` under `safely("the windows' size", ...)`
 * before `registerSettings()`, handing the three readers; a throw there costs the windows' size, not the rest of init.
 * Until it runs nothing is sized - as before settings are registered - and a second call changes nothing (R4801).
 */
let windowReaders = null;

/** The layout height through the readers once handed, the window's own height before (nothing is sized then). */
function windowHeight() {
    return windowReaders ? windowReaders.height() : innerHeight;
}

/**
 * Register the windows' size: `readers` are `{ scale, height, registered }` - the interface slider's factor, the layout
 * height (an on-screen keyboard does not lower it) and whether the module's settings are registered.
 */
export function registerWindows(readers) {
    // The first registration holds: a second (a console's, a test's) changes neither the hooks nor the readers.
    if (windowReaders !== null) return false;
    windowReaders = readers;
    Hooks.on("renderApplicationV2", scaleWindow);
    Hooks.on("renderApplication", scaleWindow);
    return true;
}
