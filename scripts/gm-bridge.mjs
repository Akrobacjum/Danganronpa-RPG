/**
 * Danganronpa RPG - the bridge: the GM -> player wire and the registration.
 * ---------------------------------------------------------------------------
 * What stays here: `registerGmBridge` (the socket's listeners and a GM's
 * ready signal), a primary GM's arrival (`onGmReady`), the opening roll's
 * invitation and its withdrawal (`askOpeningRoll`, `cancelOpeningRoll` and
 * their listeners), and the Level Up offers' listener with `askForOffers`.
 *
 * THE FACADE (E41 C5, C5a and C5b, 1.2.97). Three pure moves that
 * `node tools/moved-only.mjs` proves split the bridge that was this file:
 *   call-gm.mjs              the GM's cards - `callGm`, its claims and its
 *                            settle, the request window, the ask-by-card
 *                            machinery and its four primary-side senders
 *                            (C5, C5a);
 *   bridge-wire.mjs          the socket's name and every `ACTION_` wire
 *                            name (C5a);
 *   bridge-runs-acts.mjs     the runs of what a student does (C5a);
 *   bridge-runs-records.mjs  the runs of the records the GMs keep (C5a);
 *   bridge-table.mjs         BRIDGE_ACTIONS, the primary's listener
 *                            `onSocket`, which hands every packet to
 *                            `judge`, and `ask` (C5b);
 *   bridge-asks.mjs          every `requestX` and the asks that call `ask`
 *                            (C5b).
 * This file keeps its name and every name it exported - those that moved are
 * re-exported under the imports - so every importer still imports
 * gm-bridge.mjs, and none of those files imports it. A new bridge action puts
 * its wire name, row, run and ask in those files (R1239), never here.
 */

import { isPrimaryGm, primaryGmId, debug, error } from "./utils.mjs";
import { replyForMe, resendOnGmReady } from "./bridge-guards.mjs";

import { cardFlag } from "./secret.mjs";
import { sweepAskCards, claimsInProgress, releaseClaimsOf } from "./call-gm.mjs";
import {
    SOCKET_EVENT, ACTION_ADVANCEMENT_ASK, ACTION_ADVANCEMENT_OFFERS, ACTION_OPENING_ASK, ACTION_OPENING_CANCEL,
    ACTION_GM_READY
} from "./bridge-wire.mjs";
import { onSocket, ask } from "./bridge-table.mjs";

// R148 and anything else that asked gm-bridge.mjs for it keep finding it here (E31).
export { removalRefusal } from "./bridge-guards.mjs";

export {
    sweepAskCards, askObserveByCard, CALL_GM_WHAT, callCardHtml, callGm, claimOnPrimary, settleCall, askForRequest,
    promptForRequest, promptAndCallGm
} from "./call-gm.mjs";
export { sendOffersTo } from "./bridge-runs-acts.mjs";
export { dynamicRulingOf } from "./bridge-runs-records.mjs";
export { BRIDGE_ACTIONS } from "./bridge-table.mjs";
export {
    requestOpeningResult, requestOfferRecord, requestCardPost, requestBodyLoot, requestPassageShare,
    requestPassageCross, requestRefundCrossing, requestPassageFind, requestObject, requestEvidence, requestWithdraw,
    requestRepoint, requestTrialGm, requestClaim, requestTrialSide, requestTrialKeyword, requestPresent, requestTurn, requestReadyOpen, requestReadyAnswer,
    requestReadyEnd, requestArmCall, sendDespairToPrimary, requestOverflowAdd, requestOverflowClear, requestDespairSet,
    requestDespairAll, requestDespairRoster, requestOverflowTake, requestOverflowCheck, requestSabotage,
    requestUndoSabotage, requestProjectChange, requestSendBack, requestEclipseMove, requestNoteSave, requestBallotCast,
    requestBallot, requestTieTrace, requestRemnant, requestRemnantEdit, askObservePick, answerTraitRuling,
    answerHopeCall, askReshapeRuling, answerDynamic, requestHopeCallApproval, requestDynamicDifficulty,
    requestTraitRuling, requestObserveTarget, requestCleanableTraces, requestObserveResolve, requestAnalyzeResolve,
    requestAdvancement, requestShareBullet, requestGiveItem, requestCrisisResult, requestRollBookmark, requestReroll,
    requestCleanup, requestParkMurder, requestBetrayal, requestCubAbility, requestVaultSteal, requestSteal,
    requestFriskUnseen, requestFriskAsk, requestFriskAnswer, requestFriskFollow, requestPlant, requestStashSearch,
    requestProjectProgress, requestProjectShare, claimCard
} from "./bridge-asks.mjs";

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
    // A watch's hindrance die (E74, DA44): one or none, whatever the packet says; its cause is never sent.
    await throwOpeningRoll(payload.side, payload.actorId, payload.trait ?? null, { hindrance: payload.hindrance === 1 ? 1 : 0 });
}

/**
 * Ask a participant's own client to throw their Stage 4 roll.
 * @returns {boolean} false when nobody is there to ask, so the GM throws it.
 */
export function askOpeningRoll({ userId, actorId, side, trait, hindrance = 0 }) {
    if (!userId || !game.users.get(userId)?.active) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OPENING_ASK, userId, actorId, side, trait, ...(hindrance > 0 ? { hindrance: 1 } : {})
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
