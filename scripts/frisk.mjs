/**
 * Danganronpa RPG - Frisk, a Palm's third direction: seeing what somebody carries (E80 part 2, the A11 design).
 * ---------------------------------------------------------------------------
 * What the primary GM holds of an open Frisk. The asks live in this GM's memory, never in a store, a flag or a
 * setting: a reload or a new primary ends them with no dice thrown (the design's risk 3; E18 may move them). C0
 * builds only what a drawn roll asks of them - whether a searcher may force one now - and the map stays empty
 * until the ask's road (C3) writes it. C1 adds what the primary reads of the people in the room: whether one person
 * may act on another now (`personActionRefusal`) and who else stands there to see it (`roomWitnessesOnGm`). C2 adds
 * the unseen Frisk: the searcher's browser throws the cover and the hand (`performFrisk`) and the primary judges the
 * two on the GMs' records of them and posts the cards (`friskPerson`, asked through gm-bridge.mjs `action.friskUnseen`).
 */

import { SETTINGS, getSetting, isEclipse, isDeadForGm, incidentParticipants } from "./settings.mjs";
import { MODULE_ID, FLAGS, ITEM_CATEGORIES } from "./config.mjs";
import { gmPlaceOf, lawfulRoomOf } from "./movement.mjs";
import { witnessesOf } from "./chapter.mjs";
import { studentActors } from "./monokuma.mjs";
import { flagsHeldNow } from "./sheet-audit.mjs";
import { inClassTrial } from "./trial.mjs";
import { esc, log, whisperToOwner } from "./utils.mjs";
import { knowsOfDeath } from "./incident-store.mjs";

/**
 * The asks this primary GM holds, by ask id: `{ searcherId, targetId, state, forceUntil }`. `state` is "refused" or
 * "noAnswer" once the target refused or the answer's clock ran out, and from then until `forceUntil` (epoch ms) the
 * searcher may force it; any other state is no force.
 */
export const friskAsks = new Map();

/** The states of an ask that open a force (the owner's 1 = a: after a refusal or no answer, never before). */
const FORCEABLE = Object.freeze(["refused", "noAnswer"]);

/**
 * Whether `searcherId` may draw a Frisk's force now: the GMs' `friskForce` is on and an ask of theirs stands refused or
 * unanswered inside its window. Asked by roll-draw.mjs `drawRefusal` before a `frisk` roll takes its ticket.
 */
