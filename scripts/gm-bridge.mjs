/**
 * Danganronpa RPG — calling the GM, and asking them to write.
 * ---------------------------------------------------------------------------
 * Two jobs:
 *
 *   callGm()  — the guide's actions that need a human ruling (Think, Listen,
 *               Analyze, Direct Murder, starting a project). The player's roll
 *               and request are whispered to the GMs with the context they need
 *               to answer, so nobody has to shout across the table.
 *
 *   request*() — world settings can only be written by a GM client, so a
 *               player's project progress is forwarded over the socket.
 */

import {
    MODULE_ID, TRAITS, HOPE_CALLS, DESPAIR_CALLS, STARTING, PROJECT_SCALE
} from "./config.mjs";
import { announce, whisperToGms, whisperToOwner, ownerOf, isPrimaryGm, dialogContent, debug, warn, error, cardHead } from "./utils.mjs";

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
const ACTION_DESPAIR = "despair.adjust";
const ACTION_DIFFICULTY = "dynamic.difficulty";
const ACTION_DIFFICULTY_RESULT = "dynamic.difficultyResult";
const ACTION_OBSERVE_TARGET = "observe.target";
const ACTION_OBSERVE_TARGET_RESULT = "observe.targetResult";
const ACTION_OBSERVE_RESOLVE = "observe.resolve";
const ACTION_CLEANUP_TRACES = "cleanup.traces";
const ACTION_CLEANUP_TRACES_RESULT = "cleanup.tracesResult";
const ACTION_ANALYZE_RESOLVE = "analyze.resolve";
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
/** A GM's world has finished loading — see `registerGmBridge`. */
const ACTION_GM_READY = "bridge.gmReady";
const ACTION_LOOT = "body.loot";

/**
 * Player-side promises waiting on a GM ruling, keyed by request id.
 *
 * Each entry is `{ resolve, payload, resent }` rather than a bare `resolve`,
 * so a request that went unanswered can be ASKED AGAIN — see
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
        game.socket.emit(SOCKET_EVENT, entry.payload);
        debug(`Re-sent a ruling request after a GM reconnected: ${entry.payload.action}`);
    }
}

/** A GM has finished loading and can answer questions again. */
function onGmReady(payload, senderId) {
    if (payload?.action !== ACTION_GM_READY) return;
    if (!game.users.get(senderId)?.isGM) return;
    resendPendingRulings();
}

/** Remember a request, and how to ask it again. */
function awaitRuling(requestId, resolve, payload) {
    pendingRulings.set(requestId, { resolve, payload, resent: false });
    game.socket.emit(SOCKET_EVENT, payload);
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
       before their world has finished loading and this very function has run —
       measured on a live reload: the re-sent question left before the GM had a
       listener for it and vanished. So the GM announces themselves once, HERE,
       at the point where they can actually answer, and anybody still waiting
       asks again. */
    if (game.user.isGM) game.socket.emit(SOCKET_EVENT, { action: ACTION_GM_READY });
    else game.socket.on(SOCKET_EVENT, onGmReady);
    game.socket.on(SOCKET_EVENT, onSocket);
    // The answer travels back to the asking player, who is not a GM — so this
    // listener has to sit outside the `isPrimaryGm` gate in `onSocket`.
    game.socket.on(SOCKET_EVENT, onRulingResult);
    // Same reason as above: the acknowledgement travels back to a player.
    game.socket.on(SOCKET_EVENT, onAck);
    // Same reason again: the real sabotage result travels back to a player.
    game.socket.on(SOCKET_EVENT, onSabotageResult);
    // And again: the chosen Observe target travels back to the observer.
    game.socket.on(SOCKET_EVENT, onObserveTargetResult);
    // And again: a killer's own cleanable-trace list travels back to them.
    game.socket.on(SOCKET_EVENT, onCleanupTracesResult);
    // The one request that travels the other way — GM to player — so it cannot
    // sit behind the `isPrimaryGm` gate in `onSocket` either.
    game.socket.on(SOCKET_EVENT, onOpeningAsk);
    // And its withdrawal, which travels the same way for the same reason.
    game.socket.on(SOCKET_EVENT, onOpeningCancel);
}

/**
 * Stage 4, thrown by the person it is about.
 *
 * The opening rolls used to be thrown on the GM's client, which meant the two
 * dice that decide whether a murder happens at all were rolled by somebody who
 * is not the killer and not the victim — and the roll window, the Hope it grants
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

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OPENING_RESULT,
        userId: game.user.id,
        requestId: expectAck("Opening roll"),
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
 * never told — a sabotage, a project, a Remnant simply never happened.
 *
 * So every request now carries an id, and the receiving GM says "got it". No
 * answer inside the window means nobody is listening, and the player finds out
 * rather than waiting for something that is not coming.
 * ========================================================================== */

const awaitingAck = new Map();
const ACK_TIMEOUT_MS = 8000;

/** Watch for a "got it" and complain if none arrives. Returns the request id. */
function expectAck(label) {
    const requestId = foundry.utils.randomID();
    const timer = setTimeout(() => {
        if (!awaitingAck.has(requestId)) return;
        awaitingAck.delete(requestId);
        ui.notifications.warn(game.i18n.format("DRPG.Bridge.noAnswer", { what: label }));
        warn(`No GM acknowledged "${label}" within ${ACK_TIMEOUT_MS}ms.`);
    }, ACK_TIMEOUT_MS);
    awaitingAck.set(requestId, timer);
    return requestId;
}

