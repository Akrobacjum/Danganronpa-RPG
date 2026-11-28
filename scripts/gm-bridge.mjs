/**
 * Danganronpa RPG - the bridge: the GM -> player wire and the registration.
 * ---------------------------------------------------------------------------
 * What stays here: `registerGmBridge` (the socket's listeners and a GM's
 * ready signal), a primary GM's arrival (`onGmReady`), a player's browser
 * loaded (`tellGmsPlayerReady`, `onPlayerReady`, 2.0 line T2 CALLS-04), the opening roll's
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
 *   bridge-asks.mjs          every `request*` and the asks that call `ask`
 *                            (C5b).
 * This file keeps its name and every name it exported - those that moved are
 * re-exported under the imports - so every importer still imports
 * gm-bridge.mjs, and none of those files imports it. A new bridge action puts
 * its wire name, row, run and ask in those files (R1239), never here.
 */

import { isPrimaryGm, primaryGmId, markGmReady, activeGmIds, debug, error, esc } from "./utils.mjs";
import { TIMING } from "./config.mjs";
import { replyForMe, resendOnGmReady } from "./bridge-guards.mjs";

import { cardFlag } from "./secret.mjs";
import { sweepAskCards, claimsInProgress, releaseClaimsOf, releaseOwnClaims } from "./call-gm.mjs";
import { pickWordsStored } from "./pick-receipt.mjs";
import { onCardTakenOver } from "./card-takeover.mjs";
import {
    SOCKET_EVENT, ACTION_ADVANCEMENT_ASK, ACTION_ADVANCEMENT_OFFERS, ACTION_OPENING_ASK, ACTION_OPENING_CANCEL,
    ACTION_GM_READY, ACTION_PLAYER_READY
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
    requestOpeningResult, requestOfferRecord, requestCardPost, requestGiveBullet, requestBodyLoot, requestPassageShare,
    requestPassageCross, requestLairLock, requestLairSeal, requestRefundCrossing, requestPassageFind, requestObject, requestEvidence, requestWithdraw,
    requestRepoint, requestTrialGm, requestClaim, requestTrialSide, requestTrialKeyword, requestPresent, requestTurn, requestReadyOpen, requestReadyAnswer,
    requestReadyEnd, requestArmCall, sendDespairToPrimary, requestOverflowAdd, requestOverflowClear, requestDespairSet,
    requestDespairAll, requestDespairRoster, requestOverflowTake, requestOverflowCheck, requestSabotage,
    requestUndoSabotage, requestProjectChange, requestSendBack, requestEclipseMove, requestNoteSave, requestBallotCast,
    requestBallot, requestTieTrace, requestRemnant, requestRemnantEdit, askObservePick, answerTraitRuling,
    answerHopeCall, askReshapeRuling, answerDynamic, requestHopeCallApproval, requestDynamicDifficulty,
    requestTraitRuling, requestObserveTarget, requestCleanableTraces, requestObserveResolve, requestAnalyzeResolve,
    requestAdvancement, requestShareBullet, requestGiveItem, requestCrisisResult, requestRollBookmark, requestReroll,
    requestCleanup, requestParkMurder, requestBetrayal, requestCubAbility, requestCubAnswer, requestBribeOffer, requestBribeAnswer, requestVaultSteal, requestSteal,
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
 * bridge-guards.mjs). Only while it is still waiting, and three times at most
 * per request (`RESENDS`), a primary's reload with a second GM here counted once
 * (2.0 line T2, CALLS-06, 27.11.2026).
 *
 * HEARD ON EVERY BROWSER SINCE 2.0 (line T2, PRIM-03, 27.11.2026). Until then only a player listened. Now the GM's world
 * having loaded is first of all what makes it count for the primary on this browser (utils.mjs `markGmReady`,
 * `primaryGmId`): from its `userConnected` to this packet it was loading here, and the next GM in the order held the
 * table. A GM's browser then reads who is the primary again (`notePrimary`) and stops: the asks again, the Level Ups
 * and `drpgPrimaryReady` are a player's, as before. Exported for E132 PRIM-03, which hands it a stand-in's packet.
 */
