/**
 * Danganronpa RPG - Palm, the player's half.
 * ---------------------------------------------------------------------------
 * The Palm action as the player's browser runs it: the parts its rolls are
 * named by (`PALM_PARTS`, `palmHand`, `palmTitle`), its window and the Frisk's
 * modes in it (`choosePalm`, `friskModes`, `friskModeOf`), `performPalm`
 * itself, a plant resolved (`resolvePlant`), a palm that took nothing
 * (`nobodyTook`) and the action handed back (`palmBack`), and what can be taken
 * or slipped and the picker for it (`chooseStolen`, `stealablePool`,
 * `palmablePool`, `describeItem`, `chooseStolenItem`).
 *
 * WHERE IT SITS. Moved out of action-rolls.mjs by E41 C4 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. action-rolls.mjs
 * re-exports the 3 names here it exported before (`PALM_PARTS`, `palmTitle`,
 * `choosePalm`), so every importer still imports action-rolls.mjs, and nothing
 * here imports it back (the facade rule, .claude/rules/code.md).
 * `performPalm` is exported now because `performAction`, which stays there,
 * dispatches to it; action-rolls.mjs does not re-export it. A forced Frisk is
 * frisk.mjs's `performFrisk`, reached by `import()` as before: frisk.mjs stays
 * a file of its own (the owner's A11 of 13.10), and R1230 holds that it does.
 * The vault's half of a Palm (vault.mjs: the GM's side of a steal and a plant)
 * joins this file in E41 C6. Of the action family it reads the shared layer
 * alone.
 */

import { MODULE_ID, ACTIONS, TRAITS, ITEM_CATEGORIES } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { TRANSFER_REFUSED } from "./inventory.mjs";
import { getSetting, SETTINGS } from "./settings.mjs";
import { roomOfActor, othersInRoom } from "./movement.mjs";
import { dialogContent, plural, esc } from "./utils.mjs";
import { rollTrait, rollInHand, noteRollContext, abort, spentAfterRoll, canAfford } from "./action-pipeline.mjs";
import { report } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { chooseVariant } from "./action-menus.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/**
 * A Palm's or a Frisk's roll window, named by the part it throws (E51 C1; the owner's A11 of 13.10: "Palm - Hand, beat
 * 10", Frisk included, the numbers from config): "{action} - {trait}, beat {n}". `part` is one of `PALM_PARTS`, each
 * read off `ACTIONS.palm` - the statistic and the number its judge reads: the cover (`unseen`) and the hand (`hand`) of
 * a Palm, a Plant's two (`plantUnseen`, `plant`), an unseen Frisk's two (`rummageUnseen`, `rummage`) and the forced
 * Frisk (`frisk`). A part the table does not hold, or holds with no statistic or no number, falls back to the action's
 * label with no beat, which R1104 fails. The window's `dc` is still handed to `rollTrait` (its card's "needed N"),
 * with `titled`: the title says the number already.
 */
export const PALM_PARTS = Object.freeze({
    unseen: def => [def.unseen?.trait, def.unseen?.threshold],
    hand: def => [palmHand(def), def.threshold],
    plantUnseen: def => [def.unseen?.trait, def.plant?.unseen],
    plant: def => [palmHand(def), def.plant?.threshold],
    rummageUnseen: def => [def.unseen?.trait, def.rummage?.unseen],
    rummage: def => [def.rummage?.trait, def.rummage?.threshold],
    frisk: def => [def.frisk?.trait, def.frisk?.threshold]
});

/** The hand's statistic: Palm lists one trait, and R213 holds this site to that (its FIRSTS). */
function palmHand(def) {
    return def.traits?.[0];
}

export function palmTitle(part, def = ACTIONS.palm) {
    const [trait, n] = PALM_PARTS[part]?.(def ?? {}) ?? [];
    if (!TRAITS[trait] || !Number.isFinite(n)) return def?.label ?? "";
    return game.i18n.format("DRPG.Action.palmTitle", { action: def.label, trait: TRAITS[trait].label, n });
}

