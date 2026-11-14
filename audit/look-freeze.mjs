/*
 * The look freeze: the surfaces the style sweep does not hold, held (the E55 foundation, 12.11.2026; the E55 plan,
 * F1 and F2, docs/dev/E55/PLAN.md).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   node audit/look-freeze.mjs --chromium <executable>         every page, size and theme against the baseline
 *   node audit/look-freeze.mjs --chromium <exe> --write        the whole baseline written from this run (read it before it is committed)
 *   node audit/look-freeze.mjs --chromium <exe> --accept tray  the rows of the surfaces named rewritten from this run
 *   node audit/look-freeze.mjs --list                          the surfaces, the pseudo-elements read, and what no page draws
 *
 * WHY. E55 consolidates the CSS of the sheet, the Despair rail, the tray and the glass's brush, and the look must not
 * move while it does. audit/style-sweep.mjs holds the windows' surfaces (scripts/style-snapshot.mjs STYLE_SURFACES),
 * and on 12.11.2026 it held the character sheet by one surface (`number-field`), read no `::before`, `::after` or
 * mask - where the brush, the glyphs and the Hope star are drawn - and held none of the rail, the tray or the strip's
 * values. This holds those, on the pages that already draw them: audit/style-harness.html `?sheet=parts` (the action
 * panel, its tiles, the reserves, the inventory) and audit/glass-harness.html for a GM and a player (the rail, the
 * tray, the strip, the launchers' glyphs, the panel buttons' brush), at the sizes the sweep reads, in both themes.
 * It lives beside the sweep, not in it, and writes its own baseline (audit/look-freeze-baseline.json), so it changes
 * nothing the sweep or its 1.1 MB baseline holds.
 *
 * WHAT NO PAGE DRAWS is listed, not frozen (`--list`, NOT_DRAWN below): the chat cards, the Event panel, the Calls'
 * tiles, the sheet's header (name, traits, Hope), its tab bar, the item sheet and the glass's drawn checkbox. Each
 * needs a harness drawing first; until one exists a consolidation of it is measured by screenshots alone.
 *
 * ONE BROWSER BUILD. A computed style is the browser's answer, and two Chromium builds answer differently: on
 * 12.11.2026 the sweep's baseline, read with Chrome for Testing 153 at the very commit that wrote it (e258b135), gave
 * 1176 differences (select fields clipped, tab widths a sub-pixel apart, line heights). The sweep's baseline does not
 * say which build wrote it. This one does (`browser`), and a run in another build compares nothing and is red, so a
 * build's drift is never read as the module's. A baseline is written by the build that will check it.
 *
 * THE CONTROLS, first (the root working notes' stackShapes lesson: a comparison that cannot see a fault measures nothing). On the
 * first page at the first size and theme: the page read twice must agree; a planted restyle of a pseudo-element
 * surface (`::before`'s opacity and background colour, above any rule of the sheets) must read as changed, and a
 * planted mask on an own-element surface too; a surface taken out of the page must read as not found. A control that
 * does not answer as written is red, and nothing is written.
 *
 * Exit 1 on any difference not accepted, a control red, a build that is not the baseline's, or a surface the baseline
 * holds that is no longer found; 2 on a usage error.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(REPO, "audit", "look-freeze-baseline.json");

/** What is read of an element and of each pseudo-element a surface names: the box, the paint and the glyph. */
export const PROPS = [
    "content", "display", "position", "top", "left", "right", "bottom", "width", "height",
    "color", "background-color", "background-image", "border-top-color", "border-top-width", "border-radius",
    "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-transform",
    "padding-top", "padding-left", "gap", "opacity", "filter", "box-shadow", "transform", "clip-path",
    "mask-image", "-webkit-mask-image", "mask-size"
];

/**
 * The surfaces: `page` names the page (sheet, gm, player; "glass" is both glass pages), `selector` the first element
 * read, `pseudo` the pseudo-elements read beside it.
 */
