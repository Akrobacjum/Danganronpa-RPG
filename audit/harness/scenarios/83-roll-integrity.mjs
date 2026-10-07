/**
 * E33 C4 (07.10.2026; the stage plan's 2.4, prep-C4): EVERY LEGAL ROAD CLEAN. Each road a player takes
 * at a table to change a roll or their own sheet - a Search and its find, a Work and a Sabotage with a
 * tool, a statistic off the sheet, an Experience, a Support beside an Obstacle, a Reroll, a Rest and a
 * Hope item, a Monocub's Confusion, the killer's three incident rolls, Daggerheart's own roll's Hope
 * through the relay and a Level Up - is driven from that player's own page, as a console would call the
 * module, and the GMs' audit must say nothing of it: no roll flagged, no write put back or flagged, no
 * whisper to the GMs, no refusal, no "not counted" line to the roller. C5b appends the forgeries
 * (F1-F7) below, read the same way; a forgery must say something, a legal road nothing.
 *
 * THE READINGS (`readings()` below), taken on every client before a road and again after it:
 *   - the GM: `rollFlags({ quiet: true })` and `sheetWrites({ quiet: true })` (roll-draw.mjs,
 *     sheet-audit.mjs) - the rows that were not there before. Two verdicts are not flags and are kept
 *     apart: `listed`, what a player may move within its bounds (E29 Q2 (a)), and `covered`, a gain that
 *     stood on a judge - a Rest, an item used, a Search's find, a price (sheet-audit.mjs `record`, E29
 *     fix r1-G4: "nothing is said") - which is how L1 and L7 read that their judge ran. The cards
 *     whispered to this GM that carry `sheetAudit` (a put back or a flagged write) or that say
 *     `DRPG.Rolls.unexpected` (roll-draw.mjs `tellUnexpected`); and the drawn rolls' records, which
 *     are what most roads' "it ran" reads.
 *   - each player: the `bridge.refused` packets sent to them (bridge-guards.mjs), and the cards
 *     whispered to them that say `DRPG.Rolls.notCounted` (roll-draw.mjs `tellRoller`).
 * Every road has two checks: that it ran - read off what it did, never off its silence, so a road that
 * did nothing is red - and that none of the readings above is new.
 *
 * A SANDBOX SCENARIO. It takes nothing of the cluster but its clients' `eval` and the callbacks (no
 * IDS, no world, no forced dice, no harness hook beyond `__dialogAuto`'s default), so it runs as
 * audit/live/sandbox-cluster.mjs runs a scenario too: the ids are read through `eval`, the dice are
 * the dice. What a road's random dice decided (a Meddle's hit, a crisis action's success) is said in
 * the details as measured; no check reads a result the dice may not give.
 *
 * DEPARTURES from the plan's wording, each for a reason measured in the code:
 *   - "p3's Obstacle": a Despair Call is the GMs' alone (calls.mjs `spendDespairCallFor` warns
 *     `despairGmOnly` on a player; 30-security's console arm of one is refused). So the GM's Monokuma
 *     arms the Obstacle on Aiko, 61 s before her roll - the grace is 60 (config.mjs `HOSTILE_GRACE`).
 *   - L3 "action and reaction": a statistic off the sheet is thrown as a reaction (roll-dialog.mjs
 *     `forceReaction`, roll-draw.mjs `onGmTerms`), and the action is the module's own roll of a
 *     statistic (action-rolls.mjs `rollTrait`). Both drawn, both Chie's.
 *   - L4's experience: the harness's roll window clicks only the chips a test forces, and this file
 *     forces nothing, so p2's page clicks the chip itself as the window opens, as a player does.
 *   - L9's crisis action: a Finishing Blow's threshold is five times the victim's Health left, which
 *     2d12 + Body does not reach on a fresh victim; where the dice do not end the incident the GM
 *     rules the blow (`resolveCrisisAction`, as 13 and 72 do), so Stage 6 opens.
 */
export const layers = ["ci", "local-gate"];

const MOD = "danganronpa-rpg";
const J = JSON.stringify;

