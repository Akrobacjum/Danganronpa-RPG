/**
 * E56 finder (c): exports and constants of the module that nothing reads (E56 C0, 13.11.2026).
 *
 * For every name a module file (scripts/*.mjs, not the suite) exports, every road it can be read by, in every code file
 * of the tree (the module, the suite, tools/, audit/):
 *   - a static import of it (`import { a } from "./x.mjs"`), or a re-export (`export { a } from`), from the file that
 *     declares it or from a facade that re-exports it, `export *` followed;
 *   - a namespace's member: `import * as m from`, `const m = await import(...)`, then `m.a`;
 *   - `import()` destructured (`const { a } = await import(...)`) or read at once (`(await import(...)).a`);
 *   - a use in its own file (an identifier other than its declaration);
 *   - the name as a whole string literal anywhere (a string-keyed table, `bridgeFn("a")`, a harness `eval` string):
 *     the name may be read by a string, so it is `unsure`, never `dead`.
 * An import source is matched by its base name (`./x.mjs`, `../../scripts/x.mjs`, `/scripts/x.mjs`). A source built at
 * run time (a template literal) is not resolved, and every name its file exports is read as `unsure` through the
 * string rule only if a string holds it.
 *
 * The verdict per name, the first that holds: `module` (a module file reads it), `api` (only scripts/api.mjs, the
 * console's `game.drpg`), `test` (only the suite, tools or the harness, its own file perhaps too), `own` (only its own
 * file: the `export` keyword is all that is unused), `unsure` (only a string holds the name; `strings` says whether a
 * module file's string or only a test's or tool's), `dead` (nothing at all). A facade's re-export is no read (`facade`
 * marks a name some facade passes on).
 */

import { readTree, walk, bindings, lineOf } from "./lib.mjs";

const base = s => String(s).split("/").pop();

/** Each module file's own exports, its explicit re-exports and its `export *` sources. */
function exportMaps(tree) {
    const own = new Map(), re = new Map(), stars = new Map();
    for (const f of tree.code.filter(c => c.kind === "module")) {
        const b = base(f.rel), mine = new Map(), reex = new Map(), st = [];
        for (const n of f.ast.body) {
            if (n.type === "ExportNamedDeclaration") {
                if (n.source) { for (const s of n.specifiers) reex.set(s.exported.name ?? s.exported.value, { from: base(n.source.value), name: s.local.name ?? s.local.value }); continue; }
                const d = n.declaration;
                if (d?.id) mine.set(d.id.name, lineOf(f.text, n.range[0]));
                for (const v of d?.declarations ?? []) for (const x of bindings(v.id)) mine.set(x, lineOf(f.text, n.range[0]));
                for (const s of n.specifiers ?? []) mine.set(s.exported.name ?? s.exported.value, lineOf(f.text, n.range[0]));
            } else if (n.type === "ExportAllDeclaration" && n.source) st.push(base(n.source.value));
            else if (n.type === "ExportDefaultDeclaration") mine.set("default", lineOf(f.text, n.range[0]));
        }
        own.set(b, mine); re.set(b, reex); stars.set(b, st);
    }
    return { own, re, stars };
}

/** Where a name read from module `b` is declared: [file, name], following re-exports and `export *`. */
function origin(maps, b, name, seen = new Set()) {
    if (seen.has(`${b}|${name}`)) return null;
    seen.add(`${b}|${name}`);
    if (maps.own.get(b)?.has(name)) return [b, name];
    const r = maps.re.get(b)?.get(name);
    if (r) return origin(maps, r.from, r.name, seen);
    for (const s of maps.stars.get(b) ?? []) { const o = origin(maps, s, name, seen); if (o) return o; }
    return null;
}

