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
 *
 * AND THE CONTRAST (E44 C1c, D29 = 2): `themeTokens`, `resolveColour`,
 * `contrastRatio` and `contrastOf` read each theme's tokens off the same text and
 * measure the pairs of tools/contrast-pairs.json by WCAG 2 - tools/contrast.mjs
 * (`node tools/check.mjs contrast`) in Node, R1312 on the served files.
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

/* ================================ meaning (E48 K1) ================================ */

/*
 * ONE MEANING PER COLOUR (E48 K1, 11.11.2026; the plan's "złoto zostaje wyłącznie dla Hope"). A meaning token may be read
 * only by a rule that names its meaning: `MEANING` holds, per meaning, the tokens that carry it and the words a rule's
 * selector (or the custom property it defines) must hold to read one. The selector a rule is judged by is its own and
 * the at-rules it stands in (a `@keyframes drpg-hope-...` step reads as Hope); a custom property whose name holds a word
 * of the list (`--drpg-kit-call-hope`) may alias the token anywhere, and any other alias is itself a finding - so a
 * token cannot be laundered through a name. `--drpg-gold-antique` is not here: it is `var(--drpg-evidence)`, Evidence's.
 * Measured at 13531607 (the 1.2.105 line) before K1: 102 reads of a gold token, 54 of them in 42 rules outside the list
 * (the designer's count at 120a8003 was 45 rules by another reading: rules, not reads, with a looser Hope list). K1 sent
 * each to attention (focus, selection, an offer, a warning: 41 reads), Bone (a plain mark: 8), Evidence (`.drpg-sum-found`,
 * the assembly), the despair pink (the glass's motive, as the trial's) or the critical's light red (`.drpg-flat-crit`).
 */
export const MEANING = {
    hope: {
        tokens: /^--drpg-(?:gold(?:-light|-deep|-shadow)?(?:-rgb)?|sg-hope)$/,
        words: /hope|ultimate|\bstars?\b|determination|free-crit|loaded/i,
        why: "gold means Hope and nothing else"
    },
    /* Where K1 sent the focus and the selections, the offers and the asks; a new reader names one of these or says what
       it is here. `phase-daily`: the clock's Daily Life, Hope's #ffd23f under another name until K2b (the owner's default
       on K2's open, 11.11; to be seen before it is decided), now the colour of what asks to be looked at. */
    attention: {
        tokens: /^--drpg-attention(?:-rgb)?$/,
        words: /focus|:checked|radio|selected|drpg-choice|rest-option|frisk-mode|unlocked|offered|init-button|warn|:hover|past-first|debate|rebuttal|tab-dot|saved|paused|checkmark|\bselect\b|phase-daily/i,
        why: "the attention colour is for focus, selection and what asks to be looked at"
    },
    /*
     * THE HOUR (E48 K2, 11.11.2026; D30; K2b, 11.11.2026). `--drpg-glass-accent` is the state colour - the hour, replaced
     * by the phase, the Eclipse and an incident here - and the five hour tokens behind it. K2 took it off what the stage
     * names: the Event panel's cards, the action and Call tiles, the panel's, the sheet's and the messenger's buttons, the
     * sheet's tabs and the state bars, and the picking rows (their `--kind`, now `--drpg-attention`, Q6). K2b took it off
     * the three controls K2 had left reading it (the owner's default on K2's open, 11.11: a control is not a decoration):
     * a field's and a checkbox's focus (to `--drpg-attention`, focus being attention's), the HUD's buttons and the GM
     * panel's section bars. `never` keeps it off all of them; `words` is HOUR_KEPT, every surface still allowed it, each
     * with its reason, and R3412 holds each family to at least one read (a family nothing reads is a stale line).
     */
    hour: {
        tokens: /^--drpg-(?:glass-accent|sg-(?:morning|noon|afternoon|evening|night))$/,
        get words() { return new RegExp(HOUR_KEPT.flatMap(k => k.words).join("|"), "i"); },
        never: /drpg-event\b|drpg-action-button|drpg-call-button|\.drpg-panel button|sheet-tabs a|-bar\b|-fill\b|bar-fill|drpg-choice|rest-option|frisk-mode|drpg-hud-button|drpg-gmp-section|(?:input|select|textarea|\]|-text)\)?:focus/i,
        why: "the hour colours the panes, the curtain's accent and the ticker, never a card, a bar or a button"
    }
};

