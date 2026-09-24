/**
 * Danganronpa RPG - the regression suite.
 * ---------------------------------------------------------------------------
 *     game.drpg.runTests()            everything
 *     game.drpg.runTests({ tier: 1 }) regressions + invariants, world untouched
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
 *          REGRESSIONS for the six that got out before it existed.
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
 * FIVE FILES (E30, audit S17-02). This file is the runner, and the only one of
 * the five anything outside the suite imports (api.mjs, lazily). The tests are
 * in tests-tier0.mjs, tests-tier1.mjs and tests-tier2.mjs, and what more than
 * one tier uses is in tests-kit.mjs. They sit flat in scripts/ because the
 * source crawl - moduleSources() here, loadedFiles() in diagnostics.mjs - only
 * follows "./x.mjs". A tier file imports no suite file but the kit, which writes
 * nothing to the world; the fixtures that write, snapshot() and restore(), are
 * in tests-tier2.mjs.
 */

import { log, warn } from "./utils.mjs";
import { studentActors } from "./monokuma.mjs";
import {
    Failure, Skipped, layoutAvailable, settle, worldFingerprint, watchWrites, fingerprintDiff
} from "./tests-kit.mjs";
import { REGRESSIONS } from "./tests-tier0.mjs";
import { INVARIANTS } from "./tests-tier1.mjs";
import { SCENARIOS, snapshot, restore } from "./tests-tier2.mjs";

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
 * @param {0|1|2} [options.tier]  0 reads the module's own source; 1 adds the
 *                                invariants; 2 also runs the scenarios.
 */
/**
 * @param {object} [options]
 * @param {number} [options.tier=2]  0 source reads, 1 adds invariants, 2 adds scenarios.
 * @param {string} [options.only]    Run only the tests whose name contains this, in
 *   every tier up to `tier`. For the loop of fixing one thing: a full run is four
 *   minutes, and the scenario being fixed is one of them. The world is still
 *   snapshotted and restored around the scenarios that run.
 */
export async function runTests({ tier = 2, only = null } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (inFlight) {
        const why = game.i18n.localize("DRPG.Tests.alreadyRunning");
        ui.notifications.warn(why);
        warn("Refused a second regression suite: one is already running on this client.");
        return { passed: 0, failed: 0, text: why, refused: true };
    }
    inFlight = true;
    // Every roll the scenarios make skips the configuration window - see
    // `suiteRolling` in action-rolls.mjs for why, and the scenario named "the
    // roll window opens, locked" for what still covers it.
    if (game.drpg) game.drpg.suiteRolling = true;
    try {
        return await runSuite(tier, only);
    } finally {
        if (game.drpg) game.drpg.suiteRolling = false;
        inFlight = false;
    }
}

async function runSuite(tier, only = null) {
    const lines = [];
    let passed = 0, failed = 0, skipped = 0;
    const wanted = only ? String(only).toLowerCase() : null;
    const pick = list => wanted ? list.filter(([name]) => name.toLowerCase().includes(wanted)) : list;

    const record = (name, err) => {
        if (err instanceof Skipped) {
            skipped++;
            lines.push(`  skip  ${name}`);
            lines.push(`        ${err.message}`);
        } else if (err) {
            failed++;
            lines.push(`  FAIL  ${name}`);
            lines.push(`        ${err instanceof Failure ? err.message : `threw: ${err?.message ?? err}`}`);
        } else {
            passed++;
            lines.push(`  ok    ${name}`);
        }
    };

    // Tier 0 runs at every level, including `{ tier: 1 }` - the round-by-round
    // pass E17 makes on the way in and on the way out. It is the cheapest thing
    // in the suite to be wrong about and the most expensive to skip: a divergence
    // it would have caught costs four releases, not one run.
    const untouched = worldFingerprint();
    let running = null;
    const writes = watchWrites(() => running);
    try {
        lines.push("TIER 0 - module-wide regression (source is read, not called)");
        for (const [name, fn] of pick(REGRESSIONS)) {
            running = name;
            try { await fn(); record(name, null); } catch (err) { record(name, err); }
            running = null;
        }

        if (tier >= 1) {
            lines.push("");
            lines.push("TIER 1 - invariants (the world is not touched)");
            for (const [name, fn] of pick(INVARIANTS)) {
                running = name;
                try { await fn(); record(name, null); } catch (err) { record(name, err); }
                running = null;
            }
        }

        // THE PROMISE, CHECKED (E01, audit S14-01): tier 0 and tier 1 are what a GM is
        // told may be run during play. A write that lands a moment after its test is a
        // write all the same, so the reading waits for one settle first.
        await settle();
    } finally {
        writes.stop();
    }
    const moved = fingerprintDiff(untouched, worldFingerprint());
    if (moved.length) {
        failed++;
        lines.push(`  FAIL  tier 0/1 changed the world`);
        lines.push(`        moved: ${moved.slice(0, 12).join("; ")}${moved.length > 12 ? `; and ${moved.length - 12} more` : ""}`);
        const when = [...new Set(writes.seen)];
        if (when.length) lines.push(`        written: ${when.slice(0, 8).join("; ")}${when.length > 8 ? `; and ${when.length - 8} more` : ""}`);
        lines.push("        (run during play, a player acting or a timer running out moves these too; a write during a test is that test's)");
    } else {
        passed++;
        lines.push(`  ok    tier 0/1 changed nothing in the world`);
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
        lines.push("        Close it from the incident tracker (Close the murder) and run again.");
        lines.push("        The scenarios end every incident they find, so this one would go with them.");
        failed++;
        tier = 1;
    }

    if (tier >= 2) {
        lines.push("");
        lines.push("TIER 2 - scenarios (fixtures built and put back)");
        let snap = null;
        try {
            snap = await snapshot(studentActors());
        } catch (err) {
            lines.push(`  FAIL  could not record the world before testing: ${err.message}`);
            failed++;
        }

        if (snap) {
            for (const [name, fn] of pick(SCENARIOS)) {
                try {
                    await fn();
                    record(name, null);
                } catch (err) {
                    record(name, err);
                } finally {
                    // After EVERY scenario, not once at the end: a scenario that
                    // fails half way leaves an incident open, and the next one
                    // would then be testing the wreckage of the last.
                    try {
                        await game.drpg.endMurder({ reason: "test", followUp: false });
                        await restore(snap);
                    } catch (err) {
                        // A FAILURE, not a footnote (E01, audit S14-10). This was a
                        // line in the report with nothing counted, so a run that left
                        // the world dirty could still say "0 failed" at the top.
                        failed++;
                        lines.push(`  FAIL  could not restore the world after "${name}"`);
                        lines.push(`        ${err?.message ?? err}`);
                    }
                }
            }
        }
    }

    // the skipped count is always printed, including as a zero: a run that says
    // "0 skipped" is a run in a browser that could answer everything, and that is
    // worth being able to see at a glance
    const summary = `${passed} passed, ${failed} failed, ${skipped} skipped`;
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
    const text = [`Danganronpa RPG - regression suite`, summary, ...(skipNote ? [skipNote] : []), "", ...lines].join("\n");
    console.log(text);
    if (failed || skipNote) ui.notifications.warn(skipNote ? `${summary} - ${skipNote}` : summary);
    else ui.notifications.info(summary);
    log(`Regression suite: ${summary}`);
    return { passed, failed, skipped, text };
}