/**
 * Is this reply addressed to me, and did a GM actually send it?
 *
 * The four listeners below all run on a PLAYER's client, waiting for an answer.
 * They used to check only the address. A reply is an authority — "the GM ruled
 * 15", "the GM picked this Remnant", "the freeze took" — so a player able to
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

    settleRuling(payload.requestId, payload.ruling ?? null);
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
 * it — not just acknowledged the request. `sabotageProject` used to return
 * `{pending: true}` to a player immediately after the socket emit and call that
 * good enough: the roll reported the target frozen and a repair project created
 * before either had actually happened. A player who then tried Work on Project
 * on the same target — which is exactly the "did the freeze take" question a
 * bug report would test first — could land inside that window and find it not
 * frozen yet. Waiting for this reply closes it: the action does not tell the
 * player "frozen now" until it is.
 */
function onSabotageResult(payload, senderId) {
    if (payload?.action !== ACTION_SABOTAGE_RESULT) return;
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
 * This used to read `payload.userId` — a field the sender writes about itself.
 * Every guard in this file is built on the answer (`ownsActor` below decides
 * whether a request may touch a given character), so trusting the claim meant a
 * player could put any other user's id in the field and act as them: take a
 * crisis action with somebody else's character, spend their project progress,
 * empty their stash. The real id is Foundry's own second argument to a socket
 * handler and cannot be set by the sender — see `handleCustomSocket` in the
 * server's `sockets.mjs`, which stamps `this.user.id` on every delivery.
 */
function senderOf(senderId) {
    const user = game.users.get(senderId ?? "");
    return user?.active ? user : null;
}

function ownsActor(user, actorId) {
    if (!user || !actorId) return false;
    if (user.isGM) return true;
    return Boolean(game.actors.get(actorId)?.testUserPermission(user, "OWNER"));
}

/** Refuse loudly in the log rather than silently doing the wrong thing. */
function refuse(action, why) {
    warn(`Refused a "${action}" request over the socket: ${why}.`);
    return null;
}

async function onSocket(payload, senderId) {
    // The gate is per-action, not blanket. Keeping it up here meant every
    // handler that has to answer a *player* had to be registered as a separate
    // listener to escape it — a trap for the next one added.
    if (!payload?.action) return;

    // Replies travelling back to a player. They carry a requestId and a userId,
    // so letting them fall through would have the primary GM acknowledge its own
    // answer as though it were a fresh request.
    if (payload.action === ACTION_ACK || payload.action === ACTION_DIFFICULTY_RESULT
        || payload.action === ACTION_SABOTAGE_RESULT
        || payload.action === ACTION_OBSERVE_TARGET_RESULT
        || payload.action === ACTION_CLEANUP_TRACES_RESULT
        // Travels GM -> player and is handled by `onOpeningAsk` / `onOpeningCancel`.
        // Falling through would have the primary GM treat its own invitation as
        // a request.
        || payload.action === ACTION_OPENING_ASK
        || payload.action === ACTION_OPENING_CANCEL) return;
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

    // Tell the asker a GM is here and has the request, before doing the work —
    // the point of the acknowledgement is "somebody is listening", and a slow
    // handler must not look like a dead socket.
    if (payload.requestId && asker && asker !== game.user.id) {
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_ACK, requestId: payload.requestId, userId: asker
        }, { recipients: [asker] });
    }

    // Observe is scored on this side, because everything it is scored against —
    // which Remnants are in the room, what they are, what the difficulty is —
    // is exactly what the observer must not know. See observe.mjs.
    if (payload?.action === ACTION_OBSERVE_TARGET) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_OBSERVE_TARGET, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_OBSERVE_TARGET, "sender does not own that character");
        }

        const { chooseObserveTarget } = await import("./observe.mjs");
        const result = await chooseObserveTarget({
            actorId: payload.actorId,
            declaration: payload.declaration,
            request: payload.request
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
    // computed here for the same reason Observe is: the ledger — the answer
    // key `cleanableRemnants` reads to build the list — lives only on a GM
    // client, and `cleanableTracesForPlayer` (cleanup.mjs) is what strips it
    // back down to id, label and the reinforced flag before it goes out.
    if (payload?.action === ACTION_CLEANUP_TRACES) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_CLEANUP_TRACES, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_CLEANUP_TRACES, "sender does not own that character");
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

    if (payload?.action === ACTION_OBSERVE_RESOLVE) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_OBSERVE_RESOLVE, "unknown sender");
        // The key alone decides which character is affected — it was minted on
        // this client in phase 1 — but the sender still has to be the person who
        // asked for it, or one player could resolve another's Observe.
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_OBSERVE_RESOLVE, "sender does not own that character");
        }

        const { resolveObserve } = await import("./observe.mjs");
        await resolveObserve({
            key: payload.key,
            total: Number(payload.total) || 0,
            isCritical: Boolean(payload.isCritical),
            undo: Boolean(payload.undo)
        });
        return;
    }

    // Analyze is scored here for the same reason as Observe: the difficulty is
    // read from what the bullet really is, which is the answer being bought.
    if (payload?.action === ACTION_ANALYZE_RESOLVE) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_ANALYZE_RESOLVE, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_ANALYZE_RESOLVE, "sender does not own that character");
        }

        const { resolveAnalyze } = await import("./analyze.mjs");
        await resolveAnalyze({
            actorId: payload.actorId,
            itemId: payload.itemId,
            total: Number(payload.total) || 0,
            isCritical: Boolean(payload.isCritical),
            undo: Boolean(payload.undo)
        });
        return;
    }

    // Handing something to another character writes to a sheet the sender does
    // not own, so it can only happen here. The same-room condition is checked
    // again inside handover.mjs — the payload only claims it.
    if (payload?.action === ACTION_SHARE_BULLET || payload?.action === ACTION_GIVE_ITEM) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(payload.action, "unknown sender");
        if (!ownsActor(sender, payload.fromId)) {
            return refuse(payload.action, "sender does not own the character giving it away");
        }

        const { shareBullet, giveItem } = await import("./handover.mjs");
        const run = payload.action === ACTION_SHARE_BULLET ? shareBullet : giveItem;
        await run({ fromId: payload.fromId, toId: payload.toId, itemId: payload.itemId });
        return;
    }

    // And into them. Same guards as the theft, mirrored — the sender has to own
    // the character whose pocket the item is leaving.
    if (payload?.action === ACTION_PLANT) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_PLANT, "unknown sender");
        if (!ownsActor(sender, payload.plannerId)) {
            return refuse(ACTION_PLANT, "sender does not own the character planting");
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
    // write the flag themselves — which is exactly why they do not: that write
    // is the whole distance between beating a 16 and reading other people's
    // stashes, so it happens where the threshold is checked.
    if (payload?.action === ACTION_FIND_STASH) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_FIND_STASH, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_FIND_STASH, "sender does not own that character");
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
    if (payload?.action === ACTION_STEAL) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_STEAL, "unknown sender");
        if (!ownsActor(sender, payload.thiefId)) {
            return refuse(ACTION_STEAL, "sender does not own the character stealing");
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
    if (payload?.action === ACTION_VAULT_STEAL) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_VAULT_STEAL, "unknown sender");
        if (!ownsActor(sender, payload.thiefId)) {
            return refuse(ACTION_VAULT_STEAL, "sender does not own the character searching");
        }

        const { stealFromVault } = await import("./vault.mjs");
        await stealFromVault({
            thiefId: payload.thiefId, ownerId: payload.ownerId, itemId: payload.itemId,
            // Set only by the Search action, which pays for the concealment it is
            // beating. See the note in `stealFromVault`.
            viaSearch: Boolean(payload.viaSearch),
            // Trusted from the sender, and it is worth saying why when nothing
            // else in this handler is. A client that lied would only ever lie
            // one way — claiming a steady hand — and the cost of believing it is
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
    if (payload?.action === ACTION_OPENING_RESULT) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_OPENING_RESULT, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_OPENING_RESULT, "sender does not own that character");
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
    if (payload?.action === ACTION_CRISIS) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_CRISIS, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_CRISIS, "sender does not own that character");
        }

        const { resolveCrisisAction, freeResolutionFor, sideOf } = await import("./murder.mjs");
        const actor = game.actors.get(payload.actorId);

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
            /*
             * G-18, AND THIS IS THE ONE FIELD ON THIS SOCKET THAT COULD BUY
             * SOMETHING FOR NOTHING.
             *
             * A packet claiming `free` is claiming an automatic success on
             * Survive or Role reversal — the two actions that end an incident.
             * So it is not believed. The grant is looked up in the incident
             * state on THIS side, for the side this actor is actually on, and a
             * claim with nothing behind it is dropped to false: the action then
             * scores against its real threshold with a total of zero, which is
             * a failure. That is the right answer to a forged packet — refusing
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
    // Nothing about the outcome is decided here or sent back — that is the whole
    // point of parking it, and a bridge that answered "recorded" with anything
    // more would be the leak this change exists to close.
    if (payload?.action === ACTION_PARK_MURDER) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_PARK_MURDER, "unknown sender");
        if (!ownsActor(sender, payload.killerId)) {
            return refuse(ACTION_PARK_MURDER, "sender does not own that character");
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
    // is re-derived from the incident on this side — `betrayAsPlayer` refuses
    // anyone the state does not put in that position.
    if (payload?.action === ACTION_BETRAYAL) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_BETRAYAL, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_BETRAYAL, "sender does not own that character");
        }
        const murder = await import("./murder.mjs");
        await murder.betrayAsPlayer(payload.actorId);
        return;
    }

    // Stage 6. Deleting a Remnant token, placing the new one a botched wipe
    // leaves, and reading how visible the trace was in the first place are all
    // GM-only — the last of those most of all, since it is the threshold the
    // roll is being measured against. See cleanup.mjs.
    if (payload?.action === ACTION_CLEANUP) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_CLEANUP, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_CLEANUP, "sender does not own that character");
        }

        const cleanup = await import("./cleanup.mjs");

        // The two added Stage 6 actions score differently — a flat threshold
        // rather than one read off a trace's visibility — so they have their own
        // resolver. Same guard, same sender check; only the maths differs.
        if (payload.key && payload.key !== "eraseTrace" && payload.key !== "transformTrace") {
            await cleanup.resolveStageSix({
                actorId: payload.actorId,
                key: payload.key,
                targetId: payload.targetId ?? null,
                total: Number(payload.total) || 0,
                isCritical: Boolean(payload.isCritical),
                withHope: Boolean(payload.withHope),
                viaAction: Boolean(payload.viaAction)
            });
            return;
        }

        await cleanup.resolveCleanup({
            actorId: payload.actorId,
            tokenId: payload.tokenId,
            total: Number(payload.total) || 0,
            isCritical: Boolean(payload.isCritical),
            withHope: Boolean(payload.withHope),
            // G-20. Passed through as sent and bounded on arrival —
            // `resolveCleanup` checks both halves against `CLEANUP.transform`
            // before it touches anything, which is the same check a GM-side
            // call gets.
            transform: payload.transform ?? null,
            // Z5, and the same contract: sent as given, bounded on arrival.
            mode: payload.key === "transformTrace" ? "transform" : "erase",
            change: payload.change ?? null,
            undo: Boolean(payload.undo),
            // A claim that WAIVES Stage 6's guards and ADDS one of its own: the
            // trace has to belong to the sender. Forging it costs them the
            // right to touch anybody else's trace, which is the only thing the
            // waived guards were protecting.
            viaAction: Boolean(payload.viaAction)
        });
        return;
    }

    // A Meddle writes to the TARGET's sheet, not the Monocub's own — arming a
    // Call is exactly the write a player has no permission to make on somebody
    // else's actor.
    if (payload?.action === ACTION_MEDDLE) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_MEDDLE, "unknown sender");
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_MEDDLE, "sender does not own that Monocub");
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

    if (payload?.action === ACTION_DIFFICULTY) {
        const { askDynamicDifficulty } = await import("./action-rolls.mjs");
        const ruling = await askDynamicDifficulty(payload);
        game.socket.emit(SOCKET_EVENT, {
            action: ACTION_DIFFICULTY_RESULT,
            requestId: payload.requestId,
            userId: asker,
            ruling
        }, { recipients: [asker] });
        return;
    }

    if (payload?.action === ACTION_PROGRESS) {
        if (!senderOf(senderId)) return refuse(ACTION_PROGRESS, "unknown sender");

        // Progress comes from an action or a Call, so it is small by definition.
        // A payload asking for +999 is not the rules asking.
        const amount = Math.trunc(Number(payload.amount));
        if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > STARTING.despairMax) {
            return refuse(ACTION_PROGRESS, `amount ${payload.amount} is out of range`);
        }

        const { addProgress } = await import("./projects.mjs");
        // Who asked, so a finished project can fall back to them when nobody
        // recorded who proposed it.
        const result = await addProgress(payload.countdownId, amount, { by: payload.userId });
        debug(`Applied ${payload.amount} progress to ${payload.countdownId} on behalf of a player.`, result);

        // Report back to whoever asked.
        //
        // A player cannot see whether their request arrived, was applied, or was
        // clamped to nothing — so a project that refused to move looked exactly
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
            content: `<p><strong>${game.i18n.localize("DRPG.Project.title")}</strong> — ${
                foundry.utils.escapeHTML(line)
            }</p>`,
            whisper: to
        });
        return;
    }

    if (payload?.action === ACTION_SHARE) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_SHARE, "unknown sender");

        // You may only share what you can already see.
        //
        // This used to check that the sender was a real user and nothing else,
        // so "share this project with me" was a single socket emit — aimed at
        // any project in the world, including somebody else's SECRET one. A
        // secret project is a murder plan; `resealSecretProjects` exists to keep
        // players out of exactly these, and this handler let a player back in
        // through the front door.
        const { canSee, shareWith } = await import("./projects.mjs");
        if (!canSee(payload.countdownId, sender)) {
            return refuse(ACTION_SHARE, "sender cannot see that project");
        }

        await shareWith(payload.countdownId, payload.targetUserId);
        debug(`Shared project ${payload.countdownId} with ${payload.targetUserId} on behalf of a player.`);
        return;
    }

    if (payload?.action === ACTION_REMNANT) {
        const sender = senderOf(senderId);
        if (!ownsActor(sender, payload.data?.sourceActor)) {
            return refuse(ACTION_REMNANT, "sender does not own the character leaving it");
        }
        const { placeRemnant } = await import("./remnants.mjs");
        await placeRemnant(payload.data);
        debug("Placed a Remnant on behalf of a player.");
        return;
    }

    if (payload?.action === ACTION_TIE_TRACE) {
        if (!senderOf(senderId)) return refuse(ACTION_TIE_TRACE, "unknown sender");
        const { tieTraceForItem } = await import("./remnants.mjs");
        await tieTraceForItem(payload.identity);
        return;
    }

    if (payload?.action === ACTION_REMNANT_EDIT) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_REMNANT_EDIT, "unknown sender");

        // Only the character who left it may re-rate it, which is what a reroll
        // of their own action is. Anyone else editing evidence is the one thing
        // an investigation cannot survive.
        const scene = game.scenes.get(payload.sceneId) ?? canvas?.scene;
        const token = scene?.tokens?.get(payload.tokenId);
        const { REMNANT_FLAGS } = await import("./remnants.mjs");
        const source = token?.getFlag(MODULE_ID, REMNANT_FLAGS.sourceActor);
        if (!ownsActor(sender, source)) {
            return refuse(ACTION_REMNANT_EDIT, "sender did not leave that Remnant");
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
         * `remove` stays as it was — it is the Reroll's own half and
         * `retuneRemnant` already refuses to delete a reinforced trace.
         */
        const { REMNANT_VISIBILITY_LABELS, CLEANUP } = await import("./config.mjs");
        const asked = payload.patch ?? {};
        const narrowed = { remove: Boolean(asked.remove) };
        if (REMNANT_VISIBILITY_LABELS[asked.visibility]) narrowed.visibility = asked.visibility;
        if (CLEANUP.transform?.types?.includes(asked.type)) narrowed.type = asked.type;

        const { retuneRemnant } = await import("./remnants.mjs");
        await retuneRemnant(payload.sceneId, payload.tokenId, narrowed);
        debug("Retuned a Remnant on behalf of a player.", narrowed);
        return;
    }

    if (payload?.action === ACTION_SABOTAGE) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_SABOTAGE, "unknown sender");

        // Freezing somebody's work is aimed at a project you found, not at an
        // id. Seeing it is the condition the picker is built from
        // (`sabotageTargetsIn` lists what this user can see), and it was the one
        // thing this side never asked — so any project in the world could be
        // frozen from a console, including a secret one whose existence the
        // sender had no way to learn honestly.
        const { canSee, sabotageProject } = await import("./projects.mjs");
        if (!canSee(payload.targetId, sender)) {
            return refuse(ACTION_SABOTAGE, "sender cannot see that project");
        }

        // `difficulty` becomes the repair project's progress target, so it is
        // how much work the freeze costs its owner to undo. It arrived unread: a
        // payload asking for a target of 9999 froze a project for the rest of
        // the season. The ceiling is the hardest scale the rules define, read
        // from the table rather than written out here.
        const hardest = Math.max(...Object.values(PROJECT_SCALE).map(s => s.progress));
        const difficulty = Math.trunc(Number(payload.difficulty));
        if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > hardest) {
            return refuse(ACTION_SABOTAGE, `difficulty ${payload.difficulty} is out of range (1–${hardest})`);
        }

        const result = await sabotageProject(payload.targetId, difficulty);

        // Tell the asker what actually happened — not just that the request
        // arrived. Without this a player's own sabotage always reported success
        // and a repair project by name, whether or not the freeze and the
        // repair it depends on were ever written.
        //
        // Addressed to them, too. A broadcast announced every sabotage — and the
        // name of the repair project it created — to the whole table, which is
        // the one thing a saboteur is buying secrecy for.
        if (payload.requestId) {
            game.socket.emit(SOCKET_EVENT, {
                action: ACTION_SABOTAGE_RESULT, requestId: payload.requestId,
                userId: senderId, result
            }, { recipients: [senderId] });
        }
        return;
    }

    if (payload?.action === ACTION_UNSABOTAGE) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_UNSABOTAGE, "unknown sender");

        // Same rule as freezing it. Thawing is the completion of a repair
        // project, so the sender has to be able to see what they are thawing.
        const { canSee, undoSabotage } = await import("./projects.mjs");
        if (!canSee(payload.targetId, sender)) {
            return refuse(ACTION_UNSABOTAGE, "sender cannot see that project");
        }

        await undoSabotage(payload.targetId, payload.repairId);
        return;
    }

    if (payload?.action === ACTION_SENDBACK) {
        const sender = senderOf(senderId);
        const scene = game.scenes.get(payload.sceneId);
        const token = scene?.tokens?.get(payload.tokenId);
        if (!ownsActor(sender, token?.actorId)) {
            return refuse(ACTION_SENDBACK, "sender does not own that token");
        }
        const { REVERT } = await import("./movement.mjs");
        if (token) await token.update(payload.position, { animate: false, [REVERT]: true });
        return;
    }

    if (payload?.action === ACTION_LOOT) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_LOOT, "unknown sender");

        // You may fill your own pockets and nobody else's. Without this, "move
        // that knife onto whoever I like" was a single socket emit away.
        if (!ownsActor(sender, payload.takerId)) {
            return refuse(ACTION_LOOT, "sender does not own the character doing the taking");
        }

        const { lootBody } = await import("./handover.mjs");
        // Everything else it needs to refuse — the body being alive, the item
        // being a Truth Bullet — `lootBody` checks itself, because the GM's own
        // button goes through the same door.
        await lootBody({
            takerId: payload.takerId, bodyId: payload.bodyId, itemId: payload.itemId
        });
        return;
    }

    if (payload?.action === ACTION_ARM) {
        const actor = game.actors.get(payload.actorId);
        if (!actor) return;
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_ARM, "unknown sender");

        // The BUYER has to be the sender's own character — never the
        // beneficiary, who is somebody else's by definition for Support and For
        // the Game. Every other handler here checks ownership and this one did
        // not, so "arm me a Free Critical" was a single socket emit away, paid
        // for with nothing.
        const buyerId = payload.call?.from ?? payload.actorId;
        if (!ownsActor(sender, buyerId)) {
            return refuse(ACTION_ARM, "sender does not own the character paying for it");
        }

        // The Call has to be one the rules define, and `grants` has to be the
        // one that Call actually buys. Without this the payload was taken at
        // face value: "arm me a free critical" was a single socket emit away.
        const call = HOPE_CALLS[payload.call?.key] ?? DESPAIR_CALLS[payload.call?.key];
        if (!call || call.grants !== payload.call?.grants) {
            return refuse(ACTION_ARM, `"${payload.call?.key}" does not grant "${payload.call?.grants}"`);
        }

        const { MODULE_ID: id, FLAGS } = await import("./config.mjs");
        await actor.setFlag(id, FLAGS.pendingCall, payload.call);
        debug(`Armed ${payload.call?.key} on ${actor.name} on behalf of a player.`);
        // The beneficiary is not the buyer: tell them what they have been given,
        // or they will meet a locked roll dialog with no idea why it opened up.
        await whisperToOwner(actor, `${cardHead({
            action: game.i18n.localize("DRPG.Calls.armedTitle")
        })}<p>${
            game.i18n.format("DRPG.Calls.armedForYou", {
                what: game.i18n.localize(`DRPG.Calls.grants.${payload.call?.grants}`)
            })
        }</p>`);
        return;
    }

    if (payload?.action === ACTION_DESPAIR) {
        const sender = senderOf(senderId);
        if (!sender) return refuse(ACTION_DESPAIR, "unknown sender");

        // The only legitimate player-side Despair adjustment is a reroll giving
        // one point back or taking one. Anything larger is not the rules asking.
        const delta = Math.trunc(Number(payload.delta));
        if (!Number.isFinite(delta) || Math.abs(delta) !== 1) {
            return refuse(ACTION_DESPAIR, `delta ${payload.delta} is out of range`);
        }
        const target = game.users.get(payload.targetUserId ?? "");
        if (target?.role !== CONST.USER_ROLES.GAMEMASTER) {
            return refuse(ACTION_DESPAIR, "target is not a Gamemaster");
        }

        const { adjustDespair } = await import("./despair.mjs");
        await adjustDespair(target.id, delta);
        debug(`Adjusted Despair for ${target.name} by ${delta} on behalf of ${sender.name}.`);
        return;
    }

    if (payload?.action === ACTION_ECLIPSE_MOVE) {
        const sender = senderOf(senderId);
        if (!ownsActor(sender, payload.actorId)) {
            return refuse(ACTION_ECLIPSE_MOVE, "sender does not own that character");
        }
        const { applyRecordedMove } = await import("./eclipse.mjs");
        await applyRecordedMove(payload.actorId);
        return;
    }

    /*
     * `project.create` USED TO LIVE HERE, and it is gone rather than mended.
     *
     * Nothing sent it: a project is created by the GM, from the panel or from
     * an Approve button on a proposal card, and a player's proposal reaches
     * them as a card rather than as a write. So the branch was a GM-side
     * handler with no caller — and it still accepted a `project.create`
     * payload from any connected client, checked only that the sender was
     * somebody, and created the project. Including one flagged
     * `indirectMurder`. A door nobody used and anybody could open.
     */
}

