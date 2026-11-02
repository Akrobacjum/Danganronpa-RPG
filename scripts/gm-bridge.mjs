/**
 * Danganronpa RPG - calling the GM, and asking them to write.
 * ---------------------------------------------------------------------------
 * Two jobs:
 *
 *   callGm()  - the guide's actions that need a human ruling (Think, Listen,
 *               Analyze, Direct Murder, starting a project). The player's roll
 *               and request are whispered to the GMs with the context they need
 *               to answer, so nobody has to shout across the table.
 *
 *   request*() - world settings can only be written by a GM client, so a
 *               player's project progress is forwarded over the socket.
 *
 * THE FACADE (E41 C5 and C5a, 1.2.97). Two pure moves that
 * `node tools/moved-only.mjs` proves. C5 moved the GM's cards - `callGm` with
 * its card, its claims and its settle, the request window, and the
 * ask-by-card machinery that asks nothing of the table - to call-gm.mjs. C5a
 * moved the module's socket name and every `ACTION_` wire name to
 * bridge-wire.mjs, the runs of BRIDGE_ACTIONS with their derives to
 * bridge-runs-acts.mjs (what a student does) and bridge-runs-records.mjs (the
 * records the GMs keep), and the ask cards' four primary-side senders to
 * call-gm.mjs. This file keeps its name and every name it exported (the
 * twelve that moved are re-exported under the imports), so every importer
 * still imports gm-bridge.mjs, and none of the files it moved code to imports
 * it. The table, with `handover`, `hardestRepair`, `onSocket` and `ask`,
 * stands above the first function, so that no function's cut runs on into
 * it; the table, every request, the GM -> player wire and the registration
 * stay here until E41 C5b.
 */

import { STARTING, PROJECT_SCALE, TIMING, TIMES_OF_DAY } from "./config.mjs";
import { isPrimaryGm, primaryGmId, debug, error } from "./utils.mjs";
import {
    guardUndoIsTheGms, guardCrisisAction, guardCrisisRoll, guardShareSecret, guardShareGuest, guardTieTraceHolder,
    guardSendbackPlace, armBuyerId, guardArmCharacter, guardArmPlayerCall, guardCubAbility, guardArmCallGrants,
    guardArmLiving, guardArmNotHeld, guardArmBuyer, guardArmOtherCharacter, guardArmHopeCallAllowed, guardArmBuyerHope,
    guardArmGmYes, guardDespairDelta, guardDespairPool, guardTraitRuling, guardRollAuthor, guardCallProgress,
    guardProjectFrozen, guardProjectRoom, guardSabotageRoom, guardCardSpeaker, guardCardReaders, table, tokenActorOf,
    remnantSourceOf, knownSender, owns, ownsActorAt, gmOnly, playersOnly, canSeeProject, inRange, as, pick, judge,
    replyForMe, bridgeRequest, resendOnGmReady, sayNotDone, reasonOf
} from "./bridge-guards.mjs";

import { cardFlag } from "./secret.mjs";
import {
    sweepAskCards, claimsInProgress, releaseClaimsOf, claimOnPrimary, sayRefusedHere, observePickOnPrimary,
    yesOnPrimary, dynamicOnPrimary
} from "./call-gm.mjs";
import {
    SOCKET_EVENT, ACTION_PROGRESS, ACTION_SHARE, ACTION_REMNANT, ACTION_TIE_TRACE, ACTION_REMNANT_EDIT, ACTION_SABOTAGE,
    ACTION_UNSABOTAGE, ACTION_PROJECT_CHANGE, ACTION_SENDBACK, ACTION_ECLIPSE_MOVE, ACTION_ARM, ACTION_DESPAIR,
    ACTION_OVERFLOW_ADD, ACTION_OVERFLOW_CLEAR, ACTION_DESPAIR_SET, ACTION_DESPAIR_ALL, ACTION_DESPAIR_ROSTER,
    ACTION_OVERFLOW_TAKE, ACTION_OVERFLOW_CHECK, ACTION_DIFFICULTY, ACTION_AUDIT_DECIDE, ACTION_KEYS_CHARGE,
    ACTION_VOTE_RUN, ACTION_VOTE_CAST, ACTION_VOTE_ASK, ACTION_FLOOR_NOW, ACTION_TRIAL_OBJECT, ACTION_TRIAL_EVIDENCE,
    ACTION_TRIAL_WITHDRAW, ACTION_FLOOR_REPOINT, ACTION_TRIAL_GM, ACTION_TRIAL_TURN, ACTION_TRIAL_CLAIM,
    ACTION_TRIAL_PRESENT, ACTION_READY_OPEN, ACTION_READY_ANSWER, ACTION_READY_END, ACTION_TRIAL_ENTER,
    ACTION_TRIAL_RECORD, ACTION_RESHAPE_RULING, ACTION_TRAIT_RULING, ACTION_HOPE_CALL, ACTION_CALL_YES,
    ACTION_RULING_EXPIRED, ACTION_RULING_RECEIVED, ACTION_DYNAMIC_ANSWER, ACTION_OBSERVE_TARGET, ACTION_OBSERVE_RESOLVE,
    ACTION_OBSERVE_PICK, ACTION_CLEANUP_TRACES, ACTION_ANALYZE_RESOLVE, ACTION_ADVANCEMENT, ACTION_ADVANCEMENT_OFFER,
    ACTION_ADVANCEMENT_ASK, ACTION_ADVANCEMENT_OFFERS, ACTION_SHARE_BULLET, ACTION_GIVE_ITEM, ACTION_PASSAGE_SHARE,
    ACTION_PASSAGE_CROSS, ACTION_PASSAGE_FIND, ACTION_REFUND_CROSSING, ACTION_VAULT_STEAL, ACTION_STEAL,
    ACTION_FIND_STASH, ACTION_PLANT, ACTION_FRISK_UNSEEN, ACTION_FRISK_ASK, ACTION_FRISK_ANSWER, ACTION_FRISK_FOLLOW,
    ACTION_CRISIS, ACTION_OPENING_ASK, ACTION_OPENING_CANCEL, ACTION_OPENING_RESULT, ACTION_CLEANUP, ACTION_BETRAYAL,
    ACTION_PARK_MURDER, ACTION_CUB_ABILITY, ACTION_DONE, ACTION_GM_READY, ACTION_LOOT, ACTION_NOTE_SAVE,
    ACTION_ROLL_BOOKMARK, ACTION_REROLL, ACTION_CARD, ACTION_CARD_CLAIM
} from "./bridge-wire.mjs";
import {
    handleObserveTarget, handleCleanupTraces, handleObserveResolve, handleAnalyzeResolve, handleAdvancement,
    handleAdvancementOffer, handleAdvancementAsk, handleShareBulletOrGiveItem, handlePassageShare, handlePassageCross,
    handleRefundCrossing, handlePassageFind, friskRolls, findPassageRoll, notFindPassageRoll, palmRolls, handlePlant,
    handleFindStash, handleSteal, handleFriskUnseen, handleFriskAsk, handleFriskAnswer, handleFriskFollow,
    friskForceRoll, handleVaultSteal, searchTheftOf, handleOpeningResult, handleCrisis, handleParkMurder,
    handleBetrayal, handleCleanup, handleCubAbility, handleHopeCall, handleCallYes, handleDynamicAnswer,
    handleRulingExpired, handleRulingReceived, handleDifficulty, handleTraitRuling
} from "./bridge-runs-acts.mjs";
import {
    handleProgress, handleShare, TRACE_OF_ROLL, handleRemnant, traceBandOf, progressOf, repairOf, handleTieTrace,
    handleRemnantEdit, sabotageAgain, handleSabotage, handleProjectChange, handleUnsabotage, handleSendback, handleLoot,
    handleArm, handleOverflowAdd, handleOverflowClear, handleDespairSet, handleDespairAll, handleDespairRoster,
    handleOverflowTake, handleOverflowCheck, handleDespair, handleEclipseMove, handleNoteSave, handleRollBookmark,
    handleReroll, handleAuditDecide, handleKeysCharge, handleTrialRecord, handleTrialEnter, handleVoteRun, handleBallot,
    handleBallotAsk, handleFloorNow, handleTrialObject, handleTrialEvidence, handleTrialWithdraw, handleFloorRepoint,
    handleTrialGm, handleTrialTurn, handleTrialClaim, handleReadyOpen, handleReadyAnswer, handleReadyEnd,
    handleTrialPresent, handleReshapeRuling, handleObservePick, handleCardClaim, handleCardPost
} from "./bridge-runs-records.mjs";

// R148 and anything else that asked gm-bridge.mjs for it keep finding it here (E31).
export { removalRefusal } from "./bridge-guards.mjs";

export {
    sweepAskCards, askObserveByCard, CALL_GM_WHAT, callCardHtml, callGm, claimOnPrimary, settleCall, askForRequest,
    promptForRequest, promptAndCallGm
} from "./call-gm.mjs";
export { sendOffersTo } from "./bridge-runs-acts.mjs";
export { dynamicRulingOf } from "./bridge-runs-records.mjs";

/**
 * WHAT THE PRIMARY GM ANSWERS, ONE DECLARATION PER REQUEST (E31, 25.09.2026;
 * audit S17-08).
 *
 * Each declaration names the guards its request is judged by, in the order
 * they are asked - `knownSender` (or `gmOnly`) first; for every id the run
 * receives, a guard that names it or a `claims` line saying who judges it - the fields the run may read
 * (`sanitize`), the run, and how the asker is answered: `reply` once the run
 * has carried it out, with its answer - every request whose asker says or
 * counts on it that it was done (E31 review), and every queued one; `ack` once
 * the guards have passed, for a request whose asker says only that the GM's
 * client has it, or nothing; `none` for a request nobody waits on (quiet: its
 * refusals are logged, not told). `prepare` holds what a handler did before its
 * guards and must still do before them: an import that must not come between
 * the last check and the write, a reading the write must share. `queue` keeps
 * the project writes in the order they arrived, and is acknowledged as each
 * arrives.
 * `judge` (bridge-guards.mjs) carries every one of them out; R1b reads this
 * table, R163 the fields each run reads, and 33-bridge-paths drives the legal
 * roads through it.
 *
 *
 * `project.create` USED TO BE IN THE TABLE, and it is gone rather than mended.
 * Nothing sent it: a project is created by the GM, from the panel or from an
 * Approve button on a proposal card, and a player's proposal reaches them as a
 * card rather than as a write. So the branch was a GM-side handler with no
 * caller - and it still accepted a `project.create` payload from any connected
 * client, checked only that the sender was somebody, and created the project.
 * Including one flagged `indirectMurder`. A door nobody used and anybody could
 * open.
 */
