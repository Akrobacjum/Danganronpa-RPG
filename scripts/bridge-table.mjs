/**
 * Danganronpa RPG - the bridge's table.
 * ---------------------------------------------------------------------------
 * BRIDGE_ACTIONS - one declaration per request a player's or a GM's client
 * asks of the primary GM: its label, its guards, its whitelist, its run and
 * how it is answered - with the two helpers its declarations call
 * (`handover`, `hardestRepair`), the primary's listener `onSocket`, which
 * hands every packet to bridge-guards.mjs's
 * `judge(BRIDGE_ACTIONS, payload, senderId)`, and `ask`, the one road every
 * request of bridge-asks.mjs takes to it.
 *
 * WHERE IT SITS. Moved out of gm-bridge.mjs by E41 C5b (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. The table and `ask`
 * leave together: every request asks through `ask`, which reads the table.
 * gm-bridge.mjs re-exports BRIDGE_ACTIONS, which it exported; `onSocket` is
 * exported for gm-bridge.mjs's `registerGmBridge`, and `ask` for
 * bridge-asks.mjs. The table takes its runs from bridge-runs-acts.mjs and
 * bridge-runs-records.mjs and its names from bridge-wire.mjs; nothing here
 * imports gm-bridge.mjs. This is the one bridge file that imports `judge`
 * (R1b).
 */

