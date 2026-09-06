/**
 * Danganronpa RPG - the theme's own controls (theme "Stained Glass").
 * ---------------------------------------------------------------------------
 * Three of the audit's families cannot be finished in CSS alone, because what
 * they need is one more element than the markup has:
 *
 *   - the number field's stepper. The audit page draws a pixel minus and plus
 *     beside the value and no browser arrows. `appearance: none` removes the
 *     arrows; nothing puts the two buttons there but code.
 *   - the select's glyph. Same story: the browser's arrow can be removed, and
 *     the sprite's `sort` glyph cannot be drawn on a `select` from a rule -
 *     it has no pseudo-elements to hang it on.
 *   - the table's number columns. The theme has had `td.num { text-align:
 *     right }` since 1.2.18 and not one row anywhere in the module carries the
 *     class, so every table's figures were still ragged. Which columns hold
 *     numbers is something the table itself knows, so it is read off the
 *     cells rather than written into six window builders by hand.
 *
 * Everything here is additive and idempotent: it decorates what a window has
 * already rendered, marks what it touched, and never rewrites a value. The
 * input keeps its name, its value and its form, so Foundry's own form handling
 * reads exactly what it read before.
 *
 * Under "Monokuma Legacy" nothing in this file runs.
 */

import { log } from "./utils.mjs";

const DONE = "drpgChrome";

/** True when this browser wears the Stained Glass theme. */
function themeOn() {
    return document.body.classList.contains("drpg-theme-stained-glass");
}

/* ---- the number field: two pixel buttons, and the browser's arrows gone ---- */

/**
 * One step of a number input, respecting its own `min`, `max` and `step`, and
 * telling the window it changed the way a keystroke would.
 */
function step(input, direction) {
    const stepSize = Number(input.step) || 1;
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    const current = Number(input.value);
    const from = Number.isFinite(current) ? current : (Number.isFinite(min) ? min : 0);
    const next = Math.min(max, Math.max(min, from + direction * stepSize));
    if (next === current) return;
    input.value = String(next);
    // `input` for anything listening as it is typed, `change` for the form itself.
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

function pixButton(glyph, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `drpg-step drpg-step-${glyph}`;
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    // `inert` on the mask so the glyph cannot become the click target - the same
    // guard the launchers carry.
    button.innerHTML = `<span class="drpg-pxi" inert></span>`;
    return button;
}

function dressNumberField(input) {
    if (input.dataset[DONE] || input.disabled || input.readOnly) return;
    input.dataset[DONE] = "step";
    const wrap = document.createElement("span");
    wrap.className = "drpg-stepper";
    input.replaceWith(wrap);
    const minus = pixButton("minus", game.i18n.localize("DRPG.Look.stepDown"));
    const plus = pixButton("plus", game.i18n.localize("DRPG.Look.stepUp"));
    wrap.append(minus, input, plus);
    minus.addEventListener("click", () => step(input, -1));
    plus.addEventListener("click", () => step(input, 1));
    /* One line of explanation under the field, as the audit page draws it, and only while
       the value is actually out of range - the browser says this in a tooltip nobody opens. */
    const message = document.createElement("span");
    message.className = "drpg-field-msg";
    wrap.after(message);
    const check = () => {
        const value = Number(input.value);
        const min = input.min === "" ? -Infinity : Number(input.min);
        const max = input.max === "" ? Infinity : Number(input.max);
        const bad = Number.isFinite(value) && (value < min || value > max);
        input.classList.toggle("is-bad", bad);
        message.textContent = !bad ? ""
            : value > max ? game.i18n.format("DRPG.Look.atMost", { n: max })
                : game.i18n.format("DRPG.Look.atLeast", { n: min });
    };
    input.addEventListener("input", check);
    input.addEventListener("change", check);
    check();
}

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
const NUMERIC = /^[+-]?[\d]+(?:[.,]\d+)?\s*(?:\/\s*[+-]?\d+(?:[.,]\d+)?)?\s*%?$|^[-–—]$/;

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

/** Decorate one rendered window. Safe to call on the same element repeatedly. */
export function dressChrome(root) {
    if (!themeOn() || !root?.querySelectorAll) return;
    try {
        const panel = root.classList?.contains("drpg-panel") || root.closest?.(".drpg-panel");
        if (panel) {
            for (const input of root.querySelectorAll('input[type="number"]')) dressNumberField(input);
            for (const select of root.querySelectorAll("select")) dressSelect(select);
        }
        for (const table of root.querySelectorAll("table")) dressTable(table);
    } catch (err) {
        log("chrome pass failed", err);
    }
}

/** Called once at ready. */
export function registerChrome() {
    injectFilters();
    Hooks.on("renderApplicationV2", app => dressChrome(app?.element));
    // A window that redraws part of itself keeps its decorations, because the pass is
    // idempotent and marks what it has done; this catches the parts drawn after the render.
    Hooks.on("drpgWindowUpdated", el => dressChrome(el));
}
