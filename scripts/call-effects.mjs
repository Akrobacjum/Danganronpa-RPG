/**
 * Danganronpa RPG - making Calls actually happen.
 * ---------------------------------------------------------------------------
 * A Call that only deducts a resource and prints a sentence is a receipt, not a
 * rule. These apply the effect:
 *
 *   · effects that land now      - damage, stress, project progress, sealed rooms
 *   · effects that arm the dice  - advantage, experiences, a free critical
 *
 * The second kind is stored as a *pending call* on the character. The roll
 * dialog keeps those controls disabled until one is armed, which is what makes
 * them Calls rather than free checkboxes - see roll-dialog.mjs.
 */

import { MODULE_ID, FLAGS, HOPE_CALLS, DESPAIR_CALLS, MOTIVE, STARTING, callEffect } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { automatedUpdate } from "./resource-guard.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
// The darkening's own reader, and a leaf: static so `refusalBeforePaying` can
// stay synchronous for the sheet, which asks it between two windows.
import { overflowBlocksHope } from "./overflow.mjs";
// projects.mjs is NOT imported here statically: it reaches this file through
// fog.mjs and movement.mjs, and a top-level import back would close a static
// cycle - the notes on the imports in both of those files say there is none.
// Every use below is lazy.
import {
    announce, whisperToOwner, dialogContent, log, warn, error, plural, cardHead, isPrimaryGm,
    esc} from "./utils.mjs";

/** Let the victim of a Call know what has been done to them. */
async function tell(actor, key) {
    try {
        await whisperToOwner(actor, `<p class="drpg-warning">${game.i18n.localize(key)}</p>`);
    } catch {
        // The restriction stands whether or not the notice got through.
    }
}

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * PENDING CALLS
 * ========================================================================== */

/**
 * Supporting rolls must not touch an armed Call.
 *
 * Sabotage rolls to conceal itself before it rolls to sabotage; an indirect
 * murder rolls to conceal intent and again to hide its traces. Every one of
 * those went through the same pipeline as the real roll, so a Call bought for
 * the sabotage was applied to - and consumed by - the concealment roll instead.
 * The player paid for advantage on the thing that mattered and got it on the
 * thing that did not.
 *
 * Held as a module-level flag rather than threaded through every call site: the
 * roll dialog reads the armed Call from its own hook, with no access to the
 * action's arguments.
 */
let shielded = 0;

export function shieldCalls() { shielded += 1; }
export function unshieldCalls() { shielded = Math.max(0, shielded - 1); }

/**
 * Advantage that nobody paid Hope for.
 *
 * Some advantage comes from the situation rather than from a Call: looking for
 * bandages in the medic's office, digging through a stash somebody has taken
 * pains to hide. It is armed around one roll and cleared straight after, and it
 * hides behind the same shield as a Call so a supporting roll cannot eat it.
 *
 * A module-level value for the same reason `shielded` is one: the roll dialog
 * reads this from its own hook and never sees the action's arguments.
 *
 * IT IS A COUNT, NOT A SIGN (E7). This used to store `Math.sign(value)`, and
 * the arithmetic it flattened was already being done: `performSearch` adds a
 * favouring room, a hindering room and somebody's concealed stash; a crisis
 * roll adds a weapon in hand, a second try after a miss and the guide's
 * "the victim gets advantage on every roll" for dying alone to a trap. All of
 * that was summed, carefully, and then thrown away at this line. A victim with
 * three reasons to be helped got exactly as much as one with a single reason.
 */
let situational = 0;

/**
 * @param {number} value  Signed, and its SIZE matters: +2 means two dice.
 *   Truncated because a die count is a whole number and a caller that computed
 *   a fraction has made a mistake this file should not carry forward.
 */
export function armSituational(value) {
    situational = Math.trunc(Number(value)) || 0;
}

export function clearSituational() { situational = 0; }

/**
 * A signed count. Zero while a supporting roll is shielded.
 *
 * The shield is why trap 57 needs nothing done to it: a concealment roll sees
 * zero here and `null` from `pendingCall`, so BOTH bought sources vanish
 * together, whatever their size. The character's own Breakdown is deliberately
 * not shielded and never was - see `stateGrant` in roll-dialog.mjs.
 */
export function situationalAdvantage() {
    return shielded ? 0 : situational;
}

/**
 * Every Call armed on this character, oldest first.
 *
 * THEY STACK (CALL-02, Dawid 17.09). It was one slot, and arming a second Call
 * silently deleted the first with nothing refunded: a Monokuma's Obstacle ate
 * the Support a player had just paid a Hope for, and six Hope of Loaded Die went
 * the same way. A Call is a purchase, and two purchases are two Calls - so
 * advantage and disadvantage add up on the dice, and the ones that are not dice
 * (a Loaded Die, an Experience, Determination, a Confusion's flat bonus) all
 * apply to the same roll. A second copy of the SAME Call is refused before
 * anything is paid; see `refusalBeforePaying`.
 *
 * A world armed before this change holds one payload object rather than a list,
 * so that shape is still read.
 */
export function pendingCalls(actor) {
    if (shielded) return [];
    const stored = actor?.getFlag?.(MODULE_ID, FLAGS.pendingCall) ?? null;
    if (!stored) return [];
    return (Array.isArray(stored) ? stored : [stored]).filter(entry => entry?.grants);
}

/** The first Call armed on this character, for the readers that want just one. */
export function pendingCall(actor) {
    return pendingCalls(actor)[0] ?? null;
}

/**
 * Which grants a Call rides on the dice. Everything else is a permission or a
 * flat number, and two of those on one roll are two different things happening -
 * two of the SAME are one purchase made twice, which is what gets refused.
 */
const DICE_GRANTS = new Set(["advantage", "disadvantage"]);

/**
 * Why a player's client may not arm this Call on somebody else's character, or
 * null when it may (E03, 24.09.2026; audit S10-09). The one Call that honestly
 * travels this way is a Hope Call aimed at another player - Support - with the
 * `grants` the table gives it. A Despair Call is a Monokuma's, and a Monokuma is a
 * GM, whose client arms it directly. Pure, for the suite.
 */
export function playerArmRefusal(call) {
    const def = HOPE_CALLS[call?.key];
    if (!def) return `"${call?.key}" is not a Hope Call a player can buy for somebody else`;
    if (def.target !== "player") return `"${call.key}" is not aimed at another player`;
    if (!def.grants || def.grants !== call.grants) return `"${call.key}" does not grant "${call?.grants}"`;
    return null;
}

/** Is this Call already armed on this character, in a way a second copy adds nothing to? */
export function alreadyArmed(actor, call) {
    if (!call?.grants || DICE_GRANTS.has(call.grants)) return false;
    return pendingCalls(actor).some(entry => entry.key === call.key || entry.grants === call.grants);
}

/**
 * Arm a Call so the next roll can use what it bought.
 *
 * Support and Approval arm someone *else*, and a player has no write access
 * to another player's actor - the flag write throws "lacks permission". Those go
 * through the GM, who does have it. The Monokuma side never needs the detour:
 * a GM can write to anyone.
 */
