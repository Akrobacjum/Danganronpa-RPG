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
 *      Reroll, kept on the GMs from its roller's report (A12). Since E09 C5 also a Sabotage's trace, tied to the
 *      crime when the saboteur's character is the trap's killer (A14). Since E79 C16 also an Objection aimed by the GM's
 *      voice Room and its Truth Bullet, chosen after it (A15). Since E80 C2 also a tunnel gone through, and the
 *      way back refused in the Class Trial with its reason (A16). Since H82 C5 also a drawn roll's dice on its
 *      roller's browser, with 80 ms added each way: started at the GM's message, before its answer, once (A17); and
 *      since H82 C6 on the GM's own screen: started at its throw, before its message's echo, once, the audience told.
 *   B  what E31 adds, each written red (`expectedRed`, with what it measured) until the commit that
 *      made it so, and a plain check since: a refusal carries its reason, in the player's own
 *      language; a refused request is not acknowledged; an exception on the GM's side ends as one
 *      refusal the player hears; a GM who is connected and silent is reported when the
 *      acknowledgement does not come; the trap relay reaches the GMs only; a refused search is told
 *      once.
 *   C  with no GM connected, three requests settle at once, send nothing and say the same thing; a
 *      call on the GM and its request window do the same and post no card (E18 C0); and a
 *      pre-session note, which is kept on the player's browser until a GM connects (E05).
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
    // A ruling card's closing lines in this browser's copy of its words: the one for everyone, then the GMs' own (E18 C1).
    const CARD_LINES = `return (async id => { const S = await import("${repoUrl}/scripts/secret.mjs");
        const m = game.messages.get(id); if (!m) return null;
        const t = document.createElement("template"); t.innerHTML = S.contentOf(m);
        const all = [...t.content.querySelectorAll(".drpg-call-settled")];
        return [all.filter(e => !e.closest(".drpg-gm-only")).map(e => e.textContent).join(" | ") || null,
            all.filter(e => e.closest(".drpg-gm-only")).map(e => e.textContent).join(" | ") || null]; })`;
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
        const { trustedWrite } = await import("${repoUrl}/scripts/resource-guard.mjs");
        const who = game.actors.get("${actorId}");
        if (actionsLeft(who) < 1) await trustedWrite(who, { "system.resources.actions.value": 1 }, { reason: "gmRuling" });
        await spendAction(who, 1, { quiet: true }); }`;
    /** One packet from p1 that its own client never sends: another player's character, in another player's name. */
    const forgeFromP1 = (action, requestId, fields) => p1.eval(`game.socket.emit("${SOCKET}",
        { action: "${action}", userId: "${IDS.p2}", requestId: "${requestId}", ...${JSON.stringify(fields)} }, ${toGms}); return true;`);
    const progressOf = id => `return { current: ${projects}.allProjects().find(p => p.id === "${id}")?.current ?? null };`;
    /* A PLAYER'S SABOTAGE NAMES ITS ROLL (E08+E28 C16, 04.10.2026): the GM makes the repair the GMs' record
       of that roll earned (gm-bridge.mjs `repairOf`). Code that throws a Sabotage of `actorId`'s at `targetId` the GM
       draws, on faces that earn a repair, and leaves the message it wrote in `rollId` - drawn for that project, the one
       its record lets it freeze since fix r2-H2. */
    const sabotageRoll = (actorId, targetId) => `const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        ${payFor(actorId)}
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        let thrown = null;
        try { thrown = await A.rollTrait(game.actors.get("${actorId}"), "eye", { actionKey: "sabotage", remember: false,
            context: { targetProjectId: "${targetId}" } }); }
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
    const firstRepair = await p2.eval(`${sabotageRoll(IDS.botan, proj.one)}
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
    // Since E10 C6 an offer is taken back by its id - the one the primary's answer to the offer named.
    const withdrawnAnswer = await ag.eval(`return await ${bridge}.requestOfferRecord("${IDS.aiko}", null, ${JSON.stringify(offered?.value?.id ?? null)});`, { timeout: 30000 });
    await settle(1500);
    const a7b = { offered, offer, withdrawnAnswer, withdrawn: await gm.eval(offerOf), logged: await refusalsLogged(gm, "advancement.offer") };
    check("A7: an Assistant GM's Level Up offer is recorded by the primary, and withdrawn the same way",
        offer === "standard" && a7b.withdrawn === null && !a7b.logged.length && notFailed(offered) && notFailed(withdrawnAnswer),
        JSON.stringify(a7b));

    /* A13. AN ASSISTANT GM'S YES TO A CALL (E29 fix r2-H4, 05.10.2026; the round-2 reviews' sec M4 and cor M1).
       An Experience waits for a GM's yes, and the primary arms a player's only with the yes it kept for that
       purchase (bridge-guards.mjs `guardArmGmYes`), so a yes given on another GM's screen goes by the primary
       (`call.yes`). p1 buys an Experience for Aiko through her sheet's own road (calls.mjs `spendHopeCall`), the
       card goes up in p1's thread, and the Assistant - who is not the primary - says yes on it: the primary keeps
       the yes and sends it on, p1's browser asks for the arm, and the primary charges and arms it. Read: the
       Assistant's answer, p1's, Aiko's Hope and armed list, and the refusals logged on the GM and told to p1.
       Aiko's Hope and armed list are put back after. Since E18 C1 the primary writes "Approved by" the Assistant
       on the card only on p1's receipt (`ruling.received`): read too, the card's lines on the GM, the one for
       everyone and the GMs' own. */
    phase("an Assistant GM's yes to a Call", { flow: "hope-call" });
    const a13was = await gm.eval(`const a = game.actors.get("${IDS.aiko}");
        const was = { hope: a.system.resources.hope.value, calls: a.getFlag("${MOD}", "pendingCall") ?? null };
        await a.unsetFlag("${MOD}", "pendingCall");
        await a.update({ "system.resources.hope.value": 3 });
        await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
        return was;`);
    await clearFailures(gm);
    mark = await refusedCount(p1);
    let a13 = null;
    try {
        const bought = p1.eval(`const C = await import("${repoUrl}/scripts/calls.mjs");
            const r = await C.spendHopeCall(game.actors.get("${IDS.aiko}"), "experience", { note: "E29 fix r2-H4: an Assistant's yes" });
            return r === null ? null : typeof r;`, { timeout: 90000 });
        await settle(1500);
        const card = await gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
            for (const m of game.drpg.messengerThreadMessages("${IDS.p1}").slice().reverse()) {
                const hit = S.contentOf(m).match(/data-drpg-call="approveCall"([^>]*)>/);
                if (hit) return { id: m.id, rid: hit[1].match(/data-rid="([^"]+)"/)?.[1] ?? null, asker: hit[1].match(/data-asker="([^"]+)"/)?.[1] ?? null };
            }
            return null;`);
        const yes = card ? await ag.eval(`const U = ${utils};
            return { primary: U.isPrimaryGm(), sent: await ${bridge}.answerHopeCall(${JSON.stringify(card.rid)}, ${JSON.stringify(card.asker)}, true) };`,
            { timeout: 30000 }) : null;
        // A yes that was not kept leaves p1's browser waiting out its five minutes: the primary says no, so it stops.
        if (card && yes?.sent !== true) await gm.eval(`await ${bridge}.answerHopeCall(${JSON.stringify(card.rid)}, ${JSON.stringify(card.asker)}, false); return true;`);
        const answer = await bought;
        await settle(900);
        const after = await gm.eval(`await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            const a = game.actors.get("${IDS.aiko}"), f = a.getFlag("${MOD}", "pendingCall");
            return { hope: a.system.resources.hope.value, armed: (Array.isArray(f) ? f : f ? [f] : []).map(e => e?.key ?? null) };`);
        const lines = card ? await gm.eval(`${CARD_LINES}("${card.id}")`) : null;
        a13 = { card, yes, answer, after, lines, approved: await gm.eval(`return game.i18n.format("DRPG.Bridge.settledApproved", { name: game.users.get("${IDS.ag}")?.name ?? "?" });`),
            logged: [...await refusalsLogged(gm, "call.yes"), ...await refusalsLogged(gm, "call.arm"), ...await refusalsLogged(gm, "ruling.received")],
            told: await refusedSince(p1, mark) };
    } finally {
        await gm.eval(`const a = game.actors.get("${IDS.aiko}"), was = ${JSON.stringify(a13was)};
            await (await import("${repoUrl}/scripts/sheet-audit.mjs")).sheetAuditIdle();
            await a.update({ "system.resources.hope.value": was.hope });
            if (was.calls) await a.setFlag("${MOD}", "pendingCall", was.calls); else await a.unsetFlag("${MOD}", "pendingCall");
            return true;`);
    }
    check("A13: an Assistant GM's yes to p1's Experience is kept by the primary, which arms it and charges it once - refused nowhere",
        Boolean(a13?.card?.rid) && a13.yes?.primary === false && a13.yes.sent === true && a13.answer === "object"
            && a13.after.hope === 2 && JSON.stringify(a13.after.armed) === JSON.stringify(["experience"])
            && JSON.stringify(a13.lines) === JSON.stringify([a13.approved, null])
            && !a13.logged.length && !a13.told.length, JSON.stringify(a13), { flow: "hope-call" });

    /* A17. AN ASK WHOSE PLAYER STOPPED WAITING ENDS ITS CARD (E18 C1, 19.10.2026; audits S10-25, S11-13). A Hope
       Call's card stayed open after the asking browser's clock had run out, and a GM's yes then was kept and sent to
       a browser that no longer waited. p1 asks for an Experience of Aiko's on the bridge's own road
       (`requestHopeCallApproval`) with a clock of 4 seconds and nobody answers; p1's browser says its "no answer"
       and sends `ruling.expired`, and the primary ends the card and drops the ask. The Assistant's yes after it is
       then not kept: the primary refuses it (one `call.yes` refusal logged on the GM, measured on this scenario's
       first run) and p1's own expiry is refused nowhere. Read: p1's answer, the card's lines on the GM (the one
       for everyone, the GMs' own) and in p1's copy, the Assistant's yes, and the refusals logged on the GM.
       Nothing is paid or armed: no yes stands. */
    phase("an ask whose player stopped waiting", { flow: "hope-call" });
    await clearFailures(gm);
    let a17 = null;
    {
        const asking = p1.eval(`return await ${bridge}.requestHopeCallApproval({ actorId: "${IDS.aiko}", key: "experience",
            note: "E18 C1: a clock that runs out", nonce: "E18C1A17" + Date.now() }, 4000);`, { timeout: 30000 });
        await settle(1500);
        const card = await gm.eval(`const S = await import("${repoUrl}/scripts/secret.mjs");
            for (const m of game.drpg.messengerThreadMessages("${IDS.p1}").slice().reverse()) {
                if (!S.contentOf(m).includes("E18 C1: a clock that runs out")) continue;
                return { id: m.id, rid: S.contentOf(m).match(/data-rid="([^"]+)"/)?.[1] ?? null };
            }
            return null;`);
        const asked = await asking;
        await settle(1500);
        const yes = card?.rid ? await ag.eval(`return await ${bridge}.answerHopeCall(${JSON.stringify(card.rid)}, "${IDS.p1}", true);`, { timeout: 30000 }) : null;
        await settle(900);
        a17 = { answer: asked?.reason ?? asked?.value ?? null, card, yes,
            lines: card ? await gm.eval(`${CARD_LINES}("${card.id}")`) : null,
            theirs: card ? await p1.eval(`${CARD_LINES}("${card.id}")`) : null,
            expired: await gm.eval(`return [game.i18n.localize("DRPG.Bridge.settledExpired"), game.i18n.localize("DRPG.Bridge.settledGone")];`),
            expiryRefused: await refusalsLogged(gm, "ruling.expired"), yesRefused: (await refusalsLogged(gm, "call.yes")).length };
        for (const id of [card?.id].filter(Boolean)) await gm.eval(`await game.messages.get("${id}")?.delete(); return true;`);
    }
    check("A17: p1's ask whose clock ran out ends its card on the primary, for p1 and the GMs, and the Assistant's yes after it is not kept",
        a17.answer === "noAnswer" && Boolean(a17.card?.id)
            && JSON.stringify(a17.lines) === JSON.stringify(a17.expired)
            && JSON.stringify(a17.theirs) === JSON.stringify([a17.expired[0], null])
            && a17.yes === false && !a17.expiryRefused.length && a17.yesRefused === 1,
        JSON.stringify(a17), { flow: "hope-call" });

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

    /* A SABOTAGE'S TRACE OF THE SABOTEUR'S OWN TRAP (E09 C5, 08.10.2026; audit S10-17). p2's browser does what
       action-rolls.mjs `performSabotage` does after its windows: Botan's roll drawn and kept on the GMs' row
       (`remember`, as the action's own roll is), the Sabotage naming it and awaited, then the trace in the shape
       `dropSabotageTrace` sends - asked tied, as it asks for any indirect murder. The GM decides the tie from the
       target its Sabotage noted on that roll's row: tied for the trap Botan is the killer of, not for Aiko's (shared
       with p2: a trap is seen only by its builder's players until then, and a Sabotage of one unseen is refused). The
       tier-2 tests make the row late on purpose; here the bookmark, the Sabotage and the trace race as the
       browsers send them. */
    phase("a Sabotage's trace of the saboteur's own trap", { flow: "trace-remnant" });
    const a14traps = await gm.eval(`const P = ${projects};
        const own = await P.createProject({ name: "E09 C5 Botan's trap", target: 8, room: "Cafeteria", indirectMurder: true, killerId: "${IDS.botan}" });
        const theirs = await P.createProject({ name: "E09 C5 Aiko's trap", target: 8, room: "Cafeteria", indirectMurder: true, killerId: "${IDS.aiko}",
            viewers: ["${IDS.p2}"] });
        return { own: own?.id ?? null, theirs: theirs?.id ?? null };`, { timeout: 60000 });
    await settle(600);
    await clearFailures(gm);
    mark = await refusedCount(p2);
    const sabotageWithTrace = (targetId, subject) => p2.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const R = await import("${repoUrl}/scripts/remnants.mjs");
        const actor = game.actors.get("${IDS.botan}");
        ${payFor(IDS.botan)}
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        let thrown = null;
        try { thrown = await A.rollTrait(actor, "eye", { actionKey: "sabotage", context: { targetProjectId: "${targetId}", penalty: 0, relief: 0 } }); }
        finally { delete globalThis.__forceRoll; }
        const rollId = thrown?.raw?.[A.DRAWN_ROLL]?.messageId ?? null;
        const frozen = await ${projects}.sabotageProject("${targetId}", 3, { rollId, actorId: actor.id, penalty: 0, relief: 0 });
        const placed = await R.dropRemnant(actor, { type: "prep", tiedToCrime: true, visibility: "subtle", faint: true,
            action: "sabotage", rollId, subject: "${subject}", note: "E09 C5" });
        return { rollId, repair: frozen?.repair?.id ?? null, placed: Boolean(placed) };`, { timeout: 60000 });
    const a14own = await sabotageWithTrace(a14traps.own, "E09 C5 own trap");
    const a14theirs = await sabotageWithTrace(a14traps.theirs, "E09 C5 Aiko's trap");
    await settle(1200);
    const a14 = { a14traps, a14own, a14theirs,
        ties: await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
            const tie = subject => canvas.scene.tokens.contents.map(t => R.remnantData(t)).filter(d => d?.subject === subject).map(d => d.tiedToCrime);
            return { own: tie("E09 C5 own trap"), theirs: tie("E09 C5 Aiko's trap") };`),
        logged: [...await refusalsLogged(gm, "project.sabotage"), ...await refusalsLogged(gm, "remnant.place")],
        told: await refusedSince(p2, mark) };
    check("A14: a player's Sabotage of the trap their character is the killer of leaves a tied trace, and of another's trap an untied one - refused nowhere",
        Boolean(a14own.rollId && a14own.repair && a14own.placed && a14theirs.rollId && a14theirs.repair && a14theirs.placed)
        && JSON.stringify(a14.ties) === JSON.stringify({ own: [true], theirs: [null] }) && !a14.logged.length && !a14.told.length,
        JSON.stringify(a14));
    await gm.eval(`const P = ${projects}; const R = await import("${repoUrl}/scripts/remnants.mjs");
        const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const traps = ${JSON.stringify(Object.values(a14traps).filter(Boolean))};
        for (const id of [...P.allProjects().filter(p => traps.includes(P.repairs(p.id))).map(p => p.id), ...traps]) await P.deleteProject(id);
        const left = canvas.scene.tokens.contents.filter(t => ["E09 C5 own trap", "E09 C5 Aiko's trap"].includes(R.remnantData(t)?.subject));
        for (const t of left) await t.delete();
        for (const id of ${JSON.stringify([a14own.rollId, a14theirs.rollId].filter(Boolean))}) await game.messages.get(id)?.delete();
        if (S.rerollBookmarkStore?.has("${IDS.botan}")) await S.rerollBookmarkStore.drop("${IDS.botan}");
        return true;`, { timeout: 60000 });

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
        /* WHETHER IT HAD ANSWERED IS READ AS THE MESSAGE IS SAID (E11 fix k4, 11.10.2026; e11run/k4b4b). Until
           this fix B4b compared the message's `at` with a `Date.now()` taken in this eval after the `await`, and
           k4 (c954c64) went red on it with the module's order right. The waiter answers on the GM's "got it" and
           says the refusal on the packet after it; when p1 reads both packets in one read of its socket, both
           handlers run before this `await` resumes, so the stamp lands after the message - 34-282 microseconds
           after it in the 104 sends of 200 that were read so (4 of 100 plain sends, and all 100 with p1's loop
           held 15 ms after the send; k4b4b/b4-repeat.mjs), and red whenever a millisecond ended in between (4 of
           those last 100). At the message the request's promise had settled in all 200. So p1's warn records, as
           it is called, whether that promise is still pending: `util.inspect` reads a native promise's state at
           once, where a `then` would run only after both handlers (read in the code, not timed). */
        const sent = await p1.eval(`const { inspect } = await import("node:util");
            const B = ${bridge};
            let asked = null;
            const warn = ui.notifications.warn;
            globalThis.__e31Warn = warn;
            globalThis.__e31AnsweredAtNotice = [];
            ui.notifications.warn = function (...args) {
                globalThis.__e31AnsweredAtNotice.push(asked !== null && !inspect(asked).includes("<pending>"));
                return warn.apply(this, args);
            };
            asked = B.requestSendBack(canvas.scene.id, "TOKAIKO000000000", { x: ${home.x}, y: ${home.y} });
            return { answer: await asked };`, { timeout: 30000 });
        await settle(2000);
        const b4 = {
            sent, answeredAtNotice: await p1.eval(`return globalThis.__e31AnsweredAtNotice;`),
            thrown: await gm.eval(`return globalThis.__e31Thrown.sendBack;`),
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
            && b4.answeredAtNotice.length === 1 && b4.answeredAtNotice[0] === true
            && !b4.failed.startsWith("DRPG.") && b4.said[0].msg.includes(b4.failed), JSON.stringify(b4));
    } finally {
        await p1.eval(`if (globalThis.__e31Warn) ui.notifications.warn = globalThis.__e31Warn;
            delete globalThis.__e31Warn; delete globalThis.__e31AnsweredAtNotice; return true;`);
        await gm.eval(`const t = canvas.scene.tokens.get("TOKAIKO000000000"); delete t.update;
            await t.update({ x: ${home.x}, y: ${home.y} }); return true;`);
        await settle(600);
    }

    // B5: an exception in a request that is answered (project.sabotage): the repair's write throws.
    phase("an exception in an answered request", { flow: "projects" });
    // In Aiko's room: since fix r2-H2 a player's Sabotage is made standing at its project (bridge-guards.mjs `guardSabotageRoom`).
    const target = await gm.eval(`const P = ${projects};
        const room = (await import("${repoUrl}/scripts/movement.mjs")).locateActor(game.actors.get("${IDS.aiko}"))?.room ?? null;
        const t = await P.createProject({ name: "E31 target", target: 6, room, secret: false });
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
        const answered = await p1.eval(`${sabotageRoll(IDS.aiko, target)}
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

    /* A15. AN OBJECTION AND ITS TRUTH BULLET (E79 C16, 1.2.79; the owner, 17.10.2026). OBJECTION! is aimed at whoever
       the primary GM's LiveKit Room counts as speaking, and the bullet is chosen after it, two requests from the
       objector's browser (`trial.object`, `trial.evidence`). The harness's LiveKit (lib/livekit.mjs) is installed on
       the GM alone; the clock is put in a Class Trial and a debate opened there, Aiko given a bullet and her actions
       (the GM's API, not under test), and Botan's player speaks on the GM's Room for 1.2 s. p1 asks the objection with
       no target in its packet, then the bullet: each answered, aimed at Botan as speaking now, the card filled, one
       action paid, and no refusal logged on the GM or told to p1. Put back after: the floor ended, the clock, Aiko's
       actions and the bullet, the GM's Room left. Its forgeries are 30-security's. */
    phase("an Objection and its Truth Bullet", { flow: "class-trial" });
    const F15 = `const F = await import("${repoUrl}/scripts/trial-floor.mjs"); const T = await import("${repoUrl}/scripts/trial.mjs");`;
    await clearFailures(gm);
    const told15 = await refusedCount(p1);
    const set15 = await gm.eval(`${F15} const B = await import("${repoUrl}/scripts/truth-bullets.mjs");
        const { sheetAuditIdle } = await import("${repoUrl}/scripts/sheet-audit.mjs");
        if (typeof globalThis.__liveKit?.install !== "function") return null;
        await __liveKit.install(); __liveKit.setRoster({ [__liveKit.MAIN_ROOM]: ${JSON.stringify([IDS.gm, IDS.p1, IDS.p2, IDS.p3])} });
        const room = await game.webrtc.connect();
        const aiko = game.actors.get("${IDS.aiko}");
        globalThis.__s33a15 = { clock: foundry.utils.deepClone(game.settings.get("${MOD}", "clock")),
            actions: foundry.utils.deepClone(aiko.system.resources.actions), grants: aiko.getFlag("${MOD}", "freeActionGrants") ?? null };
        const item = await B.createTruthBullet(aiko, { name: "S33 A15 the evidence", realType: "neutral", visibility: "obvious" });
        await aiko.setFlag("${MOD}", "freeActionGrants", 0);
        await aiko.update({ "system.resources.actions.max": 3, "system.resources.actions.value": 3 });
        await game.settings.set("${MOD}", "clock", { ...globalThis.__s33a15.clock, phase: "classTrial" });
        if (F.trialFloor()) await F.endFloor();
        await F.startFloor({});
        await sheetAuditIdle();
        __liveKit.speak(["${IDS.p2}"]);
        await new Promise(r => setTimeout(r, 1200));
        return { room, item: item?.id ?? null, floor: F.trialFloor()?.mode ?? null };`, { timeout: 60000 });
    await settle(800);
    const object15 = await p1.eval(`return await ${bridge}.requestObject({ actorId: "${IDS.aiko}" });`, { timeout: 30000 });
    await settle(800);
    const evidence15 = await p1.eval(`return await ${bridge}.requestEvidence({ actorId: "${IDS.aiko}", itemId: "${set15?.item ?? ""}", comment: "S33 A15" });`,
        { timeout: 30000 });
    await settle(1200);
    const a15 = { set15, object: object15, evidence: evidence15, floor: await gm.eval(`${F15} const f = F.trialFloor();
            const m = f?.messageId ? game.messages.get(f.messageId) : null;
            return { mode: f?.mode ?? null, holder: f?.holderId ?? null, target: f?.targetId ?? null, pending: f?.pending ?? null,
                item: m?.getFlag("${MOD}", T.TRIAL_FLAGS.item) ?? null, how: m?.getFlag("${MOD}", T.TRIAL_FLAGS.how) ?? null,
                actions: game.actors.get("${IDS.aiko}").system.resources.actions.value };`),
        logged: [...await refusalsLogged(gm, "trial.object"), ...await refusalsLogged(gm, "trial.evidence")],
        told: (await refusedSince(p1, told15)).filter(t => /^trial\./.test(t.what ?? "")) };
    check("A15: p1's Objection with no target in its packet is aimed at Botan as the GM's Room hears him, its bullet fills the card, one action is paid, and nothing is refused",
        set15?.room === true && set15.floor === "debate" && object15?.ok === true && object15.value?.how === "now" && object15.value?.target === "Botan Kage"
            && evidence15?.ok === true && evidence15.value?.item === "S33 A15 the evidence" && a15.floor.mode === "objection" && a15.floor.holder === IDS.aiko
            && a15.floor.target === IDS.botan && a15.floor.pending === false && a15.floor.item === set15.item && a15.floor.how === "now"
            && a15.floor.actions === 2 && a15.logged.length === 0 && a15.told.length === 0, JSON.stringify(a15));
    /* A15b (E79 fix r4-G2, 1.2.79; cor F4): the objector's picker closed. The GM puts the floor back to the debate (its
       API, not under test), p1 raises a second Objection and asks its withdrawal (`trial.withdraw`, the request
       `raiseObjection` makes when the picker answers nothing): the GM's floor back in the debate, the card marked
       withdrawn, the second action not given back, and nothing refused. */
    await gm.eval(`${F15} await F.returnToDebate({}); return true;`);
    await settle(500);
    const object15b = await p1.eval(`return await ${bridge}.requestObject({ actorId: "${IDS.aiko}" });`, { timeout: 30000 });
    await settle(800);
    // Read as a result: at the fix's parent the bridge had no such request, and that is the red this step reads.
    const withdraw15b = await p1.eval(`const B = ${bridge}; return typeof B.requestWithdraw === "function"
        ? await B.requestWithdraw({ actorId: "${IDS.aiko}", messageId: "${object15b?.value?.messageId ?? ""}" }) : null;`, { timeout: 30000 });
    await settle(1200);
    const a15b = { object: object15b, withdraw: withdraw15b, floor: await gm.eval(`${F15} const f = F.trialFloor();
            const m = game.messages.get("${object15b?.value?.messageId ?? ""}");
            return { mode: f?.mode ?? null, pending: Boolean(m?.getFlag("${MOD}", T.TRIAL_FLAGS.pending)), withdrawn: Boolean(m?.getFlag("${MOD}", T.TRIAL_FLAGS.withdrawn)),
                actions: game.actors.get("${IDS.aiko}").system.resources.actions.value };`),
        logged: await refusalsLogged(gm, "trial.withdraw"),
        told: (await refusedSince(p1, told15)).filter(t => /^trial\./.test(t.what ?? "")) };
    check("A15b: p1's withdrawal of its pending Objection puts the GM's floor back in the debate and the card withdrawn, the action kept, nothing refused",
        object15b?.ok === true && Boolean(object15b.value?.messageId) && withdraw15b?.ok === true && a15b.floor.mode === "debate" && a15b.floor.pending === false
            && a15b.floor.withdrawn === true && a15b.floor.actions === 1 && a15b.logged.length === 0 && a15b.told.length === 0, JSON.stringify(a15b));
    await gm.eval(`${F15} const aiko = game.actors.get("${IDS.aiko}"), was = globalThis.__s33a15;
        if (F.trialFloor()) await F.endFloor();
        if (was) {
            await game.settings.set("${MOD}", "clock", was.clock);
            await aiko.update({ "system.resources.actions.max": was.actions.max, "system.resources.actions.value": was.actions.value });
            if (was.grants === null) await aiko.unsetFlag("${MOD}", "freeActionGrants"); else await aiko.setFlag("${MOD}", "freeActionGrants", was.grants);
        }
        const item = aiko.items.get(${JSON.stringify(set15?.item ?? "")});
        if (item) await item.delete();
        await game.webrtc.disconnect?.();
        return true;`, { timeout: 60000 });
    await settle(800);

    /* A16. A TUNNEL GONE THROUGH (E80 C2, 18.10.2026). 'Go through' is a request from the knower's browser
       (`passage.cross`), carried out on the primary GM. The GM makes a tunnel from Dorm A to the Gym and grants it to
       Aiko, stands her at its Dorm A end with two actions and no free Move (the GM's API, not under test). p1 asks: she
       lands by the Gym's end, one action paid, no refusal logged on the GM or told to p1, nothing on the GM's screen.
       Then the clock is put in the Class Trial and p1 asks back: refused with its reason, `trialLocked`, logged once on
       the GM, nothing moved or paid. Put back after: the clock, Aiko's token, actions and free Move, the tunnel. Its
       forgeries and the console's jump are 76-passages' phase U. */
    phase("a tunnel gone through", { flow: "secret-passages" });
    const PLACE16 = JSON.stringify({ teleport: true, movementAction: "displace", animate: false });
    await clearFailures(gm);
    const set16 = await gm.eval(`const scene = game.scenes.get("${IDS.scene}"), t = scene.tokens.get("TOKAIKO000000000"), aiko = t.actor;
        const id = await game.drpg.passages.create({ sceneId: scene.id, shape: "tunnel", ends: [{ x: 720, y: 730, level: null }, { x: 1930, y: 1760, level: null }] });
        const granted = await game.drpg.passages.grant(id, "${IDS.aiko}");
        globalThis.__s33a16 = { id, at: { x: t.x, y: t.y }, actions: game.drpg.actionsLeft(aiko), free: aiko.getFlag("${MOD}", "freeMoveUsed") ?? null,
            clock: foundry.utils.deepClone(game.settings.get("${MOD}", "clock")) };
        await t.update({ x: 700, y: 700 }, ${PLACE16});
        await game.drpg.setActions(aiko, 2);
        await aiko.setFlag("${MOD}", "freeMoveUsed", true);
        return { id, granted, charge: game.settings.get("${MOD}", "chargeMovement"), actions: game.drpg.actionsLeft(aiko) };`, { timeout: 30000 });
    const known16 = () => p1.eval(`const { knownPassages } = await import("${repoUrl}/scripts/passages.mjs"); return Boolean(knownPassages()?.["${set16?.id ?? ""}"]);`);
    for (const t0 = Date.now(); !(await known16()) && Date.now() - t0 < 8000;) await settle(200);
    const ask16 = async () => {
        const [told0, notes0, gmNotes0] = [await refusedCount(p1), await noticeCount(p1), await noticeCount(gm)];
        // Read as a result: at 917280b the bridge has no such request, and that is the red A16 reads.
        const res = await p1.eval(`const B = ${bridge};
            if (typeof B.requestPassageCross !== "function") return { ok: null, value: null, reason: "no requestPassageCross" };
            const res = await B.requestPassageCross({ actorId: "${IDS.aiko}", passageId: "${set16?.id ?? ""}" });
            return { ok: res.ok, value: res.value ?? null, reason: res.reason ?? null };`, { timeout: 30000 });
        await settle(1200);
        return { res, ...(await gm.eval(`const t = game.scenes.get("${IDS.scene}").tokens.get("TOKAIKO000000000");
                return { at: [t.x, t.y], actions: game.drpg.actionsLeft(t.actor) };`)),
            logged: await refusalsLogged(gm, "passage.cross"), told: (await refusedSince(p1, told0)).filter(t => t.what === "passage.cross"),
            notes: (await noticesSince(p1, notes0)).length, gmNotes: (await noticesSince(gm, gmNotes0)).length };
    };
    const went16 = { known: await known16(), ...(await ask16()) };
    check("A16: p1's 'Go through' of the tunnel it knows is carried out by the primary GM - Aiko lands by the Gym's end, one action paid, nothing refused or told, nothing on the GM's screen",
        set16?.granted === true && set16.charge === true && set16.actions === 2 && went16.known === true && went16.res.ok === true && went16.res.value === true
            && JSON.stringify(went16.at) === JSON.stringify([1900, 1700]) && went16.actions === 1 && went16.logged.length === 0 && went16.told.length === 0
            && went16.notes === 0 && went16.gmNotes === 0, JSON.stringify({ set16, went16 }));
    const trial16 = await gm.eval(`await game.settings.set("${MOD}", "clock", { ...globalThis.__s33a16.clock, phase: "classTrial" });
        return game.drpg.actionsLeft(game.actors.get("${IDS.aiko}"));`);
    await settle(500);
    const back16 = await ask16();
    check("A16: in the Class Trial p1's way back is refused with its reason, trialLocked, logged once on the GM and told to p1 once - Aiko where she stood, nothing paid, nothing on the GM's screen",
        back16.res.ok === false && back16.logged.length === 1 && back16.told.length === 1 && back16.told[0].reason === "trialLocked"
            && JSON.stringify(back16.at) === JSON.stringify([1900, 1700]) && back16.actions === trial16 && back16.gmNotes === 0, JSON.stringify({ trial16, back16 }));
    const restored16 = await gm.eval(`const scene = game.scenes.get("${IDS.scene}"), t = scene.tokens.get("TOKAIKO000000000"), aiko = t.actor, was = globalThis.__s33a16;
        if (!was) return null;
        await game.settings.set("${MOD}", "clock", was.clock);
        await t.update(was.at, ${PLACE16});
        await game.drpg.setActions(aiko, was.actions);
        if (was.free === null) await aiko.unsetFlag("${MOD}", "freeMoveUsed"); else await aiko.setFlag("${MOD}", "freeMoveUsed", was.free);
        const gone = await game.drpg.passages.delete(was.id);
        delete globalThis.__s33a16;
        return { gone, at: [t.x, t.y], actions: game.drpg.actionsLeft(aiko), was: [was.at.x, was.at.y], wasActions: was.actions };`, { timeout: 30000 });
    await settle(800);
    check("A16: put back - the tunnel deleted, the clock, Aiko where she stood with her actions",
        restored16?.gone === true && JSON.stringify(restored16.at) === JSON.stringify(restored16.was) && restored16.actions === restored16.wasActions,
        JSON.stringify(restored16));

    /* A17. A DRAWN ROLL'S DICE START AT THE GM'S MESSAGE (H82 C5, 23.10.2026; H82-06; the owner's 21.10: "delay przy
       rzucaniu koscmi czego nie bylo", and 23.10: before the dice start). Since 1.2.67 (ba6f366c for an action's roll,
       22f947c9 for a statistic from the sheet) a player's roll is drawn on the primary GM, and until H82 C5 its roller's
       dice started only on the GM's answer (roll-draw.mjs `playBack`): six one-way hops after the press, where the GM's
       message arrives at four, and behind every write the GM makes before it answers. H82's look back measured it with
       the harness booting each tag and the same delay added each way on every client (its probe wraps the harness's
       IPC, as `LAG` below does): 162-166 ms from Roll to dice for 1.2.50-1.2.66, 490-500 ms from 1.2.67. The same
       probe at 952a2d9 (23.10.2026, 80 ms each way, medians of 10): a statistic from the sheet 495.1 ms to the dice
       and 327.1 ms to the card, an action's roll 545.8 ms and 327.7 ms. Here, with 80 ms added on every message each
       client sends and receives (held inside this part alone), p1 throws Aiko's statistic from the sheet and her Eye
       through the module, one of each to warm up and then two of each, and reads from its roll.draw going out: the
       GM's message in, each `showForRoll`, and the GM's answer (`bridge.done`) in. The dice must start before the
       answer, within one hop of the message - they start at it - once a roll, as p1's and not synchronised, on the
       message's total; the trips p1 keeps (`drawTimings`) start before their answer; and a draw the GM refuses (an
       Observe nobody paid for, `drawRefusal`'s 1.5 s wait) throws nothing on p1 and is told once. A check reads a
       hop (the delay) or an order, never a millisecond; the numbers are in the details. At 952a2d9 the dice started
       on the answer, after it, and the trips kept no start: red.
       THE GM'S OWN SCREEN (H82 C6, 24.10.2026; H82-07, the look back's option 2). Until C6 the primary GM threw a
       drawn roll's dice on its own screen as its message was created there (private-rolls.mjs `relayDrawnDice`, from
       the claim's createChatMessage): the echo of its own write, two hops after the write left, so four after p1's
       press where 1.2.66's GM saw a player's dice at two. Read on the GM, from roll.draw's arrival there (stamped as
       it reaches the process, as the answer is on p1): each `showForRoll` and the drawn message's createChatMessage;
       and, on the GM and the Assistant GM, each dice.show the GM sends and each throw the Assistant makes. The GM's
       dice must start within one hop of the request's arrival and a hop before the echo, once a roll, as p1's and
       not synchronised, on the message's total; the Assistant still gets one dice.show a roll (p1 never) and
       throws it once as p1's; a refused draw throws and sends nothing on the GM. Red at dbda7aa (the dice at the
       echo). */
    phase("a drawn roll's dice, with the network's time", { flow: "gm-rolls-total" });
    const A17_LAG = 80;
    const lagged = [gm, ag, p1, p2, p3];
    /* The look back's wrapping (hist-lat/lat-probe.mjs, 23.10.2026): out, process.send of op/setting/socket (client to
       server); in, the process 'message' event of apply/ack/settingApplied/socketMsg/userActivity (server to client);
       the harness's own control channel never held. Equal delays keep each direction's order. Put back at the end. */
    const LAG = `if (!globalThis.__s33lag) {
            const OUT = new Set(["op", "setting", "socket"]), IN = new Set(["apply", "ack", "settingApplied", "socketMsg", "userActivity"]);
            const L = globalThis.__s33lag = { delay: 0, send: process.send, emit: process.emit, done: [], asked: [] };
            const realSend = process.send.bind(process), realEmit = process.emit;
            process.send = (m, ...rest) => {
                if (L.delay > 0 && m && OUT.has(m.t)) { setTimeout(() => realSend(m, ...rest), L.delay); return true; }
                return realSend(m, ...rest);
            };
            /* The GM's answer to this client, stamped as it reaches the process and before any listener: the
               socket's listeners run in turn, and the module's playBack ran ahead of one added after it. */
            const answer = m => {
                if (m.t !== "socketMsg") return;
                if (m.args?.[0]?.action === "bridge.done") L.done.push({ at: performance.now(), id: m.args[0].requestId ?? null });
                // A player's roll.draw as it reaches the GM's process (H82 C6), the mark the GM's own dice are read from.
                if (m.args?.[0]?.action === "roll.draw") L.asked.push({ at: performance.now(), wall: Date.now(), id: m.args[0].requestId ?? null });
            };
            process.emit = function (ev, m, ...rest) {
                if (ev === "message" && m && IN.has(m.t)) {
                    const go = () => { answer(m); return realEmit.call(process, ev, m, ...rest); };
                    if (L.delay > 0) { setTimeout(go, L.delay); return true; }
                    return go();
                }
                return realEmit.call(process, ev, m, ...rest);
            };
        }
        return true;`;
    for (const c of lagged) await c.eval(LAG);
    const setLag = ms => Promise.all(lagged.map(c => c.eval(`globalThis.__s33lag.delay = ${ms}; return true;`)));
    const hope17 = await gm.eval(`return game.actors.get("${IDS.aiko}").system.resources.hope.value;`);
    const had17 = await gm.eval(`return game.messages.contents.map(m => m.id);`);
    // On p1, the GM and the Assistant GM: each throw, each message with rolls as it is created, each roll.draw and
    // dice.show sent (with its recipients); `wall` (Date.now()) is the one clock the processes share, read to the ms.
    const watched = [p1, gm, ag];
    for (const c of watched) await c.eval(`const T = globalThis.__s33a17 = { shows: [], msgs: [], sent: [], told: [] };
        const d3 = game.dice3d;
        T.show = d3.showForRoll;
        d3.showForRoll = function (roll, user, sync, ...rest) {
            T.shows.push({ at: performance.now(), wall: Date.now(), user: user?.id ?? user ?? null, sync: Boolean(sync), total: roll?.total ?? null });
            return T.show.call(this, roll, user, sync, ...rest);
        };
        T.hook = Hooks.on("createChatMessage", m => {
            if ((m.rolls ?? []).length) T.msgs.push({ at: performance.now(), id: m.id, gm: m.author?.isGM === true, total: m.rolls[0]?.total ?? null });
        });
        T.emit = game.socket.emit;
        game.socket.emit = function (event, packet, opts, ...rest) {
            if (packet?.action === "roll.draw") T.sent.push({ at: performance.now(), wall: Date.now(), id: packet.requestId ?? null });
            if (packet?.action === "dice.show") T.told.push({ id: packet.id ?? null, by: packet.by ?? null, to: [...(opts?.recipients ?? [])].sort() });
            return T.emit.call(this, event, packet, opts, ...rest);
        };
        return true;`);
    const marks17 = () => Promise.all([gm, ag].map(c => c.eval(`const T = globalThis.__s33a17, L = globalThis.__s33lag;
        return [T.shows.length, T.msgs.length, T.told.length, L.asked.length];`)));
    /* The GM's side of one draw, from the marks taken before it: on the GM's own clock from roll.draw's arrival - its
       throws, its drawn message's createChatMessage (the echo), its dice.show packets; the Assistant's throws. */
    const gmSide17 = async ([g, a]) => {
        const G = await gm.eval(`const T = globalThis.__s33a17, L = globalThis.__s33lag;
            const asked = L.asked.slice(${g[3]})[0] ?? null, rel = x => asked === null || typeof x !== "number" ? null : +(x - asked.at).toFixed(1);
            const msg = T.msgs.slice(${g[1]}).find(m => m.gm) ?? null, shows = T.shows.slice(${g[0]});
            return { asks: L.asked.length - ${g[3]}, askedWall: asked?.wall ?? null, started: rel(shows[0]?.at), startedWall: shows[0]?.wall ?? null, echo: rel(msg?.at),
                messageId: msg?.id ?? null, messageTotal: msg?.total ?? null, shows: shows.map(s => ({ at: rel(s.at), user: s.user, sync: s.sync, total: s.total })),
                told: T.told.slice(${g[2]}) };`);
        const A = await ag.eval(`const T = globalThis.__s33a17; return T.shows.slice(${a[0]}).map(s => ({ user: s.user, sync: s.sync, total: s.total }));`);
        return { ...G, ag: A };
    };
    const throw17 = kind => p1.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
        const T = globalThis.__s33a17, c = game.actors.get("${IDS.aiko}");
        const s0 = T.shows.length, m0 = T.msgs.length, q0 = T.sent.length;
        globalThis.__forceRoll = { hope: 9, fear: 4 };
        let total = null, err = null;
        try {
            if (${JSON.stringify(kind)} === "sheet") { const r = await c.rollTrait("strength", {}); total = r?.roll?.total ?? r?.total ?? null; }
            else { const r = await A.rollTrait(c, "eye", { remember: false }); total = r?.total ?? r?.roll?.total ?? null; }
        } catch (e) { err = String(e?.message ?? e).slice(0, 200); } finally { delete globalThis.__forceRoll; }
        await new Promise(r => setTimeout(r, 400));
        const sent = T.sent.slice(q0), t0 = sent[0]?.at ?? null;
        const rel = x => t0 === null || typeof x !== "number" ? null : +(x - t0).toFixed(1);
        const shows = T.shows.slice(s0), msg = T.msgs.slice(m0).find(m => m.gm) ?? null;
        const done = globalThis.__s33lag.done.find(d => d.id !== null && d.id === sent[0]?.id) ?? null;
        return { kind: ${JSON.stringify(kind)}, total, err, sent: sent.length, sentWall: sent[0]?.wall ?? null, message: rel(msg?.at), started: rel(shows[0]?.at), answer: rel(done?.at),
            messageTotal: msg?.total ?? null, shows: shows.map(s => ({ at: rel(s.at), user: s.user, sync: s.sync, total: s.total })) };`, { timeout: 60000 });
    let rows17 = [], refused17 = null, trips17 = null;
    try {
        await setLag(A17_LAG);
        await settle(400);
        await throw17("sheet");
        await throw17("action");
        await settle(600);
        for (const kind of ["sheet", "action", "sheet", "action"]) {
            const before = await marks17();
            const row = await throw17(kind);
            await settle(600);
            row.gm = await gmSide17(before);
            // From p1's roll.draw out to the GM's first throw, on the shared wall clock (ms): the look back's "GM's screen".
            row.gm.fromAsk = typeof row.sentWall === "number" && typeof row.gm.startedWall === "number" ? row.gm.startedWall - row.sentWall : null;
            rows17.push(row);
        }
        trips17 = await p1.eval(`const D = await import("${repoUrl}/scripts/roll-draw.mjs");
            return D.drawTimings().drawn.slice(-${rows17.length}).map(t => ({ started: t.started ?? null, answered: t.answered ?? null, shown: t.shown ?? null }));`);
        mark = await refusedCount(p1);
        const before17 = await marks17();
        refused17 = await p1.eval(`const A = await import("${repoUrl}/scripts/action-rolls.mjs");
            const T = globalThis.__s33a17, c = game.actors.get("${IDS.aiko}");
            const s0 = T.shows.length, m0 = T.msgs.length, q0 = T.sent.length;
            let out = null, err = null;
            try { out = await A.rollTrait(c, "eye", { actionKey: "observe", remember: false }); } catch (e) { err = String(e?.message ?? e).slice(0, 200); }
            await new Promise(r => setTimeout(r, 800));
            return { made: out ? true : false, err, sent: T.sent.length - q0, shows: T.shows.length - s0, msgs: T.msgs.length - m0 };`, { timeout: 60000 });
        refused17.told = (await refusedSince(p1, mark)).map(r => `${r.what}:${r.reason}`);
        await settle(400);
        refused17.gm = await gmSide17(before17);
    } finally {
        await setLag(0);
        for (const c of lagged) await c.eval(`const L = globalThis.__s33lag; if (L) { process.send = L.send; process.emit = L.emit; delete globalThis.__s33lag; } return true;`);
        for (const c of watched) await c.eval(`const T = globalThis.__s33a17;
            if (T) { game.dice3d.showForRoll = T.show; game.socket.emit = T.emit; Hooks.off("createChatMessage", T.hook); }
            delete globalThis.__s33a17; return true;`);
        await settle(400);
        await gm.eval(`const had = new Set(${JSON.stringify(had17)});
            for (const m of game.messages.contents.filter(x => !had.has(x.id))) await m.delete();
            await game.actors.get("${IDS.aiko}").update({ "system.resources.hope.value": ${JSON.stringify(hope17)} });
            return true;`, { timeout: 60000 });
        await settle(600);
    }
    const lagHeld = rows17.length === 4 && rows17.every(r => typeof r.message === "number" && r.message >= 3 * A17_LAG);
    const median = xs => { const v = xs.filter(x => typeof x === "number").sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
    const said17 = JSON.stringify({ lag: A17_LAG, started: median(rows17.map(r => r.started)), message: median(rows17.map(r => r.message)),
        answer: median(rows17.map(r => r.answer)), rows: rows17 });
    check("A17: with 80 ms each way, every drawn roll was asked once and its message came at least three hops after (the delay held)",
        lagHeld && rows17.every(r => r.err === null && r.sent === 1 && typeof r.answer === "number"), said17, { flow: "gm-rolls-total" });
    check("A17: p1's dice start at the GM's message - before the GM's answer, within one hop of the message - for a statistic from the sheet and an action's roll",
        lagHeld && rows17.every(r => typeof r.started === "number" && r.started < r.answer && r.started - r.message < A17_LAG), said17, { flow: "gm-rolls-total" });
    check("A17: each drawn roll is thrown once on p1, as p1's dice, not synchronised, on its message's total",
        lagHeld && rows17.every(r => r.shows.length === 1 && r.shows[0].user === IDS.p1 && r.shows[0].sync === false
            && typeof r.messageTotal === "number" && r.shows[0].total === r.messageTotal), said17, { flow: "gm-rolls-total" });
    check("A17: the trips p1 keeps (drawTimings) say when its dice started, before the GM's answer came in",
        Array.isArray(trips17) && trips17.length === 4 && trips17.every(t => typeof t.started === "number" && typeof t.answered === "number" && t.started < t.answered),
        JSON.stringify(trips17), { flow: "gm-rolls-total" });
    check("A17: a draw the GM refuses (an Observe nobody paid for) throws nothing on p1, writes no message, and is told to p1 once",
        refused17?.sent === 1 && refused17.made === false && refused17.shows === 0 && refused17.msgs === 0 && refused17.told.length === 1,
        JSON.stringify(refused17), { flow: "gm-rolls-total" });
    // H82 C6 (H82-07): the GM's own screen. The numbers are in the details; a check reads a hop or an order.
    const gm17 = rows17.map(r => r.gm ?? {});
    const saidGm17 = JSON.stringify({ lag: A17_LAG, started: median(gm17.map(g => g.started)), echo: median(gm17.map(g => g.echo)),
        fromAsk: median(gm17.map(g => g.fromAsk)), gm: gm17 });
    check("A17: the GM's own screen starts a drawn roll's dice at its throw - within one hop of the request's arrival, a hop before its message's echo",
        lagHeld && gm17.every(g => g.asks === 1 && typeof g.started === "number" && typeof g.echo === "number"
            && g.started < A17_LAG && g.started < g.echo - A17_LAG), saidGm17, { flow: "gm-rolls-total" });
    check("A17: each drawn roll is thrown once on the GM's screen, as p1's dice, not synchronised, on its message's total",
        lagHeld && gm17.every(g => g.shows?.length === 1 && g.shows[0].user === IDS.p1 && g.shows[0].sync === false
            && typeof g.messageTotal === "number" && g.shows[0].total === g.messageTotal), saidGm17, { flow: "gm-rolls-total" });
    check("A17: the audience is still told - one dice.show from the GM a drawn roll, naming its message and p1, to the Assistant GM and never to p1 - and the Assistant throws it once as p1's",
        lagHeld && gm17.every(g => g.told?.length === 1 && g.told[0].id === g.messageId && g.told[0].by === IDS.p1
            && g.told[0].to.includes(IDS.ag) && !g.told[0].to.includes(IDS.p1)
            && g.ag?.length === 1 && g.ag[0].user === IDS.p1 && g.ag[0].sync === false), saidGm17, { flow: "gm-rolls-total" });
    check("A17: a draw the GM refuses throws nothing on the GM's screen and sends no dice",
        refused17?.gm?.asks === 1 && refused17.gm.shows.length === 0 && refused17.gm.told.length === 0 && refused17.gm.ag.length === 0,
        JSON.stringify(refused17?.gm ?? null), { flow: "gm-rolls-total" });

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

    // C's Resolve below needs the Hope p1's browser counts before it asks (E29 C8): 3, written by the Assistant while it is here.
    await ag.eval(`await game.actors.get("${IDS.aiko}").update({ "system.resources.hope.value": 3 }); return true;`);
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
    /* E29 C8 (05.10.2026; the plan's 3.3): a Call on p1's own character - a Resolve, 3 Hope, all Aiko holds - is bought on
       the GM now, so with no GM connected it settles at once, sends nothing, and arms and pays nothing; the bridge says there
       is no GM, and the Call's own line that nothing was taken follows it. Until C8 p1's browser paid and armed it itself. */
    const c5 = await offline("call.arm", `(await import("${repoUrl}/scripts/calls.mjs")).spendHopeCall(game.actors.get("${IDS.aiko}"), "determination")`);
    const c5After = await p1.eval(`const a = game.actors.get("${IDS.aiko}"), f = a.getFlag("${MOD}", "pendingCall");
        return { hope: a.system.resources.hope.value, resolve: (Array.isArray(f) ? f : f ? [f] : []).some(e => e?.grants === "trait"),
            noGm: game.i18n.localize("DRPG.Bridge.why.noGm") };`);
    check("C: with no GM connected, p1's Resolve on its own character settles at once, sends nothing, arms and pays nothing, and says there is no GM",
        c5.answer === null && c5.ms < 1000 && c5.sent === 0 && c5After.hope === 3 && c5After.resolve === false
        && c5.said.some(m => m.includes(c5.label) && m.includes(c5After.noGm)), JSON.stringify({ c5, c5After }), { flow: "call-arm" });
    /* E80 fix r1-G4 (19.10.2026; the review's goal-P2-20 and sec-3, the A11 design's A11-14): p1's Frisk with no GM connected,
       Openly and then Unseen - the Palm window's answer queued as a player gives it (the Frisk, Botan and the mode) - is
       refused before its window and its price (action-rolls.mjs `performAction`'s gate): the actions unchanged, no window
       opened and the answer queued for it left unread, nothing sent, and one line said: that an action roll waits for a GM.
       The gate stood at the parent already (the review's sec-3): this check is what keeps a Frisk-only road past it red. */
    const friskOffline = [];
    for (const mode of ["openly", "unseen"]) {
        const c = await offline("action.friskAsk", `(async () => {
            const a = game.actors.get("${IDS.aiko}"), before = game.drpg.actionsLeft(a), opened = globalThis.__dialogLog.length;
            globalThis.__dialogAnswers.push(() => ({ value: "frisk", form: { querySelector: sel => sel.includes("who") ? { value: "${IDS.botan}" }
                : sel.includes("friskMode") ? { value: "${mode}" } : null } }));
            const r = await game.drpg.performAction(a, "palm", {});
            const unread = globalThis.__dialogAnswers.length;
            globalThis.__dialogAnswers.length = 0;
            return { r: r ?? null, actions: [before, game.drpg.actionsLeft(a)], windows: globalThis.__dialogLog.length - opened, unread };
        })()`);
        friskOffline.push({ mode, ...c });
    }
    const waitsForGm = await p1.eval(`return game.i18n.localize("DRPG.Rolls.waitsForGm");`);
    check("C: with no GM connected, p1's Frisk, Openly and Unseen, is refused before its window and its price - the actions unchanged, nothing sent, one line: an action roll waits for a GM",
        friskOffline.length === 2 && friskOffline.every(c => c.answer && c.answer.r === null && c.answer.actions[0] === c.answer.actions[1]
            && c.answer.windows === 0 && c.answer.unread === 1 && c.ms < 1000 && c.sent === 0 && JSON.stringify(c.said) === JSON.stringify([waitsForGm])),
        JSON.stringify({ friskOffline, waitsForGm }), { flow: "give-take-stash" });
    /* E18 C0 (19.10.2026; audit S10-26, E18-01): a call on the GM from p1's browser with no GM connected settles at once,
       posts and sends nothing, and says once that no GM is connected; the window a request is typed in does not open. Until
       C0 `callGm` posted the card and answered true, and the window opened. */
    const callsFrom = opLog.length;
    const c6 = await offline("gm.call", `${bridge}.callGm(game.actors.get("${IDS.aiko}"), { title: "E18 C0 no GM", request: "E18 C0" })`);
    const c7 = await offline("gm.call", `${bridge}.promptAndCallGm(game.actors.get("${IDS.aiko}"), { title: "E18 C0 no GM", prompt: "E18 C0" })`);
    const c67 = { posted: opLog.slice(callsFrom).filter(w => w.coll === "ChatMessage").length,
        noGm: await p1.eval(`return game.i18n.localize("DRPG.Bridge.why.noGm");`) };
    check("C: with no GM connected, p1's call on the GM and its request window settle at once, post and send nothing, and each says once that no GM is connected",
        c6.answer === false && c7.answer === null && c67.posted === 0
        && [c6, c7].every(c => c.ms < 1000 && c.sent === 0 && c.said.length === 1 && c.said[0].includes(c.label) && c.said[0].includes(c67.noGm)),
        JSON.stringify({ c6, c7, c67 }));
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
