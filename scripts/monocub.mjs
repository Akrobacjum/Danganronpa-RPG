/**
 * Danganronpa RPG — Monocub.
 * ---------------------------------------------------------------------------
 * Guide, p. 16: "Po śmierci, gdy jego class trial się zakończy, gracz może
 * dołączyć do DMów jako Monocub." A dead student's player, opted in by
 * agreement with the table, keeps the same character sheet and gets exactly
 * two things to do with it: Move, and Meddle — nudging a living player's next
 * roll from the sidelines.
 *
 * A Monocub is not a Monokuma. It stays a `character` actor with no special
 * flag on the token, keeps the normal action budget (refilled by the same
 * pass that refills everyone else — nothing to change there), and keeps the
 * same room-restricted vision every other student has. What changes is the
 * action panel on the sheet: Move and Meddle instead of the full grid, and
 * a Hope total that only a GM can top up, by converting their own Despair.
 *
 * MEDDLE'S ROLL. The guide marks its difficulty table "Stat: —" — the one roll
 * in the system with no trait behind it. Daggerheart's own `rollTrait` insists
 * on a real trait key, so this is not built through it: a flat 2d12, crit on
 * doubles, exactly Daggerheart's own duality math with the trait modifier
 * removed. `private-rolls.mjs` already rewrites any chat message carrying a
 * roll into a GM-and-roller whisper regardless of how the roll was built, so
 * this one is private for free.
 *
 * MEDDLE'S EFFECT. Reuses the Call machinery Support and Obstacle already use
 * (`armCall` in call-effects.mjs) rather than inventing a second one. That
 * also means "help a crisis action" costs nothing extra: an incident roll
 * goes through the identical roll dialog, so an armed Meddle bonus applies to
 * it exactly as it would to an ordinary action roll.
 */

import { MODULE_ID, FLAGS, MONOCUB, ACTIONS_RESOURCE } from "./config.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { isDeceased } from "./chapter.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { actionsLeft, spendAction, refundAction } from "./actions.mjs";
import { getClock } from "./clock.mjs";
import { resolveThreshold, dialogContent, whisperToOwner, log, warn, plural, tableDialog } from "./utils.mjs";

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

/** Dead students who could still opt in — Monocub is a choice, not automatic. */
export function eligibleForMonocub() {
    return game.actors.filter(a =>
        a.type === "character" && !isMonokuma(a) && isDeceased(a) && !isMonocub(a));
}

/**
 * Opt somebody into (or out of) being a Monocub. GM only, and only ever on
 * somebody already `isDeceased` — the guide's condition, not this module's
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

    await actor.setFlag(MODULE_ID, FLAGS.monocub, Boolean(value));
    if (!value) await actor.unsetFlag(MODULE_ID, FLAGS.silencedChapter);

    log(`${actor.name} is ${value ? "now" : "no longer"} a Monocub.`);
    ui.notifications.info(game.i18n.format(
        value ? "DRPG.Monocub.opted" : "DRPG.Monocub.unopted", { name: actor.name }));

    actor.sheet?.render(false);
    return actor;
}

/**
 * Mark (or clear) the guide's "stumbled onto the crime" silence.
 *
 * The player is told. This is a restriction on what they may SAY at the table —
 * "otrzymuje zakaz wypowiadania się na temat zbrodni do końca rozdziału" — so a
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
        }</strong> — ${game.i18n.localize(silenced
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
 * exactly right here too — a Monocub Meddles with a fellow student, not with
 * the DMs walking the map as their own Monokumas.
 */
export async function meddleTargets(actor) {
    const { othersInRoom } = await import("./movement.mjs");
    return othersInRoom(actor).filter(a => !isMonocub(a) && !isDeceased(a));
}

