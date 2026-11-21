/*
 * A PRESS ON A LIVE REGION, WITH A REAL MOUSE (line P of 1.2.121; the audit's r120-P-1, measured in Chromium 153 by its
 * second reader: "after a GM edits a planner field, the next press on Move, a 'Rests on' box or Add deduction is lost").
 *
 *   cd audit/harness && npm ci        (once: Playwright comes from there; it downloads no browser)
 *   node audit/live-press.mjs [--chromium <executable>] [--repo <checkout>]   (or DRPG_CHROMIUM=<executable>)     (from the repository's root)
 *
 * The module's own scripts/live.mjs (`keepLive`), loaded in Chromium on a page of its own: config.mjs, utils.mjs and
 * perf-timings.mjs answered by stubs of the names live.mjs imports, and Foundry's `Hooks` and `foundry.utils.debounce`
 * by stubs. A region shaped as the planner's Map: a node's text field ("Name"), its Move button, a "Rests on" box, and a
 * toolbar's Add button and order select, all inside the live region; the page wires them as investigation.mjs does - a
 * `change` of the node's field writes (a 15 ms stand-in for the GM store's flush) and then asks the region's `refresh()`, a
 * forced rebuild; a press on Move, Add or the box is counted by one delegated listener on the window, as the dashboard's are.
 * Driven by Playwright's mouse, a press held 120 ms as a hand holds it (pointerdown, mousedown, the field's blur and
 * change, pointerup, click, in Chromium's own order - which jsdom does not keep, so the suite cannot see this):
 *   edit-then-move    type in the Name field, then click Move: the click must be heard once, and the region redrawn after;
 *   edit-then-box     the same, then click the "Rests on" box: heard once, and the box ticked after the redraw;
 *   edit-then-add     the same, then click Add: heard once;
 *   pick              the order select picked with the mouse pressed on it and never let go on the page (the browser's own
 *                     list, assumed): the region redrawn within 300 ms of the pick (live.mjs's "a pick ends the press").
 * THE CONTROL FIRST (CLAUDE.md, the stackShapes lesson): on a copy of the page whose region is rebuilt the moment Move is
 * pressed (between its pointerdown and its click, a planted rebuild with no hold), the Move click must be read as lost.
 * Exit 1 on a case that fails or a control that reads nothing. Writes nothing.
 */
/* global window, document */ // read inside the page (`page.evaluate`, `addInitScript`), not in Node
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import http from "node:http";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const repoAt = args.indexOf("--repo");
const REPO = repoAt >= 0 ? path.resolve(args[repoAt + 1]) : path.resolve(HERE, "..");
const chromeAt = args.indexOf("--chromium");
const { chromium } = createRequire(path.join(HERE, "harness", "package.json"))("playwright");

