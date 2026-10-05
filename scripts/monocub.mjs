/**
 * Danganronpa RPG - Monocub.
 * ---------------------------------------------------------------------------
 * Guide, p. 16: "Po śmierci, gdy jego class trial się zakończy, gracz może
 * dołączyć do DMów jako Monocub." A dead student's player, opted in by
 * agreement with the table, keeps the same character sheet and gets exactly
 * two things to do with it: Move, and Meddle - nudging a living player's next
 * roll from the sidelines.
 *
 * A Monocub is not a Monokuma. It stays a `character` actor with no special
 * flag on the token, keeps the normal action budget (refilled by the same
 * pass that refills everyone else - nothing to change there), and keeps the
 * same room-restricted vision every other student has. What changes is the
 * action panel on the sheet: Move and Meddle instead of the full grid, and
 * a Hope total that only a GM can top up, by converting their own Despair.
 *
 * MEDDLE'S ROLL. The guide marks its difficulty table "Stat: -" - the one roll
 * in the system with no trait behind it. Daggerheart's own `rollTrait` insists
 * on a real trait key, so this is not built through it: a flat 2d12, crit on
 * doubles, exactly Daggerheart's own duality math with the trait modifier
 * removed. `private-rolls.mjs` already rewrites any chat message carrying a
 * roll into a GM-and-roller whisper regardless of how the roll was built, so
 * this one is private for free.
 *
 * THROWN BY THE GM (E08+E28 C17, 04.10.2026; audit S10-06). The Monocub's browser
 * threw the 2d12 and sent the GM its total and its critical, which the GM scored as
 * said. A plain `Roll` is not one the GM's draw takes (roll-draw.mjs reads a duality
 * roll's build), so the GM throws this one itself where it scores it (`meddleOnGm`),
 * and answers the roll; the Monocub's browser posts the card from it as it posted its
 * own - its message, its readers, its dice on its screen - so the roll still reads
 * as the Monocub's. The card is posted once the GM has whispered the outcome, where it
 * used to be posted before the GM was asked.
 *
 * MEDDLE'S EFFECT. Reuses the Call machinery Support and Obstacle already use
 * (`armCall` in call-effects.mjs) rather than inventing a second one. That
 * also means "help a crisis action" costs nothing extra: an incident roll
 * goes through the identical roll dialog, so an armed Meddle bonus applies to
 * it exactly as it would to an ordinary action roll. Where it waits is not the
 * target's flag but the GMs' store and the target's owner's copy (E06 fix r2-G4):
 * `appendArmedCall` sends it there.
 */

import { MODULE_ID, FLAGS, MONOCUB, ACTIONS_RESOURCE } from "./config.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { isDeceased, isDeadForGm } from "./chapter.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { actionsLeft, spendAction, refundAction } from "./actions.mjs";
import { getClock } from "./clock.mjs";
import { resolveThreshold, dialogContent, whisperToOwner, log, warn, plural, tableDialog } from "./utils.mjs";
import { alreadyOpen, keepLive } from "./live.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * STATUS
 * ========================================================================== */

/** Is this student a Monocub? */
export function isMonocub(actor) {
    return Boolean(actor?.getFlag(MODULE_ID, FLAGS.monocub));
}

/** Every Monocub in the world. */
export function monocubActors() {
    return game.actors.filter(a => a.type === "character" && isMonocub(a));
}

/** Dead students who could still opt in - Monocub is a choice, not automatic. */
export function eligibleForMonocub() {
    return game.actors.filter(a =>
        a.type === "character" && !isMonokuma(a) && isDeceased(a) && !isMonocub(a));
}

/**
 * Opt somebody into (or out of) being a Monocub. GM only, and only ever on
 * somebody already `isDeceased` - the guide's condition, not this module's
 * invention. The guide also asks that their trial have concluded first, which
 * is a judgement call for the table; the dialog says so rather than the code
 * enforcing it, the same trust the rest of the murder and trial flow already
 * places in the GM.
 */
