/**
 * Danganronpa RPG - a player's ask that waits on a GM: its state, its time and its Withdraw (2.0 line T2, EXP-PL-12, CALLS-09,
 * DAY-07, 28.11.2026).
 * ---------------------------------------------------------------------------
 * The player's half: what the waiting card is drawn with (`waitingFor`), its Withdraw (`withdrawAsk`), and the state the
 * primary sends painted on the waiting card and on the ask's card in the thread (`paintAskState`, `markAskCard`). The
 * primary's half: the ask a withdrawal may name (`askToWithdraw`, the guard's and the run's) and the withdrawal carried out
 * (`withdrawnOnPrimary`, the run of `ask.withdraw`). The waiting card itself is popup.mjs `showWaiting`; the wait is
 * bridge-guards.mjs `createWaiter`'s; the state is sent by call-gm.mjs `tellAskState`.
 *
 * WHERE IT SITS. A file of its own and not part of call-gm.mjs or bridge-asks.mjs, which it would have put past the split's
 * 1500 lines (tools/check.mjs `lengths`: call-gm.mjs 1493 and bridge-asks.mjs 1494 with the rest of this change, 28.11.2026); no facade
 * re-exports it. It imports call-gm.mjs and bridge-guards.mjs; bridge-asks.mjs, whose table imports the runs, is reached by
 * `import()`, and bridge-guards.mjs and bridge-runs-acts.mjs reach this file by `import()`, so no cycle is closed (R161).
 *
 * AND THE ASKER WHO LEFT OR RELOADED (2.0 line T2, CALLS-04, 28.11.2026): the primary's sign on a card whose asker left
 * (`askerLeftOnPrimary`, `withAskerLeft`) and its end of the asks a reloaded player's browser no longer waits on
 * (`askerReloadedOnPrimary`), at the end of the file. gm-bridge.mjs reaches both by `import()`.
 */

import { MODULE_ID } from "./config.mjs";
import { serverNow, debug, isPrimaryGm, localeFormat } from "./utils.mjs";
import { cancelRequest } from "./bridge-guards.mjs";
import { heldAskOf, heldAskMaps, observeAsks, settleCall } from "./call-gm.mjs";
import { cardFlag, contentOf, updateSecret } from "./secret.mjs";

/*
 * THE PLAYER SEES THE TIME, THE STATE, AND A WAY OUT (2.0 line T2, EXP-PL-12, CALLS-09, DAY-07, 28.11.2026; F1-calls CALLS-09,
 * F1-daily DAY-07, F1-blind-player EXP-PL-12, E-PL-04, 105, 107, 118). A player who asked a GM for a Call's yes, a Dynamic
 * Action's difficulty or a roll's statistic saw "Waiting on the GM..." and nothing more: no time - the card in the thread
 * said until when, the waiting card did not - no word that a GM had taken the card (only another GM saw the claim), and no
 * way to take the ask back but waiting out its clock (180 s, a Call 300 s). The waiting card now says how long the ask
 * stays open (`waitingFor`: the ask's own clock from now, `TIMING.rulingMs` or a Call's `hopeCallRulingMs`), reads "A GM is
 * reading your request." while a GM's claim holds its card (the primary's `ask.state`, taken from the primary alone,
 * bridge-guards.mjs `createWaiter`), and has Withdraw: the wait ends here at once with nothing spent - none of the three
 * roads pays before the ruling - the player is told so once (`DRPG.Bridge.withdrawn`), and `ask.withdraw` ends the card for
 * everyone ("Request withdrawn."). A GM's ruling after it finds no ask held, as one after the card's time does
 * (messenger-app.mjs `askNotHeld`). The card in the thread reads the same state, drawn here on this browser alone: the card
 * is a document every reader shares, and the state is the asker's (`markAskCard`). The state's name of the GM is not
 * given: the owner's question for the report, default no. R9028-R9030, tier 2's E132 EXP-PL-12.
 */

