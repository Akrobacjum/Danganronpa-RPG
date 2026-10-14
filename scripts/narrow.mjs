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
 * with the board under it. Foundry's own left column - the scene controls, where
 * they still stand in it (E77 C5) - is pushed down by exactly the column's height, which is the
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
import { inFoundryWindow } from "./foundry-windows.mjs";

const COLUMN_ID = "drpg-column";
/** The stack, for anything that has to measure it - the curtain cuts its panes to it. */
export const COLUMN_SEL = "#" + COLUMN_ID;
/** The gutter the stack keeps off every wall it stands near. */
const EDGE = 8;
/* Where the notices start and end on a stacked screen, read by narrow.css (`noticesClearOfTheTools`). */
const NOTICES_LEFT = "--drpg-notices-left", NOTICES_RIGHT = "--drpg-notices-right";
/** The blocks that stack. The order on the screen is narrow.css's; this one is the order they are moved in. */
const STACKED = ["#drpg-hud", "#drpg-tile-row", "#drpg-despair", "#ui-right-column-1"];
/*
 * THE TILES' ROW (E77 C8, 13.10.2026; the A8 design's narrow layout). On a desk the room tile stands under
 * the clock at the height glass.mjs gives it (`roomSizes`: at least a third of its width, a heading and four
 * lines); the stack has no such room - at 1024x768 it reaches its ceiling with the tile as a 44 px row
 * already (the sweep's screenshot, 13.10.2026) - so here the tile is one row of 44 px: the picture as a
 * 78x44 thumbnail, the name, the search tokens and a button for the description, which opens in a window (room-tile.mjs). The row is
 * this file's own element and a block of the curtain's (`tiles-row`, measured, glass.mjs); its members are
 * moved into it as the clock is moved into the stack, and back. Since E78 C6 the voice tile is its second member,
 * on the row's right (narrow.css): the portrait as 32 px, the name and '+N', and its two buttons at 44 px.
 */
const ROW_ID = "drpg-tile-row";
const ROW_MEMBERS = ["#drpg-room-tile", "#drpg-voice-tile"];

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

/**
 * The row the tiles stand in on a stacked screen, made in the stack on demand, or null on a desk.
 *
 * room-tile.mjs asks for it before it puts the tile under the clock: the tile can be built before
 * the stack is (module.mjs builds it at `ready`, ahead of `registerNarrow`), and a tile that went
 * under the clock in the stack would stand there at its desk height.
 */
export function tileRow() {
    const column = narrowColumn();
    if (!column) return null;
    try {
        return ensureTileRow(column);
    } catch (err) {
        error("The narrow layout could not make the tiles' row", err);
        return null;
    }
}

function ensureTileRow(column) {
    const found = document.getElementById(ROW_ID);
    if (found?.parentElement === column) return found;
    const row = found ?? document.createElement("div");
    row.id = ROW_ID;
    column.append(row);
    return row;
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
        const row = ensureTileRow(column);
        for (const sel of STACKED) moveHome(document.querySelector(sel), column);
        for (const sel of ROW_MEMBERS) moveHome(document.querySelector(sel), row);
        watchColumn(column);
        reserveRoom();
    } catch (err) {
        error("The narrow layout could not be applied", err);
    }
}

/** `el` into `host`, its first home remembered for `restoreDesk`. */
function moveHome(el, host) {
    if (!el || el.parentElement === host) return;
    if (!HOMES.has(el)) HOMES.set(el, { parent: el.parentElement, next: el.nextElementSibling });
    host.append(el);
}

