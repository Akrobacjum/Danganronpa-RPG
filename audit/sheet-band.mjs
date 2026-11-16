/*
 * The character sheet's header band as Daggerheart 2.12.8 draws it, in Chromium: under Stained Glass the glass that glass.mjs
 * paints into the band reaches the band's edges, so no strip of the map shows between the left column and the band, or
 * at the band's right edge (16.11.2026).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   node audit/sheet-band.mjs             (from the repository root) every case below; exit 1 when one is not right
 *   node audit/sheet-band.mjs --chromium /opt/pw-browsers/chromium   names the browser instead of PLAYWRIGHT_BROWSERS_PATH's
 *   node audit/sheet-band.mjs --shots <dir>   also two screenshots a case at deviceScaleFactor 2: the joint of the left
 *                                             column and the band (the owner's crop) and the sheet's top
 *   node audit/sheet-band.mjs --json      one line of JSON a case
 *
 * WHY THIS FILE EXISTS. The owner at a table on 16.11.2026, a screenshot of a student's sheet under Stained Glass: "Taka
 * mala poprawka do kart postaci - dziura w kurtyne (krawedz ramki hope). Przeciagnijmy kurtyne do krawedzi sanity." -
 * a strip about 15 px wide between the Sanity box's right edge and the Hope frame's left edge where the map showed
 * through, frosted, instead of the band's glass. The curtain the owner names is that glass: glass.mjs `dressWindow`
 * puts the band's canvases (`canvas.sg`, and `layerAfter`'s `canvas.pulse` and `canvas.seamline`) into the header as its
 * first children, and Daggerheart's `.character-header-sheet > *:not(line-div, .tab-navigation) { padding-left: 15px;
 * padding-right: 15px }` (0,8,0; its header's rows stand 15 px in) reached them too. A canvas draws its bitmap into its
 * content box, so the glass stood 15 px in from each side of a band that runs from the left column's edge to the window's.
 * Measured here at aa697521: no glass in the band's first 15 px and its last 15 in every glass case, the map nowhere
 * across the band under Legacy, which has no glass (the header stands on the window's ink: danganronpa.css "THE SHEET
 * SITS ON INK").
 *
 * THE PAGE. Daggerheart 2.12.8's sidebar.hbs and header.hbs rendered (audit/sheet-column/sidebar-bar-full.html,
 * header.html), the rules of its compiled stylesheet that reach them (audit/sheet-column/daggerheart.css, then
 * daggerheart-header.css), the module's stylesheets in module.json's order, and the band dressed as glass.mjs dresses it:
 * `drpg-glass-band` on the header and its three canvases, each `canvas.sg`'s size the band's client box, as `paintBand`
 * sizes it. The map under the window is one colour (#00ff00) and the glass is painted opaque in another (#ff00ff), so a
 * column of pixels shows either the glass, the map (through the band's frosted 2 % white, or straight through), or the
 * window's own ground. The band's rows - the name, the Hope frame, the traits, the tabs - are hidden for the reading
 * (`visibility`, so they are laid out as before): it reads where the glass is painted, not what stands on it.
 *
 * THE CASES. A desk at 1366x768 and 1920x1080: Stained Glass's sheet 1120 wide, Monokuma Legacy's 850 and 600 (as
 * audit/sheet-column.mjs); a stacked screen (`drpg-stacked`) at 1024x768, the sheet its 1008 px ceiling (narrow.css), two
 * columns, and at 390x844, 374 px, where danganronpa.css "ONE COLUMN ON A PHONE" stands the rail over the header - the
 * band then runs from the window's left edge, not the rail's. Both heights are over `BREAKPOINTS.short`, so glass.mjs
 * `glassRoom` dresses the band there too. Each case in two cascade orders: the module's sheets in a layer after the
 * system's, and neither layered (specificity decides).
 *   WHICH ORDER IS THE TABLE'S, READ OFF THE OWNER'S SCREENSHOT: its Hope frame's edge is #ffd23f (255, 210, 63), the
 *   module's `--drpg-gold` from danganronpa.css's `.character-header-sheet .hope-section { border-color }` at (0,2,0),
 *   against Daggerheart's `border: 1px solid var(--color-border)` on the same frame at (0,9,0). On Daggerheart 2.12.8's
 *   whole stylesheet with the module's (a scratch page, 16.11.2026) the frame read #ffd23f with the module's sheets in a
 *   layer after the system's, and the system's golden rgb(243, 194, 103) in the other two orders (neither layered, or the
 *   system's after the module's); on this page neither layered reads rgba(228, 222, 216, 0.66), not #ffd23f either. So
 *   the first is the order a case checks, and its Hope edge is held to #ffd23f as this page's control that the order is
 *   the table's. The order with the system's sheet after the
 *   module's, which other notes of this module assume (audit/sheet-column.mjs, several `!important`s in the sheets), is
 *   not run: on the owner's screen that is not how v14 laid the two out (LIVE-E30-09 is the check that reads it).
 *
 * A CASE FAILS when, on any of three rows of the band (the middles of its name row, its Hope row and its traits), a
 * column stands without glass between the band's left reference - the left column's right edge on two columns, the
 * window's left edge on one - and the first column of glass, or between the last column of glass and the band's right
 * edge; under Legacy, when any column of the map shows across the band at all. It fails too when the case measured
 * nothing: no band, a band under 200 px wide, under Stained Glass not three canvases in it or no glass on a row, the rail
 * not where the layout puts it, or the Hope edge not #ffd23f in the table's order.
 *
 * THE CONTROLS (the stackShapes lesson: a count that cannot see a fault measures nothing): on the first glass case, before
 * the sweep, the band's canvases are moved 10 px right (`margin-left`, inline) and the left reading must grow by 10 over the
 * clean one a moment before; and on the first Legacy case the window's ink is taken away (`background`, inline and
 * `!important`, on the window and its content) and the map must show across more of the band than the 15 px of a row's
 * padding.
 *
 * WHAT IT IS NOT. Foundry's own stylesheet and frame are not here, as in audit/sheet-column.mjs; the glass is a flat
 * colour, not glass.mjs's panes; a table's slider other than 100 % is not drawn; sheet.mjs's rows in the header (the
 * Ultimate, the actions) are not drawn, and they stand inside the band, not at its edges. What a table shows is the
 * release's live check.
 *
 * WHAT RUNS IT. Nothing automatic: neither CI (no browser there) nor the local gate runs a Chromium sweep. Run it by hand
 * on a change to the band (glass.mjs `dressBand`, `paintBand`), to the header's rules in danganronpa.css, stained-glass.css
 * or narrow.css, or on a Daggerheart upgrade (then audit/sheet-column/header.html and daggerheart-header.css are rendered
 * again from the new release). R7780 holds the cause found here in the suite, through the cascade reader.
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
catch (err) { console.log(`sheet-band: no Playwright under ${root}/audit/harness (npm ci there): ${err.message.split("\n")[0]}`); process.exit(2); }
let browser;
try { browser = await chromium.launch(opt("--chromium") ? { executablePath: opt("--chromium") } : {}); }
catch (err) { console.log(`sheet-band: Chromium did not launch (--chromium <executable> names one): ${err.message.split("\n")[0]}`); process.exit(2); }

const styles = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8")).styles;
const part = name => fs.readFileSync(path.join(root, "audit", "sheet-column", name), "utf8");
const MAP = "#00ff00", GLASS = "#ff00ff";

/* The page: Foundry's frame as far as the band reads it (audit/sheet-column.mjs's), the system's sidebar and header, a tab. */
const page = ({ theme, order, stacked, width, height, look }) => {
    const sheet = (href, layer) => (order === "modules" ? `<style>@import url("${href}") layer(${layer});</style>` : `<link rel="stylesheet" href="${href}">`);
    // `look` (the screenshots): a striped map, so the strip reads as the owner saw it; the measure's map is one colour
    const ground = look ? "repeating-linear-gradient(45deg, #5d6150 0 6px, #74786a 6px 12px)" : MAP;
    return `<!doctype html><html><head><meta charset="utf-8">
<style>${order === "modules" ? "@layer drpg-system, drpg-module;" : ""}
:root, body { --drpg-ui-scale: 1; --drpg-type-scale: 1; --drpg-slider-scale: 1; --drpg-legacy-scale: 1; --drpg-floor-scale: 1; }
*, *::before, *::after { box-sizing: border-box; }
:root { --font-size-10: 10px; --font-size-11: 11px; --font-size-12: 12px; --font-size-13: 13px; --font-size-14: 14px; --font-size-16: 16px;
  --font-size-18: 18px; --font-size-20: 20px; --font-size-24: 24px; --font-size-28: 28px; --font-size-32: 32px;
  --font-primary: sans-serif; --font-body: sans-serif; --color-border: #444; --fade-end: 0px; --fade-start: 0px; }
body { margin: 0; font-family: var(--font-primary); font-size: var(--font-size-14); color-scheme: dark; background: ${ground}; }
ul { margin: 0; padding: 0; list-style: none; }
.application { position: absolute; left: 8px; top: 8px; display: flex; flex-direction: column; }
.application .window-content { flex: 1; min-height: 0; overflow: hidden; }
</style>
${sheet("/audit/sheet-column/daggerheart.css", "drpg-system")}
${sheet("/audit/sheet-column/daggerheart-header.css", "drpg-system")}
${styles.map(s => sheet(`/${s}`, "drpg-module")).join("\n")}
</head><body class="theme-dark ${theme === "glass" ? "drpg-theme-stained-glass" : "drpg-theme-monokuma-legacy drpg-pixel-font"} drpg-player${stacked ? " drpg-stacked" : ""}" data-drpg-time="afternoon" data-drpg-phase="dailyLife">
<form class="application sheet daggerheart actor dh-style character themed theme-dark" style="width: ${width}px; height: ${height}px">
<header class="window-header"><h1 class="window-title">Aiko</h1></header>
<section class="window-content">${part("sidebar-bar-full.html")}${part("header.html")}<section class="tab features active" data-group="primary" data-tab="features"></section></section>
</form></body></html>`;
};

