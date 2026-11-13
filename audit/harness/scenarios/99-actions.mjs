/**
 * 99-actions: every row of config.mjs `ACTIONS` driven from a player's page (E39 C2, 13.11.2026; plan docs/dev/plans/E39.md
 * on the planner's branch, its section 3 item 3: "driveAction over ACTIONS: one generated case per row, so a new row is covered
 * without a new test").
 *
 * The GM and p1. Aiko (p1's) stands in Dorm A, her statistics set to 0 so a total is the two dice alone (read back on the
 * first Observe, whose answer carries the roll: `calibrate`), and p1 calls the module as the sheet's tile does
 * (`game.drpg.performAction`), every DialogV2 window drawn (`__dialogWindows`) and pressed by the plan of its row (`DRIVE`),
 * its default button otherwise; the dice are set on both browsers (`__forceRoll`: the GM draws a player's action roll,
 * roll-draw.mjs, so the GM's throw is the one counted).
 *
 *   census   every key of ACTIONS has a row in DRIVE and every row of DRIVE a key of ACTIONS: a new action fails here until
 *            it is given a driver - that is what "covered automatically" can honestly mean (a row of the table cannot drive
 *            itself: each action asks its own questions);
 *   price    each row driven once on its legal road, or on the refusal its row names, and the actions it took counted
 *            against what its row says (`price`: the row's `cost` from ACTIONS for an action that rolls, 0 for a refusal and
 *            for the rows that throw no dice here);
 *   bands    every row with a `thresholds` table (Search, Projects, Listen and Sabotage today; a new one is picked up by the loop, and
 *            fails until DRIVE says how its band is read): the totals one below each band's `min`, each `min` itself and a
 *            critical, each read off the row's answer and held to the band config.mjs gives for that total - computed here,
 *            not by the module's `resolveThreshold`, so a change of the module's comparison shows.
 *
 * The expected numbers are read from config.mjs alone (the plan's "audit risk"): the bands, the costs, the critical's
 * bonus. What a band GIVES beyond the answer the action returns (the item drawn, the people named) is the older
 * scenarios' and tier 2's (40-flow, 88-flow-length, E14-T14; COVERAGE.md in docs/dev/e39 lists them).
 *
 * What this cannot see: a real Daggerheart roll window (the harness's stand-in presses its own Roll), a real table's
 * timing, and the rows whose resolution is a GM's ruling (Observe's hit, Analyze's hint, the Dynamic action's
 * difficulty): their price is read here, their ruling is 40-flow's and 88's.
 */
export const layers = ["ci"];
export const timeoutMs = 600000;

const J = value => JSON.stringify(value);

/*
 * THE DRIVERS, one per row of ACTIONS. `plan` is what the person presses in each window (a title's words, the controls it
 * clicks first, the fields it fills, the button), `price` the actions the drive takes, read from the row where it rolls
 * (`"cost"`) or a number where the row's road here costs none (a refusal: no marked room, nobody in the room, no Eclipse),
 * `band` how a total's band is read off the action's answer, for a row with thresholds.
 */
const DRIVE = {
    search: { price: "cost", band: o => (o?.success ? o.tier : -1) },
    observe: { price: "cost" },
    analyze: { price: "cost" },
    project: { price: "cost", plan: [{ title: "Projects", click: ['input[value="work"]'] }],
        band: (o, def) => (o?.progress > 0 ? def.thresholds.findIndex(t => t.progress === o.progress) : -1) },
    dynamic: { price: 0, plan: [{ title: "Dynamic", fill: { '[name="request"]': "E39 99 asks to open the archive" } }], waitsForGm: true },
    rest: { price: 0, refusal: "no room here is marked for a rest" },
    listen: { price: "cost", band: o => (!o?.success ? -1 : o.named ? 1 : Number.isFinite(o.count) ? 0 : -2) },
    palm: { price: 0, refusal: "nobody else stands in the room" },
    tamper: { price: "cost" },
    directMurder: { price: 0, refusal: "no Eclipse is running" },
    move: { price: 0 },
    /* A variant (config.mjs: the third branch of Projects): dispatched by its key it sabotages the project in the room. */
    sabotage: { price: "cost", band: (o, def) => (o?.success ? def.thresholds.findIndex(t => String(o.text ?? "").startsWith(t.result)) : -1) }
};

