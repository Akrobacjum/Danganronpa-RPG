/**
 * Every legal road through the GM bridge, and what a player is told when one is not carried out
 * (E31, 25.09.2026; audit S17-08, S17-09).
 *
 * Stage E31 moves every request a player's client sends the primary GM into one table judged by
 * one runner (scripts/bridge-guards.mjs), and every wait for an answer into one function. A wrong
 * guard in that table refuses a legal packet for every action at once, so the legal roads are
 * measured here first, on the tree before the refactor, and stay green after each of its commits:
 *   A  legal paths: a Reroll's undos in the order reroll.mjs sent them from the roller's browser
 *      until E08+E28 C8 - each refused from a player since, as the GM's own (A1-A5) - an
 *      Assistant GM (beside the GM, and as the primary once the GM has gone), and
 *      the shapes Daggerheart's own relay sends for a player. Each lands once, the GM logs no
 *      refusal for it, and its asker is told none. Since E06 C5a also a roll's subject, reported by
 *      its roller for a roll whose document names nobody, and two reports that are not the
 *      sender's to make (A10), and since E08+E28 C8 a rewrite of its rolls put back. Since E32+E07 C11b also a crisis action's statistic, put to the GMs
 *      by its own player and picked on the card (A11). Since E08+E28 C2 also a roll's bookmark for the
 *      Reroll, kept on the GMs from its roller's report (A12).
 *   B  what E31 adds, each written red (`expectedRed`, with what it measured) until the commit that
 *      made it so, and a plain check since: a refusal carries its reason, in the player's own
 *      language; a refused request is not acknowledged; an exception on the GM's side ends as one
 *      refusal the player hears; a GM who is connected and silent is reported when the
 *      acknowledgement does not come; the trap relay reaches the GMs only; a refused search is told
 *      once.
 *   C  with no GM connected, three requests settle at once, send nothing and say the same thing; and
 *      a pre-session note, which is kept on the player's browser until a GM connects (E05).
 *   D  no exception escaped into Foundry on any client (until E31's runner, the two B injects were excused).
 * The two exceptions are injected through world objects the handlers write - Aiko's token's
 * `update` for the send-back, `game.settings.set` for the sabotage - so the same injection works
 * before the table exists and after it.
 *
 * NOT MEASURED HERE: a real Reroll (`Roll#reroll` is not in the harness; until E08+E28 C8 a
 * receipt was made as 30-security made one, by rewriting the rolls of the player's own roll
 * message), and the crisis, clean-up and Analyze undos, which need a running incident or a
 * bullet - live check 21 and LIVE-E31-01 in audit/AUDIT-1.2.42.md 9.2.
 */
export const layers = ["ci"];
export const accounts = [{ who: "ag", id: "USERAG0000000000", name: "Assistant", role: 3, character: null, color: "#aa66ff" }];

const MOD = "danganronpa-rpg";
const SOCKET = `module.${MOD}`;
const DH = "system.daggerheart";

/** A request's answer that is not a failure, in the shapes before E31 (`{ pending }`, a value) and after (`{ ok }`). */
const notFailed = answer => answer !== null && answer !== undefined && answer !== false && answer?.ok !== false;

