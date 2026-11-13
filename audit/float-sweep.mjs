/*
 * The float sweep: every textarea of the captured windows, edited, in Chromium (float-text line, 13.11.2026).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   python3 -m http.server 8765           (from the repository's root, in another shell)
 *   node audit/float-sweep.mjs            every field of every captured window with one, both themes, 1366x768
 *   node audit/float-sweep.mjs --without  the same with scripts/float-text.mjs not registered: the behaviour before it
 *                                         (red: a long text's field does not grow)
 *   node audit/float-sweep.mjs --only investigation --shots <dir>   one window (repeatable), a screenshot of each field
 *                                         edited (`<window>-<theme>-<n>.png`) and of the window before (`...-rest.png`)
 *   --chromium <executable>               the browser (default /opt/pw-browsers/chromium, else Playwright's own)
 *   --windows <dir> --base <url>          the captures of <dir> (probe 08's DRPG_CAPTURE_OUT, the Polish ones) on a server at
 *                                         <url> that serves the repository with <dir> as its /audit/windows/
 *
 * WHAT IT HOLDS, field by field (audit/windows/manifest.json's windows, each tab's capture apart, under the module's
 * seven stylesheets: audit/style-harness.html `?w=<id>`). The field is filled with a Polish text of 1200 characters and
 * scrolled into view in its window; then, before it is focused, the box of every other element of the window, the
 * window's own box and which of the window's elements scroll (scrollHeight over clientHeight) are read. It is focused
 * without a scroll (`preventScroll`) and read again after the 120 ms growth:
 *   grows      its height is at least the lesser of what its text needs and 60 % of the screen, and at least its own;
 *   still      no other element of the window moved or changed size by half a pixel or more;
 *   window     the window's box is the same;
 *   scroll     the same elements of the window scroll as before, none more;
 *   opaque     its background colour has no transparency while it floats (it stands over the window's other things);
 *   back       after a blur: its height is its own again (within half a pixel), its style attribute as it was, and the
 *              placeholder (`.drpg-float-text-hold`) gone.
 * Exit 1 on any field that fails one, and on a control that does not read as a fault.
 *
 * THE CONTROL, first (the stackShapes lesson of the working notes: a check that cannot see a fault measures nothing). On the first
 * field of the project manager (its field stands in a form's grid; in a table cell with room to spare, as the Remnants
 * table's, a missing placeholder moves nothing): a 12 px block put at the top of the window's content while the field
 * is edited must read as `still` failing, and the same field edited with the helper's placeholder collapsed (`display: none`; taken out, the helper puts the field back
 * and the fault heals) must too.
 * Then each window is loaded clean.
 *
 * INTERACTIONS (`--interactions` for these alone; run after the fields otherwise), on the project manager's description,
 * in both themes, the window first stood where Foundry stands one (`position: fixed` at its own box):
 *   I1 click   a real click into the field (`page.mouse`, not `focus()`): it floats and grows, and nothing else moves;
 *   I2 drag    the window dragged 80 px right and 50 down by its header while the field floats: the window moved by that,
 *              every other element with it (none moved against the window), the field over its placeholder (its left
 *              on the placeholder's, its top on the placeholder's or moved up only as far as the screen's bottom needs),
 *              and still focused and floating. The drag is the page's own model of Foundry's (a pointer down on the
 *              header, its default prevented, so the field keeps the focus; whether Foundry's own drag keeps it is read
 *              at a table), moving the window's `left` and `top`;
 *   I3 escape  a listener closing the window on Escape, on `window` in the bubbling phase, as Foundry's keyboard manager
 *              listens (a model: its phase on v14 is read at a table); Escape pressed in the floating field: the window
 *              still in the page, the field no longer focused, back at its own height, no placeholder left.
 * Red runs: `--without` (I1: nothing floats), `--disable follow` (I2: the field stays where the drag left it),
 * `--disable escape` (I3: the window is closed by the same press).
 *
 * WHAT IT IS NOT: Foundry's frame or its own stylesheet, a window's live data (the harness's seeded world), a real
 * click (`focus()`), or the actor sheet (the style harness's sheet is the module's parts on a model of Daggerheart's).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(new URL("./harness/package.json", import.meta.url));
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const values = name => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const BASE = values("--base")[0] ?? "http://localhost:8765";
const WITHOUT = flag("--without");
/* A part of the helper turned off, for the interactions' red runs (float-text.mjs `registerFloatText` switches). */
const DISABLE = values("--disable");
const ONLY_INTERACTIONS = flag("--interactions");
const ONLY = values("--only");
const SHOTS = values("--shots")[0] ?? null;
const EXE = values("--chromium")[0] ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const THEMES = ["glass", "legacy"];
const SIZE = { width: 1366, height: 768 };
const TEXT = "Na stole w bibliotece leży kartka wyrwana z rejestru wypożyczeń. Ostatnia linijka jest przekreślona długopisem, "
    + "przyciśniętym tak mocno, że papier się przedarł, a data obok to noc morderstwa. Ktoś chciał, żeby nikt nie wiedział, kto "
    + "wypożyczył tę książkę ostatni. ";

