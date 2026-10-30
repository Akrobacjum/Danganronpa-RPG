/**
 * Danganronpa RPG - Frisk, a Palm's third direction: seeing what somebody carries (E80 part 2, the A11 design).
 * ---------------------------------------------------------------------------
 * What the primary GM holds of an open Frisk. The asks live in this GM's memory, never in a store, a flag or a
 * setting: a reload or a new primary ends them with no dice thrown (the design's risk 3; E18 may move them). C0
 * builds what a drawn roll asks of them - whether a searcher may force one now - and C3 the ask's road that writes
 * them (FRISK OPENLY below). C1 adds what the primary reads of the people in the room: whether one person
 * may act on another now (`personActionRefusal`) and who else stands there to see it (`roomWitnessesOnGm`). C2 adds
 * the unseen Frisk: the searcher's browser throws the cover and the hand (`performFrisk`) and the primary judges the
 * two on the GMs' records of them and posts the cards (`friskPerson`, asked through gm-bridge.mjs `action.friskUnseen`).
 * C3 adds the open Frisk: the ask, the answer judged by who sent it, the force after a refusal or no answer, and an
 * end for every ask (`askToFrisk`, `answerFrisk`, `followFrisk`, `sweepFriskAsks`, `friskRouteSettled`).
 */

import { SETTINGS, getSetting, getClock, isEclipse, isDeadForGm, isDeceased, incidentParticipants } from "./settings.mjs";
import { MODULE_ID, FLAGS, ITEM_CATEGORIES, TIMING } from "./config.mjs";
import { gmPlaceOf, lawfulRoomOf } from "./movement.mjs";
import { witnessesOf } from "./chapter.mjs";
import { studentActors } from "./monokuma.mjs";
import { flagsHeldNow } from "./sheet-audit.mjs";
import { inClassTrial } from "./trial.mjs";
import { esc, log, debug, error, whisperToOwner, whisperToGms, announce, ownerIdsOf, gmIds, activeGmIds, primaryGmId, isPrimaryGm, dialogContent } from "./utils.mjs";
import { knowsOfDeath } from "./incident-store.mjs";
import { sayNotDone } from "./bridge-guards.mjs";

/**
 * The asks this primary GM holds, by ask id (`askToFrisk` writes them): who asks whom, where (`sceneId`, `level`,
 * `room`), who answers (`answerUserIds`, `byGms`, `silent`), the snapshot's `lines`, `at`, `expiresAt`, `forceUntil`
 * and `state`: "opening" while the ask is being made, "asking" while its window is open, "answered" for the tick an
 * answer is read, and "refused" or "noAnswer" once the target refused or the answer's clock ran out - from then until
 * `forceUntil` (epoch ms) the searcher may force it; any other state is no force. An ended ask leaves the map.
 */
export const friskAsks = new Map();

/**
 * The ids of the asks this primary ended itself (`endAsk`), the newest `ENDED_KEPT` of them: a follow naming one is
 * refused `missing`, its end already told. A follow naming no roll of an ask this GM neither holds nor ended - one a
 * reload of this GM, or the GM primary before it, dropped while 'Make them?' was open - ends `interrupted`, so the
 * searcher's browser hands the action back (`followFrisk`; E80 fix r2-G1, the review's fx-2). This browser's memory, as
 * the asks are: a reload forgets both.
 */
const endedAsks = new Set();
const ENDED_KEPT = 200;

/**
 * When each GM last left, by user id, as this browser heard it (`friskUserConnected`): a GM's own force reads whether the
 * GM that held its ask has left since it asked - a reload of that GM forgot the ask (`gmForceShut`; E80 fix r2-G3, the
 * review's r2fix-1). This browser's memory: only what it heard while it ran.
 */
const gmLeftAt = new Map();

/** The states of an ask that open a force (the owner's 1 = a: after a refusal or no answer, never before). */
const FORCEABLE = Object.freeze(["refused", "noAnswer"]);

/**
 * Whether `searcherId` may draw a Frisk's force now: the GMs' `friskForce` is on and an ask of theirs stands refused or
 * unanswered inside its window - `forceUntil`, the grace for a press in its last moment and the roll's window that press
 * opened (`forceDrawnBy`) - with the two still standing as they stood when it was asked (`standing`: in its room, neither
 * gone, no Eclipse, no Class Trial, no death or incident of either side). Asked by roll-draw.mjs `drawRefusal` before a
 * `frisk` roll takes its ticket, so a gate that shut while 'Make them?' was open refuses the dice before they are thrown,
 * and the force's follow, naming no roll, ends the ask `interrupted` with the action handed back (E80 fix r1-G2, the
 * review's E80-C3-8). A GM's own force, thrown on its own browser where no draw is judged, asks it there first when that GM
 * is the primary (`gmForceShut`; E80 fix r2-G1, the review's fx-3).
 */
export function friskForceOpen(searcherId, now = Date.now()) {
    if (!searcherId || getSetting(SETTINGS.friskForce) !== true) return false;
    for (const row of friskAsks.values()) {
        if (row?.searcherId === searcherId && FORCEABLE.includes(row.state) && forceDrawnBy(row) > now && !row.ending && !standing(row)) return true;
    }
    return false;
}

/**
 * How long past an ask's clocks the primary still takes what was pressed in their last moment (`TIMING.friskGraceMs`):
 * the target's window and 'Make them?' each open one trip after the primary's clock started and close a full clock after
 * that, so an answer or a force pressed at the end reaches the primary past it (E80 fix r1-G1, the review's E80-C3-4).
 */
export const FRISK_GRACE_MS = TIMING.friskGraceMs;

/**
 * How long past 'Make them?' closing the force's roll may still be drawn (`TIMING.friskRollMs`): 'Make them' pressed in
 * the window's last second opens Daggerheart's roll window, and the roll is drawn only when that window is confirmed.
 * The design counts the moment the roll is drawn, so that what comes after the press does not take the force away (its
 * step 7; E80 fix r1-G2, the review's er-cor-8).
 */
export const FRISK_ROLL_MS = TIMING.friskRollMs;

/**
 * The last moment (epoch ms) a force of `row`'s may be drawn: its window, the grace and the roll's window. Also
 * gm-bridge.mjs `friskForceRoll`'s; the sweep keeps the row `FRISK_MARGIN_MS` past it for the follow on its way.
 */
export function forceDrawnBy(row) {
    return Number(row?.forceUntil) + FRISK_GRACE_MS + FRISK_ROLL_MS;
}

/**
 * Whether `asker` (a user) knows that `target` is dead: a death published is the table's, everybody's (settings.mjs
 * `isDeceased` - publishing drops the GMs' row of it, chapter.mjs `publishDeath`); one the GMs keep is known to those
 * its row names (incident-store.mjs `knowsOfDeath`). A Frisk never touches a known body (the A11 design's resolved 20;
 * E80 fix r1-G1, the review's rc2-1), as handover.mjs `lootBody` reads the same two.
 */
function knownBody(asker, target) {
    return isDeceased(target) || (isDeadForGm(target) && knowsOfDeath(asker, target.id));
}

/** A floor as `gmPlaceOf` hands it - an id or a Level document - as one comparable id. */
const floorKey = level => level?.id ?? level ?? null;

/**
 * Why `asker` may not act on `target` now, as an English reason of the bridge's closed list (bridge-guards.mjs
 * `REASON_PATTERNS`), or null. The primary GM's one gate of an action one living student takes on another in their
 * room (the A11 design's step 3), asked before the price; E80 asks it for a Frisk only (E14 wires it into the person
 * gate of `transferItem`). In the design's order: both characters exist and differ; neither is a Monokuma nor a
 * Monocub, read off the GMs' mark (sheet-audit.mjs `flagsHeldNow`); the asker is alive for the GMs (`isDeadForGm`);
 * both stand where the GMs read them (movement.mjs `gmPlaceOf`: scene, floor and room, so a room of the same name on
 * another scene is not this one), the target on a token the GMs have not hidden; no Eclipse; no Class Trial; the
 * asker is no side of the running incident (`incidentParticipants`, the GMs' cast).
 *
 * What it does not ask, on purpose: whether the target is dead, and whether the target is a side of an incident.
 * Either refusal would answer a question a player may not ask (a death nobody has found, a secret incident), so a
 * target the GMs alone know dead, or caught in an incident, passes here exactly as a living bystander does and its
 * caller treats it so (the design's step 8). Chained and Silenced block nothing: Chained pins a move, Silenced a Call.
 * Every reason maps to an existing code - cannotNow, notThere or missing - and none names who or why (R164).
 *
 * `{ body: true }` (E14 part 1 C1, the owner's Q4 of 18.10.2026; the 13.10 amend): the same gate for a body's loot
 * (inventory.mjs `transferRefusal`, mode "loot"), which asks the two things the living road leaves out, the other way
 * round. The target must be dead and its death known to `user`, the user who asked (`knownDeath`: a GM, a death
 * published, or one the GMs' row lets that user know - before the discovery the incident's sides, a student alone with
 * the body, the body's own player; the owner's 26.09); an unknown death is refused in the words a living target is
 * ("that cannot be done now"), asked before the room, so the two read alike whatever else holds. And the incident is no
 * bar: its sides are the very ones 26.09 lets search the body. The target's Monocub mark is no bar either: what lies on
 * a Monocub's body is the body's (D15). A11's two-argument calls read as they did.
 */
