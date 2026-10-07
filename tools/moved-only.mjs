/**
 * The proof a move owes: that a commit moved code between files of scripts/ and changed nothing it does (E34 C1,
 * 07.10.2026; the E34 plan, 2.2).
 * ---------------------------------------------------------------------------
 *     node tools/moved-only.mjs <base> [<head>] [--comments]   head defaults to HEAD
 *     node tools/moved-only.mjs --self                          the planted pairs alone (`check.mjs moves`)
 *
 * The split of the largest files (D23 option 1: E34, E41, E54) is pure moves behind a facade: the old file keeps its
 * name and re-exports every name it exported. A reviewer cannot read a 4000-line move for the one line that changed on
 * the way, and no-undef cannot see a name that now resolves to something else, so this reads the commit for them.
 * It reads `git diff -U0 <base> <head> -- scripts/` and both trees through `git show`, running `git` where it is
 * started and naming no repository of its own (GIT_DIR and GIT_WORK_TREE are honoured: E34's mutants read a copy that
 * way). The suite's files (scripts/tests*.mjs) are listed, not judged. The FAMILY is every other file of scripts/ the
 * diff touches, at the base and at the head (a file the commit creates is in it at the head). A FACADE is a family file
 * that was there at the base and lost a top-level statement to another file; a TARGET is a family file that received
 * one, or that the commit creates. Every part prints what it read, then one line per problem,
 * `<part>: <file>:<line>: <message>` (a line of the base says so), and the last line is
 * `moved-only: N part(s), all green` or `moved-only: N part(s), red: <part>, ...` - check.mjs's form. Exit 1 when
 * red, 0 when green, 2 on a usage error.
 *
 *   self      the planted pairs, below: a fixture repository in a temporary directory, judged by the same parts, red
 *             unless exactly the planted problems are reported. And the cut this reads is tests-kit's: red when
 *             `topLevelFunction` here and in scripts/tests-kit.mjs differ beyond comments and spacing.
 *   lines     every removed non-blank line is added somewhere (moved), or sat in an import or `export ... from`
 *             statement, or in a facade's leading comment (A1 rewrites it). Every added line is a removed one
 *             (moved), one with `export ` put in front (promoted) or taken off (demoted: E34's C7b, a promotion an
 *             earlier commit made for a reader that has since moved down), inside an import or `export ... from`
 *             statement, a copy of an alias line (`const X = foundry...;`) the family already had, inside the leading
 *             comment of a file the commit creates or of a facade, or blank. The lines are matched as a multiset
 *             over the whole commit, so a line may move from any family file to any other. With `--comments` (E34's
 *             C10 only), a line left over is also accepted when it is a comment line, or when its code - comments
 *             stripped as tests-lint.mjs strips them - is a left-over line's of the other side. Git's own count is
 *             printed beside it (`--color-moved=plain`, the colours pinned so a user's config cannot move them).
 *             What this part cannot see is where a line went: it is a multiset, so two lines exchanged, or code
 *             written on an import line or after a header's close, pass it - the next part reads that.
 *   statements every top-level statement of the family at the head, imports and `export ... from` aside, reads as one
 *             of the base, and every one of the base as one of the head (a multiset of their tokens: comments and
 *             spacing within a line not counted, a line break between two tokens counted, one leading `export`
 *             not counted, so a promotion or demotion reads the same and `export default` does not), but for an
 *             alias copy (E34 review round 1, M1).
 *   bindings  every module-scope name a top-level statement of the family reads means at the head what it meant at
 *             the base: the same declaration wherever it now lives (a statement is followed by its declared names,
 *             or by its code when it declares none), the same import of a file outside the family, or the same
 *             global. A shadowing import - a new file taking utils' `announce` where the moved code meant the old
 *             file's own wrapper - is red here while no-undef is quiet. And no name it writes is an import at the
 *             head that was its own file's variable at the base: that write throws (M2; eslint's no-import-assign).
 *   api       a facade, and every family file that was there and received nothing, exports at the head exactly its
 *             names at the base, re-exports and `export *` included; every name a family file exported at both ends
 *             resolves, through `export ... from`, to the declaration it resolved to at the base (m1); and no
 *             target imports a facade, statically or through `import()` - the facade rule (CLAUDE.md, "Where the
 *             code lives").
 *   cuts      tests-kit's `topLevelFunction` cut of every function of every family file of the base equals its cut
 *             at the head, comments stripped and `export ` taken off every line start (a cut runs on to the next
 *             function or `const X = {`, so the statements after a function are inside it, a promoted const among
 *             them). Red where the cut changed and a tier file reads the function - its name's string literal in an
 *             array (a row, or a list a loop cuts) or as an argument of fnSource or topLevelFunction, the name as a
 *             key of an object a const with an upper-case name holds (tier 0's DELEGATES), a function the bridge
 *             tables' callee crawls cut (tier 0's refusal reading, the kit's runGuards: always in the table's own
 *             file), or a `guard...` name when a tier file calls withGuards - because a test would then read code
 *             it was not written for, or, where the cut only shrank (a statement it ran on into stayed behind),
 *             less than it was written for (m3). Listed otherwise, and listed for a shrink SHRINK_LISTED names.
 *   jsdoc     a JSDoc `@param` that is not a parameter of the function under it is red when the base did not have
 *             the same mismatch (by the statement's first name and the parameter); one the base had is listed, so a
 *             block that sat over the wrong function before the stage (fog.mjs's findNamed at 1.2.69) is not red
 *             until the commit that relocates it. Statements under two or more JSDoc blocks are counted, and the
 *             ones this commit moved are named, for the commit message.
 *   imports   every import specifier of a family file at the head is read in that file (no-undef does not see a
 *             leftover); no import has no specifiers, and none names a module that no family file imported at the
 *             base, the family's own files aside (each would change which module runs, and when: m2); no family
 *             file holds a CR byte.
 *
 * THE PLANTED PAIRS. A checker that reports nothing has proved nothing until it has been shown to report something,
 * so every run first judges a fixture of eight files - two facades, the files they moved into, a helper, a tier file,
 * a bridge table and a kit that lists it - with these planted: a moved line changed, a comment line lost, a promotion
 * with `export default ` (not `export `), a shadowing import, a dropped re-export, a cut that grew under a name a tier
 * file reads, an `@param` over the wrong function, an unused import and a CR; and the review's P1-P8 (two lines
 * exchanged in a moved function, a line moved between functions, a moved array's elements exchanged, code after a
 * header and on an import line, a re-export's names exchanged, two side-effect imports, a write to a moved `let`)
 * and its cut routes (cuts read as a key and as a quoted key grew, one read by name shrank, one a crawl cuts
 * grew). Thirty-five problems, each at its file and line and, where a line carries two, by a piece of its message;
 * the fixture also moves, promotes and copies an alias line, which must pass. `node tools/check.mjs moves` runs this
 * part alone, so CI keeps the tool honest between the waves that use it.
 *
 * Measured on 07.10.2026: the planted pairs, eleven of eleven. Over a scratch run of E34's mover - its nine commits
 * C2-C9 over 1.2.69's five family files, without the headers and tests a commit session adds - the lines part's counts
 * equalled the prep's scratch count at every commit (moved 658, 613, 1393, 1025, 565, 1070, 585, 3997 and 643 lines;
 * 4 demoted at C7b, one alias copy at C5 and one at C8), 1.3-1.9 s a commit with the planted pairs. Eight of the nine
 * were green; C3 was red on cuts: liftProjectSecrets ran on into three statements its new file put after it, and
 * R172's row reads it by name. What counts as a name (an array or a cutter's argument) and the shrink rule were
 * written after that run read tier 1's `ran.push("tell")` as naming call-effects.mjs's `tell`, and R220's
 * retireOpeningNotices, which only lost a `let` from its run-on, as a change.
 *
 * Measured again on 07.10.2026 (E34 fix r1-G1, after the review's round 1): the planted pairs, thirty-five of
 * thirty-five; the review's eight plants on C6's tree, each green on the tool as C1 wrote it and red here on its own
 * part (P1-P5 statements, P6 api, P7 imports, P8 bindings); part 1 as committed, C2-C6 each against its parent, green
 * on all eight parts; the dry run's nine commits, with and without --comments, as before but for C7a, which only
 * SHRINK_LISTED keeps green (C3 red on liftProjectSecrets still, which the real C3 ordered last); 2.2-2.6 s a commit.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const lint = await import(url.pathToFileURL(path.join(REPO, "scripts", "tests-lint.mjs")).href);

const ALIAS = /^const \w+ = (?:foundry|game|CONFIG|globalThis)[\w.]*;$/;
const SUITE_FILE = /^scripts\/tests[^/]*\.mjs$/;
// Cuts a tier file reads by name that a commit of the stage shrinks, each measured, so they stay listed rather than red
// (fixes-r1.md, G1): on the mover's dry run (scratchpad e34dry, 07.10.2026) C7a moves retireOpeningNotices into
// incident-store.mjs without the `let openingInvited = null;` it ran on into (279 -> 252 characters), and R220's row
// asks its cut for `game.messages.get()`, which the function's own body holds. C7a's A2 reads R220 by hand.
const SHRINK_LISTED = new Map([["retireOpeningNotices", "C7a, R220 read by hand"]]);
const PARTS = ["self", "lines", "statements", "bindings", "api", "cuts", "jsdoc", "imports"];

/** espree and eslint-scope from audit/harness (`npm ci` there); eslint-scope is resolved through ESLint, which owns it. */
function parsers() {
    const harness = createRequire(path.join(REPO, "audit", "harness", "package.json"));
    return { espree: harness("espree"), scope: createRequire(harness.resolve("eslint"))("eslint-scope") };
}

