/**
 * 96-late-sequence: a browser that loads within 10 minutes of a sequence's event plays it once (gaps-111, 13.11.2026;
 * the owner's answer to Q-E61-1 and Q-E94-4, "Przez 10 minut"; sequence.mjs `lateSequence`, `catchUpSequences`).
 *
 * The GM and three players, and one player declared late (`p4`, nobody's student), who is not at the table when the
 * day turns. The event is the start-of-day board, on the road a real roll-over takes (scenario 93's "road": the clock at
 * Night on a day no other part plays, the Morning Eclipse opened and ended with the advance), so the clock carries the
 * boards' stamp (`dayBoard`) at its `dayStartedAt`. Then, read on the late browser's own page (sequence.mjs
 * `sequenceStarted`, perf-counters.mjs `sequence.late`):
 *   fresh    p4 connects with an empty browser a moment after the event: it plays the start-of-day board once;
 *   again    p4 closes and comes back with the storage it left with (`storageOf`), inside the 10 minutes: nothing;
 *   stale    the clock's `dayStartedAt` put 11 minutes back, p4 again with an empty browser: nothing;
 *   off      the table's switch off (`sequences`), the stamp fresh, p4 with an empty browser: nothing (the start-of-day
 *            board never plays live with the switch off either);
 *   live     p1, at the table when the day turned, did not play it a second time from the late road (`sequence.late`
 *            stays 0 there).
 * Everything the road moved is put back. That the late play writes nothing to the world is read off the code
 * (sequence.mjs writes only this browser's localStorage) and by R3700's write log over tier 1, not here.
 *
 * What this cannot see: a real browser's reload (the harness spawns a client again with the storage it closed with),
 * the board's frames (jsdom draws nothing), and the trial's entry and the verdict's cut-in late (their picker is R4934's;
 * their road is the same `playSequence`).
 */
export const layers = ["ci"];
export const accounts = [{ who: "p4", id: "USERLATE00000000", name: "Late Player", role: 1, character: null, color: "#4477aa", late: true }];

