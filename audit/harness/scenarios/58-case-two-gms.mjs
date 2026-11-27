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
 *             gm: gm2 reads the report's groups, gm posts the report card, gm2 is told no refusal.
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
    const { gm, gm2, check, phase, settle, connect, reload, primaryOn, repoUrl: REPO, IDS } = api;
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
}

