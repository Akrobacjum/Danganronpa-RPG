/**
 * Danganronpa RPG — actions as abilities.
 * ---------------------------------------------------------------------------
 * The guide's promise: "the player does not call the GM when performing
 * repeatable actions."
 *
 * Every action opens with a briefing of what it does, then either resolves
 * itself (Search, Work on Project, Sabotage, Dynamic) or whispers a ruling
 * request to the GM (Think, Listen, Analyze, Observe, Direct Murder, starting
 * a project) — because those are the ones the guide wants a human to judge.
 *
 * Movement is not here: crossing a room boundary charges itself, in
 * movement.mjs.
 */

import {
    MODULE_ID, FLAGS, ACTIONS, TRAITS, DYNAMIC_THRESHOLDS, INDIRECT_MURDER,
    PROJECT_SCALE, ITEM_CATEGORIES, SABOTAGE_CONCEAL
} from "./config.mjs";
import { actionsLeft, spendAction, refundAction, hasFreeMove } from "./actions.mjs";
import { isEclipse } from "./eclipse.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { drawItem } from "./tables.mjs";
import { roomOfActor, othersInRoom } from "./movement.mjs";
import { projectsAvailableIn, addProgress, isIndirectMurder, scaleFor, projectsListedIn } from "./projects.mjs";
import { callGm, promptAndCallGm } from "./gm-bridge.mjs";
import { announce, resolveThreshold, whisperToOwner, dialogContent, replaceFlag, log, error, plural, cardHead } from "./utils.mjs";
// Static, and safe to be: nothing private-rolls.mjs imports leads back here.
import { supersedingRoll } from "./private-rolls.mjs";
import { playSfx } from "./sfx.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * Marks a dialog button that hands the turn to the GM rather than resolving
 * against a table.
 *
 * The distinction matters at the moment of choosing, not afterwards: pressing
 * one of these means waiting for a human, and the two branches that do it were
 * sitting in a row of buttons that looked exactly like the automatic ones.
 * Red is already the module's colour for "this goes to the GM" — the cost
 * stripe on the action tiles uses it for the same thing — so the styling is in
 * `danganronpa.css` next to that rule.
 *
 * DialogV2 writes this straight onto the element with `setAttribute("class")`,
 * replacing whatever was there. Its buttons carry no classes of their own, so
 * nothing is lost.
 */
const GM_ROUTE_CLASS = "drpg-gm-route";

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
        if (!actor || actor.type !== "character") {
            ui.notifications.warn(game.i18n.localize("DRPG.Character.notACharacter"));
            return null;
        }

        // The Eclipse is a placement window, not a time of day — the guide has
        // the next time of day begin only once everyone has placed. Nothing
        // beyond the two free crossings (handled in movement.mjs, not here) is
        // available yet: not an action, not a Call. `actionKey === "move"`
        // still passes through, since Move does nothing here besides show its
        // own briefing — the crossing itself is judged by `judgeEclipseCrossing`.
        //
        // Direct Murder is the exception in BOTH directions: the lights are out
        // and everybody is crossing the map, which is the one moment the guide
        // gives for being alone with somebody. So it is the only ordinary action
        // that works during an Eclipse — and it works at no other time.
        if (actionKey !== "move" && actionKey !== "directMurder" && isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.actionsLocked"));
            return null;
        }
        if (actionKey === "directMurder" && !isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.murderOnlyInEclipse"));
            return null;
        }

        /*
         * You are in a fight. The ordinary economy is suspended.
         *
         * Stage 5 replaces the day's actions with crisis actions for the people
         * in it — the guide's whole turn structure assumes the two of them are
         * doing nothing else — and nothing enforced that. A victim could Search
         * the room they were being murdered in, or Rest, or start a project,
         * between two rounds of being stabbed.
         *
         * Hope Calls deliberately still work: those are bought with Hope rather
         * than actions, they are what a cornered player reaches for, and
         * `spendHopeCall` is a different path that never comes through here.
         * Crisis actions likewise — `takeCrisisAction` is its own entry point.
         */
        const { sideOf, murderState } = await import("./murder.mjs");
        if (murderState()?.stage === "incident" && sideOf(actor)) {
            ui.notifications.warn(game.i18n.localize("DRPG.Murder.actionsLocked"));
            return null;
        }

        // The dead do not act. The sheet already stops showing them a grid, but
        // this is the boundary that decides: the panel is rebuilt on render, so
        // a sheet left open across the moment of death still has live buttons,
        // and `game.drpg.performAction` reaches here without a sheet at all.
        //
        // A Monocub is deceased too and is deliberately let through — their own
        // panel offers exactly Move and Meddle, and Move is dispatched from
        // here like any other action.
        const { isMonocub } = await import("./monocub.mjs");
        const { isDeceased } = await import("./chapter.mjs");
        if (isDeceased(actor) && !isMonocub(actor)) {
            ui.notifications.warn(game.i18n.format("DRPG.Chapter.deadCannotAct", {
                name: actor.name
            }));
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

        switch (actionKey) {
            case "move": return null;                    // handled by the briefing
            case "dynamic": return performDynamic(actor, options);
            case "search": return performSearch(actor, def, options);
            case "project": return performProject(actor, def, options);
            case "sabotage": return performSabotage(actor, def, options);
            case "analyze": return performAnalyze(actor, def, options);
            case "rest": return performRest(actor);
            case "listen": return performListen(actor, def, options);
            case "observe": return performObserve(actor, def, options);
            case "directMurder": return performDirectMurder(actor, def, options);
            default: return performGeneric(actor, actionKey, def, options);
        }
    } catch (err) {
        error(`Action "${actionKey}" failed`, err);
        ui.notifications.error(game.i18n.localize("DRPG.Action.failed"));
        return null;
    }
}

/* ==========================================================================
 * BRIEFING
 * ========================================================================== */

/**
 * The briefing as a block of HTML, for an action that already opens a window.
 *
 * Almost every action used to cost two module windows before the dice: a
 * briefing that said what the action does, and then the window that actually
 * asked something — which goal, which room, which Truth Bullet. Three windows
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
export function briefingBlock(actor, actionKey, def) {
    const facts = briefingFacts(actor, actionKey, def);

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
        <ul class="drpg-briefing-facts">${facts.map(f => `<li>${f}</li>`).join("")}</ul>
    </div>`;
}

/** The cost / statistics / room lines every briefing ends with. */
function briefingFacts(actor, actionKey, def) {
    const room = roomOfActor(actor);
    const cost = def.cost ?? 1;
    const facts = [];

    if (actionKey === "move") {
        facts.push(hasFreeMove(actor)
            ? game.i18n.localize("DRPG.Move.freeAvailable")
            : game.i18n.format("DRPG.Move.freeSpent", { left: actionsLeft(actor) }));
    } else if (actionKey === "rest") {
        // No cost line at all. Rest is the one action whose price depends on a
        // choice made further down the same window, and the two rows below it
        // already price Short and Long separately against what you have — a
        // summary above them would be the same sentence twice.
    } else if (cost > 0) {
        facts.push(game.i18n.format("DRPG.Action.willCost", { n: cost, left: actionsLeft(actor) }));
    }

    if (def.traits?.length) {
        facts.push(game.i18n.format("DRPG.Action.usesTrait", {
            traits: def.traits.map(t => TRAITS[t]?.label ?? t).join(" / ")
        }));
    }

    facts.push(room
        ? game.i18n.format("DRPG.Action.youAreIn", { room: foundry.utils.escapeHTML(room) })
        : game.i18n.localize("DRPG.Action.noRoomNote"));

    // How many searches this room has left, from the counter itself. The
    // description used to promise "three searches per time of day" — three is
    // the DEFAULT of a world setting a GM may set anywhere from 0 to 10, so
    // for any table that touched it the sentence was simply false. This says
    // what is true of the room the character is standing in, now.
    if (actionKey === "search" && room) {
        facts.push(game.i18n.format("DRPG.Action.searchTokensLeft", {
            left: SearchTokens.left(room),
            max: SearchTokens.max
        }));
    }

    // Observe's miss price, from the constant the roll actually charges.
    if (def.failStress) {
        facts.push(game.i18n.format("DRPG.Action.failStress", { n: def.failStress }));
    }

    // Same question the tile's stripe asks, and it has to be asked the same
    // way: `callsGm` can be a predicate on the character now. A briefing that
    // says "this waits for the GM" over a tile that does not is worse than
    // saying nothing — see `callsGmFor` in sheet.mjs.
    const callsGm = typeof def.callsGm === "function"
        ? (() => { try { return Boolean(def.callsGm(actor)); } catch { return false; } })()
        : Boolean(def.callsGm);
    if (callsGm) facts.push(game.i18n.localize("DRPG.Action.callsGmNote"));

    return facts;
}

/**
 * What this action does, before committing to it. Move only ever shows the
 * briefing — there is nothing to confirm, you just drag your token.
 */
async function briefing(actor, actionKey, def) {
    const buttons = actionKey === "move"
        ? [{ action: "ok", label: game.i18n.localize("DRPG.Action.gotIt"), default: true }]
        : [
            { action: "go", label: game.i18n.localize("DRPG.Action.proceed"), default: true },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ];

    const result = await DialogV2.wait({
        window: { title: def.label },
        classes: ["drpg-panel", "drpg-briefing"],
        content: dialogContent(briefingBlock(actor, actionKey, def)),
        buttons,
        rejectClose: false
    });

    return result === "go";
}

/**
 * The one action that still gets a briefing window of its own.
 *
 * Move asks nothing — you drag a token — so there is no window to fold into.
 * Everything else opens one regardless, and a separate briefing in front of it
 * meant two windows to answer one question.
 *
 * This used to be the inverse: a list of the nine actions that DO fold, which
 * had to be edited every time an action gained a dialog and silently gave a
 * second window to any key not on it. Stated the other way round, an action
 * nobody remembered to list gets the folded behaviour by default — including
 * anything falling through to `performGeneric`, which asks for a statistic and
 * so has a window to carry the briefing.
 */
const NEEDS_OWN_BRIEFING = new Set(["move"]);

function dynamicDef() {
    return {
        label: game.i18n.localize("DRPG.Action.dynamicLabel"),
        icon: "fa-wand-magic-sparkles",
        cost: 1,
        traits: Object.keys(TRAITS),
        description: game.i18n.localize("DRPG.Action.dynamicDescription")
    };
}

/* ==========================================================================
 * ROLLING
 * ========================================================================== */

/**
 * Roll through the system so dice, skins and chat cards behave normally.
 *
 * Daggerheart's roll pipeline only *prepares* the resource changes a duality
 * roll causes — +1 Hope, -1 Sanity on a critical, +1 Fear — and leaves them in
 * `result.resourceUpdates` for the caller to commit. The sheet's own trait
 * button calls `updateResources()`; ours has to as well, or actions roll dice
 * and quietly hand out nothing.
 */
/**
 * @param {Actor} actor
 * @param {string} drpgTrait
 * @param {object} [options]
 * @param {boolean} [options.remember]  Is this *the* roll of the action?
 *   Several actions throw more than one — sabotage rolls to conceal itself
 *   first, an indirect-murder project rolls to conceal intent and again to hide
 *   its traces. Only one of them is the action's result, and only that one is
 *   what Reroll should take back. Without this the bookmark ended up pointing at
 *   whichever supporting roll happened to come last, so Reroll appeared to pick
 *   a roll at random.
 * @param {string} [options.actionKey]  WHICH action this roll belongs to.
 *   Reroll dispatches on it to undo and replay the right thing. Only Work on
 *   Project ever recorded one, and only afterwards through `noteRollContext` —
 *   which is exactly why Reroll looked like it worked on projects and nothing
 *   else. Every other action left the bookmark with no action to replay, so the
 *   Call re-rolled the dice in the chat card and changed nothing in the world.
 * @param {object} [options.context]  Everything about the action that is already
 *   known BEFORE the dice land — which room, which category, what was being
 *   looked for. Recorded here rather than in the `noteRollContext` at the end of
 *   the action, because every one of those calls sits after a chain of early
 *   returns. A Search whose room ran out of tokens between the picker and the
 *   spend left a bookmark saying "search" and nothing else, and Reroll then had
 *   an action name it could not act on — which reads exactly like Reroll not
 *   working on Search at all.
 *
 * Exported because the murder engine rolls through it too: a crisis action and
 * an opening roll are ordinary trait rolls that must commit resources, honour
 * an armed Call and record a Reroll bookmark exactly like a Search does.
 * `murder.mjs` already imported it — but it was module-private, so the import
 * resolved to `undefined` and every crisis action died on
 * "rollTrait is not a function" before a single die was thrown.
 */
export async function rollTrait(actor, drpgTrait,
    { remember = true, actionKey = null, context = null, title = null } = {}) {
    const calls = await import("./call-effects.mjs");

    // `remember: false` marks a supporting roll — concealing an intent, hiding
    // traces. Those must not eat the Call the player bought for the action's own
    // roll, so the Call is hidden from this roll and from its dialog entirely.
    const supporting = !remember;
    if (supporting) calls.shieldCalls();
    try {
        return await throwDice(actor, drpgTrait, { remember, actionKey, context, title });
    } finally {
        if (supporting) calls.unshieldCalls();
    }
}

