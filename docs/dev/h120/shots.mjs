/**
 * The token HUD's shots for the owner (1.2.120 line H): hud-page.html in Chromium, in both themes, in English and
 * Polish, and with high contrast. Run from the repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &   node docs/dev/h120/shots.mjs
 *
 * Playwright from audit/harness (`npm ci`); `DRPG_CHROMIUM=<executable>` when its browser is not installed. Writes docs/dev/h120/shots/*.png and prints what each HUD holds.
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/docs/dev/h120/hud-page.html";
// A Chromium of its own (`DRPG_CHROMIUM`, the path to its executable) where the harness's Playwright has no browser.
const browser = await playwright.chromium.launch(process.env.DRPG_CHROMIUM ? { executablePath: process.env.DRPG_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 390 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
// The page asks for no favicon of its own: the server's 404 for /favicon.ico is not an error of the page.
page.on("console", m => { if (m.type() === "error" && !/favicon|404/.test(m.text() + m.location()?.url)) errors.push(m.text()); });
const shots = [
    ["legacy-en", "theme=monokuma-legacy&lang=en"], ["glass-en", "theme=stained-glass&lang=en"],
    ["legacy-pl", "theme=monokuma-legacy&lang=pl"], ["glass-pl", "theme=stained-glass&lang=pl"],
    ["legacy-hc", "theme=monokuma-legacy&lang=en&hc"], ["glass-hc", "theme=stained-glass&lang=en&hc"]
];
for (const [name, query] of shots) {
    await page.goto(`${base}?${query}`);
    await page.waitForSelector("body[data-ready]");
    const read = await page.evaluate(() => [...document.querySelectorAll(".cell")].map(cell => ({
        label: cell.querySelector(".label").textContent,
        buttons: [...cell.querySelectorAll("button.control-icon")].map(b => {
            const i = b.querySelector("i"), cs = i ? getComputedStyle(i) : null;
            return { action: b.dataset.action, label: b.getAttribute("aria-label"), mask: cs ? cs.maskImage !== "none" || cs.webkitMaskImage !== "none" : null,
                faGlyph: i ? getComputedStyle(i, "::before").content : null, bg: getComputedStyle(b).backgroundColor };
        })
    })));
    await page.screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname });
    console.log(name, JSON.stringify(read));
}
await browser.close();
if (errors.length) { console.error("page errors:", errors); process.exit(1); }
