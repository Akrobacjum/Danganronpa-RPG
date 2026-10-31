/**
 * Run the module's own regression suite on the GM client: read-only in a world
 * mid-game (A1, A2), with no argument (A3), tier 2 refused at its window (B), and
 * the full run, tier 2 confirmed by this world's id (C).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { listHash } from "../suite-merge.mjs";

export const layers = ["ci"];

const HERE = path.dirname(url.fileURLToPath(import.meta.url));

/*
 * DRPG_SUITE_SHARD=i/n (INFRA I2, 18.10.2026): this run is shard i of n - tiers 0-1 and parts
 * A and B in shard 1 alone, tier 2's tests at positions k with 2 + k % (n - 1) = i, none in
 * shard 1 (tests.mjs `runTests({ shard })` and `shardOfPosition`, INFRA I3). Unset, the run is 1/1, the whole suite, as before. Each shard's
 * results file keeps its part (evidence.shard: the shard, the tier-2 names it ran, the whole
 * tier-2 list with its length and hash) for suite-merge.mjs, which holds the parts to that
 * list, each name once.
 */
function shardFromEnv(value) {
    if (value === undefined || value === "") return { index: 1, count: 1 };
    const m = /^(\d+)\/(\d+)$/.exec(String(value).trim());
    const index = m ? Number(m[1]) : NaN, count = m ? Number(m[2]) : NaN;
    return count >= 1 && index >= 1 && index <= count ? { index, count } : { index: 1, count: 1, problem: `DRPG_SUITE_SHARD=${value} is not i/n with 1 <= i <= n` };
}
const SHARD = shardFromEnv(process.env.DRPG_SUITE_SHARD);

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
 *
 * THE LOAD'S OWN WRITES BEFORE THE FIRST READING (E29 fix r1-G9, 05.10.2026). The reading
 * before the run is the harness's, and it was taken as soon as A1's incident was open - while
 * the GM's load could still be writing what it writes of its own accord after `ready`: the
 * stores' compaction and the case's marks (gm-stores.mjs `whenGmStoresLoaded`), among them
 * `caseMark.since`, which this seed's trace earns at every boot. The suite's own first reading
 * waits for that (tests.mjs `loadSettled`); this one did not, so a load slower than A1's start
 * landed between the two readings. At k1 (05.10.2026) A1 failed on `caseMark.since` beside two
 * other lanes and passed alone; with the case's mark held back 6 s (a probe running this file's
 * A1, e29run/r1g9probe) it failed the same way without this wait (1 run of 1) and passed with it
 * (2 of 2). Bounded as the suite's is.
 */
/* The bound of one run of tiers 0 and 1 (A1, A2, A3). 240 s until E79 fix r3-G4 (17.10.2026), when 01 whole
   failed with "eval timeout on gm" in A2 with nothing hung: tier 1 alone inside a Class Trial (a probe running
   A2's setup, e79run/scratch/r3g4-a2time) read 221 s and 246 s on that group's tree and 238 s on its parent,
   ca76c6a, which the fix did not slow down - the run had grown to its bound. So 600 s, about two and a half
   times the slowest reading, until E79 fix r4-G4 (review round 4, Q5): a bound that admits two and a half times
   the run lets a run that has grown by half pass unread. Held now to those three readings, 1.5 times the slowest
   (246 s, so 369 s, rounded up to 370 s): half again for a lane beside other scenarios, as the chain runs 01 (whether
   other lanes ran during the three readings was not read), against their spread of 11 %. Each run's seconds are
   printed in its first check's detail, so the next reader compares them with 246 s rather than with the bound. */
const READ_ONLY_MS = 370000;

/*
 * THE PRIMARY'S BEAT IS THE ONE LEAF THAT MAY TICK (E17 fix ci-2, 26.10.2026; CI run 40402423765 on f7ac1e9d, suite
 * 1/8). Since E17 C6 the primary GM writes `serverNow()` into the GMs' store "clockBeat" every 60 s while the world runs
 * (hud.mjs `beatClock`) - a client setting of this browser, so this reading saw it: A1 and A2 each failed on
 * `client.danganronpa-rpg.gmClockBeat.worlds.drpg-audit-world.e.record.at` and `...t.record`, a run of tiers 0 and 1
 * being longer than a beat. The beat is the time passing, written whatever the suite does, as a GM at the table would
 * have it written; the suite's own dump leaves it out with its measurement (tests-kit.mjs `DUMP_RULES`, the gmClockBeat
 * row). Here only the record (its first beat), its `at` and its stamp, in any world's section of that one key, are let
 * move, the record holding `at` alone and only forward; any other leaf of that store - its tombstones, its watermark,
 * another field - or of anything else still fails the check, and what moved is named in the detail.
 */
