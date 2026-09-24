/**
 * npm test: the one command for the 'ci' layer of the release gate (E30, audit S17-05, decision D47).
 * ---------------------------------------------------------------------------
 *     node run-all.mjs [lint] [check] [gate] [suite] [scenarios] [--only NN-name] [--verbose]
 *
 * With no part named, all five run, in that order. `npm test` is this with no
 * argument; `npm run quick` is lint, check and gate. The checkout is DRPG_REPO,
 * or the one this file sits in - the same rule as cluster.mjs.
 *
 *   lint       ESLint over the repository with the root eslint.config.mjs
 *              (no-undef). Red on any problem, and red when the files it read
 *              do not include every scripts/*.mjs: a config pattern that stops
 *              matching would otherwise read as "0 problems".
 *   check      node tools/check.mjs, every part.
 *   gate       node ../gate/verify-gate.mjs --self-test: the release gate's
 *              verifier, on a throwaway repository it builds itself.
 *   suite      scenarios/01-runtests.mjs - the module's own suite, tiers 0-2,
 *              on the harness's disposable world.
 *   scenarios  every other scenarios/*.mjs whose `layers` include "ci", in
 *              number order; `--only 14-quiet` narrows it to one.
 *
 * WHY THIS FILE AND NOT A LINE OF SHELL PER SCENARIO. Until E30 nothing ran the
 * harness as a whole, and the cluster's exit code said 0 whatever its checks
 * said (cluster.mjs, the exit code comment): 11-killer-secrecy at 5/6 and
 * 40-flow at 37/38 both exited 0 in the 1.2.60 baseline. That is fixed in the
 * cluster, and this file does not trust the fix alone. For each scenario it
 * wants a results file written by this run (its `startedAt` at or after the
 * spawn), with at least one check, and an exit code that agrees with the
 * verdicts in it; any of those missing is red, whatever the rest says. Each
 * cluster is spawned detached, in a process group of its own, and the group is
 * killed afterwards: a scenario that timed out or crashed leaves its four
 * jsdom clients running otherwise, and on a 4-core machine the next scenario's
 * timing-bound checks then flake (STATE.md, and twice in the E30 sessions).
 *
 * Output: a table per part on the console; results/run-all.json (gitignored,
 * with results/); a Markdown copy appended to $GITHUB_STEP_SUMMARY when that is
 * set. Exit 0 when every part is green, 1 when one is red, 2 on a usage error.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(process.env.DRPG_REPO || path.resolve(HERE, "../.."));
const RESULTS = path.join(HERE, "results");
const PART_NAMES = ["lint", "check", "gate", "suite", "scenarios"];
const SUITE = "01-runtests";
/* Hang detectors, not benchmarks. The suite took 5m15s-5m23s here on 24.09.2026
   (C20's runs, 4 cores); 12 minutes leaves room for a slower runner. The other
   scenarios took 0.4-62 s. A scenario may say otherwise with `export const timeoutMs`. */
const SUITE_TIMEOUT_MS = 12 * 60_000;
const SCENARIO_TIMEOUT_MS = 5 * 60_000;
const LAYERS_RE = /export const layers = (\[[^\]]*\])/;
const TIMEOUT_RE = /export const timeoutMs = (\d+)/;

function usage(why) {
    console.log(`run-all: ${why}\nusage: node run-all.mjs [${PART_NAMES.join("] [")}] [--only NN-name] [--verbose]`);
    process.exit(2);
}

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");
const onlyAt = argv.indexOf("--only");
const ONLY = onlyAt >= 0 ? argv[onlyAt + 1] : null;
if (onlyAt >= 0 && !ONLY) usage("--only takes a scenario name, e.g. --only 14-quiet");
const asked = argv.filter((a, i) => !a.startsWith("--") && !(onlyAt >= 0 && i === onlyAt + 1));
for (const a of asked) if (!PART_NAMES.includes(a)) usage(`no part named "${a}"`);
const parts = asked.length ? PART_NAMES.filter(p => asked.includes(p)) : PART_NAMES;

