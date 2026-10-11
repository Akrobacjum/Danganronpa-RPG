/**
 * Danganronpa RPG - tier 0 of the suite: the module's own source, read (E30, audit S17-02).
 * ---------------------------------------------------------------------------
 * REGRESSIONS, and the name analysis only R21 and R22 use. The runner is in
 * tests.mjs; the tools are in tests-kit.mjs.
 */

import { MODULE_ID, moduleVersion, CRISIS_ACTIONS, ACTIONS, SFX_EVENTS, CRITICAL, CLEANUP, MURDER_OPENING, KEY_REMNANTS, OBSERVE_DC, ANALYZE_DC, REMNANT_TYPES, OBSERVE_TYPE_ALIAS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { studentActors } from "./monokuma.mjs";
import { log } from "./utils.mjs";
import {
    ok, needs, env, world, equal, must, wait, moduleSources, otherSources, stripComments, moduleStyles, bodyOf,
    topLevelFunction, fnSource, lineAround, withGuards, lineAt, stripStrings, stringLiterals, STANDING, cast,
    markerProblem, runOne, stageLedger, suiteEntries, KIT_SELF_TESTS, SELF_LEDGER, MARKER_FIXTURE,
    scanSuite, bareCuts, vacuousAsserts, needsArgs, LINT_FIXTURES, UNTIL_FIXTURE, untilProblem, DUMP_RULES,
    DUMP_FOREIGN_SETTINGS, dumpOf, dumpDiff, dumpPathsOf, FLOWS, FLOW_EXEMPT, staticImports, importCycles,
    bridgeTables, bridgeTableProblems, payloadReads, refusalProblems, storeKeyAccess, GM_STORE_PENDING, blankComments, blankLiterals, callArgs
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
         * search-tokens.mjs; since E06 C5a ROLL_ACTIONS in private-rolls.mjs,
         * whose one report names its message by a guard's claim), judged by one runner: who really
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
         * reply, and a field named as an id is sanitized as one. The reader is run
         * first on a fixture with six planted faults, which must come back
         * exactly (seven until E08+E28 C8 retired the Reroll receipts, and the
         * rule that a guard spending one comes last with them).
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
            "fixture.tell": { label: "DRPG.Bridge.what.fixture.tell", guards: [G.knownSender],
                sanitize: G.pick({ n: G.as.num }), run: fine, answer: "ack", tell: "fixtureNowhere" },
            "fixture.queued": { label: "DRPG.Bridge.what.fixture.queued", guards: [G.knownSender],
                sanitize: G.pick({ n: G.as.num }), run: fine, answer: "ack", queue: "fixture" },
            "fixture.textId": { label: "DRPG.Bridge.what.fixture.textId", guards: [G.knownSender],
                sanitize: G.pick({ targetId: G.as.text }), run: fine, answer: "ack" }
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
            "fixture.mjs fixture.tell: it tells its refusals as \"fixtureNowhere\", which is not a code of the closed list",
            "fixture.mjs fixture.queued: it waits in the \"fixture\" queue, is acknowledged as it arrives, and answers \"ack\", not reply",
            "fixture.mjs fixture.textId: targetId names an id and is sanitized as text, not as.id",
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
            "incident-store.mjs": "a participant's request is answered by the primary GM alone, from the sender's own seat in the cast; the cast copy is taken only from a GM, and only where newer, part by part; a player's ask for the deaths is answered by the primary GM alone, about Foundry's sender, and a copy of them or a finder's notice is taken only from a GM, addressed to this user",
            "mastermind.mjs": "the door request is answered by the primary GM alone, about Foundry's own sender and nobody in the packet; the door flag is taken only from a GM, and only where newer, part by part",
            "secret.mjs": "a card's words, taken from a player only for a message that player wrote, and cleaned; no character is acted on",
            "fog.mjs": "fog.request answers the sender's own rows; fog.shared is taken only while the primary's question is open, cut to the characters the sender owns, weak and fill-only",
            "sync.mjs": "world-state fan-out from a GM; carries no actor id",
            "safeword.mjs": "trusts nothing from the packet but the room it shows the GMs as text; the name is the connected sender's, and the primary posts one public card per player per window, naming nobody",
            "dice-sync.mjs": "dice appearance only; no actor anywhere in it",
            "sfx.mjs": "plays a sound; no actor anywhere in it",
            "voice.mjs": "room membership, keyed by the sender",
            "voice-client.mjs": "room membership, keyed by the sender",
            // E31 review: it passed on text elsewhere in the file (the runner, the guards); this is its own reason.
            "bridge-guards.mjs": "the answers to this client's own requests: taken only from a GM, for its own pending id; acts on no actor"
            // E10 C2 (1.2.71): vote.mjs is off the list. A ballot reaches the GMs on the bridge (`vote.cast`), and
            // the one packet its listener still takes, a GM's ballot, names no id.
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

        /*
         * AND A PLAYER'S COPY IS TAKEN FROM A GM ALONE (E05 C13, 27.09.2026). A copy's
         * listener reads no id out of the packet - Foundry addresses it, and what it
         * carries is the answer - so the reading above passes it without looking. Which
         * traces a player's own bullets came from is such a copy (truth-bullets.mjs,
         * `bulletRefCopy`), and a player able to hand another one would show them traces
         * they never found: its handler takes an answer only through `replyForMe`
         * (addressed to this user, sent by a GM), or asks Foundry's sender itself. The
         * incident's dice are another (E06 C6): `dice.show` plays a roll on this screen, and
         * only the primary GM knows whose roll it is and who is in the incident, so
         * private-rolls.mjs's `showRelayedDice` takes it from a GM alone.
         */
        const FROM_GM = /\breplyForMe\(payload, senderId\)|\bgame\.users\.get\(senderId\)\?\.isGM\b/;
        const COPY_LISTENERS = [["truth-bullets.mjs", "onBulletRefsSocket"], ["private-rolls.mjs", "showRelayedDice"]];
        const served = new Map(await otherSources());
        const trusting = COPY_LISTENERS.filter(([file, fn]) => !FROM_GM.test(fnSource(stripComments(served.get(file) ?? ""), fn)))
            .map(([file, fn]) => `${file} ${fn}`);
        ok(!trusting.length, `these take a player's copy from whoever sent it, not from a GM: ${trusting.join(", ")}`);
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
         * question asked of every store the module registers, and of every
         * actor's, user's, token's and chat message's flags.
         *
         * THE RULE IS ITS OWN FILE SINCE E05 (C2, 26.09.2026; the stage's
         * verify). scripts/world-secrets.mjs says what world data may never
         * hold - this test's own five answer-key names were its first line, and
         * projectMeta's killer, builder, condition and trigger its second (C1,
         * S09-05: this test called them "known and deliberate" until then; E05's
         * fix round added who sabotaged a project, S1-m1) -
         * and R190 shows it finding each on a fixture. Since C5 the answer-key
         * names are nine - the Key Remnant plan's analysis, analyzedText, note
         * and tokenId joined them - and projectMeta's own map token is the one
         * tokenId a setting may hold (its reason is in the rule). Here it reads
         * this world: every module world setting, and the module's flags on
         * every actor, user, token and chat message, and on every token's own actor
         * data (its delta). A rule comes in with the commit that takes its secret
         * out of world data; E05's later commits add theirs. The messages and the
         * deltas since E05's fix round (S1-m3, S1-m4, 27.09.2026): measured first by a
         * probe that planted a card with a `summary` flag and an unlinked token whose
         * delta held a `lastAction`, R9 passed over both before and named both after.
         * The items - the sidebar's and every actor's - since E05 C13, with the rule's
         * first Item flag (a bullet's `remnantRef`).
         */
        const { findWorldSecrets, WORLD_SECRET_RULES } = await import("./world-secrets.mjs");
        const { PROJECT_SECRET_FIELDS } = await import("./projects.mjs");
        equal(JSON.stringify([...(WORLD_SECRET_RULES.settings.projectMeta?.fields ?? [])].sort()), JSON.stringify([...PROJECT_SECRET_FIELDS].sort()),
            "the world-secrets rule for projectMeta is not the fields projects.mjs keeps on the GMs' side (PROJECT_SECRET_FIELDS)");
        const settings = {};
        for (const [full, def] of game.settings.settings) {
            if (!full.startsWith(`${MODULE_ID}.`) || def.scope !== "world") continue;
            const key = full.slice(MODULE_ID.length + 1);
            try { settings[key] = game.settings.get(MODULE_ID, key); } catch { continue; }
        }
        ok(Object.keys(settings).length > 0, "no module world setting was read - this measured nothing");
        const flagsOf = doc => ({ id: doc.id, flags: doc.flags ?? {} });
        const found = findWorldSecrets({
            settings,
            actors: game.actors.contents.map(flagsOf),
            users: game.users.contents.map(flagsOf),
            // `toObject()` for the delta: a token's own actor data is a document of its own in
            // Foundry, and its source is what every browser was sent.
            tokens: game.scenes.contents.flatMap(scene => scene.tokens.contents.map(t => {
                const delta = t.toObject()?.delta;
                return { id: `${scene.id}.${t.id}`, flags: t.flags ?? {}, delta: delta ? { flags: delta.flags ?? {} } : null };
            })),
            // E06 C1: with what a `messages` rule reads - the source's speaker, system, rolls, whisper and author.
            messages: (game.messages?.contents ?? []).map(m => {
                const { speaker, system, rolls, whisper, author } = m.toObject();
                return { ...flagsOf(m), speaker, system, rolls, whisper, author };
            }),
            // An item by its uuid, which says whose sheet it is on.
            items: [...(game.items?.contents ?? []), ...game.actors.contents.flatMap(actor => actor.items?.contents ?? [])]
                .map(item => ({ id: item.uuid, flags: item.flags ?? {} }))
        });
        ok(!found.length, `these are on every player's machine right now: ${found.map(h => `${h.doc} ${h.id} :: ${h.path} - ${h.rule}`).join("; ")}`);
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
        const murder = stripComments(sources.get("murder-rules.mjs") ?? "");
        ok(murder.length > 1000, "murder-rules.mjs did not load");

        const capture = murder.match(/const\s+swung\s*=([^;]*);/);
        ok(capture, "murder-rules.mjs no longer captures a swung weapon at all");

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
        /* E11 C13 (11.10.2026): the window's form is `chapterEndForm`, whose `box(name, n)` helper writes the
           `<input name=...>` once for every box, so the box is named at its call and not in a literal. */
        ok(/name="endTrial"/.test(chapter) || /\bbox\("endTrial"/.test(chapter),
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
        const world = stripComments(sources.get("call-world.mjs") ?? "");
        const check = bodyOf(chapter, "async function checkBodyFound", { until: "export async function openBodyDiscoveryDialog" });
        ok(check.length > 200, "checkBodyFound is gone or has moved past openBodyDiscoveryDialog");
        // Since E11 C1 (1.2.73) the body rule is `bodiesToDiscover`, which checkBodyFound asks and R347 holds case by case.
        const rule = bodyOf(chapter, "export function bodiesToDiscover", { until: "export function witnessesOf" });
        ok(/bodiesToDiscover\(/.test(check), "checkBodyFound decides what a body is itself again");
        ok(/FLAGS\.monocub/.test(rule), "a Monocub counts as a body again");
        ok(/clock\.chapter/.test(rule) && /record\?\.chapter/.test(rule), "a body from an earlier chapter counts as a body again");
        ok(/export function discoverBody[\s\S]{0,240}enqueueBodyWork\(/.test(chapter),
            "the GM's own announcement no longer waits in the discovery queue");
        ok(/export function maybeBodyFound[\s\S]{0,240}enqueueBodyWork\(/.test(chapter),
            "the automatic discovery check no longer waits in the discovery queue");
        const gather = fnSource(world, "gatherEveryone");
        ok(/(?:isDeceased|isDeadForGm)\(/.test(gather), "gatherEveryone moves the dead again");
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
        // Cut at `keyRowShows` since E09 C16, which took `stripDraft` out with Save's placing.
        const plan = bodyOf(inv, "async function saveKeyPlan", { until: "function keyRowShows" });
        ok(plan.length > 200, "saveKeyPlan is gone or has moved past keyRowShows");
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
         *
         * E09 C7 (08.10.2026; S05-16, S05-36) took the charge off the planner altogether:
         * `keyFeeOf` counts every Key Remnant of the chapter a living student holds a copy
         * of, off the items the GMs hold, against the case's own count where that is under
         * four, and the charge's "too late" reads the closed cases - so a Save of the planner
         * decides nothing (tier 2's "the Key fee is the same with Save and without"). The
         * planner's own table still scores its rows (`keyPlanStatus`, a display).
         *
         * E09 fix r1-G3 (08.10.2026; the round-1 reviews' F2 and the goal review's S05-16): a
         * copy whose trace is gone is dated by the chapter its answer key names, not by the
         * item's stamp, which its holder writes and no audit judges (tier 2, "a Key copy whose
         * trace is gone counts in the chapter its answer key names ..."), which a handover's copy
         * takes from the giver's answer key (handover.mjs `shareBullet`), not from the giver's
         * item; and the planner's finders are the living for the GMs, as the fee's are (tier 2,
         * "a dead student's find is not found on the Key tab"). Red before the fix: the fee read
         * the item's flag, `shareBullet` named no `foundIn`, and `findersByRemnant` walked
         * `studentActors`.
         */
        const inv = stripComments(new Map(await otherSources()).get("investigation.mjs") ?? "");
        const status = bodyOf(inv, "export function keyPlanStatus", { until: "export async function keyFeeOf" });
        ok(status.length > 400, "keyPlanStatus is gone or has moved past the fee");
        ok(/offPlan/.test(status) && /foundAny/.test(status),
            "keyPlanStatus counts the plan's rows only again");
        const fee = bodyOf(inv, "export async function keyFeeOf", { until: "export async function chargeForUnfoundKeys" });
        ok(/judgedFor\(/.test(fee) && /itemsHeldNow\(/.test(fee) && !/\b(?:bulletsOf|keyPlan|keyPlanStatus|chapterRows|findersByRemnant)\(/.test(fee),
            "the fee counts off the documents or the planner's rows again instead of the items the GMs hold");
        ok(/Math\.min\(KEY_REMNANTS\.unfoundBar/.test(fee) && /caseKeyCount\(/.test(fee),
            "the fee's bar is four again whatever the case's own count");
        ok(!/TRUTH_BULLET_FLAGS\.chapter|\.getFlag\(/.test(fee) && /secret\.chapter\b/.test(fee),
            "the fee dates a copy whose trace is gone by the item's own stamp again, which its holder writes, not by its answer key");
        const finders = topLevelFunction(inv, "findersByRemnant") ?? "";
        ok(/\blivingStudentsForGm\(/.test(finders) && !/\bstudentActors\(/.test(finders),
            "the planner's finders walk every student again, the dead for the GMs among them, while the fee counts the living");
        const share = topLevelFunction(stripComments(new Map(await otherSources()).get("handover.mjs") ?? ""), "shareBullet") ?? "";
        ok(/\bfoundIn:\s*secret\.chapter\b/.test(share),
            "a handover's copy is dated by the giver's item, which the giver writes, and not by the giver's answer key");
        const charge = topLevelFunction(inv, "chargeForUnfoundKeys") ?? "";
        ok(/keyFeeOf\(/.test(charge) && !/\b(?:keyPlanStatus|plannedChapters|chapterRows|keyPlan)\(/.test(charge),
            "the charge reads the planner again, so a Save of it decides what is billed");
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
        const socket = bodyOf(bridge, "async function handleCleanup(", { until: "async function handleCubAbility(" });
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

        // The whole function, not its first 6000 characters: E32+E07 C16 (03.10.2026) grew it
        // and pushed `priced?.blocked` to 6365, and this read a refusal that was still there as gone.
        const button = bodyOf(sheet, "function actionButton(", { until: "function callsGmFor(" });
        ok(/const affordable = priced \? !priced\.blocked/.test(button),
            "a priced tile is dimmed by its action step rather than by the whole chain");
        ok(button.includes("stripeKindFor("),
            "the stripe no longer follows the step that pays");
        ok(button.includes("priced?.blocked"),
            "the tile's refusal is back to counting pips instead of printing the chain's reason");

        // The killer's own night, said once: the skip list, shared with the charge - read through
        // `tamperQuote` since E32+E07 fix r2-G3, which also knows the critical's free attempt.
        ok(sheet.includes("tamperQuote("),
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
        // In truth-bullets.mjs `publishReading` since E09 C8: the write Analyze and the chapter's reveal share.
        const tb = stripComments(sources.get("truth-bullets.mjs") ?? "");
        const publish = bodyOf(tb, "export async function publishReading(");
        ok(/secret\.analyzedText\s*\|\|\s*remnantPublic(?:ById)?\(/.test(publish),
            "publishing a reading no longer asks the trace when a bullet's secret holds no reading");

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

        /*
         * THE ORDER IS DATA (E11 C9, 10.10.2026; audit S06-15, S06-58). Until C9 the steps were
         * read out of the wipe's source by two regexes, and the order was nobody's: `deaths`
         * ran before `incident`, so the close that ran last could write about a crime into the
         * season that had just been cleared. `RESET_STEPS` is the order now, read as the value
         * it is - every group once, the incident first, the clock last, the Calls before the
         * clock and the chat after every step that could post a card.
         */
        const setup = stripComments(sources.get("season-setup.mjs") ?? "");
        const wipe = bodyOf(setup, "async function wipeSeason");
        const { RESET_STEPS, RESET_CHOICES } = await import("./season-setup.mjs");
        ok(Array.isArray(RESET_STEPS), "season-setup.mjs does not export the reset's order as RESET_STEPS");
        const steps = RESET_STEPS ?? [];
        equal(new Set(steps).size, steps.length, "a group runs twice in RESET_STEPS");
        for (const { key } of groups) {
            ok(steps.includes(key), `the reset has no step for the group "${key}", so its tick does nothing`);
        }
        // A step the window asks for by a choice, not a tick (E11 C10b, `placeCast`): its choice's
        // "stay" is the exception, so it is held to the choices and not to the groups.
        for (const key of steps) {
            ok(groups.some(group => group.key === key) || (RESET_CHOICES ?? []).includes(key),
                `the reset clears "${key}" and no group offers it, so it cannot be excepted`);
        }
        equal(steps[0], "incident", "the reset clears something before it abandons the incident, which could write about it");
        equal(steps.at(-1), "clock", "the clock is not the reset's last step, so a later one runs on last season's clock");
        const at = key => steps.indexOf(key);
        for (const key of steps.filter(key => !["cards", "chatRest", "clock"].includes(key))) {
            ok(at(key) < at("cards") && at(key) < at("chatRest"),
                `the chat is cleared before "${key}", so a card that step posts outlives the reset`);
        }

        /*
         * Each key's run is a member of `runs` in wipeSeason, and that half is still read from
         * the source: the runs close over the plan and this browser's stores, so they are not
         * a value a test can import without running a reset. A key with no run throws at its
         * step and is reported as failed; this says so before a GM ever meets it.
         */
        const runs = bodyOf(wipe, "const runs = {", { until: "\n    };" });
        const ran = new Set([...runs.matchAll(/^ {8}(\w+): /gm)].map(m => m[1]));
        ok(ran.size >= 20, `only ${ran.size} runs read in wipeSeason - the source was not read`);
        for (const key of steps) ok(ran.has(key), `the group "${key}" is in RESET_STEPS and wipeSeason has no run for it`);
        for (const key of ran) ok(steps.includes(key), `wipeSeason has a run for "${key}" that no step asks for`);
        ok(/for \(const key of RESET_STEPS\) await step\(key\)/.test(wipe),
            "wipeSeason does not walk RESET_STEPS in order");
        /* And the incident's run abandons it (S06-15): read in the source too, because no world can show it -
           the cut, written first, takes the cast before the close reads it (65 R4's note), so a reset that
           concluded the incident would kill and register nobody in any scenario. Tier 2 "a reset abandons an
           incident: ..." holds what `conclude: false` does; this holds that the reset passes it. */
        ok(/endMurder\(\{[^}]*\bconclude: false\b[^}]*\}\)/.test(bodyOf(runs, "incident:", { until: "seals:" })),
            "the reset's incident step concludes the incident it should abandon (endMurder without conclude: false)");
        // A step that fails is told (S06-49's report, the plan's 3.4): the line and the card.
        for (const key of ["DRPG.Season.failed", "DRPG.Season.reportCard.title", "DRPG.Season.reportCard.failed"]) {
            ok(game.i18n.has(key), `${key} is missing`);
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

        // A list since E10 C5 (09.10.2026): the console also wakes on `userConnected`, the one thing
        // that changes when the GM giving a verdict leaves (vote.mjs `verdictStopped`).
        ok(/hooks: \[[^\]]*"drpgBallotsChanged"/.test(manage), "the console stopped watching for a ballot");
        ok(!/watch: \{[^}]*settings:/.test(manage),
            "the console's watch was narrowed to a list of settings, so the floor and the trial "
            + "record no longer wake it");

        const view = bodyOf(ui2, "function trialConsoleHtml(", { until: "function trialSignature(" });
        ok(view.includes("DRPG.Floor.holdingDebateOver") && view.includes("Math.max(left, 0)"),
            "an overrun mode prints a clock running backwards again");

        // `drpgBallotsChanged` is 1.2.47's name for this event, fired where a
        // ballot is cast, a vote opens and voters are reminded; F8 adds the close.
        // Since E10 C1 (1.2.71) a ballot is a row of the GMs' store and the count is
        // the primary's `closeRound`, which writes the vote closed before it counts;
        // since E10 C2 a ballot is recorded by the bridge's run (`recordBallot`).
        const vote = stripComments(sources.get("vote.mjs") ?? "");
        const EMIT = 'Hooks.callAll("drpgBallotsChanged")';
        ok(vote.split(EMIT).length - 1 >= 4,
            "one of the four vote events stopped being reported");
        const cast = fnSource(vote, "recordBallot");
        ok(cast.length > 200 && cast.includes(EMIT), "recordBallot is gone, or no longer reports a ballot");
        ok(cast.includes("ballotStore.patch(") && cast.indexOf("ballotStore.patch(") < cast.indexOf(EMIT),
            "the ballot is reported before it is in the tally, so a listener redraws the stale list");
        const close = fnSource(vote, "closeRound");
        ok(close.length > 200 && close.includes(EMIT), "closeRound is gone, or no longer reports the closing");
        ok(close.indexOf("open: false") > 0 && close.indexOf("open: false") < close.indexOf(EMIT),
            "the vote is reported closed before the record says it is");
        ok(close.indexOf(EMIT) < close.indexOf("nobodyVoted"),
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
        const murderSrc = stripComments(new Map(await otherSources()).get("murder-ui.mjs") ?? "");
        /* E34 C8 (1.2.70): this read ran on to `rollOpening`, which moved to murder-rules.mjs; it ends at the
           window's own closing brace now - the window alone, which is all R59 asserts on. Not fnSource: its cut runs on
           into the tracker's `lastReask` and `REASK_COOLDOWN_MS` lines, and a cut a test reads by name is one
           moved-only's cuts part holds to the base. C9 made the read fnSource's, each of C8 and C9 green on its own,
           and over the family's whole range (e12ca46 to a5e5fed) moved-only read that cut 5611 -> 5680 characters, red
           (the round-2 review's m5). Fix r2-G2 (08.10.2026) put C8's read back: 14783 characters with comments
           stripped, in murder.mjs at C8 and in murder-ui.mjs since C9. */
        const dialog = bodyOf(murderSrc, "export async function openMurderDialog", { until: "\n}\n" });
        ok(dialog.length > 500, "openMurderDialog is gone from murder-ui.mjs, or its read ends too soon to be the window");

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
        /* E05 C10 adds the deaths store's hook: a death nobody has found writes no actor, and a
           hook more widens the net - a `settings` filter is what would narrow it. */
        ok(/watch: \{ actors: true(?:, hooks: \[[^\]]*\])? \}/.test(window),
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
         *
         * E32+E07 C13, 03.10.2026 (audit S10-77, the owner's D13): the last two are
         * `incidentVictimDied`'s, which the repair calls as well - a victim marked
         * dead from the list in the fight offers Stage 6. The order is read across
         * the two, and the repair is read calling the helper and not the procedure.
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

        const kill = bodyOf(chapter, "export async function killCharacter", { until: "export async function incidentVictimDied" });
        ok(kill.length > 400, "killCharacter has moved or gone");
        ok(/await markDeceased\(actor\)/.test(kill),
            "killCharacter writes the deceased flag itself again, so there are two answers "
            + "to what deceased means");
        /* E05 C10: the bullets' deletion is `destroyBullets`, which the publication of a death kept
           by the GMs (`publishDeath`) runs too - still before the flag, the card and the traces. */
        const order = ["destroyBullets(", "markDeceased(", "whisperToGms(", "incidentVictimDied("];
        for (let i = 1; i < order.length; i++) {
            const before = kill.indexOf(order[i - 1]);
            const after = kill.indexOf(order[i]);
            ok(before > 0 && after > before,
                `killCharacter's order broke: ${order[i - 1]} no longer comes before ${order[i]}`);
        }
        const died = bodyOf(chapter, "export async function incidentVictimDied", { until: "async function isIncidentVictim" });
        ok(died.indexOf("tieChapterTraces(") > 0 && died.indexOf("offerStageSix(") > died.indexOf("tieChapterTraces("),
            "incidentVictimDied no longer ties the chapter's traces before it offers Stage 6");
        const panel = stripComments(sources.get("gm-panel.mjs") ?? "");
        const repair = bodyOf(panel, "export async function applyAliveStates", { until: "async function toggleEclipse" });
        ok(/incidentVictimDied\(/.test(repair) && !/killCharacter\(/.test(repair),
            "the repair does not offer Stage 6 for the running incident's victim, or runs the whole death procedure (F16, D13)");

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
        const murder = stripComments(new Map(await otherSources()).get("murder-ui.mjs") ?? "");
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
         * `trustedWrite`, which bypasses the resource guard by design, so a player
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
        // Recorded by the primary GM, in its own store - see R98 for why not a flag. Since E10 C7
        // what is recorded is the kind with the verdict window's extra picks (`asked`).
        ok(/recordOffer\(actor\.id, asked\)/.test(offer) && /requestOfferRecord\(actor\.id, asked\)/.test(offer),
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
        // Since E10 C6 the packet names the offer it spends.
        ok(/requestAdvancement\(\{ actorId: actor\.id, picks: result, kind, offerId: offer\.id \}\)/.test(picker),
            "a player's picks are applied on their own client, or name no offer");

        const applied = bodyOf(level, "export async function applyAdvancement");
        ok(/if \(!game\.user\.isGM\)/.test(applied), "the apply is no longer the GM's alone");
        // The one the picks named, and only that one (E10 C6; audit S03-17).
        ok(/if \(offerId\) await withdrawOffer\(actor\.id, offerId\)/.test(applied),
            "the offer is not spent by being taken, so it can be taken twice - or a GM's own Level Up spends the player's");

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
        ok(/standingOffers\(actor\)/.test(handler) && /held\.id === payload\.offerId/.test(handler),
            "the GM applies a Level Up nobody offered, or one the packet does not name");
        ok(/applyAdvancement\(actor, picks, offer\.kind, \{ offerId: offer\.id \}\)/.test(handler),
            "the kind comes off the packet rather than off the offer, or the apply spends another offer");
        ok(/const wanted = offerPicks\(offer\);/.test(handler) && /picks\.length !== wanted/.test(handler),
            "three picks can be claimed for a standard Level Up");
        ok(/LEVEL_UP_OPTIONS\[p\?\.option\]/.test(handler),
            "a pick may name something that is not an option");

        const sheet = stripComments(sources.get("sheet.mjs") ?? "");
        const button = bodyOf(sheet, "function injectAdvanceButton", { until: "function injectItemButton" });
        // E10 C6: a player with nothing on offer has the standing button taken off as well.
        ok(/if \(!game\.user\.isGM && !offer\) \{\s*standing\?\.remove\(\);\s*return;/.test(button),
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
        ok(/(?:isDeceased|isDeadForGm)\(actor\)/.test(barred), "the dead can still spend");

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
        const world = stripComments(new Map(await otherSources()).get("call-world.mjs") ?? "");

        const schedule = bodyOf(world, "export async function scheduleGather", { until: "export async function runPendingGather" });
        ok(/sceneId: scene\.id/.test(schedule),
            "the order does not remember which scene its room is on");

        const run = fnSource(world, "runPendingGather");
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

        const gather = fnSource(world, "gatherEveryone");
        ok(/gatherEveryone\(room, onScene = null\)/.test(gather),
            "the scene cannot be handed to it, so a deferred assembly has no way to say where");
        ok(/\[\.\.\.scene\.tokens\]/.test(gather),
            "the cast is read off the canvas, which only holds the scene somebody is looking at");
        /* BOTH FUNCTIONS, BY NAME (E34 fix r1-G2, 07.10.2026; review r1 m4). Until E34 C2 this
           read was `bodyOf` from gatherEveryone to the end of call-effects.mjs, so it took in
           `fallbackGather`, which gatherEveryone hands the cast to when the region's teleport
           throws. C2's `fnSource` stopped at gatherEveryone's own end: measured on 63b1908, a
           `canvas.tokens.placeables` read planted in fallbackGather left this test green.
           `bodyOf` to the end of call-world.mjs would cover it only while fallbackGather stays
           the file's last function; read by name, either one leaving the file stops the test
           instead. */
        ok(!/canvas\.tokens\.placeables/.test(gather + fnSource(world, "fallbackGather")),
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
        ok(/advantageSources\(app, actor\)/.test(open),
            "the unlocked road reads Breakdown alone again, so a bought die is lost");
        ok(!/const fromState = stateGrant\(actor\);/.test(open),
            "the state-only reader is back");
        ok(/\[\.\.\.adv, \.\.\.dis\]/.test(open),
            "only one pair of chips is locked, so the other one can cancel the purchase");
        ok(/stripExperienceCosts\(app\)/.test(open) && /hideCostSection\(root\)/.test(open),
            "an experience a Call paid for is charged again when the lock is off");
        ok(open.indexOf("locking()") < open.indexOf("advantageSources(app, actor)"),
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
        ok(perform.indexOf("MONOCUB.dispatchable") < perform.search(/(?:isDeceased|isDeadForGm)\(actor\) && !isMonocub/),
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
        // The key is the local GM store's since E04 (1.2.63; gm-stores.mjs `observeStore`).
        ok(/observePending: "gmObservePending"/.test(settings), "the store has no setting");
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
        // The tie is a three-way select since E09 C4 ("-", Tied, Not tied), read back through `tieTaken`.
        ok(/tiedToCrime: tieTaken\(result\.tied\)/.test(body) && /reinforced: result\.reinforced/.test(body),
            "the flags are asked for and then not carried, so every hand-placed trace "
            + "is an ordinary one whatever the GM ticked");
        ok(/if \(!REMNANT_TYPES\[result\.type\]\)/.test(body),
            "the kind comes back off a form and is written without being checked");
        // The list's rule has its own name since E09 C13, which the Traces tab's kind reads too (S05-20).
        const findable = bodyOf(inv, "function findableKind(", { until: "\n}" });
        ok(/\.filter\(\(\[key\]\) => findableKind\(key\)\)/.test(body) && /observeDc\(v, key\) !== null/.test(findable)
            && /observeDc\(result\.visibility, result\.type\) === null/.test(body),
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
        ok(!/refundPrice|handBack|trustedWrite/.test(decline.slice(0, 900)),
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
        // E09 C3: the form hands on a changed field by name, and a placed row's push reads `words`.
        ok(/\["analysis", `keyanalysis:\$\{i\}`\]/.test(inv), "the planner draws the box and never reads it back");
        ok(/patch\.analyzedText = words\.analysis/.test(inv),
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
        const src = stripComments(new Map(await otherSources()).get("call-world.mjs") ?? "");
        const body = fnSource(src, "fallbackGather");
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
        // Two keys since E04 (1.2.63): the GMs' store and an owner's copy, both client-scoped.
        ok(game.settings.settings.get(`${MODULE_ID}.gmOffers`)?.scope === "client",
            "the offer store is not client-scoped, so it reaches every browser");
        ok(game.settings.settings.get(`${MODULE_ID}.mineOffers`)?.scope === "client",
            "an owner's copy of the offers is not client-scoped, so it reaches every browser");

        // Since E10 C6 `pendingAdvance` is the oldest of `standingOffers`, which reads the store.
        const pending = bodyOf(level, "export function pendingAdvance(", { until: "\n}" });
        const standing = bodyOf(level, "export function standingOffers(", { until: "\n}" });
        ok(/standingOffers\(actor\)/.test(pending) && /readOffers\(\)/.test(standing) && !/getFlag/.test(pending + standing),
            "pendingAdvance reads something other than this browser's store");
        const record = bodyOf(level, "export async function recordOffer(", { until: "export async function dropOffer(" });
        ok(/if \(!isPrimaryGm\(\)\) return null;/.test(record),
            "a client other than the primary GM writes the authority");
        ok(/if \(!isPrimaryGm\(\)\) return false;/.test(bodyOf(level, "export async function dropOffer(", { until: "export function offersFor(" })),
            "a client other than the primary GM takes an offer off the authority");

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

    ["R138 - the GM judges a crisis action again before it lands", async () => {
        /*
         * E03, 24.09.2026; audit S04-09. The stage, the side, the turn, the locks and
         * what the character had left to spend were checked on the acting player's
         * client only. `crisisRefusal` is the one list of those checks, asked by that
         * client and by the GM's bridge; this holds both callers to it.
         */
        const sources = new Map(await otherSources());
        const murder = stripComments(sources.get("murder-rules.mjs") ?? "");
        /* The first 1200 characters, as the read was before E34 C8 made it the whole function (11245 characters with
           comments stripped, crisisRefusal( at 200 - measured at 55d851e and a5e5fed): fix r2-G2 (08.10.2026; the
           round-2 review's m6) put the bound back: a call moved further into the function is no longer read as asked. */
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
        /* E29 fix r2-H12: the item's own update and its student's (`bulletWrites`) reach one judge, `onBulletWrite`. */
        const watcher = bodyOf(bullets, "function watchBulletEdits(", { until: "\n}\n" });
        const judge = bodyOf(bullets, "async function onBulletWrite(", { until: "\n}\n" });
        ok(/Hooks\.on\("updateItem", onBulletWrite\)/.test(watcher) && judge.startsWith("async function onBulletWrite(item, changes, options, userId)"),
            "the bullet watcher does not know who made the change");
        ok(/Hooks\.on\("updateActor", [^\n]*\n[^\n]*bulletWrites\(actor, changes\)[^\n]*onBulletWrite\(item, wrote, options, userId\)/.test(watcher),
            "a bullet written through its student's update does not reach the judge of its own update");
        ok(judge.includes("revertPlayerBulletEdit("), "a player's edit of a bullet is not put back");
        ok(judge.indexOf("revertPlayerBulletEdit(") < judge.indexOf("FROM_REMNANT"),
            "the player's edit is looked at after the watcher has already returned for the trace's own writes");
        /* E29 fix r2-H13: what a bullet's write touched is read with the sheet audit's reader of a write's forms. */
        ok(bodyOf(bullets, "export function guardedPathsIn(", { until: "\n}\n" }).includes("reachOf(changes)"),
            "a bullet's guarded fields are read off a write by a reader of their own, not by sheet-audit.mjs's reachOf");
        /* E29 fix r2-H14: a player's edit is put back once the sheet audit has judged every write queued on the bullet's student, whatever it named. */
        ok(/\n\s*await judgedFor\(item\.parent\?\.id\);\s*await revertPlayerBulletEdit\(/.test(judge),
            "a player's edit of a bullet can be put back before the sheet audit has judged the writes queued on its student");
        /* E29 fix r2-H16: a GM's write moves the GMs' copy of a bullet by the fields it touched; whole, it took a player's value waiting for its put-back. */
        ok(/\brefreshGuard\(item, touched\)/.test(judge) && !/\brefreshGuard\(item\)/.test(judge),
            "a GM's write takes a bullet into the GMs' copy whole, a player's value waiting for its put-back with it");
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
        const world = stripComments(sources.get("call-world.mjs") ?? "");
        ok(/return Boolean\(await writeWorld\(/.test(fnSource(world, "sealRoom")),
            "sealRoom says it sealed whether or not it wrote");
        const handover = stripComments(sources.get("handover.mjs") ?? "");
        ok(/isEclipse\(\)/.test(bodyOf(handover, "async function verify(", { until: "\n}\n" })), "a handover is not refused during an Eclipse on the GM's side");
        const give = bodyOf(handover, "export async function giveItem(", { until: "\n}\n" });
        ok(give.indexOf("isStashed(held)") >= 0 && give.indexOf("isStashed(held)") < give.indexOf("BEDROOM_KEY_FLAG"),
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
        ok(/!undo && !isAnalysable\(held, chapter\)/.test(resolve), "a fresh Analyze does not ask whether the bullet may be analysed");
        ok(/analysedChapter !== chapter/.test(resolve), "an undo does not ask for a throw in this chapter");
        const cleanup = stripComments(sources.get("cleanup.mjs") ?? "");
        const six = bodyOf(cleanup, "export async function resolveStageSix(", { until: "\n}\n" });
        ok(six.indexOf("framingCandidates(actor)") > 0 && six.indexOf("framingCandidates(actor)") < six.indexOf("spendStress("),
            "a misleading trail is not checked against who may be framed before it is paid for");
        ok(six.indexOf("bodyIsHere(actor)") > 0 && six.indexOf("bodyIsHere(actor)") < six.indexOf("spendStress("),
            "moving the body does not ask where the body is before it is paid for");
        ok(/receipt\.stressAfter - receipt\.stressBefore/.test(cleanup), "a clean-up's undo does not take back what it moved");
        // E09 fix r2-G10: and only what the attempt's own writes moved, never a write that landed while it ran.
        ok(/const moved = typeof receipt\.stressMoved === "number" \? receipt\.stressMoved\b/.test(cleanup),
            "a clean-up's undo takes back the track's move while it ran, not the attempt's own writes");
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
        equal(scan.files.join(" "), "tests-grid.mjs tests-tier0.mjs tests-tier1.mjs tests-tier2.mjs", "the scan does not read the three tier files and the grid");
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
        equal(scan.files.join(" "), "tests-grid.mjs tests-tier0.mjs tests-tier1.mjs tests-tier2.mjs", "the scan does not read the three tier files and the grid");
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
        equal(scan.files.join(" "), "tests-grid.mjs tests-tier0.mjs tests-tier1.mjs tests-tier2.mjs", "the scan does not read the three tier files and the grid");
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
         * nothing reaches the GM outside it: every bridge action and every file
         * that listens on the module's socket belongs to exactly one flow (or is exempt
         * with a reason), and no flow names an action, a file, a game.drpg call or a
         * function that is gone. Read off the bridge's tables (E31: the declarations the
         * runner judges, by their wire names) and `game.socket.on(` in each file served
         * here. On 25.09: 37 actions, 17 listener files. A read of fewer than 37 or 10
         * means the source moved and this measured nothing, and fails as such.
         */
        const sources = new Map(await otherSources());
        // The bridge's tables, read live since E31 (25.09.2026): gm-bridge.mjs's, the trap relay's and the search
        // tokens'. No count here: a stage that adds an action (E05's note.save) would make one stale, and the
        // floor below is what says the tables were read at all.
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
            // The runner reads the roll a result comes from in the run's copy (E08+E28 C14, bridge-guards.mjs `judge`):
            // since C15 each of a list, and the fields a path, `when` and `kindAt` start from; since C16 what a
            // `derive` reads of the copy it is handed (gm-bridge.mjs `progressOf`), read as a run's reads are; since
            // fix r2-H1 the paths a `named` field is compared with (a crisis roll's `key`).
            for (const rolled of G.rollsOf(decl)) {
                const derived = rolled.derive ? payloadReads({ run: rolled.derive }, lookup) : { fields: [], unreadable: [] };
                r.unreadable.push(...derived.unreadable);
                r.fields = [...new Set([...r.fields, rolled.field, ...derived.fields,
                    ...[rolled.actor, rolled.when, rolled.kindAt, ...Object.values(rolled.named ?? {})].filter(Boolean).map(path => path.split(".")[0])])];
            }
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
           its return value is the reason, its `why:` or its `refused:`. One passes on a
           listed function's reason (`resolveObserve` observeResolveRefusal's; the
           receipt's `spendRerollReceipt` was a second, until E08+E28 C8 retired it),
           and one is wrapped: `hopeCallRefusal` says, in the GM's language, what the
           guard asking it puts inside its own English reason. */
        const DELEGATES = {
            crisisRefusal: "why", crisisUndoRefusal: "returns", unsabotageRefusal: "returns",
            sendBackRefusal: "returns", playerArmRefusal: "returns", observeResolveRefusal: "returns", removalRefusal: "returns",
            searchSpendRefusal: "returns", narrowPlayerRemnant: "refused", resolveAnalyze: "refused", resolveStageSix: "refused",
            answerKeysRefusal: "returns", shareBullet: "refused", applyRecordedMove: "refused",
            // E08+E28 C4a: the Reroll the GM makes, and the checks it asks before the payment.
            rerollOnGm: "refused", makeReroll: "refused", rerollRefusal: "why", replayRefusal: "returns",
            // E08+E28 C14: the roll a result is read from, asked by the runner after the guards.
            rollRefusal: "returns",
            // E08+E28 C15: what a roll earned, read off its record by a declaration's `derive` (C16: a Work on a Project's).
            searchTheftOf: "why", traceBandOf: "why", progressOf: "why",
            // E08+E28 fix r2-H1: the draw of a player's roll, held to the action it is for before it is thrown.
            drawOnGm: "refused", drawRefusal: "returns",
            // E29 C8: a Call on the buyer's own character, the other half of `guardArmPlayerCall`.
            ownArmRefusal: "returns",
            // E29 fix r2-H21: an item no GM has decided on, asked by the copy roads, whose runs pass their `{ refused }` on.
            creationRefusal: "returns", giveItem: "refused", lootBody: "refused", plantOnPerson: "refused",
            stealFromPerson: "refused", stealFromVault: "refused",
            // E33 C10: a Monocub's ability by key, the row, the Monocub and the choice (guardCubAbility asks it).
            cubAbilityRefusal: "returns",
            // E10 C2: a ballot, judged on the primary (vote.mjs), whose run passes its `{ refused }` on.
            recordBallot: "refused", ballotRefusal: "returns",
            resolveObserve: "passes", hopeCallRefusal: "wraps"
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
    }],

    ["R171 - nothing outside the engine reads or writes a GM store, a frozen legacy key or a player copy", async () => {
        /*
         * E04, 26.09.2026; audit S05-01, S05-09. The GM store (gm-store.mjs) keeps each
         * GM-only store under a key sectioned by world and merged per field, and it never
         * writes a store's old key: the upgrade leaves that key as it found it, for the next
         * world opened in the same browser and for a downgrade. Both promises hold only while
         * nothing else in the module touches those keys. A raw write to an old key breaks the
         * first; a raw read of one after its store moved reads a copy frozen at the upgrade,
         * and looks exactly like a working read.
         *
         * So every file Foundry serves, but the engine and its table, is read for a
         * settings call, a SETTINGS name handed anywhere but a listener's key comparison, or
         * a localStorage access, on any store's key, old key or player copy - and on the keys
         * of the stores that have not moved yet (GM_STORE_PENDING, tests-lint.mjs), whose
         * files are allowed below by name until the commit that moves each one. The list
         * only shrinks: a row with no such read left fails. The harness scenarios are read
         * by `node tools/check.mjs contract` with the same reader: a table's Foundry does not
         * serve audit/. The reader is shown its planted reads first.
         */
        const fx = LINT_FIXTURES.storeKeyAccess;
        equal(JSON.stringify(storeKeyAccess(fx.text, fx).found.map(f => f.line).sort((a, b) => a - b)), JSON.stringify(fx.flags),
            "the reader does not find exactly the raw reads planted for it - it would read the module wrong too");
        await import("./gm-stores.mjs");
        const E = await import("./gm-store.mjs");
        const keys = new Set(GM_STORE_PENDING);
        for (const h of E.gmStoreHandles()) for (const k of [h.spec.key, h.spec.legacyKey]) if (k) keys.add(k);
        for (const name of E.gmCopyNames()) {
            const spec = E.gmCopySpec(name);
            for (const k of [spec.key, spec.legacyKey, ...(spec.legacyKeys ?? [])]) if (k) keys.add(k);
        }
        const props = Object.keys(SETTINGS).filter(p => keys.has(SETTINGS[p]));
        const named = new Set(props.map(p => SETTINGS[p]));
        ok([...keys].every(k => named.has(k)), `a GM store's key is not a SETTINGS name, so nothing here could find it read: ${
            [...keys].filter(k => !named.has(k)).join(", ")}`);
        const ALLOW = {
            // The census and old-store tests of tier 2 hand each old key's fixture to `withGmStoreLegacy` and read the
            // real key back, unchanged: no test writes one (E04's fix round, the review's DS-m5; the runner checks it).
            "tests-tier2.mjs#legacyTruthBulletSecrets": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyRemnantSecrets": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyMastermind": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyIncidentCast": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyBlackenedLedger": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyTrapLedger": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyTrapPlants": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyObservePending": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyAdvanceOffers": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyDiscoveryLedger": "the claim's census names the old key its fixture stands in for",
            "tests-tier2.mjs#legacyDiscoveryMine": "the fog copy's claim names the old key its fixture stands in for"
        };
        const seen = new Set(), raw = [];
        let read = 0;
        for (const [file, text] of await moduleSources()) {
            if (file === "gm-store.mjs" || file === "gm-stores.mjs") continue;
            const r = storeKeyAccess(text, { props, keys: [...keys] });
            read += r.read;
            for (const f of r.found) {
                const row = `${file}#${f.name}`;
                if (ALLOW[row]) seen.add(row);
                else raw.push(`${file}:${f.line} ${f.what}`);
            }
        }
        const stale = Object.keys(ALLOW).filter(row => !seen.has(row));
        log(`R171: ${keys.size} GM store keys under ${props.length} SETTINGS names; ${read} settings reads and calls read; `
            + `${seen.size} allowed file#name rows in use`);
        // 528 read on 26.09.2026 (E04 C1); the floor leaves room for the reads the stores' moves take out.
        ok(read >= 400, `only ${read} settings reads were read - the reader is not reaching the module`);
        ok(!raw.length, `these read or write a GM store's key raw, outside the engine: ${raw.join("; ")}`);
        ok(!stale.length, `allowed, and no such raw read is left - take the row out: ${stale.join(", ")}`);
    }],

    ["R172 - no answer-key writer derives a value from absence", async () => {
        /*
         * E04, 26.09.2026; audit S05-01. The answer key was erased by a writer that
         * built a row out of nothing - a migration that met a bullet this GM held no
         * row for and wrote `{ faint }` as if it were the whole truth - and a merge
         * that let the newest row win whole. The merge is per field now (R169); this
         * holds the writers. Each one below writes a value it DERIVED - a migration's
         * default, a propagation that only amends what is there, a record of an
         * Analyze - and its store write has to say so: `ifLive` (never start a row),
         * `weak` (lose to anything a GM decided), `fillOnly` (never replace what is
         * there), as the row lists; and a migration that reads a store first waits
         * until the other GMs' copies have arrived (`whenHydrated`). The table grows
         * with each store E04 moves. Read from the source, because a derived write
         * that forgot its option still works - until a second GM joins. The reader
         * is shown a planted writer first.
         */
        const WRITES = /\b(?:setSecret|setRemnantSecret|writeCells|\w+Store\.patch|\w+Store\.patchMany)\(/g;
        const callAt = (text, open) => {
            let depth = 0;
            for (let i = open; i < text.length; i++) {
                if (text[i] === "(") depth++;
                else if (text[i] === ")" && --depth === 0) return text.slice(open, i + 1);
            }
            return text.slice(open);
        };
        const problems = (name, body, wants, waits) => {
            const out = [];
            const calls = [...body.matchAll(WRITES)].map(m => m[0].slice(0, -1) + callAt(body, m.index + m[0].length - 1));
            if (!calls.length) out.push(`${name} writes no store any more - take its row out, or point it at the writer`);
            for (const call of calls) for (const want of wants) if (!new RegExp(`\\b${want}\\s*:\\s*true\\b`).test(call)) out.push(`${name}: ${call.replace(/\s+/g, " ").slice(0, 80)} lacks ${want}`);
            if (waits && !/\.whenHydrated\(/.test(body)) out.push(`${name} reads a store without waiting for the other GMs' copies`);
            return out;
        };
        const planted = "async function planted(item) {\n    await setSecret(item.uuid, { faint: true }, { weak: true });\n    await setSecret(item.uuid, { faint: false }, { ifLive: true, weak: true });\n}\n";
        equal(JSON.stringify(problems("planted", planted, ["ifLive", "weak"], true)),
            JSON.stringify(["planted: setSecret(item.uuid, { faint: true }, { weak: true }) lacks ifLive", "planted reads a store without waiting for the other GMs' copies"]),
            "the reader does not find exactly the two faults planted for it");

        const WRITERS = [
            ["truth-bullets.mjs", "migrateFaintIntoSecrets", ["ifLive", "weak"], true],
            ["truth-bullets.mjs", "migrateTruthBullets", ["weak", "fillOnly"], true],
            ["truth-bullets.mjs", "propagateRemnantPublic", ["ifLive"], false],
            // The tie's two and the kind's, one since E09 C2 (Faint joined them there).
            ["truth-bullets.mjs", "propagateVerdicts", ["ifLive"], false],
            ["analyze.mjs", "resolveAnalyze", ["ifLive"], false],
            // The traces (C4): what amends a row a GM holds, and the migration's weak fill.
            ["remnants.mjs", "markRemnantEdited", ["ifLive"], false],
            ["remnants.mjs", "setRemnantSecretById", ["ifLive"], false],
            ["remnants.mjs", "setRemnantPublic", ["ifLive"], false],
            ["remnants.mjs", "setRemnantFlags", ["ifLive"], false],
            ["remnants.mjs", "setRemnantFlagsMany", ["ifLive"], false],
            ["remnants.mjs", "retuneRemnant", ["ifLive"], false],
            ["remnants.mjs", "moveIntoLedger", ["weak", "fillOnly"], false],
            ["remnants.mjs", "carryPromotion", ["ifLive"], false],
            // The moved path's promotion, at the world's upgrade mark (E04's fix round): it amends the moved row.
            ["remnants.mjs", "promoteAtMark", ["ifLive"], false],
            ["remnants.mjs", "seedPublicIfMissing", ["weak", "fillOnly"], false],
            // A tie's wait for a death nobody has found, cleared at its publication and handed on
            // to a death the GMs keep (E09 fix r1-G1): both amend rows.
            ["remnants.mjs", "publishTiesFor", ["ifLive"], false],
            ["remnants.mjs", "handTiesOn", ["ifLive"], false],
            // The traces' old "not tied" read as undecided, once per world (E09 C4): it amends rows,
            // and runs from the stores' hydration and asks `isHydrated` itself.
            ["gm-stores.mjs", "settleTieStates", ["ifLive"], false],
            // The cast's lift out of world data (C6; its row came with C9).
            ["incident-store.mjs", "liftIncidentSecrets", ["weak", "fillOnly"], true],
            // The fog (C9): a character standing in a room, a player's rows in the rebuild, the world's old ledger.
            ["fog.mjs", "seedDiscovery", ["weak", "fillOnly"], false],
            ["fog.mjs", "registerLedgerRoad", ["weak", "fillOnly"], false],
            ["fog.mjs", "liftDiscoveryLedger", ["weak", "fillOnly"], true],
            // An indirect murder's killer, builder, condition and trigger out of projectMeta (E05 C1).
            ["projects-secrecy.mjs", "liftProjectSecrets", ["weak", "fillOnly"], true],
            // The declarations made in the dark out of the world's pendingMurders (E05 C3).
            ["eclipse.mjs", "liftPendingMurders", ["weak", "fillOnly"], true],
            // The Eclipse's crossings out of the world's eclipseMoves (E05 C4).
            ["eclipse.mjs", "liftEclipseMoves", ["weak", "fillOnly"], true],
            // The Key Remnant plan out of the world's keyRemnantPlan (E05 C5).
            ["investigation.mjs", "liftKeyPlan", ["weak", "fillOnly"], true],
            // The pre-session notes out of their users' flags (E05 C6).
            ["pre-session-note.mjs", "liftNotes", ["weak", "fillOnly"], true],
            // The incident's method (E05 C8) and its fight (E32 C3) out of the world half of murderState:
            // both lifts run one body, `liftIntoCast`.
            ["incident-store.mjs", "liftIntoCast", ["weak", "fillOnly"], true],
            // Which trace each bullet came from, out of its `remnantRef` flag into its row (E05 C13).
            ["truth-bullets.mjs", "liftBulletRefs", ["weak", "fillOnly"], true]
        ];
        // The migrations that read a store through a function they call: they wait themselves.
        const WAITERS = [["remnants.mjs", "migrateRemnants"], ["remnants.mjs", "migrateRemnantToken"]];
        const sources = new Map(await otherSources());
        const found = [];
        for (const [file, fn, wants, waits] of WRITERS) {
            found.push(...problems(`${file} ${fn}`, fnSource(stripComments(sources.get(file) ?? ""), fn), wants, waits));
        }
        for (const [file, fn] of WAITERS) {
            if (!/\.whenHydrated\(/.test(fnSource(stripComments(sources.get(file) ?? ""), fn))) found.push(`${file} ${fn} reads a store without waiting for the other GMs' copies`);
        }
        log(`R172: ${WRITERS.length} derived writers and ${WAITERS.length} migrations read in ${new Set([...WRITERS, ...WAITERS].map(w => w[0])).size} files`);
        ok(!found.length, `a writer derives an answer-key value from absence: ${found.join("; ")}`);
    }],

    ["R177 - the season reset is the primary's, and the clock cuts every store it wipes", async () => {
        /*
         * E04 C10, 26.09.2026; audit S06-20, D12. The reset checked only that a GM ran
         * it, and what it wiped in the GM stores it wiped in that GM's browser: an
         * assistant's reset left last season's trap plants on the primary's, which hands
         * a Search its find, and a GM away during the reset handed every wiped row back
         * at its next exchange. Held here: the window refuses anybody but the primary GM
         * before it opens, and opens only once this browser has the other GMs' copies;
         * the wipe writes its cut in the clock before its first step and outside every
         * step (a step can fail, the cut must stand); the traces' tokens go with
         * `drpgReset`, so the cut and the clear take their rows rather than a tombstone
         * each; every store and every player copy names a reset group the window offers,
         * or no tick would ever cut it; the owners' copy of the offers is drawn again when
         * a cut withdraws them (nothing is sent for it); and the patch keeps every earlier
         * cut.
         */
        const sources = new Map(await otherSources());
        const setup = stripComments(sources.get("season-setup.mjs") ?? "");
        const beforeWindow = bodyOf(setup, "export async function resetSeason", { until: "DialogV2.wait(" });
        ok(/isPrimaryGm\(\)/.test(beforeWindow), "resetSeason opens its window without asking whether this is the primary GM");
        ok(/whenGmStoresHydrated\(\)/.test(beforeWindow), "the reset window opens before this browser has the other GMs' copies");
        const wipe = fnSource(setup, "wipeSeason");
        ok(/resetCutPatch\(/.test(bodyOf(wipe, "async function wipeSeason", { until: "const step =" })),
            "wipeSeason does not write the reset's cut before its first step, outside every step");
        ok(/deleteEmbeddedDocuments\("Token", ids, \{ drpgReset: true \}\)/.test(wipe),
            "the reset's trace tokens are deleted without drpgReset, so each row is tombstoned on its own and the cut is not what takes them");

        const { RESET_GROUPS, resetCutPatch, planFrom } = await import("./season-exceptions.mjs");
        const E = await import("./gm-store.mjs");
        await import("./gm-stores.mjs");
        const groups = new Set(RESET_GROUPS.map(group => group.key));
        const named = [...E.gmStoreHandles().map(h => [`the store ${h.name}`, h.spec.resetGroup]),
            ...E.gmCopyNames().map(name => [`the copy ${name}`, E.gmCopySpec(name)?.resetGroup])];
        ok(named.length >= 14, `only ${named.length} GM stores and copies are defined - the table was not read`);
        const strays = named.filter(([, group]) => !groups.has(group)).map(([what, group]) => `${what} (${group})`);
        ok(!strays.length, `a reset can never cut ${strays.join(", ")}: its reset group is none the window offers`);
        // The owner's Q4: a reset withdraws the Level Ups on offer by its cut alone, and sends nothing to draw that.
        ok(typeof E.gmCopySpec("offers")?.onCut === "function", "an owner's copy of the offers is cut by a reset and nothing draws the sheet again");

        equal(JSON.stringify(resetCutPatch(planFrom(["remnants", "mastermind"]), { resetCuts: { bullets: 5, remnants: 3 } }, 9)),
            JSON.stringify({ resetCuts: { bullets: 5, remnants: 9, mastermind: 9 } }),
            "the reset's patch drops an earlier cut, misses a wiped group, or starts a season with the clock kept");
        equal(resetCutPatch(planFrom(["clock", "incident"]), {}, 9).seasonStartedAt, 9, "a reset of the clock does not start a new season");
    }],

    ["R178 - no migration runs from a ready hook", async () => {
        /*
         * E04 C10, 26.09.2026; audit S01-31. Four lifts of old data into the GM stores
         * ran from ready hooks - on every load, on every GM, before the other GMs'
         * copies had arrived - and each wrote as if what it met were the whole truth
         * (S05-01's erased answer keys were one of them). They are migration clauses
         * since E04: once, on the primary, after `forgetMonokumaWalks` (whose Monokuma
         * rows the fog's lift must not take), each waiting for its store. Held here:
         * each clause stands after that one, since 1.2.63, and runs its lift; and no
         * file calls a lift except its clause - the restore, which runs the Faint pass
         * again when a GM asks, and diagnostics' line telling the GM what to type. The
         * reader is shown a planted ready hook first. E05's lifts join the list, each
         * with its own `since` (1.2.64), and so do its two drops (C7) and the traces'
         * neutral names (C13), which lift nothing, and C14's two: the bodies' loot records,
         * and the per-token routine of `migrateRemnants` that was a console call (Q5).
         * E05's fix round (r1-G1) gave E04's names and fog lifts 1.2.64 too, so that a world
         * 1.2.63 stamped over rows they kept runs them once more, and its second (r2-F0b) the
         * Faint's pass, for the same reason. Its fourth (r2-G4) adds the old incidents' marks,
         * and narrows the one allowance inside a lift's own file: `neutralTraceNames` was allowed
         * anywhere in remnants.mjs (reviews S2-m11 = F8), so a ready hook there calling it passed;
         * now only inside `migrateRemnantsOnce`'s body, shown a planted hook beside it first.
         * E06 C12 adds the rewrite of the chat log written before 1.2.65, since 1.2.65, and E06's
         * fix r2-G1 two clauses for what C10 changed on data 1.2.64 wrote: the buyers of armed
         * Calls, and a secret project's public repair. E32 C3 adds the lift of a running
         * incident's fight, since 1.2.66.
         */
        const LIFTS = [["truthBulletShape", "migrateTruthBullets", "1.2.63"],
            // E04's three, given 1.2.64 by E05's fix rounds (r1-G1; the Faint's pass r2-F0b): a world 1.2.63
            // stamped over rows they kept runs them again.
            ["faintIntoSecrets", "migrateFaintIntoSecrets", "1.2.64"],
            ["liftIncidentSecrets", "liftIncidentSecrets", "1.2.64"], ["liftDiscoveryLedger", "liftDiscoveryLedger", "1.2.64"],
            ["liftProjectSecrets", "liftProjectSecrets", "1.2.64"], ["liftPendingMurders", "liftPendingMurders", "1.2.64"],
            ["liftEclipseMoves", "liftEclipseMoves", "1.2.64"], ["liftKeyPlan", "liftKeyPlan", "1.2.64"], ["liftNotes", "liftNotes", "1.2.64"],
            ["dropRollBookmarks", "dropRollBookmarks", "1.2.64"], ["dropCardSummaries", "dropCardSummaries", "1.2.64"],
            ["liftIncidentMethod", "liftIncidentMethod", "1.2.64"], ["liftOverflowCount", "liftOverflowCount", "1.2.64"],
            // E05 C13: a bullet's trace key into its row, and a found trace's token back to the neutral word.
            ["liftBulletRefs", "liftBulletRefs", "1.2.64"], ["neutralTraceNames", "neutralTraceNames", "1.2.64"],
            // E05 C14: a body's loot record into its row, and an old trace's answer key off its token.
            ["liftLootTraces", "liftLootTraces", "1.2.64"], ["migrateRemnantsOnce", "migrateRemnantsOnce", "1.2.64"],
            // E05 fix r2-G4: the marks of the incidents closed before 1.2.64 off their traces.
            ["retireOldIncidentMarks", "retireOldIncidentMarks", "1.2.64"],
            // E06 C12: the chat log written before 1.2.65 rewritten as it is written today; lifts nothing.
            ["neutraliseOldCards", "neutraliseOldCards", "1.2.65"],
            // E06 fix r2-G1: an armed Call's buyer off its actor, and a secret project's repair sealed and renamed.
            ["unsignArmedCalls", "unsignArmedCalls", "1.2.65"], ["sealOldRepairs", "sealOldRepairs", "1.2.65"],
            // E32 C3: a running incident's fight out of the world half of murderState.
            ["liftIncidentFight", "liftIncidentFight", "1.2.66"]];
        const ALLOWED = {
            "migrate.mjs": LIFTS.map(([, fn]) => fn),
            // A restore runs the Faint pass again (gm-stores.mjs `restoreCase`), because a GM asked.
            "gm-stores.mjs": ["migrateFaintIntoSecrets"],
            // E05 C14: `migrateRemnantsOnce`, itself run only by its clause, gives what it stripped the
            // neutral word - there and nowhere else in the file: [the lift, the function it may be called in].
            "remnants.mjs": [["neutralTraceNames", "migrateRemnantsOnce"]],
            // Not a call: the line diagnostics prints, telling a GM the console command.
            "diagnostics.mjs": ["migrateTruthBullets"]
        };
        // A top-level function's body, from its declaration to its closing brace at the line's start.
        const within = (src, at, name) => {
            const from = src.search(new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, "m"));
            const to = from < 0 ? -1 : src.indexOf("\n}", from);
            return from >= 0 && to > from && at > from && at < to;
        };
        const callers = files => {
            const out = [];
            for (const [file, text] of files) {
                const src = stripComments(text);
                for (const [, fn] of LIFTS) {
                    for (const m of src.matchAll(new RegExp(`\\b${fn}\\s*\\(`, "g"))) {
                        if (/function\s+$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
                        const allowed = (ALLOWED[file] ?? []).some(a => (Array.isArray(a) ? a[0] === fn && within(src, m.index, a[1]) : a === fn));
                        if (!allowed) out.push(`${file}: ${fn}`);
                    }
                }
            }
            return out;
        };
        equal(JSON.stringify(callers([["planted.mjs", "Hooks.once(\"ready\", async () => {\n    await liftIncidentSecrets();\n});\nexport async function liftIncidentSecrets() {}\n"]])),
            JSON.stringify(["planted.mjs: liftIncidentSecrets"]), "the reader does not find the lift a planted ready hook calls, or finds its declaration");
        equal(JSON.stringify(callers([["remnants.mjs", "export async function migrateRemnantsOnce() {\n    await neutralTraceNames({ tokens });\n}\n"
            + "Hooks.once(\"ready\", async () => {\n    await neutralTraceNames();\n});\n"]])),
            JSON.stringify(["remnants.mjs: neutralTraceNames"]),
            "the reader does not find the neutral names a planted ready hook in remnants.mjs calls, or finds the call inside migrateRemnantsOnce");

        const sources = new Map(await otherSources());
        const migrate = stripComments(sources.get("migrate.mjs") ?? "");
        const keyAt = key => migrate.indexOf(`key: "${key}"`);
        const monokuma = keyAt("forgetMonokumaWalks");
        ok(monokuma >= 0, "migrate.mjs has no forgetMonokumaWalks clause - this test reads nothing until it is pointed at it again");
        for (const [key, fn, since] of LIFTS) {
            ok(keyAt(key) > monokuma, `the lift ${key} is not a migration clause after forgetMonokumaWalks`);
            // One clause: from its key to the brace that closes it, four spaces in.
            const clause = bodyOf(migrate, `key: "${key}"`, { until: "\n    }" });
            ok(clause.includes(`since: "${since}"`) && new RegExp(`\\b${fn}\\(`).test(clause), `the clause ${key} does not run ${fn} since ${since}`);
        }
        const found = callers(sources);
        log(`R178: ${LIFTS.length} lifts, read in ${sources.size} files`);
        ok(!found.length, `a lift runs outside its migration clause: ${found.join(", ")}`);
    }],

    ["R191 - the world half of an incident holds only the listed public fields", async () => {
        /*
         * E05 C8, 26.09.2026; audit S04-08. The world half of `murderState` is on every
         * browser, and until 1.2.64 it held whatever an incident's write named that was not
         * a cast field: a trap, a death by the victim's own hand, a reversal, when it opened,
         * how it ended. It is turned round now: incident-store.mjs lists what it may hold
         * (`PUBLIC_INCIDENT`, a reason each), `splitIncident` sends everything else to the
         * cast or nowhere, and the world-secrets rule is the same list written out. Read here:
         * the list has its reasons, shares no field with the cast and equals the rule; the
         * split puts a field nobody listed anywhere but the world; only `writeState`,
         * `restoreState` (both through the split) and the lifts (which only take fields
         * out; their tier-2 pairs measure that - the method's and, since E32 C3, the fight's
         * run one body, `liftIntoCast`) write the key; and every field a write in
         * murder-rules.mjs names - a `writeState({ ... })` literal, a `patch` built for one - is
         * listed on one side. A computed key (`[store]`, "hindered" or "blocked") is not read.
         * The season reset writes `{}` (season-setup.mjs: through a table until E11 C9, from its
         * `incident` run's second part since; an empty write has no field to split). The reader is
         * shown a planted write of each kind first. E32 C2 (28.09.2026) shrank the list to
         * `active` and `stage`: the fight's twelve fields are the cast's (`INCIDENT_FIGHT`),
         * so a write naming one still lands on a side - the cast's - and this reads the same.
         */
        const M = await import("./murder.mjs");
        const S = await import("./gm-stores.mjs");
        const W = await import("./world-secrets.mjs");
        const listed = Object.keys(M.PUBLIC_INCIDENT);
        const sorted = list => JSON.stringify([...list].sort());
        const noReason = Object.entries(M.PUBLIC_INCIDENT).filter(([, why]) => typeof why !== "string" || why.length < 12).map(([key]) => key);
        ok(!noReason.length, `a public field of an incident has no reason written beside it: ${noReason.join(", ")}`);
        const both = listed.filter(key => S.CAST_FIELDS.includes(key));
        ok(!both.length, `a field is both public and the cast's: ${both.join(", ")}`);
        equal(sorted(W.WORLD_SECRET_RULES.settings.murderState?.only ?? []), sorted(listed),
            "the world-secrets rule for murderState and murder.mjs's PUBLIC_INCIDENT are not the same list");
        const method = S.INCIDENT_METHOD.filter(key => !S.CAST_FIELDS.includes(key) || listed.includes(key));
        // Six since E09 fix r1-G3: the chapter it opened in, under which its close keeps the case's Key count.
        ok(S.INCIDENT_METHOD.length === 6 && !method.length, `the incident's method is not the cast's alone: ${method.join(", ")}`);

        const split = M.splitIncident({ ...Object.fromEntries(listed.map(key => [key, 1])), ...Object.fromEntries(S.CAST_FIELDS.map(key => [key, 2])), R191planted: 3 });
        equal(JSON.stringify([sorted(Object.keys(split.world)), sorted(Object.keys(split.cast)), split.neither]),
            JSON.stringify([sorted(listed), sorted(S.CAST_FIELDS), ["R191planted"]]),
            "the split does not put each listed field in the world half, each cast field in the cast, and a field nobody listed in neither");

        const SET = /(?:\.set\(\s*[\w.]+\s*,\s*(?:SETTINGS\.murderState\b|"murderState")|\bsetSetting\(\s*SETTINGS\.murderState\b)/g;
        const DECL = /^(?:export )?(?:async )?function\s+(\w+)/gm;
        const ALLOWED = ["incident-store.mjs writeState", "incident-store.mjs restoreState", "incident-store.mjs liftIncidentSecrets", "incident-store.mjs liftIntoCast", "season-setup.mjs wipeSeason"];
        const writers = files => {
            const out = [];
            for (const [file, text] of files) {
                const src = stripComments(text);
                const decls = [...src.matchAll(DECL)];
                for (const m of src.matchAll(SET)) {
                    const fn = decls.filter(d => d.index < m.index).pop()?.[1] ?? "(top level)";
                    out.push(`${file} ${fn}`);
                }
            }
            return out;
        };
        const topKeys = (text, open) => {
            const keys = [];
            let depth = 0, entry = false;
            for (let i = open; i < text.length; i++) {
                const c = text[i];
                if ("([{".includes(c)) { if (++depth === 1) entry = true; continue; }
                if (")]}".includes(c)) { if (--depth === 0) break; continue; }
                if (depth !== 1) continue;
                if (c === ",") { entry = true; continue; }
                if (!entry || /\s/.test(c)) continue;
                entry = false;
                const m = /^([A-Za-z_$][\w$]*)\s*[:,}]/.exec(text.slice(i));
                if (m) keys.push(m[1]);
            }
            return keys;
        };
        const named = text => {
            const src = stripStrings(stripComments(text));
            const keys = [];
            for (const m of src.matchAll(/\bwriteState\(\s*\{/g)) keys.push(...topKeys(src, m.index + m[0].length - 1));
            // `const fresh` is a new incident's whole state (murder-rules.mjs `freshIncidentState`, E32 C5a), which `openMurder` writes.
            for (const m of src.matchAll(/\bconst (?:patch|fresh) = \{/g)) keys.push(...topKeys(src, m.index + m[0].length - 1));
            for (const m of src.matchAll(/\bpatch\.(\w+)\s*=(?!=)/g)) keys.push(m[1]);
            return keys;
        };
        const unlisted = keys => [...new Set(keys)].filter(key => !listed.includes(key) && !S.CAST_FIELDS.includes(key));
        const planted = "function planted(state) {\n    return game.settings.set(MODULE_ID, SETTINGS.murderState, { ...state, indirect: true });\n}\n"
            + "async function writeState(patch) {\n    await game.settings.set(MODULE_ID, SETTINGS.murderState, publicNext);\n}\n"
            + "async function other(store) {\n    await writeState({ stage: \"incident\", R191planted: { deep: 1 }, [store]: 1, ...more });\n"
            + "    const patch = { turn: 1, R191alsoPlanted: \"a, b: c\" };\n    patch.R191thirdPlanted = 2;\n}\n";
        equal(JSON.stringify([writers([["planted.mjs", planted]]), unlisted(named(planted))]),
            JSON.stringify([["planted.mjs planted", "planted.mjs writeState"], ["R191planted", "R191alsoPlanted", "R191thirdPlanted"]]),
            "the reader does not find exactly the writer and the three unlisted fields planted for it");

        const sources = await otherSources();
        const stray = writers(sources).filter(w => !ALLOWED.includes(w));
        ok(!stray.length, `the world half of an incident is written outside writeState, restoreState and the lifts: ${stray.join(", ")}`);
        const storeSrc = stripComments(new Map(sources).get("incident-store.mjs") ?? "");
        for (const fn of ["writeState", "restoreState"]) ok(/\bsplitIncident\(/.test(fnSource(storeSrc, fn)), `${fn} writes the world half without splitting it by the public list`);
        // E34 fix r2-G2 (08.10.2026; the round-2 review's m7): the census reads every file murder.mjs was split into and
        // the facade, as the one read of murder.mjs did before E34 - a write moved to any of them is still read.
        const family = ["incident-store.mjs", "murder-rules.mjs", "murder-ui.mjs", "murder.mjs"];
        const familySources = new Map(sources);
        const byFile = family.map(file => [file, named(familySources.get(file) ?? "")]);
        ok(family.every(file => familySources.has(file)), `the census reads a file of the incident that is not among the module's sources: ${family.join(", ")}`);
        const keys = byFile.flatMap(([, fileKeys]) => fileKeys);
        // Not a reading of nothing: the incident's writes name the stage, the turn and the method (measured in murder.mjs 26.09: 74 names, 26 of them distinct).
        // E34 C8 (1.2.70): the writes moved to murder-rules.mjs with the rules - 88 names read there on 07.10.2026, 0 in murder.mjs.
        ok(keys.length > 50 && ["stage", "turn", "indirect", "endedBy", "keyRemnantsStale"].every(key => keys.includes(key)), `the census read ${keys.length} field names in the incident's writes - too few to trust`);
        log(`R191: ${listed.length} public fields, ${S.INCIDENT_METHOD.length} of the method in the cast, ${keys.length} field names read in the incident's writes (${byFile.map(([file, fileKeys]) => `${file} ${fileKeys.length}`).join(", ")})`);
        const bad = unlisted(keys);
        ok(!bad.length, `a write of an incident names a field neither the public list nor the cast holds: ${bad.join(", ")}`);
    }],

    ["R192 - the deceased flag is read only by the death predicates and written only by chapter.mjs", async () => {
        /*
         * E05 C9, 26.09.2026; audit S17-11. "Is this student dead?" was asked in eighteen
         * places - chapter.mjs's two readers, fifteen copies in ten other files reading
         * the flag straight off the actor, and traps.mjs's read of the token's "dead"
         * status - measured by this test on the tree before C9, which it failed with
         * exactly those eighteen. E05 C10 makes a death secret until its body is found, and then
         * every one of those reads has to pick an answer: the table's fact (`isDeceased`)
         * or what this browser may know (`isDeadForGm`), both in settings.mjs. A copy left
         * reading the flag would keep answering with the public fact wherever it sat, so
         * this census of the module's sources (the suite's files are not read: their
         * fixtures write the flag as a table's world might) holds that the flag is read
         * only by settings.mjs's `deathRecord` and `isDeceased`, named only where config.mjs
         * defines it, written only by chapter.mjs's `markDeceased` and `reviveCharacter`
         * (the "dead" status likewise), and read as a change's key only by voice.mjs's
         * updateActor hook, which reconciles on the change and asks the predicates after.
         * Attribution is by the top-level function or constant the mention sits in. A
         * planted read of each kind is found first.
         */
        const TOKEN = /\bFLAGS\.deceased\b|["'`]deceased["'`]|\?*\.deceased\b|\bdeceased\s*:/g;
        const STATUS = /\bstatuses\??\.has\??\.?\(\s*["'`]dead["'`]|\b(?:has|toggle)StatusEffect\??\.?\(\s*["'`]dead["'`]/g;
        const DECL = /^(?:export )?(?:(?:async )?function|const|let)\s+(\w+)/gm;
        const ALLOWED = {
            "config.mjs FLAGS flag": "the flag's name, defined",
            "settings.mjs deathRecord flag": "the record, read",
            "settings.mjs isDeceased flag": "the table's fact, read",
            "chapter.mjs bodiesToDiscover flag": "the body rule reads the record off the primary's mark (E11 C1)",
            "chapter.mjs markDeceased flag": "the one write",
            "chapter.mjs markDeceased status": "the token's marker, written with the flag",
            "chapter.mjs reviveCharacter flag": "the one unwrite",
            "chapter.mjs reviveCharacter status": "the marker, taken off with it",
            "voice.mjs registerVoice flag": "the updateActor hook reads the change's key, not the actor",
            // E29 C3: the GMs' audit holds the GM-only flags in a student's mark and puts a player's write of one back;
            // it names the flag among the others and never asks whether a student is dead.
            "sheet-audit.mjs GM_FLAGS flag": "a GM-only flag, held in the GMs' mark and put back"
        };
        const census = files => {
            const out = [];
            for (const [file, text] of files) {
                const src = stripComments(text);
                const decls = [...src.matchAll(DECL)];
                const at = (m, kind) => {
                    const fn = decls.filter(d => d.index < m.index).pop()?.[1] ?? "(top level)";
                    out.push(`${file} ${fn} ${kind}`);
                };
                for (const m of src.matchAll(TOKEN)) at(m, "flag");
                for (const m of src.matchAll(STATUS)) at(m, "status");
            }
            return out;
        };
        const planted = "function plantedA(actor) {\n    return actor.getFlag(MODULE_ID, FLAGS.deceased);\n}\n"
            + "function plantedB(actor) {\n    return actor.flags?.[MODULE_ID]?.deceased || actor.statuses?.has?.(\"dead\");\n}\n"
            + "async function plantedC(actor) {\n    await actor.update({ flags: { [MODULE_ID]: { deceased: null } } });\n}\n";
        equal(JSON.stringify(census([["planted.mjs", planted]])),
            JSON.stringify(["planted.mjs plantedA flag", "planted.mjs plantedB flag", "planted.mjs plantedC flag", "planted.mjs plantedB status"]),
            "the census does not find exactly the four planted mentions");

        const found = census(await otherSources());
        const allowed = Object.keys(ALLOWED);
        log(`R192: ${found.length} mentions of the flag or the status in the module's sources, ${found.filter(key => allowed.includes(key)).length} of them allowed`);
        const stray = found.filter(key => !allowed.includes(key));
        ok(!stray.length, `the deceased flag or the dead status is read or written outside the predicates and chapter.mjs (${stray.length}): ${stray.join(", ")}`);
        // Not a reading of nothing: the readers and the writers themselves are seen.
        const missing = allowed.filter(key => !found.includes(key));
        ok(!missing.length, `the census did not see the predicates and the writers it allows: missing ${missing.join(", ")}`);
    }],

    ["R194 - whether an incident is a trap is asked of one rule, the cast's and the world half's where the cast has none", async () => {
        /*
         * E05 fix r1-G1, 27.09.2026; the correctness review's M2. Three places ask whether the
         * running incident is a trap - `castOwners` (incident-store.mjs: who is sent the cast), the
         * leaf's `incidentWitness` (the card's gate, the HUD's turn row, the edges, the music)
         * and the opening Event card (events.mjs `openingCard`) - and the review found them
         * answering two ways while a world half the lift has not reached still holds
         * `indirect`: the first falling back to the world half, the other two reading the cast
         * alone. settings.mjs `incidentIndirect` is the rule, and held here: each of the three
         * asks it, and none reads a cast's `indirect` itself. The reader is shown a planted body
         * first. The rule's own cases are the tier-2 test "a trap a world half still holds is a
         * trap to every reader until the lift reaches it".
         */
        /* E06 C2 (27.09.2026): the seats are one table, settings.mjs `incidentSeats`, which asks
           the rule; the opening card reads its seats there and asks nothing else, so for a reader
           asking the table counts as asking the rule - and the table itself, read here as a
           fourth reader, must ask the rule by name. */
        const ASKS = /\bincident(?:Indirect|Seats)\(/, RULE = /\bincidentIndirect\(/;
        const READERS = [["incident-store.mjs", "castOwners", ASKS], ["settings.mjs", "incidentWitness", ASKS], ["events.mjs", "openingCard", ASKS],
            ["settings.mjs", "incidentSeats", RULE]];
        const problems = (label, body, asks = ASKS) => {
            if (!body) return [`${label} was not found - this test reads nothing until it is pointed at it again`];
            const out = [];
            if (!asks.test(body)) out.push(`${label} does not ask incidentIndirect whether it is a trap`);
            if (/\bcast\??\.indirect\b/.test(body)) out.push(`${label} reads the cast's indirect itself`);
            return out;
        };
        equal(JSON.stringify(problems("planted", "function planted(cast) {\n    return cast.indirect ? 1 : 2;\n}\n")),
            JSON.stringify(["planted does not ask incidentIndirect whether it is a trap", "planted reads the cast's indirect itself"]),
            "the reader does not find the two faults planted for it");
        const sources = new Map(await otherSources());
        const found = [];
        for (const [file, fn, asks] of READERS) found.push(...problems(`${file} ${fn}`, fnSource(stripComments(sources.get(file) ?? ""), fn), asks));
        log(`R194: ${READERS.length} readers of whether an incident is a trap, read in ${new Set(READERS.map(r => r[0])).size} files`);
        ok(!found.length, `whether an incident is a trap is not asked of one rule: ${found.join("; ")}`);
    }],

    ["R197 - no text of the Despair Flow window or the season checklist names the Mastermind beside \"- nobody -\"", async () => {
        /*
         * E05 C15, 27.09.2026; audit S03-03, S10-12. Despair Flow's footnote and the season
         * checklist's hint named the Mastermind as the student to set to "- nobody -", and the
         * division is the world setting `gmAssignments`, which every player's browser receives:
         * a GM who followed the advice made the Mastermind the one student a console could see
         * left out of every pool. The advice is gone (the season checklist and the case health
         * report now warn when it has been followed - mastermind.mjs `mastermindUnpooled`), and
         * this holds it gone, in both languages: no string the window's source names, and no
         * DRPG.Season string, mentions the Mastermind together with the "- nobody -" choice - its
         * label, or the word (en "nobody", pl "nikt", "nikogo", "nikomu"). The reader is shown a
         * planted string first. What it cannot see: a sentence that gives the same advice in
         * other words.
         */
        const NOBODY = { en: /\bnobody\b/i, pl: /\bnik(?:t|ogo|omu)\b/i };
        const offenders = (strings, inScope, lang) => Object.keys(strings).filter(key => inScope(key)
            && /mastermind/i.test(strings[key])
            && (NOBODY[lang].test(strings[key]) || strings[key].includes(strings["DRPG.Assign.nobody"] ?? "\u0000")));
        const PLANTED = {
            "DRPG.Assign.nobody": "- nobody -",
            "DRPG.Assign.planted": "Choose “- nobody -” for a Mastermind.",
            "DRPG.Season.hint.plantedWord": "Set the Mastermind to nobody.",
            "DRPG.Season.hint.plantedFine": "A season without a Mastermind is a legal season.",
            "DRPG.Other.plantedOutOfScope": "Set the Mastermind to nobody."
        };
        equal(JSON.stringify(offenders(PLANTED, key => key !== "DRPG.Other.plantedOutOfScope", "en")),
            JSON.stringify(["DRPG.Assign.planted", "DRPG.Season.hint.plantedWord"]),
            "the reader does not find the two strings planted for it, or finds the one that is fine");

        const flat = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) =>
            typeof v === "object" && v !== null ? flat(v, p ? `${p}.${k}` : k) : [[p ? `${p}.${k}` : k, String(v)]]);
        const language = async lang => {
            const res = await fetch(`/modules/${MODULE_ID}/lang/${lang}.json`);
            must(res.ok, `${lang}.json: HTTP ${res.status}`);
            return Object.fromEntries(flat(foundry.utils.expandObject(await res.json())));
        };
        // The keys the two windows' sources name, the checklist's own rows (`DRPG.Season.step.<key>`,
        // `.hint.<key>`) being every DRPG.Season string.
        const named = new Set();
        for (const file of ["gm-team-dialog.mjs", "season-setup.mjs"]) {
            const src = await fetch(`/modules/${MODULE_ID}/scripts/${file}`).then(r => r.text());
            for (const m of src.matchAll(/["`](DRPG\.[A-Za-z0-9_.]*[A-Za-z0-9_])["`]/g)) named.add(m[1]);
        }
        const inScope = key => named.has(key) || key.startsWith("DRPG.Season.");
        const found = [];
        let read = 0;
        for (const lang of ["en", "pl"]) {
            const strings = await language(lang);
            must(strings["DRPG.Assign.nobody"], `${lang}.json has no DRPG.Assign.nobody - this test reads nothing until it is pointed at it again`);
            read += Object.keys(strings).filter(inScope).length;
            found.push(...offenders(strings, inScope, lang).map(key => `${lang} ${key}`));
        }
        log(`R197: ${named.size} keys named by the two windows' sources, ${read} strings read in en and pl`);
        ok(read >= 100, `only ${read} strings were read - the scope is not what this test thinks it is`);
        ok(!found.length, `a text of Despair Flow or the season checklist still names the Mastermind beside "- nobody -": ${found.join(", ")}`);
    }],

    ["R201 - every socket emit names its recipients but the four that carry nothing", async () => {
        /*
         * E06 C1, 27.09.2026; audit S08-07 (the net it asked for), L27. A `socket.emit` with no
         * `recipients` reaches every connected browser, a player's among them, whatever the packet
         * was meant for. S08-07's own case - the trap relay - goes to the primary through the bridge
         * since E31. The E06 design read scripts/*.mjs without the suite's files at 51e10c7: 39
         * emits, 35 addressed, and four that name nobody and carry no id - the same four at d666a2a,
         * listed below with what they carry and why everybody gets them. A fifth un-addressed emit, a second one in a file
         * that has one, or one of the four gaining a field fails; one of the four gone fails too, so
         * the list does not outlive its reason. The reader is shown planted source first. What it
         * cannot see: an emit through a name other than `socket`, and what a packet's own values
         * hold - `data` of sync.mjs is whatever its caller hands `broadcast` (at d666a2a the clock,
         * whether an Eclipse is on, and two empty packets: clock.mjs, eclipse.mjs, call-effects.mjs,
         * observe.mjs).
         */
        const BROADCAST = {
            "fog.mjs": { fields: ["action"], why: "the primary GM asking every player's browser for its copy of the fog ledger when its own store holds nothing (askForShares)" },
            "gm-bridge.mjs": { fields: ["action"], why: "a GM saying they are listening, so a player whose request is still waiting sends it again" },
            "relay-guard.mjs": { fields: ["action", "data"], why: "Daggerheart's countdown refresh after a countdown change, sent as Daggerheart's own handler sends it" },
            "sync.mjs": { fields: ["action", "data", "kind"], why: "a public change every browser redraws: the clock, the Eclipse, the projects, the restrictions" }
        };
        /* The emits of one file: where, whether the third argument names `recipients`, and the
           payload's top-level keys when it is an object literal ("..." a spread; null any other
           payload, which no entry above matches). Comments and strings are blanked first. */
        const keysOf = literal => {
            const inner = literal.slice(1, -1);
            const keys = [];
            let depth = 0, start = 0;
            for (let i = 0; i <= inner.length; i++) {
                const c = inner[i];
                if (c === "(" || c === "[" || c === "{") depth++;
                else if (c === ")" || c === "]" || c === "}") depth--;
                else if ((c === "," && depth === 0) || i === inner.length) {
                    const part = inner.slice(start, i).trim();
                    if (part) keys.push(part.startsWith("...") ? "..." : (part.match(/^[A-Za-z_$][\w$]*/)?.[0] ?? part));
                    start = i + 1;
                }
            }
            return keys.sort();
        };
        const emitsIn = text => {
            const code = blankComments(text), blank = blankLiterals(code);
            return [...blank.matchAll(/\bsocket\s*\??\.\s*emit\s*\(/g)].map(m => {
                const { args } = callArgs(blank, m.index + m[0].length - 1);
                const arg = i => (args[i] ? blank.slice(args[i].start, args[i].end).trim() : "");
                return { line: lineAt(code, m.index), addressed: /\brecipients\b/.test(arg(2)),
                    fields: /^\{[\s\S]*\}$/.test(arg(1)) ? keysOf(arg(1)) : null };
            });
        };
        const PLANTED = [
            "game.socket.emit(SOCKET_EVENT, { action: A, who }, { recipients: [id] });",
            "game.socket.emit(SOCKET_EVENT, { action: B, note: \"recipients\", ...(x ? { x } : {}) }, { note: \"recipients\" });",
            "game.socket?.emit(`module.${MODULE_ID}`, payload);",
            "// game.socket.emit(SOCKET_EVENT, { action: C });"
        ].join("\n");
        equal(JSON.stringify(emitsIn(PLANTED)), JSON.stringify([{ line: 1, addressed: true, fields: ["action", "who"] },
            { line: 2, addressed: false, fields: ["...", "action", "note"] }, { line: 3, addressed: false, fields: null }]),
            "the reader does not see the planted emits as they are - an address, a word \"recipients\" in a string, a payload by name, a comment");

        const found = [], broadcast = new Map();
        let read = 0;
        for (const [file, raw] of await otherSources()) {
            for (const emit of emitsIn(raw)) {
                read++;
                if (emit.addressed) continue;
                const listed = BROADCAST[file];
                if (!listed) found.push(`${file}:${emit.line} sends to every browser and is not one of the four`);
                else if (broadcast.has(file)) found.push(`${file}:${emit.line} is a second emit to every browser in ${file} (the listed one is at :${broadcast.get(file)})`);
                else if (JSON.stringify(emit.fields) !== JSON.stringify(listed.fields)) {
                    found.push(`${file}:${emit.line} carries ${JSON.stringify(emit.fields)} to every browser, and the list says ${JSON.stringify(listed.fields)} (${listed.why})`);
                }
                if (!broadcast.has(file)) broadcast.set(file, emit.line);
            }
        }
        log(`R201: ${read} socket emits read in the served sources, ${[...broadcast.keys()].length} of them to every browser`);
        ok(read >= 30, `only ${read} socket emits were read - the reader is not reading what this test thinks`);
        const gone = Object.keys(BROADCAST).filter(file => !broadcast.has(file));
        ok(!gone.length, `listed as an emit to every browser and no longer found - take it off the list: ${gone.join(", ")}`);
        ok(!found.length, `an emit reaches every browser that the list does not describe: ${found.join("; ")}`);
    }],

    ["R205 - every write of an incident in murder.mjs runs in its queue, and nothing in the queue queues again", async () => {
        /*
         * E32 C4, 28.09.2026; audit S04-26. Two writers of one incident read it, awaited and
         * wrote what they had read: the victim ran out twice (the grid's DM14), two closes of
         * one incident closed it twice. Every write of the incident runs through
         * one promise chain now (`incidentWrite`), and a transition says what it read
         * (`expect`) and stops when the state no longer shows it. Read here, on the source
         * with comments and string contents blanked: every write of either half - a
         * `castStore` write, a `set` of `murderState`, a call of the two leaves `writeCast` and
         * `armBetrayalWindow` - lies inside the argument of an `incidentWrite(` call or in a
         * leaf's own body; no `writeState(`, `restoreState(` or `incidentWrite(` call lies in
         * either, or the chain would wait on itself; and each transition the design names
         * passes `expect` and stops on the null. A function a queued write calls that is
         * neither a leaf nor a writer (`pushCastToParticipants`, the hooks a setting's change
         * fires) is not followed: only the calls written inside the queue are read. Other
         * files' writes of `murderState` (the season reset's table) are R191's, not this
         * queue's. The reader is shown a planted source of each kind first.
         * E32+E07 fix r1-G3 (02.10.2026; review C-M2): the Reroll's rewind (`undoLastCrisis`)
         * is a transition too - without `expect` it brought a closed incident back.
         * E32+E07 fix r2-G2 (03.10.2026): what each player was last sent of the cast (`sent`) is
         * the GMs' delivery memo, not the incident, and its one writer (`rememberSent`) runs
         * outside the queue - a push runs inside it, an answer outside - so its body is not read
         * as a stray, and it writes `sent` alone. Fix r2-G4 (03.10.2026) adds the second memo of the
         * GMs', the opening's request cards (`openingNotices`), whose one writer
         * (`rememberOpeningNotices`) runs outside the queue for the same reason and writes that alone.
         * E33 C8 (07.10.2026): a third leaf, `castPutBack` - the cast stamped back when the world
         * half's write threw. It calls `writeCast` from its own body and is itself read as a write,
         * so a call of it outside the two queued spans is a stray as a `writeCast(` would be.
         */
        const LEAVES = ["writeCast", "armBetrayalWindow", "castPutBack"];
        const MEMO = "rememberSent", NOTICES = "rememberOpeningNotices";
        const WRITE = /\bcastStore\.(?:patch|resetRecord|set|drop\w*|clear|replace\w*)\(|\.set\(\s*[\w.]+\s*,\s*SETTINGS\.murderState\b|(?<!function )\b(?:writeCast|armBetrayalWindow|castPutBack)\(/g;
        const QUEUES = /(?<!function )\b(?:writeState|restoreState|incidentWrite)\(/g;
        const DECL = /^(?:export )?(?:async )?function\s+(\w+)/gm;
        const read = (file, text) => {
            const src = stripStrings(stripComments(text));
            const decls = [...src.matchAll(DECL)];
            const fnAt = at => decls.filter(d => d.index < at).pop()?.[1] ?? "(top level)";
            const spans = [];
            for (const m of src.matchAll(/(?<!function )\bincidentWrite\(/g)) {
                const open = m.index + m[0].length - 1;
                let depth = 0, close = open;
                for (let i = open; i < src.length; i++) {
                    if ("([{".includes(src[i])) depth++;
                    else if (")]}".includes(src[i]) && --depth === 0) { close = i; break; }
                }
                spans.push([open, close]);
            }
            const queued = at => spans.some(([a, b]) => at > a && at < b);
            const stray = [], again = [];
            for (const m of src.matchAll(WRITE)) {
                if (!queued(m.index) && !LEAVES.includes(fnAt(m.index)) && ![MEMO, NOTICES].includes(fnAt(m.index))) stray.push(`${file} ${fnAt(m.index)}`);
            }
            for (const m of src.matchAll(QUEUES)) {
                if (queued(m.index) || LEAVES.includes(fnAt(m.index))) again.push(`${file} ${fnAt(m.index)}`);
            }
            return { spans: spans.length, writes: [...src.matchAll(WRITE)].length, stray, again };
        };
        const planted = "async function queued() {\n    await incidentWrite(async () => { await castStore.patch(RECORD, { a: \")\" }); });\n}\n"
            + "async function writeCast(next) {\n    await castStore.patch(RECORD, next);\n}\n"
            + "async function stray() {\n    await game.settings.set(MODULE_ID, SETTINGS.murderState, {});\n}\n"
            + "async function loose() {\n    await writeCast({ turn: 1 });\n    await incidentWrite(() => writeCast({}));\n}\n"
            + "async function nested() {\n    await incidentWrite(async () => { await writeState({ stage: \"incident\" }); });\n}\n";
        const seen = read("planted.mjs", planted);
        equal(JSON.stringify([seen.spans, seen.writes, seen.stray, seen.again]),
            JSON.stringify([3, 5, ["planted.mjs stray", "planted.mjs loose"], ["planted.mjs nested"]]),
            "the reader does not find exactly the two writes and the one queue inside the queue planted for it");

        /* E34 C7a (1.2.70): the queue, the two writers and the three leaves moved to
           incident-store.mjs, and most transitions that queue a write stayed in murder.mjs, so each
           file is read on its own - `fnAt` names a function of the file it reads - and the two are
           summed (07.10.2026: 15 writes and 4 queued spans in the store, 9 and 7 in murder.mjs; the
           24 and 11 murder.mjs held alone before the move). E34 C8 moved the transitions on to murder-rules.mjs,
           which the reader and the transitions below follow: the two summed read 24 and 11 again, and murder.mjs
           alone 0 and 0 (07.10.2026). E34 fix r2-G2 (08.10.2026; the round-2 review's m7) reads murder-ui.mjs and the
           facade too - every file murder.mjs was split into, as the one read of murder.mjs covered all of it - so a
           write that moves to the window is still read. */
        const sources = new Map(await otherSources());
        const family = ["incident-store.mjs", "murder-rules.mjs", "murder-ui.mjs", "murder.mjs"];
        ok(family.every(file => sources.has(file)), `the reader reads a file of the incident that is not among the module's sources: ${family.join(", ")}`);
        const perFile = family.map(file => read(file, sources.get(file) ?? ""));
        const found = perFile
            .reduce((a, b) => ({ spans: a.spans + b.spans, writes: a.writes + b.writes, stray: [...a.stray, ...b.stray], again: [...a.again, ...b.again] }));
        // Not a reading of nothing: measured on 28.09, 17 writes and 8 queued spans.
        ok(found.writes >= 15 && found.spans >= 6, `the reader found ${found.writes} writes and ${found.spans} queued spans in the incident's files - too few to trust`);
        log(`R205: ${found.writes} writes of the incident and ${found.spans} queued spans read in ${family.map((file, i) => `${file} ${perFile[i].writes}/${perFile[i].spans}`).join(", ")}`);
        ok(!found.stray.length, `an incident's write runs outside its queue: ${found.stray.join(", ")}`);
        ok(!found.again.length, `a write in the incident's queue queues another, and the chain would wait on itself: ${found.again.join(", ")}`);

        const bare = stripComments(sources.get("murder-rules.mjs") ?? "");
        const store = stripComments(sources.get("incident-store.mjs") ?? "");
        const memo = fnSource(store, MEMO);
        ok(/\bcastStore\.patch\(RECORD, \{ sent: \{ \[userId\]: memo \} \}\)/.test(memo) && [...stripStrings(memo).matchAll(WRITE)].length === 1,
            `the memo's writer (${MEMO}) is gone, or writes more than what a player was sent`);
        const notices = fnSource(store, NOTICES);
        ok(/\bcastStore\.patch\(RECORD, \{ openingNotices: notices \}\)/.test(notices) && [...stripStrings(notices).matchAll(WRITE)].length === 1,
            `the request cards' writer (${NOTICES}) is gone, or writes more than the cards' ids`);
        const TRANSITIONS = ["checkVictimSpent", "finishIncident", "beginResolution", "passTurn", "thirdPartyEnters",
            "resolveKillerOpening", "resolveVictimOpening", "closeIncident", "undoLastCrisis"];
        const blind = TRANSITIONS.filter(fn => !/if \(!await (?:writeState|restoreState)\([^;]*\bexpect: /.test(fnSource(bare, fn)));
        ok(!blind.length, `a transition writes without saying what it read, or goes on when the write is refused: ${blind.join(", ")}`);
    }],

    ["R213 - no several-trait roll escapes the GM: nothing takes a list's first trait but a list of one, and every definition that lists several is a ruling's", async () => {
        /*
         * E32+E07 C11d, 02.10.2026; audit S04-23 and the owner's rules of 28.09.2026. Wherever a
         * definition lists several traits a GM picks (trait-ruling.mjs `traitFor`), Resolve
         * excepted. The way round that is code taking a list's first trait - every crisis action
         * rolled `(variant?.traits ?? def.traits)[0]` until C11b, the openings `def.traits[0]`
         * until C11c - or a definition that lists several and is no ruling's to ask. Three
         * readings, the first two tried first on planted text and a planted catalogue:
         *   1. every `traits ... [0]` in the served sources (comments and strings blanked) stands
         *      in a function of FIRSTS, which names the definition it reads, and that definition
         *      lists one trait - so Search back on Eye or Hand fails here;
         *   2. every object of config.mjs with a `traits` list of two or more is one of
         *      `ruledDefinitions()`, by identity;
         *   3. `OWN_PERFORMERS`, the actions trait-ruling.mjs keeps out of the generic kind, are
         *      the cases of `performAction`'s switch - a new case left out of it would be asked
         *      about as a generic action, one in it and not the switch never would.
         */
        const T = await import("./trait-ruling.mjs");
        const C = await import("./config.mjs");
        const FIRST = /\btraits\b\s*\)?\s*(?:\?\.)?\s*\[\s*0\s*\]/g;
        const firstsIn = text => {
            const code = blankComments(text), blank = blankLiterals(code);
            const fns = [...code.matchAll(/^(?:export )?(?:async )?function (\w+)\(/gm)];
            return [...blank.matchAll(FIRST)].map(m => fns.filter(f => f.index < m.index).pop()?.[1] ?? "(top level)");
        };
        const PLANTED = [
            "function struck() {\n    return rollTrait(actor, CRISIS_ACTIONS.strike.traits[0]);\n}",
            "async function variant() {\n    const t = (variant?.traits ?? def.traits)[0];\n    // def.traits[0], in a comment\n    return \"def.traits[0]\";\n}",
            "function optional() {\n    return def.traits?.[0] ?? \"eye\";\n}"
        ].join("\n");
        equal(JSON.stringify(firstsIn(PLANTED)), JSON.stringify(["struck", "variant", "optional"]),
            "the reader does not find the three planted firsts, or finds the comment's or the string's");

        // The functions that take a list's first, and the definition each reads; measured 02.10.2026.
        // roll-draw.mjs held a drawn Search to Search's one trait with a first of its own from E08+E28
        // C12b (04.10.2026) until E29 fix r1-G10, whose table of sources (`TRAIT_SOURCES`) reads each
        // definition's list whole and takes a statistic from it only where it lists one; Tamper's door
        // takes Tamper's first with a `slice`, as `cleanupTrait` takes it - no `[0]` for this to read.
        const FIRSTS = {
            "action-rolls.mjs chooseSearchCategory": ACTIONS.search,
            "action-rolls.mjs performPalm": ACTIONS.palm,
            "cleanup.mjs cleanupTrait": ACTIONS.tamper
        };
        const sites = [];
        for (const [file, text] of await otherSources()) for (const fn of firstsIn(text)) sites.push(`${file} ${fn}`);
        equal(JSON.stringify([...new Set(sites)].sort()), JSON.stringify(Object.keys(FIRSTS).sort()),
            "a function takes a list's first trait that this test does not know, or one it knows no longer does");
        const several = Object.entries(FIRSTS).filter(([, def]) => (def?.traits ?? []).length !== 1).map(([site]) => site);
        ok(!several.length, `a first trait is taken from a list of several, which a GM should pick from: ${several.join(", ")}`);

        const unruledIn = (roots, ruled) => {
            const seen = new Set(), found = [];
            const walk = (value, at) => {
                if (!value || typeof value !== "object" || seen.has(value)) return;
                seen.add(value);
                if (Array.isArray(value.traits) && value.traits.length > 1) found.push([at, ruled.has(value)]);
                for (const [key, inner] of Object.entries(value)) walk(inner, `${at}.${key}`);
            };
            for (const [key, value] of Object.entries(roots)) walk(value, key);
            return found;
        };
        const fake = { A: { x: { traits: ["eye", "hand"] } }, B: [{ traits: ["eye"] }], C: { traits: ["hand", "leg"] } };
        equal(JSON.stringify(unruledIn(fake, new Set([fake.C]))), JSON.stringify([["A.x", false], ["C", true]]),
            "the catalogue reader does not find the planted lists of several, or misreads which is a ruling's");
        const found = unruledIn(C, T.ruledDefinitions());
        // Not a reading of nothing: 14 definitions list several at 1.2.66 (15 with Search on Eye or Hand).
        ok(found.length >= 12, `the reader found ${found.length} definitions that list several traits - too few to trust`);
        log(`R213: ${found.length} definitions list several traits, ${new Set(sites).size} functions take a list's first`);
        const loose = found.filter(([, ruled]) => !ruled).map(([at]) => at);
        ok(!loose.length, `a definition lists several traits and no ruling asks a GM about it: ${loose.join(", ")}`);

        const dispatch = fnSource(stripComments(new Map(await otherSources()).get("action-rolls.mjs") ?? ""), "performAction");
        const cases = [...dispatch.matchAll(/\bcase "(\w+)":/g)].map(m => m[1]);
        equal(JSON.stringify([...cases].sort()), JSON.stringify([...T.OWN_PERFORMERS].sort()),
            "trait-ruling.mjs OWN_PERFORMERS is not the list of performAction's own performers");
    }],

    ["R214 - the hidden stash's step is the old count's die, exactly: every window from -3 to 3, every die and every draw", async () => {
        /*
         * E32+E07 C11e, 02.10.2026; the owner's decision of 28.09.2026 (the hidden stash's
         * disadvantage die, back, and still out of the roll window). Until 1.2.64 a hidden stash
         * was -1 in the count the window turns into dice, and Daggerheart's `applyAdvantage`
         * (dualityRoll.mjs:146-160, 2.6.5) throws |n| dice of one kind, keeps the highest above
         * one (`kh`), and adds it for advantage or takes it off for disadvantage; roll-dialog.mjs
         * caps |n| at ADVANTAGE_CAP. Since E06 C11 the window arms the room's count alone and the
         * stash is a step on the dice it threw (action-rolls.mjs `stashStep`). For every window
         * count n from -3 to 3, every face of its d6s and every value each `draw(m)` may give
         * (1 to m, each branch weighted 1/m), the distribution of what the dice put on the total
         * after the step is compared, exactly - counts over a common denominator, not samples -
         * with that of the old count's n - 1. Red until C11e (no `stashStep`). This body, run
         * outside the suite on 02.10.2026 against stand-ins: E06 C11's flat -1 differs at every
         * n; a d6 simply taken off after the roll (the first proposal of 28.09) at every n but 0;
         * setting aside the lowest bonus die instead of a drawn one, at n = 2 and 3.
         */
        const R = await import("./action-rolls.mjs");
        ok(typeof R.stashStep === "function", "action-rolls.mjs has no stashStep");
        if (typeof R.stashStep !== "function") return;
        const { ADVANTAGE_CAP } = await import("./roll-dialog.mjs");
        must(Number.isInteger(ADVANTAGE_CAP), "roll-dialog.mjs exports no ADVANTAGE_CAP");
        const FACES = 6, SCALE = FACES ** 4, STOP = Symbol("draw");
        const throws = k => Array.from({ length: FACES ** k }, (_, i) =>
            Array.from({ length: k }, (__, j) => 1 + Math.floor(i / FACES ** j) % FACES));
        const kept = (sign, faces) => faces.length ? sign * Math.max(...faces) : 0;
        const add = (map, value, weight) => map.set(value, (map.get(value) ?? 0) + weight);
        const stepped = n => {
            const k = Math.min(ADVANTAGE_CAP, Math.abs(n)), sign = Math.sign(n), out = new Map();
            for (const results of throws(k)) {
                const walk = (script, weight) => {
                    let used = 0, asked = 0;
                    const draw = m => {
                        if (used < script.length) return script[used++];
                        asked = m;
                        throw STOP;
                    };
                    try {
                        const step = R.stashStep({ sign, results, faces: FACES, cap: ADVANTAGE_CAP }, draw);
                        add(out, kept(sign, results) + step.change, weight);
                    } catch (err) {
                        if (err !== STOP) throw err;
                        for (let face = 1; face <= asked; face++) walk([...script, face], weight / asked);
                    }
                };
                walk([], SCALE);
            }
            return { out, den: FACES ** k * SCALE };
        };
        const counted = n => {
            const m = Math.min(ADVANTAGE_CAP, Math.abs(n)), out = new Map();
            for (const results of throws(m)) add(out, kept(Math.sign(n), results), 1);
            return { out, den: FACES ** m };
        };
        const differs = [];
        for (let n = -3; n <= 3; n++) {
            const now = stepped(n), then = counted(n - 1);
            const values = [...new Set([...now.out.keys(), ...then.out.keys()])].sort((a, b) => a - b);
            const off = values.filter(v => (now.out.get(v) ?? 0) * then.den !== (then.out.get(v) ?? 0) * now.den);
            if (off.length || ![...now.out.values()].every(Number.isInteger)) differs.push(`${n}: ${off.join(" ")}`);
        }
        equal(differs.join("; "), "", "the step does not land where the old count's dice did (window count: the values whose odds differ)");
    }],

    ["R215 - no player packet carries an undo", async () => {
        /*
         * E08+E28 C8, 03.10.2026; audit S10-06 (the undo), S02-19. Until C4a a Reroll took its
         * action back from the roller's browser, with packets that said `undo` (an Observe, an
         * Analyze, a crisis action, a clean-up), a negative amount (progress), or that were
         * nothing but an undo (`despair.adjust`, `project.unsabotage`, `remnant.edit`), and E03
         * let each one through on a receipt (R134, R135, removed here). The GM makes the Reroll
         * now, so a player's undo is refused (`guardUndoIsTheGms`, reason `undoIsTheGms`) and
         * never reaches a run. Read live, as R134 read it: every declaration of the bridge's
         * tables, its whitelist asked with a player's `undo` and a GM's, and its guards. Red
         * before C8: four whitelists hand a player's `undo` to the run.
         */
        const G = await import("./bridge-guards.mjs");
        const all = Object.assign({}, ...(await bridgeTables()).map(t => t.table));
        must(Object.keys(all).length > 30, `the bridge's tables hold ${Object.keys(all).length} declarations - this would measure nothing`);
        const player = { id: "SUITEPLAYER00215", name: "suite player", isGM: false };
        const gm = { id: "SUITEGMUSER00215", name: "suite GM", isGM: true };
        const takesUndo = Object.entries(all).filter(([, decl]) => "undo" in (decl.sanitize?.fields ?? {}));
        must(takesUndo.length >= 4, `only ${takesUndo.length} declaration(s) list undo - the GM's own Reroll needs observe, analyze, crisis and clean-up's`);
        const carried = takesUndo.filter(([, decl]) => decl.sanitize({ undo: true }, player).undo !== false).map(([action]) => action);
        ok(!carried.length, `these hand a player's undo to their run: ${carried.join(", ")}`);
        const lost = takesUndo.filter(([, decl]) => decl.sanitize({ undo: true }, gm).undo !== true).map(([action]) => action);
        ok(!lost.length, `these drop a GM's undo, which the GM's own Reroll sends: ${lost.join(", ")}`);
        const UNDO = /^an undo is the GM's own Reroll's$/;
        const asks = guards => (guards ?? []).some(guard => guard === G.guardUndoIsTheGms
            || (guard?.factory === "gmOnly" && UNDO.test(String(guard.why))));
        const unasked = [...takesUndo.map(([action]) => action), "project.progress", "despair.adjust", "project.unsabotage", "remnant.edit"]
            .filter(action => !asks(all[action]?.guards));
        ok(!unasked.length, `these take something back and do not refuse a player's undo with its reason: ${unasked.join(", ")}`);
        const whole = ["despair.adjust", "project.unsabotage", "remnant.edit"].filter(action =>
            !all[action]?.guards?.some(guard => guard?.factory === "gmOnly" && UNDO.test(String(guard.why))));
        ok(!whole.length, `these are only ever an undo and are not a GM's alone: ${whole.join(", ")}`);
        const guard = typeof G.guardUndoIsTheGms === "function" ? G.guardUndoIsTheGms : () => "no guard";
        equal(JSON.stringify([
            G.reasonOf(guard(player, { undo: true })), G.reasonOf(guard(player, { amount: -1 })), guard(player, { amount: 2 }),
            guard(player, { undo: false }), guard(gm, { undo: true }), guard(gm, { amount: -2 })
        ]), JSON.stringify(["undoIsTheGms", "undoIsTheGms", null, null, null, null]),
        "the guard does not refuse exactly a player's undo and a player's negative amount, with its reason");
        // Carried from R134: every guard a function of the bridge names is defined.
        const sources = new Map(await otherSources());
        const bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const leaf = stripComments(sources.get("bridge-guards.mjs") ?? "");
        must(bridge.length > 1000 && leaf.length > 1000, "gm-bridge.mjs or bridge-guards.mjs did not load");
        const both = `${bridge}\n${leaf}`;
        const nowhere = [...new Set([...bridge.matchAll(/^(?:export )?(?:async )?function (\w+)\(/gm)].map(m => m[1]))]
            .flatMap(name => withGuards(both, topLevelFunction(bridge, name)).missing.map(g => `${name} asks ${g}`));
        ok(!nowhere.length, `these functions ask a guard neither gm-bridge.mjs nor bridge-guards.mjs defines: ${nowhere.join(", ")}`);
    }],

    ["R218 - no declaration takes a roll's result from the packet", async () => {
        /*
         * E08+E28 C14, 04.10.2026; audit S10-06; the plan's 3.5 (its R217, which C12a took, so this
         * is the next free number). A run that scores a roll read the packet's `total`, `isCritical`
         * and `withHope`, and a packet can say anything. A declaration that takes a result says
         * where its roll is named now (`rolled`), and the runner hands the run the GMs' record of
         * that roll instead (bridge-guards.mjs `rollRefusal`). Read live: every declaration of the
         * bridge's tables that takes a result - a field of RESULT, or one a roll decides in that
         * declaration (DERIVED) - declares `rolled`, takes its `field` and `actor` as ids, has its
         * `actor` judged by an `owns` guard, and names an action of config.mjs as its `kind`; or it
         * is on WAITING, the declarations C15-C17 move, each of which must still take a result (a
         * name left there once its declaration moved is an exemption nobody needs). The reader is
         * run first on a fixture with five planted faults. Red before C14: Observe, Analyze and the
         * search for a hidden stash take a total and name no roll.
         *
         * C15 (04.10.2026) took a Palm's Steal and Plant, a theft from a stash and a trace off
         * WAITING, and `rolled` became one roll or a list (bridge-guards.mjs `rollsOf`): each is read
         * alike. Its `actor` may be a path into a field the declaration takes (a trace's
         * `data.sourceActor`), judged by an `owns`-kind guard that covers the field; a `kind` may be a
         * list, with `kindAt` the path that names which; `when` is a field taken as a flag; `into`
         * names fields the declaration takes; a `derive` is a function. A Palm's hand is thrown as
         * "steal", the Reroll's name for it (`THROWN_AS`). A sixth fixture is a list read clean.
         *
         * C16 (04.10.2026) took a project's progress and its Sabotage off WAITING. Progress that
         * names no roll is a Call's, so its `when` is the roll's own field - an id, not a flag -
         * and its guards bound what such a packet takes (bridge-guards.mjs `guardCallProgress`).
         *
         * C17 (04.10.2026) took the last four off WAITING, which is empty now and stays a list so a
         * declaration put back on it is read as the exemption it would be. An opening, a crisis
         * action and Stage 6 name their roll; their actions are the incident's tables of config.mjs,
         * not ACTIONS (`TABLES`: the record's `actionKey` names the table, as the roll is thrown for
         * it). A crisis packet that names no roll threw none, so its `when` is the roll's own field,
         * and its guards refuse the rest (bridge-guards.mjs `guardCrisisRoll`). A Monocub's ability
         * (`monocub.ability` since E33 C10, `monocub.meddle` before) takes no result from its packet
         * at all: the GM throws the row's dice (monocub.mjs `cubAbilityOnGm`), which the reader finds
         * as a declaration that takes nothing it has to name a roll for.
         */
        const RESULT = ["total", "isCritical", "withHope", "unseenTotal", "unseenCritical"];
        const DERIVED = { "project.progress": ["amount"], "project.sabotage": ["difficulty"], "remnant.place": ["data"],
            "vault.steal": ["viaSearch", "clumsy"] };
        const WAITING = [];
        const THROWN_AS = { steal: "palm" };
        const TABLES = { crisis: CRISIS_ACTIONS, cleanup: CLEANUP.actions, murderOpening: MURDER_OPENING };
        const takes = (action, decl) => Object.keys(decl.sanitize?.fields ?? {})
            .filter(field => RESULT.includes(field) || (DERIVED[action] ?? []).includes(field));
        const problemsOf = (all, waiting) => {
            const problems = [];
            for (const [action, decl] of Object.entries(all)) {
                const kinds = decl.sanitize?.fields ?? {};
                if (!decl.rolled) {
                    const taken = takes(action, decl);
                    if (taken.length && !waiting.includes(action)) problems.push(`${action}: takes ${taken.join(", ")} from the packet and names no roll`);
                    continue;
                }
                for (const { field, actor, kind, kindAt, when, into, derive } of [].concat(decl.rolled)) {
                    if (kinds[field] !== "id") problems.push(`${action}: its roll is named in ${field}, which it does not take as an id`);
                    const [head, ...path] = String(actor).split(".");
                    const judged = (decl.guards ?? []).some(guard => (guard?.factory === "owns" || (path.length && guard?.factory === "ownsActorAt"))
                        && guard.covers?.includes(head));
                    if ((path.length ? !kinds[head] : kinds[head] !== "id") || !judged) {
                        problems.push(`${action}: the roll's character, ${actor}, is not an id an owns guard judges`);
                    }
                    for (const one of [].concat(kind)) {
                        if (!Object.hasOwn(ACTIONS, THROWN_AS[one] ?? one) && !(Object.hasOwn(TABLES, one) && TABLES[one])) {
                            problems.push(`${action}: its roll's action ${one} is not an action of config.mjs`);
                        }
                    }
                    if (Array.isArray(kind) !== Boolean(kindAt) || (kindAt && !kinds[String(kindAt).split(".")[0]])) {
                        problems.push(`${action}: its roll's action is a list without a field that names which, or the other way round`);
                    }
                    if (when && kinds[when] !== "bool" && when !== field) problems.push(`${action}: its roll is asked when ${when} is set, which it does not take as a flag`);
                    for (const target of Object.values(into ?? {})) {
                        if (!kinds[target]) problems.push(`${action}: its roll's result goes in ${target}, which it does not take`);
                    }
                    if (derive !== undefined && typeof derive !== "function") problems.push(`${action}: what its roll earned is not read by a function`);
                }
            }
            for (const action of waiting) {
                if (!all[action] || all[action].rolled || !takes(action, all[action]).length) {
                    problems.push(`${action}: waits for a later commit and takes no result from the packet - take it off the list`);
                }
            }
            return problems;
        };
        const G = await import("./bridge-guards.mjs");
        const owner = G.owns("actorId", "not theirs");
        const FIXTURE = {
            "fixture.fine": { guards: [G.knownSender, owner], sanitize: G.pick({ actorId: G.as.id, total: G.as.num, rollId: G.as.id }),
                rolled: { field: "rollId", actor: "actorId", kind: "observe" } },
            "fixture.bare": { guards: [G.knownSender, owner], sanitize: G.pick({ actorId: G.as.id, isCritical: G.as.bool }) },
            "fixture.text": { guards: [G.knownSender], sanitize: G.pick({ actorId: G.as.id, total: G.as.num, rollId: G.as.text }),
                rolled: { field: "rollId", actor: "actorId", kind: "noSuchAction" } },
            "fixture.waits": { guards: [G.knownSender], sanitize: G.pick({ note: G.as.text }) },
            "fixture.pair": { guards: [G.knownSender, owner], sanitize: G.pick({ actorId: G.as.id, total: G.as.num, unseenTotal: G.as.num,
                rollId: G.as.id, unseenRollId: G.as.id }),
            rolled: [{ field: "rollId", actor: "actorId", kind: "steal" },
                { field: "unseenRollId", actor: "actorId", kind: "palm", into: { total: "unseenTotal" } }] }
        };
        equal(JSON.stringify(problemsOf(FIXTURE, ["fixture.waits"])), JSON.stringify([
            "fixture.bare: takes isCritical from the packet and names no roll",
            "fixture.text: its roll is named in rollId, which it does not take as an id",
            "fixture.text: the roll's character, actorId, is not an id an owns guard judges",
            "fixture.text: its roll's action noSuchAction is not an action of config.mjs",
            "fixture.waits: waits for a later commit and takes no result from the packet - take it off the list"
        ]), "the reader does not find exactly the five faults planted for it - it would misread the module's tables too");

        const all = Object.assign({}, ...(await bridgeTables()).map(t => t.table));
        must(Object.keys(all).length > 30, `the bridge's tables hold ${Object.keys(all).length} declarations - this would measure nothing`);
        const rolled = Object.entries(all).filter(([, decl]) => decl.rolled).map(([action]) => action).sort();
        log(`R218: ${rolled.length} declaration(s) read their roll's result from the GMs' record (${rolled.join(", ")}); `
            + `${WAITING.length} wait for a later commit; monocub.ability takes ${JSON.stringify(takes("monocub.ability", all["monocub.ability"] ?? {}))} from its packet`);
        equal(JSON.stringify(["action.plant", "action.steal", "analyze.resolve", "murder.cleanup", "murder.crisis", "murder.openingResult", "observe.resolve",
            "project.progress", "project.sabotage", "remnant.place", "vault.findStash", "vault.steal"].filter(action => !rolled.includes(action))), "[]",
            "Observe, Analyze, the search for a hidden stash, a Palm, a project's progress or Sabotage, a theft from a stash, a trace, an opening, a crisis action or Stage 6 names no roll its result is read from");
        equal(JSON.stringify([Boolean(all["monocub.ability"]?.sanitize), takes("monocub.ability", all["monocub.ability"] ?? {})]), JSON.stringify([true, []]),
            "monocub.ability is no declaration of the bridge's, or a Monocub ability's packet carries a result the GM would read");
        const problems = problemsOf(all, WAITING);
        ok(!problems.length, `the bridge's results: ${problems.join("; ")}`);
    }],

    ["R301 - a Monocub ability is one row: its target, locks, roll and resolver named in the tables, one bridge action that takes no result", async () => {
        /*
         * E33 C10, 07.10.2026; audit S09-48, decision D39; the plan's 3.1 and 2.7. One ability lived
         * in three files, and the stage's table (`MONOCUB.abilities`, config.mjs) is only a table if
         * every row is data that names its behaviour: `resolve` an entry of monocub.mjs's
         * `CUB_RESOLVERS`, `roll` of `CUB_ROLLS`, `target` of `CUB_TARGETS`, each of `locks` of
         * `CUB_LOCKS`, `choices` a list of words, `cost` and `hopeCost` whole numbers, a label and an
         * icon. A row naming what no table holds would be an ability the executor throws on, and a
         * lock no table knows is shut (`lockRefusal`). The bridge holds exactly one `monocub.*`
         * declaration, `monocub.ability`, whose packet carries a `key` as text and no total, critical,
         * roll or roll id - the GM throws the row's dice (R218 reads the same of every declaration).
         * And read off the source: the executor (`performCubAbility`) and the GM-side run
         * (`cubAbilityOnGm`) name no row (a second ability is one row and one resolver, not a branch),
         * the executor asks the locks before paying, and the run asks none (CALL-16: a Meddle paid a
         * moment before an Eclipse opened lands; the GM side never refunds, ACT-12). The plan's
         * mutants each turn this or a 2.7 test red: a lock missing from the row (the Class Trial's
         * picker test), a lock on the crime-witness marker (the witness test), a lock asked on the
         * GM (here and the Eclipse test), a result taken from the packet (here and R218).
         */
        const { MONOCUB } = await import("./config.mjs");
        const M = await import("./monocub.mjs");
        const rows = Object.entries(MONOCUB.abilities ?? {});
        // An assertion, not a precondition: a table with no row is the harm (red first at C9's runtime: no table at all).
        ok(rows.length >= 1, "MONOCUB.abilities holds no row - the Monocub's table is not built (E33 C10)");
        const has = (table, key) => Boolean(table) && typeof key === "string" && Object.hasOwn(table, key);
        const problems = [];
        for (const [key, row] of rows) {
            if (!has(M.CUB_RESOLVERS, row.resolve)) problems.push(`${key}: resolve ${JSON.stringify(row.resolve)} names no CUB_RESOLVERS entry`);
            if (!has(M.CUB_ROLLS, row.roll)) problems.push(`${key}: roll ${JSON.stringify(row.roll)} names no CUB_ROLLS entry`);
            if (!has(M.CUB_TARGETS, row.target)) problems.push(`${key}: target ${JSON.stringify(row.target)} names no CUB_TARGETS entry`);
            if (!Array.isArray(row.locks)) problems.push(`${key}: locks is not a list`);
            for (const lock of row.locks ?? []) if (!has(M.CUB_LOCKS, lock)) problems.push(`${key}: lock ${JSON.stringify(lock)} names no CUB_LOCKS entry`);
            if (!Array.isArray(row.choices) || !row.choices.length || !row.choices.every(c => typeof c === "string" && /^[a-z]+$/.test(c))) {
                problems.push(`${key}: choices is not a list of words`);
            }
            if (!(Number.isInteger(row.cost) && row.cost >= 0 && Number.isInteger(row.hopeCost) && row.hopeCost >= 0)) problems.push(`${key}: cost or hopeCost is not a whole number`);
            if (typeof row.label !== "string" || !row.label || typeof row.icon !== "string" || !row.icon) problems.push(`${key}: no label or no icon`);
        }
        log(`R301: ${rows.length} row(s) of MONOCUB.abilities (${rows.map(([key]) => key).join(", ")}); tables: ${Object.keys(M.CUB_RESOLVERS).length} resolver(s), `
            + `${Object.keys(M.CUB_ROLLS).length} roll(s), ${Object.keys(M.CUB_TARGETS).length} target rule(s), ${Object.keys(M.CUB_LOCKS).length} lock(s)`);
        equal(JSON.stringify(problems), "[]", `the Monocub's table: ${problems.join("; ")}`);

        const all = Object.assign({}, ...(await bridgeTables()).map(t => t.table));
        must(Object.keys(all).length > 30, `the bridge's tables hold ${Object.keys(all).length} declarations - this would measure nothing`);
        equal(JSON.stringify(Object.keys(all).filter(action => action.startsWith("monocub.")).sort()), JSON.stringify(["monocub.ability"]),
            "the bridge's monocub.* declarations are not exactly monocub.ability (monocub.meddle retired by E33 C10)");
        const fields = all["monocub.ability"]?.sanitize?.fields ?? {};
        equal(JSON.stringify([fields.key ?? null, fields.choice ?? null, Object.keys(fields).filter(f => ["total", "isCritical", "withHope", "roll", "rollId"].includes(f))]),
            JSON.stringify(["text", "text", []]),
            "monocub.ability does not take key and choice as text, or its packet carries a result or a roll the GM would read");

        const src = stripComments(new Map(await otherSources()).get("monocub.mjs") ?? "");
        const executor = bodyOf(src, "export async function performCubAbility(", { until: "export async function cubAbilityOnGm(" });
        const run = bodyOf(src, "export async function cubAbilityOnGm(", { until: "export async function cubAbilityDialog(" });
        ok(!/abilities\.meddle|CUB_\w+\.meddle|"meddle"/.test(`${executor}\n${run}`),
            "the executor or the GM-side run names the Meddle row - rows are data and behaviour is named, or a second ability is a branch");
        ok(/\blockRefusal\(/.test(executor) && executor.indexOf("lockRefusal(") < executor.indexOf("spendAction("),
            "the executor does not ask the row's locks before anything is paid");
        ok(!/\blockRefusal\(|CUB_LOCKS/.test(run), "the GM-side run asks a lock - CALL-16: a Meddle paid a moment before an Eclipse opened would lose its Hope for good");
        ok(/CUB_TARGETS\[row\.target\]\.refuses\(/.test(run) && /CUB_RESOLVERS\[row\.resolve\]\(/.test(run) && /CUB_ROLLS\[row\.roll\]\(/.test(run),
            "the GM-side run does not ask the row's target rule again, throw the row's roll and score with the row's resolver");
    }],

    ["R302 - a private roll's whisper is written first and in its own try, its mode after and apart, and CONST.DICE_ROLL_MODES and core.rollMode are used nowhere (S02-68)", async () => {
        /*
         * E33 C11 (audit S02-68; the plan's V7). Until 1.2.69 private-rolls.mjs wrote a roll's
         * whisper list and `flags.core.rollMode: CONST.DICE_ROLL_MODES.PRIVATE` in one
         * `updateSource` under one try, and migrate.mjs's rewrite of old rolls the same: a
         * browser on which the constant throws - Foundry 14 deprecates it and 16 drops it, as
         * the audit reads v14 - created the roll public, and nothing ever read the flag back.
         * The rule now: `writeWhisper` writes the list and nothing of a mode, in its own try;
         * `writeMode` writes what `privateModeFields` reads and no list, in its own; each road
         * of `whisperRoll` calls the first and only then the second, and writes the document
         * through neither of its own. Read off the source: every road comes out the same
         * wherever the mode can be written, which is every Foundry the suite has run on.
         * Since E33 fix r2-G2 (07.10.2026; review round 2's sec m3) the player road writes the
         * mode only where its list is the GMs and the author (`modeNamesThem`): the pair reads
         * `writeWhisper(...) && <one name>`, the list still first.
         */
        const files = (await otherSources()).filter(([file]) => file.endsWith(".mjs")).map(([file, raw]) => [file, stripComments(raw)]);
        ok(files.length > 50, `only ${files.length} module file(s) were read - the crawl is not reaching the module`);
        const uses = [];
        for (const [file, text] of files) {
            for (const m of text.matchAll(/\bDICE_ROLL_MODES\b|\bcore\.rollMode\b/g)) uses.push(`${file}:${lineAt(text, m.index)} ${m[0]}`);
        }
        equal(JSON.stringify(uses), "[]", "CONST.DICE_ROLL_MODES or core.rollMode is read or written in the module - v14 deprecates the one and nothing reads the other");
        const src = files.find(([file]) => file === "private-rolls.mjs")?.[1] ?? "";
        const list = fnSource(src, "writeWhisper"), mode = fnSource(src, "writeMode"), roads = fnSource(src, "whisperRoll");
        const ownTry = text => /\btry\s*\{/.test(text) && /\}\s*catch\b/.test(text);
        const listWrites = list.match(/updateSource\(\{\s*whisper\b[^}]*\}\)/g) ?? [];
        equal(JSON.stringify([listWrites.length, ownTry(list), /privateModeFields|applyMode|messageMode|flags\./.test(list)]), JSON.stringify([1, true, false]),
            "writeWhisper does not write the list once, in its own try, with nothing of a mode (list writes; own try; names a mode)");
        equal(JSON.stringify([ownTry(mode), /\bprivateModeFields\(\)/.test(mode), /\bwhisper\b/.test(mode)]), JSON.stringify([true, true, false]),
            "writeMode does not read privateModeFields in its own try, or it touches the whisper list (own try; reads the fields; names the list)");
        const paired = roads.match(/if \(writeWhisper\([^\n]*?\)(?: && \w+)?\) writeMode\(message, options\);/g) ?? [];
        equal(JSON.stringify([paired.length, (roads.match(/\bwriteMode\(/g) ?? []).length, (roads.match(/\bwriteWhisper\(/g) ?? []).length, /updateSource\(/.test(roads)]),
            JSON.stringify([2, 2, 2, false]),
            "whisperRoll's two roads (a roll the module threw; any other) do not each write the list and only then the mode, or one writes the document itself (paired; mode calls; list calls; a direct write)");
        log(`R302: ${files.length} module files hold no DICE_ROLL_MODES or core.rollMode; whisperRoll pairs the list before the mode on ${paired.length} roads`);
    }],

    ["R220 - a module write names a reason of the closed list", async () => {
        /*
         * E29 C1, 05.10.2026; audit S17-12; the plan's 2.2. Every write the module makes on a
         * student's resources, and every write of a module item's protected flags, goes through
         * resource-guard.mjs's three roads (`trustedWrite`, `trustedCreate`, `trustedDelete`) and
         * names its reason, a literal of `WRITE_REASONS`; the GMs' side judges a player's write by
         * the evidence that reason points at. Read live, every file but resource-guard.mjs:
         * nothing calls `automatedUpdate` or sets the marker (`[SYSTEM_WRITE]`, `drpgAutomated:`)
         * by hand; every road's options name a listed reason, or forward the `reason` of one of
         * FORWARDERS - the helpers that write for their callers, whose every call outside the
         * suite then names one (the suite's own calls take their default, "gmRuling"); and outside
         * the suite no `update`, `setFlag`, `unsetFlag` or embedded write names a protected flag of
         * inventory.mjs's ITEM_FLAGS (category, tier, drpgItemId, wear, broken, location,
         * stashRoom, and since E29 fix r1-G2 roles and usableKind - though not `"roles"` as a bare
         * string: tables.mjs writes a table entry's flag of that name, which this reader cannot
         * tell from an item's). It reads a call's own text: flags built elsewhere and handed in by
         * name are not seen. The reader is run first on a fixture with nine planted faults. Red before C1:
         * 37 `automatedUpdate` calls in 17 files, 37 more in tier 2, eight bare writes of a
         * protected item flag (wear, broken, the creation, a stash and a retrieve, a Reroll's two
         * give-backs, the bullets' migration). E33 C1a extends it with the census below: every
         * other document write, judged.
         */
        const guard = await import("./resource-guard.mjs");
        ok(Array.isArray(guard.WRITE_REASONS), "resource-guard.mjs has no list of a write's reasons");
        const listed = new Set(guard.WRITE_REASONS ?? []);
        equal(JSON.stringify([...listed]), JSON.stringify(["spend", "refund", "price", "call", "rest", "itemUse", "itemWear", "stash",
            "retrieve", "discard", "searchFind", "concealment", "meddle", "setup", "levelUp", "incident", "reroll", "gmRuling",
            "auditPutBack", "auditUndo", "equip", "ultimate", "sheetText"]), "the closed list of reasons moved - a reason is the plan's 2.2, and this list with it");
        const FORWARDERS = [["inventory.mjs", "grantItem", true], ["inventory.mjs", "breakItem", true], ["inventory.mjs", "wearItem", true],
            ["use-items.mjs", "restore", false], ["use-items.mjs", "consume", false],
            // E29 C4: the Burst and Sprint grants go through the road, their reason the caller's (a Call, or a refund).
            ["actions.mjs", "grantFreeActions", true], ["actions.mjs", "grantFreeMoves", true]];
        const PROTECTED = /\bITEM_FLAGS\s*\.\s*(?:category|tier|identity|wear|broken|location|stashRoom|roles|kind)\b|\$\{MODULE_ID\}\.(?:-=)?(?:category|tier|drpgItemId|wear|broken|location|stashRoom|roles|usableKind)\b|^\s*"(?:category|tier|drpgItemId|wear|broken|location|stashRoom|usableKind)"\s*$/m;
        const named = text => text.match(/\breason\s*:\s*"([^"\n]*)"/)?.[1] ?? null;
        const forwarding = (file, blank, at) => {
            const fn = [...blank.slice(0, at).matchAll(/^(?:export )?(?:async )?function (\w+)\(/gm)].pop()?.[1];
            return FORWARDERS.some(([home, name]) => home === file && name === fn);
        };
        const read = { roads: 0, calls: 0, writes: 0 };
        const problemsIn = (file, raw, suite) => {
            const code = blankComments(raw), blank = blankLiterals(code), out = [];
            const at = i => `${file}:${lineAt(code, i)}`;
            const argsOf = m => callArgs(blank, m.index + m[0].length - 1).args.map(a => code.slice(a.start, a.end));
            const defined = m => /function\s+$/.test(blank.slice(Math.max(0, m.index - 24), m.index));
            for (const m of blank.matchAll(/\bautomatedUpdate\s*\(|\[\s*SYSTEM_WRITE\s*\]|\bdrpgAutomated\s*:/g)) {
                out.push(`${at(m.index)} writes past the roads (${m[0].replace(/\s+/g, "")})`);
            }
            for (const m of blank.matchAll(/\btrusted(Write|Create|Delete)\s*\(/g)) {
                if (defined(m)) continue;
                read.roads++;
                const options = argsOf(m)[m[1] === "Delete" ? 1 : 2] ?? "";
                const reason = named(options);
                if (reason !== null && !listed.has(reason)) out.push(`${at(m.index)} names "${reason}", which is not on the list`);
                else if (reason === null && !(/\breason\b/.test(options) && forwarding(file, blank, m.index))) out.push(`${at(m.index)} names no reason`);
            }
            if (suite) return out;
            for (const [home, name, exported] of FORWARDERS) {
                if (!exported && home !== file) continue;
                for (const m of blank.matchAll(new RegExp(`\\b${name}\\s*\\(`, "g"))) {
                    if (defined(m)) continue;
                    read.calls++;
                    const all = argsOf(m).join(",");
                    const reason = named(all);
                    if (reason !== null && !listed.has(reason)) out.push(`${at(m.index)} hands ${name} "${reason}", which is not on the list`);
                    else if (reason === null && !(/\breason\b/.test(all) && forwarding(file, blank, m.index))) out.push(`${at(m.index)} calls ${name} without naming its reason`);
                }
            }
            for (const m of blank.matchAll(/\.\s*(?:update|setFlag|unsetFlag|updateEmbeddedDocuments|createEmbeddedDocuments)\s*\(/g)) {
                read.writes++;
                if (argsOf(m).some(arg => PROTECTED.test(arg))) out.push(`${at(m.index)} writes a module item's protected flag past the roads`);
            }
            return out;
        };
        const PLANTED = [
            "await automatedUpdate(actor, { a: 1 });",
            "await actor.update({ a: 1 }, { [SYSTEM_WRITE]: true });",
            "await trustedWrite(actor, { a: 1 }, { reason: \"spend\", ref: null });",
            "await trustedWrite(actor, { a: 1 }, { reason: \"whim\" });",
            "await trustedDelete(item);",
            "await item.setFlag(MODULE_ID, ITEM_FLAGS.broken, false);",
            "await item.update({ [`flags.${MODULE_ID}.wear`]: forcedDeletion(), \"system.quantity\": 1 });",
            "await grantItem(actor, { name: \"x\", category: \"tool\", tier: 1 });",
            "// await automatedUpdate(actor, {}); and \"trustedWrite(a, b)\" in a string",
            "await item.update({ \"system.quantity\": 1 }); await breakItem(item, { reason: \"itemUse\" });",
            "await item.setFlag(MODULE_ID, ITEM_FLAGS.roles, [\"crimeTool\"]);",
            "await item.update({ [`flags.${MODULE_ID}.usableKind`]: \"stress\" });"
        ].join("\n");
        equal(JSON.stringify(problemsIn("planted.mjs", PLANTED, false).map(p => Number(p.match(/^planted\.mjs:(\d+) /)?.[1]))),
            JSON.stringify([1, 2, 4, 5, 8, 6, 7, 11, 12]),
            "the reader does not see the planted writes as they are - a call past the roads, the marker by hand, an unlisted reason, none, a forwarder's call without one, a protected flag set and unset, a comment and a string, an item's roles and usable kind written by hand");
        read.roads = read.calls = read.writes = 0;
        const others = new Set((await otherSources()).map(([file]) => file));
        const problems = [];
        for (const [file, raw] of await moduleSources()) {
            if (file !== "resource-guard.mjs") problems.push(...problemsIn(file, raw, !others.has(file)));
        }
        must(read.roads + read.calls > 30, `the reader found ${read.roads} road(s) and ${read.calls} call(s) of a forwarder - it would measure nothing`);
        log(`R220: ${read.roads} road(s), ${read.calls} call(s) of a forwarder and ${read.writes} other write(s) read; ${problems.length} problem(s)`);
        ok(!problems.length, `${problems.length} module write(s) without a reason of the list: ${problems.slice(0, 12).join("; ")}`);

        /*
         * THE CENSUS (E33 C1a, 06.10.2026; audit S17-12's test, its first half; E33's plan 2.1). The
         * roads are E29's half: a write that takes one names its reason. This half reads every OTHER
         * document write in the same files - `update`, `setFlag`, `unsetFlag`, the embedded trio,
         * `toggleStatusEffect`, a document's `delete()` (a Map's or a Set's `delete(key)` is counted
         * aside), a document class's `create(` (any other `create(` aside) and the static
         * `*Documents` - and each one passes for exactly one reason, judged by the top-level
         * declaration it stands in:
         *   (b) A GATE before it in that declaration, in a block that holds it: `if (!game.user.isGM)`,
         *       `if (!game.user?.isGM)` or `if (!isPrimaryGm())`, alone or OR-ed with more, then a
         *       `return` or a `throw` (or a block that ends in one); or the write inside
         *       `if (game.user.isGM [&& ...]) { ... }`. One after the write is no gate.
         *   (c) NOT A STUDENT'S: a NOT_A_STUDENT row [file, declaration, receiver, what] - the
         *       receiver as the call reads it, with the arguments of its calls dropped; `what` is
         *       what reading the code found it to be.
         *   (d) A GM ROAD: a GM_ROADS row [file, declaration, caller] for a declaration with no gate
         *       that only gated code reaches. Every place the module names it outside its own
         *       declaration (a call, a value handed on; not an import) must stand in a caller its
         *       rows list, and each such caller has the gate before it or is a GM road itself, down
         *       to a gate; api.mjs names none of them. A table (a `const`) is reached through its entries, which this reader cannot
         *       follow: its row holds its runner's gate, and it is not exported (migrate.mjs's
         *       CLAUSES - `migrationStatus` reads their keys and runs none).
         * A row that judges nothing the earlier reasons have not is stale and red, so a site holds
         * one reason. Why rows and not a call graph: GM-side code is reached through the bridge's
         * `run` table and dynamic imports, which a scan cannot follow, and a gate in the function is
         * the one thing that is both checkable here and refuses a console. Measured at 5641a767
         * (1.2.68's release merge), C1a's tables over the code before C1a: 155 document writes read,
         * 75 behind a gate, 94 deletes and creates aside (a Map's or a Set's, a texture's or a data
         * operator's); of the other 80, 43 judged by 36 rows not a student's, 21 in 16 GM roads (20
         * rows), 13 by 11 player roads until C1b - and five problems: `syncStates` (so `syncOnce`
         * and `clearSystemConditions` under it), reroll.mjs `settleSearch` and Contraband's
         * `destroyItemEffect`, which C1a gates, and anonymity.mjs `lowerOwnership`, which refused a
         * player in a form this reader does not read and now says it in one it does. At 070b72b
         * (E29 C12) the same 155 writes stood behind the same gates and rows, with 85 aside: the
         * commits between added nine deletes of a Map's or a Set's keys, and moved one GM road's
         * caller (truth-bullets.mjs `onBulletWrite`, E29 fix r2-H12, out of `watchBulletEdits`).
         * E33 C1b put the thirteen player roads on E29's road and took their list (UNTIL_C1B, 11
         * rows) away: measured on its tree, 142 document writes read, 78 gated, 94 aside, the 64
         * others judged by the same 36 and 20 rows, 0 problems - and E29's half reads 146 roads
         * (134 before), 100 other writes (113). The floor went from 150 writes to 140 with it.
         */
        const WRITES = /\.\s*(update|setFlag|unsetFlag|createEmbeddedDocuments|updateEmbeddedDocuments|deleteEmbeddedDocuments|toggleStatusEffect|delete|create|createDocuments|updateDocuments|deleteDocuments)\s*\(/g;
        const DOCUMENT_CLASS = /(?:^|\.)(?:Actor|Item|ActiveEffect|ChatMessage|Combat|Combatant|Folder|JournalEntry|JournalEntryPage|Macro|Playlist|PlaylistSound|RollTable|TableResult|Scene|User|Cards|TokenDocument|RegionDocument|implementation|documentClass)$/;
        const GATE = /\bif\s*\(\s*(?:[^;{}&]*\|\|\s*)?!\s*(?:game\.user\??\.isGM|isPrimaryGm\(\s*\))\s*(?:\|\|[^;{}]*)?\)\s*(?:return\b|throw\b|\{[^{}]*?\b(?:return|throw)\b)/g;
        const GATE_BLOCK = /\bif\s*\(\s*(?:game\.user\??\.isGM|isPrimaryGm\(\s*\))\s*(?:&&[^;{}]*)?\)\s*\{/g;
        // From `from` to `to` the braces never close below where they stood at `from` (`floor` 0),
        // or never close the block `from` opens (`floor` 1).
        const holds = (blank, from, to, floor) => {
            let depth = 0;
            for (let i = from; i < to; i++) {
                if (blank[i] === "{") depth++;
                else if (blank[i] === "}" && --depth < floor) return false;
            }
            return true;
        };
        const reading = (file, raw) => {
            const code = blankComments(raw), blank = blankLiterals(code);
            const tops = [...blank.matchAll(/^(?![\s}\])]|$)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s*([\w$]+)|class\s+([\w$]+)|(?:const|let|var)\s+([\w$]+))?/gm)]
                .map(m => ({ at: m.index, name: m[1] ?? m[2] ?? m[3] ?? "(top level)", fn: Boolean(m[1]), table: Boolean(m[3]) }));
            const imports = [...blank.matchAll(/^(?:import\b|export\s*[{*])[^;]*;/gm)].map(m => [m.index, m.index + m[0].length]);
            const topAt = i => tops.filter(t => t.at <= i).pop() ?? { at: 0, name: "(top level)", fn: false, table: false };
            const gatedAt = i => {
                const top = topAt(i), stretch = blank.slice(top.at, i);
                return [...stretch.matchAll(GATE)].some(g => holds(blank, top.at + g.index, i, 0))
                    || [...stretch.matchAll(GATE_BLOCK)].some(g => holds(blank, top.at + g.index + g[0].length - 1, i, 1));
            };
            return { file, code, blank, tops, imports, topAt, gatedAt, line: i => lineAt(code, i) };
        };
        // The receiver as the call reads it, back from its dot over names, dots, `?.` and bracketed
        // stretches, whose insides are dropped: `game.actors.get(id)?.items` reads `game.actors.get().items`.
        const receiverOf = (blank, dot) => {
            let i = dot;
            while (i > 0) {
                const c = blank[i - 1];
                if (/[\w$.?]/.test(c)) { i--; continue; }
                if (c !== ")" && c !== "]") break;
                const open = c === ")" ? "(" : "[";
                let depth = 0, j = i - 1;
                for (; j >= 0; j--) if (blank[j] === c) depth++; else if (blank[j] === open && --depth === 0) break;
                i = Math.max(j, 0);
            }
            let out = "", depth = 0;
            for (const c of blank.slice(i, dot).replace(/[\s?]/g, "")) {
                if (c === "(" || c === "[") { if (!depth++) out += c; } else if (c === ")" || c === "]") { if (!--depth) out += c; } else if (!depth) out += c;
            }
            return out;
        };
        const censusIn = read => {
            const sites = [];
            let aside = 0;
            for (const m of read.blank.matchAll(WRITES)) {
                const kind = m[1], receiver = receiverOf(read.blank, m.index);
                if (kind === "delete" && !/^\s*[){]/.test(read.code.slice(m.index + m[0].length))) { aside++; continue; }
                if (kind === "create" && !DOCUMENT_CLASS.test(receiver)) { aside++; continue; }
                sites.push({ file: read.file, line: read.line(m.index), fn: read.topAt(m.index).name, receiver, kind, gated: read.gatedAt(m.index) });
            }
            return { sites, aside };
        };
        const judge = (sites, reads, api, { NOT_A_STUDENT, GM_ROADS }) => {
            const out = [], used = new Set();
            const key = (...parts) => parts.join("|");
            const notStudent = new Map(NOT_A_STUDENT.map(r => [key(r[0], r[1], r[2]), r]));
            const roads = new Map();
            for (const row of GM_ROADS) roads.set(key(row[0], row[1]), [...roads.get(key(row[0], row[1])) ?? [], row]);
            const ownSite = new Set();
            for (const s of sites) {
                if (s.gated) continue;
                const k = key(s.file, s.fn, s.receiver);
                if (notStudent.has(k)) used.add(notStudent.get(k));
                else if (roads.has(key(s.file, s.fn))) ownSite.add(key(s.file, s.fn));
                else out.push(`${s.file}:${s.line} ${s.fn} writes ${s.receiver}.${s.kind} with no gate before it and no row`);
            }
            // Where each GM road is named outside its declaration: [file, line, caller, gated].
            const named = new Map();
            for (const [file, name] of [...roads.values()].map(rows => rows[0])) {
                const at = [];
                for (const read of reads.values()) {
                    for (const m of read.blank.matchAll(new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`, "g"))) {
                        const top = read.topAt(m.index);
                        if ((read.file === file && top.name === name) || read.imports.some(([a, b]) => m.index >= a && m.index < b)) continue;
                        at.push({ file: read.file, line: read.line(m.index), caller: top.name, gated: read.gatedAt(m.index) });
                    }
                }
                named.set(key(file, name), at);
            }
            // Grounded: every place it is named is gated, or stands in a grounded GM road (a fixed point).
            const table = k => roads.get(k)[0][1] && reads.get(roads.get(k)[0][0])?.tops.find(t => t.name === roads.get(k)[0][1])?.table;
            const grounded = new Set();
            for (let moved = true; moved;) {
                moved = false;
                for (const k of roads.keys()) {
                    if (grounded.has(k)) continue;
                    const file = roads.get(k)[0][0];
                    const places = table(k) ? named.get(k).filter(p => roads.get(k).some(r => r[2] === p.caller)) : named.get(k);
                    if (places.length && places.every(p => p.gated || [...roads.keys()].some(o => o !== k && grounded.has(o) && o.endsWith(`|${p.caller}`)))) {
                        grounded.add(k);
                        moved = true;
                    }
                }
            }
            const callerOf = new Set([...roads.values()].flat().map(r => r[2]));
            for (const [k, rows] of roads) {
                const [file, name] = rows[0];
                if (new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(api)) out.push(`${file} ${name} is a GM road, and api.mjs names it`);
                if (table(k) && new RegExp(`^export\\s+(?:const|let|var)\\s+${name}\\b|^export\\s*\\{[^}]*\\b${name}\\b`, "m").test(reads.get(file)?.blank ?? "")) out.push(`${file} ${name} is a GM road's table, and it is exported`);
                for (const p of named.get(k)) {
                    if (!table(k) && !rows.some(r => r[2] === p.caller)) out.push(`${p.file}:${p.line} ${p.caller} reaches the GM road ${name}, and no row of it names that caller`);
                }
                for (const row of rows) {
                    if (!named.get(k).some(p => p.caller === row[2])) out.push(`${file} ${name}: the row naming ${row[2]} is stale - ${row[2]} does not reach it`);
                }
                if (!grounded.has(k)) out.push(`${file} ${name} is reached where no gate stands before it: ${named.get(k).filter(p => !p.gated).map(p => `${p.file}:${p.line} ${p.caller}`).join(", ") || "by nothing this reader sees"}`);
                if (!ownSite.has(k) && !callerOf.has(name)) out.push(`${file} ${name}: its GM road rows are stale - it writes nothing the earlier reasons leave, and no GM road names it as a caller`);
            }
            for (const row of NOT_A_STUDENT) if (!used.has(row)) out.push(`NOT_A_STUDENT row ${row.slice(0, 3).join(" ")} is stale - it judges no write the earlier reasons leave`);
            return out;
        };
        const NOT_A_STUDENT = [
            ["call-world.mjs", "fallbackGather", "scene", "the room's tokens, drawn round the assembly point (Token documents)"],
            ["cleanup.mjs", "undoLastCleanup", "scene.tokens.get()", "the trace token a clean-up left behind"],
            ["gm-bridge.mjs", "handleSendback", "token", "a token sent back out of a locked room"],
            ["incident-store.mjs", "retireOpeningNotices", "game.messages.get()", "the GMs' opening notices"],
            ["migrate.mjs", "CLAUSES", "table", "a pool table's results, given their roles"],
            ["monocub.mjs", "postCubRoll", "ChatMessage", "the Monocub ability roll's chat card (E33 C10; postMeddleRoll until 1.2.68)"],
            ["movement.mjs", "sendBack", "tokenDoc", "a token put back where it stood before a refused move"],
            ["murder-rules.mjs", "undoLastCrisis", "scene.tokens.get()", "the trace token the crisis action left"],
            ["murder-rules.mjs", "undoLastCrisis", "game.messages.get()", "the crisis action's card"],
            ["music.mjs", "pausePlaylist", "playlist", "a playlist paused"],
            ["music.mjs", "clearHeld", "playlist", "a playlist let go"],
            ["music.mjs", "rewindTo", "playlist", "a playlist moved to a track"],
            ["music.mjs", "stopPlaylistDead", "playlist", "a playlist stopped"],
            ["music.mjs", "wireSoundPlay", "Playlist", "the situational playlist, made from the sound window"],
            ["projects-tray.mjs", "leaveIconOnly", "game.user", "the user's own view of the projects tray"],
            ["remnants.mjs", "placeRemnant", "target", "a Remnant's token, placed on a scene"],
            ["remnants.mjs", "propagatePublic", "tokenDoc", "a Remnant token's public half"],
            ["remnants.mjs", "retuneRemnant", "token", "a Remnant's token, replaced by its retuned one"],
            ["remnants.mjs", "stripAnswerKey", "token", "a Remnant token's flags"],
            ["remnants.mjs", "neutraliseDeltaName", "target", "a Remnant token's own actor (its delta), renamed"],
            ["reroll.mjs", "makeReroll", "message", "the rerolled roll's chat card"],
            ["reroll.mjs", "markReplacedCard", "card", "the replaced card's flag"],
            ["reroll.mjs", "putFirstRollBack", "message", "the first roll's card, put back"],
            ["season-setup.mjs", "deleteMessages", "ChatMessage", "the chat log, cleared by the reset"],
            ["season-setup.mjs", "wipeSeason", "scene", "the season's tokens on the scene"],
            ["season-setup.mjs", "wipeSeason", "region", "a room's region flags"],
            ["secret.mjs", "post", "ChatMessage", "a secret's card"],
            ["tables.mjs", "addResult", "table", "a pool table's result"],
            ["tables.mjs", "editResult", "result", "a pool table's result"],
            ["tables.mjs", "dropResult", "table", "a pool table's result"],
            ["tables.mjs", "wirePaneHeading", "current()", "a pool table, renamed"],
            ["tables.mjs", "wirePaneHeading", "gone", "a pool table, deleted"],
            ["tables.mjs", "wirePaneRows", "result", "a pool table's result and its flags"],
            ["tables.mjs", "createPoolFrom", "RollTable", "a new pool table"],
            ["utils.mjs", "privately", "ChatMessage", "a whispered chat card"],
            ["vault.mjs", "applyRoomRows", "region", "a room's region flags, from the room set-up"]
        ];
        const GM_ROADS = [
            ["analyze.mjs", "lockOut", "resolveAnalyze"],
            ["analyze.mjs", "identify", "resolveAnalyze"],
            ["chapter.mjs", "destroyBullets", "killCharacter"],
            ["chapter.mjs", "destroyBullets", "publishDeath"],
            ["character.mjs", "stampStartingSheet", "initCharacter"],
            ["gm-items.mjs", "takeItemDialog", "openItemManager"],
            ["migrate.mjs", "CLAUSES", "migrate1_2_0"],
            ["murder-rules.mjs", "undoLastCrisis", "applyCrisisAction"],
            ["observe.mjs", "undoPrevious", "scoreObserve"],
            ["observe.mjs", "scoreObserve", "resolveObserve"],
            ["season-setup.mjs", "wipeSeason", "resetSeason"],
            ["states.mjs", "syncOnce", "syncStates"],
            ["states.mjs", "clearSystemConditions", "syncOnce"],
            ["truth-bullets.mjs", "publishReading", "identify"],
            ["truth-bullets.mjs", "publishReading", "revealAllBulletTypes"],
            ["truth-bullets.mjs", "revertPlayerBulletEdit", "onBulletWrite"],
            ["utils.mjs", "replaceFlag", "writeNote"],
            ["utils.mjs", "replaceFlag", "settleNoteFlags"],
            ["utils.mjs", "replaceFlag", "liftNotes"],
            ["utils.mjs", "replaceFlag", "wipeSeason"],
            ["vault.mjs", "forgetStashFound", "setStash"],
            ["vault.mjs", "forgetAllStashesFound", "wipeStudent"]
        ];

        // The reader over a planted file first: a bare write, a road, a gate before, a gate after, a gate
        // in a closure that does not hold the write, a block gate, a Map's delete and a texture's create,
        // a comment and a string, and GM roads - one reached from an ungated door, one down a chain.
        const PLANTED_WRITES = [
            "export async function bare(actor, n) { await actor.setFlag(MODULE_ID, FLAGS.freeActionGrants, n); }",
            "export async function road(actor, n) { await trustedWrite(actor, { [`flags.${MODULE_ID}.${FLAGS.freeActionGrants}`]: n }, { reason: \"call\" }); }",
            "export async function gated(actor, n) {",
            "    if (!game.user.isGM) return null;",
            "    await actor.setFlag(MODULE_ID, FLAGS.freeActionGrants, n);",
            "}",
            "export async function late(actor, n) { await actor.setFlag(MODULE_ID, FLAGS.freeActionGrants, n); if (!game.user.isGM) return null; }",
            "export async function nested(actor, n) { const f = () => { if (!game.user?.isGM) return; }; f(); await actor.setFlag(MODULE_ID, FLAGS.freeActionGrants, n); }",
            "export async function block(actor) { if (game.user.isGM && actor) { await actor.update({ a: 1 }); } await actor.unsetFlag(MODULE_ID, \"x\"); }",
            "export function aside(map) { map.delete(\"k\"); /* item.update({}) */ const s = \"doc.update({})\"; return PIXI.RenderTexture.create({ s }); }",
            "async function helper(item) { await game.actors.get(item.id)?.items?.get(\"x\")?.delete(); await Item.createDocuments([]); }",
            "export async function door(item) { if (!isPrimaryGm()) return; await helper(item); }",
            "export async function open(item) { await helper(item); }",
            "async function chain(actor) { await actor.update({ b: 1 }); }",
            "export async function chained(actor) { await chain(actor); }",
            "export async function top(actor) { if (!game.user.isGM || !actor) return; await chained(actor); }"
        ].join("\n");
        const planted = reading("planted.mjs", PLANTED_WRITES);
        const plantedCensus = censusIn(planted);
        equal(JSON.stringify([plantedCensus.sites.map(s => `${s.fn} ${s.receiver}.${s.kind}${s.gated ? " gated" : ""}`), plantedCensus.aside]),
            JSON.stringify([["bare actor.setFlag", "gated actor.setFlag gated", "late actor.setFlag", "nested actor.setFlag", "block actor.update gated",
                "block actor.unsetFlag", "helper game.actors.get().items.get().delete", "helper Item.createDocuments", "chain actor.update"], 2]),
            "the census does not read the planted writes as they are - a road, a gate before, after, in a closure, a block gate, a Map's delete, a texture, a comment and a string");
        equal(JSON.stringify(judge(plantedCensus.sites, new Map([["planted.mjs", planted]]), "game.drpg = { chained };", {
            NOT_A_STUDENT: [["planted.mjs", "helper", "Item", "planted"], ["planted.mjs", "gated", "actor", "planted, and gated"]],
            GM_ROADS: [["planted.mjs", "helper", "door"], ["planted.mjs", "chain", "chained"], ["planted.mjs", "chained", "top"]]
        }).map(p => p.split(" ").slice(0, 4).join(" "))), JSON.stringify([
            "planted.mjs:1 bare writes actor.setFlag", "planted.mjs:7 late writes actor.setFlag", "planted.mjs:8 nested writes actor.setFlag", "planted.mjs:9 block writes actor.unsetFlag",
            "planted.mjs:13 open reaches the", "planted.mjs helper is reached", "planted.mjs chained is a", "NOT_A_STUDENT row planted.mjs gated"
        ]), "the census does not judge the planted rows as they are - a write with no reason, a GM road reached from an ungated door, one api.mjs names, a stale row");

        const reads = new Map((await otherSources()).map(([file, raw]) => [file, reading(file, raw)]));
        must(reads.has("api.mjs"), "api.mjs is not among the module's sources - the GM roads cannot be checked against it");
        const census = { sites: [], aside: 0 };
        for (const [file, read] of reads) {
            if (file === "resource-guard.mjs") continue;
            const found = censusIn(read);
            census.sites.push(...found.sites);
            census.aside += found.aside;
        }
        const gated = census.sites.filter(s => s.gated).length;
        must(census.sites.length >= 140 && gated >= 70,
            `the census read ${census.sites.length} document write(s), ${gated} of them gated - fewer than 140 and 70 since E33 C1b, so it would measure nothing`);
        const unjudged = judge(census.sites, reads, reads.get("api.mjs").blank, { NOT_A_STUDENT, GM_ROADS });
        log(`R220: the census read ${census.sites.length} document write(s) (${census.aside} delete(s) and create(s) aside): ${gated} gated, `
            + `${NOT_A_STUDENT.length} row(s) not a student's, ${GM_ROADS.length} GM road row(s); ${unjudged.length} problem(s)`);
        ok(!unjudged.length, `${unjudged.length} write(s) or row(s) the census cannot judge: ${unjudged.slice(0, 12).join("; ")}`);
    }],

    ["R304 - an investigation road has a census row, and every row judges a road", async () => {
        /*
         * E09 C0, 08.10.2026; the plan's METHOD change 1 (census-1c). E09 moves what a GM decides
         * about a Remnant, a Truth Bullet or a key off what a player's browser can write, and this
         * test keeps the list of those places closed: a new one fails until it has a row and a
         * verdict, a row whose place is gone fails until it is struck. Four kinds, read live:
         * PACKET - every field of a BRIDGE_ACTIONS declaration whose action is an investigation
         * road (ROADS), read off the `fields` its picked sanitizer lists; ITEM - every top-level
         * function, class or binding outside the suite that reads a Truth Bullet item (through the
         * held-bullet readers, or raw: the item's flag, `bulletsOf`, `copiedRemnants` and kin) and
         * names one of the ledger's fields (FIELDS); CARD - every investigation key of
         * messenger-app.mjs's CARD_ACTIONS (a button on a chat card a click runs); STORE - the six
         * places the fields live, each found by its name in its file. A verdict says what judges
         * the place today; one that names "C<n>" names the E09 commit that changes it, and that
         * commit rewrites the row with the code. It reads names and text, not data flow: a reader
         * reached through a helper this list does not name is not seen. Measured 08.10.2026 at
         * 7bbcdb8: the ITEM and CARD keys of this reader and of the parse-only census
         * (an acorn reading of the same tree, kept with the E09 plan outside the repository) were
         * the same 26 - 22 ITEM,
         * 4 CARD - and the census's 47 PACKET and 6 STORE rows are the rest of the 79 below (read
         * live in the headless harness the same day: 47, 22, 4 and 6, none without a row). Its 13
         * PLANNED rows (places E09's commits will add) are left to the commits that add them. E09 C1 struck
         * `sweepTruthBullets` and `confirmSweepBullets` (both read through chapter.mjs `sweepPlan` now, which
         * names no field) and added `sparedBySweep`, where the planned `sweepPlan` row's field read is: 78
         * rows, 21 ITEM (read live 08.10.2026, none without a row). E09 C2 struck `propagateCrimeTie`,
         * `propagateCrimeTieMany` and `propagateRealType` (folded into `propagateVerdicts`, the planned row it
         * judges now): 76 rows, 19 ITEM (read live 08.10.2026, none without a row). E09 C7 added
         * `keyFeeOf`, the fee's count, where its planned row said: 77 rows, 20 ITEM (read live
         * 08.10.2026, none without a row). E09 C8 struck `revealAllBulletTypes` and
         * `openChapterEndDialog` (both read through chapter.mjs `revealPlan` now, which decides) and
         * added `revealPlan` and `publishReading`, the write `identify` and the reveal share:
         * 77 rows, 20 ITEM (read live 08.10.2026, none without a row). E09 fix r1-G4 moved
         * `publishLootSource`, `propagateRemnantPublic` and `propagateVerdicts` onto truth-bullets.mjs
         * `copiesInKey`, which hands each the held copy, so HELD names it: without it the three rows
         * read as rows without a place (the parse-only census at the fix, 08.10.2026: "3 stale
         * verdict(s)"); with it, 77 rows, 20 ITEM again. E09 C10 added the four fields of
         * `cleanup.ruling`, a GM's ruling on a reshape asked of the primary, where their planned rows
         * said: 81 rows, 51 PACKET (read live 08.10.2026, none without a row). E09 C12 added the
         * four fields of `observe.pick`, a GM's pick or Refuse on an Observe card asked of the
         * primary, and its two card actions, `pickObserveTrace` and `refuseObserveTrace`, where the
         * planned rows said (with `refuse`, which the plan did not name): 87 rows, 55 PACKET, 6 CARD
         * (read live 08.10.2026, none without a row and no row without a place). The
         * reader is run first on a fixture with a judged reader, a reader whose field is only in a
         * comment, an unjudged one, a road and a non-road declaration, a card and a stale row.
         */
        const INVESTIGATION_CENSUS = [
            ["PACKET gm-bridge.mjs#observe.target#actorId", "judged: knownSender + owns(actorId); since C12 a focused gaze is put on every GM's card (askObserveByCard) and picked through the GM-only observe.pick, the asker judged here"],
            ["PACKET gm-bridge.mjs#observe.target#declaration", "judged: chooseObserveTarget compares it to DECLARATIONS, an unknown one answered with a reason"],
            ["PACKET gm-bridge.mjs#observe.target#request", "judged: read only as the asker's word for 'focus', shown on the card and in the picker; the candidates are read on the primary (observeCandidates), never taken from it"],
            ["PACKET gm-bridge.mjs#observe.pick#rid", "judged (C12): gmOnly, run on the primary (askObservePick, onPrimary); the ask the primary keeps under it (observeAsks) must still be waiting and not being answered, else refused and told the GM"],
            ["PACKET gm-bridge.mjs#observe.pick#actorId", "judged (C12): gmOnly; must be the character of the ask kept under rid, else refused and told the GM"],
            ["PACKET gm-bridge.mjs#observe.pick#tokenId", "judged (C12): read again on the primary - one of observeCandidates for that character in the room it asked in (pickObserveTarget), else nothing is written and the GM is told"],
            ["PACKET gm-bridge.mjs#observe.pick#refuse", "judged (C12): gmOnly; a GM's Refuse of the ask kept under rid, told to the asker as a refusal, nothing written"],
            ["PACKET gm-bridge.mjs#cleanup.traces#actorId", "judged: knownSender + owns(actorId); lists the traces of the cleaner's own room; E09 adds no read"],
            ["PACKET gm-bridge.mjs#cleanup.traces#mine", "judged: a filter over the cleaner's own room's list; widens nothing"],
            ["PACKET gm-bridge.mjs#cleanup.ruling#actorId", "judged: gmOnly (a GM sender) and ruled on the primary (askReshapeRuling, onPrimary); claimRuling rules only on the row of that character's last clean-up, and refuses and tells without one"],
            ["PACKET gm-bridge.mjs#cleanup.ruling#tokenId", "judged: claimRuling - must be the trace the attempt row names, else refused and told"],
            ["PACKET gm-bridge.mjs#cleanup.ruling#attempt", "judged: claimRuling - must be the row's attempt, else refused and told; `ruled` marked in the same synchronous step, so a second ruling is refused and told"],
            ["PACKET gm-bridge.mjs#cleanup.ruling#verdict", "judged: approve or decline only (ruleReshape); anything else rules on nothing"],
            ["PACKET gm-bridge.mjs#observe.resolve#actorId", "judged: knownSender + owns(actorId) (E28)"],
            ["PACKET gm-bridge.mjs#observe.resolve#key", "judged: must be the asker's pending row (F7, gmObservePending on the primary); since C12 a focused gaze's row is written only by the primary, from a GM's pick it read again (pickObserveTarget)"],
            ["PACKET gm-bridge.mjs#observe.resolve#total", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#observe.resolve#isCritical", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#observe.resolve#undo", "judged: guardUndoIsTheGms - an undo from a player is refused (E28)"],
            ["PACKET gm-bridge.mjs#observe.resolve#rollId", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#analyze.resolve#actorId", "judged: knownSender + owns(actorId) (E28)"],
            ["PACKET gm-bridge.mjs#analyze.resolve#itemId", "judged: resolveAnalyze looks it up on that one character and decides on bulletAsHeld (E29); identify's write is truth-bullets.mjs publishReading since C8, given the held copy"],
            ["PACKET gm-bridge.mjs#analyze.resolve#total", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#analyze.resolve#isCritical", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#analyze.resolve#undo", "judged: guardUndoIsTheGms - an undo from a player is refused (E28)"],
            ["PACKET gm-bridge.mjs#analyze.resolve#rollId", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#handover.bullet#fromId", "judged: knownSender + owns(fromId) (E29 handover)"],
            ["PACKET gm-bridge.mjs#handover.bullet#toId", "judged: handover's verify - a living recipient in the giver's room"],
            ["PACKET gm-bridge.mjs#handover.bullet#itemId", "judged: handover's verify - an item of the giver's; the copy is written from bulletAsHeld (shareBullet)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#actorId", "judged: knownSender + owns(actorId); the !viaAction && !isCleaner branch (cleanup.mjs resolveCleanup, resolveStageSix: blockedOnGm) whispers blocked.* to the owner and gives the price back (C11)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#tokenId", "judged: resolveCleanup finds the trace in the cleaner's room or refuses; C9 keeps the reshape off held copies, C10 keys the proposal's attempt row by it"],
            ["PACKET gm-bridge.mjs#murder.cleanup#key", "judged: resolveCleanup's road table; E09 adds no read"],
            ["PACKET gm-bridge.mjs#murder.cleanup#targetId", "judged: resolveStageSix (who may be framed, where the body lies); a body that did not move leaves no trace (applyMoveBody, C11)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#total", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#murder.cleanup#isCritical", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#murder.cleanup#withHope", "out of scope: the asker's own Hope within its bounds (D2 layer two, E28/E29)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#viaAction", "judged: the !viaAction branch requires isCleaner on the GM, and its refusal is told (blockedOnGm, C11)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#undo", "judged: guardUndoIsTheGms - an undo from a player is refused (E28)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#grant", "judged: the grant is looked up in the incident, the packet's extras never read (gm-bridge.mjs 647, 1193)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#price", "judged: bounded against PRICE_CHAINS (T-1); a GM's refusal gives back the step validPrice(price) names (refundRefused, C11): the asker's own action or Sanity mark within its bounds (D2 layer two)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#transform", "judged: bounded against CLEANUP.transform; C10 stores the proposal on the attempt row (the card carries only the tag); without both a name and a text it is no rewrite, the critical erases (resolveEraseRoad, C11)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#change", "judged: bounded against CLEANUP.transform (Z5); without both a name and a text no reshape is put to the GMs (resolveTransformRoad, C11)"],
            ["PACKET gm-bridge.mjs#murder.cleanup#rollId", "judged: bridge-guards.mjs rollRefusal reads the result from the GMs' roll row (E28); the packet's number is a claim"],
            ["PACKET gm-bridge.mjs#remnant.place#data", "judged: narrowPlayerRemnant rebuilds a player's trace from a whitelist; C5 decides a Sabotage trace's tie by worksOwnMurder from the GMs' roll row, never the packet"],
            ["PACKET gm-bridge.mjs#remnant.place#rollId", "judged: the GMs' roll row (noteFactOfRoll) gives the band (traceBandOf) and, from C5, the sabotaged project and its actor"],
            ["PACKET gm-bridge.mjs#remnant.tieForItem#identity", "judged: guardTieTraceHolder - only the holder, in the fight; remnants.mjs tieTraceForItem writes the tie, and C4's prep checks it keeps the three states (read in the code); since fix r1-G1 the copies learn it when the death is the table's, or at the fight's close (tieWaitNow)"],
            ["PACKET gm-bridge.mjs#remnant.edit#sceneId", "judged: remnant.edit's guards (E08+E28 C8: the GM re-rates on its own client); E09 adds no read"],
            ["PACKET gm-bridge.mjs#remnant.edit#tokenId", "judged: remnant.edit's guards; E09 adds no read"],
            ["PACKET gm-bridge.mjs#remnant.edit#patch", "judged: narrowed in the run - remove as a flag, a visibility from REMNANT_VISIBILITY_LABELS, a type from a GM only"],
            ["PACKET gm-bridge.mjs#project.sabotage#targetId", "judged: the sender must see the project; handleSabotage notes targetProjectId on the GMs' row, which C5 reads (never the packet)"],
            ["PACKET gm-bridge.mjs#project.sabotage#difficulty", "judged: handleSabotage's bounds (E28); E09 adds no read"],
            ["PACKET gm-bridge.mjs#project.sabotage#actorId", "judged: owns(actorId); C5 requires the row's actor to be the sender's character"],
            ["PACKET gm-bridge.mjs#project.sabotage#rollId", "judged: the GMs' roll row (repairOf); C5 reads its noted targetProjectId"],
            ["PACKET gm-bridge.mjs#project.sabotage#penalty", "judged: held by repairOf to [SABOTAGE_CONCEAL.despairPenalty, 0] (E28)"],
            ["PACKET gm-bridge.mjs#project.sabotage#relief", "judged: held by repairOf to the tools the GM sees (E28)"],
            ["PACKET gm-bridge.mjs#reroll.ask#actorId", "judged: knownSender + owns(actorId); the Reroll receipt (E28); C9's Undo is a GM's"],
            ["ITEM analyze.mjs#resolveAnalyze", "judged: reads bulletAsHeld (E29); unchanged by E09"],
            ["ITEM analyze.mjs#identify", "judged: reads bulletAsHeld and hands the held copy to truth-bullets.mjs publishReading, which writes (C8)"],
            ["ITEM chapter.mjs#revealPlan", "judged (C8): each decision on bulletAsHeld (sparedBySweep's Faint, the kind and analyzed), in one synchronous pass; the set from allBullets by design (H22); revealAllBulletTypes writes it and openChapterEndDialog counts it"],
            ["ITEM chapter.mjs#sparedBySweep", "judged (C1; the plan's sweepPlan row, whose field read is here): faintOf(bulletAsHeld) or the answer key's final, for each bullet sweepPlan reads through bulletsHeldBy in one synchronous pass (H3)"],
            ["ITEM gm-stores.mjs#bulletsWithoutAnswer", "out of scope: a GM's diagnostic of answer keys, writes nothing a player sees"],
            ["ITEM gm-stores.mjs#fillsFromTraces", "out of scope: fills a missing answer key's realType from the GMs' stores (bulletStore, remnantStore); the item is only the list"],
            ["ITEM gm-stores.mjs#gmStoreHealth", "out of scope: a GM's diagnostic count"],
            ["ITEM handover.mjs#shareBullet", "judged: the copy is built from bulletAsHeld (E29); the answer key copied by copiedRemnants"],
            ["ITEM investigation.mjs#findersByRemnant", "a display since C7: the planner's table (keyPlanStatus) reads it off the documents; the fee counts in keyFeeOf; the living for the GMs since fix r1-G3, as the fee's"],
            ["ITEM investigation.mjs#keyFeeOf", "judged: one await judgedFor, then itemsHeldNow per student in one synchronous pass (H3); the marks on the primary, the documents on another GM, as every itemsHeldNow road there; a trial's opening asks it on the primary since fix r1-G3 (askToChargeForUnfoundKeys), and a copy whose trace is gone is dated by its answer key, not its stamp"],
            ["ITEM investigation.mjs#evidenceByStudent", "out of scope: 'Who has what', a GM's display (plan 1b); C7 shares livingStudents with it"],
            ["ITEM reroll.mjs#settleSearch", "judged: itemsAsHeld (E29)"],
            ["ITEM sheet.mjs#buildBulletRow", "out of scope: the owner's own sheet drawing their own item on their own client"],
            ["ITEM truth-bullets.mjs#publishReading", "judged (C8): takes the held copy from its caller (identify, revealAllBulletTypes through revealPlan); the answer key and the trace's public record for the rest"],
            ["ITEM truth-bullets.mjs#publishLootSource", "judged (C2; census-found, not in plan.md): isIdentified and the source already shown read off the held copy; the copies the answer key lists since fix r1-G4 (copiesInKey: bulletAsHeld, the category the key's)"],
            ["ITEM truth-bullets.mjs#truthBulletData", "not a sink: the accessor; each caller is its own row"],
            ["ITEM truth-bullets.mjs#propagateRemnantPublic", "judged (C2): hasReading off the held copy (copiesInKey since fix r1-G4: bulletAsHeld, the category the key's, every copy the answer key lists), and the name and img it falls back to (unreached: publicOf names every row); the answer key always"],
            ["ITEM truth-bullets.mjs#propagateVerdicts", "judged (C2): the flags (faint, tiedToCrime, shownType) only where isIdentified(held) (bulletAsHeld; through copiesInKey since fix r1-G4, the category the key's, every copy the answer key lists), every copy decided in one synchronous pass (H3, H17); the answer key always; C13 sends the kind and Faint together through it"],
            ["ITEM truth-bullets.mjs#migrateTruthBullets", "out of scope: a one-time shape migration on a GM, writes the legacy fields back to their new names and decides no verdict"],
            ["ITEM truth-bullets.mjs#onBulletWrite", "put back: E29's put-back on the primary (judgedFor)"],
            ["CARD messenger-app.mjs#approveReshape", "refused and told (C10): the card carries only the attempt; the proposal is read off the attempt row on the primary (askReshapeRuling), `ruled` marked before any await after the store's hydration, a second ruling refused and told; the card is the GM's (posted from the GM's client - a player cannot update a message they did not author: Foundry's permission, read not measured)"],
            ["CARD messenger-app.mjs#declineReshape", "refused and told (C10): as approveReshape; the erase on the erase road is the row's `erases`"],
            ["CARD messenger-app.mjs#pickObserveTrace", "judged (C12): the clicking GM's picker from its own copy of the ledger, the pick sent as observe.pick; the primary reads the list again"],
            ["CARD messenger-app.mjs#refuseObserveTrace", "judged (C12): a GM's Refuse sent as observe.pick on the primary, told to the asker"],
            ["CARD messenger-app.mjs#observeMiss", "judged: a GM's card (callGm, posted from the GM's client); chargeObserveMiss reads the actor on the GM (H24); E09 adds no read"],
            ["CARD messenger-app.mjs#keyRemnantHere", "out of scope: opens the GM's own placement dialog with the player's room and note as a suggestion the GM confirms"],
            ["STORE gm-stores.mjs#remnantStore", "not a source: a GM store on GM browsers (plan 1b a); C3's Save writes it only where `drawn` equals the ledger"],
            ["STORE gm-stores.mjs#keyPlanStore", "not a source: a GM store (1b e); since C6 also each chapter's `:case` row, the closed case's Key count, written by closeIncident on the closing GM (recordCaseKeys) and read by caseKeyCount; under the chapter the case opened in, and dropped by a reset that keeps the plan, since fix r1-G3"],
            ["STORE gm-stores.mjs#cleanupAttemptStore", "not a source: a GM store (1b a); C10 adds the proposal and `ruled`"],
            ["STORE vote.mjs#trialProgress", "not a source: a world setting only a GM writes (1b e); C7 leaves keysCharged as it is (E10 inherits)"],
            ["STORE settings.mjs#observePending", "not a source: a client setting on the primary (1b f); since C12 a focused gaze's row is written there only from a pick the primary read again"],
            ["STORE remnants.mjs#TOKEN_KEEPS", "not a source: the token keeps no ledger field (1b a)"]
        ];
        const ROADS = /remnant\.|observe\.|cleanup\.|analyze\.|murder\.cleanup|project\.sabotage|handover\.bullet|tieForItem|reroll\.ask/;
        const FIELDS = new RegExp(`\\b(?:${["tiedToCrime", "faint", "realType", "shownType", "analyzed", "analyzedText", "playerText", "sourceAction"].join("|")})\\b`);
        const HELD = /\b(?:bulletAsHeld|bulletsHeldBy|itemsHeldNow|itemsAsHeld|judgedFor|copiesInKey)\s*\(/;
        const RAW = /\b(?:truthBulletData|bulletsOf|allBullets|copiedRemnants|findersByRemnant)\s*\(|\.items\b[^;\n]{0,80}\btruthBullet\b|getFlag\(\s*MODULE_ID\s*,\s*["']truthBullet/;
        const TOP = /^(?![\s}\])]|$)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s*([\w$]+)|class\s+([\w$]+)|(?:const|let|var)\s+([\w$]+))?/gm;
        const CARD = /Reshape|observe|Remnant|Observe|keyRemnant/;
        const STORES = [["gm-stores.mjs", "remnantStore"], ["gm-stores.mjs", "keyPlanStore"], ["gm-stores.mjs", "cleanupAttemptStore"],
            ["vote.mjs", "trialProgress"], ["settings.mjs", "observePending"], ["remnants.mjs", "TOKEN_KEEPS"]];
        const censusOf = (bridge, sources) => {
            const found = [];
            for (const [action, decl] of Object.entries(bridge)) {
                if (!ROADS.test(action)) continue;
                const fields = Object.keys(decl?.sanitize?.fields ?? {});
                // A road whose sanitizer lists no fields cannot be read here, so it is a key no row can hold.
                for (const field of fields.length ? fields : ["?"]) found.push(`PACKET gm-bridge.mjs#${action}#${field}`);
            }
            const files = new Map(sources);
            for (const [file, raw] of files) {
                const code = blankComments(raw);
                const tops = [...blankLiterals(code).matchAll(TOP)].map(m => ({ at: m.index, name: m[1] ?? m[2] ?? m[3] ?? null }));
                tops.forEach((top, i) => {
                    if (!top.name) return;
                    const text = code.slice(top.at, tops[i + 1]?.at ?? code.length);
                    if ((HELD.test(text) || RAW.test(text)) && FIELDS.test(text)) found.push(`ITEM ${file}#${top.name}`);
                    if (file !== "messenger-app.mjs" || top.name !== "CARD_ACTIONS") return;
                    for (const m of text.matchAll(/^\s+([\w$]+)\s*:\s*[\w$]+\s*,?\s*$/gm)) if (CARD.test(m[1])) found.push(`CARD messenger-app.mjs#${m[1]}`);
                });
            }
            for (const [file, name] of STORES) {
                if (files.has(file) && new RegExp(`\\b${name}\\b`).test(blankComments(files.get(file)))) found.push(`STORE ${file}#${name}`);
            }
            return found;
        };
        const judge = (found, table) => {
            const rows = new Set(table.map(([key]) => key)), seen = new Set(found);
            return { unclassified: found.filter(key => !rows.has(key)), stale: [...rows].filter(key => !seen.has(key)) };
        };

        const planted = censusOf({
            "observe.planted": { sanitize: { fields: { actorId: "id" } } },
            "vote.planted": { sanitize: { fields: { choice: "id" } } }
        }, [
            ["planted.mjs", "export function judged(item) {\n    return bulletAsHeld(item).analyzed;\n}\n"
                + "function unread(actor) {\n    // its analyzed flag is read elsewhere\n    return bulletsOf(actor).length;\n}\n"
                + "const forged = actor => bulletsOf(actor).filter(b => b.tiedToCrime);\n"],
            ["messenger-app.mjs", "const CARD_ACTIONS = {\n    approveReshape: ruleApproveReshape,\n    reply: ruleReply\n};\n"],
            ["gm-stores.mjs", "export const remnantStore = gmStore(\"gmRemnants\");\n"]
        ]);
        equal(JSON.stringify(planted), JSON.stringify(["PACKET gm-bridge.mjs#observe.planted#actorId", "ITEM planted.mjs#judged",
            "ITEM planted.mjs#forged", "CARD messenger-app.mjs#approveReshape", "STORE gm-stores.mjs#remnantStore"]),
            "the census reader does not read the planted fixture as planted - the live census below would measure the wrong places");
        equal(JSON.stringify(judge(planted, [["PACKET gm-bridge.mjs#observe.planted#actorId", ""], ["ITEM planted.mjs#judged", ""],
            ["ITEM planted.mjs#gone", ""], ["CARD messenger-app.mjs#approveReshape", ""], ["STORE gm-stores.mjs#remnantStore", ""]])),
            JSON.stringify({ unclassified: ["ITEM planted.mjs#forged"], stale: ["ITEM planted.mjs#gone"] }),
            "the census judge does not tell a planted reader without a row, or a row without its reader");

        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const found = censusOf(BRIDGE_ACTIONS, await otherSources());
        const count = kind => found.filter(key => key.startsWith(`${kind} `)).length;
        must(["PACKET", "ITEM", "CARD", "STORE"].every(kind => count(kind) > 0),
            `the census read ${["PACKET", "ITEM", "CARD", "STORE"].map(kind => `${count(kind)} ${kind}`).join(", ")} - a kind it reads none of would measure nothing`);
        const verdict = judge(found, INVESTIGATION_CENSUS);
        log(`R304: the census read ${found.length} place(s) (${["PACKET", "ITEM", "CARD", "STORE"].map(kind => `${count(kind)} ${kind}`).join(", ")}) `
            + `against ${INVESTIGATION_CENSUS.length} row(s); ${verdict.unclassified.length} without a row, ${verdict.stale.length} row(s) without a place`);
        equal(JSON.stringify(verdict), JSON.stringify({ unclassified: [], stale: [] }),
            "an investigation road without a census row, or a row whose road is gone: give the new one a verdict (what judges it, or the E09 commit that will) and strike the gone one");
    }],

    ["R311 - a trial road has a census row, and every row judges a road", async () => {
        /*
         * E10 C0, 09.10.2026; the plan's METHOD change 1 (census-1c), R304's twin for the Class
         * Trial. E10 moves the vote, the verdict and the Level Up off what a player's browser can
         * write, and this test keeps the list of the places that read it closed: a new one fails
         * until it has a row and a verdict, a row whose place is gone fails until it is struck.
         * Five kinds, read live: PACKET - every field of a BRIDGE_ACTIONS declaration whose action
         * is `vote.*` or `advancement.*`, read off the `fields` its picked sanitizer lists ("-" for
         * a declaration that lists none: the packet itself is the claim); SOCKET - every raw socket
         * handler the trial's files register (`game.socket.on(event, handler)`, or a dispatch's
         * `return handler(payload`), gm-bridge.mjs's own only where the handler is a Level Up's,
         * one row per `payload.<field>` it reads; CHAT - every top-level declaration of those
         * files that reads a chat message's module flags or its speaker's actor (any user can
         * create a message with any flags); SHEET - every one that reads a student's death,
         * advances, traits, experiences or resources, held or off the document, or is one of the
         * named few (NAMED) whatever it reads; STORE - the five places the trial's fields live,
         * each found by its name in its file. The files are the trial's seven and the named
         * declarations of six others (FILES, NAMED). A verdict says what judges the place today;
         * one that names "C<n>" names the E10 commit that changes it, and that commit rewrites the
         * row with the code. It reads names and text, not data flow: a reader in another file, or
         * reached through a helper this list does not name, is not seen. Measured 09.10.2026 at
         * 1e9871c: the SOCKET, CHAT, SHEET and STORE keys of this reader (run in Node on the tree's
         * files) and of the parse-only census (an espree reading of the same tree, kept with the
         * E10 plan outside the repository) were the same 31 - 6 SOCKET, 5 CHAT, 15 SHEET,
         * 5 STORE - and the census's 5 PACKET rows are the rest of the 36 below. Its 10 PLANNED
         * rows (places E10's commits will add: `vote.run`, `vote.cast`, `vote.ask`, the offer's
         * `op` and `offerId`, `ballotStore`, the objector's death in `seizeFloor`) are left to the
         * commits that add them. The reader is run first on a fixture with a socket handler, a
         * judged reader, a reader whose field is only in a comment, a chat reader without a row, a
         * declaration of a named file that is not named, a store and a stale row.
         * E10 C1 (1.2.71) added `vote.run`'s two PACKET rows and `ballotStore`'s STORE row, and
         * struck `voteIsOpen` (the panel reads the world's record, no chat flag) and the Map
         * `ballots`. The reader still looks for `ballots` in vote.mjs: a module Map of that name
         * coming back is a place without a row. Measured on the harness on 09.10.2026 with C1
         * in the tree: 37 places against 37 rows - 7 PACKET, 6 SOCKET, 4 CHAT, 15 SHEET, 5 STORE.
         * E10 C2 (1.2.71) added `vote.cast`'s two PACKET rows, `vote.ask`'s one and the `round` the
         * ballot's packet carries now, struck `onBallotCast` (the raw `vote.ballot`) and the
         * `voterActorId` nothing read, and rewrote the verdicts the bridge's ballot changes. Measured
         * on the harness on 09.10.2026 with C2 in the tree: 39 places against 39 rows - 10 PACKET,
         * 5 SOCKET, 4 CHAT, 15 SHEET, 5 STORE.
         * E10 C4 (1.2.71) rewrote `openVerdictDialog`'s verdict: the dead are read as the GMs hold them,
         * and only a living student can be picked; no place added or struck.
         * E10 C5 (1.2.71) struck `applyVerdict`'s SHEET row - it reads no death now - and added the two
         * places the verdict reads them in, `verdictHeld` and `executeSentenced`. Measured on the harness
         * on 09.10.2026 with C5 in the tree: 40 places against 40 rows - 10 PACKET, 5 SOCKET, 4 CHAT,
         * 16 SHEET, 5 STORE.
         * E10 C6 (1.2.71) added the offer's `op` and `offerId` and the spend's `offerId`, three PACKET
         * rows, and rewrote the verdicts of the spend's picks and of `offerStore`, whose row is a list
         * per character now. Measured with the census on the working tree on 09.10.2026: 43 places
         * against 43 rows - 13 PACKET, 5 SOCKET, 4 CHAT, 16 SHEET, 5 STORE.
         * E10 C7 (1.2.71) added the offer's `extra` and `deferred`, two PACKET rows: the verdict's one
         * window gives the surviving Blackened's waiting Reinforced as the extra picks of their
         * Standard's offer, from whichever GM applies the verdict. Measured with the census on the
         * working tree on 10.10.2026: 45 places against 45 rows - 15 PACKET, 5 SOCKET, 4 CHAT, 16 SHEET,
         * 5 STORE.
         * E10 C8 (1.2.71) rewrote the verdicts of the spend's picks, `applyAdvancement`, `handleAdvancement` and
         * `stampStartingSheet`: a pick the sheet cannot take is refused and told, the experiences and the starting
         * spread read as the GMs hold them; no place added or struck.
         * E10 C16 (1.2.71) added three SHEET places, each a death the Present road reads now:
         * `seizeFloor`'s, as the GMs hold it, and the presenter's own browser's in `presentBullet` and
         * the sheet's `addPresentButton`; it rewrote the verdicts of `registerTrial`, `seizeFloor`'s
         * card, `presentDialog` and `trialQueue`. Measured on the harness on 10.10.2026 with C16 in
         * the tree: 49 places against 49 rows - 15 PACKET, 5 SOCKET, 4 CHAT, 20 SHEET, 5 STORE.
         * E10 fix r1-G1 (1.2.71) added two places: `verdictStore`, the Blackened a verdict was given with, kept
         * for its Finish (STORE), and `verdictCardPosted`, the Finish's reading of the card already posted (CHAT).
         * The table held 47 rows on its own line; merged beside C16 it holds 51 - 15 PACKET, 5 SOCKET,
         * 5 CHAT, 20 SHEET, 6 STORE (counted in the source on 10.10.2026).
         * E10 fix r1-G4 (1.2.71) rewrote the verdicts of `openVerdictDialog` and `executeSentenced`: a death nobody
         * has found is not dead to the verdict, and executing that student makes it the table's; no place added or struck.
         * E10 fix r1-G5 (1.2.71) named in `readTrial`'s verdict the line that keeps its death the GMs' own: its only
         * caller, `manageClassTrial`, warns a player and returns before it imports or reads anything (read in the
         * code, 10.10.2026: one call site, `read` in that function); no place added or struck.
         * E10 fix r2-G3 (1.2.71) rewrote the verdicts of `verdictHeld` (a wrong verdict's Blackened are dead as the
         * table knows it) and `executeSentenced` (an execution is public); no place added or struck.
         * E11 C10 (1.2.73) moved the reset's sheet writes - Health, Sanity and Hope, the deaths - out of
         * `wipeSeason` into `wipeStudent`, one student at a time, so the named declaration and its row
         * moved with them: `wipeSeason` read nothing of the sheet any more and its row went stale (on the
         * harness on 10.10.2026: 50 places against 51 rows). With the move, on the harness the same day:
         * 51 places against 51 rows - 15 PACKET, 5 SOCKET, 5 CHAT, 20 SHEET, 6 STORE.
         */
        const TRIAL_CENSUS = [
            ["PACKET gm-bridge.mjs#advancement.apply#actorId", "judged: knownSender + owns(actorId) (E28) [F7]"],
            ["PACKET gm-bridge.mjs#advancement.apply#picks", "judged (C8): `handleAdvancement` checks the offer `offerId` names (C6), the count it buys (`offerPicks`), each option, `experienceNew`'s name, a statistic among TRAITS and an `experienceUp` id on the sheet as the GMs hold it (`numberHeld`), all before its latch, else refused and told (`badRequest`, `missing`) [F7]"],
            ["PACKET gm-bridge.mjs#advancement.apply#offerId", "judged (C6): `handleAdvancement` finds it in the character's list as this GM holds it (`standingOffers`), else refused and told (`notOffered`); the picks are that offer's [F7]"],
            ["PACKET gm-bridge.mjs#advancement.offer#actorId", "judged: gmOnly + owns (a GM sender); C6 added `op` and `offerId` beside it [F7]"],
            ["PACKET gm-bridge.mjs#advancement.offer#op", "judged (C6): gmOnly; `as.oneOf(\"add\", \"take\")`, anything else refused by `handleAdvancementOffer` [F7]"],
            ["PACKET gm-bridge.mjs#advancement.offer#kind", "judged: gmOnly - only a GM hands out a Level Up; the kind is the GM's choice [F7]"],
            ["PACKET gm-bridge.mjs#advancement.offer#extra", "judged (C7): gmOnly - only a GM hands out a Level Up; `as.num`, and `recordOffer` keeps a whole number of picks [F7]"],
            ["PACKET gm-bridge.mjs#advancement.offer#deferred", "judged (C7): gmOnly; `as.num`, a whole number by `recordOffer`; read only by `takeBackOffer`, which gives that many picks back to the GMs' store [F7]"],
            ["PACKET gm-bridge.mjs#advancement.offer#offerId", "judged (C6): gmOnly; a take names an offer standing in that character's list as the primary holds it, else refused [F7]"],
            ["PACKET gm-bridge.mjs#advancement.ask#-", "judged: knownSender + playersOnly; quiet; the answer is addressed to the asker (`replyForMe`) [F7]"],
            ["PACKET gm-bridge.mjs#vote.run#op", "judged: gmOnly (C1) - only a GM opens, counts, restarts or reminds; a step not one of the five reads null and the primary runs nothing (`runVoteOp`), which answers `movedOn` or `notOpen` for a step the world's record has moved past [F3/F6]"],
            ["PACKET gm-bridge.mjs#vote.run#picks", "judged: gmOnly (C1); a number the primary bounds to one name and the students enrolled (`picksFor`), the register's count when it is not a positive integer [F3]"],
            ["PACKET gm-bridge.mjs#vote.cast#round", "judged (C2): knownSender + playersOnly; the primary holds it to the round of the vote open in the world (`recordBallot`, `ballotRefusal`) - a window of an earlier round is refused `movedOn`, told in the vote's words (`sendBallot`) [F1/F5]"],
            ["PACKET gm-bridge.mjs#vote.cast#choice", "judged (C2): knownSender + playersOnly; the voter is found from the sender (`voterActorFor`: `eligibleVoters` after `studentsJudged`, on `flagsHeldNow`), and the names are held to the vote's picks, none twice, each on that voter's list (`ballotRefusal`: notEligible, sameTwice, wrongCount, missing), refused and told; one row per sender in `ballotStore`, written in the vote's turn. The raw `vote.ballot` is gone (R313) [F1]"],
            ["PACKET gm-bridge.mjs#vote.ask#-", "judged (C2): knownSender + playersOnly; quiet; answers about the sender alone (`ballotFor`) - the ballot, that it is in, or null - and a sender the vote had not handed one is added to `issued` [F5]"],
            ["SOCKET vote.mjs#onBallotOpened#candidates", "out of scope: a GM -> player packet; `onBallotOpened` returns on a GM and unless the sender is a GM (vote.mjs:214-215). C2 keeps it - the ballot handed out at the open, a remind and a resend - and adds `vote.ask`'s reply for a player who loads while the vote is open; whatever a window listed, the primary judges the answer (`recordBallot`) [F5]"],
            ["SOCKET vote.mjs#onBallotOpened#round", "out of scope: a GM -> player packet (vote.mjs:214-215); C2 adds it - the round goes back with the answer, and the primary refuses an answer of a round the world has moved past (`ballotRefusal`, movedOn) [F5]"],
            ["SOCKET vote.mjs#onBallotOpened#picks", "out of scope: a GM -> player packet (vote.mjs:214-215); the window draws as many lists as it says, and since C2 the primary holds the answer to the vote's own count (`ballotRefusal`, wrongCount) [F5]"],
            ["SOCKET gm-bridge.mjs#onAdvancementOffers#offers", "out of scope: the primary's reply to an owner; `replyForMe` checks a GM sender and the address, and `receiveOffers` keeps only the receiver's own characters with a known kind (level-up.mjs:199) [F7]"],
            ["SOCKET gm-bridge.mjs#onAdvancementOffers#stamps", "out of scope: the primary's reply to an owner; `replyForMe` checks a GM sender and the address, and `receiveOffers` keeps only the receiver's own characters with a known kind (level-up.mjs:199) [F7]"],
            ["CHAT trial.mjs#registerTrial", "judged: a Present card's popup shows only when the author is a GM or owns the speaker and it holds the item (trial.mjs ~534-553); an objection acts on the primary only and `seizeFloor` re-judges it (author owns the objector, `itemAsHeld`, `floorRefusal`/`targetRefusal`), refused and told on the card; since C16 a dead objector too (`flagsAsHeld`) [F4 read road]"],
            ["CHAT trial.mjs#seizeFloor", "judged: the card's flags are claims; the objector's death through `flagsAsHeld` (C16) and the item through `itemAsHeld` (E29), both before anything is paid, then the synchronous refusals [1b.2]"],
            ["CHAT trial.mjs#presentedThisChapter", "out of scope: a GM's log of the chapter's Present and Objection cards (trial.mjs:778, 798, GM only); a display, feeds no write"],
            ["CHAT events.mjs#safewordCard", "out of scope: the safeword card (E10 changes only its handbook line, C17); GM gate"],
            ["CHAT vote.mjs#verdictCardPosted", "judged (fix r1-G1): a Finish posts no second card when the verdict's card is in the chat - its `verdictAt` the record's `at` and its author a GM (`message.author?.isGM`); a player's message with the flag counts for nothing"],
            ["SHEET vote.mjs#candidatesFor", "out of scope: a display and a list (R4 per 1b.2): `isDeceased` marks; the dead may be named (`allowVotingForDead`, guide p. 32), so a forged death names nobody new; the voter is decided by `eligibleVoters`, and since C2 a cast's names are held to this list on the primary (`ballotRefusal`) [F1]"],
            ["SHEET vote.mjs#eligibleVoters", "judged (C2): `isDeceased(flagsHeldNow(actor))` in one synchronous pass after `studentsJudged` (`judgedFor` of every student), which a step (`runVoteOp`), a cast (`recordBallot`) and an ask (`ballotFor`) each await outside the vote's turn; on a GM that is not the primary the document, as before [1b.2]"],
            ["SHEET vote.mjs#openVerdictDialog", "judged (C4, fix r1-G4): who is dead is read once as the GMs hold it - `flagsHeldNow(actor)` after `judgedFor` of every student, in one synchronous pass - and dead is the death the table knows (`isDeceased`; Q-E10-2 (a)): the dead stay listed with \" - dead\" as disabled options and `read` refuses one submitted anyway (Q-E10-1 (c)); a death the GMs hold and nobody has found is a living choice, named to the GM alone; the select opens on the world's `accusedIds` [1b.2]"],
            ["SHEET vote.mjs#verdictHeld", "judged (C5, fix r2-G3): who is executed, who advances and which Blackened a wrong verdict keeps, read once as the GMs hold them - `flagsHeldNow(actor)` in one synchronous pass, after `verdictReading` awaits `judgedFor` of the executed, the Blackened and every student - and dead is the death the table knows (`isDeceased`; Q-E10-2 (a)) in all three, the Blackened's since fix r2-G3; `isDeadForGm` names only `unfound`, the kept Blackened whose death the GMs hold, for the rule's window on the GM [1b.2]"],
            ["SHEET vote.mjs#executeSentenced", "judged (C5, fix r1-G4): each execution awaits `judgedFor(id)`, reads `flagsHeldNow(actor)` and, with nothing awaited after that read (H3), calls `killCharacter`, whose own head check is `isDeadForGm`, or for a death the GMs hold and nobody has found `publishDeath`, whose head reads the GMs' row (Q-E10-2 (a)); one the table knows dead is passed over, not killed twice; `killCharacter` is told `secret: false`, so an execution is public, an open incident's living victim's too (fix r2-G3) [1b.2]"],
            ["SHEET level-up.mjs#buildDetail", "out of scope: the picker's display on the player's own browser (R4); the GM decides in `handleAdvancement` [1b.2]"],
            ["SHEET level-up.mjs#applyAdvancement", "judged (C8): one `meansWrite` from `numberHeld` (E29 r2-H24/H25); a statistic not among TRAITS, an experience to raise with none named, or one not on the sheet the GMs hold (read in the job) stops the whole Level Up, nothing written; the `actor.system.experiences[id].name` read is a label in the GM's summary; R318 pins it [1b.2]"],
            ["SHEET trial.mjs#presentDialog", "out of scope: the presenter's own browser (R4): the window's target list and, since C16, a dead presenter refused before it opens (document `isDeceased`, a courtesy); `seizeFloor` judges on the primary"],
            ["SHEET trial.mjs#presentBullet", "out of scope: the presenter's own browser (R4): since C16 a dead presenter's card is refused on the API's road (document `isDeceased`); an Objection is judged by `seizeFloor` on the primary, and a Present has no GM-side judge - its popup (`registerTrial`) reads no death, left to E70's `isMutedDead`"],
            ["SHEET trial.mjs#seizeFloor", "judged (C16): a dead objector is refused and told on the primary - `isDeceased(await flagsAsHeld(actor))` before the item and the synchronous `floorRefusal`/`targetRefusal`, nothing paid [1b.2, F4]"],
            ["SHEET sheet.mjs#addPresentButton", "out of scope: a display on the sheet's own browser (R4, C16): no Present button for a dead student (document `isDeceased`)"],
            ["SHEET trial-floor-ui.mjs#startClassTrial", "judged (C12): who is alive for 'nobody for the trial' is read as the GMs hold it - `isDeceased(flagsHeldNow(actor))` in one synchronous pass after `judgedFor` of every student, as `eligibleVoters`; the card's budget line after the write still counts `livingStudents()` (a display, R4) [1b.2]"],
            ["SHEET trial-floor-ui.mjs#readTrial", "out of scope: the trial console's display (R4, GM only, C12): the register's count (`blackenedIds`) and whether a student died this chapter of this season (`isDeadForGm`, `deathRecordFor` and since E11 C12 `sameSeason`, a death the GMs keep included), to warn of an empty register; it decides nothing - `manageClassTrial`, its only caller, answers a player with a warning before anything is read"],
            ["SHEET mastermind.mjs#openFinalVerdictDialog", "out of scope: the Final Trial's window (display, GM only); `isDeadForGm` reads the GM deaths store beside the flag; since C10 the trial console's verdict opens it in a Final Trial (`TRIAL_ACTIONS.verdict`)"],
            ["SHEET mastermind.mjs#applyFinalVerdict", "out of scope: `isDeadForGm` = the document flag or the GM deaths store - the same class as `applyVerdict`'s, left to E40; C10 adds two GM writes, the trial's record (`verdictApplied` and a `verdict` with `final: true` that names nobody) and the clock's `finalTrial: false`"],
            ["SHEET character.mjs#stampStartingSheet", "judged (C8): the spread read as the GMs hold it (`numberHeld`) in one `meansWrite` job of the student's queue, not off the prepared `actor.system`; R318 [1b.2]"],
            ["SHEET gm-bridge.mjs#handleAdvancement", "judged (C8): S03-22 - a statistic among TRAITS and an `experienceUp` id on the held sheet (`numberHeld` at the experiences' root), read synchronously before the latch, else refused and told; `applyAdvancement` checks the experiences again in its job [F7, 1b.2]"],
            ["SHEET chapter.mjs#livingStudents", "out of scope as a function (document `isDeceased`); its R1 caller `applyVerdict` stopped using it in C5 (`verdictHeld`) [1b.2]"],
            ["SHEET chapter.mjs#killCharacter", "judged: GATED by E33 C1a (R220), its head check `isDeadForGm`. Since E11 C1 the record it writes (through `markDeceased`, and the `deaths` row through `recordSecretDeath`) carries the death's `phase` and `epoch: seasonEpoch()`; it reads nothing new [1b.1 death record]"],
            ["SHEET season-setup.mjs#wipeStudent", "out of scope: a GM gate, reached from the reset's `wipeSeason` on the primary (E33 C1a's GM-side rows) and from tier 2's sandbox; it writes a student's values back (`deaths`: Health and Sanity, `despair`: Hope) and reads the death and the items off the document only to wipe them (E11 C10). The clock step (C10: `season` + 1, `finalTrial: false`) stays `wipeSeason`'s"],
            ["STORE vote.mjs#trialProgress", "not a source: a world setting only a GM writes (`setTrialProgress`; the vote's fields on the primary GM, `runVoteOp`); C1 added `vote`, `accused`, `total`, `accusedIds` and `verdict`, which C5 writes: the stage, right or wrong, the executed, who gave it and when, the steps done and failed - never a Blackened; C10: a Final Trial's verdict, `{ stage: \"done\", final: true, by, at }`, naming nobody [F3/F4/F6]"],
            ["STORE gm-stores.mjs#ballotStore", "not a source: a GM store (`gmBallots`) the primary GM writes (`recordBallot`, the run of the bridge's `vote.cast` since C2) and syncs between the GMs only; a count reads the rows of the world's chapter and round (C1) [F1/F2]"],
            ["STORE gm-stores.mjs#offerStore", "not a source: a GM store the primary writes (`recordOffer`, `dropOffer`); a row is a list per character since C6, a 1.2.70 row read as a list of one (`offerList`) [F7]"],
            ["STORE gm-stores.mjs#deferredOfferStore", "not a source: a GM store [F7]"],
            ["STORE gm-stores.mjs#verdictStore", "not a source (fix r1-G1): a GM store (`gmVerdict`) `applyVerdict` writes - the verdict's `at` and the Blackened its GM named - and `finishVerdict` reads; never sent to a player"],
            ["STORE settings.mjs#trialQueue", "not a source: a world setting only a GM writes; since C16 a sheet's Present reads `trialQueue.active` on render (`addPresentButton`) and on change (`repaintPresentButtons`, from `SYNC.trial`)"]
        ];
        const ROADS = /^(?:vote|advancement)\./;
        const FILES = ["vote.mjs", "level-up.mjs", "trial.mjs", "trial-floor.mjs", "trial-floor-ui.mjs", "events.mjs", "mastermind.mjs"];
        const NAMED = { "character.mjs": ["stampStartingSheet"], "gm-bridge.mjs": ["handleAdvancement", "handleAdvancementOffer", "askForOffers", "onAdvancementOffers"],
            "sheet.mjs": ["addPresentButton", "injectAdvanceButton"], "chapter.mjs": ["livingStudents", "killCharacter", "openChapterEndDialog"],
            "season-setup.mjs": ["wipeStudent"], "clock.mjs": ["reconcilePhase"] };
        // Where gm-bridge.mjs registers its sockets and answers an owner: read for handlers, never a row of their own.
        const BRIDGE_TOPS = /^(?:BRIDGE_ACTIONS|ACTION_\w*|registerGmBridge|replyForMe)$/;
        const SHEET = [/\bisDeceased\(|\bisDeadForGm\(|\blivingStudents\(|\bdeceased\b/, /\badvances\b/, /system\.traits\b|\bTRAITS\b/,
            /system\.experiences\b|\bexperiences?(?:New|Up)\b/, /system\.resources\b|\bresourceMax\(|hitPoints|stress\.max/];
        const HELD = /\b(?:judgedFor|flagsAsHeld|flagsHeldNow|actorHeldNow|actorAsHeld|numberHeld|meansWrite|gmMeansWrite|itemAsHeld|meansHeld|heldMark)\s*\(/;
        const RAW = /\b(?:isDeceased|isDeadForGm|livingStudents|resourceMax)\s*\(|\bactor\.system\b|\.system\.(?:traits|experiences|resources|levelData)\b|getFlag\(\s*MODULE_ID\s*,\s*FLAGS\.(?:deceased|advances)/;
        const CHAT = /\b(?:m|msg|message|chatMessage)\??\.getFlag\(\s*MODULE_ID\s*,|\b(?:m|msg|message)\??\.speaker\??\.actor\b/;
        const TOP = /^(?![\s}\])]|$)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s*([\w$]+)|class\s+([\w$]+)|(const|let|var)\s+([\w$]+))?/gm;
        const STORES = [["vote.mjs", "ballots"], ["vote.mjs", "trialProgress"], ["gm-stores.mjs", "ballotStore"], ["gm-stores.mjs", "offerStore"],
            ["gm-stores.mjs", "deferredOfferStore"], ["gm-stores.mjs", "verdictStore"], ["settings.mjs", "trialQueue"]];
        const censusOf = (bridge, sources) => {
            const found = [];
            for (const [action, decl] of Object.entries(bridge)) {
                if (!ROADS.test(action)) continue;
                const fields = Object.keys(decl?.sanitize?.fields ?? {});
                for (const field of fields.length ? fields : ["-"]) found.push(`PACKET gm-bridge.mjs#${action}#${field}`);
            }
            const files = new Map(sources);
            const tops = [];
            for (const file of [...FILES, ...Object.keys(NAMED)]) {
                if (!files.has(file)) continue;
                const code = blankComments(files.get(file));
                const at = [...blankLiterals(code).matchAll(TOP)].map(m => ({ at: m.index, name: m[1] ?? m[2] ?? m[4] ?? null, binding: Boolean(m[3]) }));
                at.forEach((top, i) => {
                    if (!top.name) return;
                    if (NAMED[file] && !NAMED[file].includes(top.name) && !(file === "gm-bridge.mjs" && BRIDGE_TOPS.test(top.name))) return;
                    tops.push({ file, ...top, text: code.slice(top.at, at[i + 1]?.at ?? code.length) });
                });
            }
            const handlers = new Set();
            for (const top of tops) {
                for (const m of top.text.matchAll(/game\.socket\.on\(\s*[\w.]+\s*,\s*([A-Za-z_]\w*)\s*\)/g)) handlers.add(`${top.file}#${m[1]}`);
                for (const m of top.text.matchAll(/return\s+([A-Za-z_]\w*)\(\s*payload/g)) handlers.add(`${top.file}#${m[1]}`);
            }
            for (const handler of handlers) {
                const [file, name] = handler.split("#");
                // The bridge's own sockets are E28's (R1b and the bridge's tables); its Level Up ones are the trial's.
                if (file === "gm-bridge.mjs" && !/Advancement/.test(name)) continue;
                const top = tops.find(t => t.file === file && t.name === name);
                // A handler this reader cannot find is a key no row can hold.
                const fields = top ? [...new Set([...top.text.matchAll(/\bpayload\??\.(\w+)/g)].map(m => m[1]).filter(f => f !== "action"))] : ["?"];
                for (const field of fields.length ? fields : ["-"]) found.push(`SOCKET ${handler}#${field}`);
            }
            for (const top of tops) if (CHAT.test(top.text)) found.push(`CHAT ${top.file}#${top.name}`);
            for (const top of tops) {
                if (top.file === "gm-bridge.mjs" && BRIDGE_TOPS.test(top.name)) continue;
                // A table or a constant reads no sheet.
                if (top.binding && !/=>|function/.test(top.text)) continue;
                if (!SHEET.some(re => re.test(top.text))) continue;
                if (HELD.test(top.text) || RAW.test(top.text) || NAMED[top.file]?.includes(top.name)) found.push(`SHEET ${top.file}#${top.name}`);
            }
            for (const [file, name] of STORES) {
                if (files.has(file) && new RegExp(`\\b${name}\\b`).test(blankComments(files.get(file)))) found.push(`STORE ${file}#${name}`);
            }
            return found;
        };
        const judge = (found, table) => {
            const rows = new Set(table.map(([key]) => key)), seen = new Set(found);
            return { unclassified: found.filter(key => !rows.has(key)), stale: [...rows].filter(key => !seen.has(key)) };
        };
        const KINDS = ["PACKET", "SOCKET", "CHAT", "SHEET", "STORE"];

        const planted = censusOf({
            "vote.planted": { sanitize: { fields: { choice: "id" } } },
            "observe.planted": { sanitize: { fields: { actorId: "id" } } }
        }, [
            ["vote.mjs", "function registerPlanted() {\n    game.socket.on(EVENT, (payload, senderId) => {\n        if (payload?.action === \"x\") return onPlanted(payload, senderId);\n    });\n}\n"
                + "function onPlanted(payload) {\n    return payload.choice;\n}\n"
                + "export function judged(actor) {\n    return isDeceased(actor);\n}\n"
                + "function unread(actor) {\n    // its deceased flag is read elsewhere\n    return actor.name;\n}\n"
                + "const forged = msg => msg.getFlag(MODULE_ID, \"voteOpen\");\n"
                + "let ballots = null;\n"],
            ["chapter.mjs", "export function notNamed(actor) {\n    return isDeceased(actor);\n}\n"]
        ]);
        equal(JSON.stringify(planted), JSON.stringify(["PACKET gm-bridge.mjs#vote.planted#choice", "SOCKET vote.mjs#onPlanted#choice",
            "CHAT vote.mjs#forged", "SHEET vote.mjs#judged", "STORE vote.mjs#ballots"]),
            "the census reader does not read the planted fixture as planted - the live census below would measure the wrong places");
        equal(JSON.stringify(judge(planted, [["PACKET gm-bridge.mjs#vote.planted#choice", ""], ["SOCKET vote.mjs#onPlanted#choice", ""],
            ["SHEET vote.mjs#judged", ""], ["SHEET vote.mjs#gone", ""], ["STORE vote.mjs#ballots", ""]])),
            JSON.stringify({ unclassified: ["CHAT vote.mjs#forged"], stale: ["SHEET vote.mjs#gone"] }),
            "the census judge does not tell a planted reader without a row, or a row without its reader");

        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const found = censusOf(BRIDGE_ACTIONS, await otherSources());
        const count = kind => found.filter(key => key.startsWith(`${kind} `)).length;
        must(KINDS.every(kind => count(kind) > 0),
            `the census read ${KINDS.map(kind => `${count(kind)} ${kind}`).join(", ")} - a kind it reads none of would measure nothing`);
        const verdict = judge(found, TRIAL_CENSUS);
        log(`R311: the census read ${found.length} place(s) (${KINDS.map(kind => `${count(kind)} ${kind}`).join(", ")}) `
            + `against ${TRIAL_CENSUS.length} row(s); ${verdict.unclassified.length} without a row, ${verdict.stale.length} row(s) without a place`);
        equal(JSON.stringify(verdict), JSON.stringify({ unclassified: [], stale: [] }),
            "a trial road without a census row, or a row whose road is gone: give the new one a verdict (what judges it, or the E10 commit that will) and strike the gone one");
    }],

    ["R346 - a season road has a census row, and every row judges a road", async () => {
        /*
         * E11 C0, 10.10.2026; R311's twin for the chapter, the body's discovery and the season
         * reset. E11 moves the discovery, the hold, the project tokens and the reset's cast groups
         * off what a player's browser can write, and this test keeps the list of the places that
         * read it closed: a new one fails until it has a row and a verdict, a row whose place is
         * gone fails until it is struck. Five kinds, read live as R311 reads them: PACKET - every
         * field of a BRIDGE_ACTIONS declaration whose action is the Level Up's apply, a Call's
         * arming, a token's send-back, a project row or a stash's search (ROADS); SOCKET - every
         * raw socket handler the season's files register, and, new here, an arrow registered
         * inline (sync.mjs `registerSync`, which C3's gather broadcast rides), whose declaration
         * is then the handler; gm-bridge.mjs's own are E28's and are not rows; CHAT - a top-level
         * declaration that reads a chat message's module flags or its speaker's actor; SHEET - one
         * that reads a student's death or Monocub flag, experiences or the starting snapshot,
         * resources, items (bedroom keys) or the Call/action flags, held or off the document, or
         * is one of the named few (NAMED) whatever it reads; STORE - the places the fields live
         * (seven at 4aad1fd, eight since C1), each found by its name in its file. A verdict says what judges the place today; a
         * row ending "(E11 C<n>)" names the commit that changes it, and that commit rewrites the
         * row with the code. It reads names and text, not data flow: a reader in another file, or
         * reached through a helper this list does not name, is not seen.
         * Measured 10.10.2026 at 4aad1fd (1.2.72): the SOCKET, CHAT, SHEET and STORE keys of this
         * reader (run in Node on the tree's files) and of the parse-only census kept with the E11
         * plan outside the repository were the same 40 - 4 SOCKET, 1 CHAT, 28 SHEET, 7 STORE -
         * and the census's 28 PACKET rows are the rest of the 68 below; on the harness the same
         * day this test read 68 places against the 68 rows (28 PACKET). Its 5 PLANNED rows (places
         * E11's commits will add: `bodiesFound`, `witnessesOf`, `bodiesToDiscover`, `RESET_STEPS`,
         * `placeCast`) are left to the commits that add them. Eleven rows are R311's too (the
         * three `advancement.apply` fields, `applyAdvancement`, `stampStartingSheet`,
         * `handleAdvancement`, `livingStudents`, `killCharacter`, `wipeSeason` and the two offer
         * stores): each table judges them for its own stage, and a commit that changes one
         * rewrites both.
         * E11 C1 (1.2.73) added three of the PLANNED places - `bodiesFound` (STORE), `witnessesOf`
         * and `bodiesToDiscover` (SHEET) - and struck `checkBodyFound`'s row, which reads no flag
         * itself any more: on the harness on 10.10.2026 this test read 70 places (28 PACKET,
         * 4 SOCKET, 1 CHAT, 29 SHEET, 8 STORE) against the 70 rows.
         * E11 C2 (1.2.73) added no place: the GM panel's next line reads the deaths through
         * `bodiesToDiscover` (a helper this list names), and it rewrote the three rows that say so.
         * E11 C3 (1.2.73) added no place either: the gather's camera (call-world.mjs
         * `panToGathered`) reads token ids and this client's canvas, no death, flag or resource;
         * it rewrote the two SOCKET rows of `registerSync`, `gatherEveryone`'s and `bodyFound`'s.
         * E11 C10 (1.2.73) added one place, `wipeStudent` (SHEET: a cast group's part on one sheet,
         * out of the reset's `wipeSeason`), and rewrote the rows it reads or writes - `keysHeldBy`
         * held, the Call rows, `seasonItems`, `wipeSeason`, `grantBedroomKey`: on the harness on
         * 10.10.2026 this test read 71 places (28 PACKET, 4 SOCKET, 1 CHAT, 30 SHEET, 8 STORE)
         * against the 71 rows.
         * E11 C10b (1.2.73) added the PLANNED place `placeCast` (SHEET: who is dead, read before
         * the reset moves the cast's tokens): on the harness on 10.10.2026 this test passed - no place
         * without a row, no row without a place - against 72 rows (28 PACKET, 4 SOCKET, 1 CHAT,
         * 31 SHEET, 8 STORE, counted in the source); at the parent, with the row, it read the row stale.
         * E11 C11 (1.2.73) added no place: the rule of which experiences go (character.mjs
         * `seasonExperiences`) is a pure function over what the restore hands it; it rewrote the rows of
         * `restoreStartingSheet` (OPEN at the base, held now), `applyAdvancement`, `wipeStudent` and the
         * two `advancement.apply` packets.
         * The reader is run first on a fixture with a packet of each family and of none, an inline
         * socket arrow, a judged reader, a reader whose flag is only in a comment, a chat reader
         * without a row, a declaration of a named file that is not named, a store and a stale row.
         */
        const SEASON_CENSUS = [
            ["PACKET gm-bridge.mjs#advancement.apply#actorId", "judged: knownSender + owns (E28). Since E11 C11 the GM's Level Up writes the new experience's id into the GM flag `levelUpExperiences` in its one write, and takes no new claim (R355). [1b.1 Level Up experiences] (E11 C11)"],
            ["PACKET gm-bridge.mjs#advancement.apply#picks", "judged (E10 C8): checked against the standing offer on the held sheet (`numberHeld`); an `experienceNew` is the only pick written down (`levelUpExperiences`, E11 C11)"],
            ["PACKET gm-bridge.mjs#advancement.apply#offerId", "judged (E10 C6): must name a standing offer of that character, else refused and told; E11 reads nothing from it"],
            ["PACKET gm-bridge.mjs#vault.findStash#actorId", "out of scope: judged on the primary (knownSender + owns, the Analyze roll by `rollRefusal`); it writes `stashesFound`, which C10's reset group clears together with the concealment flag (a region flag, a GM document) [1b.1 stash]"],
            ["PACKET gm-bridge.mjs#vault.findStash#total", "out of scope: judged on the primary (knownSender + owns, the Analyze roll by `rollRefusal`); it writes `stashesFound`, which C10's reset group clears together with the concealment flag (a region flag, a GM document) [1b.1 stash]"],
            ["PACKET gm-bridge.mjs#vault.findStash#isCritical", "out of scope: judged on the primary (knownSender + owns, the Analyze roll by `rollRefusal`); it writes `stashesFound`, which C10's reset group clears together with the concealment flag (a region flag, a GM document) [1b.1 stash]"],
            ["PACKET gm-bridge.mjs#vault.findStash#rollId", "out of scope: judged on the primary (knownSender + owns, the Analyze roll by `rollRefusal`); it writes `stashesFound`, which C10's reset group clears together with the concealment flag (a region flag, a GM document) [1b.1 stash]"],
            ["PACKET gm-bridge.mjs#project.progress#countdownId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.progress#amount", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.progress#actorId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.progress#rollId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.progress#relief", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.progress#bonus", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.share#countdownId", "out of scope: judged on the primary (`guardShare*`: you share only what you can see). C7's `knowsProject` orphan branch (no countdown -> false) makes an orphan's id unshareable on the player's side too; the bridge's judgement is unchanged [1b.1 knowsProject] (E11 C7)"],
            ["PACKET gm-bridge.mjs#project.share#targetUserId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.sabotage#targetId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.sabotage#difficulty", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.sabotage#actorId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.sabotage#rollId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.sabotage#penalty", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.sabotage#relief", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.unsabotage#targetId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#project.unsabotage#repairId", "out of scope: a project bridge row judged on the primary (E28/E08+E28); it writes Countdowns/`projectMeta`, never a token. E11's project work is the token sweep (C7) and the primary-only move (C8) [1b.1 projectMeta]"],
            ["PACKET gm-bridge.mjs#token.sendBack#sceneId", "out of scope (Q5 (a), the owner 09.10): a witness's position is judged on the mover's browser (movement.mjs:1084); whether it is legal is E12's. E11 C1 reads positions on the primary in the `updateToken` hook as they land [1b.1 token position]"],
            ["PACKET gm-bridge.mjs#token.sendBack#tokenId", "out of scope (Q5 (a), the owner 09.10): a witness's position is judged on the mover's browser (movement.mjs:1084); whether it is legal is E12's. E11 C1 reads positions on the primary in the `updateToken` hook as they land [1b.1 token position]"],
            ["PACKET gm-bridge.mjs#token.sendBack#position", "out of scope (Q5 (a), the owner 09.10): a witness's position is judged on the mover's browser (movement.mjs:1084); whether it is legal is E12's. E11 C1 reads positions on the primary in the `updateToken` hook as they land [1b.1 token position]"],
            ["PACKET gm-bridge.mjs#call.arm#actorId", "out of scope: judged on the primary (E28/E29: `guardArm*`, `judgedFor` before the guards); it writes the `pendingCall` flag (put back by E29 when a player writes it). Since E11 C10 the reset's `seals` group unsets the flag on every student (season-setup.mjs `wipeStudent`) and reads nothing [1b.1 pendingCall, 1b.2]"],
            ["PACKET gm-bridge.mjs#call.arm#call", "out of scope: judged on the primary (E28/E29: `guardArm*`, `judgedFor` before the guards); it writes the `pendingCall` flag (put back by E29 when a player writes it). Since E11 C10 the reset's `seals` group unsets the flag on every student (season-setup.mjs `wipeStudent`) and reads nothing [1b.1 pendingCall, 1b.2]"],
            ["SOCKET eclipse.mjs#onMovesSocket#moves", "out of scope: a GM -> player packet (the Eclipse's placements); C3 touches only `startEclipse`'s guard; no E11 commit changes it"],
            ["SOCKET eclipse.mjs#onMovesSocket#stamps", "out of scope: a GM -> player packet (the Eclipse's placements); no E11 commit changes it"],
            ["SOCKET sync.mjs#registerSync#kind", "judged: the handler applies a packet only from a GM sender (`game.users.get(senderId)?.isGM`, sync.mjs:131) and touches no actor. Since E11 C3 the gather's camera rides it: `SYNC.gather` carries `{ room, scene, tokenIds }` and each client pans to its own student's token (call-world.mjs `panToGathered`, `canvas.animatePan`; none without a drawn canvas) - the GM-sender check is the plan's `senderOf(senderId)?.isGM`, and a player's packet pans nobody (65 B1b)"],
            ["SOCKET sync.mjs#registerSync#data", "judged: as `#kind` (a GM sender only); since E11 C3 `SYNC.gather`'s `tokenIds` are read only to find this client's own token on its canvas, and nothing is written"],
            ["CHAT season-setup.mjs#moduleMessages", "out of scope: the reset's `cards`/`chatRest` steps select the module's chat by its flag to delete it; a player's card carrying the flag is deleted with them, which is what the reset means. C9 moves the step into `RESET_STEPS` and 65 F reads a failing delete (`ChatMessage.deleteDocuments` stubbed to throw) (E11 C9)"],
            ["SHEET chapter.mjs#livingStudents", "out of scope: rule A, the table's fact (`isDeceased`, document): a display and a count; a player's own `deceased` write is put back (GM_FLAGS); no E11 commit changes it"],
            ["SHEET chapter.mjs#livingStudentsForGm", "out of scope: rule B, the GM's judgement (`isDeadForGm`: the flag or the `deaths` store); no E11 commit changes it"],
            ["SHEET chapter.mjs#killCharacter", "judged: GATED by E33 C1a (R220), its head check `isDeadForGm`. C1 adds `phase` and `epoch: seasonEpoch()` to the record it writes (through `markDeceased` and the `deaths` row) and reads nothing new. [1b.1 death record] (E11 C1)"],
            ["SHEET chapter.mjs#incidentVictimDied", "out of scope: a GM-gated check of the incident's victim (`isDeceased`); no E11 commit changes it"],
            ["SHEET chapter.mjs#bulletsHeldBy", "out of scope: Truth Bullets on a sheet at a death's publication (E05/E29 items audit); no E11 commit changes it"],
            ["SHEET chapter.mjs#destroyBullets", "out of scope: Truth Bullets destroyed at a death's publication (E05); no E11 commit changes it"],
            ["SHEET chapter.mjs#publishDeath", "out of scope as a reader (GM gate; `isDeceased` of the document after the write). Since E11 C1 its record keeps the row's chapter, day, time of day, phase and season, and a verdict that executes a death the GMs hold (vote.mjs `executeSentenced`, E10 fix r1-G4) passes `phase: \"classTrial\"`, so the executed is no body to discover (tier 2 \"a body the verdict executed is not found again after the trial - a death the GMs held included\")"],
            ["SHEET chapter.mjs#reviveCharacter", "out of scope: a GM's undo of a death (GM gate); no E11 commit changes it"],
            ["SHEET chapter.mjs#openDeathDialog", "out of scope: a GM's window listing the living for the GM (`livingStudentsForGm`); no E11 commit changes it"],
            ["SHEET chapter.mjs#publishFoundBodies", "judged (E11 C1): the room's deaths read off the primary's mark (`flagsHeldNow`) in one synchronous pass before any is published, and the bodies the stamp names chosen by `bodiesToDiscover` in the same pass (H3) [1b.2]"],
            ["SHEET chapter.mjs#witnessesOf", "judged (E11 C1): a pure filter over the flags it is handed - `checkBodyFound` hands it `flagsHeldNow` and reads every token in one synchronous step after its imports (H3, H17); the dead who are not Monocubs are not witnesses (R348) [1b.2]"],
            ["SHEET chapter.mjs#bodiesToDiscover", "judged (E11 C1): a pure rule over the flags and rows it is handed (`deadIn`, the record's chapter, `epoch` and `phase`, this chapter's stamps) - `checkBodyFound` and `publishFoundBodies` hand it `flagsHeldNow` in one synchronous step (R347), and since E11 C2 the GM panel's next line (gm-panel.mjs `bodyWaiting`, a GM's browser) does the same [1b.2]"],
            ["SHEET chapter.mjs#sweepPlan", "out of scope: E09 C1's chapter-end sweep of items; C5 only orders it as a step of `CHAPTER_END_STEPS`; no E11 commit changes it"],
            ["SHEET character.mjs#stampStartingSheet", "held (E10 C8): reads inside a `meansWrite` job from `numberHeld`; the snapshot C11's restore compares against"],
            ["SHEET character.mjs#restoreStartingSheet", "held (E11 C11; E10 C8's owed (3)): `sheetAtStart`, `levelUpExperiences` and the advances through `flagsHeldNow` and the experiences through `numberHeld`, in one `meansWrite` job before its one write - `flagsAsHeld`'s wait is the job's start; deletes a Level Up's experiences (`seasonExperiences`; Q1 (a) for a starting sheet stamped before 1.2.73). R355 [1b.2]"],
            ["SHEET season-setup.mjs#hasOpeningItem", "out of scope: Season Setup's opening items (GM window); no E11 commit changes it"],
            ["SHEET season-setup.mjs#despairSplitCounts", "out of scope: Season Setup's Despair split (GM window, `isDeadForGm`); no E11 commit changes it"],
            ["SHEET season-setup.mjs#seasonItems", "out of scope: the reset's `items` step lists the cast's items to delete on the primary; a player's own item write is audited (E29). Since E11 C10 each student's bedroom keys are handed back at once, in the same group (`wipeStudent`: `reconcileBedroomKeys({ silent: true, owners })`)"],
            ["SHEET season-setup.mjs#wipeSeason", "out of scope: on the primary only (E04), E33 C1a's GM-side rows; document reads of the items it deletes (the Truth Bullets). C9 runs it as `RESET_STEPS` (the incident first); since E11 C10 every cast group's part on a student's sheet is `wipeStudent`'s, called for each student. C10b adds the cast's tokens' step (E11 C10b)"],
            ["SHEET season-setup.mjs#wipeStudent", "out of scope: a GM gate, reached from the reset on the primary (`wipeSeason`) and from tier 2's sandbox; its document reads (`isDeceased`, `monocub`, `pendingCall`, the rests' and betrayal stamps, the season's items) decide only whether to write. Health and Sanity 0 in `deaths` and Hope `STARTING.hope` in `despair` (D12, `trustedWrite`, `setup`) are constants with no read: the reset's value supersedes a pending put-back [1b.2]. Since E11 C11 its `advancement` part hands the reset what the restore kept and could not tell apart (`left`, the report's line); the reads are the restore's, row above (E11 C11)"],
            ["SHEET season-setup.mjs#placeCast", "judged (E11 C10b): the reset's step on the primary only (`isPrimaryGm`; on a second GM it moves nobody, 65 P3); who is dead is read off the primary's mark (`flagsHeldNow`, then `isDeadForGm` and `isMonocub`) in the one synchronous pass that decides every move before the first is made (H3) [1b.2]; the bedrooms through `allBedroomsAnywhere`, every scene and never the GM's camera (ITEM-16, R354); the moves are a GM's token updates, no player road"],
            ["SHEET call-world.mjs#gatherEveryone", "out of scope: GM gate; `isDeadForGm` picks whose token moves (the dead stay). since E11 C3 it ends with the gather's camera packet after the moves (SOCKET sync.mjs#registerSync); C1's witnesses are read elsewhere"],
            ["SHEET projects-map.mjs#findProjectActor", "not a source: the project actor (PROJECT_ACTOR, OBSERVER for players) - a player cannot update it (plan 1b.1, read in projects-map.mjs); C7's `projectTokenPlan` reads tokens by their project id, not this actor's items (E11 C7)"],
            ["SHEET eclipse.mjs#placingActors", "out of scope: the Eclipse's placement list (document flags); C3 adds a refusal in `startEclipse` before it runs; no E11 commit changes it"],
            ["SHEET gm-bridge.mjs#handleAdvancement", "judged (E10 C8): the picks on the held sheet (`numberHeld`), refused and told."],
            ["SHEET level-up.mjs#applyAdvancement", "held (E10 C8): one `meansWrite` from `numberHeld`. Since E11 C11 a new experience's id joins the GM flag `levelUpExperiences` (in GM_FLAGS, so a player's write of it is put back), read with `flagsHeldNow`, in the same write. R355 [1b.1, 1b.2] (E11 C11)"],
            ["SHEET vault.mjs#keysHeldBy", "held (E11 C10): on a GM `itemsHeldNow(actor)` - a key's room as the primary's mark holds it, so a room a player's browser wrote on an item is no key there - and a player's browser its own document; `grantBedroomKey` waits for `judgedFor` before it asks [1b.2]"],
            ["SHEET vault.mjs#grantBedroomKey", "out of scope as a reader (through `keysHeldBy`, row above, after `judgedFor`: a key it made a moment ago is in the mark; one a player deleted is flagged, not put back, and made again); since E11 C10 the reset's `items` group calls it for each student through `reconcileBedroomKeys({ silent: true, owners })` (`grantItem`, `gmRuling`), no new road"],
            ["SHEET murder-rules.mjs#registerMurder", "judged where it acts: the `updateToken` hook runs on the primary (`maybeBodyFound` -> `checkBodyFound`); its `isDeadForGm`/resources reads are the incident's (E05). E11 C1 changed only the discovery it calls"],
            ["SHEET murder-rules.mjs#closeIncident", "out of scope as a reader (`isDeadForGm` of the victim, E05). C9 adds `conclude: false` for the reset only: the self-inflicted kill, ties, register, broken tool, case keys and the close's card are skipped [3.1] (E11 C9)"],
            ["SHEET settings.mjs#deathRecordFor", "out of scope: the GM's record (flag or `deaths` row); since E11 C1 it answers the row's `phase` and `epoch` too, and C12's `sameSeason` reads `epoch` (E11 C12)"],
            ["STORE settings.mjs#bodyFound", "not a source: a world setting only a GM writes (`setBodyDiscovery`); since E11 C2 its freshness compares the chapter, the day and the time of day (`holdFreshAt`, R350). since E11 C3 `startEclipse` refuses while it is set"],
            ["STORE settings.mjs#bodiesFound", "not a source: a world setting (`config: false`) only a GM writes (`recordBodyFound`), whose one caller is `announceBody` (R349); cut by the reset's `bodyFound` group (E11 C1)"],
            ["STORE gm-stores.mjs#deathStore", "not a source: a GM store; since E11 C1 a row carries the death's `phase` and `epoch`, and since E11 C2 the GM panel's next line reads a pending row of this chapter and season through `bodiesToDiscover` (a GM's browser only)"],
            ["STORE gm-stores.mjs#blackenedStore", "not a source: a GM store; rows keep their chapter and season (E04; tier 2 \"a Blackened of another chapter or season does not count...\", tests-tier2.mjs:36739 at 4aad1fd) - Q3 (a) rests on it; C9's `conclude: false` writes no row (E11 C9)"],
            ["STORE gm-stores.mjs#offerStore", "not a source: a GM store cut by `advancement` (E04); 65 R reads 0 offers after the reset. (E11 C0)"],
            ["STORE gm-stores.mjs#deferredOfferStore", "not a source: a GM store cut by `advancement` (E04) (E11 C0)"],
            ["STORE projects-secrecy.mjs#projectMeta", "not a source: a world setting only a GM writes; C8 adds `mapHidden` (set by the primary's `deleteToken` hook for a project token the module did not delete) and makes `onProjectTokenMoved` write it on the primary only, never for an orphan (E11 C8)"],
            ["STORE settings.mjs#clock", "not a source: a world setting only a GM writes; `finalTrial`/`season`/`seasonStartedAt` per E10 C10 and `resetCutPatch`; C6's Edit campaign asks before the irreversible effects. (E11 C6)"]
        ];
        const ROADS = /^(?:advancement\.apply|call\.arm|token\.sendBack|project\.\w+|vault\.findStash)$/;
        const FILES = ["chapter.mjs", "character.mjs", "season-setup.mjs", "call-world.mjs", "projects.mjs", "projects-map.mjs", "projects-secrecy.mjs", "eclipse.mjs"];
        const NAMED = { "gm-bridge.mjs": ["handleAdvancement"], "level-up.mjs": ["applyAdvancement"],
            "vault.mjs": ["keysHeldBy", "grantBedroomKey", "reconcileBedroomKeys", "setStash", "allBedroomsAnywhere"], "events.mjs": ["bodyCard"],
            "gm-panel.mjs": ["nextStep", "openClockDialog"], "clock.mjs": ["setClock", "reconcilePhase", "setPhase"],
            "murder-rules.mjs": ["endMurder", "closeIncident", "registerMurder"], "visibility.mjs": ["applyToProjectToken", "applyToToken"],
            "sync.mjs": ["registerSync"], "mastermind.mjs": ["finalTruthPlacedThisChapter"], "settings.mjs": ["bodyDiscoveryFresh", "deathRecordFor"] };
        // Where gm-bridge.mjs registers its sockets and answers an owner: read for handlers, never a row of their own.
        const BRIDGE_TOPS = /^(?:BRIDGE_ACTIONS|ACTION_\w*|registerGmBridge|replyForMe)$/;
        const SHEET = [/\bisDeceased\(|\bisDeadForGm\(|\blivingStudents(?:ForGm)?\(|\bdeathRecordFor\(|FLAGS\.(?:deceased|monocub)\b/,
            /system\.experiences\b|\bsheetAtStart\b|\blevelUpExperiences\b/, /system\.resources\b|hitPoints|resources\.(?:hope|stress)\b/,
            /\bkeysHeldBy\(|\bitemsHeldNow\(|\bactor\.items\b/, /FLAGS\.(?:pendingCall|lastAction)\b/];
        const HELD = /\b(?:judgedFor|flagsAsHeld|flagsHeldNow|actorHeldNow|actorAsHeld|numberHeld|meansWrite|gmMeansWrite|itemAsHeld|itemsHeldNow|meansHeld|heldMark)\s*\(/;
        const RAW = /\b(?:isDeceased|isDeadForGm|livingStudents|livingStudentsForGm|deathRecordFor|keysHeldBy)\s*\(|\bactor\.system\b|\bactor\.items\b|\.system\.(?:experiences|resources)\b|getFlag\(\s*MODULE_ID\s*,\s*FLAGS\.(?:deceased|monocub|pendingCall|lastAction|sheetAtStart)/;
        const CHAT = /\b(?:m|msg|message|chatMessage)\??\.getFlag\(\s*MODULE_ID\s*,|\b(?:m|msg|message)\??\.speaker\??\.actor\b/;
        const TOP = /^(?![\s}\])]|$)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s*([\w$]+)|class\s+([\w$]+)|(const|let|var)\s+([\w$]+))?/gm;
        const STORES = [["settings.mjs", "bodyFound"], ["settings.mjs", "bodiesFound"], ["gm-stores.mjs", "deathStore"], ["gm-stores.mjs", "blackenedStore"], ["gm-stores.mjs", "offerStore"],
            ["gm-stores.mjs", "deferredOfferStore"], ["projects-secrecy.mjs", "projectMeta"], ["settings.mjs", "clock"]];
        const censusOf = (bridge, sources) => {
            const found = [];
            for (const [action, decl] of Object.entries(bridge)) {
                if (!ROADS.test(action)) continue;
                const fields = Object.keys(decl?.sanitize?.fields ?? {});
                for (const field of fields.length ? fields : ["-"]) found.push(`PACKET gm-bridge.mjs#${action}#${field}`);
            }
            const files = new Map(sources);
            const tops = [];
            for (const file of [...FILES, ...Object.keys(NAMED)]) {
                if (!files.has(file)) continue;
                const code = blankComments(files.get(file));
                const at = [...blankLiterals(code).matchAll(TOP)].map(m => ({ at: m.index, name: m[1] ?? m[2] ?? m[4] ?? null, binding: Boolean(m[3]) }));
                at.forEach((top, i) => {
                    if (!top.name) return;
                    if (NAMED[file] && !NAMED[file].includes(top.name) && !(file === "gm-bridge.mjs" && BRIDGE_TOPS.test(top.name))) return;
                    tops.push({ file, ...top, text: code.slice(top.at, at[i + 1]?.at ?? code.length) });
                });
            }
            const handlers = new Set();
            for (const top of tops) {
                if (!/game\.socket\.on\(/.test(top.text)) continue;
                for (const m of top.text.matchAll(/game\.socket\.on\(\s*[\w.]+\s*,\s*([A-Za-z_]\w*)\s*\)/g)) handlers.add(`${top.file}#${m[1]}`);
                for (const m of top.text.matchAll(/return\s+([A-Za-z_]\w*)\(\s*payload/g)) handlers.add(`${top.file}#${m[1]}`);
                // An arrow registered inline (sync.mjs `registerSync`): the declaration that registers it is the handler.
                if (/game\.socket\.on\(\s*[\w.]+\s*,\s*(?:async\s*)?\(/.test(top.text)) handlers.add(`${top.file}#${top.name}`);
            }
            for (const handler of handlers) {
                const [file, name] = handler.split("#");
                // The bridge's own sockets are E28's (R1b and the bridge's tables).
                if (file === "gm-bridge.mjs") continue;
                const top = tops.find(t => t.file === file && t.name === name);
                // A handler this reader cannot find is a key no row can hold.
                const fields = top ? [...new Set([...top.text.matchAll(/\bpayload\??\.(\w+)/g)].map(m => m[1]).filter(f => f !== "action"))] : ["?"];
                for (const field of fields.length ? fields : ["-"]) found.push(`SOCKET ${handler}#${field}`);
            }
            for (const top of tops) if (CHAT.test(top.text)) found.push(`CHAT ${top.file}#${top.name}`);
            for (const top of tops) {
                if (top.file === "gm-bridge.mjs" && BRIDGE_TOPS.test(top.name)) continue;
                // A table or a constant reads no sheet.
                if (top.binding && !/=>|function/.test(top.text)) continue;
                if (!SHEET.some(re => re.test(top.text))) continue;
                if (HELD.test(top.text) || RAW.test(top.text) || NAMED[top.file]?.includes(top.name)) found.push(`SHEET ${top.file}#${top.name}`);
            }
            for (const [file, name] of STORES) {
                if (files.has(file) && new RegExp(`\\b${name}\\b`).test(blankComments(files.get(file)))) found.push(`STORE ${file}#${name}`);
            }
            return found;
        };
        const judge = (found, table) => {
            const rows = new Set(table.map(([key]) => key)), seen = new Set(found);
            return { unclassified: found.filter(key => !rows.has(key)), stale: [...rows].filter(key => !seen.has(key)) };
        };
        const KINDS = ["PACKET", "SOCKET", "CHAT", "SHEET", "STORE"];

        const planted = censusOf({
            "project.planted": { sanitize: { fields: { countdownId: "id" } } },
            "vote.planted": { sanitize: { fields: { choice: "id" } } }
        }, [
            ["sync.mjs", "export function registerSync() {\n    game.socket.on(EVENT, async (payload) => {\n        if (payload?.action === \"x\") return payload.room;\n    });\n}\n"],
            ["chapter.mjs", "export function judged(actor) {\n    return isDeceased(actor);\n}\n"
                + "function unread(actor) {\n    // its FLAGS.deceased is read elsewhere\n    return actor.name;\n}\n"
                + "const forged = msg => msg.getFlag(MODULE_ID, \"bodyFound\");\n"],
            ["vault.mjs", "export function notNamed(actor) {\n    return keysHeldBy(actor);\n}\n"],
            ["gm-stores.mjs", "export const offerStore = defineGmStore({});\n"]
        ]);
        equal(JSON.stringify(planted), JSON.stringify(["PACKET gm-bridge.mjs#project.planted#countdownId", "SOCKET sync.mjs#registerSync#room",
            "CHAT chapter.mjs#forged", "SHEET chapter.mjs#judged", "STORE gm-stores.mjs#offerStore"]),
            "the census reader does not read the planted fixture as planted - the live census below would measure the wrong places");
        equal(JSON.stringify(judge(planted, [["PACKET gm-bridge.mjs#project.planted#countdownId", ""], ["SOCKET sync.mjs#registerSync#room", ""],
            ["SHEET chapter.mjs#judged", ""], ["SHEET chapter.mjs#gone", ""], ["STORE gm-stores.mjs#offerStore", ""]])),
            JSON.stringify({ unclassified: ["CHAT chapter.mjs#forged"], stale: ["SHEET chapter.mjs#gone"] }),
            "the census judge does not tell a planted reader without a row, or a row without its reader");

        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const found = censusOf(BRIDGE_ACTIONS, await otherSources());
        const count = kind => found.filter(key => key.startsWith(`${kind} `)).length;
        must(KINDS.every(kind => count(kind) > 0),
            `the census read ${KINDS.map(kind => `${count(kind)} ${kind}`).join(", ")} - a kind it reads none of would measure nothing`);
        const verdict = judge(found, SEASON_CENSUS);
        log(`R346: the census read ${found.length} place(s) (${KINDS.map(kind => `${count(kind)} ${kind}`).join(", ")}) `
            + `against ${SEASON_CENSUS.length} row(s); ${verdict.unclassified.length} without a row, ${verdict.stale.length} row(s) without a place`);
        equal(JSON.stringify(verdict), JSON.stringify({ unclassified: [], stale: [] }),
            "a season road without a census row, or a row whose road is gone: give the new one a verdict (what judges it, or the E11 commit that will) and strike the gone one");
    }],

    ["R347 - the bodies to discover are this chapter's and season's unannounced dead, never an execution", async () => {
        /*
         * E11 C1, 1.2.73; audit S06-03, amend 26.09, the ledger's V2 and A26. The watcher's body rule
         * was "dead for the GMs, not a Monocub, this chapter's": an execution, public at once with
         * this chapter on its record, was a body, and so was a body a discovery had already
         * announced once the hold that remembered it was gone - measured at 4aad1fd on 65-season
         * B4, a second card after End the trial for Daichi (found) and Botan (executed). The rule is
         * chapter.mjs `bodiesToDiscover`, driven here on fakes: each student hands its flags as the
         * GMs hold them (`held`) and the GMs' rows (`pending`), so nothing in this browser is read
         * or written. Twelve students, chapter 2 of season 7: a death kept by the GMs and one public
         * at once, both in Daily Life; an execution (`classTrial`, as `killCharacter` writes it
         * during the trial); a death the GMs held, executed (`publishDeath` with the verdict's
         * `phase`, E10 fix r1-G4); one a discovery of this chapter announced; last season's chapter
         * 2; last chapter's; a Monocub; a public death from before 1.2.73 (no phase) and a kept
         * one; a record with no season; the living; and a death on the document the GMs do not
         * hold (a player's own write the audit has not put back).
         */
        const { bodiesToDiscover } = await import("./chapter.mjs");
        const { FLAGS } = await import("./config.mjs");
        ok(typeof bodiesToDiscover === "function", "chapter.mjs exports no `bodiesToDiscover` - the watcher has no body rule to test");
        const here = { chapter: 2, phase: "dailyLife", epoch: 7 };
        const STUDENTS = {
            kept: { row: here },
            public: { flag: here },
            executed: { flag: { ...here, phase: "classTrial" } },
            executedHeld: { flag: { chapter: 2, day: 3, timeOfDay: "night", phase: "classTrial", epoch: 7 } },
            announced: { flag: here },
            lastSeason: { flag: { ...here, epoch: 6 } },
            lastChapter: { flag: { ...here, chapter: 1 } },
            monocub: { flag: here, monocub: true },
            oldPublic: { flag: { chapter: 2, day: 1, timeOfDay: "night" } },
            oldKept: { row: { chapter: 2, day: 1, timeOfDay: "night" } },
            noSeason: { flag: { chapter: 2, phase: "dailyLife" } },
            living: {},
            forged: { document: here }
        };
        const flagsOf = (deceased, monocub) => (scope, key) => scope !== MODULE_ID ? undefined
            : key === FLAGS.deceased ? deceased : key === FLAGS.monocub ? monocub : undefined;
        const actors = Object.entries(STUDENTS).map(([id, s]) => ({ id, getFlag: flagsOf(s.document ?? s.flag ?? null, s.monocub ?? false) }));
        const held = actor => ({ id: actor.id, getFlag: flagsOf(STUDENTS[actor.id].flag ?? null, STUDENTS[actor.id].monocub ?? false) });
        const found = bodiesToDiscover({ actors, clock: { chapter: 2, phase: "dailyLife" }, epoch: 7,
            announced: id => id === "announced", held, pending: id => STUDENTS[id]?.row ?? null });
        equal(JSON.stringify(found), JSON.stringify(["kept", "public", "oldKept", "noSeason"]),
            "the watcher's body rule finds an execution, an announced or another season's or chapter's body, a Monocub, an old public death or a death the GMs do not hold, or misses one it should find");
    }],

    ["R348 - the dead are not witnesses - only a Monocub is", async () => {
        /*
         * E11 C1, 1.2.73; audit S06-14 (S13-02 is the same defect); DC7/DX1. The witnesses of a
         * walk-in were every student's token in the room but a hidden one and a body: a dead student
         * lying there from an earlier death counted toward the two, so one living student walking in
         * beside an old body announced a new one. chapter.mjs `witnessesOf`, driven on fake tokens
         * (`roomOf` reads the token's `room`), flags as the GMs hold them (`held`) and the GMs' rows
         * (`pending`): the living, a public death, a death the GMs keep, a Monocub, a hidden token,
         * the body itself, a Monokuma (no student), the living in another room, a token of no
         * character, and a death on the document the GMs do not hold.
         */
        const { witnessesOf } = await import("./chapter.mjs");
        const { FLAGS } = await import("./config.mjs");
        ok(typeof witnessesOf === "function", "chapter.mjs exports no `witnessesOf` - the watcher's witness rule cannot be tested");
        const dead = { chapter: 2, phase: "dailyLife", epoch: 7 };
        const PEOPLE = {
            living: {}, public: { flag: dead }, kept: { row: dead }, monocub: { flag: dead, monocub: true },
            hidden: { hidden: true }, body: {}, monokuma: { notStudent: true }, elsewhere: { room: "Elsewhere" },
            npc: { type: "adversary" }, forged: { document: dead }
        };
        const flagsOf = (deceased, monocub) => (scope, key) => scope !== MODULE_ID ? undefined
            : key === FLAGS.deceased ? deceased : key === FLAGS.monocub ? monocub : undefined;
        const tokens = Object.entries(PEOPLE).map(([id, p]) => ({ id, hidden: Boolean(p.hidden), room: p.room ?? "Gym",
            actor: { id, type: p.type ?? "character", getFlag: flagsOf(p.document ?? p.flag ?? null, p.monocub ?? false) } }));
        const students = new Set(Object.keys(PEOPLE).filter(id => !PEOPLE[id].notStudent));
        const held = actor => ({ id: actor.id, getFlag: flagsOf(PEOPLE[actor.id].flag ?? null, PEOPLE[actor.id].monocub ?? false) });
        const witnesses = witnessesOf({ tokens, room: "Gym", bodies: new Set(["body"]), students, held,
            pending: id => PEOPLE[id]?.row ?? null, roomOf: t => t.room });
        equal(JSON.stringify(witnesses.map(t => t.id)), JSON.stringify(["living", "monocub", "forged"]),
            "a dead student who is not a Monocub, a hidden token, the body, a Monokuma, somebody elsewhere or no character counts as a witness, or a living student or a Monocub does not");
    }],

    ["R349 - only announceBody writes the stamp of a body found", async () => {
        /*
         * E11 C1, 1.2.73; decision D8; the ledger's G2. The stamp `SETTINGS.bodiesFound` is what
         * the watcher, and later E19's channel, E13's trial room and E70, read to know a body was
         * found - so it has one writer, settings.mjs `recordBodyFound`, and that has one caller,
         * chapter.mjs `announceBody`, which `runDiscovery` calls once per discovery. Read in every
         * module source but the suite's, comments stripped: each call of `recordBodyFound`, of
         * `announceBody`, and each `game.settings.set` naming the stamp, by the top-level function
         * it stands in. A second writer - a GM button stamping a body by hand - is a second place
         * the stamp's shape and its chapter could be decided, and fails here.
         */
        const callers = (name, pattern) => [...sources].flatMap(([file, text]) => {
            const code = stripComments(text);
            const tops = [...code.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/gm)].map(m => ({ at: m.index, name: m[1] }));
            return [...code.matchAll(pattern)].map(m => `${file}#${tops.filter(t => t.at <= m.index).at(-1)?.name ?? "(top)"}`)
                .filter(where => where !== `${file}#${name}`);
        });
        const sources = new Map(await otherSources());
        must(fnSource(sources.get("settings.mjs"), "recordBodyFound"), "settings.mjs declares no recordBodyFound");
        equal(JSON.stringify([callers("recordBodyFound", /\brecordBodyFound\s*\(/g), callers("announceBody", /\bannounceBody\s*\(/g),
            callers("recordBodyFound", /settings\.set\(\s*MODULE_ID\s*,\s*SETTINGS\.bodiesFound\b/g)]),
            JSON.stringify([["chapter.mjs#announceBody"], ["chapter.mjs#runDiscovery"], []]),
            "the stamp of a body found has a writer besides `announceBody`, or `announceBody` a caller besides `runDiscovery` "
            + "(the callers of recordBodyFound, of announceBody, and the other writes of SETTINGS.bodiesFound)");
    }],

    ["R350 - a hold is loud only in the hour, the day and the chapter its body was found in", async () => {
        /*
         * E11 C2, 1.2.73; audit S01-29; the ledger's G-b. settings.mjs `holdFreshAt`, which
         * `bodyDiscoveryFresh` asks for the music's silence and the body card's pulse. It read the
         * time of day alone, so a body found on a morning, with the GM staying in Daily Life (D5),
         * was "just found" again on every later morning. Driven on fakes, nothing read or written:
         * a hold of chapter 2, day 3, the morning, against the clock of its own hour, of the next
         * day's morning, of the next chapter's day 3 morning and of its own day's noon; a hold
         * written without a day against day 1 and day 2; and no hold.
         */
        const { holdFreshAt } = await import("./settings.mjs");
        ok(typeof holdFreshAt === "function", "settings.mjs exports no `holdFreshAt` - the hold's freshness has no rule to test");
        const hold = { room: "Gym", victimId: "victim", chapter: 2, day: 3, timeOfDay: "morning", at: 1 };
        const at = (chapter, day, timeOfDay) => ({ chapter, day, timeOfDay, phase: "dailyLife" });
        const noDay = { ...hold, day: undefined };
        const read = [[hold, at(2, 3, "morning")], [hold, at(2, 4, "morning")], [hold, at(3, 3, "morning")], [hold, at(2, 3, "noon")],
            [noDay, at(2, 1, "morning")], [noDay, at(2, 2, "morning")], [null, at(2, 3, "morning")]].map(([h, clock]) => holdFreshAt(h, clock));
        equal(JSON.stringify(read), JSON.stringify([true, false, false, false, true, false, false]),
            "a hold read as fresh outside the hour, day and chapter it was written in, or not in them (per clock: its own hour, the next day's, "
            + "the next chapter's, its own noon; without a day on day 1 and day 2; no hold)");
    }],

    ["R351 - a project token plan: a token of no live project goes, a live project's spare is listed and kept", async () => {
        /*
         * E11 C7, 1.2.73; audit S06-23, S07-27, S09-21; the ask A2, the plan's 3.2, the ledger's D1.
         * projects-map.mjs `projectTokenPlan`, by which `sweepProjectTokens` decides what the reset
         * and a deletion take off the maps. Until 1.2.73 nothing decided it: the reset left every
         * project token standing and a deletion left every one its metadata did not name. Driven on
         * fakes, nothing read or written: a live project's token its metadata names and a spare of
         * it on another scene, a token of a deleted project, a copy of the shared actor carrying no
         * id, a live project with one token, and a live project with two tokens its metadata names
         * neither of (the first found is kept); then the same tokens with no project live, as the
         * reset hands them over.
         */
        const { projectTokenPlan } = await import("./projects-map.mjs");
        ok(typeof projectTokenPlan === "function", "projects-map.mjs exports no `projectTokenPlan` - nothing decides which project tokens go");
        const t = (sceneId, tokenId, projectId) => ({ sceneId, tokenId, projectId });
        const tokens = [t("B", "spare", "live"), t("A", "named", "live"), t("A", "gone", "deleted"), t("A", "bare", null),
            t("B", "alone", "solo"), t("A", "first", "stale"), t("B", "second", "stale")];
        const refs = { live: { sceneId: "A", tokenId: "named" }, solo: { sceneId: "B", tokenId: "alone" }, stale: { sceneId: "C", tokenId: "moved" } };
        const ids = list => list.map(token => token.tokenId).sort();
        const plan = projectTokenPlan(tokens, ["live", "solo", "stale"], id => refs[id] ?? null);
        const reset = projectTokenPlan(tokens, [], id => refs[id] ?? null);
        equal(JSON.stringify([ids(plan.orphans), ids(plan.duplicates), reset.orphans.length, reset.duplicates.length]),
            JSON.stringify([["bare", "gone"], ["second", "spare"], 7, 0]),
            "the plan removes a live project's token or keeps one of no live project, or keeps the wrong one of two (read: the orphans, the spares, "
            + "and with no project live the orphans' count and the spares')");
    }],

    ["R352 - a project's own token: only the token a live project's metadata names moves the project or keeps it off the map", async () => {
        /*
         * E11 C8, 1.2.73; audit S09-47; the ask A2, the plan's 3.2, the ledger's D1. projects-map.mjs
         * `projectOwning`, which the primary's `updateToken` and `deleteToken` hooks ask before a drag
         * moves a project or a Delete keeps it off the map. Until 1.2.73 any token carrying a project's
         * id did both: an orphan's drag wrote a metadata row for a countdown that does not exist, and a
         * spare's drag moved the project away from the token its metadata names. Driven on fakes,
         * nothing read or written: the named token, a spare on the same scene, a token with the named
         * id on another scene, a token of a deleted project whose row still names it (nothing in the
         * module drops the row of a countdown deleted in Daggerheart's own window - read), a token
         * with no id, and a live project's token whose metadata names no token.
         */
        const { projectOwning } = await import("./projects-map.mjs");
        ok(typeof projectOwning === "function", "projects-map.mjs exports no `projectOwning` - nothing tells a project's own token from a copy");
        const token = (id, sceneId, projectId) => ({ id, parent: { id: sceneId }, getFlag: (scope, key) => (key === "projectId" ? projectId : undefined) });
        const refs = { live: { sceneId: "A", tokenId: "named" }, deleted: { sceneId: "A", tokenId: "gone" } };
        const readers = { isLive: id => id === "live" || id === "unplaced", refOf: id => refs[id] ?? null };
        const read = [token("named", "A", "live"), token("spare", "A", "live"), token("named", "B", "live"), token("gone", "A", "deleted"),
            token("plain", "A", undefined), token("loose", "A", "unplaced")].map(t => projectOwning(t, readers));
        equal(JSON.stringify(read), JSON.stringify(["live", null, null, null, null, null]),
            "a token other than the one a live project's metadata names was read as the project's own, or that one was not (read: the named "
            + "token, a spare, the named id on another scene, a deleted project's still named, no id, a live project naming no token)");
    }],

    ["R354 - the cast's tokens go where the GM chose, after the cast's groups, by every map's bedrooms and never by the map on the GM's screen", async () => {
        /*
         * E11 C10b, 1.2.73; the owner's Q2 (09.10.2026: the GM chooses - (a) they stay, (b) each to their
         * own bedroom, (c) a start point - and 10.10.2026: a token on another map stays and is named), the
         * ledger's Q2. Until 1.2.73 a reset left every token where last season did, and asked nothing.
         * Read here, because a reset is not the suite's to run (the plan's M10): the step's place in
         * `RESET_STEPS` - after every cast group, so a death the reset clears is cleared before it asks
         * who is dead, and before the chat - and that it is a choice's step, not a group's; that
         * `placeCast` finds a bedroom through `allBedroomsAnywhere`, never `allBedrooms()`, whose default
         * is the scene on this GM's screen (ITEM-16), nor reads that scene itself; that it reads the dead
         * off the primary's mark and runs on the primary GM only; that the window offers the three, (a)
         * checked, and hands the answer to the plan; and the words. What the moves do is tier 2's "the
         * cast goes where the GM chose" and scenario 65's P.
         */
        const { RESET_STEPS, RESET_CHOICES } = await import("./season-setup.mjs");
        const steps = RESET_STEPS ?? [];
        const at = key => steps.indexOf(key);
        ok(at("placeCast") >= 0, "the reset has no step that places the cast");
        ok((RESET_CHOICES ?? []).includes("placeCast"), "placing the cast is not one of the window's choices, so a tick would gate it");
        for (const key of ["deaths", "items", "advancement", "actions", "despair", "stashesFound"]) {
            ok(at(key) < at("placeCast"), `the cast is placed before the group "${key}" has run`);
        }
        for (const key of ["preNotes", "sheetNotes", "cards", "chatRest", "clock"]) {
            ok(at("placeCast") < at(key), `the cast is placed after "${key}"`);
        }

        const setup = stripComments(new Map(await otherSources()).get("season-setup.mjs") ?? "");
        const place = fnSource(setup, "placeCast");
        ok(/allBedroomsAnywhere\(\)/.test(place), "placeCast does not read the bedrooms of every scene");
        ok(!/\ballBedrooms\(|\bworkingScene\(|\bcanvas\??\.scene\b/.test(place),
            "placeCast reads the scene on this GM's screen - a GM looking at another map would send nobody to bed (ITEM-16)");
        ok(/if \(!isPrimaryGm\(\)\) return null;/.test(place), "placeCast moves tokens on a browser that is not the primary GM's");
        ok(/flagsHeldNow\(actor\)/.test(place), "placeCast reads who is dead off the document instead of the primary's mark");
        const reset = fnSource(setup, "resetSeason");
        ok(/castFieldset\(\)/.test(reset) && /cast: castChoiceIn\(/.test(reset) && /cast: typed\.cast/.test(reset),
            "the reset window does not ask where the cast goes, or does not hand the answer to the plan");
        const fieldset = fnSource(setup, "castFieldset");
        ok(/value === "stay" \? " checked"/.test(fieldset), "the window's default is not (a), the cast where it stands");
        for (const value of ["stay", "bedroom", "point"]) ok(fieldset.includes(`choice("${value}"`), `the window does not offer "${value}"`);
        for (const key of ["resetCastTitle", "resetCastNote", "resetCastStay", "resetCastBedroom", "resetCastPoint", "resetCastNoRooms",
            "reportCard.titleCast", "reportCard.stayed"]) {
            ok(game.i18n.has(`DRPG.Season.${key}`), `DRPG.Season.${key} is missing`);
        }
    }],

    ["R355 - a Level Up's experience is written down in the write that adds it, as a GM's flag, and the reset reads it as the GMs hold it", async () => {
        /*
         * E11 C11, 1.2.73; audit S03-21, D12 option 1, the owner's Q1 (a); the plan's 1b.2 and E10 C8's owed (3).
         * Until 1.2.73 the season reset restored the values of the experiences the season began with and kept every
         * other entry, so a Level Up's experience outlived its season. Read in the source here, because a reset is not
         * the suite's to run (the plan's M10): `applyAdvancement` adds a new experience's id to `levelUpExperiences` in
         * its one write, from the list as the GMs hold it; the flag is one of the GM's flags the audit puts back; and
         * `restoreStartingSheet` reads the starting sheet, the list, the advances and the experiences in one job of
         * the student's queue as the GMs hold them, never off the document, and deletes what `seasonExperiences`
         * says goes. What the reset takes is tier 2's "a reset takes a Level Up's experience and keeps the GM's";
         * the put-back and the held read are its "a player's write of the Level Up's experiences is put back and
         * the reset reads the list the GMs hold"; the whole reset is scenario 65's R8.
         */
        const sources = new Map(await otherSources());
        const apply = fnSource(stripComments(sources.get("level-up.mjs") ?? ""), "applyAdvancement");
        const character = stripComments(sources.get("character.mjs") ?? "");
        const restore = fnSource(character, "restoreStartingSheet");
        const audit = stripComments(sources.get("sheet-audit.mjs") ?? "");
        ok(apply.length > 1000 && restore.length > 500,
            "applyAdvancement or restoreStartingSheet is cut short - the reads below would measure nothing");
        const job = apply.search(/\bmeansWrite\(actor,/), listRead = apply.search(/flagsHeldNow\(actor\)\.getFlag\(MODULE_ID, FLAGS\.levelUpExperiences\)/);
        const listWritten = apply.search(/update\[`flags\.\$\{MODULE_ID\}\.\$\{FLAGS\.levelUpExperiences\}`\] =/), write = apply.search(/\btrustedWrite\(actor, update/);
        ok(job > 0 && job < listRead && listRead < listWritten && listWritten < write && (apply.match(/\btrustedWrite\(/g) ?? []).length === 1,
            "a Level Up does not write its new experiences down in its one write, from the list the GMs hold (S03-21)");
        ok(/const GM_FLAGS = \[[^\]]*"levelUpExperiences"/.test(audit), "the list of a Level Up's experiences is not a GM's flag - a player's write of it stands");
        ok(/\bmeansWrite\(actor,/.test(restore) && /flagsHeldNow\(actor\)/.test(restore) && /numberHeld\(actor, "system\.experiences"\)/.test(restore)
            && !/\bactor\.(?:getFlag|system|setFlag)\b/.test(restore) && (restore.match(/\btrustedWrite\(/g) ?? []).length === 1,
            "the reset's restore reads the starting sheet, the list or the experiences off the document, or writes more than once (1b.2)");
        // Read after the rest: before 1.2.73 there was no such rule, and `fnSource` throws for a function it cannot find.
        ok(fnSource(character, "seasonExperiences").length > 200 && /seasonExperiences\(held, snapshot, recorded\)/.test(restore)
            && /system\.experiences\.\$\{id\}`\] = forcedDeletion\(\)/.test(restore),
            "the reset's restore does not delete the experiences that go with the season");
        ok(/levelUpsMarked: true/.test(fnSource(character, "stampStartingSheet")),
            "the season's starting sheet does not say that its Level Ups are written down - a reset would treat it as made before 1.2.73");
        for (const key of ["reportCard.titleLeft", "reportCard.experiences"]) ok(game.i18n.has(`DRPG.Season.${key}`), `DRPG.Season.${key} is missing`);
    }],

    ["R356 - a chapter-stamped trace or motive names its season, and every reader of this chapter's records asks it", async () => {
        /*
         * E11 C12, 1.2.73; audit S06-42 (its rest: E11 C1 stamped the bodies found, E10 C10 counts the seasons); the
         * ledger's D2 and the early review of C4. A reset sends the clock back to chapter 1 and keeps what the GM left
         * unticked, and the traces and the motive named only their chapter, so the new season's chapter 1 read last
         * season's as its own. The guard on the promise, in the source: the two writers stamp the season beside the
         * chapter, a trace put back under its id keeps its own, and each of the seven readers that asks "this chapter"
         * of a trace or the motive asks `sameSeason` as well - and the trial console's "a student died this chapter",
         * of a death record, which carries its season since E11 C1 (the census row of `deathRecordFor` names C12 for
         * it). What the readers answer is tier 2's "last season's chapter is not this one" and scenario 65's S (a real
         * reset of the clock alone, in chapter 1); the planner's leftover count, a clean-up's copy and the console's
         * line are read here only.
         */
        const sources = new Map(await otherSources());
        const src = file => stripComments(sources.get(file) ?? "");
        const [chapter, remnants, investigation, rules, mastermind] = ["chapter.mjs", "remnants.mjs", "investigation.mjs", "rules.mjs", "mastermind.mjs"].map(src);
        ok(chapter.length > 1000 && remnants.length > 1000 && investigation.length > 1000 && rules.length > 1000 && mastermind.length > 1000,
            "a source file did not load - the reads below would measure nothing");
        const readers = [
            ["chapter.mjs faintPrepCandidates", fnSource(chapter, "faintPrepCandidates"), /\(data\.chapter \?\? chapter\) !== chapter \|\| !sameSeason\(data\)/],
            ["chapter.mjs clearChapterKeyRemnants", fnSource(chapter, "clearChapterKeyRemnants"), /info\.chapter === chapter && sameSeason\(info\)/],
            ["chapter.mjs openChapterEndDialog", fnSource(chapter, "openChapterEndDialog"), /info\.chapter === endingChapter && sameSeason\(info\)\) keyable\+\+/],
            ["remnants.mjs tieChapterTraces", fnSource(remnants, "tieChapterTraces"), /data\.chapter !== chapter \|\| !sameSeason\(data\)/],
            ["mastermind.mjs finalTruthPlacedThisChapter", fnSource(mastermind, "finalTruthPlacedThisChapter"), /data\.chapter === chapter && sameSeason\(data\)/],
            ["rules.mjs motive", fnSource(rules, "motive"), /stored\.chapter !== getClock\(\)\.chapter \|\| !sameSeason\(stored\)/],
            ["investigation.mjs the leftover Key Remnants", investigation, /r\.data\.chapter !== plan\.chapter \|\| !sameSeason\(r\.data\)/],
            ["trial-floor-ui.mjs readTrial", fnSource(src("trial-floor-ui.mjs"), "readTrial"), /record\?\.chapter === chapter && sameSeason\(record\)/]
        ];
        const blind = readers.filter(([, body, asks]) => !asks.test(body)).map(([name]) => name);
        equal(blind.join(", "), "", "a reader of this chapter's traces, motive or deaths takes last season's chapter of the same number for this one (S06-42)");
        const place = fnSource(remnants, "placeRemnant");
        ok(/epoch: keepId && Number\.isFinite\(data\.epoch\) \? data\.epoch : seasonEpoch\(\)/.test(place),
            "a trace's ledger row does not name its season, or takes it off the packet rather than only for a trace put back under its id");
        ok(/epoch: entry\.epoch \?\? null/.test(fnSource(remnants, "remnantData")) && /epoch: d\.epoch \?\? null/.test(fnSource(src("cleanup.mjs"), "recreationDataFor")),
            "the GM's reading of a trace, or a clean-up's copy of one, drops its season - a trace put back is this season's");
        ok(/chapter: getClock\(\)\.chapter,\s*epoch: seasonEpoch\(\)/.test(fnSource(rules, "setMotive")), "the motive does not name its season");
        // Read last: before 1.2.73 there was no such reader, and `fnSource` throws for a function it cannot find.
        const same = fnSource(src("settings.mjs"), "sameSeason");
        ok(/return record\.epoch === epoch/.test(same) && /record\.placedAt \?\? record\.at/.test(same),
            "settings.mjs `sameSeason` does not compare the season, or a record from before 1.2.73 by its own stamp");
    }],

    ["R312 - the ballots are a GM store and the vote's GM road is gmOnly", async () => {
        /*
         * E10 C1, 1.2.71; audit S06-17, S06-04; the plan's V1 and V3. Until 1.2.71 the ballots were a
         * Map in the collecting GM's memory (vote.mjs `ballots`): a reload of that browser counted
         * none, and any GM's console opened and counted against its own memory. Now a ballot is a
         * row of a GM store - synced between the GMs, kept in a client setting so it is on no
         * player's browser, cut by the trial's reset and never backed up - and every step of the
         * vote runs on the primary GM: a console asks through `vote.run` (`askVote`, `onPrimary`),
         * which only a GM may send, and `runVoteOp` does nothing on a GM that is not the primary.
         * Read here: the store's declaration and its setting, the bridge's row (its first guard,
         * its packet, the five steps passed and a sixth not) and the two places that keep the step
         * on the primary. Red at 1f26a0c: there is no `ballotStore`.
         */
        const { ballotStore } = await import("./gm-stores.mjs");
        ok(ballotStore?.spec, "gm-stores.mjs declares no `ballotStore` - the ballots are kept where this cannot read them");
        const { name, kind, resetGroup, backup, sync } = ballotStore.spec;
        equal(JSON.stringify({ name, kind, resetGroup, backup, sync }),
            JSON.stringify({ name: "ballots", kind: "ledger", resetGroup: "trialProgress", backup: false, sync: true }),
            "the ballots' store is not a synced ledger, unbacked, that the trial's reset cuts");
        ok(game.settings.settings.get(`${MODULE_ID}.${ballotStore.spec.key}`)?.scope === "client",
            "the ballots' store is not a client setting, so its rows can reach a player's browser");

        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const { VOTE_OPS } = await import("./vote.mjs");
        const run = BRIDGE_ACTIONS["vote.run"];
        ok(run, "the bridge has no `vote.run` - a GM who is not the primary has no way to the ballots");
        ok(run.guards?.[0]?.factory === "gmOnly", "a player can run a step of the vote through the bridge");
        equal(JSON.stringify(run.sanitize?.fields ?? null), JSON.stringify({ op: "oneOf", picks: "num" }),
            "vote.run's packet is not a step from a list and a number");
        must(VOTE_OPS?.length === 5, `vote.mjs lists ${VOTE_OPS?.length ?? "no"} step(s) of the vote, not five`);
        ok(VOTE_OPS.every(op => run.sanitize({ op }).op === op), "a step of the vote the primary runs is not passed by vote.run's packet");
        equal(run.sanitize({ op: "count" }).op, null, "vote.run passes a step that is not one of the five");
        equal(run.answer, "reply", "vote.run does not hand back the primary's reply");

        const vote = stripComments(new Map(await otherSources()).get("vote.mjs") ?? "");
        const ask = fnSource(vote, "askVote"), step = fnSource(vote, "runVoteOp");
        ok(ask.length > 100 && step.length > 100, "askVote or runVoteOp is gone - the reads below would measure nothing");
        ok(/bridgeRequest\("vote\.run"/.test(ask) && /\bonPrimary: true\b/.test(ask),
            "a GM's console runs a step of the vote somewhere other than the primary");
        ok(/!isPrimaryGm\(\)/.test(step) && step.indexOf("isPrimaryGm()") < step.indexOf("voteStep("),
            "runVoteOp takes a step of the vote on a GM that is not the primary, against its own copy of the ballots");
    }],

    ["R313 - the ballot reaches the GMs only through the bridge", async () => {
        /*
         * E10 C2, 1.2.71; audit S06-12, S06-17; the plan's V2. Until C2 a player's answer to a ballot
         * was a raw packet to every GM (`vote.ballot`), which the primary recorded on a candidate
         * filter alone - a ballot naming one student twice counted twice, a window of an earlier
         * round counted in this one - and the player was told the vote was in as the packet left,
         * with a GM connected or none. It is the bridge's `vote.cast` now, a player's alone, judged
         * on the primary (vote.mjs `recordBallot`), and a player who loads while a vote is open asks
         * for their own ballot (`vote.ask`). Read here: the two rows (the first two guards, the
         * packet, how each is answered); that the module's listener in vote.mjs takes one packet,
         * the GM's ballot, and the source names no other; that a player's browser asks for its
         * ballot at load and when a primary's world has loaded; and that "Your vote is in." is said
         * after the primary's answer. What the primary refuses is tier 2's to drive. Red at
         * E10 C1's tree (A1, 09.10.2026): the bridge has no `vote.cast`.
         */
        const { BRIDGE_ACTIONS } = await import("./gm-bridge.mjs");
        const G = await import("./bridge-guards.mjs");
        const cast = BRIDGE_ACTIONS["vote.cast"], asked = BRIDGE_ACTIONS["vote.ask"];
        ok(cast && asked, "the bridge has no `vote.cast` or no `vote.ask` - a ballot has no road to the primary but a raw packet");
        const shape = decl => [decl.guards?.[0] === G.knownSender, decl.guards?.[1]?.factory ?? null, decl.sanitize?.fields ?? null,
            decl.answer, Boolean(decl.patient), Boolean(decl.resend), Boolean(decl.quiet)];
        equal(JSON.stringify(shape(cast)), JSON.stringify([true, "playersOnly", { round: "num", choice: "raw" }, "reply", true, true, false]),
            "vote.cast is not a known player's alone, a round and a list, answered by the primary and asked again when a primary arrives");
        equal(JSON.stringify(shape(asked)), JSON.stringify([true, "playersOnly", {}, "reply", false, false, true]),
            "vote.ask is not a known player's alone, an empty packet answered by the primary, quietly");

        const vote = stripComments(new Map(await otherSources()).get("vote.mjs") ?? "");
        const register = fnSource(vote, "registerVote"), send = fnSource(vote, "sendBallot");
        ok(register.length > 100 && send.length > 100, "registerVote or sendBallot is gone - the reads below would measure nothing");
        equal(JSON.stringify([...register.matchAll(/payload\??\.action\s*===\s*([\w$."]+)/g)].map(m => m[1])), JSON.stringify(["ACTION_OPEN"]),
            "vote.mjs's socket listener takes a packet other than the GM's ballot - a ballot can reach a GM around the bridge");
        ok(/const ACTION_OPEN = "vote\.open";/.test(vote) && !/vote\.ballot|ACTION_BALLOT/.test(vote),
            "vote.mjs still names the raw ballot packet, or its GM's ballot is another packet");
        ok(/\baskForBallot\(\)/.test(register) && /Hooks\.on\("drpgPrimaryReady",[^)]*askForBallot\(/.test(register),
            "a player's browser does not ask for its ballot at load and when a primary GM's world has loaded");
        const answered = send.indexOf("requestBallotCast("), confirmed = send.indexOf("DRPG.Vote.castConfirmed");
        ok(answered > 0 && confirmed > answered && /requestBallotCast\((?:(?!DRPG\.Vote\.castConfirmed)[\s\S])*\bres\.ok\b/.test(send),
            "a player is told the vote is in before the primary has answered that it is");
    }],

    ["R315 - Enter in the verdict window presses Cancel, its executed select opens on nobody, and a right verdict executes the Blackened", async () => {
        /*
         * E10 C4, 1.2.71; audit S06-04; the guard of the stage's doneWhen "Werdyktu nie da się
         * wykonać na przypadkowej osobie" (a verdict cannot be carried out on somebody by chance).
         * Until C4 the window's footer put a verdict first - Enter in a DialogV2 presses the first
         * submit button in DOM order - its executed select opened on the first student, and a right
         * verdict without a register executed that select's student. Read in vote.mjs: the footer's
         * actions in order and which carry `default`; that the executed select's first option is
         * "Nobody is executed" with the value ""; that `read` returns a right verdict before it reads
         * the executed select. Tier 2 drives the window ("the verdict window opens on the accused",
         * "Enter in the verdict window executes nobody", "a right verdict without the register
         * executes the Blackened the GM names"). Red at E10 C3's tree (A1, 09.10.2026): six actions
         * (the tie's footer and the other), the right verdict first.
         */
        const vote = stripComments(new Map(await otherSources()).get("vote.mjs") ?? "");
        const win = fnSource(vote, "openVerdictDialog"), read = fnSource(vote, "read");
        ok(win.length > 500 && read.length > 100, "openVerdictDialog or read is gone - the reads below would measure nothing");
        const footer = bodyOf(win, "buttons:", { until: "rejectClose" });
        equal(JSON.stringify([...footer.matchAll(/action:\s*"(\w+)"/g)].map(m => m[1])), JSON.stringify(["cancel", "correct", "wrong"]),
            "the verdict window's footer is not Cancel, then the two verdicts - Enter presses its first button");
        equal(JSON.stringify([...footer.matchAll(/action:\s*"(\w+)"[^{}]*\bdefault:\s*true/g)].map(m => m[1])), JSON.stringify(["cancel"]),
            "a button other than Cancel is the verdict window's default");
        ok(/<option value="">\$\{game\.i18n\.localize\("DRPG\.Vote\.nobodyExecuted"\)\}<\/option>/.test(win),
            "the executed select's first option is not \"Nobody is executed\" with no value - it opens on a student");
        const rightReturns = read.search(/if \(correct\) return \{ correct, executedIds: blackenedIdList\b/), selectRead = read.search(/\bf\.executed\b/);
        ok(rightReturns > 0 && selectRead > rightReturns,
            "a right verdict is not answered with the Blackened before `read` reads the executed select");
    }],

    ["R316 - a verdict writes its lock once, executes on the GMs' held reading, and its public card reads no Blackened", async () => {
        /*
         * E10 C5, 1.2.71; audit S06-39, S06-06; ledger G2. Until C5 `applyVerdict` wrote
         * `verdictApplied: true` first and again after its last consequence - a consequence that
         * threw left the lock standing and the rest undone, with nothing to say how far it had got -
         * executed on the document's `isDeadForGm`, and gave the table no card. Read in vote.mjs: the
         * lock is written once in the file; `executeSentenced` awaits the audit (`judgedFor`), reads
         * the student held (`flagsHeldNow`) and only then calls `killCharacter`, and reads no
         * document's death; `postVerdictCard`, the one public card, reads no Blackened. Tier 2 drives
         * the card and a verdict that stops halfway ("a wrong verdict's card names the executed and
         * never the Blackened", "a verdict that stops halfway is finished by Finish the verdict"), and
         * 63 G the audit's window. Red at C4's tree (A1, 09.10.2026): the lock written twice.
         */
        const vote = stripComments(new Map(await otherSources()).get("vote.mjs") ?? "");
        ok(vote.length > 10000, "vote.mjs was not read - the reads below would measure nothing");
        equal(vote.match(/verdictApplied:\s*true/g)?.length ?? 0, 1,
            "the verdict's lock is written more than once in vote.mjs, or not at all (S06-39)");
        const execute = fnSource(vote, "executeSentenced"), card = fnSource(vote, "postVerdictCard");
        ok(execute.length > 200 && card.length > 200, "executeSentenced or postVerdictCard is cut short - the reads below would measure nothing");
        const judged = execute.indexOf("judgedFor("), held = execute.indexOf("flagsHeldNow("), kill = execute.indexOf("killCharacter(");
        ok(judged > 0 && held > judged && kill > held,
            "an execution does not await the audit and read the student as the GMs hold them before `killCharacter`");
        ok(!/\b(?:isDeceased|isDeadForGm)\(\s*actor\s*\)/.test(execute), "an execution reads the document's death, which a player's forged flag can be");
        ok(!/blackened/i.test(card), "the verdict's public card reads a Blackened - a wrong verdict would name the student the class failed to");
    }],

    ["R317 - a verdict's Level Ups are one window with the players' choice, and its line is said after it", async () => {
        /*
         * E10 C7, 1.2.71; audit S06-25, S03-32, S06-32; ledger D3 (the stage's doneWhen: "the Level
         * Ups open in one window with 'the player picks'"). `runAdvancementBatch` opened one picker per
         * survivor in turn, a picker the GM closed gave nothing and said nothing, and `verdictLevelUps`
         * wrote "N survivors take a standard Level Up" before any window opened. Read in level-up.mjs
         * and vote.mjs: the batch asks the class's one window (`askWhoPicks`, its classes
         * `drpg-advance-queue`, a "The player picks" choice and "All: the players pick") before it opens
         * any picker, hands a row to its player through `offerAdvancement`, says what is not yet given;
         * the verdict's line is built from what the batch answers, after it, with no raw kind. Tier 2
         * drives it ("a correct verdict opens one Level Up window; the players pick records one offer
         * each, the Blackened's 1+3 as one", "a Level Up picker the GM closes becomes an offer, and the
         * verdict says what was given after the fact"), and 63 I on gm2.
         */
        const sources = new Map(await otherSources());
        const level = stripComments(sources.get("level-up.mjs") ?? ""), vote = stripComments(sources.get("vote.mjs") ?? "");
        const batch = fnSource(level, "runAdvancementBatch"), ask = fnSource(level, "askWhoPicks"), line = fnSource(vote, "verdictLevelUps");
        ok(batch.length > 400 && ask.length > 400 && line.length > 200,
            "runAdvancementBatch, askWhoPicks or verdictLevelUps is cut short - the reads below would measure nothing");
        ok(/"drpg-advance-queue"/.test(ask) && /DRPG\.Advance\.pickPlayer/.test(ask) && /DRPG\.Advance\.allPlayers/.test(ask),
            "the class's Level Up window is not one window that offers the player's choice row by row and for everybody");
        const asked = batch.indexOf("askWhoPicks("), picker = batch.indexOf("openAdvancement(");
        ok(asked > 0 && picker > asked, "the batch opens a picker before it asks the class's one window who picks");
        ok(/offerAdvancement\(/.test(batch) && /DRPG\.Advance\.notYetGiven/.test(batch),
            "a row the GM does not pick is not handed to its player, or what is left is not said");
        const prompted = line.indexOf("promptAdvancements("), granted = line.indexOf("DRPG.Vote.levelUpGranted");
        ok(prompted > 0 && granted > prompted && /DRPG\.Vote\.levelUpWaiting/.test(line),
            "the verdict's Level Up line is said before the batch ran, or does not say what waits for the players (S06-25)");
        ok(!/kind:\s*TRIAL\./.test(line), "the verdict's Level Up line carries the config's raw kind (S06-32)");
    }],

    ["R318 - a Level Up reads the sheet the GMs hold, writes it once, and refuses a pick the sheet cannot take", async () => {
        /*
         * E10 C8, 1.2.71; audit S03-23, S03-22; ledger G3 (the plan's "a Level Up reads the held sheet", a kept guard
         * of E29 r2-H24/H25) and the plan's 1b.2 rows of `applyAdvancement`, `handleAdvancement` and
         * `stampStartingSheet`. Read in the source: level-up.mjs `applyAdvancement` writes in one job of the student's
         * queue (`meansWrite`) from the sheet's values as the GMs hold them (`numberHeld`), reads no prepared maximum
         * (`resourceMax(`, `actor.system.resources`/`traits`), and refuses a statistic that is not one and an experience
         * the GMs do not hold rather than skipping the pick; gm-bridge.mjs `handleAdvancement` refuses the same two
         * before its latch and the apply, the experiences read held; `openAdvancement` refuses an experience to raise
         * with none named before anything is sent or applied, and `buildContent` draws the option disabled where there
         * is none; character.mjs `stampStartingSheet` reads the spread held, not off `actor.system`. Tier 2 drives them
         * ("a Level Up pick the sheet cannot take is refused and told, and the offer stands", "a Level Up raises no
         * experience a player's console made that the GMs' audit has not put back", "an experience to raise with none
         * named is refused before the Level Up is written, and the picker cannot choose it", "a season's starting sheet
         * is stamped as the GMs hold it, not from an effect's bonus or a console's write"), and 63 I5 from p1's browser.
         */
        const sources = new Map(await otherSources());
        const level = stripComments(sources.get("level-up.mjs") ?? ""), bridge = stripComments(sources.get("gm-bridge.mjs") ?? "");
        const character = stripComments(sources.get("character.mjs") ?? "");
        const apply = fnSource(level, "applyAdvancement"), picker = fnSource(level, "openAdvancement"), content = fnSource(level, "buildContent");
        const handler = fnSource(bridge, "handleAdvancement"), stamp = fnSource(character, "stampStartingSheet");
        ok(apply.length > 1000 && picker.length > 1000 && content.length > 300 && handler.length > 1000 && stamp.length > 200,
            "applyAdvancement, openAdvancement, buildContent, handleAdvancement or stampStartingSheet is cut short - the reads below would measure nothing");
        ok(/\bmeansWrite\(actor,/.test(apply) && /\bnumberHeld\(actor, path\)/.test(apply) && (apply.match(/\btrustedWrite\(/g) ?? []).length === 1,
            "a Level Up no longer writes once, in the student's queue, from the numbers the GMs hold (E29 r2-H24/H25)");
        ok(!/\bresourceMax\(|\bactor\.system\??\.(?:resources|traits)\b/.test(apply),
            "a Level Up reads a maximum or a statistic as Daggerheart prepares it, an effect's bonus included (S03-23)");
        ok(/statistics\.has\(pick\.trait\)/.test(apply) && /Object\.hasOwn\(held, id\) && typeof held\[id\]\?\.value === "number"/.test(apply) && !/if \(!(?:key|id)\) break;/.test(apply),
            "a Level Up skips a pick the sheet cannot take and writes the rest (S03-22)");
        const refusedTrait = handler.search(/statistics\.has\(p\.trait\)/), refusedExperience = handler.search(/Object\.hasOwn\(experiences, id\) && typeof experiences\[id\]\?\.value === "number"/);
        const latch = handler.search(/advancing\.add\(actor\.id\)/);
        ok(refusedTrait > 0 && refusedExperience > 0 && /numberHeld\(actor, "system\.experiences"\)/.test(handler) && latch > refusedTrait && latch > refusedExperience,
            "the GM applies a player's pick of a statistic that is not one, or of an experience the GMs do not hold, and spends the offer (S03-22)");
        const refusedEmpty = picker.search(/p\?\.option === "experienceUp" && !p\.experience/);
        ok(refusedEmpty > 0 && refusedEmpty < picker.search(/requestAdvancement\(/) && refusedEmpty < picker.search(/return applyAdvancement\(/)
            && /DRPG\.Advance\.noExperienceToRaise/.test(picker),
            "an experience to raise with none named is sent or applied, untold (S03-22)");
        ok(/key === "experienceUp" && !experiences\.length \? " disabled"/.test(content), "the picker offers an experience to raise where there is none (S03-22)");
        ok(/\bmeansWrite\(actor,/.test(stamp) && /\bnumberHeld\(actor, `system\.traits\.\$\{trait\.dh\}\.value`\)/.test(stamp)
            && /numberHeld\(actor, "system\.experiences"\)/.test(stamp) && !/\bactor\.system\b/.test(stamp),
            "the season's starting sheet is stamped off the prepared sheet, not as the GMs hold it (S03-23; 1b.2)");
    }],

    ["R319 - the trial's clock and the time of day's stamps count the server's time, and a transition is written once", async () => {
        /*
         * E10 C13, 1.2.71; audit S06-37, S06-38. Read in the source: every stamp the floor writes (`startFloor`,
         * `openObjection`, `openRebuttal`, `returnToDebate`, `extendFloor`) and the count from it (`secondsLeft`, which
         * the console, the Event card and the transition read) are the server's clock (utils.mjs `serverNow`), and so are
         * the time of day's (`setClock`'s stamp, Start and End the trial, the season's reset, the pause's stamp and its
         * settling, the HUD's elapsed line); `advanceIfDue` writes one transition at a time, its flag cleared in a
         * `finally`; the floor's registration asks for the transition when the tab's visibility changes. Scenario 63 J1
         * drives the clock on a player a minute off; tier 2 "two ticks during one write open one rebuttal" and "the
         * primary GM's tab coming back moves an expired objection on at once" drive the other two.
         */
        const sources = new Map(await otherSources());
        const floor = stripComments(sources.get("trial-floor.mjs") ?? ""), clock = stripComments(sources.get("clock.mjs") ?? "");
        const hud = stripComments(sources.get("hud.mjs") ?? ""), ui = stripComments(sources.get("trial-floor-ui.mjs") ?? "");
        const season = stripComments(sources.get("season-setup.mjs") ?? ""), utils = stripComments(sources.get("utils.mjs") ?? "");
        const now = topLevelFunction(utils, "serverNow") ?? "";
        ok(/game\.time\?\.serverTime/.test(now), "utils.mjs has no serverNow, or it no longer reads the server's clock Foundry gives");
        const floorFns = ["startFloor", "openObjection", "openRebuttal", "returnToDebate", "extendFloor", "secondsLeft"];
        const timeFns = [[clock, "setClock"], [hud, "settleElapsedPause"], [hud, "paintElapsed"], [ui, "startClassTrial"], [ui, "closeTrial"], [season, "wipeSeason"]];
        const cut = [...floorFns.map(name => [name, fnSource(floor, name)]), ...timeFns.map(([src, name]) => [name, fnSource(src, name)])];
        ok(cut.every(([, body]) => body.length > 150), `a function this reads is cut short: ${cut.filter(([, b]) => b.length <= 150).map(([n]) => n).join(", ")}`);
        const local = cut.filter(([, body]) => /\bDate\.now\(/.test(body)).map(([name]) => name);
        const server = cut.filter(([, body]) => /\bserverNow\(\)/.test(body)).map(([name]) => name);
        equal(JSON.stringify(local), JSON.stringify([]), "a stamp or a count of the trial's clock or the time of day is this machine's clock again (S06-37)");
        equal(JSON.stringify(server), JSON.stringify(cut.map(([name]) => name)), "a stamp or a count of the trial's clock or the time of day reads no server time (S06-37)");
        const advance = fnSource(floor, "advanceIfDue");
        const guard = advance.search(/if \(advancing\) return;/), raised = advance.search(/advancing = true;/);
        ok(guard >= 0 && guard < advance.search(/trialFloor\(\)/) && raised > guard && raised < advance.search(/openRebuttal\(\)/)
            && /finally \{\s*advancing = false;/.test(advance),
            "the heartbeat writes a transition while the last one is on its way, or a write that threw stops it for good (S06-38)");
        ok(/addEventListener\("visibilitychange",[^]*?advanceIfDue\(\)/.test(fnSource(floor, "registerTrialFloor")),
            "the primary GM's tab coming back waits for its throttled heartbeat to move an expired mode on (S06-38)");
    }],

    ["R320 - the trial's words: the console names the mode, its state lines are body text, its cards are headed as events, and the Event card names the floor", async () => {
        /*
         * E10 C15, 1.2.71; audit S06-10, S06-24, S06-29, S06-31, S06-32 (its rest: one word for the reminder).
         * Read in the source, the stylesheet and the two language files: the console's debate line is
         * `holdingDebate`/`holdingDebateOver` for a debate and `inDiscussion` only without one, and the one `notes`
         * paragraph the console builds is the mode's explanation; the four chat cards of the trial (the trial begins,
         * the debate opens, the debate closes, the trial is over) are `trialEventCard`s - the vote's banner, a title
         * key of their own, no h3 - and the Start window's list of steps carries the class the stylesheet sets in
         * Bone at the body's size; the stylesheet gives the console's h4 the body's size; `trialCard` names no
         * "Everyone" and carries the three new metas; the words are what the audit asked for, in both languages, and
         * the restart warning names the button that is there ("Send another ballot"). Tier 2 drives the console, the
         * card and the four chat cards: "the console says Nonstop Debate while a debate runs", "the Event panel's trial
         * card names who has the floor and tells a player what to do", "the trial's four chat cards are headed as events,
         * in the vote's banner". The rendered size and colour are not measured: the harness draws no CSS.
         */
        const sources = new Map(await otherSources());
        const ui = stripComments(sources.get("trial-floor-ui.mjs") ?? ""), events = stripComments(sources.get("events.mjs") ?? "");
        const view = fnSource(ui, "trialConsoleHtml");
        ok(view.length > 500, "trialConsoleHtml is cut short or gone");
        ok(view.includes("DRPG.Floor.holdingDebate\"") && view.includes("DRPG.Floor.holdingDebateOver\"") && !view.includes("holdingDiscussion"),
            "a running debate is not named as a debate in the console (S06-10)");
        const noted = [...view.matchAll(/class="notes"[^]{0,140}/g)].map(m => m[0]);
        ok(noted.length === 1 && noted[0].includes("DRPG.Floor.modeNote"),
            `the console sets a state line as a footnote again (S06-29): ${noted.join(" | ")}`);
        ok(/!floor\s*\?\s*`<p>\$\{game\.i18n\.localize\("DRPG\.Floor\.inDiscussion"\)/.test(view),
            "the discussion's line is not the plain line of a trial with no debate (S06-10)");
        const cards = [["startClassTrial", "trialBegins"], ["openDebate", "debateOpenedTitle"], ["closeDebate", "debateClosedTitle"], ["closeTrial", "trialOver"]];
        for (const [name, key] of cards) {
            const body = fnSource(ui, name);
            ok(body.length > 150, `${name} is cut short or gone`);
            ok(body.includes(`trialEventCard("DRPG.Floor.${key}"`) && !/<h3>|drpg-card/.test(body),
                `${name} does not announce with the ${key} title in the vote's banner (S06-31)`);
        }
        ok(/class="drpg-evidence-card"[^]*class="drpg-objection-banner"/.test(fnSource(ui, "trialEventCard")),
            "the trial's cards are not the vote's markup (drpg-evidence-card and its banner)");
        ok(fnSource(ui, "startClassTrial").includes("drpg-briefing-facts drpg-trial-facts"), "the Start window's steps lost their own class (S06-29)");
        const trialCard = fnSource(events, "trialCard");
        ok(trialCard.length > 400 && !/trialEveryone|trialFloorOpen/.test(trialCard)
            && ["trialDebateMeta", "trialDiscussionMeta", "trialObjectionFloor"].every(k => trialCard.includes(`DRPG.Events.${k}"`)),
            "the Event card says Everyone again, or lacks an instruction or the Objection's floor (S06-24)");

        const css = await moduleStyles();
        ok(/\.drpg-trial-console h4 \{[^}]*font-size:\s*var\(--drpg-text-md\)/.test(css), "the console's headings are not at the body's size (S06-29)");
        ok(/\.drpg-briefing-facts\.drpg-trial-facts \{[^}]*font-size:\s*var\(--drpg-text-md\);[^}]*color:\s*var\(--drpg-bone\)/.test(css)
            && /\.drpg-briefing-facts\.drpg-trial-facts \+ \.notes \{[^}]*font-size:\s*var\(--drpg-text-sm\);[^}]*color:\s*var\(--drpg-dim\)/.test(css),
            "the Start window's steps are not in Bone at the body's size with the note after them in text-sm Dim (S06-29)");
        ok(/\.drpg-trial-console p:not\(\.notes\):not\(\.drpg-warning\) \{[^}]*color:\s*var\(--drpg-bone\)/.test(css), "the console's state lines are not set in Bone (S06-29)");

        const lang = {};
        for (const code of ["en", "pl"]) lang[code] = await fetch(`/modules/${MODULE_ID}/lang/${code}.json`).then(r => r.json()).then(j => j.DRPG);
        const floor = lang.en.Floor, ev = lang.en.Events;
        equal(JSON.stringify([floor.trialBegins, floor.debateOpenedTitle, floor.debateClosedTitle, floor.trialOver]),
            JSON.stringify(["The Class Trial begins", "Nonstop Debate!", "The debate is closed", "The trial is over"]), "the cards' titles are not the audit's (S06-31)");
        ok(/^Nonstop Debate - /.test(floor.holdingDebate) && /^Nonstop Debate - /.test(floor.holdingDebateOver)
            && !/discussion/i.test(floor.holdingDebate + floor.holdingDebateOver), "the console's debate lines are not the debate's (S06-10)");
        equal(JSON.stringify([ev.trialDebateMeta, ev.trialDiscussionMeta, ev.trialObjectionFloor]),
            JSON.stringify(["Present a Truth Bullet from your Inventory", "Talk it through - the GM opens the debate", "{who} has the floor"]),
            "the Event card's metas are not the audit's (S06-24)");
        for (const code of ["en", "pl"]) {
            const l = lang[code];
            equal(JSON.stringify(["holdingDiscussion", "holdingDiscussionOver", "nobody"].filter(k => k in l.Floor).concat("trialFloorOpen" in l.Events ? ["trialFloorOpen"] : [])),
                JSON.stringify([]), `${code}: a retired trial key is still in the file`);
            ok(["nobodyForTrial", "trialBegins", "debateOpenedTitle", "debateClosedTitle", "trialOver", "holdingDebate", "holdingDebateOver"].every(k => typeof l.Floor[k] === "string"),
                `${code}: a trial key of C15's is missing`);
            const button = l.Vote.remind.split(" (")[0], warning = Object.values(l.Vote.resendWarning);
            ok(warning.length >= 2 && warning.every(text => text.includes(button)), `${code}: the restart warning does not name the button ("${button}") (S06-32)`);
            /* Every Vote string that tells the GM to use a button names one the vote's window draws (E10 fix r2-G4; the
               round-2 goal verifier's S06-32: G3's `resendUnseen` said "use Remind" / "użyj Przypomnij" after C15 had
               renamed the button). The verb is each file's own ("use", "użyj"); at least the restart's three are read. */
            const flat = (o, at = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${at}${k}.`) : [[`${at}${k}`, v]]));
            const buttons = [l.Vote.send, l.Vote.tally, l.Vote.sendAgain, button];
            const named = flat(l.Vote).flatMap(([key, text]) => [...text.matchAll(code === "en" ? /\buse (.+?)(?: instead)?\./g : /\bużyj (.+?)\./g)]
                .map(m => [key, m[1]]));
            const strays = named.filter(([, name]) => !buttons.includes(name));
            ok(named.length >= 3 && named.some(([key]) => key === "resendUnseen") && !strays.length,
                `${code}: a Vote string names a button the window does not draw (S06-32): ${JSON.stringify(strays)} of ${named.length}`);
        }
        ok(!Object.values(lang.en.Vote.resendWarning).some(text => text.includes("Remind")), "the English restart warning still says Remind");
    }],
    ["R340 - every road to the verdict window in a Final Trial opens the Final Trial's", async () => {
        /*
         * E10 fix r2-G5, 1.2.71; round 2's cor m2. C10 routed the console's verdict button to the Final Trial's
         * window (R321 reads that line), and `openVerdictDialog` - also `game.drpg.verdictDialog` - still opened the
         * ordinary verdict in a Final Trial. Read in vote.mjs: the function answers with `openFinalVerdictDialog`
         * when `inFinalTrial()`, and does so before it reads the trial's record or draws a window. Tier 2 drives
         * the API: "the verdict's API in a Final Trial opens the Final Trial's window".
         */
        const sources = new Map(await otherSources());
        const vote = stripComments(sources.get("vote.mjs") ?? "");
        ok(vote.length > 0, "vote.mjs was not read - this test measured nothing");
        const body = fnSource(vote, "openVerdictDialog");
        const route = body.search(/if \(inFinalTrial\(\)\) return openFinalVerdictDialog\(\);/);
        const record = body.search(/trialProgress\(\)/), drawn = body.search(/DialogV2\.wait\(/);
        equal(JSON.stringify([route >= 0, record > route, drawn > route]), JSON.stringify([true, true, true]),
            "openVerdictDialog does not send a Final Trial to the Final Trial's window before it reads the record and draws its own "
            + "(read: the route there, the record read after it, the window drawn after it)");
        /* E10 fix r2-G6: `applyVerdict`, also `game.drpg.applyVerdict`, takes the same road before its lock is read or
           written. Tier 2 drives it: "the verdict's own API in a Final Trial opens the Final Trial's window". */
        const apply = fnSource(vote, "applyVerdict");
        const applyRoute = apply.search(/if \(inFinalTrial\(\)\) return openFinalVerdictDialog\(\);/);
        const lock = apply.search(/verdictRunning \|\| trialProgress\(\)\.verdictApplied/), written = apply.search(/setTrialProgress\(/);
        equal(JSON.stringify([applyRoute >= 0, lock > applyRoute, written > applyRoute]), JSON.stringify([true, true, true]),
            "applyVerdict does not send a Final Trial to the Final Trial's window before it reads or writes the verdict's lock "
            + "(read: the route there, the lock read after it, the record written after it)");
    }],

    ["R221 - the starting sheet is written only on a GM's browser", async () => {
        /*
         * E29 C2, 05.10.2026; audit S03-45 (its code part). `initCharacter` writes a student's
         * maxima, Health, Sanity and Hope and stamps the season's baseline; `restoreStartingSheet`
         * writes the traits, the experiences and the advance counter. Both are reachable from a
         * console (`game.drpg.initCharacter`, or an import), and until C2 neither asked who was
         * calling - the sheet's wand and the season reset in front of them are a GM's, the
         * functions were not. Now every function of character.mjs that writes is either exported
         * and refuses a player's browser before its first write (the gate `applyAdvancement` has,
         * R79), or private and called only from such a one - `stampStartingSheet`, from
         * `initCharacter` after its gate. Red at 025bf9e: both exported writers ungated.
         */
        const GATE = /if \(!game\.user\.isGM\) \{\s*ui\.notifications\.warn\(game\.i18n\.localize\("DRPG\.Panel\.gmOnly"\)\);\s*return null;\s*\}/;
        const WRITE = /(?<!function )\b(?:trustedWrite|trustedCreate|trustedDelete|grantItem|stampStartingSheet)\(|\.(?:update|setFlag|unsetFlag|createEmbeddedDocuments|updateEmbeddedDocuments|deleteEmbeddedDocuments|delete)\(/;
        const read = src => {
            const fns = [...src.matchAll(/^(export )?(?:async )?function (\w+)\(/gm)]
                .map(m => ({ name: m[2], exported: Boolean(m[1]), body: fnSource(src, m[2]) }));
            // The gate stands in `fn` before the first match of `what`.
            const gatedBefore = (fn, what) => { const gate = fn.body.search(GATE); return gate >= 0 && gate < fn.body.search(what); };
            const writers = fns.filter(fn => fn.body.search(WRITE) >= 0);
            const problems = [];
            for (const fn of writers) {
                if (fn.exported) {
                    if (!gatedBefore(fn, WRITE)) problems.push(fn.name);
                    continue;
                }
                const call = new RegExp(`(?<!function )\\b${fn.name}\\(`);
                const callers = fns.filter(other => other !== fn && call.test(other.body));
                if (!callers.length || callers.some(c => !c.exported || !gatedBefore(c, call))) problems.push(fn.name);
            }
            return { writers: writers.map(fn => fn.name), problems };
        };

        // The reader over a planted file: a gate after the write, no gate, a private writer reached
        // from an ungated export, and one of each shape that is right.
        const PLANTED = [
            "export async function late(a) { await a.update({ x: 1 }); if (!game.user.isGM) { ui.notifications.warn(game.i18n.localize(\"DRPG.Panel.gmOnly\")); return null; } }",
            "export async function bare(a) { await a.setFlag(\"m\", \"k\", 0); }",
            "async function hidden(a) { await trustedWrite(a, {}, { reason: \"setup\" }); }",
            "export function leak(a) { return hidden(a); }",
            "export async function right(a) { if (!game.user.isGM) {\n ui.notifications.warn(game.i18n.localize(\"DRPG.Panel.gmOnly\"));\n return null;\n }\n await helper(a); await a.update({}); }",
            "async function helper(a) { await a.unsetFlag(\"m\", \"k\"); }",
            "export function reads(a) { return a.system.traits; }"
        ].join("\n");
        equal(JSON.stringify(read(PLANTED)), JSON.stringify({ writers: ["late", "bare", "hidden", "right", "helper"], problems: ["late", "bare", "hidden"] }),
            "the reader does not see the planted writers as they are - a gate after the write, none, a private writer behind an ungated export");

        const sources = new Map(await otherSources());
        const found = read(stripComments(sources.get("character.mjs") ?? ""));
        ok(["initCharacter", "restoreStartingSheet", "stampStartingSheet"].every(name => found.writers.includes(name)),
            `the reader found ${JSON.stringify(found.writers)} writing in character.mjs - it would measure nothing`);
        equal(JSON.stringify(found.problems), "[]",
            "a function of character.mjs writes a student's starting sheet on a player's browser - no GM gate before its first write, or a private writer reached from one without");
    }],

    ["R291 - every row of the GMs' roll list has a fixture in tier 2 and every fixture a row", async () => {
        /*
         * E33 C3, 07.10.2026; the stage plan's 2.3. Tier 2 drives every row of config.mjs
         * `LEGAL_ROLL_MODIFIERS`, and every branch of its `situation` row as roll-draw.mjs
         * `situationReading` reads them, from a fixture of `MODIFIER_FIXTURES` (tests-tier2.mjs), written
         * from the handbooks and not imported from the list - so a row added to the list with no
         * fixture would be a source nobody drew. Read from source, comments stripped: the list's keys
         * (each row's `{ key: "..."` at a line's start), the fixtures' keys and their `situation`
         * names (the same shape), and the action keys `situationReading` branches on (`key === "..."`).
         * Each side must hold the other's. Tier 2's test asks the keys again of the live list before
         * it draws anything; this one fails without a world.
         */
        const sources = new Map(await moduleSources());
        const config = stripComments(sources.get("config.mjs") ?? ""), tier2 = stripComments(sources.get("tests-tier2.mjs") ?? "");
        const block = (text, head) => bodyOf(text, head, { until: "\n]" });
        const keysIn = (text, re) => [...text.matchAll(re)].map(m => m[1]);
        const rows = keysIn(block(config, "export const LEGAL_ROLL_MODIFIERS = "), /^\s*\{ key: "(\w+)"/gm);
        const fixtures = block(tier2, "const MODIFIER_FIXTURES = ");
        const fixed = [...new Set(keysIn(fixtures, /^\s*\{ key: "(\w+)"/gm))];
        const situations = keysIn(fixtures, /^\s*\{ key: "situation", situation: "(\w+)"/gm);
        // To the function's closing brace: `fnSource` runs on to the next declaration, through the readers' table.
        const branches = keysIn(bodyOf(stripComments(sources.get("roll-draw.mjs") ?? ""), "function situationReading(", { until: "\n}\n" }), /\bkey === "(\w+)"/g);
        ok(rows.length >= 14 && fixed.length > 0 && branches.length >= 6,
            `R291 read ${rows.length} row(s) of the list, ${fixed.length} fixture key(s) and ${branches.length} branch(es) of its situation - this would measure nothing`);
        equal(JSON.stringify([rows.filter(key => !fixed.includes(key)), fixed.filter(key => !rows.includes(key)),
            branches.filter(key => !situations.includes(key)), situations.filter(key => !branches.includes(key))]), JSON.stringify([[], [], [], []]),
        "a row of the GMs' roll list has no fixture, a fixture names no row, a branch of the situation row has no fixture, or a situation fixture names no branch (rows; fixtures; branches; situation fixtures)");
    }],

    ["R300 - each silence has one name: isCrimeSilenced in monocub.mjs, isCallSilenced in call-effects.mjs, isSilenced only as api.mjs's alias (D39)", async () => {
        /*
         * E33 C9 (D39; audit S09-48, S03-46). Two rules carried the name `isSilenced`
         * until 1.2.69: the crime-witness marker on a Monocub (monocub.mjs; information
         * only) and the Despair Call "Silence" on a living student (call-effects.mjs, call-world.mjs since E34;
         * no Hope Calls until the time of day ends), and sheet.mjs renamed them at its
         * door - which is how a reader took one for the other. Each has its own name
         * now, and `game.drpg.isSilenced` is kept as the crime's alias, the question it
         * has always answered.
         *
         * WHY NAMES, NOT BEHAVIOUR ALONE: gm-panel.mjs (the Players window and
         * `applyAliveStates`) and calls.mjs (`hopeCallRefusal`) take their reader by
         * destructuring a dynamic import, so a name that is no longer exported is
         * `undefined`, not a load error, and throws only when called - a Players window
         * with no Monocub in it, or a pass that changes no marker, runs with it. The
         * four tier-2 tests through `applyAliveStates` pass no `silenced` key, so none
         * of them would see it (read 07.10.2026). This reads the names: each new one
         * declared once, in its own file; the old identifier nowhere but the alias;
         * neither new name imported under another; sheet.mjs taking each from its own
         * module.
         */
        const files = (await otherSources()).filter(([file]) => file.endsWith(".mjs"))
            .map(([file, raw]) => [file, stripComments(raw)]);
        ok(files.length > 50, `only ${files.length} module file(s) were read - the crawl is not reaching the module`);
        const declaring = name => files.filter(([, text]) => new RegExp(`^export function ${name}\\(`, "m").test(text))
            .map(([file, text]) => `${file} x${text.match(new RegExp(`^export function ${name}\\(`, "mg")).length}`);
        const where = (text, m) => `:${lineAt(text, m.index)}`;
        const bare = [], aliased = [];
        for (const [file, text] of files) {
            for (const m of text.matchAll(/\bisSilenced\b/g)) {
                if (file === "api.mjs" && /^\s*isSilenced:\s*isCrimeSilenced,?\s*$/.test(lineAround(text, m.index))) continue;
                bare.push(`${file}${where(text, m)}`);
            }
            for (const m of text.matchAll(/\bis(?:Crime|Call)Silenced\s+as\s+\w+|\b\w+\s+as\s+is(?:Crime|Call)Silenced\b/g)) {
                aliased.push(`${file}${where(text, m)} ${m[0]}`);
            }
        }
        const sheet = files.find(([file]) => file === "sheet.mjs")?.[1] ?? "";
        const takes = (name, from) => new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*"\\./${from}\\.mjs"`).test(sheet);
        equal(JSON.stringify([declaring("isCrimeSilenced"), declaring("isCallSilenced"), bare, aliased,
            [takes("isCrimeSilenced", "monocub"), takes("isCallSilenced", "call-effects"), takes("isCrimeSilenced", "call-effects"), takes("isCallSilenced", "monocub")]]),
            JSON.stringify([["monocub.mjs x1"], ["call-world.mjs x1"], [], [], [true, true, false, false]]),
            "a silence's reader is declared elsewhere or more than once, the old name `isSilenced` is used outside api.mjs's alias, a new name is imported under another, "
            + "or sheet.mjs does not take each reader from its own module (isCrimeSilenced declared; isCallSilenced declared; isSilenced at; renamed at; sheet.mjs takes crime/monocub, call/call-effects, crime/call-effects, call/monocub)");
    }],

    ["R305 - a trace's tie keeps its three states through every writer and reader of the ledger", async () => {
        /*
         * E09 C4, 08.10.2026; audit S05-37, S05-25, the owner's D14. The tie is `true` (tied to the
         * crime), `false` (a GM's "not tied", a red herring) or `null` (nobody has said). Five places
         * in remnants.mjs - the place, the read, the two flag writers, the retune - and the cleanup's
         * receipt and recreation each ran it through `Boolean()`, so "nobody has said" was stored and
         * read as "not tied", and a victim's death could not tell a red herring from the laundry; it
         * tied both. The behaviour is tier 2's ("a victim's death ties the chapter's undecided traces
         * and never one a GM marked not tied"); this holds the shape that cost it: no `Boolean()` on
         * the tie in any of the seven, each source found. All seven flattened it at 8003b86 (A1, 08.10.2026).
         * E09 fix r1-G1 adds the two copy makers, observe.mjs `createFind` and gm-items.mjs
         * `bulletFromRemnant` (the round-1 goal review's G2a): both gave a new copy the ledger's tie
         * through `Boolean()` at f88133d, a death's kept tie included; they read `tieForCopy` now.
         * E09 fix r1-G2 adds the legacy migration, remnants.mjs `moveIntoLedger` (the round-1 reviews'
         * cor F4 = sec F9): its new row ran a token's tie through `Boolean(f("tiedToCrime"))`, a shape
         * the reader did not know, and its live row's fill took the token's raw `false`; both read
         * `oldTokenTie` now, and the reader knows the call shape.
         */
        const sources = new Map(await otherSources());
        const READS = [
            ["remnants.mjs", "placeRemnant"], ["remnants.mjs", "remnantData"], ["remnants.mjs", "setRemnantFlags"],
            ["remnants.mjs", "setRemnantFlagsMany"], ["remnants.mjs", "retuneRemnant"],
            ["cleanup.mjs", "reshapeTrace"], ["cleanup.mjs", "recreationDataFor"],
            ["observe.mjs", "createFind"], ["gm-items.mjs", "bulletFromRemnant"], ["remnants.mjs", "moveIntoLedger"]
        ];
        const FLAT = /\bBoolean\(\s*(?:[\w.?]*tiedToCrime|\w+\(\s*["']tiedToCrime["']\s*\))\s*\)/;
        // A token's flag passed on as it stands: the old `false` is a GM's "not tied" in the ledger.
        const RAW = /tiedToCrime:\s*f\(\s*["']tiedToCrime["']\s*\)/;
        const empty = [], flat = [];
        for (const [file, fn] of READS) {
            const body = fnSource(stripComments(sources.get(file) ?? ""), fn);
            if (body.length < 40) empty.push(`${file} ${fn}`);
            if (FLAT.test(body) || RAW.test(body)) flat.push(`${file} ${fn}`);
        }
        ok(FLAT.test("tiedToCrime: Boolean(entry.tiedToCrime),") && !FLAT.test("tiedToCrime: tieState(entry.tiedToCrime),")
            && FLAT.test('tiedToCrime: Boolean(f("tiedToCrime")),') && RAW.test('tiedToCrime: f("tiedToCrime"),')
            && !RAW.test('tiedToCrime: oldTokenTie(f("tiedToCrime")),'),
            "the reader does not tell the flattened or raw tie from the kept one");
        equal(JSON.stringify([empty, flat]), JSON.stringify([[], []]),
            "a writer or reader of the tie was not found, flattens it to two states with Boolean() or passes an old token's flag on raw (not found; flattens)");
    }],

    ["R306 - a reshape's ruling is claimed before anything waits: claimRuling marks `ruled` with no await, and the store's hydration is the only wait before either ruling claims", async () => {
        /*
         * E09 C10, 08.10.2026. Two rulings of one reshape both ran - Approve and Decline on one card,
         * or two GMs' Approve - because each read the attempt's row, awaited, and wrote, and nothing
         * marked the proposal ruled. cleanup.mjs `claimRuling` reads the row and marks it in one
         * synchronous step, and every GM's ruling is run on the primary (gm-bridge.mjs
         * `askReshapeRuling`), so of two rulings there exactly one finds it unmarked. Tier 2 measures
         * the race ("two rulings of one reshape at once run once, and the second is told it was
         * ruled"); this holds the shape it rests on, which a later edit could undo without that test
         * noticing - an await added before the claim in a road the test does not take: `claimRuling`
         * is a plain function with no await that reads `.ruled` and patches `ruled:`, and in
         * `applyReshapeRuling` and `declineReshapeRuling` the one await before `claimRuling(` is
         * `cleanupAttemptStore.whenHydrated()`. Read off the source, comments stripped.
         */
        const sources = new Map(await otherSources());
        const cleanup = stripComments(sources.get("cleanup.mjs") ?? "");
        const claim = fnSource(cleanup, "claimRuling");
        const waits = text => [...text.matchAll(/\bawait\s+([\w$.]+)/g)].map(m => m[1]);
        const beforeClaim = name => {
            const body = fnSource(cleanup, name);
            return waits(bodyOf(body, "claimRuling(", { back: body.length }));
        };
        ok(JSON.stringify(waits("await a.b(); x = await c(); await  d.e.f;")) === JSON.stringify(["a.b", "c", "d.e.f"]),
            "the reader does not find the awaits of a line it is shown");
        equal(JSON.stringify([/^function\s+claimRuling\s*\(/.test(claim), /\bawait\b/.test(claim), /\.ruled\b/.test(claim),
            /\bpatch\([^;]*\bruled:/.test(claim), beforeClaim("applyReshapeRuling"), beforeClaim("declineReshapeRuling")]),
        JSON.stringify([true, false, true, true, ["cleanupAttemptStore.whenHydrated"], ["cleanupAttemptStore.whenHydrated"]]),
        "a reshape's ruling can wait before it claims the proposal (claimRuling a plain function, an await in it, its read of "
            + "`ruled`, its mark; the awaits before the claim in applyReshapeRuling and in declineReshapeRuling)");
    }],

    ["R308 - a trace's context line is drawn in the palette's dim ink, not at an opacity", async () => {
        /*
         * E09 C15, 08.10.2026; audit S05-30. The caption under a dashboard row (`.drpg-trace-context`)
         * was the cell's own ink at opacity 0.75, which nothing lifts - `body.drpg-high-contrast` raises
         * `--drpg-dim`, not an opacity - and the audit read it as below legible. Read off every stylesheet
         * the manifest loads, comments stripped: each rule that names the class, whether one sets an
         * opacity, and whether one takes `--drpg-dim`. No browser draws the line in the harness, so what
         * it looks like is not measured here (the comment over the rule has the computed contrasts).
         */
        const css = await moduleStyles();
        const bodies = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
            .filter(m => /\.drpg-trace-context\b/.test(m[1])).map(m => m[2]);
        equal(JSON.stringify([bodies.length > 0, bodies.some(b => /\bopacity\s*:/.test(b)),
            bodies.some(b => /\bcolor\s*:\s*var\(--drpg-dim\)/.test(b))]),
        JSON.stringify([true, false, true]),
        "the trace's context line (a rule naming .drpg-trace-context; one setting an opacity; one in var(--drpg-dim))");
    }],

    ["R309 - the dashboard's tables keep their counts narrow, their hints dim, their Key boxes one line, and the body's button apart", async () => {
        /*
         * E09 C16, 08.10.2026; audit S05-28, S05-29, S12-52. What the stylesheet has to say for the
         * dashboard to read at a glance, read off every stylesheet the manifest loads (comments
         * stripped): the count cells (`.drpg-num`) given a width and centred; the window's hints in
         * `--drpg-dim`; the filters' labels to the left and the count no longer pushed to the far
         * edge (`margin-left: auto`); the Key tab's description boxes one line until focused; a rule
         * for `.drpg-state-change` in each theme, with the dashboard's "A body is discovered" carrying
         * the class (investigation.mjs); and a trace's context line at Stained Glass's floor, where
         * `.notes` sets it in VT323 at Legacy's 11 px (S12-52). No browser lays the window out in the
         * harness, so how it looks is the live check LIVE-E09-04, not this.
         */
        const css = await moduleStyles();
        const rules = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2]]);
        const bodies = re => rules.filter(([selector]) => re.test(selector)).map(([, body]) => body);
        const inv = stripComments(new Map(await otherSources()).get("investigation.mjs") ?? "");
        equal(JSON.stringify([
            bodies(/\.drpg-num\b/).some(b => /\bwidth\s*:/.test(b) && /text-align\s*:\s*center/.test(b)),
            bodies(/drpg-window-case .*::placeholder$/).some(b => /\bcolor\s*:\s*var\(--drpg-dim\)/.test(b)),
            bodies(/^\.drpg-trace-filters label$/).some(b => /align-items\s*:\s*flex-start/.test(b)),
            bodies(/^\.drpg-trace-filters \.notes$/).some(b => /margin-left\s*:\s*auto/.test(b)),
            bodies(/^\.drpg-key-table textarea$/).some(b => /min-height\s*:\s*0\b/.test(b))
                && bodies(/^\.drpg-key-table textarea:focus$/).some(b => /min-height\s*:/.test(b)),
            bodies(/drpg-theme-stained-glass[^,]*\.drpg-state-change/).length > 0
                && bodies(/^\.application\.dialog[^,]*\.drpg-state-change/).length > 0,
            /action:\s*"bodyFound"[^}]*class:\s*"drpg-state-change"/.test(inv),
            bodies(/drpg-theme-stained-glass \.drpg-trace-context$/).some(b => /font-size\s*:\s*var\(--drpg-sg-floor\)/.test(b))
        ]), JSON.stringify([true, true, true, false, true, true, true, true]),
        "the dashboard's stylesheet (counts sized and centred; hints in var(--drpg-dim); filter labels left; the count pushed to the far edge; Key boxes one line until focused; a state-change rule in each theme; the body button's class; the context line at the glass's floor)");
    }],

    ["R310 - the handbooks' Key fee, difficulty ladders, reshape and Tamper's three things are the code's, in English and in Polish", async () => {
        /*
         * E09 C17, 08.10.2026; audit S05-32, S02-10 (decision D14). The two handbooks state numbers the
         * code owns, and nothing failed when the two parted: the player's Tamper said "Two things behind the
         * tile" for as long as its menu offered three (cover, reshape, frame - Reshape had no paragraph), the
         * Analyze ladders kept a Daily Life row after E09 C14 took that column out of ANALYZE_DC (no roll was
         * ever scored on it), and the Key fee's bar read "four" with no word of the case's own count, which
         * E09 C7 made the bar where it is fewer. Each line read here is first asserted to exist, so a
         * rewritten handbook fails here instead of passing on nothing; the numbers are compared with
         * KEY_REMNANTS, OBSERVE_DC, ANALYZE_DC and CLEANUP.transformAction, and the count of Tamper's
         * things with the options action-rolls.mjs `chooseTamper` offers before its Stage 6 row. The words
         * a handbook gives the bar are a table below with four alone: another bar has no words here and
         * fails until somebody writes them. Scenario 62's L2 reads the menus' labels against the same files.
         * THE DAILY LIFE OBSERVE COLUMN (E09 fix r2-G7, 09.10.2026; review round 2's open item 12). Both
         * handbooks printed OBSERVE_DC's Daily Life ladder beside the scored ones. No roll is scored on it -
         * `observeDc` is asked a Remnant's kind, no kind (REMNANT_TYPES, OBSERVE_TYPE_ALIAS) is "dailyLife",
         * and its one reader is Observe's briefing (action-rolls.mjs `thresholdFacts`, `dcObserveDaily`) -
         * so each handbook now says what the ladder is for, and this reads that sentence and the two facts
         * it rests on. A kind that is "dailyLife" fails here until the sentence is rewritten.
         */
        const VIS = ["obvious", "evident", "subtle", "hidden"];
        const ladder = (table, col) => VIS.map(v => table[v]?.[col] ?? "?").join(" / ");
        const one = (table, v, cols) => {
            const [first, ...rest] = cols.map(c => table[v]?.[c]);
            return rest.every(n => n === first) ? String(first) : "mixed";
        };
        const WORDS = {
            en: { three: { 2: "Two", 3: "Three", 4: "Four" }, bar: { 4: ["below four", "fewer than four"] },
                tile: /^\S+ things behind the tile\./, reshape: /^\*\*Reshape a trace\.\*\*/, relief: n => `needs ${n} less`, found: "found",
                daily: { player: /No roll is scored on the Daily Life row either: no trace is of that kind\. It is the ladder your Observe briefing/,
                    gm: /No roll is scored on the Daily Life column: no trace is of that kind\. It is the ladder Observe's briefing/ } },
            pl: { three: { 2: "Dwie", 3: "Trzy", 4: "Cztery" }, bar: { 4: ["poniżej czterech", "mniej niż cztery"] },
                tile: /^\S+ rzeczy za kafelkiem\./, reshape: /^\*\*Przerób ślad\.\*\*/, relief: n => `o ${n} mniej`, found: "znalezionych",
                daily: { player: /Na wierszu Daily Life nie jest też liczony żaden rzut: żaden ślad nie jest tego rodzaju\. To drabina, którą briefing Observe/,
                    gm: /Na kolumnie Daily Life nie jest liczony żaden rzut: żaden ślad nie jest tego rodzaju\. To drabina, którą briefing Observe/ } }
        };
        const rolls = stripComments(new Map(await otherSources()).get("action-rolls.mjs") ?? "");
        const menu = bodyOf(fnSource(rolls, "chooseTamper"), "options: [", { until: "...(stageSix" });
        const things = [...menu.matchAll(/\bvalue:\s*"\w+"/g)].length;
        ok(things > 0, "chooseTamper's menu was read and offers nothing - this test measured nothing");
        const { unfoundBar: bar, unfoundDespair: despair } = KEY_REMNANTS;
        const { dcRelief, limits } = CLEANUP.transformAction;
        const dailyRead = [!("dailyLife" in REMNANT_TYPES) && !Object.values(OBSERVE_TYPE_ALIAS).includes("dailyLife"),
            /"DRPG\.Action\.dcObserveDaily", \{ rows: ladderRows\(col\("dailyLife"\)\) \}/.test(fnSource(rolls, "thresholdFacts"))];
        for (const lang of ["en", "pl"]) {
            const W = WORDS[lang], lines = {};
            for (const book of ["player", "gm"]) {
                const res = await fetch(`/modules/${MODULE_ID}/docs/handbooks/${book}-handbook.${lang}.md`);
                ok(res.ok, `docs/handbooks/${book}-handbook.${lang}.md did not load`);
                lines[book] = (await res.text()).split("\n");
            }
            const lineOf = (book, re) => {
                const line = lines[book].find(l => re.test(l));
                ok(line !== undefined, `${book}-handbook.${lang}.md has no line matching ${re}`);
                return line ?? "";
            };
            const rowsAfter = (book, re) => {
                const at = lines[book].findIndex(l => re.test(l));
                ok(at >= 0, `${book}-handbook.${lang}.md has no table headed ${re}`);
                return lines[book].filter((_, n) => at >= 0 && n > at + 1 && n <= at + 5)
                    .map(l => l.split("|").map(c => c.trim()).filter(Boolean));
            };
            const cells = (book, re) => lineOf(book, re).split("|").map(c => c.trim()).filter(Boolean);
            // Tamper: the number word, and one bold paragraph per thing, up to the next heading.
            const tile = lineOf("player", W.tile);
            const tamperAt = lines.player.findIndex(l => W.tile.test(l));
            const paragraphs = lines.player.filter((l, n) => n > tamperAt && /^\*\*[^*]+\.\*\* /.test(l)
                && !lines.player.some((h, k) => k > tamperAt && k < n && /^#/.test(h)));
            const reshape = lineOf("player", W.reshape);
            const fee = lineOf("player", /^> .*\*\*\d+ Despair\*\*/);
            const gmFee = lineOf("gm", /\(`unfoundBar`, `unfoundDespair`/);
            const number = (line, re) => Number(line.match(re)?.[1] ?? NaN);
            const measured = {
                tamper: [tile.split(" ")[0], paragraphs.length],
                reshape: [reshape.includes(W.relief(dcRelief)), reshape.includes(`${limits.name} `), reshape.includes(`${limits.text} `)],
                fee: [number(fee, /\*\*(\d+) Despair\*\*/), ...(W.bar[bar] ?? ["no words for this bar"]).map(w => fee.includes(w))],
                gmFee: [number(gmFee, new RegExp(`\\*\\*(\\d+) ${W.found}\\*\\*`)), number(gmFee, /\*\*(\d+) Despair/),
                    number(gmFee, /\*\*\+(\d+)\*\*/), /\b(fewer|mniej)\b/.test(gmFee)],
                ladder: [/Key Remnant, Final Truth \|/, /^\| Prep, Incident, Tamper \|/, /^\| Faint \|/, /Daily Life \| \d/]
                    .map(re => cells("player", re).slice(1)),
                gmObserve: rowsAfter("gm", /^\| [^|]+ \| Daily Life \| Key \| Faint \|/),
                gmAnalyze: rowsAfter("gm", /^\| [^|]+ \| Daily Life \| Faint \|/).map(row => row.slice(1)),
                daily: [lineOf("player", W.daily.player) !== "", lineOf("gm", W.daily.gm) !== "", ...dailyRead]
            };
            const daily = VIS.some(v => "dailyLife" in (ANALYZE_DC[v] ?? {}));
            const expected = {
                tamper: [W.three[things] ?? `no word for ${things}`, things],
                reshape: [true, true, true],
                fee: [despair, true, true],
                gmFee: [bar, despair, bar * despair, true],
                ladder: [[ladder(OBSERVE_DC, "key"), ladder(ANALYZE_DC, "key")], [ladder(OBSERVE_DC, "prep"), ladder(ANALYZE_DC, "prep")],
                    [ladder(OBSERVE_DC, "faint"), ladder(ANALYZE_DC, "faint")], [ladder(OBSERVE_DC, "dailyLife"), daily ? ladder(ANALYZE_DC, "dailyLife") : "-"]],
                gmObserve: VIS.map((v, i) => [measured.gmObserve[i]?.[0] ?? v,
                    ...["dailyLife", "key", "faint"].map(c => String(OBSERVE_DC[v][c])), one(OBSERVE_DC, v, ["prep", "incident", "resolution"])]),
                gmAnalyze: VIS.map(v => [daily ? String(ANALYZE_DC[v].dailyLife) : "-", String(ANALYZE_DC[v].faint),
                    one(ANALYZE_DC, v, ["prep", "incident", "resolution"])]),
                daily: [true, true, true, true]
            };
            equal(JSON.stringify(measured), JSON.stringify(expected), `the ${lang} handbooks state numbers the code does not have`);
        }
    }],

    ["R321 - the handbooks' Class Trial says what the vote, the verdict, the Level Ups and a reset do, in English and in Polish", async () => {
        /*
         * E10 C17, 10.10.2026; audit S06-55 and the handbook halves of E10 C1-C16. E10 moved the vote's
         * state into the world and its ballots into the GMs' store, made a ballot one per person, handed a
         * late joiner one that raises the bar, opened the verdict window on Cancel and on "Nobody is
         * executed", put one card in front of every player, gathered the class's Level Ups into one window,
         * and made a reset count the season on - and the handbooks said "tallied in memory" and "one per
         * character" for as long as the code said otherwise. Each claim here is a pair: what the code does,
         * read from its function (`eligibleVoters`, `ballotFor`, `majorityOf`, `openVerdictDialog`,
         * `postVerdictCard`, `askWhoPicks` and `runAdvancementBatch`, `wipeSeason`, `confirmNewTrial`, the
         * console's verdict action, `seizeFloor`), and the sentences that say it, one per handbook that
         * says it. A code fact that changes fails here with its sentences, which then have to be rewritten
         * with it; a sentence rewritten without the code fails here too. Each book is asserted to have
         * loaded and each function to have been cut (`fnSource` fails on a renamed one), so nothing passes
         * on an empty read. Scenario 50's section 6 reads the buttons these sentences name against the
         * labels in lang/.
         * E10 fix r1-G5 (10.10.2026; round 1's owed list for the side line's G1, G2 and G4) added six
         * claims to the GM's books: Finish on the primary alone (`finishVerdict`), no second Level Up and
         * no second card (`verdictCard`, `verdictLevelUps`, the batch's `given`), the one write a GM
         * leaving can fall between (the batch's `onGiven` after the row's Level Up - read in the code, and
         * the sentence says so), a take-back refused while the Level Up is written (`takeBackOffer`),
         * Enter giving what the rows say (`askWhoPicks`), and a body nobody has found made the execution
         * (`executeSentenced`). At the books before it the twelve sentences were missing.
         * E10 fix r2-G2 (10.10.2026; round 2's cor M1) moved Finish from the primary alone to the verdict's
         * runner (`verdictRunner`: its own GM while connected, otherwise the primary), which the console's
         * lead reads too (`trialNextStep`); the claim and both sentences say so now.
         * E10 fix r2-G6 (10.10.2026; what the round-2 lines owed the books) added six claims to the GM's books:
         * no door opens a trial in an Eclipse (`setClock`, Edit campaign), Edit campaign asks about the chapter it
         * moves to, Now runs on the primary (`advanceFloorNow`), the moment a runner changes (`verdictRunner` - read
         * in the code, and the sentence says so), a take-back's latch and its own words (`takeBackOffer`), and both
         * verdict APIs opening the Final Trial's window (`openVerdictDialog`, `applyVerdict`). At the books before
         * it the twelve sentences were missing.
         * E10 fix r2-G7 (10.10.2026; the read of round 2's fixes, F1 and F2): Now carries the floor its GM saw and
         * a press that finds it moved on moves nothing and says so (`advanceFloorNow`, `advanceFloorOnPrimary`;
         * scenario 63 X2), and a second take-back's own words are said where they hold - the primary's and the
         * asking GM's browsers - and "busy" on any other GM's (the bridge's refusal; tier 2 "a second take-back of
         * one character while the first is written is told as a take-back" reads that code). At c51d2bd the four
         * sentences said less, and the second said its words held on every browser.
         */
        const sources = new Map(await otherSources());
        const code = file => {
            const text = stripComments(sources.get(file) ?? "");
            ok(text.length > 0, `${file} was not read - this test measured nothing`);
            return text;
        };
        const vote = code("vote.mjs"), levelUp = code("level-up.mjs"), floorUi = code("trial-floor-ui.mjs");
        const panel = code("gm-panel.mjs"), floorCode = code("trial-floor.mjs");
        const finalRoute = /if \(inFinalTrial\(\)\) return openFinalVerdictDialog\(\);/;
        const verdict = fnSource(vote, "openVerdictDialog"), batch = fnSource(levelUp, "runAdvancementBatch");
        const card = fnSource(vote, "postVerdictCard"), wipe = fnSource(code("season-setup.mjs"), "wipeSeason");
        const cancelFirst = /buttons: \[\s*\{ action: "cancel", [^}]*default: true \}/;
        const facts = {
            onePerPerson: [/!u\.isGM/, /if \(!user \|\| seated\.has\(user\.id\)\) continue;/, /!TRIAL\.deadCastBallots/]
                .every(re => re.test(fnSource(vote, "eligibleVoters"))),
            inWorld: /setTrialProgress\(\{ vote:/.test(fnSource(vote, "ballotFor")),
            lateBallot: /issued: \[\.\.\.issued, sender\.id\]/.test(fnSource(vote, "ballotFor")),
            majority: /return Math\.floor\(issued \/ 2\) \+ 1;/.test(fnSource(vote, "majorityOf")),
            nobodyFirst: /executedOptions = `<option value="">\$\{game\.i18n\.localize\("DRPG\.Vote\.nobodyExecuted"\)\}<\/option>/.test(verdict),
            cancelFirst: cancelFirst.test(verdict),
            verdictCard: [...card.matchAll(/\bannounce\(/g)].length === 1 && /whisperToOwner\(actor,/.test(card) && !/blackened/i.test(card),
            oneWindow: [...batch.matchAll(/\baskWhoPicks\(/g)].length === 1
                && /"DRPG\.Advance\.queueTitle"/.test(fnSource(levelUp, "askWhoPicks")),
            closeWindow: /!who \? \(playable \? "player" : null\)/.test(batch),
            secondTrial: cancelFirst.test(fnSource(floorUi, "confirmNewTrial")),
            finalConsole: /if \(inFinalTrial\(\)\) return openFinalVerdictDialog\(\);/.test(floorUi),
            season: /season: \(clock\.season \?\? 1\) \+ 1,\s*finalTrial: false/.test(wipe),
            deadObjector: /isDeceased\(await flagsAsHeld\(actor\)\)/.test(fnSource(code("trial.mjs"), "seizeFloor")),
            finishRunner: /const runner = verdictRunner\(progress\);\s*if \(runner && runner !== game\.user\.id\) \{\s*ui\.notifications\.warn\(game\.i18n\.format\("DRPG\.Vote\.finishOtherGm"/
                .test(fnSource(vote, "finishVerdict"))
                && /return by\?\.active \? by\.id : primaryGmId\(\);/.test(fnSource(vote, "verdictRunner"))
                && /if \(progress\.verdictApplied && runner && runner !== game\.user\.id\) return stopped \? "finishElsewhere" : "verdictElsewhere";/
                    .test(fnSource(floorUi, "trialNextStep")),
            noRepeat: /if \(verdictCardPosted\(context\.record\)\) return;/.test(fnSource(vote, "verdictCard"))
                && /given: context\.record\.given \?\? \[\]/.test(fnSource(vote, "verdictLevelUps"))
                && /planned\.filter\(entry => !handled\.has\(entry\.actorId\)\)/.test(batch),
            givenGap: /done\.applied\+\+;\s*if \(entry\.deferred\) await deferredOfferStore\.drop\(actor\.id\);\s*await onGiven\?\.\(actor\);/.test(batch),
            takeBackBusy: /if \(advancing\.has\(actor\.id\)\) \{\s*ui\.notifications\.warn\(game\.i18n\.format\("DRPG\.Advance\.takeBackBusy"/
                .test(fnSource(levelUp, "takeBackOffer")),
            enterGives: /buttons: \[\s*\{ action: "give", [^}]*default: true,/.test(fnSource(levelUp, "askWhoPicks")),
            unfoundExecuted: /isDeadForGm\(held\) \? await publishDeath\(actor, \{ phase: "classTrial" \}\)/.test(fnSource(vote, "executeSentenced")),
            eclipseDoors: /if \(trialEdge && next\.phase === "classTrial" && next\.eclipse === true\) \{\s*ui\.notifications\.warn\(game\.i18n\.localize\("DRPG\.Floor\.eclipseFirst"\)\);\s*return null;/
                .test(fnSource(code("clock.mjs"), "setClock"))
                && /if \(isEclipse\(\)\) \{\s*ui\.notifications\.warn\(game\.i18n\.localize\("DRPG\.Floor\.eclipseFirst"\)\);\s*phase = getClock\(\)\.phase;/.test(panel),
            editAsksChapter: /if \(!\(await confirmNewTrial\(Number\(chapter\)\)\)\) phase = getClock\(\)\.phase;/.test(panel),
            nowOnPrimary: /bridgeRequest\("floor\.now", seen, \{ settle: "reply", onPrimary: true, quiet: true, local: \(\) => advanceFloorOnPrimary\(seen\) \}\)/
                .test(fnSource(floorCode, "advanceFloorNow"))
                && /if \(!floorAsSeen\(seen, floor\)\) return null;/.test(fnSource(floorCode, "advanceFloorOnPrimary"))
                && /if \(res\.reason === "movedOn"\) ui\.notifications\.warn\(game\.i18n\.localize\("DRPG\.Floor\.nowMovedOn"\)\);/
                    .test(fnSource(floorCode, "advanceFloorNow")),
            runnerGap: /return by\?\.active \? by\.id : primaryGmId\(\);/.test(fnSource(vote, "verdictRunner")),
            takeLatch: /advancing\.add\(actor\.id\);\s*takingBack\.add\(actor\.id\);\s*try \{\s*if \(!await withdrawOffer/.test(fnSource(levelUp, "takeBackOffer"))
                && /if \(takingBack\.has\(actor\.id\)\) \{\s*ui\.notifications\.warn\(game\.i18n\.format\("DRPG\.Advance\.takeBackTaking"/.test(fnSource(levelUp, "takeBackOffer")),
            finalApi: finalRoute.test(fnSource(vote, "openVerdictDialog")) && finalRoute.test(fnSource(vote, "applyVerdict"))
        };
        const SAYS = {
            en: {
                gm: {
                    onePerPerson: [/one per person: a player with two students gets one ballot, and a student only a GM plays gets none \(the dead do not cast ballots, `deadCastBallots: false`\)/],
                    inWorld: [/is in the world, so a GM's reload keeps it/],
                    lateBallot: [/A player who connects while the vote is open is handed a ballot as their browser loads, and it counts among the ballots issued, so it raises the bar/],
                    majority: [/\*\*more than half of the ballots issued\*\* \(floor of half plus one\)/],
                    nobodyFirst: [/on its first option, \*\*Nobody is executed\*\*/],
                    cancelFirst: [/Its buttons are Cancel, \*\*They got it right\*\* and \*\*They got it wrong\*\*, in that order whatever the count said: Cancel is the default, so Enter closes the window and executes nobody\./],
                    verdictCard: [/every player then sees one card, \*\*THE VERDICT\*\*/, /the executed student's player is also told privately/],
                    oneWindow: [/The survivors' Level Ups come in one window on your client, \*\*The class's Level Ups\*\*/],
                    closeWindow: [/closing the window does the same, except that a student nobody plays is then given nothing/],
                    secondTrial: [/\(\*\*Open a new trial\*\*\) before opening a second trial, Cancel first and the default/],
                    finalConsole: [/the console's verdict button opens \*\*Final Trial verdict\*\*/, /^\| A final verdict \| given from the Mastermind window's or the trial console's \*\*Final Trial verdict\*\* \|/],
                    season: [/the season counted one on and the Final Trial flag down/],
                    deadObjector: [/an Objection posted in a dead student's name is refused on the primary GM's browser/],
                    finishRunner: [/It runs on the browser of the GM who gave the verdict while they are connected, otherwise on the primary GM's - on another GM's the console names whom to ask, and Enter presses nothing there/],
                    noRepeat: [/it gives no survivor a second Level Up and posts no second card/],
                    givenGap: [/a GM who leaves between a row's Level Up and the write that records it leaves that one row to be given again \(read in the code, not measured\)/],
                    takeBackBusy: [/A take-back is refused, and you are told, while that character's Level Up is being written\./],
                    enterGives: [/\*\*Hand them out\*\* - the first button and the default, so Enter does it - follows the rows/],
                    unfoundExecuted: [/the window tells you alone whose death it is: executing them makes that death the execution, and the table learns it with the verdict/],
                    eclipseDoors: [/no other door opens a trial in the dark: Edit campaign keeps the phase, applies the rest of its window and says so, and `game\.drpg\.setPhase` and `game\.drpg\.setClock` refuse the whole move/],
                    editAsksChapter: [/Edit campaign asks the same question when it moves the phase to Class Trial, about the chapter the window moves to/],
                    nowOnPrimary: [/\*\*End this mode now\*\* runs on the primary GM's browser whichever GM presses it, so a press while the clock is moving the floor on does not move it a second time, and a press that reaches it after the floor has moved on moves nothing and tells you so\./],
                    runnerGap: [/in the moment the verdict's GM disconnects, the GM who becomes its runner can press Finish the verdict before the first one's last write has landed/],
                    takeLatch: [/A player's Level Up picked while a take-back of that offer is being written is refused as busy, and a second take-back of the same character in that time is refused in its own words on the primary GM's browser and on the browser of the GM who asked for the first \(that one read in the code\), and as busy on any other GM's\./],
                    finalApi: [/`game\.drpg\.verdictDialog\(\)` and `game\.drpg\.applyVerdict\(\)` open that window too, so no road gives a Final Trial the ordinary verdict/]
                },
                player: {
                    onePerPerson: [/one per person, however many students you play; a student only a GM plays gets none/],
                    lateBallot: [/If you connect while a vote is open, your ballot comes as your browser loads/],
                    majority: [/\*\*more than half\*\* of the ballots issued - for each name/],
                    verdictCard: [/Everyone then sees one card, \*\*THE VERDICT\*\*/, /If it is your character, you are also told privately/],
                    deadObjector: [/A dead student neither presents evidence nor objects\./]
                },
                stale: [/tallied in memory/, /one per character/]
            },
            pl: {
                gm: {
                    onePerPerson: [/jedną na osobę: gracz z dwoma uczniami dostaje jedną kartę, a uczeń, którego gra tylko GM, nie dostaje żadnej \(zmarli nie głosują, `deadCastBallots: false`\)/],
                    inWorld: [/jest w świecie, więc przeładowanie GMa go zachowuje/],
                    lateBallot: [/Gracz, który połączy się w trakcie głosowania, dostaje kartę, gdy wczytuje się jego przeglądarka, i ta karta liczy się do rozesłanych, więc podnosi poprzeczkę/],
                    majority: [/\*\*więcej niż połowy rozesłanych kart\*\* \(połowa zaokrąglona w dół plus jeden\)/],
                    nobodyFirst: [/na swojej pierwszej opcji, \*\*Nikt nie zostaje stracony\*\*/],
                    cancelFirst: [/Przyciski to Anuluj, \*\*Trafili\*\* i \*\*Pomylili się\*\*, w tej kolejności bez względu na wynik: domyślny jest Anuluj, więc Enter zamyka okno i nikt nie ginie\./],
                    verdictCard: [/każdy gracz widzi potem jedną kartę, \*\*WERDYKT\*\*/, /gracz straconego ucznia dowiaduje się o tym także prywatnie/],
                    oneWindow: [/Level Upy ocalałych przychodzą w jednym oknie na twoim kliencie, \*\*Level Upy klasy\*\*/],
                    closeWindow: [/zamknięcie okna robi to samo, tyle że uczeń, którego nikt nie gra, nie dostaje wtedy nic/],
                    secondTrial: [/\(\*\*Otwórz nowy Class Trial\*\*\), zanim otworzy drugą rozprawę, z Anuluj jako pierwszym i domyślnym przyciskiem/],
                    finalConsole: [/przycisk werdyktu w konsoli otwiera \*\*Werdykt Final Trial\*\*/, /^\| Werdykt finału \| wydawany przyciskiem \*\*Werdykt Final Trial\*\* w oknie Masterminda albo w konsoli Class Trial \|/],
                    season: [/licznikiem sezonu o jeden dalej i zdjętą flagą Final Trial/],
                    deadObjector: [/Objection wniesione w imieniu martwego ucznia jest odrzucane w przeglądarce głównego GMa/],
                    finishRunner: [/Wykonuje się w przeglądarce GMa, który wydał werdykt, dopóki jest połączony, a inaczej w przeglądarce głównego GMa - w przeglądarce innego GMa konsola mówi, kogo poprosić, a Enter niczego tam nie naciska/],
                    noRepeat: [/żadnemu ocalałemu nie daje drugiego Level Upa ani nie wysyła drugiej karty/],
                    givenGap: [/GM, który wyjdzie między Level Upem wiersza a zapisem, który go odnotowuje, zostawia ten jeden wiersz do przyznania jeszcze raz \(odczytane w kodzie, niezmierzone\)/],
                    takeBackBusy: [/Cofnięcie jest odmawiane, a ty się o tym dowiadujesz, dopóki Level Up tej postaci jest zapisywany\./],
                    enterGives: [/\*\*Przyznaj\*\* - pierwszy przycisk i domyślny, więc Enter robi to samo - wykonuje wiersze/],
                    unfoundExecuted: [/okno mówi tylko tobie, czyja to śmierć: stracenie go czyni tę śmierć egzekucją, a stół dowiaduje się o niej z werdyktem/],
                    eclipseDoors: [/żadne inne drzwi nie otwierają rozprawy po ciemku: Edytuj kampanię zostawia fazę, stosuje resztę swojego okna i mówi o tym, a `game\.drpg\.setPhase` i `game\.drpg\.setClock` odmawiają całej zmiany/],
                    editAsksChapter: [/Edytuj kampanię zadaje to samo pytanie, gdy przestawia fazę na Class Trial, i to o rozdział, do którego okno przechodzi/],
                    nowOnPrimary: [/\*\*Zakończ ten tryb teraz\*\* wykonuje się w przeglądarce głównego GMa, którykolwiek GM go naciśnie, więc naciśnięcie w chwili, gdy zegar sam przesuwa debatę dalej, nie przesuwa jej drugi raz, a naciśnięcie, które dotrze do głównego GMa, gdy debata już przesunęła się dalej, niczego nie przesuwa i mówi ci o tym\./],
                    runnerGap: [/w chwili, gdy GM werdyktu się rozłącza, GM, który przejmuje jego wykonanie, może nacisnąć Dokończ werdykt, zanim dotrze ostatni zapis pierwszego/],
                    takeLatch: [/Level Up gracza wybrany, gdy cofnięcie tej oferty jest zapisywane, jest odmawiany jako zajęty, a drugie cofnięcie tej samej postaci w tym czasie jest odmawiane własnymi słowami w przeglądarce głównego GMa i w przeglądarce GMa, który poprosił o pierwsze \(to odczytane w kodzie\), a w przeglądarce każdego innego GMa jako zajęte\./],
                    finalApi: [/`game\.drpg\.verdictDialog\(\)` i `game\.drpg\.applyVerdict\(\)` też otwierają to okno, więc żadna droga nie daje Final Trial zwykłego werdyktu/]
                },
                player: {
                    onePerPerson: [/jedną na osobę, niezależnie od tego, ilu uczniów grasz; uczeń, którego gra tylko GM, nie dostaje żadnej/],
                    lateBallot: [/Jeśli połączysz się w trakcie głosowania, twoja karta przychodzi, gdy wczytuje się przeglądarka/],
                    majority: [/\*\*więcej niż połowy\*\* wydanych kart - dla każdego nazwiska/],
                    verdictCard: [/Potem wszyscy widzą jedną kartę, \*\*WERDYKT\*\*/, /Jeśli to twoja postać, dowiadujesz się o tym także prywatnie/],
                    deadObjector: [/Martwy uczeń ani nie przedstawia dowodów, ani nie wnosi objection\./]
                },
                stale: [/liczone w pamięci/, /po jednym na postać/]
            }
        };
        for (const [lang, says] of Object.entries(SAYS)) {
            const lines = {};
            for (const book of ["gm", "player"]) {
                const res = await fetch(`/modules/${MODULE_ID}/docs/handbooks/${book}-handbook.${lang}.md`);
                ok(res.ok, `docs/handbooks/${book}-handbook.${lang}.md did not load`);
                lines[book] = (await res.text()).split("\n");
                ok(lines[book].length > 1, `docs/handbooks/${book}-handbook.${lang}.md is empty - this test measured nothing`);
            }
            const said = (book, re) => lines[book].some(l => re.test(l));
            const measured = {}, expected = {};
            for (const book of ["gm", "player"]) {
                for (const [claim, sentences] of Object.entries(says[book])) {
                    measured[`${book}.${claim}`] = [facts[claim], ...sentences.map(re => said(book, re))];
                    expected[`${book}.${claim}`] = sentences.map(() => true).concat(true);
                }
            }
            measured.stale = says.stale.map(re => ["gm", "player"].some(book => said(book, re)));
            expected.stale = says.stale.map(() => false);
            equal(JSON.stringify(measured), JSON.stringify(expected),
                `the ${lang} handbooks' Class Trial says what the code does not do (each claim: [the code, ...its sentences])`);
        }
    }]
];

export { REGRESSIONS };