/* The band dressed as glass.mjs `dressWindow` dresses it under the glass: the class, `canvas.sg` first in the header and
   sized to the band's client box (`paintBand`), `pulse` and `seamline` after it with `layerAfter`'s inline style. The
   glass is painted opaque in one colour (`look`: dark, with a few seams, for the screenshots). */
function dress({ theme, look, glass }) {
    const band = document.querySelector(".character-header-sheet");
    if (theme !== "glass") return;
    band.classList.add("drpg-glass-band");
    const W = Math.max(60, Math.round(band.clientWidth)), H = Math.max(24, Math.round(band.clientHeight));
    const sg = document.createElement("canvas");
    sg.className = "sg"; sg.width = W; sg.height = H; band.prepend(sg);
    const g = sg.getContext("2d");
    if (look) {
        g.fillStyle = "rgb(16, 15, 21)"; g.fillRect(0, 0, W, H);
        g.strokeStyle = "rgba(242, 238, 230, 0.4)"; g.lineWidth = 1.5;
        for (const [x0, y0, x1, y1] of [[0, H * 0.62, W * 0.35, H * 0.4], [W * 0.35, 0, W * 0.47, H], [W * 0.7, 0, W * 0.6, H], [W * 0.47, H * 0.55, W, H * 0.3]]) {
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        }
    } else { g.fillStyle = glass; g.fillRect(0, 0, W, H); }
    const LAYER = "position:absolute;inset:0;width:100%;height:100%;";
    for (const cls of ["seamline", "pulse"]) {
        const c = document.createElement("canvas");
        c.className = cls; c.style.cssText = LAYER; c.width = W; c.height = H; sg.after(c);
    }
}

