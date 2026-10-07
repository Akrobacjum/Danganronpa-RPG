/**
 * Danganronpa RPG - Monocub.
 * ---------------------------------------------------------------------------
 * Guide, p. 16: "Po śmierci, gdy jego class trial się zakończy, gracz może
 * dołączyć do DMów jako Monocub." A dead student's player, opted in by
 * agreement with the table, keeps the same character sheet and gets exactly
 * two things to do with it: Move, and Meddle - nudging a living player's next
 * roll from the sidelines. Meddle is one row of `MONOCUB.abilities` (E33 C10): the
 * table and its executor are under THE ABILITIES below.
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
 * roll's build), so the GM throws this one itself where it scores it (`cubAbilityOnGm`),
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

    const was = isCrimeSilenced(actor);
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

/**
 * The crime-witness marker: is the chapter `setSilenced` stamped on the actor this one?
 * Information only - it refuses nothing (a witness's Confusion lands, ACT-12) and mutes
 * nothing; whether a Monocub keeps quiet is the player's own business (the owner, 05.10.2026).
 * Named `isCrimeSilenced` since 1.2.69 (E33 C9, D39): until then this and the Despair Call's
 * reader in call-effects.mjs shared one bare name, and sheet.mjs renamed them at its door.
 * The alias in api.mjs still answers this question under that old name, so a macro
 * reads what it read.
 */
export function isCrimeSilenced(actor) {
    const chapter = actor?.getFlag(MODULE_ID, FLAGS.silencedChapter);
    return typeof chapter === "number" && chapter === getClock().chapter;
}

/* ==========================================================================
 * THE ABILITIES (E33 C10, 07.10.2026; audit S09-48, decision D39)
 * --------------------------------------------------------------------------
 * One ability lived in three files (this one, gm-bridge.mjs's one action for it,
 * sheet.mjs `meddleButton`), so a second one would have been a fourth copy of
 * every question: who may use it, when it is shut, whom it is aimed at, what is
 * thrown, how it is scored. Each ability is a ROW of `MONOCUB.abilities`
 * (config.mjs), and the rows are data: a row names its behaviour by key, and
 * the four tables below hold the behaviour - `CUB_LOCKS` (the windows it is shut
 * in: asked on the picker and before paying, never on the GM, CALL-16),
 * `CUB_TARGETS` (whom it may be aimed at: asked on the picker and again on the
 * GM), `CUB_ROLLS` (what the GM throws) and `CUB_RESOLVERS` (how the GM's own
 * throw is scored and applied). One executor (`performCubAbility`), one picker
 * (`cubAbilityDialog`), one bridge action (`monocub.ability`, gm-bridge.mjs) and
 * one GM-side run (`cubAbilityOnGm`). A second ability is one row and one
 * resolver; the fields the 1.4.0 rework adds (phases, caps, a GM-side payment)
 * are E67's. R301 holds every row to these tables.
 *
 * The Despair-to-Hope exchange itself lives in despair.mjs: a Mastermind
 * needs the exact same trade (see mastermind.mjs), and duplicating a function
 * that moves real Despair out of a real pool is how the two copies quietly
 * drift apart. Import it, do not rebuild it.
 * ========================================================================== */

/** The row of `MONOCUB.abilities` under `key`, or null for a key that is no ability (a packet's `key` is a claim). */
export function abilityRow(key) {
    return typeof key === "string" && Object.hasOwn(MONOCUB.abilities, key) ? MONOCUB.abilities[key] : null;
}

/**
 * The windows an ability is shut in, by the key a row's `locks` names.
 *
 * The Eclipse (CALL-16, 17.09): the Monocub's tile opens the picker directly, not
 * through `performAction`, so it missed the guard every action and Call goes
 * through - and the actions refilled when the lights went out could be spent
 * arming advantage and disadvantage before the time of day had started.
 *
 * The Class Trial (T-1, 17.09): Confusion IS the Monocub's Meddle, and Dawid's
 * decision named it beside the Despair Calls. Everything the trial leaves open
 * belongs to the students arguing in it.
 *
 * Asked on the picker and before paying, NEVER on the GM (review of CALL-16): an
 * ability paid a moment before a window shut and refused there would lose its Hope
 * for good, since the GM side never refunds (ACT-12). The crime-witness marker is
 * no lock (ACT-12; the owner's option B, 05.10.2026): a witness's Confusion lands.
 */
