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
 *
 * The rest of the bridge's plumbing came here with them (E31), for the same
 * reason - more than one file needs it: the guards E03 wrote, the parts of a
 * declaration and the runner that judges one (`judge`), the closed list of
 * reasons a refusal carries, and, on the asking side, the one wait for an
 * answer (`bridgeRequest`) and the one message when there is none.
 */

import { MODULE_ID, HOPE_CALLS, DESPAIR_CALLS, STARTING, TIMING } from "./config.mjs";
import { activeGmIds, isPrimaryGm, debug, warn, error, pause } from "./utils.mjs";

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
 * which 30-security reads back through `sessionFailures()` and matches. One
 * signature so that stage E31 could lift them as they stood into this file: a
 * guard that leaned on something its handler had worked out first could not
 * have been lifted. So each looks up what it needs itself (the actor, the
 * token) and puts nothing on `ctx`, and each says for itself whom it is asked
 * of - a player, an undo, progress taken back.
 *
 * SINCE E31 (25.09.2026) a declaration lists its guards and the runner, `judge`,
 * asks them through `firstRefusal`, in the order listed: the order its handler
 * asked them in, with the checks the handler opened with (the sender,
 * ownership, sight of the project) made by the factories further down and put
 * first, where the handler had them. The order is part of the rule, not a
 * layout: some guards rely on the checks before them having passed (a token
 * that exists, a Call that is a Hope Call). Guards change nothing, with one
 * exception - a guard named `...Receipt` spends a Reroll receipt, and it is the
 * last in its list (R1b, R134). What a run still checks after its guards - the
 * resolvers' own refusals - can refuse an undo already paid for, as it could
 * before the split. The wording of every reason is held to the closed list of
 * reasons below by R164; the suite had checked only that the helpers behind the
 * guards refuse or pass.
 */

/** Ask each guard in turn: the first reason given, or null when every one passes. */
export async function firstRefusal(sender, payload, ctx, ...guards) {
    for (const guard of guards) {
        const why = await guard(sender, payload, ctx);
        if (why) return why;
    }
    return null;
}

/*
 * WHY, IN THE PLAYER'S LANGUAGE (E31, 25.09.2026; audit S17-08).
 *
 * A refusal told the player only what was not done - "The GM's client refused
 * the “Hand over an item” request" - and why was in the GM's log, in English,
 * with the numbers and names it was worked out from. The packet carries a code
 * as well now, one of the closed list below, and the player's client says the
 * sentence that code names, in the player's own language
 * (`DRPG.Bridge.why.<code>`, through `sayNotDone`). The code is all that
 * travels: no text, no number, no name, so nothing the GM's side worked out
 * reaches a player who was refused it, and a packet cannot name a translation
 * key outside the list. A declaration may name the one code every refusal by
 * its guards is told with (`tell`); the GM's log keeps each guard's reason.
 *
 * The English reason stays the source of truth: every guard and run returns it
 * as before, the GM's log prints it, and `reasonOf` reads the code off it with
 * the patterns below - anchored, the first that matches wins. R164 reads every
 * reason the guards, the runs and the functions they hand the question to can
 * give, out of the source, and holds each to exactly one pattern; a text none
 * takes would be told as `refused`, with a debug line naming it. Four codes
 * have no pattern: `relay` (relay-guard.mjs tells its own), `refused` (the
 * fallback), and `noGm` and `noAnswer`, which only the asking player's client
 * can know.
 */
export const REASONS = Object.freeze([
    "unknownSender", "notYours", "gmOnly", "cannotSee", "missing", "badRequest", "outOfRange", "busy",
    "notOffered", "notSecret", "notAPlayer", "notHolding", "alreadyHeld", "notASupport", "hopeBarred",
    "notEnoughHope", "noReroll", "rerollSpent", "traceOutOfReach", "notInIncident", "notYourTurn",
    "actionLocked", "actionSpent", "actionBlocked", "nothingLeft", "movedOn", "notThatRepair",
    "notWhereItStood", "alreadyDone", "nothingToUndo", "cannotNow", "cannotFrame", "notThere",
    "relay", "failed", "refused", "noGm", "noAnswer"
]);