/* The boxes a case reads: the band, the rail, the window's content, the three rows, the canvases' padding, the Hope edge. */
function boxes() {
    const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
    const band = document.querySelector(".character-header-sheet"), rail = document.querySelector(".character-sidebar-sheet");
    const content = document.querySelector(".window-content");
    const mid = sel => { const el = band.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return Math.round(b.top + b.height / 2); };
    const hope = band.querySelector(".hope-section");
    return {
        band: r(band), rail: r(rail), content: r(content),
        rows: [mid(".name-row"), mid(".character-row"), mid(".character-traits")],
        canvases: [...band.querySelectorAll(":scope > canvas")].map(c => { const s = getComputedStyle(c); return `${c.className} ${s.paddingLeft}/${s.paddingRight}`; }),
        hopeEdge: hope ? getComputedStyle(hope).borderLeftColor : null
    };
}

/* Each row of pixels read off a screenshot. Under the glass: the columns from the left reference to the first column of
   glass, and from the last column of glass to the band's right edge - whatever stands there instead (the map seen through
   the band's frosted 2 %, darkened by the theme's backdrop filter: (33, 80, 36) on #00ff00 here, so not a colour to test
   for). Under Legacy, with no glass, the columns anywhere on the row where the map shows - as it is, since nothing
   frosts it there. */