/** The roll itself, once it has been decided whether a Call may touch it. */
async function throwDice(actor, drpgTrait, { remember, actionKey, context, title = null }) {
    const dhTrait = TRAITS[drpgTrait]?.dh ?? drpgTrait;

    const { pendingCall, consumeCall } = await import("./call-effects.mjs");
    const armed = pendingCall(actor);

    // A Free Critical still throws the dice — it just decides in advance what
    // they will say. See forced-roll.mjs for why a real roll matters.
    const free = armed?.grants === "critical";
    if (free) {
        const { armMaximum } = await import("./forced-roll.mjs");
        armMaximum();
    }

    // Always open the configuration window.
    //
    // Daggerheart derives `dialog.configure` from `config.event`, reading
    // modifier keys off it. Called from our own code there is no event, so the
    // window was being skipped — actions rolled straight to chat with no chance
    // to use a Call. Both are supplied explicitly.
    let result;
    try {
        // The system's own card for this roll is claimed as it is created and
        // never rendered: this module reports the same roll in its own card,
        // with the same two faces and the same total. See `supersedingRoll` in
        // private-rolls.mjs — and note the claim covers only THIS call, so a
        // trait rolled straight off the sheet keeps Daggerheart's card.
        result = await supersedingRoll(() => actor.rollTrait(dhTrait, {
            event: { shiftKey: false, altKey: false, ctrlKey: false },
            dialog: { configure: true },
            // Say what the roll is FOR.
            //
            // Left alone, Daggerheart titles the window from the trait — "Body
            // Roll: Player A" — which is true and useless: the opening roll of
            // a murder and a shove in a corridor are the same two words. Worse
            // for the murder project, where three windows open one after the
            // other, all called "Shadow Roll", and the player answers the same
            // question three times without being told which is which.
            ...(title ? { title, headerTitle: title } : {})
        }));
    } finally {
        if (free) {
            const { disarmMaximum } = await import("./forced-roll.mjs");
            disarmMaximum();
        }
    }
    if (!result) return null;

    const roll = result.roll ?? result;
    const total = roll?.total ?? result?.total;
    if (typeof total !== "number") return null;

    await commitResources(result);
    // Whatever the Call bought, it bought it for this roll and no other.
    if (armed) await consumeCall(actor);

    const outcome = {
        total,
        ...dualityOf(roll),
        trait: drpgTrait,
        freeCritical: free,
        raw: result
    };

    if (free) {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.freeCritTitle")
        })}<p>${
            game.i18n.format("DRPG.Calls.freeCritUsed", { name: foundry.utils.escapeHTML(actor.name) })
        }</p>`);
    }

    if (remember) await rememberRoll(actor, outcome, result, actionKey, context);
    return outcome;
}

/**
 * Record what was just rolled, so the Reroll Hope Call has something to take
 * back. Only the newest roll is kept — the guide's Reroll undoes an action, not
 * a history.
 *
 * The bookmark is written fresh here rather than merged, so leftovers from the
 * previous action — a project id, a Remnant token, an item — can never be
 * attributed to this one. Each action then attaches its own context with
 * `noteRollContext` once it knows what it did.
 *
 * "Fresh" has to be spelled out, via `replaceFlag`. This used `setFlag`, which
 * merges, so the sentence above was an intention rather than a description: the
 * flag accumulated every field every action had ever written. The one that hurt
 * was `gmRuled` — `replayAction` tests it before it looks at the action key, so
 * a single Observe earlier in the session sent every subsequent Reroll down the
 * "ask the GM again" path instead of replaying the Search or the project that
 * was actually rerolled.
 */
async function rememberRoll(actor, outcome, result, actionKey = null, context = null) {
    try {
        const messageId = result?.message?.id ?? result?.message?._id ?? null;
        await replaceFlag(actor, FLAGS.lastAction, {
            ...(context ?? {}),
            messageId,
            actionKey,
            trait: outcome.trait,
            total: outcome.total,
            withFear: outcome.withFear,
            isCritical: outcome.isCritical,
            freeCritical: Boolean(outcome.freeCritical),
            at: game.time?.worldTime ?? 0
        });
    } catch {
        // Losing the bookmark costs a Reroll, not the roll itself.
    }
}

/**
 * Where a Remnant this action dropped ended up, in a form the bookmark can
 * carry. A player's Remnant is placed by the GM over the socket, so there is no
 * document to point at — Reroll says so rather than pretending it can retune it.
 */
function remnantRef(placed) {
    const doc = placed?.document ?? placed;
    if (!doc?.id) return { remnantId: null, remnantScene: null };
    return { remnantId: doc.id, remnantScene: doc.parent?.id ?? canvas?.scene?.id ?? null };
}

/**
 * Attach the action's own context to the bookmark, once it is known.
 *
 * Replacement rather than merge, like `rememberRoll` — the spread of `current`
 * is what carries the rest forward, so a caller passing `{itemId: null}` here
 * genuinely clears the field instead of being ignored by a recursive update.
 */
async function noteRollContext(actor, data) {
    try {
        const current = actor.getFlag(MODULE_ID, FLAGS.lastAction);
        if (!current) return;
        await replaceFlag(actor, FLAGS.lastAction, { ...current, ...data });
    } catch {
        // Same again: informational only.
    }
}

/**
 * Read Hope / Despair / critical off a finished roll.
 *
 * What `rollTrait` hands back is the roll *config*, not the Roll object, and the
 * config does not carry `withHope`/`withFear` — it records the same fact as
 * `result.duality`: 1 for Hope, -1 for Despair, 0 for a tie, which is a
 * critical. Reading the getters instead silently produced `false` for both, so
 * "with Despair" consequences — the sabotage reveal, the indirect-murder bonus —
 * could never fire. The dice are compared as a fallback for any other shape.
 */
export function dualityOf(roll) {
    const isCritical = Boolean(roll?.isCritical);
    const duality = roll?.result?.duality;

    if (typeof duality === "number") {
        return { isCritical: isCritical || duality === 0, withHope: duality === 1, withFear: duality === -1 };
    }

    const hope = roll?.hope?.value;
    const fear = roll?.fear?.value;
    if (typeof hope === "number" && typeof fear === "number") {
        return { isCritical: isCritical || hope === fear, withHope: hope > fear, withFear: hope < fear };
    }

    return {
        isCritical,
        withHope: Boolean(roll?.withHope),
        withFear: Boolean(roll?.withFear)
    };
}

/**
 * The two dice, the modifier and the total — drawn in the module's own card.
 *
 * The card said "14" and stopped there. Which way the roll went was carried by
 * the popup's title colour alone, and the two faces that decided it were only
 * ever on Daggerheart's own chat card: a second card, in a second visual
 * language, that a player had to look away to read. This draws the same
 * sentence the system rolled, in this module's language, next to the result it
 * produced — one card, one paper trail, in chat and in the popup alike.
 *
 * NOT a clone of the system's card, deliberately. That was the other option and
 * it loses three ways: its CSS is outside our layer, it carries interactive
 * buttons this card has no business re-firing, and it arrives on Dice So Nice's
 * schedule rather than ours.
 *
 * WHERE THE NUMBERS COME FROM, and why three ways of asking. A live roll
 * answers `roll.hope` / `roll.fear`; the same roll read back off a chat message
 * does not — those are gone by the time `Roll.fromData` has rebuilt it, which
 * is measured, not assumed. The terms survive, so `HopeDie` / `FearDie` by
 * class name is the fallback, and the last resort is the dice in formula order.
 *
 * The modifier is `total - hope - fear` rather than a sum of the numeric terms:
 * an advantage or disadvantage die is a term too, and a card that printed "+0"
 * while a d6 was quietly making up the difference would be lying about the one
 * line it exists to explain.
 *
 * @returns {string} the bar, or "" when this was not a duality roll at all.
 */
function dualityBar(outcome) {
    const roll = outcome?.raw?.roll ?? outcome?.raw ?? null;
    if (!roll) return "";

    const byClass = name => (roll.terms ?? []).find(t => t?.constructor?.name === name);
    const dieAt = i => roll.dice?.[i]?.total ?? roll.dice?.[i]?.results?.[0]?.result;

    const hope = Number(roll.hope?.total ?? roll.hope?.value ?? byClass("HopeDie")?.total ?? dieAt(0));
    const fear = Number(roll.fear?.total ?? roll.fear?.value ?? byClass("FearDie")?.total ?? dieAt(1));
    const total = Number(outcome?.total ?? roll.total);
    if (![hope, fear, total].every(Number.isFinite)) return "";

    const modifier = total - hope - fear;
    const side = outcome?.isCritical ? "critical" : outcome?.withHope ? "hope" : outcome?.withFear ? "despair" : null;
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const L = key => game.i18n.localize(`DRPG.Action.duality.${key}`);

    /* WHICH STATISTIC, AND WHAT THE REST WAS.
     *
     * The card named the dice and lumped everything else into one unlabelled
     * number — so it never said WHAT was rolled (the one fact Dawid flagged as
     * missing from the result), and an advantage die hid inside the same
     * figure as the trait. The roll carries its own RollData, so the trait's
     * value is read back off `roll.data.traits` and split out: the statistic
     * as a chip that names itself, and whatever remains — advantage,
     * disadvantage, an experience — as a second chip only when it is not
     * nothing. A roll whose data cannot answer keeps the old single figure.
     */
    const trait = TRAITS[outcome?.trait];
    // On a LIVE result the RollData hangs off the result itself and `.roll` is
    // a summary object without it; a roll rebuilt from a chat message carries
    // `.data` directly. Measured both ways — ask both.
    const rollData = roll.data ?? outcome?.raw?.data;
    const statValue = Number(rollData?.traits?.[trait?.dh]?.value);
    const hasStat = Boolean(trait) && Number.isFinite(statValue);
    const bonus = hasStat ? modifier - statValue : modifier;
    const signed = n => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;

    /* THE RESULT FIRST, ITS WORKING UNDER IT.
     *
     * This was one line — `1 + 10 + 1 = 12  with Despair` — which is the same
     * facts and a worse card: the total, the thing the whole roll is for, was
     * the fourth item on a row of seven and the same size as the operators
     * around it. Daggerheart's own card gets this right and it is why it reads
     * better, so the composition follows it: the answer large and centred, the
     * arithmetic beneath it as a quiet second line for anyone checking.
     */
    const formula = [
        `<span class="drpg-duality-die is-hope" data-tooltip="${esc(L("hopeDie"))}">${esc(hope)}</span>`,
        `<span class="drpg-duality-op">+</span>`,
        `<span class="drpg-duality-die is-despair" data-tooltip="${esc(L("despairDie"))}">${esc(fear)}</span>`
    ];

    // The statistic is shown even at +0: its job is to NAME what was rolled,
    // and the name is information at any value. The remainder and the
    // unattributed fallback keep the zero rule — "+ 0" asks the reader to
    // check that the nothing really is nothing.
    if (hasStat) {
        formula.push(`<span class="drpg-duality-op">+</span>`);
        formula.push(`<span class="drpg-duality-stat" data-tooltip="${esc(L("statistic"))}">${
            esc(trait.label)} ${esc(signed(statValue))}</span>`);
    }
    if (bonus !== 0) {
        formula.push(`<span class="drpg-duality-op">${bonus < 0 ? "−" : "+"}</span>`);
        formula.push(`<span class="drpg-duality-mod" data-tooltip="${esc(L(hasStat ? "bonus" : "modifier"))}">${
            esc(Math.abs(bonus))}</span>`);
    }

    return `<div class="drpg-duality"${side ? ` data-side="${side}"` : ""}>
        <div class="drpg-duality-result">
            <span class="drpg-duality-total">${esc(total)}</span>
            ${side ? `<span class="drpg-duality-badge">${esc(L(side))}</span>` : ""}
        </div>
        <div class="drpg-duality-formula">${formula.join("")}</div>
    </div>`;
}

/**
 * How long the card will wait for 3D dice before giving up on them.
 *
 * The animation is a courtesy. The card is not: a roll whose animation never
 * reports itself finished — a client that lost focus mid-throw is the ordinary
 * way — must not be able to swallow the result of an action somebody paid for.
 */
const DICE_SETTLE_MS = 6000;

/**
 * Wait for Dice So Nice to finish throwing, if it is throwing at all.
 *
 * The card prints the two faces now, so posting it while the dice are still
 * tumbling hands the reader the answer to the animation they are watching.
 * Resolves immediately when Dice So Nice is not installed, when this roll had
 * no chat message to animate, and — via the race — when the animation takes
 * longer than anyone should be made to wait for it.
 */
async function diceSettled(messageId) {
    const wait = game.dice3d?.waitFor3DAnimationByMessageID;
    if (!messageId || typeof wait !== "function") return;
    try {
        await Promise.race([
            wait.call(game.dice3d, messageId),
            new Promise(resolve => setTimeout(resolve, DICE_SETTLE_MS))
        ]);
    } catch { /* see DICE_SETTLE_MS */ }
}

/** Apply the Hope/Sanity/Fear changes the roll produced, plus any costs. */
async function commitResources(result) {
    const updates = result?.resourceUpdates;
    if (!updates?.updateResources) return;

    try {
        const costs = (result.costs ?? [])
            .filter(c => c.enabled)
            .map(c => ({ ...c, value: -c.value }));
        if (costs.length) updates.addResources(costs);
        await updates.updateResources();
    } catch (err) {
        error("Could not apply the roll's resource changes", err);
    }
}

/**
 * The "which statistic?" field, as HTML to drop into somebody else's form.
 *
 * Three windows built this select by hand, which is why the trait choice kept
 * turning up as a window of its own: it was easier to open a new dialog than to
 * repeat fifteen lines inside an existing one. As one function it costs a line,
 * so an action that already asks something can ask this too.
 *
 * Returns "" when there is nothing to choose — one allowed trait, or none —
 * and the caller falls back to it without a field. See `readTraitField`.
 */
function traitFieldHtml(actor, traits, { note = "" } = {}) {
    const allowed = traits ?? [];
    if (allowed.length < 2) return "";

    const options = allowed.map(key => {
        const t = TRAITS[key];
        const value = actor.system.traits?.[t.dh]?.value ?? 0;
        return `<option value="${key}">${t.label} (${value > 0 ? "+" : ""}${value})</option>`;
    }).join("");

    return `<label class="drpg-trait-field">${game.i18n.localize("DRPG.Advance.whichTrait")}
        <select name="trait">${options}</select>
        ${note ? `<small class="notes">${note}</small>` : ""}
    </label>`;
}

/** The other half of `traitFieldHtml`: what the form says, or the only option. */
function readTraitField(element, traits) {
    const allowed = traits ?? [];
    if (!allowed.length) return null;
    if (allowed.length === 1) return allowed[0];
    return element.querySelector("[name=trait]")?.value ?? allowed[0];
}

/**
 * Ask which trait to use, for an action with nothing else to ask.
 *
 * `intro` is the briefing. An action that folds its briefing in (see
 * FOLDS_BRIEFING_IN) has a window of its own to carry it; one that does not
 * used to get a briefing window, then this one, then the roll dialog — three
 * windows to answer "Body or Leg?". Passing the briefing here makes it two.
 */
async function chooseTrait(actor, def, { intro = "" } = {}) {
    const allowed = def.traits ?? [];
    if (!allowed.length) return null;
    if (allowed.length === 1 && !intro) return allowed[0];

    const picked = await DialogV2.wait({
        window: { title: game.i18n.format("DRPG.Action.chooseTrait", { action: def.label }) },
        classes: ["drpg-panel", "drpg-narrow"],
        content: dialogContent(`${intro}<form>${traitFieldHtml(actor, allowed)}</form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"), default: true,
                callback: (e, b, d) => readTraitField(d.element, allowed)
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (picked && picked !== "cancel") ? picked : null;
}

/**
 * Give the action back and stop.
 *
 * Used by the actions that must pay before rolling — an indirect murder or a
 * watched sabotage throws a concealment roll first, and every roll commits its
 * Hope, Sanity and Despair. Charging afterwards let a player collect those and
 * then cancel; charging first means an honest cancel has to be refunded.
 */
async function abort(actor, cost) {
    if (cost > 0) await refundAction(actor, cost);
    return null;
}

/** Common guard: enough actions left? */
function canAfford(actor, cost) {
    if (cost <= 0 || actionsLeft(actor) >= cost) return true;
    ui.notifications.warn(plural("DRPG.Actions.notEnough", {
        actor: actor.name, left: actionsLeft(actor), needed: cost
    }, "left"));
    return false;
}

/* ==========================================================================
 * SEARCH
 * ========================================================================== */

