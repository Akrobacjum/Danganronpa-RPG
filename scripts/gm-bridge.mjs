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
    LEVEL_UP, LEVEL_UP_OPTIONS
} from "./config.mjs";
import { announce, whisperToGms, whisperToOwner, ownerOf, isPrimaryGm, primaryGmId, activeGmIds, dialogContent, debug, warn, error, cardHead, esc, pause } from "./utils.mjs";

import { contentOf } from "./secret.mjs";
const SOCKET_EVENT = `module.${MODULE_ID}`;
const ACTION_PROGRESS = "project.progress";
const ACTION_SHARE = "project.share";
const ACTION_REMNANT = "remnant.place";
/* The weapon was swung on the player's client; the ledger that records
   which trace handed it over is the GM's. See `tieTraceForItem`. */
const ACTION_TIE_TRACE = "remnant.tieForItem";
const ACTION_REMNANT_EDIT = "remnant.edit";
const ACTION_SABOTAGE = "project.sabotage";
const ACTION_SABOTAGE_RESULT = "project.sabotageResult";
const ACTION_UNSABOTAGE = "project.unsabotage";
const ACTION_SENDBACK = "token.sendBack";
const ACTION_ECLIPSE_MOVE = "eclipse.move";
const ACTION_ARM = "call.arm";
const ACTION_ARM_RESULT = "call.armResult";
const ACTION_DESPAIR = "despair.adjust";
const ACTION_DIFFICULTY = "dynamic.difficulty";
const ACTION_DIFFICULTY_RESULT = "dynamic.difficultyResult";
/** player -> GM: "may I spend this Call, and here is what for". */
const ACTION_HOPE_CALL = "call.approve";
const ACTION_HOPE_CALL_RESULT = "call.approveResult";
const ACTION_OBSERVE_TARGET = "observe.target";
const ACTION_OBSERVE_TARGET_RESULT = "observe.targetResult";
const ACTION_OBSERVE_RESOLVE = "observe.resolve";
const ACTION_CLEANUP_TRACES = "cleanup.traces";
const ACTION_CLEANUP_TRACES_RESULT = "cleanup.tracesResult";
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
const ACTION_VAULT_STEAL = "vault.steal";
const ACTION_STEAL = "action.steal";
const ACTION_FIND_STASH = "vault.findStash";
const ACTION_PLANT = "action.plant";
const ACTION_CRISIS = "murder.crisis";
/** GM -> player: "Stage 4 is yours to throw." */
const ACTION_OPENING_ASK = "murder.openingAsk";
const ACTION_OPENING_CANCEL = "murder.openingCancel";
/** player -> GM: what it came up. */
const ACTION_OPENING_RESULT = "murder.openingResult";
const ACTION_CLEANUP = "murder.cleanup";
const ACTION_BETRAYAL = "murder.betrayal";
const ACTION_PARK_MURDER = "murder.park";
const ACTION_MEDDLE = "monocub.meddle";
const ACTION_ACK = "bridge.ack";
/** GM -> player: "your request arrived and was refused" - see `refuse`. */
const ACTION_REFUSED = "bridge.refused";
/** A GM's world has finished loading - see `registerGmBridge`. */
const ACTION_GM_READY = "bridge.gmReady";
const ACTION_LOOT = "body.loot";

/**
 * Player-side promises waiting on a GM ruling, keyed by request id.
 *
 * Each entry is `{ resolve, payload, resent }` rather than a bare `resolve`,
 * so a request that went unanswered can be ASKED AGAIN - see
 * `resendPendingRulings`, which is what makes a GM's reload survivable.
 */
const pendingRulings = new Map();

/**
 * Ask again for every ruling still outstanding, once per request.
 *
 * THE GM'S BROWSER IS ALLOWED TO CRASH. A ruling lives in a dialog open on
 * their screen and in nothing else: reloading with that window open threw the
 * question away, and the player sat on "Awaiting a ruling." until their own
 * three-minute timeout gave up. The action was spent and the roll was thrown,
 * so what they lost was real, and neither side had any way back to it (B-F5-1).
 *
 * The asking client is the one that survives all this, so it is the one that
 * repeats itself: when a GM connects and this browser is still waiting, the
 * original request goes out again with the SAME request id, so the answer
 * lands in the promise that is already waiting for it. Three minutes is long
 * enough for a browser to restart, which is what makes repeating the question
 * a real repair rather than a nicety.
 *
 * Once per request, and only while it is still outstanding: an answered
 * request is gone from this map, so nothing can ask a GM the same question
 * twice over.
 */
function resendPendingRulings() {
    for (const entry of pendingRulings.values()) {
        if (entry.resent || !entry.payload) continue;
        entry.resent = true;
        emitToGms(entry.payload);
        debug(`Re-sent a ruling request after a GM reconnected: ${entry.payload.action}`);
    }
}

/** A GM has finished loading and can answer questions again. */
function onGmReady(payload, senderId) {
    if (payload?.action !== ACTION_GM_READY) return;
    if (!game.users.get(senderId)?.isGM) return;
    // The PRIMARY GM's arrival, not any GM's (COMM-05): a second GM joining
    // while the primary still had the question open made this client ask it
    // again, and the primary was answering the same request twice. When the
    // primary role has moved to the newcomer, the newcomer IS the primary.
    if (senderId !== primaryGmId()) return;
    resendPendingRulings();
    // And the Level Ups: a primary that has just arrived is the one holding them.
    askForOffers();
}

/**
 * A player's request goes to the GMs, and to nobody else.
 *
 * Every request in this file used to be emitted with no `recipients`, so
 * Foundry relayed it to every connected client. A player's client dropped it
 * at `onSocket` - but the packet had already arrived, and a console listener
 * on any player's browser printed, in clear, who parked a direct murder and in
 * which room, who was stealing what from whom, which project was being
 * sabotaged, every crisis total and every Hope Call note. The replies were
 * addressed all along (`recipients: [asker]`); the questions were not.
 *
 * Addressed to the GMs who are connected. `hasGm()` runs before every request,
 * so the list is never empty here; the broadcast fallback is only for the
 * moment a GM drops between the check and the emit, where a packet to nobody
 * would otherwise be silently lost.
 */
function emitToGms(payload) {
    const recipients = activeGmIds();
    if (recipients.length) game.socket.emit(SOCKET_EVENT, payload, { recipients });
    else game.socket.emit(SOCKET_EVENT, payload);
}

/** Remember a request, and how to ask it again. */
function awaitRuling(requestId, resolve, payload) {
    pendingRulings.set(requestId, { resolve, payload, resent: false });
    emitToGms(payload);
}

/** Hand an arrived answer to whoever is waiting for it. */
function settleRuling(requestId, value) {
    const entry = pendingRulings.get(requestId);
    if (!entry) return false;
    pendingRulings.delete(requestId);
    entry.resolve(value);
    return true;
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
        Hooks.on("renderChatMessageHTML", (message, element) => {
            if (!message.getFlag(MODULE_ID, "callCard")) return;
            import("./messenger-app.mjs")
                .then(m => m.wireCallActions(element.querySelector(".message-content") ?? element, message))
                .catch(err => debug("Could not wire a ruling card in the log", err));
        });
    }
    game.socket.on(SOCKET_EVENT, onSocket);
    // The answer travels back to the asking player, who is not a GM - so this
    // listener has to sit outside the `isPrimaryGm` gate in `onSocket`.
    game.socket.on(SOCKET_EVENT, onRulingResult);
    // Same reason as above: the acknowledgement travels back to a player.
    game.socket.on(SOCKET_EVENT, onAck);
    // Same reason again: the real sabotage result travels back to a player.
    game.socket.on(SOCKET_EVENT, onSabotageResult);
    // And a Support paid for on the GM's side: what it cost, once it is armed.
    game.socket.on(SOCKET_EVENT, onArmResult);
    // And again: the chosen Observe target travels back to the observer.
    game.socket.on(SOCKET_EVENT, onObserveTargetResult);
    game.socket.on(SOCKET_EVENT, onHopeCallResult);
    game.socket.on(SOCKET_EVENT, onRefused);
    // And again: a killer's own cleanable-trace list travels back to them.
    game.socket.on(SOCKET_EVENT, onCleanupTracesResult);
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
 */
async function onOpeningAsk(payload, senderId) {
    if (payload?.action !== ACTION_OPENING_ASK) return;
    if (payload.userId !== game.user.id) return;
    if (!game.users.get(senderId)?.isGM) return;

    const { throwOpeningRoll } = await import("./murder.mjs");
    await throwOpeningRoll(payload.side, payload.actorId);
}

/**
 * Ask a participant's own client to throw their Stage 4 roll.
 * @returns {boolean} false when nobody is there to ask, so the GM throws it.
 */
