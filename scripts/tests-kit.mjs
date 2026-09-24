/**
 * Danganronpa RPG - the suite's shared tools (E30, audit S17-02).
 * ---------------------------------------------------------------------------
 * What more than one tier uses: the answers a test can give (it returns, it
 * throws a Failure, it throws a Skipped) and how the runner judges them
 * (runOne: what it measured, whether it is red on purpose until a named stage),
 * the environment probes, the source readers, the world readers the runner
 * compares before and after tiers 0 and 1, and cast(). It writes nothing to the
 * world and imports no other suite file, so a tier file that imports it imports
 * no other tier. What the tiers are: the header of tests.mjs.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { studentActors } from "./monokuma.mjs";
import { narrowScreen } from "./settings.mjs";
import { allVaults } from "./vault.mjs";
import {
    stripComments, lineAt, blankComments, blankLiterals, testsIn, bareCuts, vacuousAsserts, needsArgs, redMarkers, vacuousChecks,
    FIXTURES as LINT_FIXTURES
} from "./tests-lint.mjs";
import { FLOWS, FLOW_EXEMPT } from "./tests-flows.mjs";

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
        throw new Failure(text);
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
 * a piece of the failure message the red has to carry, so a case that starts
 * failing for another reason does not hide under the marker. It never throws at
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
        if (res.ok) doc = await res.json();
    } catch { /* not served: the answer below says so */ }
    if (!Array.isArray(doc?.stages)) return null;
    const version = game.modules.get(MODULE_ID)?.version ?? "0";
    return new Map(doc.stages.map(row => [row.id, {
        ...row, done: Boolean(row.version) && compareVersions(version, row.version) >= 0
    }]));
}