/** What a waiting card for an ask on a clock of `timeoutMs` is drawn with (popup.mjs `showWaiting`'s options). */
export function waitingFor(timeoutMs) {
    return { expires: serverNow() + timeoutMs, onWithdraw: withdrawAsk };
}

/**
 * The waiting card's Withdraw: the wait ends here (bridge-guards.mjs `cancelRequest`), the player is told, and the primary is
 * asked to end the card (`ask.withdraw`, which nobody waits on). False when the request was no longer waiting - answered or
 * ended a moment before - and then nothing is said or sent.
 */
export async function withdrawAsk(requestId) {
    // A player's: a GM's own ask is ruled in its own window and waits on no bridge (R6: a GM would ask itself).
    if (game.user?.isGM) return false;
    // Read before the wait ends, so the packet leaves in the same step as the wait's end, before its caller's road goes on.
    const { requestAskWithdraw } = await import("./bridge-asks.mjs");
    if (!cancelRequest(requestId)) return false;
    ui.notifications.info(game.i18n.localize("DRPG.Bridge.withdrawn"));
    await requestAskWithdraw(requestId);
    return true;
}

/* The state each of this browser's waiting asks was last told, by request id; and the words each painted line had before. */
const askStates = new Map();
const ASK_STATES_KEPT = 100; // call-gm.mjs's `CALL_ASKS_KEPT`: as many as the asks a primary holds.
const ownWords = new WeakMap();

function paintLine(el, state) {
    if (!ownWords.has(el)) ownWords.set(el, el.innerHTML);
    if (state === "ruling") el.textContent = game.i18n.localize("DRPG.Bridge.askRuling");
    else el.innerHTML = ownWords.get(el);
}

/** The state the primary sent for this browser's ask `rid` ("ruling" or "waiting"), painted on every line that names it. */
export function paintAskState(rid, state) {
    if (typeof rid !== "string" || !rid) return;
    askStates.delete(rid);
    askStates.set(rid, state);
    while (askStates.size > ASK_STATES_KEPT) askStates.delete(askStates.keys().next().value);
    for (const el of document.querySelectorAll("[data-drpg-ask]")) if (el.dataset.drpgAsk === rid) paintLine(el, state);
}

/**
 * The ask's card in this player's thread, as drawn on its asker's browser (messenger-app.mjs `wireCallActions`): its
 * "Awaiting a ruling." names the ask, and reads the state last told for it. Another reader's card is left as it is.
 */
export function markAskCard(body, message) {
    const mark = message ? cardFlag(message, "rid") : null;
    if (!mark?.id || mark.asker !== game.user?.id) return;
    const line = body?.querySelector?.(".drpg-call-awaiting em");
    if (!line) return;
    line.dataset.drpgAsk = mark.id;
    if (askStates.has(mark.id)) paintLine(line, askStates.get(mark.id));
}

/**
 * The ask this primary holds on a card under `rid` for `userId` that a withdrawal may end - a Call's, a Dynamic Action's or a
 * statistic's, never an Observe's (its card is another line's, and its waiting card has no Withdraw) - with its map, or null.
 * `maps` is a test's (R9029).
 */
export function askToWithdraw(rid, userId, maps = undefined) {
    if (typeof rid !== "string" || !rid || !userId) return null;
    const found = heldAskOf(rid, userId, maps);
    return found && found.asks !== observeAsks ? found : null;
}

/**
 * The run of `ask.withdraw` on the primary: the sender's ask held under `rid` is dropped, as an asker's expiry drops it
 * (call-gm.mjs `expiredOnPrimary`), so a GM's yes or difficulty after it is not kept; and its card ends for everyone, with
 * no wait for a GM's claim on it - the asker has stopped waiting, and the claim's ruling then finds no ask held. A card
 * already ended is left as it is. False when the sender holds no such ask: nothing is done.
 */