export const SURFACES = [
    // The sheet's parts (style-harness.html ?sheet=parts): the action panel, its tiles, the reserves, the inventory.
    { id: "sheet-action-panel", page: "sheet", selector: ".drpg-action-panel" },
    { id: "sheet-budget-line", page: "sheet", selector: ".drpg-action-panel .drpg-budget-line" },
    { id: "sheet-action-grid", page: "sheet", selector: ".drpg-action-grid" },
    { id: "sheet-action-tile", page: "sheet", selector: ".drpg-action-button", pseudo: ["::before", "::after"] },
    { id: "sheet-action-icon", page: "sheet", selector: ".drpg-action-button .drpg-action-icon", pseudo: ["::before"] },
    { id: "sheet-action-name", page: "sheet", selector: ".drpg-action-button .drpg-action-name" },
    { id: "sheet-action-cost", page: "sheet", selector: ".drpg-action-button .drpg-action-cost" },
    { id: "sheet-reserve-bar", page: "sheet", selector: ".drpg-resource-bar" },
    { id: "sheet-reserve-fill", page: "sheet", selector: ".drpg-resource-fill" },
    { id: "sheet-reserve-row", page: "sheet", selector: ".drpg-reserve-row" },
    { id: "sheet-reserve-field", page: "sheet", selector: ".drpg-reserve-row .drpg-reserve-field" },
    { id: "sheet-status-label", page: "sheet", selector: ".resources-section .status-label", pseudo: ["::before", "::after"] },
    { id: "sheet-inventory-group", page: "sheet", selector: ".drpg-inventory-group" },
    { id: "sheet-inventory-head", page: "sheet", selector: ".drpg-inventory-group > h4" },
    { id: "sheet-group-count", page: "sheet", selector: ".drpg-inventory-group .drpg-group-count" },
    { id: "sheet-item-name", page: "sheet", selector: ".drpg-inventory-group .drpg-item-name" },
    // The Despair rail (glass-harness.html).
    { id: "despair-rail", page: "glass", selector: "#drpg-despair", pseudo: ["::before"] },
    { id: "despair-row", page: "glass", selector: "#drpg-despair .drpg-despair-row" },
    { id: "despair-name", page: "glass", selector: "#drpg-despair .drpg-despair-name" },
    { id: "despair-pip", page: "glass", selector: "#drpg-despair .drpg-despair-pip:not(.filled)", pseudo: ["::before"] },
    { id: "despair-pip-filled", page: "glass", selector: "#drpg-despair .drpg-despair-pip.filled", pseudo: ["::before"] },
    { id: "despair-count", page: "glass", selector: "#drpg-despair .drpg-despair-count" },
    { id: "despair-button", page: "glass", selector: "#drpg-despair .drpg-despair-button", pseudo: ["::before"] },
    // The projects tray (Daggerheart's #countdowns as the module dresses it).
    { id: "tray", page: "glass", selector: "#countdowns" },
    { id: "tray-header", page: "glass", selector: "#countdowns .countdowns-header" },
    { id: "tray-gear", page: "glass", selector: "#countdowns .drpg-projects-gear", pseudo: ["::before"] },
    { id: "tray-gear-glyph", page: "glass", selector: "#countdowns .drpg-projects-gear i", pseudo: ["::before"] },
    { id: "tray-row", page: "glass", selector: "#countdowns .countdown-container" },
    { id: "tray-tag", page: "glass", selector: "#countdowns .progress-tag" },
    // The status strip's values, which the sweep holds by its frame only.
    { id: "status-actions", page: "glass", selector: "#drpg-player-status .is-actions .drpg-status-value" },
    { id: "status-hope", page: "glass", selector: "#drpg-player-status .is-hope .drpg-status-value", pseudo: ["::before"] },
    { id: "status-label", page: "glass", selector: "#drpg-player-status .drpg-status-label" },
    // The brush and the glyphs: drawn by a pseudo-element or a mask, which the sweep does not read.
    // The first match of each wears the brush (an absolute `::before` under `filter: url(#drpg-brush)`, read 12.11.2026);
    // a bare `.drpg-panel button` matched an icon button, whose `::before` is its glyph.
    { id: "panel-button-brush", page: "glass", selector: ".drpg-panel button:not(.drpg-action-button):not(.drpg-call-button):not(.header-control)", pseudo: ["::before", "::after"] },
    { id: "gm-panel-brush", page: "glass", selector: ".drpg-gm-panel .drpg-gmp-button", pseudo: ["::before"] },
    { id: "messenger-brush", page: "glass", selector: ".drpg-messenger button:not(.header-control)", pseudo: ["::before"] },
    { id: "sound-launcher-glyph", page: "glass", selector: "#drpg-sound-launcher i", pseudo: ["::before"] },
    { id: "messenger-launcher-glyph", page: "glass", selector: "#drpg-messenger-launcher > i", pseudo: ["::before"] },
    { id: "book-launcher-glyph", page: "glass", selector: "#drpg-book-launcher i", pseudo: ["::before"] }
];

