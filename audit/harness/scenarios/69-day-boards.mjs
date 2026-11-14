/**
 * 69-day-boards (97 until the 1.2.113 assembly: E38 holds 97 and 98): the day's boards where the owner put them, on every connected browser (13.11.2026; the owner's rule of
 * that day, at a table on 1.2.112: "The start-of-day animation should show at the start of the Morning Eclipse, and the
 * end-of-day one after the Night Eclipse (that is, at the start of Night)"; transitions.mjs `boardsOf`).
 *
 * The GM and three players. The clock is moved on the GM with the game's own calls - the Eclipse's start and end
 * (eclipse.mjs `startEclipse`, `endEclipse` with the advance, as the clock's chevron and the panel's Eclipse button do),
 * the panel's Next time of day (clock.mjs `advanceTimeOfDay`) and Edit campaign's Apply (gm-campaign.mjs
 * `applyCampaignForm`) - on a day no other part plays, and each browser counts the boards it started over each move
 * (perf-counters.mjs `sequence.dayEnd`, `sequence.dayStart`: one per start, cut or not):
 *   nightEclipse    Evening, the Night Eclipse opened (nothing), then ended with the advance: one end-of-day board each;
 *   morningEclipse  at Night, the GM's morning line in the draft, the Morning Eclipse opened: one start-of-day board each,
 *                   the day + 1's, the line on it;
 *   morningEnd      its end with the advance: no board;
 *   evening         Evening to Night by Next, no Eclipse: one end-of-day board each;
 *   morning         Night to Morning by Next, no Eclipse: one start-of-day board each;
 *   edit            Edit campaign's Evening to Night and Night to Morning with the day + 1: nothing.
 * Everything the run moved is put back.
 *
 * What this cannot see: the boards' frames (jsdom draws nothing); their order against the trial's exit at a chapter's
 * end (R4424's, tier 1).
 */
export const layers = ["ci"];

