/**
 * The comments lint (E56 foundation, 12.11.2026; the E56 plan's C1, docs/dev/E56/PLAN.md).
 * ---------------------------------------------------------------------------
 *     node tools/comments-lint.mjs            the counts of every module file in scripts/, held to tools/comment-budget.json
 *     node tools/comments-lint.mjs --write    the same, with each row lowered to its count first (never raised)
 *     node tools/comments-lint.mjs --list     also every finding, one per line, `file:line: name`
 *
 * `node tools/check.mjs comments` runs `commentsLint` below. It needs espree (`npm ci` in audit/harness), as the
 * parts `names`, `moves` and `text` do: a comment is only a comment to a tokenizer - a `//` inside a string, a regex
 * or a template is not one, and a hand-made scan reads those as comments.
 *
 * WHAT IT COUNTS, per module file of scripts/ (the suite's own files, scripts/tests*.mjs, are not read: their
 * comments describe tests, and E56's census rows are their own commit):
 *   citations    a backticked name in a comment - `name` or `name()`, four characters or more - that nothing in the
 *                repository holds as code: no identifier, property, string or template word of scripts/, tools/,
 *                audit/ or macros/, no key segment of lang/en.json or lang/pl.json, no word of styles/, of audit's
 *                HTML, of module.json or of tools' JSON. Such a name was renamed or removed, or is somebody else's
 *                (Foundry's, Daggerheart's, a browser's) - which only a reader can tell, so a name read and kept is
 *                written into the budget's `known` with the reason, and is not counted again.
 *   doubledJsdoc two `/** ... *\/` blocks with nothing but white space between them: the first one usually documents a
 *                function that moved away (E34, E41) and stayed behind over its neighbour. A file's leading header
 *                followed by its first declaration's block is the house style and is not counted.
 *
 * THE BUDGET (tools/comment-budget.json): per file, `citations` and `doubledJsdoc`, as tools/css-budget.json holds the
 * sheets - red above a row (a comment added one), red BELOW a row until the row is lowered in the same commit
 * (`--write`), so the count only falls; a file with a count and no row is red; a row with no file is red. Written at
 * the count of 4dfac3a9's tree on 12.11.2026, so the stage that clears it (E56) lowers it commit by commit and ends
 * at a budget of zero, or at names each `known` with its reason.
 *
 * THE SELF-CHECK, first (CLAUDE.md: a check that reports nothing has proved nothing until it has been shown to report
 * something): a fixture of three files in memory - a cited name that exists, one that does not, one in a string (not
 * a comment), a history-worded one, a doubled block, a header followed by a block, a `known` name - must give exactly
 * the planted findings, and the ratchet's three cases (above, below, equal) and a missing row must answer as written.
 * A self-check that does not hold is red before the files are read.
 *
 * Measured 12.11.2026 on 4dfac3a9 (4 cores): the counts below, about 3 s; the E56 inventory's finder (acorn, a
 * slightly different word set) read 175 citations and 69 doubled blocks, 6 of them headers.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(HERE, "..");
export const BUDGET_FILE = "tools/comment-budget.json";
export const FIELDS = ["citations", "doubledJsdoc"];
const SKIP_DIR = /(^|\/)(node_modules|results|evidence|\.work|\.git)(\/|$)/;
const PARSE = { ecmaVersion: "latest", sourceType: "module", range: true, comment: true };

const lf = text => String(text).replace(/\r\n?/g, "\n");

function walk(repo, dir, test) {
    const out = [];
    let entries;
    try { entries = fs.readdirSync(path.join(repo, dir), { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
        const rel = `${dir}/${e.name}`;
        if (SKIP_DIR.test(rel)) continue;
        if (e.isDirectory()) out.push(...walk(repo, rel, test));
        else if (test(e.name)) out.push(rel);
    }
    return out.sort();
}

const words = text => String(text).split(/[^A-Za-z0-9_$]+/).filter(Boolean);

/** espree's tokens and comments of `text`, or null when it does not tokenize (a file that is not a module). */
function tokenize(espree, text) {
    try { return espree.tokenize(text, PARSE); } catch { return null; }
}