/**
 * Arm a Call on somebody else's character.
 *
 * Support gives another player advantage. Flags live on the beneficiary's actor,
 * which the buyer has no write access to — hence "Player A lacks permission".
 * The GM owns everything, so they set it.
 */
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
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_LOOT, userId: game.user.id,
        requestId: expectAck("Take from the body"), takerId, bodyId, itemId
    });
    return true;
}

export async function requestArmCall(actorId, call) {
    if (game.user.isGM) {
        const actor = game.actors.get(actorId);
        if (!actor) return null;
        const { MODULE_ID: id, FLAGS } = await import("./config.mjs");
        await actor.setFlag(id, FLAGS.pendingCall, call);
        return true;
    }
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_ARM, userId: game.user.id, requestId: expectAck(call?.key ?? "Call"), actorId, call });
    return true;
}

/**
 * Despair pools are a world setting; a player's reroll asks the GM to fix one.
 *
 * `userId` is the sender, `targetUserId` the Monokuma being adjusted. They used
 * to be the same field, which is how the GM side had no way of telling who was
 * asking from whose pool was moving.
 */
export async function requestDespairAdjust(targetUserId, delta) {
    if (game.user.isGM) {
        const { adjustDespair } = await import("./despair.mjs");
        return adjustDespair(targetUserId, delta);
    }
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_DESPAIR, userId: game.user.id,
        requestId: expectAck("Despair"), targetUserId, delta
    });
    return { pending: true };
}