export const CUB_LOCKS = Object.freeze({
    eclipse: { shut: async () => (await import("./eclipse.mjs")).isEclipse(), say: "DRPG.Eclipse.actionsLocked" },
    classTrial: { shut: async () => getClock().phase === "classTrial", say: "DRPG.Trial.callsLocked" }
});

/** The first of the row's locks that is shut, said; null when none is. A lock the table does not know is shut. */
async function lockRefusal(row) {
    for (const key of row.locks ?? []) {
        const lock = CUB_LOCKS[key];
        if (lock && !await lock.shut()) continue;
        ui.notifications.warn(game.i18n.localize(lock?.say ?? "DRPG.Monocub.cannotMeddle"));
        return key;
    }
    return null;
}

/**
 * Whom an ability may be aimed at, by the key a row's `target` names. `list` builds
 * the picker on the Monocub's browser; `refuses` answers why this target is not one,
 * or null - asked of the picker's answer before anything is paid, and again on the GM.
 */
export const CUB_TARGETS = Object.freeze({
    /**
     * A living student in the Monocub's room. `list`: `othersInRoom` already excludes
     * Monokumas and hidden tokens, which is exactly right here too - a Monocub Meddles
     * with a fellow student, not with the DMs walking the map as their own Monokumas.
     * `refuses`: `sameRoom` rather than `othersInRoom`, for the reason its own comment
     * gives - `othersInRoom` reads the canvas and answers for the client that is
     * looking at it, and the GM asking it is usually somewhere else.
     */
    roomStudent: {
        async list(actor) {
            const { othersInRoom } = await import("./movement.mjs");
            return othersInRoom(actor).filter(a => !isMonocub(a) && !isDeadForGm(a));
        },
        async refuses(actor, target) {
            if (!target || target.type !== "character") return "the target is not a character";
            if (target.id === actor.id) return "you cannot Meddle with yourself";
            if (isMonocub(target)) return "Monocubs do not Meddle with each other";
            if (isMonokuma(target)) return "a Monokuma is not a student";
            if (isDeadForGm(target)) return "the target is dead";
            const { sameRoom } = await import("./movement.mjs");
            if (!sameRoom(actor, target)) return "they are not in the same room";
            return null;
        }
    }
});

/** Who the ability under `key` could be aimed at from where this Monocub stands: the picker's list. */
export async function cubTargets(actor, key) {
    const row = abilityRow(key);
    return row ? CUB_TARGETS[row.target].list(actor) : [];
}

/** A flat 2d12: Daggerheart's own duality math with no trait behind it. Thrown on the GM (`cubAbilityOnGm`). */
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

/** What the GM throws for an ability, by the key a row's `roll` names: `{ roll, total, isCritical }`. */
export const CUB_ROLLS = Object.freeze({ flat2d12: rollFlat });

/**
 * Why this ability is not one this character may ask for now, or null: the row (a
 * key is a packet's claim), the Monocub, the choice. Asked on the Monocub's browser
 * before anything is paid, by the bridge's guard before the run
 * (bridge-guards.mjs `guardCubAbility`), and on the GM once more (`cubAbilityOnGm`,
 * which a GM's own browser reaches with no guard in front of it). Not asked here:
 * the locks (`lockRefusal`, the picker's and the payment's only) and the target
 * (`CUB_TARGETS`, asked by the run with the world as the GM holds it).
 */
export function cubAbilityRefusal(actor, key, choice) {
    const row = abilityRow(key);
    if (!row) return `no such Monocub ability: ${key}`;
    if (!actor || !isMonocub(actor)) return "that character is not a Monocub";
    if (!row.choices.includes(choice)) return `"${choice}" is not a choice of that ability`;
    return null;
}

