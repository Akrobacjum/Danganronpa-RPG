/**
 * The E54 split, reproducible (13.11.2026; the E54 plan, docs/dev/E54/PLAN.md on the prep-54 line).
 * ---------------------------------------------------------------------------
 *     node tools/e54/split.mjs [--manifest tools/e54/sheet.json] [--repo <dir>] [--dry]
 *
 * Splits one file of scripts/ by moving whole top-level declarations, as a manifest lists them, into new files of
 * its family, and leaves the old file as the facade code.md "Where the code lives" asks for: it keeps its name and
 * every name it exported (`export { ... } from`), it keeps only the declarations the manifest's `keep` names, and no
 * new file imports it. Written to be run on a later tree than the one it was written on - eight feature lines touch
 * sheet.mjs - so it reads the tree, not line numbers, and refuses (exit 1, nothing written) when the tree is not the
 * one the manifest describes:
 *   - a declaration the manifest lists is not a top-level declaration of the source, or is of another kind (a
 *     function that became a const, an async function that is no longer one);
 *   - the source holds a top-level declaration the manifest lists nowhere (a line added one: where it goes is a
 *     decision, not a guess), or a top-level statement that declares nothing;
 *   - a moved declaration would read a name the facade keeps (a new file may not import its facade), a name of
 *     another new file would be assigned to across files (an import cannot be written to), or a target already exists.
 * With `--dry` it prints what it would write and writes nothing; its exit code says whether it applies.
 *
 * HOW A DECLARATION MOVES. Each top-level statement owns its text from the line after the previous statement ends
 * to the end of its own last line - its leading comments and blank lines, a section's banner with the first
 * declaration under it, and a comment that ends the line it ends on. The moved texts are written in the source's
 * order into each new file, under the manifest's header comment and the imports each needs; a declaration another
 * file reads gets `export ` put in front (moved-only's "promoted"). Which names a declaration reads is eslint-scope's
 * answer (the module scope's references, by where they stand), not a text search, so a local variable that shares a
 * top-level name is not counted. Imports are the source's own, each new file taking the specifiers it reads, in the
 * source's order of modules; the facade keeps the specifiers its kept code still reads, imports what it reads from
 * the new files, and re-exports every name the source exported that moved.
 *
 * THE PROOF IS NOT HERE. `node tools/moved-only.mjs HEAD~1` on the commit this writes is (code.md): every line
 * moved, promoted, an import or a header; every name meaning what it meant; the facade's exports unchanged.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : fallback; };
const REPO = path.resolve(opt("--repo", path.resolve(HERE, "..", "..")));
const MANIFEST = path.resolve(opt("--manifest", path.join(HERE, "sheet.json")));
const DRY = argv.includes("--dry");

const req = createRequire(path.join(path.resolve(HERE, "..", ".."), "audit", "harness", "package.json"));
const espree = req("espree");
const eslintScope = req("eslint-scope");

const problems = [];
const refuse = message => problems.push(message);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const sourcePath = path.join(REPO, manifest.source);
const text = fs.readFileSync(sourcePath, "utf8");
if (/\r/.test(text)) refuse(`${manifest.source} holds a carriage return - the line arithmetic below assumes LF`);
const ast = espree.parse(text, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true, comment: true });

/* ---- the top-level statements and what each declares ---- */
const kindOf = d => d.type === "FunctionDeclaration" ? (d.async ? "async function" : "function")
    : d.type === "VariableDeclaration" ? d.kind : d.type === "ClassDeclaration" ? "class" : null;
