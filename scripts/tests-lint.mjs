/**
 * Danganronpa RPG - the test author contract, read off the suite's text (E30, audit S17-03).
 * ---------------------------------------------------------------------------
 * Pure detectors over the source of a tier file, and one over a harness
 * scenario: a cut bounded by a bare indexOf, an assertion true by
 * construction, needs() handed something that is not a probe, a red marker,
 * and a harness check() that cannot fail. The suite's tier-0 meta-tests
 * (R155-R158) and `node tools/check.mjs contract` read the same functions, so
 * the Node check and the suite cannot disagree about what a violation is.
 *
 * NO IMPORTS, and that is the reason this is its own file. tools/check.mjs
 * runs in bare Node, where the kit cannot be loaded: it imports settings.mjs,
 * which throws "Hooks is not defined" outside Foundry (tried 24.09.2026). The
 * kit imports this file instead - which is also how the source crawl
 * (moduleSources here, loadedFiles in diagnostics.mjs) reaches it - and hands
 * stripComments and lineAt on to the tiers.
 *
 * Every detector returns `{ found, read }`: what it flags, with a line, and how
 * many candidates it looked at. `read` is the positive control - a detector
 * that read nothing has proved nothing - and FIXTURES below hold a text for
 * each with its violations known, which the meta-tests run first (R21's
 * lesson: a checker is trusted only after it has been seen to catch what it
 * is for). The fixtures are here, not in a tier file, because the scan of
 * the tier files must not meet them.
 */

/**
 * Source with its comments taken out, line breaks kept so a line number still
 * points at the code.
 *
 * LEARNED IN E22, AT THE COST OF A FALSE PASS AND A FALSE FAIL. A test that
 * read its own module found the broken CSS *quoted in the comment above the
 * fix* and reported the fix as missing. Anything that greps this module for
 * evidence has to look at the code, because the comments here are long and full
 * of the exact strings the code is not supposed to contain any more.
 */
export function stripComments(text) {
    // NEWLINES SURVIVE, and the first run is why. Collapsing a block comment to
    // one space shortens the file by every line it spanned, so every `file:line`
    // this tier reported pointed at innocent code - `movement.mjs:629`, which is
    // a variable declaration, for a call that lives two hundred lines further
    // down. A failure message nobody can follow is worse than no message.
    return String(text ?? "")
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
        .replace(/^([ \t]*)\/\/.*$/gm, "$1")
        // AND THE ONE THAT SITS AFTER CODE. R22 read `// safely() may retry`
        // as a call to a function nobody declared, and `// strip accents (ą…)`
        // as another. The character in front has to be neither `:` nor a word
        // character, which is what keeps `https://` and every other protocol
        // out of it.
        .replace(/([^:\w])\/\/[^\n]*$/gm, "$1");
}

/** Line number of an index, for a failure message somebody has to act on. */
export const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/* Whether a "/" at the end of `before` starts a regex literal rather than a division:
   it does after an operator, an opening bracket, a comma, a colon, a semicolon, a
   brace, a line break or a keyword that takes an expression. The heuristic the kit's
   stringLiterals uses, shared by the two readers below. */
