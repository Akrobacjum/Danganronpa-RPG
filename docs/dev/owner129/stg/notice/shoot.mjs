/**
 * The owner's screenshots of the card a hide's end at the time of day sends its player (S0-HIDE, 1.2.128, 23.11.2026).
 *
 *     node docs/dev/owner129/stg/notice/shoot.mjs        (from the repository's root; Playwright from audit/harness)
 *
 * Serves the repository (python3 -m http.server), opens notice-shots.html for each language, theme and screen, at
 * deviceScaleFactor 2, and writes notice-<en|pl>-<glass|legacy>-<w>x<h>.png beside this file. The capture is
 * audit/harness/probes/129-hide-notice.mjs's (capture/). Chromium is /opt/pw-browsers/chromium unless DRPG_CHROMIUM names
 * another executable. Built on docs/dev/owner124/console/shoot.mjs.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const require = createRequire(path.join(ROOT, "audit/harness/package.json"));
const { chromium } = require("playwright");

const PORT = 8772;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: process.env.DRPG_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const made = [];
try {
    for (const lang of ["en", "pl"]) for (const theme of ["glass", "legacy"]) for (const [width, height] of [[1920, 1080], [1366, 768]]) {
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
        await page.goto(`http://127.0.0.1:${PORT}/docs/dev/owner129/stg/notice/notice-shots.html?lang=${lang}${theme === "legacy" ? "&theme=legacy" : ""}`, { waitUntil: "load" });
        await page.waitForSelector("body[data-drpg-shot-ready]");
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForTimeout(400);
        const out = path.join(HERE, `notice-${lang}-${theme}-${width}x${height}.png`);
        await page.screenshot({ path: out });
        made.push(path.relative(ROOT, out));
        await page.close();
    }
} finally {
    await browser.close();
    server.kill();
}
console.log(made.join("\n"));