/* ==========================================================================
 * PALM
 * ========================================================================== */

/**
 * Going through somebody's pockets.
 *
 * TWO ROLLS, TWO QUESTIONS, AND THEY DO NOT INTERFERE. Shadow answers "did they
 * notice", Hand answers "did you get it", and the four combinations are four
 * different scenes - including the two mismatches, which are the good ones:
 * caught with your hand in a pocket and nothing to show for it, or robbed by
 * somebody you never saw.
 *
 * The Shadow roll goes first and is thrown with `remember: false`, which shields
 * it from an armed Hope Call (trap 89) and keeps the Reroll bookmark pointing at
 * the roll that decided the theft. It also means the player learns whether they
 * were seen BEFORE the theft resolves - which is exactly the wrong way round
 * dramatically, so they are not told: the line goes on the card afterwards, with
 * everything else.
 *
 * WHAT IS DECIDED HERE AND WHAT IS NOT. This client throws dice and names a
 * victim. Every verdict - was 14 beaten, was 15 beaten, is that item really
 * stealable, does the victim get told - is made in `stealFromPerson` on a GM's
 * client, against the same table in config.mjs. Same division as Observe.
 */
/*
 * WHICH WAY, WHO, AND - FOR A PLANT ONLY - WHAT, all in one window.
 *
 * The asymmetry in that list is the whole difference between the two
 * directions, and it is a difference in what the player is allowed to know.
 * A Steal must not show the victim's pockets: that list is the prize, and
 * this window opens whether or not the theft is going to work, so a picker
 * here would hand it over on a miss (trap 93). A Plant shows YOURS, because
 * they are yours - and choosing what to leave behind is the decision the
 * action is for.
 */
