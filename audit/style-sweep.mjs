/*
 * The style sweep: the computed style of the kit's surfaces in Chromium, held to audit/style-baseline.json (E44 C1d,
 * 04.11.2026; audit S17-35).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   node audit/style-sweep.mjs            (from the repository's root) every page, size and theme against the baseline
 *   node audit/style-sweep.mjs --accept notices-window --accept dialog-footer
 *                                         the same, with the rows of the surfaces named rewritten from this run; a page
 *                                         named (`--accept kit-gallery`) has its rows added when the baseline has none
 *   node audit/style-sweep.mjs --write    the whole baseline written from this run (a new baseline, read before it is committed)
 *   node audit/style-sweep.mjs --shots <dir>   also a screenshot of every page at each size and theme, into <dir>
 *   node audit/style-sweep.mjs --only rooms-bedrooms   one page (repeatable); the baseline's other pages are not read
 *   node audit/style-sweep.mjs --selected THE SELECTED ROW (E68 C12), below, instead of the style comparison
 *   node audit/style-sweep.mjs --fit      THE FIT PASS (E21 C1c), below, instead of the style comparison; with --only
 *                                         the pages named, with --shots <dir> a screenshot of each at 1366x768
 *
 * WHY. A rule of the window kit can lose to an old rule carrying `!important` while every headless test passes - the
 * dead `.drpg-turning` fix's class of error, and the E44 plan's risk. The cascade test (tests-kit.mjs `styleCascade`)
 * sees `!important`, specificity and order but not `@media`, `@container`, `@layer` or a resolved `var()`; this reads
 * what Chromium computes. For each page - every window probe 08 captured (audit/windows/manifest.json), one a page of
 * audit/style-harness.html, the same page's kit gallery (`?kit=1`, E44 C3a), the sheet's parts (`?sheet=parts`, E24 C0: at
 * 1920x1080 and 1366x768 only, its page's `sizes`), and glass-harness.html's own page for a GM (with its GM Panel and messenger windows,
 * `?gmp=1&msgr=1`) and for a player - at 1920x1080, 1366x768, 1024x768 and 390x844, in Stained Glass and Monokuma
 * Legacy, it runs scripts/style-snapshot.mjs `styleSnapshot` and keeps every surface found. A property that differs
 * from the baseline prints the page, the surface, the size, the theme, before and after; a surface found in one and
 * not the other prints too. Exit 1 on any difference not accepted, and on a control that does not read as a fault.
 *
 * THE CONTROLS, first (the stackShapes lesson in CLAUDE.md: a comparison that cannot see a fault measures nothing).
 * On the first page at the first size and theme, before anything is compared:
 *   restyled   a rule injected that sets the first found surface's `color` and `padding-top` - the snapshot must
 *              read both as changed against the same page's own reading a moment before;
 *   removed    that surface's element taken out of the page - it must read `found: false`;
 *   unchanged  the page read twice with nothing done - no difference (a comparison that always differs proves as
 *              little as one that never does).
 * Then the page is loaded again, clean, and the sweep proper runs.
 *
 * THE BASELINE stores the property names once (`props`) and every value once (`values`, a table of strings); a page's
 * reading at a theme and size is `pages["<page>|<theme>|<w>x<h>"]` = `{ surface: [index into values, one a prop] }`,
 * only the surfaces found. Written by `--write` or `--accept` from a run, never by hand.
 *
 * THE FIT PASS (`--fit`; E21 C1c, E21-03: "every window and tab fits on the screen" as a reading, never a headless one -
 * jsdom lays nothing out). Pages: every window of audit/windows/manifest.json (probe 08's, per tab where a window has
 * tabs, the player's action windows among them), the kit gallery, the sheet stand-in (`?sheet=1`) and its parts (`?sheet=parts`,
 * E24 C0: the same frame and Stop, the parts inside) and the glass
 * harness's GM and player pages for the A8 frames (Foundry tools and Map tools opened, `toggleFoundryTools`; "Who you
 * hear", `drpgVoiceList`). Sizes: FIT_SIZES - the plan's four, 1920x1080, 1366x768, 1280x800 and 1024x768 - for every
 * page, and 390x844 for every window a player opens and the sheet; both themes. Placement: style-harness.html `?fit=1`
 * puts each window where Foundry puts a new one (centred, its top max(0, (vh - h) / 2): a model of `_updatePosition`,
 * LIVE-E21-01), and in each tab state stands it where its first tab put it, then presses the tab through the kit's own
 * `wireKitTabs`, which repositions it (`drpgFit`). The reading per page, size, theme and state: the window's rectangle
 * in the viewport, its footer's and each shown button's, its tab bar's; the only element that scrolls is `.drpg-kit-body`
 * (or none); a page of STILL (Observe at 1366x768 and above: the doneWhen) scrolls nothing at all; on the sheet stand-in
 * the Stop's rectangle at 1366x768, 1280x800 and 1024x768 (and every size it is read at). A window with no `drpg-ui`
 * root is not on the kit: it reads `outside`, counted and printed as E21's list, never read as fitting (from E21 C6 on,
 * `outside` fails: OUTSIDE_FAILS). THE CONTROLS FIRST (the stackShapes lesson), each must read its fault or the run is
 * red: (a) on the kit gallery's tabbed window at 1366x768, with 2000 px of content planted in its first pane, the frame's
 * `max-height` taken off by an injected rule - "footer below the screen" (and the same window without the rule reads
 * fit: the control's own ground); (b) the body's `overflow: visible` - "a second scroller" or "footer out"; (c) the 2000
 * px planted in its third pane and the tab switched without the kit's code (`drpgFit({ byHand: true })`, the reposition
 * skipped) - the tallest tab reads "footer out" (and through the kit's code, fit); (d) on the sheet stand-in at
 * 1366x768, where the Stop stands in view, the Stop's sticky rule taken off (`position: static`, E21 C5a's rule in
 * danganronpa.css) - "Stop out": its place at the content's foot is below the sheet's box; (i) E47-FB, 3000 px of width
 * planted in the gallery window's first pane - "content wider than its box: kit-body" (the body clips sideways since
 * 1.2.102, so it is no scroller; the harness reads the body's and the footer's width, `wide`). Exit 1 on any failure; a
 * page `outside` is not one before C6.
 *
 * It serves the root itself (`python3 -m http.server` on a free port) or reads `--base http://127.0.0.1:8765`.
 * Playwright finds its Chromium through PLAYWRIGHT_BROWSERS_PATH; `--chromium <executable>` names one. CI installs no
 * browser, so this is run by whoever changes what a surface looks like, and quoted (the E44 stage's rule 3).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const BASELINE = path.join(HERE, "style-baseline.json");
const SIZES = [[1920, 1080], [1366, 768], [1024, 768], [390, 844]];
const THEMES = ["glass", "legacy"];
/* --fit (E21 C1c): the plan's four sizes for every page, and a phone's for every window a player opens and the sheet. */
const FIT_SIZES = [[1920, 1080], [1366, 768], [1280, 800], [1024, 768]];
const FIT_PHONE = [390, 844];
/* Pages that must not scroll at all at 1366x768 and above (the doneWhen: "Observe fits with no scrolling"); every action
   window probe 08 captures since E68 C12 (one layout for every action, the owner's Q1 and Q4 of round M). */
