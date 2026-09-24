/**
 * Danganronpa RPG - the suite's shared tools (E30, audit S17-02).
 * ---------------------------------------------------------------------------
 * What more than one tier uses: the three answers a test can give (it returns,
 * it throws a Failure, it throws a Skipped), the environment probes, the source
 * readers, the world readers the runner compares before and after tiers 0 and
 * 1, and cast(). It writes nothing to the world and imports no other suite
 * file, so a tier file that imports it imports no other tier. What the tiers
 * are: the header of tests.mjs.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { studentActors } from "./monokuma.mjs";

/* ==========================================================================
 * HARNESS
 * ========================================================================== */

class Failure extends Error {}

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
class Skipped extends Error {}

function ok(condition, message) {
    if (!condition) throw new Failure(message);
}

/**
 * Stand the test down, with the reason, when the environment cannot answer it.
 *
 * `needs(canvas?.app?.renderer, "no renderer: this needs a real canvas")` - the
 * condition is what the test requires, the message says what is missing. Never
 * reach for this because an assertion came out wrong.
 */
function needs(condition, why) {
    if (!condition) throw new Skipped(why);
}

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

/** The same, minus the suite's own files - tests.mjs and every tests-*.mjs quote each pattern they hunt for. */
async function otherSources() {
    const all = await moduleSources();
    return [...all].filter(([file]) => !/^tests(-[\w-]+)?\.mjs$/.test(file));
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
 *   `length` - the body is this many characters from the marker.
 *
 * Either way the body must reach past the marker itself, or there is nothing to read.
 */
function bodyOf(src, marker, { until = null, length = null } = {}) {
    const text = String(src ?? "");
    const at = text.indexOf(marker);
    ok(at >= 0, `the source no longer has "${String(marker).slice(0, 60)}" - this test reads nothing until it is pointed at the code again`);
    let end = text.length;
    if (until !== null) {
        end = text.indexOf(until, at + String(marker).length);
        ok(end >= 0, `"${String(until).slice(0, 40)}" no longer follows "${String(marker).slice(0, 60)}" in the source`);
    } else if (length !== null) {
        end = at + length;
    }
    const body = text.slice(at, end);
    ok(body.length > String(marker).length,
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

/**
 * What tier 0 and tier 1 promise not to change, as one comparable string per part.
 *
 * WHY THIS EXISTS (E01, 24.09.2026; audit S14-01). The handbook tells a GM that
 * `runTests({ tier: 1 })` is safe during play, and it was not: five "invariants"
 * opened and closed the Class Trial on the live world, and R10 raised a room
 * crossing sixty-one times, which springs an armed trap. Nothing noticed, because
 * the only snapshot was taken for tier 2.
 *
 * WHAT IT READS, exactly: every setting of this module (world and this browser's),
 * each actor's resources, module flags and the ids of its items, each user's module
 * flags, WHICH tokens stand on each scene (ids only - not where), and which chat
 * messages exist. Not playlists, not token positions, not other modules' settings:
 * a test that moves a token or starts a track is not caught here.
 *
 * It cannot tell a test from a person. Run during play, a player who acts or a
 * timer that runs out (an objection's minute on the primary GM) moves something too
 * - so the failure names what moved and, from `watchWrites`, which test was running
 * when it did.
 */
function worldFingerprint() {
    const parts = new Map();
    for (const [key, value] of moduleSettingValues()) parts.set(`setting ${key}`, stableJson(value));
    for (const actor of game.actors) {
        parts.set(`actor ${actor.name} (${actor.id})`, stableJson({
            resources: actor.system?.resources ?? null,
            flags: actor.flags?.[MODULE_ID] ?? null,
            items: actor.items.map(i => i.id).sort()
        }));
    }
    for (const user of game.users) {
        parts.set(`user ${user.name} (${user.id})`, stableJson(user.flags?.[MODULE_ID] ?? null));
    }
    for (const scene of game.scenes) {
        parts.set(`scene ${scene.name} (${scene.id})`, stableJson(scene.tokens.map(t => t.id).sort()));
    }
    parts.set("chat", stableJson(game.messages.map(m => m.id).sort()));
    return parts;
}

/**
 * Which test was running when the world was written, while tier 0 and tier 1 run.
 *
 * The fingerprint says WHAT moved; this says WHEN (the review of E01). Run during
 * play, the answer to "was it the suite" is in the name: a write that landed in the
 * middle of "R10" is the suite's, and one that landed between two tests, or in a
 * test that only reads source, is more likely the table - an objection's minute
 * running out on the primary GM, a player's action arriving over the socket. Hooks
 * rather than a fingerprint per test, because a fingerprint per test costs a full
 * read of every setting a hundred and eighty times.
 */
function watchWrites(current) {
    const seen = [];
    const note = what => seen.push(`${what} (during "${current() ?? "between tests"}")`);
    const prefix = `${MODULE_ID}.`;
    const listeners = [
        ["updateSetting", doc => { if (String(doc?.key).startsWith(prefix)) note(`setting ${doc.key.slice(prefix.length)}`); }],
        ["createSetting", doc => { if (String(doc?.key).startsWith(prefix)) note(`setting ${doc.key.slice(prefix.length)}`); }],
        ["clientSettingChanged", key => { if (String(key).startsWith(prefix)) note(`setting ${String(key).slice(prefix.length)}`); }],
        ["createChatMessage", () => note("a chat message")],
        ["updateActor", actor => note(`actor ${actor?.name}`)],
        ["createItem", item => note(`an item on ${item?.parent?.name ?? "the world"}`)],
        ["deleteItem", item => note(`an item on ${item?.parent?.name ?? "the world"}`)],
        ["createToken", () => note("a token")],
        ["deleteToken", () => note("a token")],
        ["updateUser", user => note(`user ${user?.name}`)]
    ].map(([hook, fn]) => [hook, Hooks.on(hook, fn)]);
    return { seen, stop: () => { for (const [hook, id] of listeners) Hooks.off(hook, id); } };
}

/** The parts of two fingerprints that differ, by name. */
function fingerprintDiff(before, after) {
    const keys = new Set([...before.keys(), ...after.keys()]);
    return [...keys].filter(k => before.get(k) !== after.get(k));
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

export {
    Failure, Skipped, ok, needs, equal, wait, settle, until,
    layoutAvailable, cascadeAvailable, LIVE_PROBE, glassTheme, canvasAvailable, systemSheetsAvailable, dialogsDrawn,
    moduleSources, otherSources, stripComments, moduleStyles, bodyOf, topLevelFunction, withGuards, lineAt, stripStrings,
    stringLiterals, STANDING, stableJson, moduleSettingValues, worldFingerprint, watchWrites, fingerprintDiff, cast
};