/** What is wrong with a red marker before anything is run, or null. */
function markerProblem(red, ledger) {
    if (red?.[RED] !== true || !/^E\d{2}$/.test(red.stage ?? "") || !red.why) {
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
    if (!/^E\d{2}$/.test(until)) return `until "${until}" is not a stage, "1.3.x (D27)" or "never"`;
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
   skip is a skip; a failure the test caught fails it; a red is green only when
   an assertion failed - a precondition, a crash or nothing measured is a FAIL. */
function judge(ctx, err, red, ledger) {
    const fail = message => ({ outcome: "fail", message });
    if (red) {
        const stale = markerProblem(red, ledger);
        if (stale) return fail(stale);
    }
    if (err instanceof Skipped) return { outcome: "skip", message: err.message, probe: err.probe };
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
 * sets itself, not one the module's stylesheet should have, because the harness
 * fakes `getPropertyValue("--...")` from a flat list and would answer yes.
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
 * Whether `DialogV2` draws a window here. Foundry's is an ApplicationV2 with a
 * `render`; the headless harness answers `DialogV2.wait` from a queue and draws
 * nothing, so a window opened through it has no element to read.
 */
const dialogsDrawn = () => typeof foundry.applications.api.DialogV2?.prototype?.render === "function";

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
    dialogs: () => probe("env.dialogs", dialogsDrawn(), "DialogV2 draws no window here"),
    markdown: () => probe("env.markdown", Boolean(globalThis.showdown?.Converter), "no Markdown converter here"),
    /* jsdom answers every element's fontFamily with the words "depends on user agent" (the
       note in "the theme speaks two faces" has the story); a browser names a face. */
    fonts: () => {
        const face = getComputedStyle(document.body).fontFamily;
        return probe("env.fonts", face && !/depends on user agent/i.test(face), "no font family resolves here");
    },
    webAnimations: () => probe("env.webAnimations", typeof HTMLElement.prototype.getAnimations === "function"
        && typeof globalThis.CSSTransition === "function", "no Web Animations API here")
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
    studentTokensOnScreen: ["students with a token on the scene on screen",
        () => living().filter(a => [...(viewed()?.tokens ?? [])].some(t => t.actorId === a.id)).length],
    livingStudents: ["living students", () => living().length],
    playerAccounts: ["player accounts", () => game.users.filter(u => !u.isGM).length],
    playersWithCharacter: ["player accounts that own a character", () => game.users.filter(u => !u.isGM
        && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER"))).length],
    fullGms: ["full Gamemaster accounts", () => game.users.filter(u => u.role === CONST.USER_ROLES.GAMEMASTER).length],
    stashes: ["stashes", () => allVaults().length],
    /* Read off the item's own flag, not through vaultContents: the invariant this
       serves hunts a stashed item whose stash is gone, and must not lose the item
       it hunts to the reader it checks. A thirteenth row, added with that test. */
    stashedItems: ["stashed items", () => game.actors.filter(a => a.type === "character")
        .reduce((n, a) => n + a.items.filter(i => i.getFlag(MODULE_ID, "location") === "vault").length, 0)]
};

/* A skip describes the world AS FOUND. Once a test has written to the world, what
   it would count is partly its own doing, so asking then FAILs (the runner's write
   watcher sets `current.wrote`). */
function askedOfWorld(name) {
    if (current?.wrote) {
        const text = `${name} was asked after this test wrote to the world (${current.wrote}) - ask the world before acting`;
        current.failures.push(text);
        throw new Failure(text);
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
 * reached; 112 and 112 once E30 split the suite into five files.
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
            if (res.ok) text = await res.text();
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
 * The tier files - the suite's own files that hold its tests, what the contract's
 * static checks read (R155-R158). Not the kit, the runner or tests-lint.mjs: those
 * are where the cutters, the detectors and their deliberate violations live.
 */
async function suiteSources() {
    const all = await moduleSources();
    return [...all].filter(([file]) => isSuiteFile(file) && /^tests-tier\d+\.mjs$/.test(file));
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
        parts.push(await fetch(`/modules/${MODULE_ID}/${href}`).then(r => r.text()));
    }
    return parts.join("\n").replace(/\/\*[\s\S]*?\*\//g, " ");
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
 * gm-bridge.mjs - so that E31 can lift them into a table as they are. A test that
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
    "openItemTables", "openSeasonSetup", "openMastermindDialog",
    "openRulesManager", "openMonocubDialog", "openGmTeamDialog",
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
const DUMP_FOREIGN_SETTINGS = ["core.globalPlaylistVolume", "core.permissions", "isometric-perspective.showWelcome"];

/*
 * WHAT THE DUMP LEAVES OUT OR READS NARROWLY, each with why and until when. A
 * row is added with a measurement in its `why` (the run, the date, what moved),
 * never on a guess; `until` is a stage (held to tools/stages.json by R155),
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
    { match: "ChatMessage.*", keep: ["flags", "whisper", "blind", "speaker", "author"], hash: ["content"], until: "never",
        why: "a card is kilobytes of HTML a report cannot print; restore deletes the new ones, and an old card the suite edited shows as a changed hash" },
    { match: "Scene.*.walls|lights|sounds|drawings|templates.*", idsOnly: true, until: "never",
        why: "the module never writes these (R159's census); they are most of a scene's size" },
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

/**
 * Everything on this client a test can write, as `Map<unit, stable JSON>`:
 * this module's and the system's settings in both scopes (`world:` / `client:`),
 * the foreign ones in DUMP_FOREIGN_SETTINGS, keys under this module's name in the
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
        out.set(`${def?.scope === "client" ? "client" : "world"}:${full}`, stableJson(value));
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

export {
    Failure, Precondition, Skipped, ok, needs, equal, must, describe, expectedRed, compareVersions, stageLedger, markerProblem,
    runOne, registerSuite, suiteEntries, KIT_SELF_TESTS, SELF_LEDGER, MARKER_FIXTURE, UNTIL_FIXTURE, untilProblem, env, world, worldCensus,
    wait, settle, until,
    layoutAvailable, cascadeAvailable, LIVE_PROBE, glassTheme, canvasAvailable, systemSheetsAvailable, dialogsDrawn,
    moduleSources, otherSources, suiteSources, scanSuite, stripComments, moduleStyles, bodyOf, topLevelFunction, fnSource, lineAround,
    withGuards, lineAt, stripStrings, blankComments, blankLiterals, testsIn, bareCuts, vacuousAsserts, needsArgs, redMarkers, vacuousChecks,
    LINT_FIXTURES, FLOWS, FLOW_EXEMPT,
    stringLiterals, STANDING, stableJson, moduleSettingValues, watchWrites, cast,
    worldDump, dumpDiff, describeDiff, hashText, dumpOf, dumpPathsOf, DUMP_RULES, DUMP_FOREIGN_SETTINGS
};
