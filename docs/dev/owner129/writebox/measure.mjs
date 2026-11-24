/**
 * The messenger's "Write a message" box measured in Chromium (1.2.129, OWNER-129-WRITEBOX, 24.11.2026; the owner: "Poprawmy
 * write a message (powiekszmy)"), and shot for the owner.
 *
 *     node docs/dev/owner129/writebox/measure.mjs <label>        (from the repository's root; Playwright from audit/harness)
 *
 * The windows audit/harness/probes/129-chatrect.mjs keeps (docs/dev/owner129/chatrect/capture: a player's with no message,
 * three and forty, the GM's on p1's thread), each drawn by docs/dev/owner124/console/shots.html at the size
 * messenger-gm.mjs `messengerSize` gives it, under each theme, at 1920 x 1080, 1366 x 768 and 1024 x 600, the box empty
 * and with three lines typed into it here (a captured element holds no typed value). Read off the laid-out page: the box's
 * font size, line height and height, the first bubble's text size, the send button's size and how far its foot stands
 * from the box's, the window's height, the log's height and how many messages it shows whole. Writes heights-<label>.json
 * and the owner's shots (deviceScaleFactor 2) beside this file.
 * WHAT IT IS NOT: Foundry's own stylesheet and frame, the stained glass painted behind a window, and the module's own
 * script (the box's growth here is the stylesheets' alone).
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

const PORT = 8773;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1200));
const executablePath = process.env.DRPG_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const CAP = "docs/dev/owner129/chatrect/capture";
const TYPED = "I check the kitchen door first.\nThen I knock twice and wait for an answer.\nIf nobody comes, I try the handle.";
// The owner's shots: [file, theme, screen, typed].
const SHOTS = new Set(["empty.html|glass|1920x1080|0", "empty.html|legacy|1920x1080|0", "empty.html|glass|1920x1080|3", "empty.html|legacy|1920x1080|3",
    "gm-thread.html|glass|1920x1080|3", "gm-thread.html|legacy|1920x1080|3", "many.html|glass|1366x768|3", "many.html|legacy|1366x768|3"]);
const rows = [];
try {
    for (const file of ["empty.html", "few.html", "many.html", "gm-thread.html"]) {
        for (const theme of ["glass", "legacy"]) {
            for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 600]]) {
                for (const typed of [0, 3]) {
                    const key = `${file}|${theme}|${width}x${height}|${typed}`;
                    const shot = SHOTS.has(key);
                    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: shot ? 2 : 1 });
                    await page.goto(`http://127.0.0.1:${PORT}/docs/dev/owner124/console/shots.html?file=${file}&cap=/${CAP}/${theme === "legacy" ? "&theme=legacy" : ""}`,
                        { waitUntil: "load" });
                    await page.waitForSelector("body[data-drpg-shot-ready]");
                    await page.evaluate(() => document.fonts?.ready);
                    await page.evaluate(text => {
                        const box = document.querySelector(".drpg-messenger-input textarea");
                        if (box && text) { box.value = text; box.dispatchEvent(new Event("input", { bubbles: true })); box.focus(); box.setSelectionRange(text.length, text.length); }
                        const log = document.querySelector(".drpg-messenger-log");
                        if (log) log.scrollTop = log.scrollHeight;
                    }, typed ? TYPED : "");
                    await page.waitForTimeout(300);
                    const read = await page.evaluate(() => {
                        const app = document.querySelector(".application.drpg-messenger");
                        const box = app?.querySelector(".drpg-messenger-input textarea"), button = app?.querySelector(".drpg-messenger-input button");
                        const bubble = app?.querySelector(".drpg-messenger-log .drpg-messenger-text");
                        const log = app?.querySelector(".drpg-messenger-log");
                        const r = el => el?.getBoundingClientRect();
                        const cs = el => (el ? getComputedStyle(el) : null);
                        const lr = r(log);
                        const whole = log ? [...log.querySelectorAll(".drpg-messenger-bubble")].filter(b => { const br = r(b); return br.top >= lr.top - 1 && br.bottom <= lr.bottom + 1; }).length : null;
                        return {
                            window: app ? Math.round(r(app).height) : null,
                            boxFont: box ? cs(box).fontSize : null, boxLine: box ? cs(box).lineHeight : null, boxHeight: box ? Math.round(r(box).height) : null,
                            boxScrolls: box ? box.scrollHeight > box.clientHeight + 1 : null,
                            bubbleFont: bubble ? cs(bubble).fontSize : null,
                            button: button ? `${Math.round(r(button).width)}x${Math.round(r(button).height)}` : null,
                            footGap: box && button ? Math.round(r(box).bottom - r(button).bottom) : null,
                            log: log ? Math.round(lr.height) : null, whole
                        };
                    });
                    rows.push({ file, theme, screen: `${width}x${height}`, typed, ...read });
                    if (shot) await page.screenshot({ path: path.join(HERE, `${file.replace(/\.html$/, "")}-${typed ? "typed" : "empty"}-${theme}-${width}x${height}-${label}.png`) });
                    await page.close();
                }
            }
        }
    }
} finally {
    await browser.close();
    server.kill();
}
fs.writeFileSync(path.join(HERE, `heights-${label}.json`), JSON.stringify({ label, rows }, null, 2) + "\n");
for (const r of rows) console.log([r.file.padEnd(15), r.theme.padEnd(7), r.screen.padEnd(10), `typed ${r.typed}`, `box ${r.boxFont}/${r.boxLine} h${r.boxHeight}${r.boxScrolls ? " scrolls" : ""}`,
    `bubble ${r.bubbleFont}`, `button ${r.button} foot ${r.footGap}`, `window ${r.window}`, `log ${r.log} whole ${r.whole}`].join("  "));
