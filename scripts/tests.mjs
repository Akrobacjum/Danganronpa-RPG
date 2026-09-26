/**
 * Danganronpa RPG - the regression suite.
 * ---------------------------------------------------------------------------
 *     game.drpg.runTests()            tiers 0 and 1: source regressions and invariants, read-only
 *     game.drpg.runTests({ tier: 2 }) adds the scenarios, which write - and asks first, in a window
 *     game.drpg.runTests({ tier: 0 }) the module-wide regression pass alone
 *
 * WHAT IS IN HERE AND WHY. Not "coverage" - the things that have actually been
 * broken. Every tier-2 scenario below is a bug somebody hit at the table or a
 * measurement that caught the module lying: the killers' side acting twice per
 * round, a Finishing Blow that announced a death and left the victim standing,
 * a body nobody could discover, Observe reaching past the murder for a trace
 * from three days earlier. A suite written from the feature list would have
 * passed on every one of those, because each was a function doing exactly what
 * it said while the rules underneath it were wrong.
 *
 * THREE TIERS, and the split is about consequences, not speed.
 *
 *   Tier 0 reads THIS MODULE'S OWN SOURCE, fetched from the server that is
 *          already serving it. It is the answer to a class of defect the other
 *          two tiers cannot see: not wrong logic, but code that says one thing
 *          and does another somewhere nothing throws. See the block above
 *          REGRESSIONS, in tests-tier0.mjs, for the six that got out before
 *          it existed.
 *   Tier 1 reads. It cannot change the world, so it is safe to run at any point
 *          in a session, including during play. That used to be a promise; it is
 *          a check now (E01, audit S14-01): the world is read before tier 0 and
 *          after tier 1, and any difference is a failure that names what moved.
 *   Tier 2 writes. It opens incidents, kills people and resets seasons - so it
 *          builds its own fixtures, records what it displaced, and puts
 *          everything back. Never run it in a world somebody is playing in.
 *
 * NO DICE. Every scenario drives the resolver directly with a total, because a
 * roll dialog needs a browser tab that is compositing frames and a suite that
 * only passes in a foreground window is a suite that fails in CI and in a
 * backgrounded tab for reasons that have nothing to do with the module.
 *
 * SEVEN FILES (E30, audit S17-02). This file is the runner, and the only one the
 * module itself imports (api.mjs, lazily). The tests are in tests-tier0.mjs,
 * tests-tier1.mjs and tests-tier2.mjs, and what more than one tier uses is in
 * tests-kit.mjs. The kit takes the contract's detectors from tests-lint.mjs and
 * the flows from tests-flows.mjs; those two import nothing, so bare Node reads
 * them too - tests-lint.mjs in tools/check.mjs, tools/stages.mjs and
 * tools/registry.mjs, tests-flows.mjs in tools/registry.mjs and the harness's
 * cluster - and audit/live's runner imports the kit in the page, for worldDump.
 * They sit flat in scripts/ because the source crawl -
 * moduleSources() here, loadedFiles() in diagnostics.mjs - only follows
 * "./x.mjs". A tier file imports no suite file but the kit, which writes nothing
 * to the world; the fixtures that write, snapshot() and restore(), are in
 * tests-tier2.mjs.
 */

import { log, warn, esc, plural, dialogContent } from "./utils.mjs";
import { studentActors } from "./monokuma.mjs";
import {
    layoutAvailable, settle, worldDump, dumpDiff, describeDiff, watchWrites, runOne, stageLedger, registerSuite, worldCensus
} from "./tests-kit.mjs";
import { REGRESSIONS } from "./tests-tier0.mjs";
import { INVARIANTS } from "./tests-tier1.mjs";
import { SCENARIOS, snapshot, restore } from "./tests-tier2.mjs";
import { gmStoreHold, gmStoresIdle, gmStoreHandles, gmCopyNames, gmCopySpec } from "./gm-store.mjs";
import { MODULE_ID } from "./config.mjs";

