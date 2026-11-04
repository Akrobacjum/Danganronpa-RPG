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
 *   kitTabs, formGrid, dataTable, helpText, stepper, readStepper, toggle, chip, chips, box, emptyOption, modeBar
 *   BUTTON_ROLES                  primary, secondary, close, cancel, destructive, gmRoute
 *
 * THE FOOTER CONTRACT (the owner approved it on the pilot, 04.11.2026). The closing word, the secondary buttons and the
 * destructive ones stand on the left, in that order; the primary on the right, last. One word closes a window: Close
 * when nothing is left to answer, Cancel when a question is withdrawn - the role's own key, never a caller's label.
 * The primary is the default (autofocus); a role whose `mayDefault` is false (destructive) never is, and a footer that
 * names one as its default throws. ENTER IS THE FIRST SUBMIT BUTTON IN TREE ORDER, not the focused or the default one,
 * when focus is in a field (HTML's implicit submission; utils.mjs `wirePanelTabs` measured it on 14.365, and the tier-2
 * tests "Enter in the verdict window executes nobody" and E44-T5 press it as a browser does). So the footer is two
 * groups with the right one FIRST in the tree - the primary is the first submit button - and components.css puts the
 * left one first on the screen (`order`). A keyboard's Tab therefore reaches the primary before the left group: the
 * price of Enter meaning the primary, and the same order the default button's autofocus starts from.
 *
 * WHAT IS NOT HERE. A window's own layout (D31: E46 and E47 build each from its approved card), a button's face (the
 * panel's and the glass's button rules stay until E22: a role keeps today's face class, `face`), and the number
 * fields' dressing in chrome.mjs, which C4b replaces with `stepper` (until then the kit's stepper wears
 * `data-drpg-chrome`, so chrome.mjs leaves it alone, and keeps a copy of chrome.mjs's step and message rules).
 *
 * Imports utils.mjs and live.mjs only; nothing in the module imports this file before E44 C4 (the suite does), and
 * none of utils.mjs, live.mjs or config.mjs may (R161).
 */

import { esc, error, wholeNumber, dialogContent } from "./utils.mjs";
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
 * A footer's buttons in the kit's order, each `{ role, action, label, callback, icon, disabled, default }`, from
 * `{ primary, secondary: [], destructive: [], gmRoute: [], close, default }`. `close` is "close", "cancel", or
 * `{ role: "close" | "cancel", action, callback }`; its label is the role's word whatever the caller wrote. The tree
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
        closing = [{ callback: spec.callback, icon: spec.icon, action: spec.action ?? role, role, label: localize(BUTTON_ROLES[role].word) }];
    }
    const right = [...one("primary", footer.primary), ...many("gmRoute", footer.gmRoute)];
    const left = [...closing, ...many("secondary", footer.secondary), ...many("destructive", footer.destructive)];
    const all = [...right, ...left];
    for (const b of all) if (!b.action) throw new Error(`ui-kit: a ${b.role} button with no action`);
    const named = footer.default ?? (right[0] ?? closing[0])?.action ?? null;
    const chosen = all.find(b => b.action === named) ?? null;
    if (footer.default && !chosen) throw new Error(`ui-kit: the footer's default "${footer.default}" is none of its buttons`);
    if (chosen && !BUTTON_ROLES[chosen.role].mayDefault) throw new Error(`ui-kit: a ${chosen.role} button may never be a window's default ("${chosen.action}")`);
    return all.map(b => ({ ...b, default: b === chosen }));
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
    const side = s => list.filter(b => BUTTON_ROLES[b.role].side === s).map(button).join("");
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
        (role.side === "right" ? right : left).append(el);
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
 * Switch a kit tab bar's panes, and the footer with it (`wirePanelTabs`'s rule, measured there: a hidden button still
 * answers Enter, so a button another tab owns is hidden AND disabled). `buttons` maps a tab's key to the footer
 * actions it shows, `always` lists those every tab shows; without `buttons` the footer does not move. The default of
 * the shown buttons is the primary when it shows, else the first that may be a default. `onSwitch(key)` runs after a
 * tab is shown (a window that loads a pane: the handbooks' book, the messenger's note).
 */
export function wireKitTabs(root, { buttons = null, always = [], onSwitch = null } = {}) {
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
        for (const b of footer.querySelectorAll("button[data-action]")) {
            const mine = allowed.has(b.dataset.action);
            b.hidden = !mine;
            b.disabled = !mine;
            b.removeAttribute("autofocus");
            b.classList.remove("default");
        }
        const shown = pressable(footer);
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
    return { show, nav };
}

/**
 * Run `measure` with each pane shown in turn, by the same `hidden` the tabs switch, and put every pane back as it
 * was (`fitWindowToTabs`'s measuring, for the kit's markup). Answers what each call answered, by key.
 */
