/**
 * Every legal road through the GM bridge, and what a player is told when one is not carried out
 * (E31, 25.09.2026; audit S17-08, S17-09).
 *
 * Stage E31 moves every request a player's client sends the primary GM into one table judged by
 * one runner (scripts/bridge-guards.mjs), and every wait for an answer into one function. A wrong
 * guard in that table refuses a legal packet for every action at once, so the legal roads are
 * measured here first, on the tree before the refactor, and stay green after each of its commits:
 *   A  legal paths: a Reroll's undos in the order reroll.mjs sends them, a player who plays two
 *      characters, an Assistant GM (beside the GM, and as the primary once the GM has gone), and
 *      the shapes Daggerheart's own relay sends for a player. Each lands once, the GM logs no
 *      refusal for it, and its asker is told none.
 *   B  what E31 adds, each red until the commit that makes it so (`expectedRed`, with what it
 *      measured as `measured`): a refusal carries its reason, in the player's own language; a
 *      refused request is not acknowledged; an exception on the GM's side ends as one refusal the
 *      player hears; a GM who is connected and silent is reported when the acknowledgement does not
 *      come; the trap relay reaches the GMs only; a refused search is told once.
 *   C  with no GM connected, three requests settle at once, send nothing and say the same thing.
 *   D  no exception escaped into Foundry on any client (until E31's runner, the two B injects were excused).
 * The two exceptions are injected through world objects the handlers write - Aiko's token's
 * `update` for the send-back, `game.settings.set` for the sabotage - so the same injection works
 * before the table exists and after it.
 *
 * NOT MEASURED HERE: a real Reroll (`Roll#reroll` is not in the harness; a receipt is made as
 * 30-security makes one, by rewriting the rolls of the player's own roll message), and the crisis,
 * clean-up and Analyze undos, which need a running incident or a bullet - live check 21 and
 * LIVE-E31-01 in audit/AUDIT-1.2.42.md 9.2.
 */
export const layers = ["ci"];
export const accounts = [{ who: "ag", id: "USERAG0000000000", name: "Assistant", role: 3, character: null, color: "#aa66ff" }];

const MOD = "danganronpa-rpg";
const SOCKET = `module.${MOD}`;
const DH = "system.daggerheart";

