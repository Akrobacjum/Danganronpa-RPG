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

import { MODULE_ID } from "./config.mjs";
import { activeGmIds, warn } from "./utils.mjs";

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
 * signature because stage E31 lifts them as they stand into this file, next to
 * the questions every handler opens with, and a guard that leaned on something
 * its handler had worked out first could not be lifted without it. So each looks up what it needs itself (the actor, the
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
