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
 *   V  (E09 C2) the GM's verdicts on the tied trace reach the copies: a Faint reaches both
 *      copies' answer keys on both GMs and the item of p1's analysed copy, not p2's; and p2's
 *      console gives its unanalysed copy `analyzed`, the GM rewrites the trace's reading as
 *      it hears that, and the primary's put-back is held until the edit has run - p2 reads no
 *      reading, both GMs' copies hold none, the answer key and p1's copy hold it. On the code
 *      before C2 (08.10.2026) both failed: the Faint reached no key, and p2's copy read the
 *      new reading, put back to unanalysed, with both GMs' copies holding it.
 *   D  (E09 C3) the Investigation Dashboard stands open on the GM with a name typed into the
 *      Faint trace's row when gm2 approves a reshape of that trace: the GM's window redraws
 *      (the words show the reshape, the typed name stays and is marked with the reshaped
 *      one), and the GM's Save refuses the name and says so once - both GMs keep the reshape.
 *   K  (E09 C7) a chapter-2 trial after a chapter-1 plan: a case of three closed in chapter 2
 *      (its row), two of its Keys found by the living, and the trial entered through the clock
 *      twice - without a Save of the planner for chapter 2, then after one - moves both GMs'
 *      Monokuma pools by 3 each time. Before C7 the first charged nothing (the plan's rows were
 *      another chapter's: too late) and the second 6 (a bar of four).
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
 * With E09 C2's phase V, 23 checks in 6.6 s (the cluster's own count, 08.10.2026); with E09
 * C3's phase D, 28 in 8.9 s (the same count, one run, 08.10.2026); with E09 C7's phase K, 31 in
 * 11.8 s (17.6 s with the cluster's start, one run, 08.10.2026).
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
    rewritten: "S62 rewritten reading", typed: "S62 typed name", dName: "S62 D reshaped name", dText: "S62 D reshaped words"
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

    /* ------------------------------ D. the dashboard under a ruling ------------------------------ */

    begin("D", "gm2 approves a reshape while the GM's dashboard stands open with a name typed in its row", "trace-remnant");
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
    const ruled = await gm2.eval(`const Cl = await import("${repoUrl}/scripts/cleanup.mjs");
        return await Cl.applyReshapeRuling({ actorId: "${IDS.botan}", tokenId: "${ids.faint}", name: ${J(MARK.dName)}, text: ${J(MARK.dText)} });`, { timeout: 30000 });
    verdict("the dashboard is open on the GM with a name typed in the Faint trace's row, and gm2's ruling is honoured",
        typed.open && typed.listed && ruled === true, J({ typed, ruled }));
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

    for (const letter of ["A", "O", "N", "T", "V", "D", "K", "E"]) {
        check(`${letter}0: phase ${letter} measured something`, (counts[letter] ?? 0) > 0, J(counts));
    }
    await disconnect("gm2");
    return { phases: Object.keys(counts) };
}