export const BRIDGE_ACTIONS = table({
    [ACTION_OBSERVE_TARGET]: {
        label: "DRPG.Bridge.what.observe.target",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, declaration: as.raw, request: as.text }),
        run: handleObserveTarget,
        answer: "reply", patient: true, resend: true,
        claims: { declaration: "compared to DECLARATIONS by chooseObserveTarget (observe.mjs); an unknown one is answered with a reason, never used" }
    },
    [ACTION_CLEANUP_TRACES]: {
        label: "DRPG.Bridge.what.cleanup.traces",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, mine: as.bool }),
        run: handleCleanupTraces,
        answer: "reply", resend: true
    },
    [ACTION_OBSERVE_RESOLVE]: {
        label: "DRPG.Bridge.what.observe.resolve",
        guards: [knownSender, guardUndoIsTheGms, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, key: as.text, total: as.num, isCritical: as.bool, undo: as.gmFlag, rollId: as.id }),
        run: handleObserveResolve,
        // The "got it" only: the run can wait on the GM describing what was found
        // (`describeFind`, observe.mjs), and what its asker says on the answer is
        // that the GM has it - "The GM is judging what you found", and a Reroll's
        // "goes back to the GM" (E31 review).
        answer: "ack",
        /* The total and the critical are the GMs' record of the roll `rollId` names, not the
           packet's (E08+E28 C14; bridge-guards.mjs `rollRefusal`): an Observe's roll, of this
           character, the sender's, settling one Observe. */
        rolled: { field: "rollId", actor: "actorId", kind: "observe" },
        claims: { rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-rolls.mjs): the sender's own row of that message, its character and an Observe" }
    },
    [ACTION_ANALYZE_RESOLVE]: {
        label: "DRPG.Bridge.what.analyze.resolve",
        guards: [knownSender, guardUndoIsTheGms, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, itemId: as.id, total: as.num, isCritical: as.bool, undo: as.gmFlag, rollId: as.id }),
        run: handleAnalyzeResolve,
        answer: "reply",
        // An Analyze's roll, never one thrown as a Find Passage (`notFindPassageRoll`, E80 fix r1-G7).
        rolled: { field: "rollId", actor: "actorId", kind: "analyze", derive: notFindPassageRoll },
        claims: { itemId: "looked up on that one character by resolveAnalyze (analyze.mjs), never across the world",
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-rolls.mjs): the sender's own row of that message, its character and an Analyze not thrown as a Find Passage (`notFindPassageRoll`)" }
    },
    [ACTION_ADVANCEMENT]: {
        label: "DRPG.Bridge.what.advancement.apply",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, picks: as.raw, offerId: as.id }),
        run: handleAdvancement,
        answer: "ack",
        claims: { picks: "checked in the run against the offer `offerId` names: as many as it buys, each a Level Up option, a new experience named",
            offerId: "must name an offer standing in that character's list as this GM holds it, else refused and told (handleAdvancement)" }
    },
    [ACTION_ADVANCEMENT_OFFER]: {
        label: "DRPG.Bridge.what.advancement.offer",
        // A GM owns every character, so `owns` refuses nothing a real GM sends; it
        // stays because every declaration that acts on `actorId` answers the same
        // two questions, and a rule with an exception is two rules.
        guards: [gmOnly("only a GM hands out a Level Up"), owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, op: as.oneOf("add", "take"), kind: as.maybeText, extra: as.num, deferred: as.num, offerId: as.id }),
        run: handleAdvancementOffer,
        answer: "reply",
        claims: { offerId: "a `take` must name an offer standing on that character as the primary holds it (handleAdvancementOffer), else refused and told" }
    },
    [ACTION_ADVANCEMENT_ASK]: {
        label: "DRPG.Bridge.what.advancement.ask",
        guards: [knownSender, playersOnly("a GM asks for nothing here")],
        sanitize: pick({}),
        run: handleAdvancementAsk,
        answer: "none", quiet: true,
        why: "answers only about the sender's own characters, found from the id Foundry gives, and names none"
    },
    [ACTION_SHARE_BULLET]: handover("DRPG.Bridge.what.handover.bullet"),
    [ACTION_GIVE_ITEM]: handover("DRPG.Bridge.what.handover.item"),
    [ACTION_PASSAGE_SHARE]: {
        label: "DRPG.Bridge.what.passage.share",
        guards: [knownSender, owns("actorId", "sender does not own the character showing it")],
        sanitize: pick({ actorId: as.id, targetId: as.id, passageId: as.id }),
        run: handlePassageShare,
        answer: "ack",
        claims: {
            targetId: "passages-gm.mjs shareRefusal: a student who is not the giver and no Monokuma, in the giver's room on its scene and floor where the GMs read both (movement.mjs `gmPlaceOf`), alive",
            passageId: "passages-gm.mjs shareRefusal: a secret passage the giver knows in the GMs' records (or the sender acts as the Mastermind through the giver, `actsAsMastermind`), else the one notKnown"
        }
    },
    [ACTION_PASSAGE_CROSS]: {
        label: "DRPG.Bridge.what.passage.cross",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, passageId: as.id }),
        run: handlePassageCross,
        answer: "reply",
        claims: {
            passageId: "passages-gm.mjs crossTunnel: a secret tunnel of the GMs' records the character knows (or the sender acts as the Mastermind through it, `actsAsMastermind`), else the one notKnown; the token at an end of it where the GMs read it - of a one-way tunnel the end the GMs' row enters it by (H81-02) -, the doors' rules and the price judged on the primary (movement.mjs `gmSpotOf`, `tunnelVerdict`, `settleCrossingOnGm`)"
        }
    },
    /*
     * REFUND LAST CROSSING, ON THE PRIMARY GM (E17 C3, 26.10.2026; audit S07-16, D18). The GMs' record of a character's
     * newest crossing and its price is the primary's (gm-stores.mjs `crossingStore`), and so is the step of the
     * character's key that gives it back (movement.mjs `refundLastCrossing`): another GM's click in the Students window
     * asks it here. A GM's alone: a player's console that could ask would be handed back what its crossing cost. Tier 2
     * E17-T6 judges it as the player's ask (refused) and as a GM's (given, once).
     */
    [ACTION_REFUND_CROSSING]: {
        label: "DRPG.Bridge.what.token.refundCrossing",
        guards: [gmOnly("only a GM gives a crossing back")],
        sanitize: pick({ actorId: as.id }),
        run: handleRefundCrossing,
        answer: "reply",
        claims: { actorId: "movement.mjs refundLastCrossing gives back only the GMs' own record of that character's newest crossing (gm-stores.mjs `crossingStore`), once, on the primary" }
    },
    [ACTION_PASSAGE_FIND]: {
        label: "DRPG.Bridge.what.passage.find",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, total: as.num, isCritical: as.bool, rollId: as.id }),
        run: handlePassageFind,
        answer: "reply",
        // An Analyze's roll, thrown as a Find Passage (`findPassageRoll`): its total and critical are the GMs' record's.
        rolled: { field: "rollId", actor: "actorId", kind: "analyze", derive: findPassageRoll },
        claims: {
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the sender's character's Analyze, thrown as a Find Passage (`findPassageRoll`)"
        }
    },
    [ACTION_PLANT]: {
        label: "DRPG.Bridge.what.action.plant",
        guards: [knownSender, owns("plannerId", "sender does not own the character planting")],
        sanitize: pick({ plannerId: as.id, victimId: as.id, itemId: as.id, total: as.num, isCritical: as.bool,
            unseenTotal: as.num, unseenCritical: as.bool, rollId: as.id, unseenRollId: as.id }),
        run: handlePlant,
        // "reply" since E14 part 1 C1 (the owner's Q3): the Palm's browser gives back the action it paid when the one
        // gate refused the Palm before its rolls were read, so it waits for the verdict, not for the "got it".
        answer: "reply",
        // Both of the Palm's rolls, each on the GMs' record of it (E08+E28 C15; `palmRolls`).
        rolled: palmRolls("plannerId"),
        claims: {
            victimId: "judged by plantOnPerson (vault.mjs), before the rolls are read, on the one gate (inventory.mjs transferRefusal, frisk.mjs personActionRefusal): a student in the planter's room as the GMs read both, no Monocub, Monokuma or hidden token, outside an Eclipse, a Class Trial and the planter's own incident; a body the GMs keep from the sender is planted on as a living one",
            itemId: "judged by plantOnPerson (vault.mjs): an item in the planter's own hands",
            rollId: "the hand's roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the planter's Palm",
            unseenRollId: "the unseen roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the planter's Palm"
        }
    },
    [ACTION_FRISK_UNSEEN]: {
        label: "DRPG.Bridge.what.action.friskUnseen",
        guards: [knownSender, owns("searcherId", "sender does not own the character searching")],
        sanitize: pick({ searcherId: as.id, targetId: as.id, total: as.num, isCritical: as.bool,
            unseenTotal: as.num, unseenCritical: as.bool, rollId: as.id, unseenRollId: as.id }),
        run: handleFriskUnseen,
        // "reply": the searcher's card says the hand went in only once the primary has judged it, and every refusal,
        // the run's after the guards included, reaches the searcher (S10-27).
        answer: "reply",
        rolled: friskRolls("searcherId"),
        claims: {
            targetId: "judged by friskPerson (frisk.mjs): personActionRefusal on the primary - a student in the searcher's room as the GMs read it, outside an Eclipse, a Class Trial and the searcher's own incident - and a death the sender knows refused",
            rollId: "the hand's roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the searcher's Frisk, thrown as rummage",
            unseenRollId: "the cover's roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the searcher's Frisk, thrown as palm"
        }
    },
    [ACTION_FRISK_ASK]: {
        label: "DRPG.Bridge.what.action.friskAsk",
        guards: [knownSender, owns("searcherId", "sender does not own the character searching")],
        sanitize: pick({ searcherId: as.id, targetId: as.id }),
        run: handleFriskAsk,
        // "reply", answered later (`handleFriskAsk`): a person is deciding, so no clock for the "got it" (`patient`), and the
        // wait runs past the answer's clock by the margin the primary keeps for the packet that ends the ask.
        answer: "reply",
        patient: true,
        timeoutMs: TIMING.friskAnswerMs + TIMING.friskMarginMs,
        claims: {
            targetId: "judged by askToFrisk (frisk.mjs): personActionRefusal on the primary, a death the sender knows refused (isBody), one live ask a searcher, one a target, a pair once a time of day, and the sender's payment's ticket claimed"
        }
    },
    [ACTION_FRISK_ANSWER]: {
        label: "DRPG.Bridge.what.action.friskAnswer",
        guards: [knownSender],
        sanitize: pick({ askId: as.id, allow: as.bool }),
        run: handleFriskAnswer,
        answer: "reply",
        claims: {
            askId: "judged by answerFrisk (frisk.mjs): an ask the primary holds, open, and the sender one of the users it was sent to (answerUserIds; a GM for a character with no player)"
        }
    },
    [ACTION_FRISK_FOLLOW]: {
        label: "DRPG.Bridge.what.action.friskFollow",
        guards: [knownSender, owns("searcherId", "sender does not own the character searching")],
        sanitize: pick({ searcherId: as.id, askId: as.id, rollId: as.id, total: as.num, isCritical: as.bool }),
        run: handleFriskFollow,
        answer: "reply",
        // 'Leave it' names no roll and asks for none (`when`); a force's is the GMs' record, held to the ask (`friskForceRoll`).
        rolled: { field: "rollId", actor: "searcherId", kind: "frisk", when: "rollId", derive: friskForceRoll },
        claims: {
            askId: "judged by followFrisk (frisk.mjs): the searcher's own ask, refused or unanswered, inside its force's window; with no roll named, or a GM's own roll (never drawn, so never a record here), one this primary neither holds nor ended (dropped by a reload or by the primary before it) ends interrupted, and only the searcher's own browser hands its action back",
            rollId: "the force's roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the searcher's frisk, after the ask and before its window closed (friskForceRoll)"
        }
    },
    [ACTION_FIND_STASH]: {
        label: "DRPG.Bridge.what.vault.findStash",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, total: as.num, isCritical: as.bool, rollId: as.id }),
        run: handleFindStash,
        /* "reply" since E16 fix e1-G2 (26.10.2026; the review's E16p2-BEH-1 = E16R-04 = E16P2-R4): a Class Trial opened
           while the packet was in flight is refused here before the throw is read, and the asker gives the price back
           on that refusal (action-rolls.mjs `locateStash`; the owner's Q3 of 18.10 by analogy) - heard after its
           "got it" while the row was "ack", when `locateStash` had returned and the price stayed spent. */
        answer: "reply",
        // An Analyze's roll: a search for a hidden stash is one of the Analyze's roads (E08+E28 C14), and a roll thrown as
        // a Find Passage, another of them, settles none of it (`notFindPassageRoll`, E80 fix r1-G7).
        rolled: { field: "rollId", actor: "actorId", kind: "analyze", derive: notFindPassageRoll },
        claims: { rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the sender's character's Analyze, not thrown as a Find Passage (`notFindPassageRoll`)" }
    },
    [ACTION_STEAL]: {
        label: "DRPG.Bridge.what.action.steal",
        guards: [knownSender, owns("thiefId", "sender does not own the character stealing")],
        sanitize: pick({ thiefId: as.id, victimId: as.id, itemId: as.id, total: as.num, isCritical: as.bool,
            unseenTotal: as.num, unseenCritical: as.bool, rollId: as.id, unseenRollId: as.id }),
        run: handleSteal,
        // "reply" since E14 part 1 C1 (the owner's Q3): the Palm's browser gives back the action it paid when the one
        // gate refused the Palm before its rolls were read, so it waits for the verdict, not for the "got it".
        answer: "reply",
        rolled: palmRolls("thiefId"),
        claims: {
            victimId: "judged by stealFromPerson (vault.mjs), before the rolls are read, on the one gate (inventory.mjs transferRefusal, frisk.mjs personActionRefusal): a student in the thief's room as the GMs read both, no Monocub, Monokuma or hidden token, outside an Eclipse, a Class Trial and the thief's own incident; a body the GMs keep from the sender is robbed as a living one",
            itemId: "honoured by stealFromPerson (vault.mjs) only on a critical, and only if it is in the victim's pockets",
            rollId: "the hand's roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the thief's Palm",
            unseenRollId: "the unseen roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the thief's Palm"
        }
    },
    [ACTION_VAULT_STEAL]: {
        label: "DRPG.Bridge.what.vault.steal",
        guards: [knownSender, owns("thiefId", "sender does not own the character searching")],
        sanitize: pick({ thiefId: as.id, ownerId: as.id, itemId: as.id, viaSearch: as.bool, clumsy: as.bool, rollId: as.id }),
        run: handleVaultSteal,
        /* "reply" since E16 fix e1-G2 (26.10.2026; the review's E16p2-BEH-2 = E16R-03 = E16P2-R2): a Search that takes a
           Murder Weapon out of a stash leaves a Prep Remnant (E16 part 2 C4), and on "ack" it left one as the packet was
           accepted - for a thing a GM then refused (another reach took it first, full hands, an undecided item). The
           asker leaves it only on the answer's `taken` (`handleVaultSteal`, action-rolls.mjs `searchStash`). */
        answer: "reply",
        // A packet that says a Search paid for it names that Search's roll (E08+E28 C15; `searchTheftOf`).
        rolled: { field: "rollId", actor: "thiefId", kind: "search", when: "viaSearch", derive: searchTheftOf },
        claims: {
            ownerId: "judged by stealFromVault (vault.mjs): the owner of a stash the thief can reach",
            itemId: "judged by stealFromVault (vault.mjs): an item that owner has stashed",
            rollId: "the Search's roll whether it found the stash, and fumbled it, is read from (searchTheftOf): one the GM drew for the thief's Search"
        }
    },
    [ACTION_OPENING_RESULT]: {
        label: "DRPG.Bridge.what.murder.openingResult",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, side: as.raw, total: as.num, isCritical: as.bool, withHope: as.bool, rollId: as.id }),
        run: handleOpeningResult,
        answer: "ack",
        // The opening's roll, on the GMs' record of it (E08+E28 C17; bridge-guards.mjs `rollRefusal`).
        rolled: { field: "rollId", actor: "actorId", kind: "murderOpening" },
        claims: { side: "compared by resolveOpening (murder.mjs) with the side the incident's own state gives that character",
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for that character's opening" }
    },
    [ACTION_CRISIS]: {
        label: "DRPG.Bridge.what.murder.crisis",
        guards: [knownSender, guardUndoIsTheGms, owns("actorId", "sender does not own that character"), guardCrisisAction, guardCrisisRoll],
        // murder.mjs before the guards, as the handler imported it (the plan's W2).
        prepare: () => import("./murder.mjs"),
        sanitize: pick({ actorId: as.id, key: as.text, total: as.num, isCritical: as.bool, withHope: as.bool, undo: as.gmFlag,
            choice: as.oneOf("stress", "hp"), usedItemId: as.id, swungId: as.id, free: as.bool, before: as.raw, rollId: as.id }),
        run: handleCrisis,
        // Answered once applied, which can wait on the GM: two killers' victim
        // running out is asked of them (`checkVictimSpent`, murder-rules.mjs).
        answer: "reply",
        /* A crisis action's roll, on the GMs' record of it (E08+E28 C17). A packet that names
           none threw none - a third party's decision, a free take - and `guardCrisisRoll`
           refuses any other; the run scores it on no dice. The roll settles the crisis action
           it was drawn for and no other (fix r2-H1; roll-draw.mjs `drawRefusal`): the record's
           `crisis` is the packet's `key`. */
        rolled: { field: "rollId", actor: "actorId", kind: "crisis", when: "rollId", named: { crisis: "key" } },
        claims: {
            usedItemId: "narrowed in the run to an item the acting character holds, else null",
            swungId: "narrowed in the run to an item the acting character holds, else null",
            before: "numbers or null by resourcesBefore (murder.mjs): a claim about the sender's own character, kept on the GMs' bookmark",
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-rolls.mjs): the sender's own row of that message, its character and a crisis action"
        }
    },
    [ACTION_PARK_MURDER]: {
        label: "DRPG.Bridge.what.murder.park",
        guards: [knownSender, owns("killerId", "sender does not own that character")],
        sanitize: pick({ killerId: as.id, room: as.maybeText, note: as.text }),
        run: handleParkMurder,
        answer: "reply"
    },
    [ACTION_BETRAYAL]: {
        label: "DRPG.Bridge.what.murder.betrayal",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, note: as.text }),
        run: handleBetrayal,
        // Answered once carried out (E32 C5b): in an Eclipse the asker has paid an action
        // and needs to know whether the declaration was parked.
        answer: "reply"
    },
    [ACTION_CLEANUP]: {
        label: "DRPG.Bridge.what.murder.cleanup",
        guards: [knownSender, guardUndoIsTheGms, owns("actorId", "sender does not own that character")],
        // cleanup.mjs before the guards, as the handler imported it.
        prepare: () => import("./cleanup.mjs"),
        sanitize: pick({ actorId: as.id, tokenId: as.id, key: as.text, targetId: as.id, total: as.num, isCritical: as.bool,
            withHope: as.bool, viaAction: as.bool, undo: as.gmFlag, grant: as.bool, price: as.raw, transform: as.raw, change: as.raw,
            rollId: as.id }),
        run: handleCleanup,
        answer: "reply",
        // Each of Stage 6's actions throws a clean-up's roll, read off the GMs' record of it (E08+E28 C17).
        rolled: { field: "rollId", actor: "actorId", kind: "cleanup" },
        claims: {
            tokenId: "resolveCleanup (cleanup.mjs) finds the trace in the cleaner's room and judges it, or refuses",
            targetId: "resolveStageSix (cleanup.mjs) judges who may be framed and where the body lies",
            price: "bounded on arrival against PRICE_CHAINS by the resolvers (T-1), and given back no further than the GMs' credit holds it (cleanup.mjs paidBack)",
            transform: "bounded on arrival against CLEANUP.transform by resolveCleanup (G-20)",
            change: "bounded on arrival against CLEANUP.transform by resolveCleanup (Z5)",
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-rolls.mjs): the sender's own row of that message, its character and a clean-up"
        }
    },
    [ACTION_CUB_ABILITY]: {
        label: "DRPG.Bridge.what.monocub.ability",
        // `key` and `choice` are claims the guard holds to the table (a row, a Monocub, one of the row's choices).
        guards: [knownSender, owns("actorId", "sender does not own that Monocub"), guardCubAbility],
        // No total, critical or roll: the GM throws the row's dice itself (E08+E28 C17; monocub.mjs `cubAbilityOnGm`; R218).
        sanitize: pick({ actorId: as.id, key: as.text, targetId: as.id, choice: as.text }),
        run: handleCubAbility,
        // The roll it threw goes back, for the Monocub's card.
        answer: "reply",
        claims: { targetId: "judged by the row's CUB_TARGETS rule in cubAbilityOnGm (monocub.mjs) before the GM throws: a living student in the Monocub's room" }
    },
    [ACTION_HOPE_CALL]: {
        label: "DRPG.Bridge.what.call.approve",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        // `cost` and `actorName` are sent and never read: the price comes from HOPE_CALLS
        // here, the name from the character (E02; E31). `nonce` names the purchase a GM's
        // yes is kept for (E29 fix r2-H4; `yesOnPrimary`).
        sanitize: pick({ actorId: as.id, key: as.text, callLabel: as.text, effect: as.text, note: as.text, nonce: as.text }),
        run: handleHopeCall,
        // Not patient (E18 C2, S10-51): the primary's "got it" comes as the card goes up, so none within
        // TIMING.ackMs is an ask no GM's listener took, said at once rather than after the ruling's clock (R840).
        answer: "reply", resend: true, timeoutMs: TIMING.hopeCallRulingMs
    },
    /*
     * A GM'S YES IS KEPT ON THE PRIMARY (E29 fix r2-H4, 05.10.2026; the round-2 reviews' sec M4
     * and cor M1). Any GM answers the card, and the primary judges the arm the yes allows
     * (bridge-guards.mjs `guardArmGmYes`), so the yes goes by the primary: it is kept there and
     * sent on to the player from there, before the player's browser can ask to arm. Another GM's
     * yes asks the primary here, the shape `audit.decide` has. A GM's alone: a player's yes to
     * their own ask is the hole this closes.
     */
    [ACTION_CALL_YES]: {
        label: "DRPG.Bridge.what.call.yes",
        guards: [gmOnly("only a GM says yes to a Call")],
        // `messageId` is the card pressed (E18 fix early-C2-G2): the yes is kept only for the ask held on it.
        sanitize: pick({ rid: as.text, asker: as.id, messageId: as.id }),
        run: handleCallYes,
        answer: "reply",
        claims: {
            asker: "yesOnPrimary (gm-bridge.mjs) keeps a yes only for an ask this primary holds under that request, made by that user",
            messageId: "yesOnPrimary (gm-bridge.mjs) keeps a yes only when the card pressed is the card the ask is held on"
        }
    },
    [ACTION_DIFFICULTY]: {
        label: "DRPG.Bridge.what.dynamic.difficulty",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, description: as.text, actorName: as.text, room: as.maybeText }),
        run: handleDifficulty,
        // Not patient, as the Hope Call's (E18 C2, R840).
        answer: "reply", resend: true
    },
    /*
     * AN ASK FROM A CARD ENDS ONCE, ON THE PRIMARY (E18 C1, 19.10.2026; audits S10-25, S11-13). A Hope
     * Call's card and a Dynamic action's stayed open after the player's clock had run out, and a GM's yes
     * given then was kept and sent to a browser that no longer waited; the GM who pressed wrote "Approved"
     * whether the player had the ruling or not. A Dynamic answer goes by the primary now, as a Call's yes
     * has since E29 fix r2-H4, and the primary writes the card: as ruled on its asker's `ruling.received`,
     * as expired on its asker's `ruling.expired` or when no receipt came within `TIMING.ackMs` - and then
     * takes a Call's yes back. A Dynamic difficulty is in the card's meta before it is sent on, whatever
     * the asker's browser reports after (`keepRuling`, fix early-C1-G1). A player's two reports name only
     * the ask's id; the primary acts only for the asker it holds under it (`expiredOnPrimary`, `receivedOnPrimary`).
     */
    [ACTION_DYNAMIC_ANSWER]: {
        label: "DRPG.Bridge.what.dynamic.answer",
        guards: [gmOnly("only a GM rules on a Dynamic action")],
        // `messageId` is the card pressed (E18 fix early-C2-G2): the ruling goes only to the ask held on it.
        sanitize: pick({ rid: as.text, asker: as.id, tier: as.num, trait: as.maybeText, refuse: as.bool, messageId: as.id }),
        run: handleDynamicAnswer,
        answer: "reply",
        claims: {
            asker: "dynamicOnPrimary (gm-bridge.mjs) keeps a ruling on its card and sends it on only for a Dynamic ask this primary holds under that request, made by that user",
            messageId: "dynamicOnPrimary (gm-bridge.mjs) keeps and sends on a ruling only when the card pressed is the card the ask is held on"
        }
    },
    [ACTION_RULING_EXPIRED]: {
        label: "DRPG.Bridge.what.ruling.expired",
        guards: [knownSender],
        sanitize: pick({ rid: as.text }),
        run: handleRulingExpired,
        answer: "none", quiet: true,
        claims: { rid: "expiredOnPrimary (gm-bridge.mjs) ends only an ask this primary holds or answered under that id, asked by the sender - a card's, or an open Frisk's (frisk.mjs expireFriskAsk: an unanswered one only once the sender's wait could have run out, an answered one as its 'Leave it')" }
    },
    [ACTION_RULING_RECEIVED]: {
        label: "DRPG.Bridge.what.ruling.received",
        guards: [knownSender],
        sanitize: pick({ rid: as.text }),
        run: handleRulingReceived,
        answer: "none", quiet: true,
        claims: { rid: "receivedOnPrimary (gm-bridge.mjs) writes only a ruling this primary sent under that id to the sender" }
    },
    /*
     * THE GM PICKS THE STATISTIC (E32+E07 C11b, 02.10.2026; audit S04-23). Judged on
     * the world, not the packet: `guardTraitRuling` holds the definition named to
     * one that lists several traits, and the character to one who may take it now.
     * No trait travels: the card's come from this GM's config (trait-ruling.mjs).
     */
    [ACTION_TRAIT_RULING]: {
        label: "DRPG.Bridge.what.trait.ruling",
        guards: [knownSender, owns("actorId", "sender does not own that character"), guardTraitRuling],
        sanitize: pick({ actorId: as.id, kind: as.text, key: as.text, variant: as.maybeText }),
        run: handleTraitRuling,
        answer: "reply", patient: true, resend: true, timeoutMs: TIMING.rulingMs
    },
    [ACTION_PROGRESS]: {
        label: "DRPG.Bridge.what.project.progress",
        guards: [
            knownSender,
            // Progress taken back - a negative amount - was a Reroll's, paid for by a receipt
            // until E08+E28 C8; it is the GM's own Reroll's now.
            guardUndoIsTheGms,
            /*
             * ONLY A PROJECT THE SENDER MAY KNOW ABOUT (E01, 24.09.2026; audit S14-03).
             * This checked that the sender exists and nothing else, so a player who had
             * learnt the id of a secret project - from an old packet, from a macro - could
             * push its bar from outside it, and the finished project would then credit
             * whoever the packet's own `userId` named. `canSee` is the secrecy gate the
             * share and sabotage handlers already use; every road a player's own client
             * sends progress down (an action, a Call, a Reroll) picks the project from
             * what that player can see, so nothing honest is refused. The credit goes to
             * the sender Foundry names, never to the payload's claim.
             */
            canSeeProject("countdownId", "sender may not see that project"),
            // The character whose roll or Call it is (E08+E28 C16): a roll is read as theirs, and they stand in the room.
            owns("actorId", "sender does not own that character"),
            // Progress comes from an action or a Call, so it is small by definition.
            // A payload asking for +999 is not the rules asking.
            inRange("amount", n => Number.isFinite(n) && n !== 0 && Math.abs(n) <= STARTING.despairMax,
                sent => `amount ${sent} is out of range`),
            // A frozen project; progress from another room (S10-08), a Call's as well since fix r2-H2; and a Call's,
            // which names no roll, paid for once - asked last, so that no other refusal spends its payment (`guardCallProgress`).
            guardProjectFrozen, guardProjectRoom, guardCallProgress
        ],
        sanitize: pick({ countdownId: as.id, amount: as.num, actorId: as.id, rollId: as.id, relief: as.num, bonus: as.num }),
        run: handleProgress,
        answer: "reply", queue: "project",
        /* A Work on a Project's amount is what its roll earned on the GMs' record (E08+E28 C16; `progressOf`),
           on the project the roll was drawn for (fix r2-H2: `named`); a Call's names no roll (`when`), and its
           guards bound it. */
        rolled: { field: "rollId", actor: "actorId", kind: "project", when: "rollId", named: { project: "countdownId" }, derive: progressOf },
        claims: { rollId: "the roll whose record the amount is read from (progressOf), and compared by noteProgressFact with the sender's own kept project roll; any other names no roll and writes no fact",
            relief: "the roller's word for its readied tool, held by progressOf to the tools the GM sees on the character (action-rolls.mjs projectExtrasHeld)",
            bonus: "the roller's word for an indirect murder's concealment, held by progressOf to [0, PROJECT_BONUS_MOST] on an indirect murder, on any outcome, and to 0 on any other project (projectExtrasHeld)" }
    },
    [ACTION_SHARE]: {
        label: "DRPG.Bridge.what.project.share",
        guards: [
            knownSender,
            // You may only share what you can already see.
            //
            // This used to check that the sender was a real user and nothing else,
            // so "share this project with me" was a single socket emit - aimed at
            // any project in the world, including somebody else's SECRET one. A
            // secret project is a murder plan; `resealSecretProjects` exists to keep
            // players out of exactly these, and this handler let a player back in
            // through the front door.
            canSeeProject("countdownId", "sender cannot see that project"),
            guardShareSecret, guardShareGuest
        ],
        // projects.mjs before the guards, as the handler imported it: the run asks
        // `canSee` again with nothing awaited between that and the write.
        prepare: () => import("./projects.mjs"),
        sanitize: pick({ countdownId: as.id, targetUserId: as.id }),
        run: handleShare,
        answer: "reply",
        claims: { targetUserId: guardShareGuest }
    },
    [ACTION_REMNANT]: {
        label: "DRPG.Bridge.what.remnant.place",
        guards: [knownSender, ownsActorAt(payload => payload?.data?.sourceActor, "sender does not own the character leaving it", ["data"])],
        sanitize: pick({ data: as.raw, rollId: as.id }),
        run: handleRemnant,
        // Answered once placed (E31), and as failed when it could not be (E31 review):
        // the item a planted trace stands for leaves the sheet only when it was.
        answer: "reply",
        /* The band a Search's, a Sabotage's or a Dynamic action's trace is left at is the GM's,
           read off its record of the roll (E08+E28 C15; `traceBandOf`); another action's trace
           names no roll. One roll leaves one trace. */
        rolled: { field: "rollId", actor: "data.sourceActor", kind: TRACE_OF_ROLL, kindAt: "data.action", settles: "trace", derive: traceBandOf },
        claims: { data: "a player's is rebuilt from a whitelist by narrowPlayerRemnant (remnants.mjs), its visibility the GM's band where its action's roll leaves it (traceBandOf), a discard's type the GM's (use-items.mjs discardRemnantType), refused in the Class Trial, and once placed the ticket its item's deletion stands on (sheet-audit.mjs noteDiscardTrace); a GM's is placed as written",
            rollId: "the roll a Search's, Sabotage's or Dynamic action's trace takes its band from (traceBandOf), and written on only by noteFactOfRoll (action-rolls.mjs): the sender's own row of that message, its character and an action that owns a trace" }
    },
    [ACTION_TIE_TRACE]: {
        label: "DRPG.Bridge.what.remnant.tieForItem",
        guards: [knownSender, guardTieTraceHolder],
        sanitize: pick({ identity: as.id }),
        run: handleTieTrace,
        answer: "ack",
        claims: { identity: guardTieTraceHolder }
    },
    [ACTION_REMNANT_EDIT]: {
        label: "DRPG.Bridge.what.remnant.edit",
        guards: [
            // A player's re-rating was a Reroll's, paid for by a receipt, until E08+E28 C8: the
            // GM's own Reroll re-rates the trace on its own client now (reroll.mjs
            // `settleRemnant`), so a player's is refused, and told why.
            gmOnly("an undo is the GM's own Reroll's"),
            // A trace somebody left: from the ledger, which this GM holds (`remnantSourceOf`) -
            // the token has carried no `sourceActor` flag since the answer key moved off it
            // (CASE-09). A GM owns every character, so this refuses only a trace nobody left.
            ownsActorAt(remnantSourceOf, "sender did not leave that Remnant", ["sceneId", "tokenId"])
        ],
        sanitize: pick({ sceneId: as.id, tokenId: as.id, patch: as.raw }),
        run: handleRemnantEdit,
        answer: "reply",
        claims: { patch: "narrowed in the run: remove as a flag, a visibility from REMNANT_VISIBILITY_LABELS, a type from a GM only" }
    },
    [ACTION_SABOTAGE]: {
        label: "DRPG.Bridge.what.project.sabotage",
        guards: [
            knownSender,
            // Freezing somebody's work is aimed at a project you found, not at an
            // id. Seeing it is the condition the picker is built from
            // (`sabotageTargetsIn` lists what this user can see), and it was the one
            // thing this side never asked - so any project in the world could be
            // frozen from a console, including a secret one whose existence the
            // sender had no way to learn honestly.
            canSeeProject("targetId", "sender cannot see that project"),
            // The saboteur, whose roll it is (E08+E28 C16).
            owns("actorId", "sender does not own that character"),
            // `difficulty` becomes the repair project's progress target, so it is
            // how much work the freeze costs its owner to undo. It arrived unread: a
            // payload asking for a target of 9999 froze a project for the rest of
            // the season. The ceiling is the hardest scale the rules define, read
            // from the table rather than written out here. Since E08+E28 C16 it is
            // what the roll earned on the GMs' record (`repairOf`), and 0 is a miss.
            inRange("difficulty", n => Number.isFinite(n) && n >= 0 && n <= hardestRepair(),
                sent => `difficulty ${sent} is out of range (0-${hardestRepair()})`),
            // Made standing at the project, a miss included (fix r2-H2; review S2-4).
            guardSabotageRoom
        ],
        sanitize: pick({ targetId: as.id, difficulty: as.num, actorId: as.id, rollId: as.id, penalty: as.num, relief: as.num }),
        run: handleSabotage,
        again: sabotageAgain,
        answer: "reply", resend: true, queue: "project",
        // Of the project its roll was drawn for (fix r2-H2: `named`).
        rolled: { field: "rollId", actor: "actorId", kind: "sabotage", named: { project: "targetId" }, derive: repairOf },
        claims: { rollId: "the roll whose record the repair is read from (repairOf), and written on only by noteFactOfRoll (action-rolls.mjs): the sender's own Sabotage row of that message",
            penalty: "the roller's word for its concealment, held by repairOf to [SABOTAGE_CONCEAL.despairPenalty, 0] (action-rolls.mjs sabotageExtrasHeld)",
            relief: "the roller's word for its readied tool, held by repairOf to the tools the GM sees on the character (sabotageExtrasHeld)" }
    },
    [ACTION_UNSABOTAGE]: {
        label: "DRPG.Bridge.what.project.unsabotage",
        guards: [
            // A player's thaw was a Reroll's, paid for by a receipt, until E08+E28 C8: the GM's
            // own Reroll takes its sabotage back on its own client now (reroll.mjs), so a
            // player's is refused, and told why.
            gmOnly("an undo is the GM's own Reroll's"),
            // Same rule as freezing it. Thawing is the completion of a repair
            // project, so the sender has to be able to see what they are thawing.
            canSeeProject("targetId", "sender cannot see that project")
        ],
        sanitize: pick({ targetId: as.id, repairId: as.id }),
        run: handleUnsabotage,
        answer: "reply", queue: "project",
        claims: { repairId: "a GM's: undoSabotage (projects.mjs) takes back only the pair the sabotage wrote (unsabotageRefusal)" }
    },
    [ACTION_PROJECT_CHANGE]: {
        label: "DRPG.Bridge.what.project.change",
        // A GM's own change, made by the primary for another GM (E36 C1). No player's browser asks it: a player's
        // change is one of the four rows above, each with its guards, and a console's packet naming this one is refused.
        guards: [gmOnly("only a GM changes a project")],
        sanitize: pick({ countdownId: as.id, change: as.raw, by: as.raw }),
        run: handleProjectChange,
        // A step, no person deciding: a clock of its own, and the wait ends when the primary leaves (E36 fix e1-G4).
        answer: "reply", timeoutMs: TIMING.projectChangeMs,
        claims: {
            countdownId: "a GM's: the primary changes the project it names, or none when it is gone (projects.mjs `applyProjectChange`)",
            change: "a GM's: cut to the keys the step knows (projects.mjs `cleanProjectChange`), the frozen project's refusal read again in the step",
            by: "a GM's: whose change it is, as that GM says - a kind of the closed list, a user of this world (else the sender), a character"
        }
    },
    [ACTION_SENDBACK]: {
        label: "DRPG.Bridge.what.token.sendBack",
        // `knownSender` is new here (E31): a sender Foundry does not know used to be
        // refused as "sender does not own that token", which was true but not why.
        guards: [knownSender, ownsActorAt(tokenActorOf, "sender does not own that token", ["sceneId", "tokenId"]), guardSendbackPlace],
        // `REVERT` before the guard, as the handler imported it: the guard's
        // judgement and the write have nothing but microtasks between them.
        prepare: () => import("./movement.mjs"),
        sanitize: pick({ sceneId: as.id, tokenId: as.id, position: as.raw }),
        run: handleSendback,
        answer: "ack",
        claims: { position: guardSendbackPlace }
    },
    [ACTION_LOOT]: {
        label: "DRPG.Bridge.what.body.loot",
        // You may fill your own pockets and nobody else's. Without this, "move
        // that knife onto whoever I like" was a single socket emit away.
        guards: [knownSender, owns("takerId", "sender does not own the character doing the taking")],
        sanitize: pick({ takerId: as.id, bodyId: as.id, itemId: as.id }),
        run: handleLoot,
        answer: "reply",
        // Where the taker stands is asked since E14 part 1 C1 (audit S08-01, S11-06): until then it was not (the E31
        // design's map of the GM side, row 30), and a body across the school was looted from a bedroom.
        claims: {
            bodyId: "lootBody (handover.mjs) on the one gate (inventory.mjs transferRefusal, mode loot; frisk.mjs personActionRefusal with { body: true }): a dead body whose death the sender knows, its token not hidden, in the room the GMs read the taker in, a living taker that is not the body, outside an Eclipse and a Class Trial; an unknown death is refused as a living body is",
            itemId: "lootBody (handover.mjs) takes only an item on that body that is not a Truth Bullet"
        }
    },
    [ACTION_ARM]: {
        label: "DRPG.Bridge.what.call.arm",
        guards: [
            // Refused out loud, and before the sender is, as the handler asked it.
            guardArmCharacter,
            knownSender,
            // The BUYER has to be the sender's own character - never the
            // beneficiary, who is somebody else's by definition for Support and For
            // the Game. Every other handler here checked ownership and this one did
            // not, so "arm me a Free Critical" was a single socket emit away, paid
            // for with nothing.
            owns(armBuyerId, "sender does not own the character paying for it"),
            guardArmPlayerCall, guardArmCallGrants
        ],
        // The player's road asks these itself, around a replayed purchase that is
        // answered rather than refused (`armPaidByPlayer`); `guardArmLiving` last of all.
        runGuards: [guardArmBuyer, guardArmOtherCharacter, guardArmHopeCallAllowed, guardArmNotHeld, guardArmBuyerHope, guardArmGmYes, guardArmLiving],
        // The beneficiary read once, and every import the two roads make, before
        // the guards - never later than the handler made them. And the buyer's and
        // the beneficiary's writes this GM has heard judged first (E29 C8): the
        // guards read the Hope and the armed list the GMs hold, not a forged value
        // the audit has not put back yet (sheet-audit.mjs `judgedFor`) - and the
        // purchase asks the Hope again where it pays, of the GMs' value (fix r1-G5).
        prepare: async payload => {
            const effects = await import("./call-effects.mjs");
            const guard = await import("./resource-guard.mjs");
            const audit = await import("./sheet-audit.mjs");
            await audit.judgedFor(payload?.actorId, payload?.call?.from);
            return {
                actor: game.actors.get(payload?.actorId ?? ""),
                appendArmedCall: effects.appendArmedCall, pendingCalls: effects.pendingCalls,
                gmMeansWrite: audit.gmMeansWrite, trustedWrite: guard.trustedWrite
            };
        },
        sanitize: pick({ actorId: as.id, call: as.raw }),
        run: handleArm,
        answer: "reply", resend: true,
        claims: { actorId: guardArmCharacter, call: guardArmPlayerCall }
    },
    [ACTION_DESPAIR]: {
        label: "DRPG.Bridge.what.despair.adjust",
        // A player's point was a Reroll's, paid for by a receipt, until E08+E28 C8: the GM settles a
        // Reroll's Despair itself (reroll.mjs), and an Assistant GM's correction comes here (DESP-12).
        guards: [gmOnly("an undo is the GM's own Reroll's"), guardDespairDelta, guardDespairPool],
        // `clamp` (E17 fix e1-G4): a GM's pip, held at the maximum with nothing spilled; a GM's flag, false from a player.
        sanitize: pick({ targetUserId: as.id, delta: as.num, clamp: as.gmFlag }),
        run: handleDespair,
        answer: "reply",
        claims: { targetUserId: guardDespairPool }
    },
    /*
     * THE OVERFLOW, ON THE PRIMARY GM (E17 C5, 26.10.2026; audit S09-32). A GM that is not the primary adds to the
     * count here (overflow.mjs `addOverflow`): Feed the Overflow paid on an Assistant's browser, a spill written there
     * with no primary to ask. A GM's alone: a player's console that could ask would darken the world. Tier 2 E17-T8
     * judges a player's ask (refused) and a second GM's (added on the primary, its count answered).
     */
    [ACTION_OVERFLOW_ADD]: {
        label: "DRPG.Bridge.what.overflow.add",
        guards: [gmOnly("only a GM adds to the overflow"),
            inRange("amount", n => Number.isFinite(n) && n >= 1 && n <= STARTING.despairMax, value => `amount ${value} is out of range`)],
        sanitize: pick({ amount: as.num, reason: as.text }),
        run: handleOverflowAdd,
        answer: "reply"
    },
    /*
     * A GM'S CLEAR OF THE OVERFLOW, ON THE PRIMARY GM (H84-06, 27.10.2026; triage C6): Despair Flow's Overflow tab on a GM
     * that is not the primary (overflow.mjs `clearOverflowAsGm`). A GM's alone, as `overflow.add`: a player's console that
     * could ask would take back the Despair the Monokuma has spilled. Nothing rides the packet; the run zeroes the count
     * and leaves a drawn darkening standing. Tier 2 "a GM clears the overflow ... (H84-06)" judges a player's ask (refused)
     * and a second GM's (cleared on the primary).
     */
    [ACTION_OVERFLOW_CLEAR]: {
        label: "DRPG.Bridge.what.overflow.clear",
        guards: [gmOnly("only a GM clears the overflow")],
        sanitize: pick({}),
        run: handleOverflowClear,
        answer: "reply"
    },
    /*
     * EVERY ROAD OF THE POOLS AND THE OVERFLOW, ON THE PRIMARY GM (E37 C7, 02.11.2026; E37-30, the deferred D061). A GM that
     * is not the primary asks it to set a pool (despair.mjs `setDespair`), fill or empty every pool (`fillAllDespair`,
     * `zeroAllDespair`), grant, revoke or name one (`addPool`, `removePool`, `setPoolLabel`), take Despair off the overflow
     * (overflow.mjs `takeOverflow`) and check it at a boundary (`checkOverflow`); each run is the primary's own function, in
     * its step of `DESPAIR_KEY` or `OVERFLOW_KEY`, and "reply" answers what it did, which the asking function answers its
     * caller. A GM's alone: a player's console that could ask would empty a Monokuma's pool, or take back or arm a
     * darkening. Tier 2 E37-T8 judges a player's ask of each (refused) and a second GM's (made on the primary);
     * 30-security forges each from a player's console, 33-bridge-paths A19 drives each from the Assistant GM.
     */
    [ACTION_DESPAIR_SET]: {
        label: "DRPG.Bridge.what.despair.set",
        guards: [gmOnly("only a GM sets a Despair pool"), guardDespairPool],
        // `value` is clamped to the pool's range by despair.mjs `writePool` (as.num: never NaN).
        sanitize: pick({ targetUserId: as.id, value: as.num }),
        run: handleDespairSet,
        answer: "reply",
        claims: { targetUserId: guardDespairPool }
    },
    [ACTION_DESPAIR_ALL]: {
        label: "DRPG.Bridge.what.despair.all",
        guards: [gmOnly("only a GM fills or empties the Despair pools")],
        sanitize: pick({ op: as.oneOf("fill", "zero") }),
        run: handleDespairAll,
        answer: "reply",
        claims: { op: "one of fill, zero (as.oneOf); any other is null, and the run carries nothing out" }
    },
    [ACTION_DESPAIR_ROSTER]: {
        label: "DRPG.Bridge.what.despair.roster",
        guards: [gmOnly("only a GM grants, revokes or names a Despair pool")],
        sanitize: pick({ op: as.oneOf("add", "remove", "label"), targetUserId: as.id, label: as.maybeText }),
        run: handleDespairRoster,
        answer: "reply",
        claims: {
            op: "one of add, remove, label (as.oneOf); any other is null, and the run carries nothing out",
            targetUserId: "judged on the primary in the step of DESPAIR_KEY: despair.mjs addPool grants only an Assistant GM of this world who holds none, removePool revokes only a pool granted, and the run names only a user of this world"
        }
    },
    [ACTION_OVERFLOW_TAKE]: {
        label: "DRPG.Bridge.what.overflow.take",
        guards: [gmOnly("only a GM takes Despair off the overflow"),
            inRange("amount", n => Number.isFinite(n) && n >= 1 && n <= STARTING.despairMax, value => `amount ${value} is out of range`)],
        sanitize: pick({ amount: as.num, reason: as.text }),
        run: handleOverflowTake,
        answer: "reply"
    },
    [ACTION_OVERFLOW_CHECK]: {
        label: "DRPG.Bridge.what.overflow.check",
        guards: [gmOnly("only a GM checks the overflow")],
        sanitize: pick({ ahead: as.bool, session: as.num, day: as.num, timeOfDay: as.oneOf(...TIMES_OF_DAY) }),
        run: handleOverflowCheck,
        answer: "reply",
        claims: {
            timeOfDay: "with session and day, the boundary the asking GM checks (E37 fix FG4): a GM's claim, held by overflow.mjs checkOverflow to the primary's own target before it reads the count; another arms nothing"
        }
    },
    [ACTION_ECLIPSE_MOVE]: {
        label: "DRPG.Bridge.what.eclipse.move",
        // `knownSender` is new here (E31), as for token.sendBack.
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, to: as.maybeText }),
        run: handleEclipseMove,
        answer: "reply",
        claims: { to: "named on the owner's card only when applyRecordedMove (eclipse.mjs) finds it a room of a scene the character stands on; it counts nothing" }
    },
    [ACTION_NOTE_SAVE]: {
        label: "DRPG.Bridge.what.note.save",
        // No id travels: the run writes the sender's own note (E05 C6).
        guards: [knownSender],
        sanitize: pick({ text: as.text }),
        run: handleNoteSave,
        answer: "reply"
    },
    /* THE ROLL A REROLL WOULD TAKE BACK, AS ITS ROLLER SAW IT (E08+E28 C2, 03.10.2026; the
       plan's 2.2). Sent by the roller's browser after the roll, and again when its action
       adds a claim (action-rolls.mjs `tellGmsOfRoll`): a report nobody waits on, so a refusal
       is the GM's log line. The roll's own numbers are read off the message on the GM. Since
       C5 it also names the card the roll was reported on, which a Reroll marks. */
    [ACTION_ROLL_BOOKMARK]: {
        label: "DRPG.Bridge.what.roll.bookmark",
        guards: [knownSender, owns("actorId", "sender does not own that character"), guardRollAuthor],
        sanitize: pick({ actorId: as.id, messageId: as.id, actionKey: as.maybeText, trait: as.maybeText, experiences: as.raw, context: as.raw,
            reportMessageId: as.id }),
        run: handleRollBookmark,
        answer: "none", quiet: true,
        claims: {
            messageId: guardRollAuthor,
            experiences: "the roller's own sheet's: keepGmBookmark (action-rolls.mjs) keeps up to twelve short strings",
            context: "picked per action by rollClaims (action-rolls.mjs ROLL_CLAIMS): what the roller alone saw; a Reroll's replay judges anything it writes beyond the roller's own sheet",
            reportMessageId: "kept only when reportCardOf (action-rolls.mjs) finds a module card of the sender's, no older than the roll and under a minute old; a Reroll only marks it"
        }
    },
    /*
     * THE REROLL, ASKED OF THE GM (E08+E28 C4a, 03.10.2026; audit S02-47). One request, and
     * the GM makes all of it from its own bookmark (reroll.mjs `rerollOnGm`): the packet names
     * the character and nothing else. Not queued: a second Reroll of a character while one is
     * made is refused there, not made after it. Not resent to a GM who reloads - the journal
     * a reload leaves is read on the GMs' side (C4b).
     */
    [ACTION_REROLL]: {
        label: "DRPG.Bridge.what.reroll.ask",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        // The character's writes this GM has heard judged first (E29 fix r2-H5), as `call.arm`'s are:
        // the Reroll's checks read the Hope the GMs hold, and its payment asks it again where it pays
        // (reroll.mjs `rerollRefusal`, `makeReroll`).
        prepare: async payload => {
            const { judgedFor } = await import("./sheet-audit.mjs");
            await judgedFor(payload?.actorId);
            return null;
        },
        sanitize: pick({ actorId: as.id }),
        run: handleReroll,
        answer: "reply"
    },
    /*
     * A PLAYER'S PRIVATE CARD WHILE AN INCIDENT RUNS (E08+E28 fix r2-H5, 05.10.2026; review
     * S2-3). Posted by this GM, as its author, so that no incident card names the player whose
     * browser asked for it (secret.mjs `askGm`, `postAsked`). Held to what the player could have
     * posted themselves: it speaks as no character or as one the sender owns, it is read by users
     * of this world, and it weighs what a player's words may. Not resent to a GM who reloads: a
     * card posted before the reload would be posted twice.
     */
    /*
     * UNDO OR KEEP, DECIDED ON THE PRIMARY GM (E29 C5, 05.10.2026; the plan's 2.9). A player's
     * write the GMs' audit flagged is decided once: another GM's click on the card asks the
     * primary (sheet-audit.mjs `askToDecideWrite`), whose decisions run one after another and
     * mark the row decided before they write - the shape `roll.grant` (private-rolls.mjs) gives
     * Grant all. A GM's alone: a player has nothing to decide.
     */
    [ACTION_AUDIT_DECIDE]: {
        label: "DRPG.Bridge.what.audit.decide",
        guards: [gmOnly("only a GM decides a write flagged to the GMs")],
        sanitize: pick({ rowId: as.id, keep: as.bool }),
        run: handleAuditDecide,
        answer: "reply",
        claims: { rowId: "decideWrite (sheet-audit.mjs) decides only a row the GMs flagged and nobody has decided, once, on the primary" }
    },
    /*
     * THE KEY FEE, CHARGED ON THE PRIMARY GM (E09 fix r1-G3, 08.10.2026; the round-1 goal
     * review's G3a). A Class Trial opens on whichever GM moved the phase (clock.mjs
     * `reconcilePhase`); the fee counts the Key copies by the GMs' marks, which are the
     * primary's, so another GM asks it here (investigation.mjs `askToChargeForUnfoundKeys`).
     * Carries nothing: the charge reads the clock, the trial's stamp and the case on this side.
     */
    [ACTION_KEYS_CHARGE]: {
        label: "DRPG.Bridge.what.keys.charge",
        guards: [gmOnly("only a GM opens a Class Trial, and the Key fee is charged as one opens")],
        sanitize: pick({}),
        run: handleKeysCharge,
        answer: "reply"
    },
    /*
     * THE TRIAL'S VOICES, SETTLED ON THE PRIMARY GM (E70 C5, 28.10.2026; amend 6, answer 3 (b)). The trial opens and
     * ends on whichever GM moved the phase (clock.mjs `reconcilePhase`); its list of the dead reads the GMs' deaths
     * store after it has hydrated, and the blocks are written by one GM in one step of the record's key, so another GM
     * asks the primary here (voice.mjs `askTrialVoices`), as the Key fee is asked above. Carries nothing: the settle
     * reads the clock, the deaths and the users on this side.
     */
    [ACTION_TRIAL_ENTER]: {
        label: "DRPG.Bridge.what.trial.enter",
        guards: [gmOnly("only a GM opens or ends a Class Trial, and the trial's voices are settled as it does")],
        sanitize: pick({}),
        run: handleTrialEnter,
        answer: "reply"
    },
    /*
     * THE TRIAL'S RECORD, WRITTEN ON THE PRIMARY GM (E70 fix p1-G2, 28.10.2026; the review's SEC-3, SEC-4, E70-01, E70-16).
     * The record is one world setting, and each GM wrote it in its own browser's queue from its own copy: a write of
     * another GM and one of the primary landed over each other, and two GMs ending the trial carried the sentence out
     * twice. Another GM's object patch, the reset at the entry, the execution and the season's taking back of the
     * sentence are asked here (vote.mjs `setTrialProgress`, `resetTrialProgress`, `executeAtExit`, `clearSentence`) and
     * run in the primary's one queue. A GM's request only: `patch` is held there to the record's own fields
     * (`recordPatchOf`), never the trial's list of the dead or the receipts, which only the primary's own steps write.
     */
    [ACTION_TRIAL_RECORD]: {
        label: "DRPG.Bridge.what.trial.record",
        guards: [gmOnly("only a GM writes the trial's record")],
        sanitize: pick({ op: as.oneOf("patch", "reset", "execute", "clearSentence"), patch: as.raw, seconds: as.num, chapter: as.num }),
        run: handleTrialRecord,
        answer: "reply",
        claims: {
            patch: "a GM's patch of the trial's record, held on the primary to the record's own fields (vote.mjs recordPatchOf, RECORD_FIELDS): never the chapter, the trial's list of the dead or the Objections' receipts; a GM's request only"
        }
    },
    /*
     * THE VOTE, RUN ON THE PRIMARY GM (E10 C1, 1.2.71; audit S06-17). The ballots are recorded
     * on the primary (vote.mjs `recordBallot`, into the GMs' store), so the steps that read or
     * reset them are taken there too: another GM's Send the ballots, Start the vote over,
     * Remind and Close and count ask it here (vote.mjs `askVote`, `onPrimary`). A GM's request
     * only: no player opens or counts a vote. `op` is one of the five steps or nothing; `picks`
     * is a number the primary bounds by the students enrolled (`picksFor`). The primary judges
     * the step against the trial's record and answers a status for one the record has moved past.
     */
    [ACTION_VOTE_RUN]: {
        label: "DRPG.Bridge.what.vote.run",
        guards: [gmOnly("only a GM runs the vote")],
        sanitize: pick({ op: as.oneOf("open", "close", "restart", "resend", "remind"), picks: as.num }),
        run: handleVoteRun,
        answer: "reply"
    },
    /*
     * A BALLOT, ON THE BRIDGE (E10 C2, 1.2.71; audit S06-12, S06-17). Until C2 a player's answer
     * was a raw packet to every GM (`vote.ballot`), which the primary recorded on a candidate
     * filter alone, and the player was told "Your vote is in." as it left - with no GM connected,
     * of a ballot nobody would count. A request now, a player's alone (a GM casts no ballot),
     * judged by the primary against the vote the world holds (vote.mjs `recordBallot`,
     * `ballotRefusal`) and answered with the round it was recorded in, or refused with the reason
     * the player is told. No voter travels: the primary finds the voter from the sender, as it
     * did. `patient` and `resend`, though nobody decides: a primary that reloads while a ballot is
     * on its way is asked again, with the same id, when its world has loaded, and the player is
     * not told meanwhile that nothing reached it. Asked quietly (`requestBallotCast`): the vote
     * says what came of a ballot in its own words (vote.mjs `sendBallot`).
     */
    [ACTION_VOTE_CAST]: {
        label: "DRPG.Bridge.what.vote.cast",
        guards: [knownSender, playersOnly("a GM casts no ballot")],
        sanitize: pick({ round: as.num, choice: as.raw }),
        run: handleBallot,
        answer: "reply", patient: true, resend: true,
        claims: {
            round: "held by recordBallot (vote.mjs ballotRefusal) to the round of the vote open in the world; any other is refused as moved on",
            choice: "held by recordBallot (vote.mjs ballotRefusal) to the vote's picks, none twice, each on the list the primary computes for the voter it finds from the sender"
        }
    },
    /*
     * A LATE JOINER'S BALLOT (E10 C2, 1.2.71). A player who loaded while a vote was open - who
     * joined after the ballots went out, or reloaded with a window open - was handed nothing
     * until a GM pressed Remind. Their browser asks now, at load and when a primary GM's world
     * has loaded (vote.mjs `askForBallot`), and the primary answers about the sender alone
     * (`ballotFor`): the ballot, that it is in, or null. A background question, so quiet, as
     * `advancement.ask` is: a refusal is the GM's log alone, and the next primary's arrival asks
     * again. Not patient: an answer is not a ruling, and a primary that has not acknowledged it
     * within the clock for a "got it" is asked again when its world has loaded.
     */
    [ACTION_VOTE_ASK]: {
        label: "DRPG.Bridge.what.vote.ask",
        guards: [knownSender, playersOnly("a GM asks for nothing here")],
        sanitize: pick({}),
        run: handleBallotAsk,
        answer: "reply", quiet: true,
        why: "answers only about the sender's own ballot, found from the id Foundry gives"
    },
    /*
     * THE GM'S NOW, RUN ON THE PRIMARY GM (E10 fix r2-G6, 1.2.71). The heartbeat writes the floor's
     * transitions on the primary under one latch (trial-floor.mjs `advancing`), and another GM's Now
     * wrote the same move on its own browser beside it. A GM's request only: a press while the
     * primary's own write is on its way does nothing. It names the floor the pressing GM saw (E10 fix
     * r2-G7), and the primary moves that floor or nothing: a press that reaches it after the move it
     * was pressed for had landed ended the rebuttal that move opened.
     */
    [ACTION_FLOOR_NOW]: {
        label: "DRPG.Bridge.what.floor.now",
        guards: [gmOnly("only a GM moves the trial's floor on")],
        // E70 C7: a round's turn skipped by a GM that is not the primary rides the same Now.
        // E70 C8: and the Closing's timed phases (the volunteers' window's draw, a speaker skipped).
        sanitize: pick({ mode: as.oneOf("objection", "rebuttal", "testimony", "panic", "closing"), startedAt: as.num }),
        run: handleFloorNow,
        answer: "reply",
        claims: {
            mode: "held by handleFloorNow and advanceFloorOnPrimary (trial-floor.mjs floorAsSeen) to the floor the primary holds now; any other is refused as moved on and moves nothing",
            startedAt: "held by handleFloorNow and advanceFloorOnPrimary (trial-floor.mjs floorAsSeen) to the start of the floor the primary holds now; any other is refused as moved on and moves nothing"
        }
    },
    /*
     * AN OBJECTION, RAISED ON THE PRIMARY GM AND PROVED AFTER (E79 C16, 1.2.79; the owner, 17.10.2026). The press
     * names only the objector: the target is whoever the primary GM's voice Room counts as speaking now, or last
     * (trial-speakers.mjs), and the packet's `targetId` is read only when the primary has no Room to listen to;
     * then a press that names nobody is answered `{ needName: true }`, nothing paid, and the asker names the target
     * and asks again (fix r4-G1: the primary's Room alone decides which road is taken).
     * The primary judges the trial, the floor, the death and the bullets as the GMs hold them, pays the price, posts
     * the card as a GM, pending, and opens the floor on it (trial.mjs `objectOnPrimary`); refused, nothing is paid.
     * `reply`: the asker opens its picker on the answer, the card and its deadline. Quiet: the asker's picker and
     * the whisper of the price say what came of it, and a refusal is told by the runner as every refusal is - not
     * quiet, then: the player pressed and waits for this.
     */
    [ACTION_TRIAL_OBJECT]: {
        label: "DRPG.Bridge.what.trial.object",
        guards: [knownSender, owns("actorId", "sender does not own the character objecting")],
        sanitize: pick({ actorId: as.id, targetId: as.id }),
        run: handleTrialObject,
        answer: "reply",
        claims: {
            targetId: "read by trial.mjs objectOnPrimary only while the primary GM has no voice Room (trial-speakers.mjs speakerRoomOpen), then held by targetRefusal (trial-floor.mjs mayObjectTo) to one of the trial's participants (vote.mjs trialParticipants, connected or not; E51 C6) alive as the table knows it (chapter.mjs livingStudents) the floor lets the objector aim at, and with none named answered needName with nothing paid; with a Room it is not read, and the speaker it counts is held by the same mayObjectTo"
        }
    },
    /*
     * THE TRUTH BULLET FOR IT (E79 C16). The objector's own Objection, pending, inside its seconds, and a bullet the
     * character holds as the GMs hold it (trial.mjs `evidenceOnPrimary`, trial-floor.mjs `pendingFor`); a late
     * pick, somebody else's or a made-up item changes nothing. `reply`: the asker's picker closes on it.
     */
    [ACTION_TRIAL_EVIDENCE]: {
        label: "DRPG.Bridge.what.trial.evidence",
        guards: [knownSender, owns("actorId", "sender does not own the character objecting")],
        // `bare`: the card without the Analyze result (E70 C10; Q-p2-3); a packet without it shows the result, as before.
        sanitize: pick({ actorId: as.id, itemId: as.id, comment: as.text, bare: as.bool }),
        run: handleTrialEvidence,
        answer: "reply",
        claims: {
            itemId: "held by trial.mjs evidenceOnPrimary to a Truth Bullet the objector holds as the GMs hold it (sheet-audit.mjs itemAsHeld), on the objector's own pending Objection inside its seconds (trial-floor.mjs pendingFor)"
        }
    },
    /*
     * THE OBJECTION TAKEN BACK (E79 fix r4-G2, 1.2.79; the round-4 review's cor F4). The objector's picker closed or
     * cancelled before its seconds ran out: the primary puts the floor back to the debate and marks the card, as at a
     * lapse, nothing given back (trial.mjs `withdrawOnPrimary`, trial-floor.mjs `withdrawObjection`). Only the
     * objector's own Objection on the card `messageId` names, still pending. "ack" and quiet: the window is closed
     * and nobody waits on the answer, and a refusal - the floor moved on, the seconds ran out - has the card saying
     * what came of it already.
     */
    [ACTION_TRIAL_WITHDRAW]: {
        label: "DRPG.Bridge.what.trial.withdraw",
        guards: [knownSender, owns("actorId", "sender does not own the character objecting")],
        sanitize: pick({ actorId: as.id, messageId: as.id }),
        run: handleTrialWithdraw,
        answer: "ack", quiet: true,
        claims: {
            messageId: "held by trial-floor.mjs withdrawObjection (pendingFor) to the card of the objector's own Objection on the floor the primary holds, still pending; any other changes nothing"
        }
    },
    /*
     * A GM'S RE-POINT, RUN ON THE PRIMARY GM (E79 C16). The trial console's Re-point: the running Objection's
     * target alone, as `floor.now` moves the floor on, so a second GM's press is not a second writer.
     */
    [ACTION_FLOOR_REPOINT]: {
        label: "DRPG.Bridge.what.floor.repoint",
        guards: [gmOnly("only a GM re-points an objection")],
        sanitize: pick({ targetId: as.id }),
        run: handleFloorRepoint,
        answer: "reply",
        claims: {
            targetId: "held by trial.mjs repointOnPrimary to a living student, one of the trial's participants (vote.mjs trialParticipants, connected or not; E51 C6), the floor lets the objector aim at (trial-floor.mjs mayObjectTo, targetRefusal); a GM's request only"
        }
    },
    /*
     * A GM'S CHANGE OF THE FLOOR, RUN ON THE PRIMARY GM (E70 C0, 27.10.2026; amend 5 (d)). Every public writer of the
     * floor (trial-floor.mjs `startFloor`, `openObjection`, `openRebuttal`, `fillObjection`, `withdrawObjection`,
     * `repointObjection`, `returnToDebate`, `extendFloor`, `endFloor`, and since E70 C1 the bar's `adjustTime` and
     * `endMode`, and since E70 C2 `overruleObjection`, which the primary refuses outside a Class Trial) asks this on a GM that is not the primary, and
     * the primary runs the op's twin in a step of the floor's key (`floorOnPrimary`): one writer of the floor, the
     * primary, one write at a time. Its ops are `FLOOR_OP_NAMES` (tier 0 R1020 holds the two lists equal). A GM's
     * request only: a player's console has the four rows above for what a player may do on the floor.
     */
    [ACTION_TRIAL_GM]: {
        label: "DRPG.Bridge.what.trial.gm",
        guards: [gmOnly("only a GM changes the trial's floor")],
        sanitize: pick({
            op: as.oneOf("start", "objection", "rebuttal", "fill", "withdraw", "repoint", "back", "extend", "end",
                "adjust", "endMode", "overrule", "testimony", "panic", "closing", "closingConfirm", "closingPick", "closingContinue",
                "closingResume", "reveal"),
            seconds: as.num, actorId: as.id, targetId: as.id, messageId: as.id, text: as.text, order: as.text,
            // Monokuma's Reveal (E70 C9): the row of missingKeys() a GM reveals, and past the fee's count when confirmed.
            slot: as.text, beyondPaid: as.bool
        }),
        run: handleTrialGm,
        answer: "reply",
        claims: {
            actorId: "the objector of a GM's Objection, held by trial-floor.mjs openObjectionInStep (floorRefusal, targetRefusal) to the floor the primary holds, or of the pending Objection a fill or a withdrawal names, held by pendingFor; a GM's request only",
            targetId: "held by trial-floor.mjs targetRefusal to a student the floor the primary holds lets the objector aim at, for an Objection or a re-point; a GM's request only",
            messageId: "held by trial-floor.mjs pendingFor to the card of the pending Objection on the floor the primary holds, or for an Overrule by floor-machine.mjs overruleTarget to the Objection running on that floor or the newest receipt of this trial the primary's record keeps; any other changes nothing",
            text: "the question of a debate a GM opens (E70 C3), read by the start alone and cut by floor-machine.mjs topicOf to a trimmed string of TRIAL.modes.topicLength; shown as text, escaped, wherever it is shown; or the players' words for a Key Remnant of Monokuma's Reveal whose row has none (E70 C9), read by trial-modes.mjs revealInStep only then and escaped on the copies' card; a GM's request only",
            order: "a round's order a GM gives (E70 C7), ids joined by commas: trial-floor.mjs startRoundInStep keeps only the trial's participants as the primary holds them (vote.mjs trialParticipants), once each, and draws the rest; a GM's request only"
        }
    },
    /*
     * A ROUND'S STEP FROM A PARTICIPANT'S BROWSER (E70 C7, 28.10.2026; E70-44, E70-45; S06-38: the GM's tab in the
     * background held a turn past its end). The speaker's owner ends the turn (Done) or passes it (Pass); any
     * participant's owner calls it over once it has run out on the primary's clock (a second's grace). Judged on the
     * primary (trial-modes.mjs `turnOnPrimary`): a Class Trial, a round on the floor, the character a participant of it,
     * the step the floor is at, Done and Pass the speaker's alone (floor-machine.mjs `done`, `pass`, `over`), one step
     * over per sender and step; the first that matches moves the round, every later one finds the next step. "reply":
     * the speaker's window closes on it; a step over is asked quietly (nobody waits on it).
     */
    [ACTION_TRIAL_TURN]: {
        label: "DRPG.Bridge.what.trial.turn",
        guards: [knownSender, owns("actorId", "sender does not own the character speaking")],
        sanitize: pick({ actorId: as.id, kind: as.oneOf("done", "pass", "over"), step: as.num }),
        run: handleTrialTurn,
        answer: "reply",
        claims: {
            kind: "one of done, pass, over (as.oneOf); judged by trial-modes.mjs turnOnPrimary and floor-machine.mjs nextFloor on the floor the primary holds",
            step: "compared by floor-machine.mjs nextFloor to the round's step on the floor the primary holds; any other is refused and moves nothing"
        }
    },
    /*
     * A VOLUNTEER FOR THE CLOSING ARGUMENT (E70 C8, 28.10.2026; TR23 = 1, E70-51). The owner of a student taking part says
     * "I'll sum up" in the Closing's 30 s. Judged on the primary (trial-modes.mjs `volunteerOnPrimary`), in one step of the
     * floor's key: a Class Trial, the volunteers' window open, the character among the trial's participants (vote.mjs
     * `trialParticipants`), once. The name goes to the GMs' store (gm-stores.mjs `closingClaimStore`) and only the count
     * to the floor. "reply": the window says the volunteer is counted.
     */
    [ACTION_TRIAL_CLAIM]: {
        label: "DRPG.Bridge.what.trial.claim",
        guards: [knownSender, owns("actorId", "sender does not own the character volunteering")],
        sanitize: pick({ actorId: as.id }),
        run: handleTrialClaim,
        answer: "reply"
    },
    /*
     * A PRESENT, POSTED BY THE PRIMARY WITH ITS COPIES (E70 C10, 28.10.2026; S18-79, TR2 = 1, B2, B6, Q-p2-5). The
     * owner of a student taking part shows one of their Truth Bullets, with or without its Analyze result; the primary
     * posts the card as a GM and mints a copy as shown onto every other participant's sheet (trial.mjs
     * `presentOnPrimary`, handover.mjs `mintCopy`): a Class Trial, the presenter alive as the GMs hold it, the mode's row
     * (trial-floor.mjs `presentRefusal`), a bullet the character holds as the GMs hold it, one copy per person. "reply":
     * the presenter's window says it went out. With no GM connected the bridge refuses it, as every row.
     */
    [ACTION_TRIAL_PRESENT]: {
        label: "DRPG.Bridge.what.trial.present",
        guards: [knownSender, owns("actorId", "sender does not own the character presenting")],
        // `bare`: without the Analyze result (B2), so a packet that names nothing shows what the presenter knows.
        sanitize: pick({ actorId: as.id, itemId: as.id, comment: as.text, bare: as.bool }),
        run: handleTrialPresent,
        answer: "reply",
        claims: {
            itemId: "held by trial.mjs presentOnPrimary to a Truth Bullet the presenter holds as the GMs hold it (sheet-audit.mjs itemAsHeld), the card and the copies minted from it as the GMs hold it (bulletAsHeld)"
        }
    },
    /*
     * THE READINESS ROUND (E37 C3, 01.11.2026; E37-12 to E37-15, the owner's ask of 28.10). A GM's press that would start
     * an Eclipse, end one or move the time of day opens a round on the primary (boundary.mjs `openRoundOnPrimary`), in a
     * step of `READY_KEY`: the primary's own press locally, any other GM's here. A GM's alone: a player's console that
     * could open one would put a window on every screen, and one that could end one would close the GM's. `kind` is one
     * of three and is held to the clock in the step (an end only while an Eclipse runs). "reply": the GM's window opens
     * on the round answered. 30-security sends a player's open and end (refused, nothing written); 33-bridge-paths the
     * Assistant GM's open and end.
     */
    [ACTION_READY_OPEN]: {
        label: "DRPG.Bridge.what.ready.open",
        guards: [gmOnly("only a GM opens a readiness round")],
        sanitize: pick({ kind: as.oneOf("eclipseStart", "eclipseEnd", "next") }),
        run: handleReadyOpen,
        answer: "reply",
        claims: { kind: "one of eclipseStart, eclipseEnd, next (as.oneOf); held by boundary.mjs openRoundOnPrimary to the clock the primary holds, in the step of READY_KEY" }
    },
    /*
     * A PLAYER'S ANSWER (E37 C3; E37-13, E37-15): Done or One moment, from the player's window. The answer is the
     * sender's word about the sender: keyed by the user Foundry names as the sender, never by a user id in the packet
     * (the packet carries none), for the round the primary holds open, from a player who owns a student of the one cast
     * (boundary.mjs `answerOnPrimary`). It writes that one answer and moves nothing: only the GM's window moves the
     * clock. "reply": the window comes back after One moment once it is counted.
     */
    [ACTION_READY_ANSWER]: {
        label: "DRPG.Bridge.what.ready.answer",
        guards: [knownSender],
        sanitize: pick({ roundId: as.id, ready: as.bool }),
        run: handleReadyAnswer,
        answer: "reply",
        claims: {
            roundId: "compared by boundary.mjs answerOnPrimary to the id of the round the primary holds open over its clock, in the step of READY_KEY; any other is refused and writes nothing"
        }
    },
    /*
     * THE ROUND'S END (E37 C3; E37-14): the GM's window went on ("go") or the GM said Not now ("stop"); the record keeps
     * which, so every player's window closes and says it (boundary.mjs `endRoundOnPrimary`); a barred "go" is written
     * "go" and answered `barred` (E37 fix FG1c). A GM's alone, as the open.
     */
    [ACTION_READY_END]: {
        label: "DRPG.Bridge.what.ready.end",
        guards: [gmOnly("only a GM ends a readiness round")],
        sanitize: pick({ roundId: as.id, outcome: as.oneOf("go", "stop") }),
        run: handleReadyEnd,
        answer: "reply",
        claims: {
            roundId: "compared by boundary.mjs endRoundOnPrimary to the id of the round the primary's record holds, in the step of READY_KEY; another, or one ended, is refused and writes nothing"
        }
    },
    /*
     * A RESHAPE RULED ON THE PRIMARY GM (E09 C10, 08.10.2026). Each GM has the card, and
     * each GM's ruling used to run on its own browser against its own copy of the synced
     * attempt store: two GMs - or Approve and Decline on one card - both wrote. The primary
     * reads the proposal off the attempt's row and marks the row ruled in one step
     * (cleanup.mjs `claimRuling`), so every GM's click is sent here (`askReshapeRuling`).
     * A GM's alone: the card's buttons are drawn for GMs.
     */
    [ACTION_RESHAPE_RULING]: {
        label: "DRPG.Bridge.what.cleanup.ruling",
        guards: [gmOnly("only a GM rules on a reshaped trace")],
        sanitize: pick({ actorId: as.id, tokenId: as.id, attempt: as.text, verdict: as.text }),
        run: handleReshapeRuling,
        answer: "reply",
        claims: {
            actorId: "the row of that character's last clean-up in the GMs' store, and nothing is done without one (cleanup.mjs claimRuling)",
            tokenId: "compared to the row's trace by claimRuling; a trace that differs is refused",
            attempt: "compared to the row's attempt by claimRuling; an attempt a Reroll or a later attempt replaced is refused",
            verdict: "\"approve\" or \"decline\" (cleanup.mjs ruleReshape); anything else rules on nothing"
        }
    },
    /*
     * AN OBSERVE'S FOCUSED GAZE, PICKED ON THE PRIMARY GM (E09 C12, 08.10.2026; audit S05-27).
     * The card is every GM's, and the pick is checked where the ask is kept: the primary holds
     * who asked, for which character and in which room (`observeAsks`), reads the list of
     * traces again, and writes the Observe's row only for a trace on it. A GM's alone: the
     * card's buttons are drawn for GMs.
     */
    [ACTION_OBSERVE_PICK]: {
        label: "DRPG.Bridge.what.observe.pick",
        guards: [gmOnly("only a GM picks what an Observe is aimed at")],
        sanitize: pick({ rid: as.id, actorId: as.id, tokenId: as.id, refuse: as.bool }),
        run: handleObservePick,
        answer: "reply",
        claims: {
            rid: "the ask this primary keeps under that request (observePickOnPrimary); one it does not keep - answered, given up, never asked - is refused and told",
            actorId: "compared to the character of the ask kept under rid; another character's is refused and told",
            tokenId: "read again on the primary: one of observeCandidates for that character in the room it asked in (observe.mjs pickObserveTarget), else nothing is written and the GM is told",
            refuse: "the GM's Refuse: the asker is told the Observe was refused, and nothing is written"
        }
    },
    [ACTION_CARD]: {
        label: "DRPG.Bridge.what.card.post",
        guards: [knownSender, guardCardSpeaker, guardCardReaders],
        sanitize: pick({ content: as.text, whisper: as.raw, speaker: as.raw, flags: as.raw, summary: as.raw, veiled: as.bool }),
        run: handleCardPost,
        answer: "reply",
        claims: {
            whisper: guardCardReaders,
            speaker: guardCardSpeaker,
            flags: "the card's own module flags, judged by postAsked (secret.mjs): none of GM_META, a thread only the sender's own, who asked written by this GM",
            summary: "the card's facts, judged by postAsked (secret.mjs) as secret.card judges a player's: plain fields, and none about a character the sender does not own"
        }
    },
    /*
     * ONE RULING PER CARD (E18 C3, 19.10.2026; audits S11-14, S17-22). Every GM's click on a card's
     * button is claimed here first, and the primary decides in one step whether that card is free
     * (`claimOnPrimary`). A GM's alone: the buttons are drawn for GMs, and a player's claim would
     * hold a card away from them.
     */
    [ACTION_CARD_CLAIM]: {
        label: "DRPG.Bridge.what.card.claim",
        guards: [gmOnly("only a GM rules on a card sent to the GMs")],
        sanitize: pick({ messageId: as.id, step: as.oneOf("take", "done", "drop") }),
        run: handleCardClaim,
        answer: "reply",
        claims: {
            messageId: "read on the primary by claimOnPrimary: a card that exists, with no row in the GMs' ruledCardStore, not settled and not held by another click",
            step: "\"take\" before the ruling runs, \"done\" once it was made (the row is written), \"drop\" when it was not; done and drop end only the sender's own claim"
        }
    }
});