/**
 * The stack keeps clear of Foundry's own two rails, in both directions.
 *
 * DOWNWARDS: the scene controls (the GM launcher with them until E77 C6) are absolutely positioned at
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
 * The notice stack stands at the foot of the screen across its width, over the
 * corner buttons (styles/narrow.css). On a desk the scene controls are at the top
 * left and the two never meet; stacked, the controls have been pushed down to make
 * room and they end up exactly where the cards are - 80 px of a 393 px screen,
 * measured. Nothing becomes unclickable, because the notices take no clicks at all
 * (`pointer-events: none`, stated twice), but a card standing on the tool rail
 * reads as a card that has landed on top of something.
 *
 * Indented past the rail rather than shortened: a notice is prose and wants its
 * width, and the rail is the narrower of the two. The right-hand side takes the
 * same inset the stack does, so a card ends where the stack above it ends.
 *
 * TWO VARIABLES, NOT TWO INLINE INSETS (E81 C13, the A7 design's P8-7). Until then
 * this wrote `left` and `right` inline with `important`, because Stained Glass pins
 * the tile's corner with one (stained-glass.css) and a plain inline value lost to
 * it - which is what the first version of this measured. But an inline `important`
 * beats every sheet, narrow.css included, and sideways on a phone the notices'
 * right edge is the larger of this inset and the corner buttons' width: a `max()`
 * the sheet can write only if the inset reaches it as a value. So narrow.css now
 * states the insets with its own `!important` and reads them from here, and off
 * the narrow layout the two are taken away, as the insets were.
 */
function noticesClearOfTheTools() {
    const notices = document.getElementById("drpg-popups");
    if (!notices) return;
    if (!narrowLayout()) { forgetNoticeInsets(notices); return; }
    const rail = document.querySelector("#scene-controls");
    // a GM's rail in the Map tools window (E77 C5) holds no part of the wall
    const r = rail?.offsetWidth && !inFoundryWindow(rail) ? rail.getBoundingClientRect() : null;
    const want = r ? Math.round(r.right) + EDGE : EDGE;
    const left = Math.min(Math.max(EDGE, want), Math.round(innerWidth * 0.4));
    notices.style.setProperty(NOTICES_LEFT, `${left}px`);
    notices.style.setProperty(NOTICES_RIGHT, `${railInset(notices)}px`);
}

/** The notices' two insets gone, so a desk's sheets place the tile as they did. */
function forgetNoticeInsets(notices) {
    notices.style.removeProperty(NOTICES_LEFT);
    notices.style.removeProperty(NOTICES_RIGHT);
}

/** How far short of the right wall a block stops, so the tab rail keeps its own strip. */
function railInset(el) {
    const tabs = document.querySelector("#sidebar-tabs");
    const host = el.offsetParent ?? document.getElementById("interface") ?? document.documentElement;
    if (!tabs?.offsetWidth || inFoundryWindow(tabs) || !host) return EDGE;
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
    if (tabs && !inFoundryWindow(tabs)) columnWatch.observe(tabs);
}

/**
 * Every moved element back where it came from, and the column gone.
 *
 * LAST MOVED, FIRST BACK (E77 C8). The clock's recorded neighbour is the room tile, and the tile has
 * gone into the row since: put back in the order they left, the clock found its neighbour still in
 * the stack and went to the end of the left column instead of above the tile. A member of the row
 * with no home recorded - the tile room-tile.mjs put there itself - goes to the left column rather
 * than out with the row, and `ensureRoomTile` sets it under the clock at the clock's next render,
 * which `applyTheme` asks for straight after this. The voice tile voice-tile.mjs put there goes to
 * the body instead (E78 C6), where the curtain's next pass seats it.
 */
function restoreDesk() {
    for (const [el, home] of [...HOMES].reverse()) {
        if (!home.parent?.isConnected) continue;
        if (home.next?.isConnected && home.next.parentElement === home.parent) home.parent.insertBefore(el, home.next);
        else home.parent.append(el);
    }
    HOMES.clear();
    const row = document.getElementById(ROW_ID);
    // the voice tile stands in the body on a desk (voice-tile.mjs `ensureVoiceTile`), where the curtain seats it
    for (const el of [...(row?.children ?? [])]) (el.id === "drpg-voice-tile" ? document.body : document.getElementById("ui-left-column-1") ?? document.body).append(el);
    row?.remove();
    columnWatch?.disconnect();
    columnWatch = null;
    document.getElementById(COLUMN_ID)?.remove();
    const left = document.getElementById("ui-left-column-1");
    if (left) left.style.marginTop = "";
    const notices = document.getElementById("drpg-popups");
    if (notices) forgetNoticeInsets(notices);
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
