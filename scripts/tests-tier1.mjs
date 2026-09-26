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
    otherSources, stripComments, bodyOf, fnSource, STANDING
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
        needs(world.atLeast("stashes"), "a stash to hold to its owner");
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
            await fetch(`/modules/${MODULE_ID}/scripts/murder.mjs`).then(r => r.text()));

        const body = bodyOf(src, "export function betrayalTarget", { length: 2600 });
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
        const writer = bodyOf(src, "async function writeState", { until: "\n}" });
        ok(/armBetrayalWindow/.test(writer),
            "the window is armed somewhere other than the single state writer");
        ok(/before\.stage !== "resolution"/.test(writer),
            "the window is armed off the state rather than the transition, so it re-arms");

        // Single use, spent before the attempt rather than after it.
        ok(/clearBetrayalOffer\(\)/.test(bodyOf(src, "export async function betrayAsPlayer", { length: 1400 })),
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
        const lane = px(chat, "right") - px(book, "right");
        equal(Math.round(lane), Math.round(book.offsetWidth + 8), "the chat circle is not one book and 8 px inboard of the book");
        const centre = (el) => px(el, "bottom") + el.offsetHeight / 2;
        ok(Math.abs(centre(book) - (centre(chat) + centre(gear)) / 2) < 1,
            "the book is not level with the midpoint of the chat and settings circles");
        ok(book.offsetWidth < gear.offsetWidth && gear.offsetWidth < chat.offsetWidth,
            "the book is not the smallest of the three");

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

        // Listen names only the rooms the listener has discovered.
        const listen = src("action-rolls.mjs");
        const body = bodyOf(listen, "async function performListen", { until: "\n}" });
        ok(/roomsKnownToMe\(\)/.test(body) && /DRPG\.Listen\.unknownRoom/.test(body),
            "Listen names every neighbouring room again, discovered or not");
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
                closers.push(showPopup(`<p>${n}</p>`, { title: "R109" }));
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
            scene: { documentName: "Scene", name: "Floor", flags: { daggerheart: { sceneEnvironments: ["a", "b"] } } }
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

    ["R135 - a Reroll receipt pays for one undo of each kind, for a few minutes", async () => {
        /*
         * E03, 24.09.2026; audit S10-40. The GM-side receipt a player's Reroll leaves
         * (reroll-receipts.mjs), asked about made-up receipts.
         */
        const R = await import("./reroll-receipts.mjs");
        const now = 1e12;
        ok(R.rerollReceiptRefusal(null, { now }), "no receipt pays for an undo");
        ok(!R.rerollReceiptRefusal({ at: now - 1000, used: new Set() }, { kind: "observe", now }), "a fresh receipt is refused");
        ok(R.rerollReceiptRefusal({ at: now - 10 * 60_000, used: new Set() }, { kind: "observe", now }), "a ten-minute-old receipt still pays");
        ok(R.rerollReceiptRefusal({ at: now, used: new Set(["despair"]) }, { kind: "despair", now }), "one receipt pays for two Despair corrections");
        ok(!R.rerollReceiptRefusal({ at: now, used: new Set(["despair"]) }, { kind: "observe", now }), "spending one kind used up another");
        equal(R.receiptDespairDelta({ wasFear: false, nowFear: true }), 1, "a roll that became Despair does not owe +1");
        equal(R.receiptDespairDelta({ wasFear: true, nowFear: false }), -1, "a roll that stopped being Despair does not owe -1");
        equal(R.receiptDespairDelta({ wasFear: true, nowFear: true }), 0, "a roll that stayed Despair owes a point");
        equal(R.receiptDespairDelta({ wasFear: null, nowFear: false }), -1, "an unseen roll is not read off its new dice");
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
        const { sessionFailures } = await import("./utils.mjs");
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
            await ask(`r162.throws${where}`);
            const refusals = sent.filter(p => p.action === "bridge.refused");
            equal(refusals.length, 1, `an exception in the ${where.toLowerCase()} was not told as one refusal`);
            equal(refusals[0]?.reason, "failed", `an exception in the ${where.toLowerCase()} was not told as failed`);
            ok(sessionFailures().some(e => e.message.includes(`Refused a "r162.throws${where}"`) && e.message.includes("the handler failed")),
                `an exception in the ${where.toLowerCase()} was not logged as "the handler failed"`);
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
         * client. Red on copies with each of those faults planted.
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
        const real = { spend: SearchTokens.spend, takePlant: SearchTokens.takePlant };
        SearchTokens.spend = async (room, sceneId) => { recorded.push(`spend ${room} ${sceneId}`); return true; };
        SearchTokens.takePlant = async (room, sceneId) => { recorded.push(`takePlant ${room} ${sceneId}`); return null; };
        try {
            for (const action of ["searchTokens.spend", "searchTokens.takePlant"]) {
                await judge(SEARCH_ACTIONS, { action, requestId: `r166-${action}`, userId: user.id, actorId: actor.id,
                    roomName: place.room, sceneId: B }, user.id, { send: (to, packet) => told.push(packet.action) });
            }
        } finally {
            SearchTokens.spend = real.spend;
            SearchTokens.takePlant = real.takePlant;
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
         * weak write loses to anything real and is not dead after a cut; the sub-keys of a
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

        const weak = sec();
        G.raiseCleared(weak, 1000, spec);
        write(weak, "k", { v: "weak" }, weak.cleared + 1);
        equal(weak.e.k?.v, "weak", "a weak write after a cut is dead on arrival");
        const real = write(sec(), "k", { v: "real" }, 1500);
        ok(merge(weak, real).e.k.v === "real" && merge(real, weak).e.k.v === "real", "a weak write beat a real one");

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
            const node = (id, { gm = true } = {}) => {
                const store = new Map();
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
                const n = { id, gm, eng, handle };
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
            const a = w.node("R170A"), b = w.node("R170B"), c = w.node("R170C");
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
                a: a.eng.hydration().state, c: c.eng.hydration().state });
        }
        const wrong = runs.filter(r => !r.same || J(r.u1) !== J({ faint: true, realType: "key", remnantId: "R170TRACE" }) || r.u2 !== null
            || r.a !== "answered" || r.c !== "answered");
        equal(J(wrong), "[]", "three GMs did not converge on the newest fields, or were not answered, for some delivery order");

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
        const flat = S.readCaseFile(J({ "Actor.R173.Item.R173": { realType: "key", updated: 5 } }));
        equal(J([flat.kind, flat.stores?.bullets?.e?.["Actor.R173.Item.R173"]?.realType]), J(["flat", "key"]),
            "the Truth Bullet export of 1.2.62 is not read as the bullets' section");
    }],

    ["R174 - the case health report counts this world as it stands", async () => {
        /*
         * E04, 26.09.2026; audit S05-09, S04-24. The primary's check at load (and any
         * GM's `game.drpg.gmStoreHealth()`) says what this browser is missing of the
         * case. It reads; it writes nothing (this tier's runner holds it to that). Held:
         * the traces it counts are the Remnant tokens on every scene, and every one of
         * them is either missing its answer key or has one - the two add up; the same
         * for the Truth Bullets in the world; each row is a level the report knows and a
         * sentence both languages carry; and its count of missing rows is its rows.
         */
        needs(world.atLeast("remnantTokens", 1), "the report counts the traces on the map");
        const S = await import("./gm-stores.mjs");
        const { remnantData } = await import("./remnants.mjs");
        const report = await S.gmStoreHealth();
        ok(report?.counts, "a GM's health report carried no counts");
        const tokens = [...game.scenes].flatMap(scene => [...scene.tokens].filter(t => t.getFlag(MODULE_ID, "isRemnant")));
        equal(report.counts.traces.of, tokens.length, "the report counts other traces than the Remnant tokens on every scene");
        equal(report.counts.traces.missing + tokens.filter(t => remnantData(t)).length, tokens.length,
            "traces missing an answer key and traces holding one do not add up to the traces on the map");
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

        /* The senders: the function that emits a copy to a player, and the file that calls it.
           "own": the sender reads the stamps itself - the offers', from the store's rows for the
           user's characters (C8), and the fog's, a section of the store (C9) - so a call of it
           passes none. */
        const SENDERS = [["mastermind.mjs", "sendDoorFlag"], ["murder.mjs", "sendCast"], ["gm-bridge.mjs", "sendOffersTo", "own"],
            ["fog.mjs", "sendStoreTo", "own"]];
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
    }]
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
 * file and are gone; seven were built at run time. Four are left here:
 *
 *   murder.mjs         victimTrapSprung / victimUnderAttack, by `state.indirect`
 *   season-setup.mjs   `DRPG.Season.step.${key}` and `.hint.`, for the resources step
 *
 * The other three were `DRPG.Bridge.what.${action}` keys, and left in E31
 * (25.09.2026): R1b checks that whole family now, in both files - the label of
 * every action in the bridge's tables, every request named to `tellRefused` by
 * hand, and the sentence of every reason (`DRPG.Bridge.why.${code}`). The rest
 * of the season steps is checked by no test.
 */
const LITERAL_KEYS = [
    "DRPG.Murder.victimUnderAttack", "DRPG.Murder.victimTrapSprung",
    "DRPG.Season.step.resources", "DRPG.Season.hint.resources"
];

export { INVARIANTS };