/**
 * Sabotage writes two world settings; the GM applies it and this waits for the
 * real outcome rather than assuming the request will land.
 *
 * `sabotageProject` used to return `{pending: true}` here and let the action
 * report success on the strength of that alone — the freeze and the repair
 * project it depends on were still just an emitted socket message, applied
 * whenever the GM's client got around to it. A player who then tried to keep
 * working the same project immediately afterwards could land inside that gap
 * and find it not frozen yet, and the "repair created" text was reading a
 * repair object that did not exist yet either. This resolves once the GM's
 * client answers with what it actually wrote — the same pattern already used
 * for a Dynamic ruling — so the roll does not call itself done until it is.
 */
export function requestSabotage(targetId, difficulty) {
    if (!hasGm()) return Promise.resolve(null);

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, {
            action: ACTION_SABOTAGE, userId: game.user.id, requestId, targetId, difficulty
        });

        setTimeout(() => {
            if (!pendingRulings.has(requestId)) return;
            pendingRulings.delete(requestId);
            ui.notifications.warn(game.i18n.format("DRPG.Bridge.noAnswer", { what: "Sabotage" }));
            resolve(null);
        }, ACK_TIMEOUT_MS);
    });
}

/**
 * Taking a sabotage back writes the same two settings. This one stays
 * fire-and-forget: it is only ever called by Reroll, after the Call has
 * already been paid for and the new roll is about to replace the old effect,
 * so there is nothing left for the player to race against.
 */
