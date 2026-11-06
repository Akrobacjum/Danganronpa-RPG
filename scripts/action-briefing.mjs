/**
 * Danganronpa RPG - the briefing an action opens with.
 * ---------------------------------------------------------------------------
 * What an action says before it is committed to: the block at the top of the
 * action's own window (`briefingBlock`) and its facts (`briefingFacts`) - the
 * price, the Move's line (`moveLine`), the ladders and thresholds the rules
 * hold (`ladderRows`, `thresholdFacts`), who is watching - the one action that
 * still opens a briefing window of its own, Move (`briefing`), and Tamper's
 * erase ladder for the character (`tamperThresholdFacts`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C3 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports `briefingBlock` and `moveLine`, the two names here it exported
 * before, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md). `briefing` and `tamperThresholdFacts` are exported
 * now because `performAction` and Tamper (action-tamper.mjs since E41 C4)
 * call them;
 * action-rolls.mjs does not re-export them. cleanup.mjs is imported statically
 * because `briefingFacts` is synchronous (R8 renders it for every action);
 * cleanup.mjs reaches the action family only through `import()` of
 * action-rolls.mjs. Of the action family it reads action-pipeline.mjs alone
 * (`toolRelief`).
 */

import {
    ACTIONS, TRAITS, INDIRECT_MURDER, SABOTAGE_CONCEAL, CLEANUP, OBSERVE_DC, ANALYZE_DC, REMNANT_VISIBILITY,
    REMNANT_VISIBILITY_LABELS, PRICE_CHAINS
} from "./config.mjs";
import { actionsLeft, nextCrossingPrice } from "./actions.mjs";
import { quotePrice, priceLine } from "./price.mjs";
import { tamperQuote, witnessesTo } from "./cleanup.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { othersInRoom, locateActor } from "./movement.mjs";
import { projectsAvailableIn, isIndirectMurder } from "./projects.mjs";
import { error, plural, esc } from "./utils.mjs";
import { equippedFor, tierOf } from "./use-items.mjs";
import { toolRelief } from "./action-pipeline.mjs";
import { drpgWindow } from "./ui-kit.mjs";

/* ==========================================================================
 * BRIEFING
 * ========================================================================== */

/**
 * The briefing as a block of HTML, for an action that already opens a window.
 *
 * Almost every action used to cost two module windows before the dice: a
 * briefing that said what the action does, and then the window that actually
 * asked something - which goal, which room, which Truth Bullet. Three windows
 * with the roll dialog, for one declaration.
 *
 * So the briefing stopped being a window. It is now a header inside the window
 * the action was going to open anyway: same words, same facts, one fewer click,
 * and the description is right there while you make the choice it describes
 * rather than one dismissal earlier.
 *
 * `briefing()` below still exists for Move, which asks nothing and therefore has
 * no window of its own to fold into.
 */
export function briefingBlock(actor, actionKey, def, { extraFacts = [] } = {}) {
    /* A FACT IS A LINE, OR A LINE BOUND TO A ROW (E21 C5b, 06.11.2026; audit S02-07, S02-06). `{ text, when }` is drawn
       with `data-drpg-when`: the stylesheet shows it while the menu's row of that value is picked (the rule beside
       the request box's), so a menu says the thresholds of the option picked, not of all of them. `{ text, all }` goes
       under "All thresholds", a closed <details> below the list: the ladders a player may look up and need not read
       (Observe's Key, faint and daily-life ladders, the owner's Q-E21-2 default). A string is a line shown always. */
    const facts = briefingFacts(actor, actionKey, def, extraFacts).map(f => (typeof f === "string" ? { text: f } : f));
    const li = f => {
        const when = Array.isArray(f.when) ? f.when.join(" ") : f.when;
        return `<li${when ? ` data-drpg-when="${esc(when)}"` : ""}>${f.text}</li>`;
    };
    const shown = facts.filter(f => !f.all), more = facts.filter(f => f.all);

    const paragraphs = String(def.description ?? def.hint ?? "")
        .split(/\n\s*\n/)
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => `<p>${foundry.utils.escapeHTML(part)}</p>`)
        .join("");

    const instruction = def.instruction
        ? `<p class="drpg-briefing-instruction">${foundry.utils.escapeHTML(def.instruction)}</p>`
        : "";

    return `<div class="drpg-briefing-block">
        ${paragraphs}
        ${instruction}
        <ul class="drpg-briefing-facts">${shown.map(li).join("")}</ul>
        ${more.length ? `<details class="drpg-briefing-all"><summary>${game.i18n.localize("DRPG.Kit.allThresholds")}</summary>
            <ul class="drpg-briefing-facts">${more.map(li).join("")}</ul></details>` : ""}
    </div>`;
}