export async function armCall(actor, { key, kind, grants, amount = null, from = null }) {
    if (!actor || !grants) return null;

    // `amount` only means something for `grants: "bonus"` - Monocub's Meddle is
    // the one caller that needs it, for the +1/-1 tier of its table. Every
    // other grant ignores it; carried through unconditionally so this stays a
    // small, boring change rather than a bonus-specific code path.
    // `nonce` names this one purchase. The Loaded Die is spent by the first roll
    // that throws it, and two windows opened on the same Call carry the same
    // name - see `LOADED_DIE` in forced-roll.mjs.
    const payload = { key, kind, grants, amount, from, nonce: foundry.utils.randomID() };

    if (!actor.isOwner) {
        // Answered now, not just sent (E03): the GM charges the buyer and may
        // refuse, and null here is "not armed, and nothing was charged".
        const { requestArmCall } = await import("./gm-bridge.mjs");
        const res = await requestArmCall(actor.id, payload);
        if (!res.ok || !res.value) return null;
        log(`The GM armed ${key} on ${actor.name} (${grants}).`);
        return true;
    }

    await appendArmedCall(actor, payload);
    log(`${actor.name} has ${key} armed (${grants}).`);

    // Tell the beneficiary, when they are not the buyer.
    //
    // A GM owns every actor, so a Monokuma arming Obstacle or Approval took
    // this branch and set the flag in silence - the player then met a roll
    // window with disadvantage already switched on and locked, and no reason
    // given. The socket path told them; the path that actually matters did not.
    if (from && from !== actor.id) {
        // "Another student spent Hope on you" was said for Monokuma's Obstacle
        // too, and for a Monocub's Meddle - whose author must stay unnamed.
        const voice = kind === "despair" ? "DRPG.Calls.armedByMonokuma"
            : kind === "hope" ? "DRPG.Calls.armedForYou"
            : "DRPG.Calls.armedByNobody";
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.armedTitle")
        })}<p>${
            game.i18n.format(voice, {
                what: game.i18n.localize(`DRPG.Calls.grants.${grants}`)
            })
        }</p>`);
    }

    return true;
}

/**
 * The armed list as stored, shield and all - the one reader that must see what is
 * really on the actor, because it is about to write the list back.
 */
function pendingCallsRaw(actor) {
    const stored = actor?.getFlag?.(MODULE_ID, FLAGS.pendingCall) ?? null;
    if (!stored) return [];
    return (Array.isArray(stored) ? stored : [stored]).filter(entry => entry?.grants);
}

/**
 * Add one ready payload to the armed list. GM-side, and the one writer: the
 * bridge arms Support and Approval on somebody else's sheet through here, so
 * stacking (CALL-02) holds on that road too.
 */
export async function appendArmedCall(actor, payload) {
    if (!actor || !payload?.grants) return null;
    await actor.setFlag(MODULE_ID, FLAGS.pendingCall, [...pendingCallsRaw(actor), payload]);
    return true;
}

/**
 * Spend the armed Calls. Called by the roll pipeline once they have been used.
 *
 * All of them, because all of them applied: they were bought for the next roll
 * and the next roll has happened (CALL-02).
 */
export async function consumeCalls(actor) {
    if (shielded) return [];
    const pending = pendingCallsRaw(actor);
    if (!pending.length) return [];
    await actor.unsetFlag(MODULE_ID, FLAGS.pendingCall);
    return pending;
}

/**
 * Spend every armed Call except the ones granting `keep`.
 *
 * One window, two fates (CALL-02 with CALL-03): a statistic rolled off the sheet
 * while a Loaded Die is held uses the Support armed beside it and cannot use the
 * 12, so the Support is spent and the Loaded Die waits for the action it was
 * bought for. Returns what was spent.
 */
export async function consumeCallsExcept(actor, keep = null) {
    if (shielded) return [];
    const pending = pendingCallsRaw(actor);
    if (!pending.length) return [];
    const kept = keep ? pending.filter(entry => entry.grants === keep) : [];
    const spent = pending.filter(entry => !kept.includes(entry));
    if (!spent.length) return [];
    if (kept.length) await actor.setFlag(MODULE_ID, FLAGS.pendingCall, kept);
    else await actor.unsetFlag(MODULE_ID, FLAGS.pendingCall);
    return spent;
}

/**
 * The single-slot name, kept so a caller written before CALL-02 still spends
 * every armed Call rather than none. Answers with the first one spent.
 */
export async function consumeCall(actor) {
    return (await consumeCalls(actor))[0] ?? null;
}

/** Does this character have permission for a given roll control right now? */
export function grants(actor, what) {
    return pendingCalls(actor).some(entry => entry.grants === what);
}

/* ==========================================================================
 * APPLYING A CALL
 * ========================================================================== */

/**
 * Would this Call change nothing? Asked before a Despair Call is PAID.
 *
 * Review of CALL-15 and CALL-05 (17.09): `applyCall` refuses these and hands the
 * price back. The public "spent" card waits for the effect on both lines now
 * (DESP-11, CALL-13), so a refusal there no longer tells the table about a
 * purchase that did not happen - but it still charges the pool, refunds it, and
 * only then says why. The same questions, asked of the picker's answer before
 * the pool is touched, give the reason first and move nothing. `applyCall` keeps
 * its own checks: the world can move between the two.
 *
 * ONE DARKENING CHECK, NOT TWO. DESP-04 asked `overflowBlocksHope` in
 * `spendDespairCallFor` itself; it is this function's `grantsHope` question now,
 * with the same `hopeBlocked` sentence, so the Monokuma is told once.
 *
 * Synchronous, because the sheet asks it between the picker and the
 * confirmation. The project question needs projects.mjs, which this file can
 * only import lazily, so it is `projectRefusal` below and is awaited separately.
 *
 * @returns {string|null}  Why not, ready to show; null when the Call would land.
 */
export function refusalBeforePaying(call, choice = {}) {
    const i18n = game.i18n;
    const target = choice.target ?? null;
    if (call?.sealsRoom && choice.room && isSealed(choice.room)) {
        return i18n.format("DRPG.Calls.alreadySealed", { room: choice.room });
    }
    if (call?.silences && target && isSilenced(target)) {
        return i18n.format("DRPG.Calls.alreadySilenced", { name: target.name });
    }
    if (call?.chains && target && isChained(target)) {
        return i18n.format("DRPG.Calls.alreadyChained", { name: target.name });
    }
    if (call?.damage && target && Object.keys(call.damage)
        .every(resource => resourceValue(target, resource) >= resourceMax(target, resource))) {
        return i18n.format("DRPG.Calls.nothingToMark", { name: target.name });
    }
    // A second copy of the same Call adds nothing, and the first is still there
    // to be used (CALL-02). Dice Calls are exempt: those stack by design.
    if (call?.grants && target && alreadyArmed(target, call)) {
        return i18n.format("DRPG.Calls.alreadyArmed", { name: target.name, call: call.label });
    }
    if (call?.grantsHope && target) {
        if (overflowBlocksHope()) return i18n.localize("DRPG.Overflow.hopeBlocked");
        const max = resourceMax(target, "hope") || STARTING.hopeMax;
        if (resourceValue(target, "hope") >= max) return i18n.localize("DRPG.Despair.hopeAlreadyFull");
    }
    return null;
}

/**
 * The project half of `refusalBeforePaying`, which has to await (CALL-10).
 *
 * The API and a stale picker can both name a project that cannot move: a
 * finished one, or one a sabotage has frozen. `pickProject` already leaves those
 * out of the list; this is the boundary behind it, asked by `spendDespairCallFor`
 * before the pool is touched.
 *
 * @returns {Promise<string|null>}  Why not, ready to show; null when it can move.
 */
export async function projectRefusal(call, choice = {}) {
    if (!call?.progress || !choice.project) return null;
    const { allProjects, isComplete, isFrozen } = await import("./projects.mjs");
    const project = allProjects().find(p => p.id === choice.project);
    if (!project || isComplete(project) || isFrozen(project.id)) {
        return game.i18n.localize("DRPG.Project.noneToMove");
    }
    return null;
}

/**
 * Thrown by a branch whose target is already where the Call would put it - a
 * full Health track, a room already sealed. The price goes back like any other
 * failure, but it is not a fault, so it is neither logged as an error nor given
 * the "could not be applied" line a fault gets; the branch has already said what
 * was wrong (CALL-15).
 */
class NothingToDo extends Error {}

/* --------------------------------------------------------------------------
 * ONE FUNCTION PER EFFECT, run by `applyCall` below in the order they have
 * always run. The split is Hygiene C - bodies moved, nothing else; the guards
 * inside them are the far side of the rule `refusalBeforePaying` states at the
 * door. The picker's answer can go stale between the two, so the branch that is
 * about to write asks again, and throws `NothingToDo` when there is nothing
 * left to do - which refunds without calling it a fault.
 * -------------------------------------------------------------------------- */

// --- effects that arm the next roll ---
async function grantEffect(actor, call, choice, done, { key, kind }) {
    // Support and Approval arm someone else; the rest arm the caller.
    const beneficiary = choice.target ?? actor;

    // The boundary for CALL-02: the picker refuses this before paying, and
    // a world that moved in between refuses here and hands the price back.
    if (alreadyArmed(beneficiary, call)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadyArmed",
            { name: beneficiary.name, call: call.label }));
        throw new NothingToDo(`${beneficiary.name} already holds ${call.key}`);
    }

    const armed = await armCall(beneficiary, { key, kind, grants: call.grants, from: actor.id });

    // `armCall` returns null when the flag could not be written - no GM
    // online to forward it, or the write itself failed. Announcing it
    // anyway is how six Hope bought a Free Critical that was never armed
    // and never refunded, because the receipt line made the Call look
    // like it had done something.
    if (!armed) throw new Error(`could not arm ${key} on ${beneficiary.name}`);

    done.push(game.i18n.format("DRPG.Calls.armed", {
        name: beneficiary.name,
        what: game.i18n.localize(`DRPG.Calls.grants.${call.grants}`)
    }));
}

// --- Despair spent as somebody else's Hope ---
//
// The pool has ALREADY been charged by `spendDespairCall`, so this only
// credits the Hope. Routing it through `convertDespairToHope` would take
// the Despair a second time - the exchange rate is the Call's own cost.
async function hopeFromDespairEffect(actor, call, choice, done) {
    // No Hope is earned under the Despair darkening, and this is Hope earned:
    // the write would be stripped and the Call would still report "gains 1
    // Hope" and keep its Despair (DESP-04, CALL-05). `refusalBeforePaying`
    // asks first; this is the far side of it, for a darkening that began while
    // the picker was open. Not a fault, so no "tell the GM".
    if (overflowBlocksHope()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Overflow.hopeBlocked"));
        throw new NothingToDo("the darkening blocks Hope");
    }
    const max = resourceMax(choice.target, "hope") || STARTING.hopeMax;
    const held = resourceValue(choice.target, "hope");
    const next = Math.min(max, held + call.grantsHope);

    if (next === held) {
        ui.notifications.warn(game.i18n.localize("DRPG.Despair.hopeAlreadyFull"));
        throw new NothingToDo(`${choice.target.name} is already at maximum Hope`);
    }

    await automatedUpdate(choice.target, { "system.resources.hope.value": next });
    done.push(game.i18n.format("DRPG.Calls.hopeGranted", {
        name: choice.target.name, n: next - held
    }));
    await whisperToOwner(choice.target, `<p>${game.i18n.format("DRPG.Despair.hopeConverted", {
        n: next - held, who: foundry.utils.escapeHTML(actor?.name ?? "Monokuma")
    })}</p>`);
}

/*
 * --- Despair poured into the overflow (Z14) ---
 *
 * No target of its own: the thing it acts on is the world. That is why
 * the Call is `target: "none"` and why this branch runs above the ones
 * that need somebody to point at.
 *
 * The pool has already been charged by `spendDespairCall`, exactly as
 * with `grantsHope` above - this only moves the point to its
 * destination. It pushes a receipt line for the same reason every
 * branch here does: `applyCall` calls a Call with an empty receipt
 * FAILED and hands the price back, so a branch that worked silently
 * would be a Call that worked and then refunded itself (trap 100).
 */
async function feedOverflowEffect(actor, call, choice, done) {
    const { addOverflow, overflowCount, overflowThreshold } =
        await import("./overflow.mjs");
    const after = await addOverflow(call.feedsOverflow, { reason: "Feed the Overflow" });
    if (after === null) throw new Error("the overflow refused the Despair");
    done.push(game.i18n.format("DRPG.Calls.overflowFed", {
        n: call.feedsOverflow, count: overflowCount(), max: overflowThreshold()
    }));
}

// --- damage and stress ---
async function damageEffect(actor, call, choice, done) {
    const update = {};
    // What actually lands, not what the Call is worth: Pain on a student
    // with one mark left used to report "takes 2 Health" and keep all of
    // its price, and on a full track it did nothing at all (CALL-15).
    const landed = [];
    for (const [resource, amount] of Object.entries(call.damage)) {
        // Health and Sanity are reverse resources: marks count up to max.
        const marks = resourceValue(choice.target, resource);
        const max = resourceMax(choice.target, resource);
        const next = Math.min(max, marks + amount);
        if (next === marks) continue;
        update[`system.resources.${resource}.value`] = next;
        landed.push(`${next - marks} ${resource === "hitPoints" ? "Health" : "Sanity"}`);
    }
    if (!landed.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.nothingToMark", { name: choice.target.name }));
        throw new NothingToDo(`${choice.target.name} has nothing left to mark`);
    }
    await automatedUpdate(choice.target, update);
    done.push(game.i18n.format("DRPG.Calls.damaged", {
        name: choice.target.name,
        what: landed.join(", ")
    }));
}

// --- project progress ---
//
// Named from the local project list rather than from what `addProgress`
// returns: a player's write is forwarded to the GM and comes back as a
// bare acknowledgement, so reading the name off it produced a receipt
// saying "progress on ?" - which reads exactly like nothing happened.
// `wipesProgress` went with the Call that carried it (29.08) - see the
// note above the project Calls in config.mjs. The branch went too rather
// than being left standing for nothing: an unreachable handler is how a
// deleted rule comes back by accident.
async function progressEffect(actor, call, choice, done) {
    const { addProgress, allProjects } = await import("./projects.mjs");
    const project = allProjects().find(p => p.id === choice.project);

    if (!project) {
        ui.notifications.warn(game.i18n.localize("DRPG.Project.gone"));
        throw new Error(`project ${choice.project} no longer exists`);
    } else {
        const applied = await addProgress(choice.project, call.progress);
        if (!applied) throw new Error(`addProgress refused ${choice.project}`);

        // A GM's write says outright whether the bar moved. A player's
        // is forwarded, so the answer comes back as a whisper instead -
        // never claim a number this side of the socket.
        if (applied.changed === false) {
            done.push(game.i18n.format("DRPG.Calls.progressRefused", { name: project.name }));
        } else if (applied.changed) {
            done.push(game.i18n.format("DRPG.Calls.progressedTo", {
                name: project.name, current: applied.to, target: applied.target
            }));
        } else {
            done.push(game.i18n.format("DRPG.Calls.progressSent", {
                name: project.name, n: call.progress > 0 ? `+${call.progress}` : call.progress
            }));
        }
    }
}

/*
 * --- crossings, actions and a rest bought with Hope (E13) ---
 *
 * None of the three touches `pendingCall`, and every one of them pushes
 * a receipt line: `applyCall` reports `failed` when nothing was pushed,
 * and a Call that failed hands the Hope back. A branch that did its work
 * silently would be a Call that worked and then refunded itself (trap
 * 100).
 */
async function freeMovesEffect(actor, call, choice, done) {
    const { grantFreeMoves, freeMovesLeft } = await import("./actions.mjs");
    if (!await grantFreeMoves(actor, call.freeMoves)) {
        throw new Error(`could not bank ${call.freeMoves} crossing(s)`);
    }
    done.push(plural("DRPG.Calls.sprinted", { n: freeMovesLeft(actor) }));
}

async function freeActionsEffect(actor, call, choice, done) {
    const { grantFreeActions, freeActionsLeft } = await import("./actions.mjs");
    if (!await grantFreeActions(actor, call.freeActions)) {
        throw new Error(`could not bank ${call.freeActions} action(s)`);
    }
    done.push(plural("DRPG.Calls.burst", { n: freeActionsLeft(actor) }));
}

async function freeRestEffect(actor, call, choice, done) {
    const { takeRest } = await import("./rest.mjs");
    // Every gate a Short Rest normally has, waived - decision 4, and
    // the reasoning is on `relief` in config.mjs. `quiet` because the
    // Call is already printing a card and this is one purchase.
    const rested = await takeRest(actor, call.freeRest, {
        free: true, ignoreRoom: true, ignoreLimit: true, quiet: true
    });
    // Backing out of the "what do you want back" picker is a real
    // cancel: nothing was restored, so the five Hope come back.
    // NothingToDo, not a fault, when the player chose not to (live check,
    // 17.09 - the refund arrived under a "Tell the GM" error toast). A rest
    // that FAILED is a fault and is logged as one: `takeRest` answers false
    // for the first and null for the second.
    if (rested === false) throw new NothingToDo("the rest was not taken");
    if (!rested) throw new Error("the rest failed");
    done.push(...(rested.applied ?? []));
}

// --- reroll the last action ---
async function rerollEffect(actor, call, choice, done) {
    const { rerollLastAction } = await import("./reroll.mjs");
    const lines = await rerollLastAction(actor);
    // `rerollLastAction` has already said why.
    if (!lines) throw new NothingToDo("nothing to reroll");
    done.push(...lines);
}

// --- a new rule, announced to everyone AND written down ---
//
// Twelve Despair used to buy a chat message that scrolled away. The
// rule now lands on the standing list every character sheet carries,
// which is the only form in which a rule can actually bind anybody.
async function newRuleEffect(actor, call, choice, done) {
    const { addRule } = await import("./rules.mjs");
    const recorded = await addRule(choice.text);
    if (recorded) done.push(game.i18n.localize("DRPG.Rules.recorded"));

    await announce({
        // The catalogue has had a `newRule` sound since v1.1.8 and this
        // card - the only thing that announces one - carried no flag, so
        // it was a sound a GM could map a file to and never hear. Found
        // in E17 by asking the question R3 does not: not "does every
        // sound played exist", but "is every sound that exists played".
        // Public, no whisper list, so the whole table hears it - which
        // is what the catalogue entry says it is for.
        flags: { [MODULE_ID]: { sfx: "newRule" } },
        content: `<div class="drpg-new-rule">
            <h3>${game.i18n.localize("DRPG.Calls.newRuleTitle")}</h3>
            <p>${foundry.utils.escapeHTML(choice.text)}</p>
        </div>`
    });
    done.push(game.i18n.localize("DRPG.Calls.newRuleAnnounced"));
}

// --- sealed rooms ---
async function sealRoomEffect(actor, call, choice, done) {
    if (isSealed(choice.room)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadySealed", { room: choice.room }));
        throw new NothingToDo(`${choice.room} is already sealed`);
    }
    // Announced only when written (E03; audit S09-11): `writeWorld` answers
    // null on a client that cannot write, and the card said "sealed" anyway.
    if (!await sealRoom(choice.room)) throw new Error(`could not seal ${choice.room}`);
    done.push(game.i18n.format("DRPG.Calls.sealed", { room: choice.room }));
}

// --- silence: no Hope Calls until this time of day ends ---
async function silenceEffect(actor, call, choice, done) {
    if (isSilenced(choice.target)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadySilenced", { name: choice.target.name }));
        throw new NothingToDo(`${choice.target.name} is already silenced`);
    }
    await restrict(choice.target, { silenced: true });
    done.push(game.i18n.format("DRPG.Calls.silenced", { name: choice.target.name }));
    await tell(choice.target, "DRPG.Calls.silencedNotice");
}

// --- chained: pinned to the room they are standing in ---
async function chainEffect(actor, call, choice, done) {
    if (isChained(choice.target)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.alreadyChained", { name: choice.target.name }));
        throw new NothingToDo(`${choice.target.name} is already chained`);
    }
    const { roomOfActor } = await import("./movement.mjs");
    const here = roomOfActor(choice.target);
    await restrict(choice.target, { chained: true, room: here });
    done.push(game.i18n.format("DRPG.Calls.chained", {
        name: choice.target.name, room: here ?? "-"
    }));
    await tell(choice.target, "DRPG.Calls.chainedNotice");
}

/* --- a motive: a demand, a deadline and a price for missing it ---
 *
 * The whole record comes from the picker, so this branch does nothing
 * but hand it over and report. `setMotive` announces publicly - the
 * guide requires it - which means the receipt below is the SECOND
 * thing the table sees, not the first.
 */
async function motiveEffect(actor, call, choice, done) {
    const { setMotive } = await import("./rules.mjs");
    const record = await setMotive(choice.motive);
    if (!record) throw new Error("the motive was not announced");
    done.push(plural("DRPG.Calls.motiveSet", { n: record.timesOfDay }));
}

/* --- gather everyone, now or at the start of the next time of day ---
 *
 * `defers` is the E14 change and it is the whole Call: nobody moves
 * now, everybody is told where and when, and the crossing they make to
 * get there is their own. The immediate branch is kept because
 * `chapter.mjs` still gathers the cast for a body discovery and a
 * trial, and those are not announcements - they are the game moving
 * the cast because the fiction just did.
 */
async function gatherEffect(actor, call, choice, done) {
    if (call.defers) {
        const order = await scheduleGather(choice.room, actor?.name);
        if (!order) throw new Error(`could not call an assembly in ${choice.room}`);
        done.push(game.i18n.format("DRPG.Calls.gatherCalled", { room: choice.room }));
    } else {
        const moved = await gatherEveryone(choice.room);
        done.push(plural("DRPG.Calls.gathered", { room: choice.room, n: moved }));
    }
}

// --- destroy an item ---
async function destroyItemEffect(actor, call, choice, done) {
    const name = choice.item.name;
    await choice.item.delete();
    done.push(game.i18n.format("DRPG.Calls.destroyed", { item: name }));
}

/**
 * Apply everything a Call does, after it has been paid for.
 *
 * @param {Actor} actor    Who made the Call.
 * @param {string} key
 * @param {"hope"|"despair"} kind
 * @param {object} choice  { target, project, room, item } from the picker.
 * @returns {Promise<{lines: string[], failed: boolean}>} what happened, and
 *   whether the Call delivered nothing - in which case the caller must hand the
 *   price back. A Call that has been paid for and did nothing is a theft: the
 *   Reroll costs 3 Hope, and "there was nothing to reroll" used to keep all
 *   three of them.
 */
export async function applyCall(actor, key, kind, choice = {}) {
    const call = kind === "despair" ? DESPAIR_CALLS[key] : HOPE_CALLS[key];
    if (!call) return { lines: [], failed: true };

    const done = [];

    try {
        // The branches, in the order they have always run.
        if (call.grants) await grantEffect(actor, call, choice, done, { key, kind });
        if (call.grantsHope && choice.target) await hopeFromDespairEffect(actor, call, choice, done);
        if (call.feedsOverflow) await feedOverflowEffect(actor, call, choice, done);
        if (call.damage && choice.target) await damageEffect(actor, call, choice, done);
        if (call.progress && choice.project) await progressEffect(actor, call, choice, done);
        if (call.freeMoves) await freeMovesEffect(actor, call, choice, done);
        if (call.freeActions) await freeActionsEffect(actor, call, choice, done);
        if (call.freeRest) await freeRestEffect(actor, call, choice, done);
        if (call.reroll) await rerollEffect(actor, call, choice, done);
        if (call.announces && choice.text) await newRuleEffect(actor, call, choice, done);
        if (call.sealsRoom && choice.room) await sealRoomEffect(actor, call, choice, done);
        if (call.silences && choice.target) await silenceEffect(actor, call, choice, done);
        if (call.chains && choice.target) await chainEffect(actor, call, choice, done);
        if (call.setsMotive && choice.motive) await motiveEffect(actor, call, choice, done);
        if (call.gathersEveryone && choice.room) await gatherEffect(actor, call, choice, done);
        if (call.target === "item" && choice.item) await destroyItemEffect(actor, call, choice, done);
    } catch (err) {
        if (err instanceof NothingToDo) return { lines: done, failed: true };
        // A Call that has been paid for and did nothing must say so, and must
        // give the price back. Failing quietly is how "Contribution adds no
        // progress, no error" happened.
        error(`Could not fully apply ${key}`, err);
        // One message, from the caller: it refunds and says so (DESP-19). A
        // toast here as well contradicted it a second later ("paid for, but
        // could not be applied" then "did nothing, so it has been returned").
        done.push(game.i18n.format("DRPG.Calls.effectFailed", { call: call.label }));
        return { lines: done, failed: true };
    }

    // Nothing thrown, but nothing happened either: a Call whose every branch was
    // skipped because the picker came back empty is still a Call that took the
    // resource and delivered none of what it promised.
    return { lines: done, failed: done.length === 0 };
}

/* ==========================================================================
 * ROOM EFFECTS AND RESTRICTIONS
 * --------------------------------------------------------------------------
 * Three Despair Calls buy a restriction that lasts until this time of day ends -
 * at the Eclipse that closes it, or when the clock moves without one:
 * a sealed room nobody may enter, a silenced player who may spend no Hope, and
 * a chained player who may not leave the room they are standing in.
 *
 * All three are stored as world state and *enforced* rather than merely
 * recorded. The seal used to be recorded only - the room was announced as
 * sealed and players walked straight in.
 * ========================================================================== */

/** Rooms sealed for this time of day. Cleared when it ends - see `clearSeals`. */
export function sealedRooms() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.sealedRooms) ?? [];
    } catch {
        return [];
    }
}

export function isSealed(room) {
    return Boolean(room) && sealedRooms().includes(room);
}

async function sealRoom(room) {
    const current = new Set(sealedRooms());
    current.add(room);
    return Boolean(await writeWorld(SETTINGS.sealedRooms, Array.from(current)));
}

/** Per-actor restrictions: { [actorId]: { silenced, chained, room } }. */
export function restrictions() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.restrictions) ?? {};
    } catch {
        return {};
    }
}

/** May this character still spend Hope Calls? */
export function isSilenced(actor) {
    return Boolean(actor && restrictions()[actor.id]?.silenced);
}

/** Is this character pinned to the room they were in when the Call landed? */
export function isChained(actor) {
    return Boolean(actor && restrictions()[actor.id]?.chained);
}

async function restrict(actor, patch) {
    const all = { ...restrictions() };
    all[actor.id] = { ...(all[actor.id] ?? {}), ...patch };
    await writeWorld(SETTINGS.restrictions, all);
    return true;
}

/**
 * Called when a time of day ends - every restriction lasts one. That is the
 * Eclipse opening (CALL-09), or the clock moving on a table that uses no
 * Eclipse; a rewind and a season reset call it too.
 */
export async function clearSeals() {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, SETTINGS.sealedRooms, []);
    await game.settings.set(MODULE_ID, SETTINGS.restrictions, {});
    await announceRestrictions();
    return true;
}

/**
 * Write a world setting and tell every client.
 *
 * These are always set from a Monokuma's sheet, so the writer is a GM. The
 * broadcast is what makes the other screens agree: a seal that only the GM's
 * client knows about is a seal that only the GM's client enforces.
 */
async function writeWorld(key, value) {
    if (!game.user.isGM) return null;
    await game.settings.set(MODULE_ID, key, value);
    await announceRestrictions();
    return true;
}

async function announceRestrictions() {
    const { broadcast, SYNC } = await import("./sync.mjs");
    broadcast(SYNC.restrictions, {});
}

/* ==========================================================================
 * A CALLED ASSEMBLY
 * --------------------------------------------------------------------------
 * Public Announcement used to be a teleport: six Despair and the cast was
 * standing in the Main Hall, mid-sentence. It is a summons now. The order goes
 * out publicly the moment it is bought, and the move happens at the start of
 * the next time of day.
 *
 * That gives the cast a whole time of day to do something about it, which is
 * the point: to be early, to be late, to be somewhere they should not be while
 * everybody else is walking to the hall. It also gives Monokuma something to
 * change his mind about - the same tile cancels it, and the Despair is gone
 * either way, because the announcement has already moved everybody's plans.
 * ========================================================================== */

/** The assembly called and not yet held, or null. */
export function pendingGather() {
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.pendingGather) ?? {};
        return stored.room ? stored : null;
    } catch {
        return null;
    }
}

async function writeGather(record) {
    if (!game.user.isGM) return null;
    try {
        await game.settings.set(MODULE_ID, SETTINGS.pendingGather, record ?? {});
        return record ?? null;
    } catch (err) {
        error("Could not write the pending assembly", err);
        return null;
    }
}

/**
 * Call one. Public, loudly, with the room named.
 *
 * The room is checked against the scene HERE rather than at the moment it
 * fires: an order for a room that does not exist would sit on the board for a
 * whole time of day and then fail silently in front of nobody.
 */
export async function scheduleGather(room, by = null) {
    if (!game.user.isGM) return null;

    /* THE ORDER REMEMBERS ITS SCENE (CALL-18, 20.09). The room is a REGION on one
       scene, and the order is carried out later by whichever GM is primary then -
       who may be looking at another scene entirely. Without this the assembly was
       looked for on that GM's current map, was not found, and the order had already
       been cleared. Resolved here, where the room has just been checked against the
       map the GM is actually working on. */
    const scene = canvas?.scene ?? null;
    if (!scene?.regions?.find(r => r.name === room)) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room }));
        return null;
    }

    const { getClock } = await import("./clock.mjs");
    const clock = getClock();
    const record = {
        room,
        sceneId: scene.id,
        by: String(by ?? ""),
        chapter: clock.chapter,
        session: clock.session,
        // The time of day it was BOUGHT in. Ripeness is "the clock has moved
        // since", which is why the value is stored rather than a boolean: an
        // Eclipse does not move it, so an order called before an Eclipse still
        // waits for the time of day on the far side of it.
        timeOfDay: clock.timeOfDay,
        at: Date.now()
    };

    if (!await writeGather(record)) return null;

    await announce({
        flags: { [MODULE_ID]: {
            sfx: { key: "publicAnnouncement", gm: true },
            popupKind: "objection",
            popupTitle: game.i18n.localize("DRPG.Calls.gatherTitle")
        } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Calls.gatherBanner")}</div>
            <p>${game.i18n.format("DRPG.Calls.gatherBody", {
                room: foundry.utils.escapeHTML(room)
            })}</p>
            <p class="notes">${game.i18n.localize("DRPG.Calls.gatherNote")}</p>
        </div>`
    });

    log(`Assembly called in ${room} for the next time of day.`);
    return record;
}