export async function setMonocub(actor, value = true) {
    if (!game.user.isGM || !actor) return null;
    if (value && !isDeceased(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.mustBeDead"));
        return null;
    }

    const was = isMonocub(actor);
    await actor.setFlag(MODULE_ID, FLAGS.monocub, Boolean(value));
    // Unconditional on purpose: clearing the flag is also the repair for a
    // silence left behind by a cub who is no longer one.
    if (!value) await actor.unsetFlag(MODULE_ID, FLAGS.silencedChapter);

    /*
     * ONLY ON A REAL CHANGE (F16, 20.09), which is the rule `setSilenced` below
     * has always followed. The Players window's repair dropdown clears the
     * Monocub flag on its way to "dead" or "alive" whether or not anybody was a
     * Monocub, so a GM straightening out one row was told "X is no longer a
     * Monocub" about a student who never was one - a sentence that describes an
     * event that did not happen, in the one window whose job is to correct the
     * record. The writes above stay unconditional; only the telling is gated.
     */
    if (was === Boolean(value)) {
        actor.sheet?.render(false);
        return actor;
    }

    log(`${actor.name} is ${value ? "now" : "no longer"} a Monocub.`);
    ui.notifications.info(game.i18n.format(
        value ? "DRPG.Monocub.opted" : "DRPG.Monocub.unopted", { name: actor.name }));

    actor.sheet?.render(false);
    return actor;
}

/**
 * Mark (or clear) the guide's "stumbled onto the crime" silence.
 *
 * The player is told. This is a restriction on what they may SAY at the table -
 * "otrzymuje zakaz wypowiadania się na temat zbrodni do końca rozdziału" - so a
 * silence nobody announced is a rule the person bound by it cannot follow. It
 * used to be written as a bare flag from the Monocub dialog and never mentioned
 * anywhere; the only trace was a checkbox on the GM's screen.
 */
export async function setSilenced(actor, silenced) {
    if (!game.user.isGM || !actor) return null;

    const was = isSilenced(actor);
    if (silenced) {
        await actor.setFlag(MODULE_ID, FLAGS.silencedChapter, getClock().chapter);
    } else {
        await actor.unsetFlag(MODULE_ID, FLAGS.silencedChapter);
    }

    // Only on a real change: the dialog writes every row it was shown, and a
    // whisper repeating a silence that was already in force is noise.
    if (was !== Boolean(silenced)) {
        await whisperToOwner(actor, `<p><strong>${
            game.i18n.localize("DRPG.Monocub.silenceTitle")
        }</strong> - ${game.i18n.localize(silenced
            ? "DRPG.Monocub.silenceOn"
            : "DRPG.Monocub.silenceOff")}</p>`);
    }
    return actor;
}

/** Is the silence from stumbling onto a crime still in effect? */
export function isSilenced(actor) {
    const chapter = actor?.getFlag(MODULE_ID, FLAGS.silencedChapter);
    return typeof chapter === "number" && chapter === getClock().chapter;
}

/* ==========================================================================
 * MEDDLE
 * --------------------------------------------------------------------------
 * The Despair-to-Hope exchange itself lives in despair.mjs now: a Mastermind
 * needs the exact same trade (see mastermind.mjs), and duplicating a function
 * that moves real Despair out of a real pool is how the two copies quietly
 * drift apart. Import it, do not rebuild it.
 * ========================================================================== */

/**
 * Living students, minus the Monocub itself, sharing its current room.
 *
 * `othersInRoom` already excludes Monokumas and hidden tokens, which is
 * exactly right here too - a Monocub Meddles with a fellow student, not with
 * the DMs walking the map as their own Monokumas.
 */
export async function meddleTargets(actor) {
    const { othersInRoom } = await import("./movement.mjs");
    return othersInRoom(actor).filter(a => !isMonocub(a) && !isDeadForGm(a));
}

/**
 * Put the Meddle roll in chat, without Daggerheart's damage buttons.
 *
 * `Roll#toMessage` leaves `content` empty, so the message renders through the
 * system's own `foundryRoll.hbs` - and that template appends "Deal damage" and
 * "Apply healing" to EVERY plain roll it draws. Meddle is neither: it nudges
 * somebody's next roll. The buttons were live, aimed at whatever token happened
 * to be targeted, and there was nothing about the action they could correctly do.
 *
 * Writing our own `content` takes that template out of the path entirely - the
 * message renders what we give it. `rolls` is still populated, so Dice So Nice
 * animates the dice exactly as before, and `private-rolls.mjs` still sees a roll
 * to make private.
 */
async function postMeddleRoll(actor, roll, total, isCritical, help) {
    const label = `${MONOCUB.meddle.label} - ${
        game.i18n.localize(help ? "DRPG.Monocub.help" : "DRPG.Monocub.hinder")}`;

    const tooltip = await roll.getTooltip();

    return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        rolls: [roll],
        content: `<div class="dice-roll drpg-flat-roll">
            <div class="dice-flavor">${foundry.utils.escapeHTML(label)}</div>
            <div class="dice-result">
                <div class="dice-formula">${foundry.utils.escapeHTML(roll.formula)}</div>
                ${tooltip}
                <h4 class="dice-total">${total}</h4>
            </div>
            ${isCritical
                ? `<p class="drpg-flat-crit"><em>${
                    game.i18n.localize("DRPG.Action.critical")}</em></p>`
                : ""}
        </div>`
    });
}