// Every tier, for the tests that read the suite itself (R155): see registerSuite.
registerSuite([[0, REGRESSIONS], [1, INVARIANTS], [2, SCENARIOS]]);

/* ==========================================================================
 * RUNNER
 * ========================================================================== */

/**
 * Is a run already in flight on this client?
 *
 * TWO RUNS AT ONCE CORRUPT THE WORLD, and quietly. Measured: a probe that
 * appeared to time out was still running when a second `runTests()` was
 * started, and the pair reported 16/22 with six murder scenarios failing on
 * "stage after opening - expected openingRoll, measured undefined". Not one of
 * those failures was real. The Eclipse scenario sets `clock.eclipse` true for
 * the length of its own check, and `openMurder` refuses outright during an
 * Eclipse - so every murder scenario in the other run was declined by a gate
 * working exactly as designed.
 *
 * The damage outlives the run. `snapshot()` records the clock as the baseline
 * to put back, and the second run took its snapshot while the first was mid-
 * Eclipse: it then faithfully restored the world to a darkness that was a
 * fixture. The world was left with `eclipse: true` set, which is a state a GM
 * cannot easily see and which silently refuses every murder in the session
 * after it.
 *
 * So a second run is refused rather than queued. Queueing would be the wrong
 * answer for a suite whose whole contract is "the world is put back exactly as
 * it was found" - a caller who did not know the first run was in flight does
 * not want the second one to happen later either; they want to be told.
 */
let inFlight = false;

/**
 * @param {object} [options]
 * @param {0|1|2} [options.tier=1]  0 reads the module's source; 1 adds the read-only
 *   invariants - the default, safe during play, and checked to be (the whole world is
 *   read before and after); 2 adds the scenarios, which WRITE, and asks first.
 * @param {string} [options.only]    Run only these tests, in every tier up to `tier`:
 *   an R number ("R15") names that one test, anything else is a piece of a name.
 *   For the loop of fixing one thing: a full run is four minutes, and the
 *   scenario being fixed is one of them. The world is still snapshotted and
 *   restored around the scenarios that run.
 * @param {string} [options.confirmed] Tier 2 only: THIS world's id (game.world.id),
 *   for a caller that cannot answer a window (the headless harness). Anything else -
 *   `true` included - opens the window, so a line copied from a handbook into a
 *   campaign world still asks.
 * @returns {Promise<{passed: number, failed: number, skipped: number, red: number, text: string,
 *   results: {tier: number, name: string, outcome: "pass"|"fail"|"skip"|"red", message?: string,
 *   probe?: string, assertions: number|null}[], refused?: "running"|"cancelled"}|null>}
 */
export async function runTests({ tier = 1, only = null, confirmed = null } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (inFlight) {
        const why = game.i18n.localize("DRPG.Tests.alreadyRunning");
        ui.notifications.warn(why);
        warn("Refused a second regression suite: one is already running on this client.");
        return { passed: 0, failed: 0, skipped: 0, red: 0, results: [], text: why, refused: "running" };
    }
    /*
     * READING BY DEFAULT (E30, 24.09.2026; decision D25, audit S17-06). The default
     * was tier 2, which opens incidents, kills students and resets seasons in
     * fixtures it builds and removes - one bare `runTests()` in a campaign world was a
     * suite writing to it. The default is now the tiers that only read, and tier 2
     * asks, in a window that names the world, with Cancel first and the default.
     * An incident already open keeps the old path: tiers 0 and 1 run, and tier 2 is
     * refused and counted - no window, since there is nothing to confirm.
     */
    tier = [0, 1, 2].includes(Number(tier)) ? Number(tier) : 1;
    inFlight = true;
    try {
        if (tier === 2 && !game.drpg?.murderState?.()) {
            if (await confirmTier2(confirmed) !== "run") {
                const text = game.i18n.localize("DRPG.Tests.tier2Cancelled");
                ui.notifications.info(text);
                return { passed: 0, failed: 0, skipped: 0, red: 0, results: [], text, refused: "cancelled" };
            }
        }
        // Every roll the scenarios make skips the configuration window - see
        // `suiteRolling` in action-rolls.mjs for why, and the scenario named "the
        // roll window opens, locked" for what still covers it.
        if (game.drpg) game.drpg.suiteRolling = true;
        return await runSuite(tier, only);
    } finally {
        if (game.drpg) game.drpg.suiteRolling = false;
        inFlight = false;
    }
}