/**
 * tests-kit.mjs's `topLevelFunction`, verbatim: the part `self` compares the two texts on every run, so a change to
 * the kit's cut turns this red instead of leaving the cuts part judging a cut no test reads.
 */
function topLevelFunction(src, name) {
    const text = String(src ?? "");
    const at = text.search(new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, "m"));
    if (at < 0) return null;
    const line = text.indexOf("\n", at);
    if (line < 0) return text.slice(at);
    const next = text.slice(line).search(/^(?:export )?(?:async )?function |^const \w+ = \{/m);
    return text.slice(at, next < 0 ? text.length : line + next);
}

/* ------------------------------ reading git ------------------------------ */

/** A git runner in `cwd` with `env`; every call that prints a diff pins what a user's config could change. */
function gitRunner(cwd, env) {
    return (...args) => execFileSync("git", ["-c", "core.quotePath=false", ...args],
        { cwd, env, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
}

/** One revision of the repository: its files under scripts/, their text and their analysis, each read once. */
function revision(git, rev, P) {
    const files = new Set(git("ls-tree", "-r", "--name-only", rev, "--", "scripts/").split("\n").filter(f => f.endsWith(".mjs")));
    const texts = new Map(), analyses = new Map();
    const text = f => {
        if (!files.has(f)) return null;
        if (!texts.has(f)) texts.set(f, git("show", `${rev}:${f}`));
        return texts.get(f);
    };
    const analysis = f => {
        if (!analyses.has(f)) analyses.set(f, text(f) === null ? null : analyse(text(f), P));
        return analyses.get(f);
    };
    return { rev, files, text, analysis };
}

/** The diff's removed and added lines, hunk by hunk by the counts in each header (a removed line may itself start with "--"). */
function diffLines(git, base, head) {
    const removed = [], added = [];
    const out = git("diff", "-U0", "--no-color", "--no-renames", "--no-ext-diff", "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/",
        base, head, "--", "scripts/").split("\n");
    let oldPath = null, newPath = null;
    for (let i = 0; i < out.length; i++) {
        const l = out[i];
        if (l.startsWith("diff --git ")) { oldPath = newPath = null; continue; }
        if (l.startsWith("--- ")) { oldPath = l === "--- /dev/null" ? null : l.slice(6); continue; }
        if (l.startsWith("+++ ")) { newPath = l === "+++ /dev/null" ? null : l.slice(6); continue; }
        const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
        if (!m) continue;
        let ol = +m[1], rc = m[2] === undefined ? 1 : +m[2], nl = +m[3], ac = m[4] === undefined ? 1 : +m[4];
        while (rc > 0 || ac > 0) {
            const h = out[++i];
            if (h === undefined) throw new Error("the diff ended inside a hunk");
            if (h.startsWith("\\")) continue;
            if (h.startsWith("-") && rc > 0) { removed.push({ file: oldPath, line: ol++, text: h.slice(1) }); rc--; }
            else if (h.startsWith("+") && ac > 0) { added.push({ file: newPath, line: nl++, text: h.slice(1) }); ac--; }
            else throw new Error(`an unexpected line in a hunk: ${h.slice(0, 80)}`);
        }
    }
    return { removed, added };
}

/**
 * Git's own reading of the same diff: the lines `--color-moved=plain` colours as moved, the suite's files left out.
 * The four colours are pinned (moved cyan and magenta, plain green and red), so the count reads the same under any
 * user's config.
 */
function gitMovedCount(git, base, head) {
    const out = git("-c", "color.diff.newMoved=cyan", "-c", "color.diff.oldMoved=magenta", "-c", "color.diff.new=green",
        "-c", "color.diff.old=red", "-c", "color.diff.meta=bold", "-c", "color.diff.frag=bold", "-c", "color.diff.whitespace=normal",
        "diff", "--color=always", "--color-moved=plain", "-U0", "--no-renames", "--no-ext-diff", "--no-textconv", base, head,
        "--", "scripts/", ":(exclude)scripts/tests*.mjs");
    const n = { movedAdded: 0, movedRemoved: 0, plainAdded: 0, plainRemoved: 0 };
    for (const l of out.split("\n")) {
        const m = /^\x1b\[(3[1-6])m([+-])/.exec(l);
        if (!m) continue;
        const key = { 36: "movedAdded", 35: "movedRemoved", 32: "plainAdded", 31: "plainRemoved" }[m[1]];
        if (key) n[key]++;
    }
    return n;
}

/* ------------------------------ one file, parsed ------------------------------ */

const bindingNames = (p, into) => {
    if (!p) return into;
    if (p.type === "Identifier") into.push(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach(q => bindingNames(q.value ?? q.argument, into));
    else if (p.type === "ArrayPattern") p.elements.forEach(e => bindingNames(e, into));
    else if (p.type === "RestElement") bindingNames(p.argument, into);
    else if (p.type === "AssignmentPattern") bindingNames(p.left, into);
    return into;
};
const paramNames = fn => fn.params.map(p => p.type === "Identifier" ? p.name
    : p.type === "AssignmentPattern" && p.left.type === "Identifier" ? p.left.name
    : p.type === "RestElement" && p.argument.type === "Identifier" ? p.argument.name : "{}");

/**
 * A file's top-level statements, each with what identifies it across files (`key`: its kind and declared names, or
 * its code when it declares none), the module-scope names it reads, its leading comments and its parameters; the
 * file's zones (header, import, re-export) by line; what it exports; its imports and which were never read.
 */
function analyse(text, P) {
    const ast = P.espree.parse(text, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true, comment: true, tokens: true });
    const sm = P.scope.analyze(ast, { ecmaVersion: 2025, sourceType: "module" });
    const mod = sm.scopes.find(s => s.type === "module");
    const pieces = [];
    let at = 0;
    for (const c of ast.comments) {
        pieces.push(text.slice(at, c.range[0]), text.slice(c.range[0], c.range[1]).replace(/[^\n]/g, " "));
        at = c.range[1];
    }
    const code = pieces.join("") + text.slice(at);
    const norm = range => code.slice(range[0], range[1]).replace(/\s+/g, " ").trim();
    const lines = text.split("\n");
    const zone = new Array(lines.length + 2).fill("code");
    let headerEnd = 0;
    if (lines[0].startsWith("/**")) {
        let k = 0;
        while (k < lines.length && !lines[k].includes("*/")) k++;
        k++;
        while (k < lines.length && !lines[k].trim()) k++;
        for (let i = 1; i <= k; i++) zone[i] = "header";
        headerEnd = k;
    }
    let token = 0;
    // The statement as the statements part compares it: its tokens, each after a space or - where the code breaks a
    // line between two tokens, which automatic semicolons can read - a line break. No comment is a token and the
    // spacing within a line is not one, so a moved statement reads the same wherever it stands and whatever --comments
    // let change in its comments; one leading `export` is not counted, so a promotion or a demotion reads the same,
    // and `export default` does not (it reads `default ...`).
    function signature(node) {
        const words = [];
        let prev = null;
        for (; token < ast.tokens.length && ast.tokens[token].range[0] < node.range[1]; token++) {
            const t = ast.tokens[token];
            if (t.range[0] < node.range[0]) continue;
            words.push(`${prev && t.loc.start.line > prev.loc.end.line ? "\n" : " "}${t.value}`);
            prev = t;
        }
        if (/^Export(?:Named|Default)Declaration$/.test(node.type) && words[0] === " export") words.shift();
        return words.join("").slice(1);
    }
    const stmts = ast.body.map((node, i) => {
        const decl = (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") && node.declaration ? node.declaration : node;
        const kind = node.type === "ImportDeclaration" ? "import"
            : (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source ? "reexport"
            : node.type === "ExportNamedDeclaration" && !node.declaration ? "exportlist" : "statement";
        if (kind === "import" || kind === "reexport") for (let l = node.loc.start.line; l <= node.loc.end.line; l++) zone[l] = kind;
        let names = [];
        if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id) names = [decl.id.name];
        else if (decl.type === "VariableDeclaration") names = decl.declarations.flatMap(d => bindingNames(d.id, []));
        const prevEnd = i ? ast.body[i - 1].range[1] : 0, prevEndLine = i ? ast.body[i - 1].loc.end.line : 0;
        const lead = ast.comments.filter(c => c.range[0] >= prevEnd && c.range[1] <= node.range[0] && c.loc.start.line > prevEndLine
            && c.loc.start.line > headerEnd);
        const fn = decl.type === "FunctionDeclaration" ? decl
            : decl.type === "VariableDeclaration" && decl.declarations.length === 1 && /^(?:Arrow)?FunctionExpression$/.test(decl.declarations[0].init?.type ?? "")
                ? decl.declarations[0].init : null;
        return {
            node, kind, names, lead, start: node.loc.start.line, params: fn ? paramNames(fn) : null,
            key: names.length ? `${decl.type === "VariableDeclaration" ? decl.kind : decl.type}:${names.join(",")}` : `code:${norm(decl.range)}`,
            alias: lines[node.loc.start.line - 1] !== undefined && node.loc.start.line === node.loc.end.line && ALIAS.test(lines[node.loc.start.line - 1].trim()),
            reads: new Set(), writes: new Set(), sig: signature(node)
        };
    });
    const ownerOf = pos => {
        let lo = 0, hi = stmts.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1, r = stmts[mid].node.range;
            if (pos < r[0]) hi = mid - 1; else if (pos >= r[1]) lo = mid + 1; else return stmts[mid];
        }
        return null;
    };
    const vars = new Map(), imports = [];
    for (const v of mod.variables) {
        const def = v.defs[0];
        if (!def) continue;
        const info = { name: v.name, stmt: ownerOf(def.name.range[0]) };
        if (def.type === "ImportBinding") {
            info.source = def.parent.source.value;
            info.imported = def.node.type === "ImportNamespaceSpecifier" ? "*" : def.node.type === "ImportDefaultSpecifier" ? "default"
                : def.node.imported.name ?? def.node.imported.value;
            imports.push({ name: v.name, source: info.source, line: def.node.loc.start.line, read: v.references.length > 0 });
        }
        vars.set(v.name, info);
        for (const ref of v.references) {
            const owner = ownerOf(ref.identifier.range[0]);
            if (owner && !(ref.init && owner === info.stmt)) owner.reads.add(v.name);
            if (owner && ref.isWrite() && !ref.init) owner.writes.add(v.name);
        }
    }
    for (const ref of sm.globalScope.through) ownerOf(ref.identifier.range[0])?.reads.add(ref.identifier.name);
    // What the file exports: name -> how ({ local } | { from, imported }), and the files of its `export *`.
    const exports = new Map(), stars = [];
    for (const s of stmts) {
        const n = s.node;
        if (n.type === "ExportDefaultDeclaration") exports.set("default", { local: s.names[0] ?? null, line: s.start });
        else if (n.type === "ExportAllDeclaration") {
            if (n.exported) exports.set(n.exported.name ?? n.exported.value, { from: n.source.value, imported: "*", line: s.start });
            else stars.push(n.source.value);
        } else if (n.type === "ExportNamedDeclaration") {
            if (n.declaration) for (const name of s.names) exports.set(name, { local: name, line: s.start });
            for (const sp of n.specifiers ?? []) {
                const name = sp.exported.name ?? sp.exported.value, local = sp.local.name ?? sp.local.value;
                exports.set(name, n.source ? { from: n.source.value, imported: local, line: s.start } : { local, line: s.start });
            }
        }
    }
    const dynamic = [];
    const visit = node => {
        if (!node || typeof node.type !== "string") return;
        if (node.type === "ImportExpression" && node.source.type === "Literal") dynamic.push({ source: String(node.source.value), line: node.loc.start.line });
        for (const v of Object.values(node)) {
            if (Array.isArray(v)) v.forEach(visit);
            else if (v && typeof v.type === "string" && v !== node) visit(v);
        }
    };
    ast.body.forEach(visit);
    return { text, lines, zone, stmts, vars, imports, exports, stars, dynamic };
}

/** "./x.mjs" read from scripts/a.mjs -> scripts/x.mjs; null for a module outside the repository. */
const resolvePath = (from, source) => source.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(from), source)) : null;

/* ------------------------------ the parts ------------------------------ */

/**
 * Judges base..head and returns { problems: { part: [line] }, report: [line] } - the report is what each part read.
 * `git` runs in the repository; `comments` is `--comments`.
 */
export function judge(git, base, head, { comments = false } = {}) {
    const P = parsers();
    const B = revision(git, base, P), H = revision(git, head, P);
    const { removed: allRemoved, added: allAdded } = diffLines(git, base, head);
    const report = [], problems = Object.fromEntries(PARTS.filter(p => p !== "self").map(p => [p, []]));
    const changedFiles = new Set([...allRemoved, ...allAdded].map(l => l.file).filter(Boolean));
    const touched = new Set([...changedFiles].filter(f => f.endsWith(".mjs") && !SUITE_FILE.test(f)));
    const unread = [...changedFiles].filter(f => !f.endsWith(".mjs")).sort();
    const suiteTouched = [...new Set([...allRemoved, ...allAdded].map(l => l.file).filter(f => f && SUITE_FILE.test(f)))].sort();
    const family = [...touched].sort();
    const baseFamily = family.filter(f => B.files.has(f)), headFamily = family.filter(f => H.files.has(f));
    const created = new Set(headFamily.filter(f => !B.files.has(f)));

    // Statements across the commit: each base statement of the family paired with its head statement by key, the
    // same file first, so a statement is followed wherever it moved.
    const baseStmts = baseFamily.flatMap(f => B.analysis(f).stmts.filter(s => s.kind === "statement").map(s => ({ ...s, file: f })));
    const headStmts = headFamily.flatMap(f => H.analysis(f).stmts.filter(s => s.kind === "statement").map(s => ({ ...s, file: f })));
    const byKey = new Map();
    for (const h of headStmts) { if (!byKey.has(h.key)) byKey.set(h.key, []); byKey.get(h.key).push(h); }
    const pairs = [], lost = [];
    const pairOf = new Map();   // "file:line" at the head -> the base statement
    for (const pass of ["same file", "any file"]) {
        for (const b of baseStmts) {
            if (b.paired) continue;
            const list = byKey.get(b.key) ?? [];
            const i = list.findIndex(h => !h.paired && (pass === "any file" || h.file === b.file));
            if (i < 0) continue;
            b.paired = list[i]; list[i].paired = b;
            pairs.push([b, list[i]]);
            pairOf.set(`${list[i].file}:${list[i].start}`, b);
        }
    }
    for (const b of baseStmts) if (!b.paired) lost.push(b);
    const facades = new Set(pairs.filter(([b, h]) => b.file !== h.file).map(([b]) => b.file));
    // Each target, with the facades it received statements from: a target importing one of those is red (api), one
    // importing another family's facade is an importer like any other (C3's projects-tray.mjs reads projects.mjs).
    const targets = new Map([...created].map(f => [f, new Set()]));
    for (const [b, h] of pairs.filter(([b, h]) => b.file !== h.file)) {
        if (!targets.has(h.file)) targets.set(h.file, new Set());
        targets.get(h.file).add(b.file);
    }
    const aliasBase = new Map(baseStmts.filter(s => s.alias).map(s => [s.key, s]));
    report.push(`family: ${family.length} file(s) of scripts/ the diff touches${family.length ? ` (${family.join(", ")})` : ""}; `
        + `${created.size} created, ${facades.size} facade(s) [${[...facades].join(", ")}], ${targets.size} target(s); `
        + `${baseStmts.length} top-level statements at the base, ${headStmts.length} at the head, ${pairs.length} paired, `
        + `${pairs.filter(([b, h]) => b.file !== h.file).length} of them moved to another file`);
    if (suiteTouched.length) report.push(`suite files touched, listed, not judged: ${suiteTouched.join(", ")}`);
    if (unread.length) problems.lines.push(...unread.map(f => `${f}:1: not a module, so no part can read it`));

    linesPart(B, H, allRemoved, allAdded, { touched, facades, created, baseFamily, comments }, report, problems.lines);
    statementsPart(B, H, { baseFamily, headFamily }, report, problems.statements);
    const g = gitMovedCount(git, base, head);
    report.push(`lines, git's count (--color-moved=plain, the suite's files left out): moved +${g.movedAdded} -${g.movedRemoved}, `
        + `not moved +${g.plainAdded} -${g.plainRemoved} (blank and import lines included)`);
    const resolve = resolver(B, H, { family: new Set(family), pairOf, aliasBase });
    bindingsPart(B, H, { pairs, lost, resolve }, report, problems.bindings);
    apiPart(B, H, { baseFamily, headFamily, facades, targets, resolve }, report, problems.api);
    cutsPart(B, H, { baseFamily, headFamily, pairs }, report, problems.cuts);
    jsdocPart(B, H, { baseFamily, headFamily, pairOf }, report, problems.jsdoc);
    importsPart(B, H, { baseFamily, headFamily }, report, problems.imports);
    return { problems, report };
}

function linesPart(B, H, allRemoved, allAdded, { touched, facades, created, baseFamily, comments }, report, out) {
    const removed = allRemoved.filter(r => touched.has(r.file)), added = allAdded.filter(a => touched.has(a.file));
    const n = { blank: [0, 0], import: [0, 0], reexport: [0, 0], header: [0, 0], moved: 0, promoted: 0, demoted: 0, alias: 0, comment: [0, 0] };
    const pool = new Map(), leftRemoved = [];
    for (const r of removed) {
        if (!r.text.trim()) { n.blank[1]++; continue; }
        const z = B.analysis(r.file).zone[r.line];
        if (z === "import" || z === "reexport") { n[z][1]++; continue; }
        if (z === "header") {
            if (facades.has(r.file)) { n.header[1]++; continue; }
            leftRemoved.push({ ...r, why: "the leading comment of a file that is not a facade" });
            continue;
        }
        if (!pool.has(r.text)) pool.set(r.text, []);
        pool.get(r.text).push(r);
    }
    const take = t => { const xs = pool.get(t); return xs?.length ? xs.shift() : null; };
    let pending = [];
    const leftAdded = [];
    for (const a of added) {
        if (!a.text.trim()) { n.blank[0]++; continue; }
        const z = H.analysis(a.file).zone[a.line];
        if (z === "import" || z === "reexport") { n[z][0]++; continue; }
        if (z === "header") {
            if (created.has(a.file) || facades.has(a.file)) { n.header[0]++; continue; }
            leftAdded.push({ ...a, why: "the leading comment of a file the commit neither creates nor makes a facade" });
            continue;
        }
        pending.push(a);
    }
    pending = pending.filter(a => !(take(a.text) && ++n.moved));
    pending = pending.filter(a => !(a.text.startsWith("export ") && take(a.text.replace(/^export /, "")) && ++n.promoted));
    pending = pending.filter(a => !(take(`export ${a.text}`) && ++n.demoted));
    const familyAliases = new Set(baseFamily.flatMap(f => B.analysis(f).lines.map(l => l.trim()).filter(l => ALIAS.test(l))));
    for (const a of pending) {
        if (ALIAS.test(a.text.trim()) && familyAliases.has(a.text.trim())) n.alias++;
        else leftAdded.push({ ...a, why: "added" });
    }
    leftRemoved.push(...[...pool.values()].flat().map(r => ({ ...r, why: "removed and not added anywhere" })));
    let restAdded = leftAdded, restRemoved = leftRemoved;
    if (comments) {
        // C10's reading: a line whose code did not change, comments stripped as tests-lint.mjs strips them.
        const codeOf = (rev, l) => {
            const a = rev.analysis(l.file);
            if (!a.stripped) a.stripped = lint.stripComments(a.text).split("\n");
            return (a.stripped[l.line - 1] ?? "").replace(/\s+/g, " ").trim();
        };
        const codePool = new Map();
        restRemoved = leftRemoved.filter(r => {
            const c = codeOf(B, r);
            if (!c) { n.comment[1]++; return false; }
            if (!codePool.has(c)) codePool.set(c, []);
            codePool.get(c).push(r);
            return true;
        });
        restAdded = leftAdded.filter(a => {
            const c = codeOf(H, a);
            if (!c) { n.comment[0]++; return false; }
            const xs = codePool.get(c);
            if (xs?.length) { const r = xs.shift(); r.matched = true; n.comment[0]++; n.comment[1]++; return false; }
            return true;
        });
        restRemoved = restRemoved.filter(r => !r.matched);
    }
    report.push(`lines: ${removed.length} removed and ${added.length} added in ${touched.size} file(s): moved ${n.moved}, promoted ${n.promoted}, `
        + `demoted ${n.demoted}, alias copies ${n.alias}, header lines +${n.header[0]} -${n.header[1]}; import lines +${n.import[0]} -${n.import[1]}, `
        + `export-from lines +${n.reexport[0]} -${n.reexport[1]}, blank +${n.blank[0]} -${n.blank[1]}`
        + (comments ? `; --comments: comment-only or same-code lines +${n.comment[0]} -${n.comment[1]}` : "")
        + `; left over +${restAdded.length} -${restRemoved.length}`);
    for (const a of restAdded) out.push(`${a.file}:${a.line}: ${a.why}: ${a.text.trim().slice(0, 120)}`);
    for (const r of restRemoved) out.push(`${r.file}:${r.line} (at the base): ${r.why}: ${r.text.trim().slice(0, 120)}`);
}

/*
 * The lines part pairs lines as a multiset over the whole commit and excuses the header and import zones whole, so
 * on 07.10.2026 (E34's review, round 1) five changed programs passed it - two lines exchanged inside a moved function,
 * a line moved from one function into another, a moved array's elements exchanged, code written after a new file's
 * header and on an import line. This part reads what those cannot hide from: each top-level statement of the family,
 * imports and `export ... from` aside, as its tokens (analyse's `signature`), compared as a multiset at the base and
 * the head. A statement the head has and the base does not is red, and so is one the base has and the head does not,
 * but for a copy of an alias statement the family already had (the lines part's alias copy).
 */
function statementsPart(B, H, { baseFamily, headFamily }, report, out) {
    const of = (rev, files) => files.flatMap(f => rev.analysis(f).stmts.filter(s => s.kind !== "import" && s.kind !== "reexport").map(s => ({ ...s, file: f })));
    const base = of(B, baseFamily), head = of(H, headFamily);
    const pool = new Map();
    for (const s of base) { if (!pool.has(s.sig)) pool.set(s.sig, []); pool.get(s.sig).push(s); }
    const aliases = new Set(base.filter(s => s.alias).map(s => s.sig));
    let same = 0, alias = 0;
    const extra = [];
    for (const s of head) {
        const xs = pool.get(s.sig);
        if (xs?.length) { xs.shift(); same++; }
        else if (s.alias && aliases.has(s.sig)) alias++;
        else extra.push(s);
    }
    const missing = [...pool.values()].flat();
    const label = s => s.names[0] ?? `\`${s.sig.split("\n")[0].slice(0, 60)}\``;
    report.push(`statements: ${base.length} top-level statements of the family at the base and ${head.length} at the head, imports and `
        + `export-from aside; ${same} read the same, alias copies ${alias}; left over +${extra.length} -${missing.length}`);
    for (const s of extra) out.push(`${s.file}:${s.start}: ${label(s)} reads like no statement of the base (changed on the way, or new)`);
    for (const s of missing) out.push(`${s.file}:${s.start} (at the base): ${label(s)} reads like no statement of the head (changed on the way, or gone)`);
}

/*
 * What a name means in `file` at a revision, for the bindings and api parts. A declaration of the family is named by
 * the base statement it is (the pairing), so a moved declaration means itself; a file outside the family is the same
 * file at both ends, so its exports are named by file and name without reading it.
 */
function resolver(B, H, { family, pairOf, aliasBase }) {
    const identity = (rev, file, stmt, name) => {
        if (!family.has(file)) return `${file}#${name}`;
        if (rev === B) return `${file}:${stmt.start}#${name}`;
        const b = pairOf.get(`${file}:${stmt.start}`);
        if (b) return `${b.file}:${b.start}#${name}`;
        const alias = stmt.alias ? aliasBase.get(stmt.key) : null;
        return alias ? `${alias.file}:${alias.start}#${name}` : `new ${file}:${stmt.start}#${name}`;
    };
    const exported = (rev, file, name, seen = new Set()) => {
        if (!family.has(file)) return rev.files.has(file) || B.files.has(file) || H.files.has(file) ? `${file}#${name}` : `no file ${file}`;
        const a = rev.analysis(file);
        if (!a) return `no file ${file}`;
        if (seen.has(`${file}#${name}`)) return `a cycle at ${file}#${name}`;
        seen.add(`${file}#${name}`);
        const e = a.exports.get(name);
        if (e?.from !== undefined) {
            const to = resolvePath(file, e.from);
            if (!to) return `${e.from}#${e.imported}`;
            return e.imported === "*" ? `namespace ${to}` : exported(rev, to, e.imported, seen);
        }
        if (e) return e.local === null ? `${file}#default (an expression)` : meaning(rev, file, e.local, seen);
        for (const s of a.stars) {
            const to = resolvePath(file, s);
            const r = to ? exported(rev, to, name, seen) : null;
            if (r && !/^(?:no file|not exported)/.test(r)) return r;
        }
        return `not exported by ${file}: ${name}`;
    };
    const meaning = (rev, file, name, seen = new Set()) => {
        const v = rev.analysis(file).vars.get(name);
        if (!v) return `global ${name}`;
        if (v.source === undefined) return identity(rev, file, v.stmt, name);
        const to = resolvePath(file, v.source);
        if (!to) return `${v.source}#${v.imported}`;
        return v.imported === "*" ? `namespace ${to}` : exported(rev, to, v.imported, seen);
    };
    return { meaning, exported };
}

function bindingsPart(B, H, { pairs, lost, resolve: { meaning } }, report, out) {
    let names = 0, writes = 0;
    for (const [b, h] of pairs) {
        for (const name of new Set([...b.reads, ...h.reads])) {
            names++;
            const was = meaning(B, b.file, name), now = meaning(H, h.file, name);
            if (was !== now) out.push(`${h.file}:${h.start}: ${b.names[0] ?? "a statement"} reads ${name}, which meant ${was} at the base (${b.file}:${b.start}) and means ${now} here`);
        }
        // A write resolves to the declaration it wrote before, so the comparison above passes it; but a `let` that
        // moved to another file is an import binding here, read-only, and the write throws when it runs (E34 review
        // round 1, plant P8: fog.mjs's lastFogReason). eslint's no-import-assign says the same for a whole file.
        for (const name of h.writes) {
            writes++;
            const was = B.analysis(b.file).vars.get(name), now = H.analysis(h.file).vars.get(name);
            if (now?.source !== undefined && was?.source === undefined) {
                out.push(`${h.file}:${h.start}: ${b.names[0] ?? "a statement"} writes ${name}, its own file's variable at the base (${b.file}:${b.start}) and an import here, which cannot be written`);
            }
        }
    }
    for (const b of lost) out.push(`${b.file}:${b.start} (at the base): ${b.names[0] ?? b.key.slice(0, 60)} is not at the head, so what it reads cannot be compared`);
    report.push(`bindings: ${pairs.length} statements followed from the base to the head, ${names} module-scope names they read resolved at both ends, `
        + `${writes} written names checked for an import; ${lost.length} not found at the head`);
}

function apiPart(B, H, { baseFamily, headFamily, facades, targets, resolve: { exported } }, report, out) {
    const listOf = (rev, f) => {
        const a = rev.analysis(f);
        return new Map([...a.exports.entries()].map(([k, v]) => [k, v.line]).concat(a.stars.map(s => [`* from ${s}`, 0])));
    };
    const judged = baseFamily.filter(f => H.files.has(f) && (facades.has(f) || !targets.has(f)));
    let names = 0;
    for (const f of judged) {
        const was = listOf(B, f), now = listOf(H, f);
        names += was.size;
        for (const [k, line] of was) if (!now.has(k)) out.push(`${f}:${line} (at the base): exported ${k} at the base and does not at the head`);
        for (const [k, line] of now) if (!was.has(k)) out.push(`${f}:${line}: exports ${k}, which it did not at the base`);
    }
    for (const f of baseFamily) if (!H.files.has(f)) out.push(`${f}:1 (at the base): the file is gone at the head`);
    // A name still exported can be bound to another declaration - a facade's re-export with two names exchanged passed
    // the lists above (E34 review round 1, plant P6) - so each name a family file exported at both ends is followed,
    // through `export ... from`, to the declaration it resolves to there. A name a target no longer exports is not
    // judged here: a demotion (E34's C7b) takes `export ` off one, and a facade's lost name is red above.
    let resolved = 0;
    for (const f of baseFamily.filter(f => H.files.has(f))) {
        const now = H.analysis(f).exports;
        for (const name of B.analysis(f).exports.keys()) {
            if (!now.has(name)) continue;
            resolved++;
            const was = exported(B, f, name), is = exported(H, f, name);
            if (was !== is) out.push(`${f}:${now.get(name).line}: exports ${name} as ${is}, which was ${was} at the base`);
        }
    }
    let edges = 0;
    for (const f of headFamily.filter(t => targets.has(t))) {
        const own = targets.get(f);
        const a = H.analysis(f);
        const uses = [...a.stmts.filter(s => s.kind === "import" || s.kind === "reexport").map(s => ({ source: s.node.source.value, line: s.start })), ...a.dynamic];
        for (const u of uses) {
            edges++;
            const to = resolvePath(f, u.source);
            if (to && own.has(to)) out.push(`${f}:${u.line}: imports ${to}, the facade it received code from (a new file never imports its facade)`);
        }
    }
    report.push(`api: ${judged.length} file(s) judged (${judged.join(", ") || "none"}), ${names} exported names at the base; `
        + `${resolved} names exported at both ends followed to their declarations; ${edges} import(s) of the targets read for a facade`);
}

function cutsPart(B, H, { baseFamily, headFamily, pairs }, report, out) {
    const tiers = [...H.files].filter(f => lint.TEST_FILE.test(path.posix.basename(f)));
    const tierText = tiers.map(f => lint.blankComments(H.text(f))).join("\n");
    const brackets = lint.blankLiterals(tierText);
    const guardsRead = /\bwithGuards\(/.test(brackets);
    const opener = at => {
        let depth = 0, i = at - 1;
        for (; i >= 0; i--) {
            const c = brackets[i];
            if (c === ")" || c === "]" || c === "}") depth++;
            else if (c === "(" || c === "[" || c === "{") { if (depth === 0) break; depth--; }
        }
        return i;
    };
    // A key of an object literal a const with an upper-case name holds - the form of tier 0's DELEGATES and
    // MUST_BE_LIVE, whose keys a loop cuts. Not any key: on 07.10.2026 the tier files held 300-odd keys named like a
    // function of scripts/ (`send`, `state`, `active`, `grants`, and tier 1's `tell:` that is a declaration's option),
    // and counting them turned C2 red on call-effects.mjs's `tell`, which no test cuts.
    const isKey = (start, end) => {
        const at = opener(start);
        return at >= 0 && brackets[at] === "{" && /^\s*:(?!:)/.test(brackets.slice(end)) && /[{,]\s*$/.test(brackets.slice(at, start))
            && /\bconst [A-Z][A-Z0-9_]* = $/.test(brackets.slice(Math.max(0, at - 60), at));
    };
    // The callee crawls of the bridge's tables (tier 0's refusal reading, the kit's runGuards): from each table's runs,
    // every name called in a function they cut, cut again - always in the table's own file, so what the crawls read is
    // the functions of those files they reach. Read here with the crawls' own regex, over the head's text.
    const kit = H.text("scripts/tests-kit.mjs");
    const tableFiles = [...(kit?.match(/\bBRIDGE_TABLE_FILES = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] ?? "").matchAll(/\[\s*"([\w.-]+\.mjs)"\s*,\s*"\w+"\s*\]/g)].map(m => m[1]);
    if (kit !== null && !tableFiles.length) out.push("scripts/tests-kit.mjs:1: BRIDGE_TABLE_FILES is not read here, so the functions the bridge crawls cut are not known");
    const crawled = new Set();
    for (const file of tableFiles) {
        const text = lint.stripComments(H.text(`scripts/${file}`) ?? "");
        const queue = [...text.matchAll(/^\s*run: ([A-Za-z_$][\w$]*),?\s*$/gm)].map(m => m[1]);
        if (!queue.length) out.push(`scripts/${file}:1: no \`run: <name>\` line is read in the bridge table file, so its crawl is not known`);
        const seen = new Set();
        while (queue.length) {
            const name = queue.shift();
            if (seen.has(name)) continue;
            seen.add(name);
            const source = topLevelFunction(text, name);
            if (!source) continue;
            crawled.add(name);
            for (const m of lint.blankLiterals(source).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) queue.push(m[1]);
        }
    }
    // How a tier file names a function, or null: the name's string literal in an array - a row such as R172's
    // ["projects.mjs", "liftProjectSecrets", ...], or a list a loop cuts - or as an argument of fnSource or
    // topLevelFunction; the name as an object literal's key, bare or quoted (tier 0's DELEGATES and MUST_BE_LIVE cut
    // each key); a function the bridge crawls cut; a `guard...` name when a tier file calls withGuards. Not any
    // literal: at 1.2.69 `ran.push("tell")` in tier 1 would name call-effects.mjs's `tell`.
    const named = name => {
        if (guardsRead && /^guard[A-Z]/.test(name)) return "a guard withGuards reads";
        if (crawled.has(name)) return "a bridge crawl cuts it";
        for (const m of tierText.matchAll(new RegExp(`(["'\`])${name}\\1`, "g"))) {
            const i = opener(m.index);
            if (i < 0) continue;
            if (brackets[i] === "[" || (brackets[i] === "(" && /\b(?:fnSource|topLevelFunction)\s*$/.test(brackets.slice(Math.max(0, i - 40), i)))) return "by name";
            if (isKey(m.index, m.index + m[0].length)) return "as a quoted key";
        }
        for (const m of brackets.matchAll(new RegExp(`(?<![\\w$.])${name}(?![\\w$])`, "g"))) if (isKey(m.index, m.index + name.length)) return "as a key";
        return null;
    };
    const norm = s => lint.stripComments(s ?? "").replace(/^export /gm, "").replace(/\s+/g, " ").trim();
    const movedTo = new Map(pairs.map(([b, h]) => [`${b.file}#${b.names[0]}`, h.file]));
    let same = 0, all = 0;
    const listed = [];
    for (const f of baseFamily) {
        const text = B.text(f);
        for (const m of text.matchAll(/^(?:export )?(?:async )?function (\w+)\(/gm)) {
            const name = m[1];
            all++;
            const declaring = headFamily.filter(h => topLevelFunction(H.text(h), name) !== null);
            const where = declaring.includes(movedTo.get(`${f}#${name}`)) ? movedTo.get(`${f}#${name}`) : declaring[0];
            const was = norm(topLevelFunction(text, name)), now = where ? norm(topLevelFunction(H.text(where), name)) : "";
            if (was === now) { same++; continue; }
            // A cut that only lost its run-on - the head's is the base's with whole statements gone from its end, as
            // when a `let` the function was followed by stays behind - lets no test read anything it did not read;
            // one that grew or changed does, and a test that reads it by name would read code it was never written for.
            const shrank = where && was.startsWith(now) && now.length > 0;
            const what = where ? `${name}'s cut ${shrank ? "shrank" : "is"} ${was.length} -> ${now.length} characters (from ${f})`
                : `${name} is not a top-level function of the family at the head (from ${f})`;
            const route = named(name);
            if (!route || (shrank && SHRINK_LISTED.has(name))) { listed.push(route ? `${what}, read ${route} (${SHRINK_LISTED.get(name)})` : what); continue; }
            const at = where ? `${where}:${lint.lineAt(H.text(where), H.text(where).search(new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, "m")))}`
                : `${f}:${lint.lineAt(text, m.index)} (at the base)`;
            out.push(`${at}: ${what}, and a tier file reads it (${route})${shrank ? ": a test would read less than it was written for" : ""}`);
        }
    }
    report.push(`cuts: ${all} functions of the base's family files, ${same} cuts identical at the head; ${tiers.length} tier files read for names, `
        + `${crawled.size} functions the bridge crawls cut in ${tableFiles.length} table file(s); ${listed.length} listed (no tier file reads the function, or its shrink is one SHRINK_LISTED names)`
        + `${listed.length ? `: ${listed.join("; ")}` : ""}`);
}

function jsdocPart(B, H, { baseFamily, headFamily, pairOf }, report, out) {
    const mismatches = (a) => {
        const found = [];
        let multi = 0;
        for (const s of a.stmts) {
            const docs = s.lead.filter(c => c.type === "Block" && c.value.startsWith("*"));
            if (docs.length > 1) multi++;
            for (const d of docs) {
                for (const m of d.value.matchAll(/@param\s+(?:\{[^}]*\}\s+)?\[?([A-Za-z_$][\w$]*)/g)) {
                    const p = m[1];
                    if (s.params && (s.params.includes(p) || s.params.includes("{}"))) continue;
                    found.push({ s, p, key: `${s.names[0] ?? s.key}|${p}`, why: s.params ? `not a parameter of ${s.names[0]}(${s.params.join(", ")})` : `over a statement that takes no parameters` });
                }
            }
        }
        return { found, multi };
    };
    const was = new Set(baseFamily.flatMap(f => mismatches(B.analysis(f)).found.map(x => x.key)));
    let multi = 0, read = 0;
    const kept = [], movedMulti = [];
    for (const f of headFamily) {
        const a = H.analysis(f);
        const r = mismatches(a);
        multi += r.multi;
        read += a.stmts.length;
        for (const x of r.found) {
            if (was.has(x.key)) kept.push(`${x.s.names[0]} @param ${x.p}`);
            else out.push(`${f}:${x.s.start}: @param ${x.p} ${x.why}`);
        }
        for (const s of a.stmts) {
            const b = pairOf.get(`${f}:${s.start}`);
            if (b && b.file !== f && s.lead.filter(c => c.type === "Block" && c.value.startsWith("*")).length > 1) movedMulti.push(`${s.names[0] ?? "a statement"} (${f}:${s.start})`);
        }
    }
    report.push(`jsdoc: ${read} statements of the family at the head; ${kept.length} @param mismatch(es) the base had, listed${kept.length ? ` (${kept.join(", ")})` : ""}; `
        + `${multi} statement(s) under two or more JSDoc blocks, ${movedMulti.length} moved by this commit${movedMulti.length ? `: ${movedMulti.join(", ")}` : ""}`);
}

function importsPart(B, H, { baseFamily, headFamily }, report, out) {
    // A module a family file imports runs before it, names or none, so an import the base did not have changes when
    // a module runs - or that it runs at all - with nothing to read for it (E34 review round 1, plant P7:
    // `import "./sheet.mjs";` in a new file passed). A move may import what the family imported, and its own files.
    const sources = (f, a) => a.stmts.filter(s => s.kind === "import" || s.kind === "reexport").map(s => ({ s, to: resolvePath(f, s.node.source.value) ?? s.node.source.value }));
    const known = new Set([...baseFamily, ...headFamily, ...baseFamily.flatMap(f => sources(f, B.analysis(f)).map(x => x.to))]);
    let specifiers = 0, declarations = 0;
    for (const f of headFamily) {
        const a = H.analysis(f);
        for (const i of a.imports) {
            specifiers++;
            if (!i.read) out.push(`${f}:${i.line}: imports ${i.name} from ${i.source} and never reads it`);
        }
        for (const { s, to } of sources(f, a)) {
            declarations++;
            if (s.kind === "import" && !s.node.specifiers.length) out.push(`${f}:${s.start}: imports ${s.node.source.value} for its side effects alone, a module run that nothing in the family reads`);
            if (!known.has(to)) out.push(`${f}:${s.start}: imports ${s.node.source.value}, which no file of the family imported at the base`);
        }
        const cr = a.text.indexOf("\r");
        if (cr >= 0) out.push(`${f}:${a.text.slice(0, cr).split("\n").length}: holds a CR byte (every file of scripts/ is LF)`);
    }
    report.push(`imports: ${specifiers} import specifiers and ${declarations} import or export-from declarations in ${headFamily.length} family file(s) at the head, `
        + `${known.size} modules the family's files or their base imports name`);
}

/* ------------------------------ the planted pairs ------------------------------ */

/*
 * The fixture: scripts/fam.mjs at the base, split into fam.mjs (the facade) and fam-new.mjs at the head, and geo.mjs
 * split into geo.mjs and geo-parts.mjs, beside a helper (util.mjs), a tier file that reads `grown` and `shrinks` by
 * name and `keyed` as a key, and a bridge table (table.mjs, listed in a tests-kit.mjs of the fixture's own) whose run
 * calls `crawled`. What must pass: a move, a promotion (`inner`, `lastReason`), an alias copy (`Thing`), a rewritten
 * facade header and a new file's header, and statements moved to the end of a function that no test reads by name
 * (SPARE after `keyed` would be one, were `keyed` not a key). What is planted is listed in PLANTED, each by the part that
 * must report it, a piece of the line it must report it at and, where one line carries two problems, a piece of the
 * message. geo.mjs carries the plants of E34's review, round 1 (P1-P8, correctness-r1.md).
 */
const FIXTURE_BASE = {
    "scripts/util.mjs": `/**
 * util.mjs - the fixture's helpers.
 */

export function announce(text) {
    return \`util: \${text}\`;
}

export function unusedHelper() {
    return 0;
}
`,
    "scripts/tests-tier0.mjs": `/**
 * The fixture's tier file: it reads one cut by name.
 */

export const READS = [["fam.mjs", "grown"], ["fam.mjs", "shrinks"]];
export const KEYS = { keyed: "returns", "quoted": "returns", options: { changed: true } };
`,
    "scripts/tests-kit.mjs": `const BRIDGE_TABLE_FILES = Object.freeze([
    ["table.mjs", "ACTIONS"]
]);
`,
    "scripts/table.mjs": `/**
 * table.mjs - the fixture's bridge table.
 */

export const ACTIONS = {
    go: {
        run: runGo,
    }
};

function runGo() {
    return crawled();
}

function crawled() {
    return 8;
}

export function lastOne() {
    return 9;
}
`,
    "scripts/geo.mjs": `/**
 * geo.mjs - the fixture's second family before the move.
 */

import { announce } from "./util.mjs";

let lastReason = "none";

export const ORDER = [
    "first",
    "second",
];

export function commonest(counts) {
    let best = null, most = 0;
    for (const [key, count] of counts) {
        if (count > most) {
            most = count;
            best = key;
        }
    }
    return best;
}

export function spacing(lattice) {
    if (!(lattice > 0)) return 0;
    return 1 / lattice;
}

export function latticeCheck(lattice) {
    return lattice * 2;
}

export function north() {
    return announce("north");
}

export function south() {
    return announce("south");
}

export function paint() {
    lastReason = "painted";
    return lastReason;
}
`,
    "scripts/fam.mjs": `/**
 * fam.mjs - the fixture's family before the move.
 */

const Thing = foundry.utils.Thing;

const LIMIT = 3;

function announce(text) {
    return \`fam: \${text}\`;
}

export function shout(text) {
    return announce(text);
}

export function grown() {
    return LIMIT;
}

export function leaving() {
    return new Thing();
}

const AFTER = 2;

export function keeps() {
    return AFTER + inner();
}

function inner() {
    return 4;
}

/**
 * Sizes a thing.
 * @param {number} n  the size
 */
export function sized(n) {
    return n;
}

export function other(m) {
    return m;
}

export function changed() {
    return "a";
}

export function lossy() {
    // a line lost on the way
    return 0;
}

function dflt() {
    return 2;
}

export function usesDflt() {
    return dflt() ?? Thing;
}

export function dropped() {
    return 3;
}

export function quoted() {
    return 11;
}

export function keyed() {
    return 5;
}

export function shrinks() {
    return 6;
}

const SPARE = 7;

const LATE = 10;

const QUOTED_TAIL = 12;
`
};
const FIXTURE_HEAD = {
    "scripts/util.mjs": FIXTURE_BASE["scripts/util.mjs"],
    "scripts/tests-tier0.mjs": FIXTURE_BASE["scripts/tests-tier0.mjs"],
    "scripts/tests-kit.mjs": FIXTURE_BASE["scripts/tests-kit.mjs"],
    "scripts/table.mjs": `/**
 * table.mjs - the fixture's bridge table.
 */

export const ACTIONS = {
    go: {
        run: runGo,
    }
};

function runGo() {
    return crawled();
}

function crawled() {
    return 8;
}

const LATE = 10;

export function lastOne() {
    return 9;
}
`,
    "scripts/geo.mjs": `/**
 * geo.mjs - the fixture's second facade.
 */

import { lastReason } from "./geo-parts.mjs";
export { ORDER, commonest, spacing, latticeCheck, north as south, south as north } from "./geo-parts.mjs";

export function paint() {
    lastReason = "painted";
    return lastReason;
}
`,
    "scripts/geo-parts.mjs": `/**
 * geo-parts.mjs - what the second family moved.
 */ globalThis.drpgPlantedHeader = true;

import { announce } from "./util.mjs"; globalThis.drpgPlantedImport = true;
import "./util.mjs";
import "./sheet.mjs";

export let lastReason = "none";

export const ORDER = [
    "second",
    "first",
];

export function commonest(counts) {
    let best = null, most = 0;
    for (const [key, count] of counts) {
            most = count;
        if (count > most) {
            best = key;
        }
    }
    return best;
}

export function spacing(lattice) {
    return 1 / lattice;
}

export function latticeCheck(lattice) {
    if (!(lattice > 0)) return 0;
    return lattice * 2;
}

export function north() {
    return announce("north");
}

export function south() {
    return announce("south");
}
`,
    "scripts/fam.mjs": `/**
 * fam.mjs - the fixture's facade.
 */

import dflt, { inner } from "./fam-new.mjs";
export { shout, leaving, sized, other, changed, lossy, quoted, keyed } from "./fam-new.mjs";

const Thing = foundry.utils.Thing;

const LIMIT = 3;

function announce(text) {
    return \`fam: \${text}\`;
}

export function grown() {
    return LIMIT;
}

const AFTER = 2;

export function keeps() {
    return AFTER + inner();
}

export function usesDflt() {
    return dflt() ?? Thing;
}

export function shrinks() {
    return 6;
}
`,
    "scripts/fam-new.mjs": `/**
 * fam-new.mjs - what the fixture moved.
 */

import { announce, unusedHelper } from "./util.mjs";

const Thing = foundry.utils.Thing;

export function shout(text) {
    return announce(text);
}
\r
export function leaving() {
    return new Thing();
}

export function inner() {
    return 4;
}

export function sized(n) {
    return n;
}

/**
 * Sizes a thing.
 * @param {number} n  the size
 */
export function other(m) {
    return m;
}

export function changed() {
    return "b";
}

export function lossy() {
    return 0;
}

export default function dflt() {
    return 2;
}

export function keyed() {
    return 5;
}

const SPARE = 7;

export function quoted() {
    return 11;
}

const QUOTED_TAIL = 12;

export function dropped() {
    return 3;
}
`
};
// [part, "base" | "head", file, a piece of the line, a piece of the message (where a line carries two)]: the problems
// the parts must report, and no others.
const PLANTED = [
    ["lines", "head", "scripts/fam-new.mjs", `return "b";`],
    ["lines", "base", "scripts/fam.mjs", `return "a";`],
    ["lines", "base", "scripts/fam.mjs", "// a line lost on the way"],
    ["lines", "head", "scripts/fam-new.mjs", "export default function dflt"],
    ["lines", "base", "scripts/fam.mjs", "function dflt() {"],
    ["bindings", "head", "scripts/fam-new.mjs", "export function shout"],
    ["api", "base", "scripts/fam.mjs", "export function dropped"],
    ["cuts", "head", "scripts/fam.mjs", "export function grown"],
    ["jsdoc", "head", "scripts/fam-new.mjs", "export function other"],
    ["imports", "head", "scripts/fam-new.mjs", "import { announce, unusedHelper }"],
    ["imports", "head", "scripts/fam-new.mjs", "\r"],
    // The statements part on the changed line and the default export above, each at both ends.
    ["statements", "head", "scripts/fam-new.mjs", "export function changed"],
    ["statements", "base", "scripts/fam.mjs", "export function changed"],
    ["statements", "head", "scripts/fam-new.mjs", "export default function dflt"],
    ["statements", "base", "scripts/fam.mjs", "function dflt() {"],
    // P1, two lines exchanged in a moved function; P2, a line moved from one function into another; P3, a moved
    // array's two elements exchanged; P4, code after a new file's header; P5, code on an import line.
    ["statements", "head", "scripts/geo-parts.mjs", "export function commonest"],
    ["statements", "base", "scripts/geo.mjs", "export function commonest"],
    ["statements", "head", "scripts/geo-parts.mjs", "export function spacing"],
    ["statements", "base", "scripts/geo.mjs", "export function spacing"],
    ["statements", "head", "scripts/geo-parts.mjs", "export function latticeCheck"],
    ["statements", "base", "scripts/geo.mjs", "export function latticeCheck"],
    ["statements", "head", "scripts/geo-parts.mjs", "export const ORDER"],
    ["statements", "base", "scripts/geo.mjs", "export const ORDER"],
    ["statements", "head", "scripts/geo-parts.mjs", "globalThis.drpgPlantedHeader"],
    ["statements", "head", "scripts/geo-parts.mjs", "globalThis.drpgPlantedImport"],
    // P6, a facade's re-export names exchanged: each name still there, bound to the other's declaration.
    ["api", "head", "scripts/geo.mjs", "north as south", "exports north"],
    ["api", "head", "scripts/geo.mjs", "north as south", "exports south"],
    // P7, a side-effect import of a module the family loaded, and of one it never loaded.
    ["imports", "head", "scripts/geo-parts.mjs", `import "./util.mjs";`],
    ["imports", "head", "scripts/geo-parts.mjs", `import "./sheet.mjs";`, "side effects"],
    ["imports", "head", "scripts/geo-parts.mjs", `import "./sheet.mjs";`, "no file of the family imported"],
    // P8, a write to a `let` that moved to another file.
    ["bindings", "head", "scripts/geo.mjs", "export function paint", "cannot be written"],
    // The cut routes: a cut read as an object key grew, one read by name only shrank, one the bridge crawl cuts grew.
    ["cuts", "head", "scripts/fam-new.mjs", "export function keyed", "as a key"],
    ["cuts", "head", "scripts/fam-new.mjs", "export function quoted", "as a quoted key"],
    ["cuts", "head", "scripts/fam.mjs", "export function shrinks", "read less"],
    ["cuts", "head", "scripts/table.mjs", "function crawled", "bridge crawl"]
];

/** The part `self`: the planted pairs and the kit's cut. Returns its problems; prints what it read. */
export function selfCheck(print = console.log) {
    const problems = [];
    const kit = fs.readFileSync(path.join(REPO, "scripts", "tests-kit.mjs"), "utf8");
    const plain = s => lint.stripComments(s ?? "").replace(/\s+/g, " ").trim();
    if (plain(topLevelFunction(kit, "topLevelFunction")) !== plain(topLevelFunction.toString())) {
        problems.push("scripts/tests-kit.mjs's topLevelFunction is not the one tools/moved-only.mjs cuts with - copy it here again");
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moved-only-"));
    try {
        const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
        Object.assign(env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull, GIT_AUTHOR_NAME: "fixture", GIT_AUTHOR_EMAIL: "fixture@localhost",
            GIT_COMMITTER_NAME: "fixture", GIT_COMMITTER_EMAIL: "fixture@localhost" });
        const git = gitRunner(dir, env);
        const commit = (files, parent) => {
            fs.rmSync(path.join(dir, "scripts"), { recursive: true, force: true });
            fs.mkdirSync(path.join(dir, "scripts"));
            for (const [f, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), t);
            git("add", "-A", "scripts");
            const tree = git("write-tree").trim();
            return git("commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", parent ? "head" : "base").trim();
        };
        git("init", "-q");
        const base = commit(FIXTURE_BASE), head = commit(FIXTURE_HEAD, base);
        const { problems: found } = judge(git, base, head);
        // Matched one to one, so two problems at one line count as two (P6's two names, P7's two rules): the planted
        // ones that name a piece of their message first, so a bare one cannot take the problem they wait for.
        const lineOf = (files, f, piece) => files[f].split("\n").findIndex(l => l.includes(piece)) + 1;
        const want = PLANTED.map(([part, side, f, piece, says]) => ({ part, at: `${f}:${lineOf(side === "base" ? FIXTURE_BASE : FIXTURE_HEAD, f, piece)}`, says }))
            .sort((a, b) => Number(!a.says) - Number(!b.says));
        const got = Object.entries(found).flatMap(([part, lines]) => lines.map(line => ({ part, at: line.match(/^[^:]+:\d+/)[0], line })));
        const missed = [];
        for (const w of want) {
            const g = got.find(x => !x.taken && x.part === w.part && x.at === w.at && (!w.says || x.line.includes(w.says)));
            if (g) g.taken = true; else missed.push(w);
        }
        for (const m of missed) problems.push(`the planted ${m.part} ${m.at}${m.says ? ` ("${m.says}")` : ""} was not reported - the part is broken`);
        for (const e of got.filter(x => !x.taken)) problems.push(`the fixture's ${e.part} ${e.at} was reported and is not planted: ${e.line}`);
        print(`self: ${PLANTED.length} planted problems in a fixture of ${Object.keys(FIXTURE_HEAD).length} files, ${got.length} reported, `
            + `${PLANTED.length - missed.length} of them the planted ones; tests-kit's topLevelFunction ${problems.some(p => p.includes("tests-kit")) ? "differs" : "is the one used"}`);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    return problems;
}

/* ------------------------------ the command ------------------------------ */

function main() {
    const argv = process.argv.slice(2);
    const flags = argv.filter(a => a.startsWith("--")), revs = argv.filter(a => !a.startsWith("--"));
    const unknown = flags.filter(f => f !== "--comments" && f !== "--self");
    if (unknown.length || revs.length > 2 || (!revs.length && !flags.includes("--self")) || (flags.includes("--self") && revs.length)) {
        console.log("usage: node tools/moved-only.mjs <base> [<head>] [--comments] | --self");
        process.exit(2);
    }
    const red = [];
    const say = (part, problems) => {
        for (const p of problems) console.log(`${part}: ${p}`);
        if (problems.length) red.push(part);
    };
    say("self", selfCheck());
    let ran = 1;
    if (revs.length) {
        const git = gitRunner(process.cwd(), process.env);
        let base, head;
        try {
            base = git("rev-parse", "--verify", `${revs[0]}^{commit}`).trim();
            head = git("rev-parse", "--verify", `${revs[1] ?? "HEAD"}^{commit}`).trim();
        } catch (err) {
            console.log(`moved-only: cannot read the revisions (${String(err.stderr || err.message).split("\n")[0]})`);
            process.exit(2);
        }
        console.log(`moved-only: ${base.slice(0, 7)}..${head.slice(0, 7)}${flags.includes("--comments") ? " --comments" : ""}`);
        const { problems, report } = judge(git, base, head, { comments: flags.includes("--comments") });
        for (const line of report) console.log(line);
        for (const [part, lines] of Object.entries(problems)) say(part, lines);
        ran += Object.keys(problems).length;
    }
    console.log(`moved-only: ${ran} part(s), ${red.length ? `red: ${red.join(", ")}` : "all green"}`);
    process.exitCode = red.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) main();