export function onGmReady(payload, senderId) {
    if (payload?.action !== ACTION_GM_READY) return;
    if (!game.users.get(senderId)?.isGM) return;
    markGmReady(senderId);
    if (game.user?.isGM) {
        notePrimary();
        return;
    }
    // The PRIMARY GM's arrival, not any GM's (COMM-05): a second GM joining
    // while the primary still had the question open made this client ask it
    // again, and the primary was answering the same request twice. When the
    // primary role has moved to the newcomer, the newcomer IS the primary.
    // Its own packet says it is up, whether or not this client has seen it connect (E04's fix round).
    if (senderId !== primaryGmId({ arriving: senderId })) return;
    // The sender is named: the second half of its own reload asks again for nothing spent (2.0 line T2, CALLS-06).
    resendOnGmReady(senderId);
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

/*
 * WHO IS THE PRIMARY ON THIS GM, AND WHEN IT MOVES (2.0 line T2, PRIM-03, 27.11.2026). Since the primary is a GM whose
 * world has loaded (utils.mjs `primaryGmId`), the role moves at a `bridge.gmReady` as well as at a connect or a leave,
 * and a browser that becomes the primary has work to pick up that no hook of its own asks for: the voice's plan
 * (voice.mjs, `drpgPrimaryChanged`). So each GM's browser reads the primary at its `registerGmBridge` (the first
 * reading, `from` null), at every `userConnected` and at every `bridge.gmReady` it hears, and once more
 * `TIMING.gmReadyWaitMs` after a GM connects (its bound, past which it counts as ready with no packet), and calls
 * `drpgPrimaryChanged` with `{ from, to }` when the reading differs from the last. A player's browser keeps no reading.
 * Since PRIM-02 (2.0 line T2, 27.11.2026) a user's role written is read too (`updateUser` with `role`, in
 * `registerGmBridge`): a GM made an Assistant or a player, or an Assistant made a full Gamemaster, moves the role with
 * no connect and no packet, and the GMs were never told. And each change is told to the GMs (`tellPrimaryChange`).
 * The rule of choice is unchanged: the role goes back to the ready full GM with the lowest id when that GM is back
 * (F1-infra PRIM-02 asked whether it should stay with the GM who took it over; the owner's answer, relayed 27.11.2026
 * as D2-29: it goes back, with the GMs told at the take-over and the hand-back).
 */
let primarySeen;

/** The step of the observer, pure: `{ from, to }` when `to` differs from the last reading `seen`, null when it does not
    or when there is no reading yet (`seen` undefined: this browser is not a GM's past its `registerGmBridge`). R9050. */
export function primaryChange(seen, to) {
    if (seen === undefined || to === seen) return null;
    return { from: seen, to };
}

/** Read the primary on this GM and tell `drpgPrimaryChanged` if it moved: `{ from, to }`, or null. */
export function notePrimary({ leaving = null } = {}) {
    if (!game.user?.isGM) return null;
    const change = primaryChange(primarySeen, primaryGmId({ leaving }));
    if (!change) return null;
    primarySeen = change.to;
    Hooks.callAll("drpgPrimaryChanged", change);
    tellPrimaryChange(change);
    return change;
}

/*
 * THE GMs ARE TOLD WHEN THE ROLE MOVES (2.0 line T2, PRIM-02, 27.11.2026; F1-infra PRIM-02, F3 S3 D1 and S5). The role
 * moved in silence: the primary left and the second GM took it within 0.3-0.8 s on Forge and knew nothing of it, and when
 * the first came back it took the role back as silently. Now each GM's browser tells its own GM, once a change (the
 * observer above answers a change once): the GM who became the primary that its browser now runs the table's automation
 * and should stay open, the GM who stopped who has it now, any other GM who has it now. A player is told nothing - the
 * observer runs on a GM's browser alone. The first reading at a GM's load (`from` null) is told nothing: a GM loading
 * the world is not taking anything over from anybody this browser saw, and a lone GM would be told at every load; the
 * panel's line (gm-panel.mjs `primaryLineHtml`, PRIM-01) says it there. A corner notice, kept in the notice history and
 * not sticky: a reload of the primary moves the role twice within a minute, and a sticky "you are now the primary" would
 * stand on after the role had gone back. A GM who becomes the primary while loading, by a role written to it, is not told
 * either, for the same reason as the first reading: its observer has no reading yet.
 */

/** The notice of `change` for the user `me`: `{ key, data, text }`, or null (a player; the first reading; nobody). R9051. */
export function primaryNoticeOf(change, { me = game.user?.id, isGM = game.user?.isGM, users = game.users } = {}) {
    if (!isGM || !change || change.from == null || !change.to) return null;
    const name = users?.get?.(change.to)?.name ?? "?";
    const [key, data] = change.to === me ? ["DRPG.Panel.primaryNowYou", null]
        : change.from === me ? ["DRPG.Panel.primaryBack", { name }] : ["DRPG.Panel.primaryNow", { name }];
    return { key, data, text: data ? game.i18n.format(key, data) : game.i18n.localize(key) };
}

/** Tell this GM of `change` in a corner notice (`showPopup`); the notice's words, or null when there is nothing to say. */
export function tellPrimaryChange(change) {
    const notice = primaryNoticeOf(change);
    if (!notice) return null;
    import("./popup.mjs")
        .then(({ showPopup }) => showPopup(`<p>${esc(notice.text)}</p>`, {
            title: game.i18n.localize("DRPG.Panel.primaryTitle"), kind: "info", source: "mine"
        }))
        .catch(err => debug("Could not tell this GM that the primary moved", err));
    return notice.text;
}

/**
 * A player's browser has loaded: the GMs are told (`bridge.playerReady`, to the GMs connected, nothing when none is), so the
 * primary ends the asks that player's page before this one left waiting (ask-withdraw.mjs `askerReloadedOnPrimary`; 2.0
 * line T2, CALLS-04, 28.11.2026). The packet carries no field but its name. Answers whether it was sent; `socket` and `users`
 * are a test's (R9032).
 */
export function tellGmsPlayerReady({ socket = game.socket, users = game.users } = {}) {
    const gms = activeGmIds(users);
    if (!gms.length) return false;
    socket.emit(SOCKET_EVENT, { action: ACTION_PLAYER_READY }, { recipients: gms });
    return true;
}

/**
 * A player's `bridge.playerReady` on a GM's browser (CALLS-04): handed to the primary's end of that sender's asks, which takes
 * the sender from Foundry's `senderId` alone and ends nothing off the primary or for a GM. False for any other packet or on
 * a player's browser; else the end's promise of the cards it ended.
 */
export function onPlayerReady(payload, senderId) {
    if (payload?.action !== ACTION_PLAYER_READY || !game.user?.isGM) return false;
    return import("./ask-withdraw.mjs")
        .then(m => m.askerReloadedOnPrimary(senderId))
        .catch(err => {
            debug("Could not end the asks of a player who reloaded", err);
            return [];
        });
}

export function registerGmBridge() {
    /* THE RESCUE SIGNAL IS "A GM IS LISTENING", NOT "A GM IS CONNECTED".
       -----------------------------------------------------------------------
       `userConnected` fires when a GM's socket comes up, which is many seconds
       before their world has finished loading and this very function has run -
       measured on a live reload: the re-sent question left before the GM had a
       listener for it and vanished. So the GM announces themselves once, HERE,
       at the point where they can actually answer, and anybody still waiting
       asks again. Every browser listens since 2.0 (line T2, PRIM-03): the packet
       is also what makes the GM count for the primary (`onGmReady`). A player's browser says the same since 2.0 (line T2,
       CALLS-04), so the primary ends the asks its page before left waiting (`tellGmsPlayerReady`). */
    if (game.user.isGM) game.socket.emit(SOCKET_EVENT, { action: ACTION_GM_READY });
    else tellGmsPlayerReady();
    game.socket.on(SOCKET_EVENT, onGmReady);

    // A ruling card with no thread to live in (see the fallback in `callGm`)
    // is a chat card, and its buttons need the same wiring a bubble gets.
    // After the secret swap: the import is a microtask, and the swap ran in
    // this same hook dispatch.
    if (game.user.isGM) {
        // The asks' cards left open by an asker who left or a primary that reloaded end at their time (E18 C2):
        // swept once this world is up, and again by the GM who becomes the primary when the primary leaves.
        // This GM's own claims left by its reload go first (2.0 line T2, CALLS-02, 27.11.2026; call-gm.mjs
        // `releaseOwnClaims`): swept before, a card past its time read the row as a claim under way and waited for an
        // end that the release might hand it a moment too early. The sweep waits for the release no longer than
        // `TIMING.gmStoreOpenMs` (a store that never opens settles no hydration), a bound chosen, not measured.
        const released = releaseOwnClaims().catch(err => debug("Could not let go of this GM's own claims", err));
        Promise.race([released, new Promise(resolve => setTimeout(resolve, TIMING.gmStoreOpenMs))])
            .then(() => sweepAskCards())
            .catch(err => debug("Could not sweep the asks' cards", err));
        // The first reading of the primary on this GM (`notePrimary`): `from` null.
        primarySeen = null;
        notePrimary();
        Hooks.on("userConnected", (user, connected) => {
            // A GM who left in the middle of a ruling holds no card any more (E18 C3).
            if (!connected && user?.id) releaseClaimsOf(user.id);
            // A player who left with asks held is signed on their cards for the GMs (2.0 line T2, CALLS-04, 28.11.2026;
            // ask-withdraw.mjs `askerLeftOnPrimary`): nothing ends here - a reload ends them at its `bridge.playerReady`.
            if (!connected && user && !user.isGM && isPrimaryGm()) {
                import("./ask-withdraw.mjs").then(m => m.askerLeftOnPrimary(user)).catch(err => debug("Could not sign the cards of a player who left", err));
            }
            // A player's leave reaches this line before any return (line T1's place, MURDER-06; 2.0 line T2, 27.11.2026).
            // A participant of a running incident who left (2.0 line T1 MURDER-06): the GMs told, the tracker marks it.
            import("./murder-ui.mjs").then(m => m.noteParticipantLeft(user, connected)).catch(err => debug("Could not note a participant who left", err));
            // A GM who connects or leaves can move the primary (2.0 line T2, PRIM-03); one who connects is read again at
            // its bound, past which it counts as ready without its packet.
            if (user?.isGM) {
                notePrimary({ leaving: connected ? null : user.id });
                if (connected) setTimeout(() => notePrimary(), TIMING.gmReadyWaitMs + 50);
            }
            if (connected || !user?.isGM || !isPrimaryGm({ leaving: user.id })) return;
            sweepAskCards({ leaving: user.id }).catch(err => debug("Could not sweep the asks' cards", err));
        });
        // The primary's word that another GM took over this GM's card closes its window of it (2.0 line T2, CALLS-01,
        // 27.11.2026): GM -> GM, taken only from the primary by Foundry's sender (card-takeover.mjs `onCardTakenOver`).
        game.socket.on(SOCKET_EVENT, onCardTakenOver);
        // A player's browser that has loaded ends the asks its page before left waiting (2.0 line T2, CALLS-04, 28.11.2026):
        // player -> GMs, taken from a player by Foundry's sender alone, on the primary (`onPlayerReady`).
        game.socket.on(SOCKET_EVENT, onPlayerReady);
        // A user's role written can move the primary (2.0 line T2, PRIM-02): a GM made an Assistant or a player, an
        // Assistant made a full Gamemaster. `updateUser` fires on every browser once the change is applied here.
        Hooks.on("updateUser", (user, changes) => {
            if ("role" in (changes ?? {})) notePrimary();
        });
        // A card deleted takes the GMs' row of who ruled it with it (E18 C3): the primary writes the rows, and drops them.
        Hooks.on("deleteChatMessage", message => {
            if (!isPrimaryGm() || !message?.id) return;
            claimsInProgress.delete(message.id);
            import("./gm-stores.mjs")
                .then(({ ruledCardStore }) => (ruledCardStore.has(message.id) ? ruledCardStore.drop(message.id) : null))
                .catch(err => debug("Could not drop a deleted card's ruling row", err));
        });
        // A statistic's pick whose asker's receipt came before its line: written as answered once its words are here
        // (2.0 line T2, CALLS-05, 28.11.2026; pick-receipt.mjs `pickWordsStored`, a lookup in a map for any other card).
        Hooks.on("drpgSecretStored", message => {
            if (isPrimaryGm()) pickWordsStored(message);
        });
        // A held Key fee's card: its "Charge the Key fee" asks the primary's charge again (E109, key-remnants.mjs `wireChargeHeld`).
        Hooks.on("renderChatMessageHTML", (message, element) => {
            if (!cardFlag(message, "keyChargeHeld")) return;
            import("./key-remnants.mjs")
                .then(m => m.wireChargeHeld(message, element))
                .catch(err => debug("Could not wire a held Key fee's card", err));
        });
        Hooks.on("renderChatMessageHTML", (message, element) => {
            /*
             * EVERY RULING CARD IN THE LOG, NOT ONLY ONE WITH NO THREAD (F118, 16.11.2026; AUDIT 9.2 S7-2, the owner's
             * local run L1 on Foundry 14.370). This wired only a card carrying `callCard` (from the words' meta, E06
             * C7a: the card is drawn again when they land), which only a card with no thread has. A thread's card
             * reached the GM's log as well, with enabled Approve, Change to and Refuse buttons that did nothing: a real
             * click changed nothing in 20 s, with no error. Any card whose drawn copy holds a `[data-drpg-call]` button
             * is wired now as the messenger wires its bubble; the claim on the primary (`claimCard`) keeps the two
             * copies to one ruling. Read after the import, a microtask: the secret swap draws the words in this same
             * hook dispatch, and a card with words to come holds no button before it.
             *
             * ASKED BEFORE THE IMPORT (1.2.122; the audit of 1.2.118, CORE-38). The import ran first, for every message
             * drawn on a GM - a whole log's worth at each load - and only then was the card asked whether it rules on
             * anything. The question waits for the same microtask (`Promise.resolve()`), and messenger-app.mjs is
             * imported only for a card that answers yes. Counts of work, not frame time (not measured).
             */
            Promise.resolve()
                .then(() => {
                    const body = element?.querySelector?.(".message-content") ?? element;
                    if (!cardFlag(message, "callCard") && !body?.querySelector?.("[data-drpg-call]")) return null;
                    return import("./messenger-app.mjs").then(m => m.wireCallActions(body, message));
                })
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
    if (payload.userId !== game.user?.id) return;
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
    if (payload.userId !== game.user?.id) return;
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
    // guarded (line INVEST of 1.2.122; R8182): a GM's ready packet can arrive while this page closes
    if (!game.user || game.user?.isGM) return;
    void ask(ACTION_ADVANCEMENT_ASK, {});
}