export function askOpeningRoll({ userId, actorId, side }) {
    if (!userId || !game.users.get(userId)?.active) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OPENING_ASK, userId, actorId, side
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

/** Send a thrown opening roll to the GM, who owns Stage 4's state. */
export function requestOpeningResult({ actorId, side, total, isCritical, withHope }) {
    if (game.user.isGM) {
        return import("./murder.mjs")
            .then(m => m.resolveOpening({ actorId, side, total, isCritical, withHope }));
    }
    if (!hasGm()) return null;

    emitToGms({
        action: ACTION_OPENING_RESULT,
        userId: game.user.id,
        requestId: expectAck(ACTION_OPENING_RESULT),
        actorId, side, total, isCritical, withHope
    });
    return { pending: true };
}

/* ==========================================================================
 * ACKNOWLEDGEMENTS
 * --------------------------------------------------------------------------
 * Most of these requests are fire-and-forget: emit, return `{pending:true}`,
 * hope. `hasGm()` only proves a GM was connected at the moment of asking, so a
 * GM who dropped a second later took the request with them and the player was
 * never told - a sabotage, a project, a Remnant simply never happened.
 *
 * So every request now carries an id, and the receiving GM says "got it". No
 * answer inside the window means nobody is listening, and the player finds out
 * rather than waiting for something that is not coming.
 * ========================================================================== */

const awaitingAck = new Map();
const ACK_TIMEOUT_MS = TIMING.ackMs;

/** Watch for a "got it" and complain if none arrives. Returns the request id. */
/**
 * What a request is called on the player's screen.
 *
 * The same name as the thing they pressed, from the language file, rather
 * than an English literal typed beside each emit (COMM-14): the toast that
 * says "no GM answered" or "the GM's client refused" has to name the request
 * in the language the rest of the screen is in.
 */
function requestLabel(action) {
    const key = `DRPG.Bridge.what.${action}`;
    return game.i18n.has(key) ? game.i18n.localize(key) : String(action ?? "?");
}

function expectAck(action) {
    const requestId = foundry.utils.randomID();
    const timer = setTimeout(() => {
        if (!awaitingAck.has(requestId)) return;
        awaitingAck.delete(requestId);
        ui.notifications.warn(game.i18n.format("DRPG.Bridge.noAnswer", { what: requestLabel(action) }));
        warn(`No GM acknowledged "${action}" within ${ACK_TIMEOUT_MS}ms.`);
    }, ACK_TIMEOUT_MS);
    awaitingAck.set(requestId, timer);
    return requestId;
}

/**
 * Is this reply addressed to me, and did a GM actually send it?
 *
 * The four listeners below all run on a PLAYER's client, waiting for an answer.
 * They used to check only the address. A reply is an authority - "the GM ruled
 * 15", "the GM picked this Remnant", "the freeze took" - so a player able to
 * forge one could hand another player any answer they liked, including resolving
 * a promise that was waiting for a real ruling.
 */
function replyForMe(payload, senderId) {
    if (payload.userId !== game.user.id) return false;
    return Boolean(game.users.get(senderId)?.isGM);
}

function onAck(payload, senderId) {
    if (payload?.action !== ACTION_ACK) return;
    if (!replyForMe(payload, senderId)) return;
    const timer = awaitingAck.get(payload.requestId);
    if (timer === undefined) return;
    clearTimeout(timer);
    awaitingAck.delete(payload.requestId);
    debug(`Bridge request ${payload.requestId} acknowledged.`);
}

function onRulingResult(payload, senderId) {
    if (payload?.action !== ACTION_DIFFICULTY_RESULT) return;
    if (!replyForMe(payload, senderId)) return;

    // `false` is the GM saying no; `null` is nobody saying anything.
    settleRuling(payload.requestId, payload.ruling === false ? false : (payload.ruling ?? null));
}

/** The GM has answered a Call that needed their say-so. */
function onHopeCallResult(payload, senderId) {
    if (payload?.action !== ACTION_HOPE_CALL_RESULT) return;
    if (!replyForMe(payload, senderId)) return;

    settleRuling(payload.requestId, payload.verdict ?? null);
}

/** The GM has settled which Remnant this Observe is aimed at. */
function onObserveTargetResult(payload, senderId) {
    if (payload?.action !== ACTION_OBSERVE_TARGET_RESULT) return;
    if (!replyForMe(payload, senderId)) return;

    settleRuling(payload.requestId, payload.result ?? null);
}

/** The GM has computed which of a killer's traces their own client may act on. */
function onCleanupTracesResult(payload, senderId) {
    if (payload?.action !== ACTION_CLEANUP_TRACES_RESULT) return;
    if (!replyForMe(payload, senderId)) return;

    settleRuling(payload.requestId, payload.result ?? []);
}

/**
 * The real freeze-and-repair result, once the GM's client has actually written
 * it - not just acknowledged the request. `sabotageProject` used to return
 * `{pending: true}` to a player immediately after the socket emit and call that
 * good enough: the roll reported the target frozen and a repair project created
 * before either had actually happened. A player who then tried Work on Project
 * on the same target - which is exactly the "did the freeze take" question a
 * bug report would test first - could land inside that window and find it not
 * frozen yet. Waiting for this reply closes it: the action does not tell the
 * player "frozen now" until it is.
 */
function onSabotageResult(payload, senderId) {
    if (payload?.action !== ACTION_SABOTAGE_RESULT) return;
    if (!replyForMe(payload, senderId)) return;

    settleRuling(payload.requestId, payload.result ?? null);
}

/** A Call armed on somebody else's character, paid for on the GM's side (E03). */
function onArmResult(payload, senderId) {
    if (payload?.action !== ACTION_ARM_RESULT) return;
    if (!replyForMe(payload, senderId)) return;

    settleRuling(payload.requestId, payload.result ?? null);
}

/**
 * Who asked, and may they.
 *
 * Every request below arrives as a plain socket message, and the primary GM used
 * to act on all of them without asking who sent it or whether the numbers were
 * sane. Anyone with a console could adjust a Despair pool, push progress onto
 * somebody else's project, or teleport a token. These two helpers are the whole
 * defence: the sender has to be a real, connected user, and anything scoped to an
 * actor has to be an actor that sender actually owns.
 *
 * Who sent this, according to Foundry rather than according to the packet.
 *
 * This used to read `payload.userId` - a field the sender writes about itself.
 * Every guard in this file is built on the answer (`ownsActor` below decides
 * whether a request may touch a given character), so trusting the claim meant a
 * player could put any other user's id in the field and act as them: take a
 * crisis action with somebody else's character, spend their project progress,
 * empty their stash. The real id is Foundry's own second argument to a socket
 * handler and cannot be set by the sender - see `handleCustomSocket` in the
 * server's `sockets.mjs`, which stamps `this.user.id` on every delivery.
 */
/*
 * EXPORTED SO THE OTHER SOCKET IN THE MODULE CAN USE THE SAME TWO, rather than
 * grow its own pair a year later that is subtly different. traps.mjs runs the
 * one socket handler outside this file that acts on a named character; it now
 * opens with these, and R1b reads both files for the shape.
 */
export function senderOf(senderId) {
    const user = game.users.get(senderId ?? "");
    return user?.active ? user : null;
}

export function ownsActor(user, actorId) {
    if (!user || !actorId) return false;
    if (user.isGM) return true;
    return Boolean(game.actors.get(actorId)?.testUserPermission(user, "OWNER"));
}

/**
 * Refuse loudly in the log rather than silently doing the wrong thing - and
 * tell the asker (COMM-16).
 *
 * The acknowledgement leaves before any guard runs, so a request this side
 * then refuses used to be acknowledged to the player and dropped: a roll that
 * reported success and a world that did not change, which is the exact
 * symptom the ack was added to remove. One addressed packet closes it.
 */
function refuse(action, why, ctx = null) {
    // The sender's name, from Foundry's own `senderId`: the handbook sends a GM
    // to this line to find out who asked.
    const who = game.users?.get(ctx?.asker ?? "")?.name;
    warn(`Refused a "${action}" request over the socket${who ? ` from ${who}` : ""}: ${why}.`);
    tellRefused(ctx?.asker, action, ctx?.requestId ?? null);
    return null;
}

/**
 * Tell one player that the GM's client said no. Split out of `refuse` (E03) so
 * the other listeners that judge a player's request - Daggerheart's relay in
 * relay-guard.mjs above all - answer with the same packet and the same toast,
 * rather than a player's refused change simply never happening.
 */
export function tellRefused(userId, what, requestId = null) {
    if (!userId || userId === game.user?.id) return;
    try {
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_REFUSED, userId, requestId, what
        }, { recipients: [userId] });
    } catch {
        // A refusal nobody hears is the old behaviour, not a new failure.
    }
}

/** The GM's client refused a request this client sent. */
function onRefused(payload, senderId) {
    if (payload?.action !== ACTION_REFUSED) return;
    if (!replyForMe(payload, senderId)) return;
    ui.notifications.warn(game.i18n.format("DRPG.Bridge.refused", { what: requestLabel(payload.what) }));
    /* AND WHOEVER IS WAITING ON THE ANSWER STOPS WAITING (E03). A refused
       request that was awaited - a sabotage, a Support Call - used to sit on
       its promise until the three-minute ruling clock gave up, with the toast
       above already on the screen. It settles as "nothing was done" now,
       which is what every awaiting caller already reads a null as. */
    if (payload.requestId) {
        clearTimeout(awaitingAck.get(payload.requestId));
        awaitingAck.delete(payload.requestId);
        settleRuling(payload.requestId, null);
    }
}

    // Observe is scored on this side, because everything it is scored against -
    // which Remnants are in the room, what they are, what the difficulty is -
    // is exactly what the observer must not know. See observe.mjs.
async function handleObserveTarget(payload, senderId, ctx) {
    const { asker } = ctx;
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_OBSERVE_TARGET, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_OBSERVE_TARGET, "sender does not own that character", ctx);
    }

    const { chooseObserveTarget } = await import("./observe.mjs");
    const result = await chooseObserveTarget({
        actorId: payload.actorId,
        declaration: payload.declaration,
        request: payload.request,
        // The key is minted for this account and no other (E03; audit S05-03).
        userId: sender.isGM ? null : sender.id
    });

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OBSERVE_TARGET_RESULT,
        requestId: payload.requestId,
        userId: asker,
        result
    }, { recipients: [asker] });
    return;
}

    // Stage 6's picker. Which traces a killer's own client may act on is
    // computed here for the same reason Observe is: the ledger - the answer
    // key `cleanableRemnants` reads to build the list - lives only on a GM
    // client, and `cleanableTracesForPlayer` (cleanup.mjs) is what strips it
    // back down to id, label and the reinforced flag before it goes out.
async function handleCleanupTraces(payload, senderId, ctx) {
    const { asker } = ctx;
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_CLEANUP_TRACES, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_CLEANUP_TRACES, "sender does not own that character", ctx);
    }

    const { cleanableTracesForPlayer } = await import("./cleanup.mjs");
    const result = cleanableTracesForPlayer(payload.actorId, {
        mine: Boolean(payload.mine)
    });

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_CLEANUP_TRACES_RESULT,
        requestId: payload.requestId,
        userId: asker,
        result
    }, { recipients: [asker] });
    return;
}

async function handleObserveResolve(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_OBSERVE_RESOLVE, "unknown sender", ctx);
    // The sender has to own the character the packet names. That alone was
    // taken to mean "the person who asked for this key", and it did not: the
    // key named a character of its own and nothing compared the two (audit
    // S05-03). `resolveObserve` now holds the key to its character, its
    // account and one use (`observeResolveRefusal`), and an undo to a Reroll.
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_OBSERVE_RESOLVE, "sender does not own that character", ctx);
    }
    const undo = Boolean(payload.undo);
    if (undo && !sender.isGM) {
        const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
        const why = await spendRerollReceipt(payload.actorId, sender.id, "observe");
        if (why) return refuse(ACTION_OBSERVE_RESOLVE, why, ctx);
    }

    const { resolveObserve } = await import("./observe.mjs");
    const result = await resolveObserve({
        key: payload.key,
        // Carried so a resolve that finds no record can still name who is
        // waiting for it (ACT-08). Already checked against the sender above.
        actorId: payload.actorId,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical),
        undo,
        senderId: sender.id,
        senderIsGm: sender.isGM
    });
    if (result?.refused) return refuse(ACTION_OBSERVE_RESOLVE, result.refused, ctx);
    return;
}

    // Analyze is scored here for the same reason as Observe: the difficulty is
    // read from what the bullet really is, which is the answer being bought.
async function handleAnalyzeResolve(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_ANALYZE_RESOLVE, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_ANALYZE_RESOLVE, "sender does not own that character", ctx);
    }

    // An undo is a Reroll's, and is paid for by the receipt of one (E03).
    const undo = Boolean(payload.undo);
    if (undo && !sender.isGM) {
        const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
        const why = await spendRerollReceipt(payload.actorId, sender.id, "analyze");
        if (why) return refuse(ACTION_ANALYZE_RESOLVE, why, ctx);
    }

    const { resolveAnalyze } = await import("./analyze.mjs");
    const result = await resolveAnalyze({
        actorId: payload.actorId,
        itemId: payload.itemId,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical),
        undo
    });
    if (result?.refused) return refuse(ACTION_ANALYZE_RESOLVE, result.refused, ctx);
    return;
}

/*
 * A LEVEL UP THE PLAYER CHOSE, APPLIED BY THE GM WHO OFFERED IT (N-2).
 *
 * EVERY FIELD OF THIS PACKET IS A CLAIM. The sender says which character, which
 * kind and which options; a player who can open a console can say anything. So:
 * the sender has to own the character, the character has to be CARRYING an
 * offer, the kind comes off THE OFFER rather than off the packet, the number of
 * picks has to be the number that kind buys, and every option has to be one of
 * the five. Nothing here trusts the claim except the picks themselves, which
 * are the one thing the offer was made to let them choose.
 *
 * The offer is cleared by `applyAdvancement`, so a second packet finds nothing
 * standing and is refused by the same test that admitted the first.
 */
async function handleAdvancement(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_ADVANCEMENT, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_ADVANCEMENT, "sender does not own that character", ctx);
    }

    const actor = game.actors.get(payload.actorId);
    if (!actor) return refuse(ACTION_ADVANCEMENT, "no such character", ctx);

    const { pendingAdvance, applyAdvancement } = await import("./level-up.mjs");
    const offer = pendingAdvance(actor);
    if (!offer) return refuse(ACTION_ADVANCEMENT, "no Level Up is on offer for that character", ctx);

    const wanted = LEVEL_UP[offer.kind]?.picks ?? 0;
    const picks = Array.isArray(payload.picks) ? payload.picks : [];
    if (picks.length !== wanted) {
        return refuse(ACTION_ADVANCEMENT,
            `that offer buys ${wanted} pick(s), the packet carried ${picks.length}`, ctx);
    }
    if (picks.some(p => !LEVEL_UP_OPTIONS[p?.option])) {
        return refuse(ACTION_ADVANCEMENT, "a pick names something that is not an option", ctx);
    }

    /* Bounded on arrival as well as caught on the player's screen (level-up.mjs):
       a packet from an older client, or a forged one, must not spend the offer on
       a new experience that has no name. */
    if (picks.some(p => p.option === "experienceNew" && !String(p.name ?? "").trim())) {
        return refuse(ACTION_ADVANCEMENT, "a new experience has no name", ctx);
    }

    /* ONE AT A TIME PER CHARACTER. The offer is only withdrawn once
       `applyAdvancement` has written the rises and awaited the store, three round
       trips later; two packets inside that window - two stacked pickers, a double
       press on a slow server - both found the offer standing and both applied. The
       lines above are synchronous, so nothing interleaves between reading the offer
       and taking the latch. */
    if (advancing.has(actor.id)) {
        return refuse(ACTION_ADVANCEMENT, "a Level Up for that character is already being written", ctx);
    }
    advancing.add(actor.id);
    try {
        await applyAdvancement(actor, picks, offer.kind);
    } finally {
        advancing.delete(actor.id);
    }
    return;
}

/** Characters whose Level Up is being written right now (see handleAdvancement). */
const advancing = new Set();

/** A GM asks the primary to record or withdraw an offer (N-2). */
async function handleAdvancementOffer(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender?.isGM) return refuse(ACTION_ADVANCEMENT_OFFER, "only a GM hands out a Level Up", ctx);
    // A GM owns every character, so this refuses nothing a real GM sends; it is
    // here because R1b holds every handler that acts on `payload.actorId` to the
    // same two questions, and a rule with an exception is two rules.
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_ADVANCEMENT_OFFER, "sender does not own that character", ctx);
    }
    const actor = game.actors.get(payload.actorId);
    if (!actor || actor.type !== "character") {
        return refuse(ACTION_ADVANCEMENT_OFFER, "no such character", ctx);
    }
    const kind = payload.kind ?? null;
    if (kind !== null && !LEVEL_UP[kind]?.picks) {
        return refuse(ACTION_ADVANCEMENT_OFFER, `no such Level Up: ${kind}`, ctx);
    }
    const { recordOffer } = await import("./level-up.mjs");
    await recordOffer(actor.id, kind);
    return;
}

