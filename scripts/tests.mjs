/**
 * Danganronpa RPG — the regression suite.
 * ---------------------------------------------------------------------------
 *     game.drpg.runTests()            everything
 *     game.drpg.runTests({ tier: 1 }) regressions + invariants, world untouched
 *     game.drpg.runTests({ tier: 0 }) the module-wide regression pass alone
 *
 * WHAT IS IN HERE AND WHY. Not "coverage" — the things that have actually been
 * broken. Every tier-2 scenario below is a bug somebody hit at the table or a
 * measurement that caught the module lying: the killers' side acting twice per
 * round, a Finishing Blow that announced a death and left the victim standing,
 * a body nobody could discover, Observe reaching past the murder for a trace
 * from three days earlier. A suite written from the feature list would have
 * passed on every one of those, because each was a function doing exactly what
 * it said while the rules underneath it were wrong.
 *
 * THREE TIERS, and the split is about consequences, not speed.
 *
 *   Tier 0 reads THIS MODULE'S OWN SOURCE, fetched from the server that is
 *          already serving it. It is the answer to a class of defect the other
 *          two tiers cannot see: not wrong logic, but code that says one thing
 *          and does another somewhere nothing throws. See the block above
 *          REGRESSIONS for the six that got out before it existed.
 *   Tier 1 reads. It cannot change the world, so it is safe to run at any point
 *          in a session, including during play.
 *   Tier 2 writes. It opens incidents, kills people and resets seasons — so it
 *          builds its own fixtures, records what it displaced, and puts
 *          everything back. Never run it in a world somebody is playing in.
 *
 * NO DICE. Every scenario drives the resolver directly with a total, because a
 * roll dialog needs a browser tab that is compositing frames and a suite that
 * only passes in a foreground window is a suite that fails in CI and in a
 * backgrounded tab for reasons that have nothing to do with the module.
 */

import { MODULE_ID, moduleVersion, CRISIS_ACTIONS, ACTIONS, TRAITS,
    ITEM_CATEGORIES, LIMIT_GROUPS, EQUIPPABLE, SFX_EVENTS, SFX_CATEGORIES,
    HOPE_CALLS, DESPAIR_CALLS, OBSERVE_DC, ANALYZE_DC, CLEANUP, CRITICAL, KEY_REMNANTS
} from "./config.mjs";
import { rolesOf } from "./inventory.mjs";
import { vaultContents, stashRoomOfItem, stashIn, allVaults } from "./vault.mjs";
import { SETTINGS, DEFAULT_SAFEWORD, getSetting } from "./settings.mjs";
import { safeword } from "./safeword.mjs";
import { getClock, setClock } from "./clock.mjs";
import { studentActors } from "./monokuma.mjs";
import { detectPageTinting, stylesheetVersion } from "./diagnostics.mjs";
import { voiceTargets, liveKitRoomFor } from "./voice.mjs";
import { MUSIC_STATES, musicMap } from "./music.mjs";
import { log, warn } from "./utils.mjs";

/* ==========================================================================
 * HARNESS
 * ========================================================================== */

class Failure extends Error {}

function ok(condition, message) {
    if (!condition) throw new Failure(message);
}

function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Failure(`${message} — expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`);
    }
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/** Let a world write land on this client before reading it back. */
const settle = () => wait(400);

/* ==========================================================================
 * TIER 0 — MODULE-WIDE REGRESSION
 * ========================================================================== */

/**
 * WHY A THIRD TIER, AND WHY IT READS SOURCE INSTEAD OF CALLING FUNCTIONS.
 *
 * Look at which defects in this update surfaced LAST. Not one of them was bad
 * logic. Every one was a DIVERGENCE — code saying one thing and doing another,
 * in a place where nothing throws:
 *
 *   - three sounds played on the wrong client for four releases, because the
 *     resolver is GM-only and the comment above it said the code was "local";
 *   - `forceBuffer` was accepted and ignored;
 *   - a "which project?" picker that has never once been on screen;
 *   - Reroll replaying one action as another;
 *   - a trap alert delivered to the killer, naming the victim;
 *   - `localize(k) || fallback`, which can never reach its fallback.
 *
 * None of those throws. None appears in a scenario that does not happen to walk
 * that exact path. All of them are plainly visible in the text of the module.
 *
 * Foundry serves this module's own files under `/modules/danganronpa-rpg/`, so
 * the suite can fetch and read them. Eighty-odd fetches inside a hand-run test
 * is a price nobody ever sees.
 *
 * THE SELECTION RULE, and it is the only one: every criterion below points at a
 * defect this project actually shipped, or came within one commit of shipping.
 * A regression test nobody can name a bug for is a test that gets deleted the
 * first time it is inconvenient — so each one carries its bug in the comment.
 *
 * Tier 0 does not write to the world. R12 opens windows and closes them again;
 * R10 calls hot functions and throws the answers away.
 */

/** Fetched once per run: eighty-eight files, and every criterion wants them. */
let sourceCache = null;

/**
 * Every script this module ships, by file name.
 *
 * CRAWLED FROM `module.mjs`, NOT LISTED. A list is the thing that rots: the
 * file added next month is exactly the one nobody remembers to add here, and it
 * would be silently exempt from all thirteen criteria while the suite kept
 * reporting green. The crawl cannot have that hole — a file nothing imports is
 * a file Foundry never loads either. Measured: 88 on disk, 88 reached.
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

/** The same, minus this file — which quotes every pattern it hunts for. */
async function otherSources() {
    const all = await moduleSources();
    return [...all].filter(([file]) => file !== "tests.mjs");
}

/**
 * Source with its comments taken out.
 *
 * LEARNED IN E22, AT THE COST OF A FALSE PASS AND A FALSE FAIL. A test that
 * read its own module found the broken CSS *quoted in the comment above the
 * fix* and reported the fix as missing. Anything that greps this module for
 * evidence has to look at the code, because the comments here are long and full
 * of the exact strings the code is not supposed to contain any more.
 */
function stripComments(text) {
    // NEWLINES SURVIVE, and the first run is why. Collapsing a block comment to
    // one space shortens the file by every line it spanned, so every `file:line`
    // this tier reported pointed at innocent code — `movement.mjs:629`, which is
    // a variable declaration, for a call that lives two hundred lines further
    // down. A failure message nobody can follow is worse than no message.
    return text
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
        .replace(/^([ \t]*)\/\/.*$/gm, "$1")
        // AND THE ONE THAT SITS AFTER CODE. R22 read `// safely() may retry`
        // as a call to a function nobody declared, and `// strip accents (ą…)`
        // as another. The character in front has to be neither `:` nor a word
        // character, which is what keeps `https://` and every other protocol
        // out of it.
        .replace(/([^:\w])\/\/[^\n]*$/gm, "$1");
}