/** A flat 2d12: Daggerheart's own duality math with no trait behind it. Thrown on the GM (`meddleOnGm`). */
async function rollFlat() {
    const roll = new Roll("2d12");
    await roll.evaluate();
    const [a, b] = roll.terms[0]?.results ?? [];
    return {
        roll,
        total: roll.total,
        isCritical: Boolean(a && b && a.result === b.result)
    };
}

/**
 * Meddle: help or hinder somebody in the room. Costs an action from the normal
 * budget and a point of Hope on top - both spent here, on the Monocub's own
 * actor, which the acting player already owns.
 */
export async function performMeddle(actor, targetId, help) {
    if (!isMonocub(actor)) return null;
    if (await meddleLocked()) return null;

    const def = MONOCUB.meddle;
    if (actionsLeft(actor) < def.cost) {
        ui.notifications.warn(plural("DRPG.Actions.notEnough", {
            actor: actor.name, left: actionsLeft(actor), needed: def.cost
        }, "left"));
        return null;
    }
    const hope = resourceValue(actor, "hope");
    if (hope < def.hopeCost) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.needHope"));
        return null;
    }

    const target = game.actors.get(targetId);
    if (!target) return null;

    // Paid on this client, resolved on the GM's: with no GM there is nobody
    // to resolve it, and the price would simply be gone (DESP-05). `gmOnline`
    // is the question alone; what is said is the bridge's own sentence for a
    // request with no GM (`sayNotDone`, E31), so it reads as every other does.
    if (!game.user.isGM) {
        const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
        if (!gmOnline()) {
            sayNotDone("monocub.meddle", "noGm", { nothingSpent: true });
            return null;
        }
    }

    /*
     * ASKED BEFORE ANYTHING IS PAID (ACT-12, 17.09).
     *
     * The GM side refuses a Meddle whose target is not a living student in the
     * same room, and it used to find that out after this client had taken the
     * action and the Hope - with nothing said to the Monocub and nothing given
     * back. The GM cannot give it back either: it cannot see that anything was
     * paid, and a refund for an unpaid request is Hope for a forged packet. So
     * the same questions are asked here first, where saying no costs nothing.
     */
    const { sameRoom } = await import("./movement.mjs");
    if (isMonocub(target) || isMonokuma(target) || isDeadForGm(target) || !sameRoom(actor, target)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyHere"));
        return null;
    }

    if (!await spendAction(actor, def.cost)) return null;
    // A price (E29 fix r1-G7): a player's write names only a reason the GMs' audit reads off it
    // (resource-guard.mjs `stampOf`), and it reads this Hope as it reads every price paid.
    await trustedWrite(actor, { "system.resources.hope.value": hope - def.hopeCost }, { reason: "price" });

    // The GM throws the dice and scores them (`meddleOnGm`); its answer is the roll, which the
    // card shows here as this Monocub's. Not answered (refused, no GM, a roll that is not one):
    // nothing to show, and the GM has said why where it refused.
    const { requestMeddleResolve } = await import("./gm-bridge.mjs");
    const res = await requestMeddleResolve({ actorId: actor.id, targetId, help });
    const thrown = res.ok ? res.value : null;
    if (!thrown?.roll) return null;
    const roll = Roll.fromData(thrown.roll);
    const total = Number(thrown.total) || 0;
    const isCritical = thrown.isCritical === true;
    await postMeddleRoll(actor, roll, total, isCritical, help);
    return { roll, total, isCritical };
}

