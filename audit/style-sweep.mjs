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
 *   node audit/style-sweep.mjs --selected THE SELECTED ROW (E68 C12), below, instead of the style comparison; then THE
 *                                         SELECTED ROW IN EVERY WINDOW (E49 B6): each captured window's first radio or
 *                                         checkbox row picked and read, both themes
 *   node audit/style-sweep.mjs --details  DETAILS HOLD THEIR PLACE (E49 A8.2), below: every action window the same size
 *                                         with Details shut and open; `--every-pick` also at every row picked (A8.3)
 *   node audit/style-sweep.mjs --panel    THE PANEL'S TILES (E49 A3), below: rows one height, every state's label and icon read
 *   node audit/style-sweep.mjs --settings THE SETTINGS WINDOW (E49 A1), below: one size at every section picked;
 *                                         `--pl-windows <dir>` also reads the Polish captures probe 08 wrote into <dir>
 *   node audit/style-sweep.mjs --tables   ITEM TABLES AND PASSAGES (E49 A4, A5), below: no sideways scroll, no button past
 *                                         its cell, one size at every category; `--pl-windows <dir>` and `--shots <dir>` as --settings
 *   node audit/style-sweep.mjs --fields   THE FIELDS PASS (E68 fix round; widened by E49 A7), below: every captured window's
 *                                         text field fills its column; `--pl-windows <dir>` as --settings
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
const STILL = ["action-observe", "action-search", "action-analyze", "action-tamper", "action-rest", "action-project", "action-dynamic",
    /* E64-inv (12.11.2026; the owner's pick of the Investigation review): End the chapter shows its clock options and the
       case's backup without a scroll. Red at 235c321: its body scrolled at 1366x768 in both themes. */
    "chapter-end",
    /* E64-inv's second round (12.11.2026): New Remnant (61 px under the glass at 1366x768) and the realization preview
       after a run (its footer on two rows in Polish under the glass, 12 px). */
    "new-trace", "case-realize--made"];
/* From E21 C6 on, a page not on the kit fails; before it, it is E21's list (STAGE.md "The measure"). */
const OUTSIDE_FAILS = false;

const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : [])).filter(Boolean);
const WRITE = argv.includes("--write");
const FIT = argv.includes("--fit");
const SELECTED = argv.includes("--selected");
const FIELDS = argv.includes("--fields");
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
/* A WINDOW WHOSE ONE SCROLLER IS NOT THE KIT'S BODY (E64-inv, 12.11.2026). The Investigation dashboard's frame is fixed
   (components.css, "THE CASE PANEL'S FIXED FRAME", E97 C2, the owner's Q-C and Q-D of 11.11.2026): its body does not
   scroll (`overflow: hidden`) and holds a toolbar of a stated height over the view's box (`.drpg-case-view`), the one box
   that scrolls, both ways. So in that window the view takes the body's place: counted as its one scroller, and anything
   else that scrolls beside it - the body included - is still a second one (until E64-inv the Legacy table's own box was:
   44732a2 reads it). */
