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
/** The gutter the stack keeps off every wall it stands near. */
const EDGE = 8;
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
 * The stack keeps clear of Foundry's own two rails, in both directions.
 *
 * DOWNWARDS: the scene controls and the GM launcher are absolutely positioned at
 * the top of the interface, which is where the stack now is, so the left column
 * starts below it. The offset is the stack's measured height, which no media
 * query can know - it is the clock plus however many Monokuma rows this table has
 * plus whatever the tray is showing.
 *
 * SIDEWAYS, and this one shipped broken in 1.2.45. The stack ran to eight pixels
 * off the right wall, and the sidebar's tab rail stands in the last fifty or so:
 * measured at every stacked size, forty-eight pixels of every row were behind it
 * (48 x 419 at 393 x 852, 48 x 386 at 820 x 1180, 48 x 353 at 1024 x 768), which
 * on the Despair rail is exactly where the counts are and on the status strip
 * exactly where Hope is. The column is prepended into `#interface`, so the
 * sidebar - a later sibling at the same z-index - paints over it.
 *
 * MEASURED OFF THE RAIL'S OWN LEFT EDGE, not off a width. The rail sits inside
 * `#sidebar`, which carries padding of its own and grows to three hundred pixels
 * when the sidebar is opened; the distance from the wall to the tiles is the
 * number that actually matters and it is the one that stays put, because an open
 * sidebar grows INBOARD of its tabs. So an open sidebar slides over the stack
 * without moving it, which is the same rule the curtain keeps (glass.mjs).
 *
 * The clamp is there because this reads a box that may not be laid out yet: a
 * misread must cost the stack a gutter, never most of its width.
 */
function reserveRoom() {
    const column = document.getElementById(COLUMN_ID);
    const left = document.getElementById("ui-left-column-1");
    if (left) {
        const height = column ? Math.round(column.getBoundingClientRect().height) : 0;
        left.style.marginTop = height > 0 ? `${height + EDGE}px` : "";
    }
    if (column) column.style.right = `${railInset(column)}px`;
    noticesClearOfTheTools();
}

/**
 * And the notices keep off the tools, which the stack moved under them.
 *
 * The notice stack stands at the foot of the screen across its width
 * (styles/narrow.css). On a desk the scene controls are at the top left and the
 * two never meet; stacked, the controls have been pushed down to make room and
 * they end up exactly where the cards are - 80 px of a 393 px screen, measured.
 * Nothing becomes unclickable, because the notices take no clicks at all
 * (`pointer-events: none`, stated twice), but a card standing on the tool rail
 * reads as a card that has landed on top of something.
 *
 * Indented past the rail rather than shortened: a notice is prose and wants its
 * width, and the rail is the narrower of the two. The right-hand side takes the
 * same inset the stack does, so a card ends where the stack above it ends.
 */
function noticesClearOfTheTools() {
    const notices = document.getElementById("drpg-popups");
    if (!notices) return;
    if (!narrowLayout()) { notices.style.removeProperty("left"); notices.style.removeProperty("right"); return; }
    const rail = document.querySelector("#scene-controls");
    const r = rail?.offsetWidth ? rail.getBoundingClientRect() : null;
    const want = r ? Math.round(r.right) + EDGE : EDGE;
    const left = Math.min(Math.max(EDGE, want), Math.round(innerWidth * 0.4));
    /* `important`, because the theme states this tile's corner with one: the notice
       tile is a fixed box on the glass and it is pinned at "the audit page's place"
       (stained-glass.css). A plain inline value loses to it and the card stays on
       the tools - which is what the first version of this measured. */
    notices.style.setProperty("left", `${left}px`, "important");
    notices.style.setProperty("right", `${railInset(notices)}px`, "important");
}

/** How far short of the right wall a block stops, so the tab rail keeps its own strip. */
function railInset(el) {
    const tabs = document.querySelector("#sidebar-tabs");
    const host = el.offsetParent ?? document.getElementById("interface") ?? document.documentElement;
    if (!tabs?.offsetWidth || !host) return EDGE;
    const wall = host.getBoundingClientRect();
    const rail = tabs.getBoundingClientRect();
    const want = Math.round(wall.right - rail.left) + EDGE;
    return Math.min(Math.max(EDGE, want), Math.round(wall.width * 0.4));
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
    /* The rail is watched too: Foundry wraps its tiles into a second column when
       the run is taller than the screen, which is exactly what a phone does to it,
       and a rail that got wider without this would take the stack's edge back. */
    const tabs = document.querySelector("#sidebar-tabs");
    if (tabs) columnWatch.observe(tabs);
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
    const notices = document.getElementById("drpg-popups");
    if (notices) { notices.style.removeProperty("left"); notices.style.removeProperty("right"); }
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
