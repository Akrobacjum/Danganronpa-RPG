/**
 * The owner's screenshots for OWNER-127-CENTRE (1.2.127 line UI, 22.11.2026): three action results that did not take the
 * middle on v1.2.126 - a room action (Facilities, the owner's example), a Rest and Observe's verdict (a Truth Bullet
 * copied) - centred on a player's screen. Chromium, 1920x1080 and 1366x768, Stained Glass and
 * Monokuma Legacy, the glass harness as a player. Run from the repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &   node docs/dev/owner127/shots.mjs [--chromium <executable>] [--dsf 2]
 *
 * deviceScaleFactor 1 by default (the coordinator, 22.11.2026: the dsf 2 set weighed 25 MB, too much for docs/dev).
 * DRPG_FONTAWESOME, the folder of an unpacked @fortawesome/fontawesome-free package (`npm pack` it and untar), serves
 * the icon font Foundry gives a real page at /vendor-fa/ and links its all.min.css: the glass harness loads none, so
 * without it Monokuma Legacy's close "X" (popup.mjs's `fa-solid fa-xmark`) is a button with no glyph - there, but not
 * seen. Each shot reads the close control off the DOM: its size, whether it is visible, and the glyph's font.
 *
 * WHAT IS REAL AND WHAT IS NOT. The card is drawn by the module's own popup.mjs `showPopup` with `centre`, as the
 * catch-all draws a card whose `popupCentre` notice-centre.mjs honours, under the module's stylesheets. The harness has
 * no chat documents, so nothing is posted: each card's words are composed here as its poster composes them, from the same
 * functions where they are pure (chat-card.mjs `cardMarkup` for a room action's spec, utils.mjs `cardHead` for a Rest's
 * head) and the same lang/en.json sentences, with stand-in names and amounts - not taken from a played action.
 * Writes NN-<card>-<theme>-<size>.png beside this file.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/audit/glass-harness.html";
const exe = arg("--chromium") ?? process.env.DRPG_CHROMIUM;
const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
const out = new URL(".", import.meta.url).pathname;
const CARDS = ["facilities", "rest", "observe-bullet"];
const dsf = Number(arg("--dsf") ?? 1);
const fa = process.env.DRPG_FONTAWESOME;
let bad = 0;
for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) for (const [i, card] of CARDS.entries()) {
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
    if (fa) await page.route("**/vendor-fa/**", route => {
        const file = `${fa}/${new URL(route.request().url()).pathname.replace(/^\/vendor-fa\//, "")}`;
        if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
        const type = file.endsWith(".css") ? "text/css" : file.endsWith(".woff2") ? "font/woff2" : "font/ttf";
        return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
    });
    await page.goto(`${base}?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    if (fa) {
        // v14 names its icon font "Font Awesome 7 Pro" (danganronpa.css reads it so); the free package's solid face stands in
        // under that name, the same code point for the X (f00d).
        await page.addStyleTag({ url: "/vendor-fa/css/all.min.css" });
        await page.addStyleTag({ content: '@font-face { font-family: "Font Awesome 7 Pro"; font-weight: 100 900; src: url("/vendor-fa/webfonts/fa-solid-900.woff2") format("woff2"); }' });
        await page.evaluate(() => document.fonts.load('900 16px "Font Awesome 7 Pro"'));
    }
    await page.waitForFunction(() => window.__glass && document.getElementById("drpg-popups"), null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const read = await page.evaluate(async card => {
        const en = await (await fetch("/lang/en.json")).json();
        const at = key => key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), en);
        const fill = (s, d = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in d ? d[k] : m));
        const word = k => { const v = at(k); return typeof v === "string" ? v : v?.other ?? k; };
        game.i18n = { ...game.i18n, localize: k => word(k), format: (k, d) => fill(word(k), d), has: k => at(k) !== undefined };
        const P = await import("/scripts/popup.mjs");
        const U = await import("/scripts/utils.mjs");
        const { cardMarkup } = await import("/scripts/chat-card.mjs");
        const t = (k, d) => game.i18n.format(k, d), esc = s => foundry.utils.escapeHTML(String(s));
        let html, title = null;
        if (card === "facilities") {
            // facilities-gm.mjs `tellUse`: the spec's title "{action}: done.", its lines a list, under the Rest tile's glyph
            const lines = [t("DRPG.Facility.applied.hope", { name: "Daichi Sato", n: 1 }), t("DRPG.Facility.applied.freeMove", { name: "Daichi Sato", n: 1 })];
            html = cardMarkup({ glyph: "ACTIONS.rest", title: t("DRPG.Facility.usedOk", { action: "Kitchen: a hot meal" }), body: `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` });
        } else if (card === "rest") {
            // rest.mjs `takeRest`: the head (`cardHead` with the rest's kind and the room) and what it applied
            const applied = [t("DRPG.Rest.applied.health", { label: "Sleep", n: 2 }), t("DRPG.Rest.applied.hope", { label: "Breath", n: 1 })];
            html = `${U.cardHead({ action: game.i18n.localize("DRPG.Rest.short"), room: "Dorm" })}<ul>${applied.map(a => `<li>${esc(a)}</li>`).join("")}</ul>`;
        } else {
            // observe.mjs `createFind`: the heading, the bullet's name, its words, where to find it
            html = `<h3>${esc(game.i18n.localize("DRPG.TruthBullet.received"))}</h3><p><strong>Bloodied kitchen knife</strong></p>
                <p>A kitchen knife, its blade wiped but for a line of red at the hilt.</p><p><small>${esc(game.i18n.localize("DRPG.TruthBullet.whereToFind"))}</small></p>`;
        }
        P.showPopup(html, { title, centre: true, record: false });
        await new Promise(r => setTimeout(r, 900));
        const stage = document.getElementById("drpg-notice-centre");
        const front = stage?.querySelector(".drpg-popup:not(.drpg-popup-parked)");
        const b = front?.getBoundingClientRect();
        return { shown: Boolean(front), inside: b ? b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight : false, raised: stage?.classList.contains("is-raised") ?? false,
            title: front?.querySelector(".drpg-popup-title")?.firstChild?.textContent?.trim() ?? null, close: closeOf(front) };
        function closeOf(card) {
            const x = card?.querySelector(".drpg-popup-close");
            if (!x) return null;
            const r = x.getBoundingClientRect(), cs = getComputedStyle(x), icon = x.querySelector("i");
            const glyph = icon ? getComputedStyle(icon, "::before") : null;
            return { w: Math.round(r.width), h: Math.round(r.height), visible: cs.visibility === "visible" && cs.display !== "none" && Number(cs.opacity) > 0,
                font: glyph?.fontFamily ?? null, content: glyph?.content ?? null,
                faces: [...new Set([...document.fonts].filter(f => /Font Awesome/.test(f.family) && f.status === "loaded").map(f => f.family))] };
        }
    }, card);
    const file = `${out}${String(i + 1).padStart(2, "0")}-${card}-${theme}-${size}.png`;
    await page.screenshot({ path: file });
    await page.close();
    const ok = read.shown && read.inside && read.raised;
    if (!ok) bad++;
    console.log(`${card} ${theme} ${size}: ${JSON.stringify(read)}${ok ? "" : "  - FAIL"} -> ${file.slice(out.length)}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
