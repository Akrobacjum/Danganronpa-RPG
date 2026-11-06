/**
 * Danganronpa RPG - Observe.
 * ---------------------------------------------------------------------------
 * The Observe action: `performObserve`, the declaration it asks for
 * (`askDeclaration`, `OBSERVE_MODES`, `observeModeLine`), the readings the
 * table decides (`observeRanked`) and the two that roll first and ask after
 * (`observeSpecific`, `observeAnything`), the number sent for the GM to score
 * (`settleObserveRoll`) and the card a GM rules on (`ruleObserve`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line, with the banner over
 * the actions that need a human. action-rolls.mjs re-exports
 * `observeModeLine`, the one name here it exported before, and nothing here
 * imports it back (the facade rule, .claude/rules/code.md). `performObserve`
 * is exported now because `performAction`, which stays there, dispatches to
 * it; action-rolls.mjs does not re-export it. Of the action family it reads
 * the shared layer alone.
 */

import { OBSERVE_FAIL_STRESS } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { roomOfActor, locateActor } from "./movement.mjs";
import { whisperToOwner, esc } from "./utils.mjs";
import { rollTrait, rollInHand, noteRollContext, abort, canAfford, missAction } from "./action-pipeline.mjs";
import { rollCardFlags, rollHead } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { requestFieldHtml, readRequestField, chooseVariant } from "./action-menus.mjs";

/* ==========================================================================
 * ACTIONS THAT NEED A HUMAN
 * ========================================================================== */

/**
 * Observe - the Investigation's engine.
 *
 * Guide, p. 30: the player declares HOW they are looking, and that decides what
 * they can find. The three declarations map onto the easiest Remnant in the
 * room, the one closest to a stated request, and the hardest.
 *
 * The scoring does not happen here. Which Remnants are in the room, what they
 * are and therefore how hard they are to spot are all things the observer must
 * not know - and Foundry ships every scene's tokens to every client, so this
 * client physically holds those answers. Asking it to judge the roll would be
 * asking the player to mark their own paper. So this side declares, asks the GM
 * to fix a target, throws the dice, and sends the number. See observe.mjs.
 *
 * When the room holds nothing left to find, the action falls back to the older
 * behaviour: a roll and a GM ruling. That is the guide's "Daily Life" column -
 * Observe can also simply turn something interesting up.
 */
export async function performObserve(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const asked = await askDeclaration(actor, def);
    if (!asked) return null;
    const { declaration, request } = asked;

    // Looking at something that is not a trace at all - a room, a person, a
    // machine, the weather. The guide's "Daily Life" column: Observe can simply
    // turn something interesting up, and only a human can say what. No Remnant
    // is involved, so there is nothing to rank and nothing to score.
    if (declaration === "anything") return observeAnything(actor, def, cost, request);

    // "Specific" is the only declaration whose target depends on a sentence from
    // the player - and that sentence now arrives with the declaration rather
    // than after the roll, so this branch simply carries it through.
    if (declaration === "specific") return observeSpecific(actor, def, cost, request);

    return observeRanked(actor, def, cost, options, declaration);
}

/**
 * General and Non-obvious: the target is decided by the table, not by anything
 * the player says, so it can be - and is - fixed before the dice are thrown.
 */
async function observeRanked(actor, def, cost, options, declaration) {
    const { requestObserveTarget } = await import("./gm-bridge.mjs");
    const target = await requestObserveTarget({ actorId: actor.id, declaration, request: "" });

    // Not carried out: it has been said already, and nothing has been spent.
    // Leave the action in the player's pocket.
    if (!target) return null;

    // Paid before the dice - see `abort` and ACT-07 above it.
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, "eye", { actionKey: "observe" });
    if (!roll) return abort(actor, paid);

    // Nothing here to find, or the character is not standing in a room: the
    // GM rules on the roll just thrown, as `observeSpecific` does. This used
    // to open a SECOND declaration window (ROLL-11).
    if (!target.ok) return ruleObserve(actor, def, roll, "", null, paid, declaration);

    return settleObserveRoll(actor, def, roll, target.key, declaration);
}

