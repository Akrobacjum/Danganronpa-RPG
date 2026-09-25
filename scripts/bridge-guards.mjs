/**
 * Danganronpa RPG - who is asking the GM's client, and whether a GM is there to ask.
 * ---------------------------------------------------------------------------
 * THE LEAF THE BRIDGE STANDS ON (E31, 25.09.2026; audit S17-08, S01-64).
 *
 * Every road from a player's client to the primary GM - the bridge in
 * gm-bridge.mjs, the trap relay in traps.mjs, the search tokens in
 * search-tokens.mjs, Daggerheart's relay in relay-guard.mjs - asks the same two
 * questions first: who sent this, according to Foundry, and does that user own
 * the character the packet names. The two answers lived in gm-bridge.mjs, so a
 * file that wanted only `ownsActor` loaded the whole bridge for it -
 * reroll-receipts.mjs and search-tokens.mjs statically, traps.mjs late, to keep
 * its own import graph clear - and "is a GM connected" was written out four
 * times beside `activeGmIds` in utils.mjs: `gmOnline` in gm-bridge.mjs, twice
 * inline in search-tokens.mjs and once in diagnostics.mjs (measured 25.09.2026).
 *
 * So they live here, in a file that imports config.mjs and utils.mjs and
 * nothing else. Neither of those imports this file, nor does anything they
 * import, so any module can take these names statically without closing a
 * cycle in the static import graph (114 files and no cycle on 24.09.2026,
 * before this file). R161 holds that shape: the names defined here and nowhere
 * else, the predicate spelt only in `activeGmIds`, nothing importing them from
 * gm-bridge.mjs, and no cycle anywhere in what Foundry serves.
 */

import { MODULE_ID, HOPE_CALLS, DESPAIR_CALLS, STARTING, TIMING } from "./config.mjs";
import { activeGmIds, warn, pause } from "./utils.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
/** GM -> player: "your request arrived and was refused" - see `refuse`. */
const ACTION_REFUSED = "bridge.refused";

/* ==========================================================================
 * WHO ASKED
 * ========================================================================== */

/**
 * Who sent this, according to Foundry rather than according to the packet.
 *
 * Every request a player sends arrives as a plain socket message, and the
 * primary GM used to act on all of them without asking who sent it: anyone with
 * a console could adjust a Despair pool, push progress onto somebody else's
 * project, or teleport a token. This and `ownsActor` are the first defence of
 * every road to the GM: the sender has to be a real, connected user, and
 * anything scoped to an actor has to be an actor that sender owns.
 *
 * This used to read `payload.userId` - a field the sender writes about itself.
 * Every guard is built on the answer, so trusting the claim meant a player could
 * put any other user's id in the field and act as them: take a crisis action
 * with somebody else's character, spend their project progress, empty their
 * stash. The real id is Foundry's own second argument to a socket handler and
 * cannot be set by the sender - see `handleCustomSocket` in the server's
 * `sockets.mjs`, which stamps `this.user.id` on every delivery.
 */
export function senderOf(senderId) {
    const user = game.users.get(senderId ?? "");
    return user?.active ? user : null;
}

/** Does this user own that character? A GM owns every one; nobody owns a missing one. */
export function ownsActor(user, actorId) {
    if (!user || !actorId) return false;
    if (user.isGM) return true;
    return Boolean(game.actors.get(actorId)?.testUserPermission(user, "OWNER"));
}

/**
 * Is a GM connected right now? The question alone, no toast (audit A16): a tile
 * deciding whether to dim asks this, and a request that needs an answer says so
 * out loud when the answer is no.
 *
 * `activeGmIds` is the one spelling of "a GM who is connected" in the module;
 * this was a second copy of it (`game.users.some(...)`), and search-tokens.mjs
 * and diagnostics.mjs had two more (S01-64).
 */
export function gmOnline() {
    return activeGmIds().length > 0;
}

