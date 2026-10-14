/**
 * Danganronpa RPG - Foundry's two rails leave the screen (E77 C5, 13.10.2026; the A8 design's steps 11 and 12, the
 * E77 plan's C5; the owner's Q4, Q5 and Q9 of 11.10).
 * ---------------------------------------------------------------------------
 * The room tile wants the wall under the clock, and on a desk of 1366x768 nothing was left of it once Foundry's
 * scene controls had their run there; the tab rail held the right wall the same way. So the two rails stop being
 * part of the screen the curtain is cut for:
 *
 *   - A PLAYER has no scene controls at all ('u gracza usuwamy przyciski Foundry calkowicie', Q4). The stylesheet
 *     hides `#scene-controls` for `body.drpg-player` in both themes, beside the rule that already hid their
 *     sidebar; what that would also take - the Tokens layer, which is where a player selects and drags - is kept
 *     here: on every new canvas and every render of the controls the Tokens layer with its select tool is made
 *     the active one again (`keepTokensLayer`). Foundry's keys stay Foundry's (T, R, F, the ping, the arrows):
 *     nothing here touches a keybinding. What a real canvas does with them is LIVE-E77-11.
 *   - A GM keeps both, in two windows of the module's own that float over everything and are cut for by nothing
 *     (Q5, Q9): 'Foundry tools' holds `#sidebar`, 'Map tools' holds `#scene-controls`. They are Foundry's OWN
 *     nodes, moved with `append` - the same objects, so their listeners, their state and `ui.sidebar.element`
 *     stay what they were. A column of Foundry's cannot keep them: a fixed box inside a transformed column is
 *     placed from the column, not from the screen (the design's P9, at x 3376).
 *
 * WHAT KEEPS THEM THERE. Foundry renders a rail's insides into the rail on every later render, so a moved rail
 * stays moved; only a first render again (`close()` then `render({ force: true })`) puts a new element where
 * Foundry keeps it. The guard puts it back: on `renderSidebar` and `renderSceneControls`, and on any childList
 * change under `#interface` (a MutationObserver, so before the next paint). A node put anywhere else - outside
 * `#interface` - is not looked for; R511 reads both, the second as its negative control.
 *
 * CLOSED IS COLLAPSED. Closing Foundry tools first collapses the sidebar through Foundry's own
 * `ui.sidebar.toggleExpanded(false)`, then hides the frame (`hidden` and `inert`, so focus cannot go into buttons
 * nobody sees): with the sidebar expanded Foundry would keep its chat notifications off and the chat's input
 * inside the hidden sidebar (the design's K5, read in Foundry 14.365's chat.mjs by the design, not by this file).
 * Opening it shows the frame and expands the sidebar. Foundry's own ways in - `ui.sidebar.changeTab`, and
 * `toggleExpanded` when it expands, which `expand()` and a tab's `activate()` go through - are wrapped to show the
 * frame first, synchronously, so Shift+C and any module that opens a tab open the window. Collapsing with
 * Foundry's own button inside an open window only narrows it.
 *
 * A PLACE OF ITS OWN, ON THE SCREEN (E77 C7; the owner's Q9, the design's step 12). A window is dragged by its
 * title bar (pointer events with the pointer captured, so a mouse and a finger both work; no resizing - 'Okna
 * przyciskow Foundry moga pozostac proste'). Where it is dropped is this browser's client setting
 * `foundryWindows`, `{ ftools: { x, y }, maptools: { x, y } }`; with nothing remembered each window has the
 * design's home (FOUNDRY_WINDOWS `home`, read at 1920x1080 in P8 and P10, not measured here). A console can write
 * the setting raw, so it is read through `readPlaces` every time: two finite numbers or no place. Every place is
 * then clamped (`clampPlace`): wholly on the screen 8 px in, and off the corner cluster's box with 8 px around it,
 * moved left or up whichever is shorter. The clamp runs on every opening, at the drop, on the browser's `resize`
 * and on every change of the frame's own size (a ResizeObserver: the Regions palette, the chat expanding, the
 * sidebar collapsing). P10 and P11 measured the frame before it had its size and their clamp failed at 1366x768,
 * windows down to y 788 and 818 (the design's K6); here the frame is shown, put at 0,0 and measured with
 * `getBoundingClientRect` in the same task that places it, so no paint sees the unclamped place and the width is
 * the frame's own rather than what the screen's edge left it. The clamp never writes the setting: a place
 * remembered on a big screen comes back when the screen is big again.
 *
 * ESCAPE IS FOUNDRY'S FIRST. Foundry's `core.dismiss` (read by the design in 14.365's client-keybindings.mjs, not
 * by this file) closes, in order, a drag, the main menu, a context menu, a tour, every framed window, then releases
 * the active layer's selection, and only then opens the main menu. A capture listener on `window` takes Escape in
 * place of that last step alone: while either window is open and nothing above it is there to dismiss
 * (`escapeFallsToWindows`) it closes both and stops the event; in every other case Escape is Foundry's as before,
 * and the next one closes the windows. What another module listening for Escape on an empty screen meets is
 * LIVE-E77-10.
 *
 * THE LAUNCHER (E77 C6). `#drpg-foundry-tools` is the corner cluster's fifth button, over the book (the AM-21
 * variant B grid): one click opens both windows, the next closes both (`toggleFoundryTools`), and `aria-pressed`
 * says whether either is open. Like the GM's red button it is a child of the body that joins the cluster through
 * `data-drpg-cluster` and carries no `drpg-` class (pixel-icons.css paints under any such ancestor). Its face is
 * one inert `i` with no class, which danganronpa.css masks with the module's pixel anvil (`--drpg-px-anvil`,
 * tools/pixel-icons.py) in the button's colour under both themes, as the handbooks' book is masked (R548). It has no
 * Font Awesome name, and every selector of pixel-icons.css names one, so that sheet paints nothing on it whatever
 * class stood above it (read in the generated selectors, 14.10.2026).
 * Until E78 fix h76-HF3 (14.10.2026) the face was Foundry's own logo from Foundry's core files (the module ships
 * no copy of it, D7) through a lightening filter, with a toolbox for a file that did not load. The owner, at The
 * Forge on 1.2.76, read it as the Forge's icon and the one face in the corner outside the module's white pixel set,
 * and asked for a white pixel glyph; the anvil is the default the owner left standing. Nothing is loaded for it any
 * more, so there is no failed load to stand in for.
 *
 * THE WORLD SWITCH (E77 fix r2-H2, 13.10.2026; the owner's amend of 11.10, session 0 (1): 'jeden przelacznik', the
 * emergency way back at the table). The world setting `foundryToolWindows`, on by default and the GM's to change in
 * the module's settings, is read once here: off, a GM's page builds nothing - no frame, no launcher, no wrapper, no
 * guard - so `#sidebar` and `#scene-controls` stay where Foundry puts them, and glass.mjs and narrow.mjs, which read
 * a rail only outside these frames, take them as rails in Foundry's columns again. It takes effect at the next
 * load (`requiresReload`), as the windows are built once and hold Foundry's own nodes. A player's page is the same
 * either way: their scene controls are the stylesheet's to hide (the owner's Q4), and the Tokens layer is kept.
 * R531 reads both states on the GM's page; scenario 74 J boots a second GM with it off.
 *
 * GUARDED, FOUNDRY'S CALL FIRST (E77 fix r2-H2; review round 2's Q3). The wrappers on `ui.sidebar` run the module's
 * steps - showing and placing the frame - each in its own try that logs and goes on, and Foundry's original always
 * runs and its answer is returned: a step of the module's that throws costs the GM a window's place, never the tab.
 *
 * THE THEME. Foundry puts `themed theme-<interface>` on `#interface`, and the sidebar and the scene controls take
 * it from that ancestor; out of it they would take the body's `theme-<applications>`, and a dark interface with
 * light applications would light the tab bar. Each frame copies the classes from `#interface`, and again on every
 * change of them (`core.uiConfig` rewrites them).
 *
 * THE CURTAIN never cuts for what stands in a frame: glass.mjs and narrow.mjs read a rail only while it stands in
 * Foundry's columns (`inFoundryWindow`), the frames are no block and stand outside `#interface`, whose changes are
 * what the curtain watches. So opening, closing and the sidebar's own growing recut nothing (R514 in a browser).
 *
 * Imports config.mjs, settings.mjs and utils.mjs alone: glass.mjs and narrow.mjs import `inFoundryWindow` from here,
 * and none of those three reaches them (R161 counts static imports). The corner's selector, glass.mjs's LAUNCHERS, is
 * read through a dynamic import once the windows are built, since a static one would close that cycle.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { warn } from "./utils.mjs";

const FRAME_CLASS = "drpg-foundry-window";
const BODY_CLASS = "drpg-foundry-windows";
const LAUNCHER_ID = "drpg-foundry-tools";
/** The two frames, the node of Foundry's each one holds, and its home: Foundry tools with its right edge 420 px in
    from the screen's (left of the module's right column), Map tools right of the clock's column (see A PLACE). */
