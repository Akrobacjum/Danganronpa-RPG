/**
 * Danganronpa RPG - the style snapshot: what a fixed list of surfaces computes to on this page (E44 C1d, 04.11.2026).
 * ---------------------------------------------------------------------------
 *     game.drpg.styleSnapshot()                          every surface, in this browser's theme, size and scale
 *     game.drpg.styleSnapshot({ only: ["notices-window"] })   the surfaces named
 *
 * WHY (audit S17-35; the E44 plan's risk). E21-E24 move every window onto one kit and take the old rules out, and a
 * rule of the kit can lose to an old one carrying `!important` while every test still passes - the dead `.drpg-turning`
 * fix's class of error. A number for each surface that a later commit can be held to is what this records: for each
 * row of STYLE_SURFACES, `getComputedStyle` of the first element its selector matches on the page as it is, the
 * properties PROPS names; a surface not on the page is `found: false`, never invented. It writes nothing - no
 * setting, no flag, no document, no class on the page.
 *
 * WHERE ITS NUMBERS ARE REAL. At a table, with Foundry's own stylesheet and the `modules` layer as v14 attaches it,
 * it is the only real reading (a live check of the stage, not run headless). audit/style-sweep.mjs runs it in Chromium on audit/style-harness.html
 * (the captured windows under the module's sheets) and audit/glass-harness.html (the corner, the tiles, the
 * launchers) at four sizes in both themes, against audit/style-baseline.json. Headless, jsdom's partial cascade
 * answers (no `@media`, no layers, no layout), and the result says `env: "jsdom"`.
 *
 * NO IMPORTS: the two harness pages load this file as it is, outside Foundry, and api.mjs hands it on as
 * `game.drpg.styleSnapshot`.
 */

/** The properties recorded for every surface: colour, ground, edge, type, box, place and the flex or grid layout. */
export const PROPS = [
    "color", "background-color", "background-image", "border-top-color", "border-top-width", "border-top-style", "border-radius",
    "font-family", "font-size", "font-weight", "line-height",
    "padding-top", "padding-right", "padding-bottom", "padding-left", "gap",
    "width", "max-width", "max-height", "overflow-x", "overflow-y", "position", "display",
    "flex-direction", "flex-wrap", "justify-content", "align-items", "flex-grow", "flex-shrink", "flex-basis",
    "grid-template-columns", "box-shadow", "opacity"
];

/**
 * The surfaces, each with the page that shows it (`role`: "gm", "player" or "both" - a player's page shows no GM
 * launcher) and its selector; the first element it matches is read. The windows are the module's as the harness
 * captures them (probe 08, audit/windows/): a DialogV2 frame, its header, content and footer and their buttons, the
 * two tab bars, a table's head and cells, a number field; then the notice history (A7), the corner and the tile's
 * history button, the launchers, the room and voice tiles (A8), the GM's hexagon and Foundry tools.
 */