const OWN_SCROLLER = { investigation: "div.drpg-case-live.drpg-case-view" };

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
    /* By the window, not its capture: probe 08 writes a window's other tabs and states as `<id>--<tab>` (`investigation--key`,
       `investigation--final`), the same window, whose view is its one scroller too (fit-110, 13.11.2026: 44 readings of
       those two read "a second scroller: div.drpg-case-live.drpg-case-view", the view the window is built on). */
    const own = OWN_SCROLLER[win?.window] ?? OWN_SCROLLER[String(win?.window ?? "").replace(/--.*$/, "")];
    const others = state.scrollers.filter(s => (own ? s !== own : s !== "kit-body") && !demo.includes(s));
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
       in C12, and the brush with it). E48 K1 (merged 18358978, 11.11.2026: gold for Hope alone) made the first row's
       brush Bone, so its fill reads 0.86 where 1.2.103's gold read 0.7 - the pass red on d70d8569 with nothing else
       wrong (E49 B6's red-first run); the GM's-road row's 0.29 is unchanged. The number is K1's now, the rule the same:
       drawn, opaque, as light as the brush the theme states, over the row. */
    const BRUSH_1_2_103 = { general: 0.86, specific: 0.29 };
    const brushLow = (b, pick = "general") => (!b ? ["brush not drawn"] : [b.opacity < 0.9 && `brush opacity ${b.opacity}`, b.alpha < 1 && `brush fill alpha ${b.alpha}`,
        Math.abs(b.light - BRUSH_1_2_103[pick]) > 0.05 && `brush fill luminance ${b.light} (K1's: ${BRUSH_1_2_103[pick]})`,
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

/*
 * THE SELECTED ROW IN EVERY WINDOW (`--selected`, after Observe's pass above; E49 B6, 11.11.2026; the plan's E49 B6 and
 * the owner's Q4 of round M, "correct only the contrast"). Every window probe 08 captured (audit/windows/manifest.json),
 * in each theme at 1366x768: a row is a radio or a checkbox (never a `role="switch"`: a toggle has no selected look to
 * read) whose closest `label`, `li`, `.drpg-choice` or table row (Despair Flow's and Room setup's pickers are cells of
 * a row) holds words of its own. In each window the first such row
 * whose input is enabled is picked (checked, `change` sent, read after the transitions as Observe's are) and read as
 * Observe's: each element with words of its own against the ground it stands on (its own and its ancestors' grounds to
 * the first opaque one, the row's `::before` brush over it when one is drawn, the element's opacity to the row; a button,
 * select or field inside the row is a control of its own with its own states, not the row's words, and is not read): 4.5:1,
 * 3:1 for large words (24 px, or 18.66 px bold); each icon (`i`, a Font Awesome class) 3:1; and the mark: a control
 * drawn by the module (`appearance: none`) its `::before` against its own box, 3:1; a control the browser draws, its
 * `accent-color` (Chromium's default blue when `auto`, the fill of a checked box or the dot of a radio) against the
 * ground, 3:1 - a reading of the fill's colour, not of the drawn tick. A window with no such row is said, by name, and
 * judged on nothing. THE CONTROL FIRST, on the first capture with a row, in Stained Glass: the picked row's words set to
 * their own ground must read under 1.5:1. Exit 1 on any part below its ratio, or a control not seen.
 */
function pickAndReadRow() {
    const parse = c => {
        const m = String(c).match(/^rgba?\(([^)]+)\)$/), n = String(c).match(/^color\(srgb ([^)]+)\)$/);
        if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
        if (n) { const p = n[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
        return [0, 0, 0, 0];
    };
    const over = (top, under, alpha = 1) => { const a = top[3] * alpha; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
    const cs = (el, pseudo) => globalThis.getComputedStyle(el, pseudo);
    const groundUnder = el => {
        const chain = [];
        for (let e = el; e; e = e.parentElement) { chain.push(parse(cs(e).backgroundColor)); if (chain.at(-1)[3] >= 1) break; }
        let g = chain.at(-1)[3] >= 1 ? chain.pop() : [255, 255, 255, 1];
        while (chain.length) g = over(chain.pop(), g);
        return g;
    };
    const opacityTo = (el, stop) => { let o = 1; for (let e = el; e && e !== stop.parentElement; e = e.parentElement) o *= Number(cs(e).opacity); return o; };
    const shown = el => el.getClientRects().length > 0 && cs(el).visibility !== "hidden";
    const ownWords = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const doc = globalThis.document;
    const rowOf = i => i.closest("label, li, .drpg-choice, tr");
    const rows = [...doc.querySelectorAll('input[type="radio"], input[type="checkbox"]')]
        .filter(i => i.getAttribute("role") !== "switch" && !i.disabled && rowOf(i) && shown(rowOf(i)))
        .filter(i => [rowOf(i), ...rowOf(i).querySelectorAll("*")].some(e => e !== i && ownWords(e) && shown(e)));
    if (!rows.length) return { none: true };
    const input = rows[0];
    input.dataset.drpgPicked = "1";
    input.checked = true;
    input.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
    return { none: false, at: rows.length };
}

function readPickedRow() {
    const parse = c => {
        const m = String(c).match(/^rgba?\(([^)]+)\)$/), n = String(c).match(/^color\(srgb ([^)]+)\)$/);
        if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
        if (n) { const p = n[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
        return [0, 0, 0, 0];
    };
    const over = (top, under, alpha = 1) => { const a = top[3] * alpha; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
    const cs = (el, pseudo) => globalThis.getComputedStyle(el, pseudo);
    const groundUnder = el => {
        const chain = [];
        for (let e = el; e; e = e.parentElement) { chain.push(parse(cs(e).backgroundColor)); if (chain.at(-1)[3] >= 1) break; }
        let g = chain.at(-1)[3] >= 1 ? chain.pop() : [255, 255, 255, 1];
        while (chain.length) g = over(chain.pop(), g);
        return g;
    };
    const opacityTo = (el, stop) => { let o = 1; for (let e = el; e && e !== stop.parentElement; e = e.parentElement) o *= Number(cs(e).opacity); return o; };
    const shown = el => el.getClientRects().length > 0 && cs(el).visibility !== "hidden";
    const ownWords = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const doc = globalThis.document;
    const rowOf = i => i.closest("label, li, .drpg-choice, tr");
    const input = [...doc.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked')]
        .find(i => i.getAttribute("role") !== "switch" && !i.disabled && i.dataset.drpgPicked === "1");
    if (!input) return { error: "the picked row is gone" };
    const row = rowOf(input);
    const brush = cs(row, "::before");
    const brushed = brush.content !== "none" && brush.display !== "none" && Number(brush.opacity) > 0;
    const groundOf = el => { const g = groundUnder(el); return brushed && row.contains(el) ? over(parse(brush.backgroundColor), g, Number(brush.opacity)) : g; };
    const parts = [];
    for (const el of [row, ...row.querySelectorAll("*")]) {
        if (el === input || !shown(el) || el.closest("button, select, textarea, input") !== null && el !== row) continue;
        const icon = el.tagName === "I" || /\bfa-/.test(el.className?.baseVal ?? el.className ?? "");
        if (!icon && !ownWords(el)) continue;
        const s = cs(el), size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700;
        // A glyph pixel-icons.css draws is a mask filled with the element's background, its `color` unused: its ink is
        // that background, and its ground starts at its parent.
        const masked = icon && [s.maskImage, s.webkitMaskImage].some(m => m && m !== "none");
        const ground = groundOf(masked ? el.parentElement : el);
        const need = icon ? 3 : (size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5);
        const words = icon ? `icon ${el.className}` : [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(" ").slice(0, 28);
        parts.push({ what: words, need, ratio: ratio(over(parse(masked ? s.backgroundColor : s.color), ground, opacityTo(el, row)), ground) });
    }
    const ic = cs(input);
    let mark;
    if (!shown(input) || Number(ic.opacity) === 0) mark = { kind: "hidden" };
    else if (ic.appearance === "none") {
        const box = over(parse(ic.backgroundColor), groundOf(input));
        const dot = cs(input, "::before");
        const scaled = /matrix\(0, 0, 0, 0/.test(dot.transform);
        mark = dot.content === "none" || scaled ? { kind: "drawn", ratio: 0 } : { kind: "drawn", ratio: ratio(over(parse(dot.backgroundColor), box, Number(dot.opacity)), box) };
    } else {
        const accent = ic.accentColor === "auto" ? [0, 117, 255, 1] : parse(ic.accentColor);
        mark = { kind: `native (accent ${ic.accentColor})`, ratio: ratio(over(accent, groundOf(input)), groundOf(input)) };
    }
    return { row: (row.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40), parts, mark };
}

async function selectedEveryPass(browser) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const problems = [], none = [], read = [];
    const list = pages().filter(p => !["kit-gallery", "sheet-parts", "glass-gm", "glass-player"].includes(p.id));
    const lowOf = r => [...r.parts.filter(p => !(p.ratio >= p.need)).map(p => `"${p.what}" ${p.ratio} (needs ${p.need})`),
        ...(r.mark.ratio !== undefined && !(r.mark.ratio >= 3) ? [`mark ${r.mark.kind} ${r.mark.ratio} (needs 3)`] : [])];
    /* The control: the picked row's words on their own ground. */
    let first = null;
    for (const p of list) {
        await load(page, withTheme(p.url, "glass"));
        if (!(await page.evaluate(pickAndReadRow)).none) { first = p; break; }
    }
    if (!first) { await page.close(); console.log("style-sweep: --selected (every window): no window has a row to read"); return 1; }
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const i = globalThis.document.querySelector('input[data-drpg-picked="1"]');
        const row = i.closest("label, li, .drpg-choice, tr");
        for (const el of [row, ...row.querySelectorAll("*")]) {
            let g = null;
            for (let e = el; e && !g; e = e.parentElement) { const b = globalThis.getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) g = b; }
            el.style.setProperty("color", g ?? "rgb(255, 255, 255)", "important");
        }
    });
    const planted = await page.evaluate(readPickedRow);
    const seen = (planted.parts ?? []).some(p => p.ratio < 1.5);
    console.log(`style-sweep: --selected (every window) control (a picked row's words on their own ground, ${first.id}): ${seen ? "read" : "NOT read"} (${(planted.parts ?? []).map(p => p.ratio).join(", ")})`);
    if (!seen) problems.push(`control: a row's words planted on their own ground did not read low on ${first.id}`);
    for (const theme of THEMES) {
        for (const p of list) {
            await load(page, withTheme(p.url, theme));
            const picked = await page.evaluate(pickAndReadRow);
            if (picked.none) { if (theme === THEMES[0]) none.push(p.id); continue; }
            /* The settled look, not a frame of a transition: Item tables' picture cells left their mark at scale 0 for
               900 ms and more after the pick in this page (read 11.11.2026), where a wait was enough for Observe. */
            await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
            await page.waitForTimeout(400);
            const r = await page.evaluate(readPickedRow);
            if (r.error) { problems.push(`${p.id} ${theme}: ${r.error}`); continue; }
            const low = lowOf(r);
            read.push(`${p.id} ${theme}`);
            const lowest = r.parts.length ? Math.min(...r.parts.map(x => x.ratio)) : null;
            console.log(`style-sweep: --selected ${p.id} ${theme}: "${r.row}" (${picked.at} row(s)), ${r.parts.length} part(s), lowest ${lowest}, mark ${r.mark.kind}${r.mark.ratio !== undefined ? ` ${r.mark.ratio}` : ""}${low.length ? ` - LOW: ${low.join("; ")}` : ""}`);
            for (const l of low) problems.push(`${p.id} ${theme}: ${l}`);
        }
    }
    await page.close();
    console.log(`style-sweep: --selected windows with no radio or checkbox row in their capture (${none.length}): ${none.join(", ") || "none"}`);
    console.log(`style-sweep: --selected (every window) ${read.length} reading(s); ${problems.length ? `RED, ${problems.length} problem(s)` : "green"}`);
    return problems.length ? 1 : 0;
}

/*
 * THE FIELDS PASS (`--fields`; E68 fix round, 10.11.2026; the owner, 10.11, with a screenshot of the Dynamic Action
 * window whose description took about a third of the window and broke its sentence after three words). WIDENED BY E49
 * A7 (11.11.2026; the owner's 10.11, amend [15]: "every text field fills the width of its window or column; exceptions
 * only deliberate and described") from the action windows to every window probe 08 captured (audit/windows/manifest.json)
 * and the sheet's parts in both layouts (`?sheet=parts`, `&pips=1`): at 1366x768, 1280x720 and 1920x1080 (and a phone's
 * 390x844 for the action windows, as E68 read them), in both themes, in English and - with `--pl-windows <dir>`, a probe
 * 08 run with DRPG_CAPTURE_LANG=pl and DRPG_CAPTURE_OUT=<dir> - in Polish, each shown textarea and text input (`input`
 * of type text, search, email, url or none) is laid against its column: the nearest `.drpg-wide-col` (an action window's
 * column since E68 C12), else its table cell (`td`, `th`: a cell is a column, the owner's Q7 of 10.11, "tak"), else the
 * kit form's field cell (`.drpg-form-field`, the same by Q7), else its fieldset, else the sheet's tab (`section
 * [data-application-part]`), else the window's `.drpg-kit-body`, else its `.window-content`, else the page's `main`. It
 * must run from where it starts to the column's right content edge (4 px of slack) and not past it - a control after it
 * on its line, at most 16 px on, carries its line to that control's end (a picture field and its picker button) - and
 * it must not start left of the column's content.
 * A `type="number"` field is never read (Q7: number fields are exempt by their type). Exempt by name, each with its
 * reason: FIELD_EXEMPT. A planted control first, on Observe's capture at 1366x768: its textarea held to a third of its
 * column must read "narrow", and pushed 300 px wider must read "wider"; and on Set the season up's capture its first
 * field held to a third of its column must read "narrow" (a kit window's field, not an action window's).
 * Exit 1 on any field that does not fill its column.
 */
/* `[name or element, why]`: none needed at E49 A7 (every field the pass reads fills its column after it). */
const FIELD_EXEMPT = [];
const FIELDS_SIZES = [[1366, 768], [1280, 720], [1920, 1080]];
async function fieldsPass(browser) {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "audit", "windows", "manifest.json"), "utf8"));
    const plDir = opt("--pl-windows");
    const langs = plDir ? ["en", "pl"] : ["en"];
    if (!plDir) console.log("style-sweep: --fields Polish NOT read (no --pl-windows <dir>)");
    const list = [
        ...manifest.windows.filter(w => w.captured && (!ONLY.size || ONLY.has(w.id)))
            .map(w => ({ id: w.id, action: w.id.startsWith("action-"), url: `/audit/style-harness.html?w=${encodeURIComponent(w.id)}&fit=1${w.client === "gm" ? "" : "&role=player"}` })),
        ...[["sheet-parts", "/audit/style-harness.html?sheet=parts"], ["sheet-parts-pips", "/audit/style-harness.html?sheet=parts&pips=1"]]
            .filter(([id]) => !ONLY.size || ONLY.has(id)).map(([id, url]) => ({ id, action: false, url }))
    ];
    if (!list.length) throw new Error("no window to read for --fields");
    const exempt = FIELD_EXEMPT.map(([name]) => name);
    const open = async (lang, w, h) => {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        if (lang === "pl") {
            await page.route("**/audit/windows/**", route => {
                const file = path.join(path.resolve(plDir), decodeURIComponent(new URL(route.request().url()).pathname.split("/audit/windows/")[1]));
                return fs.existsSync(file) ? route.fulfill({ path: file }) : route.continue();
            });
        }
        return page;
    };
    // Each row picked in turn (a field shown with one row only, `data-drpg-when`, is read with that row), then the fields.
    const picks = page => page.evaluate(() => [...globalThis.document.querySelectorAll('.drpg-choice-list input[name="variant"]:not(:disabled)')].map(i => i.value));
    const pick = (page, value) => page.evaluate(async value => {
        const i = globalThis.document.querySelector(`.drpg-choice-list input[name="variant"][value="${value}"]`);
        if (!i) return;
        i.checked = true;
        i.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
        await new Promise(r => setTimeout(r, 60));
    }, value);
    const readAll = async (page, exempt) => {
        const seen = new Map();
        const values = await picks(page);
        for (const value of values.length ? values : [null]) {
            if (value !== null) await pick(page, value);
            for (const r of await read(page, exempt)) if (!seen.has(`${r.name} ${r.what}`)) seen.set(`${r.name} ${r.what}`, { ...r, pick: value });
        }
        return [...seen.values()];
    };
    const read = (page, exempt) => page.evaluate(exempt => {
        const doc = globalThis.document, out = [];
        const fields = doc.querySelectorAll('textarea, input:is([type="text"], [type="search"], [type="email"], [type="url"], :not([type]))');
        for (const el of fields) {
            const name = el.getAttribute("name") ?? el.tagName.toLowerCase();
            if (exempt.includes(name) || !el.getClientRects().length) continue;
            const col = el.closest(".drpg-wide-col") ?? el.closest("td, th") ?? el.closest(".drpg-form-field") ?? el.closest("fieldset")
                ?? el.closest("section[data-application-part]") ?? el.closest(".drpg-kit-body") ?? el.closest(".window-content") ?? el.closest("main");
            if (!col) { out.push({ name, what: "no column" }); continue; }
            const c = col.getBoundingClientRect(), cs = globalThis.getComputedStyle(col), f = el.getBoundingClientRect();
            const left = c.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), right = c.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
            /* A control after the field on its line (Room setup's picture field and its picker button): the field's line
               runs on through it when it stands at most 16 px after what came before, at every level up to the column. */
            let end = f.right;
            for (let node = el; node && node !== col; node = node.parentElement) {
                for (let sib = node.nextElementSibling; sib; sib = sib.nextElementSibling) {
                    const r = sib.getBoundingClientRect();
                    if (!r.width || r.bottom <= f.top || r.top >= f.bottom || r.left - end > 16) continue;
                    end = Math.max(end, r.right);
                }
            }
            const what = f.right > right + 1 ? "wider" : end < right - 4 ? "narrow" : f.left < left - 1 ? "starts outside" : "fills";
            out.push({ name, what, cell: col.matches("td, th"), field: Math.round(f.width), column: Math.round(right - left), at: `${Math.round(f.left - left)}..${Math.round(f.right - left)}${end > f.right ? ` (its line to ${Math.round(end - left)})` : ""}` });
        }
        return out;
    }, exempt);
    const problems = [];
    let readings = 0, fills = 0;
    {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        const ctl = async (u, css, field, row) => {
            await load(page, u);
            await page.addStyleTag({ content: css });
            if (row) await pick(page, row);
            return (await read(page, [])).find(r => r.name === field)?.what ?? "no field";
        };
        const obs = "/audit/style-harness.html?w=action-observe&fit=1&role=player";
        const narrow = await ctl(obs, 'textarea[name="request"] { width: 33% !important; }', "request", "specific");
        const wide = await ctl(obs, 'textarea[name="request"] { width: calc(100% + 300px) !important; max-width: none !important; }', "request", "specific");
        const kit = await ctl("/audit/style-harness.html?w=season-setup&fit=1", 'input[name="campaignName"] { flex: none !important; width: 33% !important; }', "campaignName", null);
        console.log(`style-sweep: --fields control (a third of its column): ${narrow}; (300 px wider): ${wide}; (Set the season up's field at a third): ${kit}`);
        if (narrow !== "narrow") problems.push(`control: a textarea at a third of its column read ${narrow}`);
        if (wide !== "wider") problems.push(`control: a textarea 300 px wider than its column read ${wide}`);
        if (kit !== "narrow") problems.push(`control: Set the season up's field at a third of its column read ${kit}`);
        await page.close();
    }
    const perWindow = new Map();
    for (const lang of langs) for (const [w, h] of [...FIELDS_SIZES, FIT_PHONE]) for (const theme of THEMES) {
        const phone = w === FIT_PHONE[0];
        const page = await open(lang, w, h);
        for (const p of list) {
            if (phone && !p.action) continue;
            await load(page, withTheme(p.url, theme));
            for (const r of await readAll(page, exempt)) {
                readings++;
                const tally = perWindow.get(p.id) ?? { fills: 0, misses: 0 };
                perWindow.set(p.id, tally);
                if (r.what === "fills") { fills++; tally.fills++; continue; }
                tally.misses++;
                const line = `${p.id} ${lang} ${w}x${h} ${theme}: ${r.name}${r.pick ? ` (row ${r.pick})` : ""} ${r.what}${r.cell ? " (cell)" : ""} (field ${r.field} of column ${r.column}, at ${r.at})`;
                console.log(`style-sweep: --fields ${line}`);
                problems.push(line);
            }
        }
        await page.close();
    }
    for (const [id, t] of perWindow) console.log(`style-sweep: --fields window ${id}: ${t.fills} fill, ${t.misses} do not`);
    console.log(`style-sweep: --fields ${readings} field reading(s) of ${list.length} page(s), ${perWindow.size} with a field, ${langs.join(" and ")}: ${fills} fill their column, ${readings - fills} do not; ${problems.length ? "RED" : "green"}`);
    return problems.length ? 1 : 0;
}

