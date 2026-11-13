/*
 * The character sheet's left column as Daggerheart 2.12.8 draws it, in Chromium: nothing in it may be wider than the
 * column, so it never scrolls sideways (fix-113e, 13.11.2026).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   node audit/sheet-column.mjs           (from the repository root) every case below; exit 1 when one scrolls
 *   node audit/sheet-column.mjs --chromium /opt/pw-browsers/chromium   names the browser instead of PLAYWRIGHT_BROWSERS_PATH's
 *   node audit/sheet-column.mjs --shots <dir>   also a screenshot of the column in each case
 *   node audit/sheet-column.mjs --json    one line of JSON a case, for a stage's notes
 *
 * WHY THIS FILE EXISTS. The owner at a table on 1.2.112 (13.11.2026): "The scroll in the character sheet still occurs" -
 * a student with nothing readied and no experiences, the column's lines cut off on the left and a sideways scrollbar at
 * its foot. 1.2.112 (E100, 69520df9) had called it fixed, measured on the style harness's sheet parts
 * (audit/style-harness.html `?sheet=parts`): the module's stylesheets alone on a stand-in of the sidebar, with one
 * readied item and one experience, so neither list was ever empty there and Daggerheart's own stylesheet was not
 * loaded. Here the column is the system's: its sidebar.hbs rendered (audit/sheet-column/sidebar-*.html) under the rules
 * of its compiled stylesheet that reach it (audit/sheet-column/daggerheart.css), the module's stylesheets in
 * module.json's order, and what sheet.mjs writes into it, by sheet.mjs's own classes: the Equipped heading
 * (`tidySidebar`), the Loadout hidden, the Equipped rows or the line that says none is readied
 * (`injectEquippedTools`), the Experience's empty line (`noteEmptyExperience`), the reserves on either resource layout
 * (`paintReserves`) and the state badges' row.
 * Measured at ceb9e9c8 (1.2.112) with it: the Experience's empty line one line wide, in the first track of the list's
 * grid, `max-content` - the column's scrollWidth 623 in a clientWidth of 264 under the glass, 1032 in 264 under Legacy.
 *
 * THE CASES. 1366x768 and 1920x1080; Stained Glass (its sheet 1120 wide, no resize handle) and Monokuma Legacy
 * (Daggerheart's 850, and 600, the narrowest this measures: the column is the grid's 275 px whatever the window's
 * width); both lists empty, and two readied items with two experiences; Daggerheart's bar layout and its pips
 * (`useResourcePips`); English and Polish. Each case twice: the system's stylesheet in a cascade layer above the
 * module's (as the module's notes read v14: stained-glass.css "Foundry v14 puts the system's sheet CSS in a cascade
 * layer above the module's") and with neither layered, so the reading does not hang on a cascade order nobody here has
 * read in v14's source.
 *
 * A CASE FAILS when the column (`.shortcut-items-section`, the part Daggerheart scrolls: overflow-y hidden, so its
 * overflow-x computes to auto) has a scrollWidth over its clientWidth; the line names, by hiding the column's
 * descendants one by one (E100's method), each one without which the column fits. It fails too when the case measured
 * nothing: the column under 200 px wide, the empty line not drawn where the lists are empty, or not two experience
 * rows where they are full.
 *
 * THE CONTROL (the stackShapes lesson: a count that cannot see a fault measures nothing): on the first case, before the sweep, a 400 px block is planted in
 * the Experience list and the column must read wider than its box and wider than it read clean a moment before; then
 * each case is loaded fresh. A sweep that cannot see that much proves nothing about less.
 *
 * WHAT IT IS NOT. Foundry's own stylesheet is not here (it is not public): the page stands in what the column reads of
 * it - every box border-box (`*, *::before, *::after`), the `--font-size-*` steps, a dark theme - and a window frame
 * that is a flex column. Not Foundry's window either: no header controls, no resize. A table's slider other than 100 %
 * is not drawn (the module scales the rail by it). The table's reading is the release's live check.
 *
 * WHAT RUNS IT. Nothing automatic: neither CI (no browser there) nor the local gate runs a Chromium sweep. Run it by
 * hand on a change to the sheet's sidebar, its rules in danganronpa.css, stained-glass.css or narrow.css, or a
 * Daggerheart upgrade (then audit/sheet-column/ is rendered again from the new release). R5840 holds the cause found
 * here in the suite, through the cascade reader, so a headless run catches that one again.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const shots = opt("--shots"), asJson = args.includes("--json");
if (shots) fs.mkdirSync(shots, { recursive: true });

let chromium;
try { ({ chromium } = createRequire(path.join(root, "audit", "harness", "package.json"))("playwright")); }
catch (err) { console.log(`sheet-column: no Playwright under ${root}/audit/harness (npm ci there): ${err.message.split("\n")[0]}`); process.exit(2); }
let browser;
try { browser = await chromium.launch(opt("--chromium") ? { executablePath: opt("--chromium") } : {}); }
catch (err) { console.log(`sheet-column: Chromium did not launch (--chromium <executable> names one): ${err.message.split("\n")[0]}`); process.exit(2); }

const styles = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8")).styles;
const lang = code => JSON.parse(fs.readFileSync(path.join(root, "lang", `${code}.json`), "utf8"));
const words = code => {
    const L = lang(code), at = key => key.split(".").reduce((o, k) => o?.[k], L);
    return { equipped: at("DRPG.Sheet.equipped"), noneReadied: at("DRPG.Items.noneReadied"), noExperiences: at("DRPG.SheetNotes.noExperiences") };
};

/* The page: Foundry's frame as far as the column reads it, the system's sidebar, its header and a tab beside it. */
const page = ({ theme, layered, layout, lists, width, height }) => {
    const sidebar = fs.readFileSync(path.join(root, "audit", "sheet-column", `sidebar-${layout}-${lists}.html`), "utf8");
    const sheet = (href, layer) => (layered ? `<style>@import url("${href}") layer(${layer});</style>` : `<link rel="stylesheet" href="${href}">`);
    return `<!doctype html><html><head><meta charset="utf-8">
<style>${layered ? "@layer drpg-module, drpg-system;" : ""}
*, *::before, *::after { box-sizing: border-box; }
:root { --font-size-10: 10px; --font-size-11: 11px; --font-size-12: 12px; --font-size-13: 13px; --font-size-14: 14px; --font-size-16: 16px;
  --font-size-18: 18px; --font-size-20: 20px; --font-size-24: 24px; --font-size-28: 28px; --font-size-32: 32px;
  --font-primary: sans-serif; --font-body: sans-serif; --color-border: #444; --fade-end: 0px; --fade-start: 0px; }
body { margin: 0; font-family: var(--font-primary); font-size: var(--font-size-14); color-scheme: dark; background: #222; }
ul { margin: 0; padding: 0; list-style: none; }
.application { position: absolute; left: 20px; top: 20px; display: flex; flex-direction: column; }
.application .window-content { flex: 1; min-height: 0; overflow: hidden; }
</style>
${sheet("/audit/sheet-column/daggerheart.css", "drpg-system")}
${styles.map(s => sheet(`/${s}`, "drpg-module")).join("\n")}
</head><body class="theme-dark ${theme === "glass" ? "drpg-theme-stained-glass" : "drpg-theme-monokuma-legacy drpg-pixel-font"} drpg-player" data-drpg-time="afternoon" data-drpg-phase="dailyLife">
<form class="application sheet daggerheart actor dh-style character themed theme-dark" style="width: ${width}px; height: ${height}px">
<header class="window-header"><h1 class="window-title">Aiko Tanaka</h1></header>
<section class="window-content">${sidebar}<div class="character-header-sheet"></div><section class="tab features active" data-group="primary" data-tab="features"></section></section>
</form></body></html>`;
};

