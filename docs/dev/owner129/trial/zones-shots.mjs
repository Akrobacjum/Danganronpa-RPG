/**
 * The owner's screenshots for E129 S0-ZONESTYLE (23.11.2026): a Straw Poll's two zones on the trial hall, each named at
 * its middle by its answer, with the mode's cards beside them, in English and in Polish. Chromium, 1920x1080 and
 * 1366x768, Stained Glass and Monokuma Legacy, the glass harness under the module's stylesheets. Run from the
 * repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &   node docs/dev/owner129/trial/zones-shots.mjs --pixi <pixi.min.js of pixi.js 7.4.2> [--chromium <exe>] [--dsf 2]
 *
 * WHAT IS REAL AND WHAT IS NOT.
 * - The zones are drawn by the module's own trial-zones-ui.mjs `drawZones`, imported into the page, with PIXI 7.4.2
 *   (Foundry's canvas library line; not in the repository, handed in by `--pixi` and served to the page at /pixi.min.js),
 *   through the rooms' own pieces (fog-reveal.mjs `outlineWidths`, `roomNameText`, `seamHalo`, `bakeOutlineHalo`). The
 *   Foundry names the module reads at load that the glass harness does not define stand in for that import only, as the
 *   page's `drpgVoiceList` does: each a no-op that answers anything.
 * - The board is a stand-in: a 2000 x 1000 hall with a grid of 100, its left half one zone and its right half the
 *   other, on a plain dark floor with grid lines - not a hall's picture - shown at a zoom of 0.55 (less where the screen is
 *   smaller) in a canvas over the cards. Foundry's own canvas (its layers, its lighting, a map's image) is not here.
 * - The cards are the module's own, as the GM posted them on the headless harness for a Straw Poll opened and counted
 *   (2 for the first answer, 1 for the second: two thirds, a Finding) in English and again with the GM's client given lang/pl.json,
 *   saved beside this file as zones-cards-en.html and zones-cards-pl.html, shown side by side under the board as chat cards.
 *   Foundry's chat log around them is not drawn.
 * Writes 05-zones-<lang>-<theme>-<size>.png beside this file.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/audit/glass-harness.html";
const exe = arg("--chromium") ?? process.env.DRPG_CHROMIUM;
const pixi = arg("--pixi");
if (!pixi || !fs.existsSync(pixi)) throw new Error("--pixi <path to pixi.js 7.4.2's dist/pixi.min.js> is needed");
const dsf = Number(arg("--dsf") ?? 2);
const here = new URL(".", import.meta.url).pathname;
const ANSWERS = {
    en: { q: "Who locked the library?", a: "Someone inside", b: "Someone outside, with the janitor's key" },
    pl: { q: "Kto zamknął bibliotekę?", a: "Ktoś od środka", b: "Ktoś z zewnątrz, kluczem woźnego" }
};
const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
let bad = 0;
for (const lang of ["en", "pl"]) for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) {
    const cards = fs.readFileSync(`${here}zones-cards-${lang}.html`, "utf8");
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
    await page.route("**/pixi.min.js", route => route.fulfill({ path: pixi, contentType: "text/javascript" }));
    await page.goto(`${base}?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass, null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.addScriptTag({ url: "/pixi.min.js" });
    const read = await page.evaluate(async ({ cards, words, glass }) => {
        for (const other of document.querySelectorAll(".application")) other.style.display = "none";
        // The Foundry names the module's files read at load, lent for the import alone (the page's `drpgVoiceList`).
        const any = () => new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : any()), construct: () => ({}), apply: () => undefined });
        const added = [];
        const lend = (owner, key, value) => { if (owner[key] === undefined) { owner[key] = value; added.push([owner, key]); } };
        const Base = class {};
        lend(foundry, "applications", { api: { DialogV2: Base, ApplicationV2: Base, HandlebarsApplicationMixin: c => c, DocumentSheetV2: Base }, ux: any(), handlebars: any(), sheets: any(), apps: any(), elements: any(), instances: new Map() });
        for (const k of ["appv1", "documents", "canvas", "helpers", "dice", "data"]) lend(foundry, k, any());
        for (const k of ["CONST", "Actor", "Item", "ChatMessage", "Roll", "Scene", "User", "JournalEntry", "Macro", "Playlist", "Folder", "TextEditor", "Dialog",
            "Application", "FormApplication", "FilePicker", "socket", "Handlebars", "loadTemplates", "renderTemplate", "fromUuid", "fromUuidSync",
            "AudioHelper", "Token", "TokenDocument", "Combat", "CanvasAnimation"]) lend(globalThis, k, any());
        // The colours the outline reads (fog-doorways.mjs `colourOf`): Foundry's Color, as Foundry parses a CSS colour.
        foundry.utils.Color = { from: raw => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = raw; const hex = c.fillStyle; return { valueOf: () => Number.parseInt(hex.slice(1), 16) }; } };
        // The hall and its two zones, as the GM linked them (rooms.mjs `sceneRoles`, zone-geometry.mjs `zoneRegions`).
        const regions = {
            ZONEA0000000000A: { id: "ZONEA0000000000A", name: "left", shapes: [{ type: "rectangle", x: 0, y: 0, width: 1000, height: 1000 }] },
            ZONEB0000000000B: { id: "ZONEB0000000000B", name: "right", shapes: [{ type: "rectangle", x: 1000, y: 0, width: 1000, height: 1000 }] }
        };
        const hall = { id: "HALL000000000000", name: "Trial hall", grid: { size: 100 }, regions: { get: id => regions[id] ?? null } };
        game.settings.settings.set("danganronpa-rpg.sceneRoles", {});
        const had = game.settings.get;
        game.settings.get = (m, k) => (k === "sceneRoles" ? { trial: hall.id, zones: { a: "ZONEA0000000000A", b: "ZONEB0000000000B" } }
            : k === "theme" ? (glass ? "stainedGlass" : "monokumaLegacy") : had(m, k));
        game.scenes = { get: id => (id === hall.id ? hall : null) };
        globalThis.Hooks ??= { on() {}, off() {}, once() {}, callAll() {} };
        // A stand-in board: the hall's floor and grid at a zoom of 0.55, in a PIXI canvas at the middle of the screen.
        const zoom = Math.min(0.55, (innerWidth - 64) / 2000, (innerHeight * 0.55) / 1000);
        const app = new PIXI.Application({ width: 2000 * zoom, height: 1000 * zoom, backgroundAlpha: 0, antialias: true, resolution: devicePixelRatio, autoDensity: true });
        Object.assign(app.view.style, { position: "fixed", zIndex: 50, left: `${Math.round((innerWidth - 2000 * zoom) / 2)}px`,
            top: `${Math.round(innerHeight * 0.1)}px`, borderRadius: "4px", boxShadow: "0 8px 40px #000a" });
        document.body.append(app.view);
        const stage = new PIXI.Container();
        stage.scale.set(zoom);
        app.stage.addChild(stage);
        const floor = new PIXI.Graphics();
        floor.beginFill(0x2a2430).drawRect(0, 0, 2000, 1000).endFill();
        floor.lineStyle({ width: 1 / zoom, color: 0x4a4250, alpha: 0.6 });
        for (let x = 100; x < 2000; x += 100) floor.moveTo(x, 0).lineTo(x, 1000);
        for (let y = 100; y < 1000; y += 100) floor.moveTo(0, y).lineTo(2000, y);
        stage.addChild(floor);
        const ui = new PIXI.Container();
        stage.addChild(ui);
        globalThis.canvas = { scene: hall, interface: ui, stage, grid: { size: 100 }, app: { renderer: app.renderer } };
        let Z;
        const why = [];
        try { Z = await import("/scripts/trial-zones-ui.mjs"); } catch (err) { why.push(String(err)); }
        if (!Z) return { why };
        const group = await Z.drawZones({ active: true, mode: "straw", seconds: 45, startedAt: Date.now(), holderId: null,
            zone: { phase: "vote", question: words.q, answers: { a: words.a, b: words.b }, picks: {}, stands: {}, openedAt: Date.now(), step: 1 } });
        for (const [owner, key] of added.reverse()) delete owner[key];
        // The cards, as chat cards in a column on the right.
        const col = document.createElement("ol");
        col.id = "chat-log";
        col.className = "chat-log";
        const board = app.view.getBoundingClientRect();
        col.style.cssText = `position:fixed;z-index:60;left:${board.left}px;top:${board.bottom + 16}px;width:${board.width}px;list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start`;
        col.innerHTML = cards;
        document.body.append(col);
        await new Promise(r => setTimeout(r, 800));
        const labels = ["a", "b"].map(s => group?.getChildByName?.(`drpgZoneOutlines-${s}-piece`)?.getChildByName?.(`drpgZoneOutlines-${s}-label`));
        const view = app.view.getBoundingClientRect(), list = col.getBoundingClientRect();
        return { why, labels: labels.map(l => l ? { text: l.text, size: l.style.fontSize, font: l.style.fontFamily, w: Math.round(l.width), h: Math.round(l.height) } : null),
            inside: view.left >= 0 && view.right <= innerWidth && view.bottom <= list.top && list.bottom <= innerHeight, cards: col.children.length };
    }, { cards, words: ANSWERS[lang], glass: theme === "stained" });
    const file = `${here}05-zones-${lang}-${theme}-${size}.png`;
    await page.screenshot({ path: file });
    await page.close();
    const fine = read.labels?.every(Boolean) && read.inside && read.cards >= 2;
    if (!fine) bad++;
    console.log(`zones ${lang} ${theme} ${size}: ${JSON.stringify(read)}${fine ? "" : "  - FAIL"} -> ${file.slice(here.length)}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