export const STYLE_SURFACES = [
    { id: "dialog-frame", role: "gm", selector: ".application.dialog" },
    { id: "dialog-header", role: "gm", selector: ".application.dialog > .window-header" },
    { id: "dialog-title", role: "gm", selector: ".application.dialog > .window-header .window-title" },
    { id: "dialog-content", role: "gm", selector: ".application.dialog .dialog-content" },
    { id: "dialog-footer", role: "gm", selector: ".application.dialog .form-footer" },
    { id: "dialog-button", role: "gm", selector: ".application.dialog .form-footer button:not(.default)" },
    { id: "dialog-button-default", role: "gm", selector: ".application.dialog .form-footer button.default" },
    { id: "gmt-tabs", role: "gm", selector: ".drpg-gmt-tabs" },
    { id: "gmt-tab", role: "gm", selector: ".drpg-gmt-tabs [data-drpg-gmt-tab]" },
    { id: "gmt-tab-active", role: "gm", selector: ".drpg-gmt-tabs [data-drpg-gmt-tab].active" },
    { id: "dashboard-tabs", role: "gm", selector: ".drpg-dashboard-tabs" },
    { id: "dashboard-tab", role: "gm", selector: ".drpg-dashboard-tabs .drpg-dashboard-tab" },
    { id: "table-head", role: "gm", selector: ".application table thead th" },
    { id: "table-cell", role: "gm", selector: ".application table tbody td" },
    { id: "number-field", role: "gm", selector: ".application input[type=\"number\"]" },
    { id: "select-field", role: "gm", selector: ".application.dialog select" },
    { id: "notices-window", role: "both", selector: ".application.drpg-window-notices" },
    { id: "notices-list", role: "both", selector: ".drpg-notices-list" },
    { id: "notices-chips", role: "both", selector: ".drpg-notices-chips" },
    { id: "notices-chip", role: "both", selector: ".drpg-notices-chips > *" },
    { id: "notices-foot", role: "both", selector: ".drpg-notices-foot" },
    { id: "notices-corner", role: "both", selector: "#drpg-notices-corner" },
    { id: "popups-tile", role: "both", selector: "#drpg-popups" },
    { id: "book-launcher", role: "both", selector: "#drpg-book-launcher" },
    { id: "messenger-launcher", role: "both", selector: "#drpg-messenger-launcher" },
    { id: "sound-launcher", role: "both", selector: "#drpg-sound-launcher" },
    { id: "gm-launcher", role: "gm", selector: "#drpg-gm-launcher" },
    { id: "room-tile", role: "both", selector: "#drpg-room-tile" },
    { id: "room-tile-prose", role: "both", selector: "#drpg-room-tile-prose" },
    { id: "voice-tile", role: "both", selector: "#drpg-voice-tile" },
    { id: "launch-mini", role: "both", selector: ".drpg-launch-mini" },
    { id: "foundry-tools", role: "gm", selector: "#drpg-foundry-tools" },
    { id: "foundry-window", role: "gm", selector: ".drpg-foundry-window" },
    { id: "foundry-window-header", role: "gm", selector: ".drpg-foundry-window-header" },
    { id: "hud", role: "both", selector: "#drpg-hud" },
    { id: "player-status", role: "both", selector: "#drpg-player-status" },
    /* The window kit (E44 C3a, ui-kit.mjs and components.css): each component once, as the style harness's kit gallery
       (`?kit=1`) draws it with the kit's own builders, until E21 moves the module's windows onto it. */
    { id: "kit-window", role: "both", selector: ".application.drpg-ui" },
    { id: "kit-content", role: "both", selector: ".application.drpg-ui > .window-content" },
    { id: "kit-body", role: "both", selector: ".application.drpg-ui .drpg-kit-body" },
    { id: "kit-tabs", role: "both", selector: ".application.drpg-ui nav.drpg-tabs" },
    { id: "kit-tab", role: "both", selector: ".drpg-tabs > button[role=\"tab\"]:not([aria-selected=\"true\"])" },
    { id: "kit-tab-active", role: "both", selector: ".drpg-tabs > button[role=\"tab\"][aria-selected=\"true\"]" },
    { id: "kit-footer", role: "both", selector: ".application.drpg-ui footer.drpg-kit-footer" },
    { id: "kit-footer-left", role: "both", selector: ".drpg-kit-footer > .drpg-kit-left" },
    { id: "kit-footer-right", role: "both", selector: ".drpg-kit-footer > .drpg-kit-right" },
    { id: "kit-primary", role: "both", selector: ".drpg-kit-footer .drpg-role-primary" },
    { id: "kit-close", role: "both", selector: ".drpg-kit-footer :is(.drpg-role-close, .drpg-role-cancel)" },
    { id: "kit-secondary", role: "both", selector: ".drpg-kit-footer .drpg-role-secondary" },
    { id: "kit-destructive", role: "both", selector: ".drpg-kit-footer .drpg-role-destructive" },
    { id: "kit-gm-route", role: "gm", selector: ".drpg-kit-footer .drpg-role-gm-route" },
    { id: "kit-form-grid", role: "both", selector: ".drpg-form-grid" },
    { id: "kit-form-label", role: "both", selector: ".drpg-form-grid > .drpg-form-label" },
    { id: "kit-table-head", role: "both", selector: "table.drpg-data-table thead th" },
    { id: "kit-table-cell", role: "both", selector: "table.drpg-data-table tbody td:not(.drpg-data-empty)" },
    { id: "kit-table-empty", role: "both", selector: "td.drpg-data-empty" },
    { id: "kit-help", role: "both", selector: ".application.drpg-ui .drpg-help" },
    { id: "kit-box-info", role: "both", selector: ".drpg-box[data-drpg-box=\"info\"]" },
    { id: "kit-box-warning", role: "both", selector: ".drpg-box[data-drpg-box=\"warning\"]" },
    { id: "kit-box-secret", role: "both", selector: ".drpg-box[data-drpg-box=\"secret\"]" },
    { id: "kit-stepper-input", role: "both", selector: ".drpg-kit-stepper > input[type=\"number\"]" },
    { id: "kit-stepper-button", role: "both", selector: ".drpg-kit-stepper > button" },
    { id: "kit-toggle", role: "both", selector: ".drpg-toggle > input[role=\"switch\"]" },
    { id: "kit-chip", role: "both", selector: ".drpg-chips > .drpg-chip[aria-pressed=\"false\"]:not(:disabled)" },
    { id: "kit-chip-pressed", role: "both", selector: ".drpg-chips > .drpg-chip[aria-pressed=\"true\"]" },
    { id: "kit-mode", role: "both", selector: ".drpg-mode-bar > button[aria-pressed=\"false\"]" },
    { id: "kit-mode-active", role: "both", selector: ".drpg-mode-bar > button[aria-pressed=\"true\"]" }
];