/** A check that is red until E31 makes it true, with what it has to have reached to say so. */
const untilE31 = (why, measured) => ({ expectedRed: { stage: "E31", why }, measured: Boolean(measured) });

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
    /** A roll message of the player's own character, then its rolls rewritten - a Reroll's receipt (30-security's `rerollOn`). */
    const rerollOn = (client, actorId, { fearBefore = false, fearAfter = false } = {}) => client.eval(`
        const roll = fear => ({ class: "DualityRoll", formula: "1d12 + 1d12", total: 14,
            dHope: { total: fear ? 3 : 9 }, dFear: { total: fear ? 9 : 3 } });
        const m = await ChatMessage.create({ speaker: { actor: "${actorId}" }, content: "roll",
            rolls: [JSON.stringify(roll(${fearBefore}))] });
        await new Promise(r => setTimeout(r, 200));
        await m.update({ rolls: [JSON.stringify(roll(${fearAfter}))] });
        return m.id;`, { timeout: 30000 });
    /** One packet from p1 that its own client never sends: another player's character, in another player's name. */
    const forgeFromP1 = (action, requestId, fields) => p1.eval(`game.socket.emit("${SOCKET}",
        { action: "${action}", userId: "${IDS.p2}", requestId: "${requestId}", ...${JSON.stringify(fields)} }, ${toGms}); return true;`);
    const progressOf = id => `return { current: ${projects}.allProjects().find(p => p.id === "${id}")?.current ?? null };`;
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

    /* ---------------------------------------------- A. a Reroll's undos, in order */

    // reroll.mjs:486 - progress taken back, naming the rerolling character.
    phase("a Reroll's progress", { flow: "projects" });
    await clearFailures(gm);
    let mark = await refusedCount(p1);
    await rerollOn(p1, IDS.aiko);
    const a1answer = await p1.eval(`return await ${projects}.addProgress("${proj.one}", -1, { actorId: "${IDS.aiko}" });`, { timeout: 30000 });
    await settle(1500);
    const a1 = { answer: a1answer, after: await gm.eval(progressOf(proj.one)),
        logged: await refusalsLogged(gm, "project.progress"), told: await refusedSince(p1, mark) };
    check("A1: a Reroll's progress taken back, naming its own character, lands once and is refused nowhere",
        a1.after.current === 2 && !a1.logged.length && !a1.told.length && notFailed(a1answer), JSON.stringify(a1));

    // reroll.mjs:624-636 - the old sabotage taken back and a new one made, back to back: the project queue.
    phase("a Reroll's sabotage", { flow: "projects" });
    const firstRepair = await p2.eval(`const r = await ${projects}.sabotageProject("${proj.one}", 3); return r?.repair?.id ?? null;`, { timeout: 60000 });
    await settle(800);
    await clearFailures(gm);
    mark = await refusedCount(p2);
    await rerollOn(p2, IDS.botan);
    const redo = await p2.eval(`const P = ${projects};
        const undone = await P.undoSabotage("${proj.one}", "${firstRepair}", { actorId: "${IDS.botan}" });
        const again = await P.sabotageProject("${proj.one}", 6);
        return { undone, again: again?.repair?.id ?? null };`, { timeout: 60000 });
    await settle(1500);
    const a2 = { firstRepair, ...redo,
        after: await gm.eval(`const P = ${projects}; const ids = P.allProjects().map(p => p.id);
            return { first: ids.includes("${firstRepair}"), frozenBy: P.metaFor("${proj.one}").frozenBy ?? null,
                repairs: P.allProjects().filter(p => P.repairs(p.id) === "${proj.one}").map(p => p.id) };`),
        logged: [...await refusalsLogged(gm, "project.unsabotage"), ...await refusalsLogged(gm, "project.sabotage")],
        told: await refusedSince(p2, mark) };
    check("A2: a Reroll's sabotage taken back and made again, back to back, leaves one freeze, by the new repair",
        Boolean(firstRepair) && Boolean(redo.again) && redo.again !== firstRepair && a2.after.first === false
        && a2.after.frozenBy === redo.again && a2.after.repairs.length === 1 && !a2.logged.length && !a2.told.length
        && notFailed(redo.undone), JSON.stringify(a2));

    // reroll.mjs:734 - an Observe taken back and thrown again.
    phase("a Reroll's Observe", { flow: "search-observe" });
    const observed = await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.placeRemnant({ x: 450, y: 450, sceneId: canvas.scene.id, type: "prep", visibility: "obvious",
            sourceActor: "${IDS.chie}", sourceName: "Chie Mori", room: "Dorm A", subject: "E31 cup" });
        const O = await import("${repoUrl}/scripts/observe.mjs");
        const r = await O.chooseObserveTarget({ actorId: "${IDS.aiko}", declaration: "general", userId: "${IDS.p1}" });
        return { key: r?.key ?? null, ok: r?.ok ?? false };`, { timeout: 60000 });
    const bulletsOf = `return game.actors.get("${IDS.aiko}").items.filter(i => i.getFlag("${MOD}", "isTruthBullet")).map(i => i.id);`;
    const bullets0 = await gm.eval(bulletsOf);
    await p1.eval(`${bridge}.requestObserveResolve({ actorId: "${IDS.aiko}", key: "${observed.key}", total: 30, isCritical: false }); return true;`);
    await settle(1500);
    const bullets1 = await gm.eval(bulletsOf);
    const found = bullets1.filter(id => !bullets0.includes(id));
    await clearFailures(gm);
    mark = await refusedCount(p1);
    await rerollOn(p1, IDS.aiko);
    const a3answer = await p1.eval(`return await ${bridge}.requestObserveResolve({ actorId: "${IDS.aiko}", key: "${observed.key}",
        total: 30, isCritical: false, undo: true });`, { timeout: 30000 });
    await settle(1500);
    const bullets2 = await gm.eval(bulletsOf);
    const a3 = { observed, found, counts: [bullets0.length, bullets1.length, bullets2.length], answer: a3answer,
        logged: await refusalsLogged(gm, "observe.resolve"), told: await refusedSince(p1, mark) };
    check("A3: a Reroll's Observe replaces the first find with the new one, once, and is refused nowhere",
        observed.ok === true && found.length === 1 && bullets2.length === bullets1.length && !bullets2.includes(found[0])
        && !a3.logged.length && !a3.told.length && notFailed(a3answer), JSON.stringify(a3));

    // reroll.mjs:353 - a roll that became a Despair roll moves its Monokuma's pool by one.
    phase("a Reroll's Despair", { flow: "despair" });
    const pool0 = await gm.eval(pool);
    await clearFailures(gm);
    mark = await refusedCount(p1);
    await rerollOn(p1, IDS.aiko, { fearBefore: false, fearAfter: true });
    const a4answer = await p1.eval(`return await ${bridge}.requestDespairAdjust("${IDS.gm}", 1, { actorId: "${IDS.aiko}" });`, { timeout: 30000 });
    await settle(1500);
    const a4 = { before: pool0, after: await gm.eval(pool), answer: a4answer,
        logged: await refusalsLogged(gm, "despair.adjust"), told: await refusedSince(p1, mark) };
    check("A4: a Reroll that turned Aiko's roll into Despair moves her Monokuma's pool by one, once",
        a4.after === pool0 + 1 && !a4.logged.length && !a4.told.length && notFailed(a4answer), JSON.stringify(a4));

    // reroll.mjs:1026 - the trace the first throw left, re-rated.
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
    await rerollOn(p1, IDS.aiko);
    const a5answer = await p1.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        return await R.retuneRemnant(canvas.scene.id, "${own?.id}", { visibility: "hidden" });`, { timeout: 30000 });
    await settle(1500);
    const a5 = { own, after: await gm.eval(traceOf("E31 own trace")), answer: a5answer,
        logged: await refusalsLogged(gm, "remnant.edit"), told: await refusedSince(p1, mark) };
    check("A5: a Reroll re-rates its own character's fresh trace, and is refused nowhere",
        Boolean(own) && own.visibility !== "hidden" && a5.after?.visibility === "hidden" && !a5.logged.length && !a5.told.length
        && notFailed(a5answer), JSON.stringify(a5));

    /* ------------------------------------------- A. a player with two characters */

    // p3 plays Chie, and is given Daichi for this section: a receipt is per character and user.
    phase("a player with two characters", { flow: "projects" });
    await gm.eval(`await game.actors.get("${IDS.daichi}").update({ "ownership.${IDS.p3}": 3 }); return true;`);
    await settle(600);
    try {
        const takeBack = () => p3.eval(`return await ${projects}.addProgress("${proj.two}", -1, { actorId: "${IDS.daichi}" });`, { timeout: 30000 });
        await clearFailures(gm);
        mark = await refusedCount(p3);
        await rerollOn(p3, IDS.chie);
        const wrongAnswer = await takeBack();
        await settle(1500);
        const wrong = { answer: wrongAnswer, after: await gm.eval(progressOf(proj.two)),
            logged: await refusalsLogged(gm, "project.progress"), told: await refusedSince(p3, mark) };
        check("A6: a Reroll of Chie's roll does not pay for Daichi's progress taken back, though p3 plays both",
            wrong.after.current === 3 && wrong.logged.some(r => /no Reroll/.test(r)) && wrong.told.some(t => t.what === "project.progress"),
            JSON.stringify(wrong));

        await clearFailures(gm);
        mark = await refusedCount(p3);
        await rerollOn(p3, IDS.daichi);
        const rightAnswer = await takeBack();
        await settle(1500);
        const right = { answer: rightAnswer, after: await gm.eval(progressOf(proj.two)),
            logged: await refusalsLogged(gm, "project.progress"), told: await refusedSince(p3, mark) };
        check("A6: a Reroll of Daichi's roll pays for Daichi's progress taken back, asked by the player who plays both",
            right.after.current === 2 && !right.logged.length && !right.told.length && notFailed(rightAnswer), JSON.stringify(right));
    } finally {
        // Back to None, the level p3 had for Daichi before this section.
        await gm.eval(`await game.actors.get("${IDS.daichi}").update({ "ownership.${IDS.p3}": 0 }); return true;`);
        await settle(400);
    }

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
        const answered = await p1.eval(`const t0 = Date.now();
            const answer = await Promise.race([${bridge}.requestSabotage("${target}", 3),
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
    check("B8: a Search refused for the room is told once, with the reason, and never as a GM who did not answer",
        b8.said.length === 1 && !b8.why.startsWith("DRPG.") && b8.said[0].includes(b8.why) && !b8.said.includes(b8.timeout),
        JSON.stringify(b8),
        untilE31("search-tokens.mjs answers every refused spend \"notHere\" and toasts its own sentence, beside the bridge's",
            spent === false && b8.left === left0));

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