/**
 * Call it off. No refund, deliberately: the announcement has already been
 * heard, and half the cast has already changed where they were going.
 */
export async function cancelGather() {
    if (!game.user.isGM) return null;

    const order = pendingGather();
    if (!order) return null;

    await writeGather(null);

    await announce({
        flags: { [MODULE_ID]: {
            sfx: { key: "publicAnnouncement", gm: true },
            popupKind: "info",
            popupTitle: game.i18n.localize("DRPG.Calls.gatherTitle")
        } },
        content: `<div class="drpg-evidence-card">
            <p>${game.i18n.format("DRPG.Calls.gatherCancelled", {
                room: foundry.utils.escapeHTML(order.room)
            })}</p>
        </div>`
    });

    log(`Assembly in ${order.room} called off.`);
    return order;
}

/**
 * Hold it, if it is ripe. Called from the clock's own sync, on every client.
 *
 * ONE CLIENT DOES THE MOVING, AND IT IS THE PRIMARY GM (trap 106). Not whoever
 * advanced the clock: a second GM stepping the time of day would otherwise
 * either double the teleport or, on a client without the scene loaded, do
 * nothing at all and lose the order.
 *
 * The record is cleared BEFORE the teleport rather than after. This function is
 * reached twice on a healthy connection - once from the module's socket and
 * once from the setting's own `onChange` - and the two are merged by a 120ms
 * window that a slow client can miss. Clearing first makes the second pass find
 * nothing, which is the behaviour that matters; the cost is that a teleport
 * which throws leaves no order behind to retry, and a GM who wants it can call
 * one again for free with `game.drpg.gatherEveryone`.
 */
