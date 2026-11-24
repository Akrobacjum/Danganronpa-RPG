/**
 * A player's messenger window measured in Chromium (1.2.129, OWNER-129-CHATRECT, 23.11.2026), and shot for the owner.
 *
 *     node docs/dev/owner129/chatrect/measure.mjs <label>        (from the repository's root; Playwright from audit/harness)
 *
 * Serves the repository, opens docs/dev/owner124/console/shots.html for each capture of ./capture (written by
 * audit/harness/probes/129-chatrect.mjs), each theme and each screen, and reads off the laid-out window: the height asked
 * (`messengerSize`'s, which shots.html writes inline as Foundry's `setPosition` does), the height drawn, and the heights of
 * the log or the note, the participants line, the tab bar and the send form, with whether the log scrolls. Writes
 * heights-<label>.json and, at deviceScaleFactor 2, <file>-<theme>-<w>x<h>-<label>.png beside this file.
 * Chromium is the session's (/opt/pw-browsers/chromium-1243) unless DRPG_CHROMIUM names another executable.
 * WHAT IT IS NOT: Foundry's own stylesheet and frame (shots.html writes a header as Foundry writes one) and the stained
 * glass painted behind a window.
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
const label = process.argv[2] ?? "now";
const shots = !process.argv.includes("--no-shots");

const PORT = 8772;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1200));
const executablePath = process.env.DRPG_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const rows = [];
try {
    const CAP = "docs/dev/owner129/chatrect/capture";
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, CAP, "manifest.json"), "utf8"));
    for (const { file } of manifest.windows.filter(row => row.captured)) {
        for (const theme of ["glass", "legacy"]) {
            for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 600]]) {
                const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: shots && width !== 1024 ? 2 : 1 });
                await page.goto(`http://127.0.0.1:${PORT}/docs/dev/owner124/console/shots.html?file=${file}&cap=/${CAP}/${theme === "legacy" ? "&theme=legacy" : ""}`,
                    { waitUntil: "load" });
                await page.waitForSelector("body[data-drpg-shot-ready]");
                await page.evaluate(() => document.fonts?.ready);
                await page.evaluate(() => { const log = document.querySelector(".drpg-messenger-log"); if (log) log.scrollTop = log.scrollHeight; });
                await page.waitForTimeout(300);
                const read = await page.evaluate(() => {
                    const app = document.querySelector(".application.drpg-messenger");
                    const h = sel => { const el = app?.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height) : null; };
                    const log = app?.querySelector(".drpg-messenger-log");
                    const noteBox = app?.querySelector("textarea");
                    return { asked: parseInt(app?.style.height ?? "", 10) || null, drawn: app ? Math.round(app.getBoundingClientRect().height) : null,
                        drawnWidth: app ? Math.round(app.getBoundingClientRect().width) : null,
                        log: h(".drpg-messenger-log"), logScrolls: log ? log.scrollHeight > log.clientHeight + 1 : null,
                        logContent: log ? log.scrollHeight : null, note: noteBox ? Math.round(noteBox.getBoundingClientRect().height) : null,
                        participants: h(".drpg-messenger-participants"), tabs: h(".drpg-tabs"), form: h(".drpg-messenger-input"),
                        bottomInScreen: app ? Math.round(app.getBoundingClientRect().bottom) <= innerHeight : null };
                });
                rows.push({ file, theme, screen: `${width}x${height}`, ...read });
                if (shots && width !== 1024) await page.screenshot({ path: path.join(HERE, `${file.replace(/\.html$/, "")}-${theme}-${width}x${height}-${label}.png`) });
                await page.close();
            }
        }
    }
} finally {
    await browser.close();
    server.kill();
}
fs.writeFileSync(path.join(HERE, `heights-${label}.json`), JSON.stringify({ label, rows }, null, 2) + "\n");
for (const r of rows) console.log([r.file.padEnd(11), r.theme.padEnd(7), r.screen.padEnd(10), `asked ${r.asked}`, `drawn ${r.drawn}`,
    `log ${r.log}${r.logScrolls ? " (scrolls)" : ""}`, `note ${r.note}`, `parts ${r.participants}/${r.tabs}/${r.form}`].join("  "));