/**
 * Specific: roll, then say what you were after.
 *
 * The order used to be the other way round - type the request, let the GM fix a
 * target, then roll - and the reason given was that a GM who already knew the
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
 * ruling built on the dice already on the table - never a second roll.
 */
async function observeSpecific(actor, def, cost, request = "") {
    // The sentence was typed in the declaration window, before the dice - see
    // "THE SENTENCE COMES FIRST". Leaving it empty is still allowed and still
    // means the same thing: with nothing named, this is an ordinary sweep of
    // the room and it is scored as one.
    const declaration = request ? "specific" : "general";
    if (!request) ui.notifications.info(game.i18n.localize("DRPG.Observe.requestSkipped"));

    // Paid before the dice - see `abort` and ACT-07 above it.
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, "eye", { actionKey: "observe" });
    if (!roll) return abort(actor, paid);

    const { requestObserveTarget } = await import("./gm-bridge.mjs");
    const target = await requestObserveTarget({ actorId: actor.id, declaration, request });

    // Not carried out - no GM listening, or refused. It has been said already,
    // and the action stays in the player's pocket: there is nobody to rule on it
    // either, so charging for it would be charging for silence.
    if (!target) return abort(actor, paid);

    // Refused, empty room, no room at all: the GM rules on the roll that has
    // already been thrown. Opening a second declaration window would roll a second
    // time for the same action.
    if (!target.ok) return ruleObserve(actor, def, roll, request, null, paid, declaration);

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

    const res = await requestObserveResolve({
        actorId: actor.id,
        key: observeKey,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        // The roll the GMs' fact of the result goes on (fix r1-G2).
        rollId: rollInHand(actor)?.messageId ?? null
    });

    // Deliberately silent about the outcome: the verdict is the GM's to send,
    // and this client does not know the difficulty it was measured against.
    //
    // "The GM is judging what you found" only where a GM actually is. A sweep
    // of the room is scored on the GM's client without a human touching it, and
    // the verdict lands about a second later - so the note told the player to
    // wait for something that had already happened, on the one branch where it
    // was never true. Naming a target and asking the GM outright do go to a
    // person, and there the wait is real.
    // And only when the GM's client has it (E31 review): a request refused or not
    // answered has been said once already.
    const waits = (declaration === "specific" || declaration === "anything") && res.ok;

    await whisperToOwner(actor, `${rollHead(def, roll)}${
        waits ? `<p><small>${game.i18n.localize("DRPG.Observe.sent")}</small></p>` : ""}`, rollCardFlags(def, roll));

    return { roll, observeKey };
}

/**
 * Observe aimed at something other than a Remnant.
 *
 * Rolls first and asks afterwards, like the specific branch: what the player is
 * looking at is a sentence for the GM to rule on, and there is no reason to
 * write it before knowing the number. Marked `gmRuled`, which is what it is - a
 * Reroll re-asks rather than pretending to recompute a table that does not
 * exist for this branch.
 */
async function observeAnything(actor, def, cost, request = "") {
    // Paid before the dice - see `abort` and ACT-07 above it.
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const roll = await rollTrait(actor, "eye", { actionKey: "observe" });
    if (!roll) return abort(actor, paid);

    // Not the button's own label: "Ask the GM" is clear on a button the player is
    // pressing and meaningless as the title of the window it arrives in. The GM
    // gets a title that says which action this was.
    return ruleObserve(actor, def, roll, request,
        game.i18n.localize("DRPG.Observe.anythingTitle"), paid, "anything");
}

/**
 * Hand a roll that has already happened to the GM as a ruling.
 *
 * Nothing about the price travels on this card. The action was paid before the
 * dice and stays paid on every answer, "nothing was there" included - that one
 * is the Observe's own result and charges its miss (see `missAction`). A card
 * never posted is no answer: `paid` comes back (E18 C0).
 */