export async function withdrawnOnPrimary(rid, senderId) {
    const found = askToWithdraw(rid, senderId);
    if (!found) return false;
    found.asks.delete(rid);
    const message = game.messages.get(found.held.messageId ?? "");
    if (!message) return true;
    const { MESSENGER_FLAGS } = await import("./messenger.mjs");
    if (cardFlag(message, MESSENGER_FLAGS.settled)) return true;
    await settleCall(message, { key: "DRPG.Bridge.settledWithdrawn" }).catch(err => debug(`${MODULE_ID}: a withdrawn ask's card could not be ended`, err));
    return true;
}

/*
 * A PLAYER WHO RELOADED WAITS ON NOTHING THEY ASKED BEFORE (2.0 line T2, CALLS-04, 28.11.2026; F1-calls CALLS-04, TRIAGE-3,
 * F3 S3 B, where B1 and B4 were red). A player who reloaded while waiting left the GMs' card standing with live buttons to
 * its time, 3 minutes or a Call's 5: the primary did nothing at a player's leave (gm-bridge.mjs's `userConnected` handled
 * GMs alone), and a ruling given on that card went to a browser that no longer had the request - a difficulty ended
 * "Answered by ..., but nothing confirms that the answer arrived.", and the player's handbook then said not to ask again.
 *
 * Two steps, both on the primary and both over the asks it holds on a card (call-gm.mjs `heldAskMaps`):
 * - the leave (`userConnected(user, false)` of a player): each card of that user's asks is signed for the GMs alone,
 *   `DRPG.Bridge.askerLeft` with the name and the time, in a `.drpg-gm-only` block before its answers, which a player's
 *   copy of the words never holds (secret.mjs `playerWords`). Nothing is dropped: a player whose network broke for a
 *   moment comes back with the same page and the same wait, and is still answered.
 * - the reload: every player's browser tells the GMs once it has loaded (`bridge.playerReady`, gm-bridge.mjs
 *   `tellGmsPlayerReady`), and the primary drops every ask it holds for that sender and ends each of their cards
 *   `DRPG.Bridge.settledReloaded` for everyone, with `settledGone` for the GMs: its buttons go, and a GM's ruling on it
 *   after finds no ask held (messenger-app.mjs `askNotHeld`). A ruling already sent on and waiting for its receipt is
 *   left to its own end (call-gm.mjs `unreceivedOnPrimary`, `TIMING.ackMs`): that is the one case the handbook still
 *   says not to ask again for.
 *
 * HOW A RELOAD IS TOLD FROM A SHORT BREAK. The packet is sent at a page's load and at no reconnect: a waiter that outlived
 * a break of the network, without a reload, sends no `bridge.playerReady`, and its resend under the same id (bridge-guards.mjs
 * `resendOnGmReady`) finds its card held still (call-gm.mjs `askAgain`). A page that has just loaded holds no waiter of the
 * page before it, and it can send no ask before this packet (it is sent from `registerGmBridge`, at the page's ready): so
 * every ask held for that sender when the packet arrives is one of the page before. That rests on one sender's packets
 * reaching the primary in the order they were sent, which socket.io keeps on one connection and which is not read across a
 * reload on v14 (an old page's last packet after the new page's first: not measured). Whose asks end is Foundry's
 * `senderId`, never a field: the packet carries none, and another player's console sending it ends only that player's own.
 * A user with two browsers open is one user to the primary, so the second browser's load ends the first's asks as well:
 * not told apart (a question for the owner in the line's report). Asks a primary that took the role over never held -
 * the first primary left or reloaded - are not ended here; their cards end at their time, as before (`sweepAskCards`).
 */

/** The attribute the GMs' sign that a card's asker left carries, with the time it was written. */
const ASKER_LEFT = "data-drpg-asker-left";
/** The sign this primary is writing now, by card: the reload's end waits for it, so the two writes of one card do not cross. */
const signing = new Map();

/** The card's words `html` with the GMs' sign that its asker `name` left at `at`: one sign a card, written again in place,
    before the card's answers (or at its end). Pure but for the language and the clock it writes the time in. R9031. */
