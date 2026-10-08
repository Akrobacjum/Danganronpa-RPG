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
 *   O  p1 focuses its gaze (Observe, "specific"): the primary GM's pick dialog lists the
 *      room's traces and is answered with the tied one, its description dialog with three
 *      markers; p1 holds one copy of that trace, without the reading, and p1's thread holds
 *      no GM body (S05-34, asserted closed).
 *   N  p1 Analyzes the copy: read on p1, it shows its type and the reading the GM wrote.
 *   T  p2 finds the same trace (a general Observe) and reshapes it (Tamper, "transform");
 *      the GM approves the card, and p1's copy is renamed with it - today's behaviour, the
 *      line E09 C9 flips (a reshape leaves the copies already held).
 *   E  (E09 C1) the chapter ends: the GM gives p1's student an unanalysed Faint, a Neutral and
 *      a Final; the Investigation Dashboard's "Sweep Truth Bullets" confirm (answered no) and
 *      the End of chapter panel (its sweep alone ticked) each give the number the sweep then
 *      takes, counted over every student's bullets on the GM, and the Faint and the Final stay.
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
    request: "S62 the cup on the desk", reshapedName: "S62 reshaped name", reshapedText: "S62 reshaped words"
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

    begin("O", "p1 focuses its gaze; the primary picks the trace and describes it", "search-observe");
    await gm.eval(`globalThis.__s62 = { windows: globalThis.__dialogWindows, picks: [], other: [] };
        globalThis.__dialogWindows = true;
        const describe = game.i18n.localize("DRPG.Observe.describeTitle");
        const answer = cfg => {
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
        };
        globalThis.__dialogAnswers.push(answer, answer);
        return true;`);
    const observed = await p1.eval(`${until} ${TB}
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
        return { err, left0, left: game.drpg.actionsLeft(actor), copies: TB.bulletsOf(actor).length,
            copy: data ? { id: copy.id, name: data.name, playerText: data.playerText, analyzedText: data.analyzedText, shownType: data.shownType,
                words: JSON.stringify(copy.toObject()).includes(${J(MARK.analyzed)}) } : null,
            fresh: fresh.length, gmBodies: fresh.filter(m => String(contentOf(m) ?? "").includes("drpg-gm-only")).length,
            dialogs: globalThis.__dialogLog.map(d => d.title).slice(-6) };`, { timeout: 90000 });
    const picked = await gm.eval(`${TB} const s = globalThis.__s62, out = { picks: s.picks, other: s.other };
        globalThis.__dialogWindows = s.windows; globalThis.__dialogAnswers.length = 0;
        out.remnants = TB.bulletsOf(game.actors.get("${IDS.aiko}")).map(i => TB.secretOf(i.uuid)?.remnantId ?? null);
        return out;`);
    verdict("the primary's pick lists the room's three traces and nothing else asked it a question",
        picked.picks.length === 1 && picked.picks[0].length === 3 && picked.other.length === 0, J(picked));
    verdict("p1 spent one action and holds one copy, of the tied trace, under the words the GM wrote",
        !observed.err && observed.left === observed.left0 - 1 && observed.copies === 1 && J(picked.remnants) === J([ids.tied])
            && observed.copy?.name === MARK.name && observed.copy?.playerText === MARK.playerText, J({ observed, remnants: picked.remnants }));
    verdict("p1's copy holds no reading yet: not as its reading, not anywhere in the item",
        observed.copy && observed.copy.analyzedText === "" && observed.copy.words === false, J(observed.copy));
    verdict("p1's thread grew and holds no GM body (S05-34 stays closed)",
        observed.fresh > 0 && observed.gmBodies === 0, J({ fresh: observed.fresh, gmBodies: observed.gmBodies }));

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

    begin("T", "p2 reshapes the trace p1 holds; the GM approves", "trace-remnant");
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

        const approved = await gm.eval(`${until}
            const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
            const { wireCallActions } = await import("${repoUrl}/scripts/messenger-app.mjs");
            const find = () => game.messages.contents.find(m => !globalThis.__s62had.has(m.id) && String(contentOf(m) ?? "").includes('data-drpg-call="approveReshape"'));
            const card = await until(find, 20000);
            let clicked = false;
            if (card) {
                const body = document.createElement("div");
                body.innerHTML = contentOf(card);
                wireCallActions(body, card);
                const button = body.querySelector('[data-drpg-call="approveReshape"]');
                button?.click();
                clicked = Boolean(button);
            }
            return { card: Boolean(card), clicked };`, { timeout: 60000 });
        verdict("the GM is shown the reshape and approves it from the card", approved.card && approved.clicked, J(approved));

        const renamed = await p1.eval(`${until} ${TB}
            const copy = TB.bulletsOf(game.actors.get("${IDS.aiko}"))[0];
            await until(() => copy?.name === ${J(MARK.reshapedName)}, 15000);
            const data = copy ? TB.truthBulletData(copy) : null;
            return { name: data?.name ?? null, playerText: data?.playerText ?? null };`, { timeout: 30000 });
        // Today's renaming (propagateRemnantPublic): E09 C9 flips this to "a reshape leaves the copies already held".
        verdict("p1's copy, found before the reshape, now reads the reshaped name and words (today's renaming; C9 flips it)",
            renamed.name === MARK.reshapedName && renamed.playerText === MARK.reshapedText, J(renamed));
        const thread = await p2.eval(`const { contentOf } = await import("${repoUrl}/scripts/secret.mjs");
            const fresh = game.messages.contents.filter(m => !globalThis.__s62had.has(m.id));
            return { fresh: fresh.length, gmBodies: fresh.filter(m => String(contentOf(m) ?? "").includes("drpg-gm-only")).length };`);
        verdict("p2's thread holds no GM body of the reshape card", thread.gmBodies === 0, J(thread));
    } finally {
        await move({ x: 300, y: 300 }, { x: 1300, y: 300 });
    }

    /* ------------------------------ E. the chapter's end ------------------------------ */

    begin("E", "the chapter ends with an unanalysed Faint, a Neutral and a Final on p1's student", "truth-bullets");
    // The dashboard's confirm is answered no, the End of chapter panel with its sweep alone; both read before.
    const ended = await gm.eval(`${TB} const C = await import("${repoUrl}/scripts/chapter.mjs");
        const I = await import("${repoUrl}/scripts/investigation.mjs"), { getClock } = await import("${repoUrl}/scripts/clock.mjs");
        const actor = game.actors.get("${IDS.aiko}"), made = [];
        for (const [name, data] of [["Faint", { faint: true }], ["Neutral", {}], ["Final", { realType: "final" }]]) {
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

    /* ------------------------------ every phase measured ------------------------------ */

    for (const letter of ["A", "O", "N", "T", "E"]) {
        check(`${letter}0: phase ${letter} measured something`, (counts[letter] ?? 0) > 0, J(counts));
    }
    await disconnect("gm2");
    return { phases: Object.keys(counts) };
}
