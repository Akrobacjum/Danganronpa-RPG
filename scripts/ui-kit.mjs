/**
 * Danganronpa RPG - the window kit: one frame, one footer, one tab system and the controls every window shares
 * (E44 C3a, 04.11.2026; audit S17-34).
 * ---------------------------------------------------------------------------
 * WHY. At 1.2.98 the module drew its windows three ways: four tab wirings in two markups (`panelTabs`,
 * `wireDashboardTabs`, the handbooks' and the messenger's), footers in Foundry's order with every button on the right
 * and "Cancel" borrowed from Level Up by 55 of them, 24 tables of which 9 carry no class, and 12 number fields that
 * have a - and + under Stained Glass only (the E44 spec's probes at c4210b4d). E21 moves every window onto the frame
 * below and E22 gives every button a role from BUTTON_ROLES; this file is what they build on, and the look is the one
 * the owner approved on the kit card (DR-E44-M1, M15, 04.11.2026): today's look of each component's nearest part,
 * equal tab widths fitted to one line, and I1's fine print.
 *
 *   drpgWindow({ id, classes, title, body, tabs, footer, live, render, modal })   a DialogV2 on the kit's frame
 *   DrpgApp()                     the ApplicationV2 class with the same frame (made on first use: tier 0 imports
 *                                 this file without Foundry, as room-tile.mjs's class is made)
 *   kitTabs, kitTabBar, wireKitTabs, shownTab, formGrid, dataTable, helpText, stepper, stepperId, stepLabels,
 *   readStepper, wireSteppers, toggle, chip, chips, box, emptyOption, emptyState, scrollNote, kitNode, modeBar
 *   tile, launcher, launcherState, LAUNCH_STATES, pixelGlyph, sliderList, slider, frame, builtBy
 *                                 the A8 surfaces' DOM builders (E44 C6: the tiles, the launchers, "Who you hear",
 *                                 the Foundry tools frames), below
 *   BUTTON_ROLES                  primary, secondary, close, cancel, destructive, gmRoute
 *
 * THE FOOTER CONTRACT (the owner approved it on the pilot, 04.11.2026). The closing word, the secondary buttons and the
 * destructive ones stand on the left, in that order; the primary on the right, last. One word closes a window: Close
 * when nothing is left to answer, Cancel when a question is withdrawn - the role's own key, never a caller's label.
 * The primary is the default (autofocus); a role whose `mayDefault` is false (destructive) never is, and a footer that
 * names one as its default throws. A window with nothing to answer - no primary, no GM's road - may stand its closing
 * word on the right, where the answer would stand (`close: { role: "close", side: "right" }`; the notice history,
 * E44 C5, as the 11.10 amend A7 asks: Clear on the left, Close on the right); beside a primary that throws. ENTER IS THE FIRST SUBMIT BUTTON IN TREE ORDER, not the focused or the default one,
 * when focus is in a field (HTML's implicit submission; measured against DialogV2 on 14.365 for the tab footers, and the tier-2
 * tests "Enter in the verdict window executes nobody" and E44-T5 press it as a browser does). So the footer is two
 * groups with the right one FIRST in the tree - the primary is the first submit button - and components.css puts the
 * left one first on the screen (`order`). A keyboard's Tab therefore reaches the primary before the left group: the
 * price of Enter meaning the primary, and the same order the default button's autofocus starts from.
 *
 * WHAT IS NOT HERE. A window's own layout (D31: E46 and E47 build each from its approved card), a button's face (the
 * panel's and the glass's button rules stay until E22: a role keeps today's face class, `face`).
 *
 * THE NUMBER FIELDS (E44 C4b, 04.11.2026; audit S10-66). The module's twelve number fields are `stepper`s, in both
 * themes: chrome.mjs `dressChrome`, which Foundry's render hook runs on every window, calls `wireSteppers` before its
 * theme gate, and dresses no number field itself (until C4b it put its own - and + round them under Stained Glass
 * only, so Monokuma Legacy had the browser's spinner; the stepper under Legacy is not yet seen on v14 at a table).
 *
 * Imports utils.mjs and live.mjs only, and none of utils.mjs, live.mjs or config.mjs may import it (R161). Since E44
 * C4a every tabbed window of the module draws its tabs here (R1324), since C4b every number field is its stepper and
 * the seven bare "-" options its `emptyOption` (R1127, R1329); the rest of the kit waits for E21.
 */

import { esc, error, wholeNumber, dialogContent, eachPane, markLanguage } from "./utils.mjs";
import { keepLive } from "./live.mjs";

/* ---- the button roles -------------------------------------------------------------------------------------------- */

/**
 * Every button of a kit footer has one of these roles (E22 gives one to every button of the module). Per role: `cls`,
 * the class the kit puts on it and components.css styles in both themes through `token`; `face`, today's class whose
 * rules paint it (danganronpa.css, stained-glass.css), kept until E22; `side`, where it stands; `mayDefault`, whether it
 * may be the window's default (autofocus); `word`, the one word of a closing role (both lang files). `rank` is its place
 * in its side, left to right (components.css's `order`).
 */
export const BUTTON_ROLES = Object.freeze({
    primary: Object.freeze({ cls: "drpg-role-primary", face: null, side: "right", rank: 2, mayDefault: true, token: "--drpg-kit-role-primary", word: null }),
    gmRoute: Object.freeze({ cls: "drpg-role-gm-route", face: "drpg-gm-route", side: "right", rank: 1, mayDefault: true, token: "--drpg-kit-role-gm-route", word: null }),
    close: Object.freeze({ cls: "drpg-role-close", face: null, side: "left", rank: 0, mayDefault: true, token: "--drpg-kit-role-close", word: "DRPG.Kit.close" }),
    cancel: Object.freeze({ cls: "drpg-role-cancel", face: null, side: "left", rank: 0, mayDefault: true, token: "--drpg-kit-role-cancel", word: "DRPG.Kit.cancel" }),
    secondary: Object.freeze({ cls: "drpg-role-secondary", face: null, side: "left", rank: 1, mayDefault: false, token: "--drpg-kit-role-secondary", word: null }),
    destructive: Object.freeze({ cls: "drpg-role-destructive", face: "drpg-destructive", side: "left", rank: 2, mayDefault: false, token: "--drpg-kit-role-destructive", word: null })
});

const localize = key => game.i18n.localize(key);

