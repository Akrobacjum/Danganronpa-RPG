/**
 * Danganronpa RPG - the Reroll Hope Call.
 * ---------------------------------------------------------------------------
 * Three Hope buys back the dice you have already thrown. Unlike every other
 * Hope Call this one looks backwards, so it is not armed and waited on: it acts
 * the moment it is paid for, on the single most recent roll and nothing older.
 *
 * "Replace the old result with the new one" is not a chat-card edit. It means
 * the action is taken back and run again, on the GM, as one unit (`rerollOnGm`,
 * E08+E28 C4a):
 *
 *   the dice      the chat message is rewritten in place, so the table sees one
 *                 roll with new numbers rather than two contradictory rolls
 *   the card      the action's card is not rewritten - its words were built in the
 *                 roller's browser - but marked as replaced (`markReplacedCard`, C5)
 *   Hope / Sanity `settleDualityReroll`, a port of what `DualityRoll#reroll`
 *                 settles, moves these from the old duality to the new one
 *   Despair       ours, not the system's - a Despair result that becomes a Hope
 *                 result hands the point back to the Monokuma that got it
 *   the action    whatever the roll actually did is undone and redone against
 *                 the new number: project progress, the item a Search drew, the
 *                 Remnant it left, the freeze and repair a Sabotage caused
 *
 * WHAT A REROLL SETTLES IS WHAT A FRESH ROLL SETTLES (E08+E28 C4b, 03.10.2026;
 * audit S02-22). The same dice pay the same, behind the same gates: Hope, Sanity
 * and Fear only with Daggerheart's `hopeFear.players` (a player's roll, wherever
 * it is settled - the system's own funnel asks that flag for a GM's roll too);
 * Despair through the fresh award's own function (despair-award.mjs
 * `awardRollDespair`: "Rolls grant Despair", a Monokuma's own roll, a full pool's
 * spill and its give-back); the critical's second Hope behind the gate the funnel
 * pays it behind (critical.mjs). A reaction pays none of them. A reload in the
 * middle of a Reroll is put right, or told, from the GMs' journal of it
 * (`recoverRerollJournal`).
 *
 * Which action to replay comes off the bookmark `rollTrait` writes. Until that
 * bookmark carried an `actionKey`, only Work on Project ever recorded one - so
 * Reroll genuinely did nothing but re-roll the dice for every other action,
 * which is exactly how "it only works on projects" happened.
 *
 * What still cannot be taken back is stated plainly rather than silently
 * ignored: a search token is spent whatever the dice say, and a ruling a human
 * already made is re-asked rather than rewritten.
 */

import { MODULE_ID, ACTIONS, PROJECT_SCALE, DYNAMIC_THRESHOLDS, CRITICAL, TIMING, TRAITS, TRAIT_BY_DH, HOPE_CALLS, STARTING } from "./config.mjs";
import { resolveThreshold, easedBy, log, error, plural, esc, isPrimaryGm, ownerOf, whisperToOwner, whisperToOwnerOnly, whisperToGms } from "./utils.mjs";
import { searchTier, stashStepFor, stashText, rollTone } from "./action-rolls.mjs";
import { leavesTraceFor, ITEM_FLAGS } from "./inventory.mjs";
import { isClaimedRoll, neutralRollOf, REROLL_SHOWN, relayRerolledDice } from "./private-rolls.mjs";
import { rerollBookmarkStore, rerollJournalStore, trapLedgerStore } from "./gm-stores.mjs";
import { onGmStoresHydrated, gmStoresQuiet } from "./gm-store.mjs";
import { automatedUpdate, HOPE_REFUND } from "./resource-guard.mjs";

/**
 * Reroll, with the dice the first roll was actually made with.
 *
 * `Roll#reroll()` is `clone()` then `evaluate()`, and `clone()` is
 * `new this.constructor(this._formula, this.data, this.options)`. For a
 * `DualityRoll` that constructor calls `constructFormula()` immediately - which
 * throws the passed formula away and rebuilds the terms from
 * `this.advantageNumber`. On a brand-new instance that field has not been
 * initialised yet (a class field runs after `super()` returns), so it reads as
 * `undefined` and the advantage die is built with `number: 1`.
 *
 * Which was invisible until E7, because one die rebuilt as one die. Now a roll
 * made with three advantage dice came back from a Reroll with one - measured on
 * the sandbox: `1d12 + 1d12 + 2d6kh` went in and `1d12 + 1d12 + 1d6` came out.
 * That is exactly the silent loss Reroll exists not to inflict: a player spends
 * three Hope to throw the dice again and is quietly handed a weaker roll than
 * the one they are replacing.
 *
 * So the clone is made here, told how many dice it is meant to have, and asked
 * to build its formula again. `constructFormula` re-reads the same options the
 * clone already carries, so the experiences, the extra formula and the flat
 * modifiers come back with it - this adds the one thing the round trip drops
 * and changes nothing else.
 *
 * The one-die case still goes through `reroll()`, which rebuilds one die
 * correctly - but without `liveRoll`, so the system settles nothing, and both
 * branches settle through the one port below (review of CALL-08, 17.09) - once the
 * replay has not been refused (`makeReroll`, fix r1-G3). Neither shows the dice: the
 * GM that makes the Reroll sends them to the roll's readers once the message holds
 * them (private-rolls.mjs `relayRerolledDice`, E08+E28 C4a).
 * The system's own settlement clears a Sanity mark for a critical, which this
 * game's critical never does, and compensating after its unawaited, clamped
 * write could not know what it had really moved.
 */
async function rerollKeepingDice(original, actor, message, bookmark = null) {
    const wanted = advantageDice(original);
    const thrown = await rollAsThrown(original, actor, message, bookmark);
    if (wanted <= 1) return thrown.reroll();

    const clone = thrown.clone();
    clone.advantageNumber = wanted;
    clone.constructFormula(clone.options);
    return clone.evaluate();
}

/**
 * THE ROLL AS IT WAS THROWN (E06 fix r1-G1, 28.09.2026; review M1 = F1). A roll
 * the module threw keeps nothing of its character in its message
 * (private-rolls.mjs `neutralRollOf`): its `data` is empty and it has no
 * statistic, no experiences and no effects. That is all a browser needs to show
 * it, and not enough to throw it again - `clone()` rebuilds the formula from
 * the options, and would drop the statistic's value, the experiences' bonuses
 * and the effects'. So the roll is rebuilt here with them put back: the
 * character's data from the actor the Reroll was asked for (`getRollData()`, as
 * actor.mjs `diceRoll` gives it), its effects as `rollTrait` finds them
 * (actor.mjs:576; none where the system has no such call), and the statistic
 * and the experiences from the GMs' bookmark (action-rolls.mjs `keepGmBookmark`;
 * the roller's own browser's until E08+E28 C4a) - which is kept only for the roll
 * the bookmark names. A roll
 * the module threw that the bookmark does not name is refused rather than
 * thrown weaker: the Reroll's whole point is not to hand back a worse roll
 * than the one paid to replace. A roll the module did not throw is its own
 * record and comes back untouched. Exported for the suite; the harness has no
 * `DualityRoll` to rebuild, so what the rebuild adds up to on a real table is
 * LIVE-E06-02's.
 */
export async function rollAsThrown(original, actor, message, bookmark = null) {
    if (!isClaimedRoll(message)) return original;
    const named = Boolean(message.id) && bookmark?.messageId === message.id;
    const trait = named ? TRAITS[bookmark.trait]?.dh ?? (TRAIT_BY_DH[bookmark.trait] ? bookmark.trait : null) : null;
    if (!trait) throw new Error(`no statistic is kept for roll ${message.id}`);
    const options = foundry.utils.deepClone(original.options ?? {});
    options.data = actor.getRollData();
    options.roll = { ...(options.roll ?? {}), trait };
    options.experiences = Array.isArray(bookmark.experiences) ? [...bookmark.experiences] : [];
    options.effects = await game.system?.api?.data?.actions?.actionsTypes?.base?.getActionRelevantEffects?.(actor) ?? [];
    return new original.constructor(original._formula ?? original.formula, {}, options);
}

/**
 * A rerolled roll as its message keeps it: for a roll the module threw, what
 * `rollAsThrown` put back is taken out again (`neutralRollOf`), so the message
 * a Reroll rewrites says no more than the one the roll made. Exported for the
 * suite.
 */
export function rerolledSource(rerolled, message) {
    return isClaimedRoll(message) ? neutralRollOf(JSON.stringify(rerolled)) : rerolled;
}

