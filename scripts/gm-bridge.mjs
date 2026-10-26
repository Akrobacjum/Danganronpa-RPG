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
 */

import {
    MODULE_ID, TRAITS, HOPE_CALLS, DESPAIR_CALLS, STARTING, PROJECT_SCALE, TIMING,
    LEVEL_UP, LEVEL_UP_OPTIONS, ACTIONS, DYNAMIC_THRESHOLDS
} from "./config.mjs";
import { announce, whisperToGms, whisperToOwner, ownerOf, isPrimaryGm, primaryGmId, dialogContent, debug, warn, error, cardHead, esc, serverNow } from "./utils.mjs";
import {
    firstRefusal, guardUndoIsTheGms, guardCrisisAction, guardCrisisRoll, guardShareSecret,
    guardShareGuest, guardTieTraceHolder, guardSendbackPlace, armBuyerId, guardArmCharacter, guardArmPlayerCall, guardCubAbility,
    guardArmCallGrants, guardArmLiving, guardArmNotHeld, guardArmBuyer, guardArmOtherCharacter, guardArmHopeCallAllowed,
    guardArmBuyerHope, guardArmGmYes, noteCallYes, forgetCallYes, guardDespairDelta, guardDespairPool, guardTraitRuling, guardRollAuthor, guardCallProgress, guardProjectFrozen,
    guardProjectRoom, guardSabotageRoom, guardCardSpeaker, guardCardReaders, table, tokenActorOf, remnantSourceOf, knownSender, owns, ownsActorAt, gmOnly,
    playersOnly, canSeeProject, inRange, as, pick, judge, replyForMe, bridgeRequest, resendOnGmReady, sayNotDone, reasonOf, gmOnline
} from "./bridge-guards.mjs";
// R148 and anything else that asked gm-bridge.mjs for it keep finding it here (E31).
export { removalRefusal } from "./bridge-guards.mjs";

import { contentOf, cardFlag, cardMeta, cardWriter } from "./secret.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_PROGRESS = "project.progress";
const ACTION_SHARE = "project.share";
const ACTION_REMNANT = "remnant.place";
/* The weapon was swung on the player's client; the ledger that records
   which trace handed it over is the GM's. See `tieTraceForItem`. */
const ACTION_TIE_TRACE = "remnant.tieForItem";
const ACTION_REMNANT_EDIT = "remnant.edit";
const ACTION_SABOTAGE = "project.sabotage";
const ACTION_UNSABOTAGE = "project.unsabotage";
/** GM -> primary GM: one change of a project, made in the primary's queue (E36 C1; projects.mjs `applyProjectChange`). */
const ACTION_PROJECT_CHANGE = "project.change";
const ACTION_SENDBACK = "token.sendBack";
const ACTION_ECLIPSE_MOVE = "eclipse.move";
const ACTION_ARM = "call.arm";
const ACTION_DESPAIR = "despair.adjust";
/** GM -> primary GM: add to the overflow's count (E17 C5) - see overflow.mjs `addOverflow`. */
const ACTION_OVERFLOW_ADD = "overflow.add";
const ACTION_DIFFICULTY = "dynamic.difficulty";
/** GM -> primary GM: Undo or Keep on the GMs' card of a player's write (E29 C5; sheet-audit.mjs). */
const ACTION_AUDIT_DECIDE = "audit.decide";
/** GM -> primary GM: charge the Key fee as a Class Trial opens (E09 fix r1-G3; investigation.mjs `askToChargeForUnfoundKeys`). */
const ACTION_KEYS_CHARGE = "keys.charge";
/** GM -> primary GM: a step of the vote - open, close, restart, resend or remind (E10 C1; vote.mjs `runVoteOp`). */
const ACTION_VOTE_RUN = "vote.run";
/** player -> primary GM: a ballot (E10 C2; vote.mjs `sendBallot`, `recordBallot`). */
const ACTION_VOTE_CAST = "vote.cast";
/** player -> primary GM: this player's own ballot, while a vote is open (E10 C2; vote.mjs `askForBallot`, `ballotFor`). */
const ACTION_VOTE_ASK = "vote.ask";
/** GM -> primary GM: the GM's Now on the trial's floor (E10 fix r2-G6; trial-floor.mjs `advanceFloorNow`). */
const ACTION_FLOOR_NOW = "floor.now";
/** player -> primary GM: OBJECTION!, aimed at whoever speaks, pending its Truth Bullet (E79 C16; trial.mjs `objectOnPrimary`). */
const ACTION_TRIAL_OBJECT = "trial.object";
/** player -> primary GM: the Truth Bullet for that pending Objection (E79 C16; trial.mjs `evidenceOnPrimary`). */
const ACTION_TRIAL_EVIDENCE = "trial.evidence";
/** player -> primary GM: that pending Objection taken back, its picker closed (E79 fix r4-G2; trial.mjs `withdrawOnPrimary`). */
const ACTION_TRIAL_WITHDRAW = "trial.withdraw";
/** GM -> primary GM: the running Objection aimed at somebody else, from the trial console (E79 C16; trial.mjs `repointOnPrimary`). */
const ACTION_FLOOR_REPOINT = "floor.repoint";
/** GM -> primary GM: Approve or Decline on a reshape card (E09 C10; cleanup.mjs `ruleReshape`, `askReshapeRuling`). */
const ACTION_RESHAPE_RULING = "cleanup.ruling";
/** player -> GM: "which of this roll's statistics?" (E32+E07 C11b; trait-ruling.mjs). */
const ACTION_TRAIT_RULING = "trait.ruling";
/** player -> GM: "may I spend this Call, and here is what for". */
const ACTION_HOPE_CALL = "call.approve";
/** GM -> primary GM: a GM's yes on that card, kept for the arm it allows (E29 fix r2-H4; `answerHopeCall`). */
const ACTION_CALL_YES = "call.yes";
/** player -> primary GM: the clock of a ruling asked from a card ran out on the asker's browser (E18 C1; `expiredOnPrimary`). */
const ACTION_RULING_EXPIRED = "ruling.expired";
/** player -> primary GM: the ruling sent on from the primary reached the asker (E18 C1; `receivedOnPrimary`). */
const ACTION_RULING_RECEIVED = "ruling.received";
/** GM -> primary GM: a GM's difficulty or refusal on a Dynamic action's card, sent on by the primary (E18 C1; `answerDynamic`). */
const ACTION_DYNAMIC_ANSWER = "dynamic.answer";
const ACTION_OBSERVE_TARGET = "observe.target";
const ACTION_OBSERVE_RESOLVE = "observe.resolve";
/** GM -> primary GM: a GM's pick or refusal on an Observe card (E09 C12; observe.mjs `pickFromCard`, `askObservePick`). */
const ACTION_OBSERVE_PICK = "observe.pick";
const ACTION_CLEANUP_TRACES = "cleanup.traces";
const ACTION_ANALYZE_RESOLVE = "analyze.resolve";
/* N-2: the player picked their own Level Up and the GM's client writes it. */
const ACTION_ADVANCEMENT = "advancement.apply";
/* ...and where the offer itself lives: a GM asks the primary to record or withdraw
   one, an owner asks the primary for theirs, and the primary answers with the set.
   See "WHERE AN OFFER LIVES" in level-up.mjs. */
const ACTION_ADVANCEMENT_OFFER = "advancement.offer";
const ACTION_ADVANCEMENT_ASK = "advancement.ask";
const ACTION_ADVANCEMENT_OFFERS = "advancement.offers";
const ACTION_SHARE_BULLET = "handover.bullet";
const ACTION_GIVE_ITEM = "handover.item";
/** player -> GM: my character shows a secret passage it knows to a student beside it (E79 C7) - see passages-gm.mjs `sharePassage`. */
const ACTION_PASSAGE_SHARE = "passage.share";
/** player -> GM: my character at a tunnel's end goes through it (E80 C2) - see passages-gm.mjs `crossTunnel`. */
const ACTION_PASSAGE_CROSS = "passage.cross";
/** player -> GM: my character's Analyze was a Find Passage (E80 C3) - see passages-gm.mjs `resolvePassageSearch`. */
const ACTION_PASSAGE_FIND = "passage.find";
/** GM -> primary GM: give back a character's last crossing, its price and its token (E17 C3) - see movement.mjs `refundLastCrossing`. */
const ACTION_REFUND_CROSSING = "token.refundCrossing";
const ACTION_VAULT_STEAL = "vault.steal";
const ACTION_STEAL = "action.steal";
const ACTION_FIND_STASH = "vault.findStash";
const ACTION_PLANT = "action.plant";
/** player -> GM: my character went through a student's pockets unseen (E80 part 2 C2) - see frisk.mjs `friskPerson`. */
const ACTION_FRISK_UNSEEN = "action.friskUnseen";
/** player -> GM: my character asks a student to turn out their pockets (E80 part 2 C3) - see frisk.mjs `askToFrisk`. */
const ACTION_FRISK_ASK = "action.friskAsk";
/** player -> GM: my answer to that ask, for a character I answer for - see frisk.mjs `answerFrisk`. */
const ACTION_FRISK_ANSWER = "action.friskAnswer";
/** player -> GM: after a refusal or no answer, my character forces it or leaves it - see frisk.mjs `followFrisk`. */
const ACTION_FRISK_FOLLOW = "action.friskFollow";
const ACTION_CRISIS = "murder.crisis";
/** GM -> player: "Stage 4 is yours to throw." */
const ACTION_OPENING_ASK = "murder.openingAsk";
const ACTION_OPENING_CANCEL = "murder.openingCancel";
/** player -> GM: what it came up. */
const ACTION_OPENING_RESULT = "murder.openingResult";
const ACTION_CLEANUP = "murder.cleanup";
const ACTION_BETRAYAL = "murder.betrayal";
const ACTION_PARK_MURDER = "murder.park";
/** player -> GM: a Monocub uses the ability under `key` (E33 C10) - see monocub.mjs `cubAbilityOnGm`. */
const ACTION_CUB_ABILITY = "monocub.ability";
/** GM -> player: a request carried out, with its answer - see `bridgeRequest` in bridge-guards.mjs. */
const ACTION_DONE = "bridge.done";
/** A GM's world has finished loading - see `registerGmBridge`. */
const ACTION_GM_READY = "bridge.gmReady";
const ACTION_LOOT = "body.loot";
const ACTION_NOTE_SAVE = "note.save";
const ACTION_ROLL_BOOKMARK = "roll.bookmark";
/** player -> GM: make my character's Reroll (E08+E28 C4a) - see reroll.mjs `rerollOnGm`. */
const ACTION_REROLL = "reroll.ask";
/** player -> GM: post the private card my browser would post while an incident runs (E08+E28 fix r2-H5) - see secret.mjs `askGm`. */
const ACTION_CARD = "card.post";
/** GM -> primary GM: a GM's click on a card to the GMs, claimed before it rules and marked ruled after (E18 C3; `claimCard`). */
const ACTION_CARD_CLAIM = "card.claim";

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

/*
 * THE RUNS (E31, 25.09.2026). Each handler below is the `run` of one
 * declaration in BRIDGE_ACTIONS, at the end of this file, and keeps its name,
 * its order and its first parameter, `payload` - which is no longer the packet
 * but a copy with only the fields the declaration lists (`sanitize`). By the
 * time a run is called, `judge` (bridge-guards.mjs) has asked who sent the
 * packet and every guard the declaration names, in order; the run carries the
 * request out, and answers by what it returns: nothing, `{ reply }`,
 * `{ refused: "<English reason>" }`, or `{ later: true }` for a ruling a GM
 * gives from a card. A run never emits a packet and never calls `refuse`.
 */

    // Observe is scored on this side, because everything it is scored against -
    // which Remnants are in the room, what they are, what the difficulty is -
    // is exactly what the observer must not know. See observe.mjs.
async function handleObserveTarget(payload, sender, ctx) {
    const { chooseObserveTarget } = await import("./observe.mjs");
    const result = await chooseObserveTarget({
        actorId: payload.actorId,
        declaration: payload.declaration,
        request: payload.request,
        // The key is minted for this account and no other (E03; audit S05-03).
        userId: sender.isGM ? null : sender.id,
        // A focused gaze is put on every GM's card and answered later (E09 C12).
        asked: ctx
    });
    return result?.later || result?.refused ? result : { reply: result };
}

    // Stage 6's picker. Which traces a killer's own client may act on is
    // computed here for the same reason Observe is: the ledger - the answer
    // key `cleanableRemnants` reads to build the list - lives only on a GM
    // client, and `cleanableTracesForPlayer` (cleanup.mjs) is what strips it
    // back down to id, label, the reinforced flag and the number the roll window
    // shows (E16 part 2 C0, the owner's Q7) before it goes out.
async function handleCleanupTraces(payload, sender, ctx) {
    const { cleanableTracesForPlayer } = await import("./cleanup.mjs");
    return { reply: cleanableTracesForPlayer(payload.actorId, { mine: payload.mine }) };
}

async function handleObserveResolve(payload, sender, ctx) {
    // The sender has to own the character the packet names (the declaration's
    // guard). That alone was taken to mean "the person who asked for this key",
    // and it did not: the key named a character of its own and nothing compared
    // the two (audit S05-03). `resolveObserve` now holds the key to its
    // character, its account and one use (`observeResolveRefusal`); an undo is
    // a GM's alone (`guardUndoIsTheGms`, E08+E28 C8).
    const { resolveObserve } = await import("./observe.mjs");
    const result = await resolveObserve({
        key: payload.key,
        // Carried so a resolve that finds no record can still name who is
        // waiting for it (ACT-08). Already checked against the sender.
        actorId: payload.actorId,
        total: payload.total,
        isCritical: payload.isCritical,
        undo: payload.undo,
        senderId: sender.id,
        senderIsGm: sender.isGM,
        rollId: payload.rollId
    });
    // Not a guard: the key is judged inside `resolveObserve`, against the entry
    // it has just read, and for a GM's own resolve as much as for a packet.
    if (result?.refused) return { refused: result.refused };
}

    // Analyze is scored here for the same reason as Observe: the difficulty is
    // read from what the bullet really is, which is the answer being bought.
async function handleAnalyzeResolve(payload, sender, ctx) {
    const { resolveAnalyze } = await import("./analyze.mjs");
    const result = await resolveAnalyze({
        actorId: payload.actorId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        undo: payload.undo,
        rollId: payload.rollId,
        by: sender.id
    });
    // Not a guard: one Analyze per bullet per chapter is the resolver's own
    // rule, asked of a GM's throw too (analyze.mjs).
    if (result?.refused) return { refused: result.refused };
    // Null: no such Truth Bullet on that character - nothing was analysed, so the
    // asker is not answered as though it were (E31 review).
    if (!result) return { refused: "nothing was carried out: resolveAnalyze analysed nothing" };
}

/*
 * A LEVEL UP THE PLAYER CHOSE, APPLIED BY THE GM WHO OFFERED IT (N-2).
 *
 * EVERY FIELD OF THIS PACKET IS A CLAIM. The sender says which character, which
 * kind and which options; a player who can open a console can say anything. So:
 * the sender has to own the character (the declaration's guard), the character
 * has to be CARRYING an offer, the kind comes off THE OFFER rather than off the
 * packet (whose `kind` is not even on the whitelist), the number of picks has
 * to be the number that kind buys, and every option has to be one of the five.
 * Nothing here trusts the claim except the picks themselves, which are the one
 * thing the offer was made to let them choose.
 *
 * The offer it names is cleared by `applyAdvancement`, so a second packet naming
 * it is refused by the same test that admitted the first.
 *
 * WHICH OFFER (E10 C6, 1.2.71; audit S03-17). A character holds a list of offers now, and
 * the packet names the one it spends (`offerId`): it has to stand in this character's list
 * as this GM holds it, and the picks are the ones THAT offer buys - its kind's and its extra
 * (level-up.mjs `offerPicks`). One taken back, or spent, names nothing and is refused.
 */
async function handleAdvancement(payload, sender, ctx) {
    const actor = game.actors.get(payload.actorId);
    if (!actor) return { refused: "no such character" };

    const { standingOffers, offerPicks, applyAdvancement, advancing } = await import("./level-up.mjs");
    const { numberHeld } = await import("./sheet-audit.mjs");
    const standing = standingOffers(actor);
    const offer = standing.find(held => held.id === payload.offerId) ?? null;
    if (!standing.length) {
        /* THE GMs ARE TOLD WHEN THE REFUSAL MAY BE THIS BROWSER'S (E04 C8; E31 row 5):
           the offers store has not heard from the other GMs yet, or holds nothing at
           all - a primary that came with an empty browser, which is the case the
           owner's lit button now survives. Nothing is awaited between this read and
           the latch below. */
        const { offerStore } = await import("./gm-stores.mjs");
        if ((!offerStore.isHydrated() || !Object.keys(offerStore.entries()).length) && !offerMissingTold.has(actor.id)) {
            // Once per character and load: a player pressing again is not news, and a whisper each time would be a way to flood the GMs.
            offerMissingTold.add(actor.id);
            void whisperToGms(`<p class="drpg-warning">${esc(game.i18n.format("DRPG.Advance.notOfferedHere", { name: actor.name, player: sender.name }))}</p>`)
                .catch(err => debug("Could not tell the GMs about a Level Up this browser does not hold", err));
        }
        return { refused: "no Level Up is on offer for that character" };
    }
    if (!offer) return { refused: "no Level Up is on offer under that name for that character" };

    const wanted = offerPicks(offer);
    const picks = Array.isArray(payload.picks) ? payload.picks : [];
    if (picks.length !== wanted) {
        return { refused: `that offer buys ${wanted} pick(s), the packet carried ${picks.length}` };
    }
    if (picks.some(p => !LEVEL_UP_OPTIONS[p?.option])) {
        return { refused: "a pick names something that is not an option" };
    }

    /* Bounded on arrival as well as caught on the player's screen (level-up.mjs):
       a packet from an older client, or a forged one, must not spend the offer on
       a new experience that has no name. */
    if (picks.some(p => p.option === "experienceNew" && !String(p.name ?? "").trim())) {
        return { refused: "a new experience has no name" };
    }

    /* A PICK THE SHEET CANNOT TAKE IS REFUSED, NOT SKIPPED (E10 C8, 1.2.71; audit S03-22). A statistic
       that is not one of TRAITS, and an experience to raise that the character does not have - none
       named, as a form with no experience to list sends it, or one not on the sheet as the GMs hold
       it (`numberHeld` at the experiences' root: the primary's mark, the sheet elsewhere) - went to
       `applyAdvancement`, which skipped the first kind and wrote a value under the second: the
       offer was spent either way, a pick of a Reinforced's three lost or written on an experience
       with no name. Refused here, before the latch, and told; the offer stands. An experience the
       GMs hold is an entry with a value to add to: a console's write of a new experience's value,
       put back, leaves the entry in the mark empty ({}; read on 10.10.2026 under tier 2's "a Level
       Up raises no experience a player's console made"), and a check of the entry alone let it be
       raised from 0. `applyAdvancement` checks the experiences again in its own job, where a write
       heard meanwhile has been judged. */
    const statistics = new Set(Object.values(TRAITS).map(trait => trait.dh));
    if (picks.some(p => p.option === "trait" && !statistics.has(p.trait))) {
        return { refused: "a pick raises a statistic that is not one" };
    }
    const experiences = numberHeld(actor, "system.experiences") ?? {};
    const held = id => typeof id === "string" && Object.hasOwn(experiences, id) && typeof experiences[id]?.value === "number";
    if (picks.some(p => p.option === "experienceUp" && !held(p.experience))) {
        return { refused: "a pick raises an experience the character does not have" };
    }

    /* ONE AT A TIME PER CHARACTER. The offer is only withdrawn once
       `applyAdvancement` has written the rises and awaited the store, three round
       trips later; two packets inside that window - two stacked pickers, a double
       press on a slow server - both found the offer standing and both applied. The
       lines above are synchronous, so nothing interleaves between reading the offer
       and taking the latch. The latch is level-up.mjs's since E10 fix r1-G2: a take-back
       of the offer reads it and is refused while it is held, and since r2-G4 holds it
       across its own drop, so a Level Up that arrives while that drop waits is refused here. */
    if (advancing.has(actor.id)) {
        return { refused: "a Level Up for that character is already being written" };
    }
    advancing.add(actor.id);
    try {
        await applyAdvancement(actor, picks, offer.kind, { offerId: offer.id });
    } finally {
        advancing.delete(actor.id);
    }
}