/**
 * A footer's buttons in the kit's order, each `{ role, side, action, label, callback, icon, disabled, default }`, from
 * `{ primary, secondary: [], destructive: [], gmRoute: [], close, default }`. `close` is "close", "cancel", or
 * `{ role: "close" | "cancel", action, callback, side }`; its label is the role's word whatever the caller wrote, and
 * `side: "right"` stands it on the right in a footer with no primary and no GM's road (the header). The tree
 * order is the right side (primary first, then the GM's road), then the left side (the closing word, the secondary
 * ones, the destructive ones) - see the header. `default` names the action that is the window's default; without one,
 * the primary, else the GM's road, else the closing word. Throws when the default is a role that may never be one.
 */
export function footerButtons(footer = {}) {
    const one = (role, b) => (b ? [{ ...b, role }] : []);
    const many = (role, list) => (list ?? []).filter(Boolean).map(b => ({ ...b, role }));
    let closing = [];
    if (footer.close) {
        const spec = typeof footer.close === "string" ? { role: footer.close } : footer.close;
        const role = spec.role === "cancel" ? "cancel" : "close";
        closing = [{ callback: spec.callback, icon: spec.icon, action: spec.action ?? role, role, label: localize(BUTTON_ROLES[role].word), side: spec.side === "right" ? "right" : "left" }];
    }
    const answers = [...one("primary", footer.primary), ...many("gmRoute", footer.gmRoute)];
    const closeRight = closing[0]?.side === "right";
    if (closeRight && answers.length) throw new Error("ui-kit: a closing word stands on the right only in a footer with no primary and no GM's road");
    const right = closeRight ? closing : answers;
    const left = [...(closeRight ? [] : closing), ...many("secondary", footer.secondary), ...many("destructive", footer.destructive)];
    const all = [...right, ...left];
    for (const b of all) if (!b.action) throw new Error(`ui-kit: a ${b.role} button with no action`);
    const named = footer.default ?? (right[0] ?? closing[0])?.action ?? null;
    const chosen = all.find(b => b.action === named) ?? null;
    if (footer.default && !chosen) throw new Error(`ui-kit: the footer's default "${footer.default}" is none of its buttons`);
    if (chosen && !BUTTON_ROLES[chosen.role].mayDefault) throw new Error(`ui-kit: a ${chosen.role} button may never be a window's default ("${chosen.action}")`);
    return all.map(b => ({ ...b, side: b.side ?? BUTTON_ROLES[b.role].side, default: b === chosen }));
}

/** The DialogV2 `buttons` of a footer: Foundry's own shape, the role's classes in `class`. */
function dialogButtons(list) {
    return list.map(b => {
        const role = BUTTON_ROLES[b.role];
        const out = { action: b.action, label: b.label, default: b.default, class: [role.cls, role.face].filter(Boolean).join(" ") };
        if (b.callback) out.callback = b.callback;
        if (b.icon) out.icon = b.icon;
        if (b.disabled) out.disabled = true;
        return out;
    });
}

/**
 * The footer's markup for an ApplicationV2 window (DrpgApp), in the order and the groups `dressFooter` gives a
 * DialogV2's: `<footer class="form-footer drpg-kit-footer">`, the right group first in the tree.
 */
export function footerMarkup(footer = {}) {
    const list = footerButtons(footer);
    const button = b => {
        const role = BUTTON_ROLES[b.role];
        const classes = [role.cls, role.face, b.default ? "default" : null].filter(Boolean).join(" ");
        return `<button type="${b.type ?? "button"}" data-action="${esc(b.action)}" data-drpg-role="${b.role}" class="${classes}"`
            + `${b.default ? " autofocus" : ""}${b.disabled ? " disabled" : ""}>${b.icon ? `<i class="${esc(b.icon)}" inert></i>` : ""}<span>${esc(b.label)}</span></button>`;
    };
    const side = s => list.filter(b => b.side === s).map(button).join("");
    return `<footer class="form-footer drpg-kit-footer"><div class="drpg-kit-right">${side("right")}</div><div class="drpg-kit-left">${side("left")}</div></footer>`;
}

/**
 * Put a drawn footer on the contract: each button its role's classes and `data-drpg-role`, the two groups (right
 * first in the tree), and `autofocus` on the default only; `list` is `footerButtons`'s. Focus that stood on a moved
 * button is put back on it (moving an element out of the tree blurs it). A footer already dressed is left as it is.
 */
function dressFooter(root, list) {
    const footer = root?.querySelector?.("footer.form-footer");
    if (!footer || footer.classList.contains("drpg-kit-footer")) return footer ?? null;
    const doc = footer.ownerDocument;
    const focused = footer.contains(doc.activeElement) ? doc.activeElement : null;
    footer.classList.add("drpg-kit-footer");
    const right = doc.createElement("div");
    right.className = "drpg-kit-right";
    const left = doc.createElement("div");
    left.className = "drpg-kit-left";
    for (const b of list) {
        const el = [...footer.querySelectorAll(":scope > button[data-action]")].find(x => x.dataset.action === b.action);
        if (!el) continue;
        const role = BUTTON_ROLES[b.role];
        el.dataset.drpgRole = b.role;
        el.classList.add(role.cls);
        if (role.face) el.classList.add(role.face);
        el.classList.toggle("default", b.default);
        if (b.default) el.setAttribute("autofocus", ""); else el.removeAttribute("autofocus");
        (b.side === "right" ? right : left).append(el);
    }
    footer.prepend(right, left);
    focused?.focus?.();
    return footer;
}

/** The buttons of a kit footer a person can press now: shown and enabled. */
const pressable = footer => [...(footer?.querySelectorAll("button[data-action]") ?? [])].filter(b => !b.hidden && !b.disabled);

/* ---- tabs ------------------------------------------------------------------------------------------------------- */

/** The key a section opens on: `active` when a section has it, else the first. */
const openKey = (sections, active) => (sections.some(s => s.key === active) ? active : sections[0]?.key ?? null);

function tabNav(sections, open) {
    return `<nav class="drpg-tabs" role="tablist">${sections.map(s =>
        `<button type="button" role="tab" data-drpg-tab-key="${esc(s.key)}" aria-selected="${s.key === open}">${esc(s.label)}</button>`).join("")}</nav>`;
}

function tabPanes(sections, open) {
    return sections.map(s =>
        `<section class="drpg-tab-pane" role="tabpanel" data-drpg-pane="${esc(s.key)}"${s.key === open ? "" : " hidden"}>${s.html ?? ""}</section>`).join("");
}

/**
 * One tab system for every window (the owner, 26.08: a GM panel window's tabs look like GM Team's; S12-50: equal
 * widths). `sections` is `[{ key, label, html }]`; labels are text (escaped), panes markup. Every pane stays in the
 * DOM whichever tab shows - a Save that reads the whole form still reads every field - and a hidden one carries
 * `hidden`, which is also what `eachPane` measures by. Wire it with `wireKitTabs` once the window is drawn.
 */
