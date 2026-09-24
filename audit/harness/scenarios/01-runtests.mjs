/** Run the module's own regression suite, full tier, on the GM client. */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

export const layers = ["ci"];

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

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
    /* THE SKIPS, EXACTLY (E30, 24.09.2026; audit S14-24). The skipped count is
       checked, not just printed: a test that cannot be answered here says so and is
       counted apart from the failures (needs() in tests-kit.mjs), and if that set
       GROWS, something that used to be answerable has stopped being so - a
       regression wearing the one colour nobody looks at. It was a count, `<= 16`,
       which a test that started answering let through beside one that stopped.
       Now every skip is held to skip-baseline.json by name and probe, both ways.
       And no world.* skip at all: this harness builds the world it runs in, so a
       scenario it cannot cast for is a fixture defect, not a fact about a table. */
    const baseline = JSON.parse(fs.readFileSync(path.join(HERE, "..", "skip-baseline.json"), "utf8"));
    const skips = (res?.results ?? []).filter(r => r.outcome === "skip");
    const worldSkips = skips.filter(r => !String(r.probe ?? "").startsWith("env."));
    check("gm: no test skipped for want of something in the harness's own world", worldSkips.length === 0,
        worldSkips.map(r => `${r.name} [${r.probe ?? "no probe"}]`).join("; "));
    const key = r => `${r.probe} | ${r.test ?? r.name}`;
    const listed = new Set(baseline.skips.map(key)), seen = new Set(skips.map(key));
    const unlisted = [...seen].filter(k => !listed.has(k)), answering = [...listed].filter(k => !seen.has(k));
    check("gm: the skips are exactly the ones skip-baseline.json lists", Array.isArray(res?.results) && !unlisted.length && !answering.length,
        `${skips.length} skipped, ${baseline.skips.length} listed; not listed: ${unlisted.join("; ") || "none"}; listed and now answering: ${answering.join("; ") || "none"}`);
    await settle(300);
    return { suite: { passed: res?.passed, failed: res?.failed, skipped: res?.skipped, red: res?.red, results: res?.results ?? null } };
}