/**
 * What `DualityRoll#reroll` does after the dice, for every reroll.
 *
 * CALL-08, 17.09. `liveRoll` is read by `DualityRoll#reroll` and by nothing
 * else - `Roll#evaluate` ignores it - so the multi-dice branch above showed no
 * dice and settled no resources: a Hope result rerolled into a Fear result kept
 * the Hope, the reverse gave none, and a critical's cleared Sanity mark was
 * never put back or taken. `settleCritHope` below assumes the system paid its
 * one point on a reroll, so it was short as well.
 *
 * A port of `updateResourcesForDualityReroll` (daggerheart.js, 2.6.5), which
 * the system does not export, ending in the same `modifyResource` the system's
 * own resource map calls. It runs after the replay (`makeReroll`), on the GM that
 * makes the Reroll since E08+E28 C4a.
 *
 * THE PLAYERS' FLAG, ON A GM TOO (E08+E28 C4b, 03.10.2026; audit S02-22). The port read
 * `game.user.isGM ? hopeFear.gm : hopeFear.players`, which was the roller's flag while the
 * roller's tab made the Reroll and is the GMs' flag now that a GM does: a world with player
 * automation off and the GMs' on paid a player's Reroll what no fresh roll of theirs was paid.
 * A fresh roll's funnel asks `shouldUseHopeFearAutomation()`, whose default `gmAsPlayer: true`
 * reads `hopeFear.players` on every client (Daggerheart 2.6.5, helpers/utils.mjs, read
 * 03.10.2026), so this does too.
 */
async function settleDualityReroll(original, rerolled, actor) {
    if (original.options?.actionType === "reaction") return;

    try {
        const { hope, stress, fear } = rerollDeltas(original, rerolled);
        const { hopeFear, countdownAutomation } = dhAutomation();

        if (hopeFear.players) {
            const updates = [];
            if (hope) updates.push({ key: "hope", value: hope, enabled: true });
            // NOT the system's Sanity line (review of CALL-08). A critical clears no
            // Sanity in this game - `CRITICAL.clearsStress`, enforced for a fresh
            // roll in critical.mjs - so a reroll has none to give back or take.
            if (stress && CRITICAL.clearsStress) updates.push({ key: "stress", value: -1 * stress, enabled: true });
            if (fear) updates.push({ key: "fear", value: fear, enabled: true });
            await modifyRollActor(original, updates, actor);
        }

        if (countdownAutomation && fear) {
            game.system.api.applications.ui.DhCountdowns.updateCountdowns({
                type: CONFIG.DH.GENERAL.countdownProgressionTypes.fear.id,
                undo: fear !== 1
            });
        }
    } catch (err) {
        error("Could not settle Hope and Sanity after a reroll", err);
    }
}

/**
 * What a reroll moves, in the system's own arithmetic (`updateResourcesForDualityReroll`):
 * +1/-1 per resource, from the old result to the new one. A critical is neither
 * Hope nor Fear on the dice and counts as Hope here, exactly as it does there.
 */
function rerollDeltas(original, rerolled) {
    const duality = roll => roll.withHope ? 1 : roll.withFear ? -1 : 0;
    const was = duality(original);
    const now = duality(rerolled);
    return {
        hope: (now >= 0 ? 1 : 0) - (was >= 0 ? 1 : 0),
        stress: (now === 0 ? 1 : 0) - (was === 0 ? 1 : 0),
        fear: (now === -1 ? 1 : 0) - (was === -1 ? 1 : 0)
    };
}

/** Daggerheart's automation settings, read off its config rather than named in
 *  this module's `SETTINGS` idiom - R4 treats `SETTINGS.x` as one of ours. */
function dhAutomation() {
    const { gameSettings } = CONFIG.DH.SETTINGS ?? {};
    return game.settings.get(CONFIG.DH.id, gameSettings.Automation);
}

/**
 * The actor a roll's resources land on - the system's own choice of it (a
 * companion's partner), made from the character the Reroll was asked for
 * (`makeReroll`). The roll's own `source.actor` is empty on every roll
 * the module throws since E06 C5b (private-rolls.mjs `neutralRollSource`), so
 * it is read only when no character is handed down (E06 C5a). Exported for
 * the suite.
 */
export async function rollTarget(original, actor = null) {
    const subject = actor ?? await foundry.utils.fromUuid(original?.options?.source?.actor ?? "");
    return subject?.system?.partner ?? subject ?? null;
}

async function modifyRollActor(original, updates, actor) {
    if (!updates.length) return;
    const target = await rollTarget(original, actor);
    if (target?.modifyResource) await target.modifyResource(updates);
}

/**
 * How many bonus dice this roll was thrown with.
 *
 * Read off the die itself rather than from `advantageNumber`, which is the
 * field the round trip loses - the TERM survives serialisation with its count
 * intact, so the dice are their own record of how many there were.
 */
function advantageDice(roll) {
    const die = roll?.dAdvantage ?? roll?.dDisadvantage ?? null;
    const number = Number(die?.number);
    return Number.isFinite(number) && number > 0 ? number : 1;
}

/* ==========================================================================
 * THE REROLL, MADE ON THE GM
 * --------------------------------------------------------------------------
 * E08+E28 C4a, 03.10.2026; audit S02-47, the owner's answer to E05's Q6; the
 * plan's 2.1, 2.3 and 2.4. The Reroll was made in the roller's tab: the Hope paid
 * there before anything was known, the roll found by this browser's bookmark or,
 * when its message was gone, by a scan of the character's rolls of the last half
 * hour - which rerolled another roll - and every undo of the replay sent to the GM
 * as a player's packet. A tab closed half way lost a Reroll half made.
 *
 * It is one request now, `reroll.ask { actorId }` (gm-bridge.mjs `requestReroll`),
 * and the GM makes all of it (`rerollOnGm`), one character at a time: it reads the
 * GMs' own bookmark (action-rolls.mjs `keepGmBookmark`), refuses before anything is
 * paid, writes a journal row, pays, throws the dice again, rewrites the message,
 * shows the dice to the roller and the roll's readers, takes the action back and
 * makes it again on its own client - every `settle*` below reaches its GM work
 * through a `request*` whose GM path is `local` - settles, keeps the new row and
 * answers the lines for the Call's card. A refusal before the payment changes
 * nothing; one after it (a write that threw, a replay answering null) gives back the
 * first rolls and the Hope paid, as +3 on the Hope held then. The journal's phases
 * are there for a reload in the middle: `recoverRerollJournal` below puts it right
 * or tells it (E08+E28 C4b).
 * ========================================================================== */

/** The characters whose Reroll this client is making now: a second while one runs is refused. */
const making = new Set();

/**
 * The GMs' row as the replays read a bookmark: the roller's claims, with the GM's facts
 * over them, and the roll's own fields. Exported for the suite.
 */
export function replayBookmark(row) {
    if (!row) return null;
    return {
        room: row.room ?? null, ...(row.claims ?? {}), ...(row.facts ?? {}),
        messageId: row.messageId ?? null, actionKey: row.actionKey ?? null, trait: row.trait ?? null,
        experiences: Array.isArray(row.experiences) ? [...row.experiences] : [],
        total: row.total ?? null, withFear: Boolean(row.withFear), isCritical: Boolean(row.isCritical)
    };
}

/**
 * Why the action a row names cannot be taken back now, asked before the payment
 * (the plan's 2.5), or null. Each undo checks again as it writes. A crisis action is
 * asked what its undo's packet was asked by the bridge until this commit
 * (`crisisUndoRefusal`, murder.mjs); the other actions' own checks are C6b's, and
 * answer null here.
 *
 * AN OBSERVE IS TAKEN BACK ONCE ITS RESULT STANDS (E08+E28 C6a, 03.10.2026; audit S05-22).
 * Its result is written on the GM's client after the GM has described the find, and the
 * key and result reach the row only then (observe.mjs `keepResult`). A Reroll asked in
 * between found a row with no key: the Hope was paid, the dice rewritten, the replay said
 * there was nothing to take back, and the first result was then written under the new
 * dice. So it is refused here, nothing paid: while the GM is still describing it
 * (`observeBeingDescribed`), and while the row has no result to undo. An Observe the GM
 * ruled by hand has no key and is asked again instead (`settleGmRuling`).
 */
async function replayRefusal(actor, row) {
    /* A CRISIS ROW WITHOUT ITS FACT (E08+E28 fix r1-G2, 04.10.2026; the round-1 review's B1). Its
       replay (`settleCrisis`) reads the action off the row; without it the Reroll was paid and
       settled as "the dice are the whole result", while the first throw's damage, trace and turn
       stood. The fact now waits for its row (action-rolls.mjs `rollOfFact`), and a row still
       without one - a refused action, or a fact still on its way - is refused here, nothing paid. */
    if (row.actionKey === "crisis" && !row.facts?.crisis) return "that crisis action has no result to take back";
    if (row.actionKey === "crisis") {
        const { crisisUndoRefusal } = await import("./murder.mjs");
        return crisisUndoRefusal(actor, row.facts.crisis);
    }
    if (row.actionKey === "observe" && !row.claims?.gmRuled) {
        const { observeBeingDescribed } = await import("./observe.mjs");
        if (observeBeingDescribed(actor.id)) return "the GM is still describing what that Observe found";
        if (!row.facts?.observeKey) return "that Observe has no result to take back";
    }
    return null;
}

/** What a GM's own Reroll shows for a replay's refusal, where the bridge's code would say less. */
const REPLAY_SAYS = Object.freeze({
    "the GM is still describing what that Observe found": "DRPG.Reroll.observeBusy"
});

