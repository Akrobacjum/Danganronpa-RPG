/**
 * The contrast of the themes' text, in Node (E44 C1c, 04.11.2026; D29 = 2, Monokuma Legacy to parity).
 * ---------------------------------------------------------------------------
 *     node tools/contrast.mjs        every pair of tools/contrast-pairs.json, one line each, exit 1 on a red one
 *
 * `node tools/check.mjs contrast` runs `contrastCheck` below. Bare Node: the arithmetic is scripts/tests-css.mjs's
 * (`themeTokens`, `resolveColour`, `contrastRatio`, `contrastOf`), which the suite's R1312 runs on the served files too.
 * In this order:
 *   1. The self-check (tests-css.mjs `contrastSelfCheck`): WCAG's two ends (black on white 21, a colour on itself 1)
 *      and a fixture theme whose pairs must read ok, low (a pair below AA that is not written as known - what makes
 *      this tool red), known, stale and unmeasured as written.
 *   2. The tokens each theme declares on `:root` and on its body class (`body.drpg-theme-stained-glass`,
 *      `body.drpg-theme-monokuma-legacy`), outside every at-rule, in module.json's order of the sheets.
 *   3. Each pair - a text token on a ground token, in a theme, `small` (AA 4.5) or `large` (AA 3) - resolved where
 *      Node can (a hex, `rgb()`, a `var()` of one; a text with alpha laid on its ground): ok at AA; "known" below it
 *      where the file writes that ratio as `known` (E48's work, whose goal holds Legacy's contrast: never raised to
 *      pass); red below it otherwise, and red where `known` no longer reads (AA met, or another ratio). A value Node
 *      cannot resolve - `color-mix()`, `light-dark()`, a ground with alpha, a token set only on an element - is
 *      printed "not measured in Node": the style sweep reads computed colours in Chromium (audit/style-sweep.mjs).
 *   4. THE HOURS (E48 K2, 11.11.2026; D30 = 2, Q7): the file's `hours` - each hour token of Stained Glass against each
 *      meaning colour - by CIEDE2000 (tests-css.mjs `labOf`, `deltaE00`, held first to Sharma, Wu and Dalal's test
 *      pairs by `deltaE00Check`), one line a pair, red under the file's threshold. Red before K2: afternoon 10.92 from
 *      Hope, evening 11.66 from Health, night 10.39 from Eclipse.
 * The last line: "contrast: N pair(s), ok A, known K, not measured in Node U; hours H pair(s), nearest D; P problem(s)".
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..");
export const PAIRS_FILE = "tools/contrast-pairs.json";

const lf = text => String(text).replace(/\r\n?/g, "\n");

/** The check: `{ problems, summary, lines }`, a line a pair. */
export async function contrastCheck(repo = DEFAULT_REPO) {
    const T = await import(url.pathToFileURL(path.join(repo, "scripts", "tests-css.mjs")).href);
    const problems = T.contrastSelfCheck().map(p => `self-check: ${p}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, "module.json"), "utf8"));
    const sheets = (manifest.styles ?? []).map(file => [file, lf(fs.readFileSync(path.join(repo, file), "utf8"))]);
    const tokens = T.themeTokens(sheets);
    for (const [theme, map] of Object.entries(tokens)) if (map.size < 50) problems.push(`${theme}: ${map.size} token(s) read - the sheets did not load`);
    let file = null;
    try { file = JSON.parse(fs.readFileSync(path.join(repo, PAIRS_FILE), "utf8")); } catch { /* red below */ }
    const pairs = file?.pairs ?? [];
    if (!pairs.length) problems.push(`${PAIRS_FILE} is missing or lists no pair`);
    const ids = pairs.map(p => p.id);
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (twice.length) problems.push(`${PAIRS_FILE} writes ${[...new Set(twice)].join(", ")} twice`);
    const results = T.contrastOf(pairs, tokens);
    const lines = results.map((r, i) => {
        const p = pairs[i];
        const reading = r.ratio === null ? "not measured in Node" : `${r.ratio.toFixed(2)}:1 (AA ${r.need})`;
        return `  ${r.id}: ${p.text} on ${p.on}, ${p.theme}, ${p.size} - ${reading}, ${r.state}${r.why ? ` - ${r.why}` : ""}`;
    });
    for (const r of results) if (r.state === "low" || r.state === "stale") problems.push(`${r.id}: ${r.state} - ${r.why}`);
    problems.push(...T.deltaE00Check().map(p => `self-check: ${p}`));
    const hours = file?.hours ? T.hourDistances(file.hours, tokens) : { rows: [], problems: [`${PAIRS_FILE} has no \`hours\``] };
    problems.push(...hours.problems);
    for (const r of hours.rows) lines.push(`  hour ${r.hour} against ${r.meaning}: CIEDE2000 ${r.de === null ? "not measured" : r.de.toFixed(2)}${r.de !== null && r.de < file.hours.threshold ? ` - under ${file.hours.threshold}` : ""}`);
    const nearest = hours.rows.filter(r => r.de !== null).sort((x, y) => x.de - y.de)[0];
    const n = state => results.filter(r => r.state === state).length;
    const summary = `contrast: ${pairs.length} pair(s) in ${Object.keys(tokens).length} theme(s), ok ${n("ok")}, known ${n("known")} (below AA, E48's), `
        + `not measured in Node ${n("unmeasured")}; hours ${hours.rows.length} pair(s), nearest ${nearest ? `${nearest.de.toFixed(2)} (${nearest.hour} against ${nearest.meaning})` : "none"}; self-check ${problems.some(p => p.startsWith("self-check: ")) ? "red" : "held"}; ${problems.length} problem(s)`;
    return { problems, summary, lines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const { problems, summary, lines } = await contrastCheck(DEFAULT_REPO);
    for (const line of lines) console.log(line);
    for (const p of problems) console.log(`contrast: ${p}`);
    console.log(summary);
    process.exitCode = problems.length ? 1 : 0;
}