/** The two handovers: one declaration, told apart by the runner's `ctx.action`. */
function handover(label) {
    return {
        label,
        guards: [knownSender, owns("fromId", "sender does not own the character giving it away")],
        sanitize: pick({ fromId: as.id, toId: as.id, itemId: as.id }),
        run: handleShareBulletOrGiveItem,
        answer: "ack",
        claims: {
            toId: "handover's verify (handover.mjs) on the one gate (inventory.mjs transferRefusal, mode give): a living recipient, not the giver, in the giver's room as the GMs read both, outside an Eclipse and a Class Trial, by a living giver",
            itemId: "handover's verify (handover.mjs): an item of the giver's"
        }
    };
}

/** The largest repair a sabotage can demand: the hardest scale the rules define. */
function hardestRepair() {
    return Math.max(...Object.values(PROJECT_SCALE).map(s => s.progress));
}

/**
 * The primary GM's one listener for what a player asks (E31). The primary gate
 * is here, not in `judge`, so the suite can drive the runner on any client
 * (R162); whatever is not a key of the table - another file's packet, a reply
 * travelling back to a player - is not judged and not acknowledged. A packet in
 * flight while this client is still loading or already closing finds no
 * `game.user` and is left alone, as the listener before the table left it.
 */
function onSocket(payload, senderId) {
    return isPrimaryGm() && game.user ? judge(BRIDGE_ACTIONS, payload, senderId) : null;
}

