/**
 * E56 finder (b): line numbers and counts in comments and test strings that no longer match (E56 C0, 13.11.2026).
 *
 * LINE CITATIONS. `file.mjs:N` (or `:N-M`) in a comment or a string of scripts/ and tools/ (the suite's census reason
 * strings are strings, which is where prep-54 found 78 of them). Checkable when a code name stands within the next 80
 * characters of the citation (`config.mjs:1128 OBSERVE_DC`, `settings.mjs:3362 \`isDeceased\``): the citation holds
 * when the file exists (by base name in the tree), has a line N, and lines N-3..N+3 hold that name. Otherwise the
 * citation is counted as uncheckable, never as wrong; so is one into a file this tree does not hold (Daggerheart's
 * dhRoll.mjs, actor.mjs: `outside`). A name that does not resolve to a single file (two files with the
 * same base name) is uncheckable too.
 *
 * COUNTS. "N <noun> (in|of) `TABLE`" in a comment, the noun one of entries, rows, items, names, keys, steps, parts,
 * surfaces, tables, actions, fields; checkable when TABLE is a top-level const of an array or object literal in the
 * same file or one other: it holds when N is the literal's element or key count. A count in words is not read.
 */

import { readTree, walk, lineOf } from "./lib.mjs";
import { knownNames } from "./comments.mjs";

const CITE = /\b([\w-]+\.m?js):(\d+)(?:-(\d+))?/g;
const NAME_NEAR = /`?\b([A-Za-z_$][\w$]*)\b`?/g;
const COUNT = /\b(\d+)\s+(entries|rows|items|names|keys|steps|parts|surfaces|tables|actions|fields)\s+(?:in|of)\s+`([A-Za-z_$][\w$]*)`/g;
const NOISE = new Set(["line", "lines", "the", "and", "or", "of", "in", "at", "a", "an", "to", "is", "its", "from", "see", "which", "where", "by", "on", "for", "with", "as", "this", "that", "mjs", "js"]);

/** Where each literal table is declared: { NAME: { rel, size } }, top-level consts only. */
function tables(tree) {
    const out = {};
    for (const f of tree.code) for (const n of f.ast.body) {
        const decl = n.type === "ExportNamedDeclaration" ? n.declaration : n;
        if (decl?.type !== "VariableDeclaration") continue;
        for (const d of decl.declarations) {
            let init = d.init;
            if (init?.type === "CallExpression" && /freeze/.test(init.callee?.property?.name ?? "")) init = init.arguments[0];
            if (d.id.type !== "Identifier" || !init) continue;
            const size = init.type === "ArrayExpression" ? init.elements.length : init.type === "ObjectExpression" ? init.properties.length : null;
            if (size !== null) (out[d.id.name] ??= []).push({ rel: f.rel, size });
        }
    }
    return out;
}

export function find(tree) {
    const byBase = new Map();
    for (const f of tree.code) { const b = f.rel.split("/").pop(); (byBase.get(b) ?? byBase.set(b, []).get(b)).push(f); }
    const tabs = tables(tree);
    /* A near name counts only when the tree declares it (finder (a)'s reading), and is not a stage, decision or
       question id ("E28", "Q3", "F7") - those are prose, and read as names they made every citation near one wrong. */
    const { names } = knownNames(tree);
    const codeName = x => names.has(x) && !/^[A-Z]{1,3}\d/.test(x) && !NOISE.has(x) && /^[a-z_$]|_|[a-z][A-Z]/.test(x);
    const findings = [];
    const counts = { citations: 0, checkable: 0, uncheckable: 0, wrongLines: 0, countClaims: 0, countsCheckable: 0, wrongCounts: 0 };
    const texts = f => {
        const out = f.comments.map(c => ({ text: c.value, at: c.range[0] + 2 }));
        walk(f.ast, n => {
            if (n.type === "Literal" && typeof n.value === "string") out.push({ text: n.value, at: n.range[0] + 1 });
            else if (n.type === "TemplateElement") out.push({ text: n.value.cooked ?? "", at: n.range[0] });
        });
        return out;
    };
    for (const f of tree.code.filter(c => c.kind !== "harness")) {
        for (const t of texts(f)) {
            for (const m of t.text.matchAll(CITE)) {
                counts.citations += 1;
                const at = `${f.rel}:${lineOf(f.text, t.at + m.index)}`;
                const after = t.text.slice(m.index + m[0].length, m.index + m[0].length + 80).split(/[.;]\s/)[0];
                const quoted = [...after.matchAll(/`([A-Za-z_$][\w$]*)(?:\(\))?`/g)].map(x => x[1]).find(codeName);
                const name = quoted ?? [...after.matchAll(NAME_NEAR)].map(x => x[1]).find(x => codeName(x) && /[A-Z_]|[a-z][A-Z]/.test(x));
                const targets = byBase.get(m[1]) ?? [];
                /* No such file here is most often a citation into Daggerheart's or Foundry's own source (dhRoll.mjs,
                   actor.mjs): uncheckable in this tree, not wrong. A file of ours that is gone is finder (a)'s. */
                if (!name || targets.length !== 1) {
                    counts.uncheckable += 1;
                    if (!targets.length) counts.outside = (counts.outside ?? 0) + 1;
                    continue;
                }
                counts.checkable += 1;
                const lines = targets[0].text.split("\n"), n = Number(m[2]);
                if (n > lines.length) { counts.wrongLines += 1; findings.push({ kind: "line", at, cite: m[0], name, why: `${m[1]} has ${lines.length} lines` }); continue; }
                const near = lines.slice(Math.max(0, n - 4), n + 3).join("\n");
                if (!new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(near)) {
                    const real = lines.findIndex(l => new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(l));
                    counts.wrongLines += 1;
                    findings.push({ kind: "line", at, cite: m[0], name, why: real >= 0 ? `${name} is at ${m[1]}:${real + 1}` : `${name} is not in ${m[1]}` });
                }
            }
        }
        for (const c of f.comments) for (const m of c.value.matchAll(COUNT)) {
            counts.countClaims += 1;
            const t = (tabs[m[3]] ?? []);
            const pick = t.find(x => x.rel === f.rel) ?? (t.length === 1 ? t[0] : null);
            if (!pick) continue;
            counts.countsCheckable += 1;
            if (Number(m[1]) !== pick.size) {
                counts.wrongCounts += 1;
                findings.push({ kind: "count", at: `${f.rel}:${lineOf(f.text, c.range[0] + 2 + m.index)}`, cite: m[0], name: m[3], why: `${m[3]} (${pick.rel}) has ${pick.size}` });
            }
        }
    }
    return { findings, counts };
}

export const PLANT = {
    "scripts/b.mjs": "export const ROWS = [1, 2, 3];\n// the 3 rows of `ROWS` hold; the 5 entries of `ROWS` do not\n" + "//\n".repeat(10) + "export function here() {}\n",
    "scripts/c.mjs": "// b.mjs:13 `here` holds; b.mjs:2 `here` is wrong; b.mjs:99 `here` is past the end; gone.mjs:4 `here` is outside; b.mjs:3 E28 alone is uncheckable\n"
};
export const PLANT_WANTS = ["count ROWS", "line b.mjs:2", "line b.mjs:99"];

export function selfCheck(espree) {
    const got = find(readTree("/fixture", { files: PLANT, espree })).findings.map(x => `${x.kind} ${x.kind === "count" ? x.name : x.cite}`).sort();
    return { ok: JSON.stringify(got) === JSON.stringify([...PLANT_WANTS].sort()), got, wanted: PLANT_WANTS };
}
