/**
 * The performance budget, held to what a table measured (E53 C2, 15.11.2026; the plan's item 2).
 *
 * audit/perf-baseline.json `budget.lines` names, for a reading `audit/live/perf-baseline.mjs` files under a run, the
 * most it may be and whether going over blocks (D27 (b): the frame time and the room switch) or only warns. This holds
 * every run in `runs`, per theme, on the median of the run's repeats, to those lines:
 *
 *   - a reading over a line's `max` where `blocks` is true is a problem (the check is red);
 *   - over a line that only warns, a warning line, and nothing red;
 *   - a line with `max` null prints the reading and "no budget set" - the owner has not given the number;
 *   - a reading the run does not hold (an older perf() body, a line off the primary GM) prints "not measured";
 *   - with `runs` empty, every line prints "not measured" and nothing is held. That is the state on 15.11.2026: no table
 *     number is recorded (perf-baseline.json `status`), and the readings are LIVE-E53-01's and LIVE-E33-05's.
 *
 * It also holds the budget's shape (each key one parsePerf files, or the run's scene switch; `max` null or a positive
 * number; `blocks` a boolean; no key twice) and that each label perf-baseline.mjs `COST_LINES` parses is one
 * diagnostics.mjs `costLines` prints - so a reworded line cannot leave its readings null without the check saying so.
 *
 * NOT MEASURING NOTHING (CLAUDE.md's first rule; `stackShapes`' empty list): `selfCheck` runs the holding on planted
 * documents first - a blocking line over its budget must be red, a warning one must not, a line under must not, a
 * reading missing must say so, an empty `runs` must hold nothing and say so, a label perf() no longer prints must be
 * red - and the check is red when any of them does not come out so.
 *
 * `node tools/check.mjs budget` runs it; `node tools/perf-budget.mjs` alone does the same.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

/** A run's reading of `key` for `theme`: the scene switch's median, or the theme's median of parsePerf's `key`. */
function readingOf(run, theme, key) {
    if (key === "sceneSwitch") return typeof run?.sceneSwitch?.median === "number" ? run.sceneSwitch.median : null;
    const v = run?.themes?.[theme]?.median?.[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Holds `doc`'s runs to its budget. `parseKeys` are the keys parsePerf files, `costLabels` perf-baseline.mjs
 * `COST_LINES`' labels, `diagSource` diagnostics.mjs's text. Answers `{ problems, lines }`: `lines` what to print.
 */
export function hold(doc, { parseKeys, costLabels, diagSource }) {
    const problems = [], lines = [];
    const budget = doc?.budget;
    const list = Array.isArray(budget?.lines) ? budget.lines : null;
    if (!list || !list.length) return { problems: ["budget.lines is missing or empty"], lines };
    const known = new Set([...parseKeys, "sceneSwitch"]), seen = new Set();
    for (const [i, line] of list.entries()) {
        const at = `budget line ${i + 1} (${line?.key ?? "no key"})`;
        if (!known.has(line?.key)) problems.push(`${at}: the key is not one parsePerf files, nor sceneSwitch`);
        if (seen.has(line?.key)) problems.push(`${at}: the key is budgeted twice`);
        seen.add(line?.key);
        if (!(line?.max === null || (typeof line?.max === "number" && line.max > 0))) problems.push(`${at}: max is neither null nor a positive number`);
        if (typeof line?.blocks !== "boolean") problems.push(`${at}: blocks is not true or false`);
        if (typeof line?.reads !== "string" || !line.reads) problems.push(`${at}: reads says nothing`);
    }
    // Each cost label parsePerf reads is printed by costLines, cut from `export function costLines(` to its end.
    const start = diagSource.indexOf("export function costLines(");
    const end = start < 0 ? -1 : diagSource.indexOf("\n}\n", start);
    const body = start < 0 || end < 0 ? "" : diagSource.slice(start, end);
    if (!body) problems.push("diagnostics.mjs has no costLines to hold the cost labels to");
    else for (const label of costLabels) if (!body.includes(`line(${JSON.stringify(label)}`)) problems.push(`perf-baseline.mjs COST_LINES reads "${label}", which diagnostics.mjs costLines does not print`);

    const runs = Array.isArray(doc?.runs) ? doc.runs : [];
    if (!runs.length) {
        lines.push(`not measured: runs is empty - ${list.length} line(s) wait for a table's run (LIVE-E53-01, LIVE-E33-05)`);
        for (const line of list) lines.push(`  ${line.key}: not measured (${line.max === null ? "no budget set" : `budget ${line.max} ${line.unit ?? "ms"}`}, ${line.blocks ? "blocks" : "warns"})`);
        return { problems, lines };
    }
    for (const run of runs) {
        const themes = Object.keys(run?.themes ?? {});
        for (const theme of themes.length ? themes : ["(no theme)"]) {
            for (const line of list) {
                const v = readingOf(run, theme, line.key), where = `${run?.id ?? "a run"} ${theme} ${line.key}`;
                if (v === null) { lines.push(`  ${where}: not measured in this run`); continue; }
                if (line.max === null) { lines.push(`  ${where}: ${v} ms, no budget set`); continue; }
                if (v <= line.max) { lines.push(`  ${where}: ${v} ms, within ${line.max}`); continue; }
                if (line.blocks) problems.push(`${where}: ${v} ms is over its budget of ${line.max} ms (blocks, D27 b)`);
                else lines.push(`  ${where}: ${v} ms is over ${line.max} ms - a warning, it blocks nothing`);
            }
        }
    }
    return { problems, lines };
}

/** The planted documents `hold` must judge as written; a problem for each that does not. */
export function selfCheck() {
    const parseKeys = ["asIs", "drawnP95", "fogP95"], costLabels = ["the fog repainted"];
    const diagSource = 'export function costLines() {\n    line("the fog repainted", "fog.repaint");\n}\n';
    const lines = [{ key: "asIs", reads: "x", max: 20, unit: "ms", blocks: true }, { key: "drawnP95", reads: "x", max: 100, unit: "ms", blocks: false },
        { key: "fogP95", reads: "x", max: null, unit: "ms", blocks: false }, { key: "sceneSwitch", reads: "x", max: 3000, unit: "ms", blocks: true }];
    const run = (asIs, drawnP95, scene = 1000) => ({ id: "run-1", themes: { legacy: { median: { asIs, drawnP95, fogP95: 4 } } }, sceneSwitch: { median: scene } });
    const ask = (doc, args = {}) => hold(doc, { parseKeys, costLabels, diagSource, ...args });
    const cases = [
        ["a blocking line over its budget is red", ask({ budget: { lines }, runs: [run(25, 50)] }), r => r.problems.length === 1 && /asIs: 25 ms is over its budget of 20/.test(r.problems[0])],
        ["a warning line over its budget is a warning, not red", ask({ budget: { lines }, runs: [run(10, 150)] }), r => !r.problems.length && r.lines.some(l => /drawnP95: 150 ms is over 100 ms - a warning/.test(l))],
        ["every line within its budget holds", ask({ budget: { lines }, runs: [run(10, 50)] }), r => !r.problems.length && r.lines.filter(l => /within/.test(l)).length === 3],
        ["no budget set prints the reading", ask({ budget: { lines }, runs: [run(10, 50)] }), r => r.lines.some(l => /fogP95: 4 ms, no budget set/.test(l))],
        ["the scene switch over its budget is red", ask({ budget: { lines }, runs: [run(10, 50, 4000)] }), r => r.problems.length === 1 && /sceneSwitch: 4000 ms/.test(r.problems[0])],
        ["a reading the run lacks says not measured", ask({ budget: { lines }, runs: [{ id: "run-1", themes: { legacy: { median: { asIs: null } } } }] }), r => !r.problems.length && r.lines.filter(l => /not measured in this run/.test(l)).length === 4],
        ["no runs holds nothing and says not measured", ask({ budget: { lines }, runs: [] }), r => !r.problems.length && /^not measured: runs is empty/.test(r.lines[0]) && r.lines.length === 5],
        ["a label perf() no longer prints is red", ask({ budget: { lines }, runs: [] }, { costLabels: ["the fog redrawn"] }), r => r.problems.some(p => /"the fog redrawn"/.test(p))],
        ["an unknown key and a bad max are red", ask({ budget: { lines: [{ key: "nope", reads: "x", max: 0, blocks: true }] }, runs: [] }), r => r.problems.length === 2]
    ];
    return cases.filter(([, result, holds]) => !holds(result)).map(([name]) => `self-check: "${name}" did not come out so - the holding is broken`);
}

/** The part: the self-check, then the repository's own baseline. Prints what it read; answers the problems. */
export async function check(log = console.log) {
    const failed = selfCheck();
    if (failed.length) return failed;
    log("budget: self-check 9/9 planted cases hold");
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(REPO, "audit", "perf-baseline.json"), "utf8")); }
    catch (err) { return [`audit/perf-baseline.json does not parse: ${err.message}`]; }
    const live = await import(url.pathToFileURL(path.join(REPO, "audit", "live", "perf-baseline.mjs")).href);
    const diagSource = fs.readFileSync(path.join(REPO, "scripts", "diagnostics.mjs"), "utf8").replace(/\r\n/g, "\n");
    const { problems, lines } = hold(doc, { parseKeys: Object.keys(live.parsePerf("")), costLabels: Object.values(live.COST_LINES), diagSource });
    for (const line of lines) log(`budget: ${line}`);
    return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const problems = await check();
    for (const p of problems) console.log(`budget: ${p}`);
    process.exitCode = problems.length ? 1 : 0;
}