/**
 * Put an ability's roll in chat, without Daggerheart's damage buttons.
 *
 * `Roll#toMessage` leaves `content` empty, so the message renders through the
 * system's own `foundryRoll.hbs` - and that template appends "Deal damage" and
 * "Apply healing" to EVERY plain roll it draws. Confusion is neither: it nudges
 * somebody's next roll. The buttons were live, aimed at whatever token happened
 * to be targeted, and there was nothing about the action they could correctly do.
 *
 * Writing our own `content` takes that template out of the path entirely - the
 * message renders what we give it. `rolls` is still populated, so Dice So Nice
 * animates the dice exactly as before, and `private-rolls.mjs` still sees a roll
 * to make private.
 */
async function postCubRoll(actor, row, roll, total, isCritical, choice) {
    const label = `${row.label} - ${game.i18n.localize(`DRPG.Monocub.${choice}`)}`;

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

/**
 * THE ONE EXECUTOR: a Monocub uses the ability under `key`, aimed as the picker
 * answered (`{ targetId, choice }`). The row's price is an action from the normal
 * budget (`cost`) and Hope on top (`hopeCost`) - both spent here, on the Monocub's
 * own actor, which the acting player already owns; the dice are the GM's.
 */
export async function performCubAbility(actor, key, { targetId, choice } = {}) {
    const row = abilityRow(key);
    if (!row || cubAbilityRefusal(actor, key, choice)) return null;
    if (await lockRefusal(row)) return null;

    if (actionsLeft(actor) < row.cost) {
        ui.notifications.warn(plural("DRPG.Actions.notEnough", {
            actor: actor.name, left: actionsLeft(actor), needed: row.cost
        }, "left"));
        return null;
    }
    const hope = resourceValue(actor, "hope");
    if (hope < row.hopeCost) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.needHope"));
        return null;
    }

    // Paid on this client, resolved on the GM's: with no GM there is nobody
    // to resolve it, and the price would simply be gone (DESP-05). `gmOnline`
    // is the question alone; what is said is the bridge's own sentence for a
    // request with no GM (`sayNotDone`, E31), so it reads as every other does.
    if (!game.user.isGM) {
        const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
        if (!gmOnline()) {
            sayNotDone("monocub.ability", "noGm", { nothingSpent: true });
            return null;
        }
    }

    /*
     * ASKED BEFORE ANYTHING IS PAID (ACT-12, 17.09).
     *
     * The GM side refuses an ability whose target the row's rule turns away, and
     * it used to find that out after this client had taken the action and the Hope
     * - with nothing said to the Monocub and nothing given back. The GM cannot give
     * it back either: it cannot see that anything was paid, and a refund for an
     * unpaid request is Hope for a forged packet. So the same question is asked
     * here first, where saying no costs nothing.
     */
    if (await CUB_TARGETS[row.target].refuses(actor, game.actors.get(targetId))) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyHere"));
        return null;
    }

    if (!await spendAction(actor, row.cost)) return null;
    // A price (E29 fix r1-G7): a player's write names only a reason the GMs' audit reads off it
    // (resource-guard.mjs `stampOf`), and it reads this Hope as it reads every price paid.
    if (row.hopeCost > 0) {
        await trustedWrite(actor, { "system.resources.hope.value": hope - row.hopeCost }, { reason: "price" });
    }

    // The GM throws the dice and scores them (`cubAbilityOnGm`); its answer is the roll, which the
    // card shows here as this Monocub's. Not answered (refused, no GM, a roll that is not one):
    // nothing to show, and the GM has said why where it refused.
    const { requestCubAbility } = await import("./gm-bridge.mjs");
    const res = await requestCubAbility({ actorId: actor.id, key, targetId, choice });
    const thrown = res.ok ? res.value : null;
    if (!thrown?.roll) return null;
    const roll = Roll.fromData(thrown.roll);
    const total = Number(thrown.total) || 0;
    const isCritical = thrown.isCritical === true;
    await postCubRoll(actor, row, roll, total, isCritical, choice);
    return { roll, total, isCritical };
}