/** Characters whose refused Level Up the GMs were told this browser may not hold (see handleAdvancement). */
const offerMissingTold = new Set();

/**
 * A GM asks the primary to give an offer or take one back (N-2; E10 C6). Only a GM - the
 * declaration's first guard. `add` appends one of `kind` and answers its id - with `extra`
 * picks and how many of them waited for the class (`deferred`) when the verdict's window
 * gives it (E10 C7), bounded to whole numbers by `recordOffer`; `take` names an offer standing
 * on that character as the primary holds it (`offerId`), else it is refused.
 */
async function handleAdvancementOffer(payload, sender, ctx) {
    const actor = game.actors.get(payload.actorId);
    if (!actor || actor.type !== "character") return { refused: "no such character" };
    const { recordOffer, dropOffer, standingOffers, advancing, takingBack } = await import("./level-up.mjs");
    if (payload.op === "take") {
        if (!standingOffers(actor).some(offer => offer.id === payload.offerId)) {
            return { refused: "no Level Up is on offer under that name for that character" };
        }
        // Not while the Level Up it would spend is being written, and that Level Up not while the drop
        // waits for the offers store (level-up.mjs `takeBackOffer`; E10 fix r1-G2, r2-G4). `takingBack` lets the
        // primary's own menu tell a second take-back from a Level Up (r2-G6); this road's refusal is told as busy.
        if (advancing.has(actor.id)) return { refused: "a Level Up for that character is already being written" };
        advancing.add(actor.id);
        takingBack.add(actor.id);
        try {
            await dropOffer(actor.id, payload.offerId);
        } finally {
            advancing.delete(actor.id);
            takingBack.delete(actor.id);
        }
        return { reply: { taken: payload.offerId } };
    }
    if (payload.op !== "add") return { refused: "an offer is given or taken back, nothing else" };
    const kind = payload.kind;
    if (!LEVEL_UP[kind]?.picks) return { refused: `no such Level Up: ${kind}` };
    const added = await recordOffer(actor.id, { kind, extra: payload.extra, deferred: payload.deferred });
    return { reply: added ? { id: added.id } : null };
}

/**
 * An owner asks for the offers on their own characters; the answer is the set - once
 * tier 2 lets the stores go, when it holds them (R2-M1), from this world's offers. Not
 * awaited: the ask is a report nobody waits on, and the runner is not held for it.
 */
async function handleAdvancementAsk(payload, sender, ctx) {
    whenGmStoresAudible().then(() => sendOffersTo(sender.id)).catch(err => error("Could not answer an owner's offers", err));
}

/**
 * Primary GM: send one user the whole set of offers on their own characters.
 * Addressed - nobody else's browser receives it - and only when they are there.
 * With a stamp per character they own (E04): the owner's copy takes only what is
 * newer (level-up.mjs `offersFor`, gm-stores.mjs `offerCopy`).
 */
export async function sendOffersTo(userId) {
    const user = game.users.get(userId);
    if (!user?.active || user.isGM) return;
    // While tier 2 holds the stores the offers are a fixture's: no owner is sent them (R2-M1).
    if (gmStoresQuiet()) return;
    const { offersFor } = await import("./level-up.mjs");
    const { offers, stamps } = offersFor(userId);
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_ADVANCEMENT_OFFERS, userId, offers, stamps
    }, { recipients: [userId] });
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

    // Handing something to another character writes to a sheet the sender does
    // not own, so it can only happen here. The same-room condition is checked
    // again inside handover.mjs - the payload only claims it. One run for the
    // two actions: which one is `ctx.action`, the runner's, not a packet field.
async function handleShareBulletOrGiveItem(payload, sender, ctx) {
    const { shareBullet, giveItem } = await import("./handover.mjs");
    const args = { fromId: payload.fromId, toId: payload.toId, itemId: payload.itemId };
    // A bullet whose answer keys this GM's stores could not open in time, the one gate's
    // refusals (inventory.mjs `transferRefusal`, asked by handover.mjs `verify`: notThere,
    // cannotNow, missing; E14 part 1 C1) and an item no GM has decided on come back with their
    // reason and are told by its code; a hand-over into full hands with no stash is the
    // giver's whisper (handover.mjs `giveItem`).
    const out = ctx.action === ACTION_SHARE_BULLET ? await shareBullet(args) : await giveItem(args);
    if (out?.refused) return { refused: out.refused };
}

    // Showing a secret passage (E79 C7): the recipient learns it in the GMs' records, which only the
    // primary writes. Every check past the sender's ownership of the giver is `shareRefusal`'s, and whether
    // the sender acts as the Mastermind through the giver is asked of the sender (E79 fix r2-G2, SEC M3).