const STILL = ["action-observe", "action-search", "action-analyze", "action-tamper", "action-rest", "action-project"];
/* From E21 C6 on, a page not on the kit fails; before it, it is E21's list (STAGE.md "The measure"). */
const OUTSIDE_FAILS = false;

const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : [])).filter(Boolean);
const WRITE = argv.includes("--write");
const FIT = argv.includes("--fit");
const SELECTED = argv.includes("--selected");
const ACCEPT = new Set(many("--accept"));
const ONLY = new Set(many("--only"));
const SHOTS = opt("--shots");
const CHROMIUM = opt("--chromium");
let BASE = opt("--base");

const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");

const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/** The pages: every captured window, and the glass harness's GM and player pages. */
function pages() {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "audit", "windows", "manifest.json"), "utf8"));
    const out = manifest.windows.filter(w => w.captured).map(w => ({
        id: w.id, url: `/audit/style-harness.html?w=${encodeURIComponent(w.id)}${w.client === "gm" ? "" : "&role=player"}`
    }));
    out.push({ id: "kit-gallery", url: "/audit/style-harness.html?kit=1" });
    /* The sheet's parts (E24 C0: style-harness.html `?sheet=parts`), at the two desk sizes the stage reads a sheet at. */
    out.push({ id: "sheet-parts", url: "/audit/style-harness.html?sheet=parts", sizes: ["1920x1080", "1366x768"] });
    out.push({ id: "glass-gm", url: "/audit/glass-harness.html?gmp=1&msgr=1&still=1" });
    out.push({ id: "glass-player", url: "/audit/glass-harness.html?role=player&still=1" });
    return ONLY.size ? out.filter(p => ONLY.has(p.id)) : out;
}

const withTheme = (u, theme) => (theme === "legacy" ? `${u}${u.includes("?") ? "&" : "?"}theme=legacy` : u);

async function snap(page) {
    return page.evaluate(async () => {
        const { styleSnapshot } = await import("/scripts/style-snapshot.mjs");
        return styleSnapshot();
    });
}

async function load(page, u) {
    await page.goto(`${BASE}${u}`, { waitUntil: "load" });
    // The kit gallery draws in a module script (style-harness.html `?kit=1`), and a captured window's tab bar is
    // fitted in one (E44 C4a): each says when it is done.
    await page.waitForFunction(() => !globalThis.document.body?.hasAttribute("data-drpg-kit-pending"), null, { timeout: 15000 });
    await page.evaluate(() => globalThis.document.fonts?.ready);
    await page.waitForTimeout(300);
}

/** The surfaces found, as { id: props }. */
const found = s => Object.fromEntries(Object.entries(s.surfaces).filter(([, v]) => v.found).map(([id, v]) => [id, v.props]));