/**
 * The checks of the plan's 2.3 step 2, in its order, on the GM, before anything is
 * written: `{ why, say }` for a refusal - `why` the GM's English line, which the bridge
 * tells the asker by its code (bridge-guards.mjs `REASON_PATTERNS`), `say` (or `said`,
 * already worded) the line a GM's own Reroll shows, where there is one; without, a GM is
 * told what a player would be - or `{ row, message, held }`.
 */
async function rerollRefusal(actor, sender, cost) {
    await rerollBookmarkStore.whenHydrated();
    const row = rerollBookmarkStore.get(actor.id) ?? null;
    if (!row?.messageId) return { why: "the GMs keep no roll of that character to reroll", say: "DRPG.Reroll.nothingToReroll" };
    if (!sender?.isGM && row.by !== sender?.id) return { why: "the kept roll of that character is not the sender's", say: "DRPG.Reroll.nothingToReroll" };
    if (!(Date.now() - (row.at ?? 0) <= TIMING.rerollWindowMinutes * 60_000)) {
        return { why: "the kept roll of that character is older than a Reroll can reach", say: "DRPG.Reroll.nothingToReroll" };
    }
    const message = game.messages.get(row.messageId) ?? null;
    if (!message) return { why: "the roll is no longer in the chat", say: "DRPG.Reroll.messageGone" };
    if (!message.rolls?.[0]) return { why: "that message holds no roll to throw again", say: "DRPG.Reroll.notARoll" };
    const { hopeCallRefusal, hopeHeld } = await import("./calls.mjs");
    const barred = await hopeCallRefusal(actor);
    if (barred) return { why: `the buyer may not spend a Hope Call now (${barred})`, said: barred };
    if (row.actionKey === "crisis") {
        const { crisisKilled, murderState } = await import("./murder.mjs");
        const last = murderState()?.lastCrisis ?? null;
        if (last?.actorId === actor.id && crisisKilled(last)) return { why: "that crisis action killed somebody; the death stands", say: "DRPG.Reroll.deathStands" };
    }
    const held = hopeHeld(actor);
    if (held < cost) return { why: `the buyer holds ${held} Hope, the Call costs ${cost}`, said: game.i18n.format("DRPG.Calls.notEnoughHope", { call: HOPE_CALLS.reroll.label, cost, held }) };
    const refusal = await replayRefusal(actor, row);
    if (refusal) return { why: refusal, say: REPLAY_SAYS[refusal] ?? null };
    // Last, and still before the payment: a roll this client cannot throw again (a roll of another
    // system's, or the harness's plain record) would only be paid for and given back.
    if (typeof message.rolls[0].reroll !== "function") return { why: "that message holds no roll to throw again", say: "DRPG.Reroll.notARoll" };
    return { row, message, held };
}

/**
 * Make `actor`'s Reroll on this GM's client, for `sender` (the user Foundry names, or
 * this GM). Answers `{ lines }` once it stands, or `{ refused, say }` - `refused` the
 * English reason the bridge refuses with, `say` (or `said`, already worded) what a GM's
 * own Reroll shows. Nothing is written before the checks pass; anything written after
 * them is given back when the Reroll does not stand.
 */
export async function rerollOnGm(actor, sender) {
    if (!game.user?.isGM || !actor?.id) return { refused: "no such character", say: "DRPG.Reroll.nothingToReroll" };
    if (making.has(actor.id)) return { refused: "a Reroll of that character is already being made", say: "DRPG.Reroll.busy" };
    making.add(actor.id);
    try {
        return await makeReroll(actor, sender);
    } finally {
        making.delete(actor.id);
    }
}

async function makeReroll(actor, sender) {
    const cost = HOPE_CALLS.reroll.cost;
    const checked = await rerollRefusal(actor, sender, cost);
    if (checked.why) return { refused: checked.why, say: checked.say ?? null, said: checked.said ?? null };
    const { row, message, held } = checked;
    const bookmark = replayBookmark(row);
    const original = message.rolls[0];
    const before = dualityOfRoll(original);
    // The message's rolls before this Reroll: what a Reroll that does not stand puts back.
    const firstRolls = foundry.utils.deepClone(message.toObject().rolls ?? []);
    const journal = fields => rerollJournalStore.patch(actor.id, fields);

    await rerollJournalStore.whenHydrated();
    // `gm` is the client making it, `first` and `action` what a GM told of a Reroll cut short
    // is told (`recoverRerollJournal`).
    await journal({ phase: "paid", hope: cost, messageId: message.id, firstRolls, at: Date.now(), by: sender?.id ?? null,
        gm: game.user.id, first: before.total ?? null, action: row.actionKey ?? null });
    await automatedUpdate(actor, { "system.resources.hope.value": held - cost });
    if (cutHere("paid")) return { cut: "paid" };

    const done = [];
    let rerolled;
    try {
        rerolled = await rerollKeepingDice(original, actor, message, bookmark);
        await message.update({ rolls: [rerolledSource(rerolled, message)] }, { [REROLL_SHOWN]: true });
        await journal({ phase: "rolled" });
    } catch (err) {
        error("Could not reroll the last action", err);
        await giveBack(actor, message, firstRolls, cost);
        return { refused: "the Reroll could not be made; its Hope and the first roll are given back", say: "DRPG.Reroll.failed" };
    }
    if (cutHere("rolled")) return { cut: "rolled" };
    relayRerolledDice(message, row.by ?? null);

    const after = dualityOfRoll(rerolled);
    done.push(game.i18n.format("DRPG.Reroll.replaced", { old: before.total, new: after.total }));

    // Undo and replay the action itself. Every branch returns the bookmark fields it
    // changed, so the row is written once, at the end, from the state the replay
    // actually left behind - not from the row as the Reroll began, which put the OLD
    // progress figure back straight after the replay had corrected it, so a second
    // Reroll subtracted a number the project no longer held.
    await journal({ phase: "replaying", total: after.total ?? null });
    if (cutHere("replaying")) return { cut: "replaying" };
    const patch = await replayAction(actor, bookmark, after, done, rerolled);
    if (patch === null) {
        await giveBack(actor, message, firstRolls, cost);
        return { refused: "the replay was refused; its Hope and the first roll are given back", say: "DRPG.Reroll.failed" };
    }

    /*
     * SETTLED ONCE THE REPLAY STANDS (E32+E07 fix r1-G3, 02.10.2026). The Hope and Fear
     * the new duality moves, the Despair and the critical's Hope were settled before the
     * replay until that fix; a replay the GM refused then had them to move back, and an
     * inverse is not one at the edges: that fix's first build moved them back, and in the
     * full suite the Despair pool did not come back to its number (alone it did; e32run
     * g3f1, 02.10) - a point that did not fit a full pool had spilled to the overflow, and
     * the point given back came off the pool. Settled here, a refused replay has moved none
     * of them. Settled as a fresh roll is since E08+E28 C4b (the header): the same gates, and
     * the Despair through the fresh award's own function, whose give-back at a full pool
     * comes off the overflow first. A reaction roll paid no Despair and no critical Hope, so
     * a reroll of one has none to move - the test `settleDualityReroll` makes for itself
     * (review of CALL-08, 17.09: the one-die path reaches here for a reaction too).
     */
    await settleDualityReroll(original, rerolled, actor);
    if (original.options?.actionType !== "reaction") {
        await settleDespair(actor, before, after, done);
        await settleCritHope(actor, before, after, done);
    }

    await markReplacedCard(row, before, after);
    try {
        await keepRerolledRow(actor, row, patch, after);
    } catch (err) {
        // A stale row only costs a second Reroll.
        error("Could not keep the rerolled roll's bookmark", err);
    }
    await rerollJournalStore.drop(actor.id);

    log(`${actor.name} rerolled ${before.total} into ${after.total} (${row.actionKey ?? "no action"}).`);
    return { lines: done };
}

/**
 * The new row: the replay's patch, a claim where the action's claims name the field and
 * a fact otherwise, over the row as the replay left it - a replay's own GM work writes
 * its facts on it as it goes (action-rolls.mjs `noteRollFact`). `first` and `by` are the
 * first throw's still.
 */
async function keepRerolledRow(actor, row, patch, after) {
    const { ROLL_CLAIMS } = await import("./action-rolls.mjs");
    const named = Object.hasOwn(ROLL_CLAIMS, row.actionKey ?? "") ? ROLL_CLAIMS[row.actionKey] : {};
    const now = rerollBookmarkStore.get(actor.id) ?? row;
    if (now.messageId !== row.messageId) return;
    const claims = { ...(now.claims ?? {}) }, facts = { ...(now.facts ?? {}) };
    for (const [field, value] of Object.entries(patch ?? {})) (Object.hasOwn(named, field) ? claims : facts)[field] = value;
    await rerollBookmarkStore.patch(actor.id, {
        claims, facts, total: after.total, withFear: after.withFear, isCritical: after.isCritical, rerolled: true
    });
}