/* ==========================================================================
 * ASKING THE GM (E31, 25.09.2026; audit S17-09)
 * --------------------------------------------------------------------------
 * Every request below goes through `ask`, which reads how to wait off the
 * action's declaration in BRIDGE_ACTIONS - its `answer`, whether it is
 * `patient`, whether it is asked again when a GM's world has loaded, how long
 * its clock runs - and hands it to `bridgeRequest` (bridge-guards.mjs), the one
 * wait. Each answers the bridge's result, `{ ok, pending?, value?, refused?,
 * reason? }`, which is truthy whatever it says: so it is read in the function
 * that asked for it, and does not leave it (the lint rule drpg/bridge-result,
 * eslint.config.mjs). A failure has been told to the player once, in their
 * language, by the time the result arrives; a caller says only what follows
 * from it. A GM does the work on its own client (`local`), as each request
 * did, and a request with no GM connected is refused before anything is sent.
 * ========================================================================== */

/** Ask for `action` as its declaration says; `opts` adds what only the caller knows (local, quiet, nothingSpent, a clock). */
function ask(action, payload, opts = {}) {
    const decl = BRIDGE_ACTIONS[action];
    return bridgeRequest(action, payload, {
        settle: decl.answer, patient: Boolean(decl.patient), resend: Boolean(decl.resend), quiet: Boolean(decl.quiet),
        ...(decl.timeoutMs ? { timeoutMs: decl.timeoutMs } : {}),
        ...opts
    });
}