/** Every word the code holds: identifiers, keywords, strings, templates and regexes of each source; words of each other text. */
export function codeWords(espree, sources, texts) {
    const held = new Set();
    for (const [, text] of sources) {
        const tokens = tokenize(espree, text);
        if (!tokens) { words(text).forEach(w => held.add(w)); continue; }
        for (const t of tokens) {
            if (t.type === "Identifier" || t.type === "Keyword" || t.type === "PrivateIdentifier") held.add(t.value.replace(/^#/, ""));
            else if (t.type === "String" || t.type === "Template" || t.type === "RegularExpression") words(t.value).forEach(w => held.add(w));
        }
    }
    for (const [, text] of texts) words(text).forEach(w => held.add(w));
    return held;
}

const lineOf = (text, at) => text.slice(0, at).split("\n").length;

/**
 * The findings of one module file: `{ citations: [{ line, name }], doubledJsdoc: [{ line }] }`. `held` is codeWords'
 * set; `known` the budget's names read and kept (counted nowhere).
 */
export function fileFindings(espree, text, held, known = new Set()) {
    const tokens = tokenize(espree, text);
    const out = { citations: [], doubledJsdoc: [], parsed: Boolean(tokens) };
    if (!tokens) return out;
    const comments = tokens.comments ?? [];
    for (const c of comments) {
        for (const m of c.value.matchAll(/`([A-Za-z_$][\w$]*)(?:\([^`]*\))?`/g)) {
            const name = m[1];
            if (name.length < 4 || held.has(name) || known.has(name)) continue;
            out.citations.push({ line: lineOf(text, c.range[0] + 2 + m.index), name });
        }
    }
    const docs = comments.filter(c => c.type === "Block" && c.value.startsWith("*"));
    const firstToken = tokens.find(t => t.type !== "Punctuator" || t.value !== ";");
    for (let i = 0; i + 1 < docs.length; i++) {
        const [a, b] = [docs[i], docs[i + 1]];
        if (text.slice(a.range[1], b.range[0]).trim() !== "") continue;
        // The file's header: the first comment of the file, standing before every token of code.
        const header = comments[0] === a && (!firstToken || firstToken.range[0] > b.range[1]) && text.slice(0, a.range[0]).trim() === "";
        if (header) continue;
        out.doubledJsdoc.push({ line: lineOf(text, a.range[0]) });
    }
    return out;
}

/** The ratchet: red above a row, red below it (lower it: --write), red for a count with no row and a row with no file. */
export function budgetProblems(counts, budget) {
    const problems = [];
    const rows = budget?.files ?? {};
    for (const [file, got] of Object.entries(counts)) {
        const row = rows[file];
        const any = FIELDS.some(f => got[f] > 0);
        if (!row) { if (any) problems.push(`${file}: ${FIELDS.map(f => `${f} ${got[f]}`).join(", ")} and no row in ${BUDGET_FILE}`); continue; }
        for (const f of FIELDS) {
            const want = Number.isInteger(row[f]) ? row[f] : 0;
            if (got[f] > want) problems.push(`${file}: ${f} ${got[f]}, its budget is ${want} - a comment added one (or name it in \`known\` with the reason)`);
            else if (got[f] < want) problems.push(`${file}: ${f} ${got[f]}, its budget is ${want} - lower the row in this commit (node tools/comments-lint.mjs --write)`);
        }
    }
    for (const file of Object.keys(rows)) if (!(file in counts)) problems.push(`${BUDGET_FILE} holds a row for ${file}, which is no module file of scripts/`);
    return problems;
}

