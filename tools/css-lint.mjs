/**
 * The CSS lint in Node (E44 C1b, 04.11.2026; audit S17-35).
 * ---------------------------------------------------------------------------
 *     node tools/css-lint.mjs            the counts of every sheet module.json serves, held to tools/css-budget.json
 *     node tools/css-lint.mjs --write    the same, with each budget lowered to its count first (never raised)
 *
 * `node tools/check.mjs css` runs `cssLint` below, so CI's check job and `npm run quick` read it. Bare Node, no
 * install: the detectors are scripts/tests-css.mjs's, which imports nothing, and the scripts' comments are removed by
 * scripts/tests-lint.mjs `stripComments`, the function R2 has always used, so the lint and the suite (R2, R1310,
 * R1311) give one verdict. In this order:
 *   1. The self-check (tests-css.mjs `selfCheck`): each detector on its planted sheet and its clean one, deadClasses on
 *      its fixture, and the budget's ratchet on its three cases (above, below, equal) - red when one does not answer
 *      as its fixture says, so a detector broken to count nothing, or a ratchet that lets a lowered count pass, is red
 *      here before it is trusted on the files.
 *   2. Every sheet of module.json's `styles`, in its order (a sheet added there is read without a line here), and
 *      the module's scripts as the suite's crawl finds them (tests-kit.mjs `moduleSources`: from scripts/module.mjs
 *      along every `from "./x.mjs"` and `import("./x.mjs")`, the suite's own files out).
 *   3. tests-css.mjs `budgetProblems`: per sheet `important`, `colourLiterals`, `duplicates` and `deadClasses` against
 *      its row, red above (a rule was added) and below (lower the budget in the same commit: `--write`); a stray
 *      comment end is red with no budget; a sheet with no row, or a row with no sheet, is red.
 *   4. tests-css.mjs `meaningReads` (E48 K1, 11.11.2026): a meaning token read by a rule that does not name its
 *      meaning - gold outside Hope's selectors, `--drpg-attention` outside focus and selection - one problem each,
 *      after `meaningSelfCheck` on its fixture. The stage's word was "warns"; it is red here because the count is 0 and
 *      the suite's R3410 holds it to 0 anyway, and a warning nobody has to read is the colour nobody looks at.
 * The last line: "css: N sheet(s) ...; P problem(s)". Measured 04.11.2026 on c4210b4d's sheets: 6 sheets, 958
 * `!important`, 445 declarations with a colour literal, 0 rules written twice, 0 stray comment ends, 653 classes
 * named and none dead; well under a second.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..");
export const BUDGET_FILE = "tools/css-budget.json";

const lf = text => String(text).replace(/\r\n?/g, "\n");

/** The module's scripts as the suite's crawl reaches them, the suite's own files out: [file, text]. */
export function crawlScripts(repo) {
    const out = new Map();
    const queue = ["module.mjs"];
    while (queue.length) {
        const file = queue.pop();
        if (out.has(file)) continue;
        let text;
        try { text = lf(fs.readFileSync(path.join(repo, "scripts", file), "utf8")); } catch { continue; }
        out.set(file, text);
        for (const m of text.matchAll(/(?:from|import\()\s*"\.\/([\w-]+\.mjs)"/g)) queue.push(m[1]);
    }
    return [...out].filter(([file]) => !/^tests(-[\w-]+)?\.mjs$/.test(file));
}

/** Every sheet module.json serves, in its order: [file, text]. */
export function servedSheets(repo) {
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, "module.json"), "utf8"));
    return (manifest.styles ?? []).map(file => [file, lf(fs.readFileSync(path.join(repo, file), "utf8"))]);
}

/**
 * The lint: `{ problems, summary, counts }`. With `write`, each budget row is lowered to its count before the budget
 * is read (a count above its row stays above it: --write never raises), a sheet with no row gets one at its counts, and
 * a row for a sheet that is no longer served is dropped.
 */
export async function cssLint(repo = DEFAULT_REPO, { write = false } = {}) {
    const T = await import(url.pathToFileURL(path.join(repo, "scripts", "tests-css.mjs")).href);
    const { stripComments } = await import(url.pathToFileURL(path.join(repo, "scripts", "tests-lint.mjs")).href);
    const problems = [...T.selfCheck(), ...T.meaningSelfCheck()].map(p => `self-check: ${p}`);
    const sheets = servedSheets(repo);
    const sources = crawlScripts(repo).map(([file, text]) => [file, stripComments(text)]);
    if (!sheets.length) problems.push("module.json serves no sheet - nothing was read");
    if (sources.length < 100) problems.push(`the crawl from scripts/module.mjs read ${sources.length} script(s) - deadClasses would vouch for nothing`);
    const { counts, dead } = T.lintCounts(sheets, sources);
    for (const row of dead.stale) problems.push(`deadClasses: STORED's row ${row} has no rule left in the sheets, or an emitter again`);
    const budgetPath = path.join(repo, BUDGET_FILE);
    let budget = null;
    try { budget = JSON.parse(fs.readFileSync(budgetPath, "utf8")); } catch { /* red below */ }
    if (write) {
        const rows = {};
        for (const [file, got] of Object.entries(counts)) {
            const old = budget?.sheets?.[file];
            rows[file] = Object.fromEntries(T.BUDGET_FIELDS.map(f => [f, Number.isInteger(old?.[f]) ? Math.min(old[f], got[f]) : got[f]]));
        }
        budget = { about: budget?.about ?? "", sheets: rows };
        fs.writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
    }
    const meaning = T.meaningReads(sheets);
    if (!meaning.read) problems.push("meaning: no meaning token read in any sheet - the check would vouch for nothing");
    for (const found of meaning.found) problems.push(`meaning: ${found}`);
    if (!budget) problems.push(`${BUDGET_FILE} is missing or not JSON`);
    else problems.push(...T.budgetProblems(counts, budget));
    const sum = field => Object.values(counts).reduce((n, c) => n + c[field], 0);
    const summary = `css: ${sheets.length} sheet(s), ${sources.length} script(s); self-check ${problems.some(p => p.startsWith("self-check: ")) ? "red" : "held"}; `
        + `!important ${sum("important")}, colour literals ${sum("colourLiterals")}, duplicate rules ${sum("duplicates")}, stray comment ends ${sum("strayCommentEnds")}, `
        + `dead classes ${sum("deadClasses")} of ${dead.inSheet} named, meaning tokens read ${meaning.read} (${meaning.found.length} outside their selectors); ${write ? `budget written to ${BUDGET_FILE}; ` : ""}${problems.length} problem(s)`;
    return { problems, summary, counts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const { problems, summary, counts } = await cssLint(DEFAULT_REPO, { write: process.argv.includes("--write") });
    for (const [file, c] of Object.entries(counts)) {
        console.log(`  ${file}: !important ${c.important}, colour literals ${c.colourLiterals}, duplicates ${c.duplicates}, dead classes ${c.deadClasses}, stray comment ends ${c.strayCommentEnds}`);
    }
    for (const p of problems) console.log(`css: ${p}`);
    console.log(summary);
    process.exitCode = problems.length ? 1 : 0;
}
