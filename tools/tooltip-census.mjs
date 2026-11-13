/**
 * The census of the module's controls and their help (E102, 13.11.2026): which controls a reader meets with neither a
 * tooltip nor a hint line, and the baseline that keeps that number from growing.
 * ---------------------------------------------------------------------------
 *     node tools/tooltip-census.mjs              every site as JSON (with the reader and the screens, from the screen map)
 *     node tools/check.mjs tooltips              the gate: today's sites without help against tools/tooltip-census.json
 *
 * Rebuilt in E102's prep (docs/dev/e102/PLAN.md section 2) from the method E57's prep wrote down (claude/e57-prep
 * b7575629, docs/dev/e57/MEASURE-coverage.md B.1), whose scanner was not committed; widened after the review of
 * c5cf2aff (docs/dev/e93/REVIEW-102.md C1, C3, C4 on claude/e93), which found whole kinds of control it never read.
 *
 * WHAT IT READS. Every module script but the suite's (tests.mjs, tests-*.mjs) and ui-kit.mjs (its builders are counted
 * where they are called), comments blanked by espree first. One SITE is one place in the source that draws a control:
 *   - a markup tag: `<button`, `<select`, `<textarea`, `<input` (type="hidden" left out), `<summary`, an `<a` with a
 *     `data-action`, and any tag with `role="tab"` or `role="button"` (inside a tag: a CSS selector's [role] is not one);
 *   - a kit builder call, found by what ui-kit.mjs exports and the file imports under any name (`slider as kitSlider`):
 *     toggle, stepper, iconButton, chip, roleButton, launcher, slider; and kitTabs, kitTabBar, modeBar, chips, whose
 *     first argument written as an array of objects is one site per object (a tab, a mode, a chip), else one site;
 *   - each `{ ... label: ... }` object of a `footer: {...}` and of a `buttons: [...]` (a footer's closing word,
 *     `close: "close"|"cancel"`, is counted apart and needs nothing: the kit draws it with no tooltip);
 *   - `document.createElement(...)` whose argument names a control tag (`cond ? "button" : "span"` included), and a
 *     call of a LOCAL WRAPPER - a function of the same file whose body calls `document.createElement(<its first
 *     parameter>)` - with a control tag as its first argument (notice-history-app.mjs `element()`, voice-panel.mjs
 *     `node()`, room-tile.mjs and voice-tile.mjs `textNode()`): one level of wrapper, no deeper.
 * HELP is read from the control's own text only:
 *   - a TOOLTIP: in a tag or a builder call or a footer object, its own `data-tooltip`, `title=` / `title:` (a whole
 *     attribute name: `data-drpg-title=` is not one), a `tooltip:` that is not "", null or undefined,
 *     `aria-describedby`, or the kit's `tipAttr(` / `tipText(`; for an element made in code, a statement on the
 *     variable it was assigned to within the next 14 lines (`<v>.title =`, `<v>.dataset.tooltip =` or `.tooltipText =`,
 *     `<v>.setAttribute("title"|"data-tooltip"|"data-tooltip-text"`, the kit's `setTip(<v>, ...)`). iconButton and
 *     launcher always carry one (their name).
 *   - a HINT LINE: a drpg-help paragraph, `helpText(`, a `*-hint` class, a `...Hint` / `.hint` key or `class="notes"`
 *     within 3 lines above to 2 below - BY PROXIMITY, not by the label or row it belongs to (the review's M2: a hint
 *     beside an unrelated control credits it too). Read as that, not as more.
 * A site with neither NEEDS one. The gate also requires every key a `tipAttr("...")` / `tipText("...")` names to have
 * words in lang/en.json and lang/pl.json: a key with none draws nothing at the table.
 *
 * WHAT IT DOES NOT READ: markup built by string concatenation across functions it cannot follow, a wrapper of a
 * wrapper, kit builders called through an object (`kit.toggle(`), `frame()`'s close button (a Close), and anything a
 * template file draws (the module has none). A site drawn many times counts once. Measured at 421f2395 before the
 * widening: about one site in ten misread (TOOLTIPS.json's five readers: 16 keys from a neighbouring line, 16 with a
 * tooltip set far from the markup, 5 hidden inputs).
 *
 * THE GATE (`check`): every site that needs help today is matched against a baseline row of the same file, unit, kind
 * and key; a site with no row left is a control drawn with no tooltip (red: give it one, or a row with its reason); a
 * row with no site left is help given and the row kept (red: cut the row). Each row needs a `why`: "none needed: <a
 * reason of 20 characters or more>" or "E<stage> C<n>: <what that commit gives it>". And no identity may count more
 * than origin/main's copy of the baseline holds (read by `git show origin/main:tools/tooltip-census.json`; when that
 * copy cannot be read, the gate says so and holds the rows alone): a row added by hand is red there. One identity is a
 * count of file, unit, kind and key, so giving one site a tooltip and adding a bare one of the same kind and key in the
 * same function nets to zero - the review's M1, left: a site has no name finer than that which survives an edit.
 * The self-check plants one site of every kind with the help it should read and wants each read as planted, so a
 * census that stopped seeing a kind is red rather than green (CLAUDE.md's `stackShapes`).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
export const BASELINE = "tools/tooltip-census.json";

const TIP = /data-tooltip|(?<![\w-])title\s*[=:]|(?<![\w-])tooltip\s*:(?!\s*(?:""|''|``|null\b|undefined\b))|aria-describedby|\btip(?:Attr|Text)\(/;
const HINT = /drpg-help|helpText\(|-hint\b|Hint["'`]|\.hint["'`]|class="notes"/;
const KEY = /DRPG\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/;
const TAGS = ["button", "input", "select", "textarea", "summary"];
/** The kit's builders a caller draws a control with; the per-item ones draw one control per object of their list. */
const KIT_ONE = ["toggle", "stepper", "iconButton", "chip", "roleButton", "launcher", "slider"];
const KIT_EACH = ["kitTabs", "kitTabBar", "modeBar", "chips"];
const ALWAYS = new Set(["iconButton", "launcher"]);
/** A row's reason: no help needed, a conditional tooltip with its condition named, or a stage's commit that gives one. */
export const WHY = /^(none needed: .{20,}|conditional: .{20,}|help in code: .{20,}|E\d{2,3} C\d+[a-z]?: .+)$/s;
/** What a kit builder other than a tab bar draws a tooltip from: its `attrs` (REVIEW-E102-code C9). */
const KIT_TIP = /data-tooltip|aria-describedby/;

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
/** The top-level `{...}` objects of an array literal's text (from its `[`), each as [start, end] offsets into `s`. */
function arrayObjects(s, open) {
    const end = balanced(s, open), out = [];
    for (let j = open + 1; j < end - 1; j++) {
        const ch = s[j];
        if (ch === '"' || ch === "'" || ch === "`") { j = skipString(s, j) - 1; continue; }
        if (ch === "{") { const e = balanced(s, j); out.push([j, e]); j = e - 1; }
        else if (ch === "[" || ch === "(") j = balanced(s, j) - 1;
    }
    return out;
}
/** From a quote or backtick at j, the index after its string (a template's `${...}` skipped whole). */
function skipString(s, j) {
    const q = s[j];
    for (let k = j + 1; k < s.length; k++) {
        if (s[k] === "\\") { k++; continue; }
        if (q === "`" && s[k] === "$" && s[k + 1] === "{") { k = balanced(s, k + 1) - 1; continue; }
        if (s[k] === q) return k + 1;
    }
    return s.length;
}
function tipOf(text) {
    if (!TIP.test(text)) return "none";
    const outside = text.replace(/\$\{[^}]*\?[^}]*:\s*(""|''|``)\s*\}/g, "");
    return TIP.test(outside) ? "always" : "conditional";
}
/** The label's key: the first DRPG key in the site's text, else the last in the 160 characters before it - never a
 *  DRPG.Tips key, which is a tooltip's words and not a label (one beside a site renamed it, REVIEW-E102-code C5's sites). */
