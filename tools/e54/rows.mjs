/**
 * E54's rebuild (tools/e54/rebuild.sh): code.md's rows for the wave's files, held to the files as they landed.
 * Usage: node tools/e54/rows.mjs [--repo <dir>] - run in a checkout with audit/harness installed (espree).
 *
 * For each family (FAMILIES, the seven cuts' facades and their new files) it reads, with espree, the names a file
 * exports by declaration and the names its facade re-exports from it, and holds them to the counts the file's row in
 * .claude/rules/code.md states ("N names exported, M of them re-exported", "none", "both", "all", "1 re-exported";
 * the sheet's facade "N names of its own, M re-exported"), and the Wave 3 paragraph's module counts to scripts/.
 * A row it cannot read, or a count that differs, is printed and the exit is 1: the rows are prose and the numbers in
 * them are the part a base can move. The prose itself is read by a person.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const argv = process.argv.slice(2);
const at = argv.indexOf("--repo");
const REPO = path.resolve(at >= 0 ? argv[at + 1] : process.cwd());
const espree = createRequire(path.join(REPO, "audit/harness/package.json"))("espree");
const FAMILIES = {
    "sheet.mjs": ["sheet-mode", "sheet-item", "sheet-repaint", "sheet-fit", "sheet-header", "sheet-sidebar", "sheet-inventory", "sheet-actions"],
    "utils.mjs": ["windows"],
    "settings.mjs": ["window-scale"],
    "investigation.mjs": ["key-remnants"],
    "cleanup.mjs": ["cleanup-reshape"],
    "chapter.mjs": ["death", "body"],
    "glass.mjs": ["glass-geometry", "glass-blocks"]
};
const body = f => espree.parse(fs.readFileSync(path.join(REPO, "scripts", f), "utf8"), { ecmaVersion: "latest", sourceType: "module" }).body;
const own = f => body(f).flatMap(n => n.type === "ExportNamedDeclaration" && n.declaration
    ? (n.declaration.declarations ? n.declaration.declarations.map(d => d.id.name) : [n.declaration.id.name]) : []);
const reexported = (facade, from) => body(facade).flatMap(n => n.type === "ExportNamedDeclaration" && n.source?.value === `./${from}`
    ? n.specifiers.map(s => s.exported.name) : []);
const md = fs.readFileSync(path.join(REPO, ".claude/rules/code.md"), "utf8");
const rowOf = f => md.split("\n").find(l => l.startsWith(`| \`scripts/${f}\` |`));
const word = (w, total) => ({ none: 0, both: 2, all: total }[w] ?? Number(w));
const problems = [];
let rows = 0;
for (const [facade, kids] of Object.entries(FAMILIES)) {
    for (const kid of kids) {
        const f = `${kid}.mjs`, row = rowOf(f), names = own(f), re = reexported(facade, f);
        if (!row) { problems.push(`${f}: no row in code.md`); continue; }
        const m = row.match(/(\d+) names? exported, (none|both|all|\d+)(?: of them)? re-exported/);
        if (!m) { problems.push(`${f}: its row states no count in the form this reads`); continue; }
        rows++;
        const [n, r] = [Number(m[1]), word(m[2], Number(m[1]))];
        if (n !== names.length || r !== re.length) problems.push(`${f}: the row says ${n} exported, ${r} re-exported; the files: ${names.length}, ${re.length}`);
    }
}
const sheet = rowOf("sheet.mjs")?.match(/(\d+) names of its own, (\d+) re-exported/);
const sheetRe = FAMILIES["sheet.mjs"].reduce((s, k) => s + reexported("sheet.mjs", `${k}.mjs`).length, 0);
if (!sheet) problems.push("sheet.mjs: its row states no count in the form this reads");
else { rows++; if (Number(sheet[1]) !== own("sheet.mjs").length || Number(sheet[2]) !== sheetRe) problems.push(`sheet.mjs: the row says ${sheet[1]} of its own, ${sheet[2]} re-exported; the file: ${own("sheet.mjs").length}, ${sheetRe}`); }
const wave = md.match(/Wave 3 \(E54[^)]*\)[\s\S]*?(\d+)\s+new\s+files,\s+(\d+)\s+module\s+files\s+in\s+`scripts\/`/);
const modules = fs.readdirSync(path.join(REPO, "scripts")).filter(f => f.endsWith(".mjs")).length;
const fresh = Object.values(FAMILIES).flat().length;
if (!wave) problems.push("the Wave 3 paragraph's counts are not in the form this reads");
else if (Number(wave[1]) !== fresh || Number(wave[2]) !== modules) problems.push(`Wave 3 says ${wave[1]} new files and ${wave[2]} module files; the tree: ${fresh}, ${modules}`);
for (const p of problems) console.log(`rows: ${p}`);
console.log(`rows: ${rows} row(s) read, ${problems.length} problem(s); ${modules} module files in scripts/`);
process.exit(problems.length ? 1 : 0);
