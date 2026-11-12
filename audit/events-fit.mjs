/**
 * Danganronpa RPG - does the Event panel show a Monocub's own card whole? (E72 C19 fix, 12.11.2026)
 * ---------------------------------------------------------------------------
 * The owner, relayed by the coordinator: the Monocub's Event cards (a Bribe waits, its Ghost Bet) were cut off at the
 * bottom. Measured in Chromium on the glass harness at 1366x768 (12.11.2026): each card held its own text, but the
 * panel's box is capped (`--drpg-events-h`: 192 px under Monokuma Legacy, 268.6 px under Stained Glass there) and one
 * Legacy card is 101 px tall, so two cards already overflowed it and the third card's lines sat below the fold. Since
 * the fix a Monocub's states are one card (events.mjs `cubCard`, built by `cubCardOf`).
 *
 * WHAT THIS CHECKS. On audit/glass-harness.html, both themes, English and Polish, at 1366x768, 1280x720 and 1920x1080:
 * the panel holding what a Monocub's player is shown with all three states at once (Redeem waits, a Bribe waits, its
 * Ghost Bet stands) - the one card `cubCardOf` builds, or, on a tree before it, the three cards it replaced - is drawn
 * by events.mjs `cardElement` under the Despair rail, and fails a size when the panel scrolls (scrollHeight past
 * clientHeight), a card's box ends below the panel's, or a card cuts its own lines (its scrollHeight past its clientHeight).
 * Exits 1 on any failure.
 *
 * What it is not: the card's content is built here from the language files with sample names, as the module builds it
 * from the owner's copy; the panel's other cards (a trial, a body) are not drawn - with them the panel scrolls, as it
 * is meant to (E23 C3b). Not in CI: Chromium's layout is not the harness's. Run it with a static server on the repo's
 * root at :8765 (`python3 -m http.server 8765`), Playwright from audit/harness (`npm ci`):
 *   node audit/events-fit.mjs [--base http://127.0.0.1:8765] [--chromium <executable>]
 */
/* global document, window, foundry, game */ // the page.evaluate body runs in the browser, on the glass harness
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
for (const [w, h] of SIZES) for (const theme of ["glass", "legacy"]) for (const lang of ["en", "pl"]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/audit/glass-harness.html?w=${w}&h=${h}${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForTimeout(2500);
    const r = await page.evaluate(async lang => {
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
        const L = k => k.split(".").reduce((o, x) => o?.[x], t) ?? k;
        const F = (k, data) => String(L(k)).replace(/\{(\w+)\}/g, (m, x) => (x in data ? data[x] : m));
        const i18n = game.i18n;
        game.i18n = { ...i18n, localize: L, format: F };
        const cub = "Botan Hayashi", payer = "Aiko Tanaka", bet = "Chie Mori";
        let cards;
        try {
            // The three states as the module's builders answer them; then the card(s) the panel draws for them.
            const redeem = { kind: "redeemHope", title: L("DRPG.Events.redeemTitle"), sub: cub, meta: L("DRPG.Events.redeemMeta"), line: F("DRPG.Events.redeemLine", {}) };
            const bribe = { kind: "bribeHope", title: L("DRPG.Events.bribeWaitTitle"), sub: cub, meta: F("DRPG.Events.bribeWaitMeta", { name: payer }), line: F("DRPG.Events.bribeWaitLine", { name: payer }) };
            const ghost = { kind: "betHope", title: L("DRPG.Events.betTitle"), sub: cub, meta: F("DRPG.Events.betMeta", { name: bet }), line: F("DRPG.Events.betLine", { name: bet }) };
            cards = typeof EV.cubCardOf === "function" ? [EV.cubCardOf([redeem, bribe, ghost])] : [redeem, bribe, ghost];
        } finally { game.i18n = { ...i18n, localize: L, format: F }; }
        const panel = document.createElement("div");
        panel.id = "drpg-events"; panel.className = "drpg-events"; panel.setAttribute("role", "status");
        try { for (const card of cards) panel.append(EV.cardElement(card)); } finally { game.i18n = i18n; }
        document.getElementById("drpg-events")?.remove();
        document.getElementById("drpg-despair").after(panel);
        // Measured once the fonts are in: a line's height is the font's. A guard, its cause not proven: one run of the
        // twelve sizes reported a failure on a loaded machine (12.11.2026, its line not kept), seven runs around it held.
        await document.fonts?.ready;
        window.__glass?.refreshGlass?.();
        await new Promise(res => setTimeout(res, 600));
        const box = panel.getBoundingClientRect();
        return { cards: cards.length, sh: panel.scrollHeight, ch: panel.clientHeight,
            below: [...panel.children].map(c => Math.round(c.getBoundingClientRect().bottom - box.bottom)).filter(d => d > 1),
            clipped: [...panel.children].filter(c => c.scrollHeight > c.clientHeight + 1).map(c => `${c.dataset.kind} ${c.scrollHeight}/${c.clientHeight}`) };
    }, lang);
    const bad = r.err || r.sh > r.ch + 1 || r.below.length || r.clipped.length;
    if (bad) failed++;
    console.log(`${bad ? "FAIL" : "ok  "} ${w}x${h} ${theme} ${lang}: ${r.err ?? `${r.cards} card(s), panel ${r.sh} of ${r.ch} px, cut below ${JSON.stringify(r.below)}, cards cut ${JSON.stringify(r.clipped)}`}`);
    await page.close();
}
await browser.close();
console.log(`events-fit: ${failed ? `${failed} size(s) failed` : "every size holds the Monocub's card whole"}`);
process.exit(failed ? 1 : 0);