/*
 * WHERE THE HOUR STILL GOES, AND WHY (E48 K2b, 11.11.2026). MEANING.hour's `words`, a family a line. The owner's default
 * on K2's open (11.11): the decorations keep it - the windows' headers, the tables, the countdown tray - and the
 * controls lose it (`never`). The lines marked "the owner's still" are K2's open beyond the three he was asked about.
 */
export const HOUR_KEPT = [
    { name: "panes", words: ["glass-accent", "data-drpg-time", "seam", "curtain", "glass-flat", "glass-band", "#pause"], why: "the panes and their seams, the curtain, its flat and band, the pause screen: D30's own place" },
    { name: "clock", words: ["ticker", "#drpg-hud"], why: "the ticker and the clock's chapter, phase, time and track (its buttons are `never`)" },
    { name: "tiles", words: ["room-tile", "voice"], why: "the room and voice tiles' brushes, pips and frames (the owner, amend [1], 11.10; Q12)" },
    { name: "corner", words: ["launcher", "launch-mini", "foundry-window", "notices-corner", "note-frame", "scene-controls", "sidebar-tabs"], why: "the corner's launchers and frames and Foundry's own chrome (Q12)" },
    { name: "window headers", words: ["window-header", "header-control", "\\.application\\[class\\]", "scrollbar", "#tooltip"], why: "the windows' headers and frames, their scrollbars, the tooltip's edge: decoration (the owner's default, 11.11)" },
    { name: "tables", words: ["table"], why: "the tables' heads and hovered rows: decoration (the owner's default, 11.11)" },
    { name: "countdown tray", words: ["countdown"], why: "the countdown tray's title, frame and tools: decoration (the owner's default, 11.11)" },
    { name: "fields at rest", words: ["window-content", "input", "textarea", "select"], why: "a field's and a checkbox's resting edge and tick (their focus is attention's, `never`)" },
    { name: "notices", words: ["popup", "notice-info", "messenger"], why: "the notices' edge and the messenger's frame and own bubbles" },
    { name: "kit and handbook", words: ["kit-", "handbook"], why: "the kit's row highlight, secret edge and role plate, the handbook's rule and marks" },
    { name: "GM panel", words: ["drpg-gmp-"], why: "the GM panel's Next box and phase stamp, readings of the clock (its section bars are `never`)" },
    { name: "sheet", words: ["\\bh[1-4]\\b", "legend", "section-header", "first-letter", "status-label", "status-value", "drpg-actions", "action-pip", "free-move", "group-count", "ultimate", "items-section", "inventory", "traits", "biography", "duality-badge", "--stamp"], why: "the sheet's headings, pips, free move, counts and stamps: the owner's still (K2's open)" },
    { name: "step", words: ["drpg-step"], why: "`.drpg-step`: the owner's still (K2's open)" },
    { name: "icons", words: ["--kind", "\\bi\\b", "fa-"], why: "an icon's ink and a row's kind inside the surfaces above" }
];

/* A colour literal as "r,g,b" (a hex, an rgb()/rgba() with three numbers, or a bare `-rgb` triple), or null. */
function literalRgb(text) {
    const t = text.trim();
    let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
    if (m) { const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join("") : m[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(","); }
    m = /^(?:rgba?\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+%?\s*)?\)?$/i.exec(t);
    return m ? m.slice(1, 4).map(Number).join(",") : null;
}

/* Every colour literal in a declaration's value: hexes, rgb()/rgba() with plain numbers, and the value itself when it
   is a bare triple. */
function literalsOf(value) {
    const out = [];
    for (const m of value.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^()]*\)/gi)) { const rgb = literalRgb(m[0]); if (rgb) out.push([m[0], rgb]); }
    if (!out.length) { const rgb = literalRgb(value); if (rgb) out.push([value.trim(), rgb]); }
    return out;
}

/**
 * Every read of a meaning token by a rule that does not name its meaning: `sheets` is [[file, text]]; answers
 * `{ read, found }`, `read` the reads of a meaning token seen (allowed or not) and `found` each finding as
 * "file: selector reads --token (meaning)". `meaning` is MEANING or a fixture's.
 */