function keyNear(src, a, b) {
    const label = k => !k.startsWith("DRPG.Tips.");
    const own = (src.slice(a, b).match(new RegExp(KEY.source, "g")) ?? []).filter(label);
    if (own.length) return own[0];
    const before = (src.slice(Math.max(0, a - 160), a).match(new RegExp(KEY.source, "g")) ?? []).filter(label);
    return before.length ? before[before.length - 1] : null;
}
const reEsc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The names this file calls the kit's builders by: local name -> the kit's name. */
function kitNames(s) {
    const names = new Map();
    for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']\.\/ui-kit\.mjs["']/g)) {
        for (const part of m[1].split(",")) {
            const [own, as] = part.trim().split(/\s+as\s+/);
            if (KIT_ONE.includes(own) || KIT_EACH.includes(own)) names.set((as ?? own).trim(), own);
        }
    }
    return names;
}

/** The file's local wrappers around createElement: function name -> true, read from the AST. */
function wrappersOf(ast) {
    const out = new Set();
    const visit = node => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        const fn = node.type === "FunctionDeclaration" ? node
            : node.type === "VariableDeclarator" && /Function/.test(node.init?.type ?? "") ? { id: node.id, params: node.init.params, body: node.init.body } : null;
        const first = fn?.params?.[0]?.type === "Identifier" ? fn.params[0].name : fn?.params?.[0]?.left?.name;
        if (fn?.id?.name && first) {
            let found = false;
            const look = n => {
                if (found || !n || typeof n !== "object") return;
                if (Array.isArray(n)) { n.forEach(look); return; }
                if (n.type === "CallExpression" && n.callee?.type === "MemberExpression" && n.callee.property?.name === "createElement"
                    && n.callee.object?.name === "document" && n.arguments?.[0]?.type === "Identifier" && n.arguments[0].name === first) found = true;
                for (const k of Object.keys(n)) if (k !== "parent" && k !== "loc" && k !== "range") look(n[k]);
            };
            look(fn.body);
            if (found) out.add(fn.id.name);
        }
        for (const k of Object.keys(node)) if (k !== "parent" && k !== "loc" && k !== "range") visit(node[k]);
    };
    visit(ast);
    return out;
}