/*
 * DETAILS HOLD THEIR PLACE (`--details`; E49 A8.2, 11.11.2026; the owner's of that day on the action windows and the
 * rule of 10.11: a state changes look, never layout). Pages: every captured action window (`action-*`, probe 08's, a
 * player's); sizes DETAILS_SIZES; both themes. Per page, size and theme, for every row of its menu picked (the radio's
 * change, and the left column's layers lit and unlit as action-menus.mjs `syncDetails` does: the capture holds no
 * script), Details shut and open (the toggle's `aria-expanded` and the box's `inert`, as `wireDetails` sets them): the
 * window's outer size, the box's visibility, every shown line inside the box's sides, the box not scrolling sideways,
 * the kit body's scroll, and with Details open the lines' and the toggle's contrast on their ground (AA 4.5). Red: the
 * window's size differs shut and open at a pick, a shut box drawn, an open one hidden, a line outside, a sideways
 * scroll, the body scrolling more open than shut, a contrast under 4.5. With `--every-pick` (A8.3) also the right
 * column's held fields (the summed height of its held stacks - the request boxes, the selects a row shows - and of the
 * statistic's slot) at every pick against the first, no row-bound field outside a stack, and (A8.4) the window's
 * outer size at every pick against the first: the rows' second lines hold their place too (the rule of 10.11).
 * THE CONTROL FIRST (the stackShapes lesson): on Observe at 1366x768 under the glass, a rule planted that lets the open
 * box grow past its cap (900 px) - the size must read as differing - or the run is red.
 */
const DETAILS_SIZES = [[1366, 768], [1280, 800], [1920, 1080], [1024, 768]];
const EVERY_PICK = argv.includes("--every-pick");


