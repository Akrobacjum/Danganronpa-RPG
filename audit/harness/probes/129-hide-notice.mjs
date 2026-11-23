/**
 * Probe: the card a hide's end at the time of day sends its player, kept as HTML (S0-HIDE, the owner's 23.11.2026:
 * "ukryj sie ma dzialac do konca pory dnia"; the coordinator's ask for screenshots of the end notice).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/129-hide-notice.mjs                  (from audit/harness)
 *
 * The primary hides p1's Aiko (bridge-runs-acts.mjs `handleHideStart`, a GM's packet), her row is given the mark of an
 * earlier time of day (the noon of this day), and the primary's settle ends it (hide.mjs `settleHides`), which whispers
 * her player the card - once with the GM's and p1's pages in English, once in Polish (the language file's DRPG block in
 * place of the page's, as R8462 reads both). Kept: p1's drawn chat message, its outerHTML, in
 * docs/dev/owner129/stg/notice/capture/ (`notice-en.html`, `notice-pl.html`), for notice-shots.html beside it. It checks
 * only that each card was kept with the time of day's name; the hide is ended by the probe, the cards stay in the
 * harness's world, which the next boot seeds afresh. WHAT A CAPTURE IS NOT: Foundry's own chat sidebar and its sheet.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../../docs/dev/owner129/stg/notice/capture");

export const layers = ["probe"];

export async function run({ gm, p1, check, note, settle, repoUrl, IDS }) {
    const imp = file => `await import("${repoUrl}/scripts/${file}")`;
    fs.mkdirSync(OUT, { recursive: true });
    await settle(2000);
    const lang = code => `const S = ${imp("settings.mjs")};
        globalThis.__ownI18n ??= game.i18n.translations;
        const file = await fetch("/modules/danganronpa-rpg/lang/${code}.json").then(r => r.json());
        game.i18n.translations = { ...globalThis.__ownI18n, DRPG: file.DRPG };
        S.setPageLanguage("${code}");
        /* config.mjs's labels are put in the page's language once, at i18nInit (i18n-config.mjs); swapped here after it, so
           the time of day's names are set from the same file, and put back below. */
        const C = ${imp("config.mjs")};
        globalThis.__ownLabels ??= { ...C.TIME_OF_DAY_LABELS };
        Object.assign(C.TIME_OF_DAY_LABELS, "${code}" === "en" ? globalThis.__ownLabels : file.DRPG.Config.TIME_OF_DAY_LABELS);
        return true;`;
    for (const code of ["en", "pl"]) {
        await gm.eval(lang(code));
        await p1.eval(lang(code));
        const before = await p1.eval(`return game.messages.map(m => m.id);`);
        const ended = await gm.eval(`const R = ${imp("bridge-runs-acts.mjs")}, H = ${imp("hide.mjs")}, S = ${imp("gm-stores.mjs")};
            await R.handleHideStart({ actorId: "${IDS.aiko}", total: 20, isCritical: false, rollId: null }, game.user);
            const c = game.settings.get("danganronpa-rpg", "clock");
            await S.hideStore.patch("${IDS.aiko}", { mark: c.chapter + ":" + c.day + ":noon:" });
            return (await H.settleHides())?.ended ?? null;`, { timeout: 60000 });
        await settle(2500);
        const got = await p1.eval(`const seen = new Set(${JSON.stringify(before)});
            const msg = game.messages.find(m => !seen.has(m.id));
            if (!msg) return { found: false };
            const el = document.querySelector('[data-message-id="' + msg.id + '"]');
            const html = el ? el.outerHTML : (typeof msg.renderHTML === "function" ? (await msg.renderHTML()).outerHTML : null);
            const div = document.createElement("div"); div.innerHTML = html ?? "";
            return { found: true, inLog: Boolean(el), html, text: div.textContent.replace(/\\s+/g, " ").trim() };`, { timeout: 30000 });
        note(`p1's card (${code})`, JSON.stringify({ ended, found: got?.found, inLog: got?.inLog, text: got?.text?.slice(0, 300) }));
        if (got?.html) fs.writeFileSync(path.join(OUT, `notice-${code}.html`), `${got.html.replace(/[\u2013\u2014\u2212]/g, c => `&#${c.codePointAt(0)};`)}\n`);
        const label = code === "en" ? "Noon" : "Południe";
        check(`the end's card is kept from p1's page (${code}) and names the time of day`, Boolean(got?.html) && String(got?.text ?? "").includes(label), JSON.stringify(got).slice(0, 600));
    }
    for (const c of [gm, p1]) await c.eval(`const S = ${imp("settings.mjs")}, C = ${imp("config.mjs")};
        if (globalThis.__ownI18n) game.i18n.translations = globalThis.__ownI18n;
        if (globalThis.__ownLabels) Object.assign(C.TIME_OF_DAY_LABELS, globalThis.__ownLabels);
        S.setPageLanguage("en"); return true;`);
    // The hide the probe left (its last settle ended it; a row still there is ended).
    await gm.eval(`const H = ${imp("hide.mjs")}, S = ${imp("gm-stores.mjs")}; if (S.hideStore.get("${IDS.aiko}")) await H.endHide("${IDS.aiko}", "reveal"); return true;`);
}
