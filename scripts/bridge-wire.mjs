/**
 * Danganronpa RPG - the bridge's wire names.
 * ---------------------------------------------------------------------------
 * The module's socket name (`SOCKET_EVENT`, `module.<id>`) and every wire
 * name of the bridge as an `ACTION_` constant, `domain.verb`, each with its
 * comment: the player -> GM requests of BRIDGE_ACTIONS, the GM -> primary GM
 * ones, and the GM -> player packets (`ACTION_OPENING_ASK`,
 * `ACTION_ADVANCEMENT_OFFERS`, `ACTION_DONE`, `ACTION_GM_READY` ...).
 *
 * WHERE IT SITS. Moved out of gm-bridge.mjs by E41 C5a (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. A leaf: it imports
 * config.mjs's `MODULE_ID` and nothing else. The names stand here and not
 * beside the table because the table's file imports every run, while the
 * runs, the ask cards' primary-side senders and the asks read the names:
 * beside the table they would make table -> run -> table a cycle. None of
 * them was exported before; each is exported now for those readers, and
 * gm-bridge.mjs re-exports none of them.
 */

import { MODULE_ID } from "./config.mjs";

export const SOCKET_EVENT = `module.${MODULE_ID}`;
export const ACTION_PROGRESS = "project.progress";
export const ACTION_SHARE = "project.share";
export const ACTION_REMNANT = "remnant.place";
/* The weapon was swung on the player's client; the ledger that records
   which trace handed it over is the GM's. See `tieTraceForItem`. */