const regexCanStart = before => /(?:^|[=(,:;!&|?{}[+\-*%<>~^\n])\s*$/.test(before)
    || /(?:^|[^\w$])(?:return|typeof|case|in|of|void|yield|await|else|do)\s*$/.test(before);

/**
 * The text with every comment blanked - to spaces, line breaks kept, so it is as
 * long as the text and a position in one is a position in the other - and nothing
 * else touched. One pass that knows where a string, a template (and the code in
 * its `${...}`), a regex literal and a comment each begin, so none can be taken
 * for another. stripComments cannot tell: in the tier file that checks the
 * stylesheets' comments, `/\/\*|\*\//g` and `m[0] === "/*"` read to it as a
 * comment's end and a comment's start, and it blanked the twenty lines between
 * them and the next comment - R65's first line among them, so the detectors below
 * counted 122 tests in tier 0 where there were 123 (24.09.2026). The detectors
 * read this; the tiers keep stripComments for the module's own files, where the
 * same scan found none of those spellings.
 */
export function blankComments(text) {
    const s = String(text ?? "");
    let out = "", i = 0, depth = 0;
    const holes = [];
    const templateText = () => {
        while (i < s.length) {
            const c = s[i];
            if (c === "\\") { out += s.slice(i, i + 2); i += 2; continue; }
            if (c === "`") { out += c; i++; return; }
            if (c === "$" && s[i + 1] === "{") { out += "${"; i += 2; holes.push(depth); depth++; return; }
            out += c;
            i++;
        }
    };
    while (i < s.length) {
        const c = s[i], d = s[i + 1];
        if (c === "/" && d === "/") {
            let j = i;
            while (j < s.length && s[j] !== "\n") j++;
            out += " ".repeat(j - i);
            i = j;
        } else if (c === "/" && d === "*") {
            let j = i + 2;
            while (j < s.length && !(s[j] === "*" && s[j + 1] === "/")) j++;
            j = Math.min(j + 2, s.length);
            out += s.slice(i, j).replace(/[^\n]/g, " ");
            i = j;
        } else if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < s.length && s[j] !== c && s[j] !== "\n") j += s[j] === "\\" ? 2 : 1;
            j = Math.min(j + 1, s.length);
            out += s.slice(i, j);
            i = j;
        } else if (c === "`") {
            out += c;
            i++;
            templateText();
        } else if (c === "}" && holes.length && holes[holes.length - 1] === depth - 1) {
            depth--;
            holes.pop();
            out += c;
            i++;
            templateText();
        } else if (c === "/" && regexCanStart(out.slice(-24))) {
            let j = i + 1, inClass = false;
            while (j < s.length && s[j] !== "\n") {
                if (s[j] === "\\") { j += 2; continue; }
                if (s[j] === "[") inClass = true;
                else if (s[j] === "]") inClass = false;
                else if (s[j] === "/" && !inClass) break;
                j++;
            }
            if (s[j] === "/") {
                j++;
                while (/[a-z]/.test(s[j] ?? "")) j++;
                out += s.slice(i, j);
                i = j;
            } else {
                out += c;
                i++;
            }
        } else {
            if (c === "{") depth++;
            else if (c === "}") depth--;
            out += c;
            i++;
        }
    }
    return out;
}

/**
 * The code with every literal's text blanked - strings, a template's text (its
 * `${...}` code kept), regex literals - length and line breaks kept, so an
 * index in one is an index in the other. A detector finds calls and their
 * brackets here, where a quote or a bracket inside a sentence cannot fool it,
 * and reads a literal's words back from the unblanked text when it needs them.
 * Regex literals are told from a division by what comes before the slash, as
 * stringLiterals in the kit does.
 */
export function blankLiterals(code) {
    const text = String(code ?? "");
    let out = "", i = 0;
    const blank = s => s.replace(/[^\n]/g, " ");
    while (i < text.length) {
        const c = text[i];
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < text.length && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
            j = Math.min(j + 1, text.length);
            out += blank(text.slice(i, j));
            i = j;
            continue;
        }
        if (c === "`") {
            let j = i + 1;
            out += " ";
            while (j < text.length && text[j] !== "`") {
                if (text[j] === "\\") { out += blank(text.slice(j, j + 2)); j += 2; continue; }
                if (text[j] === "$" && text[j + 1] === "{") {
                    let k = j + 2, depth = 1;
                    while (k < text.length && depth) {
                        if (text[k] === "{") depth++;
                        else if (text[k] === "}") depth--;
                        if (depth) k++;
                    }
                    out += "  " + blankLiterals(text.slice(j + 2, k)) + " ";
                    j = k + 1;
                    continue;
                }
                out += text[j] === "\n" ? "\n" : " ";
                j++;
            }
            if (j < text.length) out += " ";
            i = j + 1;
            continue;
        }
        if (c === "/" && regexCanStart(text.slice(Math.max(0, i - 24), i))) {
            let j = i + 1, inClass = false;
            while (j < text.length && text[j] !== "\n") {
                if (text[j] === "\\") { j += 2; continue; }
                if (text[j] === "[") inClass = true;
                else if (text[j] === "]") inClass = false;
                else if (text[j] === "/" && !inClass) break;
                j++;
            }
            if (text[j] === "/") {
                j++;
                while (/[a-z]/.test(text[j] ?? "")) j++;
                out += blank(text.slice(i, j));
                i = j;
                continue;
            }
        }
        out += c;
        i++;
    }
    return out;
}

