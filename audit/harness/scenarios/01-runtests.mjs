/**
 * Run the module's own regression suite on the GM client: read-only in a world
 * mid-game (A1, A2), with no argument (A3), tier 2 refused at its window (B), and
 * the full run, tier 2 confirmed by this world's id (C).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

export const layers = ["ci"];

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

/* Where two readings of the harness's own state differ, as paths (for a check's details). */
function stateDiff(a, b, at = "", out = []) {
    const plain = v => v && typeof v === "object";
    if (plain(a) && plain(b) && Array.isArray(a) === Array.isArray(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) stateDiff(a[k], b[k], at ? `${at}.${k}` : k, out);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(at);
    return out;
}

/*
 * TIERS 0 AND 1 IN A WORLD THAT IS MID-GAME (E30, 24.09.2026; audit S17-04). The
 * handbook tells a GM that runTests({ tier: 1 }) is safe during play, and the suite
 * checks that with its own world dump. This checks the check: the harness reads its
 * own stores before and after (client-entry's __harnessWorldState, which knows
 * nothing of the dump's rules), with an incident open (A1) and inside a Class Trial
 * with the debate running (A2) - the two states a GM is most likely to be in when
 * somebody asks whether the module is healthy.
 */
async function readOnlyRun(gm, check, label) {
    const out = await gm.eval(`
        const before = globalThis.__harnessWorldState();
        const r = await game.drpg.runTests({ tier: 1 });
        await new Promise(res => setTimeout(res, 400));
        const after = globalThis.__harnessWorldState();
        return { before, after, tiers: [...new Set((r?.results ?? []).map(x => x.tier))], failed: r?.failed, passed: r?.passed,
            tier2: /TIER 2/.test(r?.text ?? ""), purity: (r?.results ?? []).find(x => x.name === "tier 0/1 changed nothing in the world") ?? null,
            fails: (r?.results ?? []).filter(x => x.outcome === "fail").map(x => (x.name + ": " + (x.message ?? "")).slice(0, 300)) };
    `, { timeout: 240000 });
    check(`gm: ${label} - tiers 0 and 1 only, no tier 2`, out && !out.tier2 && out.tiers.every(t => t <= 1) && out.tiers.length > 0,
        JSON.stringify({ tiers: out?.tiers, tier2: out?.tier2 }));
    const moved = out ? stateDiff(out.before, out.after) : ["no answer"];
    check(`gm: ${label} - the harness's own reading of the world did not move`, moved.length === 0, moved.slice(0, 12).join("; "));
    check(`gm: ${label} - the suite says tier 0/1 changed nothing`, out?.purity?.outcome === "pass",
        `${out?.purity?.outcome ?? "no purity result"}: ${out?.purity?.message ?? ""}`.slice(0, 600));
    check(`gm: ${label} - nothing failed`, out?.failed === 0, (out?.fails ?? []).join(" | ").slice(0, 1200));
}

export async function run({ gm, p1, p2, p3, check, note, settle }) {
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

    // A1: an incident open - Chie on Daichi, past the opening roll, as 10-murder opens one.
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "ACTORCHIE0000000", victimId: "ACTORDAICHI00000" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return true;
    `, { timeout: 60000 });
    await settle(500);
    await readOnlyRun(gm, check, "A1, an incident open");
    await gm.eval(`await game.drpg.endMurder({ reason: "test", followUp: false }); return true;`, { timeout: 60000 });
    await settle(500);

    // A2: inside a Class Trial, the debate running; the clock goes back to where it was.
    await gm.eval(`
        globalThis.__clockBeforeA2 = foundry.utils.deepClone(game.drpg.getClock());
        await game.drpg.setClock({ phase: "classTrial" });
        await game.drpg.startFloor();
        return true;
    `, { timeout: 60000 });
    await settle(500);
    await readOnlyRun(gm, check, "A2, inside a Class Trial");
    await gm.eval(`
        await game.drpg.endFloor();
        await game.drpg.setClock(globalThis.__clockBeforeA2);
        return true;
    `, { timeout: 60000 });
    await settle(500);

    /* The text is cut at 30,000 characters for the log; the suite's own list of
       results is kept whole and written into this run's results file
       (evidence.suite), which is what `suite-diff --json` compares (E30). */
    /* A3: no argument reads (E30, D25). runTests() runs tiers 0 and 1 and opens no
       incident - the default used to be tier 2, which opens several. */
    const a3 = await gm.eval(`
        const r = await game.drpg.runTests();
        return { tiers: [...new Set((r?.results ?? []).map(x => x.tier))], murder: game.drpg.murderState() ?? null, failed: r?.failed };
    `, { timeout: 240000 });
    check("gm: A3 - runTests() runs tiers 0 and 1 only and opens no incident",
        a3 && a3.tiers.length > 0 && a3.tiers.every(t => t <= 1) && a3.murder === null && a3.failed === 0, JSON.stringify(a3).slice(0, 300));

    /* B: tier 2 asks first, in a window that names the world, Cancel first and the
       only default - and `confirmed: true` is not this world's id, so it asks too.
       The window is answered from the queue with "cancel", as a GM pressing Enter
       would; that Enter picks Cancel in a real v14 window is a live check. */
    const b = await gm.eval(`
        const seen = [];
        const answer = cfg => {
            seen.push({ title: cfg.window?.title ?? "", content: cfg.content?.textContent ?? String(cfg.content ?? ""),
                buttons: (cfg.buttons ?? []).map(x => ({ action: x.action, default: Boolean(x.default) })) });
            return "cancel";
        };
        globalThis.__dialogAnswers.push(answer);
        const plain = await game.drpg.runTests({ tier: 2 });
        globalThis.__dialogAnswers.push(answer);
        const asTrue = await game.drpg.runTests({ tier: 2, confirmed: true });
        return { seen, world: { id: game.world.id, title: game.world.title }, murder: game.drpg.murderState() ?? null,
            plain: { refused: plain?.refused ?? null, passed: plain?.passed, results: plain?.results?.length ?? null },
            asTrue: { refused: asTrue?.refused ?? null, results: asTrue?.results?.length ?? null } };
    `, { timeout: 60000 });
    const win = b?.seen?.[0];
    check("gm: B - the tier-2 window names this world, by title and by id",
        Boolean(win) && win.title.includes(b.world.title) && win.content.includes(b.world.title) && win.content.includes(b.world.id),
        JSON.stringify(win ?? null).slice(0, 400));
    check("gm: B - Cancel is the first button and the only default",
        win?.buttons?.[0]?.action === "cancel" && win.buttons[0].default && win.buttons.filter(x => x.default).length === 1,
        JSON.stringify(win?.buttons ?? null));
    check("gm: B - a cancelled tier 2 runs nothing and says so",
        b?.plain?.refused === "cancelled" && b.plain.passed === 0 && b.plain.results === 0 && b.murder === null, JSON.stringify(b?.plain ?? null));
    check("gm: B - confirmed: true is not this world's id, and asks",
        b?.seen?.length === 2 && b.asTrue.refused === "cancelled" && b.asTrue.results === 0, JSON.stringify({ seen: b?.seen?.length, asTrue: b?.asTrue }));

    /* C: the full run, tier 2 confirmed with this world's id. 600 s, not 240 (E30): a
       hang detector, not a benchmark. The whole-world dump after every restore brought
       the run near the old bound (E30 C15b), and a CI runner's speed is its own. The
       time is recorded as a note. */
    const started = Date.now();
    const res = await gm.eval(`
        const r = await game.drpg.runTests({ tier: 2, confirmed: game.world.id });
        return { passed: r?.passed, failed: r?.failed, skipped: r?.skipped, red: r?.red, results: r?.results ?? null,
            text: (r?.text ?? "").slice(0, 30000) };
    `, { timeout: 600000 });
    note("gm: the full suite's run", `${Math.round((Date.now() - started) / 1000)} s`);

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