async function performSearch(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const room = options.room ?? roomOfActor(actor);
    if (!room) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.noRoom"));
        return null;
    }

    // BEFORE the picker, not after it. A sealed room is not a question about
    // what you are looking for — there is nothing in there to look for — so
    // asking is a form the answer to which was always going to be no.
    if (SearchTokens.sealed(room)) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.sealed"));
        return null;
    }

    const goal = await chooseSearchCategory(actor, def);
    if (!goal) return null;
    const { category, goal: goalKey, request, trait } = goal;
    if (!trait) return null;

    // Refuse early when the room is already spent, so the player is not walked
    // through a roll only to be told there was nothing left.
    if (SearchTokens.left(room) <= 0) {
        ui.notifications.warn(game.i18n.localize("DRPG.SearchTokens.exhausted"));
        return null;
    }

    // What the room is worth to this particular search.
    //
    //   +1  it is a sensible place to look for this — the medic's office for
    //       bandages. Set per room by the GM when the map is built.
    //   -1  it is a POOR place to look for this — bandages in the boiler
    //       room. The favour's mirror, set on the same Room Setup screen.
    //   -1  it is somebody else's stash and they have hidden it. Only bites
    //       when there is actually something in there to find.
    const { favoursCategory, hindersCategory, vaultOwnerOf, isConcealed, vaultContents } =
        await import("./vault.mjs");
    const stashOwnerId = vaultOwnerOf(room);
    const stashOwner = stashOwnerId && stashOwnerId !== actor.id
        ? game.actors.get(stashOwnerId)
        : null;
    const stashLoot = stashOwner ? vaultContents(stashOwner) : [];

    let situational = 0;
    if (favoursCategory(room, category)) situational += 1;
    if (hindersCategory(room, category)) situational -= 1;
    if (stashLoot.length && isConcealed(room)) situational -= 1;

    const calls = await import("./call-effects.mjs");
    if (situational) calls.armSituational(situational);

    let roll;
    try {
        roll = await rollTrait(actor, trait, {
            actionKey: "search",
            // Recorded before anything can bail out below, so a Reroll always
            // knows what was being looked for and where.
            context: { room, category, goal: goalKey, request }
        });
    } finally {
        // Cleared whatever happened. A situational modifier that outlived its
        // roll would silently attach itself to the next unrelated one.
        calls.clearSituational();
    }
    if (!roll) return null;

    // The token is claimed only once the dice are actually on the table.
    // Spending it up front meant backing out of the trait picker or the roll
    // window burned one of the room's three searches for nothing — twice and
    // the room was closed for the rest of the time of day.
    const claimed = await SearchTokens.spend(room);

    // Charged whatever the token says. The check above the picker reads this
    // client's copy of the counter, which can be a moment behind the GM's — so
    // two players searching the same room with one token left both get through
    // it and both roll. Bailing out here without charging meant the loser kept
    // their action AND banked whatever the duality granted them: a Hope
    // generator anybody could run by searching a room they knew was empty.
    //
    // Paying for it is also just what happened in the fiction. They searched a
    // room somebody else had already picked clean.
    if (cost > 0) await spendAction(actor, cost);

    if (!claimed) {
        // WHY the token was refused decides what the player is told and whether
        // they keep the action.
        //
        // `spend()` answers false for two completely different things: the room
        // really is empty, and nobody was there to say. A player's spend is a
        // socket round trip to the GMs, so no GM connected — or one that did not
        // answer inside five seconds, which a hosted server makes ordinary — came
        // back as a flat false and was reported as "somebody got here first, 0
        // tokens left" on a room that still had all three. The action went with
        // it.
        //
        // The counter itself tells them apart. It is authoritative on this point
        // and, on the unanswered path, uncached: nothing wrote a fresh count,
        // so this reads the world setting.
        //
        // Only the genuinely-empty branch keeps charging. That is the branch the
        // charge was introduced for — "a room they knew was empty" is the Hope
        // generator, and it still costs — while an unanswered request is the
        // module failing the player, not the player gaming it.
        const reallyEmpty = SearchTokens.left(room) <= 0;
        if (!reallyEmpty && cost > 0) await refundAction(actor, cost);

        await noteRollContext(actor, { actionKey: "search", room, category, goal: goalKey, tier: null });
        await report(actor, def, roll, {
            text: game.i18n.localize(reallyEmpty
                ? "DRPG.SearchTokens.pickedClean"
                : "DRPG.SearchTokens.timeout"),
            room, tokensLeft: SearchTokens.left(room)
        });
        return { success: false, exhausted: reallyEmpty, unanswered: !reallyEmpty };
    }

    const hit = resolveThreshold(roll.total, def.thresholds);
    const baseTier = hit?.tier ?? 0;
    const tier = roll.isCritical ? Math.min(3, baseTier + (def.critical?.tierBonus ?? 1)) : baseTier;

    // "Something specific" is the one goal no table can answer. The roll still
    // happens — and the tier it reaches is exactly the information the GM needs
    // to decide what was really there — so the result goes to them with the
    // player's own description attached.
    if (goalKey === "specific") {
        await callGm(actor, {
            title: def.label,
            request,
            roll,
            room,
            body: hit || roll.isCritical
                ? game.i18n.format("DRPG.Action.specificFound", { tier })
                : game.i18n.localize("DRPG.Action.specificNothing"),
            // Three answers, because those are the three a GM actually gives to
            // "I am looking for X": it exists and I will make it, it exists
            // already and here it is, or there is none. Each opens the window
            // that does the thing with everything the card already knows filled
            // in — see `runCallAction`.
            //
            // Lowercase data keys only: `dataset` lowercases everything, so a
            // `tierWanted` would come back as `tierwanted` and read undefined.
            actions: [
                {
                    action: "createItem",
                    label: game.i18n.localize("DRPG.Bridge.createItem"),
                    data: {
                        by: actor.id, category, tier: String(tier),
                        room: room ?? "", want: request ?? ""
                    }
                },
                {
                    action: "giveItem",
                    label: game.i18n.localize("DRPG.Bridge.giveItem"),
                    data: { by: actor.id }
                },
                {
                    action: "decline",
                    label: game.i18n.localize("DRPG.Bridge.nothingThere"),
                    data: { by: actor.id, cost: String(cost) }
                }
            ]
        });

        // Ruled by a human, so Reroll can only re-ask — see reroll.mjs.
        await noteRollContext(actor, {
            actionKey: "search", goal: "specific", gmRuled: true,
            label: def.label, room, request
        });

        await report(actor, def, roll, {
            success: Boolean(hit) || roll.isCritical,
            text: game.i18n.localize("DRPG.Action.specificSent"),
            room, tokensLeft: SearchTokens.left(room)
        });
        return { calledGm: true, roll, tier, request };
    }

    if (!hit && !roll.isCritical) {
        await noteRollContext(actor, { actionKey: "search", room, category, goal: goalKey, tier: null });

        /*
         * THE ONE COMMON FAILURE IN THIS GAME THAT WAS COMPLETELY SILENT.
         *
         * A Search that finds nothing still costs an action and still burns one
         * of the room's three tokens, and until now the only sign of either was
         * a card saying so. Local, on the searcher's client: this branch runs
         * where the roll was made.
         *
         * The two other ways a Search ends nothing are deliberately NOT here. A
         * critical is not a failure, and a "something specific" request has gone
         * to a GM rather than come up empty — that one is waiting, not lost.
         */
        playSfx("searchNothing");

        await report(actor, def, roll, { text: def.failure, room, tokensLeft: SearchTokens.left(room) });
        return { success: false };
    }

    // Somebody else's stash is searched before the room is.
    //
    // The guide's stash is a place things are hidden IN a room, so a successful
    // search finds what is hidden there first and only falls through to the
    // room's own contents once the stash is empty. Nothing is drawn for a stash
    // — the loot is whatever its owner actually put in it, which is what makes
    // rifling through one worth the action.
    if (stashLoot.length) {
        const { requestVaultSteal } = await import("./gm-bridge.mjs");

        // The declaration still counts. Somebody rummaging for a weapon who
        // finds the hiding place should come out with the weapon if there is
        // one in there — and with whatever else is in there if not, because
        // finding the stash at all is the win.
        const wanted = stashLoot.filter(i =>
            i.getFlag(MODULE_ID, "category") === category);
        const pool = wanted.length ? wanted : stashLoot;
        const taken = pool[Math.floor(Math.random() * pool.length)];

        // `viaSearch`: this is the route that PAYS for a concealed stash — an
        // action, a search token, and the -1 applied above. Without it the GM
        // side refuses every concealed stash outright, which made beating the
        // concealment worth nothing at all. See `stealFromVault`.
        await requestVaultSteal({
            thiefId: actor.id, ownerId: stashOwner.id, itemId: taken.id, viaSearch: true
        });

        await noteRollContext(actor, {
            actionKey: "search", room, category, goal: goalKey, tier, fromVault: true
        });
        await report(actor, def, roll, {
            success: true,
            text: game.i18n.format("DRPG.Vault.foundInStash", {
                item: foundry.utils.escapeHTML(taken.name)
            }),
            room, tokensLeft: SearchTokens.left(room)
        });
        return { success: true, roll, tier, fromVault: true };
    }

    const drawn = await drawItem(category, tier, { goal: goalKey, room });

    // The item actually goes into the inventory, subject to the carry limits.
    let granted = null;
    if (drawn?.name) {
        const { grantItem } = await import("./inventory.mjs");
        // The icon and the sentence the GM wrote on the table entry travel with
        // it — see `drawItem`. Both are `null` for a built-in pool, which is
        // exactly what `grantItem` already treats as "use the category icon and
        // the tier line".
        granted = await grantItem(actor, {
            name: drawn.name, category, tier, goal: goalKey,
            img: drawn.img ?? null, description: drawn.description ?? "",
            // What else it can do, from the table entry it came out of.
            roles: drawn.roles ?? []
        });
    }

    // Only murder and cleaning gear leaves a trace, per the guide.
    const leaves = category !== "usable";
    const visibility = roll.isCritical ? def.critical?.remnant : hit?.remnant;

    let placed = null;
    let leftTrace = false;
    if (leaves && visibility) {
        const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
        const catLabel = ITEM_CATEGORIES[category]?.label ?? category;
        placed = await dropRemnant(actor, {
            type: "prep",
            visibility,
            faint: true,
            // Crime and cleaning gear is exactly what the guide protects from
            // the chapter-end sweep; `leaves` is only true for those two.
            tiedToCrime: true,
            action: "search",
            subject: drawn?.name ?? "",
            note: game.i18n.format("DRPG.Remnant.searchNote", {
                actor: actor.name,
                room: room ?? "?",
                category: catLabel,
                item: drawn?.name ?? "?",
                tier,
                total: roll.total
            })
        });
        leftTrace = traceFeedback(roll, placed);
    }

    const outcome = {
        success: true, tier, category,
        item: drawn?.name ?? null,
        carried: Boolean(granted),
        leftTrace,
        room, tokensLeft: SearchTokens.left(room)
    };

    // Everything Reroll needs to take this Search back: the item to remove, the
    // trace to retune, and what was being looked for so a new draw comes from
    // the same pool.
    await noteRollContext(actor, {
        actionKey: "search",
        room, category, goal: goalKey, tier,
        itemId: granted?.id ?? null,
        ...remnantRef(placed)
    });

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "search", roll, outcome });
    return outcome;
}

/**
 * What are you looking for?
 *
 * Five buttons in a row overflowed the screen, so this is a radio list in a
 * narrow panel — the same width as every other dialog the module opens.
 *
 * The guide splits usable items by what they restore, and the player declares
 * which they want before rolling. "Something specific" is the escape hatch: the
 * roll happens normally and then the GM is asked to say what was actually there,
 * because a described search is exactly the case a table cannot answer.
 *
 * @returns {Promise<{category: string, goal: string, request: string}|null>}
 */
/* ==========================================================================
 * ONE MENU, FIVE PLACES
 * --------------------------------------------------------------------------
 * Five actions ask the same shape of question — which flavour of this do you
 * want — and until now each answered it in a different idiom: Search had a
 * radio list with icons and hints, Observe and Project had rows of footer
 * buttons, Analyze had a select, Rest had a bulleted list with the buttons
 * underneath. Same decision, four layouts, and only one of them could say why
 * an option was not available.
 *
 * This is Search's list, lifted out: an icon, a title, a line of explanation,
 * and the two things the button rows could never carry.
 *
 *   UNAVAILABLE OPTIONS STAY ON THE LIST, struck through, with the reason
 *   where the hint goes. Seeing what you cannot do is half of what a menu is
 *   for — the same rule the Calls panel already follows.
 *
 *   OPTIONS THAT SUMMON A HUMAN ARE RED, with `drpg-gm-route`, the same class
 *   the buttons carry today. Red already means "this waits for somebody"
 *   everywhere else in the module.
 *
 * @param {object}   config
 * @param {Actor}    config.actor
 * @param {string}   config.title      Window title.
 * @param {string}   [config.intro]    HTML above the list — usually a briefing.
 * @param {string}   [config.prompt]   One line asking the question.
 * @param {Array}    config.options    `{ value, label, hint, icon, gmRoute,
 *                                        disabled, why }` — `label`/`hint`/`why`
 *                                        are literal text, already localised.
 * @param {string[]} [config.traits]   Show a trait picker for these.
 * @param {string}   [config.extra]    Extra HTML inside the form, under the list.
 * @param {string}   [config.confirm]  Label for the confirm button.
 * @returns {Promise<{value: string, trait: string|null, form: HTMLFormElement}|null>}
 */
/* ==========================================================================
 * THE SENTENCE COMES FIRST
 * --------------------------------------------------------------------------
 * Every action that can end in a GM ruling used to ask for the player's own
 * words AFTER the dice: choose the action, choose the trait, roll, and only
 * then a second window asking what you were actually trying to do. Search was
 * the exception — its box sits in the first window, next to the goal — and
 * Search is the one that reads right.
 *
 * The order matters for more than clicks. Typing "I check whether the lock has
 * been forced" before the roll is a declaration; typing it after a 6 is a
 * negotiation. The guide asks for the first.
 *
 * So the box is offered in the FIRST window of every action that has a GM
 * branch, and the answer travels with the roll. Nothing else about those
 * actions changes: the roll still happens where it happened, the card still
 * carries the same three parts.
 * ========================================================================== */

/**
 * The one window Think, Listen and their kin open before the dice: the
 * briefing, the trait (when there is a choice) and the box for what you are
 * actually trying to do.
 *
 * ALWAYS OPENS, even when the action has a single trait and nothing to pick —
 * `chooseTrait` short-circuits in that case, and short-circuiting past this
 * window would take the sentence with it.
 */
