/**
 * The keys lint (E56 part 1, 14.11.2026): every leaf key of lang/en.json has a reader, or stands under a prefix the
 * code builds keys from, or under one of KEY_PREFIXES below.
 * ---------------------------------------------------------------------------
 *     node tools/check.mjs keys               the part, in `npm run quick` and `npm test` with every part
 *     node tools/keys-lint.mjs [--list]       the same; --list also prints the keys read only by tests and the prefixes
 *
 * The reading is tools/e56/keys.mjs `find` (its header says what it reads): a key is READ when a string of a code file
 * of scripts/, tools/ or audit/ holds it whole, or holds its plural family; UNSURE when it stands under a prefix a
 * builder in that code makes keys from at run time (a template literal `DRPG.X.${y}`, a "DRPG.X." string joined with
 * `+`, a "DRPG.X." literal ending in a dot), or under `DRPG.Config.`; FOREIGN outside `DRPG.`; DEAD otherwise. This part
 * is red on a DEAD key.
 *
 * WHAT IT DOES NOT HOLD, measured on 123f8242 (14.11.2026): of 5794 keys, 834 are UNSURE under 160 builder prefixes, and
 * a key under one of those passes whether or not its builder can make it; 186 are read only by the suite, the tools or
 * the harness, and pass. Both counts are printed on every run; shrinking them is E56 part 2 (each builder read for the
 * keys it can make). A builder is read off the code, so its prefix needs no row here: KEY_PREFIXES is only for a key
 * the code names in no string at all.
 *
 * RED FIRST. Two plants before the tree is judged, and the part is red if either is not seen: the finder's own fixture
 * (`selfCheck`: one key of each verdict, exactly), and the real tree with one key no code holds added to its en.json
 * (`DRPG.KeysLintPlant.unread`), which must come out DEAD - so a reading that has gone blind on this tree (a parse
 * failure, a folder not read) cannot pass by finding nothing. Needs espree (`npm ci` in audit/harness).
 */

import url from "node:url";
import path from "node:path";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_DEFAULT = path.resolve(HERE, "..");

/**
 * Prefixes whose keys are read by a road no string of the code names. Each with its reason; keep it short. The finder
 * already counts `DRPG.Config.` (i18n.mjs `localizeConfig` builds those from config.mjs's paths), so it is not repeated.
 */
export const KEY_PREFIXES = [];

/* Built from its parts: written whole, this file would hold it as a string, and the finder would call it read here. */
const PLANT_KEY = ["DRPG", "KeysLintPlant", "unread"].join(".");

/** `{ problems, summary, lines }` for the tree at `root`. */
export async function keysLint(root = REPO_DEFAULT, { list = false } = {}) {
    const { readTree, loadEspree } = await import(url.pathToFileURL(path.join(root, "tools", "e56", "lib.mjs")).href);
    const keys = await import(url.pathToFileURL(path.join(root, "tools", "e56", "keys.mjs")).href);
    const espree = loadEspree();
    const problems = [], lines = [];
    const self = keys.selfCheck(espree);
    if (!self.ok) problems.push(`the finder's self-check fails: got ${JSON.stringify(self.got)}, wanted ${JSON.stringify(self.wanted)}`);
    const tree = readTree(root, { espree });
    for (const f of tree.failures) problems.push(f);
    if (!tree.lang.en) problems.push("lang/en.json was not read");
    if (!tree.code.some(f => f.rel.startsWith("scripts/")) || !tree.code.some(f => f.rel.startsWith("tools/"))) {
        problems.push("no file of scripts/ or tools/ was read - the reading is blind");
    }
    // The plant: the same tree, its en.json with one key no code holds.
    const planted = { ...tree, lang: { ...tree.lang, en: { ...(tree.lang.en ?? {}), DRPG: { ...(tree.lang.en?.DRPG ?? {}), KeysLintPlant: { unread: "x" } } } } };
    const plantRow = keys.find(planted).rows.find(r => r.key === PLANT_KEY);
    const plantSeen = plantRow?.verdict === "dead";
    if (!plantSeen) problems.push(`the planted key ${PLANT_KEY} came out ${plantRow?.verdict ?? "unread"}, not dead - the reading cannot see an unread key`);

    const { rows, counts } = keys.find(tree);
    const listed = key => KEY_PREFIXES.find(p => key.startsWith(p.prefix));
    const dead = rows.filter(r => r.verdict === "dead" && !listed(r.key));
    for (const r of dead) problems.push(`${r.key}: no code reads it, and no builder's prefix or KEY_PREFIXES row covers it - delete it from lang/en.json and lang/pl.json, or name its reader`);
    const byListed = rows.filter(r => r.verdict === "dead" && listed(r.key)).length;
    if (list) {
        for (const r of rows.filter(r => r.verdict === "test")) lines.push(`test only: ${r.key}`);
        const why = new Map();
        for (const r of rows.filter(r => r.verdict === "unsure")) why.set(r.why, (why.get(r.why) ?? 0) + 1);
        for (const [w, n] of [...why].sort((a, b) => b[1] - a[1])) lines.push(`unsure ${n}: ${w}`);
    }
    const summary = `keys: ${counts.keys} key(s) of lang/en.json, ${counts.module ?? 0} read by the module, ${counts.test ?? 0} by tests alone, `
        + `${counts.unsure ?? 0} under ${counts.prefixes} builder prefix(es), ${counts.foreign ?? 0} foreign, ${byListed} by KEY_PREFIXES (${KEY_PREFIXES.length} row(s)); `
        + `dead ${dead.length}; self-check ${self.ok ? "held" : "FAILED"}, the planted unread key ${plantSeen ? "seen" : "NOT seen"}; ${problems.length} problem(s)`;
    return { problems, summary, lines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const { problems, summary, lines } = await keysLint(REPO_DEFAULT, { list: process.argv.includes("--list") });
    for (const l of lines) console.log(l);
    for (const p of problems) console.log(`keys: ${p}`);
    console.log(summary);
    process.exitCode = problems.length ? 1 : 0;
}
