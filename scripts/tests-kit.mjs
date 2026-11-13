/**
 * Danganronpa RPG - the suite's shared tools (E30, audit S17-02).
 * ---------------------------------------------------------------------------
 * What more than one tier uses: the answers a test can give (it returns, it
 * throws a Failure, it throws a Skipped) and how the runner judges them
 * (runOne: what it measured, whether it is red on purpose until a named stage),
 * the environment probes, the source readers, the world readers the runner
 * compares before and after tiers 0 and 1, and cast(). It writes nothing to the
 * world and imports no tier file - of the suite's files only tests-lint.mjs,
 * tests-flows.mjs and tests-text.mjs (E65), which import nothing - so a tier file
 * that imports it imports no other tier. What the tiers are: the header of tests.mjs.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { studentActors, isMonokuma } from "./monokuma.mjs";
import { narrowScreen } from "./settings.mjs";
import { allVaults } from "./vault.mjs";
import { isPrimaryGm } from "./utils.mjs";
import {
    lf, stripComments, lineAt, blankComments, blankLiterals, callArgs, testsIn, bareCuts, vacuousAsserts, needsArgs, redMarkers, vacuousChecks,
    storeKeyAccess, GM_STORE_PENDING, FIXTURES as LINT_FIXTURES, TEST_FILE
} from "./tests-lint.mjs";
import { FLOWS, FLOW_EXEMPT } from "./tests-flows.mjs";
/* The text lint (E65 C1): handed on as tests-lint.mjs's names are, so R1058 and R1059 run the functions
   `node tools/check.mjs text` runs, and the crawl reaches the file through this import. C2 adds T3's and T6's
   baselines and their matcher, C3 T14's two readers for R1060. */
import {
    flatLang, DETECTORS as TEXT_DETECTORS, MODES as TEXT_MODES, FIXTURES as TEXT_FIXTURES, selfCheck as textSelfCheck, itemOf as textItem,
    BASELINES as TEXT_BASELINES, againstBaseline as textAgainstBaseline, staleRow as textStaleRow,
    tableWordProblems as textTableWords, legacyListsFrom as textLegacyLists
} from "./tests-text.mjs";
/* The CSS lint (E44 C1b): handed on the same way, so R2, R1310 and R1311 run the functions `node tools/check.mjs css`
   runs (R2's dead-class detector lives there since), and the crawl reaches the file through this import; C1c adds the
   contrast's four for R1312, the functions `node tools/check.mjs contrast` runs; C3a the kit sheet's reader for R1322. */
import {
    deadClasses as cssDeadClasses, selfCheck as cssSelfCheck, lintCounts as cssLintCounts, budgetProblems as cssBudgetProblems,
    DETECTORS as CSS_DETECTORS, FIXTURES as CSS_FIXTURES,
    themeTokens as cssThemeTokens, contrastOf as cssContrastOf, contrastRatio as cssContrastRatio, contrastSelfCheck as cssContrastSelfCheck,
    kitSheetProblems as cssKitSheetProblems, meaningReads as cssMeaningReads, meaningSelfCheck as cssMeaningSelfCheck, hourKept as cssHourKept, forcedBlockProblems as cssForcedBlockProblems, FORCED_STATES as CSS_FORCED_STATES,
    hourDistances as cssHourDistances, deltaE00Check as cssDeltaE00Check
} from "./tests-css.mjs";

/* ==========================================================================
 * HARNESS
 * ========================================================================== */

class Failure extends Error {}

/**
 * A kit precondition that did not hold: the code under test was not where the
 * test looked (a marker gone from the source, a file that did not load). A
 * FAIL like any other, but never a measurement - see `must` - and never an
 * expected red: a test marked red until a later stage has to be red because
 * what it measures is wrong, not because it could not reach it.
 */
class Precondition extends Failure {}

/**
 * The test broke the contract itself: needs() handed something that is not a probe,
 * or a world probe asked after the test wrote to the world. Neither is a measurement
 * nor a precondition - the test is wrong - so it FAILs whatever expectedRed says. As a
 * plain Failure it was taken for the promised red: on a copy of this kit, a test
 * marked expectedRed("E90") that handed needs() `true`, and one that asked a world
 * probe after a write, both came out "red" (E30 review, 25.09.2026).
 */
class ContractBreach extends Failure {}

/*
 * A THIRD ANSWER, BECAUSE "FAILED" WAS BEING USED FOR TWO DIFFERENT THINGS.
 *
 * Some of what this suite asks cannot be answered without a real browser: a
 * window's measured width needs layout, the curtain's partition needs a canvas
 * with a width, "the theme speaks two faces" needs the fonts to have loaded, an
 * objection's track needs audio. Run in the headless harness those tests failed,
 * and failing was the honest choice at the time - a test that measures nothing
 * and reports success is worse than no test.
 *
 * It had a cost that took a year to come due. Twelve permanent reds is a number
 * people learn rather than read, and a thirteenth arrives without anybody
 * noticing: it happened here on 14.09, when a renamed local variable tripped R21
 * and the count went to thirteen with nothing else to say so. The bucket had also
 * never been re-read, and the reason written on it - "these need a real canvas" -
 * turned out not to fit every test in it.
 *
 * So a test may now say WHY it cannot answer, and the runner counts that
 * separately. `skipped` is not a softer `failed`: it may only be thrown for a
 * fact about the ENVIRONMENT that the test itself has checked - no canvas, no
 * fonts, no audio - never for a result that came out wrong, and never for one
 * that did not come out at all. `needs` is the only way to raise one, and it
 * takes the check and the reason together so neither can be left out.
 */
class Skipped extends Error {
    constructor(message, probe = null) { super(message); this.probe = probe; }
}

/*
 * THE TEST NOW RUNNING, AND WHAT IT HAS MEASURED (E30, 24.09.2026; audit S17-03).
 *
 * `stackShapes` was written, the self-check reported zero failures, and the
 * reason was that the block list it checked was empty: a loop over nothing
 * asserts nothing and returns. So every `ok` and `equal` now counts into the
 * running test, and `judge` fails a test that returned without one having run,
 * or that caught one of its own failures and carried on. The runner awaits each
 * test before the next, so one slot is enough; it is null between tests, so a
 * callback that outlives its test counts for nobody.
 */
let current = null;

function ok(condition, message) {
    if (current) current.assertions++;
    if (!condition) {
        if (current) current.failures.push(String(message));
        throw new Failure(message);
    }
}

function equal(actual, expected, message) {
    if (current) current.assertions++;
    if (actual !== expected) {
        const text = `${message} - expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`;
        if (current) current.failures.push(text);
        throw new Failure(text);
    }
}

/**
 * What a test needs in order to measure at all - a marker in the source, a file
 * that loaded - checked, and NOT counted as a measurement. A test that only cuts
 * source with `bodyOf` has read something and asserted nothing, and the counter
 * has to be able to tell. A failed `must` throws a Precondition.
 */
function must(condition, message) {
    if (!condition) {
        if (current) current.failures.push(String(message));
        throw new Precondition(message);
    }
}

/**
 * Stand the test down, with the reason, when the environment cannot answer it.
 *
 * ONLY A PROBE (E30, 24.09.2026; audit S17-03, S14-24). `needs(p, why)` takes an
 * `env.*` probe (this browser, this Foundry) or a `world.*` probe (the world as
 * found) from this file, and nothing else. It used to take any condition, and a
 * dozen tests had drifted into handing it the module's own answer - `needs(app)`
 * after opening the roll window - so the day the window stopped opening, the one
 * test written to notice said "skip". Anything that is not a probe FAILs, however
 * truthy, on every run and not only on the day it is false. `why` says what this
 * test wanted it for; the probe says what was missing.
 */
function needs(p, why = "") {
    if (!p || p[PROBE] !== true) {
        const text = `needs() was handed ${describe(p)}, not an env.* or world.* probe - a skip may only be a fact `
            + "the suite asked of the environment itself (the test author contract)";
        if (current) current.failures.push(text);
        throw new ContractBreach(text);
    }
    if (current) current.probes.push(p.name);
    if (!p.holds) throw new Skipped(`[${p.name}] ${p.fact}${why ? ` - ${why}` : ""}`, p.name);
}

/** A value in a few words, for a message that says what something was handed. */
function describe(value) {
    if (value === null || value === undefined) return String(value);
    if (typeof value === "function") return `a function (${value.name || "anonymous"})`;
    if (typeof value !== "object") return `${typeof value} ${String(JSON.stringify(value)).slice(0, 40)}`;
    const name = value.constructor?.name ?? "Object";
    let body = "";
    try { body = JSON.stringify(value)?.slice(0, 60) ?? ""; } catch { /* a cycle: the name is enough */ }
    return `${/^[AEIOU]/.test(name) ? "an" : "a"} ${name}${body && body !== "{}" ? ` ${body}` : ""}`;
}

/*
 * RED ON PURPOSE, UNTIL A NAMED STAGE (E30, 24.09.2026; audit S17-03).
 *
 * The 1.3.0 plan writes tests before the fix they measure: a stage adds the test
 * that says what is wrong, and a later one makes it pass. Such a test is marked
 * with a third element, `[name, fn, expectedRed("E07", why)]`, so the runner can
 * read every marker without running the test. It is green while it fails on an
 * assertion, FAILs as "unexpectedly passed" when it passes, and FAILs once
 * tools/stages.json says its stage has shipped - so a stage cannot ship with the
 * red it was meant to turn green still counted as fine. `failing`, when given, is
 * a piece of the failure message the red has to carry: a test that starts failing
 * somewhere the piece does not appear FAILs as "red, but not where expectedRed
 * says". A piece guards only what it spells out - a message that carries it and
 * more stays red - so the invariant grid heads its message with the whole
 * bracketed list a case breaks and names that list (tests-grid.mjs, WHAT A RED
 * CASE SAYS; E32+E07 fix r1-G5, review C-m4). It never throws at
 * load: a throw here would take the whole tier file down, so a malformed marker
 * FAILs its own test instead (`markerProblem`).
 */
const RED = Symbol("drpg.suite.expectedRed");

function expectedRed(stage, why, { failing = null } = {}) {
    return Object.freeze({ [RED]: true, stage: String(stage ?? ""), why: String(why ?? "").trim(), failing });
}

/** Numeric, part by part: 1.2.100 is past 1.2.99 (tools/stages.mjs compares the same way). */
function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d) return Math.sign(d);
    }
    return 0;
}

/* Whether this install serves tools/, as the run's own fetch of the stage ledger found it (`env.tools`, E52 C6): the
   repository and the harness do, an installed module does not (tools/ is export-ignored from the zip). */
let toolsServed = false;

/**
 * tools/stages.json as this run reads it: `Map<id, row>`, each row with `done` -
 * THE rule of tools/stages.mjs: a version, and this module's version at or past
 * it. Fetched once per run by the runner. `null` when the file is not served,
 * which is every installed module (tools/ is export-ignored from the zip): a
 * marker's stage is then checked at release, not here, and the run says so.
 */
async function stageLedger() {
    let doc = null;
    try {
        const res = await fetch(`/modules/${MODULE_ID}/tools/stages.json`, { cache: "no-cache" });
        toolsServed = Boolean(res.ok);
        if (res.ok) doc = await res.json();
    } catch { toolsServed = false; /* not served: the answer below says so */ }
    if (!Array.isArray(doc?.stages)) return null;
    const version = game.modules.get(MODULE_ID)?.version ?? "0";
    return new Map(doc.stages.map(row => [row.id, {
        ...row, done: Boolean(row.version) && compareVersions(version, row.version) >= 0
    }]));
}

/**
 * THE MACRO API'S SURFACE, HELD TO ITS FILE (E52 C6, 30.10.2026; S17-51, E52-21; D25 as E52 reads it: a key leaves
 * `game.drpg` only after a release as an alias). What is wrong between the live object and tools/api-surface.json, as
 * sentences, none when they agree. `live` maps each key of `game.drpg` to `apiKind` of its value; `same` lists the
 * pairs of keys holding one value before the actor wrapper (api.mjs `DrpgApi`); `surface` is the file; `version`
 * this module's; `stages` tools/stages.json's rows by id. R1560 runs it on a planted fixture before the real surface.
 */
const SURFACE_VERSION = /^\d+\.\d+\.\d+$/;
function apiKind(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}
function apiSurfaceProblems({ live = {}, same = [], surface = null, version = "0", stages = new Map() } = {}) {
    const out = [];
    const keys = surface?.keys ?? {}, aliases = surface?.aliases ?? {}, removed = surface?.removed ?? {};
    const has = (table, name) => Object.prototype.hasOwnProperty.call(table, name);
    for (const [name, kind] of Object.entries(live)) {
        if (has(keys, name)) {
            if (keys[name] !== kind) out.push(`${name} is a ${kind} on game.drpg and a ${keys[name]} in the file`);
        } else if (!has(aliases, name)) out.push(`${name} is on game.drpg and in neither keys nor aliases`);
        if (has(removed, name)) out.push(`${name} is in removed and still on game.drpg`);
    }
    for (const name of Object.keys(keys)) {
        if (!has(live, name)) out.push(`${name} is gone from game.drpg with no alias row`);
    }
    const since = (name, row) => {
        const stage = stages.get(row?.since);
        if (!stage && !SURFACE_VERSION.test(String(row?.since ?? ""))) out.push(`${name}'s since "${row?.since}" is neither a stage of tools/stages.json nor a release`);
        const from = stage ? (stage.version ?? stage.planned) : row?.since;
        if (row?.keepUntil !== null && !SURFACE_VERSION.test(String(row?.keepUntil ?? ""))) out.push(`${name}'s keepUntil is neither a release nor null`);
        else if (row?.keepUntil && SURFACE_VERSION.test(String(from ?? "")) && compareVersions(row.keepUntil, from) <= 0) {
            out.push(`${name} is kept until ${row.keepUntil}, not past ${from}, the release it became an alias in`);
        }
    };
    for (const [name, row] of Object.entries(aliases)) {
        if (has(keys, name)) out.push(`${name} is both a key and an alias`);
        if (!has(live, name)) out.push(`the alias ${name} is gone from game.drpg and not in removed`);
        if (!has(keys, row?.target)) out.push(`the alias ${name} points at ${row?.target}, which is no key of the file`);
        since(name, row);
    }
    for (const [name, row] of Object.entries(removed)) {
        if (has(keys, name) || has(aliases, name)) out.push(`${name} is in removed and still a key or an alias`);
        if (!has(keys, row?.target)) out.push(`the removed ${name} names ${row?.target}, which is no key of the file`);
        since(name, row);
        if (!row?.keepUntil) out.push(`${name} was removed with no keepUntil`);
        else if (compareVersions(version, row.keepUntil) < 0) out.push(`${name} was removed at ${version}, before ${row.keepUntil}, the release its alias was kept until`);
    }
    for (const [a, b] of same) {
        if (aliases[a]?.target !== b && aliases[b]?.target !== a) out.push(`${a} and ${b} are one function on game.drpg and neither is the other's alias in the file`);
    }
    return out;
}

/** What is wrong with a red marker before anything is run, or null. */
function markerProblem(red, ledger) {
    if (red?.[RED] !== true || !/^E\d{2,3}$/.test(red.stage ?? "") || !red.why) {
        return `expectedRed is malformed (a stage "E" and two digits, and a reason): ${describe(red)}`;
    }
    if (!ledger) return null;
    const row = ledger.get(red.stage);
    if (!row) return `expectedRed names "${red.stage}", which tools/stages.json does not know`;
    if (row.done) {
        return `expected red until ${red.stage}, which shipped in ${row.version} on ${row.shipped} - the marker is still here: ${red.why}`;
    }
    return null;
}

/** What is wrong with a DUMP_RULES row's `until` or `why`, or null: the ledger holds it as it holds a red marker. */
function untilProblem(rule, ledger) {
    if (!String(rule?.why ?? "").trim()) return "a dump rule with no reason";
    const until = String(rule?.until ?? "");
    if (until === "never" || until === "1.3.x (D27)") return null;
    if (!/^E\d{2,3}$/.test(until)) return `until "${until}" is not a stage, "1.3.x (D27)" or "never"`;
    if (!ledger) return null;
    const row = ledger.get(until);
    if (!row) return `until names "${until}", which tools/stages.json does not know`;
    if (row.done) return `until ${until}, which shipped in ${row.version} on ${row.shipped} - the rule is still here`;
    return null;
}

/**
 * Run one test, `[name, fn, red?]`, and say what it came to:
 * `{ tier, name, outcome: "pass"|"fail"|"skip"|"red", message?, probe?, failedAt?, assertions }`.
 * The running-test slot is saved and put back, so the kit's self-tests can run a
 * test inside a test.
 */
async function runOne([name, fn, red = null], { tier, ledger = null } = {}) {
    const ctx = { name, tier, assertions: 0, failures: [], probes: [], wrote: null };
    const outer = current;
    current = ctx;
    let err = null;
    try { await fn(); } catch (e) { err = e; } finally { current = outer; }
    return { tier, name, assertions: ctx.assertions, ...judge(ctx, err, red, ledger) };
}

/* THE ORDER MATTERS. A stale or malformed marker fails whatever the test did; a
   skip is a skip; a breach of the contract fails whatever the marker says; a
   failure the test caught fails it; a red is green only when an assertion failed -
   a precondition, a crash or nothing measured is a FAIL. */
function judge(ctx, err, red, ledger) {
    const fail = message => ({ outcome: "fail", message });
    if (red) {
        const stale = markerProblem(red, ledger);
        if (stale) return fail(stale);
    }
    if (err instanceof Skipped) return { outcome: "skip", message: err.message, probe: err.probe };
    if (err instanceof ContractBreach) return fail(err.message);
    if (!err && ctx.failures.length) return fail(`an assertion failed and the test caught it: ${ctx.failures[0]}`);
    if (red) {
        if (err instanceof Failure && !(err instanceof Precondition) && (!red.failing || err.message.includes(red.failing))) {
            const planned = ledger?.get(red.stage)?.planned;
            return { outcome: "red", message: `until ${red.stage}${planned ? ` (planned ${planned})` : ""}: ${red.why}`, failedAt: err.message };
        }
        if (err instanceof Precondition) return fail(`red for the wrong reason - the test could not reach what it measures: ${err.message}`);
        if (err) return fail(err instanceof Failure ? `red, but not where expectedRed says: ${err.message}` : `threw: ${err?.message ?? err}`);
        if (!ctx.assertions) return fail("measured nothing: expected red, and no ok() or equal() ran");
        return fail(`unexpectedly passed (${ctx.assertions} assertions held) - expectedRed("${red.stage}") can come off: ${red.why}`);
    }
    if (err) return fail(err instanceof Failure ? err.message : `threw: ${err?.message ?? err}`);
    if (!ctx.assertions) return fail("measured nothing: no ok() or equal() ran");
    return { outcome: "pass" };
}

/*
 * EVERY TIER, FOR THE TESTS ABOUT TESTS (E30, 24.09.2026). R155 asks every marker
 * in the suite whether its stage has shipped, the tier-2 ones included, from a
 * tier-0 run. A tier file imports no suite file but this one, so the runner hands
 * the three lists over here when it loads, and a reader that finds none fails as
 * a precondition instead of reading an empty suite as a clean one.
 */
let suiteTiers = null;
function registerSuite(tiers) { suiteTiers = tiers; }
function suiteEntries() {
    must(suiteTiers, "the runner has not handed the tiers to the kit - no test can be read");
    return suiteTiers.flatMap(([tier, list]) => list.map(entry => ({ tier, name: entry[0], red: entry[2] ?? null })));
}

/*
 * THE CONTRACT, RUN ON ITSELF (E30, 24.09.2026). Each case is a small test with a
 * known verdict, run through `runOne` in isolation with a ledger of two made-up
 * stages, E90 still to come and E91 shipped. R155's lesson is R21's: a checker is
 * trusted only after it has been seen to catch what it is for. They live here,
 * not in a tier file, because every one of them breaks the contract on purpose.
 */
