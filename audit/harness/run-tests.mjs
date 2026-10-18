/**
 * The suite's tiers from the command line (INFRA I1, 18.10.2026).
 * ---------------------------------------------------------------------------
 *     node run-tests.mjs [--tier 0|1|2] [--only <R number or piece of a name>]... [--verbose]
 *
 * Boots the cluster as 01-runtests does - four jsdom clients, the players' module
 * listeners silenced and their dialogs left unanswered, real windows on the GM -
 * and calls `game.drpg.runTests({ tier, only, confirmed: <this world's id> })` on
 * the GM's client. --tier is 1 when not given, as runTests' own default; --only
 * may be given more than once, and the list goes to runTests whole, where each
 * entry has to name a test in the tiers asked for (tests.mjs `matcherFor`). It
 * prints the runner's text between the SUITE OUTPUT lines suite-diff.mjs reads
 * (the whole text: 01-runtests cuts its copy at 30,000 characters), the cluster's
 * own lines only with --verbose, and then one last line:
 *
 *     run-tests: P passed, F failed, S skipped, R red
 *
 * Exit 0 only when F is 0, at least one test ran (a runner's own line, such as
 * "tier 0/1 changed nothing in the world", is not a test: its `assertions` is
 * null) and the cluster's results file is this run's and agrees with its exit
 * code; 1 otherwise, 2 on a usage error, 3 when the cluster left no results file
 * of this run. The results land in results/run-tests.json, with the suite's list
 * as `evidence.suite` - the shape of 01-runtests' - so `node suite-diff.mjs
 * a.json b.json --json` reads either.
 *
 * WHY, AND WHY NOT 01-RUNTESTS. 01 runs tiers 0-1 three times (in an incident, in
 * a trial, with no argument), the refused tier 2 twice and then the full tier 2:
 * the whole suite and its promises about itself, 38 minutes of `npm test` on 4
 * cores. A commit's own check before a push needs tiers 0-1 once, or the tier-2
 * tests it touched, by name. That was a scratch scenario run through cluster.mjs
 * with its arguments in the environment, outside the repository; this is the same
 * thing kept here, so the gate before a commit needs nothing outside the tree.
 *
 * ONE FILE, TWO ROLES. Run with node, this file spawns `cluster.mjs run-tests.mjs`
 * in a process group of its own (killed afterwards, as run-all.mjs kills its
 * clusters: a cluster that times out leaves its clients running otherwise), with
 * the arguments in DRPG_RUN_TESTS; imported by the cluster, its `run` is the
 * scenario. It lives beside cluster.mjs, not in scenarios/, so run-all.mjs and
 * the scenario registry never take it for a ci scenario.
 *
 * Measured here (4 cores, 18.10.2026, b101885 + this commit, nothing else running): `--tier 1` in
 * 212 s and 200 s wall in two runs, 449 tests ran and 450 results with the purity line - 435
 * passed, 0 failed, 15 skipped, the same rows as 01-runtests' full run on the same tree (suite-diff
 * --json on the tier-0/1 rows: identical); `--only R553` in 11.1 s wall, one test ran.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

export const layers = ["ci"];

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SELF = url.fileURLToPath(import.meta.url);
const RESULTS_FILE = path.join(HERE, "results", "run-tests.json");
const BEGIN = "---------------- SUITE OUTPUT ----------------";
const END = "----------------------------------------------";

/* Hang detectors, not benchmarks. Tier 2 has 01-runtests' bound for its full run (3600 s, the
   reasons in its comment C). Tiers 0-1 have 01's READ_ONLY_MS, 370 s: 1.5 times the slowest of
   its three readings of tier 1 (246 s, inside a Class Trial); `--tier 1` here read 212 s and 200 s
   on 18.10.2026. The process as a whole has five minutes more for the boot and the shutdown. */
const EVAL_MS = { 0: 370_000, 1: 370_000, 2: 3_600_000 };

/* ------------------------------ the scenario ------------------------------ */

export async function run({ gm, p1, p2, p3, check }) {
    const { tier, only } = JSON.parse(process.env.DRPG_RUN_TESTS ?? "{}");
    // As 01-runtests: a player client answering a dialog it was sent, or its own listeners taking a packet,
    // would race the suite's measurements, and the GM's DialogV2 draws real windows (01, REAL WINDOWS ON THE GM).
    for (const c of [p1, p2, p3]) await c.eval(`globalThis.__dialogAuto = false; (game.socket._handlers.get("module.danganronpa-rpg") ?? []).length = 0; return true;`);
    await gm.eval(`globalThis.__dialogWindows = true; return true;`);
    const res = await gm.eval(`
        const r = await game.drpg.runTests({ tier: ${JSON.stringify(tier)}, only: ${JSON.stringify(only)}, confirmed: game.world.id });
        return { passed: r?.passed, failed: r?.failed, skipped: r?.skipped, red: r?.red, refused: r?.refused ?? null,
            results: r?.results ?? null, text: r?.text ?? "" };
    `, { timeout: EVAL_MS[tier] });
    console.log(BEGIN);
    console.log(res?.text ?? "");
    console.log(END);
    const ran = (res?.results ?? []).filter(r => r.assertions !== null).length;
    check("the suite ran", res && typeof res.passed === "number" && !res.refused, JSON.stringify({ refused: res?.refused }));
    check("at least one test ran", ran > 0, `${ran} tests ran`);
    check("nothing failed", res?.failed === 0, `${res?.failed} failed`);
    return { runTests: { tier, only, ran },
        suite: { passed: res?.passed, failed: res?.failed, skipped: res?.skipped, red: res?.red, results: res?.results ?? null } };
}

