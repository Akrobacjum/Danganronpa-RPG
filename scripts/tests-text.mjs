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
 * orchestrator's reading of 31.10, which C11's audience map left in place), T5
 * (`patterns`, one matcher per X rule of the guide, X_RULES), T7's part (`ruleNumberWords`, a
 * rule's number written as a word), T21 (`monokumaVoice`, DB1, DB5, PL4) and T24
 * (`colonChains`, more than two colons in a string). Their bag adds `budgets`
 * (the parsed file); T4, T5 and T21 read the scripts for the senders when handed
 * them, with the lexer. At C7 the eight report detectors of the language rules
 * (E65-16), each a candidate list: T11 (`loanGender`) and T12 (`loanDeclension`),
 * the Polish gender and declension of the glossary's loanwords, which read the
 * glossary's `declension` (added in C7: DB4's forms by case, `indeclinable`,
 * `countable`) and the Polish handbooks besides pl.json; T17 (`oxfordComma`), T18
 * (`telegraph`, the guide's X6, which T5 leaves to it), T19 (`contractions`, with
 * each surface's shares), T22 (`mirror`, the share of EN/PL pairs with the same
 * sentence count and punctuation skeleton), T23 (`itemQuotes`, which reads the
 * scripts with the lexer for the keys the code already quotes) and T25
 * (`bareLeft`). At C8 the two report detectors that read the scripts (E65-17),
 * each with the lexer and a finding keyed `<file>:<line>`: T13 (`uiLiterals`,
 * English literals in a script that draws UI, the console's text, a refusal's
 * reason, a class list, a selector and CSS set aside) and T20 (`localeCalls`,
 * `Intl.ListFormat` and `toLocale*String` outside utils.mjs's `listOf` and
 * `plural`). At C9 T27 (`naturalnessBefore`, E65-18, report, and it stays one): a
 * naturalness pair's "before" still in pl.json, the pairs read off the guide's own
 * table (docs/text-style.md section 12, through `naturalnessPairs`, so the guide is
 * their one source); the pairs whose before is gone are listed apart, and the table's
 * faults are red in `text`. At C10 T15 (`renderChecks`, E65-19, report, FAIL from E71):
 * the render's checks over the strings tools/text-render.mjs fills with its fixtures -
 * a brace left, a key printed, a family short of an n, a placeholder with no fixture, a
 * key not rendered - its bag `render` (made in memory by check.mjs; the tool writes the
 * files); and T19 reads the screen map's marks (`marks`, tools/text-map.mjs: the screens
 * that state a rule or a safety tool, decision 52 of 31.10) beside its own reading. At C11
 * T16 (`secondPersonToMany`, E65-20, report, FAIL from E71 with no allowlist): "you" on a
 * card the room, the incident's audience or the whole table reads at once, its bag
 * `audience` (tools/text-audience.mjs: each key's sends and their readers, made in memory
 * by check.mjs).
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
/* The three written as HTML entities (E65 fix round, 01.11.2026): wherever the module puts a value into markup (innerHTML,
   a chat card) "&ndash;", "&#8212;" or "&#x2212;" is drawn as the character itself, so T6 reads it as one. Named (in
   lower case, as HTML spells them), decimal and hex forms, leading zeros; 0 of them on this tree (lang/, scripts/, docs/:
   git grep 01.11.2026). */
