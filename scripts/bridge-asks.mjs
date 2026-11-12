/**
 * Danganronpa RPG - asking the GM.
 * ---------------------------------------------------------------------------
 * Every request a player's or a GM's client makes of the primary GM: a
 * `requestX` that asks through bridge-table.mjs's `ask` and answers the
 * bridge's result (`{ ok, pending?, value?, refused?, reason? }`, held by the
 * lint rule `drpg/bridge-result`), and the asks a card or a GM's window makes
 * through `ask`: `sendDespairToPrimary`, `askObservePick`,
 * `answerTraitRuling`, `answerHopeCall`, `askReshapeRuling`,
 * `answerDynamic`, `askCardClaim`, `claimCard`.
 *
 * WHERE IT SITS. Moved out of gm-bridge.mjs by E41 C5b (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line, in gm-bridge.mjs's
 * order. gm-bridge.mjs re-exports every name of this file it exported, so
 * every importer still imports gm-bridge.mjs; nothing here imports it (the
 * facade rule, .claude/rules/code.md).
 */

import { TIMING } from "./config.mjs";
import { debug } from "./utils.mjs";
import { sayNotDone, reasonOf } from "./bridge-guards.mjs";
import { claimOnPrimary, sayRefusedHere, observePickOnPrimary, yesOnPrimary, dynamicOnPrimary } from "./call-gm.mjs";
import {
    SOCKET_EVENT, ACTION_PROGRESS, ACTION_SHARE, ACTION_REMNANT, ACTION_TIE_TRACE, ACTION_REMNANT_EDIT, ACTION_SABOTAGE,
    ACTION_UNSABOTAGE, ACTION_PROJECT_CHANGE, ACTION_SENDBACK, ACTION_ECLIPSE_MOVE, ACTION_ARM, ACTION_DESPAIR,
    ACTION_OVERFLOW_ADD, ACTION_OVERFLOW_CLEAR, ACTION_DESPAIR_SET, ACTION_DESPAIR_ALL, ACTION_DESPAIR_ROSTER,
    ACTION_OVERFLOW_TAKE, ACTION_OVERFLOW_CHECK, ACTION_DIFFICULTY, ACTION_VOTE_CAST, ACTION_VOTE_ASK,
    ACTION_TRIAL_OBJECT, ACTION_TRIAL_EVIDENCE, ACTION_TRIAL_WITHDRAW, ACTION_FLOOR_REPOINT, ACTION_TRIAL_GM,
    ACTION_TRIAL_TURN, ACTION_TRIAL_CLAIM, ACTION_TRIAL_PRESENT, ACTION_READY_OPEN, ACTION_READY_ANSWER,
    ACTION_READY_END, ACTION_RESHAPE_RULING, ACTION_TRAIT_RULING, ACTION_HOPE_CALL, ACTION_CALL_YES,
    ACTION_RULING_EXPIRED, ACTION_RULING_RECEIVED, ACTION_DYNAMIC_ANSWER, ACTION_OBSERVE_TARGET, ACTION_OBSERVE_RESOLVE,
    ACTION_OBSERVE_PICK, ACTION_CLEANUP_TRACES, ACTION_ANALYZE_RESOLVE, ACTION_ADVANCEMENT, ACTION_ADVANCEMENT_OFFER,
    ACTION_SHARE_BULLET, ACTION_GIVE_ITEM, ACTION_PASSAGE_SHARE, ACTION_PASSAGE_CROSS, ACTION_PASSAGE_FIND,
    ACTION_REFUND_CROSSING, ACTION_VAULT_STEAL, ACTION_STEAL, ACTION_FIND_STASH, ACTION_PLANT, ACTION_FRISK_UNSEEN,
    ACTION_FRISK_ASK, ACTION_FRISK_ANSWER, ACTION_FRISK_FOLLOW, ACTION_CRISIS, ACTION_OPENING_RESULT, ACTION_CLEANUP,
    ACTION_BETRAYAL, ACTION_PARK_MURDER, ACTION_CUB_ABILITY, ACTION_CUB_ANSWER, ACTION_DONE, ACTION_LOOT, ACTION_NOTE_SAVE,
    ACTION_ROLL_BOOKMARK, ACTION_REROLL, ACTION_CARD, ACTION_CARD_CLAIM
} from "./bridge-wire.mjs";
import { ask } from "./bridge-table.mjs";

/**
 * Send a thrown opening roll to the GM, who owns Stage 4's state. A player's names its roll
 * (`rollId`, the message the GM wrote for it), whose record the GM scores it on (E08+E28 C17).
 */
export function requestOpeningResult({ actorId, side, total, isCritical, withHope, rollId = null }) {
    return ask(ACTION_OPENING_RESULT, { actorId, side, total, isCritical, withHope, rollId }, {
        local: () => import("./murder.mjs").then(m => m.resolveOpening({ actorId, side, total, isCritical, withHope }))
    });
}

/**
 * Any GM: have the primary give an offer - a kind, or `{ kind, extra, deferred }` (E10 C7) -
 * or, `offer` null, take back the one `offerId` names (E10 C6). Done on the primary itself,
 * asked of it from any other GM.
 */
export function requestOfferRecord(actorId, offer, offerId = null) {
    const asked = typeof offer === "string" ? { kind: offer } : offer ?? null;
    const op = asked?.kind ? "add" : "take";
    return ask(ACTION_ADVANCEMENT_OFFER, { actorId, op, kind: asked?.kind ?? null, extra: asked?.extra ?? 0,
        deferred: asked?.deferred ?? 0, offerId }, {
        onPrimary: true,
        local: () => import("./level-up.mjs").then(m => op === "add" ? m.recordOffer(actorId, asked) : m.dropOffer(actorId, offerId))
    });
}

/**
 * The private card a player's browser would post while an incident runs, asked of the primary GM
 * (secret.mjs `askGm`); its value is `{ id }`. A GM's own browser posts its cards itself and never
 * asks, but one that did would post it here (`local`: the card, whose `id` is the same).
 */
export function requestCardPost(card) {
    return ask(ACTION_CARD, card, {
        local: () => import("./secret.mjs").then(m => m.postAsked(game.user, card))
    });
}

/**
 * Take something off a body.
 *
 * Everything the taking does needs the GM: the Truth Bullet's answer key exists
 * only on their browser (`createTruthBullet` refuses elsewhere), placing a token
 * needs their permission, and the item has to leave a sheet the player does not
 * own. ONE request rather than three, because three would have intermediate
 * states in which the knife has left the body and arrived nowhere.
 */
export function requestBodyLoot({ takerId, bodyId, itemId = null, itemIds = null, hand = null, cover = null }) {
    // E68 C10: the Take's Hand roll (`hand`: rollId, total, isCritical, withHope) and the cover's Shadow roll where the
    // taker's browser saw somebody watching (`cover`, the same fields); the primary reads both off its record of them.
    const rolls = {
        rollId: hand?.rollId ?? null, total: hand?.total ?? 0, isCritical: Boolean(hand?.isCritical), withHope: Boolean(hand?.withHope),
        ...(cover ? { coverRollId: cover.rollId ?? null, coverTotal: cover.total ?? 0, coverCritical: Boolean(cover.isCritical),
            coverHope: Boolean(cover.withHope) } : {})
    };
    return ask(ACTION_LOOT, { takerId, bodyId, itemId, itemIds, ...rolls }, {
        local: () => import("./handover.mjs").then(m => m.lootBody({ takerId, bodyId, itemId, itemIds, hand, cover }))
    });
}

/**
 * Show a secret passage my character knows to a student beside it (E79 C7; sheet.mjs, 'Show the passage').
 * The primary GM judges and writes it; a GM's own browser does it here, and says a refusal as the bridge
 * would have said it to a player.
 */