/** The English reasons each code takes, in the order they are tried. */
export const REASON_PATTERNS = Object.freeze([
    // First: a thrown error's own message follows the colon and could read like any reason below.
    ["failed", /^the handler failed: /],
    ["failed", /^the Call could not be armed$/],
    ["failed", /^the ruling card could not be posted$/],
    ["unknownSender", /^unknown sender$/],
    ["notYours", /^sender does not own /],
    ["notYours", /^sender did not leave that Remnant$/],
    ["notYours", /^progress taken back without the sender's own character$/],
    ["notYours", /^not their character$/],
    ["notYours", /^that Observe belongs to another character$/],
    ["notYours", /^that Observe was declared by somebody else$/],
    ["gmOnly", /^only a GM /],
    ["cannotSee", /^sender (?:may not|cannot) see that project$/],
    ["missing", /^no such character$/],
    ["missing", /^the paying character does not exist$/],
    ["missing", /^no such Observe$/],
    ["missing", /^no character left it$/],
    ["missing", /^no plant was handed out under that request$/],
    ["badRequest", /^that offer buys .+ pick\(s\), the packet carried .+$/],
    ["badRequest", /^a pick names something that is not an option$/],
    ["badRequest", /^a new experience has no name$/],
    ["badRequest", /^no such Level Up: /],
    ["badRequest", /^".*" does not grant ".*"$/],
    ["badRequest", /^".*" is not a visibility$/],
    ["badRequest", /^not an action for that side$/],
    ["badRequest", /^that pool is not the rerolling character's Monokuma$/],
    ["badRequest", /^target holds no Despair pool$/],
    ["badRequest", /^a GM asks for nothing here$/],
    ["badRequest", /^that plant was handed to somebody else$/],
    // Two patterns, not one with an optional group: R22 reads `range(` in a regex literal as a call.
    ["outOfRange", /^(?:amount|difficulty|delta) .+ is out of range$/],
    ["outOfRange", /^difficulty .+ is out of range \(.*\)$/],
    ["busy", /^.+ is already being written$/],
    ["notOffered", /^no Level Up is on offer /],
    ["notSecret", /^that project is not secret$/],
    ["notAPlayer", /^the project can only be shared with a player$/],
    ["notHolding", /^no participant of the running incident the sender plays holds that object$/],
    ["alreadyHeld", /^.+ already holds that Call$/],
    ["notASupport", /^".*" is not a Hope Call a player can buy for somebody else$/],
    ["notASupport", /^".*" is not aimed at another player$/],
    ["notASupport", /^a Call for somebody else, aimed at the buyer$/],
    ["hopeBarred", /^the buyer may not spend a Hope Call now \(.*\)$/],
    ["notEnoughHope", /^the buyer holds .+ Hope, the Call costs .+$/],
    ["noReroll", /^no Reroll of that character by the sender$/],
    ["noReroll", /^the sender's last Reroll of that character is too old$/],
    ["noReroll", /^the Reroll moved Despair by .+, not .+$/],
    ["rerollSpent", /^that Reroll has already undone one ".*"$/],
    ["traceOutOfReach", /^a GM has written on that trace$/],
    ["traceOutOfReach", /^a Reroll put that trace back$/],
    ["traceOutOfReach", /^somebody has already found that trace$/],
    ["traceOutOfReach", /^there is no record of when that trace was left$/],
    ["traceOutOfReach", /^that trace is older than a Reroll can reach$/],
    ["notInIncident", /^no incident is at its incident stage for that character$/],
    ["notYourTurn", /^not their turn$/],
    ["actionLocked", /^that action is locked$/],
    ["actionSpent", /^that action is spent$/],
    ["actionBlocked", /^that action is blocked$/],
    ["nothingLeft", /^nothing left to spend on a resolution$/],
    ["movedOn", /^the incident has moved on since that action$/],
    ["movedOn", /^the last crisis action is not that character's$/],
    ["notThatRepair", /^there is no repair to take back$/],
    ["notThatRepair", /^no frozen project was named$/],
    ["notThatRepair", /^that repair is not what froze the project$/],
    ["notThatRepair", /^that repair does not repair the project$/],
    ["notThatRepair", /^the sender did not ask for that sabotage$/],
    ["notWhereItStood", /^the position is not a place on the map$/],
    ["notWhereItStood", /^the position is off the scene$/],
    ["notWhereItStood", /^the elevation is not a number$/],
    ["notWhereItStood", /^the token did not stand there a moment ago$/],
    ["alreadyDone", /^that Observe has already been resolved$/],
    ["nothingToUndo", /^that Observe has no result to take back$/],
    ["nothingToUndo", /^no Analyze of that bullet this chapter to take back$/],
    ["cannotNow", /^that bullet cannot be analysed now$/],
    ["cannotFrame", /^that student cannot be framed$/],
    ["notThere", /^the body is not in the killer's room$/],
    ["notThere", /^the character has no token on a scene$/],
    ["notThere", /^the character is not in that room$/],
    ["notThere", /^.+ is not in ".*"$/]
].map(([code, pattern]) => Object.freeze([code, pattern])));

/** The code of the closed list an English reason stands for: the first pattern that takes it, else `refused`. */
export function reasonOf(why) {
    const text = String(why ?? "");
    for (const [code, pattern] of REASON_PATTERNS) if (pattern.test(text)) return code;
    debug(`No reason of the closed list takes "${text}"; the player is told only that it was refused.`);
    return "refused";
}

/**
 * Refuse loudly in the log rather than silently doing the wrong thing - and
 * tell the asker (COMM-16).
 *
 * The acknowledgement left before any guard ran, so a request this side then
 * refused used to be acknowledged to the player and dropped: a roll that
 * reported success and a world that did not change, which is the exact
 * symptom the ack was added to remove. One addressed packet closed it; since
 * E31 the acknowledgement leaves only once the guards have passed (`judge`,
 * below), so the refusal is the one answer a refused request gets. A quiet
 * declaration - a report nobody waits on - is refused in the log alone.
 *
 * The English line is the GM's record, and 30-security reads it back through
 * `sessionFailures()`: `Refused a "<action>" request over the socket from
 * <name>: <why>.` The asker is told the code `reasonOf` reads off `why`, and
 * nothing else of it (E31).
 */
export function refuse(action, why, ctx = null, send = emitTo, code = reasonOf(why)) {
    // The sender's name, from Foundry's own `senderId`: the handbook sends a GM
    // to this line to find out who asked.
    const who = game.users?.get(ctx?.asker ?? "")?.name;
    warn(`Refused a "${action}" request over the socket${who ? ` from ${who}` : ""}: ${why}.`);
    if (!ctx?.quiet) tellRefused(ctx?.asker, action, ctx?.requestId ?? null, code, send);
    return null;
}

/**
 * Tell one player that the GM's client said no, and which reason of the closed
 * list says why. Split out of `refuse` (E03) so the other listeners that judge
 * a player's request - Daggerheart's relay in relay-guard.mjs above all -
 * answer with the same packet and the same message, rather than a player's
 * refused change simply never happening. A reason not on the list goes as
 * `refused`.
 */
export function tellRefused(userId, what, requestId = null, reason = "refused", send = emitTo) {
    if (!userId) return;
    try {
        send(userId, { action: ACTION_REFUSED, userId, requestId, what, reason: REASONS.includes(reason) ? reason : "refused" });
    } catch {
        // A refusal nobody hears is the old behaviour, not a new failure.
    }
}

/** The emit a refusal and the runner use unless handed another (R162 hands a recorder). Never to this client itself. */
function emitTo(userId, packet) {
    if (!userId || userId === game.user?.id) return;
    game.socket.emit(SOCKET_EVENT, packet, { recipients: [userId] });
}

/**
 * What a request is called on the player's screen.
 *
 * The same name as the thing they pressed, from the language file, rather
 * than an English literal typed beside each emit (COMM-14): the message that
 * says a request was not carried out has to name it in the language the rest
 * of the screen is in. Moved here from gm-bridge.mjs with `sayNotDone` (E31).
 */
export function requestLabel(action) {
    const key = `DRPG.Bridge.what.${action}`;
    return game.i18n.has(key) ? game.i18n.localize(key) : String(action ?? "?");
}

/**
 * The one message a player is shown when a request of theirs was not carried
 * out (E31): what, and why, composed on the player's own client in the
 * player's language - `DRPG.Bridge.notDone` with the request's label and the
 * sentence of its reason, and "Nothing was spent." where the asker says so. A
 * code not on the closed list is shown as `refused`, so a packet cannot pick
 * the sentence. Returns the text it showed.
 */
export function sayNotDone(action, reason, { nothingSpent = false, notify = text => ui.notifications.warn(text) } = {}) {
    const code = REASONS.includes(reason) ? reason : "refused";
    const said = game.i18n.format("DRPG.Bridge.notDone", {
        what: requestLabel(action),
        why: game.i18n.localize(`DRPG.Bridge.why.${code}`)
    });
    const text = nothingSpent ? `${said} ${game.i18n.localize("DRPG.Bridge.nothingSpent")}` : said;
    notify(text);
    return text;
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
 * past it, and `guardRelayActor`, asked before this one, refuses it (E31). So a
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

/** A table of declarations, frozen with every declaration and guard list in it: nothing edits one at run time. */
export function table(declarations) {
    for (const decl of Object.values(declarations)) {
        for (const key of ["guards", "runGuards", "claims"]) if (decl[key]) Object.freeze(decl[key]);
        Object.freeze(decl);
    }
    return Object.freeze(declarations);
}

/** The character a token stands for - token.sendBack's owner question, asked of the scene and token the packet names. */
export function tokenActorOf(payload) {
    return game.scenes.get(payload?.sceneId ?? "")?.tokens?.get(payload?.tokenId ?? "")?.actorId ?? null;
}

/**
 * The character a Remnant's ledger says left it - remnant.edit's owner question.
 * From the ledger, which the GM holds: the token has carried no `sourceActor`
 * flag since the answer key moved off it (CASE-09), so a read off the token was
 * always undefined and every legitimate edit was refused. The scene falls back
 * to the one this client is viewing, as the handler's did.
 */
export async function remnantSourceOf(payload) {
    const scene = game.scenes.get(payload?.sceneId ?? "") ?? canvas?.scene;
    const token = scene?.tokens?.get(payload?.tokenId ?? "");
    const { remnantData } = await import("./remnants.mjs");
    return remnantData(token)?.sourceActor ?? null;
}

/*
 * A GM'S RELAY NAMING A CHARACTER THIS CLIENT DOES NOT HAVE (E31, 25.09.2026).
 * The trap relay's handler dropped it without a word (`if (!actor) return`);
 * named, it is a quiet refusal with a log line. It can only meet a GM's packet:
 * `guardRelayOwner` refuses a player's missing character first, as "not their
 * character".
 */
export function guardRelayActor(sender, payload, ctx) {
    return payload?.actorId && game.actors.get(payload.actorId) ? null : "no such character";
}

/* ==========================================================================
 * THE BUILDING BLOCKS OF A DECLARATION (E31)
 * --------------------------------------------------------------------------
 * A declaration in one of the three tables (gm-bridge.mjs, traps.mjs,
 * search-tokens.mjs) names its guards in the order they are asked. The
 * questions most of them ask are made here, by a factory, rather than written
 * out in each handler as they were: who asked (`knownSender`), whether they own
 * the character a field names (`owns`, `ownsActorAt`), whether they are a GM
 * (`gmOnly`) or not (`playersOnly`), whether they may see the project a field
 * names (`canSeeProject`), and whether a number is in range (`inRange`). A
 * factory's guard carries `factory` and `covers`, the fields it judges, so R1b
 * can hold every id a run receives to a guard that names it or to a claim
 * written beside the declaration.
 * ========================================================================== */

/**
 * Tag a factory's guard with what it is, which fields it judges and the reason
 * it refuses with (`inRange`'s is the function that writes it), which R164
 * holds to the closed list of reasons.
 */
function made(guard, factory, covers, why) {
    return Object.freeze(Object.assign(guard, { factory, covers: Object.freeze([...covers]), why }));
}

/** The sender is a connected user Foundry named - the first question of nearly every declaration. */
export function knownSender(sender, payload, ctx) {
    return sender ? null : "unknown sender";
}

/** The sender owns the character the packet names in `field` (or, given a function, the one it finds). */
export function owns(field, why) {
    const named = typeof field === "function" ? field : payload => payload?.[field];
    return made((sender, payload, ctx) => ownsActor(sender, named(payload)) ? null : why,
        "owns", typeof field === "function" ? [] : [field], why);
}

/**
 * The sender owns the character found at what the packet names - a token's
 * actor, the character a Remnant's ledger says left it - through `locate`,
 * which may be async. `covers` are the fields `locate` reads. With `retryMs`,
 * a refusal is asked once more after that long before it stands, as a Reroll
 * receipt's is (`spendRerollReceipt`).
 */
export function ownsActorAt(locate, why, covers, { retryMs = 0 } = {}) {
    return made(async (sender, payload, ctx) => {
        if (ownsActor(sender, await locate(payload))) return null;
        if (!retryMs) return why;
        await pause(retryMs);
        return ownsActor(sender, await locate(payload)) ? null : why;
    }, "ownsActorAt", covers, why);
}

/** Only a GM may ask this; an Assistant GM is a GM. */
export function gmOnly(why) {
    return made((sender, payload, ctx) => !sender?.isGM ? why : null, "gmOnly", [], why);
}

/** Only a player asks this: a GM who does is refused, quietly where the declaration is quiet. */
export function playersOnly(why) {
    return made((sender, payload, ctx) => sender?.isGM ? why : null, "playersOnly", [], why);
}

/** The sender may see the project the packet names in `field` (`canSee`, projects.mjs). */
export function canSeeProject(field, why) {
    return made(async (sender, payload, ctx) => {
        const { canSee } = await import("./projects.mjs");
        return canSee(payload?.[field], sender) ? null : why;
    }, "canSeeProject", [field], why);
}

/** The whole number in `field` passes `fits`, or the refusal `template` writes for the value as sent. */
export function inRange(field, fits, template) {
    return made((sender, payload, ctx) => fits(Math.trunc(Number(payload?.[field]))) ? null : template(payload?.[field]),
        "inRange", [field], template);
}

/* ==========================================================================
 * WHAT A RUN IS HANDED (E31)
 * --------------------------------------------------------------------------
 * The guards read the packet as it came, as E03 wrote them. The run reads a new
 * object with only the fields its declaration lists, each passed through one of
 * these: an id (a string of at most 128 characters, else null), text, a number
 * (`Number(x) || 0`, which every handler wrote for itself), a flag, one of a
 * list, or the value as sent (`raw`, for what a guard or a resolver bounds, and
 * which R1b holds to a guard or a claim). No length bound is added to text: a
 * bound could cut a note a player wrote honestly, and E43's fuzz stage owns it.
 * ========================================================================== */

const kind = (name, convert) => Object.freeze(Object.assign(convert, { kind: name }));

export const as = Object.freeze({
    id: kind("id", value => typeof value === "string" && value.length > 0 && value.length <= 128 ? value : null),
    text: kind("text", value => value === null || value === undefined ? "" : String(value)),
    maybeText: kind("text", value => value === null || value === undefined ? null : String(value)),
    num: kind("num", value => Number(value) || 0),
    bool: kind("bool", value => Boolean(value)),
    oneOf: (...allowed) => Object.freeze(Object.assign(value => allowed.includes(value) ? value : null,
        { kind: "oneOf", allowed: Object.freeze(allowed) })),
    raw: kind("raw", value => value)
});

/** A sanitizer that builds a new object with exactly these fields; `fields` says which, and of what kind. */
export function pick(spec) {
    const entries = Object.entries(spec);
    const fields = Object.freeze(Object.fromEntries(entries.map(([name, convert]) => [name, convert.kind])));
    const sanitize = payload => {
        const clean = {};
        for (const [name, convert] of entries) clean[name] = convert(payload?.[name]);
        return clean;
    };
    return Object.freeze(Object.assign(sanitize, { fields, picked: true }));
}

/* ==========================================================================
 * THE RUNNER (E31)
 * --------------------------------------------------------------------------
 * One function carries out every declaration of the three tables, so the order
 * a request is judged in is written once: what the declaration prepares (an
 * import, a one-time read that must come before the guards, as it did in the
 * handlers - see `prepare` in gm-bridge.mjs), then who sent it, then its guards
 * in the order listed, and only when every one has passed, the acknowledgement,
 * the whitelisted copy of the packet, and the run.
 *
 * THE ACKNOWLEDGEMENT MOVED AFTER THE GUARDS. It used to leave before the
 * handler was even looked up, so a refused request was acknowledged first, and
 * another file's packet that carried a request id got a stray one
 * (`searchTokens.spend`, `searchTokens.takePlant` and `voice.applied`, measured
 * by the E31 design's probe of `onSocket`). Now a request gets either one
 * refusal, or an acknowledgement followed by at most one more packet: its answer,
 * or a refusal from the run.
 *
 * AND A THROW IS A REFUSAL. A handler that threw after the acknowledgement
 * reached nobody: the player's request had been "got", the answer never came,
 * and an awaited one sat on its three-minute clock. Whatever throws here -
 * preparing, a guard, the whitelist, the run - is logged with its stack and ends
 * as one refusal, "the handler failed", told to the asker.
 *
 * NOTHING SHARED BETWEEN LISTENERS IS WRITTEN TO. `senderId` is Foundry's own
 * argument and cannot be forged; the `userId` inside the packet is a claim. An
 * earlier attempt made the one into the other by overwriting `payload.userId`
 * in the bridge's listener, which broke every request in the module that waits
 * for an answer: Foundry hands the SAME packet object to every listener in
 * turn, and on the asking player's own client that rewrote a reply's address to
 * the GM who sent it, a moment before the reply's own listener compared it with
 * `game.user.id`. Observe hung on a promise that could never resolve; so did a
 * Dynamic ruling and a sabotage. The runner reads the packet and hands the run a
 * new object built from it; it writes to neither.
 * ========================================================================== */

/** GM -> player: "your request passed its guards and is being carried out". */
const ACTION_ACK = "bridge.ack";

/*
 * ONE WRITE AT A TIME, IN THE ORDER THEY ARRIVED, PER NAMED QUEUE (E03,
 * 24.09.2026; moved here from gm-bridge.mjs by E31). A Reroll of a Sabotage
 * sends two packets back to back: take the old freeze back, then freeze again
 * at the new number. Both runs await world writes, so the second could read the
 * project while the first had not yet thawed it, find it "already frozen" and
 * drop the new sabotage. Packets from one sender arrive in order, so queueing
 * them keeps that order; the guards run inside the queue, so the second
 * packet's guards see the first packet's write.
 */
const queues = new Map();

function inQueue(name, work) {
    const next = (queues.get(name) ?? Promise.resolve()).catch(() => null).then(work);
    queues.set(name, next);
    return next;
}

/**
 * Judge one packet against one table and carry it out: `false` when the table
 * has no such action (another listener's packet), otherwise a promise that
 * settles when the request has been refused or carried out. It never rejects.
 *
 * A run returns nothing, `{ reply }` (what an "answer: reply" declaration sends
 * back), `{ refused: "<English reason>" }`, or `{ later: true }` for a ruling a
 * GM answers from a card.
 */
export function judge(table, payload, senderId, { send = emitTo } = {}) {
    const action = payload?.action;
    const decl = typeof action === "string" && Object.hasOwn(table, action) ? table[action] : null;
    if (!decl) return false;
    const ctx = { asker: senderId ?? null, requestId: payload.requestId ?? null, action, quiet: Boolean(decl.quiet) };
    const work = async () => {
        try {
            const prepared = decl.prepare ? await decl.prepare(payload) : null;
            const sender = senderOf(senderId);
            const why = await firstRefusal(sender, payload, ctx, ...decl.guards);
            if (why) return refuse(action, why, ctx, send, decl.tell ?? reasonOf(why));
            if (decl.answer !== "none" && ctx.requestId) {
                send(ctx.asker, { action: ACTION_ACK, requestId: ctx.requestId, userId: ctx.asker });
            }
            const out = await decl.run(decl.sanitize(payload, sender), sender, ctx, prepared);
            if (out?.refused) return refuse(action, out.refused, ctx, send);
            if (decl.answer === "reply" && !out?.later && ctx.requestId) answer(decl, ctx, out?.reply ?? null, send);
            return true;
        } catch (err) {
            error(`The GM's client failed while carrying out "${action}"`, err);
            return refuse(action, `the handler failed: ${err?.message ?? err}`, ctx, send);
        }
    };
    return decl.queue ? inQueue(decl.queue, work) : work();
}

/** Send a run's answer back to the asker: `bridge.done`, which `bridgeRequest` waits for. */
function answer(decl, ctx, value, send) {
    send(ctx.asker, { action: ACTION_DONE, requestId: ctx.requestId, userId: ctx.asker, value });
}

/* ==========================================================================
 * THE ASKING SIDE: ONE WAIT, ONE RESULT, ONE MESSAGE (E31, 25.09.2026; audit S17-09)
 * --------------------------------------------------------------------------
 * A player's request to the GM used to wait in one of four ways, each written
 * out beside its request: sent with an eight-second clock for the "got it" and
 * a toast when none came, answering `{ pending: true }` the moment it left
 * whatever then happened; two clocks and a packet of its own for the answer;
 * one long clock; or no request id at all. Each said its own sentence when it
 * failed - "no GM answered", "no ruling", "not sent" - and a refused request
 * could say two (the refusal, then the clock's). A caller could not tell a
 * request that was carried out from one that was refused, because the answer
 * was `{ pending: true }` or null either way.
 *
 * `bridgeRequest` is the one wait. It resolves once and never rejects, with
 *   { ok: true, pending: true }            acknowledged (an "ack" request), or sent (a "none")
 *   { ok: true, value }                    answered (a "reply" request), or done on the GM's own client
 *   { ok: false, refused: true, reason }   refused by the GM's client, with the code of the closed list
 *   { ok: false, reason }                  noGm, noAnswer or failed, decided on this side
 * and every failure is said once, in this client's language, by `sayNotDone`,
 * unless the caller asked for quiet. How long to wait is the declaration's:
 * `answer` (none, ack, reply), `patient` (a person is deciding, so no clock for
 * the "got it", and the question is asked again when a GM's world has loaded),
 * `resend`, `timeoutMs` - read off the table by the file that owns it (`ask` in
 * gm-bridge.mjs), so the policy is written once.
 *
 * Built by `createWaiter` from what it needs - an emit, the GMs connected, who
 * this client is, the message, a clock - so R165 drives it with fakes and a
 * clock of tens of milliseconds; the module's one waiter is below it.
 * ========================================================================== */

/** GM -> player: "your request was carried out", with its answer - see `answer`. */
const ACTION_DONE = "bridge.done";

/**
 * Is this reply addressed to me, and did a GM actually send it?
 *
 * A reply is an authority - "the GM ruled 15", "the freeze took" - so a player
 * able to forge one could hand another player any answer they liked, including
 * settling a request that was waiting for a real ruling. Moved here from
 * gm-bridge.mjs with the wait it guards (E31).
 */
export function replyForMe(payload, senderId) {
    if (payload?.userId !== game.user?.id) return false;
    return Boolean(game.users.get(senderId)?.isGM);
}

/**
 * A waiter: `request` asks, `onReply` takes the GM's answers, `resendOnGmReady`
 * asks once more for what is still waiting when a GM's world has loaded.
 *
 * @param {object} deps
 * @param {(packet: object, recipients: string[]) => void} deps.emit  may throw
 * @param {() => string[]} deps.gmIds          the GMs connected now
 * @param {() => {id: string, isGM: boolean, isPrimary: boolean}} deps.me
 * @param {(action: string, reason: string, opts: {nothingSpent: boolean}) => void} deps.notify  the one message
 * @param {(senderId: string) => boolean} deps.fromGm  was a reply sent by a GM
 */
export function createWaiter({ emit, gmIds, me, notify, fromGm, clock = { set: setTimeout, clear: clearTimeout },
    newId = () => foundry.utils.randomID(), report = (text, err) => error(text, err) } = {}) {
    // Waiting for an answer, by request id.
    const pending = new Map();
    // Given up on, answered or refused, by request id, for as long as the request's own clock ran: a late
    // "got it", answer or refusal for one of these is dropped - a done goes to its `late` - so no request
    // is ever said twice.
    const closed = new Map();

    const settle = (entry, result) => {
        if (entry.settled) return;
        entry.settled = true;
        entry.resolve(result);
    };
    const tell = (entry, reason) => {
        if (!entry.quiet) notify(entry.action, reason, { nothingSpent: entry.nothingSpent });
    };
    const close = entry => {
        pending.delete(entry.id);
        for (const key of ["ackTimer", "answerTimer"]) {
            if (entry[key] !== null) clock.clear(entry[key]);
            entry[key] = null;
        }
        closed.set(entry.id, entry.late);
        clock.set(() => closed.delete(entry.id), entry.timeoutMs);
    };
    const fail = (entry, reason) => {
        tell(entry, reason);
        settle(entry, { ok: false, reason });
    };

    function request(action, payload = {}, { settle: kind = "ack", patient = false, resend = false, ackMs = TIMING.ackMs,
        timeoutMs = TIMING.rulingMs, local = null, quiet = false, nothingSpent = false, late = null } = {}) {
        return new Promise(resolve => {
            const entry = { id: null, action, kind, patient, resend, resent: false, quiet, nothingSpent, late, timeoutMs,
                resolve, settled: false, ackTimer: null, answerTimer: null, packet: null };
            try {
                const self = me();
                // 1. The GM's own client does it here; a GM does not talk to itself down a socket.
                if (self.isGM && typeof local === "function") {
                    Promise.resolve().then(local).then(value => settle(entry, { ok: true, value }), err => {
                        report(`The GM's own client failed while carrying out "${action}"`, err);
                        fail(entry, "failed");
                    });
                    return;
                }
                // 2. The primary GM is the one who answers: a request it sends itself goes nowhere.
                if (self.isPrimary) {
                    report(`"${action}" was asked of the bridge by the primary GM, who is the one who answers it`);
                    settle(entry, { ok: false, reason: "failed" });
                    return;
                }
                // 3. Nobody to ask: said now, and nothing is sent.
                const to = gmIds();
                if (!to.length) return fail(entry, "noGm");
                const packet = { ...payload, action, userId: self.id };
                // 4. Nobody waits on a report.
                if (kind === "none") {
                    emit(packet, to);
                    return settle(entry, { ok: true, pending: true });
                }
                // 5. One id, one entry, two clocks from the send: the "got it", and the answer.
                entry.id = newId();
                entry.packet = { ...packet, requestId: entry.id };
                pending.set(entry.id, entry);
                if (!patient) {
                    entry.ackTimer = clock.set(() => {
                        entry.ackTimer = null;
                        close(entry);
                        fail(entry, "noAnswer");
                    }, ackMs);
                }
                entry.answerTimer = clock.set(() => {
                    entry.answerTimer = null;
                    close(entry);
                    // An acknowledged "ack" request has had its answer; its clock only ends the wait for a late refusal.
                    if (!entry.settled) fail(entry, "noAnswer");
                }, timeoutMs);
                emit(entry.packet, to);
            } catch (err) {
                // 7. It never rejects: an emit that throws is a request that failed here.
                report(`Could not send "${action}" to the GM`, err);
                if (entry.id && pending.has(entry.id)) close(entry);
                fail(entry, "failed");
            }
        });
    }

    /** 6. A GM's "got it", answer or refusal, for this client. Returns whether it was one. */
    function onReply(packet, senderId) {
        const action = packet?.action;
        if (action !== ACTION_ACK && action !== ACTION_DONE && action !== ACTION_REFUSED) return false;
        if (packet.userId !== me().id || !fromGm(senderId)) return false;
        const id = packet.requestId ?? null;
        const entry = id ? pending.get(id) : null;
        if (!entry) {
            if (id && closed.has(id)) {
                const late = closed.get(id);
                if (action === ACTION_DONE && typeof late === "function") {
                    try { late(packet.value ?? null, id); } catch (err) { report(`A late answer to "${packet.what ?? "a request"}" could not be taken`, err); }
                }
                return true;
            }
            // Not a request this client is waiting on - one sent before a reload, a forged one: the refusal is still said.
            if (action === ACTION_REFUSED) notify(packet.what, packet.reason, { nothingSpent: false });
            return true;
        }
        if (action === ACTION_ACK) {
            if (entry.ackTimer !== null) clock.clear(entry.ackTimer);
            entry.ackTimer = null;
            if (entry.kind === "ack") settle(entry, { ok: true, pending: true });
            return true;
        }
        close(entry);
        if (action === ACTION_DONE) {
            settle(entry, { ok: true, value: packet.value ?? null });
            return true;
        }
        const reason = REASONS.includes(packet.reason) ? packet.reason : "refused";
        tell(entry, reason);
        // An acknowledged "ack" request has settled already: the refusal is its one message.
        settle(entry, { ok: false, refused: true, reason });
        return true;
    }

    /** 8. Ask once more, with the same id, for every request still waiting that asked for it. */
    function resendOnGmReady() {
        for (const entry of pending.values()) {
            if (!entry.resend || entry.resent || entry.settled) continue;
            entry.resent = true;
            try {
                const to = gmIds();
                if (to.length) emit(entry.packet, to);
            } catch (err) {
                report(`Could not ask the GM again for "${entry.action}"`, err);
            }
        }
    }

    return { request, onReply, resendOnGmReady, waiting: () => pending.size };
}

/* The module's one waiter. Addressed to the GMs connected and to nobody else - no
   broadcast: a request with no GM is refused before it is sent, and one sent to a
   GM who dropped a moment later is reported by its clock. */
const waiter = createWaiter({
    emit: (packet, recipients) => game.socket.emit(SOCKET_EVENT, packet, { recipients }),
    gmIds: () => activeGmIds(),
    me: () => ({ id: game.user?.id ?? null, isGM: Boolean(game.user?.isGM), isPrimary: isPrimaryGm() }),
    notify: (action, reason, opts) => sayNotDone(action, reason, opts),
    fromGm: senderId => Boolean(game.users.get(senderId)?.isGM)
});

/**
 * Ask the GM's client for something, and wait for it as its declaration says.
 * See the note above `createWaiter` for what it answers.
 *
 * @param {string} action   the declaration's name, e.g. "project.sabotage"
 * @param {object} payload  the fields its whitelist reads
 * @param {object} [opts]   settle ("none" | "ack" | "reply"), patient, resend, ackMs, timeoutMs,
 *                          local (the GM's own client does it), quiet, nothingSpent, late
 *                          (`late(value, requestId)`, for an answer that arrives after the clock)
 * @returns {Promise<{ok: boolean, pending?: true, value?: *, refused?: true, reason?: string}>}
 */
export function bridgeRequest(action, payload = {}, opts = {}) {
    return waiter.request(action, payload, opts);
}

/** The GMs' answers to this client's requests, on every client: one listener, registered once (module.mjs). */
export function registerBridgeReplies() {
    game.socket.on(SOCKET_EVENT, (packet, senderId) => { waiter.onReply(packet, senderId); });
}

/** A primary GM's world has loaded: ask again what is still waiting (gm-bridge.mjs's `onGmReady`). */
export function resendOnGmReady() {
    waiter.resendOnGmReady();
}