/** An owner asks for the offers on their own characters; the answer is the set. */
async function handleAdvancementAsk(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender || sender.isGM) return;
    sendOffersTo(sender.id);
    return;
}

/**
 * Primary GM: send one user the whole set of offers on their own characters.
 * Addressed - nobody else's browser receives it - and only when they are there.
 */
export async function sendOffersTo(userId) {
    const user = game.users.get(userId);
    if (!user?.active || user.isGM) return;
    const { offersFor } = await import("./level-up.mjs");
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_ADVANCEMENT_OFFERS, userId, offers: offersFor(userId)
    }, { recipients: [userId] });
}

/** A GM other than the primary: have the primary record or withdraw an offer. */
export function requestOfferRecord(actorId, kind) {
    // The caller is a GM, so a GM is connected - asked anyway, as every request is
    // (R6): one rule for every road out of this file.
    if (!hasGm()) return null;
    emitToGms({
        action: ACTION_ADVANCEMENT_OFFER, userId: game.user.id,
        requestId: expectAck(ACTION_ADVANCEMENT_OFFER), actorId, kind
    });
    return { pending: true };
}

/** An owner's browser: take the set the primary sent. Outside the primary gate. */
function onAdvancementOffers(payload, senderId) {
    if (payload?.action !== ACTION_ADVANCEMENT_OFFERS) return;
    if (!replyForMe(payload, senderId)) return;
    import("./level-up.mjs")
        .then(m => m.receiveOffers(payload.offers))
        .catch(err => error("Could not keep the Level Ups offered to you", err));
}

/** An owner's browser: ask the primary for this user's offers. */
function askForOffers() {
    if (game.user.isGM) return;
    emitToGms({ action: ACTION_ADVANCEMENT_ASK, userId: game.user.id });
}

    // Handing something to another character writes to a sheet the sender does
    // not own, so it can only happen here. The same-room condition is checked
    // again inside handover.mjs - the payload only claims it.
async function handleShareBulletOrGiveItem(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(payload.action, "unknown sender", ctx);
    if (!ownsActor(sender, payload.fromId)) {
        return refuse(payload.action, "sender does not own the character giving it away", ctx);
    }

    const { shareBullet, giveItem } = await import("./handover.mjs");
    const run = payload.action === ACTION_SHARE_BULLET ? shareBullet : giveItem;
    await run({ fromId: payload.fromId, toId: payload.toId, itemId: payload.itemId });
    return;
}

    // And into them. Same guards as the theft, mirrored - the sender has to own
    // the character whose pocket the item is leaving.
async function handlePlant(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_PLANT, "unknown sender", ctx);
    if (!ownsActor(sender, payload.plannerId)) {
        return refuse(ACTION_PLANT, "sender does not own the character planting", ctx);
    }

    const { plantOnPerson } = await import("./vault.mjs");
    await plantOnPerson({
        plannerId: payload.plannerId,
        victimId: payload.victimId,
        itemId: payload.itemId ?? null,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical),
        unseenTotal: Number(payload.unseenTotal) || 0,
        unseenCritical: Boolean(payload.unseenCritical)
    });
    return;
}

    // Looking for a hiding place. The finder owns their own sheet and could
    // write the flag themselves - which is exactly why they do not: that write
    // is the whole distance between beating a 16 and reading other people's
    // stashes, so it happens where the threshold is checked.
async function handleFindStash(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_FIND_STASH, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_FIND_STASH, "sender does not own that character", ctx);
    }

    const { resolveStashSearch } = await import("./vault.mjs");
    await resolveStashSearch({
        actorId: payload.actorId,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical)
    });
    return;
}

    // And out of their pockets. Same reasoning as the stash below, plus one
    // more: the thief's client is the one that would benefit from getting the
    // arithmetic wrong, so it does none of it.
async function handleSteal(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_STEAL, "unknown sender", ctx);
    if (!ownsActor(sender, payload.thiefId)) {
        return refuse(ACTION_STEAL, "sender does not own the character stealing", ctx);
    }

    const { stealFromPerson } = await import("./vault.mjs");
    await stealFromPerson({
        thiefId: payload.thiefId,
        victimId: payload.victimId,
        itemId: payload.itemId ?? null,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical),
        unseenTotal: Number(payload.unseenTotal) || 0,
        unseenCritical: Boolean(payload.unseenCritical)
    });
    return;
}

    // Taking something out of somebody else's stash writes to two sheets, one of
    // which the thief has no business writing to.
async function handleVaultSteal(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_VAULT_STEAL, "unknown sender", ctx);
    if (!ownsActor(sender, payload.thiefId)) {
        return refuse(ACTION_VAULT_STEAL, "sender does not own the character searching", ctx);
    }

    const { stealFromVault } = await import("./vault.mjs");
    await stealFromVault({
        thiefId: payload.thiefId, ownerId: payload.ownerId, itemId: payload.itemId,
        // Set only by the Search action, which pays for the concealment it is
        // beating. See the note in `stealFromVault`.
        viaSearch: Boolean(payload.viaSearch),
        // Trusted from the sender, and it is worth saying why when nothing
        // else in this handler is. A client that lied would only ever lie
        // one way - claiming a steady hand - and the cost of believing it is
        // that the victim is not told. That is exactly the state this branch
        // shipped in for four updates, so a forged `false` buys a cheat
        // nothing it did not already have, while re-rolling the dice here to
        // check would be a second roll for one action.
        clumsy: Boolean(payload.clumsy)
    });
    return;
}

    // Stage 4 thrown on the participant's own client. Same guard as a crisis
    // action: the sender has to own the character the roll is about, or one
    // player could open somebody else's murder for them.
async function handleOpeningResult(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_OPENING_RESULT, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_OPENING_RESULT, "sender does not own that character", ctx);
    }

    const { resolveOpening } = await import("./murder.mjs");
    await resolveOpening({
        actorId: payload.actorId,
        side: payload.side,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical),
        withHope: Boolean(payload.withHope)
    });
    return;
}

    // A crisis action writes to the other participant's sheet, to the map and to
    // the shared incident state. All three are GM-only.
async function handleCrisis(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_CRISIS, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_CRISIS, "sender does not own that character", ctx);
    }

    const { resolveCrisisAction, freeResolutionFor, sideOf, crisisRefusal, crisisUndoRefusal } = await import("./murder.mjs");
    const actor = game.actors.get(payload.actorId);

    /*
     * JUDGED AGAIN HERE (E03, 24.09.2026; audit S04-09). The stage, the side,
     * the turn, the locks and what the character has left to spend were all
     * checked on the player's own client and never here, so a console could
     * throw a finishing blow out of turn, and a packet that arrived after the
     * GM had moved the incident on still applied. An undo is a Reroll's, and
     * is paid for by the receipt of one; `undoLastCrisis` then checks that the
     * action it rewinds was this character's.
     */
    if (!sender.isGM) {
        if (payload.undo) {
            // Judged as the action was taken, not as it left things - see `crisisUndoRefusal`.
            const undoWhy = crisisUndoRefusal(actor, payload.key);
            if (undoWhy) return refuse(ACTION_CRISIS, undoWhy, ctx);
            const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
            const why = await spendRerollReceipt(payload.actorId, sender.id, "crisis");
            if (why) return refuse(ACTION_CRISIS, why, ctx);
        } else {
            const refusal = crisisRefusal(actor, payload.key);
            if (refusal) return refuse(ACTION_CRISIS, refusal.why, ctx);
        }
    }

    await resolveCrisisAction({
        actorId: payload.actorId,
        key: payload.key,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical),
        withHope: Boolean(payload.withHope),
        // A Reroll replacing this actor's own last crisis action. The GM
        // side checks the receipt belongs to them before unwinding anything.
        undo: Boolean(payload.undo),
        // Narrowed rather than trusted: the only two answers this can carry
        // are the two resources a critical Strike may take.
        choice: payload.choice === "stress" ? "stress"
            : payload.choice === "hp" ? "hp" : null,
        // An id, and one the sender's own character actually holds. It only
        // ever becomes a receipt line, but a receipt naming somebody else's
        // item would give a Reroll the run of another sheet.
        usedItemId: game.actors.get(payload.actorId)?.items?.has(payload.usedItemId)
            ? payload.usedItemId : null,
        // Same test: the swing memo names an item, and only one the sender holds.
        swungId: game.actors.get(payload.actorId)?.items?.has(payload.swungId)
            ? payload.swungId : null,
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
        free: Boolean(payload.free) && Boolean(freeResolutionFor(sideOf(actor)))
    });
    return;
}

    // A direct murder declared in the dark. The declaration is a world write and
    // the killer has no permission for one, so it travels; the judgement happens
    // when the Eclipse ends, on this side, off the final placement.
    //
    // Nothing about the outcome is decided here or sent back - that is the whole
    // point of parking it, and a bridge that answered "recorded" with anything
    // more would be the leak this change exists to close.
async function handleParkMurder(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_PARK_MURDER, "unknown sender", ctx);
    if (!ownsActor(sender, payload.killerId)) {
        return refuse(ACTION_PARK_MURDER, "sender does not own that character", ctx);
    }
    const eclipse = await import("./eclipse.mjs");
    await eclipse.writeParkedMurder({
        killerId: payload.killerId,
        room: payload.room ?? null,
        note: payload.note ?? ""
    });
    return;
}

    // The newcomer turns on the person they just helped. Opening a murder is a
    // world write and a second death, so the request travels and the decision
    // is re-derived from the incident on this side - `betrayAsPlayer` refuses
    // anyone the state does not put in that position.
async function handleBetrayal(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_BETRAYAL, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_BETRAYAL, "sender does not own that character", ctx);
    }
    const murder = await import("./murder.mjs");
    await murder.betrayAsPlayer(payload.actorId);
    return;
}

    // Stage 6. Deleting a Remnant token, placing the new one a botched wipe
    // leaves, and reading how visible the trace was in the first place are all
    // GM-only - the last of those most of all, since it is the threshold the
    // roll is being measured against. See cleanup.mjs.
async function handleCleanup(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_CLEANUP, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_CLEANUP, "sender does not own that character", ctx);
    }

    const cleanup = await import("./cleanup.mjs");

    // The two added Stage 6 actions score differently - a flat threshold
    // rather than one read off a trace's visibility - so they have their own
    // resolver. Same guard, same sender check; only the maths differs.
    // An undo is a Reroll's, and is paid for by the receipt of one (E03).
    if (payload.undo && !sender.isGM) {
        const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
        const why = await spendRerollReceipt(payload.actorId, sender.id, "cleanup");
        if (why) return refuse(ACTION_CLEANUP, why, ctx);
    }

    if (payload.key && payload.key !== "eraseTrace" && payload.key !== "transformTrace") {
        const result = await cleanup.resolveStageSix({
            actorId: payload.actorId,
            key: payload.key,
            targetId: payload.targetId ?? null,
            total: Number(payload.total) || 0,
            isCritical: Boolean(payload.isCritical),
            withHope: Boolean(payload.withHope),
            viaAction: Boolean(payload.viaAction),
            // Which step the client paid. Bounded on arrival against
            // PRICE_CHAINS, like `transform` and `change` (T-1).
            price: payload.price ?? null,
            grant: Boolean(payload.grant)
        });
        if (result?.refused) return refuse(ACTION_CLEANUP, result.refused, ctx);
        return;
    }

    await cleanup.resolveCleanup({
        actorId: payload.actorId,
        tokenId: payload.tokenId,
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical),
        withHope: Boolean(payload.withHope),
        // G-20. Passed through as sent and bounded on arrival -
        // `resolveCleanup` checks both halves against `CLEANUP.transform`
        // before it touches anything, which is the same check a GM-side
        // call gets.
        transform: payload.transform ?? null,
        // Z5, and the same contract: sent as given, bounded on arrival.
        mode: payload.key === "transformTrace" ? "transform" : "erase",
        change: payload.change ?? null,
        undo: Boolean(payload.undo),
        // T-1, same contract: sent as given, bounded on arrival.
        price: payload.price ?? null,
        grant: Boolean(payload.grant),
        // A claim that WAIVES Stage 6's guards and ADDS one of its own: the
        // trace has to belong to the sender. Forging it costs them the
        // right to touch anybody else's trace, which is the only thing the
        // waived guards were protecting.
        viaAction: Boolean(payload.viaAction)
    });
    return;
}

    // A Meddle writes to the TARGET's sheet, not the Monocub's own - arming a
    // Call is exactly the write a player has no permission to make on somebody
    // else's actor.
