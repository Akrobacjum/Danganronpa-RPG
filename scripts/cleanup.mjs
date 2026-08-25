/**
 * Danganronpa RPG — Stage 6, the killer cleaning up.
 * ---------------------------------------------------------------------------
 * Guide: once the incident is over the killer can finally see the Remnants they
 * left, and spend Stress trying to make them go away. "Przedmioty sprzątające
 * ułatwiają rozwiązanie morderstwa" — this is the stage the Cleaning Tool exists
 * for.
 *
 * Until now the module wrote `stage: "resolution"` and stopped. Everything the
 * stage needed was already modelled and unused: the `reinforced` flag on a
 * Remnant is documented in remnants.mjs as "cannot be removed by the killer in
 * Stage 6", `resolution` is a real Remnant type described as "left by the
 * killer's mistakes while cleaning up the scene", `RESOLUTION_STRESS_COST` is
 * declared, and `removeRemnant` refuses reinforced traces on its own. There was
 * simply nothing that called any of it. This is the missing half.
 *
 * WHY THE SCORING RUNS ON THE GM'S CLIENT. Same reason as Observe (see
 * observe.mjs): the threshold comes from how visible the trace is, which is a
 * flag on a hidden token — and Foundry ships every token to every client, so the
 * killer's own browser physically holds the answer. Their client picks a target
 * and throws the dice; the number travels here, and the verdict, the deletion
 * and the new trace are all produced on this side.
 *
 * WHAT IS NOT AUTOMATED. Whether the killer is standing in the right room, and
 * whether Stage 6 has gone on long enough — both the GM's, as everywhere else in
 * murder.mjs. This owns the numbers and the tokens.
 */

import { MODULE_ID, CLEANUP, RESOLUTION_STRESS_COST } from "./config.mjs";
import { murderState, killerIds } from "./murder.mjs";
import {
    REMNANT_FLAGS, remnantsInRoom, remnantData, removeRemnant, dropRemnant
} from "./remnants.mjs";
import { roomOfToken } from "./movement.mjs";
import { equippedIn } from "./use-items.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { ITEM_FLAGS } from "./inventory.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { whisperToGms, whisperToOwner, log, error } from "./utils.mjs";

/* ==========================================================================
 * WHO MAY CLEAN, AND WHAT
 * ========================================================================== */

/** Is a clean-up possible at all right now? */
export function isResolutionStage() {
    return murderState()?.stage === "resolution";
}

/**
 * WHY this actor cannot clean, or null if they can.
 *
 * Four different situations used to collapse into one refusal — "You are not
 * the one cleaning up this scene" — and only one of them was that. A killer
 * standing over a body they had just killed with the GM's death tool was told
 * the scene was not theirs, which sent the GM looking for the wrong problem
 * entirely: the truth was that the incident had never reached Stage 6.
 *
 * Role reversal can have swapped the two sides mid-incident, so the killer is
 * read from the state rather than remembered from who opened the murder — the
 * person who ends up cleaning is whoever the state calls the killer when the
 * fight stopped.
 *
 * @returns {"noIncident"|"notYet"|"notYours"|"monokuma"|null}
 */
export function cleanupBlocker(actor) {
    const state = murderState();
    if (!state?.active) return "noIncident";
    if (state.stage !== "resolution") return "notYet";
    // Both of them, when there are two. An accomplice who joined the killers
    // during the incident stood in the room while it happened and leaves traces
    // of their own — refusing them the clean-up screen meant half a crime scene
    // could never be touched, and the accomplice was told "this is not your
    // scene to clean" about a murder they had just taken part in.
    if (!killerIds(state).includes(actor?.id)) return "notYours";
    // Guide, p. 26: "Jeśli Monokuma jest zabójcą, to nie ma on możliwości
    // sprzątania miejsca zbrodni - nie chce tego robić." A Monokuma who kills
    // is making a point, not covering their tracks.
    if (isMonokuma(actor)) return "monokuma";
    return null;
}

/** The killer of the incident currently in Stage 6, if this is them. */
export function isCleaner(actor) {
    return cleanupBlocker(actor) === null;
}

/** Is the victim's body in the same room as this killer? Read by the sheet. */
export function bodyIsHere(actor) {
    const victim = game.actors.get(murderState()?.victimId ?? "");
    if (!victim) return false;
    const mine = locate(actor);
    const theirs = locate(victim);
    return Boolean(mine?.room) && mine.room === theirs?.room;
}

/** Say which of the four it is, and refuse. @returns {null} always. */
function refuseCleanup(actor) {
    ui.notifications.warn(game.i18n.localize(
        `DRPG.Cleanup.blocked.${cleanupBlocker(actor) ?? "notYours"}`));
    return null;
}

/**
 * Every trace in the killer's own room that a clean-up could be aimed at.
 *
 * Reinforced ones are INCLUDED and marked, not filtered out. A killer who can
 * see the smear they cannot get rid of is being told something true and
 * important about their case; silently omitting it would read as "there is
 * nothing else here".
 *
 * @returns {Array<{token: TokenDocument, data: object, dc: number|null}>}
 */
export function cleanableRemnants(actor, where = null) {
    if (!actor) return [];

    const spot = where ?? locate(actor);
    if (!spot?.room) return [];

    return remnantsInRoom(spot.room, spot.scene)
        .map(token => {
            const data = remnantData(token);
            if (!data) return null;
            return { token, data, dc: data.reinforced ? null : cleanupDc(data.visibility, actor) };
        })
        .filter(Boolean)
        // Reinforced last: they are the ones that cannot be acted on.
        .sort((a, b) => {
            if (a.data.reinforced !== b.data.reinforced) return a.data.reinforced ? 1 : -1;
            return (a.dc ?? 0) - (b.dc ?? 0);
        });
}