/**
 * "run" when this world's id was handed over, or when the GM pressed Run in the
 * window; anything else (Cancel, Enter, the window closed) is a no.
 */
async function confirmTier2(confirmed) {
    const { id, title } = game.world;
    if (confirmed === id) return "run";
    if (confirmed !== null && confirmed !== undefined) {
        warn(game.i18n.format("DRPG.Tests.confirmedNotThisWorld", { given: String(confirmed), id }));
    }
    const others = game.users.filter(u => u.active && u.id !== game.user.id).length;
    return foundry.applications.api.DialogV2.wait({
        classes: ["drpg-panel", "drpg-window-suite-tier2"],
        window: { title: game.i18n.format("DRPG.Tests.tier2Title", { title }) },
        content: dialogContent(`<p class="drpg-warning">${esc(game.i18n.localize("DRPG.Tests.tier2What"))}</p>
            <p><strong>${esc(game.i18n.format("DRPG.Tests.tier2Where", { title, id }))}</strong></p>
            ${others ? `<p class="drpg-warning">${esc(plural("DRPG.Tests.tier2Online", { n: others }))}</p>` : ""}
            <p class="notes">${esc(game.i18n.localize("DRPG.Tests.tier2Advice"))}</p>`),
        /* CANCEL FIRST AND DEFAULT. HTML's implicit submission (Enter in a form) takes
           the FIRST submit button in tree order, and `default` is the button Foundry
           marks; Cancel is both, and the window has no input to hold focus, so Enter
           can only cancel. (The season reset puts Cancel last with a typed word - there
           the word is the confirmation; here there is none.) That Enter cancels in a
           real v14 window is a live check, not measured here. */
        buttons: [
            { action: "cancel", label: game.i18n.localize("DRPG.Tests.cancel"), default: true },
            { action: "run", label: game.i18n.format("DRPG.Tests.tier2Run", { title }), class: "drpg-gm-route" }
        ],
        rejectClose: false
    });
}

/*
 * WHICH TESTS `only` MEANS (E30, 24.09.2026). It was a piece of the name, lower-
 * cased, so `only: "R15"` ran R15 and R150-R155 with it - seven tests where one
 * was meant - and `only: "R1"` ran fifty-six (counted over the tier files'
 * names that day). An R number is now matched whole against the name's first
 * word; anything else is still a piece of the name.
 */
function matcherFor(only) {
    if (only === null || only === undefined || only === "") return () => true;
    const wanted = String(only).trim().toLowerCase();
    if (/^r\d+[a-z]?$/.test(wanted)) return name => name.split(/\s/)[0].toLowerCase() === wanted;
    return name => name.toLowerCase().includes(wanted);
}