export function personActionRefusal(asker, target, { body = false, user = null } = {}) {
    if (!asker || !target || asker.type !== "character" || target.type !== "character") return "no such character";
    if (asker.id === target.id) return "a character cannot do that to itself";
    const [mine, theirs] = [flagsHeldNow(asker), flagsHeldNow(target)];
    if (mine.getFlag(MODULE_ID, FLAGS.monokuma)) return "a Monokuma takes no part in that";
    if (mine.getFlag(MODULE_ID, FLAGS.monocub) || (!body && theirs.getFlag(MODULE_ID, FLAGS.monocub))) return "a Monocub takes no part in that";
    if (isDeadForGm(asker)) return "that cannot be done now";
    if (body && !knownDeath(user ?? game.user, target)) return "that cannot be done now";
    const here = gmPlaceOf(asker);
    if (!here?.room) return "the character has no token on a scene";
    // A Monokuma on the map is the GM standing there, and a hidden token is nobody the room can see: neither is
    // somebody in the room, as movement.mjs `othersInRoom` offers the asker's window its targets.
    const there = theirs.getFlag(MODULE_ID, FLAGS.monokuma) ? null : gmPlaceOf(target);
    if (!there?.room || there.tokenDoc?.hidden || there.scene?.id !== here.scene?.id || floorKey(there.level) !== floorKey(here.level)
        || there.room !== here.room) return "the character is not in that room";
    if (isEclipse()) return "an Eclipse is running";
    if (inClassTrial()) return "that waits until the Class Trial is over";
    if (!body && incidentParticipants().includes(asker.id)) return "the character is a side of the running incident";
    return null;
}

/**
 * Whether `user` may know that `target` is dead, on the browser that asks (E14 part 1 C1): a death published is the
 * table's; one the GMs keep is known, on a GM, to the users its row names (`knownBody`, incident-store.mjs
 * `knowsOfDeath`). A player's browser holds only the deaths its user may know (settings.mjs `isDeadForGm` reads that
 * copy there), so there it is that copy's - the loot window's display (anonymity.mjs `buildBodyLoot`).
 */
export function knownDeath(user, target) {
    if (!target) return false;
    if (isDeceased(target)) return true;
    return game.user?.isGM ? knownBody(user, target) : isDeadForGm(target);
}

/**
 * The students who see what happens in `room` on `scene`, as the GMs read them: chapter.mjs `witnessesOf`, the rule a
 * walk-in on a body counts its witnesses by - a student's character (no Monokuma), on a token the GMs have not hidden,
 * alive for the GMs or a Monocub, standing where the witness judge reads it (movement.mjs `lawfulRoomOf`), one a
 * student however many tokens - less the ids of `except` (the two the event is about). A Monocub sees, as it sees a
 * body found. World actors, in the scene's token order. On the primary GM: the marks are its (`flagsHeldNow`).
 */
export function roomWitnessesOnGm(room, scene, { except = [] } = {}) {
    if (!room || !scene) return [];
    const left = new Set(except);
    const students = new Set(studentActors().map(actor => actor.id));
    return witnessesOf({ tokens: scene.tokens ?? [], room, students, held: flagsHeldNow, roomOf: lawfulRoomOf })
        .map(token => game.actors.get(token.actor?.id) ?? null).filter(actor => actor && !left.has(actor.id));
}

/* ==========================================================================
 * FRISK UNSEEN (E80 part 2 C2, S16-24; the A11 design's steps 4, 5 and 9)
 * ========================================================================== */

/**
 * One line of a Frisk's list: 'Name - Category (T{tier})', 'x{n}' for more than one, the existing 'Broken' after a
 * broken one, all as text (`esc`). Read off the item as the GMs hold it (`pocketsAsHeld`): its name, category, tier,
 * quantity and broken flag, nothing else - no description (a GM's words, and a key's names its owner), no picture, no
 * wear, no roles and no identity, so an item a trap is planted on reads byte for byte as a clean one (the trap's only
 * mark is the identity the GMs' `trapLedger` keeps). A key is in the pocket under its own name, 'Key - {room}'.
 */
export function friskLine(item) {
    const category = ITEM_CATEGORIES[item?.getFlag?.(MODULE_ID, "category")]?.label ?? "";
    const tier = item?.getFlag?.(MODULE_ID, "tier");
    const count = Number(item?.system?.quantity) || 1;
    const broken = Boolean(item?.getFlag?.(MODULE_ID, "broken"));
    return esc(`${item?.name ?? ""}${count > 1 ? ` x${count}` : ""}${category ? ` - ${category}` : ""}${
        tier !== null && tier !== undefined ? ` (T${tier})` : ""}${broken ? ` - ${game.i18n.localize("DRPG.Items.broken")}` : ""}`);
}

/**
 * What a searcher sees of `target`'s pockets: the heading and a `<ul>` of `friskLine`s, or the empty pocket's line.
 * The same for every student - the Mastermind's pockets read as anybody's.
 */
export function friskListHtml(target, pockets) {
    return listOfLines(target, (pockets ?? []).map(friskLine));
}

/** `friskListHtml` from lines already cut (`friskLine`), under `heading` - an open Frisk's list is its ask's snapshot. */
function listOfLines(target, lines, heading = "DRPG.Frisk.listHeading") {
    const who = esc(target?.name ?? "");
    if (!lines?.length) return `<p>${game.i18n.format("DRPG.Frisk.empty", { who })}</p>`;
    return `<p>${game.i18n.format(heading, { who })}</p><ul>${lines.map(line => `<li>${line}</li>`).join("")}</ul>`;
}

/**
 * An unseen Frisk, judged on the primary GM: `{ outcome: "settled" }` once its cards are posted, or `{ refused }` with
 * an English reason of the bridge's closed list. The totals are the GMs' records' (gm-bridge.mjs `friskRolls`, read in
 * by the runner before this runs); a GM's own Frisk brings its own. `asker` is the user who asked: a death that user
 * knows is a body's road, not a pocket's.
 *
 * THE 2x2 (the design's step 5). The hand (`ACTIONS.palm.rummage.threshold`, Hand 10) says whether the searcher sees
 * the pockets; the cover (`rummage.unseen`, Shadow 15) whether the target felt it. A critical hand always sees and a
 * critical cover is never felt; neither adds anything else. The searcher is told both, on one card to its owner and
 * the GMs: the list (or that they got no proper look) and 'Nobody saw you do it.' or 'They noticed.'. The target is
 * told only when it noticed, on its own card with the `stolen` sound, by name: caught looking, or caught trying. No
 * witness is told (as a Palm and Tail Someone). Unnoticed, no card and no card's words reach the target (tier 2 "A11-5").
 * A TARGET THE GMS ALONE KNOW DEAD (E80 fix sec1-G1, the review's sec-1; the owner's Q8, option A, 20.10.2026, over the
 * design's step 8(d), which had such a Frisk always come out unnoticed and post no card of the target's): the searcher's
 * side is judged as at a living target on the same dice. Its card says 'They noticed.' under a missed cover, and the
 * GMs' fact keeps it felt, so its Reroll answers as a living target's (`replayRummage`). The searcher's own browser
 * holds the cover's total and its bar, so 'Nobody saw you do it.' under a miss would tell its player that the GMs keep
 * that target dead. The body feels nothing: its card is posted as a living target's is, the same veiled document every
 * browser gets, but its words go to the GMs alone (`whisperToGms`), so no player reads it and no sound plays.
 *
 * Every card is veiled (utils.mjs `whisperToOwner(..., { veiled: true })`): its document is addressed to every
 * browser in nobody's voice, and its words go only to its readers. The list is the pockets as the GMs hold them now
 * (vault.mjs `pocketsAsHeld`, an undecided item left out with a line in the GM's log), never sent anywhere but that
 * card. Beside the cards it writes only the GMs' fact on the hand's roll (E80 part 2 C4, `replayRummage`), in their
 * store: no flag, no item, no setting.
 */
export async function friskPerson({ searcherId, targetId, total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false, rollId = null } = {},
    { asker = null } = {}) {
    const searcher = game.actors.get(searcherId) ?? null;
    const target = game.actors.get(targetId) ?? null;
    const refuse = why => {
        log(`Refused a Frisk by ${searcher?.name ?? "?"} of ${target?.name ?? "?"}: ${why}.`);
        return { refused: why };
    };
    const why = personActionRefusal(searcher, target);
    if (why) return refuse(why);
    if (knownBody(asker, target)) return refuse("that cannot be done now");
    const body = isDeadForGm(target);

    const { ACTIONS } = await import("./config.mjs");
    const part = ACTIONS.palm.rummage;
    const sees = Boolean(isCritical) || Number(total) >= part.threshold;
    const noticed = !(Boolean(unseenCritical) || Number(unseenTotal) >= part.unseen);
    const { pocketsAsHeld } = await import("./vault.mjs");
    const pockets = sees ? await pocketsAsHeld(target, searcher, { undecided: "drop" }) : [];

    await whisperToOwner(searcher, searcherCard(target, sees ? pockets : null, noticed), { veiled: true });
    if (noticed) {
        const words = `<p>${game.i18n.format(sees ? "DRPG.Frisk.caught" : "DRPG.Frisk.caughtTrying", { who: esc(searcher.name) })}</p>`;
        const card = { veiled: true, flags: { [MODULE_ID]: { sfx: "stolen" } } };
        await (body ? whisperToGms(words, card) : whisperToOwner(target, words, card));
    }
    log(`${searcher.name} frisked ${target.name} unseen: ${sees ? `saw ${pockets.length} item(s)` : "got no proper look"}, ${
        noticed ? (body ? "noticed as a living target would be, a body the GMs keep (its card's words to the GMs alone)" : "noticed") : "unnoticed"}.`);
    // The GMs' fact on the hand's row (the design's step 11), which its Reroll replays from (`replayRummage`): written
    // for the roll the packet named and the user who sent it, never claimed by the searcher's browser (action-rolls.mjs
    // `ROLL_CLAIMS` has no Frisk). A Frisk that names no roll leaves none, and its Reroll replays nothing.
    const here = gmPlaceOf(searcher);
    const rolls = await import("./action-rolls.mjs");
    await rolls.noteFactOn(rolls.rollOfFact({ rollId, by: asker?.id ?? null, actorId: searcher.id, actions: ["rummage"] }),
        { frisk: { victimId: target.id, sceneId: here?.scene?.id ?? null, room: here?.room ?? null, seen: noticed, shown: sees } });
    return { outcome: "settled" };
}