/** The control sites of one file's source. */
export function scan(file, raw, es = espree()) {
    const s = blank(raw, es), lines = s.split("\n"), sites = [];
    const hintNear = line => lines.slice(Math.max(0, line - 4), line + 3).some(l => HINT.test(l));
    let units = [], wrappers = new Set();
    try {
        const ast = es.parse(raw, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true });
        units = ast.body.map(n => {
            const d = n.declaration ?? n;
            return { name: d.id?.name ?? d.declarations?.[0]?.id?.name ?? `@${n.loc.start.line}`, from: n.loc.start.line, to: n.loc.end.line };
        });
        wrappers = wrappersOf(ast);
    } catch { /* unit names left empty, no wrappers read */ }
    const unitOf = line => units.find(u => u.from <= line && line <= u.to)?.name ?? null;
    const context = (line, after = 3) => raw.split("\n").slice(Math.max(0, line - 3), line + after).join("\n").slice(0, 700);
    const push = (kind, a, b, extra = {}) => {
        const line = lineOf(s, a);
        sites.push({ file, line, kind, tip: extra.tip ?? tipOf(s.slice(a, b)), hint: hintNear(line), key: keyNear(s, a, b),
            closing: Boolean(extra.closing), unit: unitOf(line), context: context(line) });
    };
    /** An element made in code at `at`, assigned to a variable or not: its help is a statement on that variable. */
    const pushElement = (kind, at, end) => {
        const line = lineOf(s, at), after = lines.slice(line - 1, line + 14).join("\n");
        const v = s.slice(Math.max(0, at - 120), at).match(/(?:const|let|var)\s+(\w+)\s*=\s*$|(?<![\w.])(\w+)\s*=\s*$/);
        const name = v?.[1] ?? v?.[2] ?? null;
        const helped = name && new RegExp(`(?<![\\w.])${reEsc(name)}\\.(?:title\\s*=|dataset\\.tooltip(?:Text)?\\s*=|setAttribute\\(\\s*["'](?:title|data-tooltip(?:-text)?)["'])|(?<![\\w.])setTip\\(\\s*${reEsc(name)}\\s*,`).test(after);
        sites.push({ file, line, kind, tip: helped ? "always" : "none", hint: hintNear(line), key: keyNear(s, at, end + after.length), closing: false,
            unit: unitOf(line), context: context(line, 8) });
    };
    // markup tags
    for (const m of s.matchAll(/<(button|select|textarea|input|summary)\b/g)) {
        const b = tagEnd(s, m.index), text = s.slice(m.index, b);
        if (m[1] === "input" && /type\s*=\s*["']hidden/.test(text)) continue;
        const kind = m[1] === "input" ? (text.match(/type\s*=\s*["'](checkbox|radio)/)?.[1] ?? "input") : m[1];
        push(kind, m.index, b);
    }
    for (const m of s.matchAll(/<a\b/g)) {
        const b = tagEnd(s, m.index);
        if (/\sdata-action\s*=/.test(s.slice(m.index, b))) push("a", m.index, b);
    }
    for (const m of s.matchAll(/role\s*=\s*["'](tab|button)["']/g)) {
        const a = s.lastIndexOf("<", m.index);
        if (a < 0 || /[>\]\[]/.test(s.slice(a, m.index)) || m.index - a > 400) continue;
        if (/^<(button|select|textarea|input|summary)\b/.test(s.slice(a, a + 10)) || /^<a\b/.test(s.slice(a, a + 3)) && /\sdata-action\s*=/.test(s.slice(a, tagEnd(s, a)))) continue;
        push(m[1], a, tagEnd(s, a));
    }
    // kit builders, by the names this file imports them under
    const kit = kitNames(s);
    if (kit.size) {
        const callRe = new RegExp(`(?<![.\\w])(${[...kit.keys()].map(reEsc).join("|")})\\(`, "g");
        for (const m of s.matchAll(callRe)) {
            const pre = s.slice(Math.max(0, m.index - 12), m.index);
            if (/function\s*$|export\s*$/.test(pre) || /import\s*\{[^}]*$/.test(s.slice(Math.max(0, m.index - 300), m.index))) continue;
            const own = kit.get(m[1]), open = m.index + m[1].length, b = balanced(s, open);
            if (own === "slider") { pushElement("kit:slider", m.index, b); continue; }
            if (KIT_EACH.includes(own)) {
                let at = open + 1;
                while (/\s/.test(s[at])) at++;
                const items = s[at] === "[" ? arrayObjects(s, at) : [];
                // a tab draws its section's `tooltip` (tabNav); a mode draws only its label; a chip only its attrs (C9)
                if (items.length) {
                    for (const [x, y] of items) {
                        const text = s.slice(x, y);
                        push(`kit:${own}-item`, x, y, own === "modeBar" ? { tip: "none" } : own === "chips" ? { tip: KIT_TIP.test(text) ? "always" : "none" } : {});
                    }
                    continue;
                }
            }
            push(`kit:${own}`, m.index, b, ALWAYS.has(own) ? { tip: "always" } : { tip: KIT_TIP.test(s.slice(m.index, b)) ? "always" : "none" });
        }
    }
    // footer objects and DialogV2 buttons
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
    // elements made in code: createElement with a control tag (a conditional's literal included), and local wrappers
    for (const m of s.matchAll(/document\.createElement\(/g)) {
        const open = m.index + m[0].length - 1, b = balanced(s, open), arg = s.slice(open + 1, b - 1);
        const tag = TAGS.find(t => new RegExp(`["']${t}["']`).test(arg));
        if (tag) pushElement(`dom:${tag}`, m.index, b);
    }
    if (wrappers.size) {
        const callRe = new RegExp(`(?<![.\\w])(${[...wrappers].map(reEsc).join("|")})\\(\\s*["'](${TAGS.join("|")})["']`, "g");
        for (const m of s.matchAll(callRe)) pushElement(`dom:${m[2]}`, m.index, m.index + m[0].length);
    }
    // A tooltip shown only under a condition is no help until its row names the condition (REVIEW-E102-code C1: a planted
    // `${tipAttr(...) ? "" : ""}` read as help and drew nothing): it needs a row "conditional: <the condition>".
    for (const site of sites) site.needs = !site.closing && site.tip !== "always" && !site.hint;
    return sites;
}

/** Every module script's sites. */
export function census(repo = REPO) {
    const dir = path.join(repo, "scripts"), es = espree(repo);
    return fs.readdirSync(dir).filter(f => f.endsWith(".mjs") && !/^tests(-|\.mjs$)/.test(f) && f !== "ui-kit.mjs").sort()
        .flatMap(f => scan(`scripts/${f}`, fs.readFileSync(path.join(dir, f), "utf8"), es));
}

export const identity = s => `${s.file}|${s.unit ?? ""}|${s.kind}|${s.key ?? ""}`;
const countOf = (rows, id = identity) => {
    const n = new Map();
    for (const r of rows) n.set(id(r), (n.get(id(r)) ?? 0) + (r.count ?? 1));
    return n;
};
/* AGAINST MAIN'S COPY A ROW IS ITS FUNCTION'S, NOT ITS FILE'S (E54, 13.11.2026). A file split by pure moves (E54's cuts:
   sheet.mjs into nine files, investigation.mjs, chapter.mjs, cleanup.mjs) carries each row to the file its function now
   stands in, and by `identity` that row was one main's copy did not hold: every moved row read as "a row added here"
   until the split was on main (five of the sheet's eight on 1.2.112). A row with a unit is counted by its unit, kind and
   key; a top-level one (no unit) keeps its file, so two files' top-level sites never stand in for each other. */
const mainIdentity = s => (s.unit ? `${s.unit}|${s.kind}|${s.key ?? ""}` : identity(s));

/** Today's sites that need help against the baseline's rows (and main's copy, when given): the problems, one line each. */
export function compare(sites, rows, mainRows = null) {
    const left = countOf(rows), problems = [];
    for (const r of rows) if (!WHY.test(String(r.why ?? ""))) problems.push(`${BASELINE}: the row ${identity(r).replace(/\|/g, " ")} has no reason ("none needed: ..." of 20 characters or more, or "E<stage> C<n>: ...")`);
    for (const s of sites.filter(x => x.needs)) {
        const id = identity(s), n = left.get(id) ?? 0;
        if (n > 0) left.set(id, n - 1);
        else if (s.tip === "conditional") problems.push(`${s.file}:${s.line} (${s.unit ?? "top level"}) draws a ${s.kind} whose tooltip shows only under a condition: name the condition in a row of ${BASELINE} ("conditional: ..."), or draw it always`);
        else problems.push(`${s.file}:${s.line} (${s.unit ?? "top level"}) draws a ${s.kind} with no tooltip and no hint${s.key ? ` near ${s.key}` : ""}: give it one (ui-kit.mjs tipAttr), or a row in ${BASELINE} with its reason`);
    }
    for (const [id, n] of left) if (n > 0) problems.push(`${BASELINE} keeps ${n} row(s) of ${id.replace(/\|/g, " ")} that no site needs any more: cut ${n === 1 ? "it" : "them"}, so the baseline only shrinks`);
    if (mainRows) {
        const main = countOf(mainRows, mainIdentity);
        for (const [id, n] of countOf(rows, mainIdentity)) if (n > (main.get(id) ?? 0)) problems.push(`${BASELINE} holds ${n} of ${id.replace(/\|/g, " ")} where origin/main's copy holds ${main.get(id) ?? 0}: a row added here hides a control with no help - give it a tooltip instead`);
    }
    return problems;
}

/**
 * HELP IN CODE (REVIEW-E102-code C3): a row "help in code: ..." is a control whose tooltip is written where the census
 * cannot follow (a paint function, a helper, a state change), and it carries `held: { fn, pattern }` - the function of
 * its file that writes the help and a pattern of that line. The gate reads the function (a top-level declaration, to
 * the next one) and wants the pattern there, so losing that help is red, where a "none needed" row would have hidden it.
 */
export function heldProblems(rows, repo = REPO) {
    const out = [];
    for (const r of rows.filter(x => /^help in code: /.test(String(x.why ?? "")))) {
        const where = `${BASELINE}: ${identity(r).replace(/\|/g, " ")}`;
        if (!r.held?.fn || !r.held?.pattern) { out.push(`${where} says its help is in code and names no held { fn, pattern }`); continue; }
        let src = "";
        try { src = fs.readFileSync(path.join(repo, r.file), "utf8"); } catch { out.push(`${where}: ${r.file} could not be read`); continue; }
        const at = src.search(new RegExp(`^(?:export )?(?:async )?function ${r.held.fn}\\(`, "m"));
        if (at < 0) { out.push(`${where}: ${r.file} declares no top-level function ${r.held.fn}() - point held.fn at the code again`); continue; }
        const rest = src.slice(at + 1), next = rest.search(/^(?:export )?(?:async )?function |^const \w+ = \{|^export const /m);
        const body = src.slice(at, next < 0 ? src.length : at + 1 + next);
        if (!new RegExp(r.held.pattern).test(body)) out.push(`${where}: its help is gone from ${r.held.fn}() (no ${r.held.pattern}) - give the control its tooltip again, or a row with another reason`);
    }
    return out;
}

/** Every key a script names to tipAttr / tipText, and the ones with no words in either language file. */
export function missingTipKeys(repo = REPO) {
    const words = (o, k) => k.split(".").reduce((x, p) => (x && typeof x === "object" ? x[p] : undefined), o);
    const en = JSON.parse(fs.readFileSync(path.join(repo, "lang", "en.json"), "utf8"));
    const pl = JSON.parse(fs.readFileSync(path.join(repo, "lang", "pl.json"), "utf8"));
    const dir = path.join(repo, "scripts"), named = new Map();
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".mjs") && !/^tests(-|\.mjs$)/.test(x))) {
        for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/\btip(?:Attr|Text)\(\s*["'`](DRPG\.[^"'`]+)["'`]/g)) named.set(m[1], f);
    }
    const bad = [...named].filter(([k]) => ![en, pl].every(l => typeof words(l, k) === "string" && words(l, k).trim()));
    return { named: named.size, bad: bad.map(([k, f]) => `scripts/${f} draws ${k}, which has no words in lang/en.json or lang/pl.json: the control shows no tooltip`) };
}

/** The planted sites, one of every kind, each with the help it should read: [unit, kind, needs]. */
export const PLANTS = [
    ["a1", 'export function a1() { return `<button type="button">${game.i18n.localize("DRPG.X.go")}</button>`; }', [["a1", "button", true]]],
    ["a2", 'export function a2() { return `<button type="button"${tipAttr("DRPG.Tips.X.goTooltip")}>Go</button>`; }', [["a2", "button", false]]],
    ["a3", 'export function a3() { return `<button type="button" data-drpg-title="k">Go</button>`; }', [["a3", "button", true]]],
    ["a4", 'export function a4() { return `<select name="s"></select><textarea name="t"></textarea>`; }', [["a4", "select", true], ["a4", "textarea", true]]],
    ["a5", 'export function a5() { return `${helpText("DRPG.X.nameHint")}<input type="text" name="n"><input type="hidden" name="h">`; }', [["a5", "input", false]]],
    ["a6", 'export function a6() { return `<summary>Go</summary><a class="x" data-action="go">x</a><span role="button">x</span><div role="tab">x</div>`; }', [["a6", "summary", true], ["a6", "a", true], ["a6", "button", true], ["a6", "tab", true]]],
    ["b1", 'export function b1() { return drpgWindow({ footer: { right: [{ role: "primary", label: "DRPG.X.save", action: "save" }] } }); }', [["b1", "footer", true]]],
    ["b2", 'export function b2() { return drpgWindow({ footer: { right: [{ role: "primary", label: "DRPG.X.save", action: "save", tooltip: tipText("DRPG.Tips.X.saveTooltip") }] } }); }', [["b2", "footer", false]]],
    ["b3", 'export function b3() { return drpgWindow({ footer: { right: [{ role: "primary", label: "DRPG.X.save", action: "save", tooltip: "" }] } }); }', [["b3", "footer", true]]],
    ["b4", 'export function b4() { return DialogV2.wait({ buttons: [{ action: "ok", label: "DRPG.X.ok" }] }); }', [["b4", "footer", true]]],
    ["c1", 'export function c1() { return stepper({ name: "n" }) + toggle({ name: "t", label: "T", attrs: { "data-tooltip": tipText("DRPG.Tips.X.tTooltip") } }) + iconButton({ label: "L" }); }', [["c1", "kit:stepper", true], ["c1", "kit:toggle", false], ["c1", "kit:iconButton", false]]],
    ["c2", 'export function c2() { return kitSlider({ className: "v" }); }', [["c2", "kit:slider", true]]],
    ["c3", 'export function c3() { return kitTabs([{ key: "a", label: "A", tooltip: tipText("DRPG.Tips.X.aTooltip") }, { key: "b", label: "B" }]) + modeBar(MODES); }', [["c3", "kit:kitTabs-item", false], ["c3", "kit:kitTabs-item", true], ["c3", "kit:modeBar", true]]],
    ["d1", 'export function d1() { const b = document.createElement("button"); b.dataset.tooltip = tipText("DRPG.Tips.X.bTooltip"); return b; }', [["d1", "dom:button", false]]],
    ["d2", 'export function d2() { const b = document.createElement("button"); const h = document.createElement("h3"); h.title = "x"; return [b, h]; }', [["d2", "dom:button", true]]],
    ["d3", 'export function d3(x) { return document.createElement(x ? "button" : "span"); }', [["d3", "dom:button", true]]],
    ["d5", 'export function d5() { const b = document.createElement("button"); b.dataset.tooltipText = "x"; return b; }', [["d5", "dom:button", false]]],
    ["d6", 'export function d6() { const b = document.createElement("button"); setTip(b, "DRPG.Tips.X.bTooltip"); return b; }', [["d6", "dom:button", false]]],
    ["c4", 'export function c4() { return toggle({ name: "t", label: "T", title: "x" }) + modeBar([{ key: "a", label: "A", tooltip: "x" }]); }', [["c4", "kit:toggle", true], ["c4", "kit:modeBar-item", true]]],
    ["a7", 'export function a7() { return `<select name="s"${tipAttr("DRPG.Tips.X.sTooltip") ? "" : ""}></select>`; }', [["a7", "select", true]]],
    ["d4", 'function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }\nexport function d4() { const go = el("button", "go"); return go; }', [["d4", "dom:button", true]]]
];
export const PLANT_HEAD = 'import { stepper, toggle, iconButton, slider as kitSlider, kitTabs, modeBar, tipAttr, tipText } from "./ui-kit.mjs";';

/** The planted pairs: each must be read as planted, or the census measures nothing. Returns { misses, planted }. */
export function selfCheck(es = espree()) {
    const src = [PLANT_HEAD, ...PLANTS.map(p => p[1])].join("\n\n\n\n\n\n\n\n");   // eight lines apart: a hint line counts within three
    const got = scan("scripts/plant.mjs", src, es).map(x => `${x.unit}:${x.kind}:${x.needs}`);
    const want = PLANTS.flatMap(p => p[2]).map(w => w.join(":"));
    const left = [...got], misses = [];
    for (const w of want) {
        const i = left.indexOf(w);
        if (i >= 0) left.splice(i, 1);
        else misses.push(`self-check: the planted ${w.split(":")[1]} in ${w.split(":")[0]}() was not read as ${w.endsWith("true") ? "needing help" : "helped"}`);
    }
    for (const g of left) misses.push(`self-check: read a site that was not planted as one: ${g}`);
    return { misses, planted: want.length };
}

/** origin/main's baseline rows, or null with the reason when that copy cannot be read. */
function mainBaseline(repo) {
    try {
        const text = execFileSync("git", ["-C", repo, "show", `origin/main:${BASELINE}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        return { rows: JSON.parse(text).rows ?? [] };
    } catch { return { rows: null, why: `origin/main has no ${BASELINE} here (not fetched, or not merged yet)` }; }
}

/** A row a stage promised to fill ("E<stage> C<n>: ...") is red once tools/stages.json says that stage shipped. */
async function stagesLib(repo) { return import(url.pathToFileURL(path.join(repo, "tools", "stages.mjs")).href); }
let shippedIds = null;
function shippedRows(rows, repo) {
    if (!shippedIds) return [];
    return rows.filter(r => shippedIds.has(String(r.why ?? "").match(/^(E\d{2,3}) C/)?.[1])).map(r =>
        `${BASELINE}: ${identity(r).replace(/\|/g, " ")} is still to be given its tooltip by ${r.why.split(":")[0]}, and that stage has shipped`);
}
/** Read once before `check`: which stages tools/stages.json says shipped (the gate stays synchronous). */
export async function loadShipped(repo = REPO) {
    try {
        const S = await stagesLib(repo), doc = S.loadStages(repo), mod = S.moduleVersion(repo);
        shippedIds = new Set(doc.stages.filter(st => S.isShipped(st, mod)).map(st => st.id));
    } catch { shippedIds = null; }
    return shippedIds;
}

/** The gate, as `node tools/check.mjs tooltips` runs it. */
export function check(log = console.log, repo = REPO) {
    const { misses, planted } = selfCheck(espree(repo));
    const sites = census(repo);
    let base;
    try { base = JSON.parse(fs.readFileSync(path.join(repo, BASELINE), "utf8")); }
    catch (err) { return [...misses, `${BASELINE} could not be read (${err.message})`]; }
    const rows = base.rows ?? [], main = mainBaseline(repo), keys = missingTipKeys(repo);
    const problems = [...compare(sites, rows, main.rows), ...keys.bad, ...shippedRows(rows, repo), ...heldProblems(rows, repo)];
    const need = sites.filter(s => s.needs).length, kept = rows.reduce((a, r) => a + (r.count ?? 1), 0);
    const reasons = rows.filter(r => /^(none needed|conditional|help in code): /.test(String(r.why ?? ""))).reduce((a, r) => a + (r.count ?? 1), 0);
    const held = rows.filter(r => /^help in code: /.test(String(r.why ?? ""))).length;
    log(`tooltips: ${sites.filter(s => !s.closing).length} control site(s) in ${new Set(sites.map(s => s.file)).size} file(s), `
        + `${need} with no tooltip and no hint; baseline ${kept} (${reasons} with a reason, ${kept - reasons} still to give one); `
        + (main.rows ? `main's copy ${main.rows.reduce((a, r) => a + (r.count ?? 1), 0)} row count(s) held; `
            // Loud on purpose (REVIEW-E102-code C2): CI's checkouts have no origin/main (.github/workflows/ci.yml fetches only
            // the commit, and changing that is the owner's call), so there the growth guard does not run; this says so.
            : `MAIN'S COPY NOT READ, so the guard on rows added by hand DID NOT RUN (${main.why}); `)
        + `${held} row(s) of help in code read where they say; ${keys.named} tooltip key(s) named, ${keys.bad.length} with no words; self-check ${planted - misses.length}/${planted} planted site(s) read; `
        + `${problems.length + misses.length} problem(s)`);
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
