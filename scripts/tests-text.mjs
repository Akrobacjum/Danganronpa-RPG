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
 * the two legacy lists (`legacyListsFrom` over tables.mjs's text).
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
    tableWordProblems: Object.freeze({ test: "T14", mode: "fail", fail: "E65", reads: Object.freeze(["tables"]) })
});

export const DETECTORS = Object.freeze({ pluralForms, configPlaceholders, pairParity, familyFormats, dashesIn, tableWordProblems });

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
 * Every detector on its fixture: [] when each flags exactly its fixture's items
 * and read something, else one sentence a mismatch. `detectors` defaults to this
 * file's; check.mjs and R1058 pass none, a planted fault passes its own. `tools`
 * goes into every fixture's bag - the lexer, which a detector that reads code
 * needs and this file cannot import. Then every baseline row is well formed and
 * belongs to a FAIL detector, and `legacyListsFrom` and the matcher answer their
 * own cases.
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
    return out;
}