export async function run({ gm, p1, p2, p3, check, note, phase, settle, repoUrl }) {
    const SCRIPT = name => `${repoUrl}/scripts/${name}.mjs`;
    const players = { p1, p2, p3 };

    /* ------------------------------ who is who ------------------------------ */

    phase("the cast, read through eval", { flow: "gm-rolls-total" });
    const users = {};
    for (const [who, c] of Object.entries(players)) users[who] = await c.eval(`return game.user.id;`);
    const ids = await gm.eval(`const K = await import("${SCRIPT("monokuma")}");
        const users = ${J(users)}, owns = (a, u) => (a.ownership?.[u] ?? 0) >= 3;
        const students = K.studentActors(), out = { gm: game.user.id };
        for (const [who, u] of Object.entries(users)) out[who] = students.find(a => owns(a, u))?.id ?? null;
        out.daichi = students.find(a => !Object.values(users).some(u => owns(a, u)))?.id ?? null;
        out.monokuma = game.actors.find(a => K.isMonokuma(a))?.id ?? null;
        return out;`);
    const [aiko, botan, chie] = [ids.p1, ids.p2, ids.p3];
    check("the cast: each player owns one student, an unowned student and the Monokuma are found",
        [aiko, botan, chie, ids.daichi, ids.monokuma].every(Boolean) && new Set([aiko, botan, chie, ids.daichi]).size === 4, J({ users, ids }));

    /* ----------------------------- the readings ------------------------------ */

    /*
     * `readings()` marks every client and answers `since()`, the readings' rows that are new on each.
     * C5b reads its forgeries through the same helper: `quietOf` is what a legal road must leave empty.
     */
    const INSTALL = `const g = globalThis.drpg83 ??= { refused: [] };
        if (!g.listening) {
            g.listening = true;
            game.socket.on("module.${MOD}", p => {
                if (p?.action === "bridge.refused" && (p.userId ?? game.user.id) === game.user.id) g.refused.push([p.what ?? null, p.reason ?? null]);
            });
        }
        return true;`;
    const MARK = `const g = globalThis.drpg83;
        g.seen = new Set(game.messages.contents.map(m => m.id)); g.told = g.refused.length;
        if (game.user.isGM) {
            const A = await import("${SCRIPT("sheet-audit")}"), D = await import("${SCRIPT("roll-draw")}"), S = await import("${SCRIPT("gm-stores")}");
            await A.sheetAuditIdle();
            g.flags = new Set(D.rollFlags({ quiet: true }).map(r => r.rollId));
            g.writes = new Set(A.sheetWrites({ quiet: true }).map(r => r.id));
            g.rolls = new Set(Object.keys(S.rollStore.entries() ?? {}));
        }
        return true;`;
    const SINCE = `const g = globalThis.drpg83, S = await import("${SCRIPT("secret")}");
        const template = key => new RegExp(game.i18n.localize(key).split(/\\{[^}]+\\}/)
            .map(s => s.replace(/[.*+?^$()|[\\]\\\\{}]/g, "\\\\$&")).join("[\\\\s\\\\S]*"));
        const text = html => { const d = document.createElement("div"); d.innerHTML = String(html ?? ""); return d.textContent.replace(/\\s+/g, " ").trim(); };
        const mine = game.messages.contents.filter(m => !g.seen.has(m.id) && (m.whisper ?? []).includes(game.user.id));
        const out = { refused: g.refused.slice(g.told) };
        if (game.user.isGM) {
            const A = await import("${SCRIPT("sheet-audit")}"), D = await import("${SCRIPT("roll-draw")}"), St = await import("${SCRIPT("gm-stores")}");
            await A.sheetAuditIdle();
            out.flags = D.rollFlags({ quiet: true }).filter(r => !g.flags.has(r.rollId)).map(r => r.character + " (" + r.action + "): " + r.flags);
            const rows = A.sheetWrites({ quiet: true }).filter(r => !g.writes.has(r.id))
                .map(r => ({ text: r.character + " " + r.verdict + " " + r.reason + ": " + r.change, verdict: r.verdict, reason: r.reason, character: r.character }));
            out.rows = rows.filter(r => r.verdict !== "listed" && r.verdict !== "covered").map(r => r.text);
            out.listed = rows.filter(r => r.verdict === "listed");
            out.covered = rows.filter(r => r.verdict === "covered");
            out.rolls = Object.entries(St.rollStore.entries() ?? {}).filter(([id]) => !g.rolls.has(id)).map(([id, r]) => ({ id,
                actorId: r.actorId, userId: r.userId, actionKey: r.actionKey ?? null, claimed: r.claimed, messageId: r.messageId,
                experiences: r.experiences ?? [], calls: r.used?.calls?.length ?? 0, total: r.total, versions: r.versions?.length ?? 0 }));
            const unexpected = template("DRPG.Rolls.unexpected");
            out.audit = []; out.unexpected = [];
            for (const m of mine) {
                const words = text(await S.wordsOf(m, 2000));
                if (S.cardFlag(m, "sheetAudit") ?? m.getFlag("${MOD}", "sheetAudit")) out.audit.push(words.slice(0, 200));
                else if (unexpected.test(words)) out.unexpected.push(words.slice(0, 200));
            }
        } else {
            const notCounted = template("DRPG.Rolls.notCounted");
            out.notCounted = [];
            for (const m of mine) {
                const words = text(await S.wordsOf(m, 2000));
                if (notCounted.test(words)) out.notCounted.push(words.slice(0, 200));
            }
        }
        return out;`;
    for (const c of [gm, p1, p2, p3]) await c.eval(INSTALL);
    async function readings() {
        for (const c of [gm, p1, p2, p3]) await c.eval(MARK, { timeout: 30000 });
        return {
            async since() {
                await settle(800);
                const out = { gm: await gm.eval(SINCE, { timeout: 60000 }) };
                for (const [who, c] of Object.entries(players)) out[who] = await c.eval(SINCE, { timeout: 60000 });
                return out;
            }
        };
    }
    /** Everything a legal road must not leave: [] is clean. */
    const quietOf = r => [
        ...r.gm.flags.map(x => `flag: ${x}`), ...r.gm.rows.map(x => `row: ${x}`),
        ...r.gm.audit.map(x => `audit card: ${x}`), ...r.gm.unexpected.map(x => `unexpected card: ${x}`), ...r.gm.refused.map(x => `gm refused: ${x.join(" ")}`),
        ...Object.keys(players).flatMap(w => [...r[w].refused.map(x => `${w} refused: ${x.join(" ")}`), ...r[w].notCounted.map(x => `${w} not counted: ${x}`)])
    ];
    const rollsOf = (r, actorId, actionKey) => r.gm.rolls.filter(x => x.actorId === actorId && (actionKey === undefined || x.actionKey === actionKey));
    const ran = {};
    /** The road's pair of checks: it ran (`did`, read off what it did), and nothing of the readings is new. */
    function road(label, what, did, r, details) {
        ran[label] = Boolean(did);
        const loud = r ? quietOf(r) : ["no readings"];
        check(`${label}: it ran - ${what}`, Boolean(did), J(details).slice(0, 1800));
        check(`${label}: 0 flags - no roll flagged, no write put back or flagged, no card to the GMs, no refusal, no "not counted"`,
            Boolean(did) && loud.length === 0, J({ loud, listed: r?.gm.listed ?? null, covered: r?.gm.covered ?? null, rolls: r?.gm.rolls ?? null }).slice(0, 1800));
        /* The rows set aside, said on every run: a check's details print only when it fails, and the reason a listed
           row carries (A1 read "-" on L2's Tool, a write `breakItem` makes with a reason) had no log of a green run. */
        const aside = [...(r?.gm.listed ?? []), ...(r?.gm.covered ?? [])].map(x => x.text);
        if (aside.length) note(`${label}: set aside (listed, covered)`, J(aside).slice(0, 1800));
    }

    /* Small GM-side helpers: refill a student's actions, set a resource, read the sheet. */
    const refill = id => gm.eval(`const a = game.actors.get("${id}"); await game.drpg.setActions(a, game.drpg.actionsMax(a)); return game.drpg.actionsLeft(a);`);
    const setOn = (id, patch) => gm.eval(`await game.actors.get("${id}").update(${J(patch)}); return true;`);
    const sheetOf = id => gm.eval(`const a = game.actors.get("${id}"), r = a.system.resources;
        return { hope: r.hope.value, hopeMax: r.hope.max, hp: r.hitPoints.value, hpMax: r.hitPoints.max, stress: r.stress.value, actions: r.actions.value,
            rests: a.getFlag("${MOD}", "restsTaken") ?? null, items: a.items.map(i => i.id) };`);

    phase("the season for the legal roads", { flow: "gm-rolls-total" });
    const season = await gm.eval(`await game.drpg.setMonokuma(game.actors.get("${ids.monokuma}"), true).catch(() => {});
        await game.drpg.setClock({ chapter: 1, day: 1, session: 1, timeOfDay: "morning", phase: "dailyLife" });
        await game.drpg.resetAllActions();
        await game.drpg.assign("${aiko}", game.user.id).catch(() => {});
        await game.drpg.setDespair(game.user.id, 6).catch(() => {});
        return { lock: game.settings.get("${MOD}", "lockPlayerResources"), despair: game.drpg.getDespair(game.user.id) };`, { timeout: 60000 });
    await settle(500);
    check("the season: resources locked to the GMs (the module's default), the GM's pool filled", season.lock === true && season.despair === 6, J(season));

    /* --------------------------- L1. a Search ------------------------------- */

    /* p1 searches Dorm A from Aiko's grid; the GM draws the roll and p1's page takes the find (action-rolls.mjs
       `grantDrawn`, judged by sheet-audit.mjs `searchFind`). Her Eye is raised to 10 for the road so the roll
       always earns a find (a find needs 12, config.mjs ACTIONS.search), and put back after. */
    phase("L1: p1's Search, drawn, and its find", { flow: "gm-rolls-total" });
    await refill(aiko);
    const l1Was = await gm.eval(`const a = game.actors.get("${aiko}"), was = a.system.traits.instinct.value;
        await a.update({ "system.traits.instinct.value": 10 }); return { instinct: was, items: a.items.map(i => i.id) };`);
    let mark = await readings();
    const l1 = await p1.eval(`let err = null;
        try { await game.drpg.performAction(game.actors.get("${aiko}"), "search", {}); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        return { err };`, { timeout: 90000 });
    const r1 = await mark.since();
    const l1Find = await gm.eval(`const a = game.actors.get("${aiko}"), had = new Set(${J(l1Was.items)});
        const found = a.items.filter(i => !had.has(i.id)).map(i => ({ name: i.name, tier: i.getFlag("${MOD}", "tier") ?? null }));
        await a.update({ "system.traits.instinct.value": ${J(l1Was.instinct)} }); return found;`);
    road("L1", "Aiko's Search is drawn by the GM, and her find is on her sheet and stood on the find's judge",
        !l1.err && rollsOf(r1, aiko, "search").length === 1 && l1Find.length >= 1 && r1.gm.covered.some(x => x.reason === "searchFind"),
        r1, { l1, find: l1Find, rolls: r1.gm.rolls });

    /* ---------------- the Obstacle, armed for L5 61 s before its roll ---------------- */

    phase("an Obstacle armed on Aiko by the GM's Monokuma, for L5", { flow: "call-arm" });
    const obstacle = await gm.eval(`const E = await import("${SCRIPT("call-effects")}");
        const at = Date.now();
        const r = await game.drpg.spendDespairCallFor(game.actors.get("${ids.monokuma}"), "obstacle", { choice: { target: game.actors.get("${aiko}") } });
        return { at, made: r !== null && r !== undefined, armed: E.pendingCalls(game.actors.get("${aiko}")).map(c => c.key + ":" + c.kind) };`, { timeout: 30000 });
    check("the Obstacle is armed on Aiko", obstacle.made && obstacle.armed.includes("obstacle:despair"), J(obstacle));

    /* ------------------------ L2. a Work and a Sabotage ------------------------ */

    /* p2 works on a project in the Cafeteria where Botan stands, a Tool readied, then sabotages it: two drawn rolls
       whose situation counts the tool (roll-draw.mjs `situationReading`). */
    phase("L2: p2's Work and Sabotage with a Tool", { flow: "gm-rolls-total" });
    await refill(botan);
    const l2Set = await gm.eval(`const P = await import("${SCRIPT("projects")}"), M = await import("${SCRIPT("movement")}"), U = await import("${SCRIPT("use-items")}");
        const b = game.actors.get("${botan}");
        const [tool] = await b.createEmbeddedDocuments("Item", [{ name: "83 Tool", type: "loot", flags: { "${MOD}": { category: "tool", tier: 1, [U.EQUIPPED_FLAG]: true } } }]);
        const project = (await P.createProject({ name: "83 project", target: 12, room: M.roomOfActor(b), trait: "eye" }))?.id ?? null;
        return { tool: tool?.id ?? null, project, room: M.roomOfActor(b) };`, { timeout: 30000 });
    await settle(400);
    mark = await readings();
    const l2 = await p2.eval(`const b = game.actors.get("${botan}"), out = {};
        for (const key of ["project", "sabotage"]) {
            try { const r = await game.drpg.performAction(b, key, {}); out[key] = r ? "done" : null; } catch (e) { out[key] = "threw: " + String(e?.message ?? e).slice(0, 160); }
        }
        return out;`, { timeout: 180000 });
    const r2 = await mark.since();
    await gm.eval(`const P = await import("${SCRIPT("projects")}");
        await P.deleteProject("${l2Set.project}").catch(() => {});
        await game.actors.get("${botan}").items.get("${l2Set.tool}")?.delete(); return true;`, { timeout: 30000 });
    road("L2", "Botan's Work and Sabotage are both drawn by the GM", rollsOf(r2, botan, "project").length === 1 && rollsOf(r2, botan, "sabotage").length === 1,
        r2, { l2Set, l2, rolls: r2.gm.rolls });

    /* -------------------- L3. a statistic off the sheet ---------------------- */

    /* p3 throws Chie's Strength from her sheet (Daggerheart's road, a reaction, drawn and claimed false), then the
       module's roll of her Body (an action). H4: the roller's page keeps the card's subject, Chie. */
    phase("L3: p3's statistic off the sheet, a reaction, and an action", { flow: "gm-rolls-total" });
    mark = await readings();
    const l3 = await p3.eval(`const A = await import("${SCRIPT("action-rolls")}"), P = await import("${SCRIPT("private-rolls")}");
        const c = game.actors.get("${chie}");
        const sheet = await c.rollTrait("strength", {});
        const action = await A.rollTrait(c, "body", {});
        const sheetId = sheet?.message?.id ?? null, actionId = action?.raw?.message?.id ?? null;
        return { sheetId, actionId, sheetSubject: P.keptRollSubject(game.messages.get(sheetId ?? "")), actionSubject: P.keptRollSubject(game.messages.get(actionId ?? "")) };`, { timeout: 120000 });
    const r3 = await mark.since();
    const l3Rolls = rollsOf(r3, chie);
    road("L3", "Chie's statistic off the sheet (claimed false) and her action (claimed) are drawn, and her page keeps the sheet card's subject",
        l3Rolls.some(x => x.claimed === false) && l3Rolls.some(x => x.claimed === true) && l3.sheetSubject === chie, r3, { l3, rolls: l3Rolls });

    /* ---------------------- L4. an Experience, bought ------------------------- */

    /* p2 asks for an Experience Call from Botan's sheet (calls.mjs `spendHopeCall`); the GM says yes on the card in
       p2's thread (gm-bridge.mjs `answerHopeCall`), which buys and arms it on the GM; p2 then throws Botan's Eye and
       clicks his experience's chip as the window opens. */
    const experienceRoad = async label => {
        await refill(botan);
        await setOn(botan, { "system.resources.hope.value": 3 });
        await settle(300);
        const m = await readings();
        const asked = p2.eval(`const C = await import("${SCRIPT("calls")}");
            const r = await C.spendHopeCall(game.actors.get("${botan}"), "experience", { note: "83: Night Owl, in the small hours" });
            return r ? r.label ?? true : null;`, { timeout: 90000 });
        await settle(1500);
        const yes = await gm.eval(`const S = await import("${SCRIPT("secret")}"), B = await import("${SCRIPT("gm-bridge")}");
            for (const m of game.drpg.messengerThreadMessages("${users.p2}").slice().reverse()) {
                const hit = S.contentOf(m).match(/data-drpg-call="approveCall"([^>]*)>/);
                if (!hit) continue;
                const rid = hit[1].match(/data-rid="([^"]+)"/)?.[1], asker = hit[1].match(/data-asker="([^"]+)"/)?.[1];
                return { found: true, sent: Boolean(await B.answerHopeCall(rid, asker, true)) };
            }
            return { found: false };`, { timeout: 30000 });
        const bought = await asked;
        const rolled = await p2.eval(`const A = await import("${SCRIPT("action-rolls")}");
            const b = game.actors.get("${botan}"), key = Object.keys(b.system.experiences ?? {})[0] ?? null;
            let clicked = false;
            const hook = Hooks.on("renderApplicationV2", app => {
                if (clicked || !app.element?.classList?.contains("roll-selection")) return;
                const chip = [...app.element.querySelectorAll('[data-action="selectExperience"]')].find(x => x.dataset.key === key);
                if (chip) { clicked = true; chip.click(); }
            });
            try { const r = await A.rollTrait(b, "eye", {}); return { key, clicked, total: r?.total ?? null }; }
            finally { Hooks.off("renderApplicationV2", hook); }`, { timeout: 90000 });
        const r = await m.since();
        const rows = rollsOf(r, botan);
        road(label, "Botan's Experience is bought on the GM and counted on the roll that follows",
            yes.found && bought !== null && rolled.clicked && rows.length === 1 && rows[0].experiences.length === 1 && rows[0].calls >= 1,
            r, { yes, bought, rolled, rows });
    };
    phase("L4: p2's Experience, bought on the GM, and its roll", { flow: "call-arm" });
    await experienceRoad("L4");

    /* ------------------- L7. a Short Rest and a tier-3 item ------------------- */

    /* The GM makes Dorm B, where Chie stands, a room for a Short Rest, marks 3 of her Health, sets her Hope to 1 and
       gives her a tier-3 Hope item (config.mjs USABLE_EFFECTS[3]: 2 Health or Sanity and 2 Hope). p3 rests -
       Breath, 1 Hope - and uses the item on her Health, the two windows answered on p3's page. */
    const restRoad = async label => {
        const set = await gm.eval(`const INV = await import("${SCRIPT("inventory")}"), M = await import("${SCRIPT("movement")}"), REST = await import("${SCRIPT("rest")}");
            const c = game.actors.get("${chie}"), room = M.roomOfActor(c), roomWas = room ? REST.restRooms("short").includes(room) : null;
            if (room && !roomWas) await REST.setRestRoom(room, { short: true });
            await game.drpg.setActions(c, game.drpg.actionsMax(c));
            await c.update({ "system.resources.hitPoints.value": 3, "system.resources.hope.value": 1 });
            if (c.getFlag("${MOD}", "restsTaken")) await c.unsetFlag("${MOD}", "restsTaken");
            const kit = await INV.grantItem(c, { name: "83 tier-3 kit", category: "usable", tier: 3, override: true, quiet: true });
            return { room, roomWas, kit: kit?.id ?? null };`, { timeout: 30000 });
        await settle(400);
        const before = await sheetOf(chie);
        const m = await readings();
        const done = await p3.eval(`const R = await import("${SCRIPT("rest")}"), U = await import("${SCRIPT("use-items")}");
            const D = foundry.applications.api.DialogV2, c = game.actors.get("${chie}");
            const own = { wait: Object.getOwnPropertyDescriptor(D, "wait"), confirm: Object.getOwnPropertyDescriptor(D, "confirm") };
            const answers = [["breath"], "hitPoints"];
            D.wait = async () => answers.shift() ?? null; D.confirm = async () => true;
            try {
                const rest = await R.takeRest(c, "short", { quiet: true });
                const used = await U.useItem(c, c.items.get("${set.kit}"));
                return { rested: Boolean(rest), used: used ?? null };
            } finally {
                for (const k of ["wait", "confirm"]) { if (own[k]) Object.defineProperty(D, k, own[k]); else delete D[k]; }
            }`, { timeout: 60000 });
        const r = await m.since();
        const after = await sheetOf(chie);
        await gm.eval(`const REST = await import("${SCRIPT("rest")}");
            if (${J(set.room)} && !${J(set.roomWas)}) await REST.setRestRoom(${J(set.room)}, { short: false });
            await game.actors.get("${chie}").items.get("${set.kit}")?.delete(); return true;`, { timeout: 30000 });
        road(label, "Chie's Short Rest takes its Breath (1 Hope) and her tier-3 item heals 2 Health and gives 2 Hope, each standing on its judge",
            done.rested && after.hope - before.hope === 3 && before.hp - after.hp === 2 && Boolean(after.rests?.short)
                && ["rest", "itemUse"].every(k => r.gm.covered.some(x => x.reason === k)),
            r, { set, done, before: { ...before, items: undefined }, after: { ...after, items: undefined } });
    };
    phase("L7: p3's Short Rest (Breath) and a tier-3 Hope item", { flow: "sheet-audit" });
    await restRoad("L7");

    /* ------------------------ L11. a Level Up ------------------------ */

    /* The GM offers Botan a Standard Level Up; p2 takes +1 Health from his sheet (gm-bridge.mjs `requestAdvancement`),
       which the GM applies (level-up.mjs `applyAdvancement`). */
    phase("L11: a Level Up p2 takes and the GM applies", { flow: "sheet-audit" });
    const l11Was = await sheetOf(botan);
    const offered = await gm.eval(`const L = await import("${SCRIPT("level-up")}");
        return Boolean(await L.offerAdvancement(game.actors.get("${botan}"), "standard"));`, { timeout: 30000 });
    await settle(600);
    mark = await readings();
    const l11 = await p2.eval(`const B = await import("${SCRIPT("gm-bridge")}");
        const res = await B.requestAdvancement({ actorId: "${botan}", picks: [{ option: "hp" }], kind: "standard" });
        return { ok: Boolean(res?.ok), reason: res?.reason ?? null };`, { timeout: 60000 });
    const r11 = await mark.since();
    const l11Now = await sheetOf(botan);
    road("L11", "Botan's Level Up is applied on the GM: his Health is one higher", offered && l11.ok && l11Now.hpMax === l11Was.hpMax + 1,
        r11, { offered, l11, hpMax: [l11Was.hpMax, l11Now.hpMax] });

    /* ---------------- L5. a Support and the Obstacle, then the roll ---------------- */

    /* Botan joins Aiko in Dorm A (the GM moves his token: a Support is given in the same room) and p2 gives her a
       Support from his sheet; p1 then throws Aiko's Eye, past the Obstacle's grace, so both Calls are on the roll. */
    phase("L5: p2's Support on Aiko beside the Obstacle armed 61 s before, then p1's roll", { flow: "call-arm" });
    const l5Set = await gm.eval(`const t = canvas.scene.tokens.find(x => x.actorId === "${botan}"), a = canvas.scene.tokens.find(x => x.actorId === "${aiko}");
        const was = t ? { x: t.x, y: t.y } : null;
        if (t && a) await t.update({ x: a.x + 200, y: a.y });
        await game.actors.get("${botan}").update({ "system.resources.hope.value": 3 });
        return { botanToken: t?.id ?? null, was };`, { timeout: 30000 });
    await refill(aiko);
    while (Date.now() < obstacle.at + 61_000) await settle(500);
    mark = await readings();
    const l5Support = await p2.eval(`const C = await import("${SCRIPT("calls")}");
        const r = await C.spendHopeCall(game.actors.get("${botan}"), "support", { choice: { target: game.actors.get("${aiko}") } });
        return r ? r.label ?? true : null;`, { timeout: 60000 });
    await settle(800);
    const l5Roll = await p1.eval(`const A = await import("${SCRIPT("action-rolls")}");
        const r = await A.rollTrait(game.actors.get("${aiko}"), "eye", {}); return { total: r?.total ?? null };`, { timeout: 90000 });
    const r5 = await mark.since();
    const l5Rows = rollsOf(r5, aiko);
    road("L5", "Aiko's roll is drawn with both Calls spent on it - Botan's Support and the Obstacle past its grace",
        l5Support !== null && l5Rows.length === 1 && l5Rows[0].calls === 2, r5, { secondsSinceObstacle: (Date.now() - obstacle.at) / 1000, l5Support, l5Roll, rows: l5Rows });

    /* ---------------------------- L6. a Reroll ---------------------------- */

    /* p1 asks for a Reroll of Aiko's roll above from her sheet (calls.mjs `spendHopeCall`, reroll.mjs on the GM). */
    phase("L6: p1's Reroll of Aiko's last drawn roll", { flow: "gm-rolls-total" });
    await setOn(aiko, { "system.resources.hope.value": 4 });
    await settle(300);
    const l6Was = await sheetOf(aiko);
    /* The harness's message hands back its rolls as the harness's own JSON, with no `Roll#reroll` (lib/shim.mjs
       `rolls`; its stored shape, measured on 07.10.2026 in e33run/scratch/c4/logs/probe1.log, has no terms for
       Daggerheart's `fromData` either), and a Reroll refuses a roll it cannot throw again (reroll.mjs, "that message
       holds no roll to throw again" - r1.log). Where that is so, and only there, the GM's page reads the kept roll as
       40-flow's `REROLL_ARM` does: a stand-in with the drawn faces, thrown again on fresh random faces. At a table
       the message holds Foundry's rolls and nothing is lent. */
    const l6Rolls = await gm.eval(`const S = await import("${SCRIPT("gm-stores")}"), row = S.rerollBookmarkStore.get("${aiko}");
        const m = game.messages.get(row?.messageId ?? "");
        if (!m || typeof m.rolls?.[0]?.reroll === "function") return { messageId: m?.id ?? null, lent: false };
        const d = m.rolls[0] ?? {}, face = () => 1 + Math.floor(Math.random() * 12);
        class Thrown {
            constructor(formula, data = {}, options = {}) { this._formula = formula; this.options = options; this.faces = { hope: d.dHope?.total ?? face(), fear: d.dFear?.total ?? face() }; }
            get dHope() { return { total: this.faces.hope }; } get dFear() { return { total: this.faces.fear }; }
            get total() { return this.faces.hope + this.faces.fear; }
            get withHope() { return this.faces.hope > this.faces.fear; } get withFear() { return this.faces.hope < this.faces.fear; }
            get isCritical() { return this.faces.hope === this.faces.fear; }
            async reroll() { const r = new Thrown(this._formula, {}, this.options); r.faces = { hope: face(), fear: face() }; return r; }
            toJSON() { return { class: "DualityRoll", formula: this._formula, total: this.total, evaluated: true }; }
        }
        Object.defineProperty(m, "rolls", { configurable: true, get: () => [new Thrown(d.formula ?? "1d12 + 1d12", {}, d.options ?? {})] });
        return { messageId: m.id, lent: true, isLastRoll: m.id === ${J(l5Rows[0]?.messageId ?? null)} };`);
    mark = await readings();
    const l6 = await p1.eval(`const C = await import("${SCRIPT("calls")}");
        const r = await C.spendHopeCall(game.actors.get("${aiko}"), "reroll"); return r ? r.label ?? true : null;`, { timeout: 90000 });
    const r6 = await mark.since();
    if (l6Rolls.lent) await gm.eval(`const m = game.messages.get(${J(l6Rolls.messageId)}); if (m) delete m.rolls; return true;`);
    const l6Now = await sheetOf(aiko);
    const l6Row = await gm.eval(`const S = await import("${SCRIPT("gm-stores")}"), r = S.rollStore.get(${J(l5Rows[0]?.id ?? "none")});
        return r ? { versions: r.versions?.length ?? 0, total: r.total } : null;`);
    road("L6", "the Reroll is paid and made on the GM: Aiko's Hope is lower and her roll's record holds a second version",
        l6 !== null && l6Now.hope < l6Was.hope && (l6Row?.versions ?? 0) >= 1, r6, { l6, l6Rolls, hope: [l6Was.hope, l6Now.hope], row: l6Row });

    /* ----------------- L10. Daggerheart's own roll's Hope ----------------- */

    /* p1 posts Aiko's duality card as Daggerheart writes one, with Hope, and asks Daggerheart's relay for its Hope
       (actor.mjs `modifyResource`), as 20-crit-hope does. The plan wrote "listed" for it; measured on 07.10.2026
       (e33run/scratch/c4/logs/r1.log) the write leaves no row at all - it is written on the GM's client (CLAUDE.md, the
       trust model), and the audit judges a player's writes - so it ran is read off Aiko's Hope alone. */
    phase("L10: Daggerheart's own roll's Hope, through the relay", { flow: "sheet-audit" });
    await setOn(aiko, { "system.resources.hope.value": 2 });
    await settle(300);
    mark = await readings();
    const l10 = await p1.eval(`const a = game.actors.get("${aiko}");
        const roll = { class: "DualityRoll", formula: "1d12 + 1d12", total: 13, evaluated: true, dHope: { total: 9 }, dFear: { total: 4 },
            dice: [{ faces: 12, total: 9, results: [{ result: 9, active: true }] }, { faces: 12, total: 4, results: [{ result: 4, active: true }] }],
            options: { actionType: "action" } };
        const m = await ChatMessage.create({ author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: a }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll } });
        await a.modifyResource([{ key: "hope", value: 1 }]);
        return { card: m?.id ?? null };`, { timeout: 60000 });
    await settle(1200);
    const r10 = await mark.since();
    const l10Now = await sheetOf(aiko);
    await p1.eval(`await game.messages.get(${J(l10.card ?? "none")})?.delete(); return true;`);
    road("L10", "the Hope Aiko's own roll asked for lands on the GM", Boolean(l10.card) && l10Now.hope === 3,
        r10, { l10, hope: l10Now.hope, listed: r10.gm.listed, covered: r10.gm.covered });

    /* ------------ the repeats: L4 and L7 with the players' resources unlocked ------------ */

    /* E29 Q2 (a): `lockPlayerResources` off leaves a player's direct writes to the list alone; what the module's
       roads write is judged either way, so the two roads that write the most must still be silent. */
    phase("the repeats: L4 and L7 with lockPlayerResources off", { flow: "sheet-audit" });
    await gm.eval(`await game.settings.set("${MOD}", "lockPlayerResources", false); return true;`);
    await settle(600);
    try {
        await experienceRoad("L4, unlocked");
        await restRoad("L7, unlocked");
    } finally {
        await gm.eval(`await game.settings.set("${MOD}", "lockPlayerResources", ${J(season.lock)}); return true;`);
        await settle(600);
    }

    /* ------------------- L9. the killer's three rolls ------------------- */

    /* The GM opens a murder with Chie the killer and Daichi the victim, the opening's statistic the GM's pick (Body);
       p3's page throws the opening (its window answered as `__dialogAuto` answers it). On the killer's turn p3 takes
       a Finishing Blow from the crisis menu's road (murder.mjs `takeCrisisAction`; the GM presses the statistic
       card's first trait). Then, in Stage 6, p3 cleans up a trace the GM leaves in Dorm B (cleanup.mjs
       `attemptCleanup`). Every one of the three is drawn on the GM at the turn its ticket names (fix r2-H1). Her Body
       (Daggerheart's Strength, config.mjs TRAITS) is raised to 10 for the road and put back after: the opening fails under
       8 (config.mjs MURDER_OPENING) and a failed one ends the murder with no incident - two of five offline runs
       on 07.10.2026 did that (the GM's warning "No incident, and the victim never learns anything was attempted"). */
    phase("L9: the killer's opening, a crisis action and a Stage 6 clean-up", { flow: "gm-rolls-total" });
    await refill(chie);
    await setOn(chie, { "system.resources.stress.value": 0, "system.resources.hope.value": 2 });
    const l9Body = await gm.eval(`const c = game.actors.get("${chie}"), was = c.system.traits.strength.value;
        await c.update({ "system.traits.strength.value": 10 }); return was;`);
    mark = await readings();
    const l9Open = await gm.eval(`const M = await import("${SCRIPT("murder")}");
        await M.openMurder({ killerId: "${chie}", victimId: "${ids.daichi}", openingTrait: "body" });
        const end = Date.now() + 30000;
        while (M.murderState()?.stage !== "incident" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        for (let i = 0; i < 4 && M.murderState()?.turnSide !== "killer"; i++) await M.passTurn();
        return { stage: M.murderState()?.stage ?? null, turn: M.murderState()?.turnSide ?? null };`, { timeout: 90000 });
    const l9Crisis = await p3.eval(`const M = await import("${SCRIPT("murder")}");
        let r = null, err = null;
        try { r = await M.takeCrisisAction(game.actors.get("${chie}"), "finishingBlow"); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        return { taken: Boolean(r), err };`, { timeout: 120000 });
    await settle(1500);
    const l9Ruled = await gm.eval(`const M = await import("${SCRIPT("murder")}");
        const by = M.murderState()?.stage ?? null;
        if (by === "incident") await M.resolveCrisisAction({ actorId: "${chie}", key: "finishingBlow", total: 99, isCritical: false, withHope: true });
        const end = Date.now() + 10000;
        while (M.murderState()?.stage === "incident" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        const c = game.actors.get("${chie}");
        if (c.system.resources.stress.value > 3) await c.update({ "system.resources.stress.value": 0 });
        const M2 = await import("${SCRIPT("movement")}");
        const t = await game.drpg.placeRemnant({ room: M2.roomOfActor(c), type: "incident", visibility: "subtle", note: "83: Stage 6's trace" });
        return { byDice: by !== "incident", stage: M.murderState()?.stage ?? null, trace: t?.id ?? null };`, { timeout: 90000 });
    await settle(600);
    const l9Six = await p3.eval(`const Cl = await import("${SCRIPT("cleanup")}");
        let r = null, err = null;
        try { r = await Cl.attemptCleanup(game.actors.get("${chie}"), ${J(l9Ruled.trace ?? "none")}); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        return { rolled: Boolean(r?.roll), err };`, { timeout: 90000 });
    await settle(1500);
    const r9 = await mark.since();
    await gm.eval(`const C = await import("${SCRIPT("chapter")}");
        await game.drpg.endMurder({ reason: "suite", followUp: false });
        for (const id of ["${chie}", "${ids.daichi}", "${aiko}", "${botan}"]) if (C.isDeadForGm(game.actors.get(id))) await C.reviveCharacter(game.actors.get(id), { quiet: true });
        await game.actors.get("${chie}").update({ "system.resources.stress.value": 0, "system.traits.strength.value": ${J(l9Body)} });
        return true;`, { timeout: 60000 });
    await settle(800);
    const l9Keys = rollsOf(r9, chie).map(x => x.actionKey);
    road("L9", "Chie's opening, Finishing Blow and Stage 6 clean-up are each drawn on the GM",
        l9Open.stage === "incident" && l9Open.turn === "killer" && l9Crisis.taken && l9Six.rolled
            && ["murderOpening", "crisis", "cleanup"].every(k => l9Keys.includes(k)),
        r9, { l9Open, l9Crisis, l9Ruled, l9Six, keys: l9Keys });

    /* --------------------- L8. a Monocub's Confusion --------------------- */

    /* The GM marks Botan dead and makes him a Monocub, in Dorm A beside Aiko, with an action and a Hope; p2 helps
       Aiko through Confusion (monocub.mjs `performMeddle`; the GM throws and scores it), and p1 throws her Eye. A
       Meddle under 12 arms nothing (config.mjs MONOCUB.meddle): the details say what the dice gave. */
    phase("L8: a Monocub's Confusion on Aiko, then p1's roll", { flow: "monocub-meddle" });
    const l8Set = await gm.eval(`const C = await import("${SCRIPT("chapter")}"), Mc = await import("${SCRIPT("monocub")}");
        const b = game.actors.get("${botan}");
        await C.markDeceased(b);
        const made = Boolean(await Mc.setMonocub(b, true));
        await game.drpg.setActions(b, game.drpg.actionsMax(b));
        await b.update({ "system.resources.hope.value": 2 });
        return { made };`, { timeout: 60000 });
    await refill(aiko);
    await settle(800);
    mark = await readings();
    /* Until A2 of E33 C4 this road lent p2's page a `Roll#getTooltip`, which the Monocub's card reads (monocub.mjs
       `postMeddleRoll`) and the harness's Roll lacked; lib/shim.mjs's Roll has its own since, so nothing is lent. */
    const l8Meddle = await p2.eval(`const Mc = await import("${SCRIPT("monocub")}");
        const r = await Mc.performMeddle(game.actors.get("${botan}"), "${aiko}", true);
        return r ? { total: r.total, isCritical: r.isCritical } : null;`, { timeout: 60000 });
    await settle(800);
    const l8Armed = await gm.eval(`const E = await import("${SCRIPT("call-effects")}");
        return E.pendingCalls(game.actors.get("${aiko}")).map(c => c.key + ":" + c.grants);`);
    const l8Roll = await p1.eval(`const A = await import("${SCRIPT("action-rolls")}");
        const r = await A.rollTrait(game.actors.get("${aiko}"), "eye", {}); return { total: r?.total ?? null };`, { timeout: 90000 });
    const r8 = await mark.since();
    await gm.eval(`const C = await import("${SCRIPT("chapter")}"), Mc = await import("${SCRIPT("monocub")}");
        const b = game.actors.get("${botan}");
        await Mc.setMonocub(b, false);
        if (C.isDeadForGm(b)) await C.reviveCharacter(b, { quiet: true });
        const t = canvas.scene.tokens.get(${J(l5Set.botanToken ?? "none")});
        if (t && ${J(Boolean(l5Set.was))}) await t.update(${J(l5Set.was ?? {})});
        return true;`, { timeout: 60000 });
    const l8Rows = rollsOf(r8, aiko);
    road("L8", "the Monocub's Confusion is thrown on the GM, and Aiko's roll after it is drawn with what it armed",
        l8Set.made && l8Meddle !== null && l8Rows.length === 1 && l8Rows[0].calls === l8Armed.length,
        r8, { l8Set, l8Meddle, armed: l8Armed, l8Roll, rows: l8Rows });

    const roads = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L4, unlocked", "L7, unlocked"];
    note("the legal roads that ran", J(roads.map(k => `${k}: ${ran[k] ? "ran" : "DID NOT RUN"}`)));

    /* ======================================================================================================
     * C5b: THE FORGERIES (F1-F7). Appended here, each read with `readings()` and `quietOf` as the roads above:
     * a forgery's readings must name it where a legal road's are empty.
     * ====================================================================================================== */
}
