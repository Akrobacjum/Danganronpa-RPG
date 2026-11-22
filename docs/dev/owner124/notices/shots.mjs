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
/* What the coordinator asked for on 22.11.2026 (the owner's "Zainspirujmy sie nim"): the Search result with Hope, a
   failed Shadow, a roll with Despair, the broken lock, two waiting with "+1" beside the X, and the corner beside the
   middle; Stained Glass at 1920x1080 and Monokuma Legacy at 1366x768 (`--all` draws both sizes in both themes). */
const SHOTS = ["search-hope", "failed-shadow", "despair", "lock", "two-waiting", "same-card"];
const LOOKS = process.argv.includes("--all")
    ? ["stained", "legacy"].flatMap(theme => ["1920x1080", "1366x768"].map(size => [theme, size]))
    : [["stained", "1920x1080"], ["legacy", "1366x768"]];
let bad = 0;
for (const [theme, size] of LOOKS) for (const [i, shot] of SHOTS.entries()) {
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
        // the one Foundry constant the posters' imports read as they load (remnants.mjs), at Foundry's own values
        globalThis.CONST ??= { DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
        // and the canvas classes action-tail.mjs's imports name as they load (fog-reveal.mjs); no canvas is drawn here
        foundry.canvas ??= {};
        foundry.canvas.animation ??= { CanvasAnimation: class {} };
        const P = await import("/scripts/popup.mjs");
        const R = await import("/scripts/action-report.mjs");
        const T = await import("/scripts/action-tail.mjs");
        const { traceFeedback } = await import("/scripts/remnants.mjs");
        const { cardMarkup } = await import("/scripts/chat-card.mjs");
        const { MODULE_ID } = await import("/scripts/config.mjs");
        const t = (k, d) => game.i18n.format(k, d);
        /* THE CARDS AS THEIR POSTERS BUILD THEM, each from a stand-in roll (the harness throws no dice):
           action-report.mjs `reportHtml` (what `report` posts), action-tail.mjs `tailCard`, action-report.mjs
           `rollResultCard` (Force the Door), and the bedroom card's sentence as doors-gm.mjs `bedroomCard` writes it.
           A trace is placed in each roll, and the card says it only as remnants.mjs `traceFeedback` lets it. */
        const roll = (total, dc, trait, hope, fear, side) => ({ total, dc, trait, withHope: side === "hope", withFear: side === "fear", isCritical: side === "critical",
            raw: { total, hope: { total: hope }, fear: { total: fear }, data: { traits: {} } } });
        const asPopup = ([spec, flags]) => [cardMarkup(spec), { title: flags.flags[MODULE_ID].popupTitle, tone: flags.flags[MODULE_ID].popupTone }];
        const hopeRoll = roll(14, "8 / 12 / 16", "eye", 9, 3, "hope");
        const search = [R.reportHtml({ label: "Search" }, hopeRoll, { item: "Rusty Key", tier: 1, room: "Library", tokensLeft: 2, leftTrace: traceFeedback(hopeRoll, true) }, "Library"),
            { title: "Search", tone: R.rollTone(hopeRoll) }];
        const tailRoll = roll(11, null, "leg", 6, 3, "hope"), shadow = roll(12, 15, "shadow", 5, 4, "hope");
        const tail = asPopup(T.tailCard("Tail Someone", tailRoll, shadow, true, "Aiko Hoshino"));
        const forceRoll = roll(13, 18, "body", 4, 7, "fear");
        const force = asPopup(R.rollResultCard("Force the Door", forceRoll, `<p>${t("DRPG.Infiltrate.force.held", { room: "Kitchen" })}</p>`));
        const lock = `<p>${t("DRPG.Infiltrate.force.yourDoor", { room: "Dorm - Daichi" })}</p>`;
        const centre = ([html, o]) => P.showPopup(html, { ...o, centre: true, record: false });
        if (shot === "search-hope" || shot === "two-waiting" || shot === "same-card") centre(search);
        if (shot === "failed-shadow") centre(tail);
        if (shot === "two-waiting") centre(tail);
        if (shot === "despair") centre(force);
        if (shot === "lock") P.showPopup(lock, { centre: true, record: false });
        // the corner: the same Search card where it stood before 1.2.124
        if (shot === "same-card") P.showPopup(search[0], { ...search[1], record: false });
        await new Promise(r => setTimeout(r, 900));
        const stage = document.getElementById("drpg-notice-centre");
        const cards = stage ? [...stage.querySelectorAll(".drpg-popup")] : [];
        const front = cards.find(c => !c.classList.contains("drpg-popup-parked"));
        const b = front?.getBoundingClientRect(), x = front?.querySelector(".drpg-popup-close")?.getBoundingClientRect();
        return { shown: cards.filter(c => !c.classList.contains("drpg-popup-parked")).length, waiting: cards.filter(c => c.classList.contains("drpg-popup-parked")).length,
            more: stage?.querySelector(".drpg-popup-more")?.textContent ?? null, inside: b ? b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight : null,
            size: b ? [Math.round(b.width), Math.round(b.height)] : null, x: x ? [Math.round(x.width), Math.round(x.height)] : null,
            vs: front?.querySelector(".drpg-duality-vs")?.textContent.replace(/\s+/g, " ").trim() ?? null,
            remnant: front?.textContent.includes(t("DRPG.Action.leavesRemnant")) ?? null,
            raised: stage?.classList.contains("is-raised") ?? null, corner: document.querySelectorAll("#drpg-popups .drpg-popup:not(.drpg-popup-parked)").length };
    }, shot);
    const file = `${out}${String(i + 1).padStart(2, "0")}-${shot}-${theme}-${size}.png`;
    await page.screenshot({ path: file });
    await page.close();
    const want = { "search-hope": [1, 0, 0], "failed-shadow": [1, 0, 0], despair: [1, 0, 0], lock: [1, 0, 0], "two-waiting": [1, 1, 0], "same-card": [1, 0, 1] }[shot];
    const ok = read.shown === want[0] && read.waiting === want[1] && read.corner === want[2] && read.inside && read.raised && read.x?.[0] > 0
        && (shot !== "despair" || read.remnant === false);
    if (!ok) bad++;
    console.log(`${shot} ${theme} ${size}: ${JSON.stringify(read)}${ok ? "" : "  - FAIL"} -> ${file.slice(out.length)}`);
}
/* SEE-THROUGH: does the window behind a centred card read through it? The Search card over the harness's open dialog,
   shot as it stands (A) and again with the dialog taken away (B), the card's body clipped the same in both: a pixel of
   the body that differs between A and B is the window showing through. Printed: how many such pixels, and the worst WCAG
   contrast between the body's words (their computed colour) and those pixels - against the plate alone where there are
   none. The card is held still (no transition) so only the window differs. Read 6 px inside the body: under Monokuma
   Legacy the card's 1 px edge lets a column of the window through (130 pixels at 1366x768, read 22.11.2026), its frame
   and not its plate. */
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [theme, W, H] of [["stained", 1920, 1080], ["legacy", 1366, 768]]) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto(`${base}?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass && document.getElementById("drpg-popups"), null, { timeout: 15000 });
    await page.waitForTimeout(2000);
    const box = await page.evaluate(async () => {
        const en = await (await fetch("/lang/en.json")).json();
        const at = key => key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), en);
        const fill = (s, d = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in d ? d[k] : m));
        game.i18n = { ...game.i18n, localize: k => (typeof at(k) === "string" ? at(k) : k), format: (k, d) => fill(typeof at(k) === "string" ? at(k) : k, d), has: k => at(k) !== undefined };
        globalThis.CONST ??= { DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
        const P = await import("/scripts/popup.mjs"), R = await import("/scripts/action-report.mjs");
        const rolled = { total: 14, dc: "8 / 12 / 16", trait: "eye", withHope: true, raw: { total: 14, hope: { total: 9 }, fear: { total: 3 }, data: { traits: {} } } };
        P.showPopup(R.reportHtml({ label: "Search" }, rolled, { item: "Rusty Key", tier: 1, room: "Library", tokensLeft: 2, leftTrace: false }, "Library"), { title: "Search", tone: "hope", centre: true, record: false });
        await new Promise(r => setTimeout(r, 900));
        const card = document.querySelector("#drpg-notice-centre .drpg-popup");
        card.style.transition = "none";
        const b = card.querySelector(".drpg-popup-body").getBoundingClientRect();
        // 6 px inside the body: the card's own 1 px edge (the window edge's colour, translucent under Monokuma Legacy) is its frame, not its plate
        return { x: Math.round(b.left) + 6, y: Math.round(b.top) + 6, width: Math.round(b.width) - 12, height: Math.round(b.height) - 12,
            text: getComputedStyle(card.querySelector(".drpg-popup-body p:last-of-type") ?? card).color };
    });
    const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
    const shotA = await page.screenshot({ clip });
    await page.evaluate(() => { for (const d of document.querySelectorAll(".application.dialog")) d.style.visibility = "hidden"; });
    await page.waitForTimeout(300);
    const shotB = await page.screenshot({ clip });
    const r = await page.evaluate(async ([a, b]) => {
        const read = async data => { const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
        const [da, db] = [await read(a), await read(b)];
        const through = [], plate = new Map();
        for (let i = 0; i < da.length; i += 4) {
            const p = [da[i], da[i + 1], da[i + 2]];
            if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 6) through.push(p);
            else { const k = p.join(","); plate.set(k, (plate.get(k) ?? 0) + 1); }
        }
        const common = [...plate.entries()].sort((x, y) => y[1] - x[1])[0][0].split(",").map(Number);
        return { through, common, of: da.length / 4 };
    }, [shotA.toString("base64"), shotB.toString("base64")]);
    const text = (box.text.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const worst = r.through.length ? Math.min(...r.through.map(p => contrast(text, p))) : contrast(text, r.common);
    const ok = r.through.length === 0;
    if (!ok) bad++;
    console.log(`see-through ${theme} ${W}x${H}: ${r.through.length} of ${r.of} body pixels change with the window behind; worst contrast of the words (${text.join(",")}) ${worst.toFixed(2)}:1 ${r.through.length ? "against the window showing through" : `against the plate (${r.common.join(",")})`}${ok ? "" : "  - FAIL"}`);
    await page.close();
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
