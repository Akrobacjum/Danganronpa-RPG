/**
 * E54's comment budget follows the moved comments (tools/e54/rebuild.sh, after each cut's sweep; 14.11.2026).
 * Usage: node tools/e54/budget.mjs --manifest tools/e54/<cut>.json --repo <checkout>
 *
 * The comments lint (tools/comments-lint.mjs, E56 C1) holds each module file of scripts/ to a row of
 * tools/comment-budget.json: its citations (a backticked name in a comment no code holds) and its doubled JSDoc
 * blocks, red above the row and red below it until the row is lowered. A pure move carries a comment, and its
 * citation, from the cut's source to one of its targets, so the source reads below its row and the target above none:
 * on the 1.2.113 assembly the sheet cut read sheet.mjs 0 of 5 and one each in five of its new files.
 *
 * So, for the cut's family - its source and every target - the counts are read with commentsLint itself, and the
 * family's rows are written to them: a file with a count gets its row, a file at zero loses its row (the lint needs
 * none). Refused, the budget untouched, exit 1: when the family's count of either field is above the family's rows
 * before (a comment the cut or its sweep added; a budget only falls), or when the lint reports a problem outside the
 * family (that is not this tool's to move). A count below is taken: the sweep may have mended a citation.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const argv = process.argv.slice(2);
const opt = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };
const REPO = path.resolve(opt("--repo") ?? process.cwd());
const manifest = JSON.parse(fs.readFileSync(opt("--manifest"), "utf8"));
const say = s => console.log(`e54-budget: ${s}`);
const lintPath = path.join(REPO, "tools", "comments-lint.mjs");
if (!fs.existsSync(lintPath)) { say("no tools/comments-lint.mjs on this base: nothing to move; done"); process.exit(0); }
const { commentsLint, BUDGET_FILE, FIELDS } = await import(url.pathToFileURL(lintPath).href);
const family = [manifest.source, ...manifest.targets.map(t => t.file)];
const budgetPath = path.join(REPO, BUDGET_FILE);
const budget = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
const { counts, problems } = await commentsLint(REPO);
const outside = problems.filter(p => !family.some(f => p.startsWith(`${f}:`)));
if (outside.length) { for (const p of outside) say(`REFUSED: a problem outside the family: ${p}`); process.exit(1); }
const sum = (get, field) => family.reduce((n, f) => n + (get(f)?.[field] ?? 0), 0);
const before = Object.fromEntries(FIELDS.map(f => [f, sum(file => budget.files[file], f)]));
const after = Object.fromEntries(FIELDS.map(f => [f, sum(file => counts[file], f)]));
const over = FIELDS.filter(f => after[f] > before[f]);
if (over.length) { say(`REFUSED: the family reads ${over.map(f => `${f} ${after[f]} over its rows' ${before[f]}`).join(", ")} - a comment added one`); process.exit(1); }
let moved = 0;
for (const file of family) {
    const got = counts[file] ?? Object.fromEntries(FIELDS.map(f => [f, 0]));
    const had = budget.files[file];
    if (FIELDS.some(f => got[f] > 0)) { if (!had || FIELDS.some(f => had[f] !== got[f])) moved++; budget.files[file] = Object.fromEntries(FIELDS.map(f => [f, got[f]])); }
    else if (had) { moved++; delete budget.files[file]; }
}
const sorted = Object.keys(budget.files).every((k, i, a) => i === 0 || a[i - 1] <= k);
if (sorted) budget.files = Object.fromEntries(Object.keys(budget.files).sort().map(k => [k, budget.files[k]]));
fs.writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
say(`${family.length} file(s) of the family; before ${FIELDS.map(f => `${f} ${before[f]}`).join(", ")}, after ${FIELDS.map(f => `${f} ${after[f]}`).join(", ")}; ${moved} row(s) written; done`);