export function kitTabs(sections, { active = null } = {}) {
    const open = openKey(sections, active);
    return tabNav(sections, open) + tabPanes(sections, open);
}

/**
 * The bar alone, for a window whose one pane is filled again on each switch (the handbooks' book, the messenger's
 * Chat and Note): the same markup as `kitTabs`'s bar, no pane, so `wireKitTabs` switches nothing but the bar and
 * its `onSwitch` loads what the tab shows.
 */
export function kitTabBar(sections, { active = null } = {}) {
    return tabNav(sections, openKey(sections, active));
}

/** The key of the tab a kit bar inside `root` shows, or null where there is no bar. */
export function shownTab(root) {
    return root?.querySelector?.('nav.drpg-tabs > button[role="tab"][aria-selected="true"]')?.dataset.drpgTabKey ?? null;
}

/**
 * Switch a kit tab bar's panes, and the footer with it. `buttons` maps a tab's key to the footer actions it shows,
 * `always` lists those every tab shows; without `buttons` the footer does not move. `onSwitch(key)` runs after a tab
 * is shown by a press (a window that loads a pane: the handbooks' book, the messenger's note). `fit` runs the
 * one-line fit (below) once the bar is laid out; `win` is the window it may widen, given only where the kit draws the
 * frame (drpgWindow): a window whose width another sheet states with `!important` (every window E21 has not moved)
 * would keep its width while the fit counted on the growth, so there the fit goes to rows instead.
 *
 * HIDDEN IS NOT ENOUGH FOR A FOOTER BUTTON, AND THAT IS THE WHOLE TRAP (utils.mjs's `wirePanelTabs`, measured against
 * DialogV2 on 14.365, which this replaces): the footer's buttons are `type="submit"` inside the dialog's form and
 * `_onKeyDown` intercepts Escape only, so Enter goes through the browser's implicit submission, which picks the first
 * submit button in tree order whether or not it shows; `autofocus` does not decide it either. So a button another
 * tab owns is hidden AND disabled - the spec skips a disabled default button and nothing else in the chain does - and
 * danganronpa.css's `footer.form-footer button[hidden]` keeps it out of the row. The shown button that takes
 * `autofocus`: on a kit footer the primary, else the first that may be a default (BUTTON_ROLES); on a footer with no
 * roles (every window E22 has not given them) the first shown, the one a person would have pressed - and there the
 * buttons' own classes are left as Foundry drew them.
 */
export function wireKitTabs(root, { buttons = null, always = [], onSwitch = null, fit = true, win = null } = {}) {
    const nav = root?.querySelector?.("nav.drpg-tabs");
    if (!nav || nav.dataset.drpgKitWired) return null;
    nav.dataset.drpgKitWired = "1";
    const tabs = [...nav.querySelectorAll('button[role="tab"][data-drpg-tab-key]')];
    const panes = () => [...root.querySelectorAll("[data-drpg-pane]")];
    const footerFor = key => {
        if (!buttons) return;
        const footer = root.querySelector("footer.form-footer");
        if (!footer) return;
        const allowed = new Set([...(buttons[key] ?? []), ...always]);
        const all = [...footer.querySelectorAll("button[data-action]")];
        const roles = all.some(b => b.dataset.drpgRole);
        for (const b of all) {
            const mine = allowed.has(b.dataset.action);
            b.hidden = !mine;
            b.disabled = !mine;
            b.removeAttribute("autofocus");
            if (roles) b.classList.remove("default");
        }
        const shown = pressable(footer);
        if (!roles) { shown[0]?.setAttribute("autofocus", ""); return; }
        const pick = shown.find(b => b.dataset.drpgRole === "primary")
            ?? shown.find(b => BUTTON_ROLES[b.dataset.drpgRole]?.mayDefault);
        if (pick) { pick.setAttribute("autofocus", ""); pick.classList.add("default"); }
    };
    const show = key => {
        for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.drpgTabKey === key));
        for (const p of panes()) p.hidden = p.dataset.drpgPane !== key;
        footerFor(key);
    };
    for (const t of tabs) {
        t.addEventListener("click", () => {
            const key = t.dataset.drpgTabKey;
            show(key);
            try { onSwitch?.(key); } catch (err) { error("A kit tab's onSwitch failed", err); }
        });
    }
    const first = tabs.find(t => t.getAttribute("aria-selected") === "true") ?? tabs[0];
    if (first) show(first.dataset.drpgTabKey);
    if (fit) fitWhenLaidOut(nav, win);
    return { show, nav };
}

/**
 * The fit, after the layout: a bar measured before it was laid out reads 0 and fits nothing. And again once the tab's
 * own face has loaded: a face is fetched only when text first asks for it, so `document.fonts` read "loaded" while
 * the first measure was taken in the fallback face, and Legacy's pixel face then left "Description" cut at 390x844 on
 * a bar fitted to one line at 13 px (the kit gallery, 04.11.2026; measured again with the face in: two rows of two).
 * On a page with no layout (jsdom) it measures 0 and sets nothing.
 */
function fitWhenLaidOut(nav, win) {
    if (typeof requestAnimationFrame !== "function") return;
    const fit = () => { if (nav.isConnected) fitKitTabs(nav, { win }); };
    requestAnimationFrame(() => {
        fit();
        const tab = nav.querySelector('button[role="tab"]');
        const cs = tab ? getComputedStyle(tab) : null;
        nav.ownerDocument?.fonts?.load?.(`${cs?.fontSize ?? "13px"} ${cs?.fontFamily ?? "sans-serif"}`)
            .then(() => requestAnimationFrame(fit), () => null);
    });
}

/**
 * Run `measure` with each pane shown in turn, by the same `hidden` the tabs switch, and put every pane back as it
 * was (`fitWindowToTabs`'s measuring). It lives in utils.mjs, which may not import this file; the kit hands it on.
 */
export { eachPane };

/* THE ONE-LINE FIT (the owner, 04.11.2026, on the pilot: "equal, but a smaller font so they fit one line"; approved
   with the 25 % growth on DR-E44-M1, q-grow). Each strip takes the first that fits its bar on one line of equal
   columns: today's size; then down by 0.5 px to the floor (11 px, D29's, under Monokuma Legacy; `--drpg-sg-floor`
   under Stained Glass, which is higher); there the letter-spacing down to 0; then the padding down to 4 px; then the
   window up to a quarter wider (never past the screen less 16 px); only then rows, as few as fit. What it took is
   written on the bar (`data-drpg-tab-fit`) and in three custom properties the bar's rule reads. On a page with no
   layout (jsdom) the bar measures 0 and nothing is set. */
