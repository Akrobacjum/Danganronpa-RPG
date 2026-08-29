/**
 * Danganronpa RPG — Stage 6, the killer cleaning up.
 * ---------------------------------------------------------------------------
 * Guide: once the incident is over the killer can finally see the Remnants they
 * left, and spend Sanity trying to make them go away. "Przedmioty sprzątające
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
 *
 * TWO DOORS INTO THE SAME ROOM — `viaAction`, added in E12.
 * ---------------------------------------------------------------------------
 * Everything here was reachable only from the Stage 6 panel, which made the
 * guide's own "akcje rozwiązania w Etapie 2" unreachable and made planting a
 * false trail a privilege of the killer. The Tamper tile is the second door,
 * and it is the SAME code: same rolls, same thresholds, same traces, same
 * verdicts. What differed used to be two things; since 29.08 it is one — the
 * PRICE is the same on both roads, one point of Sanity, and only the entry
 * conditions still differ. `viaAction` is what carries
 * the difference:
 *
 *   WHO MAY.   Stage 6 asks `isCleaner` — this is your crime scene. The action
 *              asks nothing of the sort, but it does ask something Stage 6 does
 *              not: the trace you are erasing has to be YOURS. A killer in
 *              their own Stage 6 may wipe anything in the room, including
 *              somebody else's; a student with a broom may only undo
 *              themselves.
 *   WHAT IT    Stage 6 costs Sanity and an action. The action costs an action.
 *   COSTS.     The Sanity is the price of doing this while a body is cooling,
 *              not the price of the act.
 *
 * The concealment roll happens on BOTH routes, and it is the one thing that can
 * still cost Sanity outside Stage 6. That is not the tile's price being
 * understated — it is the cost of being watched, which is the entire risk of
 * the action, and removing it would make tampering in a crowded corridor safer
 * than tampering over a corpse while doing exactly the same thing.
 *
 * `viaAction` is a claim from a client, like every other flag that crosses the
 * bridge. It buys the sender nothing: it waives a check that would only ever
 * have refused them, and adds one — the ownership test above — that is verified
 * on this side against the ledger the sender cannot read.
 */

import { MODULE_ID, FLAGS, CLEANUP, RESOLUTION_STRESS_COST, REMNANT_VISIBILITY }
    from "./config.mjs";
