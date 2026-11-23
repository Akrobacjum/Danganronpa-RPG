/**
 * The owner's screenshots for E129 S0-ZONESTYLE (23.11.2026; redone the same day after the owner's "Nie chodzilo mi o
 * dodanie okna z tekstem pod strefami, tylko zmiane na panelu eventu (kafel pod despair pools)"): a zone mode's two zones
 * on the trial hall, each named at its middle by its answer, and the HUD's event tile under the Despair pools in four
 * states - a Straw Poll's vote, a Scrum Debate's turn, and the camps' Confer as a player and as a GM reads it - in English
 * and in Polish. Chromium, 1920x1080 and 1366x768, Stained Glass and Monokuma Legacy, the glass harness under the
 * module's stylesheets. Run from the repository's root with a static server on it:
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
 *   other, on a plain dark floor with grid lines - not a hall's picture - at a zoom of 0.55 (less where the screen is
 *   smaller), where Foundry's board stands: at z-index 0, under the curtain and the whole interface, so the HUD, the clock
 *   and the projects stand over it as they do over the map. Foundry's own canvas (its layers, its lighting) is not here.
 * - The event tile is the module's own: each state's card as events.mjs `trialFloorCard` built it on the headless
 *   harness - on p1, whose student is in the first camp, and on the GM for the GM's Confer line - in English and again
 *   with both clients given lang/pl.json (zones-tile.json beside this file), drawn here by events.mjs `cardElement` into
 *   `#drpg-events` right after `#drpg-despair`, where `renderEvents` puts it, with the words of lang/<lang>.json. The
 *   clock reads a fixed 0:42.
 * Writes 05-zones-<state>-<lang>-<theme>-<size>.png beside this file, <state> vote, speak, confer-player or confer-gm,
 * and fails a shot whose tile holds a raw key, a line wider than the tile, or a tile outside the screen.
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
const TILES = JSON.parse(fs.readFileSync(`${here}zones-tile.json`, "utf8"));
const STATES = [["vote", "vote", "straw", true], ["speak", "speak", "scrum", true], ["confer-player", "conferPlayer", "scrum", true], ["confer-gm", "conferGm", "scrum", false]];
const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
let bad = 0;
for (const [state, tileKey, mode, player] of STATES) for (const lang of ["en", "pl"]) for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) {
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
    await page.route("**/pixi.min.js", route => route.fulfill({ path: pixi, contentType: "text/javascript" }));
    await page.goto(`${base}?${player ? "role=player&" : ""}${theme === "legacy" ? "theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass, null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.addScriptTag({ url: "/pixi.min.js" });
    const read = await page.evaluate(async ({ words, glass, card, lang, mode }) => {
        for (const other of document.querySelectorAll(".application")) other.style.display = "none";
        // The Foundry names the module's files read at load, lent for the imports alone (the page's `drpgVoiceList`).
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
        // The stand-in board where Foundry's board stands: z-index 0, under the curtain and the interface.
        const zoom = Math.min(0.55, (innerWidth - 64) / 2000, (innerHeight * 0.6) / 1000);
        const app = new PIXI.Application({ width: 2000 * zoom, height: 1000 * zoom, backgroundAlpha: 0, antialias: true, resolution: devicePixelRatio, autoDensity: true });
        Object.assign(app.view.style, { position: "fixed", zIndex: 0, left: `${Math.round((innerWidth - 2000 * zoom) / 2)}px`, top: `${Math.round((innerHeight - 1000 * zoom) / 2)}px` });
        (document.getElementById("board") ?? document.body.lastChild).after(app.view);
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
        const why = [];
        let Z = null, EV = null;
        try { Z = await import("/scripts/trial-zones-ui.mjs"); EV = await import("/scripts/events.mjs"); } catch (err) { why.push(String(err)); }
        if (!Z || !EV) { for (const [owner, key] of added.reverse()) delete owner[key]; return { why }; }
        const group = await Z.drawZones({ active: true, mode, seconds: 45, startedAt: Date.now(), holderId: null,
            zone: { phase: "vote", question: words.q, answers: { a: words.a, b: words.b }, picks: {}, stands: {}, openedAt: Date.now(), step: 1 } });
        // The event tile: `cardElement` with the language's own words, after #drpg-despair as `renderEvents` puts it.
        const dict = await fetch(`/lang/${lang}.json`).then(r => r.json());
        const flat = key => key.split(".").reduce((o, p) => o?.[p], dict) ?? key.split(".").slice(1).reduce((o, p, i, a) => o?.[a.slice(i).join(".")] ?? o?.[p], dict);
        const i18n = game.i18n;
        game.i18n = { ...i18n, lang, localize: k => (typeof flat(k) === "string" ? flat(k) : k),
            format: (k, d = {}) => String(typeof flat(k) === "string" ? flat(k) : k).replace(/\{(\w+)\}/g, (m, n) => (n in d ? String(d[n]) : m)), has: k => typeof flat(k) === "string" };
        const panel = document.createElement("div");
        panel.id = "drpg-events";
        panel.className = "drpg-events";
        panel.setAttribute("role", "status");
        try { panel.append(EV.cardElement(card)); } catch (err) { why.push(`cardElement: ${err}`); } finally { game.i18n = i18n; }
        for (const [owner, key] of added.reverse()) delete owner[key];
        for (const c of panel.querySelectorAll(".drpg-event-clock")) c.textContent = "0:42";
        document.getElementById("drpg-despair").after(panel);
        window.__glass?.refreshGlass?.();
        await new Promise(r => setTimeout(r, 900));
        for (const c of panel.querySelectorAll(".drpg-event-clock")) c.textContent = "0:42";
        const labels = ["a", "b"].map(s => group?.getChildByName?.(`drpgZoneOutlines-${s}-piece`)?.getChildByName?.(`drpgZoneOutlines-${s}-label`)?.text ?? null);
        const box = panel.getBoundingClientRect();
        const texts = [...panel.querySelectorAll(".drpg-event-title, .drpg-event-sub, .drpg-event-meta, .drpg-event-meta-line, .drpg-event-note")];
        return { why, labels, tile: texts.map(e => e.textContent),
            rawKeys: texts.filter(e => /DRPG\.|\{\w+\}/.test(e.textContent)).map(e => e.textContent),
            clipped: texts.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent),
            inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && box.height > 0 };
    }, { words: ANSWERS[lang], glass: theme === "stained", card: TILES[lang][tileKey], lang, mode });
    const file = `${here}05-zones-${state}-${lang}-${theme}-${size}.png`;
    await page.screenshot({ path: file });
    await page.close();
    const fine = !read.why?.length && read.labels?.every(Boolean) && !read.rawKeys?.length && !read.clipped?.length && read.inside;
    if (!fine) bad++;
    console.log(`${state} ${lang} ${theme} ${size}: ${JSON.stringify({ tile: read.tile, rawKeys: read.rawKeys, clipped: read.clipped, inside: read.inside, why: read.why })}${fine ? "" : "  - FAIL"}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
