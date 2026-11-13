/*
 * The look freeze: every module surface the style harness and the glass harness draw, in both themes and both languages,
 * held to one baseline before E55 consolidates a line of CSS (E55 step 0, F0; 13.11.2026).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   node audit/style-freeze.mjs                 compare with audit/style-freeze/baseline.json; exit 1 on any difference,
 *                                               naming the page, theme, language, size, surface, its selector and the
 *                                               property, before and after, then every difference grouped
 *   node audit/style-freeze.mjs --write         the baseline written from this run (read it before committing)
 *   node audit/style-freeze.mjs --root <dir>    serve another checkout (a throwaway copy with a planted CSS change)
 *                                               against this repository's baseline and captures
 *   node audit/style-freeze.mjs --only kit-gallery    one page (repeatable)
 *   --chromium <executable>                     the browser (the harness's Playwright may want another build than the
 *                                               one installed; the baseline names the build it was written in)
 * The windows are read from the captures the baseline was read from, kept beside it in audit/style-freeze/windows-en
 * and windows-pl (probe 08 on 421f2395: 80 rows each, 79 captured in each language; the committed audit/windows/ is
 * older, 60 rows), so a comparison holds the markup still and only the sheets can differ. Refresh them together with
 * the baseline, never one without the other: `cd audit/harness && DRPG_CAPTURE_OUT=<dir> node cluster.mjs
 * probes/08-capture-windows.mjs`, again with DRPG_CAPTURE_LANG=pl into another <dir>, then `--en-windows <dir>
 * --pl-windows <dir> --write` and copy the two folders in. A run without both captures stops: the freeze reads both
 * languages.
 *
 * WHAT IT REUSES, AND WHAT IT ADDS. The reading is scripts/style-snapshot.mjs `styleSnapshot` (STYLE_SURFACES, 33
 * properties each, the first element each selector matches), unchanged, as audit/style-sweep.mjs runs it; the pages
 * are the sweep's (every window probe 08 captured, on audit/style-harness.html; the kit gallery; the sheet's parts; the
 * glass harness's GM and player pages), at the sweep's four sizes, with the sweep's three controls first (unchanged,
 * restyled, removed). Neither the sweep nor its baseline is touched (three open lines edit style-sweep.mjs). What
 * this adds: (1) Polish - every window as probe 08 drew it in Polish (served from audit/style-freeze/windows-pl in place of
 * audit/windows/), and the kit gallery and the sheet's parts with `&lang=pl` (the harness reads lang/pl.json); the
 * glass harness has no language of its own, so its two pages are read once per theme, under "en"; (2) the Chromium
 * build in the baseline: the sweep's baseline, written in another build, read 2308 differences at 4dfac3a9 (prep-54's
 * reading), a build's drift that a baseline cannot tell from a change, so a run in another build compares nothing and
 * is red; (3) the selector in every difference; (4) `--root`, so a planted change in a throwaway tree is read
 * against the real baseline. The pseudo-elements and masks (the brush, the glyphs, the Hope star, the checkbox tick)
 * are not read here: audit/look-freeze.mjs on the prep-54 line reads them, beside this.
 *
 * One page is loaded once per theme and language and read at each size after a resize (not a reload); the baseline
 * is written the same way, so the two agree on what a reading is.
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import url from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const BASELINE = path.join(HERE, "style-freeze", "baseline.json");
const SIZES = [[1920, 1080], [1366, 768], [1024, 768], [390, 844]];
const THEMES = ["glass", "legacy"];

const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : [])).filter(Boolean);
const WRITE = argv.includes("--write");
const ONLY = new Set(many("--only"));
/* The captures the baseline was read from are kept beside it (audit/style-freeze/windows-en, windows-pl), so a comparison
   holds the markup still and only the sheets can differ; `--en-windows` and `--pl-windows` read others. */
const PL_DIR = path.resolve(opt("--pl-windows") ?? path.join(HERE, "style-freeze", "windows-pl"));
const EN_DIR = path.resolve(opt("--en-windows") ?? path.join(HERE, "style-freeze", "windows-en"));
const ROOT = opt("--root") ? path.resolve(opt("--root")) : REPO;
const CHROMIUM = opt("--chromium");

const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
const { STYLE_SURFACES, PROPS } = await import(url.pathToFileURL(path.join(REPO, "scripts", "style-snapshot.mjs")).href);
const SELECTOR = Object.fromEntries(STYLE_SURFACES.map(s => [s.id, s.selector]));