async function readRows(pg, png, b, theme) {
    // the screenshot is decoded in the page (no image library in audit/harness)
    return pg.evaluate(async ({ data, band, from, rows, glassTheme }) => {
        const img = document.createElement("img");
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height }), g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        // the glass: the opaque marker (#ff00ff); the bare map: #00ff00
        const glass = (r, gr, bl) => r > 180 && bl > 180 && gr < 90, map = (r, gr, bl) => gr > 200 && r < 60 && bl < 60;
        const x0 = Math.round(from), x1 = Math.round(band.right);
        return rows.map(y => {
            const px = g.getImageData(0, y, img.width, 1).data, at = x => [px[4 * x], px[4 * x + 1], px[4 * x + 2]];
            if (!glassTheme) {
                let shown = 0;
                for (let x = x0; x < x1; x++) if (map(...at(x))) shown++;
                return { y, left: shown, right: 0, glass: null };
            }
            let first = -1, last = -1;
            for (let x = x0; x < x1; x++) if (glass(...at(x))) { if (first < 0) first = x; last = x; }
            return first < 0 ? { y, left: x1 - x0, right: x1 - x0, glass: false } : { y, left: first - x0, right: x1 - 1 - last, glass: true };
        });
    }, { data: png.toString("base64"), band: b.band, from: b.from, rows: b.rows, glassTheme: theme === "glass" });
}

const SIZES = [
    { vw: 1366, vh: 768, stacked: false }, { vw: 1920, vh: 1080, stacked: false },
    { vw: 1024, vh: 768, stacked: true }, { vw: 390, vh: 844, stacked: true }
];
const cases = [];
for (const s of SIZES) for (const theme of ["glass", "legacy"]) {
    const ceiling = s.stacked ? s.vw - 16 : s.vw - 48;
    const widths = theme === "glass" ? [Math.min(1120, ceiling)] : s.stacked ? [Math.min(850, ceiling)] : [Math.min(850, ceiling), 600];
    const height = Math.min(theme === "glass" ? 1160 : 800, s.vh - 16);
    for (const width of widths) for (const order of ["modules", "unlayered"]) cases.push({ ...s, theme, width, height, order });
}

const open = async (c, { look = false, scale = 1, plant = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: c.vw, height: c.vh }, deviceScaleFactor: scale });
    const pg = await ctx.newPage();
    await pg.route("http://sheet-band.local/**", route => {
        const p = decodeURIComponent(new URL(route.request().url()).pathname);
        if (p === "/") return route.fulfill({ contentType: "text/html", body: page({ ...c, look }) });
        const file = path.join(root, p);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ path: file });
    });
    await pg.goto("http://sheet-band.local/");
    await pg.evaluate(() => document.fonts.ready);
    await pg.evaluate(dress, { theme: c.theme, look, glass: GLASS });
    if (plant === "move") await pg.evaluate(() => document.querySelectorAll(".character-header-sheet > canvas").forEach(cv => { cv.style.marginLeft = "10px"; }));
    if (plant === "bare") await pg.evaluate(() => document.querySelectorAll(".application, .window-content").forEach(el => el.style.setProperty("background", "transparent", "important")));
    // the measure reads the glass, not what stands on it: the band's rows are hidden (laid out as before), the screenshots keep them
    if (!look) await pg.evaluate(() => document.querySelectorAll(".character-header-sheet > :not(canvas)").forEach(el => { el.style.visibility = "hidden"; }));
    await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return { ctx, pg };
};
const label = c => `${c.vw}x${c.vh}${c.stacked ? " stacked" : ""} ${c.theme} ${c.width}w ${c.order}`;

