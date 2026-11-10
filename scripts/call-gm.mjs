/**
 * Danganronpa RPG - the GM's cards.
 * ---------------------------------------------------------------------------
 * A call on the GM and the cards the GMs rule on: `callGm` with the card's
 * words (`callCardHtml`, `expiresHtml`) and its thread (`threadOf`), the
 * claims on a card (`claimOnPrimary`, `claimsInProgress`, `releaseClaimsOf`)
 * and its settle (`settleCall`), the request window a call opens with
 * (`askForRequest`, `promptForRequest`, `promptAndCallGm`), and the
 * ask-by-card machinery that asks nothing of the bridge's table: the asks
 * the primary holds and the cards they were put on (`holdAsk`, `askMark`,
 * `cardOfAsk`), a card ended at its time (`endAtExpiry`, `expireAskCard`,
 * `sweepAskCards`), the cards of a Call, a Dynamic action, a trait ruling
 * and an Observe (`askHopeCallByCard`, `askDynamicByCard`, `askTraitByCard`,
 * `askObserveByCard`), and a ruling sent on, received or expired on the
 * primary (`keepRuling`, `receivedOnPrimary`, `expiredOnPrimary`).
 *
 * WHERE IT SITS. Moved out of gm-bridge.mjs by E41 C5 (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. gm-bridge.mjs
 * re-exports the ten names of this file it exported, so every importer
 * still imports gm-bridge.mjs; fifteen more are exported now because the
 * bridge's table, runs and asks read them (in gm-bridge.mjs at C5; in
 * bridge-table.mjs, the two runs files and bridge-asks.mjs since C5a and C5b),
 * and gm-bridge.mjs does not re-export those. C5a added the ask cards' four
 * primary-side senders, three of them exported for the runs and the asks. Nothing here imports gm-bridge.mjs
 * (the facade rule, .claude/rules/code.md). `CALL_GM_WHAT` stands above the
 * first function so that no function's cut runs on into it (the bridge's
 * crawl reads `receivedOnPrimary`'s, which it followed in gm-bridge.mjs).
 */

import { MODULE_ID, TRAITS, HOPE_CALLS, TIMING } from "./config.mjs";
import {
    whisperToGms, ownerOf, isPrimaryGm, debug, warn, error, esc, serverNow, localeFormat
} from "./utils.mjs";
import { forgetCallYes, sayNotDone, gmOnline, noteCallYes } from "./bridge-guards.mjs";
import { contentOf, cardFlag, cardMeta } from "./secret.mjs";
import { SOCKET_EVENT, ACTION_DONE } from "./bridge-wire.mjs";
import { drpgWindow } from "./ui-kit.mjs";

/** The request a call on the GM names when its caller names none (`DRPG.Bridge.what.gm.call`). */
export const CALL_GM_WHAT = "gm.call";

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
export const callAsks = new Map();
export const CALL_ASKS_KEPT = 100;

/**
 * The Dynamic actions' asks this primary put on a card, by request (E18 C1): who asked, for which
 * character, and the card - what a GM's ruling is sent on for (`dynamicOnPrimary`). The oldest go first.
 */
export const dynamicAsks = new Map();

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