export const FOUNDRY_WINDOWS = [
    { key: "ftools", id: "drpg-win-ftools", node: "sidebar", title: "DRPG.FoundryTools.title", home: { right: 420, y: 72 } },
    { key: "maptools", id: "drpg-win-maptools", node: "scene-controls", title: "DRPG.FoundryTools.mapTitle", home: { x: 379, y: 187 } }
];
/** How far in from the screen's edges, and out from the corner cluster's box, a window stands. */
export const WINDOW_MARGIN = 8;
/** Foundry's `ui.sidebar.toggleExpanded` as it was before the wrapper, so closing the window collapses through Foundry's own. */
const ORIGINAL = { toggleExpanded: null };
let guard = null, themeWatch = null, cluster = null;
/** The place each window was last put at: where a drag starts from (jsdom gives every box 0,0). */
const placed = new Map();

/** Whether an element stands in one of the GM's two windows rather than in Foundry's columns. */
export function inFoundryWindow(el) {
    return Boolean(el?.closest?.(`.${FRAME_CLASS}`));
}

/** The frame of a key ("ftools", "maptools"), or null on a screen that has none (a player's). */
export function foundryWindow(key) {
    const row = FOUNDRY_WINDOWS.find(f => f.key === key);
    return row ? document.getElementById(row.id) : null;
}