/**
 * THE CARD IT REPLACED SAYS SO (E08+E28 C5, 03.10.2026; audit S02-21; the plan's 2.7). The
 * header's "rewritten in place" is the roll's message; the action's card beside it was posted
 * from the roller's browser, from facts the replay has just changed, and kept its first total
 * and its first words - the table read two outcomes of one roll. The GM cannot write those
 * words again, so the card is marked, not rewritten: `flags.danganronpa-rpg.rerolled` on its document,
 * `{ from, to, tone, at }` - the total the card prints, the new one, and the new roll's colour
 * (action-rolls.mjs `rollTone`) - and every reader draws the struck total and one line from it
 * (private-rolls.mjs `markReplaced`). A private card's words (secret.mjs) are not touched: the
 * flag is the document's, the line is drawn where the words are. A second Reroll of the same
 * roll keeps `from`, the number the card itself prints. The card is the one the roller named
 * (action-rolls.mjs `reportCardOf`); a row naming none is a roll whose card was never named,
 * and nothing is marked. Written once the Reroll stands, so a refused one leaves it as it was.
 */
async function markReplacedCard(row, before, after) {
    const card = game.messages.get(row.reportMessageId ?? "") ?? null;
    if (!card) return;
    const held = card.flags?.[MODULE_ID]?.rerolled ?? null;
    try {
        await card.update({ [`flags.${MODULE_ID}.rerolled`]: {
            from: held?.from ?? before.total ?? null, to: after.total ?? null, tone: rollTone(after), at: Date.now()
        } });
    } catch (err) {
        // The Reroll stands without it: the Reroll's own card says what changed.
        error("Could not mark the card a Reroll replaced", err);
    }
}

/**
 * A REROLL THAT DOES NOT STAND IS GIVEN BACK WHOLE (E32+E07 fix r1-G3, 02.10.2026; E08+E28
 * C4a). The card gets its first rolls again, and the Hope paid comes back as +3 on the Hope
 * held now, never the number held before: a grant that landed in between stays. What a
 * replay's own undo put back stays put back - each undo checks before it writes, so a late
 * refusal has written nothing of its own. The journal row goes with it. The harness has no
 * Daggerheart roll to throw again; the suite drives this with a roll of its own, and a real
 * table has not run it.
 */
async function giveBack(actor, message, firstRolls, cost) {
    await putFirstRollBack(message, firstRolls);
    try {
        const { hopeHeld } = await import("./calls.mjs");
        const { resourceMax } = await import("./character.mjs");
        const max = resourceMax(actor, "hope") || STARTING.hopeMax;
        await automatedUpdate(actor, { "system.resources.hope.value": Math.min(max, hopeHeld(actor) + cost) }, { [HOPE_REFUND]: true });
    } catch (err) {
        error(`Could not give back the ${cost} Hope a Reroll that did not stand had taken`, err);
    }
    await rerollJournalStore.drop(actor.id);
}

/**
 * The card's rolls as they were before the Reroll. A GM's write, marked so the dice relay
 * sends nothing for it (`REROLL_SHOWN`).
 */
async function putFirstRollBack(message, firstRolls) {
    // A message deleted since, or a journal row without its rolls: nothing to put back on.
    if (!message || !firstRolls?.length) return;
    try {
        await message.update({ rolls: firstRolls }, { [REROLL_SHOWN]: true });
    } catch (err) {
        error("Could not put the first roll back on its card after a Reroll that did not stand", err);
    }
}

/* ==========================================================================
 * A REROLL CUT SHORT
 * --------------------------------------------------------------------------
 * E08+E28 C4b, 03.10.2026; audit S02-47's reload; the plan's 2.4. A Reroll is made on one
 * GM's client, and a reload there (or that GM leaving) stops it between two writes. The
 * journal row says how far it got, and every GM holds it (`rerollJournal`, synced). The
 * primary reads it as its stores open - its own reload, and every load - and when a GM
 * leaves, which is how a new primary comes to read it.
 *
 *   paid, rolled  nothing of the action was touched yet: the first rolls go back on the
 *                 card, the Hope paid comes back as +3 on the Hope held now (`giveBack`),
 *                 and the player and the GMs are told (`DRPG.Reroll.interrupted`).
 *   replaying     the undo may have run in part, and what it wrote cannot be read back
 *                 out of the world: the GMs get one card with the character, the action
 *                 and the two totals and what to check (`DRPG.Reroll.interruptedGm`), the
 *                 player is told the GM will settle it, and the Hope stays paid. The GMs'
 *                 bookmark of that roll goes, so the roll cannot be rerolled again on a
 *                 row that no longer says what it did.
 *
 * NOT ON `drpgPrimaryReady`, which the plan named: that hook fires on the OTHER clients
 * when the primary's GM_READY arrives (gm-bridge.mjs `onGmReady`), never on the primary
 * itself, and the primary is the one that must read the journal. A row is left alone
 * while the GM client it names is connected (on that client itself, while it is making
 * it): another GM's Reroll still running reads, from here, exactly as one cut short.
 * ========================================================================== */

/** Suite only: the phase after which the next Reroll made on this client stops, as a reload there would leave it. */
let cutAt = null;
export function cutRerollAfter(phase) {
    cutAt = phase ?? null;
}
function cutHere(phase) {
    if (cutAt !== phase) return false;
    cutAt = null;
    return true;
}

/** A row nobody is making any more: this client's and not in hand, or a GM's who is gone. */
function orphaned(actorId, row, gone) {
    if (row?.gm === game.user.id) return !making.has(actorId);
    if (gone && row?.gm === gone) return true;
    return !game.users.get(row?.gm ?? "")?.active;
}

let recovering = Promise.resolve();

/**
 * Put right, or tell, every Reroll the journal holds that nobody is making any more. The
 * primary only, one pass at a time. `gone` is a GM who has just left, read as gone whether
 * or not this client's user list says so yet. Answers `[actorId, "givenBack" | "told" |
 * "dropped"]` per row handled. Exported for the suite.
 */
export function recoverRerollJournal({ gone = null } = {}) {
    const run = async () => {
        if (!isPrimaryGm()) return [];
        await rerollJournalStore.whenHydrated();
        const done = [];
        for (const [actorId, row] of Object.entries(rerollJournalStore.entries())) {
            if (!row || !orphaned(actorId, row, gone)) continue;
            try {
                done.push([actorId, await recoverOne(actorId, row)]);
            } catch (err) {
                error(`Could not put right the Reroll a reload cut short (${actorId})`, err);
            }
        }
        return done;
    };
    recovering = recovering.then(run, run);
    return recovering;
}

async function recoverOne(actorId, row) {
    const actor = game.actors.get(actorId) ?? null;
    const message = game.messages.get(row.messageId ?? "") ?? null;
    if (!actor) {
        await rerollJournalStore.drop(actorId);
        return "dropped";
    }
    const name = esc(actor.name);
    if (row.phase === "paid" || row.phase === "rolled") {
        await giveBack(actor, message, row.firstRolls ?? [], Number(row.hope) || HOPE_CALLS.reroll.cost);
        await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Reroll.interrupted", { name })}</p>`);
        log(`${actor.name}'s Reroll, cut short at "${row.phase}", is given back.`);
        return "givenBack";
    }
    // `replaying`, or a phase this build does not know: told, not guessed.
    const action = esc(ACTIONS[row.action]?.label ?? row.action ?? "-");
    await whisperToGms(`<h3>${esc(game.i18n.localize("DRPG.Reroll.title"))}</h3><p>${game.i18n.format("DRPG.Reroll.interruptedGm", {
        name, action, first: esc(String(row.first ?? "?")), total: esc(String(row.total ?? "?"))
    })}</p>`);
    if (ownerOf(actor)) await whisperToOwnerOnly(actor, `<p>${game.i18n.format("DRPG.Reroll.interruptedPending", { name })}</p>`);
    if (rerollBookmarkStore.get(actorId)?.messageId === row.messageId) await rerollBookmarkStore.drop(actorId);
    await rerollJournalStore.drop(actorId);
    log(`${actor.name}'s Reroll, cut short at "${row.phase}", is told to the GMs.`);
    return "told";
}

/**
 * The two moments the primary reads the journal: its stores open, and a GM leaves. Not while the
 * suite holds the stores or stands them in another world (`gmStoresQuiet`): a hydration then is
 * the suite's, and the rows it would read are a test's.
 */
export function registerRerollRecovery() {
    onGmStoresHydrated(() => { if (!gmStoresQuiet()) void recoverRerollJournal(); });
    Hooks.on("userConnected", (user, connected) => {
        if (!connected && user?.isGM) void recoverRerollJournal({ gone: user.id });
    });
}

/** Hope / Despair / critical, read straight off the dice so it always works.
 *  Exported for the GM's roll keeper (reroll-receipts.mjs, the receipts until
 *  E08+E28 C8), which has to read the same duality off the same message and
 *  must not grow a second opinion of it. */
export function dualityOfRoll(roll) {
    const hope = roll?.dHope?.total;
    const fear = roll?.dFear?.total;
    const total = roll?.total ?? 0;

    if (typeof hope === "number" && typeof fear === "number") {
        return { total, isCritical: hope === fear, withHope: hope > fear, withFear: hope < fear };
    }
    return {
        total,
        isCritical: Boolean(roll?.isCritical),
        withHope: Boolean(roll?.withHope),
        withFear: Boolean(roll?.withFear)
    };
}

/* ==========================================================================
 * PUTTING THE LEDGERS BACK
 * ========================================================================== */

