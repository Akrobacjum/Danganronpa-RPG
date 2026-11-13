/**
 * Danganronpa RPG - the death fade's frames for the owner's review (E62 C3, 13.11.2026; the coordinator's ask).
 * ---------------------------------------------------------------------------
 * On audit/glass-harness.html (a player's page, `?role=player`), in Chromium, at 1366x768, deviceScaleFactor 1: scripts/
 * death-fade.mjs `playCurtain` on the harness's own curtain, and a PNG of the screen at
 *   the fade:   lit (before), 1000 ms, 2000 ms, rest (3800 ms);
 *   the return: rest (before), 1200 ms, lit (2600 ms);
 * in Stained Glass and in Monokuma Legacy, into `<dir>` (default docs/dev/e62/shots): `death-fade-<theme>-<frame>.png`.
 * The harness's stand-in dialog is hidden, as the storyboard's frames hid it.
 * What the frames are not: Foundry (the harness stubs it, draws English only and no map); timings are this page's
 * timers, read within about one frame. Run it with a static server on the repo's root at :8765 (`python3 -m http.server
 * 8765`), Playwright from audit/harness:  node audit/death-fade-shots.mjs [--out <dir>] [--base ...] [--chromium <exe>]
 */
/* global window, document */ // the page.evaluate bodies run in the browser, on the glass harness
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(new URL("./harness/package.json", import.meta.url));
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const base = opt("--base") ?? "http://127.0.0.1:8765";
const out = opt("--out") ?? path.join(path.dirname(new URL(import.meta.url).pathname), "..", "docs", "dev", "e62", "shots");
const exe = opt("--chromium") ?? process.env.DRPG_CHROMIUM ?? undefined;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--no-sandbox"] });
const written = [];
for (const theme of ["glass", "legacy"]) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/audit/glass-harness.html?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForTimeout(3000);
    await page.evaluate(async glass => {
        // the harness's stand-in dialog hidden, as the storyboard's frames hid it: the curtain is what is shown
        for (const el of document.querySelectorAll(".application.dialog, .window-app")) el.style.display = "none";
        window.__df = await import("/scripts/death-fade.mjs");
        window.__play = kind => window.__df.playCurtain(kind, { glass, panes: window.__glass?.LAST?.panes ?? [] });
    }, theme === "glass");
    const shot = async name => {
        const file = path.join(out, `death-fade-${theme}-${name}.png`);
        await page.screenshot({ path: file });
        written.push(path.relative(process.cwd(), file));
    };
    // the fade, timed from its start
    await shot("fade-0-lit");
    const t0 = Date.now();
    await page.evaluate(() => window.__play("fade"));
    const at = async (ms, name) => { await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0))); await shot(name); };
    await at(1000, "fade-1-1000ms");
    await at(2000, "fade-2-2000ms");
    await at(3800, "fade-3-rest");
    // the return, from the rest state
    await shot("return-0-rest");
    const t1 = Date.now();
    await page.evaluate(() => window.__play("return"));
    const atR = async (ms, name) => { await page.waitForTimeout(Math.max(0, ms - (Date.now() - t1))); await shot(name); };
    await atR(1200, "return-1-1200ms");
    await atR(2600, "return-2-lit");
    await page.close();
}
await browser.close();
console.log(written.join("\n"));
