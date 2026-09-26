/**
 * Danganronpa RPG - tier 0 of the suite: the module's own source, read (E30, audit S17-02).
 * ---------------------------------------------------------------------------
 * REGRESSIONS, and the name analysis only R21 and R22 use. The runner is in
 * tests.mjs; the tools are in tests-kit.mjs.
 */

import { MODULE_ID, moduleVersion, CRISIS_ACTIONS, ACTIONS, SFX_EVENTS, CRITICAL } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { studentActors } from "./monokuma.mjs";
import { log } from "./utils.mjs";
import {
    ok, needs, env, world, equal, must, wait, moduleSources, otherSources, stripComments, moduleStyles, bodyOf,
    topLevelFunction, fnSource, lineAround, withGuards, lineAt, stripStrings, stringLiterals, STANDING, cast,
    markerProblem, runOne, stageLedger, suiteEntries, KIT_SELF_TESTS, SELF_LEDGER, MARKER_FIXTURE,
    scanSuite, bareCuts, vacuousAsserts, needsArgs, LINT_FIXTURES, UNTIL_FIXTURE, untilProblem, DUMP_RULES,
    DUMP_FOREIGN_SETTINGS, dumpOf, dumpDiff, dumpPathsOf, FLOWS, FLOW_EXEMPT, staticImports, importCycles,
    bridgeTables, bridgeTableProblems, payloadReads, refusalProblems
} from "./tests-kit.mjs";

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
 * the suite can fetch and read them. A fetch per script - 112 on 24.09.2026 -
 * inside a hand-run test is a price nobody ever sees.
 *
 * THE SELECTION RULE, and it is the only one: every criterion below points at a
 * defect this project actually shipped, or came within one commit of shipping.
 * A regression test nobody can name a bug for is a test that gets deleted the
 * first time it is inconvenient - so each one carries its bug in the comment.
 *
 * Tier 0 does not write to the world. R12 opens windows and closes them again;
 * R10 calls hot functions and throws the answers away.
 */

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
    ["R1 - every translation key the module names out loud resolves", async () => {
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

    ["R1b - no socket handler takes a character on somebody's word", async () => {
        /*
         * THE ONE INVARIANT THAT DECIDES WHETHER A PLAYER CAN ACT AS ANOTHER
         * PLAYER'S CHARACTER.
         *
         * Every request a player's client sends the primary GM is a declaration in
         * one of the bridge's tables (E31, 25.09.2026: BRIDGE_ACTIONS in
         * gm-bridge.mjs, TRAP_ACTIONS in traps.mjs, SEARCH_ACTIONS in
         * search-tokens.mjs), judged by one runner: who really
         * sent it (`senderOf(senderId)`, Foundry's own argument, which cannot be
         * forged), then the guards the declaration names, in order, and only then
         * the run, with a copy of the packet that holds only the fields the
         * declaration lists. The payload's own `userId` is a claim and is only ever
         * used as an address.
         *
         * This used to read gm-bridge.mjs's text: a handler per request, holding
         * `senderOf(senderId)` in its own body and ONE of `ownsActor(sender, ...)`,
         * `canSee(..., sender)` or `!sender.isGM` in its body or its guards - so it
         * could not see ownership going missing from a handler that also checked
         * sight (the note E03 left above the table said so). It reads the
         * declarations themselves now, per field: every id or value a run receives
         * is named by a guard or by a claim written beside it, and the other rules
         * of `bridgeTableProblems` (the kit) with it - since C4 of E31 also that
         * every reason a refusal can carry is said in both languages, and so is
         * every request named to `tellRefused` by hand, and a declaration's `tell`
         * is one of the closed list's codes, and a queued declaration answers
         * reply. The reader is run first on a fixture with six planted faults,
         * which must come back exactly.
         *
         * READ LIVE rather than exercised, because the thing being checked is the
         * SHAPE of the judgement, not its outcome: a request that never runs in a
         * test world is exactly the one most likely to be missing it.
         */
        const G = await import("./bridge-guards.mjs");
        const fine = () => null;
        const FIXTURE = [{ file: "fixture.mjs", name: "FIXTURE", module: {}, text: "", table: {
            "fixture.fine": { label: "DRPG.Bridge.what.fixture.fine", guards: [G.knownSender, G.owns("actorId", "not theirs")],
                sanitize: G.pick({ actorId: G.as.id, n: G.as.num }), run: fine, answer: "ack" },
            "fixture.unclaimed": { label: "DRPG.Bridge.what.fixture.unclaimed", guards: [G.knownSender, G.owns("actorId", "not theirs")],
                sanitize: G.pick({ actorId: G.as.id, targetId: G.as.id }), run: fine, answer: "ack" },
            "fixture.nopl": { label: "DRPG.Bridge.what.fixture.nopl", guards: [G.knownSender],
                sanitize: G.pick({ n: G.as.num }), run: fine, answer: "ack" },
            "fixture.receipt": { label: "DRPG.Bridge.what.fixture.receipt", guards: [G.knownSender, G.guardObserveReceipt, G.owns("actorId", "not theirs")],
                sanitize: G.pick({ actorId: G.as.id, undo: G.as.bool }), run: fine, answer: "ack" },
            "fixture.tell": { label: "DRPG.Bridge.what.fixture.tell", guards: [G.knownSender],
                sanitize: G.pick({ n: G.as.num }), run: fine, answer: "ack", tell: "fixtureNowhere" },
            "fixture.queued": { label: "DRPG.Bridge.what.fixture.queued", guards: [G.knownSender],
                sanitize: G.pick({ n: G.as.num }), run: fine, answer: "ack", queue: "fixture" }
        } }];
        const labels = Object.keys(FIXTURE[0].table).map(action => `DRPG.Bridge.what.${action}`);
        const said = ["DRPG.Bridge.notDone", "DRPG.Bridge.nothingSpent", "DRPG.Bridge.why.fixtureSaid"];
        const planted = bridgeTableProblems(FIXTURE, {
            en: new Set([...labels, ...said, "DRPG.Bridge.why.fixtureUnsaid"]),
            pl: new Set([...labels.filter(k => !k.endsWith(".nopl")), ...said]),
            guards: G, reasons: ["fixtureSaid", "fixtureUnsaid"] });
        equal(JSON.stringify(planted.problems), JSON.stringify([
            "fixture.mjs fixture.unclaimed: targetId reaches the run with no guard naming it and no claim saying who judges it",
            "fixture.mjs fixture.nopl: DRPG.Bridge.what.fixture.nopl is missing in pl.json",
            "fixture.mjs fixture.receipt: guardObserveReceipt spends a Reroll receipt and is not the last guard",
            "fixture.mjs fixture.tell: it tells its refusals as \"fixtureNowhere\", which is not a code of the closed list",
            "fixture.mjs fixture.queued: it waits in the \"fixture\" queue, is acknowledged as it arrives, and answers \"ack\", not reply",
            "reason fixtureUnsaid: DRPG.Bridge.why.fixtureUnsaid is missing in pl.json"
        ]), "the table reader does not find exactly the six faults planted for it - it would misread the module's tables too");

        // The requests named to `tellRefused` by hand, outside the runner: a literal second argument.
        const toldIn = text => [...stripComments(text).matchAll(/\btellRefused\(\s*[^,()]+,\s*"([^"]+)"/g)].map(m => m[1]);
        equal(JSON.stringify(toldIn('tellRefused(sender.id, "fixture.told", null, "relay"); tellRefused(ctx?.asker, action);')),
            JSON.stringify(["fixture.told"]), "the reader of tellRefused's calls does not find the one planted for it");
        const told = (await otherSources()).filter(([file]) => file !== "bridge-guards.mjs").flatMap(([, raw]) => toldIn(raw));
        ok(told.length >= 1, "no request is named to tellRefused by hand - relay-guard.mjs's call is gone, or this reads the wrong thing");

        // Both language files, fetched and flattened as Foundry merges them (pl nests `advancement.apply`).
        const language = async lang => {
            const res = await fetch(`/modules/${MODULE_ID}/lang/${lang}.json`);
            must(res.ok, `${lang}.json: HTTP ${res.status}`);
            const flat = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) =>
                typeof v === "object" && v !== null ? flat(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]);
            return new Set(flat(foundry.utils.expandObject(await res.json())));
        };
        const tables = await bridgeTables();
        const read = bridgeTableProblems(tables, { en: await language("en"), pl: await language("pl"), guards: G, reasons: G.REASONS, told });
        log(`R1b: ${read.actions} bridge actions in ${tables.length} tables, ${read.withIds} receive an id or a value a guard `
            + `or a claim must judge; ${read.byGuardClaim} such fields are claimed by a guard that reads them, `
            + `${read.inWords} by a written reason; ${read.local.length} local guard(s); ${G.REASONS.length} reasons `
            + `and ${told.length} request(s) named to tellRefused by hand, looked for in en and pl`);
        ok(read.actions >= 37, `only ${read.actions} bridge actions were read - the tables are not where this test looks`);
        ok(read.withIds >= 20, `only ${read.withIds} bridge actions receive an id - has the reading gone wrong?`);
        ok(!read.problems.length, `the bridge's tables: ${read.problems.join("; ")}`);

        // The runner judges them only if the listeners hand it their packets - and nothing else runs it.
        for (const { file, name, text } of tables) {
            ok(new RegExp(`\\bjudge\\(${name}, payload, senderId\\)`).test(text), `${file} no longer hands its packets to judge(${name}, ...)`);
        }
        const runners = (await otherSources()).filter(([, raw]) =>
            /import\s*\{[^}]*\bjudge\b[^}]*\}\s*from\s*"\.\/bridge-guards\.mjs"/.test(stripComments(raw))).map(([file]) => file).sort();
        equal(JSON.stringify(runners), JSON.stringify(tables.map(t => t.file).sort()),
            "a file other than the tables' own imports the bridge's runner");

        /*
         * AND EVERY OTHER FILE THAT OPENS A SOCKET, because this test's own name
         * says "no socket handler" and until 15.09 it read exactly one file.
         *
         * Sixteen files call `game.socket.on` (24.09.2026, comments stripped, the
         * suite's own files left out). The tables' own files are read properly
         * above; the rest were outside the sentence this test claims to be
         * enforcing. That is how traps.mjs came to be the one handler in the
         * module taking a character on the packet's word - a forged relay could
         * fire and disarm anybody's trap - with a green suite the whole time.
         *
         * WHAT THIS HALF CAN AND CANNOT DO. It is a coarse read: for each file,
         * if a socket handler body anywhere in it reaches for an actor id out of
         * the payload, the file has to name `senderOf` and `ownsActor` somewhere
         * too. It cannot tell WHICH handler guarded itself, so it would not
         * catch a second handler added beside a guarded one. It does catch the
         * thing that actually happened: a whole file that never learnt the rule.
         *
         * The exemptions are listed rather than inferred, one line of reason
         * each, so that adding a file to this list is a decision somebody writes
         * down instead of a silence - and an exemption for a file that no longer
         * listens fails, so the list cannot outlive what it excuses (E31:
         * call-effects.mjs was on it, and has no listener).
         */
        const EXEMPT = {
            // Answers only to the sender's own id, never to an id in the packet.
            "vote.mjs": "keys the tally by senderId; the payload's actor is an address, not a claim",
            "murder.mjs": "GM-to-GM sync plus one request answered from the sender's own cast",
            "mastermind.mjs": "GM-to-GM sync; the one player request is answered about the sender",
            "truth-bullets.mjs": "GM-to-GM ledger sync, refused outright from a non-GM",
            "remnants.mjs": "GM-to-GM ledger sync, refused outright from a non-GM",
            "secret.mjs": "a card's words, taken from a player only for a message that player wrote, and cleaned; no character is acted on",
            "fog.mjs": "fog.request answers the sender's own rows; fog.shared is taken only while the primary's question is open, cut to the characters the sender owns",
            "sync.mjs": "world-state fan-out from a GM; carries no actor id",
            "safeword.mjs": "deliberately trusts nothing from the packet - reads the sender's name",
            "dice-sync.mjs": "dice appearance only; no actor anywhere in it",
            "sfx.mjs": "plays a sound; no actor anywhere in it",
            "voice.mjs": "room membership, keyed by the sender",
            "voice-client.mjs": "room membership, keyed by the sender"
        };

        const tableFiles = new Set(tables.map(t => t.file));
        const leafSrc = stripComments(await fetch(`/modules/${MODULE_ID}/scripts/bridge-guards.mjs`).then(r => r.text()));
        const blind = [], idle = [];
        for (const [file, raw] of await otherSources()) {
            const text = stripComments(raw);
            const name = file.split("/").pop();
            const listens = /game\.socket\.on\(/.test(text);
            if (EXEMPT[name] && !listens) idle.push(name);
            if (!listens || tableFiles.has(name)) continue;
            if (!/payload[?.]*\.actorId|payload\.\w*[Ii]d\b/.test(text)) continue;
            if (EXEMPT[name]) continue;
            /* A guard counts only when code outside it names it (the review of the
               guard split, 24.09.2026): the trap relay's ownership check moved into
               `guardRelayOwner`, and a file-wide grep kept passing with the guard
               defined but never asked. So the guards' own definitions are cut out,
               and ownership is looked for in what is left plus the guards that
               rest names - the file's own or the leaf's, where E31 put E03's. */
            let rest = text;
            for (const [, guard] of text.matchAll(/^(?:export )?(?:async )?function (guard[A-Z]\w*)\(/gm)) {
                const decl = topLevelFunction(rest, guard);
                if (decl) rest = rest.replace(decl, "");
            }
            const asked = withGuards(`${text}\n${leafSrc}`, rest);
            if (!asked.missing.length && rest.includes("senderOf(senderId)") && /ownsActor\(sender/.test(asked.body)) continue;
            blind.push(name);
        }
        ok(!idle.length, `exempt from the rule, and no longer listening on the socket - take them off the list: ${idle.join(", ")}`);
        ok(!blind.length,
            `these files open a socket and act on an id from the packet without `
            + `senderOf/ownsActor, and are not on the exemption list: ${blind.join(", ")}`);
    }],

    ["R2 - no styling rule in the sheet has lost its emitter", async () => {
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

    ["R3 - every sound a card asks for is a sound that exists", async () => {
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

    ["R20 - every sound in the catalogue is a sound something plays", async () => {
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

    ["R4 - every setting the module reaches for is a setting it registered", async () => {
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

    ["R5 - no sound is played inside a function only the GM runs", async () => {
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

    ["R6 - no bridge request can be made by the one person it is addressed to", async () => {
        /*
         * TWO WAYS TO LOSE AN ACTION, and the bridge has to be closed against
         * both.
         *
         * A GM calling `requestSabotage` emits a socket packet that Foundry does
         * NOT deliver back to its sender: the request is gone, no error, no
         * refusal, and the action the player paid for simply did not happen.
         *
         * A table with no GM connected is the other end of it. The request has to
         * be refused at once, because the alternative is a player watching a
         * spinner for three minutes and then losing the action anyway.
         *
         * SINCE E31 (25.09.2026) both are one function's: every request asks
         * through `bridgeRequest` (bridge-guards.mjs), which refuses with `noGm`
         * before it sends anything and runs a GM's request on the GM's own client
         * when the request says how (`local`). So the first half reads that every
         * request asks through it and emits nothing of its own, and that the one
         * wait asks for a GM before it emits.
         *
         * THE SECOND HALF IS NOT WHERE IT LOOKS. A dozen requests have no `local`
         * and all of them are correct: the branch lives in the domain function
         * that calls them - `sabotageProject` does the work itself when it is the
         * GM and only reaches for the bridge otherwise. So the question is not
         * "does the request have a branch" but "can a GM get here at all", which
         * is the call site's business, and that is what this reads.
         */
        const sources = new Map(await otherSources());
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const leaf = stripComments(sources.get("bridge-guards.mjs") ?? "");
        ok(bridge.length > 1000 && leaf.length > 1000, "gm-bridge.mjs or bridge-guards.mjs did not load");

        const requests = [...bridge.matchAll(/^export\s+(?:async\s+)?function\s+(request\w+)\s*\(/gm)].map(m => m[1]);
        ok(requests.length > 20, `only ${requests.length} bridge requests found`);

        // Every request asks through the one wait, and emits nothing itself - shown a request that does first.
        const ownRoad = (text, name) => { const body = fnSource(text, name); return !/\bask\(|\bbridgeRequest\(/.test(body) || /\.emit\(/.test(body); };
        equal(ownRoad('export function requestFixture(a) {\n    game.socket.emit("x", { a });\n}\n', "requestFixture"), true,
            "the reader does not see a request that emits for itself");
        const own = requests.filter(name => ownRoad(bridge, name));
        ok(!own.length, `these do not ask through bridgeRequest, or emit for themselves: ${own.join(", ")}`);

        // With no GM, the one wait refuses before it sends: `noGm` is settled before its first emit.
        const sendsFirst = text => {
            const refuses = text.search(/fail\(entry, "noGm"\)/), sends = text.search(/\bemit\(/);
            return !(refuses > 0 && sends > refuses);
        };
        equal(sendsFirst('function createWaiter() {\n    emit(packet, to);\n    if (!to.length) return fail(entry, "noGm");\n}\n'), true,
            "the reader does not see a wait that sends before it asks for a GM");
        ok(!sendsFirst(fnSource(leaf, "createWaiter")), "the one wait sends before it asks whether a GM is there");

        const reachable = [];
        for (const name of requests) {
            // Does the request answer for the GM itself? Then any call site is
            // safe and there is nothing more to ask.
            if (/\blocal:/.test(fnSource(bridge, name))) continue;

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
                    if (!/game\.user\??\.isGM|isPrimaryGm\(\)/.test(before)) {
                        reachable.push(`${file}:${lineAt(text, call.index)} → ${name}`);
                    }
                }
            }
        }
        ok(!reachable.length,
            `a GM reaching these talks to itself down a socket and the action is lost: ${
                reachable.join(", ")}`);
    }],

    ["R7 - Reroll reads no field of the bookmark that nothing ever writes", async () => {
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

    ["R8 - every action on the sheet has a branch, and every branch has a briefing", async () => {
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
        const body = bodyOf(rolls, "export async function performAction", { until: "\n}\n" });

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

    ["R9 - nothing the investigation depends on is in a world setting", async () => {
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

    ["R10 - the hot lookups stay under their ceiling", async () => {
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
         * anything is armed, several hundred times a session.
         *
         * ASKED, NOT RAISED (E01, 24.09.2026; audit S14-01). This used to time
         * `Hooks.callAll("drpgRoomCrossed", ...)` sixty-one times for the first
         * student and the first room - and a hook is not a measurement, it is the
         * event. A trap armed on "enters" in that room fired on the first call and
         * stamped itself spent, and every other listener (voice, fog, music) took
         * sixty-one crossings nobody made, from the tier that promises a GM it can
         * be run during play. `armedIn` is the lookup the crossing makes, and the
         * lookup is the part that can go quadratic.
         */
        const M = await import("./movement.mjs");
        const V = await import("./vault.mjs");
        const R = await import("./remnants.mjs");
        const C = await import("./cleanup.mjs");
        const T = await import("./traps.mjs");

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
            crossingWithTraps: time(() => T.armedIn(room), 60)
        };
        const CEILING = 2.0;   // ms per call, on a machine also running Foundry
        const over = Object.entries(measured)
            .filter(([, ms]) => ms > CEILING)
            .map(([name, ms]) => `${name} ${ms.toFixed(3)} ms`);
        log(`R10 hot paths: ${Object.entries(measured)
            .map(([n, ms]) => `${n} ${ms.toFixed(3)}ms`).join(", ")}`);
        ok(!over.length, `over the ${CEILING} ms ceiling: ${over.join(", ")}`);
    }],

    ["R11 - no bridge request can wait forever", async () => {
        /*
         * THE PAIR TO R6, AND THE HALF A GM'S OWN CLIENT CANNOT MEASURE.
         *
         * A request that waits on a ruling has to be able to give up. B-F5-1 was
         * a player who lost an action because nobody answered; it was fixed once
         * and has had no test since.
         *
         * SINCE E31 (25.09.2026) there is one wait, `createWaiter` in
         * bridge-guards.mjs, and R165 drives it with a clock of tens of
         * milliseconds: no answer, a late answer, a GM who never says "got it".
         * What this reads is that nothing waits anywhere else - no request makes a
         * promise of its own, nor do the trap relay and the search tokens - and
         * that each of the one wait's two clocks settles the request it runs for.
         * Shown a request with a promise of its own, and a clock that settles
         * nothing, first.
         */
        const sources = new Map(await otherSources());
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const leaf = stripComments(sources.get("bridge-guards.mjs") ?? "");
        const requests = [...bridge.matchAll(/^export\s+(?:async\s+)?function\s+(request\w+)\s*\(/gm)].map(m => m[1]);
        ok(requests.length > 20, "gm-bridge.mjs did not load");

        const waitsAlone = (text, name) => /new Promise/.test(fnSource(text, name));
        equal(waitsAlone("export function requestFixture() {\n    return new Promise(resolve => setTimeout(resolve, 10));\n}\n", "requestFixture"), true,
            "the reader does not see a request that waits on a promise of its own");
        const alone = requests.filter(name => waitsAlone(bridge, name));
        ok(!alone.length, `these wait on a promise of their own, outside the one wait: ${alone.join(", ")}`);
        ok(!/new Promise/.test(fnSource(stripComments(sources.get("traps.mjs") ?? ""), "registerTraps")),
            "the trap relay waits on a promise of its own");
        const searches = stripComments(sources.get("search-tokens.mjs") ?? "");
        ok(searches.length > 1000 && !/new Promise/.test(searches), "the search tokens wait on a promise of their own");

        // Each clock of the one wait settles the request: it closes it and fails it as not answered.
        const settles = (text, clock) => new RegExp(`${clock} = clock\\.set\\(\\(\\) => \\{[^}]*close\\(entry\\);[^}]*fail\\(entry, "noAnswer"\\)`).test(text);
        equal(settles("entry.ackTimer = clock.set(() => {\n    entry.ackTimer = null;\n    close(entry);\n});", "entry\\.ackTimer"), false,
            "the reader takes a clock that settles nothing for one that does");
        const wait = fnSource(leaf, "createWaiter");
        ok(settles(wait, "entry\\.ackTimer"), "the one wait's clock for the \"got it\" does not settle the request");
        ok(settles(wait, "entry\\.answerTimer"), "the one wait's clock for the answer does not settle the request");
    }],

    ["R12 - every standing window fits the screen Foundry calls a minimum", async () => {
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

        /* The source half above has already run and would have failed loudly. What
           needs a browser is the half below - a window reports a width only where
           there is layout - so that is asked of the environment here, before any
           window is opened (E01, audit S14-05). It used to be asked afterwards, of
           the number of windows that had opened, and a module whose windows stopped
           opening read the same as a browser with no layout: "skip". */
        needs(env.layout(), `${openers.length} standing windows found, and a window's width needs a browser that lays out`);

        const wide = [], refused = [], unplaced = [], pinnedTop = [];
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
                    /* AND IT WAS PLACED. An ApplicationV2 writes its left and top once its
                       render has finished; a render that throws never gets there, and the
                       window sits at 0,0 and cannot be dragged. This loop opened the Item
                       tables window in exactly that state from 1.2.44 to 1.2.50 and counted
                       it as measured, because the opener's rejection is swallowed above. */
                    if (!el.style.left || !el.style.top) unplaced.push(name);
                    /* AND IT CAN BE MOVED DOWN. Foundry keeps a window's RECORDED box on the
                       screen, so a recorded height the window does not show pins its top:
                       the Sound window recorded 1278 px over 506 on screen under the glass
                       and would not leave the top of the screen (22.09). */
                    const recorded = app.position?.height;
                    if (typeof recorded === "number" && recorded - el.offsetHeight > 40) {
                        pinnedTop.push(`${name} (${Math.round(recorded)} recorded, ${el.offsetHeight} shown)`);
                    }
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
        ok(!unplaced.length, `these windows opened without a position - their render threw: ${unplaced.join(", ")}`);
        ok(!pinnedTop.length, `these windows cannot be dragged down - a height they do not show: ${pinnedTop.join("; ")}`);
        ok(!wide.length, `these do not fit the screen: ${wide.join("; ")}`);
    }],

    ["R13 - every trigger a trap can name has something listening for it", async () => {
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

    ["R16 - no private card is posted around the private channel", async () => {
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

    ["R18 - using an item mid-incident costs a turn like everything else", async () => {
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
        const body = bodyOf(sheet, "function inCrisis", { length: 400 });
        ok(/stage\s*!==\s*"incident"/.test(body),
            "inCrisis no longer asks whether the incident has actually started");
        ok(/"victim"/.test(body) && /"killer"/.test(body),
            "inCrisis no longer restricts itself to the two people in the fight");
    }],

    ["R19 - the windows a GM works from stay true while they are open", async () => {
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
         * name - the same reasoning as `STANDING` in tests-kit.mjs.
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
            // Up to the next top-level declaration, which is where its body ends (null: none).
            const body = topLevelFunction(text, opener);
            if (body === null) { dead.push(`${opener} is not in ${file}.mjs any more`); continue; }
            /*
             * ONE HOP, because the GM panel does it through `keepPanelFresh` -
             * two regions on different clocks, which is worth its own function.
             * A window that reaches the helper through a named local is as live
             * as one that calls it inline; a window that reaches it through
             * three would be hiding.
             */
            const helpers = [...text.matchAll(/function (\w+)\([^)]*\)\s*\{/g)]
                .filter(m => topLevelFunction(text, m[1])?.includes("keepLive("))
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

    ["R15 - nothing reads a card's words off the document", async () => {
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

    ["R17 - a trap can be sprung by somebody who is not the GM", async () => {
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

    ["R14 - every setting listener waits on the hook its setting actually fires", async () => {
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
    ["R21 - no control is decided by a function nobody called", async () => {
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

    ["R22 - every name this module calls is a name it has", async () => {
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

    ["R23 - a document hook that checks for a GM checks for THE GM", async () => {
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
                // From the bracket the match opened to the one that closes it.
                const from = m.index + "Hooks.on".length;
                let depth = 0;
                let j = from;
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

    ["R24 - an action that swings a weapon knows which weapon it swung", async () => {
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

    ["R25 - the action budget comes back when the Eclipse opens, and only there", async () => {
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

        const opening = bodyOf(eclipse, "export async function startEclipse", { until: "export async function endEclipse" });
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

    ["R26 - a critical's Hope is paid once, by one payer", async () => {
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
        const hookBody = fnSource(award, "onChatMessage");
        ok(!/CritHope/.test(hookBody),
            "the chat-message hook is paying a critical's Hope again; the funnel in "
            + "critical.mjs already pays it in full, and both together hand out three");

        // The one path that still owes a point keeps owing it.
        ok(/adjustCritHopeTopUp/.test(reroll),
            "reroll.mjs no longer settles the second Hope for a crit reached by rerolling, "
            + "which the funnel never sees");
    }],

    ["R151 - the chapter ends by closing the trial, and the panel can say so", async () => {
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
        const check = bodyOf(chapter, "async function checkBodyFound", { until: "export async function openBodyDiscoveryDialog" });
        ok(check.length > 200, "checkBodyFound is gone or has moved past openBodyDiscoveryDialog");
        ok(/FLAGS\.monocub/.test(check), "a Monocub counts as a body again");
        ok(/deathRecord\(/.test(check), "a body from an earlier chapter counts as a body again");
        ok(/export function discoverBody[\s\S]{0,240}enqueueBodyWork\(/.test(chapter),
            "the GM's own announcement no longer waits in the discovery queue");
        ok(/export function maybeBodyFound[\s\S]{0,240}enqueueBodyWork\(/.test(chapter),
            "the automatic discovery check no longer waits in the discovery queue");
        const gather = bodyOf(effects, "export async function gatherEveryone", { until: "async function fallbackGather" });
        ok(/isDeceased\(/.test(gather), "gatherEveryone moves the dead again");
    }],

    ["R30 - a verdict is locked before it does anything", async () => {
        /*
         * F2, and the review that followed it. The lock used to be written after every Level Up
         * window and the Blackened's rule had closed, so a second verdict could start in the
         * meantime. The check and the write have to come before the first execution.
         */
        const vote = stripComments(new Map(await otherSources()).get("vote.mjs") ?? "");
        const apply = bodyOf(vote, "export async function applyVerdict");
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
        const open = bodyOf(vault, "export async function openRoomSetupDialog");
        ok(open.length > 1000, "openRoomSetupDialog is gone");
        // fog.mjs still exports it - suite fixtures seed a scene's ledger through
        // it - but Room Setup must not be the window that calls it.
        ok(!/saveDiscoveryMatrix/.test(vault), "Room Setup writes the whole fog matrix again");
        const form = bodyOf(vault, "function readRoomSetupForm(", { until: "function wireRoomRatio(" });
        ok(/defaultChecked/.test(form),
            "the Fog tab no longer compares a box with what the window drew, so every box is a decision again");
        const claim = open.indexOf("bedroomClaimedTwice(");
        const write = open.indexOf("applyDiscoveryChanges(scene");
        ok(claim > 0 && write > claim, "the fog is written before the one-bedroom check can refuse the Apply");
        ok(/action:\s*"discoverAll",\s*type:\s*"button"/.test(open)
            && /action:\s*"hideAll",\s*type:\s*"button"/.test(open),
            "Discover all / Hide all submit the window again, which throws away the other tabs' edits");
        // `type: "button"` is not enough on its own: DialogV2 makes every entry in
        // `buttons` an action, so the click has to stop before the window hears it.
        const bulk = bodyOf(vault, "function wireFogButtons(", { until: "function wireTwoRoomsCheck(" });
        ok(/stopPropagation\(\)/.test(bulk),
            "Discover all / Hide all let the click reach DialogV2, which closes the window on it");
    }],

    ["R32 - the case dashboard saves the rows on screen, and a plan row only when it was edited", async () => {
        /*
         * F1: a trace the filter hides has no inputs, and Save wrote its blanks over it.
         * F6: Save pushed the Key plan's old name back over a rename on the Traces tab.
         */
        const inv = stripComments(new Map(await otherSources()).get("investigation.mjs") ?? "");
        ok(/traces\.filter\([^)]*\)\s*=>\s*q\(`name\./.test(inv),
            "the dashboard's Save reads a row the filter is hiding as blanks again");
        const plan = bodyOf(inv, "async function saveKeyPlan", { until: "function stripDraft" });
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
        // The two are runs of SEARCH_ACTIONS since E31 (25.09.2026), each a function of its own.
        ok(!/takePlant/.test(fnSource(tokens, "runSpend")), "the token spend takes the plant out of the room again");
        ok(/searchedBy\.get\(/.test(fnSource(tokens, "runTakePlant")),
            "a player can ask for a plant in a room they never spent a token in");
        // A plant that answers after the plant check's clock goes back to its room while the GM's client still takes
        // one back (E31 review): the wait keeps that late answer for the GM's window, not for one more clock (R165).
        ok(/\blateMs:\s*(?:PLANT_WINDOW_MS|TIMING\.plantWindowMs)\b/.test(fnSource(tokens, "requestPlantCheck")),
            "the plant check drops a late answer before the GM's window for giving the plant back has closed");
        const draw = bodyOf(rolls, "async function searchDraw(", { until: "async function performSearch(" });
        ok(draw.includes("SearchTokens.takePlant("), "the Search no longer asks for a plant");
        equal((rolls.match(/SearchTokens\.takePlant\(/g) ?? []).length, 1,
            "something other than the draw takes the plant out of the room");
        const search = bodyOf(rolls, "async function performSearch(");
        const take = search.indexOf("searchDraw(");
        ok(take > 0, "performSearch no longer draws anything");
        for (const marker of ["searchSpecific(", "searchNothing(", "searchStash("]) {
            const at = search.indexOf(marker);
            ok(at > 0 && at < take, `the plant is taken before ${marker.slice(0, -1)} can end the Search`);
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
        const start = bodyOf(eclipse, "export async function startEclipse", { until: "\nexport " });
        ok(/clearSeals\(\)/.test(start), "the Eclipse opens with the seals and restrictions still on");
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
        const plant = bodyOf(vault, "export async function plantOnPerson", { until: "\nexport " });
        ok(/def\.plant\?\.threshold/.test(plant) && /def\.plant\?\.unseen/.test(plant),
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
        const conceal = bodyOf(cleanup, "async function concealFromWitnesses", { until: "\nasync function " });
        ok(/return "rolled";/.test(conceal) && !/return true;/.test(conceal),
            "concealFromWitnesses no longer tells its callers a concealment roll landed");

        /*
         * Bounded by the next DECLARATION, not by a character count and not by a
         * comment: `stripComments` blanks a comment to spaces rather than deleting
         * it, so there is no "/**" left to look for - and 900 characters runs into
         * `stageSixDef`, which asks `isCleaner` for its own good reasons. The kit's
         * fnSource reads it that way (E30).
         */
        const release = fnSource(cleanup, "releaseTamper");
        const kept = bodyOf(release, "if (rolled)", { until: "if (charge)" });
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
        const sabotage = bodyOf(rolls, "async function performSabotage", { until: "async function performTamper" });
        ok(sabotage.length > 400, "performSabotage is gone or has moved past Tamper");
        // Only the branch the room watched. The concealment roll's own cancel still
        // refunds - nothing was rolled there - and that is `abort` further up.
        const watched = bodyOf(sabotage, "sabotageWatched");
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
        const status = bodyOf(inv, "export function keyPlanStatus", { until: "export async function chargeForUnfoundKeys" });
        ok(status.length > 400, "keyPlanStatus is gone or has moved past the charge");
        ok(/offPlan/.test(status) && /foundAny/.test(status),
            "keyPlanStatus counts the plan's rows only again");
        const charge = bodyOf(inv, "export async function chargeForUnfoundKeys");
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
        const grants = bodyOf(dialog, "function grantsFor");
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
        const body = bodyOf(src, "export async function performAction", { until: "\n}\n" });

        const gate = body.indexOf('"classTrial"');
        const fight = body.indexOf("DRPG.Murder.actionsLocked");
        const dead = body.indexOf("DRPG.Chapter.deadCannotAct");
        const dispatch = body.indexOf("const def =");
        must(dispatch > 0, "performAction no longer looks its action up as `const def =` - the order below has no end to measure to");
        ok(gate > 0, "performAction no longer refuses anything during a Class Trial");
        /* Above the dispatch, as the gate is (E30 review, 25.09.2026): since E30 `body` is
           the whole function, and the exemption read anywhere in it would hold after it
           moved below the dispatch while another "classTrial" kept `gate` above. */
        ok(/actionKey !== "analyze" && getClock\(\)\.phase === "classTrial"/.test(bodyOf(body, "const def =", { back: body.length })),
            "the trial gate no longer keeps Analyze open above the dispatch, which is the one tile it must");
        ok(fight > 0 && dead > 0, "the fight or the death refusal moved out of performAction");
        ok(gate > fight && gate > dead,
            "the trial gate rose above the fight or the death check, which outrank it");
        ok(gate < dispatch, "the trial gate fell below the dispatch it is there to stop");

        // The courtroom is locked ABOVE the movement economy: a GM who turned the
        // crossing cost off did not turn off the trial.
        const move = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/movement.mjs`).then(r => r.text()));
        const cross = bodyOf(move, "function canCross");
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
        const hopeGate = bodyOf(callsSrc, "function hopeCallBarred", { until: "export async function spendHopeCall" });
        ok(hopeGate.length > 100 && !hopeGate.includes("classTrial"),
            "Hope Calls are barred during a trial now, which is the opposite of the decision");
        const despairGate = bodyOf(callsSrc, "export async function spendDespairCallFor");
        ok(despairGate.includes("classTrial"),
            "a Despair Call is no longer refused during a Class Trial");
    }],

    ["R43 - the trial's budget follows the phase, not the window", async () => {
        /*
         * MORE THAN ONE ROAD INTO A CLASS TRIAL, and only one of them has a window
         * (T-1). `openDebate` calls `startFloor`, which moves the phase itself, so a
         * refill written only into `startClassTrial` left a real road where
         * everything was locked and nobody was paid.
         *
         * 1.2.47 settled where such things go (d6b069e): everything that happens
         * because the phase ENTERS a trial lives in `reconcilePhase`, which
         * `setClock` runs whenever the phase really changes - `startClassTrial`,
         * `setPhase` (and so `startFloor`), the clock editor and the reset alike. So
         * the budget is there, and ONLY there: a door that also paid it would pay
         * the table twice, and the second and third debate of one trial, which do
         * not move the phase, refill nothing.
         */
        const clockSrc = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/clock.mjs`).then(r => r.text()));
        const reconcile = bodyOf(clockSrc, "async function reconcilePhase(", { until: "async function reconcileEclipseEnded(" });
        ok(reconcile.length > 200, "reconcilePhase has moved or gone");
        const entering = bodyOf(reconcile, 'if (to === "classTrial")');
        ok(reconcile.includes('if (to === "classTrial")') && entering.includes("openTrialBudget("),
            "a phase moving into a Class Trial no longer hands out the time of day's actions");
        ok(/patch\.phase !== before\.phase[\s\S]{0,200}reconcilePhase\(/.test(clockSrc),
            "the phase's reconciliation runs on a write that did not move the phase, so a "
            + "second debate refills the budget again");

        const ui2 = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial-floor-ui.mjs`).then(r => r.text()));
        const floor = stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/trial-floor.mjs`).then(r => r.text()));
        ok(!ui2.includes("openTrialBudget(") && !floor.includes("openTrialBudget("),
            "a door into the trial pays the budget itself as well as the phase, so the table is paid twice");
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

        const open = bodyOf(floorSrc, "export async function openObjection", { until: "export async function openRebuttal" });
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
        const dialog = bodyOf(trialSrc, "export async function presentDialog", { until: "export async function presentBullet" });
        const offer = bodyOf(dialog, "const offerPresent", { until: ";" });
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
        const firstButton = bodyOf(dialog, "buttons: (offerPresent ? [", { until: "}" });
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
        const seize = bodyOf(src, "async function seizeFloor");
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
        const analyze = bodyOf(src, "async function performAnalyze", { until: "async function analyseBullet" });
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
            const body = fnSource(src, road);
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
        const body = bodyOf(messenger, "function refundOnCard(", { until: "async function ruleCreateItem(" });
        ok(body.length > 300 && body.includes("async function ruleDecline("),
            "the refusal's refund has moved out of refundOnCard and ruleDecline");
        ok(body.includes("PRICE_CHAINS"),
            "the refund no longer takes its amount from the table, so a card can name its own");
        // `cost` may still say WHETHER anything was paid (a "0" card refunds
        // nothing); what it may never do is say how much comes back.
        ok(!/amount:\s*(?:Number\()?data\./.test(body)
            && !/refund\w*\(actor,\s*(?:Number\()?data\./.test(body),
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
            const body = bodyOf(cleanup, `export async function ${fn}`, { until: "\nexport " });
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
        for (const spent of [...cleanup.matchAll(/await spendStress\(actor\)/g)].map(m => m.index)) {
            const before = cleanup.slice(Math.max(0, spent - 260), spent);
            ok(/validPrice\(|!paidStep|for \(let i = 0/.test(before),
                "a GM-side Sanity charge is back that no missing price claim explains");
        }
        ok(/function validPrice\(/.test(cleanup),
            "nothing bounds the step a Tamper packet claims to have paid");
        ok(/async function handBack\(/.test(cleanup),
            "the critical is back to healing Sanity the attempt may never have spent");
        const conceal = bodyOf(cleanup, "async function concealFromWitnesses");
        ok(/restoreStress\(/.test(conceal.slice(0, 1600)),
            "the concealment's own refund is gone - that one is not the attempt's price");

        // The step travels: the roll context, both sides of the bridge, the replay.
        const bridge = stripComments(new Map(await otherSources()).get("gm-bridge.mjs") ?? "");
        const socket = bodyOf(bridge, "async function handleCleanup(", { until: "async function handleMeddle(" });
        ok((socket.match(/price: payload\.price/g) ?? []).length >= 2,
            "the socket branch drops the price claim for one of the two resolvers, "
            + "so every remote Tamper on that road pays twice");
        const reroll = stripComments(new Map(await otherSources()).get("reroll.mjs") ?? "");
        const replay = bodyOf(reroll, "async function settleCleanup");
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

        const cost = bodyOf(sheet, "function costOf(", { until: "function costLabelFor(" });
        ok(cost.includes("priceQuoteFor("),
            "costOf is back to counting a flat cost for a priced action");
        ok(!/key === "tamper" && isCleaner\(actor\)/.test(cost),
            "costOf carries its own copy of D3 again, beside the skip list that already says it");

        const label = bodyOf(sheet, "function costLabelFor(", { length: 900 });
        ok(label.includes("priceLabel("),
            "the tile's price label no longer says which step will pay");

        const button = bodyOf(sheet, "function actionButton(", { length: 6000 });
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
        const tamper = bodyOf(sheet, "function tamperBlock(", { until: "async function askTamper(" });
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
        const repaint = bodyOf(sheet, "function repaintInPlace(", { until: "function refreshPricedTiles(" });
        ok(repaint.includes("refreshPricedTiles("),
            "a Hope or Sanity change leaves the priced tiles showing yesterday's price");
        const tiles = bodyOf(sheet, "function refreshPricedTiles(", { length: 900 });
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
         * AND THE SENTENCE ITSELF, which is `analyzedText` on the trace's `public`
         * record, in the bullet's secret and on the item once it is identified -
         * the model 1.2.47 shipped, whose own scenario ("the analysis half of a
         * trace is not on the item until it is bought") holds the four places it
         * must not leak. What is read here is the two roads that model did not
         * have when T-2 met it.
         */
        const analyze = stripComments(sources.get("analyze.mjs") ?? "");
        const identify = bodyOf(analyze, "async function identify(");
        ok(/secret\.analyzedText\s*\|\|\s*remnantPublic(?:ById)?\(/.test(identify),
            "identify no longer asks the trace when a bullet's secret holds no reading");

        // A looted trace is usually already revealed, so `revealSourceOf` returns
        // before it reconciles the new copy: the loot mint reads the ledger itself.
        const handover = stripComments(sources.get("handover.mjs") ?? "");
        const loot = bodyOf(handover, "async function mintLootBullet(", { until: "\n}" });
        ok(/analyzedText/.test(loot),
            "a bullet taken off a body is born with nothing to say when it is analysed");
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
        const wipe = bodyOf(setup, "async function wipeSeason");
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
            // The selector of the rule this declaration sits in: the text between the
            // "{" that opened the rule and the brace before it (a match, not a cut).
            const upTo = `${lines.slice(0, i).join("\n")}\n${line.slice(0, at.index)}`;
            const rule = upTo.match(/([^{}]*)\{[^{}]*$/)?.[1] ?? "";
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
        // To the function's own end, not a fixed count: comments are blanked, not
        // removed, so a longer note inside it pushed the line past a 2000-character cut.
        const fit = bodyOf(utils, "function windowWidthFor", { until: "\n}" });
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
        const paint = bodyOf(sheet, "function paintTamper", { until: "function actionButton(" });
        ok(paint.length > 200, "paintTamper has moved or gone");
        ok(!/\.replace\(/.test(paint),
            "paintTamper edits the tooltip it finds again, so it can eat another line");
        ok(paint.includes("drpgTipHead") && paint.includes("drpgTipTail"),
            "paintTamper no longer rebuilds the tooltip from the halves the tile kept");

        const button = bodyOf(sheet, "function actionButton(");
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
        const body = bodyOf(hud, "function control(");

        const born = body.indexOf("controlsBusy()");
        const listener = body.indexOf("addEventListener");
        const awaited = body.indexOf("await handler()");
        ok(born > 0 && listener > born,
            "a control built while a press is in flight is no longer born disabled");
        const guard = body.indexOf("controlsBusy()", listener);
        ok(guard > listener && guard < awaited,
            "the clock's controls no longer refuse a second press before running the first");

        const caught = bodyOf(bodyOf(body, "await handler()"), "catch", { until: "finally" });
        ok(/\berror\(/.test(caught) && /ui\.notifications\.error\(/.test(caught),
            "a clock control that throws is silent again");

        /* releaseControls ALONE (E30 review, 25.09.2026). Read from its name to the end of
           the file, the second half passed on `control()` below it, which creates each
           button with the same class - so the latch could lose the class and this stay
           green. */
        const release = fnSource(hud, "releaseControls");
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
        const body = bodyOf(clock, "export async function rewindTimeOfDay", { until: "export async function setTimeOfDay" });
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

        const open = bodyOf(chapter, "export async function openBodyDiscoveryDialog", { until: "function allBullets" });
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

        const wire = bodyOf(inv, "function wireCase(", { until: "function wireCaseFilters(" });
        ok(wire.length > 100, "wireCase has moved or gone");
        ok(!wire.includes("bodyFound"),
            "the greying rides `wireCase`, which keepLive defers while the GM is typing; it belongs "
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
        const picker = bodyOf(utils, "export function wirePortraitPickers", { until: "export function panelTabs" });
        ok(picker.length > 300, "wirePortraitPickers is gone or has moved past panelTabs");
        const cb = picker.indexOf("callback:");
        ok(cb > 0, "wirePortraitPickers no longer hands the FilePicker a callback");
        ok(bodyOf(picker, "callback:").includes("querySelector"),
            "the picker's callback writes to the nodes it captured before the picker opened; a "
            + "live window has replaced both by the time somebody chooses a file");
        const insync = picker.indexOf('getAttribute("src")');
        ok(insync > 0 && insync < cb,
            "nothing puts the picture back in step with the hidden field after a rebuild");

        const inv = stripComments(sources.get("investigation.mjs") ?? "");
        const helper = bodyOf(inv, "export function wireKeyLimitOverride", { until: "export async function openInvestigationDashboard" });
        ok(helper.length > 200,
            "wireKeyLimitOverride is gone or has moved past openInvestigationDashboard");
        ok(/addEventListener\("change", apply\)/.test(helper),
            "the override no longer follows the tick box at all");
        ok(helper.indexOf("apply();") > helper.indexOf("addEventListener"),
            "the override is wired but never applied, so a redraw that restores the tick leaves "
            + "the rows disabled");
        const wire = bodyOf(inv, "function wireCase(", { until: "function wireCaseFilters(" });
        ok(wire.includes("wireKeyLimitOverride("),
            "the dashboard stopped re-wiring the Key Remnant limit override after a rebuild");

        // The order both halves of this depend on, one file up.
        const live = stripComments(sources.get("live.mjs") ?? "");
        const rebuild = bodyOf(live, "const rebuild = (force = false)", { until: "const schedule =" });
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
        const manage = bodyOf(ui2, "export async function manageClassTrial", { until: "export async function openVoteDialog" });
        ok(manage.length > 500, "manageClassTrial is gone or has moved past the vote window");

        ok(manage.includes("setInterval("), "the trial console stopped counting the debate down");
        ok(/\}, 1000\)/.test(manage), "the console's tick is no longer once a second");
        ok(manage.includes("live.refresh("),
            "the tick paints something of its own instead of going through the live region");
        const tick = bodyOf(manage, "setInterval(", { until: "}, 1000)" });
        ok(tick.includes("isConnected") && tick.includes("clearInterval("),
            "the console's tick outlives the window");
        ok(tick.includes("trialFloor()"), "the tick runs while no floor is open");

        ok(/hooks: \["drpgBallotsChanged"\]/.test(manage), "the console stopped watching for a ballot");
        ok(!/watch: \{[^}]*settings:/.test(manage),
            "the console's watch was narrowed to a list of settings, so the floor and the trial "
            + "record no longer wake it");

        const view = bodyOf(ui2, "function trialConsoleHtml(", { until: "function trialSignature(" });
        ok(view.includes("DRPG.Floor.holdingDiscussionOver") && view.includes("Math.max(left, 0)"),
            "an overrun mode prints a clock running backwards again");

        // `drpgBallotsChanged` is 1.2.47's name for this event, fired where a
        // ballot is cast, a vote opens and voters are reminded; F8 adds the close.
        const vote = stripComments(sources.get("vote.mjs") ?? "");
        const EMIT = 'Hooks.callAll("drpgBallotsChanged")';
        ok(vote.split(EMIT).length - 1 >= 4,
            "one of the four vote events stopped being reported");
        const cast = bodyOf(vote, "function onBallotCast", { until: "function refuseBallot" });
        ok(cast.indexOf("ballots.set(") < cast.indexOf(EMIT),
            "the ballot is reported before it is in the tally, so a listener redraws the stale list");
        const close = bodyOf(vote, "export async function closeVote");
        ok(close.indexOf("ballots = null") > 0 && close.indexOf("ballots = null") < close.indexOf(EMIT),
            "the vote is reported closed before the tally is cleared");
        ok(close.indexOf(EMIT) < close.indexOf("DRPG.Vote.nobodyVoted"),
            "the closing is reported after the road that returns early, so a vote nobody answered "
            + "leaves the console printing its voters");

        const floorSrc = stripComments(sources.get("trial-floor.mjs") ?? "");
        const extend = bodyOf(floorSrc, "export async function extendFloor", { until: "export async function endFloor" });
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
        const dialog = bodyOf(murderSrc, "export async function openMurderDialog", { until: "async function rollOpening" });
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

        const tail = bodyOf(dialog, "await openMurder(");
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

        const block = bodyOf(css, "body.drpg-theme-monokuma-legacy {", { until: "}" });
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
            /* A floor is capped at the rung's own size (review of stage D): a bare
               `max(10px, ...)` assumed a 16px root, and on a smaller one it held the
               rung ABOVE Foundry's own at 100 %. */
            if (value.includes("max(")) {
                const floor = value.match(/max\(min\((\d+)px, ([\d.]+)rem\)/);
                ok(floor, `rung ${n}'s floor is not capped at its own size, so a small root grows it`);
                ok(Number(floor[1]) <= n,
                    `rung ${n} is floored at ${floor[1]}px, so 100 % GROWS it`);
                equal(floor[2], rem[1], `rung ${n}'s floor is capped at another rung's size`);
            }
        }

        // The declaration block the rungs are stated in, from the first of them to its end.
        const root = bodyOf(css, "--drpg-text-xs:", { until: "}" });
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
        const apply = bodyOf(settings, "export function applyTheme", { until: "function scaleWindow" });
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
        const wide = bodyOf(css, "@media (min-aspect-ratio: 2/1)");
        ok(wide.includes("--drpg-legacy-scale"),
            "on an ultrawide screen the GM panel is the one window whose box ignores the slider");

        const settings = stripComments(new Map(await otherSources()).get("settings.mjs") ?? "");
        const body = bodyOf(settings, "function scaleWindow", { until: 'Hooks.on("renderApplicationV2"' });
        ok(body.length > 400, "scaleWindow has moved or gone");
        ok(body.includes("if (!el) return;"), "scaleWindow's door is not the element test");
        ok(!/if \(!el \|\|[^\n]*stained-glass/.test(body),
            "the theme test is back in the door, so Legacy loses its window box again");
        // The numbers are `SHEET_SIZE.glass` in config.mjs since 1.2.47 (UI-13).
        equal((body.match(/want\.width = SHEET_SIZE\.glass\.width/g) ?? []).length, 1,
            "the sheet's stated size is declared more than once, or not at all");
        // 700, not 400: the UI-09 note on the document test sits between the two now.
        ok(/drpg-theme-stained-glass[\s\S]{0,700}want\.width = SHEET_SIZE\.glass\.width/.test(body),
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

        const body = bodyOf(live, "export function handOff", { until: "\nexport " });
        ok(body.length > 100, "handOff's body could not be read");
        ok(!/\bawait\b/.test(body),
            "handOff awaits the close, so the opener's promise resolves before the round "
            + "trip is registered - which is the whole defect");
        ok(/\.then\(/.test(body) && /\.catch\(/.test(body),
            "handOff no longer builds the round trip in the same turn, or it can reject");

        const row = bodyOf(panel, "function wireAliveRow(", { until: "function wireAliveTable(" });
        ok(row.length > 200, "wireAliveRow has moved or gone");
        ok(row.includes("handOff("), "the row buttons do not hand over");
        ok(!/dialog\.close\(\)/.test(row),
            "a row button still closes the window itself, so the close resolves the opener");

        const tail = bodyOf(panel, "const chosen = await tableDialog");
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
        const body = bodyOf(panel, "export async function applyAliveStates", { until: "\nasync function" });
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
        const window = bodyOf(panel, "async function openWhoIsAliveDialog", { until: "export async function applyAliveStates" });
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
        const mark = bodyOf(chapter, "export async function markDeceased", { until: "export async function killCharacter" });
        ok(/FLAGS\.deceased/.test(mark) && /toggleStatusEffect\("dead"/.test(mark),
            "markDeceased does not write the record and the token marker");
        for (const loud of ["whisperToGms", "tieChapterTraces", "offerStageSix", "bulletsOf"]) {
            ok(!mark.includes(loud), `markDeceased ${loud}s - it is meant to be the quiet half`);
        }

        const kill = bodyOf(chapter, "export async function killCharacter", { until: "export async function reviveCharacter" });
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

        const set = bodyOf(cub, "export async function setMonocub", { until: "export async function setSilenced" });
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
        const clockWin = bodyOf(panel, "export async function openClockDialog");
        const list = bodyOf(clockWin, "const stated", { until: "const result" });
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
        const field = bodyOf(season, 'name="chapter"', { length: 240 });
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
        const win = bodyOf(panel, "export async function openClockDialog");
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

    ["R70 - Enter in a field that names a button presses that button", async () => {
        /*
         * MM-02, 20.09. The Mastermind window's give-Hope row sits inside the
         * dialog's form and the footer starts with Apply, so Enter in the amount
         * pressed APPLY: the window saved the role and the lair, closed, and gave no
         * Hope at all. DialogV2 renders every footer button as a submit and implicit
         * submission takes the first one in tree order however `default` is set -
         * the trap this module has paid for twice already.
         */
        const sources = new Map(await otherSources());
        const utils = stripComments(sources.get("utils.mjs") ?? "");
        const guard = bodyOf(utils, "export function guardTextFields", { until: "export function registerTextGuard" });
        ok(guard.length > 200, "guardTextFields has moved or gone");
        ok(/data-drpg-enter/.test(guard), "nothing reads the marker, so Enter still submits");
        ok(/button\.focus\(\)[\s\S]{0,60}button\.click\(\)/.test(guard),
            "the button is clicked with the caret still in the field, so keepLive defers the "
            + "redraw and the donation looks as if it did nothing");
        ok(/if \(!button \|\| button\.disabled\) return;/.test(guard),
            "Enter presses a disabled button, which is a window's way of saying not now");
        ok(guard.indexOf("data-drpg-field") < guard.indexOf("data-drpg-enter"),
            "the field rule moved below the button rule - R44 reads the first one's position");

        const mm = stripComments(sources.get("mastermind.mjs") ?? "");
        const box = bodyOf(mm, "function mastermindHopeBox(", { until: "function wireMastermindGive(" });
        ok((box.match(/data-drpg-enter="\[data-drpg-give\]"/g) ?? []).length === 2,
            "both fields in the give-Hope row have to name the button - Enter in a select "
            + "submits exactly like Enter in a number");
        ok(/<button[^>]*type="button"[^>]*data-drpg-give/.test(box),
            "the give button is gone or stopped being type=button, so Enter has nothing to "
            + "press or it submits on its own");
        ok(/DRPG\.Monocub\.giveAtLeast/.test(mm),
            "an amount of zero is refused in silence, and the hint beside the stepper is "
            + "painted by one theme only");

        // NOT NARROWED TO THE WINDOW IT WAS FOUND IN. The Sound window's cue picker
        // is the same shape - a select and a button in one fieldset - where Enter was
        // merely dead rather than destructive.
        const music = stripComments(sources.get("music.mjs") ?? "");
        ok(/name="playTrack"[\s\S]{0,80}data-drpg-enter="\[data-drpg-play\]"/.test(music),
            "the cue picker's Enter still does nothing");
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
        const pane = bodyOf(music, "function soundPlayPane(", { length: 600 });
        ok(/function soundPlayPane\(\)\s*\{/.test(music) && /situationalPlaylist\(\)/.test(pane),
            "the cue pane is handed its playlist when the window opens, so the picker cannot see a "
            + "new track");
        ok(/html: soundPlayPane\(\)/.test(music),
            "the window is built from something other than the builder");
        const live = bodyOf(music, "keepLive(dialog, {", { length: 600 });
        ok(/region: "\.drpg-music-now"/.test(live), "the cue pane is not the live region");
        ok(/build: soundPlayPane\b/.test(live), "the live region is built by something else");
        ok(/after: \(\) => wireSoundPlay\(/.test(live),
            "the pane's buttons are not rewired after a redraw, so they stop answering");
        for (const hook of ["createPlaylistSound", "deletePlaylistSound", "createPlaylist"]) {
            ok(live.includes(hook), `the pane no longer wakes on ${hook}`);
        }
        ok(/settings: \[\]/.test(live),
            "the pane redraws on every module setting - an empty array is the filter that "
            + "says none of them");

        // The make-cue handler used to build a label and a select by hand and put
        // them in the DOM, because there was no rebuild to do it. There is now.
        const made = bodyOf(music, "data-drpg-make-cue");
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
        const body = bodyOf(tables, "export function classifyTableName", { until: "\nexport " });
        ok(/ITEM_TIERS\.includes\(tier\)/.test(body),
            "the tier is unbounded, so \"DRPG Tools - Tier 9\" would be recognised as a tier "
            + "nothing draws from");
        ok(/tableNameCandidates\(/.test(body),
            "the classifier does not ask the same machinery the lookups use, so the two can "
            + "disagree about what a table is called");
        ok(/category: "usable", goal/.test(body),
            "a goal can be paired with any category, which would make "
            + "\"DRPG Murder Weapons (Healing) - Tier 2\" a legal answer");

        /* WHERE 1.2.44 PUT IT. Main's Hygiene C split the item tables window into ten
           pieces, and the create path became `createPoolFrom`, defined ABOVE the call
           site. This slice used to run from the call site to the end of the file,
           which after the merge held the call and none of the function - so the test
           reported the fix gone beside a fix that had been carried over intact. */
        ok(/typeof action\.newPool === "string"\) \{\s*await createPoolFrom\(action\)/.test(tables),
            "the create button no longer reaches createPoolFrom");
        const create = bodyOf(tables, "async function createPoolFrom(", { until: "\n}\n" });
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
        const body = bodyOf(live, "export async function reopen", { until: "\nexport " });
        ok(/await app\.close\(\{ animate: false \}\)/.test(body),
            "reopen does not wait for the old copy to go, or it waits on a transition that "
            + "may never come");
        ok(body.indexOf("app.close(") < body.indexOf("opener()"),
            "reopen opens before it closes, which is the defect with an extra window");

        const tables = stripComments(sources.get("tables.mjs") ?? "");
        const tail = bodyOf(tables, "typeof action.newPool === \"string\"");
        equal((tail.match(/reopen\("drpg-window-tables"/g) ?? []).length, 3,
            "the three paths that warn and go straight back to the window do not all use "
            + "reopen");
        ok(!/^\s*return openItemTables\(\{ preset \}\);/m.test(tail),
            "one of those paths reopens directly again, so it opens nothing");
    }],

    ["R74 - a Season setup row hands over instead of answering", async () => {
        /*
         * SEASON-02, 20.09. A row button ran its step and then did
         * `await dialog.close(); openSeasonSetup();` - and that close resolves the
         * `DialogV2.wait` this window sits in, so `openSeasonSetup` returned and the
         * GM panel tile awaiting it opened the PANEL over the window as it came back.
         * Two windows for one press. And the copy that came back was built from the
         * world, so the campaign name, the chapter and the safeword the GM had typed
         * went with the reopen.
         *
         * A row that opens nothing offers nothing, too: "The cast exists" carried an
         * "Open" button and no `open`, so pressing it threw, was logged, and closed
         * and reopened the window for nothing.
         */
        const season = stripComments(new Map(await otherSources()).get("season-setup.mjs") ?? "");
        ok(/function readDraft\(/.test(season) && /function paintDraft\(/.test(season),
            "the window cannot carry what was typed across a reopen");
        ok(/openSeasonSetup\(\{ draft = null \} = \{\}\)/.test(season),
            "the opener cannot be handed a draft");
        ok(/paintDraft\(dialog\.element, draft\)/.test(season),
            "a carried draft is never painted back");

        const rows = bodyOf(season, "function wireSetupSteps(", { until: "export async function openSeasonSetup(" });
        ok(/handOff\(dialog, \(\) => openSeasonSetup\(\{ draft \}\)\)/.test(rows),
            "the row still closes and reopens on its own, so the close answers the caller");
        ok(!/await dialog\.close\(\)/.test(rows),
            "the row awaits the close itself, which is what resolves the opener early");
        ok(/step\.fixedKey \?\? "DRPG\.Season\.fixed"/.test(rows),
            "every fix row reports the same sentence, which counts characters");

        const builder = bodyOf(season, "function setupRows(", { until: "function readSeasonForm(" });
        ok(/!\(step\.fix \|\| step\.open\)/.test(builder),
            "a row with nothing to fix and nothing to open still offers a button");

        const opener = bodyOf(season, "export async function openSeasonSetup(");
        const tail = bodyOf(opener, "rejectClose: false");
        ok(/if \(roundTrip\) return roundTrip;/.test(tail),
            "the round trip is not returned, so the GM panel reopens itself over it");
    }],

    ["R75 - revoking a Despair pool is asked first, and the form survives it", async () => {
        /*
         * TEAM-01, 20.09. Remove pool destroyed the pool's Despair and its name with
         * nothing asked, from a four-button footer one place along from Save. And Add,
         * Revoke and Split evenly each reopened this window, which is built from the
         * world - so a pool renamed in the box above, a Monokuma ticked and an
         * overflow threshold nudged all went back to what they were.
         *
         * NOT `DialogV2.confirm` FOR THE QUESTION. It unshifts Yes first, and Enter
         * presses the first submit in DOM order whatever carries `default` - so the
         * keyboard answer to "shall I destroy this" would have been yes. This module
         * has paid for that trap twice.
         */
        const team = stripComments(new Map(await otherSources()).get("gm-team-dialog.mjs") ?? "");
        const ask = bodyOf(team, "async function confirmRemovePool", { until: "function gmTeamButtons(" });
        ok(ask.length > 200, "nothing asks before a pool is revoked");
        ok(!/DialogV2\.confirm\(/.test(ask),
            "the question is asked with DialogV2.confirm, whose Yes is the first submit");
        ok(ask.indexOf('action: "cancel"') < ask.indexOf('action: "remove"'),
            "the destructive answer is the first button, so Enter presses it");
        ok(/removePoolAsk/.test(ask) && /getDespair\(/.test(ask),
            "the question does not say how much Despair goes with the pool");

        const remove = bodyOf(team, 'result?.op === "remove"');
        ok(/confirmRemovePool\(/.test(remove), "the revoke path does not ask");
        ok(/extraPoolUserIds\(\)\.includes/.test(remove),
            "the id from a select built when the window opened is used without re-checking");
        ok(/poolGone/.test(remove), "a refused revoke says nothing at all");

        ok(/function readTeamDraft\(/.test(team) && /paintTeamDraft\(dialog\.element, draft\)/.test(team),
            "the window cannot carry what was typed across a reopen");
        equal((team.match(/draft: readTeamDraft\(/g) ?? []).length, 3,
            "the three buttons that act at once do not all bring the form back with them");
        ok(/openGmTeamDialog\(\{ draft: carried \}\)/.test(team),
            "the carried draft never reaches the copy that comes back");
    }],

    ["R76 - an incident whose cast is gone says so", async () => {
        /*
         * A lesson from this suite, 20.09. The incident state is a world setting and
         * the cast is two actor ids in it, so an actor deleted while an incident
         * stands open - a fixture from a run that died, a character removed between
         * sessions - leaves the world insisting a fight is running and the tracker
         * reading "? -> ?", with every control acting on a side that does not exist.
         *
         * The tracker cannot repair it: which actor was meant is not recoverable. It
         * names what is missing and points at the one button that helps.
         *
         * The other half of the lesson - tier 2 refusing to start while an incident is
         * open - is in the suite's own runner (tests.mjs), and is deliberately not read
         * from here: a test that reads the runner it is running inside proves nothing
         * about the run that is happening.
         */
        const murder = stripComments(new Map(await otherSources()).get("murder.mjs") ?? "");
        const body = bodyOf(murder, "function incidentTrackerHtml(", { until: "function incidentSignature(" });
        ok(body.length > 400, "the tracker's body builder has moved or gone");
        ok(/const lost = \[/.test(body), "nothing notices that the cast cannot be found");
        ok(/trackerCastGone/.test(body), "the missing cast is not reported to the GM");
        // `lastIndexOf`: the first `drpg-incident-live` in this builder is the
        // "this incident is over" branch above, which has no cast to report.
        ok(body.indexOf("const lost") < body.lastIndexOf("drpg-incident-live"),
            "the warning is worked out after the markup it belongs in");
        ok(/now\.selfInflicted \?[\s\S]{0,120}side\.killer/.test(body),
            "a self-inflicted death is reported as missing a killer, which it never had");
    }],

    ["R77 - every student stands on a frame, and yours is bone", async () => {
        /*
         * W-6 (Dawid, 18.09): a player's token is lost in a room - a bedroom holds a
         * bed, a desk, two Remnants and four students, all drawn at the same size out
         * of the same tileset, and the one token you may move looks like the three you
         * may not.
         *
         * It was a circle round the viewer's token alone. Dawid, 22.09, on 1.2.50:
         * the same frame on every player's token, and the viewer's own in drpg-bone -
         * and, asked, the square on the floor rather than the circle. So this holds the
         * three things that decision is made of: a SQUARE, on every player-owned
         * character, and bone for the one that is yours.
         */
        const sources = new Map(await otherSources());
        const own = stripComments(sources.get("own-ring.mjs") ?? "");
        ok(own.length > 500, "own-ring.mjs is gone, so nothing marks the students' tokens");
        ok(/drawRect\(/.test(own) && !/drawCircle\(/.test(own),
            "the student frame is not the token's square any more");
        const whose = bodyOf(own, "function frameOf", { until: "function hourColour" });
        ok(/hasPlayerOwner/.test(whose), "only the viewer's token is framed again, not every student's");
        ok(/type !== "character"/.test(whose), "a frame reaches tokens that are not characters");
        ok(/whose === "mine" \? cssColour\("--drpg-bone"/.test(own),
            "the viewer's own frame is not bone");

        const mine = bodyOf(own, "function isMine", { until: "function hourColour" });
        ok(/game\.user\?\.character/.test(mine),
            "the ring no longer prefers the character the viewer is playing");
        ok(/!game\.user\?\.isGM && actor\.isOwner/.test(mine),
            "a Gamemaster owns the whole cast, so ownership alone would ring every token "
            + "on their screen");

        ok(/data-drpg-time/.test(own),
            "the ring does not follow the hour, which is the colour it is drawn in");
        ok(/seamWidth\(\)/.test(own),
            "the glass ring is not the curtain's own hairline, so it fattens as you zoom");
        ok(/addChildAt\(new PIXI\.Container\(\), 0\)/.test(own),
            "the ring is not the token's bottom overlay any more");

        const module = stripComments(sources.get("module.mjs") ?? "");
        ok(/registerOwnRing/.test(module), "the ring is never registered");
        ok(module.indexOf("registerRemnantRings") < module.indexOf("registerOwnRing"),
            "the own-token ring registers before the Remnant rings");

        /*
         * AND THE FIVE HOURS ARE DECLARED FOR MONOKUMA LEGACY, because
         * `--drpg-glass-accent` is derived from the hour only under Stained Glass - on
         * a Legacy client it holds the afternoon gold all day. The glass rule has the
         * same specificity as the five, so it wins on SOURCE ORDER: that is read here
         * rather than trusted, because moving it up is a one-line edit that would pin
         * every Stained Glass ring to whatever the last hour rule said.
         */
        const css = (await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text()))
            .replace(/\/\*[\s\S]*?\*\//g, " ");
        for (const hour of ["morning", "noon", "afternoon", "evening", "night"]) {
            ok(css.includes(`body[data-drpg-time="${hour}"] { --drpg-own-ring:`),
                `Monokuma Legacy has no ring colour for the ${hour}`);
        }
        const glassRule = css.indexOf("body.drpg-theme-stained-glass { --drpg-own-ring:");
        const lastHour = css.indexOf('body[data-drpg-time="night"] { --drpg-own-ring:');
        ok(glassRule > lastHour,
            "the glass's own accent is overridden by the hour rules - it has to come after "
            + "them, since they have the same specificity");
    }],

    ["R78 - the clock names what THIS client is hearing", async () => {
        /*
         * N-1 (Dawid, 20.09): a scrolling band on the clock with the name of the
         * track that is playing.
         *
         * THE READING IS LOCAL, AND THAT IS THE ONLY PART THAT MATTERS FOR SAFETY.
         * Playback is driven by the primary GM through `playAll()`, a document
         * update, so in the ordinary case every client hears the same thing - but a
         * sound can be started on one client alone, and what a GM listens to while
         * they set a murder up must not have its name appear on a player's clock.
         * `sound.sound` is this browser's own audio node; `sound.playing` is the
         * document's opinion, and reading the second one is the defect.
         */
        const sources = new Map(await otherSources());
        const music = stripComments(sources.get("music.mjs") ?? "");
        const body = bodyOf(music, "export function nowPlayingHere", { until: "\n}" });
        ok(/sound\.sound\?\.playing/.test(body),
            "the reader asks the document what is playing instead of this browser");
        ok(!/playlist\.playing/.test(body),
            "the reader is back on the world's opinion, which is the leak");

        const hud = stripComments(sources.get("hud.mjs") ?? "");
        ok(/function paintTrackLine\(/.test(hud), "the clock has no band to paint");
        ok(/drpg-hud-track/.test(hud), "the band has no class, so the stylesheet cannot reach it");
        const wiring = bodyOf(hud, "export function registerHud", { length: 2000 });
        for (const hook of ["updatePlaylistSound", "deletePlaylistSound"]) {
            ok(wiring.includes(hook), `the band does not wake on ${hook}`);
        }
        ok(!/Hooks\.on\("updatePlaylistSound", \(\) => renderHud/.test(hud),
            "a track change rebuilds the whole clock, which slides the time of day for "
            + "something neither it nor the room block can see");

        const css = (await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text()))
            .replace(/\/\*[\s\S]*?\*\//g, " ");
        ok(/\.drpg-hud-track \{/.test(css), "the band has no rule of its own");
        ok(/drpg-reduced-motion .drpg-hud-track > span \{\s*animation: none/.test(css),
            "the band goes on scrolling under reduced motion");
    }],

    ["R79 - a Level Up may be handed over, and the writing stays the GM's", async () => {
        /*
         * N-2 (Dawid, 20.09). The GM chooses WHAT was earned; who picks the buff is a
         * second question, and the answer can be the player.
         *
         * THE APPLY DOES NOT MOVE. `applyAdvancement` writes through
         * `automatedUpdate`, which bypasses the resource guard by design, so a player
         * who could call it could raise their own maxima from the console. The player
         * PICKS; their picks go to the GM's client, which checks the offer again and
         * writes. Every assertion here is about that boundary.
         */
        const sources = new Map(await otherSources());
        const level = stripComments(sources.get("level-up.mjs") ?? "");

        ok(/export async function offerAdvancement\(/.test(level),
            "nothing can hand a Level Up to the player");
        const offer = bodyOf(level, "export async function offerAdvancement", { until: "export function pendingAdvance" });
        ok(offer.length > 200, "offerAdvancement has moved or gone");
        ok(/if \(!game\.user\.isGM\)/.test(offer), "anybody can offer themselves a Level Up");
        // Recorded by the primary GM, in its own store - see R98 for why not a flag.
        ok(/recordOffer\(actor\.id, kind\)|requestOfferRecord\(actor\.id, kind\)/.test(offer),
            "the offer is not recorded anywhere, so nothing can read it back");
        ok(/whisperToOwner\(/.test(offer) && !/announce\(/.test(offer),
            "the offer is announced to the table - which advancement somebody earned "
            + "also says how they voted");

        const picker = bodyOf(level, "export async function openAdvancement", { until: "function buildContent" });
        ok(/const offer = !game\.user\.isGM \? pendingAdvance\(actor\) : null;/.test(picker),
            "the picker decides whether a player may open it by something other than the offer");
        ok(/if \(asPlayer\) kind = offer\.kind;/.test(picker),
            "a player's own argument decides which kind they are picking, which is the "
            + "forgery this offer exists to prevent");
        ok(/requestAdvancement\(\{ actorId: actor\.id, picks: result, kind \}\)/.test(picker),
            "a player's picks are applied on their own client");

        const applied = bodyOf(level, "export async function applyAdvancement");
        ok(/if \(!game\.user\.isGM\)/.test(applied), "the apply is no longer the GM's alone");
        ok(/await withdrawOffer\(actor\.id\)/.test(applied),
            "the offer is not spent by being taken, so it can be taken twice");

        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const handler = bodyOf(bridge, "async function handleAdvancement(", { until: "async function handleShareBulletOrGiveItem(" });
        ok(handler.length > 300, "the GM side of the handover is gone");
        // The declaration, since E31 (25.09.2026): its run is the handler read above, and
        // ownership is its guard - the runner asks it before the run.
        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const apply = BRIDGE_ACTIONS["advancement.apply"];
        ok(apply?.run?.name === "handleAdvancement",
            "the handover's run is not in BRIDGE_ACTIONS, so the GM never hears the picks");
        ok((apply?.guards ?? []).some(guard => guard.factory === "owns" && guard.covers?.includes("actorId")),
            "the packet's character is taken on trust");
        ok(/pendingAdvance\(actor\)/.test(handler),
            "the GM applies a Level Up nobody offered");
        ok(/applyAdvancement\(actor, picks, offer\.kind\)/.test(handler),
            "the kind comes off the packet rather than off the offer");
        ok(/picks\.length !== wanted/.test(handler),
            "three picks can be claimed for a standard Level Up");
        ok(/LEVEL_UP_OPTIONS\[p\?\.option\]/.test(handler),
            "a pick may name something that is not an option");

        const sheet = stripComments(sources.get("sheet.mjs") ?? "");
        const button = bodyOf(sheet, "function injectAdvanceButton", { until: "function injectItemButton" });
        ok(/if \(!game\.user\.isGM && !offer\) return;/.test(button),
            "the button is on every player's sheet whether or not anything was offered");
        ok(/is-offered/.test(button), "nothing lights the button up, so nobody notices it");
    }],

    ["R80 - an empty request is refused before the window starts closing", async () => {
        /*
         * CALL-12, 20.09. The empty note box was refused by returning `null` from the
         * button's callback, which is not a refusal:
         * `(await button?.callback?.(...)) ?? button?.action` reads null as the
         * button's own name, and the window closes whatever the callback returned. So
         * the player was warned, the window shut, and the GM received an approval
         * request whose entire body was the word "spend" - on the one pair of Calls
         * where the sentence IS the request.
         *
         * THE THREE STOPS ARE THE TEST. A capture listener on the button is what runs
         * before ApplicationV2's delegated click and before DialogV2's own submit
         * listener; without `preventDefault` the submit button still submits, and
         * without both propagation stops the delegated handler still fires.
         */
        const calls = stripComments(new Map(await otherSources()).get("calls.mjs") ?? "");
        const gate = bodyOf(calls, "function wireNoteGate", { until: "export async function confirmCall" });
        ok(gate.length > 200, "nothing refuses an empty note before the submit starts");
        ok(/\{ capture: true \}/.test(gate),
            "the refusal listens in the bubble phase, where the window is already closing");
        for (const stop of ["preventDefault()", "stopPropagation()", "stopImmediatePropagation()"]) {
            ok(gate.includes(stop), `the refusal does not call ${stop}`);
        }

        const confirm = bodyOf(calls, "export async function confirmCall", { until: "export async function askHopeCallApproval" });
        ok(/render: \(event, dialog\) => wireNoteGate\(dialog, call\)/.test(confirm),
            "the gate is never wired to the window");
        ok(!/return null;\s*\}\s*return written;/.test(confirm),
            "the callback still tries to cancel by returning null");
        ok(/if \(call\.needsGm && !String\(result\)\.trim\(\)\) return null;/.test(confirm),
            "an empty note can still reach the GM as an empty request - the gate lives in "
            + "the interface, and the boundary has to ask again");
    }],

    ["R81 - one purchase posts one card, after the effect", async () => {
        /*
         * CALL-13, 20.09. `spendDespairCall` charged the pool and posted a public card
         * one line later, BEFORE `applyCall` had run - and the road through
         * `spendDespairCallFor` posts its own card afterwards with the same label. So
         * every Despair Call bought from a sheet posted two, the first before anybody
         * knew whether it had landed: on a failure the pool is handed back and the
         * Monokuma warned privately, and the table kept a public receipt for a
         * purchase that did not happen.
         *
         * THE ORDER ASSERTIONS BELOW ALREADY PASSED ON THE DEFECT and are kept as
         * guards, not as evidence. What fails on it is the flag: the parameter, the
         * gate around the card, the `false` at the call site, and the price sentence
         * arriving on the card that survives.
         */
        const sources = new Map(await otherSources());
        const despair = stripComments(sources.get("despair.mjs") ?? "");
        const spend = bodyOf(despair, "export async function spendDespairCall", { until: "export function renderDespairBar" });
        ok(spend.length > 300, "spendDespairCall has moved or gone");
        ok(/\{ announce: post = true \} = \{\}/.test(spend),
            "the card cannot be turned off, so the road that posts its own posts two");
        ok(/if \(!post\) return true;/.test(spend),
            "the flag is read somewhere other than in front of the card");
        ok(spend.indexOf("adjustDespair(userId, -call.cost)") < spend.indexOf("if (!post)"),
            "the pool is charged after the card, so a failed card would keep the Despair");

        const calls = stripComments(sources.get("calls.mjs") ?? "");
        const road = bodyOf(calls, "export async function spendDespairCallFor", { until: "export async function confirmCall" });
        ok(/spendDespairCall\(user\.id, key, \{ announce: false \}\)/.test(road),
            "the sheet's road still lets the purchase announce itself");
        ok(/DRPG\.Despair\.spent/.test(road),
            "the price is not on the card that survives, so nobody is told what it cost");
        ok(road.indexOf("applyCall(") < road.indexOf("announce({"),
            "the card is posted before the effect has run");
        ok(road.indexOf("DRPG.Calls.refunded") < road.indexOf("announce({"),
            "the refund branch is below the card, so a failure still posts a receipt");
    }],

    ["R82 - what shuts the whole Calls menu is asked at the door", async () => {
        /*
         * CALL-17, 20.09. An Eclipse, the overflow's Silence, a Class Trial for a
         * Monokuma and a dead student were all asked INSIDE the two spenders, which
         * the sheet reaches after the target picker and the confirmation. So a player
         * chose a victim, read a price, pressed Spend, and only then learned the menu
         * had been shut all along: three windows to be told no.
         *
         * ASKED TWICE ON PURPOSE. The sheet is one road in and `game.drpg` is
         * another, and the world can move between the question and the purchase - so
         * the spenders go on asking. What this test pins is that the sheet asks
         * BEFORE the picker, which is the half that was missing.
         */
        const sources = new Map(await otherSources());
        const calls = stripComments(sources.get("calls.mjs") ?? "");
        const barred = bodyOf(calls, "export async function callBarred", { until: "async function hopeCallBarred" });
        ok(barred.length > 200, "there is no one reader for what shuts a Call");
        ok(/isEclipse\(\)/.test(barred) && /overflowBlocksCalls\(\)/.test(barred),
            "the shared reader does not know about the Eclipse or the overflow's Silence");
        ok(/if \(despair\)[\s\S]{0,200}classTrial/.test(barred),
            "the Class Trial rule is not the despair side's alone - that asymmetry is T-1's "
            + "decision");
        ok(/isDeceased\(actor\)/.test(barred), "the dead can still spend");

        const sheet = stripComments(sources.get("sheet.mjs") ?? "");
        // To the next top-level function, not a fixed number of characters: the
        // confirmation is a hundred lines down and a 3000-character window stopped
        // short of it, so the order assertions below compared against -1.
        const run = bodyOf(sheet, "async function runCall", { until: "function roomBlockFor" });
        ok(/const barred = await callBarred\(actor, \{ despair \}\);/.test(run),
            "the sheet does not ask before it starts asking the player questions");
        ok(run.indexOf("callBarred(actor") < run.indexOf("confirmCall("),
            "the menu is asked after the confirmation, which is where it was");
        ok(run.indexOf("callBarred(actor") < run.indexOf("monokumaPool(actor"),
            "the price is read before the question that can make it irrelevant");
    }],

    ["R83 - a deferred assembly remembers its scene, and is not cleared until it can be held", async () => {
        /*
         * CALL-18, 20.09. `runPendingGather` cleared the order first - deliberately,
         * so a throw could not fire it twice - and then called `gatherEveryone`, which
         * looked the room up on `canvas.scene`: the CURRENT map of whichever GM is
         * primary when the order ripens. That is not necessarily the GM who called it.
         * When the region was not found the call warned, returned 0, and the order was
         * already gone: six Despair for an assembly that never happened, and there is
         * no repair anywhere in the module - `gatherEveryone` is not on `game.drpg`.
         */
        const effects = stripComments(new Map(await otherSources()).get("call-effects.mjs") ?? "");

        const schedule = bodyOf(effects, "export async function scheduleGather", { until: "export async function runPendingGather" });
        ok(/sceneId: scene\.id/.test(schedule),
            "the order does not remember which scene its room is on");

        const run = bodyOf(effects, "export async function runPendingGather", { until: "export async function gatherEveryone" });
        ok(/game\.scenes\.get\(order\.sceneId\)/.test(run),
            "the order is carried out on whichever scene this GM is looking at");
        // `lastIndexOf`: the refusal branch does its own clear, and the one that
        // matters here is the last - the clear standing in front of the work.
        ok(run.indexOf("if (!region)") < run.lastIndexOf("writeGather(null)"),
            "the order is cleared before anybody has checked that it can be held");
        ok(/gatherRoomGone/.test(run),
            "a room that has gone is cleared in silence, so the GM never learns why nothing "
            + "happened");
        ok(/gatherEveryone\(order\.room, scene\)/.test(run),
            "the scene is worked out and then not passed on");

        const gather = bodyOf(effects, "export async function gatherEveryone");
        ok(/gatherEveryone\(room, onScene = null\)/.test(gather),
            "the scene cannot be handed to it, so a deferred assembly has no way to say where");
        ok(/\[\.\.\.scene\.tokens\]/.test(gather),
            "the cast is read off the canvas, which only holds the scene somebody is looking at");
        ok(!/canvas\.tokens\.placeables/.test(gather),
            "the canvas reading is back");
    }],

    ["R84 - a request that never went is not reported as sent, and a tile states the rule", async () => {
        /*
         * ACT-15 and ACT-16, 20.09.
         *
         * ACT-15: `promptAndCallGm` opens a SECOND window - the sentence that goes to
         * the GM - and a player who backs out of it has proposed nothing. The caller
         * whispered "your proposal has been sent" anyway, and the GM had no card. The
         * fix is in the helper rather than at the call site, because there are two
         * roads to "nothing went" and callers could only see one: `callGm` answers
         * false without throwing when no GM is connected.
         *
         * ACT-16: the Misleading trail tile said 18 and the threshold has been 15
         * since D7, measured in E18c. It also said a trace is planted "either way",
         * which is true of a miss with Hope and not of a miss with Despair.
         */
        const sources = new Map(await otherSources());
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const prompt = bodyOf(bridge, "export async function promptAndCallGm");
        ok(/const sent = await callGm\(/.test(prompt),
            "promptAndCallGm throws away what callGm answered");
        ok(/return sent === false \? null : text;/.test(prompt),
            "a request nobody was there to take is still reported as sent");

        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        // The 400 characters before the proposal's title and everything from it to the "sent" line.
        const proposal = bodyOf(rolls, "DRPG.Project.proposalTitle", { back: 400 })
            + bodyOf(rolls, "DRPG.Project.proposalTitle", { until: "DRPG.Project.proposalSent" });
        ok(/const sent = await promptAndCallGm\(/.test(proposal),
            "the proposal does not read the answer");
        ok(/if \(sent === null\) return null;/.test(proposal),
            "a cancelled proposal still whispers that it was sent - and `!sent` would be "
            + "wrong, because an empty string is a proposal with no sentence on it");

        ok(/n: CLEANUP\.actions\.misleadingTrail\.threshold/.test(rolls),
            "the Misleading trail tile states a number of its own instead of the rule's");
        const hint = game.i18n.localize("DRPG.Tamper.frameHint");
        ok(!/18/.test(hint), `the hint still says 18: "${hint}"`);
        ok(!/either way/i.test(hint),
            "the hint still promises a trace either way - a miss with Despair leaves none");
        ok(hint.includes("{n}"), "the hint no longer takes the threshold");
    }],

    ["R85 - a Call still applies when the roll window is unlocked", async () => {
        /*
         * CALL-11, 20.09. With `lockRollDialog` off, `onRenderApplication` imposed
         * Breakdown and returned: so an advantage a Monokuma or a player had PAID for
         * was armed, spent, and then did nothing. The dice had to be clicked by hand,
         * and the Experience chips went on charging Hope for something already bought.
         *
         * "Let the players drive their own roll window" is a decision about the
         * interface. It cannot also mean "a purchase stops applying".
         *
         * BOTH CHIPS, and that is the assertion that matters: locking only the
         * matching pair leaves the opposite one live, and one click on it makes
         * Daggerheart cancel the modifier the Call just bought - the same defect with
         * an extra step.
         */
        const dialog = stripComments(new Map(await otherSources()).get("roll-dialog.mjs") ?? "");
        const open = bodyOf(dialog, "function onRenderApplication", { until: "function forceReaction" });
        ok(open.length > 400, "the render hook has moved or gone");
        ok(/advantageSources\(actor\)/.test(open),
            "the unlocked road reads Breakdown alone again, so a bought die is lost");
        ok(!/const fromState = stateGrant\(actor\);/.test(open),
            "the state-only reader is back");
        ok(/\[\.\.\.adv, \.\.\.dis\]/.test(open),
            "only one pair of chips is locked, so the other one can cancel the purchase");
        ok(/stripExperienceCosts\(app\)/.test(open) && /hideCostSection\(root\)/.test(open),
            "an experience a Call paid for is charged again when the lock is off");
        ok(open.indexOf("locking()") < open.indexOf("advantageSources(actor)"),
            "the unlocked branch now runs for everybody, including the locked road");
    }],

    ["R86 - a Monocub may cross a room, and that is the list", async () => {
        /*
         * ACT-13, 20.09. The dead gate lets a Monocub through - correctly, a Monocub
         * acts - and that was the whole of it: past that line every tile in the module
         * was dispatchable by one, and `performAction` is reachable from an evidence
         * row's Analyze button and from `game.drpg` with no sheet at all.
         *
         * ABOVE THE `directMurder` BRANCHES, and that is what this test is really
         * about: a betrayal is reached BEFORE the Eclipse rule, so a gate placed with
         * the dead test further down would have left the loudest action in the game
         * open to a Monocub. The order here is the fix.
         */
        const sources = new Map(await otherSources());
        const cfg = stripComments(sources.get("config.mjs") ?? "");
        ok(/dispatchable: \["move"\]/.test(cfg),
            "the list of what a Monocub may dispatch is gone, or it has grown");

        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        const perform = bodyOf(rolls, "export async function performAction", { until: "async function performBetrayal" });
        ok(/MONOCUB\.dispatchable\.includes\(actionKey\)/.test(perform),
            "nothing refuses a Monocub the rest of the grid");
        const gate = perform.indexOf("MONOCUB.dispatchable");
        ok(gate > 0 && gate < perform.indexOf("betrayalTarget(actor)"),
            "the Monocub gate sits below the betrayal, which is reached before the Eclipse "
            + "rule - so the loudest action in the game walks straight past it");
        // And deliberately below the in-fight shortcut: a fight is its own economy
        // with its own entry point, and this gate is not the thing that answers it.
        ok(gate > perform.indexOf("inFight && actionKey"),
            "the gate moved above the in-fight branch, where it answers a question nobody "
            + "asked it");
        ok(perform.indexOf("MONOCUB.dispatchable") < perform.indexOf("isDeceased(actor) && !isMonocub"),
            "the gate is below the dead test, which is where it could not do its job");
        ok(!/dispatchable\.includes\("meddle"\)/.test(rolls),
            "Confusion was added to a list of ACTIONS keys, and it is not one");
    }],

    ["R87 - a trace of unstated origin is not a free Analyze", async () => {
        /*
         * ACT-10, 20.09. `ANALYZE_DC` has no neutral column, so `analyzeDc` fell
         * through to `null` for a bullet whose REAL type is itself neutral - a red
         * herring, or a GM who never picked a category - and `null` is read one line
         * later as the guide's "Bez rzutu". Every such bullet identified itself on any
         * roll at all and closed for ever: the action was spent, the evidence was
         * shut, and nothing was learned.
         *
         * The note that said this file wants no alias table was half right: it is the
         * DISPLAYED type that is normally neutral, and this lookup takes the real one.
         * The case it missed is the real one being neutral too. `OBSERVE_TYPE_ALIAS`
         * is the module's existing answer - "a trace of unstated origin is priced like
         * the ordinary evidence it stands in for" - so no second number is invented.
         */
        const cfg = stripComments(new Map(await otherSources()).get("config.mjs") ?? "");
        const fn = bodyOf(cfg, "export function analyzeDc", { length: 300 });
        // ANALYZE_TYPE_ALIAS since 21.09: Observe's aliases spread, plus autopsy.
        ok(/(?:OBSERVE|ANALYZE)_TYPE_ALIAS\[realType\] \?\? realType/.test(fn),
            "Analyze still has no answer for a trace whose real type is neutral");

        const analyze = stripComments(new Map(await otherSources()).get("analyze.mjs") ?? "");
        // Asked of every kind's own `analysedHint` since 21.09, neutral's included.
        ok(/TRUTH_BULLET_TYPES\[realType\]\?\.analysedHint/.test(analyze),
            "the card announcing an analysis still prints the un-analysed sentence - "
            + "\"analysis turns it into a real category\" - about an analysis that did not");
    }],

    ["R88 - a refusal hands back what was paid, and an Observe miss is not a refusal", async () => {
        /*
         * ACT-14 and ACT-17, 20.09.
         *
         * ACT-14: the refund reads `data.paid` off the card, and two of the three
         * cards carrying that button were hand-written with `{ by, cost }` and no
         * receipt - so every refusal of a Search or an Observe fell into the legacy
         * branch and handed back ONE ACTION, whatever had really been spent. A Burst
         * came back as an ordinary action. `"none"` is what a free action writes now,
         * because an empty string was indistinguishable from an absent attribute, and
         * `options.free` reaches that builder from two places.
         *
         * ACT-17: "nothing was there" is an Observe's RESULT. The scored road charges
         * the Sanity its own briefing prints before the roll; the GM-ruled road sent
         * the generic refusal, which refunded the action and charged nothing - so
         * asking a human was the cheaper way to look.
         */
        const sources = new Map(await otherSources());
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");

        const builder = bodyOf(rolls, "function declineAction", { until: "function missAction" });
        ok(builder.length > 200, "the refusal button is hand-written again");
        ok(/paid: receipt \? \(receipt\.pay \?\? "action"\) : "none"/.test(builder),
            "a free action's card is indistinguishable from a card with no receipt");
        ok(/amount: String\(receipt\?\.amount \?\? 0\)/.test(builder),
            "the card does not say how much was paid, so two actions come back as one");

        // No hand-written refusal anywhere else: the builder is the only one.
        const outside = rolls.replace(builder, "");
        ok(!/action: "decline"/.test(outside),
            "a card still writes its own refusal button, which is how two of them lost "
            + "their receipts");
        ok(/missAction\(actor\)/.test(rolls), "the Observe card still sends a refusal");

        const observe = stripComments(sources.get("observe.mjs") ?? "");
        ok(/export async function chargeObserveMiss\(/.test(observe),
            "there is no single writer of an Observe miss");
        ok(/bulletId: null,(?: projectId: null,)? stress: marked/.test(observe),
            "the miss bookmarks the figure the rule asks for rather than the marks it made");
        ok(!/bulletId: null,(?: projectId: null,)? stress: OBSERVE_FAIL_STRESS/.test(observe),
            "a character already at their maximum takes no mark, and an undo that trusts "
            + "the constant hands back Sanity nobody spent");

        const app = stripComments(sources.get("messenger-app.mjs") ?? "");
        const miss = bodyOf(app, "async function ruleObserveMiss(", { until: "function refundOnCard(" });
        ok(miss.length > 200, "the GM's \"nothing was there\" has no handler of its own");
        ok(/observeMiss: ruleObserveMiss,/.test(app), "the miss is not in CARD_ACTIONS");
        ok(/chargeObserveMiss\(actor\)/.test(miss), "the miss charges nothing");
        ok(!/refundAction/.test(miss),
            "the miss refunds the action - the character looked, on either road");
        ok(!/DRPG\.Bridge\.declined|settledDeclined/.test(miss),
            "the miss tells the player their action is back, beside the Sanity it just took");
        ok(/data\.paid === "none"/.test(app),
            "a card for a free action still refunds an action that was never spent");
    }],

    ["R89 - an Observe declaration outlives the browser that made it", async () => {
        /*
         * ACT-08, 20.09. The two halves of an Observe are minutes apart - the GM
         * fixes the target, the player rolls, the answer comes back - and the
         * declaration lived in one browser's memory. A GM who reloaded in between
         * came back to an empty Map, and `resolveObserve` returned null: the player
         * had already paid the action and thrown the dice, and got no Truth Bullet,
         * no Sanity, no card and nothing said on either screen.
         *
         * CLIENT-SCOPED, and that is not negotiable: every entry holds the Remnant's
         * real type and its difficulty, which is the answer being bought, and a world
         * setting reaches every client.
         *
         * WHAT IT STILL DOES NOT DO is reach a second GM - the primary can change
         * between the two halves - and the road that cannot answer now says so on
         * both screens instead of returning null in silence.
         */
        const sources = new Map(await otherSources());
        const settings = stripComments(sources.get("settings.mjs") ?? "");
        ok(/observePending: "observePending"/.test(settings), "the store has no setting");
        const reg = bodyOf(settings, "SETTINGS.observePending", { length: 400 });
        ok(/scope: "client"/.test(reg),
            "the pending Observes are world-scoped, so every player can read the answer key");

        const observe = stripComments(sources.get("observe.mjs") ?? "");
        ok(/function readPending\(/.test(observe) && /async function writePending\(/.test(observe),
            "the Map is not written through to anything");
        // Every mutation of the Map goes through the writer: the mint, the two
        // results, the undo, the sweep and the console's repair tool.
        ok((observe.match(/await writePending\(\)/g) ?? []).length >= 5,
            "some mutation of the store is not written through, which is the half-fix "
            + "that keeps a Reroll broken");

        const resolve = bodyOf(observe, "export async function resolveObserve", { until: "async function undoPrevious" });
        ok(resolve.indexOf("readPending()") < resolve.indexOf("sweepPending()"),
            "the sweep runs over an unloaded cache, and then writes that nothing back");
        ok(/resolveLost/.test(resolve) && /resolveLostOwner/.test(resolve),
            "a resolve with no record is still silent on one screen or both");
        ok(!/refundAction/.test(resolve),
            "the lost road refunds an action on a socket payload's word, which is ACT-12 "
            + "with the names changed");

        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        ok(/actorId: payload\.actorId/.test(bridge),
            "the resolve packet's actor never reaches the resolver, so a lost record "
            + "cannot name who is waiting");
    }],

    ["R90 - a region that redraws itself comes back dressed", async () => {
        /*
         * LAT-14, 20.09, and it is one line for every live region rather than one
         * window's bug. chrome.mjs decorates a window at render - the select glyphs,
         * the numeric column alignment, the table rules - and has listened for
         * `drpgWindowUpdated` since it was written, under a comment explaining that a
         * window redrawing part of itself keeps its decorations because the pass is
         * idempotent. NOTHING HAS EVER FIRED THAT HOOK: one listener, zero callers.
         *
         * So the case dashboard came back undressed after a filter change, and so did
         * the trial console on every tick and the Players table after a death.
         */
        const sources = new Map(await otherSources());
        const live = stripComments(sources.get("live.mjs") ?? "");
        const rebuild = bodyOf(live, "const rebuild = (force = false)", { until: "const schedule =" });
        ok(rebuild.length > 200, "keepLive's rebuild has moved or gone");
        ok(/Hooks\.callAll\("drpgWindowUpdated", next\)/.test(rebuild),
            "a rebuilt region is never announced, so nothing can dress it");
        ok(rebuild.indexOf("if (after) after(next)") < rebuild.indexOf("drpgWindowUpdated"),
            "the region is dressed before it has wired its own controls");

        const chrome = stripComments(sources.get("chrome.mjs") ?? "");
        ok(/Hooks\.on\("drpgWindowUpdated"/.test(chrome),
            "the listener this hook exists for is gone, so firing it decorates nothing");
    }],

    ["R91 - the GM can state that a trace exists", async () => {
        /*
         * N-4, Dawid 21.09. There was no general "put a trace here" control at all:
         * every road onto the map placed a KEY Remnant (the planner's per-row button,
         * the Observe ruling card) or a trace an action had earned (`dropRemnant`,
         * the Final Remnant). A GM who simply wanted a Prep trace in the kitchen had
         * to build a token and flag it by hand.
         *
         * THE TWO FLAGS ARE THE TEST. A Key Remnant is tied to the crime and
         * reinforced because that is what a Key Remnant IS; a hand-placed trace can
         * be either, and those two booleans decide whether the chapter-end sweep
         * takes it and whether a killer can clean it up. A window that assumed them
         * would quietly make every hand-placed trace unsweepable and uncleanable.
         */
        const sources = new Map(await otherSources());
        const inv = stripComments(sources.get("investigation.mjs") ?? "");
        const body = bodyOf(inv, "export async function openNewTrace", { until: "export" });
        ok(body.length > 400, "openNewTrace has moved or been hollowed out");

        ok(/if \(!game\.user\.isGM\)/.test(body.slice(0, 400)),
            "a player reaching openNewTrace is not turned away at the door");
        ok(/Object\.entries\(REMNANT_TYPES\)/.test(body),
            "the kind list is written out rather than read from REMNANT_TYPES, so a "
            + "new kind will be missing from the one window that can place any of them");
        ok(/name="tied"/.test(body) && /name="reinforced"/.test(body),
            "the window does not ask for the two flags");
        ok(/tiedToCrime: result\.tied/.test(body) && /reinforced: result\.reinforced/.test(body),
            "the flags are asked for and then not carried, so every hand-placed trace "
            + "is an ordinary one whatever the GM ticked");
        ok(/if \(!REMNANT_TYPES\[result\.type\]\)/.test(body),
            "the kind comes back off a form and is written without being checked");
        ok(/observeDc\(v, key\) !== null/.test(body) && /observeDc\(result\.visibility, result\.type\) === null/.test(body),
            "a kind Observe has no number for can be placed, and then nobody can ever find it");
        ok(/placeRemnant\(/.test(body),
            "the trace is built by hand instead of through the one writer that owns "
            + "the flags, the art and the name");
        /* MEASURED, 21.09: the first cut passed `name` and `text` to `placeRemnant`,
           which has neither parameter and dropped both without a word. The window
           looked right and produced a trace the finder would read as "Trace" with no
           description. The public pair is a SECOND write, and every other road that
           offers those words makes it. */
        ok(/setRemnantPublic\(token, \{/.test(body),
            "the name and the description the GM typed never reach the player's record");
        ok(/playerText: result\.text/.test(body),
            "the description is written under the wrong key, so the bullet is blank");

        /* The door. A window nothing opens is a window nobody has. */
        const dash = bodyOf(inv, "export async function openInvestigationDashboard");
        ok(/action: "newTrace"/.test(dash), "the dashboard has no button for it");
        const door = bodyOf(inv, "async function runDashboardButton(", { until: "export async function openInvestigationDashboard" });
        ok(/if \(action === "newTrace"\)/.test(door), "the button leads nowhere");

        const api = stripComments(sources.get("api.mjs") ?? "");
        ok(/newTrace: openNewTrace/.test(api), "it is not on game.drpg, so a macro cannot reach it");

        /* A localise() that misses prints its own key at the table - and it prints it
           truthy, so only comparing against the key itself catches it. */
        for (const key of ["newTraceTitle", "newTraceIntro", "traceType", "newTraceTied",
            "newTraceReinforced", "newTraceNote", "newTraceBadType", "newTraceDone", "noRooms"]) {
            const path = `DRPG.Investigation.${key}`;
            ok(game.i18n.localize(path) !== path, `${path} is missing from lang/en.json`);
        }
    }],

    ["R92 - a reshaped trace waits for a ruling", async () => {
        /*
         * N-3, Dawid 21.09. A Tamper that succeeded wrote the player's name and
         * the player's sentence onto the GM's own evidence the moment the dice
         * landed. The packet was bounded - `plainText` caps both halves, the
         * visibility list is checked - but BOUNDING IS NOT RULING, and the next
         * person through the door read those words as the truth of the room.
         *
         * Starting a project is the precedent Dawid named: the form becomes a
         * card, and nothing exists in the world until the GM presses a button.
         *
         * TWO ROADS WRITE THOSE WORDS, which is the half a reader misses: the
         * Tamper action, and the erase road's critical reward. A rule with a door
         * next to it is not a rule, so the test counts the callers rather than
         * checking the branch it was written for.
         */
        const sources = new Map(await otherSources());
        const src = stripComments(sources.get("cleanup.mjs") ?? "");

        const callers = [...src.matchAll(/await reshapeTrace\(/g)].length;
        ok(callers === 1,
            `reshapeTrace is awaited ${callers} times - it must be reachable only `
            + "through the approval, or there is a road that writes without a ruling");
        const ruling = bodyOf(src, "export async function applyReshapeRuling", { until: "export async function declineReshapeRuling" });
        ok(ruling.length > 300, "applyReshapeRuling has gone or moved below the decline");
        ok(/await reshapeTrace\(/.test(ruling),
            "the one write left is not the one behind the GM's button");

        /* Both roads ask. */
        const transform = bodyOf(src, "async function resolveTransformRoad(", { until: "const back = CLEANUP.transformAction?.refundStress" });
        ok(/await proposeReshape\(/.test(transform),
            "the Tamper action still applies the lie itself");
        const critical = bodyOf(src, "if (rewrite) {", { until: "} else if (outcome.removes" });
        ok(/await proposeReshape\(/.test(critical),
            "a critical clean-up still applies the lie itself");

        /* The ruling reads the world as it stands, not as the card remembers it. */
        ok(/findRemnantToken\(tokenId\)/.test(ruling),
            "the ruling trusts the card for the trace instead of looking it up, so a "
            + "trace swept between the roll and the button is relabelled in absentia");
        ok(/if \(data\.reinforced\)/.test(ruling),
            "a GM who reinforced the trace after the roll is still offered a button "
            + "that edits it");
        ok(/plainText\(name,/.test(ruling) && /plainText\(text,/.test(ruling),
            "the words come off a dataset and are written without being bounded again");
        ok(/if \(!game\.user\.isGM\) return null/.test(ruling),
            "the approval is not GM-gated on the client that runs it");

        /* A decline is a ruling, not a refund - the whole point of where this sits. */
        const decline = bodyOf(src, "export async function declineReshapeRuling");
        ok(!/refundPrice|handBack|automatedUpdate/.test(decline.slice(0, 900)),
            "declining hands the price back, which turns every ruling into a free retry");

        /* And the GM's card reaches both. */
        const app = stripComments(sources.get("messenger-app.mjs") ?? "");
        ok(/approveReshape: ruleApproveReshape,/.test(app)
            && /declineReshape: ruleDeclineReshape,/.test(app),
            "the card's buttons lead nowhere");
        for (const key of ["reshapeRulingTitle", "reshapeApprove", "reshapeDecline",
            "reshapeWaiting", "reshapeDeclined", "reshapeRulingGone"]) {
            const path = `DRPG.Cleanup.${key}`;
            ok(game.i18n.localize(path) !== path, `${path} is missing from lang/en.json`);
        }
    }],

    ["R105 - a proposed murder is the proposer's, whoever else is ticked", async () => {
        /*
         * Dawid, 21.09, the stage D question on killer precedence: "the proposer".
         * The viewer list (P-1, 18.09) made its first tick the killer, so ticking an
         * accomplice onto a player's own proposal handed the trap to the accomplice.
         * The tick is only the answer when there is no proposer to read.
         */
        const { killerIdFor } = await import("./projects-ui.mjs");
        ok(typeof killerIdFor === "function", "killerIdFor is not exported for the suite any more");
        const players = game.users.filter(u => !u.isGM);
        const owned = user => game.actors.find(a => a.type === "character" && a.testUserPermission(user, "OWNER"));
        needs(world.atLeast("playersWithCharacter"), "a ticked viewer has to stand for somebody's character");
        const viewer = players.find(u => owned(u));
        // Two living students, so the proposer and the viewer's character can differ (cast skips on fewer).
        const proposer = cast(2).find(a => a.id !== owned(viewer).id);

        equal(killerIdFor(viewer.id, proposer.id), proposer.id,
            "a ticked viewer took the proposer's murder off them");
        equal(killerIdFor(viewer.id, null), owned(viewer).id,
            "with no proposal, the first ticked player's character is not the killer");
        equal(killerIdFor(null, proposer.id), proposer.id, "the proposer is not the killer when nobody is ticked");
        equal(killerIdFor(null, null), null, "a killer was invented from nothing");

        /* And the audience still takes both - the builder and the tick (F3). */
        const projects = stripComments(new Map(await otherSources()).get("projects.mjs") ?? "");
        ok(/new Set\(\[\.\.\.viewers, \.\.\.ownerIdsOfId\(killerId \?\? by\)\]\)/.test(projects),
            "a sealed project no longer keeps both the killer and the ticked players in");
    }],

    ["R104 - a Key and a Final are written with their reading, like any trace", async () => {
        /*
         * Dawid, 21.09: every trace has a description and a description after
         * Analyze. The Key planner, its "create here" card, the Final form and New
         * trace each wrote the first and had no box for the second, so the only
         * road to a Key's reading was the Traces tab - and a reading typed there
         * reached its finder at pickup, with nothing bought. The runtime half is the
         * scenario "a Key and a Final keep their reading for an Analyze"; this holds
         * the roads that write it, and the two that decide it is already read.
         */
        const sources = new Map(await otherSources());
        const inv = stripComments(sources.get("investigation.mjs") ?? "");
        ok(/name="keyanalysis:\$\{i\}"/.test(inv), "the Key planner has no box for a clue's reading");
        ok(/analysis: q\(`keyanalysis:\$\{i\}`\)/.test(inv), "the planner draws the box and never reads it back");
        ok(/patch\.analyzedText = row\.analysis/.test(inv),
            "a reading typed on a placed Key row never reaches the trace");
        ok(/analyzedText: row\.analysis/.test(inv), "a planned Key Remnant is placed without its reading");
        ok(/analysis: row\.analysis \?\? ""/.test(inv), "the stored plan drops the reading on every save");
        ok(/name="keyanalysis"/.test(inv) && /analysis: result\.analysis/.test(inv),
            "a Key Remnant made from an Observe card has no box for its reading");
        ok(/name="tanalysis"/.test(inv) && /analyzedText: result\.analysis/.test(inv),
            "New trace places a trace with no reading");
        ok(/name="finalAnalysis"/.test(inv) && /analysis: action\.finalAnalysis/.test(inv),
            "the Final form has no box for the endgame clue's reading");
        const mm = stripComments(sources.get("mastermind.mjs") ?? "");
        ok(/analyzedText: analysis/.test(mm), "placeFinalRemnant is handed a reading and drops it");

        /* A critical find, and a GM's "the real type", are the two roads that hand a
           Key over already read - the same as they do any trace. */
        const obs = stripComments(sources.get("observe.mjs") ?? "");
        ok(/analyzed: isCritical \? true : null/.test(obs),
            "a critical find of a Key no longer reads it outright");
        const gmi = stripComments(sources.get("gm-items.mjs") ?? "");
        equal((gmi.match(/result\.shown === "real" \? true : null/g) ?? []).length, 2,
            "\"the real type - no analysis needed\" hands a Key over with its reading still to buy");

        const { TRUTH_BULLET_TYPES } = await import("./config.mjs");
        for (const kind of ["key", "final"]) {
            ok(TRUTH_BULLET_TYPES[kind]?.analysedHint
                && TRUTH_BULLET_TYPES[kind].analysedHint !== TRUTH_BULLET_TYPES[kind].hint,
                `a read ${kind} bullet is still told to go and analyse it`);
        }
    }],

    ["R103 - an analysed neutral bullet says there is nothing more in it", async () => {
        /*
         * ACT-10 wrote the sentence for a bullet analysed and still neutral onto
         * REMNANT_TYPES.neutral; `identify` reads TRUTH_BULLET_TYPES.neutral, fell
         * through to the un-analysed `hint`, and the card went on promising what the
         * analysis had just failed to deliver. Review of stage D.
         */
        const { TRUTH_BULLET_TYPES, REMNANT_TYPES } = await import("./config.mjs");
        ok(TRUTH_BULLET_TYPES.neutral?.analysedHint,
            "the analysed sentence is not on the table analysis reads");
        ok(TRUTH_BULLET_TYPES.neutral.analysedHint !== TRUTH_BULLET_TYPES.neutral.hint,
            "the analysed sentence is the un-analysed one");
        ok(!REMNANT_TYPES.neutral?.analysedHint, "the sentence is still on the table nobody reads");
        const { PROSE_KEYS } = await import("./i18n-config.mjs");
        ok(PROSE_KEYS.has("analysedHint"), "the sentence is never offered to the Polish file");
    }],

    ["R102 - the sheet's handle follows the theme, and the track band fits its clock", async () => {
        /*
         * Review of stage D. scaleWindow took the character sheet's resize handle out
         * of the DOM under the glass, and a switch to Legacy - which keeps Daggerheart's
         * size and was promised its handle - never got it back. And the clock's track
         * band widened the plaque for a long name and jumped at the end of a short one.
         */
        const sources = new Map(await otherSources());
        const settings = stripComments(sources.get("settings.mjs") ?? "");
        const scale = bodyOf(settings, "function scaleWindow(", { until: "\n}" });
        ok(!/window-resize-handle.*remove\(\)|resizable = false/.test(scale),
            "the sheet's handle is removed by a one-way edit a theme switch cannot undo");
        const glass = await fetch(`/modules/${MODULE_ID}/styles/stained-glass.css`).then(r => r.text());
        ok(/body\.drpg-theme-stained-glass \.application\.sheet\.actor\.character > \.window-resize-handle\s*\{\s*display: none/.test(glass),
            "nothing hides the character sheet's handle under the glass");
        const css = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        const band = bodyOf(css, ".drpg-hud-track {", { until: "@keyframes drpg-track-scroll" });
        ok(/\.drpg-hud-track \{[^}]*width: 0;[^}]*min-width: 100%/.test(band),
            "the track band adds its text's width to the clock's");
        ok(/\.drpg-hud-track > span \{[^}]*min-width: 100%/.test(band),
            "a short name's copy is narrower than the band, so the loop jumps");
    }],

    ["R101 - the Despair Flow window comes back after a refusal, with its pools", async () => {
        /*
         * Review of stage D. A refused add or revoke came back to `openGmTeamDialog`
         * with nothing awaited, the old copy still on screen, and `alreadyOpen`
         * refused the new one: no window, the draft gone. And the draft itself
         * carried each Monokuma's tick but not the pool chosen beside it.
         */
        const src = stripComments(new Map(await otherSources()).get("gm-team-dialog.mjs") ?? "");
        const add = bodyOf(src, 'result?.op === "add"', { until: 'result?.op === "remove"' });
        const remove = bodyOf(src, 'result?.op === "remove"', { until: 'if (!result || result === "cancel")' });
        ok(/reopen\("drpg-window-gmteam"/.test(add) && /reopen\("drpg-window-gmteam"/.test(remove),
            "a refused add or revoke opens the window while the old copy is still closing");
        const read = bodyOf(src, "function readTeamDraft(", { until: "function paintTeamDraft(" });
        const paint = bodyOf(src, "function paintTeamDraft(");
        ok(/monokumaPools\[actor\.id\] = select\.value/.test(read), "the draft forgets each Monokuma's pool");
        ok(/draft\.monokumaPools/.test(paint), "a carried pool is never put back");
    }],

    ["R100 - the overflow's Silence shuts Hope Calls and leaves a Monokuma's open", async () => {
        /*
         * Handbook 7: the Silence falls on the students' Hope Calls. `callBarred`
         * asked it before the Despair branch, so a Monokuma pressing a Despair Call
         * under it was told the menu was shut - while `spendDespairCallFor`, the
         * `game.drpg` road, sold the same Call without a word. Review of stage D.
         */
        const src = stripComments(new Map(await otherSources()).get("calls.mjs") ?? "");
        const body = bodyOf(src, "export async function callBarred(", { until: "\n}" });
        const despair = body.indexOf("if (despair)"), silence = body.indexOf("overflowBlocksCalls()");
        ok(despair > 0 && silence > despair,
            "the Silence is asked before the Despair branch returns, so it bars a Monokuma's Calls");
    }],

    ["R99 - an assembly's fallback writes to the assembly's scene", async () => {
        /*
         * CALL-18 carries the gather order's scene; the fallback placement, used when
         * the region cannot place the tokens itself, still wrote to `canvas.scene` -
         * the map on the primary GM's screen, not the assembly's. Review of stage D.
         */
        const src = stripComments(new Map(await otherSources()).get("call-effects.mjs") ?? "");
        const body = bodyOf(src, "async function fallbackGather(", { until: "\n}" });
        ok(/async function fallbackGather\(scene,/.test(body), "the fallback is not handed a scene");
        ok(!/canvas\.scene|canvas\.grid/.test(body),
            "the fallback reads the scene on this GM's screen instead of the assembly's");
        ok(/fallbackGather\(scene, region, tokens, REVERT\)/.test(src),
            "the assembly does not pass its own scene to the fallback");
    }],

    ["R93 - the Event panel sits under Despair in both themes, and an NPC sheet keeps its rows", async () => {
        /*
         * Two of Dawid's reports from the live world on 21.09, both CSS, both in 1.2.47.
         *
         * THE PANEL. #ui-top is a flex column ordered by hand - Despair 10, the HUD 20 -
         * and the Event panel's 15 was written in stained-glass.css when only glass had
         * a panel. 1.2.47 gave Legacy one and left the 15 behind, so under Legacy the
         * panel sorted as 0 and stood above Despair Pools. Measured after the fix: 15
         * and below Despair in both themes.
         *
         * THE SHEET. `.application.sheet.actor .window-content` forced a 275px first
         * column onto EVERY actor sheet. Daggerheart lays its NPC sheet out in rows,
         * so a trace's or a project's sheet had its portrait and name squeezed into
         * that track and printed the name one letter per line. Measured after the fix:
         * a single 658px track and a 353px name row, where it had been 16px.
         */
        const css = stripComments(new Map(await otherSources()).get("danganronpa.css")
            ?? await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text()));
        const panel = css.match(/(^|\n)#drpg-events\s*\{[^}]*\}/);
        ok(panel, "the Event panel has no unscoped block, so Legacy has no panel structure");
        ok(/order:\s*15\s*;/.test(panel[0]),
            "the Event panel's place in #ui-top is stated only for one theme");

        const bare = [...css.matchAll(/([^{}]+)\{[^}]*grid-template-columns:\s*minmax\(0,\s*275px\)/g)]
            .map(m => m[1].trim());
        ok(bare.length > 0, "the character sheet's rail rule has gone");
        for (const selector of bare) {
            ok(/\.character\b/.test(selector),
                `"${selector}" puts a 275px rail on sheets that have no rail`);
        }
    }],

    ["R94 - the GM's trace card declares what it reads", async () => {
        /*
         * 1.2.47's 35b09de removed `const pub = data.public ?? {}` from `gmRemnantCard`
         * with the tag row it fed, and left every `pub.` read. The card threw on every
         * open, `showRemnantCard`'s catch swallowed it, and a GM who double-clicked a
         * trace got Daggerheart's adversary sheet. Live on 1.2.47; restored by the merge.
         *
         * Read from the source because the failure is one missing line and the symptom
         * is a silent fallback - a scenario would have to know to look for a card that
         * is not there.
         */
        const src = stripComments(new Map(await otherSources()).get("remnant-ring.mjs") ?? "");
        const body = bodyOf(src, "function gmRemnantCard(", { until: "\nfunction " });
        const declared = body.search(/\bconst pub\s*=/);
        const firstRead = body.search(/\bpub\./);
        ok(firstRead < 0 || (declared >= 0 && declared < firstRead),
            "gmRemnantCard reads `pub` before declaring it, so every GM's trace card throws");
    }],

    ["R95 - a window under glass arrives frosted, not sharp and then frosted", async () => {
        /*
         * Dawid, 21.09: "the blur behind the window appears with a visible delay".
         * The glass is `backdrop-filter` on the window's children, and an ancestor
         * with opacity below 1 is a Backdrop Root - so while the WINDOW faded in, the
         * glass had nothing to blur and drew the map sharp, snapping to frosted on
         * the frame the opacity reached 1. Measured on a paused entrance: header
         * sharpness 22.5 / 23.1 / 24.2 at 50 / 90 / 99 percent, 17.3 at the end;
         * after, 17.2 / 18.8 / 18.0 / 16.7.
         *
         * The rule is structural, so it is read: under glass nothing may fade the
         * window element itself.
         */
        const src = stripComments(new Map(await otherSources()).get("motion.mjs") ?? "");
        const fn = bodyOf(src, "function animateWindowIn(", { until: "\nfunction " });
        const glass = bodyOf(fn, "if (glassOn())", { until: "return;" });
        ok(glass.length > 40, "the entrance no longer has a glass branch");
        const onWindow = bodyOf(glass, "play(el,", { until: "ARRIVE())" });
        ok(onWindow.length > 0 && !/opacity/.test(onWindow),
            "the window itself fades in under glass, so its glass is blind until the last frame");
        ok(/for \(const child of el\.children\)[\s\S]{0,80}opacity: 0/.test(glass),
            "nothing fades the window's contents in, so they appear all at once");
    }],

    ["R96 - a project token opens a card that names only what its reader knows", async () => {
        /*
         * Dawid, 21.09: a project token opened Daggerheart's adversary sheet - to every
         * player too, the shared actor being OBSERVER - and he chose a card like the
         * trace's. The card is new code on a road that reaches players, so what it may
         * print is the test:
         *
         *   - the project is read off the TOKEN the sheet belongs to, never "the first
         *     project token on the scene": the shared actor opens from the Actors
         *     directory with no token behind it, and the first token would be a
         *     project that player has never heard of;
         *   - and asked of `knowsProject`, the predicate that decides whether the
         *     token is drawn for this client at all;
         *   - who knows it, the secrecy and a murder's trigger are the GM's rows only.
         *
         * Measured live on two clients: Player A saw "You do not know what this is."
         * on two projects and the name, progress and room of the one they are in on.
         */
        const sources = new Map(await otherSources());
        const map = stripComments(sources.get("projects-map.mjs") ?? "");
        const show = bodyOf(map, "function showProjectCard(", { until: "\nfunction " });
        ok(/const token = actor\.isToken \? actor\.token : null/.test(show),
            "the card takes its project from somewhere other than the token it was opened from");
        ok(!/getActiveTokens/.test(show),
            "the card falls back to any project token on the scene, which names a project to "
            + "a player who opened the shared actor from the directory");
        ok(/knowsProject\(id\)/.test(show), "the card is not gated by knowsProject");
        ok(/Hooks\.on\("renderActorSheetV2"[\s\S]{0,120}showProjectCard/.test(map),
            "nothing draws the card when a project token's sheet opens");

        const card = bodyOf(map, "function projectCard(", { until: "function unknownProjectCard(" });
        const gm = bodyOf(card, "if (game.user.isGM)");
        for (const key of ["cardKnownBy", "cardSecrecy", "DRPG.Project.indirect", "data-drpg-project-manager"]) {
            ok(gm.includes(key) && card.indexOf(key) >= card.indexOf("if (game.user.isGM)"),
                `"${key}" is printed outside the GM's branch, so a player reads it`);
        }

        /* And the frame both cards share: the title band in the flow, the size a frame late. */
        const css = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        ok(/\.application\.sheet:has\(\.drpg-remnant-card\)\s*>\s*\.window-header\s*\{[^}]*position:\s*relative/.test(css),
            "the NPC sheet's title band still lies over the card's own header");
        const ring = stripComments(sources.get("remnant-ring.mjs") ?? "");
        ok(/requestAnimationFrame\(\(\) => app\.setPosition/.test(ring)
            && /requestAnimationFrame\(\(\) => app\.setPosition/.test(show),
            "a card sizes its window inside the render hook, where the first render overwrites it");
    }],

    ["R97 - an assistant GM's Despair goes to the primary, and cannot loop", async () => {
        /*
         * DESP-12, 1.2.47: the pools are one world object written whole from a local
         * cache, so an assistant GM's adjustment is meant to go to the primary. The
         * receiving half worked; the sending half asked gm-bridge for `hasGm`, which it
         * never exported, so the call threw and every assistant wrote locally - the
         * race stayed open on the live server. Found by the merge's import check.
         *
         * Two ways to get it wrong, both held here: import a name that is not there,
         * or route through `requestDespairAdjust`, which hands a GM caller straight
         * back to `adjustDespair` and would recurse.
         */
        const sources = new Map(await otherSources());
        const despair = stripComments(sources.get("despair.mjs") ?? "");
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const adjust = bodyOf(despair, "export async function adjustDespair(", { until: "\nexport " });
        ok(/sendDespairToPrimary\(userId, delta\)/.test(adjust),
            "an assistant GM's Despair is not sent to the primary");
        ok(!/requestDespairAdjust|hasGm/.test(adjust),
            "adjustDespair reaches for a road that loops or a name that is not exported");
        const send = bodyOf(bridge, "export function sendDespairToPrimary(", { until: "\n}" });
        ok(send.length > 40, "gm-bridge has no way to send a GM's Despair to the primary");
        ok(!/adjustDespair/.test(send), "the send calls adjustDespair, which would loop back to it");
    }],

    ["R98 - a Level Up offer lives where no player can write it or read somebody else's", async () => {
        /*
         * Review of stage D, re-checked on the merged tree and measured on two clients
         * on 21.09. N-2 kept the offer as a flag on the character, which is world data:
         * an owner could write it and pick a Reinforced Level Up from the console, and
         * anybody could read who carried one - after a wrong verdict, the surviving
         * killer. Measured after the move: a forged Reinforced offer with three picks
         * changed nothing (max Health 4 -> 4, the GM's offer still Standard), and one
         * honest pick sent twice in one tick applied once (4 -> 5).
         */
        const sources = new Map(await otherSources());
        const level = stripComments(sources.get("level-up.mjs") ?? "");
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const sheet = stripComments(sources.get("sheet.mjs") ?? "");

        ok(!/pendingAdvance/.test(stripComments(sources.get("config.mjs") ?? "")),
            "the offer still has a flag key, so something can still write it to the character");
        ok(!/setFlag\([^)]*pendingAdvance|unsetFlag\([^)]*pendingAdvance/.test(level),
            "the offer is written to the character, where its owner can forge it and anyone can read it");
        ok(game.settings.settings.get(`${MODULE_ID}.advanceOffers`)?.scope === "client",
            "the offer store is not client-scoped, so it reaches every browser");

        const pending = bodyOf(level, "export function pendingAdvance(", { until: "\n}" });
        ok(/readOffers\(\)/.test(pending) && !/getFlag/.test(pending),
            "pendingAdvance reads something other than this browser's store");
        const record = bodyOf(level, "export async function recordOffer(", { until: "export function offersFor(" });
        ok(/if \(!isPrimaryGm\(\)\) return null;/.test(record),
            "a client other than the primary GM writes the authority");

        const handler = bodyOf(bridge, "async function handleAdvancement(", { until: "async function handleAdvancementOffer(" });
        ok(/advancing\.has\(actor\.id\)/.test(handler) && /finally \{\s*advancing\.delete/.test(handler),
            "two packets inside the apply's round trips both spend the offer");
        ok(/experienceNew[\s\S]{0,80}\.trim\(\)/.test(handler),
            "a new experience with no name spends the offer on the GM's side");
        // The GM test is the declaration's first guard since E31 (25.09.2026), asked before its run.
        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const first = BRIDGE_ACTIONS["advancement.offer"]?.guards?.[0];
        ok(first?.factory === "gmOnly" && /!sender\?\.isGM/.test(String(first)), "a player can record an offer through the bridge");
        ok(/\{ recipients: \[userId\] \}/.test(bodyOf(bridge, "export async function sendOffersTo(")),
            "an owner's offers are broadcast rather than addressed to them");
        ok(/game\.socket\.on\(SOCKET_EVENT, onAdvancementOffers\);\s*askForOffers\(\);/.test(bridge),
            "an owner never asks for their offers, so one made while they were away never lights");

        const button = bodyOf(sheet, "function injectAdvanceButton", { until: "function injectItemButton" });
        ok(/!app\.document\.isOwner/.test(button),
            "the lit badge shows on characters the viewer does not own");
    }],

    ["R125 - the README and the six handbooks name the version they ship with", async () => {
        /*
         * E01, 24.09.2026; audit S14-16, S13-42, S12-76. The handbooks open from the
         * corner of the screen and say on their third line which version they
         * describe; all six said 1.2.55 while the module was 1.2.56, and the sandbox
         * showed a player the brochure reading "Module 1.2.55". With every stage of the
         * 1.3.0 plan shipping as its own 1.2.X (D20), that gap opens at every release
         * unless something fails on it - the release workflow checks the same thing,
         * and this is the half that fails in the suite, before anybody dispatches it.
         *
         * The stamp is looked for in the first five lines: a version quoted further
         * down a handbook is history, not a stamp.
         */
        const version = moduleVersion();
        ok(/^\d+\.\d+\.\d+$/.test(version), `the module's own version reads "${version}"`);
        const HANDBOOKS = ["gm-handbook.en", "gm-handbook.pl", "player-handbook.en",
            "player-handbook.pl", "player-brochure.en", "player-brochure.pl"];
        const stale = [];
        for (const name of HANDBOOKS) {
            const res = await fetch(`/modules/${MODULE_ID}/docs/handbooks/${name}.md`);
            ok(res.ok, `docs/handbooks/${name}.md did not load`);
            const head = (await res.text()).split("\n").slice(0, 5).join("\n");
            if (!head.includes(version)) stale.push(`${name} (${head.match(/\d+\.\d+\.\d+/)?.[0] ?? "no version"})`);
        }
        const readme = await fetch(`/modules/${MODULE_ID}/README.md`);
        ok(readme.ok, "README.md did not load");
        const said = (await readme.text()).match(/describe version (\d+\.\d+\.\d+)\./)?.[1] ?? "nothing";
        if (said !== version) stale.push(`README (${said})`);
        ok(!stale.length, `module.json says ${version}, these say otherwise: ${stale.join(", ")}`);
    }],

    ["R126 - fileSizes reads every stylesheet and language the module loads", async () => {
        /*
         * E01, 24.09.2026; audit S01-26. The list `fileSizes()` walks used to name four
         * files by hand beside the crawled scripts, and left out four of the six
         * stylesheets and the Polish file - the ones the theme work changed. A GM
         * asked to paste the report after a theme fix "did not arrive" got a list that
         * looked complete. It reads the manifest now, and this holds it there.
         */
        const { loadedFiles } = await import("./diagnostics.mjs");
        const files = new Set(await loadedFiles());
        const manifest = await fetch(`/modules/${MODULE_ID}/module.json`).then(r => r.json());
        const { LANGUAGES } = await import("./i18n.mjs");
        const wanted = [
            ...Array.from(manifest.styles ?? []),
            ...Object.keys(LANGUAGES).map(code => `lang/${code}.json`),
            "module.json", "scripts/module.mjs"
        ];
        ok(wanted.length >= 9, `only ${wanted.length} files were expected - the manifest reads wrong`);
        const missed = wanted.filter(f => !files.has(f));
        ok(!missed.length, `fileSizes() does not look at: ${missed.join(", ")}`);
    }],

    ["R128 - text a player writes cannot become markup on another screen", async () => {
        /*
         * E02, 24.09.2026; audit S05-05, S11-27. Two of the four roads the audit found
         * from a player's console to script on the GM's screen are rules that can be
         * asked directly, so they are asked here; the other two travel a socket and
         * are driven in the harness (30-security, part 6).
         *
         *   - a Reshape name went through a tag stripper that only knew CLOSED tags,
         *     and `<img src=x onerror=alert(1)//` is 29 characters of an unclosed one;
         *   - a chat message's sound flag was honoured from any author, so a player
         *     could play the safeword - the one sound above the volume slider - to
         *     everybody, and reach the GMs with any other.
         */
        const { plainText } = await import("./cleanup.mjs");
        const name = plainText("<img src=x onerror=alert(1)//", 60);
        ok(!/[<>]/.test(name), `a Reshape name still carries an angle bracket: ${name}`);
        equal(plainText("Kaede's <b>knife</b>", 60), "Kaede's knife", "an ordinary name lost more than its tags");

        const { soundFromMessage } = await import("./sfx.mjs");
        const message = (author, sfx, extra = {}) => ({
            author,
            getFlag: (scope, key) => scope === MODULE_ID ? ({ sfx, ...extra })[key] : undefined
        });
        const player = { isGM: false }, gm = { isGM: true };
        equal(soundFromMessage(message(player, { key: "safeword", gm: true })), null,
            "a player's message plays the safeword without being the safeword card");
        equal(soundFromMessage(message(player, { key: "safeword", gm: true }, { safeword: true }))?.key, "safeword",
            "the real safeword card, which any player may post, no longer sounds");
        const ordinary = Object.keys(await import("./config.mjs").then(c => c.SFX_EVENTS))
            .find(k => k !== "safeword");
        ok(ordinary, "no ordinary sound to ask about");
        const asked = soundFromMessage(message(player, { key: ordinary, gm: true }));
        equal(asked?.key, ordinary, "a player's own card lost its sound");
        equal(asked?.forGm, false, "a player's card still reaches the GMs with a sound");
        equal(soundFromMessage(message(gm, { key: ordinary, gm: true }))?.forGm, true,
            "a GM's card can no longer reach the other GMs");
    }],

    ["R129 - no item or actor field is printed into markup unescaped", async () => {
        /*
         * E02, 24.09.2026; audit S03-05, S10-13. An item's picture, its tier and its
         * roles are flags a player's console can write on their own character, and the
         * rows of the sheet printed all three into `innerHTML` beside a name that was
         * escaped. Foundry checks only that `img` ends like a picture. The GM opening
         * that player's sheet ran whatever the flag held. Read from source because the
         * sheet is Daggerheart's and is not drawn headless.
         */
        const bad = [];
        for (const [file, raw] of await otherSources()) {
            const text = stripComments(raw);
            for (const m of text.matchAll(/src="\$\{(?!foundry\.utils\.escapeHTML|esc\()[^}]*\}"/g)) {
                bad.push(`${file}:${lineAt(text, m.index)} ${m[0]}`);
            }
            // A tier on a line that is building markup. `(T${tier})` inside a label
            // that is escaped whole before it is printed (vault.mjs, gm-items.mjs) is
            // text, not markup, and was the first run's two false alarms.
            for (const m of text.matchAll(/T\$\{tier\}/g)) {
                const line = lineAround(text, m.index);
                if (/</.test(line)) bad.push(`${file}:${lineAt(text, m.index)} ${m[0]}`);
            }
            for (const m of text.matchAll(/drpg-role-\$\{(?!classSafe\()/g)) bad.push(`${file}:${lineAt(text, m.index)} ${m[0]}`);
            /*
             * A NAME HANDED TO A SENTENCE THAT IS PRINTED AS MARKUP (E02 review,
             * 24.09.2026). `${game.i18n.format("...", { name: actor.name })}` on a
             * line building HTML prints the name as markup, and a character's or an
             * item's name is the one field of a card its player can set. The review
             * found one on a card the GM's own client writes (observe.mjs,
             * "resolveLost") and four more on cards a player's client writes. A
             * sentence built into plain text and escaped whole where it is printed
             * is not markup, which is why the line has to be building some.
             */
            for (const m of text.matchAll(/\$\{\s*(?:game\.i18n|i18n)\.format\(/g)) {
                const line = lineAround(text, m.index);
                if (!/</.test(line)) continue;
                let depth = 1, end = m.index + m[0].length;
                while (end < text.length && depth) {
                    if (text[end] === "(") depth++;
                    else if (text[end] === ")") depth--;
                    end++;
                }
                const args = text.slice(m.index + m[0].length, end);
                for (const arg of args.matchAll(/\w+:\s*([\w?.[\]]+\.name)\b/g)) {
                    bad.push(`${file}:${lineAt(text, m.index)} ${arg[0]}`);
                }
            }
        }
        ok(!bad.length, `printed into markup without escaping: ${bad.join("; ")}`);
    }],

    ["R134 - an undo from a player is paid for by a Reroll", async () => {
        /*
         * E03, 24.09.2026; audit S10-40 and the undo half of S10-03, S05-03, S04-09,
         * S05-13, S05-40. Every packet that TAKES SOMETHING BACK - an Observe's bullet,
         * a crisis action, a clean-up, an Analyze, a sabotage, progress, a trace, a
         * point of Despair - was believed, and a console could send one without ever
         * buying a Reroll. The handlers that carry one now ask for the receipt a
         * Reroll leaves (reroll-receipts.mjs). Read from source, because the honest
         * road needs a player's client and a GM's at once - 30-security drives it.
         */
        const sources = new Map(await otherSources());
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const leaf = stripComments(sources.get("bridge-guards.mjs") ?? "");
        must(bridge.length > 1000 && leaf.length > 1000, "gm-bridge.mjs or bridge-guards.mjs did not load");
        const both = `${bridge}\n${leaf}`;
        /*
         * THROUGH THE TABLE (E31, 25.09.2026). A request that takes something back is
         * a declaration of the bridge's tables, and its receipt is spent by one of the
         * guards it names (a `guard...Receipt`: the note above `firstRefusal` in
         * bridge-guards.mjs), which the runner asks before the run. So each declaration
         * is read as its guards, with the guards those name; the receipt's has to be
         * the last, since a guard asked after it could refuse an undo already paid
         * for; and a guard named anywhere that nothing defines fails, rather than
         * reading as a guard with nothing in it.
         */
        const PAYS = ["observe.resolve", "analyze.resolve", "murder.crisis", "murder.cleanup",
            "project.unsabotage", "project.progress", "remnant.edit", "despair.adjust"];
        const all = Object.assign({}, ...(await bridgeTables()).map(t => t.table));
        const spends = guard => withGuards(both, String(guard)).body.includes("spendRerollReceipt(");
        const unpaid = [], early = [];
        for (const action of PAYS) {
            const guards = all[action]?.guards;
            must(Array.isArray(guards), `${action} is no longer a declaration of the bridge's tables - this test reads nothing until it is pointed at it again`);
            const paying = guards.map(spends);
            if (!paying.includes(true)) unpaid.push(action);
            else if (paying.indexOf(true) !== guards.length - 1) early.push(action);
        }
        ok(!unpaid.length, `these take something back for a player with no Reroll receipt: ${unpaid.join(", ")}`);
        ok(!early.length, `these spend the receipt before a guard that could still refuse: ${early.join(", ")}`);
        // And nothing outside the list reads `undo` - on its whitelist or in a guard - without one.
        const stray = Object.entries(all).filter(([action, decl]) => !PAYS.includes(action)
            && ("undo" in (decl.sanitize?.fields ?? {}) || decl.guards.some(guard => /payload\??\.undo\b/.test(String(guard)))))
            .map(([action]) => action);
        ok(!stray.length, `these read payload.undo and ask for no receipt: ${stray.join(", ")}`);
        // Every guard a function of the bridge names is defined, the player's road of call.arm among them.
        const nowhere = [...new Set([...bridge.matchAll(/^(?:export )?(?:async )?function (\w+)\(/gm)].map(m => m[1]))]
            .flatMap(name => withGuards(both, topLevelFunction(bridge, name)).missing.map(guard => `${name} asks ${guard}`));
        ok(!nowhere.length, `these functions ask a guard neither gm-bridge.mjs nor bridge-guards.mjs defines: ${nowhere.join(", ")}`);
    }],

    ["R138 - the GM judges a crisis action again before it lands", async () => {
        /*
         * E03, 24.09.2026; audit S04-09. The stage, the side, the turn, the locks and
         * what the character had left to spend were checked on the acting player's
         * client only. `crisisRefusal` is the one list of those checks, asked by that
         * client and by the GM's bridge; this holds both callers to it.
         */
        const sources = new Map(await otherSources());
        const murder = stripComments(sources.get("murder.mjs") ?? "");
        ok(bodyOf(murder, "export async function takeCrisisAction(", { length: 1200 }).includes("crisisRefusal("),
            "the player's own client no longer asks crisisRefusal");
        /*
         * THROUGH THE TABLE (E31, 25.09.2026). The bridge's `crisisRefusal` is asked in
         * `guardCrisisAction`, one of the guards murder.crisis's declaration names, and
         * the runner asks every guard before the run (R162 drives it). So "before it
         * lands" is being among the guards: moved into the run, the check would come
         * after the action was already taken, which is what this fails.
         */
        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const guards = BRIDGE_ACTIONS["murder.crisis"]?.guards;
        must(Array.isArray(guards), "murder.crisis is no longer a declaration of BRIDGE_ACTIONS - this test reads nothing until it is pointed at it again");
        const leaf = stripComments(sources.get("bridge-guards.mjs") ?? "");
        const asked = guards.map(guard => withGuards(leaf, String(guard)));
        const missing = asked.flatMap(a => a.missing);
        ok(!missing.length, `murder.crisis's guards ask a guard bridge-guards.mjs does not define: ${missing.join(", ")}`);
        ok(asked.some(a => /crisisRefusal\(actor, payload\.key\)/.test(a.body)),
            "the GM does not judge a crisis action again before it lands - no guard of murder.crisis asks crisisRefusal");
        ok(!/crisisRefusal\(/.test(String(BRIDGE_ACTIONS["murder.crisis"].run)),
            "murder.crisis's run judges the action itself, after the runner has accepted it");
    }],

    ["R143 - ownership raised past the window's back, and a bullet a player edits, are put back", async () => {
        /*
         * E03, 24.09.2026; audit S11-04 and S05-12. Configure Ownership saves with
         * `noHook`, which skips the `pre` hook that was the only guard; and a player
         * editing their own Truth Bullet was taken for a GM correcting it. Both are put
         * back after the fact on the primary GM, so both are read here: the hooks that
         * do it, and the list the player's own client refuses first.
         */
        const sources = new Map(await otherSources());
        const anonymity = stripComments(sources.get("anonymity.mjs") ?? "");
        ok(/Hooks\.on\("updateActor"[^\n]*lowerOwnership/.test(anonymity), "nothing lowers a raised ownership after the write");
        ok(/closeDocumentOwnershipConfig/.test(anonymity), "the ownership window closing is not watched");
        ok(/"ownership\.default": OBSERVER/.test(bodyOf(anonymity, "async function lowerOwnership(", { until: "\n}\n" })),
            "lowerOwnership does not put the default back to Observer");
        const bullets = stripComments(sources.get("truth-bullets.mjs") ?? "");
        const watcher = bodyOf(bullets, "function watchBulletEdits(", { length: 2400 });
        ok(/Hooks\.on\("updateItem", async \(item, changes, options, userId\)/.test(watcher),
            "the bullet watcher does not know who made the change");
        ok(watcher.includes("revertPlayerBulletEdit("), "a player's edit of a bullet is not put back");
        ok(watcher.indexOf("revertPlayerBulletEdit(") < watcher.indexOf("FROM_REMNANT"),
            "the player's edit is looked at after the watcher has already returned for the trace's own writes");
        const guard = stripComments(sources.get("resource-guard.mjs") ?? "");
        for (const flag of ["playerText", "analyzedText", "shownType", "analyzed", "lockedChapter"]) {
            ok(bodyOf(guard, "const BULLET_GUARDED", { length: 400 }).includes(`"${flag}"`),
                `the player's own client lets a bullet's ${flag} be edited`);
        }
    }],

    ["R144 - five doors a console used, each shut on the side that writes", async () => {
        /*
         * E03, 24.09.2026; audit S02-42, S09-11, S08-33. A free action for anybody
         * (`free`), a Despair Call bought on a player's client where the pool cannot
         * move, a sealed room announced when nothing was written, a handover in the
         * dark, and a key copied out of a stash on the other side of the map.
         */
        const sources = new Map(await otherSources());
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? "");
        ok(/options\.free && !game\.user\.isGM/.test(bodyOf(rolls, "export async function performAction(", { length: 700 })),
            "performAction still takes `free` from anybody");
        const calls = stripComments(sources.get("calls.mjs") ?? "");
        ok(/if \(!game\.user\.isGM\)/.test(bodyOf(calls, "export async function spendDespairCallFor(", { length: 700 })),
            "spendDespairCallFor runs on a player's client");
        const despair = stripComments(sources.get("despair.mjs") ?? "");
        const spend = bodyOf(despair, "export async function spendDespairCall(", { until: "\n}\n" });
        ok(/if \(!game\.user\.isGM\)/.test(spend), "spendDespairCall runs on a player's client");
        ok(/const paid = await adjustDespair\(/.test(spend) && /paid === null/.test(spend),
            "a Despair Call goes on when its pool did not move");
        const effects = stripComments(sources.get("call-effects.mjs") ?? "");
        ok(/return Boolean\(await writeWorld\(/.test(bodyOf(effects, "async function sealRoom(", { length: 300 })),
            "sealRoom says it sealed whether or not it wrote");
        const handover = stripComments(sources.get("handover.mjs") ?? "");
        ok(/isEclipse\(\)/.test(bodyOf(handover, "async function verify(", { until: "\n}\n" })), "a handover is not refused during an Eclipse on the GM's side");
        const give = bodyOf(handover, "export async function giveItem(", { until: "\n}\n" });
        ok(give.indexOf("isStashed(item)") >= 0 && give.indexOf("isStashed(item)") < give.indexOf("BEDROOM_KEY_FLAG"),
            "a key lying in a stash can still be handed over");
    }],

    ["R145 - Analyze, Stage 6 and a clean-up's undo, judged by the rules on the GM", async () => {
        /*
         * E03, 24.09.2026; audit S05-40. One Analyze per bullet per chapter was the
         * sheet's rule alone; a misleading trail could point at the killer, the victim
         * or a Monokuma; the body could be carried off from a room the killer was not
         * in; and a clean-up's undo wrote the Sanity back as it stood, erasing every
         * mark earned since.
         */
        const sources = new Map(await otherSources());
        const analyze = stripComments(sources.get("analyze.mjs") ?? "");
        const resolve = bodyOf(analyze, "export async function resolveAnalyze(", { until: "\n}\n" });
        ok(/!undo && !isAnalysable\(item, chapter\)/.test(resolve), "a fresh Analyze does not ask whether the bullet may be analysed");
        ok(/analysedChapter !== chapter/.test(resolve), "an undo does not ask for a throw in this chapter");
        const cleanup = stripComments(sources.get("cleanup.mjs") ?? "");
        const six = bodyOf(cleanup, "export async function resolveStageSix(", { until: "\n}\n" });
        ok(six.indexOf("framingCandidates(actor)") > 0 && six.indexOf("framingCandidates(actor)") < six.indexOf("spendStress("),
            "a misleading trail is not checked against who may be framed before it is paid for");
        ok(six.indexOf("bodyIsHere(actor)") > 0 && six.indexOf("bodyIsHere(actor)") < six.indexOf("spendStress("),
            "moving the body does not ask where the body is before it is paid for");
        ok(/receipt\.stressAfter - receipt\.stressBefore/.test(cleanup), "a clean-up's undo does not take back what it moved");
    }],

    ["R146 - the stylesheet's resource lock follows the setting", async () => {
        /*
         * E03, 24.09.2026; audit S01-40. With "Players cannot edit..." switched off,
         * resource-guard.mjs let an edit through and the stylesheet still swallowed
         * the click on Hope and the traits, so the switch looked broken. The rules now
         * hang on a body class the setting stamps.
         */
        const css = await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text());
        const rules = stripComments(css);
        ok(!/body:not\(\.drpg-gm\)[^{]*(\.hope-value|trait-value|name\*="traits")/.test(rules),
            "a player lock still hangs on being not-a-GM rather than on the setting");
        ok((rules.match(/body\.drpg-player\.drpg-resources-locked/g) ?? []).length >= 4,
            "the Hope and trait locks do not hang on drpg-resources-locked");
        const sources = new Map(await otherSources());
        ok(/"drpg-resources-locked", Boolean\(getSetting\(SETTINGS\.lockPlayerResources\)\)/.test(stripComments(sources.get("module.mjs") ?? "")),
            "nothing stamps the class when the world loads");
        ok(/lockPlayerResources, \{[\s\S]{0,500}onChange: value => document\.body\.classList\.toggle\("drpg-resources-locked"/.test(stripComments(sources.get("settings.mjs") ?? "")),
            "switching the setting does not move the class");
    }],

    ["R147 - the relay guard stands before anything can stop the module starting", async () => {
        /*
         * E03, 24.09.2026; audit S16-01. A world whose module refuses to start - a
         * required module switched off - still holds Projects and characters worth
         * protecting, so the guard is registered first in `init`, ahead of the
         * requirements check that returns early.
         */
        const module = stripComments((await otherSources()).find(([file]) => file.endsWith("module.mjs"))?.[1] ?? "");
        const init = bodyOf(module, 'Hooks.once("init"', { length: 3000 });
        const guard = init.indexOf("registerRelayGuard");
        ok(guard > 0 && guard < init.indexOf("requirementsMet()"), "the relay guard is registered after the requirements check");
    }],

    ["R152 - no update deletes or replaces a key with the old '-=' / '==' spelling, which v14 ignores", async () => {
        /*
         * E30, 24.09.2026; audit S17-01. `migrateRemnants` took a trace's answer key off
         * its token with `flags.<id>.-=<key>`, the spelling the module's own notes
         * measured removing nothing in this Foundry (actions.mjs, music.mjs, fog.mjs,
         * migrate.mjs): the key stayed on a token every client receives, and the
         * summary said "stripped". A key is deleted with `forcedDeletion()` or
         * `unsetFlag`, and a value replaced with `replaceFlag` (utils.mjs).
         *
         * Every string and template literal of every file the module loads, this
         * suite's own included, is read for a key segment that starts with either old
         * spelling. A membership read is not a write and is let through: `"-=key" in
         * flags` is how truth-bullets.mjs recognises a deletion somebody else sent.
         * The spelling is put together at run time, so this test's source holds no
         * match, and a sample built the same way has to be found first: a scan that
         * finds nothing anywhere has proved nothing.
         */
        const DEL = "-" + "=", REP = "=" + "=";
        const KEY = new RegExp(`(?:^|\\.)(?:${DEL}|${REP})(?=[A-Za-z0-9_$]|\\$\\{)`);
        /* AND JOINED ON WITH `+` (E30 review, 25.09.2026): `"flags.x.-=" + key` and
           `"flags.x." + "-=" + key` hold the spelling in a literal that ends where the key
           is added on, and the scan above looked only inside one literal. None in the
           module on 25.09 with this rule too. */
        const TAIL = new RegExp(`(?:^|\\.)(?:${DEL}|${REP})$`);
        const joined = /^\s*\+/;
        const read = /^\s*\]?\s*in\b/;
        const writes = code => stringLiterals(code).filter(lit => !read.test(code.slice(lit.end))
            && (KEY.test(lit.text) || (TAIL.test(lit.text) && joined.test(code.slice(lit.end)))));
        const sample = `await token.update({ [\`flags.x.${DEL}\${key}\`]: null }); if ("${DEL}kept" in flags) {}`
            + ` await token.update({ ["flags.y.${DEL}" + key]: null, ["flags.z." + "${REP}" + key]: {} });`;
        equal(JSON.stringify(writes(sample).map(lit => lit.text)), JSON.stringify([`flags.x.${DEL}\${}`, `flags.y.${DEL}`, REP]),
            "the scan does not find the three writes it was built to find, or takes the membership read for one");

        const found = [];
        for (const [file, text] of await moduleSources()) {
            const code = stripComments(text);
            for (const lit of writes(code)) found.push(`${file}:${lineAt(code, lit.start)} ${JSON.stringify(lit.text).slice(0, 60)}`);
        }
        ok(!found.length, `a key spelled the old way, which v14 ignores (delete with forcedDeletion() or unsetFlag, replace with replaceFlag): ${found.join("; ")}`);
    }],

    ["R154 - the runner keeps the test author contract", async () => {
        /*
         * E30, 24.09.2026; audit S17-03. Every test is now run through `runOne` and
         * judged by what it did, not only by whether it threw: a test that returns
         * without one `ok()` or `equal()` having run measured nothing and FAILs, a
         * failure the test caught itself FAILs, and a test marked red until a later
         * stage is green only while it fails on an assertion. None of that shows in
         * a green run - it shows only on the day a test breaks the contract - so the
         * kit carries one small test per rule, each breaking it on purpose, and this
         * runs them through the same `runOne` against a made-up ledger (E90 still to
         * come, E91 shipped) and holds each to its known verdict. The four outcomes
         * have to appear between them, or the cases prove less than they say. Twenty
         * cases at first; two more since the E30 review (25.09.2026), a breach of the
         * contract in a test marked red, which the runner had taken for the red.
         */
        ok(KIT_SELF_TESTS.length >= 22, `the kit carries ${KIT_SELF_TESTS.length} self-tests, and it had 22`);
        const outcomes = new Set();
        for (const c of KIT_SELF_TESTS) {
            const r = await runOne(c.entry, { tier: 0, ledger: "ledger" in c ? c.ledger : SELF_LEDGER });
            outcomes.add(r.outcome);
            equal(r.outcome, c.expect, `the contract's case "${c.entry[0]}" came out wrong (${r.message ?? "no message"})`);
            ok(String(r.message ?? "").includes(c.says), `the contract's case "${c.entry[0]}" says "${r.message}", not "${c.says}"`);
        }
        equal([...outcomes].sort().join(" "), "fail pass red skip", "the self-tests do not reach all four outcomes");
    }],

    ["R155 - every expectedRed names a stage that has not shipped", async () => {
        /*
         * E30, 24.09.2026; audit S17-03. `[name, fn, expectedRed("E07", why)]` is a
         * promise that E07 turns the test green. The promise is held to
         * tools/stages.json with the rule tools/stages.mjs applies - a stage has
         * shipped when its row has a version and this module is at or past it - so
         * the release that ships E07 turns every marker still naming E07 into a
         * failure on that same commit. Every tier's markers are read here, tier 2's
         * included, through the lists the runner hands the kit (registerSuite): a
         * tier-0 run does not execute a scenario, and its marker must not wait for a
         * tier-2 run to be read. Where the ledger is not served (an installed zip:
         * tools/ is not in it) only the marker's shape is checked here, and the run
         * says so in one line.
         *
         * The check is shown the kit's five markers first (MARKER_FIXTURE), one live
         * and four wrong - shipped, unknown, without a reason, and a look-alike
         * expectedRed did not make - and has to tell them apart; a checker that
         * flags nothing proves nothing.
         */
        equal(JSON.stringify(MARKER_FIXTURE.map(({ marker }) => markerProblem(marker, SELF_LEDGER) !== null)),
            JSON.stringify(MARKER_FIXTURE.map(({ flagged }) => flagged)),
            "the marker check does not tell a live marker from a shipped, unknown, unexplained or forged one");
        equal(MARKER_FIXTURE.filter(({ flagged }) => flagged).length, 4, "the fixture no longer holds its four wrong markers");

        const entries = suiteEntries();
        ok(entries.length >= 300, `the runner handed the kit ${entries.length} tests, and the suite has over 300`);
        const ledger = await stageLedger();
        if (ledger) {
            const version = game.modules.get(MODULE_ID)?.version;
            ok([...ledger.values()].some(row => row.version === version),
                `tools/stages.json names no stage for this module's version ${version} - the release commit runs \`node tools/stages.mjs ship\``);
        }
        const stale = entries.filter(e => e.red).map(e => [e, markerProblem(e.red, ledger)]).filter(([, problem]) => problem);
        ok(!stale.length, `${stale.length} red marker(s) to take off or move: ${stale.map(([e, problem]) => `tier ${e.tier} "${e.name}": ${problem}`).join("; ")}`);

        /* And every row of DUMP_RULES, which says until when the world dump may leave
           something out (E30, C15): "never", "1.3.x (D27)", or a stage held to the
           same ledger - so the release of that stage fails while the row is still
           there. The kit's UNTIL_FIXTURE first: three that pass, four that do not. */
        equal(JSON.stringify(UNTIL_FIXTURE.map(({ rule }) => untilProblem(rule, SELF_LEDGER) !== null)),
            JSON.stringify(UNTIL_FIXTURE.map(({ flagged }) => flagged)),
            "the until check does not tell a live row from a shipped, unknown, malformed or unexplained one");
        ok(DUMP_RULES.length > 0, "the world dump has no rules to read");
        const rules = DUMP_RULES.map(rule => [rule, untilProblem(rule, ledger)]).filter(([, problem]) => problem);
        ok(!rules.length, `dump rule(s) to take off or move: ${rules.map(([rule, problem]) => `"${rule.match}": ${problem}`).join("; ")}`);
    }],

    ["R156 - no test cuts the source it reads with a bare indexOf", async () => {
        /*
         * E30, 24.09.2026; audit S17-03. `src.slice(src.indexOf(marker))` answers -1
         * for a marker that has moved, a slice from -1 is the last character, and
         * every NEGATIVE assertion after it passes whatever the file now says; a
         * guarded start with a bare indexOf END runs to the end of the file, so a
         * positive one can match code in another function. `split(marker)[1]` does
         * the same with an empty string. Counted before E30 converted them, with the
         * detector below: 62 in the tier files (48 in tier 0; 12 in tier 1, one of
         * them a split; 2 in tier 2), guarded or not - a guard is still a hand-made
         * cut with its own end. Cut with the kit: bodyOf, fnSource, lineAround.
         *
         * bareCuts is tests-lint.mjs's, the one `node tools/check.mjs contract` runs
         * in Node. It is shown its fixture first and must flag exactly the fixture's
         * five cuts, and then it must read every tier file - every test the runner
         * was handed, and the suite's slice and split calls: 124 before the
         * conversion, 62 after it (24.09) - or a clean result means nothing.
         *
         * WHAT IT DOES NOT FLAG (E30 review, 25.09.2026): `bodyOf(src, marker)` with
         * neither `until` nor `length`. That reads to the end of the file as well -
         * guarded at its start, unbounded at its end - so a positive assertion after
         * it can still match code in another function. There were 41 such calls in
         * the tier files on 25.09 (39 before the conversion); R54's `releaseControls`
         * read was one that did, and is bounded now. The other 40, and a rule here,
         * are E40's.
         */
        const fx = LINT_FIXTURES.bareCuts;
        equal(JSON.stringify(bareCuts(fx.text).found.map(f => f.line).sort((a, b) => a - b)), JSON.stringify(fx.flags),
            "the cut detector does not flag exactly the cuts in its own fixture");
        const scan = await scanSuite(bareCuts);
        equal(scan.files.join(" "), "tests-tier0.mjs tests-tier1.mjs tests-tier2.mjs", "the scan does not read the three tier files");
        equal(scan.tests, suiteEntries().length, "the scan finds a different number of tests in the tier files than the runner was handed");
        ok(scan.read > 40, `the scan read ${scan.read} slice and split calls in the tier files, and there were 62`);
        ok(!scan.found.length, `cut with bodyOf, fnSource or lineAround instead: ${scan.found.join("; ")}`);
    }],

    ["R157 - no assertion is true by construction", async () => {
        /*
         * E30, 24.09.2026; audit S17-03. `ok(true, ...)`, a `|| true` at the top of a
         * condition, `equal(x, x, ...)`: each counts as a measurement and cannot
         * fail, which is the assertion counter's blind spot - it counts that an
         * assertion ran, not that it could have come out the other way. There were
         * none in the tier files when this was written (read 24.09: 1,896 ok, equal
         * and needs calls); the harness scenarios had two `check(name, true)`, which
         * E30 took out, and `node tools/check.mjs contract` holds them to the same
         * rule. equal() with a literal on ONE side still compares, and is not
         * flagged. Fixture first, as in R156.
         */
        const fx = LINT_FIXTURES.vacuousAsserts;
        equal(JSON.stringify(vacuousAsserts(fx.text).found.map(f => f.line).sort((a, b) => a - b)), JSON.stringify(fx.flags),
            "the vacuous-assertion detector does not flag exactly its fixture's seven");
        const scan = await scanSuite(vacuousAsserts);
        equal(scan.files.join(" "), "tests-tier0.mjs tests-tier1.mjs tests-tier2.mjs", "the scan does not read the three tier files");
        equal(scan.tests, suiteEntries().length, "the scan finds a different number of tests in the tier files than the runner was handed");
        ok(scan.read > 1000, `the scan read ${scan.read} assertions, and the suite has well over a thousand`);
        ok(!scan.found.length, `an assertion that holds whatever the code does: ${scan.found.join("; ")}`);
    }],

    ["R158 - needs() is asked only of a probe", async () => {
        /*
         * E30, 24.09.2026; audit S17-03. The kit refuses anything but an env.* or
         * world.* probe at run time (needs(), tests-kit.mjs), and that is the
         * guarantee - but only on the day the line runs, and a tier-2 skip is not run
         * in a tier-0 pass. This is the early signal: the first argument of every
         * needs( in the tier files is a call of env.* or world.*, read off the text
         * (66 calls on 24.09). Fixture first, as in R156.
         */
        const fx = LINT_FIXTURES.needsArgs;
        equal(JSON.stringify(needsArgs(fx.text).found.map(f => f.line).sort((a, b) => a - b)), JSON.stringify(fx.flags),
            "the needs() detector does not flag exactly its fixture's three");
        const scan = await scanSuite(needsArgs);
        equal(scan.files.join(" "), "tests-tier0.mjs tests-tier1.mjs tests-tier2.mjs", "the scan does not read the three tier files");
        equal(scan.tests, suiteEntries().length, "the scan finds a different number of tests in the tier files than the runner was handed");
        ok(scan.read > 50, `the scan read ${scan.read} needs() calls, and the suite has over fifty`);
        ok(!scan.found.length, `a skip asked of something that is not a probe: ${scan.found.join("; ")}`);
    }],

    ["R159 - worldDump reads every document type and setting that a write in the module names", async () => {
        /*
         * E30, 24.09.2026; audit S17-04. The world dump is what says tier 0/1 changed
         * nothing and that each scenario's restore put the world back, so a write it
         * cannot see is a write both of those are silent about. Read off the module's
         * own source:
         * - every document type it creates, updates or deletes (create/update/delete
         *   EmbeddedDocuments("X"), X.create, X.createDocuments, X.updateDocuments,
         *   X.deleteDocuments) is one the dump reads - not skipped, not ids only. On
         *   24.09: Token, Item, TableResult, ActiveEffect, ChatMessage, Playlist,
         *   Actor, Folder, RollTable (RenderTexture.create is PIXI's and
         *   Operator.create v14's operators; neither is a document type);
         * - every setting of another namespace it writes by name, and every setting
         *   enforced.mjs holds, is in DUMP_FOREIGN_SETTINGS (core.globalPlaylistVolume,
         *   core.permissions, isometric-perspective.showWelcome);
         * - no file writes localStorage, sessionStorage or IndexedDB itself: a store
         *   outside registered settings and documents is one the dump does not read,
         *   and the first file that opens one fails this until the dump reads it too.
         * Then dumpDiff on made-up dumps: a changed leaf and an added unit are
         * reported, a write stamp that moved is not, and a unit that went is.
         *
         * WHAT THIS DOES NOT READ, said since the E30 review (25.09.2026), when its name
         * still promised "every kind of write": a write through a document already in
         * hand - `doc.update`, `setFlag`, `unsetFlag`, `doc.delete` - names no type and is
         * not scanned, and a type with no path in the dump at all is dropped with
         * RenderTexture and Operator rather than failed (both E40's). A row that keeps
         * some fields of a type (DUMP_RULES) is not held to the fields the module
         * writes either: ChatMessage kept no `rolls`, which reroll.mjs rewrites on a
         * card, until that review - the made-up card below is the check that it does now.
         */
        const { ENFORCED } = await import("./enforced.mjs");
        const kinds = new Set(), foreign = new Set(), stores = [];
        for (const [file, raw] of await otherSources()) {
            const code = stripComments(raw);
            for (const m of code.matchAll(/(?:create|update|delete)EmbeddedDocuments\(\s*"(\w+)"/g)) kinds.add(m[1]);
            for (const m of code.matchAll(/\b([A-Z]\w+)\.(?:create|createDocuments|updateDocuments|deleteDocuments)\(/g)) kinds.add(m[1]);
            for (const m of code.matchAll(/game\.settings\.set\(\s*"([\w-]+)",\s*"([\w.-]+)"/g)) {
                if (m[1] !== MODULE_ID && m[1] !== game.system.id) foreign.add(`${m[1]}.${m[2]}`);
            }
            for (const m of code.matchAll(/\b(?:localStorage|sessionStorage)\.setItem\(|\bindexedDB\.open\(/g)) {
                stores.push(`${file}:${lineAt(code, m.index)}`);
            }
        }
        const written = [...kinds].map(kind => [kind, dumpPathsOf(kind)]).filter(([, paths]) => paths.length);
        const names = written.map(([kind]) => kind);
        for (const kind of ["Actor", "ChatMessage", "Token", "Item"]) {
            ok(names.includes(kind), `the scan found no write of ${kind} - it no longer reads the module's writes`);
        }
        const unread = written.flatMap(([kind, paths]) => paths.filter(p => p.read !== "read").map(p => `${kind} at ${p.path} (${p.read})`));
        ok(!unread.length, `the module writes what the dump does not read: ${unread.join("; ")}`);

        for (const row of ENFORCED) foreign.add(`${row.module}.${row.key}`);
        ok(foreign.size >= 3, `the scan found ${foreign.size} settings of other namespaces, and there were three`);
        const missing = [...foreign].filter(full => !DUMP_FOREIGN_SETTINGS.includes(full));
        ok(!missing.length, `the module writes another namespace's setting the dump does not read: ${missing.join(", ")}`);
        ok(!stores.length, `a store the dump does not read: ${stores.join(", ")} - read it in worldDump before it ships`);

        const actor = { _id: "SUITEPROBEACTOR1", name: "Probe", type: "character", system: { hope: 2 }, flags: {},
            items: [], effects: [], _stats: { modifiedTime: 1 } };
        const before = dumpOf("Actor", [actor]);
        const after = dumpOf("Actor", [{ ...actor, system: { hope: 3 }, _stats: { modifiedTime: 2 },
            items: [{ _id: "SUITEPROBEITEM01", name: "Probe item", type: "loot", flags: {}, effects: [] }] }]);
        equal(JSON.stringify(dumpDiff(before, after).map(d => d.path).sort()),
            JSON.stringify(["Actor.SUITEPROBEACTOR1.items.SUITEPROBEITEM01", "Actor.SUITEPROBEACTOR1.system.hope"]),
            "dumpDiff does not report exactly the changed leaf and the added item, or reports the write stamp");
        const gone = dumpDiff(after, before).find(d => d.path === "Actor.SUITEPROBEACTOR1.items.SUITEPROBEITEM01");
        ok(gone && gone.after === undefined, "dumpDiff does not report a unit that went");

        const card = { _id: "SUITEPROBECARD01", content: "<p>probe</p>", rolls: ["{\"total\":7}"], system: { applied: false },
            flags: {}, whisper: [], speaker: {}, author: "SUITEPROBEUSER01", _stats: { modifiedTime: 1 } };
        equal(JSON.stringify(dumpDiff(dumpOf("ChatMessage", [card]),
            dumpOf("ChatMessage", [{ ...card, rolls: ["{\"total\":9}"], system: { applied: true }, _stats: { modifiedTime: 2 } }]))
            .map(d => d.path).sort()),
            JSON.stringify(["ChatMessage.SUITEPROBECARD01.rolls", "ChatMessage.SUITEPROBECARD01.system"]),
            "a card whose rolls and system data were rewritten reads the same to the dump");
    }],

    ["R160 - every way a player reaches the GM belongs to a flow", async () => {
        /*
         * E30, 24.09.2026; audit S17-03. A flow crosses browsers - asked on one, judged
         * on the GM's, shown on a third - so the suite, in one browser, cannot drive one
         * end to end; the harness can, and FLOWS (tests-flows.mjs) says which scenario
         * does, or which stage will write one. That list is only worth anything if
         * nothing reaches the GM outside it: every GM_HANDLERS action and every file
         * that listens on the module's socket belongs to exactly one flow (or is exempt
         * with a reason), and no flow names an action, a file, a game.drpg call or a
         * function that is gone. Read off the bridge's tables (E31: the declarations the
         * runner judges, by their wire names) and `game.socket.on(` in each file served
         * here. On 25.09: 37 actions, 17 listener files. A read of fewer than 37 or 10
         * means the source moved and this measured nothing, and fails as such.
         */
        const sources = new Map(await otherSources());
        // The bridge's tables, read live since E31 (25.09.2026): 33 actions in gm-bridge.mjs, the trap relay's one
        // and the search tokens' three.
        const actions = (await bridgeTables()).flatMap(t => Object.keys(t.table));
        const listeners = [...sources].filter(([, text]) => /game\.socket\.on\(/.test(stripComments(text))).map(([file]) => file);
        ok(actions.length >= 37, `read ${actions.length} bridge actions, and there were 37 - the tables have moved, and this measured nothing`);
        ok(listeners.length >= 10, `read ${listeners.length} files listening on the socket, and there were 16 - this measured nothing`);

        const owners = new Map();
        const claim = (what, id) => owners.set(what, [...(owners.get(what) ?? []), id]);
        for (const flow of FLOWS) {
            for (const action of flow.entry?.bridge ?? []) claim(`bridge ${action}`, flow.id);
            for (const file of flow.entry?.sockets ?? []) claim(`socket ${file}`, flow.id);
        }
        const unclaimed = [...actions.map(a => `bridge ${a}`), ...listeners.filter(f => !(f in FLOW_EXEMPT)).map(f => `socket ${f}`)]
            .filter(what => !owners.has(what));
        ok(!unclaimed.length, `reaches the GM and belongs to no flow (add it to FLOWS in tests-flows.mjs): ${unclaimed.join(", ")}`);
        const twice = [...owners].filter(([, ids]) => ids.length > 1).map(([what, ids]) => `${what} (${ids.join(", ")})`);
        ok(!twice.length, `claimed by more than one flow: ${twice.join("; ")}`);
        const gone = [...owners.keys()].filter(what => what.startsWith("bridge ")
            ? !actions.includes(what.slice(7)) : !listeners.includes(what.slice(7)));
        ok(!gone.length, `a flow names what no longer reaches the GM: ${gone.join(", ")}`);
        const exemptGone = Object.keys(FLOW_EXEMPT).filter(file => !listeners.includes(file));
        ok(!exemptGone.length, `exempt, and not listening on the socket any more: ${exemptGone.join(", ")}`);

        const starts = [];
        for (const flow of FLOWS) {
            for (const name of flow.entry?.api ?? []) if (typeof game.drpg?.[name] !== "function") starts.push(`${flow.id}: game.drpg.${name}`);
            for (const call of flow.entry?.calls ?? []) {
                const [file, fn] = call.split("#");
                if (topLevelFunction(stripComments(sources.get(file) ?? ""), fn) === null) starts.push(`${flow.id}: ${call}`);
            }
        }
        ok(!starts.length, `a flow starts from something that is not there: ${starts.join("; ")}`);
        const shapeless = FLOWS.filter(f => !["covered", "partial", "planned"].includes(f.status)
            || (f.status === "covered" ? !f.scenarios?.length : !/^E\d+$/.test(f.stage ?? "")));
        ok(!shapeless.length, `a flow with no scenario that drives it and no stage to write one: ${shapeless.map(f => f.id).join(", ")}`);
        equal(new Set(FLOWS.map(f => f.id)).size, FLOWS.length, "two flows share an id");
    }],

    ["R161 - who asks, and whether a GM is there, is answered in one leaf, with no import cycle", async () => {
        /*
         * E31, 25.09.2026; audit S01-64, S17-08. `senderOf` and `ownsActor`, the first two
         * questions every road to the GM asks, lived in gm-bridge.mjs, so a file that wanted one
         * of them loaded the whole bridge for it; and "is a GM connected" was written out four
         * times beside `activeGmIds` (gm-bridge, search-tokens twice, diagnostics). They live in
         * bridge-guards.mjs now, which imports config.mjs and utils.mjs only, so any module can
         * take them statically without closing a cycle. This holds that shape: the three names
         * defined there and nowhere else, the predicate spelt only in `activeGmIds`, nothing
         * taking them (or `tellRefused`) from gm-bridge.mjs any more, and no cycle in the static
         * import graph of what Foundry serves. Each reader is shown a planted fault first.
         */
        const PREDICATE = /(?<![!\w.])(\w+)\.isGM\s*&&\s*\1\.active\b|(?<![!\w.])(\w+)\.active\s*&&\s*\2\.isGM\b/g;
        const MOVED = ["senderOf", "ownsActor", "gmOnline", "tellRefused"];
        const definers = (files, name) => [...files].filter(([, text]) =>
            new RegExp(`^(?:export )?(?:async )?function ${name}\\(|^(?:export )?(?:const|let) ${name}\\s*=`, "m").test(text)).map(([file]) => file);
        const takenFromBridge = files => [...files].flatMap(([file, text]) => [...text.matchAll(
            /import\s*\{([^}]*)\}\s*from\s*"\.\/gm-bridge\.mjs"|\{([^}]*)\}\s*=\s*await\s+import\(\s*"\.\/gm-bridge\.mjs"\s*\)/g)]
            .flatMap(m => (m[1] ?? m[2]).split(",").map(part => part.trim().split(/\s+as\s+|\s*:\s*/)[0]))
            .filter(name => MOVED.includes(name)).map(name => `${file}: ${name}`));

        const planted = new Map([
            ["a.mjs", `import { b } from './b.mjs';\nexport function gmOnline() { return game.users.some(u => u.isGM && u.active); }`],
            ["b.mjs", `import { a } from './a.mjs';\nexport { a as c } from './c.mjs';\nconst { ownsActor } = await import("./gm-bridge.mjs");`],
            ["c.mjs", `export const gmOnline = () => false;\nconst later = () => import('./a.mjs');\nconst some = game.users.filter(u => !u.isGM && u.active);`]
        ]);
        equal(JSON.stringify(importCycles(planted)), JSON.stringify([["a.mjs", "b.mjs"]]),
            "the cycle reader does not find exactly the cycle planted for it - it would read the module's graph wrong too");
        equal(JSON.stringify(definers(planted, "gmOnline")), JSON.stringify(["a.mjs", "c.mjs"]),
            "the definition reader does not find both planted definitions");
        equal([...planted.values()].flatMap(text => [...text.matchAll(PREDICATE)]).length, 1,
            "the predicate reader does not find the one planted copy, or reads a player's `!u.isGM` as one");
        equal(JSON.stringify(takenFromBridge(planted)), JSON.stringify(["b.mjs: ownsActor"]),
            "the importer reader does not find the planted import from gm-bridge.mjs");

        const sources = new Map([...await moduleSources()].map(([file, text]) => [file, stripComments(text)]));
        must(sources.has("bridge-guards.mjs") && sources.has("gm-bridge.mjs") && sources.has("utils.mjs"),
            "bridge-guards.mjs, gm-bridge.mjs or utils.mjs is not served - this test reads nothing until they are");
        const served = new Map([...sources].filter(([file]) => !/^tests(-[\w-]+)?\.mjs$/.test(file)));
        equal(JSON.stringify(staticImports(sources.get("bridge-guards.mjs")).sort()), JSON.stringify(["config.mjs", "utils.mjs"]),
            "bridge-guards.mjs imports something besides config.mjs and utils.mjs, and could close a cycle");
        for (const name of ["senderOf", "ownsActor", "gmOnline"]) {
            equal(JSON.stringify(definers(served, name)), JSON.stringify(["bridge-guards.mjs"]),
                `${name} is defined somewhere other than bridge-guards.mjs - a second copy of a guard is the one that drifts`);
        }
        const spelt = [...served].flatMap(([file, text]) => [...text.matchAll(PREDICATE)].map(m => `${file}:${lineAt(text, m.index)}`));
        ok(spelt.length === 1 && spelt[0].startsWith("utils.mjs:") && [...fnSource(served.get("utils.mjs"), "activeGmIds").matchAll(PREDICATE)].length === 1,
            `"a GM who is connected" is spelt out somewhere other than activeGmIds in utils.mjs: ${spelt.join(", ")}`);
        const taken = takenFromBridge(served);
        ok(!taken.length, `these still take the leaf's names from gm-bridge.mjs: ${taken.join(", ")}`);
        const cycles = importCycles(sources);
        ok(!cycles.length, `the static import graph of the served files has a cycle: ${cycles.map(c => c.join(" <-> ")).join("; ")}`);
        log(`R161: ${sources.size} served files, ${[...sources.values()].reduce((n, text) => n + staticImports(text).length, 0)} static imports, 0 cycles`);
    }],

    ["R163 - a run reads exactly what its whitelist lets through", async () => {
        /*
         * E31, 25.09.2026; audit S17-08. Each declaration's run is handed a copy of
         * the packet with only the fields its `sanitize` lists (`pick`,
         * bridge-guards.mjs). A field left off that list is not refused - it arrives
         * as nothing: leave `unseenTotal` off Palm's list and every Palm scores its
         * unseen roll as 0 and is seen, a legal road that "works" with the wrong
         * result and that no refusal check notices (the E31 design's L2). So the
         * reads of `payload` in each run, in the functions it hands `payload` to, and
         * in its `runGuards`, must be exactly the fields its list names, and a read
         * this cannot follow - `payload[...]`, `...payload`, the packet destructured
         * - fails rather than being skipped. The reader is shown planted faults first.
         */
        const G = await import("./bridge-guards.mjs");
        const problemsOf = (label, decl, lookup) => {
            const r = payloadReads(decl, lookup);
            const listed = Object.keys(decl.sanitize?.fields ?? {}).sort();
            const out = [];
            if (r.unreadable.length) out.push(`${label}: its run reads the packet as ${r.unreadable.join(", ")}, which this cannot follow`);
            const dropped = r.fields.filter(field => !listed.includes(field));
            if (dropped.length) out.push(`${label}: its run reads ${dropped.join(", ")}, which its whitelist drops`);
            const unread = listed.filter(field => !r.fields.includes(field));
            if (unread.length) out.push(`${label}: its whitelist lets ${unread.join(", ")} through, and nothing reads it`);
            return out;
        };
        const helperFixture = (sender, payload) => payload.stray;
        const planted = [
            ...problemsOf("fixture.read", { run: async (payload, sender, ctx) => { await helperFixture(sender, payload); return payload.known; },
                sanitize: G.pick({ known: G.as.num, unread: G.as.num }) }, name => name === "helperFixture" ? String(helperFixture) : null),
            ...problemsOf("fixture.computed", { run: (payload, sender, ctx) => payload[ctx.field], sanitize: G.pick({}) }, () => null)
        ];
        equal(JSON.stringify(planted), JSON.stringify([
            "fixture.read: its run reads stray, which its whitelist drops",
            "fixture.read: its whitelist lets unread through, and nothing reads it",
            "fixture.computed: its run reads the packet as payload[...], which this cannot follow"
        ]), "the whitelist reader does not find exactly the faults planted for it");

        const leaf = stripComments(new Map(await otherSources()).get("bridge-guards.mjs") ?? "");
        must(leaf.length > 1000, "bridge-guards.mjs did not load");
        const problems = [];
        let runs = 0, handed = 0;
        for (const { file, table, text } of await bridgeTables()) {
            for (const [action, decl] of Object.entries(table)) {
                runs++;
                const lookup = name => topLevelFunction(text, name) ?? topLevelFunction(leaf, name);
                handed += payloadReads(decl, lookup).handedTo.filter(name => lookup(name)).length;
                problems.push(...problemsOf(`${file} ${action}`, decl, lookup));
            }
        }
        log(`R163: ${runs} runs read, and ${handed} functions they hand their payload to`);
        ok(runs >= 37, `only ${runs} runs were read - the tables are not where this test looks`);
        ok(!problems.length, `a run and its whitelist disagree: ${problems.join("; ")}`);
    }],

    ["R164 - every refusal the bridge can give maps to one reason of a closed list", async () => {
        /*
         * E31, 25.09.2026; audit S17-08. A refused request tells its player why with
         * a code of the closed list in bridge-guards.mjs (`REASONS`), which `reasonOf`
         * reads off the English reason the guard or the run gave, with an ordered
         * list of anchored patterns. A reason no pattern takes is still refused, and
         * the player hears only "the GM's client refused it" - the sentence that
         * says nothing, and a failure nobody would see. So every reason the bridge
         * can give is read out of the source and held to exactly one pattern (two
         * would make the answer depend on their order), and a pattern no reason
         * reaches is dead.
         *
         * WHERE THE REASONS ARE: the guards the tables name, and every guard the
         * leaf exports (a run asks some itself); the runs, and the functions of
         * their own file they call; the functions a guard or a run hands the
         * question to (DELEGATES, below), wherever they are declared; the reasons
         * the factories' guards carry (`owns`, `inRange`, ...: read off the live
         * guards, not their text); and the runner's own. `refusalProblems` (the
         * kit) reads them, and says what it cannot read rather than skipping it: a
         * returned value that is not a literal or a listed function's answer, and a
         * `...Refusal(` function nobody listed - so a new one cannot be missed.
         *
         * WHAT IT CANNOT SEE: a name that takes its reason from a function that is
         * not on the list, in a function that also asks one that is (it takes the
         * name for the listed one's answer), and a reason built outside the places
         * a reason stands. The reader is shown planted faults first.
         */
        const G = await import("./bridge-guards.mjs");
        const planted = refusalProblems({
            functions: [
                { name: "guardOne", reads: "returns", source: 'function guardOne(sender, payload) { return payload.x ? null : "fixture: one"; }' },
                { name: "guardNone", reads: "returns", source: 'function guardNone(sender, payload) { return "fixture: none"; }' },
                { name: "guardName", reads: "returns", source: "function guardName(sender, payload) { const why = String(payload.x); return why; }" },
                { name: "guardUnlisted", reads: "returns", source: "function guardUnlisted(sender, payload) { return payload.x ? null : fixtureRefusal(payload); }" },
                { name: "guardTwice", reads: "returns", source: "function guardTwice(sender, payload) { return `fixture: ${payload.n} twice`; }" },
                { name: "guardNamed", reads: "returns", source: "function guardNamed(sender, payload) { return `${sender.name} fixture: named`; }" },
                { name: "run", reads: "refused", source: 'async function run(payload) { const r = await fixtureResolve(payload); if (r?.refused) return { refused: r.refused }; return { refused: "fixture: one" }; }' }
            ],
            delegates: new Set(["fixtureResolve"]),
            patterns: [["one", /^fixture: one$/], ["two", /^fixture: .+ twice$/], ["twoAgain", /twice$/], ["idle", /^fixture: never$/],
                ["named", / fixture: named$/]],
            reasons: ["one", "two", "twoAgain", "idle", "named"]
        });
        equal(JSON.stringify(planted.problems), JSON.stringify([
            'guardName: returns "why", which this reader cannot hold to a reason',
            "guardUnlisted: calls fixtureRefusal(), which is not on the list of functions a refusal is handed to",
            'guardNamed: returns a reason that begins with a value put into it, "${} fixture: named"',
            'guardNone: "fixture: none" is taken by no reason of the closed list',
            'guardTwice: "fixture: 7 twice" is taken by 2 patterns (two, twoAgain)',
            "idle: no reason read takes its pattern - it is dead, or a reason moved out of its reach"
        ]), "the reason reader does not find exactly the six faults planted for it - it would misread the module too");

        /* The functions a guard or a run hands the question to, and how each is read:
           its return value is the reason, its `why:` or its `refused:`. Two pass on a
           listed function's reason (`resolveObserve` observeResolveRefusal's, the
           receipt's `spendRerollReceipt` rerollReceiptRefusal's or its caller's check),
           and one is wrapped: `hopeCallRefusal` says, in the GM's language, what the
           guard asking it puts inside its own English reason. */
        const DELEGATES = {
            rerollReceiptRefusal: "returns", crisisRefusal: "why", crisisUndoRefusal: "returns", unsabotageRefusal: "returns",
            sendBackRefusal: "returns", playerArmRefusal: "returns", observeResolveRefusal: "returns", removalRefusal: "returns",
            searchSpendRefusal: "returns", narrowPlayerRemnant: "refused", resolveAnalyze: "refused", resolveStageSix: "refused",
            resolveObserve: "passes", spendRerollReceipt: "passes", hopeCallRefusal: "wraps"
        };
        const sources = [...await otherSources()].map(([file, raw]) => [file, stripComments(raw)]);
        const functions = [], texts = [];
        for (const [name, reads] of Object.entries(DELEGATES)) {
            const found = sources.map(([file, text]) => [file, topLevelFunction(text, name)]).filter(([, fn]) => fn);
            must(found.length === 1, `${name} is declared in ${found.length} files - the list of functions a refusal is handed to names one that moved`);
            if (reads !== "passes" && reads !== "wraps") functions.push({ name: `${found[0][0]} ${name}`, source: found[0][1], reads });
        }

        const tables = await bridgeTables();
        const guards = new Set();
        for (const { table } of tables) for (const decl of Object.values(table)) for (const guard of [...decl.guards, ...(decl.runGuards ?? [])]) guards.add(guard);
        for (const [name, value] of Object.entries(G)) if (typeof value === "function" && /^guard[A-Z]/.test(name)) guards.add(value);
        let factories = 0;
        for (const guard of guards) {
            if (!guard.factory) { functions.push({ name: guard.name, source: String(guard), reads: "returns" }); continue; }
            factories++;
            const why = typeof guard.why === "function" ? guard.why(7) : guard.why;
            must(typeof why === "string" && why.length > 0, `a ${guard.factory} guard carries no reason - the factories no longer say what they refuse with`);
            texts.push({ text: why, from: `a ${guard.factory} guard` });
        }
        for (const { file, table, text } of tables) {
            const seen = new Set();
            const queue = Object.values(table).map(decl => decl.run.name);
            for (const name of queue) must(topLevelFunction(text, name), `${file}: the run ${name || "(unnamed)"} is not a function of its own file - this reads nothing of it`);
            while (queue.length) {
                const name = queue.shift();
                if (seen.has(name)) continue;
                seen.add(name);
                const source = topLevelFunction(text, name);
                if (!source) continue;
                functions.push({ name: `${file} ${name}`, source, reads: "refused" });
                for (const m of stripStrings(source).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) queue.push(m[1]);
            }
        }
        const leaf = sources.find(([file]) => file === "bridge-guards.mjs")?.[1] ?? "";
        functions.push({ name: "bridge-guards.mjs judge", source: fnSource(leaf, "judge"), reads: "refuse" });

        const read = refusalProblems({ functions, texts, delegates: new Set(Object.keys(DELEGATES)), patterns: G.REASON_PATTERNS, reasons: G.REASONS });
        const distinct = new Set(read.texts.map(t => t.text)).size;
        log(`R164: ${distinct} reasons read, in ${read.texts.length} places: ${functions.length} functions and ${factories} factory guards; `
            + `${read.byCode.size} of the ${G.REASONS.length} codes take them`);
        ok(G.REASON_PATTERNS.every(([, pattern]) => pattern.source.startsWith("^")), "a reason's pattern is not anchored at the start");
        // And begins with a word or a quote, not a wildcard or a class: a value in front of a reason's words could
        // choose a pattern that did.
        const wildStart = patterns => patterns.filter(([, pattern]) => !/^\^(?:[A-Za-z"]|\(\?:[A-Za-z])/.test(pattern.source))
            .map(([code]) => code);
        equal(JSON.stringify(wildStart([["a", /^.+ tail$/], ["b", /^head .+$/], ["c", /^".*" tail$/], ["d", /^\w+ tail$/],
            ["e", /^(?:x|y) tail$/]])), JSON.stringify(["a", "d"]),
            "the reader of the patterns' first words does not find the two planted for it");
        equal(JSON.stringify(wildStart(G.REASON_PATTERNS)), "[]", "a reason's pattern begins with a wildcard, which a value could fill");
        ok(distinct >= 75, `only ${distinct} reasons were read - the reader has lost the guards, the runs or the functions they ask`);
        ok(!read.problems.length, `the bridge's reasons: ${read.problems.join("; ")}`);
    }]
];

export { REGRESSIONS };