/* -------------------------------- the command ------------------------------ */

function usage(why) {
    console.log(`run-tests: ${why}\nusage: node run-tests.mjs [--tier 0|1|2] [--only <R number or piece of a name>]... [--verbose]`);
    process.exit(2);
}

function parseArgs(argv) {
    let tier = 1, verbose = false;
    const only = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--verbose") verbose = true;
        else if (a === "--tier") {
            const t = argv[++i];
            if (!["0", "1", "2"].includes(t)) usage(`--tier takes 0, 1 or 2, got ${JSON.stringify(t ?? null)}`);
            tier = Number(t);
        } else if (a === "--only") {
            const o = argv[++i];
            if (o === undefined || !o.trim()) usage("--only takes an R number or a piece of a test's name");
            only.push(o.trim());
        } else usage(`unknown argument ${JSON.stringify(a)}`);
    }
    return { tier, only: only.length ? only : null, verbose };
}

/** Kill a detached child's whole process group; nothing to do when it is already gone (run-all.mjs's). */
function killGroup(pid) {
    if (!pid) return;
    if (process.platform === "win32") {
        try { spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ }
        return;
    }
    try { process.kill(-pid, "SIGKILL"); } catch { /* the group is already empty */ }
}

async function main() {
    const { tier, only, verbose } = parseArgs(process.argv.slice(2));
    const t0 = Date.now();
    const started = new Date(t0 - 1000);  // a second of slack, as run-all.mjs allows
    fs.rmSync(RESULTS_FILE, { force: true });
    const child = spawn(process.execPath, [path.join(HERE, "cluster.mjs"), SELF, ...(verbose ? ["--verbose"] : [])], {
        cwd: HERE, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0", DRPG_RUN_TESTS: JSON.stringify({ tier, only }) }
    });
    for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { killGroup(child.pid); process.exit(1); });
    // Without --verbose only the runner's text goes through, line by line as it comes.
    let inside = false, buffer = "";
    const take = chunk => {
        if (verbose) { process.stdout.write(chunk); return; }
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
            if (line === BEGIN) inside = true;
            if (inside) console.log(line);
            if (line === END) inside = false;
        }
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killGroup(child.pid); }, EVAL_MS[tier] + 5 * 60_000);
    const code = await new Promise(resolve => {
        let exit = null;
        child.on("exit", c => { exit = c; killGroup(child.pid); });
        child.on("close", c => { clearTimeout(timer); killGroup(child.pid); resolve(exit ?? c); });
    });
    const seconds = Math.round((Date.now() - t0) / 100) / 10;
    let doc = null;
    try { doc = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8")); } catch { /* said below */ }
    if (!doc || !(new Date(doc.startedAt) >= started)) {
        console.log(`run-tests: the cluster left no results file of this run (exit ${code}${timedOut ? ", timed out" : ""}, ${seconds} s)`);
        console.log("run-tests: 0 passed, 0 failed, 0 skipped, 0 red");
        process.exit(3);
    }
    const s = doc.evidence?.suite ?? {};
    const ran = doc.evidence?.runTests?.ran ?? 0;
    const problems = (doc.results ?? []).filter(r => r.status === "fail").map(r => `${r.name}${r.reason ? ` - ${String(r.reason).slice(0, 300)}` : ""}`);
    if (timedOut) problems.push(`timed out after ${(EVAL_MS[tier] + 5 * 60_000) / 1000} s`);
    if ((code === 0) !== (doc.failed === 0)) problems.push(`the cluster exited ${code} while its checks said ${doc.failed} failed`);
    for (const p of problems) console.log(`run-tests: RED - ${p}`);
    console.log(`run-tests: tiers 0-${tier}${only ? `, only ${only.map(o => JSON.stringify(o)).join(", ")}` : ""}: ${ran} tests ran, ${seconds} s wall`);
    console.log(`run-tests: ${s.passed ?? 0} passed, ${s.failed ?? 0} failed, ${s.skipped ?? 0} skipped, ${s.red ?? 0} red`);
    process.exit(problems.length || s.failed !== 0 || !(ran > 0) ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) await main();