/** The self-check: the planted fixture and the ratchet's cases; one line per answer that is not the one written. */
export function selfCheck(espree) {
    const misses = [];
    const fixture = [
        ["scripts/a.mjs", [
            "/**",
            " * The fixture's header (`realName` exists; `plantedGone` does not).",
            " */",
            "/** The first declaration's own block, after the header: not counted. */",
            "export function realName() { return \"a // `notAComment` here\"; }",
            "// `historyGone` was removed in E00 - history, still counted: a reader decides, the budget keeps it",
            "/** Left behind by a move. */",
            "/** The block of the function below. */",
            "export const other = 1; // `knownForeign` is somebody else's, read and kept",
            ""
        ].join("\n")],
        ["scripts/b.mjs", "export const b = `${\"x\"}`; /* `realName()` is a.mjs's */\n"]
    ];
    const held = codeWords(espree, fixture, []);
    const known = new Set(["knownForeign"]);
    const a = fileFindings(espree, fixture[0][1], held, known), b = fileFindings(espree, fixture[1][1], held, known);
    const got = JSON.stringify({ a: a.citations.map(c => `${c.line}:${c.name}`), ad: a.doubledJsdoc.map(d => d.line), b: b.citations.length, bd: b.doubledJsdoc.length });
    const want = JSON.stringify({ a: ["2:plantedGone", "6:historyGone"], ad: [7], b: 0, bd: 0 });
    if (got !== want) misses.push(`the planted fixture read ${got}, not ${want}`);
    if (held.has("notAComment") === false) misses.push("a word inside a string was not read as code - the word set is wrong");
    const ratchet = [
        [{ "x.mjs": { citations: 2, doubledJsdoc: 0 } }, { files: { "x.mjs": { citations: 1, doubledJsdoc: 0 } } }, 1, "above"],
        [{ "x.mjs": { citations: 0, doubledJsdoc: 0 } }, { files: { "x.mjs": { citations: 1, doubledJsdoc: 0 } } }, 1, "below"],
        [{ "x.mjs": { citations: 1, doubledJsdoc: 1 } }, { files: { "x.mjs": { citations: 1, doubledJsdoc: 1 } } }, 0, "equal"],
        [{ "x.mjs": { citations: 1, doubledJsdoc: 0 } }, { files: {} }, 1, "no row"],
        [{}, { files: { "gone.mjs": { citations: 0, doubledJsdoc: 0 } } }, 1, "a row with no file"]
    ];
    for (const [counts, budget, n, name] of ratchet) {
        const p = budgetProblems(counts, budget);
        if (p.length !== n) misses.push(`the ratchet's case "${name}" answered ${p.length} problem(s), not ${n}`);
    }
    return misses;
}

/**
 * The lint: `{ problems, summary, counts, findings }`. With `write`, each row is lowered to its count before the budget
 * is read (a count above its row stays above it), a file with a count and no row gets one, and a row for a file that is
 * gone, or whose counts are all 0, is dropped; `known` is kept as it is.
 */