/** The searcher's card of an unseen Frisk: the list of `pockets` (null: no proper look) and whether the target felt it. */
function searcherCard(target, pockets, noticed) {
    const seenLine = `<p><small>${game.i18n.localize(noticed ? "DRPG.Steal.cardSeen" : "DRPG.Steal.cardUnseen")}</small></p>`;
    return `${pockets ? friskListHtml(target, pockets) : `<p>${game.i18n.format("DRPG.Frisk.missed", { who: esc(target?.name ?? "") })}</p>`}${seenLine}`;
}

/**
 * A Frisk's hand rerolled on the primary (reroll.mjs `replayAction`, `case "rummage"`; the design's step 11 and the
 * owner's 5 = b, 13.10): what the new dice change of the moment the GMs' fact `frisk` keeps, as `{ line, patch }` - the
 * line for the Reroll's card (already worded) and the fact as it stands after. The new dice count in one cell only: a
 * miss nobody felt, nobody told anything, now beating Hand 10 sends the list, once, on the card a success sends, read
 * as the GMs hold the pockets now - while the two still stand in the room of the first throw as `personActionRefusal`
 * reads it (and no death the thrower knows has made the target a body), else the moment has passed. The fact keeps
 * `replayed`, so a second Reroll of the same roll sends nothing. A target that felt the hand already knows whether the
 * searcher got a proper look, and that card cannot be taken back: the moment stands. What was shown stays seen. The
 * cover is not rerolled (its roll is not the row's). Null `fact`: a hand no Frisk was judged on, nothing to replay.
 */
export async function replayRummage(searcher, fact, { total = 0, isCritical = false, by = null } = {}) {
    if (!searcher || !fact?.victimId) return null;
    const target = game.actors.get(fact.victimId) ?? null;
    // Plain text: the Reroll's card escapes its lines (calls.mjs `postHopeCallCard`).
    const who = target?.name ?? "";
    const late = () => ({ line: game.i18n.format("DRPG.Reroll.rummageLate", { who }), patch: { frisk: { ...fact, replayed: true } } });
    if (fact.seen) return { line: game.i18n.localize("DRPG.Reroll.rummageStands"), patch: {} };
    if (fact.shown) return { line: game.i18n.localize("DRPG.Reroll.rummageSeen"), patch: {} };
    if (fact.replayed) return { ...late(), patch: {} };
    const { ACTIONS } = await import("./config.mjs");
    if (!(Boolean(isCritical) || Number(total) >= ACTIONS.palm.rummage.threshold)) {
        return { line: game.i18n.format("DRPG.Frisk.missed", { who }), patch: {} };
    }
    const here = gmPlaceOf(searcher);
    const asker = (by ? game.users?.get(by) : null) ?? null;
    if (!target || personActionRefusal(searcher, target) || here?.scene?.id !== fact.sceneId || here?.room !== fact.room
        || knownBody(asker, target)) {
        log(`A Reroll of ${searcher.name}'s Frisk of ${target?.name ?? "?"} found the moment passed.`);
        return late();
    }
    const { pocketsAsHeld } = await import("./vault.mjs");
    const pockets = await pocketsAsHeld(target, searcher, { undecided: "drop" });
    await whisperToOwner(searcher, searcherCard(target, pockets, false), { veiled: true });
    log(`A Reroll of ${searcher.name}'s Frisk of ${target.name} saw ${pockets.length} item(s), unnoticed.`);
    return { line: null, patch: { frisk: { ...fact, shown: true, replayed: true } } };
}

/**
 * The searcher's browser, an unseen Frisk of `victim` once the Palm window named it (action-rolls.mjs `performPalm`).
 * The action is paid before the first roll, as a Palm's; the cover is thrown first (`palm`, Shadow, a supporting roll:
 * no Call is eaten by it and a closed window gives the action back), then the hand (`rummage`, Hand, remembered: it eats
 * an armed Call, and a closed window leaves the action spent, ROLL-05), and the primary GM judges the two on its records
 * (`requestFriskUnseen`). This browser's card says only that the hand went in: the verdict, and the list, are the GM's
 * card. `drpgActionResolved` goes out after the hand's roll, as `palm` with `direction: "frisk"`.
 */
export async function performFrisk(actor, def, victim, mode, { cost = def?.cost ?? 1, room = null } = {}) {
    if (mode !== "unseen") return performFriskOpenly(actor, def, victim, { cost, room });
    const A = await import("./action-rolls.mjs");
    const { spendAction } = await import("./actions.mjs");
    const part = def.rummage;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    // "Palm - Shadow, beat 15" and "Palm - Hand, beat 10" (action-rolls.mjs `palmTitle`, E51 C1; the owner's A11).
    const shadow = await A.rollTrait(actor, def.unseen.trait, {
        remember: false, actionKey: "palm", title: A.palmTitle("rummageUnseen", def), titled: true, dc: part.unseen
    });
    if (!shadow) return A.abort(actor, paid);
    const hand = await A.rollTrait(actor, part.trait, {
        actionKey: "rummage", dc: part.threshold, title: A.palmTitle("rummage", def), titled: true,
        context: { room, victimId: victim.id, unseenTotal: shadow.total, direction: "frisk" }
    });
    if (!hand) return A.spentAfterRoll(actor, def);

    const success = Boolean(hand.isCritical) || hand.total >= part.threshold;
    const seen = !(shadow.isCritical || shadow.total >= part.unseen);
    const { requestFriskUnseen } = await import("./gm-bridge.mjs");
    const res = await requestFriskUnseen({
        searcherId: actor.id, targetId: victim.id,
        total: hand.total, isCritical: Boolean(hand.isCritical), unseenTotal: shadow.total, unseenCritical: Boolean(shadow.isCritical),
        rollId: A.rollInHand(actor)?.messageId ?? null, unseenRollId: shadow.raw?.message?.id ?? shadow.raw?.message?._id ?? null
    });
    // The hand keeps the key it was thrown as (`rummage`), here and in the GMs' row: it names the Reroll's replay (the
    // design's step 11, reroll.mjs `settleRummage`), so no context renames it (the review's er-cor-5).
    await A.noteRollContext(actor, { direction: "frisk", mode, room, victimId: victim.id, seen, success });
    // "Sent" only when the primary judged it (E31): a request it did not carry out has been said once already.
    const outcome = {
        success, seen, direction: "frisk", mode, target: victim.name,
        text: res.ok && res.value ? game.i18n.format("DRPG.Frisk.sent", { name: victim.name }) : ""
    };
    await A.report(actor, def, hand, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "palm", roll: hand, outcome });
    return outcome;
}

/* ==========================================================================
 * FRISK OPENLY (E80 part 2 C3, S16-25; the A11 design's steps 6 to 8 and 12)
 * --------------------------------------------------------------------------
 * The ask first, the force only after a refusal or no answer (the owner's 1 = a). Every step is the primary GM's:
 * the searcher's browser pays the Palm and asks (gm-bridge.mjs `action.friskAsk`), the primary judges the ask
 * (`askToFrisk`), claims its payment's ticket, takes the snapshot of the pockets and asks the people who answer for
 * the target (`frisk.ask`, to them alone); an answer is judged by who Foundry says sent it (`answerFrisk`,
 * `action.friskAnswer`); a force or a 'Leave it' names the ask (`followFrisk`, `action.friskFollow`). The ask lives in
 * `friskAsks`, this browser's memory: a reload or a new primary ends it with no dice thrown - the searcher's wait
 * runs out and hands the action back, an answer is told `missing` (the design's risk 3); once 'Make them?' is open, the
 * follow finds no ask this primary held or ended, which ends it `interrupted` and the searcher's browser hands the action
 * back (`followFrisk`; E80 fix r2-G1, the review's fx-2). A GM that is no longer the
 * primary while it still holds asks (another GM connected whose turn it is) drops them at its next sweep, with no card
 * and no answer, as a reload would (`sweepFriskAsks`; E80 fix r1-G1, the review's E80-C3-6). Since E18 C7 the ask is on
 * E18's one road for its ends: the searcher's wait running out ends it here (`expireFriskAsk`, judged since E18 fix
 * c7-G1: an unanswered ask once that wait could have run out, an answered one as 'Leave it'), and the wait ends at once
 * when the primary that holds it leaves for another GM who takes over (gm-bridge.mjs `requestFriskAsk`; with no GM left
 * the wait runs its clock); a GM whose socket comes back without a reload drops what it holds (`friskSocketBack`).
 * Nothing enters world data
 * but the veiled cards: no flag, no item, no setting, no store.
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
/** primary -> the people who answer for a target: "turn out your pockets?" - or, to the GMs, a notice that nobody is asked. */
const FRISK_ASK = "frisk.ask";
/** primary -> the same people: the ask is answered or over, its window closes. */
const FRISK_CANCEL = "frisk.cancel";
/** The outcomes that end an ask before its row is written, the action handed back by the searcher's browser. */
export const FRISK_REFUNDED = Object.freeze(["askedAlready", "targetBusy", "youBusy", "isBody"]);
/**
 * The outcomes whose action the searcher's browser hands back, by what it paid (action-rolls.mjs `abort`, its receipt):
 * those above, and an ask `interrupted` with no dice thrown. Handed back there and not by the primary, which cannot tell
 * a Burst from an action nor a GM's free Frisk from a paid one (E80 fix r1-G1, the review's E80-C3-3). The cards of the
 * four above say 'Your action is back.', as they are answered while that browser waits; an interrupted ask can end when
 * nobody waits any more (a page reloaded), so its card says only that the moment has passed, and the browser that hands
 * the action back says it is back (`DRPG.Frisk.actionBack`; E80 fix r2-G1, the review's fx-1).
 */
export const FRISK_HANDED_BACK = Object.freeze([...FRISK_REFUNDED, "interrupted"]);
/** How long past its force's clock a refused or unanswered row waits for the follow that ends it (`TIMING.friskMarginMs`). */
export const FRISK_MARGIN_MS = TIMING.friskMarginMs;