async function detailsRead(page) {
    return page.evaluate(async () => {
        const parse = c => {
            const m = String(c).match(/^rgba?\(([^)]+)\)$/), n = String(c).match(/^color\(srgb ([^)]+)\)$/);
            if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
            if (n) { const p = n[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
            return [0, 0, 0, 0];
        };
        const over = (top, under, alpha = 1) => { const a = top[3] * alpha; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
        const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
        const groundUnder = el => {
            const chain = [];
            for (let e = el; e; e = e.parentElement) { chain.push(parse(globalThis.getComputedStyle(e).backgroundColor)); if (chain.at(-1)[3] >= 1) break; }
            let g = chain.at(-1)[3] >= 1 ? chain.pop() : [255, 255, 255, 1];
            while (chain.length) g = over(chain.pop(), g);
            return g;
        };
        const contrast = el => { const g = groundUnder(el); return ratio(over(parse(globalThis.getComputedStyle(el).color), g), g); };
        const doc = globalThis.document, cs = el => globalThis.getComputedStyle(el);
        const win = doc.querySelector(".application.drpg-action-window") ?? doc.querySelector(".application");
        const toggle = win?.querySelector(".drpg-action-details-toggle");
        const box = toggle && win.querySelector(`[id="${toggle.getAttribute("aria-controls")}"]`);
        if (!box) return { error: "no Details" };
        const body = win.querySelector(".drpg-kit-body");
        // The rows' floor as `chooseVariant` sets it once drawn (E49 A8.4): the module's own function, run here.
        const { holdRowLines } = await import("/scripts/ui-hold.mjs");
        holdRowLines(win);
        const values = [...win.querySelectorAll('.drpg-choice-list input[name="variant"]')].filter(i => !i.disabled).map(i => i.value);
        const pick = value => {
            const input = win.querySelector(`.drpg-choice-list input[name="variant"][value="${value}"]`);
            input.checked = true;
            input.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
            for (const b of win.querySelectorAll(".drpg-variant-details > .drpg-choice-details")) b.classList.toggle("drpg-unpicked", b.dataset.drpgFor !== value);
            for (const l of win.querySelectorAll(".drpg-action-details-box .drpg-details-layer")) l.classList.toggle("drpg-unpicked", !String(l.dataset.drpgWhen ?? "").split(/\s+/).includes(value));
            for (const f of win.querySelectorAll(".drpg-held-stack > [data-drpg-when]")) f.classList.toggle("drpg-unpicked", !String(f.dataset.drpgWhen ?? "").split(/\s+/).includes(value));
            for (const f of win.querySelectorAll(".drpg-action-trait > [data-drpg-field]")) f.classList.toggle("drpg-unpicked", f.dataset.drpgField !== value);
        };
        const frame = () => new Promise(r => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)));
        const out = [];
        for (const value of values.length ? values : [null]) {
            for (const open of [false, true]) {
                if (value) pick(value);
                toggle.setAttribute("aria-expanded", String(open));
                box.toggleAttribute("inert", !open);
                await frame();
                const r = win.getBoundingClientRect(), bb = box.getBoundingClientRect();
                const held = [...win.querySelectorAll(".drpg-variant-ask .drpg-held-stack, .drpg-variant-ask .drpg-action-trait")];
                const loose = [...win.querySelectorAll(".drpg-variant-ask [data-drpg-when]")].filter(el => !el.parentElement?.classList.contains("drpg-held-stack")).length;
                const lines = [...box.querySelectorAll("li, .drpg-action-details-sub")].filter(el => cs(el).visibility !== "hidden");
                out.push({ value, open, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, box: Math.round(bb.height), vis: cs(box).visibility,
                    rest: Math.round(held.reduce((n, el) => n + el.getBoundingClientRect().height, 0) * 10) / 10, loose,
                    outside: lines.filter(el => { const q = el.getBoundingClientRect(); return q.left < bb.left - 0.5 || q.right > bb.right + 0.5; }).length,
                    sideways: box.scrollWidth - box.clientWidth, inner: box.scrollHeight - box.clientHeight, body: body ? body.scrollHeight - body.clientHeight : 0,
                    lines: open && lines.length ? Math.min(...lines.map(contrast)) : null, toggle: contrast(toggle) });
            }
        }
        return { rows: out };
    });
}

async function detailsPass(browser) {
    const list = pages().filter(p => p.id.startsWith("action-"));
    if (!list.length) throw new Error("no captured action window to read for --details");
    const problems = [];
    {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        await load(page, "/audit/style-harness.html?w=action-observe&role=player");
        await page.addStyleTag({ content: '.drpg-action-details-toggle[aria-expanded="true"] + .drpg-action-details-box { min-height: 900px !important; max-height: none !important; }' });
        const planted = await detailsRead(page);
        const rows = planted.rows ?? [];
        const seen = rows.some((r, i) => i % 2 === 1 && Math.abs(r.h - rows[i - 1].h) > 0.5);
        console.log(`style-sweep: --details control (the open box planted past its cap): ${seen ? "read" : "NOT read"}`);
        if (!seen) problems.push("control: an open box grown past its cap read as no change");
        await page.close();
    }
    for (const [w, h] of DETAILS_SIZES) {
        for (const theme of THEMES) {
            const page = await browser.newPage({ viewport: { width: w, height: h } });
            for (const p of list) {
                await load(page, withTheme(p.url, theme));
                const r = await detailsRead(page);
                const where = `${p.id} ${theme} ${w}x${h}`;
                if (r.error) { problems.push(`${where}: ${r.error}`); console.log(`style-sweep: --details ${where}: ${r.error}`); continue; }
                const bad = [];
                for (let i = 0; i < r.rows.length; i += 2) {
                    const [shut, open] = [r.rows[i], r.rows[i + 1]];
                    if (Math.abs(shut.h - open.h) > 0.5 || Math.abs(shut.w - open.w) > 0.5) bad.push(`${shut.value}: ${shut.w}x${shut.h} shut, ${open.w}x${open.h} open`);
                    if (shut.vis !== "hidden") bad.push(`${shut.value}: the shut box ${shut.vis}`);
                    if (open.vis !== "visible") bad.push(`${shut.value}: the open box ${open.vis}`);
                    if (open.outside) bad.push(`${shut.value}: ${open.outside} line(s) outside the box`);
                    if (open.sideways > 0) bad.push(`${shut.value}: the box scrolls ${open.sideways} px sideways`);
                    if (open.body > shut.body) bad.push(`${shut.value}: the body scrolls ${open.body} px open, ${shut.body} shut`);
                    if (open.lines !== null && open.lines < 4.5) bad.push(`${shut.value}: a line at ${open.lines}:1`);
                    if (open.toggle < 4.5) bad.push(`${shut.value}: the toggle at ${open.toggle}:1`);
                    if (EVERY_PICK && i && Math.abs(shut.rest - r.rows[0].rest) > 0.5) bad.push(`${shut.value}: the held fields ${shut.rest} px, ${r.rows[0].value} ${r.rows[0].rest}`);
                    if (EVERY_PICK && i && (Math.abs(shut.h - r.rows[0].h) > 0.5 || Math.abs(shut.w - r.rows[0].w) > 0.5)) bad.push(`${shut.value}: the window ${shut.w}x${shut.h}, ${r.rows[0].value} ${r.rows[0].w}x${r.rows[0].h}`);
                    if (EVERY_PICK && shut.loose) bad.push(`${shut.value}: ${shut.loose} row-bound field(s) outside a held stack`);
                }
                const hs = [...new Set(r.rows.map(x => x.h))];
                const rests = [...new Set(r.rows.map(x => x.rest))];
                console.log(`style-sweep: --details ${where}: ${r.rows.length / 2} pick(s), height ${hs.join("/")}, held fields ${rests.join("/")}, box ${Math.max(...r.rows.map(x => x.box))}, inner scroll ${Math.max(...r.rows.map(x => x.inner))}, body scroll ${Math.max(...r.rows.map(x => x.body))}, lines ${Math.min(...r.rows.filter(x => x.lines !== null).map(x => x.lines))}:1, toggle ${Math.min(...r.rows.map(x => x.toggle))}:1${bad.length ? ` - RED: ${bad.join("; ")}` : ""}`);
                problems.push(...bad.map(b => `${where}: ${b}`));
            }
            await page.close();
        }
    }
    console.log(`style-sweep: --details ${problems.length ? `RED, ${problems.length} problem(s)` : "green"}`);
    return problems.length ? 1 : 0;
}

/*
 * THE PANEL'S TILES (`--panel`; E49 A3, 11.11.2026; the owner's [7] "przyciski maja nierowna wysokosc w gm panel" and
 * [8] "Ikona przy aktywnym morderstwie niewidoczna", and the rule of 10.11: a state changes look, never layout). Page:
 * probe 08's `gm-panel` capture, every section opened; PANEL_SIZES, both themes, English and Polish (`&lang=pl`). Read:
 * (a) the tiles of each grid row one height within 1 px, every tile its row's height (it fills its cell), its label
 * inside it; (b) every tile's rectangle the same at rest, current, disabled, hovered and focused (all tiles put in the
 * state at once, hover and focus one tile at a time); (c) in each of those five states, every tile's label at 4.5:1 and
 * its icon at 3:1 on the tile's ground - the icon's paint is its `background-color` where it is a mask (the pixel
 * glyphs), its `color` where it is a font glyph, times its and the tile's opacity; the ground is the tile's
 * `background-color` composited over its window's, and the worst of that, each colour stop of its `background-image`
 * (the glass's hazard raster) and its `::before` (the glass's lit brush) where one is drawn - an approximation of the
 * paint (no pixel is read), named so here; a lit brush that covers the tile is its ground alone. Rectangles are read
 * against the sections' box, so a hover that scrolls the panel moves nothing. THE CONTROLS FIRST (the stackShapes
 * lesson): on the first page, every tile planted `align-self: start` and one `min-height: 160px` must read as a row spread, and every icon planted at `opacity: 0.04` must read under
 * 3:1, or the run is red. What it cannot read: Foundry's own stylesheet (its fixed button height, its colours), which
 * is where the owner's two photos came from (Risk 1); that is tier 2's "the panel's tiles in a row are one height and
 * each icon and label reads in every state" (`needs(env.layout)`, LIVE-E49-06).
 */
