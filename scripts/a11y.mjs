/**
 * Danganronpa RPG - the interface as something other than a picture.
 * ---------------------------------------------------------------------------
 * The module draws its own chrome: a clock, a Despair rail, a status strip, a
 * Projects tray, an Event card, a stack of notices, and a dozen windows. Every
 * control in it is a real `<button>` - that part was got right from the start,
 * and it is the expensive half - but a good few of them carry an icon and a
 * Foundry tooltip and nothing a screen reader can say out loud. Measured on
 * 14.09: of the module's own controls, the ones whose whole content is a glyph
 * had no accessible name at all.
 *
 * ONE SWEEP RATHER THAN A HUNDRED CALL SITES, for the same reason the theme
 * redefines Foundry's font variables instead of chasing selectors: a name added
 * at the place a button is built is a name the NEXT button will not have. The
 * sweep reads what the control already carries - its tooltip, its title, the
 * label on the icon inside it - and writes that into `aria-label` only where
 * there is nothing. It cannot change how anything looks or behaves: it adds an
 * attribute where one is missing and leaves everything else alone.
 *
 * WHAT IT WILL NOT DO IS INVENT A NAME. A control it cannot name is left as it
 * is and written down instead, where `game.drpg.a11y()` will list it. A made-up
 * name read out with confidence is worse than silence: silence is a gap somebody
 * works around, and a wrong name is a wrong instruction.
 *
 * The notices are the other half. They arrive on their own - a ruling comes
 * back, a Call is refused, an item breaks - and a card that appears in silence
 * is a card a blind player never learns about. The stack is a polite live
 * region, so the words are read when they land and never interrupt.
 */

import { debug } from "./utils.mjs";

/** The module's own surfaces. Foundry's and the system's chrome is theirs to name. */
const SURFACES = [
    "#drpg-hud", "#drpg-despair", "#drpg-player-status", "#countdowns",
    "#drpg-events", "#drpg-popups", "#drpg-evidence", "#drpg-gm-launcher", "#drpg-messenger-launcher",
    "#drpg-sound-launcher", ".drpg-panel", ".drpg-messenger",
    /*
     * `.drpg-advance` IS A MODULE WINDOW AND THIS LIST WAS THE ONLY PLACE THAT
     * DID NOT KNOW IT (audit 15.09). The Level Up window is the one dialog of
     * the module's hundred-odd that does not also carry `.drpg-panel` - see
     * `classes` in level-up.mjs - so the sweep walked past it and
     * `focusIntoWindow` never moved focus into it either. utils.mjs's window
     * group and two width rules in danganronpa.css have listed it beside
     * `.drpg-panel` all along; this is the file that fell out of step.
     */
    ".drpg-advance"
];
/*
 * `img[data-drpg-portrait]` IS HERE BECAUSE IT IS A CONTROL, WHATEVER ITS TAG.
 *
 * The portrait pickers are clickable images - `wirePortraitPickers` in
 * utils.mjs gives them `role="button"`, a tabindex and a name, so the
 * `[role="button"]` clause already catches them once that has run. It is named
 * explicitly anyway, because the ORDER of those two things is not guaranteed:
 * a sweep that runs on a dialog before its `render` callback has wired the
 * pickers would otherwise report a window clean that has a nameless control in
 * it, which is the exact way this defect stayed invisible for a release.
 */
/* NOT A HIDDEN INPUT (21.09). `<input type="hidden">` carries a form value and is
   never exposed to assistive technology, so it has no name to give and nothing to
   read one out to - measured, the Projects window's hidden `img.<id>` field was
   reported as a control a screen reader cannot name. */
export const CONTROLS = "button, a[href], [role=\"button\"], input:not([type=\"hidden\"]), select, textarea, "
    + "img[data-drpg-portrait]";

/** Controls the sweep could not name, for the report. Keyed so one entry is one kind. */
const unnamed = new Map();

/** What a screen reader would already say for this control, or "" if nothing. */
function accessibleName(el) {
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return aria.trim();
    if (el.getAttribute("aria-labelledby")) return "labelledby";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
    if (el.labels?.length) return "label";
    return "";
}

/** What the control already carries that could serve as its name. */
function nameFrom(el) {
    const own = el.dataset?.tooltip ?? el.getAttribute("title") ?? "";
    if (own.trim()) return own.trim();
    /* An icon inside a button often carries the only words there are - the module
       marks a decorative glyph `aria-hidden`, so anything with a label of its own
       is there to be read. */
    const inner = el.querySelector("[aria-label]:not([aria-hidden=\"true\"])");
    const innerName = inner?.getAttribute("aria-label")?.trim();
    if (innerName) return innerName;
    return "";
}