/**
 * A Meddle's dice, thrown and scored on this GM (E08+E28 C17): the flat 2d12 `rollFlat` throws,
 * applied by `scoreMeddle`, answered as the roll (its JSON), the total and the critical, for
 * the Monocub's card. GM-side.
 *
 * ASKED BEFORE THE DICE (E08+E28 fix r2-H7, 05.10.2026; the round-2 review's m6). C17 threw
 * the dice before `resolveMeddle` asked its questions, as 1.2.66's Monocub had, and answered
 * a Meddle it refused all the same - so the Monocub's browser posted a dice card to the room
 * for a Meddle that did nothing (a target gone, dead, in another room). Its questions are
 * asked first now (`meddleRefused`, which tells the Monocub), and a refusal is answered with
 * no roll, so no card is posted.
 */
export async function meddleOnGm({ actorId, targetId, help } = {}) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId);
    const target = game.actors.get(targetId);
    if (!actor || !target || await meddleRefused(actor, target)) return null;
    const { roll, total, isCritical } = await rollFlat();
    await scoreMeddle(actor, target, help, total, isCritical);
    return { roll: roll.toJSON(), total, isCritical };
}

/** Who to Meddle with, and Help or Hinder. The player's own picker. */
export async function meddleDialog(actor) {
    if (!isMonocub(actor)) return null;
    if (await meddleLocked()) return null;

    const targets = await meddleTargets(actor);
    if (!targets.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyHere"));
        return null;
    }

    const options = targets
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: MONOCUB.meddle.label },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Monocub.meddleIntro")}</p>
            <label>${game.i18n.localize("DRPG.Monocub.target")}
                <select name="target">${options}</select></label>
        </form>`),
        buttons: [
            {
                action: "help", label: game.i18n.localize("DRPG.Monocub.help"), default: true,
                callback: (e, b, d) => ({
                    targetId: d.element.querySelector("[name=target]").value, help: true
                })
            },
            {
                action: "hinder", label: game.i18n.localize("DRPG.Monocub.hinder"),
                callback: (e, b, d) => ({
                    targetId: d.element.querySelector("[name=target]").value, help: false
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return performMeddle(actor, result.targetId, result.help);
}

/**
 * The two windows in which Confusion is shut.
 *
 * The Eclipse (CALL-16, 17.09): the Monocub's tile calls `meddleDialog` directly,
 * not through `performAction`, so it missed the guard every action and Call goes
 * through - and the actions refilled when the lights went out could be spent
 * arming advantage and disadvantage before the time of day had started.
 *
 * The Class Trial (T-1, 17.09): Confusion IS the Monocub's Meddle, and Dawid's
 * decision named it beside the Despair Calls. Everything the trial leaves open
 * belongs to the students arguing in it.
 */
async function meddleLocked() {
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.actionsLocked"));
        return true;
    }
    if (getClock().phase === "classTrial") {
        ui.notifications.warn(game.i18n.localize("DRPG.Trial.callsLocked"));
        return true;
    }
    return false;
}

/** Score and apply a Meddle. GM-side: it writes to another player's sheet. */
export async function resolveMeddle({ actorId, targetId, help, total, isCritical } = {}) {
    if (!game.user.isGM) return null;

    const actor = game.actors.get(actorId);
    const target = game.actors.get(targetId);
    if (!actor || !target || await meddleRefused(actor, target)) return null;
    return scoreMeddle(actor, target, help, total, isCritical);
}

/** Is this Meddle refused? Said in the GM's log and to the Monocub where it is (`resolveMeddle`'s questions). */
async function meddleRefused(actor, target) {
    /*
     * Everything `meddleTargets` decides, decided again here.
     *
     * That function runs on the Monocub's own client and builds the picker. This
     * one applies the result to somebody ELSE's sheet - it wastes their action,
     * or arms a Call on it - and it used to apply whatever arrived. A payload
     * naming a target was enough: from any room, at any character, by an actor
     * who was not a Monocub at all or was silenced, as often as they liked, with
     * no action spent because the cost is charged on the picker's side.
     *
     * `sameRoom` rather than `othersInRoom`, for the reason its own comment
     * gives: `othersInRoom` reads the canvas and answers for the client that is
     * looking at it, and this client is a GM who is usually somewhere else.
     */
    const refuse = async why => {
        warn(`Refused a Meddle by ${actor.name}: ${why}.`);
        // Said to the Monocub as well - a refusal only the GM console heard
        // looked, from the sheet, like an action and a Hope that vanished.
        //
        // SAID, NOT REFUNDED (ACT-12). This side cannot see that anything was
        // paid, so a refund here is Hope minted for any packet that names a
        // target in another room. The honest refusals are asked in
        // `performMeddle` before anything is paid; what reaches this line is a
        // world that moved between the two, or a forged request.
        if (isMonocub(actor)) {
            await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Monocub.meddleRefused")}</p>`);
        }
        return true;
    };

    if (!isMonocub(actor)) return refuse("they are not a Monocub");
    // NOT refused for being silenced (ACT-12). The Monocub silence is about
    // discussing the crime scene they stumbled onto, and the GM's own checkbox
    // says so: "they cannot discuss it until the chapter ends, but Confusion
    // still works". This line used to say the opposite.
    //
    // And no Eclipse check here, deliberately (review of CALL-16). The picker and
    // the payment both refuse during an Eclipse; a Meddle paid a moment before one
    // opened and refused here would lose its Hope for good, since the GM side
    // never refunds (ACT-12).
    if (target.id === actor.id) return refuse("you cannot Meddle with yourself");
    if (target.type !== "character") return refuse("the target is not a character");
    if (isMonocub(target)) return refuse("Monocubs do not Meddle with each other");
    if (isMonokuma(target)) return refuse("a Monokuma is not a student");
    if (isDeadForGm(target)) return refuse("the target is dead");

    const { sameRoom } = await import("./movement.mjs");
    if (!sameRoom(actor, target)) return refuse("they are not in the same room");
    return false;
}

