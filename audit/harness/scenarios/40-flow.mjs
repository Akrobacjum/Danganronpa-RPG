/**
 * QA 1.2.42: one GM and three players through a Daily Life time of day.
 * Clock, actions, a Search, a Hope Call that waits for the GM, the messenger,
 * the safeword, a Despair Call - and on every client: what was said to whom.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl: REPO }) {
    const players = [p1, p2, p3];
    const ids = await gm.eval(`return {
        aiko: game.actors.getName("Aiko Hoshino").id, botan: game.actors.getName("Botan Kage").id,
        chie: game.actors.getName("Chie Mori").id, daichi: game.actors.getName("Daichi Sato").id,
        monokuma: game.actors.getName("Monokuma").id };`);
    const own = { p1: ids.aiko, p2: ids.botan, p3: ids.chie };

    const clearLogs = async () => { for (const c of [gm, ...players]) await c.eval(`globalThis.__notifications.length = 0; globalThis.__dialogLog.length = 0; return true;`); };
    const notifs = c => c.eval(`return globalThis.__notifications.map(n => n.level + ": " + n.msg);`);
    const dialogs = c => c.eval(`return globalThis.__dialogLog.map(d => (d.title ?? "?") + " [" + (d.buttons ?? []).join("/") + "]");`);
    /*
     * EVERY CARD SINCE A MARK, AND WHAT THIS CLIENT MAKES OF IT.
     *
     * This read "the last n messages", which only worked while the harness kept
     * whispers off the clients they were not addressed to. Every client holds every
     * card now (lib/shim.mjs), so "the last three" on a player can be three GM-only
     * whispers. Instead: everything since a count taken before the step, and for
     * each card both the raw document (what the browser holds) and Foundry's own
     * answer to "does this client's log show it" (`visible`), plus what secret.mjs
     * would draw there (`says`) and whether this client holds the private words.
     */
    const count = c => c.eval(`return game.messages.contents.length;`);
    const cardsSince = (c, from) => c.eval(`
        const S = await import("${REPO}/scripts/secret.mjs");
        const text = h => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
        return game.messages.contents.slice(${from}).map(m => ({
            id: m.id, w: m.whisper, visible: m.visible,
            secret: Boolean(m.flags?.["${MOD}"]?.secret),
            stub: String(m._source.content ?? "").includes("data-drpg-secret"),
            words: text(S.secretHtml(m)), says: text(S.contentOf(m)).slice(0, 240),
            doc: JSON.stringify(m._source)
        }));`);
    /** Every string in `obj` containing `needle`, by path - where in a document a leak sits. */
    const pathsTo = (obj, needle, at = "") => obj && typeof obj === "object"
        ? Object.entries(obj).flatMap(([k, v]) => pathsTo(v, needle, at ? `${at}.${k}` : k))
        : (typeof obj === "string" && obj.includes(needle) ? [at] : []);

    // ---- 0. season setup basics: Monokuma pool, clock at day 1 morning ----------------------
    phase("season setup", { flow: "clock-day" });
    await gm.eval(`
        await game.drpg.setMonokuma(game.actors.get("${ids.monokuma}"), true).catch(() => {});
        await game.drpg.setClock({ chapter: 1, day: 1, session: 1, timeOfDay: "morning", phase: "dailyLife", campaign: "QA season" });
        await game.drpg.resetAllActions();
        return true;`, { timeout: 60000 });
    await settle(500);

    // ---- 1. the clock: GM advances, everybody sees it, actions refill -----------------------
    phase("the clock", { flow: "clock-day" });
    await clearLogs();
    const before = {};
    for (const c of players) before[c.who] = await c.eval(`return game.drpg.actionsLeft(game.actors.get("${own[c.who]}"));`);
    await p1.eval(`await game.drpg.spendAction(game.actors.get("${ids.aiko}"), 1); return true;`, { timeout: 30000 });
    await settle(300);
    const spent = await p1.eval(`return game.drpg.actionsLeft(game.actors.get("${ids.aiko}"));`);
    check("p1: spending an action costs exactly one", spent === before.p1 - 1, `${before.p1} -> ${spent}`);

    const tod0 = await count(p3);
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
    const advCards = (await cardsSince(p3, tod0)).map(({ visible, says }) => ({ visible, says: says.slice(0, 120) }));
    check("p3: the time-of-day card reached a bystander", advCards.some(c => c.visible && /noon/i.test(c.says)), JSON.stringify(advCards));

    // ---- 2. a Search by p1 (dialogs answered with defaults) ----------------------------------
    phase("a Search", { flow: "search-observe" });
    await clearLogs();
    const tokensBefore = await gm.eval(`const M = await import("${REPO}/scripts/movement.mjs"); const room = M.roomOfActor(game.actors.get("${ids.aiko}")); return { room, tokens: game.drpg.tokensLeft(room), items: game.actors.get("${ids.aiko}").items.contents.map(i => i.id) };`);
    const search0 = { gm: await count(gm), p2: await count(p2) };
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
    check("p1: Search ran without throwing", !search.err, search.err ?? "", { flow: "action-roll" });
    check("p1: Search charged one action", search.left === search.left0 - 1, `${search.left0} -> ${search.left} (dialogs: ${search.dialogs.join(" | ")})`);
    check("gm: Search spent one of the room's tokens", tokensAfter === tokensBefore.tokens - 1, `${tokensBefore.room}: ${tokensBefore.tokens} -> ${tokensAfter}`);
    /*
     * WHAT THE SEARCH TOLD WHOM, read off the documents rather than off what arrived.
     *
     * Both checks here used to pass for the wrong reason. The GM's matched the
     * time-of-day card ("...restocked with search tokens"), not the Search's own card,
     * whose document is a secret.mjs stub. And p2's could not fail: the harness never
     * handed p2 a whisper it was not on (audit S14-04). Now p2 holds the card, as a
     * real browser does, and three things are asked of p2's copy: that p2 has it at
     * all (else the rest measures nothing), that its words are not in it (stub
     * content, no words held - secret.mjs's promise), and that nothing ELSE in the
     * document names what p1 found. The last is judged against the item the Search
     * actually put on Aiko's sheet, read on the GM, and searched for in every string
     * of p2's copy - content, speaker, flags.
     */
    const foundItems = await gm.eval(`const had = ${JSON.stringify(tokensBefore.items)};
        return game.actors.get("${ids.aiko}").items.contents.filter(i => !had.includes(i.id)).map(i => i.name);`);
    const gmCards = await cardsSince(gm, search0.gm);
    const searchCard = gmCards.find(c => c.secret && /search/i.test(c.words)) ?? null;
    check("gm: the Search left a card the GM can read", Boolean(searchCard),
        JSON.stringify(gmCards.map(({ id, w, secret, says }) => ({ id, w, secret, says }))));
    const theirs = (await cardsSince(p2, search0.p2)).find(c => c.id === searchCard?.id) ?? null;
    check("p2: holds the Search's card, as every browser does", Boolean(theirs), JSON.stringify({ card: searchCard?.id ?? null }));
    check("p2: the Search card's words are not in p2's copy", Boolean(theirs) && theirs.stub && !theirs.words,
        JSON.stringify(theirs ? { stub: theirs.stub, words: theirs.words } : null));
    const leaks = theirs ? foundItems.flatMap(name => pathsTo(JSON.parse(theirs.doc), name).map(at => `"${name}" at ${at}`)) : [];
    // The precondition apart from the leak (E30): p2 holding the card is checked above.
    check("gm: the Search put something on Aiko's sheet", foundItems.length > 0, JSON.stringify(foundItems));
    check("p2: another player was not told what p1 searched for", leaks.length === 0, JSON.stringify({ found: foundItems, leaks }),
        { knownLeak: "S02-11", measured: foundItems.length > 0 && Boolean(theirs) });
    console.log("[qa] p1 notifications after Search:", JSON.stringify(search.notifs));

    // ---- 3. a Hope Call that waits for the GM (Ultimate) ------------------------------------
    phase("a Hope Call", { flow: "hope-call" });
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
    // The ask is a card in p2's thread with two buttons (COMM-04); the GM presses "It applies".
    const card = await gm.eval(`
        const msgs = game.drpg.messengerThreadMessages("${p2.userId}");
        const S = await import("${REPO}/scripts/secret.mjs");
        for (const m of msgs.slice().reverse()) {
            const html = S.contentOf(m);
            const hit = html.match(/data-drpg-call="approveCall"([^>]*)>/);
            if (!hit) continue;
            const rid = hit[1].match(/data-rid="([^"]+)"/)?.[1]; const asker = hit[1].match(/data-asker="([^"]+)"/)?.[1];
            const B = await import("${REPO}/scripts/gm-bridge.mjs");
            const sent = B.answerHopeCall(rid, asker, true);
            return { found: true, sent, rid, asker, text: html.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 200) };
        }
        return { found: false, n: msgs.length };`, { timeout: 30000 });
    const asked = await ask;
    check("gm: the Ultimate request arrived as a card with buttons in the player's thread", card.found && card.sent, JSON.stringify(card));
    check("p2: Hope was charged once the GM said yes", asked.hope === asked.hope0 - 1, JSON.stringify(asked));
    console.log("[qa] p2 notifications after Ultimate:", JSON.stringify(asked.notifs));
    const gmNotifs = await notifs(gm);
    console.log("[qa] gm notifications after Ultimate:", JSON.stringify(gmNotifs));

    // ---- 4. messenger both ways -------------------------------------------------------------
    phase("the messenger", { flow: "messenger" });
    await clearLogs();
    // A player's thread is keyed by the PLAYER's user id, whoever writes into it.
    await p3.eval(`await game.drpg.sendMessengerMessage("${p3.userId}", "Can I ask about the vending machine?"); return true;`, { timeout: 30000 });
    await settle(600);
    const gmUnread = await gm.eval(`return { total: game.drpg.messengerUnreadTotal(), thread: game.drpg.messengerThreadMessages("${p3.userId}").length };`);
    check("gm: a player's message lands in the GM's thread", gmUnread.thread >= 1, JSON.stringify(gmUnread));
    check("gm: the GM sees an unread count for it", gmUnread.total >= 1, JSON.stringify(gmUnread));
    await gm.eval(`await game.drpg.sendMessengerMessage("${p3.userId}", "Yes - it is out of order."); return true;`, { timeout: 30000 });
    await settle(600);
    const p3Unread = await p3.eval(`return { total: game.drpg.messengerUnreadTotal(), thread: game.drpg.messengerThreadMessages("${p3.userId}").length, notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg) };`);
    check("p3: the reply arrives with an unread count", p3Unread.total >= 1 && p3Unread.thread >= 2, JSON.stringify(p3Unread));
    // The documents travel to every client (Foundry routes on them); the WORDS must not (COMM-03).
    // `n >= 2` first: until the harness delivered whispers to everybody, p1 held none of
    // this thread and "no words in it" was true of an empty list.
    const p1Thread = await p1.eval(`
        const S = await import("${REPO}/scripts/secret.mjs");
        const msgs = game.drpg.messengerThreadMessages("${p3.userId}");
        return { n: msgs.length, words: msgs.filter(m => S.secretHtml(m)).length,
                 clear: msgs.filter(m => !/data-drpg-secret/.test(m._source.content ?? "")).length };`);
    check("p1: holds no words of p3's thread with the GM", p1Thread.n >= 2 && p1Thread.words === 0 && p1Thread.clear === 0, JSON.stringify(p1Thread));
    const p3Words = await p3.eval(`
        const S = await import("${REPO}/scripts/secret.mjs");
        return game.drpg.messengerThreadMessages("${p3.userId}").filter(m => S.secretHtml(m)).length;`);
    check("p3: holds the words of their own thread", p3Words >= 2, `${p3Words} of the thread's cards have words on p3`);

    // ---- 5. the safeword ---------------------------------------------------------------------
    phase("the safeword", { flow: "safeword" });
    await clearLogs();
    const sw0 = {};
    for (const c of [gm, p1, p2]) sw0[c.who] = await count(c);
    const sw = await p3.eval(`const S = await import("${REPO}/scripts/safeword.mjs"); await S.callSafeword({}); await new Promise(r => setTimeout(r, 600)); return true;`, { timeout: 30000 }).catch(e => String(e));
    await settle(800);
    for (const c of [gm, p1, p2]) {
        const cards = (await cardsSince(c, sw0[c.who])).filter(x => x.visible).map(x => x.says.slice(0, 100));
        const heard = { ...(await c.eval(`return { paused: game.paused, notifs: globalThis.__notifications.map(n => n.msg) };`)), cards };
        check(`${c.who}: the safeword reached this client`, heard.cards.some(t => /safe ?word|stop/i.test(t)) || heard.notifs.some(t => /safe ?word|stop/i.test(t)) || heard.paused, JSON.stringify(heard));
    }
    await gm.eval(`if (game.paused) game.togglePause(false); return true;`);

    // ---- 6. a Despair Call aimed at p1 -----------------------------------------------------------
    phase("a Despair Call", { flow: "despair" });
    await clearLogs();
    await gm.eval(`await game.drpg.setDespair(game.user.id, 6).catch(() => {}); return true;`);
    const pain0 = await count(p1);
    const pain = await gm.eval(`
        const actor = game.actors.get("${ids.aiko}");
        const hp0 = actor.system.resources.hitPoints.value;
        let err = null, r;
        // Pain is paid from the pool that feeds this student: point Aiko at this GM's pool, and fill it.
        await game.drpg.assign(actor.id, game.user.id).catch(() => {});
        await game.drpg.setDespair(game.user.id, 6).catch(() => {});
        // The Call is spent BY the Monokuma ON a student: the actor is Monokuma's, the target rides the choice.
        try { r = await game.drpg.spendDespairCallFor(game.actors.get("${ids.monokuma}"), "thisWillHurt", { choice: { target: actor } }); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        await new Promise(res => setTimeout(res, 600));
        return { hp0, hp: actor.system.resources.hitPoints.value, r: r === null ? null : typeof r, err, despair: game.drpg.getDespair(game.user.id) };`, { timeout: 60000 });
    await settle(600);
    check("gm: Pain ran", !pain.err, pain.err ?? "");
    // UP by two, not "changed by two": Health marks count up as damage, and
    // `Math.abs` here passed a Call that healed Aiko by two as well.
    check("gm: Pain took 2 Health from Aiko (Health counts up as damage in Daggerheart)", pain.hp - pain.hp0 === 2, JSON.stringify(pain));
    // Told THAT, not told anything: this accepted any notification at all, and any card
    // mentioning "health". The sentence is call-effects.mjs's own `DRPG.Calls.damaged`.
    const p1Pain = await p1.eval(`return { expect: game.i18n.format("DRPG.Calls.damaged", { name: game.actors.get("${ids.aiko}").name, what: "2 Health" }),
        notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg) };`);
    p1Pain.cards = (await cardsSince(p1, pain0)).filter(x => x.visible).map(x => x.says.slice(0, 200));
    check("p1: the victim of the Call was told", [...p1Pain.cards, ...p1Pain.notifs].some(t => t.includes(p1Pain.expect)), JSON.stringify(p1Pain));
    /*
     * THE RAIL, AND WHAT IS STILL MASKED ON IT.
     *
     * This asserted "the Despair rail on a player shows no number" and passed with
     * "Despair Pools Despair2/12" on the rail: its `\b` never matches between "r" and
     * "2" in run-together textContent, and an absent rail read as "" and passed too.
     * The claim was also stale - the pool's count is public on every client since D3
     * (despair.mjs `buildRow`, Dawid 13.09); what stays masked is the OVERFLOW, whose
     * count only a GM sees (`buildOverflowCaption`). So: the rail is there, the
     * player's overflow reads the hidden value, and the GM's reads a number.
     */
    const p2Rail = await p2.eval(`
        const rail = document.querySelector("#drpg-despair"), cap = rail?.querySelector(".drpg-overflow-caption");
        return { present: Boolean(rail), caption: cap?.textContent.replace(/\\s+/g, " ").trim() ?? null,
                 masked: cap?.classList.contains("masked") ?? null, hidden: game.i18n.localize("DRPG.Overflow.hiddenValue") };`);
    const gmCaption = await gm.eval(`return document.querySelector("#drpg-despair .drpg-overflow-caption")?.textContent.replace(/\\s+/g, " ").trim() ?? null;`);
    check("p2: the Despair rail is on a player's screen", p2Rail.present, JSON.stringify(p2Rail));
    check("p2: the rail masks the overflow count on a player, and the GM's shows it",
        p2Rail.masked === true && String(p2Rail.caption).includes(`${p2Rail.hidden}/`) && /\d+\s*\/\s*\d+/.test(gmCaption ?? ""),
        JSON.stringify({ p2: p2Rail, gm: gmCaption }));

    // ---- 7. uncaught errors ------------------------------------------------------------------
    phase("errors");
    for (const c of [gm, ...players]) {
        const errs = await c.eval(`return globalThis.__errors.slice(0, 5);`);
        check(`${c.who}: no uncaught errors`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0, 400));
    }
}
