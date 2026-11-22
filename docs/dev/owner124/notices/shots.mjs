/**
 * The owner's screenshots for OWNER-124-NOTICES (1.2.124 line UI, 22.11.2026): the important notices in the middle of a
 * player's screen, and the corner beside them. Chromium, deviceScaleFactor 2, 1920x1080 and 1366x768, Stained Glass and
 * Monokuma Legacy, the glass harness as a player (`?role=player`). Run from the repository's root with a static server:
 *
 *     python3 -m http.server 8765 &   node docs/dev/owner124/notices/shots.mjs [--chromium <executable>]
 *
 * WHAT IS REAL AND WHAT IS NOT. The cards are drawn by the module's own popup.mjs `showPopup` - the notices' stage, its
 * queue and "+N", the corner tile - under the module's own stylesheets, with the options popup.mjs's catch-all hands a
 * chat card (its title, its tone, `centre` as notice-centre.mjs `centredNotice` answers). The harness has no chat
 * documents, so no chat card is posted: each card's words are written here from lang/en.json's own sentences, laid out
 * as the module's cards lay them out, not taken from a played action. The map under the glass is the harness's grid.
 *
 * Writes NN-<shot>-<theme>-<size>.png beside this file, and prints, for each, the stage's cards: shown, waiting, the
 * "+N" and whether the front card stands inside the screen.
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/audit/glass-harness.html";
const exe = arg("--chromium") ?? process.env.DRPG_CHROMIUM;
const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
const out = new URL(".", import.meta.url).pathname;
const SHOTS = ["centre-action", "centre-two-waiting", "centre-lock", "corner-ordinary"];
let bad = 0;
for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) for (const [i, shot] of SHOTS.entries()) {
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await page.goto(`${base}?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass && document.getElementById("drpg-popups"), null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const read = await page.evaluate(async shot => {
        // lang/en.json's words for the cards' bars and labels (the harness's own `localize` answers a key's last segment)
        const en = await (await fetch("/lang/en.json")).json();
        const at = key => key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), en);
        const fill = (s, d = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in d ? d[k] : m));
        game.i18n = { ...game.i18n, localize: k => (typeof at(k) === "string" ? at(k) : k), format: (k, d) => fill(typeof at(k) === "string" ? at(k) : k, d), has: k => at(k) !== undefined };
        const P = await import("/scripts/popup.mjs");
        const t = (k, d) => game.i18n.format(k, d);
        const search = `<p><strong>Search</strong> - 14 <em>with Hope</em></p><p>You find a <b>Rusty Key</b> (Tier 1).</p><p><em>${t("DRPG.Action.leavesRemnant")}</em></p><p><small>${t("DRPG.Action.tokensLeft.other", { room: "Library", n: 2 })}</small></p>`;
        const tail = `<p>${t("DRPG.Infiltrate.tail.startedSeen", { name: "Aiko Hoshino" })}</p>`;
        const lock = `<p>${t("DRPG.Infiltrate.force.yourDoor", { room: "Dorm - Daichi" })}</p>`;
        if (shot === "centre-action" || shot === "centre-two-waiting") P.showPopup(search, { title: "Search", tone: "hope", centre: true, record: false });
        if (shot === "centre-two-waiting") P.showPopup(tail, { title: "Tail Someone", centre: true, record: false });
        if (shot === "centre-lock") P.showPopup(lock, { centre: true, record: false });
        // the corner, for comparison: an ordinary notice, as the time of day's card is drawn
        if (shot === "corner-ordinary") P.showPopup(`<p>The afternoon ends. It is evening now.</p>`, { title: "Evening", record: false });
        await new Promise(r => setTimeout(r, 900));
        const stage = document.getElementById("drpg-notice-centre");
        const cards = stage ? [...stage.querySelectorAll(".drpg-popup")] : [];
        const front = cards.find(c => !c.classList.contains("drpg-popup-parked"));
        const b = front?.getBoundingClientRect();
        return { shown: cards.filter(c => !c.classList.contains("drpg-popup-parked")).length, waiting: cards.filter(c => c.classList.contains("drpg-popup-parked")).length,
            more: stage?.querySelector(".drpg-popup-more")?.textContent ?? null, inside: b ? b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight : null,
            raised: stage?.classList.contains("is-raised") ?? null, corner: document.querySelectorAll("#drpg-popups .drpg-popup:not(.drpg-popup-parked)").length };
    }, shot);
    const file = `${out}${String(i + 1).padStart(2, "0")}-${shot}-${theme}-${size}.png`;
    await page.screenshot({ path: file });
    await page.close();
    const want = { "centre-action": [1, 0], "centre-two-waiting": [1, 1], "centre-lock": [1, 0], "corner-ordinary": [0, 0] }[shot];
    const ok = read.shown === want[0] && read.waiting === want[1] && (want[0] === 0 || read.inside) && (shot !== "corner-ordinary" || read.corner === 1);
    if (!ok) bad++;
    console.log(`${shot} ${theme} ${size}: ${JSON.stringify(read)}${ok ? "" : "  - FAIL"} -> ${file.slice(out.length)}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
