/**
 * QA 1.2.42: one GM and three players through a Daily Life time of day.
 * Clock, actions, a Search, a Hope Call that waits for the GM, the messenger,
 * the safeword, a Despair Call - and on every client: what was said to whom.
 */
const MOD = "danganronpa-rpg";
const REPO = "file:///home/user/Danganronpa-RPG";

export async function run({ gm, p1, p2, p3, check, settle }) {
    const players = [p1, p2, p3];
    const ids = await gm.eval(`return {
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id,
        chie: game.actors.getName("Chie Mori").id, daichi: game.actors.getName("Daichi Sato").id,
        monokuma: game.actors.getName("Monokuma").id };`);
    const own = { p1: ids.aiko, p2: ids.botan, p3: ids.chie };

    const clearLogs = async () => { for (const c of [gm, ...players]) await c.eval(`globalThis.__notifications.length = 0; globalThis.__dialogLog.length = 0; return true;`); };
    const notifs = c => c.eval(`return globalThis.__notifications.map(n => n.level + ": " + n.msg);`);
    const dialogs = c => c.eval(`return globalThis.__dialogLog.map(d => (d.title ?? "?") + " [" + (d.buttons ?? []).join("/") + "]");`);
    const lastCards = (c, n = 6) => c.eval(`return game.messages.contents.slice(-${n}).map(m => ({ w: m._source.whisper ?? [], t: (m._source.content ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 160) }));`);

    // ---- 0. season setup basics: Monokuma pool, clock at day 1 morning ----------------------
    await gm.eval(`
        await game.drpg.setMonokuma(game.actors.get("${ids.monokuma}"), true).catch(() => {});
        await game.drpg.setClock({ chapter: 1, day: 1, session: 1, timeOfDay: "morning", phase: "dailyLife", campaign: "QA season" });
        await game.drpg.resetAllActions();
        return true;`, { timeout: 60000 });
    await settle(500);

    // ---- 1. the clock: GM advances, everybody sees it, actions refill -----------------------
    await clearLogs();
    const before = {};
    for (const c of players) before[c.who] = await c.eval(`return game.drpg.actionsLeft(game.actors.get("${own[c.who]}"));`);
    await p1.eval(`await game.drpg.spendAction(game.actors.get("${ids.aiko}"), 1); return true;`, { timeout: 30000 });
    await settle(300);
    const spent = await p1.eval(`return game.drpg.actionsLeft(game.actors.get("${ids.aiko}"));`);
    check("p1: spending an action costs exactly one", spent === before.p1 - 1, `${before.p1} -> ${spent}`);

    const adv = await gm.eval(`const c = await game.drpg.advanceTimeOfDay({ resetActions: true }); return c;`, { timeout: 60000 });
    await settle(800);
    check("gm: clock advanced to noon", adv?.timeOfDay === "noon", JSON.stringify(adv));
    for (const c of players) {
        const seen = await c.eval(`return { clock: game.drpg.getClock().timeOfDay, left: game.drpg.actionsLeft(game.actors.get("${own[c.who]}")), max: game.drpg.actionsMax(game.actors.get("${own[c.who]}")),
            hud: (document.querySelector("#drpg-hud")?.textContent ?? "").replace(/\\s+/g, " ").replace(/(Daily Life · )+/g, "").trim().slice(0, 300),
            strip: (document.querySelector("#drpg-player-status")?.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 200) };`);
        check(`${c.who}: sees the new time of day`, seen.clock === "noon", JSON.stringify(seen));
        check(`${c.who}: actions refilled by the advance`, seen.left === seen.max, `${seen.left}/${seen.max}`);
        check(`${c.who}: HUD names the time of day`, /noon/i.test(seen.hud), seen.hud);
    }
    const advCards = await p3.eval(`return game.messages.contents.slice(-3).map(m => (m._source.content ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 120));`);
    check("p3: the time-of-day card reached a bystander", advCards.some(t => /noon/i.test(t)), JSON.stringify(advCards));

    // ---- 2. a Search by p1 (dialogs answered with defaults) ----------------------------------
    await clearLogs();
    const tokensBefore = await gm.eval(`const M = await import("${REPO}/scripts/movement.mjs"); const room = M.roomOfActor(game.actors.get("${ids.aiko}")); return { room, tokens: game.drpg.tokensLeft(room) };`);
    const search = await p1.eval(`
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        const left0 = game.drpg.actionsLeft(actor);
        let r, err = null;
        try { r = await game.drpg.performAction(actor, "search", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        await new Promise(res => setTimeout(res, 800));
        return { left0, left: game.drpg.actionsLeft(actor), r: typeof r, err, notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg), dialogs: globalThis.__dialogLog.map(d => d.title) };`, { timeout: 90000 });
    await settle(600);
    const tokensAfter = await gm.eval(`return game.drpg.tokensLeft("${tokensBefore.room}");`);
    check("p1: Search ran without throwing", !search.err, search.err ?? "");
    check("p1: Search charged one action", search.left === search.left0 - 1, `${search.left0} -> ${search.left} (dialogs: ${search.dialogs.join(" | ")})`);
    check("gm: Search spent one of the room's tokens", tokensAfter === tokensBefore.tokens - 1, `${tokensBefore.room}: ${tokensBefore.tokens} -> ${tokensAfter}`);
    const gmSaw = await lastCards(gm, 4);
    const p2Saw = await lastCards(p2, 4);
    check("gm: the Search left a card the GM can read", gmSaw.some(c => /search/i.test(c.t)), JSON.stringify(gmSaw));
    check("p2: another player was not told what p1 searched for", !p2Saw.some(c => c.w.length && !c.w.includes(p2.userId) && /search/i.test(c.t)), JSON.stringify(p2Saw));
    console.log("[qa] p1 notifications after Search:", JSON.stringify(search.notifs));

    // ---- 3. a Hope Call that waits for the GM (Ultimate) ------------------------------------
    await clearLogs();
    await gm.eval(`await game.actors.get("${ids.botan}").update({ "system.resources.hope.value": 3 }); return true;`);
    await settle(300);
    // The GM's approval dialog is answered "yes" by the shim's default button. Watch that it appears at all.
    const ask = p2.eval(`
        const actor = game.actors.get("${ids.botan}");
        const hope0 = actor.system.resources.hope.value;
        const r = await game.drpg.spendHopeCall(actor, "ultimate", { note: "I am the Ultimate Locksmith and this is a lock." });
        await new Promise(res => setTimeout(res, 800));
        return { hope0, hope: actor.system.resources.hope.value, r: r === null ? null : typeof r, notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg) };`, { timeout: 90000 });
    await settle(1500);
    const gmDialogs = await dialogs(gm);
    const asked = await ask;
    check("gm: the Ultimate request opened a decision on the GM's screen", gmDialogs.length > 0, JSON.stringify(gmDialogs));
    check("p2: Hope was charged once the GM said yes", asked.hope === asked.hope0 - 1, JSON.stringify(asked));
    console.log("[qa] p2 notifications after Ultimate:", JSON.stringify(asked.notifs));
    const gmNotifs = await notifs(gm);
    console.log("[qa] gm notifications after Ultimate:", JSON.stringify(gmNotifs));

    // ---- 4. messenger both ways -------------------------------------------------------------
    await clearLogs();
    await p3.eval(`await game.drpg.sendMessengerMessage("${gm.userId}", "Can I ask about the vending machine?"); return true;`, { timeout: 30000 }).catch(async err => {
        // the player-side signature may be (text) only
        return p3.eval(`await game.drpg.sendMessengerMessage("Can I ask about the vending machine?"); return true;`, { timeout: 30000 });
    });
    await settle(600);
    const gmUnread = await gm.eval(`return { total: game.drpg.messengerUnreadTotal(), thread: game.drpg.messengerThreadMessages("${p3.userId}").length };`);
    check("gm: a player's message lands in the GM's thread", gmUnread.thread >= 1, JSON.stringify(gmUnread));
    check("gm: the GM sees an unread count for it", gmUnread.total >= 1, JSON.stringify(gmUnread));
    await gm.eval(`await game.drpg.sendMessengerMessage("${p3.userId}", "Yes - it is out of order."); return true;`, { timeout: 30000 });
    await settle(600);
    const p3Unread = await p3.eval(`return { total: game.drpg.messengerUnreadTotal(), thread: game.drpg.messengerThreadMessages("${p3.userId}").length, notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg) };`);
    check("p3: the reply arrives with an unread count", p3Unread.total >= 1 && p3Unread.thread >= 2, JSON.stringify(p3Unread));
    const p1Thread = await p1.eval(`return game.drpg.messengerThreadMessages("${p3.userId}").length;`);
    check("p1: cannot read p3's thread with the GM", p1Thread === 0, `p1 sees ${p1Thread} messages of p3's thread`);

    // ---- 5. the safeword ---------------------------------------------------------------------
    await clearLogs();
    const sw = await p3.eval(`const S = await import("${REPO}/scripts/safeword.mjs"); await S.callSafeword({}); await new Promise(r => setTimeout(r, 600)); return true;`, { timeout: 30000 }).catch(e => String(e));
    await settle(800);
    for (const c of [gm, p1, p2]) {
        const heard = await c.eval(`return { paused: game.paused, cards: game.messages.contents.slice(-3).map(m => (m._source.content ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 100)), notifs: globalThis.__notifications.map(n => n.msg) };`);
        check(`${c.who}: the safeword reached this client`, heard.cards.some(t => /safe ?word|stop/i.test(t)) || heard.notifs.some(t => /safe ?word|stop/i.test(t)) || heard.paused, JSON.stringify(heard));
    }
    await gm.eval(`if (game.paused) game.togglePause(false); return true;`);

    // ---- 6. a Despair Call aimed at p1 -----------------------------------------------------------
    await clearLogs();
    await gm.eval(`await game.drpg.setDespair(game.user.id, 6).catch(() => {}); return true;`);
    const pain = await gm.eval(`
        const actor = game.actors.get("${ids.aiko}");
        const hp0 = actor.system.resources.hitPoints.value;
        let err = null, r;
        try { r = await game.drpg.spendDespairCallFor(actor, "thisWillHurt", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        await new Promise(res => setTimeout(res, 600));
        return { hp0, hp: actor.system.resources.hitPoints.value, r: r === null ? null : typeof r, err, despair: game.drpg.getDespair(game.user.id) };`, { timeout: 60000 });
    await settle(600);
    check("gm: Pain ran", !pain.err, pain.err ?? "");
    check("gm: Pain took 2 Health from Aiko (Health counts up as damage in Daggerheart)", Math.abs(pain.hp - pain.hp0) === 2, JSON.stringify(pain));
    const p1Pain = await p1.eval(`return { notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg), cards: game.messages.contents.slice(-2).map(m => (m._source.content ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 140)) };`);
    check("p1: the victim of the Call was told", p1Pain.notifs.length > 0 || p1Pain.cards.some(t => /pain|health/i.test(t)), JSON.stringify(p1Pain));
    const p2Pain = await p2.eval(`return (document.querySelector("#drpg-despair")?.textContent ?? "").replace(/\\s+/g, " ").trim();`);
    check("p2: the Despair rail on a player shows no number", !/\b\d+\s*\/\s*\d+/.test(p2Pain), p2Pain.slice(0, 120));

    // ---- 7. uncaught errors ------------------------------------------------------------------
    for (const c of [gm, ...players]) {
        const errs = await c.eval(`return globalThis.__errors.slice(0, 5);`);
        check(`${c.who}: no uncaught errors`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0, 400));
    }
}