async function measure(c, opts = {}) {
    const { ctx, pg } = await open(c, opts);
    const b = await pg.evaluate(boxes);
    // one column when the rail stands over the band (the phone's container query), two when it stands beside it
    b.columns = b.rail.bottom <= b.band.top + 1 ? 1 : 2;
    b.from = b.columns === 2 ? b.rail.right : b.content.left;
    const png = await pg.screenshot();
    const rows = b.rows.every(y => Number.isFinite(y)) ? await readRows(pg, png, b, c.theme) : [];
    await ctx.close();
    return { ...b, read: rows, left: Math.max(0, ...rows.map(r => r.left)), right: Math.max(0, ...rows.map(r => r.right)) };
}

let bad = 0;
/* THE CONTROLS, on the first case of each theme. */
{
    const glass = cases.find(c => c.theme === "glass"), legacy = cases.find(c => c.theme === "legacy");
    const clean = await measure(glass), planted = await measure(glass, { plant: "move" });
    const seen = planted.left >= clean.left + 10;
    console.log(`control (the band's canvases moved 10 px right, ${label(glass)}): no glass in the first ${clean.left} px clean, ${planted.left} planted - ${seen ? "seen" : "NOT SEEN"}`);
    const bareClean = await measure(legacy), bare = await measure(legacy, { plant: "bare" });
    const bareSeen = bare.left > Math.max(15, bareClean.left);
    console.log(`control (the window's ink taken away, ${label(legacy)}): the map ${bareClean.left} px across the band clean, ${bare.left} planted - ${bareSeen ? "seen" : "NOT SEEN"}`);
    if (!seen || !bareSeen) bad++;
}

for (const c of cases) {
    const m = await measure(c);
    if (shots) {
        const { ctx, pg } = await open(c, { look: true, scale: 2 });
        const b = await pg.evaluate(boxes);
        const from = m.columns === 2 ? b.rail.right : b.content.left;
        const x = Math.max(0, Math.round(from - 140)), y = Math.max(0, Math.round(b.band.top));
        await pg.screenshot({ path: path.join(shots, `${label(c).replace(/\s+/g, "-")}-joint.png`), clip: { x, y, width: Math.min(330, c.vw - x), height: Math.min(260, c.vh - y) } });
        await pg.screenshot({ path: path.join(shots, `${label(c).replace(/\s+/g, "-")}-top.png`), clip: { x: 0, y: 0, width: c.vw, height: Math.min(c.vh, Math.round(b.band.bottom) + 40) } });
        await ctx.close();
    }
    const why = [];
    if (c.theme === "glass") {
        if (m.left) why.push(`no glass in the band's first ${m.left} px, from ${Math.round(m.from)}`);
        if (m.right) why.push(`no glass in the band's last ${m.right} px, to ${Math.round(m.band.right)}`);
        if (m.canvases.length !== 3) why.push(`measured nothing: ${m.canvases.length} canvases in the band, not 3`);
        if (!m.read.length || m.read.some(r => !r.glass)) why.push("measured nothing: a row of the band with no glass on it");
    } else if (m.left) why.push(`the map shows ${m.left} px across the band`);
    if (m.band.width < 200) why.push(`measured nothing: the band ${Math.round(m.band.width)} px wide`);
    if (m.read.length !== 3) why.push(`measured nothing: ${m.read.length} rows read, not 3`);
    if (m.columns === 2 && Math.abs(m.rail.right - m.band.left) > 1) why.push(`measured nothing: the band starts at ${m.band.left}, the rail ends at ${m.rail.right}`);
    if (c.vw === 390 && m.columns !== 1) why.push("measured nothing: two columns on the phone, where the rail stands over the band");
    if (c.order === "modules" && m.hopeEdge !== "rgb(255, 210, 63)") why.push(`not the table's order: the Hope edge ${m.hopeEdge}, the owner's screenshot rgb(255, 210, 63)`);
    if (why.length) bad++;
    if (asJson) console.log(JSON.stringify({ ...c, ...m, ok: !why.length }));
    else console.log(`${why.length ? "FAIL" : "ok  "} ${label(c)}: ${m.columns} column${m.columns === 1 ? "" : "s"}, ${c.theme === "glass" ? `no glass ${m.left} px left, ${m.right} px right` : `the map ${m.left} px`}; canvases [${m.canvases.join(", ")}]${why.length ? ` - ${why.join("; ")}` : ""}`);
}
await browser.close();
console.log(`sheet-band: ${cases.length} cases, ${bad} not right`);
process.exit(bad ? 1 : 0);
