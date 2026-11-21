/*
 * A REDRAW UNDER A GM WHO IS TYPING OR PICKING, IN CHROMIUM (the line claude/refresh-120 for 1.2.122; the audit's check of
 * 1.2.121, r121-R-1 and r121-R-3, measured in Chromium by its reader).
 *
 *   cd audit/harness && npm ci        (once: Playwright comes from there; it downloads no browser)
 *   node audit/live-redraw.mjs [--chromium <executable>] [--repo <checkout>]   (or DRPG_CHROMIUM=<executable>)     (from the repository's root)
 *
 * The module's own scripts/live.mjs (`keepLive`, `liveRegions`) on a page of its own, as audit/live-press.mjs loads it:
 * config.mjs, utils.mjs and perf-timings.mjs answered by stubs, Foundry's `Hooks` and `foundry.utils.debounce` by stubs. A
 * region with a text field that SAVES ON `change` (a listener on the window's element, as the Remnant card's, the Sound
 * window's Effects box and the planner's do) and a select; a "change elsewhere" is the region woken through its own
 * debounce (`liveRegions()[0].wake()`), as a watched event wakes it. Read on 21.11.2026 in this Chromium (153): removing a
 * focused text field whose value changed since its focus fires `change`, `blur` and `focusout` on it synchronously, inside
 * the removal; a value written by script after the focus does not make the next blur fire `change`; and `select:open`
 * says whether a select's own list is open. The cases:
 *   type-redraw-type   type "ab", a change elsewhere, type "c", leave with Tab: nothing saved before the leave, then one
 *                      save of "abc" (r121-R-1: the redraw saved the fragment "ab");
 *   type-redraw-leave  type "abc", a change elsewhere, leave with Tab having typed nothing more: one save of "abc" (the
 *                      fragment not saved by the redraw, and the whole word still saved at the leave);
 *   list-mouse         the select's list opened with the mouse, a change elsewhere: the list still open 300 ms later, and
 *                      the region drawn again once it is closed (Escape) (r121-R-3);
 *   list-keyboard      the same with the list opened by Alt+ArrowDown.
 * THE CONTROLS FIRST (CLAUDE.md, the stackShapes lesson): the list reads open (`:open`) after the press that opens it, and a
 * region woken with nothing focused is drawn again - so a case that reads "not drawn" or "still open" reads something.
 * Exit 1 on a case or a control that fails. Writes nothing.
 */