/**
 * WHAT THE NEXT ROOM TAKES (E37 C6, 01.11.2026; E37-28, audit S10-48). The Move briefing said "the next room costs an
 * action" whenever the Free Move was gone, and a crossing pays a Sprint and then a banked Burst before an action
 * (actions.mjs `takeMove`, D21: the order is unchanged): a player who had bought a Burst for their next action read that
 * it would cost an action and found the Burst spent by the walk. The line now names the price the next crossing takes,
 * read by actions.mjs `nextCrossingPrice` in `takeMove`'s order; with nothing left to pay, `Move.noBudget`. Exported for
 * the suite (R1200).
 */
export function moveLine(actor) {
    switch (nextCrossingPrice(actor)) {
        case "free": return game.i18n.localize("DRPG.Move.freeAvailable");
        case "sprint": return game.i18n.localize("DRPG.Move.nextSprint");
        case "burst": return game.i18n.localize("DRPG.Move.nextBurst");
        case "action": return game.i18n.format("DRPG.Move.freeSpent", { left: actionsLeft(actor) });
        default: return game.i18n.localize("DRPG.Move.noBudget");
    }
}

/** The cost / statistics / room lines every briefing ends with. */
function briefingFacts(actor, actionKey, def, extraFacts = []) {
    const place = locateActor(actor);
    const room = place?.room ?? null;
    const cost = def.cost ?? 1;
    const facts = [];

    if (actionKey === "move") {
        facts.push(moveLine(actor));
    } else if (actionKey === "rest") {
        // No cost line at all. Rest is the one action whose price depends on a
        // choice made further down the same window, and the two rows below it
        // already price Short and Long separately against what you have - a
        // summary above them would be the same sentence twice.
    } else if (PRICE_CHAINS[actionKey]) {
        /*
         * A PRICED ACTION SAYS WHAT IT WILL TAKE, NOT WHAT IT COSTS (T-1).
         *
         * "Costs 1 action. You have 0" is a true sentence that answers the wrong
         * question once the price is a chain: what the player needs to know is
         * that this one is about to be paid in Hope, or in a Sanity mark, and
         * that the mark is their last. `priceLine` is that sentence, and it comes
         * from the same quote the tile and the payer read.
         */
        facts.push(priceLine(actor,
            // The killer on their own night pays no action step (D3), nor anything for the
            // free attempt (`tamperQuote`), and the briefing has to say the price the charge
            // will really take.
            actionKey === "tamper" ? tamperQuote(actor) : quotePrice(actor, actionKey)));
    } else if (cost > 0) {
        facts.push(plural("DRPG.Action.willCost", { n: cost, left: actionsLeft(actor) }));
    }

    // Not for a project's roll (E32+E07 C11d): Projects and Sabotage list the four a
    // project's statistic is given from, and the roll takes that project's one - which
    // the project list below names beside each project instead.
    if (def.traits?.length && actionKey !== "project" && actionKey !== "sabotage") {
        facts.push(game.i18n.format("DRPG.Action.usesTrait", {
            traits: def.traits.map(t => TRAITS[t]?.label ?? t).join(" / ")
        }));
    }

    facts.push(room
        ? game.i18n.format("DRPG.Action.youAreIn", { room: foundry.utils.escapeHTML(room) })
        : game.i18n.localize("DRPG.Action.noRoomNote"));

    // How many searches this room has left, from the counter itself. The
    // description used to promise "three searches per time of day" - three is
    // the DEFAULT of a world setting a GM may set anywhere from 0 to 10, so
    // for any table that touched it the sentence was simply false. This says
    // what is true of the room the character is standing in, now.
    if (actionKey === "search" && room) {
        facts.push(game.i18n.format("DRPG.Action.searchTokensLeft", {
            left: SearchTokens.left(room, place?.scene),
            max: SearchTokens.max
        }));
    }

    /*
     * SOMEBODY IS WATCHING, AND IT IS GOING TO COST YOU.
     *
     * Tamper's tile says "1 action" and that is the whole price in an empty
     * room. With anybody else in it the guide's concealment roll fires first,
     * and a Despair failure there is two Sanity - a third of the bar, for an
     * action advertised as costing none of it.
     *
     * MEASURED, which is why this line exists: Player A tampered in a room with
     * three other people in it and came out of a 1-action tile two Sanity
     * lighter. The rule is right - being seen cleaning up is the entire risk of
     * cleaning up - but walking into the next room first is a real alternative,
     * and a player can only choose it if they know it is one.
     *
     * Counted where the roll counts it (`othersInRoom`), AND THROUGH THE SAME FILTER
     * (T-1): `witnessesTo` exempts a killer's accomplices, so counting everybody
     * in the room told a killer with a partner standing next to them that the
     * concealment would cost Sanity when no concealment was going to happen at
     * all. The comment above has claimed the two answers agree since the line was
     * written; now they do.
     */
    if (actionKey === "tamper") {
        // Once, with the number the cover is rolled against (E21 C5b; audit S02-07): the Tamper menu said the watchers
        // twice, here and in its thresholds (`dcConceal`, gone from `tamperThresholdFacts`), in two verbs.
        const watching = witnessesTo(actor, othersInRoom(actor)).length;
        if (watching) {
            facts.push(plural("DRPG.Tamper.watched", { n: watching, dc: CLEANUP.conceal.threshold }));
        }
    }

    // Observe's miss price, from the constant the roll actually charges.
    if (def.failStress) {
        facts.push(game.i18n.format("DRPG.Action.failStress", { n: def.failStress }));
    }

    // THE NUMBERS, FROM THE TABLE THE ROLL WILL BE SCORED AGAINST (D1, Dawid
    // 13.09): every threshold a briefing can know before the dice, computed
    // for this character as they stand - tool in hand, witnesses, the state of
    // the scene - and the ladder where the exact row is the GM's to pick.
    try { facts.push(...thresholdFacts(actor, actionKey, def)); } catch (err) { error("Could not print the thresholds", err); }
    facts.push(...extraFacts);

    // Same question the tile's stripe asks, and it has to be asked the same
    // way: `callsGm` can be a predicate on the character now. A briefing that
    // says "this waits for the GM" over a tile that does not is worse than
    // saying nothing - see `callsGmFor` in sheet.mjs.
    const callsGm = typeof def.callsGm === "function"
        ? (() => { try { return Boolean(def.callsGm(actor)); } catch { return false; } })()
        : Boolean(def.callsGm);
    if (callsGm) facts.push(game.i18n.localize("DRPG.Action.callsGmNote"));

    return facts;
}

