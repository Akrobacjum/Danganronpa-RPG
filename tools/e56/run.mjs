/**
 * The E56 finders together (E56 C0, 13.11.2026): their self-checks, then their lists for one tree, or how the lists move
 * on the open lines' tips.
 * ---------------------------------------------------------------------------
 *     node tools/e56/run.mjs [--root <dir>] [--json <file>]      every list for <dir> (this checkout by default)
 *     node tools/e56/run.mjs --md <file> [--lines]               the report, as Markdown; with --lines also how each
 *                                                                list moves on every remote line's tip that changes
 *                                                                scripts/ or lang/ (each read in a detached worktree in
 *                                                                the system's temp folder, removed after)
 * Exit 1 when a finder's self-check fails (each plants its own fixture and wants exactly its planted findings): a
 * finder that cannot see a planted fault is not trusted on the tree. Needs `npm ci` in audit/harness (espree).
 * Nothing in the tree read is written; --md and --json write only the file named.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readTree, loadEspree, REPO } from "./lib.mjs";
import * as comments from "./comments.mjs";
import * as lines from "./lines.mjs";
import * as exportsF from "./exports.mjs";
import * as dupes from "./dupes.mjs";
import * as keys from "./keys.mjs";

const FINDERS = { comments, lines, exports: exportsF, dupes, keys };
const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const espree = loadEspree();

function selfChecks() {
    const out = {};
    for (const [name, f] of Object.entries(FINDERS)) out[name] = f.selfCheck(espree);
    return out;
}

/** Every list for the tree at `root`. */
export function measure(root) {
    const tree = readTree(root, { espree });
    return {
        files: tree.code.length, failures: tree.failures,
        comments: comments.find(tree), lines: lines.find(tree), exports: exportsF.find(tree), dupes: dupes.find(tree), keys: keys.find(tree)
    };
}

/** Each list as a set of stable item ids, so two trees can be compared. */
function ids(m) {
    return {
        "(a) unresolved names": new Set(m.comments.findings.map(x => `${x.at.split(":")[0]} ${x.name}`)),
        "(b) wrong line or count": new Set(m.lines.findings.map(x => `${x.at.split(":")[0]} ${x.cite} ${x.name}`)),
        "(c) dead exports": new Set(m.exports.rows.filter(r => r.verdict === "dead").map(r => `${r.at.split(":")[0]} ${r.name}`)),
        "(c) test-only exports": new Set(m.exports.rows.filter(r => r.verdict === "test").map(r => `${r.at.split(":")[0]} ${r.name}`)),
        "(c) own-file-only exports": new Set(m.exports.rows.filter(r => r.verdict === "own").map(r => `${r.at.split(":")[0]} ${r.name}`)),
        "(c) unsure exports": new Set(m.exports.rows.filter(r => r.verdict === "unsure").map(r => `${r.at.split(":")[0]} ${r.name}`)),
        "(d) identical-body groups": new Set(m.dupes.groups.map(g => g.members.map(x => `${x.at.split(":")[0]}#${x.name}`).sort().join("+"))),
        "(e) dead keys": new Set(m.keys.rows.filter(r => r.verdict === "dead").map(r => r.key)),
        "(e) test-only keys": new Set(m.keys.rows.filter(r => r.verdict === "test").map(r => r.key)),
        "(e) unsure keys": new Set(m.keys.rows.filter(r => r.verdict === "unsure").map(r => r.key))
    };
}

/** The remote lines' tips that change scripts/ or lang/ against origin/main. */
function lineTips() {
    const git = (...a) => execFileSync("git", ["-C", REPO, ...a], { encoding: "utf8" }).trim();
    const refs = git("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin").split("\n").filter(r => r && r !== "origin/HEAD" && r !== "origin/main" && r !== "origin");
    const out = [];
    for (const r of refs) {
        let base;
        try { base = git("merge-base", "origin/main", r); } catch { continue; }
        const ahead = Number(git("rev-list", "--count", `origin/main..${r}`));
        if (!ahead) continue;
        const files = git("diff", "--name-only", base, r, "--", "scripts", "lang").split("\n").filter(Boolean);
        if (files.length) out.push({ ref: r, sha: git("rev-parse", "--short", r), ahead, files: files.length });
    }
    return out;
}

function measureRef(ref) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e56-"));
    try {
        execFileSync("git", ["-C", REPO, "worktree", "add", "-q", "--detach", dir, ref], { stdio: "ignore" });
        return measure(dir);
    } finally {
        try { execFileSync("git", ["-C", REPO, "worktree", "remove", "--force", dir], { stdio: "ignore" }); } catch { fs.rmSync(dir, { recursive: true, force: true }); }
    }
}