async function handlePassageShare(payload, sender) {
    const { sharePassage } = await import("./passages-gm.mjs");
    const out = await sharePassage({ actorId: payload.actorId, targetId: payload.targetId, passageId: payload.passageId }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
}

// 'Go through' a tunnel (E80 C2): the token moved by the primary, which alone writes it for a player. Every check
// past the sender's ownership of the character is `crossTunnel`'s, against the GMs' records and the map as it is now.
async function handlePassageCross(payload, sender) {
    const { crossTunnel } = await import("./passages-gm.mjs");
    const out = await crossTunnel({ actorId: payload.actorId, passageId: payload.passageId }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
    return { reply: true };
}

/** The run of `token.refundCrossing` (E17 C3): the primary's own refund (movement.mjs `refundLastCrossing`), its reply or its refusal. */
async function handleRefundCrossing(payload) {
    const { refundLastCrossing } = await import("./movement.mjs");
    const out = await refundLastCrossing(payload.actorId);
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

// Find Passage (E80 C3): a `found` cell in the GMs' records, which only the primary writes. Every check past the sender's
// ownership of the character is `resolvePassageSearch`'s - the phase, the character, its room and floor where the GMs read
// it (movement.mjs `gmPlaceOf`), the passages it does not know - and the total is the GMs' record of the roll (`rolled`,
// `findPassageRoll`), never the packet's.
async function handlePassageFind(payload, sender) {
    const { resolvePassageSearch } = await import("./passages-gm.mjs");
    const out = await resolvePassageSearch({ actorId: payload.actorId, total: payload.total, isCritical: payload.isCritical, rollId: payload.rollId },
        { asker: sender });
    if (out?.refused) return { refused: out.refused };
    return { reply: true };
}

/*
 * A FRISK'S TWO ROLLS, EACH THE GMS' RECORD (E80 part 2 C2; the A11 design's step 10), as a Palm's (`palmRolls`): the
 * hand's (`rollId`, thrown as "rummage") and the cover's (`unseenRollId`, thrown as "palm"), whose result goes in
 * `unseenTotal` and `unseenCritical`.
 */
function friskRolls(actor) {
    return [
        { field: "rollId", actor, kind: "rummage" },
        { field: "unseenRollId", actor, kind: "palm", into: { total: "unseenTotal", isCritical: "unseenCritical" } }
    ];
}

/* A Find Passage's roll is an Analyze thrown as one (roll-draw.mjs keeps `findPassage` on its record): an Analyze for a
   hint or a bullet settles no passage search. Read off the GMs' record by the runner (bridge-guards.mjs `rollsFor`). */
function findPassageRoll(record) {
    return record?.findPassage === true ? null : { why: "that roll was not thrown for that action" };
}

/* And the other way (E80 fix r1-G7, review E80-SEC-5): an Analyze thrown as a Find Passage settles no bullet and no stash
   search, so a console cannot pick the road after it sees the total, against the road the GMs' record says it was thrown
   for. A record that says nothing of it (drawn before C3, or `findPassage` false) is an Analyze for those roads. */
function notFindPassageRoll(record) {
    return record?.findPassage === true ? { why: "that roll was not thrown for that action" } : null;
}

/*
 * A PALM'S TWO ROLLS, EACH THE GMS' RECORD (E08+E28 C15, 04.10.2026; audit S10-06). A Steal and a
 * Plant were scored on the packet's two totals - the hand's against the action's bar, the unseen
 * one against whether anybody watched (`stealFromPerson`, `plantOnPerson`). The packet names both
 * rolls now: the hand's (`rollId`, thrown as "steal" for a Steal and a Plant alike, as it always
 * was) and the unseen one (`unseenRollId`, thrown as "palm" since C15, action-rolls.mjs
 * `performPalm`), whose result goes in `unseenTotal` and `unseenCritical`.
 * One hand's roll settles one Steal or one Plant.
 */
function palmRolls(actor) {
    return [
        { field: "rollId", actor, kind: "steal" },
        { field: "unseenRollId", actor, kind: "palm", into: { total: "unseenTotal", isCritical: "unseenCritical" } }
    ];
}

    // And into them. Same guards as the theft, mirrored - the sender has to own
    // the character whose pocket the item is leaving. An item no GM has decided on
    // (E29 fix r2-H21), the one gate's refusals before the rolls (inventory.mjs
    // `transferRefusal`; E14 part 1 C1) and a stash's own (vault.mjs `stealFromVault`;
    // E14 fix e1-G1) come back as { refused } and are told by their code; the gate's
    // second asking, after the rolls, is told as nothing carried out (fix e1-G4). What a
    // run carries out - a missed hand, full pockets - is the asker's whisper.
async function handlePlant(payload, sender, ctx) {
    const { plantOnPerson } = await import("./vault.mjs");
    // The sender: a body the GMs keep from them is planted on as a living victim is (E80 fix sec1-G1; the one gate,
    // inventory.mjs `transferRefusal`, reads it so since E14 part 1 C1).
    const out = await plantOnPerson({
        plannerId: payload.plannerId,
        victimId: payload.victimId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal,
        unseenCritical: payload.unseenCritical
    }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
}

    // Looking for a hiding place. The finder owns their own sheet and could
    // write the flag themselves - which is exactly why they do not: that write
    // is the whole distance between beating a 16 and reading other people's
    // stashes, so it happens where the threshold is checked.
async function handleFindStash(payload, sender, ctx) {
    const { resolveStashSearch } = await import("./vault.mjs");
    const out = await resolveStashSearch({
        actorId: payload.actorId,
        total: payload.total,
        isCritical: payload.isCritical
    });
    // Refused in a Class Trial (E16 part 2 C3, S02-70) before the throw is read: told by its code, and no fact on the roll.
    if (out?.refused) return { refused: out.refused };
    // The GMs' fact on the roll the packet names (E80 C4, S16-19): it was a Find Stash, and whether it opened one. Its
    // Reroll replays the search from these (reroll.mjs `settleStashFind`), never from the roller's word - in the place
    // this search was made (`findPlace`, E80 fix r1-G4; the review's E80-G-1), never where the student stands by then.
    const rolls = await import("./action-rolls.mjs");
    await rolls.noteFactOn(rolls.rollOfFact({ rollId: payload.rollId ?? null, by: sender?.id ?? null, actorId: payload.actorId,
        actions: ["analyze"] }), { findStash: true, stashFound: Boolean(out?.found), ...(out?.place ? { findPlace: out.place } : {}) });
    // Answered once judged (E16 fix e1-G2): the asker gives the price back on a refusal, which it hears only so.
    return { reply: true };
}

    // And out of their pockets. Same reasoning as the stash below, plus one
    // more: the thief's client is the one that would benefit from getting the
    // arithmetic wrong, so it does none of it.
async function handleSteal(payload, sender, ctx) {
    const { stealFromPerson } = await import("./vault.mjs");
    // The sender: a body the GMs keep from them is robbed as a living victim is (E80 fix sec1-G1; the one gate,
    // inventory.mjs `transferRefusal`, reads it so since E14 part 1 C1).
    const out = await stealFromPerson({
        thiefId: payload.thiefId,
        victimId: payload.victimId,
        itemId: payload.itemId,
        total: payload.total,
        isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal,
        unseenCritical: payload.unseenCritical
    }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
}

/* An unseen Frisk (E80 part 2 C2): judged and its cards posted on the primary, on the two rolls' records (`friskRolls`). */
async function handleFriskUnseen(payload, sender) {
    const { friskPerson } = await import("./frisk.mjs");
    const out = await friskPerson({
        searcherId: payload.searcherId, targetId: payload.targetId, total: payload.total, isCritical: payload.isCritical,
        unseenTotal: payload.unseenTotal, unseenCritical: payload.unseenCritical, rollId: payload.rollId ?? null
    }, { asker: sender });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.outcome ?? "settled" };
}

/* An open Frisk's ask (E80 part 2 C3): judged on the primary, which answers it later, when the target has answered or
   the clock has run (frisk.mjs `askToFrisk`), with the request's own `bridge.done`. */
async function handleFriskAsk(payload, sender, ctx) {
    const { askToFrisk } = await import("./frisk.mjs");
    const reply = value => {
        if (!ctx?.requestId || !ctx.asker) return;
        game.socket.emit(SOCKET_EVENT, { action: ACTION_DONE, requestId: ctx.requestId, userId: ctx.asker, value }, { recipients: [ctx.asker] });
    };
    const out = await askToFrisk({ searcherId: payload.searcherId, targetId: payload.targetId }, { asker: sender, reply });
    if (out?.refused) return { refused: out.refused };
    if (out?.later) return { later: true };
    return { reply: out?.value ?? null };
}

/* An answer to that ask, judged by who sent it (frisk.mjs `answerFrisk`). */
async function handleFriskAnswer(payload, sender) {
    const { answerFrisk } = await import("./frisk.mjs");
    const out = await answerFrisk({ askId: payload.askId, allow: payload.allow }, sender);
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.outcome ?? null };
}

/* A force or a 'Leave it' (frisk.mjs `followFrisk`), its roll's result read off the GMs' record (`friskForceRoll`). */
async function handleFriskFollow(payload, sender) {
    const { followFrisk } = await import("./frisk.mjs");
    const out = await followFrisk({ searcherId: payload.searcherId, askId: payload.askId, rollId: payload.rollId,
        total: payload.total, isCritical: payload.isCritical }, sender);
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.outcome ?? null };
}

/*
 * A FORCE'S ROLL, FOR THE ASK IT NAMES (E80 part 2 C3). The runner holds the record to the searcher, to a `frisk` roll and
 * to one settlement (`rollRefusal`); this holds it to the ask: one the primary holds for that searcher, a roll drawn after
 * the ask was made and no later than its force's window, its grace and the roll's window (frisk.mjs `forceDrawnBy`, which
 * `friskForceOpen` held the draw to; E80 fix r1-G1, r1-G2), so a Body roll drawn for one ask settles no other. Its fields
 * are the record's result.
 */
async function friskForceRoll(record, payload) {
    const { friskAsks, forceDrawnBy } = await import("./frisk.mjs");
    const row = friskAsks.get(typeof payload?.askId === "string" ? payload.askId : "") ?? null;
    if (!row) return { why: "no such Frisk ask" };
    if (row.searcherId !== record.actorId) return { why: "not their character" };
    if (!(Number(record.at) >= Number(row.at))) return { why: "that roll was not thrown for that action" };
    if (!(Number(record.at) <= forceDrawnBy(row))) return { why: "that roll is too old to settle anything" };
    return { fields: { total: Number(record.total) || 0, isCritical: Boolean(record.isCritical) } };
}

    // Taking something out of somebody else's stash writes to two sheets, one of
    // which the thief has no business writing to.
async function handleVaultSteal(payload, sender, ctx) {
    const { stealFromVault } = await import("./vault.mjs");
    const out = await stealFromVault({
        thiefId: payload.thiefId, ownerId: payload.ownerId, itemId: payload.itemId,
        // Set only by the Search action, which pays for the concealment it is
        // beating. See the note in `stealFromVault`. Since E08+E28 C15 a packet
        // that says so names the Search's roll, and this is the GMs' record of it
        // (`searchTheftOf`).
        viaSearch: payload.viaSearch,
        // Whether the Search fumbled it, read off the same record: the sender's
        // word until C15, which a client could only ever bend one way - a steady
        // hand, and the victim not told. On a GM whose Daggerheart is not the build
        // the draw was written for nobody keeps a record, and it is the sender's
        // word again (bridge-guards.mjs, "TWO PACKETS PASS WITH NO RECORD").
        clumsy: payload.clumsy
    });
    if (out?.refused) return { refused: out.refused };
    // Whether the thing moved (E16 fix e1-G2): a Search leaves its trace only on `taken` (action-rolls.mjs `searchStash`).
    return { reply: { taken: Boolean(out) } };
}

/*
 * WHAT A SEARCH EARNED AT A STASH, ON THE GMS' RECORD (E08+E28 C15, 04.10.2026; audit S10-06).
 * `viaSearch` and `clumsy` were the sender's word: that a Search had paid for a concealed stash,
 * and that its hand was steady. A packet that says `viaSearch` now names the Search's roll, and
 * both are read off the GMs' record of it: the Search found the stash when its total, with the
 * hidden stash's step the GM drew with the dice (`used.stash`, roll-draw.mjs `drawOnGm`), reaches
 * a tier of the Search's table, or the roll is a critical - action-rolls.mjs `searchTier`, as
 * `performSearch` reads it before it opens the stash (`searchStash`); it fumbled on Despair with no
 * critical, as `searchStash` says. A packet that does not say `viaSearch` asks no roll: it is the
 * drawer's free route, which `stealFromVault` holds to a stash that is not concealed or was found,
 * and its `clumsy` can only tell the stash's owner on the sender.
 */
async function searchTheftOf(record) {
    const { searchTier } = await import("./action-rolls.mjs");
    const { sheetMarkStore } = await import("./gm-stores.mjs");
    const { hit } = searchTier(record, record.used?.stash?.change ?? 0);
    if (!hit && !record.isCritical) return { why: "that roll did not find the stash" };
    // A Search ends in a find or in a stash's loot, never both (`performSearch`): a record a find
    // already stood on (sheet-audit.mjs `searchFind`, the mark's `finds`) takes no theft (E29 fix r1-G8).
    if (sheetMarkStore.get(record.actorId)?.finds?.[record.rollId]) return { why: "that roll has already settled that action" };
    return { fields: { viaSearch: true, clumsy: Boolean(record.withFear) && !record.isCritical } };
}

    // Stage 4 thrown on the participant's own client. Same guard as a crisis
    // action: the sender has to own the character the roll is about, or one
    // player could open somebody else's murder for them.
async function handleOpeningResult(payload, sender, ctx) {
    const { resolveOpening } = await import("./murder.mjs");
    await resolveOpening({
        actorId: payload.actorId,
        side: payload.side,
        total: payload.total,
        isCritical: payload.isCritical,
        withHope: payload.withHope
    });
}

    // A crisis action writes to the other participant's sheet, to the map and to
    // the shared incident state. All three are GM-only. It is judged again
    // before it lands - see `guardCrisisAction` - and murder.mjs is imported in
    // the declaration's `prepare`, before those guards, as it was here, so the
    // last guard and the write have nothing awaited between them.
async function handleCrisis(payload, sender, ctx, prepared) {
    const { resolveCrisisAction, freeResolutionFor, sideOf } = prepared;
    const actor = game.actors.get(payload.actorId);
    // A player's packet that names no roll threw none (`guardCrisisRoll`): a decision or a free
    // take, scored on no dice - a total of 0, no critical, with Hope - as its asker sends it,
    // whatever this one says (E08+E28 C17). One that names its roll carries the GMs' record of it.
    const unrolled = !sender.isGM && !payload.rollId;
    const result = await resolveCrisisAction({
        actorId: payload.actorId,
        key: payload.key,
        total: unrolled ? 0 : payload.total,
        isCritical: unrolled ? false : payload.isCritical,
        withHope: unrolled ? true : payload.withHope,
        // A Reroll replacing this actor's own last crisis action: a GM's packet
        // alone carries it (`as.gmFlag`, E08+E28 C8).
        undo: payload.undo,
        // Narrowed rather than trusted, by the whitelist: the only two answers
        // this can carry are the two resources a critical Strike may take.
        choice: payload.choice,
        // An id, and one the sender's own character actually holds. It only
        // ever becomes a receipt line, but a receipt naming somebody else's
        // item would give a Reroll the run of another sheet.
        usedItemId: actor?.items?.has(payload.usedItemId) ? payload.usedItemId : null,
        // Same test: the swing names an item, and only one the sender holds. The
        // damage is read off it since E32+E07 C8, and murder-rules.mjs `swungWeapon`
        // narrows it further, to a readied Crime Tool on an action that swings.
        swungId: actor?.items?.has(payload.swungId) ? payload.swungId : null,
        // What the item's use started from, as the player read it: their own character's
        // (the declaration's `owns`), numbers or nothing (`resourcesBefore`). Kept on the
        // GMs' bookmark only (E08+E28 C2).
        before: payload.before,
        // The roll the GMs' fact of it goes on, for this sender (fix r1-G2): `rollOfFact`.
        rollId: payload.rollId,
        by: sender.id,
        /*
         * G-18, AND THIS IS THE ONE FIELD ON THIS SOCKET THAT COULD BUY
         * SOMETHING FOR NOTHING.
         *
         * A packet claiming `free` is claiming an automatic success on
         * Survive or Role reversal - the two actions that end an incident.
         * So it is not believed. The grant is looked up in the incident
         * state on THIS side, for the side this actor is actually on, and a
         * claim with nothing behind it is dropped to false: the action then
         * scores against its real threshold with a total of zero, which is
         * a failure. That is the right answer to a forged packet - refusing
         * outright would let a lost socket message turn a legitimate free
         * take into silence instead of a result.
         */
        free: payload.free && Boolean(freeResolutionFor(sideOf(actor)))
    });
    // Null: a Reroll's rewind that could not happen (the GMs have been told), or
    // no incident, character or action to score - nothing was applied (E31 review).
    if (!result) return { refused: "nothing was carried out: resolveCrisisAction resolved nothing" };
    // Said back only when the action's own resolution killed (E32+E07 C8b). The asker's
    // browser kept it on the roll's bookmark until E08+E28 C4a; the GM's Reroll now reads
    // the death off the action's receipt itself (reroll.mjs `replayRefusal`).
    // The asker is in that death card's audience already; any other answer is null, as before.
    if (result.lethal) return { reply: { lethal: true } };
}

    // A direct murder declared in the dark. The declaration is written in the GMs'
    // store (eclipse.mjs, since E05 - until then a world setting every browser
    // held, so the parking itself was the leak), and a player's client holds no
    // GM store, so it travels; the judgement happens when the Eclipse ends, on a
    // GM's side, off the final placement.
    //
    // Nothing about the outcome is decided here or sent back - that is the whole
    // point of parking it, and a bridge that answered "recorded" with anything
    // more would tell the asker what only the GMs know.
    //
    // Only while an Eclipse runs (E05 fix r1-G3; review S1-m8), as `eclipse.move` is: outside
    // one nothing is written and nobody is asked, and the asker is told.
async function handleParkMurder(payload, sender, ctx) {
    const eclipse = await import("./eclipse.mjs");
    if (!eclipse.eclipseId()) return { refused: "no Eclipse is running" };
    await eclipse.writeParkedMurder({
        killerId: payload.killerId,
        room: payload.room,
        note: payload.note
    });
}

    // The newcomer turns on the person they just helped. Opening a murder is a
    // world write and a second death, so the request travels and the decision
    // is re-derived from the incident on this side - `betrayAsPlayer` refuses
    // anyone the state does not put in that position.
    //
    // In an Eclipse it is a declaration (E32 C5b, 28.09.2026; the owner's Q3): the
    // asking client has paid an action for it, so it is answered - parked, or refused
    // and told, and the client gives the action back. Refused here unless the betrayal
    // is on offer to that character now, and - the offer stays in the cast until the
    // lights (fix r1-G2), so the tile stays lit - unless it is declared already;
    // `betrayAsPlayer` parks it.
async function handleBetrayal(payload, sender, ctx) {
    const murder = await import("./murder.mjs");
    const { isEclipse, betrayalDeclared } = await import("./eclipse.mjs");
    if (!isEclipse()) {
        await murder.betrayAsPlayer(payload.actorId);
        return;
    }
    if (!murder.betrayalTarget(game.actors.get(payload.actorId))) return { refused: "that cannot be done now" };
    if (betrayalDeclared(payload.actorId)) return { refused: "that betrayal is already declared" };
    const parked = await murder.betrayAsPlayer(payload.actorId, { note: payload.note });
    if (!parked) return { refused: "nothing was carried out: betrayAsPlayer parked nothing" };
    return { reply: true };
}

    // Stage 6. Deleting a Remnant token, placing the new one a botched wipe
    // leaves, and reading how visible the trace was in the first place are all
    // GM-only - the last of those most of all, since it is the threshold the
    // roll is being measured against. See cleanup.mjs. cleanup.mjs is imported
    // in the declaration's `prepare`, before the guards, as it was here.
async function handleCleanup(payload, sender, ctx, prepared) {
    const cleanup = prepared;

    // The two added Stage 6 actions score differently - a flat threshold
    // rather than one read off a trace's visibility - so they have their own
    // resolver. Same guard, same sender check; only the maths differs.
    if (payload.key && payload.key !== "eraseTrace" && payload.key !== "transformTrace") {
        const result = await cleanup.resolveStageSix({
            actorId: payload.actorId,
            key: payload.key,
            targetId: payload.targetId,
            total: payload.total,
            isCritical: payload.isCritical,
            withHope: payload.withHope,
            viaAction: payload.viaAction,
            // Which step the client paid. Bounded on arrival against
            // PRICE_CHAINS, like `transform` and `change` (T-1).
            price: payload.price ?? null,
            grant: payload.grant,
            // Who sent it, as below: a give-back the GMs' audit cannot check is not
            // made on a player's word (cleanup.mjs `paidBack`, fix r2-G8).
            by: sender.id
        });
        // Not a guard: who may be framed and where the body lies are the
        // resolver's own rules, asked of a GM's Stage 6 too (cleanup.mjs).
        if (result?.refused) return { refused: result.refused };
        // Null: a refusal the resolver keeps to the GM's console - nothing was done (E31 review).
        if (!result) return { refused: "nothing was carried out: resolveStageSix did nothing" };
        return;
    }

    // Null is a refusal the resolver keeps to the GM's console, or a Reroll's rewind
    // that could not happen: nothing was done (E31 review). An answer that is not
    // null - a trace gone, not found, reinforced - has been whispered to the cleaner.
    const cleaned = await cleanup.resolveCleanup({
        actorId: payload.actorId,
        tokenId: payload.tokenId,
        total: payload.total,
        isCritical: payload.isCritical,
        withHope: payload.withHope,
        // G-20. Passed through as sent and bounded on arrival -
        // `resolveCleanup` checks both halves against `CLEANUP.transform`
        // before it touches anything, which is the same check a GM-side
        // call gets.
        transform: payload.transform ?? null,
        // Z5, and the same contract: sent as given, bounded on arrival.
        mode: payload.key === "transformTrace" ? "transform" : "erase",
        change: payload.change ?? null,
        undo: payload.undo,
        // T-1, same contract: sent as given, bounded on arrival.
        price: payload.price ?? null,
        grant: payload.grant,
        // A claim that WAIVES Stage 6's guards and ADDS one of its own: the
        // trace has to belong to the sender. Forging it costs them the
        // right to touch anybody else's trace, which is the only thing the
        // waived guards were protecting.
        viaAction: payload.viaAction,
        rollId: payload.rollId,
        by: sender.id
    });
    if (!cleaned) return { refused: "nothing was carried out: resolveCleanup cleaned nothing" };
}

    // A Monocub's ability writes to the TARGET's sheet, not the Monocub's own -
    // arming a Call is exactly the write a player has no permission to make on
    // somebody else's actor. Its dice are thrown here since E08+E28 C17, by the
    // row the packet's `key` names (E33 C10, `cubAbilityOnGm`), and the roll goes
    // back for the Monocub's card - none for one it refuses, which throws nothing
    // since fix r2-H7.
async function handleCubAbility(payload, sender, ctx) {
    const { cubAbilityOnGm } = await import("./monocub.mjs");
    return { reply: await cubAbilityOnGm({ actorId: payload.actorId, key: payload.key, targetId: payload.targetId, choice: payload.choice }) };
}

/*
 * THE TWO RULINGS BY CARD CHECK WHOSE CHARACTER THEY ARE ABOUT (E01, 24.09.2026;
 * audit S14-03). Both handed the payload straight to `askHopeCallByCard` /
 * `askDynamicByCard`, which raise a `callGm` card on `payload.actorId` with the
 * sender's words on it - so any player could put a card on somebody else's
 * thread, in that character's name, asking for a ruling nobody at the table
 * requested. R1b could not see it: the handler bodies never spelled
 * `payload.actorId`, they passed the whole payload along. Both requests are made
 * by the asking player's own client with their own character's id (calls.mjs,
 * action-rolls.mjs), so the guard - an `owns` on `actorId` in each declaration
 * now - refuses nothing honest. The answer comes later, from the card, so the run
 * answers `{ later: true }`.
 */
async function handleHopeCall(payload, sender, ctx) {
    return askHopeCallByCard(payload, ctx);
}

/** The run of `call.yes` (E29 fix r2-H4): another GM's yes on a Call's card, kept and sent on by this primary. */
async function handleCallYes(payload, sender) {
    return (await yesOnPrimary(payload.rid, payload.asker, sender.id, payload.messageId))
        ? { reply: true } : { refused: "nothing was carried out: the primary GM holds no ask of that Call under that request" };
}

/** The run of `dynamic.answer` (E18 C1): another GM's difficulty or refusal on a Dynamic action's card, sent on by this primary. */
async function handleDynamicAnswer(payload, sender) {
    const ruling = payload.refuse ? false : { tier: payload.tier, trait: payload.trait };
    return (await dynamicOnPrimary(payload.rid, payload.asker, ruling, sender.id, payload.messageId))
        ? { reply: true } : { refused: "nothing was carried out: the primary GM holds no Dynamic ask under that request" };
}

/** The run of `ruling.expired` (E18 C1): the asker's clock ran out, so its card ends here. */
async function handleRulingExpired(payload, sender) {
    if (!(await expiredOnPrimary(payload.rid, sender.id))) return { refused: "nothing was carried out: the primary GM holds no ask of the sender under that id" };
}

/** The run of `ruling.received` (E18 C1): the ruling reached its asker, so its card is written as ruled here. */
async function handleRulingReceived(payload, sender) {
    if (!(await receivedOnPrimary(payload.rid, sender.id))) return { refused: "nothing was carried out: the primary GM sent the sender no ruling under that id" };
}

async function handleDifficulty(payload, sender, ctx) {
    return askDynamicByCard(payload, ctx);
}

async function handleTraitRuling(payload, sender, ctx) {
    return askTraitByCard(payload, ctx);
}

async function handleProgress(payload, sender, ctx) {
    const { asker } = ctx;
    // Sight of the project and the size of the step are the declaration's
    // guards now; progress taken back is the GM's own Reroll's - see `guardUndoIsTheGms`.
    // A Work on a Project's amount is what its roll earned, on the GMs' record (`progressOf`).
    const amount = Math.trunc(payload.amount);
    const { addProgress } = await import("./projects.mjs");
    const rolls = await import("./action-rolls.mjs");
    // The roll this progress is for, as the request arrives (E08+E28 C2): see `noteProgressFact`.
    const kept = amount > 0 && payload.rollId ? await rolls.rollOfSenderNaming(sender.id, "project", payload.rollId) : null;
    const roll = kept?.messageId === payload.rollId ? kept : null;
    // Who asked, so a finished project can fall back to them when nobody
    // recorded who proposed it; and whose character's roll it was (`owns`), so the change is that
    // character's in the entry (E36 C3): a completion row that keeps a project for a Reroll reads it.
    const result = await addProgress(payload.countdownId, amount, { by: asker, actorId: payload.actorId ?? null, kind: sender.isGM ? "gm" : "player" });
    debug(`Applied ${amount} progress to ${payload.countdownId} on behalf of a player.`, result);
    // Null: the project is not there any more - nothing was added, and the asker
    // is told so once, by the refusal (E31 review). A project that did not move
    // (already full) is an answer, whispered below; a frozen one is refused
    // before this since E08+E28 C16 (`guardProjectFrozen`).
    if (!result) return { refused: "nothing was carried out: addProgress found no such project" };
    await noteProgressFact(rolls, roll, payload.countdownId, result);

    // Report back to whoever asked.
    //
    // A player cannot see whether their request arrived, was applied, or was
    // clamped to nothing - so a project that refused to move looked exactly
    // like a socket that never fired. Now it says which of the three it was.
    const to = asker ? [asker] : [];
    if (!to.length) return;

    const line = result.changed === false
        ? game.i18n.format(result.reason ?? "DRPG.Project.alreadyFull", {
              name: result.name, current: result.from, target: result.target
          })
        : game.i18n.format("DRPG.Project.now", {
              project: result.name, current: result.to, target: result.target
          });

    await announce({
        content: `<p><strong>${game.i18n.localize("DRPG.Project.title")}</strong> - ${
            foundry.utils.escapeHTML(line)
        }</p>`,
        whisper: to
    });
}

/**
 * THE PROGRESS A PLAYER'S PROJECT ROLL ADDED, ON THE GMS' BOOKMARK (E08+E28 C2). The packet
 * names no character; a Work on a Project names its roll's message, and it is written only
 * when that is the sender's newest kept Work on a Project (`rollOfSender`). A Call's progress
 * names no roll, and a Reroll's taking back (a negative amount) writes none. What moved, from
 * the project's own answer: a full project adds 0 (a frozen one is refused before, `guardProjectFrozen`).
 */
async function noteProgressFact(rolls, roll, projectId, result) {
    if (!roll) return;
    const progress = result.changed === false ? 0 : (Number(result.to) || 0) - (Number(result.from) || 0);
    await rolls.noteRollFact(roll.actorId, roll.messageId, { projectId, progress });
}

async function handleShare(payload, sender, ctx, prepared) {
    // projects.mjs came in the declaration's `prepare`, before the guards, as it
    // was imported here: sight asked again with nothing awaited before the write.
    // The guards import, and a project resealed in between must not be shared out.
    const { canSee, shareWith } = prepared;
    if (!canSee(payload.countdownId, sender)) return { refused: "sender cannot see that project" };

    // Null: the project is not secret any more, and nothing was shared (E31 review).
    // The sender named: a share a finder of the project asked makes the one let in a finder too (E15 part 2 fix e1-G1).
    if (!await shareWith(payload.countdownId, payload.targetUserId, { senderId: sender.id })) {
        return { refused: "nothing was carried out: shareWith shared nothing" };
    }
    debug(`Shared project ${payload.countdownId} with ${payload.targetUserId} on behalf of a player.`);
}

/** The actions whose Reroll takes back the trace their roll left (reroll.mjs `settleSearch`, `settleSabotage`, `settleDynamic`). */
const TRACE_OF_ROLL = Object.freeze(["search", "sabotage", "dynamic"]);

async function handleRemnant(payload, sender, ctx) {
    /*
     * REBUILT, NOT NARROWED (CASE-13, then E03; audit S05-13, S10-10). A
     * player's action leaves a Preparation trace, or a Tamper one after a
     * murder; it never plants a Key, Final Truth or Autopsy Remnant, never a
     * reinforced one, and never decides for itself that it is tied to the
     * crime. Narrowing those three still took who left it, where, pointing at
     * whom and whether the sweep would clear it from the packet - see
     * `narrowPlayerRemnant`, which now builds every one of them here.
     */
    const { placeRemnant, narrowPlayerRemnant } = await import("./remnants.mjs");
    const { noteFactOfRoll } = await import("./action-rolls.mjs");
    let data = { ...(payload.data ?? {}) };
    if (!sender.isGM) {
        const actor = game.actors.get(data.sourceActor);
        const { locateActor } = await import("./movement.mjs");
        const { getClock } = await import("./clock.mjs");
        // Not split into a guard (E03): it refuses and rebuilds from ONE reading of
        // where the character stands, and split, the two could read two places.
        const narrowed = narrowPlayerRemnant(data, actor, locateActor(actor, { sceneId: data.sceneId ?? null }), getClock());
        if (narrowed.refused) return { refused: narrowed.refused };
        data = narrowed.data;
        /* A DISCARD'S TYPE IS THE GM'S (E14 part 1 C5, 24.10.2026; audit S08-13). `narrowPlayerRemnant` keeps the
           packet's type within Preparation and Tamper, and the discarder's browser chose it by what it could read: an
           innocent's browser cannot see whose incident runs, and a console could file a weapon's disposal as preparation.
           Filed here by the same reading on what the GMs hold (use-items.mjs `discardRemnantType`). */
        if (data.action === "discard") data.type = await (await import("./use-items.mjs")).discardRemnantType(actor);
        if (await worksOwnMurder(payload, actor, data.action, sender)) data.tiedToCrime = true;
    }
    // A trace this client could not place (no scene, no Remnant actor, a token
    // that could not be created) is a failure, not "placed" (E31 review): the
    // player's item stays on the sheet.
    const placed = await placeRemnant(data);
    if (!placed) return { refused: "the trace could not be placed" };
    /* WHICH TRACE, ON THE GMS' BOOKMARK (E08+E28 C2; audit S05-08). The player's browser is
       answered as before, with no id: a Reroll that retunes or removes this trace is the GM's
       from C4a, and finds it by this fact - the browser's `remnantRef` named none. Written on
       the row of the roll the packet names, when it is the sender's roll of this character and
       its action is one whose replay owns a trace and placed this one (fix r1-G1; the review's
       M3 = S2): until then it went on the character's newest row, whatever had placed it, and a
       discarded item's trace became the Search's before it, for that Search's Reroll to lift. A
       placement naming no roll writes none. */
    const doc = placed.document ?? placed;
    const owner = TRACE_OF_ROLL.includes(data.action) ? [data.action] : [];
    if (doc?.id && payload.rollId && owner.length) {
        await noteFactOfRoll(payload.rollId, { by: sender.id, actorId: data.sourceActor, actions: owner },
            { remnantId: doc.id, remnantScene: doc.parent?.id ?? data.sceneId ?? null });
    }
    debug("Placed a Remnant on behalf of a player.");
}

/**
 * A PLAYER'S WORK ON THEIR OWN INDIRECT MURDER IS THE CRIME'S TRACE (E32+E07 fix r2-G3, 03.10.2026;
 * the round-2 review's C2-m9 (a)). The module's own drop says so (action-rolls.mjs
 * `hideProjectTraces`: an indirect murder is the murder, built in instalments), and the rebuild
 * above drops every packet's `tiedToCrime` - so since E03 a trap built from a player's browser left
 * untied traces, which the chapter's end sweeps. Judged here on the GMs' record, not on the packet:
 * the project it names is an indirect murder, and the sender's character is its killer or the one
 * who proposed it.
 *
 * AND A SABOTAGE OF IT (E09 C5, 08.10.2026; audit S10-17). The roller's browser ties the trace of a
 * Sabotage of an indirect murder (action-rolls.mjs `dropSabotageTrace`) and the rebuild dropped that
 * too, so the killer's Sabotage of their own trap left an untied trace (read in the code at C5's parent:
 * this answered false for every action but a Work; the tier-2 tests' red is in C5's message). The
 * project is not the packet's: it is the target `handleSabotage` noted on the GMs' row of the roll the
 * trace names (`noteFactOfRoll`; parked there while the row is not kept yet - `factsOfRoll`), and that
 * row must be the sender's Sabotage roll of the trace's own character. The tie then asks the same as
 * a Work's: an indirect murder whose killer or proposer is that character (projects.mjs
 * `buildsOwnMurder`, which a GM's own drop asks too since E09 fix r1-G4). A bystander's Sabotage of
 * somebody else's trap leaves an untied trace, as the plan decided (E09 plan, C5). A Sabotage of a
 * project already frozen freezes nothing and notes its target all the same since fix r1-G4
 * (`handleSabotage`; the round-1 security review's F7): until then its trace was left undecided where
 * the same Sabotage of a trap not frozen yet was tied (tier 2 "a Sabotage of the saboteur's own trap
 * already frozen leaves a tied trace").
 */
async function worksOwnMurder(payload, actor, action, sender) {
    if (!actor) return false;
    let projectId = null;
    if (action === "project") projectId = payload.data?.projectId;
    else if (action === "sabotage") {
        const { factsOfRoll } = await import("./action-rolls.mjs");
        projectId = (await factsOfRoll(payload.rollId, { by: sender.id, actorId: actor.id, actions: ["sabotage"] }))?.targetProjectId;
    }
    if (typeof projectId !== "string" || !projectId) return false;
    const { buildsOwnMurder } = await import("./projects.mjs");
    return buildsOwnMurder(projectId, actor.id);
}

/*
 * A TRACE'S BAND IS THE GM'S (E08+E28 C15, 04.10.2026; audit S10-06; the plan's 3.5). A player's
 * Search, Sabotage or Dynamic action leaves a trace whose visibility its roll decides, and the
 * packet said which: a console could leave every trace hidden. The packet names that roll now
 * (`rollId`, as it has since fix r1-G1 for the GMs' row), and the band is read off the GMs' record
 * of it with the action's own table, as the roller's browser reads it:
 *   - a Search: the tier its total reaches with the hidden stash's step the GM drew, or the
 *     critical's band (action-rolls.mjs `searchTier`, `leaveSearchTrace`);
 *   - a Sabotage: the band its total reaches (`sabotageHit`), with the concealment's penalty and
 *     the readied tool's relief the roller claimed for that roll (the GMs' bookmark,
 *     `ROLL_CLAIMS.sabotage`), held as its repair holds them (action-rolls.mjs
 *     `sabotageExtrasHeld`) - the concealment's own roll names no action, so its Despair is not on
 *     a record yet; a miss leaves the table's `failureRemnant`. The relief was the tool readied
 *     on the sheet now until fix r2-H3 (the round-2 review's S2-9): a tool that broke on a roll
 *     with Fear was in no hand, and the trace of a Sabotage whose repair froze the project was
 *     left at a miss's band;
 *   - a Dynamic action: the difficulty a GM set on its card (`dynamicRulingOf`); a roll under it
 *     leaves no trace (`performDynamic`). The roller's band is no claim since fix r2-H3.
 * A roll that leaves no trace is refused, and a packet whose visibility differs is placed at the
 * GM's band and logged (bridge-guards.mjs `onRecord`). Whether a trace is placed at all is still
 * the roller's browser's: a console that sends no `remnant.place` leaves none, and a Work's trace
 * (`project`, not in `TRACE_OF_ROLL`) takes the band its packet names - .claude/rules/trust-model.md's "What stays
 * open" (the round-2 review's S2-8; fix r2-H7).
 */
async function traceBandOf(record) {
    let band = null;
    if (record.actionKey === "search") {
        const { searchTier } = await import("./action-rolls.mjs");
        const { hit } = searchTier(record, record.used?.stash?.change ?? 0);
        band = record.isCritical ? ACTIONS.search.critical?.remnant : hit?.remnant;
    } else if (record.actionKey === "sabotage") {
        const { sabotageHit, sabotageExtrasHeld } = await import("./action-rolls.mjs");
        const { rerollBookmarkStore } = await import("./gm-stores.mjs");
        const row = rerollBookmarkStore.get(record.actorId);
        const hit = sabotageHit(record, await sabotageExtrasHeld(record, row?.messageId === record.messageId ? row.claims : null));
        band = hit ? hit.remnant : ACTIONS.sabotage.failureRemnant;
    } else if (record.actionKey === "dynamic") {
        const ruled = DYNAMIC_THRESHOLDS[dynamicRulingOf(record)?.tier];
        if (!ruled) return { why: "no ruling of a GM's sets that roll's band" };
        band = record.isCritical || (Number(record.total) || 0) >= ruled.range[0] ? ruled.remnant : null;
    }
    return band ? { fields: { "data.visibility": band } } : { why: "that roll leaves no trace" };
}

/**
 * The difficulty a GM set on a Dynamic action's card for this roll's character: the newest ruling
 * kept in a card's meta (`keepRuling`, as the primary sends it on) within a Reroll's
 * reach of the roll, as a GM's pick of a statistic is found (roll-draw.mjs `gmPickOf`), or null.
 * `record` needs `actorId` and `at`; the Reroll's replay reads it too (reroll.mjs `settleDynamic`).
 * A card counts only where a GM wrote it (secret.mjs `cardWriter`; E29 fix r2-H2, 05.10.2026, the
 * round-2 security review's B2): until then any card's `ruling` was read, the document's flag
 * first - at a4a7f25's runtime a card a player's browser posted after a GM's was the difficulty
 * read (tier 2 and 30-security, e29run/r2h2red), and with it, by reading, the band of that
 * character's trace and of its Reroll.
 */
export function dynamicRulingOf(record) {
    const since = (record.at ?? 0) - TIMING.rerollWindowMinutes * 60_000;
    const messages = game.messages?.contents ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (typeof message.timestamp === "number" && message.timestamp < since) break;
        const ruling = cardFlag(message, "ruling");
        if (ruling?.type === "dynamic" && ruling.actorId === record.actorId && cardWriter(message)?.isGM) return ruling;
    }
    return null;
}

/*
 * WHAT A PROJECT'S ROLL EARNED IS THE GM'S (E08+E28 C16, 04.10.2026; audit S10-08, S10-06; the plan's
 * 3.5). Progress and a Sabotage's repair were the packet's numbers, held only to a range: a console
 * that named a roll of 7 added 12. The packet names its roll now, and the GM reads what it earned
 * off its record with the action's own table, as the roller's browser reads it (action-rolls.mjs
 * `projectProgress`, `sabotageHit`, `sabotageRepairScale`). What only the roller saw rides on the
 * packet and is held to what the rules allow (action-rolls.mjs `projectExtrasHeld`,
 * `sabotageExtrasHeld`, which the Reroll's replays and a Sabotage's trace read too since fix
 * r2-H3): an indirect murder's concealment adds at most `PROJECT_BONUS_MOST`, and to nothing else;
 * a Sabotage's concealment takes off at most what one thrown with Despair takes; the readied
 * tool's relief is at most the GM's reading of the sheet. Read off the packet, not the GMs'
 * bookmark of the roll, because the packet can arrive first (fix r1-G1 measured it so). A Work
 * whose roll earned nothing and claims no held bonus is refused; a Sabotage's miss is a repair of
 * 0, which freezes nothing (`handleSabotage`).
 *
 * A MISS ON A MURDER PLAN PAYS ITS HELD BONUS (E15 C2, 25.10.2026; audit S02-08, the owner's D13).
 * The concealment's bonus rides on any outcome now (action-rolls.mjs `projectProgress`), so a miss
 * that was refused here adds the bonus its packet claims, held as a hit's is: at most
 * `PROJECT_BONUS_MOST` on an indirect murder, nothing on any other project, whose miss is refused
 * as before. E15-T3 sends a miss claiming 40 to each: 1 and refused.
 */
async function progressOf(record, payload) {
    const { projectProgress, projectExtrasHeld } = await import("./action-rolls.mjs");
    const { progress } = projectProgress(record, await projectExtrasHeld(record, { relief: payload.relief, bonus: payload.bonus }, payload.countdownId));
    return progress > 0 ? { fields: { amount: progress } } : { why: "that roll earned no progress" };
}

async function repairOf(record, payload) {
    const { sabotageHit, sabotageRepairScale, sabotageExtrasHeld } = await import("./action-rolls.mjs");
    const { penalty, relief } = await sabotageExtrasHeld(record, { penalty: payload.penalty, relief: payload.relief });
    const hit = sabotageHit(record, { penalty, relief });
    return { fields: { difficulty: hit ? sabotageRepairScale(record, (Number(record.total) || 0) + penalty, relief) : 0 } };
}

async function handleTieTrace(payload, sender, ctx) {
    // Only the one holding the object, and only in the fight - see `guardTieTraceHolder`.
    const { tieTraceForItem } = await import("./remnants.mjs");
    await tieTraceForItem(payload.identity);
}

async function handleRemnantEdit(payload, sender, ctx) {
    /*
     * NARROWED, NOT FORWARDED.
     *
     * This used to hand the player's patch straight to `retuneRemnant`, and
     * that was survivable while the only field was a visibility band. G-20
     * gave the function a `type`, and type is a different kind of power: a
     * killer relabelling their own Incident trace as Faint would have the
     * chapter-end sweep clear the crime scene for them, and one relabelled
     * as Key would put a fake anchor into the investigation.
     *
     * So the two fields are read out by name and checked against the same
     * lists the rules use, and everything else in the packet is dropped.
     * `remove` stays as it was - it is the Reroll's own half and
     * `retuneRemnant` already refuses to delete a reinforced trace.
     */
    const { REMNANT_VISIBILITY_LABELS, CLEANUP } = await import("./config.mjs");
    const asked = payload.patch ?? {};
    const narrowed = { remove: Boolean(asked.remove) };
    if (REMNANT_VISIBILITY_LABELS[asked.visibility]) narrowed.visibility = asked.visibility;
    // The type is a GM's to change, never a player's (and since E08+E28 C8 no
    // player edits a trace at all): a player's Reroll sent a band and nothing
    // else, and a trace's type decides who may tamper with it and how hard it
    // is to Observe (E03 second review). The killer's own re-typing goes through cleanup.mjs on the GM.
    if (sender.isGM && CLEANUP.transform?.types?.includes(asked.type)) narrowed.type = asked.type;

    const { retuneRemnant } = await import("./remnants.mjs");
    // Null: no such token, a reinforced trace asked to go, or nothing to change -
    // nothing was done (E31 review), and it is told as refused.
    if (!await retuneRemnant(payload.sceneId, payload.tokenId, narrowed)) {
        return { refused: "nothing was carried out: retuneRemnant changed nothing" };
    }
    debug(`Retuned a Remnant on behalf of ${sender.name}.`, narrowed);
}

async function handleSabotage(payload, sender, ctx) {
    const { sabotageProject } = await import("./projects.mjs");
    const rolls = await import("./action-rolls.mjs");
    /* The repair is what the roll earned, on the GMs' record (`repairOf`); 0 is a miss, which
       freezes nothing and names its target for the GM's Reroll of it (E08+E28 C16; the
       orchestrator's decision of 04.10.2026): until fix r1-G1 the roller's bookmark kept the
       target of any Sabotage, and since then the GM learns it only from this packet, so a miss
       rerolled into a success froze nothing. */
    const difficulty = Math.trunc(payload.difficulty);
    // Who asked, so that only their own Reroll can take it back (E03).
    const result = difficulty > 0 ? await sabotageProject(payload.targetId, difficulty,
        { saboteur: sender.isGM ? null : sender.id }) : null;
    /* Which project it froze and the repair it made, for the Reroll's undo on a GM (C4a), on the
       row of the roll the packet names (fix r1-G1; the review's B1). The sender's newest Sabotage
       row, read as the packet arrived, was the previous Sabotage's or none: `roll.bookmark`'s run
       ended after this one in 5 of 5 of the review's runs at f941051 (2 of 3 of its 97 at d20fadb),
       and the Reroll into a miss left the project frozen. The fact now waits for its row (`noteFactOfRoll`); a packet naming no roll
       writes none. Since E09 C5 the fact names the packet's character too: the trace that follows reads
       its target off this fact to decide its tie, and asks it of the trace's character (`worksOwnMurder`);
       `owns` and the roll's record (`rolled.actor`) have held `actorId` to the sender's and the roll's.
       And whatever the freeze did (E09 fix r1-G4, 08.10.2026; the round-1 security review's F7): a
       Sabotage of a project frozen since its picker was drawn freezes nothing, and noted nothing, so
       its trace was left undecided where the C5 rule ties the saboteur's own. The target is the one
       the roll was drawn for (`rolled.named`) and the sender can see (`canSeeProject`); the repair is
       noted only when one was made, so a Reroll of it takes back nothing (reroll.mjs `settleSabotage`). */
    if (payload.rollId) {
        await rolls.noteFactOfRoll(payload.rollId, { by: sender.id, actorId: payload.actorId ?? null, actions: ["sabotage"] },
            { targetProjectId: payload.targetId, repairId: result?.repair?.id ?? null });
    }
    if (!difficulty) return { reply: null };

    // Tell the asker what actually happened - not just that the request
    // arrived. Without this a player's own sabotage always reported success
    // and a repair project by name, whether or not the freeze and the
    // repair it depends on were ever written. The runner addresses the answer
    // to them alone: a broadcast announced every sabotage - and the name of
    // the repair project it created - to the whole table, which is the one
    // thing a saboteur is buying secrecy for. Null - no such project, one already
    // frozen, a repair - froze nothing, and is a refusal, not an answer (E31 review).
    if (!result) return { refused: "nothing was carried out: sabotageProject froze nothing" };
    return { reply: result };
}

/**
 * Another GM's change of a project, on the primary (E36 C1): the change cut to the keys the step knows
 * (projects.mjs `cleanProjectChange`), `by` that GM's claim of whose change it is, which a GM may make -
 * the kind and the character as named, the user one of this world's or the sender. Answers the step's
 * result; a change of nothing, or of a project that is gone, carried out nothing.
 */
async function handleProjectChange(payload, sender) {
    const { applyProjectChange, cleanProjectChange } = await import("./projects.mjs");
    const change = cleanProjectChange(payload.change);
    if (!change) return { refused: "nothing was carried out: the change named nothing the step knows" };
    const by = payload.by && typeof payload.by === "object" ? payload.by : {};
    const result = await applyProjectChange(payload.countdownId, change, {
        by: { kind: by.kind, userId: game.users.get(by.userId ?? "") ? by.userId : sender.id, actorId: by.actorId ?? null }
    });
    if (!result) return { refused: "nothing was carried out: applyProjectChange found no such project" };
    return { reply: result };
}

async function handleUnsabotage(payload, sender, ctx) {
    // A GM's alone since E08+E28 C8 (`guardUndoIsTheGms`); the pair is still asked (`unsabotageRefusal`).
    const { undoSabotage } = await import("./projects.mjs");
    // Null: `unsabotageRefusal` kept it to the GM's console - nothing was undone (E31 review).
    if (!await undoSabotage(payload.targetId, payload.repairId, { senderId: sender.isGM ? null : sender.id })) {
        return { refused: "nothing was carried out: undoSabotage undid nothing" };
    }
}

async function handleSendback(payload, sender, ctx, prepared) {
    // `REVERT` came in the declaration's `prepare`, before the guard, so the
    // guard's judgement and the write below have nothing but microtasks between
    // them. Back, and only back - see `guardSendbackPlace`.
    const token = game.scenes.get(payload.sceneId)?.tokens?.get(payload.tokenId);
    // Read out by name (E03): x and y, and elevation and level only when asked.
    const asked = payload.position ?? {};
    const to = { x: Number(asked.x), y: Number(asked.y) };
    if (asked.elevation !== undefined) to.elevation = Number(asked.elevation);
    if (asked.level !== undefined) to.level = asked.level;
    // Marked as the bridge's (E12 C12): the witness judge reads a send-back as the player's own
    // revert, though this GM writes it - honoured only back to where the judge left the token.
    // The mark names the player who asked (E79 fix r2-G1; review r2, SEC M1): the GMs' audit judges
    // the write as that player's own revert (movement-audit.mjs `askerOf`). Walls ignored (E79 C4):
    // the place is a spot of the GMs' record or the centre of a room the token stood in within the
    // minute (`guardSendbackPlace`), and a wall between the two must not stop the way back
    // (movement.mjs `sendBack`'s note); a centre across a wall is the audit's to judge.
    await token.update(to, { animate: false, [prepared.REVERT]: true, [prepared.SENT_BACK]: sender.isGM ? false : sender.id, constrainOptions: { ignoreWalls: true } });
}

async function handleLoot(payload, sender, ctx) {
    const { lootBody } = await import("./handover.mjs");
    // Everything else it needs to refuse `lootBody` checks itself, because the GM's own
    // button goes through the same door. The one gate's refusals - the room, both lives,
    // the death the taker knows, the phase, the Eclipse (inventory.mjs `transferRefusal`;
    // E14 part 1 C1) - and an item no GM has decided on (E29 fix r2-H21) come back with
    // their reason and are told by its code. It answers null when it took nothing for any
    // other reason (a Truth Bullet, full hands with no stash), with its reason on the GM's
    // console, and the asker is told only that nothing was carried out (E31 review).
    const taken = await lootBody({
        takerId: payload.takerId, bodyId: payload.bodyId, itemId: payload.itemId, askedBy: sender.isGM ? null : sender.id
    });
    if (taken?.refused) return { refused: taken.refused };
    if (!taken) return { refused: "nothing was carried out: lootBody took nothing" };
}

async function handleArm(payload, sender, ctx, prepared) {
    // What a player may arm on somebody else or on their own character (E29 C8), and who pays - see `guardArmPlayerCall`.
    // The beneficiary was read once, in the declaration's `prepare` - before any
    // guard imports - and is handed down, so a character deleted in between fails
    // the write (and the player's Hope goes back) instead of being re-read as nobody.
    const { actor, appendArmedCall } = prepared;
    if (!sender.isGM) return armPaidByPlayer(actor, sender, payload, ctx, prepared);

    // `appendArmedCall` came before the guards too: the check and the append that
    // follows it have nothing but microtasks between them (CALL-02 refuses a second copy).
    const twice = await firstRefusal(sender, payload, ctx, guardArmNotHeld);
    if (twice) return { refused: twice };
    const call = HOPE_CALLS[payload.call.key] ?? DESPAIR_CALLS[payload.call.key];
    const kind = HOPE_CALLS[payload.call.key] ? "hope" : "despair";

    // Appended, not written over: Calls stack (CALL-02). Armed on that GM's word (E29 fix r2-H7, `by`).
    await appendArmedCall(actor, armedEntry(payload.call, call, kind), { by: sender });
    debug(`Armed ${payload.call.key} on ${actor.name} on behalf of ${sender.name}.`);
    void tellBeneficiary(actor, kind, call.grants);
    return { reply: { ok: true, left: null } };
}

/**
 * The armed entry as this side builds it: the table's `grants`, never the packet's extras. Who
 * paid is the request's (`armBuyerId`) and is not stored (E06 C10; call-effects.mjs `unsigned`).
 */
function armedEntry(asked, call, kind) {
    return {
        key: asked.key, kind, grants: call.grants,
        amount: null,
        nonce: String(asked.nonce ?? foundry.utils.randomID()).slice(0, 32)
    };
}

/**
 * The beneficiary is not the buyer: tell them what they have been given, or they
 * will meet a locked roll dialog with no idea why it opened up.
 *
 * Started and not waited for, and never thrown: the Call is armed and paid for
 * by now, and the runner sends the buyer their answer as soon as the run
 * returns, whatever the whisper does. A whisper that failed used to take the
 * answer down with it - the buyer waited out the clock and was told "not armed,
 * not charged" about a Call that was both (the E03 review).
 */
async function tellBeneficiary(actor, kind, grants) {
    try {
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.armedTitle")
        })}<p>${
            game.i18n.format(kind === "despair" ? "DRPG.Calls.armedByMonokuma" : "DRPG.Calls.armedForYou", {
                what: game.i18n.localize(`DRPG.Calls.grants.${grants}`)
            })
        }</p>`);
    } catch (err) {
        error(`Could not tell ${actor?.name ?? "the beneficiary"} about the Call armed for them`, err);
    }
}

/**
 * A player's Call - a Support on somebody else's character, or since E29 C8 a Call on
 * their own: checked, charged and armed on this side, in that order, and refunded if
 * the arming itself fails. Asks its own guards (the declaration's `runGuards`): the
 * player's road has checks the GM's does not, and the replayed purchase below answers
 * "armed" between them. The buyer is told by the answer; only somebody else is
 * whispered to.
 */
async function armPaidByPlayer(actor, sender, payload, ctx, prepared) {
    const who = await firstRefusal(sender, payload, ctx, guardArmBuyer, guardArmOtherCharacter);
    if (who) return { refused: who };
    const buyer = game.actors.get(armBuyerId(payload));
    const call = HOPE_CALLS[payload.call.key];

    // The same purchase asked twice - a GM who came back and was asked again
    // (`resendOnGmReady`) after arming it - is answered, not charged again.
    // Not a guard, and asked before the three below: it answers "armed" rather
    // than refusing, and a purchase already paid for can fail the Hope check it
    // passed the first time.
    const { appendArmedCall, pendingCalls, gmMeansWrite, trustedWrite } = prepared;
    const nonce = String(payload.call.nonce ?? "").slice(0, 32);
    if (nonce && pendingCalls(actor).some(entry => entry.nonce === nonce)) return { reply: { ok: true, left: null } };

    // `guardArmLiving` is asked after every refusal a living beneficiary would get as
    // well (E05 fix r2-G3): see its note. A Call that waits for the GM's yes takes the one
    // the primary kept for it just before (E29 fix r2-H4): see `guardArmGmYes`.
    const why = await firstRefusal(sender, payload, ctx, guardArmHopeCallAllowed, guardArmNotHeld, guardArmBuyerHope, guardArmGmYes, guardArmLiving);
    if (why) return { refused: why };
    // Paid from the Hope the GMs hold, in the buyer's audit queue (sheet-audit.mjs `gmMeansWrite`,
    // E29 fix r1-G5): a forged Hope that landed while the guards ran is judged before this write or
    // after it, never under it - so `guardArmBuyerHope`'s question is asked again here, of that value.
    const paid = await gmMeansWrite(buyer, async ({ hope }) => {
        if (hope < call.cost) return { held: hope, left: null };
        await trustedWrite(buyer, { "system.resources.hope.value": hope - call.cost }, { reason: "call" });
        return { held: hope, left: hope - call.cost };
    });
    if (paid.left === null) return { refused: `the buyer holds ${paid.held} Hope, the Call costs ${call.cost}` };
    try {
        // The player's own purchase: armed on their word, so it carries no GM's `by` (E29 fix r2-H7).
        await appendArmedCall(actor, armedEntry(payload.call, call, "hope"), { by: sender });
    } catch (err) {
        error(`Could not arm ${payload.call.key} on ${actor.name}; the Hope goes back`, err);
        await gmMeansWrite(buyer, ({ hope }) => trustedWrite(buyer, { "system.resources.hope.value": hope + call.cost }, { reason: "refund" }));
        return { refused: "the Call could not be armed" };
    }
    debug(`Armed ${payload.call.key} on ${actor.name}, paid by ${buyer.name} on this side.`);
    if (buyer.id !== actor.id) void tellBeneficiary(actor, "hope", call.grants);
    return { reply: { ok: true, left: paid.left } };
}

/** The run of `overflow.add` (E17 C5): the primary's own `addOverflow`, its count after, or a refusal when nothing was added. */
async function handleOverflowAdd(payload, sender, ctx) {
    const { addOverflow } = await import("./overflow.mjs");
    const after = await addOverflow(Math.trunc(payload.amount), { reason: payload.reason || `asked by ${sender.name}` });
    if (after === null) return { refused: "nothing was carried out: the overflow took nothing" };
    return { reply: { after } };
}

async function handleDespair(payload, sender, ctx) {
    // A GM's alone since E08+E28 C8, as a Reroll's point is the GM's own (reroll.mjs); the size
    // and the pool are the declaration's guards.
    const delta = Math.trunc(payload.delta);
    const target = game.users.get(payload.targetUserId);
    const { adjustDespair } = await import("./despair.mjs");
    await adjustDespair(target.id, delta, { clamp: payload.clamp === true });
    debug(`Adjusted Despair for ${target.name} by ${delta} on behalf of ${sender.name}.`);
}

    // An Eclipse crossing. Counted on this side, where the allowance is judged since E05
    // (a crossing beyond it is refused, and counts nothing); the answer's `used`/`left` are
    // not read by the mover's own sheet, which redraws off its copy of the store, but by 33's
    // B13 and 30 - the two places that check what the count came back as (E05 fix r1-G5, M10).
async function handleEclipseMove(payload, sender, ctx) {
    const { applyRecordedMove } = await import("./eclipse.mjs");
    const out = await applyRecordedMove(payload.actorId, { to: payload.to });
    if (!out) return { refused: "nothing was carried out: no Eclipse is running, or no such character" };
    if (out.refused) return { refused: out.refused };
    return { reply: { used: out.used, left: out.left } };
}

/**
 * A player's own pre-session note (E05 C6; audit S11-03, S01-08), into the GMs' store
 * under the sender's id: the user Foundry names, since the packet names nobody - one
 * that carries another user's id writes only its sender's own note. Past the player
 * text cap it is refused, as a private card is (secret.mjs). The answer is when the
 * store wrote it and the row's stamp, which the player's copy takes as the GMs' own.
 */
async function handleNoteSave(payload, sender) {
    const { writeNote, noteTooLong } = await import("./pre-session-note.mjs");
    if (noteTooLong(payload.text)) return { refused: "the note is longer than a player's words may be" };
    const out = await writeNote(sender.id, payload.text, { byGm: false });
    if (!out) return { refused: "nothing was carried out: the note's writer is not a user of this world" };
    return { reply: { updatedAt: out.updatedAt, stamp: out.stamp } };
}

/** The run of `roll.bookmark` (E08+E28 C2): the guards tied the message to the sender and the character to them. */
async function handleRollBookmark(payload, sender) {
    const { keepGmBookmark } = await import("./action-rolls.mjs");
    await keepGmBookmark({
        actorId: payload.actorId,
        messageId: payload.messageId,
        actionKey: payload.actionKey,
        trait: payload.trait,
        experiences: payload.experiences,
        context: payload.context,
        reportMessageId: payload.reportMessageId
    }, sender);
}

/**
 * The run of `reroll.ask` (E08+E28 C4a): the GM makes the sender's Reroll of their character
 * and answers the lines of the Call's card, or refuses with why - before anything was paid,
 * or after giving back what was.
 */
async function handleReroll(payload, sender) {
    const { rerollOnGm } = await import("./reroll.mjs");
    const out = await rerollOnGm(game.actors.get(payload.actorId), sender);
    if (out?.refused) return { refused: out.refused };
    return { reply: { lines: out?.lines ?? [] } };
}

/** The run of `audit.decide` (E29 C5): the primary's own decision (sheet-audit.mjs `decideWrite`), recorded as the asking GM's. */
async function handleAuditDecide(payload, sender) {
    const { decideWrite } = await import("./sheet-audit.mjs");
    return { reply: await decideWrite(payload.rowId, payload.keep, sender.id) };
}

/** The run of `keys.charge` (E09 fix r1-G3): the primary's own charge (investigation.mjs `chargeForUnfoundKeys`), what was paid or null. */
async function handleKeysCharge() {
    const { chargeForUnfoundKeys } = await import("./investigation.mjs");
    return { reply: await chargeForUnfoundKeys() };
}

/** The run of `vote.run` (E10 C1): the primary's own step of the vote (vote.mjs `runVoteOp`), its reply or status. */
async function handleVoteRun(payload) {
    const { runVoteOp } = await import("./vote.mjs");
    return { reply: await runVoteOp(payload.op, { picks: payload.picks }) };
}

/** The run of `vote.cast` (E10 C2): the primary's own judgement and record of the sender's ballot (vote.mjs `recordBallot`). */
async function handleBallot(payload, sender) {
    const { recordBallot } = await import("./vote.mjs");
    const out = await recordBallot(sender, payload.round, payload.choice);
    if (out.refused) return { refused: out.refused };
    return { reply: out.reply };
}

/** The run of `vote.ask` (E10 C2): the sender's own ballot, as the primary holds the vote (vote.mjs `ballotFor`), or null. */
async function handleBallotAsk(payload, sender) {
    const { ballotFor } = await import("./vote.mjs");
    return { reply: await ballotFor(sender) };
}

/**
 * The run of `floor.now` (E10 fix r2-G6): the primary's own Now, under its heartbeat's latch (trial-floor.mjs
 * `advanceFloorOnPrimary`), on the floor the pressing GM saw (r2-G7). A floor that moved on is refused here, so that
 * GM is told; `advanceFloorOnPrimary` holds the same comparison in the same synchronous step for the local road.
 */
async function handleFloorNow(payload) {
    const { advanceFloorOnPrimary, floorAsSeen } = await import("./trial-floor.mjs");
    const seen = { mode: payload.mode, startedAt: payload.startedAt };
    if (!floorAsSeen(seen)) return { refused: "the trial's floor has moved on since that Now was pressed" };
    return { reply: await advanceFloorOnPrimary(seen) };
}

/** The run of `trial.object` (E79 C16): the primary's judgement of the press, its payment and its pending card (trial.mjs `objectOnPrimary`). */
async function handleTrialObject(payload) {
    const { objectOnPrimary } = await import("./trial.mjs");
    const out = await objectOnPrimary({ actorId: payload.actorId, targetId: payload.targetId });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `trial.evidence` (E79 C16): the Truth Bullet on the objector's own pending card (trial.mjs `evidenceOnPrimary`). */
async function handleTrialEvidence(payload) {
    const { evidenceOnPrimary } = await import("./trial.mjs");
    const out = await evidenceOnPrimary({ actorId: payload.actorId, itemId: payload.itemId, comment: payload.comment });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `trial.withdraw` (E79 fix r4-G2): the objector's own pending Objection taken back (trial.mjs `withdrawOnPrimary`). */
async function handleTrialWithdraw(payload) {
    const { withdrawOnPrimary } = await import("./trial.mjs");
    const out = await withdrawOnPrimary({ actorId: payload.actorId, messageId: payload.messageId });
    if (out?.refused) return { refused: out.refused };
}

/** The run of `floor.repoint` (E79 C16): a GM's new target for the running Objection (trial.mjs `repointOnPrimary`). */
async function handleFloorRepoint(payload) {
    const { repointOnPrimary } = await import("./trial.mjs");
    const out = await repointOnPrimary({ targetId: payload.targetId });
    if (out?.refused) return { refused: out.refused };
    return { reply: out?.reply ?? null };
}

/** The run of `cleanup.ruling` (E09 C10): the primary's own ruling (cleanup.mjs `ruleReshape`), recorded as the asking GM's. */
async function handleReshapeRuling(payload, sender) {
    const { ruleReshape } = await import("./cleanup.mjs");
    return { reply: await ruleReshape({ actorId: payload.actorId, tokenId: payload.tokenId, attempt: payload.attempt,
        verdict: payload.verdict }, sender.id) };
}

/** The run of `observe.pick` (E09 C12): a GM's pick or refusal on an Observe card, held to the ask this primary keeps (`observePickOnPrimary`). */
async function handleObservePick(payload, sender) {
    return { reply: await observePickOnPrimary({ rid: payload.rid, actorId: payload.actorId, tokenId: payload.tokenId,
        refuse: payload.refuse }, sender.id) };
}

/** The run of `card.claim` (E18 C3): a GM's claim of a card, decided on this primary (`claimOnPrimary`). */
async function handleCardClaim(payload, sender) {
    if (!payload.step) return { refused: "nothing was carried out: a claim names no step it knows" };
    return { reply: await claimOnPrimary(payload.messageId, payload.step, sender.id) };
}

/** The run of `card.post` (E08+E28 fix r2-H5): the sender's card, posted by this GM (secret.mjs `postAsked`), or why not. */
async function handleCardPost(payload, sender) {
    const { postAsked, cardTooLong } = await import("./secret.mjs");
    if (cardTooLong(payload.content, payload.flags)) return { refused: "the card is longer than a player's words may be" };
    const message = await postAsked(sender, { content: payload.content, whisper: payload.whisper, speaker: payload.speaker,
        flags: payload.flags, summary: payload.summary, veiled: payload.veiled });
    if (!message) return { refused: "nothing was carried out: the card could not be posted" };
    return { reply: { id: message.id } };
}

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
        claims: { rid: "expiredOnPrimary (gm-bridge.mjs) ends only an ask this primary holds or answered under that id, asked by the sender" }
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
        claims: { data: "a player's is rebuilt from a whitelist by narrowPlayerRemnant (remnants.mjs), its visibility the GM's band where its action's roll leaves it (traceBandOf), a discard's type the GM's (use-items.mjs discardRemnantType); a GM's is placed as written",
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
        sanitize: pick({ mode: as.oneOf("objection", "rebuttal"), startedAt: as.num }),
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
            targetId: "read by trial.mjs objectOnPrimary only while the primary GM has no voice Room (trial-speakers.mjs speakerRoomOpen), then held by targetRefusal (trial-floor.mjs mayObjectTo) to a student alive as the table knows it (chapter.mjs livingStudents) the floor lets the objector aim at, and with none named answered needName with nothing paid; with a Room it is not read"
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
        sanitize: pick({ actorId: as.id, itemId: as.id, comment: as.text }),
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
            targetId: "held by trial.mjs repointOnPrimary to a living student the floor lets the objector aim at (trial-floor.mjs mayObjectTo); a GM's request only"
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
export function requestEvidence({ actorId, itemId, comment = "" }) {
    return ask(ACTION_TRIAL_EVIDENCE, { actorId, itemId, comment }, {
        onPrimary: true,
        local: () => import("./trial.mjs").then(m => m.evidenceOnPrimary({ actorId, itemId, comment })).then(out => {
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

/*
 * A RULING THAT NEEDS A HUMAN IS A CARD, LIKE EVERY OTHER RULING (COMM-04).
 *
 * A Hope Call that needs the GM (Experience, Ultimate) and a Dynamic action
 * used to open a DialogV2 on the primary GM's client and nowhere else: no
 * card, no popup, no sound, and a second GM never learned the question
 * existed. If that dialog sat behind a sheet the player waited out the whole
 * timeout looking at nothing. Now both are `callGm` cards in the player's
 * thread with the answers on them - any GM may press either - and the answer
 * travels back as the request's `bridge.done` (`answerHopeCall`,
 * `answerDynamic`).
 *
 * `askedByCard` is the dedupe: a player's client asks again for an unanswered
 * ruling when a GM's world finishes loading, and the card is already up.
 */
const askedByCard = new Set();

/**
 * The Calls' asks this primary put on a card, by request (E29 fix r2-H4): who asked, for which
 * character, which Call and which purchase - what a GM's yes is kept for (`yesOnPrimary`), read
 * from the ask as it arrived and never from the card's buttons. The oldest go first.
 */
const callAsks = new Map();
const CALL_ASKS_KEPT = 100;

/**
 * The Dynamic actions' asks this primary put on a card, by request (E18 C1): who asked, for which
 * character, and the card - what a GM's ruling is sent on for (`dynamicOnPrimary`). The oldest go first.
 */
const dynamicAsks = new Map();

/**
 * Keep an ask, and the card it was put on once it is posted (`messageId`, E18 C1); the oldest go first. With
 * `expires`, the card ends at that time if nothing ended it before (`endAtExpiry`, E18 C2).
 */
function holdAsk(asks, requestId, held, expires = null, extra = {}) {
    asks.set(requestId, { ...held, ...extra, messageId: null, expires: Number.isFinite(expires) ? expires : null });
    while (asks.size > CALL_ASKS_KEPT) asks.delete(asks.keys().next().value);
    return message => {
        const kept = asks.get(requestId);
        if (kept && message?.id) kept.messageId = message.id;
        if (message?.id && expires) endAtExpiry(message.id, expires);
    };
}

/*
 * AN ASK ASKED AGAIN FINDS ITS CARD (E18 C2, 19.10.2026; audit S10-24). `askedByCard` is in memory, so a primary
 * that reloaded mid-question, or a GM that became the primary, was asked again by the waiting player (bridge-guards.mjs
 * `resendOnGmReady`) and posted a second card for the same ask. The card a GM posts for an ask carries its mark,
 * `rid` - the ask's id and its asker - in the meta its words travel with (`callGm`), and before posting the primary
 * looks for it: found, the ask is held again on that card, and nothing is posted; found and settled, the ask is
 * refused, since its card is ruled or ended. Only a GM's card counts: a player's own message can carry any flag on
 * its document, and a card a GM posted at a player's asking has the GM for its author, so a player's meta may not
 * carry the mark (secret.mjs `GM_META`). Tier 2's "a resent ask finds the card a GM posted for it" reads each road;
 * scenario 61's phase Y drives the primary's reload and a handover.
 *
 * WHAT THE CARD WAS POSTED FOR IS THE MARK'S, NOT THE RESENT PACKET'S (E18 fix early-C2-G2, 20.10.2026; the early
 * review's C2-F1). The ask was held again with the resent packet's own character, Call and purchase, while the card
 * kept showing the first packet's: a player's console resent its Experience's id naming an Ultimate and another
 * purchase, the card still read "Experience", and a GM's yes on it was kept for the Ultimate - as a Dynamic card's
 * difficulty was kept for another of the player's characters. The mark holds what the card was posted for now - its
 * kind, the character, and a Call's key and purchase (`askMark`) - and a resend that differs from it in any of them is
 * refused (`sameAsk`): an honest browser resends the packet it sent (bridge-guards.mjs `resendOnGmReady`), so the ask
 * held again is the mark's, field for field. A primary that cannot read the old card's mark posts a second card for
 * the resend, and a GM's press then goes to the ask held on the card pressed and no other (`yesOnPrimary`,
 * `dynamicOnPrimary`). Tier 2's "a resent ask is held again only as its card's mark says" and "a GM's yes or ruling
 * goes to the ask held on the card it was pressed on" read both; at a3ee6f8 each yes and ruling went to the resend.
 */

/** An ask's mark on its card: its id and asker, and what it was asked for - the held ask's own fields, by kind. */
function askMark(ctx, kind, held) {
    const { userId, messageId, ...asked } = held;
    return { id: ctx.requestId, asker: ctx.asker, kind, ...asked };
}

/** Is this ask, asked again, the one its card's mark says the card was posted for - same kind, every field the same? */
function sameAsk(mark, kind, held) {
    if (!mark || typeof mark !== "object" || mark.kind !== kind || mark.asker !== held.userId) return false;
    const { userId, messageId, ...asked } = held;
    return Object.entries(asked).every(([field, value]) => mark[field] === value);
}

/** The card a GM posted for this ask, by its mark, the newest first; null when there is none. */
function cardOfAsk(requestId, asker) {
    const messages = game.messages?.contents ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (!(message.author ?? message.user)?.isGM) continue;
        const mark = cardFlag(message, "rid");
        if (mark?.id === requestId && mark.asker === asker) return message;
    }
    return null;
}

/** The time an ask's card is open until, as its words say (`data-expires`), or null. */
function askCardExpiry(message) {
    const wrap = document.createElement("template");
    wrap.innerHTML = contentOf(message);
    const at = Number(wrap.content.querySelector("[data-expires]")?.getAttribute("data-expires"));
    return Number.isFinite(at) && at > 0 ? at : null;
}

/**
 * An ask arriving that this primary may have seen before: `{ later }` for one it holds or is posting, or whose
 * card it found and holds again; `{ refused }` for one whose card is settled, or whose card's mark says it was posted
 * for another ask (fix early-C2-G2); null for a new ask, to be posted.
 */
async function askAgain(asks, ctx, kind, held, extra = {}) {
    if (!ctx.requestId) return { later: true };
    const card = cardOfAsk(ctx.requestId, ctx.asker);
    if (card) {
        const { MESSENGER_FLAGS } = await import("./messenger.mjs");
        if (cardFlag(card, MESSENGER_FLAGS.settled)) return { refused: "that ask's card has already been settled" };
        if (!sameAsk(cardFlag(card, "rid"), kind, held)) return { refused: "that ask's card was posted for another ask" };
    }
    if (askedByCard.has(ctx.requestId)) return { later: true };
    if (!card) return null;
    askedByCard.add(ctx.requestId);
    holdAsk(asks, ctx.requestId, held, askCardExpiry(card), extra)(card);
    return { later: true };
}

/*
 * AN ASK'S CARD ENDS AT THE TIME IT SHOWS (E18 C2, 19.10.2026; the stage's doneWhen "in a time the card shows"). The
 * card says until when it is open ("Open until 21:35.", `data-expires`, on the server's clock), the time its asker's
 * clock runs out. A player whose browser closed sends no expiry (E18 C1's `ruling.expired`), and a primary that
 * reloaded holds no ask, so such a card stayed open: the primary now ends each card at its time and `TIMING.ackMs`
 * after, the asker's own expiry having come first when there was one (`endAtExpiry`), and at its ready, or when it
 * becomes the primary, ends a GM's open marked card whose time has passed and sets the rest (`sweepAskCards`).
 */
const expiryTimers = new Map();

function endAtExpiry(messageId, expires) {
    if (!messageId || !Number.isFinite(expires)) return;
    clearTimeout(expiryTimers.get(messageId));
    const left = expires - serverNow();
    expiryTimers.set(messageId, setTimeout(() => void expireAskCard(messageId), left > 0 ? left + TIMING.ackMs : 0));
}

/**
 * A card's time ran out: what this primary holds for it is dropped, and it ends - as expired, unless a ruling went
 * to its asker before (`endSentOn`): one this primary holds, or one its mark says went before a reload (`sentOnMark`).
 */
async function expireAskCard(messageId, leaving = null) {
    expiryTimers.delete(messageId);
    if (!isPrimaryGm({ leaving })) return;
    for (const asks of heldAskMaps()) {
        for (const [rid, held] of asks) if (held.messageId === messageId) asks.delete(rid);
    }
    let sentOn = null;
    for (const [rid, sent] of answeredAsks) {
        if (sent.messageId !== messageId) continue;
        clearTimeout(sent.timer);
        answeredAsks.delete(rid);
        sentOn = sent;
    }
    sentOn ??= sentOnMark(game.messages.get(messageId ?? ""));
    await (sentOn ? endSentOn(sentOn) : endExpired(messageId));
}

/**
 * The primary's pass over the GMs' open marked cards: past their time ended now, the rest ended at it. `leaving`
 * names the GM whose leaving made this client the primary, as `isPrimaryGm` takes it.
 */
export async function sweepAskCards({ leaving = null } = {}) {
    if (!isPrimaryGm({ leaving })) return;
    const { MESSENGER_FLAGS } = await import("./messenger.mjs");
    const now = serverNow();
    for (const message of game.messages?.contents ?? []) {
        if (!(message.author ?? message.user)?.isGM || !cardFlag(message, "rid") || cardFlag(message, MESSENGER_FLAGS.settled)) continue;
        const expires = askCardExpiry(message);
        if (expires === null) continue;
        if (expires <= now) await expireAskCard(message.id, leaving);
        else endAtExpiry(message.id, expires);
    }
}

async function askHopeCallByCard(payload, ctx) {
    const held = { userId: ctx.asker, actorId: payload.actorId ?? "", key: payload.key ?? "", nonce: payload.nonce ?? "" };
    const again = await askAgain(callAsks, ctx, "call", held);
    if (again) return again;
    askedByCard.add(ctx.requestId);
    const expires = serverNow() + TIMING.hopeCallRulingMs;
    const onPosted = holdAsk(callAsks, ctx.requestId, held, expires);
    const actor = game.actors.get(payload.actorId ?? "");
    const data = { rid: ctx.requestId, asker: ctx.asker, by: payload.actorId ?? "" };
    /*
     * THE PRICE FROM THIS SIDE'S TABLE, NOT THE PACKET'S (E02, 24.09.2026; audit
     * S10-02). `cost` was the one field on this card printed raw - into
     * `game.i18n.format`, then into the card's HTML - so a packet carrying
     * `<img src=x onerror=...>` as its cost ran script on every GM's screen. The
     * GM holds the same `HOPE_CALLS`, so the number never had to travel; a key
     * this side does not know prints as "?". Every other field is escaped, and
     * since E31 `cost` is not on the declaration's whitelist at all.
     */
    const call = HOPE_CALLS[payload.key] ?? null;
    const posted = await callGm(actor, {
        title: game.i18n.format("DRPG.Calls.approveTitle", { call: call?.label ?? payload.callLabel ?? "" }),
        request: payload.note ?? "",
        body: `<p>${esc(payload.effect ?? "")}</p><p class="notes">${
            game.i18n.format("DRPG.Calls.approveCost", { cost: Number.isFinite(call?.cost) ? call.cost : "?" })}</p>`,
        gmBody: game.i18n.localize("DRPG.Calls.approveHint"),
        actions: [
            { action: "approveCall", label: game.i18n.localize("DRPG.Calls.approveYes"), data },
            { action: "refuseCall", label: game.i18n.localize("DRPG.Calls.approveNo"), data }
        ],
        onPosted,
        rid: askMark(ctx, "call", held),
        expires,
        thread: ctx.asker
    });
    // A card that could not be posted is a ruling nobody can give: said now,
    // rather than after the player's clock (map-gmSide 3, E31).
    return posted === false ? { refused: "the ruling card could not be posted" } : { later: true };
}

async function askDynamicByCard(payload, ctx) {
    const held = { userId: ctx.asker, actorId: payload.actorId ?? "" };
    const again = await askAgain(dynamicAsks, ctx, "dynamic", held);
    if (again) return again;
    askedByCard.add(ctx.requestId);
    const expires = serverNow() + TIMING.rulingMs;
    const onPosted = holdAsk(dynamicAsks, ctx.requestId, held, expires);
    const actor = game.actors.get(payload.actorId ?? "");
    const data = {
        rid: ctx.requestId, asker: ctx.asker, by: payload.actorId ?? "",
        room: payload.room ?? "", desc: payload.description ?? "", name: payload.actorName ?? ""
    };
    const posted = await callGm(actor, {
        title: game.i18n.localize("DRPG.Action.dynamicTitle"),
        request: payload.description ?? "",
        room: payload.room ?? null,
        actions: [
            { action: "setDifficulty", label: game.i18n.localize("DRPG.Action.dynamicSet"), data },
            { action: "refuseDynamic", label: game.i18n.localize("DRPG.Action.dynamicRefuse"), data }
        ],
        onPosted,
        rid: askMark(ctx, "dynamic", held),
        expires,
        thread: ctx.asker
    });
    return posted === false ? { refused: "the ruling card could not be posted" } : { later: true };
}

/*
 * THE STATISTIC'S CARD, VEILED (E32+E07 C11b, 02.10.2026). Shaped as the Dynamic
 * action's: a `callGm` card in the owner's thread with one button per listed trait
 * and a Refuse, any GM may press either (messenger-app.mjs `rulePickTrait`). Veiled
 * (E06 C8) because the action it names is the incident's: the document names nobody
 * and its words go to the thread's player and the GMs. The traits are read from this
 * GM's config for the definition the guard checked, never from the packet.
 */
async function askTraitByCard(payload, ctx) {
    if (!ctx.requestId) return { later: true };
    const { listedTraits, rulingLabel, traitWithValue } = await import("./trait-ruling.mjs");
    const spec = { kind: payload.kind, key: payload.key, variant: payload.variant ?? null };
    const listed = listedTraits(spec);
    if (listed.length < 2) return { refused: "nothing was carried out: the roll lists one statistic or none" };
    // On the one road since E18 fix e1-G4: held, marked, timed and ended as a Call's and a Dynamic action's are.
    // The roll's kind as `rollKind`: the mark's own `kind` is the ask's ("trait", `askMark`).
    const held = { userId: ctx.asker, actorId: payload.actorId ?? "", rollKind: spec.kind ?? "", key: spec.key ?? "", variant: spec.variant ?? "" };
    const again = await askAgain(traitAsks, ctx, "trait", held);
    if (again) return again;
    askedByCard.add(ctx.requestId);
    const expires = serverNow() + TIMING.rulingMs;
    const onPosted = holdAsk(traitAsks, ctx.requestId, held, expires);
    const actor = game.actors.get(payload.actorId ?? "");
    const data = trait => ({
        rid: ctx.requestId, asker: ctx.asker, by: payload.actorId ?? "", kind: spec.kind, key: spec.key,
        variant: spec.variant ?? "", ...(trait ? { trait } : {})
    });
    const posted = await callGm(actor, {
        title: game.i18n.localize("DRPG.TraitRuling.title"),
        body: `<strong>${esc(rulingLabel(spec))}</strong> · ${esc(game.i18n.format("DRPG.Action.usesTrait", {
            traits: listed.map(t => TRAITS[t]?.label ?? t).join(" / ") }))}`,
        gmBody: game.i18n.localize("DRPG.TraitRuling.gmBody"),
        actions: [
            ...listed.map(trait => ({ action: "pickTrait", label: traitWithValue(actor, trait), data: data(trait) })),
            { action: "refuseTrait", label: game.i18n.localize("DRPG.Action.dynamicRefuse"), data: data(null) }
        ],
        veiled: true,
        onPosted,
        rid: askMark(ctx, "trait", held),
        expires,
        thread: ctx.asker
    });
    return posted === false ? { refused: "the ruling card could not be posted" } : { later: true };
}

/**
 * The Observes this primary put on a card, by request (E09 C12): who asked, for which
 * character, in which room, with what words and until when - what a GM's pick is held to
 * (`observePickOnPrimary`), read from the ask as it arrived and never from the card. The
 * oldest go first. Kept in memory: a primary that reloads keeps none, and the player's browser
 * asks again (`resend`), which finds the card by its mark (`askAgain`, E18 fix e1-G4).
 */
const observeAsks = new Map();

/*
 * THE STATISTIC'S ASK AND THE OBSERVE'S ON THE ONE ROAD (E18 fix e1-G4, 24.10.2026; the end review's F1 and E18-END-5;
 * STATUS's C1 and C2 gaps). The stage's goal is that every question to the GM ends one way within a time its card shows,
 * and only a Hope Call's and a Dynamic action's asks were on that road: a statistic's card (`trait.ruling`) and an
 * Observe aimed at a point of interest (`observe.target`) showed no time, carried no mark and were ended by nothing, so
 * a GM's pick minutes after the player's browser had given up was written as ruled, and a resend to a primary that had
 * reloaded put up a second card. Both are held now as the other two are (`traitAsks`, `observeAsks`, `holdAsk`), their
 * cards carry the ask's mark and its time (`askMark`, `expires`), a resend finds its card (`askAgain`), the asker's
 * expiry and receipt end or close them (`expiredOnPrimary`, `receivedOnPrimary`) and the primary ends each at its time
 * (`endAtExpiry`, `sweepAskCards`). A pick on a statistic's card is still sent to its asker by the GM who pressed it
 * (`answerTraitRuling`); a pick on an Observe's card was the primary's already (`observePickOnPrimary`). Tier 2's "a
 * statistic's ask and an Observe's end as the other asks do" reads it.
 */
const traitAsks = new Map();

/** Every map of asks this primary holds on a card: what an asker's expiry and receipt, and a card's end, are read against. */
function heldAskMaps() {
    return [callAsks, dynamicAsks, traitAsks, observeAsks];
}

/** The ask this primary holds under `requestId` for `userId`, with its map, or null. */
function heldAskOf(requestId, userId) {
    for (const asks of heldAskMaps()) {
        const held = asks.get(requestId ?? "");
        if (held && held.userId === userId) return { asks, held };
    }
    return null;
}

/**
 * A player's focused gaze, put to every GM as a card in the player's thread (E09 C12; shaped
 * as `askDynamicByCard`). The card names the character, the room and the player's own words,
 * and no trace: the candidates and their difficulties are drawn only in the picker of the GM
 * who presses "Pick a trace" (observe.mjs `pickFromCard`).
 */
export async function askObserveByCard({ actor, room, request = "", userId = null }, ctx) {
    if (!ctx?.requestId) return { later: true };
    // `userId` is the account the key is minted for (null for a GM's); the asker is who is answered.
    const held = { userId: ctx.asker, actorId: actor.id, room: room ?? "", request: request ?? "" };
    const again = await askAgain(observeAsks, ctx, "observe", held, { observer: userId, at: Date.now() });
    if (again) return again;
    askedByCard.add(ctx.requestId);
    const expires = serverNow() + TIMING.rulingMs;
    const onPosted = holdAsk(observeAsks, ctx.requestId, held, expires, { observer: userId, at: Date.now() });
    const data = { rid: ctx.requestId, by: actor.id, desc: request };
    const posted = await callGm(actor, {
        title: game.i18n.localize("DRPG.Observe.cardTitle"),
        request,
        room,
        gmBody: game.i18n.localize("DRPG.Observe.cardHint"),
        actions: [
            { action: "pickObserveTrace", label: game.i18n.localize("DRPG.Observe.cardPick"), data },
            { action: "refuseObserveTrace", label: game.i18n.localize("DRPG.Observe.pickRefuse"), data }
        ],
        onPosted,
        rid: askMark(ctx, "observe", held),
        expires,
        thread: ctx.asker
    });
    if (posted !== false) return { later: true };
    observeAsks.delete(ctx.requestId);
    return { refused: "the ruling card could not be posted" };
}

/**
 * A GM's pick (`tokenId`) or Refuse (`refuse`) on an Observe card, on the primary (E09 C12).
 * Held to the ask kept under `rid`: none kept, another character's, one answered already, or one
 * past the time its card shows (`expires`, E18 fix e1-G4; `TIMING.rulingMs` from its arrival here)
 * is "gone". An answered ask stays held until its asker's receipt (`receivedOnPrimary`) or its card's end. The ask is marked as being answered before anything waits, so of two GMs' picks at
 * once the second is "gone" too. A pick the primary does not find among the traces the
 * character could be shown now is "notThere", and the card stays open. Answers `{ value, told }`:
 * value "picked", "refused", "gone" or "notThere"; told, the notice for the GM who pressed.
 * The asker is answered here, once: `{ ok: true, key }`, or `{ ok: false, reason: "refused" }`
 * as a GM's closed picker always answered.
 */
async function observePickOnPrimary({ rid, actorId, tokenId = null, refuse = false }, by) {
    const asked = observeAsks.get(rid ?? "");
    const who = game.users.get(by ?? "")?.name ?? by;
    const late = (asked?.expires != null && serverNow() > asked.expires) || Date.now() - (asked?.at ?? 0) > TIMING.rulingMs;
    if (!asked || asked.answering || asked.answered || asked.actorId !== actorId || late) {
        warn(`An Observe card's ${refuse ? "refusal" : "pick"} by ${who} was not taken: this primary GM keeps no Observe waiting under that request for that character.`);
        if (asked && !asked.answering && !asked.answered && asked.actorId === actorId) observeAsks.delete(rid);
        return { value: "gone", told: "DRPG.Observe.pickGone" };
    }
    asked.answering = true;
    const answer = value => {
        asked.answered = true;
        game.socket.emit(SOCKET_EVENT, { action: ACTION_DONE, requestId: rid, userId: asked.userId, value }, { recipients: [asked.userId] });
    };
    try {
        if (refuse) {
            answer({ ok: false, reason: "refused" });
            return { value: "refused", told: null };
        }
        const { pickObserveTarget } = await import("./observe.mjs");
        const picked = await pickObserveTarget({ actorId, room: asked.room, tokenId, userId: asked.observer ?? null, request: asked.request });
        if (!picked.ok) {
            warn(`An Observe card's pick by ${who} was not taken: that trace is not one ${game.actors.get(actorId)?.name ?? actorId} could be shown in ${asked.room} now (${picked.reason}).`);
            return { value: "notThere", told: "DRPG.Observe.pickNotThere" };
        }
        answer({ ok: true, key: picked.key });
        return { value: "picked", told: null };
    } finally {
        asked.answering = false;
    }
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
 * A GM's yes to a Call's ask, on the primary (E29 fix r2-H4): kept for the ask this primary holds
 * under that request (bridge-guards.mjs `noteCallYes`), then sent to the player who asked, once.
 * False for an ask it does not hold - one already answered yes, or one a primary that has gone put
 * up (the player's browser gives up on it at its clock and nothing is spent; it asks again) - and
 * for a yes pressed on another card than the one the ask is held on (fix early-C2-G2).
 */
async function yesOnPrimary(requestId, asker, by = game.user.id, messageId = null) {
    const asked = callAsks.get(requestId ?? "");
    if (!asked || asked.userId !== asker) {
        warn(`A GM's yes to a Call was not kept: this primary GM holds no ask of ${game.users.get(asker ?? "")?.name ?? asker} under that request.`);
        return false;
    }
    if (messageId && asked.messageId !== messageId) {
        warn(`A GM's yes to a Call was not kept: the card pressed is not the one this primary GM holds ${game.users.get(asker)?.name ?? asker}'s ask on under that request.`);
        return false;
    }
    callAsks.delete(requestId);
    noteCallYes(asked);
    const sentOn = { by, text: "DRPG.Bridge.settledApproved", at: Date.now() };
    // The card's buttons go and its mark says a yes went (fix e1-G1); a card that is gone keeps nothing, and the yes still goes.
    if (asked.messageId) await keepRuling(asked.messageId, null, sentOn, { quiet: true });
    sendOnFromPrimary(requestId, asked, true, { ...sentOn, yes: asked });
    return true;
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
 * A GM's ruling on a Dynamic action's card, on the primary (E18 C1): sent on for the ask it holds under that request,
 * by that user, pressed on the card that ask is held on (fix early-C2-G2) - a difficulty only once it is kept on the
 * card (`keepRuling`).
 */
async function dynamicOnPrimary(requestId, asker, ruling, by, messageId = null) {
    const held = dynamicAsks.get(requestId ?? "");
    if (held?.userId !== asker) {
        warn(`A GM's ruling on a Dynamic action was not sent on: this primary GM holds no ask of ${game.users.get(asker ?? "")?.name ?? asker} under that request.`);
        return false;
    }
    if (messageId && held.messageId !== messageId) {
        warn(`A GM's ruling on a Dynamic action was not sent on: the card pressed is not the one this primary GM holds ${game.users.get(asker)?.name ?? asker}'s ask on under that request.`);
        return false;
    }
    dynamicAsks.delete(requestId);
    if (!ruling) {
        sendOnFromPrimary(requestId, held, false, { text: "DRPG.Bridge.settledDeclined", by });
        return true;
    }
    const tier = Number(ruling.tier);
    const kept = { type: "dynamic", actorId: held.actorId, tier };
    const sentOn = { by, text: "DRPG.Bridge.settledAnswered", at: Date.now() };
    if (!(await keepRuling(held.messageId, kept, sentOn))) return false;
    sendOnFromPrimary(requestId, held, { tier, trait: ruling.trait ?? null }, { ...sentOn, ruling: kept });
    return true;
}

/*
 * THE DIFFICULTY IS THE GMS' RECORD AS IT LEAVES, NOT WHEN ITS ASKER SAYS IT ARRIVED (E18 fix early-C1-G1,
 * 20.10.2026; the early review's E18-C1-1). C1 wrote a Dynamic ruling into its card's meta on its asker's
 * `ruling.received` alone, while the asker's browser rolled on the `bridge.done` whether its receipt went or not. A
 * card that ended with none - no receipt within `TIMING.ackMs`, or the asker's expiry after the ruling went - kept no
 * ruling, and the record a trace's band and a Reroll's replay read (`dynamicRulingOf`: the character's newest ruling
 * within a Reroll's reach) was an older card's: by withholding one packet the roller's browser chose which of the
 * GMs' rulings counted. The primary keeps the ruling in the card's meta now before it sends it on, so nothing that
 * browser sends after it is judged against another, and either end keeps it, since a card's new meta is added to
 * what it holds (secret.mjs `remember`); only the card's line waits for the receipt. The card's buttons go with it,
 * as `settleCall` takes them off: the words travel again with the meta, the card is drawn again, and no ask is left
 * to rule on. A card that is gone keeps nothing, and its ruling is not sent on. Tier 2's "a Dynamic ruling is the
 * GMs' record from the moment the primary sends it on" reads it before any receipt and after each end; at f547a92
 * each read was the older card's.
 */
async function keepRuling(messageId, ruling, sentOn = null, { quiet = false } = {}) {
    const message = game.messages.get(messageId ?? "");
    if (!message?.getFlag(MODULE_ID, "secret")) {
        if (!quiet) warn("A GM's ruling on a Dynamic action was not sent on: its card is gone, so the GMs would keep no record of the difficulty.");
        return false;
    }
    const wrap = document.createElement("template");
    wrap.innerHTML = contentOf(message);
    wrap.content.querySelectorAll(".drpg-call-actions").forEach(el => el.remove());
    const { updateSecret } = await import("./secret.mjs");
    await updateSecret(message, wrap.innerHTML, null, { ...(ruling ? { ruling } : {}), ...(sentOn ? { sentOn } : {}) });
    return true;
}

/*
 * THE RULINGS THIS PRIMARY SENT ON AND WAITS TO HEAR ARRIVED, by request (E18 C1, 19.10.2026; audit
 * S11-13): the asker, the card, the line it is to carry and who ruled, a Call's yes to take back. The
 * card says "Approved" only once its asker's browser has the yes (`ruling.received`); a browser that
 * stopped waiting sends none, and after `TIMING.ackMs` the card ends as expired with the GMs' own line,
 * and the yes is taken back (`unreceivedOnPrimary`). A Dynamic difficulty is not held here: it is in the
 * card's meta before it leaves (`keepRuling`, fix early-C1-G1). In memory, as the asks are: a primary
 * that reloads between the answer and the receipt holds neither.
 */
const answeredAsks = new Map();

function sendOnFromPrimary(requestId, held, value, { text, by, yes = null, ruling = null, at = Date.now() }) {
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_DONE, requestId, userId: held.userId, value
    }, { recipients: [held.userId] });
    const sent = { userId: held.userId, actorId: held.actorId ?? null, messageId: held.messageId ?? null, text, by, yes, ruling, at, timer: null };
    answeredAsks.set(requestId, sent);
    while (answeredAsks.size > CALL_ASKS_KEPT) answeredAsks.delete(answeredAsks.keys().next().value);
    sent.timer = setTimeout(() => void unreceivedOnPrimary(requestId), TIMING.ackMs);
}