const TAB_FLOOR = 11;
const GROWTH = 0.25;

function tabNeed(nav, btns, cols, size, ls, pad) {
    nav.style.setProperty("--drpg-kit-tab-fit-size", `${size}px`);
    nav.style.setProperty("--drpg-kit-tab-fit-ls", `${ls}em`);
    nav.style.setProperty("--drpg-kit-tab-fit-pad", `${pad}px`);
    let widest = 0;
    for (const b of btns) {
        const was = b.style.width;
        b.style.width = "max-content";
        widest = Math.max(widest, b.getBoundingClientRect().width);
        b.style.width = was;
    }
    const gap = parseFloat(getComputedStyle(nav).columnGap) || 0;
    return cols * widest + (cols - 1) * gap;
}

/**
 * Fit one kit tab bar to one line (above). `win` is the window that may grow (its element); answers what was taken,
 * `{ rows, cols, size, ls, pad, grew }`, or null where nothing could be measured.
 */
export function fitKitTabs(nav, { win = null } = {}) {
    const btns = [...(nav?.children ?? [])].filter(b => b.matches('button[role="tab"]'));
    if (!btns.length || !nav.clientWidth) return null;
    for (const v of ["--drpg-kit-tab-fit-size", "--drpg-kit-tab-fit-ls", "--drpg-kit-tab-fit-pad", "--drpg-kit-tab-n"]) nav.style.removeProperty(v);
    delete nav.dataset.drpgTabFit;
    const n = btns.length, cs = getComputedStyle(btns[0]), ncs = getComputedStyle(nav);
    const f0 = parseFloat(cs.fontSize);
    const ls0 = Math.round(((parseFloat(cs.letterSpacing) || 0) / f0) * 1000) / 1000;
    const pad0 = parseFloat(cs.paddingLeft) || 0;
    const room = nav.clientWidth - (parseFloat(ncs.paddingLeft) || 0) - (parseFloat(ncs.paddingRight) || 0);
    const probe = nav.ownerDocument.createElement("span");
    probe.style.fontSize = "var(--drpg-kit-tab-floor)";
    nav.append(probe);
    const themeFloor = Math.max(TAB_FLOOR, parseFloat(getComputedStyle(probe).fontSize) || TAB_FLOOR);
    probe.remove();
    const floor = Math.min(f0, themeFloor);
    const sizes = [];
    for (let f = f0; f >= floor - 0.001; f = Math.round((f - 0.5) * 10) / 10) sizes.push(f);
    if (sizes[sizes.length - 1] !== floor) sizes.push(floor);
    const done = fit => {
        nav.style.setProperty("--drpg-kit-tab-n", String(fit.cols));
        tabNeed(nav, btns, fit.cols, fit.size, fit.ls, fit.pad);
        nav.dataset.drpgTabFit = fit.rows === 1 ? "one" : "rows";
        return fit;
    };
    const grow = (cols, tries) => {
        if (!win) return null;
        const maxW = innerWidth - 16, w0 = win.getBoundingClientRect().width;
        for (const [size, ls, pad] of tries) {
            const need = tabNeed(nav, btns, cols, size, ls, pad);
            if (w0 + (need - room) <= maxW && need - room <= w0 * GROWTH) {
                const by = Math.ceil(need - room) + 1;
                win.style.width = `${Math.ceil(w0 + by)}px`;
                return { size, ls, pad, grew: by };
            }
        }
        return null;
    };
    for (const size of sizes) if (tabNeed(nav, btns, n, size, ls0, pad0) <= room) return done({ rows: 1, cols: n, size, ls: ls0, pad: pad0, grew: 0 });
    for (let ls = ls0; ls >= -0.0001; ls = Math.round((ls - 0.01) * 1000) / 1000) {
        if (tabNeed(nav, btns, n, floor, ls, pad0) <= room) return done({ rows: 1, cols: n, size: floor, ls, pad: pad0, grew: 0 });
    }
    for (let pad = pad0; pad >= 4; pad -= 1) if (tabNeed(nav, btns, n, floor, 0, pad) <= room) return done({ rows: 1, cols: n, size: floor, ls: 0, pad, grew: 0 });
    const grown = grow(n, [[floor, ls0, pad0], [floor, 0, 4]]);
    if (grown) return done({ rows: 1, cols: n, ...grown });
    for (let cols = Math.ceil(n / 2); cols >= 1; cols--) {
        const rows = Math.ceil(n / cols);
        for (const size of sizes) if (tabNeed(nav, btns, cols, size, ls0, pad0) <= room) return done({ rows, cols, size, ls: ls0, pad: pad0, grew: 0 });
        if (tabNeed(nav, btns, cols, floor, 0, 4) <= room) return done({ rows, cols, size: floor, ls: 0, pad: 4, grew: 0 });
        const wider = grow(cols, [[f0, ls0, pad0], [floor, ls0, pad0], [floor, 0, 4]]);
        if (wider) return done({ rows, cols, ...wider });
    }
    return done({ rows: n, cols: 1, size: floor, ls: 0, pad: 4, grew: 0 });
}

/* ---- the scroll signal ------------------------------------------------------------------------------------------ */

/**
 * `data-drpg-scroll="more"` on `box` while more of it lies below or to the right, and its screen reader's line shown
 * then (`[data-drpg-scroll-note]` inside it); from a `scroll` listener and a ResizeObserver where there is one, never
 * a frame loop (the stage's rule 13). Answers the function that stops it.
 */
/* What lies past a box's edge before it counts as more: the glass's button brush draws 5 px past each side of a
   button (`::before`, danganronpa.css's note on the tables window), and in the kit gallery under the glass (1366x768,
   04.11.2026) a row of chips overhung its body by 3 px and a mode bar by 4 px with nothing to scroll to - 1 px of
   slack, the mockup's, signalled both. A row of anything is taller than 8 px. */
const SCROLL_SLACK = 8;