const DASH_ENTITY = /&(?:(ndash|mdash|minus)|#0*(8211|8212|8722)|#[xX]0*(2013|2014|2212));/g;
const ENTITY_CHAR = Object.freeze({ ndash: "\u2013", mdash: "\u2014", minus: "\u2212", 8211: "\u2013", 8212: "\u2014", 8722: "\u2212", 2013: "\u2013", 2014: "\u2014", 2212: "\u2212" });
const shownDashes = text => text.replace(DASH_ENTITY, (_, name, dec, hex) => ENTITY_CHAR[name ?? dec ?? hex]);
const around = (text, at) => text.slice(Math.max(0, at - 10), at + 11).replace(/\s+/g, " ").trim();

/**
 * T6 (plan, S06-52 and S02-66): no en dash, em dash or minus sign (U+2013,
 * U+2014, U+2212) in what the module shows - the language files' values (`en`,
 * `pl`), config.mjs's English prose (`prose`), the string literals and template
 * text of its scripts (`scripts`; comments and regex literals not read, an
 * escape read as the character it writes) and the `.md` files under docs/
 * (`docs`, a line at a time), a dash written as an HTML entity read as the
 * character it is drawn as (`shownDashes`, E65 fix round). The house rule is "-"; `dashes` holds the en and
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
    const unit = (kind, file, key, raw, where) => {
        read++;
        counts[kind] = (counts[kind] ?? 0) + 1;
        const text = shownDashes(raw), entity = text !== raw;
        const at = text.search(DASH);
        if (at < 0) return;
        const names = [...new Set(text.match(DASH))].map(c => DASH_NAMES[c]).join(", ");
        const quote = around(text, at);
        found.push({ key: key ?? `${file} "${quote}"`, kind, file, text: raw,
            what: `${where}: ${names}${entity ? " (written as an HTML entity, drawn as the character)" : ""} in "${quote}" - the house rule is "-"` });
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
 * "nothing forbidden". From E65 C7 an entry may say how its Polish term declines,
 * `declension` (DB4, D33c): `{ indeclinable: true }`, or the forms it lists by
 * case (DECLENSION_CASES: gen, dat, instr, loc, plural), with `countable: true` for
 * DB4's countable nouns - one or the other, never both; T11, T12 and T18 read it.
 */
const GLOSSARY_FIELDS = Object.freeze({
    entry: Object.freeze({ required: ["id", "en", "pl", "gender", "inflection", "forbidden", "stage", "source"], optional: ["open", "note", "rule", "declension"] }),
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
        if (Object.hasOwn(e, "declension")) {
            const d = e.declension, cases = d && typeof d === "object" && !Array.isArray(d) ? DECLENSION_CASES.filter(c => Object.hasOwn(d, c)) : [];
            const shape = d && typeof d === "object" && !Array.isArray(d) && Object.keys(d).every(k => ["indeclinable", "countable", ...DECLENSION_CASES].includes(k))
                && [undefined, true].includes(d.indeclinable) && [undefined, true].includes(d.countable) && cases.every(c => isText(d[c]));
            if (!shape || (d.indeclinable === true) === (cases.length > 0) || (d.countable === true && !cases.length)) {
                out.push(`${where}'s declension is neither { indeclinable: true } nor the forms it lists by case (${DECLENSION_CASES.join(", ")}), countable or not`);
            }
        }
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
 * through docs/text-budgets.json's sender rules). C11's audience map does not replace
 * it: the map needs espree, which the suite in Foundry does not have, and the two
 * readings differ by more than a swap - measured 31.10, this one names 686 keys and
 * the map 1219, 640 in both, 46 here alone and 579 there alone, and 377 of the map's
 * keys have no surface by this reading, so T4's findings would move with it. In each
 * script, comments and literals told apart by the lexer, a call of a sender (SENDERS) is found, and every key written as a literal inside
 * its arguments - a string, or a template with no `${...}` - is posted by it. A
 * call whose arguments name `roomAudience(...)` or `incidentAudienceIds(...)` is
 * that audience's (a card to the room, to the incident's people), whatever posts
 * it - `ChatMessage.create` is read only so; `announce` handed a `whisper` list and
 * neither audience is a private card to people this reading does not know, and is
 * counted (`private`), not assigned. Not read (the audience map reads them): a key
 * held in a variable first and posted through it (`const content = ...; announce({ content })`), a
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
/* What X16 does not read as shouting: acronyms of the module's text, read 31.10 (GM, MG and BN are the Polish GM and NPC), and
   from E65 C7 "OBJECTION", the game's shout on the HUD's button - a name, as X16 sets names aside (the orchestrator's decision
   of 31.10 on C6's Open 41). */
const ACRONYMS = Object.freeze(["GM", "GMs", "MG", "RPG", "DRPG", "HUD", "NPC", "NPCs", "BN", "KB", "MB", "DC", "UI", "API", "PTT", "AV", "OK", "ID", "URL", "PH", "OBJECTION"]);
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

/* ----------------------- the language rules (C7) --------------------------- */

/**
 * WHAT C7'S EIGHT READ (E65 C7, 31.10.2026; E65-16): the language rules of the
 * guide's sections 6 and 7 - T11 and T12 (the Polish of the glossary's loanwords,
 * DB4, DB28, DB39), T17 (lists, DB35), T18 (telegraph style, X6), T19
 * (contractions, DB8), T22 (the mirror, DB26), T23 (an item's name in quotes,
 * DB31) and T25 (a bare "zostało {n}", PL7). All report, every one a candidate
 * list for a reader, never a verdict, and every heuristic here rebuilt 30.10 as its
 * rule is ("rebuilt" in the T-table where only the number survives: T11, T12, T17,
 * T18, T19, T23) - to confirm in the pilot. The units are C6's (`uiUnits`: en.json
 * and config.mjs's prose as "en", pl.json as "pl"); T11 and T12 read the Polish
 * handbooks as well, a line at a time, as the glossary's scopes do.
 */

/* An abbreviation the module writes, after which a "." ends no sentence: "e.g.", "Ch." (a chapter), "np.", "Maks.", "Rozdz.",
   "Dz.", "nr" ... - read 31.10 off both files. "etc." and "itd." are left out: they end a list, and often the sentence. */
const ABBREVIATIONS = "e\\.g|i\\.e|vs|ch|np|tzn|maks|rozdz|dz|godz|zob|por|tj|nr";
const ABBREVIATION = new RegExp(`(?:^|[\\s(])(?:${ABBREVIATIONS})\\.$`, "iu"), ABBREVIATION_ANY = new RegExp(`(?<![\\p{L}])(?:${ABBREVIATIONS})\\.`, "giu");

/**
 * The sentences of a string, as T18 and T22 count them: tags and entities
 * blanked, a sentence ending at ".", "!", "?" or an ellipsis before a space or the
 * end - not after an ABBREVIATION, and not where the next word opens in lower case
 * ("e.g. anything", "Loading... please wait" are one). A piece with no letter and no
 * placeholder is no sentence. The two languages are cut by the same rule, which is
 * what a mirror needs.
 */
export function sentencesOf(text) {
    const t = untagged(text).replace(/\s+/g, " ").trim(), out = [];
    let start = 0;
    for (const m of t.matchAll(/[.!?…]+(?=\s|$)/gu)) {
        const end = m.index + m[0].length, piece = t.slice(start, end);
        if (m[0] === "." && ABBREVIATION.test(piece)) continue;
        if (/^\s*\p{Ll}/u.test(t.slice(end))) continue;
        out.push(piece.trim());
        start = end;
    }
    const rest = t.slice(start).trim();
    if (rest) out.push(rest);
    return out.filter(s => /[\p{L}{]/u.test(s));
}

/* A glossary term as a whole word: no letter, digit or "_" before it, and none - nor a hyphen or an apostrophe, which
   would make it a Polish form ("GM-a") - after it. The first letter in either case, the rest as written. */
const anyFirst = term => `[${escapeRe(term[0].toUpperCase())}${escapeRe(term[0].toLowerCase())}]${escapeRe(term.slice(1))}`;
const bareTermRe = (term, flags = "gu") => new RegExp(`(?<![\\p{L}\\p{N}_])${anyFirst(term)}(?![\\p{L}\\p{N}_'’-])`, flags);

/* The Polish units T11 and T12 read: pl.json's values, tags blanked, and the Polish handbooks a line at a time, their "**" and
   backticks blanked (markup, not words). */
function plUnits(bag) {
    const out = [];
    for (const [key, text] of asMap(bag.pl)) if (typeof text === "string") out.push({ key, where: `lang/pl.json ${key}`, text: untagged(text) });
    for (const [file, text] of asMap(bag.docs)) {
        if (!/^docs\/handbooks\/[^/]+\.pl\.md$/.test(file)) continue;
        String(text ?? "").split("\n").forEach((line, i) => out.push({ key: `${file}:${i + 1}`, where: `${file}:${i + 1}`, text: line.replace(/\*\*|`/g, " ") }));
    }
    return out;
}

/* The glossary's entries with a Polish term, and what its `declension` (E65 C7) says: `indeclinable`, the `forms` it lists by
   case, `countable` (DB4's countable nouns, which T18 reads in English). */
function loanwords(glossary) {
    return (Array.isArray(glossary?.entries) ? glossary.entries : []).filter(e => typeof e?.pl === "string" && e.pl.trim() !== "").map(e => {
        const d = e.declension && typeof e.declension === "object" ? e.declension : {};
        const forms = Object.fromEntries(DECLENSION_CASES.filter(c => typeof d[c] === "string").map(c => [c, d[c]]));
        return { id: e.id, en: e.en, pl: e.pl, gender: e.gender, stage: e.stage, indeclinable: d.indeclinable === true, countable: d.countable === true, forms };
    });
}

/* --------------------------------- T11 ------------------------------------- */

/**
 * The words T11 holds to a loanword's gender (DB28, DB39): a closed list of
 * modifiers - the demonstrative "ten", the possessives, "jeden", "żaden", "sam",
 * and the adjectives a module text puts before a game noun ("każdy", "nowy",
 * "jedyny", "cały", "inny", "kolejny", "następny", "pierwszy", "który", "własny",
 * "ostatni") - each form with the genders it can agree with: m, f, n, and "pl" for a
 * plural ("twoje" is a neuter singular or a plural; "tym" also a plural's dative).
 * "to" is left out: "To Truth Bullet" is a copula as often as a demonstrative.
 */
const MODIFIERS = (() => {
    const map = new Map();
    const put = (forms, genders) => { for (const f of forms.split(" ")) map.set(f, genders); };
    put("ten twój swój mój nasz wasz jeden żaden sam", "m");
    put("ta tę tą tej twoja twoją twojej swoja swoją swojej moja moją mojej nasza naszą naszej wasza waszą waszej jedna jedną jednej żadna żadną żadnej sama samą samej", "f");
    put("jedno samo", "n");
    put("te same", "pl");
    put("twoje swoje moje nasze wasze żadne", "n pl");
    put("tego temu twojego twojemu swojego swojemu mojego mojemu naszego naszemu waszego waszemu jednego jednemu żadnego żadnemu samego samemu", "m n");
    put("tym twoim swoim moim naszym waszym jednym żadnym samym", "m n pl");
    const hard = { y: "m", a: "f", "ą": "f", ej: "f", e: "n pl", ego: "m n", emu: "m n", ym: "m n pl" };
    for (const stem of ["każd", "now", "jedyn", "cał", "inn", "kolejn", "następn", "pierwsz", "któr", "własn"]) for (const [end, g] of Object.entries(hard)) map.set(stem + end, g);
    for (const [end, g] of Object.entries({ i: "m", ia: "f", "ią": "f", iej: "f", ie: "n pl", iego: "m n", iemu: "m n", im: "m n pl" })) map.set(`ostatn${end}`, g);
    return new Map([...map].map(([f, g]) => [f, Object.freeze(new Set(g.split(" ")))]));
})();
const GENDER_NAMES = Object.freeze({ m: "masculine", f: "feminine", n: "neuter", pl: "plural" });
/* A word that opens a clause before its subject: a conjunction or a particle; with the modifiers, what may stand before a
   loanword for it to be the clause's subject, and so the one its predicate agrees with. */
const OPENERS = new Set("i a ale lub albo oraz gdy kiedy że bo jeśli jeżeli więc ani czy aż dopóki zanim choć jednak też także teraz już wtedy potem nawet tylko".split(" "));
/* A clause ends at a sentence mark, a comma, a colon, a semicolon, a bracket, a table's "|" or a spaced dash. */
const CLAUSE_END = /[.!?;:,()|]|\s-\s/u;
/* A predicate's gender: a past form ("został", "została", "zostało", "-li", "-ły") or a passive participle ("wydany",
   "postawiony", "zamknięta", "otwarta", "zużyty", "oddalone": -any, -ony, -ęty and -ty after a vowel or "r", six letters at
   least), right after the subject or after the words PREDICATE_SKIP passes over - negation, particles, "się" and the
   copulas ("Eclipse nie jest używany"). Any other word ends the reading: "Class Trial toczy się jako otwarta dyskusja" has
   its predicate in "toczy", and "otwarta" is the discussion's. A bare "-na"/"-ta" is no participle here: "zaczyna",
   "można", "sprząta", "czyta" are verbs (read 31.10, the first version's false readings). */
const PAST_FORM = /^\p{Ll}{2,}(ł|ła|ło|li|ły)$/u, PARTICIPLE = /^\p{Ll}{3,}(?:an|on|ęt|yt|it|ut|art|ert|ort)(y|a|e|i)$/u;
const PREDICATE_SKIP = new Set("nie już jeszcze się wciąż teraz zawsze też także nigdy właśnie znów znowu dopiero jest są będzie będą zostanie zostaje zostają staje bywa".split(" "));
const PAST_GENDER = Object.freeze({ "ł": ["m"], "ła": ["f"], "ło": ["n"], li: ["pl"], "ły": ["pl"] });
const PARTICIPLE_GENDER = Object.freeze({ y: ["m"], a: ["f"], e: ["n", "pl"], i: ["pl"] });
const shownGenders = set => [...set].map(g => GENDER_NAMES[g]).join(" or ");

/**
 * T11 (rebuilt 30.10 from "rodzaj", S18-33, with DB28 and DB39; report from
 * E65, FAIL from E71): a Polish word agreeing with a glossary loanword against the
 * entry's `gender`. Each bare occurrence of a term that has a gender (the term as a
 * whole word, no Polish ending after it) is held to three neighbours, each in its
 * own clause: the word right before it, if it is one of MODIFIERS ("before":
 * "nowa Truth Bullet"); a "który" form right after its comma ("which"); and, when
 * the term opens its clause (nothing before it there but OPENERS and MODIFIERS), its
 * predicate - a past form or a participle right after it or after the words
 * PREDICATE_SKIP passes over, within five words ("after": "Nonstop Debate
 * został"); any other word ends the reading, so a second loanword in the
 * sentence is never read as the first one's predicate. A term the entry declines
 * (`declension` lists its forms, DB4's countable nouns) is singular when bare; any
 * other may be a plural, so a plural form agrees with it. Every finding is a
 * candidate: the word may belong to another noun.
 */
export function loanGender(bag = {}) {
    const terms = loanwords(bag.glossary).filter(t => ["m", "f", "n"].includes(t.gender));
    const found = [];
    let read = 0;
    const res = terms.map(t => ({ t, re: bareTermRe(t.pl), allowed: new Set(Object.keys(t.forms).length ? [t.gender] : [t.gender, "pl"]) }));
    for (const u of plUnits(bag)) {
        read++;
        const spans = res.flatMap(r => [...u.text.matchAll(r.re)].map(m => ({ ...r, start: m.index, end: m.index + m[0].length })));
        for (const s of spans) {
            const hit = (kind, word, genders) => found.push({ key: u.key, kind: `${s.t.id}-${kind}`, entry: s.t.id, lang: "pl",
                what: `${u.where}: "${quoted(u.text, s.start, s.end - s.start)}" - "${word}" is ${shownGenders(genders)}, and ${s.t.pl} is ${GENDER_NAMES[s.t.gender]} (DB28, DB39; glossary ${s.t.id}; T11, a candidate)` });
            const disagrees = genders => ![...genders].some(g => s.allowed.has(g));
            const before = u.text.slice(0, s.start);
            const clause = before.split(CLAUSE_END).pop();
            const words = clause.trim().split(/\s+/).filter(Boolean);
            const prev = words.at(-1)?.toLowerCase();
            if (prev && MODIFIERS.has(prev) && disagrees(MODIFIERS.get(prev))) hit("before", words.at(-1), MODIFIERS.get(prev));
            const after = u.text.slice(s.end);
            const which = after.match(/^\s*,\s*(któr\p{L}*)(?!\p{L})/u);
            if (which && MODIFIERS.has(which[1].toLowerCase()) && disagrees(MODIFIERS.get(which[1].toLowerCase()))) hit("which", which[1], MODIFIERS.get(which[1].toLowerCase()));
            if (!words.every(w => OPENERS.has(w.toLowerCase()) || MODIFIERS.has(w.toLowerCase()))) continue;
            const rest = after.split(CLAUSE_END)[0];
            for (const w of rest.trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
                if (PREDICATE_SKIP.has(w.toLowerCase())) continue;
                const past = w.match(PAST_FORM), part = past ? null : w.match(PARTICIPLE);
                if (past || part) {
                    const genders = new Set(past ? PAST_GENDER[past[1]] : PARTICIPLE_GENDER[part[1]]);
                    if (disagrees(genders)) hit("after", w, genders);
                }
                break;
            }
        }
    }
    return { found, read, counts: { terms: terms.length } };
}

/* --------------------------------- T12 ------------------------------------- */

/* The cases a glossary entry may list a form for (`declension`), and the prepositions that govern each with no accusative
   beside it - a masculine inanimate noun's accusative is its bare form, so "w", "na", "o", "po", "za", "nad", "pod", "przed"
   and "przez" prove nothing. "z"/"ze" take the genitive or the instrumental: a bare form after them is wrong in both. */
export const DECLENSION_CASES = Object.freeze(["gen", "dat", "instr", "loc", "plural"]);
const GOVERNS = Object.freeze({
    gen: Object.freeze(["bez", "dla", "do", "od", "u", "podczas", "według", "wśród", "obok", "oprócz", "zamiast", "wokół", "około", "spośród", "spod", "sprzed", "zza", "znad", "spoza", "z", "ze"]),
    dat: Object.freeze(["dzięki", "ku", "przeciw", "przeciwko", "wbrew"]),
    instr: Object.freeze(["z", "ze"]),
    loc: Object.freeze(["przy"])
});
const CASE_NAMES = Object.freeze({ gen: "genitive", dat: "dative", instr: "instrumental", loc: "locative" });
/* The Polish case endings a noun takes (DB4's -u of "biletu", -a, -owi, -em, -ie/-zie, -y/-i, -ów, -om, -ami, -ach), read
   on an indeclinable term as one word with it ("Class Trialu", "safeworda", "Findingsów"). */
const CASE_ENDINGS = "a|u|owi|em|ie|zie|y|i|ów|om|ami|ach";

/**
 * T12 (rebuilt 30.10 from "przypadki", with DB4; report from E65, FAIL from
 * E71): the declension of the glossary's loanwords (`declension`). (1) "ending": an
 * indeclinable entry (Class Trial, safeword, Findings) written with a case ending,
 * with or without an apostrophe or hyphen ("Class Trialu", "safeword'a"). (2)
 * "bare": an entry DB4 declines, written bare after a preposition that governs a
 * case whose form the entry lists (GOVERNS: "dla Truth Bullet" where DB4 writes
 * "Truth Bulletu"), one modifier of T11's list allowed between ("do twojego Truth
 * Bullet"). Both in pl.json and the Polish handbooks. T8 also reads the endings of
 * the three indeclinable entries, as their forbidden variants; T12 reads every
 * entry the glossary marks so. Every finding is a candidate.
 */
export function loanDeclension(bag = {}) {
    const terms = loanwords(bag.glossary).filter(t => t.indeclinable || Object.keys(t.forms).length);
    const found = [];
    let read = 0;
    const checks = terms.flatMap(t => (t.indeclinable
        ? [{ t, kind: "ending", re: new RegExp(`(?<![\\p{L}\\p{N}_])${anyFirst(t.pl)}['’-]?(?:${CASE_ENDINGS})(?![\\p{L}\\p{N}_])`, "gu") }]
        : Object.keys(GOVERNS).filter(c => t.forms[c]).map(c => ({ t, kind: "bare", case: c,
            re: new RegExp(`(?<![\\p{L}\\p{N}_])(${GOVERNS[c].join("|")})\\s+(?:(\\p{L}+)\\s+)?${anyFirst(t.pl)}(?![\\p{L}\\p{N}_'’-])`, "giu") }))));
    for (const u of plUnits(bag)) {
        read++;
        const seen = new Set();
        for (const c of checks) {
            for (const m of u.text.matchAll(c.re)) {
                /* One modifier between, never a "który" form: "do której GM przypisał" opens a clause whose subject is the GM. */
                if (c.kind === "bare" && m[2] !== undefined && (!MODIFIERS.has(m[2].toLowerCase()) || /^któr/iu.test(m[2]))) continue;
                if (seen.has(`${c.t.id}@${m.index}`)) continue;
                seen.add(`${c.t.id}@${m.index}`);
                found.push({ key: u.key, kind: `${c.t.id}-${c.kind}`, entry: c.t.id, lang: "pl",
                    what: c.kind === "ending"
                        ? `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - ${c.t.pl} does not decline, "${m[0]}" gives it a case ending (DB4; glossary ${c.t.id}; T12, a candidate)`
                        : `${u.where}: "${quoted(u.text, m.index, m[0].length)}" - "${m[1]}" takes the ${CASE_NAMES[c.case]}, which DB4 writes "${c.t.forms[c.case]}" (glossary ${c.t.id}; T12, a candidate)` });
            }
        }
    }
    return { found, read, counts: { terms: terms.length } };
}

/* --------------------------------- T17 ------------------------------------- */

/* An item of a list: up to three words of letters, digits, placeholders, apostrophes and hyphens. */
const LIST_ITEM = "[\\p{L}\\p{N}{}'’-]+";
/* What a list's middle item never opens with, in English (a clause's subject or link: "If you win, you gain Hope and ...") or
   holds (a finite verb), and the Polish words that open a subordinate clause, whose comma before "i" is the clause's. */
const EN_NOT_ITEM = new RegExp(`^(?:you|they|it|he|she|we|i|there|then|so|but|yet|not|which|who|whoever|when|if|once|while|as|with)(?![\\p{L}])`, "iu");
const EN_FINITE_AUX = new RegExp(W("is|are|was|were|has|have|had|do|does|did|can|cannot|could|will|would|shall|should|may|might|must|isn't|aren't|wasn't|weren't|hasn't|haven't|doesn't|don't|didn't|can't|won't|wouldn't"), "iu");
const PL_SUBORDINATE = new RegExp(W("któr\\p{L}*|gdy|jeśli|jeżeli|że|jak\\p{L}*|aby|żeby|bo|dokąd|gdzie|kiedy|co|kto|czego|kogo|komu|niż|dopóki|zanim|choć|skoro|czy|ile|póki|by"), "iu");
const EN_LIST = new RegExp(`(${LIST_ITEM}(?: ${LIST_ITEM}){0,2}), ((?:${LIST_ITEM} ){0,2}${LIST_ITEM}) (and|or) (?!not(?![\\p{L}]))(?=[\\p{L}\\p{N}{“"])`, "gu");
const PL_LIST = new RegExp(`((?:${LIST_ITEM} ){0,2}${LIST_ITEM}), ((?:${LIST_ITEM} ){0,2}${LIST_ITEM}), i (?=\\p{L})`, "u");

/**
 * T17 (rebuilt 30.10 from "listy", with DB35; report, and it stays one): (1) in
 * English, a list of three or more with no comma before its "and" or "or"
 * ("Health, Sanity and Hope", DB35's Oxford comma) - the shape "A, B and C" in one
 * clause, B at most three words, holding no finite auxiliary and opening with no
 * subject or link word (EN_NOT_ITEM); "A, B, and C" passes, and so do two items. (2)
 * In Polish, a comma before the "i" that closes a list ("A, B, i C"), the list's
 * items short and none opening a subordinate clause - a comma that closes one ("...,
 * które X, i Y") is Polish punctuation and passes. One finding a string. Lists the
 * code builds (utils.mjs `listOf`, Intl.ListFormat) are not read here: T20 holds
 * where they are built.
 */
export function oxfordComma(bag = {}) {
    const found = [], byLang = { en: 0, pl: 0 };
    let read = 0;
    for (const u of uiUnits(bag)) {
        read++;
        const clauses = untagged(u.text).split(/(?<=[.!?:;])\s|\s-\s/u);
        let m = null;
        for (const c of clauses) {
            m = u.lang === "en" ? [...c.matchAll(EN_LIST)].find(x => !EN_FINITE_AUX.test(x[1]) && !EN_FINITE_AUX.test(x[2]) && !EN_NOT_ITEM.test(x[2])) ?? null
                : (x => (x && !PL_SUBORDINATE.test(x[1]) && !PL_SUBORDINATE.test(x[2]) ? x : null))(c.match(PL_LIST));
            if (m) break;
        }
        if (!m) continue;
        byLang[u.lang]++;
        found.push({ key: u.key, kind: u.lang, lang: u.lang,
            what: `${u.where}: "...${m[0].trim()}..." - ${u.lang === "en" ? "a list with no comma before its last \"and\"/\"or\" (DB35, the Oxford comma)" : "a comma before the \"i\" that closes a list"} (T17, a candidate)` });
    }
    return { found, read, counts: byLang };
}

/* --------------------------------- T18 ------------------------------------- */

/* A finite verb, from a small list (rebuilt 30.10, the risk's "telegrafia"): in English an auxiliary or modal, a contraction,
   a pronoun subject with a word after it ("You listen"), or one of the verbs the module's texts use most, in any of its
   finite forms; in Polish a list of the commonest forms, "się", and the endings only a finite verb has here (-uje, the second
   person's -sz, the past's -ł/-ła/-ło/-li/-ły, the plural's -my/-cie/-ą, the imperative's, the impersonal -no/-to). Both lists
   were read 31.10 against the strings the first version took for verbless, so a count here is a reading of these lists. */
const EN_VERB_WORDS = "get|go|take|make|keep|stay|leave|open|close|end|start|begin|become|need|hold|see|know|say|show|count|spend|gain|lose|roll|pick|choose|click|select|add|remove|use|try|ask|wait|set|give|find|look|search|call|let|put|write|tell|play|move|send|save|turn|run|read|change|reach|come|stop|win|pay|return|mark|tick|drag|drop|enter|type|cancel|confirm|clear|check|fill|refill|break|follow|note|fire|apply|happen|work|mean|want|like|sit|stand|bring|carry|reveal|hide|place|draw|post|press|join|act|cost|belong|decide|vote|speak|talk|answer|rule|land|lie|bear|reload|restore|replace|print|describe|install|name|exist|approve";
const EN_VERB = new RegExp(W(`is|are|was|were|be|been|has|have|had|do|does|did|can|cannot|could|will|would|shall|should|may|might|must|\\p{L}+n['’]t|\\p{L}+['’](?:re|ve|ll|d|m)|(?:it|that|there|here|what|who|where|how|he|she|let)['’]s|(?:${EN_VERB_WORDS})(?:s|es|ed)?|went|took|made|kept|left|held|saw|knew|said|showed|spent|gained|lost|gave|found|told|came|ran|won|paid|got|began|became|brought|drew|sat|stood|put|set|let|read|cut`)
    + "|\\b(?:I|you|we|they|he|she|it|there|who)\\s+\\p{L}", "iu");
const PL_VERB = new RegExp(W("jest|są|był|była|było|byli|były|będzie|będą|ma|mają|masz|może|mogą|możesz|można|trzeba|wolno|musi|muszą|musisz|da|wie|chce|zostaje|zostają|zostanie|idzie|wraca|czeka|trwa|działa|liczy|kończy|zaczyna|widzi|słyszy|mówi|robi|daje|bierze|dostaje|traci|wybiera|otwiera|zamyka|trafia|trafi|stawia|przepada|odpala|zostawia|przywraca|zdobywa|wydaje|wydają|dzielą|stoi|stoją|pozwala|pozwalają|dotyczy|wymaga|należy|oznacza|wchodzi|wychodzi|rusza|wisi|zmienia|odbiera|zabiera|krwawi|gaśnie|zadaje|żyje|się"
    + "|\\p{L}+(?:uje|ują|esz|isz|ysz|asz|cie|my|ł|ła|ło|li|ły|łeś|łaś|łem|łam|ij|aj|uj|yj|dź|erz|ą|ź|ś|ć|ń|órz|nie|ano|ono|ęto|yto|ito)"), "iu");
const ARTICLE_BEFORE = /^["“„(]?/u;

/**
 * T18 (rebuilt 30.10 from the risk's "telegrafia", the guide's X6, which T5 leaves
 * to it; report, and it stays one): (1) "verbless": a string of two or more
 * sentences (`sentencesOf`) none of which holds a finite verb (EN_VERB, PL_VERB) -
 * "Projects updated. {n} deleted." / "Motive ogłoszony. Jedna pora dnia na
 * zegarze."; (2) "article", in English: a full sentence (it ends in ".", "!" or "?")
 * that opens with a countable glossary noun with no article or determiner before it
 * and holds no finite verb ("Truth Bullet found.") - the countable nouns are the
 * entries whose `declension` says `countable` (DB4's list, and the GM). An allow row
 * for X6 silences one key. One finding a string.
 */
export function telegraph(bag = {}) {
    const countable = loanwords(bag.glossary).filter(t => t.countable && typeof t.en === "string" && t.en.trim() !== "").map(t => t.en);
    const opens = countable.length ? new RegExp(`${ARTICLE_BEFORE.source}(?:${countable.map(escapeRe).join("|")})(?![\\p{L}\\p{N}_'’-])`, "u") : null;
    const allow = allowedFor(bag.budgets, "X6");
    const found = [], counts = { multiSentence: 0, allowed: 0 };
    let read = 0;
    for (const u of uiUnits(bag)) {
        read++;
        const verb = u.lang === "en" ? EN_VERB : PL_VERB;
        const ss = sentencesOf(u.text);
        if (ss.length >= 2) counts.multiSentence++;
        let kind = ss.length >= 2 && ss.every(s => !verb.test(s)) ? "verbless" : null, at = ss.join(" ");
        if (!kind && u.lang === "en" && opens) {
            const s = ss.find(x => /[.!?]$/u.test(x) && opens.test(x) && !EN_VERB.test(x));
            if (s) { kind = "article"; at = s; }
        }
        if (!kind) continue;
        if (allow.has(u.key)) { counts.allowed++; continue; }
        found.push({ key: u.key, kind: `${u.lang}-${kind}`, lang: u.lang,
            what: `${u.where}: "${quoted(at, 0, 40)}" - ${kind === "verbless" ? `${ss.length} sentences and no finite verb in any` : "a countable glossary noun opens the sentence with no article, and no verb follows"} (X6, telegraph style; T18, a candidate)` });
    }
    return { found, read, counts };
}

/* --------------------------------- T19 ------------------------------------- */

/* An English contraction (n't, 're, 've, 'll, 'd, 'm, and 's after a pronoun - "Monokuma's" is a possessive), straight or curly. */
const CONTRACTION = /(?<![\p{L}])(?:\p{L}+n['’]t|\p{L}+['’](?:re|ve|ll|d|m)|(?:it|that|there|here|what|who|where|how|he|she|let)['’]s)(?![\p{L}])/iu;
/* A full form that could be one (the share DB8's "by default in short messages" is read against). */
const FULL_FORM = new RegExp(W("(?:do|does|did|is|are|was|were|has|have|had|will|would|should|could|must) not|cannot|(?:it|that|there|here|what|who) is|(?:you|they|we) are|I am|I will|you will|let us"), "iu");
/* A contraction that states a prohibition: can't, mustn't, mayn't, shan't, and a sentence that opens "Don't". */
const PROHIBITION = /(?<![\p{L}])(?:ca|must|may|sha)n['’]t(?![\p{L}])|(?:^|[.!?]\s+)Don['’]t(?![\p{L}])/u;
/* The surfaces that state a rule: the guide's matrix gives the config description "the rule as the code runs it" and the tile
   hint "what the action does, what it costs and when". A safety text: the safeword's keys, or a string that names it. */
const RULE_SURFACES = Object.freeze(["config-description", "tile-hint"]);
const SAFETY = /^DRPG\.Safeword\./u, SAFETY_WORD = /(?<![\p{L}])safeword/iu;

/**
 * T19 (rebuilt 30.10 from the risk's "100% skrótów", with DB8; report, and it
 * stays one): in English, (1) per surface (`surfacesOf`), how many strings hold a
 * contraction and how many a full form that could be one (`perSurface`: DB8's
 * "contractions by default in short messages" is read off the shares, not judged);
 * (2) a contraction in a text DB8 wants in full - a prohibition (PROHIBITION, any
 * surface), a safety text (SAFETY) or a rule (RULE_SURFACES): one finding a string,
 * "prohibition", "safety" or "rule", the first that holds. Polish has no
 * contractions; it is not read. From E65 C10 also a key the screen map marks
 * (`marks`, key to "rule" or "safety": the screens SCREENS marks, decision 52) - a
 * rule or a safety text by its screen as well as by its surface; `counts.byMark`
 * is what the mark alone adds.
 */
export function contractions(bag = {}) {
    const map = surfacesOf(bag, "contractions");
    const found = [], perSurface = {};
    /* The screen map's marks (E65 C10, decision 52 of 31.10): a key on a screen SCREENS marks as stating a rule or a safety
       tool (tools/text-map.mjs `marks`), read beside the key's surface and the safeword's name, never instead of them. */
    const marks = asMap(bag.marks), counts = { marked: marks.size, byMark: 0 };
    let read = 0;
    for (const u of uiUnits(bag)) {
        if (u.lang !== "en") continue;
        read++;
        const text = untagged(u.text), surface = map.surfaceOf(u.key) ?? "unclassified";
        const row = perSurface[surface] ??= { strings: 0, contracted: 0, full: 0 };
        row.strings++;
        if (FULL_FORM.test(text)) row.full++;
        const m = CONTRACTION.exec(text);
        if (!m) continue;
        row.contracted++;
        const mark = marks.get(u.key) ?? null;
        const safety = SAFETY.test(u.key) || SAFETY_WORD.test(text), rule = RULE_SURFACES.includes(surface);
        const kind = PROHIBITION.test(text) ? "prohibition" : safety || mark === "safety" ? "safety" : rule || mark === "rule" ? "rule" : null;
        if (!kind) continue;
        if ((kind === "safety" && !safety) || (kind === "rule" && !rule)) counts.byMark++;
        found.push({ key: u.key, kind, lang: "en", surface,
            what: `${u.where}: "${quoted(text, m.index, m[0].length)}" - "${m[0]}" in a ${kind === "rule" ? `rule (${surface})` : `${kind} text`}; DB8 writes it in full (T19)` });
    }
    return { found, read, perSurface, counts };
}

/* --------------------------------- T22 ------------------------------------- */

/**
 * A string's punctuation skeleton, as T22 compares the two languages: the marks
 * that shape its sentences, in order - ".", "!", "?", ":", ";", "(", ")", an
 * ellipsis, a spaced dash and a quote (any of “ ” „ " « », written "q": each
 * language has its own) - with tags, a placeholder's braces, a time's colon
 * ("12:30"), a URL's "://" and an abbreviation's periods ("e.g.", "np.") left out. Commas are left out a priori: Polish
 * grammar puts a comma before "że", "który", "gdy" where English has none, which is
 * the language's rule, not a mirror's (read 31.10 beside: with commas 72.3% of the
 * 4953 pairs are alike, without 92.9%).
 */
export function skeletonOf(text) {
    return (untagged(text).replace(ABBREVIATION_ANY, "A").replace(/\{\w+\}/g, "X").replace(/\d:\d/g, "").replace(/:\/\//g, "").replace(/\.{3}|…/gu, "…")
        .match(/…|[.!?:;()]|[“”„"«»]| - /gu) ?? []).map(c => (/[“”„"«»]/u.test(c) ? "q" : c.trim())).join("");
}

/**
 * T22 (plan, DB26's "z metryką lustra T22"; report, and it stays one): per key
 * that has a string in both languages (en.json or config.mjs's prose, and pl.json),
 * whether the two have the same number of sentences (`sentencesOf`) and the same
 * punctuation skeleton (`skeletonOf`); a plural family's `.one` and `.other` are
 * pairs of their own, Polish `.few`/`.many` have no English twin. A pair that
 * differs is one finding: "sentences" when the counts differ, else "skeleton". The
 * measure is the share (`counts`, and `perSurface` by the budgets' surfaces) - the
 * plan's reading of 99% alike in sentences and 91% in skeleton is a reading, not a
 * target; the findings are where a reader looks.
 */
export function mirror(bag = {}) {
    const map = surfacesOf(bag, "mirror");
    const en = new Map([...asMap(bag.en), ...asMap(bag.prose)]), pl = asMap(bag.pl);
    const found = [], perSurface = {}, counts = { pairs: 0, sameSentences: 0, sameSkeleton: 0 };
    let read = 0;
    for (const [key, e] of en) {
        const p = pl.get(key);
        if (typeof e !== "string" || typeof p !== "string") continue;
        read++;
        counts.pairs++;
        const surface = map.surfaceOf(key) ?? "unclassified";
        const row = perSurface[surface] ??= { pairs: 0, sameSentences: 0, sameSkeleton: 0 };
        row.pairs++;
        const a = sentencesOf(e).length, b = sentencesOf(p).length, sa = skeletonOf(e), sb = skeletonOf(p);
        if (a === b) { counts.sameSentences++; row.sameSentences++; }
        if (sa === sb) { counts.sameSkeleton++; row.sameSkeleton++; }
        if (a === b && sa === sb) continue;
        found.push({ key, kind: a !== b ? "sentences" : "skeleton", lang: "pl", surface,
            what: a !== b ? `${key}: ${a} sentence(s) in English, ${b} in Polish (T22, the mirror)` : `${key}: the punctuation "${sa}" in English, "${sb}" in Polish (T22, the mirror)` });
    }
    const share = n => (counts.pairs ? Math.round(1000 * n / counts.pairs) / 10 : 0);
    return { found, read, counts: { ...counts, sentencesShare: share(counts.sameSentences), skeletonShare: share(counts.sameSkeleton) }, perSurface };
}

/* --------------------------------- T23 ------------------------------------- */

/* The quotes DB31 puts around an item's name: “{item}” in English, „{item}” in Polish. */
const ITEM_QUOTES = Object.freeze({ en: ["“", "”"], pl: ["„", "”"] });

/**
 * The keys whose `{item}` the code fills with a name already in quotes - an
 * `item:` property whose value is a string or template that opens with a quote
 * (“ „ " «) - read off the scripts with the lexer: the key is the nearest key
 * literal before it in the same statement (a heuristic until C10's screen map,
 * which shows what fills a key). None on this tree (31.10: 105 `item:` properties,
 * none quoted).
 */
function itemsQuotedByCode(bag, name) {
    const keys = new Set();
    if (typeof bag.scripts !== "object" || bag.scripts === null) return keys;
    const lx = lexerOf(bag, name);
    for (const [, text] of asMap(bag.scripts)) {
        const code = lx.blankComments(String(text ?? "")), blank = lx.blankLiterals(code);
        const spans = literalSpans(code, blank);
        for (const m of blank.matchAll(/(?<![\w$.])item\s*:/g)) {
            /* The value's first character, read on the code: in `blank` the literal itself is spaces. */
            let at = m.index + m[0].length;
            while (/\s/.test(code[at] ?? "")) at++;
            const value = spans.find(s => s.start === at && s.kind !== "regex");
            if (!value || !/^[“„"«]/u.test(literalText(code, value))) continue;
            const statement = blank.lastIndexOf(";", m.index) + 1;
            const key = spans.filter(s => s.end <= m.index && s.start >= statement && s.kind === "string").map(s => literalText(code, s)).filter(v => KEY_LITERAL.test(v)).at(-1);
            if (key) keys.add(key);
        }
    }
    return keys;
}

/**
 * T23 (rebuilt 30.10 from DB31; report, and it stays one): an `{item}` placeholder
 * not inside the quotes DB31 gives it - “{item}” in English, „{item}” in Polish; any
 * other quote or none is a finding, one a string. A key whose `{item}` the code
 * already fills in quotes (itemsQuotedByCode) is no finding; it is counted
 * (`quotedByCode`): the text should not quote it twice, and C10's screen map shows
 * which keys those are.
 */
export function itemQuotes(bag = {}) {
    const quotedByCode = itemsQuotedByCode(bag, "itemQuotes");
    const found = [], counts = { withItem: 0, quotedByCode: 0 };
    let read = 0;
    for (const u of uiUnits(bag)) {
        read++;
        if (!u.text.includes("{item}")) continue;
        counts.withItem++;
        const [open, close] = ITEM_QUOTES[u.lang];
        const bad = [...u.text.matchAll(/\{item\}/g)].find(m => u.text[m.index - 1] !== open || u.text[m.index + 6] !== close);
        if (!bad) continue;
        if (quotedByCode.has(u.key)) { counts.quotedByCode++; continue; }
        found.push({ key: u.key, kind: u.lang, lang: u.lang,
            what: `${u.where}: "${quoted(u.text, bad.index, 6)}" - an item's name stands in ${open}{item}${close} (DB31; T23)` });
    }
    return { found, read, counts };
}

/* --------------------------------- T25 ------------------------------------- */

/* A plural family's form (PL7: the predicate belongs to the family, so "zostały {n} akcje" in `.few` is right), and a facts row:
   the whole string a label, its colon and one placeholder ("Zostało: {n}"). */
const FAMILY_FORM = /\.(?:zero|one|two|few|many|other)$/u;
const FACTS_ROW = /^\s*\p{L}[\p{L} ]*:\s*\{\w+\}\s*$/u;
const BARE_LEFT = Object.freeze({
    pl: Object.freeze([/(?<![\p{L}])(?:po)?został[oayi]?\s+\{\w+\}/iu]),
    en: Object.freeze([/(?<![\p{L}])left:\s*\{\w+\}/iu, /\{\w+\}\s+left(?![\p{L}])/iu])
});

/**
 * T25 (plan, S18-36, with PL7; report from E65, FAIL from E71): a count whose
 * predicate is not the family's, in running text - Polish "zostało {x}", "został
 * {x}", "zostały {x}", "została {x}" (and "pozostało ..."), English "left: {x}" and
 * "{x} left" - outside a plural family's forms and not as a facts row ("Zostało:
 * {n}", a label and its number alone). One finding a string; what a family's forms
 * and the facts rows hold is counted (`inFamily`, `factsRows`).
 */
export function bareLeft(bag = {}) {
    const found = [], counts = { inFamily: 0, factsRows: 0 };
    let read = 0;
    for (const u of uiUnits(bag)) {
        read++;
        const text = untagged(u.text);
        const m = BARE_LEFT[u.lang].map(re => re.exec(text)).find(Boolean);
        if (!m) continue;
        if (FAMILY_FORM.test(u.key)) { counts.inFamily++; continue; }
        if (FACTS_ROW.test(text)) { counts.factsRows++; continue; }
        found.push({ key: u.key, kind: u.lang, lang: u.lang,
            what: `${u.where}: "${quoted(text, m.index, m[0].length)}" - a bare count in a sentence: its predicate belongs in a plural family (PL7; T25)` });
    }
    return { found, read, counts };
}

/* ------------------------ the code's own text (C8) ------------------------- */

/**
 * WHAT C8'S TWO READ (E65 C8, 31.10.2026; E65-17): the scripts, not the language
 * files - T13 (English written into the code that draws a screen, S18-46) and T20
 * (a list or a date formatted outside the helpers, S18-39 and S18-40). Both report:
 * T13 turns FAIL at E71, T20 at E66. Each reads the scripts with the lexer, comments
 * blanked, and a finding is one literal or one call, keyed `<file>:<line>`, so `text`
 * lists them by file. Like C7's, a candidate list for a reader, never a verdict.
 */

/* A script that draws UI, by the slice's list: it names DialogV2, ApplicationV2 or HandlebarsApplicationMixin (an
   ApplicationV2's render), calls ui.notifications or ChatMessage.create, or assigns innerHTML or textContent. Read on
   blanked code, so a comment or a string that names one is not one. */
const UI_FILE = /\bDialogV2\b|\bApplicationV2\b|\bHandlebarsApplicationMixin\b|(?<![\w$])ui\s*\??\.\s*notifications\b|\bChatMessage\s*\??\.\s*create\b|\.\s*(?:innerHTML|textContent)\s*=(?![=>])/;

/* Text for the console, not for a screen: utils.mjs's log, debug, warn and error (bare, not a method), console.*, a
   logger's method (`env.log.error(`, `log.warn(`) and an Error's message. ui.notifications.warn( is a screen's and is not
   one of these: a method named warn is read only on a logger. */
const LOG_CALL = /(?:(?<![\w$.])(?:log|debug|warn|error)|(?<![\w$.])console\s*\??\.\s*\w+|(?<![\w$])(?:[\w$]+\s*\??\.\s*)*log\s*\??\.\s*\w+|(?<![\w$.])(?:new\s+)?(?:Type|Range|Reference|Syntax)?Error)\s*\(/g;

/* A refusal's reason: the bridge keeps the English line as the GM's record and tells the asker a code (bridge-guards.mjs
   `refuse`: "The English line is the GM's record ... The asker is told the code `reasonOf` reads off `why`", E31). Read as
   the value of a `why:` or `refused:` property, as an argument of `refuse(` or of a guard bridge-guards.mjs exports with a
   `why` parameter (gmOnly, playersOnly, owns, ...), and as a literal one of that file's REASON_PATTERNS takes whole (the
   closed list every reason maps to, R164; 202 patterns, every one anchored, on 31.10) - the last two read off that file
   when the bag holds it. */
const REASON_PROPERTY = /(?<![\w$.])(?:why|refused)\s*:\s*$/;

/* What is not text, by its shape: a class list or a CSS selector (tokens of [a-z0-9_-] with . # : [..] (..) > + ~ , *,
   one of them at least with a "-", "_", ".", "#" or "[", so "the floor is closed" is text and "drpg-card is-open" is not),
   and CSS declarations (a property with a "-" or of a short list, a colon, a value). A URL, a path, a file name and an
   icon (fa-*) are taken out of the text before its words are counted. */
const SELECTOR_TOKEN = "(?:[.#]?[a-z0-9_-]+(?:[.#:][\\w-]+|\\[[^\\]]*\\]|\\([^)]*\\))*|[>+~,*])";
const SELECTOR = new RegExp(`^\\s*${SELECTOR_TOKEN}(?:\\s+${SELECTOR_TOKEN})*\\s*$`);
const CSS_PROPERTY = "(?:[a-z]+-[a-z-]+|--[\\w-]+|color|display|position|top|left|right|bottom|width|height|margin|padding|border|background|opacity|transform|transition|font|gap|inset|cursor|overflow|visibility|filter|content)";
const CSS_DECLARATIONS = new RegExp(`^\\s*(?:${CSS_PROPERTY}\\s*:\\s*[^;:]+;?\\s*)+$`);
const NOT_WORDS = /\S*:\/\/\S*|\S*\/\S*|\S+\.(?:webp|png|svg|jpe?g|ogg|mp3|wav|json|mjs|js|css|html|hbs)\b|(?<![\w-])fa-[\w-]+/g;

/* What a screen shows of a literal: markup's tags and their attributes, entities and Handlebars' {{...}} out. */
const shownOf = text => String(text)
    .replace(/<[a-z/!][^<>]*(?:>|$)/gi, " ").replace(/^[^<>]*>/, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ").replace(/\{\{[^}]*\}\}/g, " ");
/* Two or more English words: a space between two letters, two runs of two letters or more, one of them a lower-case
   word of three ("Pick a student" is three words; "x y" and "OK" are none). */
const twoWords = text => /[A-Za-z][^\S\n]+[A-Za-z]/.test(text) && (text.match(/[A-Za-z]{2,}/g) ?? []).length >= 2 && /[a-z]{3,}/.test(text);

/* bridge-guards.mjs's REASON_PATTERNS, as RegExps: the regex literals between `REASON_PATTERNS =` and the statement's end. */
function reasonPatternsOf(lx, text) {
    if (text === undefined) return [];
    const code = lx.blankComments(String(text)), blank = lx.blankLiterals(code);
    const at = blank.search(/\bREASON_PATTERNS\s*=/);
    if (at < 0) return [];
    const end = blank.indexOf(";", at);
    return literalSpans(code, blank).filter(s => s.kind === "regex" && s.start > at && (end < 0 || s.start < end)).map(s => {
        const literal = code.slice(s.start, s.end), close = literal.lastIndexOf("/");
        return new RegExp(literal.slice(1, close), literal.slice(close + 1).replace(/g/g, ""));
    });
}

/* Each call's argument span, `[open, close]`, for a pattern whose match ends at the call's "(". */
function callSpans(lx, blank, re) {
    return [...blank.matchAll(re)].map(m => { const open = m.index + m[0].length - 1; return [open, lx.callArgs(blank, open).close]; });
}

/**
 * T13 (plan, S18-46; report, FAIL from E71): English written into the code of a
 * script that draws UI (UI_FILE) - a string or a template piece whose shown text
 * (shownOf) holds two or more English words (so never a key, which has no
 * space) - that is not a class list, a selector or CSS, nor only a URL, path or icon, and not console
 * text: an argument of a LOG_CALL, or anything in diagnostics.mjs (DB12: its console
 * report, counted apart). Counted apart, not findings: a refusal's reason
 * (REASON_PROPERTY and the guards; the GM's record, the asker told a code), a
 * literal compared with `===`/`!==` or a `case` (a data value, an id), and a
 * literal after `game.i18n.has(` in the same expression (`fallback`: English that
 * stands in only when the key is missing). A template is read a piece at a time,
 * the code of each `${...}` as code. A script that draws no UI is not read
 * (`quiet`): a literal there reaches a screen only through another file, which the
 * screen map (C10) follows and this does not.
 */
export function uiLiterals(bag = {}) {
    const lx = lexerOf(bag, "uiLiterals");
    const S = asMap(bag.scripts);
    const found = [], counts = { files: 0, quiet: 0, literals: 0, diagnostics: 0, log: 0, notText: 0, reasons: 0, compared: 0, fallback: 0 };
    const guardFile = S.get("scripts/bridge-guards.mjs");
    const guards = guardFile === undefined ? [] : [...lx.blankComments(String(guardFile)).matchAll(/^export function (\w+)\s*\(([^)]*)\)/gm)]
        .filter(m => /(?<![\w$])why(?![\w$])/.test(m[2])).map(m => m[1]);
    const closedList = reasonPatternsOf(lx, guardFile);
    const REASON_CALL = new RegExp(`(?<![\\w$.])(?:${["refuse", ...guards].join("|")})\\s*\\(`, "g");
    for (const [file, text] of S) {
        const code = lx.blankComments(String(text ?? "")), blank = lx.blankLiterals(code);
        if (!UI_FILE.test(blank)) { counts.quiet++; continue; }
        counts.files++;
        const logs = callSpans(lx, blank, LOG_CALL), reasons = callSpans(lx, blank, REASON_CALL);
        const inside = (spans, s) => spans.some(([a, b]) => s.start > a && s.end <= b);
        const has = [...blank.matchAll(/\bgame\s*\??\.\s*i18n\s*\??\.\s*has\s*(?:\?\.\s*)?\(/g)].map(m => m.index);
        for (const s of literalSpans(code, blank)) {
            if (s.kind === "regex") continue;
            const raw = literalText(code, s), shown = shownOf(raw);
            if (!twoWords(shown)) continue;
            counts.literals++;
            if (file === "scripts/diagnostics.mjs") { counts.diagnostics++; continue; }
            if (inside(logs, s)) { counts.log++; continue; }
            const before = blank.slice(Math.max(0, s.start - 40), s.start), after = blank.slice(s.end, s.end + 6);
            if (REASON_PROPERTY.test(before) || inside(reasons, s) || closedList.some(p => p.test(raw))) { counts.reasons++; continue; }
            if (/(?:[!=]==?|\bcase)\s*$/.test(before) || /^\s*[!=]==?/.test(after)) { counts.compared++; continue; }
            if ((SELECTOR.test(shown) && /[-_.#[]/.test(shown)) || CSS_DECLARATIONS.test(shown) || !twoWords(shown.replace(NOT_WORDS, " "))) { counts.notText++; continue; }
            if (has.some(h => h < s.start && s.start - h < 200 && !/[;{}]/.test(blank.slice(h, s.start)))) { counts.fallback++; continue; }
            const line = lineOf(code, s.start), words = shown.replace(/\s+/g, " ").trim();
            found.push({ key: `${file}:${line}`, kind: s.kind, file, line,
                what: `${file}:${line}: "${words.length > 60 ? `${words.slice(0, 57)}...` : words}" - English written into a screen's code, not read from lang/ (S18-46; T13)` });
        }
    }
    return { found, read: counts.literals, sources: ["script"], counts };
}

/* T20's helpers: the functions a list or a plural is formatted in, by file - utils.mjs's listOf (Intl.ListFormat) and
   plural (Intl.PluralRules). */
const LOCALE_HELPERS = Object.freeze({ "scripts/utils.mjs": Object.freeze(["listOf", "plural"]) });
const TO_LOCALE = /\.\s*(toLocale(?:Date|Time)?String)\s*(?:\?\.\s*)?\(/g;

/* A function's body in blanked code, `[open, close]` of its braces, or null. */
function bodyOf(lx, blank, name) {
    const at = blank.search(new RegExp(`\\bfunction\\s+${name}\\s*\\(`));
    if (at < 0) return null;
    const open = blank.indexOf("{", lx.callArgs(blank, blank.indexOf("(", at)).close);
    for (let k = open, depth = 0; k >= 0 && k < blank.length; k++) {
        if (blank[k] === "{") depth++;
        else if (blank[k] === "}" && --depth === 0) return [open, k];
    }
    return null;
}

/**
 * T20 (plan, S18-39 and S18-40; report, FAIL from E66): a list joined by
 * `new Intl.ListFormat` outside utils.mjs `listOf`, and a `toLocaleString`,
 * `toLocaleDateString` or `toLocaleTimeString` call outside the helpers - the
 * browser's locale where the call names none (`noLocale`), else the one it names
 * (Foundry's `game.i18n.lang`, `moduleLanguage()`), not one a helper picks (DB35's
 * helper is E66's). Read on blanked code: a call in a comment or a string is none, and
 * `toLocaleUpperCase` is no format. Every other `Intl.*` outside the helpers is
 * counted by its name (`Intl.DateTimeFormat`, `Intl.NumberFormat`, ...), not a
 * finding: the slice names these two.
 */
export function localeCalls(bag = {}) {
    const lx = lexerOf(bag, "localeCalls");
    const found = [], counts = { files: 0, inHelpers: 0, noLocale: 0 };
    for (const [file, text] of asMap(bag.scripts)) {
        counts.files++;
        const code = lx.blankComments(String(text ?? "")), blank = lx.blankLiterals(code);
        const helpers = (LOCALE_HELPERS[file] ?? []).map(name => bodyOf(lx, blank, name)).filter(Boolean);
        const inHelper = at => helpers.some(([a, b]) => at > a && at < b);
        /* The locale the call names itself - its first argument as written - or null for none (the browser's). A lone
           literal blanks to spaces, which callArgs counts as no argument: then the text between the brackets is it. */
        const localeAt = open => {
            if (blank[open] !== "(") return null;
            const { args, close } = lx.callArgs(blank, open);
            const first = args[0] ?? (code.slice(open + 1, close).trim() ? { start: open + 1, end: close } : null);
            return first ? code.slice(first.start, first.end).trim() || null : null;
        };
        const hit = (at, kind, call, locale) => {
            const line = lineOf(code, at);
            if (locale === null) counts.noLocale++;
            found.push({ key: `${file}:${line}`, kind, file, line,
                what: `${file}:${line}: ${call} outside utils.mjs's helpers, in ${locale === null ? "the browser's locale" : `the locale its call names (${locale})`} `
                    + `- not one the module's helpers pick (${kind === "list-format" ? "S18-39" : "S18-40"}; T20)` });
        };
        for (const m of blank.matchAll(/(?<![\w$.])Intl\s*\??\.\s*(\w+)/g)) {
            if (inHelper(m.index)) { counts.inHelpers++; continue; }
            if (m[1] !== "ListFormat") { counts[`Intl.${m[1]}`] = (counts[`Intl.${m[1]}`] ?? 0) + 1; continue; }
            let open = m.index + m[0].length;
            while (/\s/.test(blank[open] ?? "")) open++;
            hit(m.index, "list-format", "new Intl.ListFormat", localeAt(open));
        }
        for (const m of blank.matchAll(TO_LOCALE)) {
            if (inHelper(m.index)) { counts.inHelpers++; continue; }
            hit(m.index, "to-locale", `${m[1]}()`, localeAt(m.index + m[0].length - 1));
        }
    }
    return { found, read: counts.files, sources: ["script"], counts };
}

/* --------------------------------- T27 ------------------------------------- */

/* Where T27's pairs live (E65 C9): the guide's table under "### Pary N1-N<k>", section 12 of docs/text-style.md - the one
   source of the pairs, so a pair is added, changed or confirmed there and nowhere else. */
export const NATURALNESS_GUIDE = "docs/text-style.md";
const PAIRS_HEADING = /^### Pary N1-N(\d+)\s*$/;
const PAIRS_COLUMNS = Object.freeze(["N", "Klucz", "Przed", "Po", "Reguła", "Status"]);
const PAIR_KEY = /^`([A-Za-z][\w-]*(?:\.[\w-]+)+)`$/, PLAN_PHRASING = "plan phrasing";
const PAIR_QUOTE = /^„([\s\S]*\S[\s\S]*)”$/u;
/* E65-18's status with the date the pairs were written (31.10.2026: E65-18 says 30.10, and the orchestrator's decision 62 of
   31.10 has the true date; E65 C10), then the two the owner's reading gives a pair (E65-24): no agent writes either of those. */
/* A verdict may name the owner's page it was given on (E65 fix round, 01.11.2026): the 60 were read on E65-PILOT-R2, the
   pilot's second page, after the first (E65-PILOT-R1) had left them out. */
const PAIR_STATUS = /^(?:written 31\.10 for the owner's pilot, not confirmed|(?:confirmed|changed) in the pilot \d\d\.\d\d\.\d{4}(?: \(E65-PILOT-R[12]\))?)$/;
const pairCells = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());

/**
 * The naturalness pairs of the guide's text (E65 C9, E65-18): `{ pairs, faults }`,
 * each pair `{ id, key, before, after, rule, status, line }` (`key` null for a row
 * whose key cell is "plan phrasing"), each fault one sentence. The table is the
 * first one after the heading "### Pary N1-N<k>", up to its first line that is no
 * table row; its header is PAIRS_COLUMNS, its rows N1, N2, ... in order, each with a
 * key in backticks or "plan phrasing", a before and an after in „...” (a quote inside
 * is the string's own: the cell's first „ and last ” are the table's), a rule and a
 * status of PAIR_STATUS; the heading's k is the number of rows. A row with a key and a
 * before is a pair even when another of its cells is at fault (T27 still reads it);
 * the fault is red in `text` all the same, as a schema's is: the guide is a file E65
 * writes, and a row that silently fell out of the table would never be reported.
 */
export function naturalnessPairs(text) {
    const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
    const at = lines.findIndex(l => PAIRS_HEADING.test(l));
    if (at < 0) return { pairs: [], faults: ["no heading \"### Pary N1-N<k>\" - the pairs have no table to be read from"] };
    const declared = Number(lines[at].match(PAIRS_HEADING)[1]);
    let i = at + 1;
    while (i < lines.length && !lines[i].trimStart().startsWith("|") && !/^#/.test(lines[i])) i++;
    if (!(lines[i] ?? "").trimStart().startsWith("|")) return { pairs: [], faults: [`no table under "${lines[at].trim()}"`] };
    const faults = [], pairs = [], seen = new Map();
    const header = pairCells(lines[i]);
    if (!same(header, [...PAIRS_COLUMNS])) faults.push(`the table's columns are ${header.join(", ")}, not ${PAIRS_COLUMNS.join(", ")}`);
    if (!/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[i + 1] ?? "")) faults.push("the table has no separator row under its header");
    let rows = 0;
    for (let j = i + 2; j < lines.length && lines[j].trimStart().startsWith("|"); j++) {
        rows++;
        const where = `line ${j + 1}`, c = pairCells(lines[j]);
        if (c.length !== PAIRS_COLUMNS.length) { faults.push(`the row at ${where} has ${c.length} cell(s), not ${PAIRS_COLUMNS.length}`); continue; }
        const [id, keyCell, beforeCell, afterCell, rule, status] = c;
        const name = `${id || "a row"} (${where})`;
        if (id !== `N${rows}`) faults.push(`the row at ${where} is numbered ${JSON.stringify(id)}, not N${rows} - the pairs are numbered in order`);
        const key = keyCell === PLAN_PHRASING ? null : keyCell.match(PAIR_KEY)?.[1];
        if (key === undefined) faults.push(`${name}'s key ${JSON.stringify(keyCell)} is neither a key in backticks nor "${PLAN_PHRASING}"`);
        const before = beforeCell.match(PAIR_QUOTE)?.[1], after = afterCell.match(PAIR_QUOTE)?.[1];
        if (before === undefined) faults.push(`${name}'s before ${JSON.stringify(beforeCell)} is not a quote in „...”`);
        if (after === undefined) faults.push(`${name}'s after ${JSON.stringify(afterCell)} is not a quote in „...”`);
        if (!rule) faults.push(`${name} names no rule`);
        if (!PAIR_STATUS.test(status)) faults.push(`${name}'s status ${JSON.stringify(status)} is not "written 31.10 for the owner's pilot, not confirmed", "confirmed in the pilot <dd.mm.yyyy>" or "changed in the pilot <dd.mm.yyyy>", each with or without " (E65-PILOT-R1)" or " (E65-PILOT-R2)" after the date`);
        if (key === undefined || before === undefined) continue;
        const twin = seen.get(`${key} ${before}`);
        if (twin) faults.push(`${name} repeats ${twin}'s key and before`);
        else seen.set(`${key} ${before}`, id);
        pairs.push({ id, key, before, after: after ?? null, rule, status, line: j + 1 });
    }
    if (rows !== declared) faults.push(`the heading names N1-N${declared}, and the table holds ${rows} row(s)`);
    return { pairs, faults };
}

/**
 * T27 (the plan's; report from E65, and it stays one): a naturalness pair's
 * "before" still in pl.json (E65-18). Each pair of the guide's table
 * (`naturalnessPairs` over NATURALNESS_GUIDE in `docs`) is held to the value of its
 * key - the before as written, a substring, case and all - or, for a "plan
 * phrasing" row, to every value; a pair whose before is still there is a finding
 * (keyed by the value's key), with the other keys whose values hold the same words,
 * which the batch that applies the pair meets too (`elsewhere`). A before that is no
 * longer in its key - a later stage changed the string, or the key is gone - is no
 * finding but `gone`, listed apart: the pair stays in the table as a model (the
 * slice's edge case). What is found is counted by status, so the pairs the owner
 * has not read are reported apart (Q-E65-3). The guide's own faults ride along as
 * `faults`, which `text` makes red. `read` is the pairs read: a guide with no table
 * has proved nothing.
 */
export function naturalnessBefore(bag = {}) {
    const counts = { pairs: 0, present: 0, gone: 0, keyGone: 0, elsewhere: 0, notConfirmed: 0, confirmed: 0, changed: 0 };
    const docs = asMap(bag.docs);
    if (!docs.has(NATURALNESS_GUIDE) || bag.pl === undefined) return { found: [], read: 0, gone: [], faults: [], counts };
    const { pairs, faults } = naturalnessPairs(docs.get(NATURALNESS_GUIDE));
    const pl = asMap(bag.pl), values = [...pl].filter(([, v]) => typeof v === "string");
    const found = [], gone = [];
    for (const p of pairs) {
        counts.pairs++;
        const holders = values.filter(([, v]) => v.includes(p.before)).map(([k]) => k);
        const key = p.key ?? holders[0];
        if (key === undefined || !holders.includes(key)) {
            counts.gone++;
            if (p.key !== null && !pl.has(p.key)) counts.keyGone++;
            gone.push({ pair: p.id, key: p.key, what: `${p.id}: "${p.before}" is no longer in ${p.key === null ? "lang/pl.json" : `lang/pl.json ${p.key}${pl.has(p.key) ? "" : " (the key is gone)"}`}`
                + `${holders.length ? `, and stands in ${holders.join(", ")}` : ""} - the pair stays in the table as a model (T27)` });
            continue;
        }
        const also = holders.filter(k => k !== key);
        if (also.length) counts.elsewhere++;
        counts.present++;
        counts[p.status.startsWith("confirmed") ? "confirmed" : p.status.startsWith("changed") ? "changed" : "notConfirmed"]++;
        found.push({ key, kind: `${p.id}-present`, pair: p.id, lang: "pl", status: p.status,
            what: `lang/pl.json ${key}: "${p.before}" - naturalness pair ${p.id} (${p.rule}) is not applied yet`
                + `${also.length ? `; the same words stand in ${also.join(", ")}` : ""} (${p.status}; docs/text-style.md section 12; T27)` });
    }
    return { found, read: counts.pairs, gone, faults, counts };
}

/* --------------------------------- T15 ------------------------------------- */

/* A family's form at the end of a key (the rule of utils.mjs `plural`, which T15 holds the render to). */
const RENDER_FAMILY = /\.(?:zero|one|two|few|many|other)$/;

/**
 * T15 (the plan's, S18-34; report from E65, FAIL from E71): the render's checks (E65 C10, E65-19), over the strings
 * tools/text-render.mjs `renderAll` filled with its fixtures - `render`: `{ ns, fixtures, rows }`, each row `{ key, lang,
 * text, n, form, family }` - against the language files it rendered (`en` with config.mjs's English `prose`, `pl`):
 *   - `brace`: a "{" left in a rendered string that is no placeholder the render has no fixture for (a `{n}` the render
 *     should have filled, a brace the text itself writes);
 *   - `unknown`: a `{name}` left whose name has no fixture value (listed by name in `counts.unknownNames` and `unknown`);
 *   - `key`: "DRPG." in a rendered string (a key printed where its text should stand);
 *   - `family`: a plural family of the files not rendered at every n of `ns` (`.one`/`.other` in English, with `.few` and
 *     `.many` in Polish - one finding a family and language, naming the n missing);
 *   - `unrendered`: a key of the files (a family by its base) with no rendered row at all.
 * Each kind once a key and language (`<kind>-<lang>`). `read` is the rows read: a render with none has proved nothing.
 */
export function renderChecks(bag = {}) {
    const counts = { rows: 0, keys: 0, families: 0, brace: 0, unknown: 0, key: 0, family: 0, unrendered: 0, unknownNames: 0 };
    const render = bag.render;
    if (!render || !Array.isArray(render.rows) || bag.en === undefined || bag.pl === undefined) return { found: [], read: 0, counts, unknown: [] };
    const fixtures = new Set(render.fixtures ?? []), ns = [...(render.ns ?? [])];
    const found = [], seen = new Set(), unknown = new Map();
    const add = (key, kind, lang, what) => {
        if (seen.has(`${key} ${kind} ${lang}`)) return;
        seen.add(`${key} ${kind} ${lang}`);
        counts[kind]++;
        found.push({ key, kind: `${kind}-${lang}`, lang, what: `${lang} ${key}: ${what} (T15)` });
    };
    const rendered = new Map(), atN = new Map();
    for (const r of render.rows) {
        counts.rows++;
        const text = String(r.text ?? ""), lang = r.lang;
        rendered.set(`${lang} ${r.key}`, true);
        if (r.family) { const k = `${lang} ${r.key}`; if (!atN.has(k)) atN.set(k, new Set()); atN.get(k).add(r.n); }
        for (const m of text.matchAll(/\{/g)) {
            const name = text.slice(m.index).match(/^\{(\w+)\}/)?.[1];
            if (name !== undefined && !fixtures.has(name)) {
                if (!unknown.has(name)) unknown.set(name, new Set());
                unknown.get(name).add(`${lang} ${r.key}`);
                add(r.key, "unknown", lang, `{${name}} has no fixture value - the render leaves it as written`);
            } else add(r.key, "brace", lang, `"${text.slice(Math.max(0, m.index - 20), m.index + 20).trim()}" - a brace left after the render${r.n !== null && r.n !== undefined ? ` (n = ${r.n})` : ""}`);
        }
        if (text.includes("DRPG.")) add(r.key, "key", lang, `"${text.slice(0, 60)}" - a key printed where its text should stand`);
    }
    const sources = { en: new Map([...asMap(bag.en), ...asMap(bag.prose)]), pl: asMap(bag.pl) };
    for (const lang of ["en", "pl"]) {
        const bases = new Set();
        for (const [key, v] of sources[lang]) {
            if (typeof v !== "string") continue;
            const base = key.replace(RENDER_FAMILY, "");
            if (base !== key && sources[lang].has(`${base}.other`)) { bases.add(base); continue; }
            counts.keys++;
            if (!rendered.has(`${lang} ${key}`)) add(key, "unrendered", lang, "no rendered string - the render skipped it");
        }
        for (const base of bases) {
            counts.families++;
            counts.keys++;
            if (!rendered.has(`${lang} ${base}`)) { add(base, "unrendered", lang, "the family has no rendered string - the render skipped it"); continue; }
            const missing = ns.filter(n => !atN.get(`${lang} ${base}`)?.has(n));
            if (missing.length) add(base, "family", lang, `the family is not rendered at n = ${missing.join(", ")} (it should be at ${ns.join(", ")})`);
        }
    }
    counts.unknownNames = unknown.size;
    return { found, read: counts.rows, counts, unknown: [...unknown].sort((a, b) => a[0].localeCompare(b[0])).map(([name, where]) => ({ name, where: [...where].sort() })) };
}

/* --------------------------------- T16 ------------------------------------- */

/* The readers tools/text-audience.mjs names that are more than one person at once: the room, the incident's cast, the table. */
const MANY_READERS = Object.freeze(["room", "incident", "everyone"]);
const MANY_WORDS = Object.freeze({ room: "the room", incident: "the incident's cast", everyone: "everyone" });
/* "You" in English (the slice's three and their kin), and the Polish second person singular: the pronouns ty, twój and
   theirs, ci, cię, and a verb's second person (-sz: masz, możesz, widzisz, słyszysz; -łeś, -łaś: zrobiłeś; jesteś), less
   the nouns that only look so. On 31.10 the pattern met 151 distinct words in lang/pl.json and one of them was a noun,
   "klawisz" (4 times); the rest of the set is words of that shape the file may grow (afisz, gulasz, Łukasz, Tomasz).
   "nasz", "wasz" and "mysz" need no entry: the pattern wants two letters before the ending. An imperative of -isać
   ("napisz", 16; "wpisz", 15) is read: it is the second person singular too. One of the bare stem ("Wybierz") is not. */
const EN_YOU = new RegExp(W("you|your|yours|yourself|you['’](?:re|ve|ll|d)"), "iu");
const PL_YOU_WORD = new RegExp(W("ty|ciebie|tobie|tobą|ci|cię|twój|twoja|twoje|twojego|twojej|twojemu|twoim|twoją|twoi|twoich|twoimi|jesteś"), "iu");
const PL_YOU_VERB = /(?<![\p{L}])(\p{L}{2,}(?:esz|isz|ysz|asz|łeś|łaś))(?![\p{L}])/giu;
const PL_NOT_VERB = new Set("klawisz afisz gulasz łukasz tomasz".split(" "));

/**
 * T16 (the plan's, S18-45; report from E65, FAIL from E71 with no allowlist - decision 33 of 31.10): a key the audience
 * map sends to more than one person at once - the room, the incident's audience, the whole table (`audience`, key to its
 * sends, each with `readers`, as tools/text-audience.mjs writes them) - that says "you": in English "you", "your",
 * "you're" and their kin; in Polish a second person singular (PL_YOU_WORD, PL_YOU_VERB). DB19: such a card names the
 * reader by the role, in the third person. A key with one reader (an owner, the GMs, this browser, one named user, the
 * notice history's own) passes; a key whose list is not read (`list`) is counted apart (`maybe`), never judged; a key
 * whose readers depend on a value at run time is judged by every branch (the map lists both). `read`: the keys with a
 * send read. One finding a key and language, `you-en` or `you-pl`.
 */
export function secondPersonToMany(bag = {}) {
    const counts = { keys: 0, many: 0, maybe: 0, single: 0, en: 0, pl: 0 };
    if (bag.audience === undefined || bag.en === undefined || bag.pl === undefined) return { found: [], read: 0, counts };
    const en = new Map([...asMap(bag.en), ...asMap(bag.prose)]), pl = asMap(bag.pl);
    const found = [];
    for (const [key, sends] of asMap(bag.audience)) {
        if (!Array.isArray(sends) || !sends.length) continue;
        counts.keys++;
        const readers = new Set(sends.flatMap(s => (Array.isArray(s?.readers) ? s.readers : [])));
        const many = [...readers].filter(r => MANY_READERS.includes(r));
        if (!many.length) { counts[readers.has("list") ? "maybe" : "single"]++; continue; }
        counts.many++;
        const where = sends.filter(s => s.readers?.some(r => MANY_READERS.includes(r))).map(s => `${s.file ?? "?"}:${s.line ?? "?"}`).slice(0, 3).join(", ");
        const tell = (lang, text, at, len) => {
            counts[lang]++;
            found.push({ key, kind: `you-${lang}`, lang, readers: [...readers].sort(),
                what: `${lang} ${key}: "${quoted(text, at, len)}" - the second person on a card ${many.map(r => MANY_WORDS[r]).join(" and ")} read${many.length === 1 ? "s" : ""} at once`
                    + ` (${where}); DB19 names the reader by the role (T16)` });
        };
        const e = typeof en.get(key) === "string" ? untagged(en.get(key)) : null;
        const m = e === null ? null : EN_YOU.exec(e);
        if (m) tell("en", e, m.index, m[0].length);
        const p = typeof pl.get(key) === "string" ? untagged(pl.get(key)) : null;
        if (p !== null) {
            const w = PL_YOU_WORD.exec(p);
            const v = w ? null : [...p.matchAll(PL_YOU_VERB)].find(x => !PL_NOT_VERB.has(x[1].toLowerCase()));
            const hit = w ?? v;
            if (hit) tell("pl", p, hit.index, hit[0].length);
        }
    }
    return { found, read: counts.keys, counts };
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
 * `fail` null is a report that stays one (T17, T18, T19, T22, T23, T27). T7's part fails
 * from E25, which owns the rule numbers' wording (E65 decision 44, 31.10.2026; set at the fix round, 01.11); the rest
 * of the rules-parity test is E25's and E57's. `reads` is what it needs, `also` what it reads when it is handed it (T6 the
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
    ruleNumberWords: Object.freeze({ test: "T7", mode: "report", fail: "E25", reads: Object.freeze(["lang"]), also: Object.freeze(["prose"]) }),
    monokumaVoice: Object.freeze({ test: "T21", mode: "report", fail: "E71", reads: Object.freeze(["lang", "budgets", "scripts"]), also: Object.freeze(["prose", "docs"]), lexer: true }),
    colonChains: Object.freeze({ test: "T24", mode: "report", fail: "E71", reads: Object.freeze(["lang"]), also: Object.freeze(["prose"]) }),
    loanGender: Object.freeze({ test: "T11", mode: "report", fail: "E71", reads: Object.freeze(["glossary", "lang"]), also: Object.freeze(["docs"]) }),
    loanDeclension: Object.freeze({ test: "T12", mode: "report", fail: "E71", reads: Object.freeze(["glossary", "lang"]), also: Object.freeze(["docs"]) }),
    oxfordComma: Object.freeze({ test: "T17", mode: "report", fail: null, reads: Object.freeze(["lang"]), also: Object.freeze(["prose"]) }),
    telegraph: Object.freeze({ test: "T18", mode: "report", fail: null, reads: Object.freeze(["lang"]), also: Object.freeze(["prose", "glossary", "budgets"]) }),
    contractions: Object.freeze({ test: "T19", mode: "report", fail: null, reads: Object.freeze(["lang"]), also: Object.freeze(["prose", "budgets", "scripts"]), lexer: true }),
    mirror: Object.freeze({ test: "T22", mode: "report", fail: null, reads: Object.freeze(["lang"]), also: Object.freeze(["prose", "budgets", "scripts"]), lexer: true }),
    itemQuotes: Object.freeze({ test: "T23", mode: "report", fail: null, reads: Object.freeze(["lang"]), also: Object.freeze(["prose", "scripts"]), lexer: true }),
    bareLeft: Object.freeze({ test: "T25", mode: "report", fail: "E71", reads: Object.freeze(["lang"]), also: Object.freeze(["prose"]) }),
    uiLiterals: Object.freeze({ test: "T13", mode: "report", fail: "E71", reads: Object.freeze(["scripts"]), lexer: true }),
    localeCalls: Object.freeze({ test: "T20", mode: "report", fail: "E66", reads: Object.freeze(["scripts"]), lexer: true }),
    naturalnessBefore: Object.freeze({ test: "T27", mode: "report", fail: null, reads: Object.freeze(["docs", "lang"]) }),
    renderChecks: Object.freeze({ test: "T15", mode: "report", fail: "E71", reads: Object.freeze(["render", "lang"]), also: Object.freeze(["prose"]) }),
    secondPersonToMany: Object.freeze({ test: "T16", mode: "report", fail: "E71", reads: Object.freeze(["audience", "lang"]), also: Object.freeze(["prose"]) })
});

export const DETECTORS = Object.freeze({ pluralForms, configPlaceholders, pairParity, familyFormats, dashesIn, tableWordProblems, glossaryHits, retiredHits,
    lengthOver, patterns, ruleNumberWords, monokumaVoice, colonChains,
    loanGender, loanDeclension, oxfordComma, telegraph, contractions, mirror, itemQuotes, bareLeft,
    uiLiterals, localeCalls, naturalnessBefore, renderChecks, secondPersonToMany });

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
        flags: ["DRPG.Config.FX.x prose", "DRPG.Fx.a en", "DRPG.Fx.c pl", "DRPG.Fx.d en", "DRPG.Fx.d pl", "docs/fx.md \"A line \u2013 here\" doc", "docs/fx.md \"`a \u2212 1` in cod\" doc",
            "docs/fx.md \"An \u2014 entity\" doc", "scripts/fx-dash.mjs \"<b>\u2212</b>\" script", "scripts/fx-dash.mjs \"Wait \u2013 here\" script", "scripts/fx-dash.mjs \"\u2212\" script",
            "scripts/fx-dash.mjs \"\u22121\" script", "scripts/fx-dash.mjs \"\u2013 here\" script"],
        input: {
            en: { "DRPG.Fx.a": "One \u2013 two", "DRPG.Fx.b": "fine - ascii", "DRPG.Fx.d": "Five &ndash; six" },   // an en dash, as the character and as an entity; a hyphen passes
            pl: { "DRPG.Fx.a": "Raz - dwa", "DRPG.Fx.c": "\u22121 do rzutu", "DRPG.Fx.d": "Rzut &#X02212;1",   // a minus sign; an entity in hex, zeros first
                "DRPG.Fx.e": "&amp;ndash; i &Ndash; to nie kreska" },                            // an escaped ampersand and a name HTML does not know: pass
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
                    "const v = `a ${\"plain\"} b`;",                            // passes
                    "const w = \"&#8211; here\";"                              // a decimal entity in a string: flagged
                ].join("\n")
            },
            docs: { "docs/fx.md": "# Title\nA line \u2013 here\n`a \u2212 1` in code\nPlain - line\nAn &mdash; entity\n" }   // lines 2, 3 and 5 flagged
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
                "DRPG.Fx.x16name": "The OBJECTION button opens the floor.",    // the game's shout, a name: passes
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
    },
    loanGender: {
        /* A glossary of its own: a countable masculine (singular when bare), a feminine and an indeclinable neuter ("Hope",
           DB4 and DB28: the slice's edge; the real glossary names no resource), an indeclinable masculine, and Findings,
           which has no gender and is not read. */
        flags: ["DRPG.Fx.a fx-bullet-before", "DRPG.Fx.c fx-debate-after", "DRPG.Fx.e fx-bullet-which", "DRPG.Fx.g fx-hope-after", "DRPG.Fx.h fx-bullet-before",
            "DRPG.Fx.p fx-hope-after", "docs/handbooks/fx.pl.md:1 fx-trial-before"],
        input: {
            glossary: { entries: [
                { id: "fx-bullet", en: "Truth Bullet", pl: "Truth Bullet", gender: "m", declension: { countable: true, gen: "Truth Bulletu" } },
                { id: "fx-debate", en: "Nonstop Debate", pl: "Nonstop Debate", gender: "f" },
                { id: "fx-hope", en: "Hope", pl: "Hope", gender: "n", declension: { indeclinable: true } },
                { id: "fx-trial", en: "Class Trial", pl: "Class Trial", gender: "m", declension: { indeclinable: true } },
                { id: "fx-findings", en: "Findings", pl: "Findings", gender: null, declension: { indeclinable: true } }
            ] },
            pl: {
                "DRPG.Fx.a": "Nowa Truth Bullet trafia na stół.",                     // a feminine modifier: flagged
                "DRPG.Fx.b": "Nowy Truth Bullet trafia na stół.",                     // passes
                "DRPG.Fx.c": "Nonstop Debate został zamknięty.",                      // a masculine predicate: flagged
                "DRPG.Fx.d": "Nonstop Debate została zamknięta.",                     // passes
                "DRPG.Fx.e": "Wybierz Truth Bullet, która to dowodzi.",               // "która" after its comma: flagged
                "DRPG.Fx.f": "Twoje Hope zostało wydane.",                            // neuter both: passes
                "DRPG.Fx.g": "Hope został wydany.",                                   // flagged
                "DRPG.Fx.h": "Twoje Truth Bullet jest gotowe.",                       // a bare countable is singular: "twoje" flagged
                "DRPG.Fx.i": "Wszystkie twoje Nonstop Debate były krótkie.",          // an indeclinable may be plural: passes
                "DRPG.Fx.j": "Truth Bullet przebił Nonstop Debate, która się skończyła.",   // two genders, each its own words: passes
                "DRPG.Fx.k": "Class Trial toczy się jako otwarta dyskusja.",          // the predicate is "toczy": passes
                "DRPG.Fx.l": "Lista Findings została zamknięta.",                     // no gender: passes
                "DRPG.Fx.m": "W Class Trial wygrała Celestia.",                       // after a preposition, not the subject: passes
                "DRPG.Fx.n": "Nowe Hope.",                                            // passes
                "DRPG.Fx.o": "Nonstop Debate nie została zamknięta.",                 // "nie" passed over: passes
                "DRPG.Fx.p": "Hope nie jest wydany.",                                 // "nie jest" passed over: flagged
                "DRPG.Fx.q": "Class Trial zaczyna się."                               // "zaczyna" is a verb, no participle: passes
            },
            docs: {
                "docs/handbooks/fx.pl.md": "**Nowa** Class Trial zaczyna się.",       // the markup blanked: flagged
                "docs/handbooks/fx.en.md": "Nowa Class Trial"                         // not a Polish handbook: not read
            }
        }
    },
    loanDeclension: {
        flags: ["DRPG.Fx.a fx-trial-ending", "DRPG.Fx.c fx-word-ending", "DRPG.Fx.d fx-bullet-bare", "DRPG.Fx.g fx-bullet-bare", "DRPG.Fx.i fx-gm-bare",
            "DRPG.Fx.k fx-burst-bare", "docs/handbooks/fx.pl.md:1 fx-trial-ending"],
        input: {
            glossary: { entries: [
                { id: "fx-trial", en: "Class Trial", pl: "Class Trial", gender: "m", declension: { indeclinable: true } },
                { id: "fx-word", en: "safeword", pl: "safeword", gender: "n", declension: { indeclinable: true } },
                { id: "fx-bullet", en: "Truth Bullet", pl: "Truth Bullet", gender: "m", declension: { countable: true, gen: "Truth Bulletu" } },
                { id: "fx-burst", en: "Burst", pl: "Burst", gender: null, declension: { instr: "Burstem" } },
                { id: "fx-gm", en: "GM", pl: "GM", gender: null, declension: { countable: true, gen: "GM-a" } },
                { id: "fx-plain", en: "Monokuma", pl: "Monokuma", gender: "m" }
            ] },
            pl: {
                "DRPG.Fx.a": "W trakcie Class Trialu nie wolno.",                     // flagged
                "DRPG.Fx.b": "W trakcie Class Trial nie wolno.",                      // passes
                "DRPG.Fx.c": "Ktoś użył safeword'a.",                                 // an apostrophe before the ending: flagged
                "DRPG.Fx.d": "Dla Truth Bullet nie ma miejsca.",                      // "dla" takes the genitive: flagged
                "DRPG.Fx.e": "Dla Truth Bulletu jest miejsce.",                       // passes
                "DRPG.Fx.f": "Wierzysz w Truth Bullet.",                              // "w" with an accusative: passes
                "DRPG.Fx.g": "Do twojego Truth Bullet dołącza notatka.",              // a modifier between: flagged
                "DRPG.Fx.h": "Pisze do GM-a.",                                        // passes
                "DRPG.Fx.i": "Pisze do GM.",                                          // flagged
                "DRPG.Fx.j": "Pula, do której GM przypisał ucznia.",                  // "której" opens a clause: passes
                "DRPG.Fx.k": "Wygrywa z Burst.",                                      // the instrumental Burst lists: flagged
                "DRPG.Fx.l": "Wygrywa z Burstem.",                                    // passes
                "DRPG.Fx.m": "Bez Monokumy."                                          // no declension in the entry: not read
            },
            docs: { "docs/handbooks/fx.pl.md": "Po Class Trialem." }                  // flagged
        }
    },
    oxfordComma: {
        flags: ["DRPG.Config.FX.p en", "DRPG.Fx.a en", "DRPG.Fx.a pl"],
        input: {
            en: {
                "DRPG.Fx.a": "Spend Health, Sanity and Hope.",                        // flagged
                "DRPG.Fx.b": "Spend Health, Sanity, and Hope.",                       // passes
                "DRPG.Fx.c": "Spend Health and Hope.",                                // two items: passes
                "DRPG.Fx.d": "If you win, you gain Hope and Despair.",                // a clause's comma: passes
                "DRPG.Fx.e": "Whoever builds it sees it, ticked or not.",             // "or not": passes
                "DRPG.Fx.f": "Once it ends, it closes and locks."                     // a subject after the comma: passes
            },
            prose: { "DRPG.Config.FX.p": "Windows, buttons or the chat." },          // flagged
            pl: {
                "DRPG.Fx.a": "Wydaj Health, Sanity, i Hope.",                         // flagged
                "DRPG.Fx.b": "Wydaj Health, Sanity i Hope.",                          // passes
                "DRPG.Fx.c": "Weź kartę, którą chcesz, i zagraj."                     // the comma closes a subordinate clause: passes
            }
        }
    },
    telegraph: {
        flags: ["DRPG.Fx.a en-verbless", "DRPG.Fx.a pl-verbless", "DRPG.Fx.d en-article"],
        input: {
            glossary: { entries: [{ id: "fx-bullet", en: "Truth Bullet", pl: "Truth Bullet", gender: "m", declension: { countable: true, gen: "Truth Bulletu" } }] },
            budgets: { surfaces: {}, rules: [], allow: [{ key: "DRPG.Fx.allowed", rule: "X6", why: "a fixture's exception", until: "E01" }] },
            en: {
                "DRPG.Fx.a": "Projects updated. {n} deleted.",                        // flagged
                "DRPG.Fx.b": "The project is saved. {n} were deleted.",               // passes
                "DRPG.Fx.c": "Room sealed.",                                          // one sentence: passes
                "DRPG.Fx.d": "Truth Bullet analyzed.",                                // no article before a countable noun: flagged
                "DRPG.Fx.e": "A Truth Bullet is analyzed.",                           // passes
                "DRPG.Fx.f": "Truth Bullet",                                          // a label, no sentence: passes
                "DRPG.Fx.g": "e.g. Mud on the windowsill",                            // an abbreviation ends no sentence: passes
                "DRPG.Fx.h": "You listen. Then nothing.",                             // a pronoun and its verb: passes
                "DRPG.Fx.i": "Loading... a moment.",                                  // a lower-case word goes on the sentence: passes
                "DRPG.Fx.j": "Truth Bullet is analyzed.",                             // a verb: passes
                "DRPG.Fx.k": "A Truth Bullet analyzed.",                              // the noun does not open it: passes
                "DRPG.Fx.allowed": "Nothing readied. Bare hands."                     // an allow row for X6: passes, counted
            },
            pl: {
                "DRPG.Fx.a": "Motive ogłoszony. Jedna pora dnia na zegarze.",         // flagged
                "DRPG.Fx.b": "Motive został ogłoszony. Zostaje jedna pora dnia.",     // passes
                "DRPG.Fx.c": "Usunięto {n}. Projekty zapisane.",                      // an impersonal "-to" is a verb: passes
                "DRPG.Fx.g": "np. Kuchnia"                                            // passes
            }
        }
    },
    contractions: {
        flags: ["DRPG.Config.FX.rule rule", "DRPG.Fx.c prohibition", "DRPG.Fx.d safety", "DRPG.Fx.toast.b prohibition", "DRPG.Safeword.x safety"],
        input: {
            budgets: {
                surfaces: { "config-description": { target: 30, limit: 45, what: "a rule", fail: null }, toast: { target: 20, limit: 30, what: "a toast", fail: null } },
                rules: [{ surface: "config-description", keys: "^DRPG\\.Config\\." }, { surface: "toast", keys: "^DRPG\\.Fx\\.toast\\." }],
                allow: []
            },
            en: {
                "DRPG.Fx.toast.a": "You don't have enough Sanity.",                   // a short message: passes, counted
                "DRPG.Fx.toast.b": "You can't move now.",                             // a prohibition: flagged
                "DRPG.Fx.c": "Don't say the word.",                                   // flagged
                "DRPG.Safeword.x": "It's fine to stop.",                              // a safety text by its key: flagged
                "DRPG.Fx.d": "If you're unsure, say the safeword.",                   // a safety text by its word: flagged
                "DRPG.Fx.e": "Monokuma's turn.",                                      // a possessive: passes
                "DRPG.Fx.f": "You do not have enough Hope.",                          // a full form: passes, counted
                "DRPG.Fx.g": "We're done here."                                       // a contraction in no rule or safety text: passes
            },
            prose: {
                "DRPG.Config.FX.rule": "You'll lose one Hope.",                       // a rule: flagged
                "DRPG.Config.FX.ok": "You will lose one Hope.",                       // passes
                "DRPG.Config.FX.own": "The student's turn ends."                      // a possessive in a rule: passes
            },
            pl: { "DRPG.Fx.c": "Nie mów tego słowa." }                               // Polish: not read
        },
        /* The screen map's marks (E65 C10): a short message on a screen that states a rule is a rule text; a mark on a key
           with no contraction adds nothing. */
        also: [{ input: { marks: { "DRPG.Fx.toast.a": "rule", "DRPG.Fx.f": "safety", "DRPG.Fx.g": "safety" } }, add: ["DRPG.Fx.toast.a rule", "DRPG.Fx.g safety"],
            counts: { marked: 3, byMark: 2 } }]
    },
    mirror: {
        flags: ["DRPG.Config.FX.p sentences", "DRPG.Fx.b sentences", "DRPG.Fx.c skeleton"],
        input: {
            en: {
                "DRPG.Fx.a": "The room is sealed. Nobody enters.",                    // passes
                "DRPG.Fx.b": "The room is sealed. Nobody enters.",                    // two sentences against one: flagged
                "DRPG.Fx.c": "Spend Hope: once a day.",                               // a colon against none: flagged
                "DRPG.Fx.d": "You see that it is gone.",                              // a Polish comma before "że": passes
                "DRPG.Fx.e": "“{item}” is used up.",                                  // each language's quotes: passes
                "DRPG.Fx.f": "e.g. Kitchen",                                          // passes
                "DRPG.Fx.g.one": "{n} action left",                                   // a family's form against its own: passes
                "DRPG.Fx.h": "At 12:30 the bell rings.",                              // a time's colon: passes
                "DRPG.Fx.only": "No twin."                                            // no Polish: not read
            },
            prose: { "DRPG.Config.FX.p": "One sentence." },                          // flagged
            pl: {
                "DRPG.Fx.a": "Pokój jest zamknięty. Nikt nie wchodzi.",
                "DRPG.Fx.b": "Pokój jest zamknięty, nikt nie wchodzi.",
                "DRPG.Fx.c": "Wydaj Hope raz dziennie.",
                "DRPG.Fx.d": "Widzisz, że zniknęło.",
                "DRPG.Fx.e": "„{item}” się zużył.",
                "DRPG.Fx.f": "np. Kuchnia",
                "DRPG.Fx.g.one": "Została {n} akcja",
                "DRPG.Fx.g.few": "Zostały {n} akcje",                                 // no English twin: not read
                "DRPG.Fx.h": "O wpół do pierwszej dzwoni dzwonek.",              // the time in words: only the English has a colon
                "DRPG.Config.FX.p": "Jedno zdanie. Drugie zdanie."
            }
        }
    },
    itemQuotes: {
        flags: ["DRPG.Fx.b en", "DRPG.Fx.b pl", "DRPG.Fx.c en"],
        input: {
            en: {
                "DRPG.Fx.a": "“{item}” is used up.",                                  // passes
                "DRPG.Fx.b": "{item} is used up.",                                    // flagged
                "DRPG.Fx.c": "\"{item}\" is used up.",                                // straight quotes: flagged
                "DRPG.Fx.d": "Use {item}",                                            // the code quotes it: passes, counted
                "DRPG.Fx.e": "{items} are gone."                                      // another placeholder: passes
            },
            pl: {
                "DRPG.Fx.a": "„{item}” się zużył.",                                   // passes
                "DRPG.Fx.b": "“{item}” się zużył.",                                   // the English quotes: flagged
                "DRPG.Fx.d": "Użyj: {item}"                                           // the code quotes it: passes, counted
            },
            scripts: {
                "scripts/fx-item.mjs": [
                    "game.i18n.format(\"DRPG.Fx.d\", { item: `“${item.name}”` });",
                    "game.i18n.format(\"DRPG.Fx.b\", { item: item.name });",
                    "// game.i18n.format(\"DRPG.Fx.b\", { item: \"“x”\" });"
                ].join("\n")
            }
        }
    },
    bareLeft: {
        flags: ["DRPG.Config.FX.p en", "DRPG.Fx.a en", "DRPG.Fx.a pl", "DRPG.Fx.d en", "DRPG.Fx.f pl"],
        input: {
            en: {
                "DRPG.Fx.a": "That cost an action - {left} left.",                    // flagged
                "DRPG.Fx.b": "Left: {left}",                                          // a facts row: passes, counted
                "DRPG.Fx.c.one": "{n} action left",                                   // a family's form: passes, counted
                "DRPG.Fx.d": "Actions left: {n}. Choose one.",                        // "left:" in running text: flagged
                "DRPG.Fx.e": "{n} search tokens left"                                 // a noun between: not read
            },
            prose: { "DRPG.Config.FX.p": "Roll again; {n} left." },                  // flagged
            pl: {
                "DRPG.Fx.a": "To kosztowało akcję - zostało {left}.",                 // flagged
                "DRPG.Fx.b": "Zostało: {left}",                                       // a facts row: passes
                "DRPG.Fx.c.few": "Zostały {n} akcje",                                 // a family's form: passes, counted
                "DRPG.Fx.f": "Pozostało {n} pór dnia."                                // flagged
            }
        }
    },
    uiLiterals: {
        flags: ["scripts/fx-text.mjs:1 string", "scripts/fx-ui.mjs:1 string", "scripts/fx-ui.mjs:2 template", "scripts/fx-ui.mjs:15 template",
            "scripts/fx-ui.mjs:18 string", "scripts/fx-ui.mjs:21 string"],
        input: {
            scripts: {
                "scripts/fx-ui.mjs": [
                    "const d = new foundry.applications.api.DialogV2({ window: { title: \"Pick a student\" } });",     // flagged
                    "ui.notifications.warn(`The vote is ${state} now`);",                                             // a template piece: flagged
                    "log(\"Could not draw the board\", err);",                                                        // console text: passes
                    "env.log.error(\"The GM store could not save\", err);",                                           // a logger's: passes
                    "throw new Error(\"no such room here\");",                                                        // an Error's message: passes
                    "const k = game.i18n.localize(\"DRPG.Fx.title\");",                                               // a key: passes
                    "el.className = \"drpg-card drpg-glass is-open\";",                                               // a class list: passes
                    "const q = root.querySelector(\".drpg-sheet .window-content > header\");",                        // a selector: passes
                    "const icon = \"modules/drpg/icons/a-b.svg fa-solid fa-dice\";",                                  // a path and an icon: passes
                    "if (mode === \"two words\") return;",                                                            // compared, a data value: passes
                    "const label = game.i18n.has(key) ? game.i18n.localize(key) : \"Open the vault\";",               // a fallback: counted apart
                    "return { refused: \"the body is not here\" };",                                                  // a refusal's reason: passes
                    "const guards = [gmOnly(\"only a GM opens this\")];",                                             // a guard's reason: passes
                    "// ui.notifications.info(\"Commented out text here\");",                                         // a comment: passes
                    "el.innerHTML = `<div class=\"drpg-x\" title=\"a b c\">{{name}} rolled the dice</div>`;",        // markup's shown text: flagged
                    "el.innerHTML = `<i class=\"fa-solid fa-dice\"></i> <span>{{count}}</span>`;",                    // markup only: passes
                    "const css = \"border: 1px solid var(--drpg-ink); font-weight: bold\";",                       // CSS: passes
                    "const msg = \"the floor is closed\";",                                                           // lower case, no hyphen - text: flagged
                    "const re = /two words here/;",                                                                   // a regex: passes
                    "const why = \"that roll is too old to settle anything\";",                                       // the closed list takes it whole: passes
                    "const near = \"that roll is too old to settle anything else\";",                                  // the list takes it not whole: flagged
                    "warn(\"A warning only the console reads\");",                                                    // console text: passes
                    "el.innerHTML = `<p>{{#if open}}{{name}} {{else}}{{who}}</p>`;"                                      // Handlebars only: passes
                ].join("\n"),
                "scripts/fx-text.mjs": "el.textContent = \"Nobody is here yet\";",                                     // textContent makes a UI file: flagged
                "scripts/fx-data.mjs": "export const LINE = \"An English line no screen of this file draws\";",        // no UI in the file: not read
                "scripts/diagnostics.mjs": "ui.notifications.info(\"The console report says so\");",                  // DB12's console: counted apart
                "scripts/bridge-guards.mjs": [
                    "export function gmOnly(why) { return why; }",
                    "export const REASON_PATTERNS = Object.freeze([[\"tooOld\", /^that roll is too old to settle anything$/]]);"
                ].join("\n")
            }
        }
    },
    localeCalls: {
        flags: ["scripts/fx-a.mjs:1 list-format", "scripts/fx-a.mjs:2 to-locale", "scripts/fx-a.mjs:7 to-locale", "scripts/utils.mjs:8 to-locale"],
        input: {
            scripts: {
                "scripts/utils.mjs": [
                    "export function listOf(items = [], { type = \"conjunction\" } = {}) {",
                    "    return new Intl.ListFormat(game.i18n?.lang || \"en\", { style: \"long\", type }).format(items);", // the helper: passes
                    "}",
                    "export function plural(key, data = {}) {",
                    "    const form = new Intl.PluralRules(\"en\").select(data.n);",                                  // the helper: passes
                    "    return `${key}.${form}`;",
                    "}",
                    "export const when = d => d.toLocaleDateString();"                                                // outside the helpers: flagged
                ].join("\n"),
                "scripts/fx-a.mjs": [
                    "const names = new Intl.ListFormat(\"en\").format(list);",                                         // flagged
                    "const t = new Date().toLocaleTimeString();",                                                     // flagged
                    "// const old = n.toLocaleString();",                                                             // a comment: passes
                    "const s = \"x.toLocaleString() in a string\";",                                                  // a string: passes
                    "const n = new Intl.NumberFormat(\"pl\").format(3);",                                             // another Intl: counted
                    "const u = name.toLocaleUpperCase();",                                                            // no format: passes
                    "const v = (5).toLocaleString (\"pl\");"                                                          // a space before "(": flagged
                ].join("\n")
            }
        }
    },
    naturalnessBefore: {
        flags: ["DRPG.Fx.here N1-present", "DRPG.Fx.road N2-present"],
        gone: ["N3", "N4", "N5", "N6"],
        counts: { pairs: 6, present: 2, gone: 4, keyGone: 2, elsewhere: 1, notConfirmed: 1, confirmed: 1, changed: 0 },
        faults: ["N6 (line 18)'s status \"confirmed\" is not \"written 31.10 for the owner's pilot, not confirmed\", \"confirmed in the pilot <dd.mm.yyyy>\" or \"changed in the pilot <dd.mm.yyyy>\", each with or without \" (E65-PILOT-R1)\" or \" (E65-PILOT-R2)\" after the date"],
        input: {
            docs: {
                "docs/text-style.md": [
                    "## 12. Fx",
                    "",
                    "| N | Klucz | Przed | Po | Reguła | Status |",                                                    // a table before the heading: not read
                    "| --- | --- | --- | --- | --- | --- |",
                    "| N1 | `DRPG.Fx.decoy` | „Nic tu nie ma.” | „Pusto.” | X6 | written 31.10 for the owner's pilot, not confirmed |",
                    "",
                    "### Pary N1-N6",
                    "",
                    "Akapit przed tabelą.",
                    "",
                    "| N | Klucz | Przed | Po | Reguła | Status |",
                    "| --- | --- | --- | --- | --- | --- |",
                    "| N1 | `DRPG.Fx.here` | „Jesteś w: {room}.” | „Jesteś w pokoju {room}.” | X12 | written 31.10 for the owner's pilot, not confirmed |", // in its key, and in DRPG.Fx.twin
                    "| N2 | plan phrasing | „w drodze do: {to}” | „w drodze do pokoju {to}” | X12 | confirmed in the pilot 01.11.2026 |",            // in DRPG.Fx.road
                    "| N3 | `DRPG.Fx.changed` | „Nic nie zostało wydane.” | „Nie tracisz akcji.” | X1 | written 31.10 for the owner's pilot, not confirmed |", // gone: the value changed, the words in another key
                    "| N4 | `DRPG.Fx.removed` | „Brak akcji.” | „Nie masz już akcji.” | X6 | written 31.10 for the owner's pilot, not confirmed |",     // gone: the key is gone
                    "| N5 | `DRPG.Fx.case` | „widać, jak” | „w pokoju widać, jak” | X12 | changed in the pilot 01.11.2026 |",                       // gone: another case
                    "| N6 | `DRPG.Fx.dated` | „Bez daty.” | „Z datą.” | X6 | confirmed |",                                                           // a fault: no date; gone: no key
                    "",
                    "| N7 | `DRPG.Fx.after` | „Za tabelą.” | „Po tabeli.” | X6 | written 31.10 for the owner's pilot, not confirmed |"                 // after the table: not read
                ].join("\n")
            },
            pl: {
                "DRPG.Fx.here": "Jesteś w: {room}. Który pokój?", "DRPG.Fx.twin": "Jesteś w: {room}.",
                "DRPG.Fx.road": "Jesteś w drodze do: {to}.", "DRPG.Fx.changed": "Nie tracisz akcji.", "DRPG.Fx.moved": "Nic nie zostało wydane.", "DRPG.Fx.case": "Widać, jak ktoś grzebie.",
                "DRPG.Fx.decoy": "Nic tu nie ma.", "DRPG.Fx.after": "Za tabelą."
            }
        }
    },
    renderChecks: {
        flags: ["DRPG.Fx.left brace-pl", "DRPG.Fx.code brace-en", "DRPG.Fx.code brace-pl", "DRPG.Fx.shown key-en", "DRPG.Fx.figs family-pl", "DRPG.Fx.odd unknown-en", "DRPG.Fx.skipped unrendered-pl"],
        counts: { rows: 15, keys: 12, families: 2, brace: 3, unknown: 1, key: 1, family: 1, unrendered: 1, unknownNames: 1 },
        input: {
            en: {
                "DRPG.Fx.left": "{n} left", "DRPG.Fx.shown": "Shown", "DRPG.Fx.odd": "{zzz} here", "DRPG.Fx.code": "runTests({ confirmed })",
                "DRPG.Fx.figs.one": "{n} fig", "DRPG.Fx.figs.other": "{n} figs"
            },
            prose: { "DRPG.Config.FX.a.label": "Search" },
            pl: {
                "DRPG.Fx.left": "Zostało: {n}", "DRPG.Fx.shown": "Pokazane", "DRPG.Fx.odd": "{zzz} tutaj", "DRPG.Fx.skipped": "Pominięte", "DRPG.Fx.code": "runTests({ confirmed })",
                "DRPG.Fx.figs.one": "{n} figa", "DRPG.Fx.figs.few": "{n} figi", "DRPG.Fx.figs.many": "{n} fig", "DRPG.Fx.figs.other": "{n} figi"
            },
            render: {
                ns: [1, 22], fixtures: ["n", "who"],
                rows: [
                    { key: "DRPG.Fx.left", lang: "en", text: "1 left", n: 1, family: false },                 // filled: passes
                    { key: "DRPG.Fx.left", lang: "pl", text: "Zostało: {n}", n: 22, family: false },          // a {n} the render should have filled: brace
                    { key: "DRPG.Fx.left", lang: "pl", text: "Zostało: {n}", n: 1, family: false },           // the same again: one finding a key and language
                    { key: "DRPG.Fx.shown", lang: "en", text: "DRPG.Fx.shown", n: null, family: false },       // a key where its text should stand
                    { key: "DRPG.Fx.shown", lang: "pl", text: "Pokazane", n: null, family: false },
                    { key: "DRPG.Fx.odd", lang: "en", text: "{zzz} here", n: null, family: false },           // no fixture for zzz: unknown, not a brace
                    { key: "DRPG.Fx.odd", lang: "pl", text: "coś tutaj", n: null, family: false },
                    { key: "DRPG.Fx.code", lang: "en", text: "runTests({ confirmed })", n: null, family: false }, // the text's own brace: brace
                    { key: "DRPG.Fx.code", lang: "pl", text: "runTests({ confirmed })", n: null, family: false }, // in each language: once each
                    { key: "DRPG.Config.FX.a.label", lang: "en", text: "Search", n: null, family: false },    // prose: rendered, passes
                    { key: "DRPG.Fx.figs", lang: "en", text: "1 fig", n: 1, form: "one", family: true },
                    { key: "DRPG.Fx.figs", lang: "en", text: "22 figs", n: 22, form: "other", family: true }, // the whole family in English: passes
                    { key: "DRPG.Fx.figs", lang: "pl", text: "1 figa", n: 1, form: "one", family: true },     // no n = 22 in Polish: family
                    { key: "DRPG.Fx.figs", lang: "pl", text: "22 figi", n: 22, family: false },               // a plain string is not the family's form
                    { key: "DRPG.Fx.skipped", lang: "en", text: "Skipped", n: null, family: false }            // rendered in English only: unrendered in pl
                ]
            }
        }
    },
    secondPersonToMany: {
        flags: ["DRPG.Fx.room you-en", "DRPG.Fx.room you-pl", "DRPG.Fx.flag you-en", "DRPG.Fx.flag you-pl", "DRPG.Fx.cast you-pl", "DRPG.Config.FX.call you-en"],
        counts: { keys: 10, many: 6, maybe: 1, single: 3, en: 3, pl: 3 },
        input: {
            audience: {
                "DRPG.Fx.room": [{ readers: ["gms", "room"], file: "scripts/fx.mjs", line: 1 }],             // the room: flagged in both
                "DRPG.Fx.owner": [{ readers: ["owner"], copy: "gms" }],                                     // one person, the GM's copy beside: passes
                "DRPG.Fx.flag": [{ readers: ["owner"] }, { readers: ["everyone"], flag: true }],           // one send of two reads to the table: flagged
                "DRPG.Fx.toast": [{ readers: ["browser"] }],                                                 // a notification: this browser, passes
                "DRPG.Fx.list": [{ readers: ["list"] }],                                                     // a list not read: counted, not judged
                "DRPG.Fx.third": [{ readers: ["incident"] }],                                                // the role in the third person: passes
                "DRPG.Fx.cast": [{ readers: ["gms", "incident"] }],                                         // "ci" in Polish only
                "DRPG.Fx.nasz": [{ readers: ["room"] }],                                                     // "klawisz" is no verb: passes
                "DRPG.Fx.own": [{ readers: ["own"] }],                                                       // the notice history's own: passes
                "DRPG.Fx.unsent": [],                                                                        // no send read: not a key of the map
                "DRPG.Config.FX.call": [{ readers: ["everyone"] }]                                           // config prose: read in English
            },
            en: {
                "DRPG.Fx.room": "You hear a scream.", "DRPG.Fx.owner": "You found it.", "DRPG.Fx.flag": "<p>Your turn.</p>",
                "DRPG.Fx.toast": "You can't do that now.", "DRPG.Fx.list": "You were told.", "DRPG.Fx.third": "{victim} falls; the killer stands.",
                "DRPG.Fx.cast": "{n} actions left for the killer.", "DRPG.Fx.nasz": "Our key.", "DRPG.Fx.own": "You read this before.", "DRPG.Fx.unsent": "You never see this.", "DRPG.Fx.youth": "Youth."
            },
            prose: { "DRPG.Config.FX.call": "You lose one Hope." },
            pl: {
                "DRPG.Fx.room": "Słyszysz krzyk.", "DRPG.Fx.owner": "Znajdujesz to.", "DRPG.Fx.flag": "Twoja kolej.", "DRPG.Fx.toast": "Nie możesz teraz.",
                "DRPG.Fx.list": "Powiedziano ci.", "DRPG.Fx.third": "{victim} pada; zabójca stoi.", "DRPG.Fx.cast": "Zostały ci {n} akcje.", "DRPG.Fx.nasz": "Nasz klawisz.",
                "DRPG.Fx.own": "Czytałeś to.", "DRPG.Config.FX.call": "Gracz traci jeden Hope."
            }
        }
    }
});

/**
 * naturalnessPairs on rows at fault (E65 C9): the faults it names, in order, and the
 * pairs it still reads, off three texts - one table with ten faults (C10: a status of the date before decision 62), one with no
 * heading, one whose header is not the table's and has no separator row (its one
 * row taken for that row, so the table holds none). selfCheck holds the parser to it, as it holds the two schemas to theirs.
 */
export const NATURALNESS_TABLE_FIXTURE = Object.freeze({
    texts: Object.freeze([
        [
            "### Pary N1-N4",
            "| N | Klucz | Przed | Po | Reguła | Status |",
            "| --- | --- | --- | --- | --- | --- |",
            "| N1 | `DRPG.Fx.a` | „„{item}” się zużył.” | „„{item}” jest zużyty.” | PL-g | written 31.10 for the owner's pilot, not confirmed |", // a quote inside: whole
            "| N3 | `DRPG.Fx.b` | „Brak akcji.” | „Nie masz akcji.” | X6 | written 31.10 for the owner's pilot, not confirmed |",            // numbered out of order
            "| N3 | notakey | „Brak.” | „Nic.” | X6 | written 31.10 for the owner's pilot, not confirmed |",                                    // no key: not a pair
            "| N4 | `DRPG.Fx.c` | „Brak.” | „Nic.” | X6 |",                                                                                // five cells
            "| N5 | `DRPG.Fx.d` | Brak. | „” |  | confirmed |",                                                                              // no quote, empty after, no rule, a status with no date
            "| N6 | `DRPG.Fx.a` | „„{item}” się zużył.” | „Inaczej.” | PL-g | confirmed in the pilot 01.11.2026 (E65-PILOT-R2) |",              // N1's key and before again; a verdict with its page
            "| N7 | `DRPG.Fx.f` | „Brak.” | „Nic.” | X6 | written 30.10 for the owner's pilot, not confirmed |"                                     // the date before C10's decision 62
        ].join("\n"),
        "## 12. Bez tabeli\n\n| N | Klucz | Przed | Po | Reguła | Status |",
        "### Pary N1-N1\n\n| N | Klucz | Przed | Po | Status |\n| N1 | `DRPG.Fx.e` | „Brak.” | „Nic.” | X6 | written 31.10 for the owner's pilot, not confirmed |"
    ]),
    want: Object.freeze([
        {
            pairs: ["N1 DRPG.Fx.a", "N3 DRPG.Fx.b", "N6 DRPG.Fx.a", "N7 DRPG.Fx.f"],
            faults: [
                "the row at line 5 is numbered \"N3\", not N2 - the pairs are numbered in order",
                "N3 (line 6)'s key \"notakey\" is neither a key in backticks nor \"plan phrasing\"",
                "the row at line 7 has 5 cell(s), not 6",
                "N5 (line 8)'s before \"Brak.\" is not a quote in „...”",
                "N5 (line 8)'s after \"„”\" is not a quote in „...”",
                "N5 (line 8) names no rule",
                "N5 (line 8)'s status \"confirmed\" is not \"written 31.10 for the owner's pilot, not confirmed\", \"confirmed in the pilot <dd.mm.yyyy>\" or \"changed in the pilot <dd.mm.yyyy>\", each with or without \" (E65-PILOT-R1)\" or \" (E65-PILOT-R2)\" after the date",
                "N6 (line 9) repeats N1's key and before",
                "N7 (line 10)'s status \"written 30.10 for the owner's pilot, not confirmed\" is not \"written 31.10 for the owner's pilot, not confirmed\", \"confirmed in the pilot <dd.mm.yyyy>\" or \"changed in the pilot <dd.mm.yyyy>\", each with or without \" (E65-PILOT-R1)\" or \" (E65-PILOT-R2)\" after the date",
                "the heading names N1-N4, and the table holds 7 row(s)"
            ]
        },
        { pairs: [], faults: ["no heading \"### Pary N1-N<k>\" - the pairs have no table to be read from"] },
        { pairs: [], faults: ["the table's columns are N, Klucz, Przed, Po, Status, not N, Klucz, Przed, Po, Reguła, Status", "the table has no separator row under its header",
            "the heading names N1-N1, and the table holds 0 row(s)"] }
    ])
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
            { id: "fx-ok", en: "Remnant", pl: "Remnant", gender: "m", inflection: null, declension: { countable: true, gen: "Remnantu" }, stage: "E01", source: ["DB15"],
                forbidden: { en: { variants: ["trace"], scope: ["ui"] }, pl: { variants: [{ stem: "ślad", endings: ["", "u"] }], scope: ["ui", "handbooks"] } } },
            { id: "fx-no-stage", en: "A", pl: "A", gender: null, inflection: null, source: ["DB1"],
                forbidden: { en: { variants: [], scope: ["ui"] }, pl: { variants: [], scope: ["ui"] } } },
            { id: "fx-e99", en: "B", pl: "B", gender: null, inflection: null, stage: "E99", source: ["DB2"],
                forbidden: { en: { variants: [], scope: ["ui"] }, pl: { variants: [], scope: ["ui"] } } },
            { id: "fx-ok", en: "C", pl: "C", gender: "x", inflection: null, stage: "E01", source: ["DB3"], colour: "red",
                forbidden: { en: { variants: [], scope: ["menus"] }, pl: { variants: [], scope: ["ui"] } } },
            { id: "fx-open", en: "D", pl: null, gender: null, inflection: null, declension: { indeclinable: true, gen: "Du" }, stage: "E01", source: ["O8"], open: true,
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
        "entry 5 (fx-open)'s declension is neither { indeclinable: true } nor the forms it lists by case (gen, dat, instr, loc, plural), countable or not",
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
 * E65 C9: a fixture may also name what its detector lists apart (`gone`, T27's
 * pairs whose before is no longer in pl.json) and counts it must give (`counts`),
 * and the faults of the file it read that its detector carries (`faults`);
 * `naturalnessPairs` answers its own case (NATURALNESS_TABLE_FIXTURE), and
 * `schemas.naturalnessPairs` stands in for it as for the two schemas.
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
        /* What a detector lists apart from its findings (T27's pairs whose before is gone, E65 C9), the counts its fixture
           names, and the faults it carries of the file it read (`faults`, the fixture's own: T27's names one). */
        if (fx.gone) {
            const off = (r?.gone ?? []).map(g => g.pair).sort(), goneWant = [...fx.gone].sort();
            if (!same(off, goneWant)) out.push(`${name} lists ${off.length ? off.join(", ") : "nothing"} of its fixture as gone, not ${goneWant.join(", ")} - a pair changed by a later stage would be misread`);
        }
        for (const [k, n] of Object.entries(fx.counts ?? {})) {
            if (r?.counts?.[k] !== n) out.push(`${name} counts ${k} ${r?.counts?.[k]} on its fixture, not ${n}`);
        }
        if (r?.faults !== undefined || fx.faults) {
            const carried = JSON.stringify(r?.faults ?? []), faultsWant = JSON.stringify(fx.faults ?? []);
            if (carried !== faultsWant) out.push(`${name} carries the faults ${carried} of its fixture's file, not ${faultsWant} - a fault in the file it reads would pass`);
        }
        for (const [i, v] of (fx.also ?? []).entries()) {
            let rv;
            try { rv = run({ ...tools, ...fx.input, ...v.input }); } catch (err) { out.push(`${name} throws on its fixture's case ${i + 2} (${err?.message ?? err})`); continue; }
            const got = (rv?.found ?? []).map(itemOf).sort(), wantAlso = [...fx.flags, ...v.add].sort();
            if (!same(got, wantAlso)) out.push(`${name} flags ${got.length ? got.join(", ") : "none"} of its fixture's case ${i + 2} (${JSON.stringify(v.input)}), not ${wantAlso.join(", ")} - the stage rule is broken`);
            for (const [k, n] of Object.entries(v.counts ?? {})) {
                if (rv?.counts?.[k] !== n) out.push(`${name} counts ${k} ${rv?.counts?.[k]} on its fixture's case ${i + 2}, not ${n}`);
            }
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
    /* T27's table (E65 C9): the parser of the guide's pairs on its own case, as the schemas are held to theirs; `schemas`
       stands in for it the same way (`naturalnessPairs`), so a parser stubbed to read nothing is seen. */
    const np = schemas.naturalnessPairs ?? naturalnessPairs;
    const table = NATURALNESS_TABLE_FIXTURE.texts.map(t => np(t)).map(r => ({ pairs: (r?.pairs ?? []).map(p => `${p.id} ${p.key ?? "plan"}`), faults: r?.faults ?? [] }));
    if (JSON.stringify(table) !== JSON.stringify(NATURALNESS_TABLE_FIXTURE.want)) {
        out.push(`naturalnessPairs reads ${JSON.stringify(table)} off its fixture, not ${JSON.stringify(NATURALNESS_TABLE_FIXTURE.want)} - a row at fault in the guide's pairs would pass`);
    }
    /* T5's matchers (E65 C6): every X rule a matcher of X_RULES reads has a line of its own in T5's fixture, so a matcher
       broken to match nothing is a fixture mismatch under its own rule number. */
    for (const r of X_RULES) {
        if (!r.by && !(FIXTURES.patterns?.flags ?? []).some(f => f.endsWith(` ${r.id}-en`) || f.endsWith(` ${r.id}-pl`))) out.push(`${r.id} has no line of its own in T5's fixture - its matcher is held by nothing`);
    }
    return out;
}