/* The arguments of the call whose "(" is at `open`, in blanked code: [{ start, end }], and
   where the call closes. Brackets are counted; literals are blank, so none of theirs count. */
function callArgs(blank, open) {
    const args = [];
    let depth = 0, start = open + 1;
    for (let i = open; i < blank.length; i++) {
        const c = blank[i];
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") {
            depth--;
            if (depth === 0) {
                if (blank.slice(start, i).trim() || args.length) args.push({ start, end: i });
                return { args, close: i };
            }
        } else if (c === "," && depth === 1) {
            args.push({ start, end: i });
            start = i + 1;
        }
    }
    return { args, close: blank.length };
}

/**
 * The tests of a tier file: `[{ name, start, end, line }]`, one per entry of the
 * array the file exports (REGRESSIONS, INVARIANTS, SCENARIOS), an entry being a
 * line that opens `    ["name"` at four spaces. Positions are in `text`.
 */
export function testsIn(text) {
    const src = blankComments(text);
    const open = src.search(/^const (?:REGRESSIONS|INVARIANTS|SCENARIOS) = \[/m);
    if (open < 0) return [];
    const close = src.indexOf("\n];", open);
    const end = close < 0 ? src.length : close;
    // The name as the runner sees it: the literal decoded, so `\"` reads as `"`.
    const decode = (quote, raw) => {
        if (quote === '"') { try { return JSON.parse(`"${raw}"`); } catch { return raw; } }
        return raw.replace(/\\(.)/g, "$1");
    };
    const starts = [...src.slice(open, end).matchAll(/^ {4}\[\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/gm)]
        .map(m => ({ name: decode(m[1], m[2]), start: open + m.index }));
    return starts.map((t, i) => ({ ...t, end: starts[i + 1]?.start ?? end, line: lineAt(src, t.start) }));
}

/* Where a position sits for the purpose of its locals: its test, or else the
   top-level statement around it (a helper outside the test list). */
function scopeOf(code, tests, at) {
    const test = tests.find(t => t.start <= at && at < t.end);
    if (test) return [test.start, test.end];
    const before = code.slice(0, at);
    const from = Math.max(0, before.search(/\n[^\s\n][^\n]*$/) + 1);
    const next = code.slice(at).search(/\n[^\s\n}\])]/);
    return [from, next < 0 ? code.length : at + next];
}

