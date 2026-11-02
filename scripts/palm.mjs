/**
 * Danganronpa RPG - Palm: the player's half and the GM's.
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
 * The vault's half of a Palm - the GM's side of a steal and a plant: the
 * pockets as the GMs hold them (`pocketsAsHeld`, `pocketsFrom`), what a
 * victim is told (`tellPalmVictim`), `stealFromPerson` and `plantOnPerson` -
 * joined this file below the player's half in E41 C6, out of vault.mjs, which
 * re-exports the four of them it exported. Of the action family it reads the
 * shared layer alone.
 */

import { MODULE_ID, ACTIONS, TRAITS, ITEM_CATEGORIES } from "./config.mjs";
import { spendAction } from "./actions.mjs";
import { TRANSFER_REFUSED, ITEM_FLAGS, isStashed } from "./inventory.mjs";
import { getSetting, SETTINGS } from "./settings.mjs";
import { roomOfActor, othersInRoom } from "./movement.mjs";
import { dialogContent, plural, esc, whisperToOwner, whisperToGms, log, error } from "./utils.mjs";
import { rollTrait, rollInHand, noteRollContext, abort, spentAfterRoll, canAfford } from "./action-pipeline.mjs";
import { report } from "./action-report.mjs";
import { briefingBlock } from "./action-briefing.mjs";
import { chooseVariant } from "./action-menus.mjs";
import { judgedFor } from "./sheet-audit.mjs";

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
    // rolls (told as nothing carried out, palm.mjs `plantOnPerson`; fix e1-G4).
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
     * the room, both lives, the person, the Eclipse, the Class Trial - before it reads either roll (palm.mjs
     * `stealFromPerson`, `plantOnPerson`), and its refusal comes back with one of the gate's codes (`TRANSFER_REFUSED`;
     * the bridge has said why already). Handed back here, by what was paid (`abort`, its receipt: a Burst as a Burst, a
     * free Palm nothing), and not by the primary, which cannot tell a Burst from an action - as a Frisk's ask is (frisk.mjs
     * `FRISK_HANDED_BACK`). A GM's own Palm reads the refusal off its own answer (bridge-asks.mjs `requestSteal`'s `local`).
     * The dice were thrown and paid out their Hope and Despair all the same: that is what the owner's answer accepts.
     * One the gate refused on its second asking, inside the move after the rolls were read, comes back as nothing carried
     * out (`refused`, palm.mjs `stealFromPerson`) and stays paid, as Q3 reads (E14 fix e1-G4; the review's E14R-07).
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

/* ==========================================================================
 * STEALING FROM A PERSON
 * --------------------------------------------------------------------------
 * The stash's sibling, and it lives here for one reason: this file is already
 * the module's authority on taking something that is not yours. `stealFromVault`
 * above owns the rules about hiding places; this owns the rules about pockets.
 * Both move an item between two sheets, both preserve what a transfer must not
 * mend, and both are GM-only for the same reason.
 * ========================================================================== */

/**
 * What `victim` carries, as the GMs hold it: the one pool a theft draws from and a Frisk lists (E80 part 2 C1, the
 * A11 design's step 4; S17-16, no further copy of it). Every write queued on the victim and on `asker` judged first
 * (sheet-audit.mjs `judgedFor`), then the victim's items as the GMs' mark holds them (`itemsAsHeld`), in the order of
 * the module's categories (`pocketsFrom`): no Truth Bullet, which is knowledge and not a thing in a pocket, and nothing
 * in a stash, whose very existence a pocket does not tell. `undecided` "drop" leaves out an item a player's browser
 * made that no GM has decided on yet (`creationRefusal`), with a line in the GM's log: a Frisk's list. A theft keeps it
 * in the draw, and refuses the theft when the draw takes it, so a pocket that holds only that one is not told empty.
 */
export async function pocketsAsHeld(victim, asker = null, { undecided = "keep" } = {}) {
    const { itemsAsHeld, creationRefusal } = await import("./sheet-audit.mjs");
    await judgedFor(victim?.id, asker?.id);
    const pockets = await itemsAsHeld(victim);
    return pocketsFrom(pockets, undecided === "drop" ? { undecided: item => creationRefusal(victim, item.id) } : {});
}

/**
 * The pool out of a list of items as held (`pocketsAsHeld`), with no read of its own: the module's categories in
 * `ITEM_CATEGORIES` order, never a Truth Bullet, never a stashed item (inventory.mjs `isStashed`), and, given
 * `undecided` (an item's reason or null), never an item it names, each such left out logged for the GM.
 */
export function pocketsFrom(items, { undecided = null } = {}) {
    const pool = Object.keys(ITEM_CATEGORIES)
        .filter(c => c !== "truthBullet")
        .flatMap(c => items.filter(i => i.getFlag(MODULE_ID, ITEM_FLAGS.category) === c && !isStashed(i)));
    if (!undecided) return pool;
    return pool.filter(item => {
        const why = undecided(item);
        if (why) log(`Left out of a list of what somebody carries: ${why}.`);
        return !why;
    });
}

/**
 * The card a Palm's victim reads when it noticed (`seen`): veiled (utils.mjs `whisperToOwner(..., { veiled: true })`),
 * so its document is addressed to every browser in nobody's voice, with the `stolen` sound for its reader. At a body the
 * GMs keep from the asker the same document is posted, its words to the GMs alone (`whisperToGms`): the body feels
 * nothing and no player reads it, and every browser gets the documents a living victim's Palm posts (E80 fix sec1-G1).
 *
 * A BODY THE GMS KEEP FROM THE ASKER (E80 fix sec1-G1, the review's sec-1; the owner's Q8, option A, 20.10.2026): dead
 * for the GMs, not published, and a death the asking user may not know (incident-store.mjs `knowsOfDeath`: not a GM,
 * not in the row's `known`, not the body's owner). Such a victim is taken from and planted on as a living one is, on
 * the same dice, so the thief's or planter's side reads as at a living victim; only the victim's card changes. Since
 * E14 part 1 C1 that is the one gate's reading (inventory.mjs `transferRefusal`, frisk.mjs `knownDeath`): a dead victim
 * it lets through is one kept from the asker, and one the asker knows dead - a GM's own Palm, with no asker, knows
 * every death - is refused, its road being the loot.
 */
async function tellPalmVictim(victim, html, { body = false } = {}) {
    const card = { veiled: true, flags: { [MODULE_ID]: { sfx: "stolen" } } };
    return body ? whisperToGms(html, card) : whisperToOwner(victim, html, card);
}

/**
 * Take something out of somebody's pockets. GM side.
 *
 * TWO NUMBERS ARRIVE, TWO VERDICTS ARE MADE HERE. The thief's client throws the
 * dice and names a victim; whether 14 was beaten, whether 15 was beaten, what
 * the pool actually contains and whether the victim is told are all decided on
 * this side against `ACTIONS.steal` - the same division of labour as Observe,
 * and for the same reason: the rule must live in one place, and it must not be
 * the place that benefits from the answer.
 *
 * @param {object} options
 * @param {string} options.thiefId
 * @param {string} options.victimId
 * @param {string|null} [options.itemId]   Honoured only on a critical.
 * @param {number} options.total           The Hand roll.
 * @param {boolean} [options.isCritical]
 * @param {number} options.unseenTotal     The Shadow roll.
 * @param {boolean} [options.unseenCritical]
 * @param {object} [context]
 * @param {User|null} [context.asker]     The user whose packet asked (bridge-runs-acts.mjs `handleSteal`): a body the GMs keep
 *   from that user is robbed as a living victim is (inventory.mjs `transferRefusal`).
 */
export async function stealFromPerson({
    thiefId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
} = {}, { asker = null } = {}) {
    if (!game.user.isGM) return null;

    const thief = game.actors.get(thiefId);
    const victim = game.actors.get(victimId);
    if (!thief || !victim || thief.id === victim.id) return null;

    const refuse = why => {
        error(`Refused a theft by ${thief.name}: ${why}.`);
        return null;
    };

    /*
     * THE ONE GATE, BEFORE THE ROLLS ARE READ (E14 part 1 C1; audit S16-30, S08-20; the owner's Q3). The dead neither
     * rob nor are robbed - looting a body is a different action with different rules, see `requestBodyLoot` - save a
     * body the GMs keep from the asker, whose thief reads what a living victim's reads (`tellPalmVictim`); and you
     * have to be standing next to them, as the GMs read both (scene, floor and room: E12 C3, audit S08-39), neither a
     * Monocub nor a Monokuma, the victim on a token the GMs have not hidden, no Eclipse, no Class Trial, the thief no
     * side of the running incident: inventory.mjs `transferRefusal`, mode "steal", which `transferItem` asks again. Its
     * refusal is handed back to be told by its code, and the thief's browser gives back the action it paid (action-rolls
     * `performPalm`): nothing was read of the rolls. Until C1 each refusal here was the GM's log alone.
     */
    const { isDeadForGm } = await import("./chapter.mjs");
    const { transferRefusal } = await import("./inventory.mjs");
    const why = await transferRefusal(victim, thief, { mode: "steal", asker });
    if (why) {
        refuse(why);
        return { refused: why };
    }
    const body = isDeadForGm(victim);

    const def = ACTIONS.palm;
    const success = Boolean(isCritical) || Number(total) >= def.threshold;
    const seen = !(Boolean(unseenCritical) || Number(unseenTotal) >= def.unseen.threshold);

    /*
     * THE POOL IS REBUILT HERE, NOT TRUSTED (trap 92).
     *
     * What travels is an item id, and an id is a request. A packet naming a
     * Truth Bullet or something sitting in a stash has to be refused on this
     * side, because the only thing that stopped it on the other side was a
     * `<select>` built by the person who benefits from it being wrong.
     *
     * And the CHOICE is a critical's privilege. An ordinary success takes
     * whatever comes out - the id is ignored, not honoured quietly, because a
     * client that sends one on a non-critical is either out of date or trying
     * it on, and both deserve the same answer.
     *
     * OUT OF THE POCKETS AS THE GMS HOLD THEM (E29 fix r2-H17, 06.10.2026): the
     * victim's items once every write queued on them has been judged, each with
     * its place, category, tier, roles, kind, broken and wear as the sheet
     * audit's mark holds them (sheet-audit.mjs `itemsAsHeld`, which says why the
     * wait is enough here), in the order `carriedInCategory` gave. The pool is
     * `pocketsAsHeld`'s since E80 part 2 C1, the one a Frisk lists, and the
     * only one a theft reads: what moves and the thief's hands it is counted
     * against (fix r2-H18) are read again, by id, by inventory.mjs
     * `transferItem` after its own wait (E35 C3; the owner, 13.10: no further
     * copy of the pool).
     */
    const { creationRefusal } = await import("./sheet-audit.mjs");
    const pool = await pocketsAsHeld(victim, thief);

    let item = null;
    if (success && pool.length) {
        const wanted = isCritical ? pool.find(i => i.id === itemId) : null;
        item = wanted ?? pool[Math.floor(Math.random() * pool.length)];
    }
    /*
     * An item the victim's player made that no GM has decided on yet is taken by nobody (E29 fix r2-H21, sheet-audit.mjs
     * `creationRefusal`): the theft is refused before anything is written - nobody told of a hand that was or was not
     * seen - and the thief told, whether they named it on a critical or the draw took it. Left out of the draw instead,
     * a hand in a pocket holding only that would come out empty, and the thief would be told of an empty pocket.
     */
    const undecided = item ? creationRefusal(victim, item.id) : null;
    if (undecided) {
        refuse(undecided);
        return { refused: undecided };
    }

    // Nothing in their pockets is not a failure - the hand went in, and whether
    // it was noticed is still a live question. The two whispers below say so.
    const empty = success && !pool.length;

    /*
     * ON THE ONE ROAD (E35 C3; S17-16, S08-37, S08-38): the copy, the count, the
     * flags it carries - a stolen broken thing stays broken, a stolen crowbar
     * is still a weapon - and the hands it lands in are inventory.mjs
     * `transferItem`'s. Full hands put it in the thief's own stash
     * (TRANSFER_POLICY.steal), and only a thief with none comes away with
     * nothing, the item staying where it is; one piece of a stack moves; a key
     * to a room the thief already holds leaves the victim and is not copied.
     *
     * THE QUIET HALF IS STILL ONE OPTION (`quiet`, unseen): the piece leaves
     * the victim with `render: false`, which travels with the write over
     * Foundry's own socket, so their open sheet does not redraw for THIS
     * change. The item has really gone - they cannot use it, give it away or
     * find it again - and what is suppressed is the redraw, not the fact. A
     * sheet redraws for a great many other reasons (a resource moving,
     * Despair, an incident starting), so the row can come off the screen a
     * moment later: not "they will never see", but "they will not see because
     * of this" - trap 90. Clicking the stale row is handled where the rows are
     * drawn (trap 91). When they ARE told, the render goes ahead: a suppressed
     * refresh next to a whisper naming the thief is a way of losing one of the
     * two messages.
     */
    let moved = null;
    if (item) {
        const { transferItem } = await import("./inventory.mjs");
        moved = await transferItem(victim, thief, item, { mode: "steal", quiet: !seen, asker });
        /* The one gate asked again by the move refused it: the two parted, or the phase moved on, while the dice were
           read. Nothing moved and nobody is told of a hand. AFTER THE ROLLS (E14 fix e1-G4; the review's E14R-07): the
           owner's Q3 gives the action back for a refusal before the rolls are read, and this one comes after - the dice
           were read and paid out. Told as nothing carried out (the closed list's `refused`), not by the gate's code, so
           the thief's browser, which refunds on the gate's codes (action-rolls.mjs `TRANSFER_REFUSED`), keeps it spent;
           the GM's log keeps why. Read in the code: no test parts the two between the two askings. */
        if (moved?.refused) return { refused: `nothing was carried out: ${moved.refused}` };
    }
    // Not written (`failed`) is read as full hands, as a refused copy was before: the item stays where it is. Gone by
    // its turn (`missing`, a second hand after the same piece) comes away empty.
    const handsFull = Boolean(moved?.handsFull || moved?.failed);

    const took = Boolean(moved?.ok);

    // The thief always learns what happened to them, including whether they
    // were noticed - that is what the Shadow roll was for.
    await whisperToOwner(thief, `<p>${game.i18n.format(
        took ? "DRPG.Steal.cardTook"
            : handsFull ? "DRPG.Steal.cardHandsFull"
            : empty ? "DRPG.Steal.cardEmpty"
            : "DRPG.Steal.cardMissed",
        { item: esc(item?.name ?? ""), who: esc(victim.name) }
    )}</p><p><small>${game.i18n.localize(seen
        ? "DRPG.Steal.cardSeen" : "DRPG.Steal.cardUnseen")}</small></p>`);

    /*
     * THE VICTIM, AND ONLY WHEN THEY NOTICED.
     *
     * Named, unlike the stash's "somebody has been in here", and that asymmetry
     * is the point of the two rolls. An emptied hiding place is discovered
     * later, by its owner, with nothing to go on; a hand in your pocket is
     * something you catch somebody doing. So this says who - and, when they
     * actually got something, what.
     *
     * Both failures are worth telling. Being caught trying is one of the better
     * scenes this action produces, and a Shadow roll that answers "did they
     * notice you" has to be allowed to answer it about an attempt.
     *
     * Veiled since E80 fix sec1-G1, and at a body the GMs keep its words go to
     * the GMs alone (`tellPalmVictim`).
     */
    if (seen) {
        try {
            await tellPalmVictim(victim, `<p>${game.i18n.format(
                took ? "DRPG.Steal.caughtTaking" : "DRPG.Steal.caughtTrying",
                { who: esc(thief.name), item: esc(item?.name ?? "") }
            )}</p>`, { body });
        } catch (err) {
            error("Could not tell the victim of a theft", err);
        }
    }

    log(`${thief.name} ${took ? "took" : "failed to take"} `
        + `${took ? `"${item.name}" ` : ""}from ${victim.name}`
        + `${seen ? " and was seen" : " unseen"}${body ? ", a body the GMs keep, as a living victim (its card's words to the GMs alone)" : ""}.`);

    return { took, seen, item: item?.name ?? null, handsFull, empty };
}



/**
 * Leave something in somebody's pocket. GM side, and the mirror of the theft
 * directly above - same two axes, same two numbers, the item travelling the
 * other way.
 *
 * WHY IT DESERVES ITS OWN FUNCTION rather than a `direction` flag on the one
 * above: every guard reads differently. The pool is the PLANTER'S, the carry
 * limit that can refuse is the VICTIM'S, and "their hands are full" means the
 * item stays where it started rather than vanishing. A shared body with four
 * conditionals in it would be the same code twice with the harder half hidden.
 *
 * @param {object} options
 * @param {string} options.plannerId
 * @param {string} options.victimId
 * @param {string} options.itemId       Chosen before the roll, out of their own
 *   pockets - no critical branch, because there is nothing left to choose.
 * @param {number} options.total        The Hand roll.
 * @param {number} options.unseenTotal  The Shadow roll.
 * @param {object} [context]
 * @param {User|null} [context.asker]   The user whose packet asked (bridge-runs-acts.mjs `handlePlant`): a body the GMs keep
 *   from that user is planted on as a living victim is (inventory.mjs `transferRefusal`).
 */
export async function plantOnPerson({
    plannerId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
} = {}, { asker = null } = {}) {
    if (!game.user.isGM) return null;

    const planter = game.actors.get(plannerId);
    const victim = game.actors.get(victimId);
    const item = planter?.items?.get(itemId ?? "");
    if (!planter || !victim || planter.id === victim.id || !item) return null;

    const refuse = why => {
        error(`Refused a plant by ${planter.name}: ${why}.`);
        return null;
    };

    // Planting evidence on a corpse is a real thing somebody will want to do, and it is not this action: a body is not
    // carrying anything any more, and the crime scene has its own rules - save a body the GMs keep from the asker, whose
    // planter reads what a living victim's reads. That, the room and the person are the one gate's, mode "plant", as a
    // theft's (E14 part 1 C1: inventory.mjs `transferRefusal`), asked before the rolls are read and told by its code.
    const { isDeadForGm } = await import("./chapter.mjs");
    const { transferRefusal } = await import("./inventory.mjs");
    const why = await transferRefusal(planter, victim, { mode: "plant", asker });
    if (why) {
        refuse(why);
        return { refused: why };
    }
    const body = isDeadForGm(victim);

    /*
     * THE POOL IS REBUILT HERE, exactly as it is for a theft (trap 92) - and
     * the same two exclusions, for the same reasons read backwards. A Truth
     * Bullet cannot be planted because it is knowledge rather than an object,
     * and something in a stash cannot be planted because it is not in a hand.
     * Out of the pockets as the GMs hold them, as a theft's (E29 fix r2-H17):
     * what lands on the victim is never roles, a tier or a mend the planter's
     * console wrote a moment before asking. The pool is `pocketsAsHeld`'s, a
     * theft's read the other way (E35 C3; the copy of it written here went, the
     * owner's 13.10: no further copy); the victim's hands, as the GMs hold them
     * (fix r2-H18), are inventory.mjs `transferItem`'s to count.
     */
    const { creationRefusal } = await import("./sheet-audit.mjs");
    const pool = await pocketsAsHeld(planter, victim);
    const held = pool.find(i => i.id === item.id);
    if (!held) {
        return refuse(`"${item.name}" is not something they are carrying`);
    }
    // An item the planter's player made that no GM has decided on yet goes into nobody's pocket, and the planter told
    // (E29 fix r2-H21, sheet-audit.mjs `creationRefusal`) - before the rolls are read, so nobody is told of a hand seen.
    const undecided = creationRefusal(planter, held.id);
    if (undecided) {
        refuse(undecided);
        return { refused: undecided };
    }

    // THE PLANT BARS, NOT THE STEAL ONES (ACT-01, 17.09). The player's client
    // measured against `def.plant` - D10a, planting is easier on both axes - and
    // this side, which is the one that decides, measured against the theft's:
    // an 8 or 9 failed to plant and a 13 or 14 was seen, with the victim told
    // they had caught somebody. Same `??` as the client, so the two cannot drift.
    const def = ACTIONS.palm;
    const bar = def.plant?.threshold ?? def.threshold;
    const unseenBar = def.plant?.unseen ?? def.unseen.threshold;
    const success = Boolean(isCritical) || Number(total) >= bar;
    const seen = !(Boolean(unseenCritical) || Number(unseenTotal) >= unseenBar);

    /*
     * ON THE ONE ROAD (E35 C3; S17-16, S08-37): the copy, the count and the flags
     * it carries are inventory.mjs `transferItem`'s - a planted broken thing
     * stays broken, which is most of the point: the best use of this action is
     * getting a ruined murder weapon out of your own pocket and into somebody
     * else's, worth nothing if the transfer mended it. One piece of a stack.
     *
     * FULL POCKETS REFUSE IT (D42, the owner's option 1; S17-15, S08-41). It went
     * into the victim's stash and whispered them that their hands were full, so
     * an unseen Plant told its victim what it was, and the planter read that it
     * was in their pocket. Now the item stays with the planter, who is told so,
     * and the victim is told nothing - seen or not, stash or none: no card, no
     * write, nothing to redraw (TRANSFER_POLICY.plant).
     *
     * The quiet half, and the mirror of the silent Steal (`quiet`, unseen): the
     * victim's sheet does not redraw FOR THIS, and nothing on the way in speaks
     * to them - not a key they hold already, not the Gear shape (inventory.mjs
     * `keepGearShape`, S08-02).
     */
    let moved = null;
    if (success) {
        const { transferItem } = await import("./inventory.mjs");
        moved = await transferItem(planter, victim, held, { mode: "plant", quiet: !seen, asker });
        // As a theft's: the gate asked again by the move, after the rolls, nothing moved, the action kept spent (Q3; fix e1-G4).
        if (moved?.refused) return { refused: `nothing was carried out: ${moved.refused}` };
    }
    // Not written (`failed`) is read as full pockets, as a refused copy was before: the item stays with the planter.
    // Gone by its turn (`missing`, a second Plant of the same piece) did not go in.
    const handsFull = Boolean(moved?.handsFull || moved?.failed);
    const landed = Boolean(moved?.ok);

    const done = landed;

    await whisperToOwner(planter, `<p>${game.i18n.format(
        done ? "DRPG.Steal.cardPlanted"
            : handsFull ? "DRPG.Steal.cardTheirHandsFull"
            : "DRPG.Steal.cardPlantMissed",
        { item: esc(item.name), who: esc(victim.name) }
    )}</p><p><small>${game.i18n.localize(handsFull ? "DRPG.Steal.cardUnfelt"
        : seen ? "DRPG.Steal.cardSeen" : "DRPG.Steal.cardUnseen")}</small></p>`);
    // FULL POCKETS: NO "THEY NOTICED" (E35 fix e1-G3; the review's E35-R1). A missed Shadow roll into full pockets told
    // the planter "They noticed." while D42 tells the victim nothing - the planter played a scene of being caught that
    // the victim's player knew nothing of (E35-T6's seen rows, at 78457d7: the card read "... It stays with you.They
    // noticed."). The pocket was never reached, so the line says the victim felt nothing, seen or not.

    /*
     * AND THE VICTIM, ONLY WHEN THEY NOTICED - with the item named.
     *
     * The asymmetry with a theft is worth stating: a stolen thing is missed
     * later, so the silent case has a natural discovery. A planted thing has
     * none - nobody audits their own pockets for things that should not be
     * there - which is exactly what makes the unnoticed plant worth an action,
     * and exactly why the noticed one has to be unambiguous.
     *
     * NOT WHEN THEIR POCKETS WERE FULL (D42): the owner's answer gives that victim no whisper, seen or not.
     */
    if (seen && !handsFull) {
        try {
            await tellPalmVictim(victim, `<p>${game.i18n.format(
                done ? "DRPG.Steal.caughtPlanting" : "DRPG.Steal.caughtTryingPlant",
                { who: esc(planter.name), item: esc(item.name) }
            )}</p>`, { body });
        } catch (err) {
            error("Could not tell the victim of a plant", err);
        }
    }

    log(`${planter.name} ${done ? "planted" : "failed to plant"} `
        + `"${item.name}" on ${victim.name}${seen ? " and was seen" : " unseen"}${
            body ? ", a body the GMs keep, as a living victim (its card's words to the GMs alone)" : ""}.`);

    return { done, seen, item: item.name, handsFull };
}