function differences(before, after) {
    const out = [];
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!(id in after)) { out.push({ id, what: "found before, not now" }); continue; }
        if (!(id in before)) { out.push({ id, what: "found now, not before" }); continue; }
        for (const [prop, value] of Object.entries(after[id])) if (before[id][prop] !== value) out.push({ id, what: `${prop}: ${before[id][prop]} -> ${value}` });
    }
    return out;
}

async function controls(page, first) {
    const problems = [];
    await load(page, first.url);
    const a = found(await snap(page)), b = found(await snap(page));
    if (differences(a, b).length) problems.push(`unchanged: the same page read twice differs (${differences(a, b).slice(0, 3).map(d => `${d.id} ${d.what}`).join("; ")})`);
    const target = Object.keys(a)[0];
    if (!target) return [`no surface found on ${first.id} - the controls have nothing to plant on`];
    const { STYLE_SURFACES } = await import(url.pathToFileURL(path.join(REPO, "scripts", "style-snapshot.mjs")).href);
    const selector = STYLE_SURFACES.find(s => s.id === target).selector;
    /* Planted above any rule of the sheets (E24 C0): the surface's selector inside `:is()` and an id no element has, so an
       `!important` of the module's with more classes cannot outvote the plant - on the sheet's parts the first surface
       is the bar's number field, which the module colours with three classes and `!important`, and a plant of the bare
       selector read as unchanged. */
    await page.addStyleTag({ content: `:is(${selector}):not(#drpg-style-control) { color: rgb(1, 2, 3) !important; padding-top: 37px !important; }` });
    const c = found(await snap(page));
    const seen = differences(a, c).filter(d => d.id === target).map(d => d.what.split(":")[0]);
    if (!seen.includes("color") || !seen.includes("padding-top")) problems.push(`restyled: ${target}'s injected color and padding-top read as ${JSON.stringify(seen)}, not as both changed`);
    await page.evaluate(sel => { for (const el of globalThis.document.querySelectorAll(sel)) el.remove(); }, selector);
    const d = await snap(page);
    if (d.surfaces[target]?.found !== false) problems.push(`removed: ${target} taken out of the page still reads found`);
    console.log(`style-sweep: controls on ${first.id}, surface ${target}: unchanged ${differences(a, b).length} difference(s), restyled read ${JSON.stringify(seen)}, removed read found: ${d.surfaces[target]?.found}`);
    return problems;
}

function pack(readings, props) {
    const values = [], index = new Map();
    const at = v => { if (!index.has(v)) { index.set(v, values.length); values.push(v); } return index.get(v); };
    const out = {};
    for (const [key, surfaces] of Object.entries(readings)) out[key] = Object.fromEntries(Object.entries(surfaces).map(([id, p]) => [id, props.map(name => at(p[name] ?? ""))]));
    return { values, pages: out };
}

function unpack(base) {
    const out = {};
    for (const [key, surfaces] of Object.entries(base.pages ?? {})) {
        out[key] = Object.fromEntries(Object.entries(surfaces).map(([id, refs]) => [id, Object.fromEntries(base.props.map((name, i) => [name, base.values[refs[i]]]))]));
    }
    return out;
}

/** The fit pass's pages: every captured window (a player's at a phone's size too), the kit gallery, the sheet stand-in, the
    glass harness's two pages (their A8 frames). */
function fitPages() {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "audit", "windows", "manifest.json"), "utf8"));
    const out = manifest.windows.filter(w => w.captured).map(w => ({
        id: w.id, phone: w.client !== "gm", url: `/audit/style-harness.html?w=${encodeURIComponent(w.id)}&fit=1${w.client === "gm" ? "" : "&role=player"}`
    }));
    out.push({ id: "kit-gallery", phone: false, url: "/audit/style-harness.html?kit=1&fit=1" });
    out.push({ id: "sheet", phone: true, sheet: true, url: "/audit/style-harness.html?sheet=1&fit=1&role=player" });
    out.push({ id: "sheet-parts", phone: true, sheet: true, url: "/audit/style-harness.html?sheet=parts&fit=1&role=player" });
    out.push({ id: "glass-gm", phone: false, a8: true, url: "/audit/glass-harness.html?still=1" });
    out.push({ id: "glass-player", phone: true, a8: true, url: "/audit/glass-harness.html?role=player&still=1" });
    return ONLY.size ? out.filter(p => ONLY.has(p.id)) : out;
}

/* A scroller a gallery card draws on purpose (E22 fix G1, 07.11.2026; STATUS Open 7, the end review's GOAL M2): the kit
   gallery's "dataTable, more rows than the window" card gives its table box an inline `max-height: 220px; overflow:
   auto` (style-harness.html), to show on E44's demo page the table's own scroll - the sticky head and the scroll signal
   (ui-kit.mjs `watchScroll` watches `.drpg-data-table-box`). `dataTable` writes no height, and no rule of the sheets
   gives the box one (components.css: `position: relative` only), so no window of the module scrolls its table on its
   own: on that card the box is the demo's, not a second region of a window, and it read "a second scroller" at every
   desk size. Skipped there only, by the card's id and the box's name; every other window still fails on it. */
const DEMO_SCROLLERS = { "kit-table-scroll": ["div.drpg-data-table-box"] };