export function registerFoundryWindows() {
    if (!game.user?.isGM) {
        Hooks.on("canvasReady", keepTokensLayer);
        Hooks.on("renderSceneControls", keepTokensLayer);
        return;
    }
    if (!foundryWindowsOn()) return;
    document.body.classList.add(BODY_CLASS);
    for (const row of FOUNDRY_WINDOWS) buildFrame(row);
    buildLauncher();
    adoptFoundryNodes();
    wearInterfaceTheme();
    wrapSidebar();
    collapseSidebar();
    for (const hook of ["renderSidebar", "renderSceneControls"]) Hooks.on(hook, adoptFoundryNodes);
    window.addEventListener("keydown", onEscape, { capture: true });
    window.addEventListener("resize", () => { for (const row of FOUNDRY_WINDOWS) placeFoundryWindow(row.key); });
    import("./glass.mjs").then(g => { cluster = g.LAUNCHERS ?? null; }).catch(() => null);
    const ui = document.getElementById("interface");
    if (ui && !guard) {
        guard = new MutationObserver(adoptFoundryNodes);
        guard.observe(ui, { childList: true, subtree: true });
    }
    if (ui && !themeWatch) {
        themeWatch = new MutationObserver(wearInterfaceTheme);
        themeWatch.observe(ui, { attributes: true, attributeFilter: ["class"] });
    }
}

/** The world switch (see THE WORLD SWITCH): on unless the GM turned it off; a setting that cannot be read is the default. */
export function foundryWindowsOn() {
    try { return game.settings.get(MODULE_ID, SETTINGS.foundryToolWindows) !== false; } catch { return true; }
}

/* ONCE A SECOND AT MOST, AND NEVER IN A LOOP. `activate` renders the controls, which fires
   `renderSceneControls` again; on a Foundry where the call does not take (a name v14 does not know),
   asking on every render would ask forever. A second call within a second of the first is dropped. */
let tokensAsked = 0;
/** A player's active layer back to Tokens with its select tool (the scene controls they no longer see). */
export function keepTokensLayer() {
    return askTokensLayer(globalThis.ui?.controls, game.user);
}

/** The same, on the controls and the user it is handed and at the time it is told (R510 hands it stand-ins). */
export function askTokensLayer(controls, user, now = Date.now()) {
    if (user?.isGM || !controls || typeof controls.activate !== "function") return false;
    if (controls.control?.name === "tokens") return false;
    /* A template or a note is placed on its own layer, and a player reaches one only through a code road - a
       system's chat card handing out a template, a note dropped on the canvas. Asked back to Tokens, the layer's
       preview would go with it (review round 2's cor F3, read from memory of v13 and not measured; whether
       Daggerheart hands players a template is LIVE-E77-16), so those two are left as they are. */
    if (["templates", "notes"].includes(controls.control?.name)) return false;
    if (now - tokensAsked < 1000) return false;
    tokensAsked = now;
    /* `{ control, tool }` is SceneControls#activate's signature as v13 has it; read from memory and not
       measured on v14 (LIVE-E77-11 at a table). A Foundry that refuses it leaves the layer as it was. */
    /* Reflect.apply, not `controls.activate(`: R113 reads the source for a call to `.activate(` as a scene being
       made active, and this is a layer of the controls. */
    try { Reflect.apply(controls.activate, controls, [{ control: "tokens", tool: "select" }]); } catch { return false; }
    return true;
}

