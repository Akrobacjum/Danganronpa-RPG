/**
 * Danganronpa RPG - the text lint: what the module says, read as data (E65, 31.10.2026).
 * ---------------------------------------------------------------------------
 * Pure detectors over the module's words - the two language files flattened,
 * config.mjs's English prose - each answering what it found and how much it
 * read. `node tools/check.mjs text` runs them in Node over the files on disk
 * (the ci layer, through `npm test`'s check part), and the suite runs the same
 * functions at a table: R1058 shows each its fixture, R1059 runs the FAIL ones
 * that need nothing but the served language files. So the Node check and the
 * suite cannot disagree about what a finding is.
 *
 * NO IMPORTS, AND NO FOUNDRY GLOBAL, for the reason tests-lint.mjs has none:
 * tools/check.mjs runs in bare Node, where the kit cannot be loaded (it imports
 * settings.mjs, which throws "Hooks is not defined" outside Foundry). The kit
 * imports this file and hands its names on, which is also how the source crawl
 * (moduleSources) reaches it - and, being a suite file (`isSuiteFile`), it is
 * never read by the module-wide scans (otherSources), so its fixtures are not
 * findings. Its own file, not tests-lint.mjs's: that file reads the suite's
 * code against the test author contract; this one reads the module's text
 * against the text rules (docs/text-style.md from E65 C5), and the two grow
 * with different stages.
 *
 * THE CONTRACT, the shape every detector here keeps:
 *   - it takes one plain object of inputs - `en` and `pl` (Maps, key to value, as
 *     `flatLang` gives them), `prose` (config.mjs's English prose by its
 *     `DRPG.Config.*` key, as i18n-config.mjs `walkConfigProse` visits it),
 *     `scripts` and `docs` (Maps, a file's path from the repository's root to
 *     its text: the module's scripts without the suite's, the .md files under
 *     docs/) and `lexer` (tests-lint.mjs's `blankComments`, `blankLiterals` and
 *     `callArgs`, below) - and reads only the ones it needs, so check.mjs and a
 *     tier hand every detector the same bag;
 *   - it returns `{ found, read }`: each finding `{ key, kind, what }` (`what` a
 *     sentence somebody can act on), and `read` how many candidates it looked
 *     at, the positive control: a detector that read nothing has proved nothing;
 *   - FIXTURES holds an input for it with its findings known, as `"<key> <kind>"`
 *     items, passing cases beside failing ones (a detector that flags everything
 *     proves as little as one that flags nothing); `selfCheck` runs each on its
 *     fixture before anything trusts it on the real files;
 *   - MODES says whether a finding of it is red ("fail") or printed ("report"),
 *     from which stage it is red (`fail`: E65 for the plan's five, a later stage
 *     for a report that turns), and which inputs it reads (`reads`), so a tier
 *     runs only what it can hand it.
 * At E65 C1 three detectors, all FAIL: T1 in two halves (`pluralForms`,
 * `configPlaceholders`) and T2 (`pairParity`). Measured on 99226e59 (31.10.2026,
 * a probe in the stage folder) before they were written: 168 English plural
 * families, each with its four Polish forms; 515 prose strings of config.mjs,
 * none with a placeholder its Polish twin lacks or adds; 4438 keys in both files,
 * none with another set of placeholders or HTML tags in Polish; 336 Polish
 * .few/.many forms, each with its .other's placeholders. So all three are FAIL
 * from the first day with no baseline, which is the plan's reason for them.
 * At E65 C2 two more, FAIL with a baseline that only shrinks (BASELINES): T3
 * (`familyFormats`, a plural family formatted as if it were a sentence) and T6
 * (`dashesIn`, an en dash, em dash or minus sign where the module speaks). At
 * C3 T14 (`tableWordProblems`, an item table's words against what they were,
 * FAIL with no baseline), its bag `words` (config.mjs TABLE_NAME_WORDS) and
 * the two legacy lists (`legacyListsFrom` over tables.mjs's text). At C4 the
 * glossary's two, both report: T8 (`glossaryHits`, a forbidden variant where a
 * docs/glossary.json entry holds) and T28 (`retiredHits`, a retired name where it
 * is retired, with the owner's A10 and A11 rules as `passageWords` and
 * `friskWords`), each splitting what it finds by the stage of the row that finds
 * it - debt where that stage has shipped, the rest not yet due - and
 * `glossarySchema`, which holds the file itself (red in `text`: a file E65 writes).
 * Their bag: `glossary` (the parsed file) and `shipped` (the ids of the stages that
 * have shipped, by tools/stages.mjs's rule, handed in like the lexer). At C5
 * `budgetsSchema`, which holds docs/text-budgets.json (the surfaces' targets and
 * limits of docs/text-style.md, the key-to-surface rules, the allow list) as
 * `glossarySchema` holds the glossary - red in `text`; its reader is T4 (E65 C6).
 *
 * WHAT IS NOT A TAG. `&nbsp;` and every other entity (none in either file on
 * 31.10, a fixture case so it stays so); `<-`, which DRPG.Music.diag.wins writes
 * in both languages as an arrow; a tag's attributes, which a translation may
 * change (a title). A tag is `<name ...>` or `</name>`, name a letter first.
 */

/** A language file's keys and values, flat, the way Foundry's expandObject reads dotted keys (tools/check.mjs `langEntries`). */
export function flatLang(obj) {
    const out = new Map();
    const walk = (o, p) => {
        for (const [k, v] of Object.entries(o ?? {})) {
            const key = p ? `${p}.${k}` : k;
            if (typeof v === "object" && v !== null) walk(v, key); else out.set(key, v);
        }
    };
    walk(obj, "");
    return out;
}

/** A Map as it is, a plain object of flat keys as a Map: fixtures are written as objects. */
const asMap = x => x instanceof Map ? x : new Map(Object.entries(x ?? {}));

/** The `{name}` placeholders of a string, each once, sorted; `except` leaves some out (`{a}`, as `parity` does). */
export function placeholders(text, { except = [] } = {}) {
    return [...new Set(String(text ?? "").match(/\{\w+\}/g) ?? [])].filter(p => !except.includes(p)).sort();
}

/** The HTML tags of a string as `b` and `/b`, every one counted, sorted; attributes and entities are not read. */
export function htmlTags(text) {
    return [...String(text ?? "").matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^<>]*>/gi)].map(m => `${m[1]}${m[2].toLowerCase()}`).sort();
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const shown = list => list.length ? list.join(" ") : "none";

/* ------------------------------- T1, T2 ------------------------------------ */

/**
 * T1, its first half (plan, S13-58): every English plural family - a key ending
 * `.one` or `.other` - has both English forms and the four Polish ones, `.one`,
 * `.few`, `.many` and `.other`. The rule `node tools/check.mjs parity` already
 * holds (CLAUDE.md, "Every English key needs a Polish twin"); here so that the
 * text lint states it and a tier holds it on the files a table serves. A Polish
 * `.few`/`.many` with no English family is not this detector's (none on 31.10).
 */
export function pluralForms({ en, pl } = {}) {
    const E = asMap(en), P = asMap(pl);
    const families = [...new Set([...E.keys()].filter(k => /\.(one|other)$/.test(k)).map(k => k.replace(/\.(one|other)$/, "")))];
    const found = [];
    for (const f of families) {
        for (const form of ["one", "other"]) {
            if (!E.has(`${f}.${form}`)) found.push({ key: `${f}.${form}`, kind: "en", what: `en.json lacks ${f}.${form}, a form of the plural family ${f}` });
        }
        for (const form of ["one", "few", "many", "other"]) {
            if (!P.has(`${f}.${form}`)) found.push({ key: `${f}.${form}`, kind: "pl", what: `pl.json lacks ${f}.${form}, a Polish form of the plural family ${f}` });
        }
    }
    return { found, read: families.length };
}

/**
 * T1, its second half (plan, S13-58's other half): every `DRPG.Config.*` value
 * in pl.json has exactly the placeholders of config.mjs's English prose for that
 * key - none dropped, none added. en.json holds no `DRPG.Config.*` (config.mjs is
 * the English), so `parity` cannot read these, and `prose` counts only that the
 * keys are there. A key the Polish file lacks is `prose`'s, and not read here.
 * Exactly: no `{a}` set aside, because config.mjs's prose holds none (31.10).
 */
export function configPlaceholders({ prose, pl } = {}) {
    const C = asMap(prose), P = asMap(pl);
    const found = [];
    let read = 0;
    for (const [key, english] of C) {
        const polish = P.get(key);
        if (typeof polish !== "string" || typeof english !== "string") continue;
        read++;
        const a = placeholders(english), b = placeholders(polish);
        const dropped = a.filter(p => !b.includes(p)), extra = b.filter(p => !a.includes(p));
        if (dropped.length) found.push({ key, kind: "dropped", what: `pl.json ${key} drops ${dropped.join(" ")}, which config.mjs's English has` });
        if (extra.length) found.push({ key, kind: "extra", what: `pl.json ${key} adds ${extra.join(" ")}, which config.mjs's English does not fill` });
    }
    return { found, read };
}

/**
 * T2 (plan): every key both files hold says the same placeholders - `{a}` set
 * aside on both sides, as `parity` sets it aside - and the same HTML tags, each
 * as often; `parity` reads only a placeholder Polish drops, never one it adds,
 * and no tags. Then every Polish `.few` and `.many` (keys en.json never has)
 * holds the placeholders of its family's `.other`, the English one where there
 * is one (it is the one the code fills), else the Polish.
 */
export function pairParity({ en, pl } = {}) {
    const E = asMap(en), P = asMap(pl);
    const found = [];
    let read = 0;
    const except = ["{a}"];
    for (const [key, english] of E) {
        const polish = P.get(key);
        if (typeof english !== "string" || typeof polish !== "string") continue;
        read++;
        const a = placeholders(english, { except }), b = placeholders(polish, { except });
        if (!same(a, b)) found.push({ key, kind: "placeholders", what: `${key}: en.json fills ${shown(a)}, pl.json ${shown(b)}` });
        const ta = htmlTags(english), tb = htmlTags(polish);
        if (!same(ta, tb)) found.push({ key, kind: "tags", what: `${key}: en.json has the tags ${shown(ta)}, pl.json ${shown(tb)}` });
    }
    for (const [key, polish] of P) {
        const m = key.match(/^(.*)\.(few|many)$/);
        if (!m || E.has(key) || typeof polish !== "string") continue;
        const other = E.has(`${m[1]}.other`) ? E.get(`${m[1]}.other`) : P.get(`${m[1]}.other`);
        if (typeof other !== "string") continue;
        read++;
        const a = placeholders(other, { except }), b = placeholders(polish, { except });
        if (!same(a, b)) found.push({ key, kind: "plural", what: `pl.json ${key} fills ${shown(b)}, and its family's .other ${shown(a)}` });
    }
    return { found, read };
}

/* ------------------------------ the code reader ----------------------------- */

/**
 * THE LEXER IS HANDED IN, NOT COPIED (E65 C2). T3 and T6 read scripts, and a
 * script is read right only with its comments, strings, templates and regex
 * literals told apart - what tests-lint.mjs `blankComments`, `blankLiterals`
 * and `callArgs` do, and what the contract's detectors and R201 already trust.
 * A copy here would be a second lexer to keep in step, and an import would
 * break this file's first rule. So a detector that reads code takes the three
 * as `lexer` in its bag: tools/check.mjs hands tests-lint.mjs's, a tier the
 * kit's (the same functions, re-exported), and selfCheck hands each fixture the
 * `tools` it is given. A detector handed none throws, which selfCheck reports.
 */
function lexerOf(bag, name) {
    const x = bag?.lexer;
    if (typeof x?.blankComments !== "function" || typeof x?.blankLiterals !== "function" || typeof x?.callArgs !== "function") {
        throw new Error(`${name} reads code and was handed no lexer ({ blankComments, blankLiterals, callArgs } of tests-lint.mjs)`);
    }
    return x;
}

const lineOf = (text, at) => text.slice(0, at).split("\n").length;

/**
 * The literals of a script whose comments are blanked (`code`), as
 * `[{ start, end, kind }]`: "string", "regex", or "template" - one piece of a
 * template's text, from its backtick or from the "}" that closes a `${...}`, to
 * the next backtick or `${`, so the code of a `${...}` is read as code and a
 * string inside it as a string. `blank` is `blankLiterals(code)`: a literal
 * begins where the two first differ, and its first character is always a
 * quote, a backtick, that "}" or a regex's "/" (blankLiterals keeps every other
 * brace and every division's slash); from there it is read by the rule
 * blankLiterals reads it by.
 */
