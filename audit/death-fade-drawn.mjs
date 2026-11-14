/**
 * Danganronpa RPG - is the death fade drawn as the storyboard says? (E62 C3, 13.11.2026; docs/dev/e62/STORYBOARD-C3.md on
 * the e62-c3 line, the owner's answers to SB-C3 and MK-C3)
 * ---------------------------------------------------------------------------
 * On audit/glass-harness.html (a player's page, `?role=player`), in Chromium, at 1366x768, 1280x720 and 1920x1080:
 * scripts/death-fade.mjs `playCurtain` played on the harness's own curtain, and the screen read back as pixels (a
 * screenshot drawn into a canvas in the page). What fails a size:
 *   STAINED GLASS
 *   - lit: a pane of batch 1 (a top sliver) and a pane of batch 3, each read inside its outline where no element of the
 *     interface stands over the glass (the interface keeps its colours: the storyboard's #5), have colour;
 *   - at 1000 ms of the fade: batch 1's pane is grey (its saturation under a third of what it was), batch 3's (the rail's, the status', the tray's; out from
 *     1200 ms) still has colour (over two thirds);
 *   - at rest (3.8 s): the body's `drpg-bare-glass`, no batch canvas left, both panes grey;
 *   - the return (2.6 s): both panes have their colour back, `drpg-bare-glass` off;
 *   - still (a GM's correction): bare at once, no batch canvas.
 *   MONOKUMA LEGACY
 *   - at 700 ms of the fade the Despair bar (`#ui-top`) greys (`filter` holds grayscale) and the voice tile's group not;
 *     at rest all four groups; after the return none.
 * Saturation is HSV's (max - min) / max of a 9x9 block at the pane's centre, mean over the block. Exits 1 on any failure.
 *
 * What it is not: Foundry; the harness's curtain is glass.mjs on the module's markup with Foundry stubbed. Not in CI.
 * Run it with a static server on the repo's root at :8765 (`python3 -m http.server 8765`), Playwright from
 * audit/harness (`npm ci`):  node audit/death-fade-drawn.mjs [--base http://127.0.0.1:8765] [--chromium <executable>]
 */
/* global document, window, Image, getComputedStyle */ // the page.evaluate bodies run in the browser, on the glass harness
import { createRequire } from "module";

