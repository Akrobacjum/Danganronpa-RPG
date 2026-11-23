/**
 * The owner's screenshots for line TRIAL's session-0 items (E129, 1.2.128 assembly, 23.11.2026): S0-SKIP's window
 * "Finish your turn now?" on the objector's screen, and S0-NOMUTE's switch "Class Trial: no forced muting" in the Game
 * settings window's Voice section. Chromium, 1920x1080 and 1366x768, Stained Glass and Monokuma Legacy, the glass harness
 * under the module's stylesheets. Run from the repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &   node docs/dev/owner129/trial/shots.mjs [--chromium <executable>] [--dsf 2]
 *
 * WHAT IS REAL AND WHAT IS NOT. Each window's markup is the module's own, drawn by the kit (ui-kit.mjs `drpgWindow`) on
 * the headless harness's clients - p1 with a real Objection of its student on the floor (trial-prompt.mjs `promptFinish`),
 * the GM opening the Game settings window (settings-window.mjs `openGameSettingsWindow`) - and saved beside this file as
 * finish.html and settings.html. Here it is placed in the middle of the glass harness's page, as Foundry places a
 * window, under the same stylesheets, the harness's own sample windows hidden. Foundry v14's own window frame and its
 * fonts are not the harness's: the title bar (its words the window's title, in English) and the icon font are stand-ins. Writes NN-<window>-<theme>-<size>.png beside this file.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/audit/glass-harness.html";
const exe = arg("--chromium") ?? process.env.DRPG_CHROMIUM;
const dsf = Number(arg("--dsf") ?? 2);
const here = new URL(".", import.meta.url).pathname;
const WINDOWS = [["finish", "player", 460, "Finish your turn now?"], ["settings", "gm", 820, "Game settings"]];
const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
let bad = 0;
for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) for (const [i, [name, role, width, title]] of WINDOWS.entries()) {
    const html = fs.readFileSync(`${here}${name}.html`, "utf8");
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
    await page.goto(`${base}?${role === "player" ? "role=player&" : ""}${theme === "legacy" ? "theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass, null, { timeout: 15000 });
    await page.waitForTimeout(2000);
    const read = await page.evaluate(({ html, width, title }) => {
        // The harness's own sample windows stand aside, so the one shot is the module's.
        for (const other of document.querySelectorAll(".application")) other.style.display = "none";
        const holder = document.createElement("div");
        holder.innerHTML = html;
        const win = holder.firstElementChild;
        // The title bar the headless harness does not draw, as the glass harness draws its own (a stand-in for v14's).
        win.insertAdjacentHTML("afterbegin", `<header class="window-header"><h1 class="window-title">${title}</h1></header>`);
        win.style.cssText = `position:fixed;z-index:100;width:${Math.min(width, innerWidth - 32)}px;left:50%;top:50%;transform:translate(-50%,-50%);max-height:${innerHeight - 64}px`;
        document.body.append(win);
        const b = win.getBoundingClientRect();
        return { inside: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, w: Math.round(b.width), h: Math.round(b.height),
            buttons: [...win.querySelectorAll("footer button")].map(x => x.textContent.trim()) };
    }, { html, width, title });
    await page.waitForTimeout(400);
    const file = `${here}${String(i + 1).padStart(2, "0")}-${name}-${theme}-${size}.png`;
    await page.screenshot({ path: file });
    await page.close();
    if (!read.inside) bad++;
    console.log(`${name} ${theme} ${size}: ${JSON.stringify(read)}${read.inside ? "" : "  - FAIL"} -> ${file.slice(here.length)}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
