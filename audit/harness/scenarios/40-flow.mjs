/**
 * QA 1.2.42: one GM and three players through a Daily Life time of day.
 * Clock, actions, a Search, a Hope Call that waits for the GM, the messenger,
 * the safeword, a Despair Call - and on every client: what was said to whom.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl: REPO, canary, IDS }) {
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

    /*
     * A PLAYER'S REROLL, MADE ON THE GM (E08+E28 C4a, 03.10.2026; audit S02-47). The Reroll is one
     * request, `reroll.ask`, and the GM pays, throws, rewrites, takes the action back and makes it
     * again; p1's browser only asks and posts the card. The harness's roll message has no
     * `Roll#reroll`, so on the GM the roll Aiko's row names reads as one of the scenario's, which
     * throws `next` (`REROLL_ARM`); the GM records who wrote Aiko's Hope and the message's rolls,
     * and who deleted her items, while p1 asks. `REROLL_READ` takes the stand-in and the hooks off.
     */
    const REROLL_ARM = (first, next) => `const S = await import("${REPO}/scripts/gm-stores.mjs");
        const { automatedUpdate } = await import("${REPO}/scripts/resource-guard.mjs");
        const aiko = game.actors.get("${ids.aiko}"), row = S.rerollBookmarkStore.get("${ids.aiko}");
        const m = game.messages.get(row?.messageId ?? "");
        class Thrown {
            constructor(formula, data = {}, options = {}) { this._formula = formula; this.options = options; this.faces = ${JSON.stringify(first)}; }
            get dHope() { return { total: this.faces.hope }; } get dFear() { return { total: this.faces.fear }; }
            get total() { return this.faces.hope + this.faces.fear; }
            get withHope() { return this.faces.hope > this.faces.fear; } get withFear() { return this.faces.hope < this.faces.fear; }
            get isCritical() { return this.faces.hope === this.faces.fear; }
            async reroll() { const r = new Thrown(this._formula, {}, this.options); r.faces = ${JSON.stringify(next)}; return r; }
            toJSON() { return { class: "DualityRoll", formula: this._formula, total: this.total, evaluated: true }; }
        }
        if (m) Object.defineProperty(m, "rolls", { configurable: true, get: () => [new Thrown("1d12 + 1d12", {}, {})] });
        const hopeWas = aiko.system.resources.hope.value;
        await automatedUpdate(aiko, { "system.resources.hope.value": Math.max(4, hopeWas) });
        const w = globalThis.__rerollWrites = { hope: [], rolls: [], items: [], hooks: [], messageId: m?.id ?? null, hopeWas,
            hopeAt: aiko.system.resources.hope.value,
            row: row ? { actionKey: row.actionKey, claims: row.claims, facts: row.facts, by: row.by, reportMessageId: row.reportMessageId ?? null } : null };
        w.hooks.push(["updateActor", Hooks.on("updateActor", (d, c, o, u) => { if (d.id === aiko.id && foundry.utils.hasProperty(c, "system.resources.hope")) w.hope.push(u ?? null); })]);
        w.hooks.push(["updateChatMessage", Hooks.on("updateChatMessage", (d, c, o, u) => { if (d.id === w.messageId && c && "rolls" in c) w.rolls.push(u ?? null); })]);
        w.hooks.push(["deleteItem", Hooks.on("deleteItem", (d, o, u) => { if (d.parent?.id === aiko.id) w.items.push([d.id, u ?? null]); })]);
        return { messageId: w.messageId, row: w.row };`;
    const REROLL_ASK = `const C = await import("${REPO}/scripts/calls.mjs");
        const at = game.messages.contents.length;
        const out = await C.spendHopeCall(game.actors.get("${ids.aiko}"), "reroll");
        await new Promise(r => setTimeout(r, 600));
        const S = await import("${REPO}/scripts/secret.mjs");
        const card = game.messages.contents.slice(at).map(m => String(S.contentOf(m) ?? "")).find(t => t.includes("Reroll")) ?? null;
        return { made: Boolean(out), card: card ? card.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) : null };`;
    const REROLL_READ = `const S = await import("${REPO}/scripts/gm-stores.mjs");
        const { automatedUpdate } = await import("${REPO}/scripts/resource-guard.mjs");
        const w = globalThis.__rerollWrites, aiko = game.actors.get("${ids.aiko}"), row = S.rerollBookmarkStore.get("${ids.aiko}");
        for (const [name, id] of w.hooks) Hooks.off(name, id);
        const m = game.messages.get(w.messageId ?? ""); if (m) delete m.rolls;
        const out = { hope: w.hope, rolls: w.rolls, items: w.items, paid: w.hopeAt - aiko.system.resources.hope.value,
            row: row ? { total: row.total, claims: row.claims, facts: row.facts, rerolled: row.rerolled ?? false } : null,
            journal: Boolean(S.rerollJournalStore.has("${ids.aiko}")), gm: game.user.id };
        await automatedUpdate(aiko, { "system.resources.hope.value": w.hopeWas });
        return out;`;

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
    /* A TRAP'S PLANT IN THE ROOM (E08+E28 C6a, 03.10.2026; audit S08-04). The Search below finds it
       instead of a draw, on the same card as any find (traps.mjs, trap 166), and the Reroll after it
       finds nothing, so the plant goes back into the room as itself - read after the Reroll. */
    const plantScene = await p1.eval(`return canvas?.scene?.id ?? null;`);
    const planted = await gm.eval(`const T = await import("${REPO}/scripts/traps.mjs");
        return await T.plantItem("SCEN40PLANTPROJECT", ${JSON.stringify(tokensBefore.room)}, { sceneId: ${JSON.stringify(plantScene)}, name: "Scenario 40 planted kit" });`);
    const search0 = { gm: await count(gm), p2: await count(p2) };
    const search = await p1.eval(`
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        const left0 = game.drpg.actionsLeft(actor);
        const rolled = [];
        const own = Object.getPrototypeOf(actor).rollTrait;
        actor.rollTrait = async function (key, options) { rolled.push(key); return own.call(actor, key, options); };
        let r, err = null;
        try { r = await game.drpg.performAction(actor, "search", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        delete actor.rollTrait;
        await new Promise(res => setTimeout(res, 800));
        return { left0, left: game.drpg.actionsLeft(actor), r: typeof r, err, rolled, notifs: globalThis.__notifications.map(n => n.level + ": " + n.msg), dialogs: globalThis.__dialogLog.map(d => d.title) };`, { timeout: 90000 });
    await settle(600);
    const tokensAfter = await gm.eval(`return game.drpg.tokensLeft("${tokensBefore.room}");`);
    check("p1: Search ran without throwing", !search.err, search.err ?? "", { flow: "action-roll" });
    check("p1: Search charged one action", search.left === search.left0 - 1, `${search.left0} -> ${search.left} (dialogs: ${search.dialogs.join(" | ")})`);
    // E32+E07 C11d (02.10.2026; the owner's rule of 28.09): a Search rolls Eye alone - Daggerheart's Instinct.
    check("p1: Search rolled Eye, and only once", JSON.stringify(search.rolled) === JSON.stringify(["instinct"]), JSON.stringify(search.rolled));
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
    /* THE SUMMARY FLAG APART FROM THE REST (E30 fix, 25.09.2026). S02-11 was the card's
       summary flag, a known leak until E05 C7 took the facts off the document; the
       found item anywhere else in p2's copy is its own check, so each path is named
       when it fails. Measured with the item also written into the card's popupTitle
       flag: the first check failed, the second passed. */
    const inSummary = leaks.filter(at => at.includes(` at flags.${MOD}.summary.`));
    const elsewhere = leaks.filter(at => !inSummary.includes(at));
    check("p2: nothing but the Search card's summary flag says what p1 found", elsewhere.length === 0,
        JSON.stringify({ found: foundItems, leaks: elsewhere }));
    check("p2: the Search card's summary flag does not say what p1 found", inSummary.length === 0,
        JSON.stringify({ found: foundItems, leaks: inSummary }));
    /* WHERE THE FACTS WENT (E05 C7, 26.09.2026). Off the document, they travel with the
       words to the card's readers, and the GM's time-of-day summary reads them there:
       p1's browser sent them, the GM's store kept them, naming what the Search found. */
    const gmFacts = await gm.eval(`const S = await import("${REPO}/scripts/secret.mjs");
        return (S.secretSummaries?.(0) ?? []).filter(f => f.actorId === "${ids.aiko}");`);
    check("gm: the Search's facts reached the GM with its words, for the day summary",
        foundItems.length > 0 && gmFacts.some(f => foundItems.includes(f.item)),
        JSON.stringify({ found: foundItems, facts: gmFacts }));
    /* WHAT THE CARD SAYS OF ITSELF (E06 C7a, 27.09.2026; audit L16, S02-02). Its module flags
       said which action it was about and which way the roll went - "Search", on p2's copy.
       They go with the words now: p2's copy keeps two flags, and the GM, a reader, reads the
       title from the meta the words brought. */
    const p2Flags = theirs ? Object.keys(JSON.parse(theirs.doc)?.flags?.[MOD] ?? {}).sort() : null;
    const gmTitle = await gm.eval(`const S = await import("${REPO}/scripts/secret.mjs");
        const m = game.messages.get(${JSON.stringify(searchCard?.id ?? null)});
        return m && S.cardFlag ? S.cardFlag(m, "popupTitle") ?? null : null;`);
    check("p2: the Search card's document says nothing of itself, and the GM reads its title from the words",
        JSON.stringify(p2Flags) === JSON.stringify(["drpgMessage", "secret"]) && typeof gmTitle === "string" && /search/i.test(gmTitle),
        JSON.stringify({ p2Flags, gmTitle }));
    console.log("[qa] p1 notifications after Search:", JSON.stringify(search.notifs));

    /* THE SEARCH, REROLLED FROM p1's BROWSER AND MADE ON THE GM (E08+E28 C4a). The new dice are a
       Hope result too low to find anything, so the GM takes back the item the Search put on
       Aiko's sheet. Read on the GM: who wrote Aiko's Hope and the message's rolls, who deleted
       the item, what was paid, the row after; on p1: the Call's card. */
    phase("a Reroll", { flow: "reroll" });
    const searchArm = await gm.eval(REROLL_ARM({ hope: 9, fear: 5 }, { hope: 3, fear: 1 }), { timeout: 30000 });
    const searchAsk = await p1.eval(REROLL_ASK, { timeout: 90000 });
    await settle(600);
    const searchReroll = await gm.eval(REROLL_READ, { timeout: 30000 });
    const takenBack = searchArm.row?.claims?.itemId ?? null;
    check("p1: a Reroll of the Search is paid and made on the GM - its Hope, the message's rolls and the item taken back each written by the GM's hand",
        searchArm.row?.actionKey === "search" && searchArm.row?.by === IDS.p1 && searchAsk.made === true && Boolean(searchAsk.card)
            && searchReroll.hope.length === 1 && searchReroll.hope.every(u => u === searchReroll.gm) && searchReroll.paid === 3
            && JSON.stringify(searchReroll.rolls) === JSON.stringify([searchReroll.gm])
            && Boolean(takenBack) && JSON.stringify(searchReroll.items) === JSON.stringify([[takenBack, searchReroll.gm]])
            && searchReroll.row?.total === 4 && searchReroll.row?.rerolled === true && searchReroll.row?.claims?.itemId === null && !searchReroll.journal,
        JSON.stringify({ searchReroll, made: searchAsk.made, card: Boolean(searchAsk.card), arm: searchArm.row }), { flow: "reroll" });
    /* THE SEARCH'S CARD, AFTER IT (E08+E28 C5, 03.10.2026; audit S02-21). p1's browser named its
       Search card in the roll's bookmark, and the GM making the Reroll stamped it. Each browser draws
       it through the log's render hooks onto a bare card element, a stub in its body as the document
       carries, and is read once the hooks' run has ended: p1, a reader, draws the header's total
       struck and the line with both totals in the new roll's colour; p2 holds the stamped document
       and not the words, and draws neither. */
    const replacedOn = c => c.eval(`const m = game.messages.get(${JSON.stringify(searchCard?.id ?? null)});
        if (!m) return null;
        const li = document.createElement("li");
        li.innerHTML = '<header class="message-header"></header><div class="message-content"><p class="notes" data-drpg-secret>-</p></div>';
        Hooks.callAll("renderChatMessageHTML", m, li);
        await new Promise(r => setTimeout(r, 0));
        const line = li.querySelector(".drpg-reroll-replaced");
        return { mark: m.flags?.["${MOD}"]?.rerolled ?? null,
            struck: li.querySelector(".drpg-card-head .drpg-card-total")?.style.getPropertyValue("text-decoration") ?? null,
            line: line?.textContent ?? null, tone: line?.dataset.tone ?? null };`);
    const replacedP1 = await replacedOn(p1), replacedP2 = await replacedOn(p2);
    check("p1: the Search's card a Reroll replaced is drawn with its total struck and a line of both totals in the new roll's colour - p2, without its words, draws neither",
        Boolean(searchCard) && searchArm.row?.reportMessageId === searchCard.id
            && replacedP1?.mark?.from === 14 && replacedP1.mark.to === 4 && replacedP1.mark.tone === "hope"
            && replacedP1.struck === "line-through" && / 14 -> 4 /.test(replacedP1.line ?? "") && replacedP1.tone === "hope"
            && replacedP2?.mark?.to === 4 && replacedP2.struck === null && replacedP2.line === null,
        JSON.stringify({ named: searchArm.row?.reportMessageId ?? null, card: searchCard?.id ?? null, replacedP1, replacedP2 }), { flow: "reroll" });

    /* THE PLANT CAME BACK AS ITSELF (E08+E28 C6a, 03.10.2026; audit S08-04). The Search above was
       handed the trap's plant, and the Reroll's dice find nothing: the GMs' row named the plant, no
       object with its identity is left on Aiko's sheet, the plant is in its room again with its
       identity, its trap and its name, and the row no longer names it. Read on the GM; the plant and
       its ledger row are taken out afterwards. */
    const plantKey = `${plantScene}::${tokensBefore.room}`;
    const plantBack = await gm.eval(`const S = await import("${REPO}/scripts/gm-stores.mjs");
        const key = ${JSON.stringify(plantKey)}, id = ${JSON.stringify(planted)};
        const row = S.trapPlantStore.get(key) ?? null;
        const out = { row: row ? { drpgItemId: row.drpgItemId ?? null, projectId: row.projectId ?? null, name: row.name ?? null } : null,
            onSheet: game.actors.get("${ids.aiko}").items.contents.filter(i => i.getFlag("${MOD}", "drpgItemId") === id).length,
            fact: Object.hasOwn(S.rerollBookmarkStore.get("${ids.aiko}")?.facts ?? {}, "plant") ? S.rerollBookmarkStore.get("${ids.aiko}").facts.plant : "unsaid" };
        if (S.trapPlantStore.has(key)) await S.trapPlantStore.drop(key);
        if (id && S.trapLedgerStore.has(id)) await S.trapLedgerStore.drop(id);
        return out;`);
    check("gm: the Search's plant, taken back by a Reroll that finds nothing, is in its room again as itself",
        Boolean(planted) && searchArm.row?.facts?.plant?.identity === planted && plantBack.onSheet === 0
            && plantBack.row?.drpgItemId === planted && plantBack.row.projectId === "SCEN40PLANTPROJECT"
            && plantBack.row.name === "Scenario 40 planted kit" && plantBack.fact === null,
        JSON.stringify({ planted, arm: searchArm.row?.facts?.plant ?? null, plantBack }), { flow: "reroll" });

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
    await canary.chatMark({ who: ["p1", "p2"] });
    /* The title's own text node, not its textContent: the top card's bar also carries the
       badge counting the parked cards under it (popup.mjs, "+2"), and read whole, a second
       safeword card on top reads "THE SCENE IS STOPPED+2" and was not counted (28.09, with the
       GM's card raising it again: 1 counted of 2 on screen). */
    const stuck = `const banner = game.i18n.localize("DRPG.Safeword.banner");
        return [...document.querySelectorAll(".drpg-popup-sticky .drpg-popup-title")].filter(t => t.firstChild?.textContent.trim() === banner).length;`;
    const p3Stuck0 = await p3.eval(stuck);
    const sw = await p3.eval(`const S = await import("${REPO}/scripts/safeword.mjs"); await S.callSafeword({}); await new Promise(r => setTimeout(r, 600)); return true;`, { timeout: 30000 }).catch(e => String(e));
    await settle(800);
    for (const c of [gm, p1, p2]) {
        const cards = (await cardsSince(c, sw0[c.who])).filter(x => x.visible).map(x => x.says.slice(0, 100));
        const heard = { ...(await c.eval(`return { paused: game.paused, notifs: globalThis.__notifications.map(n => n.msg) };`)), cards };
        check(`${c.who}: the safeword reached this client`, heard.cards.some(t => /safe ?word|stop/i.test(t)) || heard.notifs.some(t => /safe ?word|stop/i.test(t)) || heard.paused, JSON.stringify(heard));
    }
    /* WHO POSTED IT (E06 C9; audit S03-02). p3 asked the GMs, and the primary GM posted the card
       with the banner as its alias: p2's copy is read for its author. p3 raised the card once - at
       the press, and not again when the GM's card landed. */
    const swDoc = await p2.eval(`const S = await import("${REPO}/scripts/safeword.mjs");
        const m = game.messages.contents.slice(${sw0.p2}).filter(x => x.getFlag("${MOD}", S.SAFEWORD_FLAG));
        return { n: m.length, author: m[0]?._source.author ?? null, alias: m[0]?.speaker?.alias ?? null,
            actor: m[0]?.speaker?.actor ?? null, banner: game.i18n.localize("DRPG.Safeword.banner") };`);
    check("p2: the safeword's card was posted by the GM, under the banner, naming nobody",
        swDoc.n === 1 && swDoc.author === gm.userId && swDoc.alias === swDoc.banner && !swDoc.actor, JSON.stringify({ ...swDoc, gm: gm.userId }));
    const p3Stuck = await p3.eval(stuck);
    check("p3: the caller's screen raised the card once", p3Stuck - p3Stuck0 === 1, JSON.stringify({ before: p3Stuck0, after: p3Stuck }));
    /* WHAT P1'S AND P2'S CHAT SAYS OF WHO CALLED IT (E06 C1; lib/canary.mjs `chatScan`): the cards
       they were sent since p3 called the safeword, read for p3, p3's name and Chie. */
    await canary.chatScan({ who: ["p1", "p2"], actorIds: [IDS.chie], names: ["Chie Mori", "PlayerThree"], userIds: [p3.userId] });
    await gm.eval(`if (game.paused) game.togglePause(false); return true;`);

    /* NO GM'S BROWSER ANSWERS (E06 fix r2-G3, 28.09.2026; the round-2 review's security mn6 =
       correctness M1). A GM counts as connected many seconds before their module listens (a reload,
       gm-bridge.mjs), and the packet is dropped: at a202714 nothing was posted and nothing paused
       while the caller's card said the scene was stopped (these checks at its runtime, 28.09: no new
       card on any of the four clients, not paused, p1's card as ever). Here the GM's module listeners
       pass the packet by, as a reloading GM's do, and p1 presses: after `TIMING.safewordAnswerMs`
       p1's own browser posts the card, as with no GM connected - one new card on every client, p1
       its author - the primary GM's browser pauses on it, and p1's card says its browser posted
       it, where p3's (the GM answered) does not. Then p3 presses again inside the window of the
       card the GM posted for it, the GM listening: the GM swallows that (C9), and so does p3. */
    const swAuthors = c => c.eval(`const S = await import("${REPO}/scripts/safeword.mjs");
        return game.messages.contents.filter(m => m.getFlag("${MOD}", S.SAFEWORD_FLAG)).map(m => m._source.author);`);
    const swPopups = c => c.eval(`const banner = game.i18n.localize("DRPG.Safeword.banner");
        return [...document.querySelectorAll(".drpg-popup-sticky")]
            .filter(p => p.querySelector(".drpg-popup-title")?.firstChild?.textContent.trim() === banner)
            .map(p => ({ seq: Number(p.dataset.drpgSeq), body: p.querySelector(".drpg-popup-body")?.textContent.trim() ?? "" }));`);
    const quiet0 = {};
    for (const c of [gm, p1, p2, p3]) quiet0[c.who] = (await swAuthors(c)).length;
    const p1Seq0 = Math.max(0, ...(await swPopups(p1)).map(p => p.seq));
    await gm.eval(`const S = await import("${REPO}/scripts/safeword.mjs");
        const list = game.socket._handlers.get("module.${MOD}");
        globalThis.__swListening = [...list];
        list.splice(0, list.length, ...globalThis.__swListening.map(fn => (p, s) => p?.action === S.SAFEWORD_ACTION ? undefined : fn(p, s)));
        return true;`);
    let quiet;
    try {
        quiet = await p1.eval(`const S = await import("${REPO}/scripts/safeword.mjs");
            const { TIMING } = await import("${REPO}/scripts/config.mjs");
            const t = performance.now();
            const ok = await S.callSafeword({});
            return { ok, ms: Math.round(performance.now() - t), window: TIMING.safewordAnswerMs ?? null };`, { timeout: 30000 }).catch(e => String(e));
        // As long as the review's probe gave 1.2.64's code: five seconds for a card to reach p2.
        await p2.eval(`const S = await import("${REPO}/scripts/safeword.mjs");
            for (let i = 0; i < 50 && game.messages.contents.filter(m => m.getFlag("${MOD}", S.SAFEWORD_FLAG)).length <= ${quiet0.p2}; i++)
                await new Promise(r => setTimeout(r, 100));
            return true;`, { timeout: 30000 });
        await settle(800);
    } finally {
        await gm.eval(`const list = game.socket._handlers.get("module.${MOD}");
            list.splice(0, list.length, ...globalThis.__swListening); delete globalThis.__swListening; return true;`);
    }
    const quietCards = {};
    for (const c of [gm, p1, p2, p3]) quietCards[c.who] = (await swAuthors(c)).slice(quiet0[c.who]);
    const quietPaused = await gm.eval(`return game.paused;`);
    check("a press no GM's browser answers: after the wait the caller posts it, one card on every client, and the game pauses",
        quiet?.ok === true && quiet.ms >= (quiet.window ?? Infinity) && quietPaused === true
            && Object.values(quietCards).every(a => a.length === 1 && a[0] === p1.userId),
        JSON.stringify({ quiet, cards: quietCards, paused: quietPaused, p1: p1.userId }));
    const selfPosted = await p1.eval(`return game.i18n.localize("DRPG.Safeword.selfPosted");`);
    const p1Said = (await swPopups(p1)).filter(p => p.seq > p1Seq0);
    const p3Said = await swPopups(p3);
    check("p1's card says its own browser posted it, and p3's, which the GM answered, does not",
        p1Said.length === 1 && p1Said[0].body.includes(selfPosted) && p3Said.length > 0 && !p3Said.some(p => p.body.includes(selfPosted)),
        JSON.stringify({ p1: p1Said, p3: p3Said.map(p => p.body.slice(-70)), selfPosted }));
    const again0 = (await swAuthors(p2)).length;
    const again = await p3.eval(`const S = await import("${REPO}/scripts/safeword.mjs");
        const { TIMING } = await import("${REPO}/scripts/config.mjs");
        const ok = await S.callSafeword({});
        await new Promise(r => setTimeout(r, (TIMING.safewordAnswerMs ?? 3000) + 500));
        return ok;`, { timeout: 30000 }).catch(e => String(e));
    await settle(500);
    const againCards = (await swAuthors(p2)).slice(again0);
    check("p3 again inside the window of the GM's card: the GM posts nothing, and neither does p3's browser",
        again === true && againCards.length === 0, JSON.stringify({ again, cards: againCards }));
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

    /* p1'S REROLL INTO A DESPAIR RESULT, SETTLED AS A FRESH ROLL (E08+E28 C4b, 03.10.2026; audit
       S02-22). Aiko feeds this GM's pool (the Pain above pointed her at it). p1 throws a Hope roll
       of hers, kept on the GMs; the GM arms it to throw a Despair result (`REROLL_ARM`) and p1 asks
       the Reroll - twice, with "Rolls grant Despair" on and then off. A Reroll's Despair went
       through the pool's bounds alone, so it fed the pool with the setting off. Read on the GM:
       the pool's move across each Reroll, whether each was made by the GM's hand, and the Hope
       it took - 4: the price and the Hope result's own point (the harness world's players' Hope
       and Fear automation is on). */
    const grantWas = await gm.eval(`await game.drpg.setDespair(game.user.id, 3).catch(() => {}); return game.settings.get("${MOD}", "despairFromRolls");`);
    const despairRerolls = {};
    for (const grant of [true, false]) {
        await gm.eval(`await game.settings.set("${MOD}", "despairFromRolls", ${grant}); return true;`);
        const thrown = await p1.eval(`globalThis.__forceRoll = { hope: 9, fear: 5 };
            try { const A = await import("${REPO}/scripts/action-rolls.mjs"); const o = await A.rollTrait(game.actors.get("${ids.aiko}"), "eye", { remember: true }); return o?.raw?.message?.id ?? null; }
            finally { delete globalThis.__forceRoll; }`, { timeout: 60000 });
        const kept = await gm.eval(`const S = await import("${REPO}/scripts/gm-stores.mjs"); const end = Date.now() + 6000;
            while (S.rerollBookmarkStore.get("${ids.aiko}")?.messageId !== ${JSON.stringify(thrown)} && Date.now() < end) await new Promise(r => setTimeout(r, 100));
            return S.rerollBookmarkStore.get("${ids.aiko}")?.messageId === ${JSON.stringify(thrown)};`, { timeout: 30000 });
        const arm = await gm.eval(REROLL_ARM({ hope: 9, fear: 5 }, { hope: 2, fear: 10 }), { timeout: 30000 });
        const pool0 = await gm.eval(`return game.drpg.getDespair(game.user.id);`);
        const asked = await p1.eval(REROLL_ASK, { timeout: 90000 });
        await settle(600);
        const read = await gm.eval(REROLL_READ, { timeout: 30000 });
        const pool1 = await gm.eval(`const m = game.messages.get(${JSON.stringify(thrown)}); await m?.delete(); return game.drpg.getDespair(game.user.id);`);
        despairRerolls[grant ? "on" : "off"] = { thrown: Boolean(thrown), kept, armed: arm.messageId === thrown, made: asked.made, paid: read.paid,
            byGm: read.rolls.length === 1 && read.rolls.every(u => u === read.gm), moved: pool1 - pool0 };
    }
    await gm.eval(`await game.settings.set("${MOD}", "despairFromRolls", ${JSON.stringify(grantWas)}); return true;`);
    const dr = despairRerolls;
    check("p1: a Reroll into a Despair result feeds Aiko's Monokuma one point with \"Rolls grant Despair\" on, and none with it off",
        ["on", "off"].every(k => dr[k]?.thrown && dr[k].kept && dr[k].armed && dr[k].made === true && dr[k].paid === 4 && dr[k].byGm)
            && dr.on.moved === 1 && dr.off.moved === 0,
        JSON.stringify(dr), { flow: "despair" });
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

    // ---- 6b. a Confusion's armed Call: the GMs' store and the owner's copy, not the target -----
    /*
     * E06 fix r2-G4, 28.09.2026; review round 2's mn2. A Confusion's Call was an entry of the
     * target's `pendingCall` flag, which every browser holds, written at the moment the room
     * watched the Monocub roll - so every console read whom it was aimed at. It is the GMs'
     * store now and the owner's copy (call-effects.mjs). The GM arms one on Aiko as
     * `resolveMeddle` does (tier 2's "Confusion is seen by the room" drives that path, on the
     * GM alone): p1, her player, is sent it and reads it for her next roll; p2 holds it
     * nowhere - not on her flag, not in a copy; p2's ask naming it spent drops nothing, as p2
     * does not own her, and a copy p2 hands p1 is not taken, as p2 is no GM; and a spend on
     * p1's browser takes it out of the GMs' store and p1's copy. At adc8fb4's runtime the
     * first, third and fourth are red (the fourth because there is no store to hold it); the
     * fifth is green there by nature, with nothing listening.
     */
    phase("a Confusion's armed Call", { flow: "monocub-meddle" });
    const confusionSeen = c => c.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        const S = await import("${REPO}/scripts/gm-stores.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        const flag = aiko.getFlag("${MOD}", "pendingCall");
        return {
            armed: E.pendingCalls(aiko).filter(e => e.key === "meddle").map(e => e.nonce),
            onFlag: (Array.isArray(flag) ? flag : flag ? [flag] : []).filter(e => e?.key === "meddle").length,
            store: game.user.isGM ? (S.confusionStore?.get(aiko.id)?.calls ?? []).map(e => e.nonce) : null,
            copy: game.user.isGM ? null : Object.keys(S.confusionCopy?.read() ?? {})
        };`);
    const armedNonce = await gm.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        const had = new Set(E.pendingCalls(aiko).map(e => e.nonce));
        await E.armCall(aiko, { key: "meddle", grants: "bonus", amount: -1 });
        return E.pendingCalls(aiko).find(e => e.key === "meddle" && !had.has(e.nonce))?.nonce ?? null;`, { timeout: 30000 });
    const p1Sees = await p1.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        for (let i = 0; i < 50 && !E.pendingCalls(aiko).some(e => e.nonce === "${armedNonce}"); i++) await new Promise(r => setTimeout(r, 100));
        return E.pendingCalls(aiko).some(e => e.nonce === "${armedNonce}");`, { timeout: 30000 });
    await settle(300);
    const gmConf = await confusionSeen(gm), p2Conf = await confusionSeen(p2);
    check("gm: a Confusion is armed in the GMs' store, and Aiko's flag holds none",
        Boolean(armedNonce) && gmConf.armed.includes(armedNonce) && (gmConf.store ?? []).includes(armedNonce) && gmConf.onFlag === 0,
        JSON.stringify({ armedNonce, gm: gmConf }), { flow: "monocub-meddle" });
    check("p1: Aiko's player is sent the Confusion and reads it for her next roll", p1Sees === true,
        JSON.stringify({ armedNonce, p1: await confusionSeen(p1) }), { flow: "monocub-meddle" });
    check("p2: holds no Confusion of Aiko's - not on her flag, not in a copy",
        p2Conf.armed.length === 0 && p2Conf.onFlag === 0 && !(p2Conf.copy ?? []).includes(ids.aiko),
        JSON.stringify(p2Conf), { flow: "monocub-meddle" });
    await p2.eval(`
        const primary = game.users.find(u => u.isGM && u.active)?.id;
        game.socket.emit("module.${MOD}", { action: "confusion.ask", spent: { "${ids.aiko}": ["${armedNonce}"] } }, { recipients: [primary] });
        return true;`);
    await settle(1000);
    const afterForged = await confusionSeen(gm);
    check("gm: p2's ask naming Aiko's Confusion spent drops nothing - p2 does not own her",
        (afterForged.store ?? []).includes(armedNonce), JSON.stringify(afterForged), { flow: "monocub-meddle" });
    await p2.eval(`
        game.socket.emit("module.${MOD}", { action: "confusion.calls", userId: "${IDS.p1}",
            confusions: { "${ids.aiko}": { calls: [{ key: "meddle", grants: "advantage", amount: null, nonce: "p2forgedCall" }] } },
            stamps: { "${ids.aiko}": Date.now() + 1000 } }, { recipients: ["${IDS.p1}"] });
        return true;`);
    await settle(1000);
    const p1Forged = await p1.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        return E.pendingCalls(game.actors.get("${ids.aiko}")).map(e => e.nonce);`);
    check("p1: a copy p2 hands p1 is not taken - p2 is no GM",
        !p1Forged.includes("p2forgedCall") && p1Forged.includes(armedNonce), JSON.stringify(p1Forged), { flow: "monocub-meddle" });
    const p1Spent = await p1.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        const spent = await E.consumeCalls(game.actors.get("${ids.aiko}"));
        return spent.filter(e => e.key === "meddle").map(e => e.nonce);`, { timeout: 30000 });
    const gmAfter = await gm.eval(`
        const S = await import("${REPO}/scripts/gm-stores.mjs");
        const held = () => (S.confusionStore?.get("${ids.aiko}")?.calls ?? []).some(e => e.nonce === "${armedNonce}");
        for (let i = 0; i < 50 && held(); i++) await new Promise(r => setTimeout(r, 100));
        return held();`, { timeout: 30000 });
    await settle(300);
    const p1After = await confusionSeen(p1);
    check("p1: a roll's spend takes the Confusion out of the GMs' store and p1's copy",
        p1Spent.includes(armedNonce) && gmAfter === false && p1After.armed.length === 0 && !(p1After.copy ?? []).includes(ids.aiko),
        JSON.stringify({ armedNonce, p1Spent, gmStillHolds: gmAfter, p1: p1After }), { flow: "monocub-meddle" });

    // ---- 6b+. a Call armed while the roll window is open waits for the next roll ------------
    /*
     * E08+E28 C7, 03.10.2026; audit S02-20. A Call armed on a character whose roll window stood
     * open was spent by that window's close with everything else on the list, on a roll it never
     * touched. Daggerheart's window is not in the harness, so p1 holds a stand-in for Aiko's,
     * handed to roll-dialog.mjs's two hooks as tier 2's `rollWindow` does. The GM arms a Support
     * on Aiko, p1 opens the window on it, the GM arms an Obstacle - a GM's flag write, which p1's
     * `updateActor` sees - and p1 submits. Read: on p1 whether the window was redrawn and the line
     * it carries; on the GM, Aiko's armed list once p1's close has landed. Aiko's list is emptied
     * first and put back after. Until C7 nothing redrew p1's window and its close spent both.
     */
    phase("a Call armed while the roll window is open", { flow: "call-arm" });
    const armOnAiko = (key, kind, grants) => gm.eval(`const E = await import("${REPO}/scripts/call-effects.mjs");
        return Boolean(await E.armCall(game.actors.get("${ids.aiko}"), { key: "${key}", kind: "${kind}", grants: "${grants}" }));`, { timeout: 30000 });
    const aikoCallsWere = await gm.eval(`const a = game.actors.get("${ids.aiko}"); const was = a.getFlag("${MOD}", "pendingCall") ?? null;
        await a.unsetFlag("${MOD}", "pendingCall"); return was;`);
    const supportArmed = await armOnAiko("support", "hope", "advantage");
    const windowOpen = await p1.eval(`
        const D = await import("${REPO}/scripts/roll-dialog.mjs"), E = await import("${REPO}/scripts/call-effects.mjs");
        const { DRPG_ACTION_ROLL } = await import("${REPO}/scripts/action-rolls.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        for (let i = 0; i < 50 && !E.pendingCalls(aiko).some(e => e.key === "support"); i++) await new Promise(r => setTimeout(r, 100));
        const element = document.createElement("div");
        element.className = "application roll-selection";
        const win = globalThis.__waitingWindow = { element, options: { classes: ["roll-selection"] }, renders: 1,
            config: { roll: {}, [DRPG_ACTION_ROLL]: true, data: { parent: aiko } },
            render() { this.renders += 1; queueMicrotask(() => D.onRenderApplication(this, this.element)); return this; } };
        D.onRenderApplication(win, element);
        await new Promise(r => setTimeout(r, 300));
        return { armed: E.pendingCalls(aiko).map(e => e.key), renders: win.renders };`, { timeout: 30000 });
    const obstacleArmed = await armOnAiko("obstacle", "despair", "disadvantage");
    const windowClosed = await p1.eval(`
        const D = await import("${REPO}/scripts/roll-dialog.mjs");
        const win = globalThis.__waitingWindow, line = () => win.element.querySelector(".drpg-calls-waiting")?.textContent ?? null;
        for (let i = 0; i < 50 && line() === null; i++) await new Promise(r => setTimeout(r, 100));
        const out = { redrawn: win.renders > ${JSON.stringify(windowOpen.renders)}, line: line(),
            expect: game.i18n.format("DRPG.Calls.waitsNextRoll", { what: game.i18n.localize("DRPG.Calls.grants.disadvantage") }) };
        await D.onCloseApplication(win);
        delete globalThis.__waitingWindow;
        return out;`, { timeout: 30000 });
    const aikoArmed = await gm.eval(`const a = game.actors.get("${ids.aiko}");
        const keys = () => { const f = a.getFlag("${MOD}", "pendingCall"); return (Array.isArray(f) ? f : f ? [f] : []).map(e => e?.key); };
        for (let i = 0; i < 50 && keys().includes("support"); i++) await new Promise(r => setTimeout(r, 100));
        return keys();`, { timeout: 30000 });
    check("p1: an Obstacle the GM arms while Aiko's roll window is open redraws it with a line that it waits, and the window's close spends the Support alone",
        supportArmed && obstacleArmed && windowOpen.armed.join() === "support" && windowClosed.redrawn === true
            && windowClosed.line === windowClosed.expect && aikoArmed.join() === "obstacle",
        JSON.stringify({ supportArmed, obstacleArmed, windowOpen, windowClosed, aikoArmed }), { flow: "call-arm" });
    await gm.eval(`const a = game.actors.get("${ids.aiko}"), was = ${JSON.stringify(aikoCallsWere)};
        if (was) await a.setFlag("${MOD}", "pendingCall", was); else await a.unsetFlag("${MOD}", "pendingCall"); return true;`);

    // ---- 6c. a project's work: a project with no statistic asks the GM once ------------------
    /*
     * A PROJECT'S STATISTIC (E32+E07 C11d, 02.10.2026; the owner's rules of 28.09.2026). A
     * project's roll takes the project's own statistic, and a project stored without one - both
     * forms allowed it until 1.2.66 - asks a GM once, through the statistic card in the
     * player's thread (scripts/trait-ruling.mjs, kind `project`); the pick is written to the
     * project. The GM makes a public project with no room and no statistic and refills Aiko's
     * actions; p1 works on it twice from the Projects window, its dialogs answered with their
     * defaults (Work on, the first project - this one), the dice forced. The harness's GM
     * presses the card's first trait, Hand (client-entry.mjs `__traitRulingAuto`). Read: the
     * cards the GM pressed, the statistic Aiko's `rollTrait` was handed each time (noted on
     * the way through to the harness's own), and the project's statistic on p1 and the GM.
     */
    phase("a project's work", { flow: "projects" });
    await clearLogs();
    const workProject = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const actor = game.actors.get("${ids.aiko}");
        await game.drpg.setActions(actor, game.drpg.actionsMax(actor));
        globalThis.__traitRulings.length = 0;
        return (await P.createProject({ name: "QA project with no statistic", target: 6, room: null }))?.id ?? null;`, { timeout: 30000 });
    await settle(600);
    const work = await p1.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        const rolled = [];
        const own = Object.getPrototypeOf(actor).rollTrait;
        actor.rollTrait = async function (key, options) { rolled.push(key); return own.call(actor, key, options); };
        const traitNow = () => P.allProjects().find(p => p.id === "${workProject}")?.trait ?? null;
        const out = { listed: P.projectsAvailableIn((await import("${REPO}/scripts/movement.mjs")).roomOfActor(actor)).map(p => p.id), err: null };
        try {
            await game.drpg.performAction(actor, "project", {});
            out.first = [...rolled];
            for (let i = 0; i < 40 && traitNow() === null; i++) await new Promise(r => setTimeout(r, 100));
            out.kept = traitNow();
            await game.drpg.performAction(actor, "project", {});
        } catch (e) { out.err = String(e?.stack ?? e).slice(0, 300); }
        delete actor.rollTrait;
        await new Promise(r => setTimeout(r, 600));
        return { ...out, rolled, dialogs: globalThis.__dialogLog.map(d => d.title) };`, { timeout: 120000 });
    await settle(600);
    /* THE WORK, REROLLED FROM p1's BROWSER AND MADE ON THE GM (E08+E28 C4a). The second Work's
       new dice are a Hope result too low to score, so the GM takes the progress it added back off
       the project. Read on the GM as for the Search, and the project's progress before and after. */
    const progressOf = `const P = await import("${REPO}/scripts/projects.mjs"); return P.allProjects().find(p => p.id === "${workProject}")?.current ?? null;`;
    const workArm = await gm.eval(REROLL_ARM({ hope: 9, fear: 5 }, { hope: 2, fear: 1 }), { timeout: 30000 });
    const progressBefore = await gm.eval(progressOf);
    const workAsk = await p1.eval(REROLL_ASK, { timeout: 90000 });
    await settle(600);
    const workReroll = await gm.eval(REROLL_READ, { timeout: 30000 });
    const progressAfter = await gm.eval(progressOf);
    const added = Number(workArm.row?.facts?.progress ?? 0);
    check("p1: a Reroll of a Work on a project is paid and made on the GM - its Hope and the message's rolls by the GM's hand, and the progress it added taken off",
        workArm.row?.actionKey === "project" && workArm.row?.by === IDS.p1 && added > 0 && workAsk.made === true
            && workReroll.hope.length === 1 && workReroll.hope.every(u => u === workReroll.gm) && workReroll.paid === 3
            && JSON.stringify(workReroll.rolls) === JSON.stringify([workReroll.gm])
            && progressBefore - progressAfter === added && workReroll.row?.facts?.progress === 0 && !workReroll.journal,
        JSON.stringify({ workReroll, progressBefore, progressAfter, added, made: workAsk.made, arm: workArm.row }), { flow: "reroll" });

    const workGm = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const trait = P.allProjects().find(p => p.id === "${workProject}")?.trait ?? null;
        const pressed = globalThis.__traitRulings.map(r => ({ offered: r.offered, picked: r.picked }));
        if ("${workProject}") await P.deleteProject("${workProject}");
        return { trait, pressed };`, { timeout: 30000 });
    check("p1: a first Work on a project with no statistic waits for the GM's card and rolls the pick (Hand), and the project keeps it on p1 and the GM",
        Boolean(workProject) && !work.err && work.listed[0] === workProject
            && JSON.stringify(work.first) === JSON.stringify(["finesse"]) && work.kept === "hand" && workGm.trait === "hand"
            && workGm.pressed.length >= 1 && JSON.stringify(workGm.pressed[0]) === JSON.stringify({ offered: ["hand", "body", "leg", "head"], picked: "hand" }),
        JSON.stringify({ workProject, work, workGm }), { flow: "trait-ruling" });
    check("p1: the second Work on it asks nobody and rolls the project's statistic",
        !work.err && JSON.stringify(work.rolled) === JSON.stringify(["finesse", "finesse"]) && workGm.pressed.length === 1,
        JSON.stringify({ rolled: work.rolled, pressed: workGm.pressed }), { flow: "projects" });

    // ---- 6c'. a player's Sabotage, rerolled into a miss ------------------------------------------
    /*
     * THE SABOTAGE'S FACTS ON ITS OWN ROW (E08+E28 fix r1-G1, 04.10.2026; the round-1 review's B1).
     * The GM wrote a player's freeze and repair on the sender's newest Sabotage row as the packet
     * arrived, and `roll.bookmark`'s run kept the row after it (5 of 5 of the review's runs), so
     * the Reroll into a miss took nothing back. The packet names its roll now, and the fact waits
     * for that roll's row (action-rolls.mjs `noteFactOfRoll`). p1 sabotages a project alone in
     * Aiko's room on forced dice, and rerolls into 3 (`REROLL_ARM`). Read on the GM: the row's
     * facts (the freeze, the repair and the Sabotage's own trace, which names the roll too), the
     * freeze and the repairs of the target before and after. The race itself is timing: at
     * d20fadb's runtime this check passed (1 run, the row kept before the packet in this order)
     * while the review's 97 failed 2 runs of 3; tier 2's "a player's Sabotage judged before its
     * roll's row is kept..." holds the order. What this one catches is the naming, end to end
     * (the Sabotage or its trace sent with no roll: red).
     */
    phase("a player's Sabotage and its Reroll", { flow: "projects" });
    const sabTarget = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const M = await import("${REPO}/scripts/movement.mjs");
        const actor = game.actors.get("${ids.aiko}");
        await game.drpg.setActions(actor, game.drpg.actionsMax(actor));
        return (await P.createProject({ name: "QA sabotage target", target: 6, room: M.roomOfActor(actor), trait: "eye" }))?.id ?? null;`, { timeout: 30000 });
    await settle(600);
    const sabotaged = await p1.eval(`globalThis.__forceRoll = { hope: 9, fear: 5 };
        const actor = game.actors.get("${ids.aiko}"); let r = null, err = null;
        try { r = await game.drpg.performAction(actor, "sabotage", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        return { err, success: r?.success ?? null, applied: r?.applied ?? null };`, { timeout: 120000 });
    await settle(1500);
    const freezeOf = `const P = await import("${REPO}/scripts/projects.mjs");
        return { frozen: P.isFrozen("${sabTarget}"), repairs: P.allProjects().filter(p => P.repairs(p.id) === "${sabTarget}").map(p => p.id) };`;
    const sabArm = await gm.eval(REROLL_ARM({ hope: 9, fear: 5 }, { hope: 2, fear: 1 }), { timeout: 30000 });
    const sabBefore = await gm.eval(freezeOf);
    const sabAsk = await p1.eval(REROLL_ASK, { timeout: 90000 });
    await settle(600);
    const sabReroll = await gm.eval(REROLL_READ, { timeout: 30000 });
    const sabAfter = await gm.eval(freezeOf);
    await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        for (const id of [...P.allProjects().filter(p => P.repairs(p.id) === "${sabTarget}").map(p => p.id), "${sabTarget}"]) await P.deleteProject(id).catch(() => {});
        return true;`, { timeout: 30000 });
    check("p1: a Reroll of a Sabotage into a miss thaws the project and deletes its one repair, both on the roll's own row on the GM",
        Boolean(sabTarget) && !sabotaged.err && sabotaged.applied === true && sabArm.row?.actionKey === "sabotage"
            && sabBefore.frozen && sabBefore.repairs.length === 1
            && sabArm.row?.facts?.targetProjectId === sabTarget && sabArm.row?.facts?.repairId === sabBefore.repairs[0]
            && Boolean(sabArm.row?.facts?.remnantId)
            && sabAsk.made === true && sabReroll.paid === 3 && !sabAfter.frozen && sabAfter.repairs.length === 0 && !sabReroll.journal,
        JSON.stringify({ sabTarget, sabotaged, arm: sabArm.row, sabBefore, sabAfter, made: sabAsk.made, paid: sabReroll.paid, journal: sabReroll.journal }),
        { flow: "reroll" });

    // ---- 6d. an indirect murder's work: the cover window closed ---------------------------------
    /*
     * A CLOSED WINDOW COVERS NOTHING (E32+E07 C13, 03.10.2026; audit S02-03). Every Work on an
     * indirect murder rolls to cover its traces once the progress is in, and a closed window left
     * no trace at all: the drop sat under `if (trace)`. It leaves the worst band's trace now
     * ("obvious") and a line on the card (action-rolls.mjs `hideProjectTraces`). The GM makes Aiko
     * an indirect murder of her own with a statistic and refills her actions; p1 works on it from
     * the Projects window, its dialogs answered with their defaults, the dice forced, and Aiko's
     * `rollTrait` answers null for the cover roll alone, as a closed window does. Read: the last
     * two throws on p1 (a witness in her room asks a concealment roll before them), the card's
     * line on p1, and on the GM the traces the project left.
     */
    phase("an indirect murder's work with the cover window closed", { flow: "projects" });
    await clearLogs();
    const trapName = "QA trap nobody covered";
    const trapProject = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const actor = game.actors.get("${ids.aiko}");
        await game.drpg.setActions(actor, game.drpg.actionsMax(actor));
        return (await P.createProject({ name: "${trapName}", target: 6, room: null, trait: "hand", indirectMurder: true,
            killerId: actor.id, by: actor.id }))?.id ?? null;`, { timeout: 30000 });
    await settle(600);
    const uncovered = await p1.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const S = await import("${REPO}/scripts/secret.mjs");
        const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        const cover = game.i18n.localize("DRPG.Roll.hideTraces"), line = game.i18n.localize("DRPG.Project.tracesUncovered");
        const seen = new Set(game.messages.map(m => m.id));
        const thrown = [];
        const own = Object.getPrototypeOf(actor).rollTrait;
        actor.rollTrait = async function (key, options) {
            const closed = String(options?.title ?? "").startsWith(cover);
            thrown.push(closed ? "closed" : key);
            return closed ? null : own.call(actor, key, options);
        };
        const out = { listed: P.projectsAvailableIn((await import("${REPO}/scripts/movement.mjs")).roomOfActor(actor)).map(p => p.id), err: null };
        try {
            await game.drpg.performAction(actor, "project", {});
        } catch (e) { out.err = String(e?.stack ?? e).slice(0, 300); }
        delete actor.rollTrait;
        await new Promise(r => setTimeout(r, 800));
        return { ...out, thrown, carded: game.messages.some(m => !seen.has(m.id) && S.contentOf(m).includes(line)) };`, { timeout: 120000 });
    await settle(600);
    const uncoveredGm = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const R = await import("${REPO}/scripts/remnants.mjs");
        const left = R.remnantsOn(canvas.scene).filter(t => R.remnantData(t)?.subject === "${trapName}");
        const traces = left.map(t => R.remnantData(t)).map(d => [d.type, d.visibility]);
        // Tied to the crime: the GM reads it off the project the packet names (gm-bridge.mjs \`worksOwnMurder\`, fix r2-G3).
        const tied = left.map(t => R.remnantData(t)?.tiedToCrime ?? null);
        for (const t of left) { try { await R.dropRemnantSecret(t); } catch {} await t.delete(); }
        if ("${trapProject}") await P.deleteProject("${trapProject}");
        return { traces, tied };`, { timeout: 30000 });
    /* The trace is the crime's (E32+E07 fix r2-G3, 03.10.2026; the round-2 review's C2-m9 (a)): C13 dropped this
       half of the check when it found a player's packet never tied a trace; the GM judges the tie on its own record. */
    check("p1: a Work on an indirect murder whose cover window was closed leaves one Obvious trace tied to the crime, and says so on the card",
        Boolean(trapProject) && !uncovered.err && uncovered.listed.includes(trapProject)
            && JSON.stringify(uncovered.thrown.slice(-2)) === JSON.stringify(["finesse", "closed"]) && uncovered.carded === true
            && JSON.stringify(uncoveredGm.traces) === JSON.stringify([["prep", "obvious"]]) && JSON.stringify(uncoveredGm.tied) === "[true]",
        JSON.stringify({ trapProject, uncovered, uncoveredGm }), { flow: "projects" });

    // ---- 7. uncaught errors ------------------------------------------------------------------
    phase("errors");
    for (const c of [gm, ...players]) {
        const errs = await c.eval(`return globalThis.__errors.slice(0, 5);`);
        check(`${c.who}: no uncaught errors`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0, 400));
    }
}