/**
 * What a killer's own client may know about a trace: which one it is, a label
 * built from what Stage 6 already lets them see, and whether it can be acted
 * on at all. GM-side only — this is the function `requestCleanableTraces` (in
 * gm-bridge.mjs) actually calls, on behalf of a killer's client that cannot
 * run `cleanableRemnants` itself and get anything back from it.
 *
 * The DC (`cleanupDc`) and `tiedToCrime` never leave this function — that is
 * the answer key `openCleanupDialog` used to have no business rendering
 * client-side and now has no way to, because it never receives them. Only the
 * label is built from `visibilityLabel`/`typeLabel`, which the guide already
 * gives the killer at Stage 6 — see the note on `openCleanupDialog`.
 */
export function cleanableTracesForPlayer(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return [];

    return cleanableRemnants(actor).map(t => ({
        id: t.token.id,
        label: [
            `${t.data.visibilityLabel} ${t.data.typeLabel}`,
            t.data.reinforced ? game.i18n.localize("DRPG.Cleanup.reinforcedFlag") : null
        ].filter(Boolean).join(" · "),
        reinforced: Boolean(t.data.reinforced)
    }));
}

/**
 * Where this character is standing: scene, token AND room.
 *
 * The room is the whole point — `cleanableRemnants` filters on it — and the
 * first version of this returned only the scene and the token, so every caller
 * bailed on `if (!spot?.room)` and Stage 6 listed nothing for anybody, ever.
 *
 * `roomOfToken` rather than `roomOfActor`: the latter only sees the scene the
 * client is currently looking at, and this runs on a GM who is very often
 * looking somewhere else entirely.
 *
 * Synchronous, so the sheet and the tracker can build a list without awaiting.
 */
function locate(actor) {
    const active = actor?.getActiveTokens?.()?.[0]?.document;
    if (active?.parent) {
        return { scene: active.parent, tokenDoc: active, room: roomOfToken(active) };
    }

    for (const scene of game.scenes) {
        const tokenDoc = scene.tokens.find(t => t.actorId === actor?.id);
        if (tokenDoc) return { scene, tokenDoc, room: roomOfToken(tokenDoc) };
    }
    return null;
}

/**
 * How hard this trace is to erase, with the tool in hand taken off the top.
 *
 * Only an EQUIPPED Cleaning Tool counts, matching the weapon rule in murder.mjs:
 * the guide's tools are objects in a hand, not entries on an inventory list.
 */
export function cleanupDc(visibility, actor) {
    const base = CLEANUP.dc[visibility];
    if (base === undefined) return null;
    if (!CLEANUP.toolTierReducesDc) return base;
    return Math.max(0, base - cleaningTier(actor));
}

/** The tier of the readied Cleaning Tool, or 0 for bare hands. */
export function cleaningTier(actor) {
    const tool = equippedIn(actor, "cleaningTool");
    if (!tool) return 0;
    return Number(tool.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? 0);
}

export function cleaningTool(actor) {
    return equippedIn(actor, "cleaningTool");
}

/** One Remnant token by id, from whichever scene it is on. */
function findRemnantToken(tokenId) {
    if (!tokenId) return null;
    for (const scene of game.scenes) {
        const token = scene.tokens.get(tokenId);
        if (token) return token;
    }
    return null;
}

/* ==========================================================================
 * THE ROLL — player side
 * ========================================================================== */

/**
 * Attempt to erase one trace.
 *
 * Costs Stress rather than an action, as the guide has it: Stage 6 is not part
 * of the day's economy, and a killer with nothing left to give simply cannot
 * keep scrubbing. Refused before the dice when there is no Stress to spend, so
 * nobody rolls for something they cannot pay for.
 *
 * The threshold is not computed here and never travels to this client — see the
 * note at the top of the file. What goes over the socket is which token was
 * aimed at and what the dice said.
 */