async function askTraitAndRequest(actor, actionKey, def) {
    const traits = def.traits ?? [];

    const picked = await DialogV2.wait({
        window: { title: def.label },
        classes: ["drpg-panel"],
        content: dialogContent(`${briefingBlock(actor, actionKey, def)}<form>
            ${requestFieldHtml({
                prompt: game.i18n.format("DRPG.Action.gmPrompt", { action: def.label }),
                placeholder: game.i18n.localize(`DRPG.Action.placeholder.${actionKey}`)
            })}
            ${traits.length ? traitFieldHtml(actor, traits) : ""}
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"), default: true,
                callback: (e, b, d) => ({
                    trait: traits.length ? readTraitField(d.element, traits) : null,
                    request: readRequestField(d.element)
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return picked;
}

/** The textarea, with whatever prompt the action wants above it. */
function requestFieldHtml({ prompt, placeholder, optional = true }) {
    return `<label class="drpg-specific-note">
        <span>${prompt}</span>
        <textarea name="request" rows="2" placeholder="${
            foundry.utils.escapeHTML(placeholder ?? "")}"></textarea>
        ${optional ? `<small class="notes">${
            game.i18n.localize("DRPG.Action.requestOptional")}</small>` : ""}
    </label>`;
}

/** Whatever was typed into that field, from a dialog that has already closed. */
function readRequestField(root) {
    return root?.querySelector('[name="request"]')?.value.trim() ?? "";
}

export async function chooseVariant({
    actor, title, intro = "", prompt = "", options = [], traits = null,
    extra = "", confirm = null, traitNote = ""
} = {}) {
    const usable = options.filter(o => !o.disabled);
    if (!usable.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.noVariants"));
        return null;
    }

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const first = usable[0].value;

    const rows = options.map(o => `
        <label class="drpg-choice${o.disabled ? " unavailable" : ""}${
            o.gmRoute ? " drpg-gm-route" : ""}">
            <input type="radio" name="variant" value="${esc(o.value)}"${
                o.value === first ? " checked" : ""}${o.disabled ? " disabled" : ""}>
            <i class="fa-solid ${esc(o.icon ?? "fa-circle")}" inert></i>
            <span class="drpg-choice-text">
                <strong>${esc(o.label)}</strong>
                <small>${esc(o.disabled ? (o.why ?? o.hint ?? "") : (o.hint ?? ""))}</small>
            </span>
        </label>`).join("");

    const picked = await DialogV2.wait({
        window: { title },
        classes: ["drpg-panel"],
        content: dialogContent(`${intro}<form>
            ${prompt ? `<p>${prompt}</p>` : ""}
            <div class="drpg-choice-list">${rows}</div>
            ${extra}
            ${traits?.length ? traitFieldHtml(actor, traits, { note: traitNote }) : ""}
        </form>`),
        buttons: [
            {
                action: "ok", default: true,
                label: confirm ?? game.i18n.localize("DRPG.Action.proceed"),
                callback: (e, b, d) => {
                    const form = d.element.querySelector("form");
                    return {
                        value: form.querySelector('input[name="variant"]:checked')?.value ?? first,
                        trait: traits?.length ? readTraitField(d.element, traits) : null,
                        form
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return picked;
}

async function chooseSearchCategory(actor, def = ACTIONS.search) {
    const options = [
        { value: "healing", category: "usable", icon: "fa-heart",
          label: "DRPG.Action.goalHealing", hint: "DRPG.Action.goalHealingHint" },
        { value: "stress", category: "usable", icon: "fa-brain",
          label: "DRPG.Action.goalStress", hint: "DRPG.Action.goalStressHint" },
        { value: "crimeTool", category: "crimeTool", icon: "fa-skull",
          label: "DRPG.Action.goalCrime", hint: "DRPG.Action.goalCrimeHint" },
        { value: "cleaningTool", category: "cleaningTool", icon: "fa-broom",
          label: "DRPG.Action.goalCleaning", hint: "DRPG.Action.goalCleaningHint" },
        { value: "specific", category: null, icon: "fa-magnifying-glass-plus",
          label: "DRPG.Action.goalSpecific", hint: "DRPG.Action.goalSpecificHint" }
    ];

    // The list this menu was lifted from — see `chooseVariant`. The textarea
    // rides along as `extra`, because "what specifically" belongs to exactly
    // one of the five rows and a second window for it would be the friction
    // this whole pattern removes.
    const picked = await chooseVariant({
        actor,
        title: ACTIONS.search.label,
        intro: briefingBlock(actor, "search", ACTIONS.search),
        prompt: game.i18n.localize("DRPG.Action.searchGoalHint"),
        confirm: game.i18n.localize("DRPG.Action.roll"),
        traits: def.traits,
        options: options.map(o => ({
            value: o.value,
            icon: o.icon,
            gmRoute: o.value === "specific",
            label: game.i18n.localize(o.label),
            hint: game.i18n.localize(o.hint)
        })),
        extra: `<label class="drpg-specific-note">
                <span>${game.i18n.localize("DRPG.Action.goalSpecificPrompt")}</span>
                <textarea name="request" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Action.goalSpecificPlaceholder")}"></textarea>
            </label>`
    });

    if (!picked) return null;

    const option = options.find(o => o.value === picked.value);
    const request = picked.form.querySelector('[name="request"]')?.value.trim() ?? "";

    if (picked.value === "specific" && !request) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.goalSpecificNeeded"));
        return null;
    }

    return { goal: picked.value, category: option?.category, request, trait: picked.trait };
}

/* ==========================================================================
 * PROJECTS
 * ========================================================================== */

/** Start something new (GM ruling) or push an existing project (automatic). */
async function performProject(actor, def, options) {
    const { projectsAvailableIn } = await import("./projects.mjs");
    const room = roomOfActor(actor);
    const here = room ? projectsAvailableIn(room) : [];

    // ONE WINDOW: which kind of work, WHICH project, and which statistic.
    //
    // It used to be two — pick "Work on", then pick the project on a screen of
    // its own. Sabotage has never done that; it asks for its target and its
    // statistic together, and there was never a reason for the two to differ.
    // The second window carried one <select> and a button.
    //
    // The list rides along as `extra`, the same way Search's "what
    // specifically" textarea does: it belongs to exactly one of the two rows,
    // and a window of its own is the friction this pattern exists to remove.
    //
    // "Work on" is struck through rather than missing when there is nothing
    // here to push — the reason is the useful half of the answer, and a player
    // who cannot see the option cannot tell whether they are in the wrong room
    // or the module has forgotten the project exists.
    const traitOptions = openTraits(here, def);

    const picked = await chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "project", def),
        prompt: game.i18n.localize("DRPG.Project.choosePrompt"),
        traits: traitOptions.length ? traitOptions : null,
        traitNote: game.i18n.localize("DRPG.Action.traitOnlyIfOpen"),
        options: [
            {
                value: "work", icon: "fa-hammer",
                label: game.i18n.localize("DRPG.Project.workOn"),
                hint: plural("DRPG.Project.workOnHint", { n: here.length }),
                disabled: !here.length,
                why: game.i18n.localize(room
                    ? "DRPG.Project.noneHere" : "DRPG.Action.noRoomNote")
            },
            {
                value: "start", icon: "fa-lightbulb", gmRoute: true,
                label: game.i18n.localize("DRPG.Project.startNew"),
                hint: game.i18n.localize("DRPG.Project.startNewHint")
            }
        ],
        extra: here.length
            ? `<label class="drpg-specific-note">
                <span>${game.i18n.localize("DRPG.Project.whichWork")}</span>
                <select name="project">${projectOptionsHtml(here)}</select>
            </label>`
            : ""
    });

    if (!picked) return null;
    if (picked.value === "start") return startProject(actor);

    // The window is closed by now, but `chooseVariant` hands back the form it
    // was read from, so the two fields are still there to be read.
    const chosen = here.find(pr => pr.id === picked.form?.querySelector("[name=project]")?.value)
        ?? here[0];
    const trait = resolveProjectTrait(chosen, picked.trait, def.traits ?? []);
    if (!trait) return null;

    return workOnProject(actor, def, options, { project: chosen, trait });
}

/**
 * Start a project without waiting for the GM.
 *
 * The guide has projects agreed with the GM beforehand, so the dialog says so
 * plainly rather than pretending otherwise — but it then creates the project,
 * because making the player wait mid-turn for a rubber stamp they already have
 * is exactly the friction the guide asks us to remove. The GM is told what was
 * created and can adjust or delete it.
 */
async function startProject(actor) {
    const { allRooms } = await import("./movement.mjs");
    const room = roomOfActor(actor);
    const rooms = allRooms();

    const scaleOptions = Object.entries(PROJECT_SCALE)
        .map(([key, s]) => `<option value="${s.progress}"${key === "everyday" ? " selected" : ""}>${s.label} — ${s.progress} progress</option>`)
        .join("");
    const roomOptions = [
        `<option value="">${game.i18n.localize("DRPG.Project.anyRoom")}</option>`,
        ...rooms.map(r => `<option value="${foundry.utils.escapeHTML(r)}"${r === room ? " selected" : ""}>${foundry.utils.escapeHTML(r)}</option>`)
    ].join("");

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.startNew") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p class="drpg-warning">${game.i18n.localize("DRPG.Project.agreedWarning")}</p>
            <label>${game.i18n.localize("DRPG.Project.name")}
                <input type="text" name="name" placeholder="${game.i18n.localize("DRPG.Project.namePlaceholder")}" autofocus /></label>
            <label>${game.i18n.localize("DRPG.Project.scale")}
                <select name="target">${scaleOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.room")}
                <select name="room">${roomOptions}</select></label>
            <label>${game.i18n.localize("DRPG.Project.trait")}
                <select name="trait">
                    <option value="">${game.i18n.localize("DRPG.Project.anyTrait")}</option>
                    ${Object.entries(TRAITS).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("")}
                </select></label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="murder" /> ${game.i18n.localize("DRPG.Project.indirectMine")}</label>
            <label>${game.i18n.localize("DRPG.Project.condition")}
                <input type="text" name="condition"
                       placeholder="${game.i18n.localize("DRPG.Project.conditionPlaceholder")}" />
                <small class="notes">${game.i18n.localize("DRPG.Project.conditionNote")}</small></label>
            <p class="notes">${game.i18n.localize("DRPG.Project.startNote")}</p>
        </form>`),
        buttons: [
            {
                action: "create",
                label: game.i18n.localize("DRPG.Project.proposeButton"),
                // Red, like the variant that opened this window and like every
                // other control that ends in somebody else deciding. Proposing
                // a project does not start one — it sends the GM a card and
                // waits, and the button that does that should say so.
                class: GM_ROUTE_CLASS,
                default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        name: f.name.value.trim(),
                        target: Number(f.target.value) || 4,
                        room: f.room.value || null,
                        trait: f.trait.value || null,
                        murder: f.murder.checked,
                        condition: f.condition.value.trim()
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    if (!result.name) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.needsName"));
        return null;
    }

    // A PROPOSAL, NOT A PROJECT.
    //
    // This used to create the countdown outright, on the reasoning that the
    // guide has projects agreed with the GM beforehand and a rubber stamp
    // mid-turn is friction. In practice the agreement is where the work is: what
    // it takes, which room it belongs to, whether it is quietly a murder weapon.
    // A player filling in five fields alone was making all of those calls by
    // themselves and the GM found out afterwards, from a tray that had grown a
    // row.
    //
    // Same shape as the direct-murder declaration (see `performDirectMurder`):
    // the form becomes a card the GM reads, with the answers on it, and one
    // press opens their own creation screen prefilled so they can correct
    // anything before it lands. Nothing exists in the world until they do.
    const scaleLabel = Object.values(PROJECT_SCALE)
        .find(s => s.progress === result.target)?.label ?? `${result.target}`;
    const esc = foundry.utils.escapeHTML;

    const summary = [
        `<strong>${esc(result.name)}</strong>`,
        `${esc(scaleLabel)} · ${result.target} progress`,
        result.room ? esc(result.room) : game.i18n.localize("DRPG.Project.anyRoom"),
        result.trait ? (TRAITS[result.trait]?.label ?? result.trait) : game.i18n.localize("DRPG.Project.anyTrait")
    ].join(" · ");

    await promptAndCallGm(actor, {
        title: game.i18n.localize("DRPG.Project.proposalTitle"),
        prompt: game.i18n.localize("DRPG.Project.proposalPrompt"),
        placeholder: game.i18n.localize("DRPG.Project.proposalPlaceholder"),
        room,
        body: `${summary}${result.condition ? `<br><em>${esc(result.condition)}</em>` : ""}${
            result.murder ? `<br><span class="drpg-warning">${
                esc(game.i18n.localize("DRPG.Project.indirectMine"))}</span>` : ""}`,
        actions: [
            {
                action: "approveProject",
                label: game.i18n.localize("DRPG.Project.approveButton"),
                // Lowercase keys only: `data-*` attributes arrive through
                // `dataset`, which lowercases everything, so `killerId` would
                // come back as `killerid` and quietly read undefined.
                data: {
                    by: actor.id,
                    pname: result.name,
                    target: String(result.target),
                    room: result.room ?? "",
                    trait: result.trait ?? "",
                    murder: result.murder ? "1" : "",
                    condition: result.condition ?? ""
                }
            },
            {
                action: "declineProject",
                label: game.i18n.localize("DRPG.Project.declineButton"),
                data: { by: actor.id }
            }
        ]
    });

    await whisperToOwner(actor, `${cardHead({
        action: game.i18n.localize("DRPG.Project.startNew")
    })}<p>${
        game.i18n.format("DRPG.Project.proposalSent", { name: esc(result.name) })
    }</p>`);

    return { proposed: true, name: result.name };
}

async function workOnProject(actor, def, options, chosen = null) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const room = roomOfActor(actor);
    // Two lists, because a finished project is neither absent nor workable.
    // `listed` is what the player sees; `workable` is what they may pick.
    const listed = projectsListedIn(room);
    const here = listed.filter(p => !p.complete);
    if (!here.length) {
        // Say that there is nothing here, and nothing else.
        //
        // This used to list every project running anywhere on the map, by name
        // and by room, to any player who walked into an empty room — indirect
        // murders included. "Prepare the poison (Chemistry Lab)" handed to the
        // whole table by a mis-click is not a hint, it is the answer to the
        // chapter. Where other people's projects are is theirs to reveal.
        //
        // A room whose only projects are finished gets a different sentence:
        // "there is nothing here" is a lie the player can see out of the window,
        // and it is the sentence that used to send them looking for the bug.
        ui.notifications.warn(listed.length
            ? game.i18n.format("DRPG.Project.allComplete", { room: room ?? "—" })
            : game.i18n.format("DRPG.Project.noneHere", { room: room ?? "—" }));
        return null;
    }

    // Normally both of these were answered in the window that got us here.
    // The fallback is not dead code: this function is the one entry point that
    // knows how to run a project roll, and a caller that has not asked yet —
    // or has asked about a project that has since been finished or frozen —
    // still needs somewhere to ask.
    const stillThere = chosen?.project && here.some(pr => pr.id === chosen.project.id);
    const picked = stillThere
        ? chosen
        : await chooseProjectAndTrait(listed, "DRPG.Project.whichWork", actor, def,
            { disableComplete: true });
    if (!picked) return null;
    const { project, trait } = picked;

    const indirect = isIndirectMurder(project.id);
    const witnesses = othersInRoom(actor);
    const lines = [];
    let bonus = 0;

    // Pay before any dice are thrown.
    //
    // An indirect murder rolls to conceal intent *before* the project roll, and
    // every roll commits its resources — Hope, Sanity, and a Despair point to a
    // Monokuma. With the charge sitting after the main roll, backing out of that
    // roll left the conceal roll's winnings in place at no cost, which is a Hope
    // generator anyone could run all day.
    if (cost > 0 && !await spendAction(actor, cost)) return null;

    // Guide: with someone else in the room, the killer must hide their intent
    // first; alone, the project simply gains +1 progress.
    if (indirect) {
        if (witnesses.length) {
            const conceal = await rollTrait(actor, INDIRECT_MURDER.concealIntent.trait,
                { remember: false, title: game.i18n.localize("DRPG.Roll.concealIntent") });
            if (!conceal) return abort(actor, cost);
            const ok = conceal.isCritical || conceal.total >= INDIRECT_MURDER.concealIntent.threshold;
            lines.push(`<p><strong>${INDIRECT_MURDER.concealIntent.label}</strong> — ${conceal.total}: ${
                ok ? (conceal.withFear
                        ? INDIRECT_MURDER.concealIntent.successWithDespair
                        : INDIRECT_MURDER.concealIntent.success)
                   : INDIRECT_MURDER.concealIntent.failure
            }</p>`);
            if (ok && conceal.withFear) bonus += 1;
        } else {
            bonus += INDIRECT_MURDER.concealIntent.aloneBonus;
            lines.push(`<p><em>${game.i18n.localize("DRPG.Project.aloneBonus")}</em></p>`);
        }
    }

    /*
     * A TOOL IN HAND IS WORTH A DIE (E8).
     *
     * `armSituational` rather than a flat bonus, so after E7 it adds to the
     * room's favour and to a Hope Call rather than replacing either: a tool, in
     * a room that suits the work, with an Ultimate behind it is genuinely three
     * dice. The concealment roll above cannot pick this up — it goes through
     * `remember: false`, which shields it (trap 61), and that was already true
     * before this line existed.
     */
    const { equippedFor, breakOnDespair } = await import("./use-items.mjs");
    const calls = await import("./call-effects.mjs");
    const tool = equippedFor(actor, "tool");
    if (tool) calls.armSituational(1);

    let roll;
    try {
        roll = await rollTrait(actor, trait, {
            actionKey: "project",
            title: game.i18n.localize(indirect ? "DRPG.Roll.murderProject" : "DRPG.Roll.project"),
            context: { room: roomOfActor(actor), projectId: project.id, bonus, cost }
        });
    } finally {
        // Cleared whatever happened, like every other armed situation: one that
        // outlived its roll would attach itself to the next unrelated one.
        calls.clearSituational();
    }
    if (!roll) return abort(actor, cost);

    await breakOnDespair(actor, tool, roll);

    const hit = roll.isCritical ? def.critical : resolveThreshold(roll.total, def.thresholds);
    const thresholdProgress = hit?.progress ?? 0;
    // The bonus only rides on top of progress that was actually earned.
    const earnedBonus = thresholdProgress ? bonus : 0;
    const progress = thresholdProgress + earnedBonus;

    let applied = null;
    if (progress > 0) applied = await addProgress(project.id, progress);

    // Reroll needs to know what this roll gave the project, so it can take the
    // same amount back before applying the new result.
    //
    // The bonus is recorded apart from the threshold progress on purpose. Reroll
    // rescores the new dice against the thresholds alone, so storing only the
    // combined figure made it subtract a bonus it could never recompute — an
    // indirect murder quietly lost its alone/Despair progress on every reroll.
    await noteRollContext(actor, {
        actionKey: "project", projectId: project.id, progress, bonus: earnedBonus,
        room: roomOfActor(actor),
        // Whether the critical's free action has already been handed back, so a
        // reroll that loses the critical knows there is one to take away again.
        refunded: Boolean(hit?.refundAction && cost > 0)
    });

    // Guide: every project action also rolls to hide the traces it leaves.
    let traceLeftTrace = false;
    if (indirect) {
        const trace = await rollTrait(actor, INDIRECT_MURDER.hideTraces.trait,
            { remember: false, title: game.i18n.localize("DRPG.Roll.hideTraces") });
        if (trace) {
            const band = trace.isCritical
                ? INDIRECT_MURDER.hideTraces.critical
                : resolveThreshold(trace.total, INDIRECT_MURDER.hideTraces.thresholds);
            const traceRemnant = band?.remnant ?? "obvious";

            const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
            const placed = await dropRemnant(actor, {
                type: "prep",
                visibility: traceRemnant,
                faint: true,
                action: "project",
                subject: project.name,
                note: game.i18n.format("DRPG.Remnant.projectNote", {
                    actor: actor.name,
                    project: project.name,
                    room: roomOfActor(actor) ?? "?",
                    progress,
                    total: trace.total
                })
            });
            traceLeftTrace = traceFeedback(trace, placed);

            // Just the score — never the band this rolled into (see
            // `traceFeedback`). Whether anything is said about the trace
            // itself is `report()`'s generic `outcome.leftTrace` line below,
            // the same one every other action uses, so this does not print
            // its own second copy of that sentence.
            lines.push(`<p><strong>${INDIRECT_MURDER.hideTraces.label}</strong> — ${trace.total}</p>`);
        }
    }

    // A critical on a project hands the action back. Applied here, where the
    // action was spent, rather than inside `report()`.
    if (hit?.refundAction && cost > 0) await refundAction(actor, cost);

    const outcome = {
        success: progress > 0,
        progress,
        project: project.name,
        applied,
        refundAction: Boolean(hit?.refundAction),
        leftTrace: traceLeftTrace,
        extra: lines.join(""),
        text: progress > 0
            ? game.i18n.format("DRPG.Action.progressOn", { n: progress, project: project.name })
            : def.failure
    };

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "project", roll, outcome });
    return outcome;
}