export async function run({ gm, p1, p4, check, phase, settle, connect, disconnect, storageOf, repoUrl: REPO }) {
    const imp = file => `await import("${REPO}/scripts/${file}")`;
    const lateRead = (key) => p4.eval(`const Q = ${imp("sequence.mjs")}, P = ${imp("perf-counters.mjs")};
        for (let i = 0; i < 40 && !Q.sequenceStarted("dayStart", ${JSON.stringify(key)}); i++) await new Promise(r => setTimeout(r, 100));
        const started = Q.sequenceStarted("dayStart", ${JSON.stringify(key)}), lateCount = P.snapshot()["sequence.late"] ?? 0;
        Q.endSequence("cut");
        return { started, late: lateCount, record: Object.keys(JSON.parse(localStorage.getItem("drpg-sequences-played") ?? "{}")).length };`, { timeout: 20000 });

    phase("road");
    const road = await gm.eval(`const E = ${imp("eclipse.mjs")}, C = ${imp("clock.mjs")}, G = ${imp("gm-stores.mjs")}, M = ${imp("monokuma.mjs")}, Q = ${imp("sequence.mjs")};
        const SET = (${imp("settings.mjs")}).SETTINGS;
        const keep = ["sealedRooms", "restrictions", "motive", "searchTokens", "bodyFound", "readyRound", "sequences"];
        globalThis.__s96 = { clock: foundry.utils.deepClone(C.getClock()),
            actions: game.actors.filter(a => a.type === "character").map(a => [a.id, a.system?.resources?.actions?.value ?? null, a.system?.resources?.actions?.max ?? null]),
            rows: M.actingStudents().map(a => [a.id, foundry.utils.deepClone(G.eclipseMoveStore.get(a.id) ?? null)]),
            settings: Object.fromEntries(keep.map(k => [k, foundry.utils.deepClone(game.settings.get("danganronpa-rpg", SET[k]) ?? null)])) };
        if (globalThis.__s96.settings.sequences === false) await game.settings.set("danganronpa-rpg", SET.sequences, true);
        const day = 8000 + Math.floor(Math.random() * 999);
        await C.setClock({ phase: "dailyLife", timeOfDay: "night", day, refilledFor: null });
        await new Promise(r => setTimeout(r, 800));
        await E.startEclipse();
        await E.endEclipse({ advance: true });
        const now = C.getClock();
        return { key: "day:" + (now.season ?? "") + ":" + (Number(now.day) || 0) + ":" + (now.session ?? ""), stamped: now.dayBoard === now.day, age: Date.now() - Number(now.dayStartedAt) };`, { timeout: 60000 });
    check("road: the Morning Eclipse ended with the advance stamps the day's boards (dayBoard) at a fresh dayStartedAt",
        road?.stamped === true && road.age >= 0 && road.age < 60_000, JSON.stringify(road));
    await settle(1500);
    const liveP1 = await p1.eval(`const Q = ${imp("sequence.mjs")}, P = ${imp("perf-counters.mjs")}; Q.endSequence("cut"); return P.snapshot()["sequence.late"] ?? 0;`);

    try {
        phase("fresh");
        await connect("p4");
        const fresh = await lateRead(road.key);
        check("fresh: a browser that loads a moment after the day's start plays the start-of-day board once, by the late road, and keeps it in its own record",
            fresh?.started === true && fresh.late === 1 && fresh.record >= 1, JSON.stringify(fresh));

        phase("again");
        await disconnect("p4");
        const kept = await storageOf("p4");
        await connect("p4", { storage: kept });
        const again = await lateRead(road.key);
        check("again: the same browser back inside the 10 minutes, with the storage it left with, plays nothing",
            again?.started === false && again.late === 0, JSON.stringify({ again, kept: Object.keys(kept ?? {}) }));

        phase("stale");
        await disconnect("p4");
        await gm.eval(`const C = ${imp("clock.mjs")}; const c = C.getClock(); await C.setClock({ dayStartedAt: Date.now() - 11 * 60 * 1000 }); return C.getClock().dayBoard === c.dayBoard;`);
        await settle(800);
        await connect("p4");
        const stale = await lateRead(road.key);
        check("stale: with the day's start 11 minutes back, an empty browser plays nothing", stale?.started === false && stale.late === 0, JSON.stringify(stale));

        phase("off");
        await disconnect("p4");
        await gm.eval(`const C = ${imp("clock.mjs")}, SET = (${imp("settings.mjs")}).SETTINGS;
            await C.setClock({ dayStartedAt: Date.now() });
            await game.settings.set("danganronpa-rpg", SET.sequences, false); return true;`);
        await settle(800);
        await connect("p4");
        const off = await lateRead(road.key);
        check("off: with the table's switch off, an empty browser inside the 10 minutes plays nothing (as live: the board never plays with the switch off)",
            off?.started === false, JSON.stringify(off));
        await disconnect("p4");

        phase("live");
        check("live: p1, at the table when the day turned, took nothing from the late road", liveP1 === 0, JSON.stringify({ liveP1 }));
    } finally {
        const back = await gm.eval(`const E = ${imp("eclipse.mjs")}, C = ${imp("clock.mjs")}, G = ${imp("gm-stores.mjs")}, Q = ${imp("sequence.mjs")};
            const SET = (${imp("settings.mjs")}).SETTINGS, was = globalThis.__s96;
            if (!was) return false;
            Q.endSequence("cut");
            if (C.getClock().eclipse === true) await E.endEclipse({ advance: false });
            await C.setClock(was.clock);
            for (const [id, value, max] of was.actions) await game.actors.get(id)?.update({ "system.resources.actions.value": value, ...(max === null ? {} : { "system.resources.actions.max": max }) });
            for (const [id, row] of was.rows) { if (row) await G.eclipseMoveStore.patch(id, row); else await G.eclipseMoveStore.drop(id); }
            for (const [k, value] of Object.entries(was.settings)) if (value !== null) await game.settings.set("danganronpa-rpg", SET[k], value);
            delete globalThis.__s96;
            return true;`, { timeout: 60000 });
        check("put back: the clock, the actions, the Eclipse's rows and the settings the road moved", back === true, JSON.stringify(back));
    }
}