export async function commentsLint(repo = DEFAULT_REPO, { write = false } = {}) {
    let espree;
    try { espree = createRequire(path.join(repo, "audit", "harness", "package.json"))("espree"); }
    catch { return { problems: ["espree is not installed - run `npm ci` in audit/harness first"], summary: "comments: nothing read", counts: {}, findings: {} }; }
    const problems = selfCheck(espree).map(p => `self-check: ${p}`);
    const read = rel => lf(fs.readFileSync(path.join(repo, rel), "utf8"));
    const modules = walk(repo, "scripts", n => n.endsWith(".mjs") && !/^tests(-[\w-]+)?\.mjs$/.test(n));
    const sources = [...walk(repo, "scripts", n => n.endsWith(".mjs")), ...walk(repo, "tools", n => n.endsWith(".mjs")),
        ...walk(repo, "audit", n => /\.(mjs|js)$/.test(n)), ...walk(repo, "macros", n => n.endsWith(".js"))].map(f => [f, read(f)]);
    const texts = [...walk(repo, "styles", n => n.endsWith(".css")), ...walk(repo, "audit", n => n.endsWith(".html")),
        ...walk(repo, "tools", n => n.endsWith(".json")), "module.json"].filter(f => fs.existsSync(path.join(repo, f))).map(f => [f, read(f)]);
    const keySegments = [];
    for (const lang of ["lang/en.json", "lang/pl.json"]) {
        const flat = (o, out) => { for (const [k, v] of Object.entries(o)) { out.push(k); if (v && typeof v === "object") flat(v, out); } return out; };
        try { keySegments.push(...flat(JSON.parse(read(lang)), [])); } catch { problems.push(`${lang} does not parse - its keys vouch for nothing`); }
    }
    if (modules.length < 100) problems.push(`scripts/ held ${modules.length} module file(s) - the counts would vouch for nothing`);
    const held = codeWords(espree, sources, [...texts, ["lang keys", keySegments.join(" ")]]);
    const budgetPath = path.join(repo, BUDGET_FILE);
    let budget = null;
    try { budget = JSON.parse(fs.readFileSync(budgetPath, "utf8")); } catch { /* red below */ }
    const known = new Set(Object.keys(budget?.known ?? {}));
    const counts = {}, findings = {};
    let unparsed = 0;
    for (const file of modules) {
        const f = fileFindings(espree, read(file), held, known);
        if (!f.parsed) { unparsed++; problems.push(`${file}: does not tokenize - its comments were not read`); }
        counts[file] = { citations: f.citations.length, doubledJsdoc: f.doubledJsdoc.length };
        findings[file] = f;
    }
    if (write) {
        const rows = {};
        for (const [file, got] of Object.entries(counts)) {
            const old = budget?.files?.[file];
            const row = Object.fromEntries(FIELDS.map(f => [f, Number.isInteger(old?.[f]) ? Math.min(old[f], got[f]) : got[f]]));
            if (FIELDS.some(f => row[f] > 0 || got[f] > 0)) rows[file] = row;
        }
        budget = { about: budget?.about ?? "", known: budget?.known ?? {}, files: rows };
        fs.writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
    }
    if (!budget) problems.push(`${BUDGET_FILE} is missing or not JSON`);
    else {
        // A file at zero needs no row: fill the zero rows in before the ratchet reads them.
        const full = { files: { ...Object.fromEntries(Object.keys(counts).map(f => [f, { citations: 0, doubledJsdoc: 0 }])), ...(budget.files ?? {}) } };
        problems.push(...budgetProblems(counts, full));
        for (const name of Object.keys(budget.known ?? {})) if (!budget.known[name]) problems.push(`${BUDGET_FILE}: \`known\` names ${name} with no reason`);
    }
    const sum = field => Object.values(counts).reduce((n, c) => n + c[field], 0);
    const summary = `comments: ${modules.length} module file(s), ${sources.length} source(s) and ${texts.length} text(s) read for names; `
        + `self-check ${problems.some(p => p.startsWith("self-check: ")) ? "red" : "held"}; cited names no code holds ${sum("citations")}, `
        + `doubled JSDoc ${sum("doubledJsdoc")}, known ${known.size}${unparsed ? `, ${unparsed} not tokenized` : ""}; `
        + `${write ? `budget written to ${BUDGET_FILE}; ` : ""}${problems.length} problem(s)`;
    return { problems, summary, counts, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const { problems, summary, findings } = await commentsLint(DEFAULT_REPO, { write: process.argv.includes("--write") });
    if (process.argv.includes("--list")) {
        for (const [file, f] of Object.entries(findings)) {
            for (const c of f.citations) console.log(`${file}:${c.line}: \`${c.name}\``);
            for (const d of f.doubledJsdoc) console.log(`${file}:${d.line}: doubled JSDoc`);
        }
    }
    for (const p of problems) console.log(`comments: ${p}`);
    console.log(summary);
    process.exitCode = problems.length ? 1 : 0;
}
