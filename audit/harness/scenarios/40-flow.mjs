/**
 * QA 1.2.42: one GM and three players through a Daily Life time of day.
 * Clock, actions, a Search, a Hope Call that waits for the GM, the messenger,
 * the safeword, a Despair Call - and on every client: what was said to whom.
 */
export const layers = ["ci"];

const MOD = "danganronpa-rpg";

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl: REPO, canary, IDS, socketTraffic }) {
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
        await aiko.update({ "system.resources.hope.value": Math.max(4, hopeWas) });
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
        const w = globalThis.__rerollWrites, aiko = game.actors.get("${ids.aiko}"), row = S.rerollBookmarkStore.get("${ids.aiko}");
        for (const [name, id] of w.hooks) Hooks.off(name, id);
        const m = game.messages.get(w.messageId ?? ""); if (m) delete m.rolls;
        const out = { hope: w.hope, rolls: w.rolls, items: w.items, paid: w.hopeAt - aiko.system.resources.hope.value,
            row: row ? { total: row.total, claims: row.claims, facts: row.facts, rerolled: row.rerolled ?? false } : null,
            journal: Boolean(S.rerollJournalStore.has("${ids.aiko}")), gm: game.user.id };
        await aiko.update({ "system.resources.hope.value": w.hopeWas });
        return out;`;

    // ---- 0. season setup basics: Monokuma pool, clock at day 1 morning ----------------------
    phase("season setup", { flow: "clock-day" });
    /* The GMs' audit of a sheet (E29 C3, the plan's section 6): every write on a student patches its mark on
       the primary when it moves it. Counted from here to the end of the day, with the rows it writes (below). */
    await gm.eval(`const S = await import("${REPO}/scripts/gm-stores.mjs");
        globalThis.__markPatches = 0; globalThis.__auditFrom = Date.now();
        const store = S.sheetMarkStore;
        if (store && !store.__counted) {
            const patch = store.patch;
            store.patch = (...args) => { globalThis.__markPatches++; return patch.apply(store, args); };
            store.__counted = true;
        }
        return true;`);
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
    // Aiko's Hope writes while the Search runs, on the GM - read in "the GM draws p1's Search" below.
    await gm.eval(`const a = game.actors.get("${ids.aiko}");
        globalThis.__c12aHope = { before: a.system.resources.hope.value, max: a.system.resources.hope.max, by: [] };
        globalThis.__c12aHopeHook = Hooks.on("updateActor", (actor, changes, opts, userId) => {
            if (actor.id === "${ids.aiko}" && foundry.utils.getProperty(changes, "system.resources.hope") !== undefined) globalThis.__c12aHope.by.push(userId);
        });
        return true;`);
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

    /* THE GM DREW p1's SEARCH (E08+E28 C12a, 04.10.2026; audit S16-05). p1's browser configured the
       roll and sent it unevaluated; the GM threw it - the harness carries p1's scripted faces to the
       GM's randomiser, as nothing does at a table - wrote its message, kept its record and settled
       its Hope (roll-draw.mjs). Read on the GM: the newest drawn message, its author and record, and
       Aiko's Hope writes while the Search ran; on p1: the dice it played as its own, not
       synchronised, and the character it kept for the message. Until C12a p1 wrote the message as
       its author, and its Hope went through the relay from p1's commit. */
    phase("the GM draws p1's Search", { flow: "gm-rolls-total" });
    const drawnSearch = await gm.eval(`const D = await import("${REPO}/scripts/roll-draw.mjs").catch(() => null);
        Hooks.off("updateActor", globalThis.__c12aHopeHook);
        const m = game.messages.contents.filter(x => x.getFlag("${MOD}", "drawn")).at(-1) ?? null;
        const r = D?.rollRecord(m?.getFlag("${MOD}", "rollId") ?? null) ?? null;
        const roll = m?.rolls?.[0] ?? null;
        return { id: m?.id ?? null, author: m?.author?.id ?? null, gm: game.user.id, userId: r?.userId ?? null, actorId: r?.actorId ?? null,
            actionKey: r?.actionKey ?? null, total: r?.total ?? null, faces: [r?.hope ?? null, r?.fear ?? null],
            same: Boolean(r) && r.hope === roll?.dHope?.total && r.fear === roll?.dFear?.total && r.total === roll?.total,
            hoped: Boolean(r?.withHope || r?.isCritical), hope: globalThis.__c12aHope,
            flags: r?.flags ?? null, expected: r ? { trait: r.expected?.trait, from: r.expected?.traitFrom, situation: r.expected?.situationFrom } : null };`);
    const p1Drawn = await p1.eval(`const P = await import("${REPO}/scripts/private-rolls.mjs");
        const m = game.messages.get(${JSON.stringify(drawnSearch.id)});
        return { me: game.user.id, subject: P.keptRollSubject(m), shown: globalThis.__dsnShown.filter(s => s.user === game.user.id && !s.synchronize).map(s => s.total) };`);
    check("gm: p1's Search was drawn on the GM - the GM wrote its message, its record names p1, Aiko and the Search, its dice are the message's",
        drawnSearch.author === drawnSearch.gm && drawnSearch.userId === p1Drawn.me && drawnSearch.actorId === ids.aiko
            && drawnSearch.actionKey === "search" && drawnSearch.same && JSON.stringify(drawnSearch.faces) === JSON.stringify([9, 5]),
        JSON.stringify({ drawnSearch, p1: p1Drawn.me }));
    const hopeOwed = drawnSearch.hoped && drawnSearch.hope?.before < drawnSearch.hope?.max ? 1 : 0;
    check("gm: the drawn Search's Hope was written once, by the GM",
        hopeOwed === 1 && drawnSearch.hope?.by?.length === 1 && drawnSearch.hope.by[0] === drawnSearch.gm,
        JSON.stringify({ owed: hopeOwed, hope: drawnSearch.hope }));
    check("p1: played the GM's dice as its own throw, and kept the roll's character",
        p1Drawn.shown.includes(drawnSearch.total) && p1Drawn.subject === ids.aiko, JSON.stringify(p1Drawn));
    /* WHAT THE GM EXPECTED OF IT (E08+E28 C12b, 04.10.2026). The GM holds the roll against what it
       knows (roll-draw.mjs `expectedFor`): Eye for a Search, the room's favour and hidden stash read
       by the GM for the room it sees Aiko in, no Call armed - and p1's honest Search differs in
       nothing. Until C12b nothing was expected. */
    check("gm: p1's Search was held to Eye and to the room the GM sees Aiko in, and nothing was flagged",
        drawnSearch.expected?.trait === "eye" && drawnSearch.expected?.from === "search" && drawnSearch.expected?.situation === "gm"
            && Array.isArray(drawnSearch.flags) && drawnSearch.flags.length === 0,
        JSON.stringify({ expected: drawnSearch.expected, flags: drawnSearch.flags }), { flow: "gm-rolls-total" });

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
       struck and the line with both totals in the new roll's colour; p2 holds the document and not
       the words, and draws neither. The stamp itself (E08+E28 fix r1-G6, 04.10.2026; the round-1
       review's S4) came with the words to p1 (`cardFlag`), and p2 holds it nowhere: C5 wrote it on
       the document, and p2's browser held both totals of a card it may not read. */
    const replacedOn = c => c.eval(`const m = game.messages.get(${JSON.stringify(searchCard?.id ?? null)});
        if (!m) return null;
        const li = document.createElement("li");
        li.innerHTML = '<header class="message-header"></header><div class="message-content"><p class="notes" data-drpg-secret>-</p></div>';
        Hooks.callAll("renderChatMessageHTML", m, li);
        await new Promise(r => setTimeout(r, 0));
        const line = li.querySelector(".drpg-reroll-replaced");
        const S = await import("${REPO}/scripts/secret.mjs");
        return { mark: S.cardFlag(m, "rerolled") ?? null, onDoc: m.flags?.["${MOD}"]?.rerolled ?? null,
            struck: li.querySelector(".drpg-card-head .drpg-card-total")?.style.getPropertyValue("text-decoration") ?? null,
            line: line?.textContent ?? null, tone: line?.dataset.tone ?? null };`);
    const replacedP1 = await replacedOn(p1), replacedP2 = await replacedOn(p2);
    check("p1: the Search's card a Reroll replaced is drawn with its total struck and a line of both totals in the new roll's colour - p2, without its words, draws neither and holds no mark",
        Boolean(searchCard) && searchArm.row?.reportMessageId === searchCard.id
            && replacedP1?.mark?.from === 14 && replacedP1.mark.to === 4 && replacedP1.mark.tone === "hope"
            && replacedP1.struck === "line-through" && / 14 -> 4 /.test(replacedP1.line ?? "") && replacedP1.tone === "hope"
            && replacedP1.onDoc === null && replacedP2 && replacedP2.mark === null && replacedP2.onDoc === null
            && replacedP2.struck === null && replacedP2.line === null,
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
    /* A REPORT IS NOT A ROLL (E08+E28 C12b, 04.10.2026; the owner's note of 28.09.2026 on E06 fix
       r2-G4). p1 spends Aiko's Confusion with no roll - `consumeCalls`, as a console can - and its ask
       tells the primary it is spent: the primary takes a report only for a nonce a drawn roll's
       record names, so the GMs' store keeps it. Then a second Confusion, which p1 reads, and a roll
       of Aiko's thrown from p1: the GM draws it, spends the Confusion the roll applied as it draws it,
       and its record names it; p1's copy is sent without it. The harness's roll is built with no roll
       window, so the Confusion's -1 is not on its dice, and the GM flags it - read, not asked. Until
       C12b the report dropped the first, and p1's browser spent the second itself. */
    const p1Spent = await p1.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        const spent = await E.consumeCalls(game.actors.get("${ids.aiko}"));
        return spent.filter(e => e.key === "meddle").map(e => e.nonce);`, { timeout: 30000 });
    await settle(1000);
    const gmAfter = await gm.eval(`
        const S = await import("${REPO}/scripts/gm-stores.mjs");
        return (S.confusionStore?.get("${ids.aiko}")?.calls ?? []).some(e => e.nonce === "${armedNonce}");`, { timeout: 30000 });
    check("gm: p1's report of Aiko's Confusion spent, with no roll naming it, leaves it armed in the GMs' store",
        p1Spent.includes(armedNonce) && gmAfter === true, JSON.stringify({ armedNonce, p1Spent, gmStillHolds: gmAfter }), { flow: "monocub-meddle" });
    const rolledNonce = await gm.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        await E.consumeCallsByNonce(aiko, ["${armedNonce}"]);
        const had = new Set(E.armedCallsShown(aiko).map(e => e.nonce));
        await E.armCall(aiko, { key: "meddle", grants: "bonus", amount: -1 });
        return E.armedCallsShown(aiko).find(e => e.key === "meddle" && !had.has(e.nonce))?.nonce ?? null;`, { timeout: 30000 });
    const p1Rolled = await p1.eval(`
        const E = await import("${REPO}/scripts/call-effects.mjs");
        const A = await import("${REPO}/scripts/action-rolls.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        for (let i = 0; i < 50 && !E.pendingCalls(aiko).some(e => e.nonce === "${rolledNonce}"); i++) await new Promise(r => setTimeout(r, 100));
        const read = E.pendingCalls(aiko).some(e => e.nonce === "${rolledNonce}");
        globalThis.__forceRoll = { hope: 6, fear: 4 };
        let total = null;
        try { total = (await A.rollTrait(aiko, "eye", {}))?.total ?? null; } finally { delete globalThis.__forceRoll; }
        for (let i = 0; i < 50 && E.pendingCalls(aiko).some(e => e.nonce === "${rolledNonce}"); i++) await new Promise(r => setTimeout(r, 100));
        return { read, total, armed: E.pendingCalls(aiko).some(e => e.nonce === "${rolledNonce}") };`, { timeout: 60000 });
    const gmRolled = await gm.eval(`
        const S = await import("${REPO}/scripts/gm-stores.mjs");
        const row = Object.values(S.rollStore.entries()).filter(r => r?.actorId === "${ids.aiko}").sort((a, b) => b.at - a.at)[0] ?? null;
        return { held: (S.confusionStore?.get("${ids.aiko}")?.calls ?? []).some(e => e.nonce === "${rolledNonce}"),
            used: row?.used?.calls ?? null, total: row?.total ?? null, flags: (row?.flags ?? []).map(f => f.kind) };`);
    await settle(300);
    const p1After = await confusionSeen(p1);
    check("gm: a roll of Aiko's drawn from p1 spends the Confusion it applied on the GM, its record names it, and p1's copy loses it",
        Boolean(rolledNonce) && p1Rolled.read === true && typeof p1Rolled.total === "number" && p1Rolled.armed === false
            && gmRolled.held === false && (gmRolled.used ?? []).includes(rolledNonce) && gmRolled.total === p1Rolled.total
            && p1After.armed.length === 0 && !(p1After.copy ?? []).includes(ids.aiko),
        JSON.stringify({ rolledNonce, p1Rolled, gm: gmRolled, p1: p1After }), { flow: "monocub-meddle" });

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
    /* E08+E28 C12a: p1's Work on Project was drawn on the GM as the Search was - its newest drawn
       message the GM's, its record p1's, Aiko's and the project's: its action, and since fix r2-H2 the
       project it was drawn for (roll-draw.mjs `keepRecord`), the only one it settles. */
    phase("the GM draws p1's Work on Project", { flow: "gm-rolls-total" });
    const drawnWork = await gm.eval(`const D = await import("${REPO}/scripts/roll-draw.mjs").catch(() => null);
        const m = game.messages.contents.filter(x => x.getFlag("${MOD}", "drawn")).at(-1) ?? null;
        const r = D?.rollRecord(m?.getFlag("${MOD}", "rollId") ?? null) ?? null;
        return { author: m?.author?.id ?? null, gm: game.user.id, userId: r?.userId ?? null, actorId: r?.actorId ?? null, actionKey: r?.actionKey ?? null,
            project: r?.project ?? null };`);
    check("gm: p1's Work on Project was drawn on the GM, its record p1's, Aiko's and the project's",
        drawnWork.author === drawnWork.gm && drawnWork.userId === p1Drawn.me && drawnWork.actorId === ids.aiko && drawnWork.actionKey === "project"
            && drawnWork.project === workProject, JSON.stringify({ drawnWork, workProject }));

    /* A HOPE CALL'S PROGRESS, PAID FOR AND ADDED ONCE (E08+E28 fix r2-H2, 05.10.2026; review S2-5). Progress that
       names no roll is a Hope Call's, and the GM adds it for a payment of the Call's price it saw the player make,
       once (bridge-guards.mjs `guardCallProgress`, roll-draw.mjs `takeCallPayment`). p1 buys Contribution for Aiko
       on a project in her room by the sheet's own road (calls.mjs `spendHopeCall`): her Hope goes down by its price
       on p1's browser, and the GM adds its +1. Then p1 sends the same packet again with nothing paid. Read on the
       GM: the bar, Aiko's Hope and the refusals logged after each, and the answer p1 was given. */
    phase("a Hope Call's progress", { flow: "hope-call" });
    const callProject = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs"), M = await import("${REPO}/scripts/movement.mjs");
        const actor = game.actors.get("${ids.aiko}");
        await actor.update({ "system.resources.hope.value": 4 });
        (await import("${REPO}/scripts/utils.mjs")).clearSessionFailures();
        return (await P.createProject({ name: "QA contribution", target: 6, room: M.locateActor(actor)?.room ?? null }))?.id ?? null;`, { timeout: 30000 });
    await settle(600);
    const readCall = `const P = await import("${REPO}/scripts/projects.mjs");
        return { bar: P.allProjects().find(p => p.id === "${callProject}")?.current ?? null, hope: game.actors.get("${ids.aiko}").system.resources.hope.value,
            refused: (await import("${REPO}/scripts/utils.mjs")).sessionFailures().filter(e => e.message.includes('Refused a "project.progress"')).map(e => e.message) };`;
    const bought = await p1.eval(`const C = await import("${REPO}/scripts/calls.mjs");
        const r = await C.spendHopeCall(game.actors.get("${ids.aiko}"), "contribution", { choice: { project: "${callProject}" } });
        return r ? r.label ?? true : null;`, { timeout: 60000 });
    await settle(900);
    const afterBuy = await gm.eval(readCall);
    const replay = await p1.eval(`const B = await import("${REPO}/scripts/gm-bridge.mjs");
        const r = await B.requestProjectProgress("${callProject}", 1, { actorId: "${ids.aiko}", call: "contribution" });
        return { ok: r?.ok ?? null, reason: r?.reason ?? null };`, { timeout: 30000 });
    await settle(600);
    const afterReplay = await gm.eval(readCall);
    await gm.eval(`if ("${callProject}") await (await import("${REPO}/scripts/projects.mjs")).deleteProject("${callProject}"); return true;`, { timeout: 30000 });
    check("p1: a Contribution bought on p1's browser adds its +1 once, and the same packet sent again with nothing paid is refused and moves nothing",
        Boolean(callProject && bought) && afterBuy.bar === 1 && afterBuy.hope === 2 && !afterBuy.refused.length
            && replay.ok === false && replay.reason === "callNotPaid" && afterReplay.bar === 1 && afterReplay.hope === 2
            && afterReplay.refused.some(r => /no payment of that character's stands for that Call/.test(r)),
        JSON.stringify({ callProject, bought, afterBuy, replay, afterReplay }), { flow: "projects" });

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

    // ---- 6c''. a player's Sabotage that missed, rerolled into a success ---------------------------
    /*
     * A MISS NAMES ITS TARGET TO THE GMS (E08+E28 C16, 04.10.2026; the orchestrator's decision on
     * round 1's fix G1). Since fix r1-G1 the GM learns a player's Sabotage's target from its packet
     * alone, and a miss sent none, so its Reroll into a success froze nothing - until then the
     * roller's bookmark had carried the target of any Sabotage. A miss is sent now as a repair of 0
     * (action-rolls.mjs `performSabotage`), which freezes nothing and writes the target on the roll's
     * row (gm-bridge.mjs `handleSabotage`). p1 sabotages a project in Aiko's room on forced dice that
     * miss (3 and 2), and rerolls into 9 and 5. Read on the GM: the row's facts and the freeze before
     * and after the Reroll; and where each Sabotage packet p1 sent went - to the GMs, and nobody else.
     */
    phase("a player's Sabotage that missed and its Reroll", { flow: "projects" });
    const missTarget = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        const M = await import("${REPO}/scripts/movement.mjs");
        const actor = game.actors.get("${ids.aiko}");
        await game.drpg.setActions(actor, game.drpg.actionsMax(actor));
        return (await P.createProject({ name: "QA sabotage that missed", target: 6, room: M.roomOfActor(actor), trait: "eye" }))?.id ?? null;`, { timeout: 30000 });
    await settle(600);
    const sentFrom = socketTraffic.length;
    const missed = await p1.eval(`globalThis.__forceRoll = { hope: 3, fear: 2 };
        const actor = game.actors.get("${ids.aiko}"); let r = null, err = null;
        try { r = await game.drpg.performAction(actor, "sabotage", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        return { err, success: r?.success ?? null, applied: r?.applied ?? null };`, { timeout: 120000 });
    await settle(1500);
    const missFreezeOf = `const P = await import("${REPO}/scripts/projects.mjs");
        return { frozen: P.isFrozen("${missTarget}"), repairs: P.allProjects().filter(p => P.repairs(p.id) === "${missTarget}").map(p => p.id) };`;
    const missArm = await gm.eval(REROLL_ARM({ hope: 3, fear: 2 }, { hope: 9, fear: 5 }), { timeout: 30000 });
    const missBefore = await gm.eval(missFreezeOf);
    const missAsk = await p1.eval(REROLL_ASK, { timeout: 90000 });
    await settle(600);
    const missReroll = await gm.eval(REROLL_READ, { timeout: 30000 });
    const missAfter = await gm.eval(missFreezeOf);
    const gmIds = await gm.eval(`return game.users.filter(u => u.isGM).map(u => u.id);`);
    const sentTo = socketTraffic.slice(sentFrom).filter(t => t.from === "p1" && t.action === "project.sabotage").map(t => t.to);
    await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs");
        for (const id of [...P.allProjects().filter(p => P.repairs(p.id) === "${missTarget}").map(p => p.id), "${missTarget}"]) await P.deleteProject(id).catch(() => {});
        return true;`, { timeout: 30000 });
    check("p1: a Sabotage that missed freezes nothing and names its target on its roll's row, sent to the GMs alone, and its Reroll into a success freezes it once",
        Boolean(missTarget) && !missed.err && missed.success === false && missArm.row?.actionKey === "sabotage"
            && missArm.row?.facts?.targetProjectId === missTarget && !missArm.row?.facts?.repairId
            && !missBefore.frozen && missBefore.repairs.length === 0
            && sentTo.length >= 1 && sentTo.every(to => Array.isArray(to) && to.length > 0 && to.every(id => gmIds.includes(id)))
            && missAsk.made === true && missReroll.paid === 3 && missAfter.frozen && missAfter.repairs.length === 1 && !missReroll.journal,
        JSON.stringify({ missTarget, missed, arm: missArm.row, missBefore, missAfter, sentTo, gmIds, made: missAsk.made, paid: missReroll.paid, journal: missReroll.journal }),
        { flow: "reroll" });

    // ---- 6c'''. a player's Sabotage with Fear whose readied tool breaks on the roll ----------------
    /*
     * ITS TRACE IS LEFT AT THE BAND ITS REPAIR WAS MADE AT (E08+E28 fix r2-H3, 05.10.2026; the round-2
     * review's S2-9). The GM banded a player's Sabotage's trace with the tool readied on the sheet now
     * (gm-bridge.mjs `traceBandOf`), and made its repair with the relief the roller claimed, held to
     * every tool the character carries for a roll with Fear, whose Despair wears the readied one
     * before the packets leave (`repairOf`): a tier-1 tool that broke on the roll froze the project at
     * the first band and left the trace at a miss's. Both hold the claim one way now (action-rolls.mjs
     * `sabotageExtrasHeld`), and the claim rides the roll's own bookmark (`performSabotage`'s context),
     * because the trace's packet leaves before `noteRollContext` tells the GMs the relief. p1 sabotages
     * a project in Aiko's room holding a tier-1 tool readied (any tool she held put down for it), on
     * forced dice with Fear that come to 11 with her Eye - the first band only with the tool's relief
     * of 1. The harness's drawn total is the dice and the statistic: the +1 the tool arms in the roll
     * window does not reach it (05.10.2026, at a75e3f1: 4 and 6 came to 10 with an Eye of 0). "Rolls
     * grant Despair" is off for it, and Daggerheart's Fear put back after it. Read on the GM: the
     * roll's record, the tool, the freeze and its repair, and the band of the trace. Red at a75e3f1:
     * the trace "hidden", a miss's band.
     */
    phase("a player's Sabotage whose tool breaks on the roll", { flow: "projects" });
    const toolSetup = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs"), M = await import("${REPO}/scripts/movement.mjs");
        const U = await import("${REPO}/scripts/use-items.mjs"), I = await import("${REPO}/scripts/inventory.mjs");
        const actor = game.actors.get("${ids.aiko}");
        await game.drpg.setActions(actor, game.drpg.actionsMax(actor));
        const despair = game.settings.get("${MOD}", "despairFromRolls");
        await game.settings.set("${MOD}", "despairFromRolls", false);
        const put = U.readiedItems(actor).filter(i => I.servesAs(i, "tool")).map(i => i.id);
        for (const id of put) await actor.items.get(id).setFlag("${MOD}", U.EQUIPPED_FLAG, false);
        const [tool] = await actor.createEmbeddedDocuments("Item", [{ name: "QA tool that breaks", type: "loot",
            flags: { "${MOD}": { category: "tool", tier: 1, [U.EQUIPPED_FLAG]: true } } }]);
        const project = (await P.createProject({ name: "QA sabotage with a tool that breaks", target: 6, room: M.roomOfActor(actor), trait: "eye" }))?.id ?? null;
        const { gameSettings } = CONFIG.DH.SETTINGS;
        return { project, tool: tool?.id ?? null, readied: U.equippedFor(actor, "tool")?.id ?? null, put, despair,
            fear: game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear), eye: Number(actor.system.traits?.instinct?.value ?? 0) };`, { timeout: 30000 });
    await settle(600);
    // 11 = hope + fear + Eye, Fear the higher die and never a critical.
    const toolSum = 11 - toolSetup.eye, toolDice = { hope: Math.floor((toolSum - 1) / 2), fear: toolSum - Math.floor((toolSum - 1) / 2) };
    const toolSab = await p1.eval(`globalThis.__forceRoll = ${JSON.stringify(toolDice)};
        const actor = game.actors.get("${ids.aiko}"); let r = null, err = null;
        try { r = await game.drpg.performAction(actor, "sabotage", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        return { err, success: r?.success ?? null, applied: r?.applied ?? null };`, { timeout: 120000 });
    await settle(1500);
    const toolRead = await gm.eval(`const P = await import("${REPO}/scripts/projects.mjs"), R = await import("${REPO}/scripts/remnants.mjs");
        const D = await import("${REPO}/scripts/roll-draw.mjs"), I = await import("${REPO}/scripts/inventory.mjs");
        const actor = game.actors.get("${ids.aiko}"), tool = actor.items.get("${toolSetup.tool}");
        const m = game.messages.contents.filter(x => x.getFlag("${MOD}", "drawn")).at(-1) ?? null;
        const r = D.rollRecord(m?.getFlag("${MOD}", "rollId") ?? null);
        const repair = P.allProjects().find(p => P.repairs(p.id) === "${toolSetup.project}") ?? null;
        const traces = canvas.scene.tokens.contents.filter(t => R.remnantData(t)?.subject === "QA sabotage with a tool that breaks");
        const out = { record: r ? { actionKey: r.actionKey, total: r.total, withFear: r.withFear, isCritical: r.isCritical } : null,
            broken: tool ? I.isBroken(tool) : null, frozen: P.isFrozen("${toolSetup.project}"), repair: repair?.start ?? null,
            traces: traces.map(t => R.remnantData(t).visibility) };
        for (const t of traces) await t.delete();
        for (const id of [repair?.id, "${toolSetup.project}"].filter(Boolean)) await P.deleteProject(id).catch(() => {});
        if (tool) await tool.delete();
        for (const id of ${JSON.stringify(toolSetup.put)}) await actor.items.get(id)?.setFlag("${MOD}", "equipped", true);
        await game.settings.set("${MOD}", "despairFromRolls", ${JSON.stringify(toolSetup.despair)});
        const { gameSettings } = CONFIG.DH.SETTINGS;
        if (game.settings.get(CONFIG.DH.id, gameSettings.Resources.Fear) !== ${JSON.stringify(toolSetup.fear)}) await game.settings.set(CONFIG.DH.id, gameSettings.Resources.Fear, ${JSON.stringify(toolSetup.fear)});
        return out;`, { timeout: 30000 });
    check("p1: a Sabotage with Fear whose readied tool breaks on the roll leaves its trace at the band its repair was made at",
        Boolean(toolSetup.project && toolSetup.tool) && toolSetup.readied === toolSetup.tool && !toolSab.err && toolSab.success === true
            && toolRead.record?.actionKey === "sabotage" && toolRead.record?.total === 11 && toolRead.record?.withFear === true
            && toolRead.broken === true && toolRead.frozen === true && toolRead.repair === 3
            && toolRead.traces.length === 1 && toolRead.traces[0] === "subtle",
        JSON.stringify({ toolSetup, toolDice, toolSab, toolRead }), { flow: "projects" });

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

    // ---- 6f. a Search at a hidden stash: its step is the GM's --------------------------------
    /*
     * E08+E28 C12b, 04.10.2026; the owner's note of 28.09.2026 on E32+E07 C11e. A hidden stash's
     * step - one more disadvantage die here, the harness's roll having no advantage dice - was drawn
     * on the searcher's browser and was in no message. The GM draws it now with the dice, where the
     * room it sees the searcher in holds a hidden stash, and the searcher takes that step and draws
     * none (action-rolls.mjs `stashStepOf`). The GM hides a thing in a stash of Daichi's in Aiko's
     * room and scripts its randomiser to a 6 for the extra die; p1's is scripted to a 1, and p1
     * searches - a miss, so the stash's thing stays where it is. Read on the GM: the record's step,
     * the Search card's step (its meta, `stashStep`) and the record's flags. Until C12b the card's
     * die was p1's 1, and the GM drew nothing.
     */
    phase("a Search at a hidden stash", { flow: "search-observe" });
    const stashSet = await gm.eval(`
        const V = await import("${REPO}/scripts/vault.mjs");
        const INV = await import("${REPO}/scripts/inventory.mjs");
        const M = await import("${REPO}/scripts/movement.mjs");
        const aiko = game.actors.get("${ids.aiko}"), daichi = game.actors.get("${ids.daichi}");
        const room = M.roomOfActor(aiko);
        const region = room ? V.regionsByName().get(room) : null;
        if (!region) return { room, err: "no region" };
        const path = k => "flags.${MOD}." + k;
        const keys = [V.VAULT_FLAGS.stashes, V.VAULT_FLAGS.hinders, V.VAULT_FLAGS.favours];
        // Aiko's armed Calls are set aside for the Search, so it applies none, and put back after.
        globalThis.__c12bStash = { room, keys, before: keys.map(k => foundry.utils.deepClone(region.getFlag("${MOD}", k))), actions: game.drpg.actionsLeft(aiko),
            calls: foundry.utils.deepClone(aiko.getFlag("${MOD}", "pendingCall") ?? null) };
        if (globalThis.__c12bStash.calls) await aiko.unsetFlag("${MOD}", "pendingCall");
        await region.update({ [path(V.VAULT_FLAGS.stashes)]: [{ actorId: daichi.id, concealed: true }],
            [path(V.VAULT_FLAGS.hinders)]: [], [path(V.VAULT_FLAGS.favours)]: [] });
        const item = await INV.grantItem(daichi, { name: "Scenario 40 hidden kit", category: "usable", tier: 1, override: true, quiet: true });
        await item.update({ [path(INV.ITEM_FLAGS.location)]: INV.LOCATIONS.vault, [path(INV.ITEM_FLAGS.stashRoom)]: room });
        globalThis.__c12bStash.item = item.id;
        if (game.drpg.tokensLeft(room) <= 0) await game.drpg.resetTokens();
        if (game.drpg.actionsLeft(aiko) < 1) await game.drpg.setActions(aiko, 1);
        globalThis.__c12bU = CONFIG.Dice.randomUniform;
        CONFIG.Dice.randomUniform = () => 0.01;
        return { room, stashed: V.stashItemsIn(daichi, room).length };`, { timeout: 30000 });
    const stashSearch = await p1.eval(`
        const V = await import("${REPO}/scripts/vault.mjs");
        const actor = game.actors.get("${ids.aiko}"), daichi = game.actors.get("${ids.daichi}");
        for (let i = 0; i < 50 && !V.stashItemsIn(daichi, ${JSON.stringify(stashSet.room ?? "")}).length; i++) await new Promise(r => setTimeout(r, 100));
        const seen = V.stashItemsIn(daichi, ${JSON.stringify(stashSet.room ?? "")}).length;
        globalThis.__forceRoll = { hope: 2, fear: 1 };
        const real = CONFIG.Dice.randomUniform;
        CONFIG.Dice.randomUniform = () => 0.99;
        let err = null;
        try { await game.drpg.performAction(actor, "search", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { CONFIG.Dice.randomUniform = real; delete globalThis.__forceRoll; }
        await new Promise(r => setTimeout(r, 800));
        return { seen, err };`, { timeout: 90000 });
    await settle(600);
    const stashGm = await gm.eval(`
        CONFIG.Dice.randomUniform = globalThis.__c12bU;
        delete globalThis.__c12bU;
        const S = await import("${REPO}/scripts/gm-stores.mjs");
        const SE = await import("${REPO}/scripts/secret.mjs");
        const V = await import("${REPO}/scripts/vault.mjs");
        const row = Object.values(S.rollStore.entries()).filter(r => r?.actorId === "${ids.aiko}" && r.actionKey === "search").sort((a, b) => b.at - a.at)[0] ?? null;
        const card = [...game.messages.contents].reverse().find(m => SE.cardFlag(m, "stashStep")) ?? null;
        const step = card ? SE.cardFlag(card, "stashStep") : null;
        const { forcedDeletion } = await import("${REPO}/scripts/utils.mjs");
        const { room, keys, before, item, actions, calls } = globalThis.__c12bStash ?? {};
        delete globalThis.__c12bStash;
        const region = room ? V.regionsByName().get(room) : null;
        if (region) await region.update(Object.fromEntries(keys.map((k, i) => ["flags.${MOD}." + k, before[i] === undefined ? forcedDeletion() : before[i]])));
        await game.actors.get("${ids.daichi}")?.items.get(item ?? "")?.delete();
        const aiko = game.actors.get("${ids.aiko}");
        if (typeof actions === "number" && game.drpg.actionsLeft(aiko) !== actions) await game.drpg.setActions(aiko, actions);
        if (calls) await aiko.setFlag("${MOD}", "pendingCall", calls);
        return { used: row?.used?.stash ?? null, flags: (row?.flags ?? []).map(f => f.kind), card: step };`, { timeout: 30000 });
    check("p1: a Search at a hidden stash takes the extra die the GM drew (6), not one of its own (1), and the GM flags nothing",
        stashSet.stashed === 1 && stashSearch.seen === 1 && !stashSearch.err && stashGm.used?.kind === "rolled" && stashGm.used.rolled === 6
            && stashGm.card?.kind === "rolled" && stashGm.card.rolled === 6 && stashGm.card.change === stashGm.used.change && stashGm.flags.length === 0,
        JSON.stringify({ stashSet, stashSearch, gm: stashGm }), { flow: "search-observe" });

    // ---- 6f. a player's Plant, scored on the GMs' record of both its rolls ----------------------
    /*
     * BOTH OF A PALM'S ROLLS, END TO END (E08+E28 C15, 04.10.2026; audit S10-06). A Steal and a
     * Plant are scored on the GMs' record of the two rolls the packet names (gm-bridge.mjs
     * `palmRolls`): the hand's, thrown as "steal", and the unseen one, thrown as "palm"
     * (action-rolls.mjs `performPalm`). A Palm that named one and not the other, or whose unseen
     * roll was told as another action, would be refused at every table - which no console check
     * sees, as each sends a packet of its own. The GM stands Botan where Aiko stands and hands
     * Aiko a note; p1 plants it on Botan (the window answered with the Plant, Botan and the note),
     * the unseen roll on 12 and 11 and the hand's on 9 and 5. Read on the GM: whose the note is,
     * and what the newest of Aiko's drawn rolls of each action says it settled.
     */
    phase("a player's Palm", { flow: "give-take-stash" });
    const palmSet = await gm.eval(`
        const INV = await import("${REPO}/scripts/inventory.mjs");
        const M = await import("${REPO}/scripts/movement.mjs");
        const aiko = game.actors.get("${ids.aiko}"), botan = game.actors.get("${ids.botan}");
        const at = canvas.scene.tokens.find(t => t.actorId === aiko.id), bt = canvas.scene.tokens.find(t => t.actorId === botan.id);
        if (!at || !bt) return { err: "no token", rooms: [] };
        globalThis.__c15Palm = { was: { x: bt.x, y: bt.y }, actions: game.drpg.actionsLeft(aiko) };
        await bt.update({ x: at.x, y: at.y }, { teleport: true, movementAction: "displace", animate: false });
        const item = await INV.grantItem(aiko, { name: "Scenario 40 palmed note", category: "usable", tier: 1, override: true, quiet: true });
        if (game.drpg.actionsLeft(aiko) < 1) await game.drpg.setActions(aiko, 1);
        return { item: item?.id ?? null, rooms: [M.locateActor(aiko)?.room ?? null, M.locateActor(botan)?.room ?? null] };`, { timeout: 30000 });
    const palmed = await p1.eval(`
        const M = await import("${REPO}/scripts/movement.mjs");
        const actor = game.actors.get("${ids.aiko}");
        for (let i = 0; i < 50 && !(actor.items.has(${JSON.stringify(palmSet.item ?? "")}) && M.othersInRoom(actor).some(a => a.id === "${ids.botan}")); i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        globalThis.__dialogAnswers.push(() => ({ value: "plant",
            form: { querySelector: sel => ({ value: sel.includes("who") ? "${ids.botan}" : ${JSON.stringify(palmSet.item ?? "")} }) } }));
        const faces = [{ hope: 12, fear: 11 }, { hope: 9, fear: 5 }];
        const own = Object.getPrototypeOf(actor).rollTrait;
        actor.rollTrait = async function (key, options) { globalThis.__forceRoll = faces.shift(); return own.call(actor, key, options); };
        let r = null, err = null;
        try { r = await game.drpg.performAction(actor, "palm", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete actor.rollTrait; delete globalThis.__forceRoll; }
        await new Promise(res => setTimeout(res, 800));
        return { err, success: r?.success ?? null, seen: r?.seen ?? null, left: faces.length, dialogs: globalThis.__dialogLog.slice(-3).map(d => d.title) };`, { timeout: 90000 });
    await settle(1200);
    const palmGm = await gm.eval(`
        const S = await import("${REPO}/scripts/gm-stores.mjs");
        const newest = key => Object.values(S.rollStore.entries()).filter(r => r?.actorId === "${ids.aiko}" && r.actionKey === key).sort((a, b) => b.at - a.at)[0] ?? null;
        const botan = game.actors.get("${ids.botan}"), aiko = game.actors.get("${ids.aiko}");
        const notes = a => a.items.filter(i => i.name === "Scenario 40 palmed note");
        const out = { botan: notes(botan).length, aiko: notes(aiko).length, hand: newest("steal")?.resolved ?? null, unseen: newest("palm")?.resolved ?? null };
        for (const a of [botan, aiko]) for (const i of notes(a)) await i.delete();
        const { was, actions } = globalThis.__c15Palm ?? {};
        delete globalThis.__c15Palm;
        const bt = canvas.scene.tokens.find(t => t.actorId === botan.id);
        if (bt && was) await bt.update(was, { teleport: true, movementAction: "displace", animate: false });
        if (typeof actions === "number" && game.drpg.actionsLeft(aiko) !== actions) await game.drpg.setActions(aiko, actions);
        return out;`, { timeout: 30000 });
    check("p1: a Plant names both of its rolls, and the GM settles each on its own record and plants the note",
        !palmSet.err && Boolean(palmSet.rooms[0]) && palmSet.rooms[0] === palmSet.rooms[1] && !palmed.err && palmed.left === 0
            && palmGm.botan === 1 && palmGm.aiko === 0 && JSON.stringify(palmGm.hand) === '["steal"]' && JSON.stringify(palmGm.unseen) === '["palm"]',
        JSON.stringify({ palmSet, palmed, palmGm }), { flow: "give-take-stash" });

    // ---- 6g. a player's Observe and Analyze, each rerolled into a miss ---------------------------
    /*
     * THE RESULT IS THE RECORD'S, END TO END (E08+E28 C14, 04.10.2026; audit S10-06). An Observe's
     * and an Analyze's packets name their roll, and the GM scores its record of that roll
     * (bridge-guards.mjs `rollRefusal`). Fix r1-G2's mutants that took a resolve's `rollId` out
     * survived this scenario, because nothing here threw a player's Observe or Analyze and
     * rerolled it. p1 observes Aiko's room on 12 and 11 with a trace placed where she stands (a
     * sweep, which the GM scores with nobody asked), and rerolls into 2 and 1 (`REROLL_ARM`); then
     * analyses a fresh bullet of Aiko's on 12 and 11, and rerolls into 2 and 1. Both Rerolls land on
     * a Hope result, as the Work's does: measured 04.10 on A1's tree, into 1 and 2 (a Fear result)
     * the Hope paid read 4 on both, into 2 and 1 it reads 3. Read on the GM: the
     * bullet the Observe found and whether the Reroll took it back; the analysed bullet before and
     * after the Reroll (analysed; then wound back and locked for the chapter); each row's action
     * and fact, and the Hope each Reroll was paid.
     */
    phase("a player's Observe and its Reroll", { flow: "search-observe" });
    const truthBullets = `game.actors.get("${ids.aiko}").items.filter(i => i.getFlag("${MOD}", "isTruthBullet")).map(i => i.id)`;
    const obsSet = await gm.eval(`const R = await import("${REPO}/scripts/remnants.mjs");
        const M = await import("${REPO}/scripts/movement.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        const where = M.locateActor(aiko);
        await game.drpg.setActions(aiko, game.drpg.actionsMax(aiko));
        const trace = where?.tokenDoc ? await R.placeRemnant({ type: "prep", visibility: "obvious", scene: where.scene,
            x: where.tokenDoc.x, y: where.tokenDoc.y, note: "scenario 40 - the trace a rerolled Observe finds" }) : null;
        return { trace: trace?.id ?? null, room: where?.room ?? null, bullets: ${truthBullets} };`, { timeout: 30000 });
    const observedP1 = await p1.eval(`const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 12, fear: 11 };
        let err = null;
        try { await game.drpg.performAction(actor, "observe", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        await new Promise(r => setTimeout(r, 1500));
        return { err };`, { timeout: 120000 });
    await settle(800);
    const obsFound = await gm.eval(`return ${truthBullets}.filter(id => !${JSON.stringify(obsSet.bullets)}.includes(id));`);
    const obsArm = await gm.eval(REROLL_ARM({ hope: 12, fear: 11 }, { hope: 2, fear: 1 }), { timeout: 30000 });
    const obsAsk = await p1.eval(REROLL_ASK, { timeout: 90000 });
    await settle(800);
    const obsReroll = await gm.eval(REROLL_READ, { timeout: 30000 });
    const obsAfter = await gm.eval(`const R = await import("${REPO}/scripts/remnants.mjs");
        const B = await import("${REPO}/scripts/truth-bullets.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        const left = ${truthBullets}.filter(id => !${JSON.stringify(obsSet.bullets)}.includes(id));
        for (const id of left) { const i = aiko.items.get(id); const uuid = i.uuid; await i.delete(); await B.dropSecret?.(uuid); }
        const token = canvas.scene.tokens.get(${JSON.stringify(obsSet.trace ?? "")});
        if (token) { await R.dropRemnantSecret(token); await canvas.scene.deleteEmbeddedDocuments("Token", [token.id]); }
        return { left };`, { timeout: 30000 });
    check("p1: an Observe scored on the GMs' record of its roll finds the trace, and its Reroll into a miss, made on the GM, takes the bullet back",
        Boolean(obsSet.trace) && !observedP1.err && obsFound.length === 1 && obsArm.row?.actionKey === "observe" && obsArm.row?.by === IDS.p1
            && Boolean(obsArm.row?.facts?.observeKey) && obsAsk.made === true && obsReroll.paid === 3 && obsAfter.left.length === 0 && !obsReroll.journal,
        JSON.stringify({ obsAfter, paid: obsReroll.paid, made: obsAsk.made, journal: obsReroll.journal, obsFound, obsSet, observedP1, arm: obsArm.row }),
        { flow: "reroll" });

    phase("a player's Analyze and its Reroll", { flow: "analyze" });
    const anaSet = await gm.eval(`const B = await import("${REPO}/scripts/truth-bullets.mjs");
        const aiko = game.actors.get("${ids.aiko}");
        await game.drpg.setActions(aiko, game.drpg.actionsMax(aiko));
        const b = await B.createTruthBullet(aiko, { name: "Scenario 40 analysed bullet", realType: "neutral", visibility: "obvious" });
        return { id: b?.id ?? null, chapter: (await import("${REPO}/scripts/clock.mjs")).getClock().chapter };`, { timeout: 30000 });
    await settle(600);
    const anaState = `const i = game.actors.get("${ids.aiko}").items.get(${JSON.stringify(anaSet.id ?? "")});
        return { analyzed: i?.getFlag("${MOD}", "analyzed") ?? false, locked: i?.getFlag("${MOD}", "lockedChapter") ?? null };`;
    const analysedP1 = await p1.eval(`const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 12, fear: 11 };
        let err = null;
        try { await game.drpg.performAction(actor, "analyze", { bulletId: ${JSON.stringify(anaSet.id ?? "")} }); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        await new Promise(r => setTimeout(r, 1500));
        return { err };`, { timeout: 120000 });
    await settle(800);
    const anaBefore = await gm.eval(anaState);
    const anaArm = await gm.eval(REROLL_ARM({ hope: 12, fear: 11 }, { hope: 2, fear: 1 }), { timeout: 30000 });
    const anaAsk = await p1.eval(REROLL_ASK, { timeout: 90000 });
    await settle(800);
    const anaReroll = await gm.eval(REROLL_READ, { timeout: 30000 });
    const anaAfter = await gm.eval(anaState);
    await gm.eval(`const B = await import("${REPO}/scripts/truth-bullets.mjs");
        const i = game.actors.get("${ids.aiko}").items.get(${JSON.stringify(anaSet.id ?? "")});
        if (i) { const uuid = i.uuid; await i.delete(); await B.dropSecret?.(uuid); }
        return true;`, { timeout: 30000 });
    check("p1: an Analyze scored on the GMs' record of its roll identifies the bullet, and its Reroll into a miss, made on the GM, winds it back and locks it for the chapter",
        Boolean(anaSet.id) && !analysedP1.err && anaBefore.analyzed === true && anaArm.row?.actionKey === "analyze" && anaArm.row?.by === IDS.p1
            && anaArm.row?.facts?.bulletId === anaSet.id && anaAsk.made === true && anaReroll.paid === 3
            && anaAfter.analyzed === false && anaAfter.locked === anaSet.chapter && !anaReroll.journal,
        JSON.stringify({ anaAfter, paid: anaReroll.paid, made: anaAsk.made, journal: anaReroll.journal, anaBefore, anaSet, analysedP1, arm: anaArm.row }),
        { flow: "analyze" });

    /*
     * A PLAYER'S HONEST ROADS TO A STASH, AND A DYNAMIC ACTION THE GM RULES FROM ITS CARD (E08+E28 fix
     * r2-H6, 05.10.2026; review m2). Each of these packets names the roll the GM drew, and the GM reads
     * its result off its record of it - but no scenario sent one: C14's and C15's mutants that drop the
     * roll's id from p1's Analyze at a hidden stash and from the theft a Search makes of a stash, and the
     * one that keeps no ruling on a Dynamic action's card, each survived every run. A regression there
     * refuses every honest packet of its kind at a table with the suite green. Daichi hides a kit in a
     * hidden stash in Aiko's room; p1 locates it with an Analyze, then opens it with a Search, each on
     * faces of 12 and 11; then p1 asks a Dynamic action, which the GM rules Trivial from its card's
     * button, and throws it on 9 and 5. Read on the GM: whether Aiko found the stash, whether the kit
     * is hers, the ruling the card keeps (gm-bridge.mjs `dynamicRulingOf`), and what each newest record
     * of Aiko's settled.
     */
    phase("a player's stash, found and opened, and a Dynamic action ruled from its card", { flow: "give-take-stash" });
    const honestSet = await gm.eval(`
        const V = await import("${REPO}/scripts/vault.mjs");
        const INV = await import("${REPO}/scripts/inventory.mjs");
        const M = await import("${REPO}/scripts/movement.mjs");
        const aiko = game.actors.get("${ids.aiko}"), daichi = game.actors.get("${ids.daichi}");
        const room = M.roomOfActor(aiko);
        const region = room ? V.regionsByName().get(room) : null;
        if (!region) return { room, err: "no region" };
        const path = k => "flags.${MOD}." + k;
        const keys = [V.VAULT_FLAGS.stashes, V.VAULT_FLAGS.hinders, V.VAULT_FLAGS.favours];
        globalThis.__h6Stash = { room, keys, before: keys.map(k => foundry.utils.deepClone(region.getFlag("${MOD}", k))), actions: game.drpg.actionsLeft(aiko),
            found: foundry.utils.deepClone(aiko.getFlag("${MOD}", V.VAULT_FLAGS.found) ?? null),
            calls: foundry.utils.deepClone(aiko.getFlag("${MOD}", "pendingCall") ?? null), cards: game.messages.contents.length };
        if (globalThis.__h6Stash.calls) await aiko.unsetFlag("${MOD}", "pendingCall");
        await region.update({ [path(V.VAULT_FLAGS.stashes)]: [{ actorId: daichi.id, concealed: true }],
            [path(V.VAULT_FLAGS.hinders)]: [], [path(V.VAULT_FLAGS.favours)]: [] });
        const item = await INV.grantItem(daichi, { name: "Scenario 40 H6 stashed kit", category: "usable", tier: 1, override: true, quiet: true });
        await item.update({ [path(INV.ITEM_FLAGS.location)]: INV.LOCATIONS.vault, [path(INV.ITEM_FLAGS.stashRoom)]: room });
        globalThis.__h6Stash.item = item.id;
        if (game.drpg.tokensLeft(room) <= 0) await game.drpg.resetTokens();
        await game.drpg.setActions(aiko, game.drpg.actionsMax(aiko));
        return { room, stashed: V.stashItemsIn(daichi, room).length };`, { timeout: 30000 });
    await settle(600);
    const NEWEST = action => `Object.values(S.rollStore.entries()).filter(r => r?.actorId === "${ids.aiko}" && r.actionKey === "${action}").sort((a, b) => b.at - a.at)[0] ?? null`;
    const honestAnalyze = await p1.eval(`const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 12, fear: 11 };
        globalThis.__dialogAnswers.push(() => ({ value: "stash", form: document.createElement("form") }));
        let err = null;
        try { await game.drpg.performAction(actor, "analyze", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        await new Promise(r => setTimeout(r, 1500));
        return { err };`, { timeout: 120000 });
    await settle(800);
    const honestFound = await gm.eval(`const V = await import("${REPO}/scripts/vault.mjs"); const S = await import("${REPO}/scripts/gm-stores.mjs");
        const row = ${NEWEST("analyze")};
        return { found: V.hasFoundStash(game.actors.get("${ids.aiko}"), ${JSON.stringify(honestSet.room ?? "")}, "${ids.daichi}"), resolved: row?.resolved ?? null };`);
    const honestSearch = await p1.eval(`const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 12, fear: 11 };
        let err = null;
        try { await game.drpg.performAction(actor, "search", {}); } catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        await new Promise(r => setTimeout(r, 1500));
        return { err };`, { timeout: 120000 });
    await settle(800);
    const honestTaken = await gm.eval(`const S = await import("${REPO}/scripts/gm-stores.mjs");
        const row = ${NEWEST("search")};
        const aiko = game.actors.get("${ids.aiko}"), daichi = game.actors.get("${ids.daichi}");
        const name = "Scenario 40 H6 stashed kit";
        return { aiko: aiko.items.filter(i => i.name === name).length, daichi: daichi.items.filter(i => i.name === name).length, resolved: row?.resolved ?? null };`);
    check("p1: an Analyze at a hidden stash and a Search that opens it each name the roll the GM drew, which settles them: Aiko finds the stash and takes the kit",
        !honestSet.err && honestSet.stashed === 1 && !honestAnalyze.err && !honestSearch.err
            && honestFound.found === true && JSON.stringify(honestFound.resolved) === JSON.stringify(["analyze"])
            && honestTaken.aiko === 1 && honestTaken.daichi === 0 && (honestTaken.resolved ?? []).includes("search"),
        JSON.stringify({ honestSet, honestAnalyze, honestFound, honestSearch, honestTaken }), { flow: "give-take-stash" });

    // The Dynamic action: p1 asks, and waits for the GM's ruling while the GM presses the card's button. The Analyze
    // and the Search spent Aiko's actions (measured: "0 actions left and needs 1"), so they are refilled first.
    await gm.eval(`const aiko = game.actors.get("${ids.aiko}"); await game.drpg.setActions(aiko, game.drpg.actionsMax(aiko)); return true;`, { timeout: 30000 });
    await settle(400);
    await p1.eval(`const actor = game.actors.get("${ids.aiko}");
        globalThis.__forceRoll = { hope: 9, fear: 5 };
        globalThis.__dialogAnswers.push("Scenario 40 H6: picks the archive's lock");
        globalThis.__h6Dynamic = game.drpg.performAction(actor, "dynamic", {}).then(r => ({ r }), e => ({ err: String(e?.stack ?? e).slice(0, 300) }));
        return true;`, { timeout: 30000 });
    const ruled = await gm.eval(`const { contentOf, cardFlag } = await import("${REPO}/scripts/secret.mjs");
        const { wireCallActions } = await import("${REPO}/scripts/messenger-app.mjs");
        const until = async (test, ms = 8000) => { const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return test(); };
        const find = () => game.messages.contents.slice(${Number(honestSet.cards) || 0}).find(m => String(contentOf(m) ?? "").includes('data-drpg-call="setDifficulty"')) ?? null;
        await until(() => find());
        const card = find();
        if (!card) return { card: false };
        const body = document.createElement("div");
        body.innerHTML = contentOf(card);
        wireCallActions(body, card);
        globalThis.__dialogAnswers.push(() => ({ tier: 0, trait: "instinct" }));
        body.querySelector('[data-drpg-call="setDifficulty"]')?.click();
        await until(() => cardFlag(game.messages.get(card.id), "ruling"));
        return { card: true, ruling: cardFlag(game.messages.get(card.id), "ruling") ?? null };`, { timeout: 60000 });
    const thrownDynamic = await p1.eval(`const out = await Promise.race([globalThis.__h6Dynamic, new Promise(r => setTimeout(() => r({ err: "still waiting" }), 30000))]);
        delete globalThis.__h6Dynamic; delete globalThis.__forceRoll;
        await new Promise(r => setTimeout(r, 1500));
        return { err: out.err ?? null, success: out.r?.success ?? null, leftTrace: out.r?.leftTrace ?? null };`, { timeout: 60000 });
    await settle(800);
    const dynamicGm = await gm.eval(`const S = await import("${REPO}/scripts/gm-stores.mjs");
        const { dynamicRulingOf } = await import("${REPO}/scripts/gm-bridge.mjs");
        const row = ${NEWEST("dynamic")};
        return { ruling: row ? dynamicRulingOf(row) : null, resolved: row?.resolved ?? null };`);
    await gm.eval(`const V = await import("${REPO}/scripts/vault.mjs");
        const { forcedDeletion } = await import("${REPO}/scripts/utils.mjs");
        const { room, keys, before, found, actions, calls } = globalThis.__h6Stash ?? {};
        delete globalThis.__h6Stash;
        const region = room ? V.regionsByName().get(room) : null;
        if (region) await region.update(Object.fromEntries(keys.map((k, i) => ["flags.${MOD}." + k, before[i] === undefined ? forcedDeletion() : before[i]])));
        const aiko = game.actors.get("${ids.aiko}");
        for (const a of [aiko, game.actors.get("${ids.daichi}")]) for (const i of a.items.filter(x => x.name === "Scenario 40 H6 stashed kit")) await i.delete();
        if (found === null) await aiko.unsetFlag("${MOD}", V.VAULT_FLAGS.found);
        else await aiko.setFlag("${MOD}", V.VAULT_FLAGS.found, found);
        if (typeof actions === "number") await game.drpg.setActions(aiko, actions);
        if (calls) await aiko.setFlag("${MOD}", "pendingCall", calls);
        return true;`, { timeout: 30000 });
    check("p1: a Dynamic action the GM rules Trivial from its card's button keeps the ruling on the card, and the roll's trace is left at the band the GM read off it",
        ruled.card === true && ruled.ruling?.type === "dynamic" && ruled.ruling.actorId === ids.aiko && ruled.ruling.tier === 0
            && !thrownDynamic.err && thrownDynamic.success === true
            && dynamicGm.ruling?.tier === 0 && JSON.stringify(dynamicGm.resolved) === JSON.stringify(["trace"]),
        JSON.stringify({ ruled, thrownDynamic, dynamicGm }), { flow: "action-roll" });

    /*
     * A PLAYER'S REST AND AN ITEM USED, EACH WRITE NAMING ITS REASON (E29 C1, 05.10.2026; audit
     * S17-12). p1 takes a Short Rest (Meal) and uses a Tier 1 healing kit, its windows answered on
     * p1's browser. Since C4 the Rest is taken where the GMs' audit allows one: the GM marks the room
     * Aiko stands in for a Short Rest first where it was not one, and unmarks it after (the day's check below
     * reads that neither write was put back or listed). The GM records
     * every write on Aiko and her items that p1's user made, with the `drpgWrite` its options
     * carried here: the stamp crossing to the GM is what every later judge of the stage reads (the
     * harness passes options through; a real Foundry's forwarding is LIVE-E29-01). Expected: the
     * action's spend, then ONE Rest write with the Sanity and the `restsTaken` stamp, then the
     * kit's Health and its break, both naming the kit. The GM's fixture writes in this file are
     * plain updates: the courtesy guard stands aside for a GM and nothing judges a GM's write, so
     * the file runs on the code before C1 as well - which is how this check's red is read.
     */
    phase("a player's Rest and an item used, each write naming its reason");
    const restSet = await gm.eval(`const INV = await import("${REPO}/scripts/inventory.mjs");
        const M = await import("${REPO}/scripts/movement.mjs"), REST = await import("${REPO}/scripts/rest.mjs");
        const aiko = game.actors.get("${ids.aiko}"), r = aiko.system.resources;
        const room = M.roomOfActor(aiko), roomWas = room ? REST.restRooms("short").includes(room) : null;
        if (room && !roomWas) await REST.setRestRoom(room, { short: true });
        const was = { hp: r.hitPoints.value, stress: r.stress.value, actions: r.actions.value,
            rests: aiko.getFlag("${MOD}", "restsTaken") ?? null, grants: aiko.getFlag("${MOD}", "freeActionGrants") ?? null };
        await aiko.update({ "system.resources.hitPoints.value": 2, "system.resources.stress.value": 2,
            "system.resources.actions.value": Math.max(1, was.actions), "flags.${MOD}.freeActionGrants": 0 });
        if (was.rests) await aiko.unsetFlag("${MOD}", "restsTaken");
        const kit = await INV.grantItem(aiko, { name: "Scenario 40 C1 kit", category: "usable", tier: 1, goal: "healing", override: true, quiet: true });
        const w = globalThis.__c1Writes = { actor: [], items: [], hooks: [] };
        const row = (c, o, u) => ({ user: u ?? null, stamp: o?.drpgWrite ?? null, paths: Object.keys(foundry.utils.flattenObject(c)).filter(k => k !== "_id" && !k.startsWith("_stats")).sort() });
        w.hooks.push(["updateActor", Hooks.on("updateActor", (d, c, o, u) => { if (d.id === aiko.id) w.actor.push(row(c, o, u)); })]);
        w.hooks.push(["updateItem", Hooks.on("updateItem", (d, c, o, u) => { if (d.parent?.id === aiko.id) w.items.push({ id: d.id, ...row(c, o, u) }); })]);
        return { was, kit: kit?.id ?? null, room, roomWas };`);
    await settle(400);
    const restRun = await p1.eval(`const R = await import("${REPO}/scripts/rest.mjs");
        const U = await import("${REPO}/scripts/use-items.mjs");
        const D = foundry.applications.api.DialogV2;
        const own = { wait: Object.getOwnPropertyDescriptor(D, "wait"), confirm: Object.getOwnPropertyDescriptor(D, "confirm") };
        D.wait = async () => ["meal"]; D.confirm = async () => true;
        const aiko = game.actors.get("${ids.aiko}");
        try {
            const rest = await R.takeRest(aiko, "short", { quiet: true });
            const used = await U.useItem(aiko, aiko.items.get("${restSet.kit}"));
            return { rested: Boolean(rest), used, me: game.user.id };
        } finally {
            for (const k of ["wait", "confirm"]) { if (own[k]) Object.defineProperty(D, k, own[k]); else delete D[k]; }
        }`, { timeout: 30000 });
    await settle(800);
    const restSeen = await gm.eval(`const w = globalThis.__c1Writes; delete globalThis.__c1Writes;
        for (const [name, id] of w.hooks) Hooks.off(name, id);
        const aiko = game.actors.get("${ids.aiko}"), was = ${JSON.stringify(restSet.was)};
        const out = { actor: w.actor.filter(x => x.user === "${restRun.me}"), items: w.items.filter(x => x.user === "${restRun.me}") };
        await aiko.update({ "system.resources.hitPoints.value": was.hp, "system.resources.stress.value": was.stress,
            "system.resources.actions.value": was.actions });
        await aiko.unsetFlag("${MOD}", "restsTaken");
        if (was.rests) await aiko.setFlag("${MOD}", "restsTaken", was.rests);
        if (was.grants === null) await aiko.unsetFlag("${MOD}", "freeActionGrants");
        else await aiko.setFlag("${MOD}", "freeActionGrants", was.grants);
        await aiko.items.get("${restSet.kit}")?.delete();
        if (${JSON.stringify(restSet.room)} && !${restSet.roomWas}) await (await import("${REPO}/scripts/rest.mjs")).setRestRoom(${JSON.stringify(restSet.room)}, { short: false });
        return out;`);
    {
        const STRESS = "system.resources.stress.value", STAMP = `flags.${MOD}.restsTaken.short`;
        const reasons = restSeen.actor.map(x => x.stamp?.reason ?? null);
        const rest = restSeen.actor.filter(x => x.stamp?.reason === "rest");
        const healed = restSeen.actor.find(x => x.stamp?.reason === "itemUse");
        const broke = restSeen.items.find(x => x.id === restSet.kit);
        check("p1: a Rest is the action's spend and ONE write of its benefit and its stamp, and an item used names the item on its Health and its break - each stamp seen on the GM",
            restSet.kit !== null && restSet.room !== null && restRun.rested && restRun.used?.hitPoints === 1
                && JSON.stringify(reasons) === JSON.stringify(["spend", "rest", "itemUse"])
                && rest.length === 1 && rest[0].paths.includes(STRESS) && rest[0].paths.includes(STAMP) && rest[0].stamp.ref === null
                && healed?.stamp.ref === restSet.kit && broke?.stamp?.reason === "itemUse" && broke.stamp.ref === restSet.kit
                && broke.paths.includes(`flags.${MOD}.broken.at`),
            JSON.stringify({ restSet, restRun, restSeen }).slice(0, 1500));
    }

    /*
     * THE DAY, AS THE GMS' AUDIT SAW IT (E29 C3, 05.10.2026; the plan's section 6, "store traffic"). Every write
     * above - the GM's and the players' own, a Search, a Rest, Calls, projects, a stash - went past the judge on
     * the primary. None may be put back: a module road that writes what a roll is built from on a player's browser
     * would be a false alarm at every table. What is listed is a Call a player's browser armed (`pendingCall`,
     * until C8). And the marks' traffic: 76 patches of `sheetMarks` in this day, measured on the harness on
     * 05.10.2026 (e29run/c3a1, one run; one listed row, a Call armed) - the plan's section 6 asked for the
     * number. The bound allows a quarter more: a write judged after the next one has landed reads both in
     * the document, so two writes can move a mark once or twice.
     */
    phase("the day's writes, as the GMs' audit saw them", { flow: "sheet-audit" });
    const auditDay = await gm.eval(`const S = await import("${REPO}/scripts/gm-stores.mjs");
        await (await import("${REPO}/scripts/sheet-audit.mjs").catch(() => ({}))).sheetAuditIdle?.();
        const rows = Object.values(S.sheetWriteStore?.entries?.() ?? {}).filter(r => r?.at >= globalThis.__auditFrom);
        return { store: Boolean(S.sheetMarkStore), patches: globalThis.__markPatches,
            putBack: rows.filter(r => r.verdict === "putBack").map(r => Object.keys(r.change ?? {})),
            listed: rows.filter(r => r.verdict === "listed").flatMap(r => Object.keys(r.change ?? {})) };`);
    const MARK_PATCHES_MEASURED = 76;
    check("a Daily Life day: the GMs' audit puts back nothing a module road wrote, lists only Calls armed, and patches its marks within a quarter of the measured count",
        auditDay.store && auditDay.putBack.length === 0 && auditDay.listed.every(path => path === `flags.${MOD}.pendingCall`)
            && auditDay.patches > 0 && auditDay.patches <= Math.ceil(MARK_PATCHES_MEASURED * 1.25),
        JSON.stringify(auditDay).slice(0, 1500), { flow: "sheet-audit" });

    // ---- 7. uncaught errors ------------------------------------------------------------------
    phase("errors");
    for (const c of [gm, ...players]) {
        const errs = await c.eval(`return globalThis.__errors.slice(0, 5);`);
        check(`${c.who}: no uncaught errors`, (errs ?? []).length === 0, JSON.stringify(errs).slice(0, 400));
    }
}
