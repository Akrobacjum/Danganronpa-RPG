/**
 * The owner's screenshots for OWNER-124-NOTICES (1.2.124 line UI, 22.11.2026): the important notices in the middle of a
 * player's screen, and the corner beside them. Chromium, deviceScaleFactor 1 (the coordinator's weight of 22.11.2026),
 * 1920x1080 and 1366x768, Stained Glass and
 * Monokuma Legacy, the glass harness as a player (`?role=player`). Run from the repository's root with a static server:
 *
 *     python3 -m http.server 8765 &   node docs/dev/owner124/notices/shots.mjs [--chromium <executable>]
 *
 * WHAT IS REAL AND WHAT IS NOT. The cards are drawn by the module's own popup.mjs `showPopup` - the notices' stage, its
 * queue and "+N", the corner tile - under the module's own stylesheets, with the options popup.mjs's catch-all hands a
 * chat card (its title, its tone, `centre` as notice-centre.mjs `centredNotice` answers). The harness has no chat
 * documents and no dice, so no chat card is posted: each card's words are built by the posters' own functions
 * (utils.mjs `cardHead`, action-report.mjs `rollHead`, action-pipeline.mjs `neededNote`) from a stand-in roll, in the
 * order the poster writes them, with lang/en.json's sentences - not taken from a played action. The map is the harness's.
 * UNDER MONOKUMA LEGACY THE X DRAWS NO GLYPH HERE: its icon is Font Awesome's, which Foundry loads and the harness does
 * not (Stained Glass draws its own, pixel-icons.css). The button is there - each line prints its box - and in Foundry it
 * shows the glyph, as every Legacy card's X does.
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
const SHOTS = ["centre-action", "centre-two-waiting", "centre-lock", "corner-ordinary", "same-card", "centre-tail"];
let bad = 0;
for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) for (const [i, shot] of SHOTS.entries()) {
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(`${base}?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass && document.getElementById("drpg-popups"), null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const read = await page.evaluate(async shot => {
        // lang/en.json's words (the harness's own `localize` answers a key's last segment)
        const en = await (await fetch("/lang/en.json")).json();
        const at = key => key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), en);
        const fill = (s, d = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in d ? d[k] : m));
        game.i18n = { ...game.i18n, localize: k => (typeof at(k) === "string" ? at(k) : k), format: (k, d) => fill(typeof at(k) === "string" ? at(k) : k, d), has: k => at(k) !== undefined };
        // the one Foundry constant action-report.mjs's imports read as they load (remnants.mjs), at Foundry's own values
        globalThis.CONST ??= { DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
        const P = await import("/scripts/popup.mjs");
        const U = await import("/scripts/utils.mjs");
        const R = await import("/scripts/action-report.mjs");
        const { neededNote } = await import("/scripts/action-pipeline.mjs");
        const t = (k, d) => game.i18n.format(k, d);
        /* THE CARDS AS THEIR POSTERS BUILD THEM, from a stand-in roll: a Search's (action-report.mjs `report`: its head
           with the room, the tier and the ladder it needed, the dice under it, the find), a Tail noticed (action-tail.mjs:
           `rollHead`, the Shadow roll against its 15, the sentence), a forced bedroom door (doors-gm.mjs `bedroomCard`). */
        const roll = (total, dc, trait, hope, fear, side) => ({ total, dc, trait, withHope: side === "hope", withFear: side === "fear",
            raw: { total, hope: { total: hope }, fear: { total: fear }, data: { traits: {} } } });
        const { TRAITS } = await import("/scripts/config.mjs");
        const searchRoll = roll(14, "8 / 12 / 16", "eye", 9, 3, "hope");
        const head = U.cardHead({ action: "Search", room: "Library", total: 14, result: t("DRPG.Action.tierShort", { tier: 1 }), resultKind: "evidence", trait: TRAITS.eye?.label, dc: searchRoll.dc });
        // the dice under the head, as `report` draws them: `rollHead` is the head and the dice, so the head it drew is taken off
        const bare = U.cardHead({ action: "Search", total: 14, result: null, resultKind: null, trait: TRAITS.eye?.label, dc: searchRoll.dc });
        const both = R.rollHead({ label: "Search" }, searchRoll);
        if (!both.startsWith(bare)) throw new Error("rollHead's head is not cardHead's - the shot would draw a broken card");
        const bar = both.slice(bare.length);
        const search = `${head}${bar}<p>${t("DRPG.Action.found", { tier: 1, item: "Rusty Key" })}</p><p><em>${t("DRPG.Action.leavesRemnant")}</em></p><p><small>${t("DRPG.Action.tokensLeft.other", { room: "Library", n: 2 })}</small></p>`;
        const tailRoll = roll(11, null, "leg", 6, 3, "fear");
        // a card's spec drawn as utils.mjs `whisperToOwner` draws it (chat-card.mjs `cardMarkup`)
        const { cardMarkup } = await import("/scripts/chat-card.mjs");
        const tail = cardMarkup({ glyph: "ACTIONS.listen", body: `${R.rollHead({ label: "Tail Someone" }, tailRoll)}<p><small>${t("DRPG.Infiltrate.tail.unseenTitle")} - <b>12</b>${neededNote(15)}</small></p><p>${t("DRPG.Infiltrate.tail.startedSeen", { name: "Aiko Hoshino" })}</p>` });
        const lock = `<p>${t("DRPG.Infiltrate.force.yourDoor", { room: "Dorm - Daichi" })}</p>`;
        if (shot === "centre-action" || shot === "centre-two-waiting" || shot === "same-card") P.showPopup(search, { title: "Search", tone: "hope", centre: true, record: false });
        if (shot === "centre-two-waiting") P.showPopup(tail, { title: "Tail Someone", tone: "fear", centre: true, record: false });
        if (shot === "centre-lock") P.showPopup(lock, { centre: true, record: false });
        if (shot === "centre-tail") P.showPopup(tail, { title: "Tail Someone", tone: "fear", centre: true, record: false });
        // the corner: the same Search card where it stood before 1.2.124, and an ordinary notice
        if (shot === "same-card") P.showPopup(search, { title: "Search", tone: "hope", record: false });
        if (shot === "corner-ordinary") P.showPopup(`<p>The afternoon ends. It is evening now.</p>`, { title: "Evening", record: false });
        await new Promise(r => setTimeout(r, 900));
        const stage = document.getElementById("drpg-notice-centre");
        const cards = stage ? [...stage.querySelectorAll(".drpg-popup")] : [];
        const front = cards.find(c => !c.classList.contains("drpg-popup-parked"));
        const b = front?.getBoundingClientRect(), x = front?.querySelector(".drpg-popup-close")?.getBoundingClientRect();
        const dialog = document.querySelector(".application, .window-app, dialog, .app");
        return { shown: cards.filter(c => !c.classList.contains("drpg-popup-parked")).length, waiting: cards.filter(c => c.classList.contains("drpg-popup-parked")).length,
            more: stage?.querySelector(".drpg-popup-more")?.textContent ?? null, inside: b ? b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight : null,
            size: b ? [Math.round(b.width), Math.round(b.height)] : null, x: x ? [Math.round(x.width), Math.round(x.height)] : null,
            raised: stage?.classList.contains("is-raised") ?? null, corner: document.querySelectorAll("#drpg-popups .drpg-popup:not(.drpg-popup-parked)").length };
    }, shot);
    const file = `${out}${String(i + 1).padStart(2, "0")}-${shot}-${theme}-${size}.png`;
    await page.screenshot({ path: file });
    await page.close();
    const want = { "centre-action": [1, 0, 0], "centre-two-waiting": [1, 1, 0], "centre-lock": [1, 0, 0], "corner-ordinary": [0, 0, 1], "same-card": [1, 0, 1], "centre-tail": [1, 0, 0] }[shot];
    const ok = read.shown === want[0] && read.waiting === want[1] && read.corner === want[2] && (want[0] === 0 || (read.inside && read.raised && read.x?.[0] > 0));
    if (!ok) bad++;
    console.log(`${shot} ${theme} ${size}: ${JSON.stringify(read)}${ok ? "" : "  - FAIL"} -> ${file.slice(out.length)}`);
}
/* THE FOCUS STAYS WHERE IT WAS (no screenshot): a field in an open window has the focus and its caret, a centred card
   arrives, the player clicks the card's words and then its X with the mouse; the field must still have the focus and the
   caret where it was, and the card must be gone. Both themes, 1366x768. */
