/**
 * Does a pane the curtain moves keep its glass? (1.2.123 line UI; the owner at the table, 21.11.2026: "Przy ruchu
 * kurtyny czasem kafle traca kolor/teksture, a powinny go utrzymywac"; glass.mjs `carryPaneLook`). On the glass
 * harness, Stained Glass, the pulse as the page has it: for each size, role and recut (`drpgTurn`: phase-recut and
 * layout; and `fold`, the Projects tray folded - the owner's own move, 21.11.2026), the first curtain's panes as painted (glass.mjs `paneLooks`) before the recut and 2 s after it. A pane of the
 * new cut that is an old pane moved - its box sharing at least 0.6 of the larger of the two boxes, and standing at least
 * 0.5 px off - must keep the old pane's `hsh` (its tint, stain, texture and pulse) and its `lum`. Prints one line a
 * recut and exits 1 when a moved pane took new numbers, when no pane moved in any recut (the reading would measure
 * nothing), or when the page did not load. Run from the repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &   node docs/dev/ui123/pane-keep.mjs [--chromium <executable>]
 *
 * Playwright from audit/harness (`npm ci`). Read 21.11.2026 with the carry's one call taken out (the tree of 19e0f39c
 * plus `paneLooks`): every moved pane took new numbers - 3, 2 and 8 by the phase recut at 1366x768, 1600x900 and
 * 1920x1080, 5 and 9 by the layout at 1600x900 and 1920x1080, none moved by the layout at 1366x768 - GM and player
 * alike, and a stain changed on 2, 0, 2, 1 and 4 of them; the Projects tray folded moved 3, 3 and 4 panes (the
 * tray's own and the top pane beside it) and every one took new numbers, the top pane taking a stain at 1366x768 for
 * the GM and losing one for a player. With the carry: 0 of the same.
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/audit/glass-harness.html";
const exe = arg("--chromium") ?? process.env.DRPG_CHROMIUM;
const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
const kinds = ["phase-recut", "layout", "fold"], sizes = ["1366x768", "1600x900", "1920x1080"], roles = ["gm", "player"];
let bad = 0, movedAll = 0;
for (const role of roles) for (const size of sizes) for (const kind of kinds) {
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto(base + (role === "player" ? "?role=player" : ""));
    const ok = await page.waitForFunction(() => window.__glass?.paneLooks && window.drpgTurn, null, { timeout: 15000 }).then(() => true, () => false);
    if (!ok) { console.log(`${role} ${size} ${kind}: FAIL - the page did not load glass.mjs's paneLooks or drpgTurn`); bad++; await page.close(); continue; }
    await page.waitForTimeout(2500);
    if (kind !== "fold") await page.evaluate(k => window.drpgTurn(k, { stage: "prep" }), kind);
    const r = await page.evaluate(async kind => {
        const before = window.__glass.paneLooks();
        // the owner's move (21.11.2026): the Projects tray folded, as projects-tray.mjs folds it (the harness's drpgTrayFold)
        if (kind === "fold") {
            document.getElementById("countdowns")?.classList.toggle("drpg-projects-collapsed", true);
            await new Promise(r => setTimeout(r, 2000));
        } else await window.drpgTurn(kind, { stage: "fire", ms: 2000 });
        return { before, after: window.__glass.paneLooks() };
    }, kind);
    await page.close();
    const ov = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const area = a => (a.x1 - a.x0) * (a.y1 - a.y0);
    let moved = 0;
    const lost = [];
    for (const a of r.after) {
        let best = null, most = 0;
        for (const b of r.before) { const v = ov(a, b); if (v > most) { most = v; best = b; } }
        if (!best || most < 0.6 * Math.max(area(a), area(best))) continue;
        const d = Math.max(...["x0", "y0", "x1", "y1"].map(k => Math.abs(a[k] - best[k])));
        if (d < 0.5) continue;
        moved++;
        if (a.hsh !== best.hsh || a.lum !== best.lum) lost.push(`${Math.round(a.x0)},${Math.round(a.y0)} moved ${d.toFixed(1)} px${a.stained !== best.stained ? (best.stained ? ", lost its stain" : ", took a stain") : ""}`);
    }
    movedAll += moved;
    if (lost.length) bad++;
    console.log(`${role} ${size} ${kind}: panes ${r.before.length} -> ${r.after.length}, moved ${moved}, new numbers ${lost.length}${lost.length ? " - FAIL: " + lost.join("; ") : ""}`);
}
await browser.close();
if (!movedAll) { console.log("FAIL: no pane moved in any recut - this measured nothing"); bad++; }
console.log(`PANE-KEEP ${bad ? "RED" : "GREEN"}: headless Chromium; the table's own moves are LIVE-U123-03's`);
process.exit(bad ? 1 : 0);
