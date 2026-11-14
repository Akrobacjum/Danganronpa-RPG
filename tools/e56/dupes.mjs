/**
 * E56 finder (d): duplicated helpers, with their call sites (E56 C0, 13.11.2026).
 *
 * BY BODY. Every function of the module (scripts/*.mjs, not the suite) - a declaration, or a const bound to an arrow or
 * a function expression - whose body, comments taken out and whitespace collapsed, is at least 24 characters and is
 * the same text as another function's: a group of identical bodies, each with its file:line and name. The names may
 * differ (an `esc` beside an `escapeText`): the body is what is compared, as written, identifiers included.
 *
 * BY NAME. The helpers E56's plan names - glassOn, themeOn, isStainedGlass, cssColour, colourOf, overlayColour,
 * accentColour, esc, L, isPlain - each declaration (file:line, its body's length, whether its body matches another
 * declaration of the same name), and each call site: a call `name(...)` in a file that declares or imports that name,
 * so a site is the copy of its own file.
 */

import { readTree, walk, lineOf } from "./lib.mjs";

export const NAMED = ["glassOn", "themeOn", "isStainedGlass", "cssColour", "colourOf", "overlayColour", "accentColour", "esc", "L", "isPlain"];
const MIN = 24;

/** A function's body as compared: its source, the file's comments blanked inside it, whitespace collapsed. */
function bodyText(f, fn) {
    const [s, e] = fn.body.range;
    let text = f.text.slice(s, e);
    for (const c of f.comments) if (c.range[0] >= s && c.range[1] <= e) text = text.slice(0, c.range[0] - s) + " ".repeat(c.range[1] - c.range[0]) + text.slice(c.range[1] - s);
    return text.replace(/\s+/g, " ").trim();
}

/** The module's functions with a name: { rel, line, name, body }. */
function functionsOf(tree) {
    const out = [];
    for (const f of tree.code.filter(c => c.kind === "module")) {
        walk(f.ast, n => {
            if (n.type === "FunctionDeclaration" && n.id) out.push({ rel: f.rel, line: lineOf(f.text, n.range[0]), name: n.id.name, body: bodyText(f, n) });
            else if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && /^(Arrow)?FunctionExpression$/.test(n.init?.type ?? ""))
                out.push({ rel: f.rel, line: lineOf(f.text, n.range[0]), name: n.id.name, body: bodyText(f, n.init) });
        });
    }
    return out;
}

export function find(tree) {
    const fns = functionsOf(tree);
    const byBody = new Map();
    for (const fn of fns) if (fn.body.length >= MIN) (byBody.get(fn.body) ?? byBody.set(fn.body, []).get(fn.body)).push(fn);
    const groups = [...byBody.values()].filter(g => g.length > 1)
        .map(g => ({ size: g.length, chars: g[0].body.length, members: g.map(x => ({ at: `${x.rel}:${x.line}`, name: x.name })) }))
        .sort((a, b) => b.size - a.size || b.chars - a.chars);
    const named = {};
    for (const name of NAMED) {
        const decls = fns.filter(x => x.name === name);
        const sites = [];
        for (const f of tree.code.filter(c => c.kind === "module")) {
            const holds = decls.some(d => d.rel === f.rel);
            let imports = false;
            walk(f.ast, n => { if (n.type === "ImportSpecifier" && (n.local.name === name)) imports = true; });
            if (!holds && !imports) continue;
            let calls = 0;
            const lines = [];
            walk(f.ast, n => { if (n.type === "CallExpression" && n.callee.type === "Identifier" && n.callee.name === name) { calls += 1; lines.push(lineOf(f.text, n.range[0])); } });
            if (calls) sites.push({ rel: f.rel, own: holds, calls, lines });
        }
        named[name] = {
            declarations: decls.map(d => ({ at: `${d.rel}:${d.line}`, chars: d.body.length, same: decls.filter(o => o !== d && o.body === d.body).length })),
            sites
        };
    }
    return { groups, named, counts: { functions: fns.length, groups: groups.length, copies: groups.reduce((n, g) => n + g.size, 0) } };
}

export const PLANT = {
    "scripts/p.mjs": "export function glassOn() { return document.body.classList.contains('drpg-theme-stained-glass'); }\nglassOn();\n",
    "scripts/q.mjs": "function glassOn() { return document.body.classList.contains('drpg-theme-stained-glass'); }\nconst shortOne = () => 1;\nglassOn(); glassOn();\n",
    "scripts/r.mjs": "import { glassOn } from './p.mjs';\nglassOn();\nconst other = x => x * 2 + 1 + 2 + 3 + 4 + 5 + 6;\n"
};

export function selfCheck(espree) {
    const r = find(readTree("/fixture", { files: PLANT, espree }));
    const g = r.groups.map(x => x.members.map(m => m.name).join("+"));
    const sites = r.named.glassOn.sites.map(s => `${s.rel}:${s.calls}`).sort().join(" ");
    const ok = JSON.stringify(g) === JSON.stringify(["glassOn+glassOn"]) && r.named.glassOn.declarations.length === 2
        && r.named.glassOn.declarations.every(d => d.same === 1) && sites === "scripts/p.mjs:1 scripts/q.mjs:2 scripts/r.mjs:1";
    return { ok, got: { groups: g, sites }, wanted: { groups: ["glassOn+glassOn"], sites: "scripts/p.mjs:1 scripts/q.mjs:2 scripts/r.mjs:1" } };
}
