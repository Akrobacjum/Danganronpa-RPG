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
 *     sheet-audit.mjs) - the rows that were not there before, or that counted another trace since
 *     (`times`: fix r1-G1 folds a repeat inside 30 s onto its row). Two verdicts are not flags and are kept
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
/* Its own bound, as 30 and 61 declare one (E33 fix r1-G3, 07.10.2026; review round 1's cor M6): 168.6 s at
   C5b's a2 run, 169.0 s at fix r1-G1's and 171.6 s in k1's ci set (e33run/c5b, r1g1, k1-ci: 83.log), each in
   a lane beside two others; 162-176 s over part 1's runs. Seven minutes, as 30's: the forgeries grow with
   every stage, and a hang detector is not a budget. The scenario is not shortened. */
export const timeoutMs = 420000;

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
            /* The console's warnings, which is where the GM's bridge names the sender of a request it refuses
               (bridge-guards.mjs "Refused a ... from <name>") and says a packet's number its record overruled
               (bridge-guards.mjs onRecord). utils.mjs keeps the first 60 kinds only (sessionFailures), so a run
               this long reads them here. Read by C5b's F5. */
            g.warns = []; g.warnN = 0;
            const own = console.warn;
            console.warn = function (...args) {
                try {
                    g.warns.push({ n: ++g.warnN, text: args.map(a => typeof a === "string" ? a : String(a?.message ?? a)).join(" ").slice(0, 400) });
                    if (g.warns.length > 400) g.warns.shift();
                } catch { /* a reading never stops a warning */ }
                return own.apply(this, args);
            };
        }
        return true;`;
    const MARK = `const g = globalThis.drpg83;
        g.seen = new Set(game.messages.contents.map(m => m.id)); g.told = g.refused.length; g.warnMark = g.warnN;
        if (game.user.isGM) {
            const A = await import("${SCRIPT("sheet-audit")}"), D = await import("${SCRIPT("roll-draw")}"), S = await import("${SCRIPT("gm-stores")}");
            await A.sheetAuditIdle();
            g.flags = new Set(D.rollFlags({ quiet: true }).map(r => r.rollId));
            g.writes = new Map(A.sheetWrites({ quiet: true }).map(r => [r.id, r.times ?? 1]));
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
            const flagged = D.rollFlags({ quiet: true }).filter(r => !g.flags.has(r.rollId));
            out.flags = flagged.map(r => r.character + " (" + r.action + "): " + r.flags);
            out.flagRows = flagged.map(r => ({ rollId: r.rollId, character: r.character, player: r.player, action: r.action, flags: r.flags }));
            const rows = A.sheetWrites({ quiet: true }).filter(r => g.writes.get(r.id) !== (r.times ?? 1))
                .map(r => ({ text: r.character + " " + r.verdict + " " + r.reason + ": " + r.change, verdict: r.verdict, reason: r.reason, character: r.character,
                    id: r.id, player: r.player, change: r.change, what: r.what, fresh: !g.writes.has(r.id), times: r.times ?? 1, ref: St.sheetWriteStore.entries()?.[r.id]?.ref ?? null }));
            out.rows = rows.filter(r => r.verdict !== "listed" && r.verdict !== "covered").map(r => r.text);
            out.trace = rows.filter(r => r.verdict !== "listed" && r.verdict !== "covered");
            out.warns = g.warns.filter(w => w.n > g.warnMark).map(w => w.text);
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
       trust model), and the audit judges a player's writes - so it ran is read off Aiko's Hope alone. Since fix r1-G1
       (round 1's sec m5 = cor M5) the gain the card covered has a `covered` row naming the card (sheet-audit.mjs
       keepGainRow), set aside by quietOf as every covered row is and read by L10's third check. */
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
    check("L10: the gain's covered row names Aiko's card, the Hope from 2 to 3 and no reason", Boolean(l10.card)
        && r10.gm.covered.filter(x => x.ref === l10.card).map(x => x.change + " / " + x.reason).join("|") === "system.resources.hope.value: 2 -> 3 / -",
        J({ card: l10.card, covered: r10.gm.covered }), { flow: "sheet-audit" });

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

    /*
     * Each forgery is p1's console: the module's own code called from p1's page, or the calls of Foundry and
     * Daggerheart a console has, with a packet edited on its way out where the forgery lives in a packet
     * (`EMIT` below wraps the page's socket for the one call). Four checks each, in road()'s shape: that it ran,
     * read off what the write did as it landed - a hook on p1's page (`LANDED`, F2's and F6b's), the write's own
     * return (F4c's) or the GM's record - and never off p1's page after the await, where the primary's put-back
     * can land first (k1, 07.10.2026: e33run/k1-ci/83.log read F2's flag back in place and the forgery "never
     * ran", 73/77, under three harness lanes; fix r1-G3); that it is undone on all four clients, or never
     * applied; that the GMs' trace of it names p1; and that its own trace is all that is new, counted exactly
     * (`owns`: the rows, cards and lines `own` matches, as every green run since C5b read them - e33run/c5b,
     * k1-ci and r1g1's 83.log; a repeat inside 30 s folds onto a `refused` or `forged` row, fix r1-G1, and a row
     * new since the mark counts its `times`) and nothing else - so a forgery caught twice, or one that sets off
     * what no forgery should, is red (review round 1's cor M2: until this fix `own` set a second card or row
     * aside instead of counting it).
     */
    const names = await gm.eval(`return { p1: game.users.get("${users.p1}")?.name ?? null, aiko: game.actors.get("${aiko}")?.name ?? null,
        botan: game.actors.get("${botan}")?.name ?? null };`);
    const clients = { gm, p1, p2, p3 };
    const onAll = async code => { const out = {}; for (const [who, c] of Object.entries(clients)) out[who] = await c.eval(code); return out; };
    const allAre = (on, value) => Object.values(on).every(x => J(x) === J(value));
    const p1Rows = (r, verdict, character) => r.gm.trace.filter(x => x.verdict === verdict && x.player === names.p1 && x.character === character);
    const hopeOf = id => `return game.actors.get("${id}")?.system.resources.hope.value ?? null;`;
    /* A row, card or line of the readings that a put-back of a write of Aiko's leaves: the row, the GMs' card and p1 told. */
    const putBackOwn = x => x.startsWith(`row: ${names.aiko} putBack `) || x.startsWith(`row: ${names.aiko} flagged `)
        || x.startsWith("audit card: ") || /^p1 refused: sheet\.\S+ sheetPutBack$/.test(x);
    const EMIT = edit => `const sock = game.socket, sockHad = Object.getOwnPropertyDescriptor(sock, "emit"), ownEmit = sock.emit;
        const edit = ${edit};
        sock.emit = function (channel, packet, ...rest) {
            if (channel === "module.${MOD}" && packet && typeof packet === "object") packet = edit(JSON.parse(JSON.stringify(packet)), rest) ?? packet;
            return ownEmit.call(this, channel, packet, ...rest);
        };
        const unwrap = () => { if (sockHad) Object.defineProperty(sock, "emit", sockHad); else delete sock.emit; };`;
    /* What landed on a page: each write's values as that page's updateActor hook saw them (a put-back can land
       before the update's own promise settles, so a read after it is no proof the write ever stood). */
    const LANDED = id => `const seen = [], hook = Hooks.on("updateActor", (doc, changes) => { if (doc.id === "${id}") seen.push(foundry.utils.flattenObject(changes)); });
        const landed = (path, from) => { const c = seen.slice(from).find(x => path in x); return c ? c[path] : null; };`;
    const forged = {};
    function forgery(label, what, { did, undone, trace, own = () => false, owns = 0, r, details }) {
        forged[label] = Boolean(did);
        const all = r ? quietOf(r) : ["no readings"], mine = all.filter(own), loud = all.filter(x => !own(x));
        /* A fresh row's `times` above one is the same forgery caught again inside its fold window. */
        const counted = mine.length + (r?.gm.trace ?? []).filter(x => x.fresh && own(`row: ${x.text}`)).reduce((n, x) => n + x.times - 1, 0);
        const d = J({ ...details, counted, owns, own: mine, loud, trace: r?.gm.trace ?? null, listed: r?.gm.listed ?? null, covered: r?.gm.covered ?? null }).slice(0, 2400);
        check(`${label}: it ran - ${what.ran}`, Boolean(did), d);
        check(`${label}: ${what.undone}`, Boolean(did) && Boolean(undone), d);
        check(`${label}: ${what.read ?? "traced to p1"} - ${what.trace}`, Boolean(did) && Boolean(trace), d);
        check(`${label}: its own trace exactly (${owns}) and nothing else new - no other flag, row, card, refusal or "not counted"`,
            Boolean(did) && loud.length === 0 && counted === owns, d);
        /* What the forgery left, said on every run: a check's details print only when it fails. */
        note(`${label}: its trace`, J({ counted, read: details?.landed ?? null, own: mine, rows: (r?.gm.trace ?? []).map(x => [x.player, x.verdict, x.what, x.times]),
            aside: [...(r?.gm.listed ?? []), ...(r?.gm.covered ?? [])].map(x => [x.player, x.text]) }).slice(0, 1800));
    }

    /* --------------------------- F1. Hope by actor.update --------------------------- */

    /* p1's console raises Aiko's Hope from 2 to 5 with Foundry's own update: a write of a resource of a student
       with no road under it, put back by the primary (sheet-audit.mjs, E29 C4/C5) and told to the GMs and to p1. */
    phase("F1: p1's console raises Aiko's Hope by 3", { flow: "sheet-audit" });
    await setOn(aiko, { "system.resources.hope.value": 2 });
    await settle(400);
    mark = await readings();
    const f1 = await p1.eval(`const a = game.actors.get("${aiko}"); ${LANDED(aiko)}
        let err = null;
        try { await a.update({ "system.resources.hope.value": a.system.resources.hope.value + 3 }); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        finally { Hooks.off("updateActor", hook); }
        return { wrote: landed("system.resources.hope.value", 0), err };`, { timeout: 30000 });
    const rf1 = await mark.since();
    const f1Hope = await onAll(hopeOf(aiko));
    forgery("F1", { ran: "the update landed on p1's page (Hope 5)", undone: "Aiko's Hope is 2 again on all four clients",
        trace: "a putBack row of Aiko's Hope naming p1, and the GMs' card" },
    { owns: 3, did: !f1.err && f1.wrote === 5, undone: allAre(f1Hope, 2), r: rf1, own: putBackOwn,
        trace: p1Rows(rf1, "putBack", names.aiko).some(x => /hope/.test(x.change)) && rf1.gm.audit.length >= 1, details: { f1, hope: f1Hope } });

    /* ----------------------- F1b. the Party sheet's pips ----------------------- */

    /* Daggerheart's Party sheet writes a member's Hope, Health and Stress from its pips with a plain actor.update
       (party-sheet.mjs #onToggleHope :245, #onToggleHitPoints :258, #onToggleStress :271 in Daggerheart 2.10.5):
       a pip at or below the value takes it to one less, any other sets it. The module does not use the Party (the
       owner's answer of 05.10): this is a road a player's page has, so it is guarded, not offered. p1's console
       makes the three writes as the pips compute them - Hope 2 -> 6, Health's marks 3 -> 2, Stress 2 -> 1. Measured
       on 07.10.2026 (e33run/c5b-a1/it1.log): the Hope lands and is put back; the marks and the Stress never leave
       p1's page, whose own guard takes them out of the write ("Only the GM changes that", resource-guard.mjs
       GUARDED). So the healed mark is then written past that guard, as a console can (its `drpgAutomated`
       option): flagged with Undo on the GMs' card, and the GM answers it with Undo (sheet-audit.mjs decideWrite). */
    phase("F1b: the Party sheet's pips, from p1's console, and a healed mark past p1's own guard", { flow: "sheet-audit" });
    await setOn(aiko, { "system.resources.hope.value": 2, "system.resources.hitPoints.value": 3, "system.resources.stress.value": 2 });
    await settle(400);
    mark = await readings();
    const f1b = await p1.eval(`const a = game.actors.get("${aiko}"), out = {}; ${LANDED(aiko)}
        const pip = async (path, n, options = {}) => {
            const now = foundry.utils.getProperty(a, path), from = seen.length;
            await a.update({ [path]: now >= n ? n - 1 : n }, options);
            return [now, landed(path, from)];
        };
        try {
            out.hope = await pip("system.resources.hope.value", 6);
            out.hp = await pip("system.resources.hitPoints.value", 3);
            out.stress = await pip("system.resources.stress.value", 2);
            out.healed = await pip("system.resources.hitPoints.value", 3, { drpgAutomated: true });
        } catch (e) { out.err = String(e?.message ?? e).slice(0, 200); }
        finally { Hooks.off("updateActor", hook); }
        return out;`, { timeout: 30000 });
    const rf1b = await mark.since();
    const f1bHealed = rf1b.gm.trace.find(x => x.verdict === "flagged" && /hitPoints/.test(x.change)) ?? null;
    const f1bUndo = f1bHealed ? await gm.eval(`const A = await import("${SCRIPT("sheet-audit")}");
        const r = await A.decideWrite(${J(f1bHealed.id)}, false); await A.sheetAuditIdle(); return r === null || r === undefined ? null : true;`, { timeout: 30000 }) : null;
    await settle(800);
    const f1bNow = await onAll(`const r = game.actors.get("${aiko}")?.system.resources; return [r.hope.value, r.hitPoints.value, r.stress.value];`);
    forgery("F1b", { ran: "the pips' Hope landed on p1's page (2 -> 6), its marks and Stress were taken out there, and the healed mark landed (3 -> 2)",
        undone: "the Hope put back, the healed mark undone by the GM's Undo: Hope 2, marks 3, Stress 2 on all four clients",
        trace: "a putBack row of the Hope and a flagged row of the mark, each naming p1, and the GMs' cards" },
    { owns: 5, did: !f1b.err && J([f1b.hope, f1b.hp, f1b.stress, f1b.healed]) === J([[2, 6], [3, null], [2, null], [3, 2]]),
        undone: f1bUndo === true && allAre(f1bNow, [2, 3, 2]), r: rf1b, own: putBackOwn,
        trace: p1Rows(rf1b, "putBack", names.aiko).some(x => /hope/.test(x.change)) && f1bHealed?.player === names.p1 && rf1b.gm.audit.length >= 2,
        details: { f1b, healed: f1bHealed, undo: f1bUndo, now: f1bNow } });

    /* --------------------- F2. a broken knife made whole --------------------- */

    /* The GM gives Aiko a knife and breaks it (inventory.mjs breakItem); p1's console unsets its `broken` flag. A
       module item's `broken` cleared is put back (sheet-audit.mjs ITEM_JUDGED, E29 C6). */
    phase("F2: p1's console unsets the broken flag of Aiko's broken knife", { flow: "sheet-audit" });
    const f2Set = await gm.eval(`const INV = await import("${SCRIPT("inventory")}");
        const k = await INV.grantItem(game.actors.get("${aiko}"), { name: "83 knife", category: "tool", tier: 1, override: true, quiet: true });
        if (k) await INV.breakItem(k);
        return { knife: k?.id ?? null, broken: k ? INV.isBroken(k) : null };`, { timeout: 30000 });
    await settle(600);
    mark = await readings();
    /* "It ran" is the knife as p1's updateItem hook saw it when the unset landed, as LANDED reads an actor's: the
       primary's put-back can land on p1's page before the unset's own promise settles, and the flag read after
       the await then said the unset never ran while the put-back was right (e33run/k1-ci/83.log, 07.10.2026:
       the four checks red, 73/77, under three harness lanes; 77/77 at C5b's and C6's runs - a race, not
       reproducible on demand; fix r1-G3). The hook's reading is said in the trace note (`read`) on every run. */
    const f2 = await p1.eval(`const i = game.actors.get("${aiko}").items.get(${J(f2Set.knife)}); let err = null;
        const seen = [], hook = Hooks.on("updateItem", (doc, changes) => {
            if (doc.id === ${J(f2Set.knife)} && Object.keys(changes?.flags?.["${MOD}"] ?? {}).some(k => k.replace(/^-=/, "") === "broken")) seen.push(!doc.getFlag("${MOD}", "broken"));
        });
        try { await i?.unsetFlag("${MOD}", "broken"); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        finally { Hooks.off("updateItem", hook); }
        return { whole: seen.length ? seen[0] : null, landed: seen.length, err };`, { timeout: 30000 });
    const rf2 = await mark.since();
    const f2Now = await onAll(`return Boolean(game.actors.get("${aiko}")?.items.get(${J(f2Set.knife)})?.getFlag("${MOD}", "broken"));`);
    forgery("F2", { ran: "the unset landed on p1's page (its updateItem hook read the knife whole)", undone: "the knife is broken again on all four clients",
        trace: "a putBack row of the knife's broken flag naming p1" },
    { owns: 3, did: f2Set.broken === true && !f2.err && f2.whole === true, undone: allAre(f2Now, true), r: rf2, own: putBackOwn,
        trace: p1Rows(rf2, "putBack", names.aiko).some(x => x.change.includes(`flags.${MOD}.broken`)), details: { f2Set, f2, landed: { whole: f2.whole, writes: f2.landed }, now: f2Now } });
    await gm.eval(`await game.actors.get("${aiko}").items.get(${J(f2Set.knife)})?.delete(); return true;`);

    /* ------------------ F3. Daggerheart's relay, for Botan ------------------ */

    /* p1's console sends Daggerheart's GM relay a document update for Botan, p2's student: his Hope 2 -> 4. The
       guard on the GM's client refuses a write to an actor the sender does not own (relay-guard.mjs), and since
       C5a leaves the GMs a `refused` row naming the sender. */
    phase("F3: p1's console asks Daggerheart's relay for Botan's Hope +2", { flow: "sheet-audit" });
    await setOn(botan, { "system.resources.hope.value": 2 });
    await settle(400);
    mark = await readings();
    const f3 = await p1.eval(`game.socket.emit("system.daggerheart", { action: "DhGMUpdate", data: { action: "DhGMUpdateDocument",
        uuid: game.actors.get("${botan}").uuid, data: { "system.resources.hope.value": 4 } } }); return true;`);
    await settle(1200);
    const rf3 = await mark.since();
    const f3Now = await onAll(hopeOf(botan));
    forgery("F3", { ran: "the packet left p1's page", undone: "Botan's Hope is still 2 on all four clients: nothing was written",
        trace: "a refused row naming p1 and Botan, and p1 told `relay`" },
    { owns: 2, did: f3 === true, undone: allAre(f3Now, 2), r: rf3,
        own: x => x.startsWith(`row: ${names.botan} refused `) || x === "p1 refused: daggerheart relay",
        trace: p1Rows(rf3, "refused", names.botan).some(x => x.what.includes("DhGMUpdateDocument")) && rf3.p1.refused.some(x => x[1] === "relay"),
        details: { now: f3Now } });

    /* ---------------- F5a. a drawn roll's packet, edited ---------------- */

    /* p1 throws Aiko's Eye through the module (action-rolls.mjs rollTrait); its console edits the roll.draw packet
       on its way to the GM: a + 5 after her Eye, Daggerheart's guaranteedCritical, and dice of one face. The GM
       throws its own dice and scores its own list (roll-draw.mjs onGmTerms, E29 C10, fix r2-H1): the record's dice
       are d12s, a critical only of equal dice, and the 5 is claimed, not scored - flagged to the GMs and named to p1. */
    phase("F5a: p1's roll.draw with + 5, a guaranteed critical and dice of one face", { flow: "gm-rolls-total" });
    await refill(aiko);
    mark = await readings();
    const f5a = await p1.eval(`${EMIT(`p => {
            if (p.action !== "roll.draw" || !p.roll) return p;
            const op = p.roll.terms.find(t => t.class === "OperatorTerm"), num = p.roll.terms.find(t => t.class === "NumericTerm");
            p.roll.formula = p.roll.formula + " + 5";
            p.roll.terms = [...p.roll.terms.map(t => typeof t.faces === "number" ? { ...t, faces: 1 } : t),
                { ...(op ?? { class: "OperatorTerm", evaluated: false }), operator: "+" }, { ...(num ?? { class: "NumericTerm", evaluated: false }), number: 5 }];
            p.roll.options = { ...p.roll.options, guaranteedCritical: true };
            globalThis.drpg83.edited = (globalThis.drpg83.edited ?? 0) + 1;
            return p;
        }`)}
        globalThis.drpg83.edited = 0;
        const A = await import("${SCRIPT("action-rolls")}");
        try { const r = await A.rollTrait(game.actors.get("${aiko}"), "eye", {}); return { total: r?.total ?? null, edited: globalThis.drpg83.edited }; }
        finally { unwrap(); }`, { timeout: 90000 });
    const rf5a = await mark.since();
    const f5aRow = rollsOf(rf5a, aiko)[0] ?? null;
    const f5aRecord = f5aRow ? await gm.eval(`const S = await import("${SCRIPT("gm-stores")}"), r = S.rollStore.get(${J(f5aRow.id)});
        return { total: r.total, hope: r.hope, fear: r.fear, critical: r.isCritical, dice: (r.dice ?? []).map(d => [d.faces, d.results.length]),
            claim: r.claim?.flat ?? null, scored: r.scored?.flat ?? null, flags: (r.flags ?? []).map(f => f.kind), messageId: r.messageId };`) : null;
    forgery("F5a", { ran: "the edited packet was drawn on the GM", undone: "scored without them: d12s, a critical only of equal dice, the 5 claimed and not scored",
        trace: "a rollFlags entry naming p1, and p1's \"not counted\" line" },
    { owns: 3, did: f5a.edited === 1 && rollsOf(rf5a, aiko).length === 1 && Boolean(f5aRecord),
        undone: Boolean(f5aRecord) && J(f5aRecord.dice) === J([[12, 1], [12, 1]]) && f5aRecord.critical === (f5aRecord.hope === f5aRecord.fear)
            && f5aRecord.claim - f5aRecord.scored === 5,
        trace: rf5a.gm.flagRows.some(x => x.player === names.p1 && x.character === names.aiko) && rf5a.p1.notCounted.length === 1, r: rf5a,
        own: x => x.startsWith(`flag: ${names.aiko} `) || x.startsWith("unexpected card: ") || x.startsWith("p1 not counted: "),
        details: { f5a, record: f5aRecord, flags: rf5a.gm.flagRows } });

    /* -------------- F7. a Loaded Die written into the armed Calls -------------- */

    /* p1's console writes a Loaded Die nobody paid for into Aiko's armed Calls (her pendingCall flag), then throws
       her Eye with the roll.draw packet naming it among its Calls and as its loaded mark. The entry is put back
       (sheet-audit.mjs, E29 C8, fix r2-H8's H8-6) and the GM loads no die it does not hold armed. */
    phase("F7: a Loaded Die in Aiko's armed Calls, then a roll.draw naming it", { flow: "call-arm" });
    await refill(aiko);
    const DIE = { key: "freeCrit", kind: "hope", grants: "critical", amount: null, nonce: "C5BFORGEDDIE0001" };
    const armedOf = `const f = game.actors.get("${aiko}")?.getFlag("${MOD}", "pendingCall"); return (Array.isArray(f) ? f : f ? [f] : []).some(e => e?.nonce === ${J(DIE.nonce)});`;
    mark = await readings();
    /* `wrote` is the list as p1's updateActor hook saw it land, not the flag read after the await (the put-back
       can land first: F2's note; fix r1-G3). The hook's `changes` carry the whole list, so it is read whole. */
    const f7 = await p1.eval(`const a = game.actors.get("${aiko}"), had = a.getFlag("${MOD}", "pendingCall");
        let err = null, wrote = null;
        const seen = [], hook = Hooks.on("updateActor", (doc, changes) => { if (doc.id === "${aiko}") seen.push(foundry.utils.getProperty(changes, "flags.${MOD}.pendingCall") ?? null); });
        try {
            await a.update({ "flags.${MOD}.pendingCall": [...(Array.isArray(had) ? had : had ? [had] : []), ${J(DIE)}] }, { drpgAutomated: true });
            wrote = seen.some(list => Array.isArray(list) && list.some(e => e?.nonce === ${J(DIE.nonce)}));
        } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        finally { Hooks.off("updateActor", hook); }
        ${EMIT(`p => {
            if (p.action !== "roll.draw") return p;
            p.loaded = ${J(DIE.nonce)}; p.calls = [...(Array.isArray(p.calls) ? p.calls : []), ${J(DIE.nonce)}];
            globalThis.drpg83.edited = (globalThis.drpg83.edited ?? 0) + 1;
            return p;
        }`)}
        globalThis.drpg83.edited = 0;
        const A = await import("${SCRIPT("action-rolls")}");
        try { const r = await A.rollTrait(a, "eye", {}); return { wrote, err, total: r?.total ?? null, edited: globalThis.drpg83.edited }; }
        finally { unwrap(); }`, { timeout: 90000 });
    const rf7 = await mark.since();
    const f7Row = rollsOf(rf7, aiko)[0] ?? null;
    const f7Used = f7Row ? await gm.eval(`const S = await import("${SCRIPT("gm-stores")}"), r = S.rollStore.get(${J(f7Row.id)});
        return { loaded: r.used?.loaded ?? null, calls: r.used?.calls ?? null, hope: r.hope };`) : null;
    const f7Armed = await onAll(armedOf);
    forgery("F7", { ran: "the entry landed on p1's page (its updateActor hook) and the edited packet was drawn", undone: "the entry is put back on all four clients, and the roll is not loaded",
        trace: "a putBack row of Aiko's armed Calls naming p1" },
    { owns: 3, did: f7.wrote === true && !f7.err && f7.edited === 1 && Boolean(f7Used),
        undone: allAre(f7Armed, false) && f7Used?.loaded === false && !(f7Used?.calls ?? []).includes(DIE.nonce),
        trace: p1Rows(rf7, "putBack", names.aiko).some(x => x.change.includes("pendingCall")), r: rf7, own: putBackOwn,
        details: { f7, landed: { wrote: f7.wrote }, used: f7Used, armed: f7Armed } });

    /* ------------- F4. a message carrying the GM's drawn flag ------------- */

    /* p1's console writes a duality card of Aiko's with a total of 40 and the flags the GM's draw stamps - `drawn`
       and the rollId of F5a's real record - as Daggerheart's own card is written, with Fear (4 and 9) so that a
       card read as drawn would pay the GMs a Despair. Since C5a only a GM's message is read as drawn
       (private-rolls.mjs isDrawnRoll), and the primary keeps a `forged` row and tells the GMs once. */
    phase("F4: a message with a duality roll, the drawn flag and a total of 40", { flow: "gm-rolls-total" });
    await gm.eval(`await game.drpg.setDespair(game.user.id, 2); return true;`);
    await setOn(aiko, { "system.resources.hope.value": 2 });
    await settle(400);
    const f4Was = await gm.eval(`return { despair: game.drpg.getDespair(game.user.id), hope: game.actors.get("${aiko}").system.resources.hope.value };`);
    mark = await readings();
    const f4 = await p1.eval(`const a = game.actors.get("${aiko}");
        const roll = { class: "DualityRoll", formula: "1d12 + 1d12 + 27", total: 40, evaluated: true, dHope: { total: 4 }, dFear: { total: 9 },
            dice: [{ faces: 12, total: 4, results: [{ result: 4, active: true }] }, { faces: 12, total: 9, results: [{ result: 9, active: true }] }],
            options: { actionType: "action" } };
        const m = await ChatMessage.create({ author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: a }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll }, flags: { "${MOD}": { drawn: true, rollId: ${J(f5aRow?.id ?? "C5BINVENTEDROLL1")} } } });
        return { card: m?.id ?? null };`, { timeout: 60000 });
    await settle(1500);
    const rf4 = await mark.since();
    const f4Drawn = await onAll(`const P = await import("${SCRIPT("private-rolls")}"); const m = game.messages.get(${J(f4.card ?? "none")});
        return m ? P.isDrawnRoll(m) : null;`);
    const f4Now = await gm.eval(`return { despair: game.drpg.getDespair(game.user.id), hope: game.actors.get("${aiko}").system.resources.hope.value };`);
    await p1.eval(`await game.messages.get(${J(f4.card ?? "none")})?.delete(); return true;`);
    await gm.eval(`await game.drpg.setDespair(game.user.id, ${J(season.despair)}); return true;`);
    forgery("F4", { ran: "p1's card was written, naming F5a's record", undone: "not read as drawn on any client, and nothing awarded: the GMs' Despair and Aiko's Hope unchanged",
        trace: "a forged row naming p1 and the card's flags, and one card to the GMs" },
    { owns: 2, did: Boolean(f4.card) && Boolean(f5aRow), undone: allAre(f4Drawn, false) && J(f4Now) === J(f4Was), r: rf4,
        own: x => x.startsWith(`row: ${names.aiko} forged `) || x.startsWith("audit card: "),
        trace: p1Rows(rf4, "forged", names.aiko).some(x => x.change.includes(`flags.${MOD}.drawn`) && x.change.includes(`flags.${MOD}.rollId`)) && rf4.gm.audit.length === 1,
        details: { f4, drawn: f4Drawn, was: f4Was, now: f4Now } });

    /* ------------- F4b. Daggerheart's item roll, then its Hope ------------- */

    /* p1's console writes a card as Daggerheart writes an item's action roll (baseAction.mjs prepareBaseConfig:
       `source` naming the item and the action), with Hope, and asks the relay for its Hope +1 (actor.mjs
       modifyResource) - as L10 does for a statistic's card - then asks for it a second time on the same card. Its
       dice are p1's browser's: what stands on them is layer two's open part (CLAUDE.md, the trust model; E29 2.5),
       so the first Hope stands. The plan's 2.4 has it `listed`, naming the message; measured on 07.10.2026
       (e33run/c5b-a1/it2.log) it left no row at all at c618bf9, as L10 did - C4's round-1 finding (a); since fix
       r1-G1 (round 1's sec m5 = cor M5) the GM keeps a `covered` row of the one gain the card covers, naming the
       card (sheet-audit.mjs keepGainRow), and a roll a row names covers nothing again after a reload either. What
       ties the gain to p1's card is read off that row and the second ask: refused with a `refused` row naming p1,
       and p1 told `relay`. */
    phase("F4b: a card shaped as Daggerheart's item roll, then its Hope through the relay, twice", { flow: "sheet-audit" });
    await setOn(aiko, { "system.resources.hope.value": 2 });
    await settle(400);
    mark = await readings();
    const f4b = await p1.eval(`const a = game.actors.get("${aiko}");
        const roll = { class: "DualityRoll", formula: "1d12 + 1d12", total: 13, evaluated: true, dHope: { total: 9 }, dFear: { total: 4 },
            dice: [{ faces: 12, total: 9, results: [{ result: 9, active: true }] }, { faces: 12, total: 4, results: [{ result: 4, active: true }] }],
            options: { actionType: "action" } };
        const m = await ChatMessage.create({ author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: a }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll, title: "83 knife - Strike", hasRoll: true, source: { actor: a.uuid, item: "C5BITEMROLLKNIF", action: "C5BITEMROLLACTN" } } });
        await a.modifyResource([{ key: "hope", value: 1 }]);
        return { card: m?.id ?? null };`, { timeout: 60000 });
    await settle(1200);
    const f4bOnce = await onAll(hopeOf(aiko));
    await p1.eval(`await game.actors.get("${aiko}").modifyResource([{ key: "hope", value: 1 }]); return true;`, { timeout: 60000 });
    await settle(1200);
    const rf4b = await mark.since();
    const f4bNow = await onAll(hopeOf(aiko));
    await p1.eval(`await game.messages.get(${J(f4b.card ?? "none")})?.delete(); return true;`);
    forgery("F4b", { ran: "p1's item card was written and its Hope asked twice", undone: "the first Hope stands (3 on all four clients, layer two's open part), the second is never applied",
        trace: "the card covers one gain, its covered row naming the card: the second ask leaves a refused row naming p1, and p1 told `relay`" },
    { owns: 2, did: Boolean(f4b.card), undone: allAre(f4bOnce, 3) && allAre(f4bNow, 3), r: rf4b,
        own: x => x.startsWith(`row: ${names.aiko} refused `) || x === "p1 refused: daggerheart relay",
        trace: p1Rows(rf4b, "refused", names.aiko).length === 1 && rf4b.p1.refused.some(x => x[1] === "relay")
            && rf4b.gm.covered.some(x => x.ref === f4b.card && x.player === names.p1 && x.character === names.aiko),
        details: { f4b, once: f4bOnce, now: f4bNow } });

    /* ------------- F4c. The draw's flags written onto p1's own card by update ------------- */

    /* p1's console writes a plain duality card of Aiko's, as Daggerheart does, then adds the draw's two flags to it
       with Foundry's own update, as a card's author may: the creation's check (sheet-audit.mjs onForgedCard) saw no
       flag, and until fix r1-G1 (review round 1's sec m4) nothing read the update - the card carried the flags
       untraced. The primary's `updateChatMessage` hook (onForgedUpdate) now traces it as a create is: a forged row
       naming p1 and the flags, one card to the GMs; the card is still read as nothing. Inside 30 s of F4 the row is
       F4's, counting one more and naming this card too (the fold of sec M1), which the readings count as new. */
    phase("F4c: the draw's flags added to p1's own card by update", { flow: "sheet-audit" });
    mark = await readings();
    const f4c = await p1.eval(`const a = game.actors.get("${aiko}");
        const roll = { class: "DualityRoll", formula: "1d12 + 1d12", total: 13, evaluated: true, dHope: { total: 4 }, dFear: { total: 9 },
            dice: [{ faces: 12, total: 4, results: [{ result: 4, active: true }] }, { faces: 12, total: 9, results: [{ result: 9, active: true }] }],
            options: { actionType: "action" } };
        const m = await ChatMessage.create({ author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: a }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll } });
        await new Promise(r => setTimeout(r, 600));
        const updated = await m?.update({ "flags.${MOD}.drawn": true, "flags.${MOD}.rollId": "C5BINVENTEDROLL2" }).then(() => true).catch(err => String(err?.message ?? err));
        return { card: m?.id ?? null, updated };`, { timeout: 60000 });
    await settle(1500);
    const rf4c = await mark.since();
    const f4cRead = await onAll(`const P = await import("${SCRIPT("private-rolls")}"); const m = game.messages.get(${J(f4c.card ?? "none")});
        return m ? [P.isDrawnRoll(m), P.forgedFlagsOf(m).length] : null;`);
    await p1.eval(`await game.messages.get(${J(f4c.card ?? "none")})?.delete(); return true;`);
    forgery("F4c", { ran: "p1's plain card was written and the draw's flags added to it by its author's update",
        undone: "not read as drawn on any client, its two flags read as a forgery on each",
        trace: "a forged row naming p1 and the card's flags, and one card to the GMs" },
    { owns: 2, did: Boolean(f4c.card) && f4c.updated === true, undone: allAre(f4cRead, [false, 2]), r: rf4c,
        own: x => x.startsWith(`row: ${names.aiko} forged `) || x.startsWith("audit card: "),
        trace: p1Rows(rf4c, "forged", names.aiko).some(x => x.change.includes(`flags.${MOD}.drawn`) && x.change.includes(`flags.${MOD}.rollId`)) && rf4c.gm.audit.length === 1,
        details: { f4c, read: f4cRead } });

    /* ----------- F6a. "Reroll action roll" on a drawn roll's card ----------- */

    /* Daggerheart's chat menu offers "Reroll action roll" to a GM or the card's author only (chatLog.mjs :111), and
       its click writes the card's rolls (:115-116). A drawn roll's card is the GM's (roll-draw.mjs
       writeDrawnMessage), so p1's console writes F5a's card's rolls itself, as the click would: Foundry refuses a
       player's update of a card that is not theirs, nothing reaches a GM's hook, and no row is possible. */
    phase("F6a: p1 rewrites the rolls of F5a's drawn card", { flow: "gm-rolls-total" });
    const f6aId = f5aRecord?.messageId ?? "none";
    const rollsOn = id => `const m = game.messages.get(${J(id)}); return m ? JSON.stringify(m.toObject().rolls) : null;`;
    const f6aWas = await gm.eval(rollsOn(f6aId));
    mark = await readings();
    const f6a = await p1.eval(`const P = await import("${SCRIPT("private-rolls")}"), m = game.messages.get(${J(f6aId)});
        if (!m) return null;
        const offered = Boolean(m.system?.hasRoll) && (game.user.isGM || m.isAuthor);
        const rolls = m.toObject().rolls.map(r => { const d = typeof r === "string" ? JSON.parse(r) : foundry.utils.deepClone(r); d.total = (Number(d.total) || 0) + 7;
            return typeof r === "string" ? JSON.stringify(d) : d; });
        let err = null, res;
        try { res = await m.update({ rolls }); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        return { offered, isAuthor: m.isAuthor, err, updated: Boolean(res) };`, { timeout: 30000 });
    const rf6a = await mark.since();
    const f6aGm = await gm.eval(`const P = await import("${SCRIPT("private-rolls")}"), m = game.messages.get(${J(f6aId)}); return m ? P.isDrawnRoll(m) : null;`);
    const f6aNow = await onAll(rollsOn(f6aId));
    forgery("F6a", { ran: "p1's page asked to write the rolls of a drawn card (the GM's, not p1's)", undone: "the card's rolls unchanged on all four clients",
        read: "no trace, as none can be", trace: "not offered, refused by Foundry on p1's page before any GM's hook, and no row (round 1's cor M7: it read so under \"traced to p1\")" },
    { did: Boolean(f6a) && f6aGm === true && f6a.isAuthor === false && f6aWas !== null, undone: allAre(f6aNow, f6aWas), r: rf6a,
        trace: Boolean(f6a) && f6a.offered === false && (f6a.err !== null || f6a.updated === false) && rf6a.gm.trace.length === 0,
        details: { f6a, drawnOnGm: f6aGm } });

    /* ----------- F6b. "Reroll action roll" on p1's own roll's card ----------- */

    /* p1's own card of a roll Daggerheart threw on p1's page (as L10's: 9 and 4, 13); the primary keeps its dice
       as created (reroll-receipts.mjs keep). p1's console writes its rolls with 7 more, as the menu's click would:
       the primary puts them back (judgeRewrite, E08+E28 C8) and since C5a keeps a `rewrite` row naming p1. */
    phase("F6b: p1 rewrites the rolls of Aiko's own roll's card", { flow: "gm-rolls-total" });
    const f6bCard = await p1.eval(`const a = game.actors.get("${aiko}");
        const roll = { class: "DualityRoll", formula: "1d12 + 1d12", total: 13, evaluated: true, dHope: { total: 9 }, dFear: { total: 4 },
            dice: [{ faces: 12, total: 9, results: [{ result: 9, active: true }] }, { faces: 12, total: 4, results: [{ result: 4, active: true }] }],
            options: { actionType: "action" } };
        const m = await ChatMessage.create({ author: game.user.id, speaker: ChatMessage.getSpeaker({ actor: a }), content: '<div class="dice-roll">Duality</div>',
            rolls: [roll], system: { roll } });
        return m?.id ?? null;`, { timeout: 60000 });
    const f6bKept = await gm.eval(`const K = await import("${SCRIPT("reroll-receipts")}"), end = Date.now() + 5000;
        while (!K.keptRollsOf(${J(f6bCard ?? "none")}) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        return Boolean(K.keptRollsOf(${J(f6bCard ?? "none")}));`, { timeout: 30000 });
    const f6bWas = await gm.eval(rollsOn(f6bCard ?? "none"));
    mark = await readings();
    /* Read off p1's updateChatMessage hook, as LANDED reads an actor's: the put-back lands on p1's page before
       the update's own promise settles (it3.log, 07.10.2026: a read after the update gave 13 with the rewrite row written). */
    const f6b = await p1.eval(`const m = game.messages.get(${J(f6bCard ?? "none")});
        if (!m) return null;
        const seen = [], hook = Hooks.on("updateChatMessage", (doc, changes) => { if (doc.id === m.id && "rolls" in changes) seen.push(changes.rolls); });
        const rolls = m.toObject().rolls.map(r => { const d = typeof r === "string" ? JSON.parse(r) : foundry.utils.deepClone(r); d.total = (Number(d.total) || 0) + 7;
            return typeof r === "string" ? JSON.stringify(d) : d; });
        let err = null;
        try { await m.update({ rolls }); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        await new Promise(r => setTimeout(r, 1200));
        Hooks.off("updateChatMessage", hook);
        const totalOf = list => { const r0 = (list ?? [])[0]; return (typeof r0 === "string" ? JSON.parse(r0) : r0)?.total ?? null; };
        return { err, totals: seen.map(totalOf) };`, { timeout: 30000 });
    await settle(600);
    const rf6b = await mark.since();
    const f6bNow = await onAll(rollsOn(f6bCard ?? "none"));
    await p1.eval(`await game.messages.get(${J(f6bCard ?? "none")})?.delete(); return true;`);
    forgery("F6b", { ran: "p1's rewrite (13 -> 20) landed on its page", undone: "the dice put back: the card's rolls as created on all four clients",
        trace: "a rewrite row naming p1 and Aiko, 13 -> 20" },
    { owns: 1, did: f6bKept && Boolean(f6b) && !f6b.err && f6b.totals[0] === 20, undone: f6bWas !== null && allAre(f6bNow, f6bWas), r: rf6b,
        own: x => x.startsWith(`row: ${names.aiko} rewrite `),
        trace: p1Rows(rf6b, "rewrite", names.aiko).some(x => x.change === "rolls: 13 -> 20"), details: { f6bKept, f6b } });

    /* -------- F5c and F5b. a crisis packet: an invented roll, then a total of 99 -------- */

    /* The GM opens a murder with Aiko the killer and Daichi the victim (her Body raised to 10 for the opening, as
       L9's Chie, and put back before her crisis roll); on her turn p1 takes a Finishing Blow (murder.mjs
       takeCrisisAction). p1's console edits its murder.crisis packet on its way: first the rollId, to one no
       GM drew (F5c) - refused `rollUnknown` and told to p1, the GM's warning naming p1 (bridge-guards.mjs
       rollRefusal) -; then it sends the packet it kept, with its real rollId and a total of 99 (F5b): the GM
       scores the record's total and says the 99 lost (bridge-guards.mjs onRecord, E08+E28 C17). Daichi's marks
       are cleared first, so the blow's threshold (config.mjs INCIDENT.finishingBlowPerHp, 5 a Health left) is
       one 99 clears and Aiko's own dice do not. */
    phase("F5c and F5b: Aiko's crisis packet, with an invented roll and then a total of 99", { flow: "gm-rolls-total" });
    await refill(aiko);
    await setOn(aiko, { "system.resources.stress.value": 0, "system.resources.hope.value": 2 });
    await setOn(ids.daichi, { "system.resources.hitPoints.value": 0 });
    const f5Body = await gm.eval(`const a = game.actors.get("${aiko}"), was = a.system.traits.strength.value;
        await a.update({ "system.traits.strength.value": 10 }); return was;`);
    const f5Open = await gm.eval(`const M = await import("${SCRIPT("murder")}");
        await M.openMurder({ killerId: "${aiko}", victimId: "${ids.daichi}", openingTrait: "body" });
        const end = Date.now() + 30000;
        while (M.murderState()?.stage !== "incident" && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        for (let i = 0; i < 4 && M.murderState()?.turnSide !== "killer"; i++) await M.passTurn();
        await game.actors.get("${aiko}").update({ "system.traits.strength.value": ${J(f5Body)} });
        const C = await import("${SCRIPT("config")}"), v = game.actors.get("${ids.daichi}").system.resources.hitPoints;
        return { stage: M.murderState()?.stage ?? null, turn: M.murderState()?.turnSide ?? null, threshold: (v.max - v.value) * C.INCIDENT.finishingBlowPerHp };`, { timeout: 90000 });
    /* The GM draws the crisis roll (roll.draw), so its dice are the GM's: two faces that differ and add to
       little, 2 and 3 (shim.mjs: a face is ceil((1 - u) * faces)), so the record earns neither a critical nor
       the threshold. Unrigged, it2/it3 drew a roll of 14 that killed Daichi under a threshold of 30. */
    await gm.eval(`globalThis.drpg83.dice = CONFIG.Dice.randomUniform; let i = 0; const seq = [0.85, 0.77];
        CONFIG.Dice.randomUniform = () => seq[i++ % seq.length]; return true;`);
    await settle(600);
    mark = await readings();
    const f5c = await p1.eval(`${EMIT(`(p, rest) => {
            if (p.action !== "murder.crisis") return p;
            globalThis.drpg83.crisis = { packet: JSON.parse(JSON.stringify(p)), rest: JSON.parse(JSON.stringify(rest)) };
            p.rollId = "C5BINVENTEDROLL1";
            return p;
        }`)}
        const M = await import("${SCRIPT("murder")}");
        let r = null, err = null;
        try { r = await M.takeCrisisAction(game.actors.get("${aiko}"), "finishingBlow"); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
        finally { unwrap(); }
        const kept = globalThis.drpg83.crisis ?? null;
        return { taken: Boolean(r), err, kept: kept ? { rollId: kept.packet.rollId ?? null, total: kept.packet.total ?? null } : null };`, { timeout: 120000 });
    await settle(1500);
    await gm.eval(`const g = globalThis.drpg83; if (g.dice) CONFIG.Dice.randomUniform = g.dice; delete g.dice; return true;`);
    const rf5c = await mark.since();
    const f5cAfter = await gm.eval(`const M = await import("${SCRIPT("murder")}"), S = await import("${SCRIPT("gm-stores")}");
        const r = Object.values(S.rollStore.entries() ?? {}).find(x => x?.messageId === ${J(f5c.kept?.rollId ?? "none")});
        return { stage: M.murderState()?.stage ?? null, turn: M.murderState()?.turnSide ?? null, dead: game.drpg.isDeadForGm(game.actors.get("${ids.daichi}")),
            record: r ? { total: r.total, actionKey: r.actionKey, resolved: r.resolved ?? [] } : null };`);
    forgery("F5c", { ran: "Aiko's crisis roll was drawn, and its packet left p1's page naming a roll no GM drew",
        undone: "nothing applied: the incident at the killer's turn, Daichi alive, the roll unsettled",
        trace: "rollUnknown told to p1, and the GM's warning names p1" },
    { owns: 1, did: f5Open.stage === "incident" && f5Open.turn === "killer" && Boolean(f5c.kept?.rollId) && f5cAfter.record?.actionKey === "crisis",
        undone: f5cAfter.stage === "incident" && f5cAfter.turn === "killer" && f5cAfter.dead === false && J(f5cAfter.record?.resolved) === "[]", r: rf5c,
        own: x => x === "p1 refused: murder.crisis rollUnknown",
        trace: rf5c.p1.refused.some(x => x[1] === "rollUnknown") && rf5c.gm.warns.some(w => w.includes('"murder.crisis"') && w.includes(names.p1) && /no roll the GM drew/.test(w)),
        details: { f5Open, f5c, after: f5cAfter, warns: rf5c.gm.warns } });
    mark = await readings();
    const f5b = await p1.eval(`const kept = globalThis.drpg83.crisis;
        if (!kept) return null;
        game.socket.emit("module.${MOD}", { ...kept.packet, requestId: "C5B" + foundry.utils.randomID(12), total: 99 }, ...kept.rest);
        return { rollId: kept.packet.rollId };`);
    await settle(2500);
    const rf5b = await mark.since();
    const f5bAfter = await gm.eval(`const M = await import("${SCRIPT("murder")}"), S = await import("${SCRIPT("gm-stores")}");
        const r = Object.values(S.rollStore.entries() ?? {}).find(x => x?.messageId === ${J(f5c.kept?.rollId ?? "none")});
        return { stage: M.murderState()?.stage ?? null, dead: game.drpg.isDeadForGm(game.actors.get("${ids.daichi}")),
            record: r ? { total: r.total, critical: r.isCritical ?? null, resolved: r.resolved ?? [] } : null };`);
    const f5bSaid = rf5b.gm.warns.find(w => w.includes('"murder.crisis"') && w.includes(names.p1) && w.includes("said total 99")) ?? null;
    forgery("F5b", { ran: "the kept packet went to the GM with its real rollId and a total of 99, and the GM settled the roll",
        undone: "the record's total: Daichi alive (the record's total under the blow's threshold, which 99 clears)",
        trace: "the GM's warning names p1, the 99 and the record's total" },
    { did: Boolean(f5b) && (f5bAfter.record?.resolved ?? []).includes("crisis"),
        undone: f5bAfter.dead === false && f5bAfter.record?.critical === false && (f5bAfter.record?.total ?? 99) < f5Open.threshold && f5Open.threshold <= 99, r: rf5b,
        trace: Boolean(f5bSaid) && f5bSaid.includes(`says ${f5bAfter.record?.total}`),
        details: { f5b, after: f5bAfter, threshold: f5Open.threshold, warns: rf5b.gm.warns } });
    await gm.eval(`const C = await import("${SCRIPT("chapter")}");
        await game.drpg.endMurder({ reason: "suite", followUp: false });
        for (const id of ["${aiko}", "${ids.daichi}"]) if (C.isDeadForGm(game.actors.get(id))) await C.reviveCharacter(game.actors.get(id), { quiet: true });
        await game.actors.get("${aiko}").update({ "system.resources.stress.value": 0 });
        return true;`, { timeout: 60000 });
    await settle(800);

    const forgeries = ["F1", "F1b", "F2", "F3", "F5a", "F7", "F4", "F4b", "F4c", "F6a", "F6b", "F5c", "F5b"];
    note("the forgeries that ran", J(forgeries.map(k => `${k}: ${forged[k] ? "ran" : "DID NOT RUN"}`)));
}