export async function askHopeCallByCard(payload, ctx) {
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

export async function askDynamicByCard(payload, ctx) {
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
 * Since E68 C1 (DA18) a packet may carry the player's proposal and a note of how: the card
 * then says both and offers "Approve: {stat}", "Change to: {stat}" for each other listed
 * statistic, and Refuse (trait-ruling.mjs `proposalChoices`); the note is quoted as the
 * player's words. The guard has refused a proposal off the list; one that is not read
 * again here as the answer - the button's trait is, and `rulePickTrait` holds it to the list.
 * Since E68 C2 a proposal the valve approves (trait-ruling.mjs `autoApprovable`) is pressed
 * here, as soon as the card is up, by the click's road (messenger-app.mjs `pressCard`).
 */
export async function askTraitByCard(payload, ctx) {
    if (!ctx.requestId) return { later: true };
    const { listedTraits, rulingLabel, proposalOf, proposalChoices, autoApprovable } = await import("./trait-ruling.mjs");
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
    const keep = holdAsk(traitAsks, ctx.requestId, held, expires);
    const actor = game.actors.get(payload.actorId ?? "");
    const { proposed, note } = proposalOf({ proposed: payload.proposed, note: payload.note }, listed);
    const auto = Boolean(proposed) && (await autoApprovable(spec));
    const onPosted = message => {
        keep(message);
        if (!auto || !message?.id) return;
        import("./messenger-app.mjs").then(({ pressCard }) => pressCard(message, "pickTrait", { ...data(proposed), auto: "1" }))
            .catch(err => warn("The valve could not approve the proposal on its card.", err));
    };
    const data = trait => ({
        rid: ctx.requestId, asker: ctx.asker, by: payload.actorId ?? "", kind: spec.kind, key: spec.key,
        variant: spec.variant ?? "", ...(trait ? { trait } : {}), ...(proposed ? { proposed } : {})
    });
    const said = proposed ? `<br>${esc(game.i18n.format("DRPG.TraitRuling.proposed", { stat: TRAITS[proposed]?.label ?? proposed }))}` : "";
    const posted = await callGm(actor, {
        title: game.i18n.localize("DRPG.TraitRuling.title"),
        body: `<strong>${esc(rulingLabel(spec))}</strong> · ${esc(game.i18n.format("DRPG.Action.usesTrait", {
            traits: listed.map(t => TRAITS[t]?.label ?? t).join(" / ") }))}${said}`,
        request: note,
        gmBody: game.i18n.localize(proposed ? "DRPG.TraitRuling.gmBodyProposed" : "DRPG.TraitRuling.gmBody"),
        actions: [
            ...proposalChoices(actor, listed, proposed).map(({ trait, label }) => ({ action: "pickTrait", label, data: data(trait) })),
            { action: "refuseTrait", label: game.i18n.localize(proposed ? "DRPG.TraitRuling.refuse" : "DRPG.Action.dynamicRefuse"), data: data(null) }
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
export const observeAsks = new Map();

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
export async function observePickOnPrimary({ rid, actorId, tokenId = null, refuse = false }, by) {
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
            return { value: "notThere", told: "DRPG.Observe.pickNotThere", held: picked.held ?? [] };
        }
        answer({ ok: true, key: picked.key });
        return { value: "picked", told: null };
    } finally {
        asked.answering = false;
    }
}

/**
 * A GM's yes to a Call's ask, on the primary (E29 fix r2-H4): kept for the ask this primary holds
 * under that request (bridge-guards.mjs `noteCallYes`), then sent to the player who asked, once.
 * False for an ask it does not hold - one already answered yes, or one a primary that has gone put
 * up (the player's browser gives up on it at its clock and nothing is spent; it asks again) - and
 * for a yes pressed on another card than the one the ask is held on (fix early-C2-G2).
 */
export async function yesOnPrimary(requestId, asker, by = game.user.id, messageId = null) {
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
 * A GM's ruling on a Dynamic action's card, on the primary (E18 C1): sent on for the ask it holds under that request,
 * by that user, pressed on the card that ask is held on (fix early-C2-G2) - a difficulty only once it is kept on the
 * card (`keepRuling`).
 */
export async function dynamicOnPrimary(requestId, asker, ruling, by, messageId = null) {
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
export async function keepRuling(messageId, ruling, sentOn = null, { quiet = false } = {}) {
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
export const answeredAsks = new Map();

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
export async function unreceivedOnPrimary(requestId) {
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
export async function expiredOnPrimary(requestId, senderId) {
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
    // An open Frisk's ask, held by its request id and its asker in frisk.mjs's memory, not on a card (E18 C7).
    const { expireFriskAsk } = await import("./frisk.mjs");
    return expireFriskAsk(requestId, senderId);
}

/**
 * The ruling reached its asker (`ruling.received`, E18 C1): its card is written as ruled - a Dynamic
 * difficulty is in its meta since it was sent on (`keepRuling`). A receipt for an ask this primary still
 * holds is a ruling another GM sent straight to its asker (a Call's no, `answerHopeCall`): that ask is
 * over, and a yes after it is not kept. False for anything else - another user's receipt, or one for
 * nothing sent: nothing is done.
 */
export async function receivedOnPrimary(requestId, senderId) {
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

/* ==========================================================================
 * CALLING THE GM
 * ========================================================================== */

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
    // In the posting GM's module language (utils.mjs `localeFormat`, E66 C1), until each reader writes its own.
    const time = localeFormat("time", expires, { hour: "2-digit", minute: "2-digit" });
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
     * question; the watched trap's receipt was the one caller (projects.mjs `announceTrapReady`), and since E51 C1 a
     * Dynamic miss's card is another (action-dynamic.mjs `offerDynamicFind`).
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
export const claimsInProgress = new Map();

/**
 * A GM who left holds nothing: their claims end as a backed-out ruling's do - in memory, and, on the primary, the
 * rows that say a claim is under way (fix e1-G1).
 */
export function releaseClaimsOf(userId) {
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

/*
 * SAID THROUGH THE ONE FUNNEL (E18 fix e1-G3, 24.10.2026; the end review's E18-END-4 and F11). Amend 1 sends the stage's
 * new cards - a settlement, a timeout, a refusal - through `showPopup` or `sayNotDone`, and three were Foundry toasts:
 * the claim's refusals (`claimCard`: "{gm} already ruled on this card.", "{gm} is ruling on this card right now.", "This
 * card has already been answered.") and the empty request's (`askForRequest`). A toast fades in seconds and is kept
 * nowhere, so a GM who looked away could not find why a click did nothing. Each is a refusal card now, kept in this
 * browser's history as a request not carried out is (source `notDone`); R472 has its row, R838 and tier 2's C3 test read it.
 */
export function sayRefusedHere(text) {
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
    for (;;) {
        // On the kit's frame (E21 C5a): Send is the GM's road (D11) - the words go to a GM's card - and Cancel withdraws.
        const answer = await drpgWindow({
            classes: ["drpg-panel"],
            // An action's declaration in the player's own words, which the action waits on: kept above the sheet
            // (stacking.mjs; E23 fix G3, the owner's Q-E23-5, R1404).
            prompt: true,
            title,
            body: `${intro}<form>
                    <p>${prompt}</p>
                    <textarea name="request" rows="3" placeholder="${foundry.utils.escapeHTML(placeholder)}"></textarea>
                  </form>`,
            footer: {
                gmRoute: [{
                    action: "send",
                    label: game.i18n.localize("DRPG.Bridge.send"),
                    callback: (event, button, dialog) => ({ text: dialog.element.querySelector("[name=request]").value.trim() })
                }],
                close: "cancel"
            },
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
