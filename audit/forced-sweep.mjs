/*
 * The forced-colours sweep: the module's state marks under `forced-colors: active`, in Chromium (E48 K3, 11.11.2026).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   node audit/forced-sweep.mjs           (from the repository's root) every pair below, both themes, at 1366x768
 *   node audit/forced-sweep.mjs --off     the same pages with forced colours NOT emulated (the pairs' own ground)
 *   node audit/forced-sweep.mjs --chromium <executable>   a Chromium of your own; else PLAYWRIGHT_BROWSERS_PATH's
 *   node audit/forced-sweep.mjs --base http://127.0.0.1:8765   read a server already running; else it serves the root
 *
 * WHY. Windows' contrast themes repaint every colour with a small system palette, and a state this module says in
 * colour alone - a spent pip against a free one, a muted microphone - can come out as two identical marks. Most of
 * the marks are pixel glyphs drawn as a mask over `background-color: currentColor`, and forced colours paint that
 * background the system's Canvas: on Canvas, nothing. Headless jsdom has no forced colours and no layout, so this
 * reads what Chromium draws with `page.emulateMedia({ forcedColors: "active" })`.
 *
 * WHAT. For each PAIR - two elements of one state element, one in each state, on one of the module's harness pages - a
 * screenshot of each element's box (the size of the first, at each element's own place) and of the same size of empty
 * Canvas beside the page's corner. A pair is green when the two states' pictures differ and neither is blank (equal to
 * the empty Canvas). Each pair runs in Stained Glass and in Monokuma Legacy. The screenshots are deterministic PNGs, so
 * "differ" is byte inequality: it says the marks are not the same picture, not that a person tells them apart (that
 * is a check on Windows 11 with a contrast theme, at a real table).
 *
 * THE CONTROL, first (the stackShapes lesson in CLAUDE.md): on the first pair, the pips' own forced-colours rules are
 * taken off by an injected rule that paints every pip's mark Canvas at full opacity and no filter - the pair must then read as not differing, or the
 * sweep cannot see the fault it exists for and the run is red.
 *
 * Exit 1 on any pair red, on a pair whose elements are not on the page, and on a control not seen.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const OFF = argv.includes("--off");
const CHROMIUM = opt("--chromium");
const { chromium } = createRequire(path.join(REPO, "audit", "harness", "package.json"))("playwright");
const freePort = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

/* The pairs: a page, the state element, the two states' selectors. The despair rail's pips are glass-harness.html's
   own (5 of 12 filled); the sheet's action pips are style-harness.html's parts page (`?sheet=parts&state=npc`, whose header carries them; the first filled). */
export const PAIRS = [
    { name: "despair pip, spent and free", page: "/audit/glass-harness.html?still=1", a: "#drpg-despair .drpg-despair-pip.filled", b: "#drpg-despair .drpg-despair-pip:not(.filled)" },
    { name: "action pip, held and free", page: "/audit/style-harness.html?sheet=parts&state=npc", a: ".drpg-action-pip.filled", b: ".drpg-action-pip:not(.filled)" }
];
const THEMES = ["stained-glass", "monokuma-legacy"];
const CONTROL = ".drpg-despair-pip, .drpg-despair-pip::before, .drpg-action-pip, .drpg-action-pip::before, .drpg-action-pip i { forced-color-adjust: auto !important; background: Canvas !important; background-color: Canvas !important; outline: none !important; border-color: Canvas !important; opacity: 1 !important; filter: none !important; color: Canvas !important; -webkit-mask: none !important; mask: none !important; }";

async function readPair(page, pair, theme, inject) {
    const q = theme === "monokuma-legacy" ? (pair.page.includes("?") ? "&" : "?") + "theme=legacy" : "";
    await page.goto(`${pair.base}${pair.page}${q}`);
    await page.waitForTimeout(900);
    await page.evaluate(theme => {
        globalThis.document.body.classList.toggle("drpg-theme-stained-glass", theme === "stained-glass");
        globalThis.document.body.classList.toggle("drpg-theme-monokuma-legacy", theme === "monokuma-legacy");
    }, theme);
    if (inject) await page.addStyleTag({ content: inject });
    await page.waitForTimeout(250);
    const a = await page.$(pair.a), b = await page.$(pair.b);
    if (!a || !b) return { missing: [!a && pair.a, !b && pair.b].filter(Boolean) };
    await a.scrollIntoViewIfNeeded();
    const ra = await a.boundingBox(), rb = await b.boundingBox();
    if (!ra || !rb || ra.width < 1 || ra.height < 1) return { missing: ["a box of zero size"] };
    const w = Math.ceil(ra.width), h = Math.ceil(ra.height);
    const shot = r => page.screenshot({ clip: { x: Math.floor(r.x), y: Math.floor(r.y), width: w, height: h } });
    const empty = await page.evaluate(([w, h]) => {
        const d = globalThis.document.createElement("div");
        d.id = "drpg-forced-empty";
        d.style.cssText = `position:fixed;left:0;bottom:0;width:${w}px;height:${h}px;z-index:2147483647;background:Canvas;`;
        globalThis.document.body.append(d);
        const r = d.getBoundingClientRect();
        return { x: r.x, y: r.y };
    }, [w, h]);
    const [pa, pb, pe] = [await shot(ra), await shot(rb), await shot({ x: empty.x, y: empty.y })];
    return { differ: !pa.equals(pb), blankA: pa.equals(pe), blankB: pb.equals(pe), size: `${w}x${h}` };
}

const verdict = r => r.missing ? `missing ${r.missing.join(", ")}` : (r.differ && !r.blankA && !r.blankB ? "green" : `RED (${[!r.differ && "the two states draw the same picture", r.blankA && "the first state draws nothing", r.blankB && "the second state draws nothing"].filter(Boolean).join("; ")})`);

let server = null, base = opt("--base");
if (!base) {
    const port = await freePort();
    server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: REPO, stdio: "ignore" });
    base = `http://127.0.0.1:${port}`;
    await new Promise(r => setTimeout(r, 1200));
}
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
let red = 0;
try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    if (!OFF) await page.emulateMedia({ forcedColors: "active" });
    const forced = await page.evaluate(() => globalThis.matchMedia("(forced-colors: active)").matches);
    console.log(`forced-sweep: forced colours ${forced ? "active" : "not active"} (${OFF ? "--off" : "emulated"})`);
    if (forced === OFF) { console.log("forced-sweep: RED - the emulation did not take"); red++; }
    if (!OFF) {
        const control = await readPair(page, { ...PAIRS[0], base }, THEMES[0], CONTROL);
        const seen = !control.missing && (!control.differ || control.blankA || control.blankB);
        console.log(`forced-sweep: control (the pips painted Canvas) on "${PAIRS[0].name}": ${seen ? "seen" : "NOT seen"} - ${verdict(control)}`);
        if (!seen) red++;
    }
    for (const pair of PAIRS) for (const theme of THEMES) {
        const r = await readPair(page, { ...pair, base }, theme, null);
        const v = verdict(r);
        console.log(`forced-sweep: ${pair.name}, ${theme}${r.size ? ` (${r.size})` : ""}: ${v}`);
        if (v !== "green") red++;
    }
} finally {
    await browser.close();
    server?.kill();
}
console.log(`forced-sweep: ${PAIRS.length * THEMES.length} reading(s); ${red ? `${red} red - RED` : "GREEN"}`);
process.exit(red ? 1 : 0);