export async function run({ gm, p1, p2, p3, check, phase, settle, repoUrl: REPO }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const clients = { gm, p1, p2, p3 };
    const counts = c => c.eval(`const P = ${imp("perf-counters.mjs")}, n = P.snapshot(); return [n["sequence.dayEnd"] ?? 0, n["sequence.dayStart"] ?? 0];`);
    const startLine = c => c.eval(`const Q = ${imp("sequence.mjs")};
        for (let i = 0; i < 40 && document.getElementById(Q.SEQUENCE_HOST_ID)?.dataset.drpgSequence !== "dayStart"; i++) await new Promise(r => setTimeout(r, 100));
        const host = document.getElementById(Q.SEQUENCE_HOST_ID);
        return host?.dataset.drpgSequence === "dayStart" ? [host.querySelector(".drpg-seq-day-title")?.textContent ?? null, host.querySelector(".drpg-seq-announce")?.lastChild?.textContent ?? null] : null;`);
    const cut = () => Promise.all(Object.values(clients).map(c => c.eval(`(${imp("sequence.mjs")}).endSequence("cut"); return true;`)));
    /* One move on the GM: every browser's counts before and after it, as [end boards, start boards] started; `lines`
       reads the start board's title and line on each browser before the cut. */
    const move = async (code, { lines = false } = {}) => {
        await cut();
        const was = {};
        for (const [who, c] of Object.entries(clients)) was[who] = await counts(c);
        const done = await gm.eval(`const C = ${imp("clock.mjs")}, E = ${imp("eclipse.mjs")}, G = ${imp("gm-campaign.mjs")}, SET = (${imp("settings.mjs")}).SETTINGS;
            ${code}
            return true;`, { timeout: 60000 });
        await settle(2500);
        const out = { done };
        for (const [who, c] of Object.entries(clients)) {
            const now = await counts(c);
            out[who] = [now[0] - was[who][0], now[1] - was[who][1]];
            if (lines) out[`${who}Line`] = await startLine(c);
        }
        await cut();
        return out;
    };
    const every = (out, want) => Object.keys(clients).every(who => JSON.stringify(out?.[who]) === JSON.stringify(want));

    phase("set");
    const start = await gm.eval(`const C = ${imp("clock.mjs")}, G = ${imp("gm-stores.mjs")}, M = ${imp("monokuma.mjs")};
        const SET = (${imp("settings.mjs")}).SETTINGS;
        const keep = ["sealedRooms", "restrictions", "motive", "searchTokens", "bodyFound", "readyRound", "sequences", "morningLineDraft"];
        globalThis.__s97 = { clock: foundry.utils.deepClone(C.getClock()),
            actions: game.actors.filter(a => a.type === "character").map(a => [a.id, a.system?.resources?.actions?.value ?? null, a.system?.resources?.actions?.max ?? null]),
            rows: M.actingStudents().map(a => [a.id, foundry.utils.deepClone(G.eclipseMoveStore.get(a.id) ?? null)]),
            settings: Object.fromEntries(keep.map(k => [k, foundry.utils.deepClone(game.settings.get("danganronpa-rpg", SET[k]) ?? null)])) };
        if (globalThis.__s97.settings.sequences === false) await game.settings.set("danganronpa-rpg", SET.sequences, true);
        const day = 9000 + Math.floor(Math.random() * 900);
        await C.setClock({ phase: "dailyLife", timeOfDay: "evening", day, refilledFor: null });
        await new Promise(r => setTimeout(r, 800));
        return { day, title: game.i18n.format("DRPG.Sequence.dayTitle", { day: day + 1 }) };`, { timeout: 60000 });
    await settle(1500);
    await cut();

    try {
        phase("nightEclipse");
        const nightStart = await move(`await E.startEclipse();`);
        const nightEnd = await move(`await E.endEclipse({ advance: true });`);
        check("nightEclipse: the Night Eclipse's start plays no board, and its end one end-of-day board on every browser, the GM's and each player's",
            every(nightStart, [0, 0]) && every(nightEnd, [1, 0]), JSON.stringify({ nightStart, nightEnd }));

        phase("morningEclipse");
        const morningStart = await move(`await game.settings.set("danganronpa-rpg", SET.morningLineDraft, "S97 line"); await E.startEclipse();`, { lines: true });
        const want = JSON.stringify([start?.title, "S97 line"]);
        check("morningEclipse: the Morning Eclipse's start plays one start-of-day board on every browser, the day + 1's, with the GM's morning line",
            every(morningStart, [0, 1]) && Object.keys(clients).every(who => JSON.stringify(morningStart[`${who}Line`]) === want),
            JSON.stringify({ morningStart, want }));

        phase("morningEnd");
        const morningEnd = await move(`await E.endEclipse({ advance: true });`);
        const after = await gm.eval(`const c = (${imp("clock.mjs")}).getClock(); return [c.timeOfDay, c.day, c.dayBoard, c.morningLine];`);
        check("morningEnd: the Morning Eclipse's end plays no board on any browser, and the day moves there, the line kept",
            every(morningEnd, [0, 0]) && JSON.stringify(after) === JSON.stringify(["morning", start.day + 1, start.day + 1, "S97 line"]),
            JSON.stringify({ morningEnd, after }));

        phase("evening");
        await gm.eval(`await (${imp("clock.mjs")}).setClock({ timeOfDay: "evening" }); return true;`);
        await settle(1500);
        const evening = await move(`await C.advanceTimeOfDay({ resetSearchTokens: false, announce: false });`);
        check("evening: Evening to Night by Next, no Eclipse held, plays one end-of-day board on every browser",
            every(evening, [1, 0]), JSON.stringify(evening));

        phase("morning");
        const morning = await move(`await C.advanceTimeOfDay({ resetSearchTokens: false, announce: false });`);
        check("morning: Night to Morning by Next, no Eclipse held, plays one start-of-day board on every browser",
            every(morning, [0, 1]), JSON.stringify(morning));

        phase("edit");
        await gm.eval(`await (${imp("clock.mjs")}).setClock({ timeOfDay: "evening" }); return true;`);
        await settle(1500);
        const form = `const c = C.getClock(); const f = p => ({ campaignName: c.campaignName ?? "", chapter: Number(c.chapter) || 1, day: Number(c.day) || 1, phase: c.phase, session: Number(c.session) || 1, timeOfDay: c.timeOfDay, reset: false, ...p });`;
        const editNight = await move(`${form} await G.applyCampaignForm(f({ timeOfDay: "night" }));`);
        const editMorning = await move(`${form} await G.applyCampaignForm(f({ day: (Number(c.day) || 1) + 1, timeOfDay: "morning" }));`);
        check("edit: Edit campaign's Evening to Night and Night to Morning with the day + 1 play no board on any browser",
            every(editNight, [0, 0]) && every(editMorning, [0, 0]), JSON.stringify({ editNight, editMorning }));
    } finally {
        const back = await gm.eval(`const E = ${imp("eclipse.mjs")}, C = ${imp("clock.mjs")}, G = ${imp("gm-stores.mjs")}, Q = ${imp("sequence.mjs")};
            const SET = (${imp("settings.mjs")}).SETTINGS, was = globalThis.__s97;
            if (!was) return false;
            Q.endSequence("cut");
            if (C.getClock().eclipse === true) await E.endEclipse({ advance: false });
            await C.setClock(was.clock);
            for (const [id, value, max] of was.actions) await game.actors.get(id)?.update({ "system.resources.actions.value": value, ...(max === null ? {} : { "system.resources.actions.max": max }) });
            for (const [id, row] of was.rows) { if (row) await G.eclipseMoveStore.patch(id, row); else await G.eclipseMoveStore.drop(id); }
            for (const [k, value] of Object.entries(was.settings)) if (value !== null) await game.settings.set("danganronpa-rpg", SET[k], value);
            delete globalThis.__s97;
            return true;`, { timeout: 60000 });
        await cut().catch(() => null);
        check("put back: the clock, the actions, the Eclipse's rows and the settings the run moved", back === true, JSON.stringify(back));
    }
}