const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/** The pages of one language: as the sweep's, the windows from that language's capture. */
function pages(lang) {
    const dir = lang === "pl" ? PL_DIR : (EN_DIR ?? path.join(ROOT, "audit", "windows"));
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const q = lang === "pl" ? "&lang=pl" : "";
    const out = manifest.windows.filter(w => w.captured).map(w => ({
        id: w.id, url: `/audit/style-harness.html?w=${encodeURIComponent(w.id)}${w.client === "gm" ? "" : "&role=player"}${q}`
    }));
    out.push({ id: "kit-gallery", url: `/audit/style-harness.html?kit=1${q}` });
    out.push({ id: "sheet-parts", url: `/audit/style-harness.html?sheet=parts${q}`, sizes: ["1920x1080", "1366x768"] });
    if (lang === "en") {
        out.push({ id: "glass-gm", url: "/audit/glass-harness.html?gmp=1&msgr=1&still=1" });
        out.push({ id: "glass-player", url: "/audit/glass-harness.html?role=player&still=1" });
    }
    return ONLY.size ? out.filter(p => ONLY.has(p.id)) : out;
}

const withTheme = (u, theme) => (theme === "legacy" ? `${u}${u.includes("?") ? "&" : "?"}theme=legacy` : u);
const found = s => Object.fromEntries(Object.entries(s.surfaces).filter(([, v]) => v.found).map(([id, v]) => [id, v.props]));
const snap = page => page.evaluate(async () => (await import("/scripts/style-snapshot.mjs")).styleSnapshot());

async function load(page, base, u) {
    await page.goto(`${base}${u}`, { waitUntil: "load" });
    await page.waitForFunction(() => !globalThis.document.body?.hasAttribute("data-drpg-kit-pending"), null, { timeout: 15000 });
    await page.evaluate(() => globalThis.document.fonts?.ready);
    await page.waitForTimeout(300);
}

function differences(before, after) {
    const out = [];
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!(id in after)) { out.push({ id, what: "found before, not now" }); continue; }
        if (!(id in before)) { out.push({ id, what: "found now, not before" }); continue; }
        for (const [prop, value] of Object.entries(after[id])) if (before[id][prop] !== value) out.push({ id, prop, what: `${prop}: ${before[id][prop]} -> ${value}` });
    }
    return out;
}

/** The sweep's three controls, on the first page: a comparison that cannot see a fault measures nothing. */
async function controls(page, base, first) {
    const problems = [];
    await load(page, base, first.url);
    const a = found(await snap(page)), b = found(await snap(page));
    if (differences(a, b).length) problems.push(`unchanged: the same page read twice differs (${differences(a, b).slice(0, 3).map(d => `${d.id} ${d.what}`).join("; ")})`);
    const target = Object.keys(a)[0];
    if (!target) return [`no surface found on ${first.id} - the controls have nothing to plant on`];
    await page.addStyleTag({ content: `:is(${SELECTOR[target]}):not(#drpg-freeze-control) { color: rgb(1, 2, 3) !important; padding-top: 37px !important; }` });
    const seen = differences(a, found(await snap(page))).filter(d => d.id === target).map(d => d.prop);
    if (!seen.includes("color") || !seen.includes("padding-top")) problems.push(`restyled: ${target}'s injected color and padding-top read as ${JSON.stringify(seen)}`);
    await page.evaluate(sel => { for (const el of globalThis.document.querySelectorAll(sel)) el.remove(); }, SELECTOR[target]);
    const gone = (await snap(page)).surfaces[target]?.found === false;
    if (!gone) problems.push(`removed: ${target} taken out of the page still reads found`);
    console.log(`style-freeze: controls on ${first.id}, surface ${target}: unchanged ${differences(a, b).length}, restyled ${JSON.stringify(seen)}, removed ${gone ? "not found" : "still found"}`);
    return problems;
}

function pack(readings) {
    const values = [], index = new Map();
    const at = v => { if (!index.has(v)) { index.set(v, values.length); values.push(v); } return index.get(v); };
    const out = {};
    for (const [key, surfaces] of Object.entries(readings)) out[key] = Object.fromEntries(Object.entries(surfaces).map(([id, p]) => [id, PROPS.map(n => at(p[n] ?? ""))]));
    return { values, pages: out };
}

function unpack(base) {
    const out = {};
    for (const [key, surfaces] of Object.entries(base.pages ?? {})) out[key] = Object.fromEntries(Object.entries(surfaces).map(([id, refs]) => [id, Object.fromEntries(base.props.map((n, i) => [n, base.values[refs[i]]]))]));
    return out;
}