/* What sheet.mjs writes into the sidebar, by its own classes (see the header). */
function inject({ full, t }) {
    const sb = document.querySelector(".character-sidebar-sheet");
    const h3 = sb.querySelector(".equipment-section h3");
    h3.textContent = t.equipped;
    h3.dataset.drpgRenamed = "1";
    sb.querySelector(".loadout-section").classList.add("drpg-hidden-block");
    const list = sb.querySelector(".equipment-section .items-sidebar-list");
    if (full) {
        for (const [category, name, tag] of [["crimeTool", "Kitchen knife", "Murder Weapon"], ["cleaningTool", "Bleach and a scrubbing brush", "Cleaning Tool"]]) {
            const li = document.createElement("li");
            li.className = "inventory-item inventory-item-compact drpg-equipped-tool";
            li.dataset.drpgEquipped = category;
            li.innerHTML = `<div class="img-portait"><img src="" class="item-img" alt="" /></div><span class="item-name">${name}</span>`
                + `<div class="item-labels"><div class="label"><span class="drpg-equipped-tag">${tag}</span><span class="drpg-equipped-tier"> - T1</span></div></div>`;
            list.append(li);
        }
    } else {
        const li = document.createElement("li");
        li.className = "drpg-equipped-empty";
        li.textContent = t.noneReadied;
        list.append(li);
        const p = document.createElement("p");
        p.className = "notes drpg-experience-empty";
        p.textContent = t.noExperiences;
        sb.querySelector(".experience-section .experience-list").append(p);
    }
    const section = sb.querySelector(".resources-section");
    for (const [key, action, max] of [["hitPoints", "toggleHitPoints", 4], ["stress", "toggleStress", 6]]) {
        const pips = !!section.querySelector(".slot-value");
        const block = pips ? section.querySelector(`.slot[data-action='${action}']`).closest(".slot-value")
            : section.querySelector(`input.bar-input[name="system.resources.${key}.value"]`).closest(".status-bar");
        block.dataset.drpgReserve = key;
        const row = document.createElement("div");
        row.className = "drpg-reserve-row";
        if (pips) {
            block.querySelector(".slot-bar").classList.add("drpg-reserve-hidden");
            block.querySelector(".slot-label .value").classList.add("drpg-reserve-hidden");
            const box = document.createElement("div");
            box.className = "drpg-reserve-pips";
            for (let n = 1; n <= max; n++) { const pip = document.createElement("span"); pip.className = "drpg-reserve-pip drpg-pip-full"; box.append(pip); }
            block.querySelector(".slot-bar").after(box);
            box.after(row);
        } else {
            const value = block.querySelector(".status-value"), progress = value.querySelector("progress");
            for (const el of value.children) if (el.matches("input.bar-input, .bar-label") || (el.localName === "span" && el.textContent.trim() === "/")) el.classList.add("drpg-reserve-hidden");
            progress.classList.add("drpg-bar-replaced");
            const track = document.createElement("div");
            track.className = "drpg-resource-bar";
            track.dataset.resource = key;
            track.innerHTML = `<span class="drpg-resource-fill" style="width: 100%"></span>`;
            progress.after(track);
            value.append(row);
        }
        const field = Object.assign(document.createElement("input"), { type: "number", className: "drpg-reserve-field", min: "0", max: String(max), value: String(max) });
        row.replaceChildren(field, ` / ${max}`);
    }
    const badges = document.createElement("div");
    badges.className = "drpg-state-badges";
    section.after(badges);
}

