/**
 * E102's census of the module's controls and their help (prep, 13.11.2026). Read-only: prints JSON, writes nothing.
 * ---------------------------------------------------------------------------
 *     node docs/dev/e102/census.mjs > sites.json          (from the repository root; espree from audit/harness)
 *
 * Rebuilt from the method E57's prep wrote down (claude/e57-prep b7575629, docs/dev/e57/MEASURE-coverage.md B.1),
 * whose scanner was not committed. Every module script but the suite's (tests.mjs, tests-*.mjs), comments blanked
 * by espree first. A CONTROL is one site that draws one: a raw `<button`, `<select`, `<textarea`, `<input`
 * (type="hidden" left out), an element with `role="tab"`; a kit builder call (toggle, stepper, iconButton, chip,
 * roleButton, launcher, kitTabs, kitTabBar); each `{ ... label: ... }` object of a `footer: {...}` and of a
 * `buttons: [...]`; `document.createElement("button"|"input"|"select"|"textarea")`. A footer's closing word
 * (`close: "close"|"cancel"`) is counted apart and needs nothing (the kit draws it with no tooltip by design).
 * HELP: a TOOLTIP in the site's own text (data-tooltip, data-tooltip-text, title= / title:, tooltip:,
 * aria-describedby, .title =, dataset.tooltip, setAttribute("title"); for a createElement, its next 14 lines;
 * iconButton and launcher always carry one, the name); "conditional" when every tooltip in it sits inside a
 * `${... ? ... : ""}`; a HINT LINE within 3 source lines (a drpg-help paragraph, helpText(, a *-hint class, a
 * ...Hint / .hint key, class="notes"). A site with neither is one E102 writes a tooltip for.
 * The label key is the first DRPG.* key in the site's text, else in the 160 characters before it. The reader and
 * the window come from tools/text-map.mjs's screen map: the screens that say the label key (none: "unknown").
 * A static reading, +-10% as E57's was: a tooltip set far from the markup is missed, a site drawn many times is one.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", "..");
const require = createRequire(path.join(REPO, "audit", "harness", "package.json"));
const espree = require("espree");
const TM = await import(url.pathToFileURL(path.join(REPO, "tools", "text-map.mjs")).href);

// ui-kit.mjs left out: its builders are the kit's own (the controls they draw are counted where they are called), as E57's count did
const files = fs.readdirSync(path.join(REPO, "scripts")).filter(f => f.endsWith(".mjs") && !/^tests(-|\.mjs$)/.test(f) && f !== "ui-kit.mjs").sort();
const en = JSON.parse(fs.readFileSync(path.join(REPO, "lang", "en.json"), "utf8"));
const pl = JSON.parse(fs.readFileSync(path.join(REPO, "lang", "pl.json"), "utf8"));
const at = (o, k) => k.split(".").reduce((x, p) => (x && typeof x === "object" ? x[p] : undefined), o);

function blank(src) {
    let comments = [];
    try { comments = espree.parse(src, { ecmaVersion: "latest", sourceType: "module", comment: true, range: true }).comments; }
    catch {
        // a file espree does not parse: block and line comments blanked by pattern (strings holding "//" are rare here)
        return src.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, a) => a + " ".repeat(m.length - a.length));
    }
    const a = src.split("");
    for (const c of comments) for (let i = c.range[0]; i < c.range[1]; i++) if (a[i] !== "\n") a[i] = " ";
    return a.join("");
}
const lineOf = (s, i) => s.slice(0, i).split("\n").length;
/** From an opening `(`, `{` or `[` at i, the index after its partner (strings and templates skipped roughly). */
function balanced(s, i) {
    const open = s[i], close = { "(": ")", "{": "}", "[": "]" }[open];
    let depth = 0;
    for (let j = i; j < s.length; j++) {
        const ch = s[j];
        if (ch === '"' || ch === "'") { const q = ch; j++; while (j < s.length && s[j] !== q) { if (s[j] === "\\") j++; j++; } continue; }
        if (ch === "`") { j++; while (j < s.length && s[j] !== "`") { if (s[j] === "\\") j++; else if (s[j] === "$" && s[j + 1] === "{") j = balanced(s, j + 1) - 1; j++; } continue; }
        if (ch === open) depth++;
        else if (ch === close) { depth--; if (!depth) return j + 1; }
    }
    return s.length;
}
/** A markup tag from `<` at i to its `>`, skipping `${...}`. */
function tagEnd(s, i) {
    for (let j = i; j < s.length; j++) {
        if (s[j] === "$" && s[j + 1] === "{") { j = balanced(s, j + 1) - 1; continue; }
        if (s[j] === ">") return j + 1;
        if (s[j] === "`") return j;
    }
    return s.length;
}
const TIP = /data-tooltip|title\s*=|\btitle\s*:|\btooltip\s*:|aria-describedby|\.title\s*=|dataset\.tooltip|setAttribute\(\s*["']title/;
const HINT = /drpg-help|helpText\(|-hint\b|Hint["'`]|\.hint["'`]|class="notes"/;
function tipOf(text) {
    if (!TIP.test(text)) return "none";
    const outside = text.replace(/\$\{[^}]*\?[^}]*:\s*(""|''|``)\s*\}/g, "");
    return TIP.test(outside) ? "always" : "conditional";
}
function keyNear(src, a, b) {
    const own = src.slice(a, b).match(/DRPG\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/);
    if (own) return own[0];
    const before = src.slice(Math.max(0, a - 160), a).match(/DRPG\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/g);
    return before ? before[before.length - 1] : null;
}

const sites = [];
for (const f of files) {
    const raw = fs.readFileSync(path.join(REPO, "scripts", f), "utf8");
    const s = blank(raw), lines = s.split("\n");
    const hintNear = line => lines.slice(Math.max(0, line - 4), line + 3).some(l => HINT.test(l));
    let units = [];
    try {
        const ast = espree.parse(raw, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true });
        units = ast.body.map(n => {
            const d = n.declaration ?? n;
            const name = d.id?.name ?? d.declarations?.[0]?.id?.name ?? `@${n.loc.start.line}`;
            return { name, from: n.loc.start.line, to: n.loc.end.line };
        });
    } catch { /* unit names left empty */ }
    const unitOf = line => units.find(u => u.from <= line && line <= u.to)?.name ?? null;
    const push = (kind, a, b, extra = {}) => {
        const line = lineOf(s, a), text = s.slice(a, b);
        sites.push({ file: `scripts/${f}`, line, kind, tip: extra.tip ?? tipOf(text), nameOnly: Boolean(extra.nameOnly),
            hint: hintNear(line), aria: /aria-label/.test(text), key: keyNear(s, a, b), closing: Boolean(extra.closing),
            unit: unitOf(line), context: raw.split("\n").slice(Math.max(0, line - 3), line + 3).join("\n").slice(0, 700) });
    };
    // raw tags and role="tab"
    for (const m of s.matchAll(/<(button|select|textarea|input)\b/g)) {
        const b = tagEnd(s, m.index), text = s.slice(m.index, b);
        if (m[1] === "input" && /type\s*=\s*["']hidden/.test(text)) continue;
        const kind = m[1] === "input" && /type\s*=\s*["'](checkbox|radio)/.test(text) ? RegExp.$1 : m[1];
        push(kind, m.index, b);
    }
    for (const m of s.matchAll(/role\s*=\s*["']tab["']/g)) {
        const a = s.lastIndexOf("<", m.index);
        // inside a markup tag only: no ">" between its "<" and the attribute (a CSS selector's [role="tab"] is not one)
        if (a < 0 || /[>\]\[]/.test(s.slice(a, m.index)) || m.index - a > 400) continue;
        if (/^<(button|select|textarea|input)\b/.test(s.slice(a, a + 10))) continue;
        push("tab", a, tagEnd(s, a));
    }
    // kit builders
    for (const m of s.matchAll(/(?<![.\w])(toggle|stepper|iconButton|chip|roleButton|launcher|kitTabs|kitTabBar)\(/g)) {
        const pre = s.slice(Math.max(0, m.index - 12), m.index);
        if (/function\s*$|export\s*$/.test(pre) || /import\s*\{[^}]*$/.test(s.slice(Math.max(0, m.index - 300), m.index))) continue;
        const b = balanced(s, m.index + m[1].length);
        const always = m[1] === "iconButton" || m[1] === "launcher";
        push(`kit:${m[1]}`, m.index, b, always ? { tip: "always", nameOnly: true } : {});
    }
    // footer objects and DialogV2 buttons
    for (const m of s.matchAll(/\b(footer|buttons)\s*:\s*([{[])/g)) {
        const start = m.index + m[0].length - 1, end = balanced(s, start), block = s.slice(start, end);
        for (const c of block.matchAll(/\bclose\s*:\s*["'](close|cancel)["']/g)) push("footer-close", start + c.index, start + c.index + c[0].length, { tip: "none", closing: true });
        let depth = 0, objStart = -1;
        for (let j = 0; j < block.length; j++) {
            const ch = block[j];
            if (ch === '"' || ch === "'" || ch === "`") { const q = ch; j++; while (j < block.length && block[j] !== q) { if (block[j] === "\\") j++; j++; } continue; }
            if (ch === "{") { depth++; if (j > 0 || m[2] === "[") objStart = j; }
            else if (ch === "}") {
                if (objStart >= 0) { const obj = block.slice(objStart, j + 1); if (/\blabel\s*:/.test(obj) && !/\{[^{}]*\blabel\s*:[^{}]*\{/.test(obj.slice(1))) push("footer", start + objStart, start + j + 1); }
                objStart = -1; depth--;
            }
        }
    }
    // createElement
    for (const m of s.matchAll(/document\.createElement\(\s*["'](button|input|select|textarea)["']\s*\)/g)) {
        const line = lineOf(s, m.index), after = lines.slice(line - 1, line + 14).join("\n");
        sites.push({ file: `scripts/${f}`, line, kind: `dom:${m[1]}`, tip: tipOf(after), nameOnly: false, hint: hintNear(line), aria: /aria-label/.test(after),
            key: keyNear(s, m.index, m.index + m[0].length + after.length), closing: false,
            unit: unitOf(line), context: raw.split("\n").slice(Math.max(0, line - 3), line + 8).join("\n").slice(0, 700) });
    }
}
// reader and window from the screen map
const scripts = TM.moduleScripts(REPO), { keys, tables } = await TM.moduleKeys(REPO);
const map = TM.buildScreenMap({ scripts, keys, espree: TM.loadEspree(REPO), configTables: tables });
const screensOf = new Map();
for (const sc of map.screens ?? []) for (const { key: k } of sc.keys ?? []) { if (!screensOf.has(k)) screensOf.set(k, []); screensOf.get(k).push(sc); }
for (const site of sites) {
    const scr = site.key ? (screensOf.get(site.key) ?? []) : [];
    const readers = [...new Set(scr.map(x => x.reader))];
    site.reader = readers.length === 1 ? readers[0] : readers.includes("player") || readers.includes("both") ? "player" : readers.length ? readers.join("/") : "unknown";
    site.screens = scr.map(x => x.name).slice(0, 3);
    site.en = site.key ? at(en, site.key) ?? null : null;
    site.pl = site.key ? at(pl, site.key) ?? null : null;
    site.needs = !site.closing && site.tip === "none" && !site.hint;
}
process.stdout.write(JSON.stringify({ commit: process.env.CENSUS_COMMIT ?? null, sites }, null, 1));
