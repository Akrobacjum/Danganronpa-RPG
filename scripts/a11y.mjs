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
    "#drpg-sound-launcher", "#drpg-book-launcher", "#drpg-foundry-tools", ".drpg-panel", ".drpg-messenger",
    /*
     * `.drpg-advance` IS A MODULE WINDOW AND THIS LIST WAS THE ONLY PLACE THAT
     * DID NOT KNOW IT (audit 15.09). The Level Up window was the one dialog of
     * the module's hundred-odd that did not also carry `.drpg-panel`, so the
     * sweep walked past it. utils.mjs's window group and two width rules in
     * danganronpa.css have listed it beside `.drpg-panel` all along; this is
     * the file that fell out of step.
     *
     * SINCE E10 C9 (1.2.71, audit S01-16) THE PICKER CARRIES BOTH, so the sweep
     * finds it by `.drpg-panel` already and this entry only keeps a window
     * built with `drpg-advance` alone from being missed again. What the second
     * class also brings is the line further down, which reads `.drpg-panel`
     * and nothing else: `focusIntoWindow` now runs on the picker's first
     * render. Read in the code, not measured: the move waits for a frame and
     * a layout, and this suite does not draw either.
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

/** Controls the sweep could not name, for the report. Keyed so one entry is one kind; `els` holds weak references to
 *  the elements of that kind met, so the report can tell a kind still on the page from one met only in a window since
 *  closed (`a11yReport`). */
const unnamed = new Map();
/* Past this many references a kind's list drops those whose element is gone, so a window drawn again and again does not
   grow it without end. */
const KIND_REFS = 32;

/* A FIELD IS NOT NAMED BY WHAT IS IN IT (E48 K4, 11.11.2026). A select's `textContent` is every option's words run
   together and a textarea's is the text typed into it, so a field with no label read as "own" and was never offered the
   tooltip it carries: a reader said "Alpha Beta Gamma" for a picker, or the player's own note for its box. A field's
   name is its label, its aria-label or what it carries (`nameFrom`), never its content (R3462). */
const FIELDS = "select, textarea, input";

/** What a screen reader would already say for this control, or "" if nothing. */
function accessibleName(el) {
    const aria = el.getAttribute("aria-label");
    if (aria?.trim()) return aria.trim();
    if (el.getAttribute("aria-labelledby")) return "labelledby";
    const text = el.matches(FIELDS) ? "" : (el.textContent ?? "").replace(/\s+/g, " ").trim();
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
 *
 * NOT A KEPT CARD (E77 fix r2-H9, 13.10.2026). The notice history window is a `.drpg-panel`, and an entry opened
 * in it holds a past card's body (`.drpg-notice-snapshot`) - a card's words, not the module's chrome. A sweep that
 * ran after an entry opened marked the card's link `data-drpg-named` (and, read in the code, would give a nameless
 * one an `aria-label` from its title), where the history allows no `data-*` and no `aria-*` (R294's window half).
 * Measured with R294's window clause inside a Class Trial (e77run/scratch/r2h9-trial.mjs): attrs
 * ["data-drpg-named"] under the snapshot with a change in `#drpg-popups` forced after the opening
 * (DRPG_REBUILD=sweep), and on two of four runs that forced no sweep - one comes a frame after any change in the
 * columns watched below. The card stays as the history drew it.
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
                if (el.dataset.drpgNamed || el.closest(".drpg-notice-snapshot")) continue;
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
                        unnamed.set(kindOf(el), { where: host.id || kindOf(host), html: el.outerHTML.slice(0, 120), els: [] });
                    }
                    const info = unnamed.get(kindOf(el));
                    if (typeof WeakRef === "function") {
                        info.els.push(new WeakRef(el));
                        if (info.els.length > KIND_REFS) info.els = info.els.filter(ref => ref.deref()?.isConnected);
                    }
                    el.dataset.drpgNamed = "none";
                }
            }
        }
        liveRegions(root);
        for (const fn of afterSweep) fn(root);
    } catch (err) {
        debug("The accessibility sweep could not finish", err);
    }
}