import { STARTING, PROJECT_SCALE, TIMING, TIMES_OF_DAY } from "./config.mjs";
import { isPrimaryGm } from "./utils.mjs";
import {
    guardUndoIsTheGms, guardCrisisAction, guardCrisisRoll, guardShareSecret, guardShareGuest, guardTieTraceHolder,
    guardSendbackPlace, armBuyerId, guardArmCharacter, guardArmPlayerCall, guardCubAbility, guardArmCallGrants,
    guardArmLiving, guardArmNotHeld, guardArmBuyer, guardArmOtherCharacter, guardArmHopeCallAllowed, guardArmBuyerHope,
    guardArmGmYes, guardDespairDelta, guardDespairPool, guardTraitRuling, guardRollAuthor, guardCallProgress,
    guardProjectFrozen, guardProjectRoom, guardSabotageRoom, guardCardSpeaker, guardCardReaders, table, tokenActorOf,
    remnantSourceOf, knownSender, notSpectator, senderNotSpectator, owns, ownsActorAt, gmOnly, playersOnly, canSeeProject, inRange, as, pick, judge,
    bridgeRequest
} from "./bridge-guards.mjs";
import {
    ACTION_PROGRESS, ACTION_SHARE, ACTION_REMNANT, ACTION_TIE_TRACE, ACTION_REMNANT_EDIT, ACTION_SABOTAGE,
    ACTION_UNSABOTAGE, ACTION_PROJECT_CHANGE, ACTION_SENDBACK, ACTION_ECLIPSE_MOVE, ACTION_ARM, ACTION_DESPAIR,
    ACTION_OVERFLOW_ADD, ACTION_OVERFLOW_CLEAR, ACTION_DESPAIR_SET, ACTION_DESPAIR_ALL, ACTION_DESPAIR_ROSTER,
    ACTION_OVERFLOW_TAKE, ACTION_OVERFLOW_CHECK, ACTION_DIFFICULTY, ACTION_AUDIT_DECIDE, ACTION_KEYS_CHARGE,
    ACTION_VOTE_RUN, ACTION_VOTE_CAST, ACTION_VOTE_ASK, ACTION_FLOOR_NOW, ACTION_TRIAL_OBJECT, ACTION_TRIAL_EVIDENCE,
    ACTION_TRIAL_WITHDRAW, ACTION_FLOOR_REPOINT, ACTION_TRIAL_GM, ACTION_TRIAL_TURN, ACTION_TRIAL_CLAIM, ACTION_TRIAL_SIDE, ACTION_TRIAL_KEYWORD,
    ACTION_TRIAL_PRESENT, ACTION_READY_OPEN, ACTION_READY_ANSWER, ACTION_READY_END, ACTION_TRIAL_ENTER,
    ACTION_TRIAL_RECORD, ACTION_RESHAPE_RULING, ACTION_TRAIT_RULING, ACTION_HOPE_CALL, ACTION_CALL_YES,
    ACTION_RULING_EXPIRED, ACTION_RULING_RECEIVED, ACTION_DYNAMIC_ANSWER, ACTION_OBSERVE_TARGET, ACTION_OBSERVE_RESOLVE,
    ACTION_OBSERVE_PICK, ACTION_CLEANUP_TRACES, ACTION_ANALYZE_RESOLVE, ACTION_ADVANCEMENT, ACTION_ADVANCEMENT_OFFER,
    ACTION_ADVANCEMENT_ASK, ACTION_SHARE_BULLET, ACTION_GIVE_ITEM, ACTION_PASSAGE_SHARE, ACTION_PASSAGE_CROSS,
    ACTION_PASSAGE_FIND, ACTION_PASSAGE_LAIR_SEAL, ACTION_LAIR_LOCK, ACTION_REFUND_CROSSING, ACTION_VAULT_STEAL, ACTION_STEAL, ACTION_FIND_STASH, ACTION_PLANT,
    ACTION_FRISK_UNSEEN, ACTION_FRISK_ASK, ACTION_FRISK_ANSWER, ACTION_FRISK_FOLLOW, ACTION_CRISIS,
    ACTION_OPENING_RESULT, ACTION_CLEANUP, ACTION_BETRAYAL, ACTION_PARK_MURDER, ACTION_CUB_ABILITY, ACTION_CUB_ANSWER, ACTION_BRIBE_OFFER, ACTION_BRIBE_ANSWER, ACTION_LOOT,
    ACTION_NOTE_SAVE, ACTION_ROLL_BOOKMARK, ACTION_REROLL, ACTION_CARD, ACTION_CARD_CLAIM
} from "./bridge-wire.mjs";
import {
    handleObserveTarget, handleCleanupTraces, handleObserveResolve, handleAnalyzeResolve, handleAdvancement,
    handleAdvancementOffer, handleAdvancementAsk, handleShareBulletOrGiveItem, handlePassageShare, handlePassageCross,
    handleRefundCrossing, handlePassageFind, handlePassageLairSeal, handleLairLock, friskRolls, findPassageRoll, notFindPassageRoll, palmRolls, handlePlant,
    handleFindStash, handleSteal, handleFriskUnseen, handleFriskAsk, handleFriskAnswer, handleFriskFollow,
    friskForceRoll, handleVaultSteal, searchTheftOf, handleOpeningResult, handleCrisis, handleParkMurder,
    handleBetrayal, handleCleanup, handleCubAbility, handleCubAnswer, handleBribeOffer, handleBribeAnswer, handleHopeCall, handleCallYes, handleDynamicAnswer,
    handleRulingExpired, handleRulingReceived, handleDifficulty, handleTraitRuling
} from "./bridge-runs-acts.mjs";
import {
    handleProgress, handleShare, TRACE_OF_ROLL, handleRemnant, traceBandOf, progressOf, repairOf, handleTieTrace,
    handleRemnantEdit, sabotageAgain, handleSabotage, handleProjectChange, handleUnsabotage, handleSendback, handleLoot,
    handleArm, handleOverflowAdd, handleOverflowClear, handleDespairSet, handleDespairAll, handleDespairRoster,
    handleOverflowTake, handleOverflowCheck, handleDespair, handleEclipseMove, handleNoteSave, handleRollBookmark,
    handleReroll, handleAuditDecide, handleKeysCharge, handleTrialRecord, handleTrialEnter, handleVoteRun, handleBallot,
    handleBallotAsk, handleFloorNow, handleTrialObject, handleTrialEvidence, handleTrialWithdraw, handleFloorRepoint,
    handleTrialGm, handleTrialTurn, handleTrialClaim, handleTrialSide, handleTrialKeyword, handleReadyOpen, handleReadyAnswer, handleReadyEnd,
    handleTrialPresent, handleReshapeRuling, handleObservePick, handleCardClaim, handleCardPost
} from "./bridge-runs-records.mjs";

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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, declaration: as.raw, request: as.text }),
        run: handleObserveTarget,
        answer: "reply", patient: true, resend: true,
        claims: { declaration: "compared to DECLARATIONS by chooseObserveTarget (observe.mjs); an unknown one is answered with a reason, never used" }
    },
    [ACTION_CLEANUP_TRACES]: {
        label: "DRPG.Bridge.what.cleanup.traces",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, mine: as.bool }),
        run: handleCleanupTraces,
        answer: "reply", resend: true
    },
    [ACTION_OBSERVE_RESOLVE]: {
        label: "DRPG.Bridge.what.observe.resolve",
        guards: [knownSender, notSpectator("actorId"), guardUndoIsTheGms, owns("actorId", "sender does not own that character")],
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
        claims: { rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-pipeline.mjs): the sender's own row of that message, its character and an Observe" }
    },
    [ACTION_ANALYZE_RESOLVE]: {
        label: "DRPG.Bridge.what.analyze.resolve",
        guards: [knownSender, notSpectator("actorId"), guardUndoIsTheGms, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, itemId: as.id, total: as.num, isCritical: as.bool, undo: as.gmFlag, rollId: as.id }),
        run: handleAnalyzeResolve,
        answer: "reply",
        // An Analyze's roll, never one thrown as a Find Passage (`notFindPassageRoll`, E80 fix r1-G7).
        rolled: { field: "rollId", actor: "actorId", kind: "analyze", derive: notFindPassageRoll },
        claims: { itemId: "looked up on that one character by resolveAnalyze (analyze.mjs), never across the world",
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-pipeline.mjs): the sender's own row of that message, its character and an Analyze not thrown as a Find Passage (`notFindPassageRoll`)" }
    },
    [ACTION_ADVANCEMENT]: {
        label: "DRPG.Bridge.what.advancement.apply",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
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
        guards: [knownSender, senderNotSpectator, playersOnly("a GM asks for nothing here")],
        sanitize: pick({}),
        run: handleAdvancementAsk,
        answer: "none", quiet: true,
        why: "answers only about the sender's own characters, found from the id Foundry gives, and names none"
    },
    [ACTION_SHARE_BULLET]: handover("DRPG.Bridge.what.handover.bullet"),
    [ACTION_GIVE_ITEM]: handover("DRPG.Bridge.what.handover.item"),
    [ACTION_PASSAGE_SHARE]: {
        label: "DRPG.Bridge.what.passage.share",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character showing it")],
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
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
    /*
     * THE MASTERMIND'S DOOR (E91 C4, C5; D038, the owner's "Budujemy" of 12.11.2026). The Mastermind's player locks or
     * opens their own room with the GM's lock (mastermind.mjs `lockLair`, vault-store.mjs `writeRoomLock`) and seals a
     * passage at their door with the tab's close (passages-gm.mjs `sealLairPassage`), on the primary. The sender's own
     * student first; whether that student is the Mastermind and the sender the owner the door names
     * (`actsAsMastermind`), and the lair, are the GMs' record's, judged in the run; every refusal is "nothing was carried
     * out", so another player's ask learns nothing of the role. Tier 2 "D038 lair lock" and "D038 lair seal".
     */
    [ACTION_LAIR_LOCK]: {
        label: "DRPG.Bridge.what.mastermind.lairLock",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, lock: as.bool }),
        run: handleLairLock,
        // The Mastermind's line says the door is locked or open: a reply, or nothing changed.
        answer: "reply"
    },
    [ACTION_PASSAGE_LAIR_SEAL]: {
        label: "DRPG.Bridge.what.passage.lairSeal",
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, passageId: as.id }),
        run: handlePassageLairSeal,
        answer: "reply",
        claims: {
            passageId: "passages-gm.mjs sealLairPassage: an open passage of the GMs' records with a side in the lair the GMs' record names (`presetSideRefusal`), for the sender who acts as the Mastermind through the character (`actsAsMastermind`), on the primary"
        }
    },
    [ACTION_PASSAGE_FIND]: {
        label: "DRPG.Bridge.what.passage.find",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
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
        guards: [knownSender, notSpectator("plannerId"), owns("plannerId", "sender does not own the character planting")],
        sanitize: pick({ plannerId: as.id, victimId: as.id, itemId: as.id, total: as.num, isCritical: as.bool,
            unseenTotal: as.num, unseenCritical: as.bool, rollId: as.id, unseenRollId: as.id }),
        run: handlePlant,
        // "reply" since E14 part 1 C1 (the owner's Q3): the Palm's browser gives back the action it paid when the one
        // gate refused the Palm before its rolls were read, so it waits for the verdict, not for the "got it".
        answer: "reply",
        // Both of the Palm's rolls, each on the GMs' record of it (E08+E28 C15; `palmRolls`).
        rolled: palmRolls("plannerId"),
        claims: {
            victimId: "judged by plantOnPerson (palm.mjs), before the rolls are read, on the one gate (inventory.mjs transferRefusal, frisk.mjs personActionRefusal): a student in the planter's room as the GMs read both, no Monocub, Monokuma or hidden token, outside an Eclipse, a Class Trial and the planter's own incident; a body the GMs keep from the sender is planted on as a living one",
            itemId: "judged by plantOnPerson (palm.mjs): an item in the planter's own hands",
            rollId: "the hand's roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the planter's Palm",
            unseenRollId: "the unseen roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the planter's Palm"
        }
    },
    [ACTION_FRISK_UNSEEN]: {
        label: "DRPG.Bridge.what.action.friskUnseen",
        guards: [knownSender, notSpectator("searcherId"), owns("searcherId", "sender does not own the character searching")],
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
        guards: [knownSender, notSpectator("searcherId"), owns("searcherId", "sender does not own the character searching")],
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
        guards: [knownSender, notSpectator("searcherId"), owns("searcherId", "sender does not own the character searching")],
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, total: as.num, isCritical: as.bool, rollId: as.id }),
        run: handleFindStash,
        /* "reply" since E16 fix e1-G2 (26.10.2026; the review's E16p2-BEH-1 = E16R-04 = E16P2-R4): a Class Trial opened
           while the packet was in flight is refused here before the throw is read, and the asker gives the price back
           on that refusal (action-analyze.mjs `locateStash`; the owner's Q3 of 18.10 by analogy) - heard after its
           "got it" while the row was "ack", when `locateStash` had returned and the price stayed spent. */
        answer: "reply",
        // An Analyze's roll: a search for a hidden stash is one of the Analyze's roads (E08+E28 C14), and a roll thrown as
        // a Find Passage, another of them, settles none of it (`notFindPassageRoll`, E80 fix r1-G7).
        rolled: { field: "rollId", actor: "actorId", kind: "analyze", derive: notFindPassageRoll },
        claims: { rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the sender's character's Analyze, not thrown as a Find Passage (`notFindPassageRoll`)" }
    },
    [ACTION_STEAL]: {
        label: "DRPG.Bridge.what.action.steal",
        guards: [knownSender, notSpectator("thiefId"), owns("thiefId", "sender does not own the character stealing")],
        sanitize: pick({ thiefId: as.id, victimId: as.id, itemId: as.id, total: as.num, isCritical: as.bool,
            unseenTotal: as.num, unseenCritical: as.bool, rollId: as.id, unseenRollId: as.id }),
        run: handleSteal,
        // "reply" since E14 part 1 C1 (the owner's Q3): the Palm's browser gives back the action it paid when the one
        // gate refused the Palm before its rolls were read, so it waits for the verdict, not for the "got it".
        answer: "reply",
        rolled: palmRolls("thiefId"),
        claims: {
            victimId: "judged by stealFromPerson (palm.mjs), before the rolls are read, on the one gate (inventory.mjs transferRefusal, frisk.mjs personActionRefusal): a student in the thief's room as the GMs read both, no Monocub, Monokuma or hidden token, outside an Eclipse, a Class Trial and the thief's own incident; a body the GMs keep from the sender is robbed as a living one",
            itemId: "honoured by stealFromPerson (palm.mjs) only on a critical, and only if it is in the victim's pockets",
            rollId: "the hand's roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the thief's Palm",
            unseenRollId: "the unseen roll the result is read from (bridge-guards.mjs rollRefusal): one the GM drew for the thief's Palm"
        }
    },
    [ACTION_VAULT_STEAL]: {
        label: "DRPG.Bridge.what.vault.steal",
        guards: [knownSender, notSpectator("thiefId"), owns("thiefId", "sender does not own the character searching")],
        sanitize: pick({ thiefId: as.id, ownerId: as.id, itemId: as.id, viaSearch: as.bool, clumsy: as.bool, rollId: as.id }),
        run: handleVaultSteal,
        /* "reply" since E16 fix e1-G2 (26.10.2026; the review's E16p2-BEH-2 = E16R-03 = E16P2-R2): a Search that takes a
           Murder Weapon out of a stash leaves a Prep Remnant (E16 part 2 C4), and on "ack" it left one as the packet was
           accepted - for a thing a GM then refused (another reach took it first, full hands, an undecided item). The
           asker leaves it only on the answer's `taken` (`handleVaultSteal`, action-search.mjs `searchStash`). */
        answer: "reply",
        // A packet that says a Search paid for it names that Search's roll (E08+E28 C15; `searchTheftOf`).
        rolled: { field: "rollId", actor: "thiefId", kind: "search", when: "viaSearch", derive: searchTheftOf },
        claims: {
            ownerId: "judged by stealFromVault (stash-reach.mjs): the owner of a stash the thief can reach",
            itemId: "judged by stealFromVault (stash-reach.mjs): an item that owner has stashed",
            rollId: "the Search's roll whether it found the stash, and fumbled it, is read from (searchTheftOf): one the GM drew for the thief's Search"
        }
    },
    [ACTION_OPENING_RESULT]: {
        label: "DRPG.Bridge.what.murder.openingResult",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
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
        guards: [knownSender, notSpectator("actorId"), guardUndoIsTheGms, owns("actorId", "sender does not own that character"), guardCrisisAction, guardCrisisRoll],
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
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-pipeline.mjs): the sender's own row of that message, its character and a crisis action"
        }
    },
    [ACTION_PARK_MURDER]: {
        label: "DRPG.Bridge.what.murder.park",
        guards: [knownSender, notSpectator("killerId"), owns("killerId", "sender does not own that character")],
        sanitize: pick({ killerId: as.id, room: as.maybeText, note: as.text, proposed: as.maybeText }),
        run: handleParkMurder,
        answer: "reply"
    },
    [ACTION_BETRAYAL]: {
        label: "DRPG.Bridge.what.murder.betrayal",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, note: as.text, proposed: as.maybeText }),
        run: handleBetrayal,
        // Answered once carried out (E32 C5b): in an Eclipse the asker has paid an action
        // and needs to know whether the declaration was parked.
        answer: "reply"
    },
    [ACTION_CLEANUP]: {
        label: "DRPG.Bridge.what.murder.cleanup",
        guards: [knownSender, notSpectator("actorId"), guardUndoIsTheGms, owns("actorId", "sender does not own that character")],
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
            rollId: "the roll the result is read from (bridge-guards.mjs rollRefusal), and written on only by noteFactOfRoll (action-pipeline.mjs): the sender's own row of that message, its character and a clean-up"
        }
    },
    [ACTION_CUB_ABILITY]: {
        label: "DRPG.Bridge.what.monocub.ability",
        // `key` and `choice` are claims the guard holds to the table (a row, a Monocub, one of the row's choices).
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that Monocub"), guardCubAbility],
        // No total, critical or roll: the GM throws the row's dice itself (E08+E28 C17; monocub.mjs `cubAbilityOnGm`; R218).
        sanitize: pick({ actorId: as.id, key: as.text, targetId: as.id, choice: as.text }),
        run: handleCubAbility,
        // The roll it threw goes back, for the Monocub's card.
        answer: "reply",
        claims: { targetId: "judged by the row's CUB_TARGETS rule in cubAbilityOnGm (monocub.mjs) before the GM throws: a living student in the Monocub's room, or for Tinker (E72 C13) a public, unfinished, unfrozen project there that a living student worked on this time of day; an id that is neither is refused as a missing one" }
    },
    [ACTION_CUB_ANSWER]: {
        label: "DRPG.Bridge.what.monocub.answer",
        // E72 C6: the player of a dead student the GMs invited; whether an invitation is open is the GMs' row's (`cubStore`).
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, accept: as.bool }),
        run: handleCubAnswer,
        // The player's window says what came of it (a Monocub now, or the invitation closed).
        answer: "reply"
    },
    [ACTION_BRIBE_OFFER]: {
        label: "DRPG.Bridge.what.bribe.offer",
        // E72 C15: the payer is the sender's own student; the Monocub is judged in the run (`bribeRefusal`).
        guards: [knownSender, owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, cubId: as.id }),
        run: handleBribeOffer,
        // The payer's Call says it was offered, or nothing was spent.
        answer: "reply",
        claims: { cubId: "judged by monocub.mjs bribeRefusal in offerBribeOnGm before anything is written: a Monocub, not the payer" }
    },
    [ACTION_BRIBE_ANSWER]: {
        label: "DRPG.Bridge.what.bribe.answer",
        // E72 C15: the Monocub's own player; the offer is the GMs' row's (`cubStore`'s `bribes`), never the packet's.
        guards: [knownSender, owns("cubId", "sender does not own that Monocub")],
        sanitize: pick({ cubId: as.id, bribeId: as.id, accept: as.bool }),
        run: handleBribeAnswer,
        // The Monocub's window says what came of it.
        answer: "reply",
        claims: { bribeId: "judged by monocub.mjs answerBribeOnGm: an offer open in the GMs' row of that Monocub, never the packet's" }
    },
    [ACTION_HOPE_CALL]: {
        label: "DRPG.Bridge.what.call.approve",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
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
            asker: "yesOnPrimary (call-gm.mjs) keeps a yes only for an ask this primary holds under that request, made by that user",
            messageId: "yesOnPrimary (call-gm.mjs) keeps a yes only when the card pressed is the card the ask is held on"
        }
    },
    [ACTION_DIFFICULTY]: {
        label: "DRPG.Bridge.what.dynamic.difficulty",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
        sanitize: pick({ actorId: as.id, description: as.text, actorName: as.text, room: as.maybeText, proposed: as.maybeText }),
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
            asker: "dynamicOnPrimary (call-gm.mjs) keeps a ruling on its card and sends it on only for a Dynamic ask this primary holds under that request, made by that user",
            messageId: "dynamicOnPrimary (call-gm.mjs) keeps and sends on a ruling only when the card pressed is the card the ask is held on"
        }
    },
    [ACTION_RULING_EXPIRED]: {
        label: "DRPG.Bridge.what.ruling.expired",
        guards: [knownSender],
        sanitize: pick({ rid: as.text }),
        run: handleRulingExpired,
        answer: "none", quiet: true,
        claims: { rid: "expiredOnPrimary (call-gm.mjs) ends only an ask this primary holds or answered under that id, asked by the sender - a card's, or an open Frisk's (frisk.mjs expireFriskAsk: an unanswered one only once the sender's wait could have run out, an answered one as its 'Leave it')" }
    },
    [ACTION_RULING_RECEIVED]: {
        label: "DRPG.Bridge.what.ruling.received",
        guards: [knownSender],
        sanitize: pick({ rid: as.text }),
        run: handleRulingReceived,
        answer: "none", quiet: true,
        claims: { rid: "receivedOnPrimary (call-gm.mjs) writes only a ruling this primary sent under that id to the sender - a card's, or an open Frisk's answer that left its force open (frisk.mjs receivedFriskAsk: the ask held under that id, asked by the sender, waiting for its receipt)" }
    },
    /*
     * THE GM PICKS THE STATISTIC (E32+E07 C11b, 02.10.2026; audit S04-23). Judged on
     * the world, not the packet: `guardTraitRuling` holds the definition named to
     * one that lists several traits, and the character to one who may take it now.
     * No trait travels: the card's come from this GM's config (trait-ruling.mjs).
     */
    [ACTION_TRAIT_RULING]: {
        label: "DRPG.Bridge.what.trait.ruling",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character"), guardTraitRuling],
        // E68 C1 (DA18): the player's proposal and their words; the guard holds the one to the list, the other to its length.
        sanitize: pick({ actorId: as.id, kind: as.text, key: as.text, variant: as.maybeText, proposed: as.maybeText, note: as.maybeText }),
        run: handleTraitRuling,
        answer: "reply", patient: true, resend: true, timeoutMs: TIMING.rulingMs
    },
    [ACTION_PROGRESS]: {
        label: "DRPG.Bridge.what.project.progress",
        guards: [
            knownSender, notSpectator("actorId"),
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
            relief: "the roller's word for its readied tool, held by progressOf to the tools the GM sees on the character (action-project.mjs projectExtrasHeld)",
            bonus: "the roller's word for an indirect murder's concealment, held by progressOf to [0, PROJECT_BONUS_MOST] on an indirect murder, on any outcome, and to 0 on any other project (projectExtrasHeld)" }
    },
    [ACTION_SHARE]: {
        label: "DRPG.Bridge.what.project.share",
        guards: [
            knownSender, senderNotSpectator,
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
        guards: [knownSender, notSpectator(payload => payload?.data?.sourceActor, ["data"]), ownsActorAt(payload => payload?.data?.sourceActor, "sender does not own the character leaving it", ["data"])],
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
            rollId: "the roll a Search's, Sabotage's or Dynamic action's trace takes its band from (traceBandOf), and written on only by noteFactOfRoll (action-pipeline.mjs): the sender's own row of that message, its character and an action that owns a trace" }
    },
    [ACTION_TIE_TRACE]: {
        label: "DRPG.Bridge.what.remnant.tieForItem",
        guards: [knownSender, senderNotSpectator, guardTieTraceHolder],
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
            knownSender, notSpectator("actorId"),
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
        claims: { rollId: "the roll whose record the repair is read from (repairOf), and written on only by noteFactOfRoll (action-pipeline.mjs): the sender's own Sabotage row of that message",
            penalty: "the roller's word for its concealment, held by repairOf to [SABOTAGE_CONCEAL.despairPenalty, 0] (action-project.mjs sabotageExtrasHeld)",
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
        guards: [knownSender, notSpectator(tokenActorOf, ["sceneId", "tokenId"]), ownsActorAt(tokenActorOf, "sender does not own that token", ["sceneId", "tokenId"]), guardSendbackPlace],
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
        guards: [knownSender, notSpectator("takerId"), owns("takerId", "sender does not own the character doing the taking")],
        // E68 C10: several items under one Take (`itemIds`, the run keeps the ids among them), and the Take's Hand roll
        // with the cover's Shadow roll, thrown only where the taker's browser saw a student watching (`coverRollId`).
        sanitize: pick({ takerId: as.id, bodyId: as.id, itemId: as.id, itemIds: as.raw, rollId: as.id, total: as.num,
            isCritical: as.bool, withHope: as.bool, coverRollId: as.id, coverTotal: as.num, coverCritical: as.bool, coverHope: as.bool }),
        run: handleLoot,
        answer: "reply",
        // Both rolls on the GMs' record of each (E68 C10; Palm's `palmRolls` the model): the Hand when the packet names one,
        // and the cover when it names one, each drawn for this body (`named`, roll-draw.mjs `lootDrawRefusal`). Since the
        // loot bind what a player's Take counts is the first of each drawn for the taker and the body since their last Take
        // of it (handover.mjs `lootRollsBound`, `handleLoot`): a Take that names no Hand reads the one bound, refused with none.
        rolled: [
            { field: "rollId", actor: "takerId", kind: "loot", when: "rollId", named: { body: "bodyId" } },
            { field: "coverRollId", actor: "takerId", kind: "lootCover", when: "coverRollId", named: { body: "bodyId" },
                into: { total: "coverTotal", isCritical: "coverCritical", withHope: "coverHope" } }
        ],
        // Where the taker stands is asked since E14 part 1 C1 (audit S08-01, S11-06): until then it was not (the E31
        // design's map of the GM side, row 30), and a body across the school was looted from a bedroom.
        claims: {
            bodyId: "lootBody (handover.mjs) on the one gate (inventory.mjs transferRefusal, mode loot; frisk.mjs personActionRefusal with { body: true }): a dead body whose death the sender knows, not hidden where it lies (its tile, or its token when it has none: body-tile.mjs bodyPlaceOf), in the room the GMs read the taker in, a living taker that is not the body, outside an Eclipse and a Class Trial; an unknown death is refused as a living body is",
            itemId: "lootBody (handover.mjs) takes only an item on that body that is not a Truth Bullet",
            itemIds: "lootBody (handover.mjs), each as itemId is, at most LOOT_MOST",
            rollId: "a Hand roll the GM drew for the taker's Take of this body (bridge-guards.mjs rollRefusal); a player's Take counts the first one drawn for that taker and body since their last Take of it, named or not (handleLoot, handover.mjs lootRollsBound), and is refused with none",
            coverRollId: "a Shadow roll the GM drew for the taker's Take of this body (bridge-guards.mjs rollRefusal); a player's Take counts the first one drawn for that taker and body since their last Take of it (handleLoot)"
        }
    },
    [ACTION_ARM]: {
        label: "DRPG.Bridge.what.call.arm",
        guards: [
            // Refused out loud, and before the sender is, as the handler asked it.
            guardArmCharacter,
            knownSender, notSpectator(armBuyerId),
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
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
       adds a claim (action-pipeline.mjs `tellGmsOfRoll`): a report nobody waits on, so a refusal
       is the GM's log line. The roll's own numbers are read off the message on the GM. Since
       C5 it also names the card the roll was reported on, which a Reroll marks. */
    [ACTION_ROLL_BOOKMARK]: {
        label: "DRPG.Bridge.what.roll.bookmark",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character"), guardRollAuthor],
        sanitize: pick({ actorId: as.id, messageId: as.id, actionKey: as.maybeText, trait: as.maybeText, experiences: as.raw, context: as.raw,
            reportMessageId: as.id }),
        run: handleRollBookmark,
        answer: "none", quiet: true,
        claims: {
            messageId: guardRollAuthor,
            experiences: "the roller's own sheet's: keepGmBookmark (action-pipeline.mjs) keeps up to twelve short strings",
            context: "picked per action by rollClaims (action-pipeline.mjs ROLL_CLAIMS): what the roller alone saw; a Reroll's replay judges anything it writes beyond the roller's own sheet",
            reportMessageId: "kept only when reportCardOf (action-pipeline.mjs) finds a module card of the sender's, no older than the roll and under a minute old; a Reroll only marks it"
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own that character")],
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
     * sentence are asked here (trial-progress.mjs `setTrialProgress`, `resetTrialProgress`, `executeAtExit`, `clearSentence`) and
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
            patch: "a GM's patch of the trial's record, held on the primary to the record's own fields (trial-progress.mjs recordPatchOf, RECORD_FIELDS): never the chapter, the trial's list of the dead or the Objections' receipts; a GM's request only"
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
        guards: [knownSender, senderNotSpectator, playersOnly("a GM casts no ballot")],
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
        guards: [knownSender, senderNotSpectator, playersOnly("a GM asks for nothing here")],
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character objecting")],
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character objecting")],
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character objecting")],
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
                "closingResume", "reveal", "straw", "dive", "scrum", "zoneCount", "zoneSkipQuestion"),
            seconds: as.num, actorId: as.id, targetId: as.id, messageId: as.id, text: as.text, order: as.text,
            // Monokuma's Reveal (E70 C9): the row of missingKeys() a GM reveals, and past the fee's count when confirmed.
            slot: as.text, beyondPaid: as.bool,
            // The zone modes (E73): the two answers and a Scrum's thesis (the question is `text`), a Logic Dive's set and
            // the question it starts at (-1 where it stopped).
            a: as.text, b: as.text, thesis: as.text, set: as.text, from: as.num
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character speaking")],
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character volunteering")],
        sanitize: pick({ actorId: as.id }),
        run: handleTrialClaim,
        answer: "reply"
    },
    /*
     * A SIDE PICKED FROM THE WINDOW (E73 C2, 12.11.2026; the plan's "a participant with no token in the hall gets a
     * side-pick window"). The owner of a student taking part, with no token of theirs in the hall, stands in Zone A or
     * Zone B by a pick (trial-zones.mjs `sideOnPrimary`): a zone mode on the floor, the character taking part, no hall
     * token; the pick kept on the floor (`zone.picks`), where every browser's count reads it. "reply": the window says
     * the side is taken. A Spectator's character is refused first (`notSpectator`, E92 Q-E92-7, R3865), as on every
     * row a player sends; put on this row and the thesis's below when main's E73 met E92 in the 1.2.109 line.
     */
    [ACTION_TRIAL_SIDE]: {
        label: "DRPG.Bridge.what.trial.side",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character picking a side")],
        sanitize: pick({ actorId: as.id, side: as.oneOf("a", "b") }),
        run: handleTrialSide,
        answer: "reply"
    },
    /*
     * A SCRUM SPEAKER'S THESIS (E73 C5; the audit's `trialKeyword`): the speaker of the running turn posts a short thesis
     * of their camp, judged on the primary (trial-zones.mjs `thesisOnPrimary`): Scrum Debate's turn, the character its
     * speaker, the text cut to `TRIAL.modes.zones.scrum.thesisLength`; posted as the mode's card by the primary.
     */
    [ACTION_TRIAL_KEYWORD]: {
        label: "DRPG.Bridge.what.trial.keyword",
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the speaking character")],
        sanitize: pick({ actorId: as.id, text: as.text }),
        run: handleTrialKeyword,
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
        guards: [knownSender, notSpectator("actorId"), owns("actorId", "sender does not own the character presenting")],
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
        guards: [knownSender, senderNotSpectator],
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
        guards: [knownSender, senderNotSpectator, guardCardSpeaker, guardCardReaders],
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
        guards: [knownSender, notSpectator("fromId"), owns("fromId", "sender does not own the character giving it away")],
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
export function onSocket(payload, senderId) {
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
export function ask(action, payload, opts = {}) {
    const decl = BRIDGE_ACTIONS[action];
    return bridgeRequest(action, payload, {
        settle: decl.answer, patient: Boolean(decl.patient), resend: Boolean(decl.resend), quiet: Boolean(decl.quiet),
        ...(decl.timeoutMs ? { timeoutMs: decl.timeoutMs } : {}),
        ...opts
    });
}