/* --------------------------------- running --------------------------------- */

/** Kill a detached child's whole process group; nothing to do when it is already gone. */
function killGroup(pid) {
    if (!pid) return;
    if (process.platform === "win32") {
        try { spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ }
        return;
    }
    try { process.kill(-pid, "SIGKILL"); } catch { /* the group is already empty */ }
}

/**
 * Run a command in its own process group; resolve with its exit code, whether it
 * timed out and its output. Output goes to `logFile` when given, and to the
 * console as well with --verbose (always, for a command without a log file).
 */
function run(cmd, args, { cwd, timeoutMs, logFile = null }) {
    return new Promise(resolve => {
        const t0 = Date.now();
        const log = logFile ? fs.createWriteStream(logFile) : null;
        let text = "";
        const child = spawn(cmd, args, { cwd, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, FORCE_COLOR: "0" } });
        const take = chunk => {
            text += chunk;
            log?.write(chunk);
            if (VERBOSE || !log) process.stdout.write(chunk);
        };
        child.stdout.on("data", take);
        child.stderr.on("data", take);
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; killGroup(child.pid); }, timeoutMs);
        child.on("error", err => take(`\n[run-all] could not start ${cmd}: ${err.message}\n`));
        let exit = null;
        /* The clients a cluster forks share its output pipes, so "close" waits for the
           last of them: on "exit" the group is killed, which reaps any that outlived
           the cluster, and "close" follows. */
        child.on("exit", (code, signal) => { exit = { code, signal }; killGroup(child.pid); });
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            killGroup(child.pid);
            log?.end();
            resolve({ code: exit?.code ?? code, signal: exit?.signal ?? signal, timedOut, text, ms: Date.now() - t0 });
        });
    });
}

/* ---------------------------------- parts ---------------------------------- */

async function lint() {
    const t0 = Date.now();
    const { ESLint } = await import("eslint");
    const eslint = new ESLint({ cwd: REPO });
    const results = await eslint.lintFiles(["."]);
    const problems = [];
    for (const r of results) {
        for (const m of r.messages) problems.push(`${path.relative(REPO, r.filePath)}:${m.line ?? 0}: ${m.message}${m.ruleId ? ` (${m.ruleId})` : ""}`);
    }
    const read = new Set(results.map(r => path.relative(REPO, r.filePath).split(path.sep).join("/")));
    const scripts = fs.readdirSync(path.join(REPO, "scripts")).filter(f => f.endsWith(".mjs")).map(f => `scripts/${f}`);
    const unread = scripts.filter(f => !read.has(f));
    for (const f of unread) problems.push(`${f} was not linted - does eslint.config.mjs still match it?`);
    const counts = `${results.length} files, ${problems.length - unread.length} problem(s)`;
    console.log(`lint: ${counts}`);
    for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
    return { status: problems.length ? "red" : "green", ms: Date.now() - t0, counts, problems };
}

/** A Node script as a part: green on exit 0. Its last line is its own summary. */
async function command(cmd, args, cwd) {
    const r = await run(cmd, args, { cwd, timeoutMs: 5 * 60_000 });
    const problems = [];
    if (r.timedOut) problems.push("timed out");
    else if (r.code !== 0) problems.push(`exited ${r.code ?? r.signal}`);
    problems.push(...r.text.split("\n").filter(l => /^\S+: .*(problem|refus|FAIL|missing|lacks|red)/i.test(l) && !/: 0 problem/.test(l)).slice(0, 30));
    return { status: r.timedOut || r.code !== 0 ? "red" : "green", ms: r.ms, counts: r.text.trim().split("\n").at(-1)?.slice(0, 160) ?? "", problems };
}

const check = () => command(process.execPath, [path.join(REPO, "tools", "check.mjs")], REPO);

async function gate() {
    const verifier = path.join(REPO, "audit", "gate", "verify-gate.mjs");
    if (!fs.existsSync(verifier)) {
        console.log("gate: audit/gate/verify-gate.mjs is not in this tree");
        return { status: "red", ms: 0, counts: "no verifier", problems: ["audit/gate/verify-gate.mjs is missing"] };
    }
    return command(process.execPath, [verifier, "--self-test"], REPO);
}