/** Every stylesheet in module.json, concatenated, comments removed. */
async function moduleStyles() {
    const manifest = await fetch(`/modules/${MODULE_ID}/module.json`).then(r => r.json());
    const parts = [];
    for (const href of manifest.styles ?? []) {
        parts.push(await fetch(`/modules/${MODULE_ID}/${href}`).then(r => r.text()));
    }
    return parts.join("\n").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Line number of an index, for a failure message somebody has to act on. */
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Source with its STRING CONTENTS blanked, `${...}` expressions kept.
 *
 * R22 asks which names this module calls, and half the module's output is
 * HTML built in template literals. Without this, `"<button onclick="` and
 * every other parenthesis inside a sentence reads as a call to something that
 * does not exist — and a tier-0 test that cries wolf is a tier-0 test people
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
 * Every name a file BINDS: imported, declared, destructured, taken as a
 * parameter. Generous on purpose — R22 reports what is in none of these, so
 * a name this misses is a false accusation, and a name it over-collects is
 * only a miss.
 */
function boundNames(text) {
    const names = new Set();
    const add = s => {
        for (const w of s.match(/[A-Za-z_$][\w$]*/g) ?? []) if (w !== "as") names.add(w);
    };
    for (const m of text.matchAll(/import\s+([\s\S]*?)\s+from\b/g)) add(m[1]);
    // THE PARAMETER LIST IS WALKED, not matched. `function createProject({ name,
    // rooms = allRooms() })` has parentheses inside its own parameters, and a
    // `[^()]*` pattern simply fails on it — which took the FUNCTION'S NAME down
    // with it and had the first run of R22 accuse twenty-three real, exported,
    // perfectly reachable functions of not existing.
    for (const m of text.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(/g)) {
        if (m[1]) names.add(m[1]);
        let depth = 0;
        let j = m.index + m[0].length - 1;
        const from = j;
        for (; j < text.length; j++) {
            if (text[j] === "(") depth++;
            else if (text[j] === ")" && --depth === 0) break;
        }
        add(text.slice(from + 1, j));
    }
    for (const m of text.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of text.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of text.matchAll(/\b(?:const|let|var)\s*([{[][^=;]{0,400}?[}\]])\s*=/g)) add(m[1]);
    for (const m of text.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of text.matchAll(/^\s*(?:async\s+|static\s+|\*\s*)*([A-Za-z_$][\w$]*)\s*\([^()]{0,200}\)\s*\{/gm)) {
        names.add(m[1]);
    }
    // arrow parameters: walk back from every => to its parameter list
    for (const m of text.matchAll(/=>/g)) {
        let i = m.index - 1;
        while (i >= 0 && /\s/.test(text[i])) i--;
        if (i < 0) continue;
        if (text[i] === ")") {
            let depth = 0;
            let j = i;
            for (; j >= 0; j--) {
                if (text[j] === ")") depth++;
                else if (text[j] === "(" && --depth === 0) break;
            }
            add(text.slice(j, i));
        } else {
            let j = i;
            while (j >= 0 && /[\w$]/.test(text[j])) j--;
            names.add(text.slice(j + 1, i + 1));
        }
    }
    return names;
}

/** Names that are simply there, on any page, in any Foundry world. */
const AMBIENT = new Set(`
game ui canvas CONFIG CONST Hooks foundry console Handlebars PIXI jQuery
Object Array String Number Boolean Symbol Math JSON Promise Set Map WeakMap WeakSet
Date RegExp Error TypeError RangeError Proxy Reflect Intl BigInt Infinity NaN
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
queueMicrotask structuredClone fetch atob btoa alert confirm prompt open getComputedStyle
document window navigator location history localStorage sessionStorage performance crypto
URL URLSearchParams Blob File FileReader FormData Headers Request Response AbortController
Image Audio AudioContext Event CustomEvent EventTarget MutationObserver ResizeObserver
Element HTMLElement Node NodeList DOMParser Range CSS
Uint8Array Float32Array ArrayBuffer DataView TextDecoder TextEncoder
fromUuid fromUuidSync renderTemplate loadTemplates getDocumentClass srcExists
`.trim().split(/\s+/));

// `#` is in there because `this.#spendAsGm(` is a method, not a bare name.
const CALLED = /(?:(?<=\.\.\.)|(?<![.\w$?#]))([A-Za-z_$][\w$]*)\s*\(/g;

const JS_KEYWORDS = new Set(`
if else for while switch catch return typeof instanceof new delete void function class
const let var do try finally throw await async yield of in case default super this
import export extends get set static break continue debugger with
`.trim().split(/\s+/));

/** Names a file declares as a function and never as anything else. */
function functionsOnly(text) {
    const fns = new Set();
    for (const m of text.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^()]{0,120}\)|[A-Za-z_$][\w$]*)\s*=>/g)) {
        fns.add(m[1]);
    }
    for (const m of text.matchAll(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
        fns.add(m[1]);
    }
    // A name that is ALSO a value somewhere in this file is out of scope: the
    // boolean is reading that value, not the function. Five of the six the
    // first run of this reported were exactly that — a parameter named
    // `grants`, a `let done = false`, a `const label`.
    // EVERY PARAMETER NAME IN THE FILE, GATHERED ONCE. The first version asked
    // this question per candidate, and each asking walked the whole file: about
    // a hundred names across eighty-nine sources, some of them a quarter of a
    // megabyte. The suite went from twelve seconds to minutes and looked hung.
    // One pass, then set membership.
    const params = new Set();
    for (const m of text.matchAll(/\(([^()]{0,300})\)\s*(?:=>|\{)/g)) {
        for (const w of m[1].match(/[A-Za-z_$][\w$]*/g) ?? []) params.add(w);
    }

    for (const name of [...fns]) {
        if (params.has(name)) { fns.delete(name); continue; }
        // THE SPACE GOES INSIDE THE LOOKAHEAD. With `\\s*` in front of it the
        // engine is free to match zero spaces, hand the lookahead " () =>", watch
        // it fail on the leading space and conclude the declaration is a value.
        // Every arrow in the module read as one, so R21 saw nothing at all —
        // including the fault written into its own fixture.
        const asValue = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=(?!\\s*(?:async\\s*)?(?:\\([^()]{0,120}\\)|[A-Za-z_$][\\w$]*)\\s*=>)`);
        if (asValue.test(text)) fns.delete(name);
    }
    return fns;
}

/** Every place a bare name is asked to be true or false. */
function truthyReads(text, name) {
    const out = [];
    const pats = [
        new RegExp(`!\\s*${name}\\s*(?![\\w$(.])`, "g"),
        new RegExp(`(?<![.\\w$])${name}\\s*\\?(?!\\.)`, "g"),
        new RegExp(`\\bif\\s*\\(\\s*${name}\\s*\\)`, "g"),
        new RegExp(`&&\\s*${name}\\s*(?:\\?|\\)|&&|\\|\\|)`, "g")
    ];
    for (const p of pats) for (const m of text.matchAll(p)) out.push(m.index);
    return out;
}

const REGRESSIONS = [
    ["R1 · every translation key the module names out loud resolves", async () => {
        /*
         * A RAW KEY ON A PLAYER'S SCREEN IS THE ONLY DEFECT IN THIS MODULE THAT
         * THE TABLE SEES BEFORE THE GM DOES. Everything else fails towards the
         * GM's console; this one prints `DRPG.Tamper.notFound` in the middle of
         * somebody's turn.
         *
         * The invariant that used to cover this kept a hand-written list of
         * thirty keys out of two thousand and admitted in its own comment that
         * it "erred on the reassuring side". This reads all of them.
         *
         * DYNAMIC KEYS ARE OUT OF SCOPE ON PURPOSE, not by oversight: a key
         * assembled from a table (`DRPG.Trap.trigger.${kind}`) cannot be
         * resolved without knowing the table, and the tables have their own
         * both-directions invariants. What this owns is the literal — which is
         * where the misses have actually been.
         */
        const missing = new Map();
        let checked = 0;
        for (const [file, raw] of await otherSources()) {
            const text = stripComments(raw);
            for (const m of text.matchAll(/"(DRPG\.[A-Za-z0-9_.]+)"/g)) {
                const key = m[1];
                // A key built by hand — `"DRPG.Clock." + slot` — is a PREFIX,
                // and asking whether a prefix resolves is the wrong question.
                if (key.endsWith(".")) continue;
                if (/^\s*[+`]/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 3))) continue;
                checked++;
                if (game.i18n.has(key)) continue;
                // A COUNTED SENTENCE IS A FAMILY, NOT A KEY. `plural()` asks for
                // `key.one` / `key.other` and never for `key` itself, so 68 of
                // these were reported missing on the first run and every one of
                // them was on screen and correct. `.other` is the form that must
                // exist: `plural` falls back to it by design when the language
                // has no `.one`.
                if (game.i18n.has(`${key}.other`)) continue;
                if (!missing.has(key)) missing.set(key, `${file}:${lineAt(text, m.index)}`);
            }
        }
        ok(checked > 1000, `only ${checked} keys were read — the crawl is not reaching the module`);
        ok(!missing.size, `these keys print themselves at the table: ${
            [...missing].map(([k, w]) => `${k} (${w})`).join(", ")}`);
    }],

    ["R2 · no styling rule in the sheet has lost its emitter", async () => {
        /*
         * DEAD CSS IS INVISIBLE BY CONSTRUCTION. `.drpg-tamper-cover` was
         * written in E12 and replaced by an attribute a day later; the rule
         * stayed, and nothing about the module's behaviour would ever have said
         * so. Multiply that by an update this size and the sheet becomes a place
         * where you cannot tell which half of a selector is load-bearing.
         *
         * ONE DIRECTION, NOT TWO, AND THE MEASUREMENT IS WHY. The other
         * direction — "every class named in a script has a rule" — was built,
         * run, and dropped: 478 class names in the scripts, 133 of them with no
         * rule. Narrowed to the 173 that appear inside a `class="…"` attribute
         * it still reported 8, and all eight are structural: grid children that
         * take their placement from the parent (`drpg-tables-left`), wrappers
         * (`drpg-requirements`), live-region markers. A test that fails on those
         * is a test demanding the markup be made LESS readable — the same trap
         * as the E21 trigger test that demanded a worse implementation. So the
         * direction that measured zero and has real teeth is the one that runs.
         */
        const css = await moduleStyles();
        const inSheet = new Set([...css.matchAll(/\.(drpg-[a-z0-9-]+)/g)].map(m => m[1]));
        ok(inSheet.size > 200, `only ${inSheet.size} rules were read — the stylesheets did not load`);

        const named = new Set();
        const families = new Set();
        for (const [, raw] of await otherSources()) {
            for (const m of stripComments(raw).matchAll(/drpg-[a-z0-9-]*/g)) {
                named.add(m[0]);
                // `drpg-outcome-${tone}` NAMES A FAMILY, not a class, and the
                // whole family is emitted by that one line. The trailing dash is
                // what marks it — and `drpg-` on its own is excluded, because
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
        const styled = new Set([...css.replace(/:not\([^)]*\)/g, " ")
            .matchAll(/\.(drpg-[a-z0-9-]+)/g)].map(m => m[1]));

        const orphans = [...inSheet].filter(c =>
            styled.has(c) && !switches.has(c)
            && !named.has(c) && ![...families].some(f => c.startsWith(f)));
        ok(!orphans.length, `these rules are styling nothing: ${orphans.join(", ")}`);
    }],

    ["R3 · every sound a card asks for is a sound that exists", async () => {
        /*
         * `onCreateChatMessage` reads `flags.danganronpa-rpg.sfx` and plays it.
         * A typo there is silence — no error, no warning, and the failure looks
         * exactly like a GM who has not mapped a file to that event yet.
         *
         * Same failure mode as `yieldsTo`, which already has an invariant. That
         * one guards the table; this one guards the fourteen call sites, which
         * is where a rename actually goes wrong.
         */
        const bad = [];
        for (const [file, raw] of await otherSources()) {
            const text = stripComments(raw);
            // TWO SHAPES, AND THE FIRST VERSION OF THIS TEST ONLY SAW ONE.
            // The flag is written either bare (`sfx: "chatSend"`) or with an
            // audience (`sfx: { key: "eclipseEnd", gm: true }`), and the split
            // is almost even — 13 of the first, 12 of the second. Reading only
            // the bare form left every GM-audience sound unchecked, which is
            // the half where a silent miss costs most: the death, the body,
            // the safeword. Found in E17 by measuring an Eclipse ending.
            for (const m of text.matchAll(/\bsfx:\s*(?:"([\w.]+)"|\{\s*key:\s*"([\w.]+)")/g)) {
                const key = m[1] ?? m[2];
                if (!SFX_EVENTS[key]) bad.push(`${file}:${lineAt(text, m.index)} → "${key}"`);
            }
            for (const m of text.matchAll(/\bplaySfx\(\s*"([\w.]+)"/g)) {
                if (!SFX_EVENTS[m[1]]) bad.push(`${file}:${lineAt(text, m.index)} → playSfx("${m[1]}")`);
            }
        }
        ok(!bad.length, `these ask for a sound that is not in the catalogue: ${bad.join(", ")}`);
    }],

    ["R20 · every sound in the catalogue is a sound something plays", async () => {
        /*
         * R3'S MIRROR, AND IT FOUND ONE THE DAY IT WAS WRITTEN.
         *
         * R3 asks whether every sound the code plays exists. This asks the other
         * question, which is the one a GM feels: `newRule` had been in the
         * catalogue since v1.1.8, with a label and a hint and a row in the Sound
         * panel, and nothing anywhere posted it. A GM could pick a file, press
         * Test, hear it, map it — and then never hear it again, because the only
         * card that announces a new rule carried no flag.
         *
         * That is the worst kind of silence in this module: the panel promises,
         * the file is right, the GM concludes the sound system is broken.
         *
         * Named in ANY string outside config.mjs is the test, deliberately loose:
         * `playSfx(x ? "sheetButton" : "windowButton")` and
         * `SFX_FOR_STATE[state.id]` are both real and neither is a literal
         * argument. Being mentioned is weak evidence of being played; never
         * being mentioned at all is strong evidence of the opposite, and that is
         * the direction this test is for.
         */
        const unplayable = [];
        for (const [file, raw] of await otherSources()) {
            if (file === "config.mjs") continue;
            const text = stripComments(raw);
            for (const m of text.matchAll(/"([\w.]+)"/g)) {
                if (SFX_EVENTS[m[1]]) unplayable.push(m[1]);
            }
        }
        const named = new Set(unplayable);
        const silent = Object.keys(SFX_EVENTS).filter(key => !named.has(key));
        ok(!silent.length,
            `these are in the Sound panel and nothing ever plays them: ${silent.join(", ")}`);
    }],

    ["R4 · every setting the module reaches for is a setting it registered", async () => {
        /*
         * A SETTING THAT WAS NEVER REGISTERED ANSWERS WITH ITS DEFAULT AND DOES
         * NOT BLINK. Not an exception, not a warning — the wrong answer,
         * forever, in a module where half the rules of the game live in world
         * settings.
         *
         * Three directions, because each one is a different accident: a name
         * typed into a reader that the map does not have; a name in the map that
         * `registerSettings` forgot; and a registration nobody reads any more,
         * which is a world setting shipped to every client for nothing.
         */
        const used = new Set();
        for (const [, raw] of await otherSources()) {
            for (const m of stripComments(raw).matchAll(/\bSETTINGS\.(\w+)\b/g)) used.add(m[1]);
        }
        ok(used.size > 30, `only ${used.size} settings were seen — the crawl is not reaching the module`);

        const declared = new Set(Object.keys(SETTINGS));
        const undeclared = [...used].filter(k => !declared.has(k));
        ok(!undeclared.length, `these names are not in SETTINGS: ${undeclared.join(", ")}`);

        const unregistered = [...declared].filter(k => !game.settings.settings.has(`${MODULE_ID}.${SETTINGS[k]}`));
        ok(!unregistered.length, `these are declared and never registered, so they answer with a default: ${
            unregistered.join(", ")}`);

        const unread = [...declared].filter(k => !used.has(k));
        ok(!unread.length, `these are registered and never read: ${unread.join(", ")}`);

        // And every one of them says out loud which side of the wire it lives
        // on. Foundry defaults `scope` to "world", so a store that was meant to
        // be private and simply forgot to say so is sent to every client — the
        // exact shape of the mistake R9 exists to catch downstream.
        const noScope = [...declared].filter(k =>
            !game.settings.settings.get(`${MODULE_ID}.${SETTINGS[k]}`)?.scope);
        ok(!noScope.length, `these do not declare a scope: ${noScope.join(", ")}`);
    }],

    ["R5 · no sound is played inside a function only the GM runs", async () => {
        /*
         * THIS IS THE BUG. `analyzeHit`, `observeFail` and `analyzeMiss` played
         * to the GM and to nobody else for four releases, because each resolver
         * opens with `if (!game.user.isGM) return` and the comment above the
         * `playSfx` call said the code was "local". The player rolled, the
         * player's own client stayed silent, and the only person who heard the
         * result was the one who already knew it.
         *
         * A sound that belongs to a resolver has to travel as a flag on the chat
         * card, where every client that renders the card plays it.
         *
         * Read from the source because there is nothing to drive: the function
         * runs, the sound plays, and it plays on the wrong machine. No assertion
         * a single client can make will see that.
         */
        const guilty = [];
        for (const [file, raw] of await otherSources()) {
            if (file === "sfx.mjs") continue;   // the player itself, GM-agnostic
            const text = stripComments(raw);
            const starts = [...text.matchAll(
                /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?const\s+(\w+)\s*=/gm)];
            for (const call of text.matchAll(/\bplaySfx\(/g)) {
                const owner = starts.filter(s => s.index < call.index).pop();
                if (!owner) continue;
                const body = text.slice(owner.index, call.index);
                if (/if\s*\(\s*!\s*game\.user\??\.isGM\s*\)\s*(?:return|\{[^}]{0,120}return)/.test(body)) {
                    guilty.push(`${file}:${lineAt(text, call.index)} in ${owner[1] ?? owner[2]}`);
                }
            }
        }
        ok(!guilty.length, `these play to the GM and to nobody else: ${guilty.join(", ")}`);
    }],

    ["R6 · no bridge request can be made by the one person it is addressed to", async () => {
        /*
         * TWO WAYS TO LOSE AN ACTION, and the bridge has to be closed against
         * both.
         *
         * A GM calling `requestSabotage` emits a socket packet that Foundry does
         * NOT deliver back to its sender: the request is gone, no error, no
         * refusal, and the action the player paid for simply did not happen.
         *
         * A table with no GM connected is the other end of it. `hasGm()` has to
         * refuse immediately, because the alternative is a player watching a
         * spinner for three minutes and then losing the action anyway.
         *
         * THE FIRST HALF IS NOT WHERE IT LOOKS. Nine of these have no GM branch
         * of their own and all nine are correct: the branch lives in the domain
         * function that calls them — `sabotageProject` does the work itself when
         * it is the GM and only reaches for the bridge otherwise. So the question
         * is not "does the bridge have a branch" but "can a GM get here at all",
         * which is the call site's business, and that is what this reads.
         */
        const sources = new Map(await otherSources());
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        ok(bridge.length > 1000, "gm-bridge.mjs did not load");

        const requests = [...bridge.matchAll(/^export\s+(?:async\s+)?function\s+(request\w+)\s*\(/gm)];
        ok(requests.length > 20, `only ${requests.length} bridge requests found`);

        const noRefusal = [], reachable = [];
        for (let i = 0; i < requests.length; i++) {
            const name = requests[i][1];
            const to = i + 1 < requests.length ? requests[i + 1].index : bridge.length;
            const body = bridge.slice(requests[i].index, to);
            if (!body.includes("hasGm(")) noRefusal.push(name);

            // Does the bridge answer for the GM itself? Then any call site is
            // safe and there is nothing more to ask.
            if (/game\.user\.isGM/.test(body)) continue;

            for (const [file, raw] of sources) {
                if (file === "gm-bridge.mjs") continue;
                const text = stripComments(raw);
                for (const call of text.matchAll(new RegExp(`\\b${name}\\s*\\(`, "g"))) {
                    /*
                     * A GM CHECK HAS TO STAND OVER THE CALL, and it has two
                     * shapes, not one. `if (!game.user.isGM) { …request… }` is
                     * the common one; `if (game.user.isGM) { do it here } else
                     * { …request… }` is the other, and demanding the `!` read
                     * the second as unguarded on the first run — which is the
                     * test asking for a worse implementation of a correct
                     * function.
                     *
                     * Close, too: three hundred characters, not six hundred. A
                     * guard far enough away to be out of sight is a guard the
                     * next person to edit this will not know is load-bearing.
                     */
                    const before = text.slice(Math.max(0, call.index - 300), call.index);
                    if (!/game\.user\??\.isGM/.test(before)) {
                        reachable.push(`${file}:${lineAt(text, call.index)} → ${name}`);
                    }
                }
            }
        }
        ok(!noRefusal.length,
            `these hang instead of refusing when no GM is connected: ${noRefusal.join(", ")}`);
        ok(!reachable.length,
            `a GM reaching these talks to itself down a socket and the action is lost: ${
                reachable.join(", ")}`);
    }],

    ["R7 · Reroll reads no field of the bookmark that nothing ever writes", async () => {
        /*
         * REROLL UNDOES AN ACTION AND PLAYS IT AGAIN, and everything it needs to
         * do that comes off one flag written by whoever made the roll. A field
         * it reads that nobody writes is a Reroll that quietly does nothing —
         * and in E12 it did worse than nothing: it explained itself, wrongly,
         * because `bookmark.cleanup` held a token id for one action and a NAME
         * for two others.
         *
         * The type disagreement is not machine-checkable from source. The
         * absence is, and it is the same accident one rename away.
         */
        const sources = new Map(await otherSources());
        const reroll = stripComments(sources.get("reroll.mjs") ?? "");
        ok(reroll.length > 1000, "reroll.mjs did not load");

        const reads = new Set([...reroll.matchAll(/\bbookmark\??\.(\w+)/g)].map(m => m[1]));
        ok(reads.size > 10, `only ${reads.size} bookmark fields were read`);

        const elsewhere = [...sources].filter(([f]) => f !== "reroll.mjs")
            .map(([, raw]) => stripComments(raw)).join("\n");
        // Written as a key (`remnantId: doc.id`) or as shorthand inside a
        // context object (`{ room, category, goal }`) — both are writes.
        const orphans = [...reads].filter(f =>
            !new RegExp(`[{,]\\s*${f}\\s*[,}:]`).test(elsewhere));
        ok(!orphans.length,
            `Reroll reads these and no action writes them: ${orphans.join(", ")}`);
    }],

    ["R8 · every action on the sheet has a branch, and every branch has a briefing", async () => {
        /*
         * A TILE THAT OPENS AN EMPTY WINDOW. `performAction` dispatches on the
         * action key, the sheet draws whatever is in `ACTIONS`, and the two are
         * kept in step by nothing at all.
         *
         * E12 made this concrete rather than theoretical: `kind: "variant"` and
         * `kind: "panel"` mean an entry with no tile of its own is now a NORMAL
         * state, so "has a branch" and "has a tile" came apart on purpose and
         * have to be watched separately.
         *
         * The briefing half is driven, not read: `briefingBlock` composes three
         * localised strings per action, and the one that is missing is the one
         * nobody has opened since it was renamed.
         */
        const sources = new Map(await otherSources());
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        const from = rolls.indexOf("export async function performAction");
        ok(from > 0, "performAction is not where this test expects it");
        const body = rolls.slice(from, rolls.indexOf("\n}\n", from));

        const cases = new Set([...body.matchAll(/case\s+"(\w+)"/g)].map(m => m[1]));
        const noBranch = Object.keys(ACTIONS).filter(k => !cases.has(k));
        ok(!noBranch.length, `these are drawn and then dispatch nowhere: ${noBranch.join(", ")}`);

        const noEntry = [...cases].filter(k => !ACTIONS[k]);
        ok(!noEntry.length, `performAction answers to actions that do not exist: ${noEntry.join(", ")}`);

        const { briefingBlock } = await import("./action-rolls.mjs");
        const actor = studentActors()[0];
        ok(actor, "need a student to render a briefing for");
        const silent = [];
        for (const [key, def] of Object.entries(ACTIONS)) {
            let html = "";
            try { html = briefingBlock(actor, key, def) ?? ""; } catch (err) { html = `threw: ${err.message}`; }
            if (!html || html.length < 20 || html.includes("DRPG.")) silent.push(`${key} (${html.slice(0, 60)})`);
        }
        ok(!silent.length, `these briefings are empty or print a raw key: ${silent.join(", ")}`);
    }],

    ["R9 · nothing the investigation depends on is in a world setting", async () => {
        /*
         * FOUNDRY SENDS THE WHOLE WORLD TO EVERY CLIENT. A world-scoped setting
         * is readable from any player's console, in full, whatever the interface
         * chooses to show — so the entire murder mystery rests on one rule: what
         * a Remnant really is, who left it, what it points at and how hard it is
         * to read never leaves the GM's own browser.
         *
         * There is an invariant for Remnant TOKENS already. This is the same
         * question asked of every store the module registers, which is where the
         * next one will be added.
         *
         * KNOWN AND DELIBERATE: `projectMeta` is world-scoped and carries
         * `killerId` and the trap's `condition`, so an indirect murder's owner
         * is legible from a player's console today. That is Dawid's call, not a
         * slip — `secret` was specified as hiding the UI — and it is written
         * down here so the next reader does not think it got past this test.
         */
        const FORBIDDEN = ["sourceActor", "realType", "pointsAt", "dc", "tiedToCrime"];
        const found = [];
        for (const [full, def] of game.settings.settings) {
            if (!full.startsWith(`${MODULE_ID}.`)) continue;
            if (def.scope !== "world") continue;
            let value = null;
            try { value = game.settings.get(MODULE_ID, full.slice(MODULE_ID.length + 1)); } catch { continue; }
            const seen = new Set();
            const walk = (node, path) => {
                if (!node || typeof node !== "object" || seen.has(node)) return;
                seen.add(node);
                for (const [k, v] of Object.entries(node)) {
                    if (FORBIDDEN.includes(k)) found.push(`${full} :: ${path}${k}`);
                    walk(v, `${path}${k}.`);
                }
            };
            walk(value, "");
        }
        ok(!found.length, `these are on every player's machine right now: ${found.join(", ")}`);
    }],

    ["R10 · the hot lookups stay under their ceiling", async () => {
        /*
         * FOUND BY MEASUREMENT, NEVER BY FAILURE — which is the whole argument
         * for having this at all. E11's stash lookup ran 0.218 ms with twelve
         * items in a room because `regionsByName` rebuilt its map twice per
         * item. Nothing broke. Nothing warned. It was quadratic and it shipped,
         * and the only reason it was found is that somebody thought to time it.
         *
         * These are the lookups the module makes on every movement, every action
         * and every render. The ceiling is deliberately loose: this exists to
         * catch an order of magnitude, not to police a tenth of a millisecond on
         * somebody else's laptop.
         *
         * AND THE TRAP CHECK, added with E21: a room crossing now asks whether
         * anything is armed, several hundred times a session. It is measured
         * with nothing armed, which is both the common case and the one where a
         * regression would hide.
         */
        const M = await import("./movement.mjs");
        const V = await import("./vault.mjs");
        const R = await import("./remnants.mjs");
        const C = await import("./cleanup.mjs");

        const actor = studentActors()[0];
        ok(actor, "need a student");
        const room = M.allRooms()[0] ?? null;

        const time = (fn, runs = 200) => {
            fn();                                  // warm: the first call pays for the map
            const t0 = performance.now();
            for (let i = 0; i < runs; i++) fn();
            return (performance.now() - t0) / runs;
        };

        const measured = {
            roomOfActor: time(() => M.roomOfActor(actor)),
            othersInRoom: time(() => M.othersInRoom(actor)),
            stashItemsIn: time(() => V.stashItemsIn(actor, room)),
            remnantsInRoom: time(() => R.remnantsInRoom(room)),
            cleanableRemnants: time(() => C.cleanableRemnants(actor)),
            crossingWithTraps: time(() => Hooks.callAll("drpgRoomCrossed",
                { actor, from: null, to: room, tokenDoc: null, cost: 0 }), 60)
        };
        const CEILING = 2.0;   // ms per call, on a machine also running Foundry
        const over = Object.entries(measured)
            .filter(([, ms]) => ms > CEILING)
            .map(([name, ms]) => `${name} ${ms.toFixed(3)} ms`);
        log(`R10 hot paths: ${Object.entries(measured)
            .map(([n, ms]) => `${n} ${ms.toFixed(3)}ms`).join(", ")}`);
        ok(!over.length, `over the ${CEILING} ms ceiling: ${over.join(", ")}`);
    }],

    ["R11 · no bridge request can wait forever", async () => {
        /*
         * THE PAIR TO R6, AND THE HALF A GM'S OWN CLIENT CANNOT MEASURE.
         *
         * A request that waits on a ruling has to be able to give up. B-F5-1 was
         * a player who lost an action because nobody answered; it was fixed once
         * and has had no test since.
         *
         * WHAT THIS CANNOT DO, said plainly: it cannot watch a table with no GM,
         * because it runs on the GM's machine and `hasGm()` is true by
         * construction. Faking that would mean reaching into `game.users` mid
         * run, which is a lie told to every other listener in the world at the
         * same time. So the machine checks the shape — every waiting request has
         * a bounded timeout that RESOLVES rather than rejects — and the live half
         * stays on the human list: disconnect the GM, act as a player, and watch
         * the refusal come back at once.
         */
        const sources = new Map(await otherSources());
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const requests = [...bridge.matchAll(/^export\s+(?:async\s+)?function\s+(request\w+)\s*\(/gm)];
        ok(requests.length > 20, "gm-bridge.mjs did not load");

        const unbounded = [];
        for (let i = 0; i < requests.length; i++) {
            const name = requests[i][1];
            const to = i + 1 < requests.length ? requests[i + 1].index : bridge.length;
            const body = bridge.slice(requests[i].index, to);
            // A request that never makes a Promise cannot hang: it emits and
            // returns `{ pending: true }` in the same tick.
            if (!/new Promise/.test(body)) continue;
            if (!/setTimeout\([\s\S]{0,400}?resolve\(/.test(body)) unbounded.push(name);
        }
        ok(!unbounded.length,
            `these wait on a ruling with no way to give up: ${unbounded.join(", ")}`);
    }],

    ["R12 · every standing window fits the screen Foundry calls a minimum", async () => {
        /*
         * TRAP 145 WAS EXACTLY THIS QUESTION and the answer had to be SEEN, not
         * reasoned about: a sixth entry in the Search menu, and whether it fit
         * was not something anybody could derive from the markup.
         *
         * Foundry's stated minimum is 1366×768. These are the windows this
         * module draws itself, so they are the only ones whose width is our
         * fault — and a horizontal scrollbar in a GM tool is merely annoying for
         * a year and then loses somebody a ruling mid-trial, because the column
         * they needed was off the right-hand edge.
         *
         * Opened for real and closed again. A window that refuses to open — no
         * incident, no trial in progress — is recorded rather than failed, but
         * the number that DID open is asserted, so this can never quietly
         * measure nothing and report success.
         */
        const MIN_WIDTH = 1366;

        /*
         * THE SCREEN IT IS ON, and a source check for the screen it is not.
         *
         * This used to compare the measured width against 1366 flat, which made
         * the answer a fact about the browser pane the suite happened to be run
         * in rather than about the module. Every width cap here is written
         * `min(…, 96vw)`, so on a 1600px pane those windows are 1536 and the
         * test failed three of them; on a 1280px pane the same code passes. A
         * test that reports a defect when the window is dragged wider is a test
         * that gets switched off.
         *
         * What is actually ours is in two halves, and neither moves with the
         * pane: nothing may be wider than the screen it is drawn on, and no rule
         * in our stylesheets may PIN a window to a fixed width above the
         * minimum. A `vw` cap satisfies the second by construction, which is why
         * this reads the source for pixels rather than measuring again.
         */
        const pinned = [];
        for (const m of (await moduleStyles()).matchAll(
            /(?:^|[;{])\s*(?:max-)?width:\s*(\d{4,})px/g)) {
            if (Number(m[1]) > MIN_WIDTH) pinned.push(`${m[1]}px`);
        }
        ok(!pinned.length, `a window is pinned wider than ${MIN_WIDTH}px: ${pinned.join(", ")}`);

        const openers = [];
        for (const [file, raw] of await otherSources()) {
            for (const m of stripComments(raw).matchAll(
                /^export (?:async )?function (open[A-Z]\w*|manage[A-Z]\w*)\s*\(/gm)) {
                if (STANDING.includes(m[1])) openers.push([file, m[1]]);
            }
        }
        ok(openers.length >= 15, `only ${openers.length} standing windows were found`);

        const wide = [], refused = [];
        let measured = 0;
        for (const [file, name] of openers) {
            const before = new Set(foundry.applications.instances.keys());
            try {
                const mod = await import(`./${file}`);
                // NOT AWAITED, and this cost a run to learn: half of these
                // openers are `DialogV2.wait`, whose promise settles when the
                // person closes the window. Awaiting one stops the suite dead
                // with a Sound panel on screen and no way forward — measured,
                // the first time this ran. The window is what we are after, so
                // the window is what we wait for.
                Promise.resolve(mod[name]()).catch(() => {});
            } catch { refused.push(name); continue; }
            await wait(260);

            const fresh = [...foundry.applications.instances.entries()]
                .filter(([id]) => !before.has(id)).map(([, app]) => app);
            if (!fresh.length) { refused.push(name); continue; }
            for (const app of fresh) {
                const el = app.element;
                if (el?.isConnected) {
                    measured++;
                    if (el.offsetWidth > window.innerWidth) {
                        wide.push(`${name} is ${el.offsetWidth}px wide on a `
                            + `${window.innerWidth}px screen`);
                    }
                    /*
                     * AND NOTHING INSIDE IT MAY PUSH SIDEWAYS EITHER — but the
                     * question is only meaningful of a box that can scroll.
                     *
                     * The first version asked it of every `form`, and reported
                     * seven windows that are perfectly fine: a form is not a
                     * scroll container, so a child sticking 16px past its
                     * padding box produces no scrollbar and nothing visible at
                     * all. One of the eight was real — the Monocub dialog, 1344
                     * of content in a 1273 scrollport — and it would have been
                     * lost in the noise of the other seven, which is precisely
                     * how a test that cries wolf gets switched off.
                     */
                    for (const box of el.querySelectorAll("*")) {
                        const overflowX = getComputedStyle(box).overflowX;
                        if (overflowX !== "auto" && overflowX !== "scroll") continue;
                        if (box.scrollWidth > box.clientWidth + 2) {
                            wide.push(`${name} scrolls sideways (${box.scrollWidth} in ${box.clientWidth})`);
                            break;
                        }
                    }
                }
                try { await app.close(); } catch { /* nothing useful to do about it here */ }
            }
            await wait(60);
        }
        log(`R12: ${measured} windows measured, ${refused.length} declined (${refused.join(", ") || "none"})`);
        ok(measured >= 10, `only ${measured} windows actually opened — this measured nothing`);
        ok(!wide.length, `these do not fit the screen: ${wide.join("; ")}`);
    }],

    ["R13 · every trigger a trap can name has something listening for it", async () => {
        /*
         * BOTH DIRECTIONS, and the second one is the reason this exists.
         *
         * A trigger with no listener is the worst shape a feature of this kind
         * can take: the GM picks it out of a list, the trap arms, and then
         * nothing ever happens — which looks exactly like a trap nobody walked
         * into. It does not throw, it does not warn, and at the table it is
         * indistinguishable from working.
         *
         * So: every `TRAP_TRIGGERS` entry that declares a `watch` must have a
         * listener in traps.mjs that handles that watch, and every kind the
         * listeners handle must be a trigger somebody can actually choose.
         */
        const { TRAP_TRIGGERS } = await import("./config.mjs");
        const src = await fetch(`/modules/${MODULE_ID}/scripts/traps.mjs`).then(r => r.text());

        // Which events the file actually subscribes to.
        const hooks = new Set([...src.matchAll(/Hooks\.on\("(drpg\w+|createChatMessage)"/g)]
            .map(m => m[1]));
        const WATCH_HOOK = {
            crossing: "drpgRoomCrossed",
            action: "drpgActionResolved",
            rest: "drpgRested",
            stash: "drpgStashHunted",
            item: "createChatMessage"
        };

        const unwatched = [];
        for (const [key, def] of Object.entries(TRAP_TRIGGERS)) {
            if (!def.watch) continue;                 // `manual` is a choice, not a gap
            const hook = WATCH_HOOK[def.watch];
            if (!hook) { unwatched.push(`${key} (watch "${def.watch}" is not a known kind)`); continue; }
            if (!hooks.has(hook)) unwatched.push(`${key} (nothing listens to ${hook})`);
        }
        ok(!unwatched.length, `these triggers arm and then never fire: ${unwatched.join(", ")}`);

        // The other direction: a listener that tests for a kind nobody can pick.
        const named = [...src.matchAll(/kind !== "(\w+)"|kind === "(\w+)"/g)]
            .map(m => m[1] ?? m[2]);
        const unknown = named.filter(k => !TRAP_TRIGGERS[k]);
        ok(!unknown.length, `these listeners test for triggers that do not exist: ${unknown.join(", ")}`);
    }],

    ["R16 · no private card is posted around the private channel", async () => {
        /*
         * THE OTHER HALF OF R15, AND THE ONE THAT ROTS FIRST.
         *
         * `postSecret` is only the private door if everything goes through it.
         * A `ChatMessage.create` with a `whisper` list posted straight from a
         * feature file puts its sentence in the world database, where every
         * connected client gets it — which is the whole defect this update
         * moved eighty call sites to close. Measured before the sweep: the
         * project-completion card did exactly that, and its narration was on
         * every player's machine.
         *
         * Two doors are allowed: `announce` and the three whisper helpers, all
         * in utils.mjs, all of which route on the presence of a recipient list.
         *
         * `private-rolls.mjs` is exempt and it is worth saying why rather than
         * leaving a hole: it does not create anything. It catches a roll card
         * Daggerheart is already making and turns it private in `preCreate`,
         * where there is no id yet to key a secret on. The dice themselves live
         * in `message.rolls` and are rendered by Foundry, so the number would
         * travel whatever we did with the content. Left alone on purpose.
         */
        const guilty = [];
        for (const [file, raw] of await otherSources()) {
            if (file === "utils.mjs" || file === "secret.mjs") continue;
            const text = stripComments(raw);
            for (const m of text.matchAll(/ChatMessage\.create\(/g)) {
                // The call's own argument list, up to the balanced close.
                let depth = 0, end = m.index;
                for (let i = m.index + "ChatMessage.create(".length - 1; i < text.length; i++) {
                    if (text[i] === "(") depth++;
                    else if (text[i] === ")") { depth--; if (!depth) { end = i; break; } }
                }
                const call = text.slice(m.index, end);
                if (/whisper\s*:/.test(call)) {
                    guilty.push(`${file}:${lineAt(text, m.index)}`);
                }
            }
        }
        ok(!guilty.length,
            `these put private narration in the world database: ${guilty.join(", ")} (use announce)`);
    }],

    ["R18 · using an item mid-incident costs a turn like everything else", async () => {
        /*
         * IT SHIPPED THE OTHER WAY (E9, G-21). Every act inside an incident pays
         * a turn, a roll and a threshold. Using an item was reachable straight
         * from the inventory row, so a victim drank a first aid kit mid-murder
         * for nothing while the killer spent their turn swinging.
         *
         * The same button, because it is the same intention — what changes is
         * what happens after it. So the rule is not "the button is hidden", it
         * is "the handler asks whether an incident is running first", and that
         * is what this reads.
         *
         * Every call to `useItem` outside use-items.mjs itself has to sit behind
         * `inCrisis`. There is exactly one such caller today and it is the one
         * that had the bug.
         */
        const guilty = [];
        for (const [file, raw] of await otherSources()) {
            if (file === "use-items.mjs") continue;
            const text = stripComments(raw);
            for (const m of text.matchAll(/useItem\(/g)) {
                // Is an incident check standing over this call?
                const before = text.slice(Math.max(0, m.index - 700), m.index);
                if (!/inCrisis\s*\(/.test(before)) {
                    guilty.push(`${file}:${lineAt(text, m.index)}`);
                }
            }
        }
        ok(!guilty.length,
            `these use an item without asking whether a murder is happening: ${guilty.join(", ")}`);

        // And the check itself still means what the caller assumes.
        const sheet = stripComments(await fetch(`/modules/${MODULE_ID}/scripts/sheet.mjs`).then(r => r.text()));
        const body = sheet.slice(sheet.indexOf("function inCrisis"), sheet.indexOf("function inCrisis") + 400);
        ok(/stage\s*!==\s*"incident"/.test(body),
            "inCrisis no longer asks whether the incident has actually started");
        ok(/"victim"/.test(body) && /"killer"/.test(body),
            "inCrisis no longer restricts itself to the two people in the fight");
    }],

    ["R19 · the windows a GM works from stay true while they are open", async () => {
        /*
         * E22 SHIPPED THE MECHANISM AND ONE CALLER, and it took E17 to notice.
         *
         * Measured: `keepLive` was called from exactly one file. The case
         * dashboard and the trial console, opened and left open while an Eclipse
         * started and ended underneath them, came back BYTE-IDENTICAL — 2804 and
         * 353 characters, not one of them different. A GM reading either was
         * reading a photograph of the moment they pressed the tile.
         *
         * These four are the ones E17 names, and they are named because they are
         * the windows a GM works FROM rather than answers and closes: the panel
         * while an Eclipse runs, the dashboard while an incident opens, the trial
         * console while the floor moves, Who is alive while somebody dies.
         *
         * Written as a list on purpose. "Which windows must be live" is a
         * judgement about how they are used, and a test whose subject is a
         * judgement should say so out loud rather than guess from a function
         * name — the same reasoning as `STANDING` above it.
         */
        const MUST_BE_LIVE = {
            openGmPanel: "gm-panel",
            openWhoIsAliveDialog: "gm-panel",
            openInvestigationDashboard: "investigation",
            manageClassTrial: "trial-floor-ui"
        };

        const dead = [];
        for (const [opener, file] of Object.entries(MUST_BE_LIVE)) {
            const text = stripComments(
                await fetch(`/modules/${MODULE_ID}/scripts/${file}.mjs`).then(r => r.text()));
            const from = text.indexOf(`function ${opener}(`);
            if (from < 0) { dead.push(`${opener} is not in ${file}.mjs any more`); continue; }

            // Up to the next top-level function, which is where its body ends.
            const rest = text.slice(from + 10);
            const next = rest.search(/^(?:export )?(?:async )?function /m);
            const body = next < 0 ? rest : rest.slice(0, next);
            /*
             * ONE HOP, because the GM panel does it through `keepPanelFresh` —
             * two regions on different clocks, which is worth its own function.
             * A window that reaches the helper through a named local is as live
             * as one that calls it inline; a window that reaches it through
             * three would be hiding.
             */
            const helpers = [...text.matchAll(/function (\w+)\([^)]*\)\s*\{/g)]
                .filter(m => {
                    const rest = text.slice(m.index + m[0].length);
                    const stop = rest.search(/^(?:export )?(?:async )?function /m);
                    return (stop < 0 ? rest : rest.slice(0, stop)).includes("keepLive(");
                })
                .map(m => m[1]);

            const reaches = body.includes("keepLive(")
                || helpers.some(name => body.includes(`${name}(`));
            if (!reaches) dead.push(`${opener} goes stale while it is open`);
        }
        ok(!dead.length, dead.join("; "));

        // And the helper still carries the three things a rebuild would eat.
        const live = stripComments(await fetch(`/modules/${MODULE_ID}/scripts/live.mjs`).then(r => r.text()));
        for (const carried of ["scrolls", "opens", "dirty", "tab"]) {
            ok(live.includes(carried),
                `keepLive no longer carries "${carried}" across a rebuild`);
        }
    }],

    ["R15 · nothing reads a card's words off the document", async () => {
        /*
         * THE HALF OF THE PRIVACY FIX A REVIEWER WOULD NOT THINK TO CHECK.
         *
         * Private narration no longer travels in the chat document: the message
         * carries a stub, and the sentence lives in a client-scoped store on
         * each recipient's own browser (secret.mjs). So `message.content` is now
         * a DASH for every private card, and any code still reading it renders
         * a dash — in the messenger, in a popup, in the GM's call thread.
         *
         * That failure is silent and it is COSMETIC-LOOKING, which is worse: a
         * blank card reads as a rendering hiccup, not as a module reading the
         * wrong field, and it would be lived with for a long time.
         *
         * `contentOf(message)` is the one reader. This keeps it the one reader.
         */
        const guilty = [];
        for (const [file, raw] of await otherSources()) {
            if (file === "secret.mjs") continue;      // the store itself
            const text = stripComments(raw);
            for (const m of text.matchAll(/(message|msg|card|last|entry)\.content/g)) {
                guilty.push(`${file}:${lineAt(text, m.index)} — ${m[0]}`);
            }
        }
        ok(!guilty.length,
            `these show a dash instead of a private card: ${guilty.join(", ")} (use contentOf)`);
    }],

    ["R17 · a trap can be sprung by somebody who is not the GM", async () => {
        /*
         * EIGHT OF THE NINE TRIGGERS NEVER FIRED IN PLAY, and E21 shipped that
         * way with its own scenarios green.
         *
         * Measured in E17 on two accounts: a player walked from Main Hall into
         * Dinner Hall and `drpgRoomCrossed` fired ON THE PLAYER'S CLIENT ONLY.
         * The GM's browser never saw the hook. Every handler in traps.mjs opens
         * with `isPrimaryGm()`, so it returned at once where it was called and
         * was never called where it would have run.
         *
         * WHY THE SUITE MISSED IT, which is the part worth keeping: E21's
         * scenarios raise the hooks with `Hooks.callAll` on the GM's own client,
         * where the gate passes. The tests were right about everything after the
         * gate and blind to the only question that mattered — who raises it.
         * A test that stands in for the player has to be suspicious of running
         * on the GM's machine.
         *
         * Four of the five hooks are raised by the client that DID the thing.
         * Only `createChatMessage` reaches everybody, which is exactly why the
         * item trigger was the one that worked. So every other one needs a relay,
         * and this is what says so.
         */
        const src = await fetch(`/modules/${MODULE_ID}/scripts/traps.mjs`).then(r => r.text());
        const clean = stripComments(src);

        const subscribed = [...clean.matchAll(/Hooks\.on\("(drpg\w+)"/g)].map(m => m[1]);
        ok(subscribed.length >= 4, `traps.mjs subscribes to only ${subscribed.length} module hooks`);

        // Each module hook's registration, up to the next one.
        const marks = [...clean.matchAll(/Hooks\.on\("(drpg\w+|createChatMessage)"/g)];
        const unrelayed = [];
        for (let i = 0; i < marks.length; i++) {
            const name = marks[i][1];
            if (name === "createChatMessage") continue;   // reaches every client already
            const to = i + 1 < marks.length ? marks[i + 1].index : clean.length;
            if (!clean.slice(marks[i].index, to).includes("relay(")) unrelayed.push(name);
        }
        ok(!unrelayed.length,
            `these only ever fire on the acting client, which is never the GM's: ${unrelayed.join(", ")}`);

        // And the GM side answers to every kind the relay can send.
        const sent = new Set([...clean.matchAll(/relay\("(\w+)"/g)].map(m => m[1]));
        const handled = new Set([...clean.matchAll(/case "(\w+)":/g)].map(m => m[1]));
        const deaf = [...sent].filter(kind => !handled.has(kind));
        ok(!deaf.length, `the GM side ignores these relayed events: ${deaf.join(", ")}`);
        const orphan = [...handled].filter(kind => !sent.has(kind));
        ok(!orphan.length, `the GM side answers to events nothing sends: ${orphan.join(", ")}`);
    }],

    ["R14 · every setting listener waits on the hook its setting actually fires", async () => {
        /*
         * FOUNDRY HAS TWO HOOKS HERE AND THEY DO NOT OVERLAP, and this module
         * has now got it wrong twice.
         *
         *   `updateSetting`        — a DOCUMENT hook. World settings only.
         *   `clientSettingChanged` — client settings, and its argument is the
         *                            full "namespace.key" id, not a document.
         *
         * A client-scoped setting is written straight to localStorage and never
         * becomes a Setting document, so `updateSetting` does not fire for it —
         * ever, on any client, including the one that made the write. Measured:
         * two writes to a world setting fired it twice; two writes to a client
         * setting fired it zero times.
         *
         * WHAT THAT COST. `sheet.mjs` dropped its Tamper cache on
         * `remnantSecrets` — client-scoped — so from E12 until here the sheet
         * kept answering "what did I leave in this room" from a cache that a
         * trace being erased, planted or swept could not touch. It looked
         * exactly like a working listener. dice-sync.mjs had found the same trap
         * a fortnight earlier and written it down in a comment, which is the
         * clearest possible argument for putting it in the suite instead.
         *
         * Only listeners that NAME a setting are asked. A listener filtering on
         * the module prefix is a redraw-on-anything, and it is right about every
         * world setting it sees.
         */
        const wrong = [];
        for (const [file, raw] of await otherSources()) {
            const text = stripComments(raw);
            for (const m of text.matchAll(
                /Hooks\.on\("(updateSetting|clientSettingChanged)"[\s\S]{0,400}?SETTINGS\.(\w+)/g)) {
                const [, hook, name] = m;
                const full = `${MODULE_ID}.${SETTINGS[name]}`;
                const scope = game.settings.settings.get(full)?.scope;
                if (!scope) continue;                    // R4 owns that failure
                const wants = scope === "world" ? "updateSetting" : "clientSettingChanged";
                if (hook !== wants) {
                    wrong.push(`${file}:${lineAt(text, m.index)} — ${name} is ${scope}-scoped, `
                        + `so ${hook} never fires for it (use ${wants})`);
                }
            }
        }
        ok(!wrong.length, `these listeners can never run: ${wrong.join("; ")}`);
    }],
    ["R21 \u00b7 no control is decided by a function nobody called", async () => {
        /*
         * A FUNCTION OBJECT IS ALWAYS TRUE, and it never says so.
         *
         * The GM panel's roster became a function when the "who is alive" table
         * learned to rebuild itself while open (E22). The heading was updated to
         * call it; one line in the row builder was not, and `!anyCub` — a
         * function reference — is `false` forever. So for four releases every
         * row carried the three Monocub cells whether or not a Monocub existed,
         * under a heading that correctly showed three columns. Three headings
         * over six cells, in the window a GM works from most.
         *
         * Nothing catches this: it parses, it runs, it throws nothing, and the
         * branch it silently picks is the one that LOOKS busier rather than the
         * one that looks broken. It is also a mistake this module is now shaped
         * to keep making — every window that learns to stay live turns a
         * handful of locals into functions on the way.
         *
         * OUT OF SCOPE, deliberately: a name that is also a value somewhere in
         * the same file. The first run reported six and five were that — a
         * parameter called `grants`, a `let done = false`, a `const label`. A
         * test with five false accusations in six is one nobody reads.
         */
        const proof = [];
        {
            const fixture = "const ready = () => true;\nif (!ready) return;\n";
            const fns = functionsOnly(fixture);
            for (const name of fns) if (truthyReads(fixture, name).length) proof.push(name);
            ok(proof.length === 1, "this test cannot see its own example fault");
        }

        const wrong = [];
        for (const [file, raw] of await otherSources()) {
            const text = stripStrings(stripComments(raw));
            for (const name of functionsOnly(text)) {
                for (const at of truthyReads(text, name)) {
                    wrong.push(`${file}:${lineAt(text, at)} — \`${name}\` is a function here, `
                        + "so this test is always true (call it)");
                }
            }
        }
        ok(!wrong.length, wrong.join("; "));
    }],

    ["R22 \u00b7 every name this module calls is a name it has", async () => {
        /*
         * `bend is not defined`, and it lied about the files for four months.
         *
         * The call outlived the function: a playback rate moved onto its own
         * `Sound` and `bend(sound, rate)` stayed behind in the branch every
         * non-varying event takes. The throw landed in a `.then` AFTER the
         * sound had started, so the `.catch` below reported perfectly good
         * files as unplayable while the table was hearing them.
         *
         * The same shape then turned up in `action-rolls.mjs`, where a `catch`
         * called `debug(\u2026)` that the file never imported — an error handler
         * that throws a second error is the worst possible place for this.
         *
         * CALL POSITION ONLY. A bare identifier can be a property, a label, a
         * type in a comment; `name(` is unambiguous, and it is where both of
         * these lived.
         */
        {
            const fixture = "import { log } from './x.mjs';\nfunction go() { log(1); bend(2); }\n";
            const bound = boundNames(fixture);
            const missed = [...fixture.matchAll(CALLED)].map(m => m[1])
                .filter(n => !bound.has(n) && !AMBIENT.has(n) && !JS_KEYWORDS.has(n));
            ok(missed.length === 1 && missed[0] === "bend",
                `this test cannot see its own example fault (saw ${missed.join(",") || "nothing"})`);
        }

        const wrong = [];
        for (const [file, raw] of await otherSources()) {
            const text = stripStrings(stripComments(raw));
            const bound = boundNames(text);
            const said = new Set();
            for (const m of text.matchAll(CALLED)) {
                const who = m[1];
                if (said.has(who) || bound.has(who) || AMBIENT.has(who)) continue;
                if (JS_KEYWORDS.has(who) || /^[A-Z]/.test(who)) continue;
                said.add(who);
                wrong.push(`${file}:${lineAt(text, m.index)} — ${who}() is declared nowhere `
                    + "in this file and imported into it by nothing");
            }
        }
        ok(!wrong.length, wrong.join("; "));
    }],

    ["R23 \u00b7 a document hook that checks for a GM checks for THE GM", async () => {
        /*
         * A DOCUMENT HOOK FIRES ON EVERY CLIENT, so "am I a GM" is never the
         * right question in one — with two Gamemasters at this table it is
         * answered yes twice.
         *
         * The bidirectional Truth Bullet sync (v1.1.55) asked it that way. One
         * GM renaming a bullet had BOTH GM clients write the patch to the
         * trace, each then pushing it back down onto every copy, each syncing
         * the ledger to the other. One rename, two cascades, and the second one
         * arrives while the first is still writing.
         *
         * `isPrimaryGm` is how the rest of the module answers it — the trap
         * relay, the search tokens, the migrations, `prepareScenes`. It picks
         * ONE connected GM, and both ends compute it from the same user list so
         * they cannot disagree.
         *
         * A handler that needs no GM at all is not asked: what this catches is
         * one that decided GM-ness matters and then chose the weaker of the two
         * rules.
         */
        const wrong = [];
        for (const [file, raw] of await otherSources()) {
            const text = stripComments(raw);
            for (const m of text.matchAll(/Hooks\.on\(\s*"((?:create|update|delete)[A-Z]\w*)"/g)) {
                let depth = 0;
                let j = text.indexOf("(", m.index);
                const from = j;
                for (; j < text.length; j++) {
                    if (text[j] === "(") depth++;
                    else if (text[j] === ")" && --depth === 0) break;
                }
                const body = text.slice(from, j);
                if (!/user\.isGM/.test(body) || /isPrimaryGm/.test(body)) continue;
                wrong.push(`${file}:${lineAt(text, m.index)} — ${m[1]} fires on every client, `
                    + "so every GM runs this (use isPrimaryGm)");
            }
        }
        ok(!wrong.length, wrong.join("; "));
    }]
];

/* ==========================================================================
 * TIER 1 — INVARIANTS
 * ========================================================================== */

/**
 * The windows a person leaves open while the world moves under them.
 *
 * NOT every window this module has. A confirmation, a briefing, a pick-one
 * prompt — those are a question with an answer, and they are gone before
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
    "openEavesdropDialog", "openObjectionLog"
];

const INVARIANTS = [
    ["every action definition has a label and a cost", () => {
        for (const [key, def] of Object.entries(ACTIONS)) {
            // A `deferred` row is a PLACE in the grid, not a definition: its
            // three strings are localised and config.mjs is evaluated before
            // `game.i18n` exists. The sheet fills it at render time — the row
            // below is what checks that it still does.
            if (def.deferred) continue;
            ok(def.label, `${key} has no label`);
            ok(typeof def.cost === "number", `${key} has no numeric cost`);
        }
    }],

    ["the action grid is two rows of five, and nothing fell off it", () => {
        /*
         * THE TABLE IS THE LAYOUT (E12), so the table is what this asks.
         *
         * The sheet draws every `universal` entry in the order they appear in
         * ACTIONS. Eleven is a row of five and a row of five with one hanging
         * underneath, which is the layout this order was rewritten to avoid;
         * nine leaves a hole. Both are invisible in a diff of config.mjs and
         * obvious on a sheet, which is exactly the kind of thing a test is for.
         *
         * And the two entries that stopped being tiles must still be ENTRIES.
         * `reroll.mjs` dispatches on `case "sabotage"`, `briefingBlock` reads
         * its description, and `injectMonocubPanel` draws `ACTIONS.move` — so
         * deleting either one breaks something a long way from here, silently.
         */
        const kinds = Object.entries(ACTIONS).map(([key, def]) => [key, def.kind]);
        const universal = kinds.filter(([, kind]) => kind === "universal");
        ok(universal.length === 10,
            `the grid has ${universal.length} tiles, not ten: ${
                universal.map(([k]) => k).join(", ")}`);

        for (const key of ["move", "sabotage"]) {
            ok(ACTIONS[key], `${key} has been deleted; something still reads it`);
        }
        ok(ACTIONS.move.kind === "panel", "move is back on the grid");
        ok(ACTIONS.sabotage.kind === "variant", "sabotage is back on the grid");

        // A kind nothing draws is a tile that vanished without anybody meaning
        // it to. Every entry has to be one of the three the sheet knows.
        for (const [key, kind] of kinds) {
            ok(["universal", "panel", "variant"].includes(kind),
                `${key} has unknown kind "${kind}" — nothing will draw it`);
        }
    }],

    ["Palm cannot reach the two things it must not", () => {
        /*
         * The pool is "everything carried except Truth Bullets", built twice on
         * purpose — once to fill the picker on the thief's client and once as
         * the authority in `stealFromPerson`. Two copies of one rule is the
         * right shape here (an authority that imports its answer from the thing
         * it is checking is not one), and it is also exactly the shape that
         * drifts, so this pins the half of it that is a rule rather than code:
         * the category must exist to be excluded.
         */
        ok(ITEM_CATEGORIES.truthBullet,
            "truthBullet is not a category any more — Palm's exclusion excludes nothing");
        ok(typeof ACTIONS.palm.threshold === "number",
            "Palm has no threshold to beat");
        ok(typeof ACTIONS.palm.unseen?.threshold === "number",
            "Palm has no second axis — being seen would never be decided");
        ok(ACTIONS.palm.unseen.trait !== ACTIONS.palm.traits[0],
            "Palm's two rolls are the same statistic, which makes them one roll");
    }],

    ["every sound names a category and a real key to yield to", () => {
        /*
         * The Sound panel draws its table by walking SFX_EVENTS and filing each
         * row under its category, so an event naming a category that is not in
         * SFX_CATEGORIES is a row that never appears — a sound a GM cannot map
         * and therefore cannot hear, failing completely silently.
         *
         * `yieldsTo` fails even more quietly: `cancelHoldersOf` matches winners
         * by string, so a typo there does not error, it just means the sound
         * waits its 120ms and then plays anyway, on top of the thing it was
         * supposed to defer to. Nobody would ever debug that back to a spelling.
         */
        for (const [key, def] of Object.entries(SFX_EVENTS)) {
            ok(def.label, `${key} has no label`);
            ok(def.hint, `${key} has no hint — the panel shows it as bare`);
            ok(SFX_CATEGORIES[def.category],
                `${key} is filed under unknown category "${def.category}"`);
            for (const winner of def.yieldsTo ?? []) {
                ok(SFX_EVENTS[winner], `${key} yields to unknown sound "${winner}"`);
            }
        }
    }],

    ["no stashed thing points at a stash that is not there", () => {
        /*
         * THE ORPHAN. Before E11 an item in a stash could not be lost: there was
         * one stash per person and "in the stash" named it completely. Now the
         * item carries a room, and a room whose stash has been taken away leaves
         * that item on NO list — not carried, not in any drawer, invisible on the
         * sheet and findable only by a GM reading flags.
         *
         * Room Setup refuses to remove a stash with anything in it, which is the
         * guard. This is the check that the guard held: it reads the world rather
         * than the code, so it also catches a stash removed by a macro, by a
         * region deleted off the map, or by a hand-edited flag.
         */
        for (const actor of game.actors.filter(a => a.type === "character")) {
            for (const item of vaultContents(actor)) {
                const room = stashRoomOfItem(item, actor);
                ok(room, `"${item.name}" on ${actor.name} is stashed nowhere`);
                ok(stashIn(room, actor.id),
                    `"${item.name}" on ${actor.name} names the stash in "${room}", which does not exist`);
            }
        }
    }],

    ["every stash belongs to somebody who exists", () => {
        // An actor deleted mid-season leaves their stash entries behind, and a
        // list of ghosts is what makes the Stashes tab draw a column for nobody
        // and `openStashesHere` offer a drawer that cannot be opened.
        for (const entry of allVaults()) {
            ok(entry.owner, `a stash in "${entry.room}" belongs to no actor that exists`);
        }
    }],

    ["every crisis action names a side the engine knows", () => {
        // `both` since E9, and it is a real side rather than a wildcard: the
        // grid filter, `takeCrisisAction`'s guard and the resolver each had to
        // learn it, and the resolver now reads the side off the PERSON rather
        // than off the entry. This test is what said so — it failed the moment
        // "use an item" arrived, which is exactly its job.
        const sides = new Set(["killer", "victim", "third", "both"]);
        for (const [key, def] of Object.entries(CRISIS_ACTIONS)) {
            ok(sides.has(def.side), `${key} has side "${def.side}"`);
            ok(def.label, `${key} has no label`);
            // A rolled action needs something to roll and something to beat.
            if (!def.noRoll && key !== "finishingBlow") {
                ok(def.traits?.length, `${key} rolls but names no trait`);
                ok(typeof def.threshold === "number", `${key} rolls but has no threshold`);
            }
        }
    }],

    ["every Call has a price and something to do for it", () => {
        /*
         * `applyCall` reports `failed` when its receipt is empty, and a failed
         * Call hands the price back — which is right, and which means a Call
         * whose effect field nobody wrote a branch for is a Call that takes the
         * Hope, refunds it and tells the player it "did not work". Silent in the
         * log, invisible in review, and exactly what trap 100 describes.
         *
         * So this asks the table the same question `applyCall` asks: is there
         * ANY field here that some branch acts on? The list is the branches, in
         * their order — adding an effect to config.mjs without adding its branch
         * fails here rather than at somebody's table.
         */
        const ACTED_ON = ["grants", "grantsHope", "damage", "progress", "wipesProgress",
                          "reroll", "announces", "sealsRoom", "silences", "chains",
                          "gathersEveryone", "freeMoves", "freeActions", "freeRest",
                          "setsMotive"];
        const check = (source, label) => {
            for (const [key, call] of Object.entries(source)) {
                ok(typeof call.cost === "number", `${label} ${key} has no numeric cost`);
                ok(call.effect, `${label} ${key} has no effect line for the panel`);
                const acts = ACTED_ON.some(field => call[field])
                    // The two that do their work through the picker rather than
                    // through a field of their own.
                    || call.target === "item";
                ok(acts, `${label} ${key} has no effect any branch of applyCall acts on`);
            }
        };
        check(HOPE_CALLS, "Hope Call");
        check(DESPAIR_CALLS, "Despair Call");
    }],

    ["the two project Calls did not keep each other's effects", () => {
        /*
         * They exchanged whole entries on 28.08 — price, effect and sentence —
         * and a swap done by halves is the worst possible outcome: a key still
         * bolted to the other one's effect is wrong in a way that reads as
         * right. So this states the shape of each in the terms the panel uses.
         *
         * The relative price is checked rather than the absolute one, because
         * that is the part that carries meaning: emptying a project has to cost
         * more than knocking two off it, whatever the numbers become at E18.
         */
        const wipe = DESPAIR_CALLS.gameIntegrity;
        const dent = DESPAIR_CALLS.gameProtection;

        ok(wipe?.wipesProgress, "Game Integrity no longer empties a project");
        ok(!wipe?.progress, "Game Integrity carries a progress number as well as the wipe");
        equal(dent?.progress, -2, "Under Control is not −2 progress");
        ok(!dent?.wipesProgress, "Under Control still empties the project");
        ok(wipe.cost > dent.cost,
            `emptying a project (${wipe.cost}) does not cost more than denting it (${dent.cost})`);
    }],

    ["a deferred Call is one the sheet can cancel", () => {
        // `defers` is read in two places that never see each other: `applyCall`
        // writes a standing order instead of acting, and `callButton` turns the
        // tile into its own cancel button. A Call that defers without something
        // to defer would be a tile that cancels an order nothing ever wrote.
        for (const [key, call] of Object.entries(DESPAIR_CALLS)) {
            if (!call.defers) continue;
            ok(call.gathersEveryone,
                `${key} defers but has no deferred effect for the clock to run`);
            ok(call.target === "room", `${key} defers but points at "${call.target}"`);
        }
        ok(DESPAIR_CALLS.publicAnnouncement?.defers,
            "Public Announcement is teleporting on purchase again");
    }],

    ["every Call tile has a drawn glyph", async () => {
        /*
         * A KEY WITH NO GLYPH FAILS SILENTLY, AND THAT IS THE WHOLE POINT.
         *
         * The mask rules are keyed per Call, deliberately, so a Call without
         * one keeps its Font Awesome icon rather than rendering blank — which
         * means the failure mode is a 35x32 icon sitting in a row of 24px pixel
         * art. Nothing throws, nothing warns, and the only reason either of the
         * two that happened was ever caught was Dawid looking at the panel.
         *
         * READ OUT OF THE FILE, NOT OUT OF THE CSSOM. The first version of this
         * walked `document.styleSheets` and found nothing at all: Foundry pulls
         * the module's stylesheet in with `@import url(…) layer(modules)`, so
         * what is in that list is a CSSImportRule whose `.styleSheet` holds the
         * rules. The test reported "the stylesheet is not on this page" while
         * the page was plainly wearing it.
         *
         * Fetching is also the stricter question, and the same one the version
         * test asks: what will SHIP, rather than what this browser parsed.
         */
        let css = "";
        try {
            const res = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css?t=${Date.now()}`);
            if (res.ok) css = await res.text();
        } catch {
            // Reported by the length check below rather than swallowed.
        }
        ok(css.length > 1000, "could not read danganronpa.css to check the glyphs");

        const drawn = new Set();
        // One rule per key, and it has to carry a mask: a selector alone would
        // pass on a block that only cancels the ::before.
        for (const block of css.matchAll(/\.drpg-call-button\[data-drpg-call="([^"]+)"\][^{]*\{([^}]*)\}/g)) {
            if (/mask-image/.test(block[2])) drawn.add(block[1]);
        }

        const missing = [...Object.keys(HOPE_CALLS), ...Object.keys(DESPAIR_CALLS)]
            .filter(key => !drawn.has(key));
        ok(!missing.length,
            `these Calls fall back to Font Awesome at the wrong size: ${missing.join(", ")}`);
    }],

    ["Analyze has its own numbers, and they are the guide's", () => {
        /*
         * G-08. This table was DERIVED from `OBSERVE_DC` for most of the
         * module's life, on a line in the Player Handbook; the Full Guide
         * prints its own and the two disagree. A derivation is one line to
         * write and would be an easy thing to "tidy" back in, so the shape that
         * makes it a different table is stated here.
         *
         * Two rows carry the whole of it: a faint trace is HARDER to spot than
         * to read, and a prepared one is EASIER. Flattening them was what the
         * old derivation did.
         */
        equal(ANALYZE_DC.hidden.faint, 18, "Analyze/faint/hidden is not the guide's 18");
        equal(ANALYZE_DC.obvious.prep, 12, "Analyze/prep/obvious is not the guide's 12");
        ok(ANALYZE_DC.hidden.faint < OBSERVE_DC.hidden.faint,
            "a faint trace is no longer easier to read than to find");
        ok(ANALYZE_DC.obvious.prep > OBSERVE_DC.obvious.prep,
            "a prepared trace is no longer harder to read than to find");

        for (const [band, row] of Object.entries(ANALYZE_DC)) {
            equal(row.key, null, `Analyze/${band} asks for a roll on a Key Truth Bullet`);
            // Incident and Resolution are priced like Prep — the same decision
            // the observation table already made, for the same reason.
            equal(row.incident, row.prep, `Analyze/${band}: incident is not priced like prep`);
            equal(row.resolution, row.prep, `Analyze/${band}: resolution is not priced like prep`);
        }
    }],

    ["a critical pays the guide's price, and something is enforcing it", () => {
        // G-16. Daggerheart's own rule is +1 Hope and one Stress cleared; the
        // guide's is +2 Hope and nothing about Stress. The numbers are half the
        // test — the other half is that the wrapper is actually on, because a
        // config entry nobody applies is exactly the class of defect this
        // stage's regression tier exists for.
        equal(CRITICAL.hope, 2, "a critical is not paying the guide's 2 Hope");
        equal(CRITICAL.clearsStress, false, "a critical is still clearing Sanity as well");

        const DualityRoll = game.system?.api?.dice?.DualityRoll;
        ok(DualityRoll, "Daggerheart's DualityRoll is not where this module looks for it");
        ok(DualityRoll.addDualityResourceUpdates?.[Symbol.for("drpgCriticalRule")],
            "the critical rule is not installed — criticals are paying Daggerheart's numbers");
    }],

    ["the three criticals that buy another act say so, and can be spent", () => {
        // G-17 and G-18, and they are NOT the same thing: one buys another go
        // at the dice, the other buys certainty about one roll.
        for (const key of ["leaveClue", "secureTrace", "useItem"]) {
            ok(CRISIS_ACTIONS[key]?.criticalKeepsTurn,
                `${key}'s critical ends the turn — G-17's second action is unreachable`);
        }

        for (const [key, def] of Object.entries(CRISIS_ACTIONS)) {
            if (!def.criticalFreeResolution) continue;
            // The grant is only worth something if the same critical opened a
            // door to spend it on, and only reachable if the turn is still
            // this player's when they go to spend it.
            const opened = def.unlocks?.critical ?? [];
            ok(opened.length, `${key} hands over a free resolution action and unlocks none`);
            ok(opened.every(id => CRISIS_ACTIONS[id]?.kind === "resolution"),
                `${key} unlocks something that is not a resolution action`);
            ok(def.criticalKeepsTurn,
                `${key} grants a free action "this turn" and then ends the turn`);
        }
    }],

    ["a critical clean-up cannot rewrite the case out from under the GM", () => {
        // G-20, trap 115. The permission is bounded, and these four are the
        // bound: two the GM placed for the case to be solvable, one that is
        // issued rather than found, and one that is not a kind of trace at all.
        ok(CLEANUP.outcome.critical?.mayTransform, "a critical clean-up can no longer rewrite a trace");
        const types = CLEANUP.transform?.types ?? [];
        ok(types.length, "the transform has no list of types, so nothing bounds it");
        for (const forbidden of ["key", "final", "autopsy", "neutral"]) {
            ok(!types.includes(forbidden),
                `a critical clean-up can turn a trace into "${forbidden}"`);
        }
        // And it stays out of the Misleading trail's business.
        ok(!("pointsAt" in (CLEANUP.transform ?? {})),
            "the transform can re-point a trace — that is the Misleading trail's action to sell");
    }],

    ["an investigation nobody finished has a price", () => {
        // G-32. Both numbers, because the bar and the rate are separate
        // decisions and the guide gives both.
        equal(KEY_REMNANTS.unfoundBar, 4, "the bar for unfound Key Remnants is not four");
        equal(KEY_REMNANTS.unfoundDespair, 3, "an unfound Key Remnant is not worth 3 Despair");
    }],

    ["a trap alert is never addressed to a player", async () => {
        /*
         * TRAP 156, and the first build of this stage broke it exactly as the
         * plan predicted it would.
         *
         * `callGm` files a card in the messenger thread of the actor it names.
         * That is right for every other caller — a player asked for a ruling and
         * is waiting on it. A trap alert names the KILLER, so the ordinary path
         * posted into the killer's own thread a card saying their trap had been
         * tripped AND who tripped it, before the GM had ruled on anything.
         * Measured: "Player B, in Big IT Room", delivered to Player A.
         *
         * Read from the source rather than driven, because the failure is about
         * an ARGUMENT rather than an outcome — a scenario would have to arrange a
         * player client to catch it, and the thing that must never be forgotten
         * is one word at one call site.
         */
        const src = await fetch(`/modules/${MODULE_ID}/scripts/traps.mjs`).then(r => r.text());
        const call = src.slice(src.indexOf("callGm(trap.killer"), src.indexOf("callGm(trap.killer") + 400);
        ok(call.length > 20, "traps.mjs no longer calls callGm the way this test expects");
        ok(/gmOnly:\s*true/.test(call),
            "the trap alert does not pass gmOnly — it will be posted into the killer's own thread");
    }],

    ["no localise-or-fallback that can never reach its fallback", async () => {
        /*
         * `game.i18n.localize(key)` RETURNS THE KEY when it misses, and the key
         * is truthy — so `localize(k) || fallback` never reaches the fallback and
         * a missing string is printed at the table as "DRPG.Trap.trigger.alone".
         * Measured on E21's first alert card.
         *
         * Cheap to write down and it covers the whole module, not this stage.
         */
        const guilty = [];
        for (const file of ["traps", "projects", "gm-panel", "sheet", "murder"]) {
            const src = await fetch(`/modules/${MODULE_ID}/scripts/${file}.mjs`).then(r => r.text());
            for (const m of src.matchAll(/game\.i18n\.localize\([^)]*\)\s*\|\|/g)) {
                guilty.push(`${file}.mjs :: ${m[0].slice(0, 60)}`);
            }
        }
        ok(!guilty.length,
            `these fall back on a localize() that never returns falsy: ${guilty.join(" | ")}`);
    }],

    ["advantage never adds up to more than three dice", async () => {
        /*
         * FROM E17'S OWN CLOSING LIST, and it had no test.
         *
         * Advantage stacks: a Call, the room, and a standing penalty for having
         * lost all Sanity all land on the same roll and are summed. Daggerheart
         * rolls `kh`, and a formula asking to keep the highest of six is not a
         * roll any more — it is a guarantee wearing dice.
         *
         * Read rather than driven: `advantageSources` is private to the roll
         * dialog, and exporting a function so a test can reach it would be the
         * test changing the module's shape to suit itself. What must never
         * silently go missing is the clamp, and the clamp is one line.
         */
        const src = await fetch(`/modules/${MODULE_ID}/scripts/roll-dialog.mjs`).then(r => r.text());
        const cap = src.match(/const ADVANTAGE_CAP\s*=\s*(\d+)/);
        ok(cap, "roll-dialog.mjs no longer declares ADVANTAGE_CAP");
        equal(Number(cap[1]), 3, "the advantage cap is not three dice");
        ok(/count:\s*Math\.min\(ADVANTAGE_CAP,/.test(src),
            "the die count is no longer clamped to ADVANTAGE_CAP");
        ok(/capped:\s*size\s*>\s*ADVANTAGE_CAP/.test(src),
            "nothing tells the player their advantage was capped");
    }],

    ["every stash a character owns agrees with the room it is in", async () => {
        /*
         * FROM E17'S CLOSING LIST, where it is written as "`vaultRoomsFor()` and
         * `openStashHere()` agree about the same room". `openStashHere` is still
         * here; `vaultRoomsFor` is not — the room lookups are `stashRoomsFor`
         * and `vaultRoomFor` now, and the bullet has been naming a ghost since
         * E0. The question it was asking is still the right one, so it is asked
         * of the functions that are here.
         *
         * Two roads to "whose stash is in this room", and they are built from
         * opposite ends: `stashRoomsFor` walks the regions asking each one who
         * owns a stash on it; `myStashHere` asks one room about one character.
         * A disagreement is a stash a player can see and not open, or open and
         * not see.
         */
        /*
         * TWO WRONG VERSIONS BEFORE THIS ONE, both caught by running it, and
         * both worth leaving written down because they are the two ways a test
         * lies.
         *
         * The first passed `myStashHere(actor, room)` two arguments and did not
         * await it. It takes one and it is async, so the test compared a Promise
         * — always truthy — and agreed with everything.
         *
         * The second awaited it and failed honestly on a true statement:
         * `myStashHere` does not mean "where is this character's stash", it
         * means "the stash of mine I am STANDING IN". Player A owns Dinner Hall
         * and Closet and was in Main Hall, so `null` was the right answer.
         *
         * What the closing list was actually asking is whether the two roads to
         * "whose stash is in this room" agree, and they are built from opposite
         * ends: `stashRoomsFor` walks the regions asking each who owns one;
         * `stashIn` asks one room about one character; `stashesIn` is the room's
         * own list. All local, all synchronous, and a disagreement between them
         * is a stash a player can see and not open, or open and not see.
         */
        const { stashRoomsFor, stashIn, stashesIn } = await import("./vault.mjs");
        const wrong = [];
        for (const actor of studentActors()) {
            const owned = stashRoomsFor(actor).map(entry => entry.room);
            for (const room of owned) {
                if (!stashIn(room, actor.id)) {
                    wrong.push(`${actor.name} owns a stash in ${room} that the room denies`);
                }
                if (!stashesIn(room).some(entry => entry.actorId === actor.id)) {
                    wrong.push(`${actor.name}'s stash in ${room} is not in that room's list`);
                }
            }
            // And the other direction: a room that names them, which their own
            // list left out.
            for (const room of (await import("./movement.mjs")).allRooms()) {
                if (owned.includes(room)) continue;
                if (stashesIn(room).some(entry => entry.actorId === actor.id)) {
                    wrong.push(`${room} says ${actor.name} has a stash there and their own list does not`);
                }
            }
        }
        ok(!wrong.length, wrong.join("; "));
    }],

    ["no two rooms on the scene stand on the same floor", async () => {
        /*
         * FROM E17'S CLOSING LIST, and it was the last one missing because it
         * would have failed: the QA map had FIVE overlapping pairs and 24 grid
         * squares belonging to two rooms at once. Dawid's call, 28.08 — write it
         * and fix the map, rather than leave the validator as a thing somebody
         * has to remember to run.
         *
         * WHY IT MATTERS EVEN THOUGH NOTHING VISIBLY BREAKS. Measured on the
         * broken map: the module answers with ONE room on a shared square, the
         * same one every time and the same on every client, because `roomOfToken`
         * sorts the names and takes the first. So there is no flicker, no
         * disagreement between two players, nothing to notice — and a character
         * standing in what looks like the Round Table is in the Dinner Hall for
         * every purpose the rules care about: which search tokens they spend,
         * which room their traces land in, who counts as alone with them.
         * Alphabetical order decides a murder alibi.
         *
         * And the second failure the same geometry causes is worse: where two
         * borders cross with no wall between them, `checkRegions` reports the
         * whole shared border reads as one doorway — a room you can walk out of
         * anywhere along one side.
         *
         * TWO QUESTIONS, because delegating entirely to `checkRegions()` would
         * make this test only as good as that function: the module's own
         * validator must find no errors, AND no grid square may answer to two
         * rooms. The second is asked only inside overlapping bounding boxes, so
         * it costs nothing on a map that is already right.
         */
        const { allRooms } = await import("./movement.mjs");
        const scene = canvas?.scene;
        ok(scene, "no scene to check");

        const report = await game.drpg.checkRegions();
        const errors = (report ?? []).filter(row => row.level === "error");
        ok(!errors.length, `the map has ${errors.length} region error(s): ${
            errors.map(e => `${e.room} ${e.problem}`).join("; ")}`);

        const rooms = allRooms();
        const named = [...scene.regions].filter(r => rooms.includes(r.name));
        const box = region => {
            const xs = [], ys = [];
            for (const shape of region.shapes) {
                const pts = shape.type === "polygon"
                    ? shape.points
                    : [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height];
                for (let i = 0; i < pts.length; i += 2) { xs.push(pts[i]); ys.push(pts[i + 1]); }
            }
            return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
        };
        const at = (region, x, y) => {
            try { return region.object?.testPoint?.({ x, y, elevation: 0 }) ?? false; }
            catch { return false; }
        };

        const g = scene.grid.size;
        const boxes = named.map(r => [r, box(r)]);
        const shared = [];
        for (let i = 0; i < boxes.length && shared.length < 6; i++) {
            for (let j = i + 1; j < boxes.length && shared.length < 6; j++) {
                const [a, ba] = boxes[i], [b, bb] = boxes[j];
                const x0 = Math.max(ba.minX, bb.minX), x1 = Math.min(ba.maxX, bb.maxX);
                const y0 = Math.max(ba.minY, bb.minY), y1 = Math.min(ba.maxY, bb.maxY);
                if (x1 <= x0 || y1 <= y0) continue;          // boxes miss: nothing to ask
                for (let x = x0 + g / 2; x < x1 && shared.length < 6; x += g) {
                    for (let y = y0 + g / 2; y < y1 && shared.length < 6; y += g) {
                        if (at(a, x, y) && at(b, x, y)) {
                            shared.push(`${a.name} / ${b.name} at ${Math.round(x)},${Math.round(y)}`);
                        }
                    }
                }
            }
        }
        ok(!shared.length,
            `these squares belong to two rooms, and alphabetical order decides which: ${shared.join("; ")}`);
    }],

    ["no module rule decides whether a sheet tab is shown", async () => {
        /*
         * `.drpg-redacted-pane { display: flex }` centred a placeholder inside
         * a pane and, by saying `display` at all, took over whether the pane was
         * SHOWN. Foundry hides an inactive tab with `display: none` on `.tab`;
         * a module rule in a later layer beats that, so a redacted sheet came
         * out with all five panes visible — five question marks, five copies of
         * the same sentence. Dawid found it at the table on 28.08.
         *
         * The class of defect is what this guards: a rule written to style what
         * is INSIDE a tab must not be able to decide whether the tab is on
         * screen. So any module selector that targets a tab pane and sets
         * `display` has to qualify itself with `.active` — otherwise it is
         * making that decision for every pane at once.
         *
         * Read from the file rather than the DOM. This only shows on a
         * player's client looking at somebody else's sheet, which is not where
         * this suite runs; the stylesheet is the same everywhere.
         */
        const raw = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        // COMMENTS OUT FIRST, and the first run of this test is why. The note
        // above the fixed rule QUOTES the broken one — "`.drpg-redacted-pane
        // { display: flex }` was written to…" — and a scanner reading prose as
        // CSS found the quotation and reported the very rule it exists to
        // explain. A source-reading test has to read source.
        const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

        const PANE = /(^|[\s>+~])(\.drpg-redacted-pane|section\.tab|\.tab)(\[[^\]]*\])?$/;
        const guilty = [];

        for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
            const [, selectors, body] = match;
            if (!/(^|[\s;])display\s*:/.test(body)) continue;

            for (const selector of selectors.split(",")) {
                const one = selector.trim().replace(/\s+/g, " ");
                // THE LAST COMPOUND IS THE SUBJECT. A rule hiding a control
                // INSIDE a pane is fine and there are several; what must not
                // exist is a rule whose `display` lands on the pane itself.
                if (!PANE.test(one)) continue;
                if (/\.active|:not\(/.test(one)) continue;
                guilty.push(one.slice(0, 70));
            }
        }

        ok(!guilty.length,
            `these rules decide whether a tab pane is shown: ${guilty.join(" | ")}`);
    }],

    ["every standing window is single-instance or says why not", async () => {
        /*
         * Dawid, 28.08: opening the Sound window twice should not give you two
         * Sound windows. It did — every window in the module did, because
         * `DialogV2.wait` builds a fresh application on every call and nothing
         * asked whether one was already up.
         *
         * The fix is a guard per opener, which means a LIST, which means the
         * list can go stale the first time somebody adds a window. So this
         * reads the sources: every standing window must either call
         * `alreadyOpen` or appear in the exemption below with a reason. A new
         * window that does neither fails here rather than shipping as the
         * fourth copy of a Sound panel.
         */
        const EXEMPT = new Map([
            // The one window whose design is to reopen itself — after every
            // crisis action, which is what makes it usable during an incident.
            // A guard that fired while the previous copy was still closing
            // would leave an incident with no tracker at all.
            ["openIncidentTracker", "reopens itself after every action"]
        ]);

        const files = [
            "music", "investigation", "trial-floor-ui", "projects-ui", "vault",
            "tables", "season-setup", "mastermind", "rules", "monocub",
            "gm-team-dialog", "gm-items", "gm-panel", "murder", "voice", "trial"
        ];

        const missing = [];
        for (const file of files) {
            const text = await fetch(`/modules/${MODULE_ID}/scripts/${file}.mjs`).then(r => r.text());
            // Every exported opener in the file, and what its body looks like
            // up to the next one. Crude on purpose: a regex that can only ever
            // report a window as unguarded is a regex that fails loudly.
            const openers = [...text.matchAll(/^export (?:async )?function (open[A-Z]\w*|manage[A-Z]\w*)\s*\(/gm)];
            for (let i = 0; i < openers.length; i++) {
                const name = openers[i][1];
                if (EXEMPT.has(name)) continue;
                if (!STANDING.includes(name)) continue;
                const from = openers[i].index;
                const to = i + 1 < openers.length ? openers[i + 1].index : text.length;
                if (!text.slice(from, to).includes("alreadyOpen(")) {
                    missing.push(`${file}.mjs :: ${name}`);
                }
            }
        }

        ok(!missing.length,
            `these windows can be opened twice over: ${missing.join(", ")}`);
    }],

    ["the live-refresh helper carries what a rebuild would throw away", async () => {
        /*
         * `keepLive` replaces a region's DOM. Everything a person put there and
         * the markup does not carry — where they scrolled, which sections they
         * folded, what they typed but have not saved — has to survive that, or
         * the cure is worse than the stale window it fixes.
         *
         * Driven rather than read: a real region, a real rebuild, and the three
         * things checked afterwards. The GM panel proved this end to end at the
         * table (its folded sections survived an Eclipse), but the panel is one
         * caller and this is the promise every caller is given.
         */
        const { keepLive } = await import("./live.mjs");

        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-3000px;top:0;width:200px;height:80px";
        const build = () => `<div class="drpg-t-region">
            <details data-drpg-key="a"><summary>a</summary><p>a</p></details>
            <input name="typed" value="from the world">
            <div class="drpg-t-scroller" data-drpg-key="s"
                 style="height:30px;overflow:auto"><div style="height:400px"></div></div>
        </div>`;
        host.innerHTML = build();
        document.body.appendChild(host);

        // A window is anything with `.element`; nothing here needs a real one.
        const app = { element: host, options: { window: { title: "test" } } };
        const stop = keepLive(app, { region: ".drpg-t-region", build, delay: 0 });

        try {
            host.querySelector("details").open = true;
            host.querySelector("input[name=typed]").value = "half a sentence";
            host.querySelector(".drpg-t-scroller").scrollTop = 120;

            // The event every live window listens to.
            Hooks.callAll("drpgTimeOfDayChanged", {}, {});
            await wait(140);

            const region = host.querySelector(".drpg-t-region");
            ok(region.querySelector("details")?.open === true,
                "a rebuild closed a section the GM had opened");
            ok(region.querySelector("input[name=typed]")?.value === "half a sentence",
                "a rebuild ate what the GM was typing");
            ok(region.querySelector(".drpg-t-scroller")?.scrollTop === 120,
                "a rebuild threw away the scroll position");
        } finally {
            stop();
            host.remove();
        }
    }],

    ["a live region refuses to redraw under the cursor", async () => {
        /*
         * The other half of the same promise, and the one that cannot be
         * checked by looking at the result: a field being rebuilt while
         * somebody types in it loses the caret even when the value survives.
         * So the rebuild is not supposed to HAPPEN while focus is inside the
         * region — it waits.
         */
        const { keepLive } = await import("./live.mjs");

        let built = 0;
        const build = () => {
            built++;
            return `<div class="drpg-t-focus"><input name="f" value="v"></div>`;
        };
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:0;top:0;width:120px;opacity:0";
        host.innerHTML = build();
        document.body.appendChild(host);

        const app = { element: host, options: { window: { title: "test" } } };
        const stop = keepLive(app, { region: ".drpg-t-focus", build, delay: 0 });

        try {
            const field = host.querySelector("input[name=f]");
            field.focus();
            ok(document.activeElement === field, "could not put focus in the field");

            const before = built;
            Hooks.callAll("drpgTimeOfDayChanged", {}, {});
            await wait(140);
            ok(built === before, "a live region redrew a field somebody was typing in");

            /*
             * `blur()` and then the event ITSELF, dispatched by hand.
             *
             * A real blur fires `focusout` — in a window that has focus. This
             * suite runs in whichever tab the GM left it in, and a background
             * tab does not reliably deliver focus events at all: measured, the
             * first half of this test passed (nothing redrew) and the second
             * half timed out waiting for an event the browser never sent.
             *
             * That is the harness, not the module, and the fix is to stop
             * asking the harness. What is under test is what `keepLive` does
             * WHEN focus leaves; the browser's decision about when to say so is
             * somebody else's contract.
             */
            field.blur();
            host.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
            await wait(160);
            ok(built > before, "a deferred refresh never arrived after focus left");
        } finally {
            stop();
            host.remove();
        }
    }],

    ["every setting that promises a redraw gets one", async () => {
        /*
         * `onChange: () => onWorldChange(SETTINGS.x)` says "when this changes,
         * refresh whatever shows it". `onWorldChange` keeps that promise by
         * looking the key up in `SETTING_KINDS` — and a key missing from that
         * table is answered with SILENCE. Nothing throws, nothing warns, and
         * the screen keeps showing the old value until somebody reopens the
         * window.
         *
         * That is exactly what happened to the safeword: registered with the
         * promise at E0, given its table entry at E15, four builds later. The
         * motive had the same gap. Both were found by reading, not by playing,
         * which is why this is a test and not a note.
         *
         * The two halves live in two files and nothing links them, so this
         * fetches both. Same move as the glyph test, for the same reason.
         */
        const read = async name => {
            try {
                const res = await fetch(`/modules/${MODULE_ID}/scripts/${name}?t=${Date.now()}`);
                return res.ok ? await res.text() : "";
            } catch {
                return "";
            }
        };

        const [settings, sync] = await Promise.all([read("settings.mjs"), read("sync.mjs")]);
        ok(settings.length > 1000 && sync.length > 500,
            "could not read settings.mjs and sync.mjs to check the refresh wiring");

        const promised = new Set(
            [...settings.matchAll(/onWorldChange\(SETTINGS\.(\w+)\)/g)].map(m => m[1]));
        ok(promised.size, "no setting seems to promise a refresh — did onWorldChange move?");

        // Only the table, not the whole file: `SYNC.x` appears throughout.
        const table = sync.split("const SETTING_KINDS")[1]?.split("};")[0] ?? "";
        ok(table, "SETTING_KINDS is not where this test looks for it");
        const wired = new Set([...table.matchAll(/^\s*(\w+):\s*SYNC\./gm)].map(m => m[1]));

        const silent = [...promised].filter(key => !wired.has(key));
        ok(!silent.length,
            `these settings announce a change that reaches no screen: ${silent.join(", ")}`);
    }],

    ["the safeword is the table's, and never blank", () => {
        // E15. Two failure modes, both worse than a wrong word: a button with
        // no caption at all, and a button captioned with a raw i18n key.
        const word = safeword();
        ok(typeof word === "string" && word.trim(),
            "the safeword button would render with no word on it");
        ok(!/^DRPG\./.test(word), `the safeword is an unresolved key: ${word}`);
        equal(word, String(getSetting(SETTINGS.safeword) ?? "").trim() || DEFAULT_SAFEWORD,
            "the safeword shown is not the one this world stores");
    }],

    ["the three time Calls stay out of the armed-Call slot", () => {
        // Sprint, Burst and Relief buy a state of the time of day, not a
        // modifier on the next roll. `FLAGS.pendingCall` holds exactly ONE
        // armed Call, so any of the three carrying `grants` would silently
        // delete a Support armed a moment earlier — the architectural note E13
        // opens with, stated as a test because it is one edit away from being
        // untrue.
        for (const key of ["sprint", "burst", "relief"]) {
            const call = HOPE_CALLS[key];
            ok(call, `${key} is gone from the Hope Calls`);
            ok(!call.grants, `${key} would park itself in pendingCall and evict what is there`);
        }
    }],

    ["every trait a definition names actually exists", () => {
        const known = new Set(Object.keys(TRAITS));
        const check = (source, label) => {
            for (const [key, def] of Object.entries(source)) {
                for (const trait of def.traits ?? []) {
                    ok(known.has(trait), `${label} ${key} names unknown trait "${trait}"`);
                }
            }
        };
        check(ACTIONS, "action");
        check(CRISIS_ACTIONS, "crisis action");
    }],

    ["the crisis briefing can be built for every action", () => {
        // The briefing reads `hint`, `failure` and the threshold. A definition
        // missing all three renders an empty window, which is how the crisis
        // actions went to the dice with nothing said about them for months.
        for (const [key, def] of Object.entries(CRISIS_ACTIONS)) {
            ok(def.hint || def.failure, `${key} has neither a hint nor a failure line`);
        }
    }],

    ["a critical Strike knows how much it takes", () => {
        const strike = CRISIS_ACTIONS.strike;
        ok(strike.damage?.critical?.choice, "Strike's critical no longer offers a choice");
        ok(typeof strike.damage.criticalAmount === "number",
            "Strike offers a choice but does not say how many marks it moves");
    }],

    ["every string the code asks for exists in the language file", () => {
        // Only the keys spelled out as literals — a key built from a variable
        // cannot be checked from here, and pretending otherwise would make this
        // test lie in the reassuring direction.
        const missing = [];
        for (const key of LITERAL_KEYS) {
            if (!game.i18n.has(key)) missing.push(key);
        }
        ok(!missing.length, `missing: ${missing.slice(0, 8).join(", ")}`);
    }],

    ["the theme tokens resolve", () => {
        const root = getComputedStyle(document.documentElement);
        for (const token of ["--drpg-ink", "--drpg-bone", "--drpg-eye", "--drpg-blood",
                             "--drpg-gold", "--drpg-pix-skull", "--drpg-pix-query"]) {
            ok(root.getPropertyValue(token).trim(), `${token} is empty`);
        }
    }],

    ["nothing is repainting the page", () => {
        // Not a module bug when it fails — but every colour measurement in this
        // suite and every visual judgement at the table is worthless while it is
        // true, so it is worth saying out loud. See `detectPageTinting`.
        const tint = detectPageTinting();
        ok(!tint, `${tint?.name} is restyling the page — ${tint?.evidence}`);
    }],

    ["no Remnant token carries the answer key", () => {
        // The leak this suite exists to keep shut. A Remnant token travels to
        // every client, hidden or not, so anything on it beyond the marker is
        // readable from a player's console — measured before the fix: forty
        // traces with who left each one, whether it belonged to the murder, and
        // the GM's own sentence about it.
        const leaks = [];
        for (const scene of game.scenes) {
            for (const token of scene.tokens) {
                if (!token.getFlag(MODULE_ID, "isRemnant")) continue;
                const keys = Object.keys(token.flags?.[MODULE_ID] ?? {})
                    .filter(k => k !== "isRemnant");
                if (keys.length) leaks.push(`${token.name}: ${keys.join(", ")}`);
            }
        }
        ok(!leaks.length, `${leaks.length} token(s) still carry it — ${leaks[0]}`);
    }],

    ["a Remnant token's name gives nothing away", () => {
        // The name used to BE the answer: "Obvious Faint Prep Remnant · Player B
        // · Search: Cleaning agent". Names travel with the token — and so does
        // the DELTA, which is where the legacy placement path kept the same
        // label as the unlinked actor's name (`token.delta.name`), readable
        // from a player's console while `token.name` said a perfectly safe
        // "Trace" over it. Both halves are scanned, or the second one leaks
        // for exactly as long as nobody thinks to look at it.
        const expected = game.i18n.localize("DRPG.Remnant.tokenName");
        const talkative = [];
        for (const scene of game.scenes) {
            for (const token of scene.tokens) {
                if (!token.getFlag(MODULE_ID, "isRemnant")) continue;
                if (token.name !== expected) talkative.push(token.name);
                const deltaName = token.delta?.name;
                if (typeof deltaName === "string" && deltaName && deltaName !== expected) {
                    talkative.push(`delta: ${deltaName}`);
                }
            }
        }
        ok(!talkative.length, `${talkative.length} named for what they are — "${talkative[0]}"`);
    }],

    ["one account is only ever sent to one voice room", async () => {
        // A voice client is in a single breakout at a time. The loop used to
        // walk the ACTOR list and assign per actor, so an account owning two
        // characters in two rooms was sent to both on every pass — a full
        // disconnect and reconnect twice a minute, forever, which at the table
        // is a dropout every sixty seconds for one unlucky player.
        const { rows, byUser } = await voiceTargets();

        for (const [userId, chosen] of byUser) {
            const theirs = rows.filter(r => r.user?.id === userId);
            ok(theirs.includes(chosen),
                `${game.users.get(userId)?.name}'s room comes from no character of theirs`);
        }

        // And the same answer every time, or the "conflict" is really a coin
        // flip that reads as an assignment randomly not sticking.
        const again = await voiceTargets();
        for (const [userId, chosen] of byUser) {
            equal(again.byUser.get(userId)?.target ?? null, chosen.target ?? null,
                `${game.users.get(userId)?.name} is assigned a different room on a second pass`);
        }
    }],

    ["two rooms never share one voice channel", () => {
        // Room names are slugged, and a slug throws away everything that is not
        // a letter or a digit — so "Kitchen" and "Kitchen " were two rooms
        // everywhere else in this module and ONE room to LiveKit. Everybody in
        // them heard each other, silently, in the subsystem whose whole purpose
        // is that they should not.
        const scene = game.scenes.contents[0]?.id ?? "scene";
        const names = ["Kitchen", "Kitchen ", "Kitchen!", "kitchen", "Dorm A", "Dorm-A", "第一教室", "教室"];
        const seen = new Map();
        for (const name of names) {
            const room = liveKitRoomFor(scene, name);
            ok(!seen.has(room), `"${name}" and "${seen.get(room)}" both map to ${room}`);
            seen.set(room, name);
        }

        // Every real room on every scene, held to the same rule.
        for (const s of game.scenes) {
            const used = new Map();
            for (const region of s.regions ?? []) {
                if (!region.name) continue;
                const room = liveKitRoomFor(s.id, region.name);
                const clash = used.get(room);
                // Two regions with the SAME name are one room on purpose — a
                // corridor drawn in two pieces. Two different names are not.
                ok(clash === undefined || clash === region.name,
                    `"${s.name}": "${region.name}" and "${clash}" share a voice room`);
                used.set(room, region.name);
            }
        }
    }],

    ["the clock has one definition of its defaults", () => {
        const clock = getClock();
        for (const field of ["chapter", "day", "session", "timeOfDay", "phase"]) {
            ok(clock[field] !== undefined, `getClock() returns no ${field}`);
        }
    }],

    // The module has ONE version, in module.json, and one hand-written copy of
    // it: the stamp in the stylesheet, which cannot read a manifest. This is
    // the only thing keeping the two in step, and it exists because they did
    // not stay in step on their own — the panel shipped a release reading
    // "v1.0.53 (manifest 1.1.0)" off a second stamp nobody remembered to bump.
    // Fail here, at the moment before a release, rather than in front of a
    // table afterwards.
    /*
     * THE CARRY LIMITS AFTER E8 ARE TWO MECHANISMS, NOT ONE.
     *
     * A category either caps itself or draws on a shared budget, and a category
     * that does neither is uncapped on purpose (Truth Bullets, keys). What must
     * not happen is a category naming a group that is not there: `canCarry`
     * would read `undefined` as "no limit" and quietly let a character carry
     * eleven knives. Silent, again, and in the direction nobody notices.
     */
    ["every carry limit resolves to something", () => {
        for (const [key, cat] of Object.entries(ITEM_CATEGORIES)) {
            if (!cat.limitGroup) continue;
            ok(LIMIT_GROUPS[cat.limitGroup],
                `"${key}" draws on the limit group "${cat.limitGroup}", and there is no such group`);
            ok(Number.isInteger(LIMIT_GROUPS[cat.limitGroup].limit),
                `the limit group "${cat.limitGroup}" has no whole number for a limit`);
        }
    }],

    ["everything that can be held ready is a real category", () => {
        for (const key of EQUIPPABLE) {
            ok(ITEM_CATEGORIES[key], `EQUIPPABLE names "${key}", which is not an item category`);
        }
    }],

    /*
     * A ROLE THAT NAMES NOTHING DOES NOTHING, AND SAYS SO NOWHERE.
     *
     * `servesAs` compares the role against category keys, so a typo in a table
     * entry's flag produces an item that looks tagged on the sheet and answers
     * no question anybody asks of it. Scanned across the world rather than
     * across the catalogue, because the flag is written by GMs.
     */
    ["no item claims a role that does not exist", () => {
        const known = new Set(Object.keys(ITEM_CATEGORIES));
        const wrong = [];
        for (const actor of game.actors) {
            for (const item of actor.items) {
                for (const role of rolesOf(item)) {
                    if (!known.has(role)) wrong.push(`${actor.name}/${item.name}: "${role}"`);
                }
            }
        }
        ok(!wrong.length, `these items carry a role no category answers to — ${wrong.join(", ")}`);
    }],

    /*
     * E7 RESTS ENTIRELY ON A FIELD THE SYSTEM OWNS.
     *
     * Stacked advantage is `DualityRoll#advantageNumber` and the `kh` its
     * `applyAdvantage()` attaches. If a Daggerheart update drops either, nothing
     * throws and nothing looks wrong: every roll simply gets one bonus die, and
     * a Hope Call spent in a favouring room is worth what the room was worth
     * alone. That is the same class of silent failure as the music, and it is
     * caught the same way — by asking whether the thing we are standing on is
     * still there.
     */
    ["Daggerheart still supports more than one advantage die", () => {
        const DualityRoll = game.system?.api?.dice?.DualityRoll;
        ok(DualityRoll, "Daggerheart's DualityRoll is not where this module looks for it");
        ok(Object.getOwnPropertyDescriptor(DualityRoll.prototype, "advantageNumber")?.set,
            "DualityRoll has no advantageNumber setter any more — stacked advantage would "
            + "collapse to a single die without a word from anybody");
        ok(typeof DualityRoll.prototype.applyAdvantage === "function",
            "DualityRoll.applyAdvantage is gone — it is what turns a count into `kh`");
    }],

    /*
     * THE MUSIC'S FAILURES ARE ALL SILENT (E6).
     *
     * Every other subsystem announces a mistake: a card that does not post, a
     * button that refuses. The music's mistakes are all the same shape — the
     * right thing not happening — and a table hears a state with no music as a
     * GM who has not got round to mapping it yet. So they are checked here
     * rather than at the table.
     */
    ["every music state has a label somebody can read", () => {
        for (const state of MUSIC_STATES) {
            const label = state.label ?? game.i18n.localize(state.labelKey);
            ok(label && label !== state.labelKey,
                `the music state "${state.key}" has no label — "${state.labelKey}" `
                + "is missing from lang/en.json, and the GM's mapping table would "
                + "show the key instead of a name");
        }
    }],

    // Order IS the rule in this list — the first state that applies wins — so
    // an order that puts a wider state above a narrower one does not fail, it
    // makes the narrower one unreachable for good. All three trial states are
    // true during an Objection; only the order decides which is heard.
    ["the trial's three music states are ordered so each one can win", () => {
        const at = key => MUSIC_STATES.findIndex(s => s.key === key);
        const objection = at("trial.objection");
        const debate = at("trial.debate");
        const discussion = at("trial.discussion");

        ok(objection >= 0 && debate >= 0 && discussion >= 0,
            "the trial is missing one of its three music states");
        ok(objection < debate,
            "trial.objection is below trial.debate, so an Objection would never "
            + "take the music — the debate matches first");
        ok(debate < discussion,
            "trial.debate is below trial.discussion, so an open floor would never "
            + "take the music — the phase matches first");
        ok(discussion < at("search"),
            "the trial's states are below the Investigation's");
    }],

    // Trap 47. The old `trial` key was mapped by hand in every world that used
    // the music, and no state answers to it any more: left behind, it is a
    // mapping that looks right in the setting and produces silence at the one
    // moment of the game that most needs music. The migration moves it; this is
    // what says the migration actually ran here.
    ["nothing is mapped to a music state that no longer exists", () => {
        const known = new Set(MUSIC_STATES.map(s => s.key));
        const orphans = Object.keys(musicMap()).filter(key => !known.has(key));
        ok(!orphans.length,
            `this world maps ${orphans.join(", ")} to a playlist, and no music state `
            + "answers to that name — run game.drpg.migrate1_2_0({ force: true })");
    }],

    ["the stylesheet ships with the version it says it does", async () => {
        const css = stylesheetVersion();
        ok(css, "the stylesheet is not on this page at all — run game.drpg.diagnoseStyles()");

        /*
         * AGAINST THE MANIFEST FILE, NOT AGAINST `game.modules`.
         *
         * `moduleVersion()` reads the manifest Foundry parsed at startup, and
         * this server caches that: measured, module.json on disk said 1.1.33
         * while `game.modules.get(...).version` still said 1.1.30 — and the
         * stylesheet ALSO said 1.1.30, so this test passed while the CSS was
         * three versions stale. A test that agrees with the thing it is
         * checking is not a test.
         *
         * Fetching the file gets what will actually ship. Falls back to the
         * cached value when the fetch fails, because a test that cannot read
         * the disk should report what it can rather than fail on the network.
         */
        let shipped = moduleVersion();
        try {
            const res = await fetch(`/modules/${MODULE_ID}/module.json?t=${Date.now()}`);
            if (res.ok) shipped = (await res.json())?.version ?? shipped;
        } catch {
            // Keep the cached reading; the equality below still means something.
        }

        equal(css, shipped,
            "--drpg-css-version in danganronpa.css does not match module.json");
    }]
];

/**
 * i18n keys worth checking, gathered by hand.
 *
 * Deliberately not scraped from the source at runtime: the scrape would have to
 * run over files this module cannot read from the browser, and a half-scrape
 * that quietly checks forty keys out of six hundred reads as a pass.
 */
const LITERAL_KEYS = [
    "DRPG.Murder.victimUnderAttack", "DRPG.Murder.victimTrapSprung",
    "DRPG.Murder.briefThreshold", "DRPG.Murder.briefRoll", "DRPG.Murder.briefTake",
    "DRPG.Murder.criticalChoiceTitle", "DRPG.Murder.criticalChoiceHp", "DRPG.Murder.criticalChoiceStress",
    "DRPG.Murder.betrayTileLabel", "DRPG.Murder.betrayTileHint",
    "DRPG.Murder.ranOutTwoKillers", "DRPG.Murder.ranOutEndNow", "DRPG.Murder.ranOutKeepGoing",
    "DRPG.Calls.silencedBadge", "DRPG.Calls.chainedBadge",
    "DRPG.Monocub.silencedBadge", "DRPG.Monocub.silencedTooltip",
    "DRPG.Remnant.cardTitle", "DRPG.Remnant.cardWhat", "DRPG.Remnant.cardPlayer",
    "DRPG.Project.proposalTitle", "DRPG.Project.approveButton", "DRPG.Project.declineButton",
    "DRPG.Project.proposeButton", "DRPG.Project.createButton",
    "DRPG.Season.title", "DRPG.Season.resetTitle", "DRPG.Season.resetWord",
    "DRPG.Season.step.resources", "DRPG.Season.hint.resources",
    "DRPG.Diagnostics.pageTinted",
    // E12. Every one of these is said on a client that did not decide it — a
    // GM-side refusal, a victim's whisper, a row that outlived its item — so a
    // missing key here renders as a raw string in front of a player.
    "DRPG.Tamper.notYours", "DRPG.Tamper.nothingOfYours", "DRPG.Tamper.onlyReinforced",
    "DRPG.Steal.caughtTaking", "DRPG.Steal.caughtTrying", "DRPG.Steal.nobodyHere",
    "DRPG.Steal.cardSeen", "DRPG.Steal.cardUnseen", "DRPG.Steal.cardHandsFull",
    "DRPG.Items.rowGone",
    "DRPG.Reroll.stealStands", "DRPG.Reroll.trailStands",
    "DRPG.Analyze.findStash", "DRPG.Analyze.stashSent"
];

/* ==========================================================================
 * TIER 2 — SCENARIOS
 * ========================================================================== */

/**
 * Everything a scenario is allowed to disturb, recorded so it can be put back.
 *
 * The clock and the incident are world settings; resources are actor data. A
 * scenario that throws half way through still gets restored, because the restore
 * runs from `finally` in the runner rather than at the end of the test.
 */
async function snapshot(cast) {
    return {
        clock: foundry.utils.deepClone(getClock()),
        murder: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}),
        // E14. Both are world settings a scenario below writes, and both are
        // visible to the whole table — a suite that leaves a motive standing
        // has announced one at somebody's game.
        motive: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.motive) ?? {}),
        gather: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.pendingGather) ?? {}),
        // HOPE AS WELL AS THE TWO REVERSE RESOURCES.
        //
        // It was missing, and the suite therefore paid its fixture actor one
        // Hope per run and never took it back. Measured: three students set to
        // 3, one clean 22/22 pass, and the roller came out at 4 while the other
        // two were untouched — so three runs in an afternoon leave a character
        // three Hope richer than the GM last saw them. Hope buys Calls; that is
        // a real resource quietly appearing out of a test.
        //
        // Same class of defect as the re-entrancy one: the contract this file
        // opens with is "fixtures built and put back", and a resource nobody
        // recorded cannot be put back.
        resources: cast.map(a => ({
            id: a.id,
            hp: a.system?.resources?.hitPoints?.value ?? 0,
            stress: a.system?.resources?.stress?.value ?? 0,
            hope: a.system?.resources?.hope?.value ?? 0,
            // THE ACTION BUDGET AND WHAT HOPE HAS BOUGHT (E13).
            //
            // Same defect class as the Hope that used to leak: a scenario that
            // spends an action or banks a Burst and does not put it back leaves
            // the fixture richer or poorer than the GM last saw it, and the
            // next run measures against a world the suite itself moved.
            actions: a.system?.resources?.actions?.value ?? 0,
            burst: a.getFlag(MODULE_ID, "freeActionGrants") ?? 0,
            sprint: a.getFlag(MODULE_ID, "freeMoveGrants") ?? 0,
            freeMove: a.getFlag(MODULE_ID, "freeMoveUsed") ?? false,
            deceased: a.getFlag(MODULE_ID, "deceased") ?? null
        })),
        // WHICH TOKENS AND MESSAGES EXISTED, not how many.
        //
        // An incident drops Remnants of its own — the opening roll leaves one,
        // every crisis action can leave another — and they are world objects
        // that outlive the test and change what the NEXT measurement sees. The
        // first version of this suite passed all six scenarios and left three
        // Remnants behind, which is the failure this file's own header warns
        // about. Recorded as ids rather than a count so the restore removes
        // exactly what appeared and never touches anything that was already
        // there.
        // `game.scenes` is a Foundry Collection, which has `map` and `filter`
        // but NOT `flatMap` — the first version used it, threw inside the
        // snapshot, and the runner reported one failure and skipped every
        // scenario. A suite that silently runs nothing reads almost the same as
        // a suite that passes, which is why the runner names the step.
        remnants: new Set(game.scenes.reduce((ids, scene) => {
            for (const token of scene.tokens) {
                if (token.getFlag(MODULE_ID, "isRemnant")) ids.push(`${scene.id}.${token.id}`);
            }
            return ids;
        }, [])),
        messages: new Set(game.messages.map(m => m.id))
    };
}

async function restore(snap) {
    const { reviveCharacter } = await import("./chapter.mjs");
    await game.settings.set(MODULE_ID, SETTINGS.murderState, snap.murder);
    await game.settings.set(MODULE_ID, SETTINGS.motive, snap.motive);
    await game.settings.set(MODULE_ID, SETTINGS.pendingGather, snap.gather);
    const { clearBlackened } = await import("./murder.mjs");
    await clearBlackened();

    for (const row of snap.resources) {
        const actor = game.actors.get(row.id);
        if (!actor) continue;
        if (!row.deceased && actor.getFlag(MODULE_ID, "deceased")) await reviveCharacter(actor);
        await actor.update({
            "system.resources.hitPoints.value": row.hp,
            "system.resources.stress.value": row.stress,
            "system.resources.hope.value": row.hope,
            "system.resources.actions.value": row.actions,
            // Written as values rather than deleted: `-=key` does nothing in
            // this Foundry without a forced replacement, so a "restore" that
            // unsets can leave the world dirty and quietly poison the next run.
            [`flags.${MODULE_ID}.freeActionGrants`]: row.burst,
            [`flags.${MODULE_ID}.freeMoveGrants`]: row.sprint,
            [`flags.${MODULE_ID}.freeMoveUsed`]: row.freeMove
        });
    }
    // Anything that appeared while the scenario ran, removed.
    for (const scene of game.scenes) {
        const strays = scene.tokens
            .filter(t => t.getFlag(MODULE_ID, "isRemnant") && !snap.remnants.has(`${scene.id}.${t.id}`))
            .map(t => t.id);
        if (strays.length) await scene.deleteEmbeddedDocuments("Token", strays);
    }

    // The chat the scenarios produced. Kept out of the log on purpose: a suite
    // that leaves forty whispers behind makes the log useless for the session
    // that follows it, and none of them are a record of anything that happened.
    const strayMessages = game.messages.filter(m => !snap.messages.has(m.id)).map(m => m.id);
    if (strayMessages.length) await ChatMessage.deleteDocuments(strayMessages);

    await setClock(snap.clock);
    await settle();
}

/** Three students to play with, or the scenarios cannot run. */
function cast() {
    const roster = studentActors();
    if (roster.length < 3) throw new Failure(`need three students, found ${roster.length}`);
    return roster.slice(0, 3);
}

const SCENARIOS = [
    ["a direct murder opens on the killer and tells the victim", async () => {
        const [killer, victim] = cast();
        const drpg = game.drpg;
        const before = game.messages.size;

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        equal(drpg.murderState()?.stage, "openingRoll", "stage after opening");

        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();

        const state = drpg.murderState();
        equal(state.stage, "incident", "stage after the opening roll");
        equal(state.turnSide, "victim", "the victim opens the incident");

        const told = [...game.messages].slice(before).some(m =>
            m.whisper.includes(game.users.find(u => victim.testUserPermission(u, "OWNER"))?.id ?? "")
            || /moving on you/i.test(m.content ?? ""));
        ok(told, "the victim was never told the incident began");
    }],

    ["two killers act back to back, not alternating with the victim", async () => {
        const [killer, victim, third] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.thirdPartyEnters(third);
        await settle();
        await drpg.resolveCrisisAction({
            actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true
        });
        await settle();

        equal(murder.killerIds().length, 2, "the accomplice joined the killers");
        equal(murder.murderState().turnSide, "victim", "the accomplice joining does not steal the victim's turn");
        const startTurn = murder.murderState().turn;

        // The victim's turn always passes to the FIRST killer — not to
        // whichever of them the rotation happened to leave off on last round.
        await drpg.passTurn();
        await settle();
        let state = murder.murderState();
        equal(state.turnSide, "killer", "the victim's turn passes to a killer");
        equal(state.killerTurnId, killer.id, "the round opens on the first killer");
        let who = [killer, third].filter(a => murder.isTheirTurn(a));
        equal(who.length, 1, "exactly one killer may act on this turn");
        equal(who[0].id, killer.id, "the first killer's turn belongs to the first killer");

        // The bug this guards: the old rule alternated `turnSide` on every
        // pass, so a second killer's turn was really victim, killer(A),
        // victim, killer(B) — the victim got a breather neither killer earned,
        // and the round advanced twice for one lap of the killers. The second
        // killer's turn must follow the first DIRECTLY, with the round number
        // unmoved.
        await drpg.passTurn();
        await settle();
        state = murder.murderState();
        equal(state.turnSide, "killer", "the second killer's turn follows the first directly, not the victim's");
        equal(state.killerTurnId, third.id, "turn hands to the second killer");
        equal(state.turn, startTurn, "the round has not advanced — the killers' side is not done yet");
        who = [killer, third].filter(a => murder.isTheirTurn(a));
        equal(who.length, 1, "exactly one killer may act on this turn");
        equal(who[0].id, third.id, "the second killer's turn belongs to the second killer");

        // Only once every killer has gone does the turn return to the victim,
        // and only then does the round advance.
        await drpg.passTurn();
        await settle();
        state = murder.murderState();
        equal(state.turnSide, "victim", "the victim's turn returns only after every killer has gone");
        equal(state.turn, startTurn + 1, "the round advances exactly once, after the last killer");

        // And the next round opens the same way: first killer first, not a
        // continuation of the rotation.
        await drpg.passTurn();
        await settle();
        equal(murder.murderState().killerTurnId, killer.id, "the next round opens on the first killer again");
    }],

    ["a Finishing Blow actually kills", async () => {
        const [killer, victim] = cast();
        const drpg = game.drpg;
        const { isDeceased } = await import("./chapter.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await drpg.passTurn();
        await settle();

        ok(!isDeceased(victim), "the victim started the test dead");
        await drpg.resolveCrisisAction({
            actorId: killer.id, key: "finishingBlow", total: 99, isCritical: false, withHope: true
        });
        await wait(1600);

        equal(drpg.murderState()?.stage, "resolution", "stage after the blow");
        ok(isDeceased(victim), "the victim is not recorded dead");
        ok(victim.effects.some(e => e.statuses?.has?.("dead")), "no dead marker on the token");
    }],

    ["openMurder refuses during an Eclipse, but not once one has actually ended", async () => {
        // `judgePendingMurders` (eclipse.mjs) is the one legitimate call to
        // `openMurder` that happens WHILE an Eclipse is closing — a Direct
        // Murder declared in the dark is parked, not opened, and only judged
        // from inside `endEclipse`, after the clock has already cleared the
        // Eclipse flag. This pins both halves of that: the new guard actually
        // refuses while the flag is set, and the flag really is gone by the
        // time `endEclipse` would call `openMurder` for a parked declaration —
        // so the guard added for this bug fix cannot silently swallow the one
        // call it is supposed to let through.
        const [killer, victim] = cast();
        const murder = await import("./murder.mjs");
        const eclipse = await import("./eclipse.mjs");

        await eclipse.startEclipse();
        await settle();
        ok(eclipse.isEclipse(), "the Eclipse did not start");

        const blocked = await murder.openMurder({ killerId: killer.id, victimId: victim.id });
        equal(blocked, null, "openMurder opened an incident while the Eclipse was still running");
        equal(murder.murderState(), null, "an incident exists despite the Eclipse lock");

        await eclipse.endEclipse({ advance: false });
        await settle();
        ok(!eclipse.isEclipse(), "ending the Eclipse did not clear the flag");

        const opened = await murder.openMurder({ killerId: killer.id, victimId: victim.id });
        ok(opened, "openMurder still refuses once the Eclipse has actually ended");
        equal(murder.murderState()?.killerId, killer.id, "the incident that opened has the wrong killer");
    }],

    ["both killers may clean up, nobody else may", async () => {
        const [killer, victim, third] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");
        const cleanup = await import("./cleanup.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.thirdPartyEnters(third);
        await settle();
        await drpg.resolveCrisisAction({
            actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true
        });
        await settle();
        await murder.beginResolution("test");
        await settle();

        ok(cleanup.isCleaner(killer), "the killer cannot clean up");
        ok(cleanup.isCleaner(third), "the accomplice cannot clean up");
        ok(!cleanup.isCleaner(victim), "the victim was offered the clean-up");
    }],

    ["a killer's own client can see what there is to clean up, and nothing more", async () => {
        // `cleanableRemnants` already answered this correctly for a GM, which is
        // exactly why the bug — `remnantData()` returning null for anybody else
        // — never showed up running this suite as the world's GM. What this
        // scenario actually pins down is the shape `cleanableTracesForPlayer`
        // hands back over the bridge: it is what a player's client receives
        // instead, and it must never carry the answer key.
        const [killer, victim] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");
        // The bridge is where the player-facing entry point lives; cleanup.mjs
        // only holds the GM-side builder it delegates to. Importing it from
        // cleanup.mjs made this whole scenario throw before its assertions ran.
        const bridge = await import("./gm-bridge.mjs");
        const remnants = await import("./remnants.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.beginResolution("test");
        await settle();

        const dropped = await remnants.dropRemnant(killer, {
            type: "prep", visibility: "evident", note: "test fixture — cleanup bridge"
        });
        ok(dropped, "could not place a trace to clean up");
        await settle();

        const traces = await bridge.requestCleanableTraces(killer.id);
        ok(Array.isArray(traces) && traces.length > 0, "the killer's client sees nothing to clean up");
        ok(traces.some(t => t.id === dropped.id), "the trace just dropped is not in the killer's own list");

        for (const t of traces) {
            ok(typeof t.label === "string" && t.label.length > 0, "a trace reached the killer with no label");
            ok(!("dc" in t), `a trace leaked its DC to the killer's client: ${JSON.stringify(t)}`);
            ok(!("tiedToCrime" in t), `a trace leaked tiedToCrime to the killer's client: ${JSON.stringify(t)}`);
        }
    }],

    ["the roll window opens, locked, and a bare statistic is a reaction", async () => {
        /*
         * THE ONE PLACE THE WINDOW ITSELF IS TESTED.
         *
         * Every other scenario skips it (see `suiteRolling`), so this is what
         * stops "the window opens" from quietly stopping being true — which is
         * exactly how it stopped being true the first time: `maybeRollItself`
         * pressed the button and nothing anywhere noticed for four updates.
         *
         * Rolled OUTSIDE the suite's skip so the real path runs, and closed
         * rather than submitted: this asks what the window IS, not what the
         * dice say.
         */
        const [who] = cast();
        game.drpg.suiteRolling = false;
        let app = null;
        try {
            who.rollTrait("instinct", {
                event: { shiftKey: false, altKey: false, ctrlKey: false },
                dialog: { configure: true }
            });
            await wait(1500);

            app = [...foundry.applications.instances.values()]
                .find(w => w.element?.classList?.contains("roll-selection"));
            ok(app, "the roll window did not open for a bare statistic click");

            const root = app.element;
            const chip = root.querySelector('[data-action="toggleReaction"]');
            ok(chip, "the reaction control is gone from the roll window");
            ok(chip.classList.contains("selected"),
                "a bare statistic roll is not marked as a reaction");
            equal(app.config.actionType, "reaction",
                "the roll is not configured as a reaction");

            // And the player cannot take it off.
            chip.click();
            await wait(300);
            equal(app.config.actionType, "reaction",
                "the reaction lock came off when the chip was clicked");

            // The controls the lock owns are still shut.
            const trait = root.querySelector("select[name=trait]");
            ok(!trait || trait.disabled, "the trait picker is unlocked in a student's roll window");
        } finally {
            try { await app?.close(); } catch { /* already gone */ }
            game.drpg.suiteRolling = true;
        }
    }],

    ["a Burst pays for a whole action, exactly once, and comes back if refunded", async () => {
        const [who] = cast();
        const actions = await import("./actions.mjs");
        const { grantFreeActions, freeActionsLeft, spendAction, refundAction } = actions;

        // Start from a known place: no actions at all, one Burst banked. That
        // is the state trap 96 is about — a player who cannot pay for anything
        // and has just spent four Hope so that they can.
        await who.update({ "system.resources.actions.value": 0 });
        await who.setFlag(MODULE_ID, "freeActionGrants", 0);
        await grantFreeActions(who, 1);
        await settle();

        equal(freeActionsLeft(who), 1, "the Burst was not banked");
        ok(actions.canPayFor(who, 1), "a banked Burst does not count as being able to pay");
        ok(actions.canPayFor(who, 2), "a Burst has to cover a two-action Long Rest");

        // The whole call, whatever it charged for.
        const paid = await spendAction(who, 2);
        await settle();
        ok(paid, "a Long Rest could not be paid for with a Burst");
        equal(who.system.resources.actions.value, 0, "the Burst let the action budget be touched");
        equal(freeActionsLeft(who), 0, "the Burst was not consumed");

        // And exactly one call: the second spend in the same turn pays normally,
        // which with no actions left means it cannot happen at all (trap 97).
        const again = await spendAction(who, 1);
        await settle();
        ok(!again, "one Burst paid for two separate spends");

        // A refund gives back what was taken, not an action out of thin air
        // (trap 98). The bookkeeping is per-spend, so this rebuilds the state.
        await grantFreeActions(who, 1);
        await spendAction(who, 1);
        await settle();
        await refundAction(who, 1);
        await settle();
        equal(freeActionsLeft(who), 1, "the refund did not give the Burst back");
        equal(who.system.resources.actions.value, 0,
            "the refund turned a Burst into an action out of nowhere");

        // And the time of day takes both counters with it.
        await actions.grantFreeMoves(who, 2);
        await actions.resetActionsFor(who);
        await settle();
        equal(freeActionsLeft(who), 0, "a Burst survived the reset");
        equal(actions.freeMovesLeft(who), 0, "a Sprint survived the reset");
    }],

    ["the accomplice is offered the betrayal, and only them", async () => {
        const [killer, victim, third] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();
        await murder.thirdPartyEnters(third);
        await settle();
        await drpg.resolveCrisisAction({
            actorId: third.id, key: "crimePartners", total: 20, isCritical: false, withHope: true
        });
        await settle();

        ok(!murder.betrayalTarget(third), "the betrayal was offered during the incident");

        await murder.beginResolution("test");
        await settle();

        equal(murder.betrayalTarget(third)?.id, killer.id, "the accomplice turns on the killer");
        ok(!murder.betrayalTarget(killer), "the killer was offered a betrayal");
        ok(!murder.betrayalTarget(victim), "the victim was offered a betrayal");
    }],

    ["Observe ranks crime-tied traces first, then by difficulty", async () => {
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const scene = game.scenes.active;

        // Build the shelf instead of demanding the world already owns one. The
        // old form of this test asked the active scene for a room holding three
        // Remnants and failed on any world that had none — a clean world most
        // of all.
        //
        // Four traces at one point share a room by construction: the same hit
        // test answers for all of them, holes and all. The anchor is any token
        // already standing in a room, which spares this test owning any region
        // geometry of its own.
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "no token on the active scene stands in any room — nowhere to build the fixture");

        const spread = [
            { type: "key", visibility: "obvious", tiedToCrime: true },   // DC 6, tied
            { type: "prep", visibility: "hidden", tiedToCrime: true },   // DC 18, tied
            { type: "prep", visibility: "obvious", tiedToCrime: false }, // DC 9
            { type: "prep", visibility: "subtle", tiedToCrime: false }   // DC 15
        ];

        const placed = [];
        try {
            for (const data of spread) {
                const token = await remnants.placeRemnant({
                    ...data, x: anchor.x, y: anchor.y, scene,
                    note: "test fixture — Observe ranking"
                });
                ok(token, "could not place a fixture Remnant");
                placed.push(token);
            }
            await settle();

            const room = roomOfToken(placed[0]);
            ok(room, "the fixture Remnants landed outside every room");

            const ranked = remnants.rankForObserve(room, scene);

            // The room may already hold other traces, so the fixture asserts
            // RELATIVE order, which extras cannot disturb.
            const at = token => ranked.findIndex(r => r.token.id === token.id);
            const [tiedLow, tiedHigh, untiedLow, untiedHigh] = placed.map(at);
            for (const [i, idx] of [tiedLow, tiedHigh, untiedLow, untiedHigh].entries()) {
                ok(idx >= 0, `fixture Remnant ${i} is missing from the ranking`);
            }
            ok(tiedLow < tiedHigh, "inside the crime-tied group, the harder trace outranked the easier");
            ok(tiedHigh < untiedLow, "an untied Remnant is ranked above a crime-tied one");
            ok(untiedLow < untiedHigh, "inside the untied group, the harder trace outranked the easier");

            // And the whole shelf still obeys the two rules, extras included.
            for (let i = 1; i < ranked.length; i++) {
                const before = ranked[i - 1], after = ranked[i];
                if (before.data.tiedToCrime === after.data.tiedToCrime) {
                    ok(before.dc <= after.dc, `${room}: DC ${before.dc} listed before DC ${after.dc}`);
                } else {
                    ok(before.data.tiedToCrime, `${room}: an untied Remnant is ranked above a tied one`);
                }
            }
        } finally {
            // Tombstone the ledger entries the way the module itself does,
            // then take the tokens off the map.
            for (const token of placed) await remnants.dropRemnantSecret(token);
            const ids = placed.map(t => t.id).filter(id => scene.tokens.has(id));
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
        }
    }],

    ["the case dashboard reads its traces three ways, and keeps the reading", async () => {
        /*
         * Dawid, 28.08: chronologically, newest first; by player; by room.
         *
         * THE READING IS HELD OUTSIDE THE DOM, and that is the whole of why it
         * works in a window that rebuilds itself. `keepLive` redraws the region
         * from `buildCase`, and a build that read the filter off the select
         * would render the list BEFORE `restore` put the select back — one
         * frame of the wrong list every time anything in the world moved. So
         * this asserts both halves: the list narrows, AND the choice is still
         * standing after the redraw that the choice itself triggered.
         */
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const scene = canvas?.scene;
        ok(scene, "no active scene");

        const anchors = Array.from(scene.tokens).filter(t => roomOfToken(t));
        const rooms = [...new Set(anchors.map(t => roomOfToken(t)))];
        ok(rooms.length >= 2, "need two rooms with a token standing in them");
        const cast = game.actors.filter(a => a.type === "character").slice(0, 2);
        ok(cast.length >= 2, "need two characters to tell 'left by' apart");

        const spread = [
            { room: rooms[0], who: cast[0], day: 1, timeOfDay: "morning" },
            { room: rooms[1], who: cast[1], day: 3, timeOfDay: "night" },
            { room: rooms[0], who: cast[1], day: 2, timeOfDay: "noon" }
        ];

        const placed = [];
        let dialog = null;
        try {
            for (const one of spread) {
                const anchor = anchors.find(t => roomOfToken(t) === one.room);
                const token = await remnants.placeRemnant({
                    type: "prep", visibility: "evident", scene, x: anchor.x, y: anchor.y,
                    sourceActor: one.who.id, sourceName: one.who.name, room: one.room,
                    chapter: 1, day: one.day, timeOfDay: one.timeOfDay,
                    note: "test fixture — dashboard filters"
                });
                ok(token, "could not place a fixture trace");
                placed.push(token);
            }
            await settle();

            const investigation = await import("./investigation.mjs");
            const before = new Set(foundry.applications.instances.keys());
            // Not awaited: it settles when the GM closes it. See R12.
            Promise.resolve(investigation.openInvestigationDashboard()).catch(() => {});
            await wait(900);
            for (const [id, app] of foundry.applications.instances.entries()) {
                if (!before.has(id)) dialog = app;
            }
            ok(dialog?.element, "the dashboard did not open");

            const bar = () => dialog.element.querySelector(".drpg-trace-filters");
            ok(bar(), "the dashboard has no filter bar");
            const rows = () => dialog.element
                .querySelectorAll('[data-drpg-panel="traces"] tbody tr').length;
            const control = which => bar().querySelector(`[data-drpg-filter="${which}"]`);
            const choose = async (which, value) => {
                const element = control(which);
                element.value = value;
                element.dispatchEvent(new Event("change", { bubbles: true }));
                await wait(400);
            };

            const all = rows();
            ok(all >= 3, `the dashboard lists ${all} trace(s); the fixture placed three`);

            // The options come off the traces themselves, not off the cast.
            const people = [...control("player").options].map(o => o.value).filter(Boolean);
            ok(people.includes(cast[1].id), "the player filter does not offer a trace's own author");

            await choose("player", cast[1].id);
            const mine = rows();
            ok(mine < all, `filtering by player showed ${mine} of ${all} — nothing was filtered`);
            equal(control("player").value, cast[1].id,
                "the chosen player did not survive the redraw it triggered");

            await choose("player", "");
            await choose("room", rooms[0]);
            const here = rows();
            ok(here < all, `filtering by room showed ${here} of ${all} — nothing was filtered`);
            equal(control("room").value, rooms[0],
                "the chosen room did not survive the redraw it triggered");

            await choose("room", "");
            await choose("order", "newest");
            equal(rows(), all, "ordering dropped rows; it is an order, not a filter");
            const first = dialog.element
                .querySelector('[data-drpg-panel="traces"] tbody tr')?.textContent ?? "";
            ok(/D\s*3/.test(first),
                `newest first put "${first.replace(/\s+/g, " ").trim().slice(0, 60)}" at the top`);
        } finally {
            if (dialog) await dialog.close();
            for (const token of placed) await remnants.dropRemnantSecret(token);
            const ids = placed.map(t => t.id).filter(id => scene.tokens.has(id));
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
        }
    }],

    ["a trace and its bullets are one record, edited from either end", async () => {
        /*
         * Dawid, 28.08: "the synchronisation is to be full, continuous,
         * regardless of when and where the edit happens."
         *
         * The downward half is old — the trace's record has always been pushed
         * onto every bullet copied from it. The upward half is v1.1.55, and it
         * is the one with a moving part: `updateItem` fires on EVERY client, so
         * the handler is fenced to one GM, and a fence in the wrong place turns
         * the whole feature off without a word. Nothing failed when it was
         * written; nothing would fail if it stopped working either.
         *
         * TWO HOLDERS ON PURPOSE. One bullet cannot tell "the edit reached the
         * trace" apart from "the edit stayed where it was typed". The second
         * copy is the only witness that the words travelled.
         */
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { roomOfToken } = await import("./movement.mjs");

        const scene = canvas?.scene;
        ok(scene, "no active scene");
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "no token on the active scene stands in any room");

        const cast = game.actors.filter(a => a.type === "character").slice(0, 2);
        ok(cast.length >= 2, "need two characters to watch one edit reach the other");
        const [one, two] = cast;

        let token = null;
        const made = [];
        try {
            token = await remnants.placeRemnant({
                type: "prep", visibility: "evident", x: anchor.x, y: anchor.y, scene,
                note: "test fixture — trace/bullet sync"
            });
            ok(token, "could not place the fixture trace");

            for (const actor of [one, two]) {
                const item = await bullets.createTruthBullet(actor, {
                    name: "Suite fixture bullet",
                    realType: "neutral",
                    visibility: "obvious",
                    remnantId: token.id,
                    sceneId: scene.id
                });
                ok(item, `no bullet was created for ${actor.name}`);
                made.push(item);
            }
            await settle();

            // ---- DOWN: the trace speaks, both copies listen -----------------
            const said = `Fixture trace ${Date.now() % 100000}`;
            await remnants.setRemnantPublic(token, { name: said, playerText: "A chipped rim." });
            await settle();
            for (const item of made) {
                const live = item.actor.items.get(item.id);
                equal(live?.name, said,
                    `${item.actor.name}'s copy did not take the trace's name`);
            }

            // ---- UP: one copy is corrected, and the record moves ------------
            const corrected = `Corrected ${Date.now() % 100000}`;
            await made[0].actor.items.get(made[0].id).update({ name: corrected });
            await settle();

            equal(remnants.remnantPublic(token)?.name, corrected,
                "an edit on a bullet never reached the trace it came from");

            // ---- AND BACK DOWN, to the copy nobody touched ------------------
            equal(two.items.get(made[1].id)?.name, corrected,
                "the trace took the correction and the other holder never saw it");

            // ---- The words, not only the title -----------------------------
            await made[0].actor.items.get(made[0].id)
                .update({ "system.description": "<p>Rust in the hinge.</p>" });
            await settle();
            equal(remnants.remnantPublic(token)?.playerText, "Rust in the hinge.",
                "a description typed on the item sheet did not reach the trace");
        } finally {
            for (const item of made) {
                const live = item.actor?.items?.get(item.id);
                if (live) await live.delete();
            }
            if (token) {
                await remnants.dropRemnantSecret(token);
                if (scene.tokens.has(token.id)) {
                    await scene.deleteEmbeddedDocuments("Token", [token.id]);
                }
            }
        }
    }],

    ["no piece of a room's outline is shorter than the line it is drawn with", async () => {
        /*
         * THE CUT WHITE WEDGE, STANDING ON ITS OWN IN THE MIDDLE OF A DOORWAY.
         *
         * An OPENING shorter than a third of a square is discarded \— `shortest`
         * in `doorwayEdges`. A walled stretch had no such rule, and the two are
         * not symmetric in what they cost. One stray sample reading "wall" in
         * the middle of a long opening leaves a visible stretch a few pixels
         * long, and this outline is stroked with SQUARE caps: each end runs half
         * a line-width past the stretch, so anything shorter than one width
         * comes out as a solid wedge rather than a line \— alone in the middle
         * of an opening, ink keyline and all, far from any other outline.
         *
         * Reproduced on a fixture: a plain room whose whole top border is a
         * doorway, with ONE eight-pixel wall in the middle of it. The wall
         * splits the border into two openings, and the sliver of "wall" between
         * them is a two-point chain \— which the tracer stroked
         * unconditionally.
         *
         * What is asserted here is the property rather than the fixture: every
         * chain this room actually draws is at least as long as the ink line
         * drawing it. It reads the geometry PIXI was handed, so it is the drawn
         * thing being measured and not the intention.
         */
        const fog = await import("./fog.mjs");
        const before = fog.diagnoseFog({ toChat: false });
        ok(before.currentRooms?.length,
            "nobody is standing in a named room, so no outline is being drawn to measure");

        const find = (node, name) => {
            if (node.name === name) return node;
            for (const child of node.children ?? []) {
                const found = find(child, name);
                if (found) return found;
            }
            return null;
        };
        const group = find(canvas.stage, "drpgRoomOutline");
        ok(group, "the room outline group is not on the canvas");

        const graphics = group.children.find(c => !c.texture && c.geometry);
        ok(graphics, "the outline has no geometry to read");

        const grid = canvas.grid.size;
        const inkWidth = Math.max(7, Math.round(grid * 0.11)) + Math.max(4, Math.round(grid * 0.05));

        const stubs = [];
        let chains = 0;
        for (const piece of graphics.geometry?.graphicsData ?? []) {
            const points = piece.shape?.points;
            if (!points || points.length < 4) continue;
            chains++;
            // Along the chain, not end to end: a staircase doubles back, and its
            // span would read shorter than the line it draws.
            let run = 0;
            for (let i = 2; i < points.length; i += 2) {
                run += Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]);
            }
            const width = piece.lineStyle?.width ?? inkWidth;
            if (run < width) stubs.push(`${Math.round(run)}px of outline drawn with a ${width}px line`);
        }

        ok(chains > 0, "the outline drew nothing at all");
        ok(!stubs.length, `${before.currentRooms[0]}: ${stubs.join("; ")}`);
    }],

    ["a diagonal wall closes the staircase drawn along it", async () => {
        /*
         * THE ISOMETRIC CASE, WHICH IS THE ONLY CASE THIS MODULE HAS.
         *
         * The art draws a wall as a diagonal. A region is drawn on the square
         * grid, so the border describing that wall comes out as a staircase of
         * axis-aligned steps. `wallAlongEdge` asked whether the wall ran within
         * twenty degrees of the border, compared the wall against ONE STEP, and
         * 45 degrees is not within twenty of nothing \— so the wall lying
         * exactly along the border closed nothing at all.
         *
         * Measured before the repair, on this fixture: fully open at every step
         * size from half a square to three. The distance never mattered; only
         * the angle did. What a table sees is a cut strip of doorway glow
         * sitting in the middle of a wall, far from any way through (Dawid,
         * 28.08, with screenshots).
         *
         * THREE SIZES, because the first diagnosis was that the staircase had
         * to be deep enough to push the border out of range \— and it was
         * wrong. A fixture that only tried one size would have agreed with it.
         */
        const scene = canvas?.scene;
        ok(scene, "no active scene");
        const g = scene.grid.size;
        const x0 = 200, y0 = 200, n = 8;

        for (const T of [1, 2, 3]) {
            const s = T * g, L = n * s;
            const points = [x0, y0];
            let x = x0, y = y0;
            for (let i = 0; i < n; i++) { x += s; points.push(x, y); y += s; points.push(x, y); }
            points.push(x0, y0 + L);

            let region = null, walls = [];
            try {
                region = (await scene.createEmbeddedDocuments("Region", [{
                    name: "Suite staircase fixture",
                    shapes: [{ type: "polygon", points }]
                }]))[0];
                ok(region, `could not place the ${T}-square fixture`);
                walls = (await scene.createEmbeddedDocuments("Wall", [
                    { c: [x0, y0, x0 + L, y0 + L] },        // the diagonal itself
                    { c: [x0 + L, y0 + L, x0, y0 + L] },
                    { c: [x0, y0 + L, x0, y0] }
                ])).map(w => w.id);

                const { checkRegions } = await import("./fog.mjs");
                const adrift = checkRegions().find(r =>
                    r.room === "Suite staircase fixture" && /walls/.test(r.problem));
                ok(!adrift, `a ${T}-square staircase does not see the wall drawn along it`
                    + `${adrift ? ` \— ${String(adrift.detail).match(/^[\d.]+/)?.[0]} squares read as open` : ""}`);
            } finally {
                if (walls.length) await scene.deleteEmbeddedDocuments("Wall", walls);
                if (region) await scene.deleteEmbeddedDocuments("Region", [region.id]);
            }
        }

        /*
         * AND THE TEST STILL HAS TEETH. A border with no wall on it has to keep
         * reading as open, or the repair above is just a way of never finding a
         * doorway again \— which would take every glow off every map and
         * pass this test twice as fast.
         */
        let bare = null;
        try {
            const L = n * g;
            bare = (await scene.createEmbeddedDocuments("Region", [{
                name: "Suite open fixture",
                shapes: [{ type: "polygon", points: [x0, y0, x0 + L, y0, x0 + L, y0 + L, x0, y0 + L] }]
            }]))[0];
            const { checkRegions } = await import("./fog.mjs");
            const adrift = checkRegions().find(r =>
                r.room === "Suite open fixture" && /walls/.test(r.problem));
            ok(adrift, "a room with no walls at all reads as walled");
        } finally {
            if (bare) await scene.deleteEmbeddedDocuments("Region", [bare.id]);
        }
    }],

    ["a motive counts down a time of day at a time, and a rewind gives it back", async () => {
        const { setMotive, motive, tickMotive, untickMotive } = await import("./rules.mjs");

        const record = await setMotive({
            text: "Suite fixture. Nobody has to do anything.",
            consequence: "Nothing.",
            timesOfDay: 3
        });
        ok(record, "the motive was not written");
        equal(motive()?.remaining, 3, "a fresh motive does not start at its full deadline");
        ok(!motive()?.due, "a fresh three-time-of-day motive reads as already due");

        await tickMotive();
        equal(motive()?.remaining, 2, "one time of day did not come off the deadline");

        // The rewind's half, checked directly rather than through the clock:
        // this is the arithmetic trap 104 is about, and it is worth failing
        // here rather than inside a clock move that does five other things.
        await untickMotive();
        equal(motive()?.remaining, 3, "a rewind did not give the time of day back");
        await untickMotive();
        equal(motive()?.remaining, 3, "a second rewind inflated the motive past what was bought");

        // Down to zero, and STAYING there — the countdown must not delete the
        // motive at the one moment it means something.
        await tickMotive();
        await tickMotive();
        await tickMotive();
        equal(motive()?.remaining, 0, "the deadline did not reach zero");
        ok(motive(), "the motive vanished at zero instead of coming due");
        ok(motive()?.due, "a motive at zero does not read as due");

        await tickMotive();
        equal(motive()?.remaining, 0, "the deadline went negative");

        await setMotive(null);
        ok(!motive(), "the motive could not be withdrawn");
    }],

    ["an assembly waits for the next time of day, and cancelling it is free", async () => {
        const { scheduleGather, pendingGather, cancelGather, runPendingGather } =
            await import("./call-effects.mjs");

        const room = canvas?.scene?.regions?.find(r => r.name)?.name;
        ok(room, "this scene has no named region to call an assembly in");

        const order = await scheduleGather(room, "Suite");
        ok(order, "the assembly was not written");
        equal(pendingGather()?.room, room, "the standing order names the wrong room");

        // NOT YET. The order was called in this time of day, and the whole
        // point of the change is that nobody moves until the clock does.
        const held = await runPendingGather();
        ok(!held, "the assembly was held in the time of day it was called in");
        ok(pendingGather(), "an unripe assembly was cleared anyway");

        await cancelGather();
        ok(!pendingGather(), "the assembly could not be called off");

        // Cancelling twice is a no-op rather than an error: the tile is drawn
        // from the same state, so a stale sheet can send the second one.
        ok(!await cancelGather(), "cancelling nothing reported that it cancelled something");
    }],

    ["a missed clue earns a second try only on Hope", async () => {
        /*
         * G-22. The advantage used to land on ANY failure, so a victim who
         * rolled badly and with Despair was paid for it exactly as well as one
         * who was merely unlucky — which is the one distinction the duality
         * die exists to make.
         */
        const [killer, victim] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();

        // A Despair miss: nothing earned.
        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: false
        });
        await settle();
        ok(!murder.murderState()?.advantageNext?.victim,
            "a Despair failure still earns the advantage G-22 takes away");

        // Back to the victim, and a Hope miss: earned.
        await drpg.passTurn();
        await settle();
        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "leaveClue", total: 2, isCritical: false, withHope: true
        });
        await settle();
        ok(murder.murderState()?.advantageNext?.victim,
            "a Hope failure no longer earns the second try");
    }],

    ["a critical Self-defence hands over one action, already open", async () => {
        /*
         * G-18, end to end: the grant appears, the turn is still the victim's
         * so it can be spent, spending it needs no dice, and it is gone
         * afterwards. The last one is the point — a grant that survived its
         * turn would be a permanent free Survive.
         */
        const [killer, victim] = cast();
        const drpg = game.drpg;
        const murder = await import("./murder.mjs");

        await drpg.openMurder({ killerId: killer.id, victimId: victim.id });
        await settle();
        await drpg.resolveKillerOpening({ total: 24, isCritical: false, withHope: true });
        await settle();

        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "selfDefence", total: 30, isCritical: true, withHope: true
        });
        await settle();

        let state = murder.murderState();
        ok(state?.unlocked?.includes("survive"), "the critical did not open Survive");
        ok(murder.freeResolutionFor("victim"), "the critical handed over no free action");
        equal(state.turnSide, "victim", "the turn passed, so the free action expired unused");

        // Taken, not rolled: total zero, no critical, and it still ends the
        // incident — which is what "without rolling" has to mean.
        await drpg.resolveCrisisAction({
            actorId: victim.id, key: "survive", total: 0, isCritical: false, withHope: true, free: true
        });
        await settle();

        state = murder.murderState();
        ok(!state || state.stage !== "incident", "a free Survive did not end the incident");
        ok(!murder.freeResolutionFor("victim", state), "the free action survived being spent");
    }],

    ["ending an Eclipse the way the game does carries its sound", async () => {
        /*
         * Dawid, at the table, 28.08: the Eclipse's ending sound never plays.
         * It was attached to `endEclipse({ advance: false })` — a branch nothing
         * in the game takes, because an Eclipse ends BY advancing the clock.
         *
         * So this drives the DEFAULT path and reads the card that came out.
         * `playSfx` is local and this suite has no audio files, so what is
         * checked is the flag that carries the sound to the people the message
         * reached — which is the module's whole mechanism for a sound with an
         * audience, and the thing that was missing.
         */
        const eclipse = await import("./eclipse.mjs");
        const before = new Set(game.messages.map(m => m.id));

        await eclipse.startEclipse();
        await settle();
        await eclipse.endEclipse();
        await settle();

        const fresh = game.messages.filter(m => !before.has(m.id));
        const carried = fresh.map(m => {
            const flag = m.getFlag(MODULE_ID, "sfx");
            return typeof flag === "string" ? flag : flag?.key ?? null;
        }).filter(Boolean);

        ok(carried.includes("eclipseEnd"),
            `no card carried the Eclipse's ending sound — got [${carried.join(", ")}]`);
    }],

    ["a trap watches, fires once, and never at its own builder", async () => {
        /*
         * The whole of E21 in one pass, driven through the events the game
         * actually raises rather than through the watcher's internals.
         *
         * Four things, and each of them is a trap from the plan:
         *   - a trap that is not finished yet does not watch
         *   - its own builder does not set it off (the modifier, default on)
         *   - somebody else does
         *   - and then it goes QUIET (trap 153), because a Main Hall watching
         *     for "somebody enters" would otherwise fire twenty cards a session
         *     and the GM would learn to skim exactly the one that mattered.
         */
        const P = await import("./projects.mjs");
        const T = await import("./traps.mjs");
        const { allRooms, othersInNamedRoom } = await import("./movement.mjs");

        const cast = game.actors.filter(a => a.type === "character");
        const killer = cast[0];
        const other = cast.find(a => a.id !== killer.id);
        ok(killer && other, "need two characters");

        // A room with nobody in it, so "alone" is a fact rather than a guess.
        const room = allRooms().find(r => othersInNamedRoom(r).length === 0) ?? allRooms()[0];
        ok(room, "need a room on this scene");

        const before = foundry.utils.deepClone(getSetting(SETTINGS.projectMeta) ?? {});
        let made = null;
        try {
            made = await P.createProject({
                name: "SUITE trap", target: 1, room,
                indirectMurder: true, killerId: killer.id, condition: "suite",
                trigger: { kind: "alone", afterDark: false, notBuilder: true }
            });
            ok(made?.id, "could not create the trap project");
            await settle();

            // 1. unfinished, so nothing is watching
            equal(T.diagnoseTraps().armed, 0, "a trap started watching before it was built");

            await P.addProgress(made.id, 1, { by: killer.id });
            await settle();
            equal(T.diagnoseTraps().armed, 1, "a finished trap did not start watching");

            // 2. its own builder
            let count = game.messages.size;
            Hooks.callAll("drpgRoomCrossed", { actor: killer, from: null, to: room });
            await settle();
            equal(game.messages.size, count, "the trap fired on the person who built it");

            // 3. somebody else, alone
            count = game.messages.size;
            Hooks.callAll("drpgRoomCrossed", { actor: other, from: null, to: room });
            await settle();
            ok(game.messages.size > count, "the trap did not fire on somebody else walking in alone");
            equal(T.diagnoseTraps().armed, 0, "the trap did not disarm itself after speaking");

            // 4. and it stays quiet
            count = game.messages.size;
            Hooks.callAll("drpgRoomCrossed", { actor: other, from: null, to: room });
            await settle();
            equal(game.messages.size, count, "the trap spoke twice for one event");
        } finally {
            if (made?.id) await P.deleteProject(made.id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, before);
            T.forgetArmedTraps();
            await settle();
        }
    }],

    ["a planted item is handed over once, and keeps the name the GM gave it", async () => {
        /*
         * Traps 165 and the identity problem, which are the two halves of the
         * fifth trigger.
         *
         * 165: the plant is returned INSTEAD of a draw and comes out of the room
         * as it is handed over. Dropped into the room's table it would be likely
         * rather than certain, and the killer would have paid a project's full
         * price for a lottery ticket.
         *
         * THE IDENTITY: an item moved between characters is deleted and created
         * again with a new document id, which is precisely the journey this trap
         * is about. So the ledger is keyed on a flag that travels — and the item
         * the search hands over has to keep the one the GM minted, or the trap
         * will never recognise its own poison.
         */
        const T = await import("./traps.mjs");
        const INV = await import("./inventory.mjs");
        const { allRooms } = await import("./movement.mjs");

        const room = allRooms()[0];
        const actor = game.actors.find(a => a.type === "character");
        ok(room && actor, "need a room and a character");

        const beforePlants = foundry.utils.deepClone(getSetting(SETTINGS.trapPlants) ?? {});
        const beforeLedger = foundry.utils.deepClone(getSetting(SETTINGS.trapLedger) ?? {});
        let granted = null;

        try {
            const identity = await T.plantItem("SUITE-project", room, {
                name: "SUITE planted kit", category: "healing", tier: 1
            });
            ok(identity, "nothing was planted");

            const first = await T.takePlant(room);
            equal(first?.drpgItemId, identity, "the first search did not get the planted item");

            const second = await T.takePlant(room);
            equal(second, null, "the room handed the same planted item out twice");

            // Into a bag, the way the Search path does it.
            granted = await INV.grantItem(actor, {
                name: first.name, category: first.category, tier: first.tier,
                extraFlags: { [INV.ITEM_FLAGS.identity]: first.drpgItemId }
            });
            equal(granted?.getFlag(MODULE_ID, INV.ITEM_FLAGS.identity), identity,
                "the planted item was renamed on its way into somebody's bag");
            equal(T.trapForItemId(identity), "SUITE-project",
                "the GM's ledger cannot find the trap this item belongs to");

            // And every OTHER item gets one too, which is what makes the flag a
            // name rather than a mark.
            const plain = await INV.grantItem(actor, { name: "SUITE plain thing", category: "healing", tier: 1 });
            ok(plain?.getFlag(MODULE_ID, INV.ITEM_FLAGS.identity),
                "an ordinary item has no identity, so the trap's one stands out");
            equal(T.trapForItemId(plain.getFlag(MODULE_ID, INV.ITEM_FLAGS.identity)), null,
                "an ordinary item is in the trap ledger");
            await plain.delete().catch(() => {});
        } finally {
            if (granted) await granted.delete().catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.trapPlants, beforePlants);
            await game.settings.set(MODULE_ID, SETTINGS.trapLedger, beforeLedger);
            await settle();
        }
    }],

    ["everything that can be held ready can also be broken", async () => {
        /*
         * FROM E17'S CLOSING LIST: "every EQUIPPABLE category has a breaking
         * path on Despair". The guide's rule is that a tool used on a Despair
         * roll breaks, and the module's answer is that nothing is ever deleted —
         * the same object stays in the bag marked Broken, so the player can see
         * what it cost them.
         *
         * A category that can be equipped and cannot be broken is a category
         * that never pays: a free permanent advantage nobody would notice was
         * free, because the only sign is a thing that never happens.
         *
         * Driven per category rather than read, because "can be broken" is three
         * facts at once — the flag lands, the item survives, and the equipment
         * machinery stops offering it.
         */
        const INV = await import("./inventory.mjs");
        const actor = studentActors()[0];
        ok(actor, "need a student");

        const made = [];
        try {
            for (const category of EQUIPPABLE) {
                const item = await INV.grantItem(actor, {
                    name: `SUITE ${category}`, category, tier: 1
                });
                ok(item, `could not make an item of category ${category}`);
                made.push(item);

                equal(INV.isBroken(item), false, `a fresh ${category} is already broken`);
                const broke = await INV.breakItem(item);
                ok(broke, `${category} refused to break`);
                ok(item.isOwner ? actor.items.get(item.id) : true,
                    `breaking a ${category} deleted it instead of marking it`);
                equal(INV.isBroken(item), true, `a broken ${category} does not say so`);
            }
        } finally {
            for (const item of made) await item.delete().catch(() => {});
            await settle();
        }
    }],

    ["a private card's words are not in the world at all", async () => {
        /*
         * Dawid, 28.08: make the architectural change.
         *
         * WHAT WAS MEASURED FIRST. A player's browser, freshly reloaded, held
         * 717 chat messages — exactly the GM's count — including every card it
         * was not a recipient of, content and all: "You lift SUITE loot out of
         * Player A's pocket. Nobody saw you do it." A whisper is a courtesy.
         * Foundry sends the message to everyone and hides it in the interface.
         *
         * So this asks the only question that matters, of the document that
         * every client is given: is the sentence in there? It must not be, and
         * the recipient must still be able to read it.
         */
        const SECRET = "SUITE the poison was in the second cup";
        const { whisperToOwner } = await import("./utils.mjs");
        const { secretHtml, diagnoseSecrets } = await import("./secret.mjs");
        const actor = studentActors()[0];
        ok(actor, "need a student");

        let card = null;
        try {
            card = await whisperToOwner(actor, `<p>${SECRET}</p>`);
            ok(card, "no card was posted");
            await settle();

            // What every client is handed.
            ok(!card.content.includes(SECRET),
                "the sentence is in the chat document, which every client receives");

            // What this client — a recipient, since GMs always are — can read.
            const mine = secretHtml(card);
            ok(mine?.includes(SECRET),
                "the recipient cannot read their own private card");

            // And the reader every render goes through agrees.
            const { contentOf } = await import("./secret.mjs");
            ok(contentOf(card).includes(SECRET), "contentOf does not return the words");

            // Nothing anywhere else in the log is leaking either.
            equal(diagnoseSecrets().leaking.length, 0,
                "a private card is carrying its own words in the document");
        } finally {
            if (card) await card.delete().catch(() => {});
            await settle();
        }
    }],

    ["a stash with something in it cannot be taken away", async () => {
        /*
         * E11's own criterion, and it only held in the dialog.
         *
         * Measured in E17 by calling the exported function the way a macro
         * would: the stash was removed, `stashItemsIn` still returned 1, and
         * nothing was said. The item stays flagged as stashed, so it is hidden
         * from its owner's sheet, in a room with no stash to take it out of.
         * A lost item, silently, and the only sign is a player asking where
         * their screwdriver went three sessions later.
         */
        const V = await import("./vault.mjs");
        const INV = await import("./inventory.mjs");
        const { roomOfActor } = await import("./movement.mjs");

        const actor = studentActors()[0];
        ok(actor, "need a student");
        const room = roomOfActor(actor);
        ok(room, `${actor?.name} is not standing in a room`);

        const had = Boolean(V.stashIn(room, actor.id));
        let item = null;
        try {
            if (!had) await V.setStash(room, actor.id, { present: true });
            await settle();

            item = await INV.grantItem(actor, { name: "SUITE stowed", category: "usable", tier: 1 });
            ok(await V.stow(actor, item), "could not put the thing in the stash");
            await settle();
            equal(V.stashItemsIn(actor, room).length, 1, "the thing did not go in");

            const refused = await V.setStash(room, actor.id, { present: false });
            await settle();
            equal(refused, null, "a stash holding something was removed");
            ok(V.stashIn(room, actor.id), "the stash is gone and the thing is still in it");

            // And an EMPTY one still goes, because that is the whole point of
            // the control.
            await V.retrieve(actor, item);
            await settle();
            equal(V.stashItemsIn(actor, room).length, 0, "could not take the thing back out");
            ok(await V.setStash(room, actor.id, { present: false }) !== null,
                "an empty stash refused to be removed");
        } finally {
            if (item) await item.delete().catch(() => {});
            if (had) await V.setStash(room, actor.id, { present: true }).catch(() => {});
            else await V.setStash(room, actor.id, { present: false }).catch(() => {});
            await settle();
        }
    }],

    ["topping up Hope lights the Calls it just paid for", async () => {
        /*
         * Dawid, 28.08: "I noticed it by filling in a player's Hope on the
         * sheet — the newly available Calls are still greyed out."
         *
         * WHY IT COULD NOT FIX ITSELF. A resource-only update deliberately SKIPS
         * the sheet render, because Daggerheart puts `transition: all` on the
         * sidebar and every redraw animated the whole left column. In its place
         * `repaintInPlace` draws by hand what the render would have drawn — and
         * the comment over `REPAINTABLE` says adding a resource there is a
         * promise that it does. `hope` was in the set and the function drew the
         * bar and the pips and stopped, so the one thing Hope actually decides
         * was the one thing left stale. Nothing was ever going to correct it.
         *
         * Driven through the real sheet, because that is the only place the two
         * halves meet: the value is in the actor, the greying is in the DOM, and
         * the bug lived precisely in the gap.
         */
        const actor = studentActors()[0];
        ok(actor, "need a student");
        const before = foundry.utils.getProperty(actor, "system.resources.hope.value") ?? 0;
        const max = foundry.utils.getProperty(actor, "system.resources.hope.max") ?? 6;

        try {
            await actor.update({ "system.resources.hope.value": 0 });
            await actor.sheet.render(true);
            await wait(900);

            const greyed = () => [...(actor.sheet.element
                ?.querySelectorAll(".drpg-hope-panel .drpg-action-grid > *") ?? [])]
                .filter(button => button.classList.contains("unaffordable")).length;
            const total = () => (actor.sheet.element
                ?.querySelectorAll(".drpg-hope-panel .drpg-action-grid > *") ?? []).length;

            ok(total() > 0, "the Hope drawer drew no Calls at all");
            const broke = greyed();
            ok(broke > 0, "nothing was greyed out at zero Hope, so this proves nothing");

            // The GM tops them up. NOBODY TOUCHES THE SHEET.
            await actor.update({ "system.resources.hope.value": max });
            await wait(900);

            ok(greyed() < broke,
                `Hope went 0 -> ${max} and ${greyed()} of ${total()} Calls are still greyed out`);
        } finally {
            await actor.update({ "system.resources.hope.value": before });
            try { await actor.sheet.close(); } catch { /* it may not have opened */ }
            await settle();
        }
    }],

    ["a sound that plays is never reported as unplayable", async () => {
        /*
         * Dawid, 28.08, from a live session: five warnings saying the file
         * "could not be played and will not be reported again this session" —
         * and four of those five sounds had just been heard at the table.
         *
         * The cause was a call to a function that does not exist. `bend(sound,
         * rate)` went with the rework that moved variation onto its own `Sound`
         * (a rate can only be set on a buffer node) and the call site stayed, in
         * the branch taken by every event that does NOT vary. The throw lands
         * inside a `.then`, after `AudioHelper.play` has already started the
         * sound, so the `.catch` reported the file while the table heard it. It
         * had been doing that since E14.
         *
         * A test that only asks "did it play" would have passed the whole time.
         * The question that catches it is the second one: did anything complain.
         */
        const { playSfx, diagnoseSfx } = await import("./sfx.mjs");
        const before = foundry.utils.deepClone(getSetting(SETTINGS.sfxMap) ?? {});

        // A file this install certainly has, and an event that does NOT vary —
        // which is the branch that was broken.
        const FILE = "modules/dice-so-nice/sounds/dicehit.mp3";
        equal(SFX_EVENTS.verdict?.vary ?? false, false,
            "this scenario needs an event that does not vary");

        try {
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, { ...before, verdict: FILE });
            await settle();

            const complainedBefore = (diagnoseSfx().unplayable ?? []).includes(FILE);
            ok(!complainedBefore, "this file was already written off before the test started");

            playSfx("verdict");
            await wait(900);

            ok(!(diagnoseSfx().unplayable ?? []).includes(FILE),
                "the module reported a file as unplayable and played it anyway");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.sfxMap, before);
            await settle();
        }
    }],

    ["a Monokuma leaves no track in the fog, and a student still does", async () => {
        /*
         * Dawid, 28.08: Monokuma tokens were uncovering rooms. They are the GM
         * wearing a token and they go everywhere, and the GM's own veil is the
         * UNION of every row in the discovery ledger — so a GM moving their own
         * token was uncovering the building for themselves, one corridor at a
         * time, and the fog stopped meaning "where the cast has been".
         *
         * DRIVEN THROUGH THE SEED rather than by dragging a token, and that is
         * deliberate: `seedDiscovery` records "the room you are standing in",
         * which is the same question `recordDiscovery` asks after a step and
         * carries the same skip. Moving a token in a test means fighting the
         * movement rules for the privilege of asking a question the seed
         * answers directly.
         *
         * BOTH HALVES. A fix that stops the ledger recording anything at all
         * would pass the first assertion and take the fog with it.
         */
        const fog = await import("./fog.mjs");
        const { roomOfActor } = await import("./movement.mjs");
        const { isMonokuma } = await import("./monokuma.mjs");

        const scene = canvas?.scene;
        ok(scene, "no scene to test the fog on");

        const standing = game.actors.filter(a =>
            a.type === "character" && roomOfActor(a));
        const monokuma = standing.find(a => isMonokuma(a));
        const student = standing.find(a => !isMonokuma(a));
        ok(monokuma && student,
            "need a Monokuma and a student standing in rooms on this scene");

        const before = foundry.utils.deepClone(getSetting(SETTINGS.discoveredRooms) ?? {});
        try {
            // Both rows emptied, so the seed has something to record and this
            // measures what it CHOOSES rather than what was already there.
            const wiped = { ...(before[scene.id] ?? {}) };
            wiped[monokuma.id] = [];
            wiped[student.id] = [];
            await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms,
                { ...before, [scene.id]: wiped });
            await settle();

            await fog.seedDiscovery(scene);
            await settle();

            const now = (getSetting(SETTINGS.discoveredRooms) ?? {})[scene.id] ?? {};
            equal((now[monokuma.id] ?? []).length, 0,
                `${monokuma.name} is a Monokuma and put ${JSON.stringify(now[monokuma.id])} in the ledger`);
            ok((now[student.id] ?? []).includes(roomOfActor(student)),
                `${student.name} is standing in ${roomOfActor(student)} and the ledger did not record it`);
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, before);
            await settle();
        }
    }],

    ["a tool takes its tier in bad rolls before it breaks", async () => {
        /*
         * Dawid, 28.08: a Despair no longer ends the tool outright. It spends
         * one point of durability, and only the point that fills it breaks the
         * thing. Tier 0 and 1 have one point, tier 2 two, tier 3 three.
         *
         * AND THE BREAK IS ON THAT ROLL, not on a later sweep: `breakItem`
         * empties the hand, so a tool that goes on its last point is out of
         * play from that moment. The old rule got round to it "after the
         * incident", which is a different moment and the wrong one.
         *
         * Driven through `wearItem` rather than through a real roll, because
         * what is being asked is the arithmetic and the hand — the roll's own
         * despair path has its own scenario, and one that needed a Despair to
         * come up would be a scenario that passes when the dice feel like it.
         */
        const INV = await import("./inventory.mjs");
        const { readiedItems } = await import("./use-items.mjs");
        const actor = game.actors.filter(a => a.type === "character")[0];
        ok(actor, "no character to hand a tool to");

        const made = [];
        try {
            for (const [tier, expected] of [[0, 1], [1, 1], [2, 2], [3, 3]]) {
                const item = await INV.grantItem(actor, {
                    name: `Suite durability tier ${tier}`,
                    category: "tool",
                    tier
                });
                ok(item, `could not make a tier ${tier} tool`);
                made.push(item);

                equal(INV.durabilityOf(item), expected,
                    `a tier ${tier} tool should take ${expected} bad roll(s)`);
                equal(INV.durabilityLeft(item), expected, "a fresh tool is already worn");

                await item.setFlag(MODULE_ID, "equipped", true);
                ok(readiedItems(actor).some(i => i.id === item.id),
                    "the fixture tool is not in hand to begin with");

                // Every point but the last: worn, still whole, still in hand.
                for (let i = 1; i < expected; i++) {
                    const step = await INV.wearItem(item);
                    ok(step && !step.broke,
                        `a tier ${tier} tool broke on bad roll ${i} of ${expected}`);
                    equal(INV.durabilityLeft(item), expected - i, "the wear did not add up");
                    ok(!INV.isBroken(item), "worn is not broken");
                    ok(readiedItems(actor).some(i2 => i2.id === item.id),
                        "a worn tool was taken out of the hand early");
                }

                // The last one.
                const last = await INV.wearItem(item);
                ok(last?.broke, `a tier ${tier} tool survived its ${expected}th bad roll`);
                ok(INV.isBroken(item), "the filling point did not break it");
                equal(INV.durabilityLeft(item), 0, "a broken tool still has durability left");

                // AND THE HAND IS EMPTY NOW, not after the incident.
                ok(!readiedItems(actor).some(i2 => i2.id === item.id),
                    "a broken tool is still being held ready");
                ok(!item.getFlag(MODULE_ID, "equipped"),
                    "a broken tool is still flagged as equipped");

                // Breaking what is broken changes nothing and says so.
                equal(await INV.wearItem(item), null, "a broken tool took more wear");

                // OUT OF THE BAG BEFORE THE NEXT ONE. Tools share a carry
                // limit, and four of them at once is a test of that limit
                // rather than of durability — the fourth was refused, which
                // read as "could not make a tier 3 tool".
                await actor.items.get(item.id)?.delete();
                made.pop();
            }
        } finally {
            for (const item of made) {
                const live = actor.items.get(item.id);
                if (live) await live.delete();
            }
        }
    }],

    ["a private card's notice carries its words, not the placeholder", async () => {
        /*
         * Dawid, 28.08: "Hope Call notices come up empty."
         *
         * THE STUB LANDS FIRST AND ALWAYS WILL. A private card keeps its words
         * off the world database (E17): the document carries a placeholder and
         * the text is addressed by socket. `postSecret` has to create the
         * message before it can send, because the id it keys the words with
         * does not exist until then — so on any client the document arrives,
         * `createChatMessage` fires, and the words are still in flight.
         *
         * The chat log survived that because it redraws the card in place when
         * they land. THE NOTICE IS DRAWN ONCE, so it drew the placeholder: an
         * empty card, on every private notice in the game, since v1.1.47.
         *
         * MEASURED THROUGH THE REAL PATH — `whisperToOwner`, a real card, the
         * notice's own DOM — because the two halves only meet on screen: the
         * words are in a client-side store, the emptiness was in the popup, and
         * every layer in between was working.
         */
        const { whisperToOwner } = await import("./utils.mjs");
        const secret = await import("./secret.mjs");
        const actor = game.actors.filter(a => a.type === "character")[0];
        ok(actor, "no character to whisper to");

        const before = document.querySelectorAll(".drpg-popup").length;
        const words = `Suite notice ${Date.now() % 100000}`;
        let message = null;
        try {
            message = await whisperToOwner(actor, `<h3>Suite probe</h3><p>${words}</p>`, {
                flags: { [MODULE_ID]: { popupTone: "hope", popupForce: true } }
            });
            ok(message, "the card was not posted");
            await wait(900);

            const cards = [...document.querySelectorAll(".drpg-popup")];
            ok(cards.length > before, "no notice appeared at all");
            const text = cards[cards.length - 1].innerText.replace(/\s+/g, " ");
            ok(text.includes(words),
                `the notice does not carry the card's words — it reads "${text.trim()}"`);

            // And the other half of the same rule: the DOCUMENT still says
            // nothing, or the privacy this is built on is gone.
            ok(String(message.content).includes("data-drpg-secret"),
                "a private card's words were written into the world after all");
            equal(secret.contentOf(message), `<h3>Suite probe</h3><p>${words}</p>`,
                "the words did not reach the client-side store");
        } finally {
            for (const card of [...document.querySelectorAll(".drpg-popup")].slice(before)) {
                card.dispatchEvent(new CustomEvent("drpg-dismiss"));
            }
            if (message) await message.delete();
        }
    }],

    ["every objection takes a different track from the objection playlist", async () => {
        /*
         * Dawid, 28.08, and he called it a must-have: an Objection must not only
         * put the objection playlist on, it must land on a DIFFERENT track.
         *
         * `playRandomTrack` was written for exactly this and says so in its own
         * note — "what makes a second Objection sound like a second Objection".
         * One line above the call stopped it happening: `crossfade` returned
         * early when the playlist it was asked for was already playing. An
         * Objection cutting into a rebuttal, and a second Objection in the same
         * exchange, both land on the state that is ALREADY playing — so the two
         * cases the feature exists for were the two it could never reach.
         *
         * MEASURED ON THE DOCUMENTS, not on the audio: the sandbox's audio
         * context is locked, so "what is playing" is read off the playlist's own
         * `playing` flags, which is what Foundry itself reads.
         */
        const music = await import("./music.mjs");
        const floor = await import("./trial-floor.mjs");

        /*
         * ITS OWN PLAYLIST, because the question is about the module and not
         * about whichever tracks this world happens to own. A world with one
         * track in its objection playlist cannot answer "did it take a
         * different one", and a scenario that quietly passes on such a world is
         * worse than no scenario.
         */
        const { SETTINGS, getSetting, setSetting } = await import("./settings.mjs");
        const mapBefore = foundry.utils.deepClone(getSetting(SETTINGS.musicMap) ?? {});

        const playlist = await Playlist.create({
            name: "Suite objection fixture",
            sounds: [
                { name: "Sting one", path: "sounds/lock.wav" },
                { name: "Sting two", path: "sounds/notify.wav" }
            ]
        });
        ok(playlist, "could not create the fixture playlist");
        ok(Array.from(playlist.sounds ?? []).length >= 2,
            "the fixture playlist did not take both tracks");
        await setSetting(SETTINGS.musicMap, { ...mapBefore, "trial.objection": playlist.id });

        const cast = game.actors.filter(a => a.type === "character").slice(0, 3);
        ok(cast.length >= 3, "need three characters");
        const [a, b, c] = cast;
        const before = foundry.utils.deepClone(getClock());
        const wasPaused = game.paused;

        const nowPlaying = () => Array.from(playlist.sounds ?? [])
            .filter(s => s.playing).map(s => s.id).sort().join(",");

        try {
            if (wasPaused) await game.togglePause(false);
            await setClock({ phase: "classTrial" });
            await floor.startFloor();
            await settle();

            await floor.openObjection(a.id, b.id);
            await settle();
            const first = nowPlaying();
            ok(first, "an objection started no track at all");

            /*
             * THROUGH THE REBUTTAL, because a second objection DURING an
             * objection is refused on purpose — an objection is one minute
             * alone, and the scenario below this one is what holds that rule.
             * Cutting into a rebuttal is the legal second objection, it is the
             * case Dawid reported, and it is the one that never left the
             * `trial.objection` state: exactly what the early return swallowed.
             */
            await floor.openRebuttal();
            await settle();
            equal(nowPlaying(), first,
                "a rebuttal changed the track; it is the same exchange and must not");

            const cut = await floor.openObjection(c.id, a.id);
            await settle();
            ok(cut, "a third party was refused an objection during a rebuttal");
            const second = nowPlaying();
            ok(second, "a second objection left the playlist silent");
            ok(second !== first,
                `both objections played the same track (${first}) — a second `
                + "objection has to sound like a second objection");
        } finally {
            await floor.endFloor();
            await setClock({ phase: before.phase });
            try { await playlist?.stopAll(); } catch { /* nothing was playing */ }
            await setSetting(SETTINGS.musicMap, mapBefore);
            if (playlist) await playlist.delete();
            await settle();
            if (wasPaused) await game.togglePause(true);
        }
    }],

    ["a rebuttal keeps the objection playing and can be cut into", async () => {
        /*
         * Two rulings from Dawid, 28.08, and they are one rule read from both
         * ends: an objection and the rebuttal it buys are ONE exchange.
         *
         *   - the music does not change at the sixty-second mark
         *   - somebody who is not in it may still object
         *
         * The second used to be refused in THREE places: the floor itself, the
         * courtesy check that tells a player why, and the target picker, which
         * narrowed to "your opponent" for everybody. Lifting one without the
         * others is the failure that would have looked like it worked — an
         * objection that lands and is aimed at the wrong half of the pair.
         */
        const floor = await import("./trial-floor.mjs");
        const { currentState } = await import("./music.mjs");

        const cast = game.actors.filter(a => a.type === "character").slice(0, 3);
        ok(cast.length >= 3, "need three characters to test a third party cutting in");
        const [a, b, c] = cast;
        const before = foundry.utils.deepClone(getClock());
        /*
         * AND THE WORLD HAS TO BE RUNNING. `currentState()` answers "paused"
         * over everything else while the game is paused — correctly: a table
         * on hold should not have trial music under it. A Foundry world boots
         * paused, so on a fresh server this scenario measured the pause and
         * reported that an objection never reached its own state.
         *
         * The same shape as R12 measuring the browser pane: a test whose answer
         * depends on the state it was handed rather than on the code.
         */
        const wasPaused = game.paused;

        try {
            if (wasPaused) await game.togglePause(false);
            await setClock({ phase: "classTrial" });
            // `startFloor` is what CREATES a floor; `returnToDiscussion` only
            // moves an existing one back. Without it every call below refuses
            // on `if (!floor) return null` and the trial never leaves
            // `trial.discussion`, which is the state for a trial with no floor
            // open at all — measured, and it is why this test failed first time.
            await floor.startFloor();
            await settle();

            await floor.openObjection(a.id, b.id);
            await settle();
            equal(currentState(), "trial.objection",
                "an objection did not reach its own music state");

            await floor.openRebuttal();
            await settle();
            equal(floor.trialFloor()?.mode, "rebuttal", "the floor did not move to a rebuttal");

            // 1. THE MUSIC. The objection's playlist simply keeps going.
            equal(currentState(), "trial.objection",
                "a rebuttal changed the playlist instead of letting the objection play on");

            // 2. THE THIRD PARTY, who is in neither half of this exchange.
            ok(!floor.maySpeak(c.id), "the third party should not be holding the floor");
            /*
             * AND WHO THEY MAY AIM AT (Dawid, 28.08, correcting the reading of
             * his own ruling). Cutting in is open to anybody; the TARGET is the
             * pair and nobody else, because an objection re-points the floor —
             * aiming a bystander at another bystander would take a rebuttal two
             * people earned and hand it to two who have not spoken.
             */
            const outsider = game.actors.filter(x => x.type === "character"
                && ![a.id, b.id, c.id].includes(x.id))[0];
            if (outsider) {
                const wrongAim = await floor.openObjection(c.id, outsider.id);
                ok(!wrongAim, "a bystander was allowed to aim a rebuttal objection "
                    + "at somebody who is not in it");
                equal(floor.trialFloor()?.mode, "rebuttal",
                    "the refused objection moved the floor anyway");
            }

            const cut = await floor.openObjection(c.id, a.id);
            await settle();
            ok(cut, "a third party was refused an objection during a rebuttal");
            equal(floor.trialFloor()?.holderId, c.id,
                "the floor did not re-point at whoever cut in");
            equal(floor.trialFloor()?.targetId, a.id,
                "the interrupter's objection landed on somebody they did not aim at");

            // 3. AND AN OBJECTION IS STILL ONE MINUTE ALONE.
            const second = await floor.openObjection(b.id, c.id);
            ok(!second, "an objection was allowed to interrupt another objection");
        } finally {
            await floor.endFloor();
            await setClock({ phase: before.phase });
            await settle();
            if (wasPaused) await game.togglePause(true);
        }
    }],

    ["an Eclipse takes every voice off the rooms", async () => {
        // The Eclipse is the placement window. A voice channel that still
        // followed the rooms while the lights were out would be the one thing
        // in the building that could see in the dark — you would hear who came
        // in with you, and hear the room empty when somebody left.
        const before = await voiceTargets();
        ok(!before.eclipse, "an Eclipse was already running before the test began");
        const placed = [...before.byUser.values()].filter(r => r.room);
        ok(placed.length, "nobody is standing in a room, so there is nothing to take away");

        await setClock({ ...getClock(), eclipse: true });
        await settle();

        const during = await voiceTargets();
        ok(during.eclipse, "the clock says no Eclipse is running");

        const rooms = new Set();
        for (const [userId, row] of during.byUser) {
            equal(row.room, null, `${game.users.get(userId)?.name} is still placed in a room`);
            ok(row.target, `${game.users.get(userId)?.name} was left on an open channel`);
            // A scene id in the name would leak which map, and a slug would leak
            // which region — the two things the darkness is hiding.
            ok(!row.scene, `${game.users.get(userId)?.name}'s assignment still names a scene`);
            rooms.add(row.target);
        }

        // Every connected account, including any that owns no character at all.
        const connected = game.users.filter(u => u.active).length;
        equal(during.byUser.size, connected, "somebody connected was not given an Eclipse channel");

        // One room each, so each holds one person. GMs deliberately share theirs.
        const players = [...during.byUser].filter(([id]) => !game.users.get(id)?.isGM);
        equal(new Set(players.map(([, r]) => r.target)).size, players.length,
            "two players were put in the same Eclipse channel");

        await setClock({ ...getClock(), eclipse: false });
        await settle();

        const after = await voiceTargets();
        ok(!after.eclipse, "the Eclipse did not end");
        equal([...after.byUser.values()].filter(r => r.room).length, placed.length,
            "the rooms did not come back when the lights did");
    }]
];

