/**
 * Probe: the S0-HIDE tests of tiers 0-1 (R8900-R8909, R472) run as scenario 01's part A2 runs the suite - the clock in
 * a Class Trial with the debate running (1.2.128 line STG, 23.11.2026; CI run 45196903979, shard 1: R8903 red in A2).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/129-hide-in-trial.mjs                (from audit/harness)
 *
 * The GM sets A2's state as 01-runtests `readOnlyParts` does - `setClock({ phase: "classTrial" })`, `startFloor()` -
 * then `runTests({ tier: 1, only })` with the pieces below, then puts the floor and the clock back. One check: no test
 * failed and at least one ran. It is 01's A2 cut to these tests, not 01 itself: 01 runs every test of tiers 0-1 there.
 */
export const layers = ["probe"];

/* Each R number by name: an `only` entry that is an R number matches that test alone (tests.mjs `matcherFor`). */
const ONLY = ["R8900", "R8901", "R8902", "R8903", "R8904", "R8905", "R8906", "R8907", "R8908", "R8909", "R472"];

export async function run({ gm, check, note, settle }) {
    await settle(1000);
    await gm.eval(`
        globalThis.__clockBeforeProbe = foundry.utils.deepClone(game.drpg.getClock());
        await game.drpg.setClock({ phase: "classTrial" });
        await game.drpg.startFloor();
        return true;
    `, { timeout: 60000 });
    await settle(500);
    const out = await gm.eval(`
        const phase = game.drpg.getClock()?.phase ?? null;
        const r = await game.drpg.runTests({ tier: 1, only: ${JSON.stringify(ONLY)} });
        return { phase, passed: r?.passed, failed: r?.failed, ran: (r?.results ?? []).filter(x => /^R(890\\d|472) /.test(x.name)).length,
            fails: (r?.results ?? []).filter(x => x.outcome === "fail").map(x => (x.name.slice(0, 60) + ": " + (x.message ?? "")).slice(0, 600)) };
    `, { timeout: 300000 });
    await gm.eval(`
        await game.drpg.endFloor();
        await game.drpg.setClock(globalThis.__clockBeforeProbe);
        return true;
    `, { timeout: 60000 });
    note("A2-like run", JSON.stringify(out));
    check("the S0-HIDE tests of tiers 0-1 pass with the clock in a Class Trial, the debate running",
        Boolean(out && out.phase === "classTrial" && out.ran > 0 && out.failed === 0), JSON.stringify(out));
}