const statements = [];
for (const [i, s] of ast.body.entries()) {
    if (s.type === "ImportDeclaration") { statements.push({ i, s, import: true }); continue; }
    const exported = s.type === "ExportNamedDeclaration";
    const d = exported ? s.declaration : s;
    if (!d) { refuse(`line ${s.loc.start.line}: an export list (${text.slice(...s.range).slice(0, 60)}) - not written for`); continue; }
    if (s.type === "ExportDefaultDeclaration" || s.type === "ExportAllDeclaration") { refuse(`line ${s.loc.start.line}: ${s.type} - not written for`); continue; }
    const kind = kindOf(d);
    if (!kind) { refuse(`line ${s.loc.start.line}: a top-level ${d.type} that declares nothing - place it by hand, or list it`); continue; }
    const names = d.type === "VariableDeclaration" ? d.declarations.map(x => x.id.type === "Identifier" ? x.id.name : null) : [d.id.name];
    if (names.some(n => n === null)) { refuse(`line ${s.loc.start.line}: a destructuring declaration - not written for`); continue; }
    statements.push({ i, s, d, kind, names, exported });
}

/* ---- the manifest against the source ---- */
const groupOf = new Map();
const want = new Map();
for (const [name, kind] of Object.entries(manifest.keep)) { groupOf.set(name, "facade"); want.set(name, kind); }
for (const t of manifest.targets) {
    for (const [name, kind] of Object.entries(t.names)) {
        if (groupOf.has(name)) refuse(`the manifest lists ${name} twice`);
        groupOf.set(name, t.file); want.set(name, kind);
    }
    if (fs.existsSync(path.join(REPO, t.file))) refuse(`${t.file} already exists - this cut was made, or another file took the name`);
}
const declared = new Map();
for (const st of statements.filter(x => !x.import)) {
    for (const n of st.names) declared.set(n, st);
    const groups = new Set(st.names.map(n => groupOf.get(n)));
    if (st.names.some(n => !groupOf.has(n))) refuse(`line ${st.s.loc.start.line}: ${st.names.join(", ")} (${st.kind}) is listed nowhere in the manifest - a line added it; decide its file`);
    else if (groups.size > 1) refuse(`line ${st.s.loc.start.line}: ${st.names.join(", ")} are listed in two files - one statement cannot be split`);
    else st.group = [...groups][0];
    for (const n of st.names) if (want.has(n) && want.get(n) !== st.kind) refuse(`${n} is a ${st.kind} in the source, the manifest says ${want.get(n)} - its shape changed`);
}
for (const n of want.keys()) if (!declared.has(n)) refuse(`${n} (${want.get(n)}) is not a top-level declaration of ${manifest.source} any more - it was removed or renamed`);

/* ---- who reads what (eslint-scope, the module scope) ---- */
const scopes = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" });
const moduleScope = scopes.globalScope.childScopes.find(sc => sc.type === "module");
const imported = new Map();   // local name -> { source, imported, kind }
for (const st of statements.filter(x => x.import)) {
    for (const sp of st.s.specifiers) {
        imported.set(sp.local.name, {
            source: st.s.source.value, local: sp.local.name,
            imported: sp.type === "ImportSpecifier" ? (sp.imported.name ?? sp.imported.value) : sp.type === "ImportDefaultSpecifier" ? "default" : "*"
        });
    }
}
const ownerOf = pos => statements.find(st => !st.import && pos >= st.s.range[0] && pos < st.s.range[1]);
const reads = new Map(statements.filter(x => !x.import).map(st => [st, new Set()]));
for (const v of moduleScope.variables) {
    for (const ref of v.references) {
        const st = ownerOf(ref.identifier.range[0]);
        if (!st) continue;
        if (!st.names.includes(v.name)) reads.get(st).add(v.name);
        if (ref.isWrite() && declared.has(v.name) && declared.get(v.name).group !== st.group && !st.names.includes(v.name)) {
            refuse(`${v.name} is written from another file's declaration (line ${ref.identifier.loc.start.line}) - an import cannot be assigned to`);
        }
    }
}

