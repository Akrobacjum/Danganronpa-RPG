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

import { MODULE_ID, HOPE_CALLS, DESPAIR_CALLS, STARTING, TIMING, CRISIS_ACTIONS } from "./config.mjs";
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
 * that exists, a Call that is a Hope Call). Guards change nothing. Until E08+E28
 * C8 one kind did - a guard named `...Receipt` spent a Reroll receipt, and it was
 * the last in its list - and C8 retired them with the receipts: no player's
 * packet carries an undo now (`guardUndoIsTheGms`). The wording of every reason is held to the closed list of
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
 * key outside the list. A declaration may name the one code every refusal of
 * it is told with, its guards' and its run's (`tell`); the GM's log keeps each
 * one's reason, and a throw is still told as failed.
 *
 * The English reason stays the source of truth: every guard and run returns it
 * as before, the GM's log prints it, and `reasonOf` reads the code off it with
 * the patterns below - anchored, the first that matches wins. R164 reads every
 * reason the guards, the runs and the functions they hand the question to can
 * give, out of the source, and holds each to exactly one pattern; a text none
 * takes would be told as `refused`, with a debug line naming it. Four codes
 * have no pattern: `relay` (relay-guard.mjs tells its own), `sheetPutBack`
 * (sheet-audit.mjs tells its own: a write the GMs put back, E29 C3), and `noGm`
 * and `noAnswer`, which only the asking player's client can know. `refused`, the
 * fallback, is also the code of a run that carried out nothing ("nothing was
 * carried out: ..."): a run answers a done only for work done, and which of its
 * resolver's silent reasons applied is not told (E31 review).
 */
export const REASONS = Object.freeze([
    "unknownSender", "notYours", "gmOnly", "cannotSee", "missing", "badRequest", "outOfRange", "busy",
    "notOffered", "notSecret", "notAPlayer", "notHolding", "alreadyHeld", "notASupport", "hopeBarred",
    "notEnoughHope", "noReroll", "undoIsTheGms", "traceOutOfReach", "notInIncident", "notYourTurn",
    "actionLocked", "actionSpent", "actionBlocked", "actionDenied", "nothingLeft", "movedOn", "notThatRepair",
    "notWhereItStood", "alreadyDone", "nothingToUndo", "deathStands", "cannotNow", "cannotFrame", "notThere",
    "answerKeyMissing", "keysNotOpen", "rollUnknown", "rollNotYours", "rollOtherAction", "rollUsed", "rollStale",
    "rollMissed", "projectFrozen", "rollReplaced", "notPaid", "rollThrown", "callNotPaid", "callNotApproved", "relay", "sheetPutBack", "failed",
    "refused", "noGm", "noAnswer"
]);

/**
 * The English reasons each code takes, in the order they are tried. Each begins
 * with the module's own words, and so does every reason: a name or a value put
 * into a reason comes after them, so it cannot choose the code (R164).
 */
export const REASON_PATTERNS = Object.freeze([
    // First: a thrown error's own message follows the colon and could read like any reason below.
    ["failed", /^the handler failed: /],
    ["failed", /^the Call could not be armed$/],
    ["failed", /^the ruling card could not be posted$/],
    ["failed", /^the trace could not be placed$/],
    ["refused", /^nothing was carried out: /],
    ["unknownSender", /^unknown sender$/],
    ["notYours", /^sender does not own /],
    ["notYours", /^sender did not leave that Remnant$/],
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
    ["badRequest", /^target holds no Despair pool$/],
    ["badRequest", /^a GM asks for nothing here$/],
    // E32+E07 C11b: a statistic ruling for a roll that has nothing to pick, or another side's table (guardTraitRuling).
    ["badRequest", /^that roll does not list several statistics$/],
    ["badRequest", /^that is not the table the character rolls$/],
    ["badRequest", /^that plant was handed to somebody else$/],
    // E05: a pre-session note past the player text cap (gm-bridge.mjs handleNoteSave).
    ["badRequest", /^the note is longer than a player's words may be$/],
    // E08+E28 fix r2-H5: a card a player asks the GM to post (gm-bridge.mjs `card.post`).
    ["badRequest", /^the card is longer than a player's words may be$/],
    ["badRequest", /^the card's readers are not users of this world$/],
    // Two patterns, not one with an optional group: R22 reads `range(` in a regex literal as a call.
    ["outOfRange", /^(?:amount|difficulty|delta) .+ is out of range$/],
    ["outOfRange", /^difficulty .+ is out of range \(.*\)$/],
    ["busy", /^a Level Up for that character is already being written$/],
    // E08+E28 C4a: the Reroll the GM makes (reroll.mjs `rerollOnGm`).
    ["busy", /^a Reroll of that character is already being made$/],
    // E08+E28 C6a: an Observe whose result the GM is still describing (reroll.mjs replayRefusal).
    ["busy", /^the GM is still describing what that Observe found$/],
    // E08+E28 fix r1-G6: a roll whose dice differ from the ones the GMs kept (reroll.mjs `standingRolls`).
    ["busy", /^the dice of that roll are not the ones the GMs kept$/],
    ["nothingToUndo", /^the GMs keep no roll of that character to reroll$/],
    ["notYours", /^the kept roll of that character is not the sender's$/],
    ["noReroll", /^the kept roll of that character is older than a Reroll can reach$/],
    ["missing", /^the roll is no longer in the chat$/],
    ["missing", /^that message holds no roll to throw again$/],
    ["failed", /^the Reroll could not be made; its Hope and the first roll are given back$/],
    ["failed", /^the replay was refused; its Hope and the first roll are given back$/],
    ["notOffered", /^no Level Up is on offer /],
    ["notSecret", /^that project is not secret$/],
    ["notAPlayer", /^the project can only be shared with a player$/],
    ["notHolding", /^no participant of the running incident the sender plays holds that object$/],
    ["alreadyHeld", /^that Call is already held by .+$/],
    ["notASupport", /^".*" is not a Hope Call a player can buy for somebody else$/],
    ["notASupport", /^".*" is not aimed at another player$/],
    ["notASupport", /^a Call for somebody else, aimed at the buyer$/],
    // E29 C8: a Call on the buyer's own character that is not one (call-effects.mjs ownArmRefusal).
    ["notASupport", /^".*" is not a Hope Call a player can buy for their own character$/],
    ["notASupport", /^".*" is aimed at somebody else$/],
    ["hopeBarred", /^the buyer may not spend a Hope Call now \(.*\)$/],
    ["notEnoughHope", /^the buyer holds .+ Hope, the Call costs .+$/],
    // E08+E28 C8: what only the GM's own Reroll takes back, asked by a player (guardUndoIsTheGms, gmOnly in gm-bridge.mjs).
    ["undoIsTheGms", /^an undo is the GM's own Reroll's$/],
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
    // E32+E07 C11a: an action the incident took away, or never gave that side (murder.mjs `crisisRefusal`).
    ["actionDenied", /^that action is not open to that character now$/],
    ["nothingLeft", /^nothing left to spend on a resolution$/],
    // E05: the GM's count of the Eclipse's crossings (eclipse.mjs applyRecordedMove).
    ["nothingLeft", /^no crossings left this Eclipse$/],
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
    ["alreadyDone", /^that betrayal is already declared$/],
    ["nothingToUndo", /^that Observe has no result to take back$/],
    // E08+E28 fix r1-G2: a crisis row whose fact never reached it (reroll.mjs `replayRefusal`).
    ["nothingToUndo", /^that crisis action has no result to take back$/],
    ["nothingToUndo", /^no Analyze of that bullet this chapter to take back$/],
    // E08+E28 fix r1-G3: a clean-up whose attempt the GMs no longer keep (reroll.mjs `replayRefusal`).
    ["nothingToUndo", /^no clean-up attempt of that trace to take back$/],
    // E32+E07 C8b: a Reroll of a crisis action whose own resolution killed (murder.mjs crisisUndoRefusal).
    ["deathStands", /^that crisis action killed somebody; the death stands$/],
    ["cannotNow", /^that bullet cannot be analysed now$/],
    // E05 C10: rule D - a refusal caused by a death, a body nobody has found among them (guardArmLiving).
    ["cannotNow", /^that cannot be done now$/],
    // E05 fix r1-G3: a Direct Murder parked with no Eclipse running (gm-bridge.mjs handleParkMurder).
    ["cannotNow", /^no Eclipse is running$/],
    // E32+E07 C11b: a statistic ruling for a clean-up the character may not make now (guardTraitRuling).
    ["cannotNow", /^the character may not clean up now$/],
    ["cannotFrame", /^that student cannot be framed$/],
    ["notThere", /^the body is not in the killer's room$/],
    ["notThere", /^the character has no token on a scene$/],
    ["notThere", /^the character is not in that room$/],
    // E32+E07 C11d: a statistic ruling for a project the sender cannot see, or the character cannot reach (guardTraitRuling).
    ["notThere", /^that project is not one the character can work on or break here$/],
    ["notThere", /^the character is not in ".*": .+$/],
    // E04: the GM's browser does not hold that bullet's answer key (analyze.mjs).
    ["answerKeyMissing", /^the answer key for that bullet is not on this GM's browser$/],
    // E04's fix round 10: its stores did not open in time, or at all (gm-stores.mjs answerKeysRefusal).
    ["keysNotOpen", /^the answer keys are not open on this GM's browser$/],
    // E06 C5a: a roll's subject reported for a message that is not the sender's fresh roll (guardRollAuthor).
    // Quiet, so told to nobody; R164 holds every reason to one code all the same.
    ["missing", /^no such roll message$/],
    ["badRequest", /^that message is not a roll the module threw$/],
    ["notYours", /^sender did not write that roll message$/],
    ["cannotNow", /^that roll message is too old to report$/],
    // E08+E28 C12a: a roll sent for the GM to draw that is not one (guardDrawnRoll).
    ["badRequest", /^that is not a duality roll nobody has thrown$/],
    // E08+E28 fix r2-H8: one with a term that is neither a die, a number nor + or - (guardDrawnRoll).
    ["badRequest", /^that roll holds a term no roll of this game is built of$/],
    // E08+E28 C14: a result taken from the GMs' record of its roll (rollRefusal).
    ["rollUnknown", /^no roll the GM drew is named$/],
    ["rollNotYours", /^that roll is not the sender's character's$/],
    ["rollOtherAction", /^that roll was not thrown for that action$/],
    ["rollStale", /^that roll is too old to settle anything$/],
    ["rollUsed", /^that roll has already settled that action$/],
    // E08+E28 C15: what a roll earned, read off the GMs' record of it (gm-bridge.mjs `searchTheftOf`, `traceBandOf`).
    ["rollMissed", /^that roll did not find the stash$/],
    ["rollMissed", /^that roll leaves no trace$/],
    // E08+E28 C16: a Work on a Project's roll that earned nothing (gm-bridge.mjs `progressOf`), and a frozen project (guardProjectFrozen).
    ["rollMissed", /^that roll earned no progress$/],
    ["projectFrozen", /^that project is frozen until its repair is finished$/],
    ["missing", /^no ruling of a GM's sets that roll's band$/],
    // E08+E28 fix r2-H1: a settlement takes the newest roll of its action (rollRefusal), and a draw is an
    // action's, made once (roll-draw.mjs `drawRefusal`, `drawOnGm`), its window's costs its experiences' Hope (guardDrawnCosts).
    ["rollReplaced", /^a later roll of that action has replaced that roll$/],
    ["notPaid", /^no payment of that character's stands for that roll$/],
    ["rollThrown", /^that character's roll of that action has been thrown already$/],
    ["rollThrown", /^a roll of that action is being thrown already$/],
    ["badRequest", /^no crisis action that throws a roll is named$/],
    ["cannotNow", /^that character has no opening roll to throw now$/],
    ["badRequest", /^that roll's window asks a cost no roll of this game pays$/],
    // E08+E28 fix r2-H2: progress that names no roll is a Hope Call's, paid for once (guardCallProgress).
    ["badRequest", /^no Call that adds progress is named$/],
    ["callNotPaid", /^no payment of that character's stands for that Call$/],
    // E29 fix r2-H4: a Call that waits for the GM's yes, armed with none kept for it (guardArmGmYes).
    ["callNotApproved", /^no GM's yes stands for that Call$/]
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
    /* A write the GMs' audit put back (E29 C3, sheet-audit.mjs) is no request: it is named by
       the field it changed, `sheet.<kind>`, with the label the GMs' whisper gives that field. */
    const field = /^sheet\.(\w+)$/.exec(String(action ?? ""))?.[1];
    const key = field ? `DRPG.Audit.field.${field}` : `DRPG.Bridge.what.${action}`;
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

/*
 * AN UNDO IS THE GM'S OWN REROLL'S (E08+E28 C8, 03.10.2026; audit S10-06, S02-19). A
 * Reroll takes its action back before it runs it again, and until C4a it did that from
 * the roller's browser, with packets that said so: an Observe, an Analyze, a crisis
 * action and a clean-up with `undo`, progress with a negative amount, a sabotage's pair
 * thawed, a trace re-rated, a point of Despair handed back. E03 let each through on a
 * receipt, the same player's rewrite of a roll of that character a few minutes before,
 * which paid whether a Reroll had made the rewrite or not. Since C4a the Reroll is
 * asked of the GM and the GM takes the action back on its own client, so no honest
 * player sends any of them. A player's undo and a player's negative amount are
 * refused here, before anything else is asked of them, and a player's `undo` never
 * reaches a run (`as.gmFlag`). The three requests that are only ever an undo -
 * `despair.adjust`, `project.unsabotage`, `remnant.edit` - are a GM's (`gmOnly`, with
 * this reason). A GM's packet is not asked: an Assistant GM's is the GM's own.
 */
export function guardUndoIsTheGms(sender, payload, ctx) {
    if (sender.isGM) return null;
    return payload?.undo || Math.trunc(Number(payload?.amount)) < 0 ? "an undo is the GM's own Reroll's" : null;
}

/*
 * JUDGED AGAIN HERE (E03, 24.09.2026; audit S04-09). The stage, the side,
 * the turn, the locks and what the character has left to spend were all
 * checked on the player's own client and never here, so a console could
 * throw a finishing blow out of turn, and a packet that arrived after the
 * GM had moved the incident on still applied. A player's undo never gets
 * here (`guardUndoIsTheGms`, E08+E28 C8): the GM's own Reroll takes a crisis
 * action back, and asks `crisisUndoRefusal` of it first (reroll.mjs
 * `replayRefusal`), as the two guards C8 retired asked it of a player's.
 */
export async function guardCrisisAction(sender, payload, ctx) {
    if (sender.isGM) return null;
    const { crisisRefusal } = await import("./murder.mjs");
    const actor = game.actors.get(payload.actorId);
    return crisisRefusal(actor, payload.key)?.why ?? null;
}

/*
 * A CRISIS ACTION THAT NAMES NO ROLL THREW NONE (E08+E28 C17, 04.10.2026; audit S10-06; the
 * plan's 3.5). A crisis action is scored on the GMs' record of the roll its packet names
 * (`rolled`), and two kinds of packet throw no dice and name none: a decision of the third
 * party's (`noRoll`) and a free take a critical Self-defence bought (`free`, a resolution
 * action's, which the run checks against the incident). Every other one a player sends has
 * to name its roll, or it is refused here as one naming no roll the GM drew; what passes with
 * none is scored on no dice (gm-bridge.mjs `handleCrisis`), as its asker sends it.
 */
export function guardCrisisRoll(sender, payload, ctx) {
    if (sender.isGM || payload?.rollId) return null;
    const def = Object.hasOwn(CRISIS_ACTIONS, payload?.key ?? "") ? CRISIS_ACTIONS[payload.key] : null;
    return def?.noRoll || (payload?.free && def?.kind === "resolution") ? null : "no roll the GM drew is named";
}

/*
 * WHICH STATISTIC, ASKED OF THE WORLD (E32+E07 C11b, 02.10.2026; audit S04-23). A
 * player asks the GMs to pick a trait for a roll before anything is paid
 * (trait-ruling.mjs `traitFor`), and the card it raises puts the action's name in
 * the thread. So the request is held to what the character could roll now: the
 * definition named lists several traits in this GM's config; the character is not
 * dead to the GMs; a crisis action is one `crisisRefusal` lets the character take,
 * from the table their side rolls (a trap's victim's, `crisisVariant`); a clean-up
 * is the cleaner's (`cleanupBlocker`). An opening's statistic is picked on the
 * GM's own client, where the opening is rolled from, so a player never asks it.
 *
 * A project stored without a statistic (C11d) is asked about by id, and its name goes
 * on the card: it has to be one the sender can see and the character could work on or
 * break where they stand - an unknown id and a hidden one are refused alike - and no
 * Eclipse or Class Trial may be running, as `performAction` refuses a Project in both.
 * The generic table's actions are held to the same clock.
 */
export async function guardTraitRuling(sender, payload, ctx) {
    if (sender.isGM) return null;
    const actor = game.actors.get(payload.actorId);
    if (!actor) return "no such character";
    const { listedTraits } = await import("./trait-ruling.mjs");
    const variant = payload.variant ?? null;
    if (payload.kind === "project" && !(await projectWithinReach(actor, payload.key, sender))) {
        return "that project is not one the character can work on or break here";
    }
    if (listedTraits({ kind: payload.kind, key: payload.key, variant }).length < 2) return "that roll does not list several statistics";
    const { isDeadForGm } = await import("./settings.mjs");
    if (isDeadForGm(actor)) return "that cannot be done now";
    if (payload.kind === "opening") return "only a GM picks an opening roll's statistic";
    if (payload.kind === "crisis") {
        const { crisisRefusal, crisisVariant } = await import("./murder.mjs");
        if (crisisVariant(actor, payload.key) !== variant) return "that is not the table the character rolls";
        return crisisRefusal(actor, payload.key)?.why ?? null;
    }
    if (payload.kind === "project" || payload.kind === "generic") {
        const { isEclipse, getClock } = await import("./settings.mjs");
        return isEclipse() || getClock()?.phase === "classTrial" ? "that cannot be done now" : null;
    }
    const { cleanupBlocker } = await import("./cleanup.mjs");
    return cleanupBlocker(actor) ? "the character may not clean up now" : null;
}

/** Whether `projectId` is one the sender sees and the character may work on or sabotage in the room they stand in. */
async function projectWithinReach(actor, projectId, sender) {
    const { projectsAvailableIn, sabotageTargetsIn } = await import("./projects.mjs");
    const { roomOfActor } = await import("./movement.mjs");
    const { isMonokuma } = await import("./monokuma.mjs");
    const room = roomOfActor(actor);
    return [...(room ? projectsAvailableIn(room, sender) : []),
        ...sabotageTargetsIn(room, { anyRoom: isMonokuma(actor), user: sender })].some(p => p.id === projectId);
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
 * PROGRESS A PLAYER ADDS (E08+E28 C16, 04.10.2026; audit S10-08; the plan's 3.5). A Work on a
 * Project names its roll, and what the roll earned is read off the GMs' record of it (gm-bridge.mjs
 * `progressOf`). A frozen project is refused, where it was answered "did not move": the picker
 * never offers one (projects.mjs `projectsListedIn`), and a refusal spends no roll. Progress is
 * added by a character standing in the project's room when it has one, as the picker lists them,
 * read on the scene documents (`locateActor`): `roomOfActor` sees only the scene this GM is
 * looking at.
 *
 * A PACKET THAT NAMES NO ROLL IS A HOPE CALL'S, PAID FOR (fix r2-H2, 05.10.2026; review S2-5). C16
 * held it to the largest Call's 2, asked nothing of where it stood, and took it as often as it came:
 * the round-2 review's probe added 2 three times for Aiko, in a room she was not in, 0 -> 6. Its
 * Call is named now (call-effects.mjs `progressEffect`) and must be a Hope Call that adds progress -
 * a Despair Call is a Monokuma's and bought on a GM's client (calls.mjs `spendDespairCallFor`) - the
 * amount is that Call's, the character stands in the project's room as Contribution says and its
 * picker lists (call-effects.mjs `pickProject`), and the Call's price is a payment this GM saw the
 * player make and takes once (roll-draw.mjs `takeCallPayment`). Asked last of the packet's guards,
 * so that no other refusal spends the payment.
 */
export async function guardCallProgress(sender, payload, ctx) {
    if (sender.isGM || payload?.rollId) return null;
    const call = Object.hasOwn(HOPE_CALLS, String(payload?.call)) ? HOPE_CALLS[payload.call] : null;
    if (!call?.progress) return "no Call that adds progress is named";
    if (Math.trunc(Number(payload.amount)) !== call.progress) return `amount ${payload.amount} is out of range`;
    const { takeCallPayment } = await import("./roll-draw.mjs");
    return await takeCallPayment(payload.actorId, call.cost) ? null : "no payment of that character's stands for that Call";
}

export async function guardProjectFrozen(sender, payload, ctx) {
    const { isFrozen } = await import("./projects.mjs");
    return isFrozen(payload.countdownId) ? "that project is frozen until its repair is finished" : null;
}

export async function guardProjectRoom(sender, payload, ctx) {
    if (sender.isGM) return null;
    const { roomOf } = await import("./projects.mjs");
    const room = roomOf(payload.countdownId);
    if (!room) return null;
    const { locateActor } = await import("./movement.mjs");
    return locateActor(game.actors.get(payload.actorId ?? ""))?.room === room ? null : "the character is not in that room";
}

/*
 * A SABOTAGE IS MADE STANDING AT ITS PROJECT (E08+E28 fix r2-H2, 05.10.2026; review S2-4). The
 * picker offers a project to break only in the room the saboteur stands in, never one with no
 * room - you have to be standing at the thing to break it (projects.mjs `sabotageTargetsIn`) - and
 * the GM asked neither: the round-2 review's probe drew a Sabotage of Aiko's in Dorm A and froze a
 * project in another room, its repair made and nothing refused, and a miss named its target for
 * the Reroll from anywhere as well. A player's packet, a miss's included, is held here to the room
 * on the scene documents, as `guardProjectRoom` holds a Work's, before its roll is claimed; a
 * Monokuma reaches every project, as the picker lets them (`anyRoom`).
 */
export async function guardSabotageRoom(sender, payload, ctx) {
    if (sender.isGM) return null;
    const actor = game.actors.get(payload.actorId ?? "");
    const { isMonokuma } = await import("./monokuma.mjs");
    if (isMonokuma(actor)) return null;
    const { roomOf } = await import("./projects.mjs");
    const room = roomOf(payload.targetId);
    if (!room) return "that project is not one the character can work on or break here";
    const { locateActor } = await import("./movement.mjs");
    return locateActor(actor)?.room === room ? null : "the character is not in that room";
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

/**
 * Why a Reroll may not lift or retune this trace, or null (E03). Pure.
 * `copied` is asked only of a removal, as E03 asked it of a player's edit, which
 * could move only the visibility band: a found trace a Reroll re-rates is still
 * there. The GM's Reroll of a Search also rewrites what its trace is of
 * (reroll.mjs `settleRemnant`, `describes`); E08+E28's round-1 fix list kept
 * `copied` to removals, and that case is not asked here.
 *
 * Asked by nothing on the bridge since E08+E28 C8: the guard that asked it of a
 * player's `remnant.edit` went with the Reroll receipts, and no player edits a
 * trace now (`guardUndoIsTheGms`). The Reroll the GM makes asks it before each
 * removal or retune of the trace its first roll left (reroll.mjs `traceKept`,
 * since fix r1-G3, 04.10.2026).
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
    const { playerArmRefusal, ownArmRefusal } = await import("./call-effects.mjs");
    return armedOnBuyer(payload) ? ownArmRefusal(payload.call) : playerArmRefusal(payload.call);
}

/*
 * AND ON THE BUYER'S OWN CHARACTER (E29 C8, 05.10.2026; the plan's 3.3). A Call that arms the
 * buyer's own next roll - Experience, Ultimate, Resolve, a Loaded Die - was written and paid on
 * the player's browser until 1.2.68; it comes here now as a Support does, and is checked, paid
 * and armed on the same road (gm-bridge.mjs `armPaidByPlayer`). Which of the two roads a packet
 * is on is read from the packet's two ids, the buyer's and the beneficiary's: the same character,
 * and only a Call aimed at nobody else passes (`ownArmRefusal`); two, and only one aimed at
 * another player (`playerArmRefusal`). `owns` has tied the buyer to the sender before either.
 */
function armedOnBuyer(payload) {
    return armBuyerId(payload) === payload.actorId;
}

/*
 * RULE D (E05 C10, 26.09.2026; audit S06-11). A player's Call armed on a student the GMs know
 * is dead is refused: the buyer's browser offers the living it knows of (call-effects.mjs
 * `pickPlayer`), and a body nobody has found is one of those. Told as "cannot now", which
 * names nobody; why is in this GM's log. A Monocub is dead and still a target.
 * ASKED LAST (E05 fix r2-G3, 27.09.2026; review S2-m1). It stood among the declaration's
 * guards, before the price: measured by the review, a player with no Hope who sent one
 * Support for a body nobody had found and one for a living student was told "cannot now"
 * for the first and "not enough Hope" for the second, free, as often as asked. The
 * player's road asks it after every refusal a living beneficiary gets too
 * (gm-bridge.mjs `armPaidByPlayer`), so the two answers differ only where the living
 * one is armed and paid for. The judgement is this GM's, as before.
 */
export async function guardArmLiving(sender, payload, ctx) {
    if (sender.isGM) return null;
    const actor = game.actors.get(payload.actorId);
    const { isDeadForGm, isDeceased } = await import("./settings.mjs");
    if (!actor || !isDeadForGm(actor) || actor.getFlag?.(MODULE_ID, "monocub")) return null;
    warn(`A Call on ${actor.name} was refused: they are dead${isDeceased(actor) ? "" : ", and nobody has found the body"}.`);
    return "that cannot be done now";
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
    return alreadyArmed(actor, call) ? `that Call is already held by ${actor.name}` : null;
}

/** A player's road: the paying character has to exist. */
export function guardArmBuyer(sender, payload, ctx) {
    if (sender.isGM) return null;
    return game.actors.get(armBuyerId(payload)) ? null : "the paying character does not exist";
}

/** And, for a Call aimed at another player, be somebody other than the character it is armed on (E29 C8: any other is the buyer's own). */
export function guardArmOtherCharacter(sender, payload, ctx) {
    if (sender.isGM || HOPE_CALLS[payload.call?.key]?.target !== "player") return null;
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
 * A CALL THAT WAITS FOR THE GM'S YES IS ARMED ONLY WITH IT (E29 fix r2-H4, 05.10.2026; the round-2
 * reviews' sec M4 and cor M1). Experience and Ultimate wait for a GM's ruling (config.mjs `needsGm`),
 * and until this fix only the asking player's browser waited for it: since E29 C8 the GM arms a
 * player's Call itself (`call.arm`), and nothing it held said that a GM had said yes - the review's
 * probe (98, Q1) armed an Ultimate and an Experience from p1's console with no ruling asked, each
 * answered "armed", Aiko's Hope 3 -> 1. Now the primary keeps each yes a GM gives on the ruling card
 * (gm-bridge.mjs `yesOnPrimary`), for the user who asked, the character, the Call and the purchase's
 * own name (its nonce: the asking browser sends it with the ask and again with the arm, calls.mjs
 * `spendHopeCall`), and a player's arm of such a Call takes it, once. In memory on the primary, as
 * each roll's first dice are (reroll-receipts.mjs): a primary that reloads between the yes and the
 * arm holds none, and the arm is refused before anything is paid.
 *
 * A minute: the asking browser sends the arm as soon as the yes reaches it, and a yes held back is
 * the GM's for that moment of the story, not for a later roll. Asked after the buyer's own refusals
 * (the Hope, a Call already held), so one of those leaves the yes for the purchase it was given for,
 * and before `guardArmLiving`, which stays last (`armPaidByPlayer`).
 */
const callYeses = new Map();
const CALL_YES_MS = 60 * 1000;
const CALL_YES_KEPT = 100;

function callYesKey(userId, actorId, key, nonce) {
    return [userId, actorId, key, String(nonce ?? "").slice(0, 32)].join("|");
}

/** The primary keeps a GM's yes to one user's ask (gm-bridge.mjs `yesOnPrimary`); the oldest go first. */
export function noteCallYes({ userId, actorId, key, nonce }) {
    const yes = callYesKey(userId, actorId, key, nonce);
    callYeses.delete(yes);
    callYeses.set(yes, Date.now());
    while (callYeses.size > CALL_YES_KEPT) callYeses.delete(callYeses.keys().next().value);
}

/** A player's Call that waits for the GM's yes takes the one kept for this purchase, or is refused. */
export function guardArmGmYes(sender, payload, ctx) {
    if (sender.isGM || !HOPE_CALLS[payload.call?.key]?.needsGm) return null;
    const yes = callYesKey(sender.id, armBuyerId(payload), payload.call.key, payload.call.nonce);
    const given = callYeses.get(yes);
    callYeses.delete(yes);
    return given !== undefined && Date.now() - given <= CALL_YES_MS ? null : "no GM's yes stands for that Call";
}

/**
 * The size of a GM's correction (DESP-12): any size up to a full pool. A player's
 * point was a Reroll's until E08+E28 C8 (one, on the rerolling character's own
 * Monokuma, paid for by a receipt); the GM settles a Reroll's Despair itself now
 * (reroll.mjs, C4b), and a player's packet is refused first (`undoIsTheGms`).
 */
export function guardDespairDelta(sender, payload, ctx) {
    const delta = Math.trunc(Number(payload.delta));
    return !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > STARTING.despairMax
        ? `delta ${payload.delta} is out of range` : null;
}

/** Any pool holder (DESP-13): an Assistant GM granted a pool is a Monokuma too. */
export async function guardDespairPool(sender, payload, ctx) {
    const target = game.users.get(payload.targetUserId ?? "");
    const { monokumas } = await import("./despair.mjs");
    return target && monokumas().some(u => u.id === target.id) ? null : "target holds no Despair pool";
}

/*
 * A ROLL'S SUBJECT IS REPORTED BY WHOEVER THREW IT (E06 C5a, 27.09.2026).
 * `roll.subject` tells the primary GM which character a roll the module threw
 * is about (private-rolls.mjs `ROLL_ACTIONS`). `owns` judges the character;
 * this ties the report to its message: the message exists - waited for, as a
 * card's words wait for theirs in secret.mjs, because the report can arrive
 * before the document - it is a roll the module claimed, the sender wrote it,
 * and it is under a minute old. A report leaves as its roll is created
 * (private-rolls.mjs `reportClaimedRoll`), so an older message is not the roll
 * the sender just threw. The age is the GM's clock
 * against the message's `timestamp`, stamped as the message was created - whose
 * clock stamps it, and how far the two drift at a table, is not measured here;
 * a minute leaves room.
 */
const ROLL_REPORT_MS = 60_000;

export async function guardRollAuthor(sender, payload, ctx) {
    const id = payload?.messageId;
    const { messageArrives } = await import("./secret.mjs");
    const message = typeof id === "string" && id ? game.messages.get(id) ?? await messageArrives(id) : null;
    if (!message) return "no such roll message";
    const { isClaimedRoll } = await import("./private-rolls.mjs");
    if (!isClaimedRoll(message)) return "that message is not a roll the module threw";
    /* A roll the primary GM drew for its player (E08+E28 C12a) is written by that GM: whose
       roll it is, the GMs' record of the draw says (roll-draw.mjs `rollRecord`), not the
       author. The round-1 security review's hand-over note: without this the roller's
       bookmark and report of a drawn roll were refused. */
    const { drawnRecordOf } = await import("./roll-draw.mjs");
    const drawn = drawnRecordOf(message);
    if (drawn ? drawn.userId !== sender.id : (message.author?.id ?? message.user?.id) !== sender.id) return "sender did not write that roll message";
    if (!(Date.now() - (message.timestamp ?? 0) <= ROLL_REPORT_MS)) return "that roll message is too old to report";
    return null;
}

/*
 * A ROLL FOR THE GM TO DRAW (E08+E28 C12a, 04.10.2026; the plan's 3.3). `roll.draw` carries the
 * roll the roller's browser configured, as Foundry's `toJSON` writes it, and the GM rebuilds it
 * with Daggerheart's `fromData` and throws it (roll-draw.mjs `drawOnGm`). So it is a duality roll,
 * not thrown yet - `evaluated` false and no term holding a result - with terms to rebuild, and it
 * carries the nonce the packet names, by which the GM's claim stamps the message it writes
 * (private-rolls.mjs `ROLL_NONCE`). The class is read as Foundry writes it, the constructor's
 * name: Daggerheart's own and the name of the class this client holds, in case a build renames
 * it. The bounds on its size are this guard's, not measured on a table's largest roll.
 *
 * AND IT IS BUILT OF DICE, NUMBERS AND SIGNS (E08+E28 fix r2-H8, 05.10.2026). Any other term (a
 * parenthesis, a function, a string, a pool, a sign that is not + or -) was thrown as the
 * packet wrote it, adding to the total what `checkRoll` neither counts nor flags (its flat
 * sum reads numbers alone), so it escaped the promise that a modifier outside the GM's record is
 * at least flagged. At 33bc497's runtime (tier 2, "a drawn roll holding a term that is neither
 * ...") a `(10)`, an `abs(10)`, a `*` by 10 and an advantage die of twenty faces seventh were each
 * drawn and recorded, and in 30-security a console's `(10)` was written (the GM's drawn messages
 * 19 -> 20, its records 22 -> 23). Refused rather than counted: the
 * roll window builds none for a drawn roll - Daggerheart's modifiers are numbers (dhRoll.mjs
 * `formatModifier`, `getBonus`; d20Roll.mjs's experiences, read in 2.10.5) and a student's extra
 * formula is locked but for a Meddle's signed number (roll-dialog.mjs `lockBonus`) - and counting
 * one would mean the GM evaluating a formula the packet wrote, whose dice inside it are the
 * packet's. Daggerheart's own dice only where `fromData` reads them (dualityRoll.mjs:122-129) -
 * the Hope die first, the Fear die third, an advantage or disadvantage die fifth - since a throw
 * reads its advantage die as the third die it holds (`dAdvantage`), and the GM writes those dice
 * itself (roll-draw.mjs `onGmTerms`; since E29 C10 the whole roll, `legalRollOf`); any other die is
 * a whole number of dice of a whole number of faces.
 */
const DRAWN_TERMS_MAX = 64;
const DRAWN_FORMULA_MAX = 512;
/** The dice a drawn roll may hold, and where Daggerheart's own may stand. */
const DRAWN_DICE = Object.freeze({ Die: null, HopeDie: 0, FearDie: 2, AdvantageDie: 4, DisadvantageDie: 4 });
const drawnTermFits = (term, i) => (Object.hasOwn(DRAWN_DICE, term?.class)
    ? (DRAWN_DICE[term.class] === null || DRAWN_DICE[term.class] === i) && Number.isInteger(term.number) && term.number > 0
        && Number.isInteger(term.faces) && term.faces > 0
    : term?.class === "NumericTerm" ? Number.isFinite(term.number)
        : term?.class === "OperatorTerm" && (term.operator === "+" || term.operator === "-"));
export async function guardDrawnRoll(sender, payload, ctx) {
    const { ROLL_NONCE } = await import("./private-rolls.mjs");
    const roll = payload?.roll;
    const terms = Array.isArray(roll?.terms) ? roll.terms : [];
    const classes = new Set(["DualityRoll", game.system?.api?.dice?.DualityRoll?.name]);
    const fits = roll && typeof roll === "object" && classes.has(roll.class) && roll.evaluated === false
        && terms.length > 0 && terms.length <= DRAWN_TERMS_MAX
        && typeof roll.formula === "string" && roll.formula.length <= DRAWN_FORMULA_MAX
        && !terms.some(term => Array.isArray(term?.results) && term.results.length)
        && typeof payload.nonce === "string" && payload.nonce.length > 0 && roll.options?.[ROLL_NONCE] === payload.nonce;
    if (fits && !terms.every(drawnTermFits)) return "that roll holds a term no roll of this game is built of";
    return fits ? null : "that is not a duality roll nobody has thrown";
}

/*
 * WHAT A DRAWN ROLL'S WINDOW MAY CHARGE (E08+E28 fix r2-H1, 04.10.2026; review M2). The GM pays
 * the costs a drawn roll's packet names on its own client (roll-draw.mjs `drawOnGm`), and until
 * this fix paid any key, negated: the review's packet of eight Fear costs of 12 moved the GM's
 * Fear 10 -> -86, answered as done and flagging nothing. The one cost Daggerheart's window adds
 * to a trait roll is a Hope for each experience it selects (d20RollDialog.mjs
 * `selectExperience`, read in 2.10.5), and the module's window takes even those off on every
 * render (roll-dialog.mjs `stripExperienceCosts`). So a cost is an enabled Hope of 1, at most one
 * for each experience the packet names that the sender's own character holds; a packet asking
 * anything else - Fear above all - is refused, and the refusal is logged on the GM.
 */
export function guardDrawnCosts(sender, payload, ctx) {
    const costs = Array.isArray(payload?.costs) ? payload.costs : [];
    if (!costs.length) return null;
    const held = actorExperiences(game.actors.get(payload.actorId ?? ""));
    const named = new Set((Array.isArray(payload.experiences) ? payload.experiences : []).filter(name => typeof name === "string" && held.has(name)));
    const hope = costs.every(c => c?.key === "hope" && c.value === 1 && c.enabled === true);
    return hope && costs.length <= named.size ? null : "that roll's window asks a cost no roll of this game pays";
}

/** The keys of a character's experiences, as Daggerheart's window names them in a roll's `experiences`. */
function actorExperiences(actor) {
    const experiences = actor?.system?.experiences;
    return new Set(experiences && typeof experiences === "object" ? Object.keys(experiences) : []);
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
    return there ? null : `the character is not in "${named}": ${actor.name}`;
}

/*
 * A CARD A PLAYER ASKS THE PRIMARY GM TO POST (E08+E28 fix r2-H5, 05.10.2026; gm-bridge.mjs
 * `card.post`, secret.mjs `askGm`). The GM writes it as its author, so it is held to what the
 * sender could have written themselves: it speaks as no character, or as one the sender owns -
 * the GM speaks as that character, and only as it (`postAsked` reads the actor and nothing
 * else of the speaker) - and every reader it names is a user of this world.
 */
export function guardCardSpeaker(sender, payload, ctx) {
    const actorId = payload?.speaker?.actor;
    if (actorId === undefined || actorId === null || actorId === "") return null;
    return ownsActor(sender, actorId) ? null : "sender does not own the character the card speaks as";
}

export function guardCardReaders(sender, payload, ctx) {
    const readers = payload?.whisper;
    return Array.isArray(readers) && readers.length && readers.every(id => typeof id === "string" && game.users?.get(id))
        ? null : "the card's readers are not users of this world";
}

/** A table of declarations, frozen with every declaration and guard list in it: nothing edits one at run time. */
export function table(declarations) {
    for (const decl of Object.values(declarations)) {
        for (const key of ["guards", "runGuards", "claims", "rolled"]) if (decl[key]) Object.freeze(decl[key]);
        for (const rolled of rollsOf(decl)) Object.freeze(rolled);
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
 * receipt's was until E08+E28 C8 retired them.
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
    /* E08+E28 C8: a flag only a GM's packet carries - a player's reads false whatever it says
       (`undo`, which `guardUndoIsTheGms` has refused from a player already). */
    gmFlag: kind("bool", (value, sender) => Boolean(sender?.isGM) && Boolean(value)),
    oneOf: (...allowed) => Object.freeze(Object.assign(value => allowed.includes(value) ? value : null,
        { kind: "oneOf", allowed: Object.freeze(allowed) })),
    raw: kind("raw", value => value)
});

/**
 * A sanitizer that builds a new object with exactly these fields; `fields` says which, and of
 * what kind. Each conversion is handed the sender as well, which only `as.gmFlag` reads.
 */
export function pick(spec) {
    const entries = Object.entries(spec);
    const fields = Object.freeze(Object.fromEntries(entries.map(([name, convert]) => [name, convert.kind])));
    const sanitize = (payload, sender = null) => {
        const clean = {};
        for (const [name, convert] of entries) clean[name] = convert(payload?.[name], sender);
        return clean;
    };
    return Object.freeze(Object.assign(sanitize, { fields, picked: true }));
}

/* ==========================================================================
 * A RESULT IS THE GM'S RECORD OF ITS ROLL (E08+E28 C14, 04.10.2026; audit S10-06; the plan's 3.5)
 * --------------------------------------------------------------------------
 * An Observe, an Analyze and a search for a hidden stash were scored on the GM's client
 * against the `total` and `isCritical` their packet carried - numbers the GM had nothing to
 * hold against. Since C12a the GM draws a player's roll and keeps its record (roll-draw.mjs `drawOnGm`,
 * `rollStore`). So a declaration that takes a roll's result says where its roll is named
 * (`rolled`): the field that names the roll's message (`field` - the one the resolver's
 * fact already went by, action-rolls.mjs `noteFactOfRoll`), the field that names the
 * character (`actor`), and the action the roll was thrown for (`kind`, the record's
 * `actionKey`). The runner asks `rollRefusal` once the guards have passed: the record
 * exists, it is that character's and the sender's (a GM may name a player's), it was
 * thrown for that action, a Reroll could still reach it (`TIMING.rerollWindowMinutes`,
 * past which the record is swept anyway), and it has not settled that action before. The
 * run then reads the record's `total`, `isCritical` and `withHope` in place of the
 * packet's (`onRecord`); a packet number that differs is logged here and never used.
 * A player's packet naming a roll this GM holds no record of is asked again once, after
 * `TIMING.rollRecordRetryMs` (the plan's 3.8; fix r2-H6, 05.10.2026): a GM who has just become
 * the primary may not have been sent the record yet. Measured only in the suite, where the
 * record is written late on purpose; the sync's time at a table is not.
 *
 * TWO PACKETS PASS WITH NO RECORD, AND THEIR NUMBERS STAND: a GM's that names none - a
 * GM's roll is its own and never drawn (roll-draw.mjs `drawsHere`) - and any packet on a
 * GM whose Daggerheart is not the build the draw was written for (`rollDrawState`, D1's
 * fallback), where every roll is thrown in the player's browser, as in 1.2.66, and nobody
 * keeps a record.
 *
 * SETTLED ONCE PER ACTION. An Analyze's roll settles one Analyze, of a bullet or of a
 * hidden stash (both are `analyze`). The claim is made here before the run, so a run that
 * then refuses has spent the roll as it spent the dice; it is marked in this GM's memory
 * before anything is awaited, so two copies of one packet cannot both pass, and on the
 * record, which the other GMs hold too, for a GM who takes over.
 *
 * SEVERAL ROLLS, AND RESULTS THAT ARE NOT A TOTAL (E08+E28 C15, 04.10.2026; the plan's 3.5).
 * `rolled` may be a list. A Palm throws two rolls and names both (`rollId`, `unseenRollId`):
 * the second's result goes in the packet's `unseenTotal` and `unseenCritical` (`into`).
 * A theft from a stash and a trace take no total at all, but what a roll earned - whether a
 * Search found the stash and fumbled it, the band a trace is left at - so the declaration
 * reads that off the record itself (`derive`, which answers the fields or why the roll
 * earned nothing of it), and a packet that said otherwise is logged in the same way. Some
 * packets of a declaration throw no roll: a stash opened from the drawer asks none of the
 * Search (`when`: only a packet that says `viaSearch`), and a trace asks one only for an
 * action whose roll leaves it (`kindAt`: the action the packet names, one of `kind`), so a
 * discarded item's trace still names none. A trace and the roll's own action are two things
 * one roll settles - a Sabotage freezes a project and leaves a trace - so a trace settles
 * `trace` (`settles`), not its action. Every roll a packet names is judged before any is
 * claimed: a Palm whose second roll is refused has not spent its first.
 *
 * A DERIVE READS THE PACKET TOO (E08+E28 C16, 04.10.2026). A project's progress and a
 * Sabotage's repair are what the roll earned with what only the roller's browser saw - a
 * concealment's bonus or penalty, the tool readied - so `derive` is handed the run's copy
 * as well, and holds each of those to what the rules allow (gm-bridge.mjs `progressOf`,
 * `repairOf`). `when` may name the roll's own field: progress that names no roll is a
 * Call's, which the declaration's guards bound instead (`guardCallProgress`).
 *
 * THE INCIDENT'S ROLLS (E08+E28 C17, 04.10.2026). An opening, a crisis action and every one of
 * Stage 6's actions are read off the record of the roll they name, as the rest are; a crisis
 * packet that names none threw none (`guardCrisisRoll`). A Meddle names no roll: the GM throws
 * its dice itself (monocub.mjs `meddleOnGm`), and its packet carries no result to read.
 * ========================================================================== */

/** The packet fields a record's result goes in, unless a declaration's roll says otherwise (`into`). */
const ROLL_INTO = Object.freeze({ total: "total", isCritical: "isCritical", withHope: "withHope" });
const settledHere = new Set();

/** A declaration's rolls: `rolled`, one or a list. */
export function rollsOf(decl) {
    return decl?.rolled ? [].concat(decl.rolled) : [];
}

/** A packet's value at a field or a dotted path (`data.sourceActor`). */
function valueAt(payload, path) {
    return String(path).split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), payload);
}

/** The action this packet's roll must have been thrown for, or null when the packet asks for no roll of this kind. */
function rollKindOf(rolled, payload) {
    if (rolled.when && !valueAt(payload, rolled.when)) return null;
    if (!rolled.kindAt) return rolled.kind;
    const named = valueAt(payload, rolled.kindAt);
    return [].concat(rolled.kind).includes(named) ? named : null;
}

/**
 * Why `record` cannot settle the declaration's action for this packet, or null. Since fix r2-H1
 * (04.10.2026; review S2-1) a roll is also held to what its draw named beyond its action -
 * `named`, a record field and the packet path that must say the same (a crisis roll's crisis
 * action, gm-bridge.mjs `murder.crisis`; a Work's or a Sabotage's project since fix r2-H2,
 * `project.progress` and `project.sabotage`; a record written without the field, before the
 * fix, is not asked, and one whose draw named none - null - settles nothing that names one) - and
 * one a later roll of its action replaced settles nothing (roll-draw.mjs `keepRecord`).
 */
export function rollRefusal(record, rolled, payload, sender, now = Date.now()) {
    if (!record) return "no roll the GM drew is named";
    if (record.actorId !== valueAt(payload, rolled.actor) || (record.userId !== sender?.id && !sender?.isGM)) return "that roll is not the sender's character's";
    const kind = rollKindOf(rolled, payload);
    const namedOtherwise = Object.entries(rolled.named ?? {})
        .some(([field, path]) => record[field] !== undefined && record[field] !== valueAt(payload, path));
    if (record.actionKey !== kind || namedOtherwise) return "that roll was not thrown for that action";
    if (!(now - (record.at ?? 0) <= TIMING.rerollWindowMinutes * 60_000)) return "that roll is too old to settle anything";
    if (record.superseded) return "a later roll of that action has replaced that roll";
    const settles = rolled.settles ?? kind;
    if (settledHere.has(`${record.rollId}:${settles}`) || (Array.isArray(record.resolved) && record.resolved.includes(settles))) {
        return "that roll has already settled that action";
    }
    return null;
}

/**
 * The records the packet names, each judged and then all claimed: `{ rolls }` - the rolls
 * whose results the run takes, none where the numbers stand - or `{ why }`.
 */
async function rollsFor(decl, payload, sender) {
    const specs = rollsOf(decl);
    if (!specs.length) return { rolls: [] };
    const { rollDrawState } = await import("./roll-draw.mjs");
    if (rollDrawState().state !== "ok") return { rolls: [] };
    const { rollStore } = await import("./gm-stores.mjs");
    await rollStore.whenHydrated();
    const rolls = [];
    for (const rolled of specs) {
        const kind = rollKindOf(rolled, payload);
        if (!kind) continue;
        const id = payload?.[rolled.field];
        const named = () => (typeof id === "string" && id
            ? Object.values(rollStore.entries() ?? {}).find(row => row?.messageId === id) ?? null : null);
        let record = named();
        if (!record && sender?.isGM) continue;
        // A player's packet that names a roll this GM has no record of is asked again once (the
        // plan's 3.8, built in fix r2-H6): the record may still be on its way from the GM who drew it.
        if (!record && typeof id === "string" && id) {
            await pause(TIMING.rollRecordRetryMs);
            record = named();
        }
        rolls.push({ rolled, record, settles: rolled.settles ?? kind,
            earned: record && rolled.derive ? await rolled.derive(record, payload) : null });
    }
    // Nothing is awaited from the first question to the last mark (above).
    for (const { rolled, record, earned } of rolls) {
        const why = rollRefusal(record, rolled, payload, sender) ?? earned?.why ?? null;
        if (why) return { why };
    }
    for (const { record, settles } of rolls) settledHere.add(`${record.rollId}:${settles}`);
    for (const { record, settles } of rolls) {
        const resolved = Array.isArray(rollStore.get(record.rollId)?.resolved) ? rollStore.get(record.rollId).resolved : [];
        await rollStore.patch(record.rollId, { resolved: [...resolved, settles] });
    }
    return { rolls };
}

/** The run's copy with each record's result in the fields its declaration takes; a packet that said otherwise is logged. */
function onRecord(clean, rolls, action, sender) {
    const out = { ...clean };
    for (const { rolled, record, earned } of rolls) {
        const kept = earned ? earned.fields ?? {} : Object.fromEntries(Object.entries(rolled.into ?? ROLL_INTO)
            .filter(([, field]) => Object.hasOwn(clean, field))
            .map(([from, field]) => [field, from === "total" ? Number(record[from]) || 0 : Boolean(record[from])]));
        for (const [path, value] of Object.entries(kept)) {
            const said = valueAt(out, path);
            if (said !== undefined && said !== value) {
                warn(`The "${action}" packet from ${sender?.name ?? "?"} said ${path} ${said}; the GMs' record of its roll says ${value}, which stands.`);
            }
            const [head, ...rest] = path.split(".");
            out[head] = rest.length ? { ...(out[head] ?? {}), [rest.join(".")]: value } : value;
        }
    }
    return out;
}

/* ==========================================================================
 * THE RUNNER (E31)
 * --------------------------------------------------------------------------
 * One function carries out every declaration of the three tables, so the order
 * a request is judged in is written once: what the declaration prepares (an
 * import, a one-time read that must come before the guards, as it did in the
 * handlers - see `prepare` in gm-bridge.mjs), then who sent it, then its guards
 * in the order listed, then the whitelisted copy of the packet and the roll a
 * result is read from, named in that copy (`rolled`, since E08+E28 C14), and
 * only when every one has passed, the acknowledgement and the run.
 *
 * THE ACKNOWLEDGEMENT MOVED AFTER THE GUARDS. It used to leave before the
 * handler was even looked up, so a refused request was acknowledged first, and
 * another file's packet that carried a request id got a stray one
 * (`searchTokens.spend`, `searchTokens.takePlant` and `voice.applied`, measured
 * by the E31 design's probe of `onSocket`). Now a request gets either one
 * refusal, or an acknowledgement followed by at most one more packet: its answer,
 * or a refusal from the run.
 *
 * EXCEPT IN A QUEUE, WHERE IT IS ACKNOWLEDGED AS IT ARRIVES (E31 review). Its
 * guards run inside the queue, behind every write that arrived before it, so
 * its "got it" waited for all of them, and a wait longer than the asker's clock
 * for it (`TIMING.ackMs`) was told "no answer" and carried out all the same. So
 * a queued request is acknowledged on arrival, and a refusal by its guards
 * comes after that; a queued declaration answers "reply" (R1b), so its asker
 * settles on the answer or the refusal, never on the "got it".
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

/** GM -> player: "your request passed its guards and is being carried out" - or, in a queue, "it has arrived". */
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
    const acknowledge = () => send(ctx.asker, { action: ACTION_ACK, requestId: ctx.requestId, userId: ctx.asker });
    // A queued request is acknowledged as it arrives; everything else once its guards have passed (see above).
    const early = Boolean(decl.queue) && decl.answer !== "none" && Boolean(ctx.requestId);
    if (early) {
        try { acknowledge(); } catch (err) { error(`Could not acknowledge "${action}"`, err); }
    }
    const work = async () => {
        try {
            const prepared = decl.prepare ? await decl.prepare(payload) : null;
            const sender = senderOf(senderId);
            const why = await firstRefusal(sender, payload, ctx, ...decl.guards);
            if (why) return refuse(action, why, ctx, send, decl.tell ?? reasonOf(why));
            /* A result is the record's, not the packet's (E08+E28 C14, above). The roll is
               named in the whitelisted copy, so its field is one the declaration takes as an
               id (R218) and one R163 counts as read. */
            const clean = decl.sanitize(payload, sender);
            const rolled = decl.rolled ? await rollsFor(decl, clean, sender) : { rolls: [] };
            if (rolled.why) return refuse(action, rolled.why, ctx, send, decl.tell ?? reasonOf(rolled.why));
            if (!early && decl.answer !== "none" && ctx.requestId) acknowledge();
            const out = await decl.run(rolled.rolls.length ? onRecord(clean, rolled.rolls, action, sender) : clean, sender, ctx, prepared);
            if (out?.refused) return refuse(action, out.refused, ctx, send, decl.tell ?? reasonOf(out.refused));
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
    // Given up on, answered or refused, by request id, for as long as the request's own clock ran, or its
    // `lateMs` when that is longer: a late "got it", answer or refusal for one of these is dropped - a done
    // goes to its `late`, a refusal to its `lateRefused` - so no request is ever said twice.
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
        closed.set(entry.id, { late: entry.late, lateRefused: entry.lateRefused });
        clock.set(() => closed.delete(entry.id), Math.max(entry.timeoutMs, entry.lateMs));
    };
    const fail = (entry, reason) => {
        tell(entry, reason);
        settle(entry, { ok: false, reason });
    };

    function request(action, payload = {}, { settle: kind = "ack", patient = false, resend = false, ackMs = TIMING.ackMs,
        timeoutMs = TIMING.rulingMs, local = null, onPrimary = false, quiet = false, nothingSpent = false, late = null, lateRefused = null,
        lateMs = 0 } = {}) {
        return new Promise(resolve => {
            const entry = { id: null, action, kind, patient, resend, resent: false, quiet, nothingSpent, late, lateRefused, lateMs, timeoutMs,
                resolve, settled: false, ackTimer: null, answerTimer: null, packet: null };
            try {
                const self = me();
                // 1. The GM's own client does it here; a GM does not talk to itself down a socket. What
                //    only one client may decide (`onPrimary`) is done here on the primary alone, and any
                //    other GM asks it as a player does (E08+E28 fix r2-H7; the round-2 review's S2-7, m5).
                if (self.isGM && typeof local === "function" && (!onPrimary || self.isPrimary)) {
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
                const { late, lateRefused } = closed.get(id);
                if (action === ACTION_DONE && typeof late === "function") {
                    try { late(packet.value ?? null, id); } catch (err) { report(`A late answer to "${packet.what ?? "a request"}" could not be taken`, err); }
                }
                // A request whose clock said it may still be done (E08+E28 fix r1-G5: the Reroll) hears its late refusal too.
                if (action === ACTION_REFUSED && typeof lateRefused === "function") {
                    const reason = REASONS.includes(packet.reason) ? packet.reason : "refused";
                    try { lateRefused(reason, id); } catch (err) { report(`A late refusal of "${packet.what ?? "a request"}" could not be taken`, err); }
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
 *                          local (the GM's own client does it), onPrimary (only the primary GM's
 *                          does; another GM asks the primary), quiet, nothingSpent, late
 *                          (`late(value, requestId)`, for an answer that arrives after the clock),
 *                          lateRefused (`lateRefused(reason, requestId)`, for a refusal that does),
 *                          lateMs (how long after the wait ends `late` is still handed one;
 *                          the clock's own length when shorter)
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