async function handleMeddle(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_MEDDLE, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_MEDDLE, "sender does not own that Monocub", ctx);
    }

    const { resolveMeddle } = await import("./monocub.mjs");
    await resolveMeddle({
        actorId: payload.actorId,
        targetId: payload.targetId,
        help: Boolean(payload.help),
        total: Number(payload.total) || 0,
        isCritical: Boolean(payload.isCritical)
    });
    return;
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
 * action-rolls.mjs), so the guard refuses nothing honest.
 */
async function handleHopeCall(payload, senderId, ctx) {
    const { asker } = ctx;
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_HOPE_CALL, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_HOPE_CALL, "sender does not own that character", ctx);
    }
    await askHopeCallByCard(payload, asker);
    return;
}

async function handleDifficulty(payload, senderId, ctx) {
    const { asker } = ctx;
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_DIFFICULTY, "unknown sender", ctx);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_DIFFICULTY, "sender does not own that character", ctx);
    }
    await askDynamicByCard(payload, asker);
    return;
}

async function handleProgress(payload, senderId, ctx) {
    const { asker } = ctx;
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_PROGRESS, "unknown sender", ctx);

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
    const { canSee } = await import("./projects.mjs");
    if (!canSee(payload.countdownId, sender)) {
        return refuse(ACTION_PROGRESS, "sender may not see that project", ctx);
    }

    // Progress comes from an action or a Call, so it is small by definition.
    // A payload asking for +999 is not the rules asking.
    const amount = Math.trunc(Number(payload.amount));
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > STARTING.despairMax) {
        return refuse(ACTION_PROGRESS, `amount ${payload.amount} is out of range`, ctx);
    }

    /*
     * PROGRESS TAKEN BACK IS A REROLL'S, AND A REROLL HAS A RECEIPT (E03,
     * 24.09.2026; audit S09-02). The one road a player's own client takes
     * progress away down is a Reroll undoing Work on Project (reroll.mjs). The
     * only Calls that take it away are Despair Calls, bought by a Monokuma - a
     * GM. So a player's negative amount has to name their own character and
     * follow a Reroll of that character's roll (reroll-receipts.mjs), or a
     * console could walk anybody's visible project back to nothing.
     */
    if (amount < 0 && !sender.isGM) {
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_PROGRESS, "progress taken back without the sender's own character", ctx);
        }
        const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
        const why = await spendRerollReceipt(payload.actorId, sender.id, "progress");
        if (why) return refuse(ACTION_PROGRESS, why, ctx);
    }

    const { addProgress } = await import("./projects.mjs");
    // Who asked, so a finished project can fall back to them when nobody
    // recorded who proposed it.
    const result = await addProgress(payload.countdownId, amount, { by: asker });
    debug(`Applied ${payload.amount} progress to ${payload.countdownId} on behalf of a player.`, result);

    // Report back to whoever asked.
    //
    // A player cannot see whether their request arrived, was applied, or was
    // clamped to nothing - so a project that refused to move looked exactly
    // like a socket that never fired. Now it says which of the three it was.
    const to = asker ? [asker] : [];
    if (!to.length) return;

    const line = !result
        ? game.i18n.localize("DRPG.Project.gone")
        : result.changed === false
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
    return;
}

async function handleShare(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_SHARE, "unknown sender", ctx);

    // You may only share what you can already see.
    //
    // This used to check that the sender was a real user and nothing else,
    // so "share this project with me" was a single socket emit - aimed at
    // any project in the world, including somebody else's SECRET one. A
    // secret project is a murder plan; `resealSecretProjects` exists to keep
    // players out of exactly these, and this handler let a player back in
    // through the front door.
    const { canSee, shareWith, isSecret } = await import("./projects.mjs");
    if (!canSee(payload.countdownId, sender)) {
        return refuse(ACTION_SHARE, "sender cannot see that project", ctx);
    }
    // Only a secret project has anybody to let in, and only a player can be
    // let in (E03; audit S09-02) - see `shareWith`.
    if (!isSecret(payload.countdownId)) {
        return refuse(ACTION_SHARE, "that project is not secret", ctx);
    }
    const guest = game.users.get(payload.targetUserId ?? "");
    if (!guest || guest.isGM) {
        return refuse(ACTION_SHARE, "the project can only be shared with a player", ctx);
    }

    await shareWith(payload.countdownId, payload.targetUserId);
    debug(`Shared project ${payload.countdownId} with ${payload.targetUserId} on behalf of a player.`);
    return;
}

async function handleRemnant(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_REMNANT, "unknown sender", ctx);
    if (!ownsActor(sender, payload.data?.sourceActor)) {
        return refuse(ACTION_REMNANT, "sender does not own the character leaving it", ctx);
    }
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
    let data = { ...(payload.data ?? {}) };
    if (!sender.isGM) {
        const actor = game.actors.get(payload.data.sourceActor);
        const { locateActor } = await import("./movement.mjs");
        const { getClock } = await import("./clock.mjs");
        const narrowed = narrowPlayerRemnant(data, actor, locateActor(actor, { sceneId: data.sceneId ?? null }), getClock());
        if (narrowed.refused) return refuse(ACTION_REMNANT, narrowed.refused, ctx);
        data = narrowed.data;
    }
    await placeRemnant(data);
    debug("Placed a Remnant on behalf of a player.");
    return;
}

async function handleTieTrace(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_TIE_TRACE, "unknown sender", ctx);

    /*
     * ONLY THE ONE HOLDING THE OBJECT (E01, 24.09.2026; audit S14-03). Tying a trace
     * to the crime is a verdict on evidence - the trace becomes an Incident trace the
     * chapter-end sweep will not clear - and this took any identity from any player.
     * The one honest sender is the killer's client at the moment they swing the
     * object (murder.mjs), before the crisis packet that could use it up, so the
     * object is still in one of the sender's own characters' hands when this runs.
     */
    const identity = payload.identity;
    /*
     * AND ONLY DURING THE FIGHT, BY SOMEBODY IN IT (E03; audit S10-11). Holding
     * the object is not enough: a player could tie their own Search's traces to
     * the crime a week before any murder, and those would then survive the
     * sweep and top the dashboard. The honest sender swings the object inside
     * a crisis action, so the incident is at its incident stage and the holder
     * is one of its participants - the victim included, whose Self-defence and
     * Role reversal swing a weapon too.
     */
    const { murderState, participantIds } = await import("./murder.mjs");
    const state = murderState();
    const cast = state?.stage === "incident" ? new Set(participantIds(state)) : new Set();
    const holds = Boolean(identity) && game.actors.some(actor =>
        cast.has(actor.id)
        && ownsActor(sender, actor.id)
        && actor.items.some(item => item.getFlag(MODULE_ID, "drpgItemId") === identity));
    if (!holds) return refuse(ACTION_TIE_TRACE, "no participant of the running incident the sender plays holds that object", ctx);
    const { tieTraceForItem } = await import("./remnants.mjs");
    await tieTraceForItem(payload.identity);
    return;
}

async function handleRemnantEdit(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_REMNANT_EDIT, "unknown sender", ctx);

    // Only the character who left it may re-rate it, which is what a reroll
    // of their own action is. Anyone else editing evidence is the one thing
    // an investigation cannot survive.
    const scene = game.scenes.get(payload.sceneId) ?? canvas?.scene;
    const token = scene?.tokens?.get(payload.tokenId);
    // From the ledger, which this GM holds - the token has carried no
    // `sourceActor` flag since the answer key moved off it (CASE-09), so
    // this read was always undefined and every legitimate edit refused.
    const { remnantData } = await import("./remnants.mjs");
    const source = remnantData(token)?.sourceActor ?? null;
    if (!ownsActor(sender, source)) {
        return refuse(ACTION_REMNANT_EDIT, "sender did not leave that Remnant", ctx);
    }

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
    /*
     * A PLAYER'S EDIT IS A REROLL'S (E03, 24.09.2026; audit S05-13). The two
     * honest senders are both in reroll.mjs: lift the trace the first throw
     * left, or retune its band to the new one. From a console, `remove` took a
     * killer's own incident trace off the map in the middle of the
     * investigation, and a retune turned it Hidden. So a player's edit needs a
     * Reroll receipt for their character, and the trace must be one a Reroll
     * can reach: fresh, and untouched by a GM's hand. A removal also needs it
     * not yet copied into anybody's Truth Bullet - once somebody has found it,
     * it is evidence. (The first E03 build asked this of removals only, and a
     * receipt from any Reroll re-banded a trace from days ago; the E03 review.)
     */
    if (!sender.isGM) {
        const { remnantGmEdited } = await import("./remnants.mjs");
        let copied = false;
        if (payload.patch?.remove) {
            const { copiedRemnants } = await import("./truth-bullets.mjs");
            copied = game.actors.some(a => a.type === "character" && copiedRemnants(a).has(token.id));
        }
        const data = remnantData(token);
        const reach = removalRefusal(token, {
            gmEdited: remnantGmEdited(token), copied, placedAt: data?.placedAt ?? null, restored: Boolean(data?.restored)
        });
        const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
        const why = await spendRerollReceipt(source, sender.id, "remnant", () => reach);
        if (why) return refuse(ACTION_REMNANT_EDIT, why, ctx);
    }

    const { REMNANT_VISIBILITY_LABELS, CLEANUP } = await import("./config.mjs");
    const asked = payload.patch ?? {};
    const narrowed = { remove: Boolean(asked.remove) };
    if (REMNANT_VISIBILITY_LABELS[asked.visibility]) narrowed.visibility = asked.visibility;
    // The type is a GM's to change, never a player's: the one honest player
    // sender (reroll.mjs) sends a band and nothing else, and a trace's type
    // decides who may tamper with it and how hard it is to Observe (E03 second
    // review). The killer's own re-typing goes through cleanup.mjs on the GM.
    if (sender.isGM && CLEANUP.transform?.types?.includes(asked.type)) narrowed.type = asked.type;

    const { retuneRemnant } = await import("./remnants.mjs");
    await retuneRemnant(payload.sceneId, payload.tokenId, narrowed);
    debug("Retuned a Remnant on behalf of a player.", narrowed);
    return;
}

/**
 * Why a player's Reroll may not lift or retune this trace, or null (E03). Pure.
 * `copied` is asked only of a removal: a player's retune moves only the
 * visibility band (a type in a player's packet is dropped above), which changes
 * how findable a trace is, not what it says.
 */
export function removalRefusal(token, { gmEdited = false, copied = false, placedAt = null, restored = false, now = Date.now() } = {}) {
    if (gmEdited) return "a GM has written on that trace";
    // Put back by a cleanup Reroll under a new id: whether somebody found the
    // original is no longer readable, so it is not a Reroll's to touch.
    if (restored) return "a Reroll put that trace back";
    if (copied) return "somebody has already found that trace";
    /* HOW OLD, from the ledger's own `placedAt`, else the token's `_stats`. A trace
       with neither - placed before 1.2.60 on a table whose tokens carry no
       `_stats` - is refused: "old enough that nobody wrote down when" is the
       case this check is for (the E03 second review found the first build let
       every such trace through). */
    const when = Number(placedAt ?? token?._stats?.createdTime);
    if (!Number.isFinite(when)) return "there is no record of when that trace was left";
    if (now - when > TIMING.rerollWindowMinutes * 60_000) return "that trace is older than a Reroll can reach";
    return null;
}

async function handleSabotage(payload, senderId, ctx) {
    const { asker } = ctx;
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_SABOTAGE, "unknown sender", ctx);

    // Freezing somebody's work is aimed at a project you found, not at an
    // id. Seeing it is the condition the picker is built from
    // (`sabotageTargetsIn` lists what this user can see), and it was the one
    // thing this side never asked - so any project in the world could be
    // frozen from a console, including a secret one whose existence the
    // sender had no way to learn honestly.
    const { canSee, sabotageProject } = await import("./projects.mjs");
    if (!canSee(payload.targetId, sender)) {
        return refuse(ACTION_SABOTAGE, "sender cannot see that project", ctx);
    }

    // `difficulty` becomes the repair project's progress target, so it is
    // how much work the freeze costs its owner to undo. It arrived unread: a
    // payload asking for a target of 9999 froze a project for the rest of
    // the season. The ceiling is the hardest scale the rules define, read
    // from the table rather than written out here.
    const hardest = Math.max(...Object.values(PROJECT_SCALE).map(s => s.progress));
    const difficulty = Math.trunc(Number(payload.difficulty));
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > hardest) {
        return refuse(ACTION_SABOTAGE, `difficulty ${payload.difficulty} is out of range (1–${hardest})`, ctx);
    }

    // Who asked, so that only their own Reroll can take it back (E03).
    const result = await sabotageProject(payload.targetId, difficulty,
        { saboteur: sender.isGM ? null : sender.id });

    // Tell the asker what actually happened - not just that the request
    // arrived. Without this a player's own sabotage always reported success
    // and a repair project by name, whether or not the freeze and the
    // repair it depends on were ever written.
    //
    // Addressed to them, too. A broadcast announced every sabotage - and the
    // name of the repair project it created - to the whole table, which is
    // the one thing a saboteur is buying secrecy for.
    if (payload.requestId) {
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_SABOTAGE_RESULT, requestId: payload.requestId,
            userId: senderId, result
        }, { recipients: [senderId] });
    }
    return;
}