export function requestPassageShare({ actorId, targetId, passageId }) {
    return ask(ACTION_PASSAGE_SHARE, { actorId, targetId, passageId }, {
        local: () => import("./passages-gm.mjs").then(m => m.sharePassage({ actorId, targetId, passageId }, { asker: game.user })).then(out => {
            if (out?.refused) sayNotDone(ACTION_PASSAGE_SHARE, reasonOf(out.refused));
            return Boolean(out?.shown);
        })
    });
}

/**
 * 'Go through' a tunnel my character stands at an end of (E80 C2; sheet.mjs). The primary GM judges it and moves
 * the token; a GM's own browser does it here when it is the primary, and says a refusal as the bridge would.
 * Its value is true once the token was moved. `hush` names reasons this browser does not say (H81 fix C3, the review's
 * H81-C3-R3): the drag's road keeps `cannotNow` quiet - the primary reading the token elsewhere than the drag left it,
 * a put-back of the GMs on its way, which says its own line - and says every other refusal as the bridge would. The
 * packet is the same; only this browser's words change.
 */
export async function requestPassageCross({ actorId, passageId }, { hush = [] } = {}) {
    const say = reason => {
        if (!hush.includes(reason)) sayNotDone(ACTION_PASSAGE_CROSS, reason);
    };
    const res = await ask(ACTION_PASSAGE_CROSS, { actorId, passageId }, {
        onPrimary: true,
        ...(hush.length ? { quiet: true } : {}),
        local: () => import("./passages-gm.mjs").then(m => m.crossTunnel({ actorId, passageId }, { asker: game.user })).then(out => {
            if (out?.refused) say(reasonOf(out.refused));
            return Boolean(out?.crossed);
        })
    });
    // Quiet, the waiter said nothing of a refusal or a failure: said here, but for the hushed.
    if (hush.length && !res.ok && res.reason) say(res.reason);
    return res;
}

/**
 * "Refund last crossing" from the Students window (E17 C3; gm-panel.mjs): the primary GM gives it back, here when this
 * is the primary, asked of it otherwise; a refusal is said as the bridge says it. Its value is the refund's reply, or null.
 */