/** A card ends as its ask's player no longer waiting: the line for everyone, and the GMs' own - by key, which each reader writes in its language. */
function endExpired(messageId) {
    return endAskCard(messageId, { key: "DRPG.Bridge.settledExpired" }, { gmNote: { key: "DRPG.Bridge.settledGone" } });
}

/**
 * Write an ask's card as ended - unless a GM ended it meanwhile (a Call's no, written by the GM who pressed it). A
 * Dynamic difficulty kept on it as it was sent on stays in its meta (`keepRuling`).
 */
async function endAskCard(messageId, text, { gmNote = null } = {}) {
    const message = game.messages.get(messageId ?? "");
    if (!message) return null;
    const { MESSENGER_FLAGS } = await import("./messenger.mjs");
    if (cardFlag(message, MESSENGER_FLAGS.settled)) return null;
    return settleCall(message, text, null, gmNote);
}

/*
 * A RULING THAT WENT IS NOT "NOBODY ANSWERED" (E18 fix e1-G1, 24.10.2026; the end review's E18-END-1 and F3). With no
 * receipt within `TIMING.ackMs`, or the asker's expiry after the ruling went, the card ended "Nobody answered in time -
 * ask again." - also when the asker had used it: a console armed the Call on the GM's yes and sent the expiry after, a
 * Dynamic roll was drawn on the difficulty kept on the card, a slow link brought the receipt late, or the primary
 * reloaded before it. The asker's own packet decided what the GMs' card said about a ruling that was used. What the
 * GMs hold decides now: a yes an arm took (bridge-guards.mjs `forgetCallYes`), or a Dynamic roll the primary drew for
 * that character and player since the ruling went (the store `rolls`), writes the ruled line as a receipt would; a yes
 * still kept is taken back and the card ends as expired; a Dynamic difficulty, which is the GMs' record from the
 * moment it went (`keepRuling`), and a ruling a reloaded primary finds only in the card's mark (`sentOnMark`), end
 * "Answered by {name}; not confirmed as received." - unless its asker said its clock had run out first, which ends
 * the card as expired. Tier 2's "a ruling that went ends its card as what became of it" reads each.
 */