/** Every scenario file with its number, name, layers and timeout, read off the source without importing it. */
function scenarioFiles() {
    const dir = path.join(HERE, "scenarios");
    return fs.readdirSync(dir).filter(f => /^\d{2}-.+\.mjs$/.test(f)).sort().map(f => {
        const source = fs.readFileSync(path.join(dir, f), "utf8");
        let layers = null;
        try { layers = JSON.parse(source.match(LAYERS_RE)?.[1] ?? "null"); } catch { /* reported by the cluster and by check registry */ }
        const name = f.replace(/\.mjs$/, "");
        const timeout = Number(source.match(TIMEOUT_RE)?.[1] ?? 0) || (name === SUITE ? SUITE_TIMEOUT_MS : SCENARIO_TIMEOUT_MS);
        return { file: f, name, layers, timeout };
    });
}

/** One scenario: spawn the cluster, then hold its exit code, its results file and its verdicts against each other. */
async function scenario({ file, name, timeout }) {
    const json = path.join(RESULTS, `${name}.json`), log = path.join(RESULTS, `${name}.log`);
    fs.mkdirSync(RESULTS, { recursive: true });
    for (const f of [json, log]) fs.rmSync(f, { force: true });
    const started = new Date(Date.now() - 1000);  // a second of slack for a clock read on either side of the spawn
    const r = await run(process.execPath, [path.join(HERE, "cluster.mjs"), `scenarios/${file}`, "--verbose"],
        { cwd: HERE, timeoutMs: timeout, logFile: log });
    const problems = [];
    let res = null;
    try { res = JSON.parse(fs.readFileSync(json, "utf8")); } catch { /* reported below */ }
    if (r.timedOut) problems.push(`timed out after ${Math.round(timeout / 1000)} s`);
    if (!res) problems.push(`no results file (exit ${r.code ?? r.signal})`);
    else {
        if (!(new Date(res.startedAt) >= started)) problems.push(`the results file is stale: startedAt ${res.startedAt}`);
        if (!(res.total > 0)) problems.push("the results file holds no check");
        const failed = (res.results ?? []).filter(x => x.status === "fail");
        for (const f of failed) problems.push(`FAIL ${f.name}${f.reason ? ` - ${f.reason}` : ""}`);
        if (!r.timedOut && (r.code === 0) !== (failed.length === 0)) {
            problems.push(r.code === 0 ? "cluster said green while its checks were red" : `cluster exited ${r.code ?? r.signal} while its checks were green`);
        }
    }
    const reds = (res?.results ?? []).filter(x => x.status === "expectedRed").map(x => `${x.knownLeak ?? x.name} ${x.until ?? ""}`.trim());
    const suite = res?.evidence?.suite;
    const counts = res ? `${res.passed}/${res.total} passed, ${res.expectedRed ?? 0} expected red, ${res.failed} failed`
        + (suite ? `; suite ${suite.passed} passed, ${suite.failed} failed, ${suite.skipped} skipped, ${suite.red} red` : "") : "-";
    const memory = res?.resources ? Object.entries(res.resources).map(([who, kb]) => `${who} ${kb === null ? "?" : Math.round(kb / 1024)}`).join(" ") : "";
    console.log(`  ${problems.length ? "RED  " : "green"} ${name.padEnd(20)} ${String(Math.round(r.ms / 100) / 10).padStart(6)} s  ${counts}${memory ? `  maxRSS MB: ${memory}` : ""}`);
    for (const p of problems.slice(0, 20)) console.log(`        ${p}`);
    return { name, status: problems.length ? "red" : "green", ms: r.ms, exit: r.code, counts, expectedRed: reds, resources: res?.resources ?? null, problems };
}

