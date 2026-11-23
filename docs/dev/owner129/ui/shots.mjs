/**
 * S0-GMLIST (1.2.129): the owner's screenshots of the GM panel's roster, from capture.mjs's captures. Each capture is
 * drawn by audit/style-harness.html (`?w=<id>`, as the style sweep draws every captured window, under the module's
 * stylesheets), its /audit/windows/ reads routed to the captures' folder, so nothing committed is read or written; the
 * picture is the panel alone (its element's box), deviceScaleFactor 2, Stained Glass and Monokuma Legacy, at 1920x1080
 * and 1366x768. Run from the repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &
 *     DRPG_CAPTURES=<capture.mjs's folder> node docs/dev/owner129/ui/shots.mjs [--chromium <executable>]
 *
 * DRPG_FONTAWESOME, the folder of an unpacked @fortawesome/fontawesome-free, serves the icon font a real page has
 * (the Free Move's footprint is a Font Awesome glyph under Monokuma Legacy), under v14's family name as
 * docs/dev/owner127/shots.mjs does. Writes gm-panel-<day|eclipse>-<theme>-<size>.png beside this file.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../audit/harness/package.json", import.meta.url));
const { chromium } = require("playwright");
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const caps = process.env.DRPG_CAPTURES;
if (!caps) throw new Error("DRPG_CAPTURES names capture.mjs's folder");
const fa = process.env.DRPG_FONTAWESOME;
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765";
const exe = arg("--chromium") ?? process.env.DRPG_CHROMIUM;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const out = new URL(".", import.meta.url).pathname;
let bad = 0;
for (const state of ["day", "eclipse"]) for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) {
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await page.route("**/audit/windows/**", route => {
        const file = `${caps}/${new URL(route.request().url()).pathname.replace(/^.*\/audit\/windows\//, "")}`;
        if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ status: 200, contentType: file.endsWith(".json") ? "application/json" : "text/html", body: fs.readFileSync(file) });
    });
    if (fa) await page.route("**/vendor-fa/**", route => {
        const file = `${fa}/${new URL(route.request().url()).pathname.replace(/^\/vendor-fa\//, "")}`;
        if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ status: 200, contentType: file.endsWith(".css") ? "text/css" : "font/woff2", body: fs.readFileSync(file) });
    });
    await page.goto(`${base}/audit/style-harness.html?w=gm-panel-${state}${theme === "legacy" ? "&theme=legacy" : ""}`);
    if (fa) {
        await page.addStyleTag({ url: "/vendor-fa/css/all.min.css" });
        await page.addStyleTag({ content: '@font-face { font-family: "Font Awesome 7 Pro"; font-weight: 100 900; src: url("/vendor-fa/webfonts/fa-solid-900.woff2") format("woff2"); } @font-face { font-family: "Font Awesome 7 Pro"; font-weight: 400; src: url("/vendor-fa/webfonts/fa-regular-400.woff2") format("woff2"); }' });
    }
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(600);
    const win = page.locator(".drpg-style-shot .drpg-window-panel").first();
    const read = await win.evaluate(el => ({
        rows: [...el.querySelectorAll(".drpg-gmp-roster tbody tr[data-drpg-actor]")].map(tr => [...tr.cells].map(td => td.textContent.trim()).join(" | ")),
        first: el.querySelector(".drpg-gmp-standing > :not(.drpg-box)")?.classList.contains("drpg-gmp-roster") ?? false
    })).catch(() => null);
    const file = `${out}gm-panel-${state}-${theme}-${size}.png`;
    if (read) await win.screenshot({ path: file });
    const ok = Boolean(read?.first && read.rows.length);
    if (!ok) bad++;
    console.log(`${state} ${theme} ${size}: ${JSON.stringify(read)}${ok ? "" : "  - FAIL"}`);
    await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