/** The ruling a card's mark says went to its asker before this primary held it (`keepRuling`'s `sentOn`), or null. */
function sentOnMark(message) {
    const mark = message ? cardFlag(message, "sentOn") : null;
    if (!mark || typeof mark !== "object" || !(message.author ?? message.user)?.isGM) return null;
    const ruling = cardFlag(message, "ruling");
    return {
        messageId: message.id, userId: cardFlag(message, "rid")?.asker ?? null, actorId: ruling?.actorId ?? null,
        by: mark.by ?? null, text: typeof mark.text === "string" ? mark.text : "DRPG.Bridge.settledAnswered",
        at: Number(mark.at) || 0, yes: null, ruling: ruling?.type === "dynamic" ? ruling : null, fromMark: true
    };
}

/** Did the primary draw a Dynamic action's roll for the ruling's character and asker since it went? */
async function rolledOnRuling(sent) {
    if (!sent.ruling || !sent.actorId) return false;
    const { rollStore } = await import("./gm-stores.mjs");
    return Object.values(rollStore.entries() ?? {}).some(row => row?.actorId === sent.actorId
        && row.userId === sent.userId && row.actionKey === "dynamic" && Number(row.at) >= sent.at);
}

/** A card whose ruling went to its asker ends as what became of the ruling (above). */
async function endSentOn(sent, { askerExpired = false } = {}) {
    const name = game.users.get(sent.by ?? "")?.name ?? "?";
    const fate = sent.yes ? forgetCallYes(sent.yes) : null;
    if (fate === "taken" || (await rolledOnRuling(sent))) return endAskCard(sent.messageId, { key: sent.text, name });
    if (fate === "forgotten" || askerExpired || (!sent.ruling && !sent.fromMark)) return endExpired(sent.messageId);
    return endAskCard(sent.messageId, { key: "DRPG.Bridge.settledUnconfirmed", name });
}