export async function run({ gm, ag, p1, p2, p3, check, phase, settle, opLog, settingLog, socketTraffic, disconnect, IDS, repoUrl }) {
    const players = [p1, p2, p3];
    const utils = `(await import("${repoUrl}/scripts/utils.mjs"))`;
    const bridge = `(await import("${repoUrl}/scripts/gm-bridge.mjs"))`;
    const projects = `(await import("${repoUrl}/scripts/projects.mjs"))`;
    const toGms = `{ recipients: game.users.filter(u => u.isGM && u.active).map(u => u.id) }`;

    /* ------------------------------------------------------------------ helpers */

    // Every refusal a player's client is sent, with the reason code once E31 C4 carries one.
    for (const c of players) {
        await c.eval(`globalThis.__e31Refused = [];
            game.socket.on("${SOCKET}", (payload, senderId) => {
                if (payload?.action !== "bridge.refused" || payload.userId !== game.user.id) return;
                globalThis.__e31Refused.push({ what: payload.what ?? null, requestId: payload.requestId ?? null,
                    reason: payload.reason ?? null, from: senderId, at: Date.now() });
            });
            return true;`);
    }
    const refusedCount = c => c.eval(`return globalThis.__e31Refused.length;`);
    const refusedSince = (c, n = 0) => c.eval(`return globalThis.__e31Refused.slice(${n});`);
    const noticeCount = c => c.eval(`return globalThis.__notifications.length;`);
    const noticesSince = (c, n) => c.eval(`return globalThis.__notifications.slice(${n}).map(x => ({ level: x.level, msg: x.msg, at: x.at }));`);
    const clearFailures = host => host.eval(`${utils}.clearSessionFailures(); return true;`);
    const refusalsLogged = (host, action) => host.eval(`return ${utils}.sessionFailures()
        .filter(e => e.message.includes('Refused a "${action}"')).map(e => e.message);`);
    const errorsOf = c => c.eval(`return (globalThis.__errors ?? []).map(e => e.where + ": " + e.message);`);
    /** A roll message of the player's own character, then its rolls rewritten - a Reroll's receipt until E08+E28 C8 (30-security's `rerollOn`). */
    const rerollOn = (client, actorId, { fearBefore = false, fearAfter = false } = {}) => client.eval(`
        const roll = fear => ({ class: "DualityRoll", formula: "1d12 + 1d12", total: 14,
            dHope: { total: fear ? 3 : 9 }, dFear: { total: fear ? 9 : 3 } });
        const m = await ChatMessage.create({ speaker: { actor: "${actorId}" }, content: "roll",
            rolls: [JSON.stringify(roll(${fearBefore}))] });
        await new Promise(r => setTimeout(r, 200));
        await m.update({ rolls: [JSON.stringify(roll(${fearAfter}))] });
        return m.id;`, { timeout: 30000 });
    /** An action of `actorId`'s paid on its player's browser, as an action pays before its roll - since E08+E28 fix r2-H1 the
        GM draws a roll only for an action whose payment it saw (roll-draw.mjs `drawRefusal`). Code for that player's eval. */
    const payFor = actorId => `{ const { spendAction, actionsLeft } = await import("${repoUrl}/scripts/actions.mjs");
        const { automatedUpdate } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const who = game.actors.get("${actorId}");
        if (actionsLeft(who) < 1) await automatedUpdate(who, { "system.resources.actions.value": 1 });
        await spendAction(who, 1, { quiet: true }); }`;
    /** One packet from p1 that its own client never sends: another player's character, in another player's name. */
    const forgeFromP1 = (action, requestId, fields) => p1.eval(`game.socket.emit("${SOCKET}",
        { action: "${action}", userId: "${IDS.p2}", requestId: "${requestId}", ...${JSON.stringify(fields)} }, ${toGms}); return true;`);
    const progressOf = id => `return { current: ${projects}.allProjects().find(p => p.id === "${id}")?.current ?? null };`;
    /* A PLAYER'S SABOTAGE NAMES ITS ROLL (E08+E28 C16, 04.10.2026): the GM makes the repair the GMs' record
       of that roll earned (gm-bridge.mjs `repairOf`). Code that throws a Sabotage of `actorId`'s the GM
       draws, on faces that earn a repair, and leaves the message it wrote in `rollId`. */
    const sabotageRoll = actorId => `const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        ${payFor(actorId)}
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        let thrown = null;
        try { thrown = await A.rollTrait(game.actors.get("${actorId}"), "eye", { actionKey: "sabotage", remember: false }); }
        finally { delete globalThis.__forceRoll; }
        const rollId = thrown?.raw?.[A.DRAWN_ROLL]?.messageId ?? null;`;
    const pool = `return game.drpg.getDespair("${IDS.gm}");`;

    /* ----------------------------------------------------------------- A. setup */

    phase("setup");
    const proj = await gm.eval(`const P = ${projects};
        const one = await P.createProject({ name: "E31 public", target: 8, room: "Cafeteria", secret: false });
        const two = await P.createProject({ name: "E31 two", target: 8, room: "Gym", secret: false });
        await P.addProgress(one.id, 3);
        await P.addProgress(two.id, 3);
        await game.drpg.setDespair(game.user.id, 4);
        return { one: one.id, two: two.id };`, { timeout: 60000 });
    await settle(600);
    const start = { one: await gm.eval(progressOf(proj.one)), two: await gm.eval(progressOf(proj.two)), pool: await gm.eval(pool) };
    check("setup: two public projects at 3 progress, and the GM's pool at 4",
        start.one.current === 3 && start.two.current === 3 && start.pool === 4, JSON.stringify({ proj, start }));

    /* ------------------------------------------- A. a Reroll's undos are the GM's */

    /* Until E08+E28 C8 these were legal roads: a Reroll's undos from the roller's browser, in
       the order reroll.mjs sent them, each paid for by a receipt - a rewrite of the rolls of a
       roll of the same character (`rerollOn`). The GM makes the Reroll on its own client since
       C4a (40-flow drives it) and C8 refuses each one from a player: refused, logged, told
       `undoIsTheGms`, and nothing moved. A1 has a rewrite behind it, which pays for nothing.
       A2 keeps what it measured on the road that is left: the GM's own undo of a sabotage and
       a new one, back to back. A6, a receipt per character for a player who plays two, went
       with the receipts. */
    const UNDO = /an undo is the GM's own Reroll's/;
    const refusedAsUndo = (a, action) => a.logged.length === 1 && UNDO.test(a.logged[0])
        && a.told.some(t => t.what === action && t.reason === "undoIsTheGms");

    // reroll.mjs:486 until C4a - progress taken back, naming the rerolling character.
    phase("a Reroll's progress", { flow: "projects" });
    await clearFailures(gm);
    let mark = await refusedCount(p1);
    await rerollOn(p1, IDS.aiko);
    const a1answer = await p1.eval(`return await ${projects}.addProgress("${proj.one}", -1, { actorId: "${IDS.aiko}" });`, { timeout: 30000 });
    await settle(1500);
    const a1 = { answer: a1answer, after: await gm.eval(progressOf(proj.one)),
        logged: await refusalsLogged(gm, "project.progress"), told: await refusedSince(p1, mark) };
    check("A1: a player's progress taken back is refused as the GM's own undo, told, and moves nothing - a rewrite of the roll behind it or not",
        a1.after.current === 3 && refusedAsUndo(a1, "project.progress") && a1answer === null, JSON.stringify(a1));

    // reroll.mjs:624-636 until C4a - the old sabotage taken back and a new one made, back to back.
    phase("a Reroll's sabotage", { flow: "projects" });
    const firstRepair = await p2.eval(`${sabotageRoll(IDS.botan)}
        const r = await ${projects}.sabotageProject("${proj.one}", 3, { rollId, actorId: "${IDS.botan}" }); return r?.repair?.id ?? null;`, { timeout: 60000 });
    await settle(800);
    await clearFailures(gm);
    mark = await refusedCount(p2);
    const playerUndo = await p2.eval(`return await ${projects}.undoSabotage("${proj.one}", "${firstRepair}", { actorId: "${IDS.botan}" });`, { timeout: 60000 });
    await settle(1500);
    const a2refused = { answer: playerUndo, frozenBy: await gm.eval(`return ${projects}.metaFor("${proj.one}").frozenBy ?? null;`),
        logged: await refusalsLogged(gm, "project.unsabotage"), told: await refusedSince(p2, mark) };
    check("A2: a player's sabotage taken back is refused as the GM's own undo, told, and thaws nothing",
        Boolean(firstRepair) && a2refused.frozenBy === firstRepair && refusedAsUndo(a2refused, "project.unsabotage") && playerUndo === null,
        JSON.stringify(a2refused));
    await clearFailures(gm);
    const redo = await gm.eval(`const P = ${projects};
        const undone = await P.undoSabotage("${proj.one}", "${firstRepair}");
        const again = await P.sabotageProject("${proj.one}", 6);
        return { undone, again: again?.repair?.id ?? null };`, { timeout: 60000 });
    await settle(1500);
    const a2 = { firstRepair, ...redo,
        after: await gm.eval(`const P = ${projects}; const ids = P.allProjects().map(p => p.id);
            return { first: ids.includes("${firstRepair}"), frozenBy: P.metaFor("${proj.one}").frozenBy ?? null,
                repairs: P.allProjects().filter(p => P.repairs(p.id) === "${proj.one}").map(p => p.id) };`),
        logged: [...await refusalsLogged(gm, "project.unsabotage"), ...await refusalsLogged(gm, "project.sabotage")] };
    check("A2: the GM's own undo of a sabotage and a new one, back to back, leave one freeze, by the new repair",
        Boolean(redo.again) && redo.again !== firstRepair && a2.after.first === false
        && a2.after.frozenBy === redo.again && a2.after.repairs.length === 1 && !a2.logged.length
        && notFailed(redo.undone), JSON.stringify(a2));

    // reroll.mjs:734 until C4a - an Observe taken back.
    phase("a Reroll's Observe", { flow: "search-observe" });
    const observed = await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 450, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${IDS.chie}", sourceName: "Chie Mori", room: "Dorm A", subject: "E31 cup" });
        const O = await import("${repoUrl}/scripts/observe.mjs");
        const r = await O.chooseObserveTarget({ actorId: "${IDS.aiko}", declaration: "general", userId: "${IDS.p1}" });
        return { key: r?.key ?? null, ok: r?.ok ?? false };`, { timeout: 60000 });
    const bulletsOf = `return game.actors.get("${IDS.aiko}").items.filter(i => i.getFlag("${MOD}", "isTruthBullet")).map(i => i.id);`;
    const bullets0 = await gm.eval(bulletsOf);
    /* The first find names an Observe roll of Aiko's the GM drew (E08+E28 C14: a result is the GMs'
       record of the roll a packet names, bridge-guards.mjs `rollRefusal`); the faces beat the trace. */
    const observeRoll = await p1.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        ${payFor(IDS.aiko)}
        globalThis.__forceRoll = { hope: 12, fear: 11 };
        let out = null;
        try { out = await A.rollTrait(game.actors.get("${IDS.aiko}"), "eye", { actionKey: "observe", remember: false }); }
        finally { delete globalThis.__forceRoll; }
        return out?.raw?.[A.DRAWN_ROLL]?.messageId ?? null;`, { timeout: 60000 });
    await p1.eval(`${bridge}.requestObserveResolve({ actorId: "${IDS.aiko}", key: "${observed.key}", total: 30, isCritical: false,
        rollId: ${JSON.stringify(observeRoll)} }); return true;`);
    await settle(1500);
    const bullets1 = await gm.eval(bulletsOf);
    const found = bullets1.filter(id => !bullets0.includes(id));
    await clearFailures(gm);
    mark = await refusedCount(p1);
    const a3answer = await p1.eval(`return await ${bridge}.requestObserveResolve({ actorId: "${IDS.aiko}", key: "${observed.key}",
        total: 30, isCritical: false, undo: true });`, { timeout: 30000 });
    await settle(1500);
    const bullets2 = await gm.eval(bulletsOf);
    const a3 = { observed, observeRoll, found, counts: [bullets0.length, bullets1.length, bullets2.length], answer: a3answer,
        logged: await refusalsLogged(gm, "observe.resolve"), told: await refusedSince(p1, mark) };
    check("A3: a player's Observe taken back is refused as the GM's own undo, told, and the first find stays",
        observed.ok === true && found.length === 1 && bullets2.length === bullets1.length && bullets2.includes(found[0])
        && refusedAsUndo(a3, "observe.resolve"), JSON.stringify(a3));

    // reroll.mjs:353 until C4b - a roll that became a Despair roll moved its Monokuma's pool by one.
    phase("a Reroll's Despair", { flow: "despair" });
    const pool0 = await gm.eval(pool);
    await clearFailures(gm);
    mark = await refusedCount(p1);
    await p1.eval(`game.socket.emit("${SOCKET}", { action: "despair.adjust", userId: game.user.id, requestId: "e08c8-despair",
        targetUserId: "${IDS.gm}", delta: 1, actorId: "${IDS.aiko}" }, ${toGms}); return true;`);
    await settle(1500);
    const a4 = { before: pool0, after: await gm.eval(pool),
        logged: await refusalsLogged(gm, "despair.adjust"), told: await refusedSince(p1, mark) };
    check("A4: a player's Despair correction is refused as the GM's own undo, told, and moves no pool",
        a4.after === pool0 && refusedAsUndo(a4, "despair.adjust"), JSON.stringify(a4));

    // reroll.mjs:1026 until C4a - the trace the first throw left, re-rated.
    phase("a Reroll's trace", { flow: "trace-remnant" });
    const traceOf = subject => `const R = await import("${repoUrl}/scripts/remnants.mjs");
        const t = canvas.scene.tokens.contents.find(x => R.remnantData(x)?.subject === "${subject}");
        return t ? { id: t.id, visibility: R.remnantData(t).visibility } : null;`;
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 650, y: 650, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${IDS.aiko}", sourceName: "Aiko Hoshino", room: "Dorm A", subject: "E31 own trace" });
        return true;`, { timeout: 60000 });
    await settle(600);
    const own = await gm.eval(traceOf("E31 own trace"));
    await clearFailures(gm);
    mark = await refusedCount(p1);
    const a5answer = await p1.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        return await R.retuneRemnant(canvas.scene.id, "${own?.id}", { visibility: "hidden" });`, { timeout: 30000 });
    await settle(1500);
    const a5 = { own, after: await gm.eval(traceOf("E31 own trace")), answer: a5answer,
        logged: await refusalsLogged(gm, "remnant.edit"), told: await refusedSince(p1, mark) };
    check("A5: a player's re-rating of their own fresh trace is refused as the GM's own undo, told, and changes nothing",
        Boolean(own) && a5.after?.visibility === own.visibility && refusedAsUndo(a5, "remnant.edit") && a5answer === null,
        JSON.stringify(a5));

    /* --------------------------------------------------- A. an Assistant GM */

    phase("an Assistant GM's Despair", { flow: "despair" });
    const pool1 = await gm.eval(pool);
    await clearFailures(gm);
    let written = settingLog.length;
    const a7answer = await ag.eval(`return await ${bridge}.sendDespairToPrimary("${IDS.gm}", 2);`, { timeout: 30000 });
    await settle(1500);
    const a7 = { before: pool1, after: await gm.eval(pool), answer: a7answer, logged: await refusalsLogged(gm, "despair.adjust"),
        writes: settingLog.slice(written).filter(w => /despairPools$/.test(w.key)).map(w => w.who) };
    check("A7: an Assistant GM's Despair goes to the primary and is written there once",
        a7.after === pool1 + 2 && JSON.stringify(a7.writes) === JSON.stringify(["gm"]) && !a7.logged.length && notFailed(a7answer),
        JSON.stringify(a7));

    phase("an Assistant GM's Level Up offer", { flow: "class-trial" });
    const offerOf = `const L = await import("${repoUrl}/scripts/level-up.mjs"); return L.pendingAdvance(game.actors.get("${IDS.aiko}"))?.kind ?? null;`;
    await clearFailures(gm);
    const offered = await ag.eval(`return await ${bridge}.requestOfferRecord("${IDS.aiko}", "standard");`, { timeout: 30000 });
    await settle(1500);
    const offer = await gm.eval(offerOf);
    const withdrawnAnswer = await ag.eval(`return await ${bridge}.requestOfferRecord("${IDS.aiko}", null);`, { timeout: 30000 });
    await settle(1500);
    const a7b = { offered, offer, withdrawnAnswer, withdrawn: await gm.eval(offerOf), logged: await refusalsLogged(gm, "advancement.offer") };
    check("A7: an Assistant GM's Level Up offer is recorded by the primary, and withdrawn the same way",
        offer === "standard" && a7b.withdrawn === null && !a7b.logged.length && notFailed(offered) && notFailed(withdrawnAnswer),
        JSON.stringify(a7b));

    /* ------------------------------------- A. Daggerheart's own packets for a player */

    phase("Daggerheart's own relay packets");
    const fear0 = await gm.eval(`return game.settings.get("daggerheart", "ResourcesFear");`);
    await p1.eval(`game.socket.emit("${DH}", { action: "DhGMUpdate", data: { action: "DhGMUpdateFear",
        data: ${Number(fear0) + 1}, uuid: null, refresh: null } }); return true;`);
    await settle(1200);
    const fear1 = await gm.eval(`return game.settings.get("daggerheart", "ResourcesFear");`);
    check("A8: a player's roll with Fear still moves Fear by one through Daggerheart's relay",
        fear1 === Number(fear0) + 1, JSON.stringify({ fear0, fear1 }));

    const card = await p1.eval(`const m = await ChatMessage.create({ content: "E31 save card",
        speaker: { scene: canvas.scene.id, actor: "${IDS.aiko}" } }); return m.id;`, { timeout: 30000 });
    await settle(600);
    await gm.eval(`${utils}.clearSessionFailures(); return true;`);
    mark = await refusedCount(p1);
    await p1.eval(`const save = token => game.socket.emit("${DH}", { action: "DhGMUpdate", data: { action: "DhGMUpdateSaveMessage",
            uuid: null, data: { message: "${card}", token, result: { roll: { total: 13, isCritical: false } } } } });
        save("TOKAIKO000000000");
        save("TOKBOTAN00000000");
        return true;`);
    await settle(1500);
    const saves = await gm.eval(`const m = game.messages.get("${card}");
        return m?.system?.targetSaves ?? m?._source?.system?.targetSaves ?? null;`);
    const relayLogged = await gm.eval(`return ${utils}.sessionFailures().filter(e => e.message.includes("Refused a Daggerheart")).map(e => e.message);`);
    const relayTold = (await refusedSince(p1, mark)).filter(t => t.what === "daggerheart");
    check("A8: a player's save for their own token is marked on the card that asked for it",
        saves?.TOKAIKO000000000?.value === 13, JSON.stringify({ card, saves }));
    check("A8: a save for a token the player does not play is refused, logged and told, and not marked",
        !saves?.TOKBOTAN00000000 && relayLogged.length === 1 && relayTold.length === 1, JSON.stringify({ saves, relayLogged, relayTold }));

    /* --------------------------------------------- A. a neutral roll's subject (E06 C5a) */

    /* A module roll's speaker and `system.source.actor` are emptied as the roll is created (E06
       C5b, private-rolls.mjs `neutralRollSource`), so the roller reports its subject to the
       primary GM (`roll.subject`, E06 C5a). Until C5b a player's hook here did the emptying, as
       that commit was to: p1 throws Aiko's roll and p2 Botan's, each a Hope. The GM keeps each subject from its
       report - not from a fallback, which for p1 would also say Aiko - p1's reports of Botan on
       its own roll and of Aiko on p2's roll are refused and logged, quietly. p1 rewriting its
       roll's rolls left the GM a receipt for Aiko until E08+E28 C8; the primary puts them back
       now, on p1's and p2's browsers as on its own, and tells the GMs which roll it was
       (S02-19). At 70dd497 nothing reports a subject. */
    phase("a neutral roll's subject", { flow: "private-rolls" });
    const neutralThrow = (client, actorId) => client.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        try {
            const out = await A.rollTrait(game.actors.get("${actorId}"), "eye", { remember: false });
            const m = out?.raw?.message;
            return { id: m?.id ?? null, speaker: m?.speaker?.actor ?? null, source: m?.system?.source?.actor ?? null };
        } finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
    await clearFailures(gm);
    mark = await refusedCount(p1);
    const mine = await neutralThrow(p1, IDS.aiko);
    const theirs = await neutralThrow(p2, IDS.botan);
    const keptOn = (id, ms = 6000) => gm.eval(`const P = await import("${repoUrl}/scripts/private-rolls.mjs");
        if (typeof P.keptRollSubject !== "function") return "no keptRollSubject";
        const end = Date.now() + ${ms};
        while (!P.keptRollSubject(game.messages.get("${id}")) && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        return P.keptRollSubject(game.messages.get("${id}"));`, { timeout: 30000 });
    const reported = { mine: await keptOn(mine.id), theirs: await keptOn(theirs.id) };
    const forge = (messageId, actorId) => p1.eval(`game.socket.emit("${SOCKET}", { action: "roll.subject", messageId: "${messageId}",
        actorId: "${actorId}" }, ${toGms}); return true;`);
    await forge(mine.id, IDS.botan);
    await forge(theirs.id, IDS.aiko);
    await settle(1500);
    const a10 = { mine, theirs, reported, after: { mine: await keptOn(mine.id, 0), theirs: await keptOn(theirs.id, 0) },
        logged: await refusalsLogged(gm, "roll.subject"), told: await refusedSince(p1, mark) };
    check("A10: the GM keeps each neutral roll's subject from its roller's report",
        Boolean(mine.id && theirs.id) && mine.speaker === null && theirs.speaker === null && !mine.source && !theirs.source
        && reported.mine === IDS.aiko && reported.theirs === IDS.botan, JSON.stringify(a10));
    check("A10: a report of another's character, or of another player's roll, is refused and logged, told to nobody, and changes nothing",
        a10.logged.length === 2 && a10.logged.some(r => /sender does not own that character/.test(r))
        && a10.logged.some(r => /sender did not write that roll message/.test(r)) && !a10.told.length
        && a10.after.mine === IDS.aiko && a10.after.theirs === IDS.botan, JSON.stringify(a10));

    const totalOf = `return game.messages.get("${mine.id}")?.rolls?.[0]?.total ?? null;`;
    const thrown = await gm.eval(totalOf);
    const warnedBefore = await gm.eval(`return game.messages.contents.length;`);
    /* E08+E28 C12a (04.10.2026): p1's roll is drawn by the primary GM, who writes its message
       (roll-draw.mjs), so Foundry refuses p1's update of it outright - S02-19 closed by
       construction for a drawn roll. The put-back below is for a roll its player still writes
       (a statistic from the sheet until C13, any roll where the draw falls back); either way
       the roll keeps its dice on every browser, and a put-back is told to the GMs. */
    const rewrite = await p1.eval(`const m = game.messages.get("${mine.id}");
        try {
            await m.update({ rolls: [JSON.stringify({ class: "DualityRoll", formula: "1d12 + 1d12", total: 99,
                dHope: { total: 8 }, dFear: { total: 4 } })] });
            return { refused: null };
        } catch (err) { return { refused: String(err?.message ?? err).slice(0, 160) }; }`, { timeout: 30000 });
    await settle(1500);
    const putBack = { thrown, rewrite, gm: await gm.eval(totalOf), p1: await p1.eval(totalOf), p2: await p2.eval(totalOf),
        warned: await gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
            return game.messages.contents.slice(${warnedBefore}).filter(m => S.contentOf(m).includes("drpg-warning")).length;`) };
    check("A10: p1 rewriting the rolls of its neutral roll is refused (the GM wrote it) or put back on every browser, and a put-back is told to the GMs",
        typeof thrown === "number" && thrown !== 99 && putBack.gm === thrown && putBack.p1 === thrown && putBack.p2 === thrown
        && (rewrite.refused ? /permission/i.test(rewrite.refused) : putBack.warned >= 1), JSON.stringify(putBack), { flow: "reroll" });
    await gm.eval(`for (const id of ${JSON.stringify([mine.id, theirs.id])}) await game.messages.get(id ?? "")?.delete(); return true;`);
    await settle(400);

    /* A11. THE GM'S PICK OF A STATISTIC (E32+E07 C11b, 02.10.2026; audit S04-23). A crisis action
       that lists several traits asks the GMs which one before anything is paid (trait-ruling.mjs):
       Botan (p2) opens on Chie (p3) and, at his turn, his player asks for Attack with a weapon's
       statistic through the honest request function. The card goes up in p2's thread, the primary
       GM presses its first trait (the harness's GM, client-entry.mjs `__traitRulingAuto`), and the
       answer comes back once, refused nowhere. Chie's Health and Sanity are put back after. */
    phase("a statistic ruling", { flow: "trait-ruling" });
    const chieWas = await gm.eval(`const r = game.actors.get("${IDS.chie}").system.resources;
        return { hp: r.hitPoints.value, stress: r.stress.value };`);
    const fightOpen = await gm.eval(`const M = await import("${repoUrl}/scripts/murder.mjs");
        await game.drpg.openMurder({ killerId: "${IDS.botan}", victimId: "${IDS.chie}", openingTrait: "body" });
        if (M.murderState()?.stage === "openingRoll") await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        if (M.murderState()?.stage === "incident" && !M.isTheirTurn(game.actors.get("${IDS.botan}"))) await M.passTurn();
        globalThis.__traitRulings.length = 0;
        return { stage: M.murderState()?.stage ?? null, turn: M.isTheirTurn(game.actors.get("${IDS.botan}")) };`, { timeout: 60000 });
    await clearFailures(gm);
    mark = await refusedCount(p2);
    const a11answer = await p2.eval(`const B = ${bridge};
        return typeof B.requestTraitRuling === "function"
            ? await B.requestTraitRuling({ actorId: "${IDS.botan}", kind: "crisis", key: "weaponAttack" }) : "no requestTraitRuling";`,
        { timeout: 60000 });
    await settle(900);
    const a11 = { fightOpen, answer: a11answer, ruled: await gm.eval(`return globalThis.__traitRulings.slice();`),
        logged: await refusalsLogged(gm, "trait.ruling"), told: (await refusedSince(p2, mark)).filter(t => t.what === "trait.ruling") };
    await gm.eval(`await game.drpg.endMurder({ reason: "test", followUp: false });
        await game.actors.get("${IDS.chie}").update({ "system.resources.hitPoints.value": ${Number(chieWas?.hp) || 0},
            "system.resources.stress.value": ${Number(chieWas?.stress) || 0} });
        return true;`, { timeout: 60000 });
    check("A11: a crisis action's statistic, asked by the killer's own player at his turn, is put to the GMs once, picked on the card and answered - refused nowhere",
        fightOpen.stage === "incident" && fightOpen.turn === true && a11answer?.ok === true && a11answer.value === "body"
        && a11.ruled.length === 1 && a11.ruled[0].picked === "body" && !a11.logged.length && !a11.told.length, JSON.stringify(a11));

    /* A12. A ROLL'S BOOKMARK (E08+E28 C2, 03.10.2026). The roller's browser tells the GMs what it
       rolled for the Reroll's bookmark (`roll.bookmark`), after the roll and before its action
       asks for anything else. p1 throws Aiko's roll as a Search's, with a room in its context,
       which a Search does not claim: the GM keeps the row once, named for p1, with the Search's
       claims and not the room, logs no refusal and tells p1 none. */
    phase("a roll's bookmark", { flow: "reroll" });
    await clearFailures(gm);
    mark = await refusedCount(p1);
    const a12roll = await p1.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        ${payFor(IDS.aiko)}
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        try {
            const out = await A.rollTrait(game.actors.get("${IDS.aiko}"), "eye", { actionKey: "search",
                context: { category: "tool", goal: "any", tier: 1, room: "E08 C2 room" } });
            return out?.raw?.message?.id ?? null;
        } finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
    await settle(1200);
    const a12 = { a12roll,
        row: await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); const r = S.rerollBookmarkStore?.get("${IDS.aiko}");
            return r ? { messageId: r.messageId, by: r.by, actionKey: r.actionKey, claims: r.claims } : null;`),
        logged: await refusalsLogged(gm, "roll.bookmark"), told: await refusedSince(p1, mark) };
    check("A12: a player's roll is kept on the GMs' bookmark once, by its roller, with only what its action claims - refused nowhere",
        Boolean(a12roll) && a12.row?.messageId === a12roll && a12.row.by === IDS.p1 && a12.row.actionKey === "search"
        && JSON.stringify(a12.row.claims) === JSON.stringify({ category: "tool", goal: "any", tier: 1 })
        && !a12.logged.length && !a12.told.length, JSON.stringify(a12));
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        await game.messages.get("${a12roll ?? ""}")?.delete();
        if (S.rerollBookmarkStore?.has("${IDS.aiko}")) await S.rerollBookmarkStore.drop("${IDS.aiko}");
        return true;`);

    /* ------------------------------------------------------ B. what E31 adds */

    // B2: a refused request gets its refusal and nothing else - no "got it" first.
    phase("a refused request", { flow: "give-take-stash" });
    const wrench = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        const item = await INV.grantItem(game.actors.get("${IDS.botan}"), { name: "E31 wrench", category: "tool", tier: 1 });
        return item?.id ?? null;`, { timeout: 60000 });
    await settle(600);
    let traffic = socketTraffic.length;
    await forgeFromP1("handover.item", "e31-forge-ack", { fromId: IDS.botan, toId: IDS.aiko, itemId: wrench });
    await settle(1200);
    const toP1 = socketTraffic.slice(traffic).filter(s => s.from === "gm" && Array.isArray(s.to) && s.to.includes(IDS.p1));
    const b2 = { refused: toP1.filter(s => s.action === "bridge.refused").length, acks: toP1.filter(s => s.action === "bridge.ack").length };
    // Green since E31 C3: the runner acknowledges only once the guards have passed.
    check("B2: a refused request is not acknowledged - the refusal is the one answer", b2.acks === 0 && b2.refused === 1, JSON.stringify(b2));

    // B3: the refusal says why, in the language the player reads.
    phase("a refusal in Polish", { flow: "give-take-stash" });
    const polish = await p1.eval(`await game.settings.set("${MOD}", "language", "pl");
        const I = await import("${repoUrl}/scripts/i18n.mjs"); return await I.applyModuleLanguage();`, { timeout: 30000 });
    try {
        const n = await noticeCount(p1);
        mark = await refusedCount(p1);
        await forgeFromP1("handover.item", "e31-forge-pl", { fromId: IDS.botan, toId: IDS.aiko, itemId: wrench });
        await settle(1200);
        const b3 = await p1.eval(`const said = globalThis.__notifications.slice(${n}).map(x => x.msg);
            const what = game.i18n.localize("DRPG.Bridge.what.handover.item");
            const why = game.i18n.localize("DRPG.Bridge.why.notYours");
            return { said, what, why, want: game.i18n.format("DRPG.Bridge.notDone", { what, why }) };`);
        b3.told = (await refusedSince(p1, mark)).filter(t => t.what === "handover.item").length;
        // Green since E31 C4: the packet carries the reason's code, and the player's client says it in its own language.
        check("B3: p1, reading Polish, is told in Polish what was not carried out and why",
            polish === true && b3.told === 1 && b3.said.length >= 1
            && b3.said.at(-1) === b3.want && b3.what === "Przekazanie przedmiotu" && !b3.why.startsWith("DRPG.") && !b3.want.startsWith("DRPG."),
            JSON.stringify({ polish, ...b3 }));
    } finally {
        // Back to English. The Polish file was merged into the translations in place, so English is merged back the same way.
        await p1.eval(`await game.settings.set("${MOD}", "language", "en");
            const en = await (await fetch("modules/${MOD}/lang/en.json")).json();
            foundry.utils.mergeObject(game.i18n.translations, foundry.utils.expandObject(en),
                { inplace: true, insertKeys: true, insertValues: true, overwrite: true, recursive: true });
            return true;`, { timeout: 30000 });
    }

    // B4: an exception in a request that is acknowledged (token.sendBack): the token's write throws.
    phase("an exception in an acknowledged request", { flow: "crossing-fee-refund" });
    const home = await gm.eval(`const t = canvas.scene.tokens.get("TOKAIKO000000000"); return { x: t.x, y: t.y };`);
    await gm.eval(`const M = await import("${repoUrl}/scripts/movement.mjs");
        globalThis.__e31Thrown = { sendBack: 0, sabotage: 0 };
        const t = canvas.scene.tokens.get("TOKAIKO000000000");
        const real = t.update;
        t.update = function (data, options = {}) {
            if (options?.[M.REVERT]) {
                globalThis.__e31Thrown.sendBack++;
                throw new Error("E31 injected: the send-back's write failed");
            }
            return real.call(this, data, options);
        };
        return true;`);
    try {
        await p1.eval(`await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: ${home.x + 100}, y: ${home.y} }); return true;`);
        await settle(800);
        await clearFailures(gm);
        const n = await noticeCount(p1);
        mark = await refusedCount(p1);
        const sent = await p1.eval(`const answer = await ${bridge}.requestSendBack(canvas.scene.id, "TOKAIKO000000000", { x: ${home.x}, y: ${home.y} });
            return { answer, at: Date.now() };`, { timeout: 30000 });
        await settle(2000);
        const b4 = {
            sent, thrown: await gm.eval(`return globalThis.__e31Thrown.sendBack;`),
            token: await gm.eval(`const t = canvas.scene.tokens.get("TOKAIKO000000000"); return { x: t.x, y: t.y };`),
            logged: await refusalsLogged(gm, "token.sendBack"),
            told: (await refusedSince(p1, mark)).filter(t => t.what === "token.sendBack").length,
            said: await noticesSince(p1, n),
            failed: await p1.eval(`return game.i18n.localize("DRPG.Bridge.why.failed");`)
        };
        // Green since E31 C3: the runner turns a throw into one refusal.
        check("B4a: an exception in the send-back is one refusal: p1 is told once, the GM logs it with the error, the token stays",
            b4.thrown >= 1 && b4.told === 1 && b4.logged.some(line => line.includes("E31 injected")) && b4.token.x === home.x + 100,
            JSON.stringify(b4));
        // Green since E31 C5: the one wait answers the "got it", and says the refusal after it once.
        check("B4b: the send-back had answered as accepted before the one message, which says it failed on the GM's client",
            b4.thrown >= 1 && b4.sent.answer?.ok === true && b4.sent.answer?.pending === true && b4.said.length === 1
            && b4.said[0].at >= b4.sent.at && !b4.failed.startsWith("DRPG.") && b4.said[0].msg.includes(b4.failed), JSON.stringify(b4));
    } finally {
        await gm.eval(`const t = canvas.scene.tokens.get("TOKAIKO000000000"); delete t.update;
            await t.update({ x: ${home.x}, y: ${home.y} }); return true;`);
        await settle(600);
    }

    // B5: an exception in a request that is answered (project.sabotage): the repair's write throws.
    phase("an exception in an answered request", { flow: "projects" });
    const target = await gm.eval(`const P = ${projects};
        const t = await P.createProject({ name: "E31 target", target: 6, room: "Hall", secret: false });
        const real = game.settings.set;
        globalThis.__e31RealSet = real;
        game.settings.set = function (namespace, key, ...rest) {
            if (globalThis.__e31InjectSabotage && namespace === "daggerheart" && key === "Countdowns") {
                globalThis.__e31Thrown.sabotage++;
                throw new Error("E31 injected: the sabotage's write failed");
            }
            return real.call(this, namespace, key, ...rest);
        };
        globalThis.__e31InjectSabotage = true;
        return t.id;`, { timeout: 60000 });
    try {
        await clearFailures(gm);
        const n = await noticeCount(p1);
        const answered = await p1.eval(`${sabotageRoll(IDS.aiko)}
            const t0 = Date.now();
            const answer = await Promise.race([${bridge}.requestSabotage("${target}", 3, { rollId, actorId: "${IDS.aiko}" }),
                new Promise(resolve => setTimeout(() => resolve("still waiting"), 10000))]);
            return { answer, ms: Date.now() - t0 };`, { timeout: 30000 });
        await settle(800);
        const b5 = { ...answered, thrown: await gm.eval(`return globalThis.__e31Thrown.sabotage;`),
            logged: await refusalsLogged(gm, "project.sabotage"), said: (await noticesSince(p1, n)).map(x => x.msg) };
        // Green since E31 C3: the runner's refusal settles the request as soon as the run throws.
        check("B5a: an exception in a sabotage settles p1's request within 10 s, not 180, with one message",
            b5.thrown >= 1 && b5.answer !== "still waiting" && b5.ms < 10000 && b5.said.length === 1, JSON.stringify(b5));
        // Green since E31 C5.
        check("B5b: the sabotage's answer is a refusal whose reason is that it failed",
            b5.thrown >= 1 && b5.answer?.ok === false && b5.answer?.refused === true && b5.answer?.reason === "failed", JSON.stringify(b5));
    } finally {
        await gm.eval(`globalThis.__e31InjectSabotage = false; game.settings.set = globalThis.__e31RealSet; return true;`);
    }

    // B6: a GM who is connected and hears nothing. The GM client's listeners on the module's channel are taken off for the check.
    phase("a GM connected and silent", { flow: "eclipse-route-veto" });
    const muted = await gm.eval(`globalThis.__e31Handlers = game.socket._handlers.get("${SOCKET}") ?? [];
        game.socket._handlers.set("${SOCKET}", []); return globalThis.__e31Handlers.length;`);
    let silent = null, restored = null;
    try {
        const n = await noticeCount(p1);
        silent = await p1.eval(`const t0 = Date.now();
            const answer = await Promise.race([Promise.resolve(${bridge}.requestEclipseMove("${IDS.aiko}")),
                new Promise(resolve => setTimeout(() => resolve("still waiting"), 12000))]);
            return { answer, ms: Date.now() - t0 };`, { timeout: 30000 });
        silent.said = (await noticesSince(p1, n)).map(x => x.msg);
    } finally {
        restored = await gm.eval(`game.socket._handlers.set("${SOCKET}", globalThis.__e31Handlers);
            return game.socket._handlers.get("${SOCKET}").length;`);
    }
    // Green since E31 C5.
    check("B6: with the GM connected and silent, p1's Eclipse move settles as not answered after the acknowledgement clock, with one message",
        muted > 0 && restored === muted && silent?.answer?.ok === false && silent?.answer?.reason === "noAnswer"
        && silent.ms >= 7000 && silent.ms < 12000 && silent.said.length === 1, JSON.stringify({ muted, restored, silent }));
    // Before E31 the old clock's toast comes eight seconds after the send; let it land before anything counts messages again.
    if (silent && silent.ms < 7000) await settle(8500 - silent.ms);

    // B7: a crossing p1's client reports, through the module's own hook.
    phase("the trap relay", { flow: "trap-fire" });
    traffic = socketTraffic.length;
    await p1.eval(`Hooks.callAll("drpgRoomCrossed", { actor: game.actors.get("${IDS.aiko}"), to: "Dorm A" }); return true;`);
    await settle(1200);
    const relayed = socketTraffic.slice(traffic).filter(s => s.from === "p1" && s.action === "trap.event").map(s => s.to);
    const gmIds = [IDS.gm, IDS.ag];
    // Green since E31 C5: the relay asks through the one wait, which addresses the GMs.
    check("B7: a crossing p1's client reports to the traps reaches the GMs and no player's browser",
        relayed.length >= 1 && relayed.every(to => Array.isArray(to) && to.length > 0 && to.every(id => gmIds.includes(id))),
        JSON.stringify(relayed));

    // B8: a Search for a room Aiko is not in, on the scene she is on.
    phase("a refused search", { flow: "search-observe" });
    const left0 = await gm.eval(`return game.drpg.tokensLeft("Gym");`);
    const n8 = await noticeCount(p1);
    const spent = await p1.eval(`return await game.drpg.searchTokens.spend("Gym", canvas.scene.id, { actorId: "${IDS.aiko}" });`, { timeout: 30000 });
    await settle(1500);
    const b8 = { spent, left0, left: await gm.eval(`return game.drpg.tokensLeft("Gym");`), said: (await noticesSince(p1, n8)).map(x => x.msg),
        why: await p1.eval(`return game.i18n.localize("DRPG.Bridge.why.notThere");`),
        timeout: await p1.eval(`return game.i18n.localize("DRPG.SearchTokens.timeout");`) };
    // Green since E31 C6: the spend is a declaration the runner judges, and its refusal is the one message.
    check("B8: a Search refused for the room is told once, with the reason, and never as a GM who did not answer",
        spent === false && b8.left === left0 && b8.said.length === 1 && !b8.why.startsWith("DRPG.") && b8.said[0].includes(b8.why)
        && !b8.said.includes(b8.timeout), JSON.stringify(b8));

    /* B13 (E05 C4, 26.09.2026; audit S10-39): the GM counts an Eclipse's crossings and judges the
       allowance - until E05 only the mover's client judged it. In an Eclipse opened by its clock flag
       and name alone (the opening's refill and cards are not what is measured), leading into noon:
       each legal crossing p1 asks for is answered with its count, and one beyond the allowance is
       refused as nothingLeft, counts nothing, and is said once. B9 runs in the same Eclipse; it is
       closed after it. */
    phase("an exception in a request its asker counts", { flow: "eclipse-route-veto" });
    const ECL = `const X = await import("${repoUrl}/scripts/eclipse.mjs");`;
    const clock13 = await gm.eval(`${ECL} const was = game.drpg.getClock();
        await game.drpg.setClock({ timeOfDay: "morning", eclipse: true, eclipseStartedAt: Date.now() });
        return { was: { timeOfDay: was.timeOfDay, timeOfDayStartedAt: was.timeOfDayStartedAt }, allowance: X.eclipseAllowance() };`);
    const allowance13 = Number.isInteger(clock13.allowance) ? clock13.allowance : 0;
    const legal13 = [];
    for (let i = 0; i < allowance13; i++) legal13.push(await p1.eval(`return await ${bridge}.requestEclipseMove("${IDS.aiko}");`, { timeout: 30000 }));
    const n13 = await noticeCount(p1);
    const beyond13 = await p1.eval(`return await ${bridge}.requestEclipseMove("${IDS.aiko}");`, { timeout: 30000 });
    await settle(1200);
    const b13 = { allowance: clock13.allowance, legal: legal13.map(r => [r?.ok ?? null, r?.value?.used ?? null]), beyond: beyond13,
        used: await gm.eval(`${ECL} return X.movesUsed(game.actors.get("${IDS.aiko}"));`), said: (await noticesSince(p1, n13)).map(x => x.msg) };
    check("B13: in an Eclipse the GM answers each legal crossing with its count, and refuses one beyond the allowance as nothingLeft, counting nothing, said once",
        allowance13 >= 1 && JSON.stringify(b13.legal) === JSON.stringify(legal13.map((r, i) => [true, i + 1])) && beyond13?.ok === false && beyond13?.refused === true
        && beyond13?.reason === "nothingLeft" && b13.used === allowance13 && b13.said.length === 1, JSON.stringify(b13));

    // B9: a request whose asker counts it as done (an Eclipse crossing) is answered once the GM's client has
    // carried it out (E31 review): its write throws, and p1 is answered failed, not accepted, with one message.
    // The write is the GMs' store's since E05 (C4), whose save does not throw into its caller - so the store's
    // own write is what fails here, in the Eclipse B13 opened, with Aiko's count taken back first (B13 spent it).
    await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        await S.eclipseMoveStore.drop("${IDS.aiko}");
        globalThis.__e31RealPatch9 = S.eclipseMoveStore.patch;
        S.eclipseMoveStore.patch = function () {
            globalThis.__e31Thrown.eclipse = (globalThis.__e31Thrown.eclipse ?? 0) + 1;
            throw new Error("E31 injected: the crossing's write failed");
        };
        return true;`);
    try {
        const n9 = await noticeCount(p1);
        const counted = await p1.eval(`return await ${bridge}.requestEclipseMove("${IDS.aiko}");`, { timeout: 30000 });
        await settle(1200);
        const b9 = { counted, thrown: await gm.eval(`return globalThis.__e31Thrown.eclipse ?? 0;`),
            said: (await noticesSince(p1, n9)).map(x => x.msg) };
        check("B9: an Eclipse crossing whose write throws on the GM's client is answered failed, not accepted, and said once",
            b9.thrown >= 1 && b9.counted?.ok === false && b9.counted?.refused === true && b9.counted?.reason === "failed"
            && b9.said.length === 1, JSON.stringify(b9));
    } finally {
        await gm.eval(`const S = await import("${repoUrl}/scripts/gm-stores.mjs"); S.eclipseMoveStore.patch = globalThis.__e31RealPatch9;
            await game.drpg.setClock({ eclipse: false, ...${JSON.stringify(clock13.was)} }); return true;`);
    }

    // B10: a trace the GM's client fails to place is answered as a failure, not as placed (E31 review), so the
    // item it stands for stays on the sheet: the token's creation throws on the GM, which placeRemnant catches.
    // A discarded item's trace, which names no roll: a Search's names one since E08+E28 C15 (`traceBandOf`).
    phase("a trace that could not be placed", { flow: "trace-remnant" });
    await gm.eval(`const scene = canvas.scene;
        globalThis.__e31RealCreate = scene.createEmbeddedDocuments;
        scene.createEmbeddedDocuments = function (name, data, ...rest) {
            if (name === "Token" && data?.[0]?.flags?.["${MOD}"]) {
                globalThis.__e31Thrown.trace = (globalThis.__e31Thrown.trace ?? 0) + 1;
                throw new Error("E31 injected: the trace's token could not be created");
            }
            return globalThis.__e31RealCreate.call(this, name, data, ...rest);
        };
        return true;`);
    try {
        const n10 = await noticeCount(p1);
        const placed = await p1.eval(`return await ${bridge}.requestRemnant({ sourceActor: "${IDS.aiko}", sourceName: "Aiko Hoshino",
            visibility: "evident", type: "prep", action: "discard", subject: "E31 unplaced", x: 1600, y: 400, sceneId: canvas.scene.id });`,
            { timeout: 30000 });
        await settle(1200);
        const b10 = { placed, thrown: await gm.eval(`return globalThis.__e31Thrown.trace ?? 0;`),
            said: (await noticesSince(p1, n10)).map(x => x.msg) };
        check("B10: a trace whose token the GM's client could not create is answered failed, not placed, and said once",
            b10.thrown >= 1 && b10.placed?.ok === false && b10.placed?.refused === true && b10.placed?.reason === "failed"
            && b10.said.length === 1, JSON.stringify(b10));

        // B11: a broken item discarded while that is so stays on the sheet, and the whisper adds only that it is
        // kept: the bridge has said why no trace was left, so "there was nowhere to leave it" would contradict it
        // (E31 review).
        const broken = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
            const item = await INV.grantItem(game.actors.get("${IDS.aiko}"), { name: "E31 broken", category: "tool", tier: 1 });
            await item?.setFlag("${MOD}", "broken", true);
            return item?.id ?? null;`, { timeout: 60000 });
        await settle(800);
        const n11 = await noticeCount(p1);
        // A whisper's words live beside the card, not in it (secret.mjs), so they are read with `contentOf`.
        const discarded = await p1.eval(`const U = await import("${repoUrl}/scripts/use-items.mjs");
            const S = await import("${repoUrl}/scripts/secret.mjs");
            const actor = game.actors.get("${IDS.aiko}");
            const kept = game.i18n.format("DRPG.Items.discardKept", { item: "E31 broken" });
            const nowhere = game.i18n.format("DRPG.Items.discardNoTrace", { item: "E31 broken" });
            const before = game.messages.contents.length;
            const r = await U.discardBroken(actor, actor.items.get("${broken}"));
            const warned = game.messages.contents.slice(before).map(m => S.contentOf(m))
                .filter(words => words.includes(kept) || words.includes(nowhere));
            return { r: r ?? null, warned, kept, nowhere };`, { timeout: 60000 });
        await settle(1200);
        const b11 = { ...discarded, held: await gm.eval(`return Boolean(game.actors.get("${IDS.aiko}").items.get("${broken}"));`),
            said: (await noticesSince(p1, n11)).map(x => x.msg) };
        check("B11: a discard whose trace the GM's client could not place keeps the item, is said once, and adds only that it is kept",
            Boolean(broken) && b11.held && b11.said.length === 1 && b11.warned.length === 1 && !b11.kept.startsWith("DRPG.")
            && b11.warned[0].includes(b11.kept) && !b11.warned[0].includes(b11.nowhere), JSON.stringify(b11));
    } finally {
        await gm.eval(`delete canvas.scene.createEmbeddedDocuments; return typeof canvas.scene.createEmbeddedDocuments;`);
    }

    // B12: a request whose resolver carried out nothing is not answered as done (E31 review). Botan is alive, so
    // lootBody takes nothing off him; p1 must be told once, with the generic code, and the wrench stays where it is.
    phase("a loot the GM's client carried out nothing of", { flow: "give-take-stash" });
    const n12 = await noticeCount(p1);
    const looted = await p1.eval(`return await ${bridge}.requestBodyLoot({ takerId: "${IDS.aiko}", bodyId: "${IDS.botan}", itemId: "${wrench}" });`,
        { timeout: 30000 });
    await settle(1200);
    const b12 = { looted, said: (await noticesSince(p1, n12)).map(x => x.msg),
        why: await p1.eval(`return game.i18n.localize("DRPG.Bridge.why.refused");`),
        held: await gm.eval(`return { botan: game.actors.get("${IDS.botan}").items.has("${wrench}"),
            aiko: game.actors.get("${IDS.aiko}").items.some(i => i.name === "E31 wrench") };`) };
    check("B12: a loot off a living character is answered as not carried out, with the generic code, once, and moves nothing",
        Boolean(wrench) && looted?.ok === false && looted?.refused === true && looted?.reason === "refused" && b12.said.length === 1
        && !b12.why.startsWith("DRPG.") && b12.said[0].includes(b12.why) && b12.held.botan === true && b12.held.aiko === false,
        JSON.stringify(b12));

    /* B14 (E05 C6, 26.09.2026; audit S11-03, S01-08): a player's pre-session note goes to the primary
       GM (`note.save`) and into the GMs' store under the sender's own id - until E05 p1 wrote it as a
       flag on its own User document, which every browser holds. p1 saves one: it is answered as sent,
       nothing is said, the GM reads it from its store and p1 from its own copy, p2 reads nothing of it,
       and p1's flag, read on p2, says that a note is written and holds no text. */
    phase("a player's pre-session note", { flow: "pre-session-note" });
    const NOTE = `const N = await import("${repoUrl}/scripts/pre-session-note.mjs");`;
    const n14 = await noticeCount(p1);
    const saved14 = await p1.eval(`${NOTE} return await N.saveNote(game.user.id, "E05 33 B14 p1's note");`, { timeout: 30000 });
    await settle(1200);
    const noteOf = c => c.eval(`${NOTE} return N.noteFor("${p1.userId}");`);
    const b14 = { saved: saved14, gm: await noteOf(gm), p1: await noteOf(p1), p2: await noteOf(p2),
        flag: await p2.eval(`return game.users.get("${p1.userId}").getFlag("${MOD}", "preSessionNote") ?? null;`),
        said: (await noticesSince(p1, n14)).map(x => x.msg) };
    check("B14: p1's pre-session note is answered as sent and kept in the GM's store; p1 reads its own copy, p2 nothing, and p1's flag holds no text",
        b14.saved === "sent" && b14.gm === "E05 33 B14 p1's note" && b14.p1 === b14.gm && b14.p2 === "" && b14.said.length === 0
        && b14.flag?.written === true && !Object.hasOwn(b14.flag ?? {}, "text"), JSON.stringify(b14));

    /* ------------------------------------------- A. the Assistant as the primary */

    phase("the Assistant as the primary", { flow: "give-take-stash" });
    const gift = await gm.eval(`const INV = await import("${repoUrl}/scripts/inventory.mjs");
        await canvas.scene.tokens.get("TOKAIKO000000000").update({ x: 1500, y: 300 });
        const item = await INV.grantItem(game.actors.get("${IDS.aiko}"), { name: "E31 gift", category: "tool", tier: 1 });
        return item?.id ?? null;`, { timeout: 60000 });
    await settle(800);

    // Since E31 C3 the runner catches the two exceptions B injects, so none is excused here.
    const gmSide = { gm: await errorsOf(gm), ag: await errorsOf(ag) };
    check("D: no exception escaped into Foundry on the GM's or the Assistant's client",
        Object.values(gmSide).every(list => list.length === 0), JSON.stringify(gmSide));

    await disconnect("gm");
    await settle(800);
    const primary = await p1.eval(`return ${utils}.primaryGmId();`);
    let ops = opLog.length;
    await clearFailures(ag);
    mark = await refusedCount(p1);
    const givenAnswer = await p1.eval(`return await ${bridge}.requestGiveItem({ fromId: "${IDS.aiko}", toId: "${IDS.botan}", itemId: "${gift}" });`,
        { timeout: 30000 });
    await settle(1500);
    /* Once, by the Assistant: one copy made on Botan and one original taken off Aiko. The handover
       also writes an update to an item on Botan's sheet (measured on the first run, 25.09.2026:
       `ag embedded-update` on Botan, beside the create and the delete); what is held here is that
       every write is the Assistant's and touches only the two characters, not how many updates it takes. */
    const itemWrites = opLog.slice(ops).filter(w => w.embeddedName === "Item");
    const a9 = { primary, gift, answer: givenAnswer,
        writes: itemWrites.map(w => `${w.who} ${w.action} ${w.docId}`),
        held: await ag.eval(`return game.actors.get("${IDS.botan}").items.filter(i => i.name === "E31 gift").length;`),
        logged: await refusalsLogged(ag, "handover.item"), told: await refusedSince(p1, mark) };
    const count = (action, id) => itemWrites.filter(w => w.action === action && w.docId === id).length;
    check("A9: with the GM gone, the Assistant is the primary and carries out p1's honest handover once",
        primary === IDS.ag && Boolean(gift) && itemWrites.every(w => w.who === "ag" && [IDS.botan, IDS.aiko].includes(w.docId))
        && count("embedded-create", IDS.botan) === 1 && count("embedded-delete", IDS.aiko) === 1 && a9.held === 1
        && !a9.logged.length && !a9.told.length && notFailed(givenAnswer), JSON.stringify(a9));

    ops = opLog.length;
    mark = await refusedCount(p1);
    await forgeFromP1("handover.item", "e31-forge-ag", { fromId: IDS.botan, toId: IDS.aiko, itemId: wrench });
    await settle(1500);
    const a9f = { writes: opLog.slice(ops).filter(w => w.embeddedName === "Item").length,
        logged: await refusalsLogged(ag, "handover.item"), told: (await refusedSince(p1, mark)).filter(t => t.what === "handover.item") };
    check("A9: the Assistant refuses a forged handover of Botan's item for ownership, tells p1, and moves nothing",
        a9f.writes === 0 && a9f.logged.some(r => /sender does not own/.test(r)) && a9f.told.length === 1, JSON.stringify(a9f));

    /* ------------------------------------------------------- C. no GM at all */

    await disconnect("ag");
    await settle(800);
    phase("no GM at the table");
    const offline = async (what, call) => {
        const sentFrom = socketTraffic.length;
        const n = await noticeCount(p1);
        const r = await p1.eval(`const t0 = Date.now();
            const answer = await Promise.race([Promise.resolve(${call}),
                new Promise(resolve => setTimeout(() => resolve("still waiting"), 5000))]);
            return { answer, ms: Date.now() - t0 };`, { timeout: 30000 });
        await settle(300);
        return { what, ...r, sent: socketTraffic.slice(sentFrom).filter(s => s.from === "p1").length,
            said: (await noticesSince(p1, n)).map(x => x.msg), label: await p1.eval(`return game.i18n.localize("DRPG.Bridge.what.${what}");`) };
    };
    const settledAtOnce = c => c.answer !== "still waiting" && c.ms < 1000 && c.sent === 0 && c.said.length === 1;
    const c1 = await offline("project.sabotage", `${bridge}.requestSabotage("${proj.two}", 3)`);
    check("C: with no GM connected, p1's sabotage settles at once, sends nothing, and says so once", settledAtOnce(c1), JSON.stringify(c1),
        { flow: "projects" });
    const c2 = await offline("remnant.tieForItem", `${bridge}.requestTieTrace("E31NOGMIDENTITY0")`);
    check("C: with no GM connected, p1's tie of a trace settles at once, sends nothing, and says so once", settledAtOnce(c2), JSON.stringify(c2),
        { flow: "trace-remnant" });
    const c3 = await offline("action.plant", `${bridge}.requestPlant({ plannerId: "${IDS.aiko}", victimId: "${IDS.botan}", itemId: "${gift}", total: 12 })`);
    check("C: with no GM connected, p1's Palm settles at once, sends nothing, and says so once", settledAtOnce(c3), JSON.stringify(c3),
        { flow: "give-take-stash" });
    /* E05 C6: a pre-session note saved with no GM connected is kept in p1's browser, unsent, and the
       Note tab says so; it goes to the next primary GM whose world loads (61-gmstore-case, Z6). */
    const c4 = await offline("note.save", `(await import("${repoUrl}/scripts/pre-session-note.mjs")).saveNote(game.user.id, "E05 33 C kept note")`);
    const keptC = await p1.eval(`const N = await import("${repoUrl}/scripts/pre-session-note.mjs");
        return { unsent: N.noteUnsent?.() ?? null, text: N.noteFor(game.user.id), status: N.noteStatus(game.user.id),
            kept: game.i18n.localize("DRPG.Note.keptUntilGm") };`);
    check("C: with no GM connected, p1's pre-session note settles at once as kept in p1's browser, sends nothing, and says so once",
        settledAtOnce(c4) && c4.answer === "kept" && keptC.unsent === true && keptC.text === "E05 33 C kept note"
        && keptC.status === keptC.kept && !keptC.kept.startsWith("DRPG."), JSON.stringify({ c4, keptC }), { flow: "pre-session-note" });
    const sentence = [c1, c2, c3].map(c => (c.said[0] ?? "").split(c.label).join("{what}"));
    check("C: the three say the same sentence apart from what they name", sentence.every(s => s && s === sentence[0]), JSON.stringify(sentence));

    /* ------------------------------------------------- B1 and D, over the whole run */

    phase("every refusal says why");
    const got = {};
    for (const c of players) got[c.who] = await refusedSince(c);
    const all = Object.values(got).flat();
    const reasons = await p1.eval(`try { return (await import("${repoUrl}/scripts/bridge-guards.mjs")).REASONS ?? null; } catch { return null; }`);
    // Green since E31 C4.
    check("B1: every refusal a player was sent in this run carries a reason from the closed list",
        all.length >= 5 && Array.isArray(reasons) && reasons.length >= 30 && all.every(r => reasons.includes(r.reason)),
        JSON.stringify({ reasons: Array.isArray(reasons) ? reasons.length : reasons, got }));

    const playerErrors = {};
    for (const c of players) playerErrors[c.who] = await errorsOf(c);
    check("D: no exception escaped into Foundry on any player's client",
        Object.values(playerErrors).every(list => list.length === 0), JSON.stringify(playerErrors));
}