const SELF_LEDGER = new Map([
    ["E90", { id: "E90", planned: "9.0.90", version: null, shipped: null, done: false }],
    ["E91", { id: "E91", planned: "9.0.91", version: "9.0.91", shipped: "2026-01-01", done: true }]
]);
const KIT_SELF_TESTS = [
    { expect: "pass", says: "", entry: ["a test that measures and holds", () => { equal(2 + 2, 4, "two and two"); }] },
    { expect: "fail", says: "measured nothing", entry: ["an empty test", () => {}] },
    { expect: "fail", says: "measured nothing", entry: ["a loop over nothing", () => { for (const x of []) ok(x, "x"); }] },
    { expect: "fail", says: "the test caught it", entry: ["a failure caught inside the test", () => {
        try { ok(1 === 2, "one is two"); } catch { /* swallowed on purpose */ }
        ok(1 === 1, "one is one");
    }] },
    { expect: "fail", says: "the marker is gone", entry: ["a precondition, and nothing else", () => { must(false, "the marker is gone"); }] },
    { expect: "skip", says: "[world.moduleActive]", entry: ["a test the world cannot answer", () => {
        needs(world.moduleActive("drpg-suite-never-installed"), "a module no world has");
    }] },
    { expect: "fail", says: "not an env.* or world.* probe", entry: ["needs() handed an element", () => {
        needs(document.body, "a body is not a probe");
    }] },
    { expect: "fail", says: "not an env.* or world.* probe", entry: ["needs() handed a truthy condition", () => {
        needs(true, "true is not a probe either");
    }] },
    { expect: "fail", says: "asked after this test wrote", entry: ["a world probe asked after a write", () => {
        current.wrote = "a synthetic write";
        needs(world.atLeast("scenes", 0), "any world has zero scenes or more");
    }] },
    { expect: "fail", says: "counts no such thing", entry: ["a world probe of something the kit does not count", () => {
        needs(world.atLeast("unicorns", 1), "no row counts these");
    }] },
    { expect: "red", says: "until E90 (planned 9.0.90)", entry: ["red, failing on ok()", () => { ok(1 === 2, "one is two"); },
        expectedRed("E90", "the fix lands in E90")] },
    { expect: "fail", says: "unexpectedly passed", entry: ["red, passing", () => { ok(1 === 1, "one is one"); },
        expectedRed("E90", "the fix lands in E90")] },
    { expect: "fail", says: "shipped in 9.0.91", entry: ["red, its stage shipped", () => { ok(1 === 2, "one is two"); },
        expectedRed("E91", "the fix landed in E91")] },
    { expect: "fail", says: "does not know", entry: ["red, a stage nobody planned", () => { ok(1 === 2, "one is two"); },
        expectedRed("E89", "a stage that is not in the ledger")] },
    { expect: "fail", says: "red for the wrong reason", entry: ["red, failing on must()", () => { must(false, "the marker is gone"); },
        expectedRed("E90", "the fix lands in E90")] },
    { expect: "fail", says: "threw", entry: ["red, crashing", () => { throw new TypeError("x is not a function"); },
        expectedRed("E90", "the fix lands in E90")] },
    { expect: "fail", says: "not where expectedRed says", entry: ["red, failing somewhere else", () => { ok(1 === 2, "another assertion"); },
        expectedRed("E90", "the fix lands in E90", { failing: "the assertion it names" })] },
    { expect: "fail", says: "measured nothing", entry: ["red, measuring nothing", () => {}, expectedRed("E90", "the fix lands in E90")] },
    { expect: "fail", says: "malformed", entry: ["red, a malformed marker", () => { ok(1 === 2, "one is two"); }, expectedRed("7", "")] },
    /* A breach of the contract is not the red a marker promises (E30 review, 25.09.2026):
       before ContractBreach, both of these came out "red". */
    { expect: "fail", says: "not an env.* or world.* probe", entry: ["red, needs() handed a truthy condition", () => {
        needs(true, "true is not a probe, marked or not");
    }, expectedRed("E90", "the fix lands in E90")] },
    { expect: "fail", says: "asked after this test wrote", entry: ["red, a world probe asked after a write", () => {
        current.wrote = "a synthetic write";
        needs(world.atLeast("scenes", 0), "any world has zero scenes or more");
    }, expectedRed("E90", "the fix lands in E90")] },
    { expect: "red", says: "until E91", ledger: null, entry: ["red, with no ledger served", () => { ok(1 === 2, "one is two"); },
        expectedRed("E91", "checked at release when the ledger is not here")] }
];

/* R155's fixture: five markers against SELF_LEDGER, one live and four wrong -
   shipped, unknown, without a reason, and a look-alike expectedRed did not make.
   Here and not in R155, so tools/stages.mjs, which reads every expectedRed( in
   the tier files, never meets a made-up stage. */
/* ...and for a dump rule's `until`: one of each kind that passes, four that do not. */
const UNTIL_FIXTURE = [
    { flagged: false, rule: { until: "never", why: "a reason" } },
    { flagged: false, rule: { until: "1.3.x (D27)", why: "a reason" } },
    { flagged: false, rule: { until: "E90", why: "a reason" } },
    { flagged: true, rule: { until: "E91", why: "its stage has shipped" } },
    { flagged: true, rule: { until: "E89", why: "a stage the ledger does not know" } },
    { flagged: true, rule: { until: "soon", why: "not a stage" } },
    { flagged: true, rule: { until: "never", why: " " } }
];

const MARKER_FIXTURE = [
    { flagged: false, marker: expectedRed("E90", "still to come") },
    { flagged: true, marker: expectedRed("E91", "its stage has shipped") },
    { flagged: true, marker: expectedRed("E89", "a stage the ledger does not know") },
    { flagged: true, marker: expectedRed("E90", "") },
    { flagged: true, marker: Object.freeze({ stage: "E90", why: "the right fields, not made by expectedRed" }) }
];

/*
 * THE ENVIRONMENT, ASKED BEFORE THE MODULE IS (E01, 24.09.2026; audit S14-05).
 *
 * The contract above says a skip is a fact about the environment. A dozen tests
 * had drifted into asking `needs()` about the module's own answer instead -
 * `needs(app)` after opening the roll window, `needs(c)` after cutting the
 * curtain - so the day the roll window stops opening, the one test written to
 * notice says "skip". These three ask the environment with a probe the suite
 * owns, before the module does anything; what the module then does is `ok()`.
 */

/** Whether this browser lays a page out at all: a 10 px box the suite adds, measured. */
function layoutAvailable() {
    const probe = document.createElement("div");
    probe.style.cssText = "position: absolute; left: -100px; top: 0; width: 10px; height: 10px; visibility: hidden";
    document.body.appendChild(probe);
    try { return probe.offsetWidth === 10; } finally { probe.remove(); }
}

/**
 * Whether this browser resolves a CSS custom property through `var()` - which is
 * what every size and colour in the theme is made of. jsdom does not: it hands back
 * the literal `var(--drpg-dim)` as a colour, which read as "the dim ink could not be
 * measured" and as a size of NaN (E01, 24.09.2026). Asked of a property the suite
 * sets itself, not one the module's stylesheet should have: the harness then
 * answered `getPropertyValue("--...")` from a flat list of the stylesheets'
 * properties and would have said yes. Since E30 (lib/css.mjs) jsdom's own cascade
 * answers there, custom properties substituted, and a standard property made of
 * `var()` still comes back unresolved - so this reads false headless, as before.
 */
function cascadeAvailable() {
    const probe = document.createElement("span");
    probe.style.setProperty("--drpg-suite-probe", "7px");
    probe.style.fontSize = "var(--drpg-suite-probe)";
    document.body.appendChild(probe);
    try { return getComputedStyle(probe).fontSize === "7px"; } finally { probe.remove(); }
}

/**
 * A hook only the suite's own live regions listen to (E01, 24.09.2026; the review of
 * E01). The three `keepLive` tests used to ask for a redraw by raising
 * `drpgTimeOfDayChanged` - "the event every live window listens to" - and every
 * other listener heard it too: the trace digest was flushed to the GM early and its
 * queue emptied, the music and the voice rooms were re-read, the Eclipse redrawn.
 * With a Remnant on the map, tier 1 posted a GM whisper from the tier that promises
 * a GM it changes nothing. `keepLive` takes extra hook names (`watch.hooks`), so a
 * name nothing else knows asks for the redraw and nothing else.
 */
const LIVE_PROBE = "drpgSuiteLiveProbe";

/** Whether this client is under the Stained Glass theme - a setting of the person running the suite. */
const glassTheme = () => document.body.classList.contains("drpg-theme-stained-glass");

/** Whether the canvas has a renderer to draw PIXI with. */
const canvasAvailable = () => Boolean(canvas?.ready && typeof canvas?.app?.renderer?.render === "function");

/**
 * Whether Daggerheart's own sheets are registered in this environment - the
 * opener of the roll window and the home of the Hope drawer. The headless
 * harness stands a stub where the sheet would be, and says so by this answer.
 */
const systemSheetsAvailable = () => Object.keys(CONFIG.Actor?.sheetClasses?.character ?? {}).length > 0;

/**
 * Whether `DialogV2` draws a window here: Foundry's is an ApplicationV2 with a
 * `render`. So is the headless harness's since E01 (lib/shim.mjs), which draws a
 * real window when a scenario asks for one (`__dialogWindows`, as 01-runtests does
 * on the GM) and otherwise answers `wait` from a queue - so this holds on every
 * harness client and skips nowhere today (E30 review, 25.09.2026). It stays for a
 * DialogV2 that cannot draw.
 */
const dialogsDrawn = () => typeof foundry.applications.api.DialogV2?.prototype?.render === "function";

/**
 * Whether a document's data here is its source, unprepared - which a test can then prepare itself
 * (tests-tier2.mjs `preparedAs`, E29 fix r2-H25). The headless harness prepares nothing; at a table
 * Foundry prepares a character's `system` (Daggerheart's `prepareBaseData`, `prepareDerivedData`), a
 * test's stand-in is not used, and a half of a test that reads its own preparation reads Daggerheart's
 * instead (E10 fix r1-G3, 10.10.2026; the round-1 review's cor F5: two such halves passed measuring the
 * opposite case). Read off the first character, as `preparedAs` reads the one it is given.
 */
const sourceUnprepared = () => {
    const actor = game.actors?.find(a => a.type === "character");
    return Boolean(actor) && actor.system === actor._source?.system;
};

/*
 * WHAT A SKIP MAY STAND ON (E30, 24.09.2026; audit S17-03, S14-24).
 *
 * Two families and nothing else. `env.*` is this browser and this Foundry: the
 * probes above, and the four conditions tests used to write inline (a desk-width
 * screen, a Markdown converter, fonts, Web Animations), each asked the way the
 * test that had it asked it. `world.*` is the world as found: what it is made of,
 * counted one way for every test, so "not enough students" means the same thing
 * in the seven scenarios that used to count them seven ways. A probe is a frozen
 * object carrying a mark only this file can make, which is how `needs` tells it
 * from a condition. The WORLD table is closed: a test cannot pass its own
 * counter, because that would let an action's result back in as a skip; a new
 * row is a change to this file. Rows may read the module's roster (studentActors,
 * allVaults) to count; the headless harness's world satisfies every row and
 * 01-runtests refuses a world.* skip there, so a broken reader turns red in the
 * harness instead of skipping quietly.
 */
const PROBE = Symbol("drpg.suite.probe");
const probe = (name, holds, fact) => Object.freeze({ [PROBE]: true, name, holds: Boolean(holds), fact });

const env = Object.freeze({
    layout: () => probe("env.layout", layoutAvailable(), "no layout here"),
    cascade: () => probe("env.cascade", cascadeAvailable(), "no CSS cascade here: var() does not resolve"),
    glass: () => probe("env.glass", glassTheme(), "the theme on this client is Monokuma Legacy, not Stained Glass"),
    desk: () => probe("env.desk", !narrowScreen(), "a stacked screen, narrower than BREAKPOINTS.narrow"),
    canvas: () => probe("env.canvas", canvasAvailable(), "no canvas renderer here"),
    systemSheets: () => probe("env.systemSheets", systemSheetsAvailable(), "Daggerheart's sheets are not registered here"),
    /* Daggerheart's MoveContext (E76b, 12.11.2026): the config 2.12's `actor.rollTrait` builds its roll from
       (game.system.api.data.actions.MoveContext, daggerheart.mjs:137-145, 2.12.8). Up to 2.10.x there is none, and a
       test of what the module carries through it skips there; the harness runs 2.12.8's copy since E76 C3c. */
    moveContext: () => probe("env.moveContext", typeof game.system?.api?.data?.actions?.MoveContext === "function",
        "this Daggerheart builds no MoveContext (before 2.12)"),
    dialogs: () => probe("env.dialogs", dialogsDrawn(), "DialogV2 draws no window here"),
    unprepared: () => probe("env.unprepared", sourceUnprepared(), "Foundry prepares a character's data here, so a test cannot stand in for the preparation"),
    markdown: () => probe("env.markdown", Boolean(globalThis.showdown?.Converter), "no Markdown converter here"),
    /* tools/ served (E52 C6): the run's fetch of the stage ledger (`stageLedger`, once per run, before the first test). */
    tools: () => probe("env.tools", toolsServed, "this install has no tools/ folder (an installed module's zip leaves it out)"),
    /* The primary GM (E11 fix r2-H1, 1.2.73; round 1's residue R4): the one browser the discovery, the watcher and the
       GMs' audit run on. Which GM that is is a fact about this browser at this table, so a test of those roads run from a
       second GM skips instead of failing; the harness's GM is the primary, so nothing skips for it there. */
    primaryGm: () => probe("env.primaryGm", isPrimaryGm(), "this browser is not the primary GM"),
    /* Two players connected who own a living student (E37 C3): who is at the table now, which the readiness round asks
       (boundary.mjs `roundUsers`). The harness connects three; a GM alone at a sandbox has none, and a test of the round
       skips there instead of failing. */
    playersConnected: () => probe("env.playersConnected", game.users.filter(u => !u.isGM && u.active
        && living().some(a => a.testUserPermission(u, "OWNER"))).length >= 2, "fewer than two players who own a living student are connected here"),
    /* jsdom answers every element's fontFamily with the words "depends on user agent" (the
       note in "the theme speaks two faces" has the story); a browser names a face. */
    fonts: () => {
        const face = getComputedStyle(document.body).fontFamily;
        return probe("env.fonts", face && !/depends on user agent/i.test(face), "no font family resolves here");
    },
    /* Motion as this client lets it run (E23 fix G1): a turn of the glass is planned only where neither the module's
       stillness (`drpg-reduced-motion`, motion.mjs) nor the system's own switch asks for reduced motion, so a test of
       a running turn skips where either does. The harness's clients ask for neither. */
    motion: () => probe("env.motion", !document.body.classList.contains("drpg-reduced-motion")
        && !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches, "this client asks for reduced motion"),
    webAnimations: () => probe("env.webAnimations", typeof HTMLElement.prototype.getAnimations === "function"
        && typeof globalThis.CSSTransition === "function", "no Web Animations API here"),
    /* The headless harness's stand-in for avclient-livekit (audit/harness/lib/livekit.mjs, E19 C0), there and not
       installed: client-entry.mjs's stub. A real Foundry has none, and its A/V client is not a test's to break. */
    liveKitShim: () => probe("env.liveKitShim", globalThis.__liveKit?.installed === false
        && typeof globalThis.__liveKit?.install === "function", "no LiveKit stand-in here, only the browser's own A/V client")
});

const viewed = () => canvas?.scene ?? null;
const living = () => studentActors().filter(a => !a.getFlag(MODULE_ID, FLAGS.deceased));
/* The named regions a token stands in, as Foundry keeps them (TokenDocument#regions,
   v12 and on), not as roomOfToken reads them - the module's reading is what a test
   then checks against this. */
const roomsOfToken = token => [...(token?.regions ?? [])]
    .map(r => (typeof r === "string" ? viewed()?.regions?.get(r) : r))
    .filter(r => r?.name?.trim());