const FINDER = /\.(?:indexOf|lastIndexOf|search)\s*\(/;

/**
 * A cut of source text bounded by indexOf - `src.slice(src.indexOf(marker))`,
 * directly or through a local the same test set from one - and every
 * `.split(marker)[1]`. Either answers -1 or nothing when the marker has moved,
 * and every negative assertion after it then passes. No guard is exempt: the
 * kit's cutters (bodyOf, fnSource, lineAround) are the way to cut.
 */
export function bareCuts(text) {
    const code = blankComments(text), blank = blankLiterals(code), tests = testsIn(code);
    const found = [];
    let read = 0;
    for (const m of blank.matchAll(/\.(slice|substring|substr)\s*\(/g)) {
        read++;
        const open = m.index + m[0].length - 1;
        const { args } = callArgs(blank, open);
        const [from, to] = scopeOf(blank, tests, m.index);
        for (const arg of args) {
            const expr = blank.slice(arg.start, arg.end);
            if (FINDER.test(expr)) {
                found.push({ line: lineAt(code, m.index), what: `.${m[1]}() bounded by ${expr.match(FINDER)[0].slice(1, -1).trim()}()` });
                break;
            }
            const locals = [...new Set(expr.match(/[A-Za-z_$][\w$]*/g) ?? [])];
            const scope = blank.slice(from, m.index);
            const via = locals.find(name => [...scope.matchAll(
                new RegExp(`(?:^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\s*=(?![=>])([^;\\n]*)`, "gm"))]
                .some(d => FINDER.test(d[1])));
            if (via) {
                found.push({ line: lineAt(code, m.index), what: `.${m[1]}() bounded by ${via}, which an indexOf set` });
                break;
            }
        }
    }
    for (const m of blank.matchAll(/\.split\s*\(/g)) {
        read++;
        const { close } = callArgs(blank, m.index + m[0].length - 1);
        const index = blank.slice(close + 1).match(/^\s*(?:\?\.)?\[\s*(\d+)\s*\]/);
        if (index && Number(index[1]) >= 1) found.push({ line: lineAt(code, m.index), what: `.split(marker)[${index[1]}]` });
    }
    return { found, read };
}

/* An argument that holds whatever happens: a literal, or an expression with a
   `|| true`, `|| 1` or `?? true` at its own top level. */
function trueByConstruction(expr) {
    const e = expr.trim();
    if (/^(?:true|!0|!!1|-?[1-9][\d_]*(?:\.\d+)?|\[\s*\]|\{\s*\})$/.test(e)) return true;
    // A string, or a template with no `${...}` in it: a template that interpolates is computed.
    if (/^(["'])[\s\S]*\1$/.test(e) || (/^`[\s\S]*`$/.test(e) && !e.includes("${"))) return true;
    let depth = 0, flat = "";
    for (const c of e) {
        if ("([{".includes(c)) depth++;
        else if (")]}".includes(c)) depth--;
        flat += depth === 0 ? c : " ";
    }
    return /(?:\|\|\s*(?:true|1|!0)|\?\?\s*true)\s*(?:$|[,)|&?])/.test(flat);
}

/**
 * `ok(true, ...)`, `equal(x, x, ...)`, `needs(1)`, a `|| true` at the top of an
 * assertion's condition: an assertion that holds whatever the code does.
 */
export function vacuousAsserts(text) {
    const code = blankComments(text), blank = blankLiterals(code);
    const found = [];
    let read = 0;
    for (const m of blank.matchAll(/(?<![\w$.])(ok|equal|needs)\s*\(/g)) {
        if (/function\s+$/.test(blank.slice(Math.max(0, m.index - 12), m.index))) continue;
        read++;
        const { args } = callArgs(blank, m.index + m[0].length - 1);
        if (!args.length) continue;
        const first = code.slice(args[0].start, args[0].end);
        /* equal() compares, so one literal side is a real check (`equal("open", state.stage)`
           reads backwards and still measures); it holds by construction only against itself
           or with a literal on both sides. */
        if (m[1] === "equal") {
            const second = args[1] ? code.slice(args[1].start, args[1].end) : "";
            if (first.trim() === second.trim() || (trueByConstruction(first) && trueByConstruction(second))) {
                found.push({ line: lineAt(code, m.index), what: `equal() of ${first.trim().slice(0, 40)} with ${second.trim().slice(0, 40)}` });
            }
        } else if (trueByConstruction(first)) {
            found.push({ line: lineAt(code, m.index), what: `${m[1]}(${first.trim().slice(0, 40)}, ...) holds by construction` });
        }
    }
    return { found, read };
}

/** Every `needs(` whose first argument is not a call of an env.* or world.* probe. */
export function needsArgs(text) {
    const code = blankComments(text), blank = blankLiterals(code);
    const found = [];
    let read = 0;
    for (const m of blank.matchAll(/(?<![\w$.])needs\s*\(/g)) {
        if (/function\s+$/.test(blank.slice(Math.max(0, m.index - 12), m.index))) continue;
        read++;
        const { args } = callArgs(blank, m.index + m[0].length - 1);
        const first = args.length ? code.slice(args[0].start, args[0].end) : "";
        if (!/^\s*(?:env|world)\.[A-Za-z]+\(/.test(first)) {
            found.push({ line: lineAt(code, m.index), what: `needs(${first.trim().slice(0, 50) || "nothing"}) is not a probe` });
        }
    }
    return { found, read };
}

/** Every `expectedRed(` with its stage when it is written out as a string ("E07"), else null. */
export function redMarkers(text) {
    const code = blankComments(text), blank = blankLiterals(code);
    const found = [];
    for (const m of blank.matchAll(/(?<![\w$.])expectedRed\s*\(/g)) {
        if (/function\s+$/.test(blank.slice(Math.max(0, m.index - 12), m.index))) continue;
        const { args } = callArgs(blank, m.index + m[0].length - 1);
        const first = args.length ? code.slice(args[0].start, args[0].end).trim() : "";
        const literal = first.match(/^(["'`])([^"'`$]*)\1$/);
        found.push({ line: lineAt(code, m.index), stage: literal ? literal[2] : null });
    }
    return { found, read: found.length };
}

/**
 * A harness scenario's `check(name, true, ...)` - a line posing as a verdict,
 * which adds one to the passed count and measures nothing - and a `|| true` at
 * the top of a check's condition.
 */
export function vacuousChecks(text) {
    const code = blankComments(text), blank = blankLiterals(code);
    const found = [];
    let read = 0;
    for (const m of blank.matchAll(/(?<![\w$.])check\s*\(/g)) {
        if (/function\s+$/.test(blank.slice(Math.max(0, m.index - 12), m.index))) continue;
        read++;
        const { args } = callArgs(blank, m.index + m[0].length - 1);
        if (args.length < 2) continue;
        const cond = code.slice(args[1].start, args[1].end);
        if (trueByConstruction(cond)) found.push({ line: lineAt(code, m.index), what: `check(..., ${cond.trim().slice(0, 40)}) cannot fail` });
    }
    return { found, read };
}

/*
 * RAW ACCESS TO A GM STORE'S KEY (E04, 26.09.2026; R171, and `node tools/check.mjs
 * contract` for the harness scenarios).
 *
 * The GM store (gm-store.mjs) holds each GM-only store under a key sectioned by
 * world, merged per field, and it never writes the old keys: a downgrade finds
 * them as the upgrade left them, and the next world opened in the browser claims
 * its own rows from them. Both hold only while nothing else reads or writes those
 * keys - a raw write to an old key is the one thing the upgrade promised would not
 * happen, and a raw read of one after its store moved reads a copy frozen at the
 * upgrade and looks exactly like a working read.
 *
 * So this finds, in a file's code, every `SETTINGS.<name>` of a watched setting
 * that is not a listener comparing a changed key with it (`key ===
 * \`${MODULE_ID}.${SETTINGS.x}\``, which reads nothing), and every settings call or
 * localStorage access that names a watched key in a string (a harness scenario's
 * eval, where the key is spelt out). A mention inside a string or a comment is not
 * code. GM_STORE_PENDING is the stores that have not moved yet: their current keys
 * are watched too, from the commit that brought the engine (C1), so the allowlist
 * of the files that still use them shrinks as each store moves and is empty at the
 * end of E04.
 */
export const GM_STORE_PENDING = Object.freeze([
    "discoveryLedger", "discoveryMine"
]);

/*
 * The harness scenarios' own allowance, by `file#key` (read by `node tools/check.mjs
 * contract`): a scenario may still read these keys raw until the commit named, which
 * rewrites it to read through the stores. A row with no such read left fails as stale.
 */
export const GM_STORE_SCENARIO_ALLOW = Object.freeze({
    "17-assistant.mjs#discoveryLedger": "reads the fog ledger raw until the fog moves (E04 C9)",
    "17-assistant.mjs#discoveryMine": "reads a player's fog rows raw until the fog moves (E04 C9)",
    "60-ledger.mjs#discoveryLedger": "the fog ledger's own scenario, raw until the fog moves (E04 C9)",
    "60-ledger.mjs#discoveryMine": "the fog ledger's own scenario, raw until the fog moves (E04 C9)"
});

/**
 * The settings the GM stores use, read off the source text alone, for Node, which
 * cannot load settings.mjs: SETTINGS's `name: "key"` pairs, and the names the
 * store table (gm-stores.mjs) hands `defineGmStore` and `defineGmCopy` as a `key`,
 * a `legacyKey` or one of `legacyKeys`. Answers `{ props, keys }`: the SETTINGS
 * names and their keys.
 */
export function gmStoreSettingsFromSource(settingsText, storesText) {
    const body = /export const SETTINGS = \{([\s\S]*?)\n\};/.exec(String(settingsText ?? ""))?.[1] ?? "";
    const map = new Map([...stripComments(body).matchAll(/^\s*(\w+):\s*"([^"]+)"/gm)].map(m => [m[1], m[2]]));
    const table = stripComments(String(storesText ?? ""));
    const props = new Set([...table.matchAll(/\b(?:key|legacyKey):\s*SETTINGS\.(\w+)\b/g)].map(m => m[1]));
    // A copy that replaced more than one old key names them all (`legacyKeys: [SETTINGS.a, SETTINGS.b]`).
    for (const list of table.matchAll(/\blegacyKeys:\s*\[([^\]]*)\]/g)) for (const m of list[1].matchAll(/\bSETTINGS\.(\w+)\b/g)) props.add(m[1]);
    for (const [prop, key] of map) if (GM_STORE_PENDING.includes(key)) props.add(prop);
    return { props: [...props].sort(), keys: [...props].map(p => map.get(p)).filter(Boolean).sort(), settings: map.size };
}

export function storeKeyAccess(text, { props = [], keys = [] } = {}) {
    const code = stripComments(text);
    const blank = blankLiterals(code);
    const watchedProps = new Set(props), watchedKeys = new Set(keys);
    const found = [];
    let read = 0;
    for (const m of blank.matchAll(/\bSETTINGS\.(\w+)\b/g)) {
        read++;
        if (!watchedProps.has(m[1])) continue;
        // This match's own template, `${MODULE_ID}.${SETTINGS.x}`, compared with === or !==; and a
        // registration, which declares the key and reads nothing.
        const before = code.slice(Math.max(0, m.index - 40), m.index);
        const after = code.slice(m.index + m[0].length, m.index + m[0].length + 40);
        if (/\bsettings\.register\(\s*MODULE_ID\s*,\s*$/.test(before)) continue;
        if (/`\$\{MODULE_ID\}\.\$\{$/.test(before) && /^\}`/.test(after)
            && (/(?:===|!==)\s*`\$\{MODULE_ID\}\.\$\{$/.test(before) || /^\}`\s*(?:===|!==)/.test(after))) continue;
        found.push({ line: lineAt(code, m.index), what: `SETTINGS.${m[1]}`, name: m[1] });
    }
    for (const m of code.matchAll(/\bsettings\.(?:get|set)\(\s*["'`][^"'`,]*["'`]\s*,\s*["'`](\w+)["'`]/g)) {
        read++;
        if (watchedKeys.has(m[1])) found.push({ line: lineAt(code, m.index), what: `a settings call on "${m[1]}"`, name: m[1] });
    }
    for (const m of code.matchAll(/\blocalStorage\.(?:getItem|setItem|removeItem)\(\s*["'`][^"'`]*?\.(\w+)["'`]/g)) {
        read++;
        if (watchedKeys.has(m[1])) found.push({ line: lineAt(code, m.index), what: `localStorage on "${m[1]}"`, name: m[1] });
    }
    return { found, read };
}

/*
 * THE FIXTURES, each with the lines its detector must flag and nothing else.
 * A fixture line that should pass is as much a part of it as one that should
 * not: a detector that flags everything proves as little as one that flags
 * nothing.
 */
export const FIXTURES = Object.freeze({
    bareCuts: {
        flags: [5, 6, 8, 10, 12],
        text: [
            "const REGRESSIONS = [",
            "    [\"a fixture test\", async () => {",
            "        const src = await read();",
            "        const at = src.indexOf(\"marker\");",
            "        const a = src.slice(src.indexOf(\"x\"));",
            "        const b = src.slice(at, at + 400);",
            "        const c = bodyOf(src, \"marker\", { until: \"\\n}\" });",
            "        const d = src.substring(0, src.lastIndexOf(\"end\"));",
            "        const e = [1, 2, 3].slice(1);",
            "        const f = src.split(\"const TABLE\")[1];",
            "        const g = src.split(\"\\n\")[0];",
            "        const h = src.slice(0, src.search(/^export /m));",
            "        ok(\"src.slice(src.indexOf(1))\", \"a string is not a cut\");",
            "    }]",
            "];"
        ].join("\n")
    },
    vacuousAsserts: {
        flags: [3, 4, 5, 6, 7, 8, 14],
        text: [
            "const REGRESSIONS = [",
            "    [\"a fixture test\", async () => {",
            "        ok(true, \"always\");",
            "        ok(1, \"always\");",
            "        ok(found || true, \"always\");",
            "        equal(value, value, \"itself\");",
            "        ok(\"a sentence\", \"a string is truthy\");",
            "        needs(!0, \"always\");",
            "        ok(found.length > 0, \"a real one\");",
            "        ok(a || b, \"a real one\");",
            "        equal(value, other, \"a real one\");",
            "        ok((x || true) && y, \"inside brackets, the rest decides\");",
            "        equal(\"open\", state.stage, \"a literal on one side still compares\");",
            "        equal(2, 2, \"two literals\");",
            "    }]",
            "];"
        ].join("\n")
    },
    needsArgs: {
        flags: [3, 4, 5],
        text: [
            "const INVARIANTS = [",
            "    [\"a fixture test\", async () => {",
            "        needs(layoutAvailable(), \"a condition\");",
            "        needs(document.body, \"an element\");",
            "        needs(probe, \"a probe in a variable is still not seen to be one\");",
            "        needs(env.layout(), \"a probe\");",
            "        needs(world.atLeast(\"livingStudents\", 2), \"a probe\");",
            "    }]",
            "];"
        ].join("\n")
    },
    redMarkers: {
        stages: ["E07", null, "E31"],
        text: [
            "const SCENARIOS = [",
            "    [\"one\", async () => { ok(false, \"x\"); }, expectedRed(\"E07\", \"why\")],",
            "    [\"two\", async () => { ok(false, \"x\"); }, expectedRed(stage, \"why\")],",
            "    // [\"three\", async () => {}, expectedRed(\"E99\", \"a comment is not a marker\")],",
            "    [\"four\", async () => { ok(false, \"x\"); }, expectedRed('E31', \"why\", { failing: \"x\" })]",
            "];"
        ].join("\n")
    },
    storeKeyAccess: {
        flags: [1, 2, 7, 8, 9],
        props: ["watched"],
        keys: ["watchedKey"],
        text: [
            "const a = game.settings.get(MODULE_ID, SETTINGS.watched);",
            "await setSetting(SETTINGS.watched, {});",
            "if (key === `${MODULE_ID}.${SETTINGS.watched}`) drop();",
            "const b = game.settings.get(MODULE_ID, SETTINGS.other);",
            "const c = bodyOf(src, \"SETTINGS.watched\");",
            "// game.settings.get(MODULE_ID, SETTINGS.watched)",
            "const d = await p.eval(`return game.settings.get(\"${MOD}\", \"watchedKey\");`);",
            "localStorage.getItem(\"danganronpa-rpg.watchedKey\");",
            "const steps = [[\"incident\", \"the cast\", SETTINGS.watched, {}]];"
        ].join("\n")
    },
    vacuousChecks: {
        flags: [2, 3, 4],
        text: [
            "export async function run({ check }) {",
            "    check(\"booted\", true, \"a log line\");",
            "    check(\"booted\", 1);",
            "    check(\"held\", held === true || true, \"always\");",
            "    check(\"held\", held === true, \"a real one\");",
            "}"
        ].join("\n")
    }
});
