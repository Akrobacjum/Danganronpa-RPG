/**
 * Danganronpa RPG - the GM's receipt for a player's Reroll.
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS (E03, 24.09.2026; audit S10-40, and the undo half of
 * S10-03, S05-03, S04-09, S05-13 and S05-40). A Reroll takes an action back
 * before it runs it again, and the taking back reaches the GM as a packet that
 * says `undo`: give back the Sanity a missed Observe cost and delete the bullet
 * a found one made, thaw what a Sabotage froze, take back project progress,
 * lift a trace off the map, hand a point of Despair back. Every one of those
 * packets was believed. A console could send one without ever buying a Reroll,
 * and an undo is the most useful thing a console can send, because what it
 * removes is evidence.
 *
 * The one thing a real Reroll always does before any of those packets leaves
 * is rewrite the ROLLS of the roller's own chat message (`rerollLastAction`,
 * `message.update({ rolls })`), and the server tells every client who made
 * that update. So the primary GM watches for it. An undo from a player is taken
 * only when the same player rewrote a roll of the same character within
 * `TIMING.rerollReceiptMs`, and each receipt pays for one undo of each kind.
 *
 * WHAT IT PROVES, AND WHAT IT DOES NOT. It proves that this user rewrote a roll
 * of this character a few minutes ago. It does not prove that the Reroll was
 * paid for: anybody may rewrite their own message's rolls - Daggerheart's own
 * dice-reroll in chat does exactly that - and a console can too. Whether the
 * Hope was spent and the numbers are honest is the second layer of the trust
 * model (E28, E29). Until then this narrows an undo from "any time, anything"
 * to "right after you rerolled that character, once".
 *
 * Kept in memory on the primary GM, on purpose: it is a few minutes long, and
 * a GM who reloads between a reroll and its undo loses it. That undo is then
 * refused and the player is told so, which is the honest failure; the action's
 * first result stands.
 */

import { TIMING } from "./config.mjs";
import { isPrimaryGm, debug, pause } from "./utils.mjs";
import { dualityOfRoll } from "./reroll.mjs";
import { ownsActor } from "./gm-bridge.mjs";

/** `${actorId}|${userId}` -> { messageId, at, wasFear, nowFear, used: Set<string> } */
const receipts = new Map();

/**
 * Whether each recent roll message was a Despair roll, as the GM last saw it.
 * A Reroll that turns a Despair roll into a Hope one hands a point back, and
 * the only way to know which way it went is to remember what it was.
 */
const fearOf = new Map();
/** Enough for a long session's rolls; the oldest are forgotten first. */
const FEAR_KEPT = 300;

function keyOf(actorId, userId) {
    return `${actorId}|${userId}`;
}

function rememberFear(messageId, withFear) {
    fearOf.delete(messageId);
    fearOf.set(messageId, withFear);
    while (fearOf.size > FEAR_KEPT) fearOf.delete(fearOf.keys().next().value);
}

/** Every character a roll message speaks for - the reroll's own test (`belongsTo`). */
function actorIdsOf(message) {
    const ids = new Set();
    if (message.speaker?.actor) ids.add(message.speaker.actor);
    const source = message.system?.source?.actor;
    if (typeof source === "string" && source) {
        let id = null;
        try { id = fromUuidSync(source)?.id ?? null; } catch { id = null; }
        if (id) ids.add(id);
    }
    return [...ids];
}

function onCreateMessage(message) {
    if (!isPrimaryGm()) return;
    const roll = message.rolls?.[0];
    if (roll) rememberFear(message.id, Boolean(dualityOfRoll(roll).withFear));
}

function onUpdateMessage(message, changes, options, userId) {
    if (!isPrimaryGm()) return;
    if (!changes || !("rolls" in changes)) return;
    const roll = message.rolls?.[0];
    if (!roll) return;

    const nowFear = Boolean(dualityOfRoll(roll).withFear);
    const wasFear = fearOf.has(message.id) ? fearOf.get(message.id) : null;
    rememberFear(message.id, nowFear);

    // A GM needs no receipt, and only the message's own author rewrote it for
    // themselves - a GM editing a player's message is not that player's Reroll.
    const user = game.users.get(userId ?? "");
    if (!user || user.isGM) return;
    if ((message.author?.id ?? message.user?.id) !== user.id) return;

    for (const actorId of actorIdsOf(message)) {
        if (!ownsActor(user, actorId)) continue;
        receipts.set(keyOf(actorId, user.id), {
            messageId: message.id, at: Date.now(), wasFear, nowFear, used: new Set()
        });
        debug(`Reroll receipt: ${user.name} rewrote a roll of ${game.actors.get(actorId)?.name ?? actorId}.`);
    }
}

export function registerRerollReceipts() {
    Hooks.on("createChatMessage", onCreateMessage);
    Hooks.on("updateChatMessage", onUpdateMessage);
}

/**
 * Why a receipt does not pay for an undo of `kind`, or null when it does.
 * Pure, so the suite can hold it to its rules with a receipt it made up.
 *
 * @param {object|null} receipt  As stored above.
 * @param {object} [options]
 * @param {string} [options.kind]  What is being undone; each is paid for once.
 * @param {number} [options.now]
 * @param {number} [options.windowMs]
 * @returns {string|null}
 */
export function rerollReceiptRefusal(receipt, { kind = null, now = Date.now(),
    windowMs = TIMING.rerollReceiptMs } = {}) {
    if (!receipt) return "no Reroll of that character by the sender";
    if (!(now - receipt.at <= windowMs)) return "the sender's last Reroll of that character is too old";
    if (kind && receipt.used?.has(kind)) return `that Reroll has already undone one "${kind}"`;
    return null;
}

/**
 * The Despair a receipt's Reroll moved, as `settleDespair` in reroll.mjs moves
 * it: +1 when the roll became a Despair roll, -1 when it stopped being one, 0
 * when the duality did not change. A roll the GM did not see created (a GM who
 * loaded after it) is taken to have changed, which leaves only the sign to
 * check - the new roll still says which way it went.
 */
export function receiptDespairDelta(receipt) {
    if (!receipt) return 0;
    if (receipt.wasFear === receipt.nowFear) return 0;
    return receipt.nowFear ? 1 : -1;
}

/** The receipt standing for this character and this user, if any. */
export function rerollReceiptFor(actorId, userId) {
    return receipts.get(keyOf(actorId, userId)) ?? null;
}

/**
 * Spend one undo of `kind` from the receipt for `actorId` and `userId`.
 *
 * Returns why it was refused, or null when the undo is paid for - in which case
 * that kind is used up. Waits once, briefly, for a receipt that is not there
 * yet: the rewrite of the message and the undo are two messages to this
 * client, and the order they are handled in has not been measured at a table.
 *
 * @param {string} actorId
 * @param {string} userId
 * @param {string} kind
 * @param {(receipt: object) => string|null} [check]  One more question about the
 *   receipt before it is spent - the Despair a Reroll moved, for one.
 * @returns {Promise<string|null>}
 */
export async function spendRerollReceipt(actorId, userId, kind, check = null) {
    let why = rerollReceiptRefusal(rerollReceiptFor(actorId, userId), { kind });
    if (why && !rerollReceiptFor(actorId, userId)) {
        await pause(TIMING.rerollReceiptRetryMs);
        why = rerollReceiptRefusal(rerollReceiptFor(actorId, userId), { kind });
    }
    if (why) return why;
    const receipt = rerollReceiptFor(actorId, userId);
    const also = check ? check(receipt) : null;
    if (also) return also;
    receipt.used.add(kind);
    return null;
}
