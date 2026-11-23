/**
 * The owner's screenshots of the GM's messenger window (1.2.124, OWNER-124-CONSOLE, 22.11.2026), in Chromium.
 *
 *     node docs/dev/owner124/console/shoot.mjs        (from the repository's root; Playwright from audit/harness)
 *
 * Serves the repository (python3 -m http.server on a free port), opens shots.html for each capture (the Timeline and a
 * player's view), each theme and each screen, at deviceScaleFactor 2, and writes <view>-<theme>-<w>x<h>.png beside this
 * file. Chromium is the session's (/opt/pw-browsers/chromium-1243) unless DRPG_CHROMIUM names another executable.
 * DRPG_SHOTS_DIR (repository-relative; docs/dev/owner124/console by default) is where the capture is read from (its
 * capture/, written by probes/124-console-shots.mjs with the same variable) and the PNGs are written; every window of the
 * capture's manifest is shot.
 * DRPG_FONTAWESOME, the folder of an unpacked @fortawesome/fontawesome-free package (`npm pack` it and untar), serves
 * the icon font Foundry would give the page at /vendor-fa/ (shots.html says why).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const require = createRequire(path.join(ROOT, "audit/harness/package.json"));
const { chromium } = require("playwright");

const PORT = 8771;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1200));
// The session's Chromium (the harness's Playwright looks for a build of its own version otherwise).
const executablePath = process.env.DRPG_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const made = [];
try {
    const DIR = process.env.DRPG_SHOTS_DIR ?? "docs/dev/owner124/console";
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, DIR, "capture", "manifest.json"), "utf8"));
    const views = { "console.html": "console", "player.html": "player", "own.html": "own" };
    for (const [file, view] of manifest.windows.filter(row => row.captured).map(row => [row.file, views[row.file] ?? row.file.replace(/\.html$/, "")])) {
        for (const theme of ["glass", "legacy"]) {
            for (const [width, height] of [[1920, 1080], [1366, 768]]) {
                const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
                const fa = process.env.DRPG_FONTAWESOME;
                if (fa) await page.route("**/vendor-fa/**", route => {
                    const file = path.join(fa, new URL(route.request().url()).pathname.replace(/^\/vendor-fa\//, ""));
                    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
                    const type = file.endsWith(".css") ? "text/css" : file.endsWith(".woff2") ? "font/woff2" : "font/ttf";
                    return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
                });
                const url = `http://127.0.0.1:${PORT}/docs/dev/owner124/console/shots.html?file=${file}&cap=/${DIR}/capture/${theme === "legacy" ? "&theme=legacy" : ""}`;
                await page.goto(url, { waitUntil: "load" });
                await page.waitForSelector("body[data-drpg-shot-ready]");
                await page.evaluate(() => document.fonts?.ready);
                // Once the fonts have set the lines, the stream opens on its newest item again (shots.html scrolled
                // it before they loaded, and the legacy 1920 x 1080 shot stopped half way down).
                await page.evaluate(() => { const s = document.querySelector(".drpg-console-stream"); if (s) s.scrollTop = s.scrollHeight; });
                await page.waitForTimeout(400);
                const out = path.join(ROOT, DIR, `${view}-${theme}-${width}x${height}.png`);
                await page.screenshot({ path: out });
                made.push(path.relative(ROOT, out));
                await page.close();
            }
        }
    }
} finally {
    await browser.close();
    server.kill();
}
console.log(made.join("\n"));