/** No receipt came for a ruling sent on (E18 C1): its card ends as what became of it (fix e1-G1), a Call's yes not used taken back. */
async function unreceivedOnPrimary(requestId) {
    const sent = answeredAsks.get(requestId);
    if (!sent) return;
    answeredAsks.delete(requestId);
    await endSentOn(sent);
}

/**
 * The asker's clock ran out (`ruling.expired`, E18 C1). An ask this primary still holds under that id,
 * asked by that user, is dropped, so a GM's yes after it is not kept; a ruling sent on that its receipt
 * did not follow is taken back. Either card ends as expired. False for anything else: nothing is done.
 */
async function expiredOnPrimary(requestId, senderId) {
    const stillAsked = heldAskOf(requestId, senderId);
    if (stillAsked) {
        stillAsked.asks.delete(requestId);
        await endExpired(stillAsked.held.messageId);
        return true;
    }
    const sentOn = answeredAsks.get(requestId ?? "");
    if (sentOn && sentOn.userId === senderId) {
        clearTimeout(sentOn.timer);
        answeredAsks.delete(requestId);
        await endSentOn(sentOn, { askerExpired: true });
        return true;
    }
    return false;
}

/**
 * The ruling reached its asker (`ruling.received`, E18 C1): its card is written as ruled - a Dynamic
 * difficulty is in its meta since it was sent on (`keepRuling`). A receipt for an ask this primary still
 * holds is a ruling another GM sent straight to its asker (a Call's no, `answerHopeCall`): that ask is
 * over, and a yes after it is not kept. False for anything else - another user's receipt, or one for
 * nothing sent: nothing is done.
 */
