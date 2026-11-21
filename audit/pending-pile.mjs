/*
 * The sheet's effect badges as a pile, in Chromium (1.2.119; the owner, 20.11.2026, on a screenshot of a student's sheet
 * with three badges pushing the header apart: "efekty rozjezdzaja karte. Niech stackuja sie na sobie, a najechanie
 * myszka niech wyciaga ten, na ktory najezdzamy myszka na wierzch, tak jakby byly w stosie").
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   node audit/pending-pile.mjs           (from the repository root) every case below; exit 1 when one is not right
 *   node audit/pending-pile.mjs --root <checkout>   the stylesheets and sheet-header.mjs of another checkout (the
 *                                                   "before" pictures: a worktree of main); the checks are then printed,
 *                                                   not held, since the pile is not there to hold
 *   node audit/pending-pile.mjs --shots <dir>       also a screenshot a case at deviceScaleFactor 2: the header's row
 *   node audit/pending-pile.mjs --chromium <executable>   names the browser instead of PLAYWRIGHT_BROWSERS_PATH's
 *
 * THE PAGE. audit/sheet-band.mjs's: Daggerheart 2.12.8's sidebar and header rendered (audit/sheet-column/), the rules of
 * its stylesheet that reach them, the module's stylesheets in module.json's order in a layer after the system's (the
 * table's order, read off the owner's screenshot: sheet-band.mjs's note), and under Stained Glass the header's band
 * dressed as glass.mjs dresses it, in a flat dark glass. Into it the Actions section is drawn by the module's own
 * sheet-header.mjs `injectActionBar` - its pips, its free Move and its stack (`pendingStack`, `pileStack`) - served as it
 * is in the checkout; every module it imports is served as a stand-in that exports the names it imports, with the answers
 * a case needs (two actions, one left; the badges' entries: `armedCallsShown`'s Calls, timed-effects.mjs `effectBadges`'s
 * effects, a Call's silence for a standing one). So the markup and the pile are the module's; what stands around them is
 * not Foundry's (no frame, no fonts but the module's), and a table's slider other than 100 % is not drawn.
 *
 * THE CASES. Both themes, at a desk (1366x768, the sheet 850 wide) and stacked (`drpg-stacked`, 390x844, the sheet 374,
 * where the rail stands over the header), with 0, 1, 3 and 6 badges, and for 3 and 6 the pointer on the second badge's
 * strip (a real mouse move, so the module's listener picks the badge). A case reads the header row's height, the stack's
 * box, each badge's top and which element stands under the pointer.
 *
 * A CASE FAILS (not with --root) when the header row with more badges is taller than with one, the stack is taller than
 * 3rem, the badges' tops do not step down by the same step with the drops adding up to at most 20 px, the last badge is
 * not the one on top at rest, or with the pointer on the second badge's strip that badge is not the element under it;
 * and when it measured nothing: no stack, fewer badges than asked. A stack drawn past the screen's right edge is not
 * pointed at, and said: on the phone (390 px) the header's row is wider than the sheet on b5a29e73 as on this branch
 * (the stack at x 355-527 under Legacy, 409-574 under Stained Glass, read 20.11.2026), which the pile does not change.
 *
 * WHAT RUNS IT. Nothing automatic (no browser in CI or the local gate). R7900 holds the cascade and the pile's numbers
 * in the suite; this is the picture and the heights.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const root = path.resolve(opt("--root") ?? here), holding = !opt("--root");
const shots = opt("--shots");
if (shots) fs.mkdirSync(shots, { recursive: true });

let chromium;
try { ({ chromium } = createRequire(path.join(here, "audit", "harness", "package.json"))("playwright")); }
catch (err) { console.log(`pending-pile: no Playwright under ${here}/audit/harness (npm ci there): ${err.message.split("\n")[0]}`); process.exit(2); }
let browser;
try { browser = await chromium.launch(opt("--chromium") ? { executablePath: opt("--chromium") } : {}); }
catch (err) { console.log(`pending-pile: Chromium did not launch (--chromium <executable> names one): ${err.message.split("\n")[0]}`); process.exit(2); }

const styles = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8")).styles;
const part = name => fs.readFileSync(path.join(here, "audit", "sheet-column", name), "utf8");

/* The stand-ins: for each module sheet-header.mjs imports, the names it imports, each read off `globalThis.__pile` by
   name when the case gives one, else a function that answers nothing. */