/**
 * A primary GM has finished loading and can answer questions again.
 *
 * THE GM'S BROWSER IS ALLOWED TO CRASH. A ruling lives in a card or a dialog on
 * their screen and in nothing else: reloading with it open threw the question
 * away, and the player sat on "Awaiting a ruling." until their own clock gave
 * up. The action was spent and the roll was thrown, so what they lost was real,
 * and neither side had any way back to it (B-F5-1). The asking client is the
 * one that survives all this, so it is the one that repeats itself: when the
 * primary GM's world has loaded and this browser is still waiting, each request
 * that asked for it goes out again once, with the SAME request id, so the answer
 * lands in the promise already waiting for it (`resendOnGmReady`,
 * bridge-guards.mjs). Once per request, and only while it is still waiting.
 */
function onGmReady(payload, senderId) {
    if (payload?.action !== ACTION_GM_READY) return;
    if (!game.users.get(senderId)?.isGM) return;
    // The PRIMARY GM's arrival, not any GM's (COMM-05): a second GM joining
    // while the primary still had the question open made this client ask it
    // again, and the primary was answering the same request twice. When the
    // primary role has moved to the newcomer, the newcomer IS the primary.
    // Its own packet says it is up, whether or not this client has seen it connect (E04's fix round).
    if (senderId !== primaryGmId({ arriving: senderId })) return;
    resendOnGmReady();
    // And the Level Ups: a primary that has just arrived is the one holding them.
    askForOffers();
    /* And every copy a player holds of a GM store - the door, the cast, the fog - asks the
       arriving primary the same way (E04's fix round: the fix list's 15 and the round-2
       review's m4). They asked on `userConnected`, which on a live reload fires before the
       GM's world has loaded and its listeners exist: the question was lost, and a player
       who had loaded first held no copy until its own next load. The hook carries the
       primary's id, so a client that has not seen it connect yet still knows whom to ask. */
    Hooks.callAll("drpgPrimaryReady", senderId);
}

