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

export async function run({ gm, p1, p2, check, phase, settle, repoUrl, IDS, reload }) {
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
                        S.drawn = [...(S.drawn ?? []), title + " :: " + el.textContent.replace(/\\s+/g, " ")].slice(-6);
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

        /* THE FLAT NUMBERS (E39, 14.11.2026; the gap STATUS named: "Analyze's Find Stash and Find Passage at their flat 16").
           Neither has a table, so the bands loop above passes them by. Each is judged on the primary GM, which tells p1 one
           shape whatever came of it, so the band is read where the GM writes what it found, with a target there to find:
           Daichi's stash concealed in Dorm A (its pieces' `drpgStashes`, put back after) - found, Aiko's `drpgStashesFound`
           names it; a tunnel with an end on Aiko's spot (`game.drpg.passages.create`, deleted after) - found, the GMs' cell
           `<passage>/<Aiko>` reads "found". One below 16, 16, and a critical under 16 (6 and 6: 12), each at Analyze's cost,
           the find taken off again before the next drive. The number is config.mjs's (`stashThreshold`, `passageThreshold`). */
        phase("flat: Find Stash and Find Passage at their flat number", { flow: "action-roll" });
        const flatSet = await gm.eval(`const R = ${imp("rooms.mjs")}, t = canvas.scene.tokens.get("TOKAIKO000000000");
            const pieces = R.roomRegions(canvas.scene, "Dorm A");
            globalThis.__s99flat = { stashes: pieces.map(r => [r.id, foundry.utils.deepClone(r.getFlag("danganronpa-rpg", "drpgStashes") ?? null)]) };
            for (const r of pieces) await r.setFlag("danganronpa-rpg", "drpgStashes", [...(r.getFlag("danganronpa-rpg", "drpgStashes") ?? []).filter(e => e.actorId !== "${IDS.daichi}"),
                { actorId: "${IDS.daichi}", concealed: true }]);
            const far = { x: 1930, y: 1760, level: null };
            const id = await game.drpg.passages.create({ sceneId: canvas.scene.id, shape: "tunnel", ends: [{ x: t.x + 50, y: t.y + 50, level: null }, far] });
            globalThis.__s99flat.passage = id ?? null;
            await new Promise(r => setTimeout(r, 800));
            return { pieces: pieces.length, passage: id ?? null };`, { timeout: 60000 });
        const flatFound = (which) => gm.eval(`const S = ${imp("gm-stores.mjs")}, V = ${imp("vault-store.mjs")}, a = game.actors.get("${IDS.aiko}");
            const was = ${J(which)} === "stash" ? V.hasFoundStash(a, "Dorm A", "${IDS.daichi}", canvas.scene)
                : S.passageAccessStore.get(globalThis.__s99flat.passage + "/${IDS.aiko}")?.how === "found";
            if (a.getFlag("danganronpa-rpg", V.VAULT_FLAGS.found) !== undefined) await a.unsetFlag("danganronpa-rpg", V.VAULT_FLAGS.found);
            const cell = globalThis.__s99flat.passage + "/${IDS.aiko}";
            if (S.passageAccessStore.has(cell)) await S.passageAccessStore.drop(cell);
            return was;`, { timeout: 30000 });
        const FLAT = { stash: Number(defs.analyze ? (await gm.eval(`const { ACTIONS } = ${imp("config.mjs")}; return ACTIONS.analyze.stashThreshold;`)) : NaN),
            passage: Number(await gm.eval(`const { ACTIONS } = ${imp("config.mjs")}; return ACTIONS.analyze.passageThreshold;`)) };
        const flat = {};
        for (const which of ["stash", "passage"]) {
            await flatFound(which);
            const n = FLAT[which], rows = [];
            for (const [label, faces, want] of [[n - 1, facesFor(n - 1 - mod), false], [n, facesFor(n - mod), true], ["critical", { hope: 6, fear: 6 }, true]]) {
                const r = await drive("analyze", faces, [{ title: "Analyze", click: [`input[value="${which}"]`] }]);
                await settle(800);
                rows.push({ total: label, want, got: await flatFound(which), took: r.before - r.after, pressed: r.pressed });
            }
            flat[which] = rows;
        }
        const flatOff = Object.entries(flat).flatMap(([k, rows]) => rows.filter(r => r.want !== r.got || r.took !== Number(defs.analyze?.cost)).map(r => ({ k, ...r })));
        check(`flat: Find Stash and Find Passage at one below their number, at it (${FLAT.stash}, ${FLAT.passage}) and on a critical under it - found exactly from the number on, and on the critical, judged by the GM, each at Analyze's cost`,
            flatSet?.pieces > 0 && Boolean(flatSet.passage) && FLAT.stash > 3 && FLAT.passage > 3 && flat.stash?.length === 3 && flat.passage?.length === 3 && flatOff.length === 0,
            J({ flatSet, FLAT, flat }));

        /* PALM'S FRISK IN BOTH MODES (E39, 14.11.2026; the A11 amendment: "driveAction covers Frisk in both modes"; the gap
           STATUS named: 99 drove Palm only to its refusal). Botan (p2's) stands beside Aiko in Dorm A with a marked comb, and
           p1 frisks him from its own page, the Palm window answered as 40-flow's open Frisk answers it (the Frisk, Botan, the
           mode), each roll's faces set as it is thrown. Unseen: Shadow against `rummage.unseen` and Hand against
           `rummage.threshold`, at one below and at each, and both critical - read on the GM's veiled cards: p1's list (or its
           miss) and whether it was noticed, p2's "caught" line. Openly, with the GMs' friskForce on: p2 allows (the pockets
           turned out, no roll), and p2 refuses and p1 forces at Body against `frisk.threshold`, at one below and at it. Every
           Frisk costs Palm's action. The numbers are config.mjs's. */
        phase("frisk: Palm's Frisk, Unseen and Openly, at its numbers", { flow: "action-roll" });
        const FRISK_COMB = "E39 99 frisk comb";
        const friskSet = await gm.eval(`const M = ${imp("movement.mjs")}, INV = ${imp("inventory.mjs")}, F = ${imp("frisk.mjs")}, { ACTIONS } = ${imp("config.mjs")};
            const PLACE = { teleport: true, movementAction: "displace", animate: false };
            const bt = canvas.scene.tokens.find(t => t.actorId === "${IDS.botan}"), botan = game.actors.get("${IDS.botan}");
            globalThis.__s99frisk = { at: bt ? { id: bt.id, x: bt.x, y: bt.y } : null, force: game.settings.get("danganronpa-rpg", "friskForce") };
            if (bt) await bt.update(M.positionIn("Dorm A", bt), PLACE);
            const item = await INV.grantItem(botan, { name: ${J(FRISK_COMB)}, category: "usable", tier: 1, override: true, quiet: true });
            globalThis.__s99frisk.item = item?.id ?? null;
            await game.settings.set("danganronpa-rpg", "friskForce", true);
            F.forgetFriskAsks();
            await new Promise(r => setTimeout(r, 800));
            const p = ACTIONS.palm;
            return { others: M.othersInRoom(game.actors.get("${IDS.aiko}")).map(a => a.id), item: Boolean(item),
                n: { cover: p.rummage.unseen, hand: p.rummage.threshold, force: p.frisk.threshold }, cost: p.cost };`, { timeout: 60000 });
        const fw = await p1.eval(`const f = (k, d) => game.i18n.format("DRPG.Frisk." + k, d), b = game.actors.get("${IDS.botan}").name, a = game.actors.get("${IDS.aiko}").name;
            return { list: f("listHeading", { who: b }), shown: f("shownHeading", { who: b }), missed: f("missed", { who: b }), refused: f("refused", { who: b }),
                cardSeen: game.i18n.localize("DRPG.Steal.cardSeen"), cardUnseen: game.i18n.localize("DRPG.Steal.cardUnseen"),
                caught: f("caught", { who: a }), caughtTrying: f("caughtTrying", { who: a }) };`);
        const chatWords = (c, from) => c.eval(`const S = ${imp("secret.mjs")}, text = h => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
            return game.messages.contents.slice(${from}).filter(m => m.visible).map(m => text(S.secretHtml(m)) + " " + text(S.contentOf(m)));`);
        const friskDrive = async ({ mode, faces = [], answer = null, press = null }) => {
            await gm.eval(`const F = ${imp("frisk.mjs")}; F.forgetFriskAsks(); const a = game.actors.get("${IDS.aiko}"); await game.drpg.setActions(a, game.drpg.actionsMax(a)); return true;`);
            await settle(300);
            const from = { p1: await p1.eval(`return game.messages.size;`), p2: await p2.eval(`return game.messages.size;`) };
            if (answer) await p2.eval(`globalThis.__dialogAnswers.push(${J(answer)}); return true;`);
            const out = await p1.eval(`const a = game.actors.get("${IDS.aiko}"), before = game.drpg.actionsLeft(a);
                globalThis.__dialogWindows = false;
                globalThis.__dialogAnswers.push(() => ({ value: "frisk", form: { querySelector: sel => sel.includes("who") ? { value: "${IDS.botan}" }
                    : sel.includes("friskMode") ? { value: ${J(mode)} } : null } }));
                ${press ? `globalThis.__dialogAnswers.push(${J(press)});` : ""}
                const faces = ${J(faces)}, own = Object.getPrototypeOf(a).rollTrait;
                a.rollTrait = async function (key, options) { globalThis.__forceRoll = faces.shift(); return own.call(a, key, options); };
                let r = null, threw = null;
                try { r = await Promise.race([game.drpg.performAction(a, "palm", {}), new Promise(res => setTimeout(() => res("waiting"), 25000))]); }
                catch (err) { threw = String(err?.message ?? err); }
                finally { delete a.rollTrait; delete globalThis.__forceRoll; globalThis.__dialogWindows = true; }
                await new Promise(res => setTimeout(res, 1500));
                const unread = globalThis.__dialogAnswers.length; globalThis.__dialogAnswers.length = 0;
                return { r: r && typeof r === "object" ? { success: r.success ?? null, seen: r.seen ?? null, asked: r.asked ?? null } : r, threw, unread,
                    took: before - game.drpg.actionsLeft(a), facesLeft: faces.length };`, { timeout: 60000 });
            await p2.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
            await settle(800);
            const w1 = (await chatWords(p1, from.p1)).join(" | "), w2 = (await chatWords(p2, from.p2)).join(" | ");
            return { ...out, list: w1.includes(fw.list) && w1.includes(FRISK_COMB), shown: w1.includes(fw.shown), missed: w1.includes(fw.missed),
                noticedCard: w1.includes(fw.cardSeen) ? true : w1.includes(fw.cardUnseen) ? false : null,
                p2: w2.includes(fw.caughtTrying) ? "caughtTrying" : w2.includes(fw.caught) ? "caught" : null };
        };
        const N = friskSet?.n ?? {};
        const unseenCases = [
            ["cover-1, hand", facesFor(N.cover - 1 - mod), facesFor(N.hand - mod), { list: true, noticedCard: true, p2: "caught" }],
            ["cover, hand-1", facesFor(N.cover - mod), facesFor(N.hand - 1 - mod), { list: false, missed: true, noticedCard: false, p2: null }],
            ["cover, hand", facesFor(N.cover - mod), facesFor(N.hand - mod), { list: true, noticedCard: false, p2: null }],
            ["cover-1, hand-1", facesFor(N.cover - 1 - mod), facesFor(N.hand - 1 - mod), { list: false, missed: true, noticedCard: true, p2: "caughtTrying" }],
            ["both critical", { hope: 5, fear: 5 }, { hope: 2, fear: 2 }, { list: true, noticedCard: false, p2: null }]
        ];
        const frisked = [];
        if (friskSet?.others?.includes(IDS.botan) && friskSet.item) {
            for (const [name, cover, hand, want] of unseenCases) {
                const got = await friskDrive({ mode: "unseen", faces: [cover, hand] });
                frisked.push({ name, want, got, ok: got.took === friskSet.cost && !got.threw && got.facesLeft === 0 && Object.entries(want).every(([k, v]) => got[k] === v) && (want.missed ? got.missed : true) });
            }
            const allow = await friskDrive({ mode: "openly", answer: "allow" });
            frisked.push({ name: "openly, allowed", got: allow, ok: allow.took === friskSet.cost && allow.shown && allow.r?.asked === "shown" && allow.facesLeft === 0 });
            for (const [name, faces, won] of [["openly, forced at force-1", facesFor(N.force - 1 - mod), false], ["openly, forced at force", facesFor(N.force - mod), true]]) {
                const got = await friskDrive({ mode: "openly", answer: "refuse", press: "force", faces: [faces] });
                frisked.push({ name, got, ok: got.took === friskSet.cost && got.r?.asked === "refused" && got.r?.success === won && got.list === won && got.missed === !won && got.facesLeft === 0 });
            }
        }
        check(`frisk: Palm's Frisk from p1 - Unseen at Shadow ${N.cover} and Hand ${N.hand}, one below and at each and both critical; Openly allowed, and forced at Body ${N.force} and one below - the GM's cards give the list, the miss and the noticing config.mjs gives, each at Palm's cost`,
            frisked.length === unseenCases.length + 3 && frisked.every(f => f.ok), J({ friskSet, frisked: frisked.filter(f => !f.ok), all: frisked.map(f => [f.name, f.ok]) }));

        /*
         * FACILITIES: A COMPLETED PROJECT'S ROOM ACTION ON THE PLAYER'S OWN PAGE (the owner's report of 14.11.2026 on 1.2.114,
         * "the project's action does not show in Facilities"; 1.2.115). On the roads a table takes, a public project and a
         * secret one with Aiko's player in on it, each in Dorm A: the GM gives it its action in the editor as drawn (the
         * project manager's Edit room action, facility-editor.mjs `editProjectFacility`, its name typed and Save pressed),
         * p1 completes it with Work rolls from the sheet's tile (the GM's draw, the bridge's run, the completion row), and p1
         * opens Facilities (Rest) and reads the row drawn there; the GM reads the same rows for Aiko, as on her sheet.
         * All green when this was written (1.2.115's probes); what a real table may differ in is in docs/dev/tips-115.
         */
        phase("facilities");
        await gm.eval(`if (!globalThis.__s99gm) { const S = globalThis.__s99gm = { label: "", seen: new Set() }; globalThis.__dialogWindows = true;
            S.timer = setInterval(() => { for (const app of foundry.applications.instances.values()) {
                if (!(app instanceof foundry.applications.api.DialogV2) || S.seen.has(app.id) || !app.rendered || !app.element?.isConnected) continue;
                S.seen.add(app.id); setTimeout(() => { const el = app.element; const f = el?.querySelector('[name="p.label"]'); if (!f) return;
                    f.value = S.label; f.dispatchEvent(new Event("input", { bubbles: true })); el.querySelector('footer button[data-action="save"]')?.click(); }, 150); } }, 100); }
            const P = ${imp("projects.mjs")}; for (const p of P.allProjects().filter(p => String(p.name ?? "").includes("E39 99"))) await P.applyProjectChange(p.id, { remove: true }, { by: { kind: "gm" } });
            return true;`, { timeout: 60000 });
        const facility = [];
        for (const [tag, secret] of [["public", false], ["secret, p1 in on it", true]]) {
            const label = `E39 99 facility soup (${tag})`;
            const made = await gm.eval(`const P = ${imp("projects.mjs")}, E = ${imp("facility-editor.mjs")}, F = ${imp("facilities.mjs")};
                const viewers = ${secret} ? [game.users.find(u => u.character?.id === "${IDS.aiko}")?.id].filter(Boolean) : [];
                const id = (await P.createProject({ name: "E39 99 facility ${tag}", target: 2, room: "Dorm A", secret: ${secret}, viewers, trait: "body" }))?.id ?? null;
                globalThis.__s99gm.label = ${J(label)};
                const project = P.allProjects().find(p => p.id === id);
                await Promise.race([E.editProjectFacility(project), new Promise(r => setTimeout(r, 8000))]);
                return { id, stored: F.projectFacilityOf(id).facility?.label ?? null };`, { timeout: 60000 });
            await settle(800);
            for (let i = 0; i < 4; i += 1) {
                const done = await gm.eval(`return (${imp("projects.mjs")}).allProjects().find(p => p.id === ${J(made.id)})?.complete === true;`);
                if (done) break;
                await gm.eval(`const a = game.actors.get("${IDS.aiko}"); await game.drpg.setActions(a, game.drpg.actionsMax(a)); globalThis.__forceRoll = { hope: 7, fear: 6 }; return true;`, { timeout: 30000 });
                await p1.eval(`const S = globalThis.__s99; S.plan = [{ title: "Projects", click: ['input[value="work"]'] }]; S.log = []; globalThis.__forceRoll = { hope: 7, fear: 6 };
                    await Promise.race([game.drpg.performAction(game.actors.get("${IDS.aiko}"), "project"), new Promise(r => setTimeout(r, 12000))]); return true;`, { timeout: 60000 });
                await settle(800);
            }
            const seen = await p1.eval(`const S = globalThis.__s99; S.plan = [{ title: "", button: "cancel" }]; S.drawn = [];
                const a = game.actors.get("${IDS.aiko}"), P = ${imp("projects.mjs")}, A = ${imp("action-facilities.mjs")};
                const complete = P.allProjects().find(p => p.id === ${J(made.id)})?.complete === true;
                await Promise.race([game.drpg.performAction(a, "rest"), new Promise(r => setTimeout(r, 4000))]);
                return { complete, rows: A.facilitiesRows(a).some(r => r.label === ${J(label)}), drawn: (S.drawn ?? []).some(t => t.includes(${J(label)})) };`, { timeout: 30000 });
            const onGm = await gm.eval(`return (${imp("action-facilities.mjs")}).facilitiesRows(game.actors.get("${IDS.aiko}")).some(r => r.label === ${J(label)});`);
            facility.push({ tag, made, seen, onGm, ok: made.stored === label && seen.complete && seen.rows && seen.drawn && onGm });
            /* AND AFTER THE CHAT IS CLEARED (P1, the owner's report of 15.11.2026 on 1.2.115, "still not shown"): until P1 a
               secret project's action reached an insider only on a GM's private card (facilities.mjs `toldFacility`), so a
               chat log the GM cleared between sessions took the row out of the insider's Facilities while the GM's rows still
               listed it - the class E101 R2 closed for the sight. Read on p1 after every message is deleted, and after a reload
               of p1's page, which asks the GMs for its sight again. */
            if (secret) {
                await gm.eval(`await ChatMessage.deleteDocuments(game.messages.map(m => m.id)); return true;`, { timeout: 30000 });
                await settle(1500);
                const read = () => p1.eval(`return (${imp("action-facilities.mjs")}).facilitiesRows(game.actors.get("${IDS.aiko}")).some(r => r.label === ${J(label)});`);
                const cleared = await read();
                await reload("p1");
                await settle(3000);
                const reloaded = await read();
                facility.push({ tag: `${tag}, after the chat is cleared`, cleared, reloaded, ok: cleared && reloaded });
            }
        }
        check("facilities: a completed project's room action - given in the editor as drawn, completed by p1's Work rolls - is a row of the Facilities window p1 opens in its room and of the GM's rows for her, for a public project and a secret one p1 is in on; the secret one's row stays on p1 after the chat is cleared and after p1 reloads",
            facility.length === 3 && facility.every(f => f.ok), J(facility));
        await gm.eval(`clearInterval(globalThis.__s99gm?.timer); delete globalThis.__s99gm; return true;`).catch(() => null);

        /* A PROJECT ACTION'S USE LIMIT (P2, 15.11.2026; the owner: per character, "none", "timeOfDay", "day", a project with
           none named reading "timeOfDay"). For each limit a public project in Dorm A, completed, its action costing nothing;
           p1 uses it once from its own page (`useFacility`, as the window does), then reads its row again, and asks again:
           under "none" the row stays open and the second use is carried out, under the two others the row is greyed with its
           reason on p1 (its copy of the GMs' uses, facility-uses.mjs) and the second use refused by the GM. The clock is not
           moved: "the next time of day" is R7543's, on the pure rule. */
        phase("facility limits");
        const limits = [];
        for (const limit of ["none", "timeOfDay", "day"]) {
            const label = `E39 99 limit ${limit}`;
            const id = await gm.eval(`const P = ${imp("projects.mjs")}, F = ${imp("facilities.mjs")};
                const id = (await P.createProject({ name: ${J(label)}, target: 1, room: "Dorm A" }))?.id ?? null;
                await F.setProjectFacility(id, { label: ${J(label)}, costsAction: false, limit: ${J(limit)} });
                await P.addProgress(id, 1); return id;`, { timeout: 60000 });
            await settle(1200);
            const read = await p1.eval(`const A = ${imp("action-facilities.mjs")}; const a = game.actors.get("${IDS.aiko}");
                const row = () => A.facilitiesRows(a).find(r => r.label === ${J(label)}) ?? null;
                const before = row();
                const first = await A.useFacility(a, ${J("project:")} + ${J(id)});
                await new Promise(r => setTimeout(r, 1500));
                const after = row();
                const second = await A.useFacility(a, ${J("project:")} + ${J(id)});
                return { before: before ? before.disabled : null, first: Boolean(first?.success), after: after ? [after.disabled, after.why] : null,
                    second: Boolean(second?.success) };`, { timeout: 60000 });
            limits.push({ limit, ...read });
        }
        const want = {
            none: { before: false, first: true, after: [false, ""], second: true },
            timeOfDay: { before: false, first: true, after: [true, "This character used it already this time of day."], second: false },
            day: { before: false, first: true, after: [true, "This character used it already today."], second: false }
        };
        check("facility limits: a project action used once by p1 - under no limit its row stays open and a second use is carried out; under once a time of day and once a day its row is greyed on p1 with its reason and the GM refuses the second",
            limits.length === 3 && limits.every(r => J({ before: r.before, first: r.first, after: r.after, second: r.second }) === J(want[r.limit])), J(limits));

        /* A PROJECT IN A ROOM TWO SCENES HOLD (option (c), the owner's choice of 16.11.2026; docs/dev/e43/SCENES.md), read on
           p1's own page. A scene of the scenario's own holds a "Dorm A" too. A completed public project in Dorm A with an action:
           p1's Facilities rows for Aiko in Floor 1's Dorm A offer it; the GM picks the second scene for its room (the editor's
           change, projects.mjs `projectEditChange`), and p1's rows no longer offer it there; Aiko's only shown token put in the
           second scene's Dorm A, p1's rows offer it and p1's use is carried out by the GM. The road e53's probe could not read
           ("the harness's scene clone answered the original's id"): this scene is made with an id of its own. */
        phase("facilities on two scenes");
        const twoLabel = "E39 99 facility on two scenes";
        const two = await gm.eval(`const P = ${imp("projects.mjs")}, F = ${imp("facilities.mjs")}, R = ${imp("rooms.mjs")};
            const other = await Scene.create({ name: "E39 99 a second floor with a Dorm A", width: 2000, height: 1000, grid: { size: 100 }, active: false, navigation: false });
            await other.createEmbeddedDocuments("Region", [{ name: "Dorm A", shapes: [{ type: "rectangle", x: 0, y: 0, width: 800, height: 800 }],
                flags: { "danganronpa-rpg": { [R.ROOM_FLAG]: true } }, behaviors: [] }]);
            globalThis.__s99two = { scene: other.id, hidden: canvas.scene.tokens.get("TOKAIKO000000000")?.hidden ?? false };
            const id = (await P.createProject({ name: ${J(twoLabel)}, target: 1, room: "Dorm A" }))?.id ?? null;
            await F.setProjectFacility(id, { label: ${J(twoLabel)}, costsAction: false, limit: "none" });
            await P.addProgress(id, 1);
            return { id, scene: other.id, choices: P.roomSceneChoices("Dorm A").scenes.length };`, { timeout: 60000 });
        await settle(1200);
        const rowOnP1 = () => p1.eval(`return (${imp("action-facilities.mjs")}).facilitiesRows(game.actors.get("${IDS.aiko}")).some(r => r.label === ${J(twoLabel)});`);
        const twoRead = { choices: two.choices, before: await rowOnP1() };
        await gm.eval(`const P = ${imp("projects.mjs")};
            await P.applyProjectChange(${J(two.id)}, P.projectEditChange({ roomScene: ${J(two.scene)} }), { by: { kind: "gm" } }); return true;`, { timeout: 60000 });
        await settle(1200);
        twoRead.picked = await p1.eval(`const P = ${imp("projects.mjs")}; return P.projectScene(${J(two.id)})?.id === ${J(two.scene)};`);
        twoRead.onFirst = await rowOnP1();
        await gm.eval(`await canvas.scene.tokens.get("TOKAIKO000000000")?.update({ hidden: true });
            await game.scenes.get(${J(two.scene)}).createEmbeddedDocuments("Token", [{ name: "Aiko", actorId: "${IDS.aiko}", actorLink: true, x: 300, y: 300, width: 1, height: 1, hidden: false }]);
            return true;`, { timeout: 60000 });
        await settle(1200);
        twoRead.onSecond = await rowOnP1();
        twoRead.used = await p1.eval(`const A = ${imp("action-facilities.mjs")};
            return Boolean((await A.useFacility(game.actors.get("${IDS.aiko}"), ${J("project:")} + ${J(two.id)}))?.success);`, { timeout: 60000 });
        check("facilities on two scenes: a project in a room two scenes hold is offered on p1 where it stood, and, once the GM picks the second scene, not there but in the second scene's room, where p1's use is carried out",
            J(twoRead) === J({ choices: 2, before: true, picked: true, onFirst: false, onSecond: true, used: true }), J(twoRead));
        /* AND THE PROPOSER'S SCENE (option B, 16.11.2026): a project Aiko proposed while her only shown token stands in the
           second scene's Dorm A (createProject with `by`, as an approval makes one) is found there, offered to p1 there, and
           not once she is back in Floor 1's Dorm A. */
        const byLabel = "E39 99 facility proposed on the second scene";
        const proposed = await gm.eval(`const P = ${imp("projects.mjs")}, F = ${imp("facilities.mjs")};
            const id = (await P.createProject({ name: ${J(byLabel)}, target: 1, room: "Dorm A", by: "${IDS.aiko}" }))?.id ?? null;
            await F.setProjectFacility(id, { label: ${J(byLabel)}, costsAction: false, limit: "none" });
            await P.addProgress(id, 1);
            return { id, found: P.roomSceneOf(id) === ${J(two.scene)}, byGm: P.roomSceneByGmOf(id) };`, { timeout: 60000 });
        await settle(1200);
        const byRow = () => p1.eval(`return (${imp("action-facilities.mjs")}).facilitiesRows(game.actors.get("${IDS.aiko}")).some(r => r.label === ${J(byLabel)});`);
        const byRead = { found: proposed.found, byGm: proposed.byGm, onSecond: await byRow() };
        await gm.eval(`for (const t of [...game.scenes.get(${J(two.scene)}).tokens].filter(t => t.actorId === "${IDS.aiko}")) await t.delete();
            await canvas.scene.tokens.get("TOKAIKO000000000")?.update({ hidden: globalThis.__s99two?.hidden ?? false });
            return true;`, { timeout: 60000 });
        await settle(1200);
        byRead.onFirst = await byRow();
        check("facilities on two scenes: a project Aiko proposed while standing on the second scene is found there, offered to p1 there, and not in Floor 1's Dorm A once she is back",
            J(byRead) === J({ found: true, byGm: false, onSecond: true, onFirst: false }), J(byRead));
        /* A SECRET PROJECT WITH A PICK (the coordinator's ask of 16.11.2026: a privacy rule gets a run). A secret project in Dorm
           A that p1 is in on, its scene picked by hand onto the second scene (`roomScene`, `roomSceneByGm`: the GMs' row while
           it is secret, projects-secrecy.mjs PROJECT_SECRET_WHILE_SECRET). Read on p2, a bystander: its projectMeta row holds
           neither field, no world setting holds `roomSceneByGm`, and p2's sight copy names no such project; on p1, the insider:
           its sight copy carries the scene, and the project stands there on p1's own page. */
        const secretLabel = "E39 99 secret project with a pick";
        const secretId = await gm.eval(`const P = ${imp("projects.mjs")};
            const id = (await P.createProject({ name: ${J(secretLabel)}, target: 3, room: "Dorm A", secret: true, viewers: ["${IDS.p1}"], trait: "body" }))?.id ?? null;
            await P.applyProjectChange(id, P.projectEditChange({ roomScene: ${J(two.scene)}, roomSceneByGm: true }), { by: { kind: "gm" } });
            return id;`, { timeout: 60000 });
        await settle(2000);
        const onGmSecret = await gm.eval(`const P = ${imp("projects.mjs")}; return [P.roomSceneOf(${J(secretId)}) === ${J(two.scene)}, P.roomSceneByGmOf(${J(secretId)})];`);
        const bystander = await p2.eval(`const S = ${imp("projects-secrecy.mjs")};
            const row = (game.settings.get("danganronpa-rpg", "projectMeta") ?? {})[${J(secretId)}] ?? null;
            // Every secret project's row of projectMeta, and every other world setting: the pick's fields stand in neither (a
            // public project's row holds them, as it holds its room; earlier checks of this phase made two such).
            const meta = game.settings.get("danganronpa-rpg", "projectMeta") ?? {};
            const secretRows = Object.values(meta).filter(r => r && typeof r === "object" && r.secret === true
                && (Object.hasOwn(r, "roomScene") || Object.hasOwn(r, "roomSceneByGm"))).length;
            // Every registered world setting by name (the storage's entries carry no readable key here), projectMeta aside.
            const others = [...game.settings.settings.values()].filter(c => c.scope === "world" && !(c.namespace === "danganronpa-rpg" && c.key === "projectMeta"))
                .map(c => { try { return JSON.stringify(game.settings.get(c.namespace, c.key) ?? null); } catch { return ""; } }).join("\\n");
            return { row: Boolean(row), fields: row ? ["roomScene", "roomSceneByGm", "room"].filter(f => Object.hasOwn(row, f)) : null,
                secretRows, elsewhere: others.includes("roomSceneByGm") || others.includes('"roomScene"'), sight: S.toldSight(${J(secretId)}) };`);
        const insider = await p1.eval(`const S = ${imp("projects-secrecy.mjs")}, P = ${imp("projects.mjs")};
            return { scene: S.toldSight(${J(secretId)})?.roomScene === ${J(two.scene)}, stands: P.projectScene(${J(secretId)})?.id === ${J(two.scene)} };`);
        check("facilities on two scenes: a secret project's picked scene is the GMs' and the insider's - p2's world holds no pick of it nor of any secret project, p2's sight copy names it not, and p1's copy carries the scene it stands on",
            J(onGmSecret) === J([true, true]) && bystander.row === true && J(bystander.fields) === J([]) && bystander.secretRows === 0 && bystander.elsewhere === false
                && bystander.sight === null
                && insider.scene === true && insider.stands === true, J({ onGmSecret, bystander, insider }));

        /* A CLOCK SET BACK BEFORE A PROJECT'S COMPLETION (P1, the owner's probe of 16.11.2026 and decision "b"): a project in
           Dorm A completed at day 3 morning with an action of one day; the GM sets the clock back to day 1 morning, as the
           owner's world was; p1's own Facilities rows for Aiko offer the action, and the clock is put back. */
        phase("facilities after the clock is set back");
        const backLabel = "E39 99 facility with the clock set back";
        const clockWas = await gm.eval(`const { SETTINGS } = ${imp("settings.mjs")}; return game.settings.get("danganronpa-rpg", SETTINGS.clock);`);
        let backRead = null, backId = null, reasonRead = null;
        try {
            // Each step heard on its own, as at a table: a clock moved and moved back inside one burst is no change at all.
            await gm.eval(`const { SETTINGS } = ${imp("settings.mjs")};
                await game.settings.set("danganronpa-rpg", SETTINGS.clock, { ...game.settings.get("danganronpa-rpg", SETTINGS.clock), day: 3, timeOfDay: "morning", eclipse: false });
                return true;`, { timeout: 60000 });
            await settle(1500);
            backId = await gm.eval(`const P = ${imp("projects.mjs")}, F = ${imp("facilities.mjs")};
                const id = (await P.createProject({ name: ${J(backLabel)}, target: 1, room: "Dorm A" }))?.id ?? null;
                await F.setProjectFacility(id, { label: ${J(backLabel)}, costsAction: false, limit: "none", lifetime: { kind: "days", n: 1 } });
                await P.addProgress(id, 1);
                return id;`, { timeout: 60000 });
            await settle(1500);
            await gm.eval(`const { SETTINGS } = ${imp("settings.mjs")};
                await game.settings.set("danganronpa-rpg", SETTINGS.clock, { ...game.settings.get("danganronpa-rpg", SETTINGS.clock), day: 1, timeOfDay: "morning" });
                return true;`, { timeout: 60000 });
            await settle(1500);
            backRead = await p1.eval(`return (${imp("action-facilities.mjs")}).facilitiesRows(game.actors.get("${IDS.aiko}")).some(r => r.label === ${J(backLabel)});`);
            /* And past its lifetime (one day from the restamp, so day 2 morning): the GM reads why (facilities.mjs
               `facilityWhyLine`), p1's own page reads no reason and no row - players see only an action that stands. */
            await gm.eval(`const { SETTINGS } = ${imp("settings.mjs")};
                await game.settings.set("danganronpa-rpg", SETTINGS.clock, { ...game.settings.get("danganronpa-rpg", SETTINGS.clock), day: 2, timeOfDay: "morning" });
                return true;`, { timeout: 60000 });
            await settle(1500);
            reasonRead = {
                gm: await gm.eval(`return (${imp("facilities.mjs")}).facilityWhyLine(${J(backId)}).includes(${J(backLabel)});`),
                p1: await p1.eval(`return [(${imp("facilities.mjs")}).facilityWhyLine(${J(backId)}),
                    (${imp("action-facilities.mjs")}).facilitiesRows(game.actors.get("${IDS.aiko}")).some(r => r.label === ${J(backLabel)})];`)
            };
        } finally {
            await gm.eval(`const { SETTINGS } = ${imp("settings.mjs")}; await game.settings.set("danganronpa-rpg", SETTINGS.clock, ${J(clockWas)}); return true;`, { timeout: 60000 }).catch(() => null);
        }
        check("facilities after the clock is set back: a project completed at day 3 morning stands in p1's Facilities once the GM sets the clock back to day 1 morning",
            backRead === true, J({ backRead }));
        check("facilities after the clock is set back: past its lifetime the GM reads why the action does not stand, and p1 reads no reason and no row",
            reasonRead?.gm === true && J(reasonRead?.p1) === J(["", false]), J({ reasonRead }));
    } finally {
        await gm.eval(`const a = game.actors.get("${IDS.aiko}"), w = globalThis.__s99was ?? {}, { SETTINGS } = ${imp("settings.mjs")};
            for (const i of a.items.filter(i => !(w.items ?? []).includes(i.id))) await i.delete();
            if (w.traits) await a.update(Object.fromEntries(Object.entries(w.traits).map(([k, v]) => ["system.traits." + k + ".value", v])));
            await a.update({ "system.resources.stress.value": w.stress ?? 0, "system.resources.hope.value": w.hope ?? 0 });
            if (Number.isFinite(w.actions)) await game.drpg.setActions(a, w.actions);
            if (w.perRoom !== undefined) await game.settings.set("danganronpa-rpg", SETTINGS.searchTokensPerRoom, w.perRoom);
            const T = ${imp("search-tokens.mjs")}; await T.clearSeasonSearchTokens();
            if (w.region) await canvas.scene.regions.get(w.region)?.delete();
            const fl = globalThis.__s99flat ?? {}, fr = globalThis.__s99frisk ?? {}, V = ${imp("vault-store.mjs")}, GS = ${imp("gm-stores.mjs")};
            for (const [id, was] of fl.stashes ?? []) { const r = canvas.scene.regions.get(id); if (!r) continue;
                if (was === null) { if (r.getFlag("danganronpa-rpg", "drpgStashes") !== undefined) await r.unsetFlag("danganronpa-rpg", "drpgStashes"); }
                else await r.setFlag("danganronpa-rpg", "drpgStashes", was); }
            if (fl.passage) { const cell = fl.passage + "/${IDS.aiko}"; if (GS.passageAccessStore.has(cell)) await GS.passageAccessStore.drop(cell); await game.drpg.passages.delete(fl.passage); }
            if (a.getFlag("danganronpa-rpg", V.VAULT_FLAGS.found) !== undefined) await a.unsetFlag("danganronpa-rpg", V.VAULT_FLAGS.found);
            if (fr.item) await game.actors.get("${IDS.botan}")?.items.get(fr.item)?.delete();
            if (fr.at) await canvas.scene.tokens.get(fr.at.id)?.update({ x: fr.at.x, y: fr.at.y }, { teleport: true, movementAction: "displace", animate: false });
            if (fr.force !== undefined) await game.settings.set("danganronpa-rpg", "friskForce", fr.force);
            (${imp("frisk.mjs")}).forgetFriskAsks();
            delete globalThis.__s99flat; delete globalThis.__s99frisk;
            const two = globalThis.__s99two;
            if (two) { await game.scenes.get(two.scene)?.delete(); await canvas.scene.tokens.get("TOKAIKO000000000")?.update({ hidden: two.hidden }); delete globalThis.__s99two; }
            const P = ${imp("projects.mjs")};
            for (const p of P.allProjects().filter(p => String(p.name ?? "").includes("E39 99"))) await P.applyProjectChange(p.id, { remove: true }, { by: { kind: "gm" } });
            return true;`, { timeout: 60000 }).catch(() => null);
        await p1.eval(`clearInterval(globalThis.__s99?.timer); delete globalThis.__s99; return true;`).catch(() => null);
    }
}