const STUBS = {
    "/scripts/config.mjs": "export const MODULE_ID = 'danganronpa-rpg'; export const TIMING = { coalesceMs: 60 };",
    "/scripts/utils.mjs": "export const debug = () => {}; export const error = (...a) => console.error(...a);",
    "/scripts/perf-timings.mjs": "export const sample = () => {}; export const now = () => performance.now();"
};

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
body { font: 16px sans-serif; margin: 20px; } .live { display: flex; flex-direction: column; gap: 12px; width: 420px; }
button, select, input { font-size: 16px; padding: 6px 10px; } .row { display: flex; gap: 8px; align-items: center; }
</style></head><body><div id="app"></div><script type="module">
globalThis.Hooks = { on: () => 0, off: () => {}, callAll: () => {} };
globalThis.foundry = { utils: { debounce: (fn, ms) => { let t = null; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; } }, applications: { instances: new Map() } };
globalThis.game = { settings: { get: () => null }, i18n: { localize: k => k } };
const { keepLive } = await import("/scripts/live.mjs");
const world = { name: "Old name", ticked: false, order: "kind", builds: 0 };
const build = () => { world.builds++; return \`<div class="live" data-build="\${world.builds}">
  <div class="row"><button type="button" data-add>Add deduction</button>
    <select data-sort><option value="kind"\${world.order === "kind" ? " selected" : ""}>By kind</option><option value="manual"\${world.order === "manual" ? " selected" : ""}>By hand</option></select></div>
  <label>Name <input type="text" name="case:1:x:label" value="\${world.name}"></label>
  <label><input type="checkbox" name="case:1:x:in:a"\${world.ticked ? " checked" : ""}> Rests on a</label>
  <div class="row"><button type="button" data-move>Move down</button></div></div>\`; };
const app = { element: document.getElementById("app"), options: { window: { title: "press" } } };
app.element.innerHTML = build();
const heard = { move: 0, add: 0, box: 0 };
window.__heard = heard; window.__world = world;
window.addEventListener("click", e => {
  const t = e.target;
  if (!app.element.contains(t)) return;
  if (t.closest("[data-move]")) heard.move++;
  if (t.closest("[data-add]")) heard.add++;
});
let live = null;
const wire = () => {
  const root = app.element;
  root.querySelector('input[type="checkbox"]')?.addEventListener("change", e => { heard.box++; world.ticked = e.target.checked; });
  root.querySelector("[data-sort]")?.addEventListener("change", e => { world.order = e.target.value; live?.refresh?.(); });
  if (window.__plantMoveRebuild) root.querySelector("[data-move]")?.addEventListener("pointerdown", () => { app.element.querySelector(".live").replaceWith(document.createRange().createContextualFragment(build())); }, { once: true });
};
// the planner's write on change (investigation.mjs wireMap): the node's field written, then a forced redraw
app.element.addEventListener("change", e => {
  if (e.target?.name !== "case:1:x:label") return;
  const value = e.target.value;
  setTimeout(() => { world.name = value; live?.refresh?.(); }, 15);
});
live = keepLive(app, { region: ".live", build, delay: 0, whileEditing: true, watch: {}, after: wire });
wire();
window.__ready = true;
</script></body></html>`;

function serve() {
    const server = http.createServer((req, res) => {
        const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
        if (u === "/" || u === "/press") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
        if (STUBS[u]) { res.writeHead(200, { "content-type": "text/javascript" }); res.end(STUBS[u]); return; }
        const file = path.join(REPO, u);
        if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "content-type": u.endsWith(".mjs") || u.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/press`;
// --chromium, else DRPG_CHROMIUM (what `npm run press` reads; the local gate passes it as --chromium), else Playwright's own
const executablePath = chromeAt >= 0 ? args[chromeAt + 1] : process.env.DRPG_CHROMIUM || null;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let failed = 0;
const say = (ok, line) => { console.log(`${ok ? "ok  " : "FAIL"} ${line}`); if (!ok) failed++; };
const open = async (plant = false) => {
    const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
    page.on("pageerror", e => console.log(`page error: ${e.message}`));
    if (plant) await page.addInitScript(() => { window.__plantMoveRebuild = true; });
    await page.goto(base);
    await page.waitForFunction(() => window.__ready === true);
    return page;
};
const editName = async (page, text) => {
    await page.click('input[name="case:1:x:label"]');
    await page.keyboard.press("Control+A");
    await page.keyboard.type(text);
};
/* A press as a hand makes it: down, held HOLD_MS, up (Playwright's own click lets go within a few milliseconds, before the
   planner's write lands; a person's click is held longer - 120 ms here, assumed, not measured). */
const HOLD_MS = 120;
const press = async (page, sel) => {
    const b = await page.locator(sel).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(HOLD_MS);
    await page.mouse.up();
};
const heard = page => page.evaluate(() => ({ ...window.__heard, name: window.__world.name, builds: window.__world.builds, ticked: window.__world.ticked }));
try {
    // THE CONTROL: Move's region rebuilt between its pointerdown and its click, no hold - the click must read lost
    {
        const page = await open(true);
        await press(page, "[data-move]");
        await page.waitForTimeout(300);
        const h = await heard(page);
        say(h.move === 0, `control: a region rebuilt under the press of Move read the click as lost (heard ${h.move})`);
        await page.close();
    }
    for (const [name, sel, key] of [["edit-then-move", "[data-move]", "move"], ["edit-then-add", "[data-add]", "add"], ["edit-then-box", 'input[type="checkbox"]', "box"]]) {
        const page = await open();
        await editName(page, `Name ${name}`);
        const before = await heard(page);
        await press(page, sel);
        await page.waitForTimeout(400);
        const h = await heard(page);
        const extra = key === "box" ? `, the box ticked after the redraw: ${await page.evaluate(() => document.querySelector('input[type="checkbox"]')?.checked)}` : "";
        say(h[key] === 1 && h.name === `Name ${name}` && h.builds > before.builds && (key !== "box" || h.ticked),
            `${name}: the press heard ${h[key]} time(s), the name written "${h.name}", the region drawn again ${h.builds - before.builds} time(s)${extra}`);
        await page.close();
    }
    // a pick: pressed, picked, never let go on the page
    {
        const page = await open();
        const box = await page.locator("[data-sort]").boundingBox();
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.down();
        const before = (await heard(page)).builds;
        const t0 = Date.now();
        await page.selectOption("[data-sort]", "manual");
        await page.waitForFunction(b => window.__world.builds > b, before, { timeout: 3000 }).catch(() => {});
        const ms = Date.now() - t0;
        const h = await heard(page);
        const shown = await page.evaluate(() => document.querySelector("[data-sort]")?.value);
        say(h.builds > before && ms < 300 && shown === "manual", `pick: the region drawn again ${h.builds - before} time(s), ${ms} ms after the pick, showing "${shown}"`);
        await page.close();
    }
} finally {
    await browser.close();
    server.close();
}
console.log(`live-press: ${failed} failing (live.mjs of ${REPO})`);
process.exitCode = failed ? 1 : 0;