export async function requestRefundCrossing(actorId) {
    const res = await ask(ACTION_REFUND_CROSSING, { actorId }, {
        onPrimary: true,
        local: () => import("./movement.mjs").then(m => m.refundLastCrossing(actorId)).then(out => {
            if (out?.refused) sayNotDone(ACTION_REFUND_CROSSING, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
    return res.ok ? res.value ?? null : null;
}

/**
 * Find Passage (E80 C3; action-analyze.mjs `locatePassage`): the roll `rollId` names goes to the primary GM, which reads the
 * total off its record and judges the rest from the GMs' records (passages-gm.mjs `resolvePassageSearch`); a GM's own
 * browser does it here when it is the primary, and says a refusal as the bridge would. Its value is true once judged:
 * what was found the character's owner is told on a card of its own, a miss in the same shape.
 */
export function requestPassageFind({ actorId, total = 0, isCritical = false, rollId = null }) {
    return ask(ACTION_PASSAGE_FIND, { actorId, total, isCritical, rollId }, {
        onPrimary: true,
        local: () => import("./passages-gm.mjs").then(m => m.resolvePassageSearch({ actorId, total, isCritical, rollId }, { asker: game.user })).then(out => {
            if (out?.refused) sayNotDone(ACTION_PASSAGE_FIND, reasonOf(out.refused));
            return !out?.refused;
        })
    });
}

/**
 * OBJECTION!, for the viewer's own student (E79 C16; trial.mjs `raiseObjection`). Its value is the primary GM's
 * `{ messageId, target, how, deadline }`, or `{ needName: true }` when the primary has no voice Room and `targetId`
 * names nobody - nothing was paid, and the asker names the target and asks again. The primary reads `targetId` only
 * when it has no Room. A GM's own browser runs it here when it is the primary.
 */
export function requestObject({ actorId, targetId = null }) {
    return ask(ACTION_TRIAL_OBJECT, { actorId, targetId }, {
        onPrimary: true,
        local: () => import("./trial.mjs").then(m => m.objectOnPrimary({ actorId, targetId })).then(out => {
            if (out?.refused) sayNotDone(ACTION_TRIAL_OBJECT, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/** The Truth Bullet for the asker's pending Objection (E79 C16; trial.mjs `pickObjectionEvidence`). Its value is `{ item }`. */
export function requestEvidence({ actorId, itemId, comment = "", analysis = true }) {
    return ask(ACTION_TRIAL_EVIDENCE, { actorId, itemId, comment, bare: analysis === false }, {
        onPrimary: true,
        local: () => import("./trial.mjs").then(m => m.evidenceOnPrimary({ actorId, itemId, comment, analysis })).then(out => {
            if (out?.refused) sayNotDone(ACTION_TRIAL_EVIDENCE, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/**
 * The asker's pending Objection taken back, its picker closed or cancelled (E79 fix r4-G2; trial.mjs `raiseObjection`).
 * Quiet: nobody waits on it, and the card says what came of the Objection.
 */
export function requestWithdraw({ actorId, messageId }) {
    return ask(ACTION_TRIAL_WITHDRAW, { actorId, messageId }, {
        onPrimary: true,
        local: () => import("./trial.mjs").then(m => m.withdrawOnPrimary({ actorId, messageId })).then(out => !out?.refused)
    });
}

/** A GM's new target for the running Objection (E79 C16; trial.mjs `repointDialog`). Its value is `{ target }`. */
export function requestRepoint(targetId) {
    return ask(ACTION_FLOOR_REPOINT, { targetId }, {
        onPrimary: true,
        local: () => import("./trial.mjs").then(m => m.repointOnPrimary({ targetId })).then(out => {
            if (out?.refused) sayNotDone(ACTION_FLOOR_REPOINT, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/**
 * A GM's change of the trial's floor, asked of the primary GM (E70 C0; trial-floor.mjs `floorStep`). Its value is the
 * floor written, `{}` for an end; the primary itself runs it in place.
 */
export function requestTrialGm(op, { seconds = null, actorId = null, targetId = null, messageId = null, text = null, order = null,
    slot = null, beyondPaid = false } = {}) {
    // A round's order travels as one string of ids (E70 C7; the row's `as.text`).
    const joined = Array.isArray(order) ? order.join(",") : order;
    return ask(ACTION_TRIAL_GM, { op, seconds, actorId, targetId, messageId, text, order: joined, slot, beyondPaid }, {
        onPrimary: true,
        local: () => import("./trial-floor.mjs").then(m => m.floorOnPrimary(op, { seconds, actorId, targetId, messageId, text, order: joined, slot, beyondPaid }))
    });
}

/**
 * A volunteer for the Closing Argument from this browser (E70 C8; trial-prompt.mjs): `actorId` this player's student.
 * Its value is `{ count }`, the volunteers counted so far.
 */
export function requestClaim({ actorId }) {
    return ask(ACTION_TRIAL_CLAIM, { actorId }, {
        onPrimary: true,
        local: () => import("./trial-modes.mjs").then(m => m.volunteerOnPrimary({ actorId })).then(out => {
            if (out?.refused) sayNotDone(ACTION_TRIAL_CLAIM, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/**
 * A Present from this browser (E70 C10; trial.mjs `presentDialog`): the card and the copies, posted by the primary. Its
 * value is `{ item, copies }`.
 */
export function requestPresent({ actorId, itemId, comment = "", analysis = true }) {
    return ask(ACTION_TRIAL_PRESENT, { actorId, itemId, comment, bare: analysis === false }, {
        onPrimary: true,
        local: () => import("./trial.mjs").then(m => m.presentOnPrimary({ actorId, itemId, comment, analysis })).then(out => {
            if (out?.refused) sayNotDone(ACTION_TRIAL_PRESENT, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/**
 * A round's step from this browser (E70 C7; trial-prompt.mjs): `kind` done or pass for the speaker's own turn, over for
 * a turn run out. Its value is `{ step }`, the step written. A step over is quiet: the floor says what came of it.
 */
export function requestTurn({ actorId, kind, step }) {
    return ask(ACTION_TRIAL_TURN, { actorId, kind, step }, {
        onPrimary: true,
        ...(kind === "over" ? { quiet: true } : {}),
        local: () => import("./trial-modes.mjs").then(m => m.turnOnPrimary({ actorId, kind, step }, game.user.id)).then(out => {
            if (out?.refused && kind !== "over") sayNotDone(ACTION_TRIAL_TURN, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/**
 * The readiness round's open, from the GM who pressed (E37 C3; boundary.mjs `askReadiness`). Its value is `{ round }`, the
 * round open now, `round: null` when nobody is asked; null on the primary's own refusal, which is told here.
 */
export function requestReadyOpen({ kind }) {
    return ask(ACTION_READY_OPEN, { kind }, {
        onPrimary: true,
        local: () => import("./boundary.mjs").then(m => m.openRoundOnPrimary({ kind, by: game.user.id })).then(out => {
            if (out?.refused) sayNotDone(ACTION_READY_OPEN, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/**
 * This player's answer in the open round (E37 C3; boundary.mjs `promptPlayer`): Done (`ready` true) or One moment. Its
 * value is `{ answer }`.
 */
export function requestReadyAnswer({ roundId, ready }) {
    return ask(ACTION_READY_ANSWER, { roundId, ready: ready === true });
}

/**
 * The round's end, from the GM's window (E37 C3; boundary.mjs `askReadiness`): `outcome` "go" or "stop". Its value is
 * `{ ended }`, with `barred: true` for a "go" an incident or a Class Trial bars from moving the clock (E37 fix FG1c);
 * null on the primary's own refusal, which is told here.
 */
export function requestReadyEnd({ roundId, outcome }) {
    return ask(ACTION_READY_END, { roundId, outcome }, {
        onPrimary: true,
        local: () => import("./boundary.mjs").then(m => m.endRoundOnPrimary({ roundId, outcome })).then(out => {
            if (out?.refused) sayNotDone(ACTION_READY_END, reasonOf(out.refused));
            return out?.reply ?? null;
        })
    });
}

/**
 * Arm a Call on somebody else's character.
 *
 * Support gives another player advantage. Flags live on the beneficiary's actor,
 * which the buyer has no write access to - hence "Player A lacks permission".
 * The GM owns everything, so they set it.
 *
 * AWAITED, LIKE A SABOTAGE (E03). The GM takes the Hope for a Support on
 * somebody else's character, and may refuse it - no Hope, a Silence, a GM who
 * sees the world differently - so "sent" is not "armed". The answer's `value`
 * is the GM's `{ ok, left }`; a GM arming it on its own client answers `true`,
 * or null for a character that is not there.
 */
export function requestArmCall(actorId, call, timeoutMs = TIMING.rulingMs) {
    return ask(ACTION_ARM, { actorId, call }, {
        timeoutMs,
        local: async () => {
            const actor = game.actors.get(actorId);
            if (!actor) return null;
            const { appendArmedCall } = await import("./call-effects.mjs");
            await appendArmedCall(actor, call);
            return true;
        }
    });
}

/**
 * An assistant GM's Despair change, sent to the primary to write (DESP-12).
 *
 * NOT `requestDespairAdjust` - a player's Reroll's road, retired in E08+E28 C8 - whose GM
 * road handed the change straight back to `adjustDespair`, which, on an assistant, would
 * have routed here again for ever.
 * 1.2.47 wired the receiving half (`handleDespair` admits a GM sender at any size)
 * and reached for the sending half through `hasGm`, which this file never
 * exported: the import came back undefined, the call threw, `adjustDespair`'s
 * catch wrote the pool locally, and the race DESP-12 exists to close - two GM
 * clients each writing the whole pools object from their own cache - stayed open.
 *
 * The caller has already checked that the primary is online and is somebody else.
 * The runner judges on the primary GM only, so there is one writer.
 */
export function sendDespairToPrimary(targetUserId, delta, { clamp = false } = {}) {
    return ask(ACTION_DESPAIR, { targetUserId, delta, ...(clamp ? { clamp: true } : {}) });
}

/**
 * A GM that is not the primary adds to the overflow (E17 C5; overflow.mjs `addOverflow`), which asked only once it
 * knew the primary is connected and is somebody else. Its value is `{ after }`, the count on the primary after.
 */
export function requestOverflowAdd(amount, reason) {
    return ask(ACTION_OVERFLOW_ADD, { amount, reason });
}

/**
 * A GM that is not the primary clears the overflow's count (H84-06; overflow.mjs `clearOverflowAsGm`), which asked only
 * once it knew the primary is connected and is somebody else. Its value is `{ cleared: true }`.
 */
export function requestOverflowClear() {
    return ask(ACTION_OVERFLOW_CLEAR, {});
}

/*
 * The pools' and the overflow's roads from a GM that is not the primary (E37 C7; despair.mjs `askToSet`, `askAll`,
 * `askRoster`, overflow.mjs `askPrimaryToTake`, `askPrimaryToCheck`), each asked only once the asker knows the primary is
 * connected and is somebody else. Their values: `{ value }` the pool written; `{ pools }` the pools written; `{ done }` or
 * `{ label }`; `{ taken }` the points taken; `{ armed }` the stamp armed, or null.
 */
export function requestDespairSet(targetUserId, value) {
    return ask(ACTION_DESPAIR_SET, { targetUserId, value });
}

export function requestDespairAll(op) {
    return ask(ACTION_DESPAIR_ALL, { op });
}

export function requestDespairRoster(op, targetUserId, label = null) {
    return ask(ACTION_DESPAIR_ROSTER, { op, targetUserId, ...(op === "label" ? { label } : {}) });
}

export function requestOverflowTake(amount, reason) {
    return ask(ACTION_OVERFLOW_TAKE, { amount, reason });
}

export function requestOverflowCheck(ahead, target = null) {
    return ask(ACTION_OVERFLOW_CHECK, { ahead: ahead === true, ...(target ? { session: target.session, day: target.day, timeOfDay: target.timeOfDay } : {}) });
}

/**
 * Sabotage writes two world settings; the GM applies it and this waits for the
 * real outcome rather than assuming the request will land.
 *
 * `sabotageProject` used to return `{pending: true}` here and let the action
 * report success on the strength of that alone - the freeze and the repair
 * project it depends on were still just an emitted socket message, applied
 * whenever the GM's client got around to it. A player who then tried to keep
 * working the same project immediately afterwards could land inside that gap
 * and find it not frozen yet, and the "repair created" text was reading a
 * repair object that did not exist yet either. This answers once the GM's
 * client says what it actually wrote (`value`), so the roll does not call
 * itself done until it is. Two clocks (COMM-17): the "got it" says the request
 * arrived, and the answer - two world writes and a repair project - may take
 * longer than that on a slow client.
 */
export function requestSabotage(targetId, difficulty, { rollId = null, actorId = null, penalty = 0, relief = 0, quiet = false,
    timeoutMs = TIMING.rulingMs } = {}) {
    return ask(ACTION_SABOTAGE, { targetId, difficulty, actorId, rollId, penalty, relief }, { timeoutMs, quiet });
}

/**
 * Taking a sabotage back writes the same two settings. It is only ever called by
 * Reroll, after the Call has already been paid for and the new roll is about to
 * replace the old effect, so the player has nothing to race against; it waits
 * for the thaw all the same, because the Reroll says the sabotage was undone
 * only once it was (E31 review).
 */
export function requestUndoSabotage(targetId, repairId, actorId = null) {
    return ask(ACTION_UNSABOTAGE, { targetId, repairId, actorId });
}

/**
 * A change of a project, asked of the primary GM by another GM's browser (E36 C1; projects.mjs `applyProjectChange`,
 * which asks it). The primary makes it in its queue and answers the step's result; on the primary itself it is made
 * here (`local`). Its value is that result.
 */
export function requestProjectChange(countdownId, change, by = null) {
    return ask(ACTION_PROJECT_CHANGE, { countdownId, change, by }, {
        onPrimary: true,
        /* NOT ASKED AGAIN, AND NOT WAITED OUT (E36 fix e1-G4, 25.10.2026; finding E36-R5). A change is not resent - a
           second +1 is not the first one's echo - so a primary that reloads or leaves after its "got it" ends this wait
           at once, as noAnswer (bridge-guards.mjs `primaryGone`), instead of after the row's clock; an answer that still
           comes says on this console that the change landed, so a GM about to make it again can read that it did. */
        untilPrimaryLeaves: true,
        late: value => debug(`A change of the project ${countdownId} asked of the primary landed after its wait ended.`, value),
        local: () => import("./projects.mjs").then(m => m.applyProjectChange(countdownId, change, { by }))
    });
}

/** A player whose token cannot be moved back asks the GM to do it. */
export function requestSendBack(sceneId, tokenId, position) {
    return ask(ACTION_SENDBACK, { sceneId, tokenId, position });
}

/** Count an Eclipse crossing in the GMs' store; `to` is the room crossed into, for its card. */
export function requestEclipseMove(actorId, to = null) {
    return ask(ACTION_ECLIPSE_MOVE, { actorId, to });
}

/**
 * This player's own pre-session note, for the GMs (E05 C6): written by the primary into
 * the GMs' store under the sender's id (`handleNoteSave`), and by a GM into its own store
 * here. Its value is `{ updatedAt, stamp }`, which pre-session-note.mjs `sendDraft` takes
 * as the GMs' copy; `quiet` for the note sent again when a GM arrives, which nobody is
 * waiting on.
 */
export function requestNoteSave(text, { quiet = false } = {}) {
    return ask(ACTION_NOTE_SAVE, { text }, {
        quiet,
        local: () => import("./pre-session-note.mjs").then(m => m.writeNote(game.user.id, text, { byGm: false }))
    });
}

/**
 * A player's ballot, to the primary GM (E10 C2; vote.mjs `sendBallot`): the round of the window it was
 * given in and the names checked there. Its value is `{ round }`, the round it was recorded in. Quiet:
 * the vote says what came of it in its own words - that it is in, why it was not, or that it is kept.
 */
export function requestBallotCast(round, choice) {
    return ask(ACTION_VOTE_CAST, { round, choice }, { quiet: true });
}

/**
 * This player's own ballot, asked of the primary GM (E10 C2; vote.mjs `askBallot`). Its value is the
 * ballot, `{ round, picks, candidates }`; `{ cast: true, round }` when the primary holds this player's
 * ballot of the round; or null.
 */
export function requestBallot() {
    return ask(ACTION_VOTE_ASK, {});
}

/**
 * The trace that handed over this object is evidence now.
 *
 * Asked by the killer's own client at the moment they swing, answered on the
 * GM's, because the answer key is theirs. Nothing waits on it: a trace that
 * cannot be re-labelled must not stop a murder that is already happening, and
 * the GM can tick the box by hand in the case dashboard. It carries a request
 * id since E31, like every request, so a refusal reaches the killer. No
 * identity is a caller's mistake, not the player's, and is said to nobody.
 */
export function requestTieTrace(identity) {
    if (!identity) return Promise.resolve({ ok: false, reason: "badRequest" });
    return ask(ACTION_TIE_TRACE, { identity }, {
        local: () => import("./remnants.mjs").then(m => m.tieTraceForItem(identity))
    });
}

/**
 * Creating tokens is GM-only, so a player's Remnant is placed for them. Answered
 * when it is placed (E31), not when it arrived, and refused as failed when the
 * GM's client could not place it (E31 review): the item a planted trace stands
 * for is taken off the sheet only when it was placed, and "trace left" is said
 * only then.
 */
export function requestRemnant(data, rollId = null) {
    return ask(ACTION_REMNANT, { data, rollId });
}

/**
 * Retune or remove a Remnant a player's own action left behind - a reroll has
 * changed how well they hid it, or removed the reason for the trace entirely.
 * Editing tokens is GM-only, same as creating them.
 */
export function requestRemnantEdit(sceneId, tokenId, patch) {
    return ask(ACTION_REMNANT_EDIT, { sceneId, tokenId, patch });
}

/**
 * A GM's pick or Refuse on an Observe card, sent to the primary GM (E09 C12; `observe.pick`).
 * The notice the primary answered with is shown here, to the GM who pressed. What the primary
 * answered ("picked", "refused", "gone", "notThere"), or null when it could not be asked.
 */
export async function askObservePick({ rid, actorId, tokenId = null, refuse = false } = {}) {
    const asked = { rid, actorId, tokenId, refuse: Boolean(refuse) };
    const res = await ask(ACTION_OBSERVE_PICK, asked, {
        onPrimary: true,
        local: () => observePickOnPrimary(asked, game.user.id)
    });
    if (!res.ok) return null;
    // The traces the primary leaves out (H84 fix G1): the picker on this browser leaves them out too (observe.mjs `pickFromCard`).
    if (Array.isArray(res.value?.held) && res.value.held.length) (await import("./observe.mjs")).noteHeldOnPrimary(rid, res.value.held);
    const told = res.value?.told ?? null;
    if (told) ui.notifications.warn(game.i18n.format(told, { name: game.actors.get(actorId ?? "")?.name ?? "?" }));
    return res.value?.value ?? null;
}

/**
 * A GM's answer to a statistic card, sent to the player who asked alone: the
 * request's `bridge.done`, the trait, or `false` for Refuse.
 */
export function answerTraitRuling(requestId, asker, trait) {
    if (!game.user.isGM || !requestId || !asker) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_DONE, requestId, userId: asker, value: typeof trait === "string" ? trait : false
    }, { recipients: [asker] });
    return true;
}

/**
 * A GM's answer to a Hope Call card, for the player who asked: the request's `bridge.done`,
 * `true` to allow and `false` to refuse. A no is sent from here; a yes goes by the primary
 * (`call.yes`), which keeps it for the arm it allows and sends it on (E29 fix r2-H4). Answers
 * true once sent (40-flow and 33-bridge-paths read it), false when the primary kept no yes -
 * the card stays open. `messageId` is the card pressed: a yes is kept only for the ask held on it
 * (fix early-C2-G2); a GM's call that names no card is judged by the request alone.
 */
export async function answerHopeCall(requestId, asker, verdict, messageId = null) {
    if (!game.user.isGM || !requestId || !asker) return false;
    if (verdict) {
        const res = await ask(ACTION_CALL_YES, { rid: requestId, asker, messageId }, {
            onPrimary: true, local: () => yesOnPrimary(requestId, asker, game.user.id, messageId) });
        return res.ok && res.value === true;
    }
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_DONE, requestId, userId: asker, value: false
    }, { recipients: [asker] });
    return true;
}

/**
 * A GM's Approve or Decline on a reshape card (`verdict` "approve" or "decline"), ruled on the
 * primary GM (E09 C10; `cleanup.ruling`). The notices the ruling raised there are shown here, to
 * the GM who pressed. Answers what the ruling answered - true, false for a card whose attempt is
 * no longer the GMs', null for nothing ruled - or null when the primary could not be asked.
 */
export async function askReshapeRuling(verdict, { by, trace, attempt } = {}) {
    const asked = { actorId: by, tokenId: trace, attempt, verdict };
    const res = await ask(ACTION_RESHAPE_RULING, asked, {
        onPrimary: true,
        local: () => import("./cleanup.mjs").then(m => m.ruleReshape(asked, game.user.id))
    });
    if (!res.ok) return null;
    for (const [level, key, data] of res.value?.told ?? []) {
        if (!["info", "warn"].includes(level)) continue;
        ui.notifications[level](data ? game.i18n.format(key, data) : game.i18n.localize(key));
    }
    return res.value?.value ?? null;
}

/**
 * A GM's answer to a Dynamic action card: `{ tier, trait }`, or `false` to refuse. Sent on by the primary
 * (`dynamic.answer`, E18 C1), which keeps the difficulty on the card as it sends it on and writes the card's line
 * once the player has it (`keepRuling`). True once sent; false when the primary holds no such ask - one its player
 * stopped waiting for - and the card is left as it is. `messageId` is the card pressed, as `answerHopeCall` takes it.
 */
export async function answerDynamic(requestId, asker, ruling, messageId = null) {
    if (!game.user.isGM || !requestId || !asker) return false;
    const refuse = !ruling;
    const res = await ask(ACTION_DYNAMIC_ANSWER, {
        rid: requestId, asker, tier: refuse ? 0 : Number(ruling.tier), trait: refuse ? null : ruling.trait ?? null, refuse, messageId
    }, { onPrimary: true, local: () => dynamicOnPrimary(requestId, asker, refuse ? false : ruling, game.user.id, messageId) });
    return res.ok && res.value === true;
}

/**
 * "May I spend this, and here is what for." Waits for a human (Dawid, 29.08).
 *
 * The same shape as `requestDynamicDifficulty` below, and for the same reason:
 * a question only a person can answer, so the clock is generous, the "got it"
 * comes as the card goes up (not `patient`, E18 C2), and the question is asked
 * again when a GM's world has loaded or the primary has left. Nothing is charged on this side - see `spendHopeCall`,
 * which pays only against a yes - so a failure says "Nothing was spent." `nonce`
 * names the purchase: the primary keeps a GM's yes for it, and the arm that follows
 * names it again (E29 fix r2-H4; bridge-guards.mjs `guardArmGmYes`).
 *
 * @returns {Promise<object>} the bridge's result; `value` true to allow, false to refuse.
 */
export function requestHopeCallApproval(
    { actorId, actorName, key, callLabel, effect, cost, note, nonce }, timeoutMs = TIMING.hopeCallRulingMs) {
    return ask(ACTION_HOPE_CALL, { actorId, actorName, key, callLabel, effect, cost, note, nonce }, { timeoutMs, nothingSpent: true,
        expired: ACTION_RULING_EXPIRED, received: ACTION_RULING_RECEIVED });
}

/**
 * Ask a GM how hard a described action is.
 *
 * The guide gives the threshold to the GM: "the player describes something, the
 * GM picks a threshold". The picker used to render on the player's own client,
 * so the person being tested chose their own difficulty - and would always
 * choose the easiest band. The card now goes to the GMs and the answer comes
 * back over the socket.
 *
 * Generous clock on purpose: a GM reading a description and making a ruling is
 * a human taking their time, not a machine failing to answer.
 *
 * @returns {Promise<object>} the bridge's result; `value` `{tier, trait}`, or false when the GM refused.
 */
export function requestDynamicDifficulty({ description, actorName, room, actorId = null, proposed = null }, timeoutMs = TIMING.rulingMs) {
    // `proposed` (E68 C4): the statistic the player proposes; the card says it, the GM's editor checks it first.
    return ask(ACTION_DIFFICULTY, { description, actorName, room, actorId, proposed }, { timeoutMs, nothingSpent: true,
        expired: ACTION_RULING_EXPIRED, received: ACTION_RULING_RECEIVED });
}

/**
 * Ask the GMs which of a roll's listed statistics the character rolls
 * (trait-ruling.mjs `traitFor`). A human reading a thread, so the clock is the
 * ruling's, there is none for the "got it", and it is asked again when a GM's
 * world has loaded; nothing has been paid on this side, so a failure says
 * "Nothing was spent." Since E68 C1 (DA18) with the player's proposal and their words of how
 * (`proposed`, `note`; trait-ruling.mjs `proposalOf` has dropped what the GM would refuse).
 *
 * @returns {Promise<object>} the bridge's result; `value` the trait, or false when the GM refused.
 */
export function requestTraitRuling({ actorId, kind, key, variant = null, proposed = null, note = "" }) {
    return ask(ACTION_TRAIT_RULING, { actorId, kind, key, variant, proposed, note }, { nothingSpent: true,
        expired: ACTION_RULING_EXPIRED, received: ACTION_RULING_RECEIVED });
}

/**
 * Ask a GM which Remnant this Observe is aimed at, before the dice are thrown.
 *
 * A GM runs this locally instead of talking to themselves. Everyone else waits
 * on the socket, as patiently as for the Dynamic ruling, since a "specific"
 * declaration opens a picker a human has to read.
 *
 * The answer says only whether there is something to look at. The Remnant, its
 * kind and its difficulty stay on the GM's client: the observer is told what
 * they found, never what they were up against.
 *
 * ONE OF THE TWO REQUESTS THAT ANSWER THEIR VALUE, NOT THE BRIDGE'S RESULT
 * (E31), with `requestCleanableTraces`: the GM's `{ ok, key?, reason? }`, or
 * null when the request was not carried out, which has been said once already
 * with "Nothing was spent.". Its callers and 30-security read `.ok` and `.key`
 * off it, and the GM's own `ok: false` (an empty room, a declaration it does not
 * know) is a ruling, told apart from null.
 *
 * @returns {Promise<{ok: boolean, key?: string, reason?: string}|null>}
 */
export async function requestObserveTarget({ actorId, declaration, request = "" }, timeoutMs = TIMING.rulingMs) {
    // Only a focused gaze is put on a card (`askObserveByCard`), so only its wait reports how it ended (E18 fix e1-G4).
    const { DECLARATIONS } = await import("./observe.mjs");
    const onCard = declaration === DECLARATIONS.specific ? { expired: ACTION_RULING_EXPIRED, received: ACTION_RULING_RECEIVED } : {};
    const res = await ask(ACTION_OBSERVE_TARGET, { actorId, declaration, request }, {
        timeoutMs, nothingSpent: true, ...onCard,
        local: () => import("./observe.mjs").then(m => m.chooseObserveTarget({ actorId, declaration, request }))
    });
    return res.ok ? res.value ?? null : null;
}

/**
 * Ask a GM which of a killer's traces they may act on, before Stage 6's picker
 * opens.
 *
 * A GM runs this locally instead of talking to themselves - the same shape as
 * `requestObserveTarget`. Everyone else waits on the socket.
 *
 * THE ONE REQUEST THAT ANSWERS A LIST, NOT THE BRIDGE'S RESULT (E31). It writes
 * nothing, and an empty list - nothing to act on - is the safe answer to every
 * failure, which has been told once already; its three callers and
 * 30-security read an array, and a null on a refusal used to crash one of them.
 * `quiet` for a sheet that asks in the background.
 *
 * @returns {Promise<Array<{id: string, label: string, reinforced: boolean, dc: number|null}>>}
 *   `dc` for the roll window alone (E16 part 2 C0, the owner's Q7), never `tiedToCrime` - see
 *   `cleanableTracesForPlayer` in cleanup.mjs, which is the only thing that ever builds this array.
 */
export async function requestCleanableTraces(actorId, { mine = false, quiet = false } = {}, timeoutMs = TIMING.rulingMs) {
    const res = await ask(ACTION_CLEANUP_TRACES, {
        // `mine` narrows the answer to what this character knows is there.
        // `false` asks for the whole room, which is Stage 6's - and the GM's
        // side decides whether this character is in Stage 6, not this
        // flag (E03; audit S05-04). See `cleanableTracesForPlayer`.
        actorId, mine
    }, {
        timeoutMs, quiet,
        local: () => import("./cleanup.mjs").then(m => m.cleanableTracesForPlayer(actorId, { mine }))
    });
    return res.ok && Array.isArray(res.value) ? res.value : [];
}

/**
 * Hand a thrown Observe to the GM to be scored.
 *
 * The answer is the whisper the player gets when the GM's client has finished -
 * a Truth Bullet on their sheet or 2 Sanity - which can wait on the GM
 * describing what was found, so the request waits only for the "got it", and a
 * refusal after it is still told.
 */
export function requestObserveResolve({ actorId, key, total, isCritical, undo = false, rollId = null }) {
    return ask(ACTION_OBSERVE_RESOLVE, { actorId, key, total, isCritical, undo, rollId }, {
        local: () => import("./observe.mjs").then(m => m.resolveObserve({ key, total, isCritical, undo, actorId, rollId }))
    });
}

/**
 * Hand a thrown Analyze to the GM to be scored.
 *
 * The verdict is the whisper the player gets once the GM's client has
 * converted the bullet or locked it; unlike Observe, nothing in that waits on a
 * person, so the request waits for it (E31 review) and a Reroll says the bullet
 * was analysed again only when it was.
 */
export function requestAnalyzeResolve({ actorId, itemId, total, isCritical, undo = false, rollId = null }) {
    return ask(ACTION_ANALYZE_RESOLVE, { actorId, itemId, total, isCritical, undo, rollId }, {
        local: () => import("./analyze.mjs").then(m => m.resolveAnalyze({ actorId, itemId, total, isCritical, undo, rollId }))
    });
}

/**
 * A player's Level Up picks, sent to the GM who offered it (N-2, Dawid 20.09).
 *
 * `applyAdvancement` writes through `trustedWrite`, which bypasses the resource
 * guard on purpose - so it is GM-only, and it has to stay that way. The player
 * picks; the GM's client checks the offer again and writes. `offerId` names the
 * offer the picks spend (E10 C6); a caller that names none spends the oldest this
 * browser holds on that character (level-up.mjs `pendingAdvance`).
 */
export async function requestAdvancement({ actorId, picks, kind, offerId = null }) {
    const L = await import("./level-up.mjs");
    const spent = offerId ?? L.pendingAdvance(game.actors.get(actorId))?.id ?? null;
    return ask(ACTION_ADVANCEMENT, { actorId, picks, kind, offerId: spent }, {
        local: () => {
            const actor = game.actors.get(actorId);
            return actor ? L.applyAdvancement(actor, picks, kind, { offerId: spent }) : null;
        }
    });
}

/**
 * Copy one of my Truth Bullets onto somebody else's sheet.
 *
 * Writing to another player's actor is GM-only, and the answer key entry that
 * travels with the copy can only be written on a GM's client anyway.
 */
export function requestShareBullet({ fromId, toId, itemId }) {
    return ask(ACTION_SHARE_BULLET, { fromId, toId, itemId }, {
        local: () => import("./handover.mjs").then(m => m.shareBullet({ fromId, toId, itemId })).then(out => {
            // A GM's own copy refused is said as the bridge would say it to a player (E14 part 1 C1).
            if (out?.refused) sayNotDone(ACTION_SHARE_BULLET, reasonOf(out.refused));
            return out?.refused ? null : out;
        })
    });
}

/** Move one of my items onto somebody else's sheet, and off mine. */
export function requestGiveItem({ fromId, toId, itemId }) {
    return ask(ACTION_GIVE_ITEM, { fromId, toId, itemId }, {
        local: () => import("./handover.mjs").then(m => m.giveItem({ fromId, toId, itemId })).then(out => {
            if (out?.refused) sayNotDone(ACTION_GIVE_ITEM, reasonOf(out.refused));
            return out?.refused ? null : out;
        })
    });
}

/** Hand a thrown crisis action to the GM to be scored and applied. */
export function requestCrisisResult({
    actorId, key, total, isCritical, withHope, undo = false,
    // G-18: this one was taken rather than rolled - a critical Self-defence's
    // free resolution action. Re-checked GM-side against the incident state,
    // like everything else that arrives over this socket.
    free = false,
    // What the player's own client used up, if the action was "use an item".
    // Carried rather than decided here: the GM records it so a Reroll can put
    // it back, but the spending happened where the dialogs belong.
    usedItemId = null,
    // Which resource a critical Strike takes. Decided by the killer on their own
    // client while the dice are still up, and carried here rather than asked
    // again on the GM's - see `askCriticalTarget`.
    choice = null,
    // The weapon the roll was thrown with. Remembered GM-side for Stage 6.
    swungId = null,
    // The character's Health, Stress and the item's quantity before the item was used
    // (E08+E28 C2; audit S04-18), for the GMs' bookmark: what a Reroll puts back.
    before = null,
    // The roll it was thrown with (fix r1-G2): the GMs' fact of it goes on that roll's row. None
    // for an action taken without dice.
    rollId = null
}) {
    return ask(ACTION_CRISIS, { actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free, swungId, before, rollId }, {
        local: () => import("./murder.mjs").then(m => m.resolveCrisisAction({
            actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free, swungId, before, rollId
        }))
    });
}

/**
 * Tell the GMs what was just rolled for the Reroll's bookmark (E08+E28 C2); a GM keeps
 * it here. See action-pipeline.mjs `tellGmsOfRoll`.
 */
export function requestRollBookmark(payload) {
    return ask(ACTION_ROLL_BOOKMARK, payload, {
        local: () => import("./action-rolls.mjs").then(m => m.keepGmBookmark(payload, game.user))
    });
}

/**
 * Ask the GM to make this character's Reroll (E08+E28 C4a): it pays, throws, replays and
 * settles, and answers `{ lines }` - or, on a GM's own client, `{ refused, say }` where a
 * player's request is refused by the bridge.
 *
 * AN ANSWER PAST THE CLOCK STILL COUNTS (E08+E28 fix r1-G5, 04.10.2026; the round-1 review's
 * m1). The run can wait on the GM as long as the GM takes - an Observe's replay that opens
 * `describeFind`, a critical crisis replay with no first pick opening the pick window - and the
 * answer's clock is `TIMING.rulingMs`. Past it the asker read "not carried out" while the Reroll
 * was being made and paid, and its card was never posted. So the ask is quiet and the caller
 * says each outcome (calls.mjs `askReroll`): an answer after the clock goes to `late`, a refusal
 * after it to `lateRefused`, for as long as a Reroll's roll can be reached at all
 * (`TIMING.rerollWindowMinutes`, an outer bound chosen, not a time measured).
 *
 * MADE ON THE PRIMARY GM, WHOEVER ASKS (E08+E28 fix r2-H7, 05.10.2026; the round-2 review's
 * S2-7). An assistant GM's own Reroll ran on its own client (`local`) and a player's on the
 * primary, so two Rerolls of one character could each read the GMs' journal before the
 * other's row reached it, and both pay, throw and replay. `onPrimary`: another GM asks the
 * primary as a player does, so `making` (reroll.mjs) holds every Reroll of a character on one
 * client. The harness has one GM, so the race itself is not measured; R219 reads the waiter.
 */
export function requestReroll(actorId, { late = null, lateRefused = null } = {}) {
    return ask(ACTION_REROLL, { actorId }, {
        quiet: true, late, lateRefused, lateMs: TIMING.rerollWindowMinutes * 60_000, onPrimary: true,
        local: () => import("./reroll.mjs").then(m => m.rerollOnGm(game.actors.get(actorId ?? ""), game.user))
    });
}

/** Hand a thrown Stage 6 clean-up to the GM to be scored against the trace. */
export function requestCleanup({
    actorId, tokenId, total, isCritical, withHope, undo = false,
    // G-20: what a critical chose to turn the trace into, if anything. Shaped
    // and bounded on the far side - see `resolveCleanup`.
    transform = null,
    // Z5: what the transform action was declared as, before the dice. Same
    // treatment - sent as given, bounded on arrival.
    change = null,
    // Stage 6 has four actions now. `key` names which; absent means the
    // original one, so every existing caller keeps working unchanged.
    key = "eraseTrace", targetId = null,
    // Which door this came through: the Tamper tile, or Stage 6's own panel.
    // It decides which guard runs - see cleanup.mjs.
    viaAction = false,
    // T-1: which step of Tamper's price chain the client already paid, and
    // whether a Burst paid it. Absent means "nothing was paid on the client",
    // and the resolver charges the Sanity itself.
    price = null, grant = false,
    // The roll it was thrown with (fix r1-G2): the GMs' fact of the attempt goes on that roll's row.
    rollId = null
}) {
    // The two that aim at a TRACE go to `resolveCleanup`; the two that roll
    // against a flat threshold go to `resolveStageSix`. Naming the first pair
    // rather than excluding the second means a fifth action added later lands
    // in the branch that reads its own threshold, which is the safe default.
    const aimed = key === "eraseTrace" || key === "transformTrace";
    const mode = key === "transformTrace" ? "transform" : "erase";
    return ask(ACTION_CLEANUP, {
        actorId, tokenId, total, isCritical, withHope, undo, key, targetId, transform,
        change, viaAction, price, grant, rollId
    }, {
        local: () => import("./cleanup.mjs").then(m => aimed
            ? m.resolveCleanup({
                actorId, tokenId, total, isCritical, withHope, undo, transform,
                mode, change, viaAction, price, grant, rollId
            })
            : m.resolveStageSix({
                actorId, key, targetId, total, isCritical, withHope, viaAction,
                price, grant, rollId
            }))
    });
}

/** Record a direct murder declared during an Eclipse. See eclipse.mjs. */
export function requestParkMurder({ killerId, room = null, note = "", proposed = null }) {
    // `proposed` (E68 C9): the opening's statistic the killer proposes, read against their list on the GM.
    return ask(ACTION_PARK_MURDER, { killerId, room, note, proposed }, {
        local: () => import("./eclipse.mjs").then(m => m.writeParkedMurder({ killerId, room, note, proposed }))
    });
}

/**
 * Ask a GM to open the betrayal: the newcomer kills the killer they helped - or, in an
 * Eclipse, to park it with `note` until the lights (E32 C5b).
 *
 * No dice and no numbers travel - this is a declaration, and whether it opens is
 * re-derived from the incident on the GM's side (`betrayAsPlayer`).
 */
export function requestBetrayal({ actorId, note = "", proposed = null }) {
    // `proposed` (E68 C9): the opening's statistic the betrayer proposes, for the GM's opening window.
    return ask(ACTION_BETRAYAL, { actorId, note, proposed }, {
        local: () => import("./murder.mjs").then(m => m.betrayAsPlayer(actorId, { note, proposed }))
    });
}

/** Answer the GMs' invitation to become a Monocub (E72 C6): `accept` true takes the Monocub Rule. */
export function requestCubAnswer({ actorId, accept }) {
    return ask(ACTION_CUB_ANSWER, { actorId, accept: Boolean(accept) }, {
        local: () => import("./monocub.mjs").then(m => m.answerMonocubOffer({ actorId, accept: Boolean(accept) }, game.user))
    });
}

/** Ask the GM to throw a paid ability of a Monocub's and apply it to the target; answers the roll it threw (E08+E28 C17; E33 C10). */
export function requestCubAbility({ actorId, key, targetId, choice }) {
    return ask(ACTION_CUB_ABILITY, { actorId, key, targetId, choice }, {
        local: () => import("./monocub.mjs").then(m => m.cubAbilityOnGm({ actorId, key, targetId, choice }))
    });
}

/**
 * Pull one item out of somebody else's stash. GM-only on both ends.
 *
 * `viaSearch` marks the route that has already paid for a concealed stash with
 * an action, a search token and a penalised roll - see `stealFromVault`. A
 * player's names that Search's roll (`rollId`), which the GM reads `viaSearch`
 * and `clumsy` off (`searchTheftOf`, E08+E28 C15).
 */
export function requestVaultSteal({ thiefId, ownerId, itemId, viaSearch = false, clumsy = false, rollId = null }) {
    return ask(ACTION_VAULT_STEAL, { thiefId, ownerId, itemId, viaSearch, clumsy, rollId }, {
        local: () => import("./vault.mjs").then(m => m.stealFromVault({ thiefId, ownerId, itemId, viaSearch, clumsy }))
    });
}

/**
 * Go through somebody's pockets. GM-only on both ends, like its sibling above.
 *
 * The two rolls are named and the verdicts are made on the other side - see
 * `stealFromPerson` - on the GMs' record of each (`palmRolls`, E08+E28 C15);
 * the two totals travel for the GM's log. `itemId` is a request rather than an
 * instruction: it is honoured only on a critical, and only if it is really in
 * the victim's pockets.
 */
export function requestSteal({
    thiefId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false, rollId = null, unseenRollId = null
}) {
    return ask(ACTION_STEAL, { thiefId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical, rollId, unseenRollId }, {
        // A GM's own Palm refused is said as the bridge would say it, and its answer keeps the refusal, which the Palm
        // reads to give its action back (palm.mjs `performPalm`; E14 part 1 C1, Q3).
        local: () => import("./vault.mjs").then(m => m.stealFromPerson({
            thiefId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
        })).then(out => {
            if (out?.refused) sayNotDone(ACTION_STEAL, reasonOf(out.refused));
            return out;
        })
    });
}

/**
 * An unseen Frisk (E80 part 2 C2; frisk.mjs `performFrisk`): the two rolls named, judged on the primary GM against the
 * GMs' records of them, which posts the cards (frisk.mjs `friskPerson`); the totals travel for the GM's log and for a
 * GM's own Frisk. A GM's own browser does it here when it is the primary, and says a refusal as the bridge would.
 * Its value is the primary's outcome, "settled".
 */
export function requestFriskUnseen({
    searcherId, targetId, total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false, rollId = null, unseenRollId = null
}) {
    return ask(ACTION_FRISK_UNSEEN, { searcherId, targetId, total, isCritical, unseenTotal, unseenCritical, rollId, unseenRollId }, {
        onPrimary: true,
        local: () => import("./frisk.mjs").then(m => m.friskPerson({ searcherId, targetId, total, isCritical, unseenTotal, unseenCritical, rollId },
            { asker: game.user })).then(out => {
            if (out?.refused) sayNotDone(ACTION_FRISK_UNSEEN, reasonOf(out.refused));
            return out?.refused ? null : out?.outcome ?? null;
        })
    });
}

/**
 * An open Frisk's ask (E80 part 2 C3; frisk.mjs `performFriskOpenly`), judged and held on the primary GM (frisk.mjs
 * `askToFrisk`). Its value is `{ askId, outcome, forceMs }` once the target has answered or the clock has run, or at once
 * for an ask that ends before it is made. A GM's own browser asks here when it is the primary, and says a refusal as the
 * bridge would; an answer that comes after this wait has ended changes nothing here (`late`).
 */
export function requestFriskAsk({ searcherId, targetId }) {
    return ask(ACTION_FRISK_ASK, { searcherId, targetId }, {
        onPrimary: true,
        /* E18'S ONE ROAD (E18 C7, 26.10.2026; amend 5): the ask lives in the primary's memory (frisk.mjs `friskAsks`), so
           it ends with that primary. The wait ends with it at once only when another connected GM takes over the primary
           (bridge-guards.mjs `primaryGone`, run by registerBridgeReplies when `primaryLeft`, which needs a successor);
           when the only GM leaves or reloads, the wait runs its clock, friskAnswerMs + friskMarginMs (75 s), and the
           clock hands the action back (E18 fix c7-G1, the review's C7-R1; R1006 drives both). A wait that runs out tells
           the primary, which ends the ask so a yes after it is not kept (`expired`, frisk.mjs `expireFriskAsk`, which
           judges that claim). The answer's receipt (E68 C11; D084): an answer that leaves a force open waits `TIMING.ackMs`
           on the primary for it, and with none ends as 'Leave it' (frisk.mjs `answerSearcher`); any other answer ended
           the ask with its cards, posted before it went, and its receipt finds nothing. */
        untilPrimaryLeaves: true,
        expired: ACTION_RULING_EXPIRED,
        received: ACTION_RULING_RECEIVED,
        lateMs: TIMING.friskMarginMs,
        late: value => debug("A Frisk's ask was answered after this browser stopped waiting", value),
        local: () => import("./frisk.mjs").then(m => m.askToFriskHere({ searcherId, targetId }, game.user)).then(out => {
            if (out?.refused) sayNotDone(ACTION_FRISK_ASK, reasonOf(out.refused));
            return out?.refused ? null : out?.value ?? null;
        })
    });
}

/** The answer to a Frisk's ask from the window it opened (frisk.mjs `openAskWindow`), judged on the primary (`answerFrisk`). */
export function requestFriskAnswer({ askId, allow = false }) {
    return ask(ACTION_FRISK_ANSWER, { askId, allow: Boolean(allow) }, {
        onPrimary: true,
        local: () => import("./frisk.mjs").then(m => m.answerFrisk({ askId, allow: Boolean(allow) }, game.user)).then(out => {
            if (out?.refused) sayNotDone(ACTION_FRISK_ANSWER, reasonOf(out.refused));
            return out?.refused ? null : out?.outcome ?? null;
        })
    });
}

/** After a refusal or no answer: the force's roll named, or none for 'Leave it' (frisk.mjs `followFrisk`). */
export function requestFriskFollow({ searcherId, askId, rollId = null, total = 0, isCritical = false }) {
    return ask(ACTION_FRISK_FOLLOW, { searcherId, askId, rollId, total, isCritical }, {
        onPrimary: true,
        local: () => import("./frisk.mjs").then(m => m.followFrisk({ searcherId, askId, rollId, total, isCritical }, game.user)).then(out => {
            if (out?.refused) sayNotDone(ACTION_FRISK_FOLLOW, reasonOf(out.refused));
            return out?.refused ? null : out?.outcome ?? null;
        })
    });
}

/**
 * Leave something in somebody's pocket. The mirror of `requestSteal`, and the
 * same division of labour: the two rolls are named, both verdicts are made on
 * the other side against `ACTIONS.palm`.
 *
 * `itemId` is not a request here but a statement - it came out of the planter's
 * own pockets and there is nothing secret about it. The GM side still checks it
 * is really there, for the same reason it checks everything else.
 */
export function requestPlant({
    plannerId, victimId, itemId,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false, rollId = null, unseenRollId = null
}) {
    return ask(ACTION_PLANT, { plannerId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical, rollId, unseenRollId }, {
        local: () => import("./vault.mjs").then(m => m.plantOnPerson({
            plannerId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
        })).then(out => {
            if (out?.refused) sayNotDone(ACTION_PLANT, reasonOf(out.refused));
            return out;
        })
    });
}

/**
 * Hand a Locate-a-hidden-stash roll to the GM to be scored.
 *
 * Like Observe: the answer is the whisper the finder gets, and the write it may
 * cause is a flag on their own sheet. The number travels for the GM's log
 * only: the GM scores the roll `rollId` names, as its record of it says (E08+E28
 * C14), and the threshold, the room and which stash it opens are all decided on
 * the far side - see `resolveStashSearch`.
 */
export function requestStashSearch({ actorId, total = 0, isCritical = false, rollId = null }) {
    return ask(ACTION_FIND_STASH, { actorId, total, isCritical, rollId }, {
        // A GM's own search refused (in a Class Trial, E16 part 2 C3) is said as the bridge would say it to a player, and its
        // answer keeps the refusal, which action-analyze.mjs `locateStash` reads to give the price back.
        local: () => import("./vault.mjs").then(m => m.resolveStashSearch({ actorId, total, isCritical })).then(out => {
            if (out?.refused) sayNotDone(ACTION_FIND_STASH, reasonOf(out.refused));
            return out;
        })
    });
}

/**
 * Ask the GM to add project progress on our behalf. What actually changed is
 * whispered back by the GM's client; the request knows that it was carried out
 * (E31 review), not what it changed.
 */
export function requestProjectProgress(countdownId, amount, { actorId = null, rollId = null, relief = 0, bonus = 0, call = null } = {}) {
    return ask(ACTION_PROGRESS, { countdownId, amount, actorId, rollId, relief, bonus, call });
}

/**
 * Ask the GM to let another player in on a secret project. Players are allowed
 * to bring someone in on their own plan - the guide's whole social engine runs
 * on conspiracies - but the write itself has to happen GM-side.
 */
export function requestProjectShare(countdownId, userId) {
    return ask(ACTION_SHARE, { countdownId, targetUserId: userId });
}

/** One step of a claim, asked of the primary - or run here when this GM is the primary. The answer of `claimOnPrimary`, or null. */
async function askCardClaim(messageId, step) {
    const res = await ask(ACTION_CARD_CLAIM, { messageId, step }, {
        onPrimary: true,
        local: () => claimOnPrimary(messageId, step, game.user.id)
    });
    return res.ok ? res.value ?? null : null;
}

/**
 * A GM's ruling on a card sent to the GMs, made once (E18 C3). The card is claimed on the primary
 * GM (`card.claim`), `work` runs while it is held, and the primary is told how it ended: a work
 * that answers `{ settled }` or `{ held }` made a ruling, and the card's row is written before this
 * answers; anything else, or a throw, lets the card go for the next click. A card another GM has,
 * or had, is not ruled: this GM is told who, and null is answered without `work` running.
 *
 * The one road for every ruling on a card: the card's buttons (messenger-app.mjs `wireCallActions`)
 * today, and the cards E72 (part A, formerly E67: the gmAsk card's 'Give 1/2'), E68 (the trait card)
 * and E72 (Accept and Refuse) put on it. Overrule and the Closing's approve are not claimed (E18 amend 3).
 *
 * @param {ChatMessage} message  The card.
 * @param {() => Promise<object|null>} work  The ruling, run on this GM's browser.
 * @returns {Promise<object|null>} What `work` answered, or null when the card was not this GM's to rule.
 */
export async function claimCard(message, work) {
    if (!message?.id || !game.user?.isGM) return null;
    const taken = await askCardClaim(message.id, "take");
    if (!taken?.taken) {
        const gm = game.users.get(taken?.by ?? "")?.name ?? String(taken?.by ?? "");
        if (taken?.why === "ruled") sayRefusedHere(game.i18n.format("DRPG.Bridge.alreadyRuled", { gm }));
        else if (taken?.why === "busy") sayRefusedHere(game.i18n.format("DRPG.Bridge.claimBusy", { gm }));
        else if (taken?.why === "settled") sayRefusedHere(game.i18n.localize("DRPG.Bridge.alreadySettled"));
        return null;
    }
    let outcome = null;
    try {
        outcome = await work();
    } finally {
        await askCardClaim(message.id, outcome?.settled || outcome?.held ? "done" : "drop");
    }
    return outcome;
}
