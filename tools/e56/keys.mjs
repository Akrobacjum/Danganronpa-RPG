/**
 * E56 finder (e): keys of lang/en.json that no code or test reads (E56 C0, 13.11.2026).
 *
 * A key is READ when a string of any code file holds it whole - a literal equal to it, or one it stands inside as a
 * word (`data-i18n="DRPG.A.b"`, a template's text) - or holds its plural family (the key less `.one`, `.other`, `.few`,
 * `.many`, as `plural("DRPG.Unit.action", ...)` reads it). `module` when a module file holds it, `test` when only the
 * suite, tools or the harness do.
 *
 * A key is UNSURE when a builder could make it at run time: a template literal whose text starts "DRPG." and goes on
 * after an expression (`\`DRPG.Rest.${kind}\``), a "DRPG." string joined with `+`, or a "DRPG." string literal that
 * ends in a dot (a prefix held for later) - every key under that prefix is unsure, and so is `DRPG.Config.*`, which
 * i18n.mjs `localizeConfig` builds from config.mjs's paths. An unsure key is never called dead: only a reading of the
 * builder settles it.
 *
 * A key outside `DRPG.` is FOREIGN: the module's text for Foundry's or Daggerheart's own string, which their code reads.
 *
 * A key is DEAD when none of that holds.
 */

import { readTree, walk, leafKeys } from "./lib.mjs";

const PLURAL = /\.(one|other|few|many|zero|two)$/;

export function find(tree) {
    const keys = leafKeys(tree.lang.en);
    const held = new Map();                        // a string holding a key -> "module" | "test"
    const prefixes = new Map();                    // a builder's prefix -> Set of "rel:line"
    const hold = (s, kind) => { if (!held.has(s) || kind === "module") held.set(s, kind); };
    for (const f of tree.code) {
        const kind = f.kind === "module" ? "module" : "test";
        walk(f.ast, (n, parent) => {
            if (n.type === "Literal" && typeof n.value === "string" && n.value.includes("DRPG.")) {
                hold(n.value, kind);
                if (/^DRPG\.[\w.]*\.$/.test(n.value)) (prefixes.get(n.value) ?? prefixes.set(n.value, new Set()).get(n.value)).add(`${f.rel}:${n.loc.start.line}`);
                if (parent?.type === "BinaryExpression" && parent.operator === "+" && parent.left === n && /^DRPG\./.test(n.value)) {
                    const p = n.value.replace(/[^.]*$/, "");
                    (prefixes.get(p) ?? prefixes.set(p, new Set()).get(p)).add(`${f.rel}:${n.loc.start.line}`);
                }
            } else if (n.type === "TemplateLiteral") {
                const text = n.quasis.map(q => q.value.cooked ?? "").join("\u0000");
                if (text.includes("DRPG.")) hold(text, kind);
                n.quasis.forEach((q, i) => {
                    const cooked = q.value.cooked ?? "";
                    const m = /(DRPG\.[\w.]*)$/.exec(cooked);
                    if (m && i < n.expressions.length) {
                        const p = m[1].replace(/[^.]*$/, "");
                        (prefixes.get(p) ?? prefixes.set(p, new Set()).get(p)).add(`${f.rel}:${n.loc.start.line}`);
                    }
                });
            }
        });
    }
    const texts = [...held.entries()];
    const holder = key => {
        const re = new RegExp(`(^|[^\\w.])${key.replace(/[.$]/g, "\\$&")}($|[^\\w])`);
        let found = null;
        for (const [s, kind] of texts) if (s === key || (s.length > key.length && re.test(s))) { if (kind === "module") return "module"; found = "test"; }
        return found;
    };
    const rows = [];
    for (const key of keys) {
        /* A key outside DRPG. is the module's text for Foundry's or Daggerheart's own string (`GAME.Paused`,
           `DAGGERHEART.CONFIG.Traits.*`): their code reads it, not ours. */
        if (!key.startsWith("DRPG.")) { rows.push({ key, verdict: "foreign" }); continue; }
        const family = key.replace(PLURAL, "");
        const by = holder(key) ?? (family !== key ? holder(family) : null);
        if (by) { rows.push({ key, verdict: by }); continue; }
        const under = [...prefixes.keys()].filter(p => key.startsWith(p) && p.length > "DRPG.".length);
        if (key.startsWith("DRPG.Config.")) { rows.push({ key, verdict: "unsure", why: "DRPG.Config.* (localizeConfig)" }); continue; }
        if (under.length) { const p = under.sort((a, b) => b.length - a.length)[0]; rows.push({ key, verdict: "unsure", why: `${p}* built at ${[...prefixes.get(p)].slice(0, 2).join(", ")}` }); continue; }
        rows.push({ key, verdict: "dead" });
    }
    const tally = {};
    for (const r of rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
    return { rows, counts: { keys: keys.length, prefixes: prefixes.size, ...tally } };
}

export const PLANT = {
    "lang/en.json": JSON.stringify({ DRPG: { A: { read: "x", inText: "x", unit: { one: "x", other: "y" }, testOnly: "x" }, Built: { b1: "x" }, Dead: { gone: "x" } } }),
    "scripts/m.mjs": "game.i18n.localize(\"DRPG.A.read\");\nconst h = `<b data-i18n=\"DRPG.A.inText\">`;\nplural(\"DRPG.A.unit\", 2);\nconst k = `DRPG.Built.${x}`;\n",
    "scripts/tests-t.mjs": "game.i18n.localize(\"DRPG.A.testOnly\");\n"
};
export const PLANT_WANTS = { "DRPG.A.read": "module", "DRPG.A.inText": "module", "DRPG.A.unit.one": "module", "DRPG.A.unit.other": "module", "DRPG.A.testOnly": "test", "DRPG.Built.b1": "unsure", "DRPG.Dead.gone": "dead" };

export function selfCheck(espree) {
    const rows = find(readTree("/fixture", { files: PLANT, espree })).rows;
    const got = Object.fromEntries(rows.map(r => [r.key, r.verdict]));
    return { ok: JSON.stringify(got) === JSON.stringify(PLANT_WANTS), got, wanted: PLANT_WANTS };
}
