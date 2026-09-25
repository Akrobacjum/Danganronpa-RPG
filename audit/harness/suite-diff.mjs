/**
 * Compare two runs of the suite test by test (E30).
 *
 *     node suite-diff.mjs before.log after.log [--rename renames.json]
 *     node suite-diff.mjs before.json after.json --json [--rename renames.json]
 *
 * Each log is the output of `node cluster.mjs scenarios/01-runtests.mjs`: its
 * SUITE OUTPUT block is read into ordered records (tier, status, name,
 * reason). With `--json` each argument is that run's results file
 * (results/01-runtests.json), where 01-runtests keeps the suite's own
 * `results` list whole - the text there is cut at 30,000 characters, the list
 * is not. The two lists are compared: a test gone or new, a status or a
 * reason changed, or the common tests run in another order. A commit that
 * says "the suite is unchanged" can then show it, rather than show two equal
 * totals: 292 passed can hide one test that started passing and another that
 * stopped.
 *
 * `--rename` maps old names to new ones, for a commit that renames tests on
 * purpose: `{ "old name": "new name" }`.
 *
 * Exit 0 when the runs match, 1 when they differ, and 2 when they cannot be
 * compared - a log whose text was cut before the summary's count, or a results
 * file written before 01-runtests kept the list (E30 C12).
 */
import fs from "node:fs";

const ri = process.argv.indexOf("--rename");
const renames = ri > 0 ? JSON.parse(fs.readFileSync(process.argv[ri + 1], "utf8")) : {};
const [a, b] = process.argv.slice(2).filter((arg, i, all) => arg !== "--json" && arg !== "--rename" && all[i - 1] !== "--rename");
const asJson = process.argv.includes("--json");

function parse(file) {
    const log = fs.readFileSync(file, "utf8");
    const start = log.indexOf("---------------- SUITE OUTPUT ----------------");
    const end = log.indexOf("\n----------------------------------------------", start + 1);
    if (start < 0 || end < 0) return { error: `${file}: no SUITE OUTPUT block` };
    const lines = log.slice(start, end).split("\n").slice(1);
    const sum = lines.map(l => l.match(/^(\d+) passed, (\d+) failed, (\d+) skipped(?:, (\d+) red until a later stage)?$/)).find(Boolean);
    if (!sum) return { error: `${file}: no summary line` };
    const recs = [];
    let tier = "?";
    for (const l of lines) {
        if (/^TIER \d/.test(l)) { tier = l; continue; }
        const m = l.match(/^  (ok|FAIL|skip|red) +(.*)$/);
        if (m) { recs.push({ tier, status: m[1], name: renames[m[2]] ?? m[2], detail: [] }); continue; }
        if (/^        /.test(l) && recs.length) recs.at(-1).detail.push(l.trim());
    }
    const [p, f, s, r = 0] = sum.slice(1).map(n => Number(n ?? 0));
    const skipped = recs.filter(rec => rec.status === "skip").length;
    // A FAIL line the runner adds itself (a refused tier 2, a restore that failed)
    // counts as failed and is a record too.
    if (p + f + s + r !== recs.length || skipped !== s) {
        return { error: `${file}: the summary says ${p + f + s + r} results and ${recs.length} were printed - the text was cut (01-runtests keeps 30000 characters); compare the results files with --json` };
    }
    return { summary: sum[0], recs };
}

/* The same records from the results file: 01-runtests keeps the suite's `results`
   as `evidence.suite` (E30 C12). The tier reads as the text's header would, so a
   rename map and the key below work the same in both modes. */
const STATUS = { pass: "ok", fail: "FAIL", skip: "skip", red: "red" };
const TIER = ["TIER 0", "TIER 1", "TIER 2"];
function parseJson(file) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch (err) { return { error: `${file}: ${err.message}` }; }
    const suite = doc?.evidence?.suite;
    if (!Array.isArray(suite?.results)) return { error: `${file}: no evidence.suite.results - a results file from before 01-runtests kept the list` };
    const recs = suite.results.map(res => ({
        tier: TIER[res.tier] ?? `TIER ${res.tier}`, status: STATUS[res.outcome] ?? res.outcome,
        name: renames[res.name] ?? res.name,
        detail: [res.message, res.failedAt].filter(x => x !== undefined && x !== null && x !== "").map(x => String(x).trim())
    }));
    const summary = `${suite.passed} passed, ${suite.failed} failed, ${suite.skipped} skipped${suite.red ? `, ${suite.red} red until a later stage` : ""}`;
    if (suite.passed + suite.failed + suite.skipped + (suite.red ?? 0) !== recs.length) {
        return { error: `${file}: the summary says ${suite.passed + suite.failed + suite.skipped + (suite.red ?? 0)} results and the list holds ${recs.length}` };
    }
    return { summary, recs };
}

const A = asJson ? parseJson(a) : parse(a), B = asJson ? parseJson(b) : parse(b);
if (A.error || B.error) { console.log("NOT COMPARABLE:", A.error ?? B.error); process.exit(2); }
const key = r => `${r.tier} | ${r.name}`;
const ka = new Map(A.recs.map((r, i) => [key(r), { ...r, i }]));
const kb = new Map(B.recs.map((r, i) => [key(r), { ...r, i }]));
const out = [];
for (const k of ka.keys()) if (!kb.has(k)) out.push(`gone:     ${k}`);
for (const k of kb.keys()) if (!ka.has(k)) out.push(`new:      ${k}`);
for (const [k, r] of ka) {
    const s = kb.get(k);
    if (!s) continue;
    if (r.status !== s.status) out.push(`status:   ${k}: ${r.status} -> ${s.status}${s.detail.length ? ` (${s.detail[0].slice(0, 120)})` : ""}`);
    else if (JSON.stringify(r.detail) !== JSON.stringify(s.detail)) out.push(`detail:   ${k}: ${JSON.stringify(r.detail).slice(0, 160)} -> ${JSON.stringify(s.detail).slice(0, 160)}`);
}
const orderA = A.recs.map(key).filter(k => kb.has(k));
const orderB = B.recs.map(key).filter(k => ka.has(k));
if (JSON.stringify(orderA) !== JSON.stringify(orderB)) {
    out.push(`order:    the tests common to both ran in a different order (first at #${orderA.findIndex((k, i) => orderB[i] !== k)})`);
}
console.log(`before: ${A.summary} (${A.recs.length} lines)\nafter:  ${B.summary} (${B.recs.length} lines)`);
console.log(out.length ? out.join("\n") : "identical: every test, in the same order, with the same status and the same reason");
process.exit(out.length ? 1 : 0);