/**
 * Pick a project from an explicit list, and — only when at least one
 * candidate leaves the required trait open — the trait to use for it, in the
 * SAME window instead of a second one immediately after.
 *
 * Used to be two sequential dialogs every time: which project, then (when
 * the project had no fixed trait) which trait. The trait field costs nothing
 * to show up front — it is simply ignored once the chosen project turns out
 * to have one fixed, exactly as the old second dialog would never have
 * appeared in that case either.
 *
 * @returns {Promise<{project: object, trait: string}|null>} null on cancel,
 *   or if the resolved trait is empty (no trait allowed at all).
 */
/**
 * One project as an <option>: its name, how far along it is, and where.
 *
 * `disableComplete` is only ever set by Work on Project. A finished project is
 * shown — struck through and unpickable — rather than dropped from the list,
 * because dropping it looks like the project was cleared away and sends the
 * player to ask a GM what happened to it. Sabotage does not pass the flag: a
 * finished project is a perfectly good thing to break.
 *
 * The first project that can still be worked on is marked `selected` by hand.
 * Browsers do skip disabled options when choosing a default, but only in the
 * absence of an explicit one, and a picker whose default depends on that is a
 * picker one browser update away from opening on an unpickable row.
 */
function projectOptionsHtml(list, { disableComplete = false } = {}) {
    let defaulted = false;
    return list.map(p => {
        const target = p.start ? ` — ${p.current}/${p.start}${scaleFor(p.start) ? `, ${scaleFor(p.start)}` : ""}` : "";
        const where = p.room ? ` · ${p.room}` : "";
        const done = disableComplete && p.complete;

        let mark = "";
        if (done) {
            mark = ` disabled class="is-complete"`;
        } else if (!defaulted) {
            mark = " selected";
            defaulted = true;
        }

        // The word as well as the line through it. The strike is the glance and
        // the word is the answer, and only one of the two survives a picker
        // drawn by a browser that will not style an <option>.
        const suffix = done ? ` — ${game.i18n.localize("DRPG.Project.completeTag")}` : "";
        return `<option value="${p.id}"${mark}>${
            foundry.utils.escapeHTML(p.name)}${target}${where}${suffix}</option>`;
    }).join("");
}

/**
 * Which statistics this window has to ask about, if any.
 *
 * A project may fix the statistic its work demands, and most do. The field is
 * only worth showing when the action offers a choice AND at least one project
 * in the list leaves that choice open — otherwise it is a control that changes
 * nothing, which is worse than no control.
 */
function openTraits(list, def) {
    const traits = def.traits ?? [];
    return traits.length > 1 && list.some(p => !p.trait) ? traits : [];
}

/**
 * The statistic this roll ends up using, and saying so when it was not a choice.
 *
 * Order matters: the project's own demand outranks anything the player picked,
 * because a fixed project is fixed for everybody. Shared by both windows that
 * lead into a project roll, so Work on Project and Sabotage cannot drift.
 */
function resolveProjectTrait(project, chosen, traitOptions) {
    const trait = project?.trait ?? chosen ?? (traitOptions.length === 1 ? traitOptions[0] : null);
    if (!trait) return null;

    if (project?.trait) {
        ui.notifications.info(game.i18n.format("DRPG.Project.traitFixed", {
            trait: TRAITS[project.trait]?.label ?? project.trait
        }));
    }
    return trait;
}