export function meaningReads(sheets, meaning = MEANING) {
    let read = 0;
    const found = [], allowed = [];
    const rows = Object.entries(meaning);
    const parsed = (sheets ?? []).map(([file, text]) => [file, blocksOf(stripCssComments(text))]);
    /* a meaning token's own literal value (`--drpg-gold: #ffd23f`), so a copy under another name is seen (K2b) */
    const values = new Map();
    for (const [, blocks] of parsed) for (const block of blocks) for (const decl of declarationsOf(block.own ?? "")) {
        const row = rows.find(([, r]) => r.tokens.test(decl.property));
        const rgb = row && literalRgb(decl.value);
        if (rgb && !values.has(rgb)) values.set(rgb, [row[0], decl.property]);
    }
    for (const [file, blocks] of parsed) {
        for (const block of blocks) {
            if (!block.prelude || block.prelude.startsWith("@")) continue;
            const where = [...block.context, block.prelude].join(" ");
            const bare = where.replace(/:not\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "");
            for (const decl of declarationsOf(block.own)) {
                const judge = (name, row, what) => {
                    read++;
                    const named = row.words.test(where) || (decl.property.startsWith("--") && row.words.test(decl.property));
                    if (named && !row.never?.test(bare)) { allowed.push({ meaning: name, where }); return; }
                    found.push(`${file}: ${block.prelude.slice(0, 140)} { ${decl.property} } ${what} (${name}: ${row.why})`);
                };
                for (const m of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
                    for (const [name, row] of rows) if (row.tokens.test(m[1])) judge(name, row, `reads ${m[1]}`);
                }
                if (rows.some(([, r]) => r.tokens.test(decl.property))) continue;
                for (const [lit, rgb] of literalsOf(decl.value)) {
                    const hit = values.get(rgb);
                    if (hit) judge(hit[0], meaning[hit[0]], `holds ${lit}, the value of ${hit[1]}`);
                }
            }
        }
    }
    return { read, found, allowed };
}

/** Each HOUR_KEPT family and the reads of the hour it allows: `[{ name, why, reads }]`, from meaningReads' `allowed`. */
export function hourKept(allowed, kept = HOUR_KEPT) {
    const hours = (allowed ?? []).filter(a => a.meaning === "hour");
    return kept.map(k => ({ name: k.name, why: k.why, reads: hours.filter(a => new RegExp(k.words.join("|"), "i").test(a.where)).length }));
}

/* The meaning check's fixture: six reads, three of them findings - a focus ring in gold, a token that aliases gold under
   a name with no Hope word, and gold's own value copied under another name (K2b: `--drpg-phase-daily` was #ffd23f) -
   beside a Hope star, a Hope-named alias, a Hope rule's literal glow and Evidence's antique, which is not gold. */
export const MEANING_FIXTURE = {
    sheets: [["fixture.css", ":root { --drpg-gold: #ffd23f; --drpg-kit-call-hope: var(--drpg-gold); --drpg-glow: var(--drpg-gold-light); --drpg-phase-x: #FFD23F; }\n"
        + ".drpg-hope-star { color: var(--drpg-gold); text-shadow: 0 0 3px rgba(255, 210, 63, 0.35); }\n.drpg-button:focus-visible { outline: 2px solid rgba(var(--drpg-gold-rgb), 0.8); }\n"
        + ".drpg-truth-bullet { color: var(--drpg-gold-antique); }\n/* .drpg-x { color: var(--drpg-gold); } */"]],
    read: 6,
    found: 3
};

/** The meaning check on its fixture; [] is held. */
export function meaningSelfCheck(of = meaningReads) {
    const got = of(MEANING_FIXTURE.sheets);
    const problems = [];
    if (got.read !== MEANING_FIXTURE.read) problems.push(`the meaning check reads ${got.read} meaning token(s) in its fixture, not ${MEANING_FIXTURE.read}`);
    if (got.found.length !== MEANING_FIXTURE.found) problems.push(`the meaning check finds ${got.found.length} in its fixture, not ${MEANING_FIXTURE.found}: ${JSON.stringify(got.found)}`);
    return problems;
}

/* ================================ the hour's ramp (E48 K2) ================================ */

