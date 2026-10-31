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
 * At C6 the five report detectors of the guide's rules (E65-15), each a candidate
 * list for a reader, never a verdict, every pattern rebuilt 30.10 as its rule is:
 * T4 (`lengthOver`, words against docs/text-budgets.json's surfaces, a key's
 * surface read by its name or by the call that posts it - `surfacesOf`, the
 * orchestrator's reading of 31.10 until C11's audience map), T5 (`patterns`, one
 * matcher per X rule of the guide, X_RULES), T7's part (`ruleNumberWords`, a
 * rule's number written as a word), T21 (`monokumaVoice`, DB1, DB5, PL4) and T24
 * (`colonChains`, more than two colons in a string). Their bag adds `budgets`
 * (the parsed file); T4, T5 and T21 read the scripts for the senders when handed
 * them, with the lexer.
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
 * and `what` (who reads it, one sentence), and `fail` (E65 C6: the stage from which a
 * text over that surface's limit is red - DB11's "FAIL dla tekstów gracza i ustawień",
 * read by the orchestrator on 31.10 as E71 for the player's and the settings' texts -
 * or null where it stays a report; a ledger row, and null where the limit is);
 * `rules`, which keys belong to which surface,
 * the first that names a key winning - by the key (`keys`, a regular expression over
 * the whole key) or by the function that sends it (`sender`, names of SENDERS), never
 * both - and a key no rule names is "unclassified"; `allow`, the exceptions, each
 * silencing one `key` for one `rule` (T4 or an X rule of the guide; not T16, which
 * has no allow list - the T-table, and the orchestrator on C5's Open 33) with its
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
    surface: Object.freeze({ required: ["target", "limit", "what", "fail"], optional: ["note"] }),
    rule: Object.freeze({ required: ["surface"], optional: ["keys", "sender", "note"] }),
    allow: Object.freeze({ required: ["key", "rule", "why", "until"], optional: [] })
});
/** The functions a key reaches its reader through (the audience map's senders, E65 C11; utils.mjs, action-rolls.mjs, incident-store.mjs, murder-rules.mjs). */
export const SENDERS = Object.freeze(["ui.notifications", "announce", "announceCrisis", "whisperToOwner", "whisperToOwnerOnly", "whisperToGms", "roomAudience", "incidentAudienceIds"]);
const ALLOW_RULE = /^(?:T4|X(?:[1-9]|1\d|2[01]))$/;
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
        if (Object.hasOwn(s, "fail") && s.fail !== null) {
            if (!(typeof s.fail === "string" && stages.has(s.fail))) out.push(`${where}'s fail ${JSON.stringify(s.fail)} is neither a row of tools/stages.json nor null`);
            else if (s.limit === null) out.push(`${where} fails from ${s.fail} and has no limit - a surface reported only is never red`);
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
        if (Object.hasOwn(a, "rule") && !(typeof a.rule === "string" && ALLOW_RULE.test(a.rule))) out.push(`${where}'s rule ${JSON.stringify(a.rule)} is not T4 or an X rule (X1 to X21)`);
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

/* ------------------------- the report detectors (C6) ----------------------- */

/**
 * WHAT C6'S FIVE READ (E65 C6, 31.10.2026): the module's UI strings, one unit a
 * string - en.json's values and config.mjs's English prose ("en"), pl.json's
 * values ("pl") - and, where a rule says so, the handbooks a line at a time.
 * `at` is the key; `where` names the file. The same units for every detector, so
 * their counts add up over the same ground.
 */
function uiUnits(bag) {
    const out = [];
    for (const [key, text] of asMap(bag.en)) if (typeof text === "string") out.push({ key, lang: "en", where: `lang/en.json ${key}`, text });
    for (const [key, text] of asMap(bag.prose)) if (typeof text === "string") out.push({ key, lang: "en", where: `config.mjs's prose ${key}`, text });
    for (const [key, text] of asMap(bag.pl)) if (typeof text === "string") out.push({ key, lang: "pl", where: `lang/pl.json ${key}`, text });
    return out;
}

/** A string's text with its HTML tags and entities blanked to spaces (a tag is htmlTags's: a letter first, so "<-" stays). */
const untagged = text => String(text ?? "").replace(/<\/?[a-z][a-z0-9]*\b[^<>]*>/gi, " ").replace(/&(?:[a-z]+|#\d+);/gi, " ");

/**
 * The words of a string, as T4 counts them against a budget: tags and entities
 * out, a placeholder one word ("{name}" is a name on the screen), a token with no
 * letter, digit or placeholder in it - a lone "-", "/", "...", an arrow - none.
 */
export function wordCount(text) {
    return untagged(text).split(/\s+/).filter(t => /[\p{L}\p{N}]|\{\w+\}/u.test(t)).length;
}

/* The family a key is a form of ("DRPG.X.few" -> "DRPG.X"), or the key itself. */
const familyOf = key => key.replace(/\.(?:zero|one|two|few|many|other)$/, "");

/* A call that posts or shows a text: a toast, one of utils.mjs's and murder-rules.mjs's posters, or ChatMessage.create
   (read only for the audience it is handed). Not after a "." (a method of something else) or a word character. */
const SENDER_CALL = /(?<![\w$.])(ui\s*\.\s*notifications\s*\??\.\s*[A-Za-z]+|announce|announceCrisis|whisperToOwner|whisperToOwnerOnly|whisperToGms|ChatMessage\s*\.\s*create)\s*(?:\?\.\s*)?\(/g;
/* A literal that reads as a key: a capitalised first part ("DRPG", "DAGGERHEART"), then dotted parts. Not checked against
   the language files, so the reading depends on the scripts alone; a literal that is no key is never asked about. */
const KEY_LITERAL = /^[A-Z][A-Za-z]*(?:\.[\w-]+)+$/;
const AUDIENCE_CALL = /(?<![\w$.])(roomAudience|incidentAudienceIds)\s*\(/g;

/**
 * WHO A KEY IS POSTED BY, READ OFF THE CALLS THAT POST IT (E65 C6; the
 * orchestrator's decision of 31.10 on C5's Open 31: C6 reads the senders itself,
 * through docs/text-budgets.json's sender rules, until C11's audience map replaces
 * this reading). In each script, comments and literals told apart by the lexer, a
 * call of a sender (SENDERS) is found, and every key written as a literal inside
 * its arguments - a string, or a template with no `${...}` - is posted by it. A
 * call whose arguments name `roomAudience(...)` or `incidentAudienceIds(...)` is
 * that audience's (a card to the room, to the incident's people), whatever posts
 * it - `ChatMessage.create` is read only so; `announce` handed a `whisper` list and
 * neither audience is a private card to people this reading does not know, and is
 * counted (`private`), not assigned. Not read (C11's): a key held in a variable
 * first and posted through it (`const content = ...; announce({ content })`), a
 * key a template builds (counted, `unresolved`), and a sender reached through an
 * alias. Answers `{ senders: Map key -> Set of senders, counts }`, the keys as
 * written (a family's base stands for its forms: `familyOf`).
 */
function sendersOf(bag, name) {
    const lx = lexerOf(bag, name);
    const senders = new Map(), counts = { calls: 0, keyed: 0, private: 0, unresolved: 0 };
    for (const [, text] of asMap(bag.scripts)) {
        const code = lx.blankComments(String(text ?? "")), blank = lx.blankLiterals(code);
        const spans = literalSpans(code, blank);
        for (const m of blank.matchAll(SENDER_CALL)) {
            if (/\bfunction\s*$/.test(blank.slice(Math.max(0, m.index - 12), m.index))) continue;   // its definition
            const open = m.index + m[0].length - 1, { close } = lx.callArgs(blank, open);
            const inside = blank.slice(open + 1, close);
            const callee = m[1].replace(/\s+/g, "");
            const audience = [...new Set([...inside.matchAll(AUDIENCE_CALL)].map(a => a[1]))];
            let by;
            if (audience.length) by = audience;
            else if (callee === "ChatMessage.create") continue;
            else if (callee === "announce" && /\bwhisper\b/.test(inside)) { counts.private++; continue; }
            else by = [callee.startsWith("ui.notifications") ? "ui.notifications" : callee];
            counts.calls++;
            let keyed = false;
            for (const s of spans) {
                if (s.start <= open || s.end > close || s.kind === "regex") continue;
                const whole = s.kind === "string" || (code[s.start] === "`" && code[s.end - 1] === "`");
                const value = literalText(code, s);
                if (!whole) { if (/^[A-Z][A-Za-z]*\.[\w.]*$/.test(value)) counts.unresolved++; continue; }
                if (!KEY_LITERAL.test(value)) continue;
                keyed = true;
                const set = senders.get(value) ?? new Set();
                for (const b of by) set.add(b);
                senders.set(value, set);
            }
            if (keyed) counts.keyed++;
        }
    }
    return { senders, counts };
}

/* One reading of the surfaces per pair of (budgets, scripts) handed in: T4, T5 and T21 read the same, and the scripts
   are lexed once. Pure: the answer depends only on the two (a Map or object passed again is the same reading). */
const SURFACE_MEMO = new WeakMap();

/**
 * Each key's surface (docs/text-budgets.json, section 3 and 4 of the guide): the
 * first rule that names it - by `keys`, a pattern over the whole key; by `sender`,
 * one of the senders `sendersOf` read posting it or its family - or null
 * ("unclassified"). Without `scripts` only the key rules are read (a fixture with
 * none, a reader that needs no sender). `surfaceOf(key)` and the sender reading's
 * counts; a bag with no budgets classifies nothing.
 */
export function surfacesOf(bag = {}, name = "surfacesOf") {
    const budgets = bag.budgets;
    const rules = Array.isArray(budgets?.rules) ? budgets.rules : [];
    const hold = typeof bag.scripts === "object" && bag.scripts !== null ? bag.scripts : null;
    if (hold) lexerOf(bag, name);   // before the memo: a reader handed scripts and no lexer throws whatever ran before it
    let byBudgets = budgets && typeof budgets === "object" ? SURFACE_MEMO.get(budgets) : null;
    const memo = byBudgets && hold ? byBudgets.get(hold) : null;
    if (memo) return memo;
    const read = hold ? sendersOf(bag, name) : { senders: new Map(), counts: null };
    const tests = rules.map(r => (typeof r?.keys === "string" ? { surface: r.surface, re: new RegExp(r.keys, "u") }
        : { surface: r?.surface, sender: Array.isArray(r?.sender) ? r.sender : [] }));
    const cache = new Map();
    const surfaceOf = key => {
        if (cache.has(key)) return cache.get(key);
        const by = new Set([...(read.senders.get(key) ?? []), ...(read.senders.get(familyOf(key)) ?? [])]);
        const hit = tests.find(t => (t.re ? t.re.test(key) : t.sender.some(s => by.has(s))));
        cache.set(key, hit?.surface ?? null);
        return hit?.surface ?? null;
    };
    const out = { surfaceOf, counts: read.counts, senders: read.senders };
    if (budgets && typeof budgets === "object" && hold) {
        if (!byBudgets) { byBudgets = new WeakMap(); SURFACE_MEMO.set(budgets, byBudgets); }
        byBudgets.set(hold, out);
    }
    return out;
}

/* The keys an allow row silences for one rule (docs/text-budgets.json `allow`). */
const allowedFor = (budgets, rule) => new Set((Array.isArray(budgets?.allow) ? budgets.allow : []).filter(a => a?.rule === rule).map(a => a.key));
/* A key's top-level group, as the report counts by it: its first two parts ("DRPG.Hud", "DAGGERHEART.UI"). */
export const groupOf = key => String(key).split(".").slice(0, 2).join(".");

/* ---------------------------------- T4 ------------------------------------- */

/**
 * T4 (plan, DB11; report from E65): a string longer than its surface's budget in
 * docs/text-budgets.json - over the `target` (the report's number) and over the
 * `limit` (about 1.5 times it, DB11's hard limit) counted apart: a string over the
 * limit is a "limit" finding and not also a "target" one. A surface whose limit is
 * null (the GM's diagnostics, DB11: report only) has target findings alone. An
 * allow row (`rule: "T4"`) silences its key in both languages, counted. Each
 * finding names its surface and, for a limit, the stage from which that surface's
 * limit is red (`fail`, the surface's own field: E71 for the player's and the
 * settings' texts as the orchestrator read DB11 on 31.10, null where it stays
 * report only). The numbers are rebuilt 30.10 (the guide's B2) and wait for the
 * pilot: a count here is a reading of the rebuilt budgets, not a verdict on the
 * module's texts. `read` is the strings that have a surface; the rest are
 * `unclassified`, counted.
 */
export function lengthOver(bag = {}) {
    const budgets = bag.budgets;
    const surfaces = budgets?.surfaces && typeof budgets.surfaces === "object" ? budgets.surfaces : {};
    const map = surfacesOf(bag, "lengthOver");
    const allow = allowedFor(budgets, "T4");
    const found = [], bySurface = {};
    let read = 0, unclassified = 0, allowed = 0;
    for (const u of uiUnits(bag)) {
        const id = map.surfaceOf(u.key), s = id ? surfaces[id] : null;
        if (!s) { unclassified++; continue; }
        read++;
        const row = bySurface[id] ??= { strings: 0, target: 0, limit: 0, allowed: 0 };
        row.strings++;
        if (allow.has(u.key)) { allowed++; row.allowed++; continue; }
        const n = wordCount(u.text);
        const over = s.limit !== null && n > s.limit ? "limit" : n > s.target ? "target" : null;
        if (!over) continue;
        row[over]++;
        const fail = over === "limit" ? (s.fail ?? null) : null;
        found.push({ key: u.key, kind: `${u.lang}-${over}`, surface: id, lang: u.lang, words: n, fail,
            what: `${u.where}: ${n} words, over the ${id} ${over} of ${over === "limit" ? s.limit : s.target} (docs/text-budgets.json, rebuilt 30.10)${fail ? `; red from ${fail}` : ""}` });
    }
    return { found, read, counts: { unclassified, allowed, ...(map.counts ?? {}) }, bySurface, sources: ["budgets"] };
}

/* ---------------------------------- T5 ------------------------------------- */

/* Not a letter on either side, for the Polish words a \b cannot bound (it reads ASCII only). */
const W = s => `(?<![\\p{L}\\p{N}_])(?:${s})(?![\\p{L}\\p{N}_])`;
/* The person placeholders: a name the code fills, one person. */
const PERSON = /\{(?:name|who|actor|target|victim|killer|student|player|speaker|owner)\}/u;
/* The surfaces where a text tells and no answer is asked (X21): every surface but a window's own controls. */
const TELLING = Object.freeze(["toast", "player-card", "gm-card", "world-voice", "gm-diagnostics", "settings-hint", "tooltip", "tile-hint", "config-description"]);
/* What X16 does not read as shouting: acronyms of the module's text, read 31.10 (GM, MG and BN are the Polish GM and NPC). */
const ACRONYMS = Object.freeze(["GM", "GMs", "MG", "RPG", "DRPG", "HUD", "NPC", "NPCs", "BN", "KB", "MB", "DC", "UI", "API", "PTT", "AV", "OK", "ID", "URL", "PH"]);
const PLURAL_PRONOUN = new RegExp(W("oni|ich|im|nich|nimi"), "u");
const firstSentence = text => untagged(text).trim().split(/(?<=[.!?])\s/)[0].replace(/[.!?:\s]+$/, "").trim().toLowerCase();

/**
 * THE X RULES' MATCHERS (docs/text-style.md section 5, each rebuilt 30.10 and to
 * confirm in the pilot, as its rule is; so is every pattern here). One row a rule:
 * `en` and `pl` a pattern for that language's strings (`any` for both), or `test`,
 * a function of the unit and what the detector knows, for a rule a pattern cannot
 * state; `surfaces` where a rule reads only some. A rule no matcher here reads says
 * which detector does (`by`). A finding is a candidate for a reader, never a
 * verdict: the patterns are heuristics, and an allow row (`rule: "X<n>"`) silences
 * one key for one rule.
 */
export const X_RULES = Object.freeze([
    { id: "X1", what: "reassurance by denying a loss", en: /\b(?:[Nn]othing (?:was|is|has been|got|gets) (?:spent|lost|used|wasted|taken)|[Nn]o \p{L}+ (?:was|were|is|are) (?:spent|lost|used|wasted))\b/u,
        pl: new RegExp(W("[Nn]ic nie (?:wydano|stracono|zużyto|przepadło|zostało (?:wydane|stracone|zużyte))|[Nn]ie (?:wydano|stracono|zużyto) (?:nic|niczego)"), "u") },
    { id: "X2", what: "a design rationale", en: /\b(?:by design|on purpose|deliberately|intentionally)\b/iu, pl: new RegExp(W("celowo|z założenia|zamierzenie"), "iu") },
    { id: "X3", what: "the antithesis \"X, not Y\"", en: /, not (?:\S+ ){0,4}\S+[.;!?](?:\s|$)/u,
        /* A Polish ", nie" before a verb is a negation, not an antithesis: the verbs read 31.10 after it are left out. */
        pl: /, (?:a )?nie (?!(?:można|wolno|ma|mają|jest|są|było|będzie|zostanie|został\p{L}*|trzeba|może|mogą|da|działa|liczy)(?![\p{L}]))(?:\S+ ){0,3}\S+[.;!?](?:\s|$)/u },
    { id: "X4", what: "a dash that tacks an aside on", en: /[\p{L}\p{N}}.,)"”] - [\p{L}\p{N}{"“(]/u, pl: /[\p{L}\p{N}}.,)"”] - [\p{L}\p{N}{„"(]/u },
    { id: "X5", what: "a bracketed plural", en: /\p{L}\((?:s|es)\)/u, pl: /\p{L}\((?:y|i|e|ów)\)/u },
    { id: "X6", what: "telegraph style", by: "T18 (E65 C7, telegraph)" },
    { id: "X7", what: "a chain of label-colon-value inside a sentence", any: /(?:\p{L}[^.!?:]*: [^.!?:;]+[;,] ){2,}/u },
    { id: "X8", what: "please or sorry", en: /\b(?:please|sorry)\b/iu, pl: new RegExp(W("proszę|prosimy|przepraszam|przepraszamy"), "iu") },
    { id: "X9", what: "a doubled space or a space before punctuation", any: /\S {2,}\S| [,.;:!?](?!\.)/u },
    { id: "X10", what: "a hedge or a filler", en: /\b(?:just|simply|actually)\b/iu, pl: new RegExp(W("po prostu|właściwie"), "iu") },
    { id: "X11", what: "a passive that hides who acts", en: /\b(?:must|should|can|cannot|can't|may|needs? to) be \p{L}+(?:ed|en)\b/iu, pl: new RegExp(W("należy|trzeba"), "iu") },
    { id: "X12", what: "a Polish preposition before a colon and a placeholder", pl: new RegExp(`${W("w|we|do|z|ze|na|od|dla|przez|u|po|o|przy|za|nad|pod|przed")}\\s*:\\s*\\{\\w+\\}`, "u") },
    /* X13 reads the pair: the English says one person ({name}, {who} ...) with "they", and the Polish answers with a plural pronoun. */
    { id: "X13", what: "a singular they as a Polish plural",
        test: (u, k) => (u.lang === "pl" && PERSON.test(u.text) && /\b(?:they|their|them|themselves)\b/u.test(k.english(u.key) ?? "")
            ? PLURAL_PRONOUN.exec(u.text) : null) },
    { id: "X14", what: "a negated question or a double negation on a button", surfaces: ["button"],
        test: u => {
            const no = u.lang === "en" ? /\b(?:not|no|never|don't|can't|won't|isn't)\b|n't\b/giu : new RegExp(W("nie|nigdy|żaden|żadna|żadne"), "giu");
            const hits = [...u.text.matchAll(no)];
            return hits.length >= 2 || (hits.length === 1 && u.text.includes("?")) ? hits[0] : null;
        } },
    { id: "X15", what: "an exclamation mark", any: /!(?!--|=)/u },
    { id: "X16", what: "ALL-CAPS emphasis",
        test: u => (/\.(?:short|abbreviation)$/.test(u.key) ? null
            : [...untagged(u.text).matchAll(/(?<![\p{L}\p{N}_{])\p{Lu}{2,}s?(?![\p{L}\p{N}_}])/gu)].find(m => !ACRONYMS.includes(m[0])) ?? null) },
    /* Two qualifiers of another kind in one sentence ("only ... unless", "tylko ... chyba że"). */
    { id: "X17", what: "stacked qualifiers",
        test: u => {
            const q = u.lang === "en" ? /\b(?:only|unless|except|as long as|provided)\b/giu : new RegExp(W("tylko|jedynie|chyba że|z wyjątkiem|oprócz|o ile|pod warunkiem"), "giu");
            for (const s of untagged(u.text).split(/(?<=[.!?])\s/)) {
                const kinds = [...s.matchAll(q)];
                if (new Set(kinds.map(m => m[0].toLowerCase())).size >= 2) return { index: u.text.indexOf(s) + kinds[1].index, 0: kinds[1][0] };
            }
            return null;
        } },
    { id: "X18", what: "successfully", en: /\bsuccessfully\b/iu, pl: new RegExp(W("pomyśln\\p{L}*"), "iu") },
    /* A hint whose first sentence is its label (`.hint` beside `.label`, a setting's `.hint` beside its `.name`). */
    { id: "X19", what: "a hint that restates its label",
        test: (u, k) => {
            if (!u.key.endsWith(".hint")) return null;
            const base = u.key.slice(0, -".hint".length);
            const label = k.text(u.lang, `${base}.label`) ?? k.text(u.lang, `${base}.name`);
            return label && firstSentence(u.text) === firstSentence(label) ? { index: 0, 0: label } : null;
        } },
    { id: "X20", what: "a Note: or Tip: lead-in", en: /(?:^|[.!?>]\s*)(?:Note|Tip)\s*:/u, pl: /(?:^|[.!?>]\s*)(?:Uwaga|Wskazówka)\s*:/u },
    { id: "X21", what: "a question where nobody is asked", surfaces: TELLING, any: /\?/u }
].map(r => Object.freeze(r)));

/**
 * T5 (plan; report from E65, FAIL from E71 for X5, X9, X15, X16 and X18 - S18-47's
 * "wzorce jednoznaczne"): every X rule's matcher (X_RULES) over the UI strings of
 * both languages, one finding a string and rule (`"<key> <rule>-<lang>"`), the first
 * place it matches quoted. An allow row silences one key for one rule. A rule with a
 * `surfaces` list reads only those (the budgets' reading, `surfacesOf`); `byRule`
 * counts each rule's findings by language, and a rule read by another detector
 * (`by`) is listed with no count. `read` is strings times rules read.
 */
export function patterns(bag = {}) {
    const units = uiUnits(bag);
    const map = surfacesOf(bag, "patterns");
    const by = new Map(units.map(u => [`${u.lang} ${u.key}`, u.text]));
    const k = { text: (lang, key) => by.get(`${lang} ${key}`) ?? null, english: key => by.get(`en ${key}`) ?? null };
    const found = [], byRule = {};
    let read = 0, allowed = 0;
    for (const rule of X_RULES) {
        const row = byRule[rule.id] = rule.by ? { by: rule.by } : { en: 0, pl: 0, allowed: 0 };
        if (rule.by) continue;
        const allow = allowedFor(bag.budgets, rule.id);
        for (const u of units) {
            const re = rule[u.lang] ?? rule.any;
            if (!re && !rule.test) continue;
            const surface = map.surfaceOf(u.key);
            if (rule.surfaces && !rule.surfaces.includes(surface)) continue;
            read++;
            const m = rule.test ? rule.test(u, k) : re.exec(u.text);
            if (!m) continue;
            if (allow.has(u.key)) { allowed++; row.allowed++; continue; }
            row[u.lang]++;
            found.push({ key: u.key, kind: `${rule.id}-${u.lang}`, rule: rule.id, lang: u.lang, surface,
                what: `${u.where}: "${quoted(u.text, m.index ?? 0, String(m[0] ?? "").length)}" - ${rule.id}, ${rule.what} (docs/text-style.md; rebuilt 30.10)` });
        }
    }
    return { found, read, byRule, counts: { rules: X_RULES.length, matched: X_RULES.filter(r => !r.by).length, allowed } };
}

/* ---------------------------------- T7 ------------------------------------- */

/* A number written as a word (English; Polish in its genders and cases), and the rule nouns after it (E65 C6's slice). */
const NUMBER_WORD = Object.freeze({
    en: "(?<!\\b(?:the|no|each|any|every|that|this)\\s)one|two|three|four|five|six|seven|eight|nine|ten",
    pl: "jeden|jedna|jedno|jedną|jednej|jednego|jednym|dwa|dwie|dwóch|dwoma|dwu|trzy|trzech|trzema|cztery|czterech|pięć|pięciu|sześć|sześciu|siedem|osiem|dziewięć|dziesięć"
});
const RULE_NOUN = Object.freeze({
    en: "dice|die|actions?|Hope|Despair|turns?|Health|Sanity",
    pl: "kość|kości|kośćmi|akcja|akcje|akcji|akcję|akcjach|akcjami|tura|tury|turę|tur|turze|turach|Hope|Despair|Health|Sanity"
});
/* Not read: "one" as a pronoun ("no one", "the one ... that", in NUMBER_WORD), and the module's name for a dice style ("One
   dice look", „Jeden wygląd kości”, „w jednym stylu kości”). */
const NUMBER_RE = Object.freeze(Object.fromEntries(["en", "pl"].map(lang => [lang, new RegExp(
    `${W(NUMBER_WORD[lang])}\\s+(?:(?!of\\b|z\\b|wygląd|styl)[\\p{L}-]+\\s+)?${W(RULE_NOUN[lang])}(?!\\s+(?:look|style|wygląd))`, "giu")])));

/**
 * T7, its part in E65 (plan; the rest of the rules-parity test is E25's and
 * E57's): a number written as a word before a rule noun - die or dice, action,
 * Hope, Despair, turn, Health, Sanity; in Polish kość, akcja, tura in their cases -
 * where the number is the rule's and belongs in a placeholder (M5, O5: a number in a
 * text comes from config, not from the prose). One adjective may stand between
 * ("one free action", "jedną kość kary"); "of" may not ("one of the two dice" is
 * read at "two dice"). "one" as a pronoun ("no one", "the one") is not read; a
 * placeholder after the word ("one {item}") is no rule noun; "raz" (once) is no
 * number word here. Language strings and config.mjs's prose; one finding a string.
 */
export function ruleNumberWords(bag = {}) {
    const found = [];
    let read = 0;
    for (const u of uiUnits(bag)) {
        read++;
        const re = NUMBER_RE[u.lang];
        re.lastIndex = 0;
        const m = re.exec(u.text);
        if (!m) continue;
        found.push({ key: u.key, kind: u.lang, lang: u.lang,
            what: `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - "${m[0]}": a rule's number written as a word; it comes from a placeholder (T7, M5)` });
    }
    return { found, read };
}

/* ---------------------------------- T21 ------------------------------------ */

const MONOKUMA = /Monokum\p{L}*/u;
/* Text inside quotes, blanked: a handbook's example quotes a line, which is not the handbook speaking. */
const unquoted = text => text.replace(/“[^”]*”|„[^”]*”|"[^"]*"/gu, m => " ".repeat(m.length));

/**
 * T21 (rebuilt 30.10 from DB1, DB5 and PL4; report from E65, FAIL from E71):
 * (1) in English, Monokuma is "they" (DB5): "he", "him", "his", "himself", "she",
 * "her", "hers" or "herself" after "Monokuma" in the same sentence is a finding
 * ("en-pronoun"); (2) in Polish, Monokuma is grammatically masculine (PL4): a past
 * form in "-ła" (nałożyła, zrobiłaś) within two words after "Monokuma" is one
 * ("pl-feminine"); both in the UI strings and in the handbooks (a line at a time,
 * a quoted example blanked); (3) the announcements are the world's neutral voice,
 * with no lines of Monokuma (DB1): a string on the world-voice surface (posted by
 * `announce` with no whisper list, `surfacesOf`) that speaks in the first person
 * ("I", "me", "my"; „ja”, „mnie”, „mój” ...) or laughs as Monokuma does ("upupu",
 * "puhuhu") is one ("<lang>-voice"). Every finding is a candidate: the sentence
 * may name somebody else after Monokuma.
 */
export function monokumaVoice(bag = {}) {
    const map = surfacesOf(bag, "monokumaVoice");
    const found = [];
    let read = 0, voice = 0;
    const pronoun = { en: /\b(?:he|him|his|himself|she|her|hers|herself)\b/iu };
    const feminine = /^\s+(?:[\p{L}-]+\s+){0,2}?[\p{L}]+ł(?:a|aś|am|aby)(?![\p{L}])/u;
    const firstPerson = { en: /\b(?:I|I'm|I'll|I've|me|my|mine|myself)\b/u, pl: new RegExp(W("ja|mnie|mi|mną|mój|moja|moje|moim|mojej|moich"), "iu") };
    const laugh = /upupu|puhuhu/iu;
    const look = (u, text) => {
        for (const m of text.matchAll(new RegExp(MONOKUMA.source, "gu"))) {
            const after = text.slice(m.index + m[0].length).split(/[.!?](?:\s|$)/)[0];
            const hit = u.lang === "en" ? pronoun.en.exec(after) : feminine.exec(after);
            if (!hit) continue;
            found.push({ key: u.at ?? u.key, kind: `${u.lang}-${u.lang === "en" ? "pronoun" : "feminine"}`, lang: u.lang,
                what: `${u.where}: "${quoted(text, m.index, m[0].length + hit.index + hit[0].length)}" - ${u.lang === "en" ? "Monokuma is \"they\" (DB5)" : "Monokuma jest rodzaju męskiego (PL4)"} (T21)` });
            return;
        }
    };
    for (const u of uiUnits(bag)) {
        read++;
        if (MONOKUMA.test(u.text)) look(u, untagged(u.text));
        if (map.surfaceOf(u.key) !== "world-voice") continue;
        voice++;
        const m = firstPerson[u.lang].exec(untagged(u.text)) ?? laugh.exec(u.text);
        if (m) found.push({ key: u.key, kind: `${u.lang}-voice`, lang: u.lang,
            what: `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - a line in the first person on the world's voice; the announcements speak in a neutral voice, with no lines of Monokuma (DB1, T21)` });
    }
    for (const [file, text] of asMap(bag.docs)) {
        const lang = file.match(/^docs\/handbooks\/[^/]+\.(en|pl)\.md$/)?.[1];
        if (!lang) continue;
        String(text ?? "").split("\n").forEach((line, i) => {
            read++;
            if (MONOKUMA.test(line)) look({ at: `${file}:${i + 1}`, lang, where: `${file}:${i + 1}` }, unquoted(line));
        });
    }
    return { found, read, counts: { worldVoice: voice } };
}

/* ---------------------------------- T24 ------------------------------------ */

/**
 * The colons T24 counts in a string: its text with tags blanked (an attribute's
 * "a:b" is markup), less a time ("12:30", a digit on both sides), a URL's "://",
 * and the colon of a label that opens a table cell or a list item (`<td>`, `<th>`,
 * `<li>`, `<dt>`, then at most four words and the colon) - a table's or a list's
 * label is its layout, not a chain. A label at the start of the string counts: the
 * plan's measure is colons per string.
 */
export function colonsIn(text) {
    const cells = String(text ?? "").replace(/(<(?:td|th|li|dt)\b[^<>]*>\s*(?:[^\s<>:]+\s+){0,3}[^\s<>:]+):/gi, "$1");
    return (untagged(cells).replace(/\d:\d/g, "").replace(/:\/\//g, "").match(/:/g) ?? []).length;
}

/**
 * T24 (rebuilt 30.10 from "T24 powyżej 2"; report from E65, FAIL from E71 above
 * 2): a UI string with more than two colons (`colonsIn`) - the "łańcuchy
 * dwukropków" of the plan's risk, of which X7 is the shape inside one sentence.
 * One finding a string, its count in `colons`; `byCount` how many strings hold
 * three, four and more.
 */
export function colonChains(bag = {}) {
    const found = [], byCount = {};
    let read = 0;
    for (const u of uiUnits(bag)) {
        read++;
        const n = colonsIn(u.text);
        if (n <= 2) continue;
        byCount[n] = (byCount[n] ?? 0) + 1;
        found.push({ key: u.key, kind: u.lang, lang: u.lang, colons: n,
            what: `${u.where}: ${n} colons in one string - more than two is a chain of labels (T24, X7)` });
    }
    return { found, read, byCount };
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
 * `fail` null is a report that stays one (T7's part: the rules-parity test of E25 and
 * E57 replaces it rather than turning it). `reads` is what it needs, `also` what it reads when it is handed it (T6 the
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
    retiredHits: Object.freeze({ test: "T28", mode: "report", fail: "E66", reads: Object.freeze(["glossary", "lang", "docs"]), also: Object.freeze(["prose"]) }),
    lengthOver: Object.freeze({ test: "T4", mode: "report", fail: "E71", reads: Object.freeze(["budgets", "lang"]), also: Object.freeze(["prose", "scripts"]), lexer: true }),
    patterns: Object.freeze({ test: "T5", mode: "report", fail: "E71", reads: Object.freeze(["lang"]), also: Object.freeze(["prose", "budgets", "scripts"]), lexer: true }),
    ruleNumberWords: Object.freeze({ test: "T7", mode: "report", fail: null, reads: Object.freeze(["lang"]), also: Object.freeze(["prose"]) }),
    monokumaVoice: Object.freeze({ test: "T21", mode: "report", fail: "E71", reads: Object.freeze(["lang", "budgets", "scripts"]), also: Object.freeze(["prose", "docs"]), lexer: true }),
    colonChains: Object.freeze({ test: "T24", mode: "report", fail: "E71", reads: Object.freeze(["lang"]), also: Object.freeze(["prose"]) })
});

export const DETECTORS = Object.freeze({ pluralForms, configPlaceholders, pairParity, familyFormats, dashesIn, tableWordProblems, glossaryHits, retiredHits,
    lengthOver, patterns, ruleNumberWords, monokumaVoice, colonChains });

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
    },
    lengthOver: {
        /* Rebuilt budgets of its own: a label (2, limit 3), the diagnostics (3, no limit), a toast (3, limit 5) by
           ui.notifications, a card (3, limit 5) by the room's audience or announce; the diagnostics' key rule first. */
        flags: ["DRPG.Fx.card en-limit", "DRPG.Fx.count.other en-limit", "DRPG.Fx.diag.report en-target", "DRPG.Fx.long.label en-target",
            "DRPG.Fx.longer.label en-limit", "DRPG.Fx.toast en-target", "DRPG.Fx.toast pl-limit", "DRPG.Fx.toastLong en-limit"],
        input: {
            budgets: {
                surfaces: {
                    "fx-label": { target: 2, limit: 3, what: "a label", fail: "E01" },
                    "fx-diag": { target: 3, limit: null, what: "reported only", fail: null },
                    "fx-toast": { target: 3, limit: 5, what: "a toast", fail: "E01" },
                    "fx-card": { target: 3, limit: 5, what: "a card", fail: null }
                },
                rules: [
                    { surface: "fx-diag", keys: "^DRPG\\.Fx\\.diag\\." },
                    { surface: "fx-label", keys: "\\.label$" },
                    { surface: "fx-toast", sender: ["ui.notifications"] },
                    { surface: "fx-card", sender: ["roomAudience", "announce"] }
                ],
                allow: [{ key: "DRPG.Fx.allowed.label", rule: "T4", why: "a fixture's exception", until: "E01" }]
            },
            en: {
                "DRPG.Fx.ok.label": "Two words",                              // at its target: passes
                "DRPG.Fx.long.label": "Three words here",                     // over the target, not the limit
                "DRPG.Fx.longer.label": "<b>Four</b> words {name} here",      // a tag is no word, a placeholder is one: 4, over the limit
                "DRPG.Fx.dash.label": "One - two",                            // a lone dash is no word: passes
                "DRPG.Fx.br.label": "Two <br> words",                         // a tag between two words is none: passes
                "DRPG.Fx.allowed.label": "Far too many words for a label",    // an allow row: passes, counted
                "DRPG.Fx.diag.report": "one two three four five six",         // no limit: a target finding only
                "DRPG.Fx.toast": "One two three four",                        // a toast by its sender, over the target
                "DRPG.Fx.toastLong": "One two three four five six",           // ui.notifications?.warn: over the limit
                "DRPG.Fx.count.one": "{n} thing",                             // a family posted by its base: passes
                "DRPG.Fx.count.other": "{n} things are now gone from here",   // over the toast's limit
                "DRPG.Fx.card": "One two three four five six",                // announce to roomAudience: the card's
                "DRPG.Fx.private": "One two three four five six",             // announce with a whisper list: unclassified
                "DRPG.Fx.variable": "One two three four five six",            // posted through a variable: unclassified
                "DRPG.Fx.method": "One two three four five six",              // a method named announce: unclassified
                "DRPG.Fx.unread": "One two three four five six"               // in a comment only: unclassified
            },
            pl: {
                "DRPG.Fx.long.label": "Dwa słowa",                            // passes
                "DRPG.Fx.toast": "Jeden dwa trzy cztery pięć sześć",          // over the limit
                "DRPG.Fx.count.few": "{n} rzeczy"                             // the family's form: passes
            },
            scripts: {
                "scripts/fx-send.mjs": [
                    "ui.notifications.info(game.i18n.localize(\"DRPG.Fx.toast\"));",
                    "ui.notifications?.warn(game.i18n.localize(\"DRPG.Fx.toastLong\"));",
                    "ui.notifications.info(plural(\"DRPG.Fx.count\", { n }));",
                    "await announce({ content: game.i18n.localize(\"DRPG.Fx.card\"), whisper: roomAudience(actor) });",
                    "await announce({ content: game.i18n.localize(\"DRPG.Fx.private\"), whisper: gmIds() });",
                    "const content = game.i18n.localize(\"DRPG.Fx.variable\"); await announce({ content });",
                    "board.announce(game.i18n.localize(\"DRPG.Fx.method\"));",
                    "// ui.notifications.info(game.i18n.localize(\"DRPG.Fx.unread\"));"
                ].join("\n")
            }
        }
    },
    patterns: {
        /* One line a matched rule (X6 is T18's), and a line beside most that passes. The budgets name a button, a toast
           and a window title by key, for X14 and X21. */
        flags: ["DRPG.Fx.toast.ask X21-en", "DRPG.Fx.tile.hint X19-en", "DRPG.Fx.x14Button X14-en", "DRPG.Fx.x15Title X15-en", "DRPG.Fx.x1 X1-en", "DRPG.Fx.x1 X1-pl",
            "DRPG.Fx.x10 X10-pl", "DRPG.Fx.x11 X11-en", "DRPG.Fx.x12 X12-pl", "DRPG.Fx.x13 X13-pl", "DRPG.Fx.x16 X16-en", "DRPG.Fx.x17 X17-en", "DRPG.Fx.x18 X18-pl",
            "DRPG.Fx.x2 X2-en", "DRPG.Fx.x20 X20-en", "DRPG.Fx.x3 X3-en", "DRPG.Fx.x3 X3-pl", "DRPG.Fx.x4 X4-en", "DRPG.Fx.x5 X5-en", "DRPG.Fx.x7 X7-en",
            "DRPG.Fx.x8 X8-en", "DRPG.Fx.x9 X9-en"],
        input: {
            budgets: {
                surfaces: { button: { target: 4, limit: 6, what: "a button", fail: null }, toast: { target: 20, limit: 30, what: "a toast", fail: null },
                    "window-title": { target: 5, limit: 8, what: "a title", fail: null } },
                rules: [{ surface: "button", keys: "Button$" }, { surface: "toast", keys: "^DRPG\\.Fx\\.toast\\." }, { surface: "window-title", keys: "Title$" }],
                allow: [{ key: "DRPG.Fx.allowed", rule: "X8", why: "a fixture's exception", until: "E01" }]
            },
            en: {
                "DRPG.Fx.x1": "The GM refused. Nothing was spent.",           // X1
                "DRPG.Fx.x1ok": "You keep your action.",                       // passes
                "DRPG.Fx.x2": "The light flickers on purpose.",               // X2
                "DRPG.Fx.x3": "The debate runs from the console, not here.",  // X3
                "DRPG.Fx.x4": "Tick to opt in - the timing is yours.",        // X4
                "DRPG.Fx.x4ok": "A well-known room",                           // a hyphen inside a word: passes
                "DRPG.Fx.x5": "You have {n} pick(s).",                         // X5
                "DRPG.Fx.x7": "Identified by the crime: {rows}; faint: {faint}; Key: {key}.",   // X7
                "DRPG.Fx.x8": "Please rule again.",                            // X8
                "DRPG.Fx.allowed": "Sorry, the room is closed.",               // X8 with an allow row: passes, counted
                "DRPG.Fx.x9": "Two  spaces here .",                            // X9
                "DRPG.Fx.x11": "The room can be searched once.",               // X11
                "DRPG.Fx.x13": "{name} leaves; they take the key.",            // the English of X13's pair
                "DRPG.Fx.x13ok": "{name} leaves.",                             // no "they": its Polish passes
                "DRPG.Fx.x14Button": "Don't not save",                         // X14: two negations on a button
                "DRPG.Fx.okButton": "Save the scene",                          // passes
                "DRPG.Fx.notAControl": "Do not leave? Not now.",               // no button: X14 does not read it
                "DRPG.Fx.x15Title": "Nonstop Debate!",                         // X15
                "DRPG.Fx.x16": "This is NOT a test for the GM.",               // X16
                "DRPG.Fx.x16ok": "The GM and the NPC open the HUD.",           // acronyms: passes
                "DRPG.Fx.trait.short": "EYE",                                  // an abbreviation's key: passes
                "DRPG.Fx.x17": "You may only act unless the GM refuses.",      // X17
                "DRPG.Fx.x17ok": "Only the GM opens it.",                      // one qualifier: passes
                "DRPG.Fx.tile.label": "Search",
                "DRPG.Fx.tile.hint": "Search. Look around the room.",          // X19: its first sentence is its label
                "DRPG.Fx.tile2.label": "Search",
                "DRPG.Fx.tile2.hint": "Look around the room for a stash.",     // passes
                "DRPG.Fx.x20": "Note: the room is sealed.",                    // X20
                "DRPG.Fx.toast.ask": "Why wait? The door is open.",            // X21: a question on a toast
                "DRPG.Fx.deleteTitle": "Delete this room?"                     // a window's own question: passes
            },
            pl: {
                "DRPG.Fx.x1": "GM odmówił. Nic nie wydano.",                   // X1
                "DRPG.Fx.x1ok": "Nie tracisz akcji.",                          // passes
                "DRPG.Fx.x3": "Debatę prowadzi GM z konsoli, nie stąd.",       // X3
                "DRPG.Fx.x3ok": "Tego, nie można cofnąć.",                     // a negated verb: passes
                "DRPG.Fx.x10": "Incydent po prostu się kończy.",               // X10
                "DRPG.Fx.x12": "Jesteś w: {room}.",                            // X12
                "DRPG.Fx.x12ok": "Zostało: {n}",                               // a label, no preposition: passes
                "DRPG.Fx.x13": "{name} wychodzi; oni biorą klucz.",            // X13
                "DRPG.Fx.x13ok": "{name} wychodzi, ich klucz zostaje.",        // the English has no "they": passes
                "DRPG.Fx.x18": "Zapisano pomyślnie."                           // X18
            }
        }
    },
    ruleNumberWords: {
        flags: ["DRPG.Config.FX.p en", "DRPG.Fx.a en", "DRPG.Fx.a pl", "DRPG.Fx.b en", "DRPG.Fx.b pl", "DRPG.Fx.c en", "DRPG.Fx.c pl", "DRPG.Fx.h en", "DRPG.Fx.h pl"],
        input: {
            en: {
                "DRPG.Fx.a": "Gain one Hope.",                                // flagged
                "DRPG.Fx.b": "Down to one action this time of day.",          // flagged
                "DRPG.Fx.c": "One of the two dice is set to 12.",             // "of" may not stand between: read at "two dice"
                "DRPG.Fx.d": "Each one turns away.",                          // "one" as a pronoun: passes
                "DRPG.Fx.e": "Take one {item}.",                              // a placeholder is no rule noun: passes
                "DRPG.Fx.f": "Gain {n} Hope.",                                // passes
                "DRPG.Fx.g": "One dice look for the table",                   // the dice style's name: passes
                "DRPG.Fx.h": "Two free actions",                              // one adjective between: flagged
                "DRPG.Fx.i": "the one action that counts",                    // "the one": passes
                "DRPG.Fx.j": "Choose one of Hope or Despair."                 // "of" between: passes
            },
            prose: { "DRPG.Config.FX.p": "Survive for the next two turns." },   // flagged
            pl: {
                "DRPG.Fx.a": "Zyskujesz jeden Hope.",                         // flagged
                "DRPG.Fx.b": "Jedna akcja na porę dnia.",                     // flagged
                "DRPG.Fx.c": "Jedna z dwóch kości.",                          // read at "dwóch kości"
                "DRPG.Fx.d": "Raz dziennie.",                                 // "raz" is no number word here: passes
                "DRPG.Fx.e": "Weź {n} kości.",                                // passes
                "DRPG.Fx.g": "Jeden wygląd kości przy stole",                 // the dice style's name: passes
                "DRPG.Fx.h": "Dorzuca jedną kość kary."                       // flagged
            }
        }
    },
    monokumaVoice: {
        flags: ["DRPG.Fx.fem pl-feminine", "DRPG.Fx.he en-pronoun", "DRPG.Fx.laugh en-voice", "DRPG.Fx.voice en-voice", "DRPG.Fx.voice pl-voice",
            "docs/handbooks/fx.en.md:1 en-pronoun", "docs/handbooks/fx.pl.md:1 pl-feminine"],
        input: {
            budgets: {
                surfaces: { "world-voice": { target: 30, limit: 45, what: "the world", fail: null } },
                rules: [{ surface: "world-voice", sender: ["announce"] }],
                allow: []
            },
            en: {
                "DRPG.Fx.voice": "I have chosen my victim.",                  // the world's voice in the first person: flagged
                "DRPG.Fx.voiceOk": "A body has been discovered.",             // passes
                "DRPG.Fx.laugh": "Upupu! A body.",                            // Monokuma's laugh on the world's voice: flagged
                "DRPG.Fx.privateI": "I told my GM.",                          // a private card, not the world's voice: passes
                "DRPG.Fx.he": "Monokuma does not clean up after himself.",    // flagged
                "DRPG.Fx.they": "Monokuma waits for their turn. He leaves.",  // "He" is the next sentence's: passes
                "DRPG.Fx.other": "{name} sees Monokuma. She waits."           // passes
            },
            pl: {
                "DRPG.Fx.fem": "Monokuma nałożyła karę.",                     // flagged
                "DRPG.Fx.masc": "Monokuma nałożył karę.",                     // passes
                "DRPG.Fx.voice": "Wybrałem ofiarę, mówię ja."                 // the world's voice in the first person: flagged
            },
            scripts: {
                "scripts/fx-voice.mjs": [
                    "await announce({ content: game.i18n.localize(\"DRPG.Fx.voice\") });",
                    "await announce({ content: game.i18n.localize(\"DRPG.Fx.voiceOk\") });",
                    "await announce({ content: game.i18n.localize(\"DRPG.Fx.laugh\") });",
                    "await announce({ content: game.i18n.localize(\"DRPG.Fx.privateI\"), whisper: gmIds() });"
                ].join("\n")
            },
            docs: {
                "docs/handbooks/fx.en.md": "Monokuma moves his pieces.\nThe GM reads “Monokuma says he is fine.” aloud.",   // line 1 flagged; a quoted line passes
                "docs/handbooks/fx.pl.md": "Monokuma zrobiła to.",                                                          // flagged
                "docs/other.md": "Monokuma and his bears."                                                                  // not a handbook: not read
            }
        }
    },
    colonChains: {
        flags: ["DRPG.Config.FX.x en", "DRPG.Fx.a en", "DRPG.Fx.a pl", "DRPG.Fx.d en"],
        input: {
            en: {
                "DRPG.Fx.a": "Crime: {a}; faint: {b}; key: {c}; final: {d}.",                   // four: flagged
                "DRPG.Fx.b": "At 12:30: the bell: rings.",                                       // a time is no colon: two, passes
                "DRPG.Fx.c": "<table><tr><td>Hope:</td><td>Despair:</td><td>Sanity:</td></tr></table> Total: {n}",   // the cells' labels: one, passes
                "DRPG.Fx.d": "See https://a.b: one: two: three",                                 // the URL's is not read: three, flagged
                "DRPG.Fx.e": "<span style=\"a:b;c:d\">Room: {room}</span>"                       // markup is not read: one, passes
            },
            prose: { "DRPG.Config.FX.x": "A: b: c: d" },                                          // three: flagged
            pl: { "DRPG.Fx.a": "Zbrodnia: {a}; słabe: {b}; klucz: {c}." }                          // three: flagged
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
 * is no ledger row, and a key allowed twice for one rule; from C6 a surface with no `fail`,
 * one whose `fail` is no ledger row, one that fails with no limit, and an allow row for
 * T16 - each one sentence, exactly these.
 */
export const BUDGETS_SCHEMA_FIXTURE = Object.freeze({
    stages: ["E01"],
    doc: {
        $comment: "fixture", status: "fixture", unit: "words", extra: 1,
        surfaces: {
            "fx-label": { target: 3, limit: 5, what: "a label", fail: "E01" },
            "fx-diag": { target: 60, limit: null, what: "reported only", fail: null },
            "fx-tight": { target: 4, limit: 4, what: "a limit at its target", fail: null },
            "fx-loose": { target: 4, limit: 9, what: "a limit over twice its target", fail: "E99" },
            "fx-none": { limit: 6, what: "no target", colour: "red", fail: null },
            "fx-unread": { target: 10, limit: 15, what: "no rule names it" },
            "fx-never": { target: 60, limit: null, what: "reported only, and red", fail: "E01" }
        },
        rules: [
            { surface: "fx-label", keys: "\\.label$" },
            { surface: "fx-diag", sender: ["whisperToGms"] },
            { surface: "fx-tight", keys: "(" },
            { surface: "fx-loose", keys: "x", sender: ["announce"] },
            { surface: "fx-none", sender: ["shout"] },
            { surface: "fx-gone", keys: "y" },
            { surface: "fx-never", keys: "z" }
        ],
        allow: [
            { key: "DRPG.Fx.ok", rule: "T4", why: "a reason", until: "E01" },
            { key: "DRPG.Fx.noWhy", rule: "X3", until: "E01" },
            { key: "DRPG.Fx.late", rule: "X22", why: "a reason", until: "E99" },
            { key: "DRPG.Fx.ok", rule: "T4", why: "again", until: "E01" },
            { key: "DRPG.Fx.second", rule: "T16", why: "T16 has no allow list", until: "E01" }
        ]
    },
    want: [
        "docs/text-budgets.json has a field \"extra\" the budgets do not know",
        "surface fx-tight's limit 4 is not above its target 4 and at most twice it (DB11: about 1.5 times)",
        "surface fx-loose's limit 9 is not above its target 4 and at most twice it (DB11: about 1.5 times)",
        "surface fx-loose's fail \"E99\" is neither a row of tools/stages.json nor null",
        "surface fx-none has no \"target\"",
        "surface fx-none has a field \"colour\" the budgets do not know",
        "surface fx-unread has no \"fail\"",
        "surface fx-never fails from E01 and has no limit - a surface reported only is never red",
        "rule 3's keys \"(\" is no regular expression",
        "rule 4 reads both keys and a sender - one of them, never both",
        "rule 5's sender [\"shout\"] is not a list of the senders tests-text.mjs knows (SENDERS)",
        "rule 6's surface \"fx-gone\" is no surface of the file",
        "surface fx-unread is named by no rule - no key can reach its budget",
        "allow 2 (DRPG.Fx.noWhy) has no \"why\"",
        "allow 3 (DRPG.Fx.late)'s rule \"X22\" is not T4 or an X rule (X1 to X21)",
        "allow 3 (DRPG.Fx.late)'s until \"E99\" is no row of tools/stages.json",
        "allow 4 (DRPG.Fx.ok): the key \"DRPG.Fx.ok\" is allowed twice for T4",
        "allow 5 (DRPG.Fx.second)'s rule \"T16\" is not T4 or an X rule (X1 to X21)"
    ]
});

/**
 * Every detector on its fixture: [] when each flags exactly its fixture's items
 * and read something, else one sentence a mismatch. `detectors` defaults to this
 * file's; check.mjs and R1058 pass none, a planted fault passes its own. `tools`
 * goes into every fixture's bag - the lexer, which a detector that reads code
 * needs and this file cannot import. Then every baseline row is well formed and
 * belongs to a FAIL detector, and `legacyListsFrom`, the matcher and the two
 * schemas (the glossary's, the budgets') answer their own cases; `schemas` stands
 * in for the two (E65 C6: how check.mjs and R1058 see that a schema stubbed to
 * answer [] is caught - C5's mutant M13, the budgets' line of this check removed,
 * lived until then). Last, every X rule T5 matches has its own fixture line.
 */
export function selfCheck(detectors = DETECTORS, tools = {}, schemas = {}) {
    const out = [];
    const gs = schemas.glossarySchema ?? glossarySchema, bs = schemas.budgetsSchema ?? budgetsSchema;
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
    const schema = gs(GLOSSARY_SCHEMA_FIXTURE.doc, GLOSSARY_SCHEMA_FIXTURE.stages);
    if (JSON.stringify(schema) !== JSON.stringify(GLOSSARY_SCHEMA_FIXTURE.want)) {
        out.push(`glossarySchema answers ${JSON.stringify(schema)} on its fixture, not ${JSON.stringify(GLOSSARY_SCHEMA_FIXTURE.want)} - a fault in docs/glossary.json would pass`);
    }
    const budgets = bs(BUDGETS_SCHEMA_FIXTURE.doc, BUDGETS_SCHEMA_FIXTURE.stages);
    if (JSON.stringify(budgets) !== JSON.stringify(BUDGETS_SCHEMA_FIXTURE.want)) {
        out.push(`budgetsSchema answers ${JSON.stringify(budgets)} on its fixture, not ${JSON.stringify(BUDGETS_SCHEMA_FIXTURE.want)} - a fault in docs/text-budgets.json would pass`);
    }
    /* T5's matchers (E65 C6): every X rule a matcher of X_RULES reads has a line of its own in T5's fixture, so a matcher
       broken to match nothing is a fixture mismatch under its own rule number. */
    for (const r of X_RULES) {
        if (!r.by && !(FIXTURES.patterns?.flags ?? []).some(f => f.endsWith(` ${r.id}-en`) || f.endsWith(` ${r.id}-pl`))) out.push(`${r.id} has no line of its own in T5's fixture - its matcher is held by nothing`);
    }
    return out;
}