/** What runs after each sweep, on the same root (explain.mjs's panels made reachable by keyboard, E48 K4): one road
 *  for "a block of the module was drawn", so a second file does not watch the page again for it. */
const afterSweep = [];
export function onSweep(fn) {
    if (typeof fn === "function" && !afterSweep.includes(fn)) afterSweep.push(fn);
}

/* THE WATCH, READ FOR A TEST (E48 K4): the sweeps the hosts' changes asked for, the hosts adopted, whether hosts born
   after ready are looked for. */
const watch = { sweeps: 0, hosts: 0, births: false };
export function a11yWatch() {
    return { ...watch };
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
       that owns this question. Both are idempotent (`drpgLive`).
       The notice tile is also `aria-atomic="false"` (E81 C8): `status` implies `aria-atomic="true"` (WAI-ARIA
       1.2, read in the specification and not measured with a reader), which would have a reader read the whole
       tile - the history's button and its count with it - on every card. Said once, so a new card is the
       addition and the button's name is not; what a real reader does with it is LIVE-E81-08. */
    for (const [sel, role, atomic] of [["#drpg-popups", "status", "false"], ["#drpg-events", "status"],
                                       ["#drpg-evidence", "status"]]) {
        const el = root.querySelector?.(sel) ?? (root.matches?.(sel) ? root : null);
        if (!el || el.dataset.drpgLive) continue;
        if (!el.getAttribute("role")) el.setAttribute("role", role);
        if (!el.getAttribute("aria-live")) el.setAttribute("aria-live", "polite");
        if (atomic && !el.getAttribute("aria-atomic")) el.setAttribute("aria-atomic", atomic);
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
function focusIntoWindow(el) {
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

/** Every control the sweep met and could not name that is still on the page, and a count of the kinds met only in windows since closed, for the GM's diagnostics. */
export function a11yReport() {
    /* ON THE PAGE NOW, NOT EVER MET (gaps, 12.11.2026; the E99 line's full tier-2 run). The map remembers a kind from its
       first sight, and a kind met only in a window since closed was reported as a control on screen - its `where` the
       window's id, which no longer exists: R3551's three stand-in windows, closed in its `finally` and gone from the page
       (read after it: no element with an `r3551-` id), left "input in r3551-character-..." in the report, and tier 2's
       "every control in the module's own chrome has a name" failed after it and passed alone. A kind is listed while one
       of its elements is still in the page (read where one of them stands now, with its html), and the
       kinds met only in windows since closed are counted on a line of their own. Without WeakRef every kind is listed. */
    const live = [], gone = [];
    for (const [kind, info] of unnamed.entries()) {
        if (typeof WeakRef !== "function") { live.push([kind, info, null]); continue; }
        info.els = info.els.filter(ref => ref.deref()?.isConnected);
        (info.els.length ? live : gone).push([kind, info, info.els[0]?.deref() ?? null]);
    }
    const whereOf = (el, info) => {
        const host = el?.closest?.(SURFACES.join(","));
        return host ? host.id || kindOf(host) : info.where;
    };
    const rows = live.map(([kind, info, el]) => `  ${kind} in ${whereOf(el, info)}\n    ${el ? el.outerHTML.slice(0, 120) : info.html}`);
    const closed = gone.length ? `\n${gone.length} more kind(s) met without a name only in windows no longer on the page: ${gone.map(([kind]) => kind).join(", ")}` : "";
    const shown = disclosuresOnPage(whereOf);
    return (rows.length
        ? `${rows.length} control kinds carry no name a screen reader can read:\n${rows.join("\n")}`
        : "every control in the module's own chrome has a name") + closed
        + (shown.length ? `\n${shown.length} disclosure(s) on the page:\n${shown.join("\n")}` : "");
}

/*
 * THE DISCLOSURES (gaps-111, 13.11.2026; 1.2.105's Known gaps: "`game.drpg.a11y()` does not list Details yet"). A control
 * that opens a region - `aria-expanded`, the region named by `aria-controls`: an action window's Details
 * (action-menus.mjs `detailsHtml`), the tray's fold, the room tile, the case map's nodes - has a name, so the list
 * above never showed it, and nothing asked whether its region is there for a screen reader. One line each, on the
 * module's surfaces: its name, whether it is open, and its region - on the page, named (`aria-label`, or an
 * `aria-labelledby` that points at something), and while shut out of reach (`inert`, `hidden`, or under either). What
 * does not hold is said in capitals, as the list above says a missing name. Read headless (R4930); what a reader makes
 * of it is a real reader's.
 */
function disclosuresOnPage(whereOf) {
    const out = [];
    for (const el of document.querySelectorAll(SURFACES.map(s => `${s} [aria-expanded]`).join(","))) {
        if (!el.isConnected) continue;
        const name = el.getAttribute("aria-label")?.trim() || (el.textContent ?? "").replace(/\s+/g, " ").trim() || "(no name)";
        const open = el.getAttribute("aria-expanded") === "true";
        const id = el.getAttribute("aria-controls");
        const region = id ? document.getElementById(id) : null;
        let says;
        if (!id) says = "no region named (no aria-controls)";
        else if (!region) says = `its region #${id} NOT on the page`;
        else {
            const by = region.getAttribute("aria-labelledby");
            const named = Boolean(region.getAttribute("aria-label")?.trim() || (by && by.split(/\s+/).every(ref => document.getElementById(ref))));
            const away = Boolean(region.closest("[inert], [hidden]"));
            says = `its region #${id} ${named ? "named" : "NOT named"}${open ? "" : away ? " and out of reach" : " and STILL IN REACH while shut"}`;
        }
        out.push(`  "${name}" ${el.id ? `#${el.id}` : `(${kindOf(el)})`}: ${open ? "open" : "shut"}, ${says}, in ${whereOf(el, {})}`);
    }
    return out;
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
    // The phase's own hook since E17 C6: the HUD's controls change with it (a trial's slot), and the time of day's hook
    // no longer fires for a phase alone.
    for (const hook of ["canvasReady", "drpgTimeOfDayChanged", "drpgEclipseChanged", "drpgPhaseChanged"]) {
        Hooks.on(hook, () => nameControls());
    }
    /* The blocks are not applications and fire no render hook of their own, so the
       sweep follows the DOM instead - the same observer pattern the curtain uses,
       and for the same reason: a block that redrew itself is a block with new
       buttons in it. Debounced, because a Despair pip being spent is several
       mutations in one tick.
       THE MODULE'S HOSTS, AS THEY APPEAR, AND NOT THE CHAT (E48 K4, 11.11.2026). Until K4 this watched five columns
       found at ready, subtree and all: Foundry's right column holds the chat, so every message and every keystroke in
       v14's chat editor was a sweep of the whole module, while a host drawn after ready outside those five (a window's
       body, the Event panel in a column drawn late) was never watched. Now each host of SURFACES is watched itself, and
       one watch of the body's additions adopts a host the moment it is born - it sweeps only when one is, so a node
       added in the chat starts nothing (the tier-2 test "the a11y observer sees a host born after ready"). */
    if ("MutationObserver" in window) {
        let queued = 0;
        const sweepSoon = () => {
            if (queued) return;
            queued = requestAnimationFrame(() => { queued = 0; watch.sweeps++; nameControls(); });
        };
        const SEL = SURFACES.join(",");
        const adopted = new WeakSet();
        const hostWatch = new MutationObserver(sweepSoon);
        const adopt = node => {
            let born = false;
            for (const host of [...(node.matches?.(SEL) ? [node] : []), ...(node.querySelectorAll?.(SEL) ?? [])]) {
                if (adopted.has(host)) continue;
                adopted.add(host);
                watch.hosts++;
                hostWatch.observe(host, { childList: true, subtree: true });
                born = true;
            }
            return born;
        };
        adopt(document.body);
        new MutationObserver(records => {
            let born = false;
            for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && adopt(node)) born = true;
            if (born) sweepSoon();
        }).observe(document.body, { childList: true, subtree: true });
        watch.births = true;
    }
}
