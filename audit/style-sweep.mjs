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
 *   node audit/style-sweep.mjs --fit      THE FIT PASS (E21 C1c), below, instead of the style comparison; with --only
 *                                         the pages named, with --shots <dir> a screenshot of each at 1366x768
 *
 * WHY. A rule of the window kit can lose to an old rule carrying `!important` while every headless test passes - the
 * dead `.drpg-turning` fix's class of error, and the E44 plan's risk. The cascade test (tests-kit.mjs `styleCascade`)
 * sees `!important`, specificity and order but not `@media`, `@container`, `@layer` or a resolved `var()`; this reads
 * what Chromium computes. For each page - every window probe 08 captured (audit/windows/manifest.json), one a page of
 * audit/style-harness.html, the same page's kit gallery (`?kit=1`, E44 C3a), and glass-harness.html's own page for a GM (with its GM Panel and messenger windows,
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
 * tabs, the player's action windows among them), the kit gallery, the sheet stand-in (`?sheet=1`) and the glass
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
 * 1920x1080, where the Stop stands in view, the Stop pushed 3000 px down - "Stop out". Not the slice's (d): there is no
 * sticky rule on the Stop to take off until E21 C5a writes one; C5a turns (d) into that. Exit 1 on any failure; a page
 * `outside` is not one before C6.
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
/* Pages that must not scroll at all at 1366x768 and above (the doneWhen: "Observe fits with no scrolling"). */
const STILL = ["observe"];
/* From E21 C6 on, a page not on the kit fails; before it, it is E21's list (STAGE.md "The measure"). */
const OUTSIDE_FAILS = false;

const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : [])).filter(Boolean);
const WRITE = argv.includes("--write");
const FIT = argv.includes("--fit");
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
    await page.addStyleTag({ content: `${selector} { color: rgb(1, 2, 3) !important; padding-top: 37px !important; }` });
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
    out.push({ id: "glass-gm", phone: false, a8: true, url: "/audit/glass-harness.html?still=1" });
    out.push({ id: "glass-player", phone: true, a8: true, url: "/audit/glass-harness.html?role=player&still=1" });
    return ONLY.size ? out.filter(p => ONLY.has(p.id)) : out;
}

/** What is wrong with one window's state, as words; [] when it fits. */
function misfits(win, state, still) {
    const out = [];
    if (!state.window) out.push("window out");
    if (state.footer === false) out.push("footer out");
    if (state.buttonsOut.length) out.push(`button(s) out: ${state.buttonsOut.join(", ")}`);
    if (state.tabs === false) out.push("tab bar out");
    const others = state.scrollers.filter(s => s !== "kit-body");
    if (others.length) out.push(`a second scroller: ${others.join(", ")}`);
    if (state.cut) out.push("content cut: the body is taller than its box and nothing scrolls it");
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
        await page.setViewportSize({ width: 1920, height: 1080 });
        await load(page, "/audit/style-harness.html?sheet=1&fit=1&role=player");
        const d0 = (await page.evaluate(() => globalThis.drpgFit()))[0];
        say("(d) ground", d0?.stop === true, `the Stop on the sheet stand-in at 1920x1080 reads ${d0?.stop ? "in view" : "out"}`);
        await page.addStyleTag({ content: ".drpg-safeword-button { bottom: auto !important; top: 3000px !important; }" });
        const d = (await page.evaluate(() => globalThis.drpgFit()))[0];
        say("(d) Stop pushed down", d?.stop === false, `reads ${d?.stop ? "Stop in view" : "Stop out"}`);
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

async function main() {
    let server = null;
    if (!BASE) {
        const port = await freePort();
        server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: REPO, stdio: "ignore" });
        BASE = `http://127.0.0.1:${port}`;
        for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/module.json`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    }
    const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
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
                for (const p of list) {
                    await load(page, withTheme(p.url, theme));
                    const s = await snap(page);
                    props ??= Object.keys(Object.values(s.surfaces).find(v => v.found)?.props ?? {});
                    readings[`${p.id}|${theme}|${w}x${h}`] = found(s);
                    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${p.id}-${theme}-${w}x${h}.png`), fullPage: true });
                }
                await page.close();
                console.log(`style-sweep: ${w}x${h} ${theme}: ${list.length} page(s) read`);
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
