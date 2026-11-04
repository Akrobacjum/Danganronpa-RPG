/**
 * Danganronpa RPG - the CSS lint: what the stylesheets say, read as text (E44 C1b, 04.11.2026).
 * ---------------------------------------------------------------------------
 * Pure detectors over a stylesheet's text, each answering what it found and how
 * much it read. `node tools/css-lint.mjs` (and `node tools/check.mjs css`, which
 * runs it) holds their counts per sheet to tools/css-budget.json in Node, the
 * ci layer; the suite runs the same functions at a table: R1310 shows each its
 * fixture, R1311 holds the served sheets to the budget, and R2 asks
 * `deadClasses` whether a rule has lost its emitter. So the Node lint and the
 * suite cannot disagree about what a finding is.
 *
 * NO IMPORTS, AND NO FOUNDRY GLOBAL, for the reason tests-text.mjs has none:
 * tools/ runs in bare Node, where the kit cannot be loaded. The kit imports this
 * file and hands its names on, which is how the source crawl (moduleSources)
 * reaches it; being a suite file (`isSuiteFile`), it is never read by the
 * module-wide scans (otherSources), so its fixtures are not findings.
 *
 * NO DETECTOR READS LAYOUT. What a rule does on a laid-out page - which of two
 * rules wins under `@media`, what `var()` resolves to - is the style sweep's
 * (audit/style-sweep.mjs, Chromium) and the cascade's (tests-kit.mjs
 * `styleCascade`). These count what the text holds:
 *   importantCount    `!important`, a space after the `!` or not (`! important`
 *                     is valid CSS and the same declaration), in any value,
 *                     `var()` included;
 *   colourLiterals    a declaration that is not a custom property and holds a
 *                     hex colour, `rgb(a)()` or `hsl(a)()`: the colour belongs in
 *                     a token (a `--name: ...` definition, which is not counted);
 *   strayCommentEnds  a `*` + `/` left once every comment is removed - the end of
 *                     a comment that was never opened, which swallows nothing
 *                     but turns the next selector into garbage a browser drops;
 *   duplicateRules    the same selector list with the same declarations twice in
 *                     one sheet, under the same at-rules (a rule repeated in two
 *                     `@media` blocks is two rules);
 *   deadClasses       R2's detector, moved here unchanged (below).
 * Measured at c4210b4d (the E44 spec's probes, S/stages/E44/probe/): 958
 * `!important` (715 in danganronpa.css, 225 in stained-glass.css, 14 in
 * narrow.css, 4 in messenger.css), 445 declarations with a colour literal, no
 * stray comment end, no dead class of 653 named, and no rule written twice: the
 * probe's 4 were keyframe steps (`from`, `to`, `0%, 100%`) of different
 * `@keyframes`, which duplicateRules reads under their at-rules as different.
 * The budget's numbers are tools/css-budget.json's, written by `--write` from a
 * run, never by hand.
 */