/** What is wrong with one window's state, as words; [] when it fits. */
function misfits(win, state, still) {
    const out = [];
    if (!state.window) out.push("window out");
    if (state.footer === false) out.push("footer out");
    if (state.buttonsOut.length) out.push(`button(s) out: ${state.buttonsOut.join(", ")}`);
    if (state.shrunk?.length) out.push(`checkbox shrunk: ${state.shrunk.join(", ")}`);
    if (state.labelsOff?.length) out.push(`label off its field: ${state.labelsOff.join(", ")}`);
    if (state.tabs === false) out.push("tab bar out");
    const demo = DEMO_SCROLLERS[win?.window] ?? [];
    const others = state.scrollers.filter(s => s !== "kit-body" && !demo.includes(s));
    if (others.length) out.push(`a second scroller: ${others.join(", ")}`);
    if (state.cut) out.push("content cut: the body is taller than its box and nothing scrolls it");
    // E47-FB: a body or footer wider than its box, cut sideways (the 1.2.102 clip) or scrolled (style-harness.html `wide`)
    if (state.wide?.length) out.push(`content wider than its box: ${state.wide.join(", ")}`);
    if (still && state.scrollers.length) out.push(`scrolls (${state.scrollers.join(", ")}) where it must not`);
    return out;
}

/* The A8 frames on the glass harness's pages: Foundry tools and Map tools opened on the GM's (foundry-windows.mjs
   `toggleFoundryTools`), "Who you hear" on both (`drpgVoiceList`, which answers what it found wrong, `why`). */
async function readA8(page) {
    return page.evaluate(async () => {
        const frame = () => new Promise(r => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)));
        const inView = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= globalThis.innerWidth + 0.5 && r.bottom <= globalThis.innerHeight + 0.5; };
        const out = {};
        const fw = globalThis.__windows;
        if (fw?.toggleFoundryTools && globalThis.document.getElementById("drpg-win-ftools")) {
            fw.toggleFoundryTools(true);
            await frame();
            await new Promise(r => setTimeout(r, 300));
            for (const [key, id] of [["foundry-tools", "drpg-win-ftools"], ["map-tools", "drpg-win-maptools"]]) {
                const el = globalThis.document.getElementById(id);
                out[key] = el && !el.hidden ? (inView(el) ? [] : ["window out"]) : ["not opened"];
            }
            fw.toggleFoundryTools(false);
            await frame();
        }
        if (typeof globalThis.drpgVoiceList === "function") {
            const v = await globalThis.drpgVoiceList();
            out["who-you-hear"] = v?.box ? (v.why ?? []) : ["not opened", ...(v?.why ?? [])];
        }
        return out;
    });
}

