/**
 * 58-case-two-gms: the investigation, the trial and the chapter's end at a table of two full GMs and the players
 * (2.0 line T3, 27.11.2026; docs/dev/v2/LINE-T3.md, decision D2-27). Whichever full GM presses a button, the same thing
 * happens, and a refusal tells its real reason to the GM who pressed.
 *
 * The seed's GM and three players, and `gm2`, a second Gamemaster declared late whose id sorts after the seed GM's, so
 * the seed GM stays the primary while both are connected (utils.mjs `primaryGmId`), as in 97-two-gms. Every check reads
 * something the run made happen first, and says so in its own condition. Each part is named by the line's item it
 * measures.
 *
 * Parts, in the order they run:
 *   TRIAL-02  gm2 presses Finish the chapter's end with no end stopped: the primary refuses with
 *             `DRPG.Chapter.notStopped`, and that reason is a toast on gm2's screen, none on gm's.
 *   TRIAL-01  an end of the chapter the primary's reload cut: gm's record "applying" by gm, as its page leaves it when
 *             it reloads inside the end (written by the scenario: a reload timed inside a step is not something this
 *             harness can aim), then gm reloads; at its ready gm marks it halted, gm2 reads it stopped, its End of
 *             chapter window asks Finish the chapter's end or Drop the rest, and gm2's Finish is carried out on gm.
 *   TRIAL-03  a verdict gm gave, stopped (its overflow step left, its GM marked failed there): gm2's Finish the verdict
 *             is granted by gm in seconds, with no "no answer", and the steps run on gm2 - the verdict's summary to the
 *             GMs is posted by gm2's browser, the record's `by` gm2. The step left is the Overflow's alone: a Level Up
 *             step would hand out Level Ups this scenario could not put back, so where the Level Ups' window opens is
 *             read as where the steps run (the window opens in `runVerdict`'s step, verdict.mjs `verdictLevelUps`).
 *   PRIM-06   the same verdict given by gm2, a step failed, gm2 connected: gm's Finish takes it and the steps run on gm.
 *   TRIAL-04  gm2 opens Reset the season, its window drawn on gm2 (its answer given as the Reset button gives it: the word
 *             typed and one group ticked, the pre-session notes, which this world has none of), and the reset runs on
 *             gm: gm2 reads the report's groups, the reset's record is gm's, gm2 is told no refusal.
 *   INV-01    a find waiting on its words on gm (a trace placed in Dorm A, Aiko's find's window opened as an Observe's
 *             resolution opens it, observe.mjs `describeFind`, on a row of the GMs' store): the same window opens on gm2
 *             from the row, gm2 answers it, and the find takes gm2's words. The Observe is not thrown: its row is written
 *             as `scoreObserve` writes it, so what is read is the ask and its answer, not a roll.
 *   INV-02    the same with gm answering first (its window's answer given after 2.5 s): gm2's window, drawn and left,
 *             closes, gm2 is told whose words went out under what name, and after gm2's reload its whisper's Write it
 *             here is not drawn.
 *   INV-05    the same with nobody answering (a 1.5 s clock): gm2's window closes saying so, and gm2 holds the GMs' card
 *             that names the find.
 *   INV-04    gm leaves; gm2, the primary meanwhile, scores Aiko's General Observe and its find waits on gm2's window;
 *             gm comes back as the primary: its hydration finishes no row of a connected GM's window (no recovery card),
 *             the find goes out once, and p1 is told no "already held". Headless, gm's own window for the row (INV-01's)
 *             presses its default button as it opens - the prefilled name - so the words that go out are that window's,
 *             not the words gm2's window was given; at a table a person reads it first.
 *   INV-07    gm drops every keys.charge packet (a primary that does not answer), and gm2 asks the Key fee as a trial's
 *             opening asks it (key-remnants.mjs `askToChargeForUnfoundKeys`, which clock.mjs `reconcilePhase` calls - the
 *             rest of the opening is not run): gm2 holds a held fee's card with Charge the Key fee; gm answers again, the
 *             button pressed twice charges the fee once. The trial's record, the pools and the plan's rows are put back.
 *   INV-12    gm drops every observe.resolve packet (a primary gone before it answered), and p1 sweeps the room with Aiko
 *             (a General Observe, its declaration answered as the window's): p1's roll card says the action is spent and
 *             the GMs settle it by hand, and gm2 holds the GMs' card (`resolve.lost`, run on gm, which still answers that).
 *   TRIAL-07  Daichi sentenced in this chapter's record; gm drops every trial.record packet, and gm2 asks the execution as
 *             a trial's end asks it (vote.mjs `executeAtExit`; the rest of the end is not run): gm2 holds the GMs' card
 *             with Carry out the sentence again; gm answers again, the button pressed twice executes Daichi once on gm.
 *             Daichi is brought back and the record put back.
 *   TRIAL-08  gm2 starts the Class Trial through the clock (`setClock`, as every road in does) with its actor writes
 *             held (`Actor.prototype.update` never answers on gm2, so its entry stops inside the budget, the first step,
 *             marked started), and reloads: gm, the primary, finishes the entry when gm2 leaves (clock.mjs
 *             `finishPhaseSteps`) - the record reset (a planted `verdictApplied` blanked), the dead's list written
 *             (`mutedDead`), the fee stamped - and does not hand out the budget again (Aiko's actions, spent to 0, stay
 *             0): the row says the budget failed, and the GMs are told on gm. The clock, the record, the budgets, the
 *             pools, the rows and the whispers are put back, raw (no `setClock` back out, which would run the exit).
 *
 * What this cannot see: a real server's delivery times and a real F5 (97-two-gms's header says what its `reload` is).
 */
export const layers = ["ci"];

export const accounts = [
    { who: "gm2", id: "USERGM2T3C580000", name: "Second GM", role: 4, character: null, color: "#66aaff", late: true }
];

const J = value => JSON.stringify(value);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Poll `read` until `done(value)` or `ms` pass; the last reading either way. */
async function until(read, done, ms = 6000, step = 150) {
    const end = Date.now() + ms;
    let value = await read();
    while (!done(value) && Date.now() < end) {
        await wait(step);
        value = await read();
    }
    return value;
}

