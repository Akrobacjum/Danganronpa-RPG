/**
 * The investigation as it is today (E09 C0, 08.10.2026; the plan's 2.1 and its doneWhen).
 *
 * Nothing before this one investigated: of the scenarios at 7bbcdb8 none places a trace,
 * Observes it, Analyzes the copy and Tampers with it on the clients that do each part. This
 * one does, on the seed's GM and players and a second GM, `gm2`, connected as 61 connects
 * it (a copy of the seed GM's browser, taken once its stores have hydrated), so every
 * answer key the GMs write is held by two of them. p3 is connected and does nothing.
 *
 * Phases are letters, so a later E09 commit adds one without renumbering:
 *   A  three traces in Dorm A on the GM - a Prep tied to the crime, a Faint and a Key: both
 *      GMs hold their rows, and no player's browser holds a word of them.
 *   O  p1 focuses its gaze (Observe, "specific"): (E09 C12) the question is a card in p1's
 *      thread, and no picker opens on the primary GM; gm2 presses Pick a trace on its own copy
 *      of the card, its picker lists the room's three traces and is answered with the tied one,
 *      and the card closes; the primary's description dialog is answered with three markers.
 *      p1 holds one copy of that trace, without the reading, p1's thread holds no GM body
 *      (S05-34, asserted closed), and p1's copy of the card holds its request and no trace. On
 *      the code before C12 (08.10.2026) the primary's picker opened and was answered, gm2 saw
 *      no card, and p1 held none (O1 and O5 red).
 *   N  p1 Analyzes the copy: read on p1, it shows its type and the reading the GM wrote.
 *   T  p2 finds the same trace (a general Observe) and reshapes it (Tamper, "transform");
 *      the GM's card counts the two copies already held, gm2 approves it from its own copy of
 *      the card, the GMs' ledger takes the story, and p1's and p2's copies keep the name and
 *      words they were found with (E09 C9: a reshape leaves the copies already held). On the
 *      code before C9 (08.10.2026) both copies read the reshaped name and words, and the card
 *      counted nothing. (E09 C10) gm2's approval is ruled on the primary GM and kept as gm2's,
 *      and the GM's Approve on its own copy of the card, open all along, is refused and told
 *      and tells p2 nothing.
 *   V  (E09 C2) the GM's verdicts on the tied trace reach the copies: a Faint reaches both
 *      copies' answer keys on both GMs and the item of p1's analysed copy, not p2's; and p2's
 *      console gives its unanalysed copy `analyzed`, the GM rewrites the trace's reading as
 *      it hears that, and the primary's put-back is held until the edit has run - p2 reads no
 *      reading, both GMs' copies hold none, the answer key and p1's copy hold it. On the code
 *      before C2 (08.10.2026) both failed: the Faint reached no key, and p2's copy read the
 *      new reading, put back to unanalysed, with both GMs' copies holding it. (E09 fix r2-G1) That
 *      rewrite is a GM's later write to the trace T reshaped: p1's and p2's copies keep the name and
 *      words they were found with (V3; on the code before the fix both read the reshaped ones).
 *   D  (E09 C3) the Investigation Dashboard stands open on the GM with a name typed into the
 *      Faint trace's row when gm2 approves a reshape of that trace (since E09 C10 on a proposal
 *      gm2 writes on the attempt's row first): the GM's window redraws
 *      (the words show the reshape, the typed name stays and is marked with the reshaped
 *      one), and the GM's Save refuses the name and says so once - both GMs keep the reshape.
 *      (E09 fix r2-G2) gm2 rules from the console (`game.drpg.declineReshape`, then
 *      `approveReshape` at the same moment as the GM's own): each is ruled once, on the primary
 *      GM, and the second Approve is told it was ruled. On the code before the fix (08.10.2026)
 *      gm2's Decline was ruled on gm2, both Approves answered true and p2 was told twice.
 *   K  (E09 C7) a chapter-2 trial after a chapter-1 plan: a case of three closed in chapter 2
 *      (its row), two of its Keys found by the living, and the trial entered through the clock
 *      twice - without a Save of the planner for chapter 2, then after one - moves both GMs'
 *      Monokuma pools by 3 each time. Before C7 the first charged nothing (the plan's rows were
 *      another chapter's: too late) and the second 6 (a bar of four).
 *   P  (E09 fix r1-G3) gm2 opens a chapter-3 trial on K's case - three Keys, two found by the
 *      living - with a third Key copy beside the finds that the GMs do not hold (tier 2's made
 *      Key: a copy of p1's student's find under a new id, made where the audit has not judged
 *      it): the fee is charged on the primary, by the copies the GMs hold, and moves both GMs'
 *      Monokuma pools by 3. On the code before the fix (08.10.2026) it was charged on gm2, whose
 *      count reads the documents: the made copy, with no answer key, held the charge (`keyFeeOf`
 *      held 1 on gm2 and 0 on the primary), and the pools moved by 0 in each of three runs.
 *   E  (E09 C1) the chapter ends: the GM gives p1's student an unanalysed Faint, a Neutral and
 *      a Final handed over as Neutral; the Investigation Dashboard's "Sweep Truth Bullets" confirm (answered no) and
 *      the End of chapter panel (its sweep alone ticked) each give the number the sweep then
 *      takes, counted over every student's bullets on the GM, and the Faint and the Final stay.
 *      (E09 C8) Then a Key with a reading joins them, and the panel is answered with its reveal
 *      alone, then with its reveal and its sweep: read on p1, the Key shows its reading and the
 *      Faint and the Final stay unanalysed and analysable in the next chapter, and each time the
 *      panel's reveal line gives the number the reveal writes. On the code before C8 (08.10.2026)
 *      both failed: the panel said 3 and the reveal wrote 3, p1's Key analysed without its
 *      reading, and the Faint and the Final analysed and not analysable. (E09 fix r1-G5, the owner's
 *      Q1 (c)) The reveal shows the Final its kind and not its reading: on C8's code, which spared
 *      a Final like a Faint, p1's Final still showed Neutral (08.10.2026).
 *   L  (E09 C14) the GM misses an Analyze of a Final that shows its kind on p1's student: p1's
 *      card of the miss names it and does not call it Neutral. On the code before C14
 *      (08.10.2026) it said the Final "stays with you, still Neutral". (E09 C17) The handbooks, in
 *      English and in Polish, name the Tamper menu's three choices, Observe's five ways of looking
 *      and Stage 6's actions by the labels the module draws. A guard, not a red first: the
 *      handbooks before C17 already used every one of those 22 labels (read 08.10.2026).
 * Each phase counts its own checks, and a closing check per phase fails one that measured
 * nothing (CLAUDE.md: a test can pass by measuring nothing).
 *
 * The dialogs are answered through `__dialogAnswers` (lib/shim.mjs DialogV2), and the GM
 * draws real windows meanwhile (`__dialogWindows`): a dialog this scenario did not answer
 * stays open instead of pressing its default, so a pick nobody made cannot pass as the
 * right one. Every roll is scripted (`__forceRoll`), never a critical.
 *
 * `layers` is ["ci"] alone, not the plan's ["ci", "local-gate"]: the sandbox adapter
 * (audit/live/sandbox-cluster.mjs) gives a run() the four clients, check, note, phase,
 * settle and repoUrl, and this one needs `gm2` (connect, storageOf, IDS) and three
 * harness-only page hooks the adapter does not provide (tools/registry.mjs, run with
 * the two layers on a copy, 08.10.2026: "needs gm2, connect, disconnect, storageOf, IDS,
 * __dialogAnswers, __dialogWindows, __forceRoll, ...").
 *
 * No `timeoutMs`: measured 08.10.2026 alone, its 17 checks took 7.6 s (13 s with the
 * cluster's start), far inside run-all's shared five minutes and the plan's 150 s budget.
 * With E09 C2's phase V, 23 checks in 6.6 s (the cluster's own count, 08.10.2026); with E09
 * C3's phase D, 28 in 8.9 s (the same count, one run, 08.10.2026); with E09 C7's phase K, 31 in
 * 11.8 s (17.6 s with the cluster's start, one run, 08.10.2026); with E09 C8's reveal half of
 * phase E, 33 in 13.1 s (20 s with the cluster's start, one run, 08.10.2026); with E09 fix r1-G3's
 * phase P, 36 in 17.6 s (24.7 s with the cluster's start, one run, 08.10.2026); with E09 C9's
 * phase T, 38 in 21.0 s (the cluster's own count, one run, 08.10.2026), two 3-second waits of
 * it for a renaming of p1's and p2's copies that no longer comes; with E09 C10's T8 and T9,
 * 40 in 22.7 s (the same count, one run, 08.10.2026); with E09 C12's O5, 41 in 22.4 s (28.3 s with
 * the cluster's start, one run, 08.10.2026), and 42.8 s on the code before C12, where gm2 waits out
 * 20 s for a card that never comes; with E09 C14's phase L, 43 in 22.7 s (28.3 s with the cluster's
 * start, one run, 08.10.2026); with E09 C17's L2, 44 in 29.3 s with the cluster's start (one run,
 * 08.10.2026); with E09 fix r2-G1's V3, 45 in 30.5 s (the fast set's `[cluster]` line, beside two
 * other lanes, one run, 08.10.2026); with E09 fix r2-G2's D2 and D3, 47 in 30.3 s (the same line, beside two
 * other lanes, one run, 08.10.2026).
 */