async function handleUnsabotage(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_UNSABOTAGE, "unknown sender", ctx);

    // Same rule as freezing it. Thawing is the completion of a repair
    // project, so the sender has to be able to see what they are thawing.
    const { canSee, undoSabotage, unsabotageRefusal } = await import("./projects.mjs");
    if (!canSee(payload.targetId, sender)) {
        return refuse(ACTION_UNSABOTAGE, "sender cannot see that project", ctx);
    }

    /*
     * THE PAIR, THE CHARACTER AND THE REROLL (E03, 24.09.2026; audit S10-03,
     * S09-02). This checked that the sender could see the target and nothing
     * else, and `undoSabotage` then deleted whatever project id arrived as the
     * "repair": one packet naming any public project and a secret murder plan's
     * id deleted the plan, its token and its trap. The only honest sender is a
     * Reroll taking back its own sabotage, so the pair has to be the one the
     * sabotage wrote (`unsabotageRefusal`), the character has to be the
     * sender's, and a Reroll of that character's roll has to have happened.
     */
    if (!sender.isGM) {
        const why = unsabotageRefusal({
            targetId: payload.targetId ?? null, repairId: payload.repairId ?? null, senderId: sender.id
        });
        if (why) return refuse(ACTION_UNSABOTAGE, why, ctx);
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_UNSABOTAGE, "sender does not own that character", ctx);
        }
        const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
        const paid = await spendRerollReceipt(payload.actorId, sender.id, "sabotage");
        if (paid) return refuse(ACTION_UNSABOTAGE, paid, ctx);
    }

    await undoSabotage(payload.targetId, payload.repairId, { senderId: sender.isGM ? null : sender.id });
    return;
}

async function handleSendback(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    const scene = game.scenes.get(payload.sceneId);
    const token = scene?.tokens?.get(payload.tokenId);
    if (!ownsActor(sender, token?.actorId)) {
        return refuse(ACTION_SENDBACK, "sender does not own that token", ctx);
    }

    /*
     * BACK, AND ONLY BACK (E03, 24.09.2026; audit S10-40). The whole packet's
     * `position` went into `token.update` with the flag that says "this is our
     * own revert, charge nothing" - any x, y and elevation, and anything else a
     * token has. Now the fields are read out by name, and the place has to be
     * one the token was moved from in the last minute, as this client saw it.
     * The move and the request are two messages; the first is given a moment.
     */
    const { REVERT, recentPositions, roomsVisited, positionIn, sendBackRefusal } = await import("./movement.mjs");
    const asked = payload.position ?? {};
    const judge = () => sendBackRefusal(asked, {
        scene, history: recentPositions(token.id),
        centres: [...roomsVisited(token)].map(room => positionIn(room, token))
    });
    let why = judge();
    if (why) {
        await pause(300);
        why = judge();
    }
    if (why) return refuse(ACTION_SENDBACK, why, ctx);

    const to = { x: Number(asked.x), y: Number(asked.y) };
    if (asked.elevation !== undefined) to.elevation = Number(asked.elevation);
    if (asked.level !== undefined) to.level = asked.level;
    await token.update(to, { animate: false, [REVERT]: true });
    return;
}

async function handleLoot(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_LOOT, "unknown sender", ctx);

    // You may fill your own pockets and nobody else's. Without this, "move
    // that knife onto whoever I like" was a single socket emit away.
    if (!ownsActor(sender, payload.takerId)) {
        return refuse(ACTION_LOOT, "sender does not own the character doing the taking", ctx);
    }

    const { lootBody } = await import("./handover.mjs");
    // Everything else it needs to refuse - the body being alive, the item
    // being a Truth Bullet - `lootBody` checks itself, because the GM's own
    // button goes through the same door.
    await lootBody({
        takerId: payload.takerId, bodyId: payload.bodyId, itemId: payload.itemId
    });
    return;
}

async function handleArm(payload, senderId, ctx) {
    const actor = game.actors.get(payload.actorId);
    // Refused out loud: the asker now waits for an answer (E03).
    if (!actor) return refuse(ACTION_ARM, "no such character", ctx);
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_ARM, "unknown sender", ctx);

    // The BUYER has to be the sender's own character - never the
    // beneficiary, who is somebody else's by definition for Support and For
    // the Game. Every other handler here checks ownership and this one did
    // not, so "arm me a Free Critical" was a single socket emit away, paid
    // for with nothing.
    const buyerId = payload.call?.from ?? payload.actorId;
    if (!ownsActor(sender, buyerId)) {
        return refuse(ACTION_ARM, "sender does not own the character paying for it", ctx);
    }

    /*
     * WHAT A PLAYER MAY ARM ON SOMEBODY ELSE, AND WHO PAYS (E03, 24.09.2026;
     * audit S10-09, decision D2).
     *
     * This took any Call from either table as long as `grants` matched, so a
     * player could arm a Monokuma's Obstacle on a rival - disadvantage on their
     * next roll and a whisper saying Monokuma did it - and pay nothing, because
     * the price was taken on the player's own client and nothing here looked at
     * it. The one Call a player arms on somebody else's character is a Hope Call
     * aimed at another player (`playerArmRefusal`), and the Hope for it is now
     * taken HERE, from the buyer's sheet as this client sees it, after every
     * check and before the Call is armed. The whisper's voice comes from the
     * table the key was found in, never from the packet.
     */
    const { appendArmedCall, alreadyArmed, playerArmRefusal } = await import("./call-effects.mjs");
    if (!sender.isGM) {
        const refusal = playerArmRefusal(payload.call);
        if (refusal) return refuse(ACTION_ARM, refusal, ctx);
        return armPaidByPlayer(actor, game.actors.get(buyerId), payload, ctx);
    }

    // A GM's own road (a Monokuma arming from another GM's client): any Call
    // the rules define, as long as `grants` is the one that Call buys.
    const call = HOPE_CALLS[payload.call?.key] ?? DESPAIR_CALLS[payload.call?.key];
    if (!call || call.grants !== payload.call?.grants) {
        return refuse(ACTION_ARM, `"${payload.call?.key}" does not grant "${payload.call?.grants}"`, ctx);
    }
    const kind = HOPE_CALLS[payload.call.key] ? "hope" : "despair";
    if (alreadyArmed(actor, call)) return refuse(ACTION_ARM, `${actor.name} already holds that Call`, ctx);

    // Appended, not written over: Calls stack (CALL-02).
    await appendArmedCall(actor, armedEntry(payload.call, call, kind));
    debug(`Armed ${payload.call.key} on ${actor.name} on behalf of ${sender.name}.`);
    replyArmed(ctx, { ok: true, left: null });
    await tellBeneficiary(actor, kind, call.grants);
    return;
}

/** The armed entry as this side builds it: the table's `grants`, never the packet's extras. */
function armedEntry(asked, call, kind) {
    return {
        key: asked.key, kind, grants: call.grants,
        amount: null, from: asked.from ?? null,
        nonce: String(asked.nonce ?? foundry.utils.randomID()).slice(0, 32)
    };
}

/**
 * The beneficiary is not the buyer: tell them what they have been given, or they
 * will meet a locked roll dialog with no idea why it opened up.
 *
 * Said AFTER the buyer has had their answer, and never thrown: the Call is armed
 * and paid for by now, and a whisper that failed used to take the answer down
 * with it - the buyer waited out the clock and was told "not armed, not charged"
 * about a Call that was both (the E03 review).
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

function replyArmed(ctx, result) {
    if (!ctx?.asker || ctx.asker === game.user.id || !ctx.requestId) return;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_ARM_RESULT, requestId: ctx.requestId, userId: ctx.asker, result
    }, { recipients: [ctx.asker] });
}

/**
 * A player's Support on somebody else's character: checked, charged and armed on
 * this side, in that order, and refunded if the arming itself fails.
 */
async function armPaidByPlayer(actor, buyer, payload, ctx) {
    const call = HOPE_CALLS[payload.call.key];
    if (!buyer) return refuse(ACTION_ARM, "the paying character does not exist", ctx);
    if (buyer.id === actor.id) return refuse(ACTION_ARM, "a Call for somebody else, aimed at the buyer", ctx);

    // The same purchase asked twice - a GM who came back and was asked again
    // (`resendPendingRulings`) after arming it - is answered, not charged again.
    const { alreadyArmed, appendArmedCall, pendingCalls } = await import("./call-effects.mjs");
    const nonce = String(payload.call.nonce ?? "").slice(0, 32);
    if (nonce && pendingCalls(actor).some(entry => entry.nonce === nonce)) {
        replyArmed(ctx, { ok: true, left: null });
        return;
    }

    const { hopeCallRefusal, hopeHeld } = await import("./calls.mjs");
    const barred = await hopeCallRefusal(buyer);
    if (barred) return refuse(ACTION_ARM, `the buyer may not spend a Hope Call now (${barred})`, ctx);

    if (alreadyArmed(actor, call)) return refuse(ACTION_ARM, `${actor.name} already holds that Call`, ctx);

    const held = hopeHeld(buyer);
    if (held < call.cost) return refuse(ACTION_ARM, `the buyer holds ${held} Hope, the Call costs ${call.cost}`, ctx);

    const { automatedUpdate, HOPE_REFUND } = await import("./resource-guard.mjs");
    await automatedUpdate(buyer, { "system.resources.hope.value": held - call.cost });
    try {
        await appendArmedCall(actor, armedEntry(payload.call, call, "hope"));
    } catch (err) {
        error(`Could not arm ${payload.call.key} on ${actor.name}; the Hope goes back`, err);
        const now = hopeHeld(buyer);
        await automatedUpdate(buyer, { "system.resources.hope.value": now + call.cost }, { [HOPE_REFUND]: true });
        return refuse(ACTION_ARM, "the Call could not be armed", ctx);
    }
    debug(`Armed ${payload.call.key} on ${actor.name}, paid by ${buyer.name} on this side.`);
    replyArmed(ctx, { ok: true, left: held - call.cost });
    await tellBeneficiary(actor, "hope", call.grants);
    return;
}

async function handleDespair(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!sender) return refuse(ACTION_DESPAIR, "unknown sender", ctx);

    /*
     * A PLAYER'S POINT OF DESPAIR IS A REROLL'S, ON THEIR OWN MONOKUMA (E03,
     * 24.09.2026; audit S10-40, S02-42). This took ±1 for any pool from any
     * player, so a loop in the console emptied a Monokuma's pool before a
     * trial. The one honest sender is `settleDespair` in reroll.mjs, which moves
     * one point on the Monokuma assigned to the rerolling character, in the
     * direction the dice went. So: the sender's own character, that character's
     * Monokuma, a Reroll receipt for it, spent once, and the delta the rewritten
     * roll actually implies (`receiptDespairDelta`).
     */
    if (!sender.isGM) {
        const actor = game.actors.get(payload.actorId ?? "");
        if (!ownsActor(sender, actor?.id)) {
            return refuse(ACTION_DESPAIR, "sender does not own the rerolling character", ctx);
        }
        const { monokumaFor } = await import("./assignments.mjs");
        if (monokumaFor(actor)?.id !== payload.targetUserId) {
            return refuse(ACTION_DESPAIR, "that pool is not the rerolling character's Monokuma", ctx);
        }
        const { spendRerollReceipt, receiptDespairDelta } = await import("./reroll-receipts.mjs");
        const asked = Math.trunc(Number(payload.delta));
        const why = await spendRerollReceipt(actor.id, sender.id, "despair", receipt => {
            const owed = receiptDespairDelta(receipt);
            return owed === asked ? null : `the Reroll moved Despair by ${owed}, not ${payload.delta}`;
        });
        if (why) return refuse(ACTION_DESPAIR, why, ctx);
    }

    // The only legitimate player-side Despair adjustment is a reroll giving
    // one point back or taking one. Anything larger is not the rules asking.
    const delta = Math.trunc(Number(payload.delta));
    // A GM's own adjustment routed here (DESP-12) may be any size; a
    // player's is a reroll's single point.
    const cap = sender.isGM ? STARTING.despairMax : 1;
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > cap) {
        return refuse(ACTION_DESPAIR, `delta ${payload.delta} is out of range`, ctx);
    }
    // Any pool holder (DESP-13): an Assistant GM granted a pool is a
    // Monokuma too, and their reroll corrections were silently dropped.
    const target = game.users.get(payload.targetUserId ?? "");
    const { monokumas } = await import("./despair.mjs");
    if (!target || !monokumas().some(u => u.id === target.id)) {
        return refuse(ACTION_DESPAIR, "target holds no Despair pool", ctx);
    }

    const { adjustDespair } = await import("./despair.mjs");
    await adjustDespair(target.id, delta);
    debug(`Adjusted Despair for ${target.name} by ${delta} on behalf of ${sender.name}.`);
    return;
}

