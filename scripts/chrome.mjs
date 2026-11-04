/**
 * Danganronpa RPG - the theme's own controls (theme "Stained Glass"), and the kit's number fields wired.
 * ---------------------------------------------------------------------------
 * Two of the audit's families cannot be finished in CSS alone, because what
 * they need is one more element than the markup has:
 *
 *   - the select's glyph. The browser's arrow can be removed, and the
 *     sprite's `sort` glyph cannot be drawn on a `select` from a rule - it
 *     has no pseudo-elements to hang it on.
 *   - the table's number columns. The theme has had `td.num { text-align:
 *     right }` since 1.2.18 and not one row anywhere in the module carries the
 *     class, so every table's figures were still ragged. Which columns hold
 *     numbers is something the table itself knows, so it is read off the
 *     cells rather than written into six window builders by hand.
 *
 * Everything here is additive and idempotent: it decorates what a window has
 * already rendered, marks what it touched, and never rewrites a value. The
 * select keeps its name, its value and its form, so Foundry's own form handling
 * reads exactly what it read before.
 *
 * ONLY THE MODULE'S WINDOWS (E44 C4b, 04.11.2026; audit S01-58): a select and a
 * table are dressed inside a `.drpg-panel` and nowhere else. Until C4b the
 * tables were dressed outside that branch, so a Daggerheart sheet's table or
 * another module's got `data-drpg-chrome` and `num` / `act` classes (R1328).
 *
 * THE NUMBER FIELD was a third family here until E44 C4b: `dressNumberField`
 * put a pixel - and + round every number input under Stained Glass only, so
 * under Monokuma Legacy each was the browser's spinner. The twelve fields are
 * ui-kit.mjs `stepper`s now, with their - and + in the markup, and this pass
 * wires them (`wireSteppers`) in both themes, before its theme gate (R1327).
 * Under "Monokuma Legacy" nothing else in this file runs.
 */

import { log } from "./utils.mjs";
import { glassOn } from "./motion.mjs";
import { wireSteppers } from "./ui-kit.mjs";

const DONE = "drpgChrome";

/** True when this browser wears the Stained Glass theme - the shared reading in motion.mjs. */
const themeOn = glassOn;

/* ---- the select: the sprite's own arrow ------------------------------------ */

function dressSelect(select) {
    if (select.dataset[DONE]) return;
    select.dataset[DONE] = "select";
    const wrap = document.createElement("span");
    wrap.className = "drpg-select";
    select.replaceWith(wrap);
    wrap.append(select);
}

/* ---- the table: which columns are numbers ---------------------------------- */

/** A cell that is a figure and nothing else: "3", "2 / 4", "5/12", "-", "12%", "+2". */
const NUMERIC = /^[+-]?[\d]+(?:[.,]\d+)?\s*(?:\/\s*[+-]?\d+(?:[.,]\d+)?)?\s*%?$|^[-\u2013\u2014]$/;

function dressTable(table) {
    if (table.dataset[DONE]) return;
    table.dataset[DONE] = "num";
    const rows = [...table.tBodies].flatMap(body => [...body.rows]).filter(r => r.cells.length);
    if (rows.length < 2) return;                      // one row is not evidence of a column
    const columns = Math.max(...rows.map(r => r.cells.length));
    for (let i = 0; i < columns; i++) {
        const cells = rows.map(r => r.cells[i]).filter(Boolean);
        // every cell in the column has to be a bare figure, and at least one has to be a digit
        if (cells.length < rows.length) continue;
        if (!cells.every(c => !c.children.length && NUMERIC.test(c.textContent.trim()))) continue;
        if (!cells.some(c => /\d/.test(c.textContent))) continue;
        for (const cell of cells) cell.classList.add("num");
        for (const head of [...table.tHead?.rows ?? []]) head.cells[i]?.classList.add("num");
    }
    // the last column of a table of buttons is the actions column, and reads from the right
    const last = columns - 1;
    const tail = rows.map(r => r.cells[last]).filter(Boolean);
    if (tail.length === rows.length && tail.every(c => c.querySelector("button, a.drpg-mini-button"))) {
        for (const cell of tail) cell.classList.add("act");
        for (const head of [...table.tHead?.rows ?? []]) head.cells[last]?.classList.add("act");
    }
}