/** A Meddle no question refused, scored on `total` and applied. GM-side. */
async function scoreMeddle(actor, target, help, total, isCritical) {
    const def = MONOCUB.meddle;
    const hit = isCritical ? def.critical : resolveThreshold(total, def.thresholds);

    if (!hit) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Monocub.meddleFailed")}</p>`);
        return { success: false };
    }

    const text = help ? hit.help : hit.hinder;
    // The target's own sentence (DESP-06), never the Monocub's receipt.
    const targetText = (help ? hit.helpTarget : hit.hinderTarget) ?? text;

    if (isCritical) {
        if (help) await refundAction(target, 1);
        else await wasteAction(target);
    } else {
        const { armCall } = await import("./call-effects.mjs");
        if (hit.grants === "bonus") {
            await armCall(target, {
                key: "meddle", grants: "bonus", amount: help ? 1 : -1, from: actor.id
            });
        } else {
            await armCall(target, {
                key: "meddle", grants: help ? "advantage" : "disadvantage", from: actor.id
            });
        }
    }

    /*
     * THE SOUND RIDES THE CARDS, and that is what makes it correct here.
     *
     * This function is on the GM's client - `playSfx` would ring the GM's
     * speakers and nobody else's. The flag plays wherever the message lands,
     * and `onCreateChatMessage` keeps GMs out of a whisper that did not ask for
     * them, so these two carry the sound to exactly two people: the Monocub who
     * spent the action, and the student it happened to.
     *
     * IT CANNOT LEAK WHO. A sound has no sender, and both whispers play the
     * same one - the target learns that something reached them, which is what
     * their card already says, and nothing more.
     *
     * AND THE TWO CARDS ARE VEILED (E06 C10, 28.09.2026; audit S09-10). A
     * whisper's list is a field every console reads: two cards with this sound,
     * one to the Monocub's player and one to the target's, posted together, told
     * every browser who used Confusion on whom. The room sees the Monocub's dice
     * (the owner's answer of 27.09: Confusion is seen by the room, like every
     * Monocub roll), and the roll does not say who it was aimed at. Veiled, each
     * card's words and sound reach its own reader alone (secret.mjs), and its
     * document names nobody.
     */
    const meddleSfx = { veiled: true, flags: { [MODULE_ID]: { sfx: "meddle" } } };

    await whisperToOwner(actor, `<p><strong>${game.i18n.format("DRPG.Monocub.meddledOn", {
        name: foundry.utils.escapeHTML(target.name)
    })}</strong></p><p>${foundry.utils.escapeHTML(text)}</p>`, meddleSfx);

    // The target is told SOMETHING happened without being told who - the guide
    // has Monocubs act "z boku" (from the sidelines). Their card does not name
    // the Monocub; the room's view of the dice may, and the Monocub's own
    // window says so (`meddleIntro`, E06 C10).
    await whisperToOwner(target, `<p>${foundry.utils.escapeHTML(targetText)}</p>`, meddleSfx);

    log(`${actor.name} used Meddle on ${target.name}: ${text}`);
    return { success: true, text };
}

