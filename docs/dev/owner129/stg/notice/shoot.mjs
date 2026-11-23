/**
 * The owner's screenshots of a hide's end told in the hider's corner of notices (S0-HIDE, 1.2.128, 23.11.2026; the
 * owner: "notice o ujawnieniu niech bedzie w lewym dolnym rogu jak reszta powiadomien").
 *
 *     node docs/dev/owner129/stg/notice/shoot.mjs        (from the repository's root; Playwright from audit/harness)
 *
 * Serves the repository (python3 -m http.server) and opens audit/glass-harness.html as a player's screen (`?role=player`,
 * `?theme=legacy` for Monokuma Legacy) at 1920x1080 and 1366x768, deviceScaleFactor 2 - the page glass-sweep.mjs's
 * notice check (`drpgNoticeCheck`) draws the module's corner cards on. On each it first runs that check with no card up,
 * then sets the page's `game.i18n` to lang/<en|pl>.json, takes the words from hide.mjs `hideEndNotice` itself (the hider's
 * browser: owns, not a GM; the time of day noon, named from the same file) and posts them with popup.mjs `showPopup`
 * exactly as hide.mjs `tellHideEnd` does (`<p>words</p>`, kind "info"), with `record: false` so this browser's notice
 * history is not written. Writes notice-<en|pl>-<glass|legacy>-<w>x<h>.png beside this file and prints one line a shot.
 * Chromium is /opt/pw-browsers/chromium unless DRPG_CHROMIUM names another executable.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const require = createRequire(path.join(ROOT, "audit/harness/package.json"));
const { chromium } = require("playwright");

const PORT = 8773;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ executablePath: process.env.DRPG_CHROMIUM ?? "/opt/pw-browsers/chromium" });
let bad = 0;
try {
    for (const lang of ["en", "pl"]) for (const theme of ["glass", "legacy"]) for (const [width, height] of [[1920, 1080], [1366, 768]]) {
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
        const errors = [];
        page.on("pageerror", e => errors.push(String(e?.message ?? e)));
        await page.goto(`http://127.0.0.1:${PORT}/audit/glass-harness.html?role=player&still=1${theme === "legacy" ? "&theme=legacy" : ""}`);
        await page.waitForFunction(() => window.__glass && window.drpgNoticeCheck, null, { timeout: 15000 });
        await page.waitForTimeout(1500);
        const r = await page.evaluate(async lang => {
            const check = await window.drpgNoticeCheck();
            const file = await fetch(`/lang/${lang}.json`).then(res => res.json());
            const read = key => key.split(".").reduce((o, k) => o?.[k], file);
            const i18n = game.i18n;
            game.i18n = { ...i18n, lang, localize: k => read(k) ?? k,
                format: (k, data = {}) => String(read(k) ?? k).replace(/\{(\w+)\}/g, (m, n) => data[n] ?? m) };
            const H = await import("/scripts/hide.mjs");
            const time = read("DRPG.Config.TIME_OF_DAY_LABELS.noon") ?? null;
            /* hideEndNotice names the time from config.mjs TIME_OF_DAY_LABELS, which config.mjs put in the page's
               language at load (English here): the Polish name is set on the same object, as a Polish page has it. */
            const C = await import("/scripts/config.mjs");
            const kept = C.TIME_OF_DAY_LABELS.noon;
            C.TIME_OF_DAY_LABELS.noon = time ?? kept;   // en.json names none: config.mjs's English stays
            const words = H.hideEndNotice({ flags: { [C.MODULE_ID]: { [H.HIDE_END_FLAG]: { why: "timeOfDay", time: "noon", at: 1 } } } }, { owns: true, gm: false });
            C.TIME_OF_DAY_LABELS.noon = kept;
            const P = await import("/scripts/popup.mjs");
            const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
            P.showPopup(`<p>${esc(words)}</p>`, { kind: "info", record: false, sticky: true });
            await new Promise(res => setTimeout(res, 900));
            const card = document.querySelector("#drpg-popups .drpg-popup:not(.leaving)");
            const box = card?.getBoundingClientRect();
            const tile = card?.parentElement?.id ?? null;
            return { ok: check.ok, tile, why: check.why, words, title: card?.querySelector(".drpg-popup-title")?.textContent?.trim() ?? null,
                box: box ? [box.left, box.top, box.right, box.bottom].map(Math.round) : null, w: innerWidth, h: innerHeight };
        }, lang);
        const file = `notice-${lang}-${theme}-${width}x${height}.png`;
        await page.screenshot({ path: path.join(HERE, file) });
        /* Where: on the tile every notice stands on (`#drpg-popups`). Under Stained Glass that is the curtain's
           bottom-left pane; under Monokuma Legacy on a desk the whole tile stands under the clock, every card on it
           (danganronpa.css, E81 C10: "the button stands alone under the clock") - so only Stained Glass is held to the corner. */
        const corner = r.box && r.box[0] < r.w / 2 && r.box[3] > r.h / 2;
        const placed = r.tile === "drpg-popups" && (theme === "legacy" || corner);
        if (!r.ok || !placed || errors.length || !r.words) bad++;
        console.log(`${file}: noticeCheck ${r.ok ? "ok" : `FAIL ${r.why.join("; ")}`} | title "${r.title}" | tile #${r.tile} card ${r.box?.join(",")} ${corner ? "bottom-left" : "under the clock"}${placed ? "" : " NOT WHERE EXPECTED"} | ${r.words}${errors.length ? ` | page errors: ${errors.join(" / ")}` : ""}`);
        await page.close();
    }
} finally {
    await browser.close();
    server.kill();
}
console.log(`shoot: ${bad ? `${bad} shot(s) not right` : "8 shots"}`);
process.exitCode = bad ? 1 : 0;