export function requestUndoSabotage(targetId, repairId) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_UNSABOTAGE, userId: game.user.id, requestId: expectAck("Sabotage"), targetId, repairId });
    return { pending: true };
}

/** A player whose token cannot be moved back asks the GM to do it. */
export function requestSendBack(sceneId, tokenId, position) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_SENDBACK, userId: game.user.id, requestId: expectAck("Move"), sceneId, tokenId, position });
    return { pending: true };
}

/** Count an Eclipse crossing on the GM's copy of the world setting. */
export function requestEclipseMove(actorId) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_ECLIPSE_MOVE, userId: game.user.id, requestId: expectAck("Eclipse"), actorId });
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
    game.socket.emit(SOCKET_EVENT,
        { action: ACTION_TIE_TRACE, userId: game.user.id, identity });
    return { pending: true };
}

/** Creating tokens is GM-only, so a player's Remnant is placed for them. */
export function requestRemnant(data) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_REMNANT, userId: game.user.id, requestId: expectAck("Remnant"), data });
    return { pending: true };
}

/**
 * Retune or remove a Remnant a player's own action left behind — a reroll has
 * changed how well they hid it, or removed the reason for the trace entirely.
 * Editing tokens is GM-only, same as creating them.
 */
export function requestRemnantEdit(sceneId, tokenId, patch) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_REMNANT_EDIT, userId: game.user.id, requestId: expectAck("Remnant"), sceneId, tokenId, patch });
    return { pending: true };
}