const PANEL_SIZES = [[1366, 768], [1920, 1080]];
const PANEL_STATES = ["rest", "current", "disabled", "hover", "focus"];

async function panelRead(page, state, index = -1) {
    return page.evaluate(async ({ state, index }) => {
        const parse = c => {
            const m = String(c).match(/^rgba?\(([^)]+)\)$/), n = String(c).match(/^color\(srgb ([^)]+)\)$/);
            if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
            if (n) { const p = n[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
            return [0, 0, 0, 0];
        };
        const over = (top, under, alpha = 1) => { const a = top[3] * alpha; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
        const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
        const cs = (el, pseudo) => globalThis.getComputedStyle(el, pseudo);
        const groundUnder = el => {
            const chain = [];
            for (let e = el; e; e = e.parentElement) { chain.push(parse(cs(e).backgroundColor)); if (chain.at(-1)[3] >= 1) break; }
            let g = chain.at(-1)[3] >= 1 ? chain.pop() : [0, 0, 0, 1];
            while (chain.length) g = over(chain.pop(), g);
            return g;
        };
        const grounds = tile => {
            const base = groundUnder(tile);
            const out = [base];
            for (const stop of String(cs(tile).backgroundImage).match(/rgba?\([^)]+\)/g) ?? []) out.push(over(parse(stop), base));
            // The glass's lit brush is a `::before` behind the content and over the tile's own ground, `inset` past every
            // edge: drawn, it IS the ground (stained-glass.css "the brush").
            const b = cs(tile, "::before"), paint = parse(b.backgroundColor);
            const covers = String(b.inset).split(/\s+/).every(v => parseFloat(v) <= 0);
            if (b.content !== "none" && b.display !== "none" && Number(b.opacity) * paint[3] > 0.05) {
                const lit = over(paint, base, Number(b.opacity));
                return covers && Number(b.opacity) * paint[3] >= 0.9 ? [lit] : [...out, lit];
            }
            return out;
        };
        const doc = globalThis.document;
        for (const d of doc.querySelectorAll("details.drpg-gmp-section")) d.open = true;
        const tiles = [...doc.querySelectorAll(".drpg-gmp-grid > .drpg-gmp-button")];
        for (const t of tiles) {
            t.classList.toggle("is-current", state === "current");
            t.toggleAttribute("aria-current", state === "current");
            t.classList.toggle("drpg-disabled", state === "disabled");
            t.disabled = state === "disabled";
        }
        if (state === "focus" && tiles[index]) tiles[index].focus({ focusVisible: true });
        await new Promise(r => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)));
        const read = tile => {
            const box = tile.closest(".drpg-gmp-sections")?.getBoundingClientRect() ?? { left: 0, top: 0 };
            const r0 = tile.getBoundingClientRect(), r = { left: r0.left - box.left, top: r0.top - box.top, width: r0.width, height: r0.height }, label = tile.querySelector(":scope > span"), icon = tile.querySelector(":scope > i");
            const g = grounds(tile), tileAlpha = Number(cs(tile).opacity);
            const ink = el => {
                if (!el) return null;
                const s = cs(el), masked = s.maskImage && s.maskImage !== "none" || s.webkitMaskImage && s.webkitMaskImage !== "none";
                return { colour: parse(masked ? s.backgroundColor : s.color), alpha: Number(s.opacity) * tileAlpha };
            };
            const worst = p => (p ? Math.min(...g.map(ground => ratio(over(p.colour, ground, p.alpha), ground))) : null);
            const lr = label?.getBoundingClientRect();
            return { key: tile.dataset.drpgRun, rect: [r.left, r.top, r.width, r.height].map(v => Math.round(v * 10) / 10),
                labelOut: lr ? Math.round(Math.max(0, lr.bottom - r0.bottom, r0.top - lr.top, lr.right - r0.right, r0.left - lr.left) * 10) / 10 : null,
                label: worst(ink(label)), icon: worst(ink(icon)) };
        };
        const rows = [];
        for (const grid of doc.querySelectorAll(".drpg-gmp-grid")) {
            const by = new Map();
            for (const t of grid.querySelectorAll(":scope > .drpg-gmp-button")) { const top = Math.round(t.getBoundingClientRect().top); by.set(top, [...(by.get(top) ?? []), t.getBoundingClientRect().height]); }
            rows.push(...by.values());
        }
        const spread = rows.map(hs => Math.round((Math.max(...hs) - Math.min(...hs)) * 10) / 10);
        return { tiles: index >= 0 ? [read(tiles[index])] : tiles.map(read), count: tiles.length, rows: rows.length, spread: Math.max(0, ...spread) };
    }, { state, index });
}

async function panelPass(browser) {
    const problems = [];
    const at = (theme, lang) => withTheme(`/audit/style-harness.html?w=gm-panel${lang === "pl" ? "&lang=pl" : ""}`, theme);
    {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        await load(page, at("legacy", "en"));
        // Foundry's own model: a button of a fixed height does not stretch to its row (Risk 1's suspect), one tile taller.
        await page.addStyleTag({ content: ".drpg-gmp-grid > .drpg-gmp-button { align-self: start !important; } .drpg-gmp-grid > .drpg-gmp-button:first-child { min-height: 160px !important; }" });
        const tall = await panelRead(page, "rest");
        await load(page, at("legacy", "en"));
        await page.addStyleTag({ content: ".drpg-gmp-button > i { opacity: 0.04 !important; }" });
        const faint = await panelRead(page, "rest");
        const lows = faint.tiles.filter(t => t.icon !== null && t.icon < 3).length;
        console.log(`style-sweep: --panel control (one tile planted 160 px tall): spread ${tall.spread} px ${tall.spread > 1 ? "read" : "NOT read"}; (every icon at 0.04): ${lows} of ${faint.tiles.length} under 3:1 ${lows === faint.tiles.length && lows ? "read" : "NOT read"}`);
        if (!(tall.spread > 1)) problems.push("control: a tile planted 160 px tall read as no spread");
        if (!(lows && lows === faint.tiles.length)) problems.push("control: icons planted at opacity 0.04 read at 3:1 or more");
        await page.close();
    }
    for (const [w, h] of PANEL_SIZES) {
        for (const theme of THEMES) {
            for (const lang of ["en", "pl"]) {
                const page = await browser.newPage({ viewport: { width: w, height: h } });
                const where = `gm-panel ${theme} ${lang} ${w}x${h}`;
                const bad = [];
                const states = {};
                for (const state of PANEL_STATES) {
                    await load(page, at(theme, lang));
                    if (state === "hover" || state === "focus") {
                        const first = await panelRead(page, "rest");
                        const tiles = [];
                        for (let i = 0; i < first.count; i++) {
                            if (state === "hover") {
                                await page.mouse.move(0, 0);
                                await page.locator(".drpg-gmp-grid > .drpg-gmp-button").nth(i).hover({ force: true });
                            }
                            if (state === "focus") await page.evaluate(i => globalThis.document.querySelectorAll(".drpg-gmp-grid > .drpg-gmp-button")[i]?.focus({ focusVisible: true }), i);
                            await page.waitForTimeout(250);   // the brush's transition (motion.css --drpg-t-snap and the glass's own)
                            tiles.push(...(await panelRead(page, state === "focus" ? "focus" : "rest", i)).tiles);
                        }
                        states[state] = { ...first, tiles };
                    } else states[state] = await panelRead(page, state);
                }
                const rest = states.rest;
                if (!rest.count) bad.push("no tile drawn");
                if (rest.spread > 1) bad.push(`a row's tiles differ by ${rest.spread} px`);
                for (const t of rest.tiles) if (t.labelOut > 0.5) bad.push(`${t.key}: its label ${t.labelOut} px outside the tile`);
                for (const state of PANEL_STATES) {
                    for (const [i, t] of states[state].tiles.entries()) {
                        const r0 = rest.tiles[i]?.rect ?? [];
                        if (state !== "rest" && t.rect.some((v, k) => Math.abs(v - r0[k]) > 0.5)) bad.push(`${t.key} ${state}: ${t.rect.join(",")} against ${r0.join(",")} at rest`);
                        if (t.label !== null && t.label < 4.5) bad.push(`${t.key} ${state}: label ${t.label}:1`);
                        if (t.icon !== null && t.icon < 3) bad.push(`${t.key} ${state}: icon ${t.icon}:1`);
                    }
                }
                const low = s => ({ label: Math.min(...states[s].tiles.map(t => t.label ?? 99)), icon: Math.min(...states[s].tiles.map(t => t.icon ?? 99)) });
                console.log(`style-sweep: --panel ${where}: ${rest.count} tiles in ${rest.rows} rows, spread ${rest.spread} px; lowest label/icon ${PANEL_STATES.map(s => `${s} ${low(s).label}/${low(s).icon}`).join(", ")}${bad.length ? ` - RED: ${bad.join("; ")}` : ""}`);
                problems.push(...bad.map(b => `${where}: ${b}`));
                await page.close();
            }
        }
    }
    console.log(`style-sweep: --panel ${problems.length ? `RED, ${problems.length} problem(s)` : "green"}`);
    return problems.length ? 1 : 0;
}