/** An opaque sRGB [r, g, b] (0-255) as CIELAB [L, a, b] under D65 (the sRGB primaries, the 2-degree observer). */
export function labOf([r, g, b]) {
    const lin = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const xyz = [(0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, 0.2126729 * R + 0.7151522 * G + 0.0721750 * B,
        (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883];
    const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const [fx, fy, fz] = xyz.map(f);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIEDE2000 between two CIELAB colours (Sharma, Wu and Dalal, 2005: kL = kC = kH = 1). `deltaE00Check` holds it to the
 * paper's own test pairs before a reading is trusted.
 */
export function deltaE00(lab1, lab2) {
    const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
    const rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const hue = (b, a) => { if (!b && !a) return 0; const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
    const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p) dhp = Math.abs(h2p - h1p) <= 180 ? h2p - h1p : (h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p + 360);
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
    const Lmp = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
    let hmp = h1p + h2p;
    if (C1p * C2p) hmp = Math.abs(h1p - h2p) <= 180 ? hmp / 2 : (h1p + h2p < 360 ? (hmp + 360) / 2 : (hmp - 360) / 2);
    const T = 1 - 0.17 * Math.cos((hmp - 30) * rad) + 0.24 * Math.cos(2 * hmp * rad) + 0.32 * Math.cos((3 * hmp + 6) * rad) - 0.20 * Math.cos((4 * hmp - 63) * rad);
    const dTheta = 30 * Math.exp(-(((hmp - 275) / 25) ** 2));
    const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
    const Sl = 1 + (0.015 * (Lmp - 50) ** 2) / Math.sqrt(20 + (Lmp - 50) ** 2), Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;
    return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/* Sharma, Wu and Dalal's test data, pairs 1, 7, 17, 25 and 34 (their table 1, to four places), and sRGB's two ends. */
export const DELTA_E00_FIXTURE = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [56, -27, -3], 31.9030],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381]
];

/**
 * The hours against the meanings (tools/contrast-pairs.json `hours`): `{ rows, problems }`, a row a pair -
 * `{ hour, meaning, de }` with `de` CIEDE2000 to two places, or null where a token does not resolve in Node - and a
 * problem for each pair under `threshold`, each token that does not resolve, and a spec that names no hour or no meaning.
 */
export function hourDistances(spec, tokens) {
    const problems = [], rows = [];
    const theme = tokens?.[spec?.theme];
    if (!theme) return { rows, problems: [`hours: theme ${spec?.theme} is not one this tool knows`] };
    const hours = spec.hours ?? [], meanings = Object.entries(spec.meanings ?? {});
    if (!hours.length || !meanings.length || !(spec.threshold > 0)) problems.push("hours: the spec names no hour, no meaning or no threshold");
    const lab = name => {
        const { colour, why } = resolveColour(`var(${name})`, theme);
        if (!colour || colour[3] < 1) { problems.push(`hours: ${name} does not resolve to an opaque colour (${why ?? "alpha"})`); return null; }
        return labOf(colour);
    };
    for (const hour of hours) {
        const h = lab(hour);
        for (const [meaning, token] of meanings) {
            const m = lab(token);
            const de = h && m ? Math.round(deltaE00(h, m) * 100) / 100 : null;
            rows.push({ hour, meaning, de });
            if (de !== null && de < spec.threshold) problems.push(`hours: ${hour} is ${de.toFixed(2)} from ${meaning} (${token}), under ${spec.threshold}`);
        }
    }
    return { rows, problems };
}

/** deltaE00 and labOf on their fixture; [] is held. */
export function deltaE00Check(de = deltaE00, lab = labOf) {
    const problems = [];
    for (const [x, y, want] of DELTA_E00_FIXTURE) {
        const got = de(x, y);
        if (Math.abs(got - want) > 0.0001) problems.push(`CIEDE2000 of ${JSON.stringify(x)} and ${JSON.stringify(y)} reads ${got.toFixed(4)}, not ${want}`);
    }
    const ends = de(lab([0, 0, 0]), lab([255, 255, 255]));
    if (Math.abs(ends - 100) > 0.01) problems.push(`CIEDE2000 of black and white reads ${ends.toFixed(2)}, not 100`);
    return problems;
}

/* ================================ contrast (E44 C1c) ================================ */

/**
 * The tokens a theme declares, read from the sheets' text: every custom property of a top-level rule whose selector
 * is `:root` or the theme's body class (`body.drpg-theme-stained-glass`, `body.drpg-theme-monokuma-legacy`), in the
 * sheets' order, a later one over an earlier one. A rule under `@media`, `@supports` or `@container`, and a token
 * declared on any other element, are not read: they hang on a layout or on an element, which is the style sweep's.
 * `sheets` is [[file, text]]; answers { theme: Map(name -> value) }.
 */
export const THEME_CLASSES = { "stained-glass": "drpg-theme-stained-glass", "monokuma-legacy": "drpg-theme-monokuma-legacy" };

export function themeTokens(sheets) {
    const out = Object.fromEntries(Object.keys(THEME_CLASSES).map(theme => [theme, new Map()]));
    for (const [, text] of sheets) {
        for (const block of blocksOf(stripCssComments(text))) {
            if (block.context.length) continue;
            const selectors = block.prelude.split(",").map(s => s.trim());
            for (const [theme, cls] of Object.entries(THEME_CLASSES)) {
                if (!selectors.some(s => s === ":root" || s === `body.${cls}`)) continue;
                for (const decl of declarationsOf(block.own)) if (decl.property.startsWith("--")) out[theme].set(decl.property, decl.value);
            }
        }
    }
    return out;
}

/**
 * A token's value as a colour `[r, g, b, a]` (0-255, alpha 0-1), or null with the reason: a hex, `rgb()` / `rgba()`
 * (numbers, or a `var()` of a `-rgb` token that holds them), or a `var()` of a token that resolves; a value Node
 * cannot resolve - `color-mix()`, `light-dark()`, a keyword, a token not declared on :root or the theme - is null.
 */
export function resolveColour(value, tokens, seen = new Set()) {
    let v = String(value ?? "").trim();
    const whole = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)$/);
    if (whole) {
        if (seen.has(whole[1])) return { colour: null, why: `${whole[1]} refers to itself` };
        if (!tokens.has(whole[1])) return whole[2] ? resolveColour(whole[2], tokens, seen) : { colour: null, why: `${whole[1]} is not declared on :root or the theme's body` };
        return resolveColour(tokens.get(whole[1]), tokens, new Set([...seen, whole[1]]));
    }
    v = v.replace(/var\(\s*(--[\w-]+)\s*\)/g, (m, name) => (tokens.has(name) && !seen.has(name) ? tokens.get(name) : m));
    const hex = v.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
        let h = hex[1];
        if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join("");
        if (h.length !== 6 && h.length !== 8) return { colour: null, why: `${value} is no hex colour` };
        const n = i => parseInt(h.slice(i, i + 2), 16);
        return { colour: [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1], why: null };
    }
    const fn = v.match(/^rgba?\(([^()]*)\)$/i);
    if (fn) {
        const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
        const nums = parts.map(p => (p.endsWith("%") ? Number(p.slice(0, -1)) / 100 : Number(p)));
        if ((nums.length === 3 || nums.length === 4) && nums.every(Number.isFinite)) {
            return { colour: [nums[0], nums[1], nums[2], nums.length === 4 ? nums[3] : 1], why: null };
        }
    }
    return { colour: null, why: `${String(value).slice(0, 60)} does not resolve in Node` };
}

