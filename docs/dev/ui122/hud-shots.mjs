/**
 * The token HUD's on toggles and focus ring, in Chromium (1.2.122 line UI; the audit of 1.2.120, H-1 and H-7): 1.2.120's
 * static page (docs/dev/h120/hud-page.html, the real token-hud.mjs on Daggerheart 2.12.8's markup) in both themes, with
 * and without high contrast. Run from the repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &   node docs/dev/ui122/hud-shots.mjs
 *
 * For each of the four looks it reads, on the hidden-and-locked GM HUD, each on toggle's ground and glyph colour and how
 * many of the glyph's pixels differ from the ground (H-1: none on 1.2.121's high-contrast glass); then it tabs to the
 * first kept button of the plain GM HUD and counts the pixels the outline alone draws (a shot with it, one with it taken
 * off) inside the button's own box and in the 6 px around it (H-7: none under the glass on 1.2.121). Writes docs/dev/ui122/shots/*.png, prints one JSON line a
 * look, and exits 1 when a glyph or a ring does not show. Playwright from audit/harness (`npm ci`).
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/docs/dev/h120/hud-page.html";
const browser = await playwright.chromium.launch(process.env.DRPG_CHROMIUM ? { executablePath: process.env.DRPG_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 390 }, deviceScaleFactor: 1 });
const looks = [["legacy", "theme=monokuma-legacy&lang=en"], ["legacy-hc", "theme=monokuma-legacy&lang=en&hc"],
    ["glass", "theme=stained-glass&lang=en"], ["glass-hc", "theme=stained-glass&lang=en&hc"]];
const rgb = s => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);

/** Pixels of a PNG (as base64) within `tol` of the colour `want`, inside the box `pad` px in from its edge and outside it. */
const near = (data, want, tol, pad) => page.evaluate(async ([data, want, tol, pad]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let inside = 0, outside = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (Math.abs(d[i] - want[0]) + Math.abs(d[i + 1] - want[1]) + Math.abs(d[i + 2] - want[2]) > tol) continue;
        if (x >= pad && y >= pad && x < c.width - pad && y < c.height - pad) inside++; else outside++;
    }
    return { inside, outside, of: c.width * c.height };
}, [data, want, tol, pad]);

let bad = 0;
for (const [name, query] of looks) {
    await page.goto(`${base}?${query}`);
    await page.waitForSelector("body[data-ready]");
    const cells = await page.$$(".cell");
    // H-1: the on toggles of the hidden-and-locked HUD; a glyph shows when its pixels are not the ground's.
    const toggles = [];
    for (const b of await cells[1].$$("button.control-icon.active")) {
        const look = await b.evaluate(el => ({ action: el.dataset.action, bg: getComputedStyle(el).backgroundColor,
            glyph: getComputedStyle(el.querySelector("i")).backgroundColor }));
        const shot = await (await b.$("i")).screenshot();
        const ground = await near(shot.toString("base64"), rgb(look.bg), 60, 0);
        const glyphPixels = ground.of - ground.inside - ground.outside;
        toggles.push({ ...look, glyphPixels, of: ground.of });
        if (glyphPixels === 0) bad++;
    }
    // H-7: the focus ring of the plain GM HUD's first button, reached by the keyboard.
    const first = await cells[0].$("button.control-icon");
    await page.evaluate(() => document.activeElement?.blur());
    let focused = false;
    for (let i = 0; i < 40 && !focused; i++) {
        await page.keyboard.press("Tab");
        focused = await first.evaluate(el => document.activeElement === el && el.matches(":focus-visible"));
    }
    const box = await first.boundingBox();
    const ringColour = await first.evaluate(el => getComputedStyle(el).outlineColor);
    const outlineOffset = await first.evaluate(el => getComputedStyle(el).outlineOffset);
    await page.screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname });
    // The ring alone: the same focused button shot with its outline and again with the outline taken off, and the
    // pixels that differ counted inside the box and in the 6 px around it (the focus also turns the edge and the ground).
    const clip = { x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 };
    const withRing = await page.screenshot({ clip });
    await page.addStyleTag({ content: "#token-hud#token-hud .control-icon:focus-visible { outline: none !important; }" });
    const without = await page.screenshot({ clip });
    const ring = await page.evaluate(async ([a, b, pad]) => {
        const read = async data => {
            const img = new Image();
            img.src = `data:image/png;base64,${data}`;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const g = c.getContext("2d");
            g.drawImage(img, 0, 0);
            return [g.getImageData(0, 0, c.width, c.height).data, c.width, c.height];
        };
        const [da, w, h] = await read(a), [db] = await read(b);
        let inside = 0, outside = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) <= 40) continue;
            if (x >= pad && y >= pad && x < w - pad && y < h - pad) inside++; else outside++;
        }
        return { inside, outside };
    }, [withRing.toString("base64"), without.toString("base64"), 6]);
    if (!focused || ring.inside + ring.outside === 0) bad++;
    console.log(name, JSON.stringify({ toggles, focus: { focused, outlineOffset, ringColour, inside: ring.inside, outside: ring.outside } }));
}
await browser.close();
process.exit(bad ? 1 : 0);