/** The pairs asked, `searcherId>targetId`, with the time of day they were asked in: one ask a pair a time of day (chosen). */
const askedPairs = new Map();

/** The time of day now, as one comparable key: season, chapter, day and the time of day. */
function timeOfDayKey() {
    const clock = getClock();
    return [clock.season, clock.chapter, clock.day, clock.timeOfDay].join(":");
}

/** A line of the design's for a card, every name in it as text. */
const say = (key, data = {}) => `<p>${game.i18n.format(key, Object.fromEntries(Object.entries(data).map(([k, v]) => [k, esc(v ?? "")])))}</p>`;

/** A veiled card to `actor`'s owners - every player who owns it, since E18 C5 - and the GMs (utils.mjs `whisperToOwner`); a failure is logged, never thrown. */
async function cardTo(actor, html, extra = {}) {
    try {
        return await whisperToOwner(actor, html, { veiled: true, ...extra });
    } catch (err) {
        error("Could not post a Frisk's card", err);
        return null;
    }
}

/**
 * A veiled card whose words go to the GMs alone (utils.mjs `whisperToGms`): the card of a target the GMs keep silent - a
 * body nobody found, an incident's side - which nobody else reads. Its document is the one a living target's card posts,
 * the same stub every browser gets (E80 fix sec1-G1, the review's sec-1; the owner's Q8, option A), so the documents a
 * searcher's browser counts are a living target's. A failure is logged, never thrown.
 */
async function cardToGms(html, extra = {}) {
    try {
        return await whisperToGms(html, { veiled: true, ...extra });
    } catch (err) {
        error("Could not post a Frisk's card", err);
        return null;
    }
}

/**
 * One veiled card to the students who saw it happen in the ask's room (`roomWitnessesOnGm`, the two left out) - each
 * owner of each, a Monocub's among them - and the GMs; none where nobody saw it. No item is ever named on it.
 */
async function tellWitnesses(row, html) {
    const scene = game.scenes?.get(row.sceneId) ?? null;
    const readers = new Set(roomWitnessesOnGm(row.room, scene, { except: [row.searcherId, row.targetId] }).flatMap(ownerIdsOf));
    if (!readers.size) return null;
    try {
        return await announce({ content: html, whisper: [...new Set([...readers, ...gmIds()])], veiled: true });
    } catch (err) {
        error("Could not post a Frisk's card to its witnesses", err);
        return null;
    }
}

/** Send a `frisk.ask` or `frisk.cancel` to each of `userIds`, one packet a user naming that user; the primary's own is taken here. */
function emitTo(userIds, packet) {
    for (const userId of new Set(userIds)) {
        const addressed = { ...packet, userId };
        if (userId === game.user?.id) {
            onFriskPacket(addressed, game.user.id).catch(err => error("Could not take a Frisk's window on this browser", err));
            continue;
        }
        try {
            game.socket.emit(SOCKET_EVENT, addressed, { recipients: [userId] });
        } catch (err) {
            error("Could not send a Frisk's window", err);
        }
    }
}

/**
 * How an ask's two people stand now against the room it was asked in: null while both stand there and either may
 * act on the other; "letGo" when the searcher has gone (the design: as 'Leave it'); "gone" when the target has walked
 * away; "interrupted" for anything else that ends it with no dice thrown - an Eclipse, the Class Trial, either side's
 * death or incident (a target the GMs kept silent when it was asked stays as it was: it is why nobody was asked).
 */
function standing(row) {
    const searcher = game.actors.get(row.searcherId) ?? null;
    const target = game.actors.get(row.targetId) ?? null;
    if (!searcher || !target) return "interrupted";
    const here = p => Boolean(p?.room) && !p.tokenDoc?.hidden && p.scene?.id === row.sceneId && floorKey(p.level) === row.level && p.room === row.room;
    if (!here(gmPlaceOf(searcher))) return "letGo";
    if (!here(gmPlaceOf(target))) return "gone";
    if (!row.silent && (isDeadForGm(target) || incidentParticipants().includes(target.id))) return "interrupted";
    return personActionRefusal(searcher, target) ? "interrupted" : null;
}

/**
 * Ends `row` as `outcome`, on the primary, once: its windows closed, its ticket closed to a force, its cards posted
 * and the searcher's wait answered where it still waits. The outcomes, the design's words for each:
 *   shown          the list as it was at the ask to the searcher, 'You turn out your pockets' to the target, the room told;
 *   forced         the same list under 'is carrying:', the target forced, the room told;
 *   forceFailed    the searcher's neutral miss, the target shook them off, the room told;
 *   letGo          'Leave it', the force's clock, the searcher leaving, a refusal with `friskForce` off: the target and the room;
 *   gone           the target walked away: the searcher ('before answering', or after a refusal without it) and the room;
 *   interrupted    nothing thrown: the searcher alone, 'The moment has passed', with no word of the action - the searcher's
 *                  browser, where it still waits, hands it back by what it paid and says so (`FRISK_HANDED_BACK`, fx-1);
 *   settled        no card: a force whose dice landed after the gate shut, or a shut gate the force's clock found with no
 *                  follow from the searcher's browser, which alone could hand the action back (E80 fix r1-G2).
 * A target the GMs keep silent (a body nobody found, an incident's side) reads no card of its own: its card's words go to
 * the GMs alone (`cardToGms`), so every browser gets the documents a living target's end posts (E80 fix sec1-G1, the
 * owner's Q8, option A, over the design's step 8(d), 'no card of the target's'). Nor do the target and the
 * room of an ask that ended before it was asked (still "opening": `askToFrisk` reads where the two stand once its claim
 * has landed), as nobody there knew of it (E80 fix r1-G1, the review's E80-C3-2).
 */
async function endAsk(row, outcome) {
    if (!friskAsks.has(row.askId) || row.ending) return false;
    const asked = row.state !== "opening";
    row.ending = true;
    friskAsks.delete(row.askId);
    endedAsks.add(row.askId);
    for (const old of endedAsks) {
        if (endedAsks.size <= ENDED_KEPT) break;
        endedAsks.delete(old);
    }
    clearTimeout(row.timer);
    if (row.state === "asking" || row.state === "opening") emitTo(row.answerUserIds, { action: FRISK_CANCEL, askId: row.askId });
    await closeTicket(row);
    const searcher = game.actors.get(row.searcherId) ?? null;
    const target = game.actors.get(row.targetId) ?? null;
    const who = searcher?.name ?? "", them = target?.name ?? "";
    const asAsked = `<p><small>${game.i18n.localize("DRPG.Frisk.asAsked")}</small></p>`;
    const forTarget = { shown: "DRPG.Frisk.shown", forced: "DRPG.Frisk.forced", forceFailed: "DRPG.Frisk.forcedFailed", letGo: "DRPG.Frisk.letGo" };
    const forRoom = { shown: "DRPG.Frisk.wShown", forced: "DRPG.Frisk.wForced", forceFailed: "DRPG.Frisk.wForcedFailed",
        letGo: "DRPG.Frisk.wLetGo", gone: "DRPG.Frisk.wWalkedAway" };
    if (outcome === "shown") await cardTo(searcher, `${listOfLines(target, row.lines, "DRPG.Frisk.shownHeading")}${asAsked}`);
    else if (outcome === "forced") await cardTo(searcher, `${listOfLines(target, row.lines)}${asAsked}`);
    else if (outcome === "forceFailed") await cardTo(searcher, say("DRPG.Frisk.missed", { who: them }));
    // A target who refused and then walked away did answer: 'before answering' is for an ask still waiting (E80-C3-5).
    else if (outcome === "gone") await cardTo(searcher, say(row.state === "refused" ? "DRPG.Frisk.goneAfterNo" : "DRPG.Frisk.gone", { who: them }));
    else if (outcome === "interrupted") await cardTo(searcher, say("DRPG.Frisk.interrupted"));
    if (forTarget[outcome] && asked && target) {
        const words = say(forTarget[outcome], { who });
        await (row.silent ? cardToGms(words) : cardTo(target, words));
    }
    if (forRoom[outcome] && asked) await tellWitnesses(row, say(forRoom[outcome], { who, target: them }));
    log(`${who} frisked ${them} openly: ${outcome}${["shown", "forced"].includes(outcome) ? `, ${row.lines.length} item(s) listed` : ""}.`);
    answerSearcher(row, { askId: row.askId, outcome, forceMs: null });
    return true;
}

/**
 * The ticket `row`'s ask claimed (`row.claimed`), closed to a force once (roll-draw.mjs `endTicket`): by its end, by
 * `askToFrisk` when the row went while its claim was landing, or by a GM dropping its asks - whichever reads the claim
 * first, so no end closes another ask's ticket and none leaves this one open (E80 fix r1-G1, the review's E80-C3-2).
 */
async function closeTicket(row) {
    const { endTicket } = await import("./roll-draw.mjs");
    if (!row.claimed) return false;
    row.claimed = false;
    return endTicket(row.searcherId, "friskAsk");
}

/** The searcher's wait on its ask, answered once (`row.reply`, the bridge's late answer or a GM's own promise). */
function answerSearcher(row, value) {
    if (row.replied || typeof row.reply !== "function") return;
    row.replied = true;
    try {
        row.reply(value);
    } catch (err) {
        error("Could not answer a Frisk's ask", err);
    }
}

/**
 * The target refused, or did not answer in time (`state` "refused" or "noAnswer"): the searcher is told, and with the
 * GMs' `friskForce` on, may force it until `forceUntil` (`followFrisk`); with it off the ask ends as 'Leave it'. The
 * force's clock is set in the same tick as the state, before the card is awaited: a sweep that runs meanwhile - any
 * other ask's timer sweeps every row - read a refused row with no clock as one whose clock had run out, and ended it as
 * 'lets it go' before its force was offered (E80 fix r1-G1, the review's E80-C3-1).
 */