/** What the E55 plan names and no harness page draws (read 12.11.2026 on the four pages below): not frozen here. */
export const NOT_DRAWN = [
    ["chat cards", ".chat-message: no page draws a chat log with the module's cards"],
    ["the Event panel", "#drpg-events: the glass harness has no event queued, so it is not drawn"],
    ["the Calls' tiles", ".drpg-call-button: the sheet's parts draw the action panel without the Calls"],
    ["the sheet's header", ".character-header-sheet (name, traits, Hope): the sheet's parts model the sidebar and the Actions tab only"],
    ["the sheet's tab bar", "nav.sheet-tabs: not drawn by the sheet's parts"],
    ["the item sheet", ".drpg-item-sheet: no page opens one"],
    ["the glass checkbox", "input[type=checkbox] in a panel: none on these pages (the sweep's captured windows hold their own rows)"]
];

const PAGES = [
    { id: "sheet-parts", kind: "sheet", url: "/audit/style-harness.html?sheet=parts", sizes: ["1920x1080", "1366x768"] },
    { id: "glass-gm", kind: "glass", url: "/audit/glass-harness.html?gmp=1&msgr=1&still=1" },
    { id: "glass-player", kind: "glass", url: "/audit/glass-harness.html?role=player&still=1" }
];
const SIZES = [[1920, 1080], [1366, 768], [1024, 768], [390, 844]];
const THEMES = ["glass", "legacy"];

const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const many = name => argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : [])).filter(Boolean);
const WRITE = argv.includes("--write");
const ACCEPT = new Set(many("--accept"));
const CHROMIUM = opt("--chromium");

const withTheme = (u, theme) => (theme === "legacy" ? `${u}${u.includes("?") ? "&" : "?"}theme=legacy` : u);
const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/** In the page: each surface of `kind`, its element's PROPS and each pseudo-element's, or { found: false }. */
function readPage({ surfaces, props }) {
    const out = {};
    for (const s of surfaces) {
        const el = globalThis.document.querySelector(s.selector);
        if (!el) { out[s.id] = { found: false }; continue; }
        const row = { found: true };
        for (const pseudo of [null, ...(s.pseudo ?? [])]) {
            const cs = globalThis.getComputedStyle(el, pseudo);
            row[pseudo ?? "self"] = Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
        }
        out[s.id] = row;
    }
    return out;
}

async function read(page, kind) {
    return page.evaluate(readPage, { surfaces: SURFACES.filter(s => s.page === kind), props: PROPS });
}

async function load(page, base, u) {
    await page.goto(`${base}${u}`, { waitUntil: "load" });
    await page.waitForFunction(() => !globalThis.document.body?.hasAttribute("data-drpg-kit-pending"), null, { timeout: 15000 });
    await page.evaluate(() => globalThis.document.fonts?.ready);
    await page.waitForTimeout(400);
}