async function scenarioPart(which) {
    const t0 = Date.now();
    const all = scenarioFiles();
    let list = which === "suite" ? all.filter(s => s.name === SUITE)
        : all.filter(s => s.name !== SUITE && Array.isArray(s.layers) && s.layers.includes("ci"));
    if (ONLY) list = list.filter(s => s.name === ONLY || s.name.startsWith(`${ONLY}-`));
    if (!list.length) {
        const why = ONLY ? `no ${which === "suite" ? "suite" : "ci scenario"} matches --only ${ONLY}` : `no ${which} to run`;
        console.log(`${which}: ${why}`);
        return { status: ONLY ? "skipped" : "red", ms: 0, counts: why, problems: ONLY ? [] : [why], scenarios: [] };
    }
    console.log(`${which}: ${list.map(s => s.name).join(", ")}`);
    const scenarios = [];
    for (const s of list) scenarios.push(await scenario(s));
    const red = scenarios.filter(s => s.status === "red");
    const counts = which === "suite" ? scenarios[0].counts : `${scenarios.length - red.length}/${scenarios.length} green`;
    return { status: red.length ? "red" : "green", ms: Date.now() - t0, counts, scenarios,
        problems: red.flatMap(s => s.problems.map(p => `${s.name}: ${p}`)) };
}

const PARTS = { lint, check, gate, suite: () => scenarioPart("suite"), scenarios: () => scenarioPart("scenarios") };

/* ---------------------------------- main ----------------------------------- */

const startedAt = new Date().toISOString();
const report = [];
for (const name of parts) {
    console.log(`\n=== ${name} ===`);
    let r;
    try { r = await PARTS[name](); }
    catch (err) { r = { status: "red", ms: 0, counts: "threw", problems: [err.stack ?? String(err)] }; console.log(err.stack ?? err); }
    report.push({ part: name, ...r });
}
const red = report.some(r => r.status === "red");
const own = process.resourceUsage().maxRSS;

console.log("\n=== run-all ===");
for (const r of report) console.log(`${r.status === "red" ? "RED  " : r.status === "green" ? "green" : r.status.padEnd(5)} ${r.part.padEnd(10)} ${String(Math.round(r.ms / 100) / 10).padStart(7)} s  ${r.counts}`);
for (const r of report) for (const s of r.scenarios ?? []) for (const x of s.expectedRed) console.log(`  expected red in ${s.name}: ${x}`);
console.log(`run-all: ${red ? "RED" : "green"}; run-all's own maxRSS ${Math.round(own / 1024)} MB`);

fs.mkdirSync(RESULTS, { recursive: true });
fs.writeFileSync(path.join(RESULTS, "run-all.json"), JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), repo: REPO,
    node: process.version, platform: `${process.platform}-${process.arch}`, parts: report, maxRSS: own, verdict: red ? "red" : "green" }, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
    const cell = s => String(s).replace(/\|/g, "\\|");
    const lines = ["### npm test", "", "| Part | Status | Seconds | Counts |", "| --- | --- | --- | --- |",
        ...report.map(r => `| ${r.part} | ${r.status} | ${Math.round(r.ms / 1000)} | ${cell(r.counts)} |`)];
    const scen = report.flatMap(r => r.scenarios ?? []);
    if (scen.length) {
        lines.push("", "| Scenario | Status | Seconds | Counts | maxRSS MB |", "| --- | --- | --- | --- | --- |",
            ...scen.map(s => `| ${s.name} | ${s.status} | ${Math.round(s.ms / 1000)} | ${cell(s.counts)} | `
                + `${s.resources ? Object.entries(s.resources).map(([w, kb]) => `${w} ${kb === null ? "?" : Math.round(kb / 1024)}`).join(", ") : ""} |`));
    }
    const reds = scen.flatMap(s => s.expectedRed.map(x => `- ${s.name}: ${x}`));
    if (reds.length) lines.push("", "Expected red:", ...reds);
    const problems = report.flatMap(r => r.problems.map(p => `- ${r.part}: ${cell(p)}`));
    if (problems.length) lines.push("", "Problems:", ...problems.slice(0, 50));
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n"); } catch { /* the summary is a courtesy */ }
}
process.exitCode = red ? 1 : 0;