async function noYes(row, state) {
    const moved = standing(row);
    if (moved) return endAsk(row, moved);
    // The clock's own end: the window closes with no 'withdrawn' line, as nothing was withdrawn (the review's er-cor-9).
    if (row.state === "asking") emitTo(row.answerUserIds, { action: FRISK_CANCEL, askId: row.askId, clock: state === "noAnswer" });
    const force = getSetting(SETTINGS.friskForce) === true;
    row.state = state;
    if (force) {
        row.forceUntil = Date.now() + TIMING.friskForceMs;
        clearTimeout(row.timer);
        row.timer = setTimeout(() => sweepFriskAsks().catch(err => error("Could not end a Frisk's ask", err)),
            forceDrawnBy(row) - Date.now() + FRISK_MARGIN_MS + 50);
    }
    const target = game.actors.get(row.targetId) ?? null;
    await cardTo(game.actors.get(row.searcherId) ?? null, say(state === "refused" ? "DRPG.Frisk.refused" : "DRPG.Frisk.noAnswer", { who: target?.name }));
    if (!force) return endAsk(row, "letGo");
    if (!friskAsks.has(row.askId) || row.ending) return false;
    answerSearcher(row, { askId: row.askId, outcome: state, forceMs: TIMING.friskForceMs });
    return true;
}

/**
 * Every ask whose clock has run out, ended: an unanswered one is 'does not answer' (`noYes`) once the grace for an answer
 * pressed in the window's last moment has passed too (`FRISK_GRACE_MS`), a force nobody took 'lets it go' a little
 * (`FRISK_MARGIN_MS`) past the last moment its roll could be drawn (`forceDrawnBy`), for the follow already on its way -
 * or, where the gate has shut meanwhile (`standing`), ends with no card: the searcher's browser, which hands the action
 * back on an `interrupted` follow, sent none, so no card may say the action is back (E80 fix r1-G2, E80-C3-8). A row
 * whose state is being changed (a refusal whose force's clock is not set yet) is not read. The rows' timers call it;
 * `now` is the suite's, to read an ask's end without waiting a minute. Answers the ask ids it ended.
 *
 * On a GM that is no longer the primary (`isPrimaryGm`) it ends nothing and posts nothing: it drops every ask it holds
 * (`dropFriskAsks`), as a reload of this GM would - the searcher's wait runs out and hands the action back, an answer
 * goes to the new primary and is told `missing`, and 'Make them' finds no force open there (E80 fix r1-G1, E80-C3-6): its
 * follow, naming no roll of an ask the new primary never held, ends it `interrupted` (`followFrisk`, fx-2) - a player's
 * draw is refused there before its dice, and a GM's own force reads the change of primary before its dice (`gmForceShut`,
 * E80 fix r2-G3).
 */
export async function sweepFriskAsks(now = Date.now()) {
    if (!isPrimaryGm()) return dropFriskAsks();
    const ended = [];
    for (const row of [...friskAsks.values()]) {
        if (row.state === "asking" && now >= row.expiresAt + FRISK_GRACE_MS) {
            await noYes(row, "noAnswer");
            ended.push(row.askId);
        } else if (FORCEABLE.includes(row.state) && Number.isFinite(row.forceUntil) && now >= forceDrawnBy(row) + FRISK_MARGIN_MS) {
            const moved = standing(row);
            await endAsk(row, moved === "interrupted" ? "settled" : moved === "gone" ? "gone" : "letGo");
            ended.push(row.askId);
        }
    }
    return ended;
}

/**
 * An open Frisk's ask, judged on the primary GM (the A11 design's step 6): `{ refused }` with an English reason of the
 * bridge's closed list, `{ value }` for an outcome that ends it at once - askedAlready, targetBusy, youBusy, isBody, each
 * told on a card and the action handed back by the searcher's browser - or `{ later: true }`, the searcher's wait answered
 * by `reply(value)` when the target has answered or the clock has run: `{ askId, outcome, forceMs }`, `forceMs` the force's
 * window where one is open. `asker` is the user who asked: a death that user knows is a body's road (`isBody`).
 *
 * In order: the one gate (`personActionRefusal`); a death the asker knows; one live ask a searcher (youBusy), a target
 * answering one ask at a time (targetBusy, its window only, so nobody shields a suspect with ask after ask), one ask a
 * pair a time of day (askedAlready); the row written before anything is awaited, then the ticket of the asker's payment
 * claimed (roll-draw.mjs `claimTicket`; a GM's own pays nothing this GM counts) and the snapshot of the pockets taken
 * (vault.mjs `pocketsAsHeld`, cut to lines here: what is listed later is what they carried now). While the claim waits
 * for the payment the row is "opening", which no move ends (`friskRouteSettled`): once it has landed, the row gone
 * meanwhile closes the ticket it claimed (`endTicket`), and the two read where they stand (`standing`) end it before
 * anybody is asked - so no end leaves a payment claimed for an ask nobody holds (E80 fix r1-G1, the review's E80-C3-2).
 *
 * WHO ANSWERS (the design's step 8). The target's players who are connected (`ownerIdsOf`, active); a character with no
 * player, the GMs connected (`byGms`, 'You answer for {name}'); a player who is away, nobody, and the ask is 'does not
 * answer' at once with the force open (the owner's 3 = b). A target only the GMs know dead, or a side of the running
 * incident, is asked of nobody (`silent`): the GMs get a notice and the clock runs as for a living target, so the asker
 * cannot tell a body from silence. Each answerer gets `frisk.ask` addressed to them alone.
 */
export async function askToFrisk({ searcherId, targetId } = {}, { asker = null, reply = null, requestId = null } = {}) {
    const searcher = game.actors.get(searcherId) ?? null;
    const target = game.actors.get(targetId) ?? null;
    const why = personActionRefusal(searcher, target);
    if (why) {
        log(`Refused a Frisk's ask by ${searcher?.name ?? "?"} of ${target?.name ?? "?"}: ${why}.`);
        return { refused: why };
    }
    const early = async outcome => {
        const keys = { askedAlready: "DRPG.Frisk.askedAlready", targetBusy: "DRPG.Frisk.targetBusy", youBusy: "DRPG.Frisk.youBusy", isBody: "DRPG.Frisk.isBody" };
        await cardTo(searcher, say(keys[outcome], { who: target.name }));
        log(`${searcher.name}'s Frisk's ask of ${target.name}: ${outcome}, the action handed back.`);
        return { value: { askId: null, outcome, forceMs: null } };
    };
    if (knownBody(asker, target)) return early("isBody");
    const live = [...friskAsks.values()];
    if (live.some(row => row.searcherId === searcher.id)) return early("youBusy");
    if (live.some(row => row.targetId === target.id && ["opening", "asking"].includes(row.state))) return early("targetBusy");
    const pair = `${searcher.id}>${target.id}`, now = timeOfDayKey();
    if (askedPairs.get(pair) === now) return early("askedAlready");

    const place = gmPlaceOf(searcher);
    const askId = foundry.utils.randomID(16);
    const row = { askId, asker: asker?.id ?? null, requestId: typeof requestId === "string" && requestId ? requestId : null,
        searcherId: searcher.id, targetId: target.id, state: "opening", reply, replied: false,
        sceneId: place.scene?.id ?? null, level: floorKey(place.level), room: place.room, answerUserIds: [], byGms: false, silent: null,
        at: Date.now(), expiresAt: Infinity, forceUntil: null, lines: [], claimed: false, timer: null };
    friskAsks.set(askId, row);
    askedPairs.set(pair, now);
    const { claimTicket } = await import("./roll-draw.mjs");
    if (!asker?.isGM && !(await claimTicket(searcher.id, "friskAsk"))) {
        friskAsks.delete(askId);
        askedPairs.delete(pair);
        log(`Refused a Frisk's ask by ${searcher.name} of ${target.name}: no payment of theirs stands for it.`);
        return { refused: "no payment of that character's stands for that roll" };
    }
    row.claimed = !asker?.isGM;
    // Gone while its claim or its snapshot was awaited (dropped, ended, forgotten by the suite): the ticket it claimed is
    // closed here unless its end has closed it.
    if (!friskAsks.has(askId)) {
        await closeTicket(row);
        return { later: true };
    }
    const { pocketsAsHeld } = await import("./vault.mjs");
    row.lines = (await pocketsAsHeld(target, searcher, { undecided: "drop" })).map(friskLine);
    if (!friskAsks.has(askId)) {
        await closeTicket(row);
        return { later: true };
    }

    const owners = ownerIdsOf(target);
    const active = owners.filter(id => game.users.get(id)?.active);
    row.silent = isDeadForGm(target) ? "kept" : incidentParticipants().includes(target.id) ? "incident" : null;
    const moved = standing(row);
    if (moved) {
        await endAsk(row, moved);
        return { later: true };
    }
    row.byGms = !row.silent && !owners.length;
    row.answerUserIds = row.silent ? [] : row.byGms ? activeGmIds() : active;
    const away = owners.length > 0 && !active.length;
    const force = getSetting(SETTINGS.friskForce) === true;
    row.state = "asking";
    row.expiresAt = Date.now() + (away ? 0 : TIMING.friskAnswerMs);
    const seconds = Math.round(TIMING.friskAnswerMs / 1000);
    if (row.silent) {
        // `s` 0: the target's player is away, so the searcher hears at once (the GMs' line says so; the review's er-cor-6).
        emitTo(activeGmIds(), { action: FRISK_ASK, askId, notice: row.silent, who: searcher.name, name: target.name, s: away ? 0 : seconds });
    } else if (row.answerUserIds.length) {
        emitTo(row.answerUserIds, { action: FRISK_ASK, askId, who: searcher.name, name: target.name, ms: TIMING.friskAnswerMs, force, byGms: row.byGms });
    }
    log(`${searcher.name} asks ${target.name} to turn out their pockets (${row.silent ? `nobody asked: ${row.silent}` : away ? "nobody connected answers"
        : row.byGms ? "the GMs answer" : `${row.answerUserIds.length} player(s) asked`}).`);
    if (away || (!row.silent && !row.answerUserIds.length)) await noYes(row, "noAnswer");
    else row.timer = setTimeout(() => sweepFriskAsks().catch(err => error("Could not end a Frisk's ask", err)), TIMING.friskAnswerMs + FRISK_GRACE_MS + 50);
    return { later: true };
}