const BEAT_LEAF = /^client\.danganronpa-rpg\.gmClockBeat\.worlds\.[^.]+\.(e\.record(\.at)?|t\.record)$/;

async function readOnlyRun(gm, check, label, repoUrl) {
    const began = Date.now();
    const out = await gm.eval(`
        const [{ whenGmStoresLoaded }, { migrationOnLoad }] = await Promise.all([import("${repoUrl}/scripts/gm-stores.mjs"), import("${repoUrl}/scripts/migrate.mjs")]);
        const settled = await Promise.race([Promise.all([whenGmStoresLoaded(), migrationOnLoad()]).then(() => true),
            new Promise(res => setTimeout(() => res(false), 30000))]);
        const before = globalThis.__harnessWorldState();
        const r = await game.drpg.runTests({ tier: 1 });
        await new Promise(res => setTimeout(res, 400));
        const after = globalThis.__harnessWorldState();
        return { settled, before, after, tiers: [...new Set((r?.results ?? []).map(x => x.tier))], failed: r?.failed, passed: r?.passed,
            tier2: /TIER 2/.test(r?.text ?? ""), purity: (r?.results ?? []).find(x => x.name === "tier 0/1 changed nothing in the world") ?? null,
            fails: (r?.results ?? []).filter(x => x.outcome === "fail").map(x => (x.name + ": " + (x.message ?? "")).slice(0, 300)) };
    `, { timeout: READ_ONLY_MS });
    const seconds = Math.round((Date.now() - began) / 100) / 10;
    check(`gm: ${label} - tiers 0 and 1 only, no tier 2`, out && !out.tier2 && out.tiers.every(t => t <= 1) && out.tiers.length > 0,
        JSON.stringify({ tiers: out?.tiers, tier2: out?.tier2, seconds, boundSeconds: READ_ONLY_MS / 1000 }));
    const diff = out ? stateDiff(out.before, out.after) : ["no answer"];
    const beat = diff.filter(p => BEAT_LEAF.test(p));
    const moved = diff.filter(p => !BEAT_LEAF.test(p));
    const beats = state => state?.client?.["danganronpa-rpg.gmClockBeat"]?.worlds ?? {};
    const forward = !beat.length || Object.entries(beats(out.after)).every(([world, w]) =>
        Object.keys(w?.e?.record ?? {}).every(f => f === "at") && Number(w?.e?.record?.at ?? 0) >= Number(beats(out.before)[world]?.e?.record?.at ?? 0));
    check(`gm: ${label} - the harness's own reading of the world did not move`, moved.length === 0 && forward,
        (out?.settled === false ? "the load had not settled in 30 s; " : "") + moved.slice(0, 12).join("; ")
        + (beat.length ? ` (the primary's beat ticked, ${forward ? "forward" : "backward, or beside another field"}: ${beat.join("; ")})` : ""));
    check(`gm: ${label} - the suite says tier 0/1 changed nothing`, out?.purity?.outcome === "pass",
        `${out?.purity?.outcome ?? "no purity result"}: ${out?.purity?.message ?? ""}`.slice(0, 600));
    check(`gm: ${label} - nothing failed`, out?.failed === 0, (out?.fails ?? []).join(" | ").slice(0, 1200));
}

/* A1, A2, A3 and B: tiers 0 and 1 read-only mid-game, the default, and the tier-2 window (shard 1 only). */
async function readOnlyParts({ gm, check, settle, repoUrl }) {
    // A1: an incident open - Chie on Daichi, past the opening roll, as 10-murder opens one.
    await gm.eval(`
        await game.drpg.openMurder({ killerId: "ACTORCHIE0000000", victimId: "ACTORDAICHI00000", openingTrait: "body" });
        await game.drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        return true;
    `, { timeout: 60000 });
    await settle(500);
    await readOnlyRun(gm, check, "A1, an incident open", repoUrl);
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
    await readOnlyRun(gm, check, "A2, inside a Class Trial", repoUrl);
    await gm.eval(`
        await game.drpg.endFloor();
        await game.drpg.setClock(globalThis.__clockBeforeA2);
        return true;
    `, { timeout: 60000 });
    await settle(500);

    /* A3: no argument reads (E30, D25). runTests() runs tiers 0 and 1 and opens no
       incident - the default used to be tier 2, which opens several. */
    const a3 = await gm.eval(`
        const r = await game.drpg.runTests();
        return { tiers: [...new Set((r?.results ?? []).map(x => x.tier))], murder: game.drpg.murderState() ?? null, failed: r?.failed };
    `, { timeout: READ_ONLY_MS });
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
}