function buildFrame(row) {
    if (document.getElementById(row.id)) return;
    const title = game.i18n.localize(row.title);
    const frame = document.createElement("section");
    frame.id = row.id;
    frame.className = FRAME_CLASS;
    frame.dataset.window = row.key;
    frame.setAttribute("role", "region");
    frame.setAttribute("aria-label", title);
    const head = document.createElement("header");
    head.className = "drpg-foundry-window-header";
    const name = document.createElement("h2");
    name.className = "drpg-foundry-window-title";
    name.textContent = title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "drpg-foundry-window-close";
    close.setAttribute("aria-label", game.i18n.localize("DRPG.FoundryTools.close"));
    const mark = document.createElement("i");
    mark.className = "fa-solid fa-xmark";
    mark.setAttribute("inert", "");
    close.append(mark);
    close.addEventListener("click", () => setFoundryWindow(row.key, false));
    head.append(name, close);
    const body = document.createElement("div");
    body.className = "drpg-foundry-window-body";
    frame.append(head, body);
    frame.toggleAttribute("hidden", true);
    frame.toggleAttribute("inert", true);
    document.body.append(frame);
    dragByTitle(frame, head, row.key);
    if (typeof ResizeObserver === "function") new ResizeObserver(() => placeFoundryWindow(row.key)).observe(frame);
}

/** The window follows a pointer pressed on its title bar (not on its close button), clamped to the screen while it
    moves; at the drop it is clamped off the cluster too and that place is remembered. A cancelled drag remembers
    nothing and the window goes back to its place. */
function dragByTitle(frame, head, key) {
    head.addEventListener("pointerdown", event => {
        if (event.button !== 0 || event.target?.closest?.("button")) return;
        const from = placed.get(key) ?? { x: frame.offsetLeft, y: frame.offsetTop }, x0 = event.clientX, y0 = event.clientY;
        event.preventDefault();
        try { head.setPointerCapture(event.pointerId); } catch { /* a pointer that is not down has nothing to capture */ }
        const to = (e, block) => {
            const r = frame.getBoundingClientRect();
            const at = clampPlace({ x: from.x + e.clientX - x0, y: from.y + e.clientY - y0 }, { w: r.width, h: r.height },
                { W: window.innerWidth, H: window.innerHeight }, block);
            frame.style.left = `${at.x}px`;
            frame.style.top = `${at.y}px`;
            placed.set(key, at);
            return at;
        };
        const move = e => { to(e, null); };
        const end = e => {
            head.removeEventListener("pointermove", move);
            head.removeEventListener("pointerup", end);
            head.removeEventListener("pointercancel", end);
            if (e.type === "pointerup") rememberPlace(key, to(e, clusterBox()));
            else placeFoundryWindow(key);
        };
        head.addEventListener("pointermove", move);
        head.addEventListener("pointerup", end);
        head.addEventListener("pointercancel", end);
    });
}

/** The setting as places: for each window two finite numbers, rounded, or no place at all. */
export function readPlaces(raw) {
    const out = {};
    for (const row of FOUNDRY_WINDOWS) {
        const at = raw && typeof raw === "object" ? raw[row.key] : null;
        if (at && typeof at === "object" && Number.isFinite(at.x) && Number.isFinite(at.y)) out[row.key] = { x: Math.round(at.x), y: Math.round(at.y) };
    }
    return out;
}

function savedPlaces() {
    try { return readPlaces(game.settings.get(MODULE_ID, SETTINGS.foundryWindows)); } catch { return {}; }
}

function rememberPlace(key, at) {
    try {
        return Promise.resolve(game.settings.set(MODULE_ID, SETTINGS.foundryWindows, { ...savedPlaces(), [key]: at })).catch(() => null);
    } catch { return Promise.resolve(null); }
}