/**
 * An ability's dice, thrown and scored on this GM (E08+E28 C17): the row's `roll`
 * thrown, its `resolve` applied to the GM's own throw, answered as the roll (its
 * JSON), the total and the critical, for the Monocub's card. GM-side. The packet's
 * `key`, `targetId` and `choice` are claims: the row, the Monocub and the choice are
 * asked again (`cubAbilityRefusal`), and the target of the row's rule with the world
 * as this GM holds it (`CUB_TARGETS`) - a packet naming a target in another room, or
 * a sender who stopped being a Monocub, is refused here whatever the picker saw.
 *
 * ASKED BEFORE THE DICE (E08+E28 fix r2-H7, 05.10.2026; the round-2 review's m6). C17
 * threw the dice before it asked its questions, and answered a Meddle it refused all
 * the same - so the Monocub's browser posted a dice card to the room for a Meddle
 * that did nothing. A refusal is answered with no roll, so no card is posted.
 *
 * SAID, NOT REFUNDED (ACT-12). This side cannot see that anything was paid, so a
 * refund here is Hope minted for any packet that names a target in another room.
 * The honest refusals are asked in `performCubAbility` before anything is paid;
 * what reaches a refusal here is a world that moved between the two, or a forged
 * request. The refusal is logged on the GM and whispered to the Monocub - one only
 * the GM console heard looked, from the sheet, like an action and a Hope that
 * vanished. No lock is asked here (CALL-16): a Meddle paid a moment before an
 * Eclipse opened lands.
 */
export async function cubAbilityOnGm({ actorId, key, targetId, choice } = {}) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId);
    const row = abilityRow(key);
    const target = game.actors.get(targetId);
    const why = cubAbilityRefusal(actor, key, choice) ?? await CUB_TARGETS[row.target].refuses(actor, target);
    if (why) {
        warn(`Refused a Monocub's "${key}" by ${actor?.name ?? actorId}: ${why}.`);
        if (isMonocub(actor)) {
            await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Monocub.meddleRefused")}</p>`);
        }
        return null;
    }
    const { roll, total, isCritical } = await CUB_ROLLS[row.roll]();
    await CUB_RESOLVERS[row.resolve](actor, target, choice, total, isCritical, row);
    return { roll: roll.toJSON(), total, isCritical };
}

/** Whom to aim the ability under `key` at, and which of the row's choices. The player's own picker. */
export async function cubAbilityDialog(actor, key) {
    const row = abilityRow(key);
    if (!row || !isMonocub(actor)) return null;
    if (await lockRefusal(row)) return null;

    const targets = await CUB_TARGETS[row.target].list(actor);
    if (!targets.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyHere"));
        return null;
    }

    const options = targets
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    const result = await DialogV2.wait({
        window: { title: row.label },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Monocub.meddleIntro")}</p>
            <label>${game.i18n.localize("DRPG.Monocub.target")}
                <select name="target">${options}</select></label>
        </form>`),
        buttons: [
            // One button per choice of the row, the first the default; their labels are
            // `DRPG.Monocub.<choice>` (R1's LITERAL_KEYS names the two the table has).
            ...row.choices.map((choice, i) => ({
                action: choice, label: game.i18n.localize(`DRPG.Monocub.${choice}`), default: i === 0,
                callback: (e, b, d) => ({
                    targetId: d.element.querySelector("[name=target]").value, choice
                })
            })),
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return performCubAbility(actor, key, result);
}

/**
 * Score and apply a Meddle the GM threw: `choice` is "help" or "hinder", `total` and
 * `isCritical` the GM's own dice. The row's thresholds decide the tier. GM-side: it
 * writes to another player's sheet.
 */
async function scoreMeddle(actor, target, choice, total, isCritical, row) {
    const help = choice === "help";
    const hit = isCritical ? row.critical : resolveThreshold(total, row.thresholds);

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

/**
 * How the GM's own throw is scored and applied, by the key a row's `resolve` names:
 * `(actor, target, choice, total, isCritical, row)`. A second ability is one row and
 * one entry here.
 */
export const CUB_RESOLVERS = Object.freeze({ meddle: scoreMeddle });

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
        const silenced = cub && isCrimeSilenced(a);
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
        if (row.cub && row.silenced !== isCrimeSilenced(actor)) await setSilenced(actor, row.silenced);
    }

    return result;
}