/**
 * A GM's own ask on the primary (gm-bridge.mjs `requestFriskAsk`, `local`): `{ refused }`, or `{ value }` once the ask has
 * the answer a player's bridge wait would get. The ask's own clocks answer it (`sweepFriskAsks`); one forgotten under it
 * answers null once both clocks and their margins are past, so no GM's Frisk waits forever.
 */
export function askToFriskHere(fields, asker) {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve({ value: null }), TIMING.friskAnswerMs + TIMING.friskForceMs + 2 * FRISK_MARGIN_MS);
        const done = out => {
            clearTimeout(timer);
            resolve(out);
        };
        askToFrisk(fields, { asker, reply: value => done({ value }) }).then(out => {
            if (out?.refused) done({ refused: out.refused });
            else if (!out?.later) done({ value: out?.value ?? null });
        }, err => {
            error("Could not ask for a Frisk", err);
            done({ value: null });
        });
    });
}

/**
 * An answer to an ask, judged on the primary by who Foundry says sent it (the design's step 6e): `{ outcome }` - the
 * ask's end, "shown", or "refused" - or `{ refused }`. Only the people the ask went to answer it (`answerUserIds`; a GM
 * for a character with no player), only while it is open, and the first answer stands: another's is `alreadyDone`, one
 * for an ask this primary does not hold `missing`. The two are read where they stand now (`standing`): a target gone is
 * 'gone', a searcher gone 'lets it go', an Eclipse or a trial 'interrupted'. Nothing in a searcher's packet says yes.
 */
export async function answerFrisk({ askId, allow = false } = {}, sender = null) {
    const row = friskAsks.get(askId ?? "");
    if (!row || row.ending) return { refused: "no such Frisk ask" };
    const answers = row.byGms ? Boolean(sender?.isGM) : row.answerUserIds.includes(sender?.id);
    if (!answers) return { refused: "sender does not own the character asked" };
    if (row.state !== "asking") return { refused: "that Frisk ask has been answered already" };
    row.state = "answered";
    emitTo(row.answerUserIds.filter(id => id !== sender?.id), { action: FRISK_CANCEL, askId: row.askId });
    const moved = standing(row);
    if (moved) {
        await endAsk(row, moved);
        return { outcome: moved };
    }
    if (allow) {
        await endAsk(row, "shown");
        return { outcome: "shown" };
    }
    await noYes(row, "refused");
    return { outcome: "refused" };
}

/**
 * After a refusal or no answer, the searcher's 'Make them' or 'Leave it' (the design's step 7), on the primary:
 * `{ outcome }` or `{ refused }`. Only the searcher's own ask, and only while its force is open (a refused or unanswered
 * row; `friskForceOpen` held the draw to `forceDrawnBy` and to the gate, and gm-bridge.mjs `friskForceRoll` holds a
 * player's roll to this ask's window). No `rollId` - 'Leave it', a close, the clock, or a force whose draw was refused -
 * is read where the two stand: the target 'lets it go', or walked away ('gone'), or, where the gate has shut since the
 * refusal (an Eclipse, the Class Trial, a death or an incident), `interrupted`: no dice were thrown, and the searcher's
 * browser hands the action back by what it paid (`FRISK_HANDED_BACK`; E80 fix r1-G2, the review's E80-C3-8). A roll:
 * Body against `ACTIONS.palm.frisk` - the list at the ask on a success or a critical, the neutral miss else - with the
 * room told either way. The two are read where they stand first; past the dice nothing is handed back, so a gate that
 * shut between the draw and this follow ends it with no card.
 *
 * An ask this primary does not hold: one it ended (`endedAsks`) is `missing`, as is a player's follow naming a roll; one
 * naming no roll of an ask it neither holds nor ended was dropped by a reload of this GM or by the GM primary before it,
 * while 'Make them?' was open - no dice thrown, so `interrupted`, with no card (nobody here holds its people), and the
 * searcher's browser hands the action back (STAGE's rule for a reload or a new primary; E80 fix r2-G1, the review's fx-2).
 * A console that names an ask nobody made is answered the same: its own browser's refund is all that follows, and that is
 * judged on the primary as any other (sheet-audit.mjs). A GM's own force naming its roll (`sender` a GM: a GM's roll is
 * thrown on its own browser, never drawn) of such an ask is `interrupted` too: that GM read the gate before its dice
 * (`gmForceShut`), and the ask went while its roll window was open, so the roll counts for nothing and its browser hands
 * the action back (E80 fix r2-G3, the review's r2fix-1). A player's never gets here: the bridge holds its roll to an ask
 * this primary holds (gm-bridge.mjs `friskForceRoll`).
 */
export async function followFrisk({ searcherId, askId, rollId = null, total = 0, isCritical = false } = {}, sender = null) {
    const row = friskAsks.get(askId ?? "");
    if (!row && askId && (!rollId || sender?.isGM) && !endedAsks.has(askId)) {
        log(`A Frisk's follow named an ask this GM neither holds nor ended (dropped by a reload or by the primary before it): interrupted, ${rollId ? "a GM's own roll counted for nothing" : "no dice thrown"}.`);
        return { outcome: "interrupted" };
    }
    if (!row || row.ending) return { refused: "no such Frisk ask" };
    if (row.searcherId !== searcherId) return { refused: "not their character" };
    if (!FORCEABLE.includes(row.state)) return { refused: "that cannot be done now" };
    if (!rollId) {
        const moved = standing(row);
        const outcome = moved === "gone" || moved === "interrupted" ? moved : "letGo";
        await endAsk(row, outcome);
        return { outcome };
    }
    if (getSetting(SETTINGS.friskForce) !== true) return { refused: "that cannot be done now" };
    const moved = standing(row);
    if (moved === "gone") {
        await endAsk(row, "gone");
        return { outcome: "gone" };
    }
    if (moved) {
        row.state = "ended";
        await endAsk(row, "settled");
        return { refused: "that cannot be done now" };
    }
    const { ACTIONS } = await import("./config.mjs");
    const won = Boolean(isCritical) || Number(total) >= ACTIONS.palm.frisk.threshold;
    await endAsk(row, won ? "forced" : "forceFailed");
    return { outcome: won ? "forced" : "forceFailed" };
}

/**
 * THE SEARCHER STOPPED WAITING (E18 C7, 26.10.2026; amend 5, the stage's row E18-31). The searcher's browser waits on its
 * ask for the answer's clock and a margin (gm-bridge.mjs `requestFriskAsk`), and when that wait runs out it hands the
 * action back. Nothing told this primary, which still held the ask: the target's yes after it posted the list to a
 * searcher whose action was back, and a refusal's force window stayed open until it ended 'lets it go' to the target and
 * the room (tier 2 "a Frisk's ask its searcher stopped waiting for ends on the primary", red at f7ac1e9d). The wait now
 * names E18's expiry (`ruling.expired`, bridge-guards.mjs `createWaiter`'s `expired`, with the ask's request id as `rid`),
 * and gm-bridge.mjs `expiredOnPrimary` hands it here: the ask held under that request id for that sender - Foundry's,
 * never the packet's - ends as `interrupted`, as a reload of this GM would have ended it: no dice thrown, the target's
 * window withdrawn, the searcher's card 'The moment has passed', no word to the target or the room (`endAsk`). One being
 * ended already, or another's, is left alone. Answers whether it ended one.
 *
 * THE EXPIRY IS A CLAIM (E18 fix c7-G1, 26.10.2026; the review's C7-SEC-1). It is the searcher's packet, and the one
 * thing it says - 'my wait ran out' - was taken as fact: the searcher's console, sending it seconds after its ask, took
 * the target's window away at will, and sent after a refusal it ended the ask with no word to the target or the room,
 * where 'Leave it' and the force's clock both tell them (`letGo`). The waiter sends it only when its clock runs out on a
 * wait nothing answered (bridge-guards.mjs `createWaiter`), so this primary reads it against what it knows. An ask whose
 * searcher it answered (`replied`: a refusal or no answer with the force open; any other answer ended the ask) ends as
 * the searcher's 'Leave it' would (`followFrisk` with no roll): by where the two stand, 'lets it go', 'gone' or
 * 'interrupted', the target and the room told - the honest case is an answer that reached the searcher after its clock,
 * whose browser handed the action back, and the force's clock would have ended it so. One it has not answered ends as
 * interrupted only once the searcher's wait could have run out: the bridge row's clock (gm-bridge.mjs `action.friskAsk`,
 * `timeoutMs`, friskAnswerMs + friskMarginMs) from `at`, less a trip (`FRISK_GRACE_MS`, the trip this file allows
 * elsewhere: the wait starts a trip before `at`, and its expiry takes one back) - before that it is left held and its
 * clocks run. `now` is the suite's.
 */
export async function expireFriskAsk(requestId, senderId, now = Date.now()) {
    if (typeof requestId !== "string" || !requestId || !senderId) return false;
    const row = [...friskAsks.values()].find(held => held.requestId === requestId && held.asker === senderId) ?? null;
    if (!row || row.ending) return false;
    if (row.replied) {
        if (!FORCEABLE.includes(row.state)) return false;
        const moved = standing(row);
        const outcome = moved === "gone" || moved === "interrupted" ? moved : "letGo";
        log(`The searcher's wait on a Frisk's ask ran out after it was answered (${row.state}): the ask ends as 'Leave it' would, ${outcome}.`);
        return endAsk(row, outcome);
    }
    if (now < row.at + TIMING.friskAnswerMs + TIMING.friskMarginMs - FRISK_GRACE_MS) {
        log(`A Frisk's expiry came before the searcher's wait could have run out (${row.state}): the ask is kept.`);
        return false;
    }
    log(`The searcher's wait on a Frisk's ask ran out (${row.state}): the ask ends interrupted, with no dice thrown.`);
    return endAsk(row, "interrupted");
}