/** Every difference between two readings of one page: `surface part prop: before -> after`, and found / not found. */
export function differences(before, after) {
    const out = [];
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const a = before[id], b = after[id];
        if (!a || !b) { out.push({ id, what: !a ? "not in the baseline" : "in the baseline, not read now" }); continue; }
        if (a.found !== b.found) { out.push({ id, what: a.found ? "found before, not now" : "found now, not before" }); continue; }
        if (!a.found) continue;
        for (const part of new Set([...Object.keys(a), ...Object.keys(b)].filter(k => k !== "found"))) {
            if (!a[part] || !b[part]) { out.push({ id, what: `${part}: read on one side only` }); continue; }
            for (const p of Object.keys(b[part])) if (a[part][p] !== b[part][p]) out.push({ id, what: `${part} ${p}: ${a[part][p]} -> ${b[part][p]}` });
        }
    }
    return out;
}

async function controls(page, base) {
    const problems = [];
    const first = PAGES.find(p => p.kind === "glass");
    await load(page, base, first.url);
    const a = await read(page, first.kind), b = await read(page, first.kind);
    const twice = differences(a, b);
    if (twice.length) problems.push(`unchanged: the page read twice differs (${twice.slice(0, 3).map(d => `${d.id} ${d.what}`).join("; ")})`);
    const pseudo = SURFACES.find(s => s.page === first.kind && s.pseudo?.includes("::before") && a[s.id]?.found);
    const own = SURFACES.find(s => s.page === first.kind && !s.pseudo && a[s.id]?.found);
    if (!pseudo || !own) return [...problems, `no pseudo-element surface or own-element surface found on ${first.id} - the controls have nothing to plant on`];
    await page.addStyleTag({ content: `:is(${pseudo.selector}):not(#drpg-look-control)::before { opacity: 0.37 !important; background-color: rgb(1, 2, 3) !important; }`
        + ` :is(${own.selector}):not(#drpg-look-control) { -webkit-mask-image: linear-gradient(#000, transparent) !important; mask-image: linear-gradient(#000, transparent) !important; }` });
    const c = await read(page, first.kind);
    const seen = differences(a, c).map(d => `${d.id} ${d.what.replace(/: .*$/, "")}`);
    for (const want of [`${pseudo.id} ::before opacity`, `${pseudo.id} ::before background-color`, `${own.id} self mask-image`]) {
        if (!seen.includes(want)) problems.push(`restyled: the planted ${want} was not read as changed (read: ${JSON.stringify(seen.slice(0, 6))})`);
    }
    await page.evaluate(sel => { for (const el of globalThis.document.querySelectorAll(sel)) el.remove(); }, own.selector);
    const d = await read(page, first.kind);
    if (d[own.id]?.found !== false) problems.push(`removed: ${own.id} taken out of the page still reads found`);
    console.log(`look-freeze: controls on ${first.id}: read twice ${twice.length} difference(s); planted ${pseudo.id}::before and ${own.id}'s mask read as `
        + `${JSON.stringify(seen.filter(s => s.startsWith(pseudo.id) || s.startsWith(own.id)))}; ${own.id} removed reads found: ${d[own.id]?.found}`);
    return problems;
}

function list() {
    const kinds = { sheet: "the sheet's parts (style-harness.html ?sheet=parts, 1920x1080 and 1366x768)", glass: "the glass harness's GM and player pages (4 sizes)" };
    for (const [kind, where] of Object.entries(kinds)) {
        console.log(`${where}:`);
        for (const s of SURFACES.filter(x => x.page === kind)) console.log(`  ${s.id.padEnd(26)} ${s.selector}${s.pseudo ? `  + ${s.pseudo.join(" ")}` : ""}`);
    }
    console.log("not frozen - no page draws it:");
    for (const [what, why] of NOT_DRAWN) console.log(`  ${what}: ${why}`);
    console.log(`${SURFACES.length} surface(s), ${SURFACES.reduce((n, s) => n + (s.pseudo?.length ?? 0), 0)} pseudo-element(s), ${PROPS.length} propert(ies) each; ${NOT_DRAWN.length} not drawn`);
}