async function fitPass(browser) {
    const problems = [], outside = new Set();
    let fits = 0, failed = 0;
    const list = fitPages();
    if (!list.length) throw new Error("no page to read for --fit");
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    /* The controls first, each on a page of its own, loaded clean. */
    {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        const kit = "/audit/style-harness.html?kit=1&fit=1";
        const tall = async pane => page.evaluate(key => {
            const win = globalThis.document.querySelector('[data-window="kit-tabs"] > .application');
            const p = win?.querySelector(`[data-drpg-pane="${key}"]`);
            if (!p) return false;
            p.insertAdjacentHTML("beforeend", '<div class="drpg-fit-planted" style="height: 2000px"></div>');
            return true;
        }, pane);
        const tabsState = async (opts, tab) => (await page.evaluate(o => globalThis.drpgFit(o), { ...opts, only: "kit-tabs" }))[0]?.states.find(s => s.tab === tab);
        const say = (name, ok, what) => { console.log(`style-sweep: --fit control ${name}: ${what}`); if (!ok) problems.push(`control ${name}: ${what}`); };
        await load(page, kit);
        if (!(await tall("one"))) problems.push("control: the kit gallery has no tabbed window to plant on");
        const ground = await tabsState({}, "one");
        say("ground", ground && !misfits(null, ground, false).length, `2000 px in the first pane, nothing else: ${ground ? misfits(null, ground, false).join("; ") || "fits" : "no reading"}`);
        await page.addStyleTag({ content: "body .application.drpg-ui.drpg-panel:not(.minimized) { max-height: none !important; }" });
        const a = await tabsState({}, "one");
        say("(a) max-height off", a?.footer === false, `reads ${a ? misfits(null, a, false).join("; ") || "fits" : "nothing"}`);
        await load(page, kit);
        await tall("one");
        await page.addStyleTag({ content: ".application.drpg-ui.drpg-panel .drpg-kit-body { overflow: visible !important; }" });
        const b = await tabsState({}, "one");
        const bWords = b ? misfits(null, b, false) : [];
        say("(b) body overflow visible", bWords.some(w => w.startsWith("a second scroller") || w === "footer out" || w.startsWith("content cut")), `reads ${bWords.join("; ") || "fits"}`);
        await load(page, kit);
        await tall("three");
        const cKit = await tabsState({}, "three");
        say("(c) through the kit", cKit && !misfits(null, cKit, false).length, `the tall third tab pressed through wireKitTabs reads ${cKit ? misfits(null, cKit, false).join("; ") || "fits" : "nothing"}`);
        await load(page, kit);
        await tall("three");
        const c = await tabsState({ byHand: true }, "three");
        say("(c) reposition skipped", c?.footer === false, `the tall third tab switched by hand reads ${c ? misfits(null, c, false).join("; ") || "fits" : "nothing"}`);
        /* (i) E47-FB: 3000 px of width planted in the first pane - the body clips it sideways (1.2.102), so no scroller
           reads it; the reading must say "content wider than its box". Its ground is the control "ground" above. */
        await load(page, kit);
        await page.evaluate(() => {
            const p = globalThis.document.querySelector('[data-window="kit-tabs"] > .application [data-drpg-pane="one"]');
            p?.insertAdjacentHTML("beforeend", '<div class="drpg-fit-planted" style="width: 3000px; height: 20px"></div>');
        });
        const i = await tabsState({}, "one");
        const iWords = i ? misfits(null, i, false) : [];
        say("(i) wider than the body", iWords.some(w => w.startsWith("content wider than its box: kit-body")), `3000 px of width in the first pane reads ${iWords.join("; ") || "fits"}`);
        await page.setViewportSize({ width: 1366, height: 768 });
        await load(page, "/audit/style-harness.html?sheet=1&fit=1&role=player");
        const d0 = (await page.evaluate(() => globalThis.drpgFit()))[0];
        say("(d) ground", d0?.stop === true, `the Stop on the sheet stand-in at 1366x768 reads ${d0?.stop ? "in view" : "out"}`);
        // Above the glass's own `position` rule for the Stop (stained-glass.css, 0,4,1 with `!important`).
        await page.addStyleTag({ content: "html body .application.sheet.actor .drpg-safeword-button.drpg-safeword-button { position: static !important; }" });
        const d = (await page.evaluate(() => globalThis.drpgFit()))[0];
        say("(d) Stop's sticky rule off", d?.stop === false, `reads ${d?.stop ? "Stop in view" : "Stop out"}`);
        /* (e)-(h), E47-FA (09.11.2026): what a fit reads inside the window (style-harness.html `cutText`, `shrunk`,
           `labelOff`), each planted on the kit gallery at 1366x768 after its ground reads fit - a footer button moved
           past the window's left edge (inside the screen), a button too narrow for its word, a switch 3 px wide, a
           label moved 30 px under its field. */
        const planted = async (id, css) => {
            await load(page, kit);
            if (css) await page.addStyleTag({ content: css });
            const s = (await page.evaluate(o => globalThis.drpgFit(o), { only: id }))[0]?.states[0];
            return s ? misfits(null, s, false) : ["no reading"];
        };
        const eGround = [...await planted("kit-form-wide", null), ...await planted("kit-controls", null)];
        say("(e)-(h) ground", !eGround.length, `the gallery's form and controls windows read ${eGround.join("; ") || "fits"}`);
        const e = await planted("kit-form-wide", '[data-window="kit-form-wide"] footer.form-footer button { margin-left: -120px !important; }');
        say("(e) button past the window's edge", e.some(w => w.startsWith("button(s) out")), `reads ${e.join("; ") || "fits"}`);
        const f = await planted("kit-form-wide", '[data-window="kit-form-wide"] footer.form-footer button { min-width: 0 !important; max-width: 2.5em !important; width: 2.5em !important; overflow: hidden !important; }');
        say("(f) button cut", f.some(w => w.startsWith("button(s) out")), `reads ${f.join("; ") || "fits"}`);
        const g = await planted("kit-controls", '[data-window="kit-controls"] input[name="t2"] { width: 3px !important; min-width: 0 !important; }');
        say("(g) checkbox shrunk", g.some(w => w.startsWith("checkbox shrunk")), `reads ${g.join("; ") || "fits"}`);
        const h = await planted("kit-form-wide", '[data-window="kit-form-wide"] .drpg-form-label { position: relative !important; top: 30px !important; }');
        say("(h) label off its field", h.some(w => w.startsWith("label off its field")), `reads ${h.join("; ") || "fits"}`);
        await page.close();
    }
    const rows = [];
    for (const theme of THEMES) {
        for (const [w, h] of [...FIT_SIZES, FIT_PHONE]) {
            const phone = w === FIT_PHONE[0] && h === FIT_PHONE[1];
            const page = await browser.newPage({ viewport: { width: w, height: h } });
            for (const p of list) {
                if (phone && !p.phone) continue;
                await load(page, withTheme(p.url, theme));
                const at = `${p.id} ${w}x${h} ${theme}`;
                if (p.a8) {
                    const a8 = await readA8(page);
                    for (const [frame, words] of Object.entries(a8)) {
                        rows.push({ at: `${at} ${frame}`, words });
                        if (words.length) { failed++; problems.push(`${at} ${frame}: ${words.join("; ")}`); } else fits++;
                    }
                    continue;
                }
                const read = await page.evaluate(() => globalThis.drpgFit());
                for (const win of read) {
                    if (p.sheet) {
                        const words = win.stop ? [] : ["Stop out"];
                        rows.push({ at, words });
                        if (words.length) { failed++; problems.push(`${at}: Stop out (the Stop's rectangle is not in the viewport)`); } else fits++;
                        continue;
                    }
                    if (!win.kit) { outside.add(win.window); rows.push({ at: `${at} ${win.window}`, words: ["outside"] }); if (OUTSIDE_FAILS) { failed++; problems.push(`${at}: ${win.window} is not on the kit`); } continue; }
                    const still = STILL.includes(win.window) && w >= 1366;
                    for (const state of win.states) {
                        const words = misfits(win, state, still);
                        rows.push({ at: `${at} ${win.window}${state.tab ? ` [${state.tab}]` : ""}`, words });
                        if (words.length) { failed++; problems.push(`${at} ${win.window}${state.tab ? ` [${state.tab}]` : ""}: ${words.join("; ")}`); } else fits++;
                    }
                }
                if (SHOTS && w === 1366 && h === 768) await page.screenshot({ path: path.join(SHOTS, `fit-${p.id}-${theme}-${w}x${h}.png`) });
            }
            await page.close();
            console.log(`style-sweep: --fit ${w}x${h} ${theme}: read`);
        }
    }
    for (const p of problems) console.log(`style-sweep: ${p}`);
    console.log(`style-sweep: --fit outside the kit (E21's list, ${outside.size}): ${[...outside].sort().join(", ") || "none"}`);
    console.log(`style-sweep: --fit ${rows.length} reading(s) of ${list.length} page(s); ${fits} fit, ${failed} failed, ${rows.filter(r => r.words[0] === "outside").length} outside; ${problems.length ? "RED" : "green"}`);
    return problems.length ? 1 : 0;
}