export function watchScroll(box) {
    if (!box) return () => {};
    const note = box.querySelector(":scope > [data-drpg-scroll-note]");
    const read = () => {
        const more = box.scrollHeight - box.clientHeight - box.scrollTop > SCROLL_SLACK || box.scrollWidth - box.clientWidth - box.scrollLeft > SCROLL_SLACK;
        if (more) box.dataset.drpgScroll = "more"; else delete box.dataset.drpgScroll;
        if (note) note.hidden = !more;
    };
    read();
    box.addEventListener("scroll", read, { passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(read) : null;
    observer?.observe(box);
    return () => { box.removeEventListener("scroll", read); observer?.disconnect(); };
}

/**
 * The screen reader's line of a scroll signal: visually hidden, shown to a reader while more lies out of view. A box
 * of a window's own that scrolls (the notice history's list) puts it first inside the box, where `watchScroll` finds it.
 */
export const scrollNote = () => `<span class="drpg-kit-sr" data-drpg-scroll-note hidden>${esc(localize("DRPG.Kit.scrollMore"))}</span>`;

/**
 * The first element of a kit builder's markup, as a node: for a window that builds itself from nodes (the notice
 * history, E44 C5), which writes no markup of its own (R296). Hand it only what this file's builders return - they
 * escape every label, count and attribute they write - never markup a person or a stored value wrote.
 */
export function kitNode(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    return template.content.firstElementChild;
}

/* ---- the controls ----------------------------------------------------------------------------------------------- */

/**
 * A label column and a field column (`container-type: inline-size` on the grid: one column under the container's
 * 30rem, at any screen). `rows` is `[{ label, field, id }]` - the label text (escaped), the field markup, the id the
 * label points at - or `{ full }` for a line across both columns.
 */
export function formGrid(rows) {
    return `<div class="drpg-form-grid">${rows.map(r => {
        if (r.full !== undefined) return `<div class="drpg-form-full">${r.full}</div>`;
        return `<label class="drpg-form-label"${r.id ? ` for="${esc(r.id)}"` : ""}>${esc(r.label)}</label><div class="drpg-form-field">${r.field ?? ""}</div>`;
    }).join("")}</div>`;
}

/**
 * A table on the kit: `columns` `[{ key, label, width, num, act }]`, `rows` `[{ key: cellMarkup }]` (cells are markup,
 * as every builder in the module writes them: escape what a person typed), `empty` the key of the words for no rows
 * (the kit's own by default), `caption` text. A `<colgroup>` (a `width` per column, a CSS length), the head sticky
 * in the scroll box that holds the table, the empty state one row across every column, and the scroll signal wired
 * by `wireKit` (`watchScroll`).
 */
export function dataTable({ columns, rows = [], empty = "DRPG.Kit.tableEmpty", caption = null } = {}) {
    const cls = c => [c.num ? "num" : null, c.act ? "act" : null].filter(Boolean).join(" ");
    const classAttr = c => (cls(c) ? ` class="${cls(c)}"` : "");
    const cols = columns.map(c => `<col data-drpg-col="${esc(c.key)}"${c.width ? ` style="width: ${esc(c.width)}"` : ""}>`).join("");
    const head = columns.map(c => `<th scope="col"${classAttr(c)}>${esc(c.label)}</th>`).join("");
    const body = rows.length
        ? rows.map(r => `<tr>${columns.map(c => `<td${classAttr(c)}>${r[c.key] ?? ""}</td>`).join("")}</tr>`).join("")
        : `<tr><td class="drpg-data-empty" colspan="${columns.length}">${esc(localize(empty))}</td></tr>`;
    return `<div class="drpg-data-table-box"><table class="drpg-data-table">${caption ? `<caption>${esc(caption)}</caption>` : ""}`
        + `<colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${scrollNote()}</div>`;
}

/**
 * A list's empty state: one line in the kit's words, centred in the list it stands for (the notice history's "nothing
 * kept yet" and "nothing matches", E44 C5). `key` is the line's words; `data`, when given, formats them.
 */
export function emptyState(key, data = null) {
    return `<p class="drpg-kit-empty">${esc(data ? game.i18n.format(key, data) : localize(key))}</p>`;
}

/** Fine print: one line of help in the kit's fine-print ink (I1, the owner's choice on 04.11.2026). */
export function helpText(key, data = null) {
    return `<p class="drpg-help">${esc(data ? game.i18n.format(key, data) : localize(key))}</p>`;
}

/**
 * What the - and + of a number field say (E20 C6, 30.10.2026; S01-48): "One fewer" and "One more" at a step of 1 (or
 * none, or "any"), and the step itself otherwise - the debate length moves by 10, and its buttons said "One more".
 * `input` is the field or anything with its `step` (R1521). Moved here from chrome.mjs in E44 C4b with the stepper.
 */
export function stepLabels(input) {
    const size = Number(input?.step);
    if (!Number.isFinite(size) || size <= 0 || size === 1) return { down: localize("DRPG.Look.stepDown"), up: localize("DRPG.Look.stepUp") };
    return { down: game.i18n.format("DRPG.Look.stepDownBy", { n: size }), up: game.i18n.format("DRPG.Look.stepUpBy", { n: size }) };
}

let stepperIds = 0;

/**
 * A fresh id for a stepper's input, for a window that writes the field's label itself (`<label for>`), as the twelve
 * number fields do: their rows' layouts (Edit campaign's two-column grid, the Overflow rules) are each window's own, so
 * the label stays the window's and points at the input by `for` - never at the minus, which a label wrapping its
 * control would name (the 21.09 fault, tier 2's "clicking a number field's label ...").
 */
export function stepperId() {
    return `drpg-kit-step-${++stepperIds}`;
}

/**
 * The one number control (E44; C4b moves the module's twelve number fields onto it): the input with its - and + and
 * the line under it that says a value is out of range, all in the markup - no dressing after the draw. The input
 * keeps `name`, `min`, `max` and `step` as given, so a form reads what it read before; `readStepper` reads it through
 * `wholeNumber`. `label` is text; the label points at the input by id, never at the minus (the 21.09 fault: a label
 * wrapping its control labels the first labelable element in it, and a button is one). A window that writes its own
 * label passes `id` (`stepperId()`) and points it there by `for`. `attrs` are the input's other attributes, by name
 * (a field's `style`, its `data-drpg-enter`), each escaped; they cannot replace the five above.
 */
export function stepper({ name, value = "", min = null, max = null, step = 1, label = null, id = null, attrs = {} } = {}) {
    const inputId = id ?? stepperId();
    const words = stepLabels({ step });
    const attr = (k, v) => (v === null || v === undefined || v === "" ? "" : ` ${k}="${esc(v)}"`);
    const own = new Set(["type", "id", "name", "value", "min", "max", "step"]);
    const more = Object.entries(attrs ?? {}).filter(([k]) => !own.has(k) && /^[a-z][a-z0-9-]*$/.test(k)).map(([k, v]) => attr(k, v)).join("");
    const field = `<span class="drpg-kit-stepper">`
        + `<button type="button" class="drpg-step drpg-step-minus" data-drpg-step="-1" aria-label="${esc(words.down)}" data-tooltip="${esc(words.down)}">-</button>`
        + `<input type="number" id="${esc(inputId)}"${attr("name", name)}${attr("value", value)}${attr("min", min)}${attr("max", max)}${attr("step", step)}${more}>`
        + `<button type="button" class="drpg-step drpg-step-plus" data-drpg-step="1" aria-label="${esc(words.up)}" data-tooltip="${esc(words.up)}">+</button>`
        + `</span><span class="drpg-field-msg" aria-live="polite"></span>`;
    return label === null ? field : `<label class="drpg-kit-stepper-label" for="${esc(inputId)}"><span>${esc(label)}</span>${field}</label>`;
}

/* The stepper's field, as its readers find it (one spelling: tier 0's R1127 counts every `type="number"` of the module). */
const NUMBER_FIELD = 'input[type="number"]';

const bound = (v, otherwise) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? otherwise : Number(v));

/** A stepper's value as a whole number in its own input's range (`wholeNumber`, R1127). `el` is the input or any node holding it. */
export function readStepper(el, options = {}) {
    // By presence, not by a default: a destructuring default would turn `fallback: undefined` into 0 (R1128).
    const fallback = "fallback" in options ? options.fallback : 0;
    const input = el?.matches?.(NUMBER_FIELD) ? el : el?.querySelector?.(`.drpg-kit-stepper > ${NUMBER_FIELD}`);
    if (!input) return fallback;
    return wholeNumber(input.value, { min: bound(input.min, -Infinity), max: bound(input.max, Infinity), fallback });
}

/* One step of a stepper and its message line (chrome.mjs `step` and `dressNumberField`'s check until E44 C4b, the same
   rules): the step inside `min` and `max`, an empty field starting from `min` (or 0), `input` and `change` as a keystroke
   sends them; the line under the field only while the value is out of range. */
function wireStepper(wrap) {
    if (wrap.dataset.drpgKitWired) return;
    wrap.dataset.drpgKitWired = "1";
    const input = wrap.querySelector(NUMBER_FIELD);
    const message = wrap.nextElementSibling?.matches(".drpg-field-msg") ? wrap.nextElementSibling : null;
    if (!input) return;
    const check = () => {
        const value = Number(input.value);
        const min = bound(input.min, -Infinity), max = bound(input.max, Infinity);
        const bad = input.value !== "" && Number.isFinite(value) && (value < min || value > max);
        input.classList.toggle("is-bad", bad);
        if (bad) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
        if (message) {
            message.textContent = !bad ? ""
                : value > max ? game.i18n.format("DRPG.Look.atMost", { n: max }) : game.i18n.format("DRPG.Look.atLeast", { n: min });
        }
    };
    for (const button of wrap.querySelectorAll("button[data-drpg-step]")) {
        button.addEventListener("click", () => {
            if (input.disabled || input.readOnly) return;
            const size = Number(input.step) || 1;
            const min = bound(input.min, -Infinity), max = bound(input.max, Infinity);
            const current = Number(input.value);
            const from = input.value !== "" && Number.isFinite(current) ? current : (Number.isFinite(min) ? min : 0);
            const next = Math.min(max, Math.max(min, from + Number(button.dataset.drpgStep) * size));
            if (next === current && input.value !== "") return;
            input.value = String(next);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }
    input.addEventListener("input", check);
    input.addEventListener("change", check);
    check();
}

/** A checkbox drawn as a switch. `label` is text. */
export function toggle({ name, checked = false, label, disabled = false } = {}) {
    return `<label class="drpg-toggle"><input type="checkbox" role="switch" name="${esc(name)}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}><span>${esc(label)}</span></label>`;
}

/** One chip: a pressed/unpressed filter, with a count when it has one. `label` is text; `value` lands on `data-drpg-chip`. */
export function chip({ label, pressed = false, count = null, disabled = false, value = null } = {}) {
    return `<button type="button" class="drpg-chip" aria-pressed="${Boolean(pressed)}"${value === null ? "" : ` data-drpg-chip="${esc(value)}"`}${disabled ? " disabled" : ""}>`
        + `${esc(label)}${count === null || count === undefined ? "" : `<b>${esc(count)}</b>`}</button>`;
}

/** A row of chips, a toolbar with its name for a screen reader. `list` is `chip`'s options, one each. */
export function chips(list, { label = null } = {}) {
    return `<div class="drpg-chips" role="toolbar"${label ? ` aria-label="${esc(label)}"` : ""}>${list.map(chip).join("")}</div>`;
}

const BOXES = ["info", "warning", "secret"];

/**
 * A box: `info`, `warning` or `secret` (the GMs' words, in D11's colour of the GM and never red: red is the GM's road,
 * a button role). `body` is markup.
 */
export function box(kind, body) {
    if (!BOXES.includes(kind)) throw new Error(`ui-kit: no box "${kind}" (boxes: ${BOXES.join(", ")})`);
    return `<div class="drpg-box" data-drpg-box="${kind}" role="note">${body ?? ""}</div>`;
}

/**
 * A select's empty option, in its key's words ("- nobody -"): one shape for the module's seven bare "-" (E44 C4b; audit
 * S12-49, R1329). `selected` and `disabled` for a placeholder that must be chosen past (a project's statistic).
 */
export function emptyOption(key, { selected = false, disabled = false } = {}) {
    return `<option value=""${disabled ? " disabled" : ""}${selected ? " selected" : ""}>${esc(localize(key))}</option>`;
}

/**
 * A row of modes, the active one pressed (E70's trial console, E47): `modes` `[{ key, label }]`, labels text.
 * `wireKit` presses the one clicked and calls the window's `onMode(key)` when it has one.
 */
export function modeBar(modes, { active = null } = {}) {
    const on = modes.some(m => m.key === active) ? active : modes[0]?.key;
    return `<div class="drpg-mode-bar" role="toolbar">${modes.map(m =>
        `<button type="button" data-drpg-mode="${esc(m.key)}" aria-pressed="${m.key === on}">${esc(m.label)}</button>`).join("")}</div>`;
}

/** Wire every stepper inside `root` (idempotent per stepper): `wireKit`'s, and chrome.mjs `dressChrome`'s on every window. */
export function wireSteppers(root) {
    if (!root?.querySelectorAll) return;
    for (const wrap of root.querySelectorAll(".drpg-kit-stepper")) wireStepper(wrap);
}

/**
 * Wire what the kit drew inside `root`: every stepper, every table's and the body's scroll signal, every mode bar.
 * Answers the function that stops the scroll signals. Idempotent per stepper.
 */
export function wireKit(root, { onMode = null } = {}) {
    if (!root?.querySelectorAll) return () => {};
    wireSteppers(root);
    for (const bar of root.querySelectorAll(".drpg-mode-bar")) {
        if (bar.dataset.drpgKitWired) continue;
        bar.dataset.drpgKitWired = "1";
        bar.addEventListener("click", event => {
            const button = event.target?.closest?.("button[data-drpg-mode]");
            if (!button || !bar.contains(button)) return;
            for (const b of bar.querySelectorAll("button[data-drpg-mode]")) b.setAttribute("aria-pressed", String(b === button));
            try { onMode?.(button.dataset.drpgMode); } catch (err) { error("A kit mode bar's onMode failed", err); }
        });
    }
    const stops = [...root.querySelectorAll(".drpg-kit-body, .drpg-data-table-box")].map(watchScroll);
    return () => stops.forEach(stop => stop());
}

/* ---- the A8 surfaces: the tiles, the launchers, the list of sliders and the Foundry tools frames (E44 C6) --------- */

/*
 * THE A8 SURFACES (E44 C6, 05.11.2026; the 11.10 amend A8, E44-20). The room tile and the voice tile (E77, E78), the
 * voice tile's 30 px mini launchers and their states, its list "Who you hear" with a slider a row, the GM's red
 * hexagon, the Foundry tools launcher and its two plain frames were each built by hand in their own file; these
 * builders draw them. Each takes the surface's own classes, id and words as given, so every selector a test, a sheet
 * or a scenario reads stays, and each builds the element its file built before, attribute for attribute, with the
 * same listeners left to the caller: nothing here changes what a surface looks like or does (the amend's "with no
 * change of look or behaviour"; E44 C6's reading of every surface's DOM and computed style before and after). They
 * build with `createElement` and `textContent`, never markup: room-tile.mjs, voice-tile.mjs and foundry-windows.mjs
 * write none (R503, R512). Their rules are components.css's section "The A8 surfaces". `builtBy(el)` names the
 * builder that made an element (R1332); it is kept beside the element, not on it, so the DOM is the one it was.
 */

/** The builder each element was made by (`builtBy`). */
const builtByKit = new WeakMap();
const madeBy = (el, name) => { builtByKit.set(el, name); return el; };

/** Which of this file's DOM builders made `el` ("tile", "launcher", "launcher-mini", "glyph", "sliderList", "slider", "frame"), or null. */
export function builtBy(el) {
    return (el && builtByKit.get(el)) ?? null;
}

/**
 * A tile of the screen's corner (the room tile, the voice tile): a `section` named for a screen reader, in the page's
 * language. `id` when the tile has one of its own; `data` its first data attributes (the voice tile's `state`).
 */
export function tile({ id = null, className, label, data = {} } = {}) {
    const el = document.createElement("section");
    if (id) el.id = id;
    // Its language, the page's (E66 C3, C1's `lang` on the module's containers); the words inside it inherit it.
    markLanguage(el);
    el.className = className;
    for (const [key, value] of Object.entries(data)) el.dataset[key] = value;
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", label);
    return madeBy(el, "tile");
}

/** One of the module's pixel glyphs (tools/pixel-icons.py), masked in the current colour and never read aloud. */
export function pixelGlyph(name) {
    const icon = document.createElement("i");
    icon.className = "drpg-pxi";
    icon.style.setProperty("--drpg-px-mask", `var(--drpg-px-${name})`);
    icon.setAttribute("aria-hidden", "true");
    icon.inert = true;
    return madeBy(icon, "glyph");
}

/**
 * The states a mini launcher is drawn in (E78 C3; the A8 design's): held by the module (grey), the GM's lock, no
 * connection, muted, push to talk - each a class of the button, at most one at a time (`launcherState`).
 */
export const LAUNCH_STATES = Object.freeze({ held: "is-held", gmBlock: "is-gm-blocked", offline: "is-offline", muted: "is-muted", ptt: "is-ptt" });

/** Draw `button` in `state` (a key of LAUNCH_STATES), every other state's class taken off; any other state draws none. */
export function launcherState(button, state) {
    for (const [name, cls] of Object.entries(LAUNCH_STATES)) button.classList.toggle(cls, state === name);
    return button;
}

/**
 * A launcher: a button of the corner. `mini` is the voice tile's 30 px hexagon of the corner's family (Q6): class
 * `drpg-launch-mini` before `className`, a pixel glyph (`glyph`, its name) and Foundry's tooltip on
 * `data-tooltip-text`. Otherwise a corner button of its own `id` (the GM's hexagon, Foundry tools): `cluster` marks it
 * as one of glass.mjs's cluster, `pressed` gives it `aria-pressed`, `icon` is the classes of its face (`""`: a face with
 * no class, which pixel-icons.css leaves alone - R512) and its tooltip is `data-tooltip`; `lang` gives it the page's
 * language. A `label` names it for a screen reader and is its tooltip; a caller that writes both itself (OBJECTION!,
 * hud.mjs) leaves it out.
 */
export function launcher({ id = null, className = "", label = null, mini = false, glyph = null, icon = "", cluster = false, pressed = null, lang = false } = {}) {
    const button = document.createElement("button");
    if (id) button.id = id;
    if (lang) markLanguage(button);
    if (mini || className) button.className = mini ? ["drpg-launch-mini", className].filter(Boolean).join(" ") : className;
    button.type = "button";
    if (cluster) button.dataset.drpgCluster = "";
    if (label !== null) {
        button.setAttribute("aria-label", label);
        button.dataset[mini ? "tooltipText" : "tooltip"] = label;
    }
    if (pressed !== null) button.setAttribute("aria-pressed", String(pressed));
    if (mini) {
        if (glyph) button.append(pixelGlyph(glyph));
    } else {
        const face = document.createElement("i");
        if (icon) face.className = icon;
        face.setAttribute("inert", "");
        button.append(face);
    }
    return madeBy(button, mini ? "launcher-mini" : "launcher");
}

/**
 * A list of sliders in a window of its own (the voice tile's "Who you hear", E78 C5): a `section` of `className`, `id`,
 * the page's language, hidden until it is opened, a dialog labelled by its title (`h2` of `titleClass`), then `parts`
 * (the caller's own lines and buttons) and the rows' list (`ul` of `rowsClass`), which the caller fills. Every class is
 * the caller's, written out where it is passed, so R2 finds the class a sheet styles in the file that draws it.
 */
export function sliderList({ id, className, titleClass, rowsClass, title, parts = [] } = {}) {
    const list = document.createElement("section");
    list.className = className;
    list.id = id;
    // Its language, the page's: the list stands in the body, not inside its tile (E66 fix r1 F1).
    markLanguage(list);
    list.hidden = true;
    list.setAttribute("role", "dialog");
    const head = document.createElement("h2");
    head.className = titleClass;
    head.textContent = title;
    head.id = `${list.id}-title`;
    list.setAttribute("aria-labelledby", head.id);
    const rows = document.createElement("ul");
    rows.className = rowsClass;
    list.append(head, ...parts, rows);
    return madeBy(list, "sliderList");
}

/** A row's slider: a range input of `className`, from `min` to `max` by `step`. */
export function slider({ className, min = 0, max = 1, step = 1 } = {}) {
    const input = document.createElement("input");
    Object.assign(input, { type: "range", className, min: String(min), max: String(max), step: String(step) });
    return madeBy(input, "slider");
}

/**
 * A plain frame for a node of somebody else's (foundry-windows.mjs: Foundry's sidebar and scene controls, E77 C5): a
 * `section` of `classes.frame` and `id` named by `title`, `data` its data attributes, a header (`classes.head`, in the
 * page's language - its title and close button; not the frame, whose body holds Foundry's own words in Foundry's
 * language: E66 fix r1 F1) with the title (`h2`, `classes.title`) and a close button (`classes.close`) named
 * `closeLabel`, and the body (`classes.body`). The classes are the caller's, written out (R2, as `sliderList`'s).
 * Answers `{ frame, head, body, close }`; the caller hides, places and wires it.
 */
export function frame({ id, classes, title, closeLabel, data = {} } = {}) {
    const el = document.createElement("section");
    el.id = id;
    el.className = classes.frame;
    for (const [key, value] of Object.entries(data)) el.dataset[key] = value;
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", title);
    const head = document.createElement("header");
    head.className = classes.head;
    markLanguage(head);
    const name = document.createElement("h2");
    name.className = classes.title;
    name.textContent = title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = classes.close;
    close.setAttribute("aria-label", closeLabel);
    const mark = document.createElement("i");
    mark.className = "fa-solid fa-xmark";
    mark.setAttribute("inert", "");
    close.append(mark);
    head.append(name, close);
    const body = document.createElement("div");
    body.className = classes.body;
    el.append(head, body);
    return { frame: madeBy(el, "frame"), head, body, close };
}

/* ---- the frame -------------------------------------------------------------------------------------------------- */

/** The root classes of every kit window, beside its own `drpg-window-*`. */
export const KIT_CLASSES = Object.freeze(["drpg-ui", "drpg-panel"]);

/**
 * A DialogV2 on the kit's frame; answers what `DialogV2.wait` answers. The root carries `drpg-ui` and `drpg-panel`;
 * components.css holds it to the screen's height less 8 px a side, the body (`.drpg-kit-body`) scrolls and the tab
 * bar and the footer do not. `body` is markup; `tabs` is `{ sections, active, buttons, always, onSwitch }` (kitTabs
 * and wireKitTabs), drawn above the body that scrolls; `footer` is `footerButtons`'s; `live` is keepLive's options,
 * started on the first render; `render(event, dialog)` runs after the kit has dressed the window. Every other option
 * goes to DialogV2 as given (`position`, `window`, `form`, `submit`, `close`, `rejectClose`).
 */
export function drpgWindow({ id = null, classes = [], title = "", body = "", tabs = null, footer = {}, live = null, render = null, modal = false, onMode = null, ...rest } = {}) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const list = footerButtons(footer);
    const open = tabs ? openKey(tabs.sections, tabs.active) : null;
    const markup = (tabs ? tabNav(tabs.sections, open) : "")
        + `<div class="drpg-kit-body">${body}${tabs ? tabPanes(tabs.sections, open) : ""}</div>`;
    const config = {
        ...rest,
        classes: [...classes, ...KIT_CLASSES],
        window: { title, resizable: false, ...rest.window },
        position: { height: "auto", ...rest.position },
        modal,
        content: dialogContent(markup),
        buttons: dialogButtons(list),
        render: (event, dialog) => {
            // Once: a Foundry that hands this callback every render would wire the window twice.
            if (dressed.has(dialog)) return;
            dressed.add(dialog);
            const root = dialog?.element;
            try {
                dressFrame(root, list, tabs, onMode);
                // A later render of the same window draws Foundry's footer again: it is dressed again.
                dialog.addEventListener?.("render", () => dressFrame(dialog.element, list, tabs, onMode));
            } catch (err) {
                error("A kit window could not be dressed", err);
            }
            try { render?.(event, dialog); } catch (err) { error("A kit window's own render hook failed", err); }
            if (live) keepLive(dialog, live);
        }
    };
    if (id) config.id = id;
    return DialogV2.wait(config);
}

/** The frame on a drawn window: its footer on the contract, its tabs wired and fitted, its controls wired. */
function dressFrame(root, list, tabs, onMode) {
    if (!root) return;
    for (const c of KIT_CLASSES) root.classList.add(c);
    dressFooter(root, list);
    // The kit draws this frame, so the fit may widen the window (`win`).
    if (tabs) wireKitTabs(root, { buttons: tabs.buttons ?? null, always: tabs.always ?? [], onSwitch: tabs.onSwitch ?? null, win: root });
    wireKit(root, { onMode });
}

/** The kit windows already dressed on their first render. */
const dressed = new WeakSet();

let DrpgAppClass = null;

/**
 * The ApplicationV2 class on the kit's frame (`DrpgApp()` makes it on first use: `foundry.applications.api` is not
 * there when tier 0 imports this file). A subclass draws its own body; the frame gives the root the kit's classes,
 * marks the one region that scrolls (`options.scrollRegion`, a selector inside the window: `.drpg-kit-body` on it,
 * the scroll signal wired) and wires the kit's controls on every render. Its footer, when it has one, is
 * `footerMarkup`'s - the same order and groups as a DialogV2's. A window whose region is drawn again under it
 * (keepLive swaps the element) calls `_dressKit()` after the swap, so the new region is marked and watched.
 */
export function DrpgApp() {
    DrpgAppClass ??= class DrpgApplication extends foundry.applications.api.ApplicationV2 {
        static DEFAULT_OPTIONS = { classes: [...KIT_CLASSES], window: { resizable: false }, scrollRegion: null };

        _onRender(context, options) {
            super._onRender?.(context, options);
            this._dressKit();
        }

        _dressKit() {
            const root = this.element;
            if (!root) return;
            for (const c of KIT_CLASSES) root.classList.add(c);
            const region = this.options.scrollRegion ? root.querySelector(this.options.scrollRegion) : null;
            region?.classList.add("drpg-kit-body");
            this._kitStop?.();
            this._kitStop = wireKit(root);
        }

        _onClose(options) {
            this._kitStop?.();
            this._kitStop = null;
            super._onClose?.(options);
        }
    };
    return DrpgAppClass;
}