export function literalSpans(code, blank) {
    const spans = [];
    let i = 0;
    while (i < code.length) {
        const c = code[i];
        if (c === blank[i]) { i++; continue; }
        let j = i + 1, kind;
        if (c === "\"" || c === "'") {
            kind = "string";
            while (j < code.length && code[j] !== c && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1;
            j++;
        } else if (c === "`" || c === "}") {
            kind = "template";
            while (j < code.length) {
                if (code[j] === "\\") { j += 2; continue; }
                if (code[j] === "`") { j++; break; }
                if (code[j] === "$" && code[j + 1] === "{") { j += 2; break; }
                j++;
            }
        } else if (c === "/") {
            kind = "regex";
            let inClass = false;
            while (j < code.length && code[j] !== "\n") {
                if (code[j] === "\\") { j += 2; continue; }
                if (code[j] === "[") inClass = true;
                else if (code[j] === "]") inClass = false;
                else if (code[j] === "/" && !inClass) break;
                j++;
            }
            j++;
            while (/[a-z]/.test(code[j] ?? "")) j++;
        } else { i++; continue; }
        j = Math.min(j, code.length);
        spans.push({ start: i, end: j, kind });
        i = j;
    }
    return spans;
}

/** A literal's text between its delimiters, with `\uXXXX` and `\u{...}` read as the characters they write. */
function literalText(code, span) {
    const raw = code.slice(span.start + 1, span.end).replace(span.kind === "template" ? /(?:`|\$\{)$/ : /["']$/, "");
    return raw.replace(/\\(\\|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4})/g, (m, e) => (e === "\\" ? m : String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ""), 16))));
}

/* A "?" at `k` of blanked code that is a conditional's, not "?." or "??" (either half). */
const isConditional = (blank, k) => blank[k] === "?" && blank[k + 1] !== "?" && blank[k - 1] !== "?"
    && !(blank[k + 1] === "." && !/\d/.test(blank[k + 2] ?? ""));

/**
 * What an expression of code[start, end) can be, as a key: `[{ value, at }]` for
 * a literal (a string, or a template with no `${...}`), `{ template: true }` for
 * a template that builds the key, `{ other: true }` for anything else (a name, a
 * call, a concatenation) - and for a conditional `c ? a : b`, what each branch
 * can be, nested conditionals and brackets around it read through. The
 * condition is not a branch.
 */
function branchesOf(code, blank, spans, start, end) {
    while (start < end && /\s/.test(code[start])) start++;
    while (end > start && /\s/.test(code[end - 1])) end--;
    if (start >= end) return [];
    const top = [];
    let depth = 0, wrapped = blank[start] === "(";
    for (let k = start; k < end; k++) {
        const c = blank[k];
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") { depth--; if (depth === 0 && k < end - 1) wrapped = false; }
        else if (depth === 0 && (c === ":" || isConditional(blank, k))) top.push(k);
    }
    if (wrapped) return branchesOf(code, blank, spans, start + 1, end - 1);    // "(a ? b : c)", not "(a) ? b : c"
    const q = top.find(k => blank[k] === "?");
    if (q !== undefined) {
        let nest = 0, colon = -1;
        for (const k of top.filter(k => k > q)) {
            if (blank[k] === "?") nest++;
            else if (nest === 0) { colon = k; break; } else nest--;
        }
        if (colon < 0) return [{ other: true }];
        return [...branchesOf(code, blank, spans, q + 1, colon), ...branchesOf(code, blank, spans, colon + 1, end)];
    }
    const span = spans.get(start);
    if (span && span.end === end && span.kind === "string") return [{ value: literalText(code, span), at: start }];
    if (span && span.kind === "template" && code[start] === "`") {
        return span.end === end && code[end - 1] === "`" ? [{ value: literalText(code, span), at: start }] : [{ template: true }];
    }
    return [{ other: true }];
}

/* ---------------------------------- T3 ------------------------------------- */

/* The call T3 reads: `game.i18n.format(` and `game.i18n.localize(`, optional chaining allowed, in blanked code. */
const I18N_CALL = /\bgame\s*\??\.\s*i18n\s*\??\.\s*(format|localize)\s*(?:\?\.\s*)?\(/g;

/**
 * T3 (plan, S13-19): no plural family - a key whose English has `.one` and
 * `.other` under it - is handed to `game.i18n.format` or `game.i18n.localize`
 * itself, as the call's first argument or a branch of a conditional that is
 * that argument: neither picks a form, so the table reads the raw key. Such a
 * key goes through utils.mjs `plural`. Read in each script with comments and
 * literals blanked, so a call quoted in a comment or a string is not one.
 * Not flagged: a family key handed on to a renderer (`add(...)` rows,
 * `fixedKey:`, `label:`), which formats it with plural itself; a key a
 * template builds (`DRPG.X.${k}`), counted in `unresolved`; a form's own key
 * (`DRPG.X.one`). Not in scope: the call reached through an alias (`const f =
 * game.i18n.format`, gm-store.mjs's `env.text`), named here so it is not read
 * as covered. Measured on 52eacb9c (31.10.2026, a probe in the stage folder):
 * 168 families, 177 of their keys written as literals in the 146 module
 * scripts, and one call that formats a family - murder-rules.mjs's hindrance,
 * two keys, the baseline's row.
 */
export function familyFormats(bag = {}) {
    const lx = lexerOf(bag, "familyFormats");
    const E = asMap(bag.en);
    const families = new Set([...E.keys()].filter(k => /\.(one|other)$/.test(k)).map(k => k.replace(/\.(one|other)$/, "")));
    const found = [];
    let calls = 0, unresolved = 0, files = 0;
    for (const [file, text] of asMap(bag.scripts)) {
        files++;
        const code = lx.blankComments(String(text ?? "")), blank = lx.blankLiterals(code);
        const spans = new Map(literalSpans(code, blank).map(s => [s.start, s]));
        for (const m of blank.matchAll(I18N_CALL)) {
            calls++;
            /* callArgs counts an argument only where the blanked text holds something, and a lone literal blanks to
               spaces: "(...)" with no argument it saw is that one literal, or nothing. */
            const open = m.index + m[0].length - 1, { args, close } = lx.callArgs(blank, open);
            const first = args[0] ?? (code.slice(open + 1, close).trim() ? { start: open + 1, end: close } : null);
            if (!first) continue;
            for (const b of branchesOf(code, blank, spans, first.start, first.end)) {
                if (b.template) unresolved++;
                if (b.value === undefined || !families.has(b.value)) continue;
                const line = lineOf(code, b.at);
                found.push({ key: b.value, kind: m[1], file, line,
                    what: `${file}:${line}: game.i18n.${m[1]} is handed the plural family ${b.value} itself - no form is picked and the table reads the raw key; it goes through plural() (utils.mjs)` });
            }
        }
    }
    return { found, read: families.size ? calls : 0, sources: ["script"], counts: { families: families.size, files, unresolved } };
}

/* ---------------------------------- T6 ------------------------------------- */

const DASH_NAMES = Object.freeze({ "\u2013": "an en dash (U+2013)", "\u2014": "an em dash (U+2014)", "\u2212": "a minus sign (U+2212)" });
const DASH = /[\u2013\u2014\u2212]/g;
const around = (text, at) => text.slice(Math.max(0, at - 10), at + 11).replace(/\s+/g, " ").trim();

/**
 * T6 (plan, S06-52 and S02-66): no en dash, em dash or minus sign (U+2013,
 * U+2014, U+2212) in what the module shows - the language files' values (`en`,
 * `pl`), config.mjs's English prose (`prose`), the string literals and template
 * text of its scripts (`scripts`; comments and regex literals not read, an
 * escape read as the character it writes) and the `.md` files under docs/
 * (`docs`, a line at a time). The house rule is "-"; `dashes` holds the en and
 * em dash in the language files and docs already, and nothing held the minus
 * sign or a script's strings. Each source is read only when it is handed in, and
 * the answer names those read (`sources`), so a baseline row of a source a
 * table cannot read (the English prose) is not judged there. A finding is one
 * value, literal or line. Measured on 52eacb9c (31.10.2026): 11 of them, every
 * one written before E65 and in the baseline - the U+2212 sites the stage named
 * (config.mjs's two `meddle` prose strings, read as prose and as literals, their
 * pl.json twins, vault.mjs's spend button, action-rolls.mjs's two signs) and two
 * it had not, because they are written as escapes: roll-dialog.mjs's signed
 * source ("\u2212") and season-setup.mjs's mark for an optional step ("\u2013").
 */
export function dashesIn(bag = {}) {
    const found = [], sources = [], counts = {};
    let read = 0;
    const unit = (kind, file, key, text, where) => {
        read++;
        counts[kind] = (counts[kind] ?? 0) + 1;
        const at = text.search(DASH);
        if (at < 0) return;
        const names = [...new Set(text.match(DASH))].map(c => DASH_NAMES[c]).join(", ");
        const quote = around(text, at);
        found.push({ key: key ?? `${file} "${quote}"`, kind, file, text, what: `${where}: ${names} in "${quote}" - the house rule is "-"` });
    };
    for (const [kind, file] of [["en", "lang/en.json"], ["pl", "lang/pl.json"]]) {
        if (bag[kind] === undefined) continue;
        sources.push(kind);
        for (const [key, value] of asMap(bag[kind])) if (typeof value === "string") unit(kind, file, key, value, `${file} ${key}`);
    }
    if (bag.prose !== undefined) {
        sources.push("prose");
        for (const [key, value] of asMap(bag.prose)) if (typeof value === "string") unit("prose", "scripts/config.mjs", key, value, `config.mjs's prose ${key}`);
    }
    if (bag.scripts !== undefined) {
        const lx = lexerOf(bag, "dashesIn");
        sources.push("script");
        for (const [file, text] of asMap(bag.scripts)) {
            const code = lx.blankComments(String(text ?? "")), blank = lx.blankLiterals(code);
            for (const span of literalSpans(code, blank)) {
                if (span.kind !== "regex") unit("script", file, null, literalText(code, span), `${file}:${lineOf(code, span.start)}`);
            }
        }
    }
    if (bag.docs !== undefined) {
        sources.push("doc");
        for (const [file, text] of asMap(bag.docs)) String(text ?? "").split("\n").forEach((line, i) => unit("doc", file, null, line, `${file}:${i + 1}`));
    }
    return { found, read, sources, counts };
}

/* ---------------------------------- T14 ------------------------------------ */

/**
 * WHAT AN ITEM TABLE'S NAME HAS CARRIED, AS IT READ AT 419d3b42 (E65's Base,
 * 1.2.92): config.mjs `TABLE_NAME_WORDS` (the plural of each category, the
 * label of each usable kind) and tables.mjs's two legacy lists, copied from a
 * Node run of both files at 419d3b42 on 31.10.2026 and read again on 52eacb9c,
 * where all four read the same. A frozen copy, never edited: it is what T14
 * holds the live words against. A word that comes and goes after it is held
 * only by the legacy list it was added to - which T14 does not see.
 */
export const TABLE_WORDS_AT_BASE = Object.freeze({
    plural: Object.freeze({ usable: "Usables", crimeTool: "Murder Weapons", cleaningTool: "Cleaning Tools", tool: "Tools", truthBullet: "Truth Bullets",
        bedroomKey: "Room Keys" }),
    kind: Object.freeze({ healing: "Healing", stress: "Sanity Relief" }),
    legacyPlurals: Object.freeze({ usable: Object.freeze(["Usable Items", "Użytkowe"]), crimeTool: Object.freeze(["Crime Tools", "Narzędzia zbrodni"]),
        cleaningTool: Object.freeze(["Narzędzia do sprzątania"]), tool: Object.freeze(["Narzędzia"]) }),
    legacyGoalLabels: Object.freeze({ stress: Object.freeze(["Stress Relief"]) })
});

/**
 * tables.mjs's `LEGACY_PLURALS` and `LEGACY_GOAL_LABELS`, read off its text:
 * each `const NAME = { key: ["...", ...], ... }` at the start of a line (so a
 * copy in a "//" comment is not it) as an object of string lists, null where
 * the literal is not there. tables.mjs cannot be imported in Node
 * ("Hooks is not defined"), and the lists are not exported, so check.mjs and a
 * tier read the same text the same way.
 */
export function legacyListsFrom(text) {
    const out = {};
    for (const [name, as] of [["LEGACY_PLURALS", "legacyPlurals"], ["LEGACY_GOAL_LABELS", "legacyGoalLabels"]]) {
        const m = new RegExp(`(?:^|\\n)const ${name}\\s*=\\s*\\{([^}]*)\\}`).exec(String(text ?? ""));
        out[as] = m ? Object.fromEntries([...m[1].matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)]
            .map(([, key, body]) => [key, [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => x[1])])) : null;
    }
    return out;
}

/**
 * T14 (plan, DB13): a table is found by its name, and its name is built from
 * words that are ordinary display copy; every time one was reworded, worlds'
 * tables stopped being found and `drawItem` fell through to the built-in pools
 * in silence (tables.mjs, the comment above LEGACY_PLURALS). So every word the
 * names carried at Base (`known`, TABLE_WORDS_AT_BASE) is today's word or in
 * the legacy list of its category or kind, and every legacy word of Base is
 * still in its list - the lists only grow (N5, "Add to this list - do not edit
 * it"). A category or kind gone from `words` is a finding too: its tables are
 * no longer named. `words` is config.mjs `TABLE_NAME_WORDS` (the English, frozen
 * before any language: a client in Polish reads the same), the lists come from
 * `legacyListsFrom`. The Polish names a client in Polish built before E14
 * (`LOCALIZED_PLURALS`) are legacy words, candidates, never today's words.
 * Whether `tableName` and `tableNameCandidates` build from these is R1060's
 * second half, at a table.
 */
export function tableWordProblems({ words, legacyPlurals, legacyGoalLabels, known = TABLE_WORDS_AT_BASE, knownLegacy } = {}) {
    const found = [];
    let read = 0;
    const was = knownLegacy ?? { plurals: known.legacyPlurals ?? {}, goalLabels: known.legacyGoalLabels ?? {} };
    for (const [list, name] of [[legacyPlurals, "LEGACY_PLURALS"], [legacyGoalLabels, "LEGACY_GOAL_LABELS"]]) {
        if (!list || typeof list !== "object") found.push({ key: name, kind: "unread", what: `tables.mjs's ${name} could not be read - T14 has nothing to hold the words to` });
    }
    const sides = [
        ["plural", words?.plural, legacyPlurals ?? {}, "LEGACY_PLURALS", w => `"DRPG ${w} - Tier n"`, was.plurals ?? {}],
        ["kind", words?.kind, legacyGoalLabels ?? {}, "LEGACY_GOAL_LABELS", w => `"DRPG Usables (${w}) - Tier n"`, was.goalLabels ?? {}]
    ];
    for (const [side, now, legacy, listName, nameOf, before] of sides) {
        for (const [key, old] of Object.entries(known[side] ?? {})) {
            read++;
            const current = now?.[key];
            if (typeof current !== "string") {
                found.push({ key: `${side}.${key}`, kind: "gone", what: `TABLE_NAME_WORDS.${side} has no ${key} now; its tables were named ${nameOf(old)}, and nothing builds that name` });
            } else if (current !== old && !(legacy[key] ?? []).includes(old)) {
                found.push({ key: `${side}.${key}`, kind: "lost",
                    what: `TABLE_NAME_WORDS.${side}.${key} is "${current}" now, and "${old}", which it was, is not in tables.mjs ${listName}.${key}: a world's ${nameOf(old)} is not found any more - add the old word to the list, never rename the table` });
            }
        }
        for (const [key, olds] of Object.entries(before)) {
            for (const old of olds) {
                read++;
                if (!(legacy[key] ?? []).includes(old)) {
                    found.push({ key: `${listName}.${key}`, kind: "shrunk", what: `tables.mjs ${listName}.${key} no longer holds "${old}" - the lists only grow (N5): a world's ${nameOf(old)} is not found any more` });
                }
            }
        }
    }
    return { found, read };
}

/* --------------------------------- T8, T28 --------------------------------- */

/**
 * THE GLOSSARY'S SHAPE (E65 C4; E65-10, S18-31, S17-36). docs/glossary.json is a
 * file E65 writes, so a fault in it is a schema error - red in `node tools/check.mjs
 * text` - never text debt. An entry: `id` (kebab case, once in the file), `en` and
 * `pl` (the term, or null where the source gives one side only or the entry is a
 * rule, `rule`), `gender` (the Polish one, "m", "f" or "n", DB28 and DB39; null where
 * no source gives it), `inflection` (what the source says of the Polish forms;
 * null where it says nothing), `forbidden` (`en` and `pl`, each `{ variants, scope }`
 * and optionally `case`, `otherCase`, `except` - below), `stage` (a row of
 * tools/stages.json: the entry holds once that stage has shipped) and `source` (the
 * decisions it comes from - D, DB, DA, DC, DX, TR, or an amend A<n>; where the
 * sources read name no decision, the issue S18-31 or "E65 plan", the plan entry). `open: true` is
 * an entry no source decides: it has no forbidden variant. A retired name (T28):
 * `id`, `en` and `pl` (lists of the names), `scope` ("text", "label" or "keys", with
 * `keys` the prefixes), `stage`, `source`, and optionally `pass` (keys left alone,
 * each with its `why`), `case`, `rule` (a named rule below, with its own fields) and
 * `note`. A field the file does not know is red too, so a typo is not read as
 * "nothing forbidden".
 */
const GLOSSARY_FIELDS = Object.freeze({
    entry: Object.freeze({ required: ["id", "en", "pl", "gender", "inflection", "forbidden", "stage", "source"], optional: ["open", "note", "rule"] }),
    retired: Object.freeze({ required: ["id", "en", "pl", "scope", "stage", "source"], optional: ["keys", "pass", "case", "rule", "button", "note"] }),
    side: Object.freeze({ required: ["variants", "scope"], optional: ["case", "otherCase", "except"] })
});
const GLOSSARY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/* A decision (D33a, DB15, DA27, DC35, DX4, TR25), an amend (A7), or where no decision is named the issue or the plan entry that names the thing (S18-31, "E65 plan"). */
const SOURCE_ID = /^(?:D\d+[a-z]?|DB\d+|DA\d+|DC\d+|DX\d+|TR\d+|A\d+|S\d\d-\d\d|E\d\d plan)$/;
const SCOPES = Object.freeze(["ui", "handbooks"]), RETIRED_SCOPES = Object.freeze(["text", "label", "keys"]);

const isText = x => typeof x === "string" && x.trim() !== "";
const variantOk = v => isText(v) || (v !== null && typeof v === "object" && !Array.isArray(v) && isText(v.stem) && Array.isArray(v.endings)
    && v.endings.length > 0 && v.endings.every(e => typeof e === "string") && Object.keys(v).every(k => k === "stem" || k === "endings"));

/**
 * docs/glossary.json against its shape, every `stage` against `stageIds` (the
 * ledger's rows): one sentence a fault, [] when it holds. `doc` is the parsed file.
 */
export function glossarySchema(doc, stageIds = []) {
    const out = [];
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["docs/glossary.json is no object"];
    const stages = new Set(stageIds);
    const comment = doc.$comment;
    if (!isText(comment) && !(Array.isArray(comment) && comment.length > 0 && comment.every(isText))) out.push("docs/glossary.json has no $comment");
    for (const k of Object.keys(doc)) if (!["$comment", "entries", "retired"].includes(k)) out.push(`docs/glossary.json has a field "${k}" it does not know`);
    const seen = new Set();
    const fields = (row, where, shape) => {
        for (const f of shape.required) if (!Object.hasOwn(row, f)) out.push(`${where} has no "${f}"`);
        for (const f of Object.keys(row)) if (!shape.required.includes(f) && !shape.optional.includes(f)) out.push(`${where} has a field "${f}" the glossary does not know`);
    };
    const common = (row, where) => {
        if (Object.hasOwn(row, "id")) {
            if (typeof row.id !== "string" || !GLOSSARY_ID.test(row.id)) out.push(`${where}'s id ${JSON.stringify(row.id)} is not kebab case`);
            else if (seen.has(row.id)) out.push(`${where}: the id "${row.id}" is used twice`);
            seen.add(row.id);
        }
        if (Object.hasOwn(row, "stage") && !(typeof row.stage === "string" && stages.has(row.stage))) out.push(`${where}'s stage ${JSON.stringify(row.stage)} is no row of tools/stages.json`);
        if (Object.hasOwn(row, "source") && !(Array.isArray(row.source) && row.source.length > 0 && row.source.every(s => typeof s === "string" && SOURCE_ID.test(s)))) {
            out.push(`${where}'s source ${JSON.stringify(row.source)} is not a list of decisions (D, DB, DA, DC, DX, TR), amends (A), issues (S) or a plan entry`);
        }
        for (const f of ["note", "rule"]) if (Object.hasOwn(row, f) && !isText(row[f])) out.push(`${where}'s ${f} is not a sentence`);
        if (Object.hasOwn(row, "case") && !["exact", "any"].includes(row.case)) out.push(`${where}'s case ${JSON.stringify(row.case)} is neither "exact" nor "any"`);
    };
    const entries = Array.isArray(doc.entries) ? doc.entries : (out.push("docs/glossary.json has no list of entries"), []);
    entries.forEach((e, i) => {
        if (!e || typeof e !== "object" || Array.isArray(e)) { out.push(`entry ${i + 1} is no object`); return; }
        const where = `entry ${i + 1}${typeof e.id === "string" ? ` (${e.id})` : ""}`;
        fields(e, where, GLOSSARY_FIELDS.entry);
        common(e, where);
        for (const side of ["en", "pl"]) if (Object.hasOwn(e, side) && e[side] !== null && !isText(e[side])) out.push(`${where}'s ${side} is neither a term nor null`);
        if (e.en === null && e.pl === null && !isText(e.rule)) out.push(`${where} names no term and states no rule`);
        if (Object.hasOwn(e, "gender") && ![null, "m", "f", "n"].includes(e.gender)) out.push(`${where}'s gender ${JSON.stringify(e.gender)} is not m, f, n or null`);
        if (Object.hasOwn(e, "inflection") && e.inflection !== null && !isText(e.inflection)) out.push(`${where}'s inflection is neither a sentence nor null`);
        if (Object.hasOwn(e, "open") && e.open !== true) out.push(`${where}'s open is not true`);
        if (!Object.hasOwn(e, "forbidden")) return;
        const fb = e.forbidden;
        if (!fb || typeof fb !== "object" || Array.isArray(fb)) { out.push(`${where}'s forbidden is no object`); return; }
        for (const k of Object.keys(fb)) if (k !== "en" && k !== "pl") out.push(`${where}'s forbidden has a side "${k}"`);
        for (const side of ["en", "pl"]) {
            const r = fb[side], at = `${where}'s forbidden.${side}`;
            if (!r || typeof r !== "object" || Array.isArray(r)) { out.push(`${at} is missing`); continue; }
            fields(r, at, GLOSSARY_FIELDS.side);
            if (Object.hasOwn(r, "variants") && !(Array.isArray(r.variants) && r.variants.every(variantOk))) out.push(`${at}'s variants are not phrases or { stem, endings }`);
            if (Object.hasOwn(r, "scope") && !(Array.isArray(r.scope) && r.scope.length > 0 && r.scope.every(s => SCOPES.includes(s)))) out.push(`${at}'s scope is not "ui", "handbooks" or both`);
            if (Object.hasOwn(r, "case") && !["exact", "any"].includes(r.case)) out.push(`${at}'s case is neither "exact" nor "any"`);
            if (Object.hasOwn(r, "otherCase") && typeof r.otherCase !== "boolean") out.push(`${at}'s otherCase is not true or false`);
            if (r.otherCase === true && !isText(e[side])) out.push(`${at} holds the term's case and the entry has no ${side} term`);
            if (Object.hasOwn(r, "except") && !(Array.isArray(r.except) && r.except.every(isText))) out.push(`${at}'s except is not a list of phrases`);
            if (e.open === true && ((r.variants ?? []).length > 0 || r.otherCase === true)) out.push(`${at}: an open entry forbids nothing`);
        }
    });
    const retired = Array.isArray(doc.retired) ? doc.retired : (out.push("docs/glossary.json has no list of retired names"), []);
    retired.forEach((r, i) => {
        if (!r || typeof r !== "object" || Array.isArray(r)) { out.push(`retired ${i + 1} is no object`); return; }
        const where = `retired ${i + 1}${typeof r.id === "string" ? ` (${r.id})` : ""}`;
        fields(r, where, GLOSSARY_FIELDS.retired);
        common(r, where);
        for (const side of ["en", "pl"]) if (Object.hasOwn(r, side) && !(Array.isArray(r[side]) && r[side].every(isText))) out.push(`${where}'s ${side} is not a list of names`);
        if (Object.hasOwn(r, "scope") && !RETIRED_SCOPES.includes(r.scope)) out.push(`${where}'s scope ${JSON.stringify(r.scope)} is not "text", "label" or "keys"`);
        if (r.scope === "keys" && !(Array.isArray(r.keys) && r.keys.length > 0 && r.keys.every(isText))) out.push(`${where} reads keys and names no key prefix`);
        if (Object.hasOwn(r, "pass") && !(Array.isArray(r.pass) && r.pass.every(p => isText(p?.key) && isText(p?.why)))) out.push(`${where}'s pass is not a list of { key, why }`);
        if (Object.hasOwn(r, "rule") && !RETIRED_RULES[r.rule]) out.push(`${where}'s rule "${r.rule}" is no rule of tests-text.mjs`);
        if (!r.rule && ![...(r.en ?? []), ...(r.pl ?? [])].length) out.push(`${where} retires no name`);
    });
    return out;
}

/* ------------------------------- the budgets -------------------------------- */

/**
 * THE BUDGETS' SHAPE (E65 C5; E65-14, DB11). docs/text-budgets.json says how long a
 * text of each surface of docs/text-style.md may be, in words: `surfaces`, each with
 * a `target` (what the report holds a text to) and a `limit` (DB11: "limit twardy ok.
 * 1,5 razy cel"; null for a surface that is only ever reported, the GM's diagnostics)
 * and `what` (who reads it, one sentence); `rules`, which keys belong to which surface,
 * the first that names a key winning - by the key (`keys`, a regular expression over
 * the whole key) or by the function that sends it (`sender`, names of SENDERS), never
 * both - and a key no rule names is "unclassified"; `allow`, the exceptions, each
 * silencing one `key` for one `rule` (T4, T16, or an X rule of the guide) with its
 * `why` and the stage that may remove it (`until`, a row of tools/stages.json). A row
 * without its `why` is a fault (DB11: "allowlista z powodem"), and so is a field the
 * file does not know, a surface no rule names (no key could reach its budget) and a
 * limit that is not above its target and at most twice it. A file E65 writes, so a
 * fault is red in `node tools/check.mjs text`, as the glossary's is; T4 (E65 C6) reads
 * the numbers. The numbers themselves are rebuilt 30.10 (Appendix A, section 4) and
 * wait for the pilot; nothing here holds which they are.
 */
const BUDGET_FIELDS = Object.freeze({
    top: Object.freeze({ required: ["$comment", "status", "unit", "surfaces", "rules", "allow"], optional: [] }),
    surface: Object.freeze({ required: ["target", "limit", "what"], optional: ["note"] }),
    rule: Object.freeze({ required: ["surface"], optional: ["keys", "sender", "note"] }),
    allow: Object.freeze({ required: ["key", "rule", "why", "until"], optional: [] })
});
/** The functions a key reaches its reader through (the audience map's senders, E65 C11; utils.mjs, action-rolls.mjs, incident-store.mjs, murder-rules.mjs). */
export const SENDERS = Object.freeze(["ui.notifications", "announce", "announceCrisis", "whisperToOwner", "whisperToOwnerOnly", "whisperToGms", "roomAudience", "incidentAudienceIds"]);
const ALLOW_RULE = /^(?:T4|T16|X(?:[1-9]|1\d|2[01]))$/;
const KEY_NAME = /^[A-Za-z][\w-]*(?:\.[\w-]+)+$/;
const wholeAbove0 = n => Number.isInteger(n) && n > 0;

/**
 * docs/text-budgets.json against its shape, every `until` against `stageIds` (the
 * ledger's rows): one sentence a fault, [] when it holds. `doc` is the parsed file.
 * A pattern's own error is not quoted: the engines word it differently, and R1058
 * runs this at a table.
 */
export function budgetsSchema(doc, stageIds = []) {
    const out = [], F = "docs/text-budgets.json";
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [`${F} is no object`];
    const stages = new Set(stageIds);
    const isObject = x => x !== null && typeof x === "object" && !Array.isArray(x);
    const fields = (row, where, shape) => {
        for (const f of shape.required) if (!Object.hasOwn(row, f)) out.push(`${where} has no "${f}"`);
        for (const f of Object.keys(row)) if (!shape.required.includes(f) && !shape.optional.includes(f)) out.push(`${where} has a field "${f}" the budgets do not know`);
    };
    const sentence = (row, where, names) => { for (const f of names) if (Object.hasOwn(row, f) && !isText(row[f])) out.push(`${where}'s ${f} is not a sentence`); };
    fields(doc, F, BUDGET_FIELDS.top);
    const comment = doc.$comment;
    if (Object.hasOwn(doc, "$comment") && !isText(comment) && !(Array.isArray(comment) && comment.length > 0 && comment.every(isText))) out.push(`${F}'s $comment is not a sentence or a list of them`);
    sentence(doc, F, ["status"]);
    if (Object.hasOwn(doc, "unit") && doc.unit !== "words") out.push(`${F}'s unit ${JSON.stringify(doc.unit)} is not "words"`);
    const surfaces = isObject(doc.surfaces) ? doc.surfaces : {};
    if (!Object.keys(surfaces).length) out.push(`${F} has no surfaces`);
    for (const [id, s] of Object.entries(surfaces)) {
        const where = `surface ${id}`;
        if (!GLOSSARY_ID.test(id)) out.push(`${where}: the name is not kebab case`);
        if (!isObject(s)) { out.push(`${where} is no object`); continue; }
        fields(s, where, BUDGET_FIELDS.surface);
        if (Object.hasOwn(s, "target") && !wholeAbove0(s.target)) out.push(`${where}'s target ${JSON.stringify(s.target)} is not a whole number of words above 0`);
        if (Object.hasOwn(s, "limit") && s.limit !== null) {
            if (!Number.isInteger(s.limit)) out.push(`${where}'s limit ${JSON.stringify(s.limit)} is neither a whole number nor null`);
            else if (wholeAbove0(s.target) && !(s.limit > s.target && s.limit <= 2 * s.target)) {
                out.push(`${where}'s limit ${s.limit} is not above its target ${s.target} and at most twice it (DB11: about 1.5 times)`);
            }
        }
        sentence(s, where, ["what", "note"]);
    }
    const rules = Array.isArray(doc.rules) ? doc.rules : (out.push(`${F} has no list of rules`), []);
    const named = new Set();
    rules.forEach((r, i) => {
        const where = `rule ${i + 1}`;
        if (!isObject(r)) { out.push(`${where} is no object`); return; }
        fields(r, where, BUDGET_FIELDS.rule);
        if (Object.hasOwn(r, "surface")) {
            if (typeof r.surface === "string" && Object.hasOwn(surfaces, r.surface)) named.add(r.surface);
            else out.push(`${where}'s surface ${JSON.stringify(r.surface)} is no surface of the file`);
        }
        const byKeys = Object.hasOwn(r, "keys"), bySender = Object.hasOwn(r, "sender");
        if (byKeys === bySender) out.push(`${where} reads ${byKeys ? "both keys and a sender" : "neither keys nor a sender"} - one of them, never both`);
        if (byKeys) {
            let ok = isText(r.keys);
            if (ok) { try { new RegExp(r.keys, "u"); } catch { ok = false; } }
            if (!ok) out.push(`${where}'s keys ${JSON.stringify(r.keys)} is no regular expression`);
        }
        if (bySender && !(Array.isArray(r.sender) && r.sender.length > 0 && r.sender.every(s => SENDERS.includes(s)))) {
            out.push(`${where}'s sender ${JSON.stringify(r.sender)} is not a list of the senders tests-text.mjs knows (SENDERS)`);
        }
        sentence(r, where, ["note"]);
    });
    for (const id of Object.keys(surfaces)) if (!named.has(id)) out.push(`surface ${id} is named by no rule - no key can reach its budget`);
    const allow = Array.isArray(doc.allow) ? doc.allow : (out.push(`${F} has no allow list`), []);
    const seen = new Set();
    allow.forEach((a, i) => {
        const where = `allow ${i + 1}${isText(a?.key) ? ` (${a.key})` : ""}`;
        if (!isObject(a)) { out.push(`${where} is no object`); return; }
        fields(a, where, BUDGET_FIELDS.allow);
        if (Object.hasOwn(a, "key") && !(typeof a.key === "string" && KEY_NAME.test(a.key))) out.push(`${where}'s key ${JSON.stringify(a.key)} is not a dotted key`);
        if (Object.hasOwn(a, "rule") && !(typeof a.rule === "string" && ALLOW_RULE.test(a.rule))) out.push(`${where}'s rule ${JSON.stringify(a.rule)} is not T4, T16 or an X rule (X1 to X21)`);
        sentence(a, where, ["why"]);
        if (Object.hasOwn(a, "until") && !(typeof a.until === "string" && stages.has(a.until))) out.push(`${where}'s until ${JSON.stringify(a.until)} is no row of tools/stages.json`);
        const pair = `${a.key} ${a.rule}`;
        if (seen.has(pair)) out.push(`${where}: the key ${JSON.stringify(a.key)} is allowed twice for ${a.rule}`);
        seen.add(pair);
    });
    return out;
}

/* Every form of a variant: a phrase as it is, a stem with each of its endings (DB4's "a stem with an ending list"). */
const formsOf = v => (typeof v === "string" ? [v] : v.endings.map(e => v.stem + e));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* Whole words: no letter, digit or "_" on either side, Polish letters included; the longest form first. */
const wordRe = (forms, anyCase) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${[...new Set(forms)].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?![\\p{L}\\p{N}_])`,
    anyCase ? "giu" : "gu");
const spansOf = (text, re) => [...text.matchAll(re)].map(m => [m.index, m.index + m[0].length]);

/** The tile labels T28's "label" scope reads: config.mjs `ACTIONS[*].label` (the English prose) and their pl.json twins. */
export const TILE_LABEL = /^DRPG\.Config\.ACTIONS\.[^.]+\.label$/;

/**
 * What the glossary's scopes read, as `{ en: { ui, handbooks }, pl: { ui, handbooks } }`
 * of `{ at, where, text }`: "ui" is a language file's values with, for English,
 * config.mjs's prose (en.json holds no `DRPG.Config.*`; the Polish twins are in
 * pl.json); "handbooks" the `.md` files under docs/handbooks/, a line at a time,
 * each in the language its name ends in. `at` is a key or `file:line`.
 */
function glossaryUnits(bag) {
    const units = { en: { ui: [], handbooks: [] }, pl: { ui: [], handbooks: [] } };
    for (const [code, file] of [["en", "lang/en.json"], ["pl", "lang/pl.json"]]) {
        for (const [key, text] of asMap(bag[code])) if (typeof text === "string") units[code].ui.push({ at: key, key, where: `${file} ${key}`, text });
    }
    for (const [key, text] of asMap(bag.prose)) if (typeof text === "string") units.en.ui.push({ at: key, key, where: `config.mjs's prose ${key}`, text });
    for (const [file, text] of asMap(bag.docs)) {
        const m = file.match(/^docs\/handbooks\/[^/]+\.(en|pl)\.md$/);
        if (m) String(text ?? "").split("\n").forEach((line, i) => units[m[1]].handbooks.push({ at: `${file}:${i + 1}`, where: `${file}:${i + 1}`, text: line }));
    }
    return units;
}

const quoted = (text, at, len) => text.slice(Math.max(0, at - 12), at + len + 12).replace(/\s+/g, " ").trim();
const sourcesOf = row => (Array.isArray(row.source) ? row.source.join(", ") : String(row.source));

/* A row's findings split by its stage: `found` the rows whose stage has shipped (debt), `pending` the rest; `checked`
   whether the row looked at anything at all (an entry with no forbidden variant reads nothing, so it holds nothing). */
function byStage(rows, shipped) {
    const found = [], pending = [], entries = [];
    for (const { row, hits, checked } of rows) {
        const due = shipped.has(row.stage);
        (due ? found : pending).push(...hits);
        entries.push({ id: row.id, stage: row.stage, due, checked, hits: hits.length, first: hits[0]?.what ?? null });
    }
    return { found, pending, entries };
}

/**
 * T8 (plan, S18-31, S17-36): a forbidden variant where a glossary entry holds -
 * and an entry holds only once its `stage` has shipped (`shipped`, the ids
 * tools/stages.mjs `isShipped` answers yes for, handed in: this file imports
 * nothing). Report from E65, FAIL from E25 for the UI and config.mjs of entries
 * whose stage is E25 or before (MODES). Per entry and side, its variants are
 * looked for in its scope as whole words, in the case the side says (`case`:
 * "exact", or "any" for a word that may open a sentence), never inside the
 * entry's own term or a phrase of `except` - "trace" is not read inside "Secure a
 * Trace". `otherCase` finds the term itself in another case ("search token" where
 * the glossary writes "Search Token", DB17); `except` does not shield that. A Polish variant inflects as a stem
 * with its endings, written out in the entry, never a free pattern. A term that is
 * English in Polish has `pl` equal to `en`, and the English name in a Polish text is
 * then no finding. `found` is the debt (entries whose stage has shipped),
 * `pending` what entries not yet due find, `entries` one line each.
 */
export function glossaryHits(bag = {}) {
    const units = glossaryUnits(bag), shipped = new Set(bag.shipped ?? []);
    const rows = [];
    let read = 0;
    for (const entry of bag.glossary?.entries ?? []) {
        const hits = [], before = read;
        for (const side of ["en", "pl"]) {
            const rule = entry.forbidden?.[side];
            const term = typeof entry[side] === "string" ? entry[side] : null;
            const forms = (rule?.variants ?? []).flatMap(formsOf);
            const otherCase = rule?.otherCase === true && term !== null;
            const pool = (rule?.scope ?? []).flatMap(s => units[side][s] ?? []);
            if ((!forms.length && !otherCase) || !pool.length) continue;
            read++;
            const bad = forms.length ? wordRe(forms, rule.case === "any") : null;
            const shieldList = [...(term ? [term] : []), ...(rule.except ?? [])];
            const shield = shieldList.length ? wordRe(shieldList, true) : null;
            const named = otherCase ? wordRe([term], true) : null;
            for (const u of pool) {
                const inside = (re, a, b) => re !== null && spansOf(u.text, re).some(([s, e]) => a >= s && b <= e);
                const hit = (m, kind, said) => hits.push({ key: `${entry.id}@${u.at}`, kind, entry: entry.id, stage: entry.stage,
                    what: `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - ${said} (glossary ${entry.id}, ${sourcesOf(entry)}; holds from ${entry.stage})` });
                if (bad) for (const m of u.text.matchAll(bad)) if (!inside(shield, m.index, m.index + m[0].length)) hit(m, side, `"${m[0]}" is forbidden${term ? `, the glossary says "${term}"` : ""}`);
                if (named) for (const m of u.text.matchAll(named)) if (m[0] !== term) hit(m, `${side}-case`, `"${m[0]}" is written "${term}"`);
            }
        }
        rows.push({ row: entry, hits, checked: read > before });
    }
    const split = byStage(rows, shipped);
    return { found: split.found, pending: split.pending, entries: split.entries, read, sources: ["glossary"],
        counts: { entries: rows.length, due: split.entries.filter(e => e.due).length, pending: split.pending.length } };
}

/**
 * A10 (11.10, the owner's amend): in a passage text - a key under the row's
 * prefixes, `DRPG.Passage.*` (E79, E80) - every Polish "przejś*" stands after
 * "tajn*" ("tajne przejście", "tajnego przejścia"); a bare "przejście" names some
 * other way through, which a passage is not. Read as the amend writes it: its other
 * case, "inside Find Passage / Secret Passage", holds no "przejś*" (the two names
 * are English in Polish, A10), so it can never be the reason a "przejś*" passes.
 */
export function passageWords(units, row) {
    const hits = [];
    let read = 0;
    const word = /(?<![\p{L}\p{N}_])przejś\p{L}*/giu, before = /(?<![\p{L}\p{N}_])tajn\p{L}*\s+$/iu;
    for (const u of units.pl.ui) {
        if (!(row.keys ?? []).some(p => u.key?.startsWith(p)) || (row.pass ?? []).some(p => p.key === u.key)) continue;
        read++;
        for (const m of u.text.matchAll(word)) {
            if (before.test(u.text.slice(0, m.index))) continue;
            hits.push({ key: `${row.id}@${u.at}`, kind: "pl", entry: row.id, stage: row.stage,
                what: `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - "${m[0]}" with no "tajn*" before it: a passage is "tajne przejście" (A10; holds from ${row.stage})` });
        }
    }
    return { hits, read };
}

/**
 * A11 (13.10, the owner's amend): the Frisk texts - keys under the row's prefixes,
 * `DRPG.Frisk.*` (E80) - never say "Consent" (TR8), in either language and any
 * case; and the player's answer button (`button.key`) reads `button.pl` in Polish:
 * "Odmów".
 */
export function friskWords(units, row) {
    const hits = [];
    let read = 0;
    const consent = wordRe(["consent"], true);
    for (const side of ["en", "pl"]) {
        for (const u of units[side].ui) {
            if (!(row.keys ?? []).some(p => u.key?.startsWith(p))) continue;
            read++;
            for (const m of u.text.matchAll(consent)) {
                hits.push({ key: `${row.id}@${u.at}`, kind: side, entry: row.id, stage: row.stage,
                    what: `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - a Frisk text says "${m[0]}" (A11, TR8; holds from ${row.stage})` });
            }
        }
    }
    if (row.button) {
        read++;
        const button = units.pl.ui.find(u => u.key === row.button.key);
        if (button?.text !== row.button.pl) {
            hits.push({ key: `${row.id}@${row.button.key}`, kind: "button", entry: row.id, stage: row.stage,
                what: `lang/pl.json ${row.button.key}: the player's answer button reads ${button ? `"${button.text}"` : "nothing"}, not "${row.button.pl}" (A11; holds from ${row.stage})` });
        }
    }
    return { hits, read };
}

/* The named rules a retired row may ask for instead of its names (`rule`). */
const RETIRED_RULES = Object.freeze({ passageWords, friskWords });

/**
 * T28 (plan; report from E65, FAIL from E66): a retired name (the glossary's
 * `retired`, Appendix B) where it is retired. "text" reads every value and
 * handbook line; "label" only the tile labels (TILE_LABEL: config.mjs's English and
 * pl.json's twins) - "Doors" is retired as a tile's label, so "Behind Closed Doors"
 * in a sentence and Room Setup's tab (`DRPG.Vault.tabDoors`) pass; "keys" only the
 * values of keys under its prefixes - "Oddaj głos" on the trial floor (TR10), never
 * the vote button `DRPG.Vote.cast`, which casts a vote (a `pass` row with its why).
 * The tile group labels of round 3 are not on this tree (no group in config.mjs on
 * 31.10), so a group name would show up only as a tile's label. A row with `rule`
 * is the named rule's (A10's passageWords, A11's friskWords). Split by the row's
 * stage as T8's entries are.
 */
export function retiredHits(bag = {}) {
    const units = glossaryUnits(bag), shipped = new Set(bag.shipped ?? []);
    const rows = [];
    let read = 0;
    for (const row of bag.glossary?.retired ?? []) {
        if (row.rule) {
            const r = RETIRED_RULES[row.rule]?.(units, row) ?? { hits: [], read: 0 };
            read += r.read;
            rows.push({ row, hits: r.hits, checked: r.read > 0 });
            continue;
        }
        const hits = [], before = read;
        for (const side of ["en", "pl"]) {
            const names = row[side] ?? [];
            if (!names.length) continue;
            const pool = (row.scope === "label" ? units[side].ui.filter(u => TILE_LABEL.test(u.key ?? ""))
                : row.scope === "keys" ? units[side].ui.filter(u => (row.keys ?? []).some(p => u.key?.startsWith(p)))
                : [...units[side].ui, ...units[side].handbooks]).filter(u => !(row.pass ?? []).some(p => p.key === u.key));
            if (!pool.length) continue;
            read++;
            const re = wordRe(names, row.case === "any");
            for (const u of pool) {
                for (const m of u.text.matchAll(re)) {
                    hits.push({ key: `${row.id}@${u.at}`, kind: side, entry: row.id, stage: row.stage,
                        what: `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - "${m[0]}" is retired${row.scope === "label" ? " as a tile's label" : ""} (${sourcesOf(row)}; holds from ${row.stage})` });
                }
            }
        }
        rows.push({ row, hits, checked: read > before });
    }
    const split = byStage(rows, shipped);
    return { found: split.found, pending: split.pending, entries: split.entries, read, sources: ["glossary"],
        counts: { rows: rows.length, due: split.entries.filter(e => e.due).length, pending: split.pending.length } };
}

/* ------------------------------- baselines --------------------------------- */

/**
 * WHAT A FAIL DETECTOR FOUND BEFORE E65, written down so that it is the only
 * thing it may find (the plan: T3 and T6 FAIL "with a baseline that only
 * shrinks"). A row names its site by file and key (`keys` or `key`) or by a
 * piece of the literal or line (`quote`), never by line, so an edit above it
 * moves nothing; `in` names the source a T6 row is read from; `issue` the audit
 * item it is; `empties` the stage the plan gives the emptying to. A row matches
 * one finding, so two sites alike are two rows, and a third one alike is red.
 * Escapes, never the characters (`dashes` reads code).
 */
export const BASELINES = Object.freeze({
    familyFormats: Object.freeze([
        Object.freeze({ file: "scripts/murder-rules.mjs", keys: Object.freeze(["DRPG.Murder.blockedActions", "DRPG.Murder.hinderedActions"]), issue: "S13-19", empties: "E66",
            why: "a crisis action's hindrance on its card: the one game.i18n.format whose first argument picks between the two families" })
    ]),
    dashesIn: Object.freeze([
        ...["hinder", "hinderTarget"].flatMap(k => [
            Object.freeze({ in: "prose", file: "scripts/config.mjs", key: `DRPG.Config.MONOCUB.abilities.meddle.thresholds.0.${k}`, issue: "S02-66", empties: "E25" }),
            Object.freeze({ in: "pl", file: "lang/pl.json", key: `DRPG.Config.MONOCUB.abilities.meddle.thresholds.0.${k}`, issue: "S02-66", empties: "E25" })
        ]),
        Object.freeze({ in: "script", file: "scripts/config.mjs", quote: "You inflict \u22121", issue: "S02-66", empties: "E25" }),
        Object.freeze({ in: "script", file: "scripts/config.mjs", quote: "rattles you: \u22121", issue: "S02-66", empties: "E25" }),
        Object.freeze({ in: "script", file: "scripts/vault.mjs", quote: "\">\u2212</button>", issue: "S02-66", empties: "E25", why: "the Search Token spend button's label" }),
        Object.freeze({ in: "script", file: "scripts/action-rolls.mjs", quote: "\u2212", issue: "S02-66", empties: "E25", why: "`signed`, a roll's bonus" }),
        Object.freeze({ in: "script", file: "scripts/action-rolls.mjs", quote: "\u2212", issue: "S02-66", empties: "E25", why: "the duality formula's operator" }),
        Object.freeze({ in: "script", file: "scripts/roll-dialog.mjs", quote: "\u2212", issue: "S02-66", empties: "E25", why: "a situational source's sign, written as an escape" }),
        Object.freeze({ in: "script", file: "scripts/season-setup.mjs", quote: "\u2013", issue: "S06-52", empties: "E25", why: "an optional setup step's mark, written as an escape" })
    ])
});

/**
 * A FAIL detector's answer against its baseline: `left`, the findings no row
 * holds (red: new); `stale`, the rows no finding fills (red: the site is gone,
 * "take it out of the baseline"); `matched`; `rows`, how many were judged - a
 * row whose source the answer did not read (`in` not among its `sources`) is
 * not. Rows by key first, then the longest quote, so a broad quote cannot take
 * the finding a narrower one is for.
 */
const rank = site => (site.key !== null ? Number.MAX_SAFE_INTEGER : site.quote.length);

export function againstBaseline(result, rows = []) {
    const sites = rows.flatMap(row => (row.keys ?? [row.key ?? null]).map(key => ({ ...row, key, quote: row.quote ?? null })))
        .filter(s => !s.in || !Array.isArray(result?.sources) || result.sources.includes(s.in))
        .sort((a, b) => rank(b) - rank(a));
    const left = [...(result?.found ?? [])], stale = [];
    let matched = 0;
    for (const s of sites) {
        const at = left.findIndex(f => f.file === s.file && (!s.in || f.kind === s.in)
            && (s.key !== null ? f.key === s.key : String(f.text ?? "").includes(s.quote)));
        if (at < 0) stale.push(s);
        else { left.splice(at, 1); matched++; }
    }
    return { left, stale, matched, rows: sites.length };
}

/** A stale baseline row as a sentence. */
export const staleRow = (name, s) => `${name}'s baseline row ${s.file} ${s.key ?? `"${s.quote}"`} (${s.issue}) finds nothing - the site is gone: take it out of the baseline`;

/* --------------------------------- modes ----------------------------------- */

/**
 * Each detector's T number, whether its finding is red, from which stage, and
 * what it reads. The plan's five FAIL tests are T1, T2, T3, T6 and T14 (its
 * risk: a lint in FAIL from the first day would stop the gate on debt this stage
 * does not make); every other detector reports until the stage named in `fail`.
 * `reads` is what it needs, `also` what it reads when it is handed it (T6 the
 * English prose, which only Node has), `lexer` that it takes tests-lint.mjs's.
 * A FAIL detector with a baseline (BASELINES) is red only on what the baseline
 * does not hold, and on a row the files no longer fill.
 */
export const MODES = Object.freeze({
    pluralForms: Object.freeze({ test: "T1", mode: "fail", fail: "E65", reads: Object.freeze(["lang"]) }),
    configPlaceholders: Object.freeze({ test: "T1", mode: "fail", fail: "E65", reads: Object.freeze(["lang", "prose"]) }),
    pairParity: Object.freeze({ test: "T2", mode: "fail", fail: "E65", reads: Object.freeze(["lang"]) }),
    familyFormats: Object.freeze({ test: "T3", mode: "fail", fail: "E65", reads: Object.freeze(["lang", "scripts"]), lexer: true }),
    dashesIn: Object.freeze({ test: "T6", mode: "fail", fail: "E65", reads: Object.freeze(["lang", "scripts", "docs"]), also: Object.freeze(["prose"]), lexer: true }),
    tableWordProblems: Object.freeze({ test: "T14", mode: "fail", fail: "E65", reads: Object.freeze(["tables"]) }),
    glossaryHits: Object.freeze({ test: "T8", mode: "report", fail: "E25", reads: Object.freeze(["glossary", "lang", "docs"]), also: Object.freeze(["prose"]) }),
    retiredHits: Object.freeze({ test: "T28", mode: "report", fail: "E66", reads: Object.freeze(["glossary", "lang", "docs"]), also: Object.freeze(["prose"]) })
});

export const DETECTORS = Object.freeze({ pluralForms, configPlaceholders, pairParity, familyFormats, dashesIn, tableWordProblems, glossaryHits, retiredHits });

/** A finding as a fixture names it. */
export const itemOf = f => `${f.key} ${f.kind}`;

/* -------------------------------- fixtures --------------------------------- */

/**
 * Each detector's input with its findings known (`flags`, as `itemOf` writes
 * them). Here and not in a tier file for tests-lint.mjs's reason: the scans of
 * the module must not meet them. Every case that should pass is named in a
 * comment beside it; a fixture's dash or minus, when one is needed, is written
 * as an escape ("\u2013"), never the character (`dashes` reads code).
 */
export const FIXTURES = Object.freeze({
    pluralForms: {
        flags: ["DRPG.Fx.figs.many pl", "DRPG.Fx.figs.other pl", "DRPG.Fx.pears.few pl", "DRPG.Fx.plums.one en"],
        input: {
            en: {
                "DRPG.Fx.apples.one": "{n} apple", "DRPG.Fx.apples.other": "{n} apples",       // whole in both: passes
                "DRPG.Fx.pears.one": "{n} pear", "DRPG.Fx.pears.other": "{n} pears",           // pl lacks .few
                "DRPG.Fx.plums.other": "{n} plums",                                             // en lacks .one
                "DRPG.Fx.figs.one": "{n} fig", "DRPG.Fx.figs.other": "{n} figs",               // pl lacks .many and .other
                "DRPG.Fx.single": "One sentence"                                                // no family: passes
            },
            pl: {
                "DRPG.Fx.apples.one": "{n} jabłko", "DRPG.Fx.apples.few": "{n} jabłka", "DRPG.Fx.apples.many": "{n} jabłek", "DRPG.Fx.apples.other": "{n} jabłka",
                "DRPG.Fx.pears.one": "{n} gruszka", "DRPG.Fx.pears.many": "{n} gruszek", "DRPG.Fx.pears.other": "{n} gruszki",
                "DRPG.Fx.plums.one": "{n} śliwka", "DRPG.Fx.plums.few": "{n} śliwki", "DRPG.Fx.plums.many": "{n} śliwek", "DRPG.Fx.plums.other": "{n} śliwki",
                "DRPG.Fx.figs.one": "{n} figa", "DRPG.Fx.figs.few": "{n} figi",
                "DRPG.Fx.single": "Jedno zdanie",
                "DRPG.Fx.polishOnly.few": "{n} razy", "DRPG.Fx.polishOnly.many": "{n} razy"     // Polish forms, no English family: passes
            }
        }
    },
    configPlaceholders: {
        flags: ["DRPG.Config.FX.hint.y extra", "DRPG.Config.FX.label.w dropped", "DRPG.Config.FX.label.w extra", "DRPG.Config.FX.label.x dropped"],
        input: {
            prose: {
                "DRPG.Config.FX.label.x": "Lose {hp} Hit Points",          // pl drops {hp}
                "DRPG.Config.FX.hint.y": "No placeholder here",            // English fills none, pl adds {n}
                "DRPG.Config.FX.effect.z": "{who} gains {n} Hope",         // the same two, another order: passes
                "DRPG.Config.FX.label.w": "{n} left",                      // pl drops {n} and adds {count}
                "DRPG.Config.FX.label.v": "Not translated yet"             // pl lacks it: prose's, not read
            },
            pl: {
                "DRPG.Config.FX.label.x": "Tracisz Punkty Wytrzymałości",
                "DRPG.Config.FX.hint.y": "Tu jest {n}",
                "DRPG.Config.FX.effect.z": "{n} Nadziei dla {who}",
                "DRPG.Config.FX.label.w": "zostało {count}",
                "DRPG.Config.FX.label.u": "Tylko po polsku"                // no English prose: prose's extra, not read
            }
        }
    },
    pairParity: {
        flags: ["DRPG.Fx.bold tags", "DRPG.Fx.cards.few plural", "DRPG.Fx.dropped placeholders", "DRPG.Fx.extraWho placeholders", "DRPG.Fx.items.many plural"],
        input: {
            en: {
                "DRPG.Fx.same": "{name} opens {room}",                      // the same two, another order: passes
                "DRPG.Fx.extraWho": "{name} waits",                         // pl adds {who}
                "DRPG.Fx.dropped": "{name} takes {item}",                   // pl drops {item}
                "DRPG.Fx.article": "{a} {item}",                            // {a} set aside: passes
                "DRPG.Fx.bold": "<b>{name}</b> wins",                       // pl drops the <b>
                "DRPG.Fx.boldKept": "<b>{name}</b> wins",                   // passes
                "DRPG.Fx.entity": "one&nbsp;line",                          // an entity is no tag: passes
                "DRPG.Fx.arrow": " <- wins",                                // an arrow is no tag: passes
                "DRPG.Fx.attr": "<span title=\"Room\">{n}</span>",          // another attribute: passes
                "DRPG.Fx.items.one": "{n} item", "DRPG.Fx.items.other": "{n} items",
                "DRPG.Fx.cards.one": "{n} card", "DRPG.Fx.cards.other": "{n} cards",
                "DRPG.Fx.onlyEnglish": "{name} alone"                       // pl lacks it: parity's, not read
            },
            pl: {
                "DRPG.Fx.same": "{room}: {name} otwiera",
                "DRPG.Fx.extraWho": "{name} czeka na {who}",
                "DRPG.Fx.dropped": "{name} bierze",
                "DRPG.Fx.article": "{item}",
                "DRPG.Fx.bold": "{name} wygrywa",
                "DRPG.Fx.boldKept": "<b>{name}</b> wygrywa",
                "DRPG.Fx.entity": "jedna linia",
                "DRPG.Fx.arrow": " <- wygrywa",
                "DRPG.Fx.attr": "<span title=\"Pokój\">{n}</span>",
                "DRPG.Fx.items.one": "{n} rzecz", "DRPG.Fx.items.few": "{n} rzeczy", "DRPG.Fx.items.many": "rzeczy", "DRPG.Fx.items.other": "{n} rzeczy",
                "DRPG.Fx.cards.one": "{n} karta", "DRPG.Fx.cards.few": "{n} karty dla {who}", "DRPG.Fx.cards.many": "{n} kart", "DRPG.Fx.cards.other": "{n} karty"
            }
        }
    },
    familyFormats: {
        flags: ["DRPG.Fx.bells format", "DRPG.Fx.cards localize", "DRPG.Fx.coins format", "DRPG.Fx.cups localize", "DRPG.Fx.forks format",
            "DRPG.Fx.items format", "DRPG.Fx.keys format", "DRPG.Fx.maps localize", "DRPG.Fx.pens format"],
        input: {
            en: {
                ...Object.fromEntries(["items", "cards", "coins", "keys", "maps", "pens", "cups", "bells", "forks"]
                    .flatMap(f => [[`DRPG.Fx.${f}.one`, `{n} ${f.slice(0, -1)}`], [`DRPG.Fx.${f}.other`, `{n} ${f}`]])),
                "DRPG.Fx.single": "One sentence"
            },
            scripts: {
                "scripts/fx-a.mjs": [
                    "import { plural } from \"./utils.mjs\";",
                    "const a = game.i18n.format(\"DRPG.Fx.items\", { n });",                                         // flagged
                    "const b = game.i18n.localize(\"DRPG.Fx.cards\");",                                              // flagged
                    "const c = game.i18n.format(band === \"x\" ? \"DRPG.Fx.coins\" : \"DRPG.Fx.keys\", { n });",       // both branches flagged
                    "const d = game.i18n?.localize?.(\"DRPG.Fx.maps\");",                                            // optional chaining: flagged
                    "const e = plural(\"DRPG.Fx.items\", { n });",                                                    // through plural: passes
                    "const f = game.i18n.format(\"DRPG.Fx.items.one\", { n });",                                     // a form's own key: passes
                    "const g = game.i18n.format(`DRPG.Fx.${kind}`, { n });",                                          // built by a template: unresolved
                    "// game.i18n.format(\"DRPG.Fx.items\", { n });",                                                 // a comment: passes
                    "const h = \"game.i18n.format(\\\"DRPG.Fx.items\\\")\";",                                       // inside a string: passes
                    "add(\"rows\", \"missing\", \"DRPG.Fx.items\", { n });",                                           // handed on: passes
                    "const i = game.i18n.format(on ? \"DRPG.Fx.single\" : (off ? \"DRPG.Fx.pens\" : x), {});",        // nested: pens flagged
                    "const fmt = game.i18n.format; fmt(\"DRPG.Fx.items\");",                                          // an alias: not in scope
                    "const j = game.i18n.format(pick(\"DRPG.Fx.items\"), {});",                                       // another call's argument: passes
                    "const k = game.i18n.format(a ?? \"DRPG.Fx.items\", {});",                                        // a fallback, no conditional: passes
                    "const l = game.i18n.localize(`DRPG.Fx.cups`);",                                                  // a template with no hole: flagged
                    "const m = game.i18n.format(x?.y ? \"DRPG.Fx.bells\" : \"DRPG.Fx.single\");",                      // "?." in the condition: bells flagged
                    "const o = game.i18n.format(a ?? b ? \"DRPG.Fx.forks\" : \"DRPG.Fx.single\");"                     // "??" before the "?": forks flagged
                ].join("\n")
            }
        }
    },
    dashesIn: {
        flags: ["DRPG.Config.FX.x prose", "DRPG.Fx.a en", "DRPG.Fx.c pl", "docs/fx.md \"A line \u2013 here\" doc", "docs/fx.md \"`a \u2212 1` in cod\" doc",
            "scripts/fx-dash.mjs \"<b>\u2212</b>\" script", "scripts/fx-dash.mjs \"Wait \u2013 here\" script", "scripts/fx-dash.mjs \"\u2212\" script",
            "scripts/fx-dash.mjs \"\u22121\" script"],
        input: {
            en: { "DRPG.Fx.a": "One \u2013 two", "DRPG.Fx.b": "fine - ascii" },                // an en dash; a hyphen passes
            pl: { "DRPG.Fx.a": "Raz - dwa", "DRPG.Fx.c": "\u22121 do rzutu" },                  // a minus sign
            prose: { "DRPG.Config.FX.x": "Lose \u2014 all", "DRPG.Config.FX.y": "Plain words" }, // an em dash
            scripts: {
                "scripts/fx-dash.mjs": [
                    "const a = \"Wait \u2013 here\";",                         // the character in a string: flagged
                    "const b = \"\\u2212\" + n;",                             // an escape in a string: flagged
                    "// a comment \u2014 here",                                // a comment: passes
                    "// a \"quoted \u2013 line\" in a comment",                  // quotes in a comment are no string: passes
                    "const re = /[\u2013\u2014]/;",                           // a regex literal: passes
                    "const t = `<b>\u2212</b>${n}`;",                           // a template's text: flagged
                    "const u = `${n < 0 ? \"\u22121\" : \"+1\"}`;",              // a string inside ${...}: flagged
                    "const d = a - b;",                                         // a hyphen: passes
                    "const k = x \u2212 y;",                                   // in code, no string: not read
                    "const url = \"https://example.com/a-b\";",                 // a URL's hyphen: passes
                    "/* a block \u2013 */",                                    // a comment: passes
                    "const v = `a ${\"plain\"} b`;"                             // passes
                ].join("\n")
            },
            docs: { "docs/fx.md": "# Title\nA line \u2013 here\n`a \u2212 1` in code\nPlain - line\n" }   // lines 2 and 3 flagged
        }
    },
    tableWordProblems: {
        flags: ["LEGACY_PLURALS.a shrunk", "kind.s lost", "plural.c lost", "plural.d gone"],
        input: {
            words: {
                plural: { a: "Apples", b: "Big Pears", c: "Cherries", e: "Eggs" },   // a the same, b reworded with its old word kept, c reworded, d gone, e new
                kind: { h: "Healing", s: "Calm" }                                     // h the same, s reworded
            },
            legacyPlurals: { a: ["Old Apples"], b: ["Pears"] },                       // a lost "Older Apples"
            legacyGoalLabels: { s: ["Stress"] },
            known: { plural: { a: "Apples", b: "Pears", c: "Cherry", d: "Dates" }, kind: { h: "Healing", s: "Relief" } },
            knownLegacy: { plurals: { a: ["Old Apples", "Older Apples"] }, goalLabels: { s: ["Stress"] } }
        }
    },
    glossaryHits: {
        /* Two ledgers (E65-11): as `input` E01 has shipped and E02 not, so fx-not-due holds nothing yet and its hit is
           pending; `also` ships E02 too, and the same hit is debt. */
        flags: ["fx-bribe@DRPG.Fx.bribe pl", "fx-gm@DRPG.Fx.gm1 pl", "fx-gm@DRPG.Fx.gm2 pl", "fx-remnant@DRPG.Config.FX.trace en", "fx-remnant@DRPG.Fx.trace en",
            "fx-remnant@DRPG.Fx.slad pl", "fx-remnant@DRPG.Fx.sladzie pl", "fx-remnant@docs/handbooks/fx.en.md:2 en", "fx-remnant@docs/handbooks/fx.pl.md:1 pl",
            "fx-token@DRPG.Fx.lower en-case", "fx-token@DRPG.Fx.lowerPl pl-case"],
        pending: ["fx-not-due@DRPG.Fx.failure en"],
        also: [{ input: { shipped: ["E01", "E02"] }, add: ["fx-not-due@DRPG.Fx.failure en"] }],
        input: {
            shipped: ["E01"],
            glossary: { entries: [
                { id: "fx-remnant", en: "Remnant", pl: "Remnant", gender: "m", inflection: null, stage: "E01", source: ["DB15"],
                    forbidden: { en: { variants: [{ stem: "trace", endings: ["", "s"] }], scope: ["ui", "handbooks"], case: "any", except: ["Secure a Trace"] },
                        pl: { variants: [{ stem: "ślad", endings: ["", "u", "zie", "y"] }], scope: ["ui", "handbooks"], case: "any" } } },
                { id: "fx-not-due", en: "Debug log", pl: null, gender: null, inflection: null, stage: "E02", source: ["D33f"],
                    forbidden: { en: { variants: ["Failure log"], scope: ["ui"] }, pl: { variants: [], scope: ["ui"] } } },
                { id: "fx-token", en: "Search Token", pl: "Search Token", gender: "m", inflection: null, stage: "E01", source: ["DB17"],
                    forbidden: { en: { variants: [], scope: ["ui"], otherCase: true }, pl: { variants: [], scope: ["ui"], otherCase: true } } },
                { id: "fx-gm", en: null, pl: "GM-a", gender: null, inflection: null, stage: "E01", source: ["D33c"],
                    forbidden: { en: { variants: [], scope: ["ui"] }, pl: { variants: ["GMa", "GM'a"], scope: ["ui"] } } },
                { id: "fx-bribe", en: "Bribe", pl: "Bribe", gender: null, inflection: null, stage: "E01", source: ["DB38"],
                    forbidden: { en: { variants: [], scope: ["ui"] }, pl: { variants: [{ stem: "łapówk", endings: ["a", "i", "ę"] }], scope: ["ui"] } } },
                { id: "fx-open", en: "crime tool", pl: null, gender: null, inflection: null, stage: "E01", source: ["DB16"], open: true,
                    forbidden: { en: { variants: [], scope: ["ui"] }, pl: { variants: [], scope: ["ui"] } } }
            ] },
            en: {
                "DRPG.Fx.trace": "You leave a trace behind.",                 // flagged
                "DRPG.Fx.secure": "Secure a Trace: keep it.",                 // inside the shield: passes
                "DRPG.Fx.secureLower": "Secure a trace now.",                 // the shield is read in any case: passes here (the five names' own entry reads the case)
                "DRPG.Fx.traceable": "A traceable thing",                     // not a whole word: passes
                "DRPG.Fx.retrace": "Retrace your steps",                      // not a whole word either (the variant ends it): passes
                "DRPG.Fx.failure": "Open the Failure log",                    // fx-not-due: pending, debt under the second ledger
                "DRPG.Fx.lower": "Spend a search token",                      // flagged: another case
                "DRPG.Fx.right": "Spend a Search Token",                      // passes
                "DRPG.Fx.crime": "the crime tool"                             // an open entry: passes
            },
            prose: { "DRPG.Config.FX.trace": "Traces everywhere" },          // flagged: case any
            pl: {
                "DRPG.Fx.slad": "Ślad zostaje",                               // flagged: case any
                "DRPG.Fx.sladzie": "w śladzie",                               // flagged: an ending
                "DRPG.Fx.sladowy": "śladowy",                                 // no such ending: passes
                "DRPG.Fx.remnant": "Remnant zostaje",                         // passes
                "DRPG.Fx.gm1": "u GMa",                                       // flagged
                "DRPG.Fx.gm2": "bez GM'a",                                    // flagged
                "DRPG.Fx.gm3": "bez GM-a",                                    // passes
                "DRPG.Fx.lowerPl": "Wydaj search token",                      // flagged: another case
                "DRPG.Fx.bribe": "Bribe, łapówka po polsku"                   // flagged: fx-bribe reads the ui
            },
            docs: {
                "docs/handbooks/fx.en.md": "# Remnant\nA trace stays.\nSecure a Trace.",   // line 2 flagged
                "docs/handbooks/fx.pl.md": "Ślady\nŁapówka stoi w podręczniku.",              // line 1 flagged; fx-bribe is ui only: line 2 passes
                "docs/other.md": "a trace"                                                     // not a handbook: not read
            }
        }
    },
    retiredHits: {
        flags: ["fx-a10@DRPG.Passage.bare pl", "fx-a10@DRPG.Passage.plural pl", "fx-a11@DRPG.Frisk.ask en", "fx-a11@DRPG.Frisk.ask pl",
            "fx-a11@DRPG.Frisk.refuse button", "fx-doors@DRPG.Config.ACTIONS.listen.label en", "fx-doors@DRPG.Config.ACTIONS.listen.label pl",
            "fx-floor@DRPG.Floor.yield pl", "fx-lockpicking@docs/handbooks/fx.en.md:1 en", "fx-objection@DRPG.Fx.undo pl", "fx-work-out@DRPG.Fx.work en"],
        pending: ["fx-not-due@DRPG.Fx.errand en"],
        input: {
            shipped: ["E01"],
            glossary: { retired: [
                { id: "fx-work-out", en: ["Work Out"], pl: ["Work Out"], scope: "text", stage: "E01", source: ["DA38"] },
                { id: "fx-doors", en: ["Doors"], pl: ["Doors"], scope: "label", stage: "E01", source: ["DA27"] },
                { id: "fx-lockpicking", en: ["Lockpicking"], pl: ["Lockpicking"], scope: "text", stage: "E01", source: ["DX4"],
                    pass: [{ key: "DRPG.Fx.lockHistory", why: "a line of history" }] },
                { id: "fx-objection", en: ["Undo the Objection"], pl: ["Cofnij Objection", "Oddal Objection"], scope: "text", stage: "E01", source: ["TR25", "DB41"] },
                { id: "fx-floor", en: [], pl: ["Oddaj głos"], scope: "keys", keys: ["DRPG.Floor."], stage: "E01", source: ["TR10"],
                    pass: [{ key: "DRPG.Vote.cast", why: "casting a vote, not yielding the floor" }] },
                { id: "fx-not-due", en: ["Errand"], pl: [], scope: "text", stage: "E02", source: ["DA35"] },
                { id: "fx-a10", en: [], pl: [], scope: "keys", keys: ["DRPG.Passage."], rule: "passageWords", stage: "E01", source: ["A10"] },
                { id: "fx-a11", en: [], pl: [], scope: "keys", keys: ["DRPG.Frisk."], rule: "friskWords", button: { key: "DRPG.Frisk.refuse", pl: "Odmów" }, stage: "E01", source: ["A11", "TR8"] }
            ] },
            en: {
                "DRPG.Fx.work": "Work Out clears Sanity",                     // flagged
                "DRPG.Fx.closed": "Behind Closed Doors",                      // "Doors" in a sentence: passes
                "DRPG.Vault.tabDoors": "Doors",                               // a tab, not a tile's label: passes
                "DRPG.Fx.errand": "Run an Errand",                            // fx-not-due: pending
                "DRPG.Frisk.ask": "Ask for consent first",                    // flagged: any case
                "DRPG.Fx.lockHistory": "Lockpicking was retired"              // a pass row: passes
            },
            prose: { "DRPG.Config.ACTIONS.listen.label": "Doors", "DRPG.Config.ACTIONS.search.label": "Search" },   // listen flagged
            pl: {
                "DRPG.Config.ACTIONS.listen.label": "Doors",                  // flagged
                "DRPG.Fx.undo": "Cofnij Objection",                           // flagged
                "DRPG.Floor.yield": "Oddaj głos",                             // flagged: the floor's key
                "DRPG.Vote.cast": "Oddaj głos",                               // the vote button: passes, with its why
                "DRPG.Fx.cast": "Oddaj głos",                                 // outside the floor's keys: passes
                "DRPG.Passage.secret": "Tajne przejście do: {room}",         // passes
                "DRPG.Passage.secret2": "szuka tajnego przejścia",          // passes
                "DRPG.Passage.bare": "Przejście jest gotowe",                // flagged
                "DRPG.Passage.plural": "Znane tajne przejścia i inne przejścia",   // the second flagged
                "DRPG.Passage.name": "Find Passage: znajdź tajne przejście", // passes
                "DRPG.Move.free": "Przejście kosztuje Move",                 // not a passage text: passes
                "DRPG.Frisk.ask": "Bez Consent",                              // flagged
                "DRPG.Frisk.refuse": "Odrzuć"                                 // flagged: the button is "Odmów"
            },
            docs: { "docs/handbooks/fx.en.md": "Lockpicking is gone." }     // flagged
        }
    }
});

/** `legacyListsFrom`'s own case: both literals, an empty list, a commented-out copy before the real one, and a text with neither. */
export const LEGACY_TEXT_FIXTURE = Object.freeze({
    text: ["const LEGACY_PLURALS = {", "    usable: [\"Usable Items\", \"U\u017cytkowe\"],", "    tool: []", "};",
        "// const LEGACY_GOAL_LABELS = { not: [\"this\"] };", "const LEGACY_GOAL_LABELS = {", "    stress: [\"Stress Relief\"]", "};"].join("\n"),
    want: { legacyPlurals: { usable: ["Usable Items", "U\u017cytkowe"], tool: [] }, legacyGoalLabels: { stress: ["Stress Relief"] } }
});

/**
 * The baseline matcher's own case (`againstBaseline`): a key row, three quote
 * rows of one file (the broad one first, so the order of the rows is read), a
 * row whose source was not read and a row whose site is gone, against five
 * findings - one a second call of a key the baseline holds once.
 */
export const BASELINE_FIXTURE = Object.freeze({
    result: {
        sources: ["script", "pl"],
        found: [
            { file: "fx/a.mjs", key: "K1", kind: "format" }, { file: "fx/a.mjs", key: "K1", kind: "format" },
            { file: "fx/b.mjs", key: "b1", kind: "script", text: "p \u2212 q" }, { file: "fx/b.mjs", key: "b2", kind: "script", text: "r \u2212" },
            { file: "fx/c.json", key: "Z", kind: "pl", text: "\u2013" }
        ]
    },
    rows: [
        { file: "fx/a.mjs", keys: ["K1"], issue: "S00-01", empties: "E99" },
        { in: "script", file: "fx/b.mjs", quote: "\u2212", issue: "S00-02", empties: "E99" },
        { in: "script", file: "fx/b.mjs", quote: "p \u2212", issue: "S00-03", empties: "E99" },
        { in: "script", file: "fx/b.mjs", quote: "gone", issue: "S00-04", empties: "E99" },
        { in: "prose", file: "fx/config.mjs", key: "P", issue: "S00-05", empties: "E99" },
        { in: "pl", file: "fx/c.json", key: "Y", issue: "S00-06", empties: "E99" }
    ],
    want: { left: ["fx/a.mjs K1", "fx/c.json Z"], stale: ["fx/b.mjs gone", "fx/c.json Y"], matched: 3, rows: 5 }
});

/**
 * `glossarySchema`'s own case (E65-10): one whole entry and one whole retired row that pass,
 * then one fault each - an entry with no `stage`, one whose stage is no ledger row ("E99"),
 * an id used twice, a field the file does not know, a scope it does not know, an open entry
 * that forbids something, a variant that is neither a phrase nor a stem with endings, a
 * source that is no decision, and a retired row that reads keys and names no prefix - each
 * one sentence, exactly these.
 */
export const GLOSSARY_SCHEMA_FIXTURE = Object.freeze({
    stages: ["E01"],
    doc: {
        $comment: "fixture",
        entries: [
            { id: "fx-ok", en: "Remnant", pl: "Remnant", gender: "m", inflection: null, stage: "E01", source: ["DB15"],
                forbidden: { en: { variants: ["trace"], scope: ["ui"] }, pl: { variants: [{ stem: "ślad", endings: ["", "u"] }], scope: ["ui", "handbooks"] } } },
            { id: "fx-no-stage", en: "A", pl: "A", gender: null, inflection: null, source: ["DB1"],
                forbidden: { en: { variants: [], scope: ["ui"] }, pl: { variants: [], scope: ["ui"] } } },
            { id: "fx-e99", en: "B", pl: "B", gender: null, inflection: null, stage: "E99", source: ["DB2"],
                forbidden: { en: { variants: [], scope: ["ui"] }, pl: { variants: [], scope: ["ui"] } } },
            { id: "fx-ok", en: "C", pl: "C", gender: "x", inflection: null, stage: "E01", source: ["DB3"], colour: "red",
                forbidden: { en: { variants: [], scope: ["menus"] }, pl: { variants: [], scope: ["ui"] } } },
            { id: "fx-open", en: "D", pl: null, gender: null, inflection: null, stage: "E01", source: ["O8"], open: true,
                forbidden: { en: { variants: ["d"], scope: ["ui"] }, pl: { variants: [{ stem: "d" }], scope: ["ui"] } } }
        ],
        retired: [
            { id: "fx-gone", en: ["Work Out"], pl: ["Work Out"], scope: "text", stage: "E01", source: ["DA38"] },
            { id: "fx-keys", en: [], pl: ["Oddaj głos"], scope: "keys", stage: "E01", source: ["TR10"] }
        ]
    },
    want: [
        "entry 2 (fx-no-stage) has no \"stage\"",
        "entry 3 (fx-e99)'s stage \"E99\" is no row of tools/stages.json",
        "entry 4 (fx-ok) has a field \"colour\" the glossary does not know",
        "entry 4 (fx-ok): the id \"fx-ok\" is used twice",
        "entry 4 (fx-ok)'s gender \"x\" is not m, f, n or null",
        "entry 4 (fx-ok)'s forbidden.en's scope is not \"ui\", \"handbooks\" or both",
        "entry 5 (fx-open)'s source [\"O8\"] is not a list of decisions (D, DB, DA, DC, DX, TR), amends (A), issues (S) or a plan entry",
        "entry 5 (fx-open)'s forbidden.en: an open entry forbids nothing",
        "entry 5 (fx-open)'s forbidden.pl's variants are not phrases or { stem, endings }",
        "entry 5 (fx-open)'s forbidden.pl: an open entry forbids nothing",
        "retired 2 (fx-keys) reads keys and names no key prefix"
    ]
});

/**
 * `budgetsSchema`'s own case (E65-14): a surface with a limit and one reported only
 * (null), a rule by keys and one by sender, an allow row with all four fields - these
 * pass; then one fault each - a field the file does not know, a limit at its target
 * and one over twice it, a surface with no target and a field it does not know, a
 * pattern that is no regular expression, a rule with both keys and a sender, a sender
 * nobody sends through, a rule naming no surface of the file, a surface no rule names,
 * the slice's allow row without its `why`, a rule that is no lint rule and a stage that
 * is no ledger row, and a key allowed twice for one rule - each one sentence, exactly these.
 */
export const BUDGETS_SCHEMA_FIXTURE = Object.freeze({
    stages: ["E01"],
    doc: {
        $comment: "fixture", status: "fixture", unit: "words", extra: 1,
        surfaces: {
            "fx-label": { target: 3, limit: 5, what: "a label" },
            "fx-diag": { target: 60, limit: null, what: "reported only" },
            "fx-tight": { target: 4, limit: 4, what: "a limit at its target" },
            "fx-loose": { target: 4, limit: 9, what: "a limit over twice its target" },
            "fx-none": { limit: 6, what: "no target", colour: "red" },
            "fx-unread": { target: 10, limit: 15, what: "no rule names it" }
        },
        rules: [
            { surface: "fx-label", keys: "\\.label$" },
            { surface: "fx-diag", sender: ["whisperToGms"] },
            { surface: "fx-tight", keys: "(" },
            { surface: "fx-loose", keys: "x", sender: ["announce"] },
            { surface: "fx-none", sender: ["shout"] },
            { surface: "fx-gone", keys: "y" }
        ],
        allow: [
            { key: "DRPG.Fx.ok", rule: "T4", why: "a reason", until: "E01" },
            { key: "DRPG.Fx.noWhy", rule: "X3", until: "E01" },
            { key: "DRPG.Fx.late", rule: "X22", why: "a reason", until: "E99" },
            { key: "DRPG.Fx.ok", rule: "T4", why: "again", until: "E01" }
        ]
    },
    want: [
        "docs/text-budgets.json has a field \"extra\" the budgets do not know",
        "surface fx-tight's limit 4 is not above its target 4 and at most twice it (DB11: about 1.5 times)",
        "surface fx-loose's limit 9 is not above its target 4 and at most twice it (DB11: about 1.5 times)",
        "surface fx-none has no \"target\"",
        "surface fx-none has a field \"colour\" the budgets do not know",
        "rule 3's keys \"(\" is no regular expression",
        "rule 4 reads both keys and a sender - one of them, never both",
        "rule 5's sender [\"shout\"] is not a list of the senders tests-text.mjs knows (SENDERS)",
        "rule 6's surface \"fx-gone\" is no surface of the file",
        "surface fx-unread is named by no rule - no key can reach its budget",
        "allow 2 (DRPG.Fx.noWhy) has no \"why\"",
        "allow 3 (DRPG.Fx.late)'s rule \"X22\" is not T4, T16 or an X rule (X1 to X21)",
        "allow 3 (DRPG.Fx.late)'s until \"E99\" is no row of tools/stages.json",
        "allow 4 (DRPG.Fx.ok): the key \"DRPG.Fx.ok\" is allowed twice for T4"
    ]
});

/**
 * Every detector on its fixture: [] when each flags exactly its fixture's items
 * and read something, else one sentence a mismatch. `detectors` defaults to this
 * file's; check.mjs and R1058 pass none, a planted fault passes its own. `tools`
 * goes into every fixture's bag - the lexer, which a detector that reads code
 * needs and this file cannot import. Then every baseline row is well formed and
 * belongs to a FAIL detector, and `legacyListsFrom`, the matcher and the two
 * schemas (the glossary's, the budgets') answer their own cases.
 */
export function selfCheck(detectors = DETECTORS, tools = {}) {
    const out = [];
    const names = new Set([...Object.keys(MODES), ...Object.keys(FIXTURES)]);
    for (const name of names) {
        if (!MODES[name]) { out.push(`${name} has a fixture and no mode`); continue; }
        const fx = FIXTURES[name];
        if (!fx) { out.push(`${name} has a mode and no fixture`); continue; }
        const run = detectors?.[name];
        if (typeof run !== "function") { out.push(`${name} is not a detector`); continue; }
        let r;
        try { r = run({ ...tools, ...fx.input }); } catch (err) { out.push(`${name} throws on its fixture (${err?.message ?? err})`); continue; }
        const items = (r?.found ?? []).map(itemOf).sort(), want = [...fx.flags].sort();
        if (!same(items, want)) out.push(`${name} flags ${items.length ? items.join(", ") : "none"} of its fixture, not ${want.join(", ")} - the detector is broken`);
        if (!(r?.read > 0)) out.push(`${name} read nothing of its fixture`);
        /* What a detector that splits by stage holds back as not yet due (T8, T28), and its fixture under another ledger (E65-11). */
        if (fx.pending) {
            const held = (r?.pending ?? []).map(itemOf).sort(), notDue = [...fx.pending].sort();
            if (!same(held, notDue)) out.push(`${name} holds back ${held.length ? held.join(", ") : "nothing"} of its fixture as not yet due, not ${notDue.join(", ")} - the stage rule is broken`);
        }
        for (const [i, v] of (fx.also ?? []).entries()) {
            let rv;
            try { rv = run({ ...tools, ...fx.input, ...v.input }); } catch (err) { out.push(`${name} throws on its fixture's case ${i + 2} (${err?.message ?? err})`); continue; }
            const got = (rv?.found ?? []).map(itemOf).sort(), wantAlso = [...fx.flags, ...v.add].sort();
            if (!same(got, wantAlso)) out.push(`${name} flags ${got.length ? got.join(", ") : "none"} of its fixture's case ${i + 2} (${JSON.stringify(v.input)}), not ${wantAlso.join(", ")} - the stage rule is broken`);
        }
    }
    for (const [name, rows] of Object.entries(BASELINES)) {
        if (MODES[name]?.mode !== "fail") out.push(`${name} has a baseline and is no FAIL detector`);
        rows.forEach((row, i) => {
            const site = (Array.isArray(row.keys) && row.keys.length > 0) || typeof row.key === "string" || typeof row.quote === "string";
            if (typeof row.file !== "string" || !site || !/^S\d\d-\d\d$/.test(row.issue ?? "") || !/^E\d\d$/.test(row.empties ?? "")) {
                out.push(`${name}'s baseline row ${i + 1} lacks a file, a site (keys, key or quote), its issue or the stage that empties it`);
            }
        });
    }
    const lists = [JSON.stringify(legacyListsFrom(LEGACY_TEXT_FIXTURE.text)), JSON.stringify(legacyListsFrom("const OTHER = {};"))];
    const listsWant = [JSON.stringify(LEGACY_TEXT_FIXTURE.want), JSON.stringify({ legacyPlurals: null, legacyGoalLabels: null })];
    if (lists[0] !== listsWant[0] || lists[1] !== listsWant[1]) out.push(`legacyListsFrom reads ${lists.join(" and ")} off its fixture, not ${listsWant.join(" and ")} - T14 would read the wrong lists`);
    const b = againstBaseline(BASELINE_FIXTURE.result, BASELINE_FIXTURE.rows);
    const got = JSON.stringify({ left: b.left.map(f => `${f.file} ${f.key}`).sort(), stale: b.stale.map(st => `${st.file} ${st.key ?? st.quote}`).sort(),
        matched: b.matched, rows: b.rows });
    if (got !== JSON.stringify(BASELINE_FIXTURE.want)) out.push(`againstBaseline answers ${got} on its fixture, not ${JSON.stringify(BASELINE_FIXTURE.want)} - the baseline matcher is broken`);
    const schema = glossarySchema(GLOSSARY_SCHEMA_FIXTURE.doc, GLOSSARY_SCHEMA_FIXTURE.stages);
    if (JSON.stringify(schema) !== JSON.stringify(GLOSSARY_SCHEMA_FIXTURE.want)) {
        out.push(`glossarySchema answers ${JSON.stringify(schema)} on its fixture, not ${JSON.stringify(GLOSSARY_SCHEMA_FIXTURE.want)} - a fault in docs/glossary.json would pass`);
    }
    const budgets = budgetsSchema(BUDGETS_SCHEMA_FIXTURE.doc, BUDGETS_SCHEMA_FIXTURE.stages);
    if (JSON.stringify(budgets) !== JSON.stringify(BUDGETS_SCHEMA_FIXTURE.want)) {
        out.push(`budgetsSchema answers ${JSON.stringify(budgets)} on its fixture, not ${JSON.stringify(BUDGETS_SCHEMA_FIXTURE.want)} - a fault in docs/text-budgets.json would pass`);
    }
    return out;
}
