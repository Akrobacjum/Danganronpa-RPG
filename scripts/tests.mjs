/**
 * Danganronpa RPG - the regression suite.
 * ---------------------------------------------------------------------------
 *     game.drpg.runTests()            everything
 *     game.drpg.runTests({ tier: 1 }) regressions + invariants, world untouched
 *     game.drpg.runTests({ tier: 0 }) the module-wide regression pass alone
 *
 * WHAT IS IN HERE AND WHY. Not "coverage" - the things that have actually been
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
 *   Tier 2 writes. It opens incidents, kills people and resets seasons - so it
 *          builds its own fixtures, records what it displaced, and puts
 *          everything back. Never run it in a world somebody is playing in.
 *
 * NO DICE. Every scenario drives the resolver directly with a total, because a
 * roll dialog needs a browser tab that is compositing frames and a suite that
 * only passes in a foreground window is a suite that fails in CI and in a
 * backgrounded tab for reasons that have nothing to do with the module.
 */

import { OVERFLOW } from "./config.mjs";
import { MODULE_ID, moduleVersion, CRISIS_ACTIONS, ACTIONS, TRAITS,
    ITEM_CATEGORIES, LIMIT_GROUPS, EQUIPPABLE, SFX_EVENTS, SFX_CATEGORIES,
    HOPE_CALLS, DESPAIR_CALLS, OBSERVE_DC, ANALYZE_DC, CLEANUP, CRITICAL, KEY_REMNANTS,
    FLAGS, PHASES, PRICE_CHAINS, RESOLUTION_STRESS_COST
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
        throw new Failure(`${message} - expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`);
    }
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

/* ==========================================================================
 * TIER 0 - MODULE-WIDE REGRESSION
 * ========================================================================== */

/**
 * WHY A THIRD TIER, AND WHY IT READS SOURCE INSTEAD OF CALLING FUNCTIONS.
 *
 * Look at which defects in this update surfaced LAST. Not one of them was bad
 * logic. Every one was a DIVERGENCE - code saying one thing and doing another,
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
 * first time it is inconvenient - so each one carries its bug in the comment.
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
 * reporting green. The crawl cannot have that hole - a file nothing imports is
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

/** The same, minus this file - which quotes every pattern it hunts for. */
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
    // this tier reported pointed at innocent code - `movement.mjs:629`, which is
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
 * Every name a file BINDS: imported, declared, destructured, taken as a
 * parameter. Generous on purpose - R22 reports what is in none of these, so
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
    // `[^()]*` pattern simply fails on it - which took the FUNCTION'S NAME down
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

/**
 * Names that are simply there, on any page, in any Foundry world.
 *
 * WINDOW'S OWN METHODS COUNT, CALLED BARE. `window` was in this list and
 * `addEventListener` was not, so the three places this module attaches a listener to the
 * window without writing `window.` - and the one `matchMedia` behind the reduced-motion
 * check - were reported as names the module calls and does not have. Two false accusations
 * in every run of the suite since R22 was written, which is exactly the noise that teaches
 * a person to stop reading a failure. `removeEventListener` and `dispatchEvent` are here
 * for the same reason ahead of time: this list over-collecting is only a miss, and under-
 * collecting is a lie.
 */