/** "Obvious 9 · Evident 12 · Subtle 15 · Hidden 18" from one column of a DC table. */
function ladderRows(column) {
    return REMNANT_VISIBILITY.map(v => game.i18n.format("DRPG.Action.dcLadderRow", {
        label: REMNANT_VISIBILITY_LABELS[v] ?? v, n: column[v]
    })).join(" · ");
}

/** The thresholds an action will be scored against, as the player stands now. */
function thresholdFacts(actor, actionKey, def) {
    const facts = [];
    // `bound`: `{ when }` (the row that shows the line) or `{ all: true }` (under "All thresholds"), see `briefingBlock`.
    const f = (key, data, bound = null) => facts.push(bound ? { text: game.i18n.format(key, data), ...bound } : game.i18n.format(key, data));
    const mins = list => (list ?? []).map(t => t.min);

    switch (actionKey) {
        case "search": {
            const rows = (def.thresholds ?? []).map(t =>
                game.i18n.format("DRPG.Action.dcTierRow", { n: t.min, tier: t.tier })).join(" · ");
            if (rows) f("DRPG.Action.dcSearch", { rows });
            break;
        }
        case "observe": {
            const col = key => Object.fromEntries(REMNANT_VISIBILITY.map(v => [v, OBSERVE_DC[v]?.[key]]));
            /* Observe's rows are ways of looking, not kinds of trace (Q-E21-2, its default): the crime's ladder shown,
               the Key, faint and daily-life ladders under "All thresholds" (E21 C5b; audit S02-07: sixteen numbers). */
            f("DRPG.Action.dcObserve", { rows: ladderRows(col("prep")) });
            f("DRPG.Action.dcObserveKey", { rows: ladderRows(col("key")) }, { all: true });
            f("DRPG.Action.dcObserveFaint", { rows: ladderRows(col("faint")) }, { all: true });
            f("DRPG.Action.dcObserveDaily", { rows: ladderRows(col("dailyLife")) }, { all: true });
            break;
        }
        case "analyze": {
            const col = key => Object.fromEntries(REMNANT_VISIBILITY.map(v => [v, ANALYZE_DC[v]?.[key]]));
            f("DRPG.Action.dcAnalyze", {
                // No Daily Life ladder (E09 C14, D14): ANALYZE_DC has no such column - see its comment.
                rows: ladderRows(col("prep")), faint: ladderRows(col("faint")),
                // A Key and a Final are rolled for since 21.09 - their own column.
                key: ladderRows(col("key"))
            }, { when: "bullet" });
            // Each by the row that rolls it (E21 C5b): the menu's `bullet`, `hint`, `stash` and `passage`.
            const [a, b] = mins(def.hintThresholds);
            if (a !== undefined) f("DRPG.Action.dcHint", { a, b: b ?? a }, { when: "hint" });
            if (def.stashThreshold) f("DRPG.Action.dcStash", { n: def.stashThreshold }, { when: "stash" });
            if (def.passageThreshold) f("DRPG.Action.dcPassage", { n: def.passageThreshold }, { when: "passage" });
            break;
        }
        case "project": {
            const relief = toolRelief(equippedFor(actor, "tool"), tierOf);
            const reliefNote = relief ? game.i18n.format("DRPG.Action.dcRelief", { n: relief }) : "";
            const [a, b] = mins(def.thresholds).map(n => Math.max(0, n - relief));
            if (a !== undefined) f("DRPG.Action.dcProject", { a, b: b ?? a, relief: reliefNote });
            const [sa, sb] = mins(ACTIONS.sabotage?.thresholds).map(n => Math.max(0, n - relief));
            if (sa !== undefined) f("DRPG.Action.dcSabotage", { a: sa, b: sb ?? sa, relief: reliefNote });
            if (othersInRoom(actor).length) f("DRPG.Action.dcConceal", { n: SABOTAGE_CONCEAL.threshold });
            try {
                const place = locateActor(actor);
                const here = place?.room ? projectsAvailableIn(place) : [];
                if (here.some(p => isIndirectMurder(p))) f("DRPG.Action.dcIndirect", { n: INDIRECT_MURDER.concealIntent.threshold });
            } catch { /* no projects here */ }
            break;
        }
        case "listen": {
            const [a, b] = mins(def.thresholds);
            if (a !== undefined) f("DRPG.Action.dcListen", { a, b: b ?? a });
            break;
        }
        case "palm": {
            f("DRPG.Action.dcPalm", {
                take: def.threshold, unseen: def.unseen?.threshold ?? "-",
                plant: def.plant?.threshold ?? def.threshold, plantUnseen: def.plant?.unseen ?? def.unseen?.threshold ?? "-"
            });
            break;
        }
        default:
            break;
    }
    return facts;
}