async function main() {
    const port = await freePort();
    const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) { try { await fetch(`${base}/module.json`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
    const build = browser.version();
    const problems = [];
    const readings = {};
    let loads = 0;
    try {
        const langs = ["en", "pl"];
        for (const [lang, dir] of [["en", EN_DIR], ["pl", PL_DIR]]) if (!fs.existsSync(path.join(dir, "manifest.json"))) throw new Error(`no ${lang} captures at ${dir} (probe 08's manifest.json): the freeze reads both languages`);
        const page = await browser.newPage({ viewport: { width: SIZES[0][0], height: SIZES[0][1] } });
        const first = pages("en")[0];
        if (!first) throw new Error("no page to read");
        problems.push(...await controls(page, base, first));
        for (const lang of langs) {
            const dir = lang === "pl" ? PL_DIR : EN_DIR;
            if (dir) {
                await page.route("**/audit/windows/**", route => {
                    const file = path.join(dir, decodeURIComponent(new URL(route.request().url()).pathname.split("/audit/windows/")[1]));
                    return fs.existsSync(file) ? route.fulfill({ path: file }) : route.continue();
                });
            }
            for (const p of pages(lang)) for (const theme of THEMES) {
                await page.setViewportSize({ width: SIZES[0][0], height: SIZES[0][1] });
                await load(page, base, withTheme(p.url, theme));
                loads += 1;
                for (const [w, h] of SIZES) {
                    if (p.sizes && !p.sizes.includes(`${w}x${h}`)) continue;
                    await page.setViewportSize({ width: w, height: h });
                    await page.waitForTimeout(150);
                    readings[`${p.id}|${theme}|${lang}|${w}x${h}`] = found(await snap(page));
                }
            }
            if (dir) await page.unroute("**/audit/windows/**");
        }
    } finally {
        await browser.close();
        server.kill();
    }
    const surfaces = Object.values(readings).reduce((n, s) => n + Object.keys(s).length, 0);
    if (WRITE) {
        const packed = pack(readings);
        fs.writeFileSync(BASELINE, JSON.stringify({
            about: "What audit/style-freeze.mjs read in Chromium (scripts/style-snapshot.mjs styleSnapshot): pages[\"<page>|<theme>|<lang>|<w>x<h>\"] = { surface: [index into values, one a prop] }, the surfaces found. Written by --write from a run, never by hand.",
            chromium: build, props: PROPS, ...packed
        }) + "\n");
        console.log(`style-freeze: baseline written - ${Object.keys(readings).length} reading(s), ${surfaces} surface reading(s), ${loads} page load(s), Chromium ${build}`);
        if (problems.length) { for (const p of problems) console.log(`style-freeze: ${p}`); process.exitCode = 1; }
        return;
    }
    let baseline = null;
    try { baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")); } catch { problems.push(`${path.relative(REPO, BASELINE)} is missing or not JSON - write it with --write`); }
    let diffs = 0;
    if (baseline && baseline.chromium !== build) problems.push(`the baseline was written in Chromium ${baseline.chromium}, this is ${build}: nothing compared (a build's drift is not a change)`);
    else if (baseline) {
        const before = unpack(baseline);
        for (const key of new Set([...Object.keys(before), ...Object.keys(readings)])) {
            const [pageId] = key.split("|");
            if (ONLY.size && !ONLY.has(pageId)) continue;
            if (!(key in readings)) { problems.push(`${key}: in the baseline, not read now`); diffs += 1; continue; }
            if (!(key in before)) { problems.push(`${key}: read now, not in the baseline`); diffs += 1; continue; }
            for (const d of differences(before[key], readings[key])) {
                diffs += 1;
                if (diffs <= 200) problems.push(`${key}: ${d.id} (${SELECTOR[d.id] ?? "?"}) ${d.what}`);
            }
        }
        if (diffs > 200) problems.push(`... and ${diffs - 200} more difference(s)`);
        /* Every difference, grouped, so a run with more than the 200 printed still says what all of them were. */
        const groups = new Map();
        for (const key of Object.keys(readings)) if (before[key]) for (const d of differences(before[key], readings[key])) {
            const [, theme, lang] = key.split("|");
            const g = `${d.id} ${d.prop ?? d.what} ${theme} ${lang}`;
            groups.set(g, (groups.get(g) ?? 0) + 1);
        }
        if (groups.size) console.log(`style-freeze: every difference by surface, property, theme and language: ${[...groups].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} x${n}`).join("; ")}`);
    }
    for (const p of problems) console.log(`style-freeze: ${p}`);
    console.log(`style-freeze: ${Object.keys(readings).length} reading(s), ${surfaces} surface reading(s), ${loads} page load(s), Chromium ${build}, root ${path.relative(REPO, ROOT) || "."}; ${diffs} difference(s); ${problems.length ? "RED" : "green"}`);
    process.exitCode = problems.length ? 1 : 0;
}

await main();