async function main() {
    if (argv.includes("--list")) { list(); return 0; }
    if (!CHROMIUM && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
        console.log("look-freeze: name a Chromium (--chromium <executable>) or set PLAYWRIGHT_BROWSERS_PATH - the baseline is one build's");
        return 2;
    }
    const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
    const port = await freePort();
    const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: REPO, stdio: "ignore" });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) { try { await fetch(`${base}/module.json`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
    const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
    const build = `${browser.browserType().name()} ${browser.version()}`;
    const problems = [], readings = {};
    try {
        {
            const page = await browser.newPage({ viewport: { width: SIZES[0][0], height: SIZES[0][1] } });
            problems.push(...(await controls(page, base)).map(p => `control ${p}`));
            await page.close();
        }
        for (const [w, h] of SIZES) for (const theme of THEMES) {
            const page = await browser.newPage({ viewport: { width: w, height: h } });
            for (const p of PAGES) {
                if (p.sizes && !p.sizes.includes(`${w}x${h}`)) continue;
                await load(page, base, withTheme(p.url, theme));
                readings[`${p.id}|${theme}|${w}x${h}`] = await read(page, p.kind);
            }
            await page.close();
        }
    } finally {
        await browser.close();
        server.kill();
    }
    const old = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : null;
    let diffs = 0, accepted = 0, unfound = 0;
    const next = { ...(old?.readings ?? {}) };
    if (old && old.browser !== build && !WRITE) {
        problems.push(`the baseline was written by ${old.browser}, this is ${build}: nothing compared (a build's drift is not the module's; write the baseline with the build that checks it)`);
    } else {
        for (const [key, now] of Object.entries(readings)) {
            for (const [id, row] of Object.entries(now)) if (!row.found && old?.readings?.[key]?.[id]?.found) unfound++;
            if (!old || WRITE) { next[key] = now; continue; }
            if (!(key in old.readings)) { problems.push(`${key}: no row in the baseline`); diffs++; continue; }
            const merged = { ...old.readings[key] };
            for (const d of differences(old.readings[key], now)) {
                if (ACCEPT.has(d.id)) { accepted++; merged[d.id] = now[d.id]; continue; }
                diffs++;
                const [page, theme, size] = key.split("|");
                console.log(`look-freeze: ${page} ${d.id} at ${size}, ${theme}: ${d.what}`);
            }
            next[key] = merged;
        }
        if (diffs) problems.push(`${diffs} difference(s) from audit/look-freeze-baseline.json not accepted`);
    }
    const found = Object.values(readings).reduce((n, r) => n + Object.values(r).filter(x => x.found).length, 0);
    const asked = Object.values(readings).reduce((n, r) => n + Object.keys(r).length, 0);
    if ((WRITE || accepted || !old) && !problems.length) {
        fs.writeFileSync(BASELINE, `${JSON.stringify({
            about: "What audit/look-freeze.mjs read in one Chromium build (`browser`) on the sheet's parts and the glass harness's pages at each size and theme: readings[\"<page>|<theme>|<w>x<h>\"] = { surface: { found, self: { prop: value }, \"::before\": {...} } }. Written by the freeze's --write or --accept from a run, never by hand; a run in another build compares nothing.",
            browser: build, props: PROPS, readings: next
        })}\n`);
        console.log(`look-freeze: audit/look-freeze-baseline.json written (${Object.keys(next).length} reading(s), ${build}${accepted ? `, ${accepted} accepted` : ""})`);
    }
    for (const p of problems) console.log(`look-freeze: ${p}`);
    console.log(`look-freeze: ${build}; ${Object.keys(readings).length} reading(s), ${found} of ${asked} surface reading(s) found${unfound ? `, ${unfound} the baseline found and this run did not` : ""}; `
        + `${NOT_DRAWN.length} surface group(s) not drawn by any page (--list); ${diffs} difference(s) not accepted, ${accepted} accepted; ${problems.length ? "RED" : "green"}`);
    return problems.length || unfound ? 1 : 0;
}

process.exitCode = await main();