/* The captures read: audit/windows/, or `--windows <dir>` (probe 08's DRPG_CAPTURE_OUT, the Polish ones), which the page at
   `--base` must serve as its /audit/windows/. */
const WINDOWS_DIR = values("--windows")[0] ? path.resolve(values("--windows")[0]) : new URL("./windows/", import.meta.url).pathname;
const manifest = JSON.parse(fs.readFileSync(path.join(WINDOWS_DIR, "manifest.json"), "utf8")).windows;
const withFields = manifest.filter(row => row.captured && row.file
    && fs.readFileSync(path.join(WINDOWS_DIR, row.file), "utf8").includes("<textarea")
    && (!ONLY.length || ONLY.includes(row.id)));

/* In the page: the helper registered (or not), the field `n` of the window filled, read before and while edited and after. */
async function measure(page, n, { plant = null, without = WITHOUT } = {}) {
    return page.evaluate(async ({ n, plant, without, text }) => {
        const frame = () => new Promise(r => requestAnimationFrame(() => r()));
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const F = await import("/scripts/float-text.mjs");
        if (!without) F.registerFloatText();
        const fields = [...document.querySelectorAll(".drpg-style-shot .application textarea")];
        const el = fields[n];
        if (!el) return { missing: true };
        // a field of a tab not shown in this capture (its own tab's capture reads it), or one hidden until a choice shows it
        // (an action's request field, `visibility: hidden` until its mode is picked): nobody can edit it as captured
        if (!el.getClientRects().length || !el.getBoundingClientRect().height || getComputedStyle(el).visibility !== "visible") return { hidden: true };
        const app = el.closest(".application");
        el.removeAttribute("readonly"); el.removeAttribute("disabled");
        el.value = text;
        el.scrollIntoView({ block: "nearest" });
        await frame(); await frame();
        const others = [...app.querySelectorAll("*")].filter(x => x !== el && !el.contains(x));
        const boxOf = x => { const r = x.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
        const scrolling = () => others.concat([app]).filter(x => x.scrollHeight > x.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(x).overflowY)).length;
        const before = others.map(boxOf);
        const appBefore = boxOf(app);
        const scrollBefore = scrolling();
        const own = el.getBoundingClientRect().height;
        const styleBefore = el.getAttribute("style");
        const cs = getComputedStyle(el);
        // what its text needs, read on a copy of the field at its width (the field itself may not grow)
        const probe = el.cloneNode(false);
        probe.value = text;
        probe.style.cssText = `position:absolute;visibility:hidden;left:0;top:0;width:${el.getBoundingClientRect().width}px;height:${own}px;box-sizing:border-box;`
            + ["font-family", "font-size", "line-height", "letter-spacing", "padding-top", "padding-bottom", "padding-left", "padding-right",
                "border-top-width", "border-bottom-width", "border-left-width", "border-right-width", "border-style", "white-space", "word-spacing"].map(k => `${k}:${cs.getPropertyValue(k)}`).join(";");
        document.body.append(probe);
        const needed = probe.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
        probe.remove();
        el.focus({ preventScroll: true });
        await frame();
        if (plant === "block") { const b = document.createElement("div"); b.style.height = "12px"; const body = app.querySelector(".window-content") ?? app; body.prepend(b); }
        // collapsed, not taken out: a placeholder that leaves the page makes the helper put the field back, which heals it
        if (plant === "hold") { const h = document.querySelector(".drpg-float-text-hold"); if (h) h.style.display = "none"; }
        await wait(220); await frame();
        const moved = others.filter(x => x.isConnected).map((x, i) => [x, boxOf(x), before[others.indexOf(x)]])
            .filter(([, a, b]) => a.some((v, k) => Math.abs(v - b[k]) >= 0.5));
        const shown = el.getBoundingClientRect().height;
        const want = Math.max(own, Math.min(needed, Math.floor(innerHeight * 0.6)));
        const out = {
            id: el.name || el.className || `#${n}`,
            own: Math.round(own), needed: Math.round(needed), shown: Math.round(shown),
            grows: shown >= want - 1,
            still: moved.length === 0, moved: moved.length, firstMoved: moved[0] ? `${moved[0][0].tagName}.${moved[0][0].className}` : null,
            window: boxOf(app).every((v, k) => Math.abs(v - appBefore[k]) < 0.5),
            scroll: scrolling() <= scrollBefore,
            // over the window's other things, a see-through field shows them through its text (Legacy's !important ground,
            // 13.11.2026): its background colour is read opaque while it floats; with no helper it does not float
            opaque: without || /^rgb\(/.test(getComputedStyle(el).backgroundColor) || /,\s*1\)$/.test(getComputedStyle(el).backgroundColor),
            focused: document.activeElement === el
        };
        return out;
    }, { n, plant, without, text: TEXT.repeat(6) });
}