const esc = s => String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ");

function markdown(main, checks, tips) {
    const L = [];
    const c = main;
    L.push("## Counts on this tree", "", "| List | Count | How it is read |", "| --- | ---: | --- |");
    L.push(`| (a) comment citations of a name nothing declares | ${c.comments.counts.unresolved} (of ${c.comments.counts.judged} judged, ${c.comments.counts.skipped} skipped, ${c.comments.counts.spans} backticked spans) | comments.mjs |`);
    L.push(`| (b) line citations that do not hold | ${c.lines.counts.wrongLines} (of ${c.lines.counts.checkable} checkable; ${c.lines.counts.uncheckable} uncheckable, ${c.lines.counts.outside ?? 0} of them into a file outside this tree) | lines.mjs |`);
    L.push(`| (b) counts that do not hold | ${c.lines.counts.wrongCounts} (of ${c.lines.counts.countsCheckable} checkable; ${c.lines.counts.countClaims} read) | lines.mjs |`);
    for (const v of ["dead", "unsure", "test", "own", "api", "module"]) L.push(`| (c) exports: ${v} | ${c.exports.counts[v] ?? 0} | exports.mjs (of ${c.exports.counts.exports}) |`);
    L.push(`| (d) groups of identical function bodies | ${c.dupes.counts.groups} (${c.dupes.counts.copies} copies, of ${c.dupes.counts.functions} functions) | dupes.mjs |`);
    for (const v of ["dead", "unsure", "test", "module", "foreign"]) L.push(`| (e) lang keys: ${v} | ${c.keys.counts[v] ?? 0} | keys.mjs (of ${c.keys.counts.keys}; ${c.keys.counts.prefixes} built prefixes) |`);
    L.push("", "Self-checks (each finder on its planted fixture, exactly its planted findings wanted): " + Object.entries(checks).map(([k, v]) => `${k} ${v.ok ? "held" : "FAILED"}`).join(", ") + ".");
    if (c.failures.length) L.push("", "Files that did not parse: " + c.failures.join("; "));
    if (tips) {
        L.push("", "## How the lists move on the open lines", "", "Each remote line whose tip is ahead of origin/main and changes scripts/ or lang/, read whole in a detached worktree. +N items the tip adds to a list, -N items it takes off, against origin/main.", "");
        const names = Object.keys(ids(c));
        L.push(`| Line (tip, commits ahead) | ${names.join(" | ")} |`, `| --- | ${names.map(() => "---").join(" | ")} |`);
        const base = ids(c);
        for (const t of tips) {
            if (t.error) { L.push(`| \`${t.ref.replace(/^origin\/claude\//, "")}\` (${t.sha}) | ${names.map(() => "not read").join(" | ")} |`); continue; }
            const mine = ids(t.m);
            const cell = n => { const add = [...mine[n]].filter(x => !base[n].has(x)).length, gone = [...base[n]].filter(x => !mine[n].has(x)).length; return add || gone ? `+${add} -${gone}` : "0"; };
            L.push(`| \`${t.ref.replace(/^origin\/claude\//, "")}\` (${t.sha}, ${t.ahead}) | ${names.map(cell).join(" | ")} |`);
        }
    }
    L.push("", "## (a) Comment citations of a name nothing declares", "", "Grouped by name. Many are Foundry's, Daggerheart's, LiveKit's or a browser's names, which this tree cannot resolve: a reading decides each, this list does not.", "", "| Name | Sites |", "| --- | --- |");
    const byName = {};
    for (const f of c.comments.findings) (byName[f.name] ??= []).push(f.at);
    for (const n of Object.keys(byName).sort((a, b) => byName[b].length - byName[a].length || a.localeCompare(b))) L.push(`| \`${esc(n)}\` | ${byName[n].join(", ")} |`);
    L.push("", "## (b) Line citations and counts that do not hold", "", "| At | Citation | Name | Why |", "| --- | --- | --- | --- |");
    for (const f of c.lines.findings) L.push(`| ${f.at} | \`${esc(f.cite)}\` | \`${esc(f.name)}\` | ${esc(f.why)} |`);
    for (const v of ["dead", "unsure", "test"]) {
        const rows = c.exports.rows.filter(r => r.verdict === v);
        L.push("", `## (c) Exports: ${v} (${rows.length})`, "", v === "unsure" ? "Read by no import; a string literal holds the name (who holds it: module, or test meaning the suite, tools or the harness)." : v === "test" ? "Read only by the suite, tools or the harness." : "Read by nothing: no import of any form, no use in its own file, no string holding the name.", "", "| At | Name | Readers or strings | Facade passes it on |", "| --- | --- | --- | --- |");
        for (const r of rows) L.push(`| ${r.at} | \`${r.name}\` | ${esc(v === "unsure" ? r.strings.join(", ") : r.readers.join(", "))} | ${r.facade ? "yes" : ""} |`);
    }
    L.push("", `## (c) Exports used only in their own file (${c.exports.counts.own ?? 0})`, "", "The `export` keyword is all that is unused. Listed by file.", "");
    const own = {};
    for (const r of c.exports.rows.filter(x => x.verdict === "own")) (own[r.at.split(":")[0]] ??= []).push(r.name);
    for (const f of Object.keys(own).sort()) L.push(`- ${f}: ${own[f].map(n => `\`${n}\``).join(", ")}`);
    L.push("", "## (d) Identical function bodies", "", "| Copies | Body length | Where (name@file:line) |", "| ---: | ---: | --- |");
    for (const g of c.dupes.groups) L.push(`| ${g.size} | ${g.chars} | ${g.members.map(m => `\`${m.name}\`@${m.at}`).join(", ")} |`);
    L.push("", "## (d) The plan's named helpers: declarations and call sites", "", "| Helper | Declarations (file:line, body length, identical to N others) | Call sites (file: calls; own copy or imported) |", "| --- | --- | --- |");
    for (const [n, x] of Object.entries(c.dupes.named)) L.push(`| \`${n}\` | ${x.declarations.map(d => `${d.at} (${d.chars}c, =${d.same})`).join(", ") || "none"} | ${x.sites.map(s => `${s.rel.replace("scripts/", "")}: ${s.calls} (${s.own ? "own" : "imported"})`).join(", ") || "none"} |`);
    for (const v of ["dead", "test"]) {
        const rows = c.keys.rows.filter(r => r.verdict === v);
        L.push("", `## (e) Lang keys: ${v} (${rows.length})`, "", v === "dead" ? "No string of any code file holds the key or its plural family, and no builder's prefix covers it." : "Held only by a string of the suite, tools or the harness.", "");
        L.push(rows.map(r => `\`${r.key}\``).join(", ") || "none");
    }
    const unsure = c.keys.rows.filter(r => r.verdict === "unsure");
    const byWhy = {};
    for (const r of unsure) (byWhy[r.why] ??= []).push(r.key);
    L.push("", `## (e) Lang keys: unsure (${unsure.length}), by the builder that may make them`, "", "Never called dead: only a reading of the builder settles each.", "", "| Builder | Keys |", "| --- | ---: |");
    for (const w of Object.keys(byWhy).sort((a, b) => byWhy[b].length - byWhy[a].length)) L.push(`| ${esc(w)} | ${byWhy[w].length} |`);
    return L.join("\n") + "\n";
}