export function registerGmBridge() {
    /* THE RESCUE SIGNAL IS "A GM IS LISTENING", NOT "A GM IS CONNECTED".
       -----------------------------------------------------------------------
       `userConnected` fires when a GM's socket comes up, which is many seconds
       before their world has finished loading and this very function has run -
       measured on a live reload: the re-sent question left before the GM had a
       listener for it and vanished. So the GM announces themselves once, HERE,
       at the point where they can actually answer, and anybody still waiting
       asks again. */
    if (game.user.isGM) game.socket.emit(SOCKET_EVENT, { action: ACTION_GM_READY });
    else game.socket.on(SOCKET_EVENT, onGmReady);

    // A ruling card with no thread to live in (see the fallback in `callGm`)
    // is a chat card, and its buttons need the same wiring a bubble gets.
    // After the secret swap: the import is a microtask, and the swap ran in
    // this same hook dispatch.
    if (game.user.isGM) {
        // The asks' cards left open by an asker who left or a primary that reloaded end at their time (E18 C2):
        // swept once this world is up, and again by the GM who becomes the primary when the primary leaves.
        sweepAskCards().catch(err => debug("Could not sweep the asks' cards", err));
        Hooks.on("userConnected", (user, connected) => {
            // A GM who left in the middle of a ruling holds no card any more (E18 C3).
            if (!connected && user?.id) releaseClaimsOf(user.id);
            if (connected || !user?.isGM || !isPrimaryGm({ leaving: user.id })) return;
            sweepAskCards({ leaving: user.id }).catch(err => debug("Could not sweep the asks' cards", err));
        });
        // A card deleted takes the GMs' row of who ruled it with it (E18 C3): the primary writes the rows, and drops them.
        Hooks.on("deleteChatMessage", message => {
            if (!isPrimaryGm() || !message?.id) return;
            claimsInProgress.delete(message.id);
            import("./gm-stores.mjs")
                .then(({ ruledCardStore }) => (ruledCardStore.has(message.id) ? ruledCardStore.drop(message.id) : null))
                .catch(err => debug("Could not drop a deleted card's ruling row", err));
        });
        Hooks.on("renderChatMessageHTML", (message, element) => {
            // From the words' meta (E06 C7a): the card is drawn again when they land.
            if (!cardFlag(message, "callCard")) return;
            import("./messenger-app.mjs")
                .then(m => m.wireCallActions(element.querySelector(".message-content") ?? element, message))
                .catch(err => debug("Could not wire a ruling card in the log", err));
        });
    }
    game.socket.on(SOCKET_EVENT, onSocket);
    // The answers to this client's own requests - "got it", done, refused - come
    // back through the one listener `registerBridgeReplies` puts up (module.mjs).
    // The one request that travels the other way - GM to player - so it cannot
    // sit behind the `isPrimaryGm` gate in `onSocket` either.
    game.socket.on(SOCKET_EVENT, onOpeningAsk);
    // And its withdrawal, which travels the same way for the same reason.
    game.socket.on(SOCKET_EVENT, onOpeningCancel);
    // The Level Ups offered to this user's characters travel GM -> owner as well.
    // Asked for once the listener is up - never pushed on `userConnected`, which
    // arrives before a newcomer can hear it (see the note at the top).
    game.socket.on(SOCKET_EVENT, onAdvancementOffers);
    askForOffers();
    // An open Frisk's windows travel GM -> player too, and the primary watches its asks' rooms (E80 part 2 C3).
    import("./frisk.mjs").then(m => m.registerFrisk()).catch(err => error("Could not set up the Frisk's windows", err));
}