async function handleEclipseMove(payload, senderId, ctx) {
    const sender = senderOf(senderId);
    if (!ownsActor(sender, payload.actorId)) {
        return refuse(ACTION_ECLIPSE_MOVE, "sender does not own that character", ctx);
    }
    const { applyRecordedMove } = await import("./eclipse.mjs");
    await applyRecordedMove(payload.actorId);
    return;
}

/**
 * WHAT THE PRIMARY GM ANSWERS, one handler per request. Each handler gets
 * the packet, Foundry's own `senderId` (who really sent it - `payload.userId`
 * is a claim and is only ever used as an address) and the reply context.
 * Every handler that acts on `payload.actorId` first establishes
 * `senderOf(senderId)` and `ownsActor(sender, ...)`; R1b in tests.mjs reads
 * this table and holds each of them to it.
 */
const GM_HANDLERS = {
    [ACTION_OBSERVE_TARGET]: handleObserveTarget,
    [ACTION_CLEANUP_TRACES]: handleCleanupTraces,
    [ACTION_OBSERVE_RESOLVE]: handleObserveResolve,
    [ACTION_ANALYZE_RESOLVE]: handleAnalyzeResolve,
    [ACTION_ADVANCEMENT]: handleAdvancement,
    [ACTION_ADVANCEMENT_OFFER]: handleAdvancementOffer,
    [ACTION_ADVANCEMENT_ASK]: handleAdvancementAsk,
    [ACTION_SHARE_BULLET]: handleShareBulletOrGiveItem,
    [ACTION_GIVE_ITEM]: handleShareBulletOrGiveItem,
    [ACTION_PLANT]: handlePlant,
    [ACTION_FIND_STASH]: handleFindStash,
    [ACTION_STEAL]: handleSteal,
    [ACTION_VAULT_STEAL]: handleVaultSteal,
    [ACTION_OPENING_RESULT]: handleOpeningResult,
    [ACTION_CRISIS]: handleCrisis,
    [ACTION_PARK_MURDER]: handleParkMurder,
    [ACTION_BETRAYAL]: handleBetrayal,
    [ACTION_CLEANUP]: handleCleanup,
    [ACTION_MEDDLE]: handleMeddle,
    [ACTION_HOPE_CALL]: handleHopeCall,
    [ACTION_DIFFICULTY]: handleDifficulty,
    [ACTION_PROGRESS]: handleProgress,
    [ACTION_SHARE]: handleShare,
    [ACTION_REMNANT]: handleRemnant,
    [ACTION_TIE_TRACE]: handleTieTrace,
    [ACTION_REMNANT_EDIT]: handleRemnantEdit,
    [ACTION_SABOTAGE]: handleSabotage,
    [ACTION_UNSABOTAGE]: handleUnsabotage,
    [ACTION_SENDBACK]: handleSendback,
    [ACTION_LOOT]: handleLoot,
    [ACTION_ARM]: handleArm,
    [ACTION_DESPAIR]: handleDespair,
    [ACTION_ECLIPSE_MOVE]: handleEclipseMove,
};

async function onSocket(payload, senderId) {
    // The gate is per-action, not blanket. Keeping it up here meant every
    // handler that has to answer a *player* had to be registered as a separate
    // listener to escape it - a trap for the next one added.
    if (!payload?.action) return;
    // A packet in flight while this client is still loading or already
    // closing: `game.user` is null and every branch below reads it.
    if (!game.user) return;

    // Replies travelling back to a player. They carry a requestId and a userId,
    // so letting them fall through would have the primary GM acknowledge its own
    // answer as though it were a fresh request.
    if (payload.action === ACTION_ACK || payload.action === ACTION_DIFFICULTY_RESULT
        || payload.action === ACTION_HOPE_CALL_RESULT
        || payload.action === ACTION_SABOTAGE_RESULT
        || payload.action === ACTION_ARM_RESULT
        || payload.action === ACTION_OBSERVE_TARGET_RESULT
        || payload.action === ACTION_CLEANUP_TRACES_RESULT
        // Travels GM -> player and is handled by `onOpeningAsk` / `onOpeningCancel`.
        // Falling through would have the primary GM treat its own invitation as
        // a request.
        || payload.action === ACTION_OPENING_ASK
        || payload.action === ACTION_OPENING_CANCEL
        || payload.action === ACTION_REFUSED
        // GM -> owner, handled by `onAdvancementOffers` outside the primary gate.
        || payload.action === ACTION_ADVANCEMENT_OFFERS) return;
    if (!isPrimaryGm()) return;

    /*
     * WHO ASKED. `senderId` is Foundry's own argument and cannot be forged; the
     * `userId` inside the payload is a claim. Every guard below reads the first
     * and every reply is addressed to it.
     *
     * An earlier attempt did this by overwriting `payload.userId = senderId`
     * here, which broke every request in the module that waits for an answer.
     * Foundry hands the SAME payload object to every listener in turn, and this
     * one is registered first: on the asking player's own client it rewrote the
     * reply's address to the GM who sent it, a moment before
     * `onObserveTargetResult` and friends compared that address against
     * `game.user.id` and decided the answer was for somebody else. Observe hung
     * on a promise that could never resolve; so did a Dynamic ruling and a
     * sabotage. Nothing shared between listeners may be mutated.
     */
    const asker = senderId;
    // Who to tell when a guard below says no.
    const ctx = { asker, requestId: payload.requestId ?? null };

    // Tell the asker a GM is here and has the request, before doing the work -
    // the point of the acknowledgement is "somebody is listening", and a slow
    // handler must not look like a dead socket.
    if (payload.requestId && asker && asker !== game.user.id) {
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_ACK, requestId: payload.requestId, userId: asker
        }, { recipients: [asker] });
    }

    /*
     * `project.create` USED TO BE IN THIS TABLE, and it is gone rather than mended.
     *
     * Nothing sent it: a project is created by the GM, from the panel or from
     * an Approve button on a proposal card, and a player's proposal reaches
     * them as a card rather than as a write. So the branch was a GM-side
     * handler with no caller - and it still accepted a `project.create`
     * payload from any connected client, checked only that the sender was
     * somebody, and created the project. Including one flagged
     * `indirectMurder`. A door nobody used and anybody could open.
     */
    const handler = GM_HANDLERS[payload.action];
    if (!handler) return;
    if (PROJECT_ORDERED.has(payload.action)) return inProjectOrder(() => handler(payload, senderId, ctx));
    return handler(payload, senderId, ctx);
}

/*
 * ONE PROJECT WRITE AT A TIME, IN THE ORDER THEY ARRIVED (E03, 24.09.2026).
 * A Reroll of a Sabotage sends two packets back to back: take the old freeze
 * back, then freeze again at the new number. Both handlers await world writes,
 * so the second could read the project while the first had not yet thawed it,
 * find it "already frozen" and drop the new sabotage. Waiting for a Reroll
 * receipt (reroll-receipts.mjs) would have made that gap wider. Packets from
 * one sender arrive in order, so queueing them here keeps that order.
 */
const PROJECT_ORDERED = new Set([ACTION_PROGRESS, ACTION_SABOTAGE, ACTION_UNSABOTAGE]);
let projectQueue = Promise.resolve();

function inProjectOrder(work) {
    const next = projectQueue.catch(() => null).then(work);
    projectQueue = next;
    return next;
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
export async function requestBodyLoot({ takerId, bodyId, itemId }) {
    if (game.user.isGM) {
        const { lootBody } = await import("./handover.mjs");
        return lootBody({ takerId, bodyId, itemId });
    }
    if (!hasGm()) return null;
    emitToGms( {
        action: ACTION_LOOT, userId: game.user.id,
        requestId: expectAck(ACTION_LOOT), takerId, bodyId, itemId
    });
    return true;
}

/**
 * Arm a Call on somebody else's character.
 *
 * Support gives another player advantage. Flags live on the beneficiary's actor,
 * which the buyer has no write access to - hence "Player A lacks permission".
 * The GM owns everything, so they set it.
 */
export async function requestArmCall(actorId, call, timeoutMs = TIMING.rulingMs) {
    if (game.user.isGM) {
        const actor = game.actors.get(actorId);
        if (!actor) return null;
        const { appendArmedCall } = await import("./call-effects.mjs");
        await appendArmedCall(actor, call);
        return true;
    }
    if (!hasGm()) return null;

    /*
     * AWAITED NOW, LIKE A SABOTAGE (E03). The GM takes the Hope for a Support on
     * somebody else's character, and may refuse it - no Hope, a Silence, a GM
     * who sees the world differently - so "sent" is no longer "armed". This
     * resolves with the GM's `{ ok, left }`, or null when it was refused
     * (`onRefused` settles it at once) or nobody answered.
     */
    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, { action: ACTION_ARM, userId: game.user.id, requestId, actorId, call });
        // The two clocks of `requestSabotage` (COMM-17): the ack says it arrived,
        // the answer may take longer.
        const giveUp = () => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.format("DRPG.Bridge.noAnswer", { what: requestLabel(ACTION_ARM) }));
            resolve(null);
        };
        const ack = setTimeout(() => {
            if (!awaitingAck.has(requestId)) return;
            awaitingAck.delete(requestId);
            giveUp();
        }, ACK_TIMEOUT_MS);
        awaitingAck.set(requestId, ack);
        setTimeout(() => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.format("DRPG.Bridge.noAnswer", { what: requestLabel(ACTION_ARM) }));
            resolve(null);
        }, timeoutMs);
    });
}

/**
 * Despair pools are a world setting; a player's reroll asks the GM to fix one.
 *
 * `userId` is the sender, `targetUserId` the Monokuma being adjusted. They used
 * to be the same field, which is how the GM side had no way of telling who was
 * asking from whose pool was moving.
 */
export async function requestDespairAdjust(targetUserId, delta, { actorId = null } = {}) {
    if (game.user.isGM) {
        const { adjustDespair } = await import("./despair.mjs");
        return adjustDespair(targetUserId, delta);
    }
    if (!hasGm()) return null;
    // `actorId` is the rerolling character: the GM pays a player's point from
    // the receipt of that character's Reroll (E03).
    emitToGms( {
        action: ACTION_DESPAIR, userId: game.user.id,
        requestId: expectAck(ACTION_DESPAIR), targetUserId, delta, actorId
    });
    return { pending: true };
}

/**
 * An assistant GM's Despair change, sent to the primary to write (DESP-12).
 *
 * NOT `requestDespairAdjust`, whose first line hands any GM caller straight back
 * to `adjustDespair` - which, on an assistant, would route here again for ever.
 * 1.2.47 wired the receiving half (`handleDespair` admits a GM sender at any size)
 * and reached for the sending half through `hasGm`, which this file never
 * exported: the import came back undefined, the call threw, `adjustDespair`'s
 * catch wrote the pool locally, and the race DESP-12 exists to close - two GM
 * clients each writing the whole pools object from their own cache - stayed open.
 *
 * The caller has already checked that the primary is online and is somebody else.
 * The dispatcher runs handlers on the primary GM only, so there is one writer.
 */
export function sendDespairToPrimary(targetUserId, delta) {
    emitToGms({
        action: ACTION_DESPAIR, userId: game.user.id,
        requestId: expectAck(ACTION_DESPAIR), targetUserId, delta
    });
    return { pending: true };
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
 * repair object that did not exist yet either. This resolves once the GM's
 * client answers with what it actually wrote - the same pattern already used
 * for a Dynamic ruling - so the roll does not call itself done until it is.
 */
export function requestSabotage(targetId, difficulty, timeoutMs = TIMING.rulingMs) {
    if (!hasGm()) return Promise.resolve(null);

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, {
            action: ACTION_SABOTAGE, userId: game.user.id, requestId, targetId, difficulty
        });

        // Two clocks (COMM-17). The ack says the request ARRIVED, and eight
        // seconds without one means no GM is listening. The result - two world
        // writes and a repair project on the GM's client - may take longer than
        // that on a slow client, and this used to give up on the result at the
        // ack's deadline: the player was told nothing was applied, and then the
        // freeze landed anyway.
        const giveUp = () => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.format("DRPG.Bridge.noAnswer", { what: requestLabel(ACTION_SABOTAGE) }));
            resolve(null);
        };
        const ack = setTimeout(() => {
            if (!awaitingAck.has(requestId)) return;
            awaitingAck.delete(requestId);
            giveUp();
        }, ACK_TIMEOUT_MS);
        awaitingAck.set(requestId, ack);
        setTimeout(() => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.format("DRPG.Bridge.noAnswer", { what: requestLabel(ACTION_SABOTAGE) }));
            resolve(null);
        }, timeoutMs);
    });
}

