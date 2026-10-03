/**
 * Danganronpa RPG - the Reroll Hope Call.
 * ---------------------------------------------------------------------------
 * Three Hope buys back the dice you have already thrown. Unlike every other
 * Hope Call this one looks backwards, so it is not armed and waited on: it acts
 * the moment it is paid for, on the single most recent roll and nothing older.
 *
 * "Replace the old result with the new one" is not a chat-card edit. It means
 * the action is taken back and run again:
 *
 *   the dice      the chat message is rewritten in place, so the table sees one
 *                 roll with new numbers rather than two contradictory rolls
 *   Hope / Sanity `settleDualityReroll`, a port of what `DualityRoll#reroll`
 *                 settles, moves these from the old duality to the new one
 *   Despair       ours, not the system's - a Despair result that becomes a Hope
 *                 result has to hand the point back to the Monokuma that got it
 *   the action    whatever the roll actually did is undone and redone against
 *                 the new number: project progress, the item a Search drew, the
 *                 Remnant it left, the freeze and repair a Sabotage caused
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

import { MODULE_ID, ACTIONS, PROJECT_SCALE, DYNAMIC_THRESHOLDS, CRITICAL, TIMING, TRAITS, TRAIT_BY_DH } from "./config.mjs";
import { resolveThreshold, easedBy, log, error, plural } from "./utils.mjs";
import { rollBookmark, keepRollBookmark, searchTier, stashStepFor, stashText } from "./action-rolls.mjs";
import { leavesTraceFor } from "./inventory.mjs";
import { keptRollSubject, isClaimedRoll, neutralRollOf } from "./private-rolls.mjs";

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
 * replay has not been refused (`rerollLastAction`, fix r1-G3), so here they only show.
 * The system's own settlement clears a Sanity mark for a critical, which this
 * game's critical never does, and compensating after its unawaited, clamped
 * write could not know what it had really moved.
 */
async function rerollKeepingDice(original, actor, message, bookmark = null) {
    const wanted = advantageDice(original);
    const thrown = await rollAsThrown(original, actor, message, bookmark);
    if (wanted <= 1) {
        const rerolled = await thrown.reroll();
        await showRerolledDice(rerolled, message);
        return rerolled;
    }

    const clone = thrown.clone();
    clone.advantageNumber = wanted;
    clone.constructFormula(clone.options);
    const rerolled = await clone.evaluate();
    await showRerolledDice(rerolled, message);
    return rerolled;
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
 * and the experiences from this browser's bookmark (action-rolls.mjs
 * `rememberRoll`) - which is kept only for the roll the bookmark names. A roll
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
    if (!trait) throw new Error(`no statistic is kept in this browser for roll ${message.id}`);
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
 * The rerolled dice, on the screens of the people who read the roll (E06 C6,
 * 27.09.2026; audit S02-13). `showForRoll(rerolled, game.user, true)` threw them
 * to every screen, whoever the roll was whispered to. Dice So Nice shows them to
 * `users` now: the message's whisper list and its author, or everybody when the
 * roll was not whispered. The incident's other participants are sent them by the
 * primary GM when the message's rolls change (private-rolls.mjs
 * `relayIncidentDice`). Dice So Nice still sends a synchronised throw to every
 * client and filters it as it arrives (Dice3D.js `_installSocket`, read in
 * 6.3.1); the dice leave the roller's browser only when E28 throws them on the
 * GM. Exported for the suite.
 */