/*
 * THE SELECTED ROW (`--selected`; E68 C12, 10.11.2026; the owner's Q4 of round M: "keep today's selected look - the brush
 * stroke on the selected row - and correct only the contrast"). On Observe's capture (a player's, 1366x768), in each theme,
 * the first row picked and then the GM's-road row ("specific") picked, it reads what Chromium computes and lays each part
 * on the ground it stands on (the row's own background and its `::before` brush at their opacity, over the first opaque
 * ground under the row): the title and the line of explanation (text, AA 4.5:1), the icon (a graphic, 3:1) and the
 * control's mark against the control's own box (3:1; a control the browser or Foundry draws, `appearance` not `none`,
 * reads "native mark", the grey square with a black corner the owner saw in Legacy at the table). Then the selected row,
 * a row under the pointer, a row with the keyboard's focus and a row at rest must each look different (their background,
 * edges, outline and brush). Exit 1 on any part below its ratio or two states alike. A planted control first: the page's
 * selected text set to its own ground must read 1:1 and red.
 */
async function selectedPass(browser) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const problems = [];
    const read = pick => page.evaluate(async value => {
        const parse = c => {
            const m = String(c).match(/^rgba?\(([^)]+)\)$/), n = String(c).match(/^color\(srgb ([^)]+)\)$/);
            if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
            if (n) { const p = n[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
            return [0, 0, 0, 0];
        };
        const over = (top, under, alpha = 1) => { const a = top[3] * alpha; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
        const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
        const opacityTo = (el, stop) => { let o = 1; for (let e = el; e && e !== stop.parentElement; e = e.parentElement) o *= Number(globalThis.getComputedStyle(e).opacity); return o; };
        const groundUnder = el => {
            const chain = [];
            for (let e = el; e; e = e.parentElement) { chain.push(parse(globalThis.getComputedStyle(e).backgroundColor)); if (chain.at(-1)[3] >= 1) break; }
            let g = chain.at(-1)[3] >= 1 ? chain.pop() : [255, 255, 255, 1];
            while (chain.length) g = over(chain.pop(), g);
            return g;
        };
        const doc = globalThis.document;
        const input = doc.querySelector(`.drpg-choice-list input[value="${value}"]`);
        if (!input) return { error: `no row ${value}` };
        input.checked = true;
        input.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
        // The mark grows and the brush fades in on a transition (`--drpg-t-snap`): read once both have run.
        await new Promise(r => setTimeout(r, 400));
        const row = input.closest(".drpg-choice");
        const brush = globalThis.getComputedStyle(row, "::before");
        let ground = groundUnder(row);
        if (brush.content !== "none") ground = over(parse(brush.backgroundColor), ground, Number(brush.opacity));
        const part = sel => { const el = row.querySelector(sel); return el ? ratio(over(parse(globalThis.getComputedStyle(el).color), ground, opacityTo(el, row)), ground) : null; };
        const cs = globalThis.getComputedStyle(input);
        let mark = "native mark";
        if (cs.appearance === "none") {
            const box = over(parse(cs.backgroundColor), ground);
            const dot = globalThis.getComputedStyle(input, "::before");
            const scaled = /matrix\(0, 0, 0, 0/.test(dot.transform);
            mark = dot.content === "none" || scaled ? "no mark" : ratio(over(parse(dot.backgroundColor), box, Number(dot.opacity)), box);
        }
        // The brush itself (E68 fix round): drawn, opaque, light, and over the row's whole height.
        const rowBox = row.getBoundingClientRect();
        const fill = parse(brush.backgroundColor);
        const drawn = brush.content !== "none" && brush.display !== "none";
        const brushRead = drawn ? { opacity: Number(brush.opacity), alpha: fill[3], light: Math.round(lum(fill) * 100) / 100,
            cover: Math.round(parseFloat(brush.height) / rowBox.height * 100) / 100 } : null;
        return { title: part("strong"), hint: part("small"), icon: part(":scope > i"), mark, brush: brushRead };
    }, pick);
    /* The owner, 10.11.2026, after round M's overview-selected.png: "pozbycie sie pociagniecia pedzla na zaznaczonych
       elementach - to musi zostac". In Stained Glass the picked row keeps 1.2.103's full light brush (`::before`, the
       brush filter): drawn, at full opacity, an opaque fill as light as 1.2.103's (relative luminance, read on c431138a's
       Observe with this pass: the first row's rgb(255, 211, 143) 0.7, the GM's-road row's accent brush 0.29; within
       0.05), over 90% of the row's height or more (c431138a 0.96, 4a027d8f 0.95: the glass row's padding went 6 to 4 px
       in C12, and the brush with it). */
    const BRUSH_1_2_103 = { general: 0.7, specific: 0.29 };
    const brushLow = (b, pick = "general") => (!b ? ["brush not drawn"] : [b.opacity < 0.9 && `brush opacity ${b.opacity}`, b.alpha < 1 && `brush fill alpha ${b.alpha}`,
        Math.abs(b.light - BRUSH_1_2_103[pick]) > 0.05 && `brush fill luminance ${b.light} (1.2.103: ${BRUSH_1_2_103[pick]})`,
        b.cover < 0.9 && `brush covers ${b.cover} of the row`].filter(Boolean));
    const look = () => page.evaluate(() => [...globalThis.document.querySelectorAll(".drpg-choice-list > .drpg-choice")].slice(0, 4).map(row => {
        const s = globalThis.getComputedStyle(row), b = globalThis.getComputedStyle(row, "::before"), a = globalThis.getComputedStyle(row, "::after"), i = globalThis.getComputedStyle(row.querySelector("input"));
        return [s.backgroundColor, s.borderColor, s.boxShadow, s.outlineStyle, s.outlineColor, b.opacity, a.opacity, a.backgroundColor, i.outlineStyle, i.backgroundColor].join(" | ");
    }));
    for (const theme of ["glass", "legacy"]) {
        await load(page, withTheme("/audit/style-harness.html?w=action-observe&role=player", theme));
        if (theme === "glass") {
            await page.addStyleTag({ content: ".drpg-choice:has(input:checked) strong { color: rgb(7, 7, 10) !important; } .drpg-choice:has(input:checked)::before { background: rgb(7, 7, 10) !important; opacity: 1 !important; content: '' !important; }" });
            const planted = await read("general");
            const ok = planted.title === 1;
            console.log(`style-sweep: --selected control (planted text on its own ground): title ${planted.title}:1 ${ok ? "read" : "NOT read"}`);
            if (!ok) problems.push("control: a planted title on its own ground did not read 1:1");
            await load(page, withTheme("/audit/style-harness.html?w=action-observe&role=player", theme));
            // The brush taken off the picked row: it must read as missing, or the brush check below reads nothing.
            await page.addStyleTag({ content: ".drpg-choice:has(input:checked)::before { content: none !important; }" });
            const bare = brushLow((await read("general")).brush);
            console.log(`style-sweep: --selected control (the brush taken off): ${bare.length ? `read (${bare.join("; ")})` : "NOT read"}`);
            if (!bare.length) problems.push("control: a picked row with its brush taken off read as brushed");
            await load(page, withTheme("/audit/style-harness.html?w=action-observe&role=player", theme));
        }
        for (const pick of ["general", "specific"]) {
            const r = await read(pick);
            if (r.error) { problems.push(`${theme} ${pick}: ${r.error}`); continue; }
            const low = [["title", 4.5], ["hint", 4.5], ["icon", 3], ["mark", 3]].filter(([k, need]) => !(typeof r[k] === "number" && r[k] >= need)).map(([k, need]) => `${k} ${r[k]} (needs ${need})`);
            if (theme === "glass") low.push(...brushLow(r.brush, pick));
            console.log(`style-sweep: --selected ${theme} ${pick}: title ${r.title}, hint ${r.hint}, icon ${r.icon}, mark ${r.mark}, brush ${JSON.stringify(r.brush)}${low.length ? ` - LOW: ${low.join("; ")}` : ""}`);
            for (const l of low) problems.push(`${theme} ${pick}: ${l}`);
        }
        // The four states: row 1 picked, row 2 under the pointer, row 3 with the keyboard's focus, row 4 at rest.
        await page.evaluate(() => { const i = globalThis.document.querySelector('.drpg-choice-list input[value="general"]'); i.checked = true; });
        await page.keyboard.press("Tab");
        await page.evaluate(() => globalThis.document.querySelectorAll(".drpg-choice-list > .drpg-choice input")[2].focus());
        await page.hover(".drpg-choice-list > .drpg-choice:nth-of-type(2)");
        await page.waitForTimeout(250);
        const states = await look();
        const names = ["selected", "hovered", "focused", "resting"];
        const alike = [];
        for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) if (states[x] === states[y]) alike.push(`${names[x]} = ${names[y]}`);
        console.log(`style-sweep: --selected ${theme} states: ${alike.length ? `ALIKE ${alike.join(", ")}` : "selected, hovered, focused and resting all differ"}`);
        for (const a of alike) problems.push(`${theme} states: ${a}`);
    }
    await page.close();
    console.log(`style-sweep: --selected ${problems.length ? `RED, ${problems.length} problem(s)` : "green"}`);
    return problems.length ? 1 : 0;
}