export async function run({ gm, p1, p2, p3, check, note, settle, socketTraffic, IDS, repoUrl }) {
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

    if (SHARD.problem) {
        check("the shard is one part of its count", false, SHARD.problem);
        return { suite: null };
    }

    // players must NOT be able to run it
    const asPlayer = await p1.eval(`const r = await game.drpg.runTests({ tier: 0 }); return r;`, { timeout: 60000 });
    check("p1: suite refuses non-GM", asPlayer === null, JSON.stringify(asPlayer));

    /* PARTS A AND B IN SHARD 1 ALONE (INFRA I2, 18.10.2026). They hold the suite's promises about
       itself - read-only in an incident and in a trial, the default, the window - which one run
       answers; in every shard they would run tiers 0-1 three times over again for no new answer - about
       640 s on 18.10.2026 (4 cores): A1 205.5 s and A2 211.9 s by their own readings, and the run's
       3000 s of wall less C's 2360 s for the boot, A and B together. */
    if (SHARD.index === 1) await readOnlyParts({ gm, check, settle, repoUrl });

    /* The text is cut at 30,000 characters for the log; the suite's own list of
       results is kept whole and written into this run's results file
       (evidence.suite), which is what `suite-diff --json` compares (E30). */
    /* C: the full run, tier 2 confirmed with this world's id. 1500 s, not 240 (E30), 600
       (until E32+E07 fix r1-G4) or 900 (until E08+E28 C18): a hang detector, not a
       benchmark. The whole-world dump after every restore brought the run near the first
       bound (E30 C15b), and a CI runner's speed is its own. The second went the same way:
       this note read 460 s at 1.2.65 and 542-596 s over E32+E07's commits on this machine
       (4 cores); on 02.10.2026 fix r1-G4's tree failed the 600 s bound with nothing hung,
       and read 613 s under 900. The third: 738 s at E08+E28 C10, 836 s at C14, 884 s at
       C17 and 893 s on C18's first run (04.10.2026), and C18's second run failed the 900 s
       bound with nothing hung, and read 910 s under 1500. The fourth: E33's part-1 tree
       (ba0cade, 899 tests) ran past 1500 s twice with nothing hung (e33run/k1 and k1b,
       07.10.2026: "eval timeout on gm" at 1847 s and 1802 s wall, the suite beside two
       harness lanes of a fix group) and read 1702 s under a 3000 s bound patched into an
       export (k1c), the scenario 1993 s wall; Actions ran 1.2.68's suite in 1532 s wall (CI
       run 19 on main, 06.10.2026). So 3600, about twice k1c's reading (fix r1-G3), beside
       run-all's 72 minutes (E33 fix r2-G4: 60 until then, which ended a hung run before
       this bound could name the test). The fifth: a crlf dispatch runs tier 2 unsharded on
       one Actions runner - 1.2.92's run (80bec60f, CI run 41112037572, 30.10.2026) green at
       3979 s for the scenario, tier 2 about 3490 s of it, 3% under this bound. 1.2.93's
       (c0ac849b, run 41169227859, 31.10.2026) ended here at 3600 s, and was first read as
       that growth; with 5400 here (3053d9f7, run 41177991100) it ended at 5400 s, so it
       was a hang: E90-T3 waiting on animation frames that E70-T9's setInterval stub had
       stopped for the rest of the session (client-entry.mjs, A FRAME THAT NO STUBBED
       setInterval CAN STOP; at 1.2.92 the frames stopped too, and no later test waited on
       one). Unsharded on 4 cores with the frames fixed: 3213.5 s, 1182 tier-2 tests, no
       build-up (the first 40 again at the end 77.2 s against 77.6 s). 5400 stays: the old
       bound left 3% on Actions. The time is recorded as a note. */
    /* THE LOAD'S ANSWERS BEFORE THE WINDOW OPENS (INFRA I2, 18.10.2026). Every player asks the GM
       for its copies as it loads - the fog, its cast, the door, its offers, twice each - and the GM
       answers from the world as it found it. Unsharded, A and B ran for about 640 s before C and the
       answers were long sent; a later shard starts C a second or two after the boot, and shard 2/8's
       first run counted 21 of those answers (fog.rows, incident.myCast, mastermind.door: the replies to
       asks all three players had sent before C began, packets 74-94 of its traffic) as tier 2's. So C waits for the
       load's own writes, as each A reading does, and then for 5 s with no copy sent to a player
       (bounded at 60 s) before it counts; the wait is noted. */
    const COPIES = ["mastermind.door", "incident.myCast", "fog.rows", "advancement.offers"];
    const players = [IDS.p1, IDS.p2, IDS.p3];
    const copyToPlayer = t => t.from === "gm" && COPIES.includes(t.action)
        && (t.to === "all" || (Array.isArray(t.to) && t.to.some(id => players.includes(id))));
    const quietFrom = Date.now();
    const loadSettled = await gm.eval(`
        const [{ whenGmStoresLoaded }, { migrationOnLoad }] = await Promise.all([import("${repoUrl}/scripts/gm-stores.mjs"), import("${repoUrl}/scripts/migrate.mjs")]);
        return await Promise.race([Promise.all([whenGmStoresLoaded(), migrationOnLoad()]).then(() => true),
            new Promise(res => setTimeout(() => res(false), 30000))]);
    `, { timeout: 40000 });
    let lastCopy = Date.now(), copies = socketTraffic.filter(copyToPlayer).length;
    while (Date.now() - lastCopy < 5000 && Date.now() - quietFrom < 60000) {
        await new Promise(res => setTimeout(res, 250));
        const now = socketTraffic.filter(copyToPlayer).length;
        if (now !== copies) { copies = now; lastCopy = Date.now(); }
    }
    note("gm: before C, the load settled and no copy went to a player for 5 s",
        `${Math.round((Date.now() - quietFrom) / 100) / 10} s${loadSettled === false ? "; the load had not settled in 30 s" : ""}${Date.now() - lastCopy < 5000 ? "; still sending at 60 s" : ""}`);
    const started = Date.now();
    const trafficBefore = socketTraffic.length;
    const res = await gm.eval(`
        const r = await game.drpg.runTests({ tier: 2, confirmed: game.world.id, shard: ${JSON.stringify({ index: SHARD.index, count: SHARD.count })} });
        return { passed: r?.passed, failed: r?.failed, skipped: r?.skipped, red: r?.red, results: r?.results ?? null,
            shard: r?.shard ?? null, text: (r?.text ?? "").slice(0, 30000) };
    `, { timeout: 5400000 });
    note(`gm: the full suite's run${SHARD.count > 1 ? `, shard ${SHARD.index}/${SHARD.count}` : ""}`, `${Math.round((Date.now() - started) / 1000)} s`);

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
    /* TIER 2 TELLS NO PLAYER ANYTHING FROM A STORE (E04's fix round, 26.09.2026; the round-2
       reviews' R2-M1 and M3). Its fixtures reached the players' copies - the fog's rooms,
       "you are the Mastermind", a betrayal offer - and outlived its restore. Counted off the
       packets the GM's client sent the three players while tier 2 ran: the door, a cast, the
       fog's cells, the offers. The players' own copies cannot say it here: their module
       listeners are silenced above, so nothing they are sent is taken. */
    const toPlayers = socketTraffic.slice(trafficBefore).filter(copyToPlayer);
    check("gm: tier 2 sent no player a copy of a GM store", toPlayers.length === 0,
        JSON.stringify(toPlayers.slice(0, 8).map(t => [t.action, t.to])) + (toPlayers.length > 8 ? ` and ${toPlayers.length - 8} more` : ""));
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
    /* In a shard a listed skip may be another shard's: only "every skip seen is listed" is this
       run's to say, and suite-merge.mjs holds the shards' skips together to the list, both ways. */
    if (SHARD.count > 1) {
        check(`gm: every skip of shard ${SHARD.index}/${SHARD.count} is one skip-baseline.json lists`, Array.isArray(res?.results) && !unlisted.length,
            `${skips.length} skipped, ${baseline.skips.length} listed; not listed: ${unlisted.join("; ") || "none"}`);
    } else {
        check("gm: the skips are exactly the ones skip-baseline.json lists", Array.isArray(res?.results) && !unlisted.length && !answering.length,
            `${skips.length} skipped, ${baseline.skips.length} listed; not listed: ${unlisted.join("; ") || "none"}; listed and now answering: ${answering.join("; ") || "none"}`);
    }
    const list = res?.shard?.list ?? [];
    check("gm: the suite says which tier-2 tests this run took of which list", Array.isArray(res?.shard?.ran) && list.length > 0
        && res.shard.index === SHARD.index && res.shard.count === SHARD.count,
        JSON.stringify({ shard: res?.shard ? { index: res.shard.index, count: res.shard.count, ran: res.shard.ran?.length, list: list.length } : null }));
    await settle(300);
    return { suite: { passed: res?.passed, failed: res?.failed, skipped: res?.skipped, red: res?.red, results: res?.results ?? null },
        shard: { index: SHARD.index, count: SHARD.count, names: res?.shard?.ran ?? [], total: list.length, hash: listHash(list), list } };
}