async function ruleObserve(actor, def, roll, request, title = null, paid = null, declaration = null) {
    const { callGm } = await import("./gm-bridge.mjs");
    const label = title ?? def.label;
    // Both halves from one lookup: `locateActor` answers without the canvas, so
    // it names the scene as well as the room. The scene is what the card has to
    // carry - a GM answering this is usually looking at a different map, and a
    // room name alone sent the clue to whatever "Kitchen" was in front of THEM
    // (audit A6).
    const where = locateActor(actor);
    const room = where?.room ?? roomOfActor(actor);
    const sceneId = where?.scene?.id ?? null;

    const sent = await callGm(actor, {
        title: label,
        what: "observe.resolve",
        nothingSpent: true,
        // Which way of looking was declared (E51 C1; audit S02-50): an empty room handed the GM a total and no question.
        gmBody: `<p><small>${game.i18n.format("DRPG.Action.observeGm", { total: roll.total, n: OBSERVE_FAIL_STRESS })}</small></p>${
            observeModeLine(declaration)}`,
        roll,
        request,
        room,
        // This is the branch where a GM decides there IS something at the point
        // of interest the player named - so the first button places it, as a
        // Key Remnant in the room they are standing in, and offers to hang it
        // on a planned clue that has no trace yet.
        actions: [
            {
                action: "keyRemnantHere",
                label: game.i18n.localize("DRPG.Bridge.keyRemnantHere"),
                // Lowercase key: `dataset` lowercases everything, so `sceneId`
                // would come back as `sceneid` and read undefined.
                data: { by: actor.id, room: room ?? "", want: request ?? "",
                        scene: sceneId ?? "" }
            },
            {
                action: "reply",
                label: game.i18n.localize("DRPG.Bridge.reply"),
                data: { by: actor.id }
            },
            missAction(actor)
        ]
    });

    // Not posted - the last GM left after the action started (E18 C0, S10-26): the action
    // comes back, as with a window closed before the dice, and no ruling is noted for Reroll.
    if (!sent) return abort(actor, paid);

    await noteRollContext(actor, {
        actionKey: "observe", gmRuled: true, request, label, room
    });

    return { calledGm: true, roll };
}

/**
 * The GM's line naming the way of looking an Observe declared (`DRPG.Action.observeGmMode`), or "" for none: general,
 * non-obvious, follow traces, something specific, or a point of interest (E51 C1; audit S02-50). Exported for E51-T1.
 */
export function observeModeLine(declaration) {
    const key = OBSERVE_MODES.includes(declaration) ? `DRPG.Observe.${declaration}` : null;
    return key ? `<p><small>${game.i18n.format("DRPG.Action.observeGmMode", { mode: esc(game.i18n.localize(key)) })}</small></p>` : "";
}

/** The declarations `askDeclaration` offers, each with its label at `DRPG.Observe.<value>`. */
const OBSERVE_MODES = Object.freeze(["general", "nonObvious", "followTraces", "specific", "anything"]);

/**
 * How are you looking? The guide's declarations, and nothing else.
 *
 * No text box here any more. Two of the four buttons never used what was typed
 * in it, and the two that did were asking for a description of a search that had
 * not happened yet - see `observeSpecific`.
 *
 * @returns {Promise<"general"|"specific"|"nonObvious"|"followTraces"|"anything"|null>}
 */
async function askDeclaration(actor, def) {
    // Ordered by who answers, not by how the guide lists them.
    //
    // The first three are settled by the table: sweeping the room takes the
    // easiest trace in it, looking past the obvious takes the hardest, and
    // following your own traces takes the easiest one YOU left - all three
    // decided by a number, none of them asking the player anything first. The
    // last two summon a human - the GM picks which Remnant a named request
    // lands on, and "examine a point of interest" is a ruling outright.
    const picked = await chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "observe", def),
        prompt: game.i18n.localize("DRPG.Observe.declarePrompt"),
        confirm: game.i18n.localize("DRPG.Action.roll"),
        // The two red rows below are the ones that end with a person reading
        // this; the other three never see it. One box for both, in the window
        // where the choice is made - see "THE SENTENCE COMES FIRST".
        // Shown with those two rows alone (E21 C5b; audit S02-06): the other three never read it.
        extra: requestFieldHtml({
            prompt: game.i18n.localize("DRPG.Observe.requestPrompt"),
            placeholder: game.i18n.localize("DRPG.Observe.requestPlaceholder"),
            when: ["specific", "anything"]
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