export function friskForceOpen(searcherId, now = Date.now()) {
    if (!searcherId || getSetting(SETTINGS.friskForce) !== true) return false;
    for (const row of friskAsks.values()) {
        if (row?.searcherId === searcherId && FORCEABLE.includes(row.state) && Number(row.forceUntil) > now) return true;
    }
    return false;
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
 */
export function personActionRefusal(asker, target) {
    if (!asker || !target || asker.type !== "character" || target.type !== "character") return "no such character";
    if (asker.id === target.id) return "a character cannot do that to itself";
    const [mine, theirs] = [flagsHeldNow(asker), flagsHeldNow(target)];
    if (mine.getFlag(MODULE_ID, FLAGS.monokuma)) return "a Monokuma takes no part in that";
    if (mine.getFlag(MODULE_ID, FLAGS.monocub) || theirs.getFlag(MODULE_ID, FLAGS.monocub)) return "a Monocub takes no part in that";
    if (isDeadForGm(asker)) return "that cannot be done now";
    const here = gmPlaceOf(asker);
    if (!here?.room) return "the character has no token on a scene";
    // A Monokuma on the map is the GM standing there, and a hidden token is nobody the room can see: neither is
    // somebody in the room, as movement.mjs `othersInRoom` offers the asker's window its targets.
    const there = theirs.getFlag(MODULE_ID, FLAGS.monokuma) ? null : gmPlaceOf(target);
    if (!there?.room || there.tokenDoc?.hidden || there.scene?.id !== here.scene?.id || floorKey(there.level) !== floorKey(here.level)
        || there.room !== here.room) return "the character is not in that room";
    if (isEclipse()) return "an Eclipse is running";
    if (inClassTrial()) return "that waits until the Class Trial is over";
    if (incidentParticipants().includes(asker.id)) return "the character is a side of the running incident";
    return null;
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
    const who = esc(target?.name ?? "");
    if (!pockets?.length) return `<p>${game.i18n.format("DRPG.Frisk.empty", { who })}</p>`;
    return `<p>${game.i18n.format("DRPG.Frisk.listHeading", { who })}</p><ul>${pockets.map(item => `<li>${friskLine(item)}</li>`).join("")}</ul>`;
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
 * A target the GMs alone know dead feels nothing: it is never noticed and is told nothing, so the searcher's card
 * reads as at a living, unaware target.
 *
 * Every card is veiled (utils.mjs `whisperToOwner(..., { veiled: true })`): its document is addressed to every
 * browser in nobody's voice, and its words go only to its readers. The list is the pockets as the GMs hold them now
 * (vault.mjs `pocketsAsHeld`, an undecided item left out with a line in the GM's log), never sent anywhere but that
 * card. Beside the cards it writes nothing: no flag, no item, no setting.
 */
export async function friskPerson({ searcherId, targetId, total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false } = {},
    { asker = null } = {}) {
    const searcher = game.actors.get(searcherId) ?? null;
    const target = game.actors.get(targetId) ?? null;
    const refuse = why => {
        log(`Refused a Frisk by ${searcher?.name ?? "?"} of ${target?.name ?? "?"}: ${why}.`);
        return { refused: why };
    };
    const why = personActionRefusal(searcher, target);
    if (why) return refuse(why);
    const body = isDeadForGm(target);
    if (body && knowsOfDeath(asker, target.id)) return refuse("that cannot be done now");

    const { ACTIONS } = await import("./config.mjs");
    const part = ACTIONS.palm.rummage;
    const sees = Boolean(isCritical) || Number(total) >= part.threshold;
    const noticed = !body && !(Boolean(unseenCritical) || Number(unseenTotal) >= part.unseen);
    const { pocketsAsHeld } = await import("./vault.mjs");
    const pockets = sees ? await pocketsAsHeld(target, searcher, { undecided: "drop" }) : [];

    const who = esc(target.name);
    const seenLine = `<p><small>${game.i18n.localize(noticed ? "DRPG.Steal.cardSeen" : "DRPG.Steal.cardUnseen")}</small></p>`;
    await whisperToOwner(searcher, `${sees ? friskListHtml(target, pockets) : `<p>${game.i18n.format("DRPG.Frisk.missed", { who })}</p>`}${seenLine}`,
        { veiled: true });
    if (noticed) {
        await whisperToOwner(target, `<p>${game.i18n.format(sees ? "DRPG.Frisk.caught" : "DRPG.Frisk.caughtTrying", { who: esc(searcher.name) })}</p>`,
            { veiled: true, flags: { [MODULE_ID]: { sfx: "stolen" } } });
    }
    log(`${searcher.name} frisked ${target.name} unseen: ${sees ? `saw ${pockets.length} item(s)` : "got no proper look"}, ${noticed ? "noticed" : "unnoticed"}.`);
    return { outcome: "settled" };
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
    const A = await import("./action-rolls.mjs");
    const { spendAction } = await import("./actions.mjs");
    const part = def.rummage;
    const paid = cost > 0 ? await spendAction(actor, cost) : null;
    if (cost > 0 && !paid) return null;
    const shadow = await A.rollTrait(actor, def.unseen.trait, {
        remember: false, actionKey: "palm", title: game.i18n.localize("DRPG.Steal.unseenRoll"), dc: part.unseen
    });
    if (!shadow) return A.abort(actor, paid);
    const hand = await A.rollTrait(actor, part.trait, {
        actionKey: "rummage", dc: part.threshold, title: part.label,
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
    // As a Palm's: the GMs' row keeps the key the hand was told as (`rummage`), which is the Reroll's (the design's step 11).
    await A.noteRollContext(actor, { actionKey: "palm", direction: "frisk", mode, room, victimId: victim.id, seen, success });
    // "Sent" only when the primary judged it (E31): a request it did not carry out has been said once already.
    const outcome = {
        success, seen, direction: "frisk", mode, target: victim.name,
        text: res.ok && res.value ? game.i18n.format("DRPG.Frisk.sent", { name: esc(victim.name) }) : ""
    };
    await A.report(actor, def, hand, outcome);
    Hooks.callAll("drpgActionResolved", { actor, actionKey: "palm", roll: hand, outcome });
    return outcome;
}
