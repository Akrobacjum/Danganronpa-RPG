/** Run the module's own regression suite, full tier, on the GM client. */
export async function run({ gm, p1, p2, p3, check, settle }) {
    // The suite drives the whole table from the GM's client and measures state
    // between its own steps; a player client auto-answering a dialog it was sent
    // (an opening roll, a ballot) would race those measurements.
    // ...and the module's own socket listeners on those clients are silenced, so a
    // victim's client does not answer an opening roll the suite is about to score itself.
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; (game.socket._handlers.get("module.danganronpa-rpg") ?? []).length = 0; return true;`);

    // players must NOT be able to run it
    const asPlayer = await p1.eval(`const r = await game.drpg.runTests({ tier: 0 }); return r;`, { timeout: 60000 });
    check("p1: suite refuses non-GM", asPlayer === null, JSON.stringify(asPlayer));

    const res = await gm.eval(`
        const r = await game.drpg.runTests({ tier: 2 });
        return { passed: r?.passed, failed: r?.failed, skipped: r?.skipped, text: (r?.text ?? "").slice(0, 30000) };
    `, { timeout: 240000 });

    check("gm: suite ran", res && typeof res.passed === "number", JSON.stringify(res).slice(0, 300));
    if (res?.text) {
        console.log("---------------- SUITE OUTPUT ----------------");
        console.log(res.text);
        console.log("----------------------------------------------");
    }
    check("gm: suite failures", (res?.failed ?? 99) === 0, `${res?.failed} failed`);
    /* The skipped count is checked, not just printed. A test that cannot be answered
       here says so and is counted apart from the failures (see `needs` in tests.mjs);
       if that number GROWS, something that used to be answerable has stopped being so
       - which is a regression wearing the one colour nobody looks at. */
    check("gm: nothing new went unanswerable", (res?.skipped ?? 99) <= 9,
        `${res?.skipped} skipped, was 9 on 14.09`);
    await settle(300);
}