export const ACTION_TIE_TRACE = "remnant.tieForItem";
export const ACTION_REMNANT_EDIT = "remnant.edit";
export const ACTION_SABOTAGE = "project.sabotage";
export const ACTION_UNSABOTAGE = "project.unsabotage";
/** GM -> primary GM: one change of a project, made in the primary's queue (E36 C1; projects.mjs `applyProjectChange`). */
export const ACTION_PROJECT_CHANGE = "project.change";
export const ACTION_SENDBACK = "token.sendBack";
export const ACTION_ECLIPSE_MOVE = "eclipse.move";
export const ACTION_ARM = "call.arm";
export const ACTION_DESPAIR = "despair.adjust";
/** GM -> primary GM: add to the overflow's count (E17 C5) - see overflow.mjs `addOverflow`. */
export const ACTION_OVERFLOW_ADD = "overflow.add";
/** GM -> primary GM: a GM's Clear of the overflow's count (H84-06) - see overflow.mjs `clearOverflowAsGm`. */
export const ACTION_OVERFLOW_CLEAR = "overflow.clear";
/** GM -> primary GM: one pool set to a number (E37 C7; despair.mjs `setDespair`). */
export const ACTION_DESPAIR_SET = "despair.set";
/** GM -> primary GM: every pool filled or emptied (E37 C7; despair.mjs `fillAllDespair`, `zeroAllDespair`). */
export const ACTION_DESPAIR_ALL = "despair.all";
/** GM -> primary GM: a pool granted, revoked or named (E37 C7; despair.mjs `addPool`, `removePool`, `setPoolLabel`). */
export const ACTION_DESPAIR_ROSTER = "despair.roster";
/** GM -> primary GM: Despair taken off the overflow's count (E37 C7; overflow.mjs `takeOverflow`). */
export const ACTION_OVERFLOW_TAKE = "overflow.take";
/** GM -> primary GM: the overflow checked at a boundary (E37 C7; overflow.mjs `checkOverflow`). */
export const ACTION_OVERFLOW_CHECK = "overflow.check";
export const ACTION_DIFFICULTY = "dynamic.difficulty";
/** GM -> primary GM: Undo or Keep on the GMs' card of a player's write (E29 C5; sheet-audit.mjs). */
export const ACTION_AUDIT_DECIDE = "audit.decide";
/** GM -> primary GM: charge the Key fee as a Class Trial opens (E09 fix r1-G3; investigation.mjs `askToChargeForUnfoundKeys`). */
export const ACTION_KEYS_CHARGE = "keys.charge";
/** GM -> primary GM: a step of the vote - open, close, restart, resend or remind (E10 C1; vote.mjs `runVoteOp`). */
export const ACTION_VOTE_RUN = "vote.run";
/** player -> primary GM: a ballot (E10 C2; vote.mjs `sendBallot`, `recordBallot`). */
export const ACTION_VOTE_CAST = "vote.cast";
/** player -> primary GM: this player's own ballot, while a vote is open (E10 C2; vote.mjs `askForBallot`, `ballotFor`). */
export const ACTION_VOTE_ASK = "vote.ask";
/** GM -> primary GM: the GM's Now on the trial's floor (E10 fix r2-G6; trial-floor.mjs `advanceFloorNow`). */
export const ACTION_FLOOR_NOW = "floor.now";
/** player -> primary GM: OBJECTION!, aimed at whoever speaks, pending its Truth Bullet (E79 C16; trial.mjs `objectOnPrimary`). */
export const ACTION_TRIAL_OBJECT = "trial.object";
/** player -> primary GM: the Truth Bullet for that pending Objection (E79 C16; trial.mjs `evidenceOnPrimary`). */
export const ACTION_TRIAL_EVIDENCE = "trial.evidence";
/** player -> primary GM: that pending Objection taken back, its picker closed (E79 fix r4-G2; trial.mjs `withdrawOnPrimary`). */
export const ACTION_TRIAL_WITHDRAW = "trial.withdraw";
/** GM -> primary GM: the running Objection aimed at somebody else, from the trial console (E79 C16; trial.mjs `repointOnPrimary`). */
export const ACTION_FLOOR_REPOINT = "floor.repoint";
/** GM -> primary GM: a GM's change of the trial's floor, run in the floor's step there (E70 C0; trial-floor.mjs `floorStep`). */
export const ACTION_TRIAL_GM = "trial.gm";
// A round's step from a participant's browser (E70 C7): the speaker's Done or Pass, anyone's step over once it is due.
export const ACTION_TRIAL_TURN = "trial.turn";
// A participant volunteering for the Closing Argument (E70 C8): the name kept by the GMs alone.
export const ACTION_TRIAL_CLAIM = "trial.claim";
// A Present posted by the primary with a copy as shown to every other participant (E70 C10; trial.mjs `presentOnPrimary`).
export const ACTION_TRIAL_PRESENT = "trial.present";
/** GM -> primary GM: open the readiness round before the clock moves (E37 C3; boundary.mjs `openRoundOnPrimary`). */
export const ACTION_READY_OPEN = "ready.open";
/** player -> primary GM: this player's Done or One moment in the open round (E37 C3; boundary.mjs `answerOnPrimary`). */
export const ACTION_READY_ANSWER = "ready.answer";
/** GM -> primary GM: the round ended, the GM going on or stopping it (E37 C3; boundary.mjs `endRoundOnPrimary`). */
export const ACTION_READY_END = "ready.end";
/** GM -> primary GM: the trial's voices settled to the clock - its dead listed and muted, or given back (E70 C5; voice.mjs `askTrialVoices`). */
export const ACTION_TRIAL_ENTER = "trial.enter";
/** GM -> primary GM: a write of the trial's record - a patch, the reset at the entry, the sentence carried out or taken back (E70 fix p1-G2; trial-progress.mjs `recordOnPrimary`). */
export const ACTION_TRIAL_RECORD = "trial.record";
/** GM -> primary GM: Approve or Decline on a reshape card (E09 C10; cleanup.mjs `ruleReshape`, `askReshapeRuling`). */
export const ACTION_RESHAPE_RULING = "cleanup.ruling";
/** player -> GM: "which of this roll's statistics?" (E32+E07 C11b; trait-ruling.mjs). */
export const ACTION_TRAIT_RULING = "trait.ruling";
/** player -> GM: "may I spend this Call, and here is what for". */
export const ACTION_HOPE_CALL = "call.approve";
/** GM -> primary GM: a GM's yes on that card, kept for the arm it allows (E29 fix r2-H4; `answerHopeCall`). */
export const ACTION_CALL_YES = "call.yes";
/** player -> primary GM: the clock of a ruling asked from a card ran out on the asker's browser (E18 C1; `expiredOnPrimary`). */
export const ACTION_RULING_EXPIRED = "ruling.expired";
/** player -> primary GM: the ruling sent on from the primary reached the asker (E18 C1; `receivedOnPrimary`). */
export const ACTION_RULING_RECEIVED = "ruling.received";
/** GM -> primary GM: a GM's difficulty or refusal on a Dynamic action's card, sent on by the primary (E18 C1; `answerDynamic`). */
export const ACTION_DYNAMIC_ANSWER = "dynamic.answer";
export const ACTION_OBSERVE_TARGET = "observe.target";
export const ACTION_OBSERVE_RESOLVE = "observe.resolve";
/** GM -> primary GM: a GM's pick or refusal on an Observe card (E09 C12; observe.mjs `pickFromCard`, `askObservePick`). */
export const ACTION_OBSERVE_PICK = "observe.pick";
export const ACTION_CLEANUP_TRACES = "cleanup.traces";
export const ACTION_ANALYZE_RESOLVE = "analyze.resolve";
/* N-2: the player picked their own Level Up and the GM's client writes it. */
export const ACTION_ADVANCEMENT = "advancement.apply";
/* ...and where the offer itself lives: a GM asks the primary to record or withdraw
   one, an owner asks the primary for theirs, and the primary answers with the set.
   See "WHERE AN OFFER LIVES" in level-up.mjs. */