/** "Wastes an action" - unconditional, unlike `spendAction`, which can refuse. */
async function wasteAction(actor) {
    const left = actionsLeft(actor);
    if (left <= 0) return;
    await trustedWrite(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: left - 1 }, { reason: "meddle" });
}

/* ==========================================================================
 * GM DIALOGS
 * ========================================================================== */

/** Opt students in or out, hand out Despair-as-Hope, and mark the crime silence. */
export async function openMonocubDialog() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-monocubs")) return null;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const rosterOfDead = () =>
        game.actors.filter(a => a.type === "character" && !isMonokuma(a) && isDeceased(a));
    const dead = rosterOfDead();
    if (!dead.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyDead"));
        return null;
    }

    const { monokumas, donorLabel } = await import("./despair.mjs");
    const gms = monokumas();

    /*
     * A FUNCTION, NOT A STRING (E6).
     *
     * This table used to be built once and then thrown away and rebuilt by
     * closing and reopening the window after every donation - which took the
     * GM's scroll position and every checkbox they had ticked but not yet
     * applied with it. `keepLive` redraws the rows in place instead, so the
     * roster has to be re-read on each pass: a student who died while this was
     * open belongs in it.
     */
    const buildRows = () => rosterOfDead().map(a => {
        const cub = isMonocub(a);
        const hope = cub ? resourceValue(a, "hope") : null;
        const silenced = cub && isSilenced(a);
        // What each pool can spend, and what it owes (E05 C12; despair.mjs `donorLabel`).
        const donors = gms.map(u =>
            `<option value="${u.id}">${foundry.utils.escapeHTML(donorLabel(u))}</option>`
        ).join("");

        return `<tr>
            <td>${foundry.utils.escapeHTML(a.name)}</td>
            <td style="text-align:center">
                <input type="checkbox" name="cub:${a.id}" ${cub ? "checked" : ""}
                       aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Monocub.isOne")}: ${a.name}`)}" /></td>
            <td>${cub ? `${hope} / ${resourceMax(a, "hope")}` : "-"}</td>
            <td>${cub ? `
                <select name="donor:${a.id}">${donors}</select>
                <input type="number" name="amount:${a.id}" min="1" value="1" style="width:3.5em" />
                <button type="button" class="drpg-mini-button" data-drpg-give="${a.id}">
                    ${game.i18n.localize("DRPG.Monocub.give")}</button>` : "-"}</td>
            <td style="text-align:center">${cub ? `
                <input type="checkbox" name="silenced:${a.id}" ${silenced ? "checked" : ""} />` : "-"}</td>
        </tr>`;
    }).join("");

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Monocub.manageTitle") },
        classes: ["drpg-panel", "drpg-window-monocubs"],
        content: dialogContent(`<div>
            <p class="notes">${game.i18n.localize("DRPG.Monocub.dialogIntro")}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Chapter.whoDied")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.isOne")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.hope")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.giveHope")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.silenced")}</th>
            </tr></thead><tbody class="drpg-cub-live">${buildRows()}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Monocub.silencedNote")}</p>
        </div>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (event, button, dialog) => rosterOfDead().map(actor => ({
                    id: actor.id,
                    cub: Boolean(dialog.element.querySelector(`[name="cub:${actor.id}"]`)?.checked),
                    silenced: Boolean(
                        dialog.element.querySelector(`[name="silenced:${actor.id}"]`)?.checked)
                }))
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        // The per-row "give hope" buttons act immediately rather than waiting
        // for Apply: they spend a real Despair pool, and a GM who then cancels
        // the rest of the form should not find that donation undone with it.
        render: (event, dialog) => {
            /*
             * WIRED IN A FUNCTION, because `keepLive` replaces the tbody and
             * every listener on it goes with the nodes. A live table whose
             * buttons stopped working would be worse than a stale one.
             */
            const wireGive = () => {
                for (const btn of dialog.element.querySelectorAll("[data-drpg-give]")) {
                    btn.addEventListener("click", async () => {
                        const id = btn.dataset.drpgGive;
                        const actor = game.actors.get(id);
                        const donorId = dialog.element.querySelector(`[name="donor:${id}"]`)?.value;
                        const amount = Number(
                            dialog.element.querySelector(`[name="amount:${id}"]`)?.value) || 0;
                        if (!actor || !donorId || amount <= 0) return;

                        const { convertDespairToHope } = await import("./despair.mjs");
                        await convertDespairToHope(donorId, actor, amount);
                        // No close and reopen: the donation writes two actors,
                        // `watch.actors` catches it, and the row redraws with
                        // the new numbers under the GM's cursor (E6).
                    });
                }
            };
            wireGive();

            keepLive(dialog, {
                region: ".drpg-cub-live",
                build: buildRows,
                // A pool's debt changes with no actor's write (E05 C12): its store's hook.
                watch: { actors: true, hooks: ["drpgDespairOwedChanged"] },
                after: wireGive
            });
        },
        rejectClose: false
    });

    if (!Array.isArray(result)) return null;

    for (const row of result) {
        const actor = game.actors.get(row.id);
        if (!actor) continue;
        if (row.cub !== isMonocub(actor)) await setMonocub(actor, row.cub);
        if (row.cub && row.silenced !== isSilenced(actor)) await setSilenced(actor, row.silenced);
    }

    return result;
}
