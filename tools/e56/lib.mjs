/**
 * The E56 finders' shared reading of a tree (E56 C0, 13.11.2026): every JavaScript file the repository reads, parsed
 * once with espree (audit/harness's, as tools/check.mjs `names` loads it), with its comments; the language files; the
 * stylesheets. Read only: nothing here writes into the tree it reads.
 *
 * What is read, from `root` (a checkout, a worktree of a line's tip, or a planted fixture):
 *   - code: scripts/*.mjs (the module and the suite: `kind` "module" or "test"), tools/ (*.mjs), audit/ (*.mjs and
 *     *.js, the harness's node_modules and its copied Daggerheart relay and dice left out: never edited, not ours);
 *     tools/e56/ left out too: these finders name what they look for, and would read as its readers;
 *   - lang/en.json and lang/pl.json; styles/*.css; module.json.
 * A file that does not parse is listed in `failures` and read as no code, never silently dropped.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "..", "..");

/** espree from audit/harness of this repository (the tree read may be another and have no node_modules). */
export function loadEspree() {
    return createRequire(path.join(REPO, "audit", "harness", "package.json"))("espree");
}

const SKIP_DIR = /(^|\/)(node_modules|results|\.git)(\/|$)/;
const COPIED = /^audit\/harness\/lib\/(dh-relay\.mjs|dh-dice\/)|^tools\/e56\//;   // tools/e56: these finders, whose lists name what they look for

function walkFiles(root, rel, test, out = []) {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (SKIP_DIR.test(r) || COPIED.test(r)) continue;
        if (e.isDirectory()) walkFiles(root, r, test, out);
        else if (test(r)) out.push(r);
    }
    return out;
}

/** Every node of an AST, depth first, with its parent. */
export function walk(node, visit, parent = null) {
    if (!node || typeof node.type !== "string") return;
    visit(node, parent);
    for (const key of Object.keys(node)) {
        if (key === "parent") continue;
        const v = node[key];
        if (Array.isArray(v)) for (const c of v) { if (c && typeof c.type === "string") walk(c, visit, node); }
        else if (v && typeof v.type === "string") walk(v, visit, node);
    }
}

/** The names a binding pattern declares. */
export function bindings(p, into = []) {
    if (!p) return into;
    if (p.type === "Identifier") into.push(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach(q => bindings(q.value ?? q.argument, into));
    else if (p.type === "ArrayPattern") p.elements.forEach(e => bindings(e, into));
    else if (p.type === "RestElement") bindings(p.argument, into);
    else if (p.type === "AssignmentPattern") bindings(p.left, into);
    return into;
}

/**
 * The tree at `root`. `files` overrides the file list with `{ rel: text }` (the planted fixtures); otherwise the disk.
 * Each code file: { rel, kind, text, ast, comments }. `kind`: "module" (scripts/, not tests), "test" (scripts/tests*),
 * "tool" (tools/), "harness" (audit/).
 */
export function readTree(root, { files = null, espree = loadEspree() } = {}) {
    const get = rel => (files ? files[rel] ?? null : (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : null));
    const list = files ? Object.keys(files) : [
        ...walkFiles(root, "scripts", r => /\.mjs$/.test(r)),
        ...walkFiles(root, "tools", r => /\.mjs$/.test(r)),
        ...walkFiles(root, "audit", r => /\.(mjs|js)$/.test(r))
    ];
    const kindOf = rel => (/^scripts\/tests[\w-]*\.mjs$/.test(rel) ? "test" : rel.startsWith("scripts/") ? "module" : rel.startsWith("tools/") ? "tool" : "harness");
    const code = [], failures = [];
    for (const rel of list.filter(r => /\.(mjs|js)$/.test(r)).sort()) {
        const text = get(rel);
        if (text === null) continue;
        let ast;
        try {
            ast = espree.parse(text, { ecmaVersion: "latest", sourceType: "module", loc: true, range: true, comment: true });
        } catch {
            try { ast = espree.parse(text, { ecmaVersion: "latest", sourceType: "script", loc: true, range: true, comment: true }); }
            catch (err) { failures.push(`${rel}: does not parse (${err.message})`); continue; }
        }
        code.push({ rel, kind: kindOf(rel), text, ast, comments: ast.comments ?? [] });
    }
    const json = rel => { const t = get(rel); try { return t === null ? null : JSON.parse(t); } catch { failures.push(`${rel}: not JSON`); return null; } };
    const styles = files ? Object.keys(files).filter(r => r.endsWith(".css")) : walkFiles(root, "styles", r => r.endsWith(".css"));
    return {
        root, code, failures,
        lang: { en: json("lang/en.json"), pl: json("lang/pl.json") },
        css: styles.map(rel => ({ rel, text: get(rel) ?? "" })),
        manifest: json("module.json")
    };
}

/** A language file's leaf keys, flat ("DRPG.A.b"). */
export function leafKeys(obj, prefix = "", out = []) {
    for (const [k, v] of Object.entries(obj ?? {})) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") leafKeys(v, key, out); else out.push(key);
    }
    return out;
}

/** The 1-based line of an offset in a text. */
export const lineOf = (text, at) => text.slice(0, at).split("\n").length;