/**
 * Despair is this module's own pool, so the system's reroll knows nothing about
 * it. A roll that was made with Despair and is no longer gives its point back;
 * one that becomes a Despair roll takes a point now - through the fresh award's
 * own function, with its gates (despair-award.mjs `awardRollDespair`, E08+E28
 * C4b). It ran `requestDespairAdjust` until then, whose only rule was the
 * pool's bounds: a Reroll fed a pool with "Rolls grant Despair" off, had no
 * rule for a Monokuma's own roll, and gave a spilled point back off the pool.
 * The GM making the Reroll writes it; an assistant's pool write goes to the
 * primary as every assistant's does (`adjustDespair`).
 */
async function settleDespair(actor, before, after, done) {
    if (before.withFear === after.withFear) return;

    try {
        const { awardRollDespair } = await import("./despair-award.mjs");
        const { poolLabel } = await import("./despair.mjs");
        const delta = after.withFear ? 1 : -1;
        const moved = await awardRollDespair(actor, delta);
        if (!moved) return;

        // The pool's name, as the Despair bar shows it - not the GM's account. Where the
        // point went (the pool or the overflow) is not said: a player's screen masks the
        // overflow's count.
        done.push(game.i18n.format(delta > 0 ? "DRPG.Reroll.despairGained" : "DRPG.Reroll.despairReturned", {
            name: poolLabel(moved.monokuma)
        }));
    } catch (err) {
        error("Could not settle Despair after a reroll", err);
    }
}

/**
 * The second point of Hope a critical is worth, on the one path that still
 * needs it paid by hand.
 *
 * A FRESH critical is paid in full by the pipeline: `critical.mjs` wraps
 * `DualityRoll#addDualityResourceUpdates` so the funnel itself hands over the
 * guide's `CRITICAL.hope`. Nothing tops that up afterwards, and despair-award
 * says at its own call site why it no longer does.
 *
 * A reroll does not go through that funnel. Its resources are settled by
 * `settleDualityReroll` above - the port of the system's own
 * `updateResourcesForDualityReroll` - which pays the single point the system
 * would for a crit arrived at by rerolling, so the second one is owed here. The
 * same call with -1 hands it back when a reroll throws a critical away, which is
 * why this is a signed delta rather than a payment.
 *
 * BEHIND THE FUNNEL'S GATE (E08+E28 C4b, 03.10.2026; audit S02-22). critical.mjs tops up
 * only what the funnel paid, and the funnel pays nothing with Daggerheart's
 * `hopeFear.players` off; this paid its point whatever the flag said. It asks the flag
 * `settleDualityReroll` asks.
 */
async function settleCritHope(actor, before, after, done) {
    if (before.isCritical === after.isCritical) return;

    try {
        if (!dhAutomation()?.hopeFear?.players) return;
        const { adjustCritHopeTopUp } = await import("./despair-award.mjs");
        const delta = after.isCritical ? 1 : -1;
        await adjustCritHopeTopUp(actor, delta);

        done.push(game.i18n.localize(
            delta > 0 ? "DRPG.Reroll.critHopeGained" : "DRPG.Reroll.critHopeReturned"
        ));
    } catch (err) {
        error("Could not settle the critical's Hope after a reroll", err);
    }
}

/* ==========================================================================
 * REPLAYING THE ACTION
 * --------------------------------------------------------------------------
 * One branch per action that produced something. Each undoes what the first
 * roll did and applies what the second one earns, and each returns the bookmark
 * fields it changed so the caller can write the GMs' row once.
 *
 * Failure here is reported, never thrown: the dice have already been rewritten
 * and the Hope already spent, so a branch that cannot finish must say what it
 * could not do rather than take the whole Call down with it. One answers null
 * instead of fields: a crisis replay the GM carried out nothing of
 * (`settleCrisis`), and the Reroll is then taken back whole (`giveBack`).
 * ========================================================================== */

async function replayAction(actor, bookmark, after, done, rerolled = null) {
    const key = bookmark?.actionKey ?? null;

    try {
        // A ruling a human made cannot be rewritten by a die. Ask again instead.
        if (bookmark?.gmRuled) return await settleGmRuling(actor, bookmark, after, done);

        switch (key) {
            case "project": return await settleProgress(actor, bookmark, after, done);
            case "search": return await settleSearch(actor, bookmark, after, done, rerolled);
            case "sabotage": return await settleSabotage(actor, bookmark, after, done);
            case "dynamic": return await settleDynamic(actor, bookmark, after, done);
            case "listen": return await settleListen(actor, bookmark, after, done);
            case "observe": return await settleObserve(actor, bookmark, after, done);
            case "analyze": return await settleAnalyze(actor, bookmark, after, done);
            case "crisis": return await settleCrisis(actor, bookmark, after, done);
            case "cleanup": return await settleCleanup(actor, bookmark, after, done);
            // NO `case "tamper"`. The Tamper tile is a second door into
            // cleanup.mjs and its rolls are bookmarked `cleanup` like every
            // other one that goes through there - `cleanupKey` inside the
            // bookmark is what says which of the three it was, and that is
            // read one line down rather than out here.
            // Palm bookmarks itself as "palm" (the hook and the traps key on
            // it); the replay is the same as a Steal's.
            case "palm":
            case "steal": return await settleSteal(actor, bookmark, after, done);
            default:
                // A trait rolled straight from the sheet, or an action from
                // before this bookmark existed. The dice are the whole result.
                done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
                return {};
        }
    } catch (err) {
        error(`Could not replay "${key}" after a reroll`, err);
        done.push(game.i18n.localize("DRPG.Reroll.replayFailed"));
        return {};
    }
}

/**
 * If the roll being taken back was Work on Project, its progress goes with it.
 * The new roll is scored against the same thresholds and applied in its place,
 * so the project ends up where the second roll would have left it.
 */
async function settleProgress(actor, bookmark, after, done) {
    if (!bookmark.projectId) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { addProgress, allProjects } = await import("./projects.mjs");
    const project = allProjects().find(p => p.id === bookmark.projectId);
    if (!project) {
        done.push(game.i18n.localize("DRPG.Project.gone"));
        return {};
    }

    const def = ACTIONS.project;
    // The same eased bands the first roll was scored against (ACT-11 / ROLL-04):
    // the readied tool's relief rides the bookmark. Scored against the bare
    // bands, a reroll took back progress the tool had earned the first roll.
    const relief = bookmark.relief ?? 0;
    const hit = after.isCritical
        ? def.critical
        : resolveThreshold(after.total, easedBy(def.thresholds, relief));

    // The bonus an indirect murder earned - for working alone, or for
    // concealing intent on a Despair roll - is not recomputable from the
    // dice, so it is carried on the bookmark and re-applied on top of the
    // new threshold result. Scoring the new roll on thresholds alone while
    // subtracting a stored total that included the bonus quietly destroyed
    // it: every reroll cost the killer progress they had already earned.
    const bonus = bookmark.bonus ?? 0;
    const threshold = hit?.progress ?? 0;
    const now = threshold ? threshold + bonus : 0;
    const was = bookmark.progress ?? 0;
    const delta = now - was;

    // Said only when the GM's client carried it out (E31 review): a refusal, or no
    // answer, has been said once already.
    const applied = delta ? await addProgress(bookmark.projectId, delta, { actorId: actor.id }) : true;
    if (applied) {
        done.push(game.i18n.format("DRPG.Reroll.progressAdjusted", {
            name: project.name, was, now
        }));
    }

    // A critical on a project hands the action back. If the reroll gains or
    // loses the critical, that action has to move with it - otherwise a player
    // could reroll a crit away and keep the free action it paid for.
    const refunded = await settleActionRefund(actor, bookmark, Boolean(hit?.refundAction), done);

    return { progress: now, bonus, refunded };
}

/**
 * Take back a Search and run it again.
 *
 * The search token is deliberately NOT returned: the room was searched, and the
 * guide's three tokens count attempts, not successes. `rerolled` is the new roll
 * itself (`after` is its duality alone), whose dice a hidden stash's step reads.
 * Exported for the suite.
 *
 * A PLANT COMES BACK AS ITSELF (E08+E28 C6a, 03.10.2026; audit S08-04). A Search handed
 * a trap's planted object was taken back like any find and drawn afresh: the object left
 * the sheet, a new one with a new identity came in its place or nothing did, and the plant
 * was gone for good - the trap's ledger named an object that no longer existed anywhere.
 * The GMs' bookmark names the plant now (C2, traps.mjs `takePlant`: name, identity, room,
 * scene), and the replay follows it: found again, the same name and identity at the new
 * tier; found nothing, the plant goes back into its room as `restorePlant` puts back one
 * whose finder stopped waiting, its project read off the trap's ledger. What the searcher
 * is told is what an ordinary find tells (trap 166, `searchDraw`): nothing here says a
 * plant moved. The plant is the one on the sheet by its identity, the GMs' fact, and not
 * the claimed `itemId`; one that has left the sheet since (given, stashed, used) stays where
 * it went, and the Search is replayed as an ordinary one.
 */