/**
 * Stage 4, thrown by the person it is about.
 *
 * The opening rolls used to be thrown on the GM's client, which meant the two
 * dice that decide whether a murder happens at all were rolled by somebody who
 * is not the killer and not the victim - and the roll window, the Hope it grants
 * and any Call armed for it all landed on the wrong screen. This carries the
 * request to the participant's own client; the answer comes back through
 * `ACTION_OPENING_RESULT` and is applied by a GM, because Stage 4 writes world
 * state.
 *
 * `senderId` is checked rather than the payload: an invitation to roll is an
 * instruction to spend this character's resources, and only a GM may issue it.
 *
 * It carries the statistic a GM picked for it (E32+E07 C11c; murder-rules.mjs
 * `openingTraitFor`), the one this client throws; `throwOpeningRoll` holds it to the
 * two the side lists.
 */
async function onOpeningAsk(payload, senderId) {
    if (payload?.action !== ACTION_OPENING_ASK) return;
    if (payload.userId !== game.user.id) return;
    if (!game.users.get(senderId)?.isGM) return;

    const { throwOpeningRoll } = await import("./murder.mjs");
    await throwOpeningRoll(payload.side, payload.actorId, payload.trait ?? null);
}

/**
 * Ask a participant's own client to throw their Stage 4 roll.
 * @returns {boolean} false when nobody is there to ask, so the GM throws it.
 */
