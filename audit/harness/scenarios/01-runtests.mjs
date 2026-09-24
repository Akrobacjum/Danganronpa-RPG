/** Run the module's own regression suite, full tier, on the GM client. */
export const layers = ["ci"];

export async function run({ gm, p1, p2, p3, check, settle }) {
    // The suite drives the whole table from the GM's client and measures state
    // between its own steps; a player client auto-answering a dialog it was sent
    // (an opening roll, a ballot) would race those measurements.
    // ...and the module's own socket listeners on those clients are silenced, so a
    // victim's client does not answer an opening roll the suite is about to score itself.
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; (game.socket._handlers.get("module.danganronpa-rpg") ?? []).length = 0; return true;`);

    /* REAL WINDOWS ON THE GM (E01, 24.09.2026). The suite opens windows and reads
       them: the Item tables, the trial console, the murder window. Headless, the
       shim's DialogV2 used to answer `wait` from a queue and draw nothing, so eleven
       tests failed on "the window did not open" - a fact about the shim, which the
       suite could not tell from a broken module. With this flag the GM's DialogV2
       builds a window that stays open until something presses one of its buttons,
       as Foundry's does. Players keep the auto-answering dialogs they had. */
    await gm.eval(`globalThis.__dialogWindows = true; return true;`);

    // players must NOT be able to run it
    const asPlayer = await p1.eval(`const r = await game.drpg.runTests({ tier: 0 }); return r;`, { timeout: 60000 });
    check("p1: suite refuses non-GM", asPlayer === null, JSON.stringify(asPlayer));

    /* The text is cut at 30,000 characters for the log; the suite's own list of
       results is kept whole and written into this run's results file
       (evidence.suite), which is what `suite-diff --json` compares (E30). */
    const res = await gm.eval(`
        const r = await game.drpg.runTests({ tier: 2 });
        return { passed: r?.passed, failed: r?.failed, skipped: r?.skipped, red: r?.red, results: r?.results ?? null,
            text: (r?.text ?? "").slice(0, 30000) };
    `, { timeout: 240000 });

    check("gm: suite ran", res && typeof res.passed === "number", JSON.stringify(res).slice(0, 300));
    const counted = (res?.passed ?? 0) + (res?.failed ?? 0) + (res?.skipped ?? 0) + (res?.red ?? 0);
    check("gm: every result the summary counts is in the list", Array.isArray(res?.results) && res.results.length === counted,
        `${res?.results?.length ?? "no"} results listed, ${counted} counted`);
    if (res?.text) {
        console.log("---------------- SUITE OUTPUT ----------------");
        console.log(res.text);
        console.log("----------------------------------------------");
    }
    check("gm: suite failures", (res?.failed ?? 99) === 0, `${res?.failed} failed`);
    /* The skipped count is checked, not just printed. A test that cannot be answered
       here says so and is counted apart from the failures (see `needs` in tests-kit.mjs);
       if that number GROWS, something that used to be answerable has stopped being so
       - which is a regression wearing the one colour nobody looks at. */
    /* 16 on 24.09 (E01), and every one of them now asks the environment first: no
       layout (R12, R111, R112, the curtain twice, two chrome sweeps, the window cap),
       no fonts, no Web Animations API, no CSS cascade (three), no canvas renderer, no
       Daggerheart sheets (two). The old 9 of 14.09 had become 12 by 1.2.56 with nobody
       told, and three of those twelve were the module's own results skipping. */
    check("gm: nothing new went unanswerable", (res?.skipped ?? 99) <= 16,
        `${res?.skipped} skipped, was 16 on 24.09`);
    await settle(300);
    return { suite: { passed: res?.passed, failed: res?.failed, skipped: res?.skipped, red: res?.red, results: res?.results ?? null } };
}