/* ---- each statement's own text ---- */
const lines = text.split("\n");
const lineStarts = [0];
for (const l of lines) lineStarts.push(lineStarts[lineStarts.length - 1] + l.length + 1);
const lineEndAt = pos => { const line = text.slice(0, pos).split("\n").length; return Math.min(text.length, lineStarts[line] ?? text.length); };
const ordered = statements;   // source order
for (const [k, st] of ordered.entries()) {
    const prevEnd = k ? lineEndAt(ordered[k - 1].s.range[1]) : 0;
    st.from = prevEnd;
    st.to = lineEndAt(st.s.range[1]);
    const rest = text.slice(st.s.range[1], st.to);
    if (rest.trim() && !/^\s*(\/\/.*|\/\*.*\*\/\s*)$/.test(rest.replace(/\n$/, ""))) refuse(`line ${st.s.loc.end.line}: code after a statement on its last line - not written for`);
}

/* ---- what each file needs ---- */
const targets = manifest.targets.map(t => ({ ...t, statements: ordered.filter(st => st.group === t.file) }));
const exportNeeded = new Set();
const fileImports = new Map();   // file -> Map(source -> [specifier])
const addImport = (file, source, spec) => {
    if (!fileImports.has(file)) fileImports.set(file, new Map());
    const m = fileImports.get(file);
    if (!m.has(source)) m.set(source, []);
    if (!m.get(source).some(x => x.local === spec.local)) m.get(source).push(spec);
};
const rel = file => `./${path.basename(file)}`;
for (const file of ["facade", ...targets.map(t => t.file)]) {
    const own = ordered.filter(st => st.group === file);
    for (const st of own) {
        for (const name of reads.get(st)) {
            if (imported.has(name)) { if (file !== "facade") addImport(file, imported.get(name).source, imported.get(name)); continue; }
            const at = declared.get(name);
            if (!at || at.group === file) continue;
            if (at.group === "facade") { refuse(`${st.names.join(", ")} (to ${path.basename(file)}) reads ${name}, which the facade keeps - a new file may not import its facade`); continue; }
            exportNeeded.add(name);
            addImport(file, rel(at.group), { source: rel(at.group), imported: name, local: name });
        }
    }
}
const facadeReads = new Set(ordered.filter(st => st.group === "facade").flatMap(st => [...reads.get(st)]));
const reexports = new Map();   // target file -> names the source exported that moved there
for (const st of ordered.filter(x => !x.import && x.group && x.group !== "facade" && x.exported)) {
    if (!reexports.has(st.group)) reexports.set(st.group, []);
    reexports.get(st.group).push(...st.names);
}

