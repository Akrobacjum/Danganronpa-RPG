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

const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : [])).filter(Boolean);
const WRITE = argv.includes("--write");
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

async function main() {
    let server = null;
    if (!BASE) {
        const port = await freePort();
        server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: REPO, stdio: "ignore" });
        BASE = `http://127.0.0.1:${port}`;
        for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/module.json`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    }
    const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
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