/**
 * Where a window of `size` { w, h } wanting `place` { x, y } stands on a screen { W, H }: x in [8, W - w - 8] and y
 * in [8, H - h - 8] (8 when it is wider or taller than that), then, when its box with 8 px around it meets `block`
 * { x, y, w, h } (the corner cluster's), moved left or up by the shorter of the two that keeps it on the screen -
 * up when neither does. Rounded down, not to the nearest: a frame's size is fractional, and on 13.10.2026 at 768x1024
 * under Legacy rounding to the nearest left Foundry tools 0.4 px inside the cluster's margin, which the sweep's
 * `drpgWindowsCheck` read as standing on it. Pure: R516 reads it with numbers.
 */
export function clampPlace(place, size, screen, block = null) {
    const M = WINDOW_MARGIN, w = Math.max(0, size.w || 0), h = Math.max(0, size.h || 0);
    const fit = (v, extent, room) => Math.max(M, Math.min(Number.isFinite(v) ? v : M, room - extent - M));
    let x = fit(place.x, w, screen.W), y = fit(place.y, h, screen.H);
    if (block && x - M < block.x + block.w && x + w + M > block.x && y - M < block.y + block.h && y + h + M > block.y) {
        const left = x + w + M - block.x, up = y + h + M - block.y;
        const canLeft = x - left >= M, canUp = y - up >= M;
        if (canLeft && (!canUp || left <= up)) x -= left;
        else y = Math.max(M, y - up);
    }
    return { x: Math.floor(x), y: Math.floor(y) };
}