export function askOpeningRoll({ userId, actorId, side, trait }) {
    if (!userId || !game.users.get(userId)?.active) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OPENING_ASK, userId, actorId, side, trait
    }, { recipients: [userId] });
    return true;
}

/**
 * Take the invitation back.
 *
 * An invitation is an instruction to spend a character's resources, so its
 * withdrawal is checked the same way it was issued: `senderId`, not the claim
 * in the payload.
 */
async function onOpeningCancel(payload, senderId) {
    if (payload?.action !== ACTION_OPENING_CANCEL) return;
    if (payload.userId !== game.user.id) return;
    if (!game.users.get(senderId)?.isGM) return;

    const { closeOpeningRoll } = await import("./murder.mjs");
    closeOpeningRoll();
}

/** Withdraw a Stage 4 invitation from whoever is sitting in front of it. */
export function cancelOpeningRoll({ userId }) {
    if (!userId || !game.users.get(userId)?.active) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OPENING_CANCEL, userId
    }, { recipients: [userId] });
    return true;
}

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

/** An owner's browser: take the set the primary sent. Outside the primary gate. */
function onAdvancementOffers(payload, senderId) {
    if (payload?.action !== ACTION_ADVANCEMENT_OFFERS) return;
    if (!replyForMe(payload, senderId)) return;
    import("./level-up.mjs")
        .then(m => m.receiveOffers(payload.offers, payload.stamps))
        .catch(err => error("Could not keep the Level Ups offered to you", err));
}

/**
 * An owner's browser: ask the primary for this user's offers. A background
 * question nobody waits on (the answer is a packet of its own), so it is quiet,
 * and with no GM connected it is not sent - it used to be broadcast to every
 * client then.
 */
function askForOffers() {
    if (game.user.isGM) return;
    void ask(ACTION_ADVANCEMENT_ASK, {});
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
export function requestBodyLoot({ takerId, bodyId, itemId }) {
    return ask(ACTION_LOOT, { takerId, bodyId, itemId }, {
        local: () => import("./handover.mjs").then(m => m.lootBody({ takerId, bodyId, itemId }))
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
 * Find Passage (E80 C3; action-rolls.mjs `locatePassage`): the roll `rollId` names goes to the primary GM, which reads the
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
export function requestDynamicDifficulty({ description, actorName, room, actorId = null }, timeoutMs = TIMING.rulingMs) {
    return ask(ACTION_DIFFICULTY, { description, actorName, room, actorId }, { timeoutMs, nothingSpent: true,
        expired: ACTION_RULING_EXPIRED, received: ACTION_RULING_RECEIVED });
}

/**
 * Ask the GMs which of a roll's listed statistics the character rolls
 * (trait-ruling.mjs `traitFor`). A human reading a thread, so the clock is the
 * ruling's, there is none for the "got it", and it is asked again when a GM's
 * world has loaded; nothing has been paid on this side, so a failure says
 * "Nothing was spent."
 *
 * @returns {Promise<object>} the bridge's result; `value` the trait, or false when the GM refused.
 */
export function requestTraitRuling({ actorId, kind, key, variant = null }) {
    return ask(ACTION_TRAIT_RULING, { actorId, kind, key, variant }, { nothingSpent: true,
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
 * it here. See action-rolls.mjs `tellGmsOfRoll`.
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
export function requestParkMurder({ killerId, room = null, note = "" }) {
    return ask(ACTION_PARK_MURDER, { killerId, room, note }, {
        local: () => import("./eclipse.mjs").then(m => m.writeParkedMurder({ killerId, room, note }))
    });
}

/**
 * Ask a GM to open the betrayal: the newcomer kills the killer they helped - or, in an
 * Eclipse, to park it with `note` until the lights (E32 C5b).
 *
 * No dice and no numbers travel - this is a declaration, and whether it opens is
 * re-derived from the incident on the GM's side (`betrayAsPlayer`).
 */
export function requestBetrayal({ actorId, note = "" }) {
    return ask(ACTION_BETRAYAL, { actorId, note }, {
        local: () => import("./murder.mjs").then(m => m.betrayAsPlayer(actorId, { note }))
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
        // reads to give its action back (action-rolls.mjs `performPalm`; E14 part 1 C1, Q3).
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
           judges that claim). No receipt: the ask's end is its cards, posted before its answer goes, and with a force
           open the follow is the searcher's next word. */
        untilPrimaryLeaves: true,
        expired: ACTION_RULING_EXPIRED,
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
        // answer keeps the refusal, which action-rolls.mjs `locateStash` reads to give the price back.
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