export async function settleSearch(actor, bookmark, after, done, rerolled = null) {
    // A Search whose token was refused never searched the room, and a Search
    // that opened a stash found what the drawer held: neither is a draw from
    // the room's table, so neither is drawn again on new dice (ROLL-02).
    if (bookmark.claimed === false) {
        done.push(game.i18n.localize("DRPG.Reroll.searchNeverRan"));
        return {};
    }
    if (bookmark.fromVault) {
        done.push(game.i18n.localize("DRPG.Reroll.searchStashStands"));
        return {};
    }

    // A hidden stash's step on the new dice, with a new draw (E32+E07 C11e, action-rolls.mjs
    // `stashStep`). Until 1.2.65 the stash's disadvantage die was one of the roll's dice and
    // `rerollKeepingDice` threw it again; the step is not thrown with the dice, so it is taken
    // again here on what they rolled - a die set aside drawn afresh, a die added rolled afresh.
    // A 1.2.65 bookmark (E06 C11) carries a flat -1 and is scored with it; one from before
    // 1.2.65 has neither, and is scored on the dice alone.
    const def = ACTIONS.search;
    const step = bookmark.stashDie ? await stashStepFor(rerolled ?? after, actor) : null;
    const change = step ? step.change : Number(bookmark.penalty) || 0;
    const { hit, tier, score } = searchTier(after, change, def);
    const found = Boolean(hit) || after.isCritical;
    if (step) done.push(stashText(step, score));
    else if (change) done.push(game.i18n.format("DRPG.Action.situationAfterRoll", { n: String(change), total: score }));

    // 1. The thing the first roll put in the inventory goes back on the shelf.
    let itemId = null;
    const plant = bookmark.plant?.identity ? bookmark.plant : null;
    let held = plant ? actor.items.find(i => i.getFlag(MODULE_ID, ITEM_FLAGS.identity) === plant.identity) ?? null : null;
    const first = held ?? (bookmark.itemId ? actor.items.get(bookmark.itemId) ?? null : null);
    if (first) {
        const name = first.name;
        try {
            await first.delete();
            done.push(game.i18n.format("DRPG.Reroll.itemTakenBack", { item: name }));
        } catch (err) {
            error("Could not take back the item a reroll undid", err);
            done.push(game.i18n.format("DRPG.Reroll.itemStuck", { item: name }));
            itemId = first.id;
            // Still on the sheet: neither a second copy nor one back in the room.
            if (held) {
                done.push(game.i18n.localize("DRPG.Reroll.tokenKept"));
                return { itemId, tier: found ? tier : null };
            }
        }
    }

    // 2. Draw again, from the same category and for the same goal - and from
    //    the same ROOM, so the room's own table answers as it did the first time.
    //    The plant instead, when it was taken off the sheet above.
    let drawnName = null;
    let drawn = null;
    let granted = null;
    if (held) {
        const { grantItem } = await import("./inventory.mjs");
        const roles = held.getFlag(MODULE_ID, ITEM_FLAGS.roles) ?? [];
        drawn = found ? { name: plant.name ?? held.name, roles } : null;
        granted = drawn ? await grantItem(actor, {
            name: drawn.name, category: bookmark.category ?? null, tier, goal: bookmark.goal ?? null, roles,
            extraFlags: { [ITEM_FLAGS.identity]: plant.identity }
        }) : null;
        if (granted) {
            itemId = granted.id;
            drawnName = drawn.name;
            done.push(game.i18n.format("DRPG.Reroll.itemDrawn", { item: drawn.name, tier }));
        } else {
            // Found nothing, or found it with no room on the sheet for it: back where it waited.
            if (!(await putPlantBack(plant))) log(`A Reroll could not put the planted "${plant.name ?? "?"}" back in ${plant.room}.`);
            held = null;
            drawn = null;
            if (!found) done.push(game.i18n.localize("DRPG.Reroll.searchNothing"));
        }
    } else if (found && bookmark.category) {
        const { drawItem } = await import("./tables.mjs");
        drawn = await drawItem(bookmark.category, tier, { goal: bookmark.goal ?? null, room: bookmark.room ?? null });
        if (drawn?.name) {
            drawnName = drawn.name;
            const { grantItem } = await import("./inventory.mjs");
            granted = await grantItem(actor, {
                name: drawn.name, category: bookmark.category, tier, goal: bookmark.goal ?? null,
                roles: drawn.roles ?? []
            });
            if (granted) itemId = granted.id;
            done.push(game.i18n.format("DRPG.Reroll.itemDrawn", { item: drawn.name, tier }));
        }
    } else {
        done.push(game.i18n.localize("DRPG.Reroll.searchNothing"));
    }

    // 3. The trace, by the same rule the Search itself uses - one copy of it,
    //    `leavesTraceFor` in inventory.mjs (ACT-11 / ROLL-03). What was FOUND
    //    decides it: crime or cleaning gear, by the object's category or by the
    //    roles its table entry declares, never the intention. The rule this
    //    replaced on 28.08 read `category !== "usable"`, so a rerolled hunt for
    //    "something to work with" that turned up a plain screwdriver left a Prep
    //    Remnant the first roll never would have, tied to the crime. A Search that
    //    failed and is now a success does have to leave the trace it never earned
    //    first time, which is what `found` is for; the trace is tied to the crime
    //    only by the object being used later, so `tieTraceForItem` comes back
    //    for the identity.
    const leaves = found && leavesTraceFor(bookmark.category, drawn?.roles);
    const visibility = found
        ? (after.isCritical ? def.critical?.remnant : hit?.remnant)
        : null;

    const { ITEM_CATEGORIES } = await import("./config.mjs");
    const trace = await settleRemnant(actor, bookmark, leaves ? (visibility ?? null) : null, done, {
        type: "prep",
        faint: true,
        tiedToCrime: null,
        itemIdentity: granted?.getFlag?.(MODULE_ID, "drpgItemId") ?? null,
        action: "search",
        subject: drawnName ?? "",
        note: game.i18n.format("DRPG.Remnant.searchNote", {
            actor: actor.name,
            room: bookmark.room ?? "?",
            category: ITEM_CATEGORIES[bookmark.category]?.label ?? bookmark.category ?? "?",
            item: drawnName ?? "?",
            tier,
            total: after.total
        })
    }, after);

    done.push(game.i18n.localize("DRPG.Reroll.tokenKept"));
    // A plant given again stays on the row for the next Reroll; one put back, or gone its own way, does not.
    return { itemId, tier: found ? tier : null, ...(plant ? { plant: held ? plant : null } : {}), ...trace };
}

/**
 * A plant a Reroll took back, put into the room it was taken from - the row `plantItem` wrote,
 * rebuilt from the GMs' fact and the trap's ledger. A plant whose trap is gone stays gone, as
 * `pruneTrapsFor` would have left it (ITEM-08); a room planted again since keeps the newer one
 * (`restorePlant`). Answers whether it went back.
 */
async function putPlantBack(plant) {
    await trapLedgerStore.whenHydrated();
    const projectId = trapLedgerStore.get(plant.identity)?.projectId ?? null;
    if (!projectId || !plant.room) return false;
    const { restorePlant } = await import("./traps.mjs");
    return restorePlant(plant.room, plant.sceneId ?? null, { projectId, drpgItemId: plant.identity, name: plant.name ?? null });
}

/**
 * Take back a Sabotage and run it again.
 *
 * The freeze and the repair project the first roll created are removed, then the
 * new score decides whether - and how badly - the target breaks this time. The
 * concealment penalty the pre-roll earned still applies: it was not part of this
 * roll and is not undone by rerolling it.
 */
async function settleSabotage(actor, bookmark, after, done) {
    const def = ACTIONS.sabotage;
    const penalty = bookmark.penalty ?? 0;
    const relief = bookmark.relief ?? 0;
    const score = after.total + penalty;
    // The same eased bands the first roll was scored against (ACT-11 / ROLL-04).
    const hit = after.isCritical ? def.critical : resolveThreshold(score, easedBy(def.thresholds, relief));
    const success = Boolean(hit);

    const { undoSabotage, sabotageProject, allProjects } = await import("./projects.mjs");

    // 1. Unfreeze the target and remove the repair the first roll spawned.
    //    Only when it spawned one (E03): a sabotage that failed froze nothing,
    //    and "thaw the target" with no repair used to thaw whatever freeze the
    //    target had - somebody else's sabotage included.
    if (bookmark.repairId) {
        const undone = await undoSabotage(bookmark.targetProjectId ?? null, bookmark.repairId, { actorId: actor.id });
        if (undone) done.push(game.i18n.localize("DRPG.Reroll.sabotageUndone"));
    }

    // 2. Break it again, at whatever the new roll is worth.
    let repairId = null;
    if (success && bookmark.targetProjectId) {
        // Guide's Sabotage table, by the repair project it demands:
        //   12 -> trivial (3)   18 -> complex (6)   crit -> desperate (8)
        // The complex band is the last of the table, lowered by the same relief.
        const complexAt = Math.max(...def.thresholds.map(t => t.min)) - relief;
        const difficulty = after.isCritical
            ? PROJECT_SCALE.desperate.progress
            : score >= complexAt ? PROJECT_SCALE.complex.progress : PROJECT_SCALE.trivial.progress;

        const result = await sabotageProject(bookmark.targetProjectId, difficulty);
        repairId = result?.repair?.id ?? null;

        // Only what the GM's client wrote (E31 review): a refusal, or no answer, has been said.
        const target = allProjects().find(p => p.id === bookmark.targetProjectId);
        if (result) {
            done.push(game.i18n.format("DRPG.Reroll.sabotageRedone", {
                name: target?.name ?? "?", n: difficulty
            }));
        }
    } else if (bookmark.targetProjectId) {
        done.push(game.i18n.localize("DRPG.Reroll.sabotageNowFails"));
    }

    // 3. Sabotage always leaves a trace, success or not - only how loud changes.
    const visibility = success ? hit.remnant : def.failureRemnant;
    const name = allProjects().find(p => p.id === bookmark.targetProjectId)?.name ?? "?";

    const trace = await settleRemnant(actor, bookmark, visibility, done, {
        type: "prep",
        faint: true,
        action: "sabotage",
        subject: name,
        note: game.i18n.format("DRPG.Remnant.sabotageNote", {
            actor: actor.name,
            project: name,
            room: bookmark.room ?? "?",
            total: after.total,
            outcome: success
                ? game.i18n.format("DRPG.Remnant.sabotageWorked", { repair: "?" })
                : game.i18n.localize("DRPG.Remnant.sabotageFailed")
        })
    }, after);

    return { repairId, penalty, ...trace };
}