/* The column's reading: its widths, what the case drew, and each descendant without which it fits. */
function measure() {
    const col = document.querySelector(".character-sidebar-sheet .shortcut-items-section");
    const name = el => el.localName + [...el.classList].map(c => `.${c}`).join("") + (el.dataset.drpgEquipped ? `[${el.dataset.drpgEquipped}]` : "");
    const culprits = [];
    if (col.scrollWidth > col.clientWidth) {
        for (const el of col.querySelectorAll("*")) {
            const was = el.style.getPropertyValue("display"), prio = el.style.getPropertyPriority("display");
            el.style.setProperty("display", "none", "important");
            const fits = col.scrollWidth <= col.clientWidth;
            el.style.setProperty("display", was, prio);
            if (fits) culprits.push(name(el));
        }
    }
    const empty = col.querySelector(".drpg-experience-empty");
    return {
        scrollWidth: col.scrollWidth, clientWidth: col.clientWidth,
        emptyDrawn: !!empty && empty.getBoundingClientRect().height > 0,
        rows: col.querySelectorAll(".experience-row").length,
        culprits
    };
}

const SIZES = [[1366, 768], [1920, 1080]];
const cases = [];
for (const [vw, vh] of SIZES) for (const theme of ["glass", "legacy"]) {
    const widths = theme === "glass" ? [Math.min(1120, vw - 48)] : [Math.min(850, vw - 48), 600];
    const height = Math.min(theme === "glass" ? 1160 : 800, vh - 48);
    for (const width of widths) for (const lists of ["empty", "full"]) for (const layout of ["bar", "pips"]) for (const code of ["en", "pl"]) for (const layered of [true, false]) {
        cases.push({ vw, vh, theme, width, height, lists, layout, code, layered });
    }
}