/* ==========================================================================
 * REFUSING
 * ========================================================================== */

/*
 * THE GUARDS, ONE SIGNATURE EACH (E03, 24.09.2026; the plan's patch to E03).
 *
 * Every check E03 added to a bridge handler is a small function,
 * `guard<Name>(sender, payload, ctx)`, that answers null to let the request
 * through or the reason, as a string, to refuse it - the string `refuse` logs,
 * which 30-security reads back through `sessionFailures()` and matches (the
 * suite checks only that the helpers behind the guards refuse or pass, never
 * their wording), and a handler asks them through `firstRefusal`, below. One
 * signature so that stage E31 could lift them as they stood into this file,
 * below, next to the questions every handler opens with: a guard that leaned on
 * something its handler had worked out first could not have been lifted. So each looks up what it needs itself (the actor, the
 * token) and puts nothing on `ctx`, and each says for itself whom it is asked
 * of - a player, an undo, progress taken back.
 *
 * A handler asks its guards in the order written where it asks them, and that
 * is the order the checks ran in before they were split out. The order is part
 * of the rule, not a layout: some guards rely on the checks before them having
 * passed (a token that exists, a Call that is a Hope Call). Guards change
 * nothing, with one exception - a guard named `...Receipt` spends a Reroll
 * receipt, and it is the last guard its handler asks. What a handler still
 * checks after its guards - the two older checks in `handleDespair` (the size
 * of the step, the pool it names), the resolvers' own refusals - can refuse an
 * undo already paid for, as it could before the split. The checks each handler
 * opens with (the sender, ownership, sight of the project) are still written
 * in the handler - older than E03, but for the one unknown-sender line E03 gave
 * `handleRemnant`, which is the same line every other handler opens with.
 */

/** Ask each guard in turn: the first reason given, or null when every one passes. */
export async function firstRefusal(sender, payload, ctx, ...guards) {
    for (const guard of guards) {
        const why = await guard(sender, payload, ctx);
        if (why) return why;
    }
    return null;
}

/**
 * Refuse loudly in the log rather than silently doing the wrong thing - and
 * tell the asker (COMM-16).
 *
 * The acknowledgement leaves before any guard runs, so a request this side
 * then refuses used to be acknowledged to the player and dropped: a roll that
 * reported success and a world that did not change, which is the exact
 * symptom the ack was added to remove. One addressed packet closes it.
 *
 * The English line is the GM's record, and 30-security reads it back through
 * `sessionFailures()`: `Refused a "<action>" request over the socket from
 * <name>: <why>.`
 */