/*
 * THE SETTINGS WINDOW (`--settings`; E49 A1, 11.11.2026; the owner's rule of 10.11, "no state may add, remove or shift a
 * control", and [11]: no scrolling). Pages: probe 08's `drpg-settings` (a GM's) and `drpg-settings-player` (a
 * player's; one window since E49 A1d, this browser's four sections; the panes `data-drpg-settings-pane` since), at 1366x768 and 1920x1080, both themes, in English and - with
 * `--pl-windows <dir>`, a probe 08 run with DRPG_CAPTURE_LANG=pl and DRPG_CAPTURE_OUT=<dir> - in Polish (the page's
 * `/audit/windows/` answered from <dir>). Each section is picked through the window's own `showSection`
 * (settings-window.mjs) and read: the window's outer rect, the body's scroll (`.drpg-kit-body` scrollHeight less
 * clientHeight; and its scrollHeight, which moves the content's height while a window held at the screen's height keeps
 * its rect), the rows' widest overflow. Red when a section's rect differs from the first section's by more than 0.5 px or
 * its body content's height at all, or the body scrolls, or a row is wider than its pane. THE LIST'S INK (E49 A1c, the
 * orchestrator's review of the shots: the picked section's gold icon on the gold row): each section button's label at
 * 4.5:1 and its icon at 3:1 on its ground at rest, picked (current), hovered and focused, read as `--panel` reads the
 * panel's tiles; and no select or number field whose longest text is wider than its box (the move audit's select cut
 * under the glass). THE CONTROL first: the hidden sections planted out of the
 * layout (`display: none`, what the window is without its stylesheet's section) must read as a change of size.
 */
const SETTINGS_SIZES = [[1366, 768], [1920, 1080]];
const SETTINGS_PAGES = ["drpg-settings", "drpg-settings-player"];

async function settingsRead(page) {
    return page.evaluate(async () => {
        const { showSection } = await import("/scripts/settings-window.mjs");
        const win = globalThis.document.querySelector(".application.drpg-window-settings");
        if (!win) return { error: "no settings window on the page" };
        const body = win.querySelector(".drpg-kit-body");
        const keys = [...win.querySelectorAll("[data-drpg-section]")].map(b => b.dataset.drpgSection);
        const rows = [];
        for (const key of keys) {
            showSection(win, key);
            await new Promise(r => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)));
            const rect = win.getBoundingClientRect();
            const pane = win.querySelector(`[data-drpg-settings-pane="${key}"]`);
            const paneRight = pane?.getBoundingClientRect().right ?? 0;
            const over = Math.max(0, ...[...(pane?.querySelectorAll(".drpg-settings-row") ?? [])].map(r => Math.round((r.getBoundingClientRect().right - paneRight) * 10) / 10));
            rows.push({ key, w: Math.round(rect.width * 10) / 10, h: Math.round(rect.height * 10) / 10,
                body: body ? body.scrollHeight - body.clientHeight : null, sh: body?.scrollHeight ?? null, over });
        }
        return { rows };
    });
}

/* The sections' list in a state (`rest`: every button as drawn, the picked one aside; `current`: the picked one; `hover` and
   `focus`: the button the caller hovered or focused): each button's label and icon ink against its ground, as `--panel`
   reads the GM panel's tiles (E49 A3: the background-color chain, the raster's stops, the glass's lit `::before` brush),
   and every select and number field whose longest text is wider than its box. */
async function settingsInkRead(page, state, index = -1) {
    return page.evaluate(async ({ state, index }) => {
        const parse = c => {
            const m = String(c).match(/^rgba?\(([^)]+)\)$/), n = String(c).match(/^color\(srgb ([^)]+)\)$/);
            if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
            if (n) { const p = n[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
            return [0, 0, 0, 0];
        };
        const over = (top, under, alpha = 1) => { const a = top[3] * alpha; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
        const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
        const cs = (el, pseudo) => globalThis.getComputedStyle(el, pseudo);
        const groundUnder = el => {
            const chain = [];
            for (let e = el; e; e = e.parentElement) { chain.push(parse(cs(e).backgroundColor)); if (chain.at(-1)[3] >= 1) break; }
            let g = chain.at(-1)[3] >= 1 ? chain.pop() : [0, 0, 0, 1];
            while (chain.length) g = over(chain.pop(), g);
            return g;
        };
        const grounds = el => {
            const base = groundUnder(el);
            const out = [base];
            for (const stop of String(cs(el).backgroundImage).match(/rgba?\([^)]+\)/g) ?? []) out.push(over(parse(stop), base));
            const b = cs(el, "::before"), paint = parse(b.backgroundColor);
            const covers = String(b.inset).split(/\s+/).every(v => parseFloat(v) <= 0);
            if (b.content !== "none" && b.display !== "none" && Number(b.opacity) * paint[3] > 0.05) {
                const lit = over(paint, base, Number(b.opacity));
                return covers && Number(b.opacity) * paint[3] >= 0.9 ? [lit] : [...out, lit];
            }
            return out;
        };
        const win = globalThis.document.querySelector(".application.drpg-window-settings");
        const buttons = [...(win?.querySelectorAll(".drpg-settings-sections > button.drpg-settings-tab") ?? [])];
        const ink = (el, alpha) => {
            if (!el) return null;
            const s = cs(el), masked = s.maskImage && s.maskImage !== "none" || s.webkitMaskImage && s.webkitMaskImage !== "none";
            return { colour: parse(masked ? s.backgroundColor : s.color), alpha: Number(s.opacity) * alpha };
        };
        const read = b => {
            const g = grounds(b), a = Number(cs(b).opacity);
            const worst = p => (p ? Math.min(...g.map(ground => ratio(over(p.colour, ground, p.alpha), ground))) : null);
            return { key: b.dataset.drpgSection, pressed: b.getAttribute("aria-pressed") === "true",
                label: worst(ink(b.querySelector(":scope > span"), a)), icon: worst(ink(b.querySelector(":scope > i"), a)) };
        };
        const picked = state === "rest" ? buttons.filter(b => b.getAttribute("aria-pressed") !== "true")
            : state === "current" ? buttons.filter(b => b.getAttribute("aria-pressed") === "true") : [buttons[index]].filter(Boolean);
        /* A control narrower than its text: each select's longest option and each number field's value, set in the
           control's own font, against its content box (less the select's arrow, the padding-right it keeps). */
        const probe = globalThis.document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0";
        globalThis.document.body.append(probe);
        const narrow = [];
        for (const field of win?.querySelectorAll("select, input[type=number]") ?? []) {
            if (field.closest("[hidden]")) continue;
            const s = cs(field);
            probe.style.font = s.font;
            probe.style.letterSpacing = s.letterSpacing;
            probe.style.textTransform = s.textTransform;
            const texts = field.tagName === "SELECT" ? [...field.options].map(o => o.textContent) : [field.value];
            const need = Math.max(0, ...texts.map(t => { probe.textContent = t; return probe.getBoundingClientRect().width; }));
            const room = field.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
            if (need > room + 0.5) narrow.push(`${field.name} ${Math.round(need)} px of text in ${Math.round(room)}`);
        }
        probe.remove();
        return { buttons: picked.map(read), narrow };
    }, { state, index });
}