/* The rows whose drive needs a project of its own in Dorm A, made fresh before each drive (a Sabotage breaks and freezes it). */
const FRESH_PROJECT = new Set(["project", "sabotage"]);

/* The dice for a total: two faces that are not equal (a critical is equal faces), Hope one above half. */
const facesFor = total => {
    const hope = Math.floor(total / 2) + 1;
    return { hope, fear: total - hope };
};

/* The band config.mjs gives a total: the last band whose `min` the total reaches, -1 for none (utils.mjs `resolveThreshold`'s
   rule, written out again so a change of the module's comparison is read, not shared). */
const bandOf = (total, thresholds) => {
    let at = -1;
    thresholds.forEach((t, i) => { if (total >= t.min) at = i; });
    return at;
};

export async function run({ gm, p1, check, phase, settle, repoUrl, IDS }) {
    const imp = file => `await import("${repoUrl}/scripts/${file}")`;
    /* The person at p1's page: each DialogV2 window drawn is pressed 150 ms after it is drawn, by the plan's step for its
       title, else its default button, else its first. `__s99.log` keeps what was pressed. */
    await p1.eval(`globalThis.__dialogWindows = true;
        if (!globalThis.__s99) {
            const S = globalThis.__s99 = { plan: [], log: [], seen: new Set() };
            S.timer = setInterval(() => {
                for (const app of foundry.applications.instances.values()) {
                    if (!(app instanceof foundry.applications.api.DialogV2) || S.seen.has(app.id) || !app.rendered || !app.element?.isConnected) continue;
                    S.seen.add(app.id);
                    setTimeout(() => {
                        const el = app.element; if (!el?.isConnected) return;
                        const title = String(app.options?.window?.title ?? "?"), step = S.plan.find(p => title.includes(p.title)) ?? null;
                        for (const sel of step?.click ?? []) el.querySelector(sel)?.click();
                        for (const [sel, value] of Object.entries(step?.fill ?? {})) {
                            const field = el.querySelector(sel);
                            if (field) { field.value = value; field.dispatchEvent(new Event("input", { bubbles: true })); field.dispatchEvent(new Event("change", { bubbles: true })); }
                        }
                        const footer = [...el.querySelectorAll("footer button")];
                        const button = (step?.button ? footer.find(b => b.dataset.action === step.button) : null) ?? footer.find(b => b.classList.contains("default")) ?? footer[0] ?? null;
                        S.log.push(title + " -> " + (button?.dataset?.action ?? "none"));
                        button?.click();
                    }, 150);
                }
            }, 100);
        }
        return true;`);

    phase("setup");
    const was = await gm.eval(`const a = game.actors.get("${IDS.aiko}"), M = ${imp("movement.mjs")}, { SETTINGS } = ${imp("settings.mjs")};
        const traits = Object.fromEntries(Object.entries(a.system.traits ?? {}).map(([k, v]) => [k, v?.value ?? 0]));
        globalThis.__s99was = { traits, actions: game.drpg.actionsLeft(a), stress: a.system.resources?.stress?.value ?? 0, hope: a.system.resources?.hope?.value ?? 0,
            items: a.items.map(i => i.id), perRoom: game.settings.get("danganronpa-rpg", SETTINGS.searchTokensPerRoom) };
        await a.update(Object.fromEntries(Object.keys(traits).map(k => ["system.traits." + k + ".value", 0])));
        await game.settings.set("danganronpa-rpg", SETTINGS.searchTokensPerRoom, 10);
        await game.drpg.setClock({ chapter: 1, day: 1, session: 1, timeOfDay: "morning", phase: "dailyLife" });
        const made = await canvas.scene.createEmbeddedDocuments("Region", [{ name: "E39 Annexe", shapes: [{ type: "rectangle", x: 800, y: 200, width: 300, height: 600 }],
            flags: { "danganronpa-rpg": { room: true } }, behaviors: [] }]);
        globalThis.__s99was.region = made[0]?.id ?? null;
        const { ACTIONS } = ${imp("config.mjs")};
        return { room: M.roomOfActor(a), keys: Object.keys(ACTIONS), region: globalThis.__s99was.region,
            defs: Object.fromEntries(Object.entries(ACTIONS).map(([k, d]) => [k, { cost: d.cost ?? null, thresholds: d.thresholds ?? null, critical: d.critical ?? null }])) };`,
    { timeout: 60000 });
    check("setup: Aiko stands in Dorm A beside a room drawn for Listen, and ACTIONS is read", was?.room === "Dorm A" && Boolean(was.region) && was.keys?.length > 0, J(was));
    const defs = was?.defs ?? {};

    /* One drive: Aiko's actions filled, the dice set on both browsers, p1 presses the tile; answers what the action
       answered, the actions before and after and what was pressed. */
    const drive = async (key, faces, plan = DRIVE[key]?.plan ?? []) => {
        await gm.eval(`const a = game.actors.get("${IDS.aiko}"); await game.drpg.setActions(a, game.drpg.actionsMax(a));
            if (${FRESH_PROJECT.has(key)}) {
                const P = ${imp("projects.mjs")};
                for (const p of P.allProjects().filter(p => p.name === "E39 99 work")) await P.applyProjectChange(p.id, { remove: true }, { by: { kind: "gm" } });
                await P.createProject({ name: "E39 99 work", target: 30, room: "Dorm A", secret: false });
                await new Promise(r => setTimeout(r, 1200));
            }
            const T = ${imp("search-tokens.mjs")}; await T.clearSeasonSearchTokens();
            globalThis.__forceRoll = ${J(faces)}; return true;`, { timeout: 60000 });
        await settle(300);
        const out = await p1.eval(`const S = globalThis.__s99; S.plan = ${J(plan)}; S.log = []; globalThis.__forceRoll = ${J(faces)};
            const a = game.actors.get("${IDS.aiko}"), before = game.drpg.actionsLeft(a);
            let answer = null, threw = null;
            try { answer = await Promise.race([game.drpg.performAction(a, ${J(key)}), new Promise(r => setTimeout(() => r("waiting"), 12000))]); }
            catch (err) { threw = String(err?.message ?? err); }
            await new Promise(r => setTimeout(r, 1200));
            delete globalThis.__forceRoll;
            const flat = answer && typeof answer === "object" ? Object.fromEntries(Object.entries(answer).map(([k, v]) =>
                [k, k === "roll" ? { total: v?.total ?? null, critical: v?.isCritical ?? null } : Array.isArray(v) ? v.map(x => x?.name ?? x) : (v && typeof v === "object" ? (v.id ?? null) : v)])) : answer;
            return { answer: flat, threw, before, after: game.drpg.actionsLeft(a), pressed: S.log.slice() };`, { timeout: 40000 });
        await gm.eval(`delete globalThis.__forceRoll; return true;`);
        return out;
    };

    try {
        phase("census", { flow: "action-roll" });
        const missing = (was?.keys ?? []).filter(k => !DRIVE[k]), stale = Object.keys(DRIVE).filter(k => !(was?.keys ?? []).includes(k));
        check("census: every row of ACTIONS has a driver here and every driver a row - a new action fails this until it is given one",
            (was?.keys?.length ?? 0) > 0 && missing.length === 0 && stale.length === 0, J({ missing, stale }));

        phase("calibrate");
        /* Observe answers its roll: with the statistics at 0 and no situational die (Dorm A, the Morning), 2 + 3 reads 5. */
        const cal = await drive("observe", { hope: 2, fear: 3 });
        const mod = Number(cal?.answer?.roll?.total) - 5;
        check("calibrate: a total is the two dice alone (Observe's roll 2 + 3 reads 5)", mod === 0, J(cal));

        phase("price", { flow: "action-roll" });
        const priced = {};
        for (const key of (was?.keys ?? []).filter(k => DRIVE[k])) {
            const r = await drive(key, { hope: 9, fear: 5 });
            const want = DRIVE[key].price === "cost" ? Number(defs[key]?.cost ?? NaN) : DRIVE[key].price;
            priced[key] = { want, took: r.before - r.after, answer: r.answer, threw: r.threw, pressed: r.pressed };
        }
        await settle(800);
        const wrong = Object.entries(priced).filter(([, v]) => v.took !== v.want || v.threw);
        check("price: each row of ACTIONS driven from p1's page takes the actions its row says - its cost where it rolls, none where its road here is refused",
            Object.keys(priced).length === Object.keys(DRIVE).length && wrong.length === 0, J({ wrong, priced }));

        phase("bands", { flow: "action-roll" });
        const banded = Object.entries(defs).filter(([, d]) => Array.isArray(d.thresholds) && d.thresholds.length);
        const unread = banded.filter(([k]) => typeof DRIVE[k]?.band !== "function").map(([k]) => k);
        check("bands: every row of ACTIONS with a thresholds table has its band read here", banded.length > 0 && unread.length === 0, J({ banded: banded.map(([k]) => k), unread }));
        for (const [key, def] of banded.filter(([k]) => typeof DRIVE[k]?.band === "function")) {
            const totals = [...new Set(def.thresholds.flatMap(t => [t.min - 1, t.min]))].filter(t => t >= 3 && t <= 22 + mod);
            const rows = [];
            for (const total of totals) {
                const r = await drive(key, facesFor(total - mod));
                rows.push({ total, want: bandOf(total, def.thresholds), got: DRIVE[key].band(r.answer, def), took: r.before - r.after, answer: r.answer });
            }
            /* A critical: equal faces, 6 and 6, so 12 + mod by the dice. */
            const crit = await drive(key, { hope: 6, fear: 6 });
            const off = rows.filter(r => r.want !== r.got || r.took !== Number(def.cost));
            /* What the critical is worth, read from the row's `critical`: a Search's tier the dice's band plus `tierBonus`, a
               Work's `progress` with its action back (`refundAction`), Listen's everyone in every room. */
            const base = bandOf(12 + mod, def.thresholds);
            const critOk = key === "search" ? crit.answer?.success === true && crit.answer.tier === Math.min(3, (def.thresholds[base]?.tier ?? 0) + (def.critical?.tierBonus ?? 1))
                : key === "project" ? crit.answer?.progress === def.critical?.progress && (crit.before - crit.after) === (def.critical?.refundAction ? 0 : Number(def.cost))
                    : key === "listen" ? crit.answer?.success === true && crit.answer.isCritical === true
                        : key === "sabotage" ? crit.answer?.success === true && String(crit.answer.text ?? "").startsWith(def.critical?.result) && (crit.before - crit.after) === Number(def.cost)
                            : false;
            check(`bands: ${key} at one below each band's min, at each min (${totals.join(", ")}) and on a critical gives the band config.mjs gives, at its cost`,
                rows.length >= 2 && off.length === 0 && critOk, J({ off, rows, crit }));
        }
    } finally {
        await gm.eval(`const a = game.actors.get("${IDS.aiko}"), w = globalThis.__s99was ?? {}, { SETTINGS } = ${imp("settings.mjs")};
            for (const i of a.items.filter(i => !(w.items ?? []).includes(i.id))) await i.delete();
            if (w.traits) await a.update(Object.fromEntries(Object.entries(w.traits).map(([k, v]) => ["system.traits." + k + ".value", v])));
            await a.update({ "system.resources.stress.value": w.stress ?? 0, "system.resources.hope.value": w.hope ?? 0 });
            if (Number.isFinite(w.actions)) await game.drpg.setActions(a, w.actions);
            if (w.perRoom !== undefined) await game.settings.set("danganronpa-rpg", SETTINGS.searchTokensPerRoom, w.perRoom);
            const T = ${imp("search-tokens.mjs")}; await T.clearSeasonSearchTokens();
            if (w.region) await canvas.scene.regions.get(w.region)?.delete();
            const P = ${imp("projects.mjs")};
            for (const p of P.allProjects().filter(p => String(p.name ?? "").includes("E39 99"))) await P.applyProjectChange(p.id, { remove: true }, { by: { kind: "gm" } });
            return true;`, { timeout: 60000 }).catch(() => null);
        await p1.eval(`clearInterval(globalThis.__s99?.timer); delete globalThis.__s99; return true;`).catch(() => null);
    }
}