export function refuse(action, why, ctx = null) {
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

/* ==========================================================================
 * THE GUARDS E03 WROTE, LIFTED HERE AS THEY STOOD (E31, 25.09.2026)
 * --------------------------------------------------------------------------
 * Moved from gm-bridge.mjs (29, with `armBuyerId` and `removalRefusal`) and
 * traps.mjs (2) with the same names, signatures and bodies, in the order their
 * handlers ask them. `guardRelayRoom` now takes `standsIn` and `RELAYED_ROOM`
 * from traps.mjs late, as every other guard already took what it needed; that
 * one line is the only change to a body. gm-bridge.mjs re-exports
 * `removalRefusal`, which the suite's R148 imports from there.
 * ========================================================================== */

/** An Observe taken back is a Reroll's, and is paid for by the receipt of one (E03). Spends it. */
export async function guardObserveReceipt(sender, payload, ctx) {
    if (!payload.undo || sender.isGM) return null;
    const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
    return spendRerollReceipt(payload.actorId, sender.id, "observe");
}

/** An Analyze taken back is a Reroll's, and is paid for by the receipt of one (E03). Spends it. */
export async function guardAnalyzeReceipt(sender, payload, ctx) {
    if (!payload.undo || sender.isGM) return null;
    const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
    return spendRerollReceipt(payload.actorId, sender.id, "analyze");
}

/*
 * JUDGED AGAIN HERE (E03, 24.09.2026; audit S04-09). The stage, the side,
 * the turn, the locks and what the character has left to spend were all
 * checked on the player's own client and never here, so a console could
 * throw a finishing blow out of turn, and a packet that arrived after the
 * GM had moved the incident on still applied. An undo is a Reroll's, and
 * is paid for by the receipt of one; `undoLastCrisis` then checks that the
 * action it rewinds was this character's.
 *
 * Three guards, all a player's: a fresh action is judged by `crisisRefusal`
 * (this one), an undo by `crisisUndoRefusal` and then paid for. A packet is one
 * or the other, so of the three a packet meets the one or the two it met before.
 */
export async function guardCrisisAction(sender, payload, ctx) {
    if (sender.isGM || payload.undo) return null;
    const { crisisRefusal } = await import("./murder.mjs");
    const actor = game.actors.get(payload.actorId);
    return crisisRefusal(actor, payload.key)?.why ?? null;
}

/** Judged as the action was taken, not as it left things - see `crisisUndoRefusal`. */
export async function guardCrisisUndo(sender, payload, ctx) {
    if (sender.isGM || !payload.undo) return null;
    const { crisisUndoRefusal } = await import("./murder.mjs");
    return crisisUndoRefusal(game.actors.get(payload.actorId), payload.key);
}

/** The undo's price: a Reroll receipt for this character. Spends it. */
export async function guardCrisisReceipt(sender, payload, ctx) {
    if (sender.isGM || !payload.undo) return null;
    const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
    return spendRerollReceipt(payload.actorId, sender.id, "crisis");
}

/** A clean-up taken back is a Reroll's, and is paid for by the receipt of one (E03). Spends it. */
export async function guardCleanupReceipt(sender, payload, ctx) {
    if (!payload.undo || sender.isGM) return null;
    const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
    return spendRerollReceipt(payload.actorId, sender.id, "cleanup");
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
export function guardProgressOwner(sender, payload, ctx) {
    const takenBack = Math.trunc(Number(payload.amount)) < 0;
    if (sender.isGM || !takenBack) return null;
    return ownsActor(sender, payload.actorId) ? null : "progress taken back without the sender's own character";
}

/** And the Reroll that pays for it. Spends the receipt. */
export async function guardProgressReceipt(sender, payload, ctx) {
    const takenBack = Math.trunc(Number(payload.amount)) < 0;
    if (sender.isGM || !takenBack) return null;
    const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
    return spendRerollReceipt(payload.actorId, sender.id, "progress");
}

/*
 * Only a secret project has anybody to let in, and only a player can be let
 * in (E03; audit S09-02) - see `shareWith`. Asked of a GM's share too, as the
 * two checks were before they were split out.
 */
export async function guardShareSecret(sender, payload, ctx) {
    const { isSecret } = await import("./projects.mjs");
    return isSecret(payload.countdownId) ? null : "that project is not secret";
}

export function guardShareGuest(sender, payload, ctx) {
    const guest = game.users.get(payload.targetUserId ?? "");
    return !guest || guest.isGM ? "the project can only be shared with a player" : null;
}

/*
 * ONLY THE ONE HOLDING THE OBJECT (E01, 24.09.2026; audit S14-03). Tying a trace
 * to the crime is a verdict on evidence - the trace becomes an Incident trace the
 * chapter-end sweep will not clear - and this took any identity from any player.
 * The one honest sender is the killer's client at the moment they swing the
 * object (murder.mjs), before the crisis packet that could use it up, so the
 * object is still in one of the sender's own characters' hands when this runs.
 *
 * AND ONLY DURING THE FIGHT, BY SOMEBODY IN IT (E03; audit S10-11). Holding
 * the object is not enough: a player could tie their own Search's traces to
 * the crime a week before any murder, and those would then survive the
 * sweep and top the dashboard. The honest sender swings the object inside
 * a crisis action, so the incident is at its incident stage and the holder
 * is one of its participants - the victim included, whose Self-defence and
 * Role reversal swing a weapon too.
 */
export async function guardTieTraceHolder(sender, payload, ctx) {
    const identity = payload.identity;
    const { murderState, participantIds } = await import("./murder.mjs");
    const state = murderState();
    const cast = state?.stage === "incident" ? new Set(participantIds(state)) : new Set();
    const holds = Boolean(identity) && game.actors.some(actor =>
        cast.has(actor.id)
        && ownsActor(sender, actor.id)
        && actor.items.some(item => item.getFlag(MODULE_ID, "drpgItemId") === identity));
    return holds ? null : "no participant of the running incident the sender plays holds that object";
}

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
 *
 * Whether a Reroll can reach the trace is asked inside the spend, as the
 * receipt's own last question (`removalRefusal`), so this guard spends the
 * receipt only for a trace it may touch. Asked after the handler's check that
 * the sender left the trace, which the token read below relies on.
 */
export async function guardRemnantEditReceipt(sender, payload, ctx) {
    if (sender.isGM) return null;
    const scene = game.scenes.get(payload.sceneId) ?? canvas?.scene;
    const token = scene?.tokens?.get(payload.tokenId);
    const { remnantData, remnantGmEdited } = await import("./remnants.mjs");
    const source = remnantData(token)?.sourceActor ?? null;
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
    return spendRerollReceipt(source, sender.id, "remnant", () => reach);
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

/*
 * THE PAIR, THE CHARACTER AND THE REROLL (E03, 24.09.2026; audit S10-03,
 * S09-02). This checked that the sender could see the target and nothing
 * else, and `undoSabotage` then deleted whatever project id arrived as the
 * "repair": one packet naming any public project and a secret murder plan's
 * id deleted the plan, its token and its trap. The only honest sender is a
 * Reroll taking back its own sabotage, so the pair has to be the one the
 * sabotage wrote (`unsabotageRefusal`, this guard), the character has to be
 * the sender's, and a Reroll of that character's roll has to have happened -
 * the three guards below, in that order, all a player's.
 */
export async function guardUnsabotagePair(sender, payload, ctx) {
    if (sender.isGM) return null;
    const { unsabotageRefusal } = await import("./projects.mjs");
    return unsabotageRefusal({
        targetId: payload.targetId ?? null, repairId: payload.repairId ?? null, senderId: sender.id
    });
}

export function guardUnsabotageOwner(sender, payload, ctx) {
    if (sender.isGM) return null;
    return ownsActor(sender, payload.actorId) ? null : "sender does not own that character";
}

/** Spends the receipt. */
export async function guardUnsabotageReceipt(sender, payload, ctx) {
    if (sender.isGM) return null;
    const { spendRerollReceipt } = await import("./reroll-receipts.mjs");
    return spendRerollReceipt(payload.actorId, sender.id, "sabotage");
}

/*
 * BACK, AND ONLY BACK (E03, 24.09.2026; audit S10-40). The whole packet's
 * `position` went into `token.update` with the flag that says "this is our
 * own revert, charge nothing" - any x, y and elevation, and anything else a
 * token has. Now the fields are read out by name (in the handler), and the
 * place has to be one the token was moved from in the last minute, as this
 * client saw it (here). The move and the request are two messages; the first
 * is given a moment - the one retry is this guard's own, so it stays in here.
 * Asked after the handler's ownership check, which the token read relies on.
 */
export async function guardSendbackPlace(sender, payload, ctx) {
    const scene = game.scenes.get(payload.sceneId);
    const token = scene?.tokens?.get(payload.tokenId);
    const { recentPositions, roomsVisited, positionIn, sendBackRefusal } = await import("./movement.mjs");
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
    return why;
}

/** Who pays for a Call armed through the bridge: `call.from`, else the character it is armed on. */
export function armBuyerId(payload) {
    return payload.call?.from ?? payload.actorId;
}

/** Refused out loud: the asker now waits for an answer (E03). Asked before the sender is, as it was. */
export function guardArmCharacter(sender, payload, ctx) {
    return game.actors.get(payload.actorId) ? null : "no such character";
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
 * aimed at another player (`playerArmRefusal`, this guard), and the Hope for
 * it is now taken HERE, from the buyer's sheet as this client sees it, after
 * every check and before the Call is armed (`armPaidByPlayer`). The whisper's
 * voice comes from the table the key was found in, never from the packet.
 */
export async function guardArmPlayerCall(sender, payload, ctx) {
    if (sender.isGM) return null;
    const { playerArmRefusal } = await import("./call-effects.mjs");
    return playerArmRefusal(payload.call);
}

/*
 * A GM's own road (a Monokuma arming from another GM's client): any Call the
 * rules define, as long as `grants` is the one that Call buys. Asked of every
 * packet, because on a player's it can refuse nothing: it comes after
 * `guardArmPlayerCall`, which passes only a Hope Call whose `grants` match.
 */
export function guardArmCallGrants(sender, payload, ctx) {
    const call = HOPE_CALLS[payload.call?.key] ?? DESPAIR_CALLS[payload.call?.key];
    if (!call || call.grants !== payload.call?.grants) {
        return `"${payload.call?.key}" does not grant "${payload.call?.grants}"`;
    }
    return null;
}

/** A second copy of a Call that adds nothing is refused before anything is paid (CALL-02). Both roads. */
export async function guardArmNotHeld(sender, payload, ctx) {
    const actor = game.actors.get(payload.actorId);
    const call = HOPE_CALLS[payload.call?.key] ?? DESPAIR_CALLS[payload.call?.key];
    const { alreadyArmed } = await import("./call-effects.mjs");
    return alreadyArmed(actor, call) ? `${actor.name} already holds that Call` : null;
}

/** A player's road: the paying character has to exist. */
export function guardArmBuyer(sender, payload, ctx) {
    if (sender.isGM) return null;
    return game.actors.get(armBuyerId(payload)) ? null : "the paying character does not exist";
}

/** And be somebody other than the character the Call is armed on. */
export function guardArmOtherCharacter(sender, payload, ctx) {
    if (sender.isGM) return null;
    const buyer = game.actors.get(armBuyerId(payload));
    return buyer && buyer.id === game.actors.get(payload.actorId)?.id
        ? "a Call for somebody else, aimed at the buyer" : null;
}

/** The buyer may spend a Hope Call now, for the reasons their own client would ask (`hopeCallRefusal`). */
export async function guardArmHopeCallAllowed(sender, payload, ctx) {
    if (sender.isGM) return null;
    const { hopeCallRefusal } = await import("./calls.mjs");
    const barred = await hopeCallRefusal(game.actors.get(armBuyerId(payload)));
    return barred ? `the buyer may not spend a Hope Call now (${barred})` : null;
}

/** And holds the Hope it costs, on the sheet as this client sees it. */
export async function guardArmBuyerHope(sender, payload, ctx) {
    if (sender.isGM) return null;
    const call = HOPE_CALLS[payload.call?.key];
    const { hopeHeld } = await import("./calls.mjs");
    const held = hopeHeld(game.actors.get(armBuyerId(payload)));
    return held < call.cost ? `the buyer holds ${held} Hope, the Call costs ${call.cost}` : null;
}

/*
 * A PLAYER'S POINT OF DESPAIR IS A REROLL'S, ON THEIR OWN MONOKUMA (E03,
 * 24.09.2026; audit S10-40, S02-42). This took ±1 for any pool from any
 * player, so a loop in the console emptied a Monokuma's pool before a
 * trial. The one honest sender is `settleDespair` in reroll.mjs, which moves
 * one point on the Monokuma assigned to the rerolling character, in the
 * direction the dice went. So: the sender's own character, that character's
 * Monokuma, a Reroll receipt for it, spent once, and the delta the rewritten
 * roll actually implies (`receiptDespairDelta`) - the three guards below, in
 * that order, all a player's. The second and third rely on the first: they
 * read the character it found.
 */
export function guardDespairOwner(sender, payload, ctx) {
    if (sender.isGM) return null;
    const actor = game.actors.get(payload.actorId ?? "");
    return ownsActor(sender, actor?.id) ? null : "sender does not own the rerolling character";
}

export async function guardDespairMonokuma(sender, payload, ctx) {
    if (sender.isGM) return null;
    const { monokumaFor } = await import("./assignments.mjs");
    return monokumaFor(game.actors.get(payload.actorId ?? ""))?.id === payload.targetUserId
        ? null : "that pool is not the rerolling character's Monokuma";
}

/**
 * The size of the correction: a player's is a Reroll's single point, a GM's own
 * routed here (DESP-12) any size up to a full pool.
 */
export function guardDespairDelta(sender, payload, ctx) {
    const delta = Math.trunc(Number(payload.delta));
    const cap = sender.isGM ? STARTING.despairMax : 1;
    return !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > cap
        ? `delta ${payload.delta} is out of range` : null;
}

/** Any pool holder (DESP-13): an Assistant GM granted a pool is a Monokuma too. */
export async function guardDespairPool(sender, payload, ctx) {
    const target = game.users.get(payload.targetUserId ?? "");
    const { monokumas } = await import("./despair.mjs");
    return target && monokumas().some(u => u.id === target.id) ? null : "target holds no Despair pool";
}

/** Spends the receipt, and only when the Reroll moved Despair by the point asked for. */
export async function guardDespairReceipt(sender, payload, ctx) {
    if (sender.isGM) return null;
    const actor = game.actors.get(payload.actorId ?? "");
    const { spendRerollReceipt, receiptDespairDelta } = await import("./reroll-receipts.mjs");
    const asked = Math.trunc(Number(payload.delta));
    return spendRerollReceipt(actor.id, sender.id, "despair", receipt => {
        const owed = receiptDespairDelta(receipt);
        return owed === asked ? null : `the Reroll moved Despair by ${owed}, not ${payload.delta}`;
    });
}

/** A relay is about the sender's own character, or it is refused - see the note above `relay` in traps.mjs. */
export async function guardRelayOwner(sender, payload, ctx) {
    return ownsActor(sender, payload.actorId) ? null : "not their character";
}

/*
 * THE ROOM IS WHERE THE CHARACTER IS, NOT WHERE THE PACKET SAYS (E03,
 * 24.09.2026; audit S08-08). A crossing, a rest and a stash hunt each
 * named their room in the packet, and the trap in that room went off -
 * so a player could set off any trap on the map from their own
 * bedroom, or walk through one and report being somewhere else. The
 * relay leaves after the move has landed, so the GM finds the character
 * where the packet says; if the GM has not seen the move yet, it is
 * given a moment, once (`standsIn`).
 *
 * A packet with no character never reaches this. `guardRelayOwner` refuses
 * one with no `actorId`, and a player's naming a character that does not
 * exist, as "not their character"; only a GM's naming a missing character gets
 * past it, and the handler drops that one silently (`if (!actor) return`). So a
 * missing one passes here rather than being given a reason of its own.
 */
export async function guardRelayRoom(sender, payload, ctx) {
    const { standsIn, RELAYED_ROOM } = await import("./traps.mjs");
    const actor = payload.actorId ? game.actors.get(payload.actorId) : null;
    const field = RELAYED_ROOM[payload.kind];
    const named = field ? payload[field] : undefined;
    if (!actor || named === undefined) return null;
    const there = await standsIn(actor, named, {
        passedThrough: field === "to", sceneId: sender?.viewedScene ?? null
    });
    return there ? null : `${actor.name} is not in "${named}"`;
}
