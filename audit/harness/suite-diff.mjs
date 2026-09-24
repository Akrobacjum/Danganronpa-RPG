/**
 * Compare two runs of the suite test by test (E30).
 *
 *     node suite-diff.mjs before.log after.log [--rename renames.json]
 *
 * Each argument is the output of `node cluster.mjs scenarios/01-runtests.mjs`.
 * The SUITE OUTPUT block is read into ordered records (tier, status, name,
 * reason), and the two lists are compared: a test gone or new, a status or a
 * reason changed, or the common tests run in another order. A commit that
 * says "the suite is unchanged" can then show it, rather than show two equal
 * totals: 292 passed can hide one test that started passing and another that
 * stopped.
 *
 * `--rename` maps old names to new ones, for a commit that renames tests on
 * purpose: `{ "old name": "new name" }`.
 *
 * Exit 0 when the runs match, 1 when they differ, and 2 when they cannot be
 * compared - most often because 01-runtests keeps only the first 30,000
 * characters of the suite's text, so the printed lines stop short of the
 * summary's count.
 */
import fs from "node:fs";

const [a, b] = process.argv.slice(2);
const ri = process.argv.indexOf("--rename");
const renames = ri > 0 ? JSON.parse(fs.readFileSync(process.argv[ri + 1], "utf8")) : {};

function parse(file) {
    const log = fs.readFileSync(file, "utf8");
    const start = log.indexOf("---------------- SUITE OUTPUT ----------------");
    const end = log.indexOf("\n----------------------------------------------", start + 1);
    if (start < 0 || end < 0) return { error: `${file}: no SUITE OUTPUT block` };
    const lines = log.slice(start, end).split("\n").slice(1);
    const sum = lines.map(l => l.match(/^(\d+) passed, (\d+) failed, (\d+) skipped$/)).find(Boolean);
    if (!sum) return { error: `${file}: no summary line` };
    const recs = [];
    let tier = "?";
    for (const l of lines) {
        if (/^TIER \d/.test(l)) { tier = l; continue; }
        const m = l.match(/^  (ok|FAIL|skip) +(.*)$/);
        if (m) { recs.push({ tier, status: m[1], name: renames[m[2]] ?? m[2], detail: [] }); continue; }
        if (/^        /.test(l) && recs.length) recs.at(-1).detail.push(l.trim());
    }
    const [p, f, s] = sum.slice(1).map(Number);
    const skipped = recs.filter(r => r.status === "skip").length;
    // A FAIL line the runner adds itself (a refused tier 2, a restore that failed)
    // counts as failed and is a record too.
    if (p + f + s !== recs.length || skipped !== s) {
        return { error: `${file}: the summary says ${p + f + s} results and ${recs.length} were printed - the text was cut (01-runtests keeps 30000 characters)` };
    }
    return { summary: sum[0], recs };
}

const A = parse(a), B = parse(b);
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