/* ---- the texts ---- */
const specText = sp => sp.imported === "default" ? sp.local : sp.imported === "*" ? `* as ${sp.local}` : sp.imported === sp.local ? sp.local : `${sp.imported} as ${sp.local}`;
const importLine = (source, specs) => {
    const ns = specs.filter(sp => sp.imported === "*"), def = specs.filter(sp => sp.imported === "default"), named = specs.filter(sp => !["*", "default"].includes(sp.imported));
    const out = [];
    for (const sp of ns) out.push(`import * as ${sp.local} from "${source}";`);
    const head = [...def.map(sp => sp.local), ...(named.length ? [`{ ${named.map(specText).join(", ")} }`] : [])];
    if (head.length) out.push(`import ${head.join(", ")} from "${source}";`);
    return out;
};
const sourceOrder = [...new Set(ordered.filter(x => x.import).map(x => x.s.source.value))];
const familyOrder = targets.map(t => rel(t.file));
const statementText = st => {
    let t = text.slice(st.from, st.to);
    if (st.group !== "facade" && !st.exported && st.names.some(n => exportNeeded.has(n))) {
        const at = st.s.range[0] - st.from;
        t = `${t.slice(0, at)}export ${t.slice(at)}`;
    }
    return t;
};
const outputs = new Map();
for (const t of targets) {
    if (!t.statements.length) { refuse(`${t.file}: the manifest gives it no declaration the source holds`); continue; }
    const imports = fileImports.get(t.file) ?? new Map();
    const importText = [...sourceOrder, ...familyOrder].filter(src => imports.has(src)).flatMap(src => importLine(src, imports.get(src))).join("\n");
    const header = `/**\n${t.header.map(l => ` * ${l}`.trimEnd()).join("\n")}\n */\n\n`;
    const body = t.statements.map(statementText).join("");
    outputs.set(t.file, `${header}${importText}${importText ? "\n" : ""}${body.startsWith("\n") ? "" : "\n"}${body.replace(/\n*$/, "\n")}`);
}
/* The facade: its header and imports, each import statement holding the specifiers its kept code reads; then the
   family's imports and re-exports; then the kept declarations. */
{
    const firstImport = ordered.find(x => x.import);
    const lastImport = [...ordered].reverse().find(x => x.import);
    let head = text.slice(0, lastImport ? lastImport.to : 0);
    if (manifest.facadeNote?.length) {
        const close = head.indexOf("*/");
        if (!head.startsWith("/**") || close < 0) refuse(`${manifest.source} does not open with a /** header - the facade's note has nowhere to go`);
        else head = `${head.slice(0, close).replace(/\s*$/, "")}\n *\n${manifest.facadeNote.map(l => ` * ${l}`).join("\n")}\n ${head.slice(close)}`;
    }
    // Each import statement of the source, rewritten to what the kept code reads (its comments stay where they were).
    let rebuilt = head;
    for (const st of [...ordered.filter(x => x.import)].reverse()) {
        const kept = st.s.specifiers.filter(sp => facadeReads.has(sp.local.name)).map(sp => imported.get(sp.local.name));
        const original = text.slice(...st.s.range);
        const delta = rebuilt.length - head.length;
        void delta;
        const at = rebuilt.lastIndexOf(original);
        if (at < 0) { refuse(`an import statement could not be found again in the facade's head`); continue; }
        const replacement = kept.length === st.s.specifiers.length ? original : kept.length ? importLine(st.s.source.value, kept).join("\n") : "";
        rebuilt = rebuilt.slice(0, at) + replacement + rebuilt.slice(at + original.length);
    }
    rebuilt = rebuilt.replace(/\n{3,}/g, "\n\n");
    void firstImport;
    const fam = [];
    for (const file of targets.map(t => t.file)) {
        const names = [...new Set([...facadeReads].filter(n => declared.get(n)?.group === file))];
        if (names.length) fam.push(`import { ${names.join(", ")} } from "${rel(file)}";`);
    }
    for (const file of targets.map(t => t.file)) {
        const names = reexports.get(file) ?? [];
        if (names.length) fam.push(`export { ${names.join(", ")} } from "${rel(file)}";`);
    }
    const kept = ordered.filter(st => st.group === "facade").map(statementText).join("");
    outputs.set(manifest.source, `${rebuilt.replace(/\n*$/, "\n")}${fam.join("\n")}\n${kept.startsWith("\n") ? "" : "\n"}${kept.replace(/\n*$/, "\n")}${text.slice(ordered[ordered.length - 1].to).replace(/^\n+/, "")}`);
}

/* ---- report, and write ---- */
const count = file => ordered.filter(st => st.group === file).length;
console.log(`e54-split: ${manifest.source}: ${ordered.filter(x => !x.import).length} declaration(s) read; facade keeps ${count("facade")}; `
    + targets.map(t => `${path.basename(t.file)} ${count(t.file)}`).join(", ") + `; ${exportNeeded.size} promoted to export`);
if (problems.length) {
    for (const p of problems) console.log(`e54-split: REFUSED: ${p}`);
    console.log(`e54-split: ${problems.length} problem(s) - nothing written`);
    process.exit(1);
}
for (const [file, out] of outputs) {
    const lineCount = out.split("\n").length - 1;
    console.log(`e54-split: ${DRY ? "would write" : "wrote"} ${file} (${lineCount} lines)`);
    if (!DRY) fs.writeFileSync(path.join(REPO, file), out);
}
console.log(`e54-split: ${DRY ? "applies; nothing written (--dry)" : "done"}`);