/**
 * Put the Meddle roll in chat, without Daggerheart's damage buttons.
 *
 * `Roll#toMessage` leaves `content` empty, so the message renders through the
 * system's own `foundryRoll.hbs` — and that template appends "Deal damage" and
 * "Apply healing" to EVERY plain roll it draws. Meddle is neither: it nudges
 * somebody's next roll. The buttons were live, aimed at whatever token happened
 * to be targeted, and there was nothing about the action they could correctly do.
 *
 * Writing our own `content` takes that template out of the path entirely — the
 * message renders what we give it. `rolls` is still populated, so Dice So Nice
 * animates the dice exactly as before, and `private-rolls.mjs` still sees a roll
 * to make private.
 */
async function postMeddleRoll(actor, roll, total, isCritical, help) {
    const label = `${MONOCUB.meddle.label} — ${
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

/** A flat 2d12: Daggerheart's own duality math with no trait behind it. */
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
 * budget and a point of Hope on top — both spent here, on the Monocub's own
 * actor, which the acting player already owns.
 */
export async function performMeddle(actor, targetId, help) {
    if (!isMonocub(actor)) return null;

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

    if (!await spendAction(actor, def.cost)) return null;
    await automatedUpdate(actor, { "system.resources.hope.value": hope - def.hopeCost });

    const { roll, total, isCritical } = await rollFlat();
    await postMeddleRoll(actor, roll, total, isCritical, help);

    const { requestMeddleResolve } = await import("./gm-bridge.mjs");
    await requestMeddleResolve({ actorId: actor.id, targetId, help, total, isCritical });

    return { roll, total, isCritical };
}

/** Who to Meddle with, and Help or Hinder. The player's own picker. */
export async function meddleDialog(actor) {
    if (!isMonocub(actor)) return null;

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
            <label>${game.i18n.localize("DRPG.Monocub.who")}
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

/** Score and apply a Meddle. GM-side: it writes to another player's sheet. */
export async function resolveMeddle({ actorId, targetId, help, total, isCritical } = {}) {
    if (!game.user.isGM) return null;

    const actor = game.actors.get(actorId);
    const target = game.actors.get(targetId);
    const def = MONOCUB.meddle;
    if (!actor || !target) return null;

    /*
     * Everything `meddleTargets` decides, decided again here.
     *
     * That function runs on the Monocub's own client and builds the picker. This
     * one applies the result to somebody ELSE's sheet — it wastes their action,
     * or arms a Call on it — and it used to apply whatever arrived. A payload
     * naming a target was enough: from any room, at any character, by an actor
     * who was not a Monocub at all or was silenced, as often as they liked, with
     * no action spent because the cost is charged on the picker's side.
     *
     * `sameRoom` rather than `othersInRoom`, for the reason its own comment
     * gives: `othersInRoom` reads the canvas and answers for the client that is
     * looking at it, and this client is a GM who is usually somewhere else.
     */
    const refuse = why => {
        warn(`Refused a Meddle by ${actor.name}: ${why}.`);
        return null;
    };

    if (!isMonocub(actor)) return refuse("they are not a Monocub");
    if (isSilenced(actor)) return refuse("they are silenced this chapter");
    if (target.id === actor.id) return refuse("you cannot Meddle with yourself");
    if (target.type !== "character") return refuse("the target is not a character");
    if (isMonocub(target)) return refuse("Monocubs do not Meddle with each other");
    if (isMonokuma(target)) return refuse("a Monokuma is not a student");
    if (isDeceased(target)) return refuse("the target is dead");

    const { sameRoom } = await import("./movement.mjs");
    if (!sameRoom(actor, target)) return refuse("they are not in the same room");

    const hit = isCritical ? def.critical : resolveThreshold(total, def.thresholds);

    if (!hit) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Monocub.meddleFailed")}</p>`);
        return { success: false };
    }

    const text = help ? hit.help : hit.hinder;

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
     * This function is on the GM's client — `playSfx` would ring the GM's
     * speakers and nobody else's. The flag plays wherever the message lands,
     * and `onCreateChatMessage` keeps GMs out of a whisper that did not ask for
     * them, so these two carry the sound to exactly two people: the Monocub who
     * spent the action, and the student it happened to.
     *
     * IT CANNOT LEAK WHO. A sound has no sender, and both whispers play the
     * same one — the target learns that something reached them, which is what
     * their card already says, and nothing more.
     */
    const meddleSfx = { flags: { [MODULE_ID]: { sfx: "meddle" } } };

    await whisperToOwner(actor, `<p><strong>${game.i18n.format("DRPG.Monocub.meddledOn", {
        name: foundry.utils.escapeHTML(target.name)
    })}</strong></p><p>${foundry.utils.escapeHTML(text)}</p>`, meddleSfx);

    // The target is told SOMETHING happened without being told who — the guide
    // has Monocubs act "z boku" (from the sidelines); knowing which dead
    // classmate is pulling the strings is not part of that.
    await whisperToOwner(target, `<p>${foundry.utils.escapeHTML(text)}</p>`, meddleSfx);

    log(`${actor.name} used Meddle on ${target.name}: ${text}`);
    return { success: true, text };
}