const AMBIENT = new Set(`
game ui canvas CONFIG CONST Hooks foundry console Handlebars PIXI jQuery
Object Array String Number Boolean Symbol Math JSON Promise Set Map WeakMap WeakSet
Date RegExp Error TypeError RangeError Proxy Reflect Intl BigInt Infinity NaN
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
queueMicrotask structuredClone fetch atob btoa alert confirm prompt open getComputedStyle
document window navigator location history localStorage sessionStorage performance crypto
addEventListener removeEventListener dispatchEvent matchMedia
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
    // first run of this reported were exactly that - a parameter named
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
        // Every arrow in the module read as one, so R21 saw nothing at all -
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
         * both-directions invariants. What this owns is the literal - which is
         * where the misses have actually been.
         */
        const missing = new Map();
        let checked = 0;
        for (const [file, raw] of await otherSources()) {
            const text = stripComments(raw);
            for (const m of text.matchAll(/"(DRPG\.[A-Za-z0-9_.]+)"/g)) {
                const key = m[1];
                // A key built by hand - `"DRPG.Clock." + slot` - is a PREFIX,
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
        ok(checked > 1000, `only ${checked} keys were read - the crawl is not reaching the module`);
        ok(!missing.size, `these keys print themselves at the table: ${
            [...missing].map(([k, w]) => `${k} (${w})`).join(", ")}`);
    }],

    ["R1b · no socket handler takes a character on somebody's word", async () => {
        /*
         * THE ONE INVARIANT THAT DECIDES WHETHER A PLAYER CAN ACT AS ANOTHER
         * PLAYER'S CHARACTER.
         *
         * `onSocket` is a chain of `if (payload.action === X)` branches, and
         * every branch that acts on `payload.actorId` has to establish two
         * things first: who really sent this (`senderOf(senderId)`, from
         * Foundry's own argument, which cannot be forged), and whether that
         * person owns the character named in the payload (`ownsActor`). The
         * payload's own `userId` is a claim and is only ever used as an address.
         *
         * Twenty-eight branches carry that preamble by hand today and all of
         * them are correct - measured, not assumed. What this test is for is
         * the twenty-ninth: a handler added in a hurry, three hundred lines
         * down a file nobody reads top to bottom, that takes an `actorId` and
         * simply uses it. Nothing about the module's behaviour would say so,
         * and the failure is a player moving somebody else's student.
         *
         * READ FROM SOURCE rather than exercised, because the thing being
         * checked is the SHAPE of a guard, not its outcome: a handler that
         * never runs in a test world is exactly the one most likely to be
         * missing it.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/gm-bridge.mjs`).then(r => r.text()));

        const from = src.indexOf("async function onSocket");
        ok(from > 0, "onSocket is not in gm-bridge.mjs any more");
        const after = src.slice(from + 10);
        const next = after.search(/^(?:export )?(?:async )?function /m);
        const body = next < 0 ? after : after.slice(0, next);

        const heads = [...body.matchAll(/if \(payload\??\.action === (\w+)\)/g)];
        ok(heads.length > 20,
            `only ${heads.length} socket branches were found - has onSocket been restructured?`);

        const unguarded = [];
        for (const [i, head] of heads.entries()) {
            const start = head.index;
            const end = i + 1 < heads.length ? heads[i + 1].index : body.length;
            const branch = body.slice(start, end);
            if (!/payload\.actorId/.test(branch)) continue;
            const checksSender = branch.includes("senderOf(senderId)");
            const checksOwner = /ownsActor\(sender/.test(branch);
            if (!checksSender || !checksOwner) unguarded.push(head[1]);
        }

        ok(!unguarded.length,
            `these socket handlers act on payload.actorId without checking that the `
            + `sender owns it: ${unguarded.join(", ")}`);
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
         * direction - "every class named in a script has a rule" - was built,
         * run, and dropped: 478 class names in the scripts, 133 of them with no
         * rule. Narrowed to the 173 that appear inside a `class="…"` attribute
         * it still reported 8, and all eight are structural: grid children that
         * take their placement from the parent (`drpg-tables-left`), wrappers
         * (`drpg-requirements`), live-region markers. A test that fails on those
         * is a test demanding the markup be made LESS readable - the same trap
         * as the E21 trigger test that demanded a worse implementation. So the
         * direction that measured zero and has real teeth is the one that runs.
         */
        const css = await moduleStyles();
        const inSheet = new Set([...css.matchAll(/\.(drpg-[a-z0-9-]+)/g)].map(m => m[1]));
        ok(inSheet.size > 200, `only ${inSheet.size} rules were read - the stylesheets did not load`);

        const named = new Set();
        const families = new Set();
        for (const [, raw] of await otherSources()) {
            for (const m of stripComments(raw).matchAll(/drpg-[a-z0-9-]*/g)) {
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
         * A typo there is silence - no error, no warning, and the failure looks
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
            // is almost even - 13 of the first, 12 of the second. Reading only
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
         * Test, hear it, map it - and then never hear it again, because the only
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
         * NOT BLINK. Not an exception, not a warning - the wrong answer,
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
        ok(used.size > 30, `only ${used.size} settings were seen - the crawl is not reaching the module`);

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
        // be private and simply forgot to say so is sent to every client - the
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
                /*
                 * 400, AND IT WAS 120 (Dawid, 29.08: the Truth Bullet sound).
                 *
                 * `createTruthBullet` refuses a non-GM in the ordinary way - a
                 * `warn`, a notification, `return null` - and then played the
                 * find with `playSfx`. This rule was written for exactly that
                 * and did not see it: at 120 characters the window closed
                 * before the `return`, because a guard that explains itself to
                 * the user is three lines long, not one. A real guard is the
                 * common case, so the window has to fit one.
                 */
                if (/if\s*\(\s*!\s*game\.user\??\.isGM\s*\)\s*(?:return|\{[^}]{0,400}return)/.test(body)) {
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
         * function that calls them - `sabotageProject` does the work itself when
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
                     * the second as unguarded on the first run - which is the
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
         * it reads that nobody writes is a Reroll that quietly does nothing -
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
        // context object (`{ room, category, goal }`) - both are writes.
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
         * chooses to show - so the entire murder mystery rests on one rule: what
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
         * slip - `secret` was specified as hiding the UI - and it is written
         * down here so the next reader does not think it got past this test.
         */
        // `analysis` is T-2's secret half. The published copy on an item is
        // spelled `analysisText` on purpose, so this name can be forbidden in
        // world data outright - and the one place it would land by accident is
        // the world-scoped Key Remnant plan.
        const FORBIDDEN = ["sourceActor", "realType", "pointsAt", "dc", "tiedToCrime", "analysis"];
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
         * FOUND BY MEASUREMENT, NEVER BY FAILURE - which is the whole argument
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
         * same time. So the machine checks the shape - every waiting request has
         * a bounded timeout that RESOLVES rather than rejects - and the live half
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
         * fault - and a horizontal scrollbar in a GM tool is merely annoying for
         * a year and then loses somebody a ruling mid-trial, because the column
         * they needed was off the right-hand edge.
         *
         * Opened for real and closed again. A window that refuses to open - no
         * incident, no trial in progress - is recorded rather than failed, but
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
                // with a Sound panel on screen and no way forward - measured,
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
                     * AND NOTHING INSIDE IT MAY PUSH SIDEWAYS EITHER - but the
                     * question is only meaningful of a box that can scroll.
                     *
                     * The first version asked it of every `form`, and reported
                     * seven windows that are perfectly fine: a form is not a
                     * scroll container, so a child sticking 16px past its
                     * padding box produces no scrollbar and nothing visible at
                     * all. One of the eight was real - the Monocub dialog, 1344
                     * of content in a 1273 scrollport - and it would have been
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
        ok(measured >= 10, `only ${measured} windows actually opened - this measured nothing`);
        ok(!wide.length, `these do not fit the screen: ${wide.join("; ")}`);
    }],

    ["R13 · every trigger a trap can name has something listening for it", async () => {
        /*
         * BOTH DIRECTIONS, and the second one is the reason this exists.
         *
         * A trigger with no listener is the worst shape a feature of this kind
         * can take: the GM picks it out of a list, the trap arms, and then
         * nothing ever happens - which looks exactly like a trap nobody walked
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
         * connected client gets it - which is the whole defect this update
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
         * The same button, because it is the same intention - what changes is
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
         * started and ended underneath them, came back BYTE-IDENTICAL - 2804 and
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
         * name - the same reasoning as `STANDING` above it.
         */
        const MUST_BE_LIVE = {
            openGmPanel: "gm-panel",
            openWhoIsAliveDialog: "gm-panel",
            openInvestigationDashboard: "investigation",
            manageClassTrial: "trial-floor-ui",
            // Added in E6, and for the reason the list exists: both used to
            // close and reopen themselves after every Hope donation, which took
            // the GM's scroll position and any unapplied ticks with it. They
            // are live now, and this is what stops that quietly coming back.
            openMonocubDialog: "monocub",
            openMastermindDialog: "mastermind"
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
             * ONE HOP, because the GM panel does it through `keepPanelFresh` -
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

        /*
         * AND IT WATCHES WHAT ITS CONTENT IS MADE OF. Reaching `keepLive` is
         * only half of staying true: the call names which documents wake it,
         * and a window built out of documents it does not name is live in the
         * diagnostics and stale on screen.
         *
         * Measured on 10.09. The case window reads Truth Bullets on all three
         * tabs - every "found by" is a bullet somebody holds - and watched
         * `{ actors: true }` alone. A player copied the Final Remnant down,
         * `createItem` fired, and the open dashboard went on saying "Nobody
         * has found it" with `refreshes: 0`, while a freshly opened copy said
         * the finder's name. The ledger write did not save it either: it is a
         * setting, and no `updateSetting` reached the listener.
         *
         * A rule rather than a named exception, so the next window that starts
         * reading bullets is covered on the day it does.
         */
        const blind = [];
        for (const file of new Set(Object.values(MUST_BE_LIVE))) {
            const text = stripComments(
                await fetch(`/modules/${MODULE_ID}/scripts/${file}.mjs`).then(r => r.text()));
            if (!/\bbulletsOf\(|\bsecretOf\(/.test(text)) continue;
            const watches = [...text.matchAll(/keepLive\(/g)].some(m => {
                const call = text.slice(m.index, m.index + 400);
                return /items:\s*true/.test(call);
            });
            if (!watches) blind.push(`${file}.mjs reads Truth Bullets and does not watch items`);
        }
        ok(!blind.length, blind.join("; "));

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
         * a dash - in the messenger, in a popup, in the GM's call thread.
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
                guilty.push(`${file}:${lineAt(text, m.index)} - ${m[0]}`);
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
         * gate and blind to the only question that mattered - who raises it.
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
         *   `updateSetting`        - a DOCUMENT hook. World settings only.
         *   `clientSettingChanged` - client settings, and its argument is the
         *                            full "namespace.key" id, not a document.
         *
         * A client-scoped setting is written straight to localStorage and never
         * becomes a Setting document, so `updateSetting` does not fire for it -
         * ever, on any client, including the one that made the write. Measured:
         * two writes to a world setting fired it twice; two writes to a client
         * setting fired it zero times.
         *
         * WHAT THAT COST. `sheet.mjs` dropped its Tamper cache on
         * `remnantSecrets` - client-scoped - so from E12 until here the sheet
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
                    wrong.push(`${file}:${lineAt(text, m.index)} - ${name} is ${scope}-scoped, `
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
         * call it; one line in the row builder was not, and `!anyCub` - a
         * function reference - is `false` forever. So for four releases every
         * row carried the three Monocub cells whether or not a Monocub existed,
         * under a heading that correctly showed three columns. Three headings
         * over six cells, in the window a GM works from most.
         *
         * Nothing catches this: it parses, it runs, it throws nothing, and the
         * branch it silently picks is the one that LOOKS busier rather than the
         * one that looks broken. It is also a mistake this module is now shaped
         * to keep making - every window that learns to stay live turns a
         * handful of locals into functions on the way.
         *
         * OUT OF SCOPE, deliberately: a name that is also a value somewhere in
         * the same file. The first run reported six and five were that - a
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
                    wrong.push(`${file}:${lineAt(text, at)} - \`${name}\` is a function here, `
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
         * called `debug(\u2026)` that the file never imported - an error handler
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
                wrong.push(`${file}:${lineAt(text, m.index)} - ${who}() is declared nowhere `
                    + "in this file and imported into it by nothing");
            }
        }
        ok(!wrong.length, wrong.join("; "));
    }],

    ["R23 \u00b7 a document hook that checks for a GM checks for THE GM", async () => {
        /*
         * A DOCUMENT HOOK FIRES ON EVERY CLIENT, so "am I a GM" is never the
         * right question in one - with two Gamemasters at this table it is
         * answered yes twice.
         *
         * The bidirectional Truth Bullet sync (v1.1.55) asked it that way. One
         * GM renaming a bullet had BOTH GM clients write the patch to the
         * trace, each then pushing it back down onto every copy, each syncing
         * the ledger to the other. One rename, two cascades, and the second one
         * arrives while the first is still writing.
         *
         * `isPrimaryGm` is how the rest of the module answers it - the trap
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
                wrong.push(`${file}:${lineAt(text, m.index)} - ${m[1]} fires on every client, `
                    + "so every GM runs this (use isPrimaryGm)");
            }
        }
        ok(!wrong.length, wrong.join("; "));
    }],

    ["R24 \u00b7 an action that swings a weapon knows which weapon it swung", async () => {
        /*
         * ATTACK WITH A WEAPON DID NOT (Dawid, 29.08: "the action does not
         * always work properly").
         *
         * `takeCrisisAction` captures the readied Crime Tool BEFORE the dice,
         * and three rules read what it captured: the Despair wear that can break
         * the thing mid-fight, the `swungWeapon` flag that tells Stage 6 which
         * tool to ruin, and the tie that turns the trace which handed the weapon
         * over into evidence of the murder.
         *
         * The capture was gated on `weaponAdvantage` - "holding something helps
         * here" - which Self-defence and Role reversal declare and Attack with a
         * weapon does not, because the guide gives that action a disadvantage
         * for being UNARMED instead. So the one action whose whole subject is
         * the weapon captured nothing, and all three rules read null.
         *
         * Read from the source, because the capture happens on the roll and the
         * suite resolves crisis actions from a stated total. What is checked is
         * that every marker the catalogue uses to mean "a weapon is involved in
         * this roll" is named in the condition that captures one - so a third
         * marker cannot arrive and be quietly left out the same way.
         */
        const sources = new Map(await otherSources());
        const murder = stripComments(sources.get("murder.mjs") ?? "");
        ok(murder.length > 1000, "murder.mjs did not load");

        const capture = murder.match(/const\s+swung\s*=([^;]*);/);
        ok(capture, "murder.mjs no longer captures a swung weapon at all");

        // Everything the condition can see: the line itself, and whatever it
        // reads from - `const swings = ...` above it.
        const condition = `${capture[1]} ${
            murder.match(/const\s+swings\s*=([^;]*);/)?.[1] ?? ""}`;

        const markers = new Set();
        for (const def of Object.values(CRISIS_ACTIONS)) {
            for (const key of ["weaponAdvantage", "weaponDamage"]) {
                if (def?.[key]) markers.add(key);
            }
        }
        ok(markers.size >= 2, `only ${markers.size} weapon marker(s) in the catalogue`);

        const missed = [...markers].filter(key => !condition.includes(key));
        ok(!missed.length,
            `an action marked ${missed.join(", ")} swings a weapon the roll never captured`);
    }],

    ["R25 · the action budget comes back when the Eclipse opens, and only there", async () => {
        /*
         * Z2 (E18b, wave 5). The refill used to sit in `endEclipse`, which is
         * the moment the NEXT time of day begins - so a Direct Murder, declared
         * in the dark and costing an action, was paid for out of the budget of
         * the day that had just finished. Moving it to the opening means the
         * declaration comes off the new allowance and the killer walks into the
         * time of day one action lighter.
         *
         * TWO HALVES, AND THE SECOND IS THE DANGEROUS ONE. Adding the refill to
         * `startEclipse` without taking it out of `endEclipse` hands the table
         * two budgets for one boundary, refunds the murder for free, and looks
         * on screen exactly like the change working. That is the failure this
         * test is for; the first half would have been noticed at the table
         * within a minute, and the second would not have been noticed at all.
         *
         * Read from the source, because both halves are single flags on calls
         * that need the world's clock moved to observe - and because a refill
         * running twice leaves no trace afterwards except a full bar, which is
         * also what a refill running once leaves.
         */
        const sources = new Map(await otherSources());
        const eclipse = stripComments(sources.get("eclipse.mjs") ?? "");
        ok(eclipse.length > 1000, "eclipse.mjs did not load");

        const startAt = eclipse.indexOf("export async function startEclipse");
        const endAt = eclipse.indexOf("export async function endEclipse");
        ok(startAt >= 0 && endAt > startAt, "eclipse.mjs no longer opens and closes an Eclipse");

        const opening = eclipse.slice(startAt, endAt);
        ok(/resetAllActions\s*\(/.test(opening),
            "the Eclipse no longer refills the action budget as it opens");

        // Anywhere in the file, not just in `endEclipse`: the point is that no
        // path through an Eclipse asks the clock for a second one.
        ok(!/resetActions\s*:\s*true/.test(eclipse),
            "something in the Eclipse still asks the clock for a refill as well");

        // The other half of Z2: the declaration has to cost something, or it
        // comes off no budget at all and the move above bought nothing.
        equal(ACTIONS.directMurder?.cost, 1,
            "a Direct Murder no longer spends an action, so it takes nothing from the "
            + "budget the Eclipse just handed out");
    }],

    ["R26 · a critical's Hope is paid once, by one payer", async () => {
        /*
         * A CRITICAL PAID THREE HOPE FOR A GUIDE THAT SAYS TWO, because two
         * mechanisms were implementing the same rule at once.
         *
         * The older one is despair-award: Daggerheart's pipeline paid 1, and
         * the chat-message hook topped it up to the guide's 2. The newer one is
         * critical.mjs, which wraps `addDualityResourceUpdates` so the funnel
         * itself pays `CRITICAL.hope` outright. Both were live, so a fresh
         * critical was paid 2 by the funnel and 1 more by the hook. Measured end
         * to end: Hope 0 -> 3 on one critical action.
         *
         * Read from the source rather than driven, for the reason the whole of
         * tier 0 exists: the symptom is a number that is quietly one too high,
         * and a scenario that rolls a critical needs dice and a browser that is
         * compositing frames. What can be stated exactly is which files are
         * allowed to pay.
         *
         * THE REROLL PATH IS THE EXCEPTION AND IT MUST SURVIVE. A reroll settles
         * its resources in Daggerheart's `updateResourcesForDualityReroll`,
         * which this module does not wrap, so the system pays its own single
         * point there and reroll.mjs owes the second. Deleting that call would
         * fix nothing and quietly underpay every rerolled critical.
         */
        const sources = new Map(await otherSources());
        const award = stripComments(sources.get("despair-award.mjs") ?? "");
        const critical = stripComments(sources.get("critical.mjs") ?? "");
        const reroll = stripComments(sources.get("reroll.mjs") ?? "");
        ok(award.length > 500 && critical.length > 500 && reroll.length > 500,
            "one of despair-award.mjs, critical.mjs or reroll.mjs did not load");

        // The funnel is the payer, and it pays the guide's number.
        ok(/addDualityResourceUpdates/.test(critical),
            "critical.mjs no longer wraps the duality resource step, so nothing pays "
            + "the guide's Hope at the funnel");
        ok(/CRITICAL\.hope/.test(critical),
            "critical.mjs no longer pays CRITICAL.hope, so the number lives in two places again");
        equal(CRITICAL.hope, 2, "the guide's critical is 2 Hope");

        /*
         * Nothing may top a fresh critical up on top of that. Scoped to the
         * chat hook's own body rather than the file: the module still exports
         * `adjustCritHopeTopUp` from here, because the reroll path below calls
         * it. What must not come back is this hook spending it.
         */
        const hookAt = award.indexOf("async function onChatMessage");
        ok(hookAt >= 0, "despair-award no longer has a chat-message hook to check");
        const after = award.slice(hookAt + 10);
        const nextFn = after.search(/^(?:export )?(?:async )?function /m);
        const hookBody = nextFn < 0 ? after : after.slice(0, nextFn);
        ok(!/CritHope/.test(hookBody),
            "the chat-message hook is paying a critical's Hope again; the funnel in "
            + "critical.mjs already pays it in full, and both together hand out three");

        // The one path that still owes a point keeps owing it.
        ok(/adjustCritHopeTopUp/.test(reroll),
            "reroll.mjs no longer settles the second Hope for a crit reached by rerolling, "
            + "which the funnel never sees");
    }],

    ["R21 - the chapter ends by closing the trial, and the panel can say so", async () => {
        /*
         * THE LOOP DID NOT CLOSE, and every part of that was one line missing.
         *
         * Measured on 10.09 by driving a whole chapter end to end: pressing "End of
         * chapter / new session" moved the clock to chapter 2 and left the campaign in
         * `phase: "classTrial"` with the debate floor open. The GM panel then said "The
         * debate is open - Nonstop Debate." and pointed back at the trial they had just
         * finished; every player's HUD read "Chapter 2 - Day 2 - Class Trial".
         *
         * The way out had existed all along - `closeTrial`, reachable from one button
         * listed BELOW the chapter-end one on the trial console - and `setPhase
         * ("dailyLife")` still has no other caller in the module, which is why this
         * reads for the call by name rather than for a phase string: there is exactly
         * one route back to ordinary play and this is the test that it is wired to the
         * screen that needs it.
         */
        const sources = new Map(await otherSources());
        const chapter = stripComments(sources.get("chapter.mjs") ?? "");
        const panel = stripComments(sources.get("gm-panel.mjs") ?? "");
        const ui = stripComments(sources.get("trial-floor-ui.mjs") ?? "");

        ok(/export async function closeTrial\s*\(/.test(ui),
            "trial-floor-ui.mjs no longer exports `closeTrial`, so nothing but its own "
            + "button can put the room back into Daily Life");
        ok(/name="endTrial"/.test(chapter),
            "the End of chapter screen has lost the checkbox that offers to close the "
            + "trial, so the step below can only be reached from the console");
        ok(/trialProgressChapter/.test(panel),
            "nextStep() can no longer see a trial that has outlived its chapter, which "
            + "is the state it used to answer with \"the debate is open\"");

        /* WHETHER THE CALL IS REACHABLE IS NOT A QUESTION FOR A SOURCE READ, and this
           test claimed to answer it until the claim was checked. Breaking the wiring
           by hand - `if (false && result.endTrial ...)` - left the word `closeTrial`
           sitting in the file, so the grep passed and the suite stayed green over a
           defect it was written for. The behaviour is owned by "the End of chapter
           screen closes the trial" in Tier 1, which calls it. */
    }],

    ["R27 - the state colour's sweep has no specificity to win with", async () => {
        /*
         * A ONE-SECOND STALL ON EVERY WINDOW, WITH NOTHING ON SCREEN TO SAY SO (SG-CLOSE-1000).
         *
         * The Stained Glass accent fade hangs on every direct child of the body, and every
         * window is one. Written as `:not(#a):not(b)` it carried two ids, beat the module's own
         * exit transition and left ApplicationV2#close waiting out its 1000 ms fallback -
         * measured at 1017-1113 ms per close on 16.09, which is what made every GM panel tile
         * open its window a second late. This reads the rule back.
         */
        const css = (await fetch(`/modules/${MODULE_ID}/styles/stained-glass.css`).then(r => r.text()))
            .replace(/\/\*[\s\S]*?\*\//g, " ");
        const block = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
            .find(m => /transition-property:\s*--drpg-glass-accent\s*;/.test(m[2])
                && /^\s*body\.drpg-theme-stained-glass\s*>/.test(m[1]));
        ok(block, "the accent sweep over the body's children is gone, so this test cannot find what to read");
        const selector = block[1].trim();
        ok(/>\s*:where\(/.test(selector),
            `the accent sweep's exclusions count towards its specificity again: ${selector}`);
        ok(/\.minimizing/.test(selector) && /\.maximizing/.test(selector),
            "the accent sweep reaches a window that is closing or minimising, and replaces the transition "
            + "ApplicationV2 waits for");
    }],

    ["R28 - \"Move the clock on\" runs the Eclipse", async () => {
        /*
         * GMP-01, reproduced on 16.09: with every student on 0 actions the panel's Do it opened
         * Edit campaign, and applying a new time of day there refills nothing. The Eclipse is the
         * one road that refills.
         */
        const panel = stripComments(new Map(await otherSources()).get("gm-panel.mjs") ?? "");
        ok(/"DRPG\.Panel\.nextAllDone"\)\s*,\s*action:\s*"eclipse"/.test(panel),
            "the \"Everyone has spent their actions\" suggestion no longer runs the Eclipse");
    }],

    ["R29 - a body is this chapter's dead, discovered once, and never gathered", async () => {
        /*
         * FIVE CARDS FOR ONE BODY, AND A CORPSE CARRIED INTO THE ASSEMBLY (16.09).
         *
         * A teleport fired one discovery check per token, and every check got past a flag set
         * after three awaited imports; the gather itself moved the undiscovered body in front
         * of everybody. Measured live: fixed, then reviewed - the GM's own announcement had to
         * join the queue, a Monocub had to stop counting as a body, and so did an earlier
         * chapter's dead. Behaviour was verified in the sandbox; this keeps the wiring.
         */
        const sources = new Map(await otherSources());
        const chapter = stripComments(sources.get("chapter.mjs") ?? "");
        const effects = stripComments(sources.get("call-effects.mjs") ?? "");
        const check = chapter.slice(chapter.indexOf("async function checkBodyFound"),
            chapter.indexOf("export async function openBodyDiscoveryDialog"));
        ok(check.length > 200, "checkBodyFound is gone or has moved past openBodyDiscoveryDialog");
        ok(/FLAGS\.monocub/.test(check), "a Monocub counts as a body again");
        ok(/deathRecord\(/.test(check), "a body from an earlier chapter counts as a body again");
        ok(/export function discoverBody[\s\S]{0,240}enqueueBodyWork\(/.test(chapter),
            "the GM's own announcement no longer waits in the discovery queue");
        ok(/export function maybeBodyFound[\s\S]{0,240}enqueueBodyWork\(/.test(chapter),
            "the automatic discovery check no longer waits in the discovery queue");
        const gather = effects.slice(effects.indexOf("export async function gatherEveryone"),
            effects.indexOf("async function fallbackGather"));
        ok(/isDeceased\(/.test(gather), "gatherEveryone moves the dead again");
    }],

    ["R30 - a verdict is locked before it does anything", async () => {
        /*
         * F2, and the review that followed it. The lock used to be written after every Level Up
         * window and the Blackened's rule had closed, so a second verdict could start in the
         * meantime. The check and the write have to come before the first execution.
         */
        const vote = stripComments(new Map(await otherSources()).get("vote.mjs") ?? "");
        const apply = vote.slice(vote.indexOf("export async function applyVerdict"));
        const lock = apply.indexOf("verdictApplied: true");
        const kill = apply.indexOf("killCharacter(");
        ok(lock > 0 && kill > 0, "applyVerdict no longer writes the lock or no longer executes anybody");
        ok(lock < kill, "applyVerdict executes before it writes the verdict lock");
        ok(apply.indexOf("trialProgress().verdictApplied") > 0
            && apply.indexOf("trialProgress().verdictApplied") < lock,
            "applyVerdict no longer refuses a second verdict itself");
    }],
    ["R31 - Room Setup's Apply writes only what the GM changed, and refuses before writing", async () => {
        /*
         * ROOM-01, ROOM-02 and ROOM-03 (17.09). Apply wrote the Fog tab's open-time
         * snapshot over the scene's whole ledger, so rooms found while the window was
         * open fogged over again; the one-bedroom check ran after that write and then
         * dropped every other edit; and Discover all / Hide all wrote at once from any
         * tab. What they did was verified in the sandbox; this keeps the wiring.
         */
        const sources = new Map(await otherSources());
        const vault = stripComments(sources.get("vault.mjs") ?? "");
        const fog = stripComments(sources.get("fog.mjs") ?? "");
        const open = vault.slice(vault.indexOf("export async function openRoomSetupDialog"));
        ok(open.length > 1000, "openRoomSetupDialog is gone");
        ok(!/saveDiscoveryMatrix/.test(vault + fog), "the whole-matrix fog write is back");
        ok(/defaultChecked/.test(open),
            "the Fog tab no longer compares a box with what the window drew, so every box is a decision again");
        const claim = open.indexOf("claimed.set(");
        const write = open.indexOf("applyDiscoveryChanges(scene");
        ok(claim > 0 && write > claim, "the fog is written before the one-bedroom check can refuse the Apply");
        ok(/action:\s*"discoverAll",\s*type:\s*"button"/.test(open)
            && /action:\s*"hideAll",\s*type:\s*"button"/.test(open),
            "Discover all / Hide all submit the window again, which throws away the other tabs' edits");
        // `type: "button"` is not enough on its own: DialogV2 makes every entry in
        // `buttons` an action, so the click has to stop before the window hears it.
        const bulk = open.slice(open.indexOf("fogButtons"), open.indexOf("wireDashboardTabs(root"));
        ok(/stopPropagation\(\)/.test(bulk),
            "Discover all / Hide all let the click reach DialogV2, which closes the window on it");
    }],

    ["R32 - the case dashboard saves the rows on screen, and a plan row only when it was edited", async () => {
        /*
         * F1: a trace the filter hides has no inputs, and Save wrote its blanks over it.
         * F6: Save pushed the Key plan's old name back over a rename on the Traces tab.
         */
        const inv = stripComments(new Map(await otherSources()).get("investigation.mjs") ?? "");
        ok(/if\s*\(!q\(`name\.\$\{key\}`\)\)\s*return null;/.test(inv),
            "the dashboard's Save reads a row the filter is hiding as blanks again");
        const plan = inv.slice(inv.indexOf("async function saveKeyPlan"), inv.indexOf("function stripDraft"));
        ok(plan.length > 200, "saveKeyPlan is gone or has moved past stripDraft");
        ok(/repointed/.test(plan) && /stored\.name/.test(plan),
            "a Key plan row is pushed onto its trace whether or not anybody edited it");
    }],

    ["R33 - no action pays for its roll after the dice", async () => {
        /*
         * ACT-07 (17.09). Seven actions charged after the roll and ignored a refused
         * charge, so one action bought as many results as there were windows open.
         */
        const rolls = stripComments(new Map(await otherSources()).get("action-rolls.mjs") ?? "");
        ok(!/if\s*\(cost\s*>\s*0\)\s*await spendAction\(/.test(rolls),
            "an action charges without reading whether the charge went through");
        ok(!/if\s*\(!options\.free\)\s*await spendAction\(/.test(rolls),
            "a Dynamic action charges without reading whether the charge went through");
        for (const m of rolls.matchAll(/spendAction\(actor,\s*cost\)/g)) {
            ok(/^[^;]*;\s*if\s*\(cost\s*>\s*0\s*&&\s*!paid\)\s*return null;/.test(rolls.slice(m.index, m.index + 120)),
                `a spendAction(actor, cost) at offset ${m.index} ignores its answer`);
        }
        // And what a closed window refunds is the receipt it paid with.
        ok(!/abort\(actor,\s*cost\b/.test(rolls.replace(/async function abort\(/, "")),
            "an abort refunds by amount again instead of by the receipt of what paid");
    }],

    ["R34 - a planted item is taken only by a Search that found something", async () => {
        /*
         * ACT-03 (17.09). The GM took the plant out of the room on every token spend,
         * before anybody knew what the dice said; a failed Search used it up and the
         * next successful one in any room was handed it.
         */
        const sources = new Map(await otherSources());
        const tokens = stripComments(sources.get("search-tokens.mjs") ?? "");
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        const from = tokens.indexOf("payload.action === ACTION_SPEND");
        const to = tokens.indexOf("payload.action === ACTION_TAKE_PLANT");
        ok(from > 0 && to > from, "the spend and plant socket branches are gone or reordered");
        ok(!/takePlant/.test(tokens.slice(from, to)), "the token spend takes the plant out of the room again");
        ok(/searchedBy\.get\(/.test(tokens.slice(to, to + 800)),
            "a player can ask for a plant in a room they never spent a token in");
        const search = rolls.slice(rolls.indexOf("async function performSearch"));
        const take = search.indexOf("SearchTokens.takePlant(");
        ok(take > 0, "the Search no longer asks for a plant");
        for (const marker of ['goalKey === "specific"', "!hit && !roll.isCritical", "if (stashLoot.length)"]) {
            const at = search.indexOf(marker);
            ok(at > 0 && at < take, `the plant is taken before the ${marker} branch can end the Search`);
        }
    }],

    ["R35 - the Eclipse ends what was bought for the time of day, and the refill box only refills", async () => {
        /*
         * CALL-09: seals, chains and Silence outlived the Eclipse that ends their time of
         * day. GMP-02: "Also refill actions and search tokens" ran the whole boundary -
         * the motive, the seals, the overflow and a public card.
         */
        const sources = new Map(await otherSources());
        const eclipse = stripComments(sources.get("eclipse.mjs") ?? "");
        const at = eclipse.indexOf("export async function startEclipse");
        const start = eclipse.slice(at, eclipse.indexOf("\nexport ", at + 10));
        ok(at > 0 && /clearSeals\(\)/.test(start), "the Eclipse opens with the seals and restrictions still on");
        const panel = stripComments(sources.get("gm-panel.mjs") ?? "");
        ok(!/setTimeOfDay\(/.test(panel), "Edit campaign runs the whole time-of-day boundary again");
    }],

    ["R36 - the GM side judges a plant and a Tamper by the rules the player's menu used", async () => {
        /*
         * ACT-01: the plant was judged against the steal thresholds. ACT-02: Tamper
         * refused every trace somebody else had left, after the menu offered it.
         */
        const sources = new Map(await otherSources());
        const vault = stripComments(sources.get("vault.mjs") ?? "");
        const at = vault.indexOf("export async function plantOnPerson");
        const plant = vault.slice(at, vault.indexOf("\nexport ", at + 10));
        ok(at > 0 && /def\.plant\?\.threshold/.test(plant) && /def\.plant\?\.unseen/.test(plant),
            "a plant is judged against the steal thresholds again");
        const cleanup = stripComments(sources.get("cleanup.mjs") ?? "");
        ok(!/viaAction\s*&&\s*data\.sourceActor\s*!==\s*actor\.id/.test(cleanup),
            "Tamper refuses a trace somebody else left again, after its menu offered it");
        ok(/data\.type\s*===\s*"incident"\s*&&\s*incidentParticipant\(actor\)/.test(cleanup),
            "the resolver's incident exemption no longer matches the menu's");
    }],

    ["R37 - a closed Tamper window after a landed concealment roll refunds nothing", async () => {
        /*
         * Review of ACT-04 (17.09). `concealFromWitnesses` ended with `return true`, the
         * callers refused a refund only for "rolled", and so the concealment roll's Hope
         * came with the action back. A killer on their own night paid nothing at all.
         *
         * REWRITTEN FOR T-1's SHAPE. The price is taken AFTER the concealment now, so
         * the rule is no longer "charge the Sanity in the refund" - it is "keep what was
         * paid and take nothing else". Written against the old names this test passed
         * vacuously: `indexOf` returned -1, `slice(-1)` handed it one character, and
         * both assertions were about an empty string.
         */
        const cleanup = stripComments(new Map(await otherSources()).get("cleanup.mjs") ?? "");
        const at = cleanup.indexOf("async function concealFromWitnesses");
        const conceal = cleanup.slice(at, cleanup.indexOf("\nasync function ", at + 10));
        ok(at > 0 && /return "rolled";/.test(conceal) && !/return true;/.test(conceal),
            "concealFromWitnesses no longer tells its callers a concealment roll landed");

        const from = cleanup.indexOf("async function releaseTamper");
        ok(from > 0, "nothing releases a Tamper price when its window is closed");
        /*
         * Bounded by the next DECLARATION, not by a character count and not by a
         * comment: `stripComments` blanks a comment to spaces rather than deleting
         * it, so there is no "/**" left to look for - and 900 characters runs into
         * `stageSixDef`, which asks `isCleaner` for its own good reasons.
         */
        const rest = cleanup.slice(from + 10);
        const next = rest.search(/\n(?:export |async function |function )/);
        const release = rest.slice(0, next < 0 ? 900 : next);
        const kept = release.slice(release.indexOf("if (rolled)"), release.indexOf("if (charge)"));
        ok(kept.length > 20 && !/refundPrice\(/.test(kept),
            "a closed window after a landed concealment roll hands the price back again");
        ok(!/spendStress\(/.test(release),
            "the kept charge is charged a second time - the price was taken before the roll");
        ok(!/isCleaner\(/.test(release),
            "the release asks isCleaner again instead of reading what was paid");
    }],

    ["R40 - no action can be withdrawn from after the roll for who can see you", async () => {
        /*
         * Dawid, 18.09. Sabotage used to ask "carry on anyway? nothing is spent yet"
         * after a failed, public concealment roll and hand the action back - while that
         * roll had already paid out its Hope, or a Monokuma's Despair. No action may
         * offer that question now, and none may refund an action once a roll for it
         * has landed (see `abort`'s `rolled`).
         */
        const sources = new Map(await otherSources());
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        const cleanup = stripComments(sources.get("cleanup.mjs") ?? "");
        for (const [file, src] of [["action-rolls.mjs", rolls], ["cleanup.mjs", cleanup]]) {
            ok(!/DialogV2\.confirm\([\s\S]{0,400}?(carryOn|CarryOn)/.test(src),
                `${file} asks whether to carry on after a concealment roll again`);
        }
        ok(!/sabotageCarryOn/.test(rolls), "the walk-away question is back in Sabotage");
        const sabotage = rolls.slice(rolls.indexOf("async function performSabotage"),
            rolls.indexOf("async function performTamper"));
        ok(sabotage.length > 400, "performSabotage is gone or has moved past Tamper");
        // Only the branch the room watched. The concealment roll's own cancel still
        // refunds - nothing was rolled there - and that is `abort` further up.
        const watched = sabotage.slice(sabotage.indexOf("sabotageWatched"));
        ok(!/^[\s\S]{0,700}?abort\(/.test(watched),
            "a watched Sabotage hands the action back again instead of going ahead");
    }],

    ["R39 - the unfound-Key charge counts every Key Remnant that was found", async () => {
        /*
         * F18, Dawid 17.09. "No slot" is the only option once five rows are filled, and
         * such a trace is a real Key clue - but the count that bills Despair read the
         * plan's rows only, so a table that found one off the plan was billed as though
         * it had never reached the trial.
         */
        const inv = stripComments(new Map(await otherSources()).get("investigation.mjs") ?? "");
        const status = inv.slice(inv.indexOf("export function keyPlanStatus"), inv.indexOf("export async function chargeForUnfoundKeys"));
        ok(status.length > 400, "keyPlanStatus is gone or has moved past the charge");
        ok(/offPlan/.test(status) && /foundAny/.test(status),
            "keyPlanStatus counts the plan's rows only again");
        const charge = inv.slice(inv.indexOf("export async function chargeForUnfoundKeys"));
        ok(/unfoundBar - status\.foundAny/.test(charge),
            "the charge reads the plan's own rows instead of every Key Remnant found");
    }],

    ["R38 - the Loaded Die rides the roll it was bought for", async () => {
        /*
         * CALL-03 and its review (17.09). The 12 was armed for the whole client, so a
         * statistic rolled off the sheet while the action's window was open took it and
         * the Call stayed bought. Measured after the change: six rolls with the marker
         * all came up 12 on one die, six without it did not.
         */
        const sources = new Map(await otherSources());
        const forced = stripComments(sources.get("forced-roll.mjs") ?? "");
        const dialog = stripComments(sources.get("roll-dialog.mjs") ?? "");
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        ok(!/let armed\b/.test(forced) && !/armOneMaximum/.test(rolls),
            "the Loaded Die is armed for the whole client again");
        ok(/function onConfigured\(roll,\s*config\)[\s\S]{0,80}LOADED_DIE/.test(forced),
            "the dice hook no longer asks the roll whether it carries the Loaded Die");
        ok(/\[LOADED_DIE\]:\s*armed\??\.nonce/.test(rolls),
            "throwDice no longer marks the roll with the purchase it was bought with");
        ok(/spent\.has\(mark\)/.test(forced), "one Loaded Die can load every roll window opened while it was held");
        const grants = dialog.slice(dialog.indexOf("function grantsFor"));
        ok(/LOADED_DIE/.test(grants.slice(0, 400)),
            "the roll window shows or spends the Loaded Die on a roll that does not carry it");
    }],

    ["R42 - the trial gate sits below the guards that outrank it", async () => {
        /*
         * ORDER IS THE RULE HERE, not the presence of a line (T-1). A trial gate
         * placed beside the Eclipse refusal would tell somebody in a fight, and a
         * corpse, that the Class Trial is why they cannot act - a true sentence
         * answering a question nobody asked. The first draft of the spec for this
         * had it that way round, so the order is pinned here rather than left to a
         * reader's memory.
         *
         * Comments are stripped first, or this would read its own subject out of
         * the paragraph that explains it.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/action-rolls.mjs`).then(r => r.text()));
        const start = src.indexOf("export async function performAction");
        ok(start > 0, "performAction is no longer where this test looks for it");
        const body = src.slice(start, src.indexOf("const def =", start) + 40);

        const gate = body.indexOf('"classTrial"');
        const fight = body.indexOf("DRPG.Murder.actionsLocked");
        const dead = body.indexOf("DRPG.Chapter.deadCannotAct");
        const dispatch = body.indexOf("const def =");
        ok(gate > 0, "performAction no longer refuses anything during a Class Trial");
        ok(/actionKey !== "analyze" && getClock\(\)\.phase === "classTrial"/.test(body),
            "the trial gate no longer keeps Analyze open, which is the one tile it must");
        ok(fight > 0 && dead > 0, "the fight or the death refusal moved out of performAction");
        ok(gate > fight && gate > dead,
            "the trial gate rose above the fight or the death check, which outrank it");
        ok(gate < dispatch, "the trial gate fell below the dispatch it is there to stop");

        // The courtroom is locked ABOVE the movement economy: a GM who turned the
        // crossing cost off did not turn off the trial.
        const move = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/movement.mjs`).then(r => r.text()));
        const cross = move.slice(move.indexOf("function canCross"));
        const locked = cross.indexOf('"classTrial"');
        const charged = cross.indexOf("SETTINGS.chargeMovement");
        ok(locked > 0, "a crossing is no longer refused during a Class Trial");
        ok(locked < charged,
            "the courtroom lock fell below `chargeMovement`, so turning the cost off opens the door");

        /*
         * AND THE ASYMMETRY IS THE DECISION (Dawid, 17.09): Despair Calls wait for
         * the trial to end, Hope Calls do not. Read from the source because
         * `hopeCallBarred` is private, and because one day somebody will "fix" the
         * inconsistency by adding the branch it deliberately does not have.
         */
        const callsSrc = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/calls.mjs`).then(r => r.text()));
        const hopeGate = callsSrc.slice(callsSrc.indexOf("function hopeCallBarred"),
            callsSrc.indexOf("export async function spendHopeCall"));
        ok(hopeGate.length > 100 && !hopeGate.includes("classTrial"),
            "Hope Calls are barred during a trial now, which is the opposite of the decision");
        const despairGate = callsSrc.slice(callsSrc.indexOf("export async function spendDespairCallFor"));
        ok(despairGate.includes("classTrial"),
            "a Despair Call is no longer refused during a Class Trial");
    }],

    ["R43 - the trial's budget follows the phase, not the window", async () => {
        /*
         * TWO ROADS INTO A CLASS TRIAL, and only one of them has a window (T-1).
         * `openDebate` calls `startFloor`, which moves the phase itself, so a
         * refill written only into `startClassTrial` leaves a real road where
         * everything is locked and nobody was paid.
         *
         * And NOT in `setPhase`: a GM correcting the campaign window by hand, or a
         * chapter advancing, is not a trial opening.
         */
        const ui2 = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial-floor-ui.mjs`).then(r => r.text()));
        const start = ui2.slice(ui2.indexOf("export async function startClassTrial"),
            ui2.indexOf("export async function openDebate"));
        ok(start.includes("openTrialBudget("),
            "starting a Class Trial no longer hands out the time of day's actions");

        const floor = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial-floor.mjs`).then(r => r.text()));
        const opening = floor.slice(floor.indexOf("export async function startFloor"),
            floor.indexOf("export async function openObjection"));
        ok(opening.includes("openTrialBudget("),
            "opening a debate straight from the GM panel leaves the trial unpaid");
        const branch = opening.slice(opening.indexOf('!== "classTrial"'));
        ok(branch.indexOf("openTrialBudget(") < branch.indexOf("return writeFloor"),
            "the refill left the branch that only runs when the phase actually moves");

        const clockSrc = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/clock.mjs`).then(r => r.text()));
        const setPhase = clockSrc.slice(clockSrc.indexOf("export async function setPhase"));
        ok(!setPhase.slice(0, setPhase.indexOf("\nexport ")).includes("openTrialBudget"),
            "setPhase hands out a trial budget, so editing the campaign window pays everybody");
    }],

    ["R44 - one admission rule, two questions, and every reader asks it", async () => {
        /*
         * THE RULE USED TO EXIST TWICE (T-1). trial.mjs carried
         * `objectionBlockedReason`, a copy of half of `openObjection`'s rules, with
         * a comment saying it "must go on mirroring" the other one - which is a
         * promise, not a mechanism. It is now one pair of exported functions, and
         * the split is load-bearing: a single combined refusal asked with an empty
         * target greys the button for the rebuttal cut-in Dawid ruled legal on
         * 28.08.
         */
        const floorSrc = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial-floor.mjs`).then(r => r.text()));
        ok(/export function floorRefusal\(/.test(floorSrc), "floorRefusal is not exported any more");
        ok(/export function targetRefusal\(/.test(floorSrc), "targetRefusal is not exported any more");

        const open = floorSrc.slice(floorSrc.indexOf("export async function openObjection"),
            floorSrc.indexOf("export async function openRebuttal"));
        ok(open.includes("floorRefusal(") && open.includes("targetRefusal("),
            "openObjection stopped asking the two refusals");
        ok(!/floor\.mode === FLOOR_MODES\.objection/.test(open),
            "openObjection kept its own inline copy of the mode rule");
        ok(/if \(!game\.user\.isGM\) return null;/.test(open),
            "openObjection lost its own isGM guard, which the player's window must not have");

        const trialSrc = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial.mjs`).then(r => r.text()));
        ok(!trialSrc.includes("objectionBlockedReason("),
            "trial.mjs is carrying its own copy of the admission rule again");
        ok((trialSrc.match(/floorRefusal\(/g) ?? []).length >= 2,
            "the window or the card stopped asking the floor rule");
        ok(trialSrc.includes("targetRefusal("),
            "nothing on the player's side asks who may be aimed at");

        /*
         * AND THE FALLBACK IS OFFERED ONLY TO THE LIVING, AND ONLY ON A PRICE.
         * A corpse or a Monokuma is refused with nothing offered, because a free
         * Present in place of an impossible Objection is a different act nobody
         * asked for (Dawid, 17.09).
         */
        const dialog = trialSrc.slice(trialSrc.indexOf("export async function presentDialog"),
            trialSrc.indexOf("export async function presentBullet"));
        const offer = dialog.slice(dialog.indexOf("const offerPresent"),
            dialog.indexOf(";", dialog.indexOf("const offerPresent")));
        ok(/!floorBlock/.test(offer), "the free Present is offered while the floor itself is blocked");
        ok(offer.includes('"noPrice"'),
            "the free Present is offered to characters who are quoted no price at all");

        /*
         * ENTER MUST HAVE SOMEWHERE TO GO. DialogV2 renders every footer button as a
         * submit, and implicit submission from the target select aims at the FIRST
         * one in tree order - a disabled first button kills Enter outright rather
         * than falling through to the next.
         *
         * So the array that answers a price block leads with the free Present: it is
         * enabled, it carries `default: true`, and it is what Enter from the select
         * should do anyway. The ordinary array's first button is `disabled: stopped`
         * and that is right - every case that sets `stopped` there renders the
         * "nobody to aim at" note or no fieldset at all, so there is no select for
         * Enter to come from.
         */
        const at = dialog.indexOf("buttons: (offerPresent ? [");
        ok(at > 0, "the buttons array changed shape: the offerPresent branch is gone");
        const firstButton = dialog.slice(at, dialog.indexOf("}", at));
        ok(!/disabled:/.test(firstButton),
            "the free Present is disabled, which kills Enter from the target select");
        ok(/default: true/.test(firstButton),
            "the free Present is not the default, so Enter presses a greyed OBJECTION");

        // The question alone, never the one that toasts: a window opening with no
        // GM connected must not warn every player who opens it (audit A16).
        ok(trialSrc.includes("gmOnline("), "the Objection stopped asking whether a GM is connected");
        for (const file of ["trial", "sheet", "action-rolls", "cleanup"]) {
            const src = stripComments(
                await fetch(`/modules/${MODULE_ID}/scripts/${file}.mjs`).then(r => r.text()));
            ok(!/[^A-Za-z]hasGm\(/.test(src),
                `${file}.mjs calls hasGm to decide something, which toasts every reader`);
        }
    }],

    ["R45 - the floor is seized once, paid for, and never by a card with nothing behind it", async () => {
        /*
         * T-1. The charge lives in the card hook and not in `openObjection`, which
         * the API, the suite and the harness all call and all must keep free. What
         * this reads is the shape that makes that safe.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial.mjs`).then(r => r.text()));
        const seize = src.slice(src.indexOf("async function seizeFloor"));
        ok(seize.length > 500, "seizeFloor is gone, so an objection is free again");

        ok(/let seizing = Promise\.resolve\(\);/.test(src),
            "the seizures are no longer serialised, so two cards can both buy the same minute");
        ok(/seizing = seizing\s*\n?\s*\.then\(/.test(src),
            "the hook no longer chains onto the serialising promise");

        ok(seize.includes("payPrice(") && seize.includes("refundPrice("),
            "the seizure stopped paying, or stopped handing it back when the floor did not move");
        ok(seize.indexOf("payPrice(") < seize.indexOf("openObjection("),
            "the price is taken after the floor moves, which cannot be undone if it fails");
        ok(seize.includes("testUserPermission("),
            "anybody can post an objection in somebody else's name again");
        ok(seize.includes("TRIAL_FLAGS.item"),
            "the card no longer has to name evidence the objector holds");
        ok(seize.includes("isPrimaryGm()"),
            "seizeFloor is safe to call from anywhere, so it needs its own primary-GM guard");

        /*
         * THE SOUND TRAVELS AS A FLAG, and R5 cannot see this one: it only flags a
         * `playSfx` inside a function guarded by `if (!game.user.isGM) return`, and
         * this one guards on `isPrimaryGm()` instead. So the rule is read here.
         */
        ok(!seize.includes("playSfx("),
            "seizeFloor plays a sound on the GM's client for somebody else's spend");
        ok(/sfx:/.test(seize), "the objector is never told, by sound, that they paid");

        // The charge is NOT in openObjection, which is what keeps the API free.
        const floorSrc = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial-floor.mjs`).then(r => r.text()));
        ok(!floorSrc.includes("payPrice("),
            "openObjection charges for itself, so every macro and fixture that calls it now pays");
    }],

    ["R46 - Analyze pays the chain before the dice, and every road gives it back", async () => {
        /*
         * T-1. Three things at once, and all three are about ORDER or about who is
         * allowed to claim what: the price is taken before the dice, a road that
         * ends with a GM is refused before the price when there is no GM, and the
         * ruling card that offers a refund carries the NAME of the step rather than
         * an amount - because that card is authored on the player's own client.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/action-rolls.mjs`).then(r => r.text()));
        const analyze = src.slice(src.indexOf("async function performAnalyze"),
            src.indexOf("async function analyseBullet"));
        ok(analyze.length > 500, "performAnalyze moved or vanished");

        ok(!analyze.includes("canAfford("),
            "performAnalyze is back to counting pips instead of quoting the chain");
        ok(analyze.includes("quotePrice(") && analyze.includes("payPrice("),
            "performAnalyze stopped asking or stopped paying the chain");
        ok(analyze.indexOf("payPrice(") < analyze.indexOf("rollTrait("),
            "the price is taken after the dice again");
        ok(analyze.indexOf("gmOnline()") < analyze.indexOf("payPrice("),
            "a road with no GM on it is paid for before anybody notices");
        ok(/options\.free\)? *&& *game\.user\.isGM|game\.user\.isGM *&& *Boolean\(options\.free/.test(analyze)
            || /const free = Boolean\(options\.free\) && game\.user\.isGM;/.test(analyze),
            "the free bypass is reachable from a player's macro, and it now skips Hope and Sanity");
        ok(analyze.includes("refundPrice("),
            "a closed roll window keeps the price it never rolled for");

        for (const road of ["analyseBullet", "askForHint", "locateStash"]) {
            const slice = src.slice(src.indexOf(`async function ${road}`));
            const body = slice.slice(0, slice.indexOf("\nasync function ", 10) + 1 || undefined);
            ok(body.includes("refundPrice("),
                `${road} cannot hand the price back when the road turns out to be empty`);
        }

        // Both call sites hand over a RECEIPT. A number would write
        // `data-paid="undefined"`, the far side would fall back, and a Burst-paid
        // ruling would come back as an action.
        for (const at of [...src.matchAll(/gmRulingActions\(actor,\s*([^)]*)\)/g)]) {
            const argument = at[1].trim();
            ok(!/^\d+$/.test(argument) && argument !== "cost",
                `gmRulingActions is still being handed a bare cost: ${argument}`);
        }

        const messenger = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/messenger-app.mjs`).then(r => r.text()));
        const decline = messenger.slice(messenger.indexOf('if (action === "decline")'));
        const body = decline.slice(0, decline.indexOf('if (action === "createItem")'));
        ok(body.includes("PRICE_CHAINS"),
            "the refund no longer takes its amount from the table, so a card can name its own");
        ok(!body.includes("Number(data.cost)"),
            "the refund reads an amount off a card the player authored");
    }],

    ["R47 - Tamper pays one price, on the client, after the concealment", async () => {
        /*
         * T-1. Tamper used to cost an action AND a Sanity mark: the action on the
         * player's client, the mark on the GM's. This reads the three rules that
         * make it one price without opening a hole:
         *
         *   the charge sits between the concealment and the dice, because the
         *   concealment's own Sanity can take the point the price needed;
         *   the GM side charges the Sanity only when no valid step arrived, which
         *   is what keeps a forged packet paying something;
         *   and the critical hands back the STEP that paid.
         */
        const cleanup = stripComments(new Map(await otherSources()).get("cleanup.mjs") ?? "");

        for (const fn of ["attemptCleanup", "attemptStageSix"]) {
            const at = cleanup.indexOf(`export async function ${fn}`);
            ok(at > 0, `${fn} has moved`);
            const body = cleanup.slice(at, cleanup.indexOf("\nexport ", at + 10));
            const conceal = body.indexOf("concealFromWitnesses(");
            const charge = body.indexOf("chargeTamper(");
            const dice = body.indexOf("rollTrait(");
            ok(conceal > 0 && charge > 0 && dice > 0,
                `${fn} no longer conceals, charges and rolls in one place`);
            ok(charge > conceal, `${fn} charges before the concealment can take the same point`);
            ok(charge < dice, `${fn} charges after the dice`);
            ok(body.includes("tamperWatchBlock("),
                `${fn} stopped refusing a watched attempt on a full Sanity track`);
            ok(body.includes("cleanupPrice"),
                `${fn} does not tell the GM's side which step paid`);
        }

        // Every GM-side charge is the no-claim fallback, and the only other writer
        // of the Sanity track in a refund path is `handBack`.
        for (const at of [...cleanup.matchAll(/await spendStress\(actor\)/g)].map(m => m.index)) {
            const before = cleanup.slice(Math.max(0, at - 260), at);
            ok(/validPrice\(|!paidStep|for \(let i = 0/.test(before),
                "a GM-side Sanity charge is back that no missing price claim explains");
        }
        ok(/function validPrice\(/.test(cleanup),
            "nothing bounds the step a Tamper packet claims to have paid");
        ok(/async function handBack\(/.test(cleanup),
            "the critical is back to healing Sanity the attempt may never have spent");
        const conceal = cleanup.slice(cleanup.indexOf("async function concealFromWitnesses"));
        ok(/restoreStress\(/.test(conceal.slice(0, 1600)),
            "the concealment's own refund is gone - that one is not the attempt's price");

        // The step travels: the roll context, both sides of the bridge, the replay.
        const bridge = stripComments(new Map(await otherSources()).get("gm-bridge.mjs") ?? "");
        const socket = bridge.slice(bridge.indexOf("payload?.action === ACTION_CLEANUP"),
            bridge.indexOf("payload?.action === ACTION_MEDDLE"));
        ok((socket.match(/price: payload\.price/g) ?? []).length >= 2,
            "the socket branch drops the price claim for one of the two resolvers, "
            + "so every remote Tamper on that road pays twice");
        const reroll = stripComments(new Map(await otherSources()).get("reroll.mjs") ?? "");
        const replay = reroll.slice(reroll.indexOf("async function settleCleanup"));
        ok(/price: bookmark\.cleanupPrice/.test(replay.slice(0, 2400)),
            "a rerolled clean-up forgets which step it paid, so the GM charges it again");
    }],

    ["R48 - a tile shows the price it is about to charge", async () => {
        /*
         * T-1, and the defect it closes is one this module has met before: on the
         * E23 round the Tamper tile's glow announced the killer's discount while
         * the stripe under it still read "1 action". Since the price is a chain,
         * there are three more ways for a tile to lie - a Hope step read as an
         * action, a Sanity step read as free, and a student dimmed for having no
         * actions when they can still pay with Hope.
         *
         * So the tile reads the QUOTE, from the same table and through the same
         * skip list the charge reads.
         */
        const sheet = stripComments(new Map(await otherSources()).get("sheet.mjs") ?? "");

        const cost = sheet.slice(sheet.indexOf("function costOf("),
            sheet.indexOf("function costLabelFor("));
        ok(cost.includes("priceQuoteFor("),
            "costOf is back to counting a flat cost for a priced action");
        ok(!/key === "tamper" && isCleaner\(actor\)/.test(cost),
            "costOf carries its own copy of D3 again, beside the skip list that already says it");

        const label = sheet.slice(sheet.indexOf("function costLabelFor("),
            sheet.indexOf("function costLabelFor(") + 900);
        ok(label.includes("priceLabel("),
            "the tile's price label no longer says which step will pay");

        const button = sheet.slice(sheet.indexOf("function actionButton("),
            sheet.indexOf("function actionButton(") + 6000);
        ok(/const affordable = priced \? !priced\.blocked/.test(button),
            "a priced tile is dimmed by its action step rather than by the whole chain");
        ok(button.includes("stripeKindFor("),
            "the stripe no longer follows the step that pays");
        ok(button.includes("priced?.blocked"),
            "the tile's refusal is back to counting pips instead of printing the chain's reason");

        // The killer's own night, said once: the skip list, shared with the charge.
        ok(sheet.includes("tamperPriceSkip("),
            "the sheet decides the killer's discount for itself again");

        // A full Sanity track only stops a WATCHED attempt (Dawid, 17.09).
        const tamper = sheet.slice(sheet.indexOf("function tamperBlock("),
            sheet.indexOf("async function askTamper("));
        ok(tamper.includes("witnessesTo(") && tamper.includes("DRPG.Tamper.watchedNoSanity"),
            "the Tamper tile refuses every attempt on a full Sanity track again");
        ok(!tamper.includes("DRPG.Cleanup.noStressForThis"),
            "the tile still says Tamper costs Sanity and you have none, which is no longer the rule");

        /*
         * AND A PRICED TILE REPAINTS WITH THE NUMBER. The render that would have
         * redrawn it is the one deliberately skipped to stop the sidebar
         * flickering, so the repaint owes what the render owed - minus a tile that
         * is in flight, whose `disabled` the delegate is still holding.
         */
        const repaint = sheet.slice(sheet.indexOf("function repaintInPlace("),
            sheet.indexOf("function refreshPricedTiles("));
        ok(repaint.includes("refreshPricedTiles("),
            "a Hope or Sanity change leaves the priced tiles showing yesterday's price");
        const tiles = sheet.slice(sheet.indexOf("function refreshPricedTiles("),
            sheet.indexOf("function refreshPricedTiles(") + 900);
        ok(/node\.disabled/.test(tiles),
            "the repaint re-enables a tile mid-action, so the same action can be fired twice");
    }],

    ["R49 - a bullet whose badge says Neutral is not treated as identified", async () => {
        /*
         * T-2's precondition, and a defect on its own. A Key or Final trace found
         * on an ordinary success arrived `analyzed: true` under a badge reading
         * Neutral: un-analysable, already wearing the real action's glyph, and -
         * once T-2 exists - carrying the GM's sentence about a clue nobody had
         * read. Both call sites forced the literal "neutral" over a self-evident
         * type instead of letting the rules decide.
         */
        const sources = new Map(await otherSources());
        const obs = stripComments(sources.get("observe.mjs") ?? "");
        ok(/shownType: isCritical \? data\.type : null/.test(obs),
            "createFind forces the literal neutral over a self-evident type again");

        const gmi = stripComments(sources.get("gm-items.mjs") ?? "");
        equal((gmi.match(/analyzed: result\.shown === "neutral"/g) ?? []).length, 2,
            "the give dialog lost one of its two explicit-Neutral guards");

        /*
         * AND THE SENTENCE ITSELF: one field on the trace, one flag on the item,
         * two spellings on purpose - so R9 can forbid the secret one in world data
         * without forbidding the published one.
         */
        const tb = stripComments(sources.get("truth-bullets.mjs") ?? "");
        ok(/analysisText: "analysisText"/.test(tb), "the published spelling is gone");
        ok(/export async function propagateAnalysis\(/.test(tb),
            "a GM editing the sentence no longer reaches the copies already in packs");
        const create = tb.slice(tb.indexOf("export async function createTruthBullet"),
            tb.indexOf("export function truthBulletData"));
        ok(/analysisText\]: identified \? analysis : ""/.test(create),
            "a bullet publishes the sentence before it is identified, or never");
        ok(/sourceAction, tiedToCrime, analysis \}/.test(create),
            "the sentence is not filed in the bullet's secret at creation");

        const analyze = stripComments(sources.get("analyze.mjs") ?? "");
        const identify = analyze.slice(analyze.indexOf("async function identify("));
        ok(/secret\.analysis\s*\n?\s*\|\|\s*remnantData\(/.test(identify),
            "identify no longer falls back to the trace when a bullet's secret is empty");
        ok(/analysisText\}`\]: said/.test(identify),
            "the moment of analysis does not publish the sentence");
        const undo = analyze.slice(0, analyze.indexOf("async function identify("));
        ok(/analysisText\}`\]: ""/.test(undo),
            "a rerolled Analyze leaves the sentence published on an un-analysed bullet");

        // Every route that copies a trace carries it, or one kind of bullet is
        // born with nothing to say.
        for (const [file, count] of [["observe.mjs", 1], ["gm-items.mjs", 1], ["handover.mjs", 2]]) {
            const src = stripComments(sources.get(file) ?? "");
            ok((src.match(/analysis: /g) ?? []).length >= count,
                `${file} copies a trace onto a bullet without the sentence analysing it buys`);
        }

        // And the Traces tab is where a GM writes it, for every type of trace.
        const inv = stripComments(sources.get("investigation.mjs") ?? "");
        ok(inv.includes("setRemnantAnalysis("),
            "the dashboard's Save no longer writes the after-analysis description");
        ok(/name="analysis\.\$\{key\}"/.test(inv),
            "the Traces table lost its After analysis column");
        const read = inv.slice(inv.indexOf("traces: traces.map("));
        ok(read.indexOf("analysis.${key}") > read.indexOf("if (!q(`name.${key}`)) return null;"),
            "the new column is read before the guard that stops a hidden row being saved as blank");
    }],

    ["R50 - every step of the season reset is a group a GM can except", async () => {
        /*
         * R-1, Dawid 18.09. The reset is a list of ticks now, and the promise the
         * window makes is that unticking a box leaves that group alone. A step
         * nobody named in the table would be ungated - it would run whatever the GM
         * ticked - so the table and the steps are held equal here, both ways round.
         */
        const sources = new Map(await otherSources());
        const table = stripComments(sources.get("season-exceptions.mjs") ?? "");
        ok(table.length > 500,
            "season-exceptions.mjs is not in the module's own source list - is it imported by a literal path?");

        const groups = [...table.matchAll(/\{ key: "(\w+)", section: "(\w+)" \}/g)]
            .map(m => ({ key: m[1], section: m[2] }));
        ok(groups.length >= 20, `only ${groups.length} reset groups - the table lost rows`);

        const setup = stripComments(sources.get("season-setup.mjs") ?? "");
        const wipe = setup.slice(setup.indexOf("async function wipeSeason"));
        const named = new Set([
            ...[...wipe.matchAll(/await step\("(\w+)"/g)].map(m => m[1]),
            ...[...wipe.matchAll(/\["(\w+)", "[^"]+", SETTINGS\./g)].map(m => m[1])
        ]);

        for (const { key } of groups) {
            ok(named.has(key), `the reset has no step for the group "${key}", so its tick does nothing`);
        }
        for (const key of named) {
            ok(groups.some(group => group.key === key),
                `the reset clears "${key}" and no group offers it, so it cannot be excepted`);
        }

        // Every row says something in both languages the window speaks: its own
        // label and its section's heading.
        const sections = new Set(groups.map(group => group.section));
        for (const { key } of groups) {
            ok(game.i18n.has(`DRPG.Season.group.${key}`), `the reset group "${key}" has no label`);
        }
        for (const section of sections) {
            ok(game.i18n.has(`DRPG.Season.section.${section}`),
                `the reset section "${section}" has no heading`);
        }
        for (const name of ["resetGroupsTitle", "resetGroupsNote", "resetNothing"]) {
            ok(game.i18n.has(`DRPG.Season.${name}`), `DRPG.Season.${name} is missing`);
        }
        for (const name of ["resetRemembered", "resetForgotten", "resetDoneKept"]) {
            ok(game.i18n.has(`DRPG.Season.${name}.other`), `DRPG.Season.${name} is not a counted pair`);
        }

        /*
         * AND THE WIPE IS NEVER RUN WITHOUT A PLAN. `wipeSeason(plan)` reads
         * `plan.groups`, so a caller that forgot the argument would throw on the
         * first step and leave the season half-cleared.
         */
        ok(/async function wipeSeason\(plan\)/.test(wipe),
            "wipeSeason no longer takes the plan that decides what it may touch");
        ok(!/wipeSeason\(\s*\)/.test(setup), "something calls wipeSeason with no plan at all");
        ok(/rememberExceptions\(plan\.keep\)/.test(setup),
            "the exceptions are no longer remembered for the next reset");
        const order = setup.indexOf("rememberExceptions(plan.keep)") < setup.indexOf("return wipeSeason(plan)");
        ok(order, "the exceptions are remembered after the wipe, which is a decision the wipe could lose");
    }],

    ["R51 - no vw ceiling stands without an absolute cap", async () => {
        /*
         * W-9, Dawid 18.09. Every size in this stylesheet was chosen at 16:9, and a
         * dozen of them are stated in `vw` - which on a 5120x1440 screen means a HUD
         * stretched across three feet of glass and a table window whose columns sit
         * a hand's width apart. A relative ceiling with no absolute one beside it is
         * the shape of that defect, so it is the shape this test hunts.
         */
        const raw = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        /*
         * COMMENTS BLANKED, NOT DELETED, and both halves matter. Blanked, because
         * the notes beside these rules quote the shapes this test hunts - the one
         * above the foreign-sheet rule says "96vw" in prose. And blanked rather than
         * stripped, so the line numbers it reports still point at the declaration.
         */
        const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
        const lines = css.split("\n");
        const bare = [];
        lines.forEach((line, i) => {
            const at = line.match(/max-width:\s*[\d.]+vw/);
            if (!at || line.includes("min(")) return;
            /*
             * The one allowed exception: a repair for windows the module does not
             * own, where an absolute cap could hide a control rather than reveal
             * one. Recognised by the RULE it sits in - the selector is five lines up
             * behind its own comment, and a blanked comment still takes up its
             * lines, so counting lines was never going to find it.
             */
            const opened = lines.slice(0, i + 1).join("\n").lastIndexOf("{");
            const rule = lines.slice(0, i + 1).join("\n").slice(Math.max(0, opened - 200), opened);
            if (rule.includes('.application.sheet:not([class*="drpg-"])')) return;
            bare.push(`danganronpa.css:${i + 1}`);
        });
        ok(!bare.length,
            `these relative ceilings have no absolute cap beside them: ${bare.join(", ")}`);

        for (const token of ["--drpg-overlay-max", "--drpg-window-max"]) {
            ok(css.includes(`${token}:`), `${token} is gone, so the caps have no home`);
        }

        // And the JavaScript reads the cap rather than keeping a second copy of it.
        const utils = stripComments(new Map(await otherSources()).get("utils.mjs") ?? "");
        const fit = utils.slice(utils.indexOf("function windowWidthFor"),
            utils.indexOf("function windowWidthFor") + 2000);
        ok(fit.includes("--drpg-window-max"),
            "the measured-window fit no longer reads the cap out of the stylesheet");
        ok(!/viewport - here/.test(fit),
            "the fit measures from the window's left edge again, which Foundry re-clamps anyway");
        ok(/Math\.min\(Math\.round\(viewport \* 0\.94\), Math\.round\(cap\)\)/.test(fit),
            "the fit no longer takes the smaller of the relative and the absolute ceiling");

        // The wide tier asks about the RATIO, because that is what is different
        // about these screens - 1920x1080 and 2560x1440 are both 1.78 and take none
        // of it.
        ok(/@media \(min-aspect-ratio: 2\/1\)/.test(css),
            "the ultrawide tier is gone, or asks about width instead of shape");
    }],

    ["R52 - the high-contrast switch states no type size", async () => {
        /*
         * W-7. The copy promises a player that this switch changes how legible the
         * interface is and NOT how big it is - text size belongs to the Interface
         * scale, and two controls fighting over one number is how a slider stops
         * meaning anything. A declaration in this block is the only way that promise
         * can be broken, so the block is read.
         */
        const raw = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
        const at = css.indexOf("body.drpg-high-contrast");
        ok(at > 0, "the high-contrast block is gone, so the switch changes nothing");
        /*
         * THE SWITCH'S OWN RULES AND NOTHING ELSE. This used to read from the first
         * mention of the class to the END OF THE FILE, so every rule that happened to
         * sit below the block counted as part of it - and W-2's type ladder, appended
         * at the foot of the sheet on 20.09, failed the `font-size` assertion below
         * while being none of this switch's business. Seven rules, 4.3 kB.
         */
        const block = css.split("}")
            .filter(chunk => /drpg-high-contrast/.test(chunk.includes("{") ? chunk.split("{")[0] : ""))
            .join("}\n") + "}";
        ok(block.length > 2000, "the high-contrast rules could not be isolated");

        ok(!/font-size/.test(block), "the high-contrast block sets a font size");
        ok(!/line-height/.test(block), "the high-contrast block sets a line height");

        /*
         * AND THE CHROME GROUND IS STATED TWICE, which is not a mistake:
         * stained-glass.css forces those boxes transparent for the curtain and wins
         * on source order, so the plain selector answers Monokuma Legacy and the
         * curtain-on one answers the glass.
         */
        ok(block.includes("body.drpg-high-contrast.drpg-curtain-on .drpg-panel"),
            "the glass keeps its transparent panels under high contrast, and wins on source order");
        ok(/body\.drpg-high-contrast \.drpg-panel/.test(block),
            "Monokuma Legacy's panels are not given an opaque ground");

        // The class is decided in JS, so the block exists once - and the switch is
        // not one of the theme-only effects.
        const settings = stripComments(new Map(await otherSources()).get("settings.mjs") ?? "");
        ok(/export function highContrastOn\(/.test(settings),
            "nothing decides whether high contrast is on");
        ok(/prefers-contrast: more/.test(settings),
            "the system's own contrast preference is no longer read");
        ok(/toggle\("drpg-high-contrast", highContrastOn\(\)\)/.test(settings),
            "applyTheme no longer puts the class on the body");
        const look = stripComments(new Map(await otherSources()).get("look.mjs") ?? "");
        ok(look.includes("SETTINGS.highContrast"),
            "the Look window lost the switch, so only Foundry's settings page has it");
    }],

    ["R53 - the Tamper tile's late answer does not eat the reason it is locked", async () => {
        /*
         * MEASURED ON A PLAYER'S SHEET IN A CLASS TRIAL (19.09). Every tile carried
         * "The Class Trial is in session..."; a second later, when the GM's ledger
         * answered whether Tamper has anything to work on, the Tamper tile alone lost
         * its reason and sat there dimmed and silent. `paintTamper` was cutting the
         * LAST `<br><em>` off the tooltip and putting its own back - which ate
         * whatever the last line happened to be, the Eclipse's and the fight's
         * included.
         *
         * The shape that cannot come back: the repaint composes from the two halves
         * the tile kept, and never edits the string it finds.
         */
        const sheet = stripComments(new Map(await otherSources()).get("sheet.mjs") ?? "");
        const paint = sheet.slice(sheet.indexOf("function paintTamper"),
            sheet.indexOf("function actionButton("));
        ok(paint.length > 200, "paintTamper has moved or gone");
        ok(!/\.replace\(/.test(paint),
            "paintTamper edits the tooltip it finds again, so it can eat another line");
        ok(paint.includes("drpgTipHead") && paint.includes("drpgTipTail"),
            "paintTamper no longer rebuilds the tooltip from the halves the tile kept");

        const button = sheet.slice(sheet.indexOf("function actionButton("));
        ok(/dataset\.drpgTipHead =/.test(button) && /dataset\.drpgTipTail =/.test(button),
            "the tile stopped keeping the two halves the repaint needs");
    }],

    ["R54 - the clock's chevrons hold one press at a time, and report a failure", async () => {
        /*
         * HUD-01 and HUD-03, 19.09. Double-clicking the Eclipse chevron opened the
         * Eclipse and closed it again: the handler disabled its own button, and the
         * clock write it made rebuilt the whole row a few milliseconds later, so the
         * second click landed on a fresh enabled button whose handler read
         * `isEclipse()` as true.
         *
         * READ RATHER THAN DRIVEN, on purpose, and the reason belongs here so
         * nobody "improves" it later: reproducing it in a world means winning a race
         * between a rebuild and a dispatched click. Two clicks in the same tick hit
         * the same still-disabled button and pass WITHOUT the fix; two clicks a
         * `settle()` apart land after the handler has finished and the answer depends
         * on how fast the browser did its chat round trips. What can be stated
         * exactly is the shape of the code, which is what this tier is for.
         */
        const hud = stripComments(new Map(await otherSources()).get("hud.mjs") ?? "");
        ok(hud.length > 1000, "hud.mjs did not load");
        const at = hud.indexOf("function control(");
        ok(at > 0, "hud.mjs no longer builds its clock controls in one place");
        const body = hud.slice(at);

        const born = body.indexOf("controlsBusy()");
        const listener = body.indexOf("addEventListener");
        const awaited = body.indexOf("await handler()");
        ok(born > 0 && listener > born,
            "a control built while a press is in flight is no longer born disabled");
        const guard = body.indexOf("controlsBusy()", listener);
        ok(guard > listener && guard < awaited,
            "the clock's controls no longer refuse a second press before running the first");

        const caught = body.slice(body.indexOf("catch", awaited), body.indexOf("finally", awaited));
        ok(/\berror\(/.test(caught) && /ui\.notifications\.error\(/.test(caught),
            "a clock control that throws is silent again");

        const release = hud.slice(hud.indexOf("function releaseControls"));
        ok(/querySelectorAll/.test(release) && /drpg-hud-button/.test(release),
            "the latch releases only the button it captured, so a rebuilt row stays dim");
    }],

    ["R55 - a rewind is refused before it cancels anything", async () => {
        /*
         * HUD-02, 19.09. An Eclipse sits BEFORE the next time of day, so the clock
         * still holds the one just finished - stepping it back renamed the running
         * Eclipse rather than undoing anything, and on the Night Eclipse that turned
         * free placement into a two-crossing budget with every crossing already made
         * counting against it.
         *
         * ORDER IS THE RULE. The refusal has to come before `cancelGather()`, or the
         * fix destroys a pending assembly and then declines to do the thing it
         * destroyed it for. Comments are stripped, so the paragraph above the guard
         * cannot satisfy this on its own.
         */
        const clock = stripComments(new Map(await otherSources()).get("clock.mjs") ?? "");
        ok(clock.length > 1000, "clock.mjs did not load");
        const body = clock.slice(clock.indexOf("export async function rewindTimeOfDay"),
            clock.indexOf("export async function setTimeOfDay"));
        ok(body.length > 200, "rewindTimeOfDay has moved or gone");

        const guard = body.indexOf("eclipse");
        const gather = body.indexOf("cancelGather");
        const write = body.indexOf("setClock(");
        ok(guard > 0, "a rewind no longer asks whether an Eclipse is running");
        ok(guard < gather && guard < write,
            "the Eclipse is checked after the rewind has already cancelled the assembly or moved the clock");
        ok(/DRPG\.Clock\.rewindDuringEclipse/.test(body), "the refusal no longer says why");
    }],

    ["R56 - the body discovery refuses the dark before it asks anything, and the button says so", async () => {
        /*
         * F12, 19.09. "A body is discovered" moved from a GM panel tile into the case
         * dashboard's footer and the Eclipse greying stayed behind with the tile, so
         * the one route a GM uses was lit through a whole Eclipse - and the refusal
         * that did exist ran only after the room and the victim had been chosen.
         *
         * ORDER IS THE RULE in both halves: who may press this, then when it may be
         * pressed, then what the map happens to have.
         */
        const sources = new Map(await otherSources());
        const chapter = stripComments(sources.get("chapter.mjs") ?? "");
        const inv = stripComments(sources.get("investigation.mjs") ?? "");

        const open = chapter.slice(chapter.indexOf("export async function openBodyDiscoveryDialog"),
            chapter.indexOf("function allBullets"));
        ok(open.length > 200, "openBodyDiscoveryDialog is gone or has moved past allBullets");
        const gm = open.indexOf("game.user.isGM");
        const dark = open.indexOf("isEclipse()");
        const rooms = open.indexOf("allRooms()");
        ok(gm > 0 && dark > 0 && rooms > 0, "the body-discovery window lost one of its three guards");
        ok(gm < dark, "the body-discovery window asks about the Eclipse before it asks who is pressing");
        ok(dark < rooms,
            "the window builds its room list before it refuses an Eclipse, so a GM fills in a form "
            + "that cannot be submitted");

        ok(inv.includes('button[data-action="bodyFound"]'),
            "the dashboard no longer greys the button that reaches the discovery");
        ok(inv.includes("DRPG.Eclipse.bodyLocked"),
            "the greyed body button gives no reason, or gives one of its own instead of the refusal's");
        const save = inv.indexOf('action: "save"');
        const body = inv.indexOf('action: "bodyFound"');
        ok(save > 0 && body > save,
            "the footer leads with the body button - Enter presses the first submit, and this is "
            + "the one that gets disabled");

        const wire = inv.slice(inv.indexOf("const wireAll = () => {"), inv.indexOf("wireAll();"));
        ok(!wire.includes("bodyFound"),
            "the greying rides `wireAll`, which keepLive defers while the GM is typing; it belongs "
            + "on `keepFresh`");
        ok(/keepFresh\(dialog/.test(inv),
            "the dashboard stopped keeping its footer in step with the Eclipse");
    }],

    ["R57 - the case dashboard keeps what the GM did to it across a redraw", async () => {
        /*
         * F13 and F14, 19.09, and they are one rule: a live window rebuilds itself,
         * `keepLive` carries the fields somebody touched and redraws everything else
         * from the world - so anything applied by an EVENT is applied exactly once,
         * and anything captured as a NODE is detached a moment later.
         */
        const sources = new Map(await otherSources());
        const utils = stripComments(sources.get("utils.mjs") ?? "");
        const picker = utils.slice(utils.indexOf("export function wirePortraitPickers"),
            utils.indexOf("export function panelTabs"));
        ok(picker.length > 300, "wirePortraitPickers is gone or has moved past panelTabs");
        const cb = picker.indexOf("callback:");
        ok(cb > 0, "wirePortraitPickers no longer hands the FilePicker a callback");
        ok(picker.slice(cb).includes("querySelector"),
            "the picker's callback writes to the nodes it captured before the picker opened; a "
            + "live window has replaced both by the time somebody chooses a file");
        const insync = picker.indexOf('getAttribute("src")');
        ok(insync > 0 && insync < cb,
            "nothing puts the picture back in step with the hidden field after a rebuild");

        const inv = stripComments(sources.get("investigation.mjs") ?? "");
        const helper = inv.slice(inv.indexOf("export function wireKeyLimitOverride"),
            inv.indexOf("export async function openInvestigationDashboard"));
        ok(helper.length > 200,
            "wireKeyLimitOverride is gone or has moved past openInvestigationDashboard");
        ok(/addEventListener\("change", apply\)/.test(helper),
            "the override no longer follows the tick box at all");
        ok(helper.indexOf("apply();") > helper.indexOf("addEventListener"),
            "the override is wired but never applied, so a redraw that restores the tick leaves "
            + "the rows disabled");
        const wire = inv.slice(inv.indexOf("const wireAll = () => {"), inv.indexOf("wireAll();"));
        ok(wire.includes("wireKeyLimitOverride("),
            "the dashboard stopped re-wiring the Key Remnant limit override after a rebuild");

        // The order both halves of this depend on, one file up.
        const live = stripComments(sources.get("live.mjs") ?? "");
        const rebuild = live.slice(live.indexOf("const rebuild = (force = false)"),
            live.indexOf("const schedule ="));
        const restored = rebuild.indexOf("restore(next, carried)");
        const after = rebuild.indexOf("after(next)");
        ok(restored > 0 && after > 0,
            "keepLive no longer restores what it carried, or no longer calls its `after` hook");
        ok(restored < after,
            "keepLive calls `after` before it puts back what the person had typed, so every "
            + "re-wire reads the markup's values instead of theirs");
    }],

    ["R58 - the trial console counts the seconds, a ballot is an event, and +30 s means thirty", async () => {
        /*
         * F8 and F9, 19.09. Two kinds of change and neither reached this window: the
         * seconds are the passage of time, which no document hook will ever report,
         * and a ballot is a Map in the GM's own memory - deliberately out of the
         * world, so `updateSetting` cannot see it either. And "+30 s" added thirty
         * seconds to `startedAt` flat, which on a debate 137 s over its budget made
         * it 107 s over: the one moment a GM presses that button is the one moment it
         * did nothing they could see.
         */
        const sources = new Map(await otherSources());
        const ui2 = stripComments(sources.get("trial-floor-ui.mjs") ?? "");
        const manage = ui2.slice(ui2.indexOf("export async function manageClassTrial"),
            ui2.indexOf("export async function openVoteDialog"));
        ok(manage.length > 500, "manageClassTrial is gone or has moved past the vote window");

        ok(manage.includes("setInterval("), "the trial console stopped counting the debate down");
        ok(/\}, 1000\)/.test(manage), "the console's tick is no longer once a second");
        ok(manage.includes("live.refresh("),
            "the tick paints something of its own instead of going through the live region");
        const tick = manage.slice(manage.indexOf("setInterval("), manage.indexOf("}, 1000)"));
        ok(tick.includes("isConnected") && tick.includes("clearInterval("),
            "the console's tick outlives the window");
        ok(tick.includes("trialFloor()"), "the tick runs while no floor is open");

        ok(/hooks: \["drpgVoteChanged"\]/.test(manage), "the console stopped watching for a ballot");
        ok(!/watch: \{[^}]*settings:/.test(manage),
            "the console's watch was narrowed to a list of settings, so the floor and the trial "
            + "record no longer wake it");

        ok(manage.includes("DRPG.Floor.holdingDiscussionOver") && manage.includes("Math.max(left, 0)"),
            "an overrun mode prints a clock running backwards again");

        const vote = stripComments(sources.get("vote.mjs") ?? "");
        ok((vote.match(/voteChanged\(\);/g) ?? []).length >= 3,
            "one of the three vote events stopped being reported");
        const cast = vote.slice(vote.indexOf("function onBallotCast"), vote.indexOf("function refuseBallot"));
        ok(cast.indexOf("ballots.set(") < cast.indexOf("voteChanged()"),
            "the ballot is reported before it is in the tally, so a listener redraws the stale list");
        const close = vote.slice(vote.indexOf("export async function closeVote"));
        ok(close.indexOf("ballots = null") < close.indexOf("voteChanged()"),
            "the vote is reported closed before the tally is cleared");
        ok(close.indexOf("voteChanged()") < close.indexOf("DRPG.Vote.nobodyVoted"),
            "the closing is reported after the road that returns early, so a vote nobody answered "
            + "leaves the console printing its voters");

        const floorSrc = stripComments(sources.get("trial-floor.mjs") ?? "");
        const extend = floorSrc.slice(floorSrc.indexOf("export async function extendFloor"),
            floorSrc.indexOf("export async function endFloor"));
        ok(extend.includes("secondsLeft("),
            "extendFloor stopped asking how much is left, so an overrun mode stays overrun");
        ok(extend.includes("Math.max("), "extendFloor no longer clamps an expired clock at zero");
        ok(!/startedAt \?\? Date\.now\(\)\) \+ extraSeconds/.test(extend),
            "the flat push on `startedAt` is back");
    }],

    ["R59 - the murder window asks the Eclipse before it asks the GM anything", async () => {
        /*
         * F10 and F11, 19.09. `openMurder` has always refused during placement and
         * says it is "the backstop for anyone who gets here anyway" - but the trap
         * card's "fire the trap" button is a road with no guard on it, so the GM
         * filled the form in and was refused at Confirm, then told a second time that
         * no murder was running. And because the tracker returns null on every road,
         * this window answered falsy even when a murder DID open, so a fired trap's
         * ruling card was never settled.
         */
        const murderSrc = stripComments(new Map(await otherSources()).get("murder.mjs") ?? "");
        const dialog = murderSrc.slice(murderSrc.indexOf("export async function openMurderDialog"),
            murderSrc.indexOf("async function rollOpening"));
        ok(dialog.length > 500, "openMurderDialog is gone or has moved past rollOpening");

        ok(dialog.includes("isEclipse("),
            "the murder window opens during an Eclipse and only refuses at Confirm");
        ok(dialog.indexOf("isEclipse(") < dialog.indexOf("DialogV2.wait("),
            "the Eclipse is asked after the GM has already filled the form in");
        ok(dialog.indexOf("murderState()") < dialog.indexOf("isEclipse("),
            "the Eclipse guard now hides the tracker of an incident that is already running");

        ok(!/armed\.has\(killerId\)/.test(dialog) && /armed\.has\(defaultKiller\)/.test(dialog),
            "the trap checkbox asks about the killer the caller named instead of the one the "
            + "dropdown shows");
        ok(/isComplete\(/.test(dialog),
            "the armed set went back to hand-rolled arithmetic and counts a project with no target");

        const tail = dialog.slice(dialog.indexOf("await openMurder("));
        ok(/const opened = await openMurder\(/.test(dialog) && /if \(!opened\) return null;/.test(tail),
            "a refused murder still opens the tracker and warns the GM twice");
        ok(tail.indexOf("if (!opened)") < tail.indexOf("openIncidentTracker()"),
            "the tracker is opened before the answer is read");
        ok(/return true;/.test(tail),
            "the window answers null even when a murder opened, so the trap's ruling card is "
            + "never settled");
        ok(/"drpg-window-murder"/.test(dialog),
            "the murder window has no class of its own, so nothing can close it");
    }],

    ["R60 - every size this module states follows the Interface scale", async () => {
        /*
         * W-2, Dawid 19.09. danganronpa.css read NEITHER scale token - 234 font-size
         * declarations, zero uses - so Monokuma Legacy kept one size whatever the
         * slider said. This is the test that keeps the 235th declaration honest.
         *
         * FIVE SHAPES ARE ALLOWED and everything else is a finding: `0` (a hidden
         * label), a read of one of the module's rungs or of Foundry's ladder, a bare
         * `em` (it inherits, so it already follows its parent), a `clamp()` (the
         * pause caption, whose container is the viewport), and a literal inside a
         * `calc()` that carries the factor.
         */
        const sheets = ["danganronpa.css", "messenger.css"];
        const bad = [];
        let factored = 0;
        let clamped = 0;
        let rungs = 0;

        for (const sheet of sheets) {
            const raw = await fetch(`/modules/${MODULE_ID}/styles/${sheet}`).then(r => r.text());
            // Comments blanked rather than deleted, so a reported line number still
            // points at the declaration - the rule R51 already follows.
            const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
            css.split("\n").forEach((line, i) => {
                const m = line.match(/font-size:\s*([^;]+);/);
                if (!m) return;
                const value = m[1].trim();
                if (/^0(\s*!important)?$/.test(value)) return;
                if (value.includes("var(--drpg-text-") || value.includes("var(--font-size-")) {
                    rungs++;
                    return;
                }
                if (/^[\d.]+em(\s*!important)?$/.test(value)) return;
                if (value.includes("clamp(")) {
                    clamped++;
                    return;
                }
                if (value.includes("var(--drpg-legacy-scale")) {
                    factored++;
                    return;
                }
                bad.push(`${sheet}:${i + 1} ${value}`);
            });
        }

        ok(!bad.length, `these sizes do not follow the Interface scale: ${bad.join(", ")}`);
        // Counted as well, so nobody satisfies the sweep by deleting the token.
        ok(factored >= 22, `only ${factored} stated sizes carry the factor`);
        equal(clamped, 2, "the pause caption is no longer the only size with a viewport container");
        ok(rungs >= 140, `only ${rungs} declarations read a rung - 164 of them did, so some have been unwired`);
    }],

    ["R61 - Monokuma Legacy states the whole ladder, and no rung is floored above its own size", async () => {
        /*
         * W-2. Foundry sizes its chrome from `--font-size-*` and Daggerheart's sheet
         * reads the same ladder 223 times, so the ladder is what this theme
         * redeclares. Every rung is N/16 rem, which is what both of them already
         * state - that is why the block changes nothing at 100 %.
         *
         * AND THE FLOOR IS PER RUNG. A flat 10px floor would GROW rungs 8 and 9,
         * which carry the pixel face's trait names and a tile's cost, and break the
         * one promise this makes: a client who never touched the slider sees no
         * change.
         */
        const raw = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));

        const at = css.indexOf("body.drpg-theme-monokuma-legacy {");
        ok(at > 0, "Monokuma Legacy no longer states a ladder of its own");
        const block = css.slice(at, css.indexOf("}", at));
        ok(block.includes("--font-size-8:"), "the ladder block is not the one that states the rungs");

        const WANT = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 30, 32, 36, 40, 48, 64, 80];
        for (const n of WANT) {
            const line = block.match(new RegExp(`--font-size-${n}:([^;]+);`));
            ok(line, `the ladder lost rung ${n}, so it silently falls off the slider`);
            const value = line[1];
            ok(value.includes("var(--drpg-legacy-scale"), `rung ${n} does not follow the slider`);
            const rem = value.match(/([\d.]+)rem/);
            ok(rem, `rung ${n} is not stated in rem`);
            const px = Math.round(Number(rem[1]) * 16 * 10000) / 10000;
            equal(px, n, `rung ${n} is stated as ${rem[1]}rem, which is ${px}px at 100 %`);
            const floor = value.match(/max\((\d+)px/);
            if (floor) {
                ok(Number(floor[1]) <= n,
                    `rung ${n} is floored at ${floor[1]}px, so 100 % GROWS it`);
            }
        }

        const root = css.slice(css.indexOf("--drpg-text-xs:"), css.indexOf("--drpg-text-xl:") + 120);
        for (const rung of ["xs", "sm", "md", "base", "lg", "xl"]) {
            const line = root.match(new RegExp(`--drpg-text-${rung}:([^;]+);`));
            ok(line && line[1].includes("var(--drpg-legacy-scale"),
                `--drpg-text-${rung} stopped following the slider`);
            const floored = line[1].includes("max(");
            equal(floored, rung === "xs",
                `--drpg-text-${rung} ${floored ? "has" : "lost"} a floor - only xs can reach one`);
        }
    }],

    ["R62 - the scale factor is published once, on both roots, and the glass is pinned at 1", async () => {
        /*
         * W-2. Three factors now, and they are not interchangeable: geometry takes
         * the slider times the screen, type under the glass takes the slider times a
         * clamped screen term, and this sheet takes the slider ALONE - because it was
         * drawn at one size for every screen, so wiring in the screen term would have
         * shrunk every Legacy label by 15 % at 1080p the day it shipped.
         */
        const settings = stripComments(new Map(await otherSources()).get("settings.mjs") ?? "");
        const apply = settings.slice(settings.indexOf("export function applyTheme"),
            settings.indexOf("function scaleWindow"));
        ok(apply.length > 400, "applyTheme has moved or gone");

        ok(/document\.body\.style\.setProperty\("--drpg-legacy-scale"/.test(apply)
            && /document\.documentElement\.style\.setProperty\("--drpg-legacy-scale"/.test(apply),
            "the factor is not published on both roots - the `:root` rungs need the second one");
        ok(/theme === "stainedGlass" \? 1 : sliderScale\(\)/.test(apply),
            "the factor is no longer the slider alone under Legacy and 1 under the glass");
        ok(!/legacyScale[^;]*typeScale/.test(apply),
            "the factor was wired to the type scale, which carries the screen term");

        for (const token of ["--drpg-ui-scale", "--drpg-type-scale"]) {
            ok(apply.includes(token), `${token} stopped being published - three factors, three writes`);
        }

        for (const sheet of ["danganronpa.css", "messenger.css"]) {
            const css = await fetch(`/modules/${MODULE_ID}/styles/${sheet}`).then(r => r.text());
            ok(!css.includes("var(--drpg-type-scale"),
                `${sheet} reads the screen-term factor, which has no business in a sheet drawn at one size`);
        }
    }],

    ["R63 - the window box follows the slider, and the sheet's stated size is still the glass's", async () => {
        /*
         * W-2b. The two width tokens are what decide a window's width in both themes
         * - the sheet states them with `!important`, which outranks the inline width
         * `setPosition` writes - so a box follows the slider there or nowhere.
         *
         * AND THE ORDER OF THE TWO GUARDS IS THE RULE: the theme test belongs in the
         * actor branch, not in the door. 1120 x 1160 is a statement about VT323 at
         * 17px under the glass, and handing it to a pixel-font sheet opens a window
         * two thirds empty with its resize handle taken away.
         */
        const raw = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
        ok(/--drpg-popup: calc\(34rem \* var\(--drpg-legacy-scale/.test(css),
            "the prose window's width stopped following the slider");
        ok(/--drpg-popup-wide: calc\(44rem \* var\(--drpg-legacy-scale/.test(css),
            "the wide window's width stopped following the slider");
        const wide = css.slice(css.indexOf("@media (min-aspect-ratio: 2/1)"));
        ok(wide.includes("--drpg-legacy-scale"),
            "on an ultrawide screen the GM panel is the one window whose box ignores the slider");

        const settings = stripComments(new Map(await otherSources()).get("settings.mjs") ?? "");
        const body = settings.slice(settings.indexOf("function scaleWindow"),
            settings.indexOf('Hooks.on("renderApplicationV2"'));
        ok(body.length > 400, "scaleWindow has moved or gone");
        ok(body.includes("if (!el) return;"), "scaleWindow's door is not the element test");
        ok(!/if \(!el \|\|[^\n]*stained-glass/.test(body),
            "the theme test is back in the door, so Legacy loses its window box again");
        equal((body.match(/want\.width = 1120/g) ?? []).length, 1,
            "the sheet's stated size is declared more than once, or not at all");
        ok(/drpg-theme-stained-glass[\s\S]{0,400}want\.width = 1120/.test(body),
            "the 1120 x 1160 sheet is handed to whichever theme is on");
    }],

    ["R64 - every stylesheet's comments are closed, and its braces balance", async () => {
        /*
         * PAID FOR IN W-2b, 20.09. A paragraph added to the note above the two window
         * widths landed OUTSIDE the comment, with a stray terminator after it - so the
         * browser read four lines of English as a declaration, swallowed the `;` that
         * ended `--drpg-popup` along with it, and that token resolved to nothing. Every
         * prose window in the module lost its width, while `--drpg-popup-wide` on the
         * next line was fine. No test could see it: tier 0 blanks comments before it
         * reads anything, which is exactly the assumption the defect breaks.
         *
         * CSS COMMENTS DO NOT NEST, which is what makes this decidable: the markers
         * have to alternate, strictly, from the first character of a sheet to the last.
         * The brace count is the same class of defect one level up - a rule that never
         * closes takes every rule after it with it.
         */
        const manifest = await fetch(`/modules/${MODULE_ID}/module.json`).then(r => r.json());
        const sheets = manifest.styles ?? [];
        ok(sheets.length >= 5, `module.json lists ${sheets.length} stylesheets`);

        for (const href of sheets) {
            const raw = await fetch(`/modules/${MODULE_ID}/${href}`).then(r => r.text());
            let open = 0;
            for (const m of raw.matchAll(/\/\*|\*\//g)) {
                const line = raw.slice(0, m.index).split("\n").length;
                if (m[0] === "/*") {
                    ok(!open, `${href}:${line} a comment opens inside a comment`);
                    open = 1;
                } else {
                    ok(open, `${href}:${line} a comment closes with nothing open - `
                        + "the lines above it are being read as CSS");
                    open = 0;
                }
            }
            ok(!open, `${href} leaves a comment open, so the rest of the sheet is a comment`);

            const code = raw.replace(/\/\*[\s\S]*?\*\//g, " ");
            equal((code.match(/{/g) ?? []).length, (code.match(/}/g) ?? []).length,
                `${href} does not balance its braces`);
        }
    }],

    ["R65 - a window that closes to come back does not answer its opener first", async () => {
        /*
         * F7, 20.09. `DialogV2.wait` resolves the moment its window closes, whoever
         * closed it - so a row button that closed the Players window, ran a
         * procedure and opened the window again did all of it OUTSIDE the promise
         * the GM panel was holding. The panel came back over the death dialog the
         * row had just opened.
         *
         * "The row reopens the window" is TRUE on the defect, which is why this
         * reads the SHAPE: one promise, built with no `await` in front of it, and
         * returned by the function that owns the window.
         */
        const sources = new Map(await otherSources());
        const live = stripComments(sources.get("live.mjs") ?? "");
        const panel = stripComments(sources.get("gm-panel.mjs") ?? "");

        const at = live.indexOf("export function handOff");
        ok(at > 0, "handOff is gone from live.mjs, so every round trip is hand-rolled again");
        const body = live.slice(at, live.indexOf("\nexport ", at + 10));
        ok(body.length > 100, "handOff's body could not be read");
        ok(!/\bawait\b/.test(body),
            "handOff awaits the close, so the opener's promise resolves before the round "
            + "trip is registered - which is the whole defect");
        ok(/\.then\(/.test(body) && /\.catch\(/.test(body),
            "handOff no longer builds the round trip in the same turn, or it can reject");

        const row = panel.slice(panel.indexOf("const wireRow ="),
            panel.indexOf("const chosen = await tableDialog"));
        ok(row.length > 200, "wireRow has moved or gone");
        ok(row.includes("handOff("), "the row buttons do not hand over");
        ok(!/dialog\.close\(\)/.test(row),
            "a row button still closes the window itself, so the close resolves the opener");

        const tail = panel.slice(panel.indexOf("const chosen = await tableDialog"));
        ok(tail.indexOf("if (roundTrip) return roundTrip;") > 0,
            "the round trip is not returned, so the GM panel reopens itself over it");
        ok(tail.indexOf("if (roundTrip)") < tail.indexOf('chosen === "items"'),
            "the answer is read before the handover, so a row press falls into the apply path");
    }],

    ["R66 - the Players window writes what it was told, and offers the Despair that is left", async () => {
        /*
         * F15, 20.09. Two halves of one mistake - reading the world once and using
         * it later.
         *
         * The apply loop walked the roster the window OPENED with while the answer
         * was built from the roster at the moment of Apply, so a character created
         * while the window stood open got a row, was read, and was then skipped.
         * And the donation controls were built from a string read once, so every
         * redraw put back the figures of a pool that had already paid.
         *
         * `watch: { actors: true }` IS NOT NARROWED HERE, deliberately. live.mjs
         * adds its `updateSetting` listener unconditionally and filters only when
         * `watch.settings` is given, so an omitted filter is the WIDE net - and this
         * window is built out of several of the module's settings.
         */
        const panel = stripComments(new Map(await otherSources()).get("gm-panel.mjs") ?? "");
        const at = panel.indexOf("export async function applyAliveStates");
        ok(at > 0, "applyAliveStates is gone, so the apply loop is back inside the window");
        const body = panel.slice(at, panel.indexOf("\nasync function", at + 10));
        ok(/Object\.entries\(chosen\)/.test(body),
            "the apply loop is driven by something other than the answer it was given");
        ok(!/\bstudents\b/.test(body),
            "the apply loop reads the roster the window opened with again");
        ok(/"silenced" in want/.test(body),
            "a missing silence key reads as `false`, so a caller that only moves a state "
            + "lifts a silence it was never asked about");
        ok(/markDeceased\(/.test(body) && !/killCharacter\(/.test(body),
            "the repair dropdown runs the whole death procedure again (F16)");

        // The whole opener, not its head: `keepLive` is an argument to the
        // `tableDialog` call, so a slice that stops at that call cannot see the watch.
        const window = panel.slice(panel.indexOf("async function openWhoIsAliveDialog"),
            panel.indexOf("export async function applyAliveStates"));
        ok(/const buildDonors = \(\) =>/.test(window),
            "the donation controls are built from a string read once");
        ok(/const donors = buildDonors\(\);/.test(window),
            "buildDonors exists but the rows do not call it, so nothing changed");
        ok(/watch: \{ actors: true \}/.test(window),
            "this window's live watch was narrowed - an omitted settings filter is the wide "
            + "net, and the table is built out of several settings");
    }],

    ["R67 - a repair moves the flags and says nothing", async () => {
        /*
         * F16, 20.09. The Players window's dropdown is documented as the tool that
         * "moves the two flags and nothing else" and it called `killCharacter` - the
         * whole death procedure: the "A student is dead" card whispered to every GM
         * and to the owners of everyone in a running incident, the death chapter
         * stamped, this chapter's traces tied off, Stage 6 offered. And clearing the
         * Monocub flag announced "X is no longer a Monocub" about students who never
         * were one.
         *
         * THE ORDER INSIDE `killCharacter` IS READ TOO. Nothing else guards it, and
         * the extraction is only reviewable if the sequence is stated: the bullets
         * perish while the items still exist to be read, then the record, then who
         * is told, then the chapter's traces, then Stage 6.
         */
        const sources = new Map(await otherSources());
        const chapter = stripComments(sources.get("chapter.mjs") ?? "");
        const cub = stripComments(sources.get("monocub.mjs") ?? "");

        ok(/export async function markDeceased\(/.test(chapter),
            "markDeceased is gone, so a repair has nothing quiet to call");
        const mark = chapter.slice(chapter.indexOf("export async function markDeceased"),
            chapter.indexOf("export async function killCharacter"));
        ok(/FLAGS\.deceased/.test(mark) && /toggleStatusEffect\("dead"/.test(mark),
            "markDeceased does not write the record and the token marker");
        for (const loud of ["whisperToGms", "tieChapterTraces", "offerStageSix", "bulletsOf"]) {
            ok(!mark.includes(loud), `markDeceased ${loud}s - it is meant to be the quiet half`);
        }

        const kill = chapter.slice(chapter.indexOf("export async function killCharacter"),
            chapter.indexOf("export async function reviveCharacter"));
        ok(kill.length > 400, "killCharacter has moved or gone");
        ok(/await markDeceased\(actor\)/.test(kill),
            "killCharacter writes the deceased flag itself again, so there are two answers "
            + "to what deceased means");
        const order = ["bulletsOf(", "markDeceased(", "whisperToGms(", "tieChapterTraces("];
        for (let i = 1; i < order.length; i++) {
            const before = kill.indexOf(order[i - 1]);
            const after = kill.indexOf(order[i]);
            ok(before > 0 && after > before,
                `killCharacter's order broke: ${order[i - 1]} no longer comes before ${order[i]}`);
        }

        const set = cub.slice(cub.indexOf("export async function setMonocub"),
            cub.indexOf("export async function setSilenced"));
        ok(/const was = isMonocub\(actor\)/.test(set),
            "setMonocub does not read what it is about to change");
        ok(/if \(was === Boolean\(value\)\)/.test(set),
            "setMonocub still announces a change it did not make");
        ok(set.indexOf("unsetFlag") < set.indexOf("was === Boolean(value)"),
            "the silence flag is now cleared only on a real change - a cub who stopped being "
            + "one keeps their silence");
    }],

    ["R68 - Edit campaign offers the chapter the clock is actually on", async () => {
        /*
         * GMP-03, 20.09. Six options, 1 to 6, and ending chapter 6 writes chapter 7 -
         * so with no option matching the browser reported the FIRST one, and Apply
         * wrote it: a GM who opened this window to fix a typo in the campaign name
         * rewound the campaign five chapters.
         *
         * The weaker assertions all pass on the defect: the options already carry
         * `selected` when they match (it simply never matched), and
         * CHAPTERS_PER_SEASON already appears. Only the widening and the coercion
         * tell the fix from the bug.
         */
        const sources = new Map(await otherSources());
        const panel = stripComments(sources.get("gm-panel.mjs") ?? "");
        const clockWin = panel.slice(panel.indexOf("export async function openClockDialog"));
        const list = clockWin.slice(clockWin.indexOf("const stated"), clockWin.indexOf("const result"));
        ok(list.length > 80, "the chapter list has moved or gone");
        ok(/Math\.max\(CHAPTERS_PER_SEASON/.test(list),
            "the chapter list is six long whatever the clock says, so a campaign past "
            + "chapter 6 opens this window on chapter 1 and Apply writes it");
        ok(/Number\.isFinite/.test(list),
            "the length of that array comes straight out of a world setting");
        ok(/n === now \?/.test(list),
            "the selected test compares against the raw setting, so a chapter stored as a "
            + "string widens nothing and matches nothing");

        // AND THE RULE REACHES THE OTHER WINDOW WITH THE SAME CAP. A number input
        // whose value is out of range fails constraint validation, so Apply there
        // submitted nothing at all.
        const season = stripComments(sources.get("season-setup.mjs") ?? "");
        const field = season.slice(season.indexOf('name="chapter"'), season.indexOf('name="chapter"') + 240);
        ok(/max="\$\{Math\.max\(CHAPTERS_PER_SEASON/.test(field),
            "the Season setup window still caps its chapter field at six");
    }],

    ["R69 - the Eclipse warning fires on a clock that moved", async () => {
        /*
         * GMP-04, 20.09. The gate was `result.timeOfDay !== undefined`, and
         * `timeOfDay` is a select this form always submits - so it was true on every
         * Apply. A GM renaming the campaign during an Eclipse was told the clock had
         * moved. That sentence is the module's only sign of an Eclipse silently
         * refusing every murder, and a warning that cries on every Apply is one
         * nobody reads.
         */
        const panel = stripComments(new Map(await otherSources()).get("gm-panel.mjs") ?? "");
        const win = panel.slice(panel.indexOf("export async function openClockDialog"));
        ok(!/result\.timeOfDay\s*!==\s*undefined/.test(win),
            "the Eclipse warning is gated on a field the form always fills");
        ok(/before\.timeOfDay/.test(win),
            "the warning does not compare the time of day it wrote with the one it replaced");
        const read = win.indexOf("const before = getClock()");
        const write = win.indexOf("await setClock(");
        const warn = win.indexOf("eclipseStillOn");
        ok(read > 0 && write > read && warn > write,
            "the clock is read for the comparison after it was written, or the warning moved "
            + "in front of the write");
        ok(!/before\.session/.test(win) && !/before\.phase/.test(win),
            "the session counter or the phase joined the comparison - they are bookkeeping, "
            + "not time");
    }],

    ["R71 - the cue pane is built on every redraw, not baked when the window opened", async () => {
        /*
         * F17, 20.09. The Play pane was three constants and a template read once, so
         * a track dragged into the cue playlist in the Playlists sidebar - which is
         * what a GM does next, with this window open beside it - did not appear until
         * the window was closed and opened again.
         *
         * The hooks are the mechanism and they are named: nothing this pane prints
         * lives in a setting, so `settings: []` (an empty array, which is truthy)
         * makes live.mjs reject every module setting key, and the playlist documents
         * are what it actually listens to.
         */
        const music = stripComments(new Map(await otherSources()).get("music.mjs") ?? "");
        ok(/const buildPlayPane = \(\) =>/.test(music),
            "the cue pane is a constant again, so the picker cannot see a new track");
        ok(/html: buildPlayPane\(\)/.test(music),
            "the window is built from something other than the builder");
        const live = music.slice(music.indexOf("keepLive(dialog, {"),
            music.indexOf("keepLive(dialog, {") + 600);
        ok(/region: "\.drpg-music-now"/.test(live), "the cue pane is not the live region");
        ok(/build: buildPlayPane/.test(live), "the live region is built by something else");
        ok(/after: wirePlay/.test(live),
            "the pane's buttons are not rewired after a redraw, so they stop answering");
        for (const hook of ["createPlaylistSound", "deletePlaylistSound", "createPlaylist"]) {
            ok(live.includes(hook), `the pane no longer wakes on ${hook}`);
        }
        ok(/settings: \[\]/.test(live),
            "the pane redraws on every module setting - an empty array is the filter that "
            + "says none of them");

        // The make-cue handler used to build a label and a select by hand and put
        // them in the DOM, because there was no rebuild to do it. There is now.
        const made = music.slice(music.indexOf("data-drpg-make-cue"));
        ok(!/document\.createElement\("select"\)/.test(made),
            "the make-cue handler still sews a picker into the DOM by hand");
        ok(/situationalMade/.test(music),
            "the made-but-empty state lost its sentence, so the picker reads as broken");
    }],

    ["R72 - a tier pool a GM makes is filed like the installer's own", async () => {
        /*
         * TABLES-01, 20.09. The Tier pools tab and the Room pools tab share one create
         * path, and it wrote `roomPool: true` with no category, tier or goal for both.
         * So a tier a GM added was a table the module could not file: its items showed
         * up unfiled in the index, and a usable drawn from it had no kind - which
         * since 26.08 is not cosmetic but the rules, because the kind IS what the item
         * does.
         */
        const tables = stripComments(new Map(await otherSources()).get("tables.mjs") ?? "");
        const at = tables.indexOf("export function classifyTableName");
        ok(at > 0, "classifyTableName is gone, so a created pool is filed by guesswork");
        const body = tables.slice(at, tables.indexOf("\nexport ", at + 10));
        ok(/ITEM_TIERS\.includes\(tier\)/.test(body),
            "the tier is unbounded, so \"DRPG Tools - Tier 9\" would be recognised as a tier "
            + "nothing draws from");
        ok(/tableNameCandidates\(/.test(body),
            "the classifier does not ask the same machinery the lookups use, so the two can "
            + "disagree about what a table is called");
        ok(/category: "usable", goal/.test(body),
            "a goal can be paired with any category, which would make "
            + "\"DRPG Murder Weapons (Healing) - Tier 2\" a legal answer");

        const create = tables.slice(tables.indexOf("typeof action.newPool === \"string\""));
        ok(/const known = classifyTableName\(name\)/.test(create),
            "the create path does not read the name back, so both tabs write the same flags");
        ok(/roomPool: true/.test(create),
            "a name this module does not recognise must still get the room receipt - that is "
            + "what the Room pools tab is for");
        ok(/tierPoolCreated/.test(create),
            "the GM is told the same sentence whichever family they just made");
    }],

    ["R73 - a window reopened from its own answer closes the old copy first", async () => {
        /*
         * LIVE-REOPEN-01, 20.09, and the measurement is the whole finding: at the first
         * statement after `await DialogV2.wait(...)` the window is still rendered and
         * still connected, so `alreadyOpen` refuses. A branch that awaits anything
         * first is safe; the validation paths - a warning, then straight back to the
         * window - are not, and they opened nothing at all.
         */
        const sources = new Map(await otherSources());
        const live = stripComments(sources.get("live.mjs") ?? "");
        const at = live.indexOf("export async function reopen");
        ok(at > 0, "reopen is gone from live.mjs");
        const body = live.slice(at, live.indexOf("\nexport ", at + 10));
        ok(/await app\.close\(\{ animate: false \}\)/.test(body),
            "reopen does not wait for the old copy to go, or it waits on a transition that "
            + "may never come");
        ok(body.indexOf("app.close(") < body.indexOf("opener()"),
            "reopen opens before it closes, which is the defect with an extra window");

        const tables = stripComments(sources.get("tables.mjs") ?? "");
        const tail = tables.slice(tables.indexOf("typeof action.newPool === \"string\""));
        equal((tail.match(/reopen\("drpg-window-tables"/g) ?? []).length, 3,
            "the three paths that warn and go straight back to the window do not all use "
            + "reopen");
        ok(!/^\s*return openItemTables\(\{ preset \}\);/m.test(tail),
            "one of those paths reopens directly again, so it opens nothing");
    }]
];

/* ==========================================================================
 * TIER 1 - INVARIANTS
 * ========================================================================== */

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
    "openEavesdropDialog", "openObjectionLog", "resetSeason"
];

const INVARIANTS = [
    ["every action definition has a label and a cost", () => {
        for (const [key, def] of Object.entries(ACTIONS)) {
            // A `deferred` row is a PLACE in the grid, not a definition: its
            // three strings are localised and config.mjs is evaluated before
            // `game.i18n` exists. The sheet fills it at render time - the row
            // below is what checks that it still does.
            if (def.deferred) continue;
            ok(def.label, `${key} has no label`);
            ok(typeof def.cost === "number", `${key} has no numeric cost`);
        }
    }],

    ["the three prices are one table", () => {
        /*
         * T-1. Three chains, one shape, and a table that has to agree with the
         * action costs beside it: `steps[0].amount` IS what the tile charges, and
         * `briefingFacts`, `costOf` and the invariant above all read `def.cost`.
         * Two numbers for one price is how a tile and its payer drift apart.
         */
        const kinds = ["action", "hope", "stress"];
        for (const [key, chain] of Object.entries(PRICE_CHAINS)) {
            ok(Array.isArray(chain.steps) && chain.steps.length, `${key} has no steps`);
            for (const step of chain.steps) {
                ok(kinds.includes(step.pay), `${key} pays with "${step.pay}"`);
                ok(Number.isInteger(step.amount) && step.amount > 0,
                    `${key} has a step costing ${step.amount}`);
            }
            if (chain.stepsBeyondFirst) {
                ok(chain.stepsBeyondFirst in PHASES,
                    `${key} gates its later steps on "${chain.stepsBeyondFirst}", which is no phase`);
            }
        }

        const order = key => PRICE_CHAINS[key].steps.map(step => step.pay).join(" -> ");
        equal(order("objection"), "action -> hope -> stress", "the Objection's chain changed order");
        equal(order("analyze"), "action -> hope -> stress", "Analyze's chain changed order");
        ok(!PRICE_CHAINS.tamper.steps.some(step => step.pay === "hope"),
            "Tamper grew a Hope step - Dawid's decision on 17.09 was action, then Sanity");
        equal(PRICE_CHAINS.tamper.steps[1].amount, RESOLUTION_STRESS_COST,
            "the Tamper price and the concealment no longer read the same constant");
        for (const key of ["analyze", "tamper"]) {
            equal(ACTIONS[key].cost, PRICE_CHAINS[key].steps[0].amount,
                `the ${key} tile and its chain disagree about the action step`);
        }

        /*
         * AND THE COPY, BOTH DIRECTIONS. R1 only reads double-quoted literals, and
         * every one of these keys is composed in a template literal from the table
         * itself - so nothing else in the suite would notice a chain whose refusal
         * has no sentence, or a sentence for a currency that no longer exists.
         */
        for (const kind of kinds) {
            ok(game.i18n.has(`DRPG.Price.label.${kind}.other`), `no plural label for ${kind}`);
            ok(game.i18n.has(`DRPG.Price.paid.${kind}`), `no "paid" line for ${kind}`);
        }
        for (const key of Object.keys(PRICE_CHAINS)) {
            ok(game.i18n.has(`DRPG.Price.nothingLeft.${key}`),
                `${key} has no sentence for running out of everything`);
        }
        for (const name of ["action", "burst", "hope", "stressAfterHope",
            "stressAfterAction", "breakdown", "free"]) {
            ok(game.i18n.has(`DRPG.Price.will.${name}`), `DRPG.Price.will.${name} is missing`);
        }
        for (const name of ["label.free", "paid.burst", "refunded", "refundLost", "noPrice"]) {
            ok(game.i18n.has(`DRPG.Price.${name}`), `DRPG.Price.${name} is missing`);
        }
        for (const family of ["label", "will", "nothingLeft", "paid"]) {
            const block = game.i18n.translations?.DRPG?.Price?.[family] ?? {};
            for (const name of Object.keys(block)) {
                const known = family === "label" || family === "paid"
                    ? [...kinds, "free", "burst"]
                    : family === "nothingLeft"
                        ? Object.keys(PRICE_CHAINS)
                        : ["action", "burst", "hope", "stressAfterHope",
                            "stressAfterAction", "breakdown", "free"];
                ok(known.includes(name),
                    `DRPG.Price.${family}.${name} is a sentence nothing can reach`);
            }
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
         * its description, and `injectMonocubPanel` draws `ACTIONS.move` - so
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
                `${key} has unknown kind "${kind}" - nothing will draw it`);
        }
    }],

    ["Palm cannot reach the two things it must not", () => {
        /*
         * The pool is "everything carried except Truth Bullets", built twice on
         * purpose - once to fill the picker on the thief's client and once as
         * the authority in `stealFromPerson`. Two copies of one rule is the
         * right shape here (an authority that imports its answer from the thing
         * it is checking is not one), and it is also exactly the shape that
         * drifts, so this pins the half of it that is a rule rather than code:
         * the category must exist to be excluded.
         */
        ok(ITEM_CATEGORIES.truthBullet,
            "truthBullet is not a category any more - Palm's exclusion excludes nothing");
        ok(typeof ACTIONS.palm.threshold === "number",
            "Palm has no threshold to beat");
        ok(typeof ACTIONS.palm.unseen?.threshold === "number",
            "Palm has no second axis - being seen would never be decided");
        ok(ACTIONS.palm.unseen.trait !== ACTIONS.palm.traits[0],
            "Palm's two rolls are the same statistic, which makes them one roll");
    }],

    ["every sound names a category and a real key to yield to", () => {
        /*
         * The Sound panel draws its table by walking SFX_EVENTS and filing each
         * row under its category, so an event naming a category that is not in
         * SFX_CATEGORIES is a row that never appears - a sound a GM cannot map
         * and therefore cannot hear, failing completely silently.
         *
         * `yieldsTo` fails even more quietly: `cancelHoldersOf` matches winners
         * by string, so a typo there does not error, it just means the sound
         * waits its 120ms and then plays anyway, on top of the thing it was
         * supposed to defer to. Nobody would ever debug that back to a spelling.
         */
        for (const [key, def] of Object.entries(SFX_EVENTS)) {
            ok(def.label, `${key} has no label`);
            ok(def.hint, `${key} has no hint - the panel shows it as bare`);
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
         * that item on NO list - not carried, not in any drawer, invisible on the
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
        // than off the entry. This test is what said so - it failed the moment
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
         * Call hands the price back - which is right, and which means a Call
         * whose effect field nobody wrote a branch for is a Call that takes the
         * Hope, refunds it and tells the player it "did not work". Silent in the
         * log, invisible in review, and exactly what trap 100 describes.
         *
         * So this asks the table the same question `applyCall` asks: is there
         * ANY field here that some branch acts on? The list is the branches, in
         * their order - adding an effect to config.mjs without adding its branch
         * fails here rather than at somebody's table.
         */
        const ACTED_ON = ["grants", "grantsHope", "damage", "progress", "feedsOverflow",
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

    ["the project Calls bend a project and no longer end one", () => {
        /*
         * THERE WERE THREE AND NOW THERE ARE TWO (Dawid, 29.08). `gameIntegrity`
         * - nine Despair to empty a project outright - was deleted, and its NAME
         * moved onto the Call that knocks two off. Two things about that can
         * break quietly, so both are stated here.
         *
         * FIRST: nothing carries the wipe any more. `applyCall`'s branch for it
         * went with the entry, so a Call declaring `wipesProgress` today would
         * take the Despair, do nothing, and report itself failed - trap 100 in
         * its purest form, and the exact reason `wipesProgress` also came out of
         * the ACTED_ON list above.
         *
         * SECOND: the pair stayed a pair. Same price, opposite sign. The whole
         * point of these two sitting together is that slowing a project down and
         * speeding one up cost the same, whatever the number becomes.
         */
        const wiping = Object.entries(DESPAIR_CALLS).filter(([, c]) => c.wipesProgress);
        ok(!wiping.length,
            `${wiping.map(([k]) => k).join(", ")} empties a project and no branch applies it`);
        ok(!DESPAIR_CALLS.gameIntegrity,
            "the deleted Call is back under its old key - the NAME moved, the entry went");

        const dent = DESPAIR_CALLS.gameProtection;
        const boost = DESPAIR_CALLS.favoriteProject;
        equal(dent?.label, "Game Integrity", "Game Integrity is not the name on the −2 Call");
        equal(dent?.progress, -2, "Game Integrity is not −2 progress");
        equal(boost?.progress, 2, "Patronage is not +2 progress");
        equal(dent?.cost, boost?.cost,
            `the project Calls are no longer a pair: ${dent?.cost} against ${boost?.cost}`);
    }],

    ["the overflow is examined when it fills, and cleared when the season is", async () => {
        /*
         * Two reports from Dawid, 30.08, and they share a root: the threshold
         * was only ever examined at a time-of-day boundary.
         *
         * ONE. A counter arriving at X mid-hour sat there while play carried on
         * - and could be eaten outright, because a boundary already armed by an
         * Eclipse finds its own stamp and does nothing. Measured before the fix:
         * 20/20, zero cards, no effect; and a boundary crossed with the stamp
         * pre-armed left the counter at 20 and posted nothing.
         *
         * TWO. `wipeSeason` emptied every Despair pool and left the spill from
         * them standing, so a new season opened carrying the old one's pressure
         * AND its armed stamp - dated to a time of day the new clock reaches
         * again on day one.
         *
         * Read from source rather than driven: firing it needs a boundary and a
         * full counter, and the scenario tier already owns that. What cannot
         * regress silently is the WIRING, and that is what this asks about.
         */
        const sources = new Map(await otherSources());
        const overflow = stripComments(sources.get("overflow.mjs") ?? "");
        const season = stripComments(sources.get("season-setup.mjs") ?? "");
        ok(overflow.length > 1000 && season.length > 1000, "the overflow sources did not load");

        // ONE: the counter's own writer asks.
        const add = overflow.slice(overflow.indexOf("export async function addOverflow"),
                                   overflow.indexOf("let arming"));
        ok(add.length > 100, "addOverflow is gone");
        ok(/armAhead\s*\(/.test(add),
            "the counter no longer asks whether it is full when it changes - "
            + "20/20 would sit there until a boundary, which is how this was reported");

        // And it arms the hour that has NOT started. Three of the eight debuffs
        // are consumed at a boundary that has already run for the hour in
        // progress, so firing into it would announce and change nothing.
        ok(/checkOverflow\(\{ ahead: true \}\)/.test(overflow),
            "the counter arms the hour already in progress, where Shift, Panic "
            + "and Darkness have nothing left to reduce");

        // TWO: the season reset clears it, through the one definition of empty.
        const wipe = season.slice(season.indexOf("async function wipeSeason"));
        ok(wipe.length > 500, "wipeSeason is gone");
        ok(/resetOverflow\(/.test(wipe),
            "a season reset empties the Despair pools and leaves their overflow standing");

        // Both halves, or a new season inherits an armed darkening.
        const reset = overflow.slice(overflow.indexOf("export async function resetOverflow"),
                                     overflow.indexOf("export async function resetOverflow") + 600);
        ok(/count:\s*0/.test(reset) && /active:\s*null/.test(reset),
            "resetOverflow no longer clears both the counter and the armed stamp");
    }],

    ["a table row keeps every edit, and an emptied description stays empty", async () => {
        /*
         * Dawid, 31.08: "opisy nie zapisuja sie poprawnie". Three defects, all
         * measured in the Item tables window before the fix.
         *
         * ONE. `editResult` fell back to the entry's own name when the value
         * was empty, so clearing the box put the name back into it and a
         * description could not be deleted at all. Measured: "A soft, sad
         * little roll." -> cleared -> "Toilet paper".
         *
         * TWO. The commit hung on `focusout` alone, and a footer button tears
         * the window down before the browser moves focus. Measured: typed
         * "ZZ lost on close?", pressed Close, the table still held the old
         * text. The repair blurs the focused field on `pointerdown`, in the
         * capture phase, which is before both the focus change and the click.
         *
         * THREE. These rows sit inside the dialog's own form and the first
         * type=submit button in DOM order is "Add an item", so Enter threw the
         * text away and opened an unrelated flow. That is the DialogV2 trap
         * this repository has already been bitten by once.
         *
         * Read from source: driving it needs a rendered dialog and a real
         * TableResult, and what regresses is three lines of wiring.
         */
        const sources = new Map(await otherSources());
        const tables = stripComments(sources.get("tables.mjs") ?? "");
        ok(tables.length > 1000, "tables.mjs did not load");

        const edit = tables.slice(tables.indexOf("async function editResult"),
                                  tables.indexOf("async function dropResult"));
        ok(edit.length > 100, "editResult is gone");
        ok(/description:\s*value\s*\}/.test(edit),
            "an emptied description is being written as something other than empty - "
            + "the name fallback is back, and the field will not take a deletion");
        ok(!/description:\s*value\s*\|\|/.test(edit),
            "editResult fell back to the name again on an empty description");

        // The other two are guarded for EVERY module window at once, so they
        // are read from the guard rather than from this one caller.
        const utils = stripComments(sources.get("utils.mjs") ?? "");
        const guard = utils.slice(utils.indexOf("export function guardTextFields"),
                                  utils.indexOf("export function registerTextGuard"));
        ok(guard.length > 100, "guardTextFields is gone from utils.mjs");

        // A window torn down under a focused field still writes it.
        ok(/addEventListener\("pointerdown"[\s\S]{0,320}?blur\(\)[\s\S]{0,60}?\},\s*true\)/.test(guard),
            "the capture-phase pointerdown flush is gone, so closing a window with the "
            + "cursor still in a field discards that edit again");

        // Enter commits a self-saving field instead of submitting the window.
        ok(/addEventListener\("keydown"[\s\S]{0,320}?data-drpg-field[\s\S]{0,200}?preventDefault/.test(guard),
            "Enter in a self-saving field submits the dialog again, and the first submit "
            + "button is whatever that window's footer happens to list first");

        // And it is actually installed on windows, not merely written.
        ok(/renderDialogV2/.test(utils),
            "nothing installs the text guard, so no window has it");

        /*
         * AND THE TWO THINGS 1.2.4 GOT WRONG (Dawid, 31.08).
         *
         * ONE, and it was mine: a default entry ships with `description ===
         * name`, which renders as an EMPTY box, so every untouched row is a
         * blank field sitting over a stored value. Once empty meant empty and
         * the guard started letting focus through more often, switching tables
         * wiped rows nobody had touched. Measured: "Bent nail", box "", stored
         * "Bent nail", one focusout with no edit -> stored "".
         *
         * TWO: a field blurred BY the click that redraws the list has already
         * been orphaned when its `focusout` arrives, and a detached node
         * bubbles to nothing. Measured: typed, clicked another table, the entry
         * kept its old text.
         */
        const rows = tables.slice(tables.indexOf("function tableItemsHtml"),
                                  tables.indexOf("async function addResult"));
        ok(/data-drpg-initial/.test(rows),
            "table rows no longer carry the value they were rendered with, so there is "
            + "nothing to compare against and every blur is a write again");
        ok(/data-drpg-owns-result/.test(rows) && /data-drpg-owns-table/.test(rows),
            "a field no longer carries its own ids, so one orphaned by a redraw cannot "
            + "say what it belonged to");

        ok(/if \(field\.value\.trim\(\) === \(field\.dataset\.drpgInitial \?\? ""\)\) return;/.test(tables),
            "an unchanged field is written again - which is how untouched rows lost their "
            + "descriptions to nothing more than focus passing over them");

        const showFn = tables.slice(tables.indexOf("const flush = async"),
                                    tables.indexOf("show(current);"));
        ok(/await flush\(\)/.test(showFn) && showFn.indexOf("await flush()") < showFn.indexOf("innerHTML"),
            "the list redraws without writing what was on screen first, so a description "
            + "typed and then clicked away from is lost with the row it was in");
    }],

    ["a tool in hand lowers the bar as well as adding a die", async () => {
        /*
         * Dawid, 31.08: the Tool was the one equippable category whose tier
         * bought nothing but durability.
         *
         * A Murder Weapon's tier IS its damage and a Cleaning Tool's comes off
         * the clean-up DC, but a Tool went through `armSituational(1)`, which
         * never reads the tier - so a tier 3 toolkit and a tier 1 screwdriver
         * were the same object on every project roll. Now the tier comes off
         * the threshold too, in both places project work happens.
         *
         * Read from source. Driving it needs a live project, a readied Tool of
         * a known tier and a roll that lands in the gap the relief opens; what
         * regresses here is one term in two expressions, and the term is easy
         * to lose to anyone tidying "why are we rebuilding this array".
         */
        const sources = new Map(await otherSources());
        const config = stripComments(sources.get("config.mjs") ?? "");
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        const items = stripComments(sources.get("use-items.mjs") ?? "");
        ok(config.length > 1000 && rolls.length > 1000, "the sources did not load");

        // The rule exists and says which half is which.
        ok(/TOOL_IN_HAND\s*=\s*\{[^}]*tierReducesThreshold:\s*true/.test(config),
            "TOOL_IN_HAND no longer promises that a Tool's tier reduces the threshold");
        ok(/TOOL_IN_HAND\s*=\s*\{[^}]*advantage:\s*true/.test(config),
            "TOOL_IN_HAND dropped the advantage - the tier was meant to be ON TOP of the die");

        // One named reader for the flag, so neither caller spells it out.
        ok(/export function tierOf\(/.test(items),
            "use-items.mjs no longer exports tierOf");

        const between = (from, to) => {
            const a = rolls.indexOf(from);
            const b = to ? rolls.indexOf(to) : rolls.length;
            ok(a >= 0 && b > a, `${from} is gone from action-rolls.mjs`);
            return rolls.slice(a, b);
        };

        // Project work: the bands come down, not the roll up.
        const project = between("async function workOnProject", "async function chooseProjectAndTrait");
        ok(/easedBy\(def\.thresholds,\s*relief\)/.test(project),
            "project work stopped easing its thresholds with the readied Tool");

        // Sabotage: the same, and its repair scale reads the 18 band a second
        // time by hand, so that copy has to move with it.
        const sabotage = between("async function performSabotage", "async function performTamper");
        ok(/easedBy\(def\.thresholds,\s*relief\)/.test(sabotage),
            "sabotage stopped easing its thresholds with the readied Tool");
        ok(/18\s*-\s*relief/.test(sabotage),
            "the sabotage repair scale still reads a bare 18 - a good tool would buy the "
            + "band without buying the repair it names");
    }],

    ["the overflow caption is redrawn by every road that can end a darkening", async () => {
        /*
         * Dawid, 31.08: "Darkened - this time of day" stayed on screen after
         * the effect was over.
         *
         * The mechanic was fine. `overflowEffect()` compares the armed stamp
         * with the clock and had already stopped answering; every reader that
         * asks at the moment it acts got the right answer. What was stale was
         * the CAPTION, because the Despair widget is redrawn by `SYNC.overflow`
         * and by nothing else - and the two things that end a darkening without
         * touching the counter are the clock moving past the stamp and the
         * Eclipse flag flipping.
         *
         * Read from source. Driving it needs a boundary on a live world, and
         * what regresses here is one line in a switch: it is deleted by anyone
         * tidying "the pools did not change, why redraw the pools".
         */
        const sources = new Map(await otherSources());
        const sync = stripComments(sources.get("sync.mjs") ?? "");
        ok(sync.length > 1000, "sync.mjs did not load");

        const caseOf = (name, next) => {
            const from = sync.indexOf(`case SYNC.${name}:`);
            const to = sync.indexOf(`case SYNC.${next}:`);
            ok(from >= 0 && to > from, `the ${name} case is gone from the sync switch`);
            return sync.slice(from, to);
        };

        // The stamp stands still and the clock walks out from under it.
        ok(/renderDespairBar/.test(caseOf("clock", "eclipse")),
            "a time of day ending no longer redraws the Despair caption - "
            + "\"Darkened\" outlives the darkening, which is how this was reported");

        // And the branch that reads `clock.eclipse` rather than the time of day.
        ok(/renderDespairBar/.test(caseOf("eclipse", "visibility")),
            "an Eclipse starting or ending no longer redraws the Despair caption, "
            + "and overflowEffect() answers differently on both sides of it");

        // The road that was always there, so a tidy-up cannot move the redraw
        // out of the other two by putting it all here.
        ok(/renderDespairBar/.test(caseOf("overflow", "searchTokens")),
            "the counter changing no longer redraws its own caption");
    }],

    ["the overflow fires once per boundary and never below its floors", async () => {
        /*
         * Z10. Three ways this can be wrong, and only the first would be
         * noticed by looking at a screen.
         *
         * ONE: the boundary is asked twice - `startEclipse`, so a darkening can
         * shorten the crossings of the Eclipse that triggered it, and
         * `applyTimeOfDayChange`, so a table that never opens an Eclipse still
         * gets one. Both run for a table that uses Eclipses, so the second has
         * to find the first's stamp and do nothing. A second payment is a
         * counter draining at twice the rate the design was tuned for.
         *
         * TWO: each check must come BEFORE the pass it modifies. The action
         * budget is WRITTEN by `resetAllActions` and the search tokens by
         * `SearchTokens.reset` - a darkening checked after either is announced
         * now and felt next time, which from a chair looks exactly like the
         * feature working.
         *
         * THREE: every reduction stops at a floor. Zero actions is not a harder
         * game, it is a player with nothing to do until the clock moves, and a
         * room with no search tokens cannot be investigated at all.
         */
        const sources = new Map(await otherSources());
        const eclipse = stripComments(sources.get("eclipse.mjs") ?? "");
        const clock = stripComments(sources.get("clock.mjs") ?? "");
        ok(eclipse.length > 1000 && clock.length > 1000, "the clock sources did not load");

        const opening = eclipse.slice(eclipse.indexOf("export async function startEclipse"),
                                      eclipse.indexOf("export async function endEclipse"));
        ok(/checkOverflow\s*\(/.test(opening),
            "an Eclipse no longer checks the overflow as it opens");
        ok(/checkOverflow\s*\(/.test(clock),
            "a time of day without an Eclipse no longer checks the overflow");

        const before = (text, first, second, complaint) => {
            const a = text.indexOf(first);
            const b = text.indexOf(second);
            ok(a >= 0 && b >= 0 && a < b, complaint);
        };
        before(opening, "checkOverflow", "resetAllActions",
            "the Eclipse refills the action budget before it knows the hour is darkened");
        before(clock, "checkOverflow", "SearchTokens.reset",
            "the clock restocks the rooms before it knows the hour is darkened");

        const overflow = stripComments(sources.get("overflow.mjs") ?? "");
        ok(overflow.length > 1000, "overflow.mjs did not load");
        ok(/same\(now\.active,\s*target\)/.test(overflow),
            "checkOverflow no longer recognises a boundary it has already armed - "
            + "an Eclipse would pay the threshold twice");

        /*
         * THE CATALOGUE'S OWN SHAPE. Eight debuffs, one drawn per firing, and
         * two kinds of entry that must not be confused for one another - see
         * `OVERFLOW` in config.mjs. A `state` written as an `event` would run
         * once and be forgotten; an `event` written as a `state` would apply on
         * every read, which for Rot means eating the school's equipment inside
         * one time of day.
         */
        for (const [key, rule] of Object.entries(OVERFLOW.effects)) {
            ok(rule.kind === "state" || rule.kind === "event",
                `${key} is neither a state nor an event, so nothing knows when to run it`);

            // Only the ones that subtract a number need a floor, and every one
            // of those needs one: a subtraction with no floor reaches zero, and
            // zero actions or zero search tokens is a different game rather
            // than a harder one.
            if (rule.kind === "state" && rule.by !== undefined) {
                ok(Number.isFinite(rule.floor) && rule.floor >= 1,
                    `${key} subtracts ${rule.by} with no floor under it`);
            }
            if (rule.by !== undefined) {
                ok(Number.isFinite(rule.by) && rule.by >= 0,
                    `${key} is sized ${rule.by}`);
            }
        }

        // Every entry needs a name and a sentence, or the card that announces a
        // draw has nothing to say about what was drawn.
        for (const key of Object.keys(OVERFLOW.effects)) {
            const name = game.i18n.localize(`DRPG.Overflow.name.${key}`);
            const what = game.i18n.localize(`DRPG.Overflow.what.${key}`);
            ok(name && !name.startsWith("DRPG."), `${key} has no name for the card`);
            ok(what && !what.startsWith("DRPG."), `${key} has no sentence for the card`);
        }

        ok(OVERFLOW.threshold >= OVERFLOW.range.min && OVERFLOW.threshold <= OVERFLOW.range.max,
            `X = ${OVERFLOW.threshold} is outside the range the editor accepts`);
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
         * one keeps its Font Awesome icon rather than rendering blank - which
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
            // Incident and Resolution are priced like Prep - the same decision
            // the observation table already made, for the same reason.
            equal(row.incident, row.prep, `Analyze/${band}: incident is not priced like prep`);
            equal(row.resolution, row.prep, `Analyze/${band}: resolution is not priced like prep`);
        }
    }],

    ["a critical pays the guide's price, and something is enforcing it", () => {
        // G-16. Daggerheart's own rule is +1 Hope and one Stress cleared; the
        // guide's is +2 Hope and nothing about Stress. The numbers are half the
        // test - the other half is that the wrapper is actually on, because a
        // config entry nobody applies is exactly the class of defect this
        // stage's regression tier exists for.
        equal(CRITICAL.hope, 2, "a critical is not paying the guide's 2 Hope");
        equal(CRITICAL.clearsStress, false, "a critical is still clearing Sanity as well");

        const DualityRoll = game.system?.api?.dice?.DualityRoll;
        ok(DualityRoll, "Daggerheart's DualityRoll is not where this module looks for it");
        ok(DualityRoll.addDualityResourceUpdates?.[Symbol.for("drpgCriticalRule")],
            "the critical rule is not installed - criticals are paying Daggerheart's numbers");
    }],

    ["the three criticals that buy another act say so, and can be spent", () => {
        // G-17 and G-18, and they are NOT the same thing: one buys another go
        // at the dice, the other buys certainty about one roll.
        for (const key of ["leaveClue", "secureTrace", "useItem"]) {
            ok(CRISIS_ACTIONS[key]?.criticalKeepsTurn,
                `${key}'s critical ends the turn - G-17's second action is unreachable`);
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
            "the transform can re-point a trace - that is the Misleading trail's action to sell");
    }],

    ["a reshaped trace always admits it was handled", async () => {
        /*
         * D15, Dawid 29.08. The killer writes a name and a description; the
         * KIND is not theirs to choose and is always a Tamper Remnant.
         *
         * Worth an invariant rather than a comment because the old rule was the
         * exact opposite - a menu of four types, one of which was "Faint",
         * which the chapter sweep clears. A reshape that could pick its own type
         * could clear its own crime scene, and that is the hole this closes.
         */
        const { REMNANT_TYPES } = await import("./config.mjs");
        const becomes = CLEANUP.transformAction?.becomes;
        equal(becomes, "resolution", "a reshaped trace no longer becomes a Tamper Remnant");
        ok(REMNANT_TYPES[becomes], `a reshape turns traces into "${becomes}", which is not a type`);

        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/cleanup.mjs`).then(r => r.text()));

        // One writer, so the two roads cannot part company.
        const at = src.indexOf("async function reshapeTrace");
        ok(at > 0, "reshapeTrace is gone, so the two reshape roads write separately again");
        const body = src.slice(at, at + 1400);
        ok(/type:\s*CLEANUP\.transformAction\?\.becomes/.test(body),
            "reshapeTrace no longer forces the type - something else decides it");
        ok(/setRemnantPublic/.test(body),
            "a reshape no longer writes the killer's name and description anywhere");

        // And nothing reads a type off the packet any more.
        ok(!/\bchange\.type\b/.test(src) && !/\btransform\.type\b/.test(src),
            "a reshape still takes a remnant type from a client packet");

        // The words are bounded on arrival, not by the input's maxlength.
        ok(/function plainText/.test(src),
            "the killer's own text reaches the world unbounded");
        ok((src.match(/plainText\(/g) ?? []).length >= 5,
            "some road writes a player's text without passing it through plainText");
    }],

    ["a body cannot be dragged across the building, or into a bedroom", async () => {
        /*
         * D14, Dawid 29.08. Two rules, one list - and the list matters as much
         * as the rules do. D11 shipped as two copies of one guard with one of
         * them updated, so the picker and the resolver share a function here
         * rather than sharing a promise to stay in step.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/cleanup.mjs`).then(r => r.text()));

        const at = src.indexOf("async function bodyDestinations");
        ok(at > 0, "bodyDestinations is gone; the destination rules live in two places again");
        const body = src.slice(at, at + 500);
        ok(/neighbouringRooms/.test(body),
            "a body can be dragged to a room that does not connect to this one");
        ok(/vaultOwnerOf/.test(body),
            "a body can be dragged into somebody's bedroom");

        // Definition plus both callers.
        ok((src.match(/bodyDestinations\(/g) ?? []).length >= 3,
            "one of the two Move the body roads no longer asks bodyDestinations");
        ok(!/neighbouringRooms\(here/.test(src),
            "a Stage 6 road still builds its own room list, so the two can disagree");
    }],

    ["the betrayal outlives the incident it came out of", async () => {
        /*
         * D18, Dawid 29.08: "niech bedzie dostepna do konca dnia po
         * morderstwie". The offer used to be read live off the incident, which
         * is wiped the moment a GM closes it - so the accomplice had it while
         * somebody else scrubbed the floor and lost it at exactly the point
         * they would have thought of it.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/murder.mjs`).then(r => r.text()));

        const at = src.indexOf("export function betrayalTarget");
        ok(at > 0, "betrayalTarget is gone");
        const body = src.slice(at, at + 2600);
        ok(/FLAGS\.betrayalWindow/.test(body),
            "betrayalTarget does not read the window, so nothing outlives the incident");
        /*
         * ORDER, NOT ABSENCE. The first version of this asserted that
         * `betrayalTarget` never mentions the incident at all, and then the
         * incident came back for a good reason: a betrayal cannot be opened in
         * the middle of somebody else's fight, so the tile must not light for
         * it. The blunt test could not tell that refusal apart from the
         * regression it was written to catch.
         *
         * What actually matters is which one SOURCES the offer. The window is
         * read first; the incident is consulted afterwards, and only to refuse.
         */
        const flagAt = body.indexOf("FLAGS.betrayalWindow");
        const stateAt = body.indexOf("murderState()");
        ok(flagAt > 0, "the offer no longer comes from the window");
        ok(stateAt > flagAt,
            "the incident is asked before the window, so the offer is sourced from it again");
        ok(!/thirdId/.test(body),
            "the offer still needs the incident to be naming a third party");
        ok(/getClock\(\)/.test(body),
            "nothing checks the day, so the window never shuts");
        ok(/running\?\.active/.test(body),
            "the tile lights in the middle of a fight, for a betrayal that would be refused");

        // Armed from the one state writer, so the six roads into a resolution
        // cannot each grow their own copy of the rule.
        const ws = src.indexOf("async function writeState");
        ok(ws > 0, "writeState is gone");
        // THE WHOLE FUNCTION, NOT A FIXED SLICE. This read 1200 characters, and
        // when LIVE-001 (1b) split the write into a cast half and a public half
        // the arming moved past that mark - `stripComments` keeps every
        // comment's length, so the note above the arming counts too. The suite
        // then reported the window "armed somewhere else" while it sat exactly
        // where it always had. A function ends at its own closing brace.
        const writer = src.slice(ws, src.indexOf("\n}", ws) + 2);
        ok(/armBetrayalWindow/.test(writer),
            "the window is armed somewhere other than the single state writer");
        ok(/before\.stage !== "resolution"/.test(writer),
            "the window is armed off the state rather than the transition, so it re-arms");

        // Single use, spent before the attempt rather than after it.
        const bp = src.indexOf("export async function betrayAsPlayer");
        ok(bp > 0, "betrayAsPlayer is gone");
        ok(/unsetFlag\(MODULE_ID, FLAGS\.betrayalWindow\)/.test(src.slice(bp, bp + 1400)),
            "the offer is not spent when it is taken, so it can be taken twice");
    }],

    ["nobody walks out of an incident they are standing in", async () => {
        /*
         * D19, Dawid 29.08. The killer and the victim were held; the third
         * party was not, on the reading that the guide stops them with the
         * price of the move. That left the free look: walk in, see everything,
         * drag the token back out, and never spend Averted eyes - the action
         * whose whole content is leaving and taking no part in it.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/movement.mjs`).then(r => r.text()));

        const at = src.indexOf("function lockedInIncident");
        ok(at > 0, "lockedInIncident is gone, so an incident is draggable out of");
        const body = src.slice(at, at + 600);

        /*
         * THE GUARANTEE IS THE SAME; THE ROAD TO IT MOVED (LIVE-001).
         *
         * This used to read `state.killerId`, `state.victimId` and
         * `state.thirdId` straight off the world setting. The names are not in
         * world data any more, so the lock asks `incidentParticipants()` - and
         * the thing worth testing is unchanged: all three are held, and only
         * during the fight.
         *
         * Both halves are checked, because the guarantee now spans two files
         * and a rename in either would break it silently: this file must ASK,
         * and settings.mjs must answer with all three.
         */
        ok(/incidentParticipants\(\)/.test(body),
            "the lock no longer asks who is in the incident");
        const settingsSrc = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/settings.mjs`).then(r => r.text()));
        const fnAt = settingsSrc.indexOf("function incidentParticipants");
        ok(fnAt > 0, "incidentParticipants is gone, so nothing can be held in place");
        const fnBody = settingsSrc.slice(fnAt, fnAt + 400);
        for (const who of ["killerId", "victimId", "thirdId"]) {
            ok(new RegExp(`cast\\.${who}`).test(fnBody),
                `${who} is not in the participant list, so they can walk out of an incident`);
        }

        // And the lock is still only the fight, so Stage 6 can move around.
        ok(/stage !== "incident"/.test(body),
            "the lock reaches beyond the fight, which would freeze the clean-up");
    }],

    ["an accomplice is not a witness to the crime they committed", async () => {
        /*
         * D13, Dawid 29.08. The Shadow roll asks "can they see what you are
         * doing"; a second killer already knows. Rolling against them made the
         * accomplice's presence a penalty on the clean-up.
         */
        const src = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/cleanup.mjs`).then(r => r.text()));

        const at = src.indexOf("function witnessesTo");
        ok(at > 0, "witnessesTo is gone, so accomplices count as witnesses again");
        const body = src.slice(at, at + 400);
        ok(/isCleaner\(actor\)/.test(body),
            "the exemption is not limited to the killers, so an innocent gets it too");
        ok(/killerIds/.test(body),
            "the exemption reads its own list instead of the one the stage admits people by");

        const conceal = src.indexOf("async function concealFromWitnesses");
        ok(conceal > 0, "concealFromWitnesses is gone");
        ok(/witnessesTo\(/.test(src.slice(conceal, conceal + 500)),
            "the Shadow roll still counts everybody in the room, accomplices included");
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
         * That is right for every other caller - a player asked for a ruling and
         * is waiting on it. A trap alert names the KILLER, so the ordinary path
         * posted into the killer's own thread a card saying their trap had been
         * tripped AND who tripped it, before the GM had ruled on anything.
         * Measured: "Player B, in Big IT Room", delivered to Player A.
         *
         * Read from the source rather than driven, because the failure is about
         * an ARGUMENT rather than an outcome - a scenario would have to arrange a
         * player client to catch it, and the thing that must never be forgotten
         * is one word at one call site.
         */
        const src = await fetch(`/modules/${MODULE_ID}/scripts/traps.mjs`).then(r => r.text());
        const call = src.slice(src.indexOf("callGm(trap.killer"), src.indexOf("callGm(trap.killer") + 400);
        ok(call.length > 20, "traps.mjs no longer calls callGm the way this test expects");
        ok(/gmOnly:\s*true/.test(call),
            "the trap alert does not pass gmOnly - it will be posted into the killer's own thread");
    }],

    ["no localise-or-fallback that can never reach its fallback", async () => {
        /*
         * `game.i18n.localize(key)` RETURNS THE KEY when it misses, and the key
         * is truthy - so `localize(k) || fallback` never reaches the fallback and
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
         * roll any more - it is a guarantee wearing dice.
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
         * here; `vaultRoomsFor` is not - the room lookups are `stashRoomsFor`
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
         * - always truthy - and agreed with everything.
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
         * squares belonging to two rooms at once. Dawid's call, 28.08 - write it
         * and fix the map, rather than leave the validator as a thing somebody
         * has to remember to run.
         *
         * WHY IT MATTERS EVEN THOUGH NOTHING VISIBLY BREAKS. Measured on the
         * broken map: the module answers with ONE room on a shared square, the
         * same one every time and the same on every client, because `roomOfToken`
         * sorts the names and takes the first. So there is no flicker, no
         * disagreement between two players, nothing to notice - and a character
         * standing in what looks like the Round Table is in the Dinner Hall for
         * every purpose the rules care about: which search tokens they spend,
         * which room their traces land in, who counts as alone with them.
         * Alphabetical order decides a murder alibi.
         *
         * And the second failure the same geometry causes is worse: where two
         * borders cross with no wall between them, `checkRegions` reports the
         * whole shared border reads as one doorway - a room you can walk out of
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
         * out with all five panes visible - five question marks, five copies of
         * the same sentence. Dawid found it at the table on 28.08.
         *
         * The class of defect is what this guards: a rule written to style what
         * is INSIDE a tab must not be able to decide whether the tab is on
         * screen. So any module selector that targets a tab pane and sets
         * `display` has to qualify itself with `.active` - otherwise it is
         * making that decision for every pane at once.
         *
         * Read from the file rather than the DOM. This only shows on a
         * player's client looking at somebody else's sheet, which is not where
         * this suite runs; the stylesheet is the same everywhere.
         */
        const raw = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        // COMMENTS OUT FIRST, and the first run of this test is why. The note
        // above the fixed rule QUOTES the broken one - "`.drpg-redacted-pane
        // { display: flex }` was written to…" - and a scanner reading prose as
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
         * Sound windows. It did - every window in the module did, because
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
            // The one window whose design is to reopen itself - after every
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
            // `resetSeason` by name: it is a window a GM ticks twenty-seven boxes
            // in (R-1), which is exactly what this list is for, and it is the one
            // such window whose name does not begin with "open" or "manage".
            const openers = [...text.matchAll(
                /^export (?:async )?function (open[A-Z]\w*|manage[A-Z]\w*|resetSeason)\s*\(/gm)];
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
         * the markup does not carry - where they scrolled, which sections they
         * folded, what they typed but have not saved - has to survive that, or
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
         * region - it waits.
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
             * A real blur fires `focusout` - in a window that has focus. This
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

    ["a portrait chosen in a live window survives the window redrawing itself", async () => {
        /*
         * F13. The hidden field is the record and the `<img>` is a view of it - and a
         * rebuild carries the field while redrawing the picture, so the two came out
         * of it disagreeing: the hazard icon over a path the GM had just chosen,
         * which reads as "it did not take".
         */
        const { wirePortraitPickers } = await import("./utils.mjs");

        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-3000px;top:0;width:200px";
        host.innerHTML = `
            <img data-drpg-portrait="s1__t1" src="icons/svg/hazard.svg">
            <input type="hidden" name="img.s1__t1" value="icons/svg/hazard.svg">
            <img data-drpg-portrait="new" src="icons/svg/item-bag.svg">
            <input type="hidden" name="img.new" value="">`;
        document.body.appendChild(host);

        try {
            // Exactly what a rebuild leaves behind: `restore` has put the GM's pick
            // back into the hidden field, and the picture was drawn from the ledger,
            // which has not been saved yet.
            host.querySelector('[name="img.s1__t1"]').value = "worlds/x/knife.webp";
            wirePortraitPickers(host, { defaultImg: "icons/svg/hazard.svg" });

            equal(host.querySelector('[data-drpg-portrait="s1__t1"]').getAttribute("src"),
                "worlds/x/knife.webp",
                "a redrawn row shows the ledger's picture over the path the GM had just chosen");
            // A window whose hidden field is deliberately empty keeps its default.
            equal(host.querySelector('[data-drpg-portrait="new"]').getAttribute("src"),
                "icons/svg/item-bag.svg",
                "an empty hidden field blanked a thumbnail that was showing a default");
        } finally {
            host.remove();
        }
    }],

    ["the Key Remnant limit's override still means yes after a redraw", async () => {
        /*
         * F14, driven over a REAL `keepLive`, because the bug is in the handover
         * between the two: the rows are drawn disabled again by the rebuild, and
         * `restore` puts the tick back with a property write - which fires no
         * `change`, so the listener that was the whole mechanism never ran.
         */
        const { keepLive } = await import("./live.mjs");
        const { wireKeyLimitOverride } = await import("./investigation.mjs");

        const build = () => `<div class="drpg-t-keys">
            <label><input type="checkbox" name="keyOverride"> more</label>
            <select name="room:4" class="drpg-key-limited" disabled>
                <option value="">-</option><option value="Kitchen">Kitchen</option></select>
            <select name="vis:4" class="drpg-key-limited" disabled>
                <option value="evident">evident</option></select>
        </div>`;
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-3000px;top:0;width:200px";
        host.innerHTML = build();
        document.body.appendChild(host);

        const app = { element: host, options: { window: { title: "test" } } };
        const stop = keepLive(app, {
            region: ".drpg-t-keys", build, delay: 0,
            after: () => wireKeyLimitOverride(host)
        });

        try {
            ok(wireKeyLimitOverride(host), "the override was not found in the markup");
            const box = () => host.querySelector('[name="keyOverride"]');
            const rows = () => [...host.querySelectorAll(".drpg-key-limited")];
            ok(rows().length === 2 && rows().every(el => el.disabled),
                "a row past the limit did not start out of reach");

            box().checked = true;
            box().dispatchEvent(new Event("change", { bubbles: true }));
            ok(rows().every(el => !el.disabled), "ticking the override did not free the rows");

            // The event every live window listens to.
            Hooks.callAll("drpgTimeOfDayChanged", {}, {});
            await wait(140);

            ok(box().checked === true, "the redraw unticked the override");
            ok(rows().every(el => !el.disabled),
                "the redraw put the rows back out of reach while the override was still ticked");
        } finally {
            stop();
            host.remove();
        }
    }]
,

    ["every setting that promises a redraw gets one", async () => {
        /*
         * `onChange: () => onWorldChange(SETTINGS.x)` says "when this changes,
         * refresh whatever shows it". `onWorldChange` keeps that promise by
         * looking the key up in `SETTING_KINDS` - and a key missing from that
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
        ok(promised.size, "no setting seems to promise a refresh - did onWorldChange move?");

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

    ["the three time Calls stay out of the armed-Call list", () => {
        // Sprint, Burst and Relief buy a state of the time of day, not a
        // modifier on the next roll. Since CALL-02 the armed list holds several
        // Calls, so one of these carrying `grants` would no longer evict a
        // Support - it would be SPENT by whatever roll happened next, which is
        // worse: four Hope of Burst gone to a statistic somebody clicked.
        for (const key of ["sprint", "burst", "relief"]) {
            const call = HOPE_CALLS[key];
            ok(call, `${key} is gone from the Hope Calls`);
            ok(!call.grants, `${key} would park itself in the armed list and be spent by the next roll`);
        }
    }],

    ["R41 - armed Calls stack, and the same one twice is refused", async () => {
        /*
         * CALL-02, Dawid 17.09. One slot meant a Monokuma's Obstacle silently ate the
         * Support a player had just paid for, with nothing refunded. They stack now:
         * the dice ones sum, the rest all apply, and a second copy of the same Call is
         * refused before the price is paid.
         */
        const sources = new Map(await otherSources());
        const effects = stripComments(sources.get("call-effects.mjs") ?? "");
        const dialog = stripComments(sources.get("roll-dialog.mjs") ?? "");
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");

        ok(/export function pendingCalls\(/.test(effects), "the armed Calls are a single slot again");
        ok(/Array\.isArray\(stored\)/.test(effects),
            "a world armed before the change holds one object, and nothing reads that shape");
        ok(/export function alreadyArmed\(/.test(effects)
            && /alreadyArmed\(target, call\)/.test(effects),
            "a second copy of the same Call is not refused before it is paid for");
        ok(!/setFlag\([^)]*FLAGS\.pendingCall/.test(bridge),
            "the bridge writes the armed slot directly again, so arming on somebody's behalf evicts");
        ok(/appendArmedCall\(/.test(bridge), "the bridge no longer appends to the armed list");
        ok(/function callDice\(/.test(dialog) && /callDice\(actor\)/.test(dialog),
            "the roll window counts one Call's die instead of adding them up");
        ok(/consumeCalls\(actor\)/.test(rolls), "an action roll spends only one of the armed Calls");
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

    ["every table name the installer builds is one classifyTableName can read back", async () => {
        /*
         * TABLES-01. The classifier is the create path's only way of knowing what a GM
         * just made, and it answers by asking `tableNameCandidates` - so this walks the
         * same set the installer builds and requires the round trip, then the four
         * shapes that must come back null.
         */
        const t = await import("./tables.mjs");
        const { ITEM_TIERS } = await import("./config.mjs");

        for (const category of Object.keys(t.ITEM_POOLS)) {
            for (const tier of ITEM_TIERS) {
                const name = t.tableName(category, tier);
                const read = t.classifyTableName(name);
                ok(read, `"${name}" is not recognised at all`);
                equal(read.category, category, `"${name}" was read as ${read?.category}`);
                equal(read.tier, tier, `"${name}" was read as tier ${read?.tier}`);
                equal(read.goal, null, `"${name}" came back with a goal on it`);
            }
        }
        for (const goal of Object.keys(t.USABLE_GOALS)) {
            for (const tier of ITEM_TIERS) {
                const name = t.tableName("usable", tier, goal);
                const read = t.classifyTableName(name);
                ok(read?.goal === goal && read?.category === "usable",
                    `"${name}" was read as ${JSON.stringify(read)}`);
            }
        }

        // The four that must not be recognised, and each says something different:
        // a tier nothing draws from, a goal on a category that has none, a prefix
        // without a family, and a room pool's ordinary name.
        for (const name of ["DRPG Tools - Tier 9", "DRPG Murder Weapons (Healing) - Tier 2",
            "DRPG Truth Bullets - Tier 2", "Kitchen cupboard"]) {
            equal(t.classifyTableName(name), null, `"${name}" was filed as a module table`);
        }
    }],

    ["every string the code asks for exists in the language file", () => {
        // Only the keys spelled out as literals - a key built from a variable
        // cannot be checked from here, and pretending otherwise would make this
        // test lie in the reassuring direction.
        const missing = [];
        for (const key of LITERAL_KEYS) {
            if (!game.i18n.has(key)) missing.push(key);
        }
        ok(!missing.length, `missing: ${missing.slice(0, 8).join(", ")}`);
    }],

    /* ---- the audit of 1.2.27: the three things it could not check by reading ------------
       Each of these was a defect nobody saw until a screenshot arrived from a tablet, and
       each is cheap to measure on a live client. They only run under the theme they are
       about; under Monokuma Legacy they pass by saying so. */
    ["the curtain cuts a clean partition", async () => {
        const { CHECKS, refreshGlass } = await import("./glass.mjs");
        if (!document.body.classList.contains("drpg-theme-stained-glass")) return;
        refreshGlass();
        await wait(300);
        const c = CHECKS[CHECKS.length - 1];
        ok(c, "the curtain never reported a self-check - it did not cut");
        ok(!c.overlaps && !c.nonconvex && !c.blockFails && !c.edgeGaps,
            `overlaps ${c.overlaps}, non-convex ${c.nonconvex}, blocks off their pane ${c.blockFails}, gaps at the edge ${c.edgeGaps}`);
    }],

    ["no chrome label is cut off", () => {
        if (!document.body.classList.contains("drpg-theme-stained-glass")) return;
        // A box one pixel shorter than the text inside it is the "MUNUKUMA" defect: VT323's
        // capitals are tall for its em, and a box sized in another face clips them.
        const cut = [];
        for (const sel of ["#drpg-hud", "#drpg-despair", "#drpg-player-status", "#drpg-events", "#countdowns"]) {
            const host = document.querySelector(sel);
            if (!host) continue;
            for (const el of host.querySelectorAll("div, span, b, h4")) {
                if (!el.offsetWidth || el.children.length) continue;
                if (getComputedStyle(el).overflow === "visible") continue;
                if (el.scrollHeight > el.clientHeight + 1) cut.push(`${sel} ${el.className || el.tagName} ${el.scrollHeight}>${el.clientHeight}`);
            }
        }
        ok(!cut.length, cut.slice(0, 4).join("; "));
    }],

    ["nothing in the chrome is set under the floor", () => {
        if (!document.body.classList.contains("drpg-theme-stained-glass")) return;
        // 11 px, at every interface scale - see docs/design/typography.md.
        const floor = parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-sg-floor")) || 11;
        const small = [];
        for (const sel of ["#drpg-hud", "#drpg-despair", "#drpg-player-status", "#drpg-events", "#countdowns", ".drpg-panel"]) {
            for (const host of document.querySelectorAll(sel)) {
                for (const el of host.querySelectorAll("*")) {
                    if (!el.offsetWidth || !el.textContent.trim() || el.matches("i, [class*='fa-']")) continue;
                    const size = parseFloat(getComputedStyle(el).fontSize);
                    if (size && size < floor - 0.5) small.push(`${el.className || el.tagName} ${size.toFixed(1)}px`);
                }
            }
        }
        ok(!small.length, small.slice(0, 4).join("; "));
    }],

    ["the theme speaks two faces", () => {
        if (!document.body.classList.contains("drpg-theme-stained-glass")) return;
        // Stained Glass is VT323 and Special Elite and nothing else (docs/design/typography.md):
        // the first family every module surface resolves to is one of the two. Icon elements
        // are their own face by design, and are skipped.
        const other = new Set();
        for (const sel of ["#drpg-hud", "#drpg-gm-launcher", "#drpg-despair", "#drpg-player-status", "#drpg-events",
                           "#countdowns", "#drpg-popups", ".drpg-panel", ".drpg-messenger", "#players"]) {
            for (const host of document.querySelectorAll(sel)) {
                for (const el of [host, ...host.querySelectorAll("*")]) {
                    if (el.matches("i, canvas, [class*='fa-']")) continue;
                    const family = getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim();
                    if (!/^(VT323|Special Elite)$/.test(family)) other.add(`${sel} ${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} -> ${family}`);
                }
            }
        }
        ok(!other.size, [...other].slice(0, 4).join("; "));
    }],

    ["the notice tile is always cut", async () => {
        const { LAST } = await import("./glass.mjs");
        if (!document.body.classList.contains("drpg-theme-stained-glass")) return;
        // The bottom-left tile is part of the curtain's one shape, with or without a card on
        // it (1.2.36): a notice lands on glass that was already there.
        const tile = LAST.blocks.find(b => b.cls === "note-block");
        ok(tile, "no pane was cut for the notices");
        ok(tile.x === 16 && tile.w > 100, `the notice tile is at ${tile.x},${tile.y} ${tile.w}x${tile.h}`);
    }],

    ["the theme tokens resolve", () => {
        const root = getComputedStyle(document.documentElement);
        for (const token of ["--drpg-ink", "--drpg-bone", "--drpg-eye", "--drpg-blood",
                             "--drpg-gold", "--drpg-pix-skull", "--drpg-pix-query"]) {
            ok(root.getPropertyValue(token).trim(), `${token} is empty`);
        }
    }],

    ["nothing is repainting the page", () => {
        // Not a module bug when it fails - but every colour measurement in this
        // suite and every visual judgement at the table is worthless while it is
        // true, so it is worth saying out loud. See `detectPageTinting`.
        const tint = detectPageTinting();
        ok(!tint, `${tint?.name} is restyling the page - ${tint?.evidence}`);
    }],

    ["no Remnant token carries the answer key", () => {
        // The leak this suite exists to keep shut. A Remnant token travels to
        // every client, hidden or not, so anything on it beyond the marker is
        // readable from a player's console - measured before the fix: forty
        // traces with who left each one, whether it belonged to the murder, and
        // the GM's own sentence about it.
        /*
         * TWO FIELDS ARE ALLOWED, AND THE SECOND IS AN ARGUED EXCEPTION (D11).
         *
         * `fromIncident` is a boolean saying "this marker was made during an
         * incident", and it is on the token because `applyToRemnantToken` runs
         * on a PLAYER's client and has to decide whether that viewer is one of
         * the people who watched the trace being made. The ledger cannot answer
         * that - `remnantData` is null off a GM - and the participant list the
         * check needs is the live murder state, which a player's client already
         * holds.
         *
         * What it costs: a player reading their own console can tell a crime
         * scene's traces from preparation traces. What it does NOT carry is the
         * band, the type beyond that boolean, who left it, or a word of what it
         * says - all of which is what this test was written to keep off a token.
         *
         * A socket addressed to the participants would carry the same fact
         * without putting it in the world, and is the better shape if this ever
         * needs to say more than one bit. It says one bit.
         *
         * Everything ELSE still fails, which is the point of listing the
         * exception rather than loosening the sweep.
         */
        const allowed = new Set(["isRemnant", "fromIncident"]);
        const leaks = [];
        for (const scene of game.scenes) {
            for (const token of scene.tokens) {
                if (!token.getFlag(MODULE_ID, "isRemnant")) continue;
                const keys = Object.keys(token.flags?.[MODULE_ID] ?? {})
                    .filter(k => !allowed.has(k));
                if (keys.length) leaks.push(`${token.name}: ${keys.join(", ")}`);
            }
        }
        ok(!leaks.length, `${leaks.length} token(s) still carry it - ${leaks[0]}`);
    }],

    ["a Remnant token's name gives nothing away", () => {
        // The name used to BE the answer: "Obvious Faint Prep Remnant · Player B
        // · Search: Cleaning agent". Names travel with the token - and so does
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
        ok(!talkative.length, `${talkative.length} named for what they are - "${talkative[0]}"`);
    }],

    ["one account is only ever sent to one voice room", async () => {
        // A voice client is in a single breakout at a time. The loop used to
        // walk the ACTOR list and assign per actor, so an account owning two
        // characters in two rooms was sent to both on every pass - a full
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
        // a letter or a digit - so "Kitchen" and "Kitchen " were two rooms
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
                // Two regions with the SAME name are one room on purpose - a
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
    // not stay in step on their own - the panel shipped a release reading
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
        ok(!wrong.length, `these items carry a role no category answers to - ${wrong.join(", ")}`);
    }],

    /*
     * E7 RESTS ENTIRELY ON A FIELD THE SYSTEM OWNS.
     *
     * Stacked advantage is `DualityRoll#advantageNumber` and the `kh` its
     * `applyAdvantage()` attaches. If a Daggerheart update drops either, nothing
     * throws and nothing looks wrong: every roll simply gets one bonus die, and
     * a Hope Call spent in a favouring room is worth what the room was worth
     * alone. That is the same class of silent failure as the music, and it is
     * caught the same way - by asking whether the thing we are standing on is
     * still there.
     */
    ["Daggerheart still supports more than one advantage die", () => {
        const DualityRoll = game.system?.api?.dice?.DualityRoll;
        ok(DualityRoll, "Daggerheart's DualityRoll is not where this module looks for it");
        ok(Object.getOwnPropertyDescriptor(DualityRoll.prototype, "advantageNumber")?.set,
            "DualityRoll has no advantageNumber setter any more - stacked advantage would "
            + "collapse to a single die without a word from anybody");
        ok(typeof DualityRoll.prototype.applyAdvantage === "function",
            "DualityRoll.applyAdvantage is gone - it is what turns a count into `kh`");
    }],

    /*
     * THE MUSIC'S FAILURES ARE ALL SILENT (E6).
     *
     * Every other subsystem announces a mistake: a card that does not post, a
     * button that refuses. The music's mistakes are all the same shape - the
     * right thing not happening - and a table hears a state with no music as a
     * GM who has not got round to mapping it yet. So they are checked here
     * rather than at the table.
     */
    ["every music state has a label somebody can read", () => {
        for (const state of MUSIC_STATES) {
            const label = state.label ?? game.i18n.localize(state.labelKey);
            ok(label && label !== state.labelKey,
                `the music state "${state.key}" has no label - "${state.labelKey}" `
                + "is missing from lang/en.json, and the GM's mapping table would "
                + "show the key instead of a name");
        }
    }],

    // Order IS the rule in this list - the first state that applies wins - so
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
            + "take the music - the debate matches first");
        ok(debate < discussion,
            "trial.debate is below trial.discussion, so an open floor would never "
            + "take the music - the phase matches first");
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
            + "answers to that name - run game.drpg.migrate1_2_0({ force: true })");
    }],

    ["the stylesheet ships with the version it says it does", async () => {
        const css = stylesheetVersion();
        ok(css, "the stylesheet is not on this page at all - run game.drpg.diagnoseStyles()");

        /*
         * AGAINST THE MANIFEST FILE, NOT AGAINST `game.modules`.
         *
         * `moduleVersion()` reads the manifest Foundry parsed at startup, and
         * this server caches that: measured, module.json on disk said 1.1.33
         * while `game.modules.get(...).version` still said 1.1.30 - and the
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
    }],

    ["a chapter's Key Remnant plan is filed, not dropped, when the chapter ends", async () => {
        /*
         * `keyPlan()` MANUFACTURES a plan for whatever chapter the clock says,
         * which is right - last murder's clues are not this murder's blanks -
         * and it is exactly why the words a GM wrote had nowhere to go. The
         * first fold only fired when a plan for a different chapter was saved
         * OVER the old one, which is not what ending a chapter does, so the
         * archive measured empty a chapter later. `archiveKeyPlan` is the
         * explicit fold the chapter-end screen now calls.
         */
        const { archiveKeyPlan } = await import("./investigation.mjs");
        const before = game.settings.get(MODULE_ID, SETTINGS.keyRemnantPlan) ?? {};
        try {
            const chapter = getClock().chapter;
            await game.settings.set(MODULE_ID, SETTINGS.keyRemnantPlan, {
                chapter,
                entries: [{ scale: "standard", name: "A muddy print",
                    text: "It points at the east stair.", note: "Sakura size 9.",
                    tokenId: null, sceneId: null }]
            });

            ok(await archiveKeyPlan(chapter), "the plan was not filed");
            const after = game.settings.get(MODULE_ID, SETTINGS.keyRemnantPlan) ?? {};
            const kept = after.archive?.[chapter];
            ok(Array.isArray(kept), `chapter ${chapter} is not in the archive`);
            equal(kept[0]?.name, "A muddy print", "the archived row lost its name");
            equal(kept[0]?.text, "It points at the east stair.",
                "the archived row lost the words the players read");

            // A plan with nothing written in it is not worth a shelf.
            await game.settings.set(MODULE_ID, SETTINGS.keyRemnantPlan, {
                chapter, entries: [{ scale: "standard", name: "", text: "", note: "", tokenId: null }]
            });
            ok(!await archiveKeyPlan(chapter), "an empty plan was filed anyway");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.keyRemnantPlan, before);
        }
    }],

    ["the unfound-Key charge refuses once the clock has left the chapter", async () => {
        /*
         * THIS ONE BILLED A REAL WORLD BEFORE IT WORKED, which is why it is in
         * the suite. The first guard compared `keyPlan().chapter` with the
         * clock and could never fire - `keyPlan()` manufactures a plan for the
         * chapter the clock is on, so the two agree by construction. Run
         * against a world that had just closed a case it read "0 of 5 found",
         * concluded the whole bar was missed, and moved 12 Despair.
         *
         * The stored setting is the only thing that remembers which chapter was
         * actually planned, so that is what the guard reads. The pools are
         * measured either side here, because "returned null" and "charged
         * nothing" are two different claims and it was the second one that
         * failed.
         *
         * AND `keysCharged` IS CLEARED FIRST, or this test asks nothing. The
         * function opens with `if (trialProgress().keysCharged) return null`,
         * and on any world where a trial has already billed for its Key
         * Remnants that stamp is standing - so the first version of this test
         * got its `null` from the stamp, passed against the guard that could
         * never fire, and would have let the whole defect back in. The stamp
         * is also what the assertions read afterwards: the guard returns
         * BEFORE `setTrialProgress`, so a charge that got past it leaves the
         * stamp behind even when the pools happen not to move.
         */
        const { chargeForUnfoundKeys } = await import("./investigation.mjs");
        const { monokumas, getDespair } = await import("./despair.mjs");
        const { trialProgress, setTrialProgress } = await import("./vote.mjs");
        const plan = game.settings.get(MODULE_ID, SETTINGS.keyRemnantPlan) ?? {};
        const charged = trialProgress().keysCharged ?? false;
        const clock = getClock();
        const pools = () => monokumas().map(u => getDespair(u.id));
        const before = pools();
        try {
            await setTrialProgress({ keysCharged: false });
            await game.settings.set(MODULE_ID, SETTINGS.keyRemnantPlan, {
                chapter: clock.chapter,
                entries: [{ scale: "standard", name: "A muddy print", text: "",
                    note: "", tokenId: null, sceneId: null }]
            });
            await setClock({ ...clock, chapter: clock.chapter + 1 });

            equal(await chargeForUnfoundKeys(), null,
                "the charge went through for a chapter nobody can investigate any more");
            ok(!trialProgress().keysCharged,
                "the refused charge stamped the trial anyway, so the honest one can never be asked");
            equal(JSON.stringify(pools()), JSON.stringify(before),
                "the refused charge moved Despair anyway");
        } finally {
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.keyRemnantPlan, plan);
            await setTrialProgress({ keysCharged: charged });
            /* AND THE POOLS GO BACK, because the run where this test EARNS its
               keep is the run where the charge goes through - so the failing
               path is exactly the one that leaves 12 Despair in a real world.
               Proved by doing it: the sharpened version of this test billed the
               QA world on its first honest run. Written as values, since
               `adjustDespair` takes a delta and the delta is what went wrong. */
            const { setDespair } = await import("./despair.mjs");
            const users = monokumas();
            for (let i = 0; i < users.length; i++) {
                if (getDespair(users[i].id) !== before[i]) await setDespair(users[i].id, before[i]);
            }
        }
    }],

    ["closing the trial puts the room back into Daily Life", async () => {
        /*
         * The one route back, exercised rather than read. A trial that ends without
         * this leaves the campaign in `classTrial` - which since T-1 means every
         * action tile but Analyze, every room crossing, every Despair Call and
         * Confusion stay shut; it holds every HUD on "Class Trial"; and it cannot be
         * undone from anywhere except Edit Campaign by hand.
         *
         * The elapsed clock is restarted too, and that is not decoration: the Daily
         * Life that follows a trial is measured from the trial ending, not from the
         * afternoon that led up to the body.
         */
        const { startFloor, trialFloor } = await import("./trial-floor.mjs");
        const { closeTrial } = await import("./trial-floor-ui.mjs");
        const clock = foundry.utils.deepClone(getClock());
        try {
            await startFloor({});
            equal(getClock().phase, "classTrial",
                "opening the floor did not put the campaign into the trial");
            ok(trialFloor(), "the floor did not open");

            const started = getClock().timeOfDayStartedAt;
            ok(await closeTrial(), "closeTrial refused");
            equal(getClock().phase, "dailyLife",
                "the trial closed and left the campaign in the Class Trial");
            equal(trialFloor(), null, "the trial closed with the floor still open");
            ok(getClock().timeOfDayStartedAt !== started,
                "the elapsed clock did not restart, so the Daily Life after the trial is "
                + "measured from before the body was found");
        } finally {
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
        }
    }],

    ["the End of chapter screen closes the trial", async () => {
        /*
         * THE WIRING, EXERCISED. `applyChapterEnd` is the screen without the screen -
         * see its own header for why it was split out - so this asks the question a GM
         * asks by pressing the button, rather than asking whether a word appears in a
         * file. The first attempt at this test did the latter and passed against a call
         * deliberately disabled.
         *
         * Only `endTrial` is ticked. The clock deliberately does not move: what is
         * under test is that the room empties, and a chapter that also advanced would
         * make the failure harder to read.
         */
        const { applyChapterEnd } = await import("./chapter.mjs");
        const { startFloor, trialFloor } = await import("./trial-floor.mjs");
        const clock = foundry.utils.deepClone(getClock());
        try {
            await startFloor({});
            equal(getClock().phase, "classTrial", "the fixture did not open a trial");

            await applyChapterEnd({ endTrial: true });

            equal(getClock().phase, "dailyLife",
                "the chapter ended and left the campaign in the Class Trial - every HUD "
                + "reads Class Trial into the next chapter and the panel says so too");
            equal(trialFloor(), null,
                "the chapter ended with the debate floor still open");

            /* AND IT DOES NOTHING WHEN THERE IS NOTHING TO DO. The box is disabled out
               of a trial, but a macro can pass anything, and "close the trial" out of
               Daily Life must not restart the elapsed clock on a time of day that is
               half spent. */
            const started = getClock().timeOfDayStartedAt;
            await applyChapterEnd({ endTrial: true });
            equal(getClock().timeOfDayStartedAt, started,
                "closing a trial that was not sitting restarted the time of day");
        } finally {
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, {});
        }
    }],

    ["a trial record remembers the chapter it was stamped with", async () => {
        /*
         * `trialProgress()` answers BLANK for a record from another chapter, and it is
         * right to: a fresh trial must not think its vote is already in. But the blank
         * is also what hid the state the panel could not name - a trial still sitting
         * for a chapter that has been ended - so `trialProgressChapter()` reads the
         * stamp itself. If it ever starts answering from the same blank, the backstop
         * line goes quiet and nothing says so.
         */
        const { trialProgress, trialProgressChapter, setTrialProgress } = await import("./vote.mjs");
        const stored = foundry.utils.deepClone(
            game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {});
        const clock = foundry.utils.deepClone(getClock());
        try {
            await setTrialProgress({ voteClosed: true, verdictApplied: true });
            const was = getClock().chapter;
            equal(trialProgressChapter(), was, "the stamp does not read back");

            await setClock({ chapter: was + 1 });
            equal(trialProgressChapter(), was,
                "the stamp followed the clock instead of staying with its own trial");
            equal(trialProgress().verdictApplied, false,
                "the new chapter inherited the last trial's verdict");
            equal(trialProgress().keysCharged, false,
                "a fresh chapter's record is missing `keysCharged`, so the same record "
                + "has two shapes depending on whether its trial has been charged");
        } finally {
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialProgress, stored);
        }
    }],

    ["a window closes without waiting for a transition that never started", async () => {
        /*
         * AWAIT-CLOSE-SITES and RM-CLOSE-1000. Foundry waits up to a second for a close to
         * finish animating; with no transition running that second is pure stall, and every
         * tile of the GM panel paid it. Asked of the installed wrapper, on an element nothing
         * animates.
         */
        const proto = foundry.applications.api.ApplicationV2.prototype;
        equal(proto._awaitTransition?.name, "drpgAwaitTransition", "the transition guard is not installed");
        equal(proto.close?.name, "drpgClose", "the close wrapper is not installed");
        const probe = document.createElement("div");
        document.body.appendChild(probe);
        try {
            const started = performance.now();
            await proto._awaitTransition.call(null, probe, 1000);
            const ms = performance.now() - started;
            ok(ms < 250, `a close with no transition running waited ${Math.round(ms)} ms - Foundry's fallback, not a transition`);
        } finally {
            probe.remove();
        }
    }],

    ["a Level Up is not a sheet waiting to be set up", async () => {
        /*
         * SEASON-01, reproduced on 16.09: a student with Health max 5 was listed as not set up,
         * and one Do it put the maximum back to 4.
         */
        const { STARTING } = await import("./config.mjs");
        const { needsStartingResources } = await import("./character.mjs");
        const sheet = (hp, stress) => ({ system: { resources: {
            hitPoints: { max: hp, value: 0 }, stress: { max: stress, value: 0 } } } });
        ok(needsStartingResources(sheet(0, 0)), "a sheet never set up is not offered its starting resources");
        ok(!needsStartingResources(sheet(STARTING.hp, STARTING.stress)),
            "a sheet at the starting numbers is offered them again");
        ok(!needsStartingResources(sheet(STARTING.hp + 1, STARTING.stress)),
            "a Level Up in Health reads as a sheet waiting to be set up");
        ok(!needsStartingResources(sheet(STARTING.hp, STARTING.stress + 1)),
            "a Level Up in Sanity reads as a sheet waiting to be set up");
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
    // E12. Every one of these is said on a client that did not decide it - a
    // GM-side refusal, a victim's whisper, a row that outlived its item - so a
    // missing key here renders as a raw string in front of a player.
    "DRPG.Tamper.notFound", "DRPG.Tamper.nothingOfYours", "DRPG.Tamper.onlyReinforced",
    "DRPG.Steal.caughtTaking", "DRPG.Steal.caughtTrying", "DRPG.Steal.nobodyHere",
    "DRPG.Steal.cardSeen", "DRPG.Steal.cardUnseen", "DRPG.Steal.cardHandsFull",
    "DRPG.Items.rowGone",
    "DRPG.Reroll.stealStands", "DRPG.Reroll.trailStands",
    "DRPG.Analyze.findStash", "DRPG.Analyze.stashSent",
    // F8 and F11. Both of these are printed only in a state a GM reaches rarely -
    // a debate past its budget, a window refused at the door - which is exactly
    // when a raw key on screen goes unreported.
    "DRPG.Floor.holdingDiscussionOver", "DRPG.Eclipse.murderWindowLocked"
];

/* ==========================================================================
 * TIER 2 - SCENARIOS
 * ========================================================================== */

/**
 * Everything a scenario is allowed to disturb, recorded so it can be put back.
 *
 * The clock and the incident are world settings; resources are actor data. A
 * scenario that throws half way through still gets restored, because the restore
 * runs from `finally` in the runner rather than at the end of the test.
 */
async function snapshot(cast) {
    /*
     * DESPAIR AND THE OVERFLOW, for the same reason Hope is here.
     *
     * Measured on 10.09: pools 12 / 0 and overflow 75 before a clean 124/0 run,
     * overflow 76 after. Every scenario that opens a murder generates Despair,
     * the pools cap, and the excess spills into a counter that drives the
     * Eclipse - so a suite nobody was watching walked the world one step
     * towards an event the GM never called. It looks like nothing for a day and
     * then it is the reason a season went dark early.
     */
    const { monokumas, getDespair } = await import("./despair.mjs");
    return {
        clock: foundry.utils.deepClone(getClock()),
        despair: monokumas().map(user => ({ id: user.id, value: getDespair(user.id) })),
        overflow: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {}),
        murder: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.murderState) ?? {}),
        // The other half of the incident (LIVE-001). Client-scoped, and taken
        // with the world half or a scenario that opens a murder leaves this
        // browser holding a cast for an incident that no longer exists - which
        // is exactly the shape of dirt this snapshot exists to prevent.
        cast: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.incidentCast) ?? {}),
        blackened: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.blackenedLedger) ?? []),
        // E14. Both are world settings a scenario below writes, and both are
        // visible to the whole table - a suite that leaves a motive standing
        // has announced one at somebody's game.
        motive: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.motive) ?? {}),
        gather: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.pendingGather) ?? {}),
        // HOPE AS WELL AS THE TWO REVERSE RESOURCES.
        //
        // It was missing, and the suite therefore paid its fixture actor one
        // Hope per run and never took it back. Measured: three students set to
        // 3, one clean 22/22 pass, and the roller came out at 4 while the other
        // two were untouched - so three runs in an afternoon leave a character
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
        // An incident drops Remnants of its own - the opening roll leaves one,
        // every crisis action can leave another - and they are world objects
        // that outlive the test and change what the NEXT measurement sees. The
        // first version of this suite passed all six scenarios and left three
        // Remnants behind, which is the failure this file's own header warns
        // about. Recorded as ids rather than a count so the restore removes
        // exactly what appeared and never touches anything that was already
        // there.
        // `game.scenes` is a Foundry Collection, which has `map` and `filter`
        // but NOT `flatMap` - the first version used it, threw inside the
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
    const { setDespair, getDespair } = await import("./despair.mjs");
    // Written as values, not deltas: the delta is the thing that went wrong.
    for (const row of snap.despair ?? []) {
        if (getDespair(row.id) !== row.value) await setDespair(row.id, row.value);
    }
    await game.settings.set(MODULE_ID, SETTINGS.overflow, snap.overflow);
    await game.settings.set(MODULE_ID, SETTINGS.murderState, snap.murder);
    await game.settings.set(MODULE_ID, SETTINGS.incidentCast, snap.cast);
    await game.settings.set(MODULE_ID, SETTINGS.motive, snap.motive);
    await game.settings.set(MODULE_ID, SETTINGS.pendingGather, snap.gather);
    // Put the register back as it was rather than emptying it: a suite run
    // during a chapter that already had a killing used to erase that fact.
    await game.settings.set(MODULE_ID, SETTINGS.blackenedLedger, snap.blackened);

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
    const roster = studentActors().filter(a => !a.getFlag(MODULE_ID, FLAGS.deceased));
    if (roster.length < 3) {
        throw new Failure(`need three living students, found ${roster.length}`);
    }
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

        // The victim's turn always passes to the FIRST killer - not to
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
        // victim, killer(B) - the victim got a breather neither killer earned,
        // and the round advanced twice for one lap of the killers. The second
        // killer's turn must follow the first DIRECTLY, with the round number
        // unmoved.
        await drpg.passTurn();
        await settle();
        state = murder.murderState();
        equal(state.turnSide, "killer", "the second killer's turn follows the first directly, not the victim's");
        equal(state.killerTurnId, third.id, "turn hands to the second killer");
        equal(state.turn, startTurn, "the round has not advanced - the killers' side is not done yet");
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
        // `openMurder` that happens WHILE an Eclipse is closing - a Direct
        // Murder declared in the dark is parked, not opened, and only judged
        // from inside `endEclipse`, after the clock has already cleared the
        // Eclipse flag. This pins both halves of that: the new guard actually
        // refuses while the flag is set, and the flag really is gone by the
        // time `endEclipse` would call `openMurder` for a parked declaration -
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
        // exactly why the bug - `remnantData()` returning null for anybody else
        // - never showed up running this suite as the world's GM. What this
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
            type: "prep", visibility: "evident", note: "test fixture - cleanup bridge"
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
         * stops "the window opens" from quietly stopping being true - which is
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
        // is the state trap 96 is about - a player who cannot pay for anything
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
        // (trap 98). The receipt is per spend, so this rebuilds the state.
        await grantFreeActions(who, 1);
        const burst = await spendAction(who, 1);
        await settle();
        await refundAction(who, 1, burst);
        await settle();
        equal(freeActionsLeft(who), 1, "the refund did not give the Burst back");
        equal(who.system.resources.actions.value, 0,
            "the refund turned a Burst into an action out of nowhere");

        // TWO SPENDS OPEN AT ONCE, REFUNDED IN THE OTHER ORDER (review of ACT-07).
        // Paying before the roll leaves a roll window open between a spend and its
        // refund, and the old one-slot bookkeeping gave the first refund whatever
        // the last spend had been.
        await who.update({ "system.resources.actions.value": 1 });
        await settle();
        const first = await spendAction(who, 1);      // the banked Burst pays
        const second = await spendAction(who, 1);     // an action pays
        await settle();
        ok(first?.grant && second && !second.grant, "the two spends were not a Burst and then an action");
        await refundAction(who, 1, first);
        await refundAction(who, 1, second);
        await settle();
        equal(freeActionsLeft(who), 1, "refunding in the other order lost the Burst");
        equal(who.system.resources.actions.value, 1, "refunding in the other order lost the action");

        // And the time of day takes both counters with it.
        await actions.grantFreeMoves(who, 2);
        await actions.resetActionsFor(who);
        await settle();
        equal(freeActionsLeft(who), 0, "a Burst survived the reset");
        equal(actions.freeMovesLeft(who), 0, "a Sprint survived the reset");

        /*
         * UNLESS THE REFILL SAYS OTHERWISE (T-1). One caller refills a budget
         * without ending the time of day, and a Burst bought with four Hope must
         * not expire because the actions came back.
         */
        await actions.grantFreeActions(who, 1);
        await actions.grantFreeMoves(who, 1);
        await actions.resetActionsFor(who, { keepGrants: true });
        await settle();
        equal(freeActionsLeft(who), 1, "keepGrants still took the Burst");
        equal(actions.freeMovesLeft(who), 1, "keepGrants still took the Sprint");
        await actions.resetActionsFor(who);
        await settle();
    }],

    ["a price walks action, then Hope, then Sanity, and then stops", async () => {
        /*
         * T-1's whole rule, in one actor. The chain is walked from the top every
         * time it is asked, so what a player can pay decides what they pay - and
         * when they can pay nothing, the refusal says WHICH kind of nothing it is,
         * because C5 offers a free Present for one of them and not for the other.
         */
        const [who] = cast();
        const P = await import("./price.mjs");
        const { grantFreeActions } = await import("./actions.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };
        const sanityMax = who.system.resources.stress.max;

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.hope.value": 2,
                "system.resources.stress.value": 0
            });
            await settle();
            equal(P.quotePrice(who, "objection").pay, "action",
                "an Objection with an action left did not cost the action");

            // No actions, one Burst: still the action step, and the quote says a
            // Burst is what would pay it.
            await who.update({ "system.resources.actions.value": 0 });
            await grantFreeActions(who, 1);
            await settle();
            const burst = P.quotePrice(who, "objection");
            equal(burst.pay, "action", "a banked Burst did not cover the action step");
            ok(burst.grant, "the quote did not say the Burst is what pays");

            // No actions, no Burst, two Hope: the second step.
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await settle();
            const hope = P.quotePrice(who, "objection");
            equal(hope.pay, "hope", "an Objection with no actions did not fall through to Hope");
            equal(hope.held, 2, "the quote did not say how much Hope is held");

            // No actions, no Hope, one point of Sanity left: the last step, and it
            // is the last mark.
            await who.update({
                "system.resources.hope.value": 0,
                "system.resources.stress.value": sanityMax - 1
            });
            await settle();
            const sanity = P.quotePrice(who, "objection");
            equal(sanity.pay, "stress", "an Objection with no actions and no Hope did not reach Sanity");
            ok(sanity.lastSanity, "the quote did not warn that this is the last mark");
            ok(P.priceLine(who, sanity).includes(
                game.i18n.localize("DRPG.Price.will.breakdown")),
                "the sentence does not say that paying it breaks them down");

            // Nothing at all left.
            await who.update({ "system.resources.stress.value": sanityMax });
            await settle();
            const stuck = P.quotePrice(who, "objection");
            equal(stuck.pay, null, "a full Sanity track still quoted a price");
            equal(stuck.blockedKind, "nothingLeft", "an empty pocket was not reported as one");
            ok(stuck.blocked && !stuck.blocked.includes("DRPG."),
                `the refusal is a key rather than a sentence: ${stuck.blocked}`);

            // Tamper has no Hope step, deliberately (Dawid, 17.09).
            await who.update({
                "system.resources.hope.value": 5,
                "system.resources.stress.value": 0
            });
            await settle();
            equal(P.quotePrice(who, "tamper").pay, "stress",
                "Tamper took Hope, which is the one currency it must not take");

            // The killer in their own Stage 6 skips the action step and still pays.
            await who.update({ "system.resources.actions.value": 2 });
            await settle();
            equal(P.quotePrice(who, "tamper", { skip: ["action"] }).pay, "stress",
                "skipping the action step did not start the chain at its Sanity step");

            // Analyze's later steps exist only inside a Class Trial.
            await who.update({ "system.resources.actions.value": 0 });
            await settle();
            const daytime = P.quotePrice(who, "analyze");
            equal(daytime.pay, null, "Analyze outside a trial fell through to Hope");
            equal(daytime.blockedKind, "nothingLeft", "the daytime refusal was the wrong kind");
            await setClock({ ...clock, phase: "classTrial" });
            equal(P.quotePrice(who, "analyze").pay, "hope",
                "Analyze inside a trial did not fall through to Hope");
        } finally {
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
        }
    }],

    ["payPrice writes one field, refundPrice puts it back", async () => {
        const [who] = cast();
        const P = await import("./price.mjs");
        const actions = await import("./actions.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);

            // The action step: one field moves, and only one.
            await who.update({
                "system.resources.actions.value": 2,
                "system.resources.hope.value": 3,
                "system.resources.stress.value": 1
            });
            await settle();
            const paidAction = await P.payPrice(who, "objection");
            await settle();
            equal(paidAction?.pay, "action", "the action step did not pay");
            equal(who.system.resources.actions.value, 1, "the action was not spent");
            equal(who.system.resources.hope.value, 3, "paying an action moved the Hope");
            equal(who.system.resources.stress.value, 1, "paying an action marked Sanity");
            ok(await P.refundPrice(who, paidAction), "the action refund refused");
            await settle();
            equal(who.system.resources.actions.value, 2, "the action did not come back");

            // The Hope step.
            await who.update({ "system.resources.actions.value": 0 });
            await settle();
            const paidHope = await P.payPrice(who, "objection");
            await settle();
            equal(paidHope?.pay, "hope", "the Hope step did not pay");
            equal(who.system.resources.hope.value, 2, "the Hope was not spent");
            equal(who.system.resources.stress.value, 1, "paying Hope marked Sanity");
            ok(await P.refundPrice(who, paidHope), "the Hope refund refused");
            await settle();
            equal(who.system.resources.hope.value, 3, "the Hope did not come back");

            // The Sanity step. Paying ADDS a mark; the refund lifts that same mark.
            await who.update({ "system.resources.hope.value": 0 });
            await settle();
            const paidSanity = await P.payPrice(who, "objection");
            await settle();
            equal(paidSanity?.pay, "stress", "the Sanity step did not pay");
            equal(who.system.resources.stress.value, 2, "the Sanity mark was not made");
            ok(await P.refundPrice(who, paidSanity), "the Sanity refund refused");
            await settle();
            equal(who.system.resources.stress.value, 1, "the Sanity mark was not lifted");

            /*
             * A BURST COMES BACK AS A BURST (trap 98), which is the whole reason the
             * receipt exists: a critical Tamper paid for with four Hope of Burst must
             * not turn into an action nobody had.
             */
            await actions.grantFreeActions(who, 1);
            await who.update({ "system.resources.hope.value": 3 });
            await settle();
            const paidBurst = await P.payPrice(who, "objection");
            await settle();
            equal(paidBurst?.pay, "action", "the Burst did not pay the action step");
            ok(paidBurst?.grant, "the receipt did not record that a Burst paid");
            equal(actions.freeActionsLeft(who), 0, "the Burst was not consumed");
            ok(await P.refundPrice(who, paidBurst), "the Burst refund refused");
            await settle();
            equal(actions.freeActionsLeft(who), 1, "the refund did not give the Burst back");
            equal(who.system.resources.actions.value, 0,
                "the refund turned a Burst into an action out of nowhere");
            ok(P.paidLine(paidBurst).includes(game.i18n.localize("DRPG.Price.paid.burst")),
                "the card would not say a Burst paid for it");
        } finally {
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
        }
    }],

    ["the dead, a Monocub and a Monokuma are quoted no price at all", async () => {
        /*
         * A refusal that offers a fallback and one that must not (T-1). C5 answers
         * "nothingLeft" with a free Present; answering "noPrice" with one would hand
         * a corpse the floor of a Class Trial.
         *
         * Every flag is restored to a real `false` rather than deleted: `-=key` does
         * nothing in this Foundry without a forced replacement, so a fixture that
         * "cleaned up" that way would leave the world dirty for every test after it.
         */
        const [who] = cast();
        const P = await import("./price.mjs");
        const before = {
            deceased: Boolean(who.getFlag(MODULE_ID, FLAGS.deceased)),
            monocub: Boolean(who.getFlag(MODULE_ID, FLAGS.monocub)),
            monokuma: Boolean(who.getFlag(MODULE_ID, FLAGS.monokuma))
        };

        try {
            for (const flag of [FLAGS.deceased, FLAGS.monocub, FLAGS.monokuma]) {
                await who.setFlag(MODULE_ID, FLAGS.deceased, false);
                await who.setFlag(MODULE_ID, FLAGS.monocub, false);
                await who.setFlag(MODULE_ID, FLAGS.monokuma, false);
                await who.setFlag(MODULE_ID, flag, true);
                await settle();
                for (const key of Object.keys(PRICE_CHAINS)) {
                    const quote = P.quotePrice(who, key);
                    equal(quote.blockedKind, "noPrice",
                        `${flag} was quoted a ${key} price of the wrong kind`);
                    equal(quote.pay, null, `${flag} was quoted a ${key} price`);
                }
            }

            // And a key with no chain at all is the same kind of refusal.
            await who.setFlag(MODULE_ID, FLAGS.monokuma, false);
            await settle();
            equal(P.quotePrice(who, "longRest").blockedKind, "noPrice",
                "an action with no chain was reported as an empty pocket");
        } finally {
            await who.setFlag(MODULE_ID, FLAGS.deceased, before.deceased);
            await who.setFlag(MODULE_ID, FLAGS.monocub, before.monocub);
            await who.setFlag(MODULE_ID, FLAGS.monokuma, before.monokuma);
        }
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
        // Remnants and failed on any world that had none - a clean world most
        // of all.
        //
        // Four traces at one point share a room by construction: the same hit
        // test answers for all of them, holes and all. The anchor is any token
        // already standing in a room, which spares this test owning any region
        // geometry of its own.
        const anchor = scene?.tokens?.find(t => roomOfToken(t));
        ok(anchor, "no token on the active scene stands in any room - nowhere to build the fixture");

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
                    note: "test fixture - Observe ranking"
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
         * would render the list BEFORE `restore` put the select back - one
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

        /*
         * A CHAPTER OF ITS OWN, ABOVE ANYTHING THE WORLD HOLDS.
         *
         * The fixture used to stamp `chapter: 1` and days 1–3 and then assert
         * that "newest first" put its own D3 on top - which is only true on a
         * world with no traces later than day 3. The suite's own murder
         * scenarios leave incident traces stamped from the live clock, so on a
         * world sitting on day 11 the sort was correct and the assertion was
         * wrong. Measured: "QA Witness · Main Hall · Ch 1 · D 11" at the top,
         * which is genuinely the newest thing there.
         *
         * `when()` in investigation.mjs orders by chapter first, so one chapter
         * above the clock puts all three fixtures ahead of every trace the world
         * already had, and the D3 assertion below means what it says again.
         */
        const future = (getClock()?.chapter ?? 1) + 1;
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
                    chapter: future, day: one.day, timeOfDay: one.timeOfDay,
                    note: "test fixture - dashboard filters"
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
            ok(mine < all, `filtering by player showed ${mine} of ${all} - nothing was filtered`);
            equal(control("player").value, cast[1].id,
                "the chosen player did not survive the redraw it triggered");

            await choose("player", "");
            await choose("room", rooms[0]);
            const here = rows();
            ok(here < all, `filtering by room showed ${here} of ${all} - nothing was filtered`);
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
         * The downward half is old - the trace's record has always been pushed
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
                note: "test fixture - trace/bullet sync"
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
            await until(() => made.every(i => i.actor.items.get(i.id)?.name === said));
            for (const item of made) {
                const live = item.actor.items.get(item.id);
                equal(live?.name, said,
                    `${item.actor.name}'s copy did not take the trace's name`);
            }

            // ---- UP: one copy is corrected, and the record moves ------------
            const corrected = `Corrected ${Date.now() % 100000}`;
            await made[0].actor.items.get(made[0].id).update({ name: corrected });
            await settle();

            await until(() => remnants.remnantPublic(token)?.name === corrected);
            equal(remnants.remnantPublic(token)?.name, corrected,
                "an edit on a bullet never reached the trace it came from");

            // ---- AND BACK DOWN, to the copy nobody touched ------------------
            /* THE SECOND HOP IS THE ONE THAT WAS FLAKY. The trace has the words by the
               line above; this is the push back down to the holder nobody edited. */
            await until(() => two.items.get(made[1].id)?.name === corrected);
            equal(two.items.get(made[1].id)?.name, corrected,
                "the trace took the correction and the other holder never saw it");

            // ---- The words, not only the title -----------------------------
            await made[0].actor.items.get(made[0].id)
                .update({ "system.description": "<p>Rust in the hinge.</p>" });
            await settle();
            await until(() => remnants.remnantPublic(token)?.playerText === "Rust in the hinge.");
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
         * An OPENING shorter than a third of a square is discarded \- `shortest`
         * in `doorwayEdges`. A walled stretch had no such rule, and the two are
         * not symmetric in what they cost. One stray sample reading "wall" in
         * the middle of a long opening leaves a visible stretch a few pixels
         * long, and this outline is stroked with SQUARE caps: each end runs half
         * a line-width past the stretch, so anything shorter than one width
         * comes out as a solid wedge rather than a line \- alone in the middle
         * of an opening, ink keyline and all, far from any other outline.
         *
         * Reproduced on a fixture: a plain room whose whole top border is a
         * doorway, with ONE eight-pixel wall in the middle of it. The wall
         * splits the border into two openings, and the sliver of "wall" between
         * them is a two-point chain \- which the tracer stroked
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

        /* NOT the glow: it strokes the same path several times wider, so measuring it
           would ask whether the LIGHT is shorter than itself, which is not the question. */
        const graphics = group.children.find(c => !c.texture && c.geometry && c.name !== "drpgRoomOutlineGlow");
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
         * 45 degrees is not within twenty of nothing \- so the wall lying
         * exactly along the border closed nothing at all.
         *
         * Measured before the repair, on this fixture: fully open at every step
         * size from half a square to three. The distance never mattered; only
         * the angle did. What a table sees is a cut strip of doorway glow
         * sitting in the middle of a wall, far from any way through (Dawid,
         * 28.08, with screenshots).
         *
         * THREE SIZES, because the first diagnosis was that the staircase had
         * to be deep enough to push the border out of range \- and it was
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
                    + `${adrift ? ` \- ${String(adrift.detail).match(/^[\d.]+/)?.[0]} squares read as open` : ""}`);
            } finally {
                if (walls.length) await scene.deleteEmbeddedDocuments("Wall", walls);
                if (region) await scene.deleteEmbeddedDocuments("Region", [region.id]);
            }
        }

        /*
         * AND THE TEST STILL HAS TEETH. A border with no wall on it has to keep
         * reading as open, or the repair above is just a way of never finding a
         * doorway again \- which would take every glow off every map and
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

        // Down to zero, and STAYING there - the countdown must not delete the
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
         * who was merely unlucky - which is the one distinction the duality
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
         * afterwards. The last one is the point - a grant that survived its
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
        // incident - which is what "without rolling" has to mean.
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
         * It was attached to `endEclipse({ advance: false })` - a branch nothing
         * in the game takes, because an Eclipse ends BY advancing the clock.
         *
         * So this drives the DEFAULT path and reads the card that came out.
         * `playSfx` is local and this suite has no audio files, so what is
         * checked is the flag that carries the sound to the people the message
         * reached - which is the module's whole mechanism for a sound with an
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
            `no card carried the Eclipse's ending sound - got [${carried.join(", ")}]`);
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
            /* WAIT FOR THE CARD, NOT FOR 400 MS. The hook is synchronous, what it starts is
               not: the trap reads the room, decides, and posts a ChatMessage, which is a world
               write. This is the assertion that failed twice on 08-09.09 and passed on the
               re-run both times. The disarm below rides on the same chain, so it is waited for
               too - and both fall through to the assertion at the deadline. */
            await until(() => game.messages.size > count);
            await until(() => T.diagnoseTraps().armed === 0);
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
         * is about. So the ledger is keyed on a flag that travels - and the item
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
            // Name only. A plant carries no category and no tier of its own -
            // it arrives as whatever the finder searched for (A23).
            const identity = await T.plantItem("SUITE-project", room, {
                name: "SUITE planted kit"
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
         * roll breaks, and the module's answer is that nothing is ever deleted -
         * the same object stays in the bag marked Broken, so the player can see
         * what it cost them.
         *
         * A category that can be equipped and cannot be broken is a category
         * that never pays: a free permanent advantage nobody would notice was
         * free, because the only sign is a thing that never happens.
         *
         * Driven per category rather than read, because "can be broken" is three
         * facts at once - the flag lands, the item survives, and the equipment
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
         * 717 chat messages - exactly the GM's count - including every card it
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

            // What this client - a recipient, since GMs always are - can read.
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
         * sheet - the newly available Calls are still greyed out."
         *
         * WHY IT COULD NOT FIX ITSELF. A resource-only update deliberately SKIPS
         * the sheet render, because Daggerheart puts `transition: all` on the
         * sidebar and every redraw animated the whole left column. In its place
         * `repaintInPlace` draws by hand what the render would have drawn - and
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
         * "could not be played and will not be reported again this session" -
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

        // A file this install certainly has, and an event that does NOT vary -
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
         * UNION of every row in the discovery ledger - so a GM moving their own
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

    ["a trace is tied to the murder by what happened, not by what it is", async () => {
        /*
         * Dawid, 28.08: a trace is part of the murder when it DELIVERED the
         * object used in it, when it is the effect of a project tied to it,
         * when it was left during the incident, or when it was left cleaning up
         * afterwards.
         *
         * What it used to be was the CATEGORY of the thing found: a Search that
         * turned up anything filed as crime or cleaning gear tied itself on the
         * spot. A penknife nobody picked up again therefore sat at the top of
         * the dashboard's murder-first sort, beside the knife out of the body.
         *
         * Two of the four are checked here. The other two are already held: the
         * clean-up says so itself at three call sites, and the project rule is
         * one line beside the trace it places.
         */
        const remnants = await import("./remnants.mjs");
        const { roomOfToken } = await import("./movement.mjs");
        const scene = canvas?.scene;
        ok(scene, "no active scene");
        const anchor = Array.from(scene.tokens).find(t => roomOfToken(t));
        ok(anchor, "no token standing in a room to place a fixture beside");

        const placed = [];
        const place = async data => {
            const token = await remnants.placeRemnant({
                type: "prep", visibility: "evident", scene,
                x: anchor.x, y: anchor.y, note: "test fixture - what ties a trace",
                ...data
            });
            ok(token, "could not place a fixture trace");
            placed.push(token);
            return token;
        };

        try {
            /* ---- 1. THE OBJECT, once it turns out to be the weapon --------- */
            const identity = `suite-${Date.now().toString(36)}`;
            const handedOver = await place({ action: "search", itemIdentity: identity });
            ok(!remnants.remnantData(handedOver)?.tiedToCrime,
                "a Search tied itself to the murder before anything was used");

            const tied = await remnants.tieTraceForItem(identity);
            equal(tied, 1, "the weapon did not find the trace that handed it over");
            ok(remnants.remnantData(handedOver)?.tiedToCrime,
                "the trace that handed over the weapon is still not evidence");

            // And it does not tie anything else: another trace, another object.
            const unrelated = await place({ action: "search", itemIdentity: `${identity}-other` });
            equal(await remnants.tieTraceForItem(identity), 0,
                "tying the same object twice tied something a second time");
            ok(!remnants.remnantData(unrelated)?.tiedToCrime,
                "a trace holding a different object was tied to the murder");

            /* ---- 2. AND ANYTHING LEFT DURING AN INCIDENT ------------------- */
            const murder = await import("./murder.mjs");
            const running = Boolean(murder.murderState());
            const duringIncident = await place({ action: "dynamic" });
            equal(Boolean(remnants.remnantData(duringIncident)?.tiedToCrime), running,
                running
                    ? "an incident is running and the trace left during it is not tied"
                    : "no incident is running and the trace tied itself anyway");

            // The GM's explicit "no" still wins over the incident rule.
            const redHerring = await place({ action: "manual", tiedToCrime: false });
            ok(!remnants.remnantData(redHerring)?.tiedToCrime,
                "a trace the GM said is unrelated was tied anyway");
        } finally {
            for (const token of placed) await remnants.dropRemnantSecret(token);
            const ids = placed.map(t => t.id).filter(id => scene.tokens.has(id));
            if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
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
         * what is being asked is the arithmetic and the hand - the roll's own
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
                // rather than of durability - the fourth was refused, which
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
         * does not exist until then - so on any client the document arrives,
         * `createChatMessage` fires, and the words are still in flight.
         *
         * The chat log survived that because it redraws the card in place when
         * they land. THE NOTICE IS DRAWN ONCE, so it drew the placeholder: an
         * empty card, on every private notice in the game, since v1.1.47.
         *
         * MEASURED THROUGH THE REAL PATH - `whisperToOwner`, a real card, the
         * notice's own DOM - because the two halves only meet on screen: the
         * words are in a client-side store, the emptiness was in the popup, and
         * every layer in between was working.
         */
        const { whisperToOwner } = await import("./utils.mjs");
        const secret = await import("./secret.mjs");
        const actor = game.actors.filter(a => a.type === "character")[0];
        ok(actor, "no character to whisper to");

        /* THE STACK IS CAPPED, so "one more than there was" is not the question this
           test is asking. `showPopup` keeps at most four notices on screen and only TWO
           under the stained-glass theme - so once the cap is reached a new notice
           replaces an old one and the count does not move. Measured on 11.09: posting
           three notices in a row on a themed client gave 0 -> 1 -> 2 -> 2, and this test
           failed with "no notice appeared at all" while its notice was on the screen.

           So the stack is cleared first and the assertion below asks for the WORDS, which
           is what the test is named after and the only thing that distinguishes this
           notice from every other one a suite run posts. */
        document.querySelectorAll(".drpg-popup").forEach(node => node.remove());
        const words = `Suite notice ${Date.now() % 100000}`;
        let message = null;
        try {
            message = await whisperToOwner(actor, `<h3>Suite probe</h3><p>${words}</p>`, {
                flags: { [MODULE_ID]: { popupTone: "hope", popupForce: true } }
            });
            ok(message, "the card was not posted");
            await wait(900);

            const cards = [...document.querySelectorAll(".drpg-popup")];
            ok(cards.length, "no notice appeared at all");
            const text = cards.map(c => c.innerText.replace(/\s+/g, " ")).join(" | ");
            ok(text.includes(words),
                `the notice does not carry the card's words - it reads "${text.trim()}"`);

            // And the other half of the same rule: the DOCUMENT still says
            // nothing, or the privacy this is built on is gone.
            ok(String(message.content).includes("data-drpg-secret"),
                "a private card's words were written into the world after all");
            equal(secret.contentOf(message), `<h3>Suite probe</h3><p>${words}</p>`,
                "the words did not reach the client-side store");
        } finally {
            // All of them: the stack was emptied on the way in, so anything standing
            // here arrived during this test.
            for (const card of [...document.querySelectorAll(".drpg-popup")]) {
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
         * note - "what makes a second Objection sound like a second Objection".
         * One line above the call stopped it happening: `crossfade` returned
         * early when the playlist it was asked for was already playing. An
         * Objection cutting into a rebuttal, and a second Objection in the same
         * exchange, both land on the state that is ALREADY playing - so the two
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
             * objection is refused on purpose - an objection is one minute
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
                `both objections played the same track (${first}) - a second `
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
         * others is the failure that would have looked like it worked - an
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
         * over everything else while the game is paused - correctly: a table
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
            // `startFloor` is what CREATES a floor; `returnToDebate` only
            // moves an existing one back. Without it every call below refuses
            // on `if (!floor) return null` and the trial never leaves
            // `trial.discussion`, which is the state for a trial with no floor
            // open at all - measured, and it is why this test failed first time.
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
             * pair and nobody else, because an objection re-points the floor -
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
        // in the building that could see in the dark - you would hear who came
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
            // which region - the two things the darkness is hiding.
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
    }],

    ["a trial whose verdict is in does not open another", async () => {
        /*
         * F2, reproduced on 16.09: with the verdict applied the console kept The verdict live,
         * and a second one executed whoever the dropdown held. Raced against a timeout, so a
         * regression shows up as a failure and not as a suite waiting on a window forever.
         */
        const { trialProgress, openVerdictDialog } = await import("./vote.mjs");
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {});
        try {
            await game.settings.set(MODULE_ID, SETTINGS.trialProgress, {
                ...trialProgress(), chapter: getClock().chapter, voteClosed: true, verdictApplied: true });
            await settle();
            const answer = await Promise.race([openVerdictDialog(), wait(2500).then(() => "still open")]);
            if (answer === "still open") {
                for (const app of [...foundry.applications.instances.values()]) {
                    if (app.title === game.i18n.localize("DRPG.Vote.verdictTitle")) await app.close({ animate: false });
                }
            }
            equal(answer, null, "the verdict window opened for a trial whose verdict is already in");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.trialProgress, stored);
        }
    }],
    ["deleting either half of a sabotage leaves nothing frozen", async () => {
        /*
         * F5 (17.09): deleting "Repair: X" in the Project Manager left X frozen by a
         * project that no longer existed, out of every list and past any GM control.
         */
        const P = await import("./projects.mjs");
        const meta = foundry.utils.deepClone(P.projectMeta());
        const made = [];
        try {
            const target = await P.createProject({ name: "SUITE F5 target" });
            ok(target?.id, "could not create a project to sabotage");
            made.push(target.id);
            const first = await P.sabotageProject(target.id, 3);
            if (first?.repair?.id) made.push(first.repair.id);
            ok(P.isFrozen(target.id), "the sabotage did not freeze its target, so this proves nothing");

            await P.deleteProject(first.repair.id);
            ok(!P.isFrozen(target.id), "deleting the repair left its target frozen");

            const second = await P.sabotageProject(target.id, 3);
            if (second?.repair?.id) made.push(second.repair.id);
            ok(second?.repair?.id, "could not sabotage the thawed project again");
            await P.deleteProject(target.id);
            ok(!P.allProjects().some(p => p.id === second.repair.id),
                "deleting the broken project left its repair on the board");
            ok(!(second.repair.id in P.projectMeta()), "the orphaned repair left a metadata row behind");
        } finally {
            for (const id of made) await P.deleteProject(id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
    }],

    ["a sealed project keeps its builder in and the rest of the table out", async () => {
        /*
         * F3: an approved trap with nobody under "Also visible to" was sealed away from
         * the student who built it. F4: re-sealing a revealed project kept everybody in.
         */
        const P = await import("./projects.mjs");
        const owner = game.users.find(u => !u.isGM
            && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER")));
        const builder = owner && game.actors.find(a => a.type === "character" && a.testUserPermission(owner, "OWNER"));
        ok(builder, "need a character a player owns");
        const others = game.users.filter(u => !u.isGM && !builder.testUserPermission(u, "OWNER"));
        ok(others.length, "need a second player to be kept out");
        const meta = foundry.utils.deepClone(P.projectMeta());
        let made = null;
        try {
            made = await P.createProject({ name: "SUITE F3 trap", indirectMurder: true, by: builder.id });
            ok(P.canSee(made.id, owner), "an approved trap is sealed away from the student who built it");
            equal(P.metaFor(made.id).killerId, builder.id, "the builder is not recorded as the trap's killer");
            ok(!others.some(u => P.canSee(made.id, u)), "a new trap is visible to a player who did not build it");

            await P.revealProject(made.id);
            ok(others.every(u => P.canSee(made.id, u)), "revealing the project did not reveal it");
            await P.makeSecret(made.id, P.sealAudience(made.id));
            ok(P.isSecret(made.id), "the re-seal did not mark the project secret");
            ok(!others.some(u => P.canSee(made.id, u)), "re-sealing a revealed project kept the rest of the table in");
            ok(P.canSee(made.id, owner), "re-sealing shut the builder out of their own project");
        } finally {
            if (made?.id) await P.deleteProject(made.id).catch(() => {});
            await game.settings.set(MODULE_ID, SETTINGS.projectMeta, meta);
            await settle();
        }
    }],

    ["Room Setup's fog edit keeps the rooms found while the window was open", async () => {
        /*
         * ROOM-01 (17.09), at the layer Apply now ends in: a GM ticking one box lays that
         * box onto the ledger as it stands, not the ledger as the window first read it.
         */
        const { applyDiscoveryChanges, discoveredFor } = await import("./fog.mjs");
        const scene = canvas.scene;
        const [student] = cast();
        const rooms = Array.from(new Set([...(scene?.regions ?? [])].map(r => r.name).filter(Boolean)));
        ok(student && rooms.length >= 3, "need a student and three named rooms");
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.discoveredRooms) ?? {});
        const write = async list => {
            const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.discoveredRooms) ?? {});
            all[scene.id] = { ...(all[scene.id] ?? {}), [student.id]: list };
            await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, all);
        };
        try {
            await write([rooms[0]]);                 // what the window drew
            await write([rooms[0], rooms[1]]);       // found while it was open
            const wrote = await applyDiscoveryChanges(scene, [{ actorId: student.id, room: rooms[2], value: true }]);
            ok(wrote, "the box the GM ticked was not written");
            const now = discoveredFor(scene.id, student.id);
            ok(now.includes(rooms[1]), "a room found while Room Setup was open fogged over on Apply");
            ok(now.includes(rooms[2]), "the box the GM ticked was not saved");
            equal(await applyDiscoveryChanges(scene, [{ actorId: student.id, room: rooms[2], value: true }]),
                false, "an Apply that changes nothing still writes the ledger, and resyncs everyone's fog");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, stored);
            await settle();
        }
    }],

    ["a Despair Call that would change nothing hands its price back", async () => {
        /*
         * CALL-15 (17.09). Sealing a room that was already sealed charged a second time
         * for nothing. The refund itself is `failed: true`, which is what the caller pays
         * back on.
         */
        const { applyCall, sealedRooms } = await import("./call-effects.mjs");
        const room = [...(canvas.scene?.regions ?? [])].map(r => r.name).find(Boolean);
        ok(room, "need a named room");
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.sealedRooms) ?? []);
        try {
            await game.settings.set(MODULE_ID, SETTINGS.sealedRooms, []);
            const first = await applyCall(null, "behindClosedDoors", "despair", { room });
            ok(!first.failed && sealedRooms().includes(room), "the first seal did not land, so this proves nothing");
            const second = await applyCall(null, "behindClosedDoors", "despair", { room });
            ok(second.failed, "sealing a room that was already sealed kept its price");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.sealedRooms, stored);
            await settle();
        }
    }],

    ["a darkening running now outlasts the counter filling again", async () => {
        /*
         * CALL-06 (17.09). The overflow holds one stamp, and a spill that reached X in a
         * darkened time of day armed the next one over it, ending this one on the spot.
         * Only Fog is left in the hat while this runs, so a regression announces a Fog
         * and changes nobody's sheet.
         */
        const o = await import("./overflow.mjs");
        const clock = getClock();
        if (clock.eclipse) return;               // the Eclipse half reads another stamp
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {});
        const rules = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflowRules) ?? {});
        try {
            const effects = Object.fromEntries(Object.keys(o.overflowRules().effects)
                .map(key => [key, { on: key === "fog" }]));
            await game.settings.set(MODULE_ID, SETTINGS.overflowRules, { ...rules, effects });
            await game.settings.set(MODULE_ID, SETTINGS.overflow, {
                count: 0,
                active: { session: clock.session, day: clock.day ?? 1, timeOfDay: clock.timeOfDay, effect: "fog" }
            });
            equal(o.overflowEffect(), "fog", "could not set up a darkening for this time of day");
            await o.addOverflow(o.overflowThreshold() + 1, { reason: "suite" });
            await settle();
            equal(o.overflowEffect(), "fog", "the counter filling again ended the darkening running now");
            ok(o.overflowCount() >= o.overflowThreshold(), "the counter paid for a darkening it did not fire");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.overflowRules, rules);
            await game.settings.set(MODULE_ID, SETTINGS.overflow, stored);
            await settle();
        }
    }],

    ["two Calls armed on one student both apply, and the same one twice does not", async () => {
        /*
         * CALL-02 live: one slot used to mean a Monokuma's Obstacle silently ate the
         * Support a player had just paid a Hope for. Written straight through
         * `appendArmedCall`, which is the one writer both roads end in.
         */
        const { pendingCalls, appendArmedCall, alreadyArmed, consumeCalls } =
            await import("./call-effects.mjs");
        const [who] = cast();
        const before = foundry.utils.deepClone(who.getFlag(MODULE_ID, FLAGS.pendingCall) ?? null);
        try {
            await who.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            await appendArmedCall(who, { key: "support", kind: "hope", grants: "advantage" });
            await appendArmedCall(who, { key: "obstacle", kind: "despair", grants: "disadvantage" });
            await settle();
            equal(pendingCalls(who).length, 2, "the second armed Call replaced the first");
            await appendArmedCall(who, { key: "freeCrit", kind: "hope", grants: "critical" });
            await settle();
            ok(alreadyArmed(who, { key: "freeCrit", grants: "critical" }),
                "a second Loaded Die is not recognised as one already armed");
            ok(!alreadyArmed(who, { key: "support", grants: "advantage" }),
                "a second advantage Call is refused, and those are meant to stack");
            equal((await consumeCalls(who)).length, 3, "spending the armed Calls left some behind");
            equal(pendingCalls(who).length, 0, "the armed list survived being spent");
        } finally {
            if (before) await who.setFlag(MODULE_ID, FLAGS.pendingCall, before);
            else await who.unsetFlag(MODULE_ID, FLAGS.pendingCall);
            await settle();
        }
    }],

    ["a darkening ends with its time of day, not with the Eclipse after it", async () => {
        /*
         * Found in review, 17.09: the clock does not move until an Eclipse ends, so the
         * stamp of the time of day just finished went on matching through the Eclipse
         * after it - a Panic drawn for Noon cut the Afternoon refill. Written straight
         * to the settings, so no Eclipse card or refill runs.
         */
        const o = await import("./overflow.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.overflow) ?? {});
        const stamp = { session: clock.session, day: clock.day ?? 1, timeOfDay: clock.timeOfDay };
        try {
            await game.settings.set(MODULE_ID, SETTINGS.clock, { ...clock, eclipse: false });
            await game.settings.set(MODULE_ID, SETTINGS.overflow, { count: 0, active: { ...stamp, effect: "panic" } });
            await settle();
            equal(o.overflowEffect(), "panic", "could not set up a darkening for this time of day");
            await game.settings.set(MODULE_ID, SETTINGS.clock, { ...clock, eclipse: true });
            await settle();
            equal(o.overflowEffect(), null, "the Eclipse after a darkened time of day is still darkened by it");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.clock, clock);
            await game.settings.set(MODULE_ID, SETTINGS.overflow, stored);
            await settle();
        }
    }],

    ["the trial shuts everything but Analyze and the Objection", async () => {
        /*
         * T-1, Dawid 17.09. One tile, the Objection, the Hope Calls and the items.
         * Asserted through the real entry points rather than off the sheet, because
         * the grey on a tile is a courtesy and these are the boundaries - and by the
         * SENTENCE each refusal gives, because "it returned null" is also what an
         * action with nothing to do returns.
         */
        const [who, other] = cast();
        const rolls = await import("./action-rolls.mjs");
        const calls = await import("./calls.mjs");
        const monocub = await import("./monocub.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const actionsBefore = who.system.resources.actions.value;
        const wasCub = Boolean(other.getFlag(MODULE_ID, FLAGS.monocub));

        const locked = game.i18n.localize("DRPG.Trial.actionsLocked");
        const callsLocked = game.i18n.localize("DRPG.Trial.callsLocked");
        const seen = [];
        const warn = ui.notifications.warn.bind(ui.notifications);
        ui.notifications.warn = text => { seen.push(String(text)); return null; };

        try {
            await who.update({ "system.resources.actions.value": 2 });
            await setClock({ ...clock, phase: "classTrial" });
            await settle();

            for (const key of ["search", "tamper", "palm", "observe", "rest",
                "listen", "project", "move", "dynamic", "sabotage"]) {
                seen.length = 0;
                const out = await rolls.performAction(who, key);
                equal(out, null, `${key} was allowed during a Class Trial`);
                ok(seen.includes(locked), `${key} was refused for some reason other than the trial`);
            }
            equal(who.system.resources.actions.value, 2,
                "a tile the trial refused still charged for itself");

            // A Despair Call waits for the trial. The refusal comes before the pool
            // is even looked up, so any actor proves the gate.
            seen.length = 0;
            equal(await calls.spendDespairCallFor(who, "obstacle", { choice: { target: other } }), null,
                "a Despair Call went through during a Class Trial");
            ok(seen.includes(callsLocked), "the Despair Call was refused for some other reason");

            // Confusion is the Monocub's Meddle, and it is named in the decision.
            seen.length = 0;
            await other.setFlag(MODULE_ID, FLAGS.monocub, true);
            await settle();
            equal(await monocub.meddleDialog(other), null,
                "Confusion opened its picker during a Class Trial");
            ok(seen.includes(callsLocked), "Confusion was refused for some other reason");

            /*
             * ANALYZE IS THE ONE TILE THE TRIAL KEEPS OPEN, and it is asserted in
             * R42 rather than here: `performAnalyze` opens a picker for which bullet
             * to read, and a scenario that presses it waits for an answer nobody is
             * there to give.
             */
        } finally {
            ui.notifications.warn = warn;
            await other.setFlag(MODULE_ID, FLAGS.monocub, wasCub);
            await setClock(clock);
            await who.update({ "system.resources.actions.value": actionsBefore });
        }
    }],

    ["opening a trial hands out the time of day's actions and keeps what Hope bought", async () => {
        /*
         * T-1, Dawid 17.09 (answer 3). Driven through `startFloor` rather than
         * `startClassTrial`, because that one opens a DialogV2 the suite cannot
         * press - and because `startFloor` is the road that matters here: it sets
         * the phase itself, so a refill written only into the window would leave
         * this one locked against whatever actions people were holding.
         */
        const [who, hurt] = cast();
        const actions = await import("./actions.mjs");
        const { startFloor, endFloor } = await import("./trial-floor.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        const before = {
            actions: who.system.resources.actions.value,
            max: who.system.resources.actions.max,
            hurtActions: hurt.system.resources.actions.value,
            hurtMax: hurt.system.resources.actions.max,
            health: hurt.system.resources.hitPoints.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0,
            moves: who.getFlag(MODULE_ID, FLAGS.freeMoveGrants) ?? 0
        };

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.update({ "system.resources.actions.value": 0 });
            await hurt.update({
                "system.resources.actions.value": 0,
                "system.resources.hitPoints.value": hurt.system.resources.hitPoints.max
            });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 1);
            await who.setFlag(MODULE_ID, FLAGS.freeMoveGrants, 1);
            await settle();
            ok(actions.actionBudget(hurt).wounded, "the second fixture is not Wounded");

            await startFloor({});
            await settle();

            equal(getClock().phase, "classTrial", "the floor opened without moving the phase");
            equal(who.system.resources.actions.value, actions.actionBudget(who).total,
                "the trial did not hand out the time of day's actions");
            equal(hurt.system.resources.actions.value, actions.actionBudget(hurt).total,
                "a Wounded student got somebody else's allowance for the trial");
            equal(actions.freeActionsLeft(who), 1, "the trial expired a Burst bought with Hope");
            equal(actions.freeMovesLeft(who), 1, "the trial expired a Sprint bought with Hope");

            /*
             * AND THE SECOND DEBATE REFILLS NOTHING. A trial holds several, and a
             * budget handed out per debate would be an Objection for every one the
             * GM opens.
             */
            await who.update({ "system.resources.actions.value": 0 });
            await endFloor();
            await settle();
            await startFloor({});
            await settle();
            equal(who.system.resources.actions.value, 0,
                "the trial's second debate handed out a fresh budget");
        } finally {
            await endFloor();
            await setClock(clock);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.setFlag(MODULE_ID, FLAGS.freeMoveGrants, before.moves);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.actions.max": before.max
            });
            await hurt.update({
                "system.resources.actions.value": before.hurtActions,
                // The MAXIMUM too: `resetActionsFor` rewrites it, so a Wounded
                // fixture left behind a max of 1 and every later scenario's attempt
                // to set two actions was silently clamped to one.
                "system.resources.actions.max": before.hurtMax,
                "system.resources.hitPoints.value": before.health
            });
            await settle();
        }
    }],

    ["a rebuttal cut-in is not greyed, and a card with nothing behind it is refused", async () => {
        /*
         * THE REGRESSION THIS SPLIT EXISTS FOR (T-1, correcting the first draft).
         * A third party cutting into a rebuttal is legal (Dawid, 28.08). Asked as
         * one combined refusal with no target yet, the rule answers "you named
         * nobody" - and the window would grey the button for a move the floor would
         * have allowed.
         */
        const [who, other, third] = cast();
        const floorMod = await import("./trial-floor.mjs");
        const trial = await import("./trial.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        const messagesBefore = game.messages.size;

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({});
            await settle();
            ok(await floorMod.openObjection(who.id, other.id), "the fixture objection took no floor");
            await floorMod.openRebuttal();
            await settle();

            equal(floorMod.floorRefusal(), null,
                "a rebuttal greys the Objection button for everybody, which is the bug this split fixes");
            ok(floorMod.targetRefusal(third.id, ""),
                "a submitted objection with no target was accepted");
            ok(floorMod.targetRefusal(third.id, third.id),
                "an objection aimed at oneself was accepted");
            ok(floorMod.targetRefusal(third.id, who.id) === null,
                "a cut-in aimed at somebody already on the floor was refused");

            /*
             * AND THE CARD IS REFUSED WHEN THE FLOOR CANNOT TAKE IT. The window can
             * stand open while the trial moves; this is the last stop before a card
             * raises a sticky OBJECTION! on every screen in the game.
             */
            const bullets = await import("./truth-bullets.mjs");
            const item = await bullets.createTruthBullet(third, {
                name: "Suite fixture - objection price",
                realType: "neutral", visibility: "obvious"
            });
            ok(item, "could not make a fixture Truth Bullet");
            try {
                // No target at all.
                equal(await trial.presentBullet(third, item, { objection: true, targetId: "" }),
                    false, "an objection with no target posted a card");
                // Somebody's minute is running: a second objection is refused.
                await floorMod.openObjection(third.id, who.id);
                await settle();
                equal(await trial.presentBullet(other, item, { objection: true, targetId: who.id }),
                    false, "an objection during somebody else's minute posted a card");
                equal(game.messages.size, messagesBefore,
                    "a refused objection still put a card on the table");
            } finally {
                await item.delete();
            }
        } finally {
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await settle();
        }
    }],

    ["a student with nothing left gets a free Present, and it is logged as a Present", async () => {
        /*
         * The other half of T-1's two refusals: an empty pocket is answered rather
         * than simply refused. The free Present costs nothing, takes no floor, and
         * the log counts it as a Present - which is the whole of the fallback, and
         * is asserted here through `presentBullet` because that is what the window's
         * first button calls.
         */
        const [who, other] = cast();
        const floorMod = await import("./trial-floor.mjs");
        const trial = await import("./trial.mjs");
        const price = await import("./price.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };
        let item = null;

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({});
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await who.update({
                "system.resources.actions.value": 0,
                "system.resources.hope.value": 0,
                "system.resources.stress.value": who.system.resources.stress.max
            });
            await settle();

            equal(price.quotePrice(who, "objection").blockedKind, "nothingLeft",
                "the fixture is not actually broke");

            const bullets = await import("./truth-bullets.mjs");
            item = await bullets.createTruthBullet(who, {
                name: `Suite fixture - free present ${Date.now() % 100000}`,
                realType: "neutral", visibility: "obvious"
            });
            ok(item, "could not make a fixture Truth Bullet");

            const was = game.messages.size;
            ok(await trial.presentBullet(who, item, { objection: false, comment: "free" }),
                "the free Present was refused");
            await settle();
            equal(game.messages.size, was + 1, "the free Present posted no card");

            const logged = trial.presentedThisChapter()
                .find(e => e.presenter === who.name && !e.objection);
            ok(logged, "the free Present is not in the log as a Present");

            equal(who.system.resources.actions.value, 0, "the free Present found an action to spend");
            equal(who.system.resources.hope.value, 0, "the free Present spent Hope");
            equal(who.system.resources.stress.value, who.system.resources.stress.max,
                "the free Present marked Sanity");
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "the free Present took the floor, which is the one thing it must not do");
        } finally {
            if (item) await item.delete();
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
            await settle();
        }
    }],

    ["an Objection is paid when it takes the floor, refunded when it does not", async () => {
        /*
         * THE WHOLE OF C6 (T-1), driven the way a player drives it: post the card,
         * and let the primary GM's hook decide. `openObjection` is deliberately not
         * called here - that road is free and is asserted separately below.
         */
        const [who, other, third] = cast();
        const trial = await import("./trial.mjs");
        const floorMod = await import("./trial-floor.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const { TRIAL_FLAGS } = trial;
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});
        const before = {
            actions: who.system.resources.actions.value,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0,
            max: who.system.resources.actions.max,
            otherActions: other.system.resources.actions.value,
            otherMax: other.system.resources.actions.max
        };
        const made = [];
        const cards = [];

        /** The card a player's window posts, with whatever is being tested left out. */
        const card = async (actor, targetId, { itemId, author = null } = {}) => {
            const data = {
                content: `<p>suite objection ${Date.now() % 100000}</p>`,
                speaker: ChatMessage.getSpeaker({ actor }),
                flags: { [MODULE_ID]: {
                    [TRIAL_FLAGS.present]: true,
                    [TRIAL_FLAGS.objection]: true,
                    [TRIAL_FLAGS.presenter]: actor.name,
                    [TRIAL_FLAGS.item]: itemId ?? null,
                    [TRIAL_FLAGS.target]: targetId,
                    [TRIAL_FLAGS.targetName]: game.actors.get(targetId)?.name ?? null,
                    [TRIAL_FLAGS.chapter]: getClock().chapter,
                    popupKind: "none"
                } }
            };
            if (author) data.author = author;
            const message = await ChatMessage.create(data);
            cards.push(message);
            return message;
        };

        try {
            for (const actor of [who, other, third]) {
                const item = await bullets.createTruthBullet(actor, {
                    name: `Suite fixture - objection ${actor.name}`,
                    realType: "neutral", visibility: "obvious"
                });
                ok(item, `no fixture bullet for ${actor.name}`);
                made.push(item);
            }
            const [whoItem, otherItem, thirdItem] = made;

            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({});
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            // Both fields, because a value is clamped to the maximum on the way in
            // and these two fixtures have been through a Wound in another scenario.
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.actions.max": 2
            });
            await other.update({
                "system.resources.actions.value": 2,
                "system.resources.actions.max": 2
            });
            await settle();

            // ---- it takes the floor, and it is paid for ---------------------
            await card(who, other.id, { itemId: whoItem.id });
            await until(() => floorMod.trialFloor()?.holderId === who.id);
            await settle();
            equal(floorMod.trialFloor()?.holderId, who.id, "the objection card took no floor");
            equal(who.system.resources.actions.value, 0, "the objection was free");

            // ---- a second card inside that minute pays nothing --------------
            const second = await card(other, who.id, { itemId: otherItem.id });
            await until(() => second.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId, who.id,
                "a second objection took the minute out from under the first");
            equal(other.system.resources.actions.value, 2,
                "a refused objection still charged its objector");
            ok(cards[1].getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "the refused card is not marked as refused");

            // ---- and the log says so ---------------------------------------
            const logged = trial.presentedThisChapter({ objectionsOnly: true });
            ok(logged.some(e => e.presenter === other.name && e.refused),
                "the log does not record the refused objection as refused");
            ok(logged.some(e => e.presenter === who.name && !e.refused),
                "the log lost the objection that did take the floor");

            // ---- a card naming no evidence buys nothing ---------------------
            await floorMod.returnToDebate({});
            await settle();
            const noItem = await card(third, who.id, {});
            await until(() => noItem.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "a card naming no evidence took the floor");
            ok(noItem.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "a card naming no evidence was not marked refused");

            // ---- nor one naming evidence the objector does not hold ---------
            const notHis = await card(third, who.id, { itemId: whoItem.id });
            await until(() => notHis.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "a card naming somebody else's evidence took the floor");
            ok(notHis.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "a card naming somebody else's evidence was not marked refused");

            /*
             * ---- nor one whose author does not own the speaker ---------------
             *
             * Only if this world lets a card carry an author other than the user
             * creating it. Where it does not, Foundry has already closed the hole
             * this check exists for and there is nothing to assert.
             */
            const stranger = game.users.find(u => !u.isGM && !who.testUserPermission(u, "OWNER"));
            if (stranger) {
                const forged = await card(who, other.id, { itemId: whoItem.id, author: stranger.id });
                await until(() => forged.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
                await settle();
                if (forged.author?.id === stranger.id) {
                    equal(floorMod.trialFloor()?.holderId ?? null, null,
                        "a card posted in somebody else's name took the floor");
                    ok(forged.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                        "a card posted in somebody else's name was not marked refused");
                }
            }

            // ---- an objector with nothing left keeps their nothing -----------
            await who.update({
                "system.resources.actions.value": 0,
                "system.resources.hope.value": 0,
                "system.resources.stress.value": who.system.resources.stress.max
            });
            await settle();
            const broke = await card(who, other.id, { itemId: whoItem.id });
            await until(() => broke.getFlag(MODULE_ID, TRIAL_FLAGS.refused));
            await settle();
            equal(floorMod.trialFloor()?.holderId ?? null, null,
                "an objector with nothing to pay with took the floor anyway");
            ok(broke.getFlag(MODULE_ID, TRIAL_FLAGS.refused),
                "the card of an objector with nothing left was not marked refused");
            equal(who.system.resources.stress.value, who.system.resources.stress.max,
                "a refused objection moved the Sanity track");

            /*
             * ---- AND CALLING openObjection DIRECTLY CHARGES NOBODY -----------
             * The road api.mjs, the suite and the harness all take.
             */
            await who.update({ "system.resources.actions.value": 2,
                "system.resources.hope.value": 3,
                "system.resources.stress.value": before.stress });
            await settle();
            const snapshot = {
                actions: who.system.resources.actions.value,
                hope: who.system.resources.hope.value,
                stress: who.system.resources.stress.value
            };
            await floorMod.returnToDebate({});
            await floorMod.openObjection(who.id, other.id);
            await settle();
            equal(who.system.resources.actions.value, snapshot.actions,
                "openObjection charged an action by itself");
            equal(who.system.resources.hope.value, snapshot.hope, "openObjection charged Hope by itself");
            equal(who.system.resources.stress.value, snapshot.stress,
                "openObjection marked Sanity by itself");
        } finally {
            for (const message of cards) {
                try { await message.delete(); } catch { /* already gone */ }
            }
            for (const item of made) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.max": before.max,
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
            await other.update({
                "system.resources.actions.max": before.otherMax,
                "system.resources.actions.value": before.otherActions
            });
            await settle();
        }
    }],

    ["Analyze outside a Class Trial still costs exactly one action", async () => {
        /*
         * The other half of T-1's Analyze rule, and the one a table meets most: in
         * Daily Life the chain is one step long, so a student with no actions and a
         * pocket full of Hope cannot analyse. Driven through `performAction`, which
         * refuses at the quote before it opens anything.
         */
        const [who] = cast();
        const rolls = await import("./action-rolls.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const before = {
            actions: who.system.resources.actions.value,
            max: who.system.resources.actions.max,
            hope: who.system.resources.hope.value,
            stress: who.system.resources.stress.value,
            grants: who.getFlag(MODULE_ID, FLAGS.freeActionGrants) ?? 0
        };

        try {
            await setClock({ ...clock, phase: "dailyLife" });
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, 0);
            await who.update({
                "system.resources.actions.max": 2,
                "system.resources.actions.value": 0,
                "system.resources.hope.value": 5,
                "system.resources.stress.value": 0
            });
            await settle();

            equal(await rolls.performAction(who, "analyze"), null,
                "Analyze in Daily Life with no actions left was allowed");
            await settle();
            equal(who.system.resources.hope.value, 5,
                "Analyze outside a trial took Hope, which is a trial-only step");
            equal(who.system.resources.stress.value, 0,
                "Analyze outside a trial marked Sanity, which is a trial-only step");
        } finally {
            await setClock(clock);
            await who.setFlag(MODULE_ID, FLAGS.freeActionGrants, before.grants);
            await who.update({
                "system.resources.actions.max": before.max,
                "system.resources.actions.value": before.actions,
                "system.resources.hope.value": before.hope,
                "system.resources.stress.value": before.stress
            });
            await settle();
        }
    }],

    ["a critical Tamper hands back the step that paid, and a forged packet still pays", async () => {
        /*
         * T-1's refund, driven through the resolver the way the socket drives it -
         * which is also the only way to test the bound on a claim that crossed it.
         *
         * THREE CLAIMS. "action": the action comes back and the Sanity track does
         * not move, which is the bug this commit exists for - a critical used to
         * clear a mark the attempt had never made. "stress": one mark cleared.
         * "health": a step the table does not know, so the packet is treated as
         * having paid nothing on the client and the GM charges the Sanity itself,
         * exactly as every packet used to.
         */
        const [who] = cast();
        const cleanup = await import("./cleanup.mjs");
        const remnants = await import("./remnants.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        ok(scene, "no active scene to place a fixture trace on");
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const before = {
            actions: who.system.resources.actions.value,
            max: who.system.resources.actions.max,
            stress: who.system.resources.stress.value
        };
        const placed = [];
        const made = [];

        /*
         * A trace this character has FOUND, which is what the resolver requires of
         * the Tamper road: `copiedRemnants` is the register, and a Truth Bullet
         * copied off the trace is what puts it there.
         */
        const bullets = await import("./truth-bullets.mjs");
        const fixture = async () => {
            const token = await remnants.placeRemnant({
                type: "prep", visibility: "evident",
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - T-1 tamper price"
            });
            ok(token, "could not place a fixture trace");
            placed.push(token);
            const item = await bullets.createTruthBullet(who, {
                name: `Suite fixture - tamper ${placed.length}`,
                realType: "neutral", visibility: "obvious",
                remnantId: token.id, sceneId: scene.id
            });
            ok(item, "could not copy the fixture trace onto a bullet");
            made.push(item);
            await settle();
            return token;
        };

        try {
            await who.update({
                "system.resources.actions.max": 2,
                "system.resources.actions.value": 1,
                "system.resources.stress.value": 2
            });
            await settle();

            // ---- paid with an action --------------------------------------
            let token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: true, withHope: true, viaAction: true, price: "action"
            });
            await settle();
            equal(who.system.resources.stress.value, 2,
                "a critical paid with an action healed a Sanity mark nobody spent");
            equal(who.system.resources.actions.value, 2, "the action was not handed back");

            // ---- paid with a Sanity mark ----------------------------------
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.stress.value": 2
            });
            await settle();
            token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: true, withHope: true, viaAction: true, price: "stress"
            });
            await settle();
            equal(who.system.resources.stress.value, 1, "the Sanity mark was not lifted");
            equal(who.system.resources.actions.value, 1,
                "a critical paid with Sanity handed back an action as well");

            // ---- a claim the table does not know --------------------------
            await who.update({
                "system.resources.actions.value": 1,
                "system.resources.stress.value": 2
            });
            await settle();
            token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: true, withHope: true, viaAction: true, price: "health"
            });
            await settle();
            // Charged one mark as the fallback, then handed one back for the
            // critical: the net is where it started, and the point is that the
            // forged claim bought no free attempt and no free action.
            equal(who.system.resources.actions.value, 1,
                "a forged price claim bought an action");
            equal(who.system.resources.stress.value, 2,
                "a forged price claim did not pay the GM-side Sanity");

            // ---- and a packet with no claim at all pays it ----------------
            await who.update({ "system.resources.stress.value": 0 });
            await settle();
            token = await fixture();
            await cleanup.resolveCleanup({
                actorId: who.id, tokenId: token.id, total: 30,
                isCritical: false, withHope: true, viaAction: true
            });
            await settle();
            equal(who.system.resources.stress.value, 1,
                "a packet claiming nothing was not charged the Sanity the client never paid");
        } finally {
            for (const item of made) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            for (const token of placed) {
                try { await token.delete(); } catch { /* already gone */ }
            }
            await who.update({
                "system.resources.actions.max": before.max,
                "system.resources.actions.value": before.actions,
                "system.resources.stress.value": before.stress
            });
            await settle();
        }
    }],

    ["an after-analysis description reaches a holder at the moment of analysis and no sooner", async () => {
        /*
         * T-2, Dawid 17.09. The GM writes a sentence about a trace; a player is
         * told it when they analyse their copy, and not one moment earlier. Four
         * different stores could leak it, so all four are asked.
         */
        const [one, two] = cast();
        const remnants = await import("./remnants.mjs");
        const bullets = await import("./truth-bullets.mjs");
        const analyze = await import("./analyze.mjs");
        const scene = game.scenes.active ?? canvas?.scene;
        ok(scene, "no active scene to place a fixture trace on");
        const anchor = scene?.tokens?.find(t => t.x || t.y);
        const said = `Fixture analysis ${Date.now() % 100000}`;
        const second = `${said} (corrected)`;
        let token = null;
        const made = [];

        try {
            token = await remnants.placeRemnant({
                type: "prep", visibility: "evident",
                x: anchor?.x ?? 0, y: anchor?.y ?? 0, scene,
                note: "test fixture - T-2"
            });
            ok(token, "could not place the fixture trace");

            await remnants.setRemnantAnalysis(token, said);
            await settle();
            equal(remnants.remnantData(token).analysis, said,
                "the trace did not remember what analysing it says");
            ok(!("analysis" in (remnants.remnantData(token).public ?? {})),
                "the sentence landed in the trace's PUBLIC half, which goes onto the token name");
            ok(!JSON.stringify(token.toObject()).includes(said),
                "the sentence is written on the token document, which every client can read");

            // One holder who has not analysed it, one born knowing.
            const plain = await bullets.createTruthBullet(one, {
                name: `Suite fixture - unread ${Date.now() % 100000}`,
                realType: "prep", visibility: "evident",
                remnantId: token.id, sceneId: scene.id, analysis: said
            });
            ok(plain, "could not copy the trace for the holder who has not read it");
            made.push(plain);
            const known = await bullets.createTruthBullet(two, {
                name: `Suite fixture - read ${Date.now() % 100000}`,
                realType: "prep", shownType: "prep", analyzed: true,
                visibility: "evident",
                remnantId: token.id, sceneId: scene.id, analysis: said
            });
            ok(known, "could not copy the trace for the holder who has read it");
            made.push(known);
            await settle();

            ok(!JSON.stringify(plain.toObject()).includes(said),
                "an unidentified bullet carries the sentence where its holder can read it");
            equal(known.getFlag(MODULE_ID, "analysisText"), said,
                "a bullet born identified did not publish the sentence");

            // The moment of analysis.
            await analyze.resolveAnalyze({ actorId: one.id, itemId: plain.id, total: 30 });
            await settle();
            equal(plain.getFlag(MODULE_ID, "analysisText"), said,
                "analysing the bullet did not publish the sentence");

            // And a Reroll that loses it takes it back.
            await analyze.resolveAnalyze({ actorId: one.id, itemId: plain.id, total: 2, undo: true });
            await settle();
            equal(plain.getFlag(MODULE_ID, "analysisText") ?? "", "",
                "a rerolled Analyze left the sentence published");
            ok(!JSON.stringify(plain.toObject()).includes(said),
                "a rerolled Analyze left the sentence somewhere on the item");

            /*
             * A LATER EDIT REACHES THE HOLDER WHO HAS EARNED IT, AND ONLY THEM.
             */
            await remnants.setRemnantAnalysis(token, second);
            await settle();
            equal(known.getFlag(MODULE_ID, "analysisText"), second,
                "an edited sentence never reached the holder who had analysed the trace");
            ok(!JSON.stringify(plain.toObject()).includes(second),
                "an edited sentence reached a holder who has not analysed the trace");

            // The idle guard: an unchanged write writes nothing at all.
            const stamp = remnants.remnantData(token).updated;
            await remnants.setRemnantAnalysis(token, second);
            await settle();
            equal(remnants.remnantData(token).updated, stamp,
                "writing the same sentence again pushed a new version to every GM");

            /*
             * AND THE FALLBACK. A bullet minted before the GM wrote anything has a
             * secret with nothing in it; `identify` reads the trace itself.
             */
            await bullets.setSecret(plain.uuid, { analysis: "" });
            await settle();
            await analyze.resolveAnalyze({ actorId: one.id, itemId: plain.id, total: 30 });
            await settle();
            equal(plain.getFlag(MODULE_ID, "analysisText"), second,
                "a bullet whose secret was empty published nothing, instead of asking the trace");
        } finally {
            for (const item of made) {
                try { await item.delete(); } catch { /* already gone */ }
            }
            if (token) {
                try { await remnants.dropRemnantSecret(token); } catch { /* nothing filed */ }
                try { await token.delete(); } catch { /* already gone */ }
            }
            await settle();
        }
    }],

    ["the reset's exceptions are remembered, and come back unticked", async () => {
        /*
         * R-1. The memory, not the wipe: no scenario runs a real season reset, for
         * the reason the suite's contract gives - a wipe takes advancement and items
         * off a live cast, and what is put back is a fixture rather than a season.
         * What is driven here is every function the window leans on.
         */
        const ex = await import("./season-exceptions.mjs");
        const before = foundry.utils.deepClone(getSetting(SETTINGS.seasonExceptions) ?? []);

        try {
            // A plan is what is TICKED; the exceptions are the rest, in table order.
            const all = ex.RESET_GROUPS.map(group => group.key);
            const plan = ex.planFrom(all.filter(key => key !== "advancement" && key !== "rules"));
            equal(plan.keep.join(","), "advancement,rules",
                "the plan's exceptions are not the unticked groups in table order");
            ok(!plan.groups.has("advancement"), "an unticked group is still in the plan");

            await ex.rememberExceptions(plan.keep);
            await settle();
            const back = ex.rememberedExceptions();
            equal([...back.keys].sort().join(","), "advancement,rules",
                "the exceptions did not survive being remembered");
            equal(back.dropped, 0, "a remembered exception was dropped that this version still knows");

            /*
             * A KEY THIS VERSION NO LONGER KNOWS IS DROPPED, not carried into a
             * plan - otherwise a group renamed in a later release leaves a world
             * with an exception nothing can untick.
             */
            await game.settings.set(MODULE_ID, SETTINGS.seasonExceptions,
                ["advancement", "somethingWeRenamed"]);
            await settle();
            const bounded = ex.rememberedExceptions();
            equal([...bounded.keys].join(","), "advancement",
                "an unknown remembered key was carried into the plan");
            equal(bounded.dropped, 1, "the window would not be able to say what it dropped");

            // And nothing ticked is not a reset: `planFrom` says so by being empty,
            // which is what `resetSeason` refuses on.
            equal(ex.planFrom([]).groups.size, 0, "an empty plan claims to clear something");
            equal(ex.planFrom([]).keep.length, ex.RESET_GROUPS.length,
                "an empty plan does not treat every group as an exception");
        } finally {
            await game.settings.set(MODULE_ID, SETTINGS.seasonExceptions, before);
            await settle();
        }
    }],

    ["no module window is wider than the cap, and they open on the centre", async () => {
        /*
         * W-9. Trivially true at this viewport and the whole point at 5120x1440 -
         * which is exactly why it is written here rather than left to a screenshot
         * on one GM's monitor. What it really holds is the SHAPE: a module window
         * that states an explicit `left`, or one whose width beats the cap, fails
         * here on any screen.
         */
        const { openLookDialog } = await import("./look.mjs");
        const cap = parseFloat(getComputedStyle(document.body)
            .getPropertyValue("--drpg-window-max")) || 1400;
        const ceiling = Math.min(0.96 * window.innerWidth, cap) + 4;

        let app = null;
        /*
         * HELD, NOT AWAITED. `openLookDialog` awaits its own `DialogV2.wait`, which
         * resolves when the window CLOSES - and the only thing that will close it is
         * the end of this test. Awaiting the opener hangs the suite against its own
         * window (measured: fifteen minutes of silence, 19.09).
         */
        const opening = openLookDialog();
        try {
            await until(() => [...foundry.applications.instances.values()]
                .some(a => a.element?.matches?.('.application.dialog[class*="drpg-"]')));
            await settle();
            app = [...foundry.applications.instances.values()]
                .find(a => a.element?.matches?.('.application.dialog[class*="drpg-"]'));
            ok(app, "the Look window did not open, so nothing could be measured");

            for (const instance of foundry.applications.instances.values()) {
                const el = instance.element;
                if (!el?.matches?.('.application.dialog[class*="drpg-"]')) continue;
                const box = el.getBoundingClientRect();
                if (!box.width) continue;
                ok(box.width <= ceiling,
                    `${instance.constructor.name} is ${Math.round(box.width)}px wide, over the ${
                        Math.round(ceiling)}px cap`);
                const centre = box.left + box.width / 2;
                ok(Math.abs(centre - window.innerWidth / 2) <= 2,
                    `${instance.constructor.name} opened off-centre - something states an explicit left`);
            }
        } finally {
            try { await app?.close(); } catch { /* already gone */ }
            // And let the opener settle, so nothing is left pending behind the suite.
            try { await opening; } catch { /* closed rather than answered */ }
            await settle();
        }
    }],

    ["high contrast raises the ink and moves no size", async () => {
        /*
         * W-7, driven rather than read. Two promises: every type size is exactly
         * where it was, and the fine print is actually brighter. The second one is
         * measured as relative luminance, because "brighter" is the whole feature
         * and a token swap that made it darker would pass any test that only checked
         * the value changed.
         */
        const was = document.body.classList.contains("drpg-high-contrast");
        const probe = document.createElement("div");
        probe.className = "drpg-panel";
        probe.style.position = "fixed";
        probe.style.left = "-9999px";
        probe.innerHTML = `<p class="notes">fine print</p>
            <span class="drpg-tb-badge type neutral">badge</span>
            <button class="drpg-action-button"><span class="drpg-action-name">name</span></button>`;
        document.body.append(probe);

        /** Relative luminance of a computed colour, for "is this brighter". */
        const luminance = value => {
            const parts = String(value).match(/[\d.]+/g)?.map(Number) ?? [];
            if (parts.length < 3) return null;
            const [r, g, b] = parts.map(n => {
                const c = n / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const dimNow = () => {
            const holder = document.createElement("span");
            holder.style.color = "var(--drpg-dim)";
            probe.append(holder);
            const value = getComputedStyle(holder).color;
            holder.remove();
            return luminance(value);
        };
        const sizes = () => [...probe.querySelectorAll("*")]
            .map(el => getComputedStyle(el).fontSize).join("|");

        try {
            document.body.classList.remove("drpg-high-contrast");
            await settle();
            const plainSizes = sizes();
            const plainDim = dimNow();

            document.body.classList.add("drpg-high-contrast");
            await settle();
            equal(sizes(), plainSizes, "high contrast moved a type size");
            const brightDim = dimNow();

            ok(plainDim !== null && brightDim !== null, "the dim ink could not be measured");
            ok(brightDim >= plainDim * 2,
                `the fine print is not twice as bright: ${plainDim?.toFixed(3)} -> ${brightDim?.toFixed(3)}`);

            /*
             * AND IT SURVIVES A THEME CHANGE. It is an accessibility switch, not one
             * of the glass effects, so `applyTheme` must put it back on rather than
             * treat it as the other theme's business.
             */
            const settings = await import("./settings.mjs");
            const wasSetting = getSetting(SETTINGS.highContrast);
            try {
                await game.settings.set(MODULE_ID, SETTINGS.highContrast, true);
                settings.applyTheme();
                await settle();
                ok(document.body.classList.contains("drpg-high-contrast"),
                    "a theme change took the high-contrast switch off");
            } finally {
                await game.settings.set(MODULE_ID, SETTINGS.highContrast, wasSetting ?? false);
                settings.applyTheme();
            }
        } finally {
            probe.remove();
            document.body.classList.toggle("drpg-high-contrast", was);
            await settle();
        }
    }],

    ["the clock's rewind is refused while an Eclipse is running", async () => {
        /*
         * HUD-02 driven, which this one can be: the refused path writes nothing, so
         * it cannot leave the sealed rooms, a pending assembly or the motive dirty.
         * "evening" is chosen so the Eclipse under test is the NIGHT one - the free
         * placement window whose allowance flips, which is the worst version of the
         * bug - and spreading the old clock keeps `timeOfDayStartedAt`, so this does
         * not re-stamp the elapsed readout.
         */
        const was = foundry.utils.deepClone(getClock());
        const refusal = game.i18n.localize("DRPG.Clock.rewindDuringEclipse");
        const seen = [];
        const warned = ui.notifications.warn.bind(ui.notifications);
        ui.notifications.warn = text => { seen.push(String(text)); return null; };

        try {
            const { rewindTimeOfDay } = await import("./clock.mjs");
            await setClock({ ...was, timeOfDay: "evening", eclipse: true });
            await settle();

            equal(await rewindTimeOfDay(), null, "the rewind went through during an Eclipse");
            ok(seen.includes(refusal), "the rewind was refused silently, or for some other reason");

            const now = getClock();
            equal(now.timeOfDay, "evening", "the rewind moved the time of day anyway");
            equal(now.eclipse, true, "the rewind ended the Eclipse instead of refusing");
            equal(now.session, was.session, "the rewind rolled the session back");
            equal(now.day ?? 1, was.day ?? 1, "the rewind rolled the day back");
        } finally {
            ui.notifications.warn = warned;
            await setClock(was);
            await settle();
        }
    }],

    ["the trial console counts a debate down while it stands open", async () => {
        /*
         * F8's first half, driven: a source test can see the tick exists and cannot
         * see it reach the DOM.
         */
        const floorMod = await import("./trial-floor.mjs");
        const ui2 = await import("./trial-floor-ui.mjs");
        const { closeOpen } = await import("./live.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({ seconds: 180 });
            await settle();

            // Not awaited: these openers resolve when the person closes the window.
            ui2.manageClassTrial().catch(() => {});
            const consoleApp = () => [...foundry.applications.instances.values()]
                .find(a => a.rendered && a.options?.classes?.includes("drpg-window-trial"));
            // POLLED, NOT WAITED FOR. A fixed delay here is a race this suite has
            // already lost once: two dynamic imports and a render stand between the
            // call above and an element, and on a loaded machine that is more than
            // 600 ms. `until` returns as soon as the window is there.
            await until(() => consoleApp()?.element, 6000);
            const app = consoleApp();
            ok(app?.element, "the trial console did not open");

            const secondsOf = () => Number(app.element.querySelector(".drpg-trial-console")
                ?.textContent.match(/(\d+)\s*s/)?.[1] ?? NaN);
            const first = secondsOf();
            ok(Number.isFinite(first) && first > 150,
                `the console is not showing the debate's clock (read ${first})`);
            ok(await until(() => secondsOf() < first, 4000),
                "the console's debate clock is the same after four seconds - it is a photograph");
        } finally {
            closeOpen("drpg-window-trial");
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await settle();
        }
    }],

    ["the trial console hears a ballot land", async () => {
        /*
         * F8's second half. With NO floor open the one-second tick returns early, so
         * any rebuild counted here is the hook's - which is what makes the
         * measurement honest. The real ballot cannot be driven headless
         * (`eligibleVoters` wants a second connected player), so this pins the wiring
         * and the live check proves the end to end.
         */
        const ui2 = await import("./trial-floor-ui.mjs");
        const { closeOpen, diagnoseLive } = await import("./live.mjs");
        const clock = foundry.utils.deepClone(getClock());

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await settle();
            ui2.manageClassTrial().catch(() => {});

            const refreshesOf = () => diagnoseLive()
                .find(r => r.region === ".drpg-trial-console")?.refreshes ?? -1;
            // Polled for the same reason as the scenario above: the region does not
            // exist until the window has rendered, and 600 ms is not a promise.
            await until(() => refreshesOf() >= 0, 6000);
            const before = refreshesOf();
            ok(before >= 0, "the trial console is not a live region any more");

            Hooks.callAll("drpgVoteChanged", { in: 1 });
            await wait(400);
            ok(refreshesOf() > before,
                "the trial console does not listen for a ballot - `watch.hooks` is missing or misspelled");

            // And the idle tick really is idle while no floor is open.
            const quiet = refreshesOf();
            await wait(1400);
            equal(refreshesOf(), quiet,
                "the console rebuilds itself every second with no floor open");
        } finally {
            closeOpen("drpg-window-trial");
            await setClock(clock);
            await settle();
        }
    }],

    ["+30 seconds on an overrun debate leaves thirty seconds on the clock", async () => {
        /*
         * F9. The overrun is written by hand rather than waited for: three minutes of
         * real time in a suite is three minutes nobody gets back.
         */
        const floorMod = await import("./trial-floor.mjs");
        const clock = foundry.utils.deepClone(getClock());
        const queue = foundry.utils.deepClone(getSetting(SETTINGS.trialQueue) ?? {});

        try {
            await setClock({ ...clock, phase: "classTrial" });
            await floorMod.startFloor({ seconds: 60 });
            await settle();

            const floor = getSetting(SETTINGS.trialQueue);
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue,
                { ...floor, startedAt: Date.now() - 180_000 });
            await settle();
            ok(floorMod.secondsLeft() < -100, "the fixture is not actually overrun");

            await floorMod.extendFloor(30);
            await settle();
            const left = floorMod.secondsLeft();
            ok(left > 25 && left <= 30,
                `+30 s left the debate at ${left} s - an overrun debate is still overrun`);

            // And the case that must not regress: a debate with time on it.
            await floorMod.returnToDebate({ seconds: 120 });
            await settle();
            const was = floorMod.secondsLeft();
            await floorMod.extendFloor(30);
            await settle();
            const now = floorMod.secondsLeft();
            ok(Math.abs((now - was) - 30) <= 3,
                `thirty more seconds on a running debate measured as ${now - was}`);
        } finally {
            await floorMod.endFloor();
            await game.settings.set(MODULE_ID, SETTINGS.trialQueue, queue);
            await setClock(clock);
            await settle();
        }
    }],

    ["the murder window refuses at the door during an Eclipse", async () => {
        /*
         * F11. The measurement is that the promise SETTLES: a window that opened
         * would keep its DialogV2 pending and this would come back "hung".
         */
        const murder = await import("./murder.mjs");
        const eclipse = await import("./eclipse.mjs");
        const { closeOpen } = await import("./live.mjs");

        equal(murder.murderState(), null, "an incident was already running when this scenario started");
        try {
            await eclipse.startEclipse();
            await settle();
            ok(eclipse.isEclipse(), "the Eclipse did not start");

            const answer = await Promise.race([
                murder.openMurderDialog(),
                wait(800).then(() => "hung")
            ]);
            equal(answer, null,
                "the murder window opened during an Eclipse and sat there waiting for the GM");
        } finally {
            closeOpen("drpg-window-murder");
            try { await eclipse.endEclipse({ advance: false }); } catch { /* nothing to end */ }
            await settle();
        }
    }],

    ["the murder window opens with the finished trap of the killer it is showing already ticked", async () => {
        /*
         * F10. Through the PANEL's road - no killerId - because that is the one where
         * `armed.has(killerId)` asked about null and the box stayed unticked for a
         * killer whose trap was finished.
         */
        const murder = await import("./murder.mjs");
        const P = await import("./projects.mjs");
        const { closeOpen } = await import("./live.mjs");
        const { livingStudents } = await import("./chapter.mjs");
        const killer = livingStudents()[0];
        ok(killer, "no living student to arm a trap for");

        let made = null;
        try {
            // `createProject` answers with the whole row, and everything else in
            // projects.mjs takes the id.
            made = (await P.createProject({
                name: "SUITE F10 trap", target: 3, indirectMurder: true,
                killerId: killer.id, by: killer.id
            }))?.id ?? null;
            ok(made, "could not create the fixture trap");
            await P.addProgress(made, 3);
            await settle();
            ok(P.isComplete(P.allProjects().find(p => p.id === made)),
                "the fixture trap is not finished");

            murder.openMurderDialog().catch(() => {});
            await wait(700);
            const app = [...foundry.applications.instances.values()]
                .find(a => a.rendered && a.options?.classes?.includes("drpg-window-murder"));
            ok(app?.element, "the murder window did not open");

            const form = app.element.querySelector("form");
            equal(form.killer.value, killer.id, "the window is not proposing the killer this fixture armed");
            ok(form.indirect.checked,
                "the window opened with a finished trap and the box unticked - the GM has to "
                + "remember the trap themselves");
        } finally {
            closeOpen("drpg-window-murder");
            if (made) { try { await P.deleteProject(made); } catch { /* already gone */ } }
            await settle();
        }
    }],

    ["the slider moves the type under Monokuma Legacy and moves nothing under the glass", async () => {
        /*
         * W-2, measured rather than read - and this is the only test that would catch
         * an invalid `calc()`, which makes a declaration invalid at computed-value
         * time and silently falls back to the inherited size.
         *
         * RATIOS, NEVER ABSOLUTE PIXELS. Foundry's own Font Size setting moves every
         * rem, so "11px" is a fact about one client's settings rather than about this
         * module - except at the floor, which is stated in px on purpose.
         */
        const settings = await import("./settings.mjs");
        const was = { scale: getSetting(SETTINGS.uiScale), theme: getSetting(SETTINGS.theme) };

        const probe = document.createElement("span");
        probe.style.cssText = "position:fixed;left:-9999px;top:0;display:block";
        const box = document.createElement("div");
        box.style.cssText = "position:fixed;left:-9999px;top:0;display:block";
        document.body.append(probe, box);

        const read = async slider => {
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, slider);
            settings.applyTheme();
            await settle();
            const size = token => {
                probe.style.fontSize = `var(${token})`;
                return parseFloat(getComputedStyle(probe).fontSize);
            };
            box.style.width = "var(--drpg-popup)";
            return {
                nine: size("--font-size-9"),
                eleven: size("--font-size-11"),
                xs: size("--drpg-text-xs"),
                lg: size("--drpg-text-lg"),
                popup: parseFloat(getComputedStyle(box).width),
                type: parseFloat(getComputedStyle(document.body)
                    .getPropertyValue("--drpg-type-scale")) || 1
            };
        };

        try {
            for (const theme of ["monokumaLegacy", "stainedGlass"]) {
                await game.settings.set(MODULE_ID, SETTINGS.theme, theme);
                settings.applyTheme();
                await settle();

                const one = await read(1);
                const up = await read(1.4);
                const down = await read(0.8);
                const legacy = theme === "monokumaLegacy";

                for (const [key, factor] of [["lg", 1.4], ["popup", 1.4]]) {
                    const ratio = up[key] / one[key];
                    ok(Math.abs(ratio - (legacy ? factor : 1)) < 0.02,
                        `${theme}: ${key} at 140 % measured ${ratio.toFixed(3)}x`);
                }
                const downLg = down.lg / one.lg;
                ok(Math.abs(downLg - (legacy ? 0.8 : 1)) < 0.02,
                    `${theme}: the large rung at 80 % measured ${downLg.toFixed(3)}x`);

                if (legacy) {
                    // The floor, which is the one absolute number in this test.
                    ok(Math.abs(down.eleven - 10) < 0.1,
                        `the 11px rung fell to ${down.eleven}px at 80 % instead of stopping at 10`);
                    ok(Math.abs(down.xs - 10) < 0.1,
                        `the module's smallest rung fell to ${down.xs}px at 80 %`);
                    ok(Math.abs(down.nine - one.nine) < 0.1,
                        "the 9px rung moved at 80 % - its floor is its own size, so it must not");
                } else {
                    /*
                     * AND THE GLASS'S CHROME STILL COMES OFF THE GLASS'S OWN FACTOR.
                     *
                     * This first asserted that the ladder does not move at all under the
                     * glass, and it failed - correctly. That theme flattens rungs 8 to 17
                     * to `--drpg-sg-floor`, which is `21px * --drpg-sg-scale`, which is
                     * `--drpg-type-scale`: it has followed the slider since 07.09 and is
                     * none of W-2's business. So what is pinned here is WHICH factor it
                     * follows - the screen-term one, not the new one - which is the thing
                     * that would break if somebody "tidied" the three tokens into one.
                     */
                    const moved = up.eleven / one.eleven;
                    const own = up.type / one.type;
                    ok(Math.abs(own - 1) > 0.05,
                        "the glass's own type factor did not move, so this proves nothing");
                    ok(Math.abs(moved - own) < 0.02,
                        `the glass's chrome measured ${moved.toFixed(3)}x while its own factor `
                        + `moved ${own.toFixed(3)}x`);
                    ok(Math.abs(one.xs - down.xs) < 0.1,
                        "the module's own smallest rung moved under the glass, where the factor "
                        + "is pinned at 1");
                }
            }
        } finally {
            probe.remove();
            box.remove();
            await game.settings.set(MODULE_ID, SETTINGS.theme, was.theme);
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, was.scale ?? 1);
            settings.applyTheme();
            await settle();
        }
    }],

    ["a prose window's box follows the slider under Monokuma Legacy", async () => {
        /*
         * W-2b, and the reason this is not left to R63's source read: that read proves
         * the two tokens carry the factor, not that the RULE still bites. The width is
         * stated on `.application.dialog:is(.drpg-panel, ...)` with `!important`, and a
         * window that stops carrying one of those classes - or a `:not()` added to the
         * list - loses the box silently, at whatever width ApplicationV2 felt like.
         *
         * BUILT DIRECTLY, NOT THROUGH `DialogV2.wait`, whose promise settles only when
         * the window closes: awaiting it here is the deadlock W-9's scenario already
         * paid for. And `close()` is awaited because ApplicationV2 waits on a
         * transition that never fires on the frame itself, which is a second per
         * window and the reason this measures two settings rather than five.
         */
        const settings = await import("./settings.mjs");
        const { closeOpen } = await import("./live.mjs");
        const was = { scale: getSetting(SETTINGS.uiScale), theme: getSetting(SETTINGS.theme) };

        const widthAt = async slider => {
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, slider);
            settings.applyTheme();
            await settle();
            const dialog = new foundry.applications.api.DialogV2({
                window: { title: "W-2 width probe" },
                // `drpg-panel` because that is the class the width rule reads, and a
                // second one of its own so the close below cannot sweep somebody else's
                // window: `closeOpen("drpg-panel")` would take the GM panel with it.
                classes: ["drpg-panel", "drpg-window-w2-probe"],
                content: "<p>W-2</p>",
                buttons: [{ action: "ok", label: "OK" }]
            });
            await dialog.render({ force: true });
            await settle();
            /*
             * THE USED WIDTH, NOT THE RECTANGLE ON SCREEN. `getBoundingClientRect`
             * reports the TRANSFORMED box, and this module opens a window from
             * `scale(0.96)`: the first of these two measurements caught the tail of
             * that animation and read 522.4 where the window is 544, which is a
             * 1.458x ratio and a failure about nothing. `getComputedStyle().width` is
             * the used value, which no transform touches.
             */
            const width = dialog.element
                ? parseFloat(getComputedStyle(dialog.element).width) : null;
            await dialog.close();
            return width;
        };

        try {
            await game.settings.set(MODULE_ID, SETTINGS.theme, "monokumaLegacy");
            settings.applyTheme();
            await settle();

            const one = await widthAt(1);
            const up = await widthAt(1.4);
            ok(one !== null && up !== null, "the window could not be measured");
            // 92vw caps it, so this only means anything on a screen with room for it.
            if (one < innerWidth * 0.9) {
                const ratio = up / one;
                ok(Math.abs(ratio - 1.4) < 0.03,
                    `the box measured ${ratio.toFixed(3)}x at 140 % - the width rule no longer `
                    + `reaches this window, or the token lost the factor`);
            }
        } finally {
            closeOpen("drpg-window-w2-probe");
            await game.settings.set(MODULE_ID, SETTINGS.theme, was.theme);
            await game.settings.set(MODULE_ID, SETTINGS.uiScale, was.scale ?? 1);
            settings.applyTheme();
            await settle();
        }
    }],

    ["a window still answers for one tick after it was answered", async () => {
        /*
         * LIVE-REOPEN-01's measurement, kept as a test because the whole finding rests
         * on it and it is a fact about Foundry rather than about this module: if a
         * future version closes before resolving, `reopen` becomes unnecessary and
         * this is where that shows up.
         *
         * Built with `DialogV2.wait` and answered by clicking the footer button, which
         * is the path a person takes - not `dialog.close()`, which resolves through the
         * other branch entirely.
         */
        const { alreadyOpen, reopen, closeOpen } = await import("./live.mjs");
        const DialogV2 = foundry.applications.api.DialogV2;
        const CLASS = "drpg-window-reopen-probe";

        const waiting = DialogV2.wait({
            window: { title: "reopen probe" },
            classes: ["drpg-panel", CLASS],
            content: "<p>probe</p>",
            buttons: [{ action: "ok", label: "OK" }],
            rejectClose: false
        });

        try {
            ok(await until(() => document.querySelector(`.${CLASS}`), 4000),
                "the probe window did not open");
            document.querySelector(`.${CLASS} button[data-action="ok"]`).click();
            const answer = await waiting;
            equal(answer, "ok", "the probe answered something else");

            // THE INSTANT THAT DECIDES IT.
            ok(alreadyOpen(CLASS),
                "the window had already gone by the next statement - `reopen` is no longer "
                + "needed and the notes on it are out of date");

            // And `reopen` gets a window anyway, which is the point of it.
            let opened = null;
            await reopen(CLASS, async () => {
                opened = alreadyOpen(CLASS) ? "refused" : "clear";
                return null;
            });
            equal(opened, "clear", "reopen ran the opener while the old copy was still there");
        } finally {
            closeOpen(CLASS);
            await settle();
        }
    }],

    ["a repair moves somebody to dead without announcing a death", async () => {
        /*
         * F16 and F15 driven. The dropdown half of the Players window is a repair
         * tool, and the two things a repair must not do are the two things it did:
         * post the death card to the table and say "X is no longer a Monocub" about
         * somebody who never was one.
         *
         * `applyAliveStates` is called directly - the window cannot be driven from
         * here, and the function is exported for exactly this.
         */
        const panel = await import("./gm-panel.mjs");
        const { isDeceased } = await import("./chapter.mjs");
        const victim = studentActors()[0];
        ok(victim, "no student to repair");

        const wasDead = isDeceased(victim);
        const said = [];
        const info = ui.notifications.info.bind(ui.notifications);
        ui.notifications.info = text => { said.push(String(text)); return null; };
        const before = game.messages.size;

        try {
            if (wasDead) await (await import("./chapter.mjs")).reviveCharacter(victim);
            const changed = await panel.applyAliveStates({ [victim.id]: { state: "dead" } });
            await settle();

            equal(changed, 1, "the repair reported no change");
            ok(isDeceased(victim), "the repair did not mark the student dead");
            equal(game.messages.size, before,
                "the repair posted a card - a dropdown is not a death announcement");
            ok(!said.some(t => /Monocub/i.test(t)),
                `the repair talked about Monocubs: ${said.join(" | ")}`);

            // AND THE BULLETS STAY. This is the half the window's own header
            // promises: "moves the two flags and nothing else".
            const { bulletsOf } = await import("./truth-bullets.mjs");
            ok(Array.isArray(bulletsOf(victim)), "the bullets could not be read");
        } finally {
            ui.notifications.info = info;
            const { reviveCharacter } = await import("./chapter.mjs");
            if (!wasDead && isDeceased(victim)) await reviveCharacter(victim);
            await settle();
        }
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
 * "stage after opening - expected openingRoll, measured undefined". Not one of
 * those failures was real. The Eclipse scenario sets `clock.eclipse` true for
 * the length of its own check, and `openMurder` refuses outright during an
 * Eclipse - so every murder scenario in the other run was declined by a gate
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
 * it was found" - a caller who did not know the first run was in flight does
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
    // Every roll the scenarios make skips the configuration window - see
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

    // Tier 0 runs at every level, including `{ tier: 1 }` - the round-by-round
    // pass E17 makes on the way in and on the way out. It is the cheapest thing
    // in the suite to be wrong about and the most expensive to skip: a divergence
    // it would have caught costs four releases, not one run.
    lines.push("TIER 0 - module-wide regression (source is read, not called)");
    for (const [name, fn] of REGRESSIONS) {
        try { await fn(); record(name, null); } catch (err) { record(name, err); }
    }

    if (tier >= 1) {
        lines.push("");
        lines.push("TIER 1 - invariants (the world is not touched)");
        for (const [name, fn] of INVARIANTS) {
            try { await fn(); record(name, null); } catch (err) { record(name, err); }
        }
    }

    /*
     * TIER 2 WILL NOT START ON TOP OF AN INCIDENT (20.09).
     *
     * Every scenario's `finally` ends the murder and restores the fixtures, which is
     * right for the ones it opened and wrong for one a table is in the middle of: a
     * suite run started during a fight closes that fight, and the world it puts back
     * is the one the suite recorded a moment ago rather than the one the incident had
     * moved on from. Paid for in the QA world, where a run that died left an incident
     * behind and the next run cheerfully closed it.
     *
     * Tier 0 and tier 1 are unaffected - they read and never write - so this refuses
     * the scenarios only, and says which state it found.
     */
    if (tier >= 2 && game.drpg?.murderState?.()) {
        lines.push("");
        lines.push("TIER 2 - REFUSED: an incident is open in this world.");
        lines.push("        Close it from the incident tracker (End the murder) and run again.");
        lines.push("        The scenarios end every incident they find, so this one would go with them.");
        failed++;
        tier = 1;
    }

    if (tier >= 2) {
        lines.push("");
        lines.push("TIER 2 - scenarios (fixtures built and put back)");
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
    const text = [`Danganronpa RPG - regression suite`, summary, "", ...lines].join("\n");
    console.log(text);
    if (failed) ui.notifications.warn(summary);
    else ui.notifications.info(summary);
    log(`Regression suite: ${summary}`);
    return { passed, failed, text };
}
