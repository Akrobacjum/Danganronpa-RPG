/**
 * Probe: the tier 0-1 tests whose names speak of Palm, a Frisk, a steal or a Plant run as scenario 01's part A2 runs the
 * suite - the clock in a Class Trial with the debate running (1.2.128 line TRIAL, 23.11.2026; E129 S0-PALM: R619 and R623
 * red in A2, CI shard 1, as line STG found; probes/129-hide-in-trial.mjs is this probe's model).
 * ---------------------------------------------------------------------------
 *     node cluster.mjs probes/129-palm-in-trial.mjs                (from audit/harness)
 *
 * The GM sets A2's state as 01-runtests `readOnlyParts` does - `setClock({ phase: "classTrial" })`, `startFloor()` -
 * then `runTests({ tier: 1, only })` with the R numbers below, then puts the floor and the clock back. One check: no test
 * failed and every number named ran. The list is the tier 0-1 tests whose names hold "palm", "frisk", "steal" or "plant"
 * (any case), read off the tier files on 23.11.2026; it is 01's A2 cut to these tests, not 01 itself.
 */
export const layers = ["probe"];

/* Each R number by name: an `only` entry that is an R number matches that test alone (tests.mjs `matcherFor`). */
const ONLY = ["R1006", "R1020", "R1021", "R1104", "R1110", "R1157", "R1199", "R1201", "R1202", "R121", "R1230", "R1255", "R1256",
    "R1257", "R1310", "R1322", "R1324", "R1356", "R1404", "R1410", "R1580", "R190", "R2", "R2050", "R2092", "R3", "R3143", "R3200",
    "R3252", "R3333", "R3336", "R3347", "R3348", "R3384", "R34", "R3410", "R3412", "R3440", "R3461", "R3596", "R36", "R3670", "R3706",
    "R3710", "R3852", "R3966", "R4105", "R4760", "R5100", "R5300", "R5468", "R5760", "R6100", "R617", "R618", "R619", "R620", "R621",
    "R622", "R623", "R6750", "R6752", "R6753", "R6754", "R6755", "R6756", "R7883", "R8061", "R8433", "R8696", "R8772", "R8883", "R8886",
    "R8900", "R8906", "R907", "R952", "R953"];

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
        const only = ${JSON.stringify(ONLY)};
        const r = await game.drpg.runTests({ tier: 1, only });
        const ran = new Set((r?.results ?? []).map(x => (x.name.match(/^(R\\d+) /) ?? [])[1]).filter(Boolean));
        return { phase, passed: r?.passed, failed: r?.failed, ran: ran.size, missing: only.filter(n => !ran.has(n)),
            fails: (r?.results ?? []).filter(x => x.outcome === "fail").map(x => (x.name.slice(0, 60) + ": " + (x.message ?? "")).slice(0, 600)) };
    `, { timeout: 600000 });
    await gm.eval(`
        await game.drpg.endFloor();
        await game.drpg.setClock(globalThis.__clockBeforeProbe);
        return true;
    `, { timeout: 60000 });
    note("A2-like run", JSON.stringify(out));
    check("the Palm and Frisk tests of tiers 0-1 pass with the clock in a Class Trial, the debate running, each named one run",
        Boolean(out && out.phase === "classTrial" && out.failed === 0 && out.missing.length === 0), JSON.stringify(out));
}