async function settingsPass(browser) {
    const problems = [];
    const plDir = opt("--pl-windows");
    const langs = plDir ? ["en", "pl"] : ["en"];
    if (!plDir) console.log("style-sweep: --settings Polish NOT read (no --pl-windows <dir>)");
    const open = async (lang, w, h) => {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        if (lang === "pl") {
            await page.route("**/audit/windows/**", route => {
                const file = path.join(path.resolve(plDir), decodeURIComponent(new URL(route.request().url()).pathname.split("/audit/windows/")[1]));
                return fs.existsSync(file) ? route.fulfill({ path: file }) : route.continue();
            });
        }
        return page;
    };
    const url = (id, theme) => withTheme(`/audit/style-harness.html?w=${id}&fit=1${id.endsWith("-player") ? "&role=player" : ""}`, theme);
    {
        const page = await open("en", 1366, 768);
        await load(page, url("drpg-settings", "glass"));
        await page.addStyleTag({ content: ".drpg-settings-pane[hidden] { display: none !important; }" });
        const r = await settingsRead(page);
        const hs = (r.rows ?? []).map(x => `${x.h}:${x.sh}`);
        const seen = new Set(hs).size > 1;
        console.log(`style-sweep: --settings control (the hidden sections out of the layout): height:body content ${hs.join("/")} ${seen ? "read" : "NOT read"}`);
        if (!seen) problems.push("control: sections taken out of the layout read as one size");
        await page.close();
    }
    for (const lang of langs) {
        for (const [w, h] of SETTINGS_SIZES) {
            for (const theme of THEMES) {
                const page = await open(lang, w, h);
                for (const id of SETTINGS_PAGES) {
                    await load(page, url(id, theme));
                    const r = await settingsRead(page);
                    const where = `${id} ${lang} ${theme} ${w}x${h}`;
                    if (r.error) { problems.push(`${where}: ${r.error}`); console.log(`style-sweep: --settings ${where}: ${r.error}`); continue; }
                    const first = r.rows[0];
                    const bad = [];
                    for (const x of r.rows) {
                        if (Math.abs(x.w - first.w) > 0.5 || Math.abs(x.h - first.h) > 0.5) bad.push(`${x.key} ${x.w}x${x.h} (first ${first.w}x${first.h})`);
                        else if (x.sh !== first.sh) bad.push(`${x.key} body content ${x.sh} px (first ${first.sh})`);
                        if (x.body > 0) bad.push(`${x.key} body scrolls ${x.body} px`);
                        if (x.over > 0.5) bad.push(`${x.key} a row ${x.over} px past its pane`);
                    }
                    /* The list's ink in each state, and the controls' widths, at every section picked (a control is read
                       where its section is shown). Hover and focus on the picked button and on the next one. */
                    const ink = { rest: [], current: [], hover: [], focus: [] };
                    const narrow = new Set();
                    for (const x of r.rows) {
                        await page.evaluate(async key => (await import("/scripts/settings-window.mjs")).showSection(globalThis.document.querySelector(".application.drpg-window-settings"), key), x.key);
                        await page.mouse.move(0, 0);
                        await page.waitForTimeout(450);
                        const at = await settingsInkRead(page, "rest");
                        ink.rest.push(...at.buttons);
                        at.narrow.forEach(n => narrow.add(n));
                        ink.current.push(...(await settingsInkRead(page, "current")).buttons);
                    }
                    const count = r.rows.length;
                    for (const i of [count - 1, 0]) {
                        const button = page.locator(".application.drpg-window-settings .drpg-settings-sections > button.drpg-settings-tab").nth(i);
                        await button.hover({ force: true });
                        await page.waitForTimeout(450);
                        ink.hover.push(...(await settingsInkRead(page, "hover", i)).buttons);
                        await page.mouse.move(0, 0);
                        await page.evaluate(i => globalThis.document.querySelectorAll(".application.drpg-window-settings .drpg-settings-sections > button.drpg-settings-tab")[i]?.focus({ focusVisible: true }), i);
                        await page.waitForTimeout(450);
                        ink.focus.push(...(await settingsInkRead(page, "focus", i)).buttons);
                        await page.evaluate(() => globalThis.document.activeElement?.blur?.());
                    }
                    const low = list => ({ label: Math.min(...list.map(b => b.label ?? 0)), icon: Math.min(...list.map(b => b.icon ?? 0)) });
                    for (const [state, list] of Object.entries(ink)) {
                        const l = low(list);
                        if (!(l.label >= 4.5)) bad.push(`${state}: a section's label ${l.label}:1 (AA 4.5)`);
                        if (!(l.icon >= 3)) bad.push(`${state}: a section's icon ${l.icon}:1 (3:1)`);
                    }
                    for (const n of narrow) bad.push(`a control narrower than its text: ${n}`);
                    problems.push(...bad.map(b => `${where}: ${b}`));
                    console.log(`style-sweep: --settings ${where}: lowest label/icon ${Object.entries(ink).map(([s, list]) => `${s} ${low(list).label}/${low(list).icon}`).join(", ")}; narrow controls ${narrow.size}`);
                    console.log(`style-sweep: --settings ${where}: ${r.rows.length} section(s), ${[...new Set(r.rows.map(x => `${x.w}x${x.h}`))].join(" / ")}, body scroll ${Math.max(...r.rows.map(x => x.body))}${bad.length ? ` - RED: ${bad.join("; ")}` : ""}`);
                    if (SHOTS) {
                        fs.mkdirSync(SHOTS, { recursive: true });
                        for (const x of r.rows) {
                            await page.evaluate(async key => (await import("/scripts/settings-window.mjs")).showSection(globalThis.document.querySelector(".application.drpg-window-settings"), key), x.key);
                            // The glass's brush fades between the buttons (motion.css): the picture after it settles.
                            await page.waitForTimeout(700);
                            await page.screenshot({ path: path.join(SHOTS, `${id}-${lang}-${theme}-${w}x${h}-${x.key}.png`) });
                        }
                    }
                }
                await page.close();
            }
        }
    }
    for (const p of problems) console.log(`style-sweep: --settings ${p}`);
    console.log(`style-sweep: --settings ${problems.length ? `RED, ${problems.length} problem(s)` : "green"}`);
    return problems.length ? 1 : 0;
}

/*
 * ITEM TABLES AND PASSAGES (`--tables`; E49 A4 and A5, 11.11.2026; the owner's screenshots of 10.11, [14] (2) and (3)).
 * Probe 08's two seeded captures, `item-tables--rooms` (a room pool of 41 names on the Room pools tab) and
 * `rooms-passages--rows` (four passages: a tunnel, a public one, a broken one, a closed one), at 1366x768 and 1920x1080,
 * both themes, English and (with `--pl-windows <dir>`) Polish, placed as `--fit` places a window. Item tables: the
 * category summary's rows (the chips' distinct tops, or the one picker), every element of the shown pane past the
 * window body's right edge (the sideways scroll the owner saw: "Everything" on a second row and the row wider than the
 * window under the glass), Rename's and Delete's gap (the kit's 8 px), and the window's rectangle at every category the
 * picker offers, shown by ui-hold.mjs `showRoomGroup` (the very function the window's change calls), each equal to the
 * first within 0.5 px, and the body's content height equal too (41 names fill the screen at every size read, so the window
 * stands at its ceiling whatever is shown and its size alone would read nothing: the scrolled height is what moves). Passages: every button of the actions' column inside its cell (0.5 px), and every cell inside
 * the window body (a column past the window is a button past it too). THE CONTROLS first (the stackShapes lesson): the
 * actions' buttons forced onto one line (`nowrap`, no wrap) must read buttons past their cell; the groups' floor taken
 * off (`min-height: 0`) must read a change of size or of the body's content height between two categories.
 */
/* 1280x720 beside the stage's two (E49 A5): the smallest desk the module supports (D32 as [17] narrowed it), where the
   Passages table stood wider than Room setup's body at 18358978 - the owner's 1117 px window of 10.11. */
const TABLES_SIZES = [[1366, 768], [1920, 1080], [1280, 720]];
const TABLES_PAGES = ["item-tables--rooms", "rooms-passages--rows"];