async function main() {
    let server = null;
    if (!BASE) {
        const port = await freePort();
        server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: REPO, stdio: "ignore" });
        BASE = `http://127.0.0.1:${port}`;
        for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/module.json`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    }
    const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
    if (SELECTED) {
        try { process.exitCode = await selectedPass(browser); } finally { await browser.close(); server?.kill(); }
        return;
    }
    if (FIT) {
        try { process.exitCode = await fitPass(browser); } finally { await browser.close(); server?.kill(); }
        return;
    }
    const problems = [];
    const readings = {};
    let props = null;
    try {
        const list = pages();
        if (!list.length) throw new Error("no page to read: audit/windows/manifest.json holds no captured window");
        if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
        {
            const page = await browser.newPage({ viewport: { width: SIZES[0][0], height: SIZES[0][1] } });
            problems.push(...(await controls(page, list[0])).map(p => `control ${p}`));
            await page.close();
        }
        for (const [w, h] of SIZES) {
            for (const theme of THEMES) {
                const page = await browser.newPage({ viewport: { width: w, height: h } });
                let read = 0;
                for (const p of list) {
                    if (p.sizes && !p.sizes.includes(`${w}x${h}`)) continue;
                    read++;
                    await load(page, withTheme(p.url, theme));
                    const s = await snap(page);
                    props ??= Object.keys(Object.values(s.surfaces).find(v => v.found)?.props ?? {});
                    readings[`${p.id}|${theme}|${w}x${h}`] = found(s);
                    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${p.id}-${theme}-${w}x${h}.png`), fullPage: true });
                }
                await page.close();
                console.log(`style-sweep: ${w}x${h} ${theme}: ${read} page(s) read`);
            }
        }
    } finally {
        await browser.close();
        server?.kill();
    }
    const old = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : null;
    const before = old ? unpack(old) : {};
    let diffs = 0, accepted = 0;
    const next = { ...before };
    for (const [key, now] of Object.entries(readings)) {
        if (!(key in before)) {
            // A page new to the baseline is added by --accept naming the page (E44 C3a: the kit gallery's rows).
            if (ACCEPT.has(key.split("|")[0])) accepted++;
            else if (!WRITE) { problems.push(`${key}: no row in the baseline`); diffs++; }
            next[key] = now;
            continue;
        }
        const merged = { ...before[key] };
        for (const d of differences(before[key], now)) {
            const [page, theme, size] = key.split("|");
            if (WRITE || ACCEPT.has(d.id)) { accepted++; if (d.id in now) merged[d.id] = now[d.id]; else delete merged[d.id]; continue; }
            diffs++;
            console.log(`style-sweep: ${page} ${d.id} at ${size}, ${theme}: ${d.what}`);
        }
        next[key] = WRITE ? now : merged;
    }
    if (!ONLY.size) for (const key of Object.keys(before)) if (!(key in readings)) { if (WRITE) delete next[key]; else { problems.push(`${key}: in the baseline, not read now`); diffs++; } }
    if (diffs) problems.push(`${diffs} difference(s) from audit/style-baseline.json not accepted`);
    if ((WRITE || accepted || !old) && !problems.some(p => p.startsWith("control "))) {
        const packed = pack(next, props);
        fs.writeFileSync(BASELINE, `${JSON.stringify({
            about: "What audit/style-sweep.mjs read in Chromium (scripts/style-snapshot.mjs styleSnapshot) on every page at each size and theme: pages[\"<page>|<theme>|<w>x<h>\"] = { surface: [index into values, one a prop] }, the surfaces found. Written by the sweep's --write or --accept from a run, never by hand.",
            props, values: packed.values, pages: packed.pages
        })}\n`);
        console.log(`style-sweep: audit/style-baseline.json written (${Object.keys(next).length} reading(s), ${packed.values.length} distinct value(s)${accepted ? `, ${accepted} accepted` : ""})`);
    }
    for (const p of problems) console.log(`style-sweep: ${p}`);
    console.log(`style-sweep: ${Object.keys(readings).length} reading(s) of ${SIZES.length} size(s) x ${THEMES.length} theme(s); ${diffs} difference(s) not accepted, ${accepted} accepted; ${problems.length ? "RED" : "green"}`);
    process.exitCode = problems.length ? 1 : 0;
}

await main();
