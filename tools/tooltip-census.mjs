/**
 * The census of the module's controls and their help (E102, 13.11.2026): which controls a reader meets with neither a
 * tooltip nor a hint line, and the baseline that keeps that number from growing.
 * ---------------------------------------------------------------------------
 *     node tools/tooltip-census.mjs              every site as JSON (with the reader and the screens, from the screen map)
 *     node tools/check.mjs tooltips              the gate: today's sites without help against tools/tooltip-census.json
 *
 * Rebuilt in E102's prep (docs/dev/e102/PLAN.md section 2) from the method E57's prep wrote down (claude/e57-prep
 * b7575629, docs/dev/e57/MEASURE-coverage.md B.1), whose scanner was not committed. Every module script but the suite's
 * (tests.mjs, tests-*.mjs) and ui-kit.mjs (its builders are counted where they are called), comments blanked by espree
 * first. A CONTROL is one site that draws one: a raw `<button`, `<select`, `<textarea`, `<input` (type="hidden" left
 * out), an element with `role="tab"` (inside a markup tag only: a CSS selector's [role="tab"] is not one); a kit builder
 * call (toggle, stepper, iconButton, chip, roleButton, launcher, kitTabs, kitTabBar); each `{ ... label: ... }` object of
 * a `footer: {...}` and of a `buttons: [...]`; `document.createElement("button"|"input"|"select"|"textarea")`. A footer's
 * closing word (`close: "close"|"cancel"`) is counted apart and needs nothing (the kit draws it with no tooltip).
 * HELP: a TOOLTIP in the site's own text (data-tooltip, title= / title:, tooltip:, aria-describedby, .title =,
 * dataset.tooltip, setAttribute("title"), the kit's `tipAttr(` and `tipText(`; for a createElement, its next 14 lines;
 * iconButton and launcher always carry one, their name), or a HINT LINE within 3 source lines (a drpg-help paragraph,
 * helpText(, a *-hint class, a ...Hint / .hint key, class="notes"). A site with neither NEEDS one.
 *
 * WHAT IT MISREADS, measured on its 390 sites at 421f239 (E102's five readers, docs/dev/e102/TOOLTIPS.json): about one
 * in ten. 16 sites carry a key from the line above or below rather than the control's own label; 16 already had a
 * tooltip set far from the markup (a helper, a title that follows the state); 5 were inputs hidden by an attribute or a
 * class. A site drawn many times counts once. So the baseline names sites by file, top-level unit, kind and key - never
 * by line, which E54's moves change - and as a count of each, and a row may say why its site needs no tooltip.
 *
 * THE GATE (`check`): every site that needs help today is matched against a baseline row of the same file, unit, kind
 * and key; a site with no row left is a control drawn with no tooltip (red: give it one, or a row with its reason); a
 * row with no site left is help given and the row kept (red: cut the row, so the baseline only shrinks). The self-check
 * plants a bare button, a tipped one, a footer object with and without `tooltip:` and a hinted field, and wants each read
 * as planted, so a census that stopped seeing controls is red rather than green (CLAUDE.md's `stackShapes`).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
export const BASELINE = "tools/tooltip-census.json";

const TIP = /data-tooltip|title\s*=|\btitle\s*:|\btooltip\s*:|aria-describedby|\.title\s*=|dataset\.tooltip|setAttribute\(\s*["']title|\btip(?:Attr|Text)\(/;
const HINT = /drpg-help|helpText\(|-hint\b|Hint["'`]|\.hint["'`]|class="notes"/;
const KEY = /DRPG\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/;

let espreeMod = null;
function espree(repo = REPO) {
    espreeMod ??= createRequire(path.join(repo, "audit", "harness", "package.json"))("espree");
    return espreeMod;
}

function blank(src, es) {
    let comments;
    try { comments = es.parse(src, { ecmaVersion: "latest", sourceType: "module", comment: true, range: true }).comments; }
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
function tipOf(text) {
    if (!TIP.test(text)) return "none";
    const outside = text.replace(/\$\{[^}]*\?[^}]*:\s*(""|''|``)\s*\}/g, "");
    return TIP.test(outside) ? "always" : "conditional";
}
function keyNear(src, a, b) {
    const own = src.slice(a, b).match(KEY);
    if (own) return own[0];
    const before = src.slice(Math.max(0, a - 160), a).match(new RegExp(KEY.source, "g"));
    return before ? before[before.length - 1] : null;
}

/** The control sites of one file's source. */
export function scan(file, raw, es = espree()) {
    const s = blank(raw, es), lines = s.split("\n"), sites = [];
    const hintNear = line => lines.slice(Math.max(0, line - 4), line + 3).some(l => HINT.test(l));
    let units = [];
    try {
        const ast = es.parse(raw, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true });
        units = ast.body.map(n => {
            const d = n.declaration ?? n;
            return { name: d.id?.name ?? d.declarations?.[0]?.id?.name ?? `@${n.loc.start.line}`, from: n.loc.start.line, to: n.loc.end.line };
        });
    } catch { /* unit names left empty */ }
    const unitOf = line => units.find(u => u.from <= line && line <= u.to)?.name ?? null;
    const push = (kind, a, b, extra = {}) => {
        const line = lineOf(s, a), text = s.slice(a, b);
        sites.push({ file, line, kind, tip: extra.tip ?? tipOf(text), hint: hintNear(line), key: keyNear(s, a, b),
            closing: Boolean(extra.closing), unit: unitOf(line), context: raw.split("\n").slice(Math.max(0, line - 3), line + 3).join("\n").slice(0, 700) });
    };
    for (const m of s.matchAll(/<(button|select|textarea|input)\b/g)) {
        const b = tagEnd(s, m.index), text = s.slice(m.index, b);
        if (m[1] === "input" && /type\s*=\s*["']hidden/.test(text)) continue;
        const kind = m[1] === "input" ? (text.match(/type\s*=\s*["'](checkbox|radio)/)?.[1] ?? "input") : m[1];
        push(kind, m.index, b);
    }
    for (const m of s.matchAll(/role\s*=\s*["']tab["']/g)) {
        const a = s.lastIndexOf("<", m.index);
        if (a < 0 || /[>\]\[]/.test(s.slice(a, m.index)) || m.index - a > 400) continue;
        if (/^<(button|select|textarea|input)\b/.test(s.slice(a, a + 10))) continue;
        push("tab", a, tagEnd(s, a));
    }
    for (const m of s.matchAll(/(?<![.\w])(toggle|stepper|iconButton|chip|roleButton|launcher|kitTabs|kitTabBar)\(/g)) {
        const pre = s.slice(Math.max(0, m.index - 12), m.index);
        if (/function\s*$|export\s*$/.test(pre) || /import\s*\{[^}]*$/.test(s.slice(Math.max(0, m.index - 300), m.index))) continue;
        const b = balanced(s, m.index + m[1].length);
        push(`kit:${m[1]}`, m.index, b, m[1] === "iconButton" || m[1] === "launcher" ? { tip: "always" } : {});
    }
    for (const m of s.matchAll(/\b(footer|buttons)\s*:\s*([{[])/g)) {
        const start = m.index + m[0].length - 1, end = balanced(s, start), block = s.slice(start, end);
        for (const c of block.matchAll(/\bclose\s*:\s*["'](close|cancel)["']/g)) push("footer-close", start + c.index, start + c.index + c[0].length, { tip: "none", closing: true });
        let objStart = -1;
        for (let j = 0; j < block.length; j++) {
            const ch = block[j];
            if (ch === '"' || ch === "'" || ch === "`") { const q = ch; j++; while (j < block.length && block[j] !== q) { if (block[j] === "\\") j++; j++; } continue; }
            if (ch === "{") { if (j > 0 || m[2] === "[") objStart = j; }
            else if (ch === "}") {
                if (objStart >= 0) { const obj = block.slice(objStart, j + 1); if (/\blabel\s*:/.test(obj) && !/\{[^{}]*\blabel\s*:[^{}]*\{/.test(obj.slice(1))) push("footer", start + objStart, start + j + 1); }
                objStart = -1;
            }
        }
    }
    for (const m of s.matchAll(/document\.createElement\(\s*["'](button|input|select|textarea)["']\s*\)/g)) {
        const line = lineOf(s, m.index), after = lines.slice(line - 1, line + 14).join("\n");
        sites.push({ file, line, kind: `dom:${m[1]}`, tip: tipOf(after), hint: hintNear(line),
            key: keyNear(s, m.index, m.index + m[0].length + after.length), closing: false,
            unit: unitOf(line), context: raw.split("\n").slice(Math.max(0, line - 3), line + 8).join("\n").slice(0, 700) });
    }
    for (const site of sites) site.needs = !site.closing && site.tip === "none" && !site.hint;
    return sites;
}

/** Every module script's sites. */
export function census(repo = REPO) {
    const dir = path.join(repo, "scripts"), es = espree(repo);
    return fs.readdirSync(dir).filter(f => f.endsWith(".mjs") && !/^tests(-|\.mjs$)/.test(f) && f !== "ui-kit.mjs").sort()
        .flatMap(f => scan(`scripts/${f}`, fs.readFileSync(path.join(dir, f), "utf8"), es));
}

export const identity = s => `${s.file}|${s.unit ?? ""}|${s.kind}|${s.key ?? ""}`;

/** Today's sites that need help against the baseline's rows: the problems, one line each. */
export function compare(sites, rows) {
    const left = new Map();
    for (const r of rows) left.set(identity(r), (left.get(identity(r)) ?? 0) + (r.count ?? 1));
    const problems = [];
    for (const s of sites.filter(x => x.needs)) {
        const id = identity(s), n = left.get(id) ?? 0;
        if (n > 0) left.set(id, n - 1);
        else problems.push(`${s.file}:${s.line} (${s.unit ?? "top level"}) draws a ${s.kind} with no tooltip and no hint${s.key ? ` near ${s.key}` : ""}: give it one (ui-kit.mjs tipAttr), or a row in ${BASELINE} with its reason`);
    }
    for (const [id, n] of left) if (n > 0) problems.push(`${BASELINE} keeps ${n} row(s) of ${id.replace(/\|/g, " ")} that no site needs any more: cut ${n === 1 ? "it" : "them"}, so the baseline only shrinks`);
    return problems;
}

/** The planted pairs: each must be read as planted, or the census measures nothing. */
export function selfCheck(es = espree()) {
    const plant = [
        "export function a() { return `<button type=\"button\">${game.i18n.localize(\"DRPG.X.go\")}</button>`; }",
        "export function b() { return `<button type=\"button\"${tipAttr(\"DRPG.Tips.X.goTooltip\")}>Go</button>`; }",
        "export function c() { return drpgWindow({ footer: { right: [{ role: \"primary\", label: \"DRPG.X.save\", action: \"save\" }] } }); }",
        "export function d() { return drpgWindow({ footer: { right: [{ role: \"primary\", label: \"DRPG.X.save\", action: \"save\", tooltip: localize(\"DRPG.Tips.X.saveTooltip\") }] } }); }",
        "export function e() { return `${helpText(\"DRPG.X.nameHint\")}<input type=\"text\" name=\"n\">`; }",
        "export function f() { return `<input type=\"hidden\" name=\"h\">`; }"
    ].join("\n\n\n\n\n\n\n\n");   // eight lines apart: a hint line counts within three
    const got = scan("scripts/plant.mjs", plant, es).map(s => [s.unit, s.kind, s.needs]);
    const want = [["a", "button", true], ["b", "button", false], ["e", "input", false], ["c", "footer", true], ["d", "footer", false]];
    const key = x => x.join(":");
    const misses = want.filter(w => !got.some(g => key(g) === key(w))).map(w => `self-check: the planted ${w[1]} in ${w[0]}() was not read as ${w[2] ? "needing help" : "helped"}`);
    if (got.some(g => g[0] === "f")) misses.push("self-check: a hidden input was counted as a control");
    if (got.length !== want.length) misses.push(`self-check: ${got.length} planted site(s) read, ${want.length} planted`);
    return misses;
}

/** The gate, as `node tools/check.mjs tooltips` runs it. */
export function check(log = console.log, repo = REPO) {
    const misses = selfCheck(espree(repo));
    const sites = census(repo);
    let base;
    try { base = JSON.parse(fs.readFileSync(path.join(repo, BASELINE), "utf8")); }
    catch (err) { return [...misses, `${BASELINE} could not be read (${err.message})`]; }
    const rows = base.rows ?? [];
    const problems = compare(sites, rows);
    const need = sites.filter(s => s.needs).length, kept = rows.reduce((a, r) => a + (r.count ?? 1), 0);
    const reasons = rows.filter(r => r.why && !/^E102 C\d/.test(r.why)).reduce((a, r) => a + (r.count ?? 1), 0);
    log(`tooltips: ${sites.filter(s => !s.closing).length} control site(s) in ${new Set(sites.map(s => s.file)).size} file(s), `
        + `${need} with no tooltip and no hint; baseline ${kept} (${reasons} with a reason, ${kept - reasons} still to give one); `
        + `self-check ${6 - misses.length}/6; ${problems.length + misses.length} problem(s)`);
    return [...misses, ...problems];
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
    const sites = census();
    const TM = await import(url.pathToFileURL(path.join(REPO, "tools", "text-map.mjs")).href);
    const { keys, tables } = await TM.moduleKeys(REPO);
    const map = TM.buildScreenMap({ scripts: TM.moduleScripts(REPO), keys, espree: TM.loadEspree(REPO), configTables: tables });
    const screensOf = new Map();
    for (const sc of map.screens ?? []) for (const { key: k } of sc.keys ?? []) { if (!screensOf.has(k)) screensOf.set(k, []); screensOf.get(k).push(sc); }
    for (const site of sites) {
        const scr = site.key ? (screensOf.get(site.key) ?? []) : [];
        const readers = [...new Set(scr.map(x => x.reader))];
        site.reader = readers.length === 1 ? readers[0] : readers.includes("player") || readers.includes("both") ? "player" : readers.length ? readers.join("/") : "unknown";
        site.screens = scr.map(x => x.name).slice(0, 3);
    }
    process.stdout.write(JSON.stringify({ sites }, null, 1));
}