/* ---- the two filters the audit page draws with -------------------------------
   The brush is a rectangle whose edge is torn by a displacement map, and a stamp
   is an ink blot: both are SVG filters, and a filter has to exist in the document
   before `filter: url(#id)` can find it. One hidden <svg> with two <filter>s, put
   in the body once. Cheap: a displacement map on a button-sized box costs less
   than the box's own text. Stained Glass only; the sheet gates the `url()`s on
   the theme and on the glass-effects switch. */
const FILTERS_ID = "drpg-filters";
export function injectFilters() {
    if (document.getElementById(FILTERS_ID)) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = FILTERS_ID;
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
    svg.innerHTML = `<defs>
        <filter id="drpg-brush" x="-10%" y="-40%" width="120%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.4" numOctaves="2" seed="11" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <filter id="drpg-ink-blot" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="3" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
    </defs>`;
    document.body.append(svg);
}

/* ---- one pass over a window ------------------------------------------------ */

/**
 * Decorate one rendered window. Safe to call on the same element repeatedly.
 *
 * PRICED, BECAUSE IT LOOKS EXPENSIVE AND IS NOT. It runs on every
 * `renderApplicationV2` and it does structural surgery - `replaceWith` per
 * number field and per select, a regex over every cell of every table - so a
 * 1.2.47 audit pass proposed rebuilding it on `display: grid` to stop moving
 * the inputs, on the strength of 25.83 ms measured in JSDOM.
 *
 * It does not reproduce in a browser. Measured in Chromium against the glass
 * harness, median of seven, on windows built to the shapes the module actually
 * opens:
 *
 *     4 fields, 1 select, a 6x4 table     (42 nodes)    0.2 ms
 *    24 fields, 5 selects, a 24x8 table  (260 nodes)    0.7 ms
 *    60 fields, 12 selects, a 60x10 table (761 nodes)   2.5 ms
 *    the same window a second time                        0 ms
 *
 * JSDOM's `replaceWith` and `querySelectorAll` are orders of magnitude slower
 * than a browser's, which is what that 25.83 ms was measuring. The second-pass
 * zero is the marking doing its job. So: not a window-open cost, and not worth
 * the risk of rebuilding how every form field in the module is drawn. If it is
 * ever suspected again, re-take these five numbers before touching it.
 * They were taken while the pass also wrapped every number field (until E44
 * C4b); it wraps the selects only now, and was not measured again.
 */
export function dressChrome(root) {
    if (!root?.querySelectorAll) return;
    try {
        // The kit's steppers, in both themes (E44 C4b): their - and + are in the markup, only the listeners are added.
        wireSteppers(root);
        if (!themeOn()) return;
        /* A KEPT CARD IS LEFT AS THE HISTORY DREW IT (E77 fix r2-H9, 13.10.2026). The notice history window draws a
           past card's body lazily, when its entry opens, and no hook reaches that; a redraw of the window's list
           (keepLive, then `drpgWindowUpdated`) opens it again and came through here, so the same card's table read
           `data-drpg-chrome` (and, read in the code, `num` on a column of figures) only after the list had been
           drawn again. Measured with R294's window clause and a redraw forced after the entry opened
           (e77run/scratch/r2h9-trial.mjs, DRPG_REBUILD=after): attrs ["data-drpg-chrome"] under the snapshot. The
           history allows its own classes only (notice-history.mjs NOTICE_CLASSES) and no `data-*`, so nothing
           under `.drpg-notice-snapshot` is dressed and the card stays as it was on its first opening. */
        const dress = selector => [...root.querySelectorAll(selector)].filter(el => !el.closest(".drpg-notice-snapshot"));
        const panel = root.classList?.contains("drpg-panel") || root.closest?.(".drpg-panel");
        if (panel) {
            for (const select of dress("select")) dressSelect(select);
            for (const table of dress("table")) dressTable(table);
        }
    } catch (err) {
        log("chrome pass failed", err);
    }
}

/** Called once at ready. */
export function registerChrome() {
    injectFilters();
    Hooks.on("renderApplicationV2", app => dressChrome(app?.element));
    /* `drpgWindowUpdated` IS FIRED BY NOBODY, and has not been.
       The hook was added so a window redrawing part of itself would keep its
       decorations - the pass is idempotent and marks what it has done - and the
       other half was never written: `grep -rn drpgWindowUpdated` over the whole
       tree returns this line and nothing else (16.09).
       Kept rather than deleted, because the intention is sound and the listener
       is the cheap half: anything in this module that rebuilds part of an open
       window can fire it and get its chrome back. If nothing ever does, this is
       one registration at ready and no cost at all. */
    Hooks.on("drpgWindowUpdated", el => dressChrome(el));
}