const WORLD = {
    scenes: ["scenes", () => game.scenes?.size ?? 0],
    sceneOnScreen: ["scenes on screen", () => (viewed() ? 1 : 0)],
    namedRooms: ["named rooms on the scene on screen", () => [...(viewed()?.regions ?? [])].filter(r => r.name?.trim()).length],
    occupiedRooms: ["rooms on the scene on screen with a token in them",
        () => new Set([...(viewed()?.tokens ?? [])].flatMap(t => roomsOfToken(t).map(r => r.id))).size],
    studentsInRooms: ["students standing in a named room on the scene on screen",
        () => living().filter(a => [...(viewed()?.tokens ?? [])].some(t => t.actorId === a.id && roomsOfToken(t).length)).length],
    /* A player's own character standing in a named room: whom R166 judges a search for (E31 review). */
    playerCharactersInRooms: ["player-owned characters standing in a named room on the scene on screen",
        () => game.actors.filter(a => a.type === "character" && game.users.some(u => !u.isGM && a.testUserPermission(u, "OWNER"))
            && [...(viewed()?.tokens ?? [])].some(t => t.actorId === a.id && roomsOfToken(t).length)).length],
    studentTokensOnScreen: ["students with a token on the scene on screen",
        () => living().filter(a => [...(viewed()?.tokens ?? [])].some(t => t.actorId === a.id)).length],
    livingStudents: ["living students", () => living().length],
    // E79 fix r4-G3 (1.2.79): the GMs' own character, which a GM's Re-point may not aim an Objection at (tier 2).
    monokumas: ["Monokuma actors", () => game.actors.filter(a => a.type === "character" && isMonokuma(a)).length],
    playerAccounts: ["player accounts", () => game.users.filter(u => !u.isGM).length],
    playersWithCharacter: ["player accounts that own a character", () => game.users.filter(u => !u.isGM
        && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER"))).length],
    /* Connected now, which is what voiceTargets places: a player who is not here has
       no voice room to be sent to (E30 review, 25.09.2026). */
    connectedPlayersWithCharacter: ["connected player accounts that own a character", () => game.users.filter(u => !u.isGM
        && u.active && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER"))).length],
    /* Living students, not accounts: the trial's two-incident test (E05 fix r2-G1, 27.09.2026)
       needs three students whose players are here - an opening roll with nobody to ask is
       thrown on the GM's client, and a ballot goes to a connected player - and an account
       counted above may own a Monokuma or a dead student instead. */
    studentsWithConnectedPlayer: ["living students owned by a connected player account", () => living()
        .filter(a => game.users.some(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER"))).length],
    /* A student the GMs play: whisperToOwner's card for them goes to the GMs alone, and speaks as
       them (E06 fix r2-G2, 28.09.2026 - the fight's veil is asked of the speaker as well). */
    studentsWithoutPlayer: ["living students no player account owns", () => living()
        .filter(a => !game.users.some(u => !u.isGM && a.testUserPermission(u, "OWNER"))).length],
    fullGms: ["full Gamemaster accounts", () => game.users.filter(u => u.role === CONST.USER_ROLES.GAMEMASTER).length],
    stashes: ["stashes", () => allVaults(canvas?.scene).length],
    /* Read off the item's own flag, not through vaultContents: the invariant this
       serves hunts a stashed item whose stash is gone, and must not lose the item
       it hunts to the reader it checks. A row of its own, added with that test. */
    stashedItems: ["stashed items", () => game.actors.filter(a => a.type === "character")
        .reduce((n, a) => n + a.items.filter(i => i.getFlag(MODULE_ID, "location") === "vault").length, 0)],
    /*
     * WHAT THREE WORLD SCANS READ (E30 review, 25.09.2026). "no Remnant token carries
     * the answer key", "a Remnant token's name gives nothing away" and "no item claims
     * a role that does not exist" gather what is wrong across the whole world and
     * assert once, after the loop - so over a world with no trace and no item role
     * they passed having read nothing, and the headless run was such a world: the
     * seed had neither, and tier 1 runs before tier 2 places a trace. Both rows read
     * the documents' own flags, as the scans do, on every scene and every actor.
     */
    remnantTokens: ["trace tokens on every scene", () => [...(game.scenes ?? [])]
        .reduce((n, scene) => n + [...(scene.tokens ?? [])].filter(t => t.getFlag(MODULE_ID, "isRemnant")).length, 0)],
    itemsWithRoles: ["items that name a role beyond their category", () => [...game.actors]
        .reduce((n, a) => n + [...a.items].filter(i => {
            const roles = i.getFlag(MODULE_ID, "roles");
            return Array.isArray(roles) && roles.length > 0;
        }).length, 0)]
};

/* A skip describes the world AS FOUND. Once a test has written to the world, what
   it would count is partly its own doing, so asking then FAILs (the runner's write
   watcher sets `current.wrote`). */
function askedOfWorld(name) {
    if (current?.wrote) {
        const text = `${name} was asked after this test wrote to the world (${current.wrote}) - ask the world before acting`;
        current.failures.push(text);
        throw new ContractBreach(text);
    }
}

const world = Object.freeze({
    atLeast(what, n = 1) {
        const row = WORLD[what];
        must(row, `world.atLeast("${what}"): the kit counts no such thing - a new row is a change to tests-kit.mjs`);
        askedOfWorld(`world.${what}`);
        const have = row[1]();
        return probe(`world.${what}`, have >= n, `this world has ${have} ${row[0]}; this needs ${n}`);
    },
    ownedByPlayer(actor) {
        askedOfWorld("world.ownedByPlayer");
        return probe("world.ownedByPlayer", game.users.some(u => !u.isGM && actor?.testUserPermission(u, "OWNER")),
            `no player owns ${actor?.name ?? "that character"} in this world`);
    },
    moduleActive(id) {
        askedOfWorld("world.moduleActive");
        return probe("world.moduleActive", game.modules.get(id)?.active, `${id} is not enabled in this world`);
    },
    settingRegistered(full) {
        askedOfWorld("world.settingRegistered");
        return probe("world.settingRegistered", game.settings.settings.has(full), `${full} is not registered by what is installed here`);
    }
});

/** One line saying what the world tier 2 is about to build its fixtures in is made of. */
function worldCensus() {
    const n = what => WORLD[what][1]();
    const scene = viewed();
    return `world: ${n("livingStudents")} living students, ${n("playerAccounts")} player accounts (${n("playersWithCharacter")} own a character), `
        + `${n("fullGms")} full GM, ${n("stashes")} stash(es), `
        + (scene ? `scene on screen "${scene.name}" with ${n("namedRooms")} named rooms (${n("occupiedRooms")} occupied)` : "no scene on screen");
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/** Let a world write land on this client before reading it back. */
const settle = () => wait(400);

/**
 * Wait for a CONDITION rather than for the clock.
 *
 * `settle()` is a flat 400 ms and it is the right tool for "nothing should have
 * happened" - there is no condition to wait for, only time to let pass. It is the
 * wrong tool for "this should have arrived", and two Tier-2 tests spent 08 and
 * 09.09 proving it: `a trace and its bullets are one record` and `a trap watches,
 * fires once` each failed twice and each passed on the very next run of the same
 * code. Both fail on a value that has to travel TWO hops - an edit on a bullet
 * reaching its trace, then the trace pushing the correction back down to the other
 * holder; a room-crossed hook reaching the trap, then the trap posting a card - and
 * 400 ms was never asked to cover a second round trip.
 *
 * Polls, then RETURNS ANYWAY at the deadline instead of throwing, so the assertion
 * that follows still reports what it actually saw rather than a timeout with no
 * measurement in it.
 */
const until = async (check, ms = 4000) => {
    const deadline = Date.now() + ms;
    for (;;) {
        try { if (check()) return true; } catch { /* not there yet */ }
        if (Date.now() >= deadline) return false;
        await wait(50);
    }
};

/**
 * A fetched file's text with its line ends made LF (`lf`, tests-lint.mjs; 1.2.80
 * train, fix crlf-G1): `fetch(url).then(lfText)`, or `lfText(res)` where a test reads
 * `res.ok` first. Every read of a served file in the kit and the tiers is one of
 * these or `lf(await res.text())`, and `node tools/check.mjs contract` holds them to it
 * (rawTextReads, tests-lint.mjs).
 */
const lfText = async res => lf(await res.text());

/**
 * Fetched once per page load and kept: a second run in the same page reads the
 * same text, so reload after editing a file.
 */
let sourceCache = null;

/**
 * Every script this module ships, by file name.
 *
 * CRAWLED FROM `module.mjs`, NOT LISTED. A list is the thing that rots: the
 * file added next month is exactly the one nobody remembers to add here, and it
 * would be silently exempt from every tier-0 criterion while the suite kept
 * reporting green. The crawl cannot have that hole - a file nothing imports is
 * a file Foundry never loads either. Measured on 1.2.60: 108 on disk, 108
 * reached; 112 and 112 once E30 split the suite into five files; 114 and 114 with
 * tests-lint.mjs and tests-flows.mjs beside them (25.09.2026).
 */
async function moduleSources() {
    if (sourceCache) return sourceCache;
    const out = new Map();
    const queue = ["module.mjs"];
    while (queue.length) {
        const file = queue.pop();
        if (out.has(file)) continue;
        let text = null;
        try {
            const res = await fetch(`/modules/${MODULE_ID}/scripts/${file}`);
            if (res.ok) text = await lfText(res);
        } catch { /* a file that will not load is the module's problem, not this test's */ }
        if (text === null) continue;
        out.set(file, text);
        for (const m of text.matchAll(/(?:from|import\()\s*"\.\/([\w-]+\.mjs)"/g)) queue.push(m[1]);
    }
    sourceCache = out;
    return out;
}

/** Whether a file is one of the suite's own: tests.mjs and every tests-*.mjs. */
const isSuiteFile = file => /^tests(-[\w-]+)?\.mjs$/.test(file);

/** The same, minus the suite's own files - tests.mjs and every tests-*.mjs quote each pattern they hunt for. */
async function otherSources() {
    const all = await moduleSources();
    return [...all].filter(([file]) => !isSuiteFile(file));
}

/**
 * The tier files - the suite's own files that hold its tests, the grid's among them
 * (`TEST_FILE`), what the contract's static checks read (R155-R158). Not the kit, the runner or tests-lint.mjs: those
 * are where the cutters, the detectors and their deliberate violations live.
 */
async function suiteSources() {
    const all = await moduleSources();
    return [...all].filter(([file]) => isSuiteFile(file) && TEST_FILE.test(file));
}

/**
 * One of tests-lint.mjs's detectors over every tier file, for the meta-tests
 * (R156-R158): which files it read, how many tests they hold, how many calls it
 * looked at, and what it found, as `file:line what`.
 */
async function scanSuite(detector) {
    const files = await suiteSources();
    let tests = 0, read = 0;
    const found = [];
    for (const [file, text] of files) {
        tests += testsIn(text).length;
        const r = detector(text);
        read += r.read;
        found.push(...r.found.map(f => `${file}:${f.line} ${f.what}`));
    }
    return { files: files.map(([file]) => file).sort(), tests, read, found };
}

/* stripComments and lineAt live in tests-lint.mjs, which the Node check reads
   too, and reach the tiers from here (E30). */

/** Every stylesheet in module.json, concatenated, comments removed. */
async function moduleStyles() {
    const manifest = await fetch(`/modules/${MODULE_ID}/module.json`).then(r => r.json());
    const parts = [];
    for (const href of manifest.styles ?? []) {
        parts.push(await fetch(`/modules/${MODULE_ID}/${href}`).then(lfText));
    }
    return parts.join("\n").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/* A SHEET'S RULES AND A SELECTOR'S WEIGHT, ONCE A RUN (E44 fix FG7, 05.11.2026). Sixteen tests of tier 1 build a cascade
   of their own, and each read every sheet's rules from its text again and weighed each selector again (2798 rules and
   4617 selectors on 05.11.2026; 89 ms and 45 ms of each build in node). The rules of a text already read are handed out
   again as fresh copies - a rule and its declarations - so a test that changes one changes its own cascade alone; a
   selector's weight, its subject's needs and its pseudo-element are a fact of its text. A sheet whose text changed is
   read again (the key is the text). */
const SHEET_RULES = new Map(), SELECTOR_WEIGHT = new Map();
const sheetRules = (text, file) => {
    const key = `${file}\n${text}`;
    if (!SHEET_RULES.has(key)) SHEET_RULES.set(key, topLevelStyleRules(text, file));
    return SHEET_RULES.get(key).map(rule => ({ ...rule, decls: rule.decls.map(decl => ({ ...decl })) }));
};
const weighFresh = selector => {
    const pseudo = /::?(before|after)$/.exec(selector);
    return { selector, specificity: selectorSpecificity(selector), needs: subjectNeeds(selector),
        pseudo: pseudo ? `::${pseudo[1]}` : null, base: pseudo ? selector.slice(0, pseudo.index) : selector };
};
const weighSelector = selector => {
    if (!SELECTOR_WEIGHT.has(selector)) SELECTOR_WEIGHT.set(selector, Object.freeze(weighFresh(selector)));
    return SELECTOR_WEIGHT.get(selector);
};

/**
 * The module's stylesheets as a cascade read without a layout (E18 C6, 20.10.2026): which declaration
 * wins a property on an element, and from which file. Every sheet of module.json in its order, comments
 * removed, its top-level style rules read from the TEXT - rules under @media, @supports, @container or
 * @layer are not read: the cascade of a desk with a mouse, and of `body.drpg-stacked`, which is a class.
 * The text and not the CSSOM because jsdom drops `!important` from a value that holds `var()`: on the
 * harness's jsdom (20.10.2026) `font-size: var(--x) !important` read back priority "" while
 * `font-size: 13px !important` read "important", and the module's shared bar rule is the first kind. The winner: `!important`, then specificity (`:is`, `:not` and
 * `:has` count their most specific argument, `:where` nothing), then order. `winner(el, names)` takes a
 * property or a list read as one (a shorthand and its longhand) and answers `{ value, important, file,
 * selector }` or null; an element is matched by its own `matches`, so it may be built on a body of its own,
 * connected to nothing on the page. A third argument, "::before" or "::after" (E44 C6, R1333), reads that
 * pseudo-element: the rules whose selector ends in it, matched by the rest; without it no such rule is read, as before.
 * `{ cached: false }` (E21 C1a, R1354) builds the cascade as it was before FG7's caches - each sheet read from its text,
 * each selector weighed, the rules compared one by one on every reading and the asked names' rules sorted again - the
 * reference R1354 holds the cached answers to; no test reads the sheets so but R1354.
 */
async function styleCascade({ cached = true } = {}) {
    const manifest = await fetch(`/modules/${MODULE_ID}/module.json`).then(r => r.json());
    const read = [];
    for (const file of manifest.styles ?? []) {
        const text = (await fetch(`/modules/${MODULE_ID}/${file}`).then(lfText)).replace(/\/\*[\s\S]*?\*\//g, " ");
        read.push(...(cached ? sheetRules(text, file) : topLevelStyleRules(text, file)));
    }
    /* Read once, not on every question (E44 C3a, 04.11.2026): each rule's selectors split and weighed, the rules
       indexed by the properties they declare: the same winner as asking every rule each time, and read again when a
       test has pushed a rule into `rules` or taken one out (R1007 plants the d99adf4b tray rule so). `on(el)` answers
       `winner` for one element with its answer to each selector kept, so it holds only while neither the element nor
       an ancestor changes; R1323 asks some 600 properties of 60 elements that way, and took 4.7 s of the tiers' run
       before (run-tests --only R1323, 10.4 s wall against 5.7 s for a test that reads nothing). */
    /* CHEAPER TO ASK AGAIN (E44 fix FG7, 05.11.2026; the end review's "slow tests", STATUS Open 26/56/88/90: tiers 0-1 read
       375-397 s on this machine against their 370 s bound). Two costs were paid on every reading: the check that `rules`
       was unchanged compared every rule with the copy indexed (some thousands, for each of R1333's 19153 readings), and
       the rules of the asked names were gathered and sorted into sheet order again. Now `rules` is watched - every write
       to it, a push, a splice, an index set, a length, marks it changed (a Proxy over the same array, which the tests
       read and change as before) - and each list of names keeps its rules in sheet order once per index: the same
       winners, read again when a test changes `rules`, as before. */
    const held = [];
    let changed = true;
    const rulesView = new Proxy(held, {
        set(target, key, value) { target[key] = value; changed = true; return true; },
        deleteProperty(target, key) { delete target[key]; changed = true; return true; }
    });
    let byProperty = new Map(), sortedFor = new Map(), indexed = [];
    const index = () => {
        if (cached ? !changed : indexed.length === held.length && indexed.every((rule, i) => rule === held[i])) return byProperty;
        changed = false;
        indexed = cached ? [] : [...held];
        sortedFor = new Map();
        byProperty = new Map();
        held.forEach((rule, order) => {
            const entry = { rule, order, selectors: splitTopLevel(rule.selector, ",").map(cached ? weighSelector : weighFresh) };
            for (const property of new Set(rule.decls.map(d => d.property))) {
                if (!byProperty.has(property)) byProperty.set(property, []);
                byProperty.get(property).push(entry);
            }
        });
        return byProperty;
    };
    /* `pseudo` (E44 C6): "::before" or "::after" asks for the rules whose selector ends in it, matched by the rest - an
       element's pseudo-element, which `matches` cannot be asked for; null, the element itself, which no such rule
       styles. */
    const ask = (el, { needs, pseudo, base }, want = null) => {
        if (pseudo !== want) return false;
        if (needs.tag && needs.tag !== el.localName) return false;
        if (needs.classes.some(name => !el.classList.contains(name))) return false;
        try { return el.matches(base); } catch { return false; }
    };
    const answer = (el, names, matches) => {
        const wanted = [names].flat();
        const by = index();
        const key = wanted.join("\n");
        const sorted = () => [...new Set(wanted.flatMap(name => by.get(name) ?? []))].sort((a, b) => a.order - b.order);
        if (!cached) sortedFor.delete(key);
        if (!sortedFor.has(key)) sortedFor.set(key, sorted());
        let best = null;
        for (const { rule, order, selectors } of sortedFor.get(key)) {
            /* the rule's declaration read only once one of its selectors matches (E44 C6, 04.11.2026: R1333 asks 19153
               properties, 3.8 million rules in all, and filtering every rule's declarations first took most of its time) */
            let decl = null;
            for (const one of selectors) {
                const { selector, specificity } = one;
                if (!matches(one)) continue;
                decl ??= rule.decls.filter(d => wanted.includes(d.property)).at(-1);
                const rank = [decl.important ? 1 : 0, ...specificity, order];
                if (!best || rankAbove(rank, best.rank)) best = { rank, value: decl.value, important: decl.important, file: rule.file, selector };
            }
        }
        return best ? { value: best.value, important: best.important, file: best.file, selector: best.selector } : null;
    };
    const winner = (el, names, pseudo = null) => answer(el, names, one => ask(el, one, pseudo));
    const on = (el, pseudo = null) => {
        const known = new Map();
        const matches = one => {
            if (!known.has(one.selector)) known.set(one.selector, ask(el, one, pseudo));
            return known.get(one.selector);
        };
        return names => answer(el, names, matches);
    };
    held.push(...read);
    return { rules: rulesView, winner, on };
}

/* What a selector's subject - its last compound, outside any parentheses or brackets - asks of the element itself: a
   tag and the classes it names. An element without one of them cannot match, so `styleCascade` answers no without
   asking jsdom's `matches`, which is where its time went (E44 C3a: 2.9 s of R1323's 3.1 s, 362 readings). Anything
   else - an attribute, a pseudo-class, an ancestor - is left to `matches`. Exported for R1333 (E44 C6), which asks
   the rules written for the A8 surfaces of each element the same way. */
function subjectNeeds(selector) {
    let depth = 0, start = 0, quote = null;
    for (let i = 0; i < selector.length; i++) {
        const ch = selector[i];
        if (quote) { if (ch === quote) quote = null; continue; }
        if (ch === "\"" || ch === "'") quote = ch;
        else if (ch === "(" || ch === "[") depth++;
        else if (ch === ")" || ch === "]") depth--;
        else if (!depth && /[\s>+~]/.test(ch)) start = i + 1;
    }
    let subject = "", level = 0;
    for (const ch of selector.slice(start)) {
        if (ch === "(" || ch === "[") level++;
        if (!level) subject += ch;
        if (ch === ")" || ch === "]") level--;
    }
    const tag = /^[a-z][\w-]*/i.exec(subject)?.[0]?.toLowerCase() ?? null;
    const classes = [...subject.matchAll(/\.([\w-]+)/g)].map(m => m[1]);
    return { tag, classes };
}

function splitTopLevel(text, by) {
    const out = [];
    let depth = 0, part = "", quote = null;
    for (const ch of text) {
        if (quote) { if (ch === quote) quote = null; part += ch; continue; }
        if (ch === "\"" || ch === "'") quote = ch;
        if (ch === "(" || ch === "[") depth++;
        if (ch === ")" || ch === "]") depth--;
        if (ch === by && !depth) { out.push(part); part = ""; } else part += ch;
    }
    return [...out, part].map(each => each.trim()).filter(Boolean);
}

function topLevelStyleRules(text, file) {
    const rules = [];
    let at = 0;
    while (at < text.length) {
        const open = text.indexOf("{", at);
        if (open < 0) break;
        let depth = 0, end = open, quote = null;
        for (; end < text.length; end++) {
            const ch = text[end];
            if (quote) { if (ch === quote) quote = null; continue; }
            if (ch === "\"" || ch === "'") quote = ch;
            else if (ch === "{") depth++;
            else if (ch === "}" && --depth === 0) break;
        }
        const head = text.slice(at, open), block = text.slice(open + 1, end);
        at = end + 1;
        const selector = head.slice(head.lastIndexOf(";") + 1).replace(/\}/g, " ").trim();
        if (!selector || selector.startsWith("@")) continue;
        const flat = block.replace(/\{[^{}]*\}/g, ";");
        const decls = splitTopLevel(flat, ";").map(line => {
            const colon = line.indexOf(":");
            if (colon <= 0) return null;
            const raw = line.slice(colon + 1).trim();
            const important = /!\s*important\s*$/i.test(raw);
            return { property: line.slice(0, colon).trim().toLowerCase(), value: raw.replace(/!\s*important\s*$/i, "").trim(), important };
        }).filter(Boolean);
        rules.push({ file, selector, decls });
    }
    return rules;
}

function rankAbove(x, y) {
    const at = x.findIndex((v, i) => v !== y[i]);
    return at >= 0 && x[at] > y[at];
}

function selectorSpecificity(selector) {
    const sum = [0, 0, 0];
    const add = part => part.forEach((v, i) => { sum[i] += v; });
    let i = 0;
    const word = () => { while (i < selector.length && /[\w-]/.test(selector[i])) i++; };
    while (i < selector.length) {
        const ch = selector[i];
        if (ch === "#") { sum[0]++; i++; word(); } else if (ch === ".") { sum[1]++; i++; word(); } else if (ch === "[") {
            sum[1]++;
            while (i < selector.length && selector[i] !== "]") i++;
            i++;
        } else if (ch === ":") {
            const element = selector[i + 1] === ":";
            i += element ? 2 : 1;
            const start = i;
            word();
            const name = selector.slice(start, i);
            let args = null;
            if (selector[i] === "(") {
                let depth = 0;
                const open = i;
                do { depth += selector[i] === "(" ? 1 : selector[i] === ")" ? -1 : 0; i++; } while (depth && i < selector.length);
                args = selector.slice(open + 1, i - 1);
            }
            if (element) sum[2]++;
            else if (["is", "not", "has"].includes(name)) add(splitTopLevel(args ?? "", ",").map(selectorSpecificity).reduce((top, s) => rankAbove(s, top) ? s : top, [0, 0, 0]));
            else if (name !== "where") sum[1]++;
        } else if (/[a-z*]/i.test(ch)) { if (ch !== "*") sum[2]++; i++; word(); } else i++;
    }
    return sum;
}

/**
 * The stretch of `src` that starts at `marker`, or a failure that says the marker is gone.
 *
 * WHY THIS AND NOT `src.slice(src.indexOf(marker))` (E01, 24.09.2026; audit S14-21).
 * `indexOf` answers -1 for a marker that is no longer there - a function renamed, a
 * line rewritten - and `slice(-1, ...)` is the last character or nothing. Every
 * positive assertion on that then fails, which is fine; every NEGATIVE one
 * (`ok(!/the bug/.test(body))`) passes, whatever the file now says. Counted when this
 * helper went in: about 150 slices of that shape in the suite, 146 of them converted
 * (the rest feed only positive assertions); the audit counted 78 negative assertions
 * in tier 0. R102 was one: renaming `scaleWindow` would have let its bug
 * back in with the suite green.
 *
 *   `until`  - the body ends where this next appears AFTER the marker (the old
 *              `src.indexOf(until)` searched from the top of the file, so an `until`
 *              that also appears earlier gave an empty body - a second quiet pass);
 *   `length` - the body is this many characters from the marker;
 *   `back`   - the body is the text BEFORE the marker, this many characters of it
 *              (E30: what a line is guarded by, read upwards from the line).
 *
 * The body must reach past the marker itself, or there is nothing to read.
 */
function bodyOf(src, marker, { until = null, length = null, back = null } = {}) {
    const text = String(src ?? "");
    const at = text.indexOf(marker);
    must(at >= 0, `the source no longer has "${String(marker).slice(0, 60)}" - this test reads nothing until it is pointed at the code again`);
    if (back !== null) {
        const before = text.slice(Math.max(0, at - back), at);
        must(before.trim().length > 0, `nothing stands before "${String(marker).slice(0, 60)}" in the source`);
        return before;
    }
    let end = text.length;
    if (until !== null) {
        end = text.indexOf(until, at + String(marker).length);
        must(end >= 0, `"${String(until).slice(0, 40)}" no longer follows "${String(marker).slice(0, 60)}" in the source`);
    } else if (length !== null) {
        end = at + length;
    }
    const body = text.slice(at, end);
    must(body.length > String(marker).length,
        `the source after "${String(marker).slice(0, 60)}" is empty - there is nothing here to test`);
    return body;
}

/**
 * One top-level function of `src`, from its declaration to the next top-level
 * declaration - a function, or a `const X = {` table, the two ends R1b has always
 * cut a handler at - or null when `src` declares no function of that name.
 */
function topLevelFunction(src, name) {
    const text = String(src ?? "");
    const at = text.search(new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, "m"));
    if (at < 0) return null;
    const line = text.indexOf("\n", at);
    if (line < 0) return text.slice(at);
    const next = text.slice(line).search(/^(?:export )?(?:async )?function |^const \w+ = \{/m);
    return text.slice(at, next < 0 ? text.length : line + next);
}

/**
 * The same, or a precondition that fails when `src` declares no top-level function
 * of that name (E30). "The rest of the function" was cut by hand in a dozen tests -
 * a slice from the name to wherever a `search` for the next declaration landed,
 * each with its own end - and a renamed function then read as an empty one.
 */
function fnSource(src, name) {
    const body = topLevelFunction(src, name);
    must(body !== null, `the source no longer declares a top-level function ${name}() - this test reads nothing until it is pointed at the code again`);
    return body;
}

/**
 * The line of `text` that position `i` is on, without its line break (E30). The
 * hand-made version, `text.slice(text.lastIndexOf("\n", i) + 1, text.indexOf("\n", i))`,
 * dropped the last character of a file's last line and read the next line when `i`
 * stood on a line break.
 */
function lineAround(text, i) {
    const s = String(text ?? "");
    must(Number.isInteger(i) && i >= 0 && i < s.length, `lineAround was handed ${i}, which is not a position in the text`);
    const end = s.indexOf("\n", i);
    return s.slice(s.lastIndexOf("\n", i - 1) + 1, end < 0 ? s.length : end);
}

/**
 * A handler's body with the bodies of the guards it asks (E03, 24.09.2026).
 *
 * E03 wrote each check it added to the GM bridge as a `guard<Name>(sender,
 * payload, ctx)` function the handler asks - see the note above `firstRefusal` in
 * bridge-guards.mjs - so that E31 can lift them into a table as they are. A test that
 * reads a handler for a check has to read those as well, or a check that only
 * moved would read as a check that went. Any `guard<Name>` the body names counts,
 * called or handed to `firstRefusal`, and guards that name guards are followed. A
 * name `src` does not define comes back in `missing`, for the caller to fail on:
 * read as an empty guard it would pass.
 *
 * @returns {{body: string, guards: string[], missing: string[]}}
 */
function withGuards(src, body) {
    const named = text => [...String(text).matchAll(/\bguard[A-Z]\w*/g)].map(m => m[0]);
    const guards = [], missing = [];
    let read = String(body ?? "");
    const queue = named(read);
    while (queue.length) {
        const name = queue.shift();
        if (guards.includes(name) || missing.includes(name)) continue;
        const guard = topLevelFunction(src, name);
        if (guard === null) { missing.push(name); continue; }
        guards.push(name);
        read += `\n${guard}`;
        queue.push(...named(guard));
    }
    return { body: read, guards, missing };
}

/**
 * The files a module imports statically - `import ... from "./x.mjs"`,
 * `export ... from "./x.mjs"`, `import "./x.mjs"` - by file name, in the order
 * first met (E31, 25.09.2026). A dynamic `import("./x.mjs")` is not one: it
 * runs after both files have loaded, so it cannot make a load-order cycle. Read
 * off a line that starts with `import` or `export`, so hand it source with the
 * comments stripped; a specifier inside a string that opens a line is read too,
 * which is why R161 is shown its fixture first.
 */
function staticImports(text) {
    const out = [];
    const pattern = /^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*["']\.\/([\w-]+\.mjs)["']|^[ \t]*import\s*["']\.\/([\w-]+\.mjs)["']/gm;
    for (const m of String(text ?? "").matchAll(pattern)) {
        const file = m[1] ?? m[2];
        if (!out.includes(file)) out.push(file);
    }
    return out;
}

/**
 * Every cycle in the static import graph of `files` (a Map of file name to
 * source): the strongly connected components with more than one file, and a
 * file that imports itself, each sorted, the list sorted (Tarjan, E31). An edge
 * to a file outside the map is not followed.
 */
function importCycles(files) {
    const graph = new Map([...files].map(([file, text]) => [file, staticImports(text).filter(dep => files.has(dep))]));
    const index = new Map(), low = new Map(), stack = [], onStack = new Set(), found = [];
    let next = 0;
    const visit = v => {
        index.set(v, next); low.set(v, next); next++;
        stack.push(v); onStack.add(v);
        for (const w of graph.get(v)) {
            if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
            else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
        }
        if (low.get(v) !== index.get(v)) return;
        const component = [];
        let w;
        do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
        if (component.length > 1 || graph.get(v).includes(v)) found.push(component.sort());
    };
    for (const v of graph.keys()) if (!index.has(v)) visit(v);
    return found.sort((a, b) => a[0].localeCompare(b[0]));
}


/*
 * THE BRIDGE'S TABLES, READ LIVE (E31, 25.09.2026; audit S17-08).
 *
 * R1b used to read gm-bridge.mjs's text: a row per handler, and in each handler
 * `senderOf(senderId)` and one of three guard shapes - which could not tell
 * ownership going missing from a handler that also checked sight. The requests
 * are declarations now, so it reads the declarations themselves. The table files
 * are imported, which also proves each still exports its table; the source text
 * is read only where a declaration names a function whose body matters (the
 * run, and what the run hands its packet to) - in the table's own file and,
 * since E41 C2, in its family: the files its runs reach into, which a split of
 * the table's file moves them to (`bridgeCrawlSources`, R1235).
 *
 * Every other reader of the bridge's code reads its family too, since E41 C2b
 * (R1238): gm-bridge.mjs, then BRIDGE_ACTIONS' table file and that row's family
 * (`bridgeFamily`). A function is cut in the one file of it that declares it
 * (`bridgeFn`), a search of the whole text reads every file of it (`bridgeText`),
 * and a census key names its family's file as gm-bridge.mjs (`censusFile`), so a
 * move of the bridge's code between those files changes no key and leaves no
 * reader reading less.
 */
async function bridgeTables() {
    const out = [];
    const served = async (file, whose) => {
        const res = await fetch(`/modules/${MODULE_ID}/scripts/${file}`);
        must(res.ok, `${file}${whose} is not served (HTTP ${res.status})`);
        return stripComments(await lfText(res));
    };
    for (const [file, name, family] of BRIDGE_TABLE_FILES) {
        const module = await import(`./${file}`);
        must(module[name] && typeof module[name] === "object",
            `${file} no longer exports ${name} - the bridge's tables cannot be read until it does`);
        must(Array.isArray(family), `${file}'s row in BRIDGE_TABLE_FILES names no family list - its crawl cannot be read`);
        const text = await served(file, "");
        const kin = [];
        for (const member of family) kin.push([member, await served(member, `, in the family of ${file}'s ${name},`)]);
        out.push({ file, name, table: module[name], module, text, family: kin });
    }
    return out;
}

/**
 * The tables, the files that hold them, and each table's family (E31: the bridge, the trap relay, the search tokens;
 * E06 C5a: a roll's subject; E41 C2: the family). A family is the files a table's runs reach into beyond its own file:
 * the run files and helpers a split of the table's file moves code to, read by the crawls after the table's own file
 * (`bridgeCrawlSources`). Every family was empty until the bridge's moves (E41 C5, C5a, C5b), which list theirs in
 * BRIDGE_ACTIONS' row; tools/moved-only.mjs `bridgeReach` reads these rows off this text, in either form, `["file", "NAME"]`
 * or `["file", "NAME", [...]]`.
 */
const BRIDGE_TABLE_FILES = Object.freeze([
    ["bridge-table.mjs", "BRIDGE_ACTIONS", [
        "call-gm.mjs", "bridge-wire.mjs", "bridge-runs-acts.mjs", "bridge-runs-records.mjs", "bridge-asks.mjs",
        // E93 C3: what the Facilities' run (`facility.use`, bridge-runs-acts.mjs `handleFacilityUse`) reaches into.
        "facilities-gm.mjs",
        // E69 C3: Tail Someone's GM half, whose `startTail` answers the refusals `tail.start`'s run hands back.
        "tail-gm.mjs",
        // E74 C2: the doors' GM half, whose `shutDoor` answers the refusals `door.shut`'s run hands back.
        "doors-gm.mjs",
        // E74 C6: Keep Watch's GM half, whose `declareWatch` answers the refusals `watch.declare`'s run hands back.
        "watch-gm.mjs"
    ]],
    ["traps.mjs", "TRAP_ACTIONS", []], ["search-tokens.mjs", "SEARCH_ACTIONS", []], ["private-rolls.mjs", "ROLL_ACTIONS", []]
]);

/**
 * The texts a crawl of one table's runs cuts in (E41 C2), as `[file, text]` in order: the table's own file, then each
 * file of its family, comments stripped (as `bridgeTables()` hands them). A name declared in two of them is cut in the
 * first - the table's own file before its family.
 */
function bridgeCrawlSources(entry) {
    return [[entry.file, entry.text ?? ""], ...(entry.family ?? [])];
}

/** The cut of `name` in one table's crawl sources, `{ file, source }`, or null when none of them declares it. */
function bridgeCut(entry, name) {
    for (const [file, text] of bridgeCrawlSources(entry)) {
        const source = topLevelFunction(text, name);
        if (source) return { file, source };
    }
    return null;
}

/**
 * R163's lookup for one table's runs (E41 C2): a function's cut by name in the table's crawl sources, else in
 * bridge-guards.mjs's text (`leaf`), else null - what `payloadReads` follows a packet into.
 */
function bridgeLookup(entry, leaf) {
    return name => bridgeCut(entry, name)?.source ?? topLevelFunction(leaf, name);
}

/**
 * The names the table's own declarations call (E41 C5a0), in the order they stand: every `name(` of the statement
 * `const <NAME> = ...` in the table's file (`entry.text`, cut to the next top-level declaration), string literals
 * blanked - a helper that builds a declaration (BRIDGE_ACTIONS' `handover(...)`), a `rolled` derive (`palmRolls(...)`,
 * `friskRolls(...)`), a bound a guard reads (`hardestRepair()`). Empty when the file holds no such statement.
 */
function bridgeDeclarationCalls(entry) {
    const text = String(entry.text ?? "");
    const at = text.search(new RegExp(`^(?:export )?const ${entry.name} = `, "m"));
    if (at < 0) return [];
    const line = text.indexOf("\n", at);
    const next = line < 0 ? -1 : text.slice(line).search(/^(?:export )?(?:async )?function |^(?:export )?(?:const|let|class) /m);
    const statement = text.slice(at, line < 0 || next < 0 ? text.length : line + next);
    return [...stripStrings(statement).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
}

/**
 * R164's crawl of one table (E31; the kit's since E41 C2, so R1235 runs it on a fixture): from the table's runs, and
 * since E41 C5a0 from the names its own declarations call (`bridgeDeclarationCalls`), every name called in a function
 * it cut (string literals blanked), cut again, in the table's crawl sources - each function once, as
 * `{ file, name, source }`, in the order it was reached. A name no crawl source declares is passed by: a global, a
 * method, or a function of another file, which this does not follow. The declarations' calls were read until E41 C5a
 * only because gm-bridge.mjs's last run, `handleCardPost`, stood before BRIDGE_ACTIONS and its cut ran on through the
 * table (`topLevelFunction` stops at the next function); a split that moves the runs away from the table leaves them
 * read by nothing else (`handover`, `hardestRepair`, `friskRolls`, `palmRolls`, measured on C5a's tree).
 */
function bridgeCrawl(entry) {
    const out = [], seen = new Set();
    const queue = [...Object.values(entry.table ?? {}).map(decl => decl.run?.name), ...bridgeDeclarationCalls(entry)];
    while (queue.length) {
        const name = queue.shift();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const found = bridgeCut(entry, name);
        if (!found) continue;
        out.push({ file: found.file, name, source: found.source });
        for (const m of stripStrings(found.source).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) queue.push(m[1]);
    }
    return out;
}

/**
 * The bridge's family (E41 C2b, R1238): gm-bridge.mjs - the facade, which keeps the GM -> player wire and the
 * registration - then BRIDGE_ACTIONS' table file and the family its row lists, each once. `rows` is the kit's own
 * BRIDGE_TABLE_FILES unless a test hands a fixture. The bridge's moves (E41 C5, C5a, C5b) list their new files in that
 * row, and every reader of the bridge's code reads them through this, so none of those moves repoints a test.
 */
function bridgeFamily(rows = BRIDGE_TABLE_FILES) {
    const row = rows.find(([, name]) => name === "BRIDGE_ACTIONS");
    return [...new Set(["gm-bridge.mjs", ...(row ? [row[0], ...(row[2] ?? [])] : [])])];
}

/** The line `bridgeText` puts between two files: the second of `topLevelFunction`'s two ends, so no cut runs on into the next file. */
const BRIDGE_FAMILY_END = "const BRIDGE_FAMILY_END = {};";

/**
 * Each file of the family with its text, comments stripped, and the sentence a reader refuses with - a file of the
 * family that is not among `sources` (named), no file of it that declares `name`, or two that do - or null. Pure, so
 * R1238 reads each refusal without one being thrown; `bridgeFn` and `bridgeText` refuse with it.
 */
function bridgeRead(sources, name = null, family = bridgeFamily()) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    const texts = family.filter(file => !gone.includes(file)).map(file => [file, stripComments(map.get(file))]);
    const found = name === null ? [] : texts.map(([file, text]) => [file, topLevelFunction(text, name)]).filter(([, cut]) => cut !== null);
    const why = gone.length ? `${gone.join(", ")}, of the bridge's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`
        : name === null ? null
        : found.length > 1 ? `${name}() is declared in ${found.length} files of the bridge's family (${found.map(([file]) => file).join(", ")}) - this cannot tell which is read`
        : !found.length ? `the bridge's family (${family.join(", ")}) no longer declares a top-level function ${name}() - this test reads nothing until it is pointed at the code again`
        : null;
    return { texts, cut: found.length === 1 ? found[0][1] : null, why };
}

/**
 * The cut of the top-level function `name` in the one file of the bridge's family that declares it (E41 C2b), comments
 * stripped: what `fnSource(stripComments(sources.get("gm-bridge.mjs")), name)` read while the bridge was one file. A
 * `must` names the family when no file of it declares the name, and the files when two do (a cut of either would be
 * a guess).
 */
function bridgeFn(sources, name, family = bridgeFamily()) {
    const { cut, why } = bridgeRead(sources, name, family);
    must(!why, why);
    return cut;
}

/**
 * The family's texts, comments stripped, joined by a line `const BRIDGE_FAMILY_END = {};` (E41 C2b): what a search of
 * gm-bridge.mjs's whole text read while the bridge was one file. The line ends every cut at its file's end, so a
 * `fnSource` or `topLevelFunction` of this text cuts as `bridgeFn` does, but takes the first of two declarations.
 */
function bridgeText(sources, family = bridgeFamily()) {
    const { texts, why } = bridgeRead(sources, null, family);
    must(!why, why);
    return texts.map(([, text]) => text).join(`\n${BRIDGE_FAMILY_END}\n`);
}

/**
 * The file a census key names for a top-level statement of `file` (E41 C2b): "gm-bridge.mjs" for every file of the
 * bridge's family, as the PACKET keys built from the table already are, and the file itself otherwise - so a move
 * between the family's files renames no key.
 */
function censusFile(file, family = bridgeFamily()) {
    return family.includes(file) ? "gm-bridge.mjs" : file;
}

/**
 * The action family (E41 C3, C4): action-rolls.mjs - the facade, which keeps `performAction` and its dispatch - and the
 * files the split moved code into. C3's shared layer: the roll and its record (action-pipeline.mjs), the roll's card
 * (action-report.mjs), the briefing (action-briefing.mjs) and the variant menu with its fields (action-menus.mjs).
 * C4's actions, in the order they stood in action-rolls.mjs: the Search (action-search.mjs), Work on Project with the
 * Sabotage (action-project.mjs), Tamper (action-tamper.mjs), Palm's player half (palm.mjs), Observe, Analyze, Listen
 * and Rest (action-observe.mjs, action-analyze.mjs, action-listen.mjs, action-rest.mjs), Direct Murder with the
 * betrayal and the fight's menu (action-murder.mjs) and the Dynamic action (action-dynamic.mjs). frisk.mjs is not of
 * the family (E80, the owner's A11 of 13.10: a file of its own; R1230). A reader of the family follows each file
 * here without a repoint of its own.
 */
const ACTION_FAMILY = Object.freeze([
    "action-rolls.mjs", "action-pipeline.mjs", "action-report.mjs", "action-briefing.mjs", "action-menus.mjs",
    "action-search.mjs", "action-project.mjs", "action-tamper.mjs", "palm.mjs", "action-observe.mjs", "action-analyze.mjs",
    "action-listen.mjs", "action-rest.mjs", "action-murder.mjs", "action-dynamic.mjs"
]);

/** The line `actionText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const ACTION_FAMILY_END = "const ACTION_FAMILY_END = {};";

/**
 * The action family's texts, raw, in ACTION_FAMILY's order, joined by the line `const ACTION_FAMILY_END = {};` (E41 C3):
 * what a read of action-rolls.mjs's whole text read while the actions were one file. A reader strips the comments
 * itself, as it did; a `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the
 * family that is not among `sources` refuses by `must`, by name.
 */
function actionText(sources, family = ACTION_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the action family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${ACTION_FAMILY_END}\n`);
}

/**
 * The stash's family (E41 C6): vault.mjs - the facade, which holds no code since C6 - and the files its code moved
 * into, in the order it stood there: the stash's record and the rooms' flags (vault-store.mjs), what a character does
 * at a stash and a GM judges of it (stash-reach.mjs), the GM's side of a Palm (palm.mjs, which holds the player's half
 * as well and is of the action family too) and Room Setup (room-setup.mjs). passages-tab.mjs is not of the family (E79
 * C5: a file of its own, which Room Setup reaches by `import()`). A reader of vault.mjs's text reads the family through
 * `vaultText` and follows each file here without a repoint of its own.
 */
const VAULT_FAMILY = Object.freeze(["vault.mjs", "vault-store.mjs", "stash-reach.mjs", "palm.mjs", "room-setup.mjs"]);

/** The line `vaultText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const VAULT_FAMILY_END = "const VAULT_FAMILY_END = {};";

/**
 * The stash's family's texts, raw, in VAULT_FAMILY's order, joined by the line `const VAULT_FAMILY_END = {};` (E41 C6):
 * what a read of vault.mjs's whole text read while the stash was one file, and palm.mjs's player half beside it. A
 * reader strips the comments itself, as it did; a `fnSource` or `topLevelFunction` of the text cuts a function in its
 * own file. A file of the family that is not among `sources` refuses by `must`, by name.
 */
function vaultText(sources, family = VAULT_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the stash's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${VAULT_FAMILY_END}\n`);
}

/**
 * The GM panel's family (E41 C7a): gm-panel.mjs - the facade, which keeps the panel, its sections and its other
 * windows - and the files two of its windows moved into, in the order they stood there: the Students window
 * (gm-students.mjs) and Edit campaign (gm-campaign.mjs). A reader of gm-panel.mjs's text reads the family through
 * `panelText` and follows each file here without a repoint of its own.
 */
const PANEL_FAMILY = Object.freeze(["gm-panel.mjs", "gm-students.mjs", "gm-campaign.mjs"]);

/** The line `panelText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const PANEL_FAMILY_END = "const PANEL_FAMILY_END = {};";

/**
 * The GM panel's family's texts, raw, in PANEL_FAMILY's order, joined by the line `const PANEL_FAMILY_END = {};` (E41
 * C7a): what a read of gm-panel.mjs's whole text read while the panel was one file. A reader strips the comments
 * itself, as it did; a `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the
 * family that is not among `sources` refuses by `must`, by name.
 */
function panelText(sources, family = PANEL_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the GM panel's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${PANEL_FAMILY_END}\n`);
}

/**
 * The HUD's family (E41 C7b): hud.mjs - the facade, which keeps the clock's widget, its rows and its controls - and
 * the file the stopwatch moved into with the clock it shows (hud-elapsed.mjs). A reader of hud.mjs's text reads the
 * family through `hudText` and follows each file here without a repoint of its own.
 */
const HUD_FAMILY = Object.freeze(["hud.mjs", "hud-elapsed.mjs"]);

/** The line `hudText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const HUD_FAMILY_END = "const HUD_FAMILY_END = {};";

/**
 * The HUD's family's texts, raw, in HUD_FAMILY's order, joined by the line `const HUD_FAMILY_END = {};` (E41 C7b):
 * what a read of hud.mjs's whole text read while the HUD was one file. A reader strips the comments itself, as it
 * did; a `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that is
 * not among `sources` refuses by `must`, by name.
 */
function hudText(sources, family = HUD_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the HUD's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${HUD_FAMILY_END}\n`);
}

/**
 * The item tables' family (E41 C8): tables.mjs - the facade, which holds no code since C8 - and the files its code
 * moved into, in the order it stood there: a table's names, the pools, the roles, the draw and the index
 * (tables-pools.mjs), then Install and the item tables window (tables-editor.mjs). A reader of tables.mjs's text reads
 * the family through `tablesText` and follows each file here without a repoint of its own.
 */
const TABLES_FAMILY = Object.freeze(["tables.mjs", "tables-pools.mjs", "tables-editor.mjs"]);

/** The line `tablesText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const TABLES_FAMILY_END = "const TABLES_FAMILY_END = {};";

/**
 * The item tables' family's texts, raw, in TABLES_FAMILY's order, joined by the line `const TABLES_FAMILY_END = {};`
 * (E41 C8): what a read of tables.mjs's whole text read while the tables were one file. A reader strips the comments
 * itself, as it did; a `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the
 * family that is not among `sources` refuses by `must`, by name.
 */
function tablesText(sources, family = TABLES_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the item tables' family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${TABLES_FAMILY_END}\n`);
}

/**
 * The music's family (E41 C9a): music.mjs - the facade, which keeps `nowPlayingHere` and `diagnoseMusic` - and the
 * files its code moved into, in the order their first statement stood there: the engine (music-play.mjs), the states
 * and the map (music-states.mjs), the Sound window (sound-panel.mjs) and the murder music (murder-music.mjs). A reader
 * of music.mjs's text reads the family through `musicText` and follows each file here without a repoint of its own.
 */
const MUSIC_FAMILY = Object.freeze(["music.mjs", "music-play.mjs", "music-states.mjs", "sound-panel.mjs", "murder-music.mjs"]);

/** The line `musicText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const MUSIC_FAMILY_END = "const MUSIC_FAMILY_END = {};";

/**
 * The music's family's texts, raw, in MUSIC_FAMILY's order, joined by the line `const MUSIC_FAMILY_END = {};` (E41
 * C9a): what a read of music.mjs's whole text read while the music was one file. A reader strips the comments itself,
 * as it did; a `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that
 * is not among `sources` refuses by `must`, by name.
 */
function musicText(sources, family = MUSIC_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the music's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${MUSIC_FAMILY_END}\n`);
}

/**
 * The sound engine's family (E41 C9a): sfx.mjs - the facade, which keeps `registerSfx`, its listeners, the unlock and
 * `diagnoseSfx`, and the Sound window's sliders, Effects tab and launcher (they stay: in sound-panel.mjs they close a
 * static import cycle; E41-16, carried to E73) - and the file its player moved into (sfx-play.mjs). A reader of
 * sfx.mjs's text reads the family through `sfxText`.
 */
const SFX_FAMILY = Object.freeze(["sfx.mjs", "sfx-play.mjs"]);

/** The line `sfxText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const SFX_FAMILY_END = "const SFX_FAMILY_END = {};";

/**
 * The sound engine's family's texts, raw, in SFX_FAMILY's order, joined by the line `const SFX_FAMILY_END = {};` (E41
 * C9a): what a read of sfx.mjs's whole text read while the engine was one file. A reader strips the comments itself, as
 * it did; a `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that is
 * not among `sources` refuses by `must`, by name.
 */
function sfxText(sources, family = SFX_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the sound engine's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${SFX_FAMILY_END}\n`);
}

/**
 * The vote's family (E41 C10a): vote.mjs - the facade, which keeps the ballots, the rounds, the count and
 * `trialParticipants` - and the files its code moved into, in the order their first statement stood there: the trial's
 * record and the sentence (trial-progress.mjs), then the ordinary verdict (verdict.mjs). A reader of vote.mjs's text
 * reads the family through `voteText` and follows each file here without a repoint of its own.
 */
const VOTE_FAMILY = Object.freeze(["vote.mjs", "trial-progress.mjs", "verdict.mjs"]);

/** The line `voteText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const VOTE_FAMILY_END = "const VOTE_FAMILY_END = {};";

/**
 * The vote's family's texts, raw, in VOTE_FAMILY's order (or the order a reader hands in), joined by the line
 * `const VOTE_FAMILY_END = {};` (E41 C10a): what a read of vote.mjs's whole text read while the vote, the record and the
 * verdict were one file. A reader strips the comments itself, as it did; a `fnSource` or `topLevelFunction` of the text
 * cuts a function in its own file. A file of the family that is not among `sources` refuses by `must`, by name.
 */
function voteText(sources, family = VOTE_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string");
    must(!gone.length, `${gone.join(", ")}, of the vote's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${VOTE_FAMILY_END}\n`);
}

/**
 * The cleanup's family (E54): cleanup.mjs - the facade, which keeps everything else - and the files its
 * code moved into, in the order of the split's manifest (tools/e54/cleanup-reshape.json): cleanup-reshape.mjs.
 * Written by tools/e54/repoint.mjs from that manifest. A reader of cleanup.mjs's text reads the family through `cleanupText`
 * (or `cleanupFetch`, or `cleanupBy` over a helper of its own) and follows each file here without a repoint of its own.
 */
const CLEANUP_FAMILY = Object.freeze(["cleanup.mjs", "cleanup-reshape.mjs"]);

/** The line `cleanupText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const CLEANUP_FAMILY_END = "const CLEANUP_FAMILY_END = {};";

/**
 * The cleanup's family's texts, raw, in CLEANUP_FAMILY's order, joined by the line `const CLEANUP_FAMILY_END = {};` (E54):
 * what a read of cleanup.mjs's whole text read while it was one file. A reader strips the comments itself, as it did; a
 * `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that is not among
 * `sources` refuses by `must`, by name.
 */
function cleanupText(sources, family = CLEANUP_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string" || !map.get(file).length);
    must(!gone.length, `${gone.join(", ")}, of the cleanup's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${CLEANUP_FAMILY_END}\n`);
}

/** `cleanupText` of the family as this browser is served it: what a `fetch` of cleanup.mjs's URL read while it was one file. */
async function cleanupFetch(family = CLEANUP_FAMILY) {
    return cleanupText(await Promise.all(family.map(async file => [file, await fetch(`/modules/${MODULE_ID}/scripts/${file}`).then(lfText)])), family);
}

/**
 * A test's own reader of one file, run over every file of the cleanup's family: texts joined as `cleanupText` joins them,
 * sets united. An empty text, an empty union or a reader that answers anything else refuses by `must`.
 */
function cleanupBy(reader, family = CLEANUP_FAMILY) {
    const parts = family.map(file => [file, reader(file)]);
    if (parts.every(([, value]) => typeof value === "string")) {
        const empty = parts.filter(([, value]) => !value.length).map(([file]) => file);
        must(!empty.length, `${empty.join(", ")}, of the cleanup's family, read as nothing - this reads nothing of ${empty.length > 1 ? "them" : "it"}`);
        return parts.map(([, value]) => value).join(`\n${CLEANUP_FAMILY_END}\n`);
    }
    must(parts.every(([, value]) => value instanceof Set), "a reader of the cleanup's family answered neither a text nor a set for every file");
    const all = new Set(parts.flatMap(([, value]) => [...value]));
    must(all.size > 0, "the cleanup's family read as an empty set - this reads nothing");
    return all;
}

/**
 * The investigation's family (E54): investigation.mjs - the facade, which keeps everything else - and the files its
 * code moved into, in the order of the split's manifest (tools/e54/key-remnants.json): key-remnants.mjs.
 * Written by tools/e54/repoint.mjs from that manifest. A reader of investigation.mjs's text reads the family through `investigationText`
 * (or `investigationFetch`, or `investigationBy` over a helper of its own) and follows each file here without a repoint of its own.
 */
const INVESTIGATION_FAMILY = Object.freeze(["investigation.mjs", "key-remnants.mjs"]);

/** The line `investigationText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const INVESTIGATION_FAMILY_END = "const INVESTIGATION_FAMILY_END = {};";

/**
 * The investigation's family's texts, raw, in INVESTIGATION_FAMILY's order, joined by the line `const INVESTIGATION_FAMILY_END = {};` (E54):
 * what a read of investigation.mjs's whole text read while it was one file. A reader strips the comments itself, as it did; a
 * `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that is not among
 * `sources` refuses by `must`, by name.
 */
function investigationText(sources, family = INVESTIGATION_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string" || !map.get(file).length);
    must(!gone.length, `${gone.join(", ")}, of the investigation's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${INVESTIGATION_FAMILY_END}\n`);
}

/** `investigationText` of the family as this browser is served it: what a `fetch` of investigation.mjs's URL read while it was one file. */
async function investigationFetch(family = INVESTIGATION_FAMILY) {
    return investigationText(await Promise.all(family.map(async file => [file, await fetch(`/modules/${MODULE_ID}/scripts/${file}`).then(lfText)])), family);
}

/**
 * A test's own reader of one file, run over every file of the investigation's family: texts joined as `investigationText` joins them,
 * sets united. An empty text, an empty union or a reader that answers anything else refuses by `must`.
 */
function investigationBy(reader, family = INVESTIGATION_FAMILY) {
    const parts = family.map(file => [file, reader(file)]);
    if (parts.every(([, value]) => typeof value === "string")) {
        const empty = parts.filter(([, value]) => !value.length).map(([file]) => file);
        must(!empty.length, `${empty.join(", ")}, of the investigation's family, read as nothing - this reads nothing of ${empty.length > 1 ? "them" : "it"}`);
        return parts.map(([, value]) => value).join(`\n${INVESTIGATION_FAMILY_END}\n`);
    }
    must(parts.every(([, value]) => value instanceof Set), "a reader of the investigation's family answered neither a text nor a set for every file");
    const all = new Set(parts.flatMap(([, value]) => [...value]));
    must(all.size > 0, "the investigation's family read as an empty set - this reads nothing");
    return all;
}

/**
 * The settings's family (E54): settings.mjs - the facade, which keeps everything else - and the files its
 * code moved into, in the order of the split's manifest (tools/e54/windows-settings.json): window-scale.mjs.
 * Written by tools/e54/repoint.mjs from that manifest. A reader of settings.mjs's text reads the family through `settingsText`
 * (or `settingsFetch`, or `settingsBy` over a helper of its own) and follows each file here without a repoint of its own.
 */
const SETTINGS_FAMILY = Object.freeze(["settings.mjs", "window-scale.mjs"]);

/** The line `settingsText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const SETTINGS_FAMILY_END = "const SETTINGS_FAMILY_END = {};";

/**
 * The settings's family's texts, raw, in SETTINGS_FAMILY's order, joined by the line `const SETTINGS_FAMILY_END = {};` (E54):
 * what a read of settings.mjs's whole text read while it was one file. A reader strips the comments itself, as it did; a
 * `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that is not among
 * `sources` refuses by `must`, by name.
 */
function settingsText(sources, family = SETTINGS_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string" || !map.get(file).length);
    must(!gone.length, `${gone.join(", ")}, of the settings's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${SETTINGS_FAMILY_END}\n`);
}

/** `settingsText` of the family as this browser is served it: what a `fetch` of settings.mjs's URL read while it was one file. */
async function settingsFetch(family = SETTINGS_FAMILY) {
    return settingsText(await Promise.all(family.map(async file => [file, await fetch(`/modules/${MODULE_ID}/scripts/${file}`).then(lfText)])), family);
}

/**
 * A test's own reader of one file, run over every file of the settings's family: texts joined as `settingsText` joins them,
 * sets united. An empty text, an empty union or a reader that answers anything else refuses by `must`.
 */
function settingsBy(reader, family = SETTINGS_FAMILY) {
    const parts = family.map(file => [file, reader(file)]);
    if (parts.every(([, value]) => typeof value === "string")) {
        const empty = parts.filter(([, value]) => !value.length).map(([file]) => file);
        must(!empty.length, `${empty.join(", ")}, of the settings's family, read as nothing - this reads nothing of ${empty.length > 1 ? "them" : "it"}`);
        return parts.map(([, value]) => value).join(`\n${SETTINGS_FAMILY_END}\n`);
    }
    must(parts.every(([, value]) => value instanceof Set), "a reader of the settings's family answered neither a text nor a set for every file");
    const all = new Set(parts.flatMap(([, value]) => [...value]));
    must(all.size > 0, "the settings's family read as an empty set - this reads nothing");
    return all;
}

/**
 * The utils's family (E54): utils.mjs - the facade, which keeps everything else - and the files its
 * code moved into, in the order of the split's manifest (tools/e54/windows.json): windows.mjs.
 * Written by tools/e54/repoint.mjs from that manifest. A reader of utils.mjs's text reads the family through `utilsText`
 * (or `utilsFetch`, or `utilsBy` over a helper of its own) and follows each file here without a repoint of its own.
 */
const UTILS_FAMILY = Object.freeze(["utils.mjs", "windows.mjs"]);

/** The line `utilsText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const UTILS_FAMILY_END = "const UTILS_FAMILY_END = {};";

/**
 * The utils's family's texts, raw, in UTILS_FAMILY's order, joined by the line `const UTILS_FAMILY_END = {};` (E54):
 * what a read of utils.mjs's whole text read while it was one file. A reader strips the comments itself, as it did; a
 * `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that is not among
 * `sources` refuses by `must`, by name.
 */
function utilsText(sources, family = UTILS_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string" || !map.get(file).length);
    must(!gone.length, `${gone.join(", ")}, of the utils's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${UTILS_FAMILY_END}\n`);
}

/** `utilsText` of the family as this browser is served it: what a `fetch` of utils.mjs's URL read while it was one file. */
async function utilsFetch(family = UTILS_FAMILY) {
    return utilsText(await Promise.all(family.map(async file => [file, await fetch(`/modules/${MODULE_ID}/scripts/${file}`).then(lfText)])), family);
}

/**
 * A test's own reader of one file, run over every file of the utils's family: texts joined as `utilsText` joins them,
 * sets united. An empty text, an empty union or a reader that answers anything else refuses by `must`.
 */
function utilsBy(reader, family = UTILS_FAMILY) {
    const parts = family.map(file => [file, reader(file)]);
    if (parts.every(([, value]) => typeof value === "string")) {
        const empty = parts.filter(([, value]) => !value.length).map(([file]) => file);
        must(!empty.length, `${empty.join(", ")}, of the utils's family, read as nothing - this reads nothing of ${empty.length > 1 ? "them" : "it"}`);
        return parts.map(([, value]) => value).join(`\n${UTILS_FAMILY_END}\n`);
    }
    must(parts.every(([, value]) => value instanceof Set), "a reader of the utils's family answered neither a text nor a set for every file");
    const all = new Set(parts.flatMap(([, value]) => [...value]));
    must(all.size > 0, "the utils's family read as an empty set - this reads nothing");
    return all;
}

/**
 * The sheet's family (E54): sheet.mjs - the facade, which keeps `registerSheetTweaks`, `SHEET_STEPS`, `runSheetSteps`, `onRenderCharacterSheet` - and the files its
 * code moved into, in the order of the split's manifest (tools/e54/sheet.json): sheet-mode.mjs, sheet-item.mjs, sheet-repaint.mjs, sheet-fit.mjs, sheet-header.mjs, sheet-sidebar.mjs, sheet-inventory.mjs, sheet-actions.mjs.
 * Written by tools/e54/repoint.mjs from that manifest. A reader of sheet.mjs's text reads the family through `sheetText`
 * (or `sheetFetch`, or `sheetBy` over a helper of its own) and follows each file here without a repoint of its own.
 */
const SHEET_FAMILY = Object.freeze(["sheet.mjs", "sheet-mode.mjs", "sheet-item.mjs", "sheet-repaint.mjs", "sheet-fit.mjs", "sheet-header.mjs", "sheet-sidebar.mjs", "sheet-inventory.mjs", "sheet-actions.mjs"]);

/** The line `sheetText` puts between two files: `topLevelFunction`'s second end, so no cut runs on into the next file. */
const SHEET_FAMILY_END = "const SHEET_FAMILY_END = {};";

/**
 * The sheet's family's texts, raw, in SHEET_FAMILY's order, joined by the line `const SHEET_FAMILY_END = {};` (E54):
 * what a read of sheet.mjs's whole text read while it was one file. A reader strips the comments itself, as it did; a
 * `fnSource` or `topLevelFunction` of the text cuts a function in its own file. A file of the family that is not among
 * `sources` refuses by `must`, by name.
 */
function sheetText(sources, family = SHEET_FAMILY) {
    const map = sources instanceof Map ? sources : new Map(sources);
    const gone = family.filter(file => typeof map.get(file) !== "string" || !map.get(file).length);
    must(!gone.length, `${gone.join(", ")}, of the sheet's family, ${gone.length > 1 ? "are" : "is"} not among the sources - this reads nothing of ${gone.length > 1 ? "them" : "it"}`);
    return family.map(file => map.get(file)).join(`\n${SHEET_FAMILY_END}\n`);
}

/** `sheetText` of the family as this browser is served it: what a `fetch` of sheet.mjs's URL read while it was one file. */
async function sheetFetch(family = SHEET_FAMILY) {
    return sheetText(await Promise.all(family.map(async file => [file, await fetch(`/modules/${MODULE_ID}/scripts/${file}`).then(lfText)])), family);
}

/**
 * A test's own reader of one file, run over every file of the sheet's family: texts joined as `sheetText` joins them,
 * sets united. An empty text, an empty union or a reader that answers anything else refuses by `must`.
 */
function sheetBy(reader, family = SHEET_FAMILY) {
    const parts = family.map(file => [file, reader(file)]);
    if (parts.every(([, value]) => typeof value === "string")) {
        const empty = parts.filter(([, value]) => !value.length).map(([file]) => file);
        must(!empty.length, `${empty.join(", ")}, of the sheet's family, read as nothing - this reads nothing of ${empty.length > 1 ? "them" : "it"}`);
        return parts.map(([, value]) => value).join(`\n${SHEET_FAMILY_END}\n`);
    }
    must(parts.every(([, value]) => value instanceof Set), "a reader of the sheet's family answered neither a text nor a set for every file");
    const all = new Set(parts.flatMap(([, value]) => [...value]));
    must(all.size > 0, "the sheet's family read as an empty set - this reads nothing");
    return all;
}

/**
 * Everything wrong with the bridge's tables, one sentence each (R1b). Pure: it
 * is handed the tables (as `bridgeTables()` gives them), the language keys of
 * each file, flattened, and bridge-guards.mjs's namespace, so R1b can run it on
 * a fixture with known faults before it runs it on the module.
 *
 *   1. the label is `DRPG.Bridge.what.<action>`, in en and pl;
 *   2. guards is a list, empty only with a written `why`; sanitize was made by
 *      `pick`; run is a function; answer is none, ack or reply; a "none" is quiet;
 *   3. every guard (and every `runGuards` entry) is exported by
 *      bridge-guards.mjs, made by one of its factories, or a `guard<Name>`
 *      exported by the table's own file (counted, as `local`);
 *   4. the first guard is `knownSender` or a `gmOnly`, or reads no sender and is
 *      followed by `knownSender`;
 *   5. (retired with the Reroll receipts in E08+E28 C8: a guard that spent one
 *      was the last);
 *   6. every id or raw field the run receives is covered: by a factory guard
 *      that names it, or by a claim - a guard of the declaration whose source
 *      reads `payload.<field>`, or a written reason of at least 20 characters;
 *      and a field named as an id (`...Id`) is sanitized `as.id`, so it is one of
 *      them (E31 review: as text it would pass this step unjudged);
 *   7. every `runGuards` entry is named in the run, or in a function of the
 *      table's file or its family the run names (`bridgeCut`, E41 C2);
 *   8. every code of `reasons` has its sentence, `DRPG.Bridge.why.<code>`, in en
 *      and pl, and so has the message they are said in (`notDone`,
 *      `nothingSpent`); every request named to `tellRefused` outside the runner
 *      (`told`: relay-guard.mjs's "daggerheart") has its label; and a
 *      declaration's `tell`, the one code its refusals are told with, is a code
 *      of `reasons`;
 *   9. a queued declaration answers "reply": the runner acknowledges it as it
 *      arrives, before its guards, so only its answer says it was done.
 */
function bridgeTableProblems(tables, { en, pl, guards, reasons = [], told = [] }) {
    const problems = [], local = [];
    let actions = 0, withIds = 0, byGuardClaim = 0, inWords = 0;
    const source = fn => String(fn ?? "");
    const exported = new Set(Object.values(guards).filter(value => typeof value === "function"));
    const FACTORIES = ["owns", "ownsActorAt", "notSpectator", "gmOnly", "playersOnly", "canSeeProject", "inRange"];
    // Past the parameter list: every guard takes `sender`, and only a body can be said to read it.
    const readsSender = fn => /\bsender\b/.test(source(fn).replace(/^[^)]*\)/, ""));
    const readsField = (fn, field) => new RegExp(`\\bpayload\\??\\.${field}\\b`).test(source(fn));
    for (const entry of tables) {
        const { file, table, module } = entry;
        for (const [action, decl] of Object.entries(table)) {
            actions++;
            const at = `${file} ${action}`;
            const label = `DRPG.Bridge.what.${action}`;
            if (decl.label !== label) problems.push(`${at}: its label is ${JSON.stringify(decl.label)}, not ${label}`);
            else for (const [lang, keys] of [["en", en], ["pl", pl]]) if (!keys.has(label)) problems.push(`${at}: ${label} is missing in ${lang}.json`);

            const list = Array.isArray(decl.guards) ? decl.guards : null;
            if (!list) problems.push(`${at}: guards is not a list`);
            else if (!list.length && String(decl.why ?? "").trim().length < 20) problems.push(`${at}: no guard, and no written why`);
            if (typeof decl.sanitize !== "function" || decl.sanitize.picked !== true) problems.push(`${at}: sanitize was not made by pick`);
            if (typeof decl.run !== "function") problems.push(`${at}: run is not a function`);
            if (!["none", "ack", "reply"].includes(decl.answer)) problems.push(`${at}: answer is ${JSON.stringify(decl.answer)}, not none, ack or reply`);
            if (decl.answer === "none" && !decl.quiet) problems.push(`${at}: nobody is waiting on it, and it is not quiet`);
            if (decl.tell !== undefined && !reasons.includes(decl.tell)) {
                problems.push(`${at}: it tells its refusals as ${JSON.stringify(decl.tell)}, which is not a code of the closed list`);
            }
            if (decl.queue && decl.answer !== "reply") {
                problems.push(`${at}: it waits in the ${JSON.stringify(decl.queue)} queue, is acknowledged as it arrives, and answers ${JSON.stringify(decl.answer)}, not reply`);
            }

            const all = [...(list ?? []), ...(decl.runGuards ?? [])];
            for (const guard of all) {
                if (typeof guard !== "function") { problems.push(`${at}: a guard is not a function`); continue; }
                if (exported.has(guard) || (FACTORIES.includes(guard.factory) && typeof guards[guard.factory] === "function")) continue;
                if (/^guard[A-Z]\w*$/.test(guard.name) && module?.[guard.name] === guard) { local.push(`${file} ${guard.name}`); continue; }
                problems.push(`${at}: ${guard.name || "an unnamed guard"} is not exported by bridge-guards.mjs, made by one of its factories, or a guard<Name> exported by ${file}`);
            }

            if (list?.length) {
                const [first, second] = list;
                const opens = first === guards.knownSender || first?.factory === "gmOnly"
                    || (typeof first === "function" && !readsSender(first) && second === guards.knownSender);
                if (!opens) problems.push(`${at}: its first guard is not knownSender or gmOnly, nor a check that reads no sender followed by knownSender`);
            }

            const kinds = decl.sanitize?.fields ?? {};
            for (const field of Object.keys(kinds)) {
                if (/Id$/.test(field) && kinds[field] !== "id") problems.push(`${at}: ${field} names an id and is sanitized as ${kinds[field]}, not as.id`);
            }
            const judged = Object.keys(kinds).filter(field => kinds[field] === "id" || kinds[field] === "raw");
            if (judged.length) withIds++;
            for (const field of judged) {
                if (all.some(guard => guard?.covers?.includes(field))) continue;
                const claim = decl.claims?.[field];
                if (typeof claim === "function" && list?.includes(claim) && readsField(claim, field)) { byGuardClaim++; continue; }
                if (typeof claim === "string" && claim.trim().length >= 20) { inWords++; continue; }
                problems.push(`${at}: ${field} reaches the run with no guard naming it and no claim saying who judges it`);
            }

            if (decl.runGuards?.length) {
                const run = source(decl.run);
                const named = [...run.matchAll(/\b([A-Za-z_]\w*)\(/g)].map(m => bridgeCut(entry, m[1])?.source).filter(Boolean).join("\n");
                for (const guard of decl.runGuards) {
                    if (!new RegExp(`\\b${guard.name}\\b`).test(`${run}\n${named}`)) problems.push(`${at}: runGuards names ${guard.name}, which its run never asks`);
                }
            }
        }
    }
    const said = [...reasons.map(code => [`DRPG.Bridge.why.${code}`, `reason ${code}`]),
        ["DRPG.Bridge.notDone", "the message"], ["DRPG.Bridge.nothingSpent", "the message"],
        ...told.map(what => [`DRPG.Bridge.what.${what}`, `tellRefused names "${what}"`])];
    for (const [key, whose] of said) {
        for (const [lang, keys] of [["en", en], ["pl", pl]]) if (!keys.has(key)) problems.push(`${whose}: ${key} is missing in ${lang}.json`);
    }
    return { problems, local, actions, withIds, byGuardClaim, inWords };
}

/**
 * Every field a declaration's run reads off `payload` (R163): in the run, in the
 * functions it hands `payload` to (followed, through `lookup`, which gives a
 * function's source by name or null), and in its `runGuards`, which are asked
 * with the run's copy. `unreadable` names the forms a text reader cannot follow
 * - a computed read, a spread, a destructuring of the whole packet - which R163
 * fails rather than skips; `missing` the names it hands `payload` to that `lookup`
 * cannot find, which R163 fails on too (E41 fix FG3, the end review's S-m2): a helper
 * moved into a file outside the table's family was skipped here without a word, and
 * a field the whitelist drops read as nothing.
 */
function payloadReads(decl, lookup) {
    const sources = [], seen = new Set(), missing = [];
    const queue = [stripComments(String(decl.run ?? ""))];
    while (queue.length) {
        const source = queue.shift();
        sources.push(source);
        // A call, not a declaration: a run's own `function name(payload, ...)` line names no function it hands its packet to.
        for (const m of source.matchAll(/(?<!\bfunction\s+)\b([A-Za-z_$][\w$]*)\(([^()]*)\)/g)) {
            if (!/(?:^|[\s,(])payload\s*(?:,|$)/.test(m[2]) || seen.has(m[1])) continue;
            seen.add(m[1]);
            const found = lookup(m[1]);
            if (found) queue.push(stripComments(found));
            else missing.push(m[1]);
        }
    }
    for (const guard of decl.runGuards ?? []) sources.push(stripComments(String(guard)));
    const fields = new Set(), unreadable = new Set();
    for (const source of sources) {
        for (const m of source.matchAll(/\bpayload\??\.([A-Za-z_$][\w$]*)/g)) fields.add(m[1]);
        if (/\bpayload\s*\??\.?\s*\[/.test(source)) unreadable.add("payload[...]");
        if (/\.\.\.\s*payload\b(?!\s*\??\.)/.test(source)) unreadable.add("...payload");
        if (/\}\s*=\s*payload\b(?!\s*\??\.)/.test(source)) unreadable.add("{ ... } = payload");
    }
    return { fields: [...fields].sort(), unreadable: [...unreadable], handedTo: [...seen], missing };
}

/*
 * EVERY REASON THE BRIDGE CAN REFUSE WITH, READ OUT OF THE SOURCE (E31, 25.09.2026).
 *
 * A player is told why a request was not carried out by a code of the closed
 * list in bridge-guards.mjs (`REASONS`), which `reasonOf` reads off the English
 * reason with an ordered list of patterns. A reason no pattern takes is still
 * refused, and the player is told only that - the one sentence that says
 * nothing. So R164 reads every reason the bridge can give and holds each to
 * exactly one pattern, and this is the reader: pure, handed the functions to
 * read, so the test runs it on a fixture with planted faults first.
 *
 * A reason is a string or template literal standing where a reason stands, by
 * what the function is (`reads`):
 *   "returns"  a guard, or a function whose return value is the reason: what a
 *              `return` gives, either branch of a returned `?:`, either side of `??`;
 *   "why"      a function answering `{ why }` (crisisRefusal): the value of `why:`;
 *   "refused"  a run, or a resolver answering `{ refused }`: the value of `refused:`;
 *   "refuse"   the runner: the second argument of each `refuse(` call.
 * A template's `${...}` is read as "7". What it cannot read, it names rather
 * than skips: a value in one of those places that is not a literal, null, or a
 * call of a function on the `delegates` list (or `firstRefusal`) - unless it is
 * a plain name or a member of one, in a function that asks a listed function,
 * which is where such a name gets its reason (`twice`, `result.refused`). And a
 * call of any `...Refusal(` function that is not on the list, so a new one
 * cannot be missed. `texts` are reasons read elsewhere (the factories' guards
 * carry theirs). Every code a pattern names must be on the list, and every
 * pattern's code must take at least one reason read, or the pattern is dead.
 *
 * @returns {{problems: string[], texts: {text: string, from: string, code: string|null}[], byCode: Map<string, number>}}
 */
function refusalProblems({ functions = [], texts = [], delegates = new Set(), patterns = [], reasons = [] }) {
    const problems = [], read = [...texts];
    const asks = new Set([...delegates, "firstRefusal"]);
    for (const { name, source, reads } of functions) {
        const code = stripComments(String(source ?? ""));
        const blank = blankLiterals(code);
        const all = stringLiterals(code);
        const literals = all.filter(l => !all.some(o => o !== l && o.start <= l.start && l.end <= o.end));
        // The code with each literal gone whole, holes and all: what the shape of an expression is read from.
        const units = blank.split("");
        for (const l of literals) for (let i = l.start; i < l.end; i++) if (units[i] !== "\n") units[i] = " ";
        const flat = units.join("");
        const callsListed = [...blank.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].some(m => asks.has(m[1]));
        const opens = c => c === "(" || c === "[" || c === "{";
        const closes = c => c === ")" || c === "]" || c === "}";
        // Where the expression that starts at `from` ends: one of `stops`, or a closing bracket, at its own depth.
        const endOf = (from, stops) => {
            let depth = 0, i = from;
            for (; i < flat.length; i++) {
                const c = flat[i];
                if (opens(c)) depth++;
                else if (closes(c)) { if (!depth) break; depth--; }
                else if (!depth && stops.includes(c)) break;
            }
            return i;
        };
        // A `?` of a conditional, not of `?.` or `??`.
        const conditional = i => flat[i] === "?" && flat[i + 1] !== "." && flat[i + 1] !== "?" && flat[i - 1] !== "?";
        // The first top-level `?` of a conditional in [s, e), and its `:`.
        const ternary = (s, e) => {
            let depth = 0;
            for (let i = s; i < e; i++) {
                if (opens(flat[i])) depth++;
                else if (closes(flat[i])) depth--;
                else if (!depth && conditional(i)) {
                    let inner = 0, d = 0;
                    for (let j = i + 1; j < e; j++) {
                        if (opens(flat[j])) d++;
                        else if (closes(flat[j])) d--;
                        else if (!d && conditional(j)) inner++;
                        else if (!d && flat[j] === ":") { if (!inner) return [i, j]; inner--; }
                    }
                    return null;
                }
            }
            return null;
        };
        const nullish = (s, e) => {
            let depth = 0;
            for (let i = s; i < e - 1; i++) {
                if (opens(flat[i])) depth++;
                else if (closes(flat[i])) depth--;
                else if (!depth && flat[i] === "?" && flat[i + 1] === "?") return i;
            }
            return -1;
        };
        const take = (s, e, what) => {
            // Trimmed on the code itself: in `flat` a literal is blank, and would be trimmed away.
            const a = s + /^\s*(?:await\s+)?/.exec(code.slice(s, e))[0].length;
            let b = e;
            while (b > a && /\s/.test(code[b - 1])) b--;
            const whole = literals.find(l => l.start === a && l.end === b);
            if (whole) {
                // A value put in front of the module's own words could choose the reason's code.
                if (whole.text.startsWith("${}")) problems.push(`${name}: ${what} a reason that begins with a value put into it, ${JSON.stringify(whole.text)}`);
                read.push({ text: whole.text.replaceAll("${}", "7"), from: name });
                return;
            }
            const shape = flat.slice(a, b);
            if (!shape || /^(?:null|undefined|true|false)$/.test(shape)) return;
            const branch = ternary(a, b);
            if (branch) { take(branch[0] + 1, branch[1], what); take(branch[1] + 1, b, what); return; }
            const either = nullish(a, b);
            if (either >= 0) { take(a, either, what); take(either + 2, b, what); return; }
            if (flat[a] === "(" && endOf(a + 1, "") === b - 1) { take(a + 1, b - 1, what); return; }
            const call = /^([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)\s*\(/.exec(shape);
            if (call) {
                const callee = call[1].split(/\??\./).pop();
                // A `...Refusal(` that is not on the list is named once, by the scan below.
                if (!asks.has(callee) && !/Refusal$/.test(callee)) problems.push(`${name}: ${what} what ${callee}() gives, and ${callee} is not on the list of functions a refusal is handed to`);
                return;
            }
            if (/^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*$/.test(shape) && callsListed) return;
            problems.push(`${name}: ${what} ${JSON.stringify(code.slice(a, b).slice(0, 80))}, which this reader cannot hold to a reason`);
        };
        if (reads === "returns") {
            for (const m of flat.matchAll(/\breturn\b/g)) take(m.index + 6, endOf(m.index + 6, ";"), "returns");
        } else if (reads === "why" || reads === "refused") {
            for (const m of flat.matchAll(new RegExp(`[{,]\\s*${reads}\\s*([:,}])`, "g"))) {
                if (m[1] !== ":") {
                    if (!callsListed) problems.push(`${name}: answers { ${reads} } by name, and asks no listed function for it`);
                    continue;
                }
                const at = m.index + m[0].length;
                take(at, endOf(at, ","), `answers ${reads}:`);
            }
        } else if (reads === "refuse") {
            for (const m of flat.matchAll(/\brefuse\s*\(/g)) {
                const first = endOf(m.index + m[0].length, ",");
                if (flat[first] !== ",") continue;
                const second = endOf(first + 1, ",");
                // A name hands on a reason read elsewhere - a guard's, a run's.
                if (/^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*$/.test(flat.slice(first + 1, second).trim())) continue;
                take(first + 1, second, "refuses with");
            }
        }
        for (const m of blank.matchAll(/\b([A-Za-z_$][\w$]*Refusal)\s*\(/g)) {
            if (asks.has(m[1]) || /\bfunction\s+$/.test(blank.slice(Math.max(0, m.index - 20), m.index))) continue;
            problems.push(`${name}: calls ${m[1]}(), which is not on the list of functions a refusal is handed to`);
        }
    }
    const byCode = new Map(), live = new Set();
    for (const entry of read) {
        const taken = patterns.filter(([, pattern]) => pattern.test(entry.text));
        entry.code = taken.length === 1 ? taken[0][0] : null;
        for (const [code] of taken) live.add(code);
        if (taken.length === 1) byCode.set(entry.code, (byCode.get(entry.code) ?? 0) + 1);
        else if (!taken.length) problems.push(`${entry.from}: ${JSON.stringify(entry.text)} is taken by no reason of the closed list`);
        else problems.push(`${entry.from}: ${JSON.stringify(entry.text)} is taken by ${taken.length} patterns (${taken.map(([c]) => c).join(", ")})`);
    }
    for (const code of new Set(patterns.map(([c]) => c))) {
        if (!reasons.includes(code)) problems.push(`a pattern names ${code}, which is not on the closed list`);
        else if (!live.has(code)) problems.push(`${code}: no reason read takes its pattern - it is dead, or a reason moved out of its reach`);
    }
    return { problems, texts: read, byCode };
}

/**
 * Source with its STRING CONTENTS blanked, `${...}` expressions kept.
 *
 * R22 asks which names this module calls, and half the module's output is
 * HTML built in template literals. Without this, `"<button onclick="` and
 * every other parenthesis inside a sentence reads as a call to something that
 * does not exist - and a tier-0 test that cries wolf is a tier-0 test people
 * learn to skip. Lengths are preserved so `lineAt` still points at the code.
 */
function stripStrings(text) {
    let out = "";
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < text.length && text[j] !== c && text[j] !== "\n") {
                j += text[j] === "\\" ? 2 : 1;
            }
            out += " ".repeat(Math.min(j, text.length) - i + 1);
            i = j + 1;
            continue;
        }
        if (c === "`") {
            let j = i + 1;
            out += " ";
            while (j < text.length) {
                if (text[j] === "\\") { out += "  "; j += 2; continue; }
                if (text[j] === "`") { out += " "; j++; break; }
                if (text[j] === "$" && text[j + 1] === "{") {
                    let k = j + 2;
                    let depth = 1;
                    while (k < text.length && depth) {
                        if (text[k] === "{") depth++;
                        else if (text[k] === "}") depth--;
                        k++;
                    }
                    out += "  " + stripStrings(text.slice(j + 2, k - 1)) + " ";
                    j = k;
                    continue;
                }
                out += text[j] === "\n" ? "\n" : " ";
                j++;
            }
            i = j;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/**
 * Every string and template literal in `code`: its text, and where it starts and
 * ends (E30, 24.09.2026; audit S17-01).
 *
 * The other half of `stripStrings`: a test that asks what the module WRITES - a key
 * spelled a certain way, R152 - has to read inside the literals and only there.
 * A template's `${...}` reads as "${}" in its text, and the literals inside the
 * hole are listed on their own. Regex literals are passed over, told apart from a
 * division by what comes before the slash. Positions are in `code`, so `lineAt`
 * points at the literal; hand this the output of `stripComments`. Over the
 * module's 112 files, before this function was among them: 22,625 literals
 * (24.09.2026).
 *
 * @returns {{text: string, start: number, end: number}[]}
 */
function stringLiterals(code, offset = 0, out = []) {
    const text = String(code ?? "");
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '"' || c === "'") {
            let j = i + 1, s = "";
            while (j < text.length && text[j] !== c && text[j] !== "\n") {
                if (text[j] === "\\") { s += text[j + 1] ?? ""; j += 2; continue; }
                s += text[j++];
            }
            out.push({ text: s, start: offset + i, end: offset + Math.min(j + 1, text.length) });
            i = j + 1;
            continue;
        }
        if (c === "`") {
            let j = i + 1, s = "";
            while (j < text.length && text[j] !== "`") {
                if (text[j] === "\\") { s += text[j + 1] ?? ""; j += 2; continue; }
                if (text[j] === "$" && text[j + 1] === "{") {
                    let k = j + 2, depth = 1;
                    while (k < text.length && depth) {
                        if (text[k] === "{") depth++;
                        else if (text[k] === "}") depth--;
                        k++;
                    }
                    stringLiterals(text.slice(j + 2, k - 1), offset + j + 2, out);
                    s += "${}";
                    j = k;
                    continue;
                }
                s += text[j++];
            }
            out.push({ text: s, start: offset + i, end: offset + Math.min(j + 1, text.length) });
            i = j + 1;
            continue;
        }
        if (c === "/" && /[=(,:;!&|?{}[\n]\s*$/.test(text.slice(Math.max(0, i - 20), i))) {
            let j = i + 1, inClass = false;
            while (j < text.length && text[j] !== "\n") {
                if (text[j] === "\\") { j += 2; continue; }
                if (text[j] === "[") inClass = true;
                else if (text[j] === "]") inClass = false;
                else if (text[j] === "/" && !inClass) break;
                j++;
            }
            i = j + 1;
            continue;
        }
        i++;
    }
    return out;
}

/**
 * The windows a person leaves open while the world moves under them.
 *
 * NOT every window this module has. A confirmation, a briefing, a pick-one
 * prompt - those are a question with an answer, and they are gone before
 * anything can go stale in them. The list is the ones that STAND: a GM opens
 * them, works, and looks back.
 *
 * It is written down rather than derived because "would somebody leave this
 * open" is a judgement, and a test whose subject is a judgement should say so
 * out loud instead of guessing from the shape of a function name.
 */
const STANDING = [
    "openSoundDialog", "openInvestigationDashboard", "manageClassTrial",
    "openProjectManager", "openRoomSetupDialog", "openVaultInspector",
    "openItemTables", "openSeasonSetup", "openSeasonChecklist", "openMastermindDialog",
    "openRulesManager", "openGmTeamDialog",
    "openItemManager", "openGmPanel", "openWhoIsAliveDialog",
    "openFailureLog", "openClockDialog", "openIncidentTracker",
    "openObjectionLog", "resetSeason"
];

/**
 * JSON with its object keys sorted, so two readings of the same value compare
 * equal whatever order a round trip through the server left the keys in.
 */
function stableJson(value) {
    return JSON.stringify(value ?? null, (key, v) => (v && typeof v === "object" && !Array.isArray(v))
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
        : v);
}

/**
 * Every setting this module registered, by key, as its value reads now.
 *
 * Read off the registry's own keys ("danganronpa-rpg.clock"), not off `def.namespace`:
 * the first version filtered on that field, the headless harness registers settings
 * without it, and this map came back empty - so the check below it compared two empty
 * readings and passed a tier-1 test written on purpose to write a setting (measured
 * 24.09). The key is the one thing every registry has.
 */
function moduleSettingValues() {
    const out = new Map();
    const prefix = `${MODULE_ID}.`;
    for (const full of game.settings.settings.keys()) {
        if (!full.startsWith(prefix)) continue;
        const key = full.slice(prefix.length);
        try { out.set(key, foundry.utils.deepClone(game.settings.get(MODULE_ID, key))); }
        catch { /* registered but unreadable here; nothing to compare or put back */ }
    }
    return out;
}

/*
 * THE WORLD, READ WHOLE (E30, 24.09.2026; audit S17-04).
 *
 * The fingerprint this replaces read what E01 knew to read - the module's
 * settings, each actor's resources, flags and item ids, user flags, which
 * tokens stood where, which messages existed - and nothing else: a test that
 * moved a token, started a track or wrote another module's setting was not
 * caught, and tier 2's restore was checked by its own read-back of the
 * module's settings alone. worldDump reads everything on this client that a
 * test can write, with a named rule (DUMP_RULES) for each thing it leaves out
 * or reads narrowly, and the same dump now judges tiers 0-1 ("changed
 * nothing") and every scenario's restore ("put back what it found").
 *
 * A dump is a Map of units - one setting, one document with its embedded
 * lists split off, one piece of state outside documents - each one stable
 * JSON, so two dumps compare unit by unit and only a unit that differs is
 * walked to its leaves. What it cannot read: other clients' client settings
 * (a GM-run dump reads this browser's), and anything a future store keeps
 * outside registered settings and documents - R159 fails when the module
 * starts writing one.
 */

/* Other namespaces' settings the module writes (R159 holds this list to the source). */
/* E19 C1: the two voice rows of enforced.mjs (avclient-livekit's separate window, Foundry's own A/V
   client settings); the harness registers neither at boot, so its dump reads them only where a shim did. */
const DUMP_FOREIGN_SETTINGS = ["core.globalPlaylistVolume", "core.permissions", "isometric-perspective.showWelcome",
    "avclient-livekit.useExternalAV", "core.rtcClientSettings"];

/*
 * WHAT THE DUMP LEAVES OUT OR READS NARROWLY, each with why and until when. The
 * first six rows were written from the design's reading of Foundry and of this
 * module, not from a run; the empty flag scope was measured, and says so. A row
 * added from here on carries its measurement in its `why` (the run, the date, what
 * moved), never a guess. `until` is a stage (held to tools/stages.json by R155),
 * "1.3.x (D27)" or "never". `match` is a unit's path with `*` for any one id and
 * `a|b` for either name.
 */
const DUMP_RULES = [
    { match: "*", strip: ["_stats"], until: "never",
        why: "Foundry's write stamp moves on every write, a restore that writes the old value back included; the values under it are compared, the stamp is not" },
    { match: "Playlist.*.sounds.*", strip: ["pausedTime"], until: "never",
        why: "advances by itself while a track plays; `playing` and `path` are compared" },
    { match: "Setting.*", skip: true, until: "never",
        why: "world settings are read by key in the settings part, for the namespaces this module writes; other modules' settings move with their own UI" },
    { match: "User.*", keep: ["role", "character", "flags", "permissions"], until: "never",
        why: "the rest of a User is the person's own (avatar, colour, hotbar), and a password field must never reach a report" },
    { match: "ChatMessage.*", keep: ["flags", "whisper", "blind", "speaker", "author"], hash: ["content", "rolls", "system"], until: "never",
        why: "a card is kilobytes of HTML a report cannot print; restore deletes the new ones, and an old card the suite edited shows as "
            + "a changed hash - its words, its rolls (reroll.mjs rewrites them on the card: `message.update({ rolls })`) and its system "
            + "data, the last two hashed since the E30 review (25.09.2026); the message's other fields are not read" },
    { match: "Scene.*.lights|sounds|drawings|templates.*", idsOnly: true, until: "never",
        why: "the module never writes these (R159's census); they are most of a scene's size" },
    { match: "Scene.*.walls.*", keep: ["door", "ds", "flags"], until: "never",
        why: "a wall's door type and state are what the module writes (E80 C5: passages-gm.mjs `convertSecretDoors` and "
            + "`putBackSecretDoor`), and since E80 fix r2-G9 the GMs' state of a secret door, a flag on it (`DOOR_SET`); R159 "
            + "read \"Wall at Scene.*.walls.* (ids only)\" on C5's tree (18.10.2026, at eedf9d7) while walls were ids only. "
            + "The rest of a wall the module does not write, and walls are most of a scene's size" },
    { match: `client:${MODULE_ID}.gmClockBeat`, skip: true, until: "never",
        why: "the primary GM's beat (gm-stores.mjs `clockBeatStore`, E17 C6) is written by itself every 60 s while the world "
            + "runs, as a playing track's pausedTime moves: measured 26.10.2026 on tiers 0-1 at 3efafbd0 with C6's code "
            + "(213.9 s), the dump read two leaves of the store's record go from none to a stamp, and failed \"tier 0/1 changed nothing\". "
            + "Its value and whether this browser stores it are both left out; tier 2 E17-T9 reads the beat itself" },
    { match: "*", emptyFlagScopes: "absent", until: "never",
        why: "Foundry keeps a flag scope its last flag leaves as {}, and getFlag reads an empty scope and no scope alike; "
            + "measured 24.09.2026 on the dump's second run, after restore deleted the last grant a student had (Actor "
            + "flags.danganronpa-rpg (none) -> {}) and after the stash test put its room's list back (a region, the same) - "
            + "in the harness, whose deletion is v14's ForcedDeletion as the shim models it, not in a real v14" }
];

const ruleMatches = (pattern, path) => {
    if (pattern === "*") return true;
    const want = pattern.split("."), have = path.split(".");
    return want.length === have.length && want.every((seg, i) => seg === "*" || seg.split("|").includes(have[i]));
};

/** A short, stable stand-in for a text too long or too private to print: FNV-1a, 32 bits. */
function hashText(text) {
    let h = 0x811c9dc5;
    for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return `#${h.toString(16).padStart(8, "0")}`;
}

/* A document class by name: Foundry's CONFIG entry, or the harness's registry. */
const docClass = name => CONFIG?.[name]?.documentClass ?? globalThis.getDocumentClass?.(name) ?? null;

/* One document, and its embedded ones, into `out` - under the rules for its path. */
function dumpDocument(out, path, name, data) {
    const rules = DUMP_RULES.filter(r => ruleMatches(r.match, path));
    if (rules.some(r => r.skip)) return;
    const embedded = docClass(name)?.metadata?.embedded ?? {};
    const unit = { ...data };
    for (const [childName, key] of Object.entries(embedded)) {
        const list = unit[key];
        delete unit[key];
        if (!Array.isArray(list)) continue;
        for (const child of list) if (child?._id) dumpDocument(out, `${path}.${key}.${child._id}`, childName, child);
    }
    if (rules.some(r => r.idsOnly)) { out.set(path, stableJson({ _id: unit._id })); return; }
    if (rules.some(r => r.emptyFlagScopes === "absent") && unit.flags && typeof unit.flags === "object") {
        unit.flags = Object.fromEntries(Object.entries(unit.flags).filter(([, v]) =>
            !(v && typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)));
    }
    const keep = rules.find(r => r.keep)?.keep;
    let kept = keep ? Object.fromEntries(Object.entries(unit).filter(([k]) => keep.includes(k) || k === "_id")) : unit;
    for (const field of rules.flatMap(r => r.strip ?? [])) delete kept[field];
    for (const field of rules.flatMap(r => r.hash ?? [])) {
        if (unit[field] !== undefined) kept = { ...kept, [field]: hashText(stableJson(unit[field])) };
    }
    out.set(path, stableJson(kept));
}

/*
 * WHAT THIS BROWSER STORED, NOT ONLY WHAT IT READS (E77 fix r2-H5, 13.10.2026; checkpoint k2's F1). A client
 * setting nothing ever wrote reads as its default, and one written with its default reads the same, so a dump
 * of values cannot tell the two apart. R516 put `foundryWindows` back with `set(key, was)`, `was` the value it
 * had read: on a GM who had never moved a Foundry window that stored `{}` where nothing had been, and "tier 0/1
 * changed nothing in the world" passed while scenario 01's A1, which reads the harness's localStorage itself,
 * failed on `client.danganronpa-rpg.foundryWindows` (e77run/k2/01a.log:142, at ceb70a4). So the dump also files,
 * for each of this module's client settings, whether this browser holds a stored copy (`client-stored:`), and a
 * test that writes one puts back what was stored - `clientStored()` before, `putBackStored()` after, nothing
 * stored included. The store is `game.settings.storage.get("client")`, localStorage in Foundry as in the
 * harness (the `client-orphan:` reading below rests on the same); that Foundry's own read of a client setting
 * goes to that store every time, so a key taken out of it reads as the default at once, is the harness's model
 * and was not measured on v14. Only this module's settings: the system's and the foreign ones are read by value.
 */
function clientStore() {
    const store = game.settings.storage?.get?.("client");
    return typeof store?.getItem === "function" ? store : null;
}

/** This module's client settings, `"ns.key"` -> the stored text, or null where this browser stores nothing. */
function clientStored() {
    const out = new Map(), store = clientStore();
    if (!store) return out;
    for (const [full, def] of game.settings.settings) {
        if (full.startsWith(`${MODULE_ID}.`) && def?.scope === "client") out.set(full, store.getItem(full));
    }
    return out;
}

/**
 * The ids of the body tiles on `scene` that `known` (the snapshot's set of its tile ids) did not hold: what tier 2's
 * `restore` deletes (E95 fix RV-4, 10.11.2026; tier 1 R3146). A tile is a body tile by its `FLAGS.bodyOf` object, the
 * one a public death lays (body-tile.mjs `leaveBody`, from chapter.mjs `markDeceased` since E63) where a test marks a death and takes the flag
 * back with no revive (E51-T21). Any other tile that appeared is left for the world dump to name ("tiles.<id>
 * appeared"), as it named that leak. No `known` (a scene that appeared, which goes whole): none.
 */
function appearedBodyTiles(scene, known) {
    if (!known) return [];
    return [...(scene?.tiles ?? [])].filter(tile => {
        const mark = tile?.getFlag?.(MODULE_ID, FLAGS.bodyOf);
        return !known.has(tile.id) && mark !== null && typeof mark === "object";
    }).map(tile => tile.id);
}

/**
 * Each key of a `clientStored()` reading back as stored or not stored: a copy this browser did not have is
 * taken out, one it had and lost is written back as its text. Called after the values were put back with
 * `game.settings.set` (whose onChange redraws what reads them), so taking a copy out leaves the value the
 * setting reads as the one recorded; a key stored both times is left to that write.
 */
function putBackStored(recorded) {
    const store = clientStore();
    if (!store) return;
    for (const [full, raw] of recorded ?? []) {
        const now = store.getItem(full);
        if (now === raw) continue;
        if (raw === null) store.removeItem(full);
        else if (now === null) store.setItem(full, raw);
    }
}

/**
 * Everything on this client a test can write, as `Map<unit, stable JSON>`:
 * this module's and the system's settings in both scopes (`world:` / `client:`),
 * whether this browser stores a copy of each of this module's client settings
 * (`client-stored:`, `clientStored` above), the foreign ones in DUMP_FOREIGN_SETTINGS,
 * keys under this module's name in the
 * client store that no registered setting claims (`client-orphan:`), every
 * document of every world collection with its embedded ones, and the pause, the
 * active and the viewed scene (`state:`). Async, so a store read asynchronously
 * can join it without changing a caller.
 */
async function worldDump() {
    const out = new Map();
    const spaces = [`${MODULE_ID}.`, `${game.system?.id}.`];
    const settingKeys = new Set([...game.settings.settings.keys()].filter(full => spaces.some(p => full.startsWith(p))));
    for (const full of DUMP_FOREIGN_SETTINGS) settingKeys.add(full);
    for (const full of [...settingKeys].sort()) {
        const dot = full.indexOf(".");
        let value;
        try { value = game.settings.get(full.slice(0, dot), full.slice(dot + 1)); } catch { continue; }
        // The scope after the read: the harness registers a foreign setting on first
        // read, and before it the first dump filed core.globalPlaylistVolume as world.
        const def = game.settings.settings.get(full);
        const unit = `${def?.scope === "client" ? "client" : "world"}:${full}`;
        if (DUMP_RULES.some(r => r.skip && r.match === unit)) continue;
        out.set(unit, stableJson(value));
    }
    for (const [full, raw] of clientStored()) {
        if (DUMP_RULES.some(r => r.skip && r.match === `client:${full}`)) continue;
        out.set(`client-stored:${full}`, stableJson(raw !== null));
    }
    const client = game.settings.storage?.get?.("client");
    if (client && typeof client.key === "function") {
        for (let i = 0; i < client.length; i++) {
            const key = client.key(i);
            if (!key?.startsWith(`${MODULE_ID}.`) || game.settings.settings.has(key)) continue;
            out.set(`client-orphan:${key}`, stableJson(client.getItem(key)));
        }
    }
    for (const [name, collection] of game.collections ?? []) {
        for (const doc of collection) dumpDocument(out, `${name}.${doc.id}`, name, doc.toObject());
    }
    out.set("state:paused", stableJson(Boolean(game.paused)));
    out.set("state:activeScene", stableJson(game.scenes?.active?.id ?? null));
    out.set("state:viewedScene", stableJson(canvas?.scene?.id ?? null));
    return out;
}

/** A dump of made-up document sources of one type, as worldDump would file them (R159's unit checks). */
function dumpOf(name, sources) {
    const out = new Map();
    for (const data of sources) dumpDocument(out, `${name}.${data._id}`, name, structuredClone(data));
    return out;
}

/**
 * Every unit path a document type can have in a dump - `Actor.*`, `Actor.*.items.*`,
 * `Actor.*.items.*.effects.*` - with how the dump reads each: skipped, as ids only,
 * or read (R159).
 */
function dumpPathsOf(kind) {
    const paths = [];
    const walk = (name, prefix, depth) => {
        for (const [child, key] of Object.entries(docClass(name)?.metadata?.embedded ?? {})) {
            const path = `${prefix}.${key}.*`;
            if (child === kind) paths.push(path);
            if (depth < 3) walk(child, path, depth + 1);
        }
    };
    for (const name of game.collections?.keys?.() ?? []) {
        if (name === kind) paths.push(`${name}.*`);
        walk(name, `${name}.*`, 1);
    }
    return paths.map(path => {
        const rules = DUMP_RULES.filter(r => ruleMatches(r.match, path));
        return { path, read: rules.some(r => r.skip) ? "skipped" : rules.some(r => r.idsOnly) ? "ids only" : "read" };
    });
}

/* Two values' differing leaves, as paths under `path`. Arrays compare whole. */
function leafDiff(a, b, path, out) {
    const plain = v => v && typeof v === "object" && !Array.isArray(v);
    if (plain(a) && plain(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) leafDiff(a[k], b[k], `${path}.${k}`, out);
        return;
    }
    if (stableJson(a) !== stableJson(b)) out.push({ path, before: a, after: b });
}

/** What differs between two dumps: `[{ unit, path, before, after }]`, a unit added or gone as one entry. */
function dumpDiff(before, after) {
    const out = [];
    for (const unit of new Set([...before.keys(), ...after.keys()])) {
        const a = before.get(unit), b = after.get(unit);
        if (a === b) continue;
        if (a === undefined || b === undefined) {
            out.push({ unit, path: unit, before: a === undefined ? undefined : "present", after: b === undefined ? undefined : "present" });
            continue;
        }
        const leaves = [];
        leafDiff(JSON.parse(a), JSON.parse(b), unit, leaves);
        out.push(...leaves.map(d => ({ ...d, unit })));
    }
    return out;
}

/**
 * One difference, for a person: `Actor "Aiko Hoshino" (ACTORAIKO0000000)
 * system.resources.hope.value 2 -> 3`. Values are cut at 60 characters; a string
 * longer than 200, or anything from a `client:` ledger (the GM's own copy of the
 * secrets), is printed as a hash, so a trace's answer never lands in a results file.
 */
function describeDiff(d) {
    const ledger = d.unit.startsWith("client:") || d.unit.startsWith("client-orphan:");
    const show = v => {
        if (v === undefined) return "(none)";
        const text = typeof v === "string" ? v : JSON.stringify(v);
        if (ledger || text.length > 200) return hashText(text);
        return text.length > 60 ? `${text.slice(0, 57)}...` : text;
    };
    const [top, id, ...rest] = d.path.split(".");
    const doc = game.collections?.get?.(top)?.get?.(id);
    const where = doc ? `${top} "${doc.name ?? ""}" (${id})${rest.length ? ` ${rest.join(".")}` : ""}` : d.path;
    if (d.path === d.unit && (d.before === undefined || d.after === undefined)) {
        return `${where} ${d.before === undefined ? "appeared" : "is gone"}`;
    }
    return `${where} ${show(d.before)} -> ${show(d.after)}`;
}

/**
 * WHAT THE GM'S CLIENT SAID WHILE A TEST RAN (E08+E28 C15, 04.10.2026). A test that reads "logged
 * on the GM" counts the lines `warn` and `error` (utils.mjs) write to the console from the watch
 * on, not the rows of `sessionFailures()`: that log keeps the first 60 wordings and drops every
 * new one after (`SESSION_LOG_CAP`), and a whole suite fills it. Measured on C15's first suite
 * run: the 60th wording arrived just before "a trace's band is the GM's, whatever the packet
 * names", which then counted none of its two lines, and "a bookmark note for another player's
 * character is refused" none of its two refusals - the first had passed on its named run, the
 * second on every suite before C15 (C14: its refusals were the log's 51st and 52nd wordings).
 * `count(test)` is how many lines since the watch match `test` (a string or a RegExp); `stop()`
 * puts the console back. In the kit since fix r2-H6 (05.10.2026; review m1): the same
 * cap and the same one-row-per-wording made four tests that counted the log's rows fail on a
 * second run in one page session (logged 1 -> 0), and R162's `.some()` then passed on the
 * first run's line - so tier 1 counts with it too.
 */
function watchLog() {
    const lines = [], kept = { warn: console.warn, error: console.error };
    for (const level of Object.keys(kept)) {
        console[level] = function (...args) {
            lines.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(" "));
            return kept[level].apply(this, args);
        };
    }
    return {
        count: test => lines.filter(line => (typeof test === "string" ? line.includes(test) : test.test(line))).length,
        stop: () => Object.assign(console, kept)
    };
}

/**
 * Which test was running when the world was written - on for the whole run, tier 2
 * included (E30).
 *
 * The dump says WHAT moved; this says WHEN (the review of E01). Run during play,
 * the answer to "was it the suite" is in the name: a write that landed in the
 * middle of "R10" is the suite's, and one that landed between two tests is more
 * likely the table. Every world collection is watched, and the embedded kinds a
 * test writes (Token, Item, ActiveEffect, Region, TableResult, PlaylistSound,
 * JournalEntryPage). A write this client made also marks the running test as one
 * that has written (`current.wrote`), for the world-after-write rule: a world.*
 * probe asked after that FAILs. A write another client made does not - it is the
 * table's, or an answer to the test, not the test acting.
 */
function watchWrites(running) {
    const seen = [];
    const mine = userId => !userId || userId === game.user?.id;
    const note = (what, userId) => {
        seen.push(`${what} (during "${running() ?? "between tests"}")`);
        if (current && !current.wrote && mine(userId)) current.wrote = what;
    };
    const names = new Set([...(game.collections?.keys?.() ?? []), "Token", "Item", "ActiveEffect", "Region", "TableResult",
        "PlaylistSound", "JournalEntryPage"]);
    names.delete("Setting");
    const listeners = [
        ["updateSetting", (doc, _c, _o, userId) => note(`setting ${doc?.key}`, userId)],
        ["createSetting", (doc, _o, userId) => note(`setting ${doc?.key}`, userId)],
        ["clientSettingChanged", key => note(`setting ${key}`, null)]
    ];
    for (const name of names) {
        const what = doc => `${name} ${doc?.name ? `"${doc.name}" ` : ""}(${doc?.id ?? "?"})${doc?.parent ? ` on ${doc.parent.name ?? doc.parent.id}` : ""}`;
        listeners.push([`create${name}`, (doc, _o, userId) => note(`${what(doc)} created`, userId)]);
        listeners.push([`update${name}`, (doc, _c, _o, userId) => note(`${what(doc)} updated`, userId)]);
        listeners.push([`delete${name}`, (doc, _o, userId) => note(`${what(doc)} deleted`, userId)]);
    }
    const ids = listeners.map(([hook, fn]) => [hook, Hooks.on(hook, fn)]);
    return { seen, stop: () => { for (const [hook, id] of ids) Hooks.off(hook, id); } };
}

/** `n` living students to play with, or a skip that says the world has fewer (it used to FAIL). */
function cast(n = 3) {
    /*
     * LIVING students, and the filter is not tidiness.
     *
     * `studentActors()` returns everybody who is not a Monokuma, the dead
     * included - the dead have to stay in that list, because the rules that
     * count bodies, rooms and Blackened all read it. So on any world where
     * somebody has already been killed, `cast()` was handing these scenarios a
     * CORPSE and calling it a killer, a victim or a conspirator.
     *
     * It passed for a long time because almost nothing in the incident asks
     * whether a participant is alive; `openMurder` is given ids and opens. The
     * betrayal window (D18) does ask - a dead accomplice cannot turn on
     * anybody - and the failure came out looking like a bug in the feature
     * rather than a fixture standing a body up at the table.
     *
     * Measured on the QA world: the roster is Player A, Player B, Player
     * Template (Copy) [dead], QA Witness, so the third seat in every murder
     * scenario was the dead one.
     */
    /*
     * A WORLD WITH FEWER IS A SKIP, NOT A FAILURE (E30, 24.09.2026; audit S14-24).
     * `need three living students, found 2` was a FAIL - a fact about the world
     * reported as a fault in the module - and seven scenarios counted their own
     * cast past this function, from `game.actors`, where a corpse or a Monokuma
     * character could stand in. They take `cast(n)` now.
     */
    needs(world.atLeast("livingStudents", n), `this scenario casts ${n}`);
    return living().slice(0, n);
}

/*
 * A KIT QUESTION, AS DialogV2.confirm WAS ASKED IT (E21 C3a, 06.11.2026). The case's yes-or-no questions moved from
 * DialogV2.confirm onto the kit's frame (ui-kit.mjs `drpgConfirm`; boundary.mjs `noFirst` and eclipse.mjs's question
 * at the lights, whose no is the default), and the kit asks through DialogV2.wait. A test that answered them by standing
 * in for `confirm` stood in for nothing, and on the GM, where the suite draws real windows, the question waited for a
 * press nobody makes. `kitQuestion(config)` reads a `wait` config as one of those questions - two buttons, one the
 * action "yes", the other a closing word (`drpg-role-cancel` or `drpg-role-close`) - and answers the config in
 * confirm's own shape (`window`, `content`, `yes: { label, default, class }`, `no: { label, default, class }`), or null
 * for any other window. `kitQuestions(wait0)` is a `wait` that hands such a question to whatever DialogV2.confirm is
 * now - the test's stand-in, or the harness's, which answered yes - and every other window to `wait0`: the routing a
 * confirm had before the move. A test installs it beside its `confirm` and puts `wait` back with it.
 */
function kitQuestion(config) {
    const buttons = config?.buttons ?? [];
    if (buttons.length !== 2) return null;
    const yes = buttons.find(b => b?.action === "yes");
    const no = buttons.find(b => b !== yes && /\bdrpg-role-(?:cancel|close)\b/.test(b?.class ?? ""));
    if (!yes || !no) return null;
    const side = b => ({ label: b.label, default: b.default === true, class: b.class ?? "" });
    return { ...config, yes: side(yes), no: side(no) };
}

function kitQuestions(wait0) {
    const D = foundry.applications.api.DialogV2;
    return async function (config) {
        const asked = kitQuestion(config);
        return asked ? D.confirm(asked) : wait0.call(D, config);
    };
}

/*
 * DAGGERHEART'S CHARACTER SETTINGS WINDOW, AS FOUNDRY WOULD FRAME IT (E49, 11.11.2026; dh-settings.mjs). The wrench's window
 * (DHCharacterSettings) is Daggerheart's: neither the harness nor this suite draws it, so the tests that read what the module
 * does to it build its markup here - the four parts of Daggerheart 2.6.5 (templates/sheets-settings/character-settings/
 * header.hbs, details.hbs, experiences.hbs and templates/sheets/global/tabs/tab-navigation.hbs, read at the tag 2.6.5),
 * Foundry's `formGroup` as v13 draws a number field (div.form-group > label + div.form-fields > input), the frame (a form
 * with `daggerheart dh-style dialog character-settings`, a header, `section.window-content`). Its words through this
 * browser's i18n as the templates name them. `source` is an actor's system as `document._source.system` holds it; the
 * parts alone (`parts: true`) for an ApplicationV2's `_renderHTML`. A model: what Foundry's frame adds beyond these, and
 * Daggerheart's own listeners, are not here.
 */
function dhSettingsMarkup(source, { name = "Stand-in", tab = "details" } = {}) {
    const t = key => game.i18n.localize(key);
    const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
    const group = (label, path, value) => `<div class="form-group"><label>${esc(label)}</label><div class="form-fields">`
        + `<input type="number" name="${path}" value="${esc(value)}" step="1"></div></div>`;
    const max = key => game.i18n.format("DAGGERHEART.GENERAL.maxWithThing", { thing: t(key === "hitPoints" ? "DAGGERHEART.GENERAL.HitPoints.plural" : "DAGGERHEART.GENERAL.stress") });
    const traits = Object.entries(source.traits ?? {}).map(([key, trait]) => `<div class="trait-container"><span>${esc(t(`DAGGERHEART.CONFIG.Traits.${key}.name`))}</span>`
        + `<input type="text" data-dtype="Number" name="system.traits.${key}.value" value="${esc(trait?.value)}" /></div>`).join("");
    const resources = ["hitPoints", "stress"].map(key => `<span${key === "hitPoints" ? ` data-tooltip-text="${esc(t("DAGGERHEART.UI.Tooltip.maxHPClassBound"))}"` : ""}>`
        + `${group(max(key), `system.resources.${key}.max`, source.resources?.[key]?.max)}</span>`).join("");
    const tabs = [["details", "DAGGERHEART.GENERAL.Tabs.details"], ["experiences", "DAGGERHEART.GENERAL.Tabs.experiences"]];
    const nav = `<section class="tab-navigation" data-application-part="tabs"><div class="navigation-container"><div class="navigation-inner-container"><line-div></line-div>`
        + `<nav class="feature-tab sheet-tabs tabs" data-group="primary">${tabs.map(([id, label]) => `<a class="${id}${id === tab ? " active" : ""}" data-action="tab" data-group="primary" data-tab="${id}"><span>${esc(t(label))}</span></a>`).join("")}</nav>`
        + `<line-div></line-div></div></div></section>`;
    const details = `<section class="tab${tab === "details" ? " active" : ""} details" data-tab="details" data-group="primary" data-application-part="details">`
        + `<fieldset class="one-column"><legend>${esc(t("DAGGERHEART.GENERAL.Trait.plural"))}</legend><div class="nest-inputs"><div class="traits-inner-container">${traits}</div></div></fieldset>`
        + `<fieldset class="one-column"><legend>${esc(t("DAGGERHEART.GENERAL.basics"))}</legend><div class="two-columns even">${resources}`
        + group(t("DAGGERHEART.GENERAL.scars"), "system.scars", source.scars)
        + group(t("DAGGERHEART.GENERAL.proficiency"), "system.proficiency", source.proficiency)
        + `<span data-tooltip-text="${esc(t("DAGGERHEART.UI.Tooltip.maxEvasionClassBound"))}">${group(t("DAGGERHEART.ACTORS.Character.maxEvasionBonus"), "system.evasion", source.evasion)}</span>`
        + `</div></fieldset></section>`;
    const items = Object.entries(source.experiences ?? {}).map(([key, e]) => `<li class="experience-item"><div class="experience-inner-item">`
        + `<input class="name" type="text" name="system.experiences.${key}.name" value="${esc(e?.name)}" />`
        + `<input class="modifier" type="text" name="system.experiences.${key}.value" value="${esc(e?.value)}" data-dtype="Number" />`
        + `<span data-tooltip="${esc(t("CONTROLS.CommonDelete"))}"><a data-action="removeExperience" data-experience="${key}" class=""><i class="fa-solid fa-trash"></i></a></span>`
        + `</div><textarea name="system.experiences.${key}.description">${esc(e?.description)}</textarea></li>`).join("");
    const experiences = `<section class="tab${tab === "experiences" ? " active" : ""} experiences" data-tab="experiences" data-group="primary" data-application-part="experiences">`
        + `<button type="button" class="add-experience-btn" data-action="addExperience"><span>${esc(game.i18n.format("DOCUMENT.New", { type: t("DAGGERHEART.GENERAL.experience.single") }))}</span></button>`
        + `<fieldset><legend>${esc(t("DAGGERHEART.GENERAL.Tabs.experiences"))}</legend><ul class="experience-list">${items}</ul></fieldset></section>`;
    return `<header class="dialog-header" data-application-part="header"><h1>${esc(name)}</h1></header>${nav}${details}${experiences}`;
}

/** The whole window, framed: a detached `form.application`, put into `doc` (this page's document unless another is given). */
function dhSettingsStandIn(source, { name, tab, doc = document } = {}) {
    const form = doc.createElement("form");
    form.className = "application daggerheart dh-style dialog character-settings";
    form.innerHTML = `<header class="window-header"><i class="window-icon fa-fw fa-solid fa-wrench"></i><h1 class="window-title">`
        + `${game.i18n.localize("DAGGERHEART.GENERAL.Tabs.settings")}</h1><button type="button" class="header-control icon fa-solid fa-xmark" data-action="close"></button></header>`
        + `<section class="window-content">${dhSettingsMarkup(source, { name, tab })}</section>`;
    return form;
}

/*
 * THE CHARACTER SHEET'S STATISTICS, AS DAGGERHEART DRAWS THEM (E49, 11.11.2026; stat-glyphs.mjs, sheet-header.mjs `markTraitGlyphs`).
 * Daggerheart 2.6.5 templates/sheets/actors/character/header.hbs:107-133, read at the tag: `.character-traits`, one
 * `.trait` per trait in the system's order with `data-attribute` (Daggerheart's key), its `.trait-name` (the tier mark and
 * a span with the label) and its `.trait-value-area` (the crest's svg and the value). Inside the sheet's root as the
 * system's classes name it (`application sheet daggerheart actor dh-style character`), the header part
 * `.character-header-sheet` around it. The labels through this browser's i18n (the module's lang files override
 * `DAGGERHEART.CONFIG.Traits.*`). A trait's `tierMarked` draws its mark `marked`, as the template does; `noMark` names the
 * traits drawn with no mark at all (a Daggerheart that moved it). A model: the rest of the header and Daggerheart's
 * listeners are not here.
 */
function dhTraitsStandIn(traits = {}, { doc = document, noMark = [] } = {}) {
    const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
    const root = doc.createElement("div");
    root.className = "application sheet daggerheart actor dh-style character";
    const keys = ["agility", "strength", "finesse", "instinct", "presence", "knowledge"];
    const one = key => {
        const value = Number(traits[key]?.value ?? 0);
        return `<div class="trait" data-tooltip="${esc(game.i18n.localize(`DAGGERHEART.CONFIG.Traits.${key}.name`))}" data-action="rollAttribute" data-attribute="${key}" data-value="${value}">`
            + `<div class="trait-name">${noMark.includes(key) ? "" : `<div class="tier-mark${traits[key]?.tierMarked ? " marked" : ""}"></div>`}<span>${esc(game.i18n.localize(`DAGGERHEART.CONFIG.Traits.${key}.name`))}</span></div>`
            + `<div class="trait-value-area"><svg width="52" height="46" viewBox="0 0 52 46"></svg><div class="trait-value"><span>${value > 0 ? `+${value}` : value}</span></div></div></div>`;
    };
    root.innerHTML = `<section class="window-content"><div class="character-header-sheet"><div class="character-traits">${keys.map(one).join("")}</div></div></section>`;
    return root;
}

export {
    dhSettingsMarkup, dhSettingsStandIn, dhTraitsStandIn,
    Failure, Precondition, ContractBreach, Skipped, ok, needs, equal, must, describe, expectedRed, compareVersions, stageLedger, markerProblem,
    apiKind, apiSurfaceProblems,
    runOne, registerSuite, suiteEntries, KIT_SELF_TESTS, SELF_LEDGER, MARKER_FIXTURE, UNTIL_FIXTURE, untilProblem, env, world, worldCensus,
    wait, settle, until,
    layoutAvailable, cascadeAvailable, LIVE_PROBE, glassTheme, canvasAvailable, systemSheetsAvailable, dialogsDrawn,
    lf, lfText, moduleSources, otherSources, suiteSources, scanSuite, stripComments, moduleStyles, styleCascade, subjectNeeds, bodyOf, topLevelFunction, fnSource, lineAround,
    withGuards, staticImports, importCycles, bridgeTables, bridgeCrawlSources, bridgeDeclarationCalls, bridgeCut, bridgeLookup, bridgeCrawl, bridgeFamily, bridgeRead, bridgeFn, bridgeText, censusFile, BRIDGE_FAMILY_END, ACTION_FAMILY, actionText, VAULT_FAMILY, vaultText, PANEL_FAMILY, panelText, HUD_FAMILY, hudText, TABLES_FAMILY, tablesText, MUSIC_FAMILY, musicText, SFX_FAMILY, sfxText, VOTE_FAMILY, voteText, CLEANUP_FAMILY, cleanupText, cleanupFetch, cleanupBy, INVESTIGATION_FAMILY, investigationText, investigationFetch, investigationBy, SETTINGS_FAMILY, settingsText, settingsFetch, settingsBy, UTILS_FAMILY, utilsText, utilsFetch, utilsBy, SHEET_FAMILY, sheetText, sheetFetch, sheetBy, bridgeTableProblems, payloadReads, refusalProblems, lineAt, stripStrings, blankComments, blankLiterals, callArgs, testsIn, bareCuts, vacuousAsserts, needsArgs, redMarkers, vacuousChecks,
    LINT_FIXTURES, FLOWS, FLOW_EXEMPT, storeKeyAccess, GM_STORE_PENDING,
    flatLang, TEXT_DETECTORS, TEXT_MODES, TEXT_FIXTURES, textSelfCheck, textItem, TEXT_BASELINES, textAgainstBaseline, textStaleRow,
    textTableWords, textLegacyLists,
    cssDeadClasses, cssSelfCheck, cssLintCounts, cssBudgetProblems, CSS_DETECTORS, CSS_FIXTURES,
    cssThemeTokens, cssContrastOf, cssContrastRatio, cssContrastSelfCheck, cssKitSheetProblems, cssMeaningReads, cssMeaningSelfCheck, cssHourKept, cssForcedBlockProblems, CSS_FORCED_STATES, cssHourDistances, cssDeltaE00Check,
    stringLiterals, STANDING, stableJson, moduleSettingValues, clientStored, putBackStored, appearedBodyTiles, watchWrites, watchLog, cast,
    kitQuestion, kitQuestions,
    worldDump, dumpDiff, describeDiff, hashText, dumpOf, dumpPathsOf, DUMP_RULES, DUMP_FOREIGN_SETTINGS
};
