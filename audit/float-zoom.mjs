/*
 * A floating field's face under a zoom, in Chromium (the audit's COMM-32, 1.2.122, 21.11.2026).
 *
 *   cd audit/harness && npm ci            (once: Playwright comes from there; it downloads no browser)
 *   python3 -m http.server 8765           (from the repository's root, in another shell)
 *   node audit/float-zoom.mjs [base-url] [--chromium <executable>]
 *
 * scripts/float-text.mjs lifts a textarea into the top layer at its box on the screen; under the case map's camera (a CSS
 * transform on its canvas) that box is the layout's times the zoom, and the face it copies is the layout's, so until
 * 1.2.122 the floating text kept the unzoomed size: at zoom 0.5 a 16 px font in a box half as wide. audit/float-sweep.mjs
 * I7 holds the same on the case map's capture, which this checkout may not hold (probe 08 makes it); this needs none: a
 * 16 px textarea in a scaled box of the module's frame (`.application.drpg-ui`), focused, at zooms 0.5, 1 and 2. Holds
 * that it floats, its screen width does not move, and its font size is 16 times the zoom (within 0.5 px). Exit 1 when one
 * does not. Read on 21.11.2026: 8, 16 and 32 px; at 21bf5d18, 16, 16 and 16.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "harness", "package.json"));
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const exeAt = args.indexOf("--chromium");
const EXE = exeAt >= 0 ? args[exeAt + 1] : (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : null);
const base = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--chromium") ?? "http://localhost:8765";

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
const rows = [];
try {
    for (const z of [0.5, 1, 2]) {
        const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
        await page.goto(`${base}/audit/glass-harness.html`);
        const r = await page.evaluate(async ({ z }) => {
            document.body.innerHTML = `<div class="application drpg-ui" style="position:absolute;left:20px;top:20px;width:900px;height:600px">
                <div style="transform-origin:0 0;transform:scale(${z})"><textarea style="width:220px;height:60px;font-size:16px;line-height:20px;padding:4px">abc</textarea></div></div>`;
            const F = await import("/scripts/float-text.mjs");
            F.registerFloatText();
            const el = document.querySelector("textarea");
            const rest = parseFloat(getComputedStyle(el).fontSize), restBox = el.getBoundingClientRect().width;
            el.focus({ preventScroll: true });
            await new Promise(res => setTimeout(res, 300));
            return { floating: el.matches(":popover-open"), rest, now: parseFloat(getComputedStyle(el).fontSize), restBox, nowBox: el.getBoundingClientRect().width };
        }, { z });
        await page.close();
        const pass = r.floating && Math.abs(r.nowBox - r.restBox) <= 1 && Math.abs(r.now - r.rest * z) <= 0.5;
        rows.push(pass);
        console.log(`${pass ? "ok  " : "FAIL"} zoom ${z}: floating ${r.floating}; font ${r.rest} px at rest, ${r.now} floating (${r.rest * z} wanted); width ${r.restBox} -> ${r.nowBox}`);
    }
} finally {
    await browser.close();
}
console.log(`float-zoom: ${rows.filter(Boolean).length}/${rows.length}`);
process.exit(rows.every(Boolean) ? 0 : 1);