import { getClock } from "./clock.mjs";
import { murderState, killerIds } from "./murder.mjs";
import {
    REMNANT_FLAGS, remnantsInRoom, remnantData, removeRemnant, dropRemnant
} from "./remnants.mjs";
import { roomOfToken } from "./movement.mjs";
import { equippedFor, breakOnDespair } from "./use-items.mjs";
import { isMonokuma } from "./monokuma.mjs";
// What this character has copied into their inventory as a Truth Bullet, which
// is this module's only record of "they know this trace is there".
import { copiedRemnants } from "./truth-bullets.mjs";
import { ITEM_FLAGS, isBroken, isStashed } from "./inventory.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { announce, whisperToGms, whisperToOwner, dialogContent, log, error, cardHead } from "./utils.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * WHO MAY CLEAN, AND WHAT
 * ========================================================================== */

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
export function cleanableTracesForPlayer(actorId, { mine = false } = {}) {
    const actor = game.actors.get(actorId);
    if (!actor) return [];

    /*
     * `mine` IS THE TAMPER ACTION, AND IT CANNOT BE ASKED ANYWHERE ELSE.
     *
     * Which traces are yours is `sourceActor` in the Remnant ledger, which is a
     * client-scoped setting on GM browsers — see remnants.mjs. A player's own
     * client physically cannot answer "what did I leave in this room", however
     * reasonable a question that is about their own character, which is why
     * this list is built here and travels back over the bridge.
     *
     * TWO FILTERS, NOT ONE — AND THE SECOND IS THE POINT (Dawid, 28.08).
     *
     * `sourceActor` alone said "you left it". `copiedRemnants` says "and you
     * know it is there". Without the second, Tamper was a trace detector: open
     * the menu, read the list, and learn exactly what you left in this room and
     * how visible it is — for free, before spending anything, and including
     * traces the character has no idea exist. A player could sweep the map
     * opening Tamper in every room.
     *
     * Stage 6 is the deliberate exception and takes the other branch: the guide
     * opens the killer's eyes to their own scene there, and that is a privilege
     * of the stage rather than of the character.
     *
     * So the loop the game actually wants becomes the loop the game requires:
     * Observe -> "follow my traces" copies one into your inventory as a Truth
     * Bullet, and the Bullet is the record of knowing. Erasing a trace you
     * never found is not a thing you can do, because finding it is the action
     * that costs something.
     *
     * Note what a player still does not get either way: a LIST, not tokens.
     * Being able to erase your own trace is not being able to see it on the map.
     */
    const known = copiedRemnants(actor);
    const wanted = mine
        ? cleanableRemnants(actor).filter(t =>
              t.data.sourceActor === actor.id && known.has(t.token.id))
        : cleanableRemnants(actor);

    return wanted.map(t => ({
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
    const tool = CLEANUP.toolTierReducesDc ? cleaningTier(actor) : 0;
    return Math.max(0, base - tool - freshSceneBonus());
}

/**
 * −3 while the body is still lying where it fell (Z5).
 *
 * Read off the clock rather than stored, because the clock already carries this
 * fact and one fact with two homes is one fact that will disagree with itself:
 * `discoverBody` sets the phase to `investigation`, and that IS the moment the
 * corridor fills with people.
 *
 * Exported so the briefing can say WHY the number in front of the player is
 * lower than the one in the handbook. A discount nobody is told about is not a
 * discount, it is a bug they will report.
 */
export function freshSceneBonus() {
    const rule = CLEANUP.freshScene;
    if (!rule?.bonus) return 0;
    try {
        const phase = getClock().phase;
        return rule.until?.includes(phase) ? 0 : rule.bonus;
    } catch {
        // No clock is not a fresh scene. Failing towards the harder number is
        // the safe direction: it never hands out a discount nobody earned.
        return 0;
    }
}

/** The tier of the readied Cleaning Tool, or 0 for bare hands. */
export function cleaningTier(actor) {
    const tool = equippedFor(actor, "cleaningTool");
    if (!tool) return 0;
    return Number(tool.getFlag(MODULE_ID, ITEM_FLAGS.tier) ?? 0);
}

export function cleaningTool(actor) {
    return equippedFor(actor, "cleaningTool");
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
 * Costs Sanity rather than an action, as the guide has it: Stage 6 is not part
 * of the day's economy, and a killer with nothing left to give simply cannot
 * keep scrubbing. Refused before the dice when there is no Sanity to spend, so
 * nobody rolls for something they cannot pay for.
 *
 * The threshold is not computed here and never travels to this client — see the
 * note at the top of the file. What goes over the socket is which token was
 * aimed at and what the dice said.
 */
export async function attemptCleanup(actor, tokenId, {
    viaAction = false,
    /*
     * "erase" or "transform" (Z5). One function for both because everything
     * around the roll is the same job: the same trace, the same ownership and
     * found-it tests, the same Sanity, the same receipt, the same card. What
     * differs is three lines — the threshold gets a discount, the verdict
     * relabels instead of deleting, and the title says which was attempted.
     *
     * A second `attemptTransform` would have been a copy of ninety lines with
     * three changed, and the two would have parted company at the first guard
     * somebody remembered to add to only one of them.
     */
    mode = "erase",
    /** What the player is trying to turn it into. See `askTransformChange`. */
    change = null
} = {}) {
    if (!actor || !tokenId) return null;

    // Whose scene this is, is Stage 6's question and only Stage 6 asks it.
    if (!viaAction && !isCleaner(actor)) return refuseCleanup(actor);

    /*
     * HAVING SOMETHING TO PAY WITH IS BOTH ROADS' QUESTION (Dawid, 29.08).
     *
     * Tamper used to cost an action and nothing else, which made it the CHEAPER
     * way to clean your own scene — so the stage rule was subsidising going
     * round it. One price on both roads settles that, and it settles it in the
     * direction the season run wanted: sprinkling costs something, everywhere.
     *
     * Refused before the dice rather than after, because an action that takes a
     * cost it cannot take either forgives it silently or kills somebody, and
     * both answers are worse than saying no.
     */
    if (resourceValue(actor, "stress") >= resourceMax(actor, "stress")) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.noStressForThis"));
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
            // `cleanupKey` and `cleanupVia` ride along so a Reroll can tell the
            // three Stage 6 actions apart. Without them the bookmark said only
            // "cleanup" and a rerolled misleading trail was replayed as an
            // erase against a token id that was really an action name.
            actionKey: "cleanup",
            context: {
                cleanup: tokenId,
                cleanupKey: mode === "transform" ? "transformTrace" : "eraseTrace",
                // What was declared before the dice, so a Reroll can declare it
                // again. Without it a replayed transform would arrive with
                // nothing to apply and quietly do nothing — the exact failure
                // `cleanupKey` was added to stop, one road further along.
                cleanupChange: change,
                cleanupVia: viaAction
            },
            title: game.i18n.localize(mode === "transform"
                ? "DRPG.Cleanup.transformAction"
                : viaAction ? "DRPG.Tamper.coverAction" : "DRPG.Cleanup.action")
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return null;

    // One crime scene, one set of gloves — and Despair is what wears them out
    // early. The reference was taken before the dice; see `breakOnDespair`.
    await breakOnDespair(actor, tool, roll);

    // G-20. Only on a critical, and only if the table's rules still allow it —
    // read from config rather than assumed, so turning the permission off is one
    // field rather than a code change.
    // Only on the erase road. On the transform road the player already said
     // what they were trying to do, before the dice — asking again after a
     // critical would be asking them to choose twice for one action.
    const transform = mode !== "transform" && roll.isCritical
        && CLEANUP.outcome.critical?.mayTransform
        ? await askTransform(actor)
        : null;

    const { requestCleanup } = await import("./gm-bridge.mjs");
    await requestCleanup({
        actorId: actor.id,
        tokenId,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope),
        transform,
        key: mode === "transform" ? "transformTrace" : "eraseTrace",
        change,
        viaAction
    });

    return { roll };
}

/**
 * G-20: on a critical, erase it — or leave something arguing for another story.
 *
 * ASKED HERE, NOT GM-SIDE, and for the reason a critical Strike's target is:
 * this is the killer's decision about the story they are telling, and the GM's
 * client has no way to guess it. The dice are still on screen when it opens.
 *
 * ERASE IS THE FIRST BUTTON, so it is what Enter presses (see the DialogV2
 * footer finding in E3) and what a player who does not want a second decision
 * gets by pressing on. It is also usually the stronger play — nothing at all
 * beats a decoy — so the default is not merely the safe answer, it is the
 * ordinary one.
 *
 * The lists come from `CLEANUP.transform`, which is where the bound on "what
 * could this plausibly be" is written down and argued.
 *
 * @returns {Promise<object|null>} `{ type, visibility }`, or null for "erase it".
 */
async function askTransform(actor) {
    const { REMNANT_TYPES, REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");
    const rules = CLEANUP.transform ?? {};
    const types = rules.types ?? [];
    const bands = rules.visibilities ?? [];
    if (!types.length || !bands.length) return null;

    const options = (list, labels) => list
        .map(key => `<option value="${key}">${
            foundry.utils.escapeHTML(labels[key]?.label ?? labels[key] ?? key)}</option>`)
        .join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Cleanup.transformTitle") },
        classes: ["drpg-panel", "drpg-narrow"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Cleanup.transformIntro")}</p>
            <label>${game.i18n.localize("DRPG.Cleanup.transformType")}
                <select name="type">${options(types, REMNANT_TYPES)}</select></label>
            <label>${game.i18n.localize("DRPG.Cleanup.transformVisibility")}
                <select name="visibility">${options(bands, REMNANT_VISIBILITY_LABELS)}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Cleanup.transformNote")}</p>
        </form>`),
        buttons: [
            {
                action: "erase", label: game.i18n.localize("DRPG.Cleanup.transformErase"), default: true,
                callback: () => null
            },
            {
                action: "change", label: game.i18n.localize("DRPG.Cleanup.transformChange"),
                callback: (e, b, d) => ({
                    type: d.element.querySelector("[name=type]").value,
                    visibility: d.element.querySelector("[name=visibility]").value
                })
            }
        ],
        rejectClose: false
    });

    // "erase" comes back as null, and so does closing the window — which is the
    // same answer and should be: backing out of a bonus question must not cost
    // the critical that earned it.
    return picked && picked !== "erase" ? picked : null;
}

/**
 * What are you trying to make this look like? Asked BEFORE the dice (Z5).
 *
 * The erase road's `askTransform` is a reward, so it comes after a critical.
 * This one is the action's content: you declare the lie, then find out whether
 * you told it well. Cancelling here costs nothing, which is why it is asked
 * before the action is charged.
 *
 * ONE SELECT, FIVE OPTIONS, ONE DECISION. Four of them are the types G-20
 * allows and the fifth is "leave what it is, just make it harder to notice" —
 * because sometimes the honest lie is that there is nothing here worth reading.
 *
 * @returns {Promise<{type: string|null}|null>} null when they backed out.
 */
export async function askTransformChange(actor) {
    const { REMNANT_TYPES } = await import("./config.mjs");
    const types = CLEANUP.transform?.types ?? [];
    if (!types.length) return null;

    const options = types
        .map(key => `<option value="${key}">${
            foundry.utils.escapeHTML(REMNANT_TYPES[key]?.label ?? key)}</option>`)
        .join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Cleanup.transformAction") },
        classes: ["drpg-panel", "drpg-narrow"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Cleanup.transformActionIntro")}</p>
            <label>${game.i18n.localize("DRPG.Cleanup.transformType")}
                <select name="type">
                    ${options}
                    <option value="">${
                        game.i18n.localize("DRPG.Cleanup.transformQuieter")}</option>
                </select></label>
            <p class="notes">${game.i18n.localize("DRPG.Cleanup.transformActionNote")}</p>
        </form>`),
        buttons: [
            {
                action: "go", label: game.i18n.localize("DRPG.Cleanup.transformGo"), default: true,
                callback: (e, b, d) => ({
                    type: d.element.querySelector("[name=type]").value || null
                })
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return picked && picked !== "cancel" ? picked : null;
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
    actorId, tokenId, total, isCritical = false, withHope = false, undo = false,
    // G-20: `{ type, visibility }` when a critical chose to rewrite the trace
    // rather than erase it. Validated here against `CLEANUP.transform`, never
    // trusted — it arrives over the same socket as everything else.
    transform = null,
    // Z5: "erase" or "transform", and what the player declared before the dice.
    // Bounded here like everything else that crossed a socket.
    mode = "erase",
    change = null,
    viaAction = false
} = {}) {
    if (!game.user.isGM) return null;

    const actor = game.actors.get(actorId);
    if (!actor) return null;
    if (!viaAction && !isCleaner(actor)) return null;

    // A Reroll: put the scene back the way it was before scoring the new number,
    // or the second attempt would be measured against a room the first one had
    // already changed — and the Sanity would be charged twice for one attempt.
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
        // hand between the player picking and the dice landing. The Sanity is
        // still spent: they scrubbed at something.
        await spendStress(actor);
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Cleanup.vanished")}</p>`);
        return { removed: false, gone: true };
    }

    /*
     * THE ACTION MAY ONLY UNDO ITSELF.
     *
     * Verified here rather than trusted from the picker, for the same reason
     * everything else in this file is: the list went out over a socket and what
     * comes back is a token id. A packet naming somebody else's trace would
     * otherwise erase it, which would turn a one-action tile into a way of
     * scrubbing the crime scene of a murder you had nothing to do with.
     *
     * Stage 6 is deliberately exempt. A killer cleaning their own scene may
     * wipe whatever is in the room — including the traces of whoever else was
     * standing there — and that is the stage working as written.
     */
    if (viaAction && data.sourceActor !== actor.id) {
        error(`Refused a Tamper by ${actor.name}: that trace is not theirs.`);
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Tamper.notYours")}</p>`);
        return { removed: false, notYours: true };
    }

    // AND ONLY ONE THEY HAVE FOUND. The same rule the picker was built from,
    // re-asked here because the picker travelled over a socket and what came
    // back is a token id. A packet naming a trace they left and never found
    // would otherwise erase it blind — which is the whole leak, arriving by the
    // other road.
    if (viaAction && !copiedRemnants(actor).has(token.id)) {
        error(`Refused a Tamper by ${actor.name}: they have not found that trace.`);
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Tamper.notFound")}</p>`);
        return { removed: false, notFound: true };
    }

    // Reinforced traces refuse to be removed at all — remnants.mjs has said so
    // since the flag was introduced. Checked here as well as there so the Sanity
    // is not taken for an attempt that was never possible.
    if (data.reinforced) {
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Cleanup.reinforced", {
            what: foundry.utils.escapeHTML(`${data.visibilityLabel} ${data.typeLabel}`)
        })}</p>`);
        return { removed: false, reinforced: true };
    }

    /*
     * LYING IS EASIER THAN ERASING (Z5) — the transform road takes its relief
     * off the same threshold, after the tool and after the fresh-scene window.
     * Clamped at zero by `cleanupDc`; taken here rather than inside it because
     * a discount that depends on WHICH action was attempted is not a property
     * of the trace.
     */
    const transforming = mode === "transform";
    const relief = transforming ? (CLEANUP.transformAction?.dcRelief ?? 0) : 0;
    const dc = (() => {
        const base = cleanupDc(data.visibility, actor);
        return base === null ? null : Math.max(0, base - relief);
    })();
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
        leftBehind: null,
        // G-20: what the trace was before it was relabelled. A Reroll putting
        // back a DELETED trace re-creates it; putting back a transformed one
        // only has to say what it used to be.
        transformed: null
    };

    // One point, both roads (Dawid, 29.08). It used to be Stage 6's price alone,
    // which made the tile the cheaper way to do the same thing.
    await spendStress(actor);

    const done = [];

    /*
     * G-20: THE CRITICAL'S SECOND OPTION.
     *
     * Checked before the removal rather than instead of it, and every clause
     * here is load-bearing:
     *
     *   the outcome must allow it   — `mayTransform`, so the permission lives
     *                                 in the rules table with everything else
     *   it must be a critical       — a Hope success erases and nothing more
     *   the lists must accept it    — trap 115. A packet naming `key` or
     *                                 `final` would turn a piece of evidence
     *                                 the GM placed to make the case solvable
     *                                 into whatever the killer fancied.
     *
     * Reinforced traces never get here: they are refused above, before the
     * Sanity is spent, and a critical does not lift that.
     */
    /*
     * THE TRANSFORM ROAD'S OWN VERDICT (Z5).
     *
     * Placed before the erase branch and returning through the same report, so
     * the two roads cannot drift apart on anything except what they do to the
     * trace.
     *
     * A success applies what the player declared: a new type, or one band of
     * quiet. A critical applies BOTH — and where the player asked for the quiet
     * half there is no second thing to give, so the critical's extra is the
     * Sanity back. That asymmetry is deliberate and is argued in config.mjs.
     *
     * A failure falls through to `raisesVisibility` below, which is the same
     * punishment the erase road takes, for the same reason: you disturbed it.
     */
    if (transforming && success) {
        const bounds = CLEANUP.transform ?? {};
        const wantsType = change?.type && bounds.types?.includes(change.type);
        const quieter = !wantsType || isCritical;

        const ladder = REMNANT_VISIBILITY;                  // obvious → hidden
        const at = ladder.indexOf(data.visibility);
        const step = CLEANUP.transformAction?.quieter ?? 1;
        const softer = quieter && at >= 0 && at < ladder.length - 1
            ? ladder[Math.min(ladder.length - 1, at + step)]
            : null;

        const patch = {};
        if (wantsType) patch.type = change.type;
        if (softer) patch.visibility = softer;

        if (Object.keys(patch).length) {
            try {
                const { retuneRemnant } = await import("./remnants.mjs");
                receipt.transformed = {
                    id: token.id,
                    sceneId: token.parent?.id ?? null,
                    from: { type: data.type, visibility: data.visibility }
                };
                await retuneRemnant(token.parent?.id ?? null, token.id, patch);
                const { REMNANT_TYPES, REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");
                done.push(game.i18n.format("DRPG.Cleanup.transformed", {
                    from: `${data.visibilityLabel} ${data.typeLabel}`,
                    to: `${REMNANT_VISIBILITY_LABELS[patch.visibility ?? data.visibility]
                        ?? data.visibilityLabel} ${
                        REMNANT_TYPES[patch.type ?? data.type]?.label ?? data.typeLabel}`
                }));
            } catch (err) {
                error("Could not rewrite the Remnant a transform reshaped", err);
            }
        } else {
            // Asked for quiet on something already as quiet as it goes, and
            // rolled well enough to get it. Said out loud rather than reported
            // as a success with nothing after it.
            done.push(game.i18n.localize("DRPG.Cleanup.alreadyQuietest"));
        }

        const back = CLEANUP.transformAction?.refundStress?.[band];
        if (back) {
            await restoreStress(actor, back);
            done.push(game.i18n.format("DRPG.Cleanup.stressBack", { n: back }));
        }

        await report(actor, data, { band, success, total, dc, done, viaAction });
        lastAttempt.set(actorId, receipt);
        log(`Transform: ${actor.name} rolled ${total} against DC ${dc} on a ${
            data.visibility} ${data.type} — ${band}.`);
        return { removed: false, transformed: true, band, success };
    }

    const rules = CLEANUP.transform ?? {};
    const rewrite = isCritical && outcome.mayTransform && transform
        && rules.types?.includes(transform.type)
        && rules.visibilities?.includes(transform.visibility)
        ? transform
        : null;

    if (rewrite) {
        try {
            const { retuneRemnant } = await import("./remnants.mjs");
            receipt.transformed = {
                id: token.id,
                sceneId: token.parent?.id ?? null,
                from: { type: data.type, visibility: data.visibility }
            };
            await retuneRemnant(token.parent?.id ?? null, token.id, {
                type: rewrite.type, visibility: rewrite.visibility
            });
            const { REMNANT_TYPES, REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");
            done.push(game.i18n.format("DRPG.Cleanup.transformed", {
                from: `${data.visibilityLabel} ${data.typeLabel}`,
                to: `${REMNANT_VISIBILITY_LABELS[rewrite.visibility] ?? rewrite.visibility} ${
                    REMNANT_TYPES[rewrite.type]?.label ?? rewrite.type}`
            }));
        } catch (err) {
            error("Could not rewrite the Remnant a critical clean-up transformed", err);
        }
    } else if (outcome.removes && !transforming) {
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

    /*
     * A DESPAIR FAILURE MAKES THE MESS LOUDER (Z5), instead of making a second
     * one. See `CLEANUP.outcome.failureDespair` for why.
     *
     * The trace is still there — `removes` is false on this band — so this is
     * the same object, one band further up the ladder. At `obvious` there is
     * nowhere left to go and the attempt simply failed, which is honest: you
     * cannot make a thing more visible than the loudest the game has.
     */
    if (outcome.raisesVisibility && !rewrite) {
        const ladder = REMNANT_VISIBILITY;                  // obvious → hidden
        const at = ladder.indexOf(data.visibility);
        const louder = at > 0 ? ladder[Math.max(0, at - outcome.raisesVisibility)] : null;

        if (louder && louder !== data.visibility) {
            try {
                const { retuneRemnant } = await import("./remnants.mjs");
                receipt.transformed = {
                    id: token.id,
                    sceneId: token.parent?.id ?? null,
                    from: { type: data.type, visibility: data.visibility }
                };
                await retuneRemnant(token.parent?.id ?? null, token.id, { visibility: louder });
                const { REMNANT_VISIBILITY_LABELS } = await import("./config.mjs");
                done.push(game.i18n.format("DRPG.Cleanup.louder", {
                    what: `${data.visibilityLabel} ${data.typeLabel}`,
                    to: REMNANT_VISIBILITY_LABELS[louder] ?? louder
                }));
            } catch (err) {
                error("Could not make the trace a failed clean-up disturbed more visible", err);
            }
        } else {
            done.push(game.i18n.localize("DRPG.Cleanup.alreadyLoudest"));
        }
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
    // outcome in Stage 6 that gives the Sanity back. Applied after `spendStress`
    // rather than instead of it, so the receipt's `stressBefore` still describes
    // the state a Reroll has to restore.
    // Handed back on both roads now, because both roads paid.
    if (outcome.refundStress) {
        await restoreStress(actor, outcome.refundStress);
        done.push(game.i18n.format("DRPG.Cleanup.stressBack", { n: outcome.refundStress }));
    }

    await report(actor, data, { band, success, total, dc, done, viaAction });
    lastAttempt.set(actorId, receipt);

    log(`Cleanup: ${actor.name} rolled ${total} against DC ${dc} on a ${data.visibility} ${data.type} — ${band}${
        rewrite ? `, rewritten as ${rewrite.visibility} ${rewrite.type}` : ""}.`);
    return { removed: Boolean(outcome.removes && !rewrite), transformed: Boolean(rewrite), band, done };
}

/* ==========================================================================
 * STAGE 6'S OTHER TWO ACTIONS
 * --------------------------------------------------------------------------
 * "Zatarcie śladów" above removes evidence. These two do the opposite and the
 * unrelated: one manufactures evidence against somebody else, the other moves
 * the largest piece of evidence in the room.
 *
 * They share the erase-trace shape — 1 Sanity, killer in the room, rolled on
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
 * and priced the way neither of those is: entirely in Sanity.
 *
 * It never blocks the action. Failing means the room watched you scrub a murder
 * scene, which is a social catastrophe rather than a mechanical one, and the
 * guide gives it no "you may not continue" clause. What it costs is Sanity —
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

    await whisperToOwner(actor, `${cardHead({ action: def.label, total: roll.total })}<p>${
        foundry.utils.escapeHTML(line)}</p>`);

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
            await announce({
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
 * A resolution action costs one of the day's two, on top of the Sanity.
 *
 * Stage 6 used to run on Sanity alone, which meant it ran on nothing the table
 * could see: a killer with Sanity to spare could scrub every trace in the room
 * one after another, in a stage that is supposed to be a handful of frantic
 * choices. Charging an action caps it at two per time of day — the same budget
 * everything else in the game is bought with — and makes "what do I do with the
 * time I have" the question it was always meant to be.
 *
 * Both costs, deliberately (Dawid's call, 2026-08-17). The Sanity is what makes
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
function stageSixDef(actor, key, { viaAction = false } = {}) {
    const def = CLEANUP.actions?.[key];
    if (!def) {
        // The one refusal with nothing to say to a player: a key that is not in
        // the table cannot come from the sheet, only from a bad call. It still
        // has to reach somebody, so it goes to the log rather than nowhere.
        error(`No Stage 6 action named "${key}".`);
        return null;
    }
    // Whose scene this is, is Stage 6's question. Having a point of Sanity to
    // spend is everybody's — see `attemptCleanup` for why that changed.
    if (!viaAction && !isCleaner(actor)) {
        refuseCleanup(actor);
        return null;
    }
    if (resourceValue(actor, "stress") >= resourceMax(actor, "stress")) {
        ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.noStressForThis"));
        return null;
    }
    return def;
}

/**
 * Who a false trail can point at.
 *
 * Shared by Stage 6's picker and the Tamper tile, because they must not be able
 * to disagree about it. Two exclusions and both matter: yourself, because a
 * trail pointing at you is not a frame-up, and a Monokuma, because they are not
 * in the suspect pool the trial draws from.
 *
 * The murder victim is excluded only when there IS one. Framing the person
 * lying dead in the room is a confession with extra steps — but outside an
 * incident `murderState()` has no victim and the filter simply does not bite.
 */
export async function framingCandidates(actor) {
    const { livingStudents } = await import("./chapter.mjs");
    const victimId = murderState()?.victimId;
    return livingStudents()
        .filter(a => a.id !== actor?.id && a.id !== victimId && !isMonokuma(a));
}

/**
 * Roll one of the two, on the killer's own client.
 *
 * @param {Actor} actor
 * @param {"misleadingTrail"|"moveBody"} key
 * @param {string|null} targetId  The framed player, for a misleading trail.
 */
export async function attemptStageSix(actor, key, targetId = null, { viaAction = false } = {}) {
    const def = stageSixDef(actor, key, { viaAction });
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
            // `cleanupKey` names WHICH of the three this was. `cleanup` keeps
            // holding the same value it always did so nothing that reads the
            // old bookmark shape breaks — see `settleCleanup` in reroll.mjs.
            actionKey: "cleanup",
            context: {
                cleanup: key, cleanupKey: key,
                cleanupTarget: targetId, cleanupVia: viaAction
            },
            title: game.i18n.localize(key === "moveBody"
                ? "DRPG.Cleanup.moveAction"
                : viaAction ? "DRPG.Tamper.trailAction" : "DRPG.Cleanup.trailAction")
        });
    } finally {
        calls.clearSituational();
    }
    if (!roll) return null;

    // Including "move the body", where the tool lowers the threshold instead of
    // granting advantage: it is still the thing in their hands.
    await breakOnDespair(actor, tool, roll);

    const { requestCleanup } = await import("./gm-bridge.mjs");
    await requestCleanup({
        actorId: actor.id,
        tokenId: null,
        key,
        targetId,
        total: roll.total,
        isCritical: Boolean(roll.isCritical),
        withHope: Boolean(roll.withHope),
        viaAction
    });
    return { roll };
}

/** Score a misleading trail or a body move. GM side. */
export async function resolveStageSix({
    actorId, key, targetId = null, total = 0, isCritical = false, withHope = false,
    viaAction = false
} = {}) {
    if (!game.user.isGM) return null;
    const actor = game.actors.get(actorId);
    const def = CLEANUP.actions?.[key];
    if (!actor || !def) return null;
    if (!viaAction && !isCleaner(actor)) return null;

    /*
     * ONE OF THE THREE IS STAGE 6 ONLY, AND IT IS THE OBVIOUS ONE.
     *
     * Erasing a trace and planting one are things anybody can do on an ordinary
     * afternoon. Carrying a body is not: there has to be a body, `applyMoveBody`
     * reads it off `murderState()`, and a Tamper packet naming "moveBody" would
     * otherwise reach a function that assumes an incident it is not in.
     */
    if (viaAction && key === "moveBody") {
        error(`Refused a Tamper by ${actor.name}: a body is not an ordinary action.`);
        return null;
    }

    // The tool lowers the number it has to beat, "+(1*tier narzędzia)".
    const relief = def.toolBonusPerTier ? cleaningTier(actor) * def.toolBonusPerTier : 0;
    const threshold = Math.max(0, (def.threshold ?? 0) - relief);
    const success = isCritical || total >= threshold;
    const band = isCritical ? "critical" : (withHope ? "hope" : "despair");

    // One point, both roads — see `attemptCleanup`.
    await spendStress(actor);
    const done = [];

    if (key === "misleadingTrail") await applyMisleadingTrail(actor, def, targetId, success, band, done);
    else if (key === "moveBody") await applyMoveBody(actor, def, success, band, done, targetId);

    const refund = success ? def.refundStress?.[band] : null;
    if (refund) {
        await restoreStress(actor, refund);
        done.push(game.i18n.format("DRPG.Cleanup.stressBack", { n: refund }));
    }

    // Three shapes for one idea lived here: this card led with an `<h3>`, the
    // one above with `<strong>Label</strong> —`, and the GM's copy below with a
    // third. All three are the same sentence — what was done, what it rolled,
    // what came of it — so all three are the header now.
    await whisperToOwner(actor, `${cardHead({
        action: def.label, total, result: `${success ? "≥" : "<"} ${threshold}`
    })}${done.length ? `<ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>` : ""}`);
    await whisperToGms(`${cardHead({ action: def.label, total, result: band })}<p>${
        foundry.utils.escapeHTML(actor.name)} vs ${threshold}</p>`);

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
        // TRAP 88 — WHO PLANTED IT, IN THE COLUMN A GM ACTUALLY READS.
        //
        // Now that an innocent player can plant these, the dashboard is the
        // only place the table's one deliberate lie can be seen for what it is.
        // The ledger already stores `sourceActor`/`sourceName`, but the note is
        // the line the Remnant list prints under the action — so it says both
        // ends of the lie: who left it, and who it accuses.
        note: game.i18n.format("DRPG.Cleanup.trailNote", {
            name: framed?.name ?? "?", visibility, by: actor.name
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
 * comes back, then the Sanity. Doing it the other way round would briefly leave
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

    // G-20's other half. A rewritten trace was never deleted, so putting it
    // back is a second retune rather than a re-creation — and it has to happen,
    // or a Reroll would leave the relabelling standing on top of a roll that no
    // longer produced it.
    if (receipt.transformed?.from) {
        try {
            const { retuneRemnant } = await import("./remnants.mjs");
            await retuneRemnant(receipt.transformed.sceneId, receipt.transformed.id,
                receipt.transformed.from);
        } catch (err) {
            error("Could not put back the Remnant a rerolled clean-up rewrote", err);
        }
    }

    if (typeof receipt.stressBefore === "number") {
        try {
            await automatedUpdate(actor, {
                "system.resources.stress.value": receipt.stressBefore
            });
        } catch (err) {
            error("Could not refund the Sanity a rerolled clean-up spent", err);
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
        error("Could not charge the Sanity for a clean-up", err);
    }
}

/**
 * Hand Sanity back. Sanity is a reverse resource, so "restoring" it is
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
        error("Could not give back the Sanity a critical clean-up earned", err);
    }
}

/**
 * Two different messages on purpose.
 *
 * The killer is told what happened to the scene. The GMs are told that plus the
 * threshold it was measured against, because that number is the answer key and
 * the killer must not learn how visible their own traces are by subtraction.
 */
async function report(actor, data, { band, success, total, dc, done, viaAction = false }) {
    const summary = done.map(line => `<li>${line}</li>`).join("");

    /*
     * The killer's card, and on a miss it carries a sound.
     *
     * `resolveCleanup` is GM-side, so this goes on the message rather than
     * through `playSfx` — same reason as the broken tool. Failure only: a
     * successful wipe removes a trace the killer selected and is already
     * watching, while a miss spends the Sanity, leaves what they were scrubbing
     * at, and on Despair adds an Obvious one they did NOT choose and are not
     * told about.
     */
    await whisperToOwner(actor, `
        <h3>${game.i18n.localize("DRPG.Cleanup.title")}</h3>
        <p><strong>${game.i18n.localize(`DRPG.Cleanup.band.${band}`)}</strong></p>
        ${summary ? `<ul>${summary}</ul>` : ""}
        ${viaAction
            ? `<p><small>${game.i18n.localize("DRPG.Tamper.actionSpent")}</small></p>`
            : `<p><small>${game.i18n.format("DRPG.Cleanup.stressSpent", {
                n: RESOLUTION_STRESS_COST })}</small></p>`}`,
        success ? {} : { flags: { [MODULE_ID]: { sfx: "cleanupFailed" } } });

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
/**
 * The thing this character used in the incident, if anything wrote it down.
 *
 * Only the weapon is remembered — the swing is a single identifiable moment,
 * while cleaning is several actions with possibly several rags, and "the one in
 * your hands when the body turned up" is the honest answer for those.
 */
function rememberedTool(actor, category) {
    if (category !== "crimeTool") return null;
    const id = actor?.getFlag?.(MODULE_ID, FLAGS.swungWeapon);
    const item = id ? actor.items.get(id) : null;
    // Gone, already ruined, or stashed since: fall back to the hand.
    return item && !isBroken(item) && !isStashed(item) ? item : null;
}

async function destroyTools(actor, categories) {
    if (!game.user.isGM || !actor || !categories?.length) return [];

    const { breakItem } = await import("./inventory.mjs");
    const destroyed = [];
    for (const category of categories) {
        /*
         * WHAT WAS USED, and only then what is in hand.
         *
         * BY ROLE: the killer who wiped the scene with a rag filed under Tools
         * used a cleaning tool, and the guide's "the gloves come off when the
         * body turns up" is about what was used, not which row it sits in.
         *
         * BY MEMORY for the weapon: with one hand (E9) a killer holds the knife
         * for the murder and the gloves for the clean-up, so reading the hand at
         * closing time would spare the murder weapon every single time. The
         * swing wrote down what it swung; that is the thing this destroys.
         */
        const item = rememberedTool(actor, category) ?? equippedFor(actor, category);
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