function hasGm() {
    if (game.users.some(u => u.isGM && u.active)) return true;
    ui.notifications.warn(game.i18n.localize("DRPG.Bridge.noGm"));
    return false;
}

/**
 * Ask a GM how hard a described action is.
 *
 * The guide gives the threshold to the GM: "the player describes something, the
 * GM picks a threshold". The picker used to render on the player's own client,
 * so the person being tested chose their own difficulty — and would always
 * choose the easiest band. The dialog now opens on the GM's screen and the
 * answer comes back over the socket.
 *
 * Generous timeout on purpose: a GM reading a description and making a ruling is
 * a human taking their time, not a machine failing to answer.
 *
 * @returns {Promise<{tier: number, trait: string}|null>} null if refused or unanswered.
 */
export function requestDynamicDifficulty({ description, actorName, room }, timeoutMs = 180000) {
    if (!hasGm()) return Promise.resolve(null);

    const requestId = foundry.utils.randomID();
    return new Promise(resolve => {
        awaitRuling(requestId, resolve, {
            action: ACTION_DIFFICULTY,
            requestId,
            userId: game.user.id,
            description, actorName, room
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
 * A GM runs this locally instead of talking to themselves — the same shape as
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
export function requestObserveTarget({ actorId, declaration, request = "" }, timeoutMs = 180000) {
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
 * A GM runs this locally instead of talking to themselves — the same shape as
 * `requestObserveTarget`. Everyone else waits on the socket.
 *
 * @returns {Promise<Array<{id: string, label: string, reinforced: boolean}>>}
 *   Never DC, never `tiedToCrime` — see `cleanableTracesForPlayer` in
 *   cleanup.mjs, which is the only thing that ever builds this array.
 */
export function requestCleanableTraces(actorId, { mine = false } = {}, timeoutMs = 180000) {
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
            // `mine` narrows the answer to traces this character left. It only
            // ever REMOVES rows, so a forged `false` buys the sender the Stage 6
            // list — which is refused a few lines later anyway, because the
            // erase itself re-checks ownership. See `resolveCleanup`.
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
 * GM's client has finished — a Truth Bullet on their sheet or 2 Sanity — so
 * there is nothing for a second reply to add.
 */
export function requestObserveResolve({ actorId, key, total, isCritical, undo = false }) {
    if (game.user.isGM) {
        return import("./observe.mjs")
            .then(m => m.resolveObserve({ key, total, isCritical, undo }));
    }
    if (!hasGm()) return null;

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_OBSERVE_RESOLVE,
        userId: game.user.id,
        requestId: expectAck("Observe"),
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

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_ANALYZE_RESOLVE,
        userId: game.user.id,
        requestId: expectAck("Analyze"),
        actorId, itemId, total, isCritical, undo
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

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_SHARE_BULLET,
        userId: game.user.id,
        requestId: expectAck("Truth Bullet"),
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

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_GIVE_ITEM,
        userId: game.user.id,
        requestId: expectAck("Item"),
        fromId, toId, itemId
    });
    return { pending: true };
}

/** Hand a thrown crisis action to the GM to be scored and applied. */
export function requestCrisisResult({
    actorId, key, total, isCritical, withHope, undo = false,
    // G-18: this one was taken rather than rolled — a critical Self-defence's
    // free resolution action. Re-checked GM-side against the incident state,
    // like everything else that arrives over this socket.
    free = false,
    // What the player's own client used up, if the action was "use an item".
    // Carried rather than decided here: the GM records it so a Reroll can put
    // it back, but the spending happened where the dialogs belong.
    usedItemId = null,
    // Which resource a critical Strike takes. Decided by the killer on their own
    // client while the dice are still up, and carried here rather than asked
    // again on the GM's — see `askCriticalTarget`.
    choice = null
}) {
    if (game.user.isGM) {
        return import("./murder.mjs")
            .then(m => m.resolveCrisisAction({
                actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free
            }));
    }
    if (!hasGm()) return null;

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_CRISIS,
        userId: game.user.id,
        requestId: expectAck("Incident"),
        actorId, key, total, isCritical, withHope, undo, choice, usedItemId, free
    });
    return { pending: true };
}

/** Hand a thrown Stage 6 clean-up to the GM to be scored against the trace. */
export function requestCleanup({
    actorId, tokenId, total, isCritical, withHope, undo = false,
    // G-20: what a critical chose to turn the trace into, if anything. Shaped
    // and bounded on the far side — see `resolveCleanup`.
    transform = null,
    // Z5: what the transform action was declared as, before the dice. Same
    // treatment — sent as given, bounded on arrival.
    change = null,
    // Stage 6 has four actions now. `key` names which; absent means the
    // original one, so every existing caller keeps working unchanged.
    key = "eraseTrace", targetId = null,
    // Which door this came through: the Tamper tile, or Stage 6's own panel.
    // It decides what is charged and which guard runs — see cleanup.mjs.
    viaAction = false
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
                mode, change, viaAction
            })
            : m.resolveStageSix({
                actorId, key, targetId, total, isCritical, withHope, viaAction
            }));
    }
    if (!hasGm()) return null;

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_CLEANUP,
        userId: game.user.id,
        requestId: expectAck("Clean-up"),
        actorId, tokenId, total, isCritical, withHope, undo, key, targetId, transform,
        change, viaAction
    });
    return { pending: true };
}