/**
 * Every ask this GM holds dropped with nothing posted and nobody answered, each ticket it claimed closed to a force
 * (roll-draw.mjs `endTicket`): what a GM that is no longer the primary does with its asks (`sweepFriskAsks`), and one
 * whose socket came back (`friskSocketBack`). Answers the ask ids it dropped.
 */
async function dropFriskAsks(why = "This GM is no longer the primary") {
    const rows = [...friskAsks.values()];
    if (!rows.length) return [];
    for (const row of rows) {
        if (!friskAsks.has(row.askId) || row.ending) continue;
        clearTimeout(row.timer);
        friskAsks.delete(row.askId);
        await closeTicket(row);
    }
    log(`${why}: ${rows.length} Frisk ask(s) it held dropped with nothing posted.`);
    return rows.map(row => row.askId);
}

/**
 * THIS GM'S SOCKET CAME BACK (E18 fix c7-G1, 26.10.2026; the review's C7-SEC-2). Its "connect" after a drop, with its page
 * still loaded (`registerFrisk`). While the socket was down the other browsers saw this GM leave: a searcher waiting on an
 * ask this GM holds, with another GM taking over the primary, ended its wait at once (bridge-guards.mjs `primaryGone`) and
 * handed the action back, with no expiry sent - the GM it would go to had left. This GM, back with its memory, still held
 * the ask, and the target's yes after it posted the list to a searcher whose action was back. So a GM whose socket comes
 * back drops every ask it holds, with nothing posted, as a reload would have (A11: a reload or a new primary ends an ask
 * with no dice thrown): the searcher's wait, where it still runs, runs out and hands the action back, and an answer is
 * told `missing`. A drop without a reload is not measured on v14, nor whether its socket emits "connect" again
 * (LIVE-E04-04; gm-store.mjs listens for the same). Answers the ask ids it dropped; the first connect holds none.
 */
export function friskSocketBack() {
    if (!game.user?.isGM || !friskAsks.size) return Promise.resolve([]);
    return dropFriskAsks("This GM's socket came back").catch(err => {
        error("Could not drop a Frisk's asks", err);
        return [];
    });
}

/** For the suite: every ask this primary holds and every pair asked forgotten, their clocks stopped, nothing posted. */
export function forgetFriskAsks() {
    for (const row of friskAsks.values()) clearTimeout(row.timer);
    friskAsks.clear();
    endedAsks.clear();
    askedPairs.clear();
}

/* --- the windows, on the browsers the primary asks ---------------------------------------------------------------- */

/** This browser's open asks, by ask id: the window, its clock, and whether the primary withdrew it. */
const askWindows = new Map();

/**
 * Why this browser does not take a `frisk.ask` or `frisk.cancel`, or null: it is addressed to this user, and the primary
 * GM sent it (as passages.mjs `passageRowsRefusal` takes a copy). A player's console that sends one opens nothing.
 */
export function friskPacketRefusal(payload, senderId, { me = game.user, users = game.users, primary = primaryGmId() } = {}) {
    if (payload?.userId !== me?.id) return "addressed to somebody else";
    if (!users?.get(senderId)?.isGM) return "not sent by a GM";
    if (senderId !== primary) return "not sent by the primary GM";
    return null;
}

/** A `frisk.ask` or `frisk.cancel` on this browser; answers whether it was taken. */
export async function onFriskPacket(payload, senderId) {
    if (![FRISK_ASK, FRISK_CANCEL].includes(payload?.action)) return false;
    const why = friskPacketRefusal(payload, senderId);
    if (why) {
        debug(`A "${payload.action}" was not taken: ${why}.`);
        return false;
    }
    if (payload.action === FRISK_CANCEL) return withdrawAsk(payload.askId, { clock: payload.clock === true });
    if (payload.notice) {
        const s = Number(payload.s) || 0;
        const key = `DRPG.Frisk.${payload.notice === "kept" ? "gmKept" : "gmIncident"}${s > 0 ? "" : "Now"}`;
        toast(game.i18n.format(key, { who: payload.who ?? "", target: payload.name ?? "", s }));
        return true;
    }
    openAskWindow(payload).catch(err => error("Could not open a Frisk's window", err));
    return true;
}

/**
 * A line of a Frisk's on this browser's toast, kept in its notice history (notice-history.mjs `recordNotice`) so a GM
 * who missed the toast still reads why nobody was asked. Text only: the toast and the entry draw no markup. Titled
 * "Frisk" by a key of its own (H81-11): the Palm window's row, whose words it took until then, says what to do now.
 */
function toast(text) {
    ui.notifications.info(text);
    import("./notice-history.mjs")
        .then(({ recordNotice }) => recordNotice({ kind: "info", source: "mine", state: "unread", title: game.i18n.localize("DRPG.Frisk.noticeTitle"), text }))
        .catch(err => debug("A Frisk's line could not be kept in this browser's history", err));
}

/**
 * The primary withdrew an ask: its window closes with 'The request is withdrawn.', and nothing is answered from it. At
 * the answer's clock (`clock`) it closes with no line: nothing was withdrawn, the silence counts as a refusal and the
 * searcher may force (the review's er-cor-9).
 */
function withdrawAsk(askId, { clock = false } = {}) {
    const open = askWindows.get(askId ?? "");
    if (!open) return false;
    open.withdrawn = true;
    clearTimeout(open.timer);
    if (open.dialog?.rendered) open.dialog.close();
    if (!clock) toast(game.i18n.localize("DRPG.Frisk.withdrawn"));
    return true;
}

/**
 * The target's window (the design's step 6d): 'Turn out your pockets?', the asker and the character asked about by
 * name, the clock, 'Refuse' first and the default, 'Let them look'. A close, Escape or the clock is a refusal; the clock
 * closes it with nothing sent, since the primary has run the same clock. The answer goes back by the bridge. A module
 * panel (`drpg-panel`), as the Palm window that asked it is, and 'Make them?' too: the module's width and each theme's
 * frame (E80 fix r2-G2, the mock-up pass's mk-3: both opened as Foundry's bare 400 px dialog).
 */
async function openAskWindow({ askId, who = "", name = "", ms = 0, force = false, byGms = false }) {
    const open = { withdrawn: false, timer: null, dialog: null };
    askWindows.set(askId, open);
    const text = [byGms ? say("DRPG.Frisk.gmFor", { name }) : "",
        say(force ? "DRPG.Frisk.askText" : "DRPG.Frisk.askTextAskOnly", { who, name }),
        `<p><small>${game.i18n.format("DRPG.Frisk.askClock", { s: Math.round((Number(ms) || 0) / 1000) })}</small></p>`].join("");
    const { DialogV2 } = foundry.applications.api;
    let answer = null;
    try {
        answer = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Frisk.askTitle") },
            classes: ["drpg-panel"],
            content: dialogContent(text),
            rejectClose: false,
            buttons: [
                { action: "refuse", label: game.i18n.localize("DRPG.Frisk.refuse"), default: true, autofocus: true },
                { action: "allow", label: game.i18n.localize("DRPG.Frisk.allow") }
            ],
            render: (event, dialog) => {
                open.dialog = dialog;
                open.timer = setTimeout(() => {
                    open.withdrawn = true;
                    if (dialog.rendered) dialog.close();
                }, Math.max(0, Number(ms) || 0));
            }
        });
    } finally {
        clearTimeout(open.timer);
        askWindows.delete(askId);
    }
    if (open.withdrawn) return null;
    const { requestFriskAnswer } = await import("./gm-bridge.mjs");
    const res = await requestFriskAnswer({ askId, allow: answer === "allow" });
    return res.ok ? res.value ?? null : null;
}

/**
 * The searcher's 'Make them?' (the design's step 7): Body {force}+, the room will see it, the seconds left. True for
 * 'Make them'; 'Leave it', a close or the clock is false.
 */
async function askToForce(def, forceMs) {
    const { DialogV2 } = foundry.applications.api;
    let timer = null;
    try {
        const picked = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Frisk.forceTitle") },
            classes: ["drpg-panel"],
            content: dialogContent(say("DRPG.Frisk.forceText", { force: def?.frisk?.threshold, s: Math.round(forceMs / 1000) })),
            rejectClose: false,
            buttons: [
                { action: "leave", label: game.i18n.localize("DRPG.Frisk.leave"), default: true },
                { action: "force", label: game.i18n.localize("DRPG.Frisk.force") }
            ],
            render: (event, dialog) => {
                timer = setTimeout(() => { if (dialog.rendered) dialog.close(); }, forceMs);
            }
        });
        return picked === "force";
    } finally {
        clearTimeout(timer);
    }
}

/** Whether the GMs keep `target` out of an ask as it stands now: a death only they hold, or a side of the running incident. */
function keptSilent(target) {
    return isDeadForGm(target) || incidentParticipants().includes(target.id);
}

/**
 * Whether a GM's own force of `searcher` on `target` may not be thrown now (E80 fix r2-G1, the review's fx-3). A player's
 * force is drawn on the primary, which reads `friskForceOpen` before the dice (roll-draw.mjs `drawRefusal`); a GM's own
 * is thrown on its own browser, where no draw is judged, so it is read here first. The primary reads `friskForceOpen`
 * itself; a GM that is not the primary holds no ask, and reads the same gate off what every GM holds: the GMs'
 * `friskForce`, the one gate (`personActionRefusal`), and a death or an incident of the target's that was not there at
 * the ask (`silentAtAsk`, as the primary's `standing` leaves a target kept silent at the ask as it was).
 *
 * E80 fix r2-G3 (the review's r2fix-1): first, where its ask went. The GM that was the primary as it asked (`heldBy`, at
 * `askedAt`) held it in its memory alone; once another GM is the primary, or that GM has left since (a reload: `gmLeftAt`),
 * the ask went with it, so no dice are thrown, the follow names no roll and the primary ends it `interrupted`, the action
 * handed back. An ask that goes while the roll window is open is the primary's to read (`followFrisk`).
 */