/**
 * What this action does, before committing to it. Move only ever shows the
 * briefing - there is nothing to confirm, you just drag your token.
 */
export async function briefing(actor, actionKey, def) {
    // On the kit's frame (E21 C5a): Move's briefing answers nothing - its one word is the primary "Got it" -, every
    // other action's goes on through its primary or is withdrawn with Cancel.
    const footer = actionKey === "move"
        ? { primary: { action: "ok", label: game.i18n.localize("DRPG.Action.gotIt") } }
        : { primary: { action: "go", label: game.i18n.localize("DRPG.Action.proceed") }, close: "cancel" };

    const result = await drpgWindow({
        title: def.label,
        classes: ["drpg-panel", "drpg-briefing"],
        body: briefingBlock(actor, actionKey, def),
        footer,
        rejectClose: false
    });

    return result === "go";
}

// The erase ladder for THIS character: the cleaning tool's tier and the
// fresh scene come off the table's numbers (D1). Computed here, beside
// the module that scores the roll, rather than in the sync briefing.
export function tamperThresholdFacts(actor, cleanup) {
    try {
        const column = Object.fromEntries(REMNANT_VISIBILITY.map(v => [v, cleanup.cleanupDc(v, actor)]));
        const reliefs = [];
        const tier = cleanup.cleaningTier(actor);
        if (CLEANUP.toolTierReducesDc && tier) reliefs.push(game.i18n.format("DRPG.Action.reliefTool", { n: tier }));
        const fresh = cleanup.freshSceneBonus();
        if (fresh) reliefs.push(game.i18n.format("DRPG.Action.reliefFresh", { n: fresh }));
        // By the row that rolls each (E21 C5b): the erase ladder under Cover your traces, the trail's number under its
        // row. The watchers are said once, by `briefingFacts`, with the cover's number (`DRPG.Tamper.watched`).
        return [{ text: game.i18n.format("DRPG.Action.dcTamper", {
            rows: ladderRows(column),
            relief: reliefs.length ? game.i18n.format("DRPG.Action.dcTamperRelief", { what: reliefs.join(", ") }) : ""
        }), when: "cover" },
        { text: game.i18n.format("DRPG.Action.dcFrame", { n: CLEANUP.actions.misleadingTrail.threshold }), when: "frame" }];
    } catch (err) {
        error("Could not print the Tamper thresholds", err);
        return [];
    }
}