/** WCAG 2's relative luminance of an opaque [r, g, b]. */
export function luminance([r, g, b]) {
    const lin = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2's contrast ratio of two opaque colours, 1 to 21. */
export function contrastRatio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** The AA minimum: 4.5 for small text, 3 for large. */
export const AA = { small: 4.5, large: 3 };

/**
 * Every pair of tools/contrast-pairs.json in its theme: `{ id, ratio, need, state, why }` with `state` "ok" (AA met),
 * "known" (below AA, and the file writes that ratio as `known`: E48's), "low" (below AA, not known - red), "stale"
 * (written `known`, and now meets AA or reads another ratio - red: take it out or write the new reading) or "unmeasured"
 * (a value Node cannot resolve - the style sweep's in Chromium). A text with alpha is laid on its ground; a ground with
 * alpha is unmeasured (what shows through is the page's).
 */
export function contrastOf(pairs, tokens) {
    return (pairs ?? []).map(pair => {
        const theme = tokens[pair.theme];
        const need = AA[pair.size];
        if (!theme || !need) return { id: pair.id, ratio: null, need: need ?? null, state: "low", why: `theme ${pair.theme} or size ${pair.size} is not one this tool knows` };
        const fg = resolveColour(`var(${pair.text})`, theme), bg = resolveColour(`var(${pair.on})`, theme);
        if (!fg.colour || !bg.colour) return { id: pair.id, ratio: null, need, state: "unmeasured", why: fg.why ?? bg.why };
        if (bg.colour[3] < 1) return { id: pair.id, ratio: null, need, state: "unmeasured", why: `${pair.on} has alpha ${bg.colour[3]}: what shows through is the page's` };
        const a = fg.colour[3];
        const laid = fg.colour.slice(0, 3).map((c, i) => c * a + bg.colour[i] * (1 - a));
        const ratio = Math.round(contrastRatio(laid, bg.colour.slice(0, 3)) * 100) / 100;
        const reading = ratio.toFixed(2);
        if (pair.known !== undefined) {
            if (ratio >= need) return { id: pair.id, ratio, need, state: "stale", why: `written known "${pair.known}", and it reads ${reading}, AA met: take known out` };
            if (String(pair.known) !== reading) return { id: pair.id, ratio, need, state: "stale", why: `written known "${pair.known}", and it reads ${reading}` };
            return { id: pair.id, ratio, need, state: "known", why: null };
        }
        return { id: pair.id, ratio, need, state: ratio >= need ? "ok" : "low", why: ratio >= need ? null : `${reading} under ${need}` };
    });
}

/**
 * The contrast tool's own cases, each with its answer known: WCAG's two ends (black on white 21, a colour on itself
 * 1), and a fixture theme whose pairs read ok, known, low, stale and unmeasured - a pair below AA that the file does
 * not write as known must read "low", which is what makes the tool red; a known ratio that moved, "stale".
 */
export const CONTRAST_FIXTURE = {
    sheets: [["fixture.css", ":root { --fx-ink: #000000; --fx-bone: #ffffff; --fx-grey: #777777; --fx-mix: color-mix(in srgb, red, blue); --fx-veil: rgba(0, 0, 0, 0.5); --fx-bone-rgb: 255, 255, 255; }\n"
        + "body.drpg-theme-monokuma-legacy { --fx-text: rgba(var(--fx-bone-rgb), 0.9); --fx-grey: #808080; }"]],
    pairs: [
        { id: "white-on-black", theme: "stained-glass", text: "--fx-bone", on: "--fx-ink", size: "small" },
        { id: "grey-small", theme: "stained-glass", text: "--fx-grey", on: "--fx-bone", size: "small" },
        { id: "grey-known", theme: "monokuma-legacy", text: "--fx-grey", on: "--fx-bone", size: "small", known: "3.95" },
        { id: "grey-stale", theme: "monokuma-legacy", text: "--fx-grey", on: "--fx-bone", size: "small", known: "3.00" },
        { id: "grey-large", theme: "monokuma-legacy", text: "--fx-grey", on: "--fx-bone", size: "large" },
        { id: "alpha-text", theme: "monokuma-legacy", text: "--fx-text", on: "--fx-ink", size: "small" },
        { id: "mixed", theme: "stained-glass", text: "--fx-mix", on: "--fx-ink", size: "small" },
        { id: "veiled-ground", theme: "stained-glass", text: "--fx-bone", on: "--fx-veil", size: "small" }
    ],
    want: { "white-on-black": "ok 21.00", "grey-small": "low 4.48", "grey-known": "known 3.95", "grey-stale": "stale 3.95", "grey-large": "ok 3.95",
        "alpha-text": "ok 16.75", mixed: "unmeasured", "veiled-ground": "unmeasured" }
};

/** The contrast tool on its own cases; [] is held. */
export function contrastSelfCheck(of = contrastOf) {
    const problems = [];
    const ends = [contrastRatio([0, 0, 0], [255, 255, 255]), contrastRatio([179, 50, 74], [179, 50, 74])].map(r => r.toFixed(2));
    if (ends.join() !== "21.00,1.00") problems.push(`WCAG's ends read ${ends.join(" and ")}, not 21.00 and 1.00`);
    const got = Object.fromEntries(of(CONTRAST_FIXTURE.pairs, themeTokens(CONTRAST_FIXTURE.sheets))
        .map(r => [r.id, r.ratio === null ? r.state : `${r.state} ${r.ratio.toFixed(2)}`]));
    for (const [id, want] of Object.entries(CONTRAST_FIXTURE.want)) if (got[id] !== want) problems.push(`the fixture's ${id} reads ${got[id]}, not ${want}`);
    return problems;
}

/*
 * THE KIT'S SHEET (E44 C3a, 04.11.2026; E44-11): what styles/components.css promises, read off its text. R1322 holds
 * the served file to it and shows it each fault planted; the Node part `css` holds the same file's `!important` and
 * literals to their zero budget.
 */

/* The tokens ui-kit.mjs sets on a tab bar as it fits it (`fitKitTabs`): read with a fallback or under the attribute
   the fit writes, never declared in the sheet. And the focus ring each role's rule sets for its button. */
export const KIT_SET_TOKENS = ["--drpg-kit-tab-fit-size", "--drpg-kit-tab-fit-ls", "--drpg-kit-tab-fit-pad", "--drpg-kit-tab-n", "--drpg-kit-ring"];
/* The colour properties a kit rule may only give through a `--drpg-kit-*` token (or a keyword). */
const KIT_COLOUR_PROPS = /^(color|background|background-color|border|border-(top|right|bottom|left)|border(-(top|right|bottom|left))?-color|outline|outline-color|box-shadow)$/;
const KIT_KEYWORDS = /^(transparent|currentcolor|inherit|none|0|initial|unset)$/i;
const KIT_WIDTH_PROPS = /^(width|min-width|max-width|flex-basis|inline-size|min-inline-size)$/;

/**
 * The problems of the kit's sheet, each a sentence naming the rule; [] when it holds:
 *   no `!important`, no colour literal outside a token;
 *   the Legacy tokens on `body` and the glass's on `body.drpg-theme-stained-glass`, every token the glass declares
 *   declared for Legacy too (a component with no Legacy variant), every token read declared (or set by ui-kit.mjs);
 *   every colour a rule gives taken from a `--drpg-kit-*` token or a keyword; a rule written for the glass alone
 *   stands beside the same rule for both themes (or for Legacy alone);
 *   every `font-size` a `--drpg-kit-*-size` token, each such token declared in both themes, floored at 11 px under
 *   Legacy (`max(11px, ...)`) and at the glass's floor under the glass (`max(var(--drpg-sg-floor), ...)`);
 *   no width above 390 px (the 26.09 amend);
 *   an uppercase box at `line-height: 1.3` or more - in its rule or in that rule's Legacy variant - and never
 *   `overflow: hidden` (docs/design/typography.md).
 * The sheet's section "The A8 surfaces" (E44 C6: the tiles, the launchers, "Who you hear", the Foundry tools frames,
 * moved there from the old sheets with no change of look) is held to the sheet's own rules - no `!important`, no colour
 * literal outside a token, no width above 390 px - and not to a kit component's look, which those surfaces do not
 * take: R1333 holds their cascade against C5's tree instead. Everything above its banner is the kit's.
 */
export const A8_BANNER = "THE A8 SURFACES (E44 C6";

export function kitSheetProblems(text) {
    const problems = [];
    const css = stripCssComments(text);
    if (importantCount(css).count) problems.push(`${importantCount(css).count} !important`);
    for (const found of colourLiterals(css).found) problems.push(`a colour literal outside a token: ${found}`);
    const raw = String(text ?? ""), banner = raw.indexOf(A8_BANNER);
    const kitPart = banner < 0 ? css : stripCssComments(raw.slice(0, raw.lastIndexOf("/*", banner)));
    const widthsOf = (prelude, decls) => {
        for (const d of decls) {
            const p = d.property.toLowerCase(), v = d.value.trim();
            if (!KIT_WIDTH_PROPS.test(p)) continue;
            for (const m of v.matchAll(/(\d+(?:\.\d+)?)(px|rem|em)\b/g)) {
                const px = Number(m[1]) * (m[2] === "px" ? 1 : 16);
                if (px > 390) problems.push(`${prelude} sets ${p} to ${m[0]}, above 390 px`);
            }
        }
    };
    if (banner >= 0) {
        for (const b of blocksOf(stripCssComments(raw.slice(raw.lastIndexOf("/*", banner))))) {
            if (b.prelude && !b.prelude.startsWith("@")) widthsOf(b.prelude, declarationsOf(b.own));
        }
    }
    const blocks = blocksOf(kitPart).filter(b => b.prelude && !b.prelude.startsWith("@"));
    const tokensOf = prelude => new Map(blocks.filter(b => !b.context.length && b.prelude === prelude)
        .flatMap(b => declarationsOf(b.own)).filter(d => d.property.startsWith("--")).map(d => [d.property, d.value]));
    const legacy = tokensOf("body"), glass = tokensOf("body.drpg-theme-stained-glass");
    if (!legacy.size) problems.push("no Legacy token block (`body { --drpg-kit-...: ... }`)");
    if (!glass.size) problems.push("no Stained Glass token block (`body.drpg-theme-stained-glass { ... }`)");
    for (const name of glass.keys()) if (!legacy.has(name)) problems.push(`${name} is declared for the glass and not for Legacy`);
    const declared = new Set([...legacy.keys(), ...glass.keys(), ...KIT_SET_TOKENS]);
    const reads = new Set([...css.matchAll(/var\(\s*(--drpg-kit-[\w-]+)/g)].map(m => m[1]));
    for (const name of reads) if (!declared.has(name)) problems.push(`${name} is read and never declared`);
    const strip = sel => sel.replace(/\bbody(?:\.drpg-theme-stained-glass|\.drpg-theme-monokuma-legacy|:not\(\.drpg-theme-stained-glass\))?\s*/g, "").replace(/\s+/g, " ").trim();
    const both = new Set(blocks.filter(b => !/\.drpg-theme-stained-glass(?![^(]*\))/.test(b.prelude.replace(/:not\([^)]*\)/g, ""))).map(b => strip(b.prelude)));
    const lineHeights = new Map();
    for (const b of blocks) for (const d of declarationsOf(b.own)) if (d.property === "line-height") lineHeights.set(strip(b.prelude), Number(d.value));
    for (const b of blocks) {
        const decls = declarationsOf(b.own);
        const tokenBlock = !b.context.length && (b.prelude === "body" || b.prelude === "body.drpg-theme-stained-glass");
        if (tokenBlock) {
            for (const d of decls.filter(x => /^--drpg-kit-[\w-]*-size$/.test(x.property))) {
                if (b.prelude === "body" && !/^max\(\s*11px\s*,/.test(d.value)) problems.push(`${d.property} under Legacy is not floored at 11 px: ${d.value}`);
                if (b.prelude !== "body" && !/^max\(\s*var\(--drpg-sg-floor\)\s*,/.test(d.value)) problems.push(`${d.property} under the glass is not floored at --drpg-sg-floor: ${d.value}`);
            }
            continue;
        }
        widthsOf(b.prelude, decls);
        const glassOnly = /\.drpg-theme-stained-glass/.test(b.prelude.replace(/:not\([^)]*\)/g, ""));
        if (glassOnly && !both.has(strip(b.prelude))) problems.push(`${b.prelude} is written for the glass with no rule for Legacy beside it`);
        let upper = false, lineHeight = null, hidden = false;
        for (const d of decls) {
            const p = d.property.toLowerCase(), v = d.value.trim();
            if (p.startsWith("--")) continue;
            if (KIT_COLOUR_PROPS.test(p) && !KIT_KEYWORDS.test(v) && !/var\(--drpg-kit-/.test(v) && !/^\d+(\.\d+)?(px|em|rem)?(\s+(solid|dashed|none))?$/.test(v)) {
                problems.push(`${b.prelude} gives ${p} without a kit token: ${v}`);
            }
            if (p === "font-size" && !/^var\(--drpg-kit-[\w-]*size\b/.test(v)) problems.push(`${b.prelude} sets font-size without a kit size token: ${v}`);
            if (p === "text-transform" && v === "uppercase") upper = true;
            if (p === "line-height") lineHeight = Number(v);
            if (/^overflow(-[xy])?$/.test(p) && v === "hidden") hidden = true;
        }
        // The line may stand in the same rule's Legacy variant: under the glass the glass's button brush draws it (1.35).
        const variant = lineHeight === null ? lineHeights.get(strip(b.prelude)) ?? null : lineHeight;
        if (upper && !(variant >= 1.3)) problems.push(`${b.prelude} is uppercase at line-height ${variant ?? "unset"}, under 1.3`);
        if (upper && hidden) problems.push(`${b.prelude} is uppercase with overflow: hidden`);
    }
    return problems;
}
