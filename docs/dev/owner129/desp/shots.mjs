/**
 * The owner's screenshots for S0-CARDS (E129, 1.2.128 line DESP, 23.11.2026): five result cards that now say what the roll
 * did for the player - a critical Tamper, a critical Work on Project, a Palm with its cover, an Analyze, and a price given
 * back after the dice. Chromium, 1920x1080 and 1366x768, Stained Glass and Monokuma Legacy, the glass harness as a player.
 * Run from the repository's root with a static server on it:
 *
 *     python3 -m http.server 8765 &   node docs/dev/owner129/desp/shots.mjs [--chromium <executable>] [--dsf 1] [--lang pl]
 *
 * Built on docs/dev/owner127/shots.mjs (line UI, 22.11.2026), which says what the harness lacks.
 *
 * WHAT IS REAL AND WHAT IS NOT. Each card is drawn by the module's own popup.mjs `showPopup`, centred as notice-centre.mjs
 * centres an action's result ("actionResult"), the given-back card in the corner as every refusal stays (1.2.124). The
 * harness has no chat documents, so nothing is posted: each card's words are composed here from the module's own pure
 * builders - action-report.mjs `reportHtml` (Work on Project, Palm), `rollHead` (Analyze), `rollEffectsHtml` (all five) -
 * and, for the two that are not pure (cleanup.mjs `report`, action-pipeline.mjs `giveBackAfterRoll`), the same markup and
 * lang sentences as their posters write, with stand-in names, totals and dice - not taken from a played action.
 * Writes NN-<card>-<theme>-<size>[-<lang>].png beside this file.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../audit/harness/package.json", import.meta.url));
let playwright;
try { playwright = require("playwright"); } catch { playwright = (await import("playwright")).default; }
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const base = process.env.DRPG_SHOTS_BASE ?? "http://127.0.0.1:8765/audit/glass-harness.html";
const exe = arg("--chromium") ?? process.env.DRPG_CHROMIUM;
const lang = arg("--lang") ?? "en";
const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
const out = new URL(".", import.meta.url).pathname;
const CARDS = ["tamper-critical", "work-critical", "palm-cover", "analyze", "given-back"];
// deviceScaleFactor 2 by default (the common brief); `--dsf 1` for a lighter set.
const dsf = Number(arg("--dsf") ?? 2);
let bad = 0;
for (const theme of ["stained", "legacy"]) for (const size of ["1920x1080", "1366x768"]) for (const [i, card] of CARDS.entries()) {
    const [W, H] = size.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto(`${base}?role=player${theme === "legacy" ? "&theme=legacy" : ""}`);
    await page.waitForFunction(() => window.__glass && document.getElementById("drpg-popups"), null, { timeout: 15000 });
    await page.waitForTimeout(2500);
    const read = await page.evaluate(async ({ card, lang }) => {
        const words = await (await fetch(`/lang/${lang}.json`)).json();
        const at = key => key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), words);
        const fill = (s, d = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in d ? d[k] : m));
        const word = (k, n) => {
            const v = at(k);
            if (typeof v === "string") return v;
            if (!v) return k;
            const form = new Intl.PluralRules(lang).select(Number(n ?? 1));
            return v[form] ?? v.other ?? k;
        };
        game.i18n = { ...game.i18n, lang, localize: k => word(k), format: (k, d) => fill(word(k, d?.n), d), has: k => at(k) !== undefined };
        // action-report.mjs reaches files that read Foundry's CONST at load (remnants.mjs's ownership level); the glass
        // harness defines none, so a stand-in answers 0 for each - no card here reads one.
        if (!globalThis.CONST) globalThis.CONST = new Proxy({}, { get: () => new Proxy({}, { get: () => 0 }) });
        const P = await import("/scripts/popup.mjs");
        const A = await import("/scripts/action-report.mjs");
        const { TRAITS, ACTIONS } = await import("/scripts/config.mjs");
        const t = (k, d) => game.i18n.format(k, d), esc = s => foundry.utils.escapeHTML(String(s));
        const trait = name => Object.keys(TRAITS).find(k => k === name) ?? Object.keys(TRAITS)[0];
        // A roll as `rollTrait` answers one: its total, its sides, its statistic, and the dice `dualityBar` reads off `raw`.
        const roll = ({ hope, fear, mod = 2, ...rest }) => ({ total: hope + fear + mod, trait: trait(rest.trait), ...rest,
            isCritical: hope === fear, withHope: hope > fear, withFear: fear > hope,
            raw: { hope: { total: hope }, fear: { total: fear }, total: hope + fear + mod, data: {} } });
        let html, centre = true, title = null;
        if (card === "tamper-critical") {
            // cleanup.mjs `report`: the title, the band, what was done (the critical's give-back line, `backLine`), the roll's
            // lines (`rollEffectsHtml`, E129) and the price paid (`paidLine`)
            const done = [t("DRPG.Price.refunded", { what: t("DRPG.Price.label.action", { n: 1 }) })];
            html = `<h3>${esc(game.i18n.localize("DRPG.Cleanup.title"))}</h3>
                <p><strong>${esc(game.i18n.localize("DRPG.Cleanup.band.critical"))}</strong></p>
                <ul>${done.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
                ${A.rollEffectsHtml([{ isCritical: true, withHope: true }])}`;
            title = ACTIONS.tamper?.label ?? "Tamper";
        } else if (card === "work-critical") {
            // action-project.mjs `workOnProject` -> `report`: its outcome's `text` ("DRPG.Action.progressOn", the progress
            // and the project) and `refundAction` on a critical, as it hands them over; `applied` is a GM's own write only
            const r = roll({ hope: 8, fear: 8, mod: 3, trait: "head" });
            html = A.reportHtml({ label: ACTIONS.project?.label ?? "Work on Project" }, r,
                { text: t("DRPG.Action.progressOn", { n: 3, project: "Radio repair" }), refundAction: true }, "Workshop");
            title = ACTIONS.project?.label ?? "Work on Project";
        } else if (card === "palm-cover") {
            // palm.mjs `performPalm` -> `report`: the hand with Hope, its cover with Despair riding the card (`supportRolls`)
            const hand = roll({ hope: 10, fear: 4, trait: "hand" });
            const shadow = { ...roll({ hope: 3, fear: 9, trait: "shadow" }), supporting: true };
            html = A.reportHtml({ label: ACTIONS.palm?.label ?? "Palm" }, hand,
                { text: t("DRPG.Steal.sent", { name: "Hina Aoki" }), supportRolls: [shadow] }, "Library");
            title = ACTIONS.palm?.label ?? "Palm";
        } else if (card === "analyze") {
            // action-analyze.mjs: the roll head (`rollHead`, its lines since E129) and what was sent
            const r = roll({ hope: 4, fear: 11, mod: 3, trait: "eye" });
            html = `${A.rollHead({ label: ACTIONS.analyze?.label ?? "Analyze" }, r)}<p>${esc(game.i18n.localize("DRPG.Analyze.stashSent"))}</p>`;
            title = ACTIONS.analyze?.label ?? "Analyze";
        } else {
            // action-pipeline.mjs `giveBackAfterRoll`: what came back, and what the roll still earned; in the corner
            html = `<p>${esc(t("DRPG.Result.givenBack", { what: t("DRPG.Price.label.action", { n: 1 }) }))}</p>${A.rollEffectsHtml([{ withHope: true, withFear: false }])}`;
            centre = false;
        }
        P.showPopup(html, { title, centre, record: false });
        await new Promise(r => setTimeout(r, 900));
        const stage = centre ? document.getElementById("drpg-notice-centre") : document.getElementById("drpg-popups");
        const front = stage?.querySelector(".drpg-popup:not(.drpg-popup-parked)");
        const b = front?.getBoundingClientRect();
        return { shown: Boolean(front), inside: b ? b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight : false,
            raised: centre ? (stage?.classList.contains("is-raised") ?? false) : null,
            lines: [...(front?.querySelectorAll(".drpg-roll-effects li") ?? [])].map(li => li.textContent),
            // A lang key shown raw - a key that is not in the file, as shot 02's "DRPG.Project.progressSent" was (the
            // coordinator, 23.11.2026) - fails the shot.
            rawKeys: (front?.innerText ?? "").match(/\bDRPG\.[A-Za-z][\w.]*/g) ?? [] };
    }, { card, lang });
    const file = `${out}${String(i + 1).padStart(2, "0")}-${card}-${theme}-${size}${lang === "en" ? "" : `-${lang}`}.png`;
    await page.screenshot({ path: file });
    await page.close();
    const ok = read.shown && read.inside && read.raised !== false && read.lines.length > 0 && !read.rawKeys.length && !errors.length;
    if (!ok) bad++;
    console.log(`${card} ${theme} ${size}: ${JSON.stringify(read)}${errors.length ? ` errors ${JSON.stringify(errors)}` : ""}${ok ? "" : "  - FAIL"} -> ${file.slice(out.length)}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