/**
 * Taking a sabotage back writes the same two settings. This one stays
 * fire-and-forget: it is only ever called by Reroll, after the Call has
 * already been paid for and the new roll is about to replace the old effect,
 * so there is nothing left for the player to race against.
 */
export function requestUndoSabotage(targetId, repairId, actorId = null) {
    if (!hasGm()) return null;
    emitToGms( { action: ACTION_UNSABOTAGE, userId: game.user.id, requestId: expectAck(ACTION_UNSABOTAGE), targetId, repairId, actorId });
    return { pending: true };
}

/** A player whose token cannot be moved back asks the GM to do it. */
export function requestSendBack(sceneId, tokenId, position) {
    if (!hasGm()) return null;
    emitToGms( { action: ACTION_SENDBACK, userId: game.user.id, requestId: expectAck(ACTION_SENDBACK), sceneId, tokenId, position });
    return { pending: true };
}

/** Count an Eclipse crossing on the GM's copy of the world setting. */
export function requestEclipseMove(actorId) {
    if (!hasGm()) return null;
    emitToGms( { action: ACTION_ECLIPSE_MOVE, userId: game.user.id, requestId: expectAck(ACTION_ECLIPSE_MOVE), actorId });
    return { pending: true };
}

/**
 * The trace that handed over this object is evidence now.
 *
 * Asked by the killer's own client at the moment they swing, answered on the
 * GM's, because the answer key is theirs. Nothing comes back: a trace that
 * cannot be re-labelled must not stop a murder that is already happening, and
 * the GM can tick the box by hand in the case dashboard.
 */
export function requestTieTrace(identity) {
    if (!identity) return null;
    if (game.user.isGM) {
        return import("./remnants.mjs").then(m => m.tieTraceForItem(identity));
    }
    if (!hasGm()) return null;
    emitToGms(
        { action: ACTION_TIE_TRACE, userId: game.user.id, identity });
    return { pending: true };
}

/** Creating tokens is GM-only, so a player's Remnant is placed for them. */
export function requestRemnant(data) {
    if (!hasGm()) return null;
    emitToGms( { action: ACTION_REMNANT, userId: game.user.id, requestId: expectAck(ACTION_REMNANT), data });
    return { pending: true };
}

/**
 * Retune or remove a Remnant a player's own action left behind - a reroll has
 * changed how well they hid it, or removed the reason for the trace entirely.
 * Editing tokens is GM-only, same as creating them.
 */
export function requestRemnantEdit(sceneId, tokenId, patch) {
    if (!hasGm()) return null;
    emitToGms( { action: ACTION_REMNANT_EDIT, userId: game.user.id, requestId: expectAck(ACTION_REMNANT_EDIT), sceneId, tokenId, patch });
    return { pending: true };
}

/** Is a GM connected right now? The question alone, no toast (audit A16). */
export function gmOnline() {
    return game.users.some(u => u.isGM && u.active);
}

/**
 * The refusal: `gmOnline()` plus the toast that says why nothing happened.
 * Every request in this file goes through it, and a request with no GM to
 * answer it IS a refusal, which is what a toast is for (E1). Anything that
 * only wants to know - a tile deciding whether to dim - asks `gmOnline()`.
 */
function hasGm() {
    if (gmOnline()) return true;
    ui.notifications.warn(game.i18n.localize("DRPG.Bridge.noGm"));
    return false;
}

/**
 * Ask a GM how hard a described action is.
 *
 * The guide gives the threshold to the GM: "the player describes something, the
 * GM picks a threshold". The picker used to render on the player's own client,
 * so the person being tested chose their own difficulty - and would always
 * choose the easiest band. The dialog now opens on the GM's screen and the
 * answer comes back over the socket.
 *
 * Generous timeout on purpose: a GM reading a description and making a ruling is
 * a human taking their time, not a machine failing to answer.
 *
 * @returns {Promise<{tier: number, trait: string}|null>} null if refused or unanswered.
 */
/**
 * "May I spend this, and here is what for." Waits for a human (Dawid, 29.08).
 *
 * The same shape as `requestDynamicDifficulty` below, and for the same reason:
 * a question only a person can answer, so the timeout is generous and a silence
 * is a refusal rather than an error. Nothing is charged on this side - see
 * `spendHopeCall`, which pays only against a yes.
 *
 * @returns {Promise<boolean|null>} true to allow, false to refuse, null if
 *   nobody answered.
 */
/*
 * A RULING THAT NEEDS A HUMAN IS A CARD, LIKE EVERY OTHER RULING (COMM-04).
 *
 * A Hope Call that needs the GM (Experience, Ultimate) and a Dynamic action
 * used to open a DialogV2 on the primary GM's client and nowhere else: no
 * card, no popup, no sound, and a second GM never learned the question
 * existed. If that dialog sat behind a sheet the player waited out the whole
 * timeout looking at nothing. Now both are `callGm` cards in the player's
 * thread with the answers on them - any GM may press either - and the answer
 * travels back over the same result packet the dialog used to send.
 *
 * `askedByCard` is the dedupe: a player's client re-sends an unanswered
 * request when a GM's world finishes loading, and the card is already up.
 */
const askedByCard = new Set();

async function askHopeCallByCard(payload, asker) {
    if (!payload?.requestId || askedByCard.has(payload.requestId)) return;
    askedByCard.add(payload.requestId);
    const actor = game.actors.get(payload.actorId ?? "");
    const data = { rid: payload.requestId, asker, by: payload.actorId ?? "" };
    /*
     * THE PRICE FROM THIS SIDE'S TABLE, NOT THE PACKET'S (E02, 24.09.2026; audit
     * S10-02). `cost` was the one field on this card printed raw - into
     * `game.i18n.format`, then into the card's HTML - so a packet carrying
     * `<img src=x onerror=...>` as its cost ran script on every GM's screen. The
     * GM holds the same `HOPE_CALLS`, so the number never had to travel; a key
     * this side does not know prints as "?". Every other field is escaped.
     */
    const call = HOPE_CALLS[payload.key] ?? null;
    await callGm(actor, {
        title: game.i18n.format("DRPG.Calls.approveTitle", { call: call?.label ?? payload.callLabel ?? "" }),
        request: payload.note ?? "",
        body: `<p>${esc(payload.effect ?? "")}</p><p class="notes">${
            game.i18n.format("DRPG.Calls.approveCost", { cost: Number.isFinite(call?.cost) ? call.cost : "?" })}</p>`,
        gmBody: game.i18n.localize("DRPG.Calls.approveHint"),
        actions: [
            { action: "approveCall", label: game.i18n.localize("DRPG.Calls.approveYes"), data },
            { action: "refuseCall", label: game.i18n.localize("DRPG.Calls.approveNo"), data }
        ]
    });
}

async function askDynamicByCard(payload, asker) {
    if (!payload?.requestId || askedByCard.has(payload.requestId)) return;
    askedByCard.add(payload.requestId);
    const actor = game.actors.get(payload.actorId ?? "");
    const data = {
        rid: payload.requestId, asker, by: payload.actorId ?? "",
        room: payload.room ?? "", desc: payload.description ?? "", name: payload.actorName ?? ""
    };
    await callGm(actor, {
        title: game.i18n.localize("DRPG.Action.dynamicTitle"),
        request: payload.description ?? "",
        room: payload.room ?? null,
        actions: [
            { action: "setDifficulty", label: game.i18n.localize("DRPG.Action.dynamicSet"), data },
            { action: "refuseDynamic", label: game.i18n.localize("DRPG.Action.dynamicRefuse"), data }
        ]
    });
}

/** A GM's answer to a Hope Call card, sent to the player who asked. */
export function answerHopeCall(requestId, asker, verdict) {
    if (!game.user.isGM || !requestId || !asker) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_HOPE_CALL_RESULT, requestId, userId: asker, verdict: Boolean(verdict)
    }, { recipients: [asker] });
    return true;
}

/** A GM's answer to a Dynamic action card: `{ tier, trait }`, or `false` to refuse. */
export function answerDynamic(requestId, asker, ruling) {
    if (!game.user.isGM || !requestId || !asker) return false;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_DIFFICULTY_RESULT, requestId, userId: asker, ruling: ruling ?? false
    }, { recipients: [asker] });
    return true;
}

export function requestHopeCallApproval(
    { actorId, actorName, key, callLabel, effect, cost, note }, timeoutMs = TIMING.hopeCallRulingMs) {
    if (!hasGm()) return Promise.resolve(null);

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, {
            action: ACTION_HOPE_CALL,
            requestId,
            userId: game.user.id,
            actorId, actorName, key, callLabel, effect, cost, note
        });

        setTimeout(() => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            // No toast here: `spendHopeCall` reports a null with the Call's name.
            resolve(null);
        }, timeoutMs);
    });
}

export function requestDynamicDifficulty({ description, actorName, room, actorId = null }, timeoutMs = TIMING.rulingMs) {
    if (!hasGm()) return Promise.resolve(null);

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, {
            action: ACTION_DIFFICULTY,
            requestId,
            userId: game.user.id,
            description, actorName, room, actorId
        });

        setTimeout(() => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.localize("DRPG.Action.dynamicNoRuling"));
            resolve(null);
        }, timeoutMs);
    });
}

/**
 * Ask a GM which Remnant this Observe is aimed at, before the dice are thrown.
 *
 * A GM runs this locally instead of talking to themselves - the same shape as
 * `requestProjectCreate`. Everyone else waits on the socket.
 *
 * The reply says only whether there is something to look at. The Remnant, its
 * kind and its difficulty stay on the GM's client: the observer is told what
 * they found, never what they were up against.
 *
 * Timeout matches the Dynamic ruling, since a "specific" declaration opens a
 * picker a human has to read.
 *
 * @returns {Promise<{ok: boolean, key?: string, reason?: string}|null>}
 */
export function requestObserveTarget({ actorId, declaration, request = "" }, timeoutMs = TIMING.rulingMs) {
    if (game.user.isGM) {
        return import("./observe.mjs")
            .then(m => m.chooseObserveTarget({ actorId, declaration, request }));
    }
    if (!hasGm()) return Promise.resolve(null);

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, {
            action: ACTION_OBSERVE_TARGET,
            requestId,
            userId: game.user.id,
            actorId, declaration, request
        });

        setTimeout(() => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.localize("DRPG.Observe.noRuling"));
            resolve(null);
        }, timeoutMs);
    });
}

/**
 * Ask a GM which of a killer's traces they may act on, before Stage 6's picker
 * opens.
 *
 * A GM runs this locally instead of talking to themselves - the same shape as
 * `requestObserveTarget`. Everyone else waits on the socket.
 *
 * @returns {Promise<Array<{id: string, label: string, reinforced: boolean}>>}
 *   Never DC, never `tiedToCrime` - see `cleanableTracesForPlayer` in
 *   cleanup.mjs, which is the only thing that ever builds this array.
 */
export function requestCleanableTraces(actorId, { mine = false } = {}, timeoutMs = TIMING.rulingMs) {
    if (game.user.isGM) {
        return import("./cleanup.mjs").then(m => m.cleanableTracesForPlayer(actorId, { mine }));
    }
    if (!hasGm()) return Promise.resolve([]);

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, {
            action: ACTION_CLEANUP_TRACES,
            requestId,
            userId: game.user.id,
            // `mine` narrows the answer to what this character knows is there.
            // `false` asks for the whole room, which is Stage 6's - and the GM's
            // side decides whether this character is in Stage 6, not this
            // flag (E03; audit S05-04). See `cleanableTracesForPlayer`.
            actorId, mine
        });

        setTimeout(() => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.localize("DRPG.Cleanup.noRuling"));
            resolve([]);
        }, timeoutMs);
    });
}

/**
 * Hand a thrown Observe to the GM to be scored.
 *
 * Fire-and-forget by design: the answer is the whisper the player gets when the
 * GM's client has finished - a Truth Bullet on their sheet or 2 Sanity - so
 * there is nothing for a second reply to add.
 */
