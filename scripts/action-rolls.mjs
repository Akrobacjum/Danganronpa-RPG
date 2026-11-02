/**
 * Danganronpa RPG - actions as abilities.
 * ---------------------------------------------------------------------------
 * The guide's promise: "the player does not call the GM when performing
 * repeatable actions."
 *
 * Every action opens with a briefing of what it does, then either resolves
 * itself (Search, Work on Project, Sabotage, Palm, Tamper, Rest, Move) or
 * sends a ruling card to the GM (Observe with nothing to rank, Analyze's hint,
 * Listen, a Dynamic threshold, Direct Murder) - because those are the ones
 * the guide wants a human to judge.
 *
 * Movement is not here: crossing a room boundary charges itself, in
 * movement.mjs.
 *
 * THE FACADE (E41 C3 and C4, 1.2.97). Two pure moves that
 * `node tools/moved-only.mjs` proves left this file the dispatch alone. C3
 * moved the layer every action shares: the roll and what is kept of it to
 * action-pipeline.mjs, the roll's card to action-report.mjs, the briefing to
 * action-briefing.mjs, and the variant menu with its fields to
 * action-menus.mjs. C4 moved the actions, each into a file of its own: the
 * Search to action-search.mjs; Work on Project and Sabotage together to
 * action-project.mjs (`performProject` calls `performSabotage`, which calls
 * the project picker, so two files would import each other); Tamper to
 * action-tamper.mjs; Palm's player half to palm.mjs; Observe, Analyze, Listen
 * and Rest to action-observe.mjs, action-analyze.mjs, action-listen.mjs and
 * action-rest.mjs; Direct Murder with the betrayal and the fight's menu to
 * action-murder.mjs; the Dynamic action to action-dynamic.mjs. This file keeps
 * its name and every name it exported - the 62 that moved are re-exported
 * under the imports - so every importer still imports action-rolls.mjs, and
 * none of the fourteen imports it. What stays is `performAction` with its
 * dispatch (`THROWS_NO_DICE`, `NEEDS_OWN_BRIEFING`) and `currentRoom`; new
 * code goes into the file of its role, not here.
 */

import { ACTIONS, MONOCUB } from "./config.mjs";
import { isEclipse } from "./eclipse.mjs";
// The phase, from the file that owns the clock setting and imports nothing but
// config.mjs. trial.mjs has `inClassTrial()`, and importing it here would drag
// the whole trial floor into the action pipeline.
import { getClock } from "./settings.mjs";
import { roomOfActor } from "./movement.mjs";
import { error, activeGmIds } from "./utils.mjs";
import { briefing } from "./action-briefing.mjs";
import { performSearch } from "./action-search.mjs";
import { performProject, performSabotage } from "./action-project.mjs";
import { performTamper } from "./action-tamper.mjs";
import { performPalm } from "./palm.mjs";
import { performObserve } from "./action-observe.mjs";
import { performAnalyze } from "./action-analyze.mjs";
import { performListen } from "./action-listen.mjs";
import { performRest } from "./action-rest.mjs";
import { openCrisisMenu, performBetrayal, performDirectMurder } from "./action-murder.mjs";
import { dynamicDef, performDynamic } from "./action-dynamic.mjs";
export {
    toolRelief, DRPG_ACTION_ROLL, DRAWN_ROLL, TRAIT_BY_GM, rollTrait, neededNote, rollInHand, forgetRollBookmarks,
    noteRollContext, ROLL_CLAIMS, rollClaims, rollOfNow, rollOfSender, rollOfSenderNaming, keepGmBookmark, noteRollFact,
    noteFactOfRoll, factsOfRoll, rollOfFact, noteFactOn, dropRollBookmarks, dualityOf, abort, spentAfterRoll
} from "./action-pipeline.mjs";
export { rollTone, report } from "./action-report.mjs";
export { briefingBlock, moveLine } from "./action-briefing.mjs";
export { chooseVariant } from "./action-menus.mjs";
export {
    searchOdds, stashStep, stashDiceOf, stashStepFor, stashStepOf, searchTier, stashText, situationLine,
    unclaimedOutcome, searchDraw, findOf, grantDrawn, traceTheFind
} from "./action-search.mjs";
export {
    projectProgress, PROJECT_BONUS_MOST, projectExtrasHeld, sabotageExtrasHeld, hideProjectTraces, sabotageWatchedLine,
    sabotageBar, sabotageHit, sabotageRepairScale
} from "./action-project.mjs";
export { PALM_PARTS, palmTitle, choosePalm } from "./palm.mjs";
export { observeModeLine } from "./action-observe.mjs";
export { ANALYZE_TRIAL_FILTER, analyzeRowShut } from "./action-analyze.mjs";
export { listenLabels } from "./action-listen.mjs";
export { offerDynamicFind, withdrawDynamicFind, dynamicBar, askDynamicDifficulty } from "./action-dynamic.mjs";