/**
 * Ask a GM to open the betrayal: the newcomer kills the killer they helped.
 *
 * No dice and no numbers travel — this is a declaration, and the GM's own
 * confirmation is what turns it into a second incident.
 */
/** Record a direct murder declared during an Eclipse. See eclipse.mjs. */
export function requestParkMurder({ killerId, room = null, note = "" }) {
    if (game.user.isGM) {
        return import("./eclipse.mjs").then(m => m.writeParkedMurder({ killerId, room, note }));
    }
    if (!hasGm()) return null;

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_PARK_MURDER,
        userId: game.user.id,
        requestId: expectAck("Direct murder"),
        killerId, room, note
    });
    return { pending: true };
}

export function requestBetrayal({ actorId }) {
    if (game.user.isGM) {
        return import("./murder.mjs").then(m => m.betrayAsPlayer(actorId));
    }
    if (!hasGm()) return null;

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_BETRAYAL,
        userId: game.user.id,
        requestId: expectAck("Betrayal"),
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

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_MEDDLE,
        userId: game.user.id,
        requestId: expectAck("Meddle"),
        actorId, targetId, help, total, isCritical
    });
    return { pending: true };
}

/**
 * Pull one item out of somebody else's stash. GM-only on both ends.
 *
 * `viaSearch` marks the route that has already paid for a concealed stash with
 * an action, a search token and a penalised roll — see `stealFromVault`.
 */
