/**
 * The comment sweep's tables, built from a base (13.11.2026; docs/dev/E54/COMMENT-SWEEP.md).
 * ---------------------------------------------------------------------------
 *     node tools/e54/sweep-build.mjs --base <dir> [--out <dir>] [--doc <file.md>] [--work <dir>]
 *
 * Reads the tree at `--base` (a checkout of the commit E54 runs on, not yet cut), makes each cut's tree from it in a
 * work directory (tools/e54/split.mjs, then repoint.mjs, each with the cut's manifest), and writes the sweep's table of
 * each cut, sweep-<cut>.json, into `--out` (default: tools/e54 of this checkout), for tools/e54/sweep.mjs to apply.
 * With `--doc` it also writes the inventory, COMMENT-SWEEP.md's sections 1 to 3, from the same reading.
 *
 * WHAT IT READS. Every comment of scripts/, styles/, tools/ and audit/ (tools/e54 and the copied Daggerheart files
 * aside), line by line: a cut's file named, with the function after it in backticks (`sheet.mjs \`foo\``), or alone;
 * and in a cut's source the location words ("here and not in", "lives here", "reads it here", "this file", "this
 * module", "below", "above" ...), each with the declaration that owns the line (split.mjs's rule: a statement owns its
 * text from the line after the one before it) and that declaration's file after the cut. Then the suite's own words:
 * the string tokens of the tier files that are a test's name or an argument of `ok`, `equal`, `must` or `needs`.
 *
 * HOW IT JUDGES (the inventory's "How each was judged").
 *   - A name after a file is false when the name moves (to its holder, or "this file's" where the holder is the
 *     comment's own new file), true when it stays, unchanged when it is no top-level declaration of the file at the
 *     base; "<file> exports ...", and in a test "has no", "no `x`", "exports no", "gives a test no road", true (the
 *     facade re-exports every name). Only the run of names right after the file counts (", ", " and ", " or ").
 *   - A file named alone is true unless the same run names moved code.
 *   - "this module", and "below"/"above" with nothing named, are true; every other location word is the hand's, in
 *     sweep-verdicts.json, found by the file and the start of the line - a location word in moved code with no
 *     verdict there is listed as unread, and no row is written for it.
 * Each false line becomes a row: the changed fragment of the line, widened word by word until it stands once in the
 * file the line lands in after the cut, its new text, and the whole line as it stood at the base (`line`) - so a line
 * another commit edited elsewhere still matches by its fragment, and a fragment another commit repeated by its line.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SELF = path.resolve(HERE, "..", "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : fallback; };
const BASE = path.resolve(opt("--base", SELF));
const OUT = path.resolve(opt("--out", HERE));
const DOC = opt("--doc", null);
const DUMP = opt("--dump", null);   // the reading itself, as JSON, for a comparison of two bases
const WORK = path.resolve(opt("--work", fs.mkdtempSync(path.join(os.tmpdir(), "e54-sweep-"))));
const req = createRequire(path.join(SELF, "audit", "harness", "package.json"));
const espree = req("espree");
const say = m => console.log(`e54-sweep-build: ${m}`);

const CUTS = ["sheet", "windows", "key-remnants", "cleanup-reshape", "chapter", "glass", "windows-settings"];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parse = t => espree.parse(t, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true, comment: true, tokens: true });
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");

/* ---- the cuts: their manifests, holders, and trees made from the base ---- */
const cuts = CUTS.map(cut => {
    const m = JSON.parse(fs.readFileSync(path.join(HERE, `${cut}.json`), "utf8"));
    const source = path.basename(m.source);
    const holder = new Map(m.targets.flatMap(t => Object.keys(t.names).map(n => [n, path.basename(t.file)])));
    return { cut, source, holder, manifest: path.join(HERE, `${cut}.json`), tree: path.join(WORK, cut) };
});
const bySource = new Map(cuts.map(c => [c.source, c]));
const copyTree = (from, to) => fs.cpSync(from, to, { recursive: true, filter: src => !/[\\/](?:\.git|node_modules)(?:[\\/]|$)/.test(src) });
for (const c of cuts) {
    fs.rmSync(c.tree, { recursive: true, force: true });
    copyTree(BASE, c.tree);
    for (const step of ["split", "repoint"]) {
        try { execFileSync("node", [path.join(HERE, `${step}.mjs`), "--manifest", c.manifest, "--repo", c.tree], { stdio: "pipe" }); }
        catch (err) { say(`REFUSED: the ${c.cut} cut does not apply on the base (${step}.mjs): ${String(err.stdout ?? "").split("\n").filter(l => /REFUSED/.test(l)).slice(0, 3).join(" | ")}`); process.exit(1); }
    }
}
/* A file's top-level declarations, read off its syntax tree: glass.mjs indents its cut two spaces (E54 G5), which a
   column-0 pattern did not read, so a comment naming "glass.mjs `stackShapes`" read as naming nothing. */