const open = async c => {
    const ctx = await browser.newContext({ viewport: { width: c.vw, height: c.vh }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    await pg.route("http://sheet-column.local/**", route => {
        const p = decodeURIComponent(new URL(route.request().url()).pathname);
        if (p === "/") return route.fulfill({ contentType: "text/html", body: page(c) });
        const file = path.join(root, p);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ path: file });
    });
    await pg.goto("http://sheet-column.local/");
    await pg.evaluate(inject, { full: c.lists === "full", t: words(c.code) });
    await pg.evaluate(() => document.fonts.ready);
    await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return { ctx, pg };
};
const label = c => `${c.vw}x${c.vh} ${c.theme} ${c.width}w ${c.lists} ${c.layout} ${c.code} ${c.layered ? "layered" : "unlayered"}`;

let bad = 0;
/* THE CONTROL, on the first case. */
{
    const { ctx, pg } = await open(cases[0]);
    const clean = await pg.evaluate(measure);
    await pg.evaluate(() => {
        const plant = document.createElement("div");
        plant.className = "drpg-sheet-column-plant";
        plant.style.cssText = "width: 400px; height: 4px";
        document.querySelector(".character-sidebar-sheet .experience-section .experience-list").append(plant);
    });
    const read = await pg.evaluate(measure);
    // Seen: the column wider than its box and wider than it read clean a moment before (so a column that already
    // scrolls still has to see the block).
    const seen = read.scrollWidth > read.clientWidth && read.scrollWidth > clean.scrollWidth;
    console.log(`control (a 400 px block planted, ${label(cases[0])}): ${clean.scrollWidth} in ${clean.clientWidth} clean, ${read.scrollWidth} in ${read.clientWidth} planted - ${seen ? "seen" : "NOT SEEN"}`);
    if (!seen) bad++;
    await ctx.close();
}

for (const c of cases) {
    const { ctx, pg } = await open(c);
    const m = await pg.evaluate(measure);
    if (shots) await pg.locator(".character-sidebar-sheet").screenshot({ path: path.join(shots, `${label(c).replace(/\s+/g, "-")}.png`) });
    await ctx.close();
    const why = [];
    if (m.scrollWidth > m.clientWidth) why.push(`scrolls: ${m.scrollWidth} in ${m.clientWidth}, [${m.culprits.join(", ")}]`);
    if (m.clientWidth < 200) why.push(`measured nothing: the column ${m.clientWidth} px wide`);
    if (c.lists === "empty" && !m.emptyDrawn) why.push("measured nothing: the Experience's empty line not drawn");
    if (c.lists === "full" && m.rows !== 2) why.push(`measured nothing: ${m.rows} experience rows, not 2`);
    if (why.length) bad++;
    if (asJson) console.log(JSON.stringify({ ...c, ...m, ok: !why.length }));
    else console.log(`${why.length ? "FAIL" : "ok  "} ${label(c)}: ${m.scrollWidth} in ${m.clientWidth}${why.length ? ` - ${why.join("; ")}` : ""}`);
}
await browser.close();
console.log(`sheet-column: ${cases.length} cases, ${bad} not right`);
process.exit(bad ? 1 : 0);