export function eachPane(root, measure) {
    const panes = [...(root?.querySelectorAll?.("[data-drpg-pane]") ?? [])];
    const was = panes.map(p => p.hidden);
    const out = {};
    try {
        for (const shown of panes) {
            for (const p of panes) p.hidden = p !== shown;
            out[shown.dataset.drpgPane] = measure(shown);
        }
    } finally {
        panes.forEach((p, i) => { p.hidden = was[i]; });
    }
    return out;
}

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

/** The screen reader's line of a scroll signal: visually hidden, shown to a reader while more lies out of view. */
const scrollNote = () => `<span class="drpg-kit-sr" data-drpg-scroll-note hidden>${esc(localize("DRPG.Kit.scrollMore"))}</span>`;

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

/** Fine print: one line of help in the kit's fine-print ink (I1, the owner's choice on 04.11.2026). */
export function helpText(key, data = null) {
    return `<p class="drpg-help">${esc(data ? game.i18n.format(key, data) : localize(key))}</p>`;
}

/* The words of a stepper's - and +: chrome.mjs `stepLabels`'s rule on the same keys (R1521), until C4b moves that
   function here and chrome.mjs dresses no number field. */
function stepWords(step) {
    const size = Number(step);
    if (!Number.isFinite(size) || size <= 0 || size === 1) return { down: localize("DRPG.Look.stepDown"), up: localize("DRPG.Look.stepUp") };
    return { down: game.i18n.format("DRPG.Look.stepDownBy", { n: size }), up: game.i18n.format("DRPG.Look.stepUpBy", { n: size }) };
}

let stepperIds = 0;

/**
 * The one number control (E44; C4b moves the module's twelve number fields onto it): the input with its - and + and
 * the line under it that says a value is out of range, all in the markup - no dressing after the draw. The input
 * keeps `name`, `min`, `max` and `step` as given, so a form reads what it read before; `readStepper` reads it through
 * `wholeNumber`. `label` is text; the label points at the input by id, never at the minus (the 21.09 fault: a label
 * wrapping its control labels the first labelable element in it, and a button is one).
 */
export function stepper({ name, value = "", min = null, max = null, step = 1, label = null, id = null } = {}) {
    const inputId = id ?? `drpg-kit-step-${++stepperIds}`;
    const words = stepWords(step);
    const attr = (k, v) => (v === null || v === undefined || v === "" ? "" : ` ${k}="${esc(v)}"`);
    const field = `<span class="drpg-kit-stepper">`
        + `<button type="button" class="drpg-step drpg-step-minus" data-drpg-step="-1" aria-label="${esc(words.down)}" data-tooltip="${esc(words.down)}">-</button>`
        + `<input type="number" id="${esc(inputId)}" data-drpg-chrome="step"${attr("name", name)}${attr("value", value)}${attr("min", min)}${attr("max", max)}${attr("step", step)}>`
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

/* One step of a stepper and its message line: chrome.mjs `step` and `dressNumberField`'s check, the same rules. */
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

/** A select's empty option, in its key's words ("- nobody -"): one shape for the module's five bare "-" (C4b). */
export function emptyOption(key) {
    return `<option value="">${esc(localize(key))}</option>`;
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

/**
 * Wire what the kit drew inside `root`: every stepper, every table's and the body's scroll signal, every mode bar.
 * Answers the function that stops the scroll signals. Idempotent per stepper.
 */
export function wireKit(root, { onMode = null } = {}) {
    if (!root?.querySelectorAll) return () => {};
    for (const wrap of root.querySelectorAll(".drpg-kit-stepper")) wireStepper(wrap);
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
    if (tabs) {
        wireKitTabs(root, { buttons: tabs.buttons ?? null, always: tabs.always ?? [], onSwitch: tabs.onSwitch ?? null });
        const nav = root.querySelector("nav.drpg-tabs");
        // After the layout: a bar measured before it was laid out reads 0 and fits nothing. And again once the tab's own
        // face has loaded: a face is fetched only when text first asks for it, so `document.fonts` read "loaded" while
        // the first measure was taken in the fallback face, and Legacy's pixel face then left "Description" cut at
        // 390x844 on a bar fitted to one line at 13 px (the kit gallery, 04.11.2026; measured again with the face in:
        // two rows of two).
        if (nav) {
            const fit = () => fitKitTabs(nav, { win: root });
            requestAnimationFrame(() => {
                fit();
                const tab = nav.querySelector('button[role="tab"]');
                const cs = tab ? getComputedStyle(tab) : null;
                root.ownerDocument?.fonts?.load?.(`${cs?.fontSize ?? "13px"} ${cs?.fontFamily ?? "sans-serif"}`)
                    .then(() => requestAnimationFrame(fit), () => null);
            });
        }
    }
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
 * `footerMarkup`'s - the same order and groups as a DialogV2's.
 */
export function DrpgApp() {
    DrpgAppClass ??= class DrpgApplication extends foundry.applications.api.ApplicationV2 {
        static DEFAULT_OPTIONS = { classes: [...KIT_CLASSES], window: { resizable: false }, scrollRegion: null };

        _onRender(context, options) {
            super._onRender?.(context, options);
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