async function tablesRead(page, id) {
    return page.evaluate(async id => {
        const r1 = v => Math.round(v * 10) / 10;
        const win = globalThis.document.querySelector(".application");
        if (!win) return { error: "no window on the page" };
        const body = win.querySelector(".drpg-kit-body") ?? win.querySelector(".window-content");
        const right = body.getBoundingClientRect().right;
        const size = () => { const r = win.getBoundingClientRect(); return [r1(r.width), r1(r.height)]; };
        const pastOf = root => [...root.querySelectorAll("*")].filter(el => el.getClientRects().length && el.getBoundingClientRect().right > right + 0.5)
            .map(el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/)[0]}` : ""} ${r1(el.getBoundingClientRect().right - right)}`);
        if (id === "item-tables--rooms") {
            const pane = win.querySelector('[data-drpg-pool-pane="rooms"]');
            if (!pane) return { error: "no Room pools pane" };
            const chipTops = new Set([...pane.querySelectorAll(".drpg-room-summary > *")].map(el => Math.round(el.getBoundingClientRect().top)));
            const picker = pane.querySelector("select[data-drpg-room-filter]");
            const rename = pane.querySelector("[data-drpg-rename-table]")?.getBoundingClientRect();
            const del = pane.querySelector("[data-drpg-delete-table]")?.getBoundingClientRect();
            const out = { summaryRows: picker ? 1 : chipTops.size, picker: Boolean(picker), past: pastOf(pane),
                gap: rename && del ? r1(del.left - rename.right) : null, sameLine: rename && del ? Math.abs(rename.top - del.top) < 1 : null,
                sizes: [] };
            if (picker) {
                const { showRoomGroup } = await import("/scripts/ui-hold.mjs");
                const box = pane.querySelector("[data-drpg-room-groups]");
                for (const option of picker.options) {
                    picker.value = option.value;
                    showRoomGroup(box, option.value);
                    await new Promise(r => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(r)));
                    out.sizes.push({ kind: option.value, size: size(), sh: body.scrollHeight, past: pastOf(pane).length });
                }
                picker.value = picker.options[0]?.value ?? "";
                showRoomGroup(box, picker.value);
            } else out.sizes.push({ kind: "as drawn", size: size(), sh: body.scrollHeight, past: out.past.length });
            return out;
        }
        const cells = [...win.querySelectorAll("[data-drpg-passages] tr[data-drpg-passage] > td")];
        const outside = [];
        for (const td of cells.filter(c => c.classList.contains("drpg-data-col-actions"))) {
            const c = td.getBoundingClientRect();
            for (const b of td.querySelectorAll("button")) {
                const r = b.getBoundingClientRect();
                const by = Math.max(r.right - c.right, c.left - r.left, r.bottom - c.bottom, c.top - r.top);
                if (by > 0.5) outside.push(`${td.parentElement.dataset.drpgPassage.split(".").pop()} ${b.dataset.drpgPassageAct} ${r1(by)}`);
            }
        }
        const cellsPast = cells.filter(td => td.getBoundingClientRect().right > right + 0.5).length;
        const rows = cells.length ? new Set(cells.map(td => td.parentElement)).size : 0;
        return { rows, buttons: cells.filter(c => c.classList.contains("drpg-data-col-actions")).reduce((n, td) => n + td.querySelectorAll("button").length, 0),
            outside, cellsPast, past: pastOf(win.querySelector("[data-drpg-passages]") ?? win), size: size() };
    }, id);
}

async function tablesPass(browser) {
    const problems = [];
    const plDir = opt("--pl-windows");
    const langs = plDir ? ["en", "pl"] : ["en"];
    if (!plDir) console.log("style-sweep: --tables Polish NOT read (no --pl-windows <dir>)");
    const open = async (lang, w, h) => {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        if (lang === "pl") {
            await page.route("**/audit/windows/**", route => {
                const file = path.join(path.resolve(plDir), decodeURIComponent(new URL(route.request().url()).pathname.split("/audit/windows/")[1]));
                return fs.existsSync(file) ? route.fulfill({ path: file }) : route.continue();
            });
        }
        return page;
    };
    const url = (id, theme) => withTheme(`/audit/style-harness.html?w=${encodeURIComponent(id)}&fit=1`, theme);
    /* The controls, under the glass at 1366x768. */
    {
        const page = await open("en", 1366, 768);
        await load(page, url("rooms-passages--rows", "glass"));
        await page.addStyleTag({ content: ".drpg-passage-actions { display: flex !important; flex-wrap: nowrap !important; } .drpg-passage-actions > button { white-space: nowrap !important; flex: none !important; width: auto !important; }" });
        const p = await tablesRead(page, "rooms-passages--rows");
        const seen = (p.outside?.length ?? 0) > 0;
        console.log(`style-sweep: --tables control (the actions on one line): ${p.outside?.length ?? 0} button(s) past their cell ${seen ? "read" : "NOT read"}`);
        if (!seen) problems.push("control: the actions forced onto one line read no button past its cell");
        await load(page, url("item-tables--rooms", "glass"));
        await page.addStyleTag({ content: "[data-drpg-room-groups] { min-height: 0 !important; }" });
        const t = await tablesRead(page, "item-tables--rooms");
        const sizes = new Set((t.sizes ?? []).map(x => `${x.size.join("x")}:${x.sh}`));
        const read = sizes.size > 1;
        console.log(`style-sweep: --tables control (the groups' floor off): ${[...sizes].join(" / ") || "no picker"} ${read ? "read" : "NOT read"}`);
        if (!read) problems.push(`control: the groups' floor taken off read one size${t.picker ? "" : " (no category picker on the page)"}`);
        await page.close();
    }
    for (const lang of langs) {
        for (const [w, h] of TABLES_SIZES) {
            for (const theme of THEMES) {
                const page = await open(lang, w, h);
                for (const id of TABLES_PAGES) {
                    await load(page, url(id, theme));
                    const r = await tablesRead(page, id);
                    const where = `${id} ${lang} ${theme} ${w}x${h}`;
                    if (r.error) { problems.push(`${where}: ${r.error}`); console.log(`style-sweep: --tables ${where}: ${r.error}`); continue; }
                    const bad = [];
                    if (id === "item-tables--rooms") {
                        if (!r.picker) bad.push(`no category picker: the summary is ${r.summaryRows} row(s) of chips`);
                        if (r.summaryRows !== 1) bad.push(`the summary on ${r.summaryRows} rows`);
                        if (r.past.length) bad.push(`${r.past.length} element(s) past the window's body (${r.past.slice(0, 3).join(", ")})`);
                        if (r.gap !== 8) bad.push(`Rename and Delete ${r.gap} px apart (the kit's 8)`);
                        if (r.sameLine === false) bad.push("Rename and Delete on two lines");
                        const first = r.sizes[0];
                        for (const x of r.sizes) {
                            if (Math.abs(x.size[0] - first.size[0]) > 0.5 || Math.abs(x.size[1] - first.size[1]) > 0.5) bad.push(`${x.kind} ${x.size.join("x")} (${first.kind} ${first.size.join("x")})`);
                            else if (x.sh !== first.sh) bad.push(`${x.kind} body content ${x.sh} px (${first.kind} ${first.sh})`);
                            if (x.past) bad.push(`${x.kind}: ${x.past} element(s) past the window's body`);
                        }
                        console.log(`style-sweep: --tables ${where}: summary ${r.summaryRows} row(s), gap ${r.gap} px, ${r.sizes.length} categor${r.sizes.length === 1 ? "y" : "ies"} at ${[...new Set(r.sizes.map(x => `${x.size.join("x")} (body content ${x.sh})`))].join(" / ")}, past the body ${r.past.length}${bad.length ? ` - RED: ${bad.join("; ")}` : ""}`);
                    } else {
                        if (r.rows !== 4) bad.push(`${r.rows} row(s) drawn (4 seeded)`);
                        if (r.outside.length) bad.push(`${r.outside.length} of ${r.buttons} button(s) past their cell (${r.outside.slice(0, 4).join(", ")})`);
                        if (r.cellsPast) bad.push(`${r.cellsPast} cell(s) past the window's body`);
                        console.log(`style-sweep: --tables ${where}: ${r.rows} row(s), ${r.buttons} button(s), ${r.outside.length} past their cell, ${r.cellsPast} cell(s) past the body, window ${r.size.join("x")}${bad.length ? ` - RED: ${bad.join("; ")}` : ""}`);
                    }
                    problems.push(...bad.map(b => `${where}: ${b}`));
                    if (SHOTS && w === 1366) {
                        fs.mkdirSync(SHOTS, { recursive: true });
                        await page.waitForTimeout(300);
                        await page.screenshot({ path: path.join(SHOTS, `${id}-${lang}-${theme}-${w}x${h}.png`) });
                        if (r.picker) {
                            await page.evaluate(async () => {
                                const pane = globalThis.document.querySelector('[data-drpg-pool-pane="rooms"]');
                                const picker = pane.querySelector("select[data-drpg-room-filter]");
                                picker.value = "tool";
                                (await import("/scripts/ui-hold.mjs")).showRoomGroup(pane.querySelector("[data-drpg-room-groups]"), "tool");
                            });
                            await page.waitForTimeout(300);
                            await page.screenshot({ path: path.join(SHOTS, `${id}-${lang}-${theme}-${w}x${h}-tool.png`) });
                        }
                    }
                }
                await page.close();
            }
        }
    }
    for (const p of problems) console.log(`style-sweep: --tables ${p}`);
    console.log(`style-sweep: --tables ${problems.length ? `RED, ${problems.length} problem(s)` : "green"}`);
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
    if (argv.includes("--panel")) {
        try { process.exitCode = await panelPass(browser); } finally { await browser.close(); server?.kill(); }
        return;
    }
    if (argv.includes("--tables")) {
        try { process.exitCode = await tablesPass(browser); } finally { await browser.close(); server?.kill(); }
        return;
    }
    if (argv.includes("--settings")) {
        try { process.exitCode = await settingsPass(browser); } finally { await browser.close(); server?.kill(); }
        return;
    }
    if (argv.includes("--details")) {
        try { process.exitCode = await detailsPass(browser); } finally { await browser.close(); server?.kill(); }
        return;
    }
    if (FIELDS) {
        try { process.exitCode = await fieldsPass(browser); } finally { await browser.close(); server?.kill(); }
        return;
    }
    if (SELECTED) {
        try {
            const observe = await selectedPass(browser), every = await selectedEveryPass(browser);
            process.exitCode = observe || every;
        } finally { await browser.close(); server?.kill(); }
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
