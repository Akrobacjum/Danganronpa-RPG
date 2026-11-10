/**
 * Danganronpa RPG - the wide window: columns of sections, in a window of one stated width.
 * ---------------------------------------------------------------------------
 * The blocks of the layout every action window shares since E68 C12 (layout B of round M, the owner's answers of
 * 10.11.2026: "layout B for every action window"), kept here with no action in them, because the owner's amend of
 * 10.11.2026 has the module's settings window (E49) built on the same layout: "jest pionowy, wymaga duzo scrollowania
 * [...] To ten sam przypadek, co ekran akcji". E49 imports these; it does not copy them.
 *
 *   WIDE                       the stated width (1120 px) and the columns' class (`drpg-variant-columns`)
 *   columnsHtml(columns)       the columns, side by side: each `{ html, cls }` (or a string), in order
 *   sectionHtml({ title, body, cls })   one section of a column: a header line and what it holds
 *   choiceRowHtml(o, opts)     one row of a list a player picks from (an icon, a title, a line of explanation)
 *   wideWindow({ columns, width, ...rest })   ui-kit.mjs `drpgWindow` with that body and that width
 *
 * WHY 1120 PX (E21 fix G2, 07.11.2026, measured in Chromium on the style harness's capture of Observe): at 1000 px Focus
 * your gaze and an open "All thresholds" still scrolled 15-16 px under the glass at 1366x768; at 1120 px every pick read
 * still in both themes, the tallest body 555 px of the glass's 571 (Legacy 426 of 616). Round M (10.11.2026,
 * S/stages/E68/mockups/NOTES.md) drew Observe, Search, the crisis menu and Take from the Body at that width: 0 px of
 * scroll at 1366x768 and 1920x1080 in both themes, but the crisis menu's 22 px under the glass at 1366x768. The kit
 * holds a stated width under the screen less 16 px (ui-kit.mjs `kitWidth`), and the stylesheet stacks the columns when
 * the window is narrower than both (a phone: not supported, the owner's 10.11.2026, and not measured).
 *
 * No game logic here and no localised text: a caller hands in markup it has escaped. A row's `label`, `hint` and `why`
 * are literal text and escaped here, as `chooseVariant` escaped them before the row moved out of it.
 */

import { esc, GM_ROUTE_CLASS } from "./utils.mjs";
import { drpgWindow } from "./ui-kit.mjs";

export const WIDE = Object.freeze({ width: 1120, cls: "drpg-variant-columns" });

/** The columns, side by side, in the order given: each column `{ html, cls }` or a string of markup. */
export function columnsHtml(columns = []) {
    const cols = columns.map(c => (typeof c === "string" ? { html: c } : c ?? { html: "" }));
    return `<div class="${WIDE.cls}">${cols.map(c =>
        `<div class="drpg-wide-col${c.cls ? ` ${esc(c.cls)}` : ""}">${c.html ?? ""}</div>`).join("")}</div>`;
}

/** One section of a column: a header line (literal text, escaped) and its markup. No title: the body alone. */
export function sectionHtml({ title = "", body = "", cls = "" } = {}) {
    return `<section class="drpg-wide-section${cls ? ` ${esc(cls)}` : ""}">${
        title ? `<h3 class="drpg-wide-head">${esc(title)}</h3>` : ""}${body}</section>`;
}

/**
 * One row of a pick list: `{ value, label, hint, icon, gmRoute, disabled, why, struck }` (literal text), checked when
 * `checked`. An unavailable row stays on the list with its reason where the hint goes; a row that waits for a GM takes
 * `drpg-gm-route` (utils.mjs `GM_ROUTE_CLASS`, R121).
 */
export function choiceRowHtml(o, { checked = false, name = "variant", type = "radio" } = {}) {
    return `
        <label class="drpg-choice${o.disabled ? " unavailable" : ""}${
            o.gmRoute ? ` ${GM_ROUTE_CLASS}` : ""}${o.struck ? " drpg-row-denied" : ""}">
            <input type="${esc(type)}" name="${esc(name)}" value="${esc(o.value)}"${
                checked ? " checked" : ""}${o.disabled ? " disabled" : ""}>
            <i class="fa-solid ${esc(o.icon ?? "fa-circle")}" inert></i>
            <span class="drpg-choice-text">
                <strong>${esc(o.label)}</strong>
                <small>${esc(o.disabled ? (o.why ?? o.hint ?? "") : (o.hint ?? ""))}</small>
            </span>
        </label>`;
}

/** A kit window of the stated width whose body is the columns given; every other key is `drpgWindow`'s. */
export function wideWindow({ columns = [], width = WIDE.width, ...rest } = {}) {
    return drpgWindow({ ...rest, width, body: columnsHtml(columns) });
}