const checks = selfChecks();
const failed = Object.entries(checks).filter(([, v]) => !v.ok);
for (const [k, v] of failed) console.log(`e56: the ${k} finder's self-check failed: got ${JSON.stringify(v.got)}, wanted ${JSON.stringify(v.wanted)}`);
if (failed.length) process.exit(1);
const root = path.resolve(opt("--root") ?? REPO);
const main = measure(root);
console.log(`e56: ${main.files} code files read; (a) ${main.comments.counts.unresolved}, (b) ${main.lines.counts.wrongLines}+${main.lines.counts.wrongCounts}, (c) dead ${main.exports.counts.dead ?? 0} unsure ${main.exports.counts.unsure ?? 0} test ${main.exports.counts.test ?? 0} own ${main.exports.counts.own ?? 0}, (d) ${main.dupes.counts.groups} groups, (e) dead ${main.keys.counts.dead ?? 0} unsure ${main.keys.counts.unsure ?? 0}; self-checks held`);
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(main, (k, v) => (k === "ast" || k === "text" ? undefined : v)));
let tips = null;
if (argv.includes("--lines")) {
    tips = [];
    for (const t of lineTips()) {
        try { tips.push({ ...t, m: measureRef(t.ref) }); console.log(`e56: read ${t.ref} (${t.sha})`); }
        catch (err) { tips.push({ ...t, error: String(err.message).split("\n")[0] }); console.log(`e56: ${t.ref} not read (${String(err.message).split("\n")[0]})`); }
    }
}
if (opt("--md")) fs.writeFileSync(opt("--md"), markdown(main, checks, tips));