export async function attemptCleanup(actor, tokenId) {
    if (!actor || !tokenId) return null;

    if (!isCleaner(actor)) return refuseCleanup(actor);
    if (resourceValue(actor, "stress") >= resourceMax(actor, "stress")) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.noStressLeft"));
        return null;
    }
    if (!await spendResolutionAction(actor)) return null;

    // Somebody is watching. Cover it before you do it — and learn the answer
    // while there is still a choice about how to behave afterwards.
    if (!await concealFromWitnesses(actor)) return null;

    const { rollTrait } = await import("./action-rolls.mjs");
    const calls = await import("./call-effects.mjs");

    // The tool in hand is worth advantage on top of the threshold it lowers —
    // the guide's "ułatwiają" applied to both halves of "easier".
    const tool = cleaningTool(actor);
    if (CLEANUP.toolAdvantage && tool) calls.armSituational(1);

    let roll;
    try {
        roll = await rollTrait(actor, CLEANUP.traits[0], {
            actionKey: "cleanup", context: { cleanup: tokenId },
            title: game.i18n.localize("DRPG.Cleanup.action")
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return null;

    const { requestCleanup } = await import("./gm-bridge.mjs");
    await requestCleanup({
        actorId: actor.id,
        tokenId,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope)
    });

    return { roll };
}

/* ==========================================================================
 * THE VERDICT — GM side
 * ========================================================================== */

/**
 * Score one clean-up attempt and apply it.
 *
 * @param {object} options
 * @param {string} options.actorId
 * @param {string} options.tokenId  The Remnant token being wiped.
 * @param {number} options.total
 * @param {boolean} [options.isCritical]
 * @param {boolean} [options.withHope]
 */
export async function resolveCleanup({
    actorId, tokenId, total, isCritical = false, withHope = false, undo = false
} = {}) {
    if (!game.user.isGM) return null;

    const actor = game.actors.get(actorId);
    if (!actor) return null;
    if (!isCleaner(actor)) return null;

    // A Reroll: put the scene back the way it was before scoring the new number,
    // or the second attempt would be measured against a room the first one had
    // already changed — and the Stress would be charged twice for one attempt.
    //
    // A rewind that could not happen aborts the replay rather than scoring on
    // top of the first attempt. `undoLastCleanup` has already told the GMs what
    // to put right by hand.
    if (undo && !await undoLastCleanup(actor, tokenId)) return null;

    // Searched across every scene rather than only the one the killer is
    // standing on. The two are the same in the normal case, and are NOT the same
    // if the killer's token was moved between picking a trace and the dice
    // landing — where scoping to their current scene would report the trace as
    // vanished and charge them for it.
    const token = findRemnantToken(tokenId);
    const data = token ? remnantData(token) : null;
    if (!data) {
        // The trace is gone — another attempt got it, or the GM removed it by
        // hand between the player picking and the dice landing. The Stress is
        // still spent: they scrubbed at something.
        await spendStress(actor);
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Cleanup.vanished")}</p>`);
        return { removed: false, gone: true };
    }

    // Reinforced traces refuse to be removed at all — remnants.mjs has said so
    // since the flag was introduced. Checked here as well as there so the Stress
    // is not taken for an attempt that was never possible.
    if (data.reinforced) {
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Cleanup.reinforced", {
            what: foundry.utils.escapeHTML(`${data.visibilityLabel} ${data.typeLabel}`)
        })}</p>`);
        return { removed: false, reinforced: true };
    }

    const dc = cleanupDc(data.visibility, actor);
    const success = isCritical || (dc !== null && total >= dc);
    const band = isCritical ? "critical" : (success ? (withHope ? "hope" : "despair") : "failure");
    // `band` stays four-valued for the report — `DRPG.Cleanup.band.*` is written
    // for it — but the OUTCOME distinguishes the two kinds of failure, because
    // the guide does: a Hope failure just does not work, while a Despair failure
    // is the one that "Powstaje Jawny Resolution Remnant".
    const outcome = success
        ? (CLEANUP.outcome[band] ?? CLEANUP.outcome.hope)
        : (withHope ? CLEANUP.outcome.failureHope : CLEANUP.outcome.failureDespair);

    // Everything needed to put this attempt back, recorded before it happens.
    // The erased trace is stored as its full creation data rather than as an id,
    // because by the time a Reroll asks for it the token no longer exists.
    const receipt = {
        actorId,
        tokenId,
        stressBefore: resourceValue(actor, "stress"),
        erased: null,
        leftBehind: null
    };

    await spendStress(actor);

    const done = [];

    if (outcome.removes) {
        try {
            receipt.erased = recreationDataFor(token);
            // Through `removeRemnant` rather than `token.delete()`: it owns the
            // refusal of reinforced traces, and one place deciding that is the
            // difference between a rule and two rules that can drift apart.
            await removeRemnant(token);
            done.push(game.i18n.format("DRPG.Cleanup.removed", {
                what: `${data.visibilityLabel} ${data.typeLabel}`
            }));
        } catch (err) {
            error("Could not remove the Remnant a clean-up erased", err);
        }
    } else {
        done.push(game.i18n.localize("DRPG.Cleanup.stillThere"));
    }

    if (outcome.leaves) {
        const { traceFeedback } = await import("./remnants.mjs");
        const placed = await dropRemnant(actor, {
            type: CLEANUP.remnantType,
            visibility: outcome.leaves.visibility,
            faint: outcome.leaves.faint,
            // Tied to the crime, so the chapter-end sweep leaves it alone unless
            // it is faint — the guide's own exception, already honoured by
            // `clearFaintRemnants`.
            tiedToCrime: true,
            // "resolution", not "cleanup": `DRPG.Remnant.action.resolution` is
            // already defined as "Cleanup" — the vocabulary was written for this
            // stage before there was anything to fill it.
            action: "resolution",
            note: game.i18n.format("DRPG.Cleanup.remnantNote", {
                what: `${data.visibilityLabel} ${data.typeLabel}`
            })
        });
        if (placed) {
            receipt.leftBehind = refOf(placed);
            // `outcome.leaves` only exists on the despair bands (see
            // CLEANUP.outcome in config.mjs) — this is a trace the killer did
            // NOT select and does not already know about, unlike the one
            // `Cleanup.removed`/`Cleanup.reinforced` name above, which the
            // killer already saw on the picker before rolling. Gated the same
            // way every other action's fresh trace is: Hope or a critical
            // tells them, a plain Despair never does — and `outcome.leaves`
            // is despair-only, so this never actually fires today. Written
            // through the shared gate anyway, so a future rebalance of
            // CLEANUP.outcome cannot reopen the leak by accident.
            if (traceFeedback({ isCritical, withHope }, placed)) {
                done.push(game.i18n.localize("DRPG.Cleanup.leftTrace"));
            }
        }
    }

    // "Morderca odzyskuje 1 stres" — the critical's own line, and the only
    // outcome in Stage 6 that gives the Stress back. Applied after `spendStress`
    // rather than instead of it, so the receipt's `stressBefore` still describes
    // the state a Reroll has to restore.
    if (outcome.refundStress) {
        await restoreStress(actor, outcome.refundStress);
        done.push(game.i18n.format("DRPG.Cleanup.stressBack", { n: outcome.refundStress }));
    }

    await report(actor, data, { band, success, total, dc, done });
    lastAttempt.set(actorId, receipt);

    log(`Cleanup: ${actor.name} rolled ${total} against DC ${dc} on a ${data.visibility} ${data.type} — ${band}.`);
    return { removed: Boolean(outcome.removes), band, done };
}

/* ==========================================================================
 * STAGE 6'S OTHER TWO ACTIONS
 * --------------------------------------------------------------------------
 * "Zatarcie śladów" above removes evidence. These two do the opposite and the
 * unrelated: one manufactures evidence against somebody else, the other moves
 * the largest piece of evidence in the room.
 *
 * They share the erase-trace shape — 1 Stress, killer in the room, rolled on
 * this client and scored on the GM's — but not its difficulty: both have a flat
 * threshold from the guide rather than one read off how visible a trace is.
 * ========================================================================== */

/**
 * Cover what you are doing, when somebody is watching you do it.
 *
 * Guide, p. 27: "Jeśli min. jeden inny gracz zadeklaruje obecność w
 * pomieszczeniu, w którym zabójca realizuje akcje rozwiązania, zabójca na
 * początku akcji musi rzucić kośćmi za ukrycie swoich intencji." Thresh 16,
 * Shadow — the same shape as the sabotage and indirect-murder concealment rolls,
 * and priced the way neither of those is: entirely in Stress.
 *
 * It never blocks the action. Failing means the room watched you scrub a murder
 * scene, which is a social catastrophe rather than a mechanical one, and the
 * guide gives it no "you may not continue" clause. What it costs is Stress —
 * the currency Stage 6 runs on — so a botched cover story really does shorten
 * how long the killer can keep cleaning.
 *
 * Rolled with `remember: false`: a supporting roll must not eat a Call armed for
 * the clean-up itself, nor overwrite the Reroll bookmark. Same rule as
 * `INDIRECT_MURDER.concealIntent`.
 *
 * @returns {Promise<boolean>} false only when the roll was abandoned, which is
 *   the one case the caller should read as "they backed out".
 */
async function concealFromWitnesses(actor) {
    const def = CLEANUP.conceal;
    if (!def) return true;

    const { othersInRoom } = await import("./movement.mjs");
    if (!othersInRoom(actor).length) return true;

    const { rollTrait } = await import("./action-rolls.mjs");
    const roll = await rollTrait(actor, def.trait,
        { remember: false, title: game.i18n.localize("DRPG.Roll.concealIntent") });
    if (!roll) return false;

    const hidden = roll.isCritical || roll.total >= def.threshold;
    const band = roll.isCritical ? "critical" : (roll.withHope ? "hope" : "despair");

    let cost = 0;
    if (hidden && band === "despair") cost = def.stress?.successDespair ?? 0;
    else if (!hidden) {
        cost = roll.withHope ? (def.stress?.failureHope ?? 0) : (def.stress?.failureDespair ?? 0);
    }
    for (let i = 0; i < cost; i++) await spendStress(actor);

    const refund = hidden ? (def.refundStress?.[band] ?? 0) : 0;
    if (refund) await restoreStress(actor, refund);

    const line = hidden
        ? (band === "despair" ? def.successWithDespair : def.success)
        : def.failure;

    await whisperToOwner(actor, `<p><strong>${foundry.utils.escapeHTML(def.label)}</strong> — ${
        roll.total}: ${foundry.utils.escapeHTML(line)}</p>`);

    /*
     * A failure is public TO THE ROOM, and to nowhere else.
     *
     * This used to `announce()`, which is a message to the whole table — so a
     * botched cover story in the Closet told sixteen students, most of them on
     * the other side of the building, that somebody had been caught cleaning.
     * That is the investigation handed over for free, by the one roll whose
     * entire subject is who can see you.
     *
     * Who can see you is `othersInRoom`, which this function has already asked
     * — it is the reason the roll happened at all. So the message goes to those
     * people's owners, plus the GMs, and the killer's own copy is the whisper
     * above.
     */
    if (!hidden) {
        const line = `<p><em>${game.i18n.format("DRPG.Cleanup.seenCleaning", {
            actor: foundry.utils.escapeHTML(actor.name),
            room: foundry.utils.escapeHTML(locate(actor)?.room ?? "—")
        })}</em></p>`;

        const { ownerOf, gmIds, whisperToGms } = await import("./utils.mjs");
        const witnesses = othersInRoom(actor).map(a => ownerOf(a)?.id).filter(Boolean);
        const recipients = Array.from(new Set([...witnesses, ...gmIds()]));

        if (recipients.length) {
            await ChatMessage.create({
                content: line,
                whisper: recipients,
                flags: { [MODULE_ID]: { drpgMessage: true } }
            });
        } else {
            // Nobody in the room has an owner online — an NPC, a player away
            // from the table. The GMs still hear it, because the fiction still
            // happened and somebody has to be able to narrate it.
            await whisperToGms(line);
        }
    }

    return true;
}

/**
 * A resolution action costs one of the day's two, on top of the Stress.
 *
 * Stage 6 used to run on Stress alone, which meant it ran on nothing the table
 * could see: a killer with Stress to spare could scrub every trace in the room
 * one after another, in a stage that is supposed to be a handful of frantic
 * choices. Charging an action caps it at two per time of day — the same budget
 * everything else in the game is bought with — and makes "what do I do with the
 * time I have" the question it was always meant to be.
 *
 * Both costs, deliberately (Dawid's call, 2026-08-17). The Stress is what makes
 * a long clean-up hurt; the action is what makes it finite.
 *
 * @returns {Promise<boolean>} false when there is nothing left to spend, in
 *   which case `spendAction` has already said so and nothing has been touched.
 */
async function spendResolutionAction(actor) {
    const { spendAction } = await import("./actions.mjs");
    return spendAction(actor, 1);
}

/** Common guard for the two below. @returns {object|null} the action def. */
function stageSixDef(actor, key) {
    const def = CLEANUP.actions?.[key];
    if (!def) {
        // The one refusal with nothing to say to a player: a key that is not in
        // the table cannot come from the sheet, only from a bad call. It still
        // has to reach somebody, so it goes to the log rather than nowhere.
        error(`No Stage 6 action named "${key}".`);
        return null;
    }
    if (!isCleaner(actor)) {
        refuseCleanup(actor);
        return null;
    }
    if (resourceValue(actor, "stress") >= resourceMax(actor, "stress")) {
        ui.notifications.warn(game.i18n.localize("DRPG.Murder.noStressLeft"));
        return null;
    }
    return def;
}

/**
 * Roll one of the two, on the killer's own client.
 *
 * @param {Actor} actor
 * @param {"misleadingTrail"|"moveBody"} key
 * @param {string|null} targetId  The framed player, for a misleading trail.
 */
export async function attemptStageSix(actor, key, targetId = null) {
    const def = stageSixDef(actor, key);
    if (!def) return null;

    // You cannot carry a body you are not standing next to.
    //
    // `applyMoveBody` walks outwards from the KILLER's room, so a killer in a
    // different room from the body teleported it out of a room they had never
    // been in — measured, Round Table to Closet from the Dinner Hall. In a real
    // incident the two are together and this never fires; it fires for the
    // states that get there some other way, which is now a supported route.
    if (key === "moveBody" && !bodyIsHere(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.bodyNotHere"));
        return null;
    }

    if (!await spendResolutionAction(actor)) return null;

    // The guide's concealment roll covers "akcje rozwiązania" as a whole —
    // planting a false trail or dragging a body past a witness is if anything
    // harder to explain away than wiping a smear.
    //
    // Moving the body is out. You are not concealing an intent while you carry
    // a corpse across the hall — there is nothing left to be coy about, and the
    // action already announces itself by leaving an Evident trace every single
    // time. Two rolls to move one body, where the first could stop the second
    // from happening at all, was a stack the stage does not need.
    if (key !== "moveBody" && !await concealFromWitnesses(actor)) return null;

    const { rollTrait } = await import("./action-rolls.mjs");
    const calls = await import("./call-effects.mjs");

    // Moving a body is the one Stage 6 action a Cleaning Tool helps with by
    // lowering the number rather than by granting advantage — see
    // `toolBonusPerTier`, applied on the GM side where the threshold lives.
    const tool = cleaningTool(actor);
    if (CLEANUP.toolAdvantage && tool && key !== "moveBody") calls.armSituational(1);

    let roll;
    try {
        roll = await rollTrait(actor, (def.traits ?? CLEANUP.traits)[0], {
            actionKey: "cleanup", context: { cleanup: key, cleanupTarget: targetId },
            title: game.i18n.localize(key === "moveBody"
                ? "DRPG.Cleanup.moveAction" : "DRPG.Cleanup.trailAction")
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return null;

    const { requestCleanup } = await import("./gm-bridge.mjs");
    await requestCleanup({
        actorId: actor.id,
        tokenId: null,
        key,
        targetId,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope)
    });
    return { roll };
}

/** Score a misleading trail or a body move. GM side. */
export async function resolveStageSix({
    actorId, key, targetId = null, total = 0, isCritical = false, withHope = false
} = {}) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId);
    const def = CLEANUP.actions?.[key];
    if (!actor || !def || !isCleaner(actor)) return null;

    // The tool lowers the number it has to beat, "+(1*tier narzędzia)".
    const relief = def.toolBonusPerTier ? cleaningTier(actor) * def.toolBonusPerTier : 0;
    const threshold = Math.max(0, (def.threshold ?? 0) - relief);
    const success = isCritical || total >= threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");

    await spendStress(actor);
    const done = [];

    if (key === "misleadingTrail") await applyMisleadingTrail(actor, def, targetId, success, band, done);
    else if (key === "moveBody") await applyMoveBody(actor, def, success, band, done, targetId);

    const refund = success ? def.refundStress?.[band] : null;
    if (refund) {
        await restoreStress(actor, refund);
        done.push(game.i18n.format("DRPG.Cleanup.stressBack", { n: refund }));
    }

    await whisperToOwner(actor, `<h3>${foundry.utils.escapeHTML(def.label)}</h3>
        <p>${total} ${success ? "≥" : "<"} ${threshold}</p>
        ${done.length ? `<ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>` : ""}`);
    await whisperToGms(`<p><strong>${foundry.utils.escapeHTML(def.label)}</strong> — ${
        foundry.utils.escapeHTML(actor.name)}: ${total} vs ${threshold} (${band})</p>`);

    log(`Stage 6 ${key}: ${actor.name} rolled ${total} vs ${threshold} — ${band}.`);
    return { success, band, done };
}

/**
 * Plant something that points at somebody else.
 *
 * A failure still plants it, which is the guide's own reading — "Nieudane:
 * Morderca zostawia Faint Ukryty Prep Remnant wskazujący na wybranego gracza"
 * — so a botched frame-up is a bad frame-up rather than nothing. Only a Despair
 * failure leaves the room clean.
 */
async function applyMisleadingTrail(actor, def, targetId, success, band, done) {
    const visibility = success ? def.remnant?.[band] : def.failureRemnant?.[band];
    if (!visibility) {
        done.push(game.i18n.localize("DRPG.Cleanup.trailFailed"));
        return;
    }

    const framed = game.actors.get(targetId ?? "");
    await dropRemnant(actor, {
        type: def.remnantType ?? "prep",
        visibility,
        faint: success ? false : Boolean(def.failureFaint),
        tiedToCrime: true,
        action: "resolution",
        pointsAt: framed?.id ?? null,
        subject: framed?.name ?? "",
        note: game.i18n.format("DRPG.Cleanup.trailNote", {
            name: framed?.name ?? "?", visibility
        })
    });

    done.push(game.i18n.format("DRPG.Cleanup.trailPlanted", {
        name: framed?.name ?? "?", visibility
    }));
}

/**
 * Carry the body out of the room it died in.
 *
 * The destination comes from the killer, picked before the roll and carried
 * here as `chosenRoom`. It is checked against `neighbouringRooms` on this side
 * rather than trusted: the packet is a claim, and a body must not be moved
 * somewhere a living character could not walk to.
 *
 * The trace it leaves is dropped where the killer is standing, which is the
 * room the body left. That is the point of it: the guide gives every band an
 * Evident Resolution Remnant, because dragging a corpse is not subtle.
 */
async function applyMoveBody(actor, def, success, band, done, chosenRoom = null) {
    if (!success) {
        done.push(game.i18n.localize("DRPG.Cleanup.bodyStayed"));
        return;
    }

    const state = murderState();
    const victim = game.actors.get(state?.victimId ?? "");
    const here = locate(actor);
    if (!victim || !here?.room) {
        done.push(game.i18n.localize("DRPG.Cleanup.noBody"));
        return;
    }

    /*
     * WHERE IT GOES IS THE KILLER'S DECISION, NOT THE DICE'S.
     *
     * This used to take `def.rooms[band]` steps outward and pick a RANDOM room
     * at each one. Two things were wrong with that, and the second is the one
     * that matters: the killer could not aim. Dragging a body is the most
     * deliberate thing anybody does in this game — you move it because of what
     * is in the other room, or who is not — and the engine was rolling a die to
     * decide which door you went through. On a map with four exits it was three
     * chances in four of putting the body somewhere you would not have chosen.
     *
     * So the destination is chosen up front, before the roll, and travels as
     * `targetId`. The roll still decides WHETHER it moves; it no longer decides
     * where. `def.rooms` stays in the table as the reach — the picker offers the
     * rooms connected to this one — and the random walk is gone.
     */
    const { neighbouringRooms } = await import("./movement.mjs");
    const reachable = neighbouringRooms(here.room).filter(r => r !== here.room);
    let room = reachable.includes(chosenRoom) ? chosenRoom : reachable[0];

    if (!room) {
        // Nowhere to take it. Said out loud rather than silently leaving the
        // body where it is and reporting a success.
        done.push(game.i18n.localize("DRPG.Cleanup.bodyNowhere"));
        return;
    }

    const region = Array.from(here.scene?.regions ?? []).find(r => r.name === room);
    const tokenDoc = here.scene?.tokens?.find(t => t.actorId === victim.id) ?? null;

    if (region && tokenDoc) {
        try {
            await region.teleportTokens([tokenDoc], { placement: "random", snap: true, pan: false });
            done.push(game.i18n.format("DRPG.Cleanup.bodyMoved", { room }));
        } catch (err) {
            error("Could not move the body", err);
            done.push(game.i18n.localize("DRPG.Cleanup.bodyStuck"));
        }
    } else {
        done.push(game.i18n.localize("DRPG.Cleanup.bodyStuck"));
    }

    const visibility = def.remnant?.[band] ?? "evident";
    await dropRemnant(actor, {
        type: def.remnantType ?? "resolution",
        visibility,
        tiedToCrime: true,
        action: "resolution",
        subject: victim.name,
        note: game.i18n.format("DRPG.Cleanup.bodyNote", { name: victim.name, room })
    });
    done.push(game.i18n.format("DRPG.Cleanup.leftTrace", { visibility }));
}

/* ==========================================================================
 * TAKING A CLEAN-UP BACK — the Reroll's other half
 * --------------------------------------------------------------------------
 * Kept on this client rather than in a world setting, unlike the incident's own
 * receipt in murder.mjs. What it holds is the answer key: the full creation data
 * of a Remnant, including how visible it is and what it really is. Writing that
 * into the murder state would publish it to every player's console — see
 * truth-bullets.mjs for the same reasoning about the ledger. The cost is that a
 * GM who reloads mid-Stage-6 cannot replay a clean-up, which is the same trade
 * observe.mjs already makes, and it says so when it happens.
 * ========================================================================== */

/** actorId -> what their last clean-up attempt did. GM browsers only. */
const lastAttempt = new Map();

function refOf(placed) {
    const doc = placed?.document ?? placed;
    if (!doc?.id) return null;
    return { id: doc.id, sceneId: doc.parent?.id ?? null };
}

/**
 * Enough to build this Remnant again where it stood, with everything it knew.
 *
 * `placeRemnant` takes exactly this shape, so recreating is handing the flags
 * back rather than reconstructing them from a summary.
 *
 * The token ID is the one thing that cannot come back — Foundry mints a new one.
 * Two things key off it, and neither is hurt here: a Truth Bullet's `remnantId`
 * (a back-reference for the GM, not something the trial reads), and the
 * already-copied check that stops one character copying one trace twice. The
 * second means a character who had already found this trace could find it again
 * after a reroll, which is a strictly kinder failure than the trace staying
 * erased.
 */
function recreationDataFor(token) {
    const f = key => token.getFlag(MODULE_ID, REMNANT_FLAGS[key]);
    return {
        x: token.x,
        y: token.y,
        sceneId: token.parent?.id ?? null,
        type: f("type"),
        visibility: f("visibility"),
        faint: Boolean(f("faint")),
        reinforced: Boolean(f("reinforced")),
        tiedToCrime: Boolean(f("tiedToCrime")),
        note: f("note") ?? "",
        action: f("action") ?? "manual",
        subject: f("subject") ?? "",
        pointsAt: f("pointsAt") ?? null,
        sourceActor: f("sourceActor") ?? null,
        sourceName: f("sourceName") ?? "",
        room: f("room") ?? null,
        chapter: f("chapter") ?? null,
        day: f("day") ?? null,
        timeOfDay: f("timeOfDay") ?? null
    };
}

/**
 * Put the room back the way it was before this actor's last clean-up attempt.
 *
 * Order matters: the trace it left behind goes first, then the one it erased
 * comes back, then the Stress. Doing it the other way round would briefly leave
 * two traces describing the same wipe, and `cleanableRemnants` runs off exactly
 * that list.
 */
async function undoLastCleanup(actor, tokenId) {
    const receipt = lastAttempt.get(actor.id);
    if (!receipt) {
        await whisperToGms(`<p class="drpg-warning">${
            game.i18n.localize("DRPG.Cleanup.rerollLost")}</p>`);
        return false;
    }
    if (receipt.tokenId !== tokenId) {
        error(`Cleanup reroll: the recorded attempt was on a different trace (${receipt.tokenId}).`);
        // Same contract as a lost receipt: the caller aborts, and a human is
        // told, because the dice on the player's screen have already changed.
        await whisperToGms(`<p class="drpg-warning">${
            game.i18n.localize("DRPG.Cleanup.rerollLost")}</p>`);
        return false;
    }

    if (receipt.leftBehind?.id) {
        try {
            const scene = receipt.leftBehind.sceneId
                ? game.scenes.get(receipt.leftBehind.sceneId)
                : null;
            await scene?.tokens?.get(receipt.leftBehind.id)?.delete();
        } catch (err) {
            error("Could not take back the trace a rerolled clean-up left", err);
        }
    }

    if (receipt.erased) {
        try {
            const { placeRemnant } = await import("./remnants.mjs");
            await placeRemnant(receipt.erased);
        } catch (err) {
            error("Could not put back the Remnant a rerolled clean-up erased", err);
        }
    }

    if (typeof receipt.stressBefore === "number") {
        try {
            await automatedUpdate(actor, {
                "system.resources.stress.value": receipt.stressBefore
            });
        } catch (err) {
            error("Could not refund the Stress a rerolled clean-up spent", err);
        }
    }

    lastAttempt.delete(actor.id);
    return true;
}

async function spendStress(actor) {
    const marks = resourceValue(actor, "stress");
    const max = resourceMax(actor, "stress");
    if (marks >= max) return;
    try {
        await automatedUpdate(actor, {
            "system.resources.stress.value": Math.min(max, marks + RESOLUTION_STRESS_COST)
        });
    } catch (err) {
        error("Could not charge the Stress for a clean-up", err);
    }
}

/**
 * Hand Stress back. Stress is a reverse resource, so "restoring" it is
 * subtracting marks — the same direction `use-items.mjs` moves it.
 */
async function restoreStress(actor, amount = 1) {
    const marks = resourceValue(actor, "stress");
    if (marks <= 0) return;
    try {
        await automatedUpdate(actor, {
            "system.resources.stress.value": Math.max(0, marks - amount)
        });
    } catch (err) {
        error("Could not give back the Stress a critical clean-up earned", err);
    }
}

/**
 * Two different messages on purpose.
 *
 * The killer is told what happened to the scene. The GMs are told that plus the
 * threshold it was measured against, because that number is the answer key and
 * the killer must not learn how visible their own traces are by subtraction.
 */
async function report(actor, data, { band, success, total, dc, done }) {
    const summary = done.map(line => `<li>${line}</li>`).join("");

    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Cleanup.title")}</h3>
        <p><strong>${game.i18n.localize(`DRPG.Cleanup.band.${band}`)}</strong></p>
        ${summary ? `<ul>${summary}</ul>` : ""}
        <p><small>${game.i18n.format("DRPG.Cleanup.stressSpent", { n: RESOLUTION_STRESS_COST })}</small></p>`);

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Cleanup.title")}</h3>
        <p>${game.i18n.format("DRPG.Cleanup.gmLine", {
            actor: foundry.utils.escapeHTML(actor.name),
            what: foundry.utils.escapeHTML(`${data.visibilityLabel} ${data.typeLabel}`),
            total,
            dc: dc ?? "—",
            verdict: game.i18n.localize(success ? "DRPG.Cleanup.hit" : "DRPG.Cleanup.miss")
        })}</p>
        ${summary ? `<ul>${summary}</ul>` : ""}`);
}

/* ==========================================================================
 * THE KILLER'S SCREEN
 * ========================================================================== */

/**
 * Pick something to wipe.
 *
 * What the killer is shown is what their character can now see — Stage 6 is the
 * point at which the guide lets them look at their own traces — but NOT how hard
 * any of it is to erase. The threshold comes from a Remnant's visibility, and
 * showing it would hand them a reading of how much evidence they left, which is
 * the trial's whole question. Reinforced traces are the exception and are named
 * outright: "this one is not going anywhere" is a decision they have to be able
 * to make.
 *
 * `cleanableRemnants(actor)` cannot be called here directly and expect
 * anything back — `remnantData()`, underneath it, answers `null` for every
 * client that is not a GM, which is the correct answer to "what does this
 * client know about the ledger" and the wrong list to hand a killer. The GM
 * client that actually holds the ledger has to compute this, which is exactly
 * what `requestCleanableTraces` asks for: a GM runs it locally, a player asks
 * over the bridge and gets back only what `cleanableTracesForPlayer` (in this
 * same file) is willing to say — no DC, no `tiedToCrime`.
 */
export async function openCleanupDialog(actor) {
    if (!isCleaner(actor)) return refuseCleanup(actor);

    const { requestCleanableTraces } = await import("./gm-bridge.mjs");
    const traces = await requestCleanableTraces(actor.id);
    if (!traces.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Cleanup.nothingHere"));
        return null;
    }

    // Every trace here refuses to be removed. The picker would open with every
    // option disabled, no value to submit, and a confirm button that did nothing
    // — a dead end that looks like a bug. Say what is actually true instead.
    if (traces.every(t => t.reinforced)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.allReinforced"));
        return null;
    }

    const options = traces.map(t =>
        `<option value="${t.id}"${t.reinforced ? " disabled" : ""}>${
            foundry.utils.escapeHTML(t.label)}</option>`
    ).join("");

    const tool = cleaningTool(actor);
    const DialogV2 = foundry.applications.api.DialogV2;
    const { dialogContent } = await import("./utils.mjs");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Cleanup.title") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Cleanup.intro", { n: RESOLUTION_STRESS_COST })}</p>
            <p class="notes">${tool
                ? game.i18n.format("DRPG.Cleanup.withTool", {
                    item: foundry.utils.escapeHTML(tool.name), tier: cleaningTier(actor)
                })
                : game.i18n.localize("DRPG.Cleanup.bareHands")}</p>
            <label>${game.i18n.localize("DRPG.Cleanup.which")}
                <select name="trace">${options}</select></label>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Cleanup.confirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=trace]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return attemptCleanup(actor, picked);
}

/**
 * Where the body is going.
 *
 * Asked before the roll, because it is a decision and not a result: the killer
 * is choosing which room to leave a corpse in, and that choice is most of what
 * Stage 6 is about. The list is the rooms connected to the one the body is
 * lying in — the same adjacency a living character walks by.
 */
export async function openMoveBodyDialog(actor) {
    if (!isCleaner(actor)) return refuseCleanup(actor);
    if (!bodyIsHere(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.bodyNotHere"));
        return null;
    }

    const here = locate(actor);
    const { neighbouringRooms } = await import("./movement.mjs");
    const rooms = neighbouringRooms(here?.room ?? "").filter(r => r !== here?.room);

    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.bodyNowhere"));
        return null;
    }

    const DialogV2 = foundry.applications.api.DialogV2;
    const { dialogContent } = await import("./utils.mjs");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Cleanup.moveTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Cleanup.moveIntro", {
                room: foundry.utils.escapeHTML(here?.room ?? "—"),
                n: RESOLUTION_STRESS_COST
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Cleanup.moveAlwaysTrace")}</p>
            <label>${game.i18n.localize("DRPG.Cleanup.moveWhere")}
                <select name="room">${rooms.map(r =>
                    `<option value="${foundry.utils.escapeHTML(r)}">${foundry.utils.escapeHTML(r)}</option>`
                ).join("")}</select></label>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Cleanup.moveConfirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=room]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return attemptStageSix(actor, "moveBody", picked);
}

/**
 * Who the false trail points at.
 *
 * `misleadingTrail` needs a name and had no way to ask for one: the action was
 * complete — threshold, three outcome bands, the Remnant it plants, the Faint
 * one it plants on a failure — and reachable only from the console, because
 * the killer's panel offered a single button and this was not it.
 *
 * The victim is not on the list. Framing the person lying dead in the room is
 * not a suspect pool of one, it is a confession with extra steps.
 */
export async function openMisleadingTrailDialog(actor) {
    if (!isCleaner(actor)) return refuseCleanup(actor);

    const { livingStudents } = await import("./chapter.mjs");
    const victimId = murderState()?.victimId;
    const candidates = livingStudents()
        .filter(a => a.id !== actor.id && a.id !== victimId && !isMonokuma(a));

    if (!candidates.length) {
        ui.notifications.info(game.i18n.localize("DRPG.Cleanup.trailNobody"));
        return null;
    }

    const DialogV2 = foundry.applications.api.DialogV2;
    const { dialogContent } = await import("./utils.mjs");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Cleanup.trailTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Cleanup.trailIntro", { n: RESOLUTION_STRESS_COST })}</p>
            <label>${game.i18n.localize("DRPG.Cleanup.trailWho")}
                <select name="who">${candidates.map(a =>
                    `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`
                ).join("")}</select></label>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Cleanup.trailConfirm"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=who]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!picked || picked === "cancel") return null;
    return attemptStageSix(actor, "misleadingTrail", picked);
}

/* ==========================================================================
 * CLOSING THE STAGE
 * ========================================================================== */

/**
 * Stage 6 is over: destroy the tools it used up.
 *
 * `CLEANUP.destroysTools` has declared for some time that a crime tool used in
 * an incident is destroyed, and nothing was destroying anything. The cleaning tool
 * goes the same way and for the same reason — one crime scene, one set of
 * gloves. Both are read as EQUIPPED items: an unopened spare in the stash is not
 * a thing that was used.
 *
 * Called by `endMurder`, so it also covers a GM closing an incident by hand.
 */
export async function endResolution(actor) {
    return destroyTools(actor, CLEANUP.destroysTools);
}

/**
 * Stage 7's half: the gloves come off when the body turns up.
 *
 * Called by `discoverBody`, which is the moment the guide names. The killer is
 * read off the incident state rather than passed in, because by then whoever
 * closed the murder is not necessarily the person holding the tool.
 */
export async function destroyCleaningTools() {
    if (!game.user.isGM) return [];
    // Every killer, not the first one. An accomplice cleaning alongside them is
    // holding a tool of their own, and leaving it in their bag after the body
    // turns up is a Truth Bullet the guide says should no longer exist.
    const destroyed = [];
    for (const id of killerIds()) {
        const killer = game.actors.get(id);
        if (!killer) continue;
        destroyed.push(...await destroyTools(killer, CLEANUP.destroysToolsOnDiscovery ?? []));
    }
    return destroyed;
}

/**
 * RUINED, NOT VANISHED.
 *
 * These used to be deleted, and deleting them is the one outcome that costs the
 * killer nothing: the murder weapon left the world by itself, tidily, the
 * instant it stopped being useful. The guide's sentence is that the tool "zostaje
 * usunięte z ekwipunku" — removed from what you can use — and the module read
 * that as removed from existence.
 *
 * It stays now, marked Broken, in the same slot and against the same carry
 * limit. Getting rid of it is the killer's own problem and their own decision:
 * throw it away and leave a trace somewhere, or put it in their bedroom stash.
 * See BROKEN_ITEMS in config.mjs and `discardBroken` in use-items.mjs.
 */
async function destroyTools(actor, categories) {
    if (!game.user.isGM || !actor || !categories?.length) return [];

    const { breakItem } = await import("./inventory.mjs");
    const destroyed = [];
    for (const category of categories) {
        const item = equippedIn(actor, category);
        if (!item) continue;
        try {
            destroyed.push(item.name);
            await breakItem(item);
        } catch (err) {
            error(`Could not ruin the ${category} used in the incident`, err);
        }
    }

    if (destroyed.length) {
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Cleanup.toolsBroken", {
            items: foundry.utils.escapeHTML(destroyed.join(", "))
        })}</p>`);
        log(`Cleanup: ${destroyed.join(", ")} used by ${actor.name} is broken and still on them.`);
    }
    return destroyed;
}
