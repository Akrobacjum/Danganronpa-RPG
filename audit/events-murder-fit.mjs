/**
 * Danganronpa RPG - does the Event panel ever scroll during a murder? (owner-115 item 3, 14.11.2026)
 * ---------------------------------------------------------------------------
 * The owner, at a real table on 1.2.114: "Na karcie eventu pojawil sie scroll w trakcie morderstwa. Na karcie eventu
 * nigdy nie powinno byc scrolla." Which browser, theme, size and cards were up is not known, so this draws the panels a
 * murder can put up, on every seat that sees one, and fails on any scroll.
 *
 * WHAT THIS CHECKS. On audit/glass-harness.html, both themes, English and Polish, at 1280x720, 1366x768 and 1920x1080:
 * each panel below, drawn by events.mjs `cardElement` under the Despair rail where `renderEvents` puts it (and, where the
 * module's `fitEvents` exists, fitted by it as `renderEvents` fits it). A size fails when
 *   - the panel scrolls (its scrollHeight past its clientHeight), or a card does (its own), or any of them is styled to
 *     scroll (`overflow-y` auto or scroll) - a bar shown or not;
 *   - a card cuts its own text (a line wider than its box);
 *   - the panel's box reaches another block of the screen below its top - a corner launcher, the HUD, the room tile, the
 *     voice tile, the notices (events.mjs `EVENTS_BELOW`) - or runs past the screen's bottom. One beside its top (Legacy's
 *     HUD at 1280x720) is printed as a note: growing does not reach it.
 * The panels (the texts the language files hold, the longest of a key's forms, with long sample names):
 *   victim    the fight's card as its victim reads it, the Despair Overflow's, a motive with its price
 *   killer    the fight's card as the killer reads it (waiting for a name), the Overflow, a motive, a Monocub's card
 *   gm        the fight's card as a GM reads it (the tracker's line), a body, the Overflow, an assembly, a motive
 *   opening   the opening's card (a GM's pair), the Overflow, a motive
 *   safeword  a safeword, the fight's card, the Overflow, a motive
 * Each panel's height, the room under it and what it held are printed, so a run before a fix and one after compare.
 * Exits 1 on any failure.
 *
 * What it is not: the cards are built here from the language files, as the module builds them from the world; a trial's
 * card is not drawn (no trial runs in a murder). Not in CI: Chromium's layout is not the harness's. Run it with a static
 * server on the repo's root at :8765 (`python3 -m http.server 8765`), Playwright from audit/harness (`npm ci`):
 *   node audit/events-murder-fit.mjs [--base http://127.0.0.1:8765] [--chromium <executable>] [--shots <dir>]
 * `--shots` writes the murder-time panel at 1366x768 in both themes (the gm and the victim panels) as PNGs.
 */
/* global document, window, foundry, game, getComputedStyle */ // the page.evaluate body runs in the browser, on the glass harness
import { createRequire } from "module";
import { mkdirSync } from "fs";