export const ACTION_ADVANCEMENT_OFFER = "advancement.offer";
export const ACTION_ADVANCEMENT_ASK = "advancement.ask";
export const ACTION_ADVANCEMENT_OFFERS = "advancement.offers";
export const ACTION_SHARE_BULLET = "handover.bullet";
export const ACTION_GIVE_ITEM = "handover.item";
/** player -> GM: my character shows a secret passage it knows to a student beside it (E79 C7) - see passages-gm.mjs `sharePassage`. */
export const ACTION_PASSAGE_SHARE = "passage.share";
/** player -> GM: my character at a tunnel's end goes through it (E80 C2) - see passages-gm.mjs `crossTunnel`. */
export const ACTION_PASSAGE_CROSS = "passage.cross";
/** player -> GM: the Mastermind seals a passage at their own door (E91 C5, D038) - see passages-gm.mjs `sealLairPassage`. */
export const ACTION_PASSAGE_LAIR_SEAL = "passage.lairSeal";
/** player -> GM: the Mastermind locks or opens their own room, with the GM's lock (E91 C4, D038) - see mastermind.mjs `lockLair`. */
export const ACTION_LAIR_LOCK = "mastermind.lairLock";
/** player -> GM: my character's Analyze was a Find Passage (E80 C3) - see passages-gm.mjs `resolvePassageSearch`. */
export const ACTION_PASSAGE_FIND = "passage.find";
/** GM -> primary GM: give back a character's last crossing, its price and its token (E17 C3) - see movement.mjs `refundLastCrossing`. */
export const ACTION_REFUND_CROSSING = "token.refundCrossing";
export const ACTION_VAULT_STEAL = "vault.steal";
export const ACTION_STEAL = "action.steal";
export const ACTION_FIND_STASH = "vault.findStash";
export const ACTION_PLANT = "action.plant";
/** player -> GM: my character went through a student's pockets unseen (E80 part 2 C2) - see frisk.mjs `friskPerson`. */
export const ACTION_FRISK_UNSEEN = "action.friskUnseen";
/** player -> GM: my character asks a student to turn out their pockets (E80 part 2 C3) - see frisk.mjs `askToFrisk`. */
export const ACTION_FRISK_ASK = "action.friskAsk";
/** player -> GM: my answer to that ask, for a character I answer for - see frisk.mjs `answerFrisk`. */
export const ACTION_FRISK_ANSWER = "action.friskAnswer";
/** player -> GM: after a refusal or no answer, my character forces it or leaves it - see frisk.mjs `followFrisk`. */
export const ACTION_FRISK_FOLLOW = "action.friskFollow";
export const ACTION_CRISIS = "murder.crisis";
/** GM -> player: "Stage 4 is yours to throw." */
export const ACTION_OPENING_ASK = "murder.openingAsk";
export const ACTION_OPENING_CANCEL = "murder.openingCancel";
/** player -> GM: what it came up. */
export const ACTION_OPENING_RESULT = "murder.openingResult";
export const ACTION_CLEANUP = "murder.cleanup";
export const ACTION_BETRAYAL = "murder.betrayal";
export const ACTION_PARK_MURDER = "murder.park";
/** player -> GM: a Monocub uses the ability under `key` (E33 C10) - see monocub.mjs `cubAbilityOnGm`. */
export const ACTION_CUB_ABILITY = "monocub.ability";
/** player -> GM: a dead student's player answers the GMs' invitation to become a Monocub (E72 C6) - see monocub.mjs `answerMonocubOffer`. */
export const ACTION_CUB_ANSWER = "monocub.answer";
/** player -> GM: a living student offers a Monocub a Bribe (E72 C15) - see monocub.mjs `offerBribeOnGm`. */
export const ACTION_BRIBE_OFFER = "bribe.offer";
/** player -> GM: a Monocub's player answers a Bribe (E72 C15) - see monocub.mjs `answerBribeOnGm`. */
export const ACTION_BRIBE_ANSWER = "bribe.answer";
/** GM -> player: a request carried out, with its answer - see `bridgeRequest` in bridge-guards.mjs. */
export const ACTION_DONE = "bridge.done";
/** A GM's world has finished loading - see `registerGmBridge`. */
export const ACTION_GM_READY = "bridge.gmReady";
export const ACTION_LOOT = "body.loot";
export const ACTION_NOTE_SAVE = "note.save";
export const ACTION_ROLL_BOOKMARK = "roll.bookmark";
/** player -> GM: make my character's Reroll (E08+E28 C4a) - see reroll.mjs `rerollOnGm`. */
export const ACTION_REROLL = "reroll.ask";
/** player -> GM: post the private card my browser would post while an incident runs (E08+E28 fix r2-H5) - see secret.mjs `askGm`. */
export const ACTION_CARD = "card.post";
/** GM -> primary GM: a GM's click on a card to the GMs, claimed before it rules and marked ruled after (E18 C3; `claimCard`). */
export const ACTION_CARD_CLAIM = "card.claim";