async function chooseProjectAndTrait(list, promptKey, actor, def, { disableComplete = false } = {}) {
    const traitOptions = def.traits ?? [];
    const projectOptions = projectOptionsHtml(list, { disableComplete });

    const traitField = openTraits(list, def).length
        ? traitFieldHtml(actor, traitOptions, {
            note: game.i18n.localize("DRPG.Action.traitOnlyIfOpen")
          })
        : "";

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Project.title") },
        classes: ["drpg-panel"],
        // No briefing here: Work-on-Project already showed one on the window
        // before this, and Sabotage's own path opens this dialog first. Repeating
        // it would put the same three paragraphs on two consecutive windows.
        content: dialogContent(`${def === ACTIONS.sabotage ? briefingBlock(actor, "sabotage", def) : ""}<form>
            <label>${game.i18n.localize(promptKey)}
                <select name="project">${projectOptions}</select></label>
            ${traitField}
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => ({
                    id: d.element.querySelector("[name=project]").value,
                    trait: d.element.querySelector("[name=trait]")?.value ?? null
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    const project = list.find(p => p.id === result.id) ?? null;
    if (!project) return null;

    // The row was disabled, so this should be unreachable — and it is the kind
    // of unreachable that a keyboard, a screen reader or a browser that draws
    // its own picker can reach anyway. Refusing here costs one comparison and
    // is the difference between "the option was greyed" and "the option cannot
    // be taken".
    if (disableComplete && project.complete) {
        ui.notifications.warn(game.i18n.format("DRPG.Project.alreadyComplete", {
            name: project.name
        }));
        return null;
    }

    const trait = resolveProjectTrait(project, result.trait, traitOptions);
    if (!trait) return null;

    return { project, trait };
}

/* ==========================================================================
 * SABOTAGE
 * ========================================================================== */

async function performSabotage(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const room = roomOfActor(actor);
    const { sabotageTargetsIn, sabotageProject } = await import("./projects.mjs");

    // WHICH CHARACTER, NOT WHICH ACCOUNT.
    //
    // This used to read `game.user.isGM || isMonokuma(actor)`, and the first
    // half is the bug: it asks who is holding the mouse rather than who is in
    // the fiction. A GM opening a student's sheet — to test it, to play an
    // absent player's character, to walk somebody through their turn — got the
    // whole map as targets, because the ACCOUNT was privileged even though the
    // CHARACTER was a student standing in one room. That is the "sabotage
    // reaches projects in other rooms" report, and no player ever saw it,
    // which is why it looked intermittent.
    //
    // A Monokuma still reaches anywhere: they walk the map freely and are not
    // standing in the players' geography at all. That is a fact about the
    // character, and it survives whoever is logged in as them.
    const { isMonokuma } = await import("./monokuma.mjs");
    const anyRoom = isMonokuma(actor);
    const targets = sabotageTargetsIn(room, { anyRoom });

    // Say what is being held back and why.
    //
    // Two rules quietly remove projects from this list — a project already
    // frozen by an earlier sabotage, and a repair project, which there is no
    // sense in breaking. Both are correct and both were invisible, so a Monokuma
    // saw some projects and not others with nothing to explain the difference.
    // The SAME reach `sabotageTargetsIn` uses, or this list names projects in
    // other rooms — which is both a leak and a lie, since they were never
    // candidates and are not being "held back" from anything.
    const { visibleProjects, isFrozen, repairs } = await import("./projects.mjs");
    const withheld = visibleProjects()
        .filter(p => anyRoom || (room && p.room === room))
        .filter(p => isFrozen(p.id) || repairs(p.id));

    if (!targets.length) {
        ui.notifications.warn(withheld.length
            ? game.i18n.format("DRPG.Project.allSabotaged", {
                  names: withheld.map(p => p.name).join(", ")
              })
            : game.i18n.localize("DRPG.Project.nothingToSabotage"));
        return null;
    }

    if (withheld.length) {
        ui.notifications.info(game.i18n.format("DRPG.Project.someSabotaged", {
            names: withheld.map(p => p.name).join(", ")
        }));
    }

    // Breaking a thing takes the same kind of work as building it, so sabotage
    // uses the project's own trait. The player does not get to pick an easier
    // one than the people who built it had to use — the trait field in this
    // same dialog only ever matters for a target that left it open, same as
    // Work on Project. See chooseProjectAndTrait().
    const picked = await chooseProjectAndTrait(targets, "DRPG.Project.whichSabotage", actor, def);
    if (!picked) return null;
    const { project, trait } = picked;

    // Someone is watching. Cover what you are doing before you do it, exactly
    // as an indirect murder covers its intent — and learn the answer while
    // there is still time to walk away.
    const witnesses = othersInRoom(actor);
    const lines = [];
    let penalty = 0;

    // Paid before the concealment roll, for the same reason as Work on Project:
    // that roll grants Hope and feeds a Despair pool, and an uncharged cancel
    // afterwards turned it into free resources.
    if (cost > 0 && !await spendAction(actor, cost)) return null;

    if (witnesses.length) {
        const conceal = await rollTrait(actor, SABOTAGE_CONCEAL.trait,
            { remember: false, title: game.i18n.localize("DRPG.Roll.concealIntent") });
        if (!conceal) return abort(actor, cost);

        const hidden = conceal.isCritical || conceal.total >= SABOTAGE_CONCEAL.threshold;
        if (hidden && conceal.withFear) penalty = SABOTAGE_CONCEAL.despairPenalty;

        lines.push(`<p><strong>${SABOTAGE_CONCEAL.label}</strong> — ${conceal.total}: ${
            hidden
                ? (conceal.withFear ? SABOTAGE_CONCEAL.successWithDespair : SABOTAGE_CONCEAL.success)
                : SABOTAGE_CONCEAL.failure
        }</p>`);

        // A failure is public: the room saw enough to describe it.
        if (!hidden) {
            await announce({
                content: `<p><em>${game.i18n.format("DRPG.Action.sabotageWatched", {
                    actor: foundry.utils.escapeHTML(actor.name),
                    room: foundry.utils.escapeHTML(room ?? "—"),
                    project: foundry.utils.escapeHTML(project.name)
                })}</em></p>`
            });

            const carryOn = await DialogV2.confirm({
                classes: ["drpg-panel"],
                window: { title: def.label },
                content: `<p>${SABOTAGE_CONCEAL.failure}</p>
                          <p>${game.i18n.localize("DRPG.Action.sabotageCarryOn")}</p>`,
                rejectClose: false
            });
            // Walking away is a real choice, not a wasted turn: the roll that
            // gave them the information has happened, but the sabotage has not,
            // so the action is returned.
            if (!carryOn) {
                await abort(actor, cost);
                return { aborted: true, seen: true };
            }
        }
    } else {
        lines.push(`<p><em>${SABOTAGE_CONCEAL.aloneNote}</em></p>`);
    }

    // Sabotage is project work with the sign flipped, so the tool counts here
    // too — the guide's own "including sabotage". `performSabotage` did not look
    // at the inventory at all before this (trap 60), so it is armed here rather
    // than assumed to arrive from the project path.
    const { equippedFor, breakOnDespair } = await import("./use-items.mjs");
    const calls = await import("./call-effects.mjs");
    const tool = equippedFor(actor, "tool");
    if (tool) calls.armSituational(1);

    let roll;
    try {
        roll = await rollTrait(actor, trait, {
            actionKey: "sabotage",
            context: { room, targetProjectId: project.id, penalty, witnesses: witnesses.length }
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return abort(actor, cost);

    await breakOnDespair(actor, tool, roll);

    const score = roll.total + penalty;
    const hit = roll.isCritical ? def.critical : resolveThreshold(score, def.thresholds);
    const success = Boolean(hit);

    // A successful sabotage freezes the project and spawns its repair. The
    // better the roll, the harder the repair — the guide scales it from
    // "simple" to "hidden-difficulty".
    //
    // `sabotageProject` now waits for the GM's client to confirm the freeze and
    // the repair actually landed, rather than handing back `{pending: true}`
    // the instant the request was sent. It used to report success on the
    // strength of the emit alone, which is exactly how a player sabotaging a
    // project and immediately trying to keep working on it could win the race:
    // the roll called it frozen before the world setting agreed.
    let repair = null;
    if (success) {
        // Guide's Sabotage table, by the repair project it demands:
        //   12 -> trivial (3)   18 -> complex (6)   crit -> desperate (8)
        // The 12 band was creating a 4-progress "everyday" repair, one scale
        // step harder than the guide asks for.
        const difficulty = roll.isCritical
            ? PROJECT_SCALE.desperate.progress
            : score >= 18 ? PROJECT_SCALE.complex.progress : PROJECT_SCALE.trivial.progress;
        repair = await sabotageProject(project.id, difficulty);
    }
    // The dice succeeded but nobody was there (or ready in time) to actually
    // write the freeze — say so rather than claiming a state that never
    // landed. `success` stays true below: the attempt itself still happened,
    // still leaves a trace, and can still reveal the actor on a Despair.
    const applied = Boolean(repair?.repair);
    const applyFailed = success && !applied;

    // Sabotage always leaves a trace, success or not.
    const visibility = success ? hit.remnant : def.failureRemnant;
    const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
    const placed = await dropRemnant(actor, {
        type: "prep",
        visibility,
        faint: true,
        action: "sabotage",
        subject: project.name,
        note: game.i18n.format("DRPG.Remnant.sabotageNote", {
            actor: actor.name,
            project: project.name,
            room: room ?? "?",
            total: roll.total,
            outcome: success
                ? game.i18n.format("DRPG.Remnant.sabotageWorked", { repair: repair?.repair?.name ?? "?" })
                : game.i18n.localize("DRPG.Remnant.sabotageFailed")
        })
    });

    const outcome = {
        success,
        applied,
        project: project.name,
        leftTrace: traceFeedback(roll, placed),
        extra: lines.join(""),
        // Despair reveals the attempt to anyone else in the room.
        revealed: roll.withFear && witnesses.length > 0,
        text: !success
            ? def.failure
            : applyFailed
                ? game.i18n.format("DRPG.Project.sabotageNotApplied", { name: project.name })
                : `${hit.result} — ${game.i18n.format("DRPG.Project.frozenNow", {
                      name: project.name, repair: repair.repair.name
                  })}`
    };

    if (outcome.revealed) {
        await announce({
            content: `<p><em>${game.i18n.format("DRPG.Action.sabotageSeen", {
                actor: foundry.utils.escapeHTML(actor.name),
                room: foundry.utils.escapeHTML(room ?? "—")
            })}</em></p>`
        });
    }

    // What Reroll has to unpick: the freeze on the target, the repair project it
    // spawned, and the trace. The concealment penalty rides along because the new
    // roll is scored the same way this one was.
    await noteRollContext(actor, {
        actionKey: "sabotage",
        room,
        targetProjectId: project.id,
        repairId: repair?.repair?.id ?? null,
        penalty,
        witnesses: witnesses.length,
        ...remnantRef(placed)
    });

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "sabotage", roll, outcome });
    return outcome;
}

/* ==========================================================================
 * ACTIONS THAT NEED A HUMAN
 * ========================================================================== */

/** Think, Listen, Analyze, Observe: roll, then hand the result to the GM. */
async function performGmAction(actor, actionKey, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    // One window, before anything is thrown: the trait and the sentence.
    const asked = await askTraitAndRequest(actor, actionKey, def);
    if (!asked) return null;
    const { trait, request } = asked;
    // An action with traits to choose between and none chosen is a dismissal.
    if ((def.traits?.length ?? 0) && !trait) return null;

    const roll = await rollTrait(actor, trait, { actionKey });
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const body = buildGmBody(actionKey, def, roll);

    await callGm(actor, {
        title: def.label,
        request,
        roll,
        room: roomOfActor(actor),
        body,
        // Nothing mechanical to apply — Think and Listen end in a sentence — so
        // the card carries the two answers that ARE the ruling: say it, or say
        // there is nothing and hand the action back.
        actions: gmRulingActions(actor, cost)
    });

    // Ruled by a human. Reroll cannot undo a ruling, so it re-asks — see
    // `settleGmRuling` in reroll.mjs.
    await noteRollContext(actor, {
        actionKey, gmRuled: true, request, label: def.label, room: roomOfActor(actor)
    });

    await whisperToOwner(actor, `${rollHead(def, roll)}${body}`, rollCardFlags(def, roll));

    return { calledGm: true, roll };
}

/**
 * The two buttons every ruling gets when there is nothing mechanical to apply.
 *
 * "Reply" posts the GM's sentence into the thread the question arrived in;
 * "There is nothing" hands the action back, because a question that is never
 * answered has not been paid for. Both are handled in `runCallAction`.
 */
function gmRulingActions(actor, cost = 0) {
    return [
        {
            action: "reply",
            label: game.i18n.localize("DRPG.Bridge.reply"),
            data: { by: actor.id }
        },
        {
            action: "decline",
            label: game.i18n.localize("DRPG.Bridge.nothingThere"),
            data: { by: actor.id, cost: String(cost) }
        }
    ];
}

/** The reference the GM needs to rule, right next to the roll. */
function buildGmBody(actionKey, def, roll) {
    if (def.thresholds?.length) {
        const rows = def.thresholds.map(t =>
            `<li>${t.min}+ — ${foundry.utils.escapeHTML(t.result ?? "")}</li>`).join("");
        const crit = def.critical?.result
            ? `<li><em>${game.i18n.localize("DRPG.Action.critical")} — ${foundry.utils.escapeHTML(def.critical.result)}</em></li>`
            : "";
        return `<ul class="drpg-gm-reference">${rows}${crit}</ul>`;
    }

    if (actionKey === "observe") {
        return `<p><small>${game.i18n.format("DRPG.Action.observeGm", { total: roll.total })}</small></p>`;
    }
    if (actionKey === "analyze") {
        return `<p><small>${game.i18n.localize("DRPG.Action.analyzeGm")}</small></p>`;
    }
    return "";
}

/**
 * Observe — the Investigation's engine.
 *
 * Guide, p. 30: the player declares HOW they are looking, and that decides what
 * they can find. The three declarations map onto the easiest Remnant in the
 * room, the one closest to a stated request, and the hardest.
 *
 * The scoring does not happen here. Which Remnants are in the room, what they
 * are and therefore how hard they are to spot are all things the observer must
 * not know — and Foundry ships every scene's tokens to every client, so this
 * client physically holds those answers. Asking it to judge the roll would be
 * asking the player to mark their own paper. So this side declares, asks the GM
 * to fix a target, throws the dice, and sends the number. See observe.mjs.
 *
 * When the room holds nothing left to find, the action falls back to the older
 * behaviour: a roll and a GM ruling. That is the guide's "Daily Life" column —
 * Observe can also simply turn something interesting up.
 */
async function performObserve(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const asked = await askDeclaration(actor, def);
    if (!asked) return null;
    const { declaration, request } = asked;

    // Looking at something that is not a trace at all — a room, a person, a
    // machine, the weather. The guide's "Daily Life" column: Observe can simply
    // turn something interesting up, and only a human can say what. No Remnant
    // is involved, so there is nothing to rank and nothing to score.
    if (declaration === "anything") return observeAnything(actor, def, cost, request);

    // "Specific" is the only declaration whose target depends on a sentence from
    // the player — and that sentence now arrives with the declaration rather
    // than after the roll, so this branch simply carries it through.
    if (declaration === "specific") return observeSpecific(actor, def, cost, request);

    return observeRanked(actor, def, cost, options, declaration);
}

/**
 * General and Non-obvious: the target is decided by the table, not by anything
 * the player says, so it can be — and is — fixed before the dice are thrown.
 */
async function observeRanked(actor, def, cost, options, declaration) {
    const { requestObserveTarget } = await import("./gm-bridge.mjs");
    const target = await requestObserveTarget({ actorId: actor.id, declaration, request: "" });

    // No answer at all: the warning has already been shown, and nothing has been
    // spent. Leave the action in the player's pocket.
    if (!target) return null;

    if (!target.ok) {
        // Nothing here to find, or the character is not standing in a room:
        // hand it to the GM the way Observe always used to work.
        return performGmAction(actor, "observe", def, options);
    }

    const roll = await rollTrait(actor, "eye", { actionKey: "observe" });
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    return settleObserveRoll(actor, def, roll, target.key, declaration);
}

/**
 * Specific: roll, then say what you were after.
 *
 * The order used to be the other way round — type the request, let the GM fix a
 * target, then roll — and the reason given was that a GM who already knew the
 * total could pick a target to suit the number. That reason still holds, and it
 * is still honoured: what moves is the QUESTION, not the number. The request
 * travels in `requestObserveTarget`, which carries no total; the roll is only
 * sent afterwards, in `requestObserveResolve`. The GM picks blind exactly as
 * before.
 *
 * What is gained is that nobody types a sentence for a roll they have not made
 * yet, and the two declarations that never used the sentence stopped asking for
 * one at all.
 *
 * A roll cannot be taken back, so every path from here spends the action and
 * produces an answer. A cancelled request drops to the General reading rather
 * than throwing the throw away, and a GM who has nothing to point at gets a
 * ruling built on the dice already on the table — never a second roll.
 */
async function observeSpecific(actor, def, cost, request = "") {
    // The sentence was typed in the declaration window, before the dice — see
    // "THE SENTENCE COMES FIRST". Leaving it empty is still allowed and still
    // means the same thing: with nothing named, this is an ordinary sweep of
    // the room and it is scored as one.
    const declaration = request ? "specific" : "general";
    if (!request) ui.notifications.info(game.i18n.localize("DRPG.Observe.requestSkipped"));

    const roll = await rollTrait(actor, "eye", { actionKey: "observe" });
    if (!roll) return null;

    const { requestObserveTarget } = await import("./gm-bridge.mjs");
    const target = await requestObserveTarget({ actorId: actor.id, declaration, request });

    // Nobody answered — no GM is listening. `requestObserveTarget` has already
    // said so, and the action stays in the player's pocket: there is nobody to
    // rule on it either, so charging for it would be charging for silence.
    if (!target) return null;

    if (cost > 0) await spendAction(actor, cost);

    // Refused, empty room, no room at all: the GM rules on the roll that has
    // already been thrown. Calling `performGmAction` here would roll a second
    // time for the same action.
    if (!target.ok) return ruleObserve(actor, def, roll, request, null, cost);

    return settleObserveRoll(actor, def, roll, target.key, declaration);
}

/** Send the number, bookmark the context, and say nothing about the verdict. */
async function settleObserveRoll(actor, def, roll, observeKey, declaration) {
    const { requestObserveResolve } = await import("./gm-bridge.mjs");

    await noteRollContext(actor, {
        actionKey: "observe",
        observeKey,
        declaration,
        label: def.label,
        room: roomOfActor(actor)
    });

    await requestObserveResolve({
        actorId: actor.id,
        key: observeKey,
        total: roll.total,
        isCritical: Boolean(roll.isCritical)
    });

    // Deliberately silent about the outcome: the verdict is the GM's to send,
    // and this client does not know the difficulty it was measured against.
    //
    // "The GM is judging what you found" only where a GM actually is. A sweep
    // of the room is scored on the GM's client without a human touching it, and
    // the verdict lands about a second later — so the note told the player to
    // wait for something that had already happened, on the one branch where it
    // was never true. Naming a target and asking the GM outright do go to a
    // person, and there the wait is real.
    const waits = declaration === "specific" || declaration === "anything";

    await whisperToOwner(actor, `${rollHead(def, roll)}${
        waits ? `<p><small>${game.i18n.localize("DRPG.Observe.sent")}</small></p>` : ""}`, rollCardFlags(def, roll));

    return { roll, observeKey };
}

/**
 * Observe aimed at something other than a Remnant.
 *
 * Rolls first and asks afterwards, like the specific branch: what the player is
 * looking at is a sentence for the GM to rule on, and there is no reason to
 * write it before knowing the number. Marked `gmRuled`, which is what it is — a
 * Reroll re-asks rather than pretending to recompute a table that does not
 * exist for this branch.
 */
async function observeAnything(actor, def, cost, request = "") {
    const roll = await rollTrait(actor, "eye", { actionKey: "observe" });
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    // Not the button's own label: "Ask the GM" is clear on a button the player is
    // pressing and meaningless as the title of the window it arrives in. The GM
    // gets a title that says which action this was.
    return ruleObserve(actor, def, roll, request,
        game.i18n.localize("DRPG.Observe.anythingTitle"), cost);
}

/** Hand a roll that has already happened to the GM as a ruling. */
async function ruleObserve(actor, def, roll, request, title = null, cost = 0) {
    const { callGm } = await import("./gm-bridge.mjs");
    const label = title ?? def.label;
    const room = roomOfActor(actor);

    await callGm(actor, {
        title: label,
        body: `<p><small>${game.i18n.format("DRPG.Action.observeGm", { total: roll.total })}</small></p>`,
        roll,
        request,
        room,
        // This is the branch where a GM decides there IS something at the point
        // of interest the player named — so the first button places it, as a
        // Key Remnant in the room they are standing in, and offers to hang it
        // on a planned clue that has no trace yet.
        actions: [
            {
                action: "keyRemnantHere",
                label: game.i18n.localize("DRPG.Bridge.keyRemnantHere"),
                data: { by: actor.id, room: room ?? "", want: request ?? "" }
            },
            {
                action: "reply",
                label: game.i18n.localize("DRPG.Bridge.reply"),
                data: { by: actor.id }
            },
            {
                action: "decline",
                label: game.i18n.localize("DRPG.Bridge.nothingThere"),
                data: { by: actor.id, cost: String(cost) }
            }
        ]
    });

    await noteRollContext(actor, {
        actionKey: "observe", gmRuled: true, request, label, room
    });

    return { calledGm: true, roll };
}

/**
 * How are you looking? The guide's declarations, and nothing else.
 *
 * No text box here any more. Two of the four buttons never used what was typed
 * in it, and the two that did were asking for a description of a search that had
 * not happened yet — see `observeSpecific`.
 *
 * @returns {Promise<"general"|"specific"|"nonObvious"|"followTraces"|"anything"|null>}
 */
async function askDeclaration(actor, def) {
    // Ordered by who answers, not by how the guide lists them.
    //
    // The first three are settled by the table: sweeping the room takes the
    // easiest trace in it, looking past the obvious takes the hardest, and
    // following your own traces takes the easiest one YOU left — all three
    // decided by a number, none of them asking the player anything first. The
    // last two summon a human — the GM picks which Remnant a named request
    // lands on, and "examine a point of interest" is a ruling outright.
    const picked = await chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "observe", def),
        prompt: game.i18n.localize("DRPG.Observe.declarePrompt"),
        confirm: game.i18n.localize("DRPG.Action.roll"),
        // The two red rows below are the ones that end with a person reading
        // this; the other three never see it. One box for both, in the window
        // where the choice is made — see "THE SENTENCE COMES FIRST".
        extra: requestFieldHtml({
            prompt: game.i18n.localize("DRPG.Observe.requestPrompt"),
            placeholder: game.i18n.localize("DRPG.Observe.requestPlaceholder")
        }),
        options: [
            { value: "general", icon: "fa-eye",
              label: game.i18n.localize("DRPG.Observe.general"),
              hint: game.i18n.localize("DRPG.Observe.generalHint") },
            { value: "nonObvious", icon: "fa-eye-low-vision",
              label: game.i18n.localize("DRPG.Observe.nonObvious"),
              hint: game.i18n.localize("DRPG.Observe.nonObviousHint") },
            { value: "followTraces", icon: "fa-shoe-prints",
              label: game.i18n.localize("DRPG.Observe.followTraces"),
              hint: game.i18n.localize("DRPG.Observe.followTracesHint") },
            { value: "specific", icon: "fa-crosshairs", gmRoute: true,
              label: game.i18n.localize("DRPG.Observe.specific"),
              hint: game.i18n.localize("DRPG.Observe.specificHint") },
            { value: "anything", icon: "fa-magnifying-glass-location", gmRoute: true,
              label: game.i18n.localize("DRPG.Observe.anything"),
              hint: game.i18n.localize("DRPG.Observe.anythingHint") }
        ]
    });

    if (!picked) return null;
    return { declaration: picked.value, request: readRequestField(picked.form) };
}


/**
 * Analyze: one action, two uses, and they no longer end the same way.
 *
 * Analysing evidence is a table lookup — Head against ANALYZE_DC — so it is
 * scored rather than ruled, on the GM's client because half the lookup is the
 * secret the roll is buying. Asking for a hint has no table and never will: it
 * stays a human ruling, and stays marked as one so a Reroll re-asks instead of
 * pretending to recompute it.
 */
async function performAnalyze(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    // Only bullets there is still something to learn about. An identified one is
    // finished, and one this character already burned an attempt on this chapter
    // is closed to them until the next — guide, p. 30.
    const { analysableBullets } = await import("./truth-bullets.mjs");
    const bullets = analysableBullets(actor);

    // Launched from the Analyze button on one specific bullet (see sheet.mjs):
    // the player has already said which one, so the picker would be asking a
    // question that is answered.
    const preselected = options.bulletId
        ? (bullets.find(b => b.id === options.bulletId) ?? null)
        : null;

    const asked = preselected
        ? { choice: preselected.id, request: "" }
        : await askWhatToAnalyze(actor, def, bullets);
    const choice = asked?.choice ?? null;
    if (!choice || choice === "cancel") return null;

    // "hint" is the literal action id; anything else is the bullet id the
    // "bullet" button's own callback returned above.
    const subject = choice === "hint" ? null : (bullets.find(b => b.id === choice) ?? null);
    if (choice !== "hint" && !subject) return null;

    const roll = await rollTrait(actor, "head", { actionKey: "analyze" });
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    return subject
        ? analyseBullet(actor, def, roll, subject)
        : askForHint(actor, def, roll, asked?.request ?? "");
}

/**
 * Analysing evidence. The roll goes to the GM's client to be scored, because
 * the difficulty depends on what the bullet really is — which is precisely what
 * the roll is trying to find out. See analyze.mjs.
 */
async function analyseBullet(actor, def, roll, subject) {
    const { requestAnalyzeResolve } = await import("./gm-bridge.mjs");

    // No `gmRuled` here, unlike the hint branch: this outcome follows from a
    // table, so a Reroll can genuinely replay it rather than re-ask a human.
    await noteRollContext(actor, {
        actionKey: "analyze",
        bulletId: subject.id,
        label: game.i18n.format("DRPG.Analyze.onBullet", { name: subject.name }),
        room: roomOfActor(actor)
    });

    await requestAnalyzeResolve({
        actorId: actor.id,
        itemId: subject.id,
        total: roll.total,
        isCritical: Boolean(roll.isCritical)
    });

    // Silent on the outcome on purpose: this client does not know the number it
    // was measured against, and must not be told.
    await whisperToOwner(actor, `${rollHead(def, roll)}<p><small>${
        game.i18n.format("DRPG.Analyze.sent", {
            name: foundry.utils.escapeHTML(subject.name)
        })}</small></p>`, rollCardFlags(def, roll));

    return { roll, subject: subject.name };
}

/** The other half of the action: no evidence, just a nudge from the GM. */
async function askForHint(actor, def, roll, request = "") {
    const rows = def.hintThresholds.map(t =>
        `<li>${t.min}+ — ${foundry.utils.escapeHTML(t.result)}</li>`).join("");
    const body = `<ul class="drpg-gm-reference">${rows}
            <li><em>${game.i18n.localize("DRPG.Action.critical")} — ${
                foundry.utils.escapeHTML(def.hintCritical.result)}</em></li></ul>`;

    const title = game.i18n.localize("DRPG.Analyze.askHint");

    // The question was typed in the variant window, with the two branches in
    // front of the player — see "THE SENTENCE COMES FIRST".
    await callGm(actor, {
        title,
        request,
        roll,
        room: roomOfActor(actor),
        body,
        // The hint IS the answer, so it goes back down the thread the question
        // came up. The action has already been spent by the time this runs, so
        // the refusal hands it back — see `decline` in `runCallAction`.
        actions: gmRulingActions(actor, def.cost ?? 1)
    });

    await noteRollContext(actor, {
        actionKey: "analyze", gmRuled: true, request, label: title, room: roomOfActor(actor)
    });

    await whisperToOwner(actor, `${rollHead(def, roll)}${body}`, rollCardFlags(def, roll));

    return { calledGm: true, roll, subject: null };
}

/**
 * Which bullet, or a hint instead.
 *
 * The bullet picker used to be its own dialog, shown only after choosing
 * "Analyze a bullet" — two windows every time there was a bullet to analyze.
 * It is folded into one instead: the select is simply ignored when "Ask for a
 * hint" is the button actually pressed.
 *
 * @returns {Promise<string|null>}  "hint", a bullet id, "cancel", or null.
 */
async function askWhatToAnalyze(actor, def, bullets) {
    // Two variants and one select, rather than two buttons and one select: the
    // select belongs to the first variant only, and as a footer button pair
    // there was nothing to say so. It rides along as `extra` and is simply not
    // read when the hint is what was chosen.
    const picked = await chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "analyze", def),
        options: [
            {
                value: "bullet", icon: "fa-magnifying-glass-chart",
                label: game.i18n.localize("DRPG.Analyze.analyseBullet"),
                hint: plural("DRPG.Analyze.analyseBulletHint", { n: bullets.length }),
                disabled: !bullets.length,
                why: game.i18n.localize("DRPG.Analyze.noBullets")
            },
            {
                value: "hint", icon: "fa-comment-question", gmRoute: true,
                label: game.i18n.localize("DRPG.Analyze.askHint"),
                hint: game.i18n.localize("DRPG.Analyze.askHintHint")
            }
        ],
        extra: `${bullets.length
            ? `<label>${game.i18n.localize("DRPG.Analyze.whichBullet")}
                <select name="bullet">${bullets
                    .map(b => `<option value="${b.id}">${
                        foundry.utils.escapeHTML(b.name)}</option>`).join("")}</select></label>`
            : ""}${requestFieldHtml({
                prompt: game.i18n.format("DRPG.Action.gmPrompt", { action: def.label }),
                placeholder: game.i18n.localize("DRPG.Action.placeholder.analyze")
            })}`
    });

    if (!picked) return null;
    const request = readRequestField(picked.form);
    if (picked.value === "hint") return { choice: "hint", request };
    return { choice: picked.form.querySelector("[name=bullet]")?.value ?? null, request };
}

/**
 * Listen — fully automatic, no GM.
 *
 * The guide's three outcomes map onto three amounts of information:
 *   pass      you learn how many people are in the chosen room, not who
 *   strong    you learn who they are
 *   critical  every neighbouring room at once
 *
 * The anonymous tier matters: "someone is in the kitchen" is a very different
 * piece of information from "Kaede is in the kitchen", and the guide draws that
 * line deliberately.
 */
async function performListen(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const { neighbouringRooms, occupantsOf } = await import("./movement.mjs");
    const here = roomOfActor(actor);
    const neighbours = neighbouringRooms(here);

    if (!neighbours.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Listen.noNeighbours"));
        return null;
    }

    const options_ = neighbours
        .map(r => `<option value="${foundry.utils.escapeHTML(r)}">${foundry.utils.escapeHTML(r)}</option>`)
        .join("");

    const target = await DialogV2.wait({
        window: { title: def.label },
        classes: ["drpg-panel"],
        content: `${briefingBlock(actor, "listen", def)}<form>
            <p>${game.i18n.format("DRPG.Listen.prompt", { room: foundry.utils.escapeHTML(here ?? "—") })}</p>
            <label>${game.i18n.localize("DRPG.Listen.which")}
                <select name="room">${options_}</select></label>
        </form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.roll"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=room]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!target || target === "cancel") return null;

    const roll = await rollTrait(actor, "shadow", {
        actionKey: "listen",
        context: { room: here, target }
    });
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    // Listen produces information and nothing else, so Reroll has nothing to
    // undo — it simply asks the walls again with the new number.
    await noteRollContext(actor, { actionKey: "listen", room: here, target });

    const hit = resolveThreshold(roll.total, def.thresholds);
    const lines = [];
    let outcome;

    // The "named" tier is the highest threshold the action declares, read from
    // the table rather than repeated here. The old hardcoded `>= 18` was a copy
    // of a config value: retuning Listen in config.mjs silently left the code
    // handing out names at the old number.
    const namedFrom = Math.max(...def.thresholds.map(t => t.min));

    if (roll.isCritical) {
        // Everything, everywhere.
        const sweep = neighbours.map(room => {
            const who = occupantsOf(room, actor).map(a => a.name);
            return `<li><strong>${foundry.utils.escapeHTML(room)}</strong> — ${
                who.length ? who.map(n => foundry.utils.escapeHTML(n)).join(", ") : game.i18n.localize("DRPG.Listen.empty")
            }</li>`;
        }).join("");
        lines.push(`<p>${game.i18n.localize("DRPG.Listen.critical")}</p><ul>${sweep}</ul>`);
        outcome = { success: true, isCritical: true, rooms: neighbours };
    } else if (hit && hit.min >= namedFrom) {
        // Named.
        const who = occupantsOf(target, actor).map(a => a.name);
        lines.push(`<p>${game.i18n.format("DRPG.Listen.named", {
            room: foundry.utils.escapeHTML(target),
            who: who.length ? who.map(n => foundry.utils.escapeHTML(n)).join(", ") : game.i18n.localize("DRPG.Listen.empty")
        })}</p>`);
        outcome = { success: true, room: target, named: who };
    } else if (hit) {
        // Anonymous: a count, no identities.
        const count = occupantsOf(target, actor).length;
        lines.push(`<p>${count
            ? plural("DRPG.Listen.anonymous", { room: foundry.utils.escapeHTML(target), n: count })
            : game.i18n.format("DRPG.Listen.emptyRoom", { room: foundry.utils.escapeHTML(target) })
        }</p>`);
        outcome = { success: true, room: target, count };
    } else {
        lines.push(`<p>${def.failure}</p>`);
        outcome = { success: false };
    }

    await whisperToOwner(actor, `${rollHead(def, roll)}${lines.join("")}`, rollCardFlags(def, roll));

    Hooks.callAll("drpgActionResolved", { actor, actionKey: "listen", roll, outcome });
    return outcome;
}

/**
 * Rest: pick short or long. Each option shows its cost and whether the room
 * you are standing in actually allows it, so the choice is informed.
 */
async function performRest(actor) {
    const { takeRest, roomAllows, restRooms, restSpent } = await import("./rest.mjs");
    const room = roomOfActor(actor);

    // One row per rest, each carrying its own price and its own reason for
    // being unavailable — spent already, or not allowed in this room. Both
    // reasons used to be printed above a pair of buttons that stayed live
    // regardless, so the player could pick the one the list had just told them
    // they could not have.
    const variant = kind => {
        const spent = restSpent(actor, kind);
        const allowed = roomAllows(room, kind);
        const rooms = restRooms(kind);

        return {
            value: kind,
            icon: kind === "long" ? "fa-bed" : "fa-mug-hot",
            label: game.i18n.localize(kind === "long" ? "DRPG.Rest.long" : "DRPG.Rest.short"),
            hint: `${game.i18n.format("DRPG.Action.willCost",
                { n: kind === "long" ? 2 : 1, left: actionsLeft(actor) })} · ${
                allowed
                    ? game.i18n.format("DRPG.Rest.allowedHere", { room: room ?? "" })
                    : rooms.length
                        ? game.i18n.format("DRPG.Rest.allowedIn", { rooms: rooms.join(", ") })
                        : game.i18n.format("DRPG.Rest.noRooms", { kind: "" })}`,
            disabled: spent || !allowed,
            why: spent
                ? game.i18n.localize(kind === "long"
                    ? "DRPG.Rest.alreadyThisSessionShort" : "DRPG.Rest.alreadyThisTimeOfDayShort")
                : rooms.length
                    ? game.i18n.format("DRPG.Rest.allowedIn", { rooms: rooms.join(", ") })
                    : game.i18n.format("DRPG.Rest.noRooms", { kind: "" })
        };
    };

    const picked = await chooseVariant({
        actor,
        title: ACTIONS.rest.label,
        intro: briefingBlock(actor, "rest", ACTIONS.rest),
        options: [variant("short"), variant("long")]
    });

    if (!picked) return null;
    return takeRest(actor, picked.value);
}

/** Direct Murder: never automatic, always a conversation. */
async function performDirectMurder(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    // No preview of the room. The guide's whole point is that you do not know
    // who else is standing in the dark with you — showing "you are alone with
    // X" or listing everyone present here would hand the killer the verdict
    // before they have even declared. `judgePendingMurders` (eclipse.mjs) reads
    // the room once, for real, after the Eclipse ends and the map has settled;
    // that is also the only moment the killer learns anything about it, in the
    // whisper it sends.
    const room = roomOfActor(actor);

    const confirmed = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: def.label },
        content: `${briefingBlock(actor, "directMurder", def)}
            <p class="notes">${game.i18n.localize("DRPG.Action.murderSpendsAnyway")}</p>
            <p>${game.i18n.localize("DRPG.Action.murderConfirm")}</p>`,
        rejectClose: false
    });
    if (!confirmed) return null;

    /*
     * THE ATTEMPT IS PARKED, NOT JUDGED.
     *
     * This used to read the room a second time, decide there and then, and hand
     * the GM a button that opened the incident immediately — in the middle of
     * the Eclipse. Three things were wrong with that, and they are one thing:
     * an Eclipse is a placement window, and nobody has finished placing.
     *
     *   · Everybody is crossing the map, so the moment the incident opened,
     *     the third-party watch fired on the first person to walk through the
     *     room. A corridor became a witness.
     *   · Hope Calls are locked while `isEclipse()` is true, so the victim of
     *     an incident opened during one had nothing to reach for.
     *   · The killer learned they had got away with it while half the cast had
     *     yet to move, so "alone with your victim" was decided on a snapshot of
     *     a room that was still filling up.
     *
     * So the declaration is stored and the answer waits for the lights. What
     * counts is where everyone ENDS UP: see `judgePendingMurders` in eclipse.mjs,
     * which runs as the Eclipse closes and opens the incident then — into a time
     * of day that has actually begun, with Calls available and the map settled.
     *
     * The action is spent here either way, which is the guide's rule and does
     * not change. What the player does not get here is the outcome.
     */
    if (cost > 0 && !await spendAction(actor, cost)) return null;

    const note = await promptForNote(actor, {
        title: def.label,
        prompt: game.i18n.localize("DRPG.Action.murderPromptParked"),
        placeholder: game.i18n.localize("DRPG.Action.placeholder.directMurder")
    });

    const { parkDirectMurder } = await import("./eclipse.mjs");
    await parkDirectMurder({ killerId: actor.id, room, note });

    await whisperToOwner(actor,
        `${cardHead({ action: def.label })}<p>${
            game.i18n.localize("DRPG.Action.murderParked")}</p>`);
    ui.notifications.info(game.i18n.localize("DRPG.Action.murderParkedToast"));

    return { parked: true, room };
}