/** This page's theme by the body's class: "stained-glass", "monokuma-legacy" or "none". */
function themeOf(doc) {
    const list = doc.body?.classList;
    if (list?.contains("drpg-theme-stained-glass")) return "stained-glass";
    if (list?.contains("drpg-theme-monokuma-legacy")) return "monokuma-legacy";
    return "none";
}

/**
 * The snapshot: `{ env, theme, size: { width, height }, scale: { device, glass, legacy }, surfaces: { id: { found, role,
 * props } } }`. `only` limits it to the surfaces named (an id not in the list is an error, not a surface found false);
 * `doc` and `win` are this page's document and window unless handed.
 */
export function styleSnapshot({ only = null, doc = globalThis.document, win = globalThis.window } = {}) {
    const ids = STYLE_SURFACES.map(s => s.id);
    const unknown = (only ?? []).filter(id => !ids.includes(id));
    if (unknown.length) throw new Error(`styleSnapshot: no surface ${unknown.join(", ")} (surfaces: ${ids.join(", ")})`);
    const rows = only ? STYLE_SURFACES.filter(s => only.includes(s.id)) : STYLE_SURFACES;
    const rootStyle = doc.body ? win.getComputedStyle(doc.body) : null;
    const surfaces = {};
    for (const { id, role, selector } of rows) {
        const el = doc.querySelector(selector);
        if (!el) { surfaces[id] = { found: false, role }; continue; }
        const cs = win.getComputedStyle(el);
        surfaces[id] = { found: true, role, props: Object.fromEntries(PROPS.map(p => [p, cs.getPropertyValue(p)])) };
    }
    return {
        env: /jsdom/i.test(win.navigator?.userAgent ?? "") ? "jsdom" : "browser",
        theme: themeOf(doc),
        size: { width: win.innerWidth, height: win.innerHeight },
        scale: {
            device: win.devicePixelRatio ?? 1,
            glass: rootStyle?.getPropertyValue("--drpg-sg-scale").trim() || null,
            legacy: rootStyle?.getPropertyValue("--drpg-legacy-scale").trim() || null
        },
        surfaces
    };
}