/* ==========================================================================
 * RUNNER
 * ========================================================================== */

/**
 * Is a run already in flight on this client?
 *
 * TWO RUNS AT ONCE CORRUPT THE WORLD, and quietly. Measured: a probe that
 * appeared to time out was still running when a second `runTests()` was
 * started, and the pair reported 16/22 with six murder scenarios failing on
 * "stage after opening — expected openingRoll, measured undefined". Not one of
 * those failures was real. The Eclipse scenario sets `clock.eclipse` true for
 * the length of its own check, and `openMurder` refuses outright during an
 * Eclipse — so every murder scenario in the other run was declined by a gate
 * working exactly as designed.
 *
 * The damage outlives the run. `snapshot()` records the clock as the baseline
 * to put back, and the second run took its snapshot while the first was mid-
 * Eclipse: it then faithfully restored the world to a darkness that was a
 * fixture. The world was left with `eclipse: true` set, which is a state a GM
 * cannot easily see and which silently refuses every murder in the session
 * after it.
 *
 * So a second run is refused rather than queued. Queueing would be the wrong
 * answer for a suite whose whole contract is "the world is put back exactly as
 * it was found" — a caller who did not know the first run was in flight does
 * not want the second one to happen later either; they want to be told.
 */
let inFlight = false;

/**
 * @param {object} [options]
 * @param {0|1|2} [options.tier]  0 reads the module's own source; 1 adds the
 *                                invariants; 2 also runs the scenarios.
 */
