/** Run the module's own regression suite, full tier, on the GM client. */
export async function run({ gm, p1, p2, p3, check, settle }) {
    // The suite drives the whole table from the GM's client and measures state
    // between its own steps; a player client auto-answering a dialog it was sent
    // (an opening roll, a ballot) would race those measurements.
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; return true;`);

    // players must NOT be able to run it
    const asPlayer = await p1.eval(`const r = await game.drpg.runTests({ tier: 0 }); return r;`, { timeout: 60000 });
    check("p1: suite refuses non-GM", asPlayer === null, JSON.stringify(asPlayer));

    const res = await gm.eval(`
        const r = await game.drpg.runTests({ tier: 2 });
        return { passed: r?.passed, failed: r?.failed, text: (r?.text ?? "").slice(0, 30000) };
    `, { timeout: 240000 });

    check("gm: suite ran", res && typeof res.passed === "number", JSON.stringify(res).slice(0, 300));
    if (res?.text) {
        console.log("---------------- SUITE OUTPUT ----------------");
        console.log(res.text);
        console.log("----------------------------------------------");
    }
    check("gm: suite failures", (res?.failed ?? 99) === 0, `${res?.failed} failed`);
    await settle(300);
}