/**
 * Take back a Dynamic action and run it again against the SAME difficulty band.
 *
 * The band is not re-asked: the GM ruled on what the player described, and that
 * description has not changed. Only the dice have.
 */
async function settleDynamic(actor, bookmark, after, done) {
    const band = DYNAMIC_THRESHOLDS[bookmark.bandIndex];
    if (!band) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const success = after.isCritical || after.total >= band.range[0];
    const trace = await settleRemnant(actor, bookmark, success ? band.remnant : null, done, {
        type: "prep",
        faint: true,
        action: "dynamic",
        subject: String(bookmark.description ?? "").slice(0, 60),
        note: game.i18n.format("DRPG.Remnant.dynamicNote", {
            actor: actor.name,
            room: bookmark.room ?? "?",
            what: bookmark.description ?? "?",
            total: after.total
        })
    }, after);

    done.push(success
        ? game.i18n.format("DRPG.Action.tierFound", { tier: band.tier })
        : game.i18n.localize("DRPG.Action.nothing"));

    return trace;
}

/**
 * Listen leaves nothing behind, so there is nothing to undo - the new number
 * simply buys a different amount of information about the same room.
 */
/**
 * Take back an Observe and score it again.
 *
 * The target does not move. The character was looking at one particular trace
 * and the Hope is buying back the dice, not the search - so the new number is
 * measured against the same Remnant and the same difficulty.
 *
 * All of that lives on the GM's client, which is also where the first result
 * was recorded, so the replay is one message: "same target, new number, undo
 * what the last one did". This side deliberately cannot compute the outcome -
 * see observe.mjs for why.
 */
async function settleObserve(actor, bookmark, after, done) {
    if (!bookmark.observeKey) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { requestObserveResolve } = await import("./gm-bridge.mjs");
    const res = await requestObserveResolve({
        actorId: actor.id,
        key: bookmark.observeKey,
        total: after.total,
        isCritical: after.isCritical,
        undo: true
    });

    /* A REFUSAL IS NOT A REPLAY (E08+E28 C6a, 03.10.2026; audit S05-22). This answered the key
       whatever came back, so a resolve the GM's client refused (observe.mjs
       `observeResolveRefusal`) left the Hope paid and the new dice standing, for nothing.
       The Reroll is made on a GM (C4a), whose resolve runs here and answers its refusal as
       `{ refused }`: the Reroll is then taken back whole (`giveBack`). A resolve that found no
       record answers null and has asked the GMs to score the new number by hand
       (`DRPG.Observe.rerollLost`), so that one stands, as it did. */
    const answer = res.ok ? res.value : null;
    if (answer?.refused) return null;
    if (res.ok) done.push(game.i18n.localize("DRPG.Reroll.observeReplayed"));
    return { observeKey: bookmark.observeKey };
}

/**
 * Take back a crisis action and run it again against the new number.
 *
 * The one that used to fall through to "the dice are the whole result", which
 * for an incident is the worst place to do that: the damage, the Remnant, the
 * hindrance and the turn all stood while the number underneath them changed.
 * Three Hope bought a cosmetic edit in the middle of a fight.
 *
 * Everything is done on the GM's client, because everything a crisis action
 * touches is: the other participant's sheet, the map, the shared incident
 * state. This side sends which action, the new number, and "take the old one
 * back first" - see `undoLastCrisis` in murder.mjs for what that involves.
 *
 * The turn is NOT spent twice. Rewinding restores whose turn it was, and the
 * replay passes it again, so the action costs one turn in total however many
 * times it is rerolled.
 *
 * `bookmark.crisis` is the GMs' fact of the action (murder.mjs `noteCrisisFact`),
 * written by the GM that resolved it.
 *
 * WITH THE FIRST THROW'S FACTS, ON THIS GM (E08+E28 C6b, 03.10.2026; audit S04-18). The
 * Reroll is made on a GM since C4a, and this still sent the bridge's crisis packet - to its
 * own client - with the new number and nothing else: no pick, no item, no `before`. So a
 * critical Strike's replay read "the killer chooses" and marked nothing, and Use an item's
 * read "fumbled" over the heal its undo had kept. It runs `resolveCrisisAction` here, with
 * the row's pick, item, the reserve the item healed and what it started from (`again`);
 * nothing of it is a packet's. Exported for the suite.
 */
export async function settleCrisis(actor, bookmark, after, done) {
    if (!bookmark.crisis) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { resolveCrisisAction } = await import("./murder.mjs");
    const value = await resolveCrisisAction({
        actorId: actor.id,
        key: bookmark.crisis,
        total: after.total,
        isCritical: after.isCritical,
        withHope: after.withHope,
        undo: true,
        again: { choice: bookmark.choice ?? null, usedItemId: bookmark.usedItemId ?? null,
            usedFor: bookmark.usedFor ?? null, before: bookmark.before ?? null }
    });

    // Nothing carried out (`resolveCrisisAction` answers null): nothing was replayed, and the
    // caller puts the first roll back.
    if (!value) return null;
    done.push(game.i18n.localize("DRPG.Reroll.crisisReplayed"));
    return { crisis: bookmark.crisis };
}

/**
 * Take back a Stage 6 clean-up and run it again.
 *
 * The trace it erased comes back, the trace a botched wipe left is removed, and
 * the Sanity is refunded before the new number is scored - so a reroll costs the
 * Hope and one attempt's Sanity, not two attempts' worth.
 *
 * `bookmark.cleanup` is the Remnant token id, written by `attemptCleanup`
 * through `rollTrait`'s `context`.
 */
async function settleCleanup(actor, bookmark, after, done) {
    if (!bookmark.cleanup) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    /*
     * ONLY THE WIPE CAN BE REPLAYED, AND THIS USED TO TRY ANYWAY.
     *
     * Stage 6 has three actions and `bookmark.cleanup` holds a token id for one
     * of them and an ACTION NAME for the other two. Sent down this path a
     * rerolled misleading trail arrived at `resolveCleanup` as a token id
     * reading "misleadingTrail", which found no such token and reported the
     * trace as having vanished - a reroll that quietly did nothing and said
     * something false about why.
     *
     * `cleanupKey` (E12) is what tells them apart. The other two are not
     * replayed because they cannot be: a planted trail is a token already
     * sitting in a room and `resolveStageSix` has no undo, and inventing one
     * that deletes a Remnant on the strength of a bookmark is a worse failure
     * than saying so. The dice have still been rewritten, which is what the
     * three Hope bought.
     */
    const key = bookmark.cleanupKey ?? "eraseTrace";
    // Both of the actions that AIM AT A TRACE can be replayed, because both
    // have an undo: an erased trace is re-created from its recorded shape, and
    // a reshaped one is retuned back to what it was. The two that roll against
    // a flat threshold still cannot - see above.
    if (key !== "eraseTrace" && key !== "transformTrace") {
        done.push(game.i18n.localize("DRPG.Reroll.trailStands"));
        return {};
    }

    const { requestCleanup } = await import("./gm-bridge.mjs");
    const res = await requestCleanup({
        actorId: actor.id,
        tokenId: bookmark.cleanup,
        total: after.total,
        isCritical: after.isCritical,
        withHope: after.withHope,
        // The same declaration the first roll carried. A replay that dropped it
        // would reshape nothing and report a success.
        key,
        change: bookmark.cleanupChange ?? null,
        // Which door it came through, and - since T-1 - which STEP of the price
        // chain it really paid. A replay that forgot the step would be charged
        // the GM-side Sanity as though nothing had been paid on the client, and a
        // critical would hand back the wrong currency.
        viaAction: Boolean(bookmark.cleanupVia),
        price: bookmark.cleanupPrice ?? null,
        grant: Boolean(bookmark.cleanupGrant),
        undo: true
    });

    /* NOT "REPLAYED" WHEN NOTHING WAS (E08+E28 C3, 03.10.2026; audit S05-44). A GM with no
       receipt of the first attempt - none kept, or the one kept for another trace - aborts the
       replay and tells the GMs (`rerollLost`), and the asker gets a refusal. The card said
       nothing of it, so the player read the new dice as the clean-up's; it now says the replay
       did not happen, in the conditional, since a refusal does not say which of its reasons it was. */
    done.push(game.i18n.localize(res.ok ? "DRPG.Reroll.cleanupReplayed" : "DRPG.Cleanup.rerollManual"));
    return { cleanup: bookmark.cleanup };
}