export async function runPendingGather() {
    if (!game.user.isGM || !isPrimaryGm()) return null;

    const order = pendingGather();
    if (!order) return null;

    const { getClock } = await import("./clock.mjs");
    const clock = getClock();

    // Still the time of day it was called in: not yet.
    if (clock.timeOfDay === order.timeOfDay && clock.session === order.session) return null;
    // An Eclipse is the window BEFORE a time of day. Gathering the cast into it
    // would hand them the assembly and then a free window to walk out of it.
    if (clock.eclipse === true) return null;

    /*
     * NOTHING IS CLEARED UNTIL IT CAN BE DONE (CALL-18, 20.09).
     *
     * This cleared the order first, on purpose - an order that throws half way
     * through must not fire again on the next time of day - and then called
     * `gatherEveryone`, which looks the room up on `canvas.scene`: THIS GM's current
     * map. The order is carried out by whoever is primary when it ripens, and that
     * is not necessarily the GM who called it, nor a GM looking at the right scene.
     * When the region was not found the call warned, returned 0, and the order was
     * already gone: six Despair for an assembly that never happened, with no repair
     * anywhere in the module.
     *
     * So the scene is resolved from the order and checked BEFORE the clear. A scene
     * or a region that has been deleted since is the one case where the order cannot
     * be carried out at all; it is cleared and said out loud rather than left to
     * fire into nothing every time of day for the rest of the season.
     */
    const scene = order.sceneId ? game.scenes.get(order.sceneId) : (canvas?.scene ?? null);
    const region = scene?.regions?.find(r => r.name === order.room) ?? null;
    if (!region) {
        await writeGather(null);
        ui.notifications.warn(game.i18n.format("DRPG.Calls.gatherRoomGone", { room: order.room }));
        warn(`Assembly in "${order.room}" could not be held: the room is not on that scene any more.`);
        return null;
    }

    await writeGather(null);

    const moved = await gatherEveryone(order.room, scene);
    await announce({
        flags: { [MODULE_ID]: {
            sfx: { key: "publicAnnouncement", gm: true },
            popupKind: "objection",
            popupTitle: game.i18n.localize("DRPG.Calls.gatherTitle")
        } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Calls.gatherBanner")}</div>
            <p>${plural("DRPG.Calls.gathered", { room: foundry.utils.escapeHTML(order.room), n: moved })}</p>
        </div>`
    });

    log(`Assembly held in ${order.room}: ${moved} moved.`);
    return { room: order.room, moved };
}

/**
 * Teleport every student into one room.
 *
 * Moving a token by writing x/y is a *move*: Foundry measures the path, and a
 * wall between here and there stops it dead - which is why Public Announcement
 * kept reporting "blocked by a wall" while everyone stayed put. Regions know how
 * to receive tokens instead: `teleportTokens` places them at a random point
 * inside the region with no path to block, which is exactly what Monokuma's
 * announcement does to the cast.
 */
export async function gatherEveryone(room, onScene = null) {
    /* THE SCENE IS AN ARGUMENT NOW (CALL-18, 20.09), and it defaults to this
       client's own. The two callers that pass nothing - the immediate branch of
       Public Announcement, and a body discovery - both run on the client that has
       just chosen the room or found the body, so their own view IS the right answer.
       A DEFERRED assembly is the case that is not: see `runPendingGather`. */
    const scene = onScene ?? canvas?.scene ?? null;
    if (!game.user.isGM || !scene) return 0;

    const region = scene.regions.find(r => r.name === room);
    if (!region) {
        ui.notifications.warn(game.i18n.format("DRPG.Calls.noSuchRoom", { room }));
        return 0;
    }

    const { isMonokuma } = await import("./monokuma.mjs");
    const { isDeceased } = await import("./chapter.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    // Not the dead (DESP-15): a body is evidence, and moving one moves the
    // crime scene. A Monocub is dead and does walk.
    /* FROM THE SCENE'S DOCUMENTS, NOT FROM THE CANVAS (CALL-18). `canvas.tokens`
       only holds the scene this client is LOOKING at, which is the whole defect one
       level up; `scene.tokens` is the same cast whether or not anybody is looking. */
    const tokens = [...scene.tokens]
        .filter(t => t.actor?.type === "character" && !isMonokuma(t.actor)
            && !(isDeceased(t.actor) && !isMonocub(t.actor)));

    if (!tokens.length) return 0;

    // Nobody is billed for this: the move is made by a GM client, and
    // movement.mjs exempts GM-initiated moves outright.
    try {
        await region.teleportTokens(tokens, { placement: "random", snap: true, pan: false });
        return tokens.length;
    } catch (err) {
        error("Region teleport failed; falling back to a direct placement", err);
        const { REVERT } = await import("./movement.mjs");
        return fallbackGather(scene, region, tokens, REVERT);
    }
}

/**
 * If the region cannot place the tokens - an unusual shape, or a version that
 * does not offer `teleportTokens` - write the positions directly, spread around
 * the region's centre and flagged so the movement rules leave them alone.
 *
 * ON THE SCENE IT WAS HANDED, not the one on this GM's screen (review of stage
 * D). CALL-18 moved the region and the token list onto the order's scene, and
 * this fallback went on writing to `canvas.scene`: a deferred assembly run while
 * the primary GM looked at another map sent that scene's token ids to a scene
 * that does not hold them, the client backend rejected the update, and the order
 * - already cleared, its six Despair spent - moved nobody and told nobody.
 */
async function fallbackGather(scene, region, tokens, REVERT) {
    const bounds = region.object?.bounds ?? region.bounds;
    const centre = bounds
        ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        : { x: scene.width / 2, y: scene.height / 2 };

    const spread = (scene.grid?.size ?? 100) * 1.2;
    const updates = tokens.map((doc, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return {
            _id: doc.id,
            x: Math.round(centre.x + Math.cos(angle) * spread),
            y: Math.round(centre.y + Math.sin(angle) * spread)
        };
    });

    await scene.updateEmbeddedDocuments("Token", updates, {
        [REVERT]: true,
        teleport: true,
        movementAction: "displace",
        animate: false
    });
    return updates.length;
}

/* ==========================================================================
 * PICKERS
 * ========================================================================== */

/**
 * Ask for whatever the Call needs pointing at. Returns null if cancelled, or an
 * empty object when the Call needs nothing.
 */
export async function pickTarget(actor, call, kind) {
    // WHAT AM I BUYING? - asked before the first decision, not after it.
    //
    // A Call with no target (Reroll) goes straight to `confirmCall`, which
    // opens with the name, the sentence and the price. A Call WITH a target
    // used to open with a bare dropdown of names and no explanation at all,
    // and only reached that sentence once the target had been chosen. Same
    // purchase, two different orders, and the one that showed the price last
    // was the one where the choice mattered more.
    //
    // Carried on `pendingHeader` rather than passed down through six pickers:
    // every one of them ends in `choose()` or a small form of its own, and
    // threading a header parameter through all of them to reach two template
    // strings is more moving parts than the same fact read once at the point
    // it is rendered.
    pendingHeader = callHeader(call, kind);
    try {
        // The one Call whose content is the point: a new rule has to be written
        // before it can be announced.
        if (call.announces) return await pickText(call);
        // …and the one that needs three answers rather than a target.
        if (call.setsMotive) return await pickMotive(call);

        switch (call.target) {
            case "player": return await pickPlayer(actor, call, kind);
            case "monocub": return await pickMonocub();
            case "project": return await pickProject(actor, kind, call);
            case "room": return await pickRoom();
            case "item": return await pickItem();
            default: return {};
        }
    } finally {
        pendingHeader = "";
    }
}

/**
 * The name, the effect and the price - the same three lines `confirmCall`
 * shows, rendered above whichever picker this Call needs.
 */
let pendingHeader = "";

function callHeader(call, kind) {
    return `<div class="drpg-call-header">
        <h3>${esc(call.label)}</h3>
        <p>${esc(callEffect(call))}</p>
        <p class="notes">${game.i18n.format(
            kind === "hope" ? "DRPG.Calls.costsHopeShort" : "DRPG.Calls.costsDespairShort",
            { cost: call.cost })}</p>
    </div>`;
}

/**
 * Which Monocub is being fuelled.
 *
 * Only actual Monocubs: a dead student who has not opted in has nothing to
 * spend Hope on, and a living one is not what this Call is for.
 */
async function pickMonocub() {
    const { monocubActors } = await import("./monocub.mjs");
    const cubs = monocubActors();

    if (!cubs.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.noneYet"));
        return null;
    }

    const id = await choose("DRPG.Monocub.who",
        cubs.map(a => ({
            value: a.id,
            label: `${a.name} - ${game.i18n.format("DRPG.Monocub.hopeShort", {
                held: a.system?.resources?.hope?.value ?? 0
            })}`
        })));
    if (!id) return null;
    return { target: cubs.find(a => a.id === id) };
}

/** The wording of a new killing game rule, which everyone will be shown. */
async function pickText(call) {
    const text = await DialogV2.wait({
        window: { title: call.label },
        classes: ["drpg-panel", "drpg-despair-dialog"],
        content: dialogContent(`${pendingHeader}<form>
            <p>${game.i18n.localize("DRPG.Calls.newRulePrompt")}</p>
            <textarea name="text" rows="3"
                placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea>
            <p class="notes">${game.i18n.format("DRPG.Calls.newRuleNote", { cost: DESPAIR_CALLS.newRule.cost })}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=text]").value.trim()
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!text || text === "cancel") return null;
    return { text };
}

/**
 * The three questions a motive is made of: what Monokuma wants, how long the
 * cast has, and what happens when the time runs out.
 *
 * BOTH SENTENCES ARE REQUIRED, AND THE WINDOW SAYS SO BEFORE THE BUTTON (the
 * E13 lesson, learned on the rest picker). Nine Despair is three quarters of a
 * pool; a motive bought without a stated consequence is a threat the table
 * cannot be held to, and finding that out after paying is the version of this
 * that costs somebody their time of day.
 */
async function pickMotive(call) {
    const record = await DialogV2.wait({
        window: { title: call.label },
        classes: ["drpg-panel", "drpg-despair-dialog"],
        content: dialogContent(`${pendingHeader}<form>
            <label>${game.i18n.localize("DRPG.Motive.demandLabel")}
                <textarea name="text" rows="3"
                    placeholder="${game.i18n.localize("DRPG.Motive.demandPlaceholder")}"></textarea></label>
            <label>${game.i18n.localize("DRPG.Motive.deadlineLabel")}
                <input type="number" name="timesOfDay"
                    value="${MOTIVE.defaultTimesOfDay}"
                    min="${MOTIVE.minTimesOfDay}" max="${MOTIVE.maxTimesOfDay}" step="1" /></label>
            <p class="notes">${game.i18n.localize("DRPG.Motive.deadlineNote")}</p>
            <label>${game.i18n.localize("DRPG.Motive.consequenceLabel")}
                <textarea name="consequence" rows="2"
                    placeholder="${game.i18n.localize("DRPG.Motive.consequencePlaceholder")}"></textarea></label>
            <p class="notes">${game.i18n.localize("DRPG.Motive.publicNote")}</p>
        </form>`),
        render: (event, dialog) => {
            const root = dialog?.element;
            if (!root) return;
            const fields = ["text", "consequence"]
                .map(name => root.querySelector(`[name=${name}]`))
                .filter(Boolean);
            const confirm = root.querySelector('button[data-action="ok"]');
            const sync = () => {
                if (confirm) confirm.disabled = fields.some(f => !f.value.trim());
            };
            for (const f of fields) f.addEventListener("input", sync);
            sync();
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        text: f.querySelector("[name=text]").value.trim(),
                        consequence: f.querySelector("[name=consequence]").value.trim(),
                        timesOfDay: Number(f.querySelector("[name=timesOfDay]").value)
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    // The backstop behind the disabled button, for the same reason the rest
    // picker keeps one: a template change or a render that never fired would
    // take the guard away and leave nothing behind it.
    if (!record || record === "cancel" || !record.text) return null;
    return { motive: record };
}

async function pickPlayer(actor, call, kind) {
    const { isMonokuma } = await import("./monokuma.mjs");
    const { othersInRoom } = await import("./movement.mjs");
    const { isDeceased } = await import("./chapter.mjs");

    // Support explicitly requires the same room; Monokuma reaches anyone.
    const sameRoomOnly = kind === "hope";
    const reachable = sameRoomOnly
        ? othersInRoom(actor)
        : game.actors.filter(a => a.type === "character" && !isMonokuma(a) && a.id !== actor.id);

    /*
     * THE DEAD ARE NOT A TARGET (D-F4).
     *
     * The wide pool filtered on type, on Monokuma and on "not me", and never
     * asked whether the person was still alive - so every Obstacle offered the
     * cast plus everybody the cast had already buried. Neither Call means
     * anything on a corpse: there is no roll of theirs to help and none to
     * hinder.
     *
     * Filtered here rather than at each Call, because it is a fact about who
     * can be targeted at all, not about what a particular Call does. A dead
     * student who opted in as a Monocub is still reachable - through
     * `pickMonocub`, which is the Call written for them.
     */
    const pool = reachable.filter(a => !isDeceased(a));

    if (!pool.length) {
        ui.notifications.warn(game.i18n.localize(
            sameRoomOnly ? "DRPG.Calls.nobodyHere" : "DRPG.Calls.noPlayers"));
        return null;
    }

    const id = await choose("DRPG.Calls.whichPlayer",
        pool.map(a => ({ value: a.id, label: a.name })));
    if (!id) return null;
    return { target: pool.find(a => a.id === id) };
}

async function pickProject(actor, kind = "hope", call = null) {
    const { knownProjects, projectsAvailableIn, isComplete, isFrozen } = await import("./projects.mjs");
    const { roomOfActor } = await import("./movement.mjs");

    // Hope's Contribution is "a project being run in your current room";
    // Monokuma reaches any of them.
    //
    // Either way the list is filtered to what this user is allowed to know
    // exists. The fallback used to be `allProjects()`, so a player standing in a
    // room with no project was shown a dropdown of every secret plan at the
    // table - the same leak as Work on Project, one dialog further along.
    //
    // And the fallback is Monokuma's alone (DESP-14): `kind` used to go unread,
    // so a student in an empty room could Contribute across the map.
    const room = roomOfActor(actor);
    const here = projectsAvailableIn(room);
    // `knownProjects` rather than `visibleProjects` for the same reason the tray
    // uses it: the fallback is a list of NAMES, and a public project nobody has
    // walked into yet is not something this account should be able to read off a
    // dropdown. It changes nothing for a GM - `knowsProject` answers true for
    // them - and narrows a player-held Monokuma to the rooms they have found.
    const listed = here.length ? here : (kind === "despair" ? knownProjects() : []);

    /*
     * A CALL THAT MOVES PROGRESS NEEDS PROGRESS TO MOVE (CALL-10, Dawid 17.09).
     *
     * Game Integrity and Patronage used to be offered every project the reader
     * could see, finished and sabotage-frozen ones included. A finished project
     * has nothing left to take and taking from it would reopen something whose
     * completion has already armed a trap or thawed a repair; a frozen one is the
     * thing a repair exists to fix, and both Work on Project and Sabotage already
     * leave it out (projects.mjs). So the Calls that carry `progress` see the
     * same list those actions do. `projectsAvailableIn` has already dropped the
     * finished ones from this room's list; the frozen ones, and the whole of the
     * `knownProjects` fallback, are filtered here.
     */
    const pool = call?.progress
        ? listed.filter(p => !isComplete(p) && !isFrozen(p.id))
        : listed;

    // Two different empties: nothing on the list at all, or a list whose every
    // project is finished or frozen.
    if (!pool.length) {
        ui.notifications.warn(game.i18n.localize(listed.length
            ? "DRPG.Project.noneToMove" : "DRPG.Project.none"));
        return null;
    }

    const id = await choose("DRPG.Calls.whichProject",
        pool.map(p => ({ value: p.id, label: `${p.name} - ${p.current}/${p.start}` })));
    if (!id) return null;
    return { project: id };
}

async function pickRoom() {
    const { allRooms } = await import("./movement.mjs");
    const rooms = allRooms();
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Rest.noRegions"));
        return null;
    }
    const room = await choose("DRPG.Calls.whichRoom", rooms.map(r => ({ value: r, label: r })));
    return room ? { room } : null;
}

async function pickItem() {
    /*
     * WHOSE THINGS CONTRABAND CAN REACH (CALL-14, Dawid 17.09).
     *
     * A body's belongings: yes. They stay on the corpse as evidence since 27.08,
     * and destroying one is exactly the kind of interference four Despair should
     * buy - the Monokuma reaching into a crime scene the cast has not searched yet.
     * A Truth Bullet: never. The price is written for "one object out of three
     * carried slots, replaceable by one Search", and knowledge is neither carried
     * nor replaceable. A Monokuma's or a Monocub's own sheet: no - the Call is
     * interference with the cast, and their own props are theirs to describe.
     */
    const { isMonokuma } = await import("./monokuma.mjs");
    const { isMonocub } = await import("./monocub.mjs");
    const { isDeceased } = await import("./chapter.mjs");

    const entries = [];
    for (const actor of game.actors) {
        if (actor.type !== "character") continue;
        if (isMonokuma(actor) || isMonocub(actor)) continue;
        for (const item of actor.items) {
            const category = item.getFlag(MODULE_ID, "category");
            if (!category || category === "truthBullet") continue;
            entries.push({
                value: item.uuid,
                label: isDeceased(actor)
                    ? game.i18n.format("DRPG.Calls.onTheBody", { name: actor.name, item: item.name })
                    : `${actor.name} - ${item.name}`
            });
        }
    }
    if (!entries.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Calls.noItems"));
        return null;
    }
    const uuid = await choose("DRPG.Calls.whichItem", entries);
    if (!uuid) return null;
    return { item: await fromUuid(uuid) };
}

/** One-dropdown picker. */
async function choose(promptKey, options) {
    const html = options
        .map(o => `<option value="${foundry.utils.escapeHTML(o.value)}">${foundry.utils.escapeHTML(o.label)}</option>`)
        .join("");

    const picked = await DialogV2.wait({
        window: { title: game.i18n.localize(promptKey) },
        classes: ["drpg-panel"],
        content: `${pendingHeader}<form><label>${game.i18n.localize(promptKey)}
                    <select name="choice">${html}</select></label></form>`,
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Action.proceed"), default: true,
                callback: (e, b, d) => d.element.querySelector("[name=choice]").value
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    return (picked && picked !== "cancel") ? picked : null;
}
