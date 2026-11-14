/**
 * E56 finder (a): comments that name a function, constant or file nothing declares (E56 C0, 13.11.2026).
 *
 * A citation is a backticked span in a comment of scripts/ (the module and the suite) whose whole text is a code name:
 * `name`, `name()`, `name(args)`, `a.b.c` (the last part read), or `file.mjs name`; a `file.mjs` alone is read as a
 * file. A name exists when the tree declares it or uses it as code - a function, class, variable, parameter, method,
 * class field, object key, member name (`x.name`), import or export, in any code file read (lib.mjs `readTree`) - or
 * an identifier-shaped string literal (a hook, a setting, a flag: what the code calls by its name), or
 * it is a key segment of lang/en.json, a class, id or custom property of a stylesheet, or a key of module.json. That
 * is the declarations, not the text: a word that appears only inside another comment or a string does not exist.
 * A file exists when some file of the tree has that base name. Only code-shaped names are read (camelCase, UPPER_CASE,
 * snake_case, or written with "()"): a plain lower-case word in backticks is a CSS value or an English word more often
 * than a name, and is counted as skipped, not judged.
 */

import { readTree, walk, bindings, leafKeys, lineOf } from "./lib.mjs";

const CODE_SHAPED = /^(?:[a-z][a-z0-9]*[A-Z][\w$]*|[A-Z][A-Z0-9]*_[A-Z0-9_]+|[A-Z]{2,}[A-Z0-9]*|[a-z][\w$]*_[\w$]+|[A-Z][a-z0-9]+[A-Z][\w$]*)$/;
const SPAN = /^(?:([\w.-]+\.m?js)\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(\(.*\))?$/;

/** Every name the tree declares or uses as code, and every file base name. */
export function knownNames(tree) {
    const names = new Set();
    for (const f of tree.code) {
        walk(f.ast, n => {
            switch (n.type) {
                case "FunctionDeclaration": case "FunctionExpression": case "ClassDeclaration": case "ClassExpression":
                    if (n.id) names.add(n.id.name);
                    for (const p of n.params ?? []) bindings(p).forEach(x => names.add(x));
                    break;
                case "ArrowFunctionExpression": for (const p of n.params) bindings(p).forEach(x => names.add(x)); break;
                case "VariableDeclarator": bindings(n.id).forEach(x => names.add(x)); break;
                case "MethodDefinition": case "PropertyDefinition": case "Property":
                    if (n.key?.type === "Identifier") names.add(n.key.name);
                    else if (n.key?.type === "Literal" && typeof n.key.value === "string") names.add(n.key.value);
                    break;
                case "MemberExpression": if (!n.computed && n.property?.type === "Identifier") names.add(n.property.name); break;
                case "ImportSpecifier": case "ExportSpecifier":
                    for (const s of [n.imported, n.local, n.exported]) if (s) names.add(s.name ?? s.value);
                    break;
                case "ImportDefaultSpecifier": case "ImportNamespaceSpecifier": names.add(n.local.name); break;
                case "CatchClause": if (n.param) bindings(n.param).forEach(x => names.add(x)); break;
                /* An identifier-shaped string is a name the code holds - a hook (`Hooks.callAll("drpgActionResolved")`),
                   a setting key, a flag, a socket action - not prose. */
                case "Literal": if (typeof n.value === "string" && /^[A-Za-z_$][\w$]*$/.test(n.value)) names.add(n.value); break;
                default: break;
            }
        });
    }
    for (const lang of [tree.lang.en, tree.lang.pl]) for (const k of leafKeys(lang)) for (const seg of k.split(".")) names.add(seg);
    for (const s of tree.css) for (const m of s.text.matchAll(/[.#]([A-Za-z_][\w-]*)|--([\w-]+)/g)) names.add(m[1] ?? `--${m[2]}`);
    for (const k of Object.keys(tree.manifest ?? {})) names.add(k);
    // The language's own globals (Boolean, Promise, Intl, ...), as Node has them.
    for (const g of Object.getOwnPropertyNames(globalThis)) names.add(g);
    const files = new Set([...tree.code.map(f => f.rel), ...tree.css.map(s => s.rel)].map(r => r.split("/").pop()));
    return { names, files };
}

/** The citations nothing holds, as `{ at, name, span, kind }`, and the counts read. */
export function find(tree) {
    const { names, files } = knownNames(tree);
    const out = [];
    let spans = 0, judged = 0, skipped = 0;
    for (const f of tree.code.filter(c => c.kind === "module" || c.kind === "test")) {
        for (const c of f.comments) {
            for (const m of c.value.matchAll(/`([^`\n]+)`/g)) {
                spans += 1;
                const span = m[1].trim();
                const at = `${f.rel}:${lineOf(f.text, c.range[0] + 2 + m.index)}`;
                if (/^[\w.-]+\.m?js$/.test(span)) {
                    judged += 1;
                    if (!files.has(span.split("/").pop())) out.push({ at, name: span, span, kind: "file" });
                    continue;
                }
                const s = SPAN.exec(span);
                if (!s) { skipped += 1; continue; }
                if (s[1] && !files.has(s[1].split("/").pop())) { judged += 1; out.push({ at, name: s[1], span, kind: "file" }); continue; }
                const name = s[2].split(".").pop();
                if (!CODE_SHAPED.test(name) && !s[3]) { skipped += 1; continue; }
                judged += 1;
                if (!names.has(name)) out.push({ at, name, span, kind: "name" });
            }
        }
    }
    return { findings: out, counts: { spans, judged, skipped, unresolved: out.length } };
}

/** The planted fixture: a declared function, a method, a member, a file - and two citations that hold nothing. */
export const PLANT = {
    "scripts/a.mjs": "export function aliveFn() { return obj.memberName; }\nconst obj = { methodName() {} };\n" +
        "/* `aliveFn()` and `obj.methodName` and `memberName` and `a.mjs aliveFn` hold; `goneFn()` and `ghost.mjs` do not; `plain` is skipped */\n",
    "lang/en.json": "{\"DRPG\": {\"KeyPart\": \"x\"}}"
};
export const PLANT_WANTS = ["goneFn", "ghost.mjs"];

export function selfCheck(espree) {
    const tree = readTree("/fixture", { files: PLANT, espree });
    const got = find(tree).findings.map(x => x.name).sort();
    return { ok: JSON.stringify(got) === JSON.stringify([...PLANT_WANTS].sort()), got, wanted: PLANT_WANTS };
}
