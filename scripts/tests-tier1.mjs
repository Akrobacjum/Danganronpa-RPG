/**
 * Danganronpa RPG - tier 1 of the suite: the invariants, which only read (E30, audit S17-02).
 * ---------------------------------------------------------------------------
 * Safe at any point in a session: the runner in tests.mjs reads the world
 * before tier 0 and after tier 1, and fails on any difference.
 */

import {
    OVERFLOW, MODULE_ID, moduleVersion, CRISIS_ACTIONS, ACTIONS, TRAITS, ITEM_CATEGORIES,
    LIMIT_GROUPS, EQUIPPABLE, SFX_EVENTS, SFX_CATEGORIES, HOPE_CALLS, DESPAIR_CALLS, OBSERVE_DC,
    ANALYZE_DC, CLEANUP, CRITICAL, KEY_REMNANTS, PHASES, PRICE_CHAINS, RESOLUTION_STRESS_COST
} from "./config.mjs";
import { rolesOf } from "./inventory.mjs";
import { vaultContents, stashRoomOfItem, stashIn, allVaults } from "./vault.mjs";
import { SETTINGS, DEFAULT_SAFEWORD, getSetting, BREAKPOINTS } from "./settings.mjs";
import { safeword } from "./safeword.mjs";
import { getClock } from "./clock.mjs";
import { studentActors } from "./monokuma.mjs";
import { detectPageTinting, stylesheetVersion } from "./diagnostics.mjs";
import { voiceTargets, liveKitRoomFor } from "./voice.mjs";
import { MUSIC_STATES, musicMap } from "./music.mjs";
import {
    ok, needs, env, world, equal, must, wait, settle, until, cascadeAvailable, LIVE_PROBE,
    moduleSources, otherSources, stripComments, moduleStyles, bodyOf, fnSource, topLevelFunction, STANDING, watchLog, stableJson
} from "./tests-kit.mjs";

/* ==========================================================================
 * TIER 1 - INVARIANTS
 * ========================================================================== */

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
         *
         * A world with nothing stashed has nothing to check, and says so (E30: this
         * counted no assertion at all in the harness until its world had a stash).
         */
        needs(world.atLeast("stashedItems"), "an orphan is a stashed item whose stash has gone");
        for (const actor of game.actors.filter(a => a.type === "character")) {
            for (const item of vaultContents(actor)) {
                const room = stashRoomOfItem(item, actor, canvas?.scene);
                ok(room, `"${item.name}" on ${actor.name} is stashed nowhere`);
                ok(stashIn(room, actor.id, canvas?.scene),
                    `"${item.name}" on ${actor.name} names the stash in "${room}", which does not exist`);
            }
        }
    }],

    ["every stash belongs to somebody who exists", () => {
        // An actor deleted mid-season leaves their stash entries behind, and a
        // list of ghosts is what makes the Stashes tab draw a column for nobody
        // and `openStashesHere` offer a drawer that cannot be opened.
        needs(world.atLeast("stashes"), "a stash to hold to its owner");
        for (const entry of allVaults(canvas?.scene)) {
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
        const add = bodyOf(overflow, "export async function addOverflow", { until: "let arming" });
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
        const wipe = bodyOf(season, "async function wipeSeason");
        ok(wipe.length > 500, "wipeSeason is gone");
        ok(/resetOverflow\(/.test(wipe),
            "a season reset empties the Despair pools and leaves their overflow standing");

        // Both halves, or a new season inherits an armed darkening.
        const reset = bodyOf(overflow, "export async function resetOverflow", { length: 600 });
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

        const edit = bodyOf(tables, "async function editResult", { until: "async function dropResult" });
        ok(edit.length > 100, "editResult is gone");
        ok(/description:\s*value\s*\}/.test(edit),
            "an emptied description is being written as something other than empty - "
            + "the name fallback is back, and the field will not take a deletion");
        ok(!/description:\s*value\s*\|\|/.test(edit),
            "editResult fell back to the name again on an empty description");

        // The other two are guarded for EVERY module window at once, so they
        // are read from the guard rather than from this one caller.
        const utils = stripComments(sources.get("utils.mjs") ?? "");
        const guard = bodyOf(utils, "export function guardTextFields", { until: "export function registerTextGuard" });
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
        const rows = bodyOf(tables, "function tableItemsHtml", { until: "async function addResult" });
        ok(/data-drpg-initial/.test(rows),
            "table rows no longer carry the value they were rendered with, so there is "
            + "nothing to compare against and every blur is a write again");
        ok(/data-drpg-owns-result/.test(rows) && /data-drpg-owns-table/.test(rows),
            "a field no longer carries its own ids, so one orphaned by a redraw cannot "
            + "say what it belonged to");

        ok(/if \(field\.value\.trim\(\) === \(field\.dataset\.drpgInitial \?\? ""\)\) return;/.test(tables),
            "an unchanged field is written again - which is how untouched rows lost their "
            + "descriptions to nothing more than focus passing over them");

        const showFn = bodyOf(tables, "const flush = async", { until: "show(current);" });
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

        // Cut with the kit (E30): `must`, not `ok`, so finding the function is not
        // counted as measuring it, and the end is searched after the start - the old
        // local helper searched it from the top of the file.
        const between = (from, to) => bodyOf(rolls, from, { until: to });

        // Project work: the bands come down, not the roll up.
        const project = between("async function workOnProject", "async function chooseProject(");
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

        // Cut with the kit (E30), which asks for each case with `must`, not `ok`.
        const caseOf = (name, next) => bodyOf(sync, `case SYNC.${name}:`, { until: `case SYNC.${next}:` });

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

        const opening = bodyOf(eclipse, "export async function startEclipse", { until: "export async function endEclipse" });
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
            // Dawid, 21.09: every bullet rolls, a Key included - priced like finding it.
            equal(row.key, OBSERVE_DC[band].key,
                `Analyze/${band} on a Key Truth Bullet is not priced like finding one`);
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
        const body = bodyOf(src, "async function reshapeTrace", { length: 1400 });
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

        const body = bodyOf(src, "async function bodyDestinations", { length: 500 });
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
            await fetch(`/modules/${MODULE_ID}/scripts/murder-rules.mjs`).then(r => r.text()));

        // The whole function (E32 C5a): the Class Trial's refusal pushed the fight's past 2600 characters.
        const body = fnSource(src, "betrayalTarget");
        // The offer lives in the cast (CASE-04), never on the actor: a flag is
        // world data every client receives.
        ok(/readCast\(\)\.betrayal/.test(body),
            "betrayalTarget does not read the cast's offer, so nothing outlives the incident");
        ok(!/FLAGS\.betrayalWindow/.test(body),
            "betrayalTarget reads an actor flag, which names the accomplice to every client");
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
        const flagAt = body.indexOf("readCast().betrayal");
        const stateAt = body.indexOf("murderState()");
        ok(flagAt > 0, "the offer no longer comes from the window");
        ok(stateAt > flagAt,
            "the incident is asked before the window, so the offer is sourced from it again");
        // `open.thirdId` is the offer's own field; `state.thirdId` would be the incident's.
        ok(!/(state|running)\??\.thirdId/.test(body),
            "the offer still needs the incident to be naming a third party");
        ok(/getClock\(\)/.test(body),
            "nothing checks the day, so the window never shuts");
        ok(/running\?\.active/.test(body),
            "the tile lights in the middle of a fight, for a betrayal that would be refused");

        // Armed from the one state writer, so the six roads into a resolution
        // cannot each grow their own copy of the rule.

        // THE WHOLE FUNCTION, NOT A FIXED SLICE. This read 1200 characters, and
        // when LIVE-001 (1b) split the write into a cast half and a public half
        // the arming moved past that mark - `stripComments` keeps every
        // comment's length, so the note above the arming counts too. The suite
        // then reported the window "armed somewhere else" while it sat exactly
        // where it always had. A function ends at its own closing brace.
        // E34 C7a (1.2.70): the writer is incident-store.mjs's; the rest of this reads murder-rules.mjs (E34 C8).
        const writer = fnSource(stripComments(
            await fetch(`/modules/${MODULE_ID}/scripts/incident-store.mjs`).then(r => r.text())), "writeState");
        ok(/armBetrayalWindow/.test(writer),
            "the window is armed somewhere other than the single state writer");
        ok(/before\.stage !== "resolution"/.test(writer),
            "the window is armed off the state rather than the transition, so it re-arms");

        // Single use, spent before the attempt rather than after it - since E32 C5a in the one
        // path the tile and the GM's checklist share, before the incident it opens.
        const opener = fnSource(src, "openBetrayal");
        ok(/openBetrayal\(/.test(fnSource(src, "betrayAsPlayer")),
            "the tile's betrayal does not go through openBetrayal, the path that spends the offer");
        const takenAt = opener.search(/takeBetrayalOffer\(/);
        ok(takenAt > 0 && takenAt < opener.search(/\bopenMurder\(/),
            "the offer is not spent before the betrayal's incident opens, so it can be taken twice");
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

        const body = bodyOf(src, "function lockedInIncident", { length: 600 });

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
        const fnBody = bodyOf(settingsSrc, "function incidentParticipants", { length: 400 });
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

        const body = bodyOf(src, "function witnessesTo", { length: 400 });
        ok(/isCleaner\(actor\)/.test(body),
            "the exemption is not limited to the killers, so an innocent gets it too");
        ok(/killerIds/.test(body),
            "the exemption reads its own list instead of the one the stage admits people by");

        ok(/witnessesTo\(/.test(bodyOf(src, "async function concealFromWitnesses", { length: 500 })),
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
        const call = bodyOf(src, "callGm(trap.killer", { length: 400 });
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
        for (const file of ["traps", "projects", "projects-secrecy", "gm-panel", "sheet", "murder", "incident-store", "murder-rules", "murder-ui"]) {
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
            const owned = stashRoomsFor(actor, canvas?.scene).map(entry => entry.room);
            for (const room of owned) {
                if (!stashIn(room, actor.id, canvas?.scene)) {
                    wrong.push(`${actor.name} owns a stash in ${room} that the room denies`);
                }
                if (!stashesIn(room, canvas?.scene).some(entry => entry.actorId === actor.id)) {
                    wrong.push(`${actor.name}'s stash in ${room} is not in that room's list`);
                }
            }
            // And the other direction: a room that names them, which their own
            // list left out.
            for (const room of (await import("./movement.mjs")).allRooms(canvas?.scene)) {
                if (owned.includes(room)) continue;
                if (stashesIn(room, canvas?.scene).some(entry => entry.actorId === actor.id)) {
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

        const rooms = allRooms(canvas?.scene);
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
            "gm-team-dialog", "gm-items", "gm-panel", "murder", "murder-ui", "voice", "trial"
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
        const stop = keepLive(app, { region: ".drpg-t-region", build, delay: 0, watch: { hooks: [LIVE_PROBE] } });

        try {
            host.querySelector("details").open = true;
            host.querySelector("input[name=typed]").value = "half a sentence";
            host.querySelector(".drpg-t-scroller").scrollTop = 120;

            // A redraw, asked of this region alone (see LIVE_PROBE).
            Hooks.callAll(LIVE_PROBE);
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
        const stop = keepLive(app, { region: ".drpg-t-focus", build, delay: 0, watch: { hooks: [LIVE_PROBE] } });

        try {
            const field = host.querySelector("input[name=f]");
            field.focus();
            ok(document.activeElement === field, "could not put focus in the field");

            const before = built;
            Hooks.callAll(LIVE_PROBE);
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
            <button type="button" name="place:4" class="drpg-key-place drpg-key-limited" disabled>Place</button>
            <select name="token:4"><option value="">-</option></select>
            <button type="button" name="place:5" class="drpg-key-place drpg-key-limited" disabled>Place</button>
        </div>`;
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;left:-3000px;top:0;width:200px";
        host.innerHTML = build();
        document.body.appendChild(host);

        const app = { element: host, options: { window: { title: "test" } } };
        const stop = keepLive(app, {
            region: ".drpg-t-keys", build, delay: 0, watch: { hooks: [LIVE_PROBE] },
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

            // A redraw, asked of this region alone (see LIVE_PROBE).
            Hooks.callAll(LIVE_PROBE);
            await wait(140);

            ok(box().checked === true, "the redraw unticked the override");
            ok(rows().every(el => !el.disabled),
                "the redraw put the rows back out of reach while the override was still ticked");
        } finally {
            stop();
            host.remove();
        }
    }],

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
        const table = bodyOf(sync, "const SETTING_KINDS", { until: "};" });
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
        ok(/function callDice\(/.test(dialog) && /callDice\(windowCalls\(app, actor\)\)/.test(dialog),
            "the roll window counts one Call's die instead of adding them up");
        // E08+E28 C7 (S02-20): by name, the ones the roll read - a Call armed after them waits.
        ok(/consumeCallsByNonce\(actor, armedCalls\.map\(/.test(rolls),
            "an action roll spends something other than every armed Call it read, by name");
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

    ["Analyze prices a neutral trace like the evidence it stands in for", async () => {
        /*
         * ACT-10's other half, measured against the tables rather than the source:
         * every visibility band has to answer for a neutral trace, and the answer has
         * to be the prep column - the same alias Observe has used since the tables
         * were written. `null` here is what made an Analyze free.
         */
        const { analyzeDc, ANALYZE_DC, OBSERVE_TYPE_ALIAS } = await import("./config.mjs");
        equal(OBSERVE_TYPE_ALIAS.neutral, "prep", "the alias stopped pointing at prep");
        for (const band of Object.keys(ANALYZE_DC)) {
            const dc = analyzeDc(band, "neutral");
            equal(dc, ANALYZE_DC[band].prep,
                `a neutral trace in the ${band} band is priced at ${dc}`);
            ok(Number.isFinite(dc), `a neutral trace in the ${band} band is still a free pass`);
        }
    }],

    ["R111 - the book in the corner opens the handbooks", async () => {
        /*
         * 22.09 (Dawid): a third corner button, the smallest, at the wall and level with
         * the seam between the chat and settings circles. It opens the Student Brochure
         * and the Player Handbook for everybody and the GM Handbook for a GM.
         * E81 C12, 12.10.2026: the owner's grid (Q3 of 07.10, AM-18 and AM-21) moved all
         * three, so the three readings below say the grid's version of what they said -
         * the chat over the midpoint of the other two (it was one book and 8 px inboard
         * of the book), the book at the wall (it was level with the midpoint of the other
         * two centres), the chat the largest and the other two one size (the book was
         * the smallest) - and two are new: settings on the bottom line, and the chat
         * above it. The stage's plan asked for today's three to stay; on the grid each
         * of them is false, so they are rewritten rather than kept. The grid's own
         * numbers are R474's (headless) and R299 (a)'s.
         */
        const { booksFor, handbookHtml, openHandbooks } = await import("./handbooks.mjs");
        equal(booksFor({ isGM: false }).map(b => b.id).join(), "player-brochure,player-handbook",
            "a player is offered the wrong handbooks");
        equal(booksFor({ isGM: true }).length, 3, "a GM is missing a handbook");

        const book = document.getElementById("drpg-book-launcher");
        ok(book, "the handbooks button is not on the screen");
        // The environment first, then the button (E01, audit S14-05): a button with
        // no width in a browser that lays out is a button that is not drawn.
        needs(env.layout(), "where the button stands needs a browser");
        ok(book.offsetWidth > 0, "the handbooks button is on the page and has no width - it is not drawn");

        /* Where it stands, read from the resolved insets rather than the boxes: under
           Stained Glass the three are turned with their pane, and a turned box is wider
           than the circle in it. */
        const px = (el, prop) => Number.parseFloat(getComputedStyle(el)[prop]);
        const chat = document.getElementById("drpg-messenger-launcher");
        const gear = document.getElementById("drpg-sound-launcher");
        const across = el => px(el, "right") + el.offsetWidth / 2, centre = el => px(el, "bottom") + el.offsetHeight / 2;
        ok(Math.abs(across(chat) - (across(book) + across(gear)) / 2) < 1,
            "the chat button is not centred over the midpoint of the book and settings");
        ok(px(book, "right") <= Math.min(px(chat, "right"), px(gear, "right")) + 0.5, "the book is not the one at the wall");
        ok(book.offsetWidth === gear.offsetWidth && gear.offsetWidth < chat.offsetWidth,
            "the chat button is not the largest, or the book and settings are not one size");
        ok(Math.abs(px(gear, "bottom") - px(book, "bottom")) < 0.5 && px(gear, "bottom") < px(chat, "bottom"),
            "settings does not stand on the bottom line with the book");
        ok(centre(chat) > px(gear, "bottom") + gear.offsetHeight, "the chat button does not stand above settings");

        // Every book in both languages ships and comes out as a handbook, with no ids
        // that could shadow Foundry's own (#chat, #players).
        needs(env.markdown(), "this needs Foundry's own page");
        for (const lang of ["en", "pl"]) {
            for (const id of ["player-brochure", "player-handbook", "gm-handbook"]) {
                const html = await handbookHtml(id, lang);
                ok(/<h1>/.test(html) && /<table>/.test(html), `${id}.${lang} did not come out as a handbook`);
                ok(!/\sid="/.test(html), `${id}.${lang} carries ids that could shadow Foundry's own`);
            }
        }

        // The button opens it, with its contents list, and the list moves the text.
        book.click();
        let app = null;
        for (let i = 0; i < 40 && !app?.element?.querySelector(".drpg-handbook-toc a"); i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            app = foundry.applications.instances.get("drpg-handbooks");
        }
        try {
            ok(app?.rendered, "the handbooks button opened nothing");
            const text = app.element.querySelector(".drpg-handbook-text");
            const links = [...app.element.querySelectorAll(".drpg-handbook-toc a")];
            ok(links.length > 1, "the handbook window has no contents list");
            /* AND IT OPENS NOTHING ELSE (E27, audit S12-01). This clicked the entry and
               read `scrollTop`, which moved - while Foundry's document-wide link
               handler opened `/game#` in a new tab, a second client of the game. The
               suite passed through Dawid's bug. Counted here on the real window. */
            const opens = [];
            const realOpen = window.open;
            window.open = (...args) => { opens.push(String(args[0])); return null; };
            try {
                links.at(-1).click();
                links.at(-1).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
            } finally {
                window.open = realOpen;
            }
            equal(opens.length, 0, `a contents entry opened a browser tab: ${opens.join(", ")}`);
            ok(text.scrollTop > 0, "the contents list does not move the text");
            ok(app.element.getBoundingClientRect().bottom <= window.innerHeight + 1,
                "the handbook window runs off the bottom of the screen");
        } finally {
            await app?.close();
        }

        /* The boxes are GitHub's alert syntax, so one file reads right in both places: a
           `> [!KIND]` quote becomes a titled box of that kind, and any other quote stays one. */
        const { markdownToHtml } = await import("./handbooks.mjs");
        const probe = document.createElement("div");
        probe.innerHTML = markdownToHtml("> [!WARNING]\n> Costs **1 Sanity**.\n\n> Just a quote.\n");
        const box = probe.querySelector("aside.drpg-callout.drpg-callout-warning");
        ok(box, "a [!WARNING] quote did not become a warning box");
        ok(box && !/\[!WARNING\]/.test(box.textContent), "the box still shows its [!WARNING] marker");
        ok(box?.querySelector(".drpg-callout-title")?.textContent.includes(game.i18n.localize("DRPG.Handbooks.callout.warning")),
            "the box has no title in the module's language");
        ok(box?.querySelector("strong"), "bold inside a box was lost");
        ok(probe.querySelector("blockquote"), "an ordinary quote was turned into a box");
    }],

    ["R130 - a newer Daggerheart is named, with only Daggerheart's own missing places", async () => {
        /*
         * E01, 24.09.2026; audit S01-09, and the review of E01. The warning is the one
         * thing between a stranger's table on a newer Daggerheart and a feature that
         * stopped without a word (D1: no maximum), and nothing tested it: the harness
         * runs a Daggerheart that is exactly the verified one, so the path never ran.
         * Asked here with the versions handed in. The review also found it listing
         * Isometric Perspective's override as a missing place in Daggerheart on every
         * world without that module; the list is Daggerheart's rows only.
         */
        const { newerSystemFindings, systemCompatibility } = await import("./requirements.mjs");
        const { PATCHES } = await import("./patches.mjs");
        const { verified, minimum } = systemCompatibility();
        ok(verified && minimum, "the manifest states no verified or minimum Daggerheart");
        equal(await newerSystemFindings({ found: verified, verified }), null,
            "the verified version itself is called newer");
        const newer = await newerSystemFindings({ found: "99.0.0", verified });
        ok(newer, "a far newer Daggerheart is not called newer");
        equal(newer.found, "99.0.0", "the warning names some other version");
        const ours = new Set(PATCHES.filter(p => p.owner === game.system?.id).map(p => p.target));
        ok(ours.size > 0, "no row of the patch table is marked as Daggerheart's");
        ok(PATCHES.every(p => typeof p.owner === "string" && p.owner), "a patch row says nothing about whose code it changes");
        const strays = newer.missing.filter(target => !ours.has(target));
        ok(!strays.length, `the warning lists places that are not Daggerheart's: ${strays.join(", ")}`);
    }],

    ["R127 - a handbook contents entry answers its click and is not a link anything can follow", async () => {
        /*
         * E27, 24.09.2026; audit S12-01 (high, reproduced live). An entry was
         * `<a href="#">` and its click handler only prevented the default. Foundry's
         * `Game#_onClickHyperlink`, listening on the whole document, takes the nearest
         * `a[href]` and opens it with `window.open(href, "_blank")` without asking
         * whether anybody prevented the default - so every click on the contents list
         * opened a second client of the game in a new tab. R111 clicked the entry and
         * checked that the text scrolled, which it did, and passed.
         *
         * Asked here without the window, which needs layout: the list is built by the
         * same function on a text of three headings, then clicked and given Enter, with
         * a listener standing in for Foundry's (the same `closest("a[href]")`) and
         * `window.open` counted.
         */
        const { fillContents } = await import("./handbooks.mjs");
        const toc = document.createElement("nav");
        const text = document.createElement("div");
        text.innerHTML = "<h2>One</h2><p>a</p><h3>Two</h3><p>b</p><h2>Three</h2><p>c</p>";
        document.body.append(toc, text);
        const followed = [];
        const foundryLike = event => { if (event.target.closest?.("a[href]")) followed.push("hyperlink"); };
        const realOpen = window.open;
        window.open = (...args) => { followed.push(`open ${args[0]}`); return null; };
        document.addEventListener("click", foundryLike);
        try {
            fillContents(toc, text);
            const entries = [...toc.children];
            equal(entries.length, 3, "the contents list did not get one entry per heading");
            ok(!toc.querySelector("a[href]"), "a contents entry carries an address again - Foundry will open it in a new tab");
            ok(entries.every(e => e.getAttribute("role") === "link" && e.tabIndex === 0),
                "a contents entry is not a focusable link to a screen reader or a keyboard");
            // Handled, and kept here: the entry's own handler prevents the default,
            // which is how this knows the click reached it (the stand-in above cannot
            // hear it once propagation stops - that half is the `a[href]` question).
            const click = new MouseEvent("click", { bubbles: true, cancelable: true });
            entries[2].dispatchEvent(click);
            ok(click.defaultPrevented, "a click on a contents entry never reached its handler");
            const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
            entries[1].dispatchEvent(enter);
            ok(enter.defaultPrevented, "Enter on a contents entry does nothing");
            equal(followed.length, 0, `a contents entry was followed: ${followed.join(", ")}`);
        } finally {
            document.removeEventListener("click", foundryLike);
            window.open = realOpen;
            toc.remove();
            text.remove();
        }
    }],

    ["R131 - a held setting of a module that is not here writes nothing", async () => {
        /*
         * E27, 24.09.2026; the review of E27. The stage's verify list asks that with
         * Isometric Perspective off, the module writes nothing and hides nothing - and
         * the harness has that module always on. Asked with a row for a module that is
         * not installed at all, which is the same road (`entryOf` answers null): no row
         * is held, and the purity check at the end of tier 1 says whether anything was
         * written.
         */
        const { applyEnforced } = await import("./enforced.mjs");
        const held = await applyEnforced([{ id: "suiteAbsent", module: "drpg-suite-absent-module",
            key: "showWelcome", value: false, toggle: SETTINGS.enforceIsoWelcome }]);
        equal(held.length, 0, "a row for a module that is not here was held");
    }],

    ["R112 - the curtain holds on a narrow desk, and the right column is wider", async () => {
        /*
         * 22.09: swept on a fresh load at 22 sizes, the curtain's self-check failed at every
         * width from 1152 to 1400 - a tray that joined the Despair rail's column, a stacked
         * tray cut as a loose box, a 2 px sliver between two panes - and the rail and the
         * status strip stood on each other below 1224. Each fix is held by its source here;
         * the partition at this window's own size is "the curtain cuts a clean partition".
         */
        const glass = stripComments(await fetch(`/modules/${MODULE_ID}/scripts/glass.mjs`).then(r => r.text()));
        ok(/cols\.find\(c => overOf\(c, b\) > 0\)\s*\?\?/.test(glass),
            "a block joins the first column near it again, not the one it stacks under");
        ok(/b\.w > W \* 0\.5 \|\| inStack\(b\)/.test(glass), "a narrow block in the stack is cut as a loose box again");
        ok(/free - 2 \* PAD_SIDE < FILL_MIN \? Math\.max\(0, free \/ 2\)/.test(glass),
            "two close panes stop a pixel short of each other again");
        equal(BREAKPOINTS.narrow, 1224, "the desk layout is back at widths where the rail and the strip overlap");

        // Wider toward the tiles: the column's margin, and the width it asks for where it fits.
        // What this half needs is three facts about where it runs, asked before the column
        // is (E01, audit S14-05 and S14-18): the glass theme, a browser that lays out, and a
        // desk rather than a stacked screen. On all three, a column that is not pinned is
        // the module's failure, not the environment's.
        needs(env.glass(), "this measures Stained Glass");
        needs(env.layout(), "the column's width needs a browser");
        needs(env.desk(), "the column is pinned only on a desk");
        const col = document.getElementById("ui-right-column-1");
        ok(col?.dataset.drpgPinned === "1", "the right column is not pinned on a desk-width screen under the glass");
        equal(getComputedStyle(col).marginRight, "6px", "the right column keeps its old 22 px off the tiles");
        const scale = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-sg-scale")) || 1;
        const width = document.getElementById("drpg-player-status")?.offsetWidth ?? 0;
        ok(width >= Math.round(360 * scale) - 1, `the status strip is narrower than it was (${width} px)`);
    }],

    ["R110 - the gaps the README survey found stay closed", async () => {
        /*
         * 22.09: checking the new README against the code turned up six places where the
         * module did not do what it said. Each is held here by what it does, where that can
         * be asked without a table, and by its source where it cannot.
         */
        const sources = new Map(await otherSources());
        const src = name => stripComments(sources.get(name) ?? "");

        // Listen names only the rooms the listener has discovered - its first throw and, since
        // E08+E28 fix r1-G4, its Reroll's lines (built on the roller's browser, reroll.mjs
        // `listenLines`), through the one rule (`listenLabels`), on the scene the character
        // stands on (E12 fix r1-G4; what a player's browser answers is scenario 66 K1).
        const listen = src("action-rolls.mjs");
        const body = bodyOf(listen, "async function performListen", { until: "\n}" });
        const rerolled = bodyOf(src("reroll.mjs"), "async function listenLines", { until: "\n}" });
        const doors = /listenLabels\(neighbours, roomsKnownToMe\(scene\)\)/;
        ok(doors.test(body) && doors.test(rerolled),
            "Listen names every neighbouring room again, discovered or not (the first throw or the Reroll)");
        const { listenLabels } = await import("./action-rolls.mjs");
        const unexplored = n => game.i18n.format("DRPG.Listen.unknownRoom", { n });
        equal(JSON.stringify([[...listenLabels(["A", "B", "C"], new Set(["B"])).values()], [...listenLabels(["A", "B"], null).values()]]),
            JSON.stringify([[unexplored(1), "B", unexplored(2)], ["A", "B"]]),
            "a room the viewer has not been in is not \"Unexplored room n\", or a GM's map loses a name");
        ok(/<option value="\$\{i\}">/.test(body), "Listen's options carry room names in the page");
        ok(game.i18n.has("DRPG.Listen.unknownRoom"), "the unexplored-room label has no text");

        // A key taken by Palm, from a stash or from a body still opens its door.
        const { preservedFlags } = await import("./inventory.mjs");
        const fakeKey = { getFlag: (scope, key) => (key === "bedroomKey" ? "Test Room" : undefined) };
        equal(preservedFlags(fakeKey).bedroomKey, "Test Room", "a key loses its room when it changes hands");

        // A removed stash is forgotten by whoever had found it.
        const vault = src("vault.mjs");
        const set = bodyOf(vault, "export async function setStash", { until: "\n}" });
        ok(set.indexOf("forgetStashFound(") > 0 && set.indexOf("forgetStashFound(") < set.lastIndexOf("return list"),
            "setStash forgets the finders after it has already returned");

        // A trace left by looting a body earns an icon like any other trace.
        const icons = src("remnant-icons.mjs");
        ok(/"loot"/.test(icons), "a looted body's trace has no icon to earn");
        const svg = await fetch(`/modules/${MODULE_ID}/icons/remnant-loot.svg`);
        ok(svg.ok, "icons/remnant-loot.svg is missing");
        ok(game.i18n.has("DRPG.Remnant.action.loot"), "a looted body's trace has no action name");

        // The season checklist checks what it says it checks.
        const season = src("season-setup.mjs");
        ok(/some\(a => isMonokuma\(a\)\)/.test(season), "'At least one Monokuma' is satisfied by a GM account alone again");
        ok(/feedsNobody\(a\) \|\| monokumaFor\(a\)/.test(season),
            "a student set to nobody on purpose is a red cross on the checklist again");

        // The killers still cleaning up are not the witnesses who find the body.
        ok(/killerIds\(murderState\(\)\)/.test(src("chapter.mjs")),
            "two killers in Stage 6 can discover their own victim again");
    }],

    ["R109 - a notice stays until it is closed, the newest on top", async () => {
        /*
         * Dawid, 22.09: "powiadomienia niech nie znikaja, dopoki gracz ich nie zamknie",
         * and then "nowy notice ma wypychac pod spod stare". No timer, nothing dismissed
         * for room: a card past what the stack shows waits parked under the others, the
         * stack says how many with "+N", and closing a shown card brings one back.
         */
        const popup = stripComments((new Map(await otherSources())).get("popup.mjs") ?? "");
        ok(!/setTimeout\(dismiss/.test(popup), "a notice leaves by itself on a timer again");
        ok(!/drpg-dismiss"\)\);\s*\}\s*\}/.test(bodyOf(popup, "function trimStack", { until: "function unparkInto" })), "the stack dismisses its oldest cards again");

        const { showPopup } = await import("./popup.mjs");
        const host = () => document.getElementById("drpg-popups");
        document.querySelectorAll("#drpg-popups .drpg-popup").forEach(c => c.remove());
        const shown = () => [...host().querySelectorAll(".drpg-popup:not(.leaving):not(.drpg-popup-parked)")];
        const all = () => [...host().querySelectorAll(".drpg-popup:not(.leaving)")];
        const text = c => c.querySelector(".drpg-popup-body")?.textContent.trim();
        const closers = [];
        try {
            for (const n of ["R109 one", "R109 two", "R109 three", "R109 four", "R109 five"]) {
                closers.push(showPopup(`<p>${n}</p>`, { title: "R109", record: false }));
                await wait(120);
            }
            equal(all().length, 5, "a notice was dismissed to make room");
            equal(text(shown()[0]), "R109 five", "the newest notice is not the first one shown");
            const waiting = all().length - shown().length;
            ok(waiting >= 1, "five notices all fit a stack that shows at most four");
            equal(host().querySelector(".drpg-popup-more")?.textContent, `+${waiting}`,
                "the stack does not say how many notices are waiting");

            // Close the newest: something that was waiting comes back, and none is lost.
            shown()[0].querySelector(".drpg-popup-close").click();
            // A waiting card takes the seat once the closed one has actually gone, after
            // its leaving transition - so this waits for a card to be shown again.
            await until(() => all().length === 4 && shown().length >= 1, 4000);
            equal(all().length, 4, "closing one notice took another with it");
            ok(shown().length >= 1 && !shown().some(c => text(c) === "R109 five"),
                "the closed notice is still on screen");
            if (waiting >= 1) ok(shown().some(c => text(c) === "R109 four"),
                "the newest waiting notice did not come back when a seat was free");
        } finally {
            for (const close of closers) { try { close?.(); } catch { /* already gone */ } }
            await wait(400);
            document.querySelectorAll("#drpg-popups .drpg-popup").forEach(c => c.remove());
        }
    }],

    ["R108 - what the table saw on 1.2.50 stays fixed", async () => {
        /*
         * Dawid's second look on 22.09, on Forge. Two of these were errors a live world
         * threw: the Item tables window, whose render had died since 1.2.44 on a name its
         * split-out helper never looked up, and the project token sync writing a world
         * setting before `ready`. R12 and the accessibility sweep DID open that window on
         * every run - and swallowed the render's rejection and never asked where the
         * window was, so a window pinned at 0,0 counted as measured. This asks. (R12 now
         * asks it of every standing window.) A source check alone would have passed the
         * broken file: it named the button, just in the wrong function.
         */
        const sources = new Map(await otherSources());
        const src = name => stripComments(sources.get(name) ?? "");

        // The Item tables window renders, so Foundry places it and it can be dragged.
        const { openItemTables } = await import("./tables.mjs");
        const tablesApp = () => [...foundry.applications.instances.values()]
            .find(a => a.element?.classList?.contains("drpg-window-tables"));
        const opening = openItemTables();   // held, not awaited - it resolves on close
        try {
            await until(() => tablesApp()?.element?.isConnected);
            await settle();
            const el = tablesApp()?.element;
            ok(el, "the Item tables window did not open");
            ok(el?.style.left && el?.style.top,
                "the Item tables window has no position - its render threw, which pins it to 0,0");
        } finally {
            try { await tablesApp()?.close(); } catch { /* already gone */ }
            try { await opening; } catch { /* closed rather than answered */ }
            await settle();
        }
        const heading = src("tables.mjs");
        const body = bodyOf(heading, "function wirePaneHeading(", { until: "\n}" });
        ok(/const renameButton = pane\.querySelector/.test(body) && /const deleteButton = pane\.querySelector/.test(body),
            "the table heading's buttons are used where nothing looks them up");

        // The project tokens wait for ready before they write.
        const map = src("projects-map.mjs");
        const sync = bodyOf(map, "export async function syncProjectTokens", { length: 900 });
        ok(/if \(!game\.ready\)/.test(sync), "the project sync writes a world setting before ready again");

        // A project's icon under the isometric view: smaller than the full picture that
        // overran its frame, larger than 1.2.51's 0.45 (Dawid, 22.09: "cos pomiedzy").
        const { PROJECT_TOKEN } = await import("./config.mjs");
        ok(PROJECT_TOKEN.isoScale > 0.45 && PROJECT_TOKEN.isoScale < 1,
            `the project icon is at ${PROJECT_TOKEN.isoScale}, not between 1.2.51's 0.45 and the full picture`);
        // ...and it is the project card's hammer, not Foundry's hazard sign (Dawid, 22.09).
        ok(PROJECT_TOKEN.icon.endsWith("/icons/remnant-project.svg"), "project tokens wear something other than the hammer");
        // The sync compares the tint as the hex a Color prints, or it writes every token every draw.
        ok(/String\(token\.texture\?\.tint/.test(map), "the project sync compares a Color object with a string again");

        // The clock's button is on its line; the matrix names lie down; the track has notes.
        const css = (await fetch(`/modules/${MODULE_ID}/styles/danganronpa.css`).then(r => r.text()))
            .replace(/\/\*[\s\S]*?\*\//g, " ");
        ok(/\.drpg-gmp-advance \{[^}]*display: inline-flex/.test(css),
            "the Next time of day button is a block of its own again");
        const head = bodyOf(css, ".drpg-viewer-head > span {", { until: ".drpg-viewer-tick {" });
        ok(head.length > 0 && !/writing-mode/.test(head), "the players' names stand on end again");
        ok(/fa-music/.test(src("hud.mjs")), "the track band has lost its notes");
        // The CALL, with its semicolon: `holdActionsTab(app, element)` alone also matches
        // the definition's own signature, and passed with the call deleted.
        ok(/function holdActionsTab\(/.test(src("sheet.mjs")) && /^\s*holdActionsTab\(app, element\);/m.test(src("sheet.mjs")),
            "nothing grows the glass sheet to hold its Actions tab");

        // The pause veil starts at the top of the screen: #pause is a <figure>, with a margin.
        // Measured on the element where the stylesheet cascades; where it does not (the
        // headless harness applies no stylesheet, and read jsdom's own "0" as a pass or
        // a figure's 16 px as a fail by accident of its markup), the rule itself is read.
        if (cascadeAvailable()) {
            equal(getComputedStyle(document.getElementById("pause")).marginTop, "0px",
                "the pause overlay is pushed down the screen by its own margin again");
        } else {
            const pauseRule = bodyOf(css, "#pause {", { until: "}" });
            ok(/\bmargin:\s*0\s*;/.test(pauseRule), "the pause overlay's rule no longer takes the figure's margin away");
        }

        // Foundry's selection is the interface colour, not its own orange.
        const { hourColour } = await import("./own-ring.mjs");
        equal(CONFIG.Canvas.dispositionColors.CONTROLLED, hourColour(),
            "a controlled border is not drawn in the interface colour");
        const drag = foundry.canvas.layers.ControlsLayer.prototype.drawSelect;
        ok(drag?.drpgPatched && !/0xFF9829/i.test(String(drag)),
            "the drag rectangle still has Foundry's orange written into it");
    }],

    ["R107 - the visual round of 22.09 stays put", async () => {
        /*
         * Dawid's list before the README screenshots, 22.09. Each of these was measured on
         * screen and fixed in one place; this holds that place, so a later edit cannot
         * quietly put the old shape back.
         */
        const sources = new Map(await otherSources());
        const src = name => stripComments(sources.get(name) ?? "");

        // The debate's clock is the trial card's line, not the campaign clock's.
        ok(/drpg-event-clock/.test(src("events.mjs")) && /paintTrialClock/.test(src("events.mjs")),
            "the trial card lost its countdown");
        ok(!/paintFloorClock|is-trial-clock/.test(src("hud.mjs")),
            "the campaign clock is drawing the debate's countdown again");

        // Who knows a project is a matrix, one column per player, in counting order.
        const projects = src("projects-ui.mjs");
        ok(/function viewerTicks\(/.test(projects) && /drpg-viewer-head/.test(projects),
            "the project manager lists viewers as a run of labels again");
        ok(/numeric: true/.test(projects), "players are listed in creation order, not counting order");

        // The stats' boxes take the slider, like the window they stand in.
        ok(/--drpg-slider-scale/.test(src("settings.mjs")), "the slider's own factor is no longer published");

        // The Despair names' column is the longest name's.
        ok(/function fitNameColumn\(/.test(src("despair.mjs")), "the Despair name column is a guess again");

        // The left rail: a player's starts where the GM's does; every control fits its strip.
        const glass = src("glass.mjs");
        ok(/GM_SLOT/.test(glass), "a player's rail starts on the clock's glass again");
        ok(/railEnd - boxTop/.test(glass), "the tools box is bounded to all the room above the notice tile again");
        ok(/r\.bottom\) - top/.test(glass), "the strip is cut to the tiles on screen, not to the box they can fill");
    }],

    ["R106 - every bullet Analyze can reach is rolled for", async () => {
        /*
         * Dawid, 21.09: "Analyze ma mieć rzut w każdym bullecie". Key, Autopsy and
         * Final answered `null`, the guide's "Bez rzutu", and `resolveAnalyze` read
         * that as a success on any throw - which was only harmless while none of
         * them had anything left to read. Every kind, every band, has a number now,
         * and a `null` that still arrives is scored as a miss, not a pass.
         */
        const { analyzeDc, ANALYZE_DC, TRUTH_BULLET_TYPES } = await import("./config.mjs");
        for (const band of Object.keys(ANALYZE_DC)) {
            for (const kind of Object.keys(TRUTH_BULLET_TYPES)) {
                ok(Number.isFinite(analyzeDc(band, kind)),
                    `a ${kind} bullet in the ${band} band is analysed without a roll`);
            }
        }
        equal(analyzeDc("evident", "final"), analyzeDc("evident", "key"), "a Final is not read like a Key");
        const { observeDc } = await import("./config.mjs");
        ok(observeDc("evident", "autopsy") === null,
            "an Autopsy became findable by Observe - New trace would offer to place one");

        const analyze = stripComments(new Map(await otherSources()).get("analyze.mjs") ?? "");
        ok(!/dc === null \|\|/.test(analyze), "a missing number is still a free pass");
        ok(/analysedFrom/.test(analyze),
            "a Reroll can no longer tell a Key that showed its kind from a Neutral one");
    }],

    ["every string the code asks for exists in the language file", () => {
        // The keys built at run time from a value this list names (see
        // LITERAL_KEYS below): R1 reads every key spelled out as a literal, and
        // cannot see these.
        const missing = [];
        for (const key of LITERAL_KEYS) {
            if (!game.i18n.has(key)) missing.push(key);
        }
        ok(!missing.length, `missing: ${missing.slice(0, 8).join(", ")}`);
    }],

    ["the Polish file covers every English key", async () => {
        // A language file that lags behind en.json shows a Polish GM one
        // English sentence in the middle of a card. Both files are fetched
        // fresh: the merged runtime table cannot tell which language a key
        // came from. Plural families may carry `few` and `many`; `DRPG.Config`
        // holds config.mjs's prose and has no twin in en.json by design.
        const { MODULE_ID } = await import("./config.mjs");
        const read = async lang => {
            const r = await fetch(`modules/${MODULE_ID}/lang/${lang}.json`);
            must(r.ok, `${lang}.json: HTTP ${r.status}`);
            return foundry.utils.expandObject(await r.json());
        };
        const flat = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) =>
            typeof v === "object" && v !== null ? flat(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]);
        const [en, pl] = await Promise.all([read("en"), read("pl")]);
        const enKeys = flat(en), plKeys = new Set(flat(pl));
        const missing = enKeys.filter(k => !plKeys.has(k));
        ok(!missing.length, `pl.json lacks: ${missing.slice(0, 8).join(", ")}`);
        const stray = [...plKeys].filter(k => !k.startsWith("DRPG.Config.") && !/\.(few|many)$/.test(k) && !enKeys.includes(k));
        ok(!stray.length, `pl.json has keys en.json does not: ${stray.slice(0, 8).join(", ")}`);
        // Every placeholder the English sentence carries, the Polish one must carry too -
        // except the article `{a}`, which Polish has no use for.
        const flatV = (o, p = "") => Object.entries(o ?? {}).flatMap(([k, v]) =>
            typeof v === "object" && v !== null ? flatV(v, p ? `${p}.${k}` : k) : [[p ? `${p}.${k}` : k, v]]);
        const plV = new Map(flatV(pl));
        const holes = [];
        for (const [k, v] of flatV(en)) {
            if (typeof v !== "string" || typeof plV.get(k) !== "string") continue;
            const want = (v.match(/\{\w+\}/g) ?? []).filter(h => h !== "{a}");
            const have = new Set(plV.get(k).match(/\{\w+\}/g) ?? []);
            for (const h of want) if (!have.has(h)) holes.push(`${k} ${h}`);
        }
        ok(!holes.length, `placeholders dropped: ${holes.slice(0, 6).join(", ")}`);
    }],

    /* ---- the audit of 1.2.27: the three things it could not check by reading ------------
       Each of these was a defect nobody saw until a screenshot arrived from a tablet, and
       each is cheap to measure on a live client. They only measure under the theme they
       are about, and under Monokuma Legacy they SAY so, as a skip. They used to `return`,
       which the runner prints as "ok" - so this comment's old claim that they "pass by
       saying so" was the one thing they never did (E01, 24.09.2026; audit S14-18). The
       loops below count what they measured, because a loop over nothing passes too. */
    ["the curtain cuts a clean partition", async () => {
        const { CHECKS, refreshGlass } = await import("./glass.mjs");
        needs(env.glass(), "this measures Stained Glass");
        needs(env.layout(), "the curtain's canvas has no width outside a browser");
        refreshGlass();
        await wait(300);
        const c = CHECKS[CHECKS.length - 1];
        ok(c, "the curtain never reported a self-check - it did not cut");
        ok(!c.overlaps && !c.nonconvex && !c.blockFails && !c.edgeGaps,
            `overlaps ${c.overlaps}, non-convex ${c.nonconvex}, blocks off their pane ${c.blockFails}, gaps at the edge ${c.edgeGaps}`);
    }],

    ["no chrome label is cut off", () => {
        needs(env.glass(), "this measures Stained Glass");
        needs(env.layout(), "a label's height needs a browser");
        // A box one pixel shorter than the text inside it is the "MUNUKUMA" defect: VT323's
        // capitals are tall for its em, and a box sized in another face clips them.
        const cut = [];
        let measured = 0;
        for (const sel of ["#drpg-hud", "#drpg-despair", "#drpg-player-status", "#drpg-events", "#countdowns"]) {
            const host = document.querySelector(sel);
            if (!host) continue;
            for (const el of host.querySelectorAll("div, span, b, h4")) {
                if (!el.offsetWidth || el.children.length) continue;
                measured++;
                if (getComputedStyle(el).overflow === "visible") continue;
                if (el.scrollHeight > el.clientHeight + 1) cut.push(`${sel} ${el.className || el.tagName} ${el.scrollHeight}>${el.clientHeight}`);
            }
        }
        ok(measured > 0, "no label in the chrome has a width - nothing was measured");
        ok(!cut.length, cut.slice(0, 4).join("; "));
    }],

    ["nothing in the chrome is set under the floor", () => {
        needs(env.glass(), "this measures Stained Glass");
        needs(env.layout(), "a label's size needs a browser");
        // 11 px, at every interface scale - see docs/design/typography.md.
        const floor = parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-sg-floor")) || 11;
        const small = [];
        let measured = 0;
        for (const sel of ["#drpg-hud", "#drpg-despair", "#drpg-player-status", "#drpg-events", "#countdowns", ".drpg-panel"]) {
            for (const host of document.querySelectorAll(sel)) {
                for (const el of host.querySelectorAll("*")) {
                    if (!el.offsetWidth || !el.textContent.trim() || el.matches("i, [class*='fa-']")) continue;
                    measured++;
                    const size = parseFloat(getComputedStyle(el).fontSize);
                    if (size && size < floor - 0.5) small.push(`${el.className || el.tagName} ${size.toFixed(1)}px`);
                }
            }
        }
        ok(measured > 0, "no text in the chrome has a width - nothing was measured");
        ok(!small.length, small.slice(0, 4).join("; "));
    }],

    ["the theme speaks two faces", () => {
        needs(env.glass(), "this measures Stained Glass");
        // Stained Glass is VT323 and Special Elite and nothing else (docs/design/typography.md):
        // the first family every module surface resolves to is one of the two. Icon elements
        // are their own face by design, and are skipped.
        /* A face is only a fact where the browser resolves one. jsdom answers
           `getComputedStyle(el).fontFamily` with the literal words "depends on user
           agent" on every element, which this read as the name of some other face
           and duly listed every element in the module - the four-item failure that
           stood in the accepted bucket for a year with those same words in it, and
           which nobody read closely enough to notice was jsdom talking. */
        needs(env.fonts(), "this needs a browser with the faces loaded");
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
        needs(env.glass(), "this measures Stained Glass");
        needs(env.layout(), "the curtain's canvas has no width outside a browser");
        // The bottom-left tile is part of the curtain's one shape, with or without a card on
        // it (1.2.36): a notice lands on glass that was already there.
        ok(LAST.blocks.length, "the curtain cut nothing in a browser that lays out");
        const tile = LAST.blocks.find(b => b.cls === "note-block");
        ok(tile, "no pane was cut for the notices");
        ok(tile.x === 16 && tile.w > 100, `the notice tile is at ${tile.x},${tile.y} ${tile.w}x${tile.h}`);
    }],

    ["R513 - the room tile is always cut: a fixed block at the box glass.mjs placed, in either place, its pane a section never painted empty", async () => {
        const { LAST } = await import("./glass.mjs");
        needs(env.glass(), "this measures Stained Glass");
        needs(env.layout(), "the curtain's canvas has no width outside a browser");
        needs(env.desk(), "a stacked screen gets the tile's place in E77 C8");
        // The room tile is part of the curtain's one shape too, in either of its places and whatever
        // the room says (E77 C4, 13.10.2026): a fixed block at the box glass.mjs placed, its pane a
        // section that is never painted as an empty one, since the tile has no plate of its own to
        // show. Its notice-tile twin above has no number because it is older than 1.2.61; a new
        // tier-1 test without one fails the registry, and R510-R512 are the E77 plan's for C5 and C6.
        ok(LAST.blocks.length, "the curtain cut nothing in a browser that lays out");
        const tile = LAST.blocks.find(b => b.cls === "room-block"), pane = (LAST.panes || []).find(p => p.tone === "room-block");
        ok(tile && LAST.room?.box, "no pane was cut for the room tile");
        const { x, y, w, h } = LAST.room.box;
        ok(tile.x === x && tile.y === y && tile.w === w && tile.h === h, `the room block is at ${tile.x},${tile.y} ${tile.w}x${tile.h}, the tile placed at ${x},${y} ${w}x${h}`);
        ok(pane?.kind === "section" && !pane.empty, `the room's pane is ${pane ? (pane.empty ? "painted empty" : pane.kind) : "missing"}`);
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
        // A world with no trace on any scene has nothing here to read (E30 review, 25.09.2026).
        needs(world.atLeast("remnantTokens"), "the scan reads every trace token");
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
        needs(world.atLeast("remnantTokens"), "the scan reads every trace token's name");
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
        /* Every assertion below runs once per account voiceTargets places, and it
           places a connected player's character, a Monokuma whose pool a connected GM
           holds, and during an Eclipse everybody (voice.mjs) - so in a world with none
           of those this FAILed "measured nothing" (E30 review, 25.09.2026). The accounts
           this is about are the players', asked of the world first: with no player
           connected it skips, even where a GM's pool would still be placed (the harness
           with its three players gone: the GM alone, placed). */
        needs(world.atLeast("connectedPlayersWithCharacter"), "voiceTargets places a connected player's character");
        const { rows, byUser } = await voiceTargets();
        ok(byUser.size > 0, "voiceTargets places none of the connected players who own a character");

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
        // A world with no role on any item has nothing here to read (E30 review, 25.09.2026).
        needs(world.atLeast("itemsWithRoles"), "the scan reads the roles items carry");
        const known = new Set(Object.keys(ITEM_CATEGORIES));
        const wrong = [];
        let read = 0;
        for (const actor of game.actors) {
            for (const item of actor.items) {
                for (const role of rolesOf(item)) {
                    read++;
                    if (!known.has(role)) wrong.push(`${actor.name}/${item.name}: "${role}"`);
                }
            }
        }
        ok(read > 0, "rolesOf reads no role off the items whose flag names one");
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
        /* The guard asks the element whether a transition is running, through the Web
           Animations API; where that API is missing it falls back to Foundry's wait, as
           it should - so the timing is a question only a browser with the API can answer
           (E01, 24.09.2026: jsdom has neither, and the close waited its full second). */
        needs(env.webAnimations(), "whether a transition is running cannot be asked");
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
    }],

    ["R132 - Daggerheart's GM relay has the guard in front of it", async () => {
        /*
         * E03, 24.09.2026; audit S16-01. Daggerheart's relay does not ask who sent a
         * request. relay-guard.mjs takes its listener off the channel at `init` and
         * judges every packet first. A table where the guard found nothing to wrap
         * FAILS here: that is the hazard itself, not a fact about the environment.
         */
        const { relayGuardStatus, REVIEWED_CASES } = await import("./relay-guard.mjs");
        const status = relayGuardStatus();
        ok(["ok", "unnamed", "changed", "backstop"].includes(status.state),
            `Daggerheart's relay is not guarded on this table: "${status.state}"`);
        if (status.state !== "backstop") ok(status.wrapped >= 1, "the guard reports no listener wrapped");
        if (status.state === "ok") {
            ok(status.fingerprint.length > 0 && status.fingerprint.every(name => REVIEWED_CASES.includes(name)),
                `the listener handles cases nobody reviewed: ${status.fingerprint.join(", ")}`);
        } else {
            ok(status.state !== "changed" || status.unreviewed.length > 0 || !status.fingerprint.length,
                "the guard calls the relay changed without saying what changed");
        }
    }],

    ["R133 - the relay passes what Daggerheart sends for a player, and nothing else", async () => {
        /*
         * E03, 24.09.2026; audit S16-01. `judgeRelay` asked about made-up packets and a
         * made-up world, so every row of the table in relay-guard.mjs is held to it:
         * the shapes only a console makes are refused, and each shape Daggerheart
         * really sends for a player (read off 2.10.5, checked against 2.6.5) still passes.
         */
        const { judgeRelay } = await import("./relay-guard.mjs");
        const player = { id: "SUITEPLAYER00001", name: "Suite player", isGM: false };
        const owns = doc => ({ testUserPermission: user => user?.id === player.id, ...doc });
        const not = doc => ({ testUserPermission: () => false, ...doc });
        const res = { hope: { value: 2, max: 6 }, hitPoints: { value: 3, max: 6 } };
        const docs = {
            mine: owns({ documentName: "Actor", type: "character", name: "Mine", system: { resources: res } }),
            theirs: not({ documentName: "Actor", type: "character", name: "Theirs", system: { resources: res } }),
            foe: not({ documentName: "Actor", type: "adversary", name: "Foe", system: { resources: res } }),
            user: { documentName: "User", name: "Suite player" },
            knife: owns({ documentName: "Item", name: "Knife", parent: { documentName: "Actor" } }),
            party: not({ documentName: "Actor", type: "party", name: "Party", system: { partyMembers: ["mine"] } }),
            scene: { documentName: "Scene", name: "Floor", flags: { daggerheart: { sceneEnvironments: ["a", "b"] } } },
            oddScene: { documentName: "Scene", name: "Odd floor", flags: { daggerheart: { sceneEnvironments: [["a"], ["b"]] } } }
        };
        const countdowns = { countdowns: {
            P1: { name: "Project", progress: { current: 2, start: 6, type: "custom", looping: "noLooping" } },
            T1: { name: "Tick", progress: { current: 3, start: 6, type: "actionRoll", looping: "noLooping" } },
            O1: { name: "Owned", progress: { current: 3, start: 6, type: "custom", looping: "noLooping" } }
        } };
        const world = {
            doc: uuid => docs[uuid] ?? null,
            countdowns: () => foundry.utils.deepClone(countdowns),
            isProject: id => id === "P1",
            levelOf: id => (id === "O1" ? 3 : 2),
            automationOn: () => true,
            fear: () => 4,
            fearSteps: () => 1,
            fearChangedAt: () => 0,
            changedAt: () => 0,
            message: id => (id === "M1" ? { id: "M1" } : null),
            tokenFor: (message, tokenId) => (tokenId === "TOKMINE" ? { actor: docs.mine } : tokenId === "TOKTHEIRS" ? { actor: docs.theirs } : null),
            now: () => 1e12
        };
        const judge = (action, data) => judgeRelay({ action, data }, player, world);
        const doc = (uuid, data) => judge("DhGMUpdate", { action: "DhGMUpdateDocument", uuid, data });
        const snapshot = change => {
            const copy = foundry.utils.deepClone(countdowns);
            change(copy.countdowns);
            return judge("DhGMUpdate", { action: "DhGMUpdateCountdowns", data: copy });
        };

        const refused = {
            "a player's own role": doc("user", { role: 4 }),
            "ownership on their own character": doc("mine", { "ownership.SUITEPLAYER00001": 3 }),
            "another student's Health": doc("theirs", { "system.resources.hitPoints.value": 0 }),
            "their own Hope above its maximum": doc("mine", { "system.resources.hope.value": 9 }),
            "an item's name": doc("knife", { name: "Spoon" }),
            "a module flag on an item": doc("knife", { "flags.danganronpa-rpg.playerText": "x" }),
            "a scene's environments replaced": doc("scene", { "flags.daggerheart.sceneEnvironments": ["a", "z"] }),
            // E75 fix r2-G1 (review cor F1, sec T3): the scene's own environments, as entries that are
            // not plain identifiers, were compared as text and forwarded as a reordering.
            "a scene's environments as entries that are not plain identifiers": doc("scene", { "flags.daggerheart.sceneEnvironments": [["b"], ["a"]] }),
            "a scene's environments as entries nested deeper": doc("scene", { flags: { daggerheart: { sceneEnvironments: [[["a"]], "b"] } } }),
            "a scene whose stored environments are not plain identifiers": doc("oddScene", { "flags.daggerheart.sceneEnvironments": ["b", "a"] }),
            "a setting": judge("DhGMUpdate", { action: "DhGMUpdateSetting", uuid: "Automation", data: {} }),
            "an effect": judge("DhGMUpdate", { action: "DhGMUpdateEffect", uuid: "mine", data: {} }),
            "Countdowns as {}": judge("DhGMUpdate", { action: "DhGMUpdateCountdowns", data: {} }),
            "Countdowns emptied": judge("DhGMUpdate", { action: "DhGMUpdateCountdowns", data: { countdowns: {} } }),
            "a Project's progress": snapshot(all => { all.P1.progress.current = 6; }),
            "a new countdown": snapshot(all => { all.N1 = { name: "New", progress: { current: 1, start: 1, type: "custom" } }; }),
            "a save for somebody else's token": judge("DhGMUpdate", { action: "DhGMUpdateSaveMessage",
                data: { message: "M1", token: "TOKTHEIRS", result: { roll: { total: 12 } } } }),
            "a new User": judge("DhGMCreate", { documentType: "User", data: {} }),
            "a new ChatMessage": judge("DhGMCreate", { documentType: "ChatMessage", data: {} }),
            "a new Actor": judge("DhGMCreate", { documentType: "Actor", data: {} }),
            "a Region": judge("DhGMCreate", { documentType: "Region", data: {} }),
            "an unknown sub-action": judge("DhGMUpdate", { action: "DhGMUpdateSomethingNew", data: {} })
        };
        const let_through = Object.entries(refused).filter(([, v]) => v.verdict !== "refuse").map(([k, v]) => `${k} (${v.verdict})`);
        ok(!let_through.length, `the relay let these through: ${let_through.join("; ")}`);
        for (const name of Object.keys(refused).filter(k => k.startsWith("a scene"))) {
            ok(/which is not a reordering$/.test(refused[name].why ?? ""), `${name} is not refused as "not a reordering": ${refused[name].why}`);
        }
        // What Daggerheart itself sends is REFUSED, never called forged (the E03 review:
        // a player's healing ability on a classmate was reported to the GM as a forgery).
        equal(refused["a Region"].kind, "refused", "a player's Region is called forged rather than kept to the GM");
        equal(refused["another student's Health"].kind, "refused", "a player's ability on a classmate is called forged");
        equal(refused["a new countdown"].kind, "refused", "a countdown a Daggerheart ability starts is called forged");
        equal(refused["a player's own role"].kind, "forged", "a role change is not called forged");

        // A save whose dialog was closed arrives with no roll, and is nothing to mark.
        for (const result of [undefined, {}, { roll: {} }, { roll: { total: null } }]) {
            equal(judge("DhGMUpdate", { action: "DhGMUpdateSaveMessage", data: { message: "M1", token: "TOKMINE", result } }).verdict,
                "drop", `a save with no roll (${JSON.stringify(result)}) is not a quiet drop`);
        }
        // Fear is never rationed: a busy player is pointed out, and the step still lands.
        const busyWorld = { ...world, fearSteps: () => 9 };
        const busy = judgeRelay({ action: "DhGMUpdate", data: { action: "DhGMUpdateFear", data: 5 } }, player, busyWorld);
        ok(busy.verdict === "own" && busy.ops?.[0]?.step === 1 && busy.busy === 9,
            `a player's ninth Fear step in ten seconds is refused or not pointed out: ${JSON.stringify(busy)}`);
        ok(!judge("DhGMUpdate", { action: "DhGMUpdateFear", data: 5 }).busy, "a player's first Fear step is pointed out as busy");

        const passed = {
            "their own Hope": doc("mine", { "system.resources.hope.value": 1 }),
            "an adversary their attack hit": doc("foe", { "system.resources.hitPoints.value": 1 }),
            "their own item's quantity": doc("knife", { "system.quantity": 0 }),
            "the scene's environments reordered": doc("scene", { "flags.daggerheart.sceneEnvironments": ["b", "a"] }),
            "a group roll on their party": doc("party", { "system.groupRoll.aidedBy": "x" }),
            "a save for their own token": judge("DhGMUpdate", { action: "DhGMUpdateSaveMessage",
                data: { message: "M1", token: "TOKMINE", result: { roll: { total: 12, isCritical: false } } } }),
            "Fear by one": judge("DhGMUpdate", { action: "DhGMUpdateFear", data: 5 }),
            "a countdown the rules tick": snapshot(all => { all.T1.progress.current = 2; }),
            "a countdown they own": snapshot(all => { all.O1.progress.current = 4; })
        };
        const stopped = Object.entries(passed).filter(([, v]) => v.verdict !== "forward" && v.verdict !== "own")
            .map(([k, v]) => `${k} (${v.verdict}: ${v.why})`);
        ok(!stopped.length, `the relay refused what Daggerheart sends for a player: ${stopped.join("; ")}`);
        equal(JSON.stringify(Object.keys(passed["their own Hope"].packet.data.data)), JSON.stringify(["system.resources.hope.value"]),
            "the packet passed on carries more than the one allowed field");
        equal(judge("DhGMUpdate", { action: "DhGMUpdateFear", data: 12 }).ops?.[0]?.step, 1, "a Fear packet asking for +8 moves Fear by more than one");
        const tick = passed["a countdown the rules tick"].ops?.[0]?.deltas ?? [];
        equal(JSON.stringify(tick), JSON.stringify([{ id: "T1", current: -1, start: 0 }]), "the tick is not applied as the one difference it is");
    }],

    ["R136 - a sabotage is taken back only as the pair it wrote", async () => {
        /*
         * E03, 24.09.2026; audit S10-03, S09-02. `undoSabotage` deleted whatever id
         * arrived as the repair - a secret murder plan included.
         */
        const { unsabotageRefusal } = await import("./projects.mjs");
        const meta = { T: { frozenBy: "R" }, R: { repairs: "T", saboteur: "U1" }, X: {},
            Y: { frozenBy: "R2" }, R2: { repairs: "Z" } };
        const ask = (targetId, repairId, senderId = null) => unsabotageRefusal({ targetId, repairId, senderId, meta: id => meta[id] ?? {} });
        ok(ask("T", null), "a thaw with no repair is taken");
        ok(ask(null, "R"), "a repair with no target is taken");
        ok(ask("T", "X"), "a project that is not the repair is deleted as one");
        ok(ask("X", "R"), "a repair is taken back for a project it does not repair");
        ok(ask("Y", "R2"), "a repair is taken back for a project it froze but does not repair");
        ok(ask("T", "R", "U2"), "somebody else's sabotage is taken back");
        ok(!ask("T", "R", "U1"), "the saboteur's own pair is refused");
        ok(!ask("T", "R"), "the GM's own undo of the pair is refused");
    }],

    ["R137 - an Observe key is one character's, one account's, once", async () => {
        /*
         * E03, 24.09.2026; audit S05-03. A key read off another character's Reroll
         * bookmark deleted that character's Truth Bullet and charged them the Sanity.
         */
        const { observeResolveRefusal } = await import("./observe.mjs");
        const entry = { actorId: "A1", by: "U1" };
        ok(observeResolveRefusal(entry, { actorId: "A2", senderId: "U2" }), "another character resolves the key");
        ok(observeResolveRefusal(entry, { actorId: "A1", senderId: "U2" }), "another account resolves the key");
        ok(observeResolveRefusal({ ...entry, result: { success: true } }, { actorId: "A1", senderId: "U1" }), "a key resolves twice");
        ok(observeResolveRefusal(entry, { actorId: "A1", senderId: "U1", undo: true }), "an undo with nothing to undo is taken");
        ok(!observeResolveRefusal(entry, { actorId: "A1", senderId: "U1" }), "the owner's own resolve is refused");
        ok(!observeResolveRefusal({ ...entry, result: {} }, { actorId: "A1", senderId: "U1", undo: true }), "the owner's own undo is refused");
        ok(!observeResolveRefusal(entry, { actorId: "A1", senderId: "G1", senderIsGm: true }), "a GM resolving it is refused");
    }],

    ["R139 - a player arms only a Support on somebody else", async () => {
        /* E03, 24.09.2026; audit S10-09: a Monokuma's Obstacle from a player's console. */
        const { playerArmRefusal } = await import("./call-effects.mjs");
        ok(playerArmRefusal({ key: "obstacle", grants: "disadvantage" }), "a Despair Call is armed from a player");
        ok(playerArmRefusal({ key: "experience", grants: "experience" }), "a Call aimed at nobody else is armed on somebody else");
        ok(playerArmRefusal({ key: "support", grants: "critical" }), "a Support is armed with somebody else's grant");
        ok(!playerArmRefusal({ key: "support", grants: HOPE_CALLS.support?.grants }), "a Support is refused");
    }],

    ["R140 - a player's trace is written from what the GM knows", async () => {
        /* E03, 24.09.2026; audit S05-13, S10-10. `narrowPlayerRemnant`, field by field. */
        const { narrowPlayerRemnant } = await import("./remnants.mjs");
        const item = id => ({ getFlag: (scope, key) => (key === "drpgItemId" ? id : null) });
        const actor = { id: "A1", name: "Aiko", items: [item("KNIFE")] };
        const where = { room: "Gym", scene: { id: "S1" }, tokenDoc: { x: 100, y: 200 } };
        const clock = { chapter: 2, day: 3, timeOfDay: "night" };
        const forged = { sourceActor: "A1", sourceName: "Botan", room: "Hall", sceneId: "S9", x: 9, y: 9,
            pointsAt: "C1", type: "key", visibility: "evident", faint: false, reinforced: true, tiedToCrime: true,
            action: "search", note: "n".repeat(1000), subject: "s".repeat(200), itemIdentity: "SPOON" };
        const { data } = narrowPlayerRemnant(forged, actor, where, clock);
        ok(data, "an honest band was refused");
        equal(data.sourceName, "Aiko", "who left it came from the packet");
        equal(`${data.room}|${data.sceneId}|${data.x}|${data.y}`, "Gym|S1|100|200", "where it lies came from the packet");
        equal(data.pointsAt, null, "what it points at came from the packet");
        equal(data.type, "prep", "a player planted a Key Remnant");
        equal(data.reinforced, false, "a player planted a reinforced trace");
        equal(data.tiedToCrime, null, "a player decided the trace is the crime's");
        equal(data.faint, true, "a Search's trace is not Faint, as every Search's is");
        equal(data.itemIdentity, null, "an item the character does not hold is named on the trace");
        equal(`${data.note.length}|${data.subject.length}`, "400|80", "the words are not bounded");
        equal(narrowPlayerRemnant({ ...forged, itemIdentity: "KNIFE" }, actor, where, clock).data.itemIdentity, "KNIFE",
            "the item the character does hold is dropped");
        ok(narrowPlayerRemnant({ ...forged, visibility: "x" }, actor, where, clock).refused, "a visibility that does not exist is taken");
        ok(narrowPlayerRemnant(forged, actor, null, clock).refused, "a character with no token leaves a trace somewhere");
    }],

    ["R141 - a token is sent back only to where it stood a moment ago", async () => {
        /* E03, 24.09.2026; audit S10-40: `token.sendBack` was a free teleport. */
        const { sendBackRefusal } = await import("./movement.mjs");
        const scene = { dimensions: { width: 4000, height: 3000 } };
        const now = 1e12;
        const history = [{ x: 300, y: 300, elevation: 0, level: undefined, at: now - 5000 }];
        ok(!sendBackRefusal({ x: 300, y: 300 }, { scene, history, now }), "the place it just left is refused");
        ok(sendBackRefusal({ x: 900, y: 300 }, { scene, history, now }), "a place it never stood is taken");
        ok(sendBackRefusal({ x: 300, y: 300 }, { scene, history: [{ ...history[0], at: now - 120_000 }], now }), "a place two minutes old is taken");
        ok(sendBackRefusal({ x: 5000, y: 300 }, { scene, history, now }), "a place off the scene is taken");
        ok(sendBackRefusal({ x: 300, y: 300, elevation: 50 }, { scene, history, now }), "another elevation is taken");
        ok(sendBackRefusal({ x: 300, y: 300, level: "bogus" }, { scene, history, now }), "a level it was not on is taken");
        ok(sendBackRefusal({ x: "a", y: 300 }, { scene, history, now }), "a position that is not a number is taken");
        // MAP-11's fallback: the centre of a room the token stood in this minute.
        const centres = [{ x: 1250, y: 250 }];
        ok(!sendBackRefusal({ x: 1250, y: 250 }, { scene, history, centres, now }), "the centre of a room it paid for is refused");
        ok(sendBackRefusal({ x: 1250, y: 250, elevation: 90 }, { scene, history, centres, now }), "a room's centre at another elevation is taken");
        ok(sendBackRefusal({ x: 1260, y: 250 }, { scene, history, centres, now }), "a spot beside a room's centre is taken");
    }],

    ["R142 - a search, a used item and a fog reply are judged on the GM", async () => {
        /* E03, 24.09.2026; audit S01-10, S07-03, S08-08, S07-17. */
        const { searchSpendRefusal } = await import("./search-tokens.mjs");
        const gmUser = { id: "G1", isGM: true };
        const stranger = { id: "U9", isGM: false };
        const actor = { id: "NOSUCHACTOR00001" };
        ok(searchSpendRefusal({ sender: stranger, actor, where: { room: "Gym" }, roomName: "Gym" }), "a character the sender does not play searches");
        ok(searchSpendRefusal({ sender: gmUser, actor, where: { room: "Hall" }, roomName: "Gym" }), "a room the character is not in is searched");
        ok(!searchSpendRefusal({ sender: gmUser, actor, where: { room: "Gym" }, roomName: "Gym" }), "the room the character is in is refused");

        const { usedItemRefusal } = await import("./traps.mjs");
        const { TRAP_TRIGGERS } = await import("./config.mjs");
        const holder = { id: "A1", items: [{ getFlag: (scope, key) => (key === "drpgItemId" ? "ID1" : null) }] };
        const itemTrap = { trigger: { kind: Object.keys(TRAP_TRIGGERS).find(k => TRAP_TRIGGERS[k].watch === "item") } };
        const roomTrap = { trigger: { kind: Object.keys(TRAP_TRIGGERS).find(k => TRAP_TRIGGERS[k].watch === "crossing") } };
        const owns = (user, id) => user?.id === "U1" && id === "A1";
        const player = { id: "U1", isGM: false };
        ok(!usedItemRefusal({ author: player, actor: holder, used: { id: "ID1" }, trap: itemTrap, owns }), "the honest card is refused");
        ok(usedItemRefusal({ author: stranger, actor: holder, used: { id: "ID1" }, trap: itemTrap, owns }), "a card about somebody else's character sets a trap off");
        ok(usedItemRefusal({ author: player, actor: holder, used: { id: "ID2" }, trap: itemTrap, owns }), "an item the character does not hold sets a trap off");
        ok(usedItemRefusal({ author: player, actor: holder, used: { id: "ID1" }, trap: roomTrap, owns }), "a trap that watches a room takes an item card");

        const { fogShareRefusal } = await import("./fog.mjs");
        const now = 1e12;
        ok(fogShareRefusal({ sender: player, askedAt: 0, answered: new Set(), now }), "a reply nobody asked for is taken");
        ok(fogShareRefusal({ sender: player, askedAt: now - 60_000, answered: new Set(), now }), "a reply a minute late is taken");
        ok(fogShareRefusal({ sender: player, askedAt: now - 1000, answered: new Set(["U1"]), now }), "a second reply is taken");
        ok(!fogShareRefusal({ sender: player, askedAt: now - 1000, answered: new Set(), now }), "the reply asked for is refused");
    }],

    ["R148 - a Reroll lifts only a fresh trace nobody has found, and Tamper lists only what you know", async () => {
        /*
         * E03, 24.09.2026; audit S05-13 and S05-04. The two reads a player's console
         * turned into tools: `remnant.edit` with `remove` took a killer's own incident
         * trace off the map mid-investigation, and `mine: false` handed anybody the
         * whole room's traces with their types.
         */
        const { removalRefusal } = await import("./gm-bridge.mjs");
        const now = 1e12;
        const fresh = { _stats: { createdTime: now - 60_000 } };
        ok(!removalRefusal(fresh, { now }), "a fresh trace of your own is not lifted by your Reroll");
        ok(removalRefusal(fresh, { now, gmEdited: true }), "a trace a GM wrote on is lifted");
        ok(removalRefusal(fresh, { now, copied: true }), "a trace somebody found is lifted");
        ok(removalRefusal({ _stats: { createdTime: now - 3 * 3600_000 } }, { now }), "a trace three hours old is lifted");
        ok(!removalRefusal({}, { now, placedAt: now - 60_000 }), "a trace the ledger says was left a minute ago is not lifted");
        ok(removalRefusal(fresh, { now, placedAt: now - 3 * 3600_000 }), "the ledger's three-hour-old date loses to the token's");
        ok(removalRefusal({}, { now }), "a trace nobody wrote the age of is lifted");
        ok(removalRefusal(fresh, { now, restored: true }), "a trace a cleanup Reroll put back is lifted");

        const { cleanableTracesForPlayer, isCleaner } = await import("./cleanup.mjs");
        needs(world.atLeast("studentTokensOnScreen"), "a student with a token has to ask for the room");
        const student = studentActors().find(a => canvas?.scene?.tokens?.some(t => t.actorId === a.id) && !isCleaner(a));
        ok(student, "every student with a token on the scene on screen reads as cleaning a crime scene (isCleaner)");
        equal(JSON.stringify(cleanableTracesForPlayer(student.id, { mine: false })),
            JSON.stringify(cleanableTracesForPlayer(student.id, { mine: true })),
            "a student who is not cleaning a crime scene is handed the whole room by asking for it");
    }],

    ["R149 - every Despair pool is shown under its own name, a lone one included", async () => {
        /*
         * 24.09.2026, reported from a table that went from two GMs to one: the only
         * pool's row read "Despair" instead of the name the GM gave it in Despair
         * Flow - a rule for one pool, not a regression, and not what anybody wanted.
         * Drawing the bar touches the page only, not the world, so this draws it and
         * reads each row as the table sees it. Measured before the fix in the
         * headless harness (one GM, one pool): the row read "Despair".
         */
        const D = await import("./despair.mjs");
        // The world is asked, then the module: a full GM with no pool is monokumas() failing, not a skip.
        needs(world.atLeast("fullGms"), "a Despair pool belongs to a full Gamemaster account");
        const pools = D.monokumas();
        ok(pools.length > 0, "a full Gamemaster account exists and monokumas() finds no pool");
        D.renderDespairBar();
        const rows = [...document.querySelectorAll("#drpg-despair .drpg-despair-row")];
        const shown = rows.map(row => row.querySelector(".drpg-despair-name")?.textContent ?? null);
        equal(JSON.stringify(shown), JSON.stringify(pools.map(user => D.poolLabel(user))),
            "a pool's row does not carry that pool's name");
    }],

    ["R150 - a crisis action is taken back as it was taken, not as it left things", async () => {
        /*
         * E03 second review, 24.09.2026. The first E03 build judged a player's crisis
         * undo against the live incident, which the action itself had moved: a
         * successful Role reversal swaps the seats, Survive ends the incident, so
         * the honest Reroll of either was refused. `crisisUndoRefusal` asked about
         * made-up incidents: the receipt's own state decides, and only a GM's later
         * move refuses.
         */
        const { crisisUndoRefusal } = await import("./murder.mjs");
        const V = { id: "SUITEVICTIM00001" };
        const K = { id: "SUITEKILLER00001" };
        const taken = { stage: "incident", killerId: K.id, victimId: V.id, turnSide: "victim" };
        const last = (actor, key, after) => ({ actorId: actor.id, key, state: taken, after });
        const moves = (over = {}) => ({ stage: "incident", endedBy: null, turn: 2, turnSide: "killer",
            killerTurnId: null, thirdId: null, ...over });

        const swapped = { stage: "incident", killerId: V.id, victimId: K.id, turn: 2, turnSide: "killer",
            lastCrisis: last(V, "roleReversal", moves()) };
        ok(!crisisUndoRefusal(V, "roleReversal", swapped), "the victim's own successful Role reversal cannot be rerolled");
        const survived = { stage: "resolution", endedBy: "survive", killerId: K.id, victimId: V.id, turn: 2, turnSide: "killer",
            lastCrisis: last(V, "survive", moves({ stage: "resolution", endedBy: "survive" })) };
        ok(!crisisUndoRefusal(V, "survive", survived), "a Survive that ended the incident cannot be rerolled");
        const legacy = { stage: "incident", killerId: K.id, victimId: V.id, lastCrisis: last(V, "roleReversal", undefined) };
        ok(!crisisUndoRefusal(V, "roleReversal", legacy), "a receipt from before this build is refused");

        ok(crisisUndoRefusal(V, "survive", { ...survived, endedBy: "gm" }), "an undo after a GM moved the incident on is taken");
        ok(crisisUndoRefusal(V, "roleReversal", { ...swapped, turnSide: "victim", turn: 3 }), "an undo after a GM's Pass is taken");
        ok(crisisUndoRefusal(V, "roleReversal", { ...swapped, thirdId: "SUITETHIRD000001" }), "an undo after a third party walked in is taken");
        ok(crisisUndoRefusal(K, "survive", survived), "another character takes back the victim's action");
        ok(crisisUndoRefusal(V, "roleReversal", survived), "a Reroll takes back an action that was not the last one");
        ok(crisisUndoRefusal(V, "finishingBlow", { ...swapped, lastCrisis: last(V, "finishingBlow", moves()) }),
            "the victim takes back a killer's action they could not have taken");
        ok(crisisUndoRefusal(V, "survive", { ...survived, lastCrisis: { ...survived.lastCrisis, state: { ...taken, stage: "opening" } } }),
            "an action recorded outside the incident stage is taken back");
        ok(crisisUndoRefusal(V, "survive", { stage: "incident" }), "an undo with no receipt at all is taken");
    }],

    ["R153 - an Assistant's relay packet is judged like a player's", async () => {
        /*
         * E30, 24.09.2026. Only a full Gamemaster's request goes to Daggerheart's
         * handler unjudged; an Assistant GM's is judged by the table a player's is.
         * Daggerheart makes an Assistant's own changes on the Assistant's client, so
         * none of its own comes over the relay. Asked of the module's own two
         * functions, with made-up users and a made-up world; the relay with an
         * Assistant at the table is 17-assistant's (C2, C3).
         */
        const { forwardsUnjudged, judgeRelay } = await import("./relay-guard.mjs");
        const R = CONST.USER_ROLES;
        const gamemaster = { id: "SUITEGM000000001", name: "Suite GM", role: R.GAMEMASTER, isGM: true };
        const assistant = { id: "SUITEASSIST00001", name: "Suite Assistant", role: R.ASSISTANT, isGM: true };
        const player = { id: "SUITEPLAYER00001", name: "Suite player", role: R.PLAYER, isGM: false };
        equal(JSON.stringify([gamemaster, assistant, player].map(user => forwardsUnjudged(user))), JSON.stringify([true, false, false]),
            "who goes to Daggerheart unjudged, of a Gamemaster, an Assistant and a player");

        const docs = {
            self: { documentName: "User", name: "Suite Assistant" },
            mine: { documentName: "Actor", type: "character", name: "Mine", testUserPermission: () => true,
                system: { resources: { hope: { value: 2, max: 6 } } } }
        };
        const world = { doc: uuid => docs[uuid] ?? null, now: () => 1e12 };
        const verdict = (action, data) => judgeRelay({ action, data }, assistant, world).verdict;
        equal(verdict("DhGMUpdate", { action: "DhGMUpdateDocument", uuid: "self", data: { role: 4 } }), "refuse",
            "an Assistant's request to change a user");
        equal(verdict("DhGMCreate", { documentType: "User", data: { name: "Suite user", role: 4 } }), "refuse",
            "an Assistant's request to create a user");
        equal(verdict("DhGMUpdate", { action: "DhGMUpdateDocument", uuid: "mine", data: { "system.resources.hope.value": 1 } }), "forward",
            "an Assistant's request in a shape Daggerheart sends for a player");

        /* AND THE TWO PLACES THAT ASK IT (E30 review, 25.09.2026). E30 made the change
           where the guard decides - `neutralise` and `onRelay` - and the verdicts above read
           the same before it. So each is read here: it asks forwardsUnjudged(sender) before
           judgeRelay, and names no sender.isGM. */
        const guard = stripComments(new Map(await otherSources()).get("relay-guard.mjs") ?? "");
        for (const name of ["neutralise", "onRelay"]) {
            const body = fnSource(guard, name);
            const asks = body.indexOf("forwardsUnjudged(sender)"), judges = body.indexOf("judgeRelay(");
            ok(asks > 0 && judges > asks, `${name} does not ask forwardsUnjudged(sender) before judgeRelay`);
            ok(!/\bsender\.isGM\b/.test(body), `${name} decides on sender.isGM`);
        }
    }],

    ["R343 - a packet the relay's backstop refuses names nothing Daggerheart's listener dispatches on", async () => {
        /*
         * E75 C3, 10.10.2026; census B01-B05. The backstop (relay-guard.mjs `installBackstop`)
         * refuses a packet in place, and Daggerheart's listener gets the same object after it.
         * From 2.10.10 that listener runs a name it has no case for by the packet's
         * `data.action` (2.10.11 socket.mjs:36-37), and its GMUpdate entry switches on
         * `data.action` once more; its countdown entry is filed under `socketEvent.AddCountdown`,
         * which that file does not declare, so a `data` with no `action` reaches it under the key
         * "undefined" (read in the code, 10.10.2026). Before C3 a refusal renamed `action`
         * alone. Each shape a player's packet comes in is handed to `disarm` here, and neither
         * its `action` nor its `data.action` may then be a name of that listener's: a case, a
         * table key or a GMUpdate entry's case. Pure: made-up packets, nothing sent.
         */
        const { disarm } = await import("./relay-guard.mjs");
        equal(typeof disarm, "function", "relay-guard.mjs's way for the backstop to refuse a packet");
        const dispatched = new Set(["DhGMUpdate", "DhGMCreate", "DhRefresh", "DhAddCountdowns", "DhFearUpdate", "DowntimeTrigger",
            "DhTagTeamStart", "DhGroupRollStart", "DhTransferItem", "undefined", "DhGMUpdateDocument", "DhGMUpdateEffect",
            "DhGMUpdateSetting", "DhGMUpdateFear", "DhGMUpdateCountdowns", "DhGMUpdateSaveMessage"]);
        const shapes = {
            GMUpdate: { action: "DhGMUpdate", data: { action: "DhGMUpdateDocument", uuid: "Actor.SUITEACTOR0000001", data: { name: "Suite" } } },
            GMCreate: { action: "DhGMCreate", data: { documentType: "User", data: { name: "Suite user", role: 4 } } },
            TransferItem: { action: "DhTransferItem", data: { item: "Item.SUITEITEM00000001", targetActor: "Actor.SUITEACTOR0000001", quantity: 1 } },
            unknownName: { action: "SuiteUnknown", data: { action: "DhGMUpdate", data: { action: "DhGMUpdateFear", data: 0 } } },
            noAction: { data: { data: { countdowns: [{ name: "Suite countdown" }] } } }
        };
        const named = Object.entries(shapes).flatMap(([shape, packet]) => {
            disarm(packet);
            return [packet.action, packet.data?.action].map(String).filter(name => dispatched.has(name)).map(name => `${shape}: ${name}`);
        });
        equal(JSON.stringify(named), "[]", "the names a refused packet still carries that Daggerheart's listener dispatches on");
        // The backstop's catch hands it whatever arrived.
        const thrown = [null, undefined, "DhGMUpdate", 7].map(odd => {
            try { disarm(odd); return null; } catch (err) { return String(err?.message ?? err); }
        });
        equal(JSON.stringify(thrown), JSON.stringify([null, null, null, null]), "what disarm throws for a packet that is not an object");

        /* AND EVERY REFUSAL OF THE BACKSTOP GOES THROUGH IT: `neutralise` and the backstop's own
           catch (`installBackstop`, driven in 30-security part 8) rename no packet by hand, and each
           of `neutralise`'s five refusals ends in `disarm` (E75 fix r1-G2; review cor F2: one
           `disarm(payload)` anywhere satisfied this until then, and the branch on a GM that is not
           the primary is one the one-GM harness cannot drive, so it is held here by reading). */
        const guard = stripComments(new Map(await otherSources()).get("relay-guard.mjs") ?? "");
        for (const name of ["neutralise", "installBackstop"]) {
            const body = fnSource(guard, name);
            ok(body.includes("disarm(payload)"), `${name} does not refuse through disarm`);
            ok(!/\.action\s*=[^=]/.test(body), `${name} renames a packet itself`);
        }
        const neutralise = fnSource(guard, "neutralise");
        const branches = {
            "a name a player's client has not reviewed": /refused on this client\.`\);\s*disarm\(payload\);\s*return;/,
            "a name the GM has not reviewed": /shapeWarning\([^;]*\);\s*disarm\(payload\);\s*return;/,
            "a GM that is not the primary": /if \(!isPrimaryGm\(\)\) \{\s*disarm\(payload\);\s*return;\s*\}/,
            "a sender this client cannot judge": /noSender\(payload, senderId\);\s*disarm\(payload\);\s*return;/,
            "a verdict other than forward": /disarm\(payload\);\s*if \(verdict\.verdict === "own"\)/
        };
        equal(JSON.stringify(Object.keys(branches).filter(branch => !branches[branch].test(neutralise))), "[]",
            "the backstop's refusals that do not end in disarm");
        equal((neutralise.match(/disarm\(payload\)/g) ?? []).length, Object.keys(branches).length, "the times neutralise calls disarm");
    }],

    ["R344 - the relay guard reads a listener's default branch, and a default it has not reviewed is a change", async () => {
        /*
         * E75 C4, 10.10.2026; ledger K12. 2.10.10 gave Daggerheart's listener a `default:`
         * branch that runs a name it has no case for by the packet's `data.action`
         * (2.10.11 socket.mjs:36-37, read in the code); its `case` lines stayed as they were,
         * so a guard that read only those called the listener "ok" and the GM was never
         * told the relay had changed. Four stand-in listeners, as source text (`fingerprintOf`
         * reads `String(fn)`, and a string is its own): 2.10.8's switch, which has no default;
         * 2.10.11's, laid out as rollup may lay it out (`$1` suffixes, a line break); one
         * whose default dispatches some other way; and 2.10.11's default with a second
         * statement after the reviewed one (E75 fix r1-G1, 10.10.2026, review round 1 sec S1 /
         * cor F1: the fingerprint read a clause only to its first `;`, and this one read "ok"
         * on C6's tree). The first two must read reviewed and the last two not. Pure: nothing
         * is wrapped or sent.
         */
        const { fingerprintOf, unreviewedOf, REVIEWED_CASES } = await import("./relay-guard.mjs");
        const cases = ["GMUpdate", "GMCreate", "DhpFearUpdate", "Refresh", "DowntimeTrigger", "TagTeamStart", "GroupRollStart", "TransferItem"];
        const switchOf = (event, tail) => `async function listener({ action = null, data = {} } = {}) { switch (action) { ${
            cases.map(name => `case ${event}.${name}: break;`).join(" ")} ${tail} } }`;
        const listeners = {
            "2.10.8": switchOf("socketEvent", ""),
            "2.10.11": switchOf("socketEvent$1", "default:\n            EVENT_HANDLERS$1[data.action]?.(data.data);\n    "),
            other: switchOf("socketEvent", "default: EVENT_HANDLERS[data.type]?.(data);"),
            after: switchOf("socketEvent", "default:\n            EVENT_HANDLERS[data.action]?.(data.data);\n            Hooks.callAll(data.action, data.data);\n    ")
        };

        /* THE STATE THE GM IS TOLD OF, first: `ensureWrapped` calls a listener "changed"
           when `unreviewedOf` names anything. */
        equal(JSON.stringify(Object.values(listeners).map(source => unreviewedOf(fingerprintOf([source])).length ? "changed" : "ok")),
            JSON.stringify(["ok", "ok", "changed", "changed"]), "the state the guard gives each listener");

        const reviewedDefault = "default:EVENT_HANDLERS[data.action]?.(data.data);";
        const afterDefault = "default:EVENT_HANDLERS[data.action]?.(data.data);Hooks.callAll(data.action,data.data);";
        const read = Object.fromEntries(Object.entries(listeners).map(([which, source]) => {
            const fingerprint = fingerprintOf([source]);
            return [which, { fingerprint, unreviewed: fingerprint.filter(name => !REVIEWED_CASES.includes(name)) }];
        }));
        equal(JSON.stringify(read), JSON.stringify({
            "2.10.8": { fingerprint: cases, unreviewed: [] },
            "2.10.11": { fingerprint: [...cases, reviewedDefault], unreviewed: [] },
            other: { fingerprint: [...cases, "default:EVENT_HANDLERS[data.type]?.(data);"], unreviewed: ["default:EVENT_HANDLERS[data.type]?.(data);"] },
            after: { fingerprint: [...cases, afterDefault], unreviewed: [afterDefault] }
        }), "what the guard reads off each listener, and which of it nobody reviewed");

        /* WHAT THE GUARD ITSELF CALLS UNREVIEWED, by the function `ensureWrapped` uses. */
        equal(JSON.stringify(Object.values(listeners).map(source => unreviewedOf(fingerprintOf([source])))),
            JSON.stringify([[], [], ["default:EVENT_HANDLERS[data.type]?.(data);"], [afterDefault]]), "what the guard itself calls unreviewed on each listener");
        const guard = stripComments(new Map(await otherSources()).get("relay-guard.mjs") ?? "");
        const ensure = fnSource(guard, "ensureWrapped");
        ok(ensure.includes("status.unreviewed = unreviewedOf(status.fingerprint)"),
            "ensureWrapped decides the state by something other than unreviewedOf");
        /* AND THE LINE THAT MAKES THAT READING THE STATE (E75 fix r2-G2; review goal round 2, open
           site 2): the state above is recomputed here, so a change to `ensureWrapped`'s own line
           read the same until this held it. */
        ok(ensure.replace(/\s+/g, " ").includes(
            'status.state = unnamed ? "unnamed" : (!status.fingerprint.length || status.unreviewed.length) ? "changed" : "ok";'),
            "ensureWrapped calls a listener \"changed\" by something other than an empty fingerprint or an unreviewed entry");
    }],

    ["R345 - a player's countdowns from a Daggerheart action are refused by name, as D-b refuses them on the old road", async () => {
        /*
         * E75 C5, 10.10.2026; census P09, the owner's Q1 (a). From 2.10.10 a player's client
         * sends the countdowns an action starts as `{ data: { data: { countdowns } } }` - no
         * `action`, an inner `data` with no `action`, an array (2.10.11 countdownField.mjs:84-89,
         * read in the code). `judgeRelay` asked about it with a made-up player and a world it
         * must not need: refused as `judgeCountdowns` refuses 2.10.8's road (kind "refused", the
         * names in `why`), under a bucket of its own. Beside it, packets that only look like it -
         * an inner `action` set or null, an outer `action`, countdowns that are no array - are
         * not taken for it. On C4's tree the shape came back kind
         * "shape" for the sub "?". Pure: nothing is sent.
         */
        const { judgeRelay, plainWhat } = await import("./relay-guard.mjs");
        const player = { id: "SUITEPLAYER00001", name: "Suite player", isGM: false };
        const world = { now: () => 1e12 };
        const judged = (payload, on = world) => {
            try {
                const { verdict, sub, kind, why } = judgeRelay(payload, player, on);
                return { verdict, sub, kind: kind ?? null, why };
            } catch (err) {
                return { threw: String(err?.message ?? err) };
            }
        };
        const countdowns = [{ name: "Doom", progress: { start: 4, current: 4 } }, { name: { toString: () => "Dread" } }, {}];
        equal(JSON.stringify(judged({ data: { data: { countdowns } } })),
            JSON.stringify({ verdict: "refuse", sub: "countdownsFromAction", kind: "refused", why: "new countdowns (Doom, Dread, ?)" }),
            "the verdict on a player's countdowns from an action");
        equal(JSON.stringify(judged({ action: null, data: { data: { countdowns: [] } } })),
            JSON.stringify({ verdict: "drop", sub: "countdownsFromAction", kind: null, why: "no countdowns" }),
            "the verdict on the same shape with no countdowns in it");

        /* A NAME `String()` CANNOT READ (E75 fix r1-G2; review sec S2): an object whose conversion to
           text throws, which JSON carries. Until the fix `judgeRelay` threw on it, so the guard
           logged a failure in place of this refusal and the sender was not told. It is refused by
           name all the same, the name read as "[object Object]"; `plainWhat`, which the console
           lines go through, reads such a value the same way. */
        const unreadable = JSON.parse('{ "name": { "toString": "Doom", "valueOf": 0 } }');
        equal(JSON.stringify(judged({ data: { data: { countdowns: [countdowns[0], unreadable] } } })),
            JSON.stringify({ verdict: "refuse", sub: "countdownsFromAction", kind: "refused", why: "new countdowns (Doom, [object Object])" }),
            "the verdict on a player's countdowns when one name cannot be read as text");
        let shown;
        try { shown = plainWhat(unreadable.name); } catch (err) { shown = `threw: ${err?.message ?? err}`; }
        equal(shown, "[object Object]", "what plainWhat makes of a value String() cannot read");

        /* A NUMBER `Number()` CANNOT READ (E75 fix r2-G2; review sec T1, cor F2): the same kind of
           object, or an array holding one, where a judge reads a number. Until the fix `judgeRelay`
           threw on each, so on the GM the guard logged its own failure in place of a verdict, and the
           sender was not told. Each is judged now as a value that is no number: Fear, a resource and
           an item's charges and count refused by name, a countdown's progress and a save's total
           dropped. The world is made up, as R133's is. */
        const unconvertible = JSON.parse('{ "toString": 0 }');
        const mine = { documentName: "Actor", type: "character", id: "SUITEACTOR0000001", name: "Mine",
            system: { resources: { hope: { value: 2, max: 6 } } }, testUserPermission: user => user?.id === player.id };
        const knife = { documentName: "Item", type: "loot", name: "Knife", parent: { documentName: "Actor" }, _source: { flags: {} },
            system: { quantity: 2, resource: { value: 1 } }, testUserPermission: user => user?.id === player.id };
        const tick = { name: "Tick", progress: { current: 3, start: 6, type: "actionRoll", looping: "noLooping" } };
        const numbers = { ...world, doc: uuid => (uuid === "mine" ? mine : uuid === "knife" ? knife : null),
            countdowns: () => ({ countdowns: { T1: foundry.utils.deepClone(tick) } }), isProject: () => false, levelOf: () => 2,
            automationOn: () => true, changedAt: () => 0, fear: () => 4, fearSteps: () => 1, fearChangedAt: () => 0,
            message: id => (id === "M1" ? { id: "M1" } : null), tokenFor: () => ({ actor: mine }), gainRefusal: () => null, itemHeld: () => null };
        const update = (action, data) => ({ action: "DhGMUpdate", data: { action, ...data } });
        const asked = {
            fear: update("DhGMUpdateFear", { data: 5 }),
            countdown: update("DhGMUpdateCountdowns", { data: { countdowns: { T1: { ...tick, progress: { ...tick.progress, current: 2 } } } } }),
            save: update("DhGMUpdateSaveMessage", { data: { message: "M1", token: "TOKMINE", result: { roll: { total: 12 } } } }),
            resource: update("DhGMUpdateDocument", { uuid: "mine", data: { "system.resources.hope.value": 3 } }),
            charges: update("DhGMUpdateDocument", { uuid: "knife", data: { "system.resource.value": 0 } }),
            count: update("DhGMUpdateDocument", { uuid: "knife", data: { "system.quantity": 1 } })
        };
        const withValue = (packet, path, value) => {
            const copy = foundry.utils.deepClone(packet);
            path.slice(0, -1).reduce((at, key) => at[key], copy)[path.at(-1)] = value;
            return copy;
        };
        const unread = {
            fear: judged(withValue(asked.fear, ["data", "data"], unconvertible), numbers),
            countdown: judged(withValue(asked.countdown, ["data", "data", "countdowns", "T1", "progress", "current"], unconvertible), numbers),
            save: judged(withValue(asked.save, ["data", "data", "result", "roll", "total"], unconvertible), numbers),
            resource: judged(withValue(asked.resource, ["data", "data", "system.resources.hope.value"], [unconvertible]), numbers),
            charges: judged(withValue(asked.charges, ["data", "data", "system.resource.value"], [unconvertible]), numbers),
            count: judged(withValue(asked.count, ["data", "data", "system.quantity"], [unconvertible]), numbers)
        };
        equal(JSON.stringify(unread), JSON.stringify({
            fear: { verdict: "refuse", sub: "DhGMUpdateFear", kind: "forged", why: "Fear set to [object Object]" },
            countdown: { verdict: "drop", sub: "DhGMUpdateCountdowns", kind: null, why: "no change a player could make" },
            save: { verdict: "drop", sub: "DhGMUpdateSaveMessage", kind: null, why: "a save with no roll in it" },
            resource: { verdict: "refuse", sub: "DhGMUpdateDocument", kind: "forged", why: "hope on Mine set to [object Array]" },
            charges: { verdict: "refuse", sub: "DhGMUpdateDocument", kind: "forged", why: "the charges of Knife set to [object Array]" },
            count: { verdict: "refuse", sub: "DhGMUpdateDocument", kind: "forged", why: "the quantity of Knife set to [object Array]" }
        }), "the verdicts on a number Number() cannot read, where each judge reads one");
        /* And whatever the spelling: every leaf of those packets, of the countdowns from an action and
           of a new document, replaced in turn by such an object and by an array holding one, must come
           back a verdict. The leaves are counted, so a list that reads nothing cannot pass. */
        const packets = [...Object.values(asked), { data: { data: { countdowns: [{ name: "Doom", progress: { start: 4, current: 4 } }] } } },
            { action: "DhGMCreate", data: { documentType: "Item", data: { name: "Suite item" } } }];
        const leaves = (value, path = []) => (value && typeof value === "object"
            ? Object.entries(value).flatMap(([key, inner]) => leaves(inner, [...path, key])) : [path]);
        const swept = packets.flatMap(packet => leaves(packet).flatMap(path => [unconvertible, [unconvertible]].map(value => {
            const { verdict, threw } = judged(withValue(packet, path, value), numbers);
            return ["forward", "own", "refuse", "drop"].includes(verdict) ? null : `${path.join(".")}: ${threw ?? verdict}`;
        })));
        equal(swept.length, 2 * 33, "the packet values the sweep replaced");
        equal(JSON.stringify(swept.filter(Boolean)), "[]", "the packet values of that kind on which judgeRelay throws or gives no verdict");

        const near = {
            "an inner action": { data: { action: "SuiteUnknown", data: { countdowns } } },
            "an inner action that is null": { data: { action: null, data: { countdowns } } },
            "an outer action": { action: "DhGMUpdate", data: { data: { countdowns } } },
            "countdowns that are no array": { data: { data: { countdowns: { C1: { name: "Doom" } } } } }
        };
        equal(JSON.stringify(Object.fromEntries(Object.entries(near).map(([what, payload]) => [what, judged(payload).sub]))),
            JSON.stringify({ "an inner action": "SuiteUnknown", "an inner action that is null": "?", "an outer action": "?",
                "countdowns that are no array": "?" }),
            "what a packet that only looks like the shape is judged as");

        /* AND BOTH PLACES THAT REFUSE AN UNKNOWN NAME ON THE GM (`neutralise` for the backstop,
           `onRelay`) recognise the shape before they do, so it reaches `judgeRelay` (R153 keeps
           the sender's question ahead of that) instead of the unreviewed whisper. */
        const guard = stripComments(new Map(await otherSources()).get("relay-guard.mjs") ?? "");
        for (const name of ["neutralise", "onRelay"]) {
            const body = fnSource(guard, name);
            const recognised = body.indexOf("isCountdownAdd(payload)"), refused = body.indexOf("shapeWarning(");
            ok(recognised > 0 && refused > recognised, `${name} does not recognise the countdown shape before it refuses an unknown name`);
        }
        /* AND NO TEXT IS READ OFF A PACKET BUT THROUGH `textOf` (fix r1-G2): outside `textOf` the word
           `String` is followed only by `(fn)`, a listener's source, or `(game.`, Foundry's own values. */
        const strays = guard.replace(fnSource(guard, "textOf"), "").match(/\bString\b(?!\((?:fn\)|game\.))[^\n]{0,40}/g) ?? [];
        equal(JSON.stringify(strays), "[]", "the places relay-guard.mjs reads text with String() and not textOf");
        /* AND NO VALUE OFF A PACKET IS CONVERTED BUT THROUGH `textOf` OR `numberOf` (fix r2-G2; review
           sec T1, cor F2-F3): in the functions that judge a packet, a name that holds a value read off
           it - `value`, `data`, `inner`, `next`, `payload`, `theirs`, `sub` - is never the first thing
           inside `Number(`, `String(` or a template's `${}`, and never either side of a `+`. That list
           of names and those four forms are what this reads; a value under another name, `.join()`
           and `.toString()` are not. The verdicts above hold what these forms do at a raw value. */
        const judges = ["judgeRelay", "judgeDocument", "actorRefusal", "itemRefusal", "partyRefusal", "sceneRefusal", "judgeFear",
            "judgeCountdowns", "judgeCountdownAdd", "judgeSave"];
        const held = "(?:value|data|inner|next|payload|theirs|sub)\\b";
        const raw = new RegExp(`(?:\\b(?:Number|String)\\(|\\$\\{|\\+(?![+=]))\\s*${held}[^\\n]{0,40}|\\b${held}[\\w?.[\\]]*\\s*\\+(?![+=])[^\\n]{0,40}`, "g");
        const rawReads = judges.flatMap(name => (fnSource(guard, name).match(raw) ?? []).map(hit => `${name}: ${hit}`));
        equal(JSON.stringify(rawReads), "[]", "the places a judge converts a value off a packet without textOf or numberOf");
    }],

    ["R353 - the reset window lists only the ticked groups", async () => {
        /*
         * E11 C9, 10.10.2026; audit S06-49. The "This goes" list above the ticks was twelve
         * hand-written lines that went whatever was ticked - one of them five groups at once,
         * half the groups on none - so a GM who unticked the incident still read "the incident"
         * among what goes. `resetGoesHtml(plan, tally)` draws it from RESET_GROUPS: one row per
         * group, `data-group` its key, a group the plan keeps struck through and
         * `aria-disabled`, the projects row counting the project tokens on the maps. Pure:
         * a plan and a made-up tally in, markup out; nothing in the world is read or written.
         */
        const S = await import("./season-setup.mjs");
        ok(typeof S.resetGoesHtml === "function", "season-setup.mjs draws no \"This goes\" list from the ticks (resetGoesHtml)");
        const { RESET_GROUPS, planFrom } = await import("./season-exceptions.mjs");
        const { plural } = await import("./utils.mjs");
        const keys = RESET_GROUPS.map(group => group.key);
        const ticked = keys.filter(key => !["incident", "advancement", "chatRest"].includes(key));
        const tally = { projects: 2, projectTokens: 4, remnants: 3, bullets: 1, dead: 1, items: 5, advances: 2,
            preNotes: 1, cards: 7, chat: 9, despair: 1 };
        const host = document.createElement("div");
        host.innerHTML = S.resetGoesHtml(planFrom(ticked), tally);
        const rows = [...host.querySelectorAll("li[data-group]")];
        equal(JSON.stringify(rows.map(row => row.dataset.group)), JSON.stringify(keys),
            "the list's rows are not RESET_GROUPS' keys, one each, in the window's order");
        const struck = row => Boolean(row.querySelector("s")) && row.getAttribute("aria-disabled") === "true";
        const kept = rows.filter(struck).map(row => row.dataset.group);
        equal(JSON.stringify(kept), JSON.stringify(["incident", "advancement", "chatRest"]),
            "the groups the plan keeps are not the rows struck through and aria-disabled");
        ok(rows.filter(row => ticked.includes(row.dataset.group))
            .every(row => !row.querySelector("s") && !row.hasAttribute("aria-disabled")),
            "a ticked group's row is struck through or disabled");
        const projects = host.querySelector('li[data-group="projects"]')?.textContent ?? "";
        ok(projects.includes(plural("DRPG.Season.resetProjectTokens", { n: 4 })),
            `the projects row does not count the project tokens on the maps: "${projects.trim()}"`);
        const label = host.querySelector('li[data-group="incident"]')?.textContent ?? "";
        ok(label.includes(game.i18n.localize("DRPG.Season.group.incident")), "a row does not carry its tick's label");
        // Nothing ticked: every row struck. Everything ticked: none.
        host.innerHTML = S.resetGoesHtml(planFrom([]), tally);
        ok([...host.querySelectorAll("li[data-group]")].every(struck), "with nothing ticked a row still reads as going");
        host.innerHTML = S.resetGoesHtml(planFrom(keys), tally);
        equal(host.querySelectorAll("li[data-group] s, li[aria-disabled]").length, 0, "with everything ticked a row reads as kept");
    }],

    ["R162 - the runner judges before it answers, answers once, and tells an exception as failed", async () => {
        /*
         * E31, 25.09.2026; audit S17-08. `judge` (bridge-guards.mjs) carries out every
         * declaration of the bridge's tables. Driven here over a table of its own, with
         * a `send` that records instead of emitting, so nothing leaves this client and
         * nothing in the world is touched. What it must do: an action no table has is
         * not its to judge; a guard's refusal is the one answer (no acknowledgement
         * before it, and the run never starts); a request that passes is acknowledged
         * and then answered at most once more - its reply, or the run's own refusal;
         * an exception anywhere (preparing, a guard, the run) is logged and told as one
         * refusal, "the handler failed"; a queue keeps the order packets arrived in
         * even when the first run is the slower one, and acknowledges each packet as
         * it arrives, ahead of the writes before it (E31 review), a refusal from its
         * guards coming after that acknowledgement. Every refusal carries the code
         * of the closed list its English reason stands for (E31 C4): "not their
         * character" goes as notYours, an exception as failed, and a reason no
         * pattern takes as refused; a declaration's `tell` is the code of every
         * refusal but a throw, its guards' and its run's (E31 review). What reaches
         * the GM's socket is handed to this function by the three listeners, which
         * R1b reads.
         */
        const { judge, knownSender, pick, as } = await import("./bridge-guards.mjs");
        const me = game.user.id, sent = [], ran = [];
        const send = (to, packet) => sent.push({ to, ...packet });
        const decl = (run, more = {}) => ({ label: "x", guards: [knownSender], sanitize: pick({ n: as.num }), run, answer: "ack", ...more });
        let release = null;
        const gate = new Promise(resolve => { release = resolve; });
        const TABLE = {
            "r162.refused": decl(() => { ran.push("refused"); }, { guards: [knownSender, () => "not their character"] }),
            "r162.unlisted": decl(() => { ran.push("unlisted"); }, { guards: [knownSender, () => "a planted refusal no pattern takes"] }),
            "r162.ack": decl(payload => { ran.push(`ack ${payload.n} ${Object.keys(payload).join(",")}`); }),
            "r162.reply": decl(() => ({ reply: { answer: 42 } }), { answer: "reply" }),
            "r162.later": decl(() => ({ later: true }), { answer: "reply" }),
            "r162.runRefuses": decl(() => ({ refused: "no such character" })),
            "r162.tell": decl(() => { ran.push("tell"); }, { guards: [knownSender, () => "not their character"], tell: "traceOutOfReach" }),
            "r162.tellThrows": decl(() => { throw new Error("R162 planted: a run under a tell"); }, { tell: "traceOutOfReach" }),
            "r162.tellRunRefuses": decl(() => ({ refused: "no such character" }), { tell: "traceOutOfReach" }),
            "r162.throwsRun": decl(() => { throw new Error("R162 planted: the run"); }),
            "r162.throwsGuard": decl(() => { ran.push("guard"); }, { guards: [knownSender, () => { throw new Error("R162 planted: a guard"); }] }),
            "r162.throwsPrepare": decl(() => { ran.push("prepare"); }, { prepare: () => { throw new Error("R162 planted: prepare"); } }),
            "r162.queued": decl(async payload => { await wait(payload.n === 1 ? 80 : 0); ran.push(`queued ${payload.n}`); },
                { queue: "r162", answer: "reply" }),
            "r162.held": decl(async () => { await gate; ran.push("held"); }, { queue: "r162", answer: "reply" }),
            "r162.queuedRefused": decl(() => { ran.push("queuedRefused"); },
                { guards: [knownSender, () => "not their character"], queue: "r162", answer: "reply" })
        };
        const ask = (action, extra = {}, from = me) =>
            judge(TABLE, { action, requestId: `rid-${action}`, userId: from, n: 1, stray: "not on the list", ...extra }, from, { send });
        const kinds = () => sent.map(p => (p.action === "bridge.refused" ? `${p.action} ${p.what} ${p.reason}` : p.action));
        const clear = () => { sent.length = 0; ran.length = 0; };

        equal(ask("r162.unknown"), false, "an action no table has was taken for judging");
        equal(sent.length, 0, "an action no table has was answered");

        await ask("r162.refused");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.refused r162.refused notYours"]),
            "a guard's refusal was not the one answer, with its reason - an acknowledgement went first, or no refusal went at all");
        ok(sent[0].to === me && sent[0].requestId === "rid-r162.refused" && !ran.length,
            `the refusal went to the wrong place, or the run ran after it: ${JSON.stringify({ sent, ran })}`);

        clear();
        await ask("r162.unlisted");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.refused r162.unlisted refused"]),
            "a reason no pattern takes was not told as the fallback, refused");

        clear();
        await ask("r162.ack", {}, "R162NOSUCHUSER00");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.refused r162.ack unknownSender"]), "a sender Foundry does not know was not refused as one");

        clear();
        await ask("r162.ack");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.ack"]), "a request that passed was not acknowledged once and left at that");
        equal(JSON.stringify(ran), JSON.stringify(["ack 1 n"]), "the run was not handed the whitelisted copy - only `n` is on its list");

        clear();
        await ask("r162.reply");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.ack", "bridge.done"]), "a reply was not an acknowledgement and one answer");
        equal(sent[1]?.value?.answer, 42, "the answer sent is not the one the run returned");

        clear();
        await ask("r162.later");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.ack"]), "a ruling to be given later from a card was answered now");

        clear();
        await ask("r162.runRefuses");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.ack", "bridge.refused r162.runRefuses missing"]),
            "a run's own refusal did not follow its acknowledgement, once, with its reason");

        // A declaration's `tell` is the code its guards' refusals are told with, whatever the guard's own reason;
        // a failure of its run is still told as failed.
        clear();
        await ask("r162.tell");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.refused r162.tell traceOutOfReach"]),
            "a guard's refusal was not told with the declaration's `tell`");
        clear();
        await ask("r162.tellThrows");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.ack", "bridge.refused r162.tellThrows failed"]),
            "a run that threw under a `tell` was not told as failed");
        // And the run's own refusal is told with it too (E31 review): a run that carried out nothing refuses, and
        // under a `tell` that refusal says no more than the guards' do.
        clear();
        await ask("r162.tellRunRefuses");
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.ack", "bridge.refused r162.tellRunRefuses traceOutOfReach"]),
            "a run's own refusal under a `tell` was not told with it");

        for (const where of ["Run", "Guard", "Prepare"]) {
            clear();
            // The lines logged while it is judged, not the session log's rows: a second run in one page found the
            // first run's row there, and a session past 60 wordings none (fix r2-H6, 05.10.2026; review m1).
            const log = watchLog();
            try {
                await ask(`r162.throws${where}`);
            } finally {
                log.stop();
            }
            const refusals = sent.filter(p => p.action === "bridge.refused");
            equal(refusals.length, 1, `an exception in the ${where.toLowerCase()} was not told as one refusal`);
            equal(refusals[0]?.reason, "failed", `an exception in the ${where.toLowerCase()} was not told as failed`);
            equal(log.count(new RegExp(`Refused a "r162\\.throws${where}".*the handler failed`)), 1,
                `an exception in the ${where.toLowerCase()} was not logged once as "the handler failed"`);
            if (where !== "Run") {
                ok(!sent.some(p => p.action === "bridge.ack") && !ran.length,
                    `an exception in the ${where.toLowerCase()} was acknowledged, or the run went on: ${JSON.stringify({ sent, ran })}`);
            }
        }

        clear();
        await Promise.all([ask("r162.queued", { n: 1 }), ask("r162.queued", { n: 2 })]);
        equal(JSON.stringify(ran), JSON.stringify(["queued 1", "queued 2"]), "a queue did not keep the order its packets arrived in");

        // A queued request is acknowledged as it arrives, while the write ahead of it is still running: its guards
        // and its run wait in the queue, and the asker's clock for the "got it" does not (E31 review). A refusal by
        // its guards follows that acknowledgement, and the run never starts.
        clear();
        const held = ask("r162.held");
        const behind = ask("r162.queuedRefused");
        await wait(30);
        equal(JSON.stringify(kinds()), JSON.stringify(["bridge.ack", "bridge.ack"]),
            "a queued request was not acknowledged as it arrived, behind a write that had not finished");
        release();
        await Promise.all([held, behind]);
        equal(JSON.stringify({ kinds: kinds(), ran }), JSON.stringify({
            kinds: ["bridge.ack", "bridge.ack", "bridge.done", "bridge.refused r162.queuedRefused notYours"], ran: ["held"] }),
            "a queued request was not answered, or refused by its guards, once after its acknowledgement");
    }],

    ["R165 - one wait: a request settles once, never rejects, and one message says what and why", async () => {
        /*
         * E31, 25.09.2026; audit S17-09. Every request a client makes of the GM
         * waits in `createWaiter` (bridge-guards.mjs), which the module builds once
         * around the real socket. Driven here with fakes - an emit that records, a
         * clock of tens of milliseconds, a message that records - so nothing leaves
         * this client and nothing in the world is touched. What it must do: with no
         * GM, refuse at once and send nothing; an "ack" request settles on the "got
         * it", and a refusal after it is still said, once; a "reply" request
         * settles on its answer; a refusal settles it, with the code; no "got it"
         * in time is `noAnswer`; a patient request has no clock for the "got it"
         * and is asked again once, with the same id, when a GM's world has loaded;
         * an answer after the clock goes to `late` for as long as the request's
         * `lateMs` says, and says nothing, and is dropped after it; an emit that
         * throws is `failed`; a GM's own client does the work itself; and the
         * primary GM, who answers requests, cannot send one. Every failure is one
         * message, none for a quiet request, and no promise rejects.
         */
        const { createWaiter } = await import("./bridge-guards.mjs");
        const make = ({ gms = ["R165GM"], who = { id: "R165ME", isGM: false, isPrimary: false }, emitThrows = false } = {}) => {
            const sent = [], said = [], reported = [];
            const waiter = createWaiter({
                emit: (packet, to) => { if (emitThrows) throw new Error("R165 planted: the socket"); sent.push({ packet, to }); },
                gmIds: () => gms,
                me: () => who,
                notify: (action, reason, opts) => said.push(`${action} ${reason}${opts?.nothingSpent ? " +nothingSpent" : ""}`),
                fromGm: id => id === "R165GM",
                report: text => reported.push(text)
            });
            const reply = (action, extra = {}) => waiter.onReply({ action, userId: who.id, requestId: sent.at(-1)?.packet.requestId, ...extra }, "R165GM");
            return { waiter, sent, said, reported, reply };
        };
        const fast = { ackMs: 30, timeoutMs: 200 };

        // No GM: refused at once, nothing sent, said once.
        let w = make({ gms: [] });
        equal(JSON.stringify(await w.waiter.request("r165.x", { a: 1 }, { ...fast, nothingSpent: true })), JSON.stringify({ ok: false, reason: "noGm" }),
            "a request with no GM was not refused as noGm");
        equal(JSON.stringify({ sent: w.sent.length, said: w.said }), JSON.stringify({ sent: 0, said: ["r165.x noGm +nothingSpent"] }),
            "a request with no GM sent something, or was not said once");

        // "ack": settled by the "got it"; a refusal after it is said once, and changes nothing.
        w = make();
        let asked = w.waiter.request("r165.ack", { a: 1 }, { ...fast, settle: "ack" });
        equal(JSON.stringify(w.sent[0]?.to), JSON.stringify(["R165GM"]), "a request went somewhere other than the GMs");
        ok(w.sent[0]?.packet.action === "r165.ack" && w.sent[0]?.packet.userId === "R165ME" && typeof w.sent[0]?.packet.requestId === "string",
            `a request left without its action, its asker or its id: ${JSON.stringify(w.sent[0]?.packet)}`);
        w.reply("bridge.ack");
        equal(JSON.stringify(await asked), JSON.stringify({ ok: true, pending: true }), "an acknowledged request did not settle as sent");
        w.reply("bridge.refused", { what: "r165.ack", reason: "failed" });
        w.reply("bridge.refused", { what: "r165.ack", reason: "failed" });
        equal(JSON.stringify(w.said), JSON.stringify(["r165.ack failed"]), "a refusal after the acknowledgement was not said exactly once");

        // "reply": settled by its answer.
        w = make();
        asked = w.waiter.request("r165.reply", {}, { ...fast, settle: "reply" });
        w.reply("bridge.ack");
        w.reply("bridge.done", { value: { answer: 42 } });
        equal(JSON.stringify(await asked), JSON.stringify({ ok: true, value: { answer: 42 } }), "a reply did not settle with its answer");

        // Refused before any "got it": settled with the code, said once; a code off the list is `refused`.
        w = make();
        asked = w.waiter.request("r165.no", {}, { ...fast, settle: "reply" });
        w.reply("bridge.refused", { what: "r165.no", reason: "notYours" });
        equal(JSON.stringify(await asked), JSON.stringify({ ok: false, refused: true, reason: "notYours" }), "a refusal did not settle with its code");
        asked = w.waiter.request("r165.odd", {}, { ...fast, settle: "ack" });
        w.reply("bridge.refused", { what: "r165.odd", reason: "DRPG.Anything.else" });
        equal((await asked).reason, "refused", "a code off the closed list was taken as sent");
        equal(JSON.stringify(w.said), JSON.stringify(["r165.no notYours", "r165.odd refused"]), "each refusal was not said exactly once");

        // A reply from somebody who is not a GM, or to somebody else, is not a reply.
        w = make();
        asked = w.waiter.request("r165.forged", {}, { ackMs: 40, timeoutMs: 200, settle: "ack" });
        w.waiter.onReply({ action: "bridge.ack", userId: "R165ME", requestId: w.sent[0].packet.requestId }, "R165PLAYER");
        w.waiter.onReply({ action: "bridge.ack", userId: "SOMEBODYELSE0000", requestId: w.sent[0].packet.requestId }, "R165GM");
        equal((await asked).reason, "noAnswer", "an acknowledgement from a player, or to another user, was taken");

        // No "got it" in time: not answered - by the clock for the "got it", long before the answer's -
        // said once; a late answer is dropped and says nothing.
        w = make();
        const t0 = Date.now();
        asked = w.waiter.request("r165.silent", {}, { ackMs: 30, timeoutMs: 2000, settle: "ack" });
        equal(JSON.stringify(await asked), JSON.stringify({ ok: false, reason: "noAnswer" }), "no acknowledgement in time was not noAnswer");
        ok(Date.now() - t0 < 1000, `no acknowledgement was noticed only by the answer's clock, after ${Date.now() - t0} ms`);
        w.reply("bridge.ack");
        w.reply("bridge.refused", { what: "r165.silent", reason: "failed" });
        equal(JSON.stringify(w.said), JSON.stringify(["r165.silent noAnswer"]), "a request given up on was said twice");

        // Patient: no clock for the "got it"; asked again once, with the same id; then answered.
        w = make();
        let settled = null;
        asked = w.waiter.request("r165.patient", {}, { ackMs: 20, timeoutMs: 400, settle: "reply", patient: true, resend: true });
        asked.then(r => { settled = r; });
        await wait(60);
        equal(settled, null, "a patient request gave up on the clock for the acknowledgement");
        w.waiter.resendOnGmReady();
        w.waiter.resendOnGmReady();
        equal(w.sent.length, 2, "a patient request was not asked again exactly once when a GM's world loaded");
        equal(w.sent[1]?.packet.requestId, w.sent[0]?.packet.requestId, "the request was asked again under another id");
        w.reply("bridge.done", { value: true });
        equal(JSON.stringify(await asked), JSON.stringify({ ok: true, value: true }), "a patient request did not settle with its answer");

        // An answer after the clock goes to `late`, and says nothing more, for as long as `lateMs` says: here more
        // than twice the clock after the send (E31 review: the record was kept one more clock, so the plant check
        // dropped an answer later than ten seconds). After `lateMs` the answer is dropped.
        w = make();
        const late = [];
        asked = w.waiter.request("r165.late", {}, { ackMs: 1000, timeoutMs: 40, lateMs: 400, settle: "reply", quiet: true,
            late: (value, id) => late.push([value, id === w.sent[0]?.packet.requestId]) });
        equal(JSON.stringify(await asked), JSON.stringify({ ok: false, reason: "noAnswer" }), "a request past its clock did not settle as not answered");
        await wait(100);
        w.reply("bridge.done", { value: "found" });
        equal(JSON.stringify({ late, said: w.said }), JSON.stringify({ late: [["found", true]], said: [] }),
            "an answer more than twice the clock late did not go to `late` with its request id, or a quiet request said something");
        w = make();
        const dropped = [];
        asked = w.waiter.request("r165.later", {}, { ackMs: 1000, timeoutMs: 40, lateMs: 80, settle: "reply", quiet: true,
            late: value => dropped.push(value) });
        await asked;
        await wait(200);
        w.reply("bridge.done", { value: "found" });
        equal(JSON.stringify({ dropped, said: w.said }), JSON.stringify({ dropped: [], said: [] }),
            "an answer after `lateMs` still went to `late`, or said something");

        // An emit that throws is `failed`, said once; nothing rejects.
        w = make({ emitThrows: true });
        equal(JSON.stringify(await w.waiter.request("r165.throws", {}, fast)), JSON.stringify({ ok: false, reason: "failed" }),
            "an emit that threw did not settle as failed");
        equal(JSON.stringify(w.said), JSON.stringify(["r165.throws failed"]), "an emit that threw was not said once");

        // A GM's own client does it here; a local that throws is `failed`.
        w = make({ who: { id: "R165ME", isGM: true, isPrimary: true } });
        equal(JSON.stringify(await w.waiter.request("r165.local", {}, { ...fast, local: () => 7 })), JSON.stringify({ ok: true, value: 7 }),
            "a GM's own request was not done on its own client");
        equal(JSON.stringify(await w.waiter.request("r165.localThrows", {}, { ...fast, local: () => { throw new Error("R165 planted: local"); } })),
            JSON.stringify({ ok: false, reason: "failed" }), "a GM's own request that threw did not settle as failed");
        // The primary GM, who answers requests, cannot send one: failed, nothing sent, nothing said.
        equal(JSON.stringify(await w.waiter.request("r165.primary", {}, fast)), JSON.stringify({ ok: false, reason: "failed" }),
            "the primary GM sent itself a request");
        equal(JSON.stringify({ sent: w.sent.length, said: w.said }), JSON.stringify({ sent: 0, said: ["r165.localThrows failed"] }),
            "the primary's own requests sent something, or said something other than the one failure");
        equal(w.waiter.waiting(), 0, "a request is still waiting after this test");
    }],

    ["R166 - a search is recorded on the scene its guard judged, not the one the packet names", async () => {
        /*
         * E31, 25.09.2026; the design's W1. A player's search token is spent on the
         * scene where the GM's client found the searcher standing (`guardSearchRoom`
         * writes the place it judged; `searchSceneOf` reads it back), not on the scene
         * the packet names, which is only a claim. The runner hands the guards the
         * packet as it came and the run a new object with the whitelisted fields, so a
         * record keyed by the packet - as it was before the table - is never found by
         * the run, and the spend falls back to the packet's scene: the claim the guard
         * exists to replace, with nothing refused and nothing to see. It is keyed by
         * `ctx`, the one object the runner hands both. The harness has one scene, so no
         * scenario can show a spend landing on the wrong one; this is where it is held.
         *
         * THE REAL ONES (E31 review: this test ran `searchSceneOf` and a table of its
         * own, and none of `guardSearchRoom`, `runSpend` or `runTakePlant`, so a
         * guard that keyed the place by the packet, or a run that dropped `ctx`,
         * passed it). SEARCH_ACTIONS is judged here for a player who plays a
         * character standing in a room, with a packet naming a scene nobody stands
         * on; the token store is spied for the two calls and put back, so nothing is
         * spent, and the runner's packets go to a recorder: nothing leaves this
         * client. Red on copies with each of those faults planted. Since E29 fix
         * r2-H11 (06.10.2026) a spend that succeeds also marks the searcher's newest
         * Search on the GMs' record (`SearchTokens.markSpent`): stubbed as well, so
         * this tier writes nothing at a table where that player searched minutes
         * ago. Not measured: the harness holds no Search record at this tier.
         */
        const { searchSceneOf, SEARCH_ACTIONS, SearchTokens } = await import("./search-tokens.mjs");
        const { judge, knownSender, pick, as } = await import("./bridge-guards.mjs");
        const { locateActor } = await import("./movement.mjs");
        needs(world.atLeast("playerCharactersInRooms"), "a search is judged for a player's own character standing in a named room");
        // The searcher: such a character, found as the bridge's guard finds it.
        const searcher = game.users.filter(u => !u.isGM).flatMap(user => game.actors
            .filter(a => a.type === "character" && a.testUserPermission(user, "OWNER"))
            .map(actor => ({ user, actor, place: locateActor(actor) })))
            .find(s => s.place?.room && s.place.scene?.id);
        ok(searcher, "the world has a player's character standing in a named room, and locateActor finds none");
        const A = "R166SCENEA000000", B = "R166SCENEB000000";
        const judged = new WeakMap(), ctx = {};
        judged.set(ctx, { scene: { id: A }, room: "Hall" });
        equal(searchSceneOf({ isGM: false }, { sceneId: B }, ctx, judged), A,
            "a player's search is recorded on the scene the packet names, not the one its guard judged");
        equal(searchSceneOf({ isGM: false }, { sceneId: B }, {}, judged), B,
            "with no place judged, the packet's scene is not the fallback it always was");
        equal(searchSceneOf({ isGM: true }, { sceneId: B }, ctx, judged), B, "a GM's search is not taken as asked");

        // Why `ctx`: through the runner, the guard and the run meet only there.
        const handed = [], scenes = [];
        const guard = (sender, payload, ctx) => { judged.set(ctx, { scene: { id: A } }); handed.push(payload); return null; };
        const TABLE = { "r166.search": { label: "x", guards: [knownSender, guard], sanitize: pick({ sceneId: as.id }), answer: "none", quiet: true,
            run: (payload, sender, ctx) => { handed.push(payload); scenes.push(searchSceneOf({ isGM: false }, payload, ctx, judged)); } } };
        await judge(TABLE, { action: "r166.search", sceneId: B }, game.user.id, { send: () => {} });
        ok(handed.length === 2 && handed[0] !== handed[1] && !judged.has(handed[1]),
            "the runner handed the guard and the run the same object - this measures nothing about ctx");
        equal(JSON.stringify(scenes), JSON.stringify([A]), "the run did not find, through ctx, the place its guard judged");

        // Through the module's own table: the spend and the plant check that follows it land on the scene the
        // character stands on, not on the one the packet names.
        const { user, actor, place } = searcher;
        const recorded = [], told = [];
        const real = { spend: SearchTokens.spend, takePlant: SearchTokens.takePlant, markSpent: SearchTokens.markSpent };
        SearchTokens.spend = async (room, sceneId) => { recorded.push(`spend ${room} ${sceneId}`); return true; };
        SearchTokens.takePlant = async (room, sceneId) => { recorded.push(`takePlant ${room} ${sceneId}`); return null; };
        SearchTokens.markSpent = async () => null;
        try {
            for (const action of ["searchTokens.spend", "searchTokens.takePlant"]) {
                await judge(SEARCH_ACTIONS, { action, requestId: `r166-${action}`, userId: user.id, actorId: actor.id,
                    roomName: place.room, sceneId: B }, user.id, { send: (to, packet) => told.push(packet.action) });
            }
        } finally {
            SearchTokens.spend = real.spend;
            SearchTokens.takePlant = real.takePlant;
            SearchTokens.markSpent = real.markSpent;
        }
        equal(JSON.stringify({ recorded, told }), JSON.stringify({
            recorded: [`spend ${place.room} ${place.scene.id}`, `takePlant ${place.room} ${place.scene.id}`],
            told: ["bridge.ack", "bridge.done", "bridge.ack", "bridge.done"] }),
            "the real guard and runs recorded the search on the scene the packet names, or not at all");
    }],

    ["R167 - handOff closes a window without waiting for its transition", async () => {
        /*
         * E31, 25.09.2026; audit S01-64. `handOff` (live.mjs) closes a window and then
         * runs what the window hands over to - reopen the GM panel, the next Season
         * setup step. It waited for the window's closing animation, up to a second,
         * for a window the GM had finished with; it closes as `reopen` does now, with
         * `{ animate: false }`. Driven with spy windows, nothing on the screen: the
         * close is asked for without its transition, the work runs only once the
         * close has resolved, and a window that will not close - throwing, or
         * refusing - is logged and still runs what it handed over to, as `reopen`
         * goes on to its opener (E31 review: the work is the GM's click, and C7 had
         * dropped it). The second the transition took is not measurable here (the
         * harness's windows close at once): LIVE-E31-05.
         */
        const { handOff } = await import("./live.mjs");
        const order = [];
        const spy = { close: async options => { order.push(`close ${JSON.stringify(options ?? null)}`); await wait(10); order.push("closed"); } };
        const answer = await handOff(spy, () => { order.push("work"); return "reopened"; });
        equal(JSON.stringify(order), JSON.stringify(['close {"animate":false}', "closed", "work"]),
            "the window was closed with its transition, or the work ran before the close resolved");
        equal(answer, "reopened", "handOff did not answer what the work gave");
        let ran = 0;
        const throwing = { close: () => { throw new Error("R167 planted: the window will not close"); } };
        const refusing = { close: () => Promise.reject(new Error("R167 planted: the close refused")) };
        equal(await handOff(throwing, () => { ran++; return "ran"; }), "ran", "a window whose close threw did not run what it handed over to");
        equal(await handOff(refusing, () => { ran++; return "ran"; }), "ran", "a window whose close refused did not run what it handed over to");
        equal(ran, 2, "a window that would not close did not run what it handed over to, once each");
    }],

    ["R168 - a window's width counts its content's border once", async () => {
        /*
         * E31, 25.09.2026; audit S01-64. `windowWidthFor` (utils.mjs) sizes a table
         * window from the widest row: the content's padding, and the frame around the
         * content - measured, the window's width less the content's `clientWidth`,
         * which already holds the content's border. It added that border a second
         * time. Measured here on elements of its own, not the module's windows: a
         * content box with 3 px borders and 4 px padding must be sized
         * `ceil(widest + 8 + frame) + 2`, where `frame` is read off the same elements,
         * so it holds in jsdom (where it is 0) and in a browser alike. The elements
         * are removed again; nothing in the world is touched.
         */
        const { windowWidthFor } = await import("./utils.mjs");
        const root = document.createElement("div");
        const content = document.createElement("div");
        content.style.cssText = "padding: 0 4px; border: 3px solid transparent; box-sizing: content-box;";
        root.appendChild(content);
        document.body.appendChild(root);
        try {
            const frame = Math.max(0, root.getBoundingClientRect().width - content.clientWidth);
            const widest = 300;
            const want = Math.ceil(widest + 8 + frame) + 2;
            must(Math.round(window.innerWidth * 0.94) > want + 20, `the window is ${window.innerWidth} px wide, too narrow for the ceiling to stay out of this`);
            equal(windowWidthFor(root, content, widest), want, "a bordered content box is sized with its border counted twice, or not at all");
        } finally {
            root.remove();
        }
    }],

    ["R169 - the GM store's merge keeps every field that anybody wrote last", async () => {
        /*
         * E04, 26.09.2026; audit S05-01. The one critical in the module's own code: the
         * Truth Bullet ledger merged by whole entries, newest `updated` wins, and a second
         * GM joining sent entries a migration had built from nothing - `{ faint, updated:
         * now }` - which replaced the full entries everywhere, the answer key with them.
         * The GM store merges per field (gm-store.mjs, mergeSections). This holds its rules
         * on sections the engine's own writer builds, nothing else touched: a field is the
         * newest write of it; a tombstone or a reset's cut kills every older field, keys the
         * clearer never held included; a key written again after its tombstone carries only
         * what was written after it; an equal stamp resolves the same in both orders; a
         * weak write - at the stamp the engine gives it - loses to anything real, a write
         * in the millisecond after a cut included, and is not dead after a cut; the sub-keys of a
         * split field merge apart; and over 200 generated triples the merge is commutative,
         * associative and idempotent. The old rule, copied, is shown to lose the answer key
         * first - a fixture that could not fail would measure nothing.
         */
        const G = await import("./gm-store.mjs");
        const spec = { name: "r169", split: ["public"] };
        const J = G.stableJson;
        const sec = () => G.emptySection();
        const write = (s, k, fields, at, opts) => { G.writeFields(s, k, fields, at, spec, opts); return s; };
        const merge = (a, b) => G.mergeSections(a, b, spec);

        // The rule of truth-bullets.mjs's mergeEntries until E04, copied: an entry replaces the one held when its `updated` is newer.
        const wholeEntry = (mine, theirs) => {
            const out = { ...mine };
            for (const [k, e] of Object.entries(theirs)) if (!(out[k] && (out[k].updated ?? 0) >= (e.updated ?? 0))) out[k] = e;
            return out;
        };
        const full = { realType: "key", remnantId: "R169TRACE", analyzedText: "the cut matches the blade", faint: false };
        equal(wholeEntry({ b1: { ...full, updated: 100 } }, { b1: { faint: true, updated: 200 } }).b1.realType, undefined,
            "the whole-entry fixture keeps the answer key - it is not the S05-01 rule, and what follows would measure nothing");
        equal(J(merge(write(sec(), "b1", full, 100), write(sec(), "b1", { faint: true }, 200)).e.b1), J({ ...full, faint: true }),
            "a younger partial entry erased fields of an older full one (S05-01)");

        const stale = write(sec(), "b1", { realType: "neutral", gmNote: "only here" }, 50);
        equal(J(merge(write(sec(), "b1", full, 100), stale).e.b1), J({ ...full, gmNote: "only here" }),
            "a stale copy overwrote a newer field, or its field nobody else had was lost");

        const clearer = sec();
        G.dropKey(clearer, "b2", 300, spec);
        equal(merge(write(sec(), "b2", { realType: "evident" }, 250), clearer).e.b2, undefined,
            "a tombstone did not kill an older row it never held");
        const cut = sec();
        G.raiseCleared(cut, 500, spec);
        const beforeCut = write(write(sec(), "b3", { realType: "key" }, 400), "b4", { realType: "key" }, 600);
        G.dropKey(beforeCut, "b5", 450, spec);
        const afterCut = merge(beforeCut, cut);
        equal(J({ e: Object.keys(afterCut.e), d: Object.keys(afterCut.d), cleared: afterCut.cleared }), J({ e: ["b4"], d: [], cleared: 500 }),
            "a reset's cut left a row or a tombstone written before it, or took one written after it");

        const revived = write(sec(), "b6", { a: 1, b: 2 }, 100);
        G.dropKey(revived, "b6", 150, spec);
        write(revived, "b6", { c: 3 }, 160);
        equal(J(merge(revived, write(sec(), "b6", { a: 1, b: 2 }, 100)).e.b6), J({ c: 3 }),
            "a key written again after its tombstone brought back fields from before it");

        const x = write(sec(), "k", { v: "x" }, 50), y = write(sec(), "k", { v: "y" }, 50);
        equal(J(merge(x, y)), J(merge(y, x)), "two writes with one stamp resolve differently in the two merge orders");

        /* The weak stamp as the engine's writers take it (`weak()` on a store's handle), on an
           engine built with fakes: after a cut, a weak write is alive, and loses to a real write
           made in the very next millisecond - the first stamp a GM can make after the cut. At
           the watermark plus one it tied that write, and a tie is decided by the value, so a
           default could beat an answer (the review's DS-m2). */
        const flushes = [];
        const eng = G.createGmStoreEngine({
            selfId: () => "R169GM", isGM: () => true, isPrimary: () => true, worldId: () => "R169WORLD",
            activeGmIds: () => [], primaryGmId: () => "R169GM", senderIsGM: () => true, userName: u => u, send: () => {},
            storage: { read: () => null, write: async () => {} }, readLegacy: () => undefined, now: () => 5_000_000,
            timers: { set: fn => { flushes.push(Promise.resolve().then(fn)); return flushes.length; }, clear: () => {} },
            clock: () => ({}), log: { warn: () => {}, error: () => {}, debug: () => {} }, notify: () => {}
        });
        const held = eng.define({ name: "r169weak", key: "r169Weak", kind: "ledger", sync: false, backup: false });
        const cutAt = 1000;
        await held.mergeIn({ e: {}, t: {}, d: {}, cleared: cutAt }, { source: "sync" });
        const weak = write(sec(), "k", { v: "weak" }, held.weak(), { fillOnly: true });
        const oldUnderCut = merge(write(sec(), "k", { v: "old" }, cutAt - 10), { e: {}, t: {}, d: {}, cleared: cutAt });
        equal(merge(oldUnderCut, weak).e.k?.v, "weak", "a weak write after a cut is dead on arrival");
        const real = write(sec(), "k", { v: "real" }, cutAt + 1);
        ok(merge(weak, real).e.k.v === "real" && merge(real, weak).e.k.v === "real",
            `a weak write (at ${held.weak()}) beat a real one made in the millisecond after the cut (at ${cutAt + 1})`);

        const p1 = write(write(sec(), "t", { public: { icon: "a", name: "n1" } }, 100), "t", { public: { icon: "b" } }, 200);
        const p2 = write(write(sec(), "t", { public: { icon: "a", name: "n1" } }, 100), "t", { public: { name: "n2" } }, 210);
        equal(J(merge(p1, p2).e.t.public), J({ icon: "b", name: "n2" }), "two GMs' edits of different sub-keys of a split field did not both survive");
        equal(merge(merge(p1, p2), write(sec(), "t", { public: null }, 300)).e.t.public, null,
            "a later write of the whole split field did not replace its older sub-keys");

        let seed = 169;
        const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
        const gen = () => {
            const s = sec();
            for (let i = 0; i < 12; i++) {
                const k = `k${rnd(4)}`, r = rnd(10), at = 10 + rnd(90);
                if (r === 0) G.dropKey(s, k, at, spec);
                else if (r === 1) G.raiseCleared(s, rnd(40), spec);
                else if (r < 4) write(s, k, { public: { [`s${rnd(3)}`]: rnd(5) } }, at);
                else if (r === 4) write(s, k, { public: rnd(2) ? null : { z: 1 } }, at, { whole: true });
                else write(s, k, { [`f${rnd(3)}`]: rnd(5) }, at);
            }
            return s;
        };
        const broken = { commutes: 0, associates: 0, idempotent: 0 };
        for (let i = 0; i < 200; i++) {
            const a = gen(), b = gen(), c = gen();
            if (J(merge(a, b)) !== J(merge(b, a))) broken.commutes++;
            if (J(merge(merge(a, b), c)) !== J(merge(a, merge(b, c)))) broken.associates++;
            if (J(merge(a, a)) !== J(G.syncable(a)) || J(merge(a, sec())) !== J(G.syncable(a))) broken.idempotent++;
        }
        equal(J(broken), J({ commutes: 0, associates: 0, idempotent: 0 }), "over 200 generated triples the merge is not an order-free union");
    }],

    ["R170 - GM replicas converge by the protocol, and nothing from a player or another world is taken", async () => {
        /*
         * E04, 26.09.2026; audit S05-01, S06-19. Every GM's client holds its own copy of
         * each GM store and keeps it in step with the others by four packets (gm-store.mjs):
         * a hello with a digest per store, the sections that differ, a "done", and a delta
         * after each write. Driven here on three engines built with fakes - a bus that
         * delivers first-in-first-out, last-in-first-out or in a seeded shuffle, with and
         * without every packet twice; a clock whose long timers move only when told; storage
         * in a Map - so nothing leaves this client and nothing in the world is touched. Held:
         * two GMs writing at once and a third joining late with an older copy end with equal
         * sections, the newer fields kept; a GM alone is hydrated at once, one answered by
         * every GM it said hello to is "answered", one that hears nothing is "timedOut" after
         * TIMING.gmStoreSyncMs; and the receive gate refuses a sender that is not a GM, this
         * client, another world, a store this build does not sync and a section stamped with
         * something that is not a number - and a delta forged by a player changes nothing.
         */
        const G = await import("./gm-store.mjs");
        const { TIMING } = await import("./config.mjs");
        const J = G.stableJson;
        const tick = () => new Promise(r => setTimeout(r, 0));
        const makeWorld = ({ order, dup }) => {
            let t = 1000, seed = 170;
            const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
            const timers = [], queue = [], nodes = new Map(), active = new Set();
            const fake = {
                set: (fn, ms) => {
                    const tm = { fn, at: t + ms, done: false };
                    if (!ms) setTimeout(() => { if (!tm.done) { tm.done = true; fn(); } }, 0);
                    else timers.push(tm);
                    return tm;
                },
                clear: tm => { if (tm) tm.done = true; },
                advance: ms => {
                    t += ms;
                    for (const tm of timers.filter(x => !x.done && x.at <= t)) { tm.done = true; tm.fn(); }
                }
            };
            const node = (id, { gm = true, stored = null } = {}) => {
                const store = new Map(stored ?? []);
                const eng = G.createGmStoreEngine({
                    selfId: () => id, isGM: () => gm, isPrimary: () => [...active].sort()[0] === id, worldId: () => "R170WORLD",
                    activeGmIds: () => [...active].filter(u => nodes.get(u)?.gm), primaryGmId: () => [...active].sort()[0] ?? null,
                    senderIsGM: u => nodes.get(u)?.gm ?? false, userName: u => u,
                    send: (packet, to) => {
                        for (const r of to) for (let n = dup ? 2 : 1; n > 0; n--) queue.push({ from: id, to: r, packet: structuredClone(packet) });
                    },
                    storage: { read: k => store.get(k) ?? null, write: async (k, v) => { store.set(k, JSON.stringify(v)); } },
                    readLegacy: () => undefined, now: () => t, timers: fake, clock: () => ({}),
                    log: { warn: () => {}, error: () => {}, debug: () => {} }, notify: () => {}
                });
                const handle = eng.define({ name: "r170", key: "r170Store", split: ["public"] });
                const n = { id, gm, eng, handle, store };
                nodes.set(id, n);
                return n;
            };
            const pump = async () => {
                for (let i = 0; i < 5000 && queue.length; i++) {
                    const at = order === "fifo" ? 0 : order === "lifo" ? queue.length - 1 : rnd(queue.length);
                    const { from, to, packet } = queue.splice(at, 1)[0];
                    if (active.has(to)) nodes.get(to).eng.onPacket(packet, from);
                    await tick();
                }
                for (let i = 0; i < 4; i++) await tick();
            };
            return { node, pump, fake, active, queue };
        };

        const runs = [];
        for (const order of ["fifo", "lifo", "shuffled"]) for (const dup of [false, true]) {
            const w = makeWorld({ order, dup });
            /* A row only the joiner holds, saved in its browser in an earlier session (the review's
               C-m1): it reaches the GMs already there by their "done"'s ask alone. Written after
               the joiner is active, as it was until the fix round, it went out as a delta, and a
               "done" whose ask was ignored passed. */
            const earlier = makeWorld({ order: "fifo", dup: false });
            const past = earlier.node("R170C");
            earlier.active.add("R170C");
            await past.eng.open();
            await past.handle.patch("u3", { realType: "prep" }, { stamp: 7 });
            const a = w.node("R170A"), b = w.node("R170B"), c = w.node("R170C", { stored: past.store });
            w.active.add("R170A");
            w.active.add("R170B");
            await Promise.all([a.eng.open(), b.eng.open()]);
            await Promise.all([a.handle.patch("u1", { realType: "key", remnantId: "R170TRACE" }), b.handle.patch("u1", { faint: true }),
                b.handle.patch("u2", { realType: "evident" })]);
            await w.pump();
            w.active.add("R170C");
            await c.handle.patch("u1", { realType: "neutral" }, { stamp: 5 });
            const opening = c.eng.open();
            await w.pump();
            await opening;
            await w.pump();
            await a.handle.drop("u2");
            await w.pump();
            const [sa, sb, sc] = [a, b, c].map(n => J(n.handle.section()));
            runs.push({ order, dup, same: sa === sb && sb === sc, u1: a.handle.get("u1"), u2: a.handle.get("u2"),
                u3: [a.handle.get("u3")?.realType ?? null, b.handle.get("u3")?.realType ?? null],
                a: a.eng.hydration().state, c: c.eng.hydration().state });
        }
        const wrong = runs.filter(r => !r.same || J(r.u1) !== J({ faint: true, realType: "key", remnantId: "R170TRACE" }) || r.u2 !== null
            || J(r.u3) !== J(["prep", "prep"]) || r.a !== "answered" || r.c !== "answered");
        equal(J(wrong), "[]", "three GMs did not converge on the newest fields, the joiner's own row did not reach the GMs already there, or they were not answered, for some delivery order");

        const alone = makeWorld({ order: "fifo", dup: false });
        const solo = alone.node("R170A");
        alone.active.add("R170A");
        await solo.eng.open();
        equal(solo.eng.hydration().state, "alone", "a GM with no other GM online waited for somebody");
        const deaf = makeWorld({ order: "fifo", dup: false });
        const d1 = deaf.node("R170A");
        deaf.node("R170B");
        deaf.active.add("R170A");
        deaf.active.add("R170B");
        await d1.eng.open();
        equal(d1.eng.hydration().state, "waiting", "a GM with another GM online did not wait for its copy");
        deaf.queue.length = 0;
        deaf.fake.advance(TIMING.gmStoreSyncMs - 1);
        equal(d1.eng.hydration().state, "waiting", "the wait for a silent GM ended before TIMING.gmStoreSyncMs");
        deaf.fake.advance(1);
        equal(d1.eng.hydration().state, "timedOut", "the wait for a silent GM did not end at TIMING.gmStoreSyncMs");

        const stores = new Map([["r170", { sync: true }], ["local", { sync: false }]]);
        const ctx = { amGM: true, senderIsGM: true, senderId: "R170B", selfId: "R170A", worldId: "R170WORLD", stores };
        const delta = (extra = {}) => ({ action: "gms.delta", world: "R170WORLD", store: "r170", delta: { e: { k: { v: 1 } }, t: { k: 5 }, d: {}, cleared: 0 }, ...extra });
        const verdicts = {
            fine: G.gmsRefusal(delta(), ctx),
            player: G.gmsRefusal(delta(), { ...ctx, senderIsGM: false }),
            self: G.gmsRefusal(delta(), { ...ctx, senderId: "R170A" }),
            world: G.gmsRefusal(delta({ world: "R170OTHER" }), ctx),
            store: G.gmsRefusal(delta({ store: "local" }), ctx),
            stamp: G.gmsRefusal(delta({ delta: { e: { k: { v: 1 } }, t: { k: "late" } } }), ctx)
        };
        ok(verdicts.fine === null && Object.entries(verdicts).filter(([k]) => k !== "fine").every(([, why]) => typeof why === "string" && why.length > 0),
            `the receive gate: ${J(verdicts)}`);
        const forged = makeWorld({ order: "fifo", dup: false });
        const target = forged.node("R170A");
        forged.node("R170P", { gm: false });
        forged.active.add("R170A");
        await target.eng.open();
        await target.handle.patch("u1", { realType: "key" });
        const was = J(target.handle.section());
        target.eng.onPacket(delta({ delta: { e: { u1: { realType: "neutral" } }, t: { u1: Number.MAX_SAFE_INTEGER }, d: {}, cleared: 0 } }), "R170P");
        await tick();
        equal(J(target.handle.section()), was, "a delta forged by a player changed a GM's store");
    }],

    ["R173 - a restore never lowers a value, and a backup holds every store that says it is backed up", async () => {
        /*
         * E04, 26.09.2026; audit S05-09. Back up the case writes every GM store with
         * `backup: true` to one file; Restore merges a file back by the sync's own merge,
         * so a GM may restore an old file over a newer copy and lose nothing. Held here
         * without writing: an older file merged over a newer section - a newer row, a
         * tombstone, a reset's cut - keeps every newer value, brings back no tombstoned
         * or cut row, takes the one row it adds, and twice is once; the preview says
         * the same before anything is written; the file takes exactly the stores that
         * say they are backed up, of fakes and of the real table; every store in the
         * table has a name the case's windows show (the offers and the fog had none
         * until the C8/C9 fix: their rows in Restore read as the raw key); a file of a
         * newer format is refused and the Truth Bullet export of every version before
         * E04 is read as the bullets' section.
         */
        const G = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const spec = { name: "r173", split: ["public"] };
        const J = G.stableJson;
        const here = G.emptySection();
        G.writeFields(here, "a", { realType: "key", gmNote: "newer" }, 500, spec);
        G.writeFields(here, "b", { realType: "final" }, 300, spec);
        G.dropKey(here, "c", 450, spec);
        G.raiseCleared(here, 200, spec);
        const file = G.emptySection();
        G.writeFields(file, "a", { realType: "neutral", gmNote: "older" }, 400, spec);
        G.writeFields(file, "b", { realType: "neutral" }, 250, spec);
        G.writeFields(file, "c", { realType: "prep" }, 420, spec);
        G.writeFields(file, "d", { realType: "evident" }, 150, spec);
        G.writeFields(file, "e", { realType: "incident" }, 600, spec);
        const merged = G.mergeSections(here, file, spec);
        equal(J([merged.e.a, merged.e.b, merged.e.c ?? null, merged.e.d ?? null, merged.e.e]),
            J([{ gmNote: "newer", realType: "key" }, { realType: "final" }, null, null, { realType: "incident" }]),
            "a restore lowered a value, brought back a tombstoned or cut row, or lost the row it adds");
        equal(J(G.mergeSections(merged, file, spec)), J(merged), "restoring one file twice is not restoring it once");
        const preview = G.previewSection(here, file, spec);
        equal(J({ inFile: preview.inFile, add: preview.add, refresh: preview.refresh, kept: preview.keptNewerHere, cut: preview.beforeCut }),
            J({ inFile: 5, add: 1, refresh: 0, kept: 3, cut: 1 }), "the preview does not say what the restore does");

        const fake = [
            { name: "backedUp", spec: { backup: true }, section: () => ({ e: { x: { v: 1 } }, t: { x: 1 }, d: {}, cleared: 0 }) },
            { name: "localOnly", spec: { backup: false }, section: () => { throw new Error("R173: a store that is not backed up was read"); } }
        ];
        equal(J(Object.keys(S.caseSections(fake))), J(["backedUp"]), "the backup took a store that says it is not backed up, or left one that says it is");
        const real = G.gmStoreHandles();
        const inFile = Object.keys(S.caseSections(real)).sort();
        ok(inFile.length >= 1, "no GM store is backed up - the table did not load");
        equal(J(inFile), J(real.filter(h => h.spec.backup).map(h => h.name).sort()), "the backup does not hold exactly the stores that say they are backed up");
        // Every store is named where the case's windows speak of it: the preview, the restore's line, the health rows.
        const unnamed = real.filter(h => !game.i18n.has(`DRPG.Case.store.${h.name}`)).map(h => h.name);
        ok(!unnamed.length, `the case's windows have no name for the store(s) ${unnamed.join(", ")}`);
        const built = S.caseFileOf({ sections: S.caseSections(fake), world: { id: "R173WORLD", title: "R173" }, exportedAt: "x", exportedBy: "y" });
        equal(J([built.format, built.version, Object.keys(built.stores)]), J([S.CASE_FORMAT, S.CASE_VERSION, ["backedUp"]]), "the file is not the case format");
        equal(S.readCaseFile(J({ format: S.CASE_FORMAT, version: S.CASE_VERSION + 1, stores: {} })).refused, "newer", "a file of a newer format was not refused");
        // An actor this world does not have: the row is another world's, and counted (R181 reads one it has).
        const flat = S.readCaseFile(J({ "Actor.R173.Item.R173": { realType: "key", updated: 5 } }));
        equal(J([flat.kind, Object.keys(flat.stores?.bullets?.e ?? {}), flat.notThisWorld?.bullets]), J(["flat", [], 1]),
            "the Truth Bullet export of 1.2.62 is not read as the bullets' section, or took another world's row");
    }],

    ["R174 - the case health report counts this world as it stands", async () => {
        /*
         * E04, 26.09.2026; audit S05-09, S04-24. The primary's check at load (and any
         * GM's `game.drpg.gmStoreHealth()`) says what this browser is missing of the
         * case. It reads; it writes nothing (this tier's runner holds it to that). Held:
         * the traces it counts are the Remnant tokens on every scene, and every one of
         * them is missing its answer key, holds it still on its token (a trace
         * `migrateRemnants` has not reached, counted apart since E04's fix round, the
         * review's C-m14), or has one - the three add up; the same for the Truth Bullets
         * in the world; each row is a level the report knows and a
         * sentence both languages carry; and its count of missing rows is its rows.
         */
        needs(world.atLeast("remnantTokens", 1), "the report counts the traces on the map");
        const S = await import("./gm-stores.mjs");
        const { remnantData } = await import("./remnants.mjs");
        const report = await S.gmStoreHealth();
        ok(report?.counts, "a GM's health report carried no counts");
        const tokens = [...game.scenes].flatMap(scene => [...scene.tokens].filter(t => t.getFlag(MODULE_ID, "isRemnant")));
        equal(report.counts.traces.of, tokens.length, "the report counts other traces than the Remnant tokens on every scene");
        equal(report.counts.traces.missing + report.counts.traces.onToken + tokens.filter(t => remnantData(t)).length, tokens.length,
            "traces missing an answer key, traces whose key is still on the token and traces holding one do not add up to the traces on the map");
        const bullets = game.actors.filter(a => a.type === "character").flatMap(a => a.items.filter(i => i.getFlag(MODULE_ID, "category") === "truthBullet"));
        equal(report.counts.bullets.of, bullets.length, "the report counts other bullets than the world's");
        ok(report.rows.every(r => ["missing", "conflict", "info"].includes(r.level) && (game.i18n.has(r.key) || game.i18n.has(`${r.key}.other`))),
            `a row has a level the report does not know or a sentence no language file carries: ${JSON.stringify(report.rows.map(r => [r.level, r.key]))}`);
        equal(report.missing, report.rows.filter(r => r.level === "missing").length, "the count of missing rows is not the rows");
    }],

    ["R175 - a trace's question-mark icon is read, not written", async () => {
        /*
         * E04, 26.09.2026; audit S01-32. The trace icon went from the hazard triangle to
         * the question mark in 1.2.44, and the questionMarkIcon clause rewrote each
         * row's `public.img` in the ledger of the one GM browser that ran it - a world's
         * migration, stamped by whichever browser happened to run it and by no other.
         * The rows are read as the question mark instead (`publicOf`), and only the old
         * default is: an image a GM chose stays. The clause's sweep, read from its
         * source, reaches no ledger. Pure over fixture rows.
         */
        const R = await import("./remnants.mjs");
        const OLD = "icons/svg/hazard.svg";
        const icon = R.publicOf({}).img;
        ok(icon && icon !== OLD, `a row with no public record reads as the icon ${icon}`);
        equal(R.publicOf({ public: { img: OLD } }).img, icon, "a row still naming the hazard triangle is not read as the question mark");
        equal(R.publicOf({ public: { img: "worlds/r175/chosen.webp" } }).img, "worlds/r175/chosen.webp", "an image a GM chose was mapped away");
        equal(R.publicOf({ public: { name: "R175 knife", img: OLD } }).name, "R175 knife", "the mapping lost the record's other fields");
        const sweep = fnSource(stripComments(new Map(await otherSources()).get("remnants.mjs") ?? ""), "adoptQuestionMark");
        ok(/OLD_ICON/.test(sweep), "the sweep's body was not found - the reader is not reading it");
        const reach = sweep.match(/\b(?:remnantStore|setRemnantSecret\w*|readRemnantLedger|SETTINGS\.\w+)/g) ?? [];
        ok(!reach.length, `the questionMarkIcon clause's sweep reaches the ledger: ${reach.join(", ")}`);
    }],

    ["R176 - a player keeps the newer of two stamped copies, and every copy the GM sends is stamped", async () => {
        /*
         * E04, 26.09.2026; audit S06-19. What a player's browser holds of a GM store - the
         * Mastermind's door (C5), and from C6, C8 and C9 the cast, the offers and the fog
         * rows - is a copy a GM sends, and until E04 it was whatever the last GM to answer
         * said: a second GM whose browser held no pick answered "not the Mastermind" and
         * took the part away. A copy is stamped now, and replaced only by a newer stamp
         * (gm-store.mjs, `receiveCopy`). Driven on an engine built with fakes - storage in
         * a Map, a clock that moves when told - so nothing in this browser is written: an
         * answer with no stamp, an older one and an equal one change nothing; a newer one
         * does; one from far in the future is kept at the skew bound, so it cannot lock the
         * copy; a reset's cut above the copy reads as the fallback; and a copy the cut takes
         * something from is drawn again once (C10: a reset sends nothing for the offers).
         *
         * PART BY PART (the review's B1, 26.09): a copy carries a stamp per store field
         * its value came from, and one that is newer in one part and older in another is
         * not newer - a GM that had not merged a newer pick moved the lair and handed the
         * former Mastermind's player "yes" at the room's fresh stamp. The door's own rule
         * (`doorCombine`) is held on the review's case, and the cast's (`castCombine`,
         * C6) on a stale turn, a participant leaving and a trap's end. Then the source:
         * each GM-to-player sender in the table below puts stamps in what it sends, and
         * every call of it passes them - or the sender reads them itself (the offers, C8;
         * the fog's rows, C9).
         */
        const G = await import("./gm-store.mjs");
        const { TIMING } = await import("./config.mjs");
        let t = 5_000_000;
        let cuts = {};
        const store = new Map();
        const eng = G.createGmStoreEngine({
            selfId: () => "R176PLAYER", isGM: () => false, isPrimary: () => false, worldId: () => "R176WORLD",
            activeGmIds: () => [], primaryGmId: () => null, senderIsGM: () => false, userName: u => u, send: () => {},
            storage: { read: k => store.get(k) ?? null, write: async (k, v) => { store.set(k, JSON.stringify(v)); } },
            readLegacy: () => undefined, now: () => t, timers: { set: () => null, clear: () => {} }, clock: () => ({ resetCuts: cuts }),
            log: { warn: () => {}, error: () => {}, debug: () => {} }, notify: () => {}
        });
        const copy = eng.defineCopy({ name: "r176", key: "r176Copy", resetGroup: "mastermind", fallback: { mastermind: false, room: null } });
        const read = () => JSON.stringify(copy.read());
        const yes = { mastermind: true, room: "R176 lair" }, no = { mastermind: false, room: null };
        equal(await copy.receive(no, 0), false, "an answer with stamp 0 was taken");
        equal(await copy.receive(no, undefined), false, "an answer with no stamp was taken");
        equal(read(), JSON.stringify(no), "the copy with nothing received is not the fallback");
        equal(await copy.receive(yes, t - 100), true, "a first stamped answer was not taken");
        equal(read(), JSON.stringify(yes), "the copy does not read what was taken");
        equal(await copy.receive(no, t - 200), false, "an older answer was taken");
        equal(await copy.receive(no, t - 100), false, "an equal stamp was taken");
        equal(read(), JSON.stringify(yes), "an older or equal answer changed the copy");
        equal(await copy.receive(no, t + 50), true, "a newer answer was not taken");
        equal(read(), JSON.stringify(no), "the newer answer does not read back");
        equal(await copy.receive(yes, t + 24 * 3600 * 1000), true, "an answer from far in the future was refused outright");
        equal(copy.stamp(), t + TIMING.gmStoreSkewMs, "a far-future stamp was not kept at the skew bound");
        t += TIMING.gmStoreSkewMs + 1000;
        equal(await copy.receive(no, t), true, "once the bound has passed, a real answer was not taken - one fast clock locked the copy");
        // A copy that is not the fallback, so that reading the fallback under the cut measures the cut (the review's m2).
        equal(await copy.receive(yes, t + 1), true, "a newer yes was not taken");
        cuts = { mastermind: t + 10 };
        equal(read(), JSON.stringify(no), "a yes under its group's reset cut does not read as the fallback");
        equal(await copy.receive(yes, t + 5), false, "an answer under the reset's cut was taken");
        equal(await copy.receive(yes, t + 20), true, "an answer above the reset's cut was refused");

        /* A reset cuts a copy where it is read and sends nothing for a group it only cuts
           (C10; the owner's Q4, the Level Ups on offer), so a copy that held something under
           the new cut is drawn again - once, and not for a cut under what it holds. */
        let drawn = 0;
        const lit = eng.defineCopy({ name: "r176cut", key: "r176Cut", resetGroup: "advancement", fallback: {}, onCut: () => { drawn++; } });
        equal(await lit.receive({ R176ACTOR: { kind: "standard" } }, { R176ACTOR: t + 30 }), true, "an offer was not taken");
        cuts = { ...cuts, advancement: t + 40 };
        await eng.applyCuts();
        equal(JSON.stringify([lit.read(), drawn]), JSON.stringify([{}, 1]), "a copy under a reset's cut does not read empty, or was not drawn again once");
        await eng.applyCuts();
        equal(drawn, 1, "the same cut drew the copy again");
        equal(await lit.receive({ R176ACTOR: { kind: "standard" } }, { R176ACTOR: t + 60 }), true, "an offer after the reset was not taken");
        cuts = { ...cuts, advancement: t + 50 };
        await eng.applyCuts();
        equal(JSON.stringify([lit.read(), drawn]), JSON.stringify([{ R176ACTOR: { kind: "standard" } }, 1]),
            "a cut under what the copy holds took it, or drew it again");
        /* A clock whose cut went down - an older clock put back - and came up again draws nothing
           twice (the round-2 review: without `cut > was` the copy was drawn again, and nothing
           above could tell). */
        cuts = { ...cuts, advancement: t + 70 };
        await eng.applyCuts();
        equal(drawn, 2, "a cut over the offer the copy took after the reset did not draw it again");
        cuts = { ...cuts, advancement: t + 35 };
        await eng.applyCuts();
        cuts = { ...cuts, advancement: t + 70 };
        await eng.applyCuts();
        equal(drawn, 2, "a cut that went down and came back up drew the copy again");

        const parts = eng.defineCopy({ name: "r176parts", key: "r176Parts", resetGroup: "incident", fallback: {} });
        equal(await parts.receive({ n: 1 }, { x: t + 100, y: t + 100 }), true, "a first copy stamped part by part was not taken");
        equal(await parts.receive({ n: 2 }, { x: t + 200, y: t + 50 }), false, "a copy older in one part was taken for being newer in another");
        equal(await parts.receive({ n: 3 }, { x: t + 200, y: t + 100 }), true, "a copy as new in every part and newer in one was refused");
        equal(JSON.stringify(parts.read()), JSON.stringify({ n: 3 }), "the copy taken part by part does not read back");

        const { doorCombine } = await import("./gm-stores.mjs");
        const notHim = { value: { mastermind: false, room: null }, stamps: { actorId: 200, room: 0 } };
        equal(doorCombine(notHim, { value: { mastermind: true, room: "Kitchen" }, stamps: { actorId: 100, room: 300 } }), null,
            "a yes from a GM that has not merged the newer pick was taken for its fresh room (the review's B1)");
        const him = { value: { mastermind: true, room: "Main Hall" }, stamps: { actorId: 200, room: 150 } };
        equal(JSON.stringify(doorCombine(him, { value: { mastermind: true, room: "Kitchen" }, stamps: { actorId: 200, room: 300 } })?.value),
            JSON.stringify({ mastermind: true, room: "Kitchen" }), "the moved lair, at the same pick, was not taken");
        equal(JSON.stringify(doorCombine(him, { value: { mastermind: false, room: null }, stamps: { actorId: 250 } })),
            JSON.stringify({ value: { mastermind: false, room: null }, stamps: { actorId: 250, room: 0 } }),
            "a newer no did not take the part and the lair away");
        equal(doorCombine(him, { value: { mastermind: false, room: null }, stamps: { actorId: 200 } }), null, "a no at the same pick was taken");

        // The cast's rule (C6): the whole cast part by part, "not in it" by the seats alone.
        const { castCombine } = await import("./gm-stores.mjs");
        const castParts = (seats, rest) => ({ killerId: seats, victimId: seats, thirdId: seats, betrayal: seats,
            killerTurnId: rest, thirdSide: rest, lastCrisis: rest });
        const inIt = { value: { killerId: "K", victimId: "V", thirdId: "T", killerTurnId: "K" }, stamps: { ...castParts(100, 100), thirdId: 200 } };
        equal(castCombine(inIt, { value: { killerId: "K", victimId: "V", thirdId: null, killerTurnId: "V" },
            stamps: { ...castParts(100, 100), thirdId: 150, killerTurnId: 400 } }), null,
            "a cast older in its third's seat was taken for a fresher turn");
        const seatsOnly = { killerId: 100, victimId: 100, thirdId: 250, betrayal: 100 };
        equal(JSON.stringify(castCombine(inIt, { value: {}, stamps: seatsOnly })), JSON.stringify({ value: {}, stamps: seatsOnly }),
            "a newer seat's \"not in it\" did not empty the copy, or kept parts beside the seats");
        equal(castCombine(inIt, { value: {}, stamps: { ...seatsOnly, thirdId: 200 } }), null, "a \"not in it\" at the seats' own stamps was taken");
        equal(castCombine({ value: {}, stamps: seatsOnly }, { value: { thirdId: "T" }, stamps: { ...castParts(100, 100), thirdId: 200 } }), null,
            "a cast from before the seat moved was taken by the one who left");
        // A trap's killer, answered "not in it" while it ran, and sent the cast at its end at the same seats.
        equal(castCombine({ value: {}, stamps: { ...seatsOnly, thirdId: 0 } }, { value: { killerId: "K" }, stamps: { ...castParts(100, 120), thirdId: 0 } })?.value?.killerId,
            "K", "the cast sent at a trap's end was refused by its killer's \"not in it\"");

        /* The offers' rule (the round-2 review's M2): an answer is the owner's whole set, weighed
           by the characters it names - a character that left the owner's set is not a part the
           answer holds at 0. */
        const { offersCombine, offerCopy } = await import("./gm-stores.mjs");
        ok(G.gmCopySpec(offerCopy.name)?.combine === offersCombine, "the offers copy is not weighed by its own rule");
        const offersHeld = { value: { A: { kind: "standard" } }, stamps: { A: 150 } };
        equal(JSON.stringify(offersCombine(offersHeld, { value: { C: { kind: "standard" } }, stamps: { B: 0, C: 200 } })),
            JSON.stringify({ value: { C: { kind: "standard" } }, stamps: { B: 0, C: 200 } }),
            "an answer naming the owner's characters now was refused for one that left the owner's set, or kept it");
        equal(offersCombine(offersHeld, { value: {}, stamps: { A: 100, C: 200 } }), null, "an answer older for a character it names was taken");
        equal(offersCombine(offersHeld, { value: { A: { kind: "standard" } }, stamps: { A: 150 } }), null, "an answer that changes nothing was taken");
        equal(offersCombine(offersHeld, { value: { A: { kind: "standard" } }, stamps: { A: 140 } }, { cut: 160 }), null,
            "an answer under a reset's cut was taken");

        /* THE NOTE'S COPY (E05 C6): one stamp, and a draft - a player's own note written in their
           browser and marked unsent, which no GM's copy carries (pre-session-note.mjs). On the same
           engine: the draft is taken under an older stamp than the copy held; a GM's copy with other
           words is not taken while it stands, however new - the answer to an ask at load can reach
           the player before the draft reaches the GM; the GMs' copy holding the draft's words is
           taken under any stamp, and the draft is sent; then the newer stamp decides, and a reset's
           cut above the copy reads as nothing. */
        const { noteCombine, noteCopy } = await import("./gm-stores.mjs");
        ok(G.gmCopySpec(noteCopy.name)?.combine === noteCombine, "the note's copy is not weighed by its own rule");
        const note = eng.defineCopy({ name: "r176note", key: "r176Note", resetGroup: "preNotes", fallback: {}, combine: noteCombine });
        const n0 = t + 1000;
        equal(await note.receive({ text: "R176 the GMs' words" }, n0 + 100), true, "a first copy of the note was not taken");
        equal(await note.receive({ text: "R176 typed here", unsent: true }, n0 + 10), true, "the player's own draft was refused under an older stamp");
        equal(await note.receive({ text: "R176 older words" }, n0 + 500), false, "a GM's copy with other words replaced a draft not yet sent");
        equal(await note.receive({ text: "R176 typed here" }, n0 + 5), true, "the GMs' copy holding the draft's words was refused");
        equal(JSON.stringify([note.read(), note.stamp()]), JSON.stringify([{ text: "R176 typed here" }, n0 + 5]),
            "the draft was not marked sent at the GMs' stamp");
        equal(await note.receive({ text: "R176 a GM's older write" }, n0 + 4), false, "an older copy of a sent note was taken");
        equal(await note.receive({ text: "R176 a GM's transcription" }, n0 + 600), true, "a newer copy of a sent note was refused");
        cuts = { ...cuts, preNotes: n0 + 700 };
        equal(JSON.stringify(note.read()), "{}", "a note under its group's reset cut does not read as nothing");

        /* The senders: the function that emits a copy to a player, and the file that calls it.
           "own": the sender reads the stamps itself - the offers', from the store's rows for the
           user's characters (C8), the fog's, a section of the store (C9), and since E05 the
           crossings' and the note's (C4, C6) - so a call of it passes none. */
        const SENDERS = [["mastermind.mjs", "sendDoorFlag"], ["incident-store.mjs", "sendCast"], ["gm-bridge.mjs", "sendOffersTo", "own"],
            ["fog.mjs", "sendStoreTo", "own"], ["eclipse.mjs", "sendMovesTo", "own"], ["pre-session-note.mjs", "sendNoteTo", "own"],
            // E05 C10: the deaths a player may know, a stamp per body read off the store's rows.
            ["incident-store.mjs", "sendDeathsTo", "own"],
            // E05 C13: which trace each of a player's bullets came from, a stamp per bullet read off the rows.
            ["truth-bullets.mjs", "sendBulletRefsTo", "own"]];
        // The crossings' copy (E05 C4) is an owner's whole set, a stamp per character, as the offers are;
        // and so is the bullets' keys' (E05 C13), a stamp per bullet.
        const { eclipseMoveCopy, bulletRefCopy } = await import("./gm-stores.mjs");
        ok(G.gmCopySpec(eclipseMoveCopy.name)?.combine === offersCombine, "the crossings' copy is not weighed by the offers' rule");
        ok(G.gmCopySpec(bulletRefCopy.name)?.combine === offersCombine, "the bullets' keys' copy is not weighed by the offers' rule");
        const sources = new Map(await otherSources());
        const found = [];
        for (const [file, fn, own] of SENDERS) {
            const src = stripComments(sources.get(file) ?? "");
            const body = fnSource(src, fn);
            if (!/\bemit\([^;]*\bstamps?\b/.test(body)) found.push(`${file} ${fn} emits no stamp`);
            const calls = [...src.matchAll(new RegExp(`\\b${fn}\\(([^;]*)\\);`, "g"))].filter(m => !/^\s*function\b/.test(src.slice(Math.max(0, m.index - 9), m.index + 1)));
            if (!calls.length) found.push(`${file} ${fn} is called nowhere - take its row out`);
            if (!own) for (const m of calls) if (!/stamp/i.test(m[1])) found.push(`${file}: ${fn}(${m[1].slice(0, 60)}) passes no stamp`);
        }
        ok(!found.length, `a copy goes to a player without a stamp: ${found.join("; ")}`);
    }],

    ["R180 - a browser that takes over its old store after a season reset is cut by the reset", async () => {
        /*
         * E04's fix round, 26.09.2026; the data-safety review's round-2 note on C10. A GM's
         * browser that first opens 1.2.63 after a season reset has only its old key: it
         * claims last season's rows then, alone, with nobody to hand it the reset's clear.
         * The reset's cut is in the clock, and the store's open applies it after the claim,
         * so what the claim took under the cut dies there - a row at its old stamp and one
         * with none (weak) alike - and the census still counts both as taken. Driven on an
         * engine built with fakes: storage in a Map, an old key, a clock with a cut.
         */
        const G = await import("./gm-store.mjs");
        const CUT = 7_000_000;
        const store = new Map();
        const legacy = { r180a: { v: "last season", updated: CUT - 500 }, r180b: { v: "never stamped" } };
        const flushes = [];
        const engineWith = cuts => G.createGmStoreEngine({
            selfId: () => "R180GM", isGM: () => true, isPrimary: () => true, worldId: () => "R180WORLD",
            activeGmIds: () => ["R180GM"], primaryGmId: () => "R180GM", senderIsGM: () => true, userName: u => u, send: () => {},
            storage: { read: k => store.get(k) ?? null, write: async (k, v) => { store.set(k, JSON.stringify(v)); } },
            readLegacy: k => (k === "r180Old" ? structuredClone(legacy) : undefined), now: () => CUT + 60_000,
            timers: { set: fn => { flushes.push(Promise.resolve().then(fn)); return flushes.length; }, clear: () => {} },
            clock: () => ({ resetCuts: cuts }), log: { warn: () => {}, error: () => {}, debug: () => {} }, notify: () => {}
        });
        const spec = { name: "r180", key: "r180Key", legacyKey: "r180Old", kind: "ledger", resetGroup: "remnants", sync: true, backup: true,
            claim: old => ({ rows: Object.entries(old).map(([key, row]) => ({ key, fields: { v: row.v }, stamp: row.updated })), left: [] }) };

        const cut = engineWith({ remnants: CUT });
        const afterReset = cut.define(spec);
        await cut.open();
        await Promise.all(flushes);
        equal(JSON.stringify([Object.keys(afterReset.entries()), afterReset.cleared()]), JSON.stringify([[], CUT]),
            "the rows a browser claimed after a reset survived the reset's cut");
        equal(JSON.stringify(afterReset.census()), JSON.stringify({ legacy: 2, claimed: 2, left: 0, tombstones: 0, reasons: {} }),
            "the claim did not count what it took before the cut took it");

        store.clear();
        const none = engineWith({});
        const noReset = none.define(spec);
        await none.open();
        await Promise.all(flushes);
        equal(JSON.stringify(Object.keys(noReset.entries()).sort()), JSON.stringify(["r180a", "r180b"]),
            "with no reset in the clock the claim's rows did not stand - the first half measured nothing");
    }],

    ["R179 - a world that was in play keeps its safeword", async () => {
        /*
         * E04 C11, 26.09.2026; audit S01-14. The clause that keeps a world's old safeword
         * ran only for a stamped world, and the public v1.1.0 - which `releases/latest`
         * named for a long time - wrote no stamp: a table updating straight from it was
         * given "Safe Word" in silence, where its word was the language file's. The world
         * is asked now whether it was played (migrate.mjs `worldWasInPlay`), before the
         * migration writes anything. Driven with fakes: a stored clock - in v14's
         * collection, which answers `getSetting`, and in a Map - a character carrying the
         * module's flags and a table carrying its category each say yes; a world whose
         * only flagged actor is a Monokuma, and an empty one, say no. Then the source: the
         * automatic pass reads the world before the migration starts and hands it to the
         * clauses, and the clause asks it beside the stamp.
         */
        const M = await import("./migrate.mjs");
        const clockKey = `${MODULE_ID}.${SETTINGS.clock}`;
        const stored = new Map([[clockKey, { chapter: 3 }]]);
        const cases = [
            ["a stored clock (v14's collection)", { world: { getSetting: key => (key === clockKey ? { key, value: {} } : undefined) } }, true],
            ["a stored clock (a Map)", { world: stored }, true],
            ["a character with the module's flags", { actors: [{ flags: { [MODULE_ID]: { startingSheet: {} } } }] }, true],
            ["a table with the module's category", { tables: [{ flags: { [MODULE_ID]: { category: "weapon" } } }] }, true],
            ["a Monokuma alone", { world: new Map([["core.other", 1]]), actors: [{ flags: { [MODULE_ID]: { monokuma: true } } }, { flags: { daggerheart: { x: 1 } } }],
                tables: [{ flags: { [MODULE_ID]: {} } }] }, false],
            ["an empty world", {}, false]
        ];
        const wrong = cases.filter(([, world, want]) => M.worldWasInPlay(world) !== want).map(([what, , want]) => `${what} (expected ${want})`);
        ok(!wrong.length, `worldWasInPlay misreads: ${wrong.join("; ")}`);

        const src = stripComments(new Map(await otherSources()).get("migrate.mjs") ?? "");
        const load = fnSource(src, "runMigrationOnLoad");
        // The pass is kept as `onLoad` for the suite's wait (R188, E04's fix round).
        ok(/const wasInPlay = worldWasInPlay\(worldAsFound\(\)\);\s*(?:onLoad = )?migrate1_2_0\(\{ quiet: true, wasInPlay \}\)/.test(load),
            "the automatic pass does not read the world before the migration starts, or does not hand it on");
        ok(/clause\.run\(\{ from, to, force, wasInPlay: inPlay \}\)/.test(fnSource(src, "migrate1_2_0")), "the clauses are not told whether the world was in play");
        ok(/if \(!from && !wasInPlay\) return null;/.test(fnSource(src, "keepOldSafeword")), "the safeword is kept for a stamped world only");
    }],

    ["R181 - a restore takes no file's watermark, no other world's removal and no stamp beyond the clock", async () => {
        /*
         * E04's fix round, 26.09.2026; the reviews' DS-M1 = C-m6, S-M1 = DS-m11 = C-m12,
         * S-M2, C-m11 and the round-2 note on the restore's delta. What a restore takes of
         * a file is `fileSection`, pure, and what it says it will do is `previewSection`
         * over that. Held: a file's watermark is never taken - two older rows here survive
         * a file cut after them, and the preview of the raw file says it would have removed
         * both; another world's removal is not taken, this world's is, and is counted; a
         * field far ahead and a tombstone a year ahead are taken at the restore's moment
         * and counted, one within the clock's bound is kept, and a real write the next
         * moment wins; a split field's part named `__proto__` is refused by the gate and
         * never reaches the merged row's prototype. Then the file: a version that is not a
         * whole number is not this module's; a section with a string stamp, or such a part,
         * refuses the file naming the store; a refusal's sentence carries no angle bracket
         * the file gave; an old export's rows of another world are left out and counted.
         * Last, on an engine built with fakes: one flush of 300 KB goes to the other GMs in
         * parts no larger than a state's, every row in one of them.
         */
        const G = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const J = G.stableJson;
        const spec = { name: "r181", split: ["public"] };
        const here = G.emptySection();
        G.writeFields(here, "a", { realType: "key" }, 1000, spec);
        G.writeFields(here, "b", { realType: "final" }, 1500, spec);
        const file = G.emptySection();
        G.writeFields(file, "x", { realType: "prep" }, 2500, spec);
        G.raiseCleared(file, 2000, spec);
        equal(G.previewSection(here, file, spec).remove, 2, "the preview of a file cut after two rows here does not say it would remove them");
        const taken = G.fileSection(file, { now: 10_000 }).section;
        equal(taken.cleared, 0, "a restore takes the file's watermark");
        equal(J(Object.keys(G.mergeSections(here, taken, spec).e).sort()), J(["a", "b", "x"]), "a file's watermark removed this browser's older rows");
        equal(J(G.previewSection(here, taken, spec)), J({ inFile: 1, add: 1, refresh: 0, keptNewerHere: 0, beforeCut: 0, beforeCutKeys: [], remove: 0 }),
            "the preview of the file as a restore takes it does not say one new row and nothing removed");

        const removal = { e: {}, t: {}, d: { a: 3000 }, cleared: 0 };
        equal(J(Object.keys(G.mergeSections(here, G.fileSection(removal, { now: 10_000, otherWorld: true }).section, spec).e).sort()), J(["a", "b"]),
            "another world's removal was taken");
        const own = G.fileSection(removal, { now: 10_000 }).section;
        equal(J([Object.keys(G.mergeSections(here, own, spec).e), G.previewSection(here, own, spec).remove]), J([["b"], 1]),
            "this world's newer removal was not taken, or not counted");

        const NOW = 5_000_000, SKEW = 600_000;
        const ahead = G.emptySection();
        G.writeFields(ahead, "far", { realType: "incident" }, 1e15, spec);
        G.dropKey(ahead, "gone", NOW + 365 * 86_400_000, spec);
        G.writeFields(ahead, "near", { realType: "prep" }, NOW + SKEW - 1, spec);
        const bounded = G.fileSection(ahead, { now: NOW, skew: SKEW });
        equal(J([bounded.clamped, bounded.section.t.far, bounded.section.d.gone, bounded.section.t.near]), J([2, NOW, NOW, NOW + SKEW - 1]),
            "a stamp beyond the clock's bound was kept, one within it was moved, or they were not counted");
        const later = G.mergeSections(here, bounded.section, spec);
        G.writeFields(later, "far", { realType: "key" }, NOW + 1, spec);
        equal(G.mergeSections(later, bounded.section, spec).e.far?.realType, "key", "a real write after the restore did not win over a stamp the file ran ahead");

        const planted = JSON.parse('{"e":{"k":{"public":{"__proto__":{"playerText":"R181 planted"},"name":"n"}}},"t":{"k":{"":5,"public":5}},"d":{},"cleared":0}');
        ok(G.sectionProblem(planted, spec), "a split field's part named __proto__ passed the gate");
        const through = G.mergeSections(G.emptySection(), planted, spec);
        equal(J([Object.getPrototypeOf(through.e.k?.public ?? {}) === Object.prototype, through.e.k?.public?.playerText ?? null]), J([true, null]),
            "a part named __proto__ set the merged row's prototype");

        const caseFile = stores => J({ format: S.CASE_FORMAT, version: S.CASE_VERSION, world: { id: game.world.id, title: "R181" }, stores });
        equal(S.readCaseFile(J({ format: S.CASE_FORMAT, version: "<b>1</b>", stores: {} })).refused, "unreadable", "a version that is not a number was read");
        equal(S.readCaseFile(J({ format: S.CASE_FORMAT, version: 1.5, stores: {} })).refused, "unreadable", "a version that is not a whole number was read");
        const badStamp = S.readCaseFile(caseFile({ bullets: { e: { "Actor.R181.Item.R181": { realType: "key" } }, t: { "Actor.R181.Item.R181": "1800000000500" }, d: {}, cleared: 0 } }));
        equal(J([badStamp.refused, badStamp.store]), J(["malformed", "bullets"]), "a section stamped with a string was read");
        const badPart = S.readCaseFile(caseFile({ remnants: planted }));
        equal(J([badPart.refused, badPart.store]), J(["malformed", "remnants"]), "a trace's public part named __proto__ was read");
        const text = S.caseRefusalText({ refused: "otherWorld", world: { id: "x", title: "<img src=x onerror=alert(1)>" } })
            + S.caseRefusalText({ refused: "newer", version: 99 });
        ok(!/[<>]/.test(text) && /99/.test(text), `a refusal's sentence carries what the file gave as markup: ${text}`);

        const sent = [];
        const flushes = [];
        const bus = G.createGmStoreEngine({
            selfId: () => "R181GM", isGM: () => true, isPrimary: () => true, worldId: () => "R181WORLD",
            activeGmIds: () => ["R181GM", "R181PEER"], primaryGmId: () => "R181GM", senderIsGM: () => true, userName: u => u,
            send: packet => sent.push(packet), storage: { read: () => null, write: async () => {} }, readLegacy: () => undefined,
            now: () => NOW, timers: { set: fn => { flushes.push(Promise.resolve().then(fn)); return flushes.length; }, clear: () => {} },
            clock: () => ({}), log: { warn: () => {}, error: () => {}, debug: () => {} }, notify: () => {}
        });
        const big = bus.define({ name: "r181", key: "r181Key", kind: "ledger", sync: true, backup: true });
        const rows = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`row${i}`, { note: "x".repeat(1000) }]));
        await big.patchMany(rows);
        await Promise.all(flushes);
        const deltas = sent.filter(p => p.action === G.GMS_ACTIONS.delta);
        const inParts = new Set(deltas.flatMap(p => Object.keys(p.delta.e)));
        equal(J([deltas.length > 1, deltas.every(p => J(p.delta).length <= 256 * 1024 + 2048), inParts.size]), J([true, true, 300]),
            `one flush of 300 KB went out as ${deltas.length} packet(s) of ${deltas.map(p => J(p.delta).length).join(", ")} characters`);

        needs(world.atLeast("livingStudents", 1), "the old export's world filter is read with a student of this world");
        const [student] = studentActors();
        const flat = S.readCaseFile(J({ [`Actor.${student.id}.Item.R181`]: { realType: "key", updated: 5 }, "Actor.R181NOTHERE0000.Item.R181": { realType: "final", updated: 5 } }));
        equal(J([Object.keys(flat.stores.bullets.e), flat.stores.bullets.t[`Actor.${student.id}.Item.R181`], flat.notThisWorld?.bullets]),
            J([[`Actor.${student.id}.Item.R181`], 5, 1]), "the old export's row of this world was not taken at its stamp, or another world's was taken, or not counted");
    }],

    ["R183 - a write of the cast stamps only the fields it names, and no turn is worked out from a browser with no cast", async () => {
        /*
         * E04's fix round, 26.09.2026; the round-2 review's M1. `writeCast` stamped every field
         * of the record - the caller's value, or null - so a GM whose browser held no cast
         * passed the turn and stamped null over every other GM's killer (their scenario 97).
         * What a write stamps is `castFieldsToWrite`, pure: the fields it names, and a field
         * this browser held that it leaves out - a removal. And the two writes an incident's
         * turn works out from what this browser holds - the pass, a third walking in - ask
         * `castHeldHere` before they write (61 F6 drives the pass).
         */
        const M = await import("./murder.mjs");
        const J = JSON.stringify;
        equal(J(M.castFieldsToWrite({ killerTurnId: "B" }, {})), J({ killerTurnId: "B" }), "a write from a browser with no cast stamped fields it does not name");
        equal(J(M.castFieldsToWrite({ killerId: "K", victimId: "V", killerTurnId: "K" }, { killerId: "K", victimId: "V", betrayal: { thirdId: "T" } })),
            J({ killerId: "K", killerTurnId: "K", victimId: "V", betrayal: null }), "a field the write left out of what this browser held was not removed");
        equal(J(M.castFieldsToWrite({ thirdId: null, notAField: 1 }, { thirdId: "T" })), J({ thirdId: null }),
            "a named null was not written, or a field the record does not have was");
        const sources = new Map(await otherSources());
        const src = stripComments(sources.get("murder-rules.mjs") ?? "");
        ok(/const fields = castFieldsToWrite\(next, previous\);/.test(fnSource(stripComments(sources.get("incident-store.mjs") ?? ""), "writeCast")), "writeCast does not stamp what castFieldsToWrite names");
        for (const fn of ["passTurn", "thirdPartyEnters"]) {
            const body = fnSource(src, fn);
            const asked = body.indexOf("castHeldHere(state)"), wrote = body.indexOf("writeState(");
            ok(asked > 0 && wrote > asked, `${fn} writes before it asks whether this browser holds the cast`);
        }
    }],

    ["R184 - no player is told anything from a store while tier 2 holds the stores, and a request waits for it", async () => {
        /*
         * E04's fix round, 26.09.2026; the round-2 reviews' R2-M1 and M3, the fix list's
         * 13. Tier 2 writes fixtures into this world's records with the stores held, and
         * into a world the stores never opened; the hold covered what the GMs send each
         * other, and nothing a player is sent: the primary's watches, the fog's pushes and
         * every answer to a player's request carried the fixtures to real players, at
         * stamps that outlived tier 2's restore. Held here, from the source: each of the
         * four senders of a player's copy asks `gmStoresQuiet` before it sends; each of
         * the four requests for one waits for `whenGmStoresAudible` before it reads the
         * store; both watches ignore a change while the stores are quiet, what the
         * players were last told does not move meanwhile, and once the stores are let go
         * the record is held against it by the watch's own comparison - a change another
         * GM made meanwhile is told (61 E6, F5: taken as the baseline at the release, it
         * was told to nobody), and tier 2's raw restore compares equal. The engine's half
         * on a fake: `whenAudible` resolves when the hold ends, and not while a stand-in
         * world is still set.
         */
        const sources = new Map(await otherSources());
        const src = file => stripComments(sources.get(file) ?? "");
        const found = [];
        for (const [file, fn] of [["mastermind.mjs", "sendDoorFlag"], ["incident-store.mjs", "sendCast"], ["gm-bridge.mjs", "sendOffersTo"], ["fog.mjs", "sendStoreTo"]]) {
            const body = fnSource(src(file), fn);
            const asked = body.indexOf("gmStoresQuiet()"), sent = body.search(/\bemit\(/);
            if (asked < 0 || sent < asked) found.push(`${file} ${fn} sends without asking whether the suite holds the stores`);
        }
        for (const [file, fn, reads] of [["mastermind.mjs", "registerMastermind", "const mine = readStore();"], ["incident-store.mjs", "registerIncidentCastSync", "const cast = readCast();"],
            ["fog.mjs", "registerLedgerRoad", "sendStoreTo(sender);"], ["gm-bridge.mjs", "handleAdvancementAsk", "sendOffersTo(sender.id)"]]) {
            const body = fnSource(src(file), fn);
            const waited = body.indexOf("whenGmStoresAudible()"), read = body.indexOf(reads);
            if (waited < 0 || read < waited) found.push(`${file} ${fn} answers a player's request before the suite lets the stores go`);
        }
        for (const [file, key, compare, tell, baseline] of [["mastermind.mjs", "mastermind", "tellDoorChange", "notifyDoorAccess", "told"],
            ["incident-store.mjs", "incidentCast", "tellCastChange", "pushCastToParticipants", "castTold"]]) {
            const text = src(file);
            // The watch: `if (key !== \`${MODULE_ID}.${SETTINGS.<key>}\` || ... || gmStoresQuiet()) return;` and then the comparison.
            const watch = new RegExp(`key !== \`\\$\\{MODULE_ID\\}\\.\\$\\{SETTINGS\\.${key}\\}\`[^\\n]*\\|\\| gmStoresQuiet\\(\\)\\) return;\\s*${compare}\\(\\);`);
            if (!watch.test(text)) found.push(`${file}: the watch of ${key} tells a change made while the stores are quiet, or does not compare it (${compare})`);
            if (!new RegExp(`onGmStoresAudible\\([^\\n]*\\b${compare}\\(\\)`).test(text)) found.push(`${file}: nothing holds the record against what the players were told when the suite lets the stores go`);
            if (!new RegExp(`if \\(!gmStoresQuiet\\(\\)\\) ${baseline} = `).test(fnSource(text, tell))) found.push(`${file}: ${tell} moves what the players were told while the stores are quiet`);
        }
        ok(!found.length, found.join("; "));

        const G = await import("./gm-store.mjs");
        const eng = G.createGmStoreEngine({
            selfId: () => "R184GM", isGM: () => true, isPrimary: () => true, worldId: () => "R184WORLD",
            activeGmIds: () => ["R184GM"], primaryGmId: () => "R184GM", senderIsGM: () => true, userName: u => u, send: () => {},
            storage: { read: () => null, write: async () => {} }, readLegacy: () => undefined, now: () => 1_000_000,
            timers: { set: fn => { Promise.resolve().then(fn); return 1; }, clear: () => {} },
            clock: () => ({}), log: { warn: () => {}, error: () => {}, debug: () => {} }, notify: () => {}
        });
        let woke = 0, told = 0;
        eng.onAudible(() => { told++; });
        equal(eng.quiet(), false, "the stores read as held before anything held them");
        eng.hold(true);
        const waiting = eng.whenAudible().then(() => { woke++; });
        let insideWorld = null;
        await eng.withWorld("R184STANDIN", async () => {
            eng.hold(false);
            await Promise.resolve();
            insideWorld = [eng.quiet(), woke, told];
        });
        await waiting;
        equal(JSON.stringify([insideWorld, eng.quiet(), woke, told]), JSON.stringify([[true, 0, 0], false, 1, 1]),
            "a request waiting on the suite was answered while a stand-in world was still set, or not once it ended");
    }],

    ["R185 - the case is marked from the bullets and the traces alone, and the health window acts on what it showed", async () => {
        /*
         * E04's fix round, 26.09.2026; the reviews' S-m4 and DS-m7. `caseMark.since` is
         * world data every client reads: written the first time any store held a row, its
         * arrival in a world with no trace and no bullet yet told a player's console that a
         * Mastermind had been picked. Only the stores whose rows stand for world documents
         * count now (`caseHasRows`). And the upgrade day's decision is acted on only while
         * it is the one the window showed (`sameDecision`; 61 E9 drives the window).
         */
        const S = await import("./gm-stores.mjs");
        const h = (name, n) => ({ name, entries: () => Object.fromEntries(Array.from({ length: n }, (_, i) => [`R185${i}`, {}])) });
        equal(S.caseHasRows([h("mastermind", 1), h("offers", 2), h("cast", 1), h("bullets", 0)]), false, "a pick, an offer or a cast alone marked the case");
        equal(S.caseHasRows([h("mastermind", 1), h("remnants", 1)]), true, "a trace's row did not mark the case");
        equal(S.caseHasRows([h("bullets", 1)]), true, "a bullet's row did not mark the case");
        const shown = { pick: "R185A", clearedAt: 20, pickedAt: 10 };
        equal(JSON.stringify([S.sameDecision(shown, { ...shown }), S.sameDecision(shown, { ...shown, pick: "R185B" }),
            S.sameDecision(shown, { ...shown, pickedAt: 30 }), S.sameDecision(shown, null), S.sameDecision(null, shown)]),
            JSON.stringify([true, false, false, false, false]), "the window's decision is read as the one it showed after the record changed, or not when it did not");
    }],

    ["R186 - a failed save says who holds a copy, a crossed tab's write is written back, and a player's browser writes no GM store", async () => {
        /*
         * E04's fix round, 26.09.2026; the reviews' DS-m4 = C-m8, DS-m8 and the round-2
         * R2-m1 = m1. On engines built with fakes. A save that fails - a full origin - told a
         * GM alone that "the other GMs hold a copy": the notice now says so only with another
         * GM connected, and asks for a backup either way. Two tabs of one browser whose flushes
         * cross leave the stored value without one tab's write: that tab merged the other's
         * storage event and kept its own row in memory only, lost with the tab; it writes it
         * back now. And a store written through a handle on a client that is not a GM's is
         * refused, its storage never written.
         */
        const G = await import("./gm-store.mjs");
        const { MODULE_ID } = await import("./config.mjs");
        const quiet = { warn: () => {}, error: () => {}, debug: () => {} };
        const engineOf = ({ store = new Map(), gms = ["R186A"], gm = true, fail = false } = {}) => {
            const flushes = [], notices = [];
            const eng = G.createGmStoreEngine({
                selfId: () => "R186A", isGM: () => gm, isPrimary: () => gm, worldId: () => "R186WORLD",
                activeGmIds: () => gms, primaryGmId: () => gms[0], senderIsGM: () => true, userName: u => u, send: () => {},
                storage: { read: k => store.get(k) ?? null, write: async (k, v) => { if (fail) throw new Error("R186 full"); store.set(k, JSON.stringify(v)); } },
                readLegacy: () => undefined, now: () => 5_000_000,
                timers: { set: fn => { flushes.push(Promise.resolve().then(fn)); return flushes.length; }, clear: () => {} },
                clock: () => ({}), log: quiet, notify: (level, text) => notices.push([level, text]), text: key => key
            });
            const handle = eng.define({ name: "r186", key: "r186Key", kind: "ledger", sync: true, backup: true });
            return { eng, handle, store, notices, settle: async () => { for (let i = 0; i < 4; i++) await Promise.all(flushes); } };
        };

        const alone = engineOf({ fail: true }), withPeer = engineOf({ fail: true, gms: ["R186A", "R186B"] });
        for (const e of [alone, withPeer]) {
            await e.handle.patch("x", { v: 1 });
            await e.settle();
        }
        equal(JSON.stringify([alone.notices, withPeer.notices]),
            JSON.stringify([[["error", "DRPG.GmStore.saveFailedAlone"]], [["error", "DRPG.GmStore.saveFailed"]]]),
            "a failed save told a GM alone that another GM held a copy, or said nothing");

        const tab = engineOf();
        await tab.handle.patch("x", { v: 1 });
        await tab.settle();
        const theirs = JSON.stringify({ v: 1, worlds: { R186WORLD: { e: { y: { v: 2 } }, t: { y: 4_000_000 }, d: {}, cleared: 0 } } });
        tab.store.set("r186Key", theirs);
        tab.eng.onStorage(`${MODULE_ID}.r186Key`, theirs);
        await tab.settle();
        const stored = JSON.parse(tab.store.get("r186Key") ?? "{}")?.worlds?.R186WORLD?.e ?? {};
        equal(JSON.stringify(Object.keys(stored).sort()), JSON.stringify(["x", "y"]),
            "a tab whose write another tab's crossed flush left out did not write it back");

        const player = engineOf({ gm: false });
        await player.handle.patch("x", { v: 1 });
        await player.handle.mergeIn({ e: { y: { v: 2 } }, t: { y: 5 }, d: {}, cleared: 0 }, { source: "sync" });
        await player.settle();
        equal(JSON.stringify([player.handle.get("x"), player.handle.get("y"), player.store.size]), JSON.stringify([null, null, 0]),
            "a client that is not a GM's wrote a GM store");
    }],

    ["R188 - the suite's first reading of the world waits for the load's own writes", async () => {
        /*
         * E04's fix round, 26.09.2026. A load writes after `ready` - the migration's pass
         * on the primary GM, each GM store's claim and first save, the case's marks - and
         * since E04 the migration waits for the stores, which wait for the other GMs'
         * copies. A run started in that window failed "tier 0/1 changed nothing in the
         * world" on the load's writes: in 49 of the 139 runs of this stage's scratch
         * runner, which starts the suite straight after the load. Held here from the
         * source: the
         * runner waits (`loadSettled`, bounded) before its first reading of the world, on
         * the stores and on the migration; the stores' wait covers the hydration, the
         * compaction, the case's marks and the saves, and the two hydration hooks and the
         * migration hand it their work. On this client, whose load is long over, the
         * stores' wait resolves.
         */
        const all = new Map(await moduleSources());
        const src = file => stripComments(all.get(file) ?? "");
        const found = [];
        const suite = fnSource(src("tests.mjs"), "runSuite");
        const waited = suite.indexOf("await loadSettled()"), first = suite.indexOf("worldDump()");
        if (waited < 0 || first < waited) found.push("runSuite reads the world before it waits for the load");
        const settled = fnSource(src("tests.mjs"), "loadSettled");
        for (const call of ["whenGmStoresLoaded()", "migrationOnLoad()"]) if (!settled.includes(call)) found.push(`loadSettled does not wait for ${call}`);
        const loaded = fnSource(src("gm-stores.mjs"), "whenGmStoresLoaded");
        for (const step of ["await whenGmStoresHydrated()", "compacting", "marking", "await gmStoresIdle()"]) {
            if (!loaded.includes(step)) found.push(`whenGmStoresLoaded does not wait for ${step}`);
        }
        const stores = src("gm-stores.mjs");
        if (!/\bcompacting = compactGmStores\(\)/.test(stores)) found.push("the compaction is not handed to the wait");
        if (!/\bmarking = marked\b/.test(stores)) found.push("the case's marks are not handed to the wait");
        if (!/\bonLoad = migrate1_2_0\(/.test(src("migrate.mjs"))) found.push("the migration's pass is not handed to the wait");
        ok(!found.length, found.join("; "));
        const { whenGmStoresLoaded } = await import("./gm-stores.mjs");
        const resolved = await Promise.race([whenGmStoresLoaded().then(() => true), wait(5000).then(() => false)]);
        ok(resolved, "the stores' wait for the load did not resolve in 5 s on a client whose load is long over");
    }],

    ["R187 - an Analyze and a handover wait for the other GMs' copies before they call a key missing, and the case says whose old rows wait", async () => {
        /*
         * E04's fix round, 26.09.2026; the reviews' DS-m9 = C-m4, C-m17, C-m9 and the round-2
         * R2-m2. An Analyze in the moments after a GM loads skipped its refusal and scored a
         * bullet whose key was still on its way as Neutral; a handover of a bullet whose key
         * was missing minted its copy an explicit Neutral. Both wait for the copies now and
         * then refuse - read from the source, before the key is read and before a copy is
         * made. The two doc blocks another function had come between sit on their functions
         * again. And the old rows a browser that was not the primary left for the primary's
         * are counted apart from another world's (`leftCounts`, pure).
         */
        const sources = new Map(await otherSources());
        const src = file => stripComments(sources.get(file) ?? "");
        const analyze = fnSource(src("analyze.mjs"), "resolveAnalyze");
        const waited = analyze.indexOf("await answerKeysRefusal()"), read = analyze.indexOf("const secret = secretOf(item.uuid);");
        ok(waited > 0 && read > waited && !/isHydrated\(\) && !secret\.realType/.test(analyze),
            "an Analyze reads the answer key, or decides it is missing, before the other GMs' copies have arrived");
        const share = fnSource(src("handover.mjs"), "shareBullet");
        const shareWaited = share.indexOf("await answerKeysRefusal()"), refused = share.indexOf("if (!secret.realType)"), minted = share.indexOf("createTruthBullet(");
        ok(shareWaited > 0 && refused > shareWaited && minted > refused && !/realType \?\? "neutral"/.test(share),
            "a handover mints a copy of a bullet whose answer key is missing, or decides before the copies arrive");
        // A doc block is its function's when nothing but its own text lies between its first line and the function.
        const docOn = (file, first, fn) => new RegExp(`\\* ${first}(?:[^*]|\\*(?!\\/))*\\*\\/\\s*${fn}\\(`).test(sources.get(file) ?? "");
        ok(docOn("analyze.mjs", "Score a thrown Analyze", "export async function resolveAnalyze"), "resolveAnalyze's doc does not sit on it");
        ok(docOn("diagnostics.mjs", "Why per-region voice is not moving anybody", "export function diagnoseVoice"), "diagnoseVoice's doc does not sit on it");

        const S = await import("./gm-stores.mjs");
        const h = census => ({ census: () => census });
        equal(JSON.stringify(S.leftCounts([h({ left: 3, reasons: { notPrimary: 2, otherWorld: 1 } }), h({ left: 1, reasons: { deadProject: 1 } }), h(null)])),
            JSON.stringify({ left: 2, notPrimary: 2 }), "the rows left for the primary are counted as another world's, or not at all");
    }],

    ["R189 - an Analyze and a handover wait for the answer keys within a bound, and a GM store that cannot open says so", async () => {
        /*
         * E04's fix round 10, 26.09.2026. The Analyze and the handover wait for the other
         * GMs' copies of the answer keys (R187), and waited with no bound. Measured on
         * 05ac984 over this engine: a store whose open threw stayed "opening", its
         * `whenHydrated` never settled - the exchange's clock is set only at the end of the
         * open - and nobody was told; in the harness, p1's Analyze on a GM whose bullets
         * store never hydrated had not settled after 20 s (61 M holds that road end to end,
         * the player's price with it). A claim that throws is not that case: the claim keeps
         * it, tells the primary, and the open goes on to its exchange - held here so the
         * difference stays measured. Over the engine with a fake environment and clock,
         * nothing leaves this client. Then `answerKeysOpen` over stores of its own, with
         * real timers of a fraction of a second: "late" at the bound, "open" for a hydration
         * inside it, "failed" at once or at the bound when the failure comes while it
         * waits, and "open" at once. And the bound lies between the exchange's own timeout
         * and the asking player's clock (`rulingMs`), so a refusal reaches them.
         */
        const G = await import("./gm-store.mjs");
        const S = await import("./gm-stores.mjs");
        const { TIMING } = await import("./config.mjs");
        const tick = () => new Promise(r => setTimeout(r, 0));
        const engineOf = ({ readThrows = false, claimThrows = false } = {}) => {
            let t = 1000;
            const timers = [], told = [], store = new Map();
            const fake = {
                set: (fn, ms) => {
                    const tm = { fn, at: t + ms, done: false };
                    if (!ms) setTimeout(() => { if (!tm.done) { tm.done = true; fn(); } }, 0);
                    else timers.push(tm);
                    return tm;
                },
                clear: tm => { if (tm) tm.done = true; },
                advance: ms => {
                    t += ms;
                    for (const tm of timers.filter(x => !x.done && x.at <= t)) { tm.done = true; tm.fn(); }
                }
            };
            const eng = G.createGmStoreEngine({
                selfId: () => "R189A", isGM: () => true, isPrimary: () => true, worldId: () => "R189WORLD",
                activeGmIds: () => ["R189A"], primaryGmId: () => "R189A", senderIsGM: () => true, userName: u => u, send: () => {},
                storage: {
                    read: k => { if (readThrows) throw new Error("R189 storage read"); return store.get(k) ?? null; },
                    write: async (k, v) => { store.set(k, JSON.stringify(v)); }
                },
                readLegacy: () => ({ R189ROW: { realType: "key" } }), now: () => t, timers: fake, clock: () => ({}),
                log: { warn: () => {}, error: () => {}, debug: () => {} },
                notify: (level, text) => told.push(`${level}: ${text}`), text: key => key
            });
            const handle = eng.define({ name: "r189", key: "r189Store", legacyKey: "r189Old",
                claim: () => { if (claimThrows) throw new Error("R189 claim"); return { rows: [] }; } });
            return { eng, handle, fake, told };
        };
        const settled = promise => {
            const box = { how: "pending" };
            promise.then(v => { box.how = `resolved ${v}`; }, e => { box.how = `rejected ${e?.message ?? e}`; });
            return box;
        };

        const broken = engineOf({ readThrows: true });
        let rejected = null;
        try { await broken.eng.open(); } catch (err) { rejected = err?.message ?? String(err); }
        const waiting = settled(broken.eng.whenHydrated());
        broken.fake.advance(TIMING.gmStoreSyncMs * 2);
        for (let i = 0; i < 4; i++) await tick();
        const openThrew = { rejected, state: broken.eng.hydration().state, whenHydrated: waiting.how, told: broken.told };
        equal(JSON.stringify(openThrew), JSON.stringify({ rejected: "R189 storage read", state: "failed", whenHydrated: "pending", told: ["error: DRPG.GmStore.openFailed"] }),
            "an open that throws is not \"failed\", or its GM is not told once, or its whenHydrated settled without a hydration");

        const claimed = engineOf({ claimThrows: true });
        await claimed.eng.open();
        const claimBox = settled(claimed.eng.whenHydrated());
        for (let i = 0; i < 4; i++) await tick();
        const claimThrew = { state: claimed.eng.hydration().state, whenHydrated: claimBox.how, failed: claimed.handle.claimInfo()?.failed ?? null, told: claimed.told };
        equal(JSON.stringify(claimThrew), JSON.stringify({ state: "alone", whenHydrated: "resolved alone", failed: "R189 claim", told: ["error: DRPG.GmStore.claimFailed"] }),
            "a claim that throws stopped the open, or was not kept, or its primary was not told once");

        const never = { isHydrated: () => false, whenHydrated: () => new Promise(() => {}) };
        // Its own ceiling, so a wait with no bound fails here rather than holding the suite.
        const timed = async promise => {
            const t0 = Date.now();
            const how = await Promise.race([promise, new Promise(r => setTimeout(() => r("still waiting after 3000 ms"), 3000))]);
            return [how, Date.now() - t0];
        };
        const [late, lateMs] = await timed(S.answerKeysOpen({ store: never, ms: 150, failed: () => false }));
        const soon = { isHydrated: () => false, whenHydrated: () => new Promise(r => setTimeout(() => r("answered"), 40)) };
        const [inTime, inTimeMs] = await timed(S.answerKeysOpen({ store: soon, ms: 5000, failed: () => false }));
        const [failedNow, failedNowMs] = await timed(S.answerKeysOpen({ store: never, ms: 5000, failed: () => true }));
        let failing = false;
        setTimeout(() => { failing = true; }, 30);
        const [failedLater] = await timed(S.answerKeysOpen({ store: never, ms: 150, failed: () => failing }));
        const [openNow, openNowMs] = await timed(S.answerKeysOpen({ store: { ...never, isHydrated: () => true }, ms: 5000, failed: () => true }));
        const bound = { late, lateMs, inTime, inTimeMs, failedNow, failedNowMs, failedLater, openNow, openNowMs };
        ok(late === "late" && lateMs >= 140 && lateMs < 5000 && inTime === "open" && inTimeMs < 5000 && failedNow === "failed" && failedNowMs < 1000
            && failedLater === "failed" && openNow === "open" && openNowMs < 1000,
            `the wait for the answer keys is not bounded, or ends before a hydration inside its bound, or waits on a store that failed: ${JSON.stringify(bound)}`);

        ok(TIMING.gmStoreOpenMs > TIMING.gmStoreSyncMs && TIMING.gmStoreOpenMs < TIMING.rulingMs,
            `the bound (${TIMING.gmStoreOpenMs} ms) is not longer than the exchange's own timeout (${TIMING.gmStoreSyncMs} ms) and shorter than the player's wait (${TIMING.rulingMs} ms)`);
    }],

    ["R182 - every store a player's copy is made from sends the copies again after a restore", async () => {
        /*
         * E04's fix round, 26.09.2026; the reviews' S-m3 = C-m7 and the design's 6.2. The
         * restore said "each store sends its players their copies again", and no store did:
         * a player refused while the GM's browser held nothing waited for their next load.
         * Each copy names the store it is made of (`from`); that store is backed up and has
         * an `afterRestore`, which calls a function that tells no player anything while the
         * suite holds the stores or stands in another world (`gmStoresQuiet`).
         */
        const E = await import("./gm-store.mjs");
        await import("./gm-stores.mjs");
        const names = E.gmCopyNames();
        ok(names.length >= 4, `only ${names.length} player copies are defined - the table did not load`);
        const wrong = [];
        for (const name of names) {
            const from = E.gmCopySpec(name)?.from;
            const store = from ? E.gmStoreByName(from) : null;
            if (!store) wrong.push(`${name}: names no store it is made of`);
            else if (!store.spec.backup || typeof store.spec.afterRestore !== "function") wrong.push(`${name}: its store ${from} does not send it again after a restore`);
        }
        ok(!wrong.length, `a player's copy is not sent again after a restore: ${wrong.join("; ")}`);
        const RETELLS = [["mastermind.mjs", "retellDoor"], ["incident-store.mjs", "retellCast"], ["level-up.mjs", "retellOffers"], ["fog.mjs", "retellFog"],
            ["eclipse.mjs", "retellMoves"], ["pre-session-note.mjs", "retellNotes"], ["incident-store.mjs", "retellDeaths"],
            // E05 C13: the bullets' store, which each player's copy of their bullets' traces is made of.
            ["truth-bullets.mjs", "retellBulletRefs"],
            // E06 fix r2-G4: the Confusions' store, which each owner's copy of their characters' armed Confusions is made of.
            ["call-effects.mjs", "retellConfusions"]];
        const hooks = E.gmStoreHandles().map(h => String(h.spec.afterRestore ?? ""));
        const uncalled = RETELLS.filter(([, fn]) => !hooks.some(src => src.includes(`.${fn}(`))).map(([, fn]) => fn);
        ok(!uncalled.length, `no store's afterRestore calls ${uncalled.join(", ")}`);
        const sources = new Map(await otherSources());
        const loud = RETELLS.filter(([file, fn]) => !/\bgmStoresQuiet\(\)/.test(fnSource(stripComments(sources.get(file) ?? ""), fn)))
            .map(([file, fn]) => `${file} ${fn}`);
        ok(!loud.length, `these tell the players after a restore while the suite holds the stores: ${loud.join(", ")}`);
    }],

    ["R190 - the world-secrets rule finds every secret planted in a world snapshot and nothing in a clean one", async () => {
        /*
         * E05 C2, 26.09.2026; the stage's verify (R9 extended). scripts/world-secrets.mjs says
         * what world data may never hold, and `findWorldSecrets` reads a snapshot against it:
         * R9 on the suite's world, 72-canary on a player's browser after every phase of a
         * chapter. Each fixture below plants one secret in a clean snapshot. They are written
         * out here, not derived from the rule, so a rule taken out fails its fixture - and a
         * rule with no fixture fails too. Then the killer's id planted as a setting's key and
         * deep in an actor's flag, found at each and nowhere else; and a clean snapshot, with
         * that id only where world data may hold it (another module's flags, the document's
         * own id), which reads clean. An exemption (`everySetting.except`) is fixtured too
         * (E05 C5): planted where the rule lets it stand it reads clean, and the same field in
         * another setting beside it is still found - and an exemption with no fixture fails.
         * E05's fix round (S1-m3, S1-m4, 27.09.2026): a chat message's flags are read, and a
         * token's own actor data (its delta) under the Actor rule - each Actor flag is fixtured
         * on a delta as well, so a rule that reads world actors alone fails here. E05 C13: an
         * item's flags too (the rule's Item half), with the killer's id planted in one. E05 C14:
         * a body's loot record, and a token's answer key - each flag of remnants.mjs's
         * `ANSWER_KEY_FLAGS`, which the rule writes out and must equal, while the clean token
         * keeps `fromIncident` beside `isRemnant`. E06 C1: each field of a `messages` rule, and its
         * `flagsOnly`, needs a fixture as well (the list is empty at C1; R202 reads the kinds).
         * E06 C5b: the first rule, a roll the module threw - the clean snapshot holds one as
         * private-rolls.mjs `neutralRollSource` leaves it (its roll as JSON text, whispered to a
         * GM, written by a player), which reads clean, and each field is
         * planted in it once, the roll's options inside that text; since its fix r1-G1 the clean
         * roll holds the empty `data` and the unlabelled modifiers `neutralRollOf` leaves. E06 C10: an armed Call's buyer,
         * the first Actor path through an array - the clean bystander holds an armed Call without
         * one, and the fixture's second entry, a `null` one, is found at its index.
         */
        const W = await import("./world-secrets.mjs");
        const MOD = W.WORLD_SECRET_MODULE;
        const KILLER = "R190KILLERACTOR1";
        const clean = () => ({
            settings: {
                projectMeta: { R190PROJECT00001: { room: "Gym", indirectMurder: true, secret: true, trait: null, countsUp: true } },
                clock: { chapter: 2, day: 3 },
                murderState: { active: true, stage: "incident" },
                overflow: { active: { session: 1, day: 2, timeOfDay: "noon", effect: "fog" } }
            },
            actors: [{ id: KILLER, flags: { [MOD]: { advances: 1 }, "r190-other-module": { memo: KILLER } } },
                { id: "R190BYSTANDER001", flags: { [MOD]: { deceased: false,
                    pendingCall: [{ key: "support", kind: "hope", grants: "advantage", amount: null, nonce: "R190NONCE" }] } } }],
            users: [{ id: "R190USER00000001", flags: { [MOD]: { preSessionNote: { updatedAt: 1, written: true } } } }],
            tokens: [{ id: "R190SCENE0000001.R190TOKEN0000001", flags: { [MOD]: { isRemnant: true, fromIncident: true } },
                delta: { flags: { [MOD]: { advances: 2 } } } }],
            messages: [{ id: "R190MESSAGE00001", flags: { [MOD]: { callCard: true, popupTitle: "A ruling to make" } } },
                { id: "R190MESSAGE00002", flags: { [MOD]: { supersededRoll: true } }, author: "R190USER00000001", whisper: ["R190GAMEMASTER001"],
                    speaker: { alias: "Monokuma", actor: null, token: null, scene: null }, system: { title: "", source: { actor: "" }, targets: [] },
                    rolls: [JSON.stringify({ class: "DualityRoll", total: 14, options: { title: "", headerTitle: "", source: { actor: "" },
                        data: {}, roll: { type: "action", modifiers: [{ label: "", value: 1 }], baseModifiers: [{ label: "", value: 0 }] },
                        actionType: "action" } })] }],
            items: [{ id: "R190BYSTANDER001.items.R190ITEM00000001", flags: { [MOD]: {
                category: "truthBullet", isTruthBullet: true, shownType: "neutral", room: "Gym" } } }]
        });
        // One secret each: what it is, how it is planted in a clean snapshot, and the hit it must give.
        const FIXTURES = [
            // E05's fix round (r1-G1, S1-m1) added `saboteur`, the user who asked for a sabotage.
            ...["killerId", "by", "condition", "trigger", "saboteur"].map(f => [`projectMeta.${f}`,
                s => { s.settings.projectMeta.R190PROJECT00001[f] = f === "trigger" ? { kind: "enters" } : "R190"; },
                h => h.kind === "field" && h.doc === "setting" && h.id === "projectMeta" && h.path === `R190PROJECT00001.${f}`]),
            // E05 C5 added the last four: the Key Remnant plan held all of them.
            ...["sourceActor", "realType", "pointsAt", "dc", "tiedToCrime", "analysis", "analyzedText", "note", "tokenId"].map(f => [`every setting: ${f}`,
                s => { s.settings.clock.deep = { [f]: 1 }; },
                h => h.kind === "field" && h.doc === "setting" && h.id === "clock" && h.path === `deep.${f}`]),
            // E05 C3: the declarations' old world key holds nothing - an entry under any key is found.
            ["pendingMurders: empty",
                s => { s.settings.pendingMurders = { R190OTHERACTOR01: { room: "Gym" } }; },
                h => h.kind === "empty" && h.doc === "setting" && h.id === "pendingMurders"],
            // E05 C4: nor the crossings' - a bystander's count is found as well as the killer's.
            ["eclipseMoves: empty",
                s => { s.settings.eclipseMoves = { R190BYSTANDER001: 2 }; },
                h => h.kind === "empty" && h.doc === "setting" && h.id === "eclipseMoves"],
            // E05 C5: nor the Key Remnant plan's - a chapter with nothing but its number is found.
            ["keyRemnantPlan: empty",
                s => { s.settings.keyRemnantPlan = { chapter: 2 }; },
                h => h.kind === "empty" && h.doc === "setting" && h.id === "keyRemnantPlan"],
            // E05 C6: a user's pre-session note holds no text - the flag says when, and whether.
            ["User flag preSessionNote.text",
                s => { s.users[0].flags[MOD].preSessionNote.text = "R190 a plan to kill"; },
                h => h.kind === "flag" && h.doc === "User" && h.id === "R190USER00000001" && h.path === `flags.${MOD}.preSessionNote.text`],
            // E05 C7: an actor carries no Reroll bookmark - even one with nothing in it is found.
            ["Actor flag lastAction",
                s => { s.actors[1].flags[MOD].lastAction = {}; },
                h => h.kind === "flag" && h.doc === "Actor" && h.id === "R190BYSTANDER001" && h.path === `flags.${MOD}.lastAction`],
            // E05's fix round (S1-m4): the same bookmark on an unlinked token's own actor data, where
            // 1.2.63 wrote it from a sheet opened from the token.
            ["unlinked token's Actor flag lastAction",
                s => { s.tokens[0].delta.flags[MOD].lastAction = {}; },
                h => h.kind === "flag" && h.doc === "Actor" && h.id === "R190SCENE0000001.R190TOKEN0000001" && h.path === `delta.flags.${MOD}.lastAction`],
            // E05 C7, read since the fix round (S1-m3): a card carries no facts in its `summary` flag.
            ["ChatMessage flag summary",
                s => { s.messages[0].flags[MOD].summary = { action: "Search", item: "R190 a find" }; },
                h => h.kind === "flag" && h.doc === "ChatMessage" && h.id === "R190MESSAGE00001" && h.path === `flags.${MOD}.summary`],
            // E06 C5b: a roll the module threw names nobody - each field planted in the neutral one, a roll's inside its JSON text.
            ...[["speaker.actor", KILLER], ["speaker.token", "R190TOKEN0000001"], ["system.title", "R190 Strike"], ["system.source.actor", `Actor.${KILLER}`],
                ["rolls.*.options.title", "R190 Strike"], ["rolls.*.options.headerTitle", "R190 Strike"], ["rolls.*.options.source.actor", `Actor.${KILLER}`],
                // Fix r1-G1: the character's system in `data` as Daggerheart writes it, its effects, the
                // experiences picked and the labels naming them, its statistic.
                ["rolls.*.options.data", { biography: { background: "R190 Killer, as their player wrote them." }, companion: "Actor.R190COMPANION00001" }],
                ["rolls.*.options.effects", [{ name: "R190 Blessed", origin: "Actor.R190COMPANION00001.Item.R190ITEM00000002" }]],
                ["rolls.*.options.bonusEffects", { R190EFFECT000001: { name: "R190 Blessed" } }], ["rolls.*.options.experiences", ["R190EXPERIENCE01"]],
                ["rolls.*.options.roll.trait", "agility"], ["rolls.*.options.roll.modifiers.*.label", "R190 Kendo Captain"],
                ["rolls.*.options.roll.baseModifiers.*.label", "R190 Kendo Captain"],
                // Fix r2-G2: the Loaded Die's mark - the nonce its Call keeps on the character, the bystander's here.
                ["rolls.*.options.drpgLoadedDie", "R190NONCE"]].map(([f, value]) => [`message supersededRoll: ${f}`,
                s => {
                    const message = s.messages[1];
                    const inRoll = f.startsWith("rolls.*.");
                    const roll = inRoll ? JSON.parse(message.rolls[0]) : null;
                    const parts = (inRoll ? f.slice("rolls.*.".length) : f).replaceAll("*", "0").split(".");
                    const node = parts.slice(0, -1).reduce((at, key) => at[key], inRoll ? roll : message);
                    node[parts.at(-1)] = value;
                    if (inRoll) message.rolls[0] = JSON.stringify(roll);
                },
                h => h.kind === "messageField" && h.doc === "ChatMessage" && h.id === "R190MESSAGE00002" && h.path === f.replaceAll("*", "0")]),
            // E06 C7a: a private card's document says nothing of itself - its action's title is found.
            ["message secret: only secret, veiled, drpgMessage, thread, kind, gmAsk, settled",
                s => { s.messages.push({ id: "R190MESSAGE00003", flags: { [MOD]: { secret: true, drpgMessage: true, popupTitle: "R190 Search" } } }); },
                h => h.kind === "messageFlag" && h.doc === "ChatMessage" && h.id === "R190MESSAGE00003" && h.path === `flags.${MOD}.popupTitle`],
            // E06 C8: a veiled card's document says nothing of whose thread it is - its thread is found.
            ["message veiled: only secret, veiled, drpgMessage",
                s => { s.messages.push({ id: "R190MESSAGE00006", flags: { [MOD]: { secret: true, veiled: true, thread: "R190USER00000001" } } }); },
                h => h.kind === "messageFlag" && h.doc === "ChatMessage" && h.id === "R190MESSAGE00006" && h.path === `flags.${MOD}.thread`],
            // E05 C14: a body carries no loot record - on a world actor, and on an unlinked token's own actor data.
            ["Actor flag lootTrace",
                s => { s.actors[1].flags[MOD].lootTrace = { sceneId: "R190SCENE0000001", tokenId: "R190TOKEN0000009", taken: ["R190 a knife"] }; },
                h => h.kind === "flag" && h.doc === "Actor" && h.id === "R190BYSTANDER001" && h.path === `flags.${MOD}.lootTrace`],
            ["unlinked token's Actor flag lootTrace",
                s => { s.tokens[0].delta.flags[MOD].lootTrace = { taken: [] }; },
                h => h.kind === "flag" && h.doc === "Actor" && h.id === "R190SCENE0000001.R190TOKEN0000001" && h.path === `delta.flags.${MOD}.lootTrace`],
            // E06 C10: an armed Call names nobody who bought it - on a world actor, and on an unlinked token's own actor data.
            ["Actor flag pendingCall.*.from",
                s => { s.actors[1].flags[MOD].pendingCall.push({ key: "meddle", grants: "bonus", amount: -1, from: null, nonce: "R190NONCE2" }); },
                h => h.kind === "flag" && h.doc === "Actor" && h.id === "R190BYSTANDER001" && h.path === `flags.${MOD}.pendingCall.1.from`],
            ["unlinked token's Actor flag pendingCall.*.from",
                s => { s.tokens[0].delta.flags[MOD].pendingCall = [{ key: "meddle", grants: "bonus", amount: 1, from: "R190" }]; },
                h => h.kind === "flag" && h.doc === "Actor" && h.id === "R190SCENE0000001.R190TOKEN0000001" && h.path === `delta.flags.${MOD}.pendingCall.0.from`],
            // E05 C14: a trace's token carries none of its answer key - a promotion's `false` is found as well.
            ...["remnantType", "visibility", "reinforced", "faint", "tiedToCrime", "note", "action", "subject", "sourceActor", "sourceName",
                "room", "chapter", "day", "timeOfDay", "pointsAt"].map(f => [`Token flag ${f}`,
                s => { s.tokens[0].flags[MOD][f] = f === "faint" ? false : "R190"; },
                h => h.kind === "flag" && h.doc === "Token" && h.id === "R190SCENE0000001.R190TOKEN0000001" && h.path === `flags.${MOD}.${f}`]),
            // E05 C13: a bullet names no trace in its flags - a `null` one, which every bullet no trace made carried, is found as well.
            ["Item flag remnantRef",
                s => { s.items[0].flags[MOD].remnantRef = null; },
                h => h.kind === "flag" && h.doc === "Item" && h.id === "R190BYSTANDER001.items.R190ITEM00000001" && h.path === `flags.${MOD}.remnantRef`],
            // E05 C12: the overflow keeps its darkening's stamp, and the count behind it is the GMs' - a 0 is found as well.
            ["overflow.count",
                s => { s.settings.overflow.count = 0; },
                h => h.kind === "field" && h.doc === "setting" && h.id === "overflow" && h.path === "count"],
            // E05 C8: the world half of an incident holds the public list alone - a falsy value is found as well
            // (a trap's `false` until E32 C2, which left the stage alone there: now the fight's round at 0).
            ["murderState: only active, stage",
                s => { s.settings.murderState = { active: true, stage: "incident", turn: 0 }; },
                h => h.kind === "only" && h.doc === "setting" && h.id === "murderState" && h.path === "turn"]
        ];
        /* The exemptions: [what, plant, whether the hits are right]. projectMeta's own map token, as
           projects-map.mjs writes it (E05 C5): it reads clean there, and a tokenId planted in the clock
           beside it is found - an exemption is one setting's, not the field's. */
        const EXEMPT = [
            ["projectMeta may hold tokenId",
                s => {
                    Object.assign(s.settings.projectMeta.R190PROJECT00001, { tokenId: "R190TOKEN0000002", tokenScene: "R190SCENE0000001" });
                    s.settings.clock.deep = { tokenId: "R190TOKEN0000003" };
                },
                hits => !hits.some(h => h.id === "projectMeta") && hits.some(h => h.kind === "field" && h.id === "clock" && h.path === "deep.tokenId")],
            /* E06 C7a, both ways: a thread card keeps its placement, an old one its `settled`, and it
               speaks as its actor (a rule of `flagsOnly` alone reads no speaker) - it reads clean; the
               same card with its sound on the document is found. */
            ["a private card may hold its placement and settled",
                s => {
                    const card = (id, more) => ({ id, flags: { [MOD]: { secret: true, drpgMessage: true, thread: "R190USER00000001", kind: "action",
                        gmAsk: true, settled: true, ...more } }, speaker: { actor: KILLER, alias: "R190 Killer" }, whisper: ["R190USER00000001"] });
                    s.messages.push(card("R190MESSAGE00004", {}), card("R190MESSAGE00005", { sfx: "gmAsk" }));
                },
                hits => !hits.some(h => h.id === "R190MESSAGE00004")
                    && hits.some(h => h.kind === "messageFlag" && h.id === "R190MESSAGE00005" && h.path === `flags.${MOD}.sfx`)]
        ];
        const R = W.WORLD_SECRET_RULES;
        // E05 C14: the Token rule is remnants.mjs's list of what a trace's token may not carry, written out.
        const { ANSWER_KEY_FLAGS } = await import("./remnants.mjs");
        equal(JSON.stringify(R.flags?.Token ?? []), JSON.stringify(ANSWER_KEY_FLAGS),
            "the world-secrets rule's Token half is not remnants.mjs's ANSWER_KEY_FLAGS");
        const named = new Set([...FIXTURES, ...EXEMPT].map(([what]) => what));
        const unfixtured = [
            ...Object.entries(R.settings).flatMap(([key, rule]) => [...(rule.fields ?? []).map(f => `${key}.${f}`),
                ...(rule.empty ? [`${key}: empty`] : []), ...(rule.only ? [`${key}: only ${rule.only.join(", ")}`] : [])]),
            ...(R.everySetting?.fields ?? []).map(f => `every setting: ${f}`),
            ...Object.entries(R.everySetting?.except ?? {}).flatMap(([key, fields]) => fields.map(f => `${key} may hold ${f}`)),
            ...Object.entries(R.flags ?? {}).flatMap(([doc, paths]) => paths.map(p => `${doc} flag ${p}`)),
            ...(R.flags?.Actor ?? []).map(p => `unlinked token's Actor flag ${p}`),
            // E06 C1: a message rule's fields, and the flags it lets a card of its kind carry.
            ...(R.messages ?? []).flatMap(rule => [...(rule.fields ?? []).map(f => `message ${rule.when}: ${f}`),
                ...(rule.flagsOnly ? [`message ${rule.when}: only ${rule.flagsOnly.join(", ")}`] : [])])
        ].filter(what => !named.has(what));
        ok(!unfixtured.length, `a rule of world-secrets.mjs has no fixture here: ${unfixtured.join(", ")}`);
        const missed = [];
        for (const [what, plant, expected] of FIXTURES) {
            const snapshot = clean();
            plant(snapshot);
            const hits = W.findWorldSecrets(snapshot, { ids: [KILLER] });
            if (!hits.some(expected)) missed.push(`${what} (found ${JSON.stringify(hits)})`);
        }
        ok(!missed.length, `the rule did not find a secret planted for it: ${missed.join("; ")}`);
        const wrong = [];
        for (const [what, plant, right] of EXEMPT) {
            const snapshot = clean();
            plant(snapshot);
            const hits = W.findWorldSecrets(snapshot, { ids: [KILLER] });
            if (!right(hits)) wrong.push(`${what} (found ${JSON.stringify(hits)})`);
        }
        ok(!wrong.length, `an exemption flagged the setting it exempts, or let the field stand elsewhere: ${wrong.join("; ")}`);

        const planted = clean();
        planted.settings.pendingMurders = { [KILLER]: { room: "Gym" } };
        planted.actors[1].flags[MOD].memo = { met: ["nobody", `Actor.${KILLER}.Item.R190ITEM00000001`] };
        planted.tokens[0].delta.flags[MOD].memo = KILLER;
        planted.messages[0].flags[MOD].actorId = KILLER;
        planted.items[0].flags[MOD].from = KILLER;
        const ids = W.findWorldSecrets(planted, { ids: [KILLER] }).filter(h => h.kind === "id");
        equal(JSON.stringify(ids.map(h => [h.doc, h.id, h.path, Boolean(h.key)])),
            JSON.stringify([["setting", "pendingMurders", KILLER, true], ["Actor", "R190BYSTANDER001", `flags.${MOD}.memo.met.1`, false],
                ["Actor", "R190SCENE0000001.R190TOKEN0000001", `delta.flags.${MOD}.memo`, false],
                ["ChatMessage", "R190MESSAGE00001", `flags.${MOD}.actorId`, false],
                ["Item", "R190BYSTANDER001.items.R190ITEM00000001", `flags.${MOD}.from`, false]]),
            "the killer's id planted as a setting's key, deep in an actor's flag, in an unlinked token's own actor data, in a card's flag and in an item's was not found at each, or was found somewhere else");
        equal(JSON.stringify(W.findWorldSecrets(clean(), { ids: [KILLER] })), "[]",
            "a clean snapshot reads as holding a secret - the killer's id in another module's flags, or as the document's own id");
    }],

    ["R193 - a death is the table's only once it is published", async () => {
        /*
         * E05 C10, 26.09.2026; audit S06-11. A killing in an incident writes a row of the
         * GMs' `deaths` store and a copy for those who may know; the flag waits for the
         * body's discovery or a GM's hand (chapter.mjs `publishDeath`). Driven on engines
         * built with fakes - storage in a Map - so nothing in this browser is written:
         * `deadIn`, the rule under `isDeadForGm`, by role - a GM holding the row, the
         * victim's player holding a copy, a bystander holding none - and a flag, dead to
         * each of them; `knowsOfDeath`, where `known` is the only way in for a player who
         * neither owns the body nor is a GM (a finder's part, Q1); and the copy, weighed by
         * the offers' rule, which a later answer naming the body gone empties.
         */
        const G = await import("./gm-store.mjs");
        const { deadIn } = await import("./settings.mjs");
        const { deathCopy, offersCombine } = await import("./gm-stores.mjs");
        const { knowsOfDeath } = await import("./murder.mjs");
        const quiet = { warn: () => {}, error: () => {}, debug: () => {} };
        const engineOf = (self, gm) => {
            const store = new Map(), flushes = [];
            const eng = G.createGmStoreEngine({
                selfId: () => self, isGM: () => gm, isPrimary: () => gm, worldId: () => "R193WORLD",
                activeGmIds: () => ["R193GM"], primaryGmId: () => "R193GM", senderIsGM: () => true, userName: u => u, send: () => {},
                storage: { read: k => store.get(k) ?? null, write: async (k, v) => { store.set(k, JSON.stringify(v)); } },
                readLegacy: () => undefined, now: () => 9_000_000,
                timers: { set: fn => { flushes.push(Promise.resolve().then(fn)); return flushes.length; }, clear: () => {} },
                clock: () => ({ resetCuts: {} }), log: quiet, notify: () => {}, text: key => key
            });
            return { eng, settle: async () => { for (let i = 0; i < 4; i++) await Promise.all(flushes); } };
        };
        const actor = (id, flag = null) => ({ id, getFlag: (scope, key) => (key === "deceased" ? flag : null) });
        const VICTIM = "R193VICTIM000001", PUBLIC = "R193PUBLIC000001";
        const victim = actor(VICTIM), published = actor(PUBLIC, { chapter: 1, day: 2, timeOfDay: "night" });

        const gm = engineOf("R193GM", true);
        const rows = gm.eng.define({ name: "r193deaths", key: "r193Deaths", kind: "ledger", resetGroup: "deaths", sync: true, backup: true });
        await rows.patch(VICTIM, { chapter: 1, day: 2, timeOfDay: "night", at: 1, keepBullets: false, known: ["R193KILLER"] });
        await gm.settle();
        const row = rows.get(VICTIM);

        const owner = engineOf("R193OWNER", false), bystander = engineOf("R193BYSTANDER", false);
        const copyOf = e => e.eng.defineCopy({ name: "r193deaths", key: "r193MineDeaths", resetGroup: "deaths", fallback: {}, combine: offersCombine });
        const ownerCopy = copyOf(owner), bystanderCopy = copyOf(bystander);
        equal(await ownerCopy.receive({ [VICTIM]: { chapter: 1, day: 2, timeOfDay: "night" } }, { [VICTIM]: rows.newest(VICTIM) }), true,
            "the victim's player did not take the copy of their own death");
        const held = { gm: id => rows.get(id), owner: id => ownerCopy.read()?.[id], bystander: id => bystanderCopy.read()?.[id] };
        equal(JSON.stringify(Object.fromEntries(Object.entries(held).map(([who, h]) => [who, [deadIn(victim, h), deadIn(published, h)]]))),
            JSON.stringify({ gm: [true, true], owner: [true, true], bystander: [false, true] }),
            "a death kept by the GMs read wrong by role - dead to the GM and to the victim's player, alive to a bystander - or a published one was not dead to all");
        ok(!deadIn({ getFlag: () => null }, () => row), "an actor with no id read as dead through a held row");

        const users = { gm: { id: "R193GM", isGM: true }, killer: { id: "R193KILLER", isGM: false }, finder: { id: "R193FINDER", isGM: false } };
        equal(JSON.stringify([knowsOfDeath(users.gm, VICTIM, row), knowsOfDeath(users.killer, VICTIM, row), knowsOfDeath(users.finder, VICTIM, row),
            knowsOfDeath(users.finder, VICTIM, { ...row, known: [...row.known, users.finder.id] }), knowsOfDeath(users.gm, VICTIM, null)]),
            JSON.stringify([true, true, false, true, false]),
            "who may know of a death kept by the GMs is not a GM, the row's known and nobody else (a finder only once named, nobody for no row)");

        await rows.drop(VICTIM);
        await gm.settle();
        equal(await ownerCopy.receive({}, { [VICTIM]: rows.newest(VICTIM) }), true, "an answer naming the published body gone was refused");
        equal(JSON.stringify(ownerCopy.read()), "{}", "the copy still holds a death the GMs published");
        ok(G.gmCopySpec(deathCopy.name)?.combine === offersCombine, "the deaths' copy is not weighed by the offers' rule");
    }],

    ["R195 - a deferred Reinforced joins its owner's Standard in one write", async () => {
        /*
         * E05 C11, 27.09.2026; D4; audit S03-01, S06-01. A wrong verdict used to apply the
         * surviving Blackened's Reinforced Level Up at once, on the actor and on a card spoken
         * by it; it waits in the GMs' `deferredOffers` store now and is picked with the class's
         * next Standard or at the Final Trial's verdict (the owner's Q7). `advancementPlan` is
         * the batch's whole decision, pure: one entry per survivor - one picker, which is one
         * write and one step of `advances` (`applyAdvancement`, measured in tier 2) - with 1
         * or 1 + 3 picks, 1 + 6 for two wrong verdicts survived; at the Final Trial only what
         * waited; and the rows of the dead, or of no kind there is, dropped.
         */
        const { advancementPlan } = await import("./level-up.mjs");
        const { deferredOfferStore } = await import("./gm-stores.mjs");
        const { stableJson } = await import("./gm-store.mjs");
        const row = (count = 1) => ({ kind: "reinforced", chapter: 1, at: 1, count });
        const rows = { R195HOLDER000001: row(), R195TWICE0000001: row(2), R195DEAD00000001: row(), R195BOGUS0000001: { kind: "R195NOKIND", at: 1 } };
        const survivors = ["R195PLAIN0000001", "R195HOLDER000001", "R195TWICE0000001", "R195BOGUS0000001"];
        const shape = plan => plan.entries.map(e => [e.actorId, e.kind, e.picks, e.extraPicks, e.deferred, e.reasons.join("+")]);

        const verdict = advancementPlan(survivors, rows, "standard");
        equal(stableJson(shape(verdict)), stableJson([
            ["R195PLAIN0000001", "standard", 1, 0, false, "DRPG.Advance.reason.standard"],
            ["R195HOLDER000001", "standard", 4, 3, true, "DRPG.Advance.reason.standard+DRPG.Advance.reason.withClass"],
            ["R195TWICE0000001", "standard", 7, 6, true, "DRPG.Advance.reason.standard+DRPG.Advance.reason.withClass"],
            ["R195BOGUS0000001", "standard", 1, 0, false, "DRPG.Advance.reason.standard"]
        ]), "a correct verdict's batch is not one picker per survivor with its Standard and whatever waited, in the survivors' order");
        equal(stableJson(verdict.drop.sort()), stableJson(["R195BOGUS0000001", "R195DEAD00000001"]),
            "the dead's row, or a row of no kind, outlives the batch - or a survivor's is dropped with them");

        const final = advancementPlan(survivors, rows, null);
        equal(stableJson(shape(final)), stableJson([
            ["R195HOLDER000001", "reinforced", 3, 0, true, "DRPG.Advance.reason.reinforced"],
            ["R195TWICE0000001", "reinforced", 6, 3, true, "DRPG.Advance.reason.reinforced"]
        ]), "the Final Trial's batch hands out something besides what waited, or not all of that");
        equal(stableJson(advancementPlan([], {}, "standard")), stableJson({ entries: [], drop: [] }), "an empty class plans something");
        equal(stableJson(advancementPlan(["R195PLAIN0000001", "R195PLAIN0000001"], {}, "standard").entries.length), "1",
            "a survivor named twice is two pickers, two writes and two advances");

        for (const lang of ["en", "pl"]) {
            const text = await fetch(`/modules/${MODULE_ID}/lang/${lang}.json`).then(r => r.json());
            ok(typeof foundry.utils.getProperty(text, "DRPG.Advance.reason.withClass") === "string",
                `the reason a waiting Reinforced gives has no ${lang} text`);
        }
        // The Final Trial's verdict is not driven here or in tier 2 (a Mastermind, a public banner,
        // the pick cleared): its call is read, after the kill that takes an executed Mastermind's.
        const finalVerdict = bodyOf(stripComments(new Map(await otherSources()).get("mastermind.mjs") ?? ""), "export async function applyFinalVerdict");
        const kill = finalVerdict.indexOf("killCharacter("), batch = finalVerdict.indexOf("runAdvancementBatch(livingStudentsForGm(), null)");
        ok(kill > 0 && batch > kill, "the Final Trial's verdict does not hand out what waited for the class (Q7), or does so before its kill");
        equal(stableJson([deferredOfferStore.spec?.resetGroup, deferredOfferStore.spec?.backup, deferredOfferStore.spec?.sync]),
            stableJson(["advancement", true, true]), "the waiting Level Ups are not cut by the reset's advancement group, backed up and synced");
    }],

    ["R196 - owed Despair is paid at the time of day's change and never spent twice", async () => {
        /*
         * E05 C12, 27.09.2026; audit S09-28. A conversion of a Monokuma's Despair to somebody's Hope
         * took the pool down as the Hope went up, and the pools are on every bar (D3): every console
         * could pair the two. The drop is owed now, in the GMs' `despairOwed` store, and paid at the
         * next time of day. `owedAfter` is its arithmetic, pure, and driven here: a conversion owes
         * and leaves the pool; income that will not fit pays what is owed before it spills; the
         * settlement pays, never below zero. NEVER SPENT TWICE: over every pool and debt, what can be
         * spent is the same after the settlement as before it, and income lands - in the pool and in
         * the overflow - as it would have on the pool an immediate drop left. Then read from the
         * source, as the rest needs a world (tier 2 drives it): every spending path asks what the pool
         * can spend, both roads into a full pool pay the debt first, a fill and a zero drop the rows,
         * the primary settles at every write of the clock after waiting for the other GMs' copies; the two
         * stores' reset groups, backup and sync; and the words the pickers show.
         */
        const D = await import("./despair.mjs");
        const { despairOwedStore, overflowStore } = await import("./gm-stores.mjs");
        const { stableJson } = await import("./gm-store.mjs");
        const MAX = 12;
        const step = (pool, owed, event) => { const r = D.owedAfter({ pool, owed }, event, MAX); return [r.pool, r.owed, r.spill]; };
        const TABLE = [
            ["a conversion owes, and the pool stands", [5, 0, { kind: "convert", n: 2 }], [5, 2, 0]],
            ["a second conversion owes more", [5, 2, { kind: "convert", n: 1 }], [5, 3, 0]],
            ["income below the cap goes into the pool", [8, 2, { kind: "income", n: 1 }], [9, 2, 0]],
            ["income into a full pool pays what it owes", [12, 2, { kind: "income", n: 1 }], [12, 1, 0]],
            ["income past what is owed spills the rest", [11, 2, { kind: "income", n: 5 }], [12, 0, 2]],
            ["owing nothing, what will not fit spills", [12, 0, { kind: "income", n: 3 }], [12, 0, 3]],
            ["a spend takes from the pool and leaves the debt", [5, 2, { kind: "income", n: -3 }], [2, 2, 0]],
            ["the settlement pays", [5, 2, { kind: "settle" }], [3, 0, 0]],
            ["the settlement stops at zero", [1, 3, { kind: "settle" }], [0, 0, 0]]
        ];
        const wrong = TABLE.filter(([, [pool, owed, event], want]) => stableJson(step(pool, owed, event)) !== stableJson(want))
            .map(([what, [pool, owed, event]]) => `${what}: ${stableJson(step(pool, owed, event))}`);
        ok(!wrong.length, `the owed Despair's arithmetic is wrong: ${wrong.join("; ")}`);

        const twice = [];
        for (let pool = 0; pool <= MAX; pool++) for (let owed = 0; owed <= pool; owed++) {
            const spendable = pool - owed;
            const settled = D.owedAfter({ pool, owed }, { kind: "settle" }, MAX);
            if (settled.pool - settled.owed !== spendable) twice.push(`settle ${pool}/${owed}`);
            for (const n of [1, 2, 5, MAX]) {
                const got = D.owedAfter({ pool, owed }, { kind: "income", n }, MAX);
                if (got.pool - got.owed !== Math.min(spendable + n, MAX) || got.spill !== Math.max(spendable + n - MAX, 0)) twice.push(`income ${n} at ${pool}/${owed}`);
            }
        }
        ok(!twice.length, `a settlement or an income spends what is owed twice, or loses it (pool/owed): ${twice.slice(0, 6).join(", ")}`);

        const sources = new Map(await otherSources());
        const despair = stripComments(sources.get("despair.mjs") ?? "");
        const body = head => bodyOf(despair, head, { until: "\n}\n" });
        for (const name of ["spendDespairCall", "convertDespairToHope"]) {
            const fn = body(`export async function ${name}(`);
            ok(/const held = spendableDespair\(/.test(fn) && !/getDespair\(/.test(fn), `${name} asks what the pool shows, not what it can spend`);
        }
        ok(/spillFrom\(userId, before, delta,/.test(body("export async function adjustDespair(")),
            "income into a full pool through adjustDespair spills before it pays what is owed");
        const award = stripComments(sources.get("despair-award.mjs") ?? "");
        ok(/spillFrom\(monokuma\.id, before, 1,/.test(award) && !/addOverflow\(/.test(award),
            "a roll's point into a full pool spills before it pays what is owed");
        for (const name of ["fillAllDespair", "zeroAllDespair"]) {
            ok(/await clearOwed\(\);/.test(body(`export async function ${name}(`)), `${name} leaves the pools owing what they covered`);
        }
        // Both writes found before their order is read (fix r2-G2; review F8): renamed, either was -1 and passed.
        const settling = body("async function settleOnce(");
        const pays = settling.indexOf("SETTINGS.despairPools"), drops = settling.indexOf("dropMany(");
        ok(/if \(!isPrimaryGm\(\)\) return 0;/.test(settling) && /await despairOwedStore\.whenHydrated\(\);/.test(settling)
            && pays >= 0 && drops >= 0 && pays < drops,
            "the settlement runs off the primary, without waiting for the other GMs' copies, or drops the rows before the pools pay");
        ok(/Hooks\.on\("drpgTimeOfDayChanged", \(\) => \{\s*settleOwed\(\)/.test(body("export function registerDespair(")),
            "nothing settles what is owed when the time of day moves on");
        equal(stableJson([[despairOwedStore.spec?.resetGroup, despairOwedStore.spec?.backup, despairOwedStore.spec?.sync],
            [overflowStore.spec?.kind, overflowStore.spec?.resetGroup, overflowStore.spec?.backup, overflowStore.spec?.sync]]),
            stableJson([["despair", true, true], ["record", "overflow", true, true]]),
            "the owed Despair or the overflow's count is not cut by its reset group, backed up and synced");
        for (const [lang, forms] of [["en", ["one", "other"]], ["pl", ["one", "few", "many", "other"]]]) {
            const text = await fetch(`/modules/${MODULE_ID}/lang/${lang}.json`).then(r => r.json());
            const missing = forms.filter(f => typeof foundry.utils.getProperty(text, `DRPG.Despair.owed.${f}`) !== "string");
            ok(!missing.length, `the pickers' "owed" has no ${lang} text for ${missing.join(", ")}`);
        }
    }],

    ["R198 - a self-hosted LiveKit secret in the world is told to the GM, and nothing else is", async () => {
        /*
         * E05 C15, 27.09.2026; audit S11-59. avclient-livekit keeps a self-hosted server's API
         * key and secret in its world setting `liveKitConnectionSettings`, which every browser
         * receives; this module cannot move it and warns the GM instead. voice.mjs
         * `liveKitSecretWarning` is the rule, pure, driven here over settings shaped as
         * avclient-livekit 0.6.8's source writes them ({ serverType, url, room, username,
         * password }; "custom" and "tavern", read 27.09.2026 - not measured against a live
         * install, AUDIT §9 LIVE-E05-11). Then read from the source: the season checklist and
         * the voice diagnosis ask it (the diagnosis on a GM only), and both texts exist.
         */
        const { liveKitSecretWarning, liveKitConnectionSettings } = await import("./voice.mjs");
        const KEY = "DRPG.Voice.liveKitSecret";
        const TABLE = [
            ["no setting at all", undefined, null],
            ["an empty setting (A/V never configured)", {}, null],
            ["not an object", "custom", null],
            ["the Tavern", { serverType: "tavern", room: "R198ROOM" }, null],
            ["the Tavern, a secret left behind", { serverType: "tavern", password: "R198SECRET" }, null],
            ["a self-hosted server with its secret", { serverType: "custom", url: "wss://r198", username: "R198KEY", password: "R198SECRET" }, KEY],
            ["a self-hosted server, the secret not filled in", { serverType: "custom", username: "R198KEY", password: "" }, null],
            ["a self-hosted server, a blank secret", { serverType: "custom", password: "   " }, null],
            ["no type yet (a GM's first connect makes it custom), the secret filled in", { password: "R198SECRET" }, KEY],
            ["a type this module does not know, the secret filled in", { serverType: "R198TYPE", password: "R198SECRET" }, KEY]
        ];
        const wrong = TABLE.filter(([, settings, want]) => liveKitSecretWarning(settings) !== want)
            .map(([label, settings]) => `${label}: ${liveKitSecretWarning(settings)}`);
        ok(!wrong.length, `the LiveKit warning is wrong: ${wrong.join("; ")}`);
        if (!game.modules.get("avclient-livekit")?.active) {
            equal(String(liveKitConnectionSettings()), "null", "with avclient-livekit inactive there is still a setting to read");
        }

        const sources = new Map(await otherSources());
        const season = stripComments(sources.get("season-setup.mjs") ?? "");
        const diagnostics = stripComments(sources.get("diagnostics.mjs") ?? "");
        ok(/liveKitSecretWarning\(liveKitConnectionSettings\(\)\)[\s\S]{0,80}key: "liveKitSecret",\s*hintKey: "DRPG\.Voice\.liveKitSecret"/
            .test(bodyOf(season, "function steps(", { until: "\n}\n" })),
            "the season checklist does not ask the rule, or its row does not carry the warning's sentence");
        ok(/game\.user\.isGM \? liveKitSecretWarning\(liveKitConnectionSettings\(\)\) : null/
            .test(bodyOf(diagnostics, "export function diagnoseVoice(", { until: "\n}\n" })),
            "the voice diagnosis does not ask the rule, or asks it on a player's browser as well");
        for (const lang of ["en", "pl"]) {
            const text = await fetch(`/modules/${MODULE_ID}/lang/${lang}.json`).then(r => r.json());
            const flat = foundry.utils.flattenObject(foundry.utils.expandObject(text));
            const missing = [KEY, "DRPG.Season.step.liveKitSecret"].filter(k => typeof flat[k] !== "string");
            ok(!missing.length, `${lang}.json has no ${missing.join(", ")}`);
        }
    }],

    ["R199 - a killer counts at the trial only for a death the table knows", async () => {
        /*
         * E05 fix r2-G1, 27.09.2026; review F1, the owner's Q3. The register takes a killer when the
         * incident closes, which is usually before anybody finds the body, and the trial read the
         * register whole: a death nobody had found was counted by the ballot and the verdict.
         * incident-store.mjs `countsAtTrial`, the rule under `trialBlackenedIds`, pure, driven over rows
         * shaped as `recordBlackened` writes them: a row counts unless every victim it names is a
         * death nobody has published, and a row that names none - every row written before 1.2.64,
         * when a death was the table's at the kill - counts as it always did. Then read from the
         * source: the ballot and the verdict ask the trial's list, never the register whole.
         */
        const { countsAtTrial } = await import("./murder.mjs");
        const HIDDEN = new Set(["R199HIDDEN000001", "R199HIDDEN000002"]);
        const TABLE = [
            ["a row from before 1.2.64, naming no victim", { chapter: 1, epoch: 0, at: 1 }, true],
            ["an empty list of victims", { chapter: 1, epoch: 0, at: 1, victims: [] }, true],
            ["its one victim published", { victims: ["R199KNOWN0000001"] }, true],
            ["its one victim nobody has found", { victims: ["R199HIDDEN000001"] }, false],
            ["two victims, one of them published", { victims: ["R199HIDDEN000001", "R199KNOWN0000001"] }, true],
            ["two victims, neither found", { victims: ["R199HIDDEN000001", "R199HIDDEN000002"] }, false],
            ["victims that are not ids", { victims: [null, 7, ""] }, true]
        ];
        const wrong = TABLE.filter(([, row, want]) => countsAtTrial(row, id => HIDDEN.has(id)) !== want).map(([label]) => label);
        ok(!wrong.length, `the trial counts a killer wrongly for: ${wrong.join("; ")}`);

        // What a closed incident writes: a new killer's row names the victim; a killer already in
        // the chapter's register gains the new one; a row from before 1.2.64 and a victim already
        // named are left alone; an incident with no victim id names none.
        const { blackenedWrites } = await import("./murder.mjs");
        const { stableJson } = await import("./gm-store.mjs");
        const STAMP = { chapter: 3, epoch: 2, at: 100 };
        const held = { R199AGAIN0000001: { chapter: 3, epoch: 2, at: 1, victims: ["R199HIDDEN000001"] },
            R199OLDROW000001: { chapter: 3, epoch: 0, at: 2 } };
        equal(stableJson([
            blackenedWrites(held, ["R199NEW000000001", "R199AGAIN0000001", "R199OLDROW000001"], "R199KNOWN0000001", STAMP),
            blackenedWrites(held, ["R199AGAIN0000001"], "R199HIDDEN000001", STAMP),
            blackenedWrites({}, ["R199NEW000000001"], null, STAMP)
        ]), stableJson([
            { R199NEW000000001: { chapter: 3, epoch: 2, at: 100, victims: ["R199KNOWN0000001"] },
                R199AGAIN0000001: { victims: ["R199HIDDEN000001", "R199KNOWN0000001"] } },
            {},
            { R199NEW000000001: { chapter: 3, epoch: 2, at: 100, victims: [] } }
        ]), "a closed incident's writes to the register do not name its victim on a new row, add it to a killer's row, "
            + "or leave a row from before 1.2.64 and a victim already named alone");

        const vote = stripComments(new Map(await otherSources()).get("vote.mjs") ?? "");
        ok(!/\bblackened(Ids|Actors)\(/.test(vote) && /\btrialBlackenedIds\(\)/.test(vote) && /\btrialBlackenedActors\(\)/.test(vote),
            "vote.mjs reads the register whole, or the ballot and the verdict no longer ask the trial's list");
    }],

    ["R200 - a settlement pays each conversion once, and the Despair counters read what the other GMs hold", async () => {
        /*
         * E05 fix r2-G2, 27.09.2026; review F5, S2-m7. The owed Despair is a row per conversion in
         * each GM's store, and the pools it is paid from are world data, which carries the time of
         * day the last settlement ran in. `settlementOf` is the rule, pure, and driven here: a row
         * of this time of day waits, a row of the marked one pays, a row of an older one was due at
         * a settlement that has run and goes unpaid, two GMs' rows of one pool both pay, and the
         * mark is written whenever it moves once anything has been paid. NEVER TWICE: whatever a
         * settlement paid, the same rows settled again against what it wrote - a GM's browser that
         * left before the removal reached it, opened later at the same or a later time of day -
         * pay nothing. Then read from the source, as the rest needs other GMs (tier 2 and 61 Q
         * drive it): a conversion's row has a key of its own, and each of the counters' writers,
         * and the trial's two counts, waits for its store's hydration before it reads.
         */
        const D = await import("./despair.mjs");
        const { stableJson } = await import("./gm-store.mjs");
        const NOW = "1.2.evening", LAST = "1.2.afternoon", OLDER = "1.2.noon", LATER = "1.3.morning";
        const P = "R200POOL00000001", Q = "R200POOL00000002";
        const row = (owed, since) => ({ owed, since });
        const settle = (rows, held, now = NOW) => {
            const r = D.settlementOf(Object.entries(rows), held, now);
            return [r.pools, [...r.drop].sort(), r.paid, r.write];
        };
        const TABLE = [
            ["with no settlement that paid, every row of an earlier time of day pays",
                [{ [`${P}:a:1`]: row(2, LAST), [`${P}:b:2`]: row(1, OLDER) }, { [P]: 5 }],
                [{ [P]: 2, settled: NOW }, [`${P}:a:1`, `${P}:b:2`], 2, true]],
            ["a row of this time of day waits, and the mark moves",
                [{ [`${P}:a:1`]: row(2, NOW) }, { [P]: 5, settled: LAST }],
                [{ [P]: 5, settled: NOW }, [], 0, true]],
            ["a row of the marked time of day pays; an older one was paid and goes",
                [{ [`${P}:a:1`]: row(2, LAST), [`${P}:b:2`]: row(3, OLDER) }, { [P]: 6, settled: LAST }],
                [{ [P]: 4, settled: NOW }, [`${P}:a:1`, `${P}:b:2`], 1, true]],
            ["rows the primary settled, held by a GM that was away, pay nothing",
                [{ [`${P}:a:1`]: row(2, LAST) }, { [P]: 4, settled: NOW }],
                [{ [P]: 4, settled: NOW }, [`${P}:a:1`], 0, false]],
            ["two GMs' rows of one pool both pay, and another pool's",
                [{ [`${P}:a:1`]: row(1, LAST), [`${P}:b:2`]: row(2, LAST), [`${Q}:a:3`]: row(1, LAST) }, { [P]: 10, [Q]: 0, settled: LAST }],
                [{ [P]: 7, [Q]: 0, settled: NOW }, [`${P}:a:1`, `${P}:b:2`, `${Q}:a:3`], 3, true]],
            ["a row of a pool no longer in the world goes unpaid",
                [{ [`${Q}:a:1`]: row(1, LAST) }, { [P]: 5, settled: LAST }],
                [{ [P]: 5, settled: NOW }, [`${Q}:a:1`], 0, true]],
            ["nothing owed at the time of day already marked writes nothing",
                [{}, { [P]: 5, settled: NOW }], [{ [P]: 5, settled: NOW }, [], 0, false]],
            ["a world that never paid anything writes no mark",
                [{}, { [P]: 5 }], [{ [P]: 5, settled: NOW }, [], 0, false]]
        ];
        const wrong = TABLE.filter(([, [rows, held], want]) => stableJson(settle(rows, held)) !== stableJson(want))
            .map(([what, [rows, held]]) => `${what}: ${stableJson(settle(rows, held))}`);
        ok(!wrong.length, `a settlement pays the wrong rows: ${wrong.join("; ")}`);

        const twice = [];
        for (const [what, [rows, held]] of TABLE) {
            const first = D.settlementOf(Object.entries(rows), held, NOW);
            const written = first.write ? first.pools : held;
            const settledRows = Object.fromEntries(Object.entries(rows).filter(([key]) => first.drop.includes(key)));
            for (const now of [NOW, LATER]) {
                if (D.settlementOf(Object.entries(settledRows), written, now).paid) twice.push(`${what} (again at ${now})`);
            }
        }
        ok(!twice.length, `rows a settlement took are paid again by a browser that still holds them: ${twice.join("; ")}`);

        const sources = new Map(await otherSources());
        const src = name => stripComments(sources.get(name) ?? "");
        const recording = fnSource(src("despair.mjs"), "recordOwed");
        ok(/despairOwedStore\.patch\(`\$\{userId\}:\$\{game\.user\.id\}:\$\{Date\.now\(\)\}`/.test(recording),
            "a conversion's debt is not a row of its own: two GMs converting from one pool at once keep one");
        const WAITS = [
            ["despair.mjs", "convertDespairToHope", "await despairOwedStore.whenHydrated();", "spendableDespair("],
            ["despair.mjs", "spendDespairCall", "await despairOwedStore.whenHydrated();", "spendableDespair("],
            ["despair.mjs", "spillFrom", "await despairOwedStore.whenHydrated();", "owedOf("],
            ["overflow.mjs", "addOverflow", "await overflowStore.whenHydrated();", "state()"],
            ["overflow.mjs", "checkOverflow", "await overflowStore.whenHydrated();", "state()"],
            ["overflow.mjs", "resetOverflow", "await overflowStore.whenHydrated();", "overflowStore.patch("],
            // E10 C1: the vote opens on the primary GM, in `runVoteOp` (`openVote` asks it).
            ["vote.mjs", "runVoteOp", "await whenTrialReadable();", "trialBlackenedIds("],
            ["vote.mjs", "openVerdictDialog", "await whenTrialReadable();", "trialBlackenedActors("]
        ];
        const early = WAITS.filter(([file, name, wait, read]) => {
            const fn = fnSource(src(file), name);
            const at = fn.indexOf(wait), reads = fn.indexOf(read);
            return !(at >= 0 && reads > at);
        }).map(([file, name]) => `${file} ${name}`);
        ok(!early.length, `these read their store before it holds the other GMs' rows: ${early.join(", ")}`);
    }],

    ["R202 - a message rule of the world-secrets rule reads a card of its kind, and an ordinary card's speaker stays its actor", async () => {
        /*
         * E06 C1, 27.09.2026. world-secrets.mjs gains `messages`: rules for chat messages of one kind
         * (a module flag, `when`) - `fields` that must be absent or empty, `*` for an array index,
         * and `flagsOnly`, the module flags such a card may carry. The list is empty at C1; each
         * later rule brings its R190 fixture (R190 names every field and `flagsOnly` of every message
         * rule it has none for). This reads the two new kinds on fabricated messages
         * with a rule written here: a roll card of the kind, with its speaker, a roll's title (the
         * JSON text Foundry keeps a roll as, beside one already parsed, whose title is empty) and a
         * flag the rule does not allow, each found where it is and nowhere else - the killer's id
         * found in its speaker and in a roll's `options.data`, which a rule of its kind lets the
         * reader look at; the same card without the flag reads clean, its speaker being its actor
         * by design; and one of the kind that holds nothing reads clean.
         */
        const W = await import("./world-secrets.mjs");
        const MOD = W.WORLD_SECRET_MODULE;
        const KILLER = "R202KILLERACTOR1";
        const RULES = { settings: {}, flags: {}, messages: [{ when: "r202Card", fields: ["speaker.actor", "system.title", "rolls.*.options.title"],
            flagsOnly: ["r202Card", "secret"], since: "R202", why: "a fixture" }] };
        const roll = (title, id = null) => ({ class: "DualityRoll", options: { title, ...(id ? { data: { id, name: "R202" } } : {}) } });
        const card = (id, flags) => ({ id, flags: { [MOD]: flags }, speaker: { actor: KILLER, alias: "R202" }, system: { title: "" },
            rolls: [JSON.stringify(roll("R202 Strike", KILLER)), roll("")], whisper: [], author: "R202USER00000001" });
        const hits = W.findWorldSecrets({ messages: [
            card("R202MESSAGE00001", { r202Card: true, secret: true, popupTitle: "R202 Strike" }),
            card("R202MESSAGE00002", { secret: true }),
            { id: "R202MESSAGE00003", flags: { [MOD]: { r202Card: true } }, speaker: { actor: null, alias: "" }, system: { title: "" },
                rolls: [roll("")], whisper: [], author: "R202USER00000001" }
        ] }, { ids: [KILLER], rules: RULES });
        equal(JSON.stringify(hits.map(h => [h.kind, h.id, h.path])), JSON.stringify([
            ["messageField", "R202MESSAGE00001", "speaker.actor"], ["messageField", "R202MESSAGE00001", "rolls.0.options.title"],
            ["messageFlag", "R202MESSAGE00001", `flags.${MOD}.popupTitle`],
            ["id", "R202MESSAGE00001", "speaker.actor"], ["id", "R202MESSAGE00001", "rolls.0.options.data.id"]
        ]), "a message rule did not find what a card of its kind held, found something where it is empty, or read a card of another kind");
    }],

    ["R203 - who is in an incident is one table, by the stage: every cell of incidentSeats", async () => {
        /*
         * E06 C2, 27.09.2026; audit S04-01, the owner's D6. settings.mjs `incidentSeats` is the
         * table every reader of "who is told" asks - the cast's sender, the witness, the opening
         * card, the frozen clock. Every cell, on made-up ids: a direct murder, a trap and a
         * self-inflicted death (one id in both chairs, direct), each with no third, a third on the
         * killer's side and one who is not (a side not yet chosen reads as not the killer's), at
         * the opening, the fight, Stage 6 and a state that names no stage. Then the two readings
         * the table leans on: a `stage` named by the caller wins over the state's, and a cast that
         * holds no `indirect` reads the world half's (`incidentIndirect`).
         */
        const { incidentSeats } = await import("./settings.mjs");
        const KINDS = { direct: { killerId: "K", victimId: "V", indirect: false }, trap: { killerId: "K", victimId: "V", indirect: true },
            self: { killerId: "S", victimId: "S", indirect: false } };
        const THIRDS = { none: {}, killers: { thirdId: "T", thirdSide: "killer" }, other: { thirdId: "T", thirdSide: null } };
        const STAGES = ["openingRoll", "incident", "resolution", undefined];
        const read = {};
        for (const [kind, cast] of Object.entries(KINDS)) {
            for (const [third, extra] of Object.entries(THIRDS)) {
                for (const stage of STAGES) {
                    read[`${kind} ${third} ${stage ?? "-"}`] = incidentSeats({ ...cast, ...extra }, { active: true, stage }).join("");
                }
            }
        }
        const EXPECTED = {
            "direct none openingRoll": "K", "direct none incident": "KV", "direct none resolution": "KV", "direct none -": "KV",
            "direct killers openingRoll": "KT", "direct killers incident": "KVT", "direct killers resolution": "KVT", "direct killers -": "KVT",
            "direct other openingRoll": "K", "direct other incident": "KVT", "direct other resolution": "KVT", "direct other -": "KVT",
            "trap none openingRoll": "V", "trap none incident": "V", "trap none resolution": "KV", "trap none -": "KV",
            "trap killers openingRoll": "V", "trap killers incident": "V", "trap killers resolution": "KVT", "trap killers -": "KVT",
            "trap other openingRoll": "V", "trap other incident": "VT", "trap other resolution": "KVT", "trap other -": "KVT",
            "self none openingRoll": "S", "self none incident": "S", "self none resolution": "S", "self none -": "S",
            "self killers openingRoll": "ST", "self killers incident": "ST", "self killers resolution": "ST", "self killers -": "ST",
            "self other openingRoll": "S", "self other incident": "ST", "self other resolution": "ST", "self other -": "ST"
        };
        // Built in the order EXPECTED is written in, so the two read as one text.
        equal(JSON.stringify(read), JSON.stringify(EXPECTED), "a cell of the incident's seats is not the table's");
        const named = incidentSeats(KINDS.direct, { active: true, stage: "incident" }, { stage: "openingRoll" }).join("");
        const fromWorld = incidentSeats({ killerId: "K", victimId: "V" }, { active: true, stage: "incident", indirect: true }).join("");
        const castWins = incidentSeats(KINDS.direct, { active: true, stage: "incident", indirect: true }).join("");
        equal(JSON.stringify([named, fromWorld, castWins]), JSON.stringify(["K", "V", "KV"]),
            "the stage a caller names does not win over the state's, or a cast without the method does not read the world half's, "
            + "or the world half's overrides a cast that holds it");
    }],

    ["R204 - a Reroll rebuilds a neutral roll from its character and its bookmark, and writes it back naming nobody", async () => {
        /*
         * E06 fix r1-G1, 28.09.2026; review M1 = F1. A roll the module threw keeps nothing of its
         * character in its message (private-rolls.mjs `neutralRollOf`), and a Reroll rebuilds the
         * formula from the roll's options - so reroll.mjs `rollAsThrown` puts back what the
         * rebuild reads: the character's data from the actor, the statistic and the experiences
         * from the GMs' bookmark (the roll's own browser's until E08+E28 C4a). A made-up roll
         * class stands in for Daggerheart's, which the harness does not have: a neutral roll comes back rebuilt with
         * the sheet, the statistic in Daggerheart's key and the experiences, its own options
         * untouched; a roll the module did not throw comes back as it was; one the bookmark does
         * not name is refused. Then what the Reroll writes into the message (`rerolledSource`),
         * from a rerolled roll that carries all of it and an experience's label: no sheet, no
         * statistic, no experience, no label, no Loaded Die's mark (fix r2-G2, 28.09.2026: the
         * nonce its Call keeps on the character), and a clean read against the world-secrets rule -
         * and a roll the module did not throw is written as it is.
         */
        const RR = await import("./reroll.mjs");
        const W = await import("./world-secrets.mjs");
        const MOD = W.WORLD_SECRET_MODULE;
        class Thrown { constructor(formula, data, options) { Object.assign(this, { formula, data, options }); } }
        const sheet = { traits: { instinct: { value: 2 } }, experiences: { R204EXPERIENCE01: { name: "R204 Kendo Captain", value: 2 } },
            companion: "Actor.R204COMPANION00001" };
        const actor = { id: "R204ACTOR0000001", getRollData: () => sheet };
        const message = (id, claimed) => ({ id, getFlag: (scope, key) => claimed && scope === MOD && key === "supersededRoll" });
        const FORMULA = "1d12 + 1d12 + 2 + 2";
        const stored = { title: "", data: {}, roll: { type: "action", modifiers: [{ label: "", value: 2 }, { label: "", value: 2 }] }, actionType: "action" };
        const original = Object.assign(new Thrown(FORMULA, {}, structuredClone(stored)), { _formula: FORMULA });
        const mark = { messageId: "R204MESSAGE00001", trait: "eye", experiences: ["R204EXPERIENCE01"] };

        const thrown = await RR.rollAsThrown(original, actor, message("R204MESSAGE00001", true), mark);
        const plain = await RR.rollAsThrown(original, actor, message("R204MESSAGE00002", false), null);
        let refused = null;
        try { await RR.rollAsThrown(original, actor, message("R204MESSAGE00003", true), mark); } catch (err) { refused = String(err?.message ?? err); }
        equal(JSON.stringify([thrown instanceof Thrown, thrown.formula, thrown.options.data === sheet, thrown.options.roll.trait,
            thrown.options.experiences, thrown.options.effects, JSON.stringify(original.options) === JSON.stringify(stored), plain === original, Boolean(refused)]),
            JSON.stringify([true, FORMULA, true, "instinct", ["R204EXPERIENCE01"], [], true, true, true]),
            `a Reroll does not rebuild a neutral roll from its character and bookmark, touches the message's roll, or rebuilds one it cannot (${refused})`);

        thrown.options.roll.modifiers = [{ label: "DAGGERHEART.CONFIG.Traits.instinct.name", value: 2 }, { label: "R204 Kendo Captain", value: 2 }];
        thrown.options.effects = [{ name: "R204 Blessed", origin: "Actor.R204ACTOR0000001.Item.R204ITEM00000001" }];
        thrown.options.drpgLoadedDie = "R204NONCE0000001";
        const rerolled = { toJSON: () => ({ class: "DualityRoll", formula: FORMULA, total: 17, options: thrown.options }) };
        const written = RR.rerolledSource(rerolled, message("R204MESSAGE00001", true));
        const back = typeof written === "string" ? JSON.parse(written) : null;
        const hits = W.findWorldSecrets({ messages: [{ id: "R204MESSAGE00001", flags: { [MOD]: { supersededRoll: true } },
            speaker: { alias: "Monokuma", actor: null, token: null, scene: null }, system: { title: "", source: { actor: "" }, targets: [] },
            rolls: [written], whisper: [], author: "R204USER00000001" }] }, { ids: [actor.id] });
        equal(JSON.stringify([back?.total, back?.options?.data, back?.options?.roll?.modifiers, back?.options?.roll?.trait ?? null,
            back?.options?.experiences ?? null, back?.options?.effects ?? null, ["R204 Kendo Captain", "R204COMPANION", "R204ACTOR", "R204NONCE"].filter(x => written.includes(x)),
            hits.map(h => h.path), RR.rerolledSource(rerolled, message("R204MESSAGE00002", false)) === rerolled]),
            JSON.stringify([17, {}, [{ label: "", value: 2 }, { label: "", value: 2 }], null, null, null, [], [], true]),
            "a Reroll writes a rerolled roll the module threw back with its character in it, or rewrites one the module did not throw");
    }],

    ["R206 - a new incident's values name every field of the world half and the cast but the betrayal offer", async () => {
        /*
         * E32 C5a, 28.09.2026; audit S04-03. `openMurder` wrote a patch that named a new
         * incident's fields one by one, and a field it left out crossed from the last incident
         * into the next - `thirdActed` into a betrayal's until E32 C2. It writes
         * `freshIncidentState` whole now (murder-rules.mjs, re-exported by murder.mjs), so that
         * list is the one to hold: every field of `PUBLIC_INCIDENT` and of `CAST_FIELDS` but
         * `betrayal`, which a close keeps (D18), and nothing else. Then what it opens with -
         * the stage, the killers' turn, the kind, the clock's reading it was handed - and that
         * it is pure: two calls with the same answers are equal and share nothing, so a caller
         * that changes one does not change the next.
         */
        const M = await import("./murder.mjs");
        const S = await import("./gm-stores.mjs");
        // `chapter` since E09 fix r1-G3: the one the incident opened in, the clock's unless the caller names it.
        const args = { killerId: "R206KILLER000001", victimId: "R206VICTIM000001", indirect: true, openedAt: 206, chapter: 7 };
        const fresh = M.freshIncidentState(args);
        const sorted = list => [...list].sort();
        const due = sorted([...Object.keys(M.PUBLIC_INCIDENT), ...S.CAST_FIELDS.filter(f => f !== "betrayal")]);
        equal(JSON.stringify(sorted(Object.keys(fresh))), JSON.stringify(due),
            "a new incident's values do not name exactly the world half's and the cast's fields but the betrayal offer");
        equal(JSON.stringify([fresh.active, fresh.stage, fresh.killerId, fresh.victimId, fresh.killerTurnId, fresh.indirect, fresh.selfInflicted, fresh.openedAt, fresh.chapter]),
            JSON.stringify([true, "openingRoll", args.killerId, args.victimId, args.killerId, true, false, 206, 7]),
            "a new incident does not open at the opening roll with its killer's turn, its kind and the time and the chapter it was handed");
        const again = M.freshIncidentState(args);
        const same = JSON.stringify(again) === JSON.stringify(fresh);
        fresh.spent.push("strike");
        fresh.hindered.victim.strike = 1;
        equal(JSON.stringify([same, again.spent, again.hindered]), JSON.stringify([true, [], { victim: {}, killer: {} }]),
            "two new incidents with the same answers differ, or share a list or a table, so one changed the other");
    }],

    ["R207 - a closed incident left a body by the ending that kills or by its victim dead, and Escape together's trace is an incident's", async () => {
        /*
         * E32 C6, 28.09.2026; audit S04-11, S02-43. incident-store.mjs `leftABody` is the one question
         * the Blackened, the betrayal's offer, the GM's checklist and the participants' notice
         * ask at a close. Every ending the module writes (and none), each with the victim alive
         * and dead, on made-up states and a made-up reader of a death: a Finishing blow, running
         * out and a self-inflicted death are a body before their death is recorded; a Survive,
         * an escape, the GM's Stage 6 and a fight closed half way only with the victim dead; a
         * state that names no victim never. The reader it is not handed - `isDeadForGm` - finds
         * no body for an actor that does not exist. Then the trace an escape leaves, which was a
         * Prep Remnant: an Incident Remnant, as the other crisis actions'.
         */
        const M = await import("./murder.mjs");
        const ENDINGS = ["finishingBlow", "ranOut", "selfInflicted", "survive", "sharedEscape", "victimKilled", "test", null];
        const read = {};
        for (const endedBy of ENDINGS) {
            for (const dead of [false, true]) {
                read[`${endedBy} ${dead ? "dead" : "alive"}`] = M.leftABody({ victimId: "R207VICTIM000001", endedBy }, id => dead && id === "R207VICTIM000001");
            }
        }
        const EXPECTED = {
            "finishingBlow alive": true, "finishingBlow dead": true, "ranOut alive": true, "ranOut dead": true,
            "selfInflicted alive": true, "selfInflicted dead": true, "survive alive": false, "survive dead": true,
            "sharedEscape alive": false, "sharedEscape dead": true, "victimKilled alive": false, "victimKilled dead": true,
            "test alive": false, "test dead": true, "null alive": false, "null dead": true
        };
        equal(JSON.stringify(read), JSON.stringify(EXPECTED), "an ending's body is not the rule's");
        equal(JSON.stringify([M.leftABody({ endedBy: "finishingBlow" }, () => true), M.leftABody(null, () => true),
            M.leftABody({ victimId: "R207NOBODY000001", endedBy: "survive" })]), JSON.stringify([false, false, false]),
            "a state that names no victim left a body, or an actor that does not exist is dead");
        equal(CRISIS_ACTIONS.sharedEscape?.remnantType, "incident", "Escape together's trace is not an Incident Remnant");
    }],

    ["R208 - a reserve is what is left, a change to it says what landed and what did not, and its note names no resource key", async () => {
        /*
         * E32+E07 C7, 28.09.2026; audit S04-05, the owner's D5 (design N5's unit cases).
         * character.mjs's RESERVE section on made-up sheets - nothing is written: a reserve
         * read from marks (and past either end of the track, and with no maximum); a loss
         * on a full reserve, a loss on an empty one (nothing lands, all of it overflows - the
         * incident puts that on Health), a recovery held to the maximum; and the note, which
         * says the amounts that landed with the language file's labels, leaves out what
         * landed nothing, and never prints `stress` or `hitPoints`.
         */
        const C = await import("./character.mjs");
        const { plural } = await import("./utils.mjs");
        const sheet = (key, value, max) => ({ system: { resources: { [key]: { value, max } } } });
        equal(JSON.stringify([C.reserveFrom(0, 6), C.reserveFrom(8, 6), C.reserveFrom(-2, 4), C.reserveFrom(2, null)]),
            JSON.stringify([{ max: 6, marks: 0, left: 6, pct: 100, empty: false }, { max: 6, marks: 8, left: 0, pct: 0, empty: true },
                { max: 4, marks: -2, left: 4, pct: 100, empty: false }, { max: 0, marks: 2, left: 0, pct: 0, empty: true }]),
            "a reserve is not the maximum less the marks, held to the track");
        equal(JSON.stringify([C.reserveOf(sheet("stress", 2, 6), "stress").left, Object.keys(C.RESERVES).sort()]), JSON.stringify([4, ["hitPoints", "stress"]]),
            "an actor's reserve is not read off its sheet, or the reserves are not Health and Sanity");
        const changes = [
            C.reserveChange(sheet("stress", 0, 6), "stress", -1),
            C.reserveChange(sheet("stress", 6, 6), "stress", -1),
            C.reserveChange(sheet("hitPoints", 3, 4), "hitPoints", 3),
            C.reserveChange(sheet("hitPoints", 3, 4), "hitPoints", 5),
            C.reserveChange(sheet("hitPoints", 1, 4), "hitPoints", -2)
        ];
        equal(JSON.stringify(changes), JSON.stringify([
            { key: "stress", update: { "system.resources.stress.value": 1 }, landed: 1, overflow: 0 },
            { key: "stress", update: {}, landed: 0, overflow: 1 },
            { key: "hitPoints", update: { "system.resources.hitPoints.value": 0 }, landed: 3, overflow: 0 },
            { key: "hitPoints", update: { "system.resources.hitPoints.value": 0 }, landed: 3, overflow: 2 },
            { key: "hitPoints", update: { "system.resources.hitPoints.value": 3 }, landed: 2, overflow: 0 }
        ]), "a change does not say what landed and what overflowed, or its update is not the reserve it leaves");
        const health = n => plural("DRPG.Reserve.health", { n }), sanity = n => plural("DRPG.Reserve.sanity", { n });
        const one = C.reserveNote({ you: true }, [{ key: "hitPoints", landed: 1 }, { key: "stress", landed: 0 }]);
        const them = C.reserveNote({ name: "R208 Somebody" }, [{ key: "hitPoints", landed: 2 }]);
        const both = C.reserveNote({ you: true }, [{ key: "hitPoints", landed: 1 }, { key: "stress", landed: 3 }]);
        equal(JSON.stringify([one, them, C.reserveNote({ you: true }, [{ key: "stress", landed: 0 }, { key: "hope", landed: 2 }])]),
            JSON.stringify([game.i18n.format("DRPG.Murder.youLose", { what: health(1) }),
                game.i18n.format("DRPG.Murder.theyLose", { name: "R208 Somebody", what: health(2) }), ""]),
            "the note does not say what landed in the second person or by name, or says something when nothing landed");
        ok(both.includes(health(1)) && both.includes(sanity(3)) && both.indexOf(health(1)) < both.indexOf(sanity(3))
            && ![one, them, both].some(note => /hitPoints|stress|STRESS|DRPG\./.test(note)),
            `a two-reserve note lost an amount, or a note prints a resource key: ${JSON.stringify([one, them, both])}`);
    }],

    ["R209 - a card's words are cut for each reader: the line for them, never the other one, and no marker naming a user", async () => {
        /*
         * E32+E07 C7, 28.09.2026; audit S04-05. A hit's note is one card carrying two lines -
         * "You lose ..." for the victim's players, the name for everyone else (secret.mjs
         * `youOrThem`) - and `wordsFor` cuts every copy of the words before it leaves the
         * poster: the victim's player holds their line, another player and a GM the other, a
         * GM the GMs' prose besides, and no copy keeps a `data-drpg-` marker, which would
         * name the victim's user to everyone else. A card with neither kind of part reaches
         * a reader byte for byte. On a fixture card; nothing is posted.
         */
        const S = await import("./secret.mjs");
        const gm = game.users.find(u => u.isGM);
        must(gm, "no GM user to read the card as");
        const VICTIM = "R209VICTIM000001", OTHER = "R209PLAYER000001";
        const line = S.youOrThem([VICTIM], { you: "R209 you lose", them: "R209 they lose" });
        const card = `<h3>R209</h3><ul><li>${line}</li></ul><div class="drpg-gm-only"><p>R209 GM prose</p></div>`;
        const read = id => {
            const words = S.wordsFor(id, card);
            return ["R209 you lose", "R209 they lose", "R209 GM prose", "data-drpg-", "<h3>R209</h3>"].map(part => words.includes(part));
        };
        equal(JSON.stringify([read(VICTIM), read(OTHER), read(gm.id)]),
            JSON.stringify([[true, false, false, false, true], [false, true, false, false, true], [false, true, true, false, true]]),
            "a reader holds a line not written for them, lost their own or the card, keeps a marker, or the GMs' prose went to a player");
        const plain = `<p>R209 plain words</p>`;
        equal(JSON.stringify([S.wordsFor(gm.id, plain) === plain, S.wordsFor(OTHER, plain) === plain,
            S.youOrThem([], { you: "a", them: "b" }), S.youOrThem(['R209" onclick="x'], { you: "a", them: "b" })]),
            JSON.stringify([true, true, "b", "b"]),
            "a card with no lines is not sent as written, or a line with nobody (or no id) to say \"you\" to is not the other line alone");
    }],

    ["R210 - a copy that holds the betrayal offer alone is weighed on the seats, as \"not in it\" is", async () => {
        /*
         * E32+E07 fix r1-G1, 29.09.2026; the security review's M1. The offer outlives its
         * incident (D18), and while another runs its third is sent the offer alone with the
         * seats' stamps (incident-store.mjs `castPacket`): the rest of the record's stamps time that
         * other fight. Weighed on every part, the copy they held of the fight they fought
         * refused it - 0 against its turn's stamp. Pure (`castCombine`), on fixture stamps.
         */
        const { castCombine } = await import("./gm-stores.mjs");
        const offer = { thirdId: "T", killerId: "K" };
        const seats = at => ({ killerId: at, victimId: at, thirdId: at, betrayal: 150 });
        const fought = { value: { killerId: "K", victimId: "V", thirdId: "T", betrayal: offer, turn: 3 },
            stamps: { ...seats(100), killerTurnId: 100, turn: 300, keyRemnants: 300, lastCrisis: 300 } };
        const closed = { value: { betrayal: offer }, stamps: seats(400) };
        equal(JSON.stringify(castCombine(fought, closed)), JSON.stringify(closed),
            "the offer alone, sent at the close's seats, did not replace the fight's copy, or kept parts beside the seats");
        equal(castCombine(closed, { value: { betrayal: offer }, stamps: seats(400) }), null, "the offer alone at the seats' own stamps was taken again");
        equal(castCombine(closed, { value: { betrayal: offer }, stamps: { ...seats(500), thirdId: 300 } }), null,
            "the offer alone, older in one seat, was taken");
        equal(castCombine(fought, { value: { betrayal: offer }, stamps: { ...seats(400), turn: 900 } })?.stamps?.turn, undefined,
            "the offer alone kept a stamp of the fight");
        const seatedAgain = { value: { killerId: "K2", victimId: "T", betrayal: offer, turn: 1 }, stamps: { ...seats(600), turn: 600, keyRemnants: 600 } };
        equal(castCombine(closed, seatedAgain), seatedAgain, "the offer's third, seated in the next incident, did not take its cast");
    }],

    ["R211 - the GM refuses a crisis action the side is not offered", async () => {
        /*
         * E32+E07 C11a, 02.10.2026; audit S04-06. `crisisRefusal` is what the GM asks of a
         * player's crisis packet (bridge-guards.mjs `guardCrisisAction`), and it read the
         * locks and spends of an action in the side's list and let one MISSING from it through:
         * Role reversal after a Despair opening was not drawn, and a packet naming it was
         * carried out. Asked of fixture states, as the judgement is asked of a Reroll's receipt:
         * the victim's denied Role reversal and a trap's third's Double role reversal are
         * refused with their own reason, and offered, unlocked, are not. Pure; nothing is written.
         */
        const M = await import("./murder.mjs");
        const V = { id: "R211VICTIM000001" }, K = { id: "R211KILLER000001" }, T = { id: "R211THIRD0000001" };
        const fight = { stage: "incident", killerId: K.id, victimId: V.id, thirdId: T.id, thirdSide: null, thirdActed: false,
            turn: 2, turnSide: "victim", unlocked: ["survive", "roleReversal"], spent: ["selfDefence"] };
        const trap = { ...fight, indirect: true, deniedToVictim: ["roleReversal", "doubleRoleReversal"] };
        const said = (actor, key, state) => {
            const r = M.crisisRefusal(actor, key, state);
            return r ? `${r.why} | ${r.key}` : null;
        };
        const DENIED = "that action is not open to that character now | DRPG.Murder.actionDenied";
        const offers = (actor, state) => M.availableCrisisActions(actor, state).map(o => o.key);
        equal(JSON.stringify([said(V, "roleReversal", trap), said(T, "doubleRoleReversal", trap), said(T, "doubleRoleReversal", fight),
            offers(V, fight).includes("roleReversal"), offers(V, trap).includes("roleReversal")]),
            JSON.stringify([DENIED, DENIED, null, true, false]),
            "a denied reversal was let through or refused for another reason, or the third's offered one was refused, or the list was not asked of the state given");
    }],

    ["R212 - a roll that lists several statistics asks a GM, and only then", async () => {
        /*
         * E32+E07 C11b, 02.10.2026; audit S04-23 (the owner's Q4 as corrected on 28.09).
         * `traitFor` (trait-ruling.mjs) decides who picks a roll's statistic: one listed
         * trait is rolled as it is; several are a GM's pick - in a window on a GM's browser,
         * through the bridge on a player's; an armed Resolve leaves the pick to the roll
         * window; and an answer the definition does not list, or none, means no roll. Asked
         * on stubs (`seams`: who this browser is, whether Resolve is armed, the two ways of
         * asking, each noting that it was asked), with the lists read from config: Pin (Body),
         * Attack with a weapon (Body / Hand / Leg), a trap victim's Leave a clue (Hand / Leg /
         * Body), and a kind that is none. Pure; nothing is written.
         */
        const T = await import("./trait-ruling.mjs");
        const A = { id: "R212ACTOR0000001", name: "R212" };
        const asked = [];
        const seams = over => ({
            isGm: false, resolveArmed: () => false,
            pickHere: async (actor, spec, listed) => { asked.push(["here", spec.key]); return listed[1]; },
            askGms: async (actor, spec) => { asked.push(["gms", spec.key]); return "leg"; },
            ...over
        });
        const attack = { kind: "crisis", key: "weaponAttack" };
        const read = [
            await T.traitFor(A, { kind: "crisis", key: "pin" }, seams()),
            await T.traitFor(A, attack, seams()),
            await T.traitFor(A, attack, seams({ resolveArmed: () => true })),
            await T.traitFor(A, attack, seams({ isGm: true })),
            await T.traitFor(A, attack, seams({ askGms: async () => "eye" })),
            await T.traitFor(A, attack, seams({ askGms: async () => null })),
            await T.traitFor(A, { kind: "crisis", key: "leaveClue", variant: "indirectVictim" }, seams({ askGms: async () => "body" })),
            await T.traitFor(A, { kind: "nonsense", key: "weaponAttack" }, seams())
        ];
        const pick = (trait, byGm) => ({ trait, byGm });
        equal(JSON.stringify([read, asked]), JSON.stringify([
            [pick("body", false), pick("leg", true), pick("body", false), pick("hand", true), null, null, pick("body", true), null],
            [["gms", "weaponAttack"], ["here", "weaponAttack"]]
        ]), "a roll did not take its one trait, or several did not go to a GM, or Resolve was asked, or an answer off the list was rolled (answers, who was asked)");
    }],
    ["R216 - a Reroll answered past its clock still counts, and a GM leaving is not the primary", async () => {
        /*
         * E08+E28 fix r1-G5, 04.10.2026; the round-1 review's m1 and m3.
         * m1: `reroll.ask` waits `TIMING.rulingMs` while its run can wait on a GM's dialog as
         * long as the GM takes; past the clock the asker read "not carried out" while the
         * Reroll was made and paid, and no card came. Driven with R165's fakes: a request with a
         * `lateRefused` hears a refusal after its clock, once, with its code, and one without it
         * hears nothing (as before); and read in the source: `requestReroll` asks quietly with a
         * `late`, a `lateRefused` and a `lateMs`, and `askReroll` says `DRPG.Reroll.stillMaking`
         * for the clock, not the bridge's "not carried out". A player's browser answered after
         * 180 s is not driven here: no scenario waits that long.
         * m3: the recovery on `userConnected(gm, false)` asked `isPrimaryGm()`, which reads
         * `active`. Read: `primaryGmId({ leaving })` without this GM (null where it is the only
         * GM), with a player named (this GM), and the recovery's pass asking with `leaving`.
         * Which of the hook and the flag comes first on v14 is not measured: one GM here.
         */
        const { createWaiter } = await import("./bridge-guards.mjs");
        const { primaryGmId, isPrimaryGm } = await import("./utils.mjs");
        const make = () => {
            const sent = [], said = [];
            const waiter = createWaiter({
                emit: packet => sent.push(packet), gmIds: () => ["R216GM"], me: () => ({ id: "R216ME", isGM: false, isPrimary: false }),
                notify: (action, reason) => said.push(`${action} ${reason}`), fromGm: id => id === "R216GM", report: () => {}
            });
            const reply = (action, extra = {}) => waiter.onReply({ action, userId: "R216ME", requestId: sent.at(-1)?.requestId, ...extra }, "R216GM");
            return { waiter, said, reply };
        };
        const heard = [];
        let w = make();
        let asked = w.waiter.request("r216.late", {}, { ackMs: 1000, timeoutMs: 40, lateMs: 400, settle: "reply", quiet: true,
            lateRefused: reason => heard.push(reason) });
        const timedOut = await asked;
        await wait(80);
        w.reply("bridge.refused", { what: "r216.late", reason: "busy" });
        w.reply("bridge.refused", { what: "r216.late", reason: "made up" });
        const quietOld = [...w.said];
        w = make();
        asked = w.waiter.request("r216.old", {}, { ackMs: 1000, timeoutMs: 40, lateMs: 400, settle: "reply", quiet: true });
        await asked;
        await wait(80);
        w.reply("bridge.refused", { what: "r216.old", reason: "busy" });
        equal(JSON.stringify([timedOut, heard, quietOld, w.said]), JSON.stringify([{ ok: false, reason: "noAnswer" }, ["busy", "refused"], [], []]),
            "a refusal after the clock did not go to `lateRefused` with its code (an unknown one as `refused`), or a request without one heard it (the clock's answer, heard, said)");

        const sources = new Map(await otherSources());
        const body = (file, fn) => fnSource(stripComments(sources.get(file) ?? ""), fn);
        const ask = body("gm-bridge.mjs", "requestReroll"), caller = body("calls.mjs", "askReroll"), pass = body("reroll.mjs", "recoverRerollJournal");
        equal(JSON.stringify([/quiet:\s*true/.test(ask), /\blate\b/.test(ask), /\blateRefused\b/.test(ask), /\blateMs:/.test(ask),
            /DRPG\.Reroll\.stillMaking/.test(caller) && /"noAnswer"/.test(caller), /isPrimaryGm\(\{\s*leaving:\s*gone\s*\}\)/.test(pass)]),
        JSON.stringify([true, true, true, true, true, true]),
            "the Reroll's ask does not hear a late answer, or its clock says it was not carried out, or the recovery counts the GM leaving (quiet, late, lateRefused, lateMs, the clock's line, the pass)");

        const player = game.users.find(u => !u.isGM) ?? null;
        equal(JSON.stringify([primaryGmId({ leaving: game.user.id }) === game.user.id, (player ? primaryGmId({ leaving: player.id }) : primaryGmId()) === primaryGmId(),
            isPrimaryGm({ leaving: game.user.id })]),
        JSON.stringify([false, true, false]),
            "the user named as leaving was still computed as the primary, or a player's leaving moved it (this user primary without itself, the primary without a player, isPrimaryGm without itself)");
    }],

    ["R217 - the GM's draw is on the build it was written for, and leaves any other build alone", async () => {
        /*
         * E08+E28 C12a, 04.10.2026; audit S16-05; the plan's 3.2 (its R216 - taken by fix r1-G5,
         * so this is the next free number). A player's action roll is configured in their browser
         * and drawn by the primary GM through a wrap of Daggerheart's `DualityRoll.build`
         * (roll-draw.mjs), which runs `buildConfigure` and `buildEvaluate` itself and leaves out
         * `buildPost`. On a build that does something else in between, the wrap would drop it
         * silently - so the wrap is put only on the build it was read from (D1: Daggerheart 2.10.x
         * loads, without a maximum), and any other is left alone and said to the GMs once per
         * version. Read here: this world's class passes `reviewBuild` and is wrapped (the seam's
         * state, the patch row's probe); and four classes that differ from it each in one place -
         * the steps in another order, a configuration hook not by Daggerheart's template, no
         * Duality hooks, no `fromData` - are refused, each with its own reason. Reads only: the
         * fakes are never wrapped (`registerRollDraw` reads the world's class alone).
         * Since fix r2-H6 (05.10.2026; review m3) also what is decided on them (`seamFor`, which
         * `registerRollDraw` wraps by): the reviewed fake is to be wrapped and the reordered one
         * left alone, its state "changed" with the review's reason. What the fallback then does on
         * the GM is tier 2's ("a build the draw was not written for ...").
         */
        const { reviewBuild, rollDrawState, seamFor } = await import("./roll-draw.mjs");
        const { PATCHES } = await import("./patches.mjs");
        const live = game.system?.api?.dice?.DualityRoll;
        must(typeof live === "function", "this world's Daggerheart has no DualityRoll to draw");
        const row = PATCHES.find(p => p.target === "DualityRoll.build")?.probe?.() ?? null;
        equal(JSON.stringify([reviewBuild(live), rollDrawState().state, row?.present, row?.ours]),
            JSON.stringify([{ ok: true, why: "" }, "ok", true, true]),
            "this world's build is not the reviewed one, or the seam is not on it (the review, the state, the patch row's present and ours)");
        /* The fakes are classes, so `reviewBuild` reads their source as it reads Daggerheart's; each
           standalone, as a class that extended the reviewed one would inherit what it lacks. */
        const steps = {
            buildEvaluate: async () => {}, buildPost: async () => {}, toMessage: async () => {}, dualityUpdate: async () => {},
            fromData: data => data, getHooks: () => ["Duality"]
        };
        const reviewed = Object.assign(class R217Reviewed {
            static async build(config, message) { await this.buildConfigure(config, message); await this.buildEvaluate(config, message); await this.buildPost(config, message); return config; }
            static async buildConfigure(config) { for (const hook of config.hooks) Hooks.call(`daggerheart.post${hook}RollConfiguration`, config); return {}; }
        }, steps);
        const reordered = Object.assign(class R217Reordered {
            static async build(config, message) { await this.buildConfigure(config, message); await this.buildPost(config, message); await this.buildEvaluate(config, message); return config; }
            static async buildConfigure(config) { for (const hook of config.hooks) Hooks.call(`daggerheart.post${hook}RollConfiguration`, config); return {}; }
        }, steps);
        const untemplated = Object.assign(class R217Untemplated {
            static async build(config, message) { await this.buildConfigure(config, message); await this.buildEvaluate(config, message); await this.buildPost(config, message); return config; }
            static async buildConfigure(config) { Hooks.call("daggerheart.postRollConfiguration", config); return {}; }
        }, steps);
        const hookless = Object.assign(class R217Hookless {
            static async build(config, message) { await this.buildConfigure(config, message); await this.buildEvaluate(config, message); await this.buildPost(config, message); return config; }
            static async buildConfigure(config) { for (const hook of config.hooks) Hooks.call(`daggerheart.post${hook}RollConfiguration`, config); return {}; }
        }, steps, { getHooks: () => [] });
        const unbuilt = Object.assign(class R217Unbuilt {
            static async build(config, message) { await this.buildConfigure(config, message); await this.buildEvaluate(config, message); await this.buildPost(config, message); return config; }
            static async buildConfigure(config) { for (const hook of config.hooks) Hooks.call(`daggerheart.post${hook}RollConfiguration`, config); return {}; }
        }, steps, { fromData: undefined });
        const verdicts = [reviewed, reordered, untemplated, hookless, unbuilt].map(cls => reviewBuild(cls));
        equal(JSON.stringify(verdicts.map(v => v.ok)), JSON.stringify([true, false, false, false, false]),
            "a build that differs from the reviewed one is wrapped, or the reviewed shape is refused (as read; order, template, hooks, fromData)");
        equal(new Set(verdicts.slice(1).map(v => v.why)).size, 4, "two different departures were refused with one reason");
        equal(JSON.stringify([seamFor(live), seamFor(reviewed), seamFor(reordered)]),
            JSON.stringify([{ state: "ok", why: "" }, { state: "ok", why: "" }, { state: "changed", why: verdicts[1].why }]),
            "the seam would be put on a build that is not the reviewed one, or left off the reviewed one (this world's, the reviewed fake, the reordered fake)");
    }],

    ["R219 - what one client must decide is decided on the primary GM: another GM asks it, as a player does", async () => {
        /*
         * E08+E28 fix r2-H7, 05.10.2026; the round-2 review's S2-7 and m5. A request's `local`
         * ran on whichever GM asked, so an assistant GM's Reroll was made on its own client while
         * a player's was made on the primary (two Rerolls of one character could each pass the
         * GMs' journal and both pay), and Grant all was decided on the GM who clicked (two GMs
         * each granted the rolls). A request `onPrimary` is done on the primary alone; another GM
         * sends it to the GMs as a player does. The harness has one GM, so the race is not driven:
         * the waiter is (`createWaiter`, with fakes, as R165 drives it), and the two requests
         * that must carry the option are read in their source, and the card's click in its own.
         * Red before the fix: the assistant GM ran `local` and sent nothing, and neither request
         * named `onPrimary`.
         *
         * E09 fix r1-G3 (08.10.2026; the round-1 goal review's G3a): the Key fee. A trial opens
         * on whichever GM moved the phase (clock.mjs `reconcilePhase`), and the fee counts by the
         * GMs' marks, which are the primary's: the opening asks the charge of the primary
         * (investigation.mjs `askToChargeForUnfoundKeys`). Red before the fix: no such request,
         * and the phase change charged on its own GM (scenario 62's phase P drives it on gm2).
         */
        const { createWaiter } = await import("./bridge-guards.mjs");
        const run = async who => {
            const sent = [], ran = [];
            const waiter = createWaiter({
                emit: packet => sent.push(packet.action), gmIds: () => ["R219PRIMARY00001", "R219ASSISTANT001"],
                me: () => who, notify: () => {}, fromGm: () => true, report: () => {}
            });
            const out = await Promise.all(["r219.primary", "r219.anyGm"].map((action, i) => waiter.request(action, {},
                { settle: "reply", ackMs: 30, timeoutMs: 60, quiet: true, local: () => (ran.push(action), "here"), onPrimary: i === 0 })));
            return [ran, sent, out.map(o => o.ok ? o.value : o.reason)];
        };
        const assistant = await run({ id: "R219ASSISTANT001", isGM: true, isPrimary: false });
        const primary = await run({ id: "R219PRIMARY00001", isGM: true, isPrimary: true });
        equal(JSON.stringify([assistant, primary]), JSON.stringify([
            [["r219.anyGm"], ["r219.primary"], ["noAnswer", "here"]],
            [["r219.primary", "r219.anyGm"], [], ["here", "here"]]
        ]), "a request only the primary may decide was done on another GM, or not sent to the primary (each: run here, sent, answers)");
        const sources = new Map(await otherSources());
        const named = [["gm-bridge.mjs", "requestReroll"], ["roll-draw.mjs", "askToDecide"]]
            .filter(([file, fn]) => !/\bonPrimary:\s*true\b/.test(fnSource(stripComments(sources.get(file) ?? ""), fn)));
        ok(!named.length, `these are decided on whichever GM asks, not on the primary: ${named.map(([f, fn]) => `${f} ${fn}`).join(", ")}`);
        const feeAsk = topLevelFunction(stripComments(sources.get("investigation.mjs") ?? ""), "askToChargeForUnfoundKeys") ?? "";
        const opening = fnSource(stripComments(sources.get("clock.mjs") ?? ""), "reconcilePhase");
        ok(/\bonPrimary:\s*true\b/.test(feeAsk) && /\baskToChargeForUnfoundKeys\(/.test(opening) && !/\bchargeForUnfoundKeys\(/.test(opening),
            "a trial's opening charges the Key fee on the GM who moved the phase, not on the primary (investigation.mjs askToChargeForUnfoundKeys, clock.mjs reconcilePhase)");
        const click = fnSource(stripComments(sources.get("roll-draw.mjs") ?? ""), "onRenderUnwitnessed");
        ok(/\baskToDecide\(/.test(click) && !/\bdecideUnwitnessed\(/.test(click), "the GMs' card's buttons decide on the GM who clicked, not through askToDecide");
    }],

    ["R290 - a GM's job of a student's means reads no maximum off the document but through the readers the census names", async () => {
        /*
         * E29 fix r2-H27, 06.10.2026. A GM's job in a student's audit queue (sheet-audit.mjs `gmMeansWrite`, and
         * `meansWrite`'s GM branch) writes the student's means from the values the GMs hold, and a maximum it reads off
         * the document is a player's write the audit has not put back yet - three fix groups found one each by reading
         * (r2-H24 actions.mjs `refundAction`, r2-H25 roll-draw.mjs `modifyFromHeld`, r2-H27 reroll.mjs `giveBack` and
         * despair-award.mjs `adjustCritHopeTopUp`). H27's census (E29-handoff-fixW.md, its section) read every such job
         * and, one level down, the functions of its file it calls; this holds the census: every `resourceMax(` and every
         * read of `system.resources` off a document - the strings blanked, so a write's key is no read - inside a job's
         * arguments or a top-level function of the same file they call (`topLevelFunction`'s slice, to the next
         * declaration), is one the list below names with the census's reason, and every row of the list is still read
         * (a row the source no longer holds would be the list rotting). An arrow helper (`const f = () =>`) is not
         * followed; the census reads those by hand.
         */
        const accepted = new Map([
            ["roll-draw.mjs modifyFromHeld", "the document's resources beside the held ones (`before`), to tell what Daggerheart would write (`dhWrites`)"],
            ["roll-draw.mjs modifyFromHeld > fromHeld", "the document's value, which Daggerheart's sum starts from, moved to the GMs'"],
            ["roll-draw.mjs modifyFromHeld > heldValues", "the document's maximum only where the GMs hold none (`top`)"]
        ]);
        const blank = text => text.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, m => " ".repeat(m.length));
        const argumentsOf = (src, open) => {
            let depth = 0, quote = null;
            for (let i = open; i < src.length; i++) {
                const c = src[i];
                if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
                if (c === "\"" || c === "'" || c === "`") quote = c;
                else if (c === "(") depth++;
                else if (c === ")" && --depth === 0) return src.slice(open, i + 1);
            }
            return src.slice(open);
        };
        const enclosing = (src, at) => [...src.slice(0, at).matchAll(/^(?:export )?(?:async )?function (\w+)\s*\(/gm)].pop()?.[1] ?? "?";
        const READ = /resourceMax\(|\bsystem\??\.resources\b/;
        const found = [], seen = new Set();
        for (const [file, raw] of await otherSources()) {
            if (file === "sheet-audit.mjs") continue;
            const src = stripComments(raw);
            for (const call of src.matchAll(/\b(?:gmMeansWrite|meansWrite)\(/g)) {
                const job = argumentsOf(src, call.index + call[0].length - 1), fn = enclosing(src, call.index);
                const callees = [...new Set([...blank(job).matchAll(/\b([a-zA-Z_]\w*)\(/g)].map(m => m[1]))]
                    .filter(name => name !== fn && topLevelFunction(src, name) !== null);
                for (const [where, body] of [[`${file} ${fn}`, job], ...callees.map(name => [`${file} ${fn} > ${name}`, topLevelFunction(src, name)])]) {
                    if (!READ.test(blank(body))) continue;
                    seen.add(where);
                    if (!accepted.has(where)) found.push(where);
                }
            }
        }
        ok(!found.length, `a GM's job of a student's means reads a maximum or the resources off the document through a reader the census does not name: ${found.join("; ")}`);
        const rotten = [...accepted.keys()].filter(where => !seen.has(where));
        ok(!rotten.length, `the census names a reader the source no longer holds: ${rotten.join("; ")}`);
    }],

    ["R303 - with no GM an action roll is refused before its price, a reaction is thrown stamped and moves nothing, and a draw ends at its own 30 s clock", async () => {
        /*
         * E33 fix r2-G5, 07.10.2026; the stage's verify ledger (doneWhen 2, "the E28 offline path has a test"), E33
         * plan 1.7 item 7 and the owner's Q2/Q3 (a) of 03.10. The offline path had scenario 15-held's A1-A5 and G1-G4
         * and two tier-2 tests, and no fast guard. Three promises, each read where the module keeps it:
         *   1. an action's roll with no GM connected is refused at the action's start, before anything is awaited -
         *      no window, no price (action-rolls.mjs `performAction`; only Move, Rest and Direct Murder, which throw
         *      no dice or ask the GM themselves, pass it) - and a GM gone between the window and the draw has the
         *      roll refused at the draw, not thrown here (roll-draw.mjs `drawOrThrow`, the second road to the same
         *      roll);
         *   2. any other roll thrown with no GM is stamped and moves nothing: a student's statistic is made a
         *      reaction, Daggerheart's resource step is skipped and the stamp rides to the message
         *      (`throwUnwitnessed`, `stampUnwitnessed`), its card says so (`onRenderUnwitnessed`), and the GMs' card
         *      and Grant all move nothing for a reaction - no Hope, no Despair (`awayMoves`, `grantRolls`; 15's G3
         *      throws Hope over Fear, so the Despair's reaction guard is read here and driven nowhere);
         *   3. a draw whose GM is gone or silent ends at the draw's own clock, 30 s, as a closed window: nothing
         *      played (`drawAndPlay`). The wait itself is driven: R165's `createWaiter` with fakes and a clock that
         *      only records, asked as drawAndPlay asks.
         * Parts 1 and 2 can be driven only from a player's browser with no GM, which this suite is not, so they are
         * read in the source; every reading is a match that fails when its text is gone, never an absence that
         * passes on an empty cut. There is no Cancel button and no queue on this path, and nothing here asks for one.
         * Not this test: R6 (every bridge request is refused with `noGm` before it sends), R46 (Analyze asks
         * `gmOnline()` before `payPrice()`), the tier-2 test of the draw's clock and 15's checks, which play it.
         */
        const sources = new Map(await otherSources());
        const rolls = stripComments(sources.get("action-rolls.mjs") ?? ""), draw = stripComments(sources.get("roll-draw.mjs") ?? "");
        must(rolls.length > 1000 && draw.length > 1000, "action-rolls.mjs or roll-draw.mjs did not load");

        // 1. Refused at the start: the refusal is in performAction before its first await, and only the three pass it.
        const perform = fnSource(rolls, "performAction");
        const refusal = perform.search(/if \(!game\.user\.isGM && !activeGmIds\(\)\.length && !THROWS_NO_DICE\.has\(actionKey\)\) \{\s*ui\.notifications\.warn\(game\.i18n\.localize\("DRPG\.Rolls\.waitsForGm"\)\);\s*return null;\s*\}/);
        const firstAwait = perform.search(/\bawait\b/);
        const passes = (/\bconst THROWS_NO_DICE = new Set\(\[([^\]]*)\]\);/.exec(rolls)?.[1] ?? "").match(/"\w+"/g)?.map(s => s.slice(1, -1)).sort() ?? [];
        const throwOrRefuse = fnSource(draw, "drawOrThrow");
        const atDraw = /^\s*if \(awayFromGms\(config\)\) \{\s*if \(config\[DRPG_ACTION_ROLL\] === true\) return void ui\.notifications\?\.warn\(game\.i18n\.localize\("DRPG\.Rolls\.waitsForGm"\)\);\s*return throwUnwitnessed\(cls, original, config, message\);\s*\}/m.test(throwOrRefuse);
        const away = /if \(game\.user\?\.isGM \|\| primaryGmId\(\)\) return false;/.test(fnSource(draw, "awayFromGms"));
        equal(JSON.stringify([refusal > 0, firstAwait > refusal, passes, atDraw, away]),
            JSON.stringify([true, true, ["directMurder", "move", "rest"], true, true]),
            "with no GM an action is not refused at its start before anything is awaited, passes for more than Move, Rest and Direct Murder, or its roll is thrown at the draw (each: refusal found, before the first await, the actions that pass, refused at the draw, a player's roll with no primary GM is away)");

        // 2. Stamped and moving nothing: the statistic a reaction, the resource step skipped, the stamp to the message;
        // the card says so; the GMs' card and Grant all move nothing for a reaction.
        const thrown = fnSource(draw, "throwUnwitnessed");
        const before = text => { const at = thrown.indexOf(text); return at > 0 && at < thrown.indexOf("original.call(cls, config, message)"); };
        const stamped = [
            "if (sheet && !isMonokuma(sheet)) config.actionType = \"reaction\";",
            "config.skips = { ...(config.skips ?? {}), resources: true };",
            "config[UNWITNESSED] = stamp.nonce;",
            "pendingStamps.set(stamp.nonce, stamp);"
        ].map(before);
        const written = /message\.updateSource\(\{ \[`flags\.\$\{MODULE_ID\}\.\$\{UNWITNESSED_FLAG\}`\]: \{ \.\.\.stamp \} \}\)/.test(fnSource(draw, "stampUnwitnessed"))
            && /Hooks\.on\("preCreateChatMessage", stampUnwitnessed\)/.test(fnSource(draw, "registerUnwitnessedRolls"));
        const card = /if \(message\.getFlag\?\.\(MODULE_ID, UNWITNESSED_FLAG\) && [^\n]*\) \{\s*body\.insertAdjacentHTML\([^\n]*game\.i18n\.localize\("DRPG\.Rolls\.unwitnessed"\)/.test(fnSource(draw, "onRenderUnwitnessed"));
        const reaction = /\breaction: dice\?\.options\?\.actionType === "reaction"/.test(fnSource(draw, "awayRowOf"));
        const tells = /\)\s*\{\s*if \(reaction\) return game\.i18n\.localize\("DRPG\.Rolls\.awayNothing"\);/.test(fnSource(draw, "awayMoves"));
        const grant = fnSource(draw, "grantRolls");
        const skips = grant.indexOf("if (reaction) continue;"), resources = grant.indexOf("addDualityResourceUpdates(");
        const granted = [skips > 0 && resources > skips, /if \(!reaction && outcome\.withFear\) await awardRollDespair\(/.test(grant)];
        equal(JSON.stringify([stamped, written, card, reaction, tells, granted]),
            JSON.stringify([[true, true, true, true], true, true, true, true, [true, true]]),
            "a roll thrown with no GM is not a reaction, moves resources, is not stamped, its card does not say so, or the GMs' card or Grant all move something for a reaction (each: statistic a reaction, resources skipped, stamp on the roll, stamp kept; the stamp written as the message is created; the card's line; the row's reaction; nothing told; Grant all skips its resources, its Despair)");

        // 3. The draw's own clock: 30 s, asked with it, nothing played without an answer; and the wait driven.
        const clockMs = Number((/\bconst DRAW_ANSWER_MS = ([\d_]+);/.exec(draw)?.[1] ?? "").replaceAll("_", ""));
        const play = fnSource(draw, "drawAndPlay");
        const closes = play.search(/if \(!answer\?\.ok \|\| typeof answer\.value\?\.messageId !== "string"\) return;/);
        const asks = /bridgeRequest\("roll\.draw", [^;]*\{ settle: "reply", timeoutMs: DRAW_ANSWER_MS \}\)/.test(play);
        const { createWaiter } = await import("./bridge-guards.mjs");
        const waitFor = gms => {
            const sent = [], said = [], timers = [];
            const waiter = createWaiter({
                emit: (packet, to) => sent.push({ packet, to }),
                gmIds: () => gms,
                me: () => ({ id: "R303ME", isGM: false, isPrimary: false }),
                notify: (action, reason) => said.push(`${action} ${reason}`),
                fromGm: id => id === "R303GM",
                clock: { set: (run, ms) => timers.push({ run, ms, live: true }) - 1, clear: i => { if (timers[i]) timers[i].live = false; } },
                report: () => null
            });
            // Read off `then`, never awaited: a wait whose clock is not the one fired below would hang the suite, not fail.
            const run = { waiter, sent, said, timers, answer: null };
            waiter.request("roll.draw", { actorId: "R303ACTOR" }, { settle: "reply", timeoutMs: clockMs }).then(answer => { run.answer = answer; });
            return run;
        };
        const gone = waitFor([]);
        await wait(0);
        const silent = waitFor(["R303GM"]);
        silent.waiter.onReply({ action: "bridge.ack", userId: "R303ME", requestId: silent.sent[0]?.packet.requestId }, "R303GM");
        await wait(0);
        const running = silent.timers.filter(t => t.live);
        const clock = [running.map(t => t.ms), silent.answer];
        for (const timer of running) timer.run();
        await wait(0);
        equal(JSON.stringify([clockMs, asks, closes > 0 && closes < play.indexOf("playBack("),
            [gone.answer, gone.sent.length, gone.said], [clock, silent.answer, silent.sent.length, silent.said]]),
            JSON.stringify([30000, true, true,
                [{ ok: false, reason: "noGm" }, 0, ["roll.draw noGm"]], [[[30000], null], { ok: false, reason: "noAnswer" }, 1, ["roll.draw noAnswer"]]]),
            "a drawn roll's wait is not the draw's own 30 s, is not asked with it, plays an unanswered draw, or a gone or silent GM does not end it once as noGm or noAnswer at that clock (each: the clock, asked with it, returns before playBack; gone: answer, sent, said; silent: the clock still running after the got-it and the answer before it fires, the answer, sent, said)");
    }],

    ["R307 - the Tamper, Analyze and Observe words say what the rules do, in English and in Polish", async () => {
        /*
         * E09 C14, 08.10.2026; audit S13-15, S13-18, S05-31, S05-33, S05-35, S02-10, decision D14. Words the
         * rules had moved away from: Analyze's briefing printed a Daily Life ladder `analyzeDc` never scores
         * against; Polish Tamper spoke of a trace "left by you" when it reaches any trace you know of; the
         * Polish Cleanup prompts charged an action the rule no longer takes and the Polish frame hint said a
         * trace is planted "either way" when a miss with Despair plants none; the Prep and Resolution kinds
         * named the killer as their author; a missed Observe named a Sanity mark it had not made; a missed
         * Analyze of a Key called it Neutral; a reshape read "a Obvious" and claimed one band quieter whatever
         * band it set. Read from both lang files and config.mjs, every reading a text that must be there or a
         * phrase that must not, each named; then `reshapeCardParts` (pure) for a reshape one band quieter,
         * two, the same and louder; and, read in the source, the New trace dialog's room field and the leftover
         * Keys' sentence counted with `plural`; and (E09 fix r2-G7, review round 2's N4) the chapter-end line
         * on a Faint Final, against `revealPlan`'s order read in the source. Not this test: R1 (twins and plural forms), the four tier-2 tests of
         * E09 C14, which play the cards, and scenario 62 L, which reads a missed Final on a player.
         */
        const wrong = [];
        const flats = {};
        for (const lang of ["en", "pl"]) {
            const text = await fetch(`/modules/${MODULE_ID}/lang/${lang}.json`).then(r => r.json());
            flats[lang] = foundry.utils.flattenObject(foundry.utils.expandObject(text));
        }
        const said = (lang, key) => typeof flats[lang][key] === "string" ? flats[lang][key] : null;
        const both = (key, test, why) => {
            for (const lang of ["en", "pl"]) {
                const words = said(lang, key);
                if (words === null || !test(words)) wrong.push(`${lang} ${key}: ${why}`);
            }
        };
        both("DRPG.Action.dcAnalyze", w => w.includes("{key}") && !w.includes("{daily}"), "still prints the Daily Life ladder");
        for (const [band, row] of Object.entries(ANALYZE_DC)) if ("dailyLife" in row) wrong.push(`ANALYZE_DC.${band} has a dailyLife column`);
        const sources = new Map(await otherSources());
        const config = stripComments(sources.get("config.mjs") ?? ""), investigation = stripComments(sources.get("investigation.mjs") ?? "");
        must(config.length > 1000 && investigation.length > 1000, "config.mjs or investigation.mjs did not load");
        for (const phrase of ["Left by the killer", "a trace you left"]) if (config.includes(phrase)) wrong.push(`config.mjs says "${phrase}"`);
        for (const kind of ["prep", "resolution"]) {
            const words = said("pl", `DRPG.Config.TRUTH_BULLET_TYPES.${kind}.hint`);
            if (words === null || /zabójc/i.test(words)) wrong.push(`pl ${kind}.hint names the killer, or is missing`);
        }
        const tamper = Object.keys(flats.pl).filter(k => k.startsWith("DRPG.Tamper.") || k.startsWith("DRPG.Config.ACTIONS.tamper."));
        must(tamper.length > 10, `pl.json has ${tamper.length} Tamper keys`);
        for (const key of tamper) if (/po tobie|Nie ma takiego śladu|własnym śladem/.test(flats.pl[key])) wrong.push(`pl ${key}: a trace left by you`);
        for (const key of ["DRPG.Cleanup.intro", "DRPG.Cleanup.moveIntro"]) both(key, w => !/\baction|akcj/i.test(w), "charges an action");
        both("DRPG.Tamper.frameHint", w => w.includes("Despair") && !w.includes("tak czy inaczej"), "does not say a miss with Despair plants nothing");
        both("DRPG.Cleanup.reshapeRulingWas", w => /: \{now\}\.$/.test(w), "does not read the new trace after a colon");
        if (/\ba \{(now|band)\}/.test(`${said("en", "DRPG.Cleanup.reshapeRulingWas")} ${said("en", "DRPG.Cleanup.reshaped")}`)) wrong.push("en reshape: an article before a label");
        const forms = { en: ["one", "other"], pl: ["one", "few", "many", "other"] };
        for (const lang of ["en", "pl"]) for (const form of forms[lang]) {
            const words = said(lang, `DRPG.Investigation.leftoverKeys.${form}`);
            if (words === null || words.includes("(s)")) wrong.push(`${lang} leftoverKeys.${form}: missing or "(s)"`);
        }
        both("DRPG.Observe.failed", w => !w.includes("{stress}"), "names Sanity on every miss");
        both("DRPG.Observe.failedStress", w => w.includes("{stress}"), "does not name the mark");
        both("DRPG.Analyze.failedShown", w => w.includes("{name}") && !/Neutral/i.test(w), "calls a Key or a Final Neutral");
        both("DRPG.Analyze.critNothingMore", w => w.length > 0, "missing");
        // Two words the source chooses, read there: the New trace dialog's room field and the leftover Keys' count.
        if (!/<label>\$\{game\.i18n\.localize\("DRPG\.Investigation\.room"\)\}\s*<select name="room">/.test(fnSource(investigation, "openNewTrace")))
            wrong.push("investigation.mjs openNewTrace: the room field is not labelled Room");
        if (!/plural\("DRPG\.Investigation\.leftoverKeys", \{ n: old \}\)/.test(investigation)) wrong.push("investigation.mjs: leftoverKeys is not counted with plural()");
        both("DRPG.Bridge.nothingMore", w => w.length > 0, "missing");
        // E09 fix r2-G7 (review round 2's N4): `revealPlan` decides a Final before it asks whether the sweep spares a
        // Faint, so a Faint Final shows its kind (read in the source), and the chapter-end screen's line says so.
        const plan = fnSource(stripComments(sources.get("chapter.mjs") ?? ""), "revealPlan");
        const finalAt = plan.indexOf('realType === "final"'), faintAt = plan.indexOf("sparedBySweep(");
        if (!(finalAt >= 0 && faintAt > finalAt)) wrong.push("chapter.mjs revealPlan: a Final is not decided before the Faint");
        for (const [lang, phrase] of [["en", "every Final, Faint or not, shows its kind"], ["pl", "każdy Final, Faint czy nie, pokazuje swój rodzaj"]]) {
            if (!said(lang, "DRPG.Chapter.revealKeeps")?.includes(phrase)) wrong.push(`${lang} DRPG.Chapter.revealKeeps: a Faint Final is said not to be revealed`);
        }
        equal(JSON.stringify(wrong), JSON.stringify([]),
            "a Tamper, Analyze, Observe or Cleanup text says what the rules do not (each: the language, the key or the table, what it says)");

        const { reshapeCardParts } = await import("./cleanup.mjs");
        const { REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");
        const quieter = game.i18n.localize("DRPG.Cleanup.reshapeRulingQuieter");
        const data = { visibility: "evident", visibilityLabel: REMNANT_VISIBILITY_LABELS.evident, typeLabel: "Incident Remnant" };
        const lines = ["subtle", "hidden", "evident", "obvious"].map(softer => {
            const { body } = reshapeCardParts(data, { name: "R307", softer });
            const band = foundry.utils.escapeHTML(game.i18n.format("DRPG.Cleanup.reshapeRulingBand", { band: REMNANT_VISIBILITY_LABELS[softer] }));
            return [body.includes(quieter), body.includes(band)];
        });
        equal(JSON.stringify(lines), JSON.stringify([[true, false], [false, true], [false, true], [false, true]]),
            "a reshape's card says one band quieter when it is not, or does not name the band it set (each: the quieter "
            + "sentence, the band named; an Evident trace made Subtle, Hidden, Evident, Obvious)");
    }],

    ["R314 - the count asks the majority of every name it accuses, and fewer names than asked for is no majority", async () => {
        /*
         * E10 C3, 09.10.2026; audit S06-12 (its count half), S06-10; the ledger's guard for the count. Until 1.2.71
         * the majority was asked of the top name alone: on a two-Blackened vote a second name with 2 of 6 ballots
         * was accused beside a first name's 4, and one name for two Blackened passed as the whole answer.
         * `countBallots` (vote.mjs) is the count alone, read on five sets of ballots: one name exactly at the bar
         * (3 of 4); three names level above the bar on a two-name vote (a tie, with a majority); the second name
         * below the bar (A 4, B 2, C and D 1, of 6); one name for two; nobody. Each reading is the counts, then
         * [noMajority, tied, accusedIds, majority]. The same harm on the GMs' store and the card is the tier-2
         * test "a second name short of the majority is accused of nothing ...".
         */
        const { countBallots } = await import("./vote.mjs");
        const read = (lists, wanted, issued) => {
            const count = countBallots(lists.map(choice => ({ choice })), { wanted, issued });
            return [count.counts.map(({ id, n }) => `${id}${n}`).join(" "),
                count.noMajority, count.tied, count.accusedIds, count.majority];
        };
        const readings = [
            read([["A"], ["A"], ["A"], ["B"]], 1, 4),
            read([["A", "B"], ["A", "B"], ["A", "C"], ["A", "C"], ["B", "C"], ["B", "C"]], 2, 6),
            read([["A", "B"], ["A", "B"], ["A", "C"], ["A", "D"]], 2, 6),
            read([["A"], ["A"], ["A"]], 2, 3),
            read([], 1, 3)
        ];
        equal(JSON.stringify(readings), JSON.stringify([
            ["A3 B1", false, false, ["A"], 3],
            ["A4 B4 C4", false, true, [], 4],
            ["A4 B2 C1 D1", true, true, [], 4],
            ["A3", true, true, [], 2],
            ["", true, true, [], 2]
        ]), "the count convicts a name short of the majority, calls a tie among names that carried the room a missing "
            + "majority, takes one name for two, or accuses somebody with nobody's ballot (each: the counts, "
            + "noMajority, tied, the accused, the majority)");
    }],

    ["R357 - the chapter end counts one thing once: a reveal with nothing to reveal is not offered, and the bullets it cannot touch are named by who holds them", async () => {
        /*
         * E11 C13, 11.10.2026; audit S13-06, the ledger's G-c (its C13 half). The audit's End of chapter window
         * offered "Reveal ... (0 still unidentified)" ticked, over "2 Truth Bullets have no real type recorded",
         * while the Investigation dashboard read "NOT ANALYSED 2": three numbers, and the GM could not tell
         * whether pressing Do it would reveal anything, nor where the two were. Read on the window's form
         * (chapter.mjs `chapterEndForm`, from counts this test chooses), twice: nothing to reveal and two bullets
         * with no type, held by two characters; three to reveal and none without a type. Each reading is the
         * reveal box [ticked, disabled], whether the warning names both holders, whether it says the dashboard's
         * own term (`DRPG.Investigation.unidentified`, lower case; the count of 2 picks the Polish form that
         * term is), and whether the box's label carries the count. The world's half - `revealPlan` naming a
         * real holder, and the window counting what the reveal does - is scenario 65's W1.
         */
        const C = await import("./chapter.mjs");
        ok(typeof C.chapterEndForm === "function",
            "chapter.mjs has no chapterEndForm: the End of chapter window's form is not built from its counts");
        const term = game.i18n.localize("DRPG.Investigation.unidentified").toLowerCase();
        const read = counts => {
            const div = document.createElement("div");
            div.innerHTML = C.chapterEndForm({ chapter: 2, session: 7, day: 4, ...counts });
            const input = div.querySelector('input[name="reveal"]');
            const warning = (div.querySelector("[data-drpg-typeless]")?.textContent ?? "").toLowerCase();
            return [input?.checked ?? null, input?.disabled ?? null,
                warning.includes("suite aiko") && warning.includes("suite botan"), warning.includes(term),
                new RegExp(`\\b${counts.hidden}\\b`).test(input?.closest("label")?.textContent ?? "")];
        };
        equal(JSON.stringify([read({ hidden: 0, typeless: 2, holders: ["Suite Aiko", "Suite Botan"] }), read({ hidden: 3 })]),
            JSON.stringify([[false, true, true, true, true], [true, false, false, false, true]]),
            "the End of chapter window offers a reveal with nothing to reveal, or keeps one it has, or its warning "
            + "does not say whose bullets they are or in the dashboard's term (each: the reveal box ticked, disabled, "
            + "both holders named, the term, the count on the box)");
    }],

    ["R358 - the Final Truth tab has one empty state, and its Room field says what picking a room does", async () => {
        /*
         * E11 C13, 11.10.2026; audit S13-08. With nothing placed the tab said "None placed yet.", then told the
         * GM to drop one "with the ordinary Remnant tools", with its own form under it, and then "Leave the room
         * empty to change nothing" over a Room field whose empty option read "-". Read on the tab's markup
         * (investigation.mjs `caseFinalPanel`) with no Final Truth Remnant anywhere and none this chapter: the
         * notes that are neither the tab's intro nor the form's own line (the empty states), and the Room
         * field's empty option, which stays (the form rides the dashboard's one Save; see `caseFinalPanel`) and
         * must say what picking does.
         */
        const I = await import("./investigation.mjs");
        ok(typeof I.caseFinalPanel === "function", "investigation.mjs does not export caseFinalPanel, so it cannot be read");
        const div = document.createElement("div");
        div.innerHTML = I.caseFinalPanel({ roomOptions: `<option value="Suite room">Suite room</option>`, visOptions: "",
            finalRemnants: () => [], finalTruthPlacedThisChapter: () => false });
        const own = ["DRPG.Mastermind.finalRemnantsNote", "DRPG.Mastermind.finalAddNote"].map(key => game.i18n.localize(key));
        const empty = [...div.querySelectorAll("p.notes")].map(p => p.textContent.trim()).filter(text => !own.includes(text));
        const blank = div.querySelector('select[name="finalRoom"] option[value=""]');
        equal(JSON.stringify([empty, (blank?.textContent ?? "").trim()]),
            JSON.stringify([[game.i18n.localize("DRPG.Mastermind.finalTruthReminder")],
                game.i18n.localize("DRPG.Mastermind.finalPickRoom")]),
            "the empty Final Truth tab says more than one thing about being empty, or its Room field's empty option "
            + "does not say what picking a room does (the empty states, then the empty option's words)");
    }],

    ["R378 - the reset window offers no group a Daggerheart character cannot hold, and its actions row promises no betrayal window, in English and in Polish", async () => {
        /*
         * E11 fix r2-H4, 1.2.73; the goal's D3 / S06-49 (a) and (c), the plan's 3.3. The cast's "notes they
         * wrote on their own sheets" cleared `system.notes` and `system.biography.notes`, which a Daggerheart
         * character does not have (character.mjs:80-88 at Daggerheart's tag 2.6.5, the version module.json
         * verifies: `biography` is background, connections and characteristics), so the tick wiped nothing.
         * And the actions row ended "and betrayal window cleared": the offer is the cast's record since
         * CASE-04 and goes with the incident group, so with the incident unticked the row promised what
         * stayed. Read: the groups, the reset's source for the two paths, and both lang files for the two
         * labels and the retired keys.
         */
        const { RESET_GROUPS } = await import("./season-exceptions.mjs");
        const wrong = [];
        if (RESET_GROUPS.some(group => group.key === "sheetNotes")) wrong.push("the window still offers the cast's sheet notes");
        const setup = stripComments(new Map(await otherSources()).get("season-setup.mjs") ?? "");
        if (setup.length < 1000) wrong.push("season-setup.mjs did not load");
        if (/system\.notes|biography\.notes/.test(setup)) wrong.push("the reset still clears a notes field a Daggerheart character does not have");
        const betrayal = { en: /betray/i, pl: /zdrad/i };
        for (const lang of ["en", "pl"]) {
            const text = await fetch(`/modules/${MODULE_ID}/lang/${lang}.json`).then(r => r.json());
            const flat = foundry.utils.flattenObject(foundry.utils.expandObject(text));
            const actions = flat["DRPG.Season.group.actions"], incident = flat["DRPG.Season.group.incident"];
            if (typeof actions !== "string" || betrayal[lang].test(actions)) wrong.push(`${lang} actions: "${actions}" promises the betrayal window`);
            if (typeof incident !== "string" || !betrayal[lang].test(incident)) wrong.push(`${lang} incident: "${incident}" does not name the betrayal offer it clears`);
            for (const key of Object.keys(flat).filter(key => /^DRPG\.Season\.(group\.sheetNotes|resetSheetNotes)/.test(key))) wrong.push(`${lang} ${key} is left`);
        }
        equal(JSON.stringify(wrong), "[]", "the reset window's groups and labels against what the reset clears");
    }],

    ["R380 - a room is a named region a GM marked, with no passage behaviour and not drawn by a player; a room is a name on a scene", async () => {
        /*
         * E12 C1, 11.10.2026; plan-E12 3.1, audit S07-06. Until 1.2.74 every named region was a room, so
         * a Teleport's region, a staircase's level change and a region a player drew were rooms as soon as
         * they had a name. rooms.mjs `isRoom` is the predicate: a name, the room flag set to true, no
         * behaviour of `NOT_ROOM_BEHAVIOURS` (any other behaviour may stand in a room), not in the
         * primary's record of regions a player created. Read on regions of plain objects - an id, a name,
         * flags, a behaviour list - so the answer is the predicate's, not a world's; the record is handed
         * in (`isRoomWith`) where the world's would otherwise be read. Then a room as a name on a scene:
         * its pieces, its names sorted once each, a flag read as OR over its pieces, whether the scene
         * holds a room (and so is a place, `isPlaceScene`; since E13 C1 `roomPieces` finds no room on the
         * linked trial hall, so the hall is none - rooms.mjs `isPlaceScene`), and the named regions no GM
         * has decided - the ones Season setup names and the migration marks. Red before C1 on its
         * first check: the record of a player's regions is not a setting, so nothing could refuse one.
         */
        ok(game.settings.settings.has(`${MODULE_ID}.playerRegions`),
            "no world setting records the regions a player created - a region a player drew and named would be a room");
        const R = await import("./rooms.mjs").catch(() => null);
        ok(typeof R?.isRoomWith === "function", "there is no rooms.mjs `isRoomWith` - a room is still any region with a name");
        if (typeof R?.isRoomWith !== "function") return;
        const region = (id, name, flags = {}, behaviours = []) => ({ id, name, behaviors: behaviours.map(type => ({ type })),
            getFlag: (scope, key) => (scope === MODULE_ID ? flags[key] : undefined) });
        const drawn = new Set(["drawn"]);
        const CASES = [
            ["marked", region("a", "Gym", { room: true }), true, true],
            ["never decided", region("b", "Gym"), false, true],
            ["unticked", region("c", "Gym", { room: false }), false, true],
            ["a Teleport", region("d", "Lift", { room: true }, ["teleportToken"]), false, false],
            ["a level change", region("e", "Stairs", { room: true }, ["changeLevel"]), false, false],
            ["another behaviour", region("f", "Hall", { room: true }, ["executeScript"]), true, true],
            ["no name", region("g", "", { room: true }), false, false],
            ["a player's", region("drawn", "Den", { room: true }), false, false]];
        equal(JSON.stringify(CASES.map(([what, r]) => [what, R.isRoomWith(r, drawn), R.canBeRoom(r, drawn)])),
            JSON.stringify(CASES.map(([what, , room, may]) => [what, room, may])),
            "a region is a room when, and only when, it has a name, a GM's mark, no passage behaviour and no player for its author ([case, is a room, may be one])");
        equal(R.ROOM_FLAG, "room", "the room flag's key moved - every world marked by the migration carries `room`");

        const scene = { regions: [
            region("k1", "Kitchen", { room: true }), region("k2", "Kitchen", { room: true, drpgLocked: true }), region("k3", "Kitchen"),
            region("b1", "Bath", { room: true }), region("a1", "Attic", { room: false }), region("l1", "Lift", { room: true }, ["teleportToken"]),
            region("n1", "", { room: true }), region("s1", "Shed", {}, ["executeScript"])] };
        const bare = { regions: [region("x", "Hall", { room: false }), region("y", "Yard")] };
        equal(JSON.stringify([R.roomNames(scene), R.roomRegions(scene, "Kitchen").map(r => r.id), R.roomFlag(scene, "Kitchen", "drpgLocked"),
            R.roomFlag(scene, "Bath", "drpgLocked"), R.roomRegions(scene, "Lift").length, R.unmarkedRegions(scene).map(r => r.id),
            R.sceneHoldsRooms(scene), R.isPlaceScene(scene), R.sceneHoldsRooms(bare), R.isPlaceScene(bare), R.namedRegions(scene, "Kitchen").length]),
        JSON.stringify([["Bath", "Kitchen"], ["k1", "k2"], true, null, 0, ["k3"], true, true, false, false, 3]),
        "a room as a name on a scene: [its names, the Kitchen's pieces, the Kitchen's lock as OR over them, the Bath's, the Lift's pieces, "
            + "the regions no GM decided, the scene holds a room, is a place, a scene of no marked room holds one, is a place, the Kitchen's named regions]");
    }],

    ["R384 - a room is read on the token's floor, and the hit test's fallback names no room on another floor or outside a shape it can ask", async () => {
        /*
         * E12 C9, 11.10.2026; plan-E12 3.2, audit S07-45 and S07-22. Until 1.2.74 a footprint was a room
         * on every floor: `roomOfToken` took Foundry's `token.regions` first (whether v14's keeps to the
         * token's floor was not read) and `roomAt` asked every room piece of the scene, so a token on the ground floor under
         * the Attic stood in the Attic. And when `testPoint` rejected a point everywhere, the fallback
         * took the box of any piece on the scene - the room above, or the corner an L-shaped room does not
         * cover. Read on a scene of plain objects, so the answer is the reader's and not a world's: an
         * Attic on the upper floor whose `testPoint` says yes to its footprint whatever the floor (as the
         * harness's regions and a v14 region asked without a level do), a Lab beside it on the ground
         * floor, an Ell on the ground floor whose polygon tree says no where its box says yes, and a
         * Stairwell on every floor; the other three's `testPoint` says no, so the ground floor's reading
         * of the Attic's footprint goes through the fallback. Then the fields that make a move
         * (rooms.mjs `isMoveChange`). Red before C9 on its first check: the Attic's footprint read the
         * Attic on the ground floor, through the token's own list and through `roomAt`, and the Ell
         * read the Ell.
         */
        const M = await import("./movement.mjs");
        const R = await import("./rooms.mjs");
        const L1 = "SUITEFLOORONE000", L2 = "SUITEFLOORTWO000";
        const piece = (name, x, levels, answer, extra = {}) => ({ id: name, name, behaviors: [], levels: new Set(levels),
            bounds: { x, y: 0, width: 400, height: 400 }, testPoint: point => answer && point.x >= x && point.x <= x + 400,
            getFlag: (scope, key) => (scope === MODULE_ID && key === R.ROOM_FLAG ? true : undefined), ...extra });
        const attic = piece("Attic", 0, [L2], true);
        const scene = { grid: { size: 100 }, regions: new Set([attic, piece("Lab", 500, [L1], false),
            piece("Ell", 1000, [L1], false, { polygonTree: { testPoint: () => false } }), piece("Stairwell", 1500, [], false)]) };
        const token = (x, level) => ({ x, y: 100, width: 1, height: 1, elevation: 0, level, parent: scene, regions: new Set([attic]) });
        const room = (x, level) => M.roomAt(x, 100, token(x, level), level);
        const read = [M.roomOfToken(token(100, L1)), M.roomOfToken(token(100, L2)), room(100, L1), room(100, L2), room(600, L1), room(600, L2),
            room(1100, L1), room(1600, L1), room(1600, L2)];
        equal(JSON.stringify(read), JSON.stringify([null, "Attic", null, "Attic", "Lab", null, null, "Stairwell", "Stairwell"]),
            "the room of [a token on the ground floor under the Attic, one on the upper floor; and by `roomAt`: the Attic's footprint on "
                + "the ground floor and the upper, the Lab's on each, the box of the Ell outside its shape, the Stairwell on each floor]");
        const moves = typeof R.isMoveChange === "function"
            ? [{ level: L2 }, { x: 1 }, { elevation: 5 }, { hidden: true }, {}].map(changes => R.isMoveChange(changes)) : "no isMoveChange";
        equal(JSON.stringify(moves), JSON.stringify([true, true, true, false, false]),
            "whether a change of [the level alone, x, the elevation, `hidden`, nothing] is a move");
    }],

    ["R385 - the fog draws the room pieces of the floor it is asked for, a piece on no floor in particular on each, and a scene's floors lowest first", async () => {
        /*
         * E12 C10, 11.10.2026; plan-E12 C10 and 2.3 (V6), audit S07-45, stage-E12 verify "Levels: a
         * scene of two floors, the fog draws only the token's floor". Until 1.2.74 `repaintFog` drew
         * every room piece of the scene on screen whatever the floor, so the Attic's fog lay over the
         * Lab under it. Read on a scene of plain objects, so the answer is the reader's and not a
         * world's: a Lab on the ground floor, an Attic and a Vault on the upper one, a Stairwell on
         * no floor in particular (every floor), and a Closet on the upper floor that is no room. The
         * floor is asked by its id and by the level itself, as `canvas.level` hands it; null is every
         * floor. The floors are listed in the wrong order on purpose: `checkRegions` walks them
         * through rooms.mjs `floorsOf`, lowest first (the owner's item 5). Red before C10: there was
         * no `fogRegionsFor` to ask, and `repaintFog` drew `roomPieces(scene)`.
         */
        const F = await import("./fog.mjs");
        const R = await import("./rooms.mjs");
        const L1 = "SUITEFLOORONE000", L2 = "SUITEFLOORTWO000";
        const piece = (name, levels, room = true) => ({ id: `${name}Id`, name, behaviors: [], levels: new Set(levels),
            getFlag: (scope, key) => (scope === MODULE_ID && key === R.ROOM_FLAG ? room : undefined) });
        const upper = { id: L2, name: "Upper", elevation: 10 }, ground = { id: L1, name: "Ground", elevation: 0 };
        const scene = { levels: [upper, ground], regions: new Set([piece("Lab", [L1]), piece("Attic", [L2]), piece("Vault", [L2]),
            piece("Stairwell", []), piece("Closet", [L2], false)]) };
        const drawn = level => (typeof F.fogRegionsFor === "function" ? F.fogRegionsFor(scene, level).map(r => r.id).sort() : "no fogRegionsFor");
        equal(JSON.stringify([drawn(L2), drawn(upper), drawn(L1), drawn(null)]),
            JSON.stringify([["AtticId", "StairwellId", "VaultId"], ["AtticId", "StairwellId", "VaultId"], ["LabId", "StairwellId"],
                ["AtticId", "LabId", "StairwellId", "VaultId"]]),
            "the room pieces drawn on [the upper floor by id, by the level, the ground floor, every floor]");
        equal(JSON.stringify(typeof R.floorsOf === "function" ? R.floorsOf(scene).map(level => level.name) : "no floorsOf"),
            JSON.stringify(["Ground", "Upper"]), "the scene's floors, lowest first");
    }],

    ["R386 - a player is shown a door control only on a room the fog leaves clear or veiled, asked on both sides of the door", async () => {
        /*
         * E12 C13, 11.10.2026; plan-E12 C13, audit S07-04. The room fog switches token vision off,
         * and with it off Foundry's door control answers "shown" at once (the audit's reading of
         * Foundry's door-control.mjs; LIVE-E12-05), so a player saw the icon of every door on the
         * map - those of wings never visited included. Read on plain objects, so the answer is the
         * rule's and not a canvas's: four square rooms in a row and one under the third - the Hall
         * clear (a token of the viewer stands in it), the Library veiled (found), the Gym and the
         * Pool under fog (never visited), each a flat polygon as `regionShapes` hands it - and doors
         * asked on their two sides, a fifth of a square out (`doorSides`). Red before C13: there
         * was no `doorShownTo`, and no class of the module's made the door controls.
         * E12 fix r2-S2 (11.10.2026; review EARLY-C13-1): a Den, clear, drawn 30 px inside the wall
         * of its door - a border the map check takes for the wall's (`DOORWAY_WALL_NEAR`, 0.6 of a
         * square). Asked a fifth of a square out alone, both points fell in the gap and the player
         * standing in the Den was shown none of its doors (red at 19abd42 on the Den's door and on
         * the points); each side is asked at both depths now.
         */
        const F = await import("./fog.mjs");
        const square = (x, y) => [[x, y, x + 100, y, x + 100, y + 100, x, y + 100]];
        const rooms = [{ shading: "clear", polygons: square(0, 0) }, { shading: "veil", polygons: square(100, 0) },
            { shading: "fog", polygons: square(200, 0) }, { shading: "fog", polygons: square(200, 100) }, { shading: "clear", polygons: square(430, 0) }];
        const sides = typeof F.doorSides === "function"
            ? [F.doorSides([100, 200, 300, 200], 100), F.doorSides([100, 0, 100, 100], 100), F.doorSides([5, 5, 5, 5], 100)] : "no doorSides";
        equal(JSON.stringify(sides), JSON.stringify([[{ x: 200, y: 218 }, { x: 200, y: 182 }, { x: 200, y: 260 }, { x: 200, y: 140 }],
            [{ x: 82, y: 50 }, { x: 118, y: 50 }, { x: 40, y: 50 }, { x: 160, y: 50 }], [{ x: 5, y: 5 }]]),
            "the points a door is asked on, for [a level wall, an upright one, a wall of no length] on a grid of 100");
        const doors = [[100, 20, 100, 80], [200, 20, 200, 80], [300, 20, 300, 80], [220, 100, 280, 100], [500, 500, 560, 500], [120, 0, 180, 0],
            [400, 20, 400, 80]];
        const shown = typeof F.doorShownTo === "function" && typeof F.doorSides === "function"
            ? doors.map(c => F.doorShownTo(F.doorSides(c, 100), rooms)) : "no doorShownTo";
        equal(JSON.stringify(shown), JSON.stringify([true, true, false, false, false, true, true]),
            "whether a player is shown the door [Hall-Library, Library-Gym, Gym-outside, Gym-Pool, in no room, Library-outside, "
            + "the Den's, 30 px outside the Den]");
        equal(CONFIG.Canvas?.doorControlClass?.name ?? null, "RoomDoorControl", "the class Foundry makes door controls from is the module's");
    }],
    ["R411 - a floor is asked by its id whatever form the caller holds, and floors with v14's elevation come lowest first", async () => {
        /*
         * E12 fix r2-H1, 11.10.2026; early review EARLY-C10-1 and EARLY-C10-4. The rules hand rooms.mjs `onLevel` a
         * token's level (an id) and the fog `canvas.level` (a level), and it handed either on to `includedInLevel`
         * unchanged; the harness's regions answer both, so nothing headless could tell which side v14 would refuse. Here
         * an Attic whose `includedInLevel` answers an id alone, as the stricter reading of v14 would, is asked by its
         * floor's id and by the floor itself - through `onLevel` and through what the fog draws (fog.mjs `fogRegionsFor`).
         * And three floors whose `elevation` is `{bottom, top}`, as the v14 typings give a level, listed out of order,
         * through `floorsOf`. Plain objects: the answer is the readers', not a world's. Red before the fix: the Attic
         * asked by the floor itself was on no floor and not drawn, and the floors kept the order they were listed in.
         */
        const F = await import("./fog.mjs");
        const R = await import("./rooms.mjs");
        const L1 = "SUITEFLOORONE000", L2 = "SUITEFLOORTWO000";
        const upper = { id: L2, name: "Upper", elevation: { bottom: 10, top: 20 } }, ground = { id: L1, name: "Ground", elevation: { bottom: 0, top: 10 } };
        const cellar = { id: "SUITEFLOORCELLAR", name: "Cellar", elevation: { bottom: -10, top: 0 } };
        const attic = { id: "AtticId", name: "Attic", behaviors: [], levels: new Set([L2]), includedInLevel: level => level === L2,
            getFlag: (scope, key) => (scope === MODULE_ID && key === R.ROOM_FLAG ? true : undefined) };
        const scene = { levels: [upper, cellar, ground], regions: new Set([attic]) };
        const drawn = level => F.fogRegionsFor(scene, level).map(region => region.id);
        equal(JSON.stringify([R.onLevel(attic, L2), R.onLevel(attic, upper), R.onLevel(attic, ground), drawn(L2), drawn(upper), drawn(ground)]),
            JSON.stringify([true, true, false, ["AtticId"], ["AtticId"], []]),
            "[whether the Attic is on the upper floor asked by its id, by the floor, on the ground floor; the pieces drawn on each of the three]");
        equal(JSON.stringify(R.floorsOf(scene).map(level => level.name)), JSON.stringify(["Cellar", "Ground", "Upper"]), "the scene's floors, lowest first");
    }],

    ["R114 - nothing on the trial hall is a room or a place: its role is read by name, the leaf finds no room there, and every walk of the scenes asks it", async () => {
        /*
         * E13 C1, 12.10.2026; plan-E13 C1 and 2.3 (V2), audit S07-47, the A5 project's reserved R114. The trial hall was
         * one more scene with regions on it, so a room a GM had drawn and marked there was a room: a student's hall token
         * was a place `locateActor` answered for a packet naming the hall, and scenario 41 b read the courtroom rule
         * refusing a walk across it (12.10.2026). The roles are read here on plain objects first, so the answer is the
         * reader's and not a world's: a field read by its name with a later one (`zones`) beside it, an id that is no
         * string, a scene linked as both, a role naming a scene that is gone. Then, in the source with comments blanked,
         * the shape that keeps the hall nobody's place: `roomPieces` answers none on the hall before it reads a region,
         * `isPlaceScene` is a scene that holds a room, `placesOf` and voice's `sceneRoomWarnings` and `followsVoice` ask
         * before they read a hall token, the arrival judge asks before it reads the room it holds (scenario 41 b1 read that
         * room predating the link, 12.10.2026), and a character's token is taken off a scene's list by its actor only in
         * remnants.mjs `tokenFor` (after `locateActor`) and cleanup.mjs `applyMoveBody` - the victim's token on the scene
         * `locateActor` found the cleaner on, so not `here.tokenDoc`, the cleaner's own, as plan 1.x 9 offered. Since
         * E81 DZ6 (12.10.2026) also by trial-scene.mjs `readTrialCast`, `saveTrialCast` and `castRowsByActor`, which read
         * the hall's cast as the hall's cast - the token a 1.2.74 row was kept under - and never as a place. Two of them
         * call `find?.(`, which this census did not see until then; it reads that form too since. E81 fix r1-D2 adds
         * the stage's three, which ask the same of the hall alone: `stageHall` (who of the cast has no token there),
         * `handPlacedActors` and `castPickerHtml` (whom the module will not make one for and the GMs placed none). The
         * tier-2 "the trial hall is no place ..." reads it on documents. Red before C1: rooms.mjs had no `sceneRole`.
         */
        const R = await import("./rooms.mjs");
        ok(typeof R.sceneRole === "function", "rooms.mjs has no `sceneRole` - no scene can be the trial hall");
        if (typeof R.sceneRole !== "function") return;
        const roles = { school: "R114SCHOOL000000", trial: "R114HALL00000000", zones: { a: "R114ZONEA0000000", b: "R114ZONEB0000000" } };
        const at = id => ({ id });
        equal(JSON.stringify([R.sceneRole(at(roles.school), roles), R.sceneRole(at(roles.trial), roles), R.sceneRole(at(roles.zones.a), roles),
            R.sceneRole(at("R114OTHER0000000"), roles), R.sceneRole(null, roles), R.sceneRole(at(roles.trial), { school: roles.trial, trial: roles.trial }),
            R.sceneRole(at(roles.trial), { trial: [roles.trial] }), R.sceneRole(at(roles.trial), {})]),
            JSON.stringify(["school", "trial", null, null, null, "trial", null, null]),
            "the role of [the school, the hall, a zone's scene, another scene, no scene, a scene linked as both, the hall named in a list, the hall with nothing linked]");
        const some = game.scenes.contents[0] ?? null;
        must(some, "the world has no scene - a linked scene could not be looked up by its id");
        const GONE = "R114NOSUCHSCENE0";
        equal(JSON.stringify([R.schoolScene({ school: GONE }), R.trialScene({ trial: GONE }), R.schoolScene({ school: some.id })?.id ?? null,
            R.trialScene({ trial: some.id, zones: {} })?.id ?? null, R.schoolScene({ school: some.id, trial: some.id })]),
            JSON.stringify([null, null, some.id, some.id, null]),
            "the linked [school whose scene is gone, hall whose scene is gone, school, hall with a later field beside it, school linked as the hall too]");

        const sources = await moduleSources();
        must(["rooms.mjs", "movement.mjs", "voice.mjs"].every(file => sources.get(file)?.length), "rooms.mjs, movement.mjs or voice.mjs is not among the module's sources - this would measure nothing");
        const plain = file => stripComments(sources.get(file));
        const lines = (file, fn) => fnSource(plain(file), fn).split("\n").slice(1).map(line => line.trim()).filter(Boolean);
        const before = (file, fn, first, then) => {
            const body = fnSource(plain(file), fn), a = body.indexOf(first), b = body.indexOf(then);
            return a >= 0 && b > a;
        };
        equal(JSON.stringify([lines("rooms.mjs", "roomPieces")[0], lines("rooms.mjs", "isPlaceScene")[0], lines("rooms.mjs", "sceneHoldsRooms")[0],
            before("movement.mjs", "placesOf", "if (!isPlaceScene(scene)) continue;", "scene?.tokens"),
            before("voice.mjs", "sceneRoomWarnings", "if (isTrialScene(scene)) continue;", "roomPieces(scene)"),
            /!isTrialScene\(tokenDoc\.parent\)/.test(fnSource(plain("voice.mjs"), "followsVoice")),
            before("movement.mjs", "arrivalVerdict", "if (!isPlaceScene(tokenDoc.parent)) return true;", "roomOfToken(tokenDoc)")]),
        JSON.stringify(["if (isTrialScene(scene)) return [];", "return sceneHoldsRooms(scene);", "return roomPieces(scene).length > 0;", true, true, true, true]),
            "[`roomPieces`' first line, `isPlaceScene`'s, `sceneHoldsRooms`'; whether `placesOf` skips a scene that is no place before it reads a token, "
            + "`sceneRoomWarnings` the hall before it reads its rooms, `followsVoice` asks about the hall, and `arrivalVerdict` asks before it reads a room]");

        const TAKEN = /\btokens\??\.(?:find|filter|some)(?:\?\.)?\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.actorId\b/g;
        const DECLARED = /^(?:export )?(?:async )?function (\w+)\(/gm;
        const taken = [];
        for (const [file, raw] of sources) {
            if (file.startsWith("tests")) continue;
            const text = stripComments(raw);
            for (const m of text.matchAll(TAKEN)) taken.push(`${file}#${[...text.slice(0, m.index).matchAll(DECLARED)].at(-1)?.[1] ?? "(top level)"}`);
        }
        equal(JSON.stringify([...new Set(taken)].sort()), JSON.stringify(["cleanup.mjs#applyMoveBody", "remnants.mjs#tokenFor",
            "trial-scene.mjs#castPickerHtml", "trial-scene.mjs#castRowsByActor", "trial-scene.mjs#handPlacedActors", "trial-scene.mjs#readTrialCast",
            "trial-scene.mjs#saveTrialCast", "trial-scene.mjs#stageHall"]),
            "the functions that take a character's token off a scene's list by its actor, outside `locateActor`'s walk of the place scenes");
    }],

    ["R115 - the school linked as the school is home over the active scene and the one on screen, and Room Setup never opens on the hall", async () => {
        /*
         * E13 C1, 12.10.2026; plan-E13 1.x 7 and 2.3 (V3), audit S11-15, the A5 project's reserved R115, restated as
         * plan 1.x 7 says once E12 C6 had made `workingScene` the camera for windows only. `homeScene()` guessed the
         * school - the only scene with rooms, else the active one if it held a room, else the one of most room pieces -
         * so a hall with rooms marked on it and made active for the trial was the school; and Room Setup opened on
         * whatever the GM had on screen, the hall included. Read in the source with comments blanked: `homeScene`
         * answers `schoolScene()` before it guesses, and `openRoomSetupDialog` puts `homeScene()` in place of a trial
         * scene after it reads the camera and before it reads a region. And of the world as it is: home is never the
         * hall, and a linked school is home. The tier-2 "a school linked as the school ..." reads both on documents, the
         * hall on screen; scenario 41 b on four browsers with the hall active and viewed. Red before C1: there was no
         * `schoolScene`.
         */
        const R = await import("./rooms.mjs");
        ok(typeof R.schoolScene === "function", "rooms.mjs has no `schoolScene` - the school is still a guess");
        if (typeof R.schoolScene !== "function") return;
        const sources = await moduleSources();
        must(sources.get("rooms.mjs")?.length && sources.get("vault.mjs")?.length, "rooms.mjs or vault.mjs is not among the module's sources - this would measure nothing");
        const rooms = stripComments(sources.get("rooms.mjs")), vault = stripComments(sources.get("vault.mjs"));
        const home = fnSource(rooms, "homeScene").split("\n").slice(1, 3).map(line => line.trim());
        const open = fnSource(vault, "openRoomSetupDialog");
        const [camera, swap, read] = ["let scene = workingScene();", "if (isTrialScene(scene)) scene = homeScene();", "namedByName(scene)"].map(text => open.indexOf(text));
        equal(JSON.stringify([home, camera >= 0 && camera < swap && swap < read]),
            JSON.stringify([["const school = schoolScene();", "if (school) return school;"], true]),
            "[`homeScene`'s first two lines; whether Room Setup puts home in place of the hall between reading the camera and reading a region]");
        const school = R.homeScene();
        equal(JSON.stringify([R.isTrialScene(school), !R.schoolScene() || school === R.schoolScene()]), JSON.stringify([false, true]),
            `[home (${school?.name ?? "none"}) is the trial hall, home is the linked school when one is linked]`);

        /* And the way back (E13 C3, 12.10.2026; plan-E13 2.3's R115 rows, the owner's answer Q-E13-1 b): leaving the trial
           takes the table to the linked school, else to the scene the trial opened from (`trialReturnTo`), never to the
           hall, and with neither the GMs are told and nothing changes. Asked of plain scenes, and in the source of
           `leaveTrialScene`: it whispers `noSchool` and returns before it activates or clears anything (since E81 DZ6
           the clearing is `stageHall`'s, which deletes the module's tokens; until then `hideTrialTokens`). Red before C3:
           there was no `leaveDestination`. Scenario 41 c, d, e and j read the return on four browsers. */
        const T = await import("./trial-scene.mjs");
        ok(typeof T.leaveDestination === "function", "trial-scene.mjs has no `leaveDestination` - leaving the trial takes the table nowhere");
        if (typeof T.leaveDestination !== "function") return;
        const [linked, from, hall] = [{ id: "school" }, { id: "from" }, { id: "hall" }];
        const to = args => T.leaveDestination(args)?.id ?? null;
        must(sources.get("trial-scene.mjs")?.length, "trial-scene.mjs is not among the module's sources - this would measure nothing");
        const leave = fnSource(stripComments(sources.get("trial-scene.mjs")), "leaveTrialScene");
        const [told, activates, hides] = ['"DRPG.TrialScene.noSchool"', ".activate(", "stageHall("].map(text => leave.indexOf(text));
        const back = told >= 0 ? leave.indexOf("return null;", told) : -1;
        equal(JSON.stringify([to({ school: linked, returnTo: from, hall }), to({ returnTo: from, hall }), to({ school: hall, returnTo: hall, hall }), to({ hall }),
            leave.includes("leaveDestination({ school: schoolScene(), returnTo: trialReturnTo(hall), hall })"), told >= 0 && told < back && back < activates && activates < hides]),
            JSON.stringify(["school", "from", null, null, true, true]),
            "[the way back with a school and a scene the trial opened from, with that scene only, with only the hall named, with nothing; "
            + "leaveTrialScene asks the school and the flag; it tells the GMs and returns before it activates, and activates before it clears the hall]");
    }],
    ["R116 - the trial shows the GMs' choice of the hall's cast and hides it again: only `hidden` changes, and a second run changes nothing", async () => {
        /*
         * E13 C2, 12.10.2026; plan-E13 2.3 and 3.3 (V4), decision D7, the owner's answer Q-E13-1 a, audit S06-57, the A5
         * project's reserved R116 restated under D7. Until 1.2.74 nothing showed anybody in a trial hall: a GM showed the
         * tokens by hand (scenario 41 a). The rule is trial-scene.mjs `castDiff` over the cast as `readCast` hands it,
         * driven here on plain rows, so nothing in this browser is read or written: a student a player plays, a dead one a
         * player plays (Q-E13-1 a: shown, under the dead overlay), Monokuma, a test student nobody plays, a student the
         * GMs unticked (a row of this season), a test student somebody left shown, and a second token of the first
         * student. Read: what the entry changes, what a second entry on its result changes, what the exit changes and a
         * second exit after it, the fields each change carries, the second token, and `defaultReveal` on its own. And of
         * the world, which tokens are the cast: a token of a student is, a token of an actor of another type or of no
         * actor is not. The tier-2 "entering the trial shows the GMs' choice ..." reads it on a hall's documents, and
         * scenario 41 a, c and d through the phase on four browsers. Red before C2: there was no trial-scene.mjs.
         * E81 DZ6 (12.10.2026; the owner chose the cast per actor): the rows are keyed by the token's ACTOR - the
         * unticked student's row is its actor's - and a 1.2.74 row keyed by a token is read for the actor's first
         * token only when its actor has no row (`castRow`'s fallback): a student nobody plays shown by such a row,
         * and the first student's old "hidden" row beaten by its actor's "shown". And `castRow` itself: an actor's
         * row, a token's row asked with and without the token, the actor's row before the token's, and a token's
         * row of another season. Red at 0697d0f: the rows were read by token id, so the unticked student showed.
         */
        const T = await import("./trial-scene.mjs").catch(() => null);
        ok(typeof T?.castDiff === "function", "trial-scene.mjs has no `castDiff` - entering the trial shows nobody in the hall (S06-57)");
        if (typeof T?.castDiff !== "function") return;
        const EPOCH = 7000, HALL = "R116HALL00000000";
        const token = (id, fields = {}) => ({ id, name: id, actorId: `${id}-ACTOR`, hidden: true, monokuma: false, player: false, second: false, ...fields });
        const cast = [token("PLAYED", { player: true }), token("DEAD", { player: true, deceased: true }), token("MONOKUMA", { monokuma: true }),
            token("TEST"), token("UNTICKED", { player: true }), token("LEFTSHOWN", { hidden: false }),
            token("PLAYED2", { actorId: "PLAYED-ACTOR", player: true, second: true }), token("LEGACY")];
        const rows = { [T.castKey(HALL, "UNTICKED-ACTOR")]: { reveal: false, epoch: EPOCH }, [T.castKey(HALL, "PLAYED")]: { reveal: false, epoch: EPOCH },
            [T.castKey(HALL, "PLAYED-ACTOR")]: { reveal: true, epoch: EPOCH }, [T.castKey(HALL, "LEGACY")]: { reveal: true, epoch: EPOCH },
            [T.castKey(HALL, "OLD")]: { reveal: true, epoch: EPOCH - 1 } };
        const after = (list, diff) => list.map(t => ({ ...t, hidden: diff.find(d => d._id === t.id)?.hidden ?? t.hidden }));
        const entry = T.castDiff(cast, { reveal: true, sceneId: HALL, rows, epoch: EPOCH });
        const inside = after(cast, entry.diff);
        const again = T.castDiff(inside, { reveal: true, sceneId: HALL, rows, epoch: EPOCH });
        const exit = T.castDiff(inside, { reveal: false, sceneId: HALL, rows, epoch: EPOCH });
        const out = T.castDiff(after(inside, exit.diff), { reveal: false, sceneId: HALL, rows, epoch: EPOCH });
        const fields = [...entry.diff, ...exit.diff].map(d => Object.keys(d).sort().join(","));
        equal(JSON.stringify([entry, again.diff, exit.diff, out.diff, [...new Set(fields)]]), JSON.stringify([
            { diff: [{ _id: "PLAYED", hidden: false }, { _id: "DEAD", hidden: false }, { _id: "MONOKUMA", hidden: false }, { _id: "LEFTSHOWN", hidden: true },
                { _id: "LEGACY", hidden: false }], seconds: ["PLAYED2"] },
            [], [{ _id: "PLAYED", hidden: true }, { _id: "DEAD", hidden: true }, { _id: "MONOKUMA", hidden: true }, { _id: "LEGACY", hidden: true }], [], ["_id,hidden"]]),
            "[the entry (the student played - its actor's row before its token's -, the dead played and Monokuma shown, the test student left shown hidden, the unticked one by its actor's row, "
            + "the test student and the second token kept hidden, the student nobody plays shown by its token's 1.2.74 row; the second token named), "
            + "a second entry, the exit (the cast hidden), a second exit, the fields a change carries]");
        const legacy = [T.castRow(rows, HALL, "UNTICKED-ACTOR", EPOCH), T.castRow(rows, HALL, "LEGACY-ACTOR", EPOCH, "LEGACY"), T.castRow(rows, HALL, "LEGACY-ACTOR", EPOCH),
            T.castRow(rows, HALL, "PLAYED-ACTOR", EPOCH, "PLAYED"), T.castRow(rows, HALL, "OLD-ACTOR", EPOCH, "OLD")];
        equal(JSON.stringify(legacy), JSON.stringify([{ reveal: false }, { reveal: true }, null, { reveal: true }, null]),
            "[`castRow` of an actor's row, of a token's 1.2.74 row asked with the token and without it, of an actor with both rows, of a token's row of the season before]");
        const rule = [{}, { player: true }, { monokuma: true }, { player: true, second: true }, { monokuma: true, second: true }].map(given => T.defaultReveal(given));
        equal(JSON.stringify(rule), JSON.stringify([false, true, true, false, false]),
            "[`defaultReveal` of a student nobody plays, one a player plays, Monokuma, and a second token of each of the last two]");
        const student = game.actors.find(a => a.type === "character");
        must(student, "the world has no character to stand a hall token for - which tokens are the cast would measure nothing");
        const other = game.actors.find(a => a.type !== "character");
        const kinds = [{ actorId: student.id }, { actorId: null }, { actorId: "R116NOSUCHACTOR0" }, ...(other ? [{ actorId: other.id }] : [])].map(t => T.isCastToken(t));
        equal(JSON.stringify(kinds), JSON.stringify([true, false, false, ...(other ? [false] : [])]),
            `[a token is the cast: of a student, of no actor, of an actor that is gone${other ? `, of ${other.name} (${other.type})` : ""}]`);
    }],

    ["R433 - the cast choice is the GMs' own: kept in a GM store with its season, never on a token or a world setting, and read only in its season", async () => {
        /*
         * E13 C2, 12.10.2026; plan-E13 2.3 (A5's R121, which tools/registry.mjs reserves for A4) and 1.x 2, decisions D7
         * and D12. The audit's fix for S06-57 named a flag on the hall token, and a token's flags are written by whoever
         * owns it - the student's own player. Read in the source with comments blanked: trial-scene.mjs writes no setting and
         * one flag only (E13 C3: `trialReturnTo`, on the hall SCENE, which `enterTrialScene` writes and a GM's client
         * reads - the owner's answer 1b; the count was 0 at C2 and R433 failed at C3 on the 1 until it was said here), and
         * one setting (E13 C5, 12.10.2026: Room Setup's Scenes tab stores the school and hall roles in `sceneRoles`; R433
         * failed on that 1 at C5 until it was named here, and the count of that exact write is the second 1 below, so a
         * second setting write, or the cast going into this one, still moves it),
         * and writes the choice only through `trialCastStore`; `applyTrialCast` waits for the store to open
         * before it reads the cast, so a store that did not open shows nobody (the tier-2 "entering the trial ..." drives
         * that branch). Of the store: its spec (a ledger, cut with the trial floor's group, backed up and synced among the
         * GMs) and its setting, this browser's own storage. Of the rule on plain rows: a row of this season reads, a row of
         * another season and a row with no `reveal` read as no row. Whether the primary drops the past season's rows is
         * the tier-2 test's (`compactGmStores`). Red before C2: there was no trial-scene.mjs.
         * E81 DZ6 (12.10.2026): a row is an actor's. The store's `exists` (which decides when the compaction may
         * drop an old tombstone) answers yes for a scene of this world and a "character" actor, and no for an
         * actor of another type, a scene that is gone and a token's id; `saveTrialCast` skips an id that is not a
         * character's; and the move of the 1.2.74 rows (`tidyTrialHall`) is the second `patchMany` and the
         * second `dropMany` counted below (1 and 1 until then). Red at 0697d0f: `exists` read the scene's tokens.
         * E81 fix r1-D2 (12.10.2026): the stage's record of the module's tokens (`writeSeats`) is the hall's second
         * `setFlag`, counted on its own last - a flag of the hall, not of a token, and no store of the cast choice.
         */
        const T = await import("./trial-scene.mjs").catch(() => null);
        ok(typeof T?.castRow === "function", "trial-scene.mjs has no `castRow` - the GMs' choice is kept nowhere (S06-57, D7)");
        if (typeof T?.castRow !== "function") return;
        const { trialCastStore } = await import("./gm-stores.mjs");
        const sources = await moduleSources();
        must(sources.get("trial-scene.mjs")?.length, "trial-scene.mjs is not among the module's sources - this would measure nothing");
        const code = stripComments(sources.get("trial-scene.mjs"));
        const writes = ["setFlag(", "unsetFlag(", "settings.set(", "trialCastStore.patch(", "trialCastStore.patchMany(", "trialCastStore.dropMany(", "hall.setFlag(MODULE_ID, TRIAL_RETURN_FLAG,", "settings.set(MODULE_ID, SETTINGS.sceneRoles,",
            "hall.setFlag(MODULE_ID, TRIAL_SEATS_FLAG,"]
            .map(text => code.split(text).length - 1);
        const apply = fnSource(code, "applyTrialCast");
        const [waits, reads] = ["await open()", "readCast(scene)"].map(text => apply.indexOf(text));
        const { name, kind, resetGroup, backup, sync, key } = trialCastStore.spec;
        const setting = game.settings.settings.get(`${MODULE_ID}.${key}`);
        const H = "R433HALL00000000", K = T.castKey(H, "TOKEN");
        const at = (row, epoch) => T.castRow({ [K]: row }, H, "TOKEN", epoch);
        const seasons = [at({ reveal: false, epoch: 5 }, 5), at({ reveal: true, epoch: 4 }, 5), at({ reveal: true, epoch: 6 }, 5), at({ epoch: 5 }, 5), at(undefined, 5)];
        const scene = game.scenes?.find?.(s => s.tokens?.size > 0) ?? null, character = game.actors.find(a => a.type === "character");
        must(scene && character, "the world has no scene holding a token, or no character - the store's `exists` would be asked of nothing");
        const other = game.actors.find(a => a.type !== "character");
        const exists = [trialCastStore.spec.exists(T.castKey(scene.id, character.id)), trialCastStore.spec.exists(T.castKey(scene.id, other?.id ?? "R433NOSUCHACTOR")),
            trialCastStore.spec.exists(T.castKey("R433NOSUCHSCENE", character.id)), trialCastStore.spec.exists(T.castKey(scene.id, scene.tokens.contents[0].id)),
            /if \(game\.actors\?\.get\?\.\(actorId\)\?\.type !== "character"\) continue;/.test(fnSource(code, "saveTrialCast"))];
        equal(JSON.stringify(exists), JSON.stringify([true, false, false, false, true]),
            `[the store's \`exists\` of a character in ${scene.name}, of ${other ? `${other.name} (${other.type})` : "an actor that is not there"}, of a scene that is gone, of a token's id; \`saveTrialCast\` skips an id that is not a character's]`);
        equal(JSON.stringify([writes, waits >= 0 && waits < reads, { name, kind, resetGroup, backup, sync, key }, setting?.scope ?? null, seasons]),
            JSON.stringify([[2, 0, 1, 0, 2, 2, 1, 1, 1], true, { name: "trialCast", kind: "ledger", resetGroup: "trialFloor", backup: true, sync: true, key: "gmTrialCast" },
                "client", [{ reveal: false }, null, null, null, null]]),
            "[trial-scene.mjs's setFlag (two, both on the hall scene), unsetFlag, settings.set and store writes (patch, patchMany, dropMany), then the hall's trialReturnTo flag, then the one settings.set that is the roles (sceneRoles), then the hall's trialSeats flag; `applyTrialCast` waits for the store before it reads the cast; "
            + "the store's spec; its setting's scope; a row of this season, of the season before, of a season after, with no `reveal`, and none]");
    }],

    ["R434 - a player's change to whether a hall cast token is hidden is put back; a GM's stands, and so does any token that is not the hall's cast", async () => {
        /*
         * E13 C2, 12.10.2026; plan-E13 2.3 and 3.3 (MARKED, decision D2). A player who owns a hall token may be able to
         * write its `hidden` from their own browser - whether Foundry v14 lets an owner do that is not measured
         * (LIVE-E13-08) - and a token shown or hidden by its player would undo the GMs' choice in front of the table. The
         * rule is trial-scene.mjs `castPutBack`, which the primary's `updateToken` watcher asks with the user Foundry names
         * as the writer; here on plain objects and a student of this world (the cast is a token of a "character"), each
         * token holding what the change left and asked with what the GMs last wrote. Read: a player's hide and a player's
         * show of a hall cast token, the same hide carrying this module's own `trialCast` option (a writer's claim, exempt
         * from nothing), a GM's hide, a player's move, a player's hide of a token of no actor, of a token on another
         * scene, with no hall linked, and by a user nobody knows. Since E13 fix r1-F2 (review r1 sec A) the put-back
         * writes what the GMs last wrote, not the other state: a player's show the token no longer holds (an earlier
         * put-back or their own next write undid it), a hide sent whole (`diff: false`) onto a token already hidden, and
         * a show sent whole onto a token the GMs hid - C2's rule answered the first two with a write against the GMs'
         * choice. The tier-2 "a player's change ..." drives the watcher on a hall's documents; scenario 41 a3 and a4 have
         * players' browsers write it. Red before C2: there was no trial-scene.mjs, and a player's change stood.
         */
        const T = await import("./trial-scene.mjs").catch(() => null);
        ok(typeof T?.castPutBack === "function", "trial-scene.mjs has no `castPutBack` - a player's change to a hall token's hidden stands");
        if (typeof T?.castPutBack !== "function") return;
        const student = game.actors.find(a => a.type === "character");
        must(student, "the world has no character to stand a hall token for - every case below would read a token that is not the cast");
        const hall = { id: "R434HALL00000000" };
        const tok = (fields = {}) => ({ id: "R434TOKEN0000000", name: "R434", actorId: student.id, parent: hall, hidden: true, ...fields });
        const player = { id: "R434PLAYER000000", isGM: false }, gm = { id: "R434GM0000000000", isGM: true };
        const shown = tok({ hidden: false });
        const asks = [
            [tok(), { hidden: true }, {}, player, hall, false], [shown, { hidden: false }, {}, player, hall, true],
            [tok(), { hidden: true }, { [MODULE_ID]: { trialCast: true } }, player, hall, false], [tok(), { hidden: true }, {}, gm, hall, false],
            [tok(), { x: 300 }, {}, player, hall, false], [tok({ actorId: null }), { hidden: true }, {}, player, hall, false],
            [tok({ parent: { id: "R434OTHER0000000" } }), { hidden: true }, {}, player, hall, false], [tok(), { hidden: true }, {}, player, null, false],
            [tok(), { hidden: true }, {}, null, hall, false],
            [shown, { hidden: true }, {}, player, hall, false], [tok(), { hidden: true }, { diff: false }, player, hall, true],
            [shown, { hidden: false }, { diff: false }, player, hall, true]
        ].map(args => T.castPutBack(...args));
        equal(JSON.stringify(asks), JSON.stringify([{ hidden: false }, { hidden: true }, { hidden: false }, null, null, null, null, null, null,
            null, null, { hidden: true }]),
            "[put back: a player's hide, a player's show, a player's hide with the module's option; stands: a GM's hide, a player's move, "
            + "a token of no actor, a token of another scene, no hall linked, a writer nobody knows; since r1-F2, nothing written for a hide the token no "
            + "longer holds or one sent whole onto a token the GMs hid, and a show sent whole put back]");
    }],
    ["R435 - a player's browser puts its own view right once after a load: the hall in the trial, the school after it, never a GM's", async () => {
        /*
         * E13 C3, 12.10.2026; plan-E13 3.4, the owner's answer Q-E13-1 c (players only, once per load), LIVE-E13-02. When
         * the trial opens the hall is activated and Foundry moves every connected browser there; a browser still loading
         * then only warns and stays (A5's reading of Foundry, not read in v14) - scenario 41 f read p4 left on the school
         * after its first draw (12.10.2026, C2's tree). trial-scene.mjs `viewRepair` names the scene a browser switches to
         * on its first `canvasReady`, asked here of plain scenes: a player in the trial viewing the school while the hall
         * is active goes to the hall; after the trial, viewing the hall while the school is active, to the school; a
         * player already where the GM made active, a GM, a trial whose active scene is not the hall (the GM took the
         * table elsewhere), and no hall linked, nowhere. Since E13 fix r1-F2 (review r1 cor B) after the trial the scene a
         * GM made active, whichever it is: the scene of the room End the trial chose, and with no school linked the scene
         * the trial opened from - C3 asked for the school alone, and both left a late browser in the hall. And in the
         * source with comments blanked: `registerTrialScene`
         * listens to `canvasReady` once (a GM's later pull stands) and through `selfRepair`. Scenario 41 f reads it on a
         * late browser, the pull included. Red before C3: there was no `viewRepair`.
         */
        const T = await import("./trial-scene.mjs");
        ok(typeof T.viewRepair === "function", "trial-scene.mjs has no `viewRepair` - a browser that missed the activation stays where it was");
        if (typeof T.viewRepair !== "function") return;
        const [hall, school, chosen] = [{ id: "hall" }, { id: "school" }, { id: "chosen" }];
        const goes = args => T.viewRepair({ hall, school, ...args })?.id ?? null;
        const trial = "classTrial", daily = "dailyLife";
        const sources = await moduleSources();
        must(sources.get("trial-scene.mjs")?.length, "trial-scene.mjs is not among the module's sources - this would measure nothing");
        const register = fnSource(stripComments(sources.get("trial-scene.mjs")), "registerTrialScene");
        equal(JSON.stringify([
            goes({ phase: trial, active: hall, viewed: school }), goes({ phase: daily, active: school, viewed: hall }),
            goes({ phase: trial, active: hall, viewed: hall }), goes({ phase: daily, active: hall, viewed: hall }),
            goes({ phase: trial, active: school, viewed: school }), goes({ phase: trial, active: hall, viewed: school, isGM: true }),
            goes({ phase: daily, active: school, viewed: hall, isGM: true }), T.viewRepair({ phase: trial, active: hall, viewed: school, school }),
            register.includes('Hooks.once("canvasReady", selfRepair)'), /Hooks\.on\(\s*["']canvasReady["']/.test(register),
            goes({ phase: daily, active: chosen, viewed: hall }), T.viewRepair({ phase: daily, active: chosen, viewed: hall, hall })?.id ?? null,
            goes({ phase: daily, active: chosen, viewed: chosen })]),
            JSON.stringify(["hall", "school", null, null, null, null, null, null, true, false, "chosen", "chosen", null]),
            "[a player in the trial off the hall, after it on the hall; a player already where the GM put the table (twice), in a trial the GM took "
            + "elsewhere; a GM (twice); no hall linked; registerTrialScene listens to canvasReady once through selfRepair, and never on every one; "
            + "since r1-F2, after the trial on the hall with the chosen room's scene active, the same with no school linked, and already there]");
    }],
    ["R117 - in the Class Trial everybody is in one voice room: the living, the dead, a Monocub, Monokuma and an account with no character (D8)", async () => {
        /*
         * E13 C4, 12.10.2026; S11-10, the owner's decision D8 (option 1: one room in the trial, also without linked
         * scenes), plan-E13 2.3. Before C4 the trial ran in room voice: each living student followed the school room their
         * token was left in, a Monocub and Monokuma likewise, the dead went to the main room, and an account with no
         * character was not moved at all - so the trial's speakers sat in several breakouts. voice.mjs `voiceClaim` is the
         * per-person decision `voiceTargets` asks, here asked of plain people standing in a school: in the trial all six
         * get the main room (target null) with one claim of their own, and neither where anybody stands nor who is dead
         * is asked - so no token, and no linked school or hall, can change the answer. Outside the trial the same six keep
         * the answers they had (the two living and the Monocub their rooms, Monokuma the Hall, the dead the main room).
         * In the source with comments blanked: `voiceTargets` reads the trial from the clock and asks the accounts with
         * no character only in an Eclipse or the trial, and a browser that asks for its own room (`targetForUser`, the
         * answer to a client that connects mid-trial) is answered from that one decision, not from its token. Scenario 41 h reads it on four browsers in a real trial, and the
         * tier-2 test "the Class Trial takes every connected voice ..." on this world. Red before C4: no `voiceClaim`.
         */
        const V = await import("./voice.mjs");
        ok(typeof V.voiceClaim === "function", "voice.mjs has no `voiceClaim` - the trial's voice rule is not one anybody can ask");
        if (typeof V.voiceClaim !== "function") return;
        const school = { id: "R117SCHOOL000000", name: "R117 School" };
        const account = (id, isGM = false) => ({ id, name: id, active: true, isGM });
        let asked = 0;
        const standing = room => () => { asked++; return room ? { scene: school, room } : null; };
        const dead = value => () => { asked++; return value; };
        const people = [
            { user: account("R117PLAYERA00000"), silenced: dead(false), locate: standing("Dorm A") },
            { user: account("R117PLAYERB00000"), silenced: dead(false), locate: standing("Cafeteria") },
            { user: account("R117PLAYERC00000"), silenced: dead(true), locate: standing("Dorm B") },
            { user: account("R117PLAYERD00000"), silenced: dead(false), locate: standing("Dorm B") },
            { user: account("R117GM0000000000", true), monokuma: true, locate: standing("Hall") },
            { user: account("R117SPECTATOR000") }
        ];
        const inTrial = people.map(p => V.voiceClaim({ ...p, trial: true }));
        const askedInTrial = asked;
        const outside = people.map(p => V.voiceClaim({ ...p, trial: false }));
        const sources = await moduleSources();
        must(sources.get("voice.mjs")?.length, "voice.mjs is not among the module's sources - this would measure nothing");
        const voice = stripComments(sources.get("voice.mjs"));
        const decide = fnSource(voice, "voiceTargets"), answer = fnSource(voice, "targetForUser");
        equal(JSON.stringify([
            inTrial.map(r => r.target), new Set(inTrial.map(r => r.claim)).size, inTrial.some(r => outside.some(o => o.claim === r.claim)),
            inTrial.every(r => r.why === game.i18n.localize("DRPG.Voice.claimTrial")), askedInTrial,
            outside.map(r => r.target),
            /const trial = getClock\(\)\.phase === "classTrial"/.test(decide), /if \(eclipse \|\| trial\)/.test(decide),
            /return byUser\.get\(userId\)\?\.target \?\? null;/.test(answer) && !/locateActor/.test(answer)]),
            JSON.stringify([
                [null, null, null, null, null, null], 1, false, true, 0,
                [V.liveKitRoomFor(school.id, "Dorm A"), V.liveKitRoomFor(school.id, "Cafeteria"), null,
                    V.liveKitRoomFor(school.id, "Dorm B"), V.liveKitRoomFor(school.id, "Hall"), null],
                true, true, true]),
            "[in the trial: the targets of two living students in two rooms, a dead student, a Monocub, Monokuma, an account with no "
            + "character; one claim for all, a claim of the trial's own; the trial's reason; nobody's place or death asked; outside the "
            + "trial the same six; voiceTargets reads the trial from the clock and places accounts with no character only in an Eclipse or the trial; "
            + "a browser's own question is answered from voiceTargets, not from its token]");
    }],

    ["R120 - the Scenes tab: one scene cannot hold both roles, the hall's rooms and the cast nobody places are named, and an Apply that changed nothing writes nothing", async () => {
        /*
         * E13 C5, 12.10.2026; plan-E13 2.3 (V6, R120), doneWhen 3, amend 28.09, the owner's answers Q-E13-1 d and e
         * (09.10), the A5 project's reserved R120. Until C5 no window linked the school and the hall or kept the
         * cast's choice: a GM typed the setting into a console (scenario 41 a did, and the suite), and nothing said
         * that the hall was the school's map, that a student had no token there, or that both roles named one
         * scene. Asked of plain objects, so it reads no document and writes nothing (tier 1): Room Setup's tabs and
         * the tab it opens on; `hallRoomNames` of a hall holding a region marked as a room, one marked "not a room"
         * and an unmarked zone (amend 28.09: only the first is named); `sceneReport`'s rows for one scene in both
         * roles, for a hall with a room, a second token of one actor, an unlinked token and one or two of the cast
         * the module makes no token for with none there (`handPlaced`, E81 DZ6; until then `missingTokens`, a plural
         * of the students a player plays with no token there), for a hall with no school, and for a pair with nothing
         * wrong; the `notPlaced` whisper's plural (E81 DZ6) for one and two;
         * `scenesTabWrites` for an untouched form, a changed school (a stored field the tab does not show kept), a
         * clash, a stored role whose scene is gone, a cast list of another hall, and "Prepare"; and
         * `hallPreparePatch` (Q-E13-1 d) for an unprepared scene with each tick, and a prepared one; `hallLocked` (E13 fix
         * r1-F2, review r1 cor C) for a hall relinked and one unlinked in a running trial, the same out of it, a trial with
         * the hall select untouched, and no reading; `hallLockReason` (E13 fix r2-H2, review r2 cor E) for a relink, a
         * first hall linked in a running trial, and the same out of it. Then the
         * window's own wiring, on a form drawn from the world's roles and never attached to the page: both
         * selects set to one scene hold Apply, show the warning and decide no write; the Bedrooms tab's hold
         * outlives the Scenes tab's (`setApplyBlock`); and the untouched form's Apply, with `game.settings.set`
         * counted, sets nothing. The tier-2 "the Scenes tab links ..." and scenario 41 a apply it to documents.
         * Red before C5: there was no `sceneReport`.
         */
        const T = await import("./trial-scene.mjs");
        const V = await import("./vault.mjs");
        const { plural } = await import("./utils.mjs");
        ok(typeof T.sceneReport === "function" && typeof V.roomSetupTab === "function", "there is no Scenes tab - trial-scene.mjs has no `sceneReport`");
        if (typeof T.sceneReport !== "function" || typeof V.roomSetupTab !== "function") return;
        const tabs = [V.ROOM_SETUP_TABS.map(([key]) => key).at(-1), V.ROOM_SETUP_TABS.length,
            V.roomSetupTab(null, true), V.roomSetupTab(null, false), V.roomSetupTab("doors", false), V.roomSetupTab("nonsense", true)];
        const region = (name, room) => ({ id: `R120${name}`, name, behaviors: [], getFlag: (scope, key) => (scope === MODULE_ID && key === "room" ? room : undefined) });
        const rooms = T.hallRoomNames({ regions: [region("Stand", true), region("Gallery", false), region("Zone", undefined)] });
        const keys = report => report.map(row => `${row.key}${row.block ? "!" : ""}`);
        const [A, B] = [{ id: "R120SCENEA" }, { id: "R120SCENEB" }];
        const cast = [{ name: "Aiko", second: false, linked: true }, { name: "Aiko again", second: true, linked: true }, { name: "Prop", second: false, linked: false }];
        const full = T.sceneReport({ school: A, hall: B, rooms: ["Stand"], cast, handPlaced: ["Monokuma"] });
        const two = T.sceneReport({ school: A, hall: B, handPlaced: ["Monokuma", "Kuma"] });
        const unplaced = [plural("DRPG.TrialScene.notPlaced", { n: 1, names: "Monokuma" }), plural("DRPG.TrialScene.notPlaced", { n: 2, names: "Monokuma, Kuma" })];
        const reports = [keys(T.sceneReport({ school: A, hall: A })), keys(full), keys(T.sceneReport({ hall: B })), keys(T.sceneReport({ school: A, hall: B })),
            full.find(row => row.key === "handPlaced")?.text === game.i18n.format("DRPG.TrialScene.handPlaced", { names: "Monokuma" }),
            two.find(row => row.key === "handPlaced")?.text === game.i18n.format("DRPG.TrialScene.handPlaced", { names: "Monokuma, Kuma" }),
            unplaced[0].includes("Monokuma") && unplaced[1].includes("Monokuma, Kuma") && unplaced[0] !== unplaced[1]];
        const stored = { school: "R120SCENEA", trial: "R120SCENEB", zones: ["R120ZONE"] };
        const read = (over = {}) => ({ school: "R120SCENEA", trial: "R120SCENEB", drawn: { school: "R120SCENEA", trial: "R120SCENEB" },
            cast: { sceneId: "R120SCENEB", changes: {} }, prepare: null, ...over });
        const writes = [T.scenesTabWrites(read(), stored), T.scenesTabWrites(read({ school: "R120SCENEC" }), stored),
            T.scenesTabWrites(read({ school: "R120SCENEB" }), stored),
            T.scenesTabWrites(read({ school: "", drawn: { school: "", trial: "R120SCENEB" } }), { ...stored, school: "R120GONE" }),
            T.scenesTabWrites(read({ cast: { sceneId: "R120OTHER", changes: { t1: false } } }), stored),
            T.scenesTabWrites(read({ cast: { sceneId: "R120SCENEB", changes: { t1: false } }, prepare: { playlist: true, voice: false } }), stored)];
        const bare = { fog: { exploration: true }, tokenVision: true, environment: { globalLight: { enabled: false } }, playlist: "R120LIST", playlistSound: null,
            flags: { "isometric-perspective": { isometricEnabled: true } }, getFlag: () => false };
        const done = { fog: { exploration: false }, tokenVision: false, environment: { globalLight: { enabled: true } }, playlist: null, getFlag: () => true };
        const patches = [[false, false, true], [true, false, true], [false, true, true], [false, true, false]]
            .map(([playlist, voice, voiceActive]) => Object.keys(T.hallPreparePatch(bare, { playlist, voice, voiceActive })).sort());
        patches.push(Object.keys(T.hallPreparePatch(done, { playlist: true, voice: true, voiceActive: true })));
        const locked = typeof T.hallLocked === "function" ? [T.hallLocked(read({ trial: "R120SCENEC" }), "classTrial"),
            T.hallLocked(read({ trial: "" }), "classTrial"), T.hallLocked(read({ trial: "R120SCENEC" }), "dailyLife"), T.hallLocked(read({ trial: "" }), "dailyLife"),
            T.hallLocked(read({ school: "R120SCENEC" }), "classTrial"), T.hallLocked(null, "classTrial")] : "no hallLocked";
        const reasons = typeof T.hallLockReason === "function" ? [T.hallLockReason(read({ trial: "R120SCENEC" }), "classTrial"),
            T.hallLockReason(read({ trial: "R120SCENEC", drawn: { school: "R120SCENEA", trial: "" } }), "classTrial"),
            T.hallLockReason(read({ trial: "R120SCENEC" }), "dailyLife")] : "no hallLockReason";

        must(game.scenes?.size >= 1, "the world has no scene to draw the Scenes tab's selects with - this would measure nothing");
        const draw = () => {
            const root = document.createElement("div");
            root.innerHTML = `<form>${T.scenesTabHtml()}</form><footer><button type="button" data-action="ok"></button></footer>`;
            T.wireScenesTab(root, reason => V.setApplyBlock(root, "scenes", reason));
            return root;
        };
        const root = draw();
        const apply = root.querySelector('footer button[data-action="ok"]');
        const [school, trial] = ["school", "trial"].map(role => root.querySelector(`[name="scenes:${role}"]`));
        const one = game.scenes.contents[0].id;
        school.value = one;
        trial.value = one;
        trial.dispatchEvent(new Event("change"));
        const clash = [apply.disabled, Boolean(root.querySelector('[data-drpg-scene-warning="sameScene"]')),
            JSON.stringify(T.scenesTabWrites(T.readScenesTab(root), (await import("./rooms.mjs")).sceneRoles()))];
        V.setApplyBlock(root, "bedrooms", "R120 two bedrooms");
        trial.value = "";
        trial.dispatchEvent(new Event("change"));
        const held = apply.disabled;
        V.setApplyBlock(root, "bedrooms", null);
        clash.push(held, apply.disabled);
        const set = game.settings.set;
        let sets = 0, applied = null;
        try {
            game.settings.set = async (...args) => { sets++; return null; };
            applied = await T.applyScenesTab(T.readScenesTab(draw()));
        } finally {
            game.settings.set = set;
        }

        equal(JSON.stringify([tabs, rooms, reports, writes, patches, clash, sets, applied, locked, reasons]), JSON.stringify([
            ["scenes", 8, "bedrooms", "scenes", "doors", "bedrooms"], ["Stand"],
            [["sameScene!"], ["hallHasRooms", "handPlaced", "duplicateInHall", "unlinkedToken"], ["noSchoolLinked"], [], true, true, true],
            [{ roles: null, cast: null, prepare: null },
                { roles: { school: "R120SCENEC", trial: "R120SCENEB", zones: ["R120ZONE"] }, cast: null, prepare: null },
                { roles: null, cast: null, prepare: null }, { roles: null, cast: null, prepare: null }, { roles: null, cast: null, prepare: null },
                { roles: null, cast: { sceneId: "R120SCENEB", changes: { t1: false } }, prepare: { sceneId: "R120SCENEB", playlist: true, voice: false } }],
            [["environment.globalLight.enabled", "fog.exploration", "tokenVision"],
                ["environment.globalLight.enabled", "fog.exploration", "playlist", "playlistSound", "tokenVision"],
                ["environment.globalLight.enabled", "flags.proximity-voice-chat.disabled", "fog.exploration", "tokenVision"],
                ["environment.globalLight.enabled", "fog.exploration", "tokenVision"], []],
            [true, true, JSON.stringify({ roles: null, cast: null, prepare: null }), true, false],
            0, { roles: false, cast: false, shown: null, prepared: null }, [true, true, false, false, false, false],
            ["DRPG.TrialScene.hallInTrial", "DRPG.TrialScene.hallFirstInTrial", null]]),
            "[Room Setup's last tab, its count, the tab it opens on (a scene with rooms, one without, Doors asked, a tab that is none); the hall's room names; "
            + "the report's rows for one scene twice, a hall with everything wrong, no school, nothing wrong, and its one and two missing students; what Apply "
            + "would write for an untouched form, a changed school, a clash, a gone role untouched, another hall's cast, a tick and Prepare; Prepare's fields "
            + "bare, with the playlist, with the voice, with the voice ticked and its module off, and on a prepared scene; the drawn tab with one scene twice: "
            + "Apply held, the warning, no write; Apply still held by the Bedrooms tab, then free; settings.set calls and the answer of an untouched Apply; "
            + "the hall relinked and unlinked in a running trial (locked), the same out of it, the school changed in it, no reading; "
            + "the reason for a relink and for a first hall linked in a running trial, and none out of it]");
    }],

    ["R437 - Start the Class Trial names the trial hall and the table's rule, and the trial console's one door takes the table to the hall or back without the phase", async () => {
        /*
         * E13 C6, 12.10.2026; plan-E13 C6, decision D8, doneWhen 4 (the ledger's D4: the table's rule "the dead listen
         * but do not speak in the trial" in one sentence beside Start the Class Trial). Since C3 the phase takes every
         * browser to the linked hall, and Start the Class Trial's window named the phase, the discussion and the
         * announcement - not the hall, not how many of its tokens would be shown, and no rule for the dead; Edit
         * campaign's question about the trial named the budget and the charge; and inside a trial a GM had only
         * Foundry's own activation to look at the school, which left the hall's cast shown. Asked of plain objects, so
         * it reads no document and writes nothing (tier 1): `startTrialLines` for a hall whose name needs escaping with
         * one token shown and with four (the plural) and for no hall; `tableDoor` out of a trial, with no hall, with
         * the table on the school, in the hall with somewhere to go and with nowhere, and with no active scene. Then
         * the rule's words in both language files (the doneWhen's own, en and pl), and in the source with comments
         * blanked: the Start window preloads the hall on every client before it opens and counts the cast through
         * `castShownOnEntry` after the judgements; its content carries both lines; the console's footer offers the
         * door and its two actions are the two doors; Edit campaign's trial question carries
         * `phaseSwitchesScene`; and game.drpg has the four calls. Scenario 41 k1-k4 and d1 run them on documents and
         * windows. Red before C6: there was no `startTrialLines`.
         * E81 DZ6 (12.10.2026): the hall line counts nothing (the window holds the ticks a count would go stale
         * against), so it is asked with a hall and with none; the Start window draws the cast picker before it
         * waits, and its Start stores the changed ticks after both questions (`incidentClosedFirst`,
         * `confirmNewTrial`) and before the phase moves (`setClock`) - so a Cancel or a no stores nothing, and the
         * entry reads the choice. Red at 0697d0f: the window counted `castShownOnEntry` and held no tick.
         */
        const T = await import("./trial-scene.mjs");
        const made = typeof T.startTrialLines === "function" && typeof T.tableDoor === "function";
        ok(made, "Start the Class Trial says nothing of the hall or the rule - trial-scene.mjs has no `startTrialLines` or `tableDoor`");
        if (!made) return;
        const hall = { id: "HALL", name: "Hall <b>" }, school = { id: "SCHOOL", name: "School" };
        const one = T.startTrialLines({ hall }), none = T.startTrialLines({ hall: null });
        equal(JSON.stringify([one.table, none.table, one.rule, none.rule, one.table.includes("<b>"), /\d/.test(one.table)]),
            JSON.stringify([game.i18n.format("DRPG.Floor.startTrialHall", { hall: "Hall &lt;b&gt;" }),
                game.i18n.localize("DRPG.Floor.startTrialNoHall"), game.i18n.localize("DRPG.Floor.tableRuleDead"),
                game.i18n.localize("DRPG.Floor.tableRuleDead"), false, false]),
            "[the hall line (the name escaped), the line with no hall, the rule with a hall and without, the raw name in the line, a count in the line]");
        const door = args => T.tableDoor(args);
        equal(JSON.stringify([door({ running: false, hall, active: hall, back: school }), door({ running: true, hall: null, active: school, back: school }),
            door({ running: true, hall, active: school, back: school }), door({ running: true, hall, active: hall, back: school }),
            door({ running: true, hall, active: hall, back: null }), door({ running: true, hall, active: null, back: school })]),
            JSON.stringify([null, null, { scene: "School", action: "showHall" }, { scene: "Hall <b>", action: "backToSchool" },
                { scene: "Hall <b>", action: null }, { scene: null, action: "showHall" }]),
            "[out of a trial, no hall linked, the table on the school, in the hall with somewhere to go, in the hall with nowhere, no active scene]");

        const { MODULE_ID } = await import("./config.mjs");
        const rule = async lang => {
            const r = await fetch(`modules/${MODULE_ID}/lang/${lang}.json`);
            must(r.ok, `${lang}.json: HTTP ${r.status}`);
            return foundry.utils.expandObject(await r.json()).DRPG?.Floor?.tableRuleDead ?? "";
        };
        const [en, pl] = await Promise.all([rule("en"), rule("pl")]);

        const files = new Map(await otherSources());
        must(["trial-floor-ui.mjs", "gm-panel.mjs", "trial-scene.mjs"].every(file => files.has(file)), "the files the window and the doors live in are not served - this would measure nothing");
        const ui = stripComments(files.get("trial-floor-ui.mjs")), panel = stripComments(files.get("gm-panel.mjs"));
        const start = fnSource(ui, "startClassTrial"), edit = fnSource(panel, "openClockDialog");
        const at = text => start.indexOf(text);
        equal(JSON.stringify([en.includes("the dead listen but do not speak in the trial"), pl.includes("umarli słuchają, ale nie mówią w rozprawie"),
            at("game.scenes.preload?.(hall.id, true)") > 0 && at("game.scenes.preload?.(hall.id, true)") < at("DialogV2.wait("),
            at("judgedFor(") > 0 && at("judgedFor(") < at("castPickerHtml(hall") && at("castPickerHtml(hall") < at("DialogV2.wait(") && at("${castPicker}") > at("DialogV2.wait(")
                && at("confirmNewTrial(") > at("incidentClosedFirst(") && at("saveTrialCast(hall") > at("confirmNewTrial(") && at("saveTrialCast(hall") < at("setClock(")
                && at("castShownOnEntry(") < 0,
            at("${lines.table}") > at("DialogV2.wait("), at("${lines.rule}") > at("DialogV2.wait("),
            /\.\.\.\(table\?\.action\s*\?\s*\[\{ action: table\.action/.test(fnSource(ui, "trialButtons")),
            /showHall: async \(\) => \{\s*const \{ showCourtroom \} = await import\("\.\/trial-scene\.mjs"\);\s*await showCourtroom\(\);/.test(ui),
            /backToSchool: async \(\) => \{\s*const \{ showSchool \} = await import\("\.\/trial-scene\.mjs"\);\s*await showSchool\(\);/.test(ui),
            /confirmCorrection\("DRPG\.Clock\.trialFromEditTitle", "DRPG\.Clock\.trialFromEdit", moves\)/.test(edit) && edit.includes('"DRPG.TrialScene.phaseSwitchesScene"'),
            ["showCourtroom", "showSchool", "trialSceneReport", "openTrialCast"].map(name => typeof game.drpg?.[name])]),
            JSON.stringify([true, true, true, true, true, true, true, true, true, true, ["function", "function", "function", "function"]]),
            "[the rule's words in en.json and pl.json; Start preloads the hall before its window; draws the cast picker after the judgements and before it waits, holds it, and stores the ticks after both questions and before the phase, counting nothing; shows the hall line; shows the rule; "
            + "the console's footer offers the door; its Show the hall is showCourtroom; its Back to school is showSchool; Edit campaign's trial question says where the table goes; game.drpg's four calls]");
    }],
    ["R439 - a tier 0 tool or weapon is spent by any roll it was used in, a tier 1 to 3 one only by a Despair, and the sheet draws a tier 0 one no durability track", async () => {
        /*
         * E13 C8, 12.10.2026; the owner's amend of 25.09 (the ledger's A25): tier 0 things are single-use - they break
         * after every roll in which they were the tool or weapon (an action, a clean-up, a murder, the incident),
         * whatever the result; creative use is unchanged; the sheet shows them no durability bar; tiers 1 to 3 are
         * unchanged. Until C8 a tier 0 tool wore only on a Despair that was no critical, like a tier 1 one, and the
         * sheet drew it one pip. Asked of plain objects, so it reads no document and writes nothing (tier 1):
         * use-items.mjs `rollSpends` - the rule `breakOnDespair` asks - for tiers 0 to 3 and an item with no tier
         * recorded (which every reader takes as tier 0, `tierOf`), each after a roll with Hope, one with Despair and a
         * critical; sheet.mjs `wearMarkup` for a tier 0, 1 and 3 Tool, a tier 0 Murder Weapon and Cleaning Tool and a
         * tier 0 usable (no track, and no "Single use" either: it is not readied for a roll). Then, in the source with
         * comments blanked: `breakOnDespair` asks `rollSpends` before it wears; the five roads that wear a tool after
         * their dice still call it, as a statement of its own (action-rolls.mjs `workOnProject`, `performSabotage`; cleanup.mjs `attemptCleanup`,
         * `attemptStageSix`; murder-rules.mjs `wearSwing`); and creative use (`useItem`, `useCreatively`) reaches no
         * wear. The tier-2 tests "a tier-0 tool is spent by any roll it was used in and a tier-1 tool only by a
         * Despair" and "a tier-0 knife swung on a hit with Hope is spent and a Reroll gives it back for the replay
         * to spend again" and scenario 12's single-use check run it on documents. Red before C8: there was no
         * `rollSpends`.
         */
        const U = await import("./use-items.mjs");
        const S = await import("./sheet.mjs");
        const made = typeof U.rollSpends === "function" && typeof S.wearMarkup === "function";
        ok(made, "a tier 0 thing wears as a tier 1 one does - use-items.mjs has no `rollSpends`, or sheet.mjs no `wearMarkup` to read");
        if (!made) return;
        const { ITEM_FLAGS } = await import("./inventory.mjs");
        const item = (tier, category = "tool") => ({ name: `R439 ${category} ${tier}`,
            getFlag: (scope, key) => scope === MODULE_ID ? { [ITEM_FLAGS.tier]: tier, [ITEM_FLAGS.category]: category }[key] : undefined });
        const hope = { total: 14, withHope: true, withFear: false, isCritical: false };
        const fear = { total: 14, withHope: false, withFear: true, isCritical: false };
        const crit = { total: 20, withHope: false, withFear: false, isCritical: true };
        equal(JSON.stringify([0, undefined, 1, 2, 3].map(tier => [hope, fear, crit].map(roll => U.rollSpends(item(tier), roll))).concat([[U.rollSpends(item(0), null)]])),
            JSON.stringify([[true, true, true], [true, true, true], [false, true, false], [false, true, false], [false, true, false], [false]]),
            "[tier 0, no tier, tier 1, 2, 3 - each after Hope, Despair, a critical; tier 0 with no roll]");

        const pips = html => (html.match(/drpg-wear-pip/g) ?? []).length;
        const single = html => html.includes("drpg-single-use") && html.includes(game.i18n.localize("DRPG.Items.singleUse"));
        const marks = [item(0), item(1), item(3), item(0, "crimeTool"), item(0, "cleaningTool"), item(0, "usable")].map(S.wearMarkup);
        equal(JSON.stringify(marks.map(html => [pips(html), single(html)])),
            JSON.stringify([[0, true], [1, false], [3, false], [0, true], [0, true], [0, false]]),
            "[pips and \"Single use\" for a tier 0, 1 and 3 Tool, a tier 0 Murder Weapon, Cleaning Tool and usable]");

        const files = new Map(await otherSources());
        must(["use-items.mjs", "action-rolls.mjs", "cleanup.mjs", "murder-rules.mjs"].every(file => files.has(file)), "the files the roads live in are not served - this would measure nothing");
        const src = file => stripComments(files.get(file));
        // A statement of its own: a road that asked a Fear of its own first (`if (roll.withFear) await ...`) would
        // spend a tier 0 tool on a Despair alone again, and still "call" it.
        const calls = (file, name) => /^\s*await breakOnDespair\(/m.test(fnSource(src(file), name));
        const wears = /\b(?:breakOnDespair|rollSpends|wearItem|breakItem)\(/;
        const breaks = fnSource(src("use-items.mjs"), "breakOnDespair");
        equal(JSON.stringify([breaks.indexOf("rollSpends(held, roll)") > 0 && breaks.indexOf("rollSpends(held, roll)") < breaks.indexOf("wearItem("),
            calls("action-rolls.mjs", "workOnProject"), calls("action-rolls.mjs", "performSabotage"), calls("cleanup.mjs", "attemptCleanup"),
            calls("cleanup.mjs", "attemptStageSix"), calls("murder-rules.mjs", "wearSwing"),
            wears.test(fnSource(src("use-items.mjs"), "useItem")), wears.test(fnSource(src("use-items.mjs"), "useCreatively"))]),
            JSON.stringify([true, true, true, true, true, true, false, false]),
            "[breakOnDespair asks rollSpends before it wears; workOnProject, performSabotage, attemptCleanup, attemptStageSix and wearSwing call it unconditionally; useItem and useCreatively wear nothing]");
    }],

    ["R442 - a missing or switched-off companion stops the module: Isometric Perspective and LiveKit as Dice So Nice", async () => {
        /*
         * E13 C10, 12.10.2026; the owner's amendment d of 09.10 (the ledger's Ad; LIVE-E13-11's headless half).
         * Required means installed and switched on (d2), and the check is the one Dice So Nice always had:
         * requirements.mjs `missingRequirements` lists every module this world's manifest requires that the module map
         * does not hold (`absent`) or holds switched off (`disabled`), and `requirementsMet` answers whether it listed
         * none. Both take the map as an argument since C10, so this asks about worlds this one is not, with plain Maps,
         * and touches nothing the running module reads: all three on; Isometric Perspective installed but off; LiveKit
         * never installed; Dice So Nice off. Before C10 the two stood under `recommends`, the check never saw them, and
         * the second and third worlds read as met. Then module.mjs with comments blanked: `init` returns on
         * `requirementsMet()` before it registers a setting (R147 keeps the relay guard ahead of it), `setup` returns on
         * it first, and `ready` announces what is missing and returns before anything else. What the GM's window and the
         * player's notice say at a table, and whether Foundry's own prompt offers the two, is LIVE-E13-11 (not run).
         */
        const R = await import("./requirements.mjs");
        must(typeof R.missingRequirements === "function" && typeof R.requirementsMet === "function", "requirements.mjs has no check to ask");
        const IDS = ["dice-so-nice", "isometric-perspective", "avclient-livekit"];
        const ask = world => {
            const map = new Map(IDS.filter(id => world[id] !== "absent").map(id => [id, { id, title: id, active: world[id] !== "disabled" }]));
            return { missing: R.missingRequirements(map).map(row => `${row.id}:${row.state}`), met: R.requirementsMet(map) };
        };
        equal(JSON.stringify([ask({}), ask({ "isometric-perspective": "disabled" }), ask({ "avclient-livekit": "absent" }), ask({ "dice-so-nice": "disabled" })]),
            JSON.stringify([{ missing: [], met: true }, { missing: ["isometric-perspective:disabled"], met: false },
                { missing: ["avclient-livekit:absent"], met: false }, { missing: ["dice-so-nice:disabled"], met: false }]),
            "[what is missing and whether the module may start: all three on; Isometric Perspective switched off; LiveKit not installed; Dice So Nice switched off]");

        const src = stripComments(new Map(await otherSources()).get("module.mjs") ?? "");
        const init = bodyOf(src, 'Hooks.once("init"', { until: 'Hooks.once("setup"' });
        const stop = init.search(/if \(!requirementsMet\(\)\) \{[^{}]*\breturn;\s*\}/);
        equal(JSON.stringify([stop > 0 && stop < init.indexOf("registerSettings("),
            /^Hooks\.once\("setup", \(\) => \{\s*if \(!requirementsMet\(\)\) return;/.test(bodyOf(src, 'Hooks.once("setup"', { until: 'Hooks.once("ready"' })),
            /^Hooks\.once\("ready", \(\) => \{\s*if \(!requirementsMet\(\)\) \{\s*announceMissingRequirements\(\)[^{}]*\);\s*return;\s*\}/
                .test(bodyOf(src, 'Hooks.once("ready"', { length: 600 }))]),
            JSON.stringify([true, true, true]),
            "[init returns on the check before it registers a setting; setup returns on it first; ready announces and returns first]");
    }],
    ["R470 - a GM keeps the Scenes tab when the module stops at its requirements check", async () => {
        /*
         * E13 fix r1-F3, 12.10.2026; goal S12-18's other half. The stylesheet hid the three unless the element carried
         * the class a GM's client puts on it (GM_CHROME, R438), and that was registered in `registerGmPanel`, after the
         * requirements check `init` returns on (R442) - so a world missing a required module, which C10 made likelier,
         * took the three from its GM too. Since DZ5 (the owner, 12.10.2026; E81 fix r1-G6) the scene navigation and
         * the hotbar are hidden for everybody and only the Scenes tab is left of the three. Read in module.mjs with
         * comments blanked: `init` registers the GM's chrome after the relay guard and before the check; and in
         * gm-panel.mjs: `registerGmChrome` hooks `markGmChrome` on `ready` and on two renders (the scene controls' and
         * the sidebar's) and on neither the navigation's nor the hotbar's - nothing of theirs is stamped any more -,
         * and neither function reads a setting - none is registered on that road. What a GM's client then computes is
         * 00-boot's "the GM's chrome when the module stops" (a GM booted with LiveKit off); whether Foundry v14 links
         * the sheet of a module that stopped is LIVE-E13-11 (not run).
         */
        const sources = new Map(await otherSources());
        const src = stripComments(sources.get("module.mjs") ?? "");
        const panel = stripComments(sources.get("gm-panel.mjs") ?? "");
        const init = bodyOf(src, 'Hooks.once("init"', { until: 'Hooks.once("setup"' });
        const at = needle => init.indexOf(needle);
        const chrome = at(", registerGmChrome)");
        // Read as empty where there is no such function (before the fix), so the answer is a wrong reading, not a stop.
        const register = panel.includes("export function registerGmChrome")
            ? bodyOf(panel, "export function registerGmChrome", { until: "\nfunction markGmChrome" }) : "";
        const mark = bodyOf(panel, "function markGmChrome", { length: 400 });
        const hooked = ["renderSceneControls", "renderSidebar"].filter(h => register.includes(`"${h}"`));
        const dropped = ["renderSceneNavigation", "renderHotbar"].filter(h => register.includes(`"${h}"`));
        equal(JSON.stringify([at("registerRelayGuard") >= 0 && chrome > at("registerRelayGuard"), chrome >= 0 && chrome < at("if (!requirementsMet())"),
            /Hooks\.once\("ready", markGmChrome\)/.test(register), hooked.length, dropped, /\bHooks\.on\(hook, markGmChrome\)/.test(register),
            /game\.settings|getSetting|SETTINGS\./.test(register + mark)]),
            JSON.stringify([true, true, true, 2, [], true, false]),
            "[the GM's chrome after the relay guard; before the requirements check; stamped at ready; the renders hooked; "
            + "the navigation's or the hotbar's render hooked; each to markGmChrome; a setting read on that road]");
    }],
    ["R292 - the notice history keeps what it is given within its budgets, by world and user, and another tab's copy merges in without a loss, a double or a return from the grave", async () => {
        /*
         * E81 C1, 12.10.2026; the A7 design's A7-1 (S16-08: a card closed was a card gone). First the setting the
         * module's own engine writes: this browser's (client scope), out of the settings window, an Object, `{}` by
         * default. Then the engine of notice-history.mjs over a value in memory (`noticeBench`, below the list): nothing is debounced, a case
         * flushes, and the time and the clock are the test's to move. The cases, each on a value of its own: the
         * section's key and the entry's `id`, `at` and clock (this client's, whatever the caller passes); the
         * clipping of a title, a text and an html over its budget, a day summary's larger one; at most 4 full day
         * summaries in a section; the 251st entry of a player's section and the 151st of a GM's; a section's
         * 200 000 characters; 40 entries from each author, whatever their source (E81 fix r1-G1); the value's 500 000, other worlds first and never
         * this world's other accounts (E81 fix r1-G2: a value they alone fill keeps this login in memory); the epoch on
         * read and on write; `open` read back as `unread`; a raw
         * value read through the shape; two tabs of one login - the union, one entry per message and source, a
         * withdrawn entry and a Clear that another tab's copy does not bring back, tombstones let go after ten
         * minutes; this login's section taken out by another account written again from memory; a write that
         * fails once and twice. What a browser's quota counts is not measured here: the budgets are JSON lengths.
         */
        const NH = await import("./notice-history.mjs").catch(() => null);
        ok(typeof NH?.createNoticeEngine === "function", "there is no notice history: a card closed is gone, and a reload loses every card (S16-08)");
        const setting = game.settings.settings.get(`${MODULE_ID}.noticeHistory`);
        equal(JSON.stringify([setting?.scope ?? null, setting?.config ?? null, setting?.type === Object, setting?.default ?? null]),
            JSON.stringify(["client", false, true, {}]), "the history's setting [scope, config, an Object, default]");
        const U1 = "SuitePlayerOne01", U2 = "SuitePlayerTwo02", W = "suite-world", KEY = `${W}.${U1}`;
        const at = { now: 1_000_000 }, clock = { value: { chapter: 2, day: 3, session: 4, timeOfDay: "morning", eclipse: false, seasonStartedAt: 0, resetCuts: {} } };
        const bench = (store, user = U1, more = {}) => noticeBench(NH.createNoticeEngine, { store, user, world: W, at, clock, ...more });
        const card = (n, more = {}) => ({ source: "mine", kind: "info", title: `card ${n}`, text: `text ${n}`, html: `<p>card ${n}</p>`, ...more });
        const fresh = () => ({ raw: null, writes: 0, fail: 0 });
        const stored = store => JSON.parse(store.raw);
        const tick = (ms = 1000) => { at.now += ms; };

        // The key, and what is this client's.
        let store = fresh(), e = bench(store);
        e.open();
        const first = e.record(card(1, { at: 5, id: "ForgedIdForged00" }));
        await e.flush();
        const [kept] = stored(store).sections[KEY]?.entries ?? [];
        must(kept, "the first entry was not written - nothing below would be measured");
        equal(JSON.stringify([stored(store).v, Object.keys(stored(store).sections), kept.id === first, kept.at, kept.state, kept.clock.chapter, store.writes]),
            JSON.stringify([1, [KEY], true, at.now, "open", 2, 1]),
            "[the format; one section, keyed world.user; the id the record answered; `at` this client's clock, not the caller's; open; the clock's chapter; one write]");

        // Clipping.
        e = bench(fresh());
        e.open();
        e.record(card(1, { title: "t".repeat(300), text: "x".repeat(700) }));
        e.record(card(2, { html: `<p>${"y".repeat(8100)}</p>` }));
        e.record(card(3, { source: "summary", html: `<p>${"z".repeat(20000)}</p>` }));
        e.record(card(4, { source: "summary", html: `<p>${"z".repeat(24100)}</p>` }));
        must(e.entries().length === 4, `the clipping cases kept ${e.entries().length} entries of 4`);
        equal(JSON.stringify(e.entries().map(x => [x.title.length, x.text.length, x.html.length > 0, x.clipped])),
            JSON.stringify([[200, 600, true, false], [6, 6, false, true], [6, 6, true, false], [6, 6, false, true]]),
            "[a title clipped to 200 and a text to 600; an html over 8 000 dropped and the entry clipped; a summary of 20 000 kept; one over 24 000 clipped]");

        // At most 4 full day summaries.
        e = bench(fresh());
        e.open();
        for (let n = 0; n < 5; n++) { tick(); e.record(card(n, { source: "summary" })); }
        must(e.entries().length === 5, `the summary case kept ${e.entries().length} of 5`);
        equal(JSON.stringify(e.entries().map(x => x.clipped)), JSON.stringify([true, false, false, false, false]),
            "a fifth day summary in a section did not clip the oldest of the five");

        // The 251st entry, and a GM's 151st.
        const counts = [];
        for (const [gm, n] of [[false, 251], [true, 151]]) {
            e = bench(fresh(), U1, { gm });
            e.open();
            for (let i = 0; i < n; i++) { tick(); e.record(card(i)); }
            counts.push(e.entries().length, e.entries()[0]?.title);
        }
        equal(JSON.stringify(counts), JSON.stringify([250, "card 1", 150, "card 1"]),
            "[a player's section after 251 entries, its oldest; a GM's after 151, its oldest]");

        // A section's 200 000 characters.
        store = fresh();
        e = bench(store);
        e.open();
        for (let i = 0; i < 30; i++) { tick(); e.record(card(i, { html: `<p>${"w".repeat(7900)}</p>` })); }
        await e.flush();
        const big = stored(store).sections[KEY];
        must(big?.entries?.length > 0, "the section over its characters kept nothing - nothing to measure");
        equal(JSON.stringify([JSON.stringify(big).length <= 200000, big.entries.length < 30, big.entries.at(-1).title]),
            JSON.stringify([true, true, "card 29"]),
            "[a section within 200 000 characters; some of 30 entries of 8 000 gone; the newest kept]");

        // 40 entries from each author, whatever their source: the public ones count against A since E81 fix r1-G1.
        e = bench(fresh());
        e.open();
        const A = "SuiteAuthorAaaa1", B = "SuiteAuthorBbbb2";
        for (let i = 0; i < 41; i++) { tick(); e.record(card(i, { source: "player", author: A })); }
        for (let i = 0; i < 3; i++) { tick(); e.record(card(`b${i}`, { source: "player", author: B })); }
        for (let i = 0; i < 2; i++) { tick(); e.record(card(`p${i}`, { source: "public", author: A })); }
        const byAuthor = who => e.entries().filter(x => x.author === who).length;
        must(e.entries().length > 0, "the author case kept nothing");
        equal(JSON.stringify([byAuthor(A), byAuthor(B), e.entries().filter(x => x.source === "public").length,
            e.entries().some(x => x.title === "card 0"), e.entries().some(x => x.source === "public" && x.author)]),
            JSON.stringify([40, 3, 2, false, true]),
            "[author A's entries after 43, its public ones among them; author B's 3; the public ones; A's oldest gone; an author kept on a card that is not a player's]");

        // The whole value's 500 000: other worlds first, the least recently written first, and never this world's other
        // accounts (E81 fix r1-G2, 12.10.2026; until then they went next): a value they alone fill is not written.
        const epoch = NH.noticeEpoch(clock.value);
        const filler = (touched, chars) => ({ epoch, touched, clearedAt: 0, gone: {}, entries: [], pad: "f".repeat(chars) });
        const evicted = [];
        for (const sections of [
            { [`other-world.${U1}`]: filler(20, 170000), [`third-world.${U1}`]: filler(10, 170000), [`${W}.${U2}`]: filler(1, 170000) },
            { [`${W}.${U2}`]: filler(1, 520000) }
        ]) {
            store = { ...fresh(), raw: JSON.stringify({ v: 1, sections }) };
            e = bench(store);
            e.open();
            e.record(card("own"));
            await e.flush();
            evicted.push(Object.keys(stored(store).sections).sort().join(" "), store.raw.length <= 500000, e.entries().length, e.status().saving);
        }
        equal(JSON.stringify(evicted), JSON.stringify([`other-world.${U1} ${W}.${U1} ${W}.${U2}`, true, 1, true, `${W}.${U2}`, false, 1, false]),
            "[over 500 000 with two other worlds and another account here: the least recently written other world goes, the account stays though older; "
            + "with this world's other account alone over it: that section stays and nothing is written, this login's entry kept in memory, not saving]");

        // The epoch: on read, and on write.
        store = fresh();
        e = bench(store);
        e.open();
        e.record(card("before"));
        await e.flush();
        must(stored(store).sections[KEY]?.entries?.length === 1, "the entry before the reset was not written");
        clock.value = { ...clock.value, resetCuts: { incident: at.now } };
        const reread = bench(store);
        reread.open();
        const onRead = reread.entries().length;
        clock.value = { ...clock.value, resetCuts: { incident: at.now, chatRest: at.now + 1 } };
        e.record(card("after"));
        await e.flush();
        equal(JSON.stringify([onRead, stored(store).sections[KEY].entries.map(x => x.title), stored(store).sections[KEY].epoch === NH.noticeEpoch(clock.value)]),
            JSON.stringify([0, ["card after"], true]),
            "[a section written before a reset, read after it; a section written to after another reset; its epoch the clock's]");

        // `open` comes back as `unread`; a raw value is read through the shape.
        const good = { id: "SuiteEntryGood01", at: 5, messageId: null, kind: "info", tone: null, source: "mine", state: "open", mark: null, title: "kept", text: "", html: "", clipped: false, clock: {} };
        const raws = [good, { ...good, id: "SuiteEntryRead02", state: "read" }, { ...good, id: "bad\"id\"Entry003" }, { ...good, id: "SuiteEntryBad004", source: "forged" },
            { ...good, id: "SuiteEntryBad005", state: "shown" }, { ...good, id: "SuiteEntryBad006", messageId: "<b>" }, { ...good, id: "SuiteEntryAuth07", author: U2 }];
        store = { ...fresh(), raw: JSON.stringify({ v: 1, sections: { [KEY]: { epoch: NH.noticeEpoch(clock.value), touched: 1, clearedAt: 0, gone: {}, entries: raws } } }) };
        e = bench(store);
        e.open();
        const newer = bench({ ...fresh(), raw: JSON.stringify({ v: 2, sections: { [KEY]: { entries: raws } } }) });
        newer.open();
        equal(JSON.stringify([e.entries().map(x => [x.id, x.state, x.author ?? null]), newer.entries().length, newer.status().saving]),
            JSON.stringify([[["SuiteEntryGood01", "unread", null], ["SuiteEntryRead02", "read", null], ["SuiteEntryAuth07", "unread", U2]], 0, false]),
            "[open read back as unread, read as read; a quoted id, a forged source, an unknown state and a messageId of markup refused; an author kept on a card that is not a player's (E81 fix r1-G1); "
            + "a newer format read as nothing and kept in memory only]");

        // Two tabs of one login.
        store = fresh();
        const one = bench(store), two = bench(store);
        one.open();
        two.open();
        tick(); const a = one.record(card("a"));
        tick(); const b = two.record(card("b"));
        await one.flush(); await two.flush(); one.external();
        const ids = () => stored(store).sections[KEY].entries.map(x => x.id);
        must(ids().length > 0, "neither tab wrote");
        const union = [ids().join(), one.entries().map(x => x.id).join()];
        const M = "SuiteMessageId01";
        tick(); one.record(card("m1", { messageId: M }));
        tick(); const m2 = two.record(card("m2", { messageId: M }));
        await one.flush(); await two.flush(); one.external();
        const upsert = [stored(store).sections[KEY].entries.filter(x => x.messageId === M).map(x => x.id).join(), one.entries().filter(x => x.messageId === M).map(x => x.id).join()];
        one.remove(a);
        await one.flush(); await two.flush(); two.external();
        const buried = [ids().includes(a), two.entries().some(x => x.id === a)];
        tick(); one.clear();
        await one.flush(); await two.flush(); two.external();
        const cleared = [ids().length, two.entries().length, Object.keys(stored(store).sections[KEY].gone).length > 0];
        /* Let go at the next write: since E81 fix r1-G5 a flush with nothing changed writes nothing, so a card comes first. */
        tick(11 * 60 * 1000); one.record(card("after")); await one.flush();
        const tombstones = Object.keys(stored(store).sections[KEY].gone).length;
        /* A copy older than the Clear, its tombstones let go: what is kept out now is `clearedAt` alone. */
        const late = stored(store), STALE = "SuiteStaleCopy01";
        late.sections[KEY].entries.push({ id: STALE, at: late.sections[KEY].clearedAt - 1, messageId: null, kind: "info", tone: null,
            source: "mine", state: "read", mark: null, title: "stale", text: "", html: "", clipped: false, clock: {} });
        store.raw = JSON.stringify(late);
        one.external();
        equal(JSON.stringify([union, upsert, buried, cleared, tombstones, one.entries().some(x => x.id === STALE)]),
            JSON.stringify([[`${a},${b}`, `${a},${b}`], [m2, m2], [false, false], [0, 0, true], 0, false]),
            "[both tabs' entries in the value and in the first tab, once each; one entry for a message and source, the newer; a withdrawn entry back from the tab that held it; "
            + "a Clear undone by the other tab's copy; the tombstones after ten minutes; an entry from before the Clear in a copy read after them]");

        // This login's section taken out of the value: written again from memory.
        store = fresh();
        e = bench(store);
        e.open();
        tick(); e.record(card("x"));
        await e.flush();
        const value = stored(store);
        delete value.sections[KEY];
        store.raw = JSON.stringify(value);
        tick(); e.record(card("y"));
        await e.flush();
        equal(JSON.stringify(stored(store).sections[KEY]?.entries?.map(x => x.title)), JSON.stringify(["card x", "card y"]),
            "this login's section, taken out of the value by another account's write, did not come back whole at the next write");

        // A write that fails: once - the oldest quarter goes and it is written; twice - memory only, and the footer's text.
        const failed = [];
        for (const fail of [1, 2]) {
            store = fresh();
            e = bench(store);
            e.open();
            for (let i = 0; i < 8; i++) { tick(); e.record(card(i)); }
            store.fail = fail;
            await e.flush();
            failed.push(store.raw ? stored(store).sections[KEY].entries.length : null, e.entries().length, e.status().note);
        }
        equal(JSON.stringify(failed), JSON.stringify([6, 6, null, null, 6, "DRPG.Notices.notSaved"]),
            "[a write failed once: a quarter of 8 gone and the rest written; failed twice: nothing written, 6 kept in memory, the footer's text]");

        /*
         * A write only when something changed (E81 fix r1-G5; review round 1's O2). The page flushes at every hide,
         * and at 0697d0f each flush wrote: a login that had recorded nothing found an empty section of its own
         * written, then rewritten (both reviewers measured it), and a hide during tier 0/1 moved the setting the
         * runner's "changed nothing" check reads. Here: two flushes with nothing recorded; one card and three
         * flushes; the other road to an empty section - the reset's clean-up of another account's ended section,
         * which writes; and the one write a clean page still owes: another tab's stale copy that lost this
         * page's entry is written back, and the tab that lost nothing writes nothing.
         */
        const clean = [];
        {
            let s = fresh(), x = bench(s);
            x.open();
            await x.flush();
            await x.flush();
            clean.push(s.raw, s.writes);
            tick(); x.record(card("once"));
            await x.flush();
            tick(); await x.flush();
            await x.flush();
            clean.push(s.writes, stored(s).sections[KEY]?.entries?.length ?? 0);
            s = fresh();
            s.raw = JSON.stringify({ v: 1, sections: { [`${W}.${U2}`]: { epoch: "an-ended-season", touched: 1, clearedAt: 0, gone: {}, entries: [] } } });
            x = bench(s);
            x.open();
            await x.flush();
            clean.push(s.writes, Object.keys(stored(s).sections));
            s = fresh();
            const tabA = bench(s), tabB = bench(s);
            tabA.open(); tabB.open();
            tick(); const lost = tabA.record(card("lost"));
            await tabA.flush();
            const stale = stored(s);
            stale.sections[KEY].entries = [];
            s.raw = JSON.stringify(stale);
            const w = s.writes;
            tabA.external();
            await tabA.flush();
            const repaired = [stored(s).sections[KEY].entries.map(entry => entry.id).includes(lost), s.writes - w];
            tabB.external();
            await tabB.flush();
            clean.push([...repaired, s.writes - w]);
        }
        equal(JSON.stringify(clean), JSON.stringify([null, 0, 1, 1, 1, [], [true, 1, 1]]),
            "[nothing recorded, flushed twice: the stored value, the writes; one card, flushed three times: the writes, its section's entries; "
            + "the reset's clean-up of another account's section: the writes, the sections left; a stale copy that lost this tab's entry: [written back, by one write; "
            + "the writes after the tab that lost nothing flushed]]");
    }],

    ["R297 - each account keeps what its own browser showed it: every account's section stays in the value to the season's reset, and the reset clears them all", async () => {
        /*
         * E81 C1, 12.10.2026; the A7 design's A7-6, its accounts and its epoch (C3 and C4 add the recipients and the
         * sensitive entries). The owner's Q9 (11.10.2026, "Bierzemy alternatywę"): on a browser two accounts share,
         * no account's section is taken out when another logs in, and the season's reset - a reset of the clock, the
         * incident, the cards or the rest of the chat log - clears every one, the absent account's included. Read at
         * the value's level, as `game.settings.get` would show it, on the engine over a value in memory: the first
         * account's section byte for byte after the second's `ready`; for every group of `RESET_GROUPS`, whether the
         * second account's first read after a reset of that group alone clears the first's section and its own; and
         * an account that logs in here first after the reset; a tab open across it whose next write clears as a read
         * does. The cuts are `resetCutPatch`'s, the reset's own. The
         * accounts share the value because the setting is this browser's (client scope), which is checked first.
         */
        const NH = await import("./notice-history.mjs").catch(() => null);
        ok(typeof NH?.createNoticeEngine === "function", "there is no notice history: nothing is kept for any account");
        equal(game.settings.settings.get(`${MODULE_ID}.noticeHistory`)?.scope ?? null, "client",
            "the history is not kept in this browser: a world setting would be one value for every account of every browser");
        const { RESET_GROUPS, resetCutPatch } = await import("./season-exceptions.mjs");
        const groups = RESET_GROUPS.map(group => group.key);
        must(groups.length > NH.EPOCH_GROUPS.length, `RESET_GROUPS has ${groups.length} groups - nothing to tell apart`);
        /* The A7 design's 1c, not the module's list read back: a test that took its expectation from EPOCH_GROUPS
           passed with "chatRest" struck from it (a mutant run while this test was written, 12.10.2026). */
        const EPOCH = ["clock", "incident", "cards", "chatRest"];
        equal(JSON.stringify([...NH.EPOCH_GROUPS].sort()), JSON.stringify([...EPOCH].sort()), "the reset groups whose cut moves the epoch");
        equal(EPOCH.filter(group => !groups.includes(group)).join(", "), "", "the epoch names a group the reset does not have");
        const U1 = "SuitePlayerOne01", U2 = "SuitePlayerTwo02", U3 = "SuiteLateComer03", W = "suite-world";
        const at = { now: 2_000_000 }, base = { chapter: 1, day: 1, session: 1, timeOfDay: "morning", eclipse: false, seasonStartedAt: 0, resetCuts: {} };
        const clock = { value: base };
        const bench = (store, user) => noticeBench(NH.createNoticeEngine, { store, user, world: W, at, clock });
        const card = n => ({ source: "mine", kind: "info", title: `card ${n}`, text: "", html: `<p>card ${n}</p>` });
        const sections = store => JSON.parse(store.raw).sections;

        // Two logins: the second's `ready` leaves the first's section as it was.
        let store = { raw: null, writes: 0, fail: 0 };
        const first = bench(store, U1);
        first.open();
        first.record(card(1)); at.now++; first.record(card(2));
        await first.flush();
        const before = JSON.stringify(sections(store)[`${W}.${U1}`]);
        must(JSON.parse(before)?.entries?.length === 2, "the first account's two entries were not written");
        const second = bench(store, U2);
        second.open();
        at.now++; second.record(card(3));
        await second.flush();
        equal(JSON.stringify([JSON.stringify(sections(store)[`${W}.${U1}`]) === before, Object.keys(sections(store)).sort(), second.entries().map(x => x.title)]),
            JSON.stringify([true, [`${W}.${U1}`, `${W}.${U2}`], ["card 3"]]),
            "[the first account's section byte for byte after the second's ready and write; both sections in the value; the second reads only its own]");

        // The reset, group by group: the second account's first read after it, the first account absent.
        const cleared = {};
        for (const group of groups) {
            clock.value = base;
            store = { raw: null, writes: 0, fail: 0 };
            const a = bench(store, U1), b = bench(store, U2);
            a.open(); at.now++; a.record(card("a")); await a.flush();
            b.open(); at.now++; b.record(card("b")); await b.flush();
            must(Object.keys(sections(store)).length === 2, `before the ${group} reset the value holds ${Object.keys(sections(store)).length} sections`);
            at.now += 1000;
            clock.value = { ...base, ...resetCutPatch({ groups: new Set([group]) }, base, at.now) };
            const back = bench(store, U2);
            back.open();
            await back.flush();
            cleared[group] = [!sections(store)[`${W}.${U1}`], back.entries().length === 0];
        }
        equal(JSON.stringify(cleared), JSON.stringify(Object.fromEntries(groups.map(group => [group, EPOCH.includes(group) ? [true, true] : [false, false]]))),
            "[per reset group: the absent first account's section gone at the second's first read; the second's own empty] - "
            + `the clock, the incident, the cards and the rest of the chat log clear, no other group does`);

        // An account that logs in here first after the reset.
        const late = bench(store, U3);
        late.open();
        await late.flush();
        equal(JSON.stringify([late.entries().length, Object.keys(sections(store)).includes(`${W}.${U1}`)]), JSON.stringify([0, false]),
            "[a late account's history after the reset; the first account's section, written before it]");

        // A tab open across the reset that writes before it has heard of it (no `checkEpoch`): the write clears too.
        clock.value = base;
        store = { raw: null, writes: 0, fail: 0 };
        const stay = bench(store, U1), across = bench(store, U2);
        stay.open(); at.now++; stay.record(card("x")); await stay.flush();
        across.open(); at.now++; across.record(card("y")); await across.flush();
        at.now += 1000;
        clock.value = { ...base, ...resetCutPatch({ groups: new Set(["incident"]) }, base, at.now) };
        at.now++; across.record(card("z")); await across.flush();
        equal(JSON.stringify([!sections(store)[`${W}.${U1}`], sections(store)[`${W}.${U2}`]?.entries?.map(x => x.title) ?? null]),
            JSON.stringify([true, ["card z"]]),
            "[an incident reset met by an open tab's write: the absent first account's section gone; the writer's own section only what it recorded after]");
        /*
         * The GM's diet (E81 C3; the A7 design's P3-1 and P3-4, the owner's Q0): a card is kept exactly where the
         * catch-all draws it, so a GM keeps an announcement, a card for the GM to answer and a GM's insisted card, and
         * no whisper of a record; a veiled card without this login's words and a `popupKind: "none"` keep nothing. A
         * public card a player wrote is kept as the player's, from the document's author - a GM's card that names a
         * player as its asker stays public, and carries that player for the per-author bound (E81 fix r1-G1). The messenger's `gmAsk` card the GM is raised for is kept too, as the
         * thread's since E81 C4: its message, and the conversation the entry opens. Measured on this GM through `onCreateChatMessage` with documents made here (no world write) that
         * `game.messages.get` answers for the length of the clause, held as R473 holds the history.
         */
        must(game.user?.isGM, "the diet measured here is a GM's, and the suite runs on a GM (tests.mjs refuses anyone else)");
        needs(world.atLeast("playerAccounts", 1), "a player account to write a card as");
        const player = game.users.find(user => !user.isGM && user.active) ?? game.users.find(user => !user.isGM);
        const { onCreateChatMessage } = await import("./popup.mjs");
        ok(typeof onCreateChatMessage === "function", "popup.mjs gives no catch-all to measure a GM's diet through");
        const { MESSAGE_FLAG } = await import("./utils.mjs");
        const { MESSENGER_FLAGS } = await import("./messenger.mjs");
        const { DrpgMessengerApp } = await import("./messenger-app.mjs");
        const fake = (id, { author = game.user, whisper = [], flags = {}, content = `<p>${id} words</p>` } = {}) => ({
            id, author, whisper, rolls: [], content, flags: { [MODULE_ID]: { [MESSAGE_FLAG]: true, ...flags } },
            getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
        });
        const me = game.user.id;
        const fakes = [
            fake("R297Announcement", {}),
            fake("R297PlayerPublic", { author: player }),
            fake("R297AskedByPlay1", { flags: { askedBy: player.id } }),
            fake("R297WhisperedRec", { whisper: [player.id, me] }),
            fake("R297GmPopupCard1", { whisper: [me], flags: { gmPopup: true } }),
            fake("R297ForcedByGm01", { whisper: [player.id, me], flags: { popupForce: true } }),
            fake("R297ForcedByPlay", { author: player, whisper: [player.id, me], flags: { popupForce: true } }),
            fake("R297VeiledNoWord", { flags: { secret: true, veiled: true } }),
            fake("R297KindNoneCard", { flags: { popupKind: "none" } })
        ];
        const byId = new Map(fakes.map(message => [message.id, message]));
        must(!Object.hasOwn(game.messages, "get"), "game.messages already answers get for itself - the suite's stand-in would hide it");
        const read = new Map();
        let askLink = null;
        await NH.holdNoticeHistory(true);
        const realGet = game.messages.get;
        game.messages.get = function (id, ...rest) { return byId.get(id) ?? realGet.call(this, id, ...rest); };
        try {
            for (const message of fakes) await onCreateChatMessage(message);
            for (const message of fakes) {
                read.set(message.id, NH.noticeEntries().filter(entry => entry.messageId === message.id).map(entry => [entry.source, entry.author ?? null]));
            }
            if (!DrpgMessengerApp.instances.has(player.id)) {
                const ask = fake("R297GmAskCard001", { author: player, whisper: [player.id, me], flags: { [MESSENGER_FLAGS.gmAsk]: true }, content: "<p>R297 asks the GM</p>" });
                const chatter = fake("R297ChatterCard1", { author: player, whisper: [player.id, me], content: "<p>R297 chatter</p>" });
                for (const message of [ask, chatter]) {
                    Hooks.callAll("drpgMessengerMessage", player.id, message);
                    await until(() => NH.noticeEntries().some(entry => entry.text.includes(message === ask ? "R297 asks" : "R297 chatter")), 500);
                    read.set(message.id, NH.noticeEntries().filter(entry => entry.text.includes(message === ask ? "R297 asks" : "R297 chatter")).map(entry => [entry.source, entry.author ?? null]));
                }
                askLink = NH.noticeEntries().filter(entry => entry.text.includes("R297 asks")).map(entry => [entry.messageId, entry.link?.messenger ?? null]);
            }
        } finally {
            delete game.messages.get;
            for (const card of document.querySelectorAll(".drpg-popup")) {
                const notice = NH.noticeEntries().find(entry => entry.id === card.dataset.drpgNotice);
                if (byId.has(card.dataset.drpgMessage) || /R297 (asks|chatter)/.test(notice?.text ?? "")) {
                    card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
                }
            }
            NH.holdNoticeHistory(false);
        }
        must(read.has("R297GmAskCard001"), `the GM has ${player.name}'s conversation open - the messenger's card would append to it, not be drawn`);
        equal(JSON.stringify(Object.fromEntries(read)), JSON.stringify({
            R297Announcement: [["public", null]], R297PlayerPublic: [["player", player.id]], R297AskedByPlay1: [["public", player.id]],
            R297WhisperedRec: [], R297GmPopupCard1: [["mine", null]], R297ForcedByGm01: [["mine", null]], R297ForcedByPlay: [],
            R297VeiledNoWord: [], R297KindNoneCard: [], R297GmAskCard001: [["messenger", player.id]], R297ChatterCard1: []
        }), "[a GM's kept entries per card: [source, author]] - the announcement, a player's public card, a GM's card naming a player as asker, "
            + "a whisper of a record, gmPopup, popupForce from a GM and from a player, veiled without words, popupKind none, the messenger's gmAsk and its chatter");
        equal(JSON.stringify(askLink), JSON.stringify([["R297GmAskCard001", player.id]]),
            "[the messenger's gmAsk entry: [its message, the conversation it opens]]");

        /*
         * The direct calls (E81 C4, 12.10.2026; the A7 design's P4-0 and P6-0, the owner's Q4 and Q7), on the same held
         * engine. A request not carried out (`sayNotDone`) is one entry - an error, read, titled as one, its words exactly
         * the toast's - whoever `notify` is; `murder.cleanup` with "nothing spent" is kept like the rest (Q4), and a reason
         * outside the closed list (what a GM's reply could send) puts none of its words in it. The GM's safeword detail
         * (`hearSafeword` from this GM, which posts nothing) is a safeword entry with the room it names; that it is
         * written, so that it is there after a reload, and that no player's browser holds it is scenario 73's S1, on the
         * stored values. The public safeword card (`raiseCard`) is a safeword entry of the frozen sentence alone, which
         * a line the caller's card gains later does not move past the observer's quarter second: the same entry on every
         * browser, naming nobody and no time (the window draws its time of day only - E81 C7). A message appended to an
         * open conversation (a stand-in window in `DrpgMessengerApp.instances`) is no card and keeps nothing. The trial's
         * evidence and the day summary are read in the source with comments blanked: the one passes its source and its
         * message, the other its source. Every card drawn here is taken down at once.
         */
        const { sayNotDone } = await import("./bridge-guards.mjs");
        const S = await import("./safeword.mjs");
        ok(typeof S.raiseCard === "function", "safeword.mjs gives the suite no public card to raise without a chat card");
        const ids = () => new Set(NH.noticeEntries().map(entry => entry.id));
        const since = before => NH.noticeEntries().filter(entry => !before.has(entry.id));
        const direct = {};
        const found = ids();
        await NH.holdNoticeHistory(true);
        try {
            let before = ids();
            const toasts = [];
            const said = sayNotDone("murder.cleanup", "noGm", { nothingSpent: true, notify: text => toasts.push(text) });
            await until(() => since(before).length > 0, 1000);
            direct.cleanup = since(before).map(entry => [entry.kind, entry.source, entry.state, entry.title, entry.text === said && toasts[0] === said, entry.html]);
            before = ids();
            const refused = sayNotDone("vote.cast", "<b>R297 a reply's own words</b>", { notify: () => {} });
            await until(() => since(before).length > 0, 1000);
            direct.refused = since(before).map(entry => [entry.text === refused, entry.text.includes("R297 a reply")]);
            /* A request's name off the list (E81 fix r1-G3; review round 1's O12): a refusal this client is not waiting
               on is said with the GM's packet's `what`, which reached the toast and the history as written. */
            before = ids();
            const unnamed = sayNotDone("<b>R297 a packet's own what</b>", "refused", { notify: () => {} });
            await until(() => since(before).length > 0, 1000);
            direct.unnamed = since(before).map(entry => [entry.text === unnamed, entry.text.includes("R297 a packet"), entry.text.includes(game.i18n.localize("DRPG.Bridge.unnamed"))]);
            before = ids();
            // One kept detail per sender per window (E81 fix r1-G1): a press of this GM's a minute ago is no answer here.
            S.safewordDetails?.delete(game.user.id);
            await S.hearSafeword({ action: S.SAFEWORD_ACTION, room: "R297 room" }, game.user.id);
            direct.detail = since(before).map(entry => [entry.source, entry.kind, entry.title, entry.text.includes("R297 room")]);
            before = ids();
            const line = S.raiseCard();
            const first = since(before)[0] ?? null;
            const more = document.createElement("p");
            more.textContent = "R297 the caller's own line";
            line.after(more);
            await wait(600);
            direct.banner = since(before).map(entry => [entry.source, entry.title, entry.text, entry.html === first?.html]);
            before = ids();
            const appended = [];
            const had = DrpgMessengerApp.instances.get(player.id);
            DrpgMessengerApp.instances.set(player.id, { appendMessage: message => appended.push(message.id) });
            try {
                Hooks.callAll("drpgMessengerMessage", player.id, fake("R297BubbleCard01", { author: player, whisper: [player.id, me], content: "<p>R297 a bubble</p>" }));
                await settle();
            } finally {
                if (had) DrpgMessengerApp.instances.set(player.id, had);
                else DrpgMessengerApp.instances.delete(player.id);
            }
            direct.bubble = [appended, since(before).length];
        } finally {
            for (const card of document.querySelectorAll(".drpg-popup")) {
                if (card.dataset.drpgNotice && !found.has(card.dataset.drpgNotice)) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
            }
            NH.holdNoticeHistory(false);
        }
        const sources = await moduleSources();
        const evidence = bodyOf(stripComments(sources.get("trial.mjs") ?? ""), "if (authorised) showPopup(", { length: 500 });
        const summary = fnSource(stripComments(sources.get("day-summary.mjs") ?? ""), "showDaySummary");
        direct.sources = [/\bsource:\s*"evidence"/.test(evidence) && /\bmessageId:\s*message\.id\b/.test(evidence), /showPopup\([^;]*\bsource:\s*"summary"/.test(summary)];
        const t = key => game.i18n.localize(key);
        equal(JSON.stringify(direct), JSON.stringify({
            cleanup: [["error", "notDone", "read", t("DRPG.Notices.source.notDone"), true, ""]],
            refused: [[true, false]],
            unnamed: [[true, false, true]],
            detail: [["safeword", "error", t("DRPG.Safeword.gmTitle"), true]],
            banner: [["safeword", t("DRPG.Safeword.banner"), t("DRPG.Safeword.announced"), true]],
            bubble: [["R297BubbleCard01"], 0],
            sources: [true, true]
        }), "[sayNotDone's murder.cleanup with its own notify: [kind, source, state, title, the toast's words, html]; a reason off the list: "
            + "[the toast's words, the reply's]; a request's name off the list: [the toast's words, the packet's, the unnamed request's label]; the GM's safeword detail: [source, kind, title, its room]; the public safeword card after the caller's "
            + "line: [source, title, text, the first snapshot]; a bubble in an open window: [appended, kept]; the evidence's source and message, the summary's source]");

        /*
         * NOBODY'S CARDS PUSH ANOTHER ACCOUNT'S ENTRIES OUT (E81 fix r1-G1, 12.10.2026; review round 1's F1, N1, GV1,
         * O10 and O11). The harm both reviews measured at 0697d0f: on a GM, 12 public cards of 7 800 characters from
         * one player took all 5 of the GM's own entries, and a whisper with `gmPopup`, an evidence card, a `gmAsk`
         * card or a safeword card took them uncounted. First the engine over a value in memory, a GM's section and a
         * player's: this account's 5 own entries and a second author's 3, then 30 entries of 7 800 characters from one
         * sender on each of six sources, 160 short ones from another, and 30 stubs from a third that grow to 7 800 after
         * they are kept (a private card's words landing): every own entry and the second author's stay, and each
         * sender keeps at most 40 entries and a quarter of the section's characters. Then six senders at that bound,
         * more than a section holds: the own entries stay, every sender keeps its newest, the section its budget.
         * Then this GM's held engine through the module's own roads, from one player: 13 public cards, 13 whispers
         * with `gmPopup`, 13 evidence cards and 13 `gmAsk` cards a GM wrote in the player's thread, 7 800 characters
         * each, and 150 public safeword cards raised from the player's chat card; and 20 safeword details with a
         * 7 000-character room from a sender of the suite's own (`showGmDetail`, what `hearSafeword` draws; the
         * window is that sender's, so a run a minute after another measures the same): the GM's own 5 and the second
         * author's 3 stay, each road's newest entry carries its sender, the player keeps at most 40 entries and 25 000
         * characters, the details kept are one and its room 120 characters. The safeword hook's own line - which
         * player's card raised the public one - is read in the source with comments blanked. Last (O11): a plain
         * deletion of an evidence card's and a messenger card's message takes the card off the screen and leaves
         * its entry unread and marked deleted, as C5 made it.
         */
        const SECOND = "SuiteAuthorBbbb2", SENDERS = ["SuiteSenderPppp1", "SuiteSenderQqqq2", "SuiteSenderGggg3"];
        const words = `<p>${"x".repeat(7800)}</p>`;
        const weigh = list => list.reduce((n, entry) => n + JSON.stringify(entry).length + 1, 0);
        const engineOf = gm => {
            const eng = noticeBench(NH.createNoticeEngine, { store: { raw: null, writes: 0, fail: 0 }, user: "SuiteOwnerOoooo1", world: W, gm, at, clock });
            eng.open();
            const put = (more, html = "<p>short</p>") => {
                at.now += 1000;
                return eng.record({ kind: "info", title: "flood", text: "", html, ...more });
            };
            return { eng, put, own: [0, 1, 2, 3, 4].map(() => put({ source: "mine" })) };
        };
        const flood = {}, crowd = {};
        for (const gm of [true, false]) {
            const share = (gm ? 100000 : 200000) / 4;
            const { eng, put, own } = engineOf(gm);
            const second = [0, 1, 2].map(() => put({ source: "player", author: SECOND }));
            const [heavy, many, grown] = SENDERS;
            for (const source of ["public", "player", "mine", "messenger", "evidence", "safeword"]) {
                for (let i = 0; i < 30; i++) put({ source, author: heavy, title: `${source} ${i}` }, words);
            }
            for (let i = 0; i < 160; i++) put({ source: "safeword", author: many });
            const stubs = Array.from({ length: 30 }, () => put({ source: "mine", author: grown }));
            for (const id of stubs) eng.update(id, { html: words });
            const kept = new Set(eng.entries().map(entry => entry.id));
            const of = who => eng.entries().filter(entry => entry.author === who);
            flood[gm ? "gm" : "player"] = [own.every(id => kept.has(id)), second.every(id => kept.has(id)),
                of(heavy).length <= 40 && weigh(of(heavy)) <= share, of(heavy).at(-1)?.title ?? null, of(many).length <= 40, weigh(of(grown)) <= share];

            const six = engineOf(gm);
            const names = Array.from({ length: 6 }, (_, n) => `SuiteCrowdSendr${n}`);
            for (let i = 0; i < 30; i++) for (const author of names) six.put({ source: "public", author, title: `${author} ${i}` }, words);
            const left = new Set(six.eng.entries().map(entry => entry.id));
            crowd[gm ? "gm" : "player"] = [six.own.every(id => left.has(id)),
                names.every(author => six.eng.entries().filter(entry => entry.author === author).at(-1)?.title === `${author} 29`),
                weigh(six.eng.entries()) <= share * 4];
        }

        const P = await import("./popup.mjs");
        const sender = { id: `R297Sender${String(Date.now() % 1e6).padStart(6, "0")}`, name: "R297 sender", isGM: false };
        const fid = (tag, i) => `R297Fl${tag}${String(i).padStart(4, "0")}xxxxx`;
        const flooded = new Map(), road = {}, owned = [], seconds = [];
        const live = ids();
        /* A card this clause drew is closed whether or not it was kept: a repeat of the GM's safeword detail inside
           its window is drawn with `record: false` and carries no notice id. Left on the tile, they stood under R293's
           tail and R298's floor card, which measure the tile on the suite's own cards (the merge of e81-fix1 into
           e81-wip, 12.10.2026: both failed that precondition in the fast set's tiers 0-1, e81run/mergee81fix1). */
        const cardsBefore = new Set(document.querySelectorAll(".drpg-popup"));
        const dismissNew = () => {
            for (const card of document.querySelectorAll(".drpg-popup")) {
                if (!cardsBefore.has(card) || (card.dataset.drpgNotice && !live.has(card.dataset.drpgNotice))) {
                    card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
                }
            }
        };
        const ran = key => {
            const entry = NH.noticeEntries().at(-1) ?? null;
            road[key] = [entry?.source ?? null, entry?.author === player.id];
            dismissNew();
        };
        let bound = null, detail = null, deleted = null, s1 = null;
        must(!Object.hasOwn(game.messages, "get"), "game.messages already answers get for itself - the suite's stand-in would hide it");
        /* The second author and the safeword's sender are users of the suite's own, which this world answers for while
           the clause runs: since E81 fix r2-H1 the history keeps no author that is no user of this world. */
        must(!Object.hasOwn(game.users, "get"), "game.users already answers get for itself - the suite's stand-in would hide it");
        must(!DrpgMessengerApp.instances.has(player.id), `the GM has ${player.name}'s conversation open - the messenger's cards would append to it, not be drawn`);
        await NH.holdNoticeHistory(true);
        const getOf = game.messages.get;
        game.messages.get = function (id, ...rest) { return flooded.get(id) ?? getOf.call(this, id, ...rest); };
        const usersGet = game.users.get, standIns = new Map([SECOND, sender.id].map(id => [id, { id, name: id, isGM: false }]));
        game.users.get = function (id, ...rest) { return standIns.get(id) ?? usersGet.call(this, id, ...rest); };
        const made = (tag, i, more) => {
            const message = fake(fid(tag, i), more);
            flooded.set(message.id, message);
            return message;
        };
        try {
            for (let i = 0; i < 5; i++) owned.push(NH.recordNotice({ source: "mine", kind: "info", title: `R297 own ${i}`, text: "", html: `<p>R297 own ${i}</p>` }));
            for (let i = 0; i < 3; i++) seconds.push(NH.recordNotice({ source: "player", author: SECOND, kind: "info", title: `R297 second ${i}`, text: "", html: "<p>R297 second</p>" }));
            for (let i = 0; i < 13; i++) await onCreateChatMessage(made("P", i, { author: player, content: words }));
            ran("public");
            for (let i = 0; i < 13; i++) await onCreateChatMessage(made("G", i, { author: player, whisper: [me], flags: { gmPopup: true }, content: words }));
            ran("gmPopup");
            for (let i = 0; i < 13; i++) {
                P.showPopup(words, { title: "R297 evidence", kind: "evidence", sticky: true, source: "evidence", messageId: made("E", i, { author: player }).id });
            }
            ran("evidence");
            for (let i = 0; i < 13; i++) {
                const ask = made("A", i, { whisper: [player.id, me], flags: { [MESSENGER_FLAGS.gmAsk]: true }, content: words });
                Hooks.callAll("drpgMessengerMessage", player.id, ask);
                await until(() => NH.noticeEntries().some(entry => entry.messageId === ask.id), 500);
            }
            ran("gmAsk");
            for (let i = 0; i < 150; i++) {
                S.raiseCard(player.id);
                dismissNew();
            }
            ran("banner");
            for (let i = 0; i < 20; i++) S.showGmDetail?.(sender, "r".repeat(7000));
            dismissNew();
            const after = new Set(NH.noticeEntries().map(entry => entry.id));
            const by = who => NH.noticeEntries().filter(entry => entry.author === who);
            bound = [owned.every(id => after.has(id)), seconds.every(id => after.has(id)), by(player.id).length <= 40, weigh(by(player.id)) <= 25000];
            detail = by(sender.id).map(entry => [entry.source, entry.text.includes("r".repeat(120)), entry.text.includes("r".repeat(121))]);

            const evidenceMessage = made("D", 1, { author: player });
            const askMessage = made("D", 2, { whisper: [player.id, me], flags: { [MESSENGER_FLAGS.gmAsk]: true }, content: "<p>R297 a deleted ask</p>" });
            P.showPopup("<p>R297 a deleted evidence card</p>", { title: "R297 evidence", kind: "evidence", sticky: true, source: "evidence", messageId: evidenceMessage.id });
            Hooks.callAll("drpgMessengerMessage", player.id, askMessage);
            await until(() => NH.noticeEntries().some(entry => entry.messageId === askMessage.id), 500);
            const gone = [evidenceMessage.id, askMessage.id];
            const shown = gone.map(id => document.querySelector(`.drpg-popup[data-drpg-message="${id}"]`));
            must(shown.every(Boolean), "the evidence card or the messenger card was not drawn - their deletion would be measured on nothing");
            for (const id of gone) {
                P.onDeleteChatMessage({ id });
                NH.noticeCardDeleted({ id }, {});
            }
            deleted = [shown.map(card => card.classList.contains("leaving")),
                gone.map(id => NH.noticeEntries().filter(entry => entry.messageId === id).map(entry => [entry.source, entry.state, entry.mark]))];

            /*
             * WHOSE A THREAD CARD IS (E81 fix r2-H1, 13.10.2026; review round 2's S1, measured by the security review in
             * the harness at eefa79f: one `gmAsk` card a player wrote naming another player's thread was kept on the GM as
             * that other player's and tagged with their name; 41 of them took that player's own entry; 150, each naming a
             * made-up thread, took all 5 of the GM's own). The `thread` flag is the card's writer's to set. Here the player
             * writes such cards to this GM: one naming the second author's thread is kept under the player; 41 leave the
             * second author's 3 entries; 150 naming threads of no user leave this GM's own 5 and form no holder; and an
             * author that is no user of this world, handed to `recordNotice` directly, is not kept.
             */
            const forge = (tag, i, thread) => {
                const card = made(tag, i, { author: player, whisper: [me], flags: { [MESSENGER_FLAGS.gmAsk]: true }, content: `<p>R297 ${tag} ${i}</p>` });
                Hooks.callAll("drpgMessengerMessage", thread, card);
                return card;
            };
            const keptOf = card => NH.noticeEntries().filter(entry => entry.messageId === card.id);
            const has = id => NH.noticeEntries().some(entry => entry.id === id);
            const one = forge("S", 0, SECOND);
            await until(() => keptOf(one).length > 0, 500);
            s1 = { one: keptOf(one).map(entry => [entry.source, entry.author === player.id, entry.author === SECOND]) };
            dismissNew();
            for (let i = 0; i < 41; i++) {
                const card = forge("T", i, SECOND);
                if (i % 10 === 9 || i === 40) {
                    await until(() => keptOf(card).length > 0, 500);
                    dismissNew();
                }
            }
            s1.second = seconds.every(has);
            const nobody = i => `R297NoUser${String(i).padStart(6, "0")}`;
            for (let i = 0; i < 150; i++) {
                const card = forge("U", i, nobody(i));
                if (i % 10 === 9) {
                    await until(() => keptOf(card).length > 0, 500);
                    dismissNew();
                }
            }
            s1.own = owned.every(has);
            s1.nobody = NH.noticeEntries().filter(entry => String(entry.author ?? "").startsWith("R297NoUser")).length;
            const loose = NH.recordNotice({ source: "player", author: "R297NoSuchUser01", kind: "info", title: "R297 loose", text: "", html: "<p>R297 loose</p>" });
            s1.loose = NH.noticeEntries().filter(entry => entry.id === loose).map(entry => entry.author ?? null);
        } finally {
            delete game.messages.get;
            delete game.users.get;
            dismissNew();
            NH.holdNoticeHistory(false);
        }
        const hook = stripComments(sources.get("safeword.mjs") ?? "");
        equal(JSON.stringify({ flood, crowd, bound, road, detail, hook: /else raiseCard\(message\.author && !message\.author\.isGM \? message\.author\.id : null, message\.id\)/.test(hook), deleted, s1 }), JSON.stringify({
            flood: { gm: [true, true, true, "safeword 29", true, true], player: [true, true, true, "safeword 29", true, true] },
            crowd: { gm: [true, true, true], player: [true, true, true] },
            bound: [true, true, true, true],
            road: { public: ["player", true], gmPopup: ["mine", true], evidence: ["evidence", true], gmAsk: ["messenger", true], banner: ["safeword", true] },
            detail: [["safeword", true, false]],
            hook: true,
            deleted: [[true, true], [[["evidence", "unread", "deleted"]], [["messenger", "unread", "deleted"]]]],
            s1: { one: [["messenger", true, false]], second: true, own: true, nobody: 0, loose: [null] }
        }), "[the engine, a GM's and a player's: [own 5 kept, a second author's 3 kept, a heavy sender within 40 entries and a quarter, its newest, "
            + "160 short within 40, grown stubs within a quarter]; six senders: [own kept, each one's newest, the section within its budget]; "
            + "this GM through the roads: [own 5 kept, a second author's 3 kept, the player within 40 entries, within 25 000 characters]; "
            + "each road's newest [source, carries the player]; the details kept [source, 120 of the room, 121]; the safeword hook passes its card's player and its card (E81 fix r1-G5); "
            + "a plain deletion: [cards closing], [the entries' [source, state, mark]]; E81 fix r2-H1, a player's `gmAsk` cards naming a thread: "
            + "one naming the second author's [source, kept under its writer, under the thread's user], 41 of them leave the second author's 3, "
            + "150 naming no user leave this GM's own 5, the entries kept under no user, an author of no user handed to recordNotice]");
    }],

    ["R473 - the suite leaves this browser's notice history as it found it: held, a notice stays in memory and out of the setting, and the runner compares the setting across tier 2", async () => {
        /*
         * E81 C1, 12.10.2026; the A7 plan's 2.4 and its ledger's V22. The history is this browser's record of what it
         * showed, and the suite shows cards (C3 records them): a tier 2 that wrote its cards into a GM's history would
         * leave them there after the run. On the module's own engine: held, a notice is recorded, kept in memory and
         * not written past the 400 ms debounce; let go, it is forgotten. In tests.mjs with comments blanked: the hold
         * beside the GM store's at the start of tier 2, its release beside the GM store's, and the failing line named
         * "the suite left this browser's notice history as it found it" after it - which is the measurement of a run;
         * this test is what keeps it there.
         */
        /*
         * ON AN ENGINE OF ITS OWN (E81 fix r1-G5, 12.10.2026; review round 1's O3 and N4). It held the module's
         * engine for about 700 ms and read the stored text before the awaited hold, which writes what waits - red
         * on timing, not on the hold (O3 a) - and a real notice drawn in that window was forgotten at the release
         * (O3 b). Now the hold is measured on `noticeBench`'s engine over a value in memory: the text read after the
         * hold, a notice recorded while held kept in memory and never written, forgotten at the release with what
         * was there before kept; and a history kept in memory only (its writes failed) given back whole by the
         * release - at 0697d0f the release read the setting again and the session's history was gone (N4). The
         * module's engine is read by its source alone.
         */
        const NH = await import("./notice-history.mjs").catch(() => null);
        ok(typeof NH?.holdNoticeHistory === "function" && typeof NH.createNoticeEngine === "function", "there is no notice history to hold, and no reading of it across the run");
        const at = { now: 4_000_000 }, clock = { value: { chapter: 1, day: 1, session: 1, timeOfDay: "morning", eclipse: false, seasonStartedAt: 0, resetCuts: {} } };
        const note = title => ({ source: "mine", kind: "info", title, text: title, html: `<p>${title}</p>` });
        const store = { raw: null, writes: 0, fail: 0 };
        const engine = noticeBench(NH.createNoticeEngine, { store, user: "SuitePlayerR47301", world: "suite-world", at, clock });
        engine.open();
        engine.record(note("R473 before"));
        await engine.hold(true);
        const before = store.raw;
        let id = null, held = null;
        try {
            at.now++;
            id = engine.record(note("R473 held"));
            await engine.flush();
            held = [engine.entries().some(entry => entry.id === id), store.raw === before, store.writes];
        } finally {
            engine.hold(false);
        }
        must(id !== null && before !== null, "the hold wrote nothing of what waited, or refused the suite's notice - it would be measured on nothing");
        await engine.flush();
        const released = [engine.entries().map(entry => entry.title), store.raw === before, store.writes];
        const lost = { raw: null, writes: 0, fail: 2 };
        const memory = noticeBench(NH.createNoticeEngine, { store: lost, user: "SuitePlayerR47302", world: "suite-world", at, clock });
        memory.open();
        for (let n = 1; n <= 4; n++) { at.now++; memory.record(note(`R473 memory ${n}`)); }
        await memory.flush();
        at.now++; memory.record(note("R473 memory 5"));
        await memory.hold(true);
        at.now++; memory.record(note("R473 memory held"));
        memory.hold(false);
        const kept = [memory.status().saving, memory.entries().map(entry => entry.title), lost.raw];
        const src = stripComments((await moduleSources()).get("tests.mjs") ?? "");
        const start = bodyOf(src, "gmStoreHold(true);", { length: 2000 });
        const release = bodyOf(src, "gmStoreHold(false);", { length: 700 });
        equal(JSON.stringify([held, released, kept,
            /^gmStoreHold\(true\);\s*await holdNoticeHistory\(true\);\s*noticesFound = noticeHistoryText\(\);/.test(start), /^gmStoreHold\(false\);\s*holdNoticeHistory\(false\);/.test(release),
            /name: "the suite left this browser's notice history as it found it"/.test(release) && /outcome: "fail"/.test(release)]),
            JSON.stringify([[true, true, 1], [["R473 before"], true, 1],
                [false, ["R473 memory 2", "R473 memory 3", "R473 memory 4", "R473 memory 5"], null], true, true, true]),
            "[held: the notice in memory, the stored text as the hold left it, the writes; released and flushed: the entries, the stored text unchanged, the writes; "
            + "kept in memory only, released: saving, the entries, the stored value; "
            + "the runner holds it beside the GM store and reads it; releases it beside the GM store; fails the run on a difference]");
    }],
    ["R294 - a kept notice holds only what a past card may show: what another user's markup carried in is gone through the recorder, from a value written raw into the setting and from a GM's trusted words, and the card's own text stays", async () => {
        /*
         * E81 C2, 12.10.2026; the A7 design's A7-3 (T2); the window's half is C7's, at the end. The harm: a
         * card's body holds what another user wrote - a plain card's `message.content`, which the popup draws uncleaned,
         * a GM's `trusted` private words (secret.mjs returns those as written), a trial's evidence, a day summary's
         * names - and a history keeps it to the season's reset and draws it again. One card body carries every vector
         * of the design's T2 beside its own text, a link, an image, a hint, a roll, a document link, a table cell and
         * the GMs' half of a card, and it is measured on three roads: recorded by the module's own engine on this GM
         * (held, as R473 holds it: the setting is not written), cleaned for a player, and written raw into a value
         * that never passed the recorder (`noticeBench`'s storage, read at `open`) and drawn by `noticeSnapshot`, the
         * window's one road. On each: the card's words kept, and no iframe, script, audio, video, svg, form control or
         * custom element, no `data-*`, `aria-*`, `style`, `srcset`, `for`, `name`, `id` or `on*`, no foreign or
         * `javascript:` address, no class outside `NOTICE_CLASSES`. Then the read's validation (a tone and a kind
         * outside popup.mjs's lists, an id with a quote), `NOTICE_CLASSES` against the `class=` grep it states, and
         * `cleanCardHtml` as secret.mjs's one cleaner, the history's first step. THE CLEANER HERE IS THE HARNESS'S
         * STAND-IN (audit/harness/lib/futil.mjs `cleanHTML`), which keeps `data-*`, classes and buttons: what this
         * measures is the history's own allowlist, which owes nothing to it. Foundry's real `cleanHTML` and a
         * browser's parser are LIVE-E81-01, at a table (the plan's D5: no skip here).
         */
        const NH = await import("./notice-history.mjs").catch(() => null);
        const secret = await import("./secret.mjs");
        must(typeof NH?.recordNotice === "function", "there is no notice history to keep a card in - nothing here would be measured");
        const KEEP = "Suite R294 keeps this text";
        const PNG = "data:image/png;base64,iVBORw0KGgo=";
        const CARD = [
            `<p class="notes">${KEEP}</p>`,
            `<a href="https://example.com/r294">R294 link</a>`,
            `<img src="${PNG}" alt="R294 image">`,
            `<span data-tooltip="R294 &lt;b&gt;hint&lt;/b&gt;">R294 tip</span>`,
            `<a class="inline-roll roll" data-formula="1d20" data-tooltip="1d20"><i class="fas fa-dice-d20"></i>R294 roll</a>`,
            `<a class="content-link" data-link data-uuid="Actor.R294" draggable="true">R294 document</a>`,
            `<table><tbody><tr><td colspan="2" style="color:red">R294 cell</td></tr></tbody></table>`,
            `<div class="drpg-gm-only"><p>R294 GM prose</p></div>`,
            `<iframe srcdoc="&lt;p&gt;R294 framed&lt;/p&gt;" src="https://www.youtube.com/embed/r294"></iframe>`,
            `<span data-tooltip-html="&lt;img src=x onerror=alert(1)&gt;">R294 tooltip html</span>`,
            `<span data-tooltip="" aria-label="&lt;img src=x onerror=alert(2)&gt;">R294 aria</span>`,
            `<audio autoplay src="https://example.com/r294.mp3"></audio>`,
            `<video autoplay poster="https://evil.example/r294.png" src="https://example.com/r294.mp4"></video>`,
            `<p style="position:fixed;inset:0;z-index:99999" id="r294">R294 styled</p>`,
            `<img srcset="https://evil.example/r294-set.png 1x" src="${PNG}">`,
            `<img src="https://evil.example/r294-track.png">`,
            `<img src="r294-missing.png" onerror="globalThis.__drpgR294 = 1">`,
            `<svg onload="globalThis.__drpgR294 = 2"><circle r="1"></circle></svg>`,
            `<a href="javascript:globalThis.__drpgR294 = 3">R294 js link</a>`,
            `<document-embed uuid="JournalEntry.R294"><p>R294 embedded</p></document-embed>`,
            `<label for="r294">R294 label</label>`,
            `<button type="button" data-drpg-call="r294">R294 button</button>`,
            `<form><input name="r294"></form>`,
            `<div data-action="r294" is="r294-div" popover contenteditable="true" autofocus>R294 action</div>`,
            `<p class="drpg-popup application fa-solid notes window-content">R294 classed</p>`,
            `<script>globalThis.__drpgR294 = 4</script><object data="r294"></object><embed src="r294">`
        ].join("");
        const GONE_TAGS = /^(iframe|script|audio|video|svg|object|embed|form|input|label|button|template|style|link|meta)$/;
        const measure = (root, gm) => {
            const all = [...root.querySelectorAll("*")];
            const foreign = el => ["src", "href", "poster"].some(name => /evil\.example|youtube|^\s*javascript:/i.test(el.getAttribute(name) ?? ""));
            return {
                kept: [KEEP, "R294 link", "R294 tip", "R294 roll", "R294 document", "R294 cell", "R294 action", "R294 classed", "R294 js link"]
                    .filter(words => !root.textContent.includes(words)),
                notes: root.querySelectorAll("p.notes").length,
                link: root.querySelector('a[href="https://example.com/r294"]')?.getAttribute("rel") ?? null,
                images: root.querySelectorAll(`img[src="${PNG}"]`).length,
                hint: root.querySelector('[title="R294 hint"]') !== null,
                cell: root.querySelector('td[colspan="2"]') !== null,
                gm: root.textContent.includes("R294 GM prose"),
                tags: all.map(el => el.localName).filter(tag => GONE_TAGS.test(tag) || tag.includes("-")),
                attrs: all.flatMap(el => [...el.attributes].map(attr => attr.name))
                    .filter(name => /^(data-|aria-|on)|^(style|srcset|poster|for|name|id|is|popover|contenteditable|autofocus|draggable)$/.test(name)),
                addresses: all.filter(foreign).length,
                classes: all.flatMap(el => [...el.classList]).filter(name => !(NH.NOTICE_CLASSES ?? []).includes(name) && !(gm && name === "drpg-gm-only")),
                words: ["R294 framed", "R294 embedded", "R294 label", "R294 button"].filter(words => root.textContent.includes(words))
            };
        };
        const expected = gm => ({ kept: [], notes: 2, link: "noopener noreferrer", images: 2, hint: true, cell: true, gm,
            tags: [], attrs: [], addresses: 0, classes: [], words: [] });
        const parsed = html => {
            const template = document.createElement("template");
            template.innerHTML = String(html ?? "");
            return template.content;
        };

        /* The recorder: the module's engine on this GM, held, with the body as a GM's trusted card hands it over. */
        const isGM = Boolean(game.user?.isGM);
        let recorded = null;
        await NH.holdNoticeHistory(true);
        try {
            const id = NH.recordNotice({ source: "mine", kind: "info", title: "R294", text: "R294", html: CARD });
            recorded = NH.noticeEntries().find(entry => entry.id === id) ?? null;
        } finally {
            NH.holdNoticeHistory(false);
        }
        must(recorded !== null, "the history refused the suite's card - the recorder's road would be measured on nothing");
        equal(stableJson(measure(parsed(recorded.html), isGM)), stableJson(expected(isGM)),
            "recorded by the module's engine, a card body kept what another user's markup carried in, or lost its own words");
        ok(typeof NH.noticeSnapshot === "function" && typeof NH.cleanNoticeHtml === "function" && Array.isArray(NH.NOTICE_CLASSES),
            "the history has no cleaning of its own to draw a kept card with");
        equal(stableJson(measure(parsed(NH.cleanNoticeHtml(CARD, { gm: false })), false)), stableJson(expected(false)),
            "cleaned for a player, a card body kept what another user's markup carried in, or the GMs' half of it");

        /* A value written raw into the setting, as another tab or a console can: read through the shape, drawn by the window's road. */
        const W = "suite-world", U = "SuitePlayerR29401", at = { now: 2_000_000 };
        const clock = { value: { chapter: 1, day: 1, session: 1, timeOfDay: "morning", eclipse: false, seasonStartedAt: 0, resetCuts: {} } };
        const entry = (id, more = {}) => ({ id, at: 1_000_000, messageId: null, kind: "info", tone: null, source: "public", state: "read",
            mark: null, title: "R294", text: "R294", html: CARD, clipped: false, clock: {}, ...more });
        const store = { raw: JSON.stringify({ v: 1, sections: { [`${W}.${U}`]: { epoch: NH.noticeEpoch(clock.value), touched: 1, clearedAt: 0, gone: {}, entries: [
            entry("SuiteNoticeR2941"), entry("SuiteNoticeR2942", { tone: "evil" }), entry('SuiteNotice"2943'),
            entry("SuiteNoticeR2944", { kind: "drpg-popup" }), entry("SuiteNoticeR2945", { tone: "hope", kind: "evidence" })
        ] } } }), writes: 0, fail: 0 };
        const bench = noticeBench(NH.createNoticeEngine, { store, user: U, world: W, at, clock });
        bench.open();
        const read = bench.entries();
        equal(JSON.stringify(read.map(e => e.id)), JSON.stringify(["SuiteNoticeR2941", "SuiteNoticeR2945"]),
            "read back, the raw value's entries [a plain one, a hope-toned evidence] beside a tone and a kind outside popup.mjs's lists and an id with a quote");
        const drawn = NH.noticeSnapshot(read[0]?.html ?? "", { gm: false });
        const drawnGm = NH.noticeSnapshot(read[0]?.html ?? "", { gm: true });
        equal(stableJson([drawn.localName, drawn.className, measure(drawn, false), measure(drawnGm, true)]),
            stableJson(["div", "drpg-notice-snapshot", expected(false), expected(true)]),
            "a raw value in the setting, drawn by the window's road, showed what another user's markup carried in");

        /* The lists the read holds an entry to, and the class allowlist against the grep it states. */
        const sources = await moduleSources();
        const popup = stripComments(sources.get("popup.mjs") ?? "");
        const list = name => JSON.parse(bodyOf(popup, `const ${name} = `, { until: ";" }).replace(`const ${name} = `, ""));
        const FORBIDDEN = /^(drpg-popup|drpg-notices-|drpg-corner-tail|application$|window-|inline-roll$|content-link$|fa-)/;
        const grep = new Set();
        for (const file of ["day-summary.mjs", "popup.mjs", "secret.mjs", "messenger-app.mjs", "trial.mjs", "safeword.mjs", "action-rolls.mjs"]) {
            const src = stripComments(sources.get(file) ?? "");
            must(src.length > 0, `${file} was not read - the class grep would be measured on nothing`);
            for (const m of src.matchAll(/class=(["'])/g)) {
                let words = "", depth = 0, quote = null;
                for (const c of src.slice(m.index + m[0].length)) {
                    if (depth === 0 && c === m[1]) break;
                    if (quote) {
                        if (c === quote) { quote = null; words += " "; } else words += c;
                    } else if (depth === 0) {
                        if (c === "{" && words.endsWith("$")) { depth = 1; words = `${words.replace(/\$$/, "")} `; } else words += c;
                    } else if (`"'\``.includes(c)) {
                        quote = c;
                        words += " ";
                    } else if (c === "{") depth++;
                    else if (c === "}") depth--;
                }
                for (const word of words.split(/\s+/)) if (/^[A-Za-z][\w-]*$/.test(word) && !FORBIDDEN.test(word)) grep.add(word);
            }
        }
        equal(stableJson([list("KINDS"), list("TONES")]), stableJson([NH.NOTICE_KINDS, NH.NOTICE_TONES]),
            "the history's closed lists of a card's kind and tone are not popup.mjs's");
        equal(stableJson([[...NH.NOTICE_CLASSES].sort(), NH.NOTICE_CLASSES.filter(name => FORBIDDEN.test(name) || name === "drpg-gm-only")]),
            stableJson([[...grep].sort(), []]),
            "NOTICE_CLASSES [the class= grep over the files that build card bodies; no frame of a card, a window or an icon]");

        /* One cleaner: secret.mjs's, the history's first step at the write and at the draw, and no innerHTML write in the history. */
        const secretSrc = stripComments(sources.get("secret.mjs") ?? "");
        const history = stripComments(sources.get("notice-history.mjs") ?? "");
        equal(JSON.stringify([
            /\bsanitize\s*\(/.test(secretSrc), /^export function cleanCardHtml\(/m.test(secretSrc),
            /cleaned\.set\(message\.id, cleanCardHtml\(entry\.html\)\)/.test(fnSource(secretSrc, "secretHtml")),
            secret.cleanCardHtml(CARD) === (typeof foundry.utils.cleanHTML === "function" ? foundry.utils.cleanHTML(CARD) : foundry.utils.escapeHTML(CARD)),
            /return inertCopy\(cleanCardHtml\(html\), options\)/.test(fnSource(history, "cleanNoticeHtml")),
            /importNode\(inertTree\(cleanCardHtml\(html\), gm\)\.content, true\)/.test(fnSource(history, "noticeSnapshot")),
            /clean: html => cleanNoticeHtml\(html\)/.test(history),
            /\.innerHTML\s*=(?!=)|\.outerHTML\s*=(?!=)|setHTMLUnsafe|insertAdjacentHTML|createContextualFragment/.test(history)
        ]), JSON.stringify([false, true, true, true, true, true, true, false]),
        "[secret.mjs keeps a cleaner of another name; exports cleanCardHtml; a private card's words go through it; it is Foundry's "
            + "cleanHTML as before; the history keeps inertCopy(cleanCardHtml(html)); draws through both again by importNode; "
            + "the module's engine cleans every record; the history writes markup through innerHTML or its kin]");

        /*
         * WHAT A REFUSED LINK HELD, AN ATTRIBUTE NAME THE DOM REFUSES, AND A GM'S TRUSTED WORDS AS DRAWN (E81 fix r1-G4,
         * 12.10.2026; review round 1's O5, O4 and O6). A link the allowlist refuses is kept as its words: at 0697d0f
         * they were read before its children were cleaned, so a player kept the GMs' half inside one, an svg's text
         * and a style's rules (early C2's reading in the harness's jsdom: "GM SECRET roll"). An element parsed with
         * `is` beside an attribute named `"r294"` threw while it was rebuilt, and the recorder kept the card with an
         * empty body, and the window's road drew it empty (the harness's stand-in cleaner passes that attribute on; whether Foundry's own does is
         * LIVE-E81-01's). Then the road this test's title names: a private card whose words a GM wrote, stored
         * `trusted` (secret.mjs hands those back as written), drawn by the catch-all on this GM - the card shows them
         * as written, and the entry keeps them as the history cleans them, with no handler and no frame. The store is
         * read through a stand-in for `game.settings.get` that adds the one card to what is there, for the length of
         * the clause, and the history is held: nothing is written.
         */
        const LINKS = `<a class="inline-roll"><span class="drpg-gm-only">R294 GM in a roll</span> R294 roll words</a>`
            + `<a href="javascript:void 0"><div class="drpg-gm-only">R294 GM in a js link</div>R294 js words</a>`
            + `<a class="content-link"><svg><desc>R294 svg words</desc></svg><style>.r294-style{}</style>R294 doc words</a>`;
        const linkWords = gm => {
            try {
                const text = parsed(NH.inertCopy(LINKS, { gm })).textContent;
                return ["R294 GM in a roll", "R294 GM in a js link", "R294 roll words", "R294 js words", "R294 svg words", "r294-style", "R294 doc words"]
                    .filter(words => text.includes(words));
            } catch (err) {
                return `threw ${err.name}`;
            }
        };
        const ODD = `<p>R294 before</p><p is="r294-p" "r294"=1>R294 odd names</p>`;
        let odd = null;
        await NH.holdNoticeHistory(true);
        try {
            const id = NH.recordNotice({ source: "mine", kind: "info", title: "R294 odd", html: ODD });
            odd = NH.noticeEntries().find(entry => entry.id === id)?.html ?? null;
        } finally {
            NH.holdNoticeHistory(false);
        }
        equal(JSON.stringify([linkWords(false), linkWords(true), [odd?.includes("R294 before") ?? null, odd?.includes("R294 odd names") ?? null, /\bis=|r294"/.test(odd ?? ""), NH.noticeSnapshot(ODD, { gm: false }).textContent]]),
            JSON.stringify([["R294 roll words", "R294 js words", "R294 doc words"],
                ["R294 GM in a roll", "R294 GM in a js link", "R294 roll words", "R294 js words", "R294 doc words"], [true, true, false, "R294 beforeR294 odd names"]]),
            "[a refused link's words kept for a player; for a GM; a card with an element parsed with `is` and an attribute named \"r294\": "
                + "its first paragraph kept, its own words, an odd attribute kept, and the same written raw and drawn by the window's road]");

        const TRUSTED_ID = "R294TrustedCard1";
        const TRUSTED = `<p>R294 trusted words</p><img src="${PNG}" onerror="void 0"><iframe srcdoc="&lt;p&gt;R294 trusted frame&lt;/p&gt;"></iframe>`;
        const { MESSAGE_FLAG } = await import("./utils.mjs");
        const { onCreateChatMessage } = await import("./popup.mjs");
        const trustedCard = {
            id: TRUSTED_ID, author: game.user, whisper: [], rolls: [], content: secret.STUB,
            flags: { [MODULE_ID]: { [MESSAGE_FLAG]: true, [secret.SECRET_FLAG]: true } },
            getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
        };
        const ownGet = Object.getOwnPropertyDescriptor(game.settings, "get");
        const realGet = game.settings.get;
        let shown = null, keptTrusted = null;
        await NH.holdNoticeHistory(true);
        game.settings.get = function (scope, key, ...rest) {
            const value = realGet.call(this, scope, key, ...rest);
            if (scope !== MODULE_ID || key !== SETTINGS.secretCards) return value;
            return { ...(value ?? {}), [TRUSTED_ID]: { html: TRUSTED, at: Date.now(), user: game.user.id, world: game.world?.id ?? null, trusted: true } };
        };
        secret.forgetSecrets();
        try {
            await onCreateChatMessage(trustedCard);
            shown = document.querySelector(`.drpg-popup[data-drpg-message="${TRUSTED_ID}"] .drpg-popup-body`)?.innerHTML ?? null;
            keptTrusted = NH.noticeEntries().find(entry => entry.messageId === TRUSTED_ID) ?? null;
        } finally {
            if (ownGet) Object.defineProperty(game.settings, "get", ownGet);
            else delete game.settings.get;
            secret.forgetSecrets();
            for (const card of document.querySelectorAll(`.drpg-popup[data-drpg-message="${TRUSTED_ID}"]`)) {
                card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
            }
            NH.holdNoticeHistory(false);
        }
        equal(JSON.stringify([shown?.includes("onerror") ?? null, keptTrusted?.html === NH.cleanNoticeHtml(TRUSTED),
            /onerror|<iframe|R294 trusted frame/.test(keptTrusted?.html ?? "onerror"), keptTrusted?.text ?? null]),
        JSON.stringify([true, true, false, "R294 trusted words"]),
        "[a GM's trusted private words drawn by the catch-all as written; the entry kept them as the history cleans them; "
            + "the entry holds a handler or a frame; its words]");

        /*
         * THE WINDOW (E81 C7, 12.10.2026). The same card recorded on this client (held), opened in the history's
         * window and expanded there: what `.drpg-notice-snapshot` holds is measured as above - the card's words in it
         * (the positive control: a window that drew nothing would pass every count of what is gone) and no `data-*`,
         * `aria-*`, `style` or `on*` under it. The title and the text carry markup of their own and are drawn as the
         * characters they are: text nodes, no element parsed out of them, the characters all there.
         */
        const TITLE = `R294 <img src="r294-title.png" onerror="globalThis.__drpgR294 = 5"> title`;
        const windows = () => [...foundry.applications.instances.values()].filter(app => app.options?.classes?.includes("drpg-window-notices"));
        must(windows().length === 0, "the notice history window is open - close it: the suite measures a window it opened itself");
        // No window is the module's harm, not the environment's: an assertion, so that red first reads it as one.
        const { openNotices } = await import("./notice-history-app.mjs").catch(() => ({}));
        ok(typeof openNotices === "function", "there is no notice history window (notice-history-app.mjs) to draw a kept card in");
        let win = null, seen = null;
        await NH.holdNoticeHistory(true);
        try {
            const id = NH.recordNotice({ source: "mine", kind: "info", title: TITLE, text: `${TITLE} text`, html: CARD });
            win = await openNotices();
            const details = win?.element?.querySelector(`details.drpg-notice-entry[data-drpg-key="${CSS.escape(id ?? "")}"]`) ?? null;
            must(details !== null, "the window did not list the suite's card - its snapshot would be measured on nothing");
            details.open = true;
            await until(() => details.querySelector(".drpg-notice-snapshot"), 1000);
            const snapshot = details.querySelector(".drpg-notice-snapshot");
            const part = name => details.querySelector(`summary > .drpg-notice-${name}`);
            seen = {
                snapshot: snapshot ? measure(snapshot, isGM) : null,
                title: [part("title")?.textContent === TITLE, part("title")?.querySelectorAll("*").length ?? -1],
                text: [part("text")?.textContent === `${TITLE} text`, part("text")?.querySelectorAll("*").length ?? -1]
            };
        } finally {
            await win?.close();
            NH.holdNoticeHistory(false);
        }
        equal(stableJson(seen), stableJson({ snapshot: expected(isGM), title: [true, 0], text: [true, 0] }),
            "expanded in the window, a kept card showed what another user's markup carried in or lost its own words, or a title or text was parsed as markup");
    }],
    ["R293 - a card is kept as it is drawn: one entry after its body is filled, followed while the card is on screen in either host and not after, closed with the reason its reader or the code gave, and a history error never stops a card; the bottom card's tail follows its words and is never kept", async () => {
        /*
         * E81 C3, 12.10.2026; the A7 design's A7-2 (P3-0..P3-4); the tail clause is E81 C9's (below). On this client's module engine, held as R473 holds it, so nothing reaches the setting: a card
         * drawn by `showPopup` is one entry whose html is the drawn body through the history's cleaning and whose
         * words are read off that html; a change to the body is kept a quarter of a second later, on the corner
         * stack and on the evidence stage (sticky evidence, Objection), and not once the card is gone; `observe: false`
         * keeps the first snapshot; `record: false` and `showWaiting` keep nothing; "+N" on five cards moves no
         * snapshot. The close's reason: the X and a click on the card read, a deletion's "withdrawn", "unseen" with
         * `instant` (gone at once) and the function `showPopup` returns unread. A recorder that throws (a `link`
         * whose read throws) still draws the card. `persist: "session"` on `noticeBench`'s engine: kept in memory,
         * absent from the write. Every card drawn here is taken down at once at the end.
         * The tail (E81 C9, 12.10.2026; the stage's V4): the card at the bottom of the corner tile marks one element of
         * its body for the button's room (`setFloor`, R298 (6)), and the card's observer moves that mark when the
         * words change - with `observe: false` too, the snapshot still frozen. Marking it is no change to the words:
         * a snapshot set by hand on a card that then becomes the floor stays as it was past the quarter second, so
         * the observer did not keep the body again; a real change after it is still kept, through the cleaning, with
         * no class of the corner in it while the body on screen holds one. A sticky evidence card on the evidence
         * stage gets neither class. On the suite's own cards: a card already on the tile is a precondition.
         */
        const NH = await import("./notice-history.mjs").catch(() => null);
        must(typeof NH?.noticeEntries === "function" && typeof NH.holdNoticeHistory === "function", "there is no notice history to read a card back from");
        const { showPopup, showWaiting } = await import("./popup.mjs");
        const isGM = Boolean(game.user?.isGM);
        const drawn = [];
        const newest = () => Array.from(document.querySelectorAll(".drpg-popup"))
            .sort((a, b) => Number(b.dataset.drpgSeq) - Number(a.dataset.drpgSeq))[0] ?? null;
        const entryOf = id => NH.noticeEntries().find(entry => entry.id === id) ?? null;
        const draw = (html, options = {}) => {
            const before = new Set(NH.noticeEntries().map(entry => entry.id));
            const close = showPopup(html, options);
            const card = newest();
            if (card) drawn.push(card);
            const added = NH.noticeEntries().filter(entry => !before.has(entry.id));
            return { close, card, body: card?.querySelector(".drpg-popup-body") ?? null, added, id: added[0]?.id ?? null };
        };
        const kept = id => entryOf(id)?.html ?? null;
        const follows = async (shown, words) => {
            shown.body.insertAdjacentHTML("beforeend", `<p>${words}</p>`);
            return until(() => entryOf(shown.id)?.text.includes(words), 2000);
        };

        await NH.holdNoticeHistory(true);
        try {
            /* One entry, as drawn. */
            const BODY = `<p>R293 kept words</p><p style="color:red">R293 styled</p><div class="drpg-gm-only"><p>R293 GM half</p></div>`;
            const a = draw(BODY, { title: "R293 title", kind: "error", tone: "fear" });
            must(a.card !== null, "showPopup drew no card - the recorder would be measured on nothing");
            const first = entryOf(a.id);
            equal(JSON.stringify([a.added.length, a.card.dataset.drpgNotice === a.id, first?.html === NH.cleanNoticeHtml(a.body.innerHTML),
                first?.html.includes("R293 styled"), first?.text, first?.title, first?.kind, first?.tone, first?.source, first?.state, first?.messageId]),
            JSON.stringify([1, true, true, true, isGM ? "R293 kept words R293 styled R293 GM half" : "R293 kept words R293 styled",
                "R293 title", "error", "fear", "mine", "open", null]),
            "[entries a card adds; the card names its entry; the html is the drawn body cleaned; it holds the body's words; "
                + "the text read off the kept html; title, kind, tone; no chat card: mine; open; no message]");

            /* Followed on the corner stack and on the evidence stage, and not after the card is gone. */
            const evidence = draw("<p>R293 evidence</p>", { kind: "evidence", sticky: true });
            const objection = draw("<p>R293 objection</p>", { kind: "objection", sticky: true });
            const hosts = [a, evidence, objection].map(shown => shown.card?.parentElement?.id ?? null);
            must(hosts.join() === "drpg-popups,drpg-evidence,drpg-evidence", `the cards stood in ${hosts.join(", ")}`);
            const followed = [await follows(a, "R293 later"), await follows(evidence, "R293 evidence later"), await follows(objection, "R293 objection later")];
            equal(JSON.stringify([followed, kept(a.id) === NH.cleanNoticeHtml(a.body.innerHTML)]), JSON.stringify([[true, true, true], true]),
                "[a body's change kept within 2 s on the corner stack, sticky evidence and Objection on the evidence stage; the kept html the body cleaned again]");

            /* The reasons, and "unseen" with `instant` taken down at once. */
            const reasons = {};
            const x = draw("<p>R293 closed by X</p>");
            x.card.querySelector(".drpg-popup-close").click();
            reasons.x = entryOf(x.id)?.state;
            const clicked = draw("<p>R293 clicked</p>");
            clicked.card.click();
            reasons.click = entryOf(clicked.id)?.state;
            const withdrawn = draw("<p>R293 withdrawn</p>");
            withdrawn.card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { reason: "withdrawn" } }));
            reasons.withdrawn = entryOf(withdrawn.id)?.state;
            const code = draw("<p>R293 closed by code</p>");
            code.close();
            reasons.code = entryOf(code.id)?.state;
            evidence.card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { reason: "unseen", instant: true } }));
            reasons.unseen = [entryOf(evidence.id)?.state, evidence.card.isConnected];
            equal(JSON.stringify(reasons), JSON.stringify({ x: "read", click: "read", withdrawn: "unread", code: "unread", unseen: ["unread", false] }),
                "[the state a close leaves per reason: the X, a click on the card, a deletion's event, the returned function; unseen and instant: unread and off the page at once]");
            const gone = kept(evidence.id);
            evidence.body.insertAdjacentHTML("beforeend", "<p>R293 after the card left</p>");
            const frozen = draw("<p>R293 frozen</p>", { observe: false });
            const firstFrozen = kept(frozen.id);
            frozen.body.insertAdjacentHTML("beforeend", "<p>R293 frozen later</p>");
            await wait(600);
            equal(JSON.stringify([kept(evidence.id) === gone, kept(frozen.id) === firstFrozen, firstFrozen?.includes("R293 frozen")]), JSON.stringify([true, true, true]),
                "[a card's body changed after it left the page: the snapshot unmoved past 600 ms; observe: false, the first snapshot unmoved; and it was kept]");

            /* What keeps nothing: `record: false`, `showWaiting`; and "+N" moves no snapshot. */
            const unkept = draw("<p>R293 not kept</p>", { record: false });
            const waitingBefore = NH.noticeEntries().length;
            const closeWaiting = showWaiting("R293 waiting");
            const waitingCard = newest();
            if (waitingCard) drawn.push(waitingCard);
            const waitingAdded = NH.noticeEntries().length - waitingBefore;
            closeWaiting();
            const five = [1, 2, 3, 4, 5].map(n => draw(`<p>R293 stacked ${n}</p>`));
            const atDraw = five.map(shown => kept(shown.id));
            must(document.querySelector("#drpg-popups .drpg-popup-more") !== null, "five cards raised no \"+N\" - its snapshot rule would be measured on nothing");
            await wait(600);
            equal(JSON.stringify([unkept.added.length, "drpgNotice" in (unkept.card?.dataset ?? {}), waitingAdded,
                five.map((shown, n) => kept(shown.id) === atDraw[n]), NH.noticeEntries().some(entry => entry.html.includes("drpg-popup-more"))]),
            JSON.stringify([0, false, 0, [true, true, true, true, true], false]),
            "[entries from record: false; its card names one; entries from showWaiting; five stacked cards' snapshots unmoved past 600 ms with \"+N\" up; a kept \"+N\"]");

            /* A history that throws still draws the card. */
            let threw = null, broken = null;
            try {
                broken = draw("<p>R293 drawn anyway</p>", { link: { get messenger() { throw new Error("R293's broken history"); } } });
            } catch (err) {
                threw = err.message;
            }
            equal(JSON.stringify([threw, typeof broken?.close, broken?.body?.textContent ?? null, broken?.added.length ?? null]),
                JSON.stringify([null, "function", "R293 drawn anyway", 0]),
                "[what showPopup threw when the recorder did; what it returned; the card's words; entries kept]");

            /* A kind and a tone off popup.mjs's lists (E81 fix r1-G4; review round 1's O8): kept as the card is
               dressed, "info" and no tone - the normalisation at the recorder, which no clause reached before. */
            const offList = draw("<p>R293 off the lists</p>", { kind: "banana", tone: "loud" });
            equal(JSON.stringify(offList.added.map(entry => [entry.kind, entry.tone])), JSON.stringify([["info", null]]),
                "[the entries a card of kind \"banana\" and tone \"loud\" adds, as [kind, tone]]");
        } finally {
            for (const card of drawn) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
            NH.holdNoticeHistory(false);
        }

        /* The tail (E81 C9): it follows the floor card's words with `observe: false` as well, marking it keeps no
           snapshot again, what is kept carries none of it, and the evidence stage has no floor. */
        const tile = document.getElementById("drpg-popups");
        must(tile !== null && !tile.querySelector(".drpg-popup:not(.leaving):not(.drpg-popup-parked)"),
            "a card is on the notice tile - close it: the tail is measured on the suite's own cards");
        const tails = () => [...tile.querySelectorAll(".drpg-corner-tail, .drpg-corner-tail-block")].map(el => el.dataset.r293 ?? el.localName);
        const tailCards = [];
        let tail = null;
        /* A card that is leaving takes its place off the tile on a timer, and `unparkInto` then marks the floor again: a
           re-pick from there would pass for the observer's (found 12.10.2026 - with the observer's re-pick removed, and
           again with the card not watched at all, this test still came out green, because an earlier card's removal
           landed inside the window). So each reading below waits until nothing is leaving. */
        const settled = () => until(() => tile.querySelector(".drpg-popup.leaving") === null, 4000);
        await NH.holdNoticeHistory(true);
        try {
            const frozen = draw(`<p data-r293="first">R293 tail first</p>`, { observe: false });
            tailCards.push(frozen.card);
            const frozenKept = kept(frozen.id), before = tails();
            await settled();
            frozen.body.insertAdjacentHTML("beforeend", `<ul><li data-r293="later">R293 tail later</li></ul>`);
            const moved = await until(() => tails().join() === "later", 1000);
            await wait(400);
            tail = { frozen: [before, moved, kept(frozen.id) === frozenKept && Boolean(frozenKept?.includes("R293 tail first"))] };
            frozen.close({ instant: true });

            const older = draw("<p>R293 older</p>"), newer = draw(`<p data-r293="newer">R293 newer</p>`);
            tailCards.push(older.card, newer.card);
            await wait(400);
            NH.updateNotice(newer.id, { html: "<p>R293 marker</p>" });
            const marker = kept(newer.id);
            older.close();
            tail.handed = [newer.card?.classList.contains("drpg-popup-floor") ?? false, tails()];
            await wait(600);
            tail.handed.push(kept(newer.id) === marker && Boolean(marker?.includes("R293 marker")));
            await settled();
            newer.body.insertAdjacentHTML("beforeend", `<p data-r293="newest">R293 newest</p>`);
            tail.handed.push(await until(() => entryOf(newer.id)?.text.includes("R293 newest"), 2000),
                await until(() => tails().join() === "newest", 1000), /drpg-corner-tail|drpg-popup-floor/.test(kept(newer.id) ?? "drpg-corner-tail"));

            const proof = draw("<p>R293 tail evidence</p>", { kind: "evidence", sticky: true });
            tailCards.push(proof.card);
            tail.evidence = [proof.card?.parentElement?.id ?? null,
                document.querySelectorAll("#drpg-evidence :is(.drpg-popup-floor, .drpg-corner-tail, .drpg-corner-tail-block)").length];
        } finally {
            for (const card of tailCards) card?.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
            NH.holdNoticeHistory(false);
        }
        equal(JSON.stringify(tail), JSON.stringify({ frozen: [["first"], true, true], handed: [true, ["newer"], true, true, true, false], evidence: ["drpg-evidence", 0] }),
            "[observe: false - the tail as drawn, on a list added to it within 1 s, the first snapshot unmoved; the older of two closed - the newer is the floor at once, "
                + "its tail, a snapshot set by hand unmoved 600 ms after its tail was marked, a real change still kept within 2 s, its tail picked again on the new words, "
                + "the kept html holding a tail class or the floor class; the evidence stage - where the card stood, floor and tail classes in it]");

        /* `persist: "session"`: this page keeps it, the write leaves it out; and showPopup hands it on. */
        const store = { raw: null, writes: 0, fail: 0 }, at = { now: 3_000_000 };
        const clock = { value: { chapter: 1, day: 1, session: 1, timeOfDay: "morning", eclipse: false, seasonStartedAt: 0, resetCuts: {} } };
        const bench = noticeBench(NH.createNoticeEngine, { store, user: "SuitePlayerR29301", world: "suite-world", at, clock });
        bench.open();
        bench.record({ source: "mine", kind: "info", title: "R293 kept", text: "", html: "<p>kept</p>" });
        at.now++;
        bench.record({ source: "mine", kind: "info", title: "R293 this page", text: "", html: "<p>this page</p>", persist: "session" });
        await bench.flush();
        const popup = stripComments((await moduleSources()).get("popup.mjs") ?? "");
        equal(JSON.stringify([bench.entries().map(entry => entry.title), JSON.parse(store.raw)?.sections?.["suite-world.SuitePlayerR29301"]?.entries?.map(entry => entry.title),
            /recordNotice\(\{[^}]*\bpersist\b/.test(fnSource(popup, "showPopup"))]),
        JSON.stringify([["R293 kept", "R293 this page"], ["R293 kept"], true]),
        "[this page's entries; the written ones; showPopup hands its persist to recordNotice]");

        /*
         * Two tabs of one login (E81 fix r1-G5; review round 1's N3, measured there at 0697d0f): the same card drawn
         * in both, closed in the older - its X reached nothing, the merge had kept the newer tab's copy, and the
         * history said "open"; the same day summary drawn in both was kept twice. And the safeword's banner, which
         * every tab raises from one chat card, now names that card to the history and stays when it is deleted.
         */
        const shared = { raw: null, writes: 0, fail: 0 }, U2 = "SuitePlayerR29302", KEY2 = `suite-world.${U2}`, MSGS = ["SuiteMessageR293", "SuiteMessageR29B"];
        const tab = () => noticeBench(NH.createNoticeEngine, { store: shared, user: U2, world: "suite-world", at, clock });
        const older = tab(), newer = tab();
        older.open(); newer.open();
        const CARD = messageId => ({ source: "public", kind: "info", title: "R293 both tabs", text: "", html: "<p>R293 both tabs</p>", messageId });
        /* Closed in the older tab before either wrote: the merge keeps the newer copy, with the older one's state. */
        const early = older.record(CARD(MSGS[0]));
        at.now++; const late = newer.record(CARD(MSGS[0]));
        older.update(early, { state: "read" });
        await older.flush(); await newer.flush(); older.external();
        /* Closed in the older tab after the merge: its X reaches the copy kept. */
        at.now++; const mine = older.record(CARD(MSGS[1]));
        at.now++; const theirs = newer.record(CARD(MSGS[1]));
        await older.flush(); await newer.flush(); older.external();
        const closed = older.update(mine, { state: "read" });
        await older.flush(); newer.external();
        /* The newer tab's cards then close by code: what was read stays read. */
        newer.update(late, { state: "unread" });
        newer.update(theirs, { state: "unread" });
        await newer.flush();
        const states = MSGS.map(id => (JSON.parse(shared.raw)?.sections?.[KEY2]?.entries ?? []).filter(entry => entry.messageId === id).map(entry => entry.state));
        older.external();
        const SUMMARY = { source: "summary", kind: "info", title: "R293 summary", text: "R293 the day", html: "<p>R293 the day</p>" };
        at.now++; older.record(SUMMARY);
        at.now++; newer.record(SUMMARY);
        await older.flush(); await newer.flush(); older.external(); await older.flush();
        const both = JSON.parse(shared.raw)?.sections?.[KEY2]?.entries ?? [];
        let banner = null;
        await NH.holdNoticeHistory(true);
        try {
            const S = await import("./safeword.mjs");
            const had = new Set(NH.noticeEntries().map(entry => entry.id));
            S.raiseCard(null, "SuiteSafeword293");
            const card = newest();
            banner = [NH.noticeEntries().filter(entry => !had.has(entry.id)).map(entry => [entry.source, entry.messageId]), card?.dataset.drpgMessage ?? null];
            card?.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
        } finally {
            NH.holdNoticeHistory(false);
        }
        equal(JSON.stringify([closed, states, MSGS.map(id => both.filter(entry => entry.messageId === id).map(entry => entry.state)), both.filter(entry => entry.source === "summary").length,
            older.entries().filter(entry => entry.source === "summary").length, banner]),
        JSON.stringify([true, [["read"], ["read"]], [["read"], ["read"]], 1, 1, [[["safeword", "SuiteSafeword293"]], null]]),
        "[the older tab's X after the merge moved the copy kept; each card's kept states (closed before the merge, after it) as the newer tab wrote them and at the end; the day summaries kept, written and in the older tab; "
        + "the banner's entries [source, its chat card], the card's data-drpg-message]");
    }],
    ["R295 - a card the module takes back leaves the notice history, any other deletion leaves its entry marked deleted, and a Reroll or a ruling marks an entry without moving what it showed", async () => {
        /*
         * E81 C5, 12.10.2026; the A7 design's A7-4 (P5-0, P5-1, T3). A notice was a copy of a chat card, and the card
         * could go after it was shown: the module takes some back (a rerolled action's old outcome, the opening's
         * request once the roll resolved), a GM clears the log, the season's reset deletes it in batches. Before C5 the
         * history kept every one of them as its reader had left it, and the popups' deletion hook closed the card by
         * clicking its X - a reader's close, so a card nobody read was kept as read. Read in the source with comments
         * blanked: the two places that take a card back delete it with the module's withdraw option and no other file
         * passes it (the reset's `deleteMessages` deletes without it); the popups' deletion hook is a named function
         * that clicks nothing, and the history listens on `deleteChatMessage`, `updateChatMessage` and
         * `drpgSecretStored`, which the private-card store calls once a card's words and meta are stored. On this
         * client's module engine, held as R473 holds it: five cards drawn for stand-in chat ids; the withdrawn one is
         * gone from the history and closing, the one deleted without the option is kept, unread and marked deleted, its
         * snapshot unmoved, and so is one deleted with `deleteAll` in the options (Foundry 14.365 takes that out before
         * the hook - the design's reading of Foundry's client-backend.mjs, LIVE-E81-11 at a table - so the rule may
         * not rest on it). `rerolled` and `settled` mark an entry and move neither its snapshot nor its state; a card
         * with neither flag moves nothing, and a deleted entry keeps its mark. On `noticeBench`'s engine: an entry whose
         * chat card is not in the log when the page opens is marked deleted, one whose card is there is not, and an
         * engine that cannot read the log marks nothing; a withdrawn entry does not come back from another tab's copy.
         * The handlers are called directly with stand-in messages, not through `Hooks.callAll`: a tier-1 test
         * writes nothing, and every other module's deletion hook would be handed a document that is not one.
         * A real deletion, withdrawn or cleared, on four browsers: 73-notice-history B and 13-murder-signals.
         * ONLY A GM'S (E81 fix r1-G3, 12.10.2026; review round 1's O13, O14 and F2): at C5 the withdraw option was
         * honoured from any deleter and a mark read off the card whoever wrote it, and this test passed no user, so
         * it never asked who may do either. Each hook's handler is read off `registerNoticeHistory` now and called
         * with the user Foundry hands the hook: this client, a GM, and a player (the world's first, or an id no user
         * has where the world holds none - not a GM either way). A player's withdraw leaves the entry marked deleted;
         * a player's update that sets `settled` or `rerolled`, and a GM's that sets neither on a card that carries
         * one, mark nothing; and a private card's words stored with a mark on its document and none in its meta mark
         * nothing. A player's own card on four browsers, its withdraw, its update and its meta: 73-notice-history G3.
         */
        const NH = await import("./notice-history.mjs").catch(() => null);
        must(typeof NH?.noticeEntries === "function" && typeof NH.holdNoticeHistory === "function", "there is no notice history to read a deletion back from");
        const P = await import("./popup.mjs");
        const sources = await moduleSources();
        const code = file => stripComments(sources.get(file) ?? "");
        const WITHDRAW = /messages\.get\([^)]*\)\?\.delete\(\{\s*\[MODULE_ID\]:\s*\{\s*withdraw:\s*true\s*\}\s*\}\)/;
        const sites = [["murder-rules.mjs", "undoLastCrisis"], ["incident-store.mjs", "retireOpeningNotices"]]
            .map(([file, fn]) => WITHDRAW.test(fnSource(code(file), fn)));
        const passing = [...sources.keys()].filter(file => file.endsWith(".mjs") && !file.startsWith("tests") && /\bwithdraw:\s*true\b/.test(code(file))).sort();
        equal(JSON.stringify([sites, passing, /\bwithdraw\b/.test(fnSource(code("season-setup.mjs"), "deleteMessages"))]),
            JSON.stringify([[true, true], ["incident-store.mjs", "murder-rules.mjs"], false]),
            "[undoLastCrisis and retireOpeningNotices delete with the withdraw option; the files that pass it; the reset's batches pass it]");
        const popups = fnSource(code("popup.mjs"), "registerPopups"), history = fnSource(code("notice-history.mjs"), "registerNoticeHistory");
        const remember = fnSource(code("secret.mjs"), "remember");
        const HOOKS = ["deleteChatMessage", "updateChatMessage", "drpgSecretStored"];
        const on = Object.fromEntries(HOOKS.map(hook => [hook, NH[new RegExp(`Hooks\\.on\\("${hook}", (\\w+)\\)`).exec(history)?.[1] ?? ""]]));
        equal(JSON.stringify([/Hooks\.on\("deleteChatMessage", onDeleteChatMessage\)/.test(popups), /\.click\(\)/.test(popups + fnSource(code("popup.mjs"), "onDeleteChatMessage")),
            HOOKS.map(hook => typeof on[hook] === "function"),
            remember.indexOf('Hooks.callAll("drpgSecretStored", message)') > remember.indexOf("await saving")]),
        JSON.stringify([true, false, [true, true, true], true]),
        "[the popups' deletion hook is onDeleteChatMessage; it clicks a close button; the history's three hooks, each an exported handler; the private-card store tells it after the words are stored]");
        must(game.user?.isGM, "the suite runs on a GM - a GM's deletion and update would be measured as somebody else's");
        const GM = game.user.id, PLAYER = game.users.find(user => !user.isGM)?.id ?? "R295NotAUser0001";

        const ids = { withdrawn: "R295Withdrawn001", deleted: "R295DeletedPlain", cleared: "R295ClearedAll01", rerolled: "R295RerolledCard", settled: "R295SettledCall1",
            playerWithdrawn: "R295PlayerWithdr", playerSettled: "R295PlayerSettld", gmUntouched: "R295GmUntouched1", storedDoc: "R295StoredOnDoc1" };
        const entryOf = messageId => NH.noticeEntries().find(entry => entry.messageId === messageId) ?? null;
        const drawn = [];
        await NH.holdNoticeHistory(true);
        try {
            const cards = {};
            for (const [key, messageId] of Object.entries(ids)) {
                P.showPopup(`<p>R295 ${key} words</p>`, { title: `R295 ${key}`, messageId });
                cards[key] = document.querySelector(`.drpg-popup[data-drpg-message="${messageId}"]`);
                if (cards[key]) drawn.push(cards[key]);
            }
            must(Object.values(ids).every(entryOf) && drawn.length === 9, "the nine stand-in cards were not drawn and kept - the deletions would be measured on nothing");
            const before = Object.fromEntries(Object.entries(ids).map(([key, messageId]) => [key, entryOf(messageId).html]));

            P.onDeleteChatMessage({ id: ids.withdrawn });
            on.deleteChatMessage({ id: ids.withdrawn }, { [MODULE_ID]: { withdraw: true } }, GM);
            P.onDeleteChatMessage({ id: ids.deleted });
            on.deleteChatMessage({ id: ids.deleted }, {}, GM);
            on.deleteChatMessage({ id: ids.cleared }, { deleteAll: true }, GM);
            on.deleteChatMessage({ id: ids.playerWithdrawn }, { [MODULE_ID]: { withdraw: true } }, PLAYER);
            const after = key => {
                const entry = entryOf(ids[key]);
                return entry && [entry.state, entry.mark, entry.html === before[key]];
            };
            equal(JSON.stringify([after("withdrawn"), cards.withdrawn.classList.contains("leaving"), after("deleted"), cards.deleted.classList.contains("leaving"), after("cleared"),
                after("playerWithdrawn")]),
                JSON.stringify([null, true, ["unread", "deleted", true], true, ["unread", "deleted", true], ["unread", "deleted", true]]),
                "[the withdrawn card's entry; its card closing; the plain deletion's entry; its card closing; the entry of a deletion with deleteAll; the entry a player's deletion with the withdraw option reached]");

            const flags = more => ({ flags: { [MODULE_ID]: more } });
            const update = (key, more, by = GM, changes = flags(more)) => on.updateChatMessage({ id: ids[key], ...flags(more) }, changes, {}, by);
            const moved = [
                update("rerolled", { rerolled: { from: 3, to: 9, at: 1 } }),
                update("settled", { settled: true }),
                update("withdrawn", { settled: true }),
                update("deleted", { rerolled: { from: 1, to: 2, at: 1 } }),
                update("cleared", { popupTitle: "R295 not a mark" })
            ];
            equal(JSON.stringify([moved, after("rerolled"), after("settled"), after("deleted"), after("cleared")]),
                JSON.stringify([[true, true, false, false, false], ["open", "rerolled", true], ["open", "settled", true], ["unread", "deleted", true], ["unread", "deleted", true]]),
                "[which changes moved an entry; the rerolled entry; the settled one; a deleted one a late Reroll reached; one a flag that is no mark reached]");
            const refused = [
                update("playerSettled", { settled: true }, PLAYER),
                update("playerSettled", { rerolled: { from: 2, to: 12, at: 1 } }, PLAYER),
                update("gmUntouched", { settled: true }, GM, { content: "<p>R295 an edit that sets no mark</p>" }),
                on.drpgSecretStored({ id: ids.storedDoc, ...flags({ secret: true, settled: true, rerolled: { from: 1, to: 2, at: 1 } }) })
            ];
            equal(JSON.stringify([refused, after("playerSettled"), after("gmUntouched"), after("storedDoc")]),
                JSON.stringify([[false, false, false, false], ["open", null, true], ["open", null, true], ["open", null, true]]),
                "[which of a player's settled and rerolled, a GM's edit that sets no mark and a private card's document flags moved an entry; the player's card; the GM's edited card; the private card]");
        } finally {
            for (const card of drawn) card.dispatchEvent(new CustomEvent("drpg-dismiss", { detail: { instant: true } }));
            NH.holdNoticeHistory(false);
        }

        /* At `open`: the log decides what a deletion while the page was closed would have; another tab's copy. */
        const store = { raw: null, writes: 0, fail: 0 }, at = { now: 5_000_000 };
        const clock = { value: { chapter: 1, day: 1, session: 1, timeOfDay: "morning", eclipse: false, seasonStartedAt: 0, resetCuts: {} } };
        const W = "suite-world", U = "SuitePlayerR29501", HERE = "R295MessageHere1", GONE = "R295MessageGone1";
        const card = (title, messageId) => ({ source: "mine", kind: "info", title, text: title, html: `<p>${title}</p>`, messageId });
        const first = noticeBench(NH.createNoticeEngine, { store, user: U, world: W, at, clock });
        first.open();
        first.record(card("R295 here", HERE));
        at.now++;
        first.record(card("R295 gone", GONE));
        await first.flush();
        const marksAtOpen = messageExists => {
            const page = noticeBench(NH.createNoticeEngine, { store, user: U, world: W, at, clock, messageExists });
            page.open();
            return page.entries().map(entry => [entry.title, entry.state, entry.mark]);
        };
        const opened = [marksAtOpen(id => id === HERE), marksAtOpen(undefined)];
        const one = noticeBench(NH.createNoticeEngine, { store, user: U, world: W, at, clock });
        const two = noticeBench(NH.createNoticeEngine, { store, user: U, world: W, at, clock });
        one.open();
        two.open();
        at.now++;
        one.deleted(HERE, { withdraw: true });
        await one.flush();
        await two.flush();
        two.external();
        await two.flush();
        const titles = engine => engine.entries().map(entry => entry.title);
        equal(JSON.stringify([...opened, titles(one), titles(two), JSON.parse(store.raw).sections[`${W}.${U}`].entries.map(entry => entry.title)]),
            JSON.stringify([[["R295 here", "unread", null], ["R295 gone", "unread", "deleted"]], [["R295 here", "unread", null], ["R295 gone", "unread", null]],
                ["R295 gone"], ["R295 gone"], ["R295 gone"]]),
            "[opened beside a log that holds one of the two cards; opened with no log to read; the tab that withdrew; another tab after both wrote; the stored section]");
    }],
    ["R298 - the notice tile has one history button from ready, its last child whatever the stack does, which closes no card and carries only an unread count, with the oldest card shown keeping its corner free, a '+N' that closes every card that is not sticky and, under Monokuma Legacy on a desk, the empty tile following the clock; and the history gives its room back to the module's other stores when the browser's storage is full, and the case's health counts it apart", async () => {
        /*
         * E81 C6, 12.10.2026; the A7 design's A7-7, its store clauses (1e; the stage's V14 and its risk "frees space
         * synchronously on `drpgStorageFull` and is counted apart in the case's health" - the tile's anatomy, the floor
         * card and '+N' are C8, C9 and C11's). One localStorage per origin holds the private cards, every GM store (the
         * Truth Bullet and Remnant ledgers among them), the drawn rolls kept readable and, since E81, a history of up to
         * 500 000 characters: a store that found it full lost its write while the history kept its own. Four parts.
         * (1) The engine over a value in memory (`noticeBench`): `giveWay` writes before it returns - no await between
         * the call and the reading - a value without another world's sections, with this world's other account's
         * section as it was (Q9) and the newer half of this login's; then the budgets are halved for the session, so a
         * player's section filled again keeps 125 entries, not 250; a history that had stopped saving after two failed
         * writes still shrinks what it left stored; under the suite's hold and before `open` it writes nothing.
         * (2) `keepRoom`: a QuotaExceededError fires `drpgStorageFull` before it answers true, any other error fires
         * nothing and answers false - under the module's own hold, so this client's history gives back nothing.
         * (3) The GM store's engine on fakes, as R186 builds it: a write that finds the storage full once is written on
         * the second try with no notice; full twice, one more try only and the notice; another error, no second try.
         * (4) In the source with comments blanked: the private cards' `write` and `keepReadable` ask `keepRoom` and set
         * their setting once more, gm-stores.mjs hands `keepRoom` to the engine, the history listens on
         * `drpgStorageFull` and the case's health has its info row; and `gmStoreStatus` over a stand-in storage counts
         * the history's key in `notices`, not in `total`. What a browser's quota counts is not measured here: the
         * lengths are JSON's. A real full storage, jsdom's: 61-gmstore-case X.
         * (5) E81 C8, 12.10.2026; the A7 design's step 7 and the stage's V11 and D3: the tile's button, on this client.
         * One `#drpg-notices-corner` in the whole page, the tile's last child from `ready`, with its anatomy: a button
         * named by the history's title or its unread count, its tooltip that name, no text node, one inert shape with
         * the glyph; the tile `aria-atomic="false"` with the role and the politeness it had. Under the suite's hold the
         * count read, then one, nine and ten unread entries recorded: no badge, "1", "9", "9+", and every change an
         * attribute - a MutationObserver sees no node and no text arrive, and no entry's words reach the button. Five
         * cards, each prepended, the stack parking what does not fit and saying "+N", and one closed by its X: the same
         * node last after each. A card that closes on any click survives an Enter and a click on the button; the click
         * opens the window, a second click raises it rather than opening another, and closing it takes the badge away.
         * Last, in the source with comments blanked: `ready` builds the tile through `safely` before the narrow layout
         * and the accessibility sweep (so a tile that throws stops neither), `container()` builds it when the host is
         * missing, and the button's count is read through `noticeUnread` and nothing that carries an entry's words.
         * Where the button stands and how its focus ring falls need a layout: R299 (b).
         * (6) E81 C9, 12.10.2026; the A7 design's P7-5 and the stage's V12: the card at the bottom of the tile - the
         * oldest shown, the newest going on top - is marked `drpg-popup-floor` and one element of its body the tail,
         * which the stylesheet gives the button's room. Two cards and nothing parked: the floor on the older (so
         * `markParked` sets it before its early return); that one closed by code: the floor and the tail on the other
         * at once, while the first is still leaving (`dismiss`); a card parked: the floor on the oldest card shown and
         * never on the parked one. The tail of a body ending in a sentence after a `<b>`, in text after a `<b>` in a
         * `<p>`, in `div > p` and `ul > li`, past an empty `<p>` and a `<br>`, and the block spacer on the body after
         * a table and a rule; and it follows a list added to the floor card and taken away again (the card's
         * observer). Measured on the suite's own cards, so a card already on the tile is a precondition. Whether the
         * text then clears the button needs a layout: R299 (b).
         * (7) E81 C10, 12.10.2026; the owner's Q6 and the stage's V18 and D2: under Monokuma Legacy on a desk the
         * button stands alone under the clock, so the tile has to follow the clock and the Despair rail with no card
         * coming. The harm: `top` was measured only when a card came, so a lone button kept the height the widgets had
         * then and stood on the rail once it grew, and a switch from Stained Glass (which clears `top`) left it at the
         * sheet's 96 px until the next card. Headless the harness's `ResizeObserver` never fires, so the suite puts a
         * stand-in of its own on `window` for the reading, gives the clock and the rail boxes of its own
         * (`getBoundingClientRect`, so the numbers are the suite's and not jsdom's zeros), and turns the body's theme
         * classes to Legacy and back, firing `drpgThemeApplied` as `applyTheme` does: the tile's `top` under the clock
         * with the widgets watched; after the clock grows (the observer's callback, as a browser calls it); after a
         * rail drawn as a new node - a twin of the bar, or a stand-in where there is no bar - and after it grows;
         * after it is taken away with nothing in its place (the last Monokuma gone); and back on Stained Glass, `top` cleared and nothing watched. Everything is
         * put back and the hook fired once more for the theme as it was. Last, in the stylesheets and the source:
         * the empty Legacy desk tile's box and its place under the window layer, the hide rule on a stacked screen,
         * `applyTheme` firing the hook after it has set the classes, and `ensureNoticeTile` binding the watch from
         * `ready`. Where the tile and the button then stand, and over which windows: R299 (b), in a browser.
         * (8) E81 C11, 12.10.2026; the owner's Q2, audit S11-39, the stage's V13 and D6: '+N' closes every card that is
         * not sticky. The harm: '+N' was a label that said "close one to see the next", so a stack that had parked
         * notices cost one X per card. Recorded under the suite's hold, on the suite's own cards: sticky cards only,
         * more than the stack shows - the label as it was, with `moreTip`; then cards that close on any click drawn
         * until one is parked, and a sticky card after them, so two of them wait and '+N' stands on the oldest shown one:
         * a button named by `moreCloseAll`, never by "close one". Pressed (a click of its own, cancelable): the click is
         * cancelled and reaches no card - no card's own click runs -, the parked ones are gone at once and unread, the
         * shown ones leave read, the sticky card stays on screen and open, nothing waits so no '+N' is left, and the
         * history's button counts the two taken down unseen. Last, in the stylesheet: the button's focus ring is the
         * close button's and its target the close button's height with a pointer. How it draws: a browser only.
         * (9) E81 fix r1-G2 (12.10.2026; review round 1's F3, N2 and O17): (1)'s other account of this world is a
         * 10-entry clone that never reaches the halved whole value, so it passed over a give-way that deleted such a
         * section whole (the correctness review's bench: 199 622 characters). Here the other accounts' sections are
         * big enough to cross it - halved after a GM's give-way (a: they alone fill it; b: they leave room for part
         * of this login's) and whole at a player's ordinary write (c: they alone fill it; d: room for part) - and
         * each must stay byte for byte, while this login's section is cut to what fits, oldest first, or, where
         * nothing of it fits, is kept in memory with the history no longer saving. And `keepRoom` hears Firefox's
         * older quota error, by its name and by its code 1014. At 27e4b34 all four lost the least recently written
         * other section (r1g2-probe2.mjs, 12.10.2026).
         */
        const NH = await import("./notice-history.mjs").catch(() => null);
        ok(typeof NH?.keepRoom === "function" && typeof NH.createNoticeEngine === "function",
            "the notice history cannot give its room back: a full storage loses a private card or a GM store's row while the history keeps its own");
        const J = JSON.stringify;
        const W = "suite-world", U = "SuitePlayerR29801", KEY = `${W}.${U}`, OTHER = `${W}.SuitePlayerR29802`;
        const at = { now: 7_000_000 }, clock = { value: { chapter: 1, day: 1, session: 1, timeOfDay: "morning", eclipse: false, seasonStartedAt: 0, resetCuts: {} } };
        const card = n => ({ source: "mine", kind: "info", title: `R298 card ${n}`, text: `R298 text ${n}`, html: `<p>R298 card ${n}</p>` });
        const titles = entries => entries.map(entry => entry.title);
        const filled = async (store, n) => {
            const e = noticeBench(NH.createNoticeEngine, { store, user: U, world: W, at, clock });
            e.open();
            for (let i = 1; i <= n; i++, at.now++) e.record(card(i));
            await e.flush();
            return e;
        };
        /* Another world's sections and another account's of this one beside this login's, as another browser wrote them. */
        const crowd = (store, own) => {
            const value = { v: 1, sections: { [KEY]: own } };
            for (const key of ["another-world.SuitePlayerR29801", "third-world.SuitePlayerR29803"]) value.sections[key] = { epoch: "", touched: 1, clearedAt: 0, gone: {}, entries: [], pad: "R298".repeat(500) };
            value.sections[OTHER] = structuredClone(own);
            store.raw = J(value);
            return store.raw.length;
        };

        const store = { raw: null, writes: 0, fail: 0, now: 0 };
        const e = await filled(store, 10);
        const before = crowd(store, JSON.parse(store.raw).sections[KEY]);
        const writes = store.writes;
        const freed = e.giveWay();
        const given = JSON.parse(store.raw);
        const right = [Object.keys(given.sections).sort(), titles(given.sections[KEY].entries), titles(e.entries()), given.sections[OTHER]?.entries.length ?? null,
            store.now, store.writes - writes, freed > 0 && freed === before - store.raw.length];
        for (let i = 1; i <= 300; i++, at.now++) e.record(card(100 + i));
        await e.flush();
        right.push(JSON.parse(store.raw).sections[KEY].entries.length);
        equal(J(right), J([[OTHER, KEY].sort(), ["6", "7", "8", "9", "10"].map(n => `R298 card ${n}`), ["6", "7", "8", "9", "10"].map(n => `R298 card ${n}`), 10,
            1, 0, true, 125]),
            "[the sections left; this login's, stored and in memory; the other account's; written at once; written later; what it answered; a section filled after it]");

        const quiet = { raw: null, writes: 0, fail: 2, now: 0 };
        const stopped = await filled(quiet, 4);
        crowd(quiet, { epoch: NH.noticeEpoch(clock.value), touched: 1, clearedAt: 0, gone: {}, entries: [] });
        const stoppedSaving = stopped.status().saving;
        stopped.giveWay();
        const held = { raw: null, writes: 0, fail: 0, now: 0 };
        const holding = await filled(held, 4);
        const heldRaw = held.raw;
        await holding.hold(true);
        crowd(held, JSON.parse(heldRaw).sections[KEY]);
        const crowded = held.raw;
        const heldAnswer = holding.giveWay();
        const unopened = { raw: heldRaw, writes: 0, fail: 0, now: 0 };
        const shut = noticeBench(NH.createNoticeEngine, { store: unopened, user: U, world: W, at, clock });
        equal(J([stoppedSaving, Object.keys(JSON.parse(quiet.raw).sections).sort(), quiet.now, heldAnswer, held.raw === crowded, held.now, shut.giveWay(), unopened.raw === heldRaw, unopened.now]),
            J([false, [OTHER, KEY].sort(), 1, 0, true, 0, 0, true, 0]),
            "[the history had stopped saving; what it left stored after giving way; written at once; under the hold: the answer, the value, writes; before open: the same]");

        /* (2) keepRoom, under the module's hold: the hook is heard here, and this client's history writes nothing. */
        await NH.holdNoticeHistory(true);
        let heard = 0;
        const hook = Hooks.on("drpgStorageFull", () => { heard++; });
        let asked;
        try {
            const full = NH.keepRoom(new globalThis.DOMException("R298: the suite's full storage", "QuotaExceededError"));
            const heardThen = heard;
            asked = [full, heardThen, NH.keepRoom(new Error("R298: another failure")), NH.keepRoom(undefined), heard];
        } finally {
            Hooks.off("drpgStorageFull", hook);
            await NH.holdNoticeHistory(false);
        }
        equal(J(asked), J([true, 1, false, false, 1]),
            "[a full storage: the answer; the hook heard before it answered; another error; no error; the hook in all]");

        /* (3) The GM store's engine on fakes: its flush asks `keepRoom` and tries once more. */
        const G = await import("./gm-store.mjs");
        const full = () => new globalThis.DOMException("R298: the suite's full storage", "QuotaExceededError");
        const gmStoreWith = async failures => {
            const kept = new Map(), flushes = [], notices = [], asked = [];
            let tries = 0;
            const eng = G.createGmStoreEngine({
                selfId: () => "R298A", isGM: () => true, isPrimary: () => true, worldId: () => "R298WORLD",
                activeGmIds: () => ["R298A"], primaryGmId: () => "R298A", senderIsGM: () => true, userName: u => u, send: () => {},
                storage: { read: k => kept.get(k) ?? null, write: async (k, v) => { tries++; const err = failures.shift(); if (err) throw err; kept.set(k, J(v)); } },
                readLegacy: () => undefined, now: () => 5_000_000,
                timers: { set: fn => { flushes.push(Promise.resolve().then(fn)); return flushes.length; }, clear: () => {} },
                clock: () => ({}), log: { warn: () => {}, error: () => {}, debug: () => {} },
                notify: (level, text) => notices.push(text), text: key => key,
                keepRoom: err => { asked.push(err?.name ?? null); return err?.name === "QuotaExceededError"; }
            });
            const handle = eng.define({ name: "r298", key: "r298Key", kind: "ledger", sync: true, backup: true });
            await handle.patch("x", { v: 1 });
            for (let i = 0; i < 4; i++) await Promise.all(flushes);
            return [tries, asked, kept.has("r298Key"), notices];
        };
        equal(J([await gmStoreWith([full()]), await gmStoreWith([full(), full()]), await gmStoreWith([new Error("R298: another failure")])]),
            J([[2, ["QuotaExceededError"], true, []], [2, ["QuotaExceededError"], false, ["DRPG.GmStore.saveFailedAlone"]],
                [1, ["Error"], false, ["DRPG.GmStore.saveFailedAlone"]]]),
            "[full once; full twice; another error] as [writes tried, what keepRoom was asked, stored, notices]");

        /* (4) The callers in the source, and the case's count. */
        const sources = await moduleSources();
        const code = file => stripComments(sources.get(file) ?? "");
        const count = (text, re) => (text.match(re) ?? []).length;
        const write = fnSource(code("secret.mjs"), "write"), readable = fnSource(code("private-rolls.mjs"), "keepReadable");
        equal(J([/\bkeepRoom\(err\)/.test(write), count(write, /game\.settings\.set\(MODULE_ID, SETTINGS\.secretCards, next\)/g),
            /\bkeepRoom\(err\)/.test(readable), count(readable, /game\.settings\.set\(MODULE_ID, SETTINGS\.readableRolls, all\)/g),
            /configureGmStore\(\{[^}]*\bkeepRoom\b/.test(fnSource(code("gm-stores.mjs"), "openGmStores")),
            /Hooks\.on\("drpgStorageFull", \(\) => \{ engine\.giveWay\(\); \}\)/.test(fnSource(code("notice-history.mjs"), "registerNoticeHistory")),
            /add\("notices", "info", "DRPG\.Case\.row\.notices"/.test(fnSource(code("gm-stores.mjs"), "gmStoreHealth"))]),
            J([true, 2, true, 2, true, true, true]),
            "[the private cards ask keepRoom; and set twice; keepReadable asks; and sets twice; the GM stores are handed keepRoom; the history listens; the health row]");
        const S = await import("./gm-stores.mjs");
        // Any key of the module counts in `total`; a made-up one, because R171 flags a GM store's SETTINGS name read outside the engine.
        const items = [[`${MODULE_ID}.r298-other`, "R298".repeat(25)], [`${MODULE_ID}.${SETTINGS.noticeHistory}`, "R298".repeat(250)], ["another-module.r298", "R298".repeat(125)]];
        const client = { length: items.length, key: i => items[i]?.[0] ?? null, getItem: k => items.find(([key]) => key === k)?.[1] ?? null };
        const status = S.gmStoreStatus(client);
        equal(J([status.total, status.notices]), J([items[0][0].length + 100, items[1][0].length + 1000]),
            "[what the module keeps without its notice history; the history] in a stand-in storage");

        /* (5) The tile's button (E81 C8). */
        const P = await import("./popup.mjs");
        const { plural } = await import("./utils.mjs");
        const tile = typeof P.ensureNoticeTile === "function" ? P.ensureNoticeTile() : null;
        const button = document.getElementById("drpg-notices-corner");
        ok(tile !== null && button !== null, "popup.mjs builds no notice tile with a history button - a closed notice has no way back from the corner");
        must(!document.querySelector(".drpg-window-notices"), "the notice history window is open - close it: the suite measures a window it opened itself");
        const host = document.getElementById("drpg-popups");
        const titleName = game.i18n.localize("DRPG.Notices.title");
        const anatomy = {
            id: button.id, className: button.className, type: button.type, live: button.getAttribute("aria-live"),
            named: Boolean(button.getAttribute("aria-label")), tooltip: button.dataset.tooltip === button.getAttribute("aria-label"),
            kids: [...button.children].map(kid => `${kid.localName}.${kid.className}${kid.hasAttribute("inert") ? "[inert]" : ""}>${[...kid.children].map(el => el.localName).join()}`),
            text: button.textContent
        };
        const region = {
            tile: tile === host, role: host.getAttribute("role"), live: host.getAttribute("aria-live"), atomic: host.getAttribute("aria-atomic"),
            last: host.lastElementChild === button, buttons: document.querySelectorAll("#drpg-notices-corner, .drpg-notices-corner").length,
            inCards: document.querySelectorAll(".drpg-popup .drpg-notices-corner").length
        };
        const badgeAt = () => [button.dataset.unread ?? null, button.getAttribute("aria-label"), button.dataset.tooltip ?? null];
        const records = [], closers = [];
        const watch = new MutationObserver(list => records.push(...list));
        let seen = null, win = null;
        await NH.holdNoticeHistory(true);
        try {
            NH.markNoticesRead();
            const badges = [badgeAt()];
            watch.observe(button, { attributes: true, childList: true, characterData: true, subtree: true });
            const unread = n => {
                for (let i = 0; i < n; i++) {
                    NH.recordNotice({ source: "mine", kind: "info", title: `R298 badge words ${i}`, text: "R298 badge text", html: "<p>R298 badge body</p>", state: "unread" });
                }
                badges.push(badgeAt());
            };
            unread(1);
            unread(8);
            unread(1);
            badges.push(NH.noticeUnread());
            records.push(...watch.takeRecords());
            const changes = { types: [...new Set(records.map(r => r.type))], names: [...new Set(records.map(r => r.attributeName))].sort(),
                words: /R298 badge/.test(button.outerHTML) };

            /* The stack moves its cards and never the button. */
            const stack = [];
            const lastIsButton = () => host.lastElementChild === button && document.getElementById("drpg-notices-corner") === button;
            for (let i = 1; i <= 5; i++) {
                closers.push(P.showPopup(`<p>R298 stack ${i}</p>`, { title: "R298 stack", record: false }));
                stack.push(lastIsButton());
            }
            await wait(150);
            const ours = () => [...host.querySelectorAll(".drpg-popup:not(.leaving)")].filter(card => card.textContent.includes("R298 stack"));
            stack.push(Boolean(host.querySelector(".drpg-popup-more")) && lastIsButton());
            ours()[0]?.querySelector(".drpg-popup-close")?.click();
            const gone = await until(() => ours().length === 4 && [...host.querySelectorAll(".drpg-popup")].every(card => !card.classList.contains("leaving")), 4000);
            stack.push(gone && lastIsButton());
            /* Cards come in by prepend, so the placement line of ensureNoticeTile is reached with cards on the tile only when the
               button has drifted (the first run of this test, 12.10.2026: a mutant that put the button first, and another that put it
               in the newest card, both stayed green for want of this). Moved to the front, asking for the tile again sets it right. */
            host.prepend(button);
            P.ensureNoticeTile();
            stack.push(lastIsButton() && document.querySelectorAll(".drpg-popup .drpg-notices-corner").length === 0);

            /* Pressed: no card closes, one window opens, and closing it reads what it listed. */
            let clicked = 0;
            closers.push(P.showPopup("<p>R298 press</p>", { title: "R298 press", record: false, onClick: () => { clicked++; } }));
            const pressCard = [...host.querySelectorAll(".drpg-popup")].find(card => card.textContent.includes("R298 press"));
            button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
            button.click();
            const opened = await until(() => document.querySelectorAll(".drpg-window-notices").length === 1, 3000);
            button.click();
            await wait(300);
            const press = { clicked, card: Boolean(pressCard?.isConnected) && !pressCard.classList.contains("leaving"), opened,
                windows: document.querySelectorAll(".drpg-window-notices").length, open: button.dataset.unread ?? null, last: lastIsButton() };
            win = [...foundry.applications.instances.values()].find(app => app.options?.classes?.includes("drpg-window-notices")) ?? null;
            await win?.close();
            win = null;
            press.closed = [button.dataset.unread ?? null, NH.noticeUnread(), button.getAttribute("aria-label")];
            seen = { badges, changes, stack, press };
        } finally {
            watch.disconnect();
            await win?.close();
            for (const close of closers) { try { close?.(); } catch { /* already gone */ } }
            NH.holdNoticeHistory(false);
            await wait(400);
            host.querySelectorAll(".drpg-popup").forEach(card => { if (/R298 (stack|press)/.test(card.textContent)) card.remove(); });
        }
        equal(J([anatomy, region]), J([
            { id: "drpg-notices-corner", className: "drpg-notices-corner", type: "button", live: "off", named: true, tooltip: true,
                kids: ["span.drpg-notices-shape[inert]>i"], text: "" },
            { tile: true, role: "status", live: "polite", atomic: "false", last: true, buttons: 1, inCards: 0 }
        ]), "[the button: id, class, type, aria-live, named, its tooltip its name, its children, its text; the tile: what ensureNoticeTile answers, "
            + "role, aria-live, aria-atomic, the button last, buttons on the page, buttons in a card]");
        equal(J(seen), J({
            badges: [[null, titleName, titleName], ...[1, 9, 10].map(n => [n > 9 ? "9+" : String(n), plural("DRPG.Notices.buttonUnread", { n }), plural("DRPG.Notices.buttonUnread", { n })]), 10],
            changes: { types: ["attributes"], names: ["aria-label", "data-tooltip", "data-unread"], words: false },
            stack: [true, true, true, true, true, true, true, true],
            press: { clicked: 0, card: true, opened: true, windows: 1, open: "9+", last: true, closed: [null, 0, titleName] }
        }), "[the badge and the name with nothing unread, then 1, 9 and 10 unread, and the count; what changed on the button and whether an entry's words reached it; "
            + "the button last after each of five cards, after '+N', after a card closed by its X and after it was moved to the front and the tile asked for again; a card's clicks, the window opened, windows after a second click, "
            + "the badge while it is open, the button still last, and the badge, the count and the name after it closes]");

        const ready = bodyOf(code("module.mjs"), 'Hooks.once("ready"', { until: "\n});" });
        // The i18n keys are string literals and name a `.title` of their own: blanked, so only the code is read for an entry's fields.
        const tileFile = code("popup.mjs"), shown = fnSource(tileFile, "showUnread").replace(/"[^"\n]*"/g, '""');
        equal(J([
            /safely\("the notice tile", ensureNoticeTile\);[\s\S]*safely\("the narrow layout", registerNarrow\);[\s\S]*safely\("the interface as something other than a picture", registerA11y\);/.test(ready),
            /\btry \{\s*fn\(\);\s*\} catch\b/.test(fnSource(code("module.mjs"), "safely")),
            /getElementById\(CONTAINER_ID\) \?\? ensureNoticeTile\(\)/.test(fnSource(tileFile, "container")),
            /\bnoticeUnread\(\)/.test(shown), /\bnoticeEntries\b|\.(?:html|text|title)\b|textContent|innerHTML|\.append\(/.test(shown)
        ]), J([true, true, true, true, false]),
            "[ready builds the tile through safely before the narrow layout and the accessibility sweep; safely catches; container() builds the tile when it is missing; "
            + "the badge reads noticeUnread; it reads an entry's words or adds a node]");
        /* (6) The card at the bottom of the tile and its tail (E81 C9). */
        const shownOnTile = () => [...host.querySelectorAll(".drpg-popup:not(.leaving):not(.drpg-popup-parked)")];
        must(shownOnTile().length === 0, "a card is on the notice tile - close it: the floor card is measured on the suite's own cards");
        const floorWords = () => [...host.querySelectorAll(".drpg-popup-floor")].map(card => card.querySelector(".drpg-popup-body")?.textContent.trim() ?? "");
        const tailsNow = () => [...host.querySelectorAll(".drpg-corner-tail, .drpg-corner-tail-block")].map(el =>
            `${el.classList.contains("drpg-popup-body") ? "body" : el.localName}${el.dataset.r298 ? `#${el.dataset.r298}` : ""}${el.classList.contains("drpg-corner-tail-block") ? " block" : ""}`);
        const floorClosers = [], floorSeen = {};
        const drawFloor = html => {
            const close = P.showPopup(html, { title: "R298 floor", record: false });
            floorClosers.push(close);
            return close;
        };
        const SHAPES = {
            sentence: "R298 plain words <b>then bold</b>",
            inline: "<p>R298 words <b>bold</b> and after it</p>",
            nested: "<div><p>R298 first</p><p data-r298=\"last\">R298 last</p></div>",
            list: "<p>R298 lead</p><ul><li>R298 one</li><li data-r298=\"last\">R298 two</li></ul>",
            table: "<p>R298 lead</p><table><tbody><tr><td>R298 cell</td></tr></tbody></table>",
            rule: "<p>R298 lead</p><hr>",
            trailing: "<div><p data-r298=\"last\">R298 words</p><p> </p><br></div>",
            /* E81 fix r2-H2 (review round 2's P10): a wrapper whose only words are not drawn holds no line - the tail is
               the words before it, not a line of its own under the body. */
            hidden: "<p data-r298=\"last\">R298 words</p><div><span style=\"display: none\">R298 not drawn</span></div>"
        };
        try {
            const closeA = drawFloor("<p>R298 floor A</p>"), closeB = drawFloor("<p>R298 floor B</p>");
            floorSeen.two = [host.querySelectorAll(".drpg-popup-parked").length, floorWords(), tailsNow()];
            closeA();
            floorSeen.leaving = [floorWords(), tailsNow()];
            closeB({ instant: true });
            const parking = [];
            for (let i = 1; i <= 6 && !host.querySelector(".drpg-popup-parked"); i++) parking.push(drawFloor(`<p>R298 park ${i}</p>`));
            floorSeen.parked = [Boolean(host.querySelector(".drpg-popup-parked")), floorWords(), host.querySelectorAll(".drpg-popup-floor.drpg-popup-parked").length];
            parking.forEach(close => close({ instant: true }));
            floorSeen.shapes = {};
            for (const [name, html] of Object.entries(SHAPES)) {
                const close = drawFloor(html);
                floorSeen.shapes[name] = tailsNow();
                close({ instant: true });
            }
            const closeC = drawFloor("<p data-r298=\"before\">R298 before</p>");
            const floorBody = host.querySelector(".drpg-popup-floor > .drpg-popup-body");
            const changed = [tailsNow()];
            floorBody?.insertAdjacentHTML("beforeend", "<ul><li data-r298=\"later\">R298 later</li></ul>");
            changed.push(await until(() => tailsNow().join() === "li#later", 1000) && tailsNow());
            floorBody?.querySelector("ul")?.remove();
            changed.push(await until(() => tailsNow().join() === "p#before", 1000) && tailsNow());
            floorSeen.changed = changed;
            closeC({ instant: true });
        } finally {
            for (const close of floorClosers) { try { close({ instant: true }); } catch { /* already gone */ } }
        }
        equal(J(floorSeen), J({
            two: [0, ["R298 floor A"], ["p"]],
            leaving: [["R298 floor B"], ["p"]],
            parked: [true, ["R298 park 2"], 0],
            shapes: { sentence: ["body"], inline: ["p"], nested: ["p#last"], list: ["li#last"], table: ["body block"], rule: ["body block"], trailing: ["p#last"], hidden: ["p#last"] },
            changed: [["p#before"], ["li#later"], ["p#before"]]
        }), "[two cards, nothing parked: cards parked, the floor card's words, the tail; the older closed by code: the floor and the tail at once; a card parked: "
            + "it parked, the floor's words, floors on a parked card; the tail of a body ending in a sentence after a <b>, text after a <b> in a <p>, div > p, ul > li, "
            + "a table, a rule, a <p> followed by an empty <p> and a <br>, and a <p> followed by a <div> whose only words are not drawn; the tail as drawn, after a "
            + "list is added to the floor card and after it is taken away]");

        /* (6b) PARKING COUNTS THE FLOOR'S ROOM (E81 fix r2-H2, review round 2's P9). The stack parks what does not fit by
           adding up the cards' heights (`overflowsGlass`), and the bottom card - the oldest shown - is taller by the
           corner's room. Parking a card, or bringing one back, changes which card that is; read before the new floor
           had its room, the stack fitted and then overflowed by up to that room and a line. Headless nothing has a
           height, so the cards here get one of their own for the reading: 100 px, and 30 more as the floor for the
           one marked tall (as a card whose last line is full grows), in a tile of 215 px and its gap, on a stacked
           screen under Monokuma Legacy (four seats, so it is room, not the seats, that parks). Three cards, the second
           tall: the first parked, then the tall one as the new floor, the third alone; a fourth beside it; the fourth
           closed, and the tall one, the newest parked, back only if it fits as the floor. Then the same three under
           Stained Glass, whose two seats park the first by capacity (`trimStack`) before room is read. Each reading:
           the cards shown, oldest first, and whether they fit as they are classed. The classes and the heights are
           put back synchronously. */
        const PARK_CLASSES = ["drpg-theme-stained-glass", "drpg-theme-monokuma-legacy", "drpg-stacked"];
        const parkWas = PARK_CLASSES.map(name => document.body.classList.contains(name));
        const heightWas = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
        const parkClosers = [], parkSeen = {};
        try {
            document.body.classList.remove(PARK_CLASSES[0]);
            document.body.classList.add(PARK_CLASSES[1], PARK_CLASSES[2]);
            const gap = Number.parseFloat(getComputedStyle(host).rowGap) || 0, room = 215 + gap;
            Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
                configurable: true,
                get() {
                    if (!this.classList.contains("drpg-popup") || !/R298 fit/.test(this.textContent)) return heightWas.get.call(this);
                    return 100 + (this.classList.contains("drpg-popup-floor") && this.querySelector("[data-r298-tall]") ? 30 : 0);
                }
            });
            Object.defineProperty(host, "clientHeight", { configurable: true, get: () => room });
            const draw = html => parkClosers.push(P.showPopup(html, { title: "R298 fit", record: false }));
            const reading = () => {
                const cards = shownOnTile().sort((a, b) => Number(a.dataset.drpgSeq) - Number(b.dataset.drpgSeq));
                const used = cards.reduce((sum, card) => sum + card.offsetHeight, gap * Math.max(0, cards.length - 1));
                return [cards.map(card => card.querySelector(".drpg-popup-body")?.textContent.trim()), used <= room + 1];
            };
            draw("<p>R298 fit A</p>");
            draw("<p data-r298-tall>R298 fit B</p>");
            draw("<p>R298 fit C</p>");
            parkSeen.three = reading();
            draw("<p>R298 fit D</p>");
            parkSeen.four = reading();
            parkClosers.at(-1)({ instant: true });
            parkSeen.closed = reading();
            while (parkClosers.length) parkClosers.pop()({ instant: true });
            document.body.classList.replace(PARK_CLASSES[1], PARK_CLASSES[0]);
            draw("<p>R298 fit A</p>");
            draw("<p data-r298-tall>R298 fit B</p>");
            draw("<p>R298 fit C</p>");
            parkSeen.seats = reading();
        } finally {
            for (const close of parkClosers) { try { close({ instant: true }); } catch { /* already gone */ } }
            delete host.clientHeight;
            Object.defineProperty(HTMLElement.prototype, "offsetHeight", heightWas);
            PARK_CLASSES.forEach((name, i) => document.body.classList.toggle(name, parkWas[i]));
        }
        equal(J(parkSeen), J({ three: [["R298 fit C"], true], four: [["R298 fit C", "R298 fit D"], true], closed: [["R298 fit C"], true], seats: [["R298 fit C"], true] }),
            "[parking with the floor's room counted, a tile of 215 px and its gap, cards of 100 px and the tall one 30 more as the floor: three cards drawn, the "
            + "shown ones and whether they fit; a fourth drawn; the fourth closed and the tall one tried back as the floor; the three again on the Stained Glass "
            + "tile's two seats]");

        /* (7) Monokuma Legacy on a desk: the tile follows the clock with no card (E81 C10). */
        const hudNode = document.getElementById("drpg-hud"), bar = document.getElementById("drpg-despair");
        must(hudNode?.parentElement, "the clock is not on screen - the tile is measured under it");
        /* On `window` and on the global both: the same object in a browser, two in the harness, whose module code reads the global. */
        const realObservers = [window.ResizeObserver, globalThis.ResizeObserver], observers = [];
        window.ResizeObserver = globalThis.ResizeObserver = class {
            constructor(callback) { Object.assign(this, { callback, targets: [], live: true }); observers.push(this); }
            observe(el) { this.targets.push(el); }
            unobserve(el) { this.targets = this.targets.filter(target => target !== el); }
            disconnect() { this.live = false; this.targets = []; }
        };
        const watching = () => observers.filter(observer => observer.live);
        const grow = () => watching().forEach(observer => observer.callback([], observer));
        /* The bar is drawn again as a new node (renderDespairBar's road, or a first bar after ready), then taken away
           with nothing in its place (no Monokuma left): `spot` holds its place until it is put back. */
        const drawn = bar ? bar.cloneNode(false) : Object.assign(document.createElement("div"), { id: "drpg-despair" }), spot = document.createTextNode("");
        const names = new Map([[hudNode, "clock"], [bar, "bar"], [drawn, "drawn"]]);
        const watched = () => watching().flatMap(observer => observer.targets.map(el => names.get(el) ?? "other"));
        const boxed = new Set();
        const boxAt = (el, bottom) => {
            el.getBoundingClientRect = () => ({ x: 0, y: bottom - 40, left: 0, top: bottom - 40, right: 200, width: 200, height: 40, bottom });
            boxed.add(el);
        };
        const THEMES = ["drpg-theme-stained-glass", "drpg-theme-monokuma-legacy"], themeWas = THEMES.map(name => document.body.classList.contains(name));
        const theme = glass => {
            document.body.classList.toggle(THEMES[0], glass);
            document.body.classList.toggle(THEMES[1], !glass);
            Hooks.callAll("drpgThemeApplied");
        };
        const lone = {};
        try {
            boxAt(hudNode, 150);
            if (bar) boxAt(bar, 100);
            theme(false);
            lone.applied = [host.style.top, watched()];
            boxAt(hudNode, 190);
            grow();
            lone.grown = host.style.top;
            boxAt(drawn, 260);
            if (bar) bar.replaceWith(drawn);
            else hudNode.parentElement.append(drawn);
            await until(() => watched().includes("drawn"), 1000);
            lone.drawn = [host.style.top, watched()];
            boxAt(drawn, 280);
            grow();
            lone.drawnGrown = host.style.top;
            drawn.replaceWith(spot);
            await until(() => !watched().includes("drawn"), 1000);
            lone.gone = [host.style.top, watched()];
            theme(true);
            lone.glass = [host.style.top, watching().length];
        } finally {
            [window.ResizeObserver, globalThis.ResizeObserver] = realObservers;
            if (drawn.isConnected) drawn.replaceWith(spot);
            if (spot.isConnected) {
                if (bar) spot.replaceWith(bar);
                else spot.remove();
            }
            for (const el of boxed) delete el.getBoundingClientRect;
            THEMES.forEach((name, i) => document.body.classList.toggle(name, themeWas[i]));
            Hooks.callAll("drpgThemeApplied");
        }
        equal(J(lone), J({
            applied: ["158px", bar ? ["bar", "clock"] : ["clock"]], grown: "198px", drawn: ["268px", ["drawn", "clock"]], drawnGrown: "288px", gone: ["198px", ["clock"]], glass: ["", 0]
        }), `[${bar ? "a Despair bar on screen" : "no Despair bar"}: Legacy from Stained Glass, the tile's top and the widgets watched; the clock grown; a bar drawn as a new node, `
            + "and grown; the bar taken away with nothing in its place; back on Stained Glass, the top and how many observers watch]");
        const styles = await moduleStyles(), EMPTY = String.raw`#drpg-popups:not\(:has\(> \.drpg-popup:not\(\.drpg-popup-parked\)\)\)`;
        const DESK = String.raw`body:not\(\.drpg-theme-stained-glass\):not\(\.drpg-stacked\) `;
        const theming = fnSource(code("settings.mjs"), "applyTheme"), tiling = fnSource(tileFile, "ensureNoticeTile");
        equal(J([
            new RegExp(String.raw`${DESK}#drpg-popups \{[^}]*min-width: min\(27rem, 92vw\);[^}]*min-height: var\(--drpg-corner-room\);`).test(styles),
            new RegExp(String.raw`${DESK}${EMPTY} \{[^}]*z-index: calc\(var\(--z-index-app, 30\) - 1\);`).test(styles),
            new RegExp(String.raw`body\.drpg-stacked ${EMPTY} > #drpg-notices-corner \{[^}]*display: none;`).test(styles),
            theming.lastIndexOf('Hooks.callAll("drpgThemeApplied")') > Math.max(theming.indexOf('"drpg-theme-stained-glass"'), theming.indexOf('"drpg-stacked"')),
            /Hooks\.on\("drpgThemeApplied", watchWidgets\);\s*watchWidgets\(\);/.test(tiling)
        ]), J([true, true, true, true, true]),
            "[the empty Legacy desk tile has a card's width and the corner's height; it stands under the window layer until a card is shown; on a stacked screen "
            + "the button is hidden with no card; applyTheme fires drpgThemeApplied after it sets the classes; ensureNoticeTile listens for it and binds the watch from ready]");

        /* (8) '+N' closes every card that is not sticky (E81 C11). */
        must(shownOnTile().length === 0, "a card is on the notice tile - close it: '+N' is measured on the suite's own cards");
        const moreAt = () => {
            const more = host.querySelector(".drpg-popup-more");
            if (!more) return null;
            const name = more.getAttribute("aria-label");
            return [more.localName, more.getAttribute("type"), more.textContent, more.dataset.tooltip === name ? name : null,
                more.closest(".drpg-popup")?.querySelector(".drpg-popup-body")?.textContent.trim() ?? null];
        };
        const looseClosers = [], drawnLoose = {}, loose = {};
        let looseClicks = 0;
        const drawLoose = (words, options = {}) => {
            looseClosers.push(P.showPopup(`<p>${words}</p>`, { title: "R298 more", ...options }));
            drawnLoose[words] = [...host.querySelectorAll(".drpg-popup")].find(card => card.textContent.includes(words)) ?? null;
        };
        const stateOf = words => NH.noticeEntries().find(entry => entry.id === drawnLoose[words]?.dataset.drpgNotice)?.state ?? null;
        const whereIs = words => {
            const card = drawnLoose[words];
            return !card?.isConnected ? "gone" : card.classList.contains("leaving") ? "leaving" : card.classList.contains("drpg-popup-parked") ? "parked" : "shown";
        };
        await NH.holdNoticeHistory(true);
        try {
            NH.markNoticesRead();
            /* Sticky cards only: the label. */
            for (let i = 1; i <= 6 && !host.querySelector(".drpg-popup-parked"); i++) drawLoose(`R298 sticky ${i}`, { sticky: true });
            loose.label = moreAt();
            /* Closed by code, so unread: read again, so the badge counts what '+N' takes down and nothing else. */
            looseClosers.splice(0).forEach(close => close({ instant: true }));
            NH.markNoticesRead();
            /* Cards that close on any click until one waits, then a sticky one: two wait, '+N' on the oldest shown. */
            for (let i = 1; i <= 6 && !host.querySelector(".drpg-popup-parked"); i++) drawLoose(`R298 loose ${i}`, { onClick: () => { looseClicks++; } });
            drawLoose("R298 stays", { sticky: true });
            const words = Object.keys(drawnLoose).filter(w => /R298 (loose|stays)/.test(w));
            const waiting = words.filter(w => whereIs(w) === "parked"), onScreen = words.filter(w => w !== "R298 stays" && whereIs(w) === "shown");
            must(waiting.length === 2 && onScreen.length >= 1 && whereIs("R298 stays") === "shown",
                `the stack did not park two loose cards with one shown beside the sticky one (${J(words.map(w => [w, whereIs(w)]))}) - '+N' is measured on that stack`);
            loose.button = moreAt();
            const press = new MouseEvent("click", { bubbles: true, cancelable: true });
            host.querySelector(".drpg-popup-more")?.dispatchEvent(press);
            loose.pressed = { cancelled: press.defaultPrevented, clicks: looseClicks, more: moreAt(), badge: button.dataset.unread ?? null, count: NH.noticeUnread() };
            loose.cards = words.map(w => [whereIs(w), stateOf(w)]);
            loose.expected = words.map(w => w === "R298 stays" ? ["shown", "open"] : waiting.includes(w) ? ["gone", "unread"] : ["leaving", "read"]);
        } finally {
            for (const close of looseClosers) { try { close({ instant: true }); } catch { /* already gone */ } }
            NH.holdNoticeHistory(false);
            await until(() => ![...host.querySelectorAll(".drpg-popup")].some(card => card.textContent.includes("R298 ")), 3000);
            host.querySelectorAll(".drpg-popup").forEach(card => { if (/R298 (sticky|loose|stays)/.test(card.textContent)) card.remove(); });
        }
        equal(J(loose), J({
            label: ["span", null, "+1", plural("DRPG.Popup.moreTip", { n: 1 }), "R298 sticky 2"],
            button: ["button", "button", "+2", plural("DRPG.Popup.moreCloseAll", { n: 2 }), "R298 loose 3"],
            pressed: { cancelled: true, clicks: 0, more: null, badge: "2", count: 2 },
            cards: loose.expected ?? [],
            expected: loose.expected ?? []
        }), "[sticky cards only: '+N' as tag, type, text, its tooltip its name, on which card; with loose cards parked: the same; pressed: the click cancelled, "
            + "the cards' own clicks run, '+N' left, the history button's badge and the unread count; each card where it is and its state after, against "
            + "parked: gone and unread, shown: leaving and read, sticky: shown and open]");
        equal(J([
            /\.drpg-popup-close:focus-visible,\s*\.drpg-popup-more:focus-visible,[^{]*\{[^}]*outline: 2px solid var\(--drpg-gold\);/.test(styles),
            /\.drpg-popup-title button\.drpg-popup-more \{[^}]*height: 1\.6rem;[^}]*cursor: pointer;/.test(styles),
            /body\.drpg-theme-stained-glass \.drpg-popup-title :is\(button, i\) \{ color:/.test(styles)
        ]), J([true, true, true]), "[the '+N' button's focus ring is the close button's; its target the close button's height, with a pointer; under Stained Glass its colour the close button's]");

        /* (9) Another account's section of this world, big enough to cross the whole value's budget, and the other quota errors. */
        const big = (touched, chars) => ({ epoch: NH.noticeEpoch(clock.value), touched, clearedAt: 0, gone: {}, entries: [], pad: "R298".repeat(chars / 4) });
        const shared = async (gm, n, others, give) => {
            const lot = { raw: null, writes: 0, fail: 0, now: 0 }, user = gm ? "SuiteGmR29805001" : "SuitePlayerR2985";
            const engine = noticeBench(NH.createNoticeEngine, { store: lot, user, world: W, gm, at, clock });
            engine.open();
            for (let i = 1; i <= n; i++, at.now++) engine.record({ ...card(500 + i), html: `<p>${"x".repeat(7800)}</p>` });
            await engine.flush();
            const value = JSON.parse(lot.raw);
            others.forEach((chars, i) => { value.sections[`${W}.SuiteOtherR2985${i}`] = big(i + 1, chars); });
            value.sections["another-world.SuiteOtherR29859"] = big(0, 4000);
            lot.raw = J(value);
            const theirs = others.map((chars, i) => J(value.sections[`${W}.SuiteOtherR2985${i}`]));
            if (give) engine.giveWay();
            else {
                engine.record(card(599));
                await engine.flush();
            }
            const after = JSON.parse(lot.raw).sections;
            return [theirs.every((text, i) => J(after[`${W}.SuiteOtherR2985${i}`]) === text), Boolean(after["another-world.SuiteOtherR29859"]),
                after[`${W}.${user}`]?.entries.length ?? null, engine.entries().length, engine.status().saving];
        };
        equal(J([await shared(true, 10, [190000, 60000], true), await shared(true, 10, [170000, 40000], true),
            await shared(false, 10, [180000, 180000, 180000], false), await shared(false, 20, [200000, 200000], false)]),
            J([[true, false, 5, 5, false], [true, false, 4, 4, true], [true, true, 10, 11, false], [true, false, 13, 13, true]]),
            "[a GM's give-way, the others fill the halved value; leave room; a player's write, the others fill the value; leave room] as [the other accounts' sections byte for byte, another world's kept, this login's stored, in memory, saving]");
        await NH.holdNoticeHistory(true);
        let heardOther = 0;
        const otherHook = Hooks.on("drpgStorageFull", () => { heardOther++; });
        let firefox;
        try {
            firefox = [NH.keepRoom(new globalThis.DOMException("R298: the suite's full storage", "NS_ERROR_DOM_QUOTA_REACHED")),
                NH.keepRoom(Object.assign(new Error("R298: the suite's full storage"), { code: 1014 })), heardOther];
        } finally {
            Hooks.off("drpgStorageFull", otherHook);
            await NH.holdNoticeHistory(false);
        }
        equal(J(firefox), J([true, true, 2]), "[NS_ERROR_DOM_QUOTA_REACHED by its name; by its code 1014; the hook heard] as a full storage");
    }],
    ["R296 - the notice history window shows a kept card without showing it again: opened and every entry expanded, it plays nothing, draws no card and sends nothing, and it opens only an entry's own thread", async () => {
        /*
         * E81 C7, 12.10.2026; the A7 design's A7-5 (P10-3). The harm: a history that re-issued what it keeps - a
         * sound replayed, a card drawn over the table again, a chat message sent again - would make reading an old
         * notice a new one. Measured on this client, held as R473 holds the history (nothing reaches the setting):
         * three entries recorded (a card body, a messenger message with its thread, an announcement with a title to
         * search for) and opened through `game.drpg.openNotices()`, every entry expanded, the search typed and emptied
         * with Esc, the unread banner's "Mark as read" pressed, Clear asked and refused, then asked and answered, and
         * the window closed and opened again by the tile's corner button (E81 C8), its other way in.
         * Across all of it the sounds started (`AudioHelper.play`, `Sound#play`, any media element's `play`), the
         * `.drpg-popup` cards on the page, the messenger's unread badges and the chat messages about to be created
         * are counted, and none may move. "Open conversation" is pressed with the messenger window's render held, so
         * no thread is drawn or marked read on this client: it asks for the entry's own thread, once. Last, the
         * window's file is read for the roads it must not take, and the keybinding and the API for being there.
         *
         * E81 fix r2-H1 (13.10.2026; review round 2's C2-1, goal V9b and the early review's P1-P3), in the window the
         * button opened: a safeword entry with an author kept draws neither that user's name (in text or in an attribute)
         * nor a time, where a player's entry draws the name; "kolo" finds "Koło"; Esc pressed inside the search's 150 ms
         * wait leaves every entry listed once the wait is over; and a filter whose chip falls to 0 (its one entry
         * withdrawn) draws the list again under "all" at once - with the reader out of the list, with focus on an entry's
         * button, and with focus there and a new entry behind the pill. Red at eefa79f (13.10.2026, once): the name drawn
         * as a tag, "kolo" listing nothing, the search firing on "zzz" under an empty box (0 listed), and the list left
         * under the filter in all three. No time was drawn on the safeword entry there either: that clause is red only
         * with `entryElement`'s condition taken out (measured as a mutant, 13.10.2026).
         */
        const NH = await import("./notice-history.mjs");
        const { DrpgMessengerApp } = await import("./messenger-app.mjs");
        const isGM = Boolean(game.user?.isGM);
        if (isGM) needs(world.atLeast("playerAccounts", 1), "the conversation button needs a player's thread to name");
        const thread = isGM ? game.users.find(user => !user.isGM)?.id : game.user.id;
        ok(typeof game.drpg?.openNotices === "function", "game.drpg.openNotices is not there - there is no notice history window to open");
        must(!document.querySelector(".drpg-window-notices"), "the notice history window is open - close it: the suite measures a window it opened itself");
        must(!DrpgMessengerApp.instances.has(thread), "the thread the suite names is open - close it, or the button would raise it rather than ask for it");

        const plays = [], undo = [];
        const watchCall = (owner, name, label) => {
            if (typeof owner?.[name] !== "function") return;
            const own = Object.hasOwn(owner, name), original = owner[name];
            owner[name] = function (...args) {
                plays.push(label);
                return original.apply(this, args);
            };
            undo.push(() => { if (own) owner[name] = original; else delete owner[name]; });
        };
        watchCall(foundry.audio?.AudioHelper, "play", "AudioHelper.play");
        watchCall(foundry.audio?.Sound?.prototype, "play", "Sound#play");
        watchCall(globalThis.HTMLMediaElement?.prototype, "play", "HTMLMediaElement#play");
        let created = 0;
        const createHook = Hooks.on("preCreateChatMessage", () => { created++; });
        /* Cards are counted by the ones that were not on the page when the test began: an earlier test's card that
         * leaves the page during the test is not a card the window took back (12.10.2026, A2: counting all `.drpg-popup`
         * read 3 before and 2 after in the tier 0/1 run, and passed when R296 ran by name). No card closes on a timer:
         * popup.mjs has none. A dismissed card leaves at its `transitionend`, or at `dismiss`'s backstop `SNAP()` + 1 000 ms
         * after the dismissal; which of the two removed the card that A2 counted was not measured (E81 fix r2-H1, review
         * P4: this said the card "times out"). */
        const cardsBefore = new Set(document.querySelectorAll(".drpg-popup"));
        const page = () => ({
            cards: [...document.querySelectorAll(".drpg-popup")].filter(card => !cardsBefore.has(card)).length,
            badges: [...document.querySelectorAll(".drpg-messenger-badge")].map(badge => badge.textContent).join()
        });
        const before = page();
        const proto = DrpgMessengerApp.prototype, ownRender = Object.hasOwn(proto, "render"), realRender = proto.render;
        const putRenderBack = () => { if (ownRender) proto.render = realRender; else delete proto.render; };
        const { plural } = await import("./utils.mjs");
        const asked = [];
        let win = null, seen = null, dialog = null, ids = [], unreadAt = -1, later = null;
        await NH.holdNoticeHistory(true);
        try {
            must(undo.length > 0, "no audio road of Foundry's to watch here - a sound would go uncounted");
            ids = [
                NH.recordNotice({ source: "mine", kind: "info", tone: "hope", title: "R296 kept card", text: "R296 kept", html: `<p class="notes">R296 kept body</p>`, state: "unread" }),
                NH.recordNotice({ source: "messenger", kind: "info", title: "R296 message", text: "R296 message", html: "<p>R296 message body</p>", link: { messenger: thread } }),
                NH.recordNotice({ source: "public", kind: "info", title: "R296 Gęślą <b>found</b>", text: "R296 announced", html: "", state: "unread" })
            ];
            must(ids.every(Boolean), "the history refused one of the suite's notices - the window would be measured on less");
            unreadAt = NH.noticeEntries().filter(e => e.state === "unread").length;
            win = await game.drpg.openNotices();
            const root = win?.element ?? null;
            ok(root !== null, "game.drpg.openNotices() opened no window");
            const entry = id => root.querySelector(`details.drpg-notice-entry[data-drpg-key="${CSS.escape(id)}"]`);
            const banner = root.querySelector(".drpg-notices-banner");
            const bannerAt = { hidden: banner?.hidden ?? null, text: banner?.querySelector("span")?.textContent ?? "" };
            for (const details of root.querySelectorAll("details.drpg-notice-entry")) details.open = true;
            const expanded = await until(() => ids.every(id => entry(id)?.querySelector(".drpg-notice-more")), 1000);
            const snapshots = ids.map(id => entry(id)?.querySelectorAll(".drpg-notice-snapshot").length ?? -1);
            const inWindow = root.querySelectorAll(".drpg-popup").length;

            /* The search: folded, highlighted by text nodes, and emptied by Esc. */
            const input = root.querySelector(".drpg-notices-search input");
            input.value = "gesla";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            const narrowed = await until(() => root.querySelectorAll("details.drpg-notice-entry").length === 1, 1500);
            const marks = [...root.querySelectorAll(".drpg-notice-title mark")];
            const found = {
                narrowed, listed: [...root.querySelectorAll("details.drpg-notice-entry")].map(d => d.dataset.drpgKey),
                marks: marks.map(mark => mark.textContent), markup: root.querySelectorAll(".drpg-notice-title b, .drpg-notice-title mark *").length
            };
            input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
            found.emptied = [input.value, await until(() => root.querySelectorAll("details.drpg-notice-entry").length >= 3, 1000)];

            /* "Open conversation", once, with the thread's window held from drawing. */
            proto.render = function () { asked.push(this.playerUserId); return Promise.resolve(this); };
            for (const details of root.querySelectorAll("details.drpg-notice-entry")) details.open = true;
            await until(() => entry(ids[1])?.querySelector(".drpg-notice-conversation"), 1000);
            entry(ids[1])?.querySelector(".drpg-notice-conversation")?.click();
            putRenderBack();

            /* Mark as read, then Clear: refused, then answered. */
            root.querySelector('[data-drpg-do="markRead"]')?.click();
            const unreadAfter = NH.noticeEntries().filter(e => ids.includes(e.id) && e.state === "unread").length;
            const realWait = foundry.applications.api.DialogV2.wait;
            const answers = ["cancel", "clear"];
            foundry.applications.api.DialogV2.wait = async config => {
                dialog = (config.buttons ?? []).filter(button => button.default).map(button => button.action);
                return answers.shift();
            };
            try {
                root.querySelector('[data-drpg-do="clear"]')?.click();
                await until(() => answers.length === 1, 1000);
                const keptAfterCancel = NH.noticeEntries().filter(e => ids.includes(e.id)).length;
                root.querySelector('[data-drpg-do="clear"]')?.click();
                await until(() => NH.noticeEntries().length === 0, 1000);
                found.clear = [dialog, keptAfterCancel, NH.noticeEntries().length];
            } finally {
                foundry.applications.api.DialogV2.wait = realWait;
            }

            /* The tile's button opens the same window (E81 C8). */
            await win?.close();
            const corner = document.getElementById("drpg-notices-corner");
            corner?.click();
            const reopened = await until(() => document.querySelectorAll(".drpg-window-notices").length === 1, 3000);
            win = [...foundry.applications.instances.values()].find(app => app.options?.classes?.includes("drpg-window-notices")) ?? win;
            found.button = [Boolean(corner), reopened];
            seen = { banner: bannerAt, expanded, snapshots, inWindow, found, unreadAfter };

            /* E81 fix r2-H1 (13.10.2026): the window's own code, in the window the button opened. */
            const root2 = reopened ? win?.element ?? null : null;
            must(root2 !== null, "the tile's button opened no window - the clauses after it would be measured on nothing");
            const listed = () => [...root2.querySelectorAll("details.drpg-notice-entry")].map(details => details.dataset.drpgKey);
            const entryIn = id => root2.querySelector(`details.drpg-notice-entry[data-drpg-key="${CSS.escape(id)}"]`);
            const pressed = () => root2.querySelector('[data-drpg-filter][aria-pressed="true"]')?.dataset.drpgFilter ?? null;
            const box = root2.querySelector(".drpg-notices-search input");
            const chip = id => root2.querySelector(`[data-drpg-filter="${id}"]`);
            const gmId = game.users.find(user => user.isGM)?.id ?? null;
            const withdraw = messageId => NH.noticeCardDeleted({ id: messageId }, { [MODULE_ID]: { withdraw: true } }, gmId);
            const messenger = messageId => NH.recordNotice({ source: "messenger", kind: "info", title: "R296 Koło", text: "R296 a wheel", html: "", messageId, link: { messenger: thread } });
            const focusIn = async id => {
                if (!entryIn(id)) return null;
                entryIn(id).open = true;
                await until(() => entryIn(id)?.querySelector(".drpg-notice-conversation"), 1000);
                entryIn(id)?.querySelector(".drpg-notice-conversation")?.focus();
                return root2.querySelector(".drpg-notices-list")?.contains(document.activeElement) === true;
            };
            const again = {};
            /* The name of whoever raised a safeword card (review round 2's C2-1) and its time (goal V9b) are drawn nowhere
               on its entry, in text or in an attribute, though the entry keeps its author; a player's entry still draws its
               author's name. */
            const name = game.users.get(thread)?.name ?? null;
            const rest = [
                messenger("R296Withdrawn001"),
                NH.recordNotice({ source: "player", kind: "info", title: "R296 stays", text: "R296 stays", html: "", author: thread }),
                NH.recordNotice({ source: "safeword", kind: "error", title: "R296 safeword", text: "R296 safeword", html: "", author: thread })
            ];
            await until(() => rest.every(id => listed().includes(id)), 1000);
            const said = id => {
                const summary = entryIn(id)?.querySelector(":scope > summary");
                return summary ? [summary.textContent, ...[summary, ...summary.querySelectorAll("*")].flatMap(node => [...node.attributes].map(a => a.value))].join("\n") : null;
            };
            again.named = [NH.noticeEntries().find(e => e.id === rest[2])?.author === thread, said(rest[2])?.includes(name) ?? null,
                Boolean(entryIn(rest[2])?.querySelector(".drpg-notice-time")), said(rest[1])?.includes(name) ?? null];
            /* Polish folding (review P3): "kolo" finds "Koło", the mark on the word as written. */
            box.value = "kolo";
            box.dispatchEvent(new Event("input", { bubbles: true }));
            await until(() => listed().length === 1, 1000);
            again.fold = [listed(), [...root2.querySelectorAll(".drpg-notice-title mark")].map(mark => mark.textContent)];
            /* Esc inside the search's wait (review P1): the wait ends on the emptied box, not on what was typed. */
            box.value = "zzz";
            box.dispatchEvent(new Event("input", { bubbles: true }));
            box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
            await wait(450);
            again.esc = [box.value, listed().length];
            /* An empty search once more, so that a search still standing on "zzz" (the fault the clause above reads)
               is not read again by the clauses below as theirs. */
            box.dispatchEvent(new Event("input", { bubbles: true }));
            await wait(450);
            /* A filter whose chip falls to 0 (review P2): the list is drawn again under "all" - with the reader out of
               the list, with focus in it, and with focus in it and a new entry behind the pill. */
            chip("messenger").click();
            await until(() => listed().length === 1, 1000);
            withdraw("R296Withdrawn001");
            await until(() => listed().length === 2, 1000);
            again.away = [pressed(), listed()];
            const second = messenger("R296Withdrawn002");
            await until(() => listed().includes(second), 1000);
            chip("messenger").click();
            await until(() => listed().length === 1, 1000);
            const focused = await focusIn(second);
            withdraw("R296Withdrawn002");
            await until(() => !listed().includes(second), 1000);
            again.focused = [focused, pressed(), listed()];
            const third = messenger("R296Withdrawn003");
            await until(() => listed().includes(third), 1000);
            chip("messenger").click();
            await until(() => listed().length === 1, 1000);
            const focusedToo = await focusIn(third);
            const fresh = NH.recordNotice({ source: "mine", kind: "info", title: "R296 fresh", text: "R296 fresh", html: "" });
            withdraw("R296Withdrawn003");
            await until(() => listed().includes(fresh), 1000);
            again.pill = [focusedToo, pressed(), listed()];
            later = { again, rest, fresh };
        } finally {
            putRenderBack();
            DrpgMessengerApp.instances.delete(thread);
            await win?.close();
            NH.holdNoticeHistory(false);
            Hooks.off("preCreateChatMessage", createHook);
            for (const put of undo) put();
        }
        equal(stableJson(seen), stableJson({
            banner: { hidden: false, text: plural("DRPG.Notices.unreadBanner", { n: unreadAt }) }, expanded: true, snapshots: [1, 1, 0],
            inWindow: 0, found: { narrowed: true, listed: [ids[2]], marks: ["Gęślą"], markup: 0, emptied: ["", true], clear: [["cancel"], 3, 0], button: [true, true] },
            unreadAfter: 0
        }), "[the unread banner; every entry expanded; a snapshot for each with a body; no card in the window; the search for 'gesla' "
            + "(one entry, highlighted from text, emptied by Esc); Clear (Cancel the default; refused keeps all three; answered empties); "
            + "the tile's button there and opening the window again; Mark as read]");
        const { again = null, rest: [wheel, stays, safeword] = [], fresh = null } = later ?? {};
        equal(stableJson(again), stableJson({
            named: [true, false, false, true], fold: [[wheel], ["Koło"]], esc: ["", 3], away: ["all", [safeword, stays]],
            focused: [true, "all", [safeword, stays]], pill: [true, "all", [fresh, safeword, stays]]
        }), "E81 fix r2-H1: [a safeword entry: [its author kept, the author's name drawn on it, a time drawn on it], a player's entry: the name drawn]; "
            + "[the search 'kolo': the entries listed, the marks]; [Esc inside the search's wait: the box, the entries listed]; a filter whose chip fell to 0: "
            + "[the chip pressed, the entries listed] with the reader out of the list, [focus in the list, ...] with focus in it, and with a new entry behind the pill");
        equal(stableJson({ plays, created, page: page(), asked }), stableJson({ plays: [], created: 0, page: before, asked: [thread] }),
            "[sounds started; chat messages about to be created; the cards and messenger badges on the page; the threads the conversation button asked for]");

        const sources = await moduleSources();
        const app = stripComments(sources.get("notice-history-app.mjs") ?? "");
        must(app.length > 0, "notice-history-app.mjs was not read - its roads would be measured on nothing");
        const register = fnSource(stripComments(sources.get("notice-history.mjs") ?? ""), "registerNoticeHistory");
        equal(JSON.stringify([
            /\bshowPopup\b|\bplaySfx\b|\bChatMessage\b|\.play\(|AudioHelper|innerHTML|outerHTML|insertAdjacentHTML|setHTMLUnsafe|createContextualFragment/.test(app),
            /\bnoticeSnapshot\(entry\.html\)/.test(app), (app.match(/\bopenMessenger\(/g) ?? []).length,
            /game\.keybindings\.register\(MODULE_ID, "noticeHistory", \{[^}]*editable: \[\][^}]*m\.openNotices\(\)/.test(register),
            /openNotices: \(\) => import\("\.\/notice-history-app\.mjs"\)\.then\(m => m\.openNotices\(\)\)/.test(stripComments(sources.get("api.mjs") ?? ""))
        ]), JSON.stringify([false, true, 1, true, true]),
        "[the window takes a road that shows, plays, sends or writes markup; draws a snapshot through the history's road; calls openMessenger once; "
            + "the keybinding noticeHistory, with no default key, opens it; game.drpg.openNotices opens it]");
    }],
    ["R299 - the notice history window fits the screen it opens on: within the screen less 8 px a side, its foot in view with a full history, and no text under 11 px; and the tile's button is square, its focus ring round it, both within the Stained Glass tile, and the bottom card's text clear of it; under Monokuma Legacy on a desk the button stands alone under the clock, below the windows, and on a stacked screen only with a card; the corner's three buttons on their grid as drawn in both themes, the unread badge on the screen and clear of the book; and the GM's roster opened from its button 8 px over it with its right edge, its top on the screen with the camera dock up, and over the notice cards on a stacked screen; and there the notice stack, in both themes, 8 px over the corner's buttons or beside them on a short screen, at narrow.mjs's insets, under the blocks' stack, and what does not fit parked", async () => {
        /*
         * E81 C7, 12.10.2026: clause (e) of the A7 design's A7-8; the corner button's clauses (a-d) come with C8-C13.
         * A window as long as its history would carry its foot - Clear, and what is kept where - off the bottom of the
         * screen; the design's figures are a 393 px phone and a 1366x768 desk with 250 entries. MEASURED AT THE SIZE
         * OF THE BROWSER THAT RUNS THE SUITE, which this test cannot change: at 393 px or at 1366x768 only when that is
         * the browser's size. A full history is recorded (held: nothing reaches the setting; a GM's section keeps 150 of
         * the 250, its budget), the window opened, and read: its box within the screen less 8 px a side and no wider
         * than 420 px, its foot wholly on screen while the list scrolls, and every element that draws text at 11 px or
         * more (the module's floor, `--drpg-text-xs`). Headless there is no layout: skipped, with a row in
         * skip-baseline.json (the plan's D6).
         * (b), E81 C8: the tile's button, on whatever theme and layout the browser has. Square, as `--drpg-corner` draws
         * it (narrow.css's stretch of the tile's children no longer reaches it); its focus ring, laid out while hidden
         * (`::before`, shown at `:focus-visible`), all round its shape; and under Stained Glass, where the tile has a
         * stated size even when it is empty, the ring wholly inside the tile - its `overflow: hidden` would cut what
         * stands out. Read in the tile's own box (`offset*`, the button's offset parent being the fixed tile), so the
         * pane's turn does not enter it. On a stacked screen the tile has no size of its own, so there the ring is not
         * compared with the tile; under Monokuma Legacy on a desk it is, since E81 C10 gave the empty tile a card's box.
         * (b), E81 C9: the card at the bottom of the tile, the one `setFloor` marks, for a card ending in a full line, in
         * text after a `<b>`, in `div > p`, `ul > li`, a table and a rule: no line box of its text under the button's
         * box; its height grown by the floor's room (with the floor's classes taken off and put back) by no more than
         * `--drpg-corner-room` less a line and the body's own padding, and one line; and two one-line cards stand on
         * the tile together, or one waits parked only where the two would not fit without that room. Read with the
         * pane's turn taken off for the reading and put back. NEVER RUN: headless there is no layout, and E81 C9 had
         * no browser.
         * (b), E81 C10: the owner's Q6. On a stacked screen the button is hidden while no card is shown, so it is read
         * hidden on the empty tile and measured beside a card of the suite's own. On a desk the body's theme classes
         * are turned to Monokuma Legacy for the reading (firing `drpgThemeApplied` as `applyTheme` does) and back:
         * with no card the button shown, the tile a card's width (`min(27rem, 92vw)`, read off a probe) and at least
         * the corner's room tall, under the window layer (one below `--z-index-app`, read off a probe) and its `top`
         * under the widgets; 99990 with a card and back under the windows once it is gone; `top` following the clock
         * grown by 40 px with no card; and back on Stained Glass `top` cleared. A widget drawn after `ready` is
         * R298 (7)'s, headless. NEVER RUN: E81 C10 had no browser either.
         * (a), E81 C12: the corner's three in both themes (the classes turned as in (b) and back): R474's reading of the
         * grid from the resolved insets - here they come back in px - with the boxes the buttons are drawn in, and the
         * unread badge (one of the suite's own when there is none, removed after) with its box on the screen and at
         * least the gap clear of the book's. A box, not what is painted: under Stained Glass the chat's clip-path
         * cuts the badge, which stands out of its top-right corner, to a red sliver with no digits (Chromium 12.10, the
         * same in 1.2.74's corner; not this commit's to change). (c), E81 C12, for a GM: the roster opened by
         * clicking its button, run long with 120 rows of the suite's, read as it is and with a dock of 300 px (or
         * half the window, camera-view.mjs's most) written on the body: its foot 8 px over the chat, its right edge with the chat's, its drawn top at least 8 px inside the
         * screen; over the notice cards on a stacked screen; closed by its button. At 640 x 360 only when that is the
         * browser's size; R474 works that one out headless. The two clauses' Chromium readings of 12.10 were taken on
         * the grid mockup's page with this commit's sheets, not by this test: NEVER RUN in a browser either.
         * (d), E81 C13: on a stacked screen, the notice stack in both themes (the classes turned as in (b) and back), filled
         * with the suite's own cards, unrecorded, until one waits parked or eight are shown: its box's foot 8 px over the
         * corner's highest button, or on a short screen on the bottom line (the edge and the dock's lift) with its right
         * edge 24 px past the widest button; its sides at the insets narrow.mjs wrote (the sheet's 8 px without them); its
         * top at least 8 px under the blocks' stack as drawn; and the cards it shows fitting in it. Under Monokuma Legacy
         * the inline `top` popup.mjs writes under the clock is on the tile while this reads, so a top in force shows as a
         * box hanging from it, its foot or its top off its place. The buttons' boxes come from their insets and sizes, the tile's and the stack's from
         * `offset*`: under Stained Glass the corner turns with its pane. Only at the browser's size; R476 works out the
         * A7 design's four headless. NEVER RUN: E81 C13 had no browser.
         * E81 fix r2-H2, 13.10.2026 (review round 2's P8, P7, P23, P24): (b) scrolls the floor card to its end before it
         * reads the line boxes (a card capped at the tile kept its last line out of reach, so it read 0 with the floor's
         * rules or without them), counts the unread badge with the button (its `::after` box, from the computed style),
         * and reads the growth from the content, with the card neither grown into the tile nor capped at it; (a), (c)
         * and (d) read the insets against the box they are measured from (`insetBox`); (d) adds no card a sliver and a
         * card of 400 words inside the stack, scrolling. THIS TEST RUNS ONLY INSIDE FOUNDRY, and still has not run: at
         * a table it is LIVE-E81-02. The same harms are measured in Chromium on the module's own sheets and popup.mjs
         * by the glass harness's `drpgNoticeCheck`, which audit/glass-sweep.mjs runs at every size in both themes -
         * red on the stylesheets before this fix, green on them after (the commit's numbers).
         */
        needs(env.layout(), "where a window stands and how large its text is drawn need a browser");
        const NH = await import("./notice-history.mjs");
        must(!document.querySelector(".drpg-window-notices"), "the notice history window is open - close it: the suite measures a window it opened itself");
        const { openNotices } = await import("./notice-history-app.mjs");
        let win = null, seen = null;
        await NH.holdNoticeHistory(true);
        try {
            for (let i = 0; i < 250; i++) {
                NH.recordNotice({ source: i % 2 ? "mine" : "public", kind: "info", title: `R299 notice ${i}`, text: "R299 kept words ".repeat(12), html: "", state: i % 3 ? "read" : "unread" });
            }
            win = await openNotices();
            const root = win?.element ?? null;
            must(root !== null, "the window did not open");
            const box = root.getBoundingClientRect(), foot = root.querySelector(".drpg-notices-foot")?.getBoundingClientRect();
            const list = root.querySelector(".drpg-notices-list");
            const small = [...root.querySelectorAll("*")]
                .filter(el => el.offsetWidth > 0 && [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
                .filter(el => Number.parseFloat(getComputedStyle(el).fontSize) < 11)
                .map(el => `${el.localName}.${[...el.classList].join(".")} ${getComputedStyle(el).fontSize}`);
            seen = {
                width: box.width <= Math.min(420, window.innerWidth - 16) + 0.5, sides: box.left >= 7.5 && box.right <= window.innerWidth - 7.5,
                foot: Boolean(foot) && foot.top >= 0 && foot.bottom <= window.innerHeight + 0.5, scrolls: list.scrollHeight > list.clientHeight,
                small: [...new Set(small)]
            };
        } finally {
            await win?.close();
            NH.holdNoticeHistory(false);
        }
        equal(stableJson(seen), stableJson({ width: true, sides: true, foot: true, scrolls: true, small: [] }),
            `the notice history window at ${window.innerWidth}x${window.innerHeight} [no wider than 420 px or the screen less 16; 8 px clear of each side; `
            + "its foot on screen; the list scrolls; text under 11 px]");

        /* (a) The corner's three as drawn, in both themes (E81 C12). */
        const launchers = ["drpg-messenger-launcher", "drpg-sound-launcher", "drpg-book-launcher"].map(id => document.getElementById(id));
        must(launchers.every(Boolean), "a corner button is not on the page - there is nothing to measure");
        const CORNER_THEMES = ["drpg-theme-stained-glass", "drpg-theme-monokuma-legacy"], cornerWas = CORNER_THEMES.map(name => document.body.classList.contains(name));
        let badge = launchers[0].querySelector(".drpg-messenger-badge");
        const madeBadge = !badge;
        if (madeBadge) {
            badge = document.createElement("span");
            badge.className = "drpg-messenger-badge";
            badge.textContent = "88";
            launchers[0].append(badge);
        }
        const drawn = {}, drawnWant = {};
        try {
            for (const toGlass of [true, false]) {
                document.body.classList.toggle(CORNER_THEMES[0], toGlass);
                document.body.classList.toggle(CORNER_THEMES[1], !toGlass);
                Hooks.callAll("drpgThemeApplied");
                const label = toGlass ? "Stained Glass" : "Monokuma Legacy";
                const { seen: grid, want: gridWant } = cornerReading(document.createElement("div"), [{ w: innerWidth, h: innerHeight }]);
                delete grid.roster;
                delete gridWant.roster;
                /* The badge in the corner's own terms: its box from the chat's border box (offset* from the padding
                   edge, plus the frame), as insets from the right and the bottom like the buttons'. */
                const [chat, , book] = launchers, chatRight = cascadePx(chat, "right"), chatBottom = cascadePx(chat, "bottom");
                const badgeRight = chatRight + chat.offsetWidth - chat.clientLeft - badge.offsetLeft - badge.offsetWidth;
                const badgeBottom = chatBottom + chat.offsetHeight - chat.clientTop - badge.offsetTop - badge.offsetHeight;
                const bookRight = cascadePx(book, "right"), bookBottom = cascadePx(book, "bottom"), chatBox = insetBox(chat);
                const apart = Math.max(badgeRight - (bookRight + book.offsetWidth), bookRight - (badgeRight + badge.offsetWidth),
                    badgeBottom - (bookBottom + book.offsetHeight), bookBottom - (badgeBottom + badge.offsetHeight));
                drawn[label] = {
                    ...grid,
                    boxes: launchers.map(el => `${el.offsetWidth}x${el.offsetHeight}`).join(" "),
                    badge: { inView: innerWidth - (chatBox.right - badgeRight) >= 0 && chatBox.bottom - badgeBottom - badge.offsetHeight >= 0, clearOfBook: apart >= cascadePx(document.body, "--drpg-launch-gap") - 0.05 }
                };
                drawnWant[label] = {
                    ...gridWant,
                    boxes: launchers.map(el => `${Math.round(cascadePx(el, "width"))}x${Math.round(cascadePx(el, "height"))}`).join(" "),
                    badge: { inView: true, clearOfBook: true }
                };
            }
        } finally {
            CORNER_THEMES.forEach((name, i) => document.body.classList.toggle(name, cornerWas[i]));
            Hooks.callAll("drpgThemeApplied");
            if (madeBadge) badge.remove();
        }
        ok(!/NaN/.test(stableJson({ drawn, drawnWant })), `a length in the corner could not be read: ${stableJson({ drawn, drawnWant })}`);
        equal(stableJson(drawn), stableJson(drawnWant),
            `the corner at ${innerWidth}x${innerHeight} as drawn [per theme: R474's reading of the grid; the boxes the buttons are drawn in; the unread badge's box on the screen `
            + "and at least the gap clear of the book's]");

        /* (c) The GM's roster, opened from its button (E81 C12). */
        if (game.user.isGM) {
            must(!document.getElementById("drpg-messenger-roster"), "the GM's roster is open - close it: the suite opens it from its button and measures that");
            launchers[0].click();
            must(await until(() => document.querySelector("#drpg-messenger-roster.visible"), 2000), "the roster did not open from the messenger button");
            const panel = document.getElementById("drpg-messenger-roster");
            const filler = document.createElement("ul");
            filler.innerHTML = "<li>R299 roster</li>".repeat(120);
            panel.append(filler);
            const roster = {}, liftWas = document.body.style.getPropertyValue("--drpg-av-lift");
            try {
                for (const [label, lift] of [["as it is", null], ["lifted", `${Math.min(300, Math.floor(innerHeight / 2))}px`]]) {
                    if (lift) document.body.style.setProperty("--drpg-av-lift", lift);
                    const chat = launchers[0], foot = cascadePx(panel, "bottom");
                    roster[label] = {
                        foot: (foot - cascadePx(chat, "bottom") - chat.offsetHeight).toFixed(2),
                        right: (cascadePx(panel, "right") - cascadePx(chat, "right")).toFixed(2),
                        top: insetBox(panel).bottom - foot - panel.offsetHeight >= 8 - 0.5
                    };
                    if (liftWas) document.body.style.setProperty("--drpg-av-lift", liftWas);
                    else document.body.style.removeProperty("--drpg-av-lift");
                }
                roster.overCards = !document.body.classList.contains("drpg-stacked") || Number(getComputedStyle(panel).zIndex) > 99990;
            } finally {
                filler.remove();
                launchers[0].click();
                await until(() => !document.getElementById("drpg-messenger-roster"), 2000);
            }
            const placed = { foot: "8.00", right: "0.00", top: true };
            equal(stableJson(roster), stableJson({ "as it is": placed, lifted: placed, overCards: true }),
                `the GM's roster at ${innerWidth}x${innerHeight}, run long [8 px over the chat, its right edge with the chat's, its drawn top at least 8 px inside the screen; `
                + "with a dock of 300 px or half the screen; over the notice cards on a stacked screen]");
        }

        /* (b) The tile's button and its focus ring (E81 C8). */
        const P = await import("./popup.mjs");
        const tile = P.ensureNoticeTile();
        const button = document.getElementById("drpg-notices-corner"), shape = button?.querySelector(".drpg-notices-shape");
        must(button && shape, "the tile has no history button - there is nothing to measure");
        must(!tile.querySelector(".drpg-popup:not(.leaving):not(.drpg-popup-parked)"), "a card is on the notice tile - close it: the tile is measured empty and with the suite's own cards");
        const glass = document.body.classList.contains("drpg-theme-stained-glass"), stacked = document.body.classList.contains("drpg-stacked");
        /* On a stacked screen the button is drawn only beside a card (E81 C10): read hidden first, then measured beside one. */
        const hiddenEmpty = getComputedStyle(button).display === "none";
        const cornerCard = stacked ? P.showPopup("<p>R299 corner</p>", { title: "R299 corner", record: false }) : null;
        const px = value => Number.parseFloat(value) || 0;
        let corner = null, ring = null;
        try {
            must(button.offsetParent === tile, "the tile's button is not laid out in the tile - there is no box to measure");
            const ringStyle = getComputedStyle(button, "::before");
            ring = {
                left: button.offsetLeft + px(ringStyle.left), top: button.offsetTop + px(ringStyle.top),
                right: button.offsetLeft + button.offsetWidth - px(ringStyle.right), bottom: button.offsetTop + button.offsetHeight - px(ringStyle.bottom)
            };
            const drawn = { left: button.offsetLeft + shape.offsetLeft, top: button.offsetTop + shape.offsetTop };
            drawn.right = drawn.left + shape.offsetWidth;
            drawn.bottom = drawn.top + shape.offsetHeight;
            corner = {
                hiddenEmpty,
                square: button.offsetWidth > 0 && button.offsetWidth === button.offsetHeight && shape.offsetWidth === shape.offsetHeight,
                ring: ringStyle.content !== "none" && ring.left < drawn.left && ring.top < drawn.top && ring.right > drawn.right && ring.bottom > drawn.bottom,
                inTile: stacked ? null : ring.left >= 0 && ring.top >= 0 && ring.right <= tile.clientWidth && ring.bottom <= tile.clientHeight
            };
        } finally {
            cornerCard?.({ instant: true });
        }
        equal(stableJson(corner), stableJson({ hiddenEmpty: stacked, square: true, ring: true, inTile: stacked ? null : true }),
            `the tile's button (${glass ? "Stained Glass" : "Monokuma Legacy"}${stacked ? ", stacked" : ""}, ${tile.querySelectorAll(".drpg-popup").length} cards on the tile, `
            + `ring ${stableJson(ring)} in a ${tile.clientWidth}x${tile.clientHeight} tile) [hidden on the empty tile; square; the ring round its shape; the ring within the tile, `
            + "on a desk]");
        /* (b) The card at the bottom of the tile leaves the corner to the button (E81 C9). */
        must(!tile.querySelector(".drpg-popup:not(.leaving):not(.drpg-popup-parked)"), "a card is on the notice tile - close it: the floor card is measured on the suite's own cards");
        const TAILS = ".drpg-corner-tail, .drpg-corner-tail-block";
        const untail = () => tile.querySelectorAll(TAILS).forEach(el => el.classList.remove("drpg-corner-tail", "drpg-corner-tail-block"));
        const probe = document.createElement("div");
        probe.style.cssText = "position: absolute; visibility: hidden; height: 0; width: var(--drpg-corner-room)";
        document.body.append(probe);
        const room = probe.offsetWidth;
        probe.remove();
        const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        const SHAPES = {
            full: `<p>${"R299 words ".repeat(60)}</p>`,
            inline: "<p>R299 words <b>bold</b> and after it</p>",
            nested: "<div><p>R299 first</p><p>R299 the last of a block</p></div>",
            list: "<p>R299 lead</p><ul><li>R299 one</li><li>R299 two</li></ul>",
            table: "<p>R299 lead</p><table><tbody><tr><td>R299 cell</td><td>R299 cell</td></tr></tbody></table>",
            rule: "<p>R299 lead</p><hr>"
        };
        const turn = [tile.style.getPropertyValue("transform"), tile.style.getPropertyPriority("transform")];
        const floorClosers = [], floor = { crossed: {}, growth: {}, cards: null };
        /* Upright for the reading, as the curtain's own measurements are taken: the pane's turn moves the text and the
           button together, and a turned box's bounds are larger than the box. */
        tile.style.setProperty("transform", "none", "important");
        try {
            for (const [name, html] of Object.entries(SHAPES)) {
                const close = P.showPopup(html, { title: "R299 floor", record: false });
                floorClosers.push(close);
                const card = tile.querySelector(".drpg-popup-floor"), body = card?.querySelector(".drpg-popup-body");
                const tailEl = tile.querySelector(TAILS);
                if (!body || !tailEl) {
                    floor.crossed[name] = floor.growth[name] = "no floor card or no tail";
                    close({ instant: true });
                    continue;
                }
                /* E81 fix r2-H2 (review round 2's P8, P7): scrolled to its end, since a card capped at the tile keeps its last
                   line below the tile until it is, and the badge with the button - the `::after` of it, whose box
                   getBoundingClientRect leaves out. */
                card.scrollTop = card.scrollHeight;
                const unreadWas = button.getAttribute("data-unread");
                if (unreadWas === null) button.setAttribute("data-unread", "9+");
                const texts = node => node.nodeType === Node.TEXT_NODE ? [node] : [...node.childNodes].flatMap(texts);
                const view = card.getBoundingClientRect();
                const words = texts(body).filter(node => node.data.trim()).flatMap(node => {
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    return [...range.getClientRects()];
                }).filter(rect => rect.width > 0 && overlaps(rect, view));
                const hit = button.getBoundingClientRect(), after = getComputedStyle(button, "::after");
                const badgeAt = { left: hit.left + button.clientLeft + px(after.left), top: hit.top + button.clientTop + px(after.top) };
                const badgeBox = after.content === "none" ? null : { ...badgeAt, right: badgeAt.left + px(after.width), bottom: badgeAt.top + px(after.height) };
                if (unreadWas === null) button.removeAttribute("data-unread");
                floor.crossed[name] = !badgeBox ? "no badge drawn" : words.filter(rect => overlaps(rect, hit) || overlaps(rect, badgeBox)).length;
                const lines = Math.max(px(getComputedStyle(body).lineHeight), px(getComputedStyle(tailEl).lineHeight));
                /* Growth from the content (P8): with the card neither grown into the tile nor capped at it, for the reading -
                   a card that fills the tile is the tile's height with the floor's room and without it. */
                const held = ["flex-grow", "max-height"].map(name => [name, card.style.getPropertyValue(name), card.style.getPropertyPriority(name)]);
                card.style.setProperty("flex-grow", "0", "important");
                card.style.setProperty("max-height", "none", "important");
                const withFloor = card.offsetHeight;
                card.classList.remove("drpg-popup-floor");
                untail();
                const without = card.offsetHeight, pad = px(getComputedStyle(body).paddingBottom), lh = px(getComputedStyle(body).lineHeight);
                held.forEach(([name, value, priority]) => value ? card.style.setProperty(name, value, priority) : card.style.removeProperty(name));
                P.setFloor(tile);
                const bound = Math.max(0, room - lh - pad) + lines + 0.5;
                floor.growth[name] = withFloor - without <= bound ? true : `${withFloor - without} px over a bound of ${bound} px`;
                close({ instant: true });
            }
            const pair = [P.showPopup("<p>R299 one line</p>", { title: "R299 floor", record: false }), P.showPopup("<p>R299 another line</p>", { title: "R299 floor", record: false })];
            floorClosers.push(...pair);
            const ours = [...tile.querySelectorAll(".drpg-popup:not(.leaving)")].filter(card => /R299 (one|another) line/.test(card.textContent));
            const parked = ours.filter(card => card.classList.contains("drpg-popup-parked"));
            let fitWithout = true;
            if (parked.length) {
                /* One of the two was parked for want of room: whether they fit without the floor's room, as
                   `overflowsGlass` adds them up. */
                parked.forEach(card => card.classList.remove("drpg-popup-parked"));
                ours.forEach(card => card.classList.remove("drpg-popup-floor"));
                untail();
                fitWithout = ours.reduce((sum, card) => sum + card.offsetHeight, px(getComputedStyle(tile).rowGap)) <= tile.clientHeight + 1;
                parked.forEach(card => card.classList.add("drpg-popup-parked"));
                P.setFloor(tile);
            }
            floor.cards = parked.length === 0 || !fitWithout;
        } finally {
            for (const close of floorClosers) { try { close({ instant: true }); } catch { /* already gone */ } }
            if (turn[0]) tile.style.setProperty("transform", turn[0], turn[1]);
            else tile.style.removeProperty("transform");
        }
        const clear = Object.fromEntries(Object.keys(SHAPES).map(name => [name, 0])), held = Object.fromEntries(Object.keys(SHAPES).map(name => [name, true]));
        equal(stableJson(floor), stableJson({ crossed: clear, growth: held, cards: true }),
            `the card at the bottom of the tile (${glass ? "Stained Glass" : "Monokuma Legacy"}${stacked ? ", stacked" : ""}, room ${room} px) [lines of its text under `
            + "the button, per shape of its end; its height grown by no more than the room less a line and its own padding, and a line; two one-line cards on "
            + "the tile together, or parked only where they would not fit without the floor's room]");
        /* (d) The notice stack on a stacked screen (E81 C13), in both themes, with the suite's own cards. */
        if (stacked) {
            const column = document.getElementById("drpg-column");
            must(column, "the screen is stacked and the blocks' stack is not on it - there is nothing to measure the notices against");
            const THEMES = ["drpg-theme-stained-glass", "drpg-theme-monokuma-legacy"], themeWas = THEMES.map(name => document.body.classList.contains(name));
            const short = document.body.classList.contains("drpg-short");
            const rootPx = name => px(getComputedStyle(document.body).getPropertyValue(name));
            const offsetTop = el => { let y = 0; for (let at = el; at; at = at.offsetParent) y += at.offsetTop; return y; };
            const stackRead = {}, stackWant = {};
            const closers = [];
            try {
                for (const toGlass of [true, false]) {
                    document.body.classList.toggle(THEMES[0], toGlass);
                    document.body.classList.toggle(THEMES[1], !toGlass);
                    Hooks.callAll("drpgThemeApplied");
                    for (let i = 0; i < 8 && !tile.querySelector(".drpg-popup-parked:not(.leaving)"); i++) {
                        closers.push(P.showPopup(`<p>${"R299 stack words ".repeat(8)}</p>`, { title: `R299 stack ${i}`, record: false }));
                    }
                    const edge = rootPx("--drpg-edge"), lift = rootPx("--drpg-av-lift");
                    /* The buttons' boxes from their own insets: under Stained Glass the corner turns with its pane. */
                    /* Against the box their insets are measured from (P23: under Stained Glass not the window), and the
                       tile in the window's coordinates - on a stacked screen it is not turned (narrow.css). */
                    const buttons = ["drpg-messenger-launcher", "drpg-sound-launcher", "drpg-book-launcher"].map(id => document.getElementById(id)).map(el => {
                        const style = getComputedStyle(el), from = insetBox(el);
                        return { top: from.bottom - px(style.bottom) - el.offsetHeight, reach: innerWidth - from.right + px(style.right) + el.offsetWidth };
                    });
                    const cornerTop = Math.min(...buttons.map(b => b.top)), reach = Math.max(...buttons.map(b => b.reach));
                    const drawn = tile.getBoundingClientRect(), tileFrom = insetBox(tile);
                    const box = { top: drawn.top, bottom: drawn.bottom, left: drawn.left - tileFrom.left, right: tileFrom.right - drawn.right, fromEdge: innerWidth - drawn.right, foot: tileFrom.bottom - drawn.bottom };
                    const inset = name => px(tile.style.getPropertyValue(name)) || 8;
                    const shown = [...tile.querySelectorAll(".drpg-popup:not(.leaving):not(.drpg-popup-parked)")];
                    /* No card a sliver (E81 fix r2-H2, review round 2's P24): drawn shorter than its own content less a line
                       while another is shown beside it, which is what a card squeezed by the capped tile looks like. */
                    const lineOf = el => px(getComputedStyle(el).lineHeight) || px(getComputedStyle(el).fontSize) * 1.2;
                    const slivers = shown.length < 2 ? 0 : shown.filter(el => el.offsetHeight < el.scrollHeight - lineOf(el.querySelector(".drpg-popup-body") ?? el) - 0.5).length;
                    const label = toGlass ? "Stained Glass" : "Monokuma Legacy";
                    stackRead[label] = {
                        foot: short ? Math.abs(box.foot - (edge + lift)) <= 0.5 : box.bottom <= cornerTop - 8 + 0.5,
                        beside: short ? box.fromEdge >= Math.max(inset("--drpg-notices-right"), reach + 24) - 0.5 : null,
                        sides: Math.abs(box.left - inset("--drpg-notices-left")) <= 0.5 && (short || Math.abs(box.right - inset("--drpg-notices-right")) <= 0.5),
                        underColumn: box.top >= offsetTop(column) + column.offsetHeight + 8 - 0.5,
                        fits: shown.length > 0 && shown.reduce((sum, el) => sum + el.offsetHeight, px(getComputedStyle(tile).rowGap) * (shown.length - 1)) <= tile.clientHeight + 1,
                        slivers
                    };
                    while (closers.length) closers.pop()({ instant: true });
                    /* One card taller than the stack (P24's other road): inside the tile, scrolling. */
                    closers.push(P.showPopup(`<p>${"R299 long words ".repeat(400)}</p>`, { title: "R299 long", record: false }));
                    const long = tile.querySelector(".drpg-popup:not(.leaving):not(.drpg-popup-parked)"), longBox = long?.getBoundingClientRect(), tileBox = tile.getBoundingClientRect();
                    stackRead[label].long = long ? { inTile: longBox.top >= tileBox.top - 0.5 && longBox.bottom <= tileBox.bottom + 0.5, scrolls: long.scrollHeight > long.clientHeight + 1 } : "not shown";
                    stackWant[label] = { foot: true, beside: short ? true : null, sides: true, underColumn: true, fits: true, slivers: 0, long: { inTile: true, scrolls: true } };
                    while (closers.length) closers.pop()({ instant: true });
                }
            } finally {
                for (const close of closers) { try { close({ instant: true }); } catch { /* already gone */ } }
                THEMES.forEach((name, i) => document.body.classList.toggle(name, themeWas[i]));
                Hooks.callAll("drpgThemeApplied");
            }
            equal(stableJson(stackRead), stableJson(stackWant),
                `the notice stack at ${innerWidth}x${innerHeight}${short ? ", short" : ""} [per theme, with the suite's cards until one waits parked: its foot 8 px over the `
                + "corner's highest button, or on the bottom line on a short screen; beside the buttons there, 24 px past the widest; its sides at narrow.mjs's insets; "
                + "its top 8 px under the blocks' stack at least; the cards shown fitting in it; none of them a sliver; a card of 400 words inside it, scrolling]");
        }
        /* (b) Under Monokuma Legacy on a desk the button stands alone under the clock (E81 C10). Not on a stacked screen,
           whose width this test cannot change: there the button hidden on the empty tile is the reading, above. */
        if (stacked) return;
        const measure = document.createElement("div");
        measure.style.cssText = "position: absolute; visibility: hidden; height: 0; z-index: calc(var(--z-index-app, 30) - 1); width: min(27rem, 92vw)";
        document.body.append(measure);
        const underWindows = getComputedStyle(measure).zIndex, cardWidth = measure.offsetWidth;
        measure.remove();
        const widgetTop = () => {
            const bottom = Math.max(0, ...["#drpg-despair", "#drpg-hud"].map(sel => document.querySelector(sel)?.getBoundingClientRect()).filter(box => box?.height > 0).map(box => box.bottom));
            return `${Math.round(bottom ? bottom + 8 : 96)}px`;
        };
        const THEMES = ["drpg-theme-stained-glass", "drpg-theme-monokuma-legacy"], themeWas = THEMES.map(name => document.body.classList.contains(name));
        const theme = toGlass => {
            document.body.classList.toggle(THEMES[0], toGlass);
            document.body.classList.toggle(THEMES[1], !toGlass);
            Hooks.callAll("drpgThemeApplied");
        };
        const clock = document.getElementById("drpg-hud"), clockWas = clock?.style.getPropertyValue("min-height") ?? "";
        const lone = {};
        let loneCard = null;
        try {
            theme(false);
            await until(() => tile.style.top === widgetTop(), 2000);
            lone.empty = {
                shown: getComputedStyle(button).display !== "none" && button.offsetWidth > 0, width: Math.abs(tile.offsetWidth - cardWidth) <= 0.5,
                tall: tile.offsetHeight >= room - 0.5, under: getComputedStyle(tile).zIndex === underWindows, top: tile.style.top === widgetTop()
            };
            loneCard = P.showPopup("<p>R299 lone</p>", { title: "R299 lone", record: false });
            lone.card = getComputedStyle(tile).zIndex;
            loneCard({ instant: true });
            lone.after = await until(() => getComputedStyle(tile).zIndex === underWindows, 2000);
            if (clock) {
                const before = tile.style.top;
                clock.style.setProperty("min-height", `${clock.offsetHeight + 40}px`, "important");
                await until(() => tile.style.top !== before, 2000);
                lone.grown = tile.style.top !== before && tile.style.top === widgetTop();
            }
            theme(true);
            lone.glass = tile.style.top;
        } finally {
            loneCard?.({ instant: true });
            if (clock) {
                if (clockWas) clock.style.setProperty("min-height", clockWas);
                else clock.style.removeProperty("min-height");
            }
            THEMES.forEach((name, i) => document.body.classList.toggle(name, themeWas[i]));
            Hooks.callAll("drpgThemeApplied");
        }
        const shownAlone = { shown: true, width: true, tall: true, under: true, top: true };
        equal(stableJson(lone), stableJson({ empty: shownAlone, card: "99990", after: true, ...(clock ? { grown: true } : {}), glass: "" }),
            `the lone button under Monokuma Legacy on a desk (a ${cardWidth}x${room} box, under the windows at ${underWindows}) [with no card: shown, the tile a card's width, `
            + "the corner's room tall, under the window layer, its top under the widgets; the tile's z-index with a card; under the windows again after it; the top after the "
            + "clock grew with no card; back on Stained Glass, the top]");
    }],
    ["R474 - the three corner buttons stand on the grid their tokens describe, in both themes: each the size its token gives, square; settings and the handbooks on the bottom line with the handbooks at the wall; the chat over the midpoint of the two; every two neighbours the gap apart, flat side to flat side or rim to rim; the corner as tall as --drpg-launch-h; with the camera dock's lift and the tab rail's clearance as well; and the GM's roster 8 px over the chat with its right edge, its top 8 px inside the screen (also at 640 x 360 headless), and over the notice cards on a stacked screen", async () => {
        /*
         * E81 C12, 12.10.2026: the owner's grid (AM-18 of 11.10, variant B accepted in AM-21 of 12.10), read from the
         * cascade so it runs headless - R299 (a) and (c) read the same and the boxes as drawn, but only in a browser.
         * Every expectation comes from the tokens, not from the mockup's numbers (the plan's D1): sizes, the gap, the
         * edge, the book's height, `--drpg-launch-h`. The rows (`--drpg-launch-row`, 47.88 and 55.64) are the one
         * input the test does not recompute; that is the point of it - change a size or the gap without the row it
         * implies and the gaps here stop being the gap. Both themes are put on the body for the reading and back
         * (synchronously, no hook fired: nothing is drawn in between), and each is read twice: as the table has it,
         * and with `--drpg-av-lift` at 300 px (or half the window, the most camera-view.mjs ever lifts: the 640 x 360
         * reading is made unlifted, as a 300 px dock there is not a screen anybody has) and `--drpg-launch-clear` at
         * 37 px written on the body and put back, so a
         * rule that forgets the camera dock or the tab rail is read moving away from the others. The roster is the
         * GM's own when it is open, otherwise one made for the reading and removed. Its ceiling is worked out at the
         * window's size and, headless, where the values come back unresolved, at 640 x 360 too; in a browser they
         * come back in px for the window that runs the suite and nothing else. Over the cards: a stacked screen's
         * notice cards stand at 99990 (danganronpa.css `#drpg-popups`, R299 (b) reads that number with a card); the
         * reading is made with `drpg-stacked` on the body, put there for it on a desk.
         */
        const ids = ["drpg-messenger-launcher", "drpg-sound-launcher", "drpg-book-launcher"];
        must(ids.every(id => document.getElementById(id)), "a corner button is not on the page - there is nothing to read");
        const body = document.body;
        const CLASSES = ["drpg-theme-stained-glass", "drpg-theme-monokuma-legacy", "drpg-stacked"], classWas = CLASSES.map(name => body.classList.contains(name));
        const INLINE = ["--drpg-av-lift", "--drpg-launch-clear"], inlineWas = INLINE.map(name => body.style.getPropertyValue(name));
        const putBack = () => INLINE.forEach((name, i) => inlineWas[i] ? body.style.setProperty(name, inlineWas[i]) : body.style.removeProperty(name));
        let roster = document.getElementById("drpg-messenger-roster");
        const made = !roster;
        if (made) {
            roster = document.createElement("div");
            roster.id = "drpg-messenger-roster";
            body.append(roster);
        }
        const resolved = /^-?[\d.]+px$/.test(getComputedStyle(document.getElementById(ids[0])).right.trim());
        const views = [{ w: innerWidth, h: innerHeight }, ...(resolved ? [] : [{ w: 640, h: 360 }])];
        const seen = {}, want = {};
        let overCards = null;
        try {
            for (const glass of [true, false]) {
                body.classList.toggle(CLASSES[0], glass);
                body.classList.toggle(CLASSES[1], !glass);
                for (const [label, lift, clear] of [["as it is", null, null], ["lifted, cleared 37", `${Math.min(300, Math.floor(innerHeight / 2))}px`, "37px"]]) {
                    if (lift) {
                        body.style.setProperty(INLINE[0], lift);
                        body.style.setProperty(INLINE[1], clear);
                    }
                    const reading = cornerReading(roster, lift ? views.slice(0, 1) : views);
                    seen[`${glass ? "Stained Glass" : "Monokuma Legacy"}, ${label}`] = reading.seen;
                    want[`${glass ? "Stained Glass" : "Monokuma Legacy"}, ${label}`] = reading.want;
                    putBack();
                }
            }
            body.classList.add(CLASSES[2]);
            overCards = Number(getComputedStyle(roster).zIndex) > 99990;
        } finally {
            CLASSES.forEach((name, i) => body.classList.toggle(name, classWas[i]));
            putBack();
            if (made) roster.remove();
        }
        /* Both sides are read through the same parser, so a value it could not read would be "NaN" on both and equal. */
        ok(!/NaN/.test(stableJson({ seen, want })), `a length in the corner could not be read: ${stableJson({ seen, want })}`);
        equal(stableJson({ ...seen, overCards }), stableJson({ ...want, overCards: true }),
            `the corner at ${innerWidth}x${innerHeight}${resolved ? "" : " and 640x360"} [per theme and reading: the shape; the sizes; the book's right and bottom; `
            + "settings' bottom; the three gaps; the chat's centre off the midpoint; the chat above both; the corner's height; the roster's foot over the chat, "
            + "its right edge against the chat's, its top at least 8 px in - and the roster over the cards on a stacked screen]");
    }],
    ["R476 - the notice stack on a stacked screen stands clear of the corner buttons and of the blocks' stack, in both themes: its foot 8 px over the buttons, or on a short screen beside them on the bottom line, 24 px past the widest; its sides at the insets narrow.mjs measures; never at the inline top popup.mjs writes under the clock; its ceiling 8 px under the blocks' stack at its tallest, from the token both read; and a card under the same ceiling scrolls", async () => {
        /*
         * E81 C13, 12.10.2026: the A7 design's P8-7 (S12-40), read from the cascade so it runs headless - R299 (d)
         * reads the drawn boxes with the module's own cards, but only in a browser. Through 1.2.74 each theme beat
         * the stack's plain `bottom: 96px` (narrow.css says how) and it stood on the corner's buttons. Every
         * expectation comes from the tokens and the buttons' own insets, never from a figure: the foot over the
         * highest button's top, the right edge past the widest button's reach, the ceiling against the blocks'
         * stack's `top` and `max-height`. Headless the values come back unresolved and are worked out at the A7
         * design's four stacked sizes - 393 x 852 and 820 x 1180, and 844 x 390 and 640 x 360 with `drpg-short` -
         * and in a browser they come back in px for the window that runs the suite, read with `drpg-short` off and
         * on. Both themes, each read twice: with no insets on the tile (the sheet's 8 px gutter) and the body as the
         * table has it, and with the tool and tab rails' insets narrow.mjs writes (61 and 56 px), the tab rail's
         * clearance (37 px, glass.mjs) and a camera dock's lift (100 px) - so a rule that forgets one of them is read
         * moving away from the others. An inline `top` such as popup.mjs
         * writes under the clock is on the tile for every reading; what the cascade makes of it is read headless
         * only, since a browser resolves `top` to the box. The classes, the body's and the tile's inline values are
         * put back synchronously, no hook fired; the blocks' stack is the page's when the screen is stacked,
         * otherwise one made for the reading, and the card is one of the test's, parked, removed after.
         * ONE READING IS LEFT TO THE BROWSER: the tile's `left` under Stained Glass. jsdom 30.0.1 drops the priority
         * of a declaration whose value holds a var() (a rule's `left: var(--a, 8px) !important` reads back with
         * priority "", `top: 4px !important` with "important"; probed 12.10.2026), so headless the theme's plain
         * `left: 16px !important` beats this sheet's and the reading says 16 where a browser draws the inset. The
         * same loss is harmless elsewhere here: the theme's own var() values lose theirs too, and the plain
         * `top: auto` and `height: auto` keep it. Under Monokuma Legacy `left` is read.
         * E81 fix r2-H2 (review round 2's P24, P25): the ceiling never under 96 px - a short screen with the dock's
         * 100 px left it 32 px at 844 x 390 and 640 x 360 (worked out: the glass harness reads 132 at both without a
         * dock, Chromium 13.10.2026), so there the stack reaches under the blocks' stack by what
         * the 96 px take, and `under` says by how much - and a card that does not shrink, its frame inside its
         * ceiling (`flex-shrink` 0, `box-sizing: border-box`). What those do to drawn cards is glass-sweep.mjs's
         * reading, in Chromium on the glass harness, and R299 (d)'s inside Foundry.
         */
        const host = document.getElementById("drpg-popups");
        const ids = ["drpg-messenger-launcher", "drpg-sound-launcher", "drpg-book-launcher"];
        must(host && ids.every(id => document.getElementById(id)), "the notice tile or a corner button is not on the page - there is nothing to read");
        const body = document.body;
        const CLASSES = ["drpg-theme-stained-glass", "drpg-theme-monokuma-legacy", "drpg-stacked", "drpg-short"], classWas = CLASSES.map(name => body.classList.contains(name));
        const BODY = ["--drpg-av-lift", "--drpg-launch-clear"], bodyWas = BODY.map(name => body.style.getPropertyValue(name));
        const HOST = ["--drpg-notices-left", "--drpg-notices-right", "top"], hostWas = HOST.map(name => [host.style.getPropertyValue(name), host.style.getPropertyPriority(name)]);
        const putBack = () => {
            BODY.forEach((name, i) => bodyWas[i] ? body.style.setProperty(name, bodyWas[i]) : body.style.removeProperty(name));
            HOST.forEach((name, i) => hostWas[i][0] ? host.style.setProperty(name, ...hostWas[i]) : host.style.removeProperty(name));
        };
        let column = document.getElementById("drpg-column");
        const madeColumn = !column;
        if (madeColumn) {
            column = document.createElement("div");
            column.id = "drpg-column";
            (document.getElementById("interface") ?? body).prepend(column);
        }
        const card = document.createElement("div");
        card.className = "drpg-popup drpg-popup-parked";
        const resolved = /^-?[\d.]+px$/.test(getComputedStyle(document.getElementById(ids[0])).right.trim());
        const views = resolved
            ? [false, true].map(short => ({ w: innerWidth, h: innerHeight, short }))
            : [[393, 852, false], [820, 1180, false], [844, 390, true], [640, 360, true]].map(([w, h, short]) => ({ w, h, short }));
        const round = value => Number.isFinite(value) ? value.toFixed(2) : String(value);
        const seen = {}, want = {};
        try {
            host.prepend(card);
            host.style.setProperty("top", "123px");
            for (const glass of [true, false]) {
                body.classList.toggle(CLASSES[0], glass);
                body.classList.toggle(CLASSES[1], !glass);
                body.classList.add(CLASSES[2]);
                for (const view of views) {
                    body.classList.toggle(CLASSES[3], view.short);
                    for (const [label, insets, clear, lift] of [["no insets", null, null, null], ["the rails' insets, cleared 37, lifted 100", [61, 56], "37px", "100px"]]) {
                        host.style.removeProperty(HOST[0]);
                        host.style.removeProperty(HOST[1]);
                        if (insets) {
                            host.style.setProperty(HOST[0], `${insets[0]}px`);
                            host.style.setProperty(HOST[1], `${insets[1]}px`);
                            body.style.setProperty(BODY[0], lift);
                            body.style.setProperty(BODY[1], clear);
                        }
                        const px = (el, prop) => cascadePx(el, prop, view);
                        const edge = px(body, "--drpg-edge"), up = px(body, "--drpg-av-lift") || 0;
                        const buttons = ids.map(id => document.getElementById(id)).map(el => ({ right: px(el, "right"), bottom: px(el, "bottom"), w: px(el, "width"), h: px(el, "height") }));
                        const top = Math.max(...buttons.map(b => b.bottom + b.h)), reach = Math.max(...buttons.map(b => b.right + b.w));
                        const bottom = px(host, "bottom"), ceiling = px(host, "max-height");
                        const [left, right] = insets ?? [8, 8];
                        const key = `${glass ? "Stained Glass" : "Monokuma Legacy"}, ${view.w}x${view.h}${view.short ? " short" : ""}, ${label}`;
                        seen[key] = {
                            top: resolved ? null : getComputedStyle(host).top,
                            foot: round(view.short ? bottom - (edge + up) : bottom - top),
                            left: glass && !resolved ? null : round(px(host, "left")),
                            right: round(px(host, "right")),
                            under: round(view.h - bottom - ceiling - (px(column, "top") + px(column, "max-height"))),
                            height: resolved ? null : getComputedStyle(host).height,
                            card: [round(px(card, "max-height")), getComputedStyle(card).overflowY, getComputedStyle(card).flexShrink, getComputedStyle(card).boxSizing]
                        };
                        want[key] = {
                            top: resolved ? null : "auto",
                            foot: round(view.short ? 0 : 8),
                            left: glass && !resolved ? null : round(left),
                            right: round(view.short ? Math.max(right, reach + 24) : right),
                            under: round(Math.min(8, view.h - bottom - 96 - (px(column, "top") + px(column, "max-height")))),
                            height: resolved ? null : "auto",
                            card: [round(ceiling), "auto", "0", "border-box"]
                        };
                        putBack();
                        host.style.setProperty("top", "123px");
                    }
                }
            }
        } finally {
            CLASSES.forEach((name, i) => body.classList.toggle(name, classWas[i]));
            card.remove();
            putBack();
            if (madeColumn) column.remove();
        }
        /* Both sides are read through the same parser, so a value it could not read would be "NaN" on both and equal. */
        ok(!/NaN/.test(stableJson({ seen, want })), `a length of the notice stack could not be read: ${stableJson({ seen, want })}`);
        equal(stableJson(seen), stableJson(want),
            `the notice stack on a stacked screen${resolved ? ` at ${innerWidth}x${innerHeight}` : " at 393x852, 820x1180, 844x390 and 640x360"} [per theme, size and reading: `
            + "the inline top not in force; the foot 8 px over the highest button, or on the bottom line beside them on a short screen; the left and right insets, "
            + "the right on a short screen 24 px past the widest button at least; the ceiling 8 px under the blocks' stack at its tallest, or 96 px where "
            + "that leaves less; the height left to the cards; a card's ceiling the stack's, it scrolls, it does not shrink and its frame is inside the ceiling]");
    }],
    ["R500 - a cast row kept by a hall token under 1.2.74 moves to its actor once: the actor's first token in the hall decides, its season kept, and any other key and a second run are left alone", async () => {
        /*
         * E81 DZ6, 12.10.2026 (the owner: the GM chooses the cast per actor, "kto bierze udział, a kogo nie
         * przenosić"; the DZ6 design's R474, renumbered R500 for the second fix line). Until DZ6 the GMs' choice was a
         * row per hall token, `${hallId}.${tokenId}`; it is now a row per actor, and a world that chose under 1.2.74
         * keeps its choice through trial-scene.mjs `castRowsByActor`, whose answer the primary's `ready` writes
         * (`tidyTrialHall`: a fill that never overwrites an actor's row, then a drop; the tier-2 "a 1.2.74 cast row
         * kept by a hall token ..." drives it on a store). Asked of plain rows: a hall with two tokens of one student
         * (the first's row "hidden", the second's "shown" - the trial never read a second token's row), a second
         * student's token with a row of the season before, a token row with no `reveal`, a row an actor already holds
         * in another hall beside a token row of the same actor there, a key naming a token of another scene, and a key
         * of a scene not handed. Read: what is filled by actor, what is dropped, and a second run over what a store
         * holds after the first (the actor's own row kept, as `fillOnly` keeps it). Red at 0697d0f: there was no
         * `castRowsByActor`.
         */
        const T = await import("./trial-scene.mjs");
        ok(typeof T.castRowsByActor === "function", "trial-scene.mjs has no `castRowsByActor` - a cast chosen under 1.2.74 is lost to the per-actor choice");
        if (typeof T.castRowsByActor !== "function") return;
        const scenes = {
            HALL: [{ id: "TA1", actorId: "ALPHA" }, { id: "TB1", actorId: "BETA" }, { id: "TA2", actorId: "ALPHA" }, { id: "TN1", actorId: "NOROW" }],
            OTHER: [{ id: "TB2", actorId: "BETA" }]
        };
        const rows = {
            "HALL.TA1": { reveal: false, epoch: 9 }, "HALL.TA2": { reveal: true, epoch: 9 }, "HALL.TB1": { reveal: true, epoch: 8 }, "HALL.TN1": { epoch: 9 },
            "OTHER.BETA": { reveal: false, epoch: 9 }, "OTHER.TB2": { reveal: true, epoch: 9 }, "HALL.TB2": { reveal: true, epoch: 9 }, "GONE.TX": { reveal: true, epoch: 9 }
        };
        const first = T.castRowsByActor(rows, scenes);
        const held = Object.fromEntries(Object.entries(rows).filter(([key]) => !first.old.includes(key)));
        for (const [key, row] of Object.entries(first.mapped)) if (!(key in held)) held[key] = row;
        const second = T.castRowsByActor(held, scenes);
        equal(JSON.stringify([first, second, held["OTHER.BETA"]]), JSON.stringify([
            { mapped: { "HALL.ALPHA": { reveal: false, epoch: 9 }, "HALL.BETA": { reveal: true, epoch: 8 }, "OTHER.BETA": { reveal: true, epoch: 9 } },
                old: ["HALL.TA1", "HALL.TA2", "HALL.TB1", "HALL.TN1", "OTHER.TB2"] },
            { mapped: {}, old: [] }, { reveal: false, epoch: 9 }]),
            "[the first run: the first token's row by its actor (not the second token's), a past season's row with its season, the token row of an actor that holds a row "
            + "(filled only where none is), every token row dropped and no other key; a second run over what the store then holds; the actor's own row kept]");
    }],

    ["R501 - the stage's plan: a token is the module's only when the hall's record names it, so the GM's are shown or hidden and never removed, a standing made token is used again, and Monokuma is never made", async () => {
        /*
         * E81 DZ6, 12.10.2026 (the DZ6 design's R475, renumbered R501 for the second fix line; design 3.1-3.2, the
         * orchestrator's Q1-Q3). The stage (trial-scene.mjs `stageHall`) makes the cast's tokens in the hall when the
         * trial opens and deletes them when it ends, and `stagePlan` decides which, before anything is written. The
         * harm it guards is a deleted token the GMs placed: a token is the module's only when its id is in the hall's
         * `trialSeats` record. Asked of plain rows: Aiko with two tokens the GMs placed and a made one of an earlier
         * trial; Botan with a made token standing; Chie with none; Monokuma, ticked, with none; Daichi unticked, with a
         * made token and one of the GMs'; Gin, ticked, whose recorded token is gone; Fumi unticked, with a token the
         * GMs placed that carries a `made` mark (a flag anybody could write) and an empty record; and a prop whose actor
         * is no "character". Read: the plan into the trial and out of it. Red at 4f4c24b: there was no `stagePlan`.
         */
        const T = await import("./trial-scene.mjs");
        ok(typeof T.stagePlan === "function", "trial-scene.mjs has no `stagePlan` - the stage cannot tell the module's tokens from the GMs'");
        if (typeof T.stagePlan !== "function") return;
        const cast = [{ actorId: "AIKO", in: true }, { actorId: "BOTAN", in: true }, { actorId: "CHIE", in: true }, { actorId: "MONO", monokuma: true, in: true },
            { actorId: "DAICHI", in: false }, { actorId: "GIN", in: true }, { actorId: "FUMI", in: false }];
        const tokens = [{ id: "GA1", actorId: "AIKO", cast: true }, { id: "GA2", actorId: "AIKO", cast: true }, { id: "MA", actorId: "AIKO", cast: true },
            { id: "MB", actorId: "BOTAN", cast: true }, { id: "MD", actorId: "DAICHI", cast: true }, { id: "GD", actorId: "DAICHI", cast: true },
            { id: "FX", actorId: "FUMI", cast: true, made: true }, { id: "PROP", actorId: "TABLE", cast: false }];
        const seats = { AIKO: { x: 0, y: 0, token: "MA" }, BOTAN: { x: 100, y: 0, token: "MB" }, DAICHI: { x: 200, y: 0, token: "MD" },
            GIN: { x: 300, y: 0, token: "GONE" }, FUMI: { x: null, y: null, token: null } };
        const plans = [T.stagePlan({ cast, tokens, seats, into: true }), T.stagePlan({ cast, tokens, seats, into: false }),
            T.stagePlan({ cast, tokens, seats: {}, into: true })];
        equal(JSON.stringify(plans), JSON.stringify([
            { remove: ["MA", "MD"], create: ["CHIE", "GIN"], show: ["GA1", "MB"], hide: ["GA2", "GD", "FX"] },
            { remove: ["MA", "MB", "MD"], create: [], show: [], hide: ["GA1", "GA2", "GD", "FX"] },
            { remove: [], create: ["CHIE", "GIN"], show: ["GA1", "MB"], hide: ["GA2", "MA", "MD", "GD", "FX"] }]),
            "[into: the GMs' first token of Aiko shown, her second hidden and the made one removed; Botan's made token used again; Chie and Gin (whose recorded token is gone) made, "
            + "Monokuma not; unticked Daichi's made token removed and the GMs' hidden; Fumi's marked token hidden, never removed; the prop untouched - out: every made token removed, "
            + "every GM token hidden - into with no record: nothing removed, every token the GMs'.]");
    }],

    ["R502 - where the stage makes a token: the remembered seat, kept inside the scene, else a ring of grid cells round the hall's centre, a taken cell skipped, the same every time", async () => {
        /*
         * E81 DZ6, 12.10.2026 (the DZ6 design's R476, renumbered R502 for the second fix line; design 3.3). The
         * stage makes a token at its actor's seat in the hall's record - where the module's token of the last trial
         * stood - and with none on a ring, so a first trial does not stack the cast in one corner. Asked of plain
         * numbers on a 3000x2000 rect at (500, 300), grid 100: a seat inside, one outside (clamped so the whole token
         * is in the rect), no rect; the ring of four by hand (the first at the top: centre (2000, 1300), radius
         * 2000/3, so (2000, 633.3) snapped to (2000, 600); the second at the right, (2666.7, 1300) to (2600, 1300));
         * a ring of eight - every cell on the grid, inside, distinct; the first with its cell taken (one cell
         * further out, (2000, 500)) and with every cell of its ray taken (its own cell anyway); and a second run of
         * the eight. Red at 4f4c24b: there was no `seatFor`.
         */
        const T = await import("./trial-scene.mjs");
        ok(typeof T.seatFor === "function", "trial-scene.mjs has no `seatFor` - the stage has nowhere to put a token");
        if (typeof T.seatFor !== "function") return;
        const rect = { x: 500, y: 300, width: 3000, height: 2000 }, grid = 100;
        const at = (args = {}) => T.seatFor({ rect, grid, count: 4, ...args });
        const eight = () => Array.from({ length: 8 }, (_, index) => T.seatFor({ rect, grid, index, count: 8 }));
        const ring = eight();
        const onGrid = ring.every(({ x, y }) => x % grid === 0 && y % grid === 0 && x >= rect.x && y >= rect.y
            && x <= rect.x + rect.width - grid && y <= rect.y + rect.height - grid);
        const ray = new Set(Array.from({ length: 6 }, (_, step) => `2000,${600 - 100 * step}`));
        equal(JSON.stringify([at({ seat: { x: 1500, y: 400 } }), at({ seat: { x: 9999, y: -50 } }), T.seatFor({ index: 2, grid, rect: null }),
            at({ index: 0 }), at({ index: 1 }), onGrid, new Set(ring.map(({ x, y }) => `${x},${y}`)).size,
            at({ index: 0, taken: new Set(["2000,600"]) }), at({ index: 0, taken: ray }), JSON.stringify(eight()) === JSON.stringify(ring)]),
            JSON.stringify([{ x: 1500, y: 400 }, { x: 3400, y: 300 }, { x: 200, y: 0 }, { x: 2000, y: 600 }, { x: 2600, y: 1300 }, true, 8,
                { x: 2000, y: 500 }, { x: 2000, y: 600 }, true]),
            "[a seat inside kept; one outside clamped into the rect; with no rect a line along the top; the ring's first two cells by hand; the ring of eight on the grid "
            + "and inside; its distinct cells; a taken cell skipped one further out; every cell of the ray taken, the first anyway; a second run the same]");
    }],

    ["R505 - a room's picture is only ever a path of this server: safeRoomImage keeps a relative path or one of this origin, of a still-picture type, and refuses every other scheme, another host, a query, a fragment, a `..` and any other type; the room tile draws the GM's words as text and a picture only through it, and opens it on this browser alone", async () => {
        /*
         * E77 C1, 13.10.2026; the A8 design's R380 (the E77 plan's D2 gave it this number; ledger V3), its
         * `safeRoomImage` clauses - E77 C3 adds the tile's (the GM's words drawn as text, no `data-tooltip`) and C8
         * the narrow row's. The picture is a path somebody else wrote that every player's browser fetches, at the
         * write (`setVaultRoom`) and at every read (`roomImage`) through this one function, so its table is the rule:
         * kept - a relative path as Foundry's file picker gives it (trimmed), one with a route prefix, one of this
         * page's own origin (answered as its path), an upper-case extension; refused - `javascript:`, `data:`,
         * `blob:` (of this origin too: a blob's origin is the page's), `file:`, `//host`, another host, a query, a
         * fragment, a `..` (plain or `%2e`), a backslash, a quote (the path ends up in a CSS `url("...")`), a gif and
         * an apng (an animation `prefers-reduced-motion` does not stop), a page with no extension, not a string,
         * empty. Pure: it reads `document.baseURI` and writes nothing. What a server answers to
         * a kept path - a redirect elsewhere - is no reading of the string: LIVE-E77-03.
         */
        const V = await import("./vault.mjs");
        ok(typeof V.safeRoomImage === "function", "vault.mjs has no `safeRoomImage` - a room's picture would be fetched from wherever it says");
        if (typeof V.safeRoomImage !== "function") return;
        const origin = new URL(document.baseURI).origin;
        const KEPT = [
            ["  worlds/suite/rooms/hall.webp  ", "worlds/suite/rooms/hall.webp"], ["/route/worlds/suite/hall.png", "/route/worlds/suite/hall.png"],
            [`${origin}/worlds/suite/hall.jpg`, "/worlds/suite/hall.jpg"], ["worlds/suite/HALL.JPEG", "worlds/suite/HALL.JPEG"],
            ["worlds/suite/hall.avif", "worlds/suite/hall.avif"], ["worlds/suite/plan.svg", "worlds/suite/plan.svg"]
        ];
        const REFUSED = [
            "javascript:alert(1)//x.png", "data:image/png;base64,AAAA", `blob:${origin}/x.png`, "file:///etc/x.png",
            "//evil.example/x.png", "https://evil.example/x.png", "/route?x.png", "/x.png#y", "worlds/../x.png",
            "worlds/%2E%2E/x.png", "worlds\\x.png", "worlds/x.png\")", "worlds/x.gif", "worlds/x.apng", "worlds/x", "", null, 7
        ];
        equal(JSON.stringify([KEPT.map(([path]) => V.safeRoomImage(path)), REFUSED.map(path => V.safeRoomImage(path))]),
            JSON.stringify([KEPT.map(([, kept]) => kept), REFUSED.map(() => null)]),
            `[each kept path as answered] and [each refused one: null]; this page's origin is ${origin}`);

        /*
         * E77 C3, 13.10.2026: the tile's clauses (the A8 design's R380, ledger V3, V17, L2). `paintRoomTile` is handed
         * a view on a box that is in no document - nothing on this screen is touched - with a name and a description
         * that carry markup four ways and a paragraph break, and the GM's picture: the name and the words come back
         * literal, with no element inside them and no element of those kinds anywhere in the box, nothing of the box
         * carries a data-tooltip, nothing the markup would run has run, and the art layer's picture is the path. The
         * same view with a `javascript:` picture paints no picture and no button to open one. Then `openRoomImage`
         * against stand-ins for Foundry's ImagePopout (the harness has none), for the probe's Image (so no file is
         * fetched, here or at a table) and for the warning, all three put back in `finally`: the probe is handed
         * the checked path and the window gets it, the room as its title, empty controls and no `uuid`; a refused
         * path probes and opens nothing; a picture whose probe fails to decode opens nothing and warns once; and
         * `stripImageControls` empties the tile's window's header controls and leaves another ImagePopout's alone.
         */
        const T = await import("./room-tile.mjs");
        ok(["paintRoomTile", "openRoomImage", "stripImageControls"].every(name => typeof T[name] === "function"),
            "room-tile.mjs has no `paintRoomTile`, `openRoomImage` and `stripImageControls` - there is no tile to read");
        if (typeof T.paintRoomTile !== "function") return;
        const HOSTILE = "<img src=x onerror=\"window.__drpgR505 = 1\"><script>window.__drpgR505 = 2</script>"
            + "<iframe srcdoc=\"<b>x</b>\"></iframe><b>bold</b>\n\nA second paragraph.";
        const view = image => ({ state: "room", room: "R505 <b>Hall</b>", sceneId: "SUITER505SCENE00", description: HOSTILE, image,
            tokens: { max: 3, left: 2, sealed: false }, project: true });
        const read = image => {
            const box = document.createElement("section");
            T.paintRoomTile(box, view(image));
            const prose = box.querySelector(".drpg-room-tile-prose"), name = box.querySelector(".drpg-room-tile-name");
            const art = box.querySelector(".drpg-room-tile-art");
            return [prose?.textContent === HOSTILE && prose.childElementCount === 0, name?.textContent === "R505 <b>Hall</b>" && name.childElementCount === 0,
                box.querySelectorAll("img, script, iframe, b").length, box.querySelectorAll("[data-tooltip]").length,
                art?.style.backgroundImage ?? null, Boolean(box.querySelector(".drpg-room-tile-open"))];
        };
        equal(JSON.stringify([read("worlds/suite/hall.png"), read("javascript:alert(1)//x.png"), window.__drpgR505 ?? null]),
            JSON.stringify([[true, true, 0, 0, 'url("worlds/suite/hall.png")', true], [true, true, 0, 0, "", false], null]),
            "the tile painted with [its words literal and bare, its name literal and bare, elements of the markup's kinds, data-tooltips, the art's picture, "
            + "a button to open it] for the GM's picture and for a `javascript:` one, and what the markup ran");

        const apps = foundry.applications.apps, before = Object.getOwnPropertyDescriptor(apps, "ImagePopout");
        // The stand-in goes on globalThis, which the module's `new Image()` reads: in a browser that is window, and the
        // headless harness copies jsdom's Image onto Node's own global (client-entry.mjs), so a window.Image stand-in
        // went unread there and the paths probed came back empty (13.10.2026).
        const RealImage = globalThis.Image, ownWarn = ui.notifications && Object.getOwnPropertyDescriptor(ui.notifications, "warn");
        const opened = [], probed = [], warned = [];
        let decodes = true, got;
        try {
            Object.defineProperty(apps, "ImagePopout", { configurable: true, writable: true, value: class {
                constructor(options) { this.options = options; opened.push(options); }
                async render() { return this; }
            } });
            globalThis.Image = class {
                set src(path) { probed.push(path); }
                async decode() { if (!decodes) throw new Error("R505: the stand-in does not decode"); }
            };
            if (ui.notifications) ui.notifications.warn = text => { warned.push(text); };
            const win = await T.openRoomImage("worlds/suite/hall.png", "R505 Hall");
            const refused = await T.openRoomImage("javascript:alert(1)//x.png", "R505 Hall");
            decodes = false;
            const missing = await T.openRoomImage("worlds/suite/gone.png", "R505 Hall");
            const mine = [{ action: "shareImage" }, { action: "another" }], theirs = [{ action: "shareImage" }];
            T.stripImageControls(win, mine);
            T.stripImageControls({ options: { classes: ["image-popout"] } }, theirs);
            got = [probed, opened, refused, missing, warned, mine.length, theirs.length];
        } finally {
            if (before) Object.defineProperty(apps, "ImagePopout", before);
            else delete apps.ImagePopout;
            globalThis.Image = RealImage;
            if (ownWarn) Object.defineProperty(ui.notifications, "warn", ownWarn);
            else if (ui.notifications) delete ui.notifications.warn;
        }
        equal(JSON.stringify(got), JSON.stringify([["worlds/suite/hall.png", "worlds/suite/gone.png"], [{ src: "worlds/suite/hall.png",
            classes: ["drpg-room-image"], window: { title: "R505 Hall", controls: [] }, showTitle: true }], null, null,
            [game.i18n.localize("DRPG.Room.imageMissing")], 0, 1]),
            "[the paths probed, the windows asked for, a refused path's answer, an undecodable picture's answer, the warnings, "
            + "the tile's window's header controls left, another ImagePopout's left]");
    }],
    ["R504 - a screen's room is its viewer's own and no other: roomFacts answers the GM's words and a picture of this server for the room asked on the scene asked, from the first room piece that carries them, and viewerRoom on this browser is the room viewerActor's own token stands in, on that token's scene; the tile drawn from them carries that room's words and no other's, in every state", async () => {
        /*
         * E77 C2, 13.10.2026; the A8 design's R379 (the E77 plan's D2 gave it this number; ledger V2, D1, D5), its
         * data clauses - E77 C3 adds the tile's DOM (no word and no request of another room) and scenario 74 the
         * states this suite cannot make read-only (a trial, an Eclipse, a death, a Monocub). Two halves, both read,
         * nothing written. FIRST roomFacts on plain objects, so the answer is the rule's and not a world's: a
         * Kitchen of two room pieces of which only the second carries words and a picture, a region named Kitchen
         * that is no room (listed first, with words of its own - a reader over every region of the name would
         * answer them), a Hall, a Pantry whose picture is `javascript:`, a Cellar nobody drew, and a second scene
         * with a Kitchen of its own (a reader of the camera's scene, or of the first scene of the name, would
         * answer the other's). THEN viewerRoom on the browser that runs the suite, against what it must be built
         * from: `trialSlot` first, `viewerActor` (hud.mjs) and nothing else for the actor, `locateActor` for the
         * token and its scene, and the room that token stands in - no route is being judged while the suite reads,
         * so the settled spot is the token's own (movement.mjs `settledSpot`). The other browsers' answers, and a
         * route not yet settled, are scenario 66's phase W (they need a token moved and three clients). On the
         * harness the GM's viewer is the seeded Monokuma, whose pool is the seeded GM's: scenario 66 W1 read the GM's
         * answer as the Hall, where it stands (13.10.2026).
         */
        const T = await import("./room-tile.mjs").catch(() => null);
        ok(typeof T?.roomFacts === "function" && typeof T?.viewerRoom === "function",
            "room-tile.mjs has no `roomFacts` and `viewerRoom` - there is no one answer to which room a screen shows");
        if (typeof T?.roomFacts !== "function" || typeof T?.viewerRoom !== "function") return;
        const R = await import("./rooms.mjs"), V = await import("./vault.mjs");
        const H = await import("./hud.mjs"), M = await import("./movement.mjs");
        const D = V.VAULT_FLAGS.description, I = V.VAULT_FLAGS.image;
        const piece = (id, name, flags, room = true) => ({ id, name, behaviors: [],
            getFlag: (scope, key) => (scope !== MODULE_ID ? undefined : key === R.ROOM_FLAG ? room : flags[key]) });
        const here = { id: "SUITER504HERE000", name: "R504 here", regions: new Set([
            piece("R504KX", "Kitchen", { [D]: "Not a room's words.", [I]: "worlds/suite/not-a-room.webp" }, false),
            piece("R504K1", "Kitchen", {}),
            piece("R504K2", "Kitchen", { [D]: "Pots on the wall.\nA cold stove.", [I]: "worlds/suite/kitchen.webp" }),
            piece("R504H1", "Hall", { [D]: "A long hall.", [I]: "worlds/suite/hall.png" }),
            piece("R504P1", "Pantry", { [D]: "Shelves.", [I]: "javascript:alert(1)//x.png" })
        ]) };
        const there = { id: "SUITER504THERE00", name: "R504 there", regions: new Set([
            piece("R504K9", "Kitchen", { [D]: "The other school's kitchen.", [I]: "worlds/suite/other-kitchen.jpg" })
        ]) };
        equal(JSON.stringify([["Kitchen", here], ["Hall", here], ["Pantry", here], ["Cellar", here], ["Kitchen", there]]
            .map(([room, scene]) => T.roomFacts(room, scene))),
        JSON.stringify([
            { room: "Kitchen", description: "Pots on the wall.\nA cold stove.", image: "worlds/suite/kitchen.webp" },
            { room: "Hall", description: "A long hall.", image: "worlds/suite/hall.png" },
            { room: "Pantry", description: "Shelves.", image: null },
            { room: "Cellar", description: "", image: null },
            { room: "Kitchen", description: "The other school's kitchen.", image: "worlds/suite/other-kitchen.jpg" }
        ]), "roomFacts of [the Kitchen of two pieces and a non-room namesake, the Hall, the Pantry's `javascript:` picture, a room nobody drew, "
            + "the other scene's Kitchen]");
        const viewer = typeof H.viewerActor === "function" ? H.viewerActor() : undefined;
        ok(viewer !== undefined, "hud.mjs exports no `viewerActor` - the clock and the tile could each choose their own character");
        const place = viewer ? M.locateActor(viewer) : null;
        const want = H.trialSlot() ? ["trial", null, null, null]
            : !viewer ? [game.user.isGM ? "none" : "noActor", null, null, null]
                : !place ? ["nowhere", null, null, null]
                    : [place.room ? "room" : "nowhere", place.room, place.scene.id, viewer.id];
        const got = T.viewerRoom();
        equal(JSON.stringify([got.state, got.room, got.scene?.id ?? null, got.tokenDoc?.actorId ?? null]), JSON.stringify(want),
            `viewerRoom on this browser as [state, room, scene, the token's actor]; the viewer is ${viewer?.name ?? "nobody"}`);

        /*
         * E77 C3, 13.10.2026: the tile's DOM (the A8 design's R379; ledger V2, V19, D3). On boxes in no document, so
         * nothing on this screen is touched, painted from `roomFacts` of the plain scenes above: the Kitchen's tile
         * carries the Kitchen's words and picture - the positive control, read first, so the absence after it is
         * an absence of something this reader can see - and no word or path of the Hall, of the namesake that is
         * no room, or of the other school's Kitchen. Then every state on a box of its own, as [state, a toggle, a
         * button for the picture, a picture on the art layer, the one heading's text, aria-hidden, a project
         * line]. Then the toggle: opened, it stays open through a repaint of the same room, an unchanged view
         * writes nothing, and another room closes it. Last the tile on this browser, read and not painted: its
         * state and heading are `tileView()`'s (the GM's on the harness is the Hall, where its Monokuma stands).
         * Which room each browser's tile shows, the GM's Room Setup reaching it and a crossing settling it are
         * scenario 74's (they need two players and a write).
         */
        ok(typeof T.paintRoomTile === "function" && typeof T.tileView === "function",
            "room-tile.mjs has no `paintRoomTile` and `tileView` - there is no tile to read");
        if (typeof T.paintRoomTile !== "function" || typeof T.tileView !== "function") return;
        const L = key => game.i18n.localize(key);
        const viewOf = (room, scene, extra = {}) => {
            const { description, image } = T.roomFacts(room, scene);
            return { state: image ? (description ? "room" : "roomPicture") : (description ? "roomText" : "roomBare"), room, sceneId: scene.id,
                description, image, tokens: { max: 3, left: 3, sealed: false }, project: false, ...extra };
        };
        const paint = view => {
            const box = document.createElement("section");
            T.paintRoomTile(box, view);
            return box;
        };
        const kitchen = paint(viewOf("Kitchen", here)).outerHTML;
        ok(kitchen.includes("Pots on the wall.") && kitchen.includes("worlds/suite/kitchen.webp"),
            "the Kitchen's tile does not carry the Kitchen's own words and picture - the absence read next would measure nothing");
        equal(JSON.stringify(["A long hall.", "worlds/suite/hall.png", "Not a room's words.", "not-a-room.webp", "other school", "other-kitchen.jpg"]
            .filter(word => kitchen.includes(word))), "[]", "the words and paths of other rooms found on the Kitchen's tile");
        const STATES = [
            viewOf("Kitchen", here), { ...viewOf("Kitchen", here), state: "roomPicture", description: "", project: true },
            { ...viewOf("Hall", here), state: "roomText", image: null }, viewOf("Cellar", here),
            ...["nowhere", "noActor", "trial", "none"].map(state => ({ state, room: null }))
        ];
        const stateOf = box => [box.dataset.state, Boolean(box.querySelector(".drpg-room-tile-more")), Boolean(box.querySelector(".drpg-room-tile-open")),
            Boolean(box.querySelector(".drpg-room-tile-art")?.style.backgroundImage), box.querySelector(".drpg-room-tile-name")?.textContent ?? null,
            box.getAttribute("aria-hidden"), Boolean(box.querySelector(".drpg-hud-room-project"))];
        equal(JSON.stringify(STATES.map(view => stateOf(paint(view)))), JSON.stringify([
            ["room", true, true, true, "Kitchen", null, false], ["roomPicture", false, true, true, "Kitchen", null, true],
            ["roomText", true, false, false, "Hall", null, false], ["roomBare", false, false, false, "Cellar", null, false],
            ["nowhere", false, false, false, L("DRPG.Hud.roomNowhere"), null, false],
            ["noActor", false, false, false, L("DRPG.Explain.room.noActor"), null, false],
            ["trial", false, false, false, null, "true", false], ["none", false, false, false, null, "true", false]
        ]), "each state's tile as [state, a toggle, a button for the picture, a picture on the art layer, the heading, aria-hidden, a project line]");
        const box = paint(viewOf("Kitchen", here));
        box.querySelector(".drpg-room-tile-more").click();
        const toggle = () => [box.classList.contains("is-open"), box.querySelector(".drpg-room-tile-more")?.getAttribute("aria-expanded") ?? null,
            box.querySelector(".drpg-room-tile-prose")?.hidden ?? null];
        const opened = toggle(), spent = viewOf("Kitchen", here, { tokens: { max: 3, left: 2, sealed: false } });
        const repainted = T.paintRoomTile(box, spent), kept = toggle(), again = T.paintRoomTile(box, spent);
        T.paintRoomTile(box, viewOf("Hall", here));
        equal(JSON.stringify([opened, repainted, kept, again, toggle()]), JSON.stringify([[true, "true", false], true, [true, "true", false], false,
            [false, "false", true]]), "the toggle [opened, the same room repainted, still open, the unchanged view written, another room]");

        const live = document.getElementById("drpg-room-tile"), view = T.tileView();
        ok(Boolean(live), "this browser has no #drpg-room-tile - module.mjs did not build the tile");
        if (!live) return;
        const heading = view.room ?? { nowhere: L("DRPG.Hud.roomNowhere"), noActor: L("DRPG.Explain.room.noActor") }[view.state] ?? null;
        equal(JSON.stringify([live.dataset.state, live.querySelector(".drpg-room-tile-name")?.textContent ?? null, view.room]),
            JSON.stringify([view.state, heading, got.room]), "this browser's tile as [state, heading] and tileView's room, against tileView and viewerRoom");
        /* E77 C4 (13.10.2026): beside the notices glass.mjs `placeRoomTile` hands the tile to the body, and the
           tile's own refresh must leave it there - put back under the clock between two passes, it would push the
           scene rail down for a frame and stand where its pane is not. Under the clock the refresh still seats it. */
        const home = [live.parentElement, live.nextElementSibling], was = live.dataset.place;
        try {
            live.dataset.place = "notes";
            document.body.append(live);
            const kept = T.ensureRoomTile() === live && live.parentElement === document.body;
            live.dataset.place = "clock";
            T.ensureRoomTile();
            const hud = document.getElementById("drpg-hud"), floors = hud?.nextElementSibling?.id === "drpg-floors" ? hud.nextElementSibling : hud;
            equal(JSON.stringify([kept, !hud || floors.nextElementSibling === live]), JSON.stringify([true, true]),
                "[the refresh leaves a tile placed beside the notices in the body, and seats one placed under the clock after the clock]");
        } finally {
            if (was === undefined) delete live.dataset.place; else live.dataset.place = was;
            if (home[0]) home[0].insertBefore(live, home[1]?.parentElement === home[0] ? home[1] : null);
        }
    }],
    ["R508 - the room tile keeps its place and its box whatever the room says: the place is glass.mjs roomPlacement's from the measured F alone (under the clock when F leaves the smallest box, beside the notice tile when it does not), the tile laid out at that box, the clock's width, edge and centre and the scene rail below it under the clock, the history's button clear of its pane beside the notices, the picture on the whole pane, and a new description, the description opened or a recolour recuts nothing", async () => {
        /*
         * E77 C4, 13.10.2026; the A8 design's R383 (the E77 plan's D2 gave it this number; ledger V6, V8, V9, D1, D6).
         * The place and the box are chosen once a pass by glass.mjs `placeRoomTile` from `roomPlacement`: F, the
         * height the clock's column has left over the notice tile's floor less the scene rail's run, against
         * `need` = width / 3 + heading + 4 lines. Measured in the glass harness in Chromium (13.10.2026, a player,
         * audit/glass-sweep.mjs prints the rest): 1920x1080 F 211 'notes', 1366x768 F -80 'notes', 2560x1440 F 441
         * 'clock' - the design's 1920x1080 'clock' waits for E77 C5 to take the rail out of the column. Read here at
         * this window's size: the place agrees with F and need, a second reading of roomPlacement agrees with the
         * pass's, the tile laid out (rotations off, as the curtain measures) at the placed box within a pixel, under
         * the clock at the clock's width and left edge, beside the notices with no corner of the history's button
         * (A7) on the room's pane, the picture's layer in the body at the pane's bounds and clipped to its points.
         * Then a long description is put on the tile and opened, and a pass of the glass must fire no
         * `drpgGlassCut` and report the same cut; the control - the clock 40 px taller - must fire one, or the
         * count could not see a cut; and a recolour of the same cut (the curtain's `--acc`) repaints and fires
         * none. Under the clock the scene rail's first tile must stand below the tile's box: a player's slot is
         * kept under the tile, which kept under the clock put the rail 273 px up inside it at 2560x1440 (the
         * glass harness, 13.10.2026). Only on a desk: a stacked screen's tile is E77 C8's.
         */
        const G = await import("./glass.mjs");
        needs(env.glass(), "this measures Stained Glass");
        needs(env.layout(), "the curtain's canvas has no width outside a browser");
        needs(env.desk(), "a stacked screen gets the tile's place in E77 C8");
        const tile = document.getElementById("drpg-room-tile"), hud = document.getElementById("drpg-hud");
        const cur = document.getElementById("drpg-curtain");
        ok(tile && hud && cur, "no room tile, clock or curtain on this screen - nothing to measure");
        G.refreshGlass();
        await wait(300);
        const room = G.LAST.room, pane = (G.LAST.panes || []).find(p => p.tone === "room-block");
        ok(room && room.box && pane, `the pass placed no tile (${JSON.stringify(room)}) or cut no pane for it`);
        equal(room.place, room.F - 24 >= room.need ? "clock" : "notes", `F ${room.F} and need ${room.need} choose the other place`);
        const { box, ...placed } = room;
        equal(JSON.stringify(G.roomPlacement(innerWidth, innerHeight)), JSON.stringify(placed), "a second reading of roomPlacement");
        const near = (a, b, d = 1) => Math.abs(a - b) <= d;
        const at = cur.getBoundingClientRect();
        document.body.toggleAttribute("data-drpg-measuring", true);
        const t = tile.getBoundingClientRect(), h = hud.getBoundingClientRect();
        document.body.toggleAttribute("data-drpg-measuring", false);
        void document.body.offsetWidth;
        const laid = [t.left - at.left, t.top - at.top, t.width, t.height];
        ok(laid.every((v, i) => near(v, [box.x, box.y, box.w, box.h][i])), `the tile is laid out at ${laid.map(Math.round)} and placed at ${[box.x, box.y, box.w, box.h]}`);
        if (room.place === "clock") {
            ok(near(t.width, h.width) && near(t.left, h.left) && near(t.left + t.width / 2, h.left + h.width / 2),
                `under the clock at ${Math.round(t.left)} ${Math.round(t.width)}, the clock at ${Math.round(h.left)} ${Math.round(h.width)}`);
            const rail = [...document.querySelectorAll("#scene-controls > menu button.ui-control")].filter(e => e.offsetWidth > 0 && e.offsetHeight > 0);
            if (rail.length) ok(Math.min(...rail.map(e => e.getBoundingClientRect().top)) - at.top >= box.y + box.h,
                "the scene rail's first tile stands up inside the room tile's box - its slot was kept under the clock, not under the tile");
        } else {
            const corner = document.getElementById("drpg-notices-corner")?.getBoundingClientRect();
            const inside = (poly, x, y) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) k = !k; } return k; };
            ok(corner?.width, "no history button beside the notices to keep free");
            const on = [[corner.left, corner.top], [corner.right, corner.top], [corner.right, corner.bottom], [corner.left, corner.bottom]]
                .filter(([x, y]) => inside(pane.poly, x - at.left, y - at.top)).length;
            equal(on, 0, "corners of the history's button on the room's pane");
        }
        const art = document.getElementById("drpg-room-art");
        if (art || tile.querySelector(".drpg-room-tile-art")) {
            ok(art && !tile.contains(art), "the picture is still inside the tile, not on its pane");
            const r = art.getBoundingClientRect(), points = (getComputedStyle(art).clipPath.match(/px/g)?.length ?? 0) / 2;
            const got = [r.left - at.left, r.top - at.top, r.right - at.left, r.bottom - at.top];
            ok(got.every((v, i) => near(v, [pane.x0, pane.y0, pane.x1, pane.y1][i], 1.5)) && points === pane.poly.length,
                `the picture at ${got.map(Math.round)} clipped to ${points} points, its pane at ${[pane.x0, pane.y0, pane.x1, pane.y1]} with ${pane.poly.length}`);
        }
        let cuts = 0;
        const count = () => { cuts++; };
        const hook = Hooks.on("drpgGlassCut", count);
        const was = tile.classList.contains("is-open"), prose = document.createElement("p"), row = document.createElement("div");
        try {
            prose.textContent = "Words. ".repeat(400);
            tile.append(prose);
            tile.classList.add("is-open");
            G.refreshGlass();
            await wait(300);
            const content = [cuts, Boolean(G.CHECKS.at(-1)?.same)];
            row.style.height = "40px";
            hud.append(row);
            G.refreshGlass();
            await wait(300);
            const control = cuts;
            row.remove();
            G.refreshGlass();
            await wait(300);
            const settled = cuts;
            cur.style.setProperty("--acc", "#ff2050");
            G.refreshGlass();
            await wait(300);
            equal(JSON.stringify([...content, control > content[0], cuts - settled]), JSON.stringify([0, true, true, 0]),
                "[cuts after a long description opened, the same cut, the control's taller clock cut, cuts after a recolour of the same cut]");
        } finally {
            prose.remove(); row.remove(); tile.classList.toggle("is-open", was); cur.style.removeProperty("--acc");
            Hooks.off("drpgGlassCut", hook);
            G.refreshGlass();
        }
    }],
];

/**
 * The translation keys R1 cannot see, because no file spells them out: each is
 * put together at run time from a known value (E30, audit S14-25).
 *
 * This list used to be every key worth checking, gathered by hand, with a note
 * that reading the source from the browser was impossible. R1 reads every
 * literal "DRPG.x" in the source, from the files Foundry serves, so the list
 * only repeated it: on 1.2.60, R1's pattern read 69 of its 78 keys. Of the
 * other nine, two (Murder.betrayTileLabel and betrayTileHint) were used by no
 * file and left this list; they stayed in en.json and pl.json, stating a
 * betrayal rule the module no longer has, until E32+E07 fix r2-G4 deleted them
 * (03.10.2026). Seven were built at run time. Four were left here, and
 * E32+E07 C16 added two:
 *
 *   murder.mjs         victimTrapSprung / victimUnderAttackBy, by `state.indirect`
 *                      (victimUnderAttack until E06 C4, which names the killer)
 *   season-setup.mjs   `DRPG.Season.step.${key}` and `.hint.`, for the resources step
 *   murder.mjs         `DRPG.Roll.opening.${side}`, the opening's window and request card
 *                      (E32+E07 C16 found them built and unlisted since 1.2.50)
 *
 * The other three were `DRPG.Bridge.what.${action}` keys, and left in E31
 * (25.09.2026): R1b checks that whole family now, in both files - the label of
 * every action in the bridge's tables, every request named to `tellRefused` by
 * hand, and the sentence of every reason (`DRPG.Bridge.why.${code}`). The rest
 * of the season steps is checked by no test.
 */
const LITERAL_KEYS = [
    "DRPG.Murder.victimUnderAttackBy", "DRPG.Murder.victimTrapSprung",
    "DRPG.Season.step.resources", "DRPG.Season.hint.resources",
    // E12 C1: the row that names the regions no GM has decided.
    "DRPG.Season.step.roomsMarked", "DRPG.Season.hint.roomsMarked",
    // E13 C5: the row that says whether the school and the trial hall are linked.
    "DRPG.Season.step.scenes", "DRPG.Season.hint.scenes",
    "DRPG.Roll.opening.killer", "DRPG.Roll.opening.victim",
    // monocub.mjs labels a row's choices `DRPG.Monocub.<choice>` (E33 C10): the two the table has.
    "DRPG.Monocub.help", "DRPG.Monocub.hinder",
    // sheet-audit.mjs names a field put back by its kind (E29 C3), and bridge-guards.mjs `requestLabel` the same;
    // a flagged one too (C5: actions, Health, Sanity, the grants), an item's (C6), an armed Call (C8),
    // Daggerheart's level-up selections (E29 fix r1-G2) and its scars (fix r2-H25).
    ...["traits", "experience", "max", "rules", "bonuses", "flag", "effect", "hope", "actions", "hitPoints", "stress", "grant",
        "itemFlag", "itemQuantity", "itemLocation", "itemDeleted", "itemCreated", "pendingCall", "levelData", "scars"]
        .map(kind => `DRPG.Audit.field.${kind}`),
    // cleanup.mjs names a Stage 6 roll's band on the GMs' copy `DRPG.Action.duality.<band>` (E09 C14): the three bands.
    ...["hope", "despair", "critical"].map(band => `DRPG.Action.duality.${band}`),
    // chapter.mjs names a failed step of the chapter's end `DRPG.Chapter.step.<key>` (E11 C5): `CHAPTER_END_STEPS`' nine keys.
    ...["reveal", "sweep", "faint", "keys", "tools", "clock", "trial", "morning", "hold"].map(key => `DRPG.Chapter.step.${key}`),
    // season-setup.mjs `wipeSeason` writes the report of a reset that did not finish `DRPG.Season.reportCard.<line>` (E11 C9).
    ...["failed", "done", "kept"].map(line => `DRPG.Season.reportCard.${line}`)
];

/*
 * The notice history's engine over a value in memory (R292, R297; E81 C1): `store.raw` is the stored text as
 * localStorage would hold it, `store.writes` counts the writes and `store.fail` makes that many writes throw.
 * Nothing is debounced - a test flushes - and the time and the clock are the caller's objects to move. Ids are
 * numbered across every engine made here, so two tabs never draw the same one. The html is kept as given unless
 * the caller hands the bench a cleaner (E81 C2): the store's tests weigh lengths, and R294 measures the cleaning
 * on the module's own engine. `messageExists` is the chat log the engine reads at `open` (E81 C5, R295); without
 * one nothing is marked deleted there. `store.now` counts the writes made before the call returns (giving way, E81 C6,
 * R298), apart from `store.writes`.
 */
let noticeIds = 0;
function noticeBench(createNoticeEngine, { store, user, world, gm = false, at, clock, clean = html => html, messageExists }) {
    return createNoticeEngine({
        worldId: () => world, userId: () => user, isGM: () => gm, now: () => at.now,
        randomId: () => `SuiteNotice${String(++noticeIds).padStart(5, "0")}`,
        clock: () => clock.value, userExists: () => true, clean, messageExists,
        storage: {
            read: () => store.raw,
            write: async value => {
                if (store.fail > 0) { store.fail--; throw new Error("the suite's full storage"); }
                store.raw = JSON.stringify(value);
                store.writes++;
            },
            writeNow: value => {
                store.raw = JSON.stringify(value);
                store.now = (store.now ?? 0) + 1;
            }
        },
        timers: { set: () => 0, clear: () => {} },
        log: { warn: () => {}, debug: () => {} }
    });
}

/**
 * The box a fixed element's insets are measured from, in the window's coordinates (E81 fix r2-H2, 13.10.2026; review
 * round 2's P23; R299 (a), (c) and (d)). R299 read the corner's insets against the window, and under Stained Glass that
 * is not their containing block - an ancestor carries a filter, and glass.mjs records the two 9 px apart on the right
 * (`LAUNCH_CLEAR`) -, so a first red in a browser could have been that offset. A fixed probe beside the element, with
 * no insets of its own, covers the same block. In a browser only; R299 has not run in one (LIVE-E81-02).
 */
function insetBox(el) {
    const probe = document.createElement("div");
    probe.style.cssText = "position: fixed; inset: 0; visibility: hidden; pointer-events: none";
    (el.parentElement ?? document.body).append(probe);
    const box = probe.getBoundingClientRect();
    probe.remove();
    return box;
}

/**
 * A length as the cascade gives it, in px (E81 C12, 12.10.2026; R474, R299 (a) and (c)). In a browser
 * `getComputedStyle` resolves an inset or a size to px and this only parses it. Headless, jsdom hands a
 * standard property back as written - "calc(var(--drpg-edge, 16px) + var(--drpg-launch-m-right))" - so
 * every var() is replaced by the element's own custom property (the harness substitutes those) or its
 * fallback, and the calc() is worked out here: + - * /, brackets, calc(), min() and max(), px, and the
 * viewport units against `view` - the window's, unless the reading is for another size. A unitless
 * number counts as a factor; a keyword, an unknown unit or a var() left over is NaN, which fails every
 * comparison it reaches.
 */
function cascadePx(el, prop, view = { w: innerWidth, h: innerHeight }) {
    const style = getComputedStyle(el);
    let text = String((prop.startsWith("--") ? style.getPropertyValue(prop) : style[prop]) ?? "").trim();
    for (let i = 0; i < 16 && text.includes("var("); i++) {
        text = text.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/, (all, name, fallback) => style.getPropertyValue(name).trim() || (fallback ?? "").trim());
    }
    const tokens = text.match(/\d*\.?\d+(?:e-?\d+)?[a-z%]*|(?:calc|min|max)\(|[()+\-*/,]|[^\s()+\-*/,]+/gi) ?? [];
    const unit = { "": 1, px: 1, vh: view.h / 100, dvh: view.h / 100, svh: view.h / 100, lvh: view.h / 100, vw: view.w / 100, dvw: view.w / 100 };
    let at = 0;
    const atom = () => {
        const token = tokens[at++] ?? "";
        if (token === "(" || token === "calc(") { const value = sum(); return tokens[at++] === ")" ? value : NaN; }
        if (token === "min(" || token === "max(") {
            const args = [sum()];
            while (tokens[at] === ",") { at++; args.push(sum()); }
            return tokens[at++] === ")" ? Math[token.slice(0, 3)](...args) : NaN;
        }
        if (token === "-") return -atom();
        const number = /^(\d*\.?\d+(?:e-?\d+)?)([a-z%]*)$/i.exec(token);
        return number && number[2].toLowerCase() in unit ? Number(number[1]) * unit[number[2].toLowerCase()] : NaN;
    };
    const product = () => {
        let value = atom();
        while (tokens[at] === "*" || tokens[at] === "/") value = tokens[at++] === "*" ? value * atom() : value / atom();
        return value;
    };
    const sum = () => {
        let value = product();
        while (tokens[at] === "+" || tokens[at] === "-") value = tokens[at++] === "+" ? value + product() : value - product();
        return value;
    };
    const value = sum();
    return at === tokens.length ? value : NaN;
}

/**
 * THE CORNER'S GRID, READ BACK (E81 C12, 12.10.2026; R474 headless, R299 (a) and (c) in a browser). The three
 * buttons and the roster as the cascade places them - each one's inset from the right and from the bottom and its
 * size, through `cascadePx`, never a box: under Stained Glass the corner turns with its pane and a turned box is not
 * the button - set beside what the tokens say they should be. Every entry is a pair of strings rounded to 0.01 px or
 * a truth, so one `equal` shows the whole reading against the whole expectation.
 * The shape is the drawn one: the clip-path's hexagon (its slanted sides read off the polygon: from the top vertex
 * to (100%, k), so a side stands 0.25 / |(k, 0.5)| of the size from the centre, along that normal) or, with no
 * clip-path, Monokuma Legacy's circle. A pair on one row faces flat to flat, a pair across rows slanted to slanted.
 * `roster` is the panel to read (the caller's: a temporary one, or the GM's own); `views` the window sizes its
 * ceiling is worked out at - the window's own in a browser, where the value comes back already resolved.
 */
function cornerReading(roster, views) {
    const body = document.body, glass = body.classList.contains("drpg-theme-stained-glass");
    const token = name => cascadePx(body, name);
    const round = value => Number.isFinite(value) ? value.toFixed(2) : String(value);
    const place = id => {
        const el = document.getElementById(id);
        return { el, right: cascadePx(el, "right"), bottom: cascadePx(el, "bottom"), w: cascadePx(el, "width"), h: cascadePx(el, "height") };
    };
    const M = place("drpg-messenger-launcher"), S = place("drpg-sound-launcher"), B = place("drpg-book-launcher");
    const clip = getComputedStyle(M.el).clipPath ?? "none";
    const slant = /^polygon\(\s*50%\s+0(?:px|%)?\s*,\s*100%\s+([\d.]+)%/.exec(clip);
    const k = slant ? Number(slant[1]) / 100 : null, norm = k === null ? 1 : Math.hypot(k, 0.5);
    const centre = q => ({ x: q.right + q.w / 2, y: q.bottom + q.h / 2 });
    const gap = (a, b) => {
        const dx = Math.abs(centre(a).x - centre(b).x), dy = Math.abs(centre(a).y - centre(b).y);
        if (k === null) return clip === "none" ? Math.hypot(dx, dy) - (a.w + b.w) / 2 : NaN;
        return dy < 0.5 ? dx - (a.w + b.w) / 2 : (dx * k + dy * 0.5) / norm - 0.25 * (a.w + b.w) / norm;
    };
    const edge = token("--drpg-edge"), lift = token("--drpg-av-lift") || 0, clear = glass ? token("--drpg-launch-clear") || 0 : 0;
    const L = token("--drpg-launcher"), s = token("--drpg-launcher-small"), b = token("--drpg-launcher-book"), g = token("--drpg-launch-gap");
    const seen = {
        shape: glass ? (k === null ? clip : "hexagon") : clip,
        sizes: [M.w, M.h, S.w, S.h, B.w, B.h].map(round).join(" "),
        wall: [B.right, B.bottom].map(round).join(" "),
        line: round(S.bottom),
        gaps: [gap(M, S), gap(M, B), gap(S, B)].map(round).join(" "),
        centred: round(centre(M).x - (centre(S).x + centre(B).x) / 2),
        above: centre(M).y > S.bottom + S.h && centre(M).y > B.bottom + B.h,
        height: round(M.bottom + M.h - S.bottom),
        roster: {
            foot: round(cascadePx(roster, "bottom") - (M.bottom + M.h)),
            right: round(cascadePx(roster, "right") - M.right),
            /* A ceiling below zero is none (CSS clamps it); the parser does not, so it is clamped here. */
            top: views.map(view => view.h - cascadePx(roster, "bottom", view) - Math.max(0, cascadePx(roster, "max-height", view)))
                .map(top => (top >= 8 - 0.05 ? "8 or more" : round(top))).join(" ")
        }
    };
    const want = {
        shape: glass ? "hexagon" : "none",
        sizes: [L, L, s, s, b, b].map(round).join(" "),
        wall: [edge + clear, edge + token("--drpg-launch-b-bottom") + lift].map(round).join(" "),
        line: round(edge + lift),
        gaps: [g, g, g].map(round).join(" "),
        centred: round(0),
        above: true,
        height: round(token("--drpg-launch-h")),
        roster: { foot: round(8), right: round(0), top: views.map(() => "8 or more").join(" ") }
    };
    return { seen, want };
}

export { INVARIANTS };