function gmForceShut(searcher, target, silentAtAsk, heldBy = null, askedAt = 0) {
    if (isPrimaryGm()) return !friskForceOpen(searcher.id);
    if (!heldBy || primaryGmId() !== heldBy || (gmLeftAt.get(heldBy) ?? -Infinity) >= askedAt) return true;
    if (getSetting(SETTINGS.friskForce) !== true || personActionRefusal(searcher, target)) return true;
    return !silentAtAsk && keptSilent(target);
}

/**
 * The searcher's browser, an open Frisk of `victim` (the design's steps 6, 7 and 12). The action is paid first, as a
 * Palm's; the primary is asked (`requestFriskAsk`) and its answer awaited. No GM, a refusal, no answer from the primary,
 * an ask that ended before its row (askedAlready, targetBusy, youBusy, isBody) or one interrupted with no dice thrown:
 * the action back as it was paid (`abort`, its receipt: a Burst as a Burst, a free Frisk nothing). The list,
 * the refusal and every other line are the primary's cards. After a refusal or no answer with a force open: 'Make them?',
 * and 'Make them' throws Body (`frisk`, remembered: an armed Call is eaten by it) on the ask's payment and names it; 'Leave
 * it', a close or the clock names none. `drpgActionResolved` goes out only after that roll, as `palm` with `direction:
 * "frisk"` and `mode: "openly"`.
 *
 * E80 fix r2-G1: an action handed back for an `interrupted` ask is said here, 'Your action is back.', where it is handed
 * back and only where something was paid (fx-1); a follow the primary answers `interrupted` because a reload or a new
 * primary dropped the ask while 'Make them?' was open hands it back as well (fx-2); and a GM's own 'Make them' reads the
 * force's gate before its dice (`gmForceShut`), so a gate shut meanwhile throws nothing, eats no Call and ends the ask
 * `interrupted` (fx-3). A gate that shuts while that GM's own roll window is open is read again as the dice come back
 * (E80 fix r2-G2): the roll counts for nothing, though its dice were thrown and its window's Calls spent.
 *
 * E80 fix r2-G3: a GM that is not the primary reads where its ask went before its dice (`gmForceShut`: the GM that held
 * it is not the primary any more, or has left since), and one whose ask went while its roll window was open is answered
 * `interrupted` (`followFrisk`) - either way the action is handed back (r2fix-1). A force is reported and told resolved
 * only once the primary judged it, `forced` or `forceFailed`: a roll the primary did not count is nobody's result. And a GM's
 * own force the gate stopped or voided is told 'cannot be done now', as a player's draw refused is (r2fix-2).
 */
async function performFriskOpenly(actor, def, victim, { cost = def?.cost ?? 1, room = null } = {}) {
    const A = await import("./action-rolls.mjs");
    const { spendAction } = await import("./actions.mjs");
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const handBack = async () => {
        await A.abort(actor, paid);
        if (paid) toast(game.i18n.localize("DRPG.Frisk.actionBack"));
        return null;
    };
    // What the GMs hold of the target as the ask is made: a GM's own force reads a death or an incident that came after.
    const silentAtAsk = game.user?.isGM ? keptSilent(victim) : false;
    // Who holds the ask: the primary as it is asked (`gmForceShut`).
    const heldBy = primaryGmId(), askedAt = Date.now();
    toast(game.i18n.format("DRPG.Frisk.waiting", { who: victim.name }));
    const { requestFriskAsk, requestFriskFollow } = await import("./gm-bridge.mjs");
    const res = await requestFriskAsk({ searcherId: actor.id, targetId: victim.id });
    const asked = res.ok ? res.value : null;
    if (asked?.outcome === "interrupted") return handBack();
    if (!asked?.outcome || FRISK_HANDED_BACK.includes(asked.outcome)) return A.abort(actor, paid);
    const base = { direction: "frisk", mode: "openly", target: victim.name, asked: asked.outcome };
    if (!FORCEABLE.includes(asked.outcome) || !asked.forceMs || !asked.askId) return base;

    const pressed = await askToForce(def, asked.forceMs);
    const gmOwn = Boolean(game.user?.isGM);
    const shut = () => gmOwn && gmForceShut(actor, victim, silentAtAsk, heldBy, askedAt);
    const stopped = pressed && shut();
    let roll = pressed && !stopped ? await A.rollTrait(actor, def.frisk.trait, {
        actionKey: "frisk", dc: def.frisk.threshold, title: A.palmTitle("frisk", def), titled: true,
        context: { room, victimId: victim.id, direction: "frisk", mode: "openly" }
    }) : null;
    // A GM's own roll window stood open while the gate shut (E80 fix r2-G2, r2-G1's gap): read again as the dice come
    // back, before anything is played, reported or told resolved. Shut: the roll counts for nothing - no card, no
    // `drpgActionResolved`, the follow names no roll, so the primary reads where the two stand and ends the ask
    // `interrupted` (the action handed back below) or 'lets it go' past the force's window, as it does for a player's
    // draw refused before its dice. What stays: the dice were thrown on this GM's browser (Daggerheart's message,
    // claimed and never shown, and the GMs' Reroll row, which says `friskStands`), and the Calls its window applied,
    // spent as the window closed - a player's force keeps them, since the primary refuses its draw before spending.
    const voided = Boolean(roll) && shut();
    if (voided) {
        log("A GM's own Frisk force came back from its roll window after the gate shut: the roll counts for nothing.");
        roll = null;
    }
    const follow = await requestFriskFollow({ searcherId: actor.id, askId: asked.askId,
        rollId: roll ? A.rollInHand(actor)?.messageId ?? null : null, total: roll?.total ?? 0, isCritical: Boolean(roll?.isCritical) });
    // The primary read the gate shut or the ask dropped ('interrupted'): the action back as it was paid, a roll thrown or
    // not (E80-C3-8, fx-2, fx-3, r2fix-1).
    if (follow.ok && FRISK_HANDED_BACK.includes(follow.value)) return handBack();
    // A GM's own force the gate stopped or voided, its follow carried out ('lets it go', 'gone'): said as a player's
    // refused draw is (r2fix-2). A follow refused has been said by its request already.
    if ((stopped || voided) && follow.ok) sayNotDone("action.friskFollow", "cannotNow");
    if (!roll) return base;
    if (!follow.ok || !["forced", "forceFailed"].includes(follow.value)) {
        log(`A Frisk force's roll was not judged a force on the primary (${follow.ok ? follow.value : follow.reason}): it counts for nothing.`);
        return base;
    }
    const success = Boolean(roll.isCritical) || roll.total >= def.frisk.threshold;
    // As the hand's: the force keeps the key it was thrown as (`frisk`, reroll.mjs `settleForce`).
    await A.noteRollContext(actor, { direction: "frisk", mode: "openly", room, victimId: victim.id, success });
    const outcome = { ...base, success, text: game.i18n.format("DRPG.Frisk.forceSent", { name: victim.name }) };
    await A.report(actor, def, roll, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "palm", roll, outcome });
    return outcome;
}

/**
 * The primary GM, when a token's route settles (movement.mjs `drpgRouteSettled`): an ask whose target walked out of its
 * room is 'gone' and one whose searcher did 'lets it go', at once rather than at its next answer or clock. An ask still
 * "opening" is left to `askToFrisk`, which reads where the two stand once its claim has landed (E80-C3-2).
 */
export async function friskRouteSettled({ tokenDoc, provisional = false } = {}) {
    if (!isPrimaryGm()) return [];
    if (provisional && !(await provisional)) return [];
    const actorId = tokenDoc?.actorId ?? tokenDoc?.actor?.id ?? null;
    const ended = [];
    for (const row of [...friskAsks.values()]) {
        if (!actorId || (row.searcherId !== actorId && row.targetId !== actorId) || row.ending || row.state === "opening") continue;
        const moved = standing(row);
        if (moved === "gone" || moved === "letGo") {
            await endAsk(row, moved);
            ended.push([row.askId, moved]);
        }
    }
    return ended;
}

/**
 * Every browser: the `frisk.ask` and `frisk.cancel` listener; the primary: the watch on routes; a GM holding asks: when a
 * user connects or leaves and this GM is no longer the primary, it drops them at once (`dropFriskAsks`), not at the next
 * clock's sweep; every GM's browser: a GM that leaves is noted (`friskUserConnected`, E80 fix r2-G3), and a GM whose
 * socket comes back drops its asks (`friskSocketBack`, E18 fix c7-G1). Called once (gm-bridge.mjs).
 */
export function registerFrisk() {
    game.socket.on(SOCKET_EVENT, (payload, senderId) => {
        if (payload?.action !== FRISK_ASK && payload?.action !== FRISK_CANCEL) return;
        onFriskPacket(payload, senderId).catch(err => error("Could not take a Frisk's packet", err));
    });
    Hooks.on("drpgRouteSettled", data => {
        friskRouteSettled(data).catch(err => error("Could not read a Frisk's ask after a move", err));
    });
    Hooks.on("userConnected", (user, connected) => {
        friskUserConnected(user, connected).catch(err => error("Could not drop a Frisk's asks", err));
    });
    // A GM's socket that comes back without a reload (E18 fix c7-G1): what it held is dropped, as a reload would.
    game.socket.on("connect", friskSocketBack);
}

/**
 * A user connected or left, on this browser (`registerFrisk`'s `userConnected`): a GM that left is noted (`gmLeftAt`), and
 * a GM holding asks that is no longer the primary drops them (`dropFriskAsks`). Answers the ask ids it dropped.
 */
export async function friskUserConnected(user, connected) {
    if (user?.isGM && connected === false) gmLeftAt.set(user.id, Date.now());
    if (game.user?.isGM && friskAsks.size && !isPrimaryGm()) return dropFriskAsks();
    return [];
}