export async function choosePalm(actor, def, targets, mine) {
    return chooseVariant({
        actor,
        title: def.label,
        intro: briefingBlock(actor, "palm", def),
        prompt: game.i18n.localize("DRPG.Steal.whichWay"),
        confirm: game.i18n.localize("DRPG.Action.roll"),
        options: [
            {
                value: "steal", icon: "fa-hand-sparkles",
                label: game.i18n.localize("DRPG.Steal.takeLabel"),
                hint: game.i18n.localize("DRPG.Steal.takeHint")
            },
            {
                value: "plant", icon: "fa-hand-holding",
                label: game.i18n.localize("DRPG.Steal.plantLabel"),
                hint: plural("DRPG.Steal.plantHint", { n: mine.length }),
                disabled: !mine.length,
                why: game.i18n.localize("DRPG.Steal.nothingToPlant")
            },
            {
                // E80 part 2 C2: the third direction, which takes nothing and shows only the person's name here; what
                // they carry comes from the GM after the verdict (frisk.mjs `friskPerson`), never into this window.
                value: "frisk", icon: "fa-hand-pointer",
                label: game.i18n.localize("DRPG.Frisk.rowLabel"),
                hint: game.i18n.localize("DRPG.Frisk.rowHint"),
                details: friskModes(def),
                confirm: root => friskModeOf(root) === "unseen" ? game.i18n.localize("DRPG.Action.roll") : game.i18n.localize("DRPG.Action.proceed")
            }
        ],
        extra: `<label class="drpg-specific-note">
                <span>${game.i18n.localize("DRPG.Steal.whoPrompt")}</span>
                <select name="who">${targets.map(a =>
                    `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
            </label>${mine.length ? `<label class="drpg-specific-note" data-drpg-when="plant">
                <span>${game.i18n.localize("DRPG.Steal.whatToPlant")}</span>
                <select name="what">${mine.map(i =>
                    `<option value="${i.id}">${esc(describeItem(i))}</option>`).join("")}</select>
            </label>` : ""}`
    });
}

/**
 * The ways a Frisk can go, under its row of the Palm window (E80 part 2 C2, C3): Openly, checked - the ask, which
 * throws no dice, so two clicks never start an attempt that tells the target who tried - and Unseen, each with its
 * numbers read off `ACTIONS.palm` (the force's Body, the cover's Shadow and the hand's). Openly's line says the force
 * only while the GMs' `friskForce` is on. A `friskMode` radio, so the confirm button follows it (`followConfirmLabel`):
 * 'Do it' for the ask, 'Roll' for a mode that throws dice.
 */
function friskModes(def) {
    const part = def?.rummage ?? {};
    const openHint = getSetting(SETTINGS.friskForce) === true
        ? game.i18n.format("DRPG.Frisk.openHint", { force: def?.frisk?.threshold }) : game.i18n.localize("DRPG.Frisk.openHintAskOnly");
    return `<div class="drpg-frisk-modes">
            <label class="drpg-frisk-mode">
                <input type="radio" name="friskMode" value="openly" checked>
                <span><strong>${esc(game.i18n.localize("DRPG.Frisk.openLabel"))}</strong>
                <small>${esc(openHint)}</small></span>
            </label>
            <label class="drpg-frisk-mode">
                <input type="radio" name="friskMode" value="unseen">
                <span><strong>${esc(game.i18n.localize("DRPG.Frisk.unseenLabel"))}</strong>
                <small>${esc(game.i18n.format("DRPG.Frisk.unseenHint", { unseen: part.unseen, hand: part.threshold }))}</small></span>
            </label>
        </div>`;
}

/** The Frisk mode a drawn Palm window has checked (`friskModes`): "unseen" or, where it says neither, "openly" (the checked one). */
function friskModeOf(root) {
    return root?.querySelector?.('input[name="friskMode"]:checked')?.value === "unseen" ? "unseen" : "openly";
}

/*
 * A PLANT IS ALREADY DECIDED BY THE TIME THE DICE LAND.
 *
 * No picker, no critical branch and nothing to reveal: the item was chosen
 * in the first window, out of the player's own pockets, and a critical buys
 * nothing extra because there is nothing extra to buy. Said out loud rather
 * than left as an absence - the reader's next question after the Steal
 * branch below is "and what does a critical do here", and the answer is
 * "nothing, on purpose".
 */
async function resolvePlant(actor, def, { victim, planted, hand, shadow, room, seen, success, rolls, paid = null }) {
    const { requestPlant } = await import("./gm-bridge.mjs");
    const res = await requestPlant({
        plannerId: actor.id,
        victimId: victim.id,
        itemId: planted.id,
        total: hand.total,
        isCritical: Boolean(hand.isCritical),
        unseenTotal: shadow.total,
        unseenCritical: Boolean(shadow.isCritical),
        ...rolls
    });
    // Refused by the one gate before the rolls were read: the action back (`palmBack`; Q3). A Plant into full pockets
    // was tried, and is no refusal (D42): it stays paid; so does one the gate refused on its second asking, after the
    // rolls (told as nothing carried out, vault.mjs `plantOnPerson`; fix e1-G4).
    if (nobodyTook(res.ok, res.reason) || TRANSFER_REFUSED.includes(res.ok ? (res.value?.refused ? (await import("./bridge-guards.mjs")).reasonOf(res.value.refused) : null)
        : (res.refused ? res.reason : null))) await palmBack(actor, paid);

    await noteRollContext(actor, {
        actionKey: "palm", planting: true, room, victimId: victim.id,
        seen, success, itemId: planted.id
    });

    // "Sent" only when it was (E31): a request not carried out has been said once already.
    const plantOutcome = {
        success, seen, target: victim.name,
        // On a GM's own Palm a refusal settles as done with `{ refused }` as its value, told already (fix e1-G4).
        text: res.ok && !res.value?.refused ? game.i18n.format("DRPG.Steal.plantSent", { name: victim.name }) : ""
    };
    await report(actor, def, hand, plantOutcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "palm", roll: hand, outcome: plantOutcome });
    return plantOutcome;
}

/** The action a Palm paid, handed back by its receipt, and said where something was paid (E14 part 1 C1, Q3). */
/*
 * A PALM OR A PLANT NO GM WAS THERE TO TAKE (E16 part 2 C5, 26.10.2026; audit S02-15). The last GM gone between the dice
 * and the ask: the bridge sends nothing and answers `noGm` (bridge-guards.mjs `bridgeRequest`), so no roll was read and
 * nothing was carried out - before the rolls are read, as the owner's Q3 of 18.10 reads, so the action comes back as for
 * the one gate's refusal. `noAnswer` stays paid: a GM may have carried it out and only the answer was lost.
 */
function nobodyTook(ok, reason) {
    return !ok && reason === "noGm";
}

async function palmBack(actor, paid) {
    await abort(actor, paid);
    if (paid) ui.notifications.info(game.i18n.localize("DRPG.Frisk.actionBack"));
}

/*
 * THE CRITICAL IS THE ONLY WAY TO CHOOSE, AND THE PICKER COMES AFTER.
 *
 * Built here, on this client, and only once the dice have already said the
 * theft worked - never before. Opening a list of somebody's pockets is
 * itself the information the action is about, so a picker that appeared
 * before the roll would hand it over even on a miss (trap 93). The GM side
 * re-derives the same pool and refuses anything that is not in it, so the
 * id travelling from here is a request, not an instruction (trap 92).
 */
async function chooseStolen(victim, hand, success) {
    let chosenId = null;
    if (success && hand.isCritical) {
        const pool = await stealablePool(victim);
        if (!pool.length) {
            ui.notifications.warn(game.i18n.format("DRPG.Steal.emptyPockets", {
                name: victim.name
            }));
        } else {
            chosenId = await chooseStolenItem(victim, pool);
            // Backing out of the picker is not backing out of the theft - the
            // dice are thrown, the action is spent and the hand is already in
            // the pocket. It falls back to whatever comes out, which is what an
            // ordinary success would have got.
        }
    }
    return chosenId;
}

export async function performPalm(actor, def, options) {
    const cost = options.free ? 0 : def.cost;
    if (!canAfford(actor, cost)) return null;

    const room = roomOfActor(actor);
    if (!room) {
        ui.notifications.warn(game.i18n.localize("DRPG.Action.noRoom"));
        return null;
    }

    // Anybody standing here who is not you. `othersInRoom` already excludes
    // tokens that do not count as present - see `countsAsPresent`.
    const targets = othersInRoom(actor).filter(a => a?.type === "character");
    if (!targets.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Steal.nobodyHere"));
        return null;
    }

    const mine = await palmablePool(actor);

    const picked = await choosePalm(actor, def, targets, mine);
    if (!picked) return null;

    const victim = game.actors.get(picked.form?.querySelector("[name=who]")?.value ?? "");
    if (!victim) return null;

    // A Frisk pays, throws and asks the GM on its own road (E80 part 2 C2, frisk.mjs).
    if (picked.value === "frisk") {
        const { performFrisk } = await import("./frisk.mjs");
        return performFrisk(actor, def, victim, friskModeOf(picked.form), { cost, room });
    }

    const planting = picked.value === "plant";
    const planted = planting
        ? mine.find(i => i.id === picked.form?.querySelector("[name=what]")?.value) ?? mine[0]
        : null;
    if (planting && !planted) return null;

    // Paid before the first roll, like Sabotage and for the same reason: these
    // rolls grant Hope and feed the Despair pool, and a cancel afterwards with
    // nothing charged is a resource generator.
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;

    const unseen = def.unseen;
    /*
     * TOLD AS THE PALM'S OWN (E08+E28 C15, 04.10.2026; audit S10-06). The GM scores both rolls on
     * its record of them (gm-bridge.mjs `action.steal`, `action.plant`), and holds each record to
     * the action it was thrown for. The hand's is told as "steal", as it always was (the GMs'
     * bookmark renames it "palm" by its context); this one, which told the GM no action until C15,
     * is told as the action's own key. A supporting roll all the same: nothing remembers it (`remember: false`).
     */
    // Each window named "Palm - Shadow, beat 15" by its part (`palmTitle`, E51 C1), its number the one judged below.
    const shadow = await rollTrait(actor, unseen.trait, {
        remember: false, actionKey: "palm", title: palmTitle(planting ? "plantUnseen" : "unseen", def), titled: true,
        dc: planting ? (def.plant?.unseen ?? unseen.threshold) : unseen.threshold
    });
    if (!shadow) return abort(actor, paid);

    const hand = await rollTrait(actor, def.traits[0], {
        actionKey: "steal", title: palmTitle(planting ? "plant" : "hand", def), titled: true,
        dc: planting ? (def.plant?.threshold ?? def.threshold) : def.threshold,
        context: { room, victimId: victim.id, unseenTotal: shadow.total }
    });
    // The Shadow roll above has landed and paid out; closing this window does
    // not hand the action back (ROLL-05).
    if (!hand) return spentAfterRoll(actor, def);

    /*
     * A PLANT IS AN EASIER HAND THAN A STEAL (D10a), on both axes.
     *
     * Read here rather than branched earlier because both rolls have already
     * happened by this line and neither cares which they were for - what
     * changes is only the number they are measured against. `def.plant` is
     * absent for anything but Palm, so the `??` is what keeps every other
     * caller of this shape on its own single threshold.
     */
    const bar = planting ? (def.plant?.threshold ?? def.threshold) : def.threshold;
    const unseenBar = planting ? (def.plant?.unseen ?? unseen.threshold) : unseen.threshold;

    const seen = !(shadow.isCritical || shadow.total >= unseenBar);
    const success = hand.isCritical || hand.total >= bar;

    // The two rolls the GM scores, by their messages: the hand's is the one this browser keeps (`rollInHand`).
    const rolls = { rollId: rollInHand(actor)?.messageId ?? null, unseenRollId: shadow.raw?.message?.id ?? shadow.raw?.message?._id ?? null };
    if (planting) return resolvePlant(actor, def, { victim, planted, hand, shadow, room, seen, success, rolls, paid });

    const chosenId = await chooseStolen(victim, hand, success);

    const { requestSteal } = await import("./gm-bridge.mjs");
    const res = await requestSteal({
        thiefId: actor.id,
        victimId: victim.id,
        itemId: chosenId,
        total: hand.total,
        isCritical: Boolean(hand.isCritical),
        unseenTotal: shadow.total,
        unseenCritical: Boolean(shadow.isCritical),
        ...rolls
    });
    /*
     * A PALM THE ONE GATE REFUSED GIVES ITS ACTION BACK (E14 part 1 C1; the owner's Q3 of 18.10.2026: "a refusal before
     * the rolls are read refunds; a full-pockets Plant does not"). The primary asks inventory.mjs `transferRefusal` -
     * the room, both lives, the person, the Eclipse, the Class Trial - before it reads either roll (vault.mjs
     * `stealFromPerson`, `plantOnPerson`), and its refusal comes back with one of the gate's codes (`TRANSFER_REFUSED`;
     * the bridge has said why already). Handed back here, by what was paid (`abort`, its receipt: a Burst as a Burst, a
     * free Palm nothing), and not by the primary, which cannot tell a Burst from an action - as a Frisk's ask is (frisk.mjs
     * `FRISK_HANDED_BACK`). A GM's own Palm reads the refusal off its own answer (gm-bridge.mjs `requestSteal`'s `local`).
     * The dice were thrown and paid out their Hope and Despair all the same: that is what the owner's answer accepts.
     * One the gate refused on its second asking, inside the move after the rolls were read, comes back as nothing carried
     * out (`refused`, vault.mjs `stealFromPerson`) and stays paid, as Q3 reads (E14 fix e1-G4; the review's E14R-07).
     */
    if (nobodyTook(res.ok, res.reason) || TRANSFER_REFUSED.includes(res.ok ? (res.value?.refused ? (await import("./bridge-guards.mjs")).reasonOf(res.value.refused) : null)
        : (res.refused ? res.reason : null))) await palmBack(actor, paid);

    // What Reroll would have to unpick, and the honest answer is that it cannot
    // - see `case "steal"` in reroll.mjs. Recorded anyway so the branch there
    // has the facts it needs to say so precisely.
    await noteRollContext(actor, {
        actionKey: "palm", room, victimId: victim.id,
        seen, success, itemId: chosenId
    });

    /*
     * THIS CARD SAYS THE QUESTION WENT OUT; THE VERDICT COMES FROM THE OTHER
     * SIDE.
     *
     * `seen` and `success` are computed above and deliberately not printed
     * here. This client can do the arithmetic - the thresholds are in the
     * table it just read - but it cannot know whether the theft actually
     * happened: `stealFromPerson` can still refuse it for standing in the
     * wrong room, for a pool with nothing in it, or for hands too full to hold
     * what came out. A card reading "you got it" beside a whisper saying
     * otherwise is two answers to one question, and the wrong one is the one
     * that arrived first.
     *
     * Same shape as Observe and Analyze, and for the same reason.
     */
    const outcome = {
        success,
        seen,
        target: victim.name,
        // "Sent" only when it was (E31), as for a plant - and a GM's own refused Palm settles as done with `{ refused }` (fix e1-G4).
        text: res.ok && !res.value?.refused ? game.i18n.format("DRPG.Steal.sent", { name: victim.name }) : ""
    };

    await report(actor, def, hand, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "palm", roll: hand, outcome });
    return outcome;
}

/**
 * Everything on a character that a Steal could come away with.
 *
 * Their POCKETS, which is `carriedInCategory` - `itemsInCategory` minus what is
 * stashed. Two exclusions, and both are rules rather than tidiness:
 *
 *   the stash        has its own route with its own conditions (stand in the
 *                    room, and find it first if it is hidden). A Steal that
 *                    reached into one would walk past every one of them.
 *   Truth Bullets    are knowledge, not objects. You cannot pick somebody's
 *                    pocket for what they worked out.
 *
 * Broken things stay IN. A ruined crime tool that can be lifted out of a pocket
 * is evidence that starts to circulate, which is the best thing this action
 * produces - and `preservedFlags` already stops the transfer from mending it.
 *
 * Duplicated in `stealFromPerson` on the GM side rather than shared, and that is
 * deliberate: this builds a menu, that one is the authority, and an authority
 * that imports its answer from the thing it is checking is not one.
 */
async function stealablePool(victim) {
    const { carriedInCategory } = await import("./inventory.mjs");
    return Object.keys(ITEM_CATEGORIES)
        .filter(c => c !== "truthBullet")
        .flatMap(c => carriedInCategory(victim, c));
}

/**
 * What this character could leave in somebody else's pocket.
 *
 * The same pool as a Steal, asked of the planter instead of the victim - their
 * own carried things, no Truth Bullets and nothing in a stash. `isBroken` is
 * deliberately not filtered: a ruined crime tool is the single best thing this
 * action exists to get rid of.
 */
async function palmablePool(actor) {
    return stealablePool(actor);
}

/** `Name - Category`, for a select. */
function describeItem(item) {
    const cat = ITEM_CATEGORIES[item.getFlag(MODULE_ID, "category")]?.label ?? "";
    return `${item.name}${cat ? ` - ${cat}` : ""}`;
}

/** Which of them. Only ever opened on a critical - see `performPalm`. */
async function chooseStolenItem(victim, pool) {
    const describe = i => esc(describeItem(i));

    const chosen = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Steal.chooseTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Steal.chooseIntro", { name: esc(victim.name) })}</p>
            <label>${game.i18n.localize("DRPG.Items.whichItem")}
                <select name="item">${pool.map(i =>
                    `<option value="${i.id}">${describe(i)}</option>`).join("")}</select></label>
        </form>`),
        buttons: [
            {
                action: "take", label: game.i18n.localize("DRPG.Vault.take"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=item]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (!chosen || chosen === "cancel") ? null : String(chosen);
}