/** A short, stable key for the report: one entry per kind of control, not per instance. */
function kindOf(el) {
    const cls = String(el.className ?? "").split(" ").filter(Boolean)[0] ?? "";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : cls ? "." + cls : ""}`;
}

/**
 * Give every nameless control in the module's chrome the name it already carries.
 *
 * Safe to call as often as anything renders: a control that has a name is skipped,
 * and one that is given a name is marked so it is never looked at twice.
 */
export function nameControls(root = document) {
    try {
        const hosts = [];
        for (const sel of SURFACES) {
            for (const host of root.querySelectorAll?.(sel) ?? []) hosts.push(host);
        }
        if (root.matches?.(SURFACES.join(","))) hosts.push(root);
        for (const host of hosts) {
            for (const el of host.querySelectorAll(CONTROLS)) {
                if (el.dataset.drpgNamed) continue;
                if (accessibleName(el)) { el.dataset.drpgNamed = "own"; continue; }
                const name = nameFrom(el);
                if (name) {
                    el.setAttribute("aria-label", name);
                    el.dataset.drpgNamed = "swept";
                } else {
                    /*
                     * MARKED AS WELL, OR THIS ONE IS PAID FOR FOREVER.
                     *
                     * The two branches above mark what they settle; this one
                     * recorded the kind for the report and left the element
                     * bare, so every later sweep looked at it again - and
                     * looking is not free: `accessibleName` reads `textContent`,
                     * which builds the element's whole subtree as a string, and
                     * `nameFrom` then runs another `querySelector` inside it.
                     * The sweep runs on every window render and on every
                     * child-list change in the module's columns, so a control
                     * the sweep cannot name was the most expensive kind of
                     * control on the page, in proportion to how long the
                     * session had been running.
                     *
                     * What is given up: a control that gains a name AFTER this
                     * without being redrawn will not be looked at again. A
                     * redraw replaces the element and the new one is unmarked,
                     * which covers every route in this module - nothing here
                     * fills in a label in place on a node it is keeping.
                     *
                     * `a11yReport` is unaffected: it reads the map below, and
                     * the map is written on the first sight of each kind, which
                     * is exactly what this branch still does.
                     */
                    if (!unnamed.has(kindOf(el))) {
                        unnamed.set(kindOf(el), { where: host.id || kindOf(host), html: el.outerHTML.slice(0, 120) });
                    }
                    el.dataset.drpgNamed = "none";
                }
            }
        }
        liveRegions(root);
    } catch (err) {
        debug("The accessibility sweep could not finish", err);
    }
}

/**
 * The two places words arrive without anybody asking for them.
 *
 * The notice stack and the Event card both appear on their own, and both are
 * POLITE: they wait for the reader to finish what it is saying. `assertive`
 * would be right for a safeword and wrong for everything else, and everything
 * else is what comes through here.
 */
function liveRegions(root) {
    /* `#drpg-evidence` sets its own role when popup.mjs creates it, because it is
       built and torn down between sweeps - but it is named here too, so a stage
       that outlives the sweep that made it is still found by the one function
       that owns this question. Both are idempotent (`drpgLive`). */
    for (const [sel, role] of [["#drpg-popups", "status"], ["#drpg-events", "status"],
                               ["#drpg-evidence", "status"]]) {
        const el = root.querySelector?.(sel) ?? (root.matches?.(sel) ? root : null);
        if (!el || el.dataset.drpgLive) continue;
        if (!el.getAttribute("role")) el.setAttribute("role", role);
        if (!el.getAttribute("aria-live")) el.setAttribute("aria-live", "polite");
        el.dataset.drpgLive = "1";
    }
}

/**
 * Focus lands in the window that just opened, and nowhere else.
 *
 * A module window is opened by a keystroke or a click and then read from the
 * top; without this the focus stays where it was, so the first Tab goes back to
 * whatever was behind the window rather than into it. Only where nothing inside
 * already has focus - a window that has restored its own focus, or one the
 * person is already typing in, is left alone - and never onto a text field the
 * act of focusing would start to overwrite.
 */