const header = fs.readFileSync(path.join(root, "scripts", "sheet-header.mjs"), "utf8");
const imported = new Map();
for (const [, names, file] of header.matchAll(/^import\s*\{([^}]*)\}\s*from\s*"\.\/([\w-]+\.mjs)";/gm)) {
    const list = imported.get(file) ?? [];
    for (const one of names.split(",").map(n => n.trim()).filter(Boolean)) list.push(one.split(/\s+as\s+/)[0].trim());
    imported.set(file, list);
}
const standIn = file => (imported.get(file) ?? []).map(name => `export const ${name} = globalThis.__pile?.[${JSON.stringify(name)}] ?? (() => null);`).join("\n");

const page = ({ theme, stacked, width }) => `<!doctype html><html><head><meta charset="utf-8">
<style>@layer drpg-system, drpg-module;
:root, body { --drpg-ui-scale: 1; --drpg-type-scale: 1; --drpg-slider-scale: 1; --drpg-legacy-scale: 1; --drpg-floor-scale: 1; }
*, *::before, *::after { box-sizing: border-box; }
:root { --font-size-10: 10px; --font-size-11: 11px; --font-size-12: 12px; --font-size-13: 13px; --font-size-14: 14px; --font-size-16: 16px;
  --font-size-18: 18px; --font-size-20: 20px; --font-size-24: 24px; --font-size-28: 28px; --font-size-32: 32px;
  --font-primary: sans-serif; --font-body: sans-serif; --color-border: #444; --fade-end: 0px; --fade-start: 0px; }
body { margin: 0; font-family: var(--font-primary); font-size: var(--font-size-14); color-scheme: dark; background: repeating-linear-gradient(45deg, #5d6150 0 6px, #74786a 6px 12px); }
ul { margin: 0; padding: 0; list-style: none; }
.application { position: absolute; left: 8px; top: 8px; display: flex; flex-direction: column; }
.application .window-content { flex: 1; min-height: 0; overflow: hidden; }
</style>
<style>@import url("/audit/sheet-column/daggerheart.css") layer(drpg-system);</style>
<style>@import url("/audit/sheet-column/daggerheart-header.css") layer(drpg-system);</style>
${styles.map(s => `<style>@import url("/${s}") layer(drpg-module);</style>`).join("\n")}
</head><body class="theme-dark ${theme === "glass" ? "drpg-theme-stained-glass" : "drpg-theme-monokuma-legacy drpg-pixel-font"} drpg-player${stacked ? " drpg-stacked" : ""}" data-drpg-time="afternoon" data-drpg-phase="dailyLife">
<form class="application sheet daggerheart actor dh-style character themed theme-dark" style="width: ${width}px; height: 700px">
<header class="window-header"><h1 class="window-title">Tester 1</h1></header>
<section class="window-content">${part("sidebar-bar-full.html")}${part("header.html")}<section class="tab features active" data-group="primary" data-tab="features"></section></section>
</form></body></html>`;

/* The badges of a case, as their three sources hand them to `pendingStack`: a standing effect (a Call's silence), the
   armed Calls, the timed effects - the owner's three first ("Experience +1", "+1 Shadow", "+1 Body"). */
const BADGES = [
    { kind: "call", key: "experience", label: "Experience +1" }, { kind: "timed", short: "+1 Shadow" }, { kind: "timed", short: "+1 Body" },
    { kind: "call", key: "obstacle", label: "Obstacle", despair: true }, { kind: "standing" }, { kind: "timed", short: "+1 Presence" }
];