export const layers = ["ci"];
export const accounts = [
    { who: "gm2", id: "USERGM2000000000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const J = value => JSON.stringify(value);
// Markers, so every read below is a search for words only this scenario wrote.
const MARK = {
    tiedSubject: "S62 tied subject", tiedNote: "S62 tied note", faintNote: "S62 faint note", keyNote: "S62 key note",
    name: "S62 found name", playerText: "S62 seen words", analyzed: "S62 reading",
    request: "S62 the cup on the desk", reshapedName: "S62 reshaped name", reshapedText: "S62 reshaped words",
    rewritten: "S62 rewritten reading", typed: "S62 typed name", dName: "S62 D reshaped name", dText: "S62 D reshaped words",
    eKeyReading: "S62 E key reading", eFinalReading: "S62 E final reading"
};
const NOT_CRITICAL = { hope: 11, fear: 9 };

export async function run({ gm, gm2, p1, p2, check, phase, settle, connect, disconnect, storageOf, IDS, repoUrl }) {
    const counts = {};
    let current = null;
    const begin = (letter, name, flow) => { phase(`${letter}: ${name}`, { flow }); current = letter; counts[letter] = 0; };
    const verdict = (name, ok, details, opts) => { counts[current]++; check(`${current}${counts[current]}: ${name}`, ok, details, opts); };
    const until = `const until = async (test, ms) => { const end = Date.now() + ms; let v; while (!(v = await test()) && Date.now() < end) await new Promise(r => setTimeout(r, 150)); return v; };`;
    const TB = `const TB = await import("${repoUrl}/scripts/truth-bullets.mjs");`;

    /* As 61's A2: the copy is taken once the seed GM's stores have hydrated and written what they write then. */
    await gm.eval(`const E = await import("${repoUrl}/scripts/gm-store.mjs"); const end = Date.now() + 10000;
        while (!E.gmStoresHydrated() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
        await E.gmStoresIdle(); return E.gmStoresHydrated();`);
    await connect("gm2", { storage: await storageOf("gm") });
    await settle(400);

    /* ------------------------------ A. the traces ------------------------------ */

    begin("A", "three traces in Dorm A, held by both GMs and by no player", "trace-remnant");
    const placed = await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const scene = game.scenes.get("${IDS.scene}"), out = {};
        for (const [name, data] of Object.entries({
            tied: { type: "prep", tiedToCrime: true, subject: ${J(MARK.tiedSubject)}, note: ${J(MARK.tiedNote)}, x: 400, y: 500 },
            faint: { type: "prep", faint: true, note: ${J(MARK.faintNote)}, x: 500, y: 500 },
            key: { type: "key", note: ${J(MARK.keyNote)}, x: 600, y: 500 }
        })) out[name] = (await R.placeRemnant({ visibility: "evident", scene, sourceName: "S62", ...data }))?.id ?? null;
        return { ids: out, chapter: getClock().chapter };`, { timeout: 60000 });
    const ids = placed.ids;
    verdict("the GM places a Prep tied to the crime, a Faint and a Key, in chapter 1",
        Boolean(ids.tied && ids.faint && ids.key) && placed.chapter === 1, J(placed));
    await settle(800);
    const rowsOn = client => client.eval(`const { remnantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        return ${J(Object.values(ids))}.map(id => { const row = remnantStore.get("${IDS.scene}." + id);
            return row ? [row.type, Boolean(row.tiedToCrime), Boolean(row.faint), row.note ?? ""] : null; });`);
    const rows = { gm: await rowsOn(gm), gm2: await rowsOn(gm2) };
    const wanted = J([["prep", true, false, MARK.tiedNote], ["prep", false, true, MARK.faintNote], ["key", false, false, MARK.keyNote]]);
    verdict("both GMs hold the three rows of the answer key, the second through the store's sync",
        J(rows.gm) === wanted && J(rows.gm2) === wanted, J(rows));
    const leak = client => client.eval(`const { remnantStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const scene = game.scenes.get("${IDS.scene}");
        const tokens = ${J(Object.values(ids))}.map(id => scene.tokens.get(id));
        const words = JSON.stringify(tokens.map(t => t?.toObject?.() ?? null)) + JSON.stringify(remnantStore.all?.() ?? {});
        return { tokens: tokens.filter(Boolean).length, rows: ${J(Object.values(ids))}.filter(id => remnantStore.get("${IDS.scene}." + id)).length,
            words: ${J([MARK.tiedSubject, MARK.tiedNote, MARK.faintNote, MARK.keyNote, "tiedToCrime"])}.filter(w => words.includes(w)) };`);
    const held = { p1: await leak(p1), p2: await leak(p2) };
    verdict("a player's browser holds the three tokens and no row, no note and no subject of them",
        Object.values(held).every(h => h.tokens === 3 && h.rows === 0 && h.words.length === 0), J(held));

    /* ------------------------------ O. Observe ------------------------------ */

    begin("O", "p1 focuses its gaze; gm2 picks the trace from the card, the primary describes it", "search-observe");
    /* The GM keeps a picker answerer: on the code before E09 C12 (08.10.2026) the primary's own
       picker opened, was answered here, and O1 below counts it. From C12 the GM answers only the
       description, and the pick is gm2's, made from its own copy of the card in p1's thread. */
    const pickAnswerer = `const answer = cfg => {
            // The content is an element (utils.mjs dialogContent), so the pick is read off its select.
            const select = cfg?.content?.querySelector?.('select[name="remnant"]');
            if (select) {
                const options = [...select.options].map(o => [o.value, o.textContent]);
                globalThis.__s62.picks.push(options.map(o => o[1]));
                return options.find(o => o[1].includes(${J(MARK.tiedSubject)}))?.[0] ?? null;
            }
            if (cfg?.window?.title === describe) return { name: ${J(MARK.name)}, playerText: ${J(MARK.playerText)}, analyzedText: ${J(MARK.analyzed)} };
            globalThis.__s62.other.push(cfg?.window?.title ?? "?");
            return null;
        };`;
    for (const client of [gm, gm2]) await client.eval(`globalThis.__s62 = { windows: globalThis.__dialogWindows, picks: [], other: [] };
        globalThis.__s62had = new Set(game.messages.contents.map(m => m.id));
        globalThis.__dialogWindows = true;
        const describe = game.i18n.localize("DRPG.Observe.describeTitle");
        ${pickAnswerer}
        globalThis.__dialogAnswers.push(answer, answer);
        return true;`);
    // Not awaited: from C12 p1's Observe waits on gm2's pick, which the next eval makes.
    const observing = p1.eval(`${until} ${TB}
        const actor = game.actors.get("${IDS.aiko}"), { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        globalThis.__s62had = new Set(game.messages.contents.map(m => m.id));
        globalThis.__dialogAnswers.push(() => ({ value: "specific", form: { querySelector: () => ({ value: ${J(MARK.request)} }) } }));
        globalThis.__forceRoll = ${J(NOT_CRITICAL)};
        const left0 = game.drpg.actionsLeft(actor);
        let err = null;
        try { await Promise.race([game.drpg.performAction(actor, "observe", {}), new Promise(r => setTimeout(r, 45000))]); }
        catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        const copy = await until(() => TB.bulletsOf(actor)[0], 15000);
        const data = copy ? TB.truthBulletData(copy) : null;
        const fresh = game.messages.contents.filter(m => !globalThis.__s62had.has(m.id));
        const title = game.i18n.localize("DRPG.Observe.cardTitle");
        const card = fresh.find(m => String(contentOf(m) ?? "").includes(title));
        const cardWords = card ? String(contentOf(card) ?? "") : null;
        return { err, left0, left: game.drpg.actionsLeft(actor), copies: TB.bulletsOf(actor).length,
            copy: data ? { id: copy.id, name: data.name, playerText: data.playerText, analyzedText: data.analyzedText, shownType: data.shownType,
                words: JSON.stringify(copy.toObject()).includes(${J(MARK.analyzed)}) } : null,
            fresh: fresh.length, gmBodies: fresh.filter(m => String(contentOf(m) ?? "").includes("drpg-gm-only")).length,
            card: cardWords === null ? null : { request: cardWords.includes(${J(MARK.request)}),
                leaked: ${J([MARK.tiedSubject, MARK.tiedNote, MARK.faintNote, MARK.keyNote, "pickObserveTrace", "DC"])}.filter(w => cardWords.includes(w)) },
            dialogs: globalThis.__dialogLog.map(d => d.title).slice(-6) };`, { timeout: 90000 });
    const answered = await gm2.eval(`${until}
        const { contentOf, cardFlag } = await import("${repoUrl}/scripts/secret.mjs");
        const { wireCallActions } = await import("${repoUrl}/scripts/messenger-app.mjs");
        const find = () => game.messages.contents.find(m => !globalThis.__s62had.has(m.id) && String(contentOf(m) ?? "").includes('data-drpg-call="pickObserveTrace"'));
        const card = await until(find, 20000);
        let clicked = false;
        if (card) {
            const body = document.createElement("div");
            body.innerHTML = contentOf(card);
            wireCallActions(body, card);
            const button = body.querySelector('[data-drpg-call="pickObserveTrace"]');
            button?.click();
            clicked = Boolean(button);
        }
        const settled = card ? Boolean(await until(() => cardFlag(game.messages.get(card.id), "settled"), 20000)) : false;
        return { card: card?.id ?? null, clicked, settled };`, { timeout: 60000 });
    const observed = await observing;
    const picksOf = client => client.eval(`${TB} const s = globalThis.__s62, out = { picks: s.picks, other: s.other };
        globalThis.__dialogWindows = s.windows; globalThis.__dialogAnswers.length = 0;
        out.remnants = TB.bulletsOf(game.actors.get("${IDS.aiko}")).map(i => TB.secretOf(i.uuid)?.remnantId ?? null);
        return out;`);
    const picked = { gm: await picksOf(gm), gm2: await picksOf(gm2) };
    picked.remnants = picked.gm.remnants;
    verdict("no picker opened on the primary while p1 asked; gm2's card was pressed and settled, its picker listing the room's three traces",
        picked.gm.picks.length === 0 && picked.gm.other.length === 0 && picked.gm2.other.length === 0
            && picked.gm2.picks.length === 1 && picked.gm2.picks[0].length === 3 && answered.clicked && answered.settled, J({ picked, answered }));
    verdict("p1 spent one action and holds one copy, of the tied trace, under the words the GM wrote",
        !observed.err && observed.left === observed.left0 - 1 && observed.copies === 1 && J(picked.remnants) === J([ids.tied])
            && observed.copy?.name === MARK.name && observed.copy?.playerText === MARK.playerText, J({ observed, remnants: picked.remnants }));
    verdict("p1's copy holds no reading yet: not as its reading, not anywhere in the item",
        observed.copy && observed.copy.analyzedText === "" && observed.copy.words === false, J(observed.copy));
    verdict("p1's thread grew and holds no GM body (S05-34 stays closed)",
        observed.fresh > 0 && observed.gmBodies === 0, J({ fresh: observed.fresh, gmBodies: observed.gmBodies }));
    verdict("p1's copy of the card holds its request and no trace, no note, no DC and no button",
        observed.card?.request === true && observed.card.leaked.length === 0, J(observed.card));

    /* ------------------------------ N. Analyze ------------------------------ */

    begin("N", "p1 analyzes its copy, read on p1", "analyze");
    const analyzed = await p1.eval(`${until} ${TB}
        const actor = game.actors.get("${IDS.aiko}"), copy = TB.bulletsOf(actor)[0];
        globalThis.__forceRoll = ${J(NOT_CRITICAL)};
        let err = null;
        try { await Promise.race([game.drpg.performAction(actor, "analyze", { bulletId: copy?.id }), new Promise(r => setTimeout(r, 45000))]); }
        catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; }
        const read = await until(() => copy && TB.truthBulletData(copy)?.analyzed, 15000);
        const data = copy ? TB.truthBulletData(copy) : null;
        return { err, read: Boolean(read), shownType: data?.shownType ?? null, analyzedText: data?.analyzedText ?? null };`, { timeout: 90000 });
    verdict("the copy shows its type, Prep, and the reading the GM wrote",
        !analyzed.err && analyzed.read && analyzed.shownType === "prep" && analyzed.analyzedText === MARK.analyzed, J(analyzed));

    /* ------------------------------ T. Tamper ------------------------------ */

    begin("T", "p2 reshapes the trace p1 holds; gm2 approves", "trace-remnant");
    const move = (aiko, botan) => gm.eval(`const scene = game.scenes.get("${IDS.scene}");
        await scene.tokens.get("TOKAIKO000000000").update(${J(aiko)});
        await scene.tokens.get("TOKBOTAN00000000").update(${J(botan)});
        return true;`);
    // Botan alone in Dorm A with the traces, Aiko in the Gym: the Tamper has no witness to hide from.
    await move({ x: 1500, y: 1500 }, { x: 300, y: 600 });
    try {
        await settle(400);
        const found = await p2.eval(`${until} ${TB}
            const actor = game.actors.get("${IDS.botan}");
            globalThis.__dialogAnswers.push(() => ({ value: "general", form: { querySelector: () => ({ value: "" }) } }));
            globalThis.__forceRoll = ${J(NOT_CRITICAL)};
            let err = null;
            try { await Promise.race([game.drpg.performAction(actor, "observe", {}), new Promise(r => setTimeout(r, 45000))]); }
            catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
            finally { delete globalThis.__forceRoll; }
            const copy = await until(() => TB.bulletsOf(actor)[0], 15000);
            return { err, name: copy?.name ?? null, copies: TB.bulletsOf(actor).length };`, { timeout: 90000 });
        const own = await gm.eval(`${TB} return TB.bulletsOf(game.actors.get("${IDS.botan}")).map(i => TB.secretOf(i.uuid)?.remnantId ?? null);`);
        verdict("p2's general Observe finds the tied trace under the name the GM gave it, with no GM dialog",
            !found.err && found.copies === 1 && found.name === MARK.name && J(own) === J([ids.tied]), J({ found, own }));

        await gm.eval(`globalThis.__s62had = new Set(game.messages.contents.map(m => m.id)); return true;`);
        await p2.eval(`globalThis.__s62had = new Set(game.messages.contents.map(m => m.id)); return true;`);
        const tamper = await p2.eval(`const Cl = await import("${repoUrl}/scripts/cleanup.mjs");
            const actor = game.actors.get("${IDS.botan}");
            globalThis.__forceRoll = ${J(NOT_CRITICAL)};
            let r = null, err = null;
            try { r = await Cl.attemptCleanup(actor, "${ids.tied}", { viaAction: true, mode: "transform",
                change: { name: ${J(MARK.reshapedName)}, text: ${J(MARK.reshapedText)} } }); }
            catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
            finally { delete globalThis.__forceRoll; }
            return { err, rolled: Boolean(r?.roll), total: r?.roll?.total ?? null, notes: globalThis.__notifications.slice(-3).map(n => n.msg) };`, { timeout: 90000 });
        verdict("p2's reshape is rolled and sent", !tamper.err && tamper.rolled, J(tamper));

        const shown = await gm.eval(`${until}
            const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
            const { wireCallActions } = await import("${repoUrl}/scripts/messenger-app.mjs");
            const { plural } = await import("${repoUrl}/scripts/utils.mjs");
            const find = () => game.messages.contents.find(m => !globalThis.__s62had.has(m.id) && String(contentOf(m) ?? "").includes('data-drpg-call="approveReshape"'));
            const card = await until(find, 20000);
            const counted = Boolean(card) && String(contentOf(card) ?? "").includes(foundry.utils.escapeHTML(plural("DRPG.Cleanup.reshapeRulingCopies", { n: 2 })));
            // The GM's own copy of the card, wired and left open: the phase's last check presses it once gm2 has ruled.
            if (card) {
                const body = document.createElement("div");
                body.innerHTML = contentOf(card);
                wireCallActions(body, card);
                globalThis.__s62card = body;
            }
            return { card: card?.id ?? null, counted };`, { timeout: 60000 });
        const approved = await gm2.eval(`${until}
            const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
            const { wireCallActions } = await import("${repoUrl}/scripts/messenger-app.mjs");
            const card = await until(() => game.messages.get(${J(shown.card)}), 20000);
            const words = await until(() => String((card && contentOf(card)) ?? "").includes('data-drpg-call="approveReshape"') ? contentOf(card) : null, 20000);
            let clicked = false;
            if (words) {
                const body = document.createElement("div");
                body.innerHTML = words;
                wireCallActions(body, card);
                const button = body.querySelector('[data-drpg-call="approveReshape"]');
                button?.click();
                clicked = Boolean(button);
            }
            return { card: Boolean(card), words: Boolean(words), clicked };`, { timeout: 60000 });
        verdict("the GM is shown the reshape, and gm2 approves it from its own copy of the card",
            Boolean(shown.card) && approved.words && approved.clicked, J({ shown, approved }));
        verdict("the card tells the GM that the two copies already held, p1's and p2's, keep their words", shown.counted, J(shown));

        const ledger = await gm.eval(`${until}
            const R = await import("${repoUrl}/scripts/remnants.mjs");
            const pub = () => R.remnantPublic(game.scenes.get("${IDS.scene}").tokens.get("${ids.tied}"));
            await until(() => pub()?.name === ${J(MARK.reshapedName)}, 15000);
            return { name: pub()?.name ?? null, playerText: pub()?.playerText ?? null };`, { timeout: 30000 });
        verdict("the GMs' ledger takes the reshaped name and words", ledger.name === MARK.reshapedName && ledger.playerText === MARK.reshapedText, J(ledger));
        // Nothing should move on the copies: a bounded wait for the renaming the code before C9 made.
        const keptBy = (client, actor) => client.eval(`${until} ${TB}
            const copy = TB.bulletsOf(game.actors.get("${actor}"))[0];
            await until(() => copy?.name === ${J(MARK.reshapedName)}, 3000);
            const data = copy ? TB.truthBulletData(copy) : null;
            return { name: data?.name ?? null, playerText: data?.playerText ?? null };`, { timeout: 30000 });
        const kept = { p1: await keptBy(p1, IDS.aiko), p2: await keptBy(p2, IDS.botan) };
        verdict("p1's copy, found and analysed before the reshape, and p2's own keep the name and words they were found with",
            ["p1", "p2"].every(side => kept[side].name === MARK.name && kept[side].playerText === MARK.playerText), J(kept));
        const thread = await p2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
            const fresh = game.messages.contents.filter(m => !globalThis.__s62had.has(m.id));
            return { fresh: fresh.length, gmBodies: fresh.filter(m => String(contentOf(m) ?? "").includes("drpg-gm-only")).length };`);
        verdict("p2's thread holds no GM body of the reshape card", thread.gmBodies === 0, J(thread));

        // E09 C10: gm2's click was ruled on the primary, and the GM's copy of the card, still open, is refused and told.
        const ruledOn = await gm.eval(`${until} const S = await import("${repoUrl}/scripts/gm-stores.mjs");
            const ruled = await until(() => S.cleanupAttemptStore.get("${IDS.botan}")?.ruled ?? null, 10000);
            return ruled ? { by: ruled.by ?? null, on: ruled.on ?? null, verdict: ruled.verdict ?? null } : null;`, { timeout: 30000 });
        verdict("gm2's approval is ruled on the primary GM, as gm2's",
            ruledOn?.by === "USERGM2000000000" && ruledOn?.on === IDS.gm && ruledOn?.verdict === "approve", J(ruledOn));
        const toldP2 = () => p2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
            return game.messages.contents.filter(m => String(contentOf(m) ?? "").includes(${J(MARK.reshapedName)})).length;`);
        const toldBefore = await toldP2();
        const again = await gm.eval(`${until}
            const body = globalThis.__s62card; delete globalThis.__s62card;
            const button = body?.querySelector('[data-drpg-call="approveReshape"]') ?? null;
            const had = globalThis.__notifications.length;
            button?.click();
            await until(() => button && !button.disabled, 10000);
            const ruled = game.i18n.format("DRPG.Cleanup.alreadyRuled", { name: game.users.get("USERGM2000000000")?.name ?? "" });
            return { pressed: Boolean(button), told: globalThis.__notifications.slice(had).filter(n => n.level === "warn" && n.msg === ruled).length };`,
        { timeout: 30000 });
        await settle(800);
        const toldAfter = await toldP2();
        verdict("the GM's later Approve on its open copy of the card is refused and told, and tells p2 nothing more",
            again.pressed && again.told === 1 && toldAfter === toldBefore, J({ again, toldBefore, toldAfter }));
    } finally {
        await move({ x: 300, y: 300 }, { x: 1300, y: 300 });
    }

    /* ------------------------------ V. the verdicts ------------------------------ */

    begin("V", "the GM's verdicts on the tied trace reach the copies p1 and p2 hold, as the GMs hold them", "truth-bullets");
    // The tied trace's two copies on the GM: Aiko's, analysed in N, and Botan's, found in T and not analysed.
    const copyOf = actor => `${TB} const copy = TB.bulletsOf(game.actors.get("${actor}")).find(i => TB.secretOf(i.uuid)?.remnantId === "${ids.tied}") ?? null;`;
    const copies = await gm.eval(`const out = {};
        { ${copyOf(IDS.aiko)} out.aiko = copy?.id ?? null; }
        { ${copyOf(IDS.botan)} out.botan = copy?.id ?? null; }
        return out;`);
    const flagOn = (client, actor, key, want) => client.eval(`${until} const b = game.actors.get("${actor}")?.items.get("${copies[actor === IDS.aiko ? "aiko" : "botan"]}");
        await until(() => J(b?.getFlag("danganronpa-rpg", "${key}") ?? null) === J(${J(want)}), 6000);
        function J(v) { return JSON.stringify(v); }
        return b?.getFlag("danganronpa-rpg", "${key}") ?? null;`, { timeout: 20000 });
    const keysOn = (client, field, want) => client.eval(`${until} ${TB}
        const read = () => ${J([IDS.aiko, IDS.botan])}.map(a => TB.secretOf(game.actors.get(a)?.items.get(${J(copies)}[a === "${IDS.aiko}" ? "aiko" : "botan"])?.uuid ?? "")?.${field} ?? null);
        await until(() => JSON.stringify(read()) === ${J(J(want))}, 6000);
        return read();`, { timeout: 20000 });

    // V1: the GM ticks Faint on the tied trace (the dashboard's Save, `setRemnantFlags`), then takes it off again.
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.setRemnantFlags(game.scenes.get("${IDS.scene}").tokens.get("${ids.tied}"), { faint: true }); return true;`, { timeout: 30000 });
    const faint = { gm: await keysOn(gm, "faint", [true, true]), gm2: await keysOn(gm2, "faint", [true, true]),
        p1: await flagOn(p1, IDS.aiko, "faint", true), p2: await flagOn(p2, IDS.botan, "faint", false) };
    await gm.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        await R.setRemnantFlags(game.scenes.get("${IDS.scene}").tokens.get("${ids.tied}"), { faint: false }); return true;`, { timeout: 30000 });
    verdict("a GM's Faint reaches both copies' answer keys on both GMs, and the item of the copy p1 analysed, not p2's",
        Boolean(copies.aiko && copies.botan) && J(faint.gm) === J([true, true]) && J(faint.gm2) === J([true, true]) && faint.p1 === true
            && faint.p2 !== true, J({ copies, faint }));

    // V2: p2's console gives Botan's copy `analyzed`; the GM, hearing it, rewrites the trace's reading, and the
    // primary's put-back of `analyzed` is held on its way out until that edit has run - the window a put-back
    // slower than a GM's edit leaves (as 30's `alone` holds one).
    const ANALYZED = "flags.danganronpa-rpg.analyzed";
    const armed = await gm.eval(`${TB} const R = await import("${repoUrl}/scripts/remnants.mjs");
        const { isPrimaryGm } = await import("${repoUrl}/scripts/utils.mjs");
        const b = game.actors.get("${IDS.botan}").items.get("${copies.botan}"), update = b.update;
        globalThis.__s62v = { edit: null, held: false, edited: false };
        b.update = function (data, options) {
            if (!options?.[TB.NOT_AN_EDIT] || !("${ANALYZED}" in (data ?? {}))) return update.call(this, data, options);
            delete b.update;
            globalThis.__s62v.held = true;
            return (async () => { await globalThis.__s62v.edit; return update.call(b, data, options); })();
        };
        globalThis.__s62vHook = Hooks.on("updateItem", (doc, changes, options, userId) => {
            if (doc.id !== "${copies.botan}" || game.users.get(userId)?.isGM || !("${ANALYZED}" in foundry.utils.flattenObject(changes ?? {}))) return;
            Hooks.off("updateItem", globalThis.__s62vHook);
            globalThis.__s62v.edit = R.setRemnantPublic(game.scenes.get("${IDS.scene}").tokens.get("${ids.tied}"), { analyzedText: ${J(MARK.rewritten)} })
                .then(() => { globalThis.__s62v.edited = true; });
        });
        return { primary: isPrimaryGm(), analyzed: b.getFlag("danganronpa-rpg", "analyzed") ?? null };`);
    let forged = null;
    try {
        await p2.eval(`await game.actors.get("${IDS.botan}").items.get("${copies.botan}").update({ "${ANALYZED}": true }, { drpgAutomated: true }); return true;`);
        const done = await gm.eval(`${until} const A = await import("${repoUrl}/scripts/sheet-audit.mjs");
            const b = game.actors.get("${IDS.botan}").items.get("${copies.botan}");
            await until(() => globalThis.__s62v.edited && globalThis.__s62v.held && b.getFlag("danganronpa-rpg", "analyzed") !== true, 10000);
            await A.sheetAuditIdle();
            return { held: globalThis.__s62v.held, edited: globalThis.__s62v.edited };`, { timeout: 30000 });
        const copyOn = client => client.eval(`${until} ${TB} const b = game.actors.get("${IDS.botan}").items.get("${copies.botan}");
            const read = () => { const c = TB.bulletGuardStatus(b.uuid).copy ?? {};
                return [c["${ANALYZED}"] ?? null, c["flags.danganronpa-rpg.analyzedText"] ?? null, TB.secretOf(b.uuid)?.analyzedText ?? null]; };
            await until(() => read()[2] === ${J(MARK.rewritten)} && read()[0] === false, 6000);
            return read();`, { timeout: 20000 });
        const sheetOn = client => client.eval(`${until} const b = game.actors.get("${IDS.botan}").items.get("${copies.botan}");
            await until(() => b.getFlag("danganronpa-rpg", "analyzed") === false, 6000);
            return [b.getFlag("danganronpa-rpg", "analyzed") ?? null, b.getFlag("danganronpa-rpg", "analyzedText") ?? null,
                String(b.system?.description ?? "").includes(${J(MARK.rewritten)})];`, { timeout: 20000 });
        forged = { armed, done, p2: await sheetOn(p2), gm: await copyOn(gm), gm2: await copyOn(gm2),
            p1: await flagOn(p1, IDS.aiko, "analyzedText", MARK.rewritten) };
    } finally {
        await gm.eval(`Hooks.off("updateItem", globalThis.__s62vHook); const b = game.actors.get("${IDS.botan}").items.get("${copies.botan}");
            if (Object.hasOwn(b, "update")) delete b.update; return true;`);
    }
    verdict("p2's console `analyzed` on its unanalysed copy earns no reading from the GM's edit in the window: p2 reads none, "
        + "both GMs' copies hold none and the answer key holds it, p1's analysed copy reads it",
        armed.primary === true && armed.analyzed !== true && forged.done.held && forged.done.edited
            && J(forged.p2) === J([false, "", false]) && J(forged.gm) === J([false, "", MARK.rewritten]) && J(forged.gm2) === J([false, "", MARK.rewritten])
            && forged.p1 === MARK.rewritten, J(forged));

    // V3 (E09 fix r2-G1): V2's rewrite of the reading is a GM's later write to the trace T reshaped, and sends the copies
    // the reading alone - p1's and p2's keep the name and words they were found with, read on p1 and p2 (a bounded wait
    // for the renaming the code before the fix made).
    const wordsOn = (client, actor, id) => client.eval(`${until} ${TB}
        const copy = game.actors.get("${actor}")?.items.get("${id}");
        await until(() => copy?.name === ${J(MARK.reshapedName)}, 3000);
        const data = copy ? TB.truthBulletData(copy) : null;
        return [data?.name ?? null, data?.playerText ?? null];`, { timeout: 30000 });
    const heldWords = { p1: await wordsOn(p1, IDS.aiko, copies.aiko), p2: await wordsOn(p2, IDS.botan, copies.botan) };
    verdict("the GM's rewrite of the reshaped trace's reading leaves p1's and p2's copies the name and words they were found with",
        ["p1", "p2"].every(side => J(heldWords[side]) === J([MARK.name, MARK.playerText])), J(heldWords));

    /* ------------------------------ D. the dashboard under a ruling ------------------------------ */

    begin("D", "gm2 rules on reshapes from the console, once each and on the primary, while the GM's dashboard stands open with a name typed in its row", "trace-remnant");
    const publicOn = client => client.eval(`const R = await import("${repoUrl}/scripts/remnants.mjs");
        const scene = game.scenes.get("${IDS.scene}");
        return Object.fromEntries(${J(Object.entries(ids))}.map(([k, id]) => {
            const p = R.remnantData(scene.tokens.get(id))?.public ?? {};
            return [k, [p.name ?? "", p.playerText ?? ""]];
        }));`);
    const before = { gm: await publicOn(gm), gm2: await publicOn(gm2) };
    const row = `${IDS.scene}__${ids.faint}`;
    const caseWindows = `const open = () => [...foundry.applications.instances.values()].filter(a => a.rendered && a.options?.classes?.includes("drpg-window-case"));`;
    const typed = await gm.eval(`${until} ${caseWindows}
        const I = await import("${repoUrl}/scripts/investigation.mjs");
        const d = globalThis.__s62d = { windows: globalThis.__dialogWindows, warned: [], warn: ui.notifications.warn };
        globalThis.__dialogWindows = true;
        ui.notifications.warn = (text, ...rest) => { d.warned.push(String(text)); return d.warn.call(ui.notifications, text, ...rest); };
        d.answer = Promise.resolve().then(() => I.openInvestigationDashboard()).catch(e => String(e));
        d.app = await until(() => open().find(a => a.element) ?? null, 10000);
        // The window opens on the clock's chapter, and phase A's traces carry none (placeRemnant stamps only what it is
        // handed): widened to every chapter first, as a GM looking for them would.
        const chapter = d.app?.element?.querySelector('[data-drpg-filter="chapter"]');
        if (chapter) { chapter.value = ""; chapter.dispatchEvent(new Event("change", { bubbles: true })); }
        const name = await until(() => d.app?.element?.querySelector('[name="name.${row}"]'), 10000);
        const drawn = name?.value ?? null;
        if (name) name.value = ${J(MARK.typed)};
        return { open: Boolean(d.app), listed: Boolean(name), drawn };`, { timeout: 30000 });
    verdict("the dashboard is open on the GM with a name typed in the Faint trace's row", typed.open && typed.listed, J(typed));
    /*
     * A ruling reads its proposal off the attempt's row since E09 C10, so gm2 writes one first, and the GM waits until
     * it holds it. Then the rulings come from the console (`game.drpg.approveReshape` / `declineReshape`), which since
     * E09 fix r2-G2 take the card's road to the primary GM: first gm2's Decline of one proposal, then gm2's Approve of a
     * second and the GM's own Approve of it, made at once. On the code before the fix (08.10.2026) a console ruling ran
     * on the calling GM's browser - gm2's Decline was ruled on gm2 - so gm2's and the GM's ran side by side.
     */
    const propose = attempt => gm2.eval(`const { cleanupAttemptStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        await cleanupAttemptStore.whenHydrated();
        await cleanupAttemptStore.patch("${IDS.botan}", { actorId: "${IDS.botan}", tokenId: "${ids.faint}", attempt: "${attempt}",
            ruled: null, proposal: { name: ${J(MARK.dName)}, text: ${J(MARK.dText)}, softer: null, tie: false, erases: false } });
        return true;`, { timeout: 30000 }).then(() => gm.eval(`${until} const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        return Boolean(await until(() => { const r = S.cleanupAttemptStore.get("${IDS.botan}"); return r?.attempt === "${attempt}" && !r.ruled; }, 10000));`,
    { timeout: 30000 }));
    // What the console call answered and the warnings it raised there; the GM's are taken back out of the window's count.
    const fromConsole = (client, how, attempt) => client.eval(`const d = globalThis.__s62d; const kept = d ? d.warned.length : 0;
        const had = globalThis.__notifications.length;
        const value = await game.drpg.${how}({ actorId: "${IDS.botan}", tokenId: "${ids.faint}", attempt: "${attempt}" });
        if (d) d.warned.splice(kept);
        return { value: value ?? null, warned: globalThis.__notifications.slice(had).filter(n => n.level === "warn").map(n => n.msg) };`,
    { timeout: 30000 });
    const ruledRow = () => gm.eval(`${until} const S = await import("${repoUrl}/scripts/gm-stores.mjs");
        const ruled = await until(() => S.cleanupAttemptStore.get("${IDS.botan}")?.ruled ?? null, 10000);
        return ruled ? { by: ruled.by ?? null, on: ruled.on ?? null, verdict: ruled.verdict ?? null } : null;`, { timeout: 30000 });
    const heldFirst = await propose("S62DRESHAPE00000");
    const declined = await fromConsole(gm2, "declineReshape", "S62DRESHAPE00000");
    const declinedRow = await ruledRow();
    verdict("gm2's Decline from the console is ruled on the primary GM, as gm2's",
        heldFirst && declined.value === true && J(declinedRow) === J({ by: "USERGM2000000000", on: IDS.gm, verdict: "decline" }),
        J({ heldFirst, declined, declinedRow }));
    const heldSecond = await propose("S62DRESHAPE00001");
    const toldP2 = () => p2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        return game.messages.contents.filter(m => String(contentOf(m) ?? "").includes(${J(MARK.dName)})).length;`);
    const [byGm2, byGm] = await Promise.all([fromConsole(gm2, "approveReshape", "S62DRESHAPE00001"),
        fromConsole(gm, "approveReshape", "S62DRESHAPE00001")]);
    const approvedRow = await ruledRow();
    await settle(800);
    const toldD = await toldP2();
    const winner = byGm2.value === true ? "USERGM2000000000" : IDS.gm;
    const loser = winner === IDS.gm ? byGm2 : byGm;
    const alreadyRuled = await gm.eval(`return game.i18n.format("DRPG.Cleanup.alreadyRuled", { name: game.users.get("${winner}")?.name ?? "" });`);
    verdict("gm2's Approve from the console and the GM's own, made at once, rule once on the primary GM: the other is told it was ruled, and p2 is told once",
        heldSecond && [byGm2.value, byGm.value].filter(v => v === true).length === 1 && loser.value === null
            && loser.warned.filter(msg => msg === alreadyRuled).length === 1
            && J(approvedRow) === J({ by: winner, on: IDS.gm, verdict: "approve" }) && toldD === 1,
        J({ heldSecond, byGm2, byGm, approvedRow, toldD }));
    const redrawn = await gm.eval(`${until} const d = globalThis.__s62d;
        const field = name => d.app?.element?.querySelector('[name="' + name + '"]');
        await until(() => field("text.${row}")?.value === ${J(MARK.dText)}, 15000);
        const name = field("name.${row}");
        return { text: field("text.${row}")?.value ?? null, name: name?.value ?? null,
            marked: Boolean(name?.classList.contains("drpg-moved-under")), title: name?.title ?? "" };`, { timeout: 30000 });
    verdict("the GM's open window redraws: the words show the reshape, the typed name stays and is marked with the reshaped one",
        redrawn.text === MARK.dText && redrawn.name === MARK.typed && redrawn.marked && redrawn.title.includes(MARK.dName), J(redrawn));
    const saved = await gm.eval(`${until} ${caseWindows} const d = globalThis.__s62d;
        d.app?.element?.querySelector('footer.form-footer button[data-action="save"]')?.click();
        const again = await until(() => open().find(a => a !== d.app && a.element) ?? null, 15000);
        for (const a of open()) await a.close();
        const answer = await Promise.race([d.answer, new Promise(r => setTimeout(() => r("still waiting"), 10000))]);
        const { gmStoresIdle } = await import("${repoUrl}/scripts/gm-store.mjs");
        await gmStoresIdle();
        ui.notifications.warn = d.warn; globalThis.__dialogWindows = d.windows; delete globalThis.__s62d;
        return { reopened: Boolean(again), answer: answer ?? null, warned: d.warned };`, { timeout: 60000 });
    verdict("the GM's Save refuses the typed name and says so once, naming it",
        saved.reopened && saved.answer === null && saved.warned.length === 1 && saved.warned[0].includes(MARK.typed), J(saved));
    await settle(800);
    const after = { gm: await publicOn(gm), gm2: await publicOn(gm2) };
    const others = side => J({ ...after[side], faint: null }) === J({ ...before[side], faint: null });
    verdict("both GMs hold the reshape after the Save, and the other two traces as they were",
        ["gm", "gm2"].every(side => J(after[side].faint) === J([MARK.dName, MARK.dText]) && others(side)), J({ before, after }));

    /* ------------------------------ K. the Key fee ------------------------------ */

    begin("K", "a chapter-2 trial after a chapter-1 plan pays the same Key fee without a Save of the planner and after one", "class-trial");
    // Entered through the clock, as a trial opens (clock.mjs `reconcilePhase`); the stamp cleared before each entry.
    const fee = await gm.eval(`${TB} const I = await import("${repoUrl}/scripts/investigation.mjs");
        const R = await import("${repoUrl}/scripts/remnants.mjs"), V = await import("${repoUrl}/scripts/vote.mjs");
        const D = await import("${repoUrl}/scripts/despair.mjs"), { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        const { sheetAuditIdle } = await import("${repoUrl}/scripts/sheet-audit.mjs");
        const clock = getClock(), scene = game.scenes.get("${IDS.scene}"), users = D.monokumas();
        const pools = () => users.map(u => D.getDespair(u.id));
        const start = pools(), tokens = [], copies = [], out = { pools: users.length, from: [clock.chapter, clock.phase] };
        const trial = async () => {
            await V.setTrialProgress({ keysCharged: false });
            const before = pools();
            await setClock({ phase: "classTrial" });
            const moved = pools().map((n, i) => n - before[i]);
            await setClock({ phase: clock.phase });
            return moved;
        };
        try {
            await I.setKeyPlan({ chapter: 1, entries: [{ name: "S62 chapter 1's clue" }] });
            await setClock({ chapter: 2 });
            await I.recordCaseKeys(2, 3);
            for (const [i, actorId] of ${J([IDS.aiko, IDS.botan])}.entries()) {
                const token = await R.placeRemnant({ type: "key", visibility: "evident", scene, chapter: 2, x: 700 + 100 * i, y: 500, sourceName: "S62" });
                tokens.push(token);
                copies.push(await TB.createTruthBullet(game.actors.get(actorId), { name: "S62 K Key " + (i + 1), realType: "key",
                    playerText: ${J(MARK.playerText)}, remnantId: token?.id ?? null, sceneId: scene.id }));
            }
            await sheetAuditIdle();
            out.found = [tokens, copies].map(list => list.filter(Boolean).length);
            out.without = await trial();
            await I.setKeyPlan({ chapter: 2, entries: [{ name: "S62 chapter 2's clue, saved" }] });
            out.saved = await trial();
        } finally {
            for (const copy of copies) if (copy?.actor?.items.has(copy.id)) await copy.delete();
            for (const token of tokens.filter(Boolean)) {
                await R.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) await scene.deleteEmbeddedDocuments("Token", [token.id]);
            }
            for (const [i, u] of users.entries()) if (D.getDespair(u.id) !== start[i]) await D.setDespair(u.id, start[i]);
            await V.setTrialProgress({ keysCharged: false });
            await setClock({ chapter: clock.chapter, phase: clock.phase });
            await sheetAuditIdle();
        }
        const now = getClock();
        out.after = { pools: JSON.stringify(pools()) === JSON.stringify(start), clock: [now.chapter, now.phase],
            left: copies.filter(c => c?.actor?.items.has(c.id)).length + tokens.filter(t => t && scene.tokens.has(t.id)).length };
        return out;`, { timeout: 120000 });
    verdict("both trials, without a Save and after one, move each of the two Monokumas' pools by 3 (a case of three, two found)",
        fee.pools === 2 && J(fee.found) === J([2, 2]) && J(fee.without) === J([3, 3]) && J(fee.saved) === J([3, 3]), J(fee));
    verdict("the pools, the clock and the scene are as they were before the two trials",
        fee.after.pools && J(fee.after.clock) === J(fee.from) && fee.after.left === 0 && fee.from[1] !== "classTrial", J(fee));

    /* ------------------------------ P. the Key fee, on the primary ------------------------------ */

    begin("P", "gm2 opens a trial, and the Key fee is charged on the primary by the copies the GMs hold", "class-trial");
    // K's case of three, two found, on a chapter of its own; beside the finds tier 2's made Key ("a made Key bullet and a
    // forged Key copy ..."), a copy of the first find under a new id that the audit has not judged (`AUDIT_ASIDE`), so
    // the GMs' mark does not hold it. Then gm2 moves the phase, as any GM may (clock.mjs `reconcilePhase`).
    const P_CHAPTER = 3;
    const P_IMPORTS = `${TB} const I = await import("${repoUrl}/scripts/investigation.mjs");
        const R = await import("${repoUrl}/scripts/remnants.mjs"), V = await import("${repoUrl}/scripts/vote.mjs");
        const D = await import("${repoUrl}/scripts/despair.mjs"), { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
        const A = await import("${repoUrl}/scripts/sheet-audit.mjs"), { keyPlanStore } = await import("${repoUrl}/scripts/gm-stores.mjs");
        const scene = game.scenes.get("${IDS.scene}"), users = D.monokumas(), pools = () => users.map(u => D.getDespair(u.id));`;
    const staged = await gm.eval(`${P_IMPORTS} const { CAP_OVERRIDE } = await import("${repoUrl}/scripts/inventory.mjs");
        const clock = getClock(), aiko = game.actors.get("${IDS.aiko}");
        const out = { from: [clock.chapter, clock.phase], start: pools(), tokens: [], copies: [], made: null };
        await setClock({ chapter: ${P_CHAPTER} });
        await I.recordCaseKeys(${P_CHAPTER}, 3);
        for (const [i, actorId] of ${J([IDS.aiko, IDS.botan])}.entries()) {
            const token = await R.placeRemnant({ type: "key", visibility: "evident", scene, chapter: ${P_CHAPTER}, x: 700 + 100 * i, y: 650, sourceName: "S62" });
            const copy = await TB.createTruthBullet(game.actors.get(actorId), { name: "S62 P Key " + (i + 1), realType: "key",
                playerText: ${J(MARK.playerText)}, remnantId: token?.id ?? null, sceneId: scene.id });
            out.tokens.push(token?.id ?? null);
            out.copies.push(copy ? [actorId, copy.id] : null);
        }
        const find = aiko.items.get(out.copies[0]?.[1] ?? "");
        if (find) {
            const { _id, ...data } = find.toObject();
            const [made] = await aiko.createEmbeddedDocuments("Item", [{ ...data, name: "S62 P a made Key" }],
                { [A.AUDIT_ASIDE]: true, [CAP_OVERRIDE]: true });
            out.made = made && !Object.keys(TB.secretOf(made.uuid)).length ? made.id : null;
        }
        await A.sheetAuditIdle();
        await V.setTrialProgress({ keysCharged: false });
        return out;`, { timeout: 60000 });
    await settle(600);
    let opened;
    try {
        opened = await gm2.eval(`const { getClock, setClock } = await import("${repoUrl}/scripts/clock.mjs");
            const t0 = Date.now();
            await setClock({ phase: "classTrial" });
            return { ms: Date.now() - t0, clock: [getClock().chapter, getClock().phase] };`, { timeout: 60000 });
    } catch (err) {
        opened = { error: String(err?.message ?? err) };
    }
    // How each GM counts the fee now (`keyFeeOf`), for the details.
    const fees = {};
    for (const [who, client] of [["gm", gm], ["gm2", gm2]]) {
        try {
            fees[who] = await client.eval(`const I = await import("${repoUrl}/scripts/investigation.mjs"); return await I.keyFeeOf(${P_CHAPTER});`,
                { timeout: 30000 });
        } catch (err) {
            fees[who] = { error: String(err?.message ?? err) };
        }
    }
    // Read on the primary; then everything staged goes, and the clock goes back.
    const charged = await gm.eval(`${until} ${P_IMPORTS} const staged = ${J(staged)}, start = staged.start;
        const aiko = game.actors.get("${IDS.aiko}"), out = {};
        try {
            await until(() => pools().some((n, i) => n !== start[i]), 3000);
            out.moved = pools().map((n, i) => n - start[i]);
            out.stamped = V.trialProgress().keysCharged === true;
        } finally {
            const made = staged.made ? aiko.items.get(staged.made) : null;
            if (made) await made.delete({ [A.AUDIT_ASIDE]: true });
            for (const [actorId, id] of staged.copies.filter(Boolean)) {
                const copy = game.actors.get(actorId)?.items.get(id);
                if (copy) { const uuid = copy.uuid; await copy.delete(); await TB.dropSecret(uuid); }
            }
            for (const id of staged.tokens.filter(Boolean)) {
                const token = scene.tokens.get(id);
                if (!token) continue;
                await R.dropRemnantSecret(token);
                await scene.deleteEmbeddedDocuments("Token", [id]);
            }
            if (keyPlanStore.get("${P_CHAPTER}:case")) await keyPlanStore.dropMany(["${P_CHAPTER}:case"]);
            for (const [i, u] of users.entries()) if (D.getDespair(u.id) !== start[i]) await D.setDespair(u.id, start[i]);
            await V.setTrialProgress({ keysCharged: false });
            await setClock({ chapter: staged.from[0], phase: staged.from[1] });
            await A.sheetAuditIdle();
        }
        const now = getClock();
        out.after = { pools: JSON.stringify(pools()) === JSON.stringify(start), clock: [now.chapter, now.phase],
            caseRow: Boolean(keyPlanStore.get("${P_CHAPTER}:case")),
            left: [staged.made, ...staged.copies.filter(Boolean).map(([, id]) => id)].filter(id => id && game.actors.some(a => a.items.has(id))).length
                + staged.tokens.filter(id => id && scene.tokens.has(id)).length };
        return out;`, { timeout: 120000 });
    verdict("gm2's trial moves each of the two Monokumas' pools by 3, charged on the primary: two of a case of three found, and the made Key neither counts nor holds the charge",
        staged.start.length === 2 && staged.copies.every(Boolean) && staged.tokens.every(Boolean) && Boolean(staged.made)
            && !opened.error && J(opened.clock) === J([P_CHAPTER, "classTrial"]) && J(charged.moved) === J([3, 3]) && charged.stamped,
        J({ staged, opened, fees, charged }));
    verdict("the pools, the clock, the case's row and the scene are as they were before the trial",
        charged.after.pools && J(charged.after.clock) === J(staged.from) && staged.from[1] !== "classTrial" && !charged.after.caseRow
            && charged.after.left === 0, J({ staged, charged }));

    /* ------------------------------ E. the chapter's end ------------------------------ */

    begin("E", "the chapter ends with an unanalysed Faint, a Neutral and a Final on p1's student", "truth-bullets");
    // The dashboard's confirm is answered no, the End of chapter panel with its sweep alone; both read before.
    const ended = await gm.eval(`${TB} const C = await import("${repoUrl}/scripts/chapter.mjs");
        const I = await import("${repoUrl}/scripts/investigation.mjs"), { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const actor = game.actors.get("${IDS.aiko}"), made = [];
        for (const [name, data] of [["Faint", { faint: true }], ["Neutral", {}], ["Final", { realType: "final", shownType: "neutral", analyzed: false, analyzedText: ${J(MARK.eFinalReading)} }]]) {
            made.push((await TB.createTruthBullet(actor, { name: "S62 " + name, playerText: ${J(MARK.playerText)}, ...data }))?.id ?? null);
        }
        const held = () => game.actors.filter(a => a.type === "character").reduce((n, a) => n + TB.bulletsOf(a).length, 0);
        const numberIn = node => Number(/\\d+/.exec(node?.textContent ?? "")?.[0] ?? NaN);
        const shown = {};
        globalThis.__dialogAnswers.push(cfg => { shown.confirm = numberIn(cfg?.content?.querySelector?.("p")); return false; });
        await I.confirmSweepBullets();
        globalThis.__dialogAnswers.push(cfg => {
            shown.panel = numberIn(cfg?.content?.querySelector?.('input[name="sweep"]')?.closest?.("label"));
            return { reveal: false, sweep: true, faint: false, keys: false, endTrial: false, nextChapter: false, nextSession: false,
                nextMorning: false, endingChapter: getClock().chapter };
        });
        const before = held(), done = await C.openChapterEndDialog();
        return { made, shown, before, after: held(), done, kept: made.map(id => actor.items.has(id)) };`, { timeout: 60000 });
    verdict("the dashboard's confirm and the End of chapter panel give the number the sweep then takes",
        ended.shown.confirm === ended.before - ended.after && ended.shown.panel === ended.before - ended.after && ended.before > ended.after,
        J(ended));
    verdict("the sweep leaves the Faint and the Final and takes the Neutral",
        ended.made.every(Boolean) && J(ended.kept) === J([true, false, true]), J(ended));

    // The reveal half (E09 C8): a Key with its reading joins the Faint and the Final the sweep left. The panel is
    // answered twice, its reveal alone and then its reveal and its sweep; each time the number its reveal line shows
    // is read, and the number the reveal says it wrote.
    const [eFaint, , eFinal] = ended.made;
    const panelled = await gm.eval(`${TB} const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const actor = game.actors.get("${IDS.aiko}");
        const key = await TB.createTruthBullet(actor, { name: "S62 Key", realType: "key", playerText: ${J(MARK.playerText)},
            analyzedText: ${J(MARK.eKeyReading)} });
        const numberIn = text => Number(/\\d+/.exec(text ?? "")?.[0] ?? NaN);
        const shown = [];
        globalThis.__dialogAnswers.push(cfg => {
            shown.push(numberIn(cfg?.content?.querySelector?.('input[name="reveal"]')?.closest?.("label")?.textContent));
            return { reveal: true, sweep: false, faint: false, keys: false, endTrial: false, nextChapter: false, nextSession: false,
                nextMorning: false, endingChapter: getClock().chapter };
        });
        const done = (await C.openChapterEndDialog()) ?? [];
        return { key: key?.id ?? null, shown, done: numberIn(done[0]), chapter: getClock().chapter };`, { timeout: 60000 });
    const p1Reads = `${until} ${TB} const actor = game.actors.get("${IDS.aiko}"), next = ${panelled.chapter} + 1;
        const of = id => actor.items.get(id) ?? null;
        const unread = id => { const b = of(id); return b && [b.getFlag("danganronpa-rpg", "analyzed") === true, TB.isAnalysable(b, next)]; };
        const kindOnly = id => { const b = of(id); return b && [...unread(id), b.getFlag("danganronpa-rpg", "shownType"),
            b.getFlag("danganronpa-rpg", "analyzedText") ?? "", String(b.system?.description ?? "").includes(${J(MARK.eFinalReading)})]; };`;
    const keyOnP1 = await p1.eval(`${p1Reads}
        await until(() => of("${panelled.key}")?.getFlag("danganronpa-rpg", "analyzed"), 8000);
        const key = of("${panelled.key}");
        return { key: key && [key.getFlag("danganronpa-rpg", "analyzed") === true, key.getFlag("danganronpa-rpg", "analyzedText") ?? "",
            String(key.system?.description ?? "").includes(${J(MARK.eKeyReading)})], faint: unread("${eFaint}"), final: kindOnly("${eFinal}") };`,
        { timeout: 20000 });
    verdict("the reveal gives p1 the Key with its reading, the Final its kind without its reading, and leaves the Faint and the Final unread, as many as the panel said",
        Boolean(panelled.key) && J(keyOnP1.key) === J([true, MARK.eKeyReading, true]) && J(keyOnP1.faint) === J([false, true])
            && J(keyOnP1.final) === J([false, true, "final", "", false]) && panelled.shown[0] === panelled.done && panelled.done > 0, J({ panelled, keyOnP1 }));
    const swept = await gm.eval(`${TB} const C = await import("${repoUrl}/scripts/chapter.mjs");
        const { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const numberIn = text => Number(/\\d+/.exec(text ?? "")?.[0] ?? NaN);
        const shown = [];
        globalThis.__dialogAnswers.push(cfg => {
            shown.push(numberIn(cfg?.content?.querySelector?.('input[name="reveal"]')?.closest?.("label")?.textContent));
            return { reveal: true, sweep: true, faint: false, keys: false, endTrial: false, nextChapter: false, nextSession: false,
                nextMorning: false, endingChapter: getClock().chapter };
        });
        await C.openChapterEndDialog();
        return { shown };`, { timeout: 60000 });
    const afterOnP1 = await p1.eval(`${p1Reads}
        await until(() => !of("${panelled.key}"), 8000);
        return { key: Boolean(of("${panelled.key}")), faint: unread("${eFaint}"), final: kindOnly("${eFinal}") };`, { timeout: 20000 });
    verdict("after the reveal and the sweep, p1 still holds the Faint and the Final unread, the Final showing its kind, and can analyse both in the next chapter",
        !afterOnP1.key && J(afterOnP1.faint) === J([false, true]) && J(afterOnP1.final) === J([false, true, "final", "", false]) && swept.shown[0] === 0,
        J({ swept, afterOnP1 }));
    // The scenario's bullets go, with their answer keys.
    await gm.eval(`${TB} const actor = game.actors.get("${IDS.aiko}");
        for (const id of ${J([eFaint, eFinal, panelled.key])}) {
            const b = actor.items.get(id);
            if (b) { const uuid = b.uuid; await b.delete(); await TB.dropSecret(uuid); }
        }
        return true;`);

    /* ------------------------------ L. a missed Analyze of a Final ------------------------------ */

    begin("L", "a missed Analyze of a Final that shows its kind, read on p1", "analyze");
    // A Final shows its kind from the moment it is picked up; a miss on it is told without "still Neutral" (E09 C14).
    const lSeen = await p1.eval(`return game.messages.contents.map(m => m.id);`);
    const lMissed = await gm.eval(`${TB} const A = await import("${repoUrl}/scripts/analyze.mjs");
        const actor = game.actors.get("${IDS.aiko}");
        const final = await TB.createTruthBullet(actor, { name: "S62 L Final", realType: "final", playerText: ${J(MARK.playerText)} });
        const verdict = final ? await A.resolveAnalyze({ actorId: actor.id, itemId: final.id, total: 1 }) : null;
        return { id: final?.id ?? null, shown: final?.getFlag("danganronpa-rpg", "shownType") ?? null, verdict };`, { timeout: 30000 });
    const lOnP1 = await p1.eval(`${until} const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
        const seen = new Set(${J(lSeen)}), title = game.i18n.localize("DRPG.Analyze.failedTitle");
        const card = () => game.messages.contents.filter(m => !seen.has(m.id)).map(m => String(contentOf(m) ?? "")).filter(w => w.includes(title)).at(-1);
        const words = (await until(card, 8000)) ?? "";
        return { card: Boolean(words), named: words.includes("S62 L Final"),
            neutral: words.includes(game.i18n.format("DRPG.Analyze.failed", { name: "S62 L Final" })) };`, { timeout: 20000 });
    verdict("p1's card of the miss names the Final and does not call it Neutral",
        Boolean(lMissed.id) && lMissed.shown === "final" && lMissed.verdict?.success === false
            && J(lOnP1) === J({ card: true, named: true, neutral: false }), J({ lMissed, lOnP1 }));
    await gm.eval(`${TB} const b = game.actors.get("${IDS.aiko}")?.items.get(${J(lMissed.id)});
        if (b) { const uuid = b.uuid; await b.delete(); await TB.dropSecret(uuid); }
        return true;`);
    // E09 C17: the handbooks name each choice of the Tamper menu, Observe's ways of looking and Stage 6's actions
    // by the label the module draws - in English as p1 reads it, in Polish as lang/pl.json has it.
    const lBooks = await p1.eval(`const get = async file => { const res = await fetch("/modules/danganronpa-rpg/" + file); return res.ok ? res.text() : ""; };
        const pl = JSON.parse((await get("lang/pl.json")) || "{}");
        const KEYS = { player: ["DRPG.Tamper.cover", "DRPG.Cleanup.transformAction", "DRPG.Tamper.frame"],
            gm: ["DRPG.Observe.general", "DRPG.Observe.nonObvious", "DRPG.Observe.followTraces", "DRPG.Observe.specific",
                "DRPG.Observe.anything", "DRPG.Cleanup.transformAction", "DRPG.Cleanup.trailAction", "DRPG.Cleanup.moveAction"] };
        const label = { en: key => game.i18n.has(key) ? game.i18n.localize(key) : null,
            pl: key => key.split(".").reduce((o, k) => o?.[k], pl) ?? null };
        let read = 0; const missing = [];
        for (const lang of ["en", "pl"]) for (const [book, keys] of Object.entries(KEYS)) {
            const text = await get("docs/handbooks/" + book + "-handbook." + lang + ".md");
            if (!text) { missing.push(book + "." + lang + " not read"); continue; }
            for (const key of keys) {
                read++;
                const words = label[lang](key);
                if (typeof words !== "string" || !text.includes("**" + words)) missing.push(book + "." + lang + " " + key + ": " + words);
            }
        }
        return { lang: game.i18n.lang, read, missing };`, { timeout: 30000 });
    verdict("the handbooks name the Tamper menu's three choices, Observe's five ways of looking and Stage 6's actions by the labels the module draws, in English and in Polish",
        lBooks.lang === "en" && lBooks.read === 22 && lBooks.missing.length === 0, J(lBooks));

    /* ------------------------------ every phase measured ------------------------------ */

    for (const letter of ["A", "O", "N", "T", "V", "D", "K", "P", "E", "L"]) {
        check(`${letter}0: phase ${letter} measured something`, (counts[letter] ?? 0) > 0, J(counts));
    }
    await disconnect("gm2");
    return { phases: Object.keys(counts) };
}
