/**
 * 1.2.43: the module's own "Language" setting, on all four clients.
 * Switch each browser to Polish, apply the file the way `i18nInit` does, and
 * check: the strings, the config.mjs prose, the glossary, the plural forms,
 * the HUD after a re-render, and that no key the code asks for went missing.
 */
const MOD = "danganronpa-rpg";
const REPO = "file:///home/user/Danganronpa-RPG";

export async function run({ gm, p1, p2, p3, check, settle }) {
    const all = [gm, p1, p2, p3];

    // ---- 0. English baseline -------------------------------------------------------------
    const en = await gm.eval(`const C = await import("${REPO}/scripts/config.mjs"); return { hint: C.ACTIONS.search.hint, tod: C.TIME_OF_DAY_LABELS.noon, lang: game.settings.get("${MOD}", "language") };`);
    // Keys the harness cannot serve in any language (system and core strings the mock never loads).
    const baseline = {};
    for (const c of all) baseline[c.who] = new Set(await c.eval(`return [...globalThis.__missingI18n];`));
    check("gm: the setting defaults to English", en.lang === "en", JSON.stringify(en));

    // ---- 1. switch every client to Polish, apply the file ---------------------------------
    for (const c of all) {
        const r = await c.eval(`
            await game.settings.set("${MOD}", "language", "pl");
            const I = await import("${REPO}/scripts/i18n.mjs");
            const applied = await I.applyModuleLanguage();
            const C = await import("${REPO}/scripts/config.mjs");
            const U = await import("${REPO}/scripts/utils.mjs");
            return {
                applied, lang: I.moduleLanguage(),
                summary: game.i18n.format("DRPG.Clock.summary", { chapter: 1, day: 2, session: 3, time: C.TIME_OF_DAY_LABELS.noon }),
                hint: C.ACTIONS.search.hint, label: C.ACTIONS.search.label, tod: C.TIME_OF_DAY_LABELS.noon,
                phase: C.PHASES.dailyLife.label, stat: C.TRAITS.eye.label,
                p1: U.plural("DRPG.Chapter.doneKeys", { n: 1 }), p2: U.plural("DRPG.Chapter.doneKeys", { n: 2 }),
                p5: U.plural("DRPG.Chapter.doneKeys", { n: 5 }), p22: U.plural("DRPG.Chapter.doneKeys", { n: 22 }),
                dh: game.i18n.localize("DAGGERHEART.GENERAL.fear") };`, { timeout: 30000 });
        check(`${c.who}: the Polish file applied`, r.applied === true && r.lang === "pl", JSON.stringify(r));
        check(`${c.who}: a plain string is Polish`, /Rozdział 1 · Dzień 2 · Sesja 3 · Południe/.test(r.summary), r.summary);
        check(`${c.who}: config.mjs prose was swapped in place`, r.hint !== en.hint && /Przeszukaj/.test(r.hint), r.hint);
        check(`${c.who}: the glossary stays English`, r.label === "Search" && r.phase === "Daily Life" && r.stat === "Eye", JSON.stringify([r.label, r.phase, r.stat]));
        check(`${c.who}: the time of day is Polish`, r.tod === "Południe", r.tod);
        check(`${c.who}: plural picks one/few/many`, r.p1.includes("1 Key Remnant.") && /2 Key Remnants/.test(r.p2) && /5 Key Remnants/.test(r.p5) && /22 Key Remnants/.test(r.p22), JSON.stringify([r.p1, r.p2, r.p5, r.p22]));
        check(`${c.who}: the system override (Fear -> Despair) survived the merge`, r.dh === "Despair", r.dh);
    }

    // ---- 2. every English key has a Polish twin; no key the code asks for is missing ------
    const cov = await gm.eval(`
        const U = foundry.utils;
        const flat = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) => typeof v === "object" && v !== null ? flat(v, p ? p + "." + k : k) : [p ? p + "." + k : k]);
        const en = U.expandObject(await (await fetch("modules/${MOD}/lang/en.json")).json());
        const pl = U.expandObject(await (await fetch("modules/${MOD}/lang/pl.json")).json());
        const enKeys = new Set(flat(en)), plKeys = new Set(flat(pl));
        const missing = [...enKeys].filter(k => !plKeys.has(k));
        const extra = [...plKeys].filter(k => !enKeys.has(k) && !/\\.(few|many)$/.test(k) && !k.startsWith("DRPG.Config."));
        return { en: enKeys.size, pl: plKeys.size, missing: missing.slice(0, 10), extra: extra.slice(0, 10) };`, { timeout: 30000 });
    check("gm: pl.json covers every en.json key", cov.missing.length === 0, JSON.stringify(cov));
    check("gm: pl.json carries no stray keys", cov.extra.length === 0, JSON.stringify(cov.extra));

    // ---- 3. a re-render: the HUD and the player strip speak Polish ------------------------
    await gm.eval(`await game.drpg.setClock({ chapter: 1, day: 2, session: 1, timeOfDay: "evening", phase: "dailyLife" }); return true;`, { timeout: 30000 });
    await settle(600);
    for (const c of all) {
        const seen = await c.eval(`
            game.drpg.renderHud?.();
            await new Promise(r => setTimeout(r, 300));
            return { hud: (document.querySelector("#drpg-hud")?.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 300),
                     missing: [...globalThis.__missingI18n].filter(k => k.startsWith("DRPG.")) };`, { timeout: 20000 });
        seen.missing = seen.missing.filter(k => !baseline[c.who].has(k));
        check(`${c.who}: the HUD shows the Polish time of day`, /Wieczór/.test(seen.hud), seen.hud);
        check(`${c.who}: no i18n key went missing after the switch`, seen.missing.length === 0, JSON.stringify(seen.missing.slice(0, 10)));
    }

    // ---- 4. the GM panel opens with a Polish title and Polish content ----------------------
    const panel = await gm.eval(`
        globalThis.__dialogLog.length = 0;
        const P = await import("${REPO}/scripts/gm-panel.mjs");
        P.openGmPanel?.();
        await new Promise(r => setTimeout(r, 600));
        const d = globalThis.__dialogLog.find(d => /panel GMa/.test(d.title ?? "")) ?? globalThis.__dialogLog[0] ?? null;
        return d ? { title: d.title, content: (d.content ?? "").replace(/\\s+/g, " ").slice(0, 300) } : null;`, { timeout: 30000 });
    check("gm: the panel opens with a Polish title", panel?.title === "Danganronpa - panel GMa", JSON.stringify(panel));
    check("gm: the panel's body is Polish", !!panel && /Rozdzia|Dzie|pora|Nast/i.test(panel.content), JSON.stringify(panel));

    // ---- 5. back to English on one client: the setting is per browser ----------------------
    const back = await p3.eval(`await game.settings.set("${MOD}", "language", "en"); const I = await import("${REPO}/scripts/i18n.mjs"); return { lang: I.moduleLanguage(), applied: await I.applyModuleLanguage() };`);
    check("p3: switching back is a no-op until reload (the setting says reload)", back.lang === "en" && back.applied === false, JSON.stringify(back));
    const others = await p1.eval(`return game.settings.get("${MOD}", "language");`);
    check("p1: another browser keeps its own choice", others === "pl", others);
}
