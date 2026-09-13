/**
 * Danganronpa RPG - the module on a screen that is not a desk.
 * ---------------------------------------------------------------------------
 * Foundry lays its interface out in columns that assume a desk: the left column
 * at the top left, the top bar centred, the right column against the sidebar.
 * The module puts its own blocks in them - the clock in the left, the Despair
 * rail and the Event card in the top, the status strip and the Projects tray in
 * the right - and measured at every size (audit/glass-harness.html, 13.09) the
 * three columns start colliding at about 1196 px of width and are a pile by
 * 393 px: five overlapping pairs, two blocks off the screen altogether.
 *
 * Below the breakpoint, then, the blocks leave those columns and stack in one of
 * this module's own: full width, at the top, scrolled if it runs out of room,
 * with the board under it. Foundry's own left column - the scene controls and
 * the GM launcher - is pushed down by exactly the column's height, which is the
 * one number that cannot be written in CSS because it depends on what is in the
 * stack today.
 *
 * THREE THINGS MOVE, AND ONE OF THEM IS A CONTAINER. The clock and the Despair
 * rail are the module's own and are moved as themselves; the Event card is not
 * moved at all, because it renders next to the rail and follows it. The status
 * strip and the Projects tray are NOT moved one by one: `#ui-right-column-1` is
 * moved whole, so the tray - which Daggerheart appends into that column on every
 * project it advances, and which this module deliberately does not re-parent -
 * arrives with it and stays without anything re-asserting.
 *
 * NOTHING IS MOVED BEHIND A RENDER'S BACK. The blocks that re-render ask
 * `narrowColumn()` for their host, so a redraw puts them straight into the stack
 * rather than back in a column this would have to chase. What is left for the
 * observer below is Foundry rebuilding `#ui-right`, which happens on a scene
 * change and not on a render.
 *
 * The curtain draws over the stack, cut for it: `stackShapes` in glass.mjs is a
 * partition for this shape rather than for the desk's three columns. It stands
 * down only where the stack has to scroll - under 620 px of height - because a
 * row scrolled under the ceiling can have no glass cut for it.
 */

import { narrowScreen } from "./settings.mjs";
import { error } from "./utils.mjs";

const COLUMN_ID = "drpg-column";
/** The stack, for anything that has to measure it - the curtain cuts its panes to it. */
export const COLUMN_SEL = "#" + COLUMN_ID;
/** The blocks that stack, in the order they stack in. */
const STACKED = ["#drpg-hud", "#drpg-despair", "#ui-right-column-1"];

/** Where each moved element came from, so a resize back to a desk can undo it. */
const HOMES = new Map();
let columnWatch = null, reserveFrame = 0;

/** True when the module's blocks must stack instead of sitting in Foundry's columns. */
export function narrowLayout() {
    return narrowScreen();
}

/**
 * The column the module's blocks stack in, or null on a desk.
 *
 * This is what the render functions ask for: `narrowColumn() ?? <the usual host>`.
 * It creates the column on demand so the first block to render makes it, in
 * whatever order the blocks happen to come up.
 */
export function narrowColumn() {
    if (!narrowLayout()) return null;
    try {
        return ensureColumn();
    } catch (err) {
        error("The narrow layout could not make its column", err);
        return null;
    }
}

function ensureColumn() {
    const found = document.getElementById(COLUMN_ID);
    if (found?.isConnected) return found;
    const column = document.createElement("div");
    column.id = COLUMN_ID;
    /* In `#interface`, where Foundry's own columns are, so it is under the same
       stacking rules and over the board like they are. Prepended rather than
       appended: the order within the stack is the stylesheet's business, but the
       column itself must not land on top of the sidebar. */
    (document.getElementById("interface") ?? document.body).prepend(column);
    return column;
}

/** Put the stack up, or take it down, according to the screen. Safe to call repeatedly. */
export function applyNarrowLayout() {
    try {
        if (!narrowLayout()) { restoreDesk(); return; }
        const column = ensureColumn();
        for (const sel of STACKED) {
            const el = document.querySelector(sel);
            if (!el || el.parentElement === column) continue;
            if (!HOMES.has(el)) HOMES.set(el, { parent: el.parentElement, next: el.nextElementSibling });
            column.append(el);
        }
        watchColumn(column);
        reserveRoom();
    } catch (err) {
        error("The narrow layout could not be applied", err);
    }
}

/**
 * Foundry's left column starts below the stack.
 *
 * Its scene controls and the module's GM launcher are absolutely positioned at
 * the top of the interface, which is where the stack now is. The offset is the
 * stack's measured height, which no media query can know: it is the clock plus
 * however many Monokuma rows this table has plus whatever the tray is showing.
 */
function reserveRoom() {
    const column = document.getElementById(COLUMN_ID);
    const left = document.getElementById("ui-left-column-1");
    if (!left) return;
    const height = column ? Math.round(column.getBoundingClientRect().height) : 0;
    left.style.marginTop = height > 0 ? `${height + 8}px` : "";
}

/* The stack changes height whenever anything in it redraws - a Monokuma row is
   spent, a project advances, the Event card arrives - and each of those would
   otherwise leave the scene controls under it. Once per frame, like every other
   observer in this module. */
function watchColumn(column) {
    if (columnWatch || !("ResizeObserver" in window)) return;
    columnWatch = new ResizeObserver(() => {
        if (reserveFrame) return;
        reserveFrame = requestAnimationFrame(() => { reserveFrame = 0; reserveRoom(); });
    });
    columnWatch.observe(column);
}

/** Every moved element back where it came from, and the column gone. */
function restoreDesk() {
    for (const [el, home] of HOMES) {
        if (!home.parent?.isConnected) continue;
        if (home.next?.isConnected && home.next.parentElement === home.parent) home.parent.insertBefore(el, home.next);
        else home.parent.append(el);
    }
    HOMES.clear();
    columnWatch?.disconnect();
    columnWatch = null;
    document.getElementById(COLUMN_ID)?.remove();
    const left = document.getElementById("ui-left-column-1");
    if (left) left.style.marginTop = "";
}

/** Called once at ready. The resize itself is watched in settings.mjs, with the scale. */
export function registerNarrow() {
    applyNarrowLayout();
    /* A scene change rebuilds `#ui-right`, and Foundry puts a fresh
       `#ui-right-column-1` in it - a column this has never seen and whose home is
       therefore recorded from scratch. `canvasReady` is where every other block in
       the module re-asserts itself for the same reason. */
    Hooks.on("canvasReady", () => applyNarrowLayout());
}