export function requestVaultSteal({ thiefId, ownerId, itemId, viaSearch = false, clumsy = false }) {
    if (game.user.isGM) {
        return import("./vault.mjs")
            .then(m => m.stealFromVault({ thiefId, ownerId, itemId, viaSearch, clumsy }));
    }
    if (!hasGm()) return null;

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_VAULT_STEAL,
        userId: game.user.id,
        requestId: expectAck("Stash"),
        thiefId, ownerId, itemId, viaSearch, clumsy
    });
    return { pending: true };
}

/**
 * Go through somebody's pockets. GM-only on both ends, like its sibling above.
 *
 * The two totals travel and the verdicts are made on the other side — see
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

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_STEAL,
        userId: game.user.id,
        requestId: expectAck("Steal"),
        thiefId, victimId, itemId, total, isCritical, unseenTotal, unseenCritical
    });
    return { pending: true };
}

/**
 * Leave something in somebody's pocket. The mirror of `requestSteal`, and the
 * same division of labour: the two totals travel, both verdicts are made on the
 * other side against `ACTIONS.palm`.
 *
 * `itemId` is not a request here but a statement — it came out of the planter's
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

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_PLANT,
        userId: game.user.id,
        requestId: expectAck("Plant"),
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
 * — see `resolveStashSearch`.
 */
export function requestStashSearch({ actorId, total = 0, isCritical = false }) {
    if (game.user.isGM) {
        return import("./vault.mjs").then(m => m.resolveStashSearch({ actorId, total, isCritical }));
    }
    if (!hasGm()) return null;

    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_FIND_STASH,
        userId: game.user.id,
        requestId: expectAck("Stash"),
        actorId, total, isCritical
    });
    return { pending: true };
}

/** Ask the GM to add project progress on our behalf. */
export function requestProjectProgress(countdownId, amount) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, {
        action: ACTION_PROGRESS, countdownId, amount,
        userId: game.user.id, requestId: expectAck("Project")
    });
    // `changed` is unknown from here — the GM whispers back what actually
    // happened. Claiming success would be a guess.
    return { pending: true, changed: null };
}

/**
 * Ask the GM to let another player in on a secret project. Players are allowed
 * to bring someone in on their own plan — the guide's whole social engine runs
 * on conspiracies — but the write itself has to happen GM-side.
 */
export function requestProjectShare(countdownId, userId) {
    if (!hasGm()) return null;
    game.socket.emit(SOCKET_EVENT, { action: ACTION_SHARE, userId: game.user.id, requestId: expectAck("Project"), countdownId, targetUserId: userId });
    return { pending: true };
}

/* ==========================================================================
 * CALLING THE GM
 * ========================================================================== */

/**
 * Post a ruling request into the actor owner's messenger thread — one message,
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
     * Buttons for the GM, rendered into the card itself.
     *
     * Each is `{ action, label, data }`. `data` becomes `data-*` attributes on
     * the button, which is how the ruling carries its own subject: a Direct
     * Murder declaration names the killer and the victim, so the card that
     * announces it can open the incident without a GM re-picking two names off
     * a list they are already reading.
     *
     * Safe to render for everybody. The handler is GM-gated on the clicking
     * client and every action behind it is GM-gated again on arrival, so a
     * player who forges a click into their own DOM achieves nothing.
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
     * saw, and the actor it names is the KILLER — so the ordinary path posts
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
    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const parts = [];

    parts.push(`<h3>${esc(title)}</h3>`);
    parts.push(`<p><strong>${esc(actor?.name ?? "?")}</strong>${room ? ` · ${esc(room)}` : ""}</p>`);

    if (roll) {
        const traitLabel = TRAITS[roll.trait]?.label ?? roll.trait ?? "";
        parts.push(`<p>${traitLabel} · <strong>${roll.total}</strong>${
            roll.isCritical ? ` · <em>${game.i18n.localize("DRPG.Action.critical")}</em>`
            : roll.withHope ? " · Hope"
            : roll.withFear ? " · Despair" : ""
        }</p>`);

        // The guide owes the player a substantial hint on a critical Observe or
        // Analyze. Say so loudly rather than leaving the GM to remember it.
        if (roll.isCritical) {
            parts.push(`<p class="drpg-warning"><strong>${
                game.i18n.localize("DRPG.Bridge.criticalHint")
            }</strong></p>`);
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
        try {
            await whisperToGms(content);
            return true;
        } catch (err) {
            error("Could not reach the GM", err);
            return false;
        }
    }

    try {
        const { postToThread } = await import("./messenger.mjs");
        // Every callGm card is, by definition, a call ON the GM — the flag is
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
 * card above it still read as an open question — with its buttons still on it,
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

    const wrap = document.createElement("div");
    wrap.innerHTML = contentOf(message);

    wrap.querySelectorAll(".drpg-call-actions, .drpg-call-awaiting").forEach(el => el.remove());
    // Cards posted before the marker class existed carry the same sentence with
    // nothing to hook onto, so they are matched by what they say.
    const awaiting = game.i18n.localize("DRPG.Bridge.awaitingRuling");
    for (const p of wrap.querySelectorAll("p")) {
        if (p.textContent.trim() === awaiting) p.remove();
    }

    const note = document.createElement("p");
    note.className = "drpg-call-settled";
    note.textContent = text;
    wrap.append(note);

    try {
        const { MESSENGER_FLAGS } = await import("./messenger.mjs");
        return await message.update({
            content: wrap.innerHTML,
            flags: { [MODULE_ID]: { [MESSENGER_FLAGS.settled]: true } }
        });
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
    // Optional HTML for the GM's CARD rather than the player's window — the
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

    await callGm(actor, { title, roll, request: text, room, body, actions });
    return text;
}