async function release(page) {
    return page.evaluate(async () => {
        const frame = () => new Promise(r => requestAnimationFrame(() => r()));
        const el = document.activeElement;
        el?.blur();
        await new Promise(r => setTimeout(r, 200)); await frame();
        return { hold: document.querySelectorAll(".drpg-float-text-hold").length, height: el ? Math.round(el.getBoundingClientRect().height) : null, style: el?.getAttribute("style") ?? null };
    });
}

async function open(browser, row, theme) {
    const page = await browser.newPage({ viewport: SIZE });
    const q = `w=${encodeURIComponent(row.id)}${theme === "legacy" ? "&theme=legacy" : ""}${row.client && row.client !== "gm" ? "&role=player" : ""}`;
    await page.goto(`${BASE}/audit/style-harness.html?${q}`);
    await page.waitForFunction(() => !document.body.hasAttribute("data-drpg-kit-pending"), null, { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(300);
    return page;
}


/* THE INTERACTIONS (above). */
async function interactions(browser, theme) {
    const row = manifest.find(r => r.id === "projects" && r.captured);
    if (!row) return [`interactions: no captured project manager in ${WINDOWS_DIR}`];
    const page = await open(browser, row, theme);
    const out = [];
    const opts = { without: WITHOUT, follow: !DISABLE.includes("follow"), escape: !DISABLE.includes("escape"), text: TEXT.repeat(6) };
    const setup = await page.evaluate(async o => {
        const F = await import("/scripts/float-text.mjs");
        if (!o.without) F.registerFloatText({ follow: o.follow, escape: o.escape });
        const el = document.querySelector(".drpg-style-shot .application textarea");
        const app = el.closest(".application");
        const r = app.getBoundingClientRect();
        // where Foundry stands a window: fixed, at its own box
        Object.assign(app.style, { position: "fixed", left: `${r.left}px`, top: `${Math.max(0, r.top)}px`, width: `${r.width}px`, margin: "0" });
        el.value = o.text;
        // the page's model of Foundry's drag: the header's pointer down, its default prevented, moves the window
        const header = app.querySelector(".window-header");
        let from = null;
        header.addEventListener("mousedown", e => { e.preventDefault(); from = { x: e.clientX, y: e.clientY, left: parseFloat(app.style.left), top: parseFloat(app.style.top) }; });
        window.addEventListener("mousemove", e => { if (from) { app.style.left = `${from.left + e.clientX - from.x}px`; app.style.top = `${from.top + e.clientY - from.y}px`; } });
        window.addEventListener("mouseup", () => { from = null; });
        // the page's model of Foundry's Escape: the window closed, on `window`, bubbling
        window.addEventListener("keydown", e => { if (e.key === "Escape") app.remove(); });
        await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const fr = el.getBoundingClientRect(), hr = header.getBoundingClientRect();
        globalThis.__fs = { el, app, own: fr.height, others: [...app.querySelectorAll("*")].filter(x => x !== el && !el.contains(x)) };
        globalThis.__fs.before = globalThis.__fs.others.map(x => { const b = x.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
        return { field: [fr.left + fr.width / 2, fr.top + Math.min(fr.height / 2, 10)], header: [hr.left + 40, hr.top + hr.height / 2] };
    }, opts);
    const read = () => page.evaluate(() => {
        const { el, app, others, before, own } = globalThis.__fs;
        const hold = document.querySelector(".drpg-float-text-hold");
        const box = x => { const b = x.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
        const a = app.getBoundingClientRect();
        return { connected: app.isConnected, appAt: [a.left, a.top], focused: document.activeElement === el, floating: el.matches(":popover-open"),
            field: box(el), hold: hold ? box(hold) : null, own, screen: innerHeight,
            others: others.filter(x => x.isConnected).map(x => box(x)), before };
    });
    const settle = () => page.waitForTimeout(300);
    // I1
    await page.mouse.click(setup.field[0], setup.field[1]);
    await settle();
    const r1 = await read();
    const moved1 = r1.others.filter((b, i) => b.some((v, k) => Math.abs(v - r1.before[i][k]) >= 0.5)).length;
    const i1 = r1.focused && r1.floating && r1.field[3] > r1.own + 1 && moved1 === 0;
    out.push([`I1 click ${theme}`, i1, `focused ${r1.focused}, floating ${r1.floating}, ${Math.round(r1.own)} -> ${Math.round(r1.field[3])} px, ${moved1} moved`]);
    // I2
    const start = r1.appAt;
    await page.mouse.move(setup.header[0], setup.header[1]);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(setup.header[0] + 8 * k, setup.header[1] + 5 * k);
    await page.mouse.up();
    await settle();
    const r2 = await read();
    const dx = r2.appAt[0] - start[0], dy = r2.appAt[1] - start[1];
    // an element with no box (an option of a closed select, a hidden input) reads 0,0 wherever the window stands
    const withWindow = r2.others.filter((b, i) => (b[2] || b[3] || r1.others[i][2] || r1.others[i][3])
        && (Math.abs(b[0] - r1.others[i][0] - dx) >= 0.5 || Math.abs(b[1] - r1.others[i][1] - dy) >= 0.5)).length;
    const topWant = r2.hold ? Math.round(Math.max(8, Math.min(r2.hold[1], r2.screen - 8 - r2.field[3]))) : null;
    const over = Boolean(r2.hold) && Math.abs(r2.field[0] - r2.hold[0]) < 1 && Math.abs(r2.field[1] - topWant) <= 1;
    const i2 = Math.abs(dx - 80) < 1 && Math.abs(dy - 50) < 1 && withWindow === 0 && over && r2.focused && r2.floating;
    out.push([`I2 drag ${theme}`, i2, `window moved ${Math.round(dx)},${Math.round(dy)}; ${withWindow} element(s) not moved with it; field at ${Math.round(r2.field[0])},${Math.round(r2.field[1])}, its place ${r2.hold ? `${Math.round(r2.hold[0])},${topWant}` : "none"}; focused ${r2.focused}, floating ${r2.floating}`]);
    // I3
    await page.keyboard.press("Escape");
    await settle();
    const r3 = await read();
    const i3 = r3.connected && !r3.focused && !r3.floating && !r3.hold && Math.abs(r3.field[3] - r3.own) <= 0.5;
    out.push([`I3 escape ${theme}`, i3, `window open ${r3.connected}, focused ${r3.focused}, floating ${r3.floating}, placeholder ${Boolean(r3.hold)}, height ${Math.round(r3.field[3])} of ${Math.round(r3.own)}`]);
    await page.close();
    return out;
}

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
const fails = [];
let fields = 0, hidden = 0, interactionsRead = 0;
try {
    /* The control: on the first window's first field, two planted faults must each read as `still` failing. */
    /* On the project manager, whose field stands in a form's grid: in a table cell with room to spare (the Remnants
       table) a missing placeholder moves nothing, so the control is read where it would. */
    const controlRow = manifest.find(row => row.id === "projects" && row.captured);
    if (!WITHOUT && controlRow && !ONLY_INTERACTIONS) {
        for (const plant of ["block", "hold"]) {
            const page = await open(browser, controlRow, "glass");
            const got = await measure(page, 0, { plant });
            if (got.still) fails.push(`control: the planted ${plant === "block" ? "12 px block" : "placeholder collapsed"} did not read as a move - the sweep cannot see one`);
            else console.log(`control ${plant}: read (${got.moved} element(s) moved)`);
            await page.close();
        }
    }
    for (const row of ONLY_INTERACTIONS ? [] : withFields) {
        for (const theme of THEMES) {
            const page = await open(browser, row, theme);
            const count = await page.evaluate(() => document.querySelectorAll(".drpg-style-shot .application textarea").length);
            if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${row.id}-${theme}-rest.png`) }); }
            for (let n = 0; n < count; n++) {
                // the window as it opened, again, for each field: a field left edited would stand in the next one's reading
                if (n) { await page.reload(); await page.waitForTimeout(400); }
                const own = await page.evaluate(i => Math.round(document.querySelectorAll(".drpg-style-shot .application textarea")[i].getBoundingClientRect().height), n);
                const got = await measure(page, n);
                if (got.missing) continue;
                if (got.hidden) { hidden++; continue; }
                fields++;
                if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${row.id}-${theme}-${n}.png`) });
                const back = await release(page);
                const backOk = WITHOUT || (back.hold === 0 && Math.abs(back.height - own) <= 0.5);
                const bad = ["grows", "still", "window", "scroll", "opaque"].filter(k => !got[k]);
                if (!backOk) bad.push(`back (held ${back.hold}, height ${back.height} of ${own})`);
                const line = `${row.id} ${theme} ${got.id}: own ${got.own}, needs ${got.needed}, shown ${got.shown}; ${got.moved} moved${got.firstMoved ? ` (${got.firstMoved})` : ""}`;
                if (bad.length) { fails.push(`${line} - ${bad.join(", ")}`); console.log(`FAIL ${line} - ${bad.join(", ")}`); }
                else console.log(`ok   ${line}`);
            }
            await page.close();
        }
    }
    for (const theme of THEMES) {
        for (const [name, pass, line] of await interactions(browser, theme)) {
            console.log(`${pass ? "ok  " : "FAIL"} ${name}: ${line}`);
            if (!pass) fails.push(`${name}: ${line}`);
            interactionsRead++;
        }
    }
} finally {
    await browser.close();
}
console.log(`float-sweep${WITHOUT ? " --without" : ""}${DISABLE.length ? ` --disable ${DISABLE.join(",")}` : ""}: ${interactionsRead} interaction(s) read; ${ONLY_INTERACTIONS ? 0 : withFields.length} window(s), ${fields} field reading(s) in ${THEMES.length} theme(s) (${hidden} not shown as captured: in another tab, read in that tab's capture, or hidden until a choice), ${fails.length} failing`);
if (fails.length) { for (const f of fails.slice(0, 40)) console.log(`  ${f}`); process.exit(1); }