/* global window, document */ // read inside the page (`page.evaluate`), not in Node
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
select, input { font-size: 16px; padding: 6px 10px; }
</style></head><body><div id="app"></div><input id="outside" placeholder="outside"><script type="module">
globalThis.Hooks = { on: () => 0, off: () => {}, callAll: () => {} };
globalThis.foundry = { utils: { debounce: (fn, ms) => { let t = null; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; } }, applications: { instances: new Map() } };
globalThis.game = { settings: { get: () => null }, i18n: { localize: k => k, format: k => k } };
const { keepLive, liveRegions } = await import("/scripts/live.mjs");
const world = { builds: 0, saves: [] };
const build = () => { world.builds++; return \`<div class="live" data-build="\${world.builds}">
  <label>Words <input type="text" name="words" value=""></label>
  <select name="pick"><option value="a" selected>a</option><option value="b">b</option><option value="c">c</option></select></div>\`; };
const app = { element: document.getElementById("app"), options: { window: { title: "redraw" } } };
app.element.innerHTML = build();
app.element.addEventListener("change", e => { if (e.target?.name === "words") world.saves.push(e.target.value); });
keepLive(app, { region: ".live", build, delay: 0, watch: {} });
window.__world = world;
window.__wake = () => liveRegions(app)[0]?.wake?.();
window.__open = () => { try { return document.querySelector('.live select[name="pick"]')?.matches(":open") ?? null; } catch { return null; } };
window.__ready = true;
</script></body></html>`;

function serve() {
    const server = http.createServer((req, res) => {
        const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
        if (u === "/" || u === "/redraw") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
        if (STUBS[u]) { res.writeHead(200, { "content-type": "text/javascript" }); res.end(STUBS[u]); return; }
        const file = path.join(REPO, u);
        if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "content-type": u.endsWith(".mjs") || u.endsWith(".js") ? "text/javascript" : "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/redraw`;
// --chromium, else DRPG_CHROMIUM (what `npm run press` reads; the local gate passes it as --chromium), else Playwright's own
const executablePath = chromeAt >= 0 ? args[chromeAt + 1] : process.env.DRPG_CHROMIUM || null;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let failed = 0;
const say = (ok, line) => { console.log(`${ok ? "ok  " : "FAIL"} ${line}`); if (!ok) failed++; };
const open = async () => {
    const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
    page.on("pageerror", e => console.log(`page error: ${e.message}`));
    await page.goto(base);
    await page.waitForFunction(() => window.__ready === true);
    return page;
};
const world = page => page.evaluate(() => ({ builds: window.__world.builds, saves: [...window.__world.saves], open: window.__open(),
    focus: document.activeElement?.getAttribute?.("name") ?? document.activeElement?.id ?? null, value: document.querySelector('.live [name="words"]')?.value ?? null }));
const wake = async page => { await page.evaluate(() => window.__wake()); await page.waitForTimeout(150); };
try {
    // THE CONTROLS: a wake with nothing focused draws the region again; the list reads open after the click that opens it
    {
        const page = await open();
        const a = await world(page);
        await wake(page);
        const b = await world(page);
        say(b.builds > a.builds, `control: a wake with nothing focused drew the region again (${a.builds} -> ${b.builds})`);
        await page.click('.live select[name="pick"]');
        await page.waitForTimeout(150);
        const c = await world(page);
        say(c.open === true, `control: the select's list reads open after the click that opens it (:open ${c.open})`);
        await page.close();
    }
    {
        const page = await open();
        await page.click('.live [name="words"]');
        await page.keyboard.type("ab");
        const a = await world(page);
        await wake(page);
        await page.keyboard.type("c");
        const b = await world(page);
        await page.keyboard.press("Tab");
        await page.waitForTimeout(100);
        const c = await world(page);
        say(b.builds > a.builds && b.saves.length === 0 && c.saves.length === 1 && c.saves[0] === "abc",
            `type-redraw-type: drawn again ${b.builds - a.builds} time(s) while typing; saved before the leave ${JSON.stringify(b.saves)}, after it ${JSON.stringify(c.saves)}`);
        await page.close();
    }
    {
        const page = await open();
        await page.click('.live [name="words"]');
        await page.keyboard.type("abc");
        const a = await world(page);
        await wake(page);
        const b = await world(page);
        await page.keyboard.press("Tab");
        await page.waitForTimeout(100);
        const c = await world(page);
        say(b.builds > a.builds && b.saves.length === 0 && b.focus === "words" && c.saves.length === 1 && c.saves[0] === "abc",
            `type-redraw-leave: drawn again ${b.builds - a.builds} time(s), the focus on "${b.focus}"; saved before the leave ${JSON.stringify(b.saves)}, after it ${JSON.stringify(c.saves)}`);
        await page.close();
    }
    for (const [name, opener] of [["list-mouse", async page => page.click('.live select[name="pick"]')],
        ["list-keyboard", async page => { await page.focus('.live select[name="pick"]'); await page.keyboard.press("Alt+ArrowDown"); }]]) {
        const page = await open();
        await opener(page);
        await page.waitForTimeout(150);
        const a = await world(page);
        await wake(page);
        await page.waitForTimeout(300);
        const b = await world(page);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(700);
        const c = await world(page);
        say(a.open === true && b.open === true && c.open === false && c.builds > a.builds,
            `${name}: open before the change ${a.open}, 450 ms after it ${b.open}; after Escape open ${c.open}, drawn again ${c.builds - a.builds} time(s)`);
        await page.close();
    }
} finally {
    await browser.close();
    server.close();
}
console.log(`live-redraw: ${failed} failing (live.mjs of ${REPO})`);
process.exitCode = failed ? 1 : 0;