async function draw(pg, { theme, count }) {
    return pg.evaluate(async ({ theme, count, badges }) => {
        // the band dressed as glass.mjs dresses it (sheet-band.mjs `dress`, in its screenshot's dark glass)
        const band = document.querySelector(".character-header-sheet");
        if (theme === "glass") {
            band.classList.add("drpg-glass-band");
            const sg = Object.assign(document.createElement("canvas"), { className: "sg", width: band.clientWidth, height: band.clientHeight });
            const g = sg.getContext("2d"); g.fillStyle = "rgb(16, 15, 21)"; g.fillRect(0, 0, sg.width, sg.height);
            band.prepend(sg);
        }
        const chosen = badges.slice(0, count);
        const L = { "DRPG.Actions.label": "Actions", "DRPG.Calls.silencedBadge": "Silenced", "DRPG.Calls.silencedNotice": "Silenced until this time of day ends" };
        globalThis.game = { user: { isGM: false, id: "u1" }, i18n: { localize: k => L[k] ?? k, format: (k, d) => `${k} ${JSON.stringify(d ?? {})}`, has: () => false } };
        globalThis.foundry = { utils: { escapeHTML: s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`) } };
        globalThis.__pile = {
            STARTING: {}, MODULE_ID: "danganronpa-rpg", FLAGS: {},
            HOPE_CALLS: Object.fromEntries(chosen.filter(b => b.kind === "call" && !b.despair).map(b => [b.key, { label: b.label }])),
            DESPAIR_CALLS: Object.fromEntries(chosen.filter(b => b.kind === "call" && b.despair).map(b => [b.key, { label: b.label }])),
            actionsLeft: () => 1, actionsMax: () => 2, hasFreeMove: () => true, actionBudget: () => ({ costsAction: false }),
            spentSince: () => 0, isEclipse: () => false, overflowBlocksFreeMove: () => false, isChained: () => false, isCrimeSilenced: () => false,
            isCallSilenced: () => chosen.some(b => b.kind === "standing"),
            armedCallsShown: () => chosen.filter(b => b.kind === "call").map(b => ({ key: b.key, grants: b.key, kind: b.despair ? "despair" : "hope" })),
            effectBadges: () => chosen.filter(b => b.kind === "timed").map(b => ({ short: b.short, what: b.short, until: "the end of this time of day" })),
            plural: k => k, error: (...a) => console.error(...a), debug: () => {}, modeOf: () => null
        };
        const SH = await import("/scripts/sheet-header.mjs");
        SH.injectActionBar({ document: { id: "a1", type: "character" } }, document, false,
            { viewer: false, pipEdit: false, header: { acts: true }, monocub: false, redact: false });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const box = el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height }; };
        const stack = document.querySelector(".drpg-pending-stack");
        const row = document.querySelector(".character-header-sheet .character-row");
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        return {
            row: box(row).height, rowTop: box(row).top, header: box(band).height, rem, vw: innerWidth,
            stack: stack ? box(stack) : null,
            tops: stack ? [...stack.children].map(b => Math.round((box(b).top - box(stack).top) * 100) / 100) : [],
            heights: stack ? [...stack.children].map(b => Math.round(box(b).height * 100) / 100) : []
        };
    }, { theme, count, badges: BADGES });
}

/* What stands at a point: the index of the badge (-1 for none), read with the pointer there. */
const atPoint = (pg, x, y) => pg.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y)?.closest(".drpg-pending-call");
    return hit ? [...hit.parentElement.children].indexOf(hit) : -1;
}, { x, y });

const SIZES = [{ vw: 1366, vh: 768, stacked: false, width: 850 }, { vw: 390, vh: 844, stacked: true, width: 374 }];
let bad = 0, cases = 0;
const rows = {};
for (const s of SIZES) for (const theme of ["legacy", "glass"]) for (const count of [0, 1, 3, 6]) {
    cases++;
    const c = { ...s, theme, count };
    const ctx = await browser.newContext({ viewport: { width: c.vw, height: c.vh }, deviceScaleFactor: shots ? 2 : 1 });
    const pg = await ctx.newPage();
    await pg.route("http://pending-pile.local/**", route => {
        const p = decodeURIComponent(new URL(route.request().url()).pathname);
        if (p === "/") return route.fulfill({ contentType: "text/html", body: page(c) });
        const m = /^\/scripts\/([\w-]+\.mjs)$/.exec(p);
        if (m && m[1] !== "sheet-header.mjs") return route.fulfill({ contentType: "text/javascript", body: standIn(m[1]) });
        const base = p.startsWith("/audit/sheet-column/") ? here : root;
        const file = path.join(base, p);
        if (!file.startsWith(base + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ path: file, contentType: file.endsWith(".mjs") ? "text/javascript" : undefined });
    });
    const errors = [];
    pg.on("pageerror", err => errors.push(err.message));
    await pg.goto("http://pending-pile.local/");
    await pg.evaluate(() => document.fonts.ready);
    const m = await draw(pg, c);
    const name = `${c.vw}x${c.vh}${c.stacked ? "-stacked" : ""}-${theme}-${count}`;
    const key = `${c.vw}x${c.vh} ${theme}`;
    if (count === 1) rows[key] = m.row;
    const why = [];
    let hover = null;
    const onScreen = m.stack && m.stack.right <= m.vw;
    if (count >= 3 && onScreen) {
        // the second badge's strip, a pixel under its top: a real mouse move, so the module's pointermove picks it
        const x = Math.round((m.stack.left + m.stack.right) / 2), y = m.stack.top + (m.tops[1] ?? 0) + 1;
        const rest = await atPoint(pg, x, m.stack.top + (m.tops.at(-1) ?? 0) + 4);
        await pg.mouse.move(x, y - 30); await pg.mouse.move(x, y, { steps: 4 });
        await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        hover = { onStrip: await atPoint(pg, x, y), rest };
        if (shots) await pg.screenshot({ path: path.join(shots, `${name}-hover.png`), clip: { x: 0, y: Math.max(0, m.rowTop - 30), width: Math.min(c.vw, c.width + 16), height: m.row + 60 } });
        await pg.mouse.move(2, 2);
    }
    if (shots) await pg.screenshot({ path: path.join(shots, `${name}.png`), clip: { x: 0, y: Math.max(0, m.rowTop - 30), width: Math.min(c.vw, c.width + 16), height: m.row + 60 } });
    if (errors.length) why.push(`the page threw: ${errors[0]}`);
    if (count && !m.stack) why.push("measured nothing: no stack");
    if (count && m.tops.length !== count) why.push(`measured nothing: ${m.tops.length} badges, not ${count}`);
    if (count) {
        if (m.row > (rows[key] ?? m.row) + 0.5) why.push(`the header row ${m.row} px with ${count} badges, ${rows[key]} with one`);
        if (m.stack && m.stack.height > 3 * m.rem + 0.5) why.push(`the stack ${m.stack.height} px, over 3rem (${3 * m.rem})`);
        const steps = m.tops.slice(1).map((t, i) => Math.round((t - m.tops[i]) * 100) / 100);
        if (steps.some(d => Math.abs(d - steps[0]) > 0.6)) why.push(`the badges do not step evenly: ${steps.join(", ")}`);
        if ((m.tops.at(-1) ?? 0) > 20.5) why.push(`the pile rises ${m.tops.at(-1)} px, over 20`);
        if (count > 1 && steps.some(d => d <= 0)) why.push(`a badge not under the one before it: ${steps.join(", ")}`);
    }
    if (hover && hover.rest !== count - 1) why.push(`at rest the badge on top is ${hover.rest}, not the last (${count - 1})`);
    if (hover && hover.onStrip !== 1) why.push(`the pointer on the second badge's strip stands on badge ${hover.onStrip}, not 1`);
    if (why.length && holding) bad++;
    console.log(`${why.length ? (holding ? "FAIL" : "seen") : "ok  "} ${name}: row ${m.row} px, stack ${m.stack ? `${Math.round(m.stack.height * 100) / 100} px` : "none"}, tops [${m.tops.join(", ")}], badge heights [${m.heights.join(", ")}]${hover ? `, pointer on badge 1's strip -> ${hover.onStrip}, at rest on top ${hover.rest}` : ""}${m.stack && !onScreen ? `, the stack off the screen (x ${Math.round(m.stack.left)}-${Math.round(m.stack.right)} of ${m.vw}): not pointed at` : ""}${why.length ? ` - ${why.join("; ")}` : ""}`);
    await ctx.close();
}
await browser.close();
console.log(`pending-pile: ${cases} cases, ${bad} not right${holding ? "" : " (not held: --root)"}`);
process.exit(bad ? 1 : 0);