/** "Wastes an action" — unconditional, unlike `spendAction`, which can refuse. */
async function wasteAction(actor) {
    const left = actionsLeft(actor);
    if (left <= 0) return;
    await automatedUpdate(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: left - 1 });
}

/* ==========================================================================
 * GM DIALOGS
 * ========================================================================== */

/** Opt students in or out, hand out Despair-as-Hope, and mark the crime silence. */
export async function openMonocubDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const dead = game.actors.filter(a => a.type === "character" && !isMonokuma(a) && isDeceased(a));
    if (!dead.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Monocub.nobodyDead"));
        return null;
    }

    const { monokumas, poolLabel, getDespair } = await import("./despair.mjs");
    const gms = monokumas();

    const rows = dead.map(a => {
        const cub = isMonocub(a);
        const hope = cub ? resourceValue(a, "hope") : null;
        const silenced = cub && isSilenced(a);
        const donors = gms.map(u =>
            `<option value="${u.id}">${foundry.utils.escapeHTML(poolLabel(u))} (${getDespair(u.id)})</option>`
        ).join("");

        return `<tr>
            <td>${foundry.utils.escapeHTML(a.name)}</td>
            <td style="text-align:center">
                <input type="checkbox" name="cub:${a.id}" ${cub ? "checked" : ""} /></td>
            <td>${cub ? `${hope} / ${resourceMax(a, "hope")}` : "—"}</td>
            <td>${cub ? `
                <select name="donor:${a.id}">${donors}</select>
                <input type="number" name="amount:${a.id}" min="1" value="1" style="width:3.5em" />
                <button type="button" class="drpg-mini-button" data-drpg-give="${a.id}">
                    ${game.i18n.localize("DRPG.Monocub.give")}</button>` : "—"}</td>
            <td style="text-align:center">${cub ? `
                <input type="checkbox" name="silenced:${a.id}" ${silenced ? "checked" : ""} />` : "—"}</td>
        </tr>`;
    }).join("");

    const result = await tableDialog({
        window: { title: game.i18n.localize("DRPG.Monocub.manageTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<div>
            <p class="notes">${game.i18n.localize("DRPG.Monocub.dialogIntro")}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Chapter.whoDied")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.isOne")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.hope")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.giveHope")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.silenced")}</th>
            </tr></thead><tbody>${rows}</tbody></table>
            <p class="notes">${game.i18n.localize("DRPG.Monocub.silencedNote")}</p>
        </div>`),
        buttons: [
            {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"), default: true,
                callback: (event, button, dialog) => dead.map(actor => ({
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
            for (const btn of dialog.element.querySelectorAll("[data-drpg-give]")) {
                btn.addEventListener("click", async () => {
                    const id = btn.dataset.drpgGive;
                    const actor = game.actors.get(id);
                    const donorId = dialog.element.querySelector(`[name="donor:${id}"]`)?.value;
                    const amount = Number(dialog.element.querySelector(`[name="amount:${id}"]`)?.value) || 0;
                    if (actor && donorId && amount > 0) {
                        const { convertDespairToHope } = await import("./despair.mjs");
                        await convertDespairToHope(donorId, actor, amount);
                        await dialog.close();
                        await openMonocubDialog();
                    }
                });
            }
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