/** Re-exported so other modules keep a single source for "where am I". */
export { roomOfActor as currentRoom };

/** The actions `performAction` lets through with no GM connected: none of them throws dice there (E08+E28 C18). */
const THROWS_NO_DICE = new Set(["move", "rest", "directMurder"]);

/**
 * The one action that still gets a briefing window of its own.
 *
 * Move asks nothing - you drag a token - so there is no window to fold into.
 * Everything else opens one regardless, and a separate briefing in front of it
 * meant two windows to answer one question.
 *
 * This used to be the inverse: a list of the nine actions that DO fold, which
 * had to be edited every time an action gained a dialog and silently gave a
 * second window to any key not on it. Stated the other way round, an action
 * nobody remembered to list gets the folded behaviour by default.
 */
const NEEDS_OWN_BRIEFING = new Set(["move"]);

/* ==========================================================================
 * ENTRY POINT
 * ========================================================================== */

/**
 * Run an action from the panel. Always starts with the briefing.
 *
 * @param {Actor} actor
 * @param {string} actionKey  A key from ACTIONS, or "dynamic".
 */
export async function performAction(actor, actionKey, options = {}) {
    try {
        // A free action is the GM's to give (E03; audit S02-42). Analyze and
        // Tamper already said so; the other eight took `free` from anybody,
        // so `game.drpg.performAction(me, "listen", { free: true })` from a
        // player's console was an action that cost nothing, as often as they liked.
        if (options.free && !game.user.isGM) options = { ...options, free: false };
        if (!actor || actor.type !== "character") {
            ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
            return null;
        }

        /*
         * AN ACTION ROLL WAITS FOR A GM (E08+E28 C18, 04.10.2026; the plan's 3.7). A player's
         * action roll is drawn by the primary GM (roll-draw.mjs), so with no GM connected it
         * cannot be made - and until C18 it was thrown here anyway and its request refused for
         * want of a GM, after the price where the action pays first. Refused here, before any
         * price or window: the first line every action passes. Move and Rest throw no dice, and
         * Direct Murder's two roads
         * (a betrayal, a declaration in the dark) ask the GM and say so themselves. A GM who
         * leaves after this line has the roll refused at the draw (`drawOrThrow`).
         */
        if (!game.user.isGM && !activeGmIds().length && !THROWS_NO_DICE.has(actionKey)) {
            ui.notifications.warn(game.i18n.localize("DRPG.Rolls.waitsForGm"));
            return null;
        }

        /*
         * IN A FIGHT, DIRECT MURDER MEANS SOMETHING ELSE - and that has to be
         * decided before the Eclipse guards below, both of which would refuse
         * it: an incident is not an Eclipse, and this is not the start of a
         * murder but an act inside one.
         *
         * Measured when it was checked further down instead: the tile was the
         * only live one on the sheet and pressing it warned "Direct Murder only
         * works during an Eclipse" and did nothing at all - a fight with no way
         * to act in it.
         */
        const { sideOf: sideInFight, murderState: fightState } = await import("./murder.mjs");
        const inFight = fightState()?.stage === "incident" && sideInFight(actor);
        if (inFight && actionKey === "directMurder") return openCrisisMenu(actor);

        /*
         * A MONOCUB HAS TWO ACTIONS, AND THIS IS WHERE THAT IS TRUE (ACT-13, 20.09).
         *
         * The dead gate below lets a Monocub through - correctly, a Monocub does act -
         * and that was the whole of it: past that line every tile in the module was
         * dispatchable by one, and `performAction` is reachable from an evidence row's
         * Analyze button and from `game.drpg` without a sheet at all. The panel offers
         * Move and Confusion, so nothing on screen suggested otherwise, and nothing
         * refused the rest.
         *
         * ABOVE THE BETRAYAL AND THE ECLIPSE DECLARATION ON PURPOSE, and that is not
         * a detail: a betrayal is reached before the Eclipse rule, so a gate placed
         * with the dead test - which is further down - would have left the loudest
         * action in the game open to a Monocub.
         *
         * ABOVE THE DEAD TEST AND THE ECLIPSE since E51 C1, which put the dead test above
         * the Eclipse (R1105); R86 holds the gate above the dead test.
         *
         * BELOW the in-fight shortcut above, equally deliberately. A fight is its own
         * economy with its own entry point (`takeCrisisAction`), and somebody already
         * in one pressing this tile means "open the fight's menu" whoever they are;
         * refusing them there would be this gate answering a question it was not
         * asked.
         *
         * Confusion is NOT in the list, because it is not an ACTIONS key: it is a
         * row of `MONOCUB.abilities`, with its own executor and its own refusals in
         * monocub.mjs (`performCubAbility`).
         */
        const { isMonocub: cubCheck } = await import("./monocub.mjs");
        if (cubCheck(actor) && !MONOCUB.dispatchable.includes(actionKey)) {
            ui.notifications.warn(game.i18n.localize("DRPG.Monocub.onlyTwoActions"));
            return null;
        }

        // The dead do not act. The sheet already stops showing them a grid, but
        // this is the boundary that decides: the panel is rebuilt on render, so
        // a sheet left open across the moment of death still has live buttons,
        // and `game.drpg.performAction` reaches here without a sheet at all.
        //
        // A Monocub is deceased too and is deliberately let through - their own
        // panel offers exactly Move and Meddle, and Move is dispatched from
        // here like any other action.
        //
        // ABOVE THE ECLIPSE (E51 C1; audit S02-51 (d)). It stood below it, so a dead student pressing a tile in an
        // Eclipse was told the Eclipse locks actions - true, and not why: being dead is. R1105 holds the order.
        const { isMonocub } = await import("./monocub.mjs");
        const { isDeadForGm } = await import("./chapter.mjs");
        if (isDeadForGm(actor) && !isMonocub(actor)) {
            ui.notifications.warn(game.i18n.format("DRPG.Chapter.deadCannotAct", {
                name: actor.name
            }));
            return null;
        }

        // The Eclipse is a placement window, not a time of day - the guide has
        // the next time of day begin only once everyone has placed. Nothing
        // beyond the two free crossings (handled in movement.mjs, not here) is
        // available yet: not an action, not a Call. `actionKey === "move"`
        // still passes through, since Move does nothing here besides show its
        // own briefing - the crossing itself is judged by `judgeEclipseCrossing`.
        //
        // Direct Murder is the exception in BOTH directions: the lights are out
        // and everybody is crossing the map, which is the one moment the guide
        // gives for being alone with somebody. So it is the only ordinary action
        // that works during an Eclipse - and it works at no other time.
        if (actionKey !== "move" && actionKey !== "directMurder" && isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.actionsLocked"));
            return null;
        }

        /*
         * TURNING ON YOUR PARTNER IS A DIRECT MURDER (Dawid, 29.08).
         *
         * It used to be a tile in a panel of its own above the action grid -
         * the last thing left of the old Stage 6 panel. That panel is gone now,
         * and this is where the betrayal belongs: it IS a direct murder, and
         * the only one in the game the guide lets you commit without declaring
         * it in an Eclipse first.
         *
         * So the tile answers three different questions depending on when it is
         * pressed, and each one is the only thing it could sensibly mean at
         * that moment: in a fight it opens the fight's own actions, in an
         * Eclipse it declares a killing for later, and here - Stage 6, with a
         * partner still standing - it kills the partner.
         *
         * BEFORE the Eclipse refusal, because this is the exception to it.
         */
        if (actionKey === "directMurder") {
            const { betrayalTarget } = await import("./murder.mjs");
            const partner = betrayalTarget(actor);
            if (partner) return performBetrayal(actor, partner, ACTIONS.directMurder, options);
        }

        if (actionKey === "directMurder" && !isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.murderOnlyInEclipse"));
            return null;
        }

        /*
         * You are in a fight. The ordinary economy is suspended.
         *
         * Stage 5 replaces the day's actions with crisis actions for the people
         * in it - the guide's whole turn structure assumes the two of them are
         * doing nothing else - and nothing enforced that. A victim could Search
         * the room they were being murdered in, or Rest, or start a project,
         * between two rounds of being stabbed.
         *
         * Hope Calls deliberately still work: those are bought with Hope rather
         * than actions, they are what a cornered player reaches for, and
         * `spendHopeCall` is a different path that never comes through here.
         * Crisis actions likewise - `takeCrisisAction` is its own entry point.
         */
        // And the other nine are refused, unchanged: the guide's turn structure
        // assumes the two people in an incident are doing nothing else. Direct
        // Murder has already been dealt with above.
        if (inFight) {
            const { crisisTileLabel } = await import("./murder.mjs");
            ui.notifications.warn(game.i18n.format("DRPG.Murder.actionsLocked", { tile: crisisTileLabel(actor) }));
            return null;
        }

        /*
         * A CLASS TRIAL IS NOT A TIME OF DAY (T-1, Dawid 17.09, answers 2 and 99).
         *
         * In session, the sheet's ten tiles come down to one. What stays open:
         * Analyze, because the trial is where a Truth Bullet is finally read; the
         * Objection, which is not an action tile at all; every Hope Call, because
         * those are what a cornered player reaches for and are bought with Hope;
         * and items. What closes: the other nine tiles, room crossings
         * (movement.mjs), Despair Calls and Confusion (calls.mjs, monocub.mjs).
         *
         * LAST, NOT FIRST. Every refusal above this one is TRUER: somebody in a
         * fight, somebody mid-Eclipse and a corpse are all in a situation the
         * trial does not describe, and telling them "the Class Trial is in
         * session" would answer a question they did not ask. So this is the last
         * word before dispatch.
         *
         * Move is refused here too, even though the crossing itself is judged in
         * movement.mjs: pressing Move opens a briefing for a crossing that cannot
         * happen, and a briefing for something impossible is worse than a grey
         * tile.
         *
         * WHAT THIS DOES NOT COVER, on purpose: `game.drpg.cleanupDialog`,
         * `attemptCleanup` and `attemptStageSix` are their own entry points on the
         * API, called directly by the suite and the harness. The PRICE still
         * applies to them - only the phase lock does not, and a GM who calls a
         * clean-up by hand during a trial has decided to.
         */
        if (actionKey !== "analyze" && getClock().phase === "classTrial") {
            ui.notifications.warn(game.i18n.localize("DRPG.Trial.actionsLocked"));
            return null;
        }

        const def = actionKey === "dynamic" ? dynamicDef() : ACTIONS[actionKey];
        if (!def) {
            ui.notifications.error(game.i18n.format("DRPG.Action.unknown", { key: actionKey }));
            return null;
        }

        // Only an action with nothing of its own to ask still gets a window
        // here; every other one carries the briefing inside the window it was
        // going to open anyway. See `briefingBlock` and NEEDS_OWN_BRIEFING.
        if (!options.skipBriefing && NEEDS_OWN_BRIEFING.has(actionKey)) {
            const go = await briefing(actor, actionKey, def);
            if (!go) return null;
        }

        // A case for every key of ACTIONS (and `dynamic`); a key ACTIONS does not hold was refused above
        // (`DRPG.Action.unknown`), so the switch has no default (E41 C1a: `performGeneric`, the default's
        // performer, ran for nothing and is deleted with `chooseTrait`; R1230).
        switch (actionKey) {
            case "move": return null;                    // handled by the briefing
            case "dynamic": return performDynamic(actor, options);
            case "search": return performSearch(actor, def, options);
            case "project": return performProject(actor, def, options);
            case "sabotage": return performSabotage(actor, def, options);
            case "tamper": return performTamper(actor, def, options);
            case "palm": return performPalm(actor, def, options);
            case "analyze": return performAnalyze(actor, def, options);
            case "rest": return performRest(actor);
            case "listen": return performListen(actor, def, options);
            case "observe": return performObserve(actor, def, options);
            case "directMurder": return performDirectMurder(actor, def, options);
        }
    } catch (err) {
        error(`Action "${actionKey}" failed`, err);
        ui.notifications.error(game.i18n.localize("DRPG.Action.failed"));
        return null;
    }
}