/**
 * A theft cannot be taken back, and this says so instead of pretending.
 *
 * Without a branch here Steal fell through to the default, which pushes "this
 * roll left no lasting effect" - and a theft is the one action in the game
 * where that sentence is most obviously false: an item moved between two
 * sheets and, half the time, somebody was told about it (trap 94).
 *
 * Undoing it is not a technical problem, it is a fiction one. Giving the item
 * back means the victim WATCHES it come back, which is a bigger tell than the
 * theft was; and a victim who was already told they were robbed cannot be
 * untold. So the dice are rewritten - that is what the three Hope bought, and
 * on a failed theft it is genuinely worth having - and the table is told
 * plainly that the world did not move with them.
 */
async function settleSteal(actor, bookmark, after, done) {
    // ONE LINE FOR BOTH OUTCOMES, because this client does not reliably know
    // which one it was: the theft is settled on a GM's client and can be
    // refused there. A sentence that is true whether or not anything moved is
    // worth more than two that are each right half the time.
    done.push(game.i18n.localize("DRPG.Reroll.stealStands"));
    return {};
}

/**
 * Take back an Analyze and score it again.
 *
 * Only the evidence branch reaches this: asking the GM for a hint is a ruling,
 * so it carries `gmRuled` and is re-asked instead. The GM's client winds the
 * bullet back to unidentified and unlocked before applying the new number -
 * which also means a Reroll can lift a lock the first roll had just stamped on.
 */
async function settleAnalyze(actor, bookmark, after, done) {
    if (!bookmark.bulletId) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { requestAnalyzeResolve } = await import("./gm-bridge.mjs");
    const res = await requestAnalyzeResolve({
        actorId: actor.id,
        itemId: bookmark.bulletId,
        total: after.total,
        isCritical: after.isCritical,
        undo: true
    });

    if (res.ok) done.push(game.i18n.localize("DRPG.Reroll.analyzeReplayed"));
    return { bulletId: bookmark.bulletId };
}

async function settleListen(actor, bookmark, after, done) {
    const def = ACTIONS.listen;
    const target = bookmark.target;
    if (!target) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { neighbouringRooms, occupantsOf } = await import("./movement.mjs");
    const hit = resolveThreshold(after.total, def.thresholds);
    const namedFrom = Math.max(...def.thresholds.map(t => t.min));

    if (after.isCritical) {
        for (const room of neighbouringRooms(bookmark.room)) {
            const who = occupantsOf(room, actor).map(a => a.name);
            done.push(`${room} - ${who.length ? who.join(", ") : game.i18n.localize("DRPG.Listen.empty")}`);
        }
    } else if (hit && hit.min >= namedFrom) {
        const who = occupantsOf(target, actor).map(a => a.name);
        done.push(game.i18n.format("DRPG.Listen.named", {
            room: target,
            who: who.length ? who.join(", ") : game.i18n.localize("DRPG.Listen.empty")
        }));
    } else if (hit) {
        const count = occupantsOf(target, actor).length;
        done.push(count
            ? plural("DRPG.Listen.anonymous", { room: target, n: count })
            : game.i18n.format("DRPG.Listen.emptyRoom", { room: target }));
    } else {
        done.push(def.failure);
    }

    return {};
}

/**
 * Observe, Analyze, Direct Murder and a described Search all end in a human
 * ruling. A die cannot take that back, so the GM is asked again with the new
 * number and told the previous answer no longer stands.
 */
async function settleGmRuling(actor, bookmark, after, done) {
    const { callGm } = await import("./gm-bridge.mjs");

    await callGm(actor, {
        title: bookmark.label ?? game.i18n.localize("DRPG.Reroll.title"),
        request: bookmark.request ?? "",
        room: bookmark.room ?? null,
        roll: {
            trait: bookmark.trait,
            total: after.total,
            isCritical: after.isCritical,
            withHope: after.withHope,
            withFear: after.withFear
        },
        body: `<p class="drpg-warning">${game.i18n.format("DRPG.Reroll.rulingVoid", {
            old: bookmark.total ?? "?", new: after.total
        })}</p>`,
        // Only "reply". A re-asked ruling has already been paid for once and
        // the reroll spent its own price, so there is nothing here to hand back
        // - the GM either answers again or the first answer simply stands.
        actions: [{
            action: "reply",
            label: game.i18n.localize("DRPG.Bridge.reply"),
            data: { by: actor.id }
        }]
    });

    done.push(game.i18n.localize("DRPG.Reroll.gmReasked"));
    return {};
}

/* ==========================================================================
 * SHARED PIECES
 * ========================================================================== */

/**
 * Bring the trace into line with the new roll: retune it, remove it, or leave
 * one where the first roll left none.
 *
 * All three cases are real. A trace whose visibility came from dice that no
 * longer exist is simply wrong; a trace left by an action that no longer
 * succeeds should not be there; and a roll that fails and is then rerolled into
 * a success has to leave the trace the first attempt never earned. Only the
 * first of the three used to happen, so a Search rerolled from nothing into a
 * crime tool put the tool in the inventory and left no evidence at all.
 *
 * Editing or creating a token is GM-only, so a player's request goes over the
 * bridge exactly as placing one does.
 *
 * @param {Actor} actor
 * @param {object} bookmark
 * @param {string|null} visibility  New band, or null when there should be none.
 * @param {object|null} [drop]      What to create if there is no trace yet.
 * @param {{isCritical?: boolean, withHope?: boolean}|null} [gate]  The reroll's
 *   new duality result - see `traceFeedback` in remnants.mjs. Never the exact
 *   band, same as every other action that can leave one.
 * @returns {Promise<object>} bookmark fields describing where the trace now is.
 */
async function settleRemnant(actor, bookmark, visibility, done, drop = null, gate = null) {
    const { retuneRemnant, dropRemnant, traceFeedback } = await import("./remnants.mjs");

    // Nothing there yet.
    if (!bookmark.remnantId) {
        if (visibility === null) return {};

        if (!drop) {
            // Placed on a player's behalf, so this client never learned its id.
            done.push(game.i18n.localize("DRPG.Reroll.remnantManual"));
            return {};
        }

        const placed = await dropRemnant(actor, { ...drop, visibility });
        const doc = placed?.document ?? placed;
        if (traceFeedback(gate, doc)) done.push(game.i18n.localize("DRPG.Reroll.remnantLeft"));
        return doc?.id
            ? { remnantId: doc.id, remnantScene: doc.parent?.id ?? canvas?.scene?.id ?? null }
            : {};
    }

    if (visibility === null) {
        const removed = await retuneRemnant(bookmark.remnantScene, bookmark.remnantId, { remove: true });
        if (removed) done.push(game.i18n.localize("DRPG.Reroll.remnantRemoved"));
        return { remnantId: null, remnantScene: null };
    }

    // A Search's trace is OF the object it found, and a Reroll may have found a
    // different one: the identity, subject and note follow it (review of ACT-11).
    // Only a drop that names an identity says so - the other actions' traces are
    // of the same thing whatever the dice say.
    const describes = drop && "itemIdentity" in drop
        ? { itemIdentity: drop.itemIdentity, subject: drop.subject, note: drop.note }
        : null;
    const retuned = await retuneRemnant(bookmark.remnantScene, bookmark.remnantId, { visibility, describes });
    if (traceFeedback(gate, retuned)) done.push(game.i18n.localize("DRPG.Reroll.remnantRetuned"));
    return {};
}

/**
 * A critical on Work on Project returns the action it cost. Gaining or losing
 * that critical on a reroll has to move the action with it.
 *
 * @returns {Promise<boolean>} whether the action is refunded after this.
 */
async function settleActionRefund(actor, bookmark, shouldRefund, done) {
    const wasRefunded = Boolean(bookmark.refunded);
    if (wasRefunded === shouldRefund) return wasRefunded;

    const { refundAction, takeBackRefund } = await import("./actions.mjs");
    const receipt = bookmark.burst ? { grant: true, amount: 1 } : { grant: false, amount: 1 };

    if (shouldRefund) {
        await refundAction(actor, 1, receipt);
        done.push(game.i18n.localize("DRPG.Action.actionReturned"));
        return true;
    }

    // The crit is gone, so the free action goes with it. If they have already
    // spent it there is nothing to take, and saying so beats a silent failure.
    const taken = await takeBackRefund(actor, 1, receipt);
    done.push(game.i18n.localize(taken
        ? "DRPG.Reroll.actionTakenBack"
        : "DRPG.Reroll.actionOwed"));
    return false;
}