async function receivedOnPrimary(requestId, senderId) {
    const reached = answeredAsks.get(requestId ?? "");
    if (reached && reached.userId === senderId) {
        clearTimeout(reached.timer);
        answeredAsks.delete(requestId);
        const name = game.users.get(reached.by ?? "")?.name ?? "?";
        await endAskCard(reached.messageId, { key: reached.text, name });
        return true;
    }
    const answeredElsewhere = heldAskOf(requestId, senderId);
    if (answeredElsewhere) {
        answeredElsewhere.asks.delete(requestId);
        return true;
    }
    return false;
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
                price, grant
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

/* ==========================================================================
 * CALLING THE GM
 * ========================================================================== */

/** The request a call on the GM names when its caller names none (`DRPG.Bridge.what.gm.call`). */
export const CALL_GM_WHAT = "gm.call";

/**
 * The ruling card's words, as `callGm` posts them: the title, who and where, the roll, the
 * player's own words quoted, the caller's body, the GM's reference, "awaiting a ruling"
 * and the GM's buttons. Its own function so the card is read without posting one (R838).
 */
export function callCardHtml(actor, { title, body = "", roll = null, request = "", room = null, gmBody = "", actions = [], expires = null, receipt = false } = {}) {
    const parts = [];
    parts.push(`<h3>${esc(title)}</h3>`);
    parts.push(`<p><strong>${esc(actor?.name ?? "?")}</strong>${room ? ` · ${esc(room)}` : ""}</p>`);

    if (roll) {
        const traitLabel = TRAITS[roll.trait]?.label ?? roll.trait ?? "";
        parts.push(`<p>${traitLabel} · <strong>${roll.total}</strong>${
            roll.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>`
            : roll.withHope ? ` · ${game.i18n.localize("DRPG.Explain.status.hopeTitle")}`
            : roll.withFear ? ` · ${game.i18n.localize("DRPG.Despair.label")}` : ""
        }</p>`);

        // The guide owes the player a substantial hint on a critical Observe or
        // Analyze. Say so loudly rather than leaving the GM to remember it.
        if (roll.isCritical) {
            parts.push(`<div class="drpg-gm-only"><p class="drpg-warning"><strong>${
                game.i18n.localize("DRPG.Bridge.criticalHint")
            }</strong></p></div>`);
        }
    }

    // ORDER: what happened, then what they said, then the reference.
    //
    // It used to run name → roll → their words → the GM's reference table →
    // "awaiting a ruling", which put the player's own sentence between two
    // blocks of numbers. The GM reads this top to bottom while deciding: the
    // roll is the fact, the quote is the request being ruled on, and the
    // threshold table is the thing you look at last, to price the answer.
    if (request) parts.push(`<blockquote>${esc(request)}</blockquote>`);
    // One block for the caller's own HTML (E18 C0, S10-52): a body of paragraphs wrapped in
    // a <p> was two empty paragraphs and the body's own, once the browser had parsed it.
    if (body) parts.push(`<div class="drpg-call-body">${body}</div>`);
    if (gmBody) parts.push(`<div class="drpg-gm-only">${gmBody}</div>`);
    // Classed so `settleCall` can take it off again once the card is answered - its time with it (E18 C2).
    // A receipt awaits nothing (`callGm`'s `receipt`), so it says nothing is awaited.
    if (!receipt) {
        parts.push(`<p class="drpg-call-awaiting"><em>${
            game.i18n.localize("DRPG.Bridge.awaitingRuling")}</em>${expiresHtml(expires)}</p>`);
    }

    if (actions.length) {
        parts.push(`<div class="drpg-call-actions">${actions.map(a => {
            const attrs = Object.entries(a.data ?? {})
                .map(([k, v]) => ` data-${esc(k)}="${esc(v)}"`).join("");
            return `<button type="button" class="drpg-call-action" data-drpg-call="${
                esc(a.action)}"${attrs}>${esc(a.label)}</button>`;
        }).join("")}</div>`);
    }

    return parts.join("");
}

/**
 * "Open until 21:35." on an ask's card (E18 C2): the time its asker stops waiting, and `data-expires` (the server's
 * milliseconds) for the primary that ends the card at it (`sweepAskCards`). Written here in the posting GM's clock and
 * language, and by each reader's browser again in its own as it draws the card (secret.mjs `readersLines`, fix e1-G3).
 */
function expiresHtml(expires) {
    if (!Number.isFinite(expires) || expires <= 0) return "";
    const time = new Date(expires).toLocaleTimeString(game.i18n.lang, { hour: "2-digit", minute: "2-digit" });
    return ` <span class="drpg-call-expires" data-expires="${Math.round(expires)}">${
        esc(game.i18n.format("DRPG.Bridge.openUntil", { time }))}</span>`;
}

/**
 * Post a ruling request into the actor owner's messenger thread - one message,
 * visible to the player and every GM at once. An actor with no player owner
 * (a Monokuma, a bare NPC) has no thread to post into, so this falls back to
 * the old GM-only whisper.
 *
 * @param {Actor} actor
 * @param {object} params
 * @param {string} params.title     What is being asked, e.g. "Think".
 * @param {string} [params.body]    Extra context, already escaped.
 * @param {object} [params.roll]    Result of the roll, if one was made.
 * @param {string} [params.request] The player's own words.
 * @param {string} [params.room]    Where they are standing.
 */
export async function callGm(actor, {
    title, body = "", roll = null, request = "", room = null,
    /**
     * Prose for the GM alone: a threshold table, "score it against...", a
     * reminder of what is owed. The card lives in the player's thread, so
     * anything here is wrapped in `.drpg-gm-only` and taken off the card on a
     * player's client, the same way the buttons are (COMM-06) - and since E06
     * C7b never sent to them: `postSecret` gives a player the words without it.
     */
    gmBody = "",
    /**
     * Buttons for the GM, rendered into the card itself.
     *
     * Each is `{ action, label, data }`. `data` becomes `data-*` attributes on
     * the button, which is how the ruling carries its own subject: a Direct
     * Murder declaration names the killer and the victim, so the card that
     * announces it can open the incident without a GM re-picking two names off
     * a list they are already reading.
     *
     * Safe to render for everybody: the GM-only buttons are not in a player's
     * copy (`postSecret`, since E06 C7b; `wireCallActions` takes them off an
     * older one), and every action behind them is
     * GM-gated again on arrival, so a player who forges a click into their own
     * DOM achieves nothing.
     */
    actions = [],
    /**
     * NEVER SHOW THIS TO THE PLAYER WHOSE ACTOR IT NAMES.
     *
     * Everything else `callGm` sends is a card the player ASKED for: they made
     * a request, they are waiting on a ruling, and the conversation belongs in
     * their thread where they can read it.
     *
     * E21's trap alerts are the opposite. The module tells the GM what it just
     * saw, and the actor it names is the KILLER - so the ordinary path posts
     * into the killer's own messenger thread a card saying their trap has been
     * tripped and, worse, WHO tripped it. Measured on the first run of this:
     * "Player B, in Big IT Room" delivered straight to Player A, before the GM
     * had decided anything at all.
     *
     * That is trap 156 of this stage, which warned that the alert would travel
     * the same road as every ruling card and that the road was the risk. It
     * cost one line to open and one line to close.
     */
    gmOnly = false,
    /**
     * THE PLAYER READS IT, AND NOBODY ELSE MAY LEARN THAT THEY DO (E06 C8, 28.09.2026;
     * audit L18, S05-15). The trap's receipt is the killer's to read and a reshape card
     * (Stage 6's, a Tamper's) its player's, so each belongs in that player's thread - and
     * an ordinary thread card's document names its thread's player to every browser.
     * Posted veiled (messenger.mjs `postToThread`), the document names nobody and the
     * card's placement travels with its words. Ignored with no thread to post into.
     */
    veiled = false,
    /**
     * What the refusal names when no GM is connected (`DRPG.Bridge.what.<what>`), and whether
     * it may add "Nothing was spent.": a caller that took a price says true only once it hands
     * the price back on a false answer.
     */
    what = CALL_GM_WHAT,
    nothingSpent = false,
    /** Handed the card once it is posted (E18 C1): the primary keeps which card an ask it holds is on. */
    onPosted = null,
    /**
     * The ask the card is posted for (E18 C2): its id and asker, its kind, and what it was asked for - the
     * character, and a Call's key and purchase (`askMark`, fix early-C2-G2). Kept in the meta its words travel
     * with, where the primary looks for it when the player asks again (`askAgain`), and holds the ask again only
     * as the mark says (`sameAsk`). A player's meta may not carry it (secret.mjs `GM_META`), and a card a player
     * wrote is never taken for it (`cardOfAsk`).
     */
    rid = null,
    /** When the ask's clock runs out, on the server's clock (`serverNow`): shown on the card, and the card ends then. */
    expires = null,
    /**
     * The user whose thread the card goes to, when that user is a player who owns the character (E18 fix e1-G7): the
     * asker of a question the primary holds for them. Otherwise the character's first owner's (`ownerOf`).
     */
    thread = null,
    /**
     * A RECEIPT, NOT A QUESTION (E15 part 1 C1, 25.10.2026; audit S09-34). A card that tells what the
     * module did and asks nobody anything - a watched trap armed, its Plant button aside - said
     * "Awaiting a ruling." and rang the GMs as a question (`gmAsk`, its sound, the popup): the killer
     * waited on a ruling that was never coming and the GMs were interrupted for a receipt. True: no
     * "awaiting" line, no `gmAsk`, no sound or popup of a question. Every other card at d90687dc
     * carries buttons or is answered by a reply (`askGm`: Think, Listen and the rest), so is a
     * question; the watched trap's receipt is the one caller (projects.mjs `announceTrapReady`).
     */
    receipt = false
} = {}) {
    /*
     * NO GM, NO CARD (E18 C0, 19.10.2026; audit S10-26). With no GM connected this posted
     * anyway and answered true: the player's caller said the request went and kept what it
     * cost, and no GM was there to read it. False now, with nothing posted and the refusal
     * said once, here, so a caller only hands back what it took. Asked before the first
     * await, on the client that calls: a GM who connects later finds nothing waiting and
     * the player asks again. Measured in tier 2's E18 C0 test and scenario 33's phase C.
     */
    if (!gmOnline()) {
        sayNotDone(what, "noGm", { nothingSpent });
        return false;
    }
    const content = callCardHtml(actor, { title, body, roll, request, room, gmBody, actions, expires, receipt });
    const owner = gmOnly ? null : threadOf(actor, thread);

    if (!owner) {
        /*
         * NO THREAD TO LIVE IN, so the chat log - and the log has to behave
         * like a thread for it (COMM-02). Before this a trap alert landed as a
         * silent sidebar line: no popup (a GM's whispers never raise one
         * unless the poster insists), no sound, and two buttons nothing wired,
         * because the only wiring lived in the messenger's bubbles. `callCard`
         * is what the render hook in `registerGmBridge` keys on.
         *
         * THE TITLE IN THE WORDS, A NEUTRAL ONE IN THE FLAGS (E05's fix round, S1-m2,
         * 27.09.2026). The words of a whisper are the GMs'; its flags are on every
         * browser. A trap's alert put "<project> - something set it off" in
         * `popupTitle`, on every player's copy of the card, at the moment the trap
         * went off - whatever the GM then ruled. A `gmOnly` card's popup is headed
         * "A ruling to make", and the real title is the first line of the words it
         * shows (the `<h3>` above). A card with no owner that is not `gmOnly` names
         * an action somebody asked for, and keeps its title. What is left in the
         * flags is that a card went to the GMs, and when - chat metadata, E06's.
         * Measured in 30's trap phase: p2's copy of the alert held the project's
         * name before this, and holds nothing of it after. Since E06 C7a none of these
         * flags is on the document at all: `postSecret` sends them with the words.
         */
        try {
            const whispered = await whisperToGms(content, {
                flags: { [MODULE_ID]: {
                    callCard: true,
                    ...(receipt ? {} : {
                        gmPopup: true,
                        popupTitle: gmOnly ? game.i18n.localize("DRPG.Action.murderRulingTitle") : title,
                        sfx: { key: "gmAsk", gm: true }
                    }),
                    ...(rid ? { rid } : {})
                } }
            });
            if (whispered) onPosted?.(whispered);
            return true;
        } catch (err) {
            error("Could not reach the GM", err);
            return false;
        }
    }

    try {
        const { postToThread } = await import("./messenger.mjs");
        // Every callGm card but a receipt is a call ON the GM - the flag is
        // what tells the messenger's notifier to interrupt them for it. See
        // MESSENGER_FLAGS.gmAsk for why this cannot be derived from the author.
        const posted = await postToThread(owner.id, content, { gmAsk: !receipt, veiled, rid });
        if (posted) onPosted?.(posted);
        return Boolean(posted);
    } catch (err) {
        error("Could not reach the GM", err);
        return false;
    }
}

/*
 * A QUESTION GOES TO THE THREAD OF THE PLAYER WHO ASKED IT (E18 fix e1-G7, 24.10.2026; the end review's E18-END-4 and
 * F6, STATUS's C5 gap 2). A card lives in one player's messenger thread, and `callGm` put every card about a character
 * in its first owner's (`ownerOf`): when two players own Aiko and the second buys her Experience, the card - its "Open
 * until", its ruling - went to the first, who had asked nothing, and the asker had none. A question the primary holds
 * for its asker (a Call, a Dynamic action, a statistic, an Observe's gaze) names that asker (`thread`), and the card goes
 * to the asker's thread when the asker owns the character. Tier 2's "a co-owner's question lands in the co-owner's
 * thread" reads it.
 */
function threadOf(actor, userId) {
    const user = userId ? game.users.get(userId) : null;
    if (user && !user.isGM && actor?.testUserPermission?.(user, "OWNER")) return user;
    return ownerOf(actor);
}

/* ==========================================================================
 * ONE RULING PER CARD (E18 C3, 19.10.2026; audits S11-14, S17-22)
 * --------------------------------------------------------------------------
 * A card sent to the GMs is drawn for every GM, in the chat log and in the
 * messenger, and each drawing's buttons ruled on the browser that clicked them,
 * held only against a second click on that same drawing. Measured on the code
 * before this commit (tier 2, "two clicks on one card to the GMs rule it once"):
 * two drawings of one Decline clicked at once posted two lines to the player's
 * thread, and the card reopened by its author - a player's card is that
 * player's document, `settled` included - posted a third. Every click is claimed
 * on the primary GM now: the primary holds which cards a click is ruling on, and
 * a row per card a ruling was made on in the GMs' store (`ruledCardStore`),
 * which no player's browser holds; a card with either is not taken, and the GM
 * who clicked is told who has it.
 * ========================================================================== */

/** On the primary: the cards a GM's click is ruling on now, messageId -> that GM's user id. */
const claimsInProgress = new Map();

/**
 * A GM who left holds nothing: their claims end as a backed-out ruling's do - in memory, and, on the primary, the
 * rows that say a claim is under way (fix e1-G1).
 */
function releaseClaimsOf(userId) {
    for (const [messageId, by] of claimsInProgress) if (by === userId) claimsInProgress.delete(messageId);
    if (!isPrimaryGm({ leaving: userId })) return;
    import("./gm-stores.mjs").then(({ ruledCardStore }) => {
        const held = Object.entries(ruledCardStore.entries() ?? {}).filter(([, row]) => row?.pending && row.by === userId).map(([id]) => id);
        return held.length ? ruledCardStore.dropMany(held) : null;
    }).catch(err => debug("Could not drop a leaving GM's claims", err));
}

/**
 * The primary's half of a claim (`card.claim`, or this GM's own click). `step` "take" before a
 * ruling runs: the card must exist, have no row in `ruledCardStore`, not be settled in its document
 * or in the GMs' meta, and not be held by another click; then it is held for `by`. "done" once the
 * ruling was made: the row `{ by, at }` is written unless one is there, and the claim ends. "drop"
 * when it was not: `by`'s claim ends. Answers `{ taken, why?, by }` - `why` "ruled", "busy",
 * "settled" or "gone", `by` the GM who has the card.
 *
 * READ AFTER THE LAST AWAIT. The store's hydration is the only wait, and everything from the
 * card's lookup to holding it runs in one synchronous step, so of two takes of one card that
 * arrive together exactly one finds it free.
 *
 * A CLAIM UNDER WAY IS THE GMS' ROW TOO (E18 fix e1-G1, 24.10.2026; the end review's F2). The row was written only at
 * "done", and a claim in progress lived only in this primary's memory: GM B's review window open on a project's
 * proposal, the primary GM A pressed F5 and then the same card, and both rulings ran. "take" writes the row
 * `{ by, at, pending: true }` now, after the card is held here, and "drop" takes it off; a pending row of a GM who is
 * here holds the card as busy for whichever GM is the primary, and one of a GM who left holds nothing (the primary
 * drops it when that GM leaves, `releaseClaimsOf`). Tier 2's "a claim under way is the GMs' row" reads it.
 */
export async function claimOnPrimary(messageId, step, by) {
    if (!game.user?.isGM) return { taken: false, why: "gone", by: null };
    const { ruledCardStore } = await import("./gm-stores.mjs");
    await ruledCardStore.whenHydrated();
    const message = game.messages.get(messageId ?? "") ?? null;
    const holder = claimsInProgress.get(messageId) ?? null;
    const row = ruledCardStore.get(messageId);
    if (step !== "take") {
        if (holder === by) claimsInProgress.delete(messageId);
        const own = row?.pending && row.by === by;
        if (step !== "done" || !message) {
            if (own) await ruledCardStore.drop(messageId);
            return { taken: false, why: message ? "dropped" : "gone", by };
        }
        if (!row || own) await ruledCardStore.patch(messageId, { by, at: serverNow(), pending: false });
        return { taken: true, by: ruledCardStore.get(messageId)?.by ?? by };
    }
    if (!message) return { taken: false, why: "gone", by: null };
    if (row && !row.pending) return { taken: false, why: "ruled", by: row.by ?? null };
    if (holder) return { taken: false, why: "busy", by: holder };
    if (row?.pending && game.users.get(row.by ?? "")?.active) return { taken: false, why: "busy", by: row.by };
    if (cardFlag(message, "settled") || cardMeta(message, "settled")) return { taken: false, why: "settled", by: null };
    claimsInProgress.set(messageId, by);
    await ruledCardStore.patch(messageId, { by, at: serverNow(), pending: true });
    return { taken: true, by };
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
 * today, and the cards E67 (the gmAsk card's 'Give 1/2'), E68 (the trait card) and E72 (Accept and
 * Refuse) put on it. Overrule and the Closing's approve are not claimed (E18 amend 3).
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

/*
 * SAID THROUGH THE ONE FUNNEL (E18 fix e1-G3, 24.10.2026; the end review's E18-END-4 and F11). Amend 1 sends the stage's
 * new cards - a settlement, a timeout, a refusal - through `showPopup` or `sayNotDone`, and three were Foundry toasts:
 * the claim's refusals (`claimCard`: "{gm} already ruled on this card.", "{gm} is ruling on this card right now.", "This
 * card has already been answered.") and the empty request's (`askForRequest`). A toast fades in seconds and is kept
 * nowhere, so a GM who looked away could not find why a click did nothing. Each is a refusal card now, kept in this
 * browser's history as a request not carried out is (source `notDone`); R472 has its row, R838 and tier 2's C3 test read it.
 */
function sayRefusedHere(text) {
    import("./popup.mjs")
        .then(({ showPopup }) => showPopup(`<p>${esc(text)}</p>`, { kind: "error", source: "notDone" }))
        .catch(err => {
            debug("A refusal could not be shown as a card", err);
            ui.notifications.warn(text);
        });
}

/**
 * Close a ruling card out: the ask becomes a receipt.
 *
 * A card kept saying "Awaiting a ruling." after the ruling had been made. The
 * GM answered in words, the answer landed two bubbles further down, and the
 * card above it still read as an open question - with its buttons still on it,
 * inviting a second ruling on something already ruled (Dawid, 26.08).
 *
 * Rewritten on the MESSAGE, not hidden on the client that clicked: the card
 * lives in a thread the player and every other GM are reading, and a receipt
 * only one screen can see is the bug again with a smaller audience.
 *
 * @param {ChatMessage} message  The card.
 * @param {string|{key: string, name?: string}} text  What settled it, in plain words - or an ask's end by its key and
 *   the GM who ruled (E18 fix e1-G3), written here in this GM's language and by each reader again in its own
 *   (secret.mjs `readersLines`). `gmNote` takes either as well.
 * @param {object} [ruling]      What was ruled, kept in a private card's meta beside
 *   `settled` (E32+E07 C11b): the statistic a GM picked, `{ type: "trait", actorId,
 *   kind, key, variant, trait }` - the record a check of the roll against the pick
 *   reads (E28/E29); and the difficulty a GM set for a Dynamic action, `{ type:
 *   "dynamic", actorId, tier }`, which the band of its trace is read from
 *   (`dynamicRulingOf`, E08+E28 C15). Its readers are the card's: on a veiled thread card the
 *   thread's player and the GMs. A player's own meta may not carry it (secret.mjs
 *   `GM_META`). Never written on a document.
 * @param {string} [gmNote]      A line for the GMs alone, under it (E18 C1: "The player was no
 *   longer waiting."), in `.drpg-gm-only`, which a player's copy of the words never holds.
 */
export async function settleCall(message, text, ruling = null, gmNote = null) {
    if (!message || !game.user.isGM) return null;

    // A `<template>`, not a `<div>` (E02 review): markup parsed into a
    // detached div still loads its images, so an `onerror` in the card's words
    // would run right here, on the GM's client. A template's content is inert.
    const wrap = document.createElement("template");
    wrap.innerHTML = contentOf(message);

    wrap.content.querySelectorAll(".drpg-call-actions, .drpg-call-awaiting").forEach(el => el.remove());
    // Cards posted before the marker class existed carry the same sentence with
    // nothing to hook onto, so they are matched by what they say.
    const awaiting = game.i18n.localize("DRPG.Bridge.awaitingRuling");
    for (const p of wrap.content.querySelectorAll("p")) {
        if (p.textContent.trim() === awaiting) p.remove();
    }

    const lineOf = said => {
        const line = document.createElement("p");
        line.className = "drpg-call-settled";
        if (said && typeof said === "object") {
            line.textContent = game.i18n.format(said.key, { name: said.name ?? "?" });
            line.dataset.drpgLine = said.key;
            if (said.name) line.dataset.drpgName = said.name;
        } else line.textContent = said;
        return line;
    };
    wrap.content.append(lineOf(text));
    if (gmNote) {
        const gmOnlyNote = document.createElement("div");
        gmOnlyNote.className = "drpg-gm-only";
        gmOnlyNote.append(lineOf(gmNote));
        wrap.content.append(gmOnlyNote);
    }

    try {
        const { MESSENGER_FLAGS } = await import("./messenger.mjs");
        const flags = { [MODULE_ID]: { [MESSENGER_FLAGS.settled]: true } };
        if (message.getFlag(MODULE_ID, "secret")) {
            // The words live off the document (secret.mjs). Writing them into
            // `content` here would hand every client the private text in
            // clear; the receipt travels the road the question did - and so
            // does `settled` since E06 C7a, into the meta its readers keep: on
            // the document it told every browser that a ruling was made, and when.
            const { updateSecret } = await import("./secret.mjs");
            return await updateSecret(message, wrap.innerHTML, null, { ...flags[MODULE_ID], ...(ruling ? { ruling } : {}) });
        }
        return await message.update({ content: wrap.innerHTML, flags });
    } catch (err) {
        error("Could not close out the ruling card", err);
        return null;
    }
}

/**
 * The window a request to the GM is typed in. Answers the words typed, trimmed (empty when
 * nothing was), or null when the player pressed Cancel or closed the window.
 *
 * `{ text }`, NOT THE WORDS BARE (E18 C0, 19.10.2026; audit S10-52). Send answered the words
 * and Cancel answered its action, "cancel" - so a request reading "cancel" was taken for the
 * Cancel button and never sent. R838 types it.
 *
 * `required`: the caller has nothing to send without words (Dynamic, a Tier 0 item's use), so
 * an empty request is not sent - the player is told so and the window opens again.
 */
export async function askForRequest({ title, prompt, placeholder = "", intro = "", required = false } = {}) {
    const DialogV2 = foundry.applications.api.DialogV2;
    for (;;) {
        const answer = await DialogV2.wait({
            classes: ["drpg-panel"],
            window: { title },
            content: dialogContent(`${intro}<form>
                    <p>${prompt}</p>
                    <textarea name="request" rows="3" placeholder="${foundry.utils.escapeHTML(placeholder)}"></textarea>
                  </form>`),
            buttons: [
                {
                    action: "send",
                    label: game.i18n.localize("DRPG.Bridge.send"),
                    default: true,
                    callback: (event, button, dialog) => ({ text: dialog.element.querySelector("[name=request]").value.trim() })
                },
                { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            rejectClose: false
        });
        if (typeof answer?.text !== "string") return null;
        if (answer.text || !required) return answer.text;
        sayRefusedHere(game.i18n.localize("DRPG.Bridge.emptyRequest"));
    }
}

/**
 * The request window alone, for a caller whose card to the GMs is another's (E16 part 2 C1,
 * 26.10.2026; audit S02-34: a Dynamic action, whose one card is its difficulty's). Answers the
 * words typed, or null when nothing will be asked: no GM is connected (said, as `promptAndCallGm`
 * says it, before the window), or the player closed it. Posts nothing.
 */
export async function promptForRequest({ title, prompt, placeholder = "", intro = "", required = false, what = CALL_GM_WHAT } = {}) {
    if (!gmOnline()) {
        sayNotDone(what, "noGm", { nothingSpent: true });
        return null;
    }
    return askForRequest({ title, prompt, placeholder, intro, required });
}

/**
 * Ask the player what they want, then send it to the GM. Returns the text, or
 * null if nothing was sent.
 */
export async function promptAndCallGm(actor, {
    title, prompt, placeholder = "", roll = null, room = null,
    // Optional HTML shown above the prompt. Used to fold an action's briefing
    // into this window instead of spending a separate one on it.
    intro = "",
    // Optional HTML for the GM's CARD rather than the player's window - the
    // answers a form collected, so the GM reads them without opening anything.
    // `intro` is what the player sees; this is what the GM sees.
    body = "",
    // Buttons for the GM on the card this produces. See `callGm`.
    actions = [],
    // The caller sends nothing without words: an empty request is asked again. See `askForRequest`.
    required = false,
    // What a refusal names. See `callGm`.
    what = CALL_GM_WHAT
}) {
    /*
     * NO GM, NO WINDOW (E18 C0). The player would type a request only to be told it could
     * not go. Every caller of this spends nothing before it, which is why the refusal may
     * say so.
     */
    const text = await promptForRequest({ title, prompt, placeholder, intro, required, what });
    if (text === null) return null;

    /*
     * NULL MEANS NOTHING WAS SENT, AND IT HAS TO MEAN IT IN BOTH CASES (ACT-15,
     * 20.09).
     *
     * This returned the text whatever `callGm` answered, so every caller had two
     * roads to "the request never went" and could only see one of them: the player
     * closed the second window, or the call was not posted. Both left the caller
     * going on to whisper "your proposal has been sent". Since E18 C0 `callGm` also
     * answers false when no GM is connected - the GM may have left while the window
     * was open - and says so itself.
     */
    const sent = await callGm(actor, { title, roll, request: text, room, body, actions, what, nothingSpent: true });
    return sent === false ? null : text;
}