export function requestObserveResolve({ actorId, key, total, isCritical, undo = false }) {
    if (game.user.isGM) {
        return import("./observe.mjs")
            .then(m => m.resolveObserve({ key, total, isCritical, undo, actorId }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_OBSERVE_RESOLVE,
        userId: game.user.id,
        requestId: expectAck(ACTION_OBSERVE_RESOLVE),
        actorId, key, total, isCritical, undo
    });
    return { pending: true };
}

/**
 * Hand a thrown Analyze to the GM to be scored.
 *
 * Fire-and-forget like its Observe counterpart: the answer is the whisper the
 * player gets once the GM's client has converted the bullet or locked it.
 */
export function requestAnalyzeResolve({ actorId, itemId, total, isCritical, undo = false }) {
    if (game.user.isGM) {
        return import("./analyze.mjs")
            .then(m => m.resolveAnalyze({ actorId, itemId, total, isCritical, undo }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_ANALYZE_RESOLVE,
        userId: game.user.id,
        requestId: expectAck(ACTION_ANALYZE_RESOLVE),
        actorId, itemId, total, isCritical, undo
    });
    return { pending: true };
}

/**
 * A player's Level Up picks, sent to the GM who offered it (N-2, Dawid 20.09).
 *
 * `applyAdvancement` writes through `automatedUpdate`, which bypasses the resource
 * guard on purpose - so it is GM-only, and it has to stay that way. The player
 * picks; the GM's client checks the offer again and writes.
 */
export function requestAdvancement({ actorId, picks, kind }) {
    if (game.user.isGM) {
        return import("./level-up.mjs").then(m => {
            const actor = game.actors.get(actorId);
            return actor ? m.applyAdvancement(actor, picks, kind) : null;
        });
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_ADVANCEMENT,
        userId: game.user.id,
        requestId: expectAck(ACTION_ADVANCEMENT),
        actorId, picks, kind
    });
    return { pending: true };
}

/**
 * Copy one of my Truth Bullets onto somebody else's sheet.
 *
 * Writing to another player's actor is GM-only, and the answer key entry that
 * travels with the copy can only be written on a GM's client anyway.
 */
export function requestShareBullet({ fromId, toId, itemId }) {
    if (game.user.isGM) {
        return import("./handover.mjs").then(m => m.shareBullet({ fromId, toId, itemId }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_SHARE_BULLET,
        userId: game.user.id,
        requestId: expectAck(ACTION_SHARE_BULLET),
        fromId, toId, itemId
    });
    return { pending: true };
}

/** Move one of my items onto somebody else's sheet, and off mine. */
export function requestGiveItem({ fromId, toId, itemId }) {
    if (game.user.isGM) {
        return import("./handover.mjs").then(m => m.giveItem({ fromId, toId, itemId }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_GIVE_ITEM,
        userId: game.user.id,
        requestId: expectAck(ACTION_GIVE_ITEM),
        fromId, toId, itemId
    });
    return { pending: true };
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
    swungId = null
}) {
    if (game.user.isGM) {
        return import("./murder.mjs")
            .then(m => m.resolveCrisisAction({
                actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free, swungId
            }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_CRISIS,
        userId: game.user.id,
        requestId: expectAck(ACTION_CRISIS),
        actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free, swungId
    });
    return { pending: true };
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
    price = null, grant = false
}) {
    // The two that aim at a TRACE go to `resolveCleanup`; the two that roll
    // against a flat threshold go to `resolveStageSix`. Naming the first pair
    // rather than excluding the second means a fifth action added later lands
    // in the branch that reads its own threshold, which is the safe default.
    const aimed = key === "eraseTrace" || key === "transformTrace";
    const mode = key === "transformTrace" ? "transform" : "erase";
    if (game.user.isGM) {
        return import("./cleanup.mjs").then(m => aimed
            ? m.resolveCleanup({
                actorId, tokenId, total, isCritical, withHope, undo, transform,
                mode, change, viaAction, price, grant
            })
            : m.resolveStageSix({
                actorId, key, targetId, total, isCritical, withHope, viaAction,
                price, grant
            }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_CLEANUP,
        userId: game.user.id,
        requestId: expectAck(ACTION_CLEANUP),
        actorId, tokenId, total, isCritical, withHope, undo, key, targetId, transform,
        change, viaAction, price, grant
    });
    return { pending: true };
}

/**
 * Ask a GM to open the betrayal: the newcomer kills the killer they helped.
 *
 * No dice and no numbers travel - this is a declaration, and the GM's own
 * confirmation is what turns it into a second incident.
 */
/** Record a direct murder declared during an Eclipse. See eclipse.mjs. */
export function requestParkMurder({ killerId, room = null, note = "" }) {
    if (game.user.isGM) {
        return import("./eclipse.mjs").then(m => m.writeParkedMurder({ killerId, room, note }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_PARK_MURDER,
        userId: game.user.id,
        requestId: expectAck(ACTION_PARK_MURDER),
        killerId, room, note
    });
    return { pending: true };
}

export function requestBetrayal({ actorId }) {
    if (game.user.isGM) {
        return import("./murder.mjs").then(m => m.betrayAsPlayer(actorId));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_BETRAYAL,
        userId: game.user.id,
        requestId: expectAck(ACTION_BETRAYAL),
        actorId
    });
    return { pending: true };
}

/** Hand a thrown Meddle to the GM to be scored and applied to the target. */
export function requestMeddleResolve({ actorId, targetId, help, total, isCritical }) {
    if (game.user.isGM) {
        return import("./monocub.mjs")
            .then(m => m.resolveMeddle({ actorId, targetId, help, total, isCritical }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_MEDDLE,
        userId: game.user.id,
        requestId: expectAck(ACTION_MEDDLE),
        actorId, targetId, help, total, isCritical
    });
    return { pending: true };
}

/**
 * Pull one item out of somebody else's stash. GM-only on both ends.
 *
 * `viaSearch` marks the route that has already paid for a concealed stash with
 * an action, a search token and a penalised roll - see `stealFromVault`.
 */
export function requestVaultSteal({ thiefId, ownerId, itemId, viaSearch = false, clumsy = false }) {
    if (game.user.isGM) {
        return import("./vault.mjs")
            .then(m => m.stealFromVault({ thiefId, ownerId, itemId, viaSearch, clumsy }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_VAULT_STEAL,
        userId: game.user.id,
        requestId: expectAck(ACTION_VAULT_STEAL),
        thiefId, ownerId, itemId, viaSearch, clumsy
    });
    return { pending: true };
}

/**
 * Go through somebody's pockets. GM-only on both ends, like its sibling above.
 *
 * The two totals travel and the verdicts are made on the other side - see
 * `stealFromPerson`. `itemId` is a request rather than an instruction: it is
 * honoured only on a critical, and only if it is really in the victim's pockets.
 */
export function requestSteal({
    thiefId, victimId, itemId = null,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
}) {
    if (game.user.isGM) {
        return import("./vault.mjs").then(m => m.stealFromPerson({
            thiefId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
        }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_STEAL,
        userId: game.user.id,
        requestId: expectAck(ACTION_STEAL),
        thiefId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
    });
    return { pending: true };
}

/**
 * Leave something in somebody's pocket. The mirror of `requestSteal`, and the
 * same division of labour: the two totals travel, both verdicts are made on the
 * other side against `ACTIONS.palm`.
 *
 * `itemId` is not a request here but a statement - it came out of the planter's
 * own pockets and there is nothing secret about it. The GM side still checks it
 * is really there, for the same reason it checks everything else.
 */
export function requestPlant({
    plannerId, victimId, itemId,
    total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false
}) {
    if (game.user.isGM) {
        return import("./vault.mjs").then(m => m.plantOnPerson({
            plannerId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
        }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_PLANT,
        userId: game.user.id,
        requestId: expectAck(ACTION_PLANT),
        plannerId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
    });
    return { pending: true };
}

/**
 * Hand a Locate-a-hidden-stash roll to the GM to be scored.
 *
 * Fire-and-forget, like Observe: the answer is the whisper the finder gets, and
 * the write it may cause is a flag on their own sheet. The number travels; the
 * threshold, the room and which stash it opens are all decided on the far side
 * - see `resolveStashSearch`.
 */
export function requestStashSearch({ actorId, total = 0, isCritical = false }) {
    if (game.user.isGM) {
        return import("./vault.mjs").then(m => m.resolveStashSearch({ actorId, total, isCritical }));
    }
    if (!hasGm()) return null;

    emitToGms( {
        action: ACTION_FIND_STASH,
        userId: game.user.id,
        requestId: expectAck(ACTION_FIND_STASH),
        actorId, total, isCritical
    });
    return { pending: true };
}

/** Ask the GM to add project progress on our behalf. */
export function requestProjectProgress(countdownId, amount, actorId = null) {
    if (!hasGm()) return null;
    emitToGms( {
        action: ACTION_PROGRESS, countdownId, amount, actorId,
        userId: game.user.id, requestId: expectAck(ACTION_PROGRESS)
    });
    // `changed` is unknown from here - the GM whispers back what actually
    // happened. Claiming success would be a guess.
    return { pending: true, changed: null };
}

/**
 * Ask the GM to let another player in on a secret project. Players are allowed
 * to bring someone in on their own plan - the guide's whole social engine runs
 * on conspiracies - but the write itself has to happen GM-side.
 */
export function requestProjectShare(countdownId, userId) {
    if (!hasGm()) return null;
    emitToGms( { action: ACTION_SHARE, userId: game.user.id, requestId: expectAck(ACTION_SHARE), countdownId, targetUserId: userId });
    return { pending: true };
}

/* ==========================================================================
 * CALLING THE GM
 * ========================================================================== */

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
     * player's client, the same way the buttons are (COMM-06).
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
     * Safe to render for everybody: the GM-only buttons are stripped from a
     * player's copy (`wireCallActions`), and every action behind them is
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
    gmOnly = false
} = {}) {
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
    if (body) parts.push(`<p>${body}</p>`);
    if (gmBody) parts.push(`<div class="drpg-gm-only">${gmBody}</div>`);
    // Classed so `settleCall` can take it off again once the card is answered.
    parts.push(`<p class="drpg-call-awaiting"><em>${
        game.i18n.localize("DRPG.Bridge.awaitingRuling")}</em></p>`);

    if (actions.length) {
        parts.push(`<div class="drpg-call-actions">${actions.map(a => {
            const attrs = Object.entries(a.data ?? {})
                .map(([k, v]) => ` data-${esc(k)}="${esc(v)}"`).join("");
            return `<button type="button" class="drpg-call-action" data-drpg-call="${
                esc(a.action)}"${attrs}>${esc(a.label)}</button>`;
        }).join("")}</div>`);
    }

    const content = parts.join("");

    const owner = gmOnly ? null : ownerOf(actor);
    if (!owner) {
        /*
         * NO THREAD TO LIVE IN, so the chat log - and the log has to behave
         * like a thread for it (COMM-02). Before this a trap alert landed as a
         * silent sidebar line: no popup (a GM's whispers never raise one
         * unless the poster insists), no sound, and two buttons nothing wired,
         * because the only wiring lived in the messenger's bubbles. `callCard`
         * is what the render hook in `registerGmBridge` keys on.
         */
        try {
            await whisperToGms(content, {
                flags: { [MODULE_ID]: {
                    callCard: true, gmPopup: true, popupTitle: title,
                    sfx: { key: "gmAsk", gm: true }
                } }
            });
            return true;
        } catch (err) {
            error("Could not reach the GM", err);
            return false;
        }
    }

    try {
        const { postToThread } = await import("./messenger.mjs");
        // Every callGm card is, by definition, a call ON the GM - the flag is
        // what tells the messenger's notifier to interrupt them for it. See
        // MESSENGER_FLAGS.gmAsk for why this cannot be derived from the author.
        return Boolean(await postToThread(owner.id, content, { gmAsk: true }));
    } catch (err) {
        error("Could not reach the GM", err);
        return false;
    }
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
 * @param {string} text          What settled it, in plain words.
 */
export async function settleCall(message, text) {
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

    const note = document.createElement("p");
    note.className = "drpg-call-settled";
    note.textContent = text;
    wrap.content.append(note);

    try {
        const { MESSENGER_FLAGS } = await import("./messenger.mjs");
        const flags = { [MODULE_ID]: { [MESSENGER_FLAGS.settled]: true } };
        if (message.getFlag(MODULE_ID, "secret")) {
            // The words live off the document (secret.mjs). Writing them into
            // `content` here would hand every client the private text in
            // clear; the receipt travels the road the question did.
            const { updateSecret } = await import("./secret.mjs");
            await updateSecret(message, wrap.innerHTML);
            return await message.update({ flags });
        }
        return await message.update({ content: wrap.innerHTML, flags });
    } catch (err) {
        error("Could not close out the ruling card", err);
        return null;
    }
}

/**
 * Ask the player what they want, then send it to the GM. Returns the text, or
 * null if they backed out.
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
    actions = []
}) {
    const DialogV2 = foundry.applications.api.DialogV2;

    const text = await DialogV2.wait({
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
                callback: (event, button, dialog) => dialog.element.querySelector("[name=request]").value.trim()
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (text === "cancel" || text === null || text === undefined) return null;

    /*
     * NULL MEANS NOTHING WAS SENT, AND IT HAS TO MEAN IT IN BOTH CASES (ACT-15,
     * 20.09).
     *
     * This returned the text whatever `callGm` answered, so every caller had two
     * roads to "the request never went" and could only see one of them: the player
     * closed the second window, or there was no GM connected to take it. Both left
     * the caller going on to whisper "your proposal has been sent". `callGm` already
     * answers false without throwing for the second - one caller in action-rolls.mjs
     * checks it by hand, which is what made this worth fixing here rather than at
     * three call sites.
     */
    const sent = await callGm(actor, { title, roll, request: text, room, body, actions });
    return sent === false ? null : text;
}