const require = createRequire(new URL("./harness/package.json", import.meta.url));
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const base = opt("--base") ?? "http://127.0.0.1:8765";
const exe = opt("--chromium") ?? process.env.DRPG_CHROMIUM ?? undefined;
const shots = opt("--shots");
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--no-sandbox"] });
const SIZES = [[1280, 720], [1366, 768], [1920, 1080]];
const PANELS = ["victim", "killer", "gm", "opening", "safeword"];
let failed = 0;
for (const [w, h] of SIZES) for (const theme of ["glass", "legacy"]) for (const lang of ["en", "pl"]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: shots && w === 1366 ? 2 : 1 });
    await page.goto(`${base}/audit/glass-harness.html?w=${w}&h=${h}${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForTimeout(2500);
    for (const name of PANELS) {
        const keep = Boolean(shots && w === 1366 && lang === "en" && (name === "gm" || name === "victim"));
        const r = await page.evaluate(async ({ lang, name, keep }) => {
            const lent = [];
            const lend = (owner, key, value) => { if (owner[key] === undefined) { owner[key] = value; lent.push([owner, key]); } };
            const any = () => new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : any()), construct: () => ({}), apply: () => undefined });
            for (const k of ["CONST", "Actor", "Item", "ChatMessage", "Roll", "Scene", "User", "JournalEntry", "Macro", "Playlist", "Folder", "TextEditor", "Dialog",
                "Application", "FormApplication", "FilePicker", "canvas", "socket", "Handlebars", "loadTemplates", "renderTemplate", "fromUuid", "fromUuidSync",
                "AudioHelper", "Token", "TokenDocument", "Combat"]) lend(globalThis, k, any());
            const Base = class {};
            lend(foundry, "applications", { api: { DialogV2: Base, ApplicationV2: Base, HandlebarsApplicationMixin: c => c, DocumentSheetV2: Base }, ux: any(), handlebars: any(), sheets: any(), apps: any(), elements: any(), instances: new Map() });
            for (const k of ["appv1", "documents", "canvas", "helpers", "dice", "data"]) lend(foundry, k, any());
            let EV = null, err = null;
            try { EV = await import("/scripts/events.mjs"); } catch (e) { err = String(e); }
            for (const [owner, key] of lent.reverse()) delete owner[key];
            if (!EV) return { err };
            const t = await (await fetch(`/lang/${lang}.json`)).json();
            const get = k => k.split(".").reduce((o, x) => o?.[x], t);
            // A plural family's longest form; a plain key as it is.
            const L = k => { const v = get(k); return typeof v === "string" ? v : v && typeof v === "object" ? Object.values(v).filter(s => typeof s === "string").sort((a, b) => b.length - a.length)[0] ?? k : k; };
            const F = (k, data = {}) => String(L(k)).replace(/\{(\w+)\}/g, (m, x) => (x in data ? data[x] : m));
            const longestOf = prefix => { const o = get(prefix) ?? {}; return Object.keys(o).map(k => `${prefix}.${k}`).map(L).sort((a, b) => b.length - a.length)[0] ?? prefix; };
            const N = { killer: "Kirumi Tojo-Hoshino", victim: "Byakuya Togami-Fukawa", room: "Ultimate Pharmacist's Laboratory", cub: "Botan Hayashi" };
            const res = { hp: 10, hpMax: 10, sanity: 10, sanityMax: 10, name: N.victim };
            const incident = meta => ({ kind: "incident", mine: true, title: L("DRPG.Events.incidentTitleDirect"), sub: F("DRPG.Events.incidentSubRoom", N), meta });
            const overflow = { kind: "overflow", due: true, title: L("DRPG.Overflow.caption"), sub: longestOf("DRPG.Overflow.name"), meta: longestOf("DRPG.Overflow.what").replace(/\{n\}/g, "2") };
            const overflowGm = { ...overflow, meta: F("DRPG.Events.overflowMetaGm", { count: 20, max: 20 }) };
            const motive = { kind: "motive", title: L("DRPG.Motive.title"), sub: "Whoever leaves the academy first takes the secret of the Seventh Floor with them, and the rest learn what it cost",
                meta: F("DRPG.Motive.left", { n: 2 }), note: F("DRPG.Motive.orElse", { what: "the school shuts the cafeteria for a day" }) };
            const cubs = [{ kind: "redeemHope", title: L("DRPG.Events.redeemTitle"), sub: N.cub, meta: L("DRPG.Events.redeemMeta"), line: F("DRPG.Events.redeemLine", {}) },
                { kind: "bribeHope", title: L("DRPG.Events.bribeWaitTitle"), sub: N.cub, meta: F("DRPG.Events.bribeWaitMeta", { name: N.victim }), line: F("DRPG.Events.bribeWaitLine", { name: N.victim }) },
                { kind: "betHope", title: L("DRPG.Events.betTitle"), sub: N.cub, meta: F("DRPG.Events.betMeta", { name: N.killer }), line: F("DRPG.Events.betLine", { name: N.killer }) }];
            const cub = typeof EV.cubCardOf === "function" ? [EV.cubCardOf(cubs)] : cubs;
            const body = { kind: "body", due: true, title: L("DRPG.Events.bodyTitle"), sub: F("DRPG.Events.bodySubRoom", { victim: N.victim, room: N.room }),
                meta: F("DRPG.Events.bodyMetaGm", { found: 2, total: 5 }) };
            const assembly = { kind: "assembly", title: L("DRPG.Calls.gatherShort"), sub: N.room, meta: F("DRPG.Calls.gatherBody", { room: N.room }) };
            const safeword = { kind: "safeword", due: true, title: L("DRPG.Events.safewordTitle"), sub: L("DRPG.Events.safewordSub"), meta: L("DRPG.Events.safewordMetaGm") };
            const opening = { kind: "incident", mine: false, title: L("DRPG.Events.openingTitle"), sub: F("DRPG.Events.incidentSubRoom", N), meta: L("DRPG.Events.openingMeta") };
            const gmTurn = F("DRPG.Murder.trackerState", { stage: L("DRPG.Murder.stage.incident"), turn: 3, side: L("DRPG.Murder.side.victim") });
            const SETS = {
                victim: [incident([L("DRPG.Murder.yourTurn"), F("DRPG.Events.reserveYou", res)]), overflow, motive],
                killer: [incident([F("DRPG.Events.waitingFor", { name: N.victim }), F("DRPG.Events.reserveOf", res)]), overflow, motive, ...cub],
                gm: [incident([gmTurn, F("DRPG.Events.reserveVictim", res)]), body, overflowGm, assembly, motive],
                opening: [opening, overflowGm, motive],
                safeword: [safeword, incident([gmTurn, F("DRPG.Events.reserveVictim", res)]), overflowGm, motive]
            };
            const cards = SETS[name];
            const i18n = game.i18n;
            game.i18n = { ...i18n, localize: L, format: F };
            const panel = document.createElement("div");
            panel.id = "drpg-events"; panel.className = "drpg-events"; panel.setAttribute("role", "status");
            try { for (const card of cards) panel.append(EV.cardElement(card)); } finally { game.i18n = i18n; }
            document.getElementById("drpg-events")?.remove();
            document.getElementById("drpg-despair").after(panel);
            await document.fonts?.ready;
            window.__glass?.refreshGlass?.();
            await new Promise(res => setTimeout(res, 500));
            const fitted = typeof EV.fitEvents === "function";
            if (fitted) { game.i18n = { ...i18n, localize: L, format: F }; try { EV.fitEvents(panel); } finally { game.i18n = i18n; } }
            window.__glass?.refreshGlass?.();
            await new Promise(res => setTimeout(res, 500));
            const box = panel.getBoundingClientRect();
            const scrolls = el => el.scrollHeight > el.clientHeight + 1;
            const styled = el => /auto|scroll/.test(getComputedStyle(el).overflowY);
            const why = [];
            if (scrolls(panel)) why.push(`panel ${panel.scrollHeight}/${panel.clientHeight}`);
            if (styled(panel)) why.push(`panel overflow-y ${getComputedStyle(panel).overflowY}`);
            for (const c of panel.children) {
                if (scrolls(c) && getComputedStyle(c).overflowY !== "visible") why.push(`${c.dataset.kind} clips ${c.scrollHeight}/${c.clientHeight}`);
                if (styled(c)) why.push(`${c.dataset.kind} overflow-y ${getComputedStyle(c).overflowY}`);
                for (const el of c.querySelectorAll("*")) if (el.getClientRects().length && styled(el) && scrolls(el)) why.push(`${c.dataset.kind} ${el.className} scrolls`);
                for (const el of c.querySelectorAll(".drpg-event-title, .drpg-event-sub, .drpg-event-meta, .drpg-event-meta-line, .drpg-event-note"))
                    if (el.getClientRects().length && el.scrollWidth > el.clientWidth + 1) why.push(`${c.dataset.kind} ${el.className.split(" ")[0]} ${el.scrollWidth}/${el.clientWidth} wide`);
            }
            const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
            // The module's own list where it has one (events.mjs `EVENTS_BELOW`), else the corner launchers, the HUD and the room tile.
            const obstacles = [...document.querySelectorAll(EV.EVENTS_BELOW ?? "#drpg-messenger-launcher, #drpg-sound-launcher, #drpg-book-launcher, [data-drpg-cluster], #drpg-hud, #drpg-room-tile")]
                .filter(e => e.getClientRects().length && !panel.contains(e)).map(e => [e.id || e.dataset.drpgCluster || e.className, e.getBoundingClientRect()]);
            // What the panel grows into is below its top; something that already stands beside its top (Legacy's HUD at
            // 1280x720 reaches past the rail's left edge) is said, not failed: growing taller does not reach it.
            const notes = [];
            // A block reaching under the panel's edge by 24 px or less (events.mjs `ROOM_SLIVER`: Legacy's left column at
            // 1280x720, 12 px, there at the old cap too) is printed as a note as well.
            for (const [id, r] of obstacles) {
                if (!meets(box, r)) continue;
                const across = Math.round(Math.min(r.right, box.right) - Math.max(r.left, box.left));
                if (r.top < box.top) notes.push(`beside its top: ${id}`);
                else if (across <= 24) notes.push(`${across} px under its edge: ${id}`);
                else why.push(`covers ${id}`);
            }
            if (box.bottom > window.innerHeight + 1) why.push(`runs ${Math.round(box.bottom - window.innerHeight)} px past the screen`);
            const below = obstacles.map(([, r]) => r).filter(r => r.top >= box.top && r.left < box.right && box.left < r.right).map(r => r.top);
            const room = typeof EV.eventsRoom === "function" ? Math.round(EV.eventsRoom(panel)) : Math.round(Math.min(window.innerHeight, ...below) - box.top);
            const folded = [...panel.children].filter(c => c.hasAttribute("data-drpg-folded")).map(c => c.dataset.kind);
            if (!keep) { panel.remove(); window.__glass?.refreshGlass?.(); }
            return { box: [box.left, box.top, box.width, box.height], why, notes, h: Math.round(box.height), room, cards: cards.length, folded, fitted };
        }, { lang, name, keep });
        if (keep && !r.err) {
            // The panel, left standing for its picture, with the rail over it; then taken away.
            const [x, y, bw, bh] = r.box;
            const clip = { x: Math.max(0, x - 40), y: 0, width: Math.min(w - Math.max(0, x - 40), bw + 80), height: Math.min(h, y + bh + 24) };
            // The glass harness's own sample windows (`.application`, laid in the page with no z-index of their own) are
            // hidden for the picture, so the panel is seen alone: at a table a window stands at Foundry's window layer,
            // over the interface the panel is in (the item's STATUS says what of that is measured).
            await page.evaluate(() => document.querySelectorAll(".application").forEach(e => { e.dataset.shotHidden = e.style.visibility; e.style.visibility = "hidden"; }));
            await page.screenshot({ path: `${shots}/event-panel-${name}-${theme}-1366x768-clean.png`, clip });
            await page.evaluate(() => document.querySelectorAll(".application").forEach(e => { e.style.visibility = e.dataset.shotHidden ?? ""; delete e.dataset.shotHidden; }));
            await page.evaluate(() => { document.getElementById("drpg-events")?.remove(); window.__glass?.refreshGlass?.(); });
        }
        const bad = r.err || r.why.length;
        if (bad) failed++;
        console.log(`${bad ? "FAIL" : "ok  "} ${w}x${h} ${theme} ${lang} ${name}: ${r.err ?? `${r.cards} card(s), panel ${r.h} px, room ${r.room} px, folded [${r.folded.join(", ")}]${r.fitted ? "" : ", no fitEvents"}${r.why.length ? ` - ${r.why.join("; ")}` : ""}${r.notes.length ? ` (${r.notes.join("; ")})` : ""}`}`);
    }
    await page.close();
}
await browser.close();
console.log(`events-murder-fit: ${failed ? `${failed} panel(s) failed` : "no murder-time panel scrolls, cuts a card or covers a launcher, at any size"}`);
process.exit(failed ? 1 : 0);