export async function run(api) {
    const { gm, gm2, p1, check, phase, settle, connect, disconnect, reload, primaryOn, repoUrl: REPO, IDS } = api;
    const MOD = "danganronpa-rpg";
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const GM2 = accounts[0].id;
    const allRead = (on, id) => Object.keys(on).length >= 5 && Object.values(on).every(v => v === id);
    const toastsSince = (who, mark) => who.eval(`return globalThis.__notifications.slice(${mark}).map(n => [n.level, n.msg]);`);
    const toastMark = who => who.eval(`return globalThis.__notifications.length;`);

    phase("0 gm2 joins");
    await connect("gm2");
    const joined = await until(primaryOn, on => Object.keys(on).length === 5);
    check("0: gm2, whose id sorts after the seed GM's, joins and every client reads the seed GM as the primary",
        GM2 > IDS.gm && allRead(joined, IDS.gm), J(joined));
    await settle(1000);

    /* ------------------------------------------------------------- TRIAL-02 */
    phase("TRIAL-02 a relayed refusal says its reason to the GM who pressed");
    const notStopped = await gm2.eval(`return game.i18n.localize("DRPG.Chapter.notStopped");`);
    const stoppedNow = await gm.eval(`const C = ${imp("chapter.mjs")}; return Boolean(C.chapterEndStopped());`);
    const [m1, m2] = [await toastMark(gm), await toastMark(gm2)];
    const finished = await gm2.eval(`const C = ${imp("chapter.mjs")}; return await C.finishChapterEnd() ?? null;`, { timeout: 60000 });
    await settle(800);
    const onGm2 = await toastsSince(gm2, m2), onGm = await toastsSince(gm, m1);
    check("TRIAL-02: gm2's Finish the chapter's end with no end stopped is refused on the primary, and gm2 is shown why (DRPG.Chapter.notStopped); the primary shows no toast",
        stoppedNow === false && finished === null && onGm2.some(([level, msg]) => level === "warn" && msg === notStopped)
            && onGm.length === 0, J({ stoppedNow, finished, onGm2, onGm }));

    /* ------------------------------------------------------------- TRIAL-01 */
    phase("TRIAL-01 an end the primary's reload cut, seen stopped and finished from gm2");
    const clockWas = await gm.eval(`const K = ${imp("clock.mjs")}; const c = K.getClock(); await K.setClock({ phase: "dailyLife" });
        return { chapter: c.chapter, session: c.session, day: c.day ?? 1, phase: c.phase, timeOfDay: c.timeOfDay ?? null };`, { timeout: 60000 });
    const cut = await gm.eval(`const K = ${imp("clock.mjs")}; const c = K.getClock();
        const choices = { reveal: false, sweep: false, faint: false, keys: false, endTrial: false, nextChapter: false, nextSession: false, nextMorning: true };
        await game.settings.set("${MOD}", "chapterEnd", { stage: "applying", by: game.user.id, at: Date.now(), opened: null, choices, done: [], failed: [], notRun: [],
            ending: { chapter: c.chapter, session: c.session, day: c.day ?? 1, phase: "dailyLife", stands: "dailyLife" } });
        return { day: c.day ?? 1 };`, { timeout: 60000 });
    const seenBefore = await until(() => gm2.eval(`const C = ${imp("chapter.mjs")}; return game.settings.get("${MOD}", "chapterEnd")?.stage ?? null;`), v => v === "applying");
    const runningOnGm2 = await gm2.eval(`const C = ${imp("chapter.mjs")}; return C.chapterEndStopped() === null;`);
    const r1 = await reload("gm");
    await until(primaryOn, on => allRead(on, IDS.gm));
    const halted = await until(() => gm2.eval(`return game.settings.get("${MOD}", "chapterEnd")?.halted ?? null;`), v => Boolean(v), 10000);
    const endTitle = await gm2.eval(`return game.i18n.localize("DRPG.Chapter.endTitle");`);
    const asked = await gm2.eval(`const C = ${imp("chapter.mjs")};
        const stopped = Boolean(C.chapterEndStopped());
        const mark = globalThis.__dialogLog.length;
        globalThis.__dialogAnswers.push("finish");
        const out = await C.openChapterEndDialog();
        const windows = globalThis.__dialogLog.slice(mark).map(d => ({ title: d.title, buttons: d.buttons }));
        return { stopped, lines: Array.isArray(out) ? out.length : out, windows };`, { timeout: 90000 });
    await settle(1000);
    const after = await until(() => gm.eval(`const K = ${imp("clock.mjs")}; const r = game.settings.get("${MOD}", "chapterEnd") ?? {};
        return { stage: r.stage ?? null, halted: "halted" in r, day: K.getClock().day ?? 1 };`), v => v?.stage === "done");
    check("TRIAL-01: an end gm's reload cut reads as running on gm2 before the reload, is marked halted at gm's ready, and gm2 sees it stopped: its window asks Finish or Drop, and gm2's Finish is carried out on gm, once (the next morning moved one day, the record done, the mark gone)",
        seenBefore === "applying" && runningOnGm2 === true && r1.back === true && halted?.why === "reload" && asked.stopped === true
            && asked.windows.some(w => w.title === endTitle && w.buttons.includes("finish") && w.buttons.includes("drop"))
            && after.stage === "done" && after.halted === false && after.day === cut.day + 1,
        J({ seenBefore, runningOnGm2, r1, halted, asked, after, cut }));
    await gm.eval(`const K = ${imp("clock.mjs")}; await K.setClock(${J(clockWas)}); await game.settings.set("${MOD}", "chapterEnd", {}); return true;`, { timeout: 60000 });
    await settle(1000);

    /* ------------------------------------------------------- TRIAL-03, PRIM-06 */
    phase("TRIAL-03 and PRIM-06 a stopped verdict taken on the primary, its steps where Finish was pressed");
    const trialWas = await gm.eval(`return foundry.utils.deepClone(game.settings.get("${MOD}", "trialProgress") ?? {});`);
    const verdictTitle = await gm.eval(`return game.i18n.localize("DRPG.Vote.verdictTitle");`);
    const stopAt = (by, failed) => gm.eval(`const V = ${imp("vote.mjs")}, K = ${imp("clock.mjs")};
        await game.settings.set("${MOD}", "trialProgress", { ...V.trialProgress(), chapter: K.getClock().chapter, verdictApplied: true, voteClosed: true,
            executedAt: null, execution: null, verdict: { stage: "applying", correct: true, executedIds: [], by: ${J(by)}, at: Date.now(),
            done: ["sentence", "executions", "card", "levelUps", "offers", "despair", "rule", "remind"], failed: ${J(failed)} } });
        return V.trialProgress().verdict?.by ?? null;`, { timeout: 60000 });
    const SUMMARY = mark => `const S = ${imp("secret.mjs")};
        const out = [];
        for (const m of game.messages.contents.slice(${mark})) {
            const w = await S.wordsOf(m, 1000);
            if (String(w ?? "").includes(${J(verdictTitle)})) out.push(m.author?.id ?? m.user?.id ?? null);
        }
        return out;`;
    const msgMark = await gm.eval(`return game.messages.contents.length;`);
    await stopAt(IDS.gm, ["overflow"]);
    await until(() => gm2.eval(`const V = ${imp("vote.mjs")}; return V.verdictStopped() ? true : false;`), v => v === true);
    const t2Mark = await toastMark(gm2);
    const t0 = Date.now();
    const f2 = await gm2.eval(`const V = ${imp("vote.mjs")}; const out = await V.finishVerdict(); return Array.isArray(out) ? out.length : out;`, { timeout: 120000 });
    const f2Ms = Date.now() - t0;
    await settle(1500);
    const f2Toasts = await toastsSince(gm2, t2Mark);
    const noAnswer = await gm2.eval(`return game.i18n.localize("DRPG.Bridge.why.noAnswer");`);
    const authors3 = await until(() => gm.eval(SUMMARY(msgMark)), v => v.length >= 1);
    const rec3 = await gm.eval(`const V = ${imp("vote.mjs")}; const v = V.trialProgress().verdict ?? {}; return { stage: v.stage ?? null, by: v.by ?? null };`);
    check("TRIAL-03: gm2's Finish of a verdict gm gave, stopped, is granted on gm in seconds with no \"no answer\", and the steps run on gm2: the summary is gm2's, the record done by gm2",
        typeof f2 === "number" && f2Ms < 30000 && !f2Toasts.some(([, msg]) => msg.includes(noAnswer)) && J(authors3) === J([GM2])
            && rec3.stage === "done" && rec3.by === GM2, J({ f2, f2Ms, f2Toasts, authors3, rec3 }));

    const msgMark6 = await gm.eval(`return game.messages.contents.length;`);
    await stopAt(GM2, ["overflow"]);
    await until(() => gm.eval(`const V = ${imp("vote.mjs")}; return V.verdictStopped() ? true : false;`), v => v === true);
    const f6 = await gm.eval(`const V = ${imp("vote.mjs")}; const out = await V.finishVerdict(); return Array.isArray(out) ? out.length : out;`, { timeout: 120000 });
    await settle(1500);
    const authors6 = await until(() => gm.eval(SUMMARY(msgMark6)), v => v.length >= 1);
    const rec6 = await gm.eval(`const V = ${imp("vote.mjs")}; const v = V.trialProgress().verdict ?? {}; return { stage: v.stage ?? null, by: v.by ?? null };`);
    check("PRIM-06: gm's Finish of a verdict gm2 gave, a step failed and gm2 connected, takes it and runs the steps on gm: the summary is gm's, the record done by gm",
        typeof f6 === "number" && J(authors6) === J([IDS.gm]) && rec6.stage === "done" && rec6.by === IDS.gm, J({ f6, authors6, rec6 }));
    await gm.eval(`await game.settings.set("${MOD}", "trialProgress", ${J(trialWas)}); return true;`, { timeout: 60000 });
    await settle(1000);

    /* ------------------------------------------------------------- TRIAL-04 */
    phase("TRIAL-04 a second GM's reset of the season, run on the primary");
    const recordWas = await gm.eval(`return foundry.utils.deepClone(game.settings.get("${MOD}", "seasonReset") ?? {});`);
    const t4Mark = await toastMark(gm2);
    const reset4 = await gm2.eval(`const S = ${imp("season-setup.mjs")};
        const word = game.i18n.localize("DRPG.Season.resetWord");
        const mark = globalThis.__dialogLog.length;
        globalThis.__dialogAnswers.push({ word, ticked: ["preNotes"], cast: { to: "stay" } });
        const out = await S.resetSeason();
        const drawn = globalThis.__dialogLog.slice(mark).map(d => d.title);
        return { cleared: out?.cleared ?? null, drawn };`, { timeout: 180000 });
    await settle(1500);
    const resetTitle = await gm2.eval(`return game.i18n.localize("DRPG.Season.resetTitle");`);
    const t4Toasts = await toastsSince(gm2, t4Mark);
    // The reset's record names the browser that ran it (season-wipe.mjs `wipeSeason`): the primary's.
    const record4 = await gm.eval(`const r = game.settings.get("${MOD}", "seasonReset") ?? {}; return { by: r.by ?? null, stage: r.stage ?? null, groups: r.groups ?? null };`);
    check("TRIAL-04: gm2's Reset the season draws its window on gm2 and runs on gm from the plan gm2 sent: the groups cleared answered to gm2, the reset's record gm's, no refusal on gm2",
        J(reset4.cleared) === J(["preNotes"]) && reset4.drawn.includes(resetTitle) && record4.by === IDS.gm && J(record4.groups) === J(["preNotes"])
            && !t4Toasts.some(([level]) => level === "warn"), J({ reset4, record4, t4Toasts, recordWas: Boolean(recordWas) }));

    /* -------------------------------------------------------- INV-01, INV-02, INV-05 */
    phase("INV-01 INV-02 INV-05 a find's describe window on both GMs");
    const describeTitle = await gm.eval(`return game.i18n.localize("DRPG.Observe.describeTitle");`);
    const WINDOWS = `[...foundry.applications.instances.values()].filter(a => a.rendered && a.options?.window?.title === ${J(describeTitle)})`;
    // gm opens a find's window on a row (`describeFind` with the row's key), as `scoreObserve` would: answered as `answerOnGm` says.
    const openFind = (tag, { waitMs = 30000, answerOnGm = null, drawnOnGm = true } = {}) => gm.eval(`const R = ${imp("remnants.mjs")}, OB = ${imp("observe.mjs")};
        const scene = canvas.scene, t = await R.placeRemnant({ type: "prep", visibility: "evident", scene, x: 400, y: 400, room: "Dorm A", note: "58 ${tag}" });
        if (!t) return null;
        globalThis.__s58Was ??= globalThis.__dialogWindows;
        globalThis.__dialogWindows = ${drawnOnGm ? "true" : "false"};
        ${answerOnGm ? `globalThis.__dialogAnswers.push(async () => { await new Promise(r => setTimeout(r, ${answerOnGm.after})); return ${J(answerOnGm.words)}; });` : ""}
        const key = "s58-${tag}-" + foundry.utils.randomID(6);
        const entry = { actorId: "${IDS.aiko}", sceneId: scene.id, tokenId: t.id, room: "Dorm A", at: Date.now(),
            data: R.remnantData(R.remnantById(scene.id, t.id)),
            describing: { at: Date.now(), total: 15, isCritical: false, rollId: null, by: null, gm: game.user.id } };
        globalThis.__s58 = { done: false, answer: null };
        OB.describeFind(game.actors.get("${IDS.aiko}"), entry, false, "58 ${tag} fallback", null, { waitMs: ${waitMs}, key })
            .then(a => { globalThis.__s58 = { done: true, answer: a }; }, e => { globalThis.__s58 = { done: true, answer: "threw " + e }; });
        return { token: t.id, key };`, { timeout: 60000 });
    const closeFind = placed => gm.eval(`const R = ${imp("remnants.mjs")}, OB = ${imp("observe.mjs")};
        for (const app of ${WINDOWS}) await app.close().catch(() => {});
        globalThis.__dialogWindows = globalThis.__s58Was; delete globalThis.__s58Was; globalThis.__dialogAnswers.length = 0;
        await OB.clearPendingObserves();
        const t = canvas.scene.tokens.get(${J(placed?.token ?? "")}); if (t) { await R.dropRemnantSecret(t); await t.delete(); }
        return true;`, { timeout: 60000 });
    const gm2Windows = () => gm2.eval(`return ${WINDOWS}.length;`);

    // INV-01: gm2's window from the row, answered by gm2, and the find takes gm2's words.
    const W2 = { name: "58 INV-01 gm2's name", playerText: "58 INV-01 what gm2 wrote", analyzedText: "" };
    await gm2.eval(`globalThis.__s58Log = globalThis.__dialogLog.length; globalThis.__dialogAnswers.push(${J(W2)}); return true;`);
    const placed1 = await openFind("INV01");
    const waited1 = await until(() => gm.eval(`return globalThis.__s58;`), v => v?.done === true, 15000);
    const asked1 = await gm2.eval(`return globalThis.__dialogLog.slice(globalThis.__s58Log).filter(d => d.title === ${J(describeTitle)}).length;`);
    await closeFind(placed1);
    await gm2.eval(`globalThis.__dialogAnswers.length = 0; return true;`);
    check("INV-01: a find waiting on its words on gm opens the same window on gm2 from the row; gm2 answers it, and the find takes gm2's words",
        Boolean(placed1) && asked1 === 1 && waited1?.done === true && waited1.answer?.name === W2.name && waited1.answer?.playerText === W2.playerText,
        J({ placed1, asked1, waited1 }));
    await settle(800);

    // INV-02: gm answers first; gm2's drawn window closes with whose words, and its whisper's button is gone after a reload.
    const W1 = { name: "58 INV-02 gm's name", playerText: "58 INV-02 what gm wrote", analyzedText: "" };
    await gm2.eval(`globalThis.__s58Was = globalThis.__dialogWindows; globalThis.__dialogWindows = true; return true;`);
    const n2 = await toastMark(gm2);
    const placed2 = await openFind("INV02", { answerOnGm: { after: 2500, words: W1 }, drawnOnGm: false });
    const open2 = await until(gm2Windows, n => n === 1, 6000);
    const waited2 = await until(() => gm.eval(`return globalThis.__s58;`), v => v?.done === true, 15000);
    const closed2 = await until(gm2Windows, n => n === 0, 6000);
    const takenBy = await gm2.eval(`return game.i18n.format("DRPG.Observe.describeTakenBy", { gm: game.users.get("${IDS.gm}")?.name ?? "?",
        actor: game.actors.get("${IDS.aiko}")?.name ?? "?", name: ${J(W1.name)} });`);
    const told2 = (await toastsSince(gm2, n2)).filter(([, msg]) => msg === takenBy).length;
    await gm2.eval(`globalThis.__dialogWindows = globalThis.__s58Was; delete globalThis.__s58Was; return true;`);
    const r2 = await reload("gm2");
    await until(primaryOn, on => allRead(on, IDS.gm));
    const button2 = await until(() => gm2.eval(`const S = ${imp("secret.mjs")}, OB = ${imp("observe.mjs")};
        const card = game.messages.contents.find(m => String(S.contentOf(m) ?? "").includes(${J(placed2?.token ?? "?")}) && String(S.contentOf(m) ?? "").includes("data-drpg-describe-find"));
        if (!card) return null;
        const body = document.createElement("div"); body.innerHTML = S.contentOf(card); document.body.append(body);
        OB.wireDescribeHere(body);
        const left = Boolean(body.querySelector("[data-drpg-describe-find]")); body.remove();
        return { left };`), v => v !== null, 10000);
    await closeFind(placed2);
    check("INV-02: gm answers first: gm2's window, drawn and left, closes, gm2 is told whose words went out under what name, and after gm2's reload its whisper's Write it here is not drawn",
        Boolean(placed2) && open2 === 1 && waited2?.answer?.name === W1.name && closed2 === 0 && told2 === 1 && r2.back === true && button2?.left === false,
        J({ placed2, open2, waited2, closed2, told2, r2, button2 }));
    await settle(800);

    // INV-05: nobody answers; gm2's window closes saying so, and gm2 holds the GMs' card naming the find.
    await gm2.eval(`globalThis.__s58Was = globalThis.__dialogWindows; globalThis.__dialogWindows = true; globalThis.__s58Had = new Set(game.messages.contents.map(m => m.id)); return true;`);
    const n5 = await toastMark(gm2);
    const placed5 = await openFind("INV05", { waitMs: 1500 });
    const open5 = await until(gm2Windows, n => n === 1, 6000);
    const waited5 = await until(() => gm.eval(`return globalThis.__s58;`), v => v?.done === true, 15000);
    const closed5 = await until(gm2Windows, n => n === 0, 6000);
    const timedOut = await gm2.eval(`return game.i18n.format("DRPG.Observe.describeTakenTimedOut", { actor: game.actors.get("${IDS.aiko}")?.name ?? "?", name: "58 INV05 fallback" });`);
    const told5 = (await toastsSince(gm2, n5)).filter(([, msg]) => msg === timedOut).length;
    const card5 = await until(() => gm2.eval(`const S = ${imp("secret.mjs")};
        return game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id) && String(S.contentOf(m) ?? "").includes("58 INV05 fallback")
            && !String(S.contentOf(m) ?? "").includes("data-drpg-describe-find")).length;`), n => n >= 1, 6000);
    await gm2.eval(`globalThis.__dialogWindows = globalThis.__s58Was; delete globalThis.__s58Was; delete globalThis.__s58Had; return true;`);
    await closeFind(placed5);
    check("INV-05: nobody answers a find's window in time: gm2's window closes saying so, and gm2 holds the GMs' card naming the find",
        Boolean(placed5) && open5 === 1 && waited5?.done === true && closed5 === 0 && told5 === 1 && card5 === 1,
        J({ placed5, open5, waited5, closed5, told5, card5 }));
    await settle(800);

    /* ----------------------------------------------------------------- INV-04 */
    phase("INV-04 the primary's hydration leaves a connected second GM's window");
    // gm leaves; gm2, the primary meanwhile, scores Aiko's Observe and its find waits on gm2's window; gm comes back.
    await disconnect("gm");
    const alone = await until(primaryOn, on => Object.keys(on).length === 4 && Object.values(on).every(v => v === GM2));
    const W4 = { name: "58 INV-04 gm2's name", playerText: "58 INV-04 what gm2 wrote", analyzedText: "" };
    const held4 = await p1.eval(`return game.i18n.localize("DRPG.Observe.alreadyHeld");`);
    const p1Had = await p1.eval(`globalThis.__s58Had = new Set(game.messages.contents.map(m => m.id)); return true;`);
    // the recovery's card to the GMs, by the longest run of its text between two fields
    const recovered4 = await gm2.eval(`globalThis.__s58Had = new Set(game.messages.contents.map(m => m.id));
        return game.i18n.localize("DRPG.Observe.describeRecovered").split(/\\{[^}]+\\}/).sort((a, b) => b.length - a.length)[0].trim().slice(0, 30);`);
    const started4 = await gm2.eval(`const R = ${imp("remnants.mjs")}, OB = ${imp("observe.mjs")};
        const actor = game.actors.get("${IDS.aiko}"), tok = canvas.scene.tokens.find(t => t.actorId === actor.id);
        if (!tok) return null;
        const t = await R.placeRemnant({ type: "prep", visibility: "evident", scene: canvas.scene, x: tok.x, y: tok.y, note: "58 INV04" });
        globalThis.__s58Items = new Set(actor.items.map(i => i.id));
        globalThis.__s58Log = globalThis.__dialogLog.length;
        globalThis.__s58Go = false;
        globalThis.__dialogAnswers.push(async () => { while (!globalThis.__s58Go) await new Promise(r => setTimeout(r, 100)); return ${J(W4)}; });
        const aimed = await OB.chooseObserveTarget({ actorId: actor.id, declaration: "general", userId: "${IDS.p1}", paid: true });
        if (!t || !aimed?.ok) return { token: t?.id ?? null, aimed: aimed ?? null };
        globalThis.__s58 = { done: false, answer: null };
        OB.resolveObserve({ key: aimed.key, total: 30, isCritical: false, actorId: actor.id, senderId: "${IDS.p1}", senderIsGm: false })
            .then(a => { globalThis.__s58 = { done: true, answer: a }; }, e => { globalThis.__s58 = { done: true, answer: "threw " + e }; });
        return { token: t.id, key: aimed.key, target: aimed.tokenId ?? null };`, { timeout: 60000 });
    const marked4 = await until(() => gm2.eval(`const { observeStore } = ${imp("gm-stores.mjs")};
        return observeStore.get(${J(started4?.key ?? "")})?.describing?.gm ?? null;`), v => v === GM2, 8000);
    await connect("gm");
    const back4 = await until(primaryOn, on => allRead(on, IDS.gm));
    await settle(2500);
    const after4 = await gm.eval(`const { observeStore } = ${imp("gm-stores.mjs")}; const row = observeStore.get(${J(started4?.key ?? "")});
        return { describing: Boolean(row?.describing), result: row?.result ?? null, described: row?.described ?? null, answeredBy: row?.describeAnswer?.by ?? null,
            asked: globalThis.__dialogLog.filter(d => d.title === game.i18n.localize("DRPG.Observe.describeTitle")).length };`);
    await gm2.eval(`globalThis.__s58Go = true; return true;`);
    const waited4 = await until(() => gm2.eval(`return globalThis.__s58;`), v => v?.done === true, 15000);
    await settle(1500);
    const bullets4 = await gm2.eval(`const actor = game.actors.get("${IDS.aiko}");
        return actor.items.filter(i => !globalThis.__s58Items.has(i.id)).map(i => i.name);`);
    const cards4 = await gm2.eval(`const S = ${imp("secret.mjs")};
        return game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id) && String(S.contentOf(m) ?? "").includes(${J(recovered4)})).length;`);
    const told4 = await p1.eval(`const S = ${imp("secret.mjs")};
        return game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id) && String(S.contentOf(m) ?? "").includes(${J(held4)})).length;`);
    await gm2.eval(`const R = ${imp("remnants.mjs")}, OB = ${imp("observe.mjs")}, B = ${imp("truth-bullets.mjs")};
        const actor = game.actors.get("${IDS.aiko}");
        for (const item of [...actor.items]) { if (globalThis.__s58Items?.has(item.id)) continue; const uuid = item.uuid; await item.delete().catch(() => {}); await B.dropSecret(uuid); }
        await OB.clearPendingObserves();
        const t = canvas.scene.tokens.get(${J(started4?.token ?? "")}); if (t) { await R.dropRemnantSecret(t); await t.delete(); }
        globalThis.__dialogAnswers.length = 0; delete globalThis.__s58Items; delete globalThis.__s58Go; delete globalThis.__s58Had; return true;`, { timeout: 60000 });
    await p1.eval(`delete globalThis.__s58Had; return true;`);
    /* Headless, gm's own window for the row (INV-01's, opened at its hydration) presses its default button as it opens
       - the prefilled name - where a person at a table would read it and write; so the words read are gm's window's,
       not gm2's, and what this part holds is that the find went out through a window and not through the recovery. */
    check("INV-04: a find waiting on gm2's window, opened while gm was away, stands through gm's return as the primary: gm's hydration does not finish it (no recovery card to the GMs), the find goes out once, through gm's window for the row, and p1 is told no 'already held'",
        p1Had === true && Object.keys(alone).length === 4 && Object.values(alone).every(v => v === GM2)
            && Boolean(started4?.key) && marked4 === GM2 && allRead(back4, IDS.gm) && Boolean(recovered4)
            && after4.asked === 1 && after4.answeredBy === IDS.gm && after4.described?.by === IDS.gm && after4.described?.timedOut === false
            && waited4?.done === true && waited4.answer?.success === true && bullets4.length === 1 && cards4 === 0 && told4 === 0,
        J({ alone, started4, marked4, after4, waited4, bullets4, cards4, told4 }));
    await settle(800);

    /* ----------------------------------------------------------------- INV-07 */
    phase("INV-07 an unanswered Key fee leaves gm2 a card that charges it");
    // gm drops every keys.charge packet, as a primary that does not answer; gm2 asks the fee as a trial's opening asks it.
    const kept7 = await gm.eval(`const V = ${imp("vote.mjs")}, D = ${imp("despair.mjs")}, { keyPlanStore } = ${imp("gm-stores.mjs")};
        globalThis.__s58Trial = structuredClone(game.settings.get("${MOD}", "trialProgress") ?? null);
        globalThis.__s58Despair = Object.fromEntries(D.monokumas().map(u => [u.id, D.getDespair(u.id)]));
        globalThis.__s58Plan = new Set(Object.keys(keyPlanStore.entries() ?? {}));
        const ch = "module.${MOD}", list = game.socket._handlers.get(ch) ?? [];
        globalThis.__s58Handlers = [...list];
        list.splice(0, list.length, ...list.map(fn => (packet, ...rest) => (packet?.action === "keys.charge" ? undefined : fn(packet, ...rest))));
        return { charged: Boolean(V.trialProgress().keysCharged), handlers: list.length };`);
    await gm2.eval(`globalThis.__s58Had = new Set(game.messages.contents.map(m => m.id)); return true;`);
    const asked7 = await gm2.eval(`const K = ${imp("key-remnants.mjs")}; return await K.askToChargeForUnfoundKeys() ?? null;`, { timeout: 120000 });
    const readCard7 = () => gm2.eval(`const S = ${imp("secret.mjs")};
        const card = game.messages.contents.find(m => !globalThis.__s58Had.has(m.id) && S.cardFlag(m, "keyChargeHeld"));
        return card ? { id: card.id, button: String(S.contentOf(card) ?? "").includes("data-drpg-key-charge") } : null;`);
    const card7 = await until(readCard7, v => v !== null, 6000);
    const notYet7 = await gm.eval(`const V = ${imp("vote.mjs")}; return Boolean(V.trialProgress().keysCharged);`);
    // gm answers again; gm2 presses the card's button twice, as its click does (`wireChargeHeld`).
    await gm.eval(`const list = game.socket._handlers.get("module.${MOD}"); list.splice(0, list.length, ...globalThis.__s58Handlers); delete globalThis.__s58Handlers; return true;`);
    const press7 = () => gm2.eval(`const K = ${imp("key-remnants.mjs")}; const card = game.messages.get(${J(card7?.id ?? "")});
        if (!card) return "no card";
        const el = document.createElement("div"); el.innerHTML = \`<div data-message-id="\${card.id}">\${(${imp("secret.mjs")}).contentOf(card)}</div>\`;
        document.body.append(el); K.wireChargeHeld(card, el.firstElementChild);
        const button = el.querySelector("[data-drpg-key-charge]"); const had = Boolean(button);
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 2500)); el.remove(); return had;`, { timeout: 60000 });
    const pressed7 = [await press7(), await press7()];
    const after7 = await until(() => gm.eval(`const V = ${imp("vote.mjs")}, D = ${imp("despair.mjs")};
        return { charged: Boolean(V.trialProgress().keysCharged), moved: D.monokumas().map(u => D.getDespair(u.id) - (globalThis.__s58Despair[u.id] ?? 0)) };`),
        v => v?.charged === true, 8000);
    await gm.eval(`const D = ${imp("despair.mjs")}, { keyPlanStore } = ${imp("gm-stores.mjs")};
        for (const [id, was] of Object.entries(globalThis.__s58Despair)) { const d = was - D.getDespair(id); if (d) await D.adjustDespair(id, d); }
        await game.settings.set("${MOD}", "trialProgress", globalThis.__s58Trial);
        for (const key of Object.keys(keyPlanStore.entries() ?? {})) if (!globalThis.__s58Plan.has(key)) await keyPlanStore.drop(key);
        delete globalThis.__s58Trial; delete globalThis.__s58Despair; delete globalThis.__s58Plan; return true;`, { timeout: 60000 });
    await gm2.eval(`for (const id of game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id)).map(m => m.id)) await game.messages.get(id)?.delete?.().catch(() => {});
        delete globalThis.__s58Had; return true;`, { timeout: 60000 });
    /* What a trial's opening does besides is not run: the fee is asked as `reconcilePhase` asks it (clock.mjs, on the GM who
       moved the phase), so the part reads the ask and its card, not the budget, the voices or the move to the hall. */
    check("INV-07: a Key fee gm does not answer leaves gm2 a held fee's card with Charge the Key fee; pressed twice once gm answers again, it is charged once",
        kept7.charged === false && kept7.handlers > 0 && asked7 === null && card7?.button === true && notYet7 === false
            // this world closed no case, so the fee is the whole bar short: 4 Key Remnants, 3 Despair each, 12 to each pool, 24 if charged twice
            && pressed7[0] === true && after7?.charged === true && after7.moved.length === 2 && after7.moved.every(d => d === 12),
        J({ kept7, asked7, card7, notYet7, pressed7, after7 }));
    await settle(800);

    /* ----------------------------------------------------------------- INV-12 */
    phase("INV-12 an Observe the primary never answered");
    // gm drops every observe.resolve packet, as a primary gone before it answered; p1 sweeps the room with Aiko.
    const unresolved12 = await p1.eval(`return game.i18n.localize("DRPG.Observe.unresolved");`);
    await gm.eval(`const list = game.socket._handlers.get("module.${MOD}") ?? [];
        globalThis.__s58Handlers = [...list];
        globalThis.__s58Actions = game.actors.get("${IDS.aiko}").system.resources.actions.value;
        list.splice(0, list.length, ...list.map(fn => (packet, ...rest) => (packet?.action === "observe.resolve" ? undefined : fn(packet, ...rest))));
        return true;`);
    await gm2.eval(`globalThis.__s58Had = new Set(game.messages.contents.map(m => m.id)); return true;`);
    const swept12 = await p1.eval(`globalThis.__s58Had = new Set(game.messages.contents.map(m => m.id));
        const actor = game.actors.get("${IDS.aiko}");
        globalThis.__dialogAnswers.push(() => ({ value: "general", form: { querySelector: () => ({ value: "" }) } }));
        globalThis.__forceRoll = { hope: 10, fear: 4 };
        let err = null;
        try { await Promise.race([game.drpg.performAction(actor, "observe", {}), new Promise(r => setTimeout(r, 90000))]); }
        catch (e) { err = String(e?.stack ?? e).slice(0, 300); }
        finally { delete globalThis.__forceRoll; globalThis.__dialogAnswers.length = 0; }
        const S = await import("${REPO}/scripts/secret.mjs");
        const lines = game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id) && String(S.contentOf(m) ?? "").includes(${J(unresolved12)})).length;
        return { err, lines };`, { timeout: 120000 });
    const card12 = await until(() => gm2.eval(`const S = ${imp("secret.mjs")};
        return game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id) && S.cardFlag(m, "gmPopup") && String(S.contentOf(m) ?? "").includes("Observe")
            && String(S.contentOf(m) ?? "").includes(game.actors.get("${IDS.aiko}")?.name ?? "?")).length;`), n => n >= 1, 10000);
    await gm.eval(`const list = game.socket._handlers.get("module.${MOD}"); list.splice(0, list.length, ...globalThis.__s58Handlers); delete globalThis.__s58Handlers;
        const OB = ${imp("observe.mjs")}; await OB.clearPendingObserves();
        const { trustedWrite } = ${imp("resource-guard.mjs")};
        await trustedWrite(game.actors.get("${IDS.aiko}"), { "system.resources.actions.value": globalThis.__s58Actions }, { reason: "gmRuling" });
        delete globalThis.__s58Actions; return true;`, { timeout: 60000 });
    for (const who of [gm2, p1]) await who.eval(`for (const id of game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id)).map(m => m.id)) {
            const m = game.messages.get(id); if (m?.isOwner) await m.delete().catch(() => {}); }
        delete globalThis.__s58Had; return true;`, { timeout: 60000 });
    check("INV-12: an Observe whose resolve gm never answers tells p1 the action is spent and the GMs settle it by hand, and gm2 holds the GMs' card about it",
        swept12?.err === null && swept12.lines === 1 && card12 === 1, J({ swept12, card12 }));
    await settle(800);

    /* ---------------------------------------------------------------- TRIAL-07 */
    phase("TRIAL-07 an execute the primary did not answer, carried out from gm2's card");
    // Daichi sentenced in this chapter's record; gm drops every trial.record packet, and gm2 asks the execution as a trial's end does.
    const set7 = await gm.eval(`const V = ${imp("vote.mjs")}, C = ${imp("clock.mjs")};
        globalThis.__s58Trial7 = structuredClone(game.settings.get("${MOD}", "trialProgress") ?? null);
        const chapter = C.getClock().chapter;
        await game.settings.set("${MOD}", "trialProgress", { ...V.trialProgress(chapter), chapter, verdictApplied: true,
            verdict: { stage: "done", correct: false, executedIds: ["${IDS.daichi}"], sentenced: ["${IDS.daichi}"], by: game.user.id, at: Date.now(),
                done: ["sentence", "card"], failed: [] }, executedAt: null, execution: null });
        const list = game.socket._handlers.get("module.${MOD}") ?? [];
        globalThis.__s58Handlers = [...list];
        list.splice(0, list.length, ...list.map(fn => (packet, ...rest) => (packet?.action === "trial.record" ? undefined : fn(packet, ...rest))));
        return { chapter };`);
    await settle(800);
    await gm2.eval(`globalThis.__s58Had = new Set(game.messages.contents.map(m => m.id)); return true;`);
    const asked07 = await gm2.eval(`const V = ${imp("vote.mjs")}; return await V.executeAtExit({ chapter: ${J(set7.chapter)} }) ?? null;`, { timeout: 120000 });
    const card07 = await until(() => gm2.eval(`const S = ${imp("secret.mjs")};
        const card = game.messages.contents.find(m => !globalThis.__s58Had.has(m.id) && S.cardFlag(m, "sentenceAgain") !== undefined && S.cardFlag(m, "sentenceAgain") !== null);
        return card ? { id: card.id, button: String(S.contentOf(card) ?? "").includes("data-drpg-sentence-again"), popup: Boolean(S.cardFlag(card, "gmPopup")) } : null;`), v => v !== null, 6000);
    const alive07 = await gm.eval(`const CH = ${imp("chapter.mjs")}; return !CH.isDeadForGm(game.actors.get("${IDS.daichi}"));`);
    await gm.eval(`const list = game.socket._handlers.get("module.${MOD}"); list.splice(0, list.length, ...globalThis.__s58Handlers); delete globalThis.__s58Handlers; return true;`);
    const press07 = () => gm2.eval(`const T = ${imp("trial-progress.mjs")}, S = ${imp("secret.mjs")};
        const card = game.messages.get(${J(card07?.id ?? "")}); if (!card) return "no card";
        const el = document.createElement("div"); el.innerHTML = S.contentOf(card); document.body.append(el);
        const wired = await T.wireSentenceAgain(card, el);
        el.querySelector("[data-drpg-sentence-again]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 3000)); el.remove(); return wired;`, { timeout: 60000 });
    const pressed07 = [await press07(), await press07()];
    const after07 = await until(() => gm.eval(`const V = ${imp("vote.mjs")}, CH = ${imp("chapter.mjs")};
        const r = V.trialProgress(${J(set7.chapter)});
        return { dead: CH.isDeadForGm(game.actors.get("${IDS.daichi}")), stamped: Number.isFinite(r.executedAt), executed: r.execution?.done ?? null };`),
        v => v?.stamped === true, 10000);
    await gm.eval(`const CH = ${imp("chapter.mjs")}; const d = game.actors.get("${IDS.daichi}");
        if (CH.isDeadForGm(d)) await CH.reviveCharacter(d, { quiet: true });
        await game.settings.set("${MOD}", "trialProgress", globalThis.__s58Trial7); delete globalThis.__s58Trial7; return true;`, { timeout: 60000 });
    await gm2.eval(`for (const id of game.messages.contents.filter(m => !globalThis.__s58Had.has(m.id)).map(m => m.id)) await game.messages.get(id)?.delete?.().catch(() => {});
        delete globalThis.__s58Had; return true;`, { timeout: 60000 });
    /* The rest of a trial's end is not run: the execution is asked as `executeAtExit` is asked at it (trial-floor-ui.mjs
       `closeTrial`, clock.mjs `reconcilePhase`), so the part reads the ask, its card and the press. */
    check("TRIAL-07: an execute gm does not answer leaves gm2 the GMs' card with Carry out the sentence again; pressed twice once gm answers again, Daichi is executed once on gm",
        asked07 === null && card07?.button === true && card07.popup === true && alive07 === true
            && pressed07[0] === true && pressed07[1] === false && after07?.dead === true && after07.stamped === true && J(after07.executed) === J([IDS.daichi]),
        J({ asked07, card07, alive07, pressed07, after07 }));
    await settle(800);

    /* ------------------------------------------------------- TRIAL-08 */
    phase("TRIAL-08 gm2's entry into the trial cut by its reload, finished on gm");
    const set8 = await gm.eval(`const K = ${imp("clock.mjs")}, A = ${imp("actions.mjs")}, D = ${imp("despair.mjs")}, G = ${imp("gm-stores.mjs")};
        const clock = structuredClone(K.getClock());
        globalThis.__s58Trial8 = { clock, record: structuredClone(game.settings.get("${MOD}", "trialProgress") ?? {}), budgets: A.budgetsOf(),
            pools: D.monokumas().map(u => [u.id, D.getDespair(u.id)]), rows: Object.keys(G.phaseStepStore.entries() ?? {}),
            messages: game.messages.contents.map(m => m.id) };
        await game.settings.set("${MOD}", "trialProgress", { ...(game.settings.get("${MOD}", "trialProgress") ?? {}), chapter: clock.chapter, verdictApplied: true, keysCharged: false });
        await A.setActions(game.actors.get("${IDS.aiko}"), 0);
        return { phase: clock.phase, chapter: clock.chapter };`, { timeout: 60000 });
    await settle(800);
    // gm2's actor writes never answer from here, so its entry stops in the budget; the clock write is a setting's, and lands.
    void gm2.eval(`Actor.prototype.update = function () { return new Promise(() => {}); };
        const K = ${imp("clock.mjs")}; void K.setClock({ phase: "classTrial" }); return true;`, { timeout: 60000 }).catch(() => null);
    const cut8 = await until(() => gm2.eval(`const G = ${imp("gm-stores.mjs")}, K = ${imp("clock.mjs")};
        const row = Object.values(G.phaseStepStore.entries() ?? {}).find(r => r?.to === "classTrial" && r?.by === game.user.id) ?? null;
        return { phase: K.getClock().phase, row };`), v => v?.phase === "classTrial" && (v.row?.started ?? []).includes("budget"), 15000);
    await settle(1000);
    const r8 = await reload("gm2");
    const row8 = await until(() => gm.eval(`const G = ${imp("gm-stores.mjs")};
        return Object.values(G.phaseStepStore.entries() ?? {}).find(r => r?.to === "classTrial" && r?.by === "${accounts[0].id}") ?? null;`),
        v => (v?.done ?? []).includes("follow"), 20000);
    const after8 = await gm.eval(`const A = ${imp("actions.mjs")}, S = ${imp("secret.mjs")};
        const record = game.settings.get("${MOD}", "trialProgress") ?? {};
        const cut = game.i18n.format("DRPG.Trial.phaseBudgetCut", { gm: ${J(accounts[0].name)} });
        const told = game.messages.contents.filter(m => !globalThis.__s58Trial8.messages.includes(m.id)).map(m => String(S.contentOf(m) ?? ""));
        return { verdictApplied: Boolean(record.verdictApplied), mutedDead: Array.isArray(record.mutedDead), keysCharged: Boolean(record.keysCharged),
            aiko: A.budgetsOf()["${IDS.aiko}"]?.value ?? null, toldCut: told.some(t => t.includes(cut.slice(0, 40))) };`, { timeout: 60000 });
    await gm.eval(`const A = ${imp("actions.mjs")}, D = ${imp("despair.mjs")}, G = ${imp("gm-stores.mjs")}; const w = globalThis.__s58Trial8;
        await game.settings.set("${MOD}", "clock", w.clock);
        await game.settings.set("${MOD}", "trialProgress", w.record);
        await A.putBackBudgets(w.budgets);
        for (const [id, n] of w.pools) if (D.getDespair(id) !== n) await D.setDespair(id, n);
        const extra = Object.keys(G.phaseStepStore.entries() ?? {}).filter(k => !w.rows.includes(k));
        if (extra.length) await G.phaseStepStore.dropMany(extra);
        for (const id of game.messages.contents.filter(m => !w.messages.includes(m.id)).map(m => m.id)) await game.messages.get(id)?.delete?.().catch(() => {});
        delete globalThis.__s58Trial8; return true;`, { timeout: 60000 });
    await settle(1000);
    check("TRIAL-08: gm2's entry into the trial, cut by its reload inside the budget, is finished on gm - the record reset, the dead's list written, the fee stamped - and the budget is not handed out again (Aiko stays at 0): the row says it failed and the GMs are told",
        cut8?.phase === "classTrial" && (cut8.row?.started ?? []).includes("budget") && !(cut8.row?.done ?? []).includes("budget") && r8.back === true
            && ["reset", "voices", "fee", "deaths", "follow"].every(k => (row8?.done ?? []).includes(k)) && (row8?.failed ?? []).includes("budget")
            && after8.verdictApplied === false && after8.mutedDead === true && after8.keysCharged === true && after8.aiko === 0 && after8.toldCut === true,
        J({ cut8, r8, row8, after8, set8 }));
}