const declOf = text => new Set(parse(text).body.flatMap(st => {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d?.type === "VariableDeclaration") return d.declarations.filter(x => x.id.type === "Identifier").map(x => x.id.name);
    return d?.type === "FunctionDeclaration" || d?.type === "ClassDeclaration" ? [d.id.name] : [];
}));
const DECL = Object.fromEntries(cuts.map(c => [c.source, declOf(read(BASE, `scripts/${c.source}`))]));
const VERDICTS = JSON.parse(fs.readFileSync(path.join(HERE, "sweep-verdicts.json"), "utf8")).verdicts;
const verdictFor = (rel, text) => VERDICTS.find(v => v.file === rel && text.trim().startsWith(v.line.slice(0, 60)));

/* ---- the run of backticked names right after a mention ---- */
function runAfter(text) {
    const names = [];
    for (let k = 0, m; (m = text.slice(k).match(/^(?:'s)?(\s*(?:,\s*|\s+and\s+|\s+or\s+)?)`([\w$]+)[^`]*`/)); k += m[0].length) names.push(m[2]);
    return names;
}
/** The line with each mention of `file` naming moved code given each name's holder, prefixed where the holder changes. */
function rewriteLine(line, file, own) {
    const H = bySource.get(file).holder;
    const re = new RegExp(`(?<![\\w-])${esc(file)}('s)?((?:\\s*(?:,\\s*|\\s+and\\s+|\\s+or\\s+)?\`[\\w$]+[^\`]*\`)+)`, "g");
    return line.replace(re, (all, s, runText) => {
        const parts = [...runText.matchAll(/(\s*(?:,\s*|\s+and\s+|\s+or\s+)?)(`([\w$]+)[^`]*`)/g)];
        const holders = parts.map(p => H.get(p[3]) ?? file);
        if (holders.every(h => h === file)) return all;
        let prev = null, out = "";
        parts.forEach((p, i) => {
            const h = holders[i];
            const name = h === own ? "this file" : h;
            out += p[1] + (h !== prev ? `${name}${prev === null ? (h === own ? "'s" : (s ?? "")) : ""} ` : "") + p[2];
            prev = h;
        });
        return out.replace(/^\s*/, "");
    });
}

/* ---- every comment line that names where its code stands ---- */
const FILE = /(?<![\w./-])((?:scripts\/)?([\w-]+\.mjs))(?::(\d+(?:[-,\s]+\d+)*))?/g;
const HERE_WORDS = /\bhere and not in\b|\bnot here\b|\b(?:kept|lives?|living|stays?|stands?|sits?|moved|belongs?|is|are|declared|defined|written) here\b|\breads? (?:it|them|this) here\b|\b(?:in|of|to|from) this file\b|\bthis file(?:'s)?\b|\bthis module\b|\bthe file's (?:end|top|head)\b|\bfurther (?:down|up)\b|\b(?:just )?(?:below|above)\b/i;
const files = [];
const walk = dir => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!/node_modules|dh-dice|\.git$/.test(p)) walk(p); }
    else if (/\.(mjs|js|css)$/.test(f.name)) files.push(path.relative(BASE, p));
} };
for (const d of ["scripts", "styles", "tools", "audit"]) if (fs.existsSync(path.join(BASE, d))) walk(path.join(BASE, d));
const ownerChunks = (ast) => {
    const own = [];
    let prevEnd = 0;
    for (const s of ast.body) {
        const d = s.type === "ExportNamedDeclaration" ? s.declaration : s;
        const names = d?.type === "VariableDeclaration" ? d.declarations.map(x => x.id.name) : d?.id ? [d.id.name] : [];
        for (let l = prevEnd + 1; l <= s.loc.end.line; l++) own[l] = { names, import: s.type === "ImportDeclaration" };
        prevEnd = s.loc.end.line;
    }
    return own;
};
const rows = [];   // { rel, line, text, lands, cls, verdict, why, cut, files }
const unread = [];
for (const rel of files) {
    if (/^audit\/harness\/lib\/dh-relay|^tools\/e54\//.test(rel)) continue;
    const text = read(BASE, rel);
    let comments, owners = null;
    if (rel.endsWith(".css")) comments = [...text.matchAll(/\/\*[\s\S]*?\*\//g)].map(m => ({ value: m[0], start: text.slice(0, m.index).split("\n").length }));
    else {
        let ast; try { ast = parse(text); } catch { continue; }
        comments = ast.comments.map(c => ({ value: c.value, start: c.loc.start.line }));
        if (rel.startsWith("scripts/") && bySource.has(path.basename(rel))) owners = ownerChunks(ast);
    }
    const cutHere = rel.startsWith("scripts/") ? bySource.get(path.basename(rel)) : null;
    const L = text.split("\n");
    for (const c of comments) {
        c.value.split("\n").forEach((ln, k) => {
            const line = c.start + k;
            const full = L[line - 1];
            let dest = null;
            if (cutHere && owners) { const o = owners[line]; dest = o && !o.import && o.names.length ? (cutHere.holder.get(o.names[0]) ?? cutHere.source) : cutHere.source; }
            const moved = Boolean(cutHere && dest !== cutHere.source);
            const lands = moved ? `scripts/${dest}` : rel;
            const mentions = [...ln.matchAll(FILE)].filter(m => bySource.has(m[2]));
            const hereWord = moved ? ln.match(HERE_WORDS)?.[0] : null;
            if (!mentions.length && !hereWord) return;
            const v = verdictFor(rel, full);
            if (v) { rows.push({ rel, line, text: full, lands, cls: "hand", verdict: v.verdict, why: v.why, from: v.from, to: v.to, cut: cutHere?.cut ?? bySource.get(mentions[0]?.[2])?.cut }); return; }
            if (hereWord && !mentions.length) {
                if (/this module|below|above/i.test(hereWord)) rows.push({ rel, line, text: full, lands, cls: "here", verdict: "true", why: /this module/i.test(hereWord) ? "the module, not the file" : `inside one declaration, which moves whole; still so in ${dest}` });
                else unread.push(`${rel}:${line} "${hereWord}" (lands in ${lands}): no verdict in sweep-verdicts.json`);
                return;
            }
            for (const m of mentions) {
                const file = m[2], H = bySource.get(file).holder;
                const after = ln.slice(m.index + m[0].length);
                if (m[3]) { rows.push({ rel, line, text: full, lands, cls: "line", verdict: "false", why: `a line of ${file} - read it again after the cut`, cut: bySource.get(file).cut, file, unwritten: true }); continue; }
                const names = runAfter(after);
                const kind = names.length && /^(?:'s)?\s*`/.test(after) ? "named" : "file";
                if (/^(?:'s)?\s*(?:exports?|re-exports?)\b/.test(after)) { rows.push({ rel, line, text: full, lands, cls: kind, verdict: "true", why: `what ${file} exports, which its facade re-exports` }); continue; }
                const movedNames = names.filter(n => H.get(n));
                // a file alone: false where the sentence names moved code of it before the next file (its holder named)
                const later = kind === "file" ? [...after.split(/[\w-]+\.mjs/)[0].matchAll(/`([\w$]+)/g)].map(x => x[1]).filter(n => H.get(n)) : [];
                const bareTo = [...new Set(later.map(n => H.get(n)))];
                if (movedNames.length) rows.push({ rel, line, text: full, lands, cls: kind, verdict: "false", why: movedNames.map(n => `\`${n}\` goes to ${H.get(n)}`).join("; "), cut: bySource.get(file).cut, file });
                else if (later.length && bareTo.length === 1) rows.push({ rel, line, text: full, lands, cls: "file", verdict: "false", why: `names ${later.map(n => `\`${n}\``).join(", ")}, which ${later.length > 1 ? "go" : "goes"} to ${bareTo[0]}`, cut: bySource.get(file).cut, file, bare: bareTo[0] });
                else if (later.length) rows.push({ rel, line, text: full, lands, cls: "file", verdict: "false", why: `names code of ${file} that goes to ${bareTo.join(", ")}: one file cannot be named for it - write its verdict by hand`, cut: bySource.get(file).cut, file, unwritten: true });
                else if (kind === "named" && !names.some(n => DECL[file].has(n))) rows.push({ rel, line, text: full, lands, cls: kind, verdict: "base", why: `${names.map(n => `\`${n}\``).join(", ")}: no top-level declaration of ${file} at the base (gone before, an import, a field or a local)` });
                else rows.push({ rel, line, text: full, lands, cls: kind, verdict: "true", why: names.length ? `${names.map(n => `\`${n}\``).join(", ")} ${names.length > 1 ? "stay" : "stays"} in ${file}` : "the file, which stays as the family's facade" });
            }
        });
    }
}

/* ---- the suite's own words ---- */
const tests = [];
for (const f of ["tests-tier0.mjs", "tests-tier1.mjs", "tests-tier2.mjs"]) {
    const rel = `scripts/${f}`;
    if (!fs.existsSync(path.join(BASE, rel))) continue;
    const text = read(BASE, rel);
    const ast = parse(text);
    const tokens = ast.tokens;
    const L = text.split("\n");
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type !== "String" && t.type !== "Template") continue;
        if (![...bySource.keys()].some(s => new RegExp(`(?<![\\w-])${esc(s)}`).test(t.value))) continue;
        const lineStart = text.lastIndexOf("\n", t.range[0]) + 1;
        const isName = /^ {4}\[$/.test(text.slice(lineStart, t.range[0]));
        let callee = null;
        for (let k = i - 1, depth = 0; k >= 0 && i - k < 400; k--) {
            const v = tokens[k].value;
            if (v === ")" || v === "]" || v === "}") depth++;
            else if (v === "(" || v === "[" || v === "{") { if (depth === 0) { if (v === "(" && tokens[k - 1]?.type === "Identifier") callee = tokens[k - 1].value; break; } depth--; }
        }
        if (!isName && !["ok", "equal", "must", "needs"].includes(callee)) continue;
        for (const m of t.value.matchAll(new RegExp(`(?<![\\w-])(${[...bySource.keys()].map(esc).join("|")})`, "g"))) {
            const file = m[1], H = bySource.get(file).holder;
            const after = t.value.slice(m.index + file.length);
            const viaFacade = /^(?:'s)?\s*(?:exports|has no\b|no `|gives (?:a test )?no road|no longer exports)/.test(after);
            const names = runAfter(after);
            const moved = viaFacade ? [] : names.filter(n => H.get(n));
            tests.push({ rel, line: t.loc.start.line, text: L[t.loc.start.line - 1], kind: isName ? "name" : `${callee}()`, file, cut: bySource.get(file).cut,
                verdict: moved.length ? "false" : (names.length && !names.some(n => DECL[file].has(n)) ? "base" : "true"), moved });
        }
    }
}

/* ---- the rows: the changed fragment, unique in the landing file of the cut's tree ---- */
const tables = Object.fromEntries(CUTS.map(c => [c, []]));
const problems = [...unread];
const lines = new Map();   // cut|rel|line -> plan
for (const r of rows.filter(r => r.verdict === "false" && !r.unwritten)) {
    const k = `${r.cut}|${r.rel}|${r.line}`;
    if (!lines.has(k)) lines.set(k, { cut: r.cut, rel: r.rel, line: r.line, text: r.text, lands: r.lands, files: new Set(), hand: [], why: [], test: false });
    const p = lines.get(k);
    if (r.cls === "hand") p.hand.push([r.from, r.to]);
    else if (r.bare) p.bare = [...(p.bare ?? []), [r.file, r.bare]];
    else p.files.add(r.file);
    p.why.push(r.why);
}
for (const r of rows.filter(r => r.unwritten)) problems.push(`${r.rel}:${r.line}: ${r.why}`);
for (const t of tests.filter(t => t.verdict === "false")) {
    const k = `${t.cut}|${t.rel}|${t.line}`;
    if (!lines.has(k)) lines.set(k, { cut: t.cut, rel: t.rel, line: t.line, text: t.text, lands: t.rel, files: new Set(), hand: [], why: [], test: true });
    lines.get(k).files.add(t.file);
    lines.get(k).why.push(t.moved.map(n => `${n} -> ${bySource.get(t.file).holder.get(n)}`).join(", "));
}
for (const p of lines.values()) {
    let neu = p.text;
    for (const [from, to] of p.hand) { if (!neu.includes(from)) problems.push(`${p.rel}:${p.line}: the hand's text is not on the line: ${from}`); neu = neu.replace(from, to); }
    for (const file of p.files) neu = rewriteLine(neu, file, path.basename(p.lands));
    for (const [file, to] of p.bare ?? []) neu = neu.replace(new RegExp(`(?<![\\w-])${esc(file)}`), to);
    if (neu === p.text) { problems.push(`${p.rel}:${p.line}: no rewrite came out (${p.why.join("; ")})`); continue; }
    /* The row is the cut's whose file the line names; the file it lands in is the cut's that moves the line. They differ
       when a line one cut moves names another cut's file (settings.mjs's scaling, moved by W3, names sheet.mjs, E54):
       read the landing file in the tree that has it - the named cut's when it does, else the cut that writes it. */
    const named = cuts.find(c => c.cut === p.cut);
    const cutTree = fs.existsSync(path.join(named.tree, p.lands)) ? named.tree
        : cuts.find(c => [...c.holder.values()].some(f => `scripts/${f}` === p.lands))?.tree ?? named.tree;
    const there = read(cutTree, p.lands);
    if (!there.includes(p.text)) { problems.push(`${p.rel}:${p.line}: the line is not in ${p.lands} of the ${p.cut} cut's tree`); continue; }
    // the changed fragment: the common head and tail taken off, then widened to whole words until it stands once
    let a = 0; while (a < p.text.length && p.text[a] === neu[a]) a++;
    let b = 0; while (b < p.text.length - a && p.text[p.text.length - 1 - b] === neu[neu.length - 1 - b]) b++;
    let from = a, to = p.text.length - b;
    const grow = () => {
        const before = from, after = to;
        while (from > 0 && !/\s/.test(p.text[from - 1])) from--;
        if (from === before && from > 0) { from--; while (from > 0 && !/\s/.test(p.text[from - 1])) from--; }
        while (to < p.text.length && !/\s/.test(p.text[to])) to++;
        if (to === after && to < p.text.length) { to++; while (to < p.text.length && !/\s/.test(p.text[to])) to++; }
        return from !== before || to !== after;
    };
    grow();
    while (there.split(p.text.slice(from, to)).length - 1 > 1 && grow());
    const oldText = p.text.slice(from, to);
    if (there.split(oldText).length - 1 !== 1) { problems.push(`${p.rel}:${p.line}: no fragment of the line stands once in ${p.lands}`); continue; }
    const newText = neu.slice(from, neu.length - (p.text.length - to));
    tables[p.cut].push({ base: `${p.rel}:${p.line}`, file: p.lands, old: oldText, new: newText, line: p.text, why: [...new Set(p.why)].join("; "), ...(p.test ? { test: true } : {}) });
}
const baseHead = (() => { try { return execFileSync("git", ["-C", BASE, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "a tree with no git"; } })();
for (const [cut, list] of Object.entries(tables)) {
    list.sort((x, y) => x.base.localeCompare(y.base, "en", { numeric: true }));
    fs.writeFileSync(path.join(OUT, `sweep-${cut}.json`), JSON.stringify({
        about: `The comment sweep's rows for the ${cut} cut (docs/dev/E54/COMMENT-SWEEP.md), built by tools/e54/sweep-build.mjs from ${baseHead} and applied by tools/e54/sweep.mjs after split.mjs and repoint.mjs. Each row: the line at the base (base), the file it stands in after the cut (file), the changed fragment of it there (old), what the fragment reads instead (new), and the whole line at the base (line): sweep.mjs applies a fragment that stands once in the file, or else the one that stands in a line equal to \`line\`, and refuses the row otherwise.`,
        rows: list
    }, null, 2) + "\n");
}
const lineCount = new Set(rows.map(r => `${r.rel}:${r.line}`)).size, falseLines = new Set(rows.filter(r => r.verdict === "false").map(r => `${r.rel}:${r.line}`)).size;
say(`base ${baseHead}: ${lineCount} comment line(s) read, ${falseLines} false; ${tests.length} test text(s), ${tests.filter(t => t.verdict === "false").length} false; rows ${CUTS.map(c => `${c} ${tables[c].length}`).join(", ")}`);
for (const p of problems) say(`PROBLEM ${p}`);
if (DOC) fs.writeFileSync(DOC, inventory());
if (DUMP) fs.writeFileSync(DUMP, JSON.stringify({ rows, tests }));
fs.rmSync(WORK, { recursive: true, force: true });
process.exitCode = problems.length ? 1 : 0;

function inventory() {
    const cell = s => { const t = String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim(); return (t.match(/`/g) ?? []).length % 2 ? t.replace(/`/g, "'") : t; };
    const out = [`## 1. Comments that become false (${falseLines})`, "", "| file:line (the base) | Lands in | Why it becomes false |", "| --- | --- | --- |"];
    for (const r of rows.filter(r => r.verdict === "false").sort((x, y) => x.rel.localeCompare(y.rel) || x.line - y.line)) out.push(`| ${r.rel}:${r.line} | ${r.lands} | ${cell(r.why)} |`);
    out.push("", `## 2. Test texts that become false (${tests.filter(t => t.verdict === "false").length})`, "", "| file:line (the base) | Where | Names | Becomes |", "| --- | --- | --- | --- |");
    for (const t of tests.filter(t => t.verdict === "false")) out.push(`| ${t.rel}:${t.line} | ${t.kind} | ${t.file} | ${cell(t.moved.map(n => `${n} -> ${bySource.get(t.file).holder.get(n)}`).join(", "))} |`);
    out.push("", "## 3. Comments that stay true, and those the cuts do not change", "", "| file:line (the base) | Lands in | Verdict | Why |", "| --- | --- | --- | --- |");
    for (const r of rows.filter(r => r.verdict !== "false").sort((x, y) => x.rel.localeCompare(y.rel) || x.line - y.line)) out.push(`| ${r.rel}:${r.line} | ${r.lands} | ${r.verdict === "base" ? "unchanged" : "true"} | ${cell(r.why)} |`);
    out.push("", "The tables' rows, with each fragment's old and new text: tools/e54/sweep-<cut>.json.", "");
    return out.join("\n");
}