export function find(tree) {
    const maps = exportMaps(tree);
    const readers = new Map();                     // "file|name" -> Set of reader kinds/files
    const mark = (b, name, reader) => {
        const o = origin(maps, b, name);
        if (!o) return;
        const k = `${o[0]}|${o[1]}`;
        (readers.get(k) ?? readers.set(k, new Set()).get(k)).add(reader);
    };
    const strings = new Map();                     // name -> Set of "module" | "test" (who holds it as a string)
    const facades = new Set();
    const holdString = (s, kind) => (strings.get(s) ?? strings.set(s, new Set()).get(s)).add(kind === "module" || kind === "api" ? "module" : "test");
    for (const f of tree.code) {
        const kind = f.kind === "module" ? (base(f.rel) === "api.mjs" ? "api" : "module") : "test";
        const nsVars = new Map();                  // local name -> module base
        const importSource = n => (n?.type === "ImportExpression" && n.source.type === "Literal" ? base(n.source.value) : null);
        const unwrap = n => (n?.type === "AwaitExpression" ? n.argument : n);
        walk(f.ast, (n, parent) => {
            if (n.type === "ImportDeclaration") {
                const b = base(n.source.value);
                for (const s of n.specifiers) {
                    if (s.type === "ImportSpecifier") mark(b, s.imported.name ?? s.imported.value, `${kind}:${f.rel}`);
                    else if (s.type === "ImportNamespaceSpecifier") nsVars.set(s.local.name, b);
                    else mark(b, "default", `${kind}:${f.rel}`);
                }
            } else if (n.type === "ExportNamedDeclaration" && n.source) {
                /* A facade's re-export passes a name on; it reads nothing. Whoever imports the name from the facade is
                   followed to the declaring file by `origin`. Recorded, not counted. */
                for (const s of n.specifiers) { const o = origin(maps, base(n.source.value), s.local.name ?? s.local.value); if (o) facades.add(`${o[0]}|${o[1]}`); }
            } else if (n.type === "VariableDeclarator") {
                const b = importSource(unwrap(n.init));
                if (b && n.id.type === "Identifier") nsVars.set(n.id.name, b);
                if (b && n.id.type === "ObjectPattern") for (const p of n.id.properties) if (p.key?.type === "Identifier") mark(b, p.key.name, `${kind}:${f.rel}`);
            } else if (n.type === "MemberExpression" && !n.computed && n.property.type === "Identifier") {
                const obj = n.object.type === "AwaitExpression" ? n.object.argument : n.object;
                const b = importSource(obj);
                if (b) mark(b, n.property.name, `${kind}:${f.rel}`);
            } else if (n.type === "Literal" && typeof n.value === "string" && /^[A-Za-z_$][\w$]*$/.test(n.value)) holdString(n.value, kind);
            else if (n.type === "TemplateElement") for (const m of (n.value.cooked ?? "").matchAll(/[A-Za-z_$][\w$]*/g)) holdString(m[0], kind);
            void parent;
        });
        // A namespace variable's member reads (`m.a`), after every declaration of one is known.
        if (nsVars.size) walk(f.ast, n => {
            if (n.type === "MemberExpression" && !n.computed && n.object.type === "Identifier" && nsVars.has(n.object.name)) mark(nsVars.get(n.object.name), n.property.name, `${kind}:${f.rel}`);
        });
    }
    // Uses in the declaring file itself.
    const ownUse = new Map();
    for (const f of tree.code.filter(c => c.kind === "module")) {
        const b = base(f.rel), mine = maps.own.get(b);
        const count = new Map();
        walk(f.ast, (n, parent) => {
            if (n.type !== "Identifier" || !mine.has(n.name)) return;
            const declaring = (parent?.type === "FunctionDeclaration" || parent?.type === "ClassDeclaration" || parent?.type === "VariableDeclarator") && parent.id === n;
            const key = parent?.type === "Property" && parent.key === n && !parent.shorthand;
            const member = parent?.type === "MemberExpression" && parent.property === n && !parent.computed;
            const spec = /Specifier$/.test(parent?.type ?? "");
            if (!declaring && !key && !member && !spec) count.set(n.name, (count.get(n.name) ?? 0) + 1);
        });
        ownUse.set(b, count);
    }
    const rows = [];
    for (const [b, mine] of maps.own) for (const [name, line] of mine) {
        if (name === "default") continue;
        const r = readers.get(`${b}|${name}`) ?? new Set();
        const kinds = new Set([...r].map(x => x.split(":")[0]));
        const verdict = kinds.has("module") ? "module" : kinds.has("api") ? "api" : kinds.has("test") ? "test" : (ownUse.get(b)?.get(name) ?? 0) > 0 ? "own" : strings.has(name) ? "unsure" : "dead";
        rows.push({ at: `scripts/${b}:${line}`, name, verdict, readers: [...r].map(x => x.split(":")[1]).sort(),
            facade: facades.has(`${b}|${name}`), strings: [...(strings.get(name) ?? [])].sort() });
    }
    const tally = {};
    for (const r of rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
    return { rows, counts: { exports: rows.length, ...tally } };
}

export const NAMED = ["consumeCall", "readiedItem", "vaultRoomOwnedBy", "MAX_EXTRA_ROLES", "openMonocubDialog"];

export const PLANT = {
    "scripts/x.mjs": "export function readStatic() {}\nexport function readDynamic() {}\nexport function readNamespace() {}\nexport function onlyOwn() {}\nexport const deadOne = 1;\nexport const byString = 2;\nexport function testOnly() {}\nonlyOwn();\ntestOnly();\nexport * from \"./y.mjs\";\n",
    "scripts/f.mjs": "export { facadeOnly } from \"./y.mjs\";\n",
    "scripts/y.mjs": "export function viaStar() {}\nexport function deadToo() {}\nexport function facadeOnly() {}\n",
    "scripts/z.mjs": "import { readStatic, viaStar } from \"./x.mjs\";\nconst { readDynamic } = await import(\"./x.mjs\");\nimport * as X from \"./x.mjs\";\nX.readNamespace();\nconst table = { k: \"byString\" };\n",
    "scripts/tests-a.mjs": "import { testOnly } from \"./x.mjs\";\n"
};
export const PLANT_WANTS = { readStatic: "module", readDynamic: "module", readNamespace: "module", viaStar: "module", onlyOwn: "own", deadOne: "dead", deadToo: "dead", byString: "unsure", testOnly: "test", facadeOnly: "dead" };

export function selfCheck(espree) {
    const rows = find(readTree("/fixture", { files: PLANT, espree })).rows;
    const got = Object.fromEntries(rows.map(r => [r.name, r.verdict]));
    const ok = Object.entries(PLANT_WANTS).every(([k, v]) => got[k] === v) && Object.keys(got).length === Object.keys(PLANT_WANTS).length;
    return { ok, got, wanted: PLANT_WANTS };
}