export function focusIntoWindow(el) {
    try {
        if (!el?.querySelector) return;
        if (el.contains(document.activeElement)) return;
        const first = [...el.querySelectorAll(CONTROLS)].find(c =>
            !c.disabled && c.offsetParent !== null && c.getAttribute("aria-hidden") !== "true"
            /* NOT ONTO A PORTRAIT. It joined `CONTROLS` so the sweep would name
               it, which is a different question from where a window should open
               its focus: the picture is the first cell of several forms, and
               landing there means the first thing a keyboard user is offered is
               "change the image" rather than the field the window is about.
               Same spirit as the rule above about text fields. */
            && !c.matches("img[data-drpg-portrait]"));
        if (first) first.focus({ preventScroll: true });
    } catch (err) {
        debug("Could not move focus into a window", err);
    }
}

/** Every control the sweep met and could not name, for the GM's diagnostics. */
export function a11yReport() {
    const rows = [...unnamed.entries()].map(([kind, info]) => `  ${kind} in ${info.where}\n    ${info.html}`);
    return rows.length
        ? `${rows.length} control kinds carry no name a screen reader can read:\n${rows.join("\n")}`
        : "every control in the module's own chrome has a name";
}

/** Called once at ready. */
export function registerA11y() {
    nameControls();
    /* Every render of anything, because the module redraws its blocks constantly
       and a fresh button arrives nameless. The sweep skips a control it has
       already marked, so a redraw of an unchanged block costs one attribute read
       per control. */
    Hooks.on("renderApplicationV2", (app, _element, _context, options) => {
        const el = app?.element instanceof HTMLElement ? app.element : app?.element?.[0];
        if (!el) return;
        nameControls(el);
        /*
         * THE FOCUS MOVES WHEN THE WINDOW OPENS, NOT EVERY TIME IT REDRAWS.
         *
         * `focusIntoWindow` leaves alone a window somebody is already working in,
         * and that guard is `el.contains(document.activeElement)` - which cannot
         * hold on a re-render. ApplicationV2 replaces `.window-content`, so the
         * field being typed in is destroyed and `activeElement` falls back to
         * `<body>`; the guard reads "nothing in here has focus", and the focus is
         * pulled back to the window's first control. A module panel re-renders on
         * every clock write, every Despair change, every message - so the reader
         * was being taken back to the top of a window they were part-way down.
         *
         * It is also the one thing on this hook that reads layout: the finder
         * asks each candidate for `offsetParent`, and that is a forced layout
         * inside Foundry's own render pass, after `scaleWindow` has already moved
         * the box and `dressChrome` has put new nodes in it.
         *
         * `isFirstRender` is Foundry's own answer, asked rather than remembered -
         * the same argument motion.mjs makes for the entrance animation. A flag
         * written on the element would say "opened before" for a window reopened
         * on the same element, which is exactly when the focus must move.
         */
        if (!options?.isFirstRender) return;
        if (!el.classList?.contains("drpg-panel") && !el.classList?.contains("drpg-messenger")) return;
        /* NEXT FRAME, NOT THIS ONE. The finder asks each candidate for `offsetParent`,
           which the browser can only answer by laying the window out - and this runs
           inside Foundry's render, with the subtree just inserted and `dressChrome`
           having replaced every number field and select a moment earlier, so nothing
           can be served from cache. A frame later the browser has done that layout for
           its own reasons and the read is free. The move is invisible either way, and
           the "somebody is already working in here" guard inside `focusIntoWindow` is
           read at call time, so deferring makes it more accurate rather than less. */
        requestAnimationFrame(() => focusIntoWindow(el));
    });
    for (const hook of ["canvasReady", "drpgTimeOfDayChanged", "drpgEclipseChanged"]) {
        Hooks.on(hook, () => nameControls());
    }
    /* The blocks are not applications and fire no render hook of their own, so the
       sweep follows the DOM instead - the same observer pattern the curtain uses,
       and for the same reason: a block that redrew itself is a block with new
       buttons in it. Debounced, because a Despair pip being spent is several
       mutations in one tick. */
    if ("MutationObserver" in window) {
        let queued = 0;
        const watch = new MutationObserver(() => {
            if (queued) return;
            queued = requestAnimationFrame(() => { queued = 0; nameControls(); });
        });
        for (const sel of ["#ui-left-column-1", "#ui-top", "#ui-right-column-1", "#drpg-column", "#drpg-popups"]) {
            const host = document.querySelector(sel);
            if (host) watch.observe(host, { childList: true, subtree: true });
        }
    }
}