export async function runTests({ tier = 2 } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    if (inFlight) {
        const why = game.i18n.localize("DRPG.Tests.alreadyRunning");
        ui.notifications.warn(why);
        warn("Refused a second regression suite: one is already running on this client.");
        return { passed: 0, failed: 0, text: why, refused: true };
    }
    inFlight = true;
    // Every roll the scenarios make skips the configuration window — see
    // `suiteRolling` in action-rolls.mjs for why, and the scenario named "the
    // roll window opens, locked" for what still covers it.
    if (game.drpg) game.drpg.suiteRolling = true;
    try {
        return await runSuite(tier);
    } finally {
        if (game.drpg) game.drpg.suiteRolling = false;
        inFlight = false;
    }
}

async function runSuite(tier) {
    const lines = [];
    let passed = 0, failed = 0;

    const record = (name, err) => {
        if (err) {
            failed++;
            lines.push(`  FAIL  ${name}`);
            lines.push(`        ${err instanceof Failure ? err.message : `threw: ${err?.message ?? err}`}`);
        } else {
            passed++;
            lines.push(`  ok    ${name}`);
        }
    };

    // Tier 0 runs at every level, including `{ tier: 1 }` — the round-by-round
    // pass E17 makes on the way in and on the way out. It is the cheapest thing
    // in the suite to be wrong about and the most expensive to skip: a divergence
    // it would have caught costs four releases, not one run.
    lines.push("TIER 0 — module-wide regression (source is read, not called)");
    for (const [name, fn] of REGRESSIONS) {
        try { await fn(); record(name, null); } catch (err) { record(name, err); }
    }

    if (tier >= 1) {
        lines.push("");
        lines.push("TIER 1 — invariants (the world is not touched)");
        for (const [name, fn] of INVARIANTS) {
            try { await fn(); record(name, null); } catch (err) { record(name, err); }
        }
    }

    if (tier >= 2) {
        lines.push("");
        lines.push("TIER 2 — scenarios (fixtures built and put back)");
        let snap = null;
        try {
            snap = await snapshot(studentActors());
        } catch (err) {
            lines.push(`  FAIL  could not record the world before testing: ${err.message}`);
            failed++;
        }

        if (snap) {
            for (const [name, fn] of SCENARIOS) {
                try {
                    await fn();
                    record(name, null);
                } catch (err) {
                    record(name, err);
                } finally {
                    // After EVERY scenario, not once at the end: a scenario that
                    // fails half way leaves an incident open, and the next one
                    // would then be testing the wreckage of the last.
                    try {
                        await game.drpg.endMurder({ reason: "test", followUp: false });
                        await restore(snap);
                    } catch (err) {
                        lines.push(`        (could not restore after "${name}": ${err.message})`);
                    }
                }
            }
        }
    }

    const summary = `${passed} passed, ${failed} failed`;
    const text = [`Danganronpa RPG — regression suite`, summary, "", ...lines].join("\n");
    console.log(text);
    if (failed) ui.notifications.warn(summary);
    else ui.notifications.info(summary);
    log(`Regression suite: ${summary}`);
    return { passed, failed, text };
}