export async function showRerolledDice(rerolled, message) {
    try {
        if (game.modules.get("dice-so-nice")?.active) {
            // Their own try: a missing dice system makes the preset lookup throw,
            // and that must not also take the animation with it.
            try {
                const extra = rerolled.dAdvantage ?? rerolled.dDisadvantage;
                const presets = await CONFIG.DH?.GENERAL?.getDiceSoNicePresets?.(rerolled,
                    rerolled.dHope?.denomination, rerolled.dFear?.denomination,
                    extra?.denomination ?? "d6", extra?.denomination ?? "d6");
                const paint = (die, preset) => { if (die && preset?.appearance) die.options.appearance = preset.appearance; };
                paint(rerolled.dHope, presets?.hope);
                paint(rerolled.dFear, presets?.fear);
                paint(rerolled.dAdvantage, presets?.advantage);
                paint(rerolled.dDisadvantage, presets?.disadvantage);
            } catch (err) {
                error("Could not colour the rerolled Hope and Fear dice", err);
            }
            const whisper = [...(message?.whisper ?? [])];
            const author = message?.author?.id ?? message?.user?.id ?? game.user.id;
            const readers = whisper.length ? [...new Set([...whisper, author])] : null;
            await game.dice3d?.showForRoll(rerolled, game.user, true, readers, false,
                message?.id ?? null, message?.speaker ?? null);
        } else {
            foundry.audio.AudioHelper.play({ src: CONFIG.sounds.dice });
        }
    } catch (err) {
        error("Could not show the rerolled dice", err);
    }
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
 * own resource map calls. The dice are shown first (`showRerolledDice`, in
 * `rerollKeepingDice`), in the system's Hope and Fear colours from
 * `CONFIG.DH.GENERAL.getDiceSoNicePresets`, as a fresh roll's are; this runs after
 * the replay (`rerollLastAction`).
 */
async function settleDualityReroll(original, rerolled, actor) {
    if (original.options?.actionType === "reaction") return;

    try {
        const { hope, stress, fear } = rerollDeltas(original, rerolled);
        const { hopeFear, countdownAutomation } = dhAutomation();

        if (game.user.isGM ? hopeFear.gm : hopeFear.players) {
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
 * (`rerollLastAction`). The roll's own `source.actor` is empty on every roll
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

/**
 * Reroll this character's last roll.
 * @returns {Promise<string[]>} lines describing what changed, for the Call's receipt.
 */
export async function rerollLastAction(actor) {
    const done = [];

    const { bookmark, message } = lastRollOf(actor);
    if (!message) {
        ui.notifications.warn(game.i18n.localize("DRPG.Reroll.nothingToReroll"));
        return null;
    }
    // Before the dice are touched, and null so the Call's price goes back (`rerollEffect`):
    // `spendHopeCall` asks first, and this is for a caller that did not.
    if (lethalReroll(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Reroll.deathStands"));
        return null;
    }

    const original = message.rolls?.[0];
    if (!original?.reroll) {
        ui.notifications.warn(game.i18n.localize("DRPG.Reroll.notARoll"));
        return null;
    }

    const before = dualityOfRoll(original);
    // The card's rolls as the first throw left them, for a replay the GM refuses (`putFirstRollBack`).
    const firstRolls = foundry.utils.deepClone(message.toObject().rolls ?? []);

    // `rerollKeepingDice` shows the dice again; the Hope the first result granted
    // is reversed after the replay - see `settleDualityReroll`.
    let rerolled;
    try {
        rerolled = await rerollKeepingDice(original, actor, message, bookmark);
        await message.update({ rolls: [rerolledSource(rerolled, message)] });
    } catch (err) {
        error("Could not reroll the last action", err);
        ui.notifications.error(game.i18n.localize("DRPG.Reroll.failed"));
        return null;
    }

    const after = dualityOfRoll(rerolled);
    done.push(game.i18n.format("DRPG.Reroll.replaced", {
        old: before.total, new: after.total
    }));

    // Undo and replay the action itself. Every branch returns the bookmark
    // fields it changed, so the flag is written once, at the end, from the state
    // the replay actually left behind. Writing it from the pre-reroll bookmark -
    // which is what used to happen - put the OLD progress figure back on the
    // flag straight after the replay had corrected it, so a second Reroll
    // subtracted a number the project no longer held.
    const patch = await replayAction(actor, bookmark, after, done, rerolled);
    if (patch === null) {
        await putFirstRollBack(message, firstRolls);
        return null;
    }

    /*
     * SETTLED ONCE THE REPLAY STANDS (E32+E07 fix r1-G3, 02.10.2026). The Hope and Fear
     * the new duality moves, the Despair and the critical's Hope were settled before the
     * replay until this fix; a replay the GM refused then had them to move back, and an
     * inverse is not one at the edges: this fix's first build moved them back, and in the
     * full suite the Despair pool did not come back to its number (alone it did; e32run
     * g3f1, 02.10). Read off `adjustDespair`, a point that does not fit a full pool spills
     * to the overflow, and the point given back is the pool's own. Settled here, a refused
     * replay has moved none of them.
     */
    await settleDualityReroll(original, rerolled, actor);
    // A reaction roll paid no Despair and no critical Hope, so a reroll of one
    // has none to move - the same test `settleDualityReroll` makes (review of
    // CALL-08, 17.09: the one-die path now reaches here for a reaction too).
    if (original.options?.actionType !== "reaction") {
        await settleDespair(actor, before, after, done);
        await settleCritHope(actor, before, after, done);
    }

    try {
        // Replacement, matching `rememberRoll`: the spread below is the whole
        // of the new bookmark, so a `patch` that nulls a field it consumed -
        // an item it removed, a Remnant it retuned - actually clears it.
        await keepRollBookmark(actor, {
            ...(bookmark ?? {}),
            ...patch,
            messageId: message.id,
            total: after.total,
            withFear: after.withFear,
            isCritical: after.isCritical,
            rerolled: true
        });
    } catch {
        // A stale bookmark only costs a second Reroll.
    }

    log(`${actor.name} rerolled ${before.total} into ${after.total} (${bookmark?.actionKey ?? "no action"}).`);
    return done;
}

/**
 * A REPLAY THE GM CARRIED OUT NOTHING OF IS NO REROLL (E32+E07 fix r1-G3, 02.10.2026;
 * C8b's A2). The dice are rewritten and settled before the GM is asked - the GM takes a
 * player's undo only after a rewrite of their roll (reroll-receipts.mjs) - and until this
 * fix a refused replay (a crisis action that killed whose bookmark lacked the mark, an
 * incident closed or moved on, no record) left the new dice on the card and the 3 Hope
 * paid for nothing. The resources the new dice move are settled only once the replay
 * stands (`rerollLastAction`), so the card is all there is to put back: it gets its
 * first rolls again. The caller answers null, and the Call's price comes back by its own
 * road (call-effects.mjs `rerollEffect`). The put-back is a rewrite of the roll as well,
 * and the GM keeps a receipt for it as for any (reroll-receipts.mjs). The harness has no Daggerheart roll to throw again; the suite drives this with a roll of
 * its own, and a real table has not run it.
 */
async function putFirstRollBack(message, firstRolls) {
    try {
        await message.update({ rolls: firstRolls });
    } catch (err) {
        error("Could not put the first roll back on its card after a refused replay", err);
    }
}

/* ==========================================================================
 * FINDING THE ROLL
 * ========================================================================== */

/**
 * The message to rewrite. The bookmark set when the roll was made is preferred;
 * a scan of recent chat covers rolls made straight from the sheet, which do not
 * pass through the action engine.
 */
/** How far back the fallback scan will look, in real minutes. */
const REROLL_WINDOW_MINUTES = TIMING.rerollWindowMinutes;

/**
 * What a Reroll of this character would take back: this browser's bookmark
 * (`rollBookmark`, action-rolls.mjs - the roller's own browser since E05 C7) and the
 * message it names, or the scan's. Exported for the suite, which holds a Reroll to
 * the bookmark rather than to the newest roll.
 */
export function lastRollOf(actor) {
    const bookmark = rollBookmark(actor);
    return { bookmark, message: findMessage(actor, bookmark) };
}

/**
 * Whether a Reroll of this character would take back a crisis action that killed
 * (E32+E07 C8b, 28.09.2026; the owner's answer (A)): the death stands, so the Call
 * is refused before anything is paid (calls.mjs `spendHopeCall`). Read off this
 * browser's bookmark, which `takeCrisisAction` marks `lethal` on the GM's answer -
 * the player's convenience, not the gate: the GM refuses the undo whatever a
 * packet says (murder.mjs `undoLastCrisis`).
 */
export function lethalReroll(actor) {
    const { bookmark, message } = lastRollOf(actor);
    return Boolean(message && bookmark?.crisis && bookmark.lethal);
}

function findMessage(actor, bookmark) {
    if (bookmark?.messageId) {
        const byId = game.messages.get(bookmark.messageId);
        if (byId?.rolls?.length) return byId;
    }

    // Bounded scan. Reroll undoes "your last action", not "the last roll you
    // ever made" - without a cutoff the fallback happily reached back into a
    // previous session and rewrote a roll nobody remembered making.
    const cutoff = Date.now() - REROLL_WINDOW_MINUTES * 60_000;

    const all = game.messages?.contents ?? Array.from(game.messages ?? []);
    const mine = all.filter(m =>
        m.rolls?.length &&
        belongsTo(m, actor) &&
        (m.timestamp ?? 0) >= cutoff);

    return mine.length ? mine[mine.length - 1] : null;
}

/** Is this roll about `actor`: as this browser kept it when it threw the roll (E06 C5a), or as the message names it. */
function belongsTo(message, actor) {
    if (keptRollSubject(message) === actor.id) return true;
    if (message.speaker?.actor === actor.id) return true;
    const source = message.system?.source?.actor;
    return typeof source === "string" && source === actor.uuid;
}

/** Hope / Despair / critical, read straight off the dice so it always works.
 *  Exported for the GM's reroll receipts (reroll-receipts.mjs), which have to
 *  read the same duality off the same message and must not grow a second
 *  opinion of it. */
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
 * one that becomes a Despair roll takes a point now.
 */
async function settleDespair(actor, before, after, done) {
    if (before.withFear === after.withFear) return;

    try {
        const { monokumaFor } = await import("./assignments.mjs");
        const monokuma = monokumaFor(actor);
        if (!monokuma) return;

        const delta = after.withFear ? 1 : -1;
        const { requestDespairAdjust } = await import("./gm-bridge.mjs");
        const { poolLabel } = await import("./despair.mjs");
        const res = await requestDespairAdjust(monokuma.id, delta, { actorId: actor.id });
        // Only what was asked for and not refused (E31): the refusal has been said.
        if (!res.ok) return;

        // The pool's name, as the Despair bar shows it - not the GM's account.
        done.push(game.i18n.format(delta > 0 ? "DRPG.Reroll.despairGained" : "DRPG.Reroll.despairReturned", {
            name: poolLabel(monokuma)
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
 */
async function settleCritHope(actor, before, after, done) {
    if (before.isCritical === after.isCritical) return;

    try {
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
 * fields it changed so the caller can write the flag once.
 *
 * Failure here is reported, never thrown: the dice have already been rewritten
 * and the Hope already spent, so a branch that cannot finish must say what it
 * could not do rather than take the whole Call down with it. One answers null
 * instead of fields: a crisis replay the GM carried out nothing of
 * (`settleCrisis`), and the Reroll is then taken back whole (`putFirstRollBack`).
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
    if (bookmark.itemId) {
        const item = actor.items.get(bookmark.itemId);
        if (item) {
            const name = item.name;
            try {
                await item.delete();
                done.push(game.i18n.format("DRPG.Reroll.itemTakenBack", { item: name }));
            } catch (err) {
                error("Could not take back the item a reroll undid", err);
                done.push(game.i18n.format("DRPG.Reroll.itemStuck", { item: name }));
                itemId = bookmark.itemId;
            }
        }
    }

    // 2. Draw again, from the same category and for the same goal - and from
    //    the same ROOM, so the room's own table answers as it did the first time.
    let drawnName = null;
    let drawn = null;
    let granted = null;
    if (found && bookmark.category) {
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
    return { itemId, tier: found ? tier : null, ...trace };
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
 * `bookmark.crisis` is written by `takeCrisisAction`, which passes the action
 * key through `rollTrait`'s `context`.
 */
async function settleCrisis(actor, bookmark, after, done) {
    if (!bookmark.crisis) {
        done.push(game.i18n.localize("DRPG.Reroll.noReplay"));
        return {};
    }

    const { requestCrisisResult } = await import("./gm-bridge.mjs");
    const res = await requestCrisisResult({
        actorId: actor.id,
        key: bookmark.crisis,
        total: after.total,
        isCritical: after.isCritical,
        withHope: after.withHope,
        undo: true
    });

    // Refused, or done on this GM's own client with nothing carried out (`resolveCrisisAction`
    // answers null): nothing was replayed, and the caller puts the first roll back. An answer
    // that did not come is not a refusal - the GM may have replayed it.
    if (res.refused || (game.user.isGM && res.ok && !res.value)) return null;
    if (res.ok) done.push(game.i18n.localize("DRPG.Reroll.crisisReplayed"));
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