async function runSuite(tier, only = null) {
    const lines = [], results = [];
    let passed = 0, failed = 0, skipped = 0, red = 0;
    const wanted = matcherFor(only);
    const pick = list => list.filter(([name]) => wanted(name));

    /*
     * ONE RECORD PER RESULT (E30, 24.09.2026). Every line the report prints comes
     * from a record in `results`, the runner's own lines included (the purity
     * check, a refused tier 2, a restore that failed), so a reader that counts the
     * records - 01-runtests, suite-diff --json - counts what the summary counts.
     */
    const record = r => {
        results.push(r);
        const detail = text => String(text ?? "").split("\n").map(l => `        ${l}`);
        if (r.outcome === "pass") { passed++; lines.push(`  ok    ${r.name}`); return; }
        if (r.outcome === "skip") { skipped++; lines.push(`  skip  ${r.name}`, ...detail(r.message)); return; }
        if (r.outcome === "red") {
            red++;
            lines.push(`  red   ${r.name}`, ...detail(`${r.message} - fails at: ${r.failedAt}`));
            return;
        }
        failed++;
        lines.push(`  FAIL  ${r.name}`, ...detail(r.message));
    };

    /*
     * AN `only` THAT RAN NOTHING IS NOT A GREEN RUN (E30 review, 25.09.2026). A name
     * that matched no test in the tiers asked for printed "1 passed, 0 failed" - the
     * purity line alone - and so did `runTests({ only: "legacy trace" })` once the
     * default became tier 1, the test it names being a tier-2 scenario. Said as a
     * failure, with the tier where the name does match, if there is one.
     */
    if (only !== null && only !== undefined && only !== "") {
        const tiers = [[0, REGRESSIONS], [1, INVARIANTS], [2, SCENARIOS]];
        if (!tiers.some(([t, list]) => t <= tier && pick(list).length)) {
            const later = tiers.filter(([t, list]) => t > tier && pick(list).length);
            record({ tier, name: `only "${only}" names a test in tiers 0-${tier}`, outcome: "fail", assertions: null,
                message: later.length
                    ? later.map(([t, list]) => {
                        const n = pick(list).length;
                        return `it names ${n} test${n === 1 ? "" : "s"} in tier ${t} - runTests({ tier: ${t}, only: ${JSON.stringify(only)} })`;
                    }).join("; ")
                    : "no test in any tier has that in its name" });
        }
    }

    // The stage ledger, once per run: a red marker is held to it (expectedRed in tests-kit.mjs).
    const ledger = await stageLedger();
    const notes = ledger ? [] : ["stage ledger not served by this install: whether a marked stage has shipped was checked at release, not here"];

    // Tier 0 runs at every level, including `{ tier: 1 }` - the round-by-round
    // pass E17 makes on the way in and on the way out. It is the cheapest thing
    // in the suite to be wrong about and the most expensive to skip: a divergence
    // it would have caught costs four releases, not one run.
    const more = (list, n) => (list.length > n ? `; and ${list.length - n} more` : "");
    const untouched = await worldDump();
    let running = null;
    const writes = watchWrites(() => running);
    try {
        lines.push("TIER 0 - module-wide regression (source is read, not called)");
        for (const entry of pick(REGRESSIONS)) {
            running = entry[0];
            record(await runOne(entry, { tier: 0, ledger }));
            running = null;
        }

        if (tier >= 1) {
            lines.push("");
            lines.push("TIER 1 - invariants (the world is not touched)");
            for (const entry of pick(INVARIANTS)) {
                running = entry[0];
                record(await runOne(entry, { tier: 1, ledger }));
                running = null;
            }
        }

        // THE PROMISE, CHECKED (E01, audit S14-01): tier 0 and tier 1 are what a GM is
        // told may be run during play. A write that lands a moment after its test is a
        // write all the same, so the reading waits for one settle first. The whole world
        // is read (worldDump, E30), not the parts E01 knew to fingerprint.
        await settle();
        const moved = dumpDiff(untouched, await worldDump());
        const purity = { tier: 1, name: "tier 0/1 changed nothing in the world", assertions: null };
        if (moved.length) {
            const when = [...new Set(writes.seen)];
            record({ ...purity, outcome: "fail", message: [
                `moved: ${moved.slice(0, 12).map(describeDiff).join("; ")}${more(moved, 12)}`,
                ...(when.length ? [`written: ${when.slice(0, 8).join("; ")}${more(when, 8)}`] : []),
                "(run during play, a player acting or a timer running out moves these too; a write during a test is that test's)"
            ].join("\n") });
        } else {
            record({ ...purity, outcome: "pass" });
        }

        /*
         * TIER 2 WILL NOT START ON TOP OF AN INCIDENT (20.09).
         *
         * Every scenario's `finally` ends the murder and restores the fixtures, which is
         * right for the ones it opened and wrong for one a table is in the middle of: a
         * suite run started during a fight closes that fight, and the world it puts back
         * is the one the suite recorded a moment ago rather than the one the incident had
         * moved on from. Paid for in the QA world, where a run that died left an incident
         * behind and the next run cheerfully closed it.
         *
         * Tier 0 and tier 1 are unaffected - they read and never write - so this refuses
         * the scenarios only, and says which state it found.
         */
        if (tier >= 2 && game.drpg?.murderState?.()) {
            lines.push("");
            lines.push("TIER 2 - REFUSED: an incident is open in this world.");
            record({ tier: 2, name: "tier 2 would not start on top of an open incident", outcome: "fail", assertions: null,
                message: "Close it from the incident tracker (Close the murder) and run again.\n"
                    + "The scenarios end every incident they find, so this one would go with them." });
            tier = 1;
        }

        if (tier >= 2) {
            lines.push("");
            lines.push("TIER 2 - scenarios (fixtures built and put back)");
            /* What the world is made of, in one line, before anything is built in it
               (E30, audit S14-24): a scenario the world is too small for skips and
               says what it lacked, and this is the line to read that against. */
            lines.push(worldCensus());
            /*
             * THE GM STORE SENDS NOTHING WHILE TIER 2 RUNS (E04, 1.2.63). The restore
             * below writes each store's key back raw, on this client only; a delta sent
             * during a scenario would stay on another GM's browser and come back at the
             * next exchange, undoing the restore there. So nothing leaves this client
             * until the last restore; what arrives still merges, and the release sends a
             * hello, which re-exchanges with the other GMs.
             */
            gmStoreHold(true);
            let snap = null;
            try {
                snap = await snapshot(studentActors());
            } catch (err) {
                record({ tier: 2, name: "could not record the world before testing", outcome: "fail", assertions: null,
                    message: err?.message ?? String(err) });
            }

            if (snap) {
                /*
                 * EVERY RESTORE, CHECKED AGAINST THE WHOLE WORLD (E30, 24.09.2026; audit
                 * S17-04). restore() read back only the module's settings; a token, a
                 * track or another module's setting a scenario left behind went unseen,
                 * and the next scenario measured against it. The world as tier 2 found
                 * it is read once, and again after every restore; what differs is a
                 * failure named after the scenario that left it - reported once, by that
                 * scenario - and a last reading after the run catches a write that
                 * landed after the last restore.
                 */
                const asFound = await worldDump();
                const reported = new Set();
                for (const entry of pick(SCENARIOS)) {
                    running = entry[0];
                    record(await runOne(entry, { tier: 2, ledger }));
                    running = null;
                    // After EVERY scenario, not once at the end: a scenario that
                    // fails half way leaves an incident open, and the next one
                    // would then be testing the wreckage of the last.
                    let broke = null;
                    try {
                        await game.drpg.endMurder({ reason: "test", followUp: false });
                        // A store write not yet flushed would land on top of the raw restore.
                        await gmStoresIdle();
                        await restore(snap);
                    } catch (err) {
                        broke = err;
                    }
                    const left = dumpDiff(asFound, await worldDump()).filter(d => !reported.has(d.path));
                    if (broke || left.length) {
                        // A FAILURE, not a footnote (E01, audit S14-10): a run that left
                        // the world dirty must not say "0 failed" at the top.
                        record({ tier: 2, name: `could not restore the world after "${entry[0]}"`, outcome: "fail", assertions: null,
                            message: [
                                ...(broke ? [broke?.message ?? String(broke)] : []),
                                ...(left.length ? [`restore left: ${left.slice(0, 12).map(describeDiff).join("; ")}${more(left, 12)}`] : [])
                            ].join("\n") });
                        left.forEach(d => reported.add(d.path));
                    }
                }
                await settle();
                const late = dumpDiff(asFound, await worldDump()).filter(d => !reported.has(d.path));
                record({ tier: 2, name: "tier 2 put the world back as it found it", assertions: null,
                    ...(late.length
                        ? { outcome: "fail", message: `left after the last restore: ${late.slice(0, 12).map(describeDiff).join("; ")}${more(late, 12)}` }
                        : { outcome: "pass" }) });
                /*
                 * NO OLD KEY OF THE GM STORE WAS WRITTEN (E04's fix round; the review's
                 * DS-m5). The old keys hold what the upgrade left - another world's rows
                 * nobody claimed, a downgrade's copy - and nothing else holds it. Tier 2's
                 * restore would have put back a key a test wrote, but a tab closed in between
                 * would not; the tests hand their fixtures to `withGmStoreLegacy` instead, and
                 * this reads the whole run's writes for any that reached one. R171 reads the
                 * source for the names; this is the write itself.
                 */
                const oldKeys = [...new Set([
                    ...gmStoreHandles().map(h => h.spec.legacyKey),
                    ...gmCopyNames().flatMap(name => [gmCopySpec(name)?.legacyKey, ...(gmCopySpec(name)?.legacyKeys ?? [])])
                ].filter(Boolean))];
                const wroteOld = [...new Set(writes.seen.filter(w => oldKeys.some(k => w.startsWith(`setting ${MODULE_ID}.${k} `))))];
                record({ tier: 2, name: "the suite wrote no old key of the GM store", assertions: null,
                    ...(wroteOld.length
                        ? { outcome: "fail", message: `written: ${wroteOld.slice(0, 6).join("; ")}${more(wroteOld, 6)}` }
                        : { outcome: "pass" }) });
            }
        }
    } finally {
        writes.stop();
        // Released whatever happened above; a hold the suite never took is released as a no-op.
        gmStoreHold(false);
    }

    // the skipped count is always printed, including as a zero: a run that says
    // "0 skipped" is a run in a browser that could answer everything, and that is
    // worth being able to see at a glance. The red count only when there is one:
    // other tools parse "N passed, N failed, N skipped" and it is kept as it was.
    const summary = `${passed} passed, ${failed} failed, ${skipped} skipped${red ? `, ${red} red until a later stage` : ""}`;
    // Every skip stands on a probe (needs() in tests-kit.mjs), so they are counted by it.
    const byProbe = new Map();
    for (const r of results) if (r.outcome === "skip") byProbe.set(r.probe, (byProbe.get(r.probe) ?? 0) + 1);
    if (byProbe.size) {
        notes.unshift(`skipped by probe: ${[...byProbe].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${n}`).join(", ")}`);
    }
    /*
     * A SKIP IN A BROWSER IS NEWS (E01, 24.09.2026; audit S14-05). The skipped count
     * is asserted only by the headless harness, which has no layout and expects a
     * handful. In a browser that lays out, most of the reasons a test gives for not
     * answering - no layout, no canvas, no fonts - are false, so whatever is left is
     * either a real fact about this table (the Legacy theme, a world with nobody
     * playing a character) or a test that stopped being able to answer. It is said
     * out loud with the number rather than folded into a green notice.
     */
    const inBrowser = layoutAvailable();
    const skipNote = inBrowser && skipped
        ? `${skipped} test${skipped === 1 ? "" : "s"} could not answer in a browser that lays out - read each reason below`
        : null;
    const text = [`Danganronpa RPG - regression suite`, summary, ...(skipNote ? [skipNote] : []), ...notes, "", ...lines].join("\n");
    console.log(text);
    if (failed || skipNote) ui.notifications.warn(skipNote ? `${summary} - ${skipNote}` : summary);
    else ui.notifications.info(summary);
    log(`Regression suite: ${summary}`);
    return { passed, failed, skipped, red, text, results };
}
