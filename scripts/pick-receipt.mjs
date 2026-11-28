/**
 * Danganronpa RPG - a statistic's pick and its asker's receipt (2.0 line T2, CALLS-05, 28.11.2026).
 * ---------------------------------------------------------------------------
 * The primary's half of a pick's line: the card's words with an unconfirmed pick written as answered
 * (`confirmedPickHtml`), the asker's receipt for it (`pickReceived`, from call-gm.mjs `receivedOnPrimary`) and a
 * card's words stored after a receipt that came first (`pickWordsStored`, from gm-bridge.mjs's `drpgSecretStored`
 * hook). The pick's own line is messenger-app.mjs `rulePickTrait`'s.
 *
 * WHERE IT SITS. A file of its own and not part of call-gm.mjs, which it would have put past the split's 1500 lines
 * (tools/check.mjs `lengths`: 1539 measured with it there, 28.11.2026); no facade re-exports it. It imports neither
 * call-gm.mjs nor gm-bridge.mjs; call-gm.mjs reaches it by `import()`.
 */

import { MODULE_ID, TIMING } from "./config.mjs";
import { debug } from "./utils.mjs";
import { contentOf, cardFlag } from "./secret.mjs";

/*
 * A STATISTIC'S PICK IS NOT CONFIRMED UNTIL ITS ASKER SAYS IT ARRIVED (2.0 line T2, CALLS-05, 28.11.2026; F1-calls
 * CALLS-05). A pick goes from the GM who pressed it straight to its asker (bridge-asks.mjs `answerTraitRuling`), not by
 * the primary, and its card said "Answered by {name}." at once - also when the asker's browser was no longer waiting (a
 * reload) and nothing arrived - while a Call's yes and a Dynamic difficulty wait for their receipt (call-gm.mjs
 * `sendOnFromPrimary`). The pick's line is "Answered by {name}, but nothing confirms that the answer arrived." now
 * (messenger-app.mjs `rulePickTrait`, by key), and the asker's receipt - its browser sends `ruling.received` to the GMs
 * for a statistic as for the others, and the primary reads it against the statistic's ask it holds for that asker
 * (call-gm.mjs `receivedOnPrimary`) - has it written "Answered by {name}." here, the name kept. The receipt and the line
 * come from two browsers, the player's and the pressing GM's, which writes its line after the answer has left, so either
 * can reach the primary first: a receipt for a card whose line is not here yet is kept (`pickReceipts`), and the line is
 * written when the card's words are stored here (`pickWordsStored`, on gm-bridge.mjs's `drpgSecretStored` hook) within
 * `TIMING.ackMs`, the receipt's own wait on the other road - chosen, not measured for this one. A card settled with any
 * other line (a Refuse, "Approved automatically.") keeps no receipt. With no receipt the line stays: whether the pick
 * arrived is not known. R9033 and tier 2's E132 CALLS-05 read it.
 */
const pickReceipts = new Map();
const RECEIPTS_KEPT = 100; // call-gm.mjs's `CALL_ASKS_KEPT`: as many as the asks a primary holds.

/** The card's words with a statistic's unconfirmed pick written as answered - the line for everyone, not a GMs' note -
    or null when they carry no such line. */
export function confirmedPickHtml(html) {
    const wrap = document.createElement("template");
    wrap.innerHTML = String(html ?? "");
    const line = [...wrap.content.querySelectorAll('.drpg-call-settled[data-drpg-line="DRPG.Bridge.settledUnconfirmed"]')]
        .find(el => !el.closest(".drpg-gm-only"));
    if (!line) return null;
    line.dataset.drpgLine = "DRPG.Bridge.settledAnswered";
    line.textContent = game.i18n.format("DRPG.Bridge.settledAnswered", { name: line.dataset.drpgName ?? "?" });
    return wrap.innerHTML;
}

/** A card's new words, written as `settleCall` writes them: a private card's by the road its words took. */
async function writeCardWords(message, html) {
    if (!game.user.isGM) return null;
    if (!message.getFlag(MODULE_ID, "secret")) return message.update({ content: html });
    const { updateSecret } = await import("./secret.mjs");
    return updateSecret(message, html);
}

/** The asker's receipt for a statistic's pick, on the primary (above): its line written as answered now (true), or
    the receipt kept for its line when the card is not settled here yet (false). `message`, `write` and `now` are a
    test's (R9033). */
export async function pickReceived(messageId, {
    message = game.messages?.get(messageId ?? ""), write = writeCardWords, now = Date.now() } = {}) {
    if (!messageId || !message) return false;
    const html = confirmedPickHtml(contentOf(message));
    if (html) {
        pickReceipts.delete(messageId);
        await write(message, html);
        return true;
    }
    const { MESSENGER_FLAGS } = await import("./messenger.mjs");
    if (cardFlag(message, MESSENGER_FLAGS.settled)) return false;
    pickReceipts.set(messageId, now);
    while (pickReceipts.size > RECEIPTS_KEPT) pickReceipts.delete(pickReceipts.keys().next().value);
    return false;
}

/** A card's words stored here (gm-bridge.mjs's `drpgSecretStored`, the primary's): a receipt kept for it writes its
    unconfirmed pick as answered, once, within `TIMING.ackMs`. True when the write was started. */
export function pickWordsStored(message, { write = writeCardWords, now = Date.now() } = {}) {
    const at = pickReceipts.get(message?.id ?? "");
    if (at === undefined) return false;
    if (now - at > TIMING.ackMs) {
        pickReceipts.delete(message.id);
        return false;
    }
    const html = confirmedPickHtml(contentOf(message));
    if (!html) return false;
    pickReceipts.delete(message.id);
    Promise.resolve(write(message, html)).catch(err => debug("A statistic's pick could not be written as answered", err));
    return true;
}