const require = createRequire(new URL("./harness/package.json", import.meta.url));
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const base = opt("--base") ?? "http://127.0.0.1:8765";
const exe = opt("--chromium") ?? process.env.DRPG_CHROMIUM ?? undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--no-sandbox"] });
const SIZES = [[1366, 768], [1280, 720], [1920, 1080]];
let failed = 0;
const say = (ok, what, data) => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` - ${JSON.stringify(data)}`}`); };

/* The saturation of a 9x9 block at each point, read off a screenshot of the page drawn into a canvas in the page. */
async function saturations(page, points) {
    const png = (await page.screenshot()).toString("base64");
    return page.evaluate(async ({ png, points }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        return points.map(([x, y]) => {
            const d = g.getImageData(Math.max(0, Math.round(x) - 4), Math.max(0, Math.round(y) - 4), 9, 9).data;
            let sum = 0, n = 0;
            for (let i = 0; i < d.length; i += 4) {
                const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
                sum += mx ? (mx - mn) / mx : 0; n++;
            }
            return n ? sum / n : 0;
        });
    }, { png, points });
}

for (const [w, h] of SIZES) {
    /* ---------------------------------------------------------------- Stained Glass */
    {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(`${base}/audit/glass-harness.html?role=player&w=${w}&h=${h}`);
        await page.waitForTimeout(3000);
        const where = await page.evaluate(async () => {
            const DF = await import("/scripts/death-fade.mjs");
            window.__df = DF;
            const H = window.innerHeight;
            const panes = window.__glass?.LAST?.panes ?? [];
            // glass only: a pane whose centre holds no element of the interface over the board (the UI keeps its colours,
            // the storyboard's #5), the largest such pane of its batch
            const inside = (poly, x, y) => {
                let hit = false;
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const [xi, yi] = poly[i], [xj, yj] = poly[j];
                    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = true;
                }
                return hit;
            };
            // a point of the pane, inside its outline, where the board is the top element: glass over the map alone
            const glassPoint = p => {
                for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) {
                    for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
                        const x = p.x0 + (p.x1 - p.x0) * fx, y = p.y0 + (p.y1 - p.y0) * fy;
                        if (inside(p.poly, x, y) && document.elementsFromPoint(x, y)[0]?.id === "board") return [x, y];
                    }
                }
                return null;
            };
            const pick = b => panes.filter(p => DF.batchOf(p, H) === b && !p.empty)
                .sort((a, z) => (z.x1 - z.x0) * (z.y1 - z.y0) - (a.x1 - a.x0) * (a.y1 - a.y0)).map(glassPoint).find(Boolean) ?? null;
            return { panes: panes.length, one: pick(1), five: pick(3) };
        });
        if (!where.one || !where.five) { say(false, `${w}x${h} glass: panes of batch 1 and 3 found`, where); await page.close(); continue; }
        const points = [where.one, where.five];
        const lit = await saturations(page, points);
        say(lit[0] > 0.08 && lit[1] > 0.08, `${w}x${h} glass: lit, batch 1's and batch 3's panes have colour`, { lit, where });
        await page.evaluate(() => window.__df.playCurtain("fade", { glass: true, panes: window.__glass.LAST.panes }));
        await page.waitForTimeout(1000);
        const mid = await saturations(page, points);
        say(mid[0] < lit[0] / 3 && mid[1] > lit[1] * 2 / 3, `${w}x${h} glass: at 1000 ms batch 1 is grey and batch 3 not yet`, { lit, mid });
        await page.waitForTimeout(2800);
        const rest = await saturations(page, points);
        const restState = await page.evaluate(() => ({ bare: document.body.classList.contains("drpg-bare-glass"),
            layers: document.querySelectorAll(".drpg-bare-layer").length }));
        say(restState.bare && restState.layers === 0 && rest[0] < lit[0] / 3 && rest[1] < lit[1] / 3,
            `${w}x${h} glass: at rest the class stands, no batch canvas, both panes grey`, { lit, rest, restState });
        await page.evaluate(() => window.__df.playCurtain("return", { glass: true, panes: window.__glass.LAST.panes }));
        await page.waitForTimeout(2600);
        const back = await saturations(page, points);
        const backState = await page.evaluate(() => document.body.classList.contains("drpg-bare-glass"));
        say(!backState && back[0] > lit[0] * 2 / 3 && back[1] > lit[1] * 2 / 3, `${w}x${h} glass: after the return both panes have their colour`, { lit, back, backState });
        await page.evaluate(() => window.__df.playCurtain("fade", { still: true, glass: true }));
        const still = await page.evaluate(() => ({ bare: document.body.classList.contains("drpg-bare-glass"),
            layers: document.querySelectorAll(".drpg-bare-layer").length }));
        say(still.bare && still.layers === 0, `${w}x${h} glass: still, bare at once`, still);
        await page.close();
    }
    /* ---------------------------------------------------------------- Monokuma Legacy */
    {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(`${base}/audit/glass-harness.html?role=player&theme=legacy&w=${w}&h=${h}`);
        await page.waitForTimeout(2500);
        const grey = () => page.evaluate(() => {
            const f = sel => getComputedStyle(document.querySelector(sel) ?? document.body).filter;
            return { top: f("#ui-top"), voice: f("#drpg-voice-tile"), left: f("#ui-left-column-1") };
        });
        const has = v => String(v).includes("grayscale");
        await page.evaluate(async () => {
            window.__df = await import("/scripts/death-fade.mjs");
            document.body.classList.add("drpg-theme-monokuma-legacy");
            document.body.classList.remove("drpg-theme-stained-glass");
            window.__df.playCurtain("fade", { glass: false });
        });
        await page.waitForTimeout(700);
        const mid = await grey();
        say(has(mid.top) && !has(mid.voice), `${w}x${h} legacy: at 700 ms the Despair bar is grey and the voice tile not`, mid);
        await page.waitForTimeout(3100);
        const rest = await grey();
        say(has(rest.top) && has(rest.voice) && has(rest.left), `${w}x${h} legacy: at rest all groups grey`, rest);
        await page.evaluate(() => window.__df.playCurtain("return", { glass: false }));
        await page.waitForTimeout(2600);
        const back = await grey();
        say(!has(back.top) && !has(back.voice) && !has(back.left), `${w}x${h} legacy: after the return no group grey`, back);
        await page.close();
    }
}
await browser.close();
console.log(failed ? `death-fade-drawn: ${failed} failure(s)` : "death-fade-drawn: all held");
process.exit(failed ? 1 : 0);
