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
 */

import { MODULE_ID } from "./config.mjs";
import { serverNow, debug } from "./utils.mjs";
import { cancelRequest } from "./bridge-guards.mjs";
import { heldAskOf, observeAsks, settleCall } from "./call-gm.mjs";
import { cardFlag } from "./secret.mjs";

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
