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
 * Foundry's own button inside an open window only narrows it. Escape, dragging, a remembered place and the clamp
 * to the screen are E77 C7's.
 *
 * THE LAUNCHER (E77 C6). `#drpg-foundry-tools` is the corner cluster's fifth button, over the book (the AM-21
 * variant B grid): one click opens both windows, the next closes both (`toggleFoundryTools`), and `aria-pressed`
 * says whether either is open. Like the GM's red button it is a child of the body that joins the cluster through
 * `data-drpg-cluster` and carries no `drpg-` class (pixel-icons.css paints under any such ancestor). Its face is
 * Foundry's own logo, `icons/fvtt.png` from Foundry's core files - the module ships no copy of it (D7) - lightened
 * by the stylesheet; whether that file is there and reads well on a v14 table is LIVE-E77-09.
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
 * No imports: glass.mjs and narrow.mjs import `inFoundryWindow` from here (R161 counts static imports).
 */

const FRAME_CLASS = "drpg-foundry-window";
const BODY_CLASS = "drpg-foundry-windows";
const LAUNCHER_ID = "drpg-foundry-tools";
/** The two frames and the node of Foundry's each one holds. */
export const FOUNDRY_WINDOWS = [
    { key: "ftools", id: "drpg-win-ftools", node: "sidebar", title: "DRPG.FoundryTools.title" },
    { key: "maptools", id: "drpg-win-maptools", node: "scene-controls", title: "DRPG.FoundryTools.mapTitle" }
];
/** Foundry's `ui.sidebar.toggleExpanded` as it was before the wrapper, so closing the window collapses through Foundry's own. */
const ORIGINAL = { toggleExpanded: null };
let guard = null, themeWatch = null;

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
    document.body.classList.add(BODY_CLASS);
    for (const row of FOUNDRY_WINDOWS) buildFrame(row);
    buildLauncher();
    adoptFoundryNodes();
    wearInterfaceTheme();
    wrapSidebar();
    collapseSidebar();
    for (const hook of ["renderSidebar", "renderSceneControls"]) Hooks.on(hook, adoptFoundryNodes);
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
    const logo = document.createElement("img");
    logo.setAttribute("src", "icons/fvtt.png");
    logo.setAttribute("alt", "");
    logo.draggable = false;
    btn.append(logo);
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
            if ((expanded ?? !this.expanded) === true) showFrame("ftools", true);
            return toggle.call(this, expanded, ...rest);
        };
    }
    if (typeof change === "function") {
        bar.changeTab = function (...args) {
            showFrame("ftools", true);
            return change.apply(this, args);
        };
    }
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
    const anyOpen = FOUNDRY_WINDOWS.some(f => foundryWindow(f.key)?.hidden === false);
    document.getElementById(LAUNCHER_ID)?.setAttribute("aria-pressed", String(anyOpen));
}

/** Open or close one window. Foundry tools collapses the sidebar BEFORE it hides, and expands it once shown. */
export function setFoundryWindow(key, open) {
    if (!foundryWindow(key)) return false;
    if (key === "ftools" && !open) collapseSidebar();
    showFrame(key, open);
    const bar = globalThis.ui?.sidebar;
    if (key === "ftools" && open && bar && !bar.expanded && ORIGINAL.toggleExpanded) ORIGINAL.toggleExpanded.call(bar, true);
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