for (const theme of ["stained", "legacy"]) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(`${base}?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass && document.getElementById("drpg-popups"), null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
        const box = document.createElement("textarea");
        box.id = "owner124-typing";
        box.style.cssText = "position:fixed;left:40px;bottom:40px;width:300px;height:60px;z-index:99999";
        document.body.append(box);
    });
    await page.click("#owner124-typing");
    await page.keyboard.type("I hide the knife");
    await page.evaluate(async () => { (await import("/scripts/popup.mjs")).showPopup("<p>A result.</p>", { title: "Search", centre: true, record: false }); });
    await page.waitForTimeout(600);
    await page.click("#drpg-notice-centre .drpg-popup-body");
    const afterWords = await page.evaluate(() => document.activeElement?.id ?? null);
    await page.click("#drpg-notice-centre .drpg-popup-close");
    await page.waitForTimeout(1300);
    await page.keyboard.type(" under the floor");
    const r = await page.evaluate(() => ({ focus: document.activeElement?.id ?? null, text: document.getElementById("owner124-typing").value,
        gone: !document.querySelector("#drpg-notice-centre .drpg-popup") }));
    const ok = afterWords === "owner124-typing" && r.focus === "owner124-typing" && r.text === "I hide the knife under the floor" && r.gone;
    if (!ok) bad++;
    console.log(`focus ${theme}: after a click on its words ${afterWords}, after its X ${r.focus}, typed "${r.text}", card gone ${r.gone}${ok ? "" : "  - FAIL"}`);
    await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