/**
 * Ask for the sentence that goes to the GM, without calling them yet.
 *
 * `promptAndCallGm` does both in one step, and a parked declaration needs the
 * halves separated: the GM hears about this when the Eclipse ends, not now.
 * Cancelling the box is not cancelling the attempt — the action is already
 * spent by the time this opens, and a dismissed dialog must never be a way to
 * get it back.
 */
async function promptForNote(actor, { title, prompt, placeholder }) {
    const result = await DialogV2.wait({
        window: { title },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${prompt}</p>
            <textarea name="note" rows="3" placeholder="${
                foundry.utils.escapeHTML(placeholder ?? "")}"></textarea>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.murderParkedConfirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=note]")?.value.trim() ?? ""
            }
        ],
        rejectClose: false
    }).catch(() => "");
    return typeof result === "string" ? result : "";
}

/* ==========================================================================
 * GENERIC + DYNAMIC
 * ========================================================================== */

async function performGeneric(actor, actionKey, def, options) {
    const cost = options.free ? 0 : (def.cost ?? 1);
    if (!canAfford(actor, cost)) return null;

    // The briefing rides in the statistic picker rather than in front of it —
    // this branch has no other window of its own, and two in a row for one
    // choice is exactly what NEEDS_OWN_BRIEFING exists to stop.
    const trait = await chooseTrait(actor, def, {
        intro: options.skipBriefing ? "" : briefingBlock(actor, actionKey, def)
    });
    if (!trait) return null;

    const roll = await rollTrait(actor, trait, { actionKey });
    if (!roll) return null;
    if (cost > 0) await spendAction(actor, cost);

    const hit = roll.isCritical ? def.critical : resolveThreshold(roll.total, def.thresholds ?? []);
    const outcome = {
        success: Boolean(hit),
        text: hit?.result ?? def.failure ?? game.i18n.localize("DRPG.Action.nothing")
        // No `leftTrace`: this generic fallback never actually calls
        // `dropRemnant`, so `hit?.remnant` used to report a trace that was
        // never placed — a lie `traceFeedback`'s contract (nothing to
        // report if nothing was placed) does not allow.
    };

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey, roll, outcome });
    return outcome;
}