/** A sheet's text with its comments removed, each replaced by a space - as R2's moduleStyles has always read it. */
export function stripCssComments(text) {
    return String(text ?? "").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/* Quote-aware block walk: every `{ ... }` of a sheet as { prelude, own, context }, where `own` is the block's text with
   its nested blocks taken out (its declarations) and `context` the preludes of the blocks it stands in (`@media ...`). */
function blocksOf(css) {
    const text = String(css ?? "");
    const out = [];
    const walk = (start, end, context) => {
        let i = start, seg = start, own = "";
        while (i < end) {
            const ch = text[i];
            if (ch === "\"" || ch === "'") {
                const close = text.indexOf(ch, i + 1);
                i = close < 0 || close >= end ? end : close + 1;
                continue;
            }
            if (ch === "{") {
                let depth = 0, j = i, quote = null;
                for (; j < end; j++) {
                    const c = text[j];
                    if (quote) { if (c === quote) quote = null; continue; }
                    if (c === "\"" || c === "'") quote = c;
                    else if (c === "{") depth++;
                    else if (c === "}" && --depth === 0) break;
                }
                const prelude = text.slice(seg, i).replace(/\s+/g, " ").trim();
                const block = { prelude, own: "", context };
                out.push(block);
                block.own = walk(i + 1, Math.min(j, end), [...context, prelude]);
                i = j + 1;
                seg = i;
                continue;
            }
            if (ch === ";") { own += text.slice(seg, i + 1); seg = i + 1; }
            i++;
        }
        return own + text.slice(seg, end);
    };
    walk(0, text.length, []);
    return out;
}

/* A block's declarations: its own text split on the semicolons outside brackets and quotes, each `property: value`. */
function declarationsOf(own) {
    const parts = [];
    let depth = 0, part = "", quote = null;
    for (const ch of String(own)) {
        if (quote) { if (ch === quote) quote = null; part += ch; continue; }
        if (ch === "\"" || ch === "'") quote = ch;
        if (ch === "(" || ch === "[") depth++;
        if (ch === ")" || ch === "]") depth--;
        if (ch === ";" && !depth) { parts.push(part); part = ""; } else part += ch;
    }
    parts.push(part);
    return parts.map(line => {
        const colon = line.indexOf(":");
        if (colon <= 0) return null;
        const property = line.slice(0, colon).trim();
        if (!/^-{0,2}[a-zA-Z][\w-]*$/.test(property)) return null;
        return { property, value: line.slice(colon + 1).trim() };
    }).filter(Boolean);
}

/** How many `!important` a sheet holds, comments aside. */
export function importantCount(text) {
    const css = stripCssComments(text);
    const found = [...css.matchAll(/!\s*important\b/gi)].map(m => m[0]);
    return { count: found.length, found, read: css.length };
}

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

/** Each declaration that is not a custom property and holds a colour literal, as `property: value`. */
export function colourLiterals(text) {
    const found = [];
    let read = 0;
    for (const block of blocksOf(stripCssComments(text))) {
        for (const decl of declarationsOf(block.own)) {
            read++;
            if (decl.property.startsWith("--")) continue;
            if (COLOUR.test(decl.value)) found.push(`${decl.property}: ${decl.value}`);
        }
    }
    return { count: found.length, found, read };
}

/** Each `*` + `/` left in a sheet once its comments are gone, by line. */
export function strayCommentEnds(text) {
    const raw = String(text ?? "");
    const blanked = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
    const found = [];
    for (const m of blanked.matchAll(/\*\//g)) found.push(`line ${blanked.slice(0, m.index).split("\n").length}`);
    return { count: found.length, found, read: raw.length };
}

/** Each style rule written a second (third ...) time in one sheet: the same selector list, the same declarations, under the same at-rules. */
export function duplicateRules(text) {
    const seen = new Map();
    const found = [];
    let read = 0;
    for (const block of blocksOf(stripCssComments(text))) {
        if (!block.prelude || block.prelude.startsWith("@")) continue;
        read++;
        const decls = declarationsOf(block.own).map(d => `${d.property}:${d.value.replace(/\s+/g, " ")}`).sort();
        const key = `${block.context.join(" | ")} || ${block.prelude} { ${decls.join("; ")} }`;
        if (seen.has(key)) found.push([...block.context, block.prelude].join(" > "));
        seen.set(key, true);
    }
    return { count: found.length, found, read };
}

/** The `drpg-` classes a sheet styles outside `:not()` - what deadClasses asks an emitter for. */
export function styledClasses(css) {
    return new Set([...String(css ?? "").replace(/:not\([^)]*\)/g, " ").matchAll(/\.(drpg-[a-z0-9-]+)/g)].map(m => m[1]));
}

/**
 * R2's detector (moved from tests-tier0.mjs's R2 at E44 C1b, its comments with it): every `.drpg-*` the sheets style
 * must be written somewhere in the module's sources. `css` is every served sheet as one text, comments removed
 * (tests-kit.mjs `moduleStyles`, or `stripCssComments` over the files in Node); `sources` the module's scripts as
 * [file, code] with their comments removed (tests-lint.mjs `stripComments`), the suite's own files out (otherSources).
 * Answers `{ inSheet, orphans, stale }`: how many classes the sheets name, the ones styling nothing, and the rows of
 * STORED that no longer hold.
 *
 * DEAD CSS IS INVISIBLE BY CONSTRUCTION. `.drpg-tamper-cover` was
 * written in E12 and replaced by an attribute a day later; the rule
 * stayed, and nothing about the module's behaviour would ever have said
 * so. Multiply that by an update this size and the sheet becomes a place
 * where you cannot tell which half of a selector is load-bearing.
 *
 * ONE DIRECTION, NOT TWO, AND THE MEASUREMENT IS WHY. The other
 * direction - "every class named in a script has a rule" - was built,
 * run, and dropped: 478 class names in the scripts, 133 of them with no
 * rule. Narrowed to the 173 that appear inside a `class="..."` attribute
 * it still reported 8, and all eight are structural: grid children that
 * take their placement from the parent (`drpg-tables-left`), wrappers
 * (`drpg-requirements`), live-region markers. A test that fails on those
 * is a test demanding the markup be made LESS readable - the same trap
 * as the E21 trigger test that demanded a worse implementation. So the
 * direction that measured zero and has real teeth is the one that runs.
 */
export function deadClasses(css, sources) {
    const inSheet = new Set([...css.matchAll(/\.(drpg-[a-z0-9-]+)/g)].map(m => m[1]));

    const named = new Set();
    const families = new Set();
    for (const [, code] of sources) {
        for (const m of code.matchAll(/drpg-[a-z0-9-]*/g)) {
            named.add(m[0]);
            // `drpg-outcome-${tone}` NAMES A FAMILY, not a class, and the
            // whole family is emitted by that one line. The trailing dash is
            // what marks it - and `drpg-` on its own is excluded, because
            // `drpg-${anything}` would otherwise vouch for every rule in the
            // sheet and this test would pass by saying nothing.
            if (/^drpg-[a-z0-9]+[a-z0-9-]*-$/.test(m[0])) families.add(m[0]);
        }
    }
    /*
     * A CLASS THAT ONLY EVER APPEARS IN A NEGATION IS A SWITCH, NOT A STYLE.
     * `:not(.drpg-compact)` is an opt-out written for a window that wants
     * the plain treatment; nothing wears it today and the rules it guards
     * work exactly as intended because of that. Asking for an emitter would
     * be asking somebody to add a class in order to keep a test quiet.
     */
    const switches = new Set();
    for (const m of css.matchAll(/:not\(([^)]*)\)/g)) {
        for (const c of m[1].matchAll(/\.(drpg-[a-z0-9-]+)/g)) switches.add(c[1]);
    }
    const styled = styledClasses(css);

    /*
     * A CLASS THE WORLD STILL CARRIES IS NOT DEAD. A chat card is stored as HTML, so a class
     * a card once wore outlives its last emitter in every world that kept the card. Each row
     * names the cards and the change that stopped writing it; a row whose rule is gone from
     * the sheet is a stale row and fails (E77 fix r1-G4, round 1's O4: C2 removed the move
     * card's description, and with it the only rule its old cards had).
     */
    const stale = Object.keys(STORED).filter(c => !styled.has(c) || named.has(c));

    const orphans = [...inSheet].filter(c =>
        styled.has(c) && !switches.has(c) && !(c in STORED)
        && !named.has(c) && ![...families].some(f => c.startsWith(f)));
    return { inSheet: inSheet.size, orphans, stale };
}

/** R2's kept cards: a class a stored chat card still wears, with the change that stopped writing it. */
export const STORED = {
    "drpg-room-prose": "the move card's description, written until E77 C2 (movement.mjs chargeForCrossing)"
};

/** The detectors css-lint counts per sheet, by the budget's names. */
export const DETECTORS = { importantCount, colourLiterals, strayCommentEnds, duplicateRules };

/** One sheet's counts, by the budget's field names (deadClasses comes from the whole set: `deadClasses`). */
export function sheetCounts(text) {
    return {
        important: importantCount(text).count,
        colourLiterals: colourLiterals(text).count,
        duplicates: duplicateRules(text).count,
        strayCommentEnds: strayCommentEnds(text).count
    };
}

/**
 * Every sheet's counts, the dead classes among them: `sheets` is [[file, text]] in module.json's order, `sources` the
 * scripts as deadClasses takes them. deadClasses reads the sheets as one text, as R2 does (a class only negated in one
 * sheet is a switch in all), and each class it finds is counted against every sheet that styles it outside `:not()`.
 * Answers `{ counts: { file: { important, colourLiterals, duplicates, strayCommentEnds, deadClasses } }, dead }`.
 */
export function lintCounts(sheets, sources) {
    const dead = deadClasses(stripCssComments(sheets.map(([, text]) => text).join("\n")), sources);
    const counts = {};
    for (const [file, text] of sheets) {
        const styled = styledClasses(stripCssComments(text));
        counts[file] = { ...sheetCounts(text), deadClasses: dead.orphans.filter(c => styled.has(c)).length };
    }
    return { counts, dead };
}

/** The fields a budget row holds; `strayCommentEnds` has none: it is 0, always. */
export const BUDGET_FIELDS = ["important", "colourLiterals", "duplicates", "deadClasses"];

/**
 * THE RATCHET (the shape of audit/harness/flow-length.json): each sheet's counts against its budget row. Above a
 * budget is red - a rule was added. Below it is red as well until the budget is lowered in the same commit
 * (`node tools/css-lint.mjs --write`), so the budget only falls and a later addition cannot spend what was removed.
 * With `atMost` (R1311 at a table, where the files served may be another checkout's) only "above" is red. A sheet with
 * no row, a row with no sheet and a stray comment end are red either way.
 */
export function budgetProblems(counts, budget, { atMost = false } = {}) {
    const problems = [];
    const rows = budget?.sheets ?? {};
    for (const [sheet, got] of Object.entries(counts)) {
        const row = rows[sheet];
        if (!row) { problems.push(`${sheet}: no row in tools/css-budget.json`); continue; }
        for (const field of BUDGET_FIELDS) {
            const want = row[field], have = got[field];
            if (!Number.isInteger(want)) { problems.push(`${sheet}: ${field} has no budget`); continue; }
            if (have > want) problems.push(`${sheet}: ${field} ${have}, above its budget ${want} - a rule added one`);
            else if (have < want && !atMost) problems.push(`${sheet}: ${field} ${have}, below its budget ${want} - lower the budget in this commit (node tools/css-lint.mjs --write)`);
        }
        if (got.strayCommentEnds) problems.push(`${sheet}: ${got.strayCommentEnds} stray comment end(s)`);
    }
    for (const sheet of Object.keys(rows)) if (!(sheet in counts)) problems.push(`${sheet}: a budget row for a sheet module.json does not serve`);
    return problems;
}

/*
 * THE FIXTURES, each with its findings known. A detector is shown a sheet that breaks its rule and one that does not:
 * one that flags everything proves as little as one that flags nothing. The planted faults are the ones the lint is
 * for - a literal in a declaration beside one in a token, an `!important` in a value holding `var()` and one written
 * `! important`, a comment end with no start, a rule written twice beside one written twice under another `@media`,
 * a class nobody writes beside a family written with a trailing dash.
 */
export const FIXTURES = {
    importantCount: {
        sheet: ".a { color: var(--x) !important; }\n.b { margin: 0 ! important; }\n/* .c { top: 0 !important } */\n.d { left: 0 !IMPORTANT; }",
        want: 3,
        clean: ".a { color: var(--x); }\n/* .b { top: 0 !important } */"
    },
    colourLiterals: {
        sheet: ":root { --drpg-ink: #112233; --drpg-glow: rgba(0, 0, 0, 0.5); }\n.a { color: #fff; }\n.b { box-shadow: 0 0 4px rgba(1, 2, 3, 0.4); }\n.c { background: hsl(10, 50%, 50%); }\n.d { color: var(--drpg-ink); }\n/* .e { color: #000 } */",
        want: 3,
        clean: ":root { --drpg-ink: #112233; }\n.a { color: var(--drpg-ink); border-color: currentColor; }"
    },
    strayCommentEnds: {
        sheet: ".a { color: red; }\n/* a comment */\n.b { top: 0; } */\n.c { left: 0; }",
        want: 1,
        clean: ".a { color: red; }\n/* a comment, with a star * inside */\n.b { top: 0; }"
    },
    duplicateRules: {
        sheet: ".a { color: red; top: 0; }\n.b { left: 0; }\n.a { top: 0; color: red; }\n@media (max-width: 10px) { .b { left: 0; } }\n@media (max-width: 20px) { .b { left: 0; } }",
        want: 1,
        clean: ".a { color: red; }\n.a { color: blue; }\n@media (max-width: 10px) { .a { color: red; } }"
    },
    deadClasses: {
        css: ".drpg-alive { top: 0 }\n.drpg-tone-hope { color: red }\n.drpg-nobody { left: 0 }\n.x:not(.drpg-switch) { top: 0 }\n.drpg-room-prose { top: 0 }",
        sources: [["a.mjs", "el.className = \"drpg-alive\";\nconst c = `drpg-tone-${tone}`;"]],
        want: ["drpg-nobody"],
        clean: [["a.mjs", "el.className = \"drpg-alive drpg-nobody\";\nconst c = `drpg-tone-${tone}`;"]]
    },
    budgetProblems: {
        counts: { "styles/a.css": { important: 3, colourLiterals: 2, duplicates: 0, deadClasses: 0, strayCommentEnds: 0 } },
        above: { sheets: { "styles/a.css": { important: 2, colourLiterals: 2, duplicates: 0, deadClasses: 0 } } },
        below: { sheets: { "styles/a.css": { important: 4, colourLiterals: 2, duplicates: 0, deadClasses: 0 } } },
        equal: { sheets: { "styles/a.css": { important: 3, colourLiterals: 2, duplicates: 0, deadClasses: 0 } } }
    }
};

/**
 * Every detector on its fixture: the planted sheet's count and the clean sheet's 0, and the ratchet's three cases - a
 * count above its budget red, below red unless `atMost`, equal green. Answers the mismatches as sentences; [] is held.
 */
export function selfCheck(detectors = DETECTORS, { deadClassesFn = deadClasses, budgetFn = budgetProblems } = {}) {
    const problems = [];
    for (const name of Object.keys(DETECTORS)) {
        const fx = FIXTURES[name], fn = detectors[name];
        if (typeof fn !== "function") { problems.push(`${name}: no detector`); continue; }
        const planted = fn(fx.sheet), clean = fn(fx.clean);
        if (planted.count !== fx.want) problems.push(`${name} counts ${planted.count} in its fixture, not ${fx.want} (${JSON.stringify(planted.found)})`);
        if (clean.count !== 0) problems.push(`${name} counts ${clean.count} in its clean sheet (${JSON.stringify(clean.found)})`);
        if (!(planted.read > 0)) problems.push(`${name} read nothing of its fixture`);
    }
    const dc = FIXTURES.deadClasses;
    const dead = deadClassesFn(dc.css, dc.sources), alive = deadClassesFn(dc.css, dc.clean);
    if (JSON.stringify(dead.orphans) !== JSON.stringify(dc.want)) problems.push(`deadClasses finds ${JSON.stringify(dead.orphans)} in its fixture, not ${JSON.stringify(dc.want)}`);
    if (alive.orphans.length) problems.push(`deadClasses finds ${JSON.stringify(alive.orphans)} where every class is written`);
    if (dead.stale.length) problems.push(`deadClasses calls a STORED row stale where its rule stands: ${JSON.stringify(dead.stale)}`);
    if (dead.inSheet !== 5) problems.push(`deadClasses reads ${dead.inSheet} class(es) of its fixture, not 5`);
    const bp = FIXTURES.budgetProblems;
    const verdicts = {
        above: budgetFn(bp.counts, bp.above).length, below: budgetFn(bp.counts, bp.below).length,
        equal: budgetFn(bp.counts, bp.equal).length, belowAtMost: budgetFn(bp.counts, bp.below, { atMost: true }).length
    };
    const want = { above: 1, below: 1, equal: 0, belowAtMost: 0 };
    if (JSON.stringify(verdicts) !== JSON.stringify(want)) problems.push(`the budget's ratchet answers ${JSON.stringify(verdicts)} problems, not ${JSON.stringify(want)} (above, below, equal, below with atMost)`);
    return problems;
}