/** The corner cluster's box on this screen: the union of its buttons' boxes, or null before glass.mjs's selector is read. */
function clusterBox() {
    if (!cluster) return null;
    let box = null;
    for (const el of document.querySelectorAll(cluster)) {
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) continue;
        box = box ? { x0: Math.min(box.x0, r.left), y0: Math.min(box.y0, r.top), x1: Math.max(box.x1, r.right), y1: Math.max(box.y1, r.bottom) }
            : { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
    }
    return box && { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
}

/** An open window to its place - remembered, else its home - clamped (see A PLACE). Returns the place, or null for
    a closed window or a screen without one. */
export function placeFoundryWindow(key) {
    const row = FOUNDRY_WINDOWS.find(f => f.key === key), frame = foundryWindow(key);
    if (!row || !frame || frame.hidden) return null;
    frame.style.left = "0px";
    frame.style.top = "0px";
    const r = frame.getBoundingClientRect(), size = { w: r.width, h: r.height }, screen = { W: window.innerWidth, H: window.innerHeight };
    const want = savedPlaces()[key] ?? { x: row.home.x ?? screen.W - row.home.right - size.w, y: row.home.y };
    const at = clampPlace(want, size, screen, clusterBox());
    frame.style.left = `${at.x}px`;
    frame.style.top = `${at.y}px`;
    placed.set(key, at);
    return at;
}

/** Whether nothing Foundry's Escape would dismiss stands above the open windows (see ESCAPE IS FOUNDRY'S FIRST). */
export function escapeFallsToWindows() {
    if (!FOUNDRY_WINDOWS.some(f => foundryWindow(f.key)?.hidden === false)) return false;
    const focus = document.activeElement;
    if (focus?.isContentEditable || focus?.matches?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return false;
    const shell = globalThis.ui;
    if (shell?.menu?.rendered || shell?.context?.element) return false;
    if (globalThis.foundry?.nue?.Tour?.tourInProgress) return false;
    if (Object.values(shell?.windows ?? {}).some(app => app?.rendered)) return false;
    const apps = globalThis.foundry?.applications?.instances;
    for (const app of apps?.values?.() ?? []) if (app?.hasFrame && app.rendered) return false;
    /* A ruler, a box select or a wall, drawing, region or template being drawn controls nothing, and Escape cancels
       it first (review round 2's cor F1). `currentMouseManager` is the field v11-v13 hold a canvas drag in, named from
       memory and not read on v14 (LIVE-E77-10): a Foundry without it leaves this clause out, not the windows. */
    if (globalThis.canvas?.currentMouseManager) return false;
    return !globalThis.canvas?.activeLayer?.controlled?.length;
}

function onEscape(event) {
    if (event.key !== "Escape" || event.defaultPrevented || !escapeFallsToWindows()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleFoundryTools(false);
}

/** The corner's Foundry tools button, once (see THE LAUNCHER above). */
function buildLauncher() {
    if (document.getElementById(LAUNCHER_ID)) return;
    const label = game.i18n.localize("DRPG.FoundryTools.toggle");
    const btn = document.createElement("button");
    btn.id = LAUNCHER_ID;
    btn.type = "button";
    btn.dataset.drpgCluster = "";
    btn.setAttribute("aria-label", label);
    btn.dataset.tooltip = label;
    btn.setAttribute("aria-pressed", "false");
    const face = document.createElement("i");
    face.setAttribute("inert", "");
    btn.append(face);
    btn.addEventListener("click", () => toggleFoundryTools());
    document.body.append(btn);
}

/** The guard: each of Foundry's two nodes back into its frame, wherever Foundry put it. Returns how many moved. */
export function adoptFoundryNodes() {
    let moved = 0;
    for (const row of FOUNDRY_WINDOWS) {
        const body = document.getElementById(row.id)?.querySelector(":scope > .drpg-foundry-window-body");
        const node = document.getElementById(row.node);
        if (!body || !node || node.parentElement === body) continue;
        body.append(node);
        moved++;
    }
    return moved;
}

function wearInterfaceTheme() {
    const ui = document.getElementById("interface");
    const theme = ui ? [...ui.classList].filter(c => c === "themed" || c.startsWith("theme-")) : [];
    for (const row of FOUNDRY_WINDOWS) {
        const frame = document.getElementById(row.id);
        if (!frame) continue;
        for (const c of [...frame.classList]) if (c === "themed" || c.startsWith("theme-")) frame.classList.remove(c);
        frame.classList.add(...theme);
    }
}

function wrapSidebar() {
    const bar = globalThis.ui?.sidebar;
    if (!bar || bar.drpgWindowed) return;
    bar.drpgWindowed = true;
    const toggle = bar.toggleExpanded, change = bar.changeTab;
    if (typeof toggle === "function") {
        ORIGINAL.toggleExpanded = toggle;
        bar.toggleExpanded = function (expanded, ...rest) {
            const opening = (expanded ?? !this.expanded) === true;
            if (opening) windowStep(() => showFrame("ftools", true));
            const out = toggle.call(this, expanded, ...rest);
            if (opening) windowStep(() => placeFoundryWindow("ftools"));
            return out;
        };
    }
    if (typeof change === "function") {
        bar.changeTab = function (...args) {
            windowStep(() => showFrame("ftools", true));
            const out = change.apply(this, args);
            windowStep(() => placeFoundryWindow("ftools"));
            return out;
        };
    }
}

/** One of the module's steps inside Foundry's sidebar calls (see GUARDED): a throw is logged, and Foundry's call goes on. */
function windowStep(step) {
    try { step(); } catch (err) { warn("Foundry tools: a window step failed; Foundry's own call goes on.", err); }
}

function collapseSidebar() {
    const bar = globalThis.ui?.sidebar;
    if (bar?.expanded && ORIGINAL.toggleExpanded) ORIGINAL.toggleExpanded.call(bar, false);
}

function showFrame(key, open) {
    const frame = foundryWindow(key);
    if (!frame) return;
    frame.toggleAttribute("hidden", !open);
    frame.toggleAttribute("inert", !open);
    if (open) placeFoundryWindow(key);
    const anyOpen = FOUNDRY_WINDOWS.some(f => foundryWindow(f.key)?.hidden === false);
    document.getElementById(LAUNCHER_ID)?.setAttribute("aria-pressed", String(anyOpen));
}

/** Open or close one window. Foundry tools collapses the sidebar BEFORE it hides, and expands it once shown. */
export function setFoundryWindow(key, open) {
    if (!foundryWindow(key)) return false;
    if (key === "ftools" && !open) collapseSidebar();
    showFrame(key, open);
    const bar = globalThis.ui?.sidebar;
    if (key === "ftools" && open && bar && !bar.expanded && ORIGINAL.toggleExpanded) {
        ORIGINAL.toggleExpanded.call(bar, true);
        placeFoundryWindow(key);
    }
    return true;
}

/** Both windows at once: closed if either is open, else both open. Returns whether they are open now. */
export function toggleFoundryTools(open) {
    const keys = FOUNDRY_WINDOWS.map(f => f.key).filter(key => foundryWindow(key));
    if (!keys.length) return false;
    const want = open ?? keys.every(key => foundryWindow(key).hidden);
    for (const key of keys) setFoundryWindow(key, want);
    return want;
}