async function performDynamic(actor, options) {
    const def = dynamicDef();
    if (!canAfford(actor, options.free ? 0 : 1)) return null;

    // Describe it FIRST. The GM cannot set a sensible difficulty for something
    // they have not heard yet, and asking the player to pick a threshold before
    // saying what they are doing is backwards.
    const dynDef = dynamicDef();
    const description = await promptAndCallGm(actor, {
        title: dynDef.label,
        intro: briefingBlock(actor, "dynamic", dynDef),
        prompt: game.i18n.localize("DRPG.Action.dynamicDescribe"),
        placeholder: game.i18n.localize("DRPG.Action.dynamicPlaceholder"),
        room: roomOfActor(actor),
        // Only "reply" here, and no refusal: nothing has been spent yet at this
        // point — the difficulty window that follows is where this action is
        // accepted or not, and it already refunds nothing because it has
        // charged nothing.
        actions: [{
            action: "reply",
            label: game.i18n.localize("DRPG.Bridge.reply"),
            data: { by: actor.id }
        }]
    });
    if (description === null) return null;

    // The GM sets the difficulty, never the player. A GM running their own
    // character answers their own dialog; everyone else waits on the socket.
    const request = {
        description,
        actorName: actor.name,
        room: roomOfActor(actor)
    };

    let picked;
    if (game.user.isGM) {
        picked = await askDynamicDifficulty(request);
    } else {
        ui.notifications.info(game.i18n.localize("DRPG.Action.dynamicWaiting"));
        const { requestDynamicDifficulty } = await import("./gm-bridge.mjs");
        picked = await requestDynamicDifficulty(request);
    }

    if (!picked) return null;

    const band = DYNAMIC_THRESHOLDS[picked.tier];
    if (!band) return null;
    const roll = await rollTrait(actor, picked.trait, {
        actionKey: "dynamic",
        context: { bandIndex: picked.tier, description, room: roomOfActor(actor) }
    });
    if (!roll) return null;
    if (!options.free) await spendAction(actor, 1);

    const success = roll.isCritical || roll.total >= band.range[0];
    const visibility = success ? band.remnant : null;
    let placed = null;

    // Actually leave the trace.
    //
    // The guide gives Dynamic actions their own Remnant column, and the outcome
    // below has always reported one — but nothing ever created it. The action
    // told the player and the GM that a trace had been left and the map stayed
    // empty, which is the one kind of lie an investigation cannot recover from.
    let leftTrace = false;
    if (visibility) {
        const { dropRemnant, traceFeedback } = await import("./remnants.mjs");
        placed = await dropRemnant(actor, {
            type: "prep",
            visibility,
            faint: true,
            action: "dynamic",
            subject: description.slice(0, 60),
            note: game.i18n.format("DRPG.Remnant.dynamicNote", {
                actor: actor.name,
                room: roomOfActor(actor) ?? "?",
                what: description,
                total: roll.total
            })
        });
        leftTrace = traceFeedback(roll, placed);
    }

    const outcome = {
        success,
        tier: success ? band.tier : null,
        leftTrace,
        text: success ? game.i18n.format("DRPG.Action.tierFound", { tier: band.tier })
                      : game.i18n.localize("DRPG.Action.nothing")
    };

    // The GM's difficulty band is the one thing a reroll must NOT re-ask for:
    // the ruling was about what the player described, not about the dice.
    await noteRollContext(actor, {
        actionKey: "dynamic",
        bandIndex: picked.tier,
        description,
        room: roomOfActor(actor),
        ...remnantRef(placed)
    });

    await report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "dynamic", roll, outcome });
    return outcome;
}

/**
 * The GM's side of a Dynamic action: read what the player described, then set
 * the band and the trait it is rolled against.
 *
 * Exported because gm-bridge calls it when the request arrives over the socket.
 * Returning null is a real answer — it means "no, you cannot do that" — and the
 * player's action is refused without costing them anything.
 *
 * @returns {Promise<{tier: number, trait: string}|null>}
 */
export async function askDynamicDifficulty({ description, actorName, room } = {}) {
    const rows = DYNAMIC_THRESHOLDS.map((t, i) =>
        `<option value="${i}">${t.range[0]}–${t.range[1]} · ${t.difficulty}</option>`).join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Action.dynamicTitle") },
        classes: ["drpg-panel"],
        content: `<form>
                    <p>${game.i18n.format("DRPG.Action.dynamicFrom", {
                        actor: foundry.utils.escapeHTML(actorName ?? "?"),
                        room: foundry.utils.escapeHTML(room ?? "—")
                    })}</p>
                    <blockquote>${foundry.utils.escapeHTML(description ?? "")}</blockquote>
                    <label>${game.i18n.localize("DRPG.Action.difficulty")}
                        <select name="tier">${rows}</select></label>
                    <label>${game.i18n.localize("DRPG.Advance.whichTrait")}
                        <select name="trait">${Object.entries(TRAITS)
                            .map(([k, t]) => `<option value="${k}">${t.label}</option>`).join("")}</select></label>
                  </form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.dynamicSet"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { tier: Number(f.tier.value), trait: f.trait.value };
                }
            },
            { action: "refuse", label: game.i18n.localize("DRPG.Action.dynamicRefuse") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "refuse") return null;
    return picked;
}

/* ==========================================================================
 * REPORTING
 * ========================================================================== */

/**
 * The header for a card that reports a roll and nothing more about it.
 *
 * Five call sites in this file had these exact three slots written out
 * longhand, and they had drifted: four used `Label — total · <em>Critical</em>`
 * and Listen used `Label · Shadow · total`, with the trait name typed in as an
 * English literal rather than read off the roll. Same card, three shapes.
 *
 * `report()` does not go through here because it has a room and an outcome to
 * put in the other two slots.
 *
 * The duality bar comes with it. These cards replace Daggerheart's — the
 * system's copy of the roll is claimed and never rendered, see
 * `supersedingRoll` — so a card that showed only a total would have taken the
 * two faces off the table rather than moved them.
 */
/**
 * WHAT THE DICE DID, AS A COLOUR.
 *
 * The card prints the total; what it cannot say at a glance is which way the
 * roll went, and that is the one thing a player wants from across the table.
 * It reaches the popup's title bar and the chat card's whole ground from here.
 *
 * A Critical is checked first because a roll can be critical AND carry a side,
 * and the rarer fact is the one worth the colour.
 */
function rollTone(roll) {
    return roll?.isCritical ? "critical"
        : roll?.withHope ? "hope"
            : roll?.withFear ? "fear" : null;
}

/**
 * The flags every roll card carries — its header, and its outcome as a colour.
 *
 * Five cards in this file went out with neither, so they arrived in flat
 * neutral ink and with no title on their popup while `report()`'s carried both.
 * Same roll, same kind of card, two different surfaces.
 */
function rollCardFlags(def, roll) {
    return { flags: { [MODULE_ID]: { popupTitle: def.label, popupTone: rollTone(roll) } } };
}

function rollHead(def, roll) {
    return cardHead({
        action: def.label,
        total: roll?.total,
        result: roll?.isCritical ? game.i18n.localize("DRPG.Action.critical") : null,
        resultKind: roll?.isCritical ? "critical" : null,
        trait: TRAITS[roll?.trait]?.label
    }) + dualityBar(roll);
}

async function report(actor, def, roll, outcome) {
    if (!outcome) return;

    // The one moment at a roll the whole table waits for. Local: this runs on
    // the client that rolled, and the card it is about is on its way.
    if (roll?.isCritical) playSfx("critical");

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const traitLabel = TRAITS[roll?.trait]?.label ?? "";
    const lines = [];

    /* ---- a header with fixed slots ------------------------------------
     *
     * Every action card opened differently: some led with the label, some with
     * the trait, the room was never there at all, and what actually happened
     * was somewhere in the paragraphs below. Reading the log after the fact —
     * which is the whole reason the log exists — meant reading each card whole.
     *
     * The grammar itself now lives in `cardHead()` (utils.mjs), because it was
     * written here and stayed here: this was the only card in the module that
     * had it. Everything about the four slots, and what goes in them, is
     * documented there.
     */
    const room = roomOfActor(actor);
    // Only two outcomes are short enough to be a header slot and precise enough
    // to be worth one. Anything else leaves the slot out rather than paraphrase
    // the paragraph below it, which is where the detail belongs.
    const result = outcome.item
        ? game.i18n.format("DRPG.Action.tierShort", { tier: outcome.tier })
        : roll?.isCritical
            ? game.i18n.localize("DRPG.Action.critical")
            : "";

    lines.push(cardHead({
        action: def.label,
        room,
        total: roll?.total,
        result,
        // The two the slot can name are also the two it can colour: something
        // found is evidence, a critical is a critical.
        resultKind: outcome.item ? "evidence" : roll?.isCritical ? "critical" : null,
        trait: traitLabel
    }));

    // Directly under the header, because it is the header's own number shown
    // its working. Empty for anything that reached here without a duality roll
    // behind it — an unanswered Search, a GM's ruling — and an empty string
    // joins into nothing.
    lines.push(dualityBar(roll));

    if (outcome.extra) lines.push(outcome.extra);

    if (outcome.item) {
        lines.push(`<p>${game.i18n.format("DRPG.Action.found", { tier: outcome.tier, item: esc(outcome.item) })}${
            outcome.carried === false ? ` <em>${game.i18n.localize("DRPG.Inventory.notCarried")}</em>` : ""
        }</p>`);
    } else if (outcome.text) {
        lines.push(`<p>${esc(outcome.text)}</p>`);
    }

    // Only a GM's own write knows the resulting numbers. A player's is applied
    // over the socket and answered by a separate whisper, so printing "now ?/?"
    // here would be inventing a figure.
    if (outcome.applied?.changed === true) {
        lines.push(`<p><small>${game.i18n.format("DRPG.Project.now", {
            project: esc(outcome.applied.name), current: outcome.applied.to, target: outcome.applied.target
        })}</small></p>`);
    } else if (outcome.applied?.changed === false) {
        lines.push(`<p><small>${game.i18n.format("DRPG.Project.alreadyFull", {
            name: esc(outcome.applied.name), current: outcome.applied.from, target: outcome.applied.target
        })}</small></p>`);
    }

    // Never the exact visibility band — see `traceFeedback` in remnants.mjs.
    // A plain Despair leaves `outcome.leftTrace` false and prints nothing at
    // all, which is itself the point: it must read the same as leaving no
    // trace whatsoever, or its absence would say as much as its presence.
    if (outcome.leftTrace) {
        lines.push(`<p><em>${game.i18n.localize("DRPG.Action.leavesRemnant")}</em></p>`);
    }

    if (outcome.room) {
        lines.push(`<p><small>${plural("DRPG.Action.tokensLeft", {
            room: esc(outcome.room), n: outcome.tokensLeft
        })}</small></p>`);
    }

    // Reporting only reports. The refund itself is applied by whoever resolved
    // the action — a render function with a side effect hands out a second
    // action every time anything re-renders the same outcome.
    if (outcome.refundAction) {
        lines.push(`<p><em>${game.i18n.localize("DRPG.Action.actionReturned")}</em></p>`);
    }

    const html = lines.join("");

    // The dice land before the card says what they landed on. See `diceSettled`.
    await diceSettled(roll?.raw?.message?.id ?? roll?.raw?.message?._id);

    // Whispered to the player as well as the GMs, and left to popup.mjs to
    // surface on both.
    //
    // This used to be `whisperToGms` plus a `showPopup` here for the player.
    // Two problems with that. The player was not among the whisper's recipients,
    // so they were left with a twelve-second card and no record at all: what the
    // Search turned up, how loud a trace they left, how many searches the room
    // has left — gone the moment it faded. And the popup was raised from the
    // ACTING client, so a card only ever appeared where the code happened to be
    // running.
    //
    // One whisper to everyone entitled to it, and popup.mjs's catch-all raises
    // the card on each of their screens, is both fixes at once. `popupTitle`
    // carries the header the explicit call used to supply.
    // The same facts the header prints, kept as data on the message.
    //
    // The time-of-day summary is assembled by reading these back, and reading
    // them back is only reliable if they were written down: parsing the
    // rendered HTML would tie the summary to the exact wording of the card and
    // break the first time either is reworded. Nothing new is recorded here —
    // every field is one the card already shows.
    await whisperToOwner(actor, html, {
        flags: {
            [MODULE_ID]: {
                popupTitle: def.label,
                // See `rollTone`, which the five cards that go through
                // `rollHead` share with this one.
                popupTone: rollTone(roll),
                summary: {
                    actorId: actor?.id ?? null,
                    action: def.label,
                    room: room ?? null,
                    total: roll?.total ?? null,
                    critical: Boolean(roll?.isCritical),
                    item: outcome.item ?? null,
                    tier: outcome.tier ?? null,
                    leftTrace: outcome.leftTrace ?? false,
                    at: Date.now()
                }
            }
        }
    });

    log(`${actor.name}: ${def.label} = ${roll?.total}`);
}

/** Re-exported so other modules keep a single source for "where am I". */
export { roomOfActor as currentRoom };