export function withAskerLeft(html, name, at) {
    const wrap = document.createElement("template");
    wrap.innerHTML = String(html ?? "");
    wrap.content.querySelectorAll(`[${ASKER_LEFT}]`).forEach(el => el.remove());
    const sign = document.createElement("div");
    sign.className = "drpg-gm-only";
    sign.setAttribute(ASKER_LEFT, String(Math.round(at)));
    const line = document.createElement("p");
    line.textContent = game.i18n.format("DRPG.Bridge.askerLeft", {
        name: name || "?", time: localeFormat("time", at, { hour: "2-digit", minute: "2-digit" })
    });
    sign.append(line);
    const actions = wrap.content.querySelector(".drpg-call-actions");
    if (actions) actions.before(sign);
    else wrap.content.append(sign);
    return wrap.innerHTML;
}

/** Write the sign on the card `messageId`, unless it is gone or ended: the words go the road the card's do. */
async function markAskerLeft(messageId, name, at) {
    if (!game.user?.isGM) return false;
    const message = game.messages.get(messageId ?? "");
    if (!message) return false;
    const { MESSENGER_FLAGS } = await import("./messenger.mjs");
    if (cardFlag(message, MESSENGER_FLAGS.settled)) return false;
    const html = withAskerLeft(contentOf(message), name, at);
    if (message.getFlag(MODULE_ID, "secret")) await updateSecret(message, html);
    else await message.update({ content: html });
    return true;
}

/**
 * A player `user` left (gm-bridge.mjs's `userConnected`): each card of an ask this primary holds for that user is signed for
 * the GMs (`mark`, once a card). Nothing is dropped. Answers the cards handed to the mark. `maps`, `primary`, `at` and `mark`
 * are a test's (R9031).
 */
export function askerLeftOnPrimary(user, { maps = heldAskMaps(), primary = isPrimaryGm(), at = Date.now(), mark = markAskerLeft } = {}) {
    if (!user?.id || user.isGM || !primary) return [];
    const cards = [];
    for (const asks of maps) for (const held of asks.values()) {
        if (held?.userId === user.id && held.messageId && !cards.includes(held.messageId)) cards.push(held.messageId);
    }
    for (const messageId of cards) {
        const done = Promise.resolve()
            .then(() => mark(messageId, user.name, at))
            .catch(err => debug("Could not sign a card whose asker left", err))
            .finally(() => { if (signing.get(messageId) === done) signing.delete(messageId); });
        signing.set(messageId, done);
    }
    return cards;
}

/** End the card `messageId` of an ask its asker's reload let go, unless it is gone or ended. */
async function endReloaded(messageId) {
    await signing.get(messageId);
    const message = game.messages.get(messageId ?? "");
    if (!message) return false;
    const { MESSENGER_FLAGS } = await import("./messenger.mjs");
    if (cardFlag(message, MESSENGER_FLAGS.settled)) return false;
    await settleCall(message, { key: "DRPG.Bridge.settledReloaded" }, null, { key: "DRPG.Bridge.settledGone" });
    return true;
}

/**
 * A player's browser that has loaded said so (`bridge.playerReady`, Foundry's `senderId`): on the primary, every ask held for
 * that sender is dropped and each of their cards ended (`end`, once a card). A GM, a user this browser does not know, or a
 * browser that is not the primary ends nothing. Answers the cards handed to the end. `maps`, `users`, `primary` and `end` are
 * a test's (R9032).
 */
export async function askerReloadedOnPrimary(senderId, { maps = heldAskMaps(), users = game.users, primary = isPrimaryGm(), end = endReloaded } = {}) {
    const sender = senderId ? users?.get?.(senderId) : null;
    if (!sender || sender.isGM || !primary) return [];
    const cards = [];
    for (const asks of maps) for (const [rid, held] of [...asks]) {
        if (held?.userId !== senderId) continue;
        asks.delete(rid);
        if (held.messageId && !cards.includes(held.messageId)) cards.push(held.messageId);
    }
    for (const messageId of cards) await Promise.resolve(end(messageId)).catch(err => debug("Could not end a card its asker's reload let go", err));
    return cards;
}
