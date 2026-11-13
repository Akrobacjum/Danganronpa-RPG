/**
 * Danganronpa RPG - Monocub.
 * ---------------------------------------------------------------------------
 * Guide, p. 16: "Po śmierci, gdy jego class trial się zakończy, gracz może
 * dołączyć do DMów jako Monocub." A dead student's player, opted in by
 * agreement with the table, keeps the same character sheet and gets exactly
 * two things to do with it: Move, and Meddle - nudging a living player's next
 * roll from the sidelines. Meddle is one row of `MONOCUB.abilities` (E33 C10): the
 * table and its executor are under THE ABILITIES below.
 *
 * A Monocub is not a Monokuma. It stays a `character` actor with no special
 * flag on the token, keeps the normal action budget (refilled by the same
 * pass that refills everyone else - nothing to change there), and keeps the
 * same room-restricted vision every other student has. What changes is the
 * action panel on the sheet: the abilities' tiles instead of the full grid
 * (Meddle first; the Move tile beside it went in E103 - the token moves, free),
 * and a Hope total that only a GM can top up, by converting their own Despair.
 *
 * MEDDLE'S ROLL. The guide marks its difficulty table "Stat: -" - the one roll
 * in the system with no trait behind it. Daggerheart's own `rollTrait` insists
 * on a real trait key, so this is not built through it: a flat 2d12, crit on
 * doubles, exactly Daggerheart's own duality math with the trait modifier
 * removed. `private-rolls.mjs` already rewrites any chat message carrying a
 * roll into a GM-and-roller whisper regardless of how the roll was built, so
 * this one is private for free.
 *
 * THROWN BY THE GM (E08+E28 C17, 04.10.2026; audit S10-06). The Monocub's browser
 * threw the 2d12 and sent the GM its total and its critical, which the GM scored as
 * said. A plain `Roll` is not one the GM's draw takes (roll-draw.mjs reads a duality
 * roll's build), so the GM throws this one itself where it scores it (`cubAbilityOnGm`),
 * and answers the roll; the Monocub's browser posts the card from it as it posted its
 * own - its message, its readers, its dice on its screen - so the roll still reads
 * as the Monocub's. The card is posted once the GM has whispered the outcome, where it
 * used to be posted before the GM was asked.
 *
 * MEDDLE'S EFFECT. Reuses the Call machinery Support and Obstacle already use
 * (`armCall` in call-effects.mjs) rather than inventing a second one. That
 * also means "help a crisis action" costs nothing extra: an incident roll
 * goes through the identical roll dialog, so an armed Meddle bonus applies to
 * it exactly as it would to an ordinary action roll. Where it waits is not the
 * target's flag but the GMs' store and the target's owner's copy (E06 fix r2-G4):
 * `appendArmedCall` sends it there.
 */

import { MODULE_ID, FLAGS, MONOCUB, ACTIONS_RESOURCE, HOPE_CALLS, DESPAIR_CALLS } from "./config.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { isDeceased, isDeadForGm } from "./chapter.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { actionsLeft, spendAction, refundAction } from "./actions.mjs";
import { getClock } from "./clock.mjs";
import { seasonEpoch, sameSeason, deathRecord, getSetting, SETTINGS, bodyFoundSinceTrial } from "./settings.mjs";
import { isMonocubCorpse } from "./spectator.mjs";
import { resolveThreshold, whisperToOwner, log, warn, error, plural, isPrimaryGm, primaryGmId, wholeNumber, serialWrite, ownerOf, serverNow } from "./utils.mjs";
import { cubStore, cubCopy, cubTargetStore, bountyStore, projectWorkStore } from "./gm-stores.mjs";
import { gmStoresQuiet, newestIn, whenGmStoresAudible } from "./gm-store.mjs";
import { senderOf, replyForMe } from "./bridge-guards.mjs";
import { blackenedIds as blackenedIdsNow } from "./incident-store.mjs";
import { drpgWindow } from "./ui-kit.mjs";
// Confusion's window is a Call window (E51 C2): call-pickers.mjs reaches this file only through a lazy import().
import { callWindow, callHeader, callRowsHtml, pickedRow } from "./call-pickers.mjs";

/* ==========================================================================
 * STATUS
 * ========================================================================== */

/** Is this student a Monocub? */
export function isMonocub(actor) {
    return Boolean(actor?.getFlag(MODULE_ID, FLAGS.monocub));
}

/**
 * WHETHER THE TRIAL IS ABOUT THIS MONOCUB'S OWN DEATH (E70 C5, 28.10.2026; the owner's DC29 = DC41 = 1: "Słuchasz: to
 * rozprawa w twojej sprawie"). A student who died in this chapter of this season, not by an execution, and whose chapter
 * has no verdict yet (the record's `lastVerdictAt`, E70 C4): the trial running is theirs, so as a Monocub they listen -
 * information only, the module mutes no Monocub. A second murder in a chapter whose first trial gave its verdict (D17)
 * is told by the verdict its death names (`sinceVerdict`, chapter.mjs `verdictBefore`, E70 fix p1-G3): its case is open
 * while no later verdict came. `clock`, `record` (the stored trial record) and `epoch` can be handed in (tier 1 R1034).
 */
export function ownCaseOpen(actor, { clock = getClock(), record, epoch = seasonEpoch() } = {}) {
    if (!isMonocub(actor)) return false;
    const stored = record === undefined ? (getSetting(SETTINGS.trialProgress) ?? {}) : (record ?? {});
    return caseOpen(deathRecord(actor), clock, stored, epoch);
}

/**
 * Whether the case of the death `death` is open (pure; cut out of `ownCaseOpen` by E63 C3, 11.11.2026, which reads it
 * without the Monocub gate for a 1.2.104 world's bodies, migrate.mjs `bodiesToLay`): a death in the clock's chapter and
 * the season `epoch`, not by an execution, whose chapter has no verdict in the stored trial record `record` after it.
 */
export function caseOpen(death, clock, record, epoch) {
    if (!death || death.cause === "executed" || death.chapter !== clock?.chapter) return false;
    if (death.epoch !== undefined && death.epoch !== null && death.epoch !== epoch) return false;
    const stored = record ?? {};
    const verdict = stored.chapter === clock.chapter ? (stored.lastVerdictAt ?? null) : null;
    // A death that names the verdict before it (E70 fix p1-G3, chapter.mjs `verdictBefore`): open while no later verdict
    // came; an older record, written before the field, as before - open only in a chapter with no verdict yet.
    if (Object.hasOwn(death, "sinceVerdict")) return !verdict || verdict === death.sinceVerdict;
    return !verdict;
}

/**
 * WHOM THE WRONG VERDICT'S CARD REACHES (the E101 line's review of 1.2.110, V4, 13.11.2026). E72 C7 told every Monocub
 * whose death's chapter was the clock's, with no season and no verdict: at a chapter's second trial the first case's
 * Monocub was told too, and after a reset that keeps the Monocubs last season's dead of the same chapter number. Now a
 * Monocub is told when its death's case is the one judged (`caseOpen`, against the chapter's verdict before this one,
 * `before`, and the season `epoch`), or when it was marked a crime witness this chapter of this season since that verdict
 * (the mark's `sinceVerdict`, written by `setSilenced`; a mark from before the field reads as before). Pure: `death` is the
 * Monocub's death record, `witness` its row's mark. verdict.mjs `remindOnWrongVerdict` asks it; tier 1 R4474.
 */
export function wrongVerdictTouches({ death = null, witness = null } = {}, { chapter, epoch, before = null } = {}) {
    if (caseOpen(death, { chapter }, { chapter, lastVerdictAt: before ?? null }, epoch)) return true;
    const mark = typeof witness === "number" ? { chapter: witness } : witness;
    if (!mark || typeof mark !== "object" || mark.chapter !== chapter) return false;
    if (mark.epoch !== undefined && mark.epoch !== null && mark.epoch !== epoch) return false;
    if (Object.hasOwn(mark, "sinceVerdict")) return !before || (mark.sinceVerdict ?? null) === before;
    return true;
}

/** Every Monocub in the world. */
export function monocubActors() {
    return game.actors.filter(a => a.type === "character" && isMonocub(a));
}

/** Dead students who could still opt in - Monocub is a choice, not automatic. */
export function eligibleForMonocub() {
    return game.actors.filter(a =>
        a.type === "character" && !isMonokuma(a) && isDeceased(a) && !isMonocub(a));
}

/**
 * Opt somebody into (or out of) being a Monocub. GM only, and only ever on
 * somebody already `isDeceased` - the guide's condition, not this module's
 * invention. The guide also asks that their trial have concluded first, which
 * is a judgement call for the table; the dialog says so rather than the code
 * enforcing it, the same trust the rest of the murder and trial flow already
 * places in the GM.
 */
export async function setMonocub(actor, value = true, { quiet = false } = {}) {
    if (!game.user.isGM || !actor) return null;
    if (value && !isDeceased(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.mustBeDead"));
        return null;
    }

    const was = isMonocub(actor);

    /*
     * A MONOCUB STARTS CLEAN (E15 C4, 25.10.2026; audit S09-17, S10-18). The guide gives a Monocub
     * Hope only from a Monokuma's conversion of Despair, and the same budget as a living student;
     * this kept what the student died with. A student who died holding 4 Hope had four Confusions
     * before any Monokuma gave them anything, and a victim who bled out in an incident - every
     * point of Health marked - came back with one action, Wounded, while an executed Blackened
     * (tracks untouched) came back with two. So on the way in, false to true only, Hope and both
     * tracks are emptied in one write with `setMonokuma`'s reason. Who is dead is the deceased
     * flag (`isDeceased`), not the tracks, so clearing the marks changes nobody's death. Made a
     * second time it writes nothing: a Hope a Monokuma has since converted is kept.
     */
    if (value && !was) {
        await trustedWrite(actor, {
            "system.resources.hope.value": 0,
            "system.resources.hitPoints.value": 0,
            "system.resources.stress.value": 0
        }, { reason: "setup" });
        // The purse too (E72 C14): a purse left from an earlier time as a Monocub is not this one's.
        if (purseOf(actor)) await patchCubRow(actor.id, { purse: null });
    }
    await actor.setFlag(MODULE_ID, FLAGS.monocub, Boolean(value));

    /* THE BODY (E63 C0, 11.11.2026; the owner on E95 Q3: "Nie gdy zostaje Monocubem"): becoming a Monocub lays nothing.
       The death laid it (chapter.mjs `markDeceased`), and the Monocub walks away from it on the token; ticked, unticked
       or ticked again, the tile stays, and it goes at the trial's end, a revive or the reset. */
    // Unconditional on purpose: clearing the mark is also the repair for a
    // silence left behind by a cub who is no longer one (the GMs' row since E72 C2).
    if (!value && cubRowOf(actor)?.witness) await patchCubRow(actor.id, { witness: null });
    // A revived student keeps no Monocub's bet, order or ask (the 1.2.110 review, E72 reader #5): `settleBets` paid the
    // bet into a living student's purse, and an old card's Give made Hope for them.
    if (!value) {
        const row = cubRowOf(actor) ?? {};
        if (row.bet || row.order || row.askOpen) await patchCubRow(actor.id, { bet: null, order: null, askOpen: null });
    }

    /*
     * ONLY ON A REAL CHANGE (F16, 20.09), which is the rule `setSilenced` below
     * has always followed. The Players window's repair dropdown clears the
     * Monocub flag on its way to "dead" or "alive" whether or not anybody was a
     * Monocub, so a GM straightening out one row was told "X is no longer a
     * Monocub" about a student who never was one - a sentence that describes an
     * event that did not happen, in the one window whose job is to correct the
     * record. The writes above stay unconditional; only the telling is gated.
     */
    if (was === Boolean(value)) {
        actor.sheet?.render(false);
        return actor;
    }

    log(`${actor.name} is ${value ? "now" : "no longer"} a Monocub.`);
    /* THE SPECTATOR'S TOKEN (E62 C3b; Q-C3b-7's default, asked of the owner): becoming a Monocub, the dead's Spectator
       token stays where it stands and becomes the student's own (the curtain's return on the player's browser); the
       Spectator actor goes and the body's token stays the corpse. A Monocub no more, still dead: the Spectator back,
       silently (spectator-dead.mjs). Tried on its own: the flag stands either way. */
    try {
        const D = await import("./spectator-dead.mjs");
        if (value) await D.watcherBecomesMonocub(actor);
        else if (isDeceased(actor)) await D.monocubBecomesWatcher(actor);
    } catch (err) {
        error(`Could not move ${actor.name}'s Spectator token`, err);
    }
    // `quiet` for a caller that reports what it did itself (E51 C6; audit S06-46): the season reset, one toast per cub.
    if (!quiet) ui.notifications.info(game.i18n.format(
        value ? "DRPG.Monocub.opted" : "DRPG.Monocub.unopted", { name: actor.name }));

    // The two conditions, put in line now on the primary (a Monocub carries neither: states.mjs
    // `syncOnce`); on another GM the primary's own hook does it for the flag just written, so two
    // GMs do not toggle one status at once.
    if (isPrimaryGm()) {
        const { syncStates } = await import("./states.mjs");
        await syncStates(actor);
    }

    actor.sheet?.render(false);
    return actor;
}

/* ==========================================================================
 * THE MONOCUBS' RECORD (E72 C2, 12.11.2026; audit S18-51, S18-57)
 * --------------------------------------------------------------------------
 * What the GMs keep about a Monocub lives in the GM store `cubStore` (gm-stores.mjs), and each owner holds a copy of
 * their own characters' rows (`cubCopy`), sent by a GM when a row changes and when the owner asks - at load, and when a
 * primary GM's world has loaded (`drpgPrimaryReady`). Asking is the owner's; answering is a GM's alone, about the
 * asker's own characters, found from Foundry's `senderId`; the copy is taken only from a GM, and only for a character
 * this user owns - the eclipse's crossings' shape (eclipse.mjs `movesFor`).
 * ========================================================================== */

const CUB_SOCKET = `module.${MODULE_ID}`;
const ACTION_CUBS = "monocub.cubs";
const ACTION_CUBS_ASK = "monocub.cubsAsk";

/** The row the GMs keep of this Monocub, on a GM; this user's copy of it, on its owner's browser; null elsewhere. */
export function cubRowOf(actor) {
    if (!actor?.id) return null;
    if (game.user?.isGM) return cubStore.get(actor.id) ?? null;
    return (cubCopy.read() ?? {})[actor.id] ?? null;
}

/** GM: one user's own characters' rows, with a stamp per character they own (0 for one this browser never held). */
export function cubsFor(userId) {
    const user = game.users.get(userId);
    const cubs = {}, stamps = {};
    if (!game.user?.isGM || !user || user.isGM) return { cubs, stamps };
    for (const actor of game.actors ?? []) {
        if (actor.type !== "character" || !actor.testUserPermission?.(user, "OWNER")) continue;
        // A Monocub's copy carries the open Bounties, so its stamp is the newer of its row's and the Bounties' (E72 fix
        // round, review #2): the owner's combine takes only a newer answer, and a post or a lapse touches no row.
        stamps[actor.id] = isMonocub(actor) ? Math.max(cubStore.newest(actor.id), newestIn(bountyStore.section())) : cubStore.newest(actor.id);
        const row = cubStore.get(actor.id) ?? (isMonocub(actor) ? {} : null);
        if (row) cubs[actor.id] = { witness: row.witness ?? null, redeemDay: row.redeemDay ?? null, askOpen: askStillOpen(row.askOpen) ? row.askOpen : null, invited: Boolean(row.invite),
            purse: Math.max(0, Math.trunc(Number(row.purse) || 0)),
            // The Bribes offered to this Monocub (E72 C15): the payer's name and the price, for its player's answer.
            bribes: row.bribes ? Object.fromEntries(Object.entries(row.bribes).map(([id, b]) => [id, { fromName: b?.fromName ?? "", cost: b?.cost ?? 0 }])) : null,
            // The open Bounties (E72 C16), to every Monocub's owner and nobody else's.
            bounties: isMonocub(actor) ? openBounties() : null,
            // The Monocub's own Ghost Bet (E72 C19): the name it chose and the value, for its panel.
            bet: row.bet ? { targetName: game.actors.get(row.bet.targetId)?.name ?? "", value: Math.max(0, Math.trunc(Number(row.bet.value) || 0)) } : null };
    }
    return { cubs, stamps };
}

/** GM: send one user their rows. Addressed, and only while they are here; nothing while the suite holds the stores. */
export function sendCubsTo(userId) {
    const user = game.users.get(userId);
    if (!game.user?.isGM || !user?.active || user.isGM || gmStoresQuiet()) return false;
    const { cubs, stamps } = cubsFor(userId);
    game.socket.emit(CUB_SOCKET, { action: ACTION_CUBS, userId, cubs, stamps }, { recipients: [userId] });
    return true;
}

/** GM: every connected owner of this character sent their copy. */
function tellCubOwners(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    for (const user of game.users ?? []) {
        if (user.active && !user.isGM && actor.testUserPermission?.(user, "OWNER")) sendCubsTo(user.id);
    }
}

/** After a restore (gm-stores.mjs `restoreCase`): every connected player sent their rows again. */
export async function retellCubs() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    let sent = 0;
    for (const user of game.users ?? []) {
        if (user.active && !user.isGM && sendCubsTo(user.id)) sent++;
    }
    return sent;
}

/** A witness's mark as a packet may carry it, or null: `{ chapter, epoch }`, each a number or null. */
function witnessShape(mark) {
    if (!mark || typeof mark !== "object" || !Number.isInteger(mark.chapter)) return null;
    return { chapter: mark.chapter, epoch: Number.isFinite(Number(mark.epoch)) && mark.epoch !== null ? Number(mark.epoch) : null };
}

/** Owner: take a GM's answer where it is newer (`cubCopy`), for this user's own characters only. */
export async function receiveCubs(cubs, stamps) {
    const mine = {}, own = {};
    for (const [actorId, stamp] of Object.entries(stamps ?? {})) {
        if (!game.actors.get(actorId)?.isOwner) continue;
        own[actorId] = Number(stamp) || 0;
        const row = copyRowOf(cubs?.[actorId]);
        if (row) mine[actorId] = row;
    }
    const taken = await cubCopy.receive(mine, own);
    // An invitation the copy now holds opens its window on the owner's browser (E72 C6), once per invitation here;
    // so does each Bribe offered to the Monocub (E72 C15), once per offer.
    for (const [actorId, row] of Object.entries(cubCopy.read() ?? {})) {
        if (row?.invited) openInvitation(game.actors.get(actorId));
        else invitationsShown.delete(actorId);
        for (const [bribeId, offer] of Object.entries(row?.bribes ?? {})) openBribeOffer(game.actors.get(actorId), bribeId, offer);
    }
    return taken;
}

/**
 * WHAT THE PANEL SAYS OF PART B (E72 C19, 12.11.2026; the plan's C19): the lines under the Monocub's tiles, from the row as
 * this browser holds it - the owner's copy, or on a GM the row its owner would be sent (`cubsFor`'s, through
 * `copyRowOf`). Each Bribe waiting (`{ kind: "offer", id, name, cost }`, which the panel draws with Accept and Refuse),
 * each open Bounty (`{ kind: "bounty", name, reward }`) and the Monocub's own Ghost Bet (`{ kind: "bet", name, value }`).
 */
export function cubPanelLines(actor) {
    if (!actor) return [];
    let row = null;
    if (game.user?.isGM) {
        const owner = ownerOf(actor);
        row = owner ? copyRowOf(cubsFor(owner.id).cubs[actor.id]) : null;
    } else {
        row = cubRowOf(actor);
    }
    if (!row) return [];
    return [
        ...Object.entries(row.bribes ?? {}).map(([id, offer]) => ({ kind: "offer", id, name: offer.fromName, cost: offer.cost })),
        ...(row.bounties ?? []).map(b => ({ kind: "bounty", name: b.targetName, reward: b.reward })),
        ...(row.bet ? [{ kind: "bet", name: row.bet.targetName, value: row.bet.value }] : [])
    ];
}

/**
 * A row of the GMs' copy as the owner keeps it, each field held to its shape (E72 C2; the purse C14, the open Bribes
 * C15), or null for no row. Exported for the suite: the owner's side is a player's browser, which tier 2 does not run.
 */
export function copyRowOf(row) {
    if (!row || typeof row !== "object") return null;
    const day = row.redeemDay && typeof row.redeemDay === "object" && Number.isInteger(row.redeemDay.day)
        ? { chapter: row.redeemDay.chapter ?? null, epoch: row.redeemDay.epoch ?? null, day: row.redeemDay.day } : null;
    const bribes = {};
    for (const [id, offer] of Object.entries(row.bribes && typeof row.bribes === "object" ? row.bribes : {})) {
        if (typeof id !== "string" || !offer || typeof offer !== "object") continue;
        bribes[id] = { fromName: String(offer.fromName ?? ""), cost: Math.max(0, Math.trunc(Number(offer.cost) || 0)) };
    }
    const bounties = (Array.isArray(row.bounties) ? row.bounties : []).filter(b => b && typeof b === "object")
        .map(b => ({ targetName: String(b.targetName ?? ""), reward: Math.max(0, Math.trunc(Number(b.reward) || 0)) }));
    const bet = row.bet && typeof row.bet === "object" && typeof row.bet.targetName === "string"
        ? { targetName: row.bet.targetName, value: Math.max(0, Math.trunc(Number(row.bet.value) || 0)) } : null;
    const ask = row.askOpen && typeof row.askOpen === "object" ? { chapter: row.askOpen.chapter ?? null, epoch: row.askOpen.epoch ?? null,
        day: row.askOpen.day ?? null, timeOfDay: row.askOpen.timeOfDay ?? null } : null;
    return { witness: witnessShape(row.witness), redeemDay: day, askOpen: ask, invited: row.invited === true,
        purse: Math.max(0, Math.trunc(Number(row.purse) || 0)), bribes: Object.keys(bribes).length ? bribes : null,
        bounties: bounties.length ? bounties : null, bet };
}

/** Owner: ask the primary for this user's rows. */
function askForCubs(primary = primaryGmId()) {
    if (!primary || game.user.isGM) return;
    try {
        game.socket.emit(CUB_SOCKET, { action: ACTION_CUBS_ASK }, { recipients: [primary] });
    } catch (err) {
        error("Could not ask the GM for this user's Monocub rows", err);
    }
}

function onCubsSocket(payload, senderId) {
    if (payload?.action === ACTION_CUBS_ASK) {
        if (!isPrimaryGm()) return;
        const sender = senderOf(senderId);
        if (!sender || sender.isGM) return;
        // Asked while the suite holds the stores: answered once it lets them go, from the other GMs' rows too.
        whenGmStoresAudible().then(() => cubStore.whenHydrated()).then(() => sendCubsTo(sender.id))
            .catch(err => error("Could not answer a player's Monocub rows", err));
        return;
    }
    if (payload?.action !== ACTION_CUBS || game.user.isGM) return;
    // A GM's, and addressed to this user: a player cannot hand another a row.
    if (!replyForMe(payload, senderId)) return;
    receiveCubs(payload.cubs, payload.stamps).catch(err => error("Could not keep this user's Monocub rows", err));
}

/** At ready: the copy's listener on every client, and an owner's first ask. */
export function registerCubCopy() {
    Hooks.once("ready", () => {
        game.socket.on(CUB_SOCKET, onCubsSocket);
        if (game.user.isGM) return;
        askForCubs();
        Hooks.on("drpgPrimaryReady", primary => askForCubs(primary));
    });
}

/* ==========================================================================
 * THE INVITATION (E72 C6, 12.11.2026; audit S18-61, the owner's DC17 and DC18)
 * --------------------------------------------------------------------------
 * A dead student becomes a Monocub only when its player accepts the Monocub Rule. The GMs invite (`offerMonocub`, the
 * one road for the Students window's Invite button and its State list); the invitation is the row's `invite` in
 * `cubStore`, and its owner's copy says `invited`, which opens the window on the player's browser (`openInvitation`) -
 * now, or at the player's next load. The player's answer is the bridge action `monocub.answer`, judged on the primary
 * (`answerMonocubOffer`): accepted, the row keeps `acceptedRule` and the student is made a Monocub; declined, the
 * invitation closes and the GMs are told. A GM may withdraw an open invitation (`cancelMonocubOffer`).
 * ========================================================================== */

/** The ids whose invitation window this browser opened, so a copy received again does not open a second. */
const invitationsShown = new Set();

/** GM: invite a dead student to become a Monocub. Answers true when the invitation is open, false when it cannot be. */
export async function offerMonocub(actor) {
    if (!game.user?.isGM || !actor) return false;
    if (!isDeceased(actor)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.mustBeDead"));
        return false;
    }
    if (isMonocub(actor)) return false;
    await patchCubRow(actor.id, { invite: { at: serverNow(), by: game.user.id } });
    ui.notifications.info(game.i18n.format("DRPG.Monocub.invited", { name: actor.name }));
    log(`${actor.name} is invited to become a Monocub; waiting for their player to accept the Monocub Rule.`);
    return true;
}

/** GM: withdraw an open invitation. Answers whether one was open. */
export async function cancelMonocubOffer(actor) {
    if (!game.user?.isGM || !actor || !cubRowOf(actor)?.invite) return false;
    await patchCubRow(actor.id, { invite: null });
    log(`The invitation of ${actor.name} to become a Monocub was withdrawn.`);
    return true;
}

/** Is an invitation open for this student, on this browser (the GMs' row, or the owner's copy)? */
export function invitationOpen(actor) {
    const row = cubRowOf(actor);
    return Boolean(game.user?.isGM ? row?.invite : row?.invited);
}

/**
 * Primary GM: a player's answer to an open invitation (`monocub.answer`, or a GM's own for a character no player
 * owns). Answers `{ accepted }`, or null when no invitation is open for the character - the bridge's refusal. The
 * Rule is taken only by its player: a GM's answer stands only for a student no player owns.
 */
export async function answerMonocubOffer({ actorId, accept } = {}, sender = null) {
    if (!game.user?.isGM) return null;
    const actor = game.actors.get(actorId);
    if (!actor || !cubRowOf(actor)?.invite) return null;
    if (sender?.isGM && ownerOf(actor) && !ownerOf(actor).isGM) return null;
    if (!accept) {
        await patchCubRow(actor.id, { invite: null });
        const { whisperToGms } = await import("./utils.mjs");
        await whisperToGms(`<p>${foundry.utils.escapeHTML(game.i18n.format("DRPG.Monocub.inviteDeclined", { name: actor.name }))}</p>`);
        log(`${actor.name}'s player declined the invitation to become a Monocub.`);
        return { accepted: false };
    }
    // A student alive again since the invitation (E72 fix round, review #6): the invitation closes and nothing is
    // carried out - the row kept the Rule and the player was told "accepted" while setMonocub refused.
    if (!isDeceased(actor)) {
        await patchCubRow(actor.id, { invite: null });
        warn(`Closed ${actor.name}'s invitation to become a Monocub unanswered: the student is not dead.`);
        return null;
    }
    await patchCubRow(actor.id, { invite: null, acceptedRule: { at: serverNow(), by: sender?.id ?? null } });
    await setMonocub(actor, true);
    return { accepted: true };
}

/**
 * The invitation's window, on its player's browser: the Monocub Rule and its three steps, Accept or Not now (E72 C6;
 * DC17, DC18). Once per invitation on this browser; a GM never sees it.
 */
export async function openInvitation(actor) {
    if (!actor || game.user?.isGM || !actor.isOwner || invitationsShown.has(actor.id)) return null;
    invitationsShown.add(actor.id);
    const L = key => foundry.utils.escapeHTML(game.i18n.localize(key));
    const answer = await drpgWindow({
        title: game.i18n.localize("DRPG.Monocub.inviteTitle"),
        classes: ["drpg-panel", "drpg-cub-invite"],
        body: `<div class="drpg-cub-invite-body">
            <p>${foundry.utils.escapeHTML(game.i18n.format("DRPG.Monocub.inviteIntro", { name: actor.name }))}</p>
            <h3>${L("DRPG.Monocub.ruleTitle")}</h3>
            <p><strong>${L("DRPG.Monocub.rule")}</strong></p>
            <p>${L("DRPG.Monocub.ruleSteps")}</p>
            <ol class="drpg-cub-rule-steps"><li>${L("DRPG.Monocub.ruleStep1")}</li><li>${L("DRPG.Monocub.ruleStep2")}</li><li>${L("DRPG.Monocub.ruleStep3")}</li></ol>
        </div>`,
        footer: {
            primary: { action: "accept", label: game.i18n.localize("DRPG.Monocub.inviteAccept"), callback: () => "accept" },
            secondary: [{ action: "decline", label: game.i18n.localize("DRPG.Monocub.inviteDecline"), callback: () => "decline" }]
        },
        rejectClose: false
    });
    if (answer !== "accept" && answer !== "decline") {
        // Closed with no answer: the invitation stays open and the window comes back at the next load.
        invitationsShown.delete(actor.id);
        return null;
    }
    const { requestCubAnswer } = await import("./gm-bridge.mjs");
    const res = await requestCubAnswer({ actorId: actor.id, accept: answer === "accept" });
    return res.ok ? res.value ?? null : null;
}

/** GM: write fields of a Monocub's row, then tell its owners. `null` for a field clears it. */
async function patchCubRow(actorId, fields) {
    await cubStore.whenHydrated();
    await cubStore.patch(actorId, fields);
    tellCubOwners(actorId);
}

/**
 * Mark (or clear) the guide's "stumbled onto the crime" silence.
 *
 * The player is told. This is a restriction on what they may SAY at the table -
 * "otrzymuje zakaz wypowiadania się na temat zbrodni do końca rozdziału" - so a
 * silence nobody announced is a rule the person bound by it cannot follow. It
 * used to be written as a bare flag from the Monocub dialog and never mentioned
 * anywhere; the only trace was a checkbox on the GM's screen.
 *
 * IN THE GMS' STORE (E72 C2, 12.11.2026; audit S18-51): the mark is the row's `witness` in `cubStore`, with its owner's
 * copy, not the actor flag `silencedChapter` every browser holds. The card is veiled (secret.mjs): its words reach the
 * Monocub's player alone, and its document names nobody.
 */
export async function setSilenced(actor, silenced) {
    if (!game.user.isGM || !actor) return null;

    const was = isCrimeSilenced(actor);
    // The chapter and its season (E11 fix r2-H2), as a death's record names them: `isCrimeSilenced`. And the chapter's
    // verdict before it, as a death's row names it (chapter.mjs `verdictBefore`), so the wrong verdict's card can tell a
    // witness of this case from one of the chapter's earlier case (`wrongVerdictTouches`; the 1.2.110 review's V4).
    const chapter = getClock().chapter;
    const record = getSetting(SETTINGS.trialProgress) ?? {};
    const sinceVerdict = record.chapter === chapter ? (record.lastVerdictAt ?? null) : null;
    await patchCubRow(actor.id, { witness: silenced ? { chapter, epoch: seasonEpoch(), sinceVerdict } : null });

    // Only on a real change: the dialog writes every row it was shown, and a
    // whisper repeating a silence that was already in force is noise.
    if (was !== Boolean(silenced)) {
        await whisperToOwner(actor, `<p><strong>${
            game.i18n.localize("DRPG.Monocub.silenceTitle")
        }</strong> - ${game.i18n.localize(silenced
            ? "DRPG.Monocub.silenceOn"
            : "DRPG.Monocub.silenceOff")}</p>`, { veiled: true });
    }
    return actor;
}

/**
 * The crime-witness marker: is the chapter `setSilenced` stamped on the Monocub's row this one?
 * Information only - it refuses nothing (a witness's Confusion lands, ACT-12) and mutes
 * nothing; whether a Monocub keeps quiet is the player's own business (the owner, 05.10.2026).
 * Named `isCrimeSilenced` since 1.2.69 (E33 C9, D39): until then this and the Despair Call's
 * reader in call-effects.mjs shared one bare name, and sheet.mjs renamed them at its door.
 * The alias in api.mjs still answers this question under that old name, so a macro
 * reads what it read.
 *
 * THIS SEASON'S CHAPTER (E11 fix r2-H2; round 2's goal S06-42). The mark was the chapter alone, and
 * a reset that keeps the Monocubs (its deaths group unticked) sends the clock back to chapter 1: a
 * Monocub marked in last season's chapter 1 read as marked in the new one. `setSilenced` writes
 * `{ chapter, epoch }` since, and this asks `sameSeason` of it; a mark from before 1.2.73 is the bare
 * chapter, which names no season and is read by its chapter alone, as before. Read off the GMs' row
 * (or the owner's copy) since E72 C2; a world's flag is the clause `liftCubWitness`'s.
 */
export function isCrimeSilenced(actor) {
    const mark = cubRowOf(actor)?.witness;
    const record = typeof mark === "number" ? { chapter: mark } : mark;
    return typeof record?.chapter === "number" && record.chapter === getClock().chapter && sameSeason(record);
}

/**
 * A MONOCUB SAW THE CRIME (E72 C2, 12.11.2026; audit S18-57, the guide p. 17). A Monocub who stands in the incident's
 * room - walking in while it runs (murder-rules.mjs `maybeThirdParty`, asked before its indirect and dead returns, so a
 * trap's scene too) or there at its opening (`markWitnessesAt`) - is marked a crime witness this chapter, and told.
 * Primary GM only; marking a marked one writes and says nothing. Answers whether it marked.
 */
export async function cubSawIncident(actor) {
    if (!isPrimaryGm() || !isMonocub(actor) || isCrimeSilenced(actor)) return false;
    await setSilenced(actor, true);
    log(`${actor.name} (a Monocub) saw the crime: marked a crime witness this chapter.`);
    return true;
}

/**
 * At an incident's opening (E72 C2): every Monocub standing in the victim's room is marked (`cubSawIncident`). The
 * token's room as the witness judge counts it (movement.mjs `lawfulRoomOf`), on the victim's scene; a hidden token is
 * not in the scene, as for a third party. Answers how many it marked.
 */
export async function markWitnessesAt(victim) {
    if (!isPrimaryGm() || !victim) return 0;
    const { lawfulRoomOf, locateActor } = await import("./movement.mjs");
    const place = locateActor(victim);
    if (!place?.room || !place.scene) return 0;
    let marked = 0;
    for (const token of place.scene.tokens ?? []) {
        const actor = token.actor;
        // A Monocub's corpse beside the token it walks is no witness (E62 C3b fix; the e93 review's F1): it stands where it walks.
        if (!actor || token.hidden || !isMonocub(actor) || isMonocubCorpse(token) || lawfulRoomOf(token) !== place.room) continue;
        if (await cubSawIncident(actor)) marked++;
    }
    return marked;
}

/**
 * THE MARKS 1.2.105 KEPT ON THE ACTOR (E72 C2) - the `liftCubWitness` clause (migrate.mjs). Once, on the primary, after
 * the store holds the other GMs' copies: each actor's `silencedChapter` flag goes into its row's `witness` (weak and
 * fill-only: a mark a GM has written since the update stands), and leaves the actor only once its row reads back from
 * storage. A flag still there after that throws, so the world is not stamped and the next load tries again.
 */
export async function liftCubWitness() {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await cubStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the Monocubs' record did not arrive; the next load tries again");
    }
    const onFlag = actor => actor?.getFlag?.(MODULE_ID, FLAGS.silencedChapter);
    const holding = () => (game.actors?.contents ?? []).filter(actor => onFlag(actor) !== undefined && onFlag(actor) !== null);
    const found = holding();
    if (!found.length) return null;
    // A bare chapter is a mark from before 1.2.73 (E11 fix r2-H2): it names no season, and is kept so.
    const marks = new Map(found.map(actor => {
        const mark = onFlag(actor);
        return [actor.id, typeof mark === "number" ? { chapter: mark, epoch: null } : witnessShape(mark)];
    }));
    for (const actor of found) {
        const witness = marks.get(actor.id);
        if (witness) await cubStore.patch(actor.id, { witness }, { weak: true, fillOnly: true });
    }
    await cubStore.idle();
    for (const actor of found) {
        // A mark that reads as none (a malformed flag) has nothing to keep; one that does leaves once its row is stored.
        if (marks.get(actor.id) && !cubStore.persisted(actor.id)) continue;
        try {
            await actor.unsetFlag(MODULE_ID, FLAGS.silencedChapter);
        } catch (err) {
            error(`Could not take the crime witness's mark off ${actor.name}`, err);
        }
        tellCubOwners(actor.id);
    }
    const left = holding().length;
    if (left) throw new Error(`${left} of ${found.length} character(s) still hold a crime witness's mark in world data; the next load tries again`);
    log(`Moved the crime witness's mark of ${found.length} character(s) into the GM store.`);
    return { lifted: found.length };
}

/* ==========================================================================
 * THE ABILITIES (E33 C10, 07.10.2026; audit S09-48, decision D39)
 * --------------------------------------------------------------------------
 * One ability lived in three files (this one, gm-bridge.mjs's one action for it,
 * sheet.mjs `meddleButton`), so a second one would have been a fourth copy of
 * every question: who may use it, when it is shut, whom it is aimed at, what is
 * thrown, how it is scored. Each ability is a ROW of `MONOCUB.abilities`
 * (config.mjs), and the rows are data: a row names its behaviour by key, and
 * the four tables below hold the behaviour - `CUB_LOCKS` (the windows it is shut
 * in: asked on the picker and on the GM before the price, E72 C1),
 * `CUB_TARGETS` (whom it may be aimed at: asked on the picker and again on the
 * GM), `CUB_ROLLS` (what the GM throws) and `CUB_RESOLVERS` (how the GM's own
 * throw is scored and applied). One executor (`performCubAbility`), one picker
 * (`cubAbilityDialog`), one bridge action (`monocub.ability`, gm-bridge.mjs) and
 * one GM-side run (`cubAbilityOnGm`). A second ability is one row and one
 * resolver; the fields the 1.4.0 rework adds (phases, caps, a GM-side payment)
 * are those of E72 (part A, formerly E67). R301 holds every row to these tables.
 *
 * The Despair-to-Hope exchange itself lives in despair.mjs: a Mastermind
 * needs the exact same trade (see mastermind.mjs), and duplicating a function
 * that moves real Despair out of a real pool is how the two copies quietly
 * drift apart. Import it, do not rebuild it.
 * ========================================================================== */

/** The row of `MONOCUB.abilities` under `key`, or null for a key that is no ability (a packet's `key` is a claim). */
export function abilityRow(key) {
    return typeof key === "string" && Object.hasOwn(MONOCUB.abilities, key) ? MONOCUB.abilities[key] : null;
}

/**
 * The windows an ability is shut in, by the key a row's `locks` names.
 *
 * The Eclipse (CALL-16, 17.09): the Monocub's tile opens the picker directly, not
 * through `performAction`, so it missed the guard every action and Call goes
 * through - and the actions refilled when the lights went out could be spent
 * arming advantage and disadvantage before the time of day had started.
 *
 * The Class Trial (T-1, 17.09): Confusion IS the Monocub's Meddle, and Dawid's
 * decision named it beside the Despair Calls. Everything the trial leaves open
 * belongs to the students arguing in it.
 *
 * Asked on the picker, and on the GM before it takes the price (E72 C1). Until E72 they
 * were asked on the GM never (review of CALL-16): the Monocub's browser paid before the
 * GM was asked, so a window shut on the way would have cost its Hope for good. With
 * the price taken on the GM after the conditions, a shut window refuses for free.
 * The crime-witness marker is no lock (ACT-12; the owner's option B, 05.10.2026): a
 * witness's Confusion lands.
 */
export const CUB_LOCKS = Object.freeze({
    eclipse: { shut: async () => (await import("./eclipse.mjs")).isEclipse(), say: "DRPG.Eclipse.actionsLocked" },
    classTrial: { shut: async () => getClock().phase === "classTrial", say: "DRPG.Trial.callsLocked" },
    // A Ghost Bet once the vote has closed (E72 C18): the window is 0.
    betWindow: { shut: async () => betWindowNow() <= 0, say: "DRPG.Monocub.betClosed" }
});

/** The first of the row's locks that is shut, said; null when none is. A lock the table does not know is shut. */
async function lockRefusal(row) {
    for (const key of row.locks ?? []) {
        const lock = CUB_LOCKS[key];
        if (lock && !await lock.shut()) continue;
        ui.notifications.warn(game.i18n.localize(lock?.say ?? "DRPG.Monocub.cannotMeddle"));
        return key;
    }
    return null;
}

/** The game day a move is counted under: the clock's chapter, season and day. */
function gameDayNow() {
    const clock = getClock() ?? {};
    return { chapter: clock.chapter ?? null, epoch: seasonEpoch(), day: clock.day ?? null };
}

/**
 * AN ASK FOR HOPE IS OPEN FOR ITS TIME OF DAY (the E101 line's review of 1.2.110, E72 reader #3, 13.11.2026). `askOpen`
 * was `true` until a GM answered the card, and nothing else cleared it, so a card deleted or a chat flushed shut Ask for
 * Hope for good. It is now the mark of the time of day the ask was made in (`askMarkNow`: the game day and its time of
 * day), and it shuts the next ask only while that time of day lasts (`askStillOpen`); an old `true` shuts nothing. The
 * owner's copy carries the mark, so its tile reads the same rule. Exported for tier 2.
 */
export function askMarkNow() {
    return { ...gameDayNow(), timeOfDay: getClock()?.timeOfDay ?? null };
}

export function askStillOpen(mark, now = askMarkNow()) {
    return Boolean(mark) && typeof mark === "object" && isToday(mark, now) && mark.timeOfDay === now.timeOfDay;
}

/** Is `mark` (a row's `{ chapter, epoch, day }`) this game day? */
function isToday(mark, today = gameDayNow()) {
    return Boolean(mark) && mark.chapter === today.chapter && mark.epoch === today.epoch && mark.day === today.day;
}

/*
 * THE PURSE (E72 C14, 12.11.2026; the owner's DC37: "a purse in the GM store, spent before the sheet; the 6-Hope limit
 * counts the sum"). The Hope a Bribe or a Bounty pays a Monocub (C15, C16) is kept in the GMs' row (`cubStore`'s
 * `purse`), not on the sheet, and its owner is sent it with the row (`cubsFor`). A Monocub's Hope is the two together
 * (`cubHopeTotal`): the price a move asks, the full Hope that shuts Redeem and Ask for Hope. A price is taken from the
 * purse first (`spendCubHope`), and what it took from where is kept, so a refund gives each point back where it came
 * from (`refundCubHope`). Nothing goes into the purse while the darkening blocks Hope, as nothing goes onto a sheet
 * (overflow.mjs's hook guards the sheet alone), nor past the limit (`addToPurse`). R3808 holds that no other function
 * of this file reads the sheet's Hope alone.
 */

/** The Monocub's purse, as this browser holds the row (the GMs' row, or the owner's copy): a whole number, 0 for none. */
export function purseOf(actor) {
    return Math.max(0, Math.trunc(Number(cubRowOf(actor)?.purse) || 0));
}

/** A Monocub's Hope: its sheet's and its purse's. */
export function cubHopeTotal(actor) {
    return resourceValue(actor, "hope") + purseOf(actor);
}

/*
 * One lock a Monocub for every write of its purse (E72 fix round, review #3): each writer reads the purse and writes it
 * after an await (patchCubRow waits for the store), so two in step - a price and a Bribe, two Bets - each wrote its
 * own sum over the other's. Innermost always: nothing inside it takes another lock.
 */
const purseWrite = (actorId, step) => serialWrite(`drpg-purse:${actorId}`, step);

/** GM: take `n` Hope, the purse first. Answers `{ purse, sheet }`, how much came from each. */
export function spendCubHope(actor, n) {
    return purseWrite(actor.id, () => spendCubHopeNow(actor, n));
}

async function spendCubHopeNow(actor, n) {
    const purse = purseOf(actor);
    const fromPurse = Math.min(purse, Math.max(0, n));
    const fromSheet = Math.max(0, n - fromPurse);
    if (fromPurse) await patchCubRow(actor.id, { purse: purse - fromPurse });
    if (fromSheet) await trustedWrite(actor, { "system.resources.hope.value": resourceValue(actor, "hope") - fromSheet }, { reason: "price" });
    return { purse: fromPurse, sheet: fromSheet };
}

/** GM: give back what `spendCubHope` answered it took, each point where it came from. */
export function refundCubHope(actor, paid) {
    return purseWrite(actor.id, () => refundCubHopeNow(actor, paid));
}

async function refundCubHopeNow(actor, paid) {
    const purse = Math.max(0, Math.trunc(Number(paid?.purse) || 0)), sheet = Math.max(0, Math.trunc(Number(paid?.sheet) || 0));
    // The purse held to the limit as well (the 1.2.110 review, E72 reader #4): a Bribe that filled it since the price
    // leaves no room past the maximum, as the sheet's part below.
    const room = Math.max(0, resourceMax(actor, "hope") - cubHopeTotal(actor));
    if (purse && room) await patchCubRow(actor.id, { purse: purseOf(actor) + Math.min(purse, room) });
    // Held to the limit less the purse (the second review's #4): a purse that filled since the price leaves no room past it.
    if (sheet) {
        await trustedWrite(actor, { "system.resources.hope.value": Math.min(resourceMax(actor, "hope") - purseOf(actor), resourceValue(actor, "hope") + sheet) },
            { reason: "refund" });
    }
}

/** GM: put `n` Hope in the purse, held to the limit and to nothing in the darkening. Answers how many went in. */
export async function addToPurse(actor, n) {
    if (!game.user?.isGM || !actor || !(n > 0)) return 0;
    return purseWrite(actor.id, () => addToPurseNow(actor, n));
}

/* `also`: fields of the row written in the same patch as the purse (a settled bet's `bet: null`), whatever goes in. */
async function addToPurseNow(actor, n, also = null) {
    const { overflowBlocksHope } = await import("./overflow.mjs");
    const take = overflowBlocksHope() || !(n > 0) ? 0 : Math.min(Math.trunc(n), Math.max(0, resourceMax(actor, "hope") - cubHopeTotal(actor)));
    if (take > 0 || also) await patchCubRow(actor.id, { ...(also ?? {}), ...(take > 0 ? { purse: purseOf(actor) + take } : {}) });
    return Math.max(0, take);
}

/**
 * WHAT SHUTS A MOVE FOR THIS MONOCUB (E72 C5, 12.11.2026; audit S18-60, the owner's DC22), by the key a row's `blocks`
 * names: `refuses(actor)` answers an English reason for the GM's log, or null, read off the Monocub's row as this
 * browser holds it (the GMs' store on a GM, the owner's copy on its player's browser); `say` is what the Monocub's
 * player is told. Asked on the picker as a courtesy and on the GM before the price (`cubAbilityRefusalOnGm`).
 */
export const CUB_BLOCKS = Object.freeze({
    oncePerDay: {
        refuses: actor => (isToday(cubRowOf(actor)?.redeemDay) ? "Redeem was used today" : null),
        say: "DRPG.Monocub.redeemUsed"
    },
    hopeFull: {
        // The sheet's and the purse's together (E72 C14; DC37).
        refuses: actor => (cubHopeTotal(actor) >= resourceMax(actor, "hope") ? "the Monocub's Hope is full" : null),
        say: "DRPG.Monocub.hopeFull"
    },
    darkened: {
        refuses: async () => ((await import("./overflow.mjs")).overflowBlocksHope() ? "the darkened hour blocks Hope" : null),
        say: "DRPG.Monocub.darkened"
    },
    askOpen: {
        refuses: actor => (askStillOpen(cubRowOf(actor)?.askOpen) ? "an Ask for Hope is still open" : null),
        say: "DRPG.Monocub.askStillOpen"
    },
    // A Ghost Bet's (E72 C18): one placed already, the Monocub's own case open (DC15), a crime witness from the murder on.
    betPlaced: {
        refuses: actor => (cubRowOf(actor)?.bet ? "a Ghost Bet is placed already" : null),
        say: "DRPG.Monocub.betPlaced"
    },
    ownCase: {
        refuses: actor => (ownCaseOpen(actor) ? "the Monocub's own case is open" : null),
        say: "DRPG.Monocub.betOwnCase"
    },
    crimeWitness: {
        refuses: actor => (isCrimeSilenced(actor) ? "the Monocub is a crime witness" : null),
        say: "DRPG.Monocub.betWitness"
    }
});

/**
 * The sentence of the first of the row's blocks this browser can answer at once, or null (E72 C9: the sheet's tile).
 * Synchronous, so the darkening, which needs overflow.mjs, is left to the click and the GM.
 */
export function cubBlockSaid(actor, row) {
    for (const key of row?.blocks ?? []) {
        if (key === "darkened") continue;
        const block = CUB_BLOCKS[key];
        if (block && block.refuses(actor)) return block.say;
    }
    return null;
}

/** The first of the row's blocks that holds, or null: `{ key, why }`. A block the table does not know holds. */
async function blockOf(row, actor) {
    for (const key of row.blocks ?? []) {
        const block = CUB_BLOCKS[key];
        const why = block ? await block.refuses(actor) : `the move names a block no table holds (${key})`;
        if (why) return { key, why };
    }
    return null;
}

/**
 * Whom an ability may be aimed at, by the key a row's `target` names. `list` builds
 * the picker on the Monocub's browser; `refuses` answers why this target is not one,
 * or null - asked of the picker's answer before anything is paid, and again on the GM.
 */
export const CUB_TARGETS = Object.freeze({
    /** The Monocub itself (E72 C5: Redeem, Ask for Hope): the list is the Monocub, and any other id is refused. */
    self: {
        async list(actor) { return actor ? [actor] : []; },
        async refuses(actor, target) { return target?.id === actor?.id ? null : "the move is the Monocub's own"; }
    },
    /**
     * A living student in the Monocub's room. `list`: `othersInRoom` already excludes
     * Monokumas and hidden tokens, which is exactly right here too - a Monocub Meddles
     * with a fellow student, not with the DMs walking the map as their own Monokumas.
     * `refuses`: `sameRoom` rather than `othersInRoom`: it asks about the one target
     * named, on the same scene and floor. (`othersInRoom` read the canvas until E12 C3,
     * which was the reason first given here.)
     */
    roomStudent: {
        async list(actor) {
            const { othersInRoom } = await import("./movement.mjs");
            return othersInRoom(actor).filter(a => !isMonocub(a) && !isDeadForGm(a));
        },
        async refuses(actor, target) {
            if (!target || target.type !== "character") return "the target is not a character";
            if (target.id === actor.id) return "you cannot Meddle with yourself";
            if (isMonocub(target)) return "Monocubs do not Meddle with each other";
            if (isMonokuma(target)) return "a Monokuma is not a student";
            if (isDeadForGm(target)) return "the target is dead";
            const { sameRoom } = await import("./movement.mjs");
            if (!sameRoom(actor, target)) return "they are not in the same room";
            return null;
        }
    },
    /** A student of the class, for a Ghost Bet (E72 C18): anyone but the Monocub itself, a Monokuma or another Monocub. */
    student: {
        async list(actor) {
            const { studentActors } = await import("./monokuma.mjs");
            return studentActors().filter(a => a.id !== actor?.id && !isMonocub(a));
        },
        async refuses(actor, target) {
            if (!target || target.type !== "character" || target.id === actor?.id) return "the bet names no other student";
            const { studentActors } = await import("./monokuma.mjs");
            if (isMonocub(target) || !studentActors().some(a => a.id === target.id)) return "the bet names no student of the class";
            return null;
        }
    },
    /**
     * A PROJECT, FOR TINKER (E72 C13, 12.11.2026; the owner's DC23, DC24). `resolve` reads the id a packet names as a
     * project (projects.mjs `allProjects`), null for none, so an unknown id is refused as a missing one. `list`: the
     * projects in the Monocub's room on its scene that are public, unfinished and unfrozen - the room's own Work list
     * (`projectsAvailableIn`) narrowed as a Sabotage's targets are (no repair), and never a secret project, even one this
     * player is in on. `refuses` asks the same of the one named and, on a GM, that a living student worked on it this
     * time of day (projects.mjs `workersNow`, the GMs' row; the picker on a player's browser cannot read it).
     */
    project: {
        async resolve(id) {
            const { allProjects } = await import("./projects.mjs");
            return allProjects().find(p => p.id === id) ?? null;
        },
        async list(actor) {
            const P = await import("./projects.mjs");
            const { isSecret } = await import("./projects-secrecy.mjs");
            const { locateActor } = await import("./movement.mjs");
            const place = locateActor(actor);
            return P.projectsAvailableIn(place).filter(p => P.standsAtProject(place, p.id) && !isSecret(p.id) && !p.repairs);
        },
        async refuses(actor, target) {
            if (!target?.id) return "there is no such project";
            const P = await import("./projects.mjs");
            const { isSecret } = await import("./projects-secrecy.mjs");
            const { locateActor } = await import("./movement.mjs");
            const project = P.allProjects().find(p => p.id === target.id);
            if (!project) return "there is no such project";
            if (isSecret(project.id)) return "there is no such project";
            if (project.complete) return "the project is finished";
            if (P.isFrozen(project.id) || project.repairs) return "the project is frozen";
            if (!P.standsAtProject(locateActor(actor), project.id)) return "the project is not in the Monocub's room";
            if (game.user?.isGM && !P.workersNow(project.id).some(id => {
                const worker = game.actors.get(id);
                return worker && !isDeadForGm(worker) && !isMonocub(worker);
            })) return "nobody living worked on the project this time of day";
            return null;
        }
    }
});

/** The target a packet's id names for `row`: the row's rule's own reading, a character otherwise. */
async function targetOf(row, id) {
    const rule = row ? CUB_TARGETS[row.target] : null;
    return rule?.resolve ? rule.resolve(id) : (game.actors.get(id) ?? null);
}

/** Who the ability under `key` could be aimed at from where this Monocub stands: the picker's list. */
export async function cubTargets(actor, key) {
    const row = abilityRow(key);
    return row ? CUB_TARGETS[row.target].list(actor) : [];
}

/** A flat 2d12: Daggerheart's own duality math with no trait behind it. Thrown on the GM (`cubAbilityOnGm`). */
async function rollFlat() {
    const roll = new Roll("2d12");
    await roll.evaluate();
    const [a, b] = roll.terms[0]?.results ?? [];
    return {
        roll,
        total: roll.total,
        isCritical: Boolean(a && b && a.result === b.result)
    };
}

/** What the GM throws for an ability, by the key a row's `roll` names: `{ roll, total, isCritical }`. */
export const CUB_ROLLS = Object.freeze({
    flat2d12: rollFlat,
    /** No dice (E72 C5: Redeem, Ask for Hope). */
    none: async () => ({ roll: null, total: 0, isCritical: false })
});

/**
 * Why this ability is not one this character may ask for now, or null: the row (a
 * key is a packet's claim), the Monocub, the choice. Asked on the Monocub's browser
 * before anything is paid, by the bridge's guard before the run
 * (bridge-guards.mjs `guardCubAbility`), and on the GM once more (`cubAbilityOnGm`,
 * which a GM's own browser reaches with no guard in front of it). Not asked here:
 * the locks, the price and the target, which the GM asks before it pays
 * (`cubAbilityRefusalOnGm`, E72 C1) and the picker asks as a courtesy.
 */
export function cubAbilityRefusal(actor, key, choice) {
    const row = abilityRow(key);
    if (!row) return `no such Monocub ability: ${key}`;
    if (!actor || !isMonocub(actor)) return "that character is not a Monocub";
    if (!row.choices.includes(choice)) return `"${choice}" is not a choice of that ability`;
    return null;
}

/**
 * Put an ability's roll in chat, without Daggerheart's damage buttons.
 *
 * `Roll#toMessage` leaves `content` empty, so the message renders through the
 * system's own `foundryRoll.hbs` - and that template appends "Deal damage" and
 * "Apply healing" to EVERY plain roll it draws. Confusion is neither: it nudges
 * somebody's next roll. The buttons were live, aimed at whatever token happened
 * to be targeted, and there was nothing about the action they could correctly do.
 *
 * Writing our own `content` takes that template out of the path entirely - the
 * message renders what we give it. `rolls` is still populated, so Dice So Nice
 * animates the dice exactly as before, and `private-rolls.mjs` still sees a roll
 * to make private.
 */
async function postCubRoll(actor, row, roll, total, isCritical, choice) {
    const tooltip = await roll.getTooltip();

    return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        rolls: [roll],
        content: cubCardHtml(row, { choice, formula: roll.formula, tooltip, total, isCritical })
    });
}

/*
 * THE THRESHOLDS ARE SAID, BEFORE THE ROLL AND ON THE CARD (E51 C2, 30.10.2026; the owner's amendment
 * of 14.10, its item (6)). Confusion's window asked Help or Hinder and its card said "Confusion - Help"
 * and a total: the 12 and the 16 the GM scores it against (`scoreMeddle`, the row's `thresholds`) were
 * in config.mjs alone. Both are read off the row, so a second ability's tiers are said the same way.
 * A tier's words are named by its `grants` (the window's, both choices at once; the card's, the one
 * chosen); a `grants` with no words here is said by its number alone. R1112 asks both builders.
 */
const TIER_WORDS = Object.freeze({
    bonus: { both: "DRPG.Monocub.grantBonus", help: "DRPG.Monocub.helpBonus", hinder: "DRPG.Monocub.hinderBonus" },
    advantage: { both: "DRPG.Monocub.grantAdvantage", help: "DRPG.Monocub.helpAdvantage", hinder: "DRPG.Monocub.hinderAdvantage" },
    // Tinker's one tier (E72 C13): the project one step forward or back.
    step: { both: "DRPG.Monocub.grantStep", help: "DRPG.Monocub.helpStep", hinder: "DRPG.Monocub.hinderStep" }
});

/** What a tier grants, in words: `which` is "both" (the window) or the choice (the card). */
function tierWords(tier, which) {
    const key = TIER_WORDS[tier?.grants]?.[which];
    return key ? game.i18n.localize(key) : "";
}

/** The row's tiers, one line each - "Beat 12: ..." - for the ability's window. */
export function cubTiersHtml(row) {
    const tiers = (row?.thresholds ?? []).map(tier =>
        `<li>${foundry.utils.escapeHTML(game.i18n.format("DRPG.Monocub.tierLine", { n: tier.min, what: tierWords(tier, "both") }))}</li>`);
    return tiers.length ? `<ul class="drpg-cub-tiers">${tiers.join("")}</ul>` : "";
}

/**
 * The ability's card: the label and the choice, the dice, the total with "needed 12 / 16" beside it
 * (`DRPG.Action.needed`, as every action card says it since E51 C1), and what the total did - the
 * highest tier it beat, or the first it missed. A critical is scored by the row's `critical`, not by
 * a tier (`scoreMeddle`), so it says the critical and no tier. `tooltip` is the roll's own markup.
 */
export function cubCardHtml(row, { choice, formula = "", tooltip = "", total = 0, isCritical = false } = {}) {
    const esc = foundry.utils.escapeHTML;
    const label = `${row.label} - ${game.i18n.localize(`DRPG.Monocub.${choice}`)}`;
    const tiers = row.thresholds ?? [];
    const needed = tiers.length
        ? ` <small class="drpg-card-needed">${esc(game.i18n.format("DRPG.Action.needed", { n: tiers.map(t => t.min).join(" / ") }))}</small>` : "";
    const hit = resolveThreshold(total, tiers);
    const outcome = isCritical || !tiers.length ? ""
        : hit ? game.i18n.format("DRPG.Monocub.tierBeaten", { n: hit.min, what: tierWords(hit, choice) })
            : game.i18n.format("DRPG.Monocub.tierMissed", { n: tiers[0].min });
    return `<div class="dice-roll drpg-flat-roll">
            <div class="dice-flavor">${esc(label)}</div>
            <div class="dice-result">
                <div class="dice-formula">${esc(formula)}</div>
                ${tooltip}
                <h4 class="dice-total">${total}${needed}</h4>
            </div>
            ${outcome ? `<p class="drpg-flat-tier">${esc(outcome)}</p>` : ""}
            ${isCritical
                ? `<p class="drpg-flat-crit"><em>${
                    game.i18n.localize("DRPG.Action.critical")}</em></p>`
                : ""}
        </div>`;
}

/**
 * THE ONE EXECUTOR: a Monocub uses the ability under `key`, aimed as the picker
 * answered (`{ targetId, choice }`). The row's price is an action from the normal
 * budget (`cost`) and Hope on top (`hopeCost`), and both are paid on the GM
 * (`cubAbilityOnGm`) once its conditions hold.
 *
 * PAID ON THE GM, AFTER THE CONDITIONS (E72 C1, 12.11.2026; audit S18-50, the owner's DC13 and D39). Until E72 this
 * browser spent the action and wrote the Hope with the reason "price" before it asked the GM, and the GM, which could
 * not see that anything was paid, refused with no refund (ACT-12): a world that moved between the two - the target
 * walked out, an Eclipse opened - cost the Monocub an action and a Hope for nothing, and the GM's whisper said so. Now
 * this browser asks the same questions as a courtesy, to say no early and in the player's own words, and pays
 * nothing; the GM asks them again with the world as it holds it, and only then takes the action and the Hope, so
 * every refusal costs nothing.
 */
export async function performCubAbility(actor, key, { targetId, choice } = {}) {
    const row = abilityRow(key);
    if (!row || cubAbilityRefusal(actor, key, choice)) return null;
    if (await lockRefusal(row)) return null;
    const blocked = await blockOf(row, actor);
    if (blocked) {
        ui.notifications.warn(game.i18n.localize(CUB_BLOCKS[blocked.key]?.say ?? "DRPG.Monocub.moveRefused"));
        return null;
    }

    if (actionsLeft(actor) < row.cost) {
        ui.notifications.warn(plural("DRPG.Actions.notEnough", {
            actor: actor.name, left: actionsLeft(actor), needed: row.cost
        }, "left"));
        return null;
    }
    if (cubHopeTotal(actor) < row.hopeCost) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.needHope"));
        return null;
    }

    // Resolved and paid on the GM's client: with no GM there is nobody to do either (DESP-05). `gmOnline` is the
    // question alone; what is said is the bridge's own sentence for a request with no GM (`sayNotDone`, E31).
    if (!game.user.isGM) {
        const { gmOnline, sayNotDone } = await import("./bridge-guards.mjs");
        if (!gmOnline()) {
            sayNotDone("monocub.ability", "noGm", { nothingSpent: true });
            return null;
        }
    }

    // The target rule asked here too (ACT-12, 17.09): the honest "nobody here" said before the GM is asked.
    if (await CUB_TARGETS[row.target].refuses(actor, await targetOf(row, targetId))) {
        ui.notifications.warn(game.i18n.localize(row.target === "project" ? "DRPG.Monocub.noProjectHere" : "DRPG.Monocub.nobodyHere"));
        return null;
    }

    // The GM asks, pays, throws and scores (`cubAbilityOnGm`); its answer is the roll, which the card shows here as
    // this Monocub's. Not answered (refused, no GM): nothing to show, nothing paid, and the GM has said why.
    const { requestCubAbility } = await import("./gm-bridge.mjs");
    const res = await requestCubAbility({ actorId: actor.id, key, targetId, choice });
    const thrown = res.ok ? res.value : null;
    // A GM's own ask is run here (`local`), so a student's share refused (E72 C4) is said here as the bridge says it.
    if (thrown?.capped && game.user.isGM) {
        const { sayNotDone } = await import("./bridge-guards.mjs");
        sayNotDone("monocub.ability", thrown.capped === "time" ? "capReached" : "capDay");
        return null;
    }
    // A move with no dice (E72 C5: Redeem, Ask for Hope): its card, if any, is the GM's; nothing to post here.
    if (row.roll === "none") return thrown?.done ? thrown : null;
    if (!thrown?.roll) return null;
    const roll = Roll.fromData(thrown.roll);
    const total = Number(thrown.total) || 0;
    const isCritical = thrown.isCritical === true;
    await postCubRoll(actor, row, roll, total, isCritical, choice);
    return { roll, total, isCritical };
}

/**
 * Why the GM will not carry out this ability now, or null (E72 C1): the row, the Monocub and the choice
 * (`cubAbilityRefusal`), the row's locks (`CUB_LOCKS`, asked quietly), the price against the sheet as this GM holds
 * it, and the target of the row's rule. Each answer is an English reason for the GM's log. Pure of writes.
 */
export async function cubAbilityRefusalOnGm(actor, row, key, target, choice) {
    const why = cubAbilityRefusal(actor, key, choice);
    if (why) return why;
    for (const lock of row.locks ?? []) {
        const entry = CUB_LOCKS[lock];
        if (!entry || await entry.shut()) return `the ability is shut (${lock})`;
    }
    const blocked = await blockOf(row, actor);
    if (blocked) return blocked.why;
    const price = priceOf(actor, row);
    if (actionsLeft(actor) < price.cost) return "the Monocub has no action left for it";
    if (cubHopeTotal(actor) < price.hopeCost) return "the Monocub has not the Hope for it";
    return CUB_TARGETS[row.target].refuses(actor, target);
}

/*
 * A MOVE DONE TO ORDER (E72 C17, 12.11.2026; the owner's DC34: "a move done to order costs only the action"). Defaults,
 * owner may revise: a Bribe the Monocub accepts orders one move of it this time of day (`cubStore`'s `order`, written by
 * `answerBribeOnGm`); the next move whose row has an `executionCost` costs that (Confusion and Tinker: the action, no
 * Hope) and uses the order up; an order unused lapses at the turn (`settleBribes`).
 */
function orderOpen(actor) {
    const order = cubRowOf(actor)?.order;
    const slot = moveSlotNow();
    return Boolean(order && ["chapter", "epoch", "day", "timeOfDay"].every(key => order[key] === slot[key]));
}

/** What `row` costs `actor` now: `{ cost, hopeCost, toOrder }`, the row's `executionCost` for a move to order. */
export function priceOf(actor, row) {
    const exec = row?.executionCost;
    if (exec && orderOpen(actor)) return { cost: Number(exec.cost) || 0, hopeCost: Number(exec.hopeCost) || 0, toOrder: true };
    return { cost: row?.cost ?? 0, hopeCost: row?.hopeCost ?? 0, toOrder: false };
}

/** The time of day a move is counted under: the clock's chapter, season, day and time of day. */
function moveSlotNow() {
    const clock = getClock() ?? {};
    return { chapter: clock.chapter ?? null, epoch: seasonEpoch(), day: clock.day ?? null, timeOfDay: clock.timeOfDay ?? null };
}

/**
 * WHY THIS STUDENT MAY NOT BE THE TARGET NOW, or null (E72 C4, 12.11.2026; audit S18-59, the owner's DC32 = 2): the row's
 * `caps`, counted per target student over every Monocub (`cubTargetStore`) - `perTimeOfDay` moves this time of day and
 * `perDay` this game day. A row of another day counts nothing; one of this day but another time of day counts toward the
 * day only. GM-side; answers "time" or "day", which the bridge's run says as `capReached` and `capDay`
 * (bridge-runs-acts.mjs `handleCubAbility`).
 */
export function cubCapRefusal(row, target, slot = moveSlotNow()) {
    if (!row?.caps || !target) return null;
    const held = cubTargetStore.get(target.id);
    const sameDay = held && held.chapter === slot.chapter && held.epoch === slot.epoch && held.day === slot.day;
    if (!sameDay) return null;
    const now = held.timeOfDay === slot.timeOfDay ? Number(held.slot) || 0 : 0;
    if (Number.isInteger(row.caps.perTimeOfDay) && now >= row.caps.perTimeOfDay) return "time";
    if (Number.isInteger(row.caps.perDay) && (Number(held.today) || 0) >= row.caps.perDay) return "day";
    return null;
}

/** GM: count a move on `target` this time of day (E72 C4), once its conditions held and its price was taken. */
async function noteCubMove(row, target, slot = moveSlotNow()) {
    if (!row?.caps || !target) return;
    const held = cubTargetStore.get(target.id);
    const sameDay = held && held.chapter === slot.chapter && held.epoch === slot.epoch && held.day === slot.day;
    const sameTime = sameDay && held.timeOfDay === slot.timeOfDay;
    await cubTargetStore.patch(target.id, { ...slot, slot: (sameTime ? Number(held.slot) || 0 : 0) + 1,
        today: (sameDay ? Number(held.today) || 0 : 0) + 1 });
}

/**
 * An ability asked of this GM (E08+E28 C17; paid here since E72 C1): its conditions asked, its price taken, the row's
 * `roll` thrown, its `resolve` applied to the GM's own throw, answered as the roll (its JSON), the total and the
 * critical, for the Monocub's card. GM-side. The packet's `key`, `targetId` and `choice` are claims: every condition
 * is asked again with the world as this GM holds it (`cubAbilityRefusalOnGm`) - a packet naming a target in another
 * room, a sender who stopped being a Monocub, a Monocub with no Hope - before anything is written.
 *
 * ASKED BEFORE THE DICE (E08+E28 fix r2-H7, 05.10.2026; the round-2 review's m6) and, since E72 C1, BEFORE THE PRICE.
 * A refusal is answered with no roll, so no card is posted, and costs the Monocub nothing: the GM logs it and
 * whispers `DRPG.Monocub.meddleRefused` ("you keep your action and Hope"), which is now true. The locks are asked here
 * too since C1: they could not be until then (CALL-16), because a Meddle paid on the Monocub's browser a moment before
 * an Eclipse opened would have lost its Hope for good; with the price taken here, a shut window refuses for free.
 *
 * ONE AT A TIME PER MONOCUB (`serialWrite`, utils.mjs): two packets sent together would both read one Hope and both
 * pass; under one key the second reads the sheet the first wrote.
 */
export async function cubAbilityOnGm({ actorId, key, targetId, choice } = {}) {
    if (!game.user.isGM) return null;
    return serialWrite(`drpg-cub-ability:${actorId}`, async () => {
        /* THE STORES FIRST (the 1.2.110 review, E72 reader #7): the refusals, the caps and the order read the Monocubs'
           rows, the students' shares and the project work synchronously, as patchCubRow's write and the roll guard do
           not; on a primary just reloaded beside a second GM an empty row let a once-a-day move or a cap through. A
           time-out refuses the move, as the other GMs' rows are not here to judge it by. */
        const held = await Promise.all([cubStore.whenHydrated(), cubTargetStore.whenHydrated(), projectWorkStore.whenHydrated()]);
        if (held.includes("timedOut")) {
            warn(`Refused a Monocub's "${key}": the other GMs' copies of the Monocubs' record did not arrive.`);
            return null;
        }
        const actor = game.actors.get(actorId);
        const row = abilityRow(key);
        const target = await targetOf(row, targetId);
        const why = row ? await cubAbilityRefusalOnGm(actor, row, key, target, choice) : cubAbilityRefusal(actor, key, choice);
        if (why) {
            warn(`Refused a Monocub's "${key}" by ${actor?.name ?? actorId}: ${why}.`);
            if (isMonocub(actor)) {
                // The row's own sentence (Confusion's), or the one every other move says (E72 C5).
                const said = row?.refusedSay ?? "DRPG.Monocub.moveRefused";
                await whisperToOwner(actor, `<p>${game.i18n.localize(said)}</p>`, { veiled: true });
            }
            return null;
        }
        // The student's share (E72 C4), the price and the note in one lock a target (E72 fix round, review #4): two
        // Monocubs on one student in step both passed one share, the note coming after the price's awaits.
        const gate = await serialWrite(`drpg-cub-target:${target?.id ?? ""}`, async () => {
            // The share: told to the asker with its code, and nothing paid.
            const capped = cubCapRefusal(row, target);
            if (capped) {
                warn(`Refused a Monocub's "${key}" by ${actor.name}: ${target.name} has had its share this ${capped === "time" ? "time of day" : "day"}.`);
                return { capped };
            }
            // The price, after every condition: quiet (the toast and the pip sound would be the GM's), as an Objection's is.
            // A move to order costs the row's `executionCost` and uses the order up (E72 C17).
            const price = priceOf(actor, row);
            if (price.cost > 0 && !await spendAction(actor, price.cost, { quiet: true })) return { unpaid: true };
            if (price.toOrder) await patchCubRow(actor.id, { order: null });
            await noteCubMove(row, target);
            return { price };
        });
        if (gate.capped) return { capped: gate.capped };
        if (gate.unpaid) return null;
        const { price } = gate;
        // The purse first, then the sheet (E72 C14); where each point came from is kept for a refund (Tinker's double).
        const paid = price.hopeCost > 0 ? await spendCubHope(actor, price.hopeCost) : null;
        const { roll, total, isCritical } = await CUB_ROLLS[row.roll]();
        await CUB_RESOLVERS[row.resolve](actor, target, choice, total, isCritical, row, paid);
        await logCubMove(actor, key, choice, target);
        return { roll: roll ? roll.toJSON() : null, total, isCritical, done: true };
    });
}

/** Whom to aim the ability under `key` at, and which of the row's choices. The player's own picker. */
export async function cubAbilityDialog(actor, key) {
    const row = abilityRow(key);
    if (!row || !isMonocub(actor)) return null;
    if (await lockRefusal(row)) return null;
    // A move aimed at the Monocub itself asks nothing (E72 C5: Redeem, Ask for Hope).
    if (row.target === "self") return performCubAbility(actor, key, { targetId: actor.id, choice: row.choices[0] });

    const targets = await CUB_TARGETS[row.target].list(actor);
    if (!targets.length) {
        ui.notifications.warn(game.i18n.localize(row.target === "project" ? "DRPG.Monocub.noProjectHere" : "DRPG.Monocub.nobodyHere"));
        return null;
    }


    /*
     * A CALL WINDOW (E51 C2, 30.10.2026; audit S17-48): `callWindow`, on the Hope side - the Monocub
     * pays Hope - under the header every Call window has: the ability's name, what it is for, its
     * price; then the tiers it is thrown against (`cubTiersHtml`, the owner's amendment of 14.10).
     * Not the GM's road: the GM throws the dice, but nobody decides anything before it lands.
     */
    /* ONE OF EACH ON THIS BROWSER (E44 C2c, 04.11.2026; D176). The ability's window carried no `once`, so a second
       press while one stood opened a second; now it raises the first and answers null, and nothing is thrown. */
    /* THE ACTION'S LAYOUT (E72, 12.11.2026; R3818): the header and the tiers on the left, the targets as the action's rows
       on the right, where a dropdown stood. The choices stay buttons of the footer (Help, Hinder): each is the answer
       itself, and a row more would be a press more. */
    const result = await callWindow({
        kind: "hope", title: row.label, once: `drpg-cub-ability-${key}`, layout: "action",
        header: callHeader({ label: row.label, cost: row.hopeCost }, "hope", {
            effect: game.i18n.localize(row.intro ?? "DRPG.Monocub.meddleIntro"),
            price: plural("DRPG.Monocub.meddleCostShort", { hope: row.hopeCost, actions: row.cost }, "actions")
        }),
        brief: `<p class="notes">${game.i18n.localize("DRPG.Monocub.tiersIntro")}</p>
            ${cubTiersHtml(row)}`,
        body: `<form>${callRowsHtml(targets.map(a => ({ value: a.id, label: a.name, icon: row.target === "project" ? "fa-list-check" : "fa-user" })),
            { name: "target", prompt: game.i18n.localize("DRPG.Monocub.target") })}</form>`,
        // One button per choice of the row, the first the primary and the default, the others secondaries (the kit's
        // slots, E21 C5a); their labels are `DRPG.Monocub.<choice>` (R1's LITERAL_KEYS names the two the table has).
        footer: (() => {
            const buttons = row.choices.map(choice => ({
                action: choice, label: game.i18n.localize(`DRPG.Monocub.${choice}`),
                callback: (e, b, d) => ({ targetId: pickedRow(d.element, "target"), choice })
            }));
            return { primary: buttons[0], secondary: buttons.slice(1) };
        })()
    });

    if (!result || result === "cancel") return null;
    return performCubAbility(actor, key, result);
}

/**
 * Score and apply a Meddle the GM threw: `choice` is "help" or "hinder", `total` and
 * `isCritical` the GM's own dice. The row's thresholds decide the tier. GM-side: it
 * writes to another player's sheet.
 */
async function scoreMeddle(actor, target, choice, total, isCritical, row) {
    const help = choice === "help";
    const hit = isCritical ? row.critical : resolveThreshold(total, row.thresholds);

    if (!hit) {
        await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Monocub.meddleFailed")}</p>`);
        return { success: false };
    }

    // A Bounty on the student is claimed by a Hinder that lands (E72 C16).
    if (!help) await claimBounty(actor, target);

    let text = help ? hit.help : hit.hinder;
    // The target's own sentence (DESP-06), never the Monocub's receipt.
    let targetText = (help ? hit.helpTarget : hit.hinderTarget) ?? text;

    /*
     * THE CRITICAL SAYS WHAT IT DID (E15 C4, 25.10.2026; audit S09-30). "You get the action back"
     * was said whatever happened: `refundAction` stops at the budget's maximum, so a target who had
     * spent nothing got nothing, and a Hinder on a target with no action left wasted none. Each now
     * reads the actions after its write and says the other sentence when nothing moved. The
     * numbers are the rules' (D21): no free action in place of the refund.
     */
    if (isCritical) {
        const moved = help ? await refundedAction(target) : await wasteAction(target);
        if (!moved) {
            const key = help ? "critHelpNothing" : "critHinderNothing";
            text = game.i18n.localize(`DRPG.Monocub.${key}`);
            targetText = game.i18n.localize(`DRPG.Monocub.${key}Target`);
        }
    } else {
        // Quiet: the target's card below is the one sentence they are sent; `armCall`'s own notice
        // was a second card for the same Confusion (S09-30).
        const { armCall } = await import("./call-effects.mjs");
        if (hit.grants === "bonus") {
            await armCall(target, {
                key: "meddle", grants: "bonus", amount: help ? 1 : -1, from: actor.id, quiet: true
            });
        } else {
            await armCall(target, {
                key: "meddle", grants: help ? "advantage" : "disadvantage", from: actor.id, quiet: true
            });
        }
    }

    /*
     * THE SOUND RIDES THE CARDS, and that is what makes it correct here.
     *
     * This function is on the GM's client - `playSfx` would ring the GM's
     * speakers and nobody else's. The flag plays wherever the message lands,
     * and `onCreateChatMessage` keeps GMs out of a whisper that did not ask for
     * them, so these two carry the sound to exactly two people: the Monocub who
     * spent the action, and the student it happened to.
     *
     * IT CANNOT LEAK WHO. A sound has no sender, and both whispers play the
     * same one - the target learns that something reached them, which is what
     * their card already says, and nothing more.
     *
     * AND THE TWO CARDS ARE VEILED (E06 C10, 28.09.2026; audit S09-10). A
     * whisper's list is a field every console reads: two cards with this sound,
     * one to the Monocub's player and one to the target's, posted together, told
     * every browser who used Confusion on whom. The room sees the Monocub's dice
     * (the owner's answer of 27.09: Confusion is seen by the room, like every
     * Monocub roll), and the roll does not say who it was aimed at. Veiled, each
     * card's words and sound reach its own reader alone (secret.mjs), and its
     * document names nobody.
     */
    const meddleSfx = { veiled: true, flags: { [MODULE_ID]: { sfx: "meddle" } } };

    await whisperToOwner(actor, `<p><strong>${game.i18n.format("DRPG.Monocub.meddledOn", {
        name: foundry.utils.escapeHTML(target.name)
    })}</strong></p><p>${foundry.utils.escapeHTML(text)}</p>`, meddleSfx);

    // The target is told SOMETHING happened without being told who - the guide
    // has Monocubs act "z boku" (from the sidelines). Their card does not name
    // the Monocub; the room's view of the dice may, and the Monocub's own
    // window says so (`meddleIntro`, E06 C10).
    await whisperToOwner(target, `<p>${foundry.utils.escapeHTML(targetText)}</p>`, meddleSfx);

    log(`${actor.name} used Meddle on ${target.name}: ${text}`);
    return { success: true, text };
}

/**
 * How the GM's own throw is scored and applied, by the key a row's `resolve` names:
 * `(actor, target, choice, total, isCritical, row)`. A second ability is one row and
 * one entry here.
 */
export const CUB_RESOLVERS = Object.freeze({ meddle: scoreMeddle, redeem: redeemHope, askHope: postHopeAsk, tinker: scoreTinker, bet: placeBet });

/**
 * TINKER, SCORED ON THE GM'S THROW (E72 C13; the owner's DC23, DC24). 12 or more moves the project one step, forward
 * for Help, back for Hinder, through the one entry as a Monocub's change (projects.mjs `applyProjectChange`, kind
 * "monocub"); a step that would finish it holds one short (default, owner may revise: no completion card, no trap
 * armed). A double gives the row's Hope back. The Monocub is told on a veiled card what moved, by the project's name
 * (it is public, and in the Monocub's room); the room saw the roll and its direction, never the project.
 */
async function scoreTinker(actor, target, choice, total, isCritical, row, paid = null) {
    const help = choice === "help";
    const esc = foundry.utils.escapeHTML;
    const P = await import("./projects.mjs");
    let said;
    if (resolveThreshold(total, row.thresholds)) {
        const project = P.allProjects().find(p => p.id === target.id);
        if (help && project && project.start > 0 && project.current + 1 >= project.start) {
            said = game.i18n.format("DRPG.Monocub.tinkerHeld", { name: esc(project.name) });
        } else {
            const done = await P.applyProjectChange(target.id, { delta: help ? 1 : -1 },
                { by: { kind: "monocub", userId: ownerOf(actor)?.id ?? game.user.id, actorId: actor.id } });
            said = done?.changed
                ? game.i18n.format(help ? "DRPG.Monocub.tinkerForward" : "DRPG.Monocub.tinkerBack", { name: esc(done.name ?? target.name) })
                : game.i18n.format("DRPG.Monocub.tinkerStill", { name: esc(target.name) });
        }
    } else {
        said = game.i18n.localize("DRPG.Monocub.meddleFailed");
    }
    // Only what this move paid comes back (E72 fix round, review #1): a move to order paid no Hope and gets none.
    if (isCritical && (paid?.purse > 0 || paid?.sheet > 0)) {
        await refundCubHope(actor, paid);
        said += ` ${game.i18n.localize("DRPG.Monocub.tinkerHopeBack")}`;
    }
    await whisperToOwner(actor, `<p>${said}</p>`, { veiled: true });
    log(`${actor.name} (a Monocub) used Tinker on "${target.name}" (${choice}, ${total}${isCritical ? ", a double" : ""}).`);
    return { success: true };
}

/**
 * REDEEM (E72 C5; audit S18-60, the owner's DC22): +1 Hope from nothing, on the GM, after its blocks held (once a game
 * day, the Hope not full, no darkened hour); it takes no action since cca805ca. The day is written in the Monocub's row
 * (`redeemDay`), its owner told on a veiled card.
 */
async function redeemHope(actor) {
    // Held to the limit with the purse counted (E72 C14; DC37): the sheet takes it, up to the limit less the purse.
    await trustedWrite(actor, { "system.resources.hope.value": Math.min(resourceMax(actor, "hope") - purseOf(actor), resourceValue(actor, "hope") + 1) },
        { reason: "gmRuling" });
    await patchCubRow(actor.id, { redeemDay: gameDayNow() });
    await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Monocub.redeemDone")}</p>`, { veiled: true });
    log(`${actor.name} (a Monocub) used Redeem: +1 Hope.`);
    return { success: true };
}

/**
 * ASK FOR HOPE (E72 C5; audit S18-60): the GMs' card in the Monocub's thread (call-gm.mjs `callGm`), Give 1, Give 2 or
 * Not now, ruled once by whichever GM clicks (`claimCard`, messenger-app.mjs's `cubGiveHope` and `cubNotNow`, which
 * call `answerHopeAsk`). The ask stays open in the Monocub's row (`askOpen`) until a GM answers it.
 */
async function postHopeAsk(actor) {
    const { callGm } = await import("./gm-bridge.mjs");
    const owner = ownerOf(actor);
    const esc = foundry.utils.escapeHTML;
    const give = n => ({ action: "cubGiveHope", label: game.i18n.format("DRPG.Monocub.askGive", { n }), data: { actor: actor.id, n } });
    const posted = await callGm(actor, {
        title: game.i18n.localize("DRPG.Monocub.askTitle"),
        body: `<p>${esc(game.i18n.format("DRPG.Monocub.askBody", { name: actor.name }))}</p>`,
        actions: [give(1), give(2), { action: "cubNotNow", label: game.i18n.localize("DRPG.Monocub.askNotNow"), data: { actor: actor.id } }],
        thread: owner?.id ?? null,
        veiled: true
    });
    if (posted) await patchCubRow(actor.id, { askOpen: askMarkNow() });
    log(`${actor.name} (a Monocub) asked the GMs for Hope.`);
    return { success: Boolean(posted) };
}

/**
 * A GM ANSWERS AN ASK FOR HOPE (E72 C5): `n` Hope from this GM's Despair (`convertDespairToHope`, which tells the
 * Monocub), or none for Not now; the ask is closed either way once answered. Answers the words the card settles with,
 * or null when nothing was given and nothing should close (a pool with nothing to spend).
 */
export async function answerHopeAsk(actor, n) {
    if (!game.user?.isGM || !actor) return null;
    // A student who is a Monocub no more is answered Not now (the 1.2.110 review's #5): no Despair turned into its Hope.
    const amount = isMonocub(actor) ? wholeNumber(n, { min: 0, fallback: 0 }) : 0;
    if (amount > 0) {
        const { convertDespairToHope } = await import("./despair.mjs");
        const granted = await convertDespairToHope(game.user.id, actor, amount);
        if (granted <= 0) return null;
        await patchCubRow(actor.id, { askOpen: null });
        return game.i18n.format("DRPG.Monocub.askGiven", { n: granted, name: game.user.name });
    }
    await patchCubRow(actor.id, { askOpen: null });
    await whisperToOwner(actor, `<p>${game.i18n.localize("DRPG.Monocub.askNotNowTold")}</p>`, { veiled: true });
    return game.i18n.format("DRPG.Monocub.askDeclined", { name: game.user.name });
}

/** A living student offers `cub` a Bribe (calls.mjs `spendHopeCall`): the GM's on a GM's browser, else `bribe.offer`. */
export async function offerBribe(actor, cub) {
    if (!actor || !cub) return null;
    if (game.user?.isGM) return offerBribeOnGm({ actorId: actor.id, cubId: cub.id }, game.user);
    const { requestBribeOffer } = await import("./gm-bridge.mjs");
    const res = await requestBribeOffer({ actorId: actor.id, cubId: cub.id });
    return res.ok ? (res.value ?? null) : null;
}

/** The offers whose window this browser opened, so a copy received again does not open a second. */
const bribesShown = new Set();

/**
 * A Bribe's window on the Monocub's player's browser (E72 C15): who offers, the price, Accept or Refuse ("Odrzuć", the
 * one place the glossary keeps it). No side, colour or title (DC39): the kit's plain window. Closed with no answer, the
 * offer stays open until the time of day turns.
 */
export async function openBribeOffer(actor, bribeId, offer) {
    if (!actor || game.user?.isGM || !actor.isOwner || bribesShown.has(bribeId)) return null;
    bribesShown.add(bribeId);
    const esc = foundry.utils.escapeHTML;
    const answer = await drpgWindow({
        title: game.i18n.localize("DRPG.Monocub.bribeTitle"),
        classes: ["drpg-panel", "drpg-cub-bribe"],
        body: `<p>${esc(game.i18n.format("DRPG.Monocub.bribeAsk", { name: offer?.fromName ?? "?", cost: offer?.cost ?? 0, cub: actor.name }))}</p>`,
        footer: {
            primary: { action: "accept", label: game.i18n.localize("DRPG.Monocub.bribeAccept"), callback: () => "accept" },
            secondary: [{ action: "refuse", label: game.i18n.localize("DRPG.Monocub.bribeRefuse"), callback: () => "refuse" }]
        },
        rejectClose: false
    });
    if (answer !== "accept" && answer !== "refuse") {
        bribesShown.delete(bribeId);
        return null;
    }
    const { requestBribeAnswer } = await import("./gm-bridge.mjs");
    const res = await requestBribeAnswer({ cubId: actor.id, bribeId, accept: answer === "accept" });
    return res.ok ? res.value ?? null : null;
}

/*
 * A BRIBE (E72 C15, 12.11.2026; the owner's DC25, DC26, DC39: "secret between student and Monocub; no sides, colours
 * or titles"). A living student's Hope Call (config.mjs HOPE_CALLS.bribe) offers a Monocub its price for a favour the
 * two agree between them. The offer waits in the Monocub's row (`cubStore`'s `bribes`, `{ id: { from, fromName, cost,
 * at } }`), which its owner's copy carries and nobody else's, and is paid only on the Monocub's player's yes, on the GM in
 * one step under the Monocub's key: the payer's Hope down (reason "call"), the Monocub's purse up (`addToPurse`, C14). A
 * no, a payer who can no longer pay, a purse with no room or the darkening close it unpaid; what is still open lapses at
 * the next time of day (`settleBribes`, clock.mjs). One open offer a pair. Every card is veiled and goes to the two
 * players alone (`whisperToOwner`); the world's data keeps only the payer's Hope drop. Defaults, owner may revise: the
 * price 1 Hope, any Monocub at the table, the lapse at the next time of day.
 */

/** Why `payer` may not offer `cub` a Bribe now, or null: a living student and a Monocub, each a character of its own. */
async function bribeRefusal(payer, cub, sender) {
    if (!payer || payer.type !== "character") return "the payer is not a character";
    if (sender && !sender.isGM && !payer.testUserPermission(sender, "OWNER")) return "the sender does not own the payer";
    if (isMonocub(payer) || isDeadForGm(payer) || isMonokuma(payer)) return "only a living student offers a Bribe";
    if (!cub || !isMonocub(cub) || cub.id === payer.id) return "the Bribe's Monocub is not one";
    const { callBarred } = await import("./calls.mjs");
    if (await callBarred(payer)) return "no Call can be made now";
    return null;
}

/** The price of a Bribe: its Call's. */
function bribeCost() {
    return Math.max(1, Math.trunc(Number(HOPE_CALLS.bribe?.cost) || 1));
}

/** GM: `payer` offers `cub` a Bribe (`bribe.offer`, or a GM's own). Answers `{ bribeId }`, or null when refused. */
export async function offerBribeOnGm({ actorId, cubId } = {}, sender = null) {
    if (!game.user?.isGM) return null;
    return serialWrite(`drpg-bribe:${cubId}`, async () => {
        const payer = game.actors.get(actorId), cub = game.actors.get(cubId);
        const why = await bribeRefusal(payer, cub, sender);
        const cost = bribeCost();
        const open = cub ? (cubRowOf(cub)?.bribes ?? {}) : {};
        const refused = why ?? (Object.values(open).some(b => b?.from === payer.id) ? "an offer of this pair is still open"
            : resourceValue(payer, "hope") < cost ? "the payer has not the Hope for it" : null);
        if (refused) {
            warn(`Refused a Bribe of ${payer?.name ?? actorId} to ${cub?.name ?? cubId}: ${refused}.`);
            return null;
        }
        const bribeId = foundry.utils.randomID();
        await patchCubRow(cub.id, { bribes: { ...open, [bribeId]: { from: payer.id, fromName: payer.name, cost, at: serverNow() } } });
        const esc = foundry.utils.escapeHTML;
        await whisperToOwner(payer, `<p>${esc(game.i18n.format("DRPG.Monocub.bribeOffered", { name: cub.name, cost }))}</p>`, { veiled: true });
        await whisperToOwner(cub, `<p>${esc(game.i18n.format("DRPG.Monocub.bribeOfferedCub", { name: payer.name, cost }))}</p>`, { veiled: true });
        log(`${payer.name} offered the Monocub ${cub.name} a Bribe of ${cost} Hope.`);
        return { bribeId };
    });
}

/** GM: the Monocub's player answers a Bribe (`bribe.answer`). Answers `{ accepted }`, or null for no such offer or sender. */
export async function answerBribeOnGm({ cubId, bribeId, accept } = {}, sender = null) {
    if (!game.user?.isGM) return null;
    return serialWrite(`drpg-bribe:${cubId}`, async () => {
        const cub = game.actors.get(cubId);
        const open = cub ? { ...(cubRowOf(cub)?.bribes ?? {}) } : {};
        const offer = open[bribeId];
        if (!cub || !offer) return null;
        if (sender && !sender.isGM && !cub.testUserPermission(sender, "OWNER")) return null;
        delete open[bribeId];
        await patchCubRow(cub.id, { bribes: Object.keys(open).length ? open : null });
        const payer = game.actors.get(offer.from);
        const esc = foundry.utils.escapeHTML;
        const tell = async key => {
            if (payer) await whisperToOwner(payer, `<p>${esc(game.i18n.format(`DRPG.Monocub.${key}`, { name: cub.name, cost: offer.cost }))}</p>`, { veiled: true });
        };
        if (!accept) {
            await tell("bribeRefused");
            log(`The Monocub ${cub.name} refused ${offer.fromName}'s Bribe.`);
            return { accepted: false };
        }
        const { overflowBlocksHope } = await import("./overflow.mjs");
        // The payer's check and payment in one lock a payer (E72 fix round, review #3): two Monocubs answering one
        // payer's offers in step each read the same Hope and each wrote it less one. A student no longer a Monocub is
        // paid nothing (review #6).
        // The room read and the purse written under the Monocub's purse lock too (the second review's #3): bribe, payer, purse,
        // the one order every road takes them in.
        const unpaid = await serialWrite(`drpg-bribe-payer:${offer.from}`, () => purseWrite(cub.id, async () => {
            const room = resourceMax(cub, "hope") - cubHopeTotal(cub);
            const why = !isMonocub(cub) ? "the Monocub is not one now" : !payer || isDeadForGm(payer) ? "the payer is gone"
                : resourceValue(payer, "hope") < offer.cost ? "the payer has not the Hope for it"
                    : overflowBlocksHope() ? "the darkening blocks Hope" : room < offer.cost ? "the Monocub's Hope is full" : null;
            if (why) return why;
            await trustedWrite(payer, { "system.resources.hope.value": resourceValue(payer, "hope") - offer.cost }, { reason: "call" });
            const took = await addToPurseNow(cub, offer.cost);
            // Paid whole or not at all: a purse that took less (the darkening fell meanwhile) gives it back, the payer is paid back.
            if (took < offer.cost) {
                if (took > 0) await patchCubRow(cub.id, { purse: Math.max(0, purseOf(cub) - took) });
                await trustedWrite(payer, { "system.resources.hope.value": resourceValue(payer, "hope") + offer.cost }, { reason: "refund" });
                return "the Monocub's Hope is full";
            }
            return null;
        }));
        if (unpaid) {
            warn(`A Bribe of ${offer.fromName} to ${cub.name} was closed unpaid: ${unpaid}.`);
            await tell("bribeUnpaid");
            await whisperToOwner(cub, `<p>${esc(game.i18n.format("DRPG.Monocub.bribeUnpaidCub", { name: offer.fromName }))}</p>`, { veiled: true });
            return { accepted: false };
        }
        // The move it orders this time of day (E72 C17), and the pair's count this chapter (E72 C19).
        const pairs = { ...(cubRowOf(cub)?.pairs ?? {}) };
        const held = pairs[payer.id];
        const chapter = getClock()?.chapter ?? null, epoch = seasonEpoch();
        pairs[payer.id] = { chapter, epoch, n: (held?.chapter === chapter && held?.epoch === epoch ? Number(held.n) || 0 : 0) + 1 };
        await patchCubRow(cub.id, { order: { from: payer.id, ...moveSlotNow() }, pairs });
        const flags = bribeFlags(cub, payer);
        if (flags.length) {
            const { whisperToGms } = await import("./utils.mjs");
            const esc2 = foundry.utils.escapeHTML;
            await whisperToGms(flags.map(flag => `<p>${esc2(game.i18n.format(`DRPG.Monocub.flag.${flag}`, { cub: cub.name, name: payer.name }))}</p>`).join(""));
        }
        await tell("bribeAccepted");
        await whisperToOwner(cub, `<p>${esc(game.i18n.format("DRPG.Monocub.bribeAcceptedCub", { name: payer.name, cost: offer.cost }))}</p>`, { veiled: true });
        log(`The Monocub ${cub.name} accepted ${payer.name}'s Bribe: ${offer.cost} Hope into its purse.`);
        return { accepted: true };
    });
}

/**
 * THE LOG'S FLAGS (E72 C19; the plan's C19): what the GMs are whispered about an accepted Bribe - "killer", the payer is
 * this chapter's Blackened (incident-store.mjs `blackenedIds`, the GMs' register); "third", it is the third or later the
 * pair has made this chapter (`cubStore`'s `pairs`). GM-side; the flags of the pair as they stand.
 */
export function bribeFlags(cub, payer) {
    if (!game.user?.isGM || !cub || !payer) return [];
    const flags = [];
    if (blackenedIdsNow().includes(payer.id)) flags.push("killer");
    const held = cubRowOf(cub)?.pairs?.[payer.id];
    if (held && held.chapter === (getClock()?.chapter ?? null) && held.epoch === seasonEpoch() && Number(held.n) >= 3) flags.push("third");
    return flags;
}

/** GM: every Bribe still open lapses, unpaid, its payer told (each time of day, clock.mjs). Answers how many lapsed. */
export async function settleBribes() {
    if (!game.user?.isGM) return 0;
    let lapsed = 0;
    for (const [cubId, row] of Object.entries(cubStore.entries() ?? {})) {
        // An order not used this time of day lapses with the offers (E72 C17).
        if (row?.order) await patchCubRow(cubId, { order: null });
        if (!Object.keys(row?.bribes ?? {}).length) continue;
        await serialWrite(`drpg-bribe:${cubId}`, async () => {
            const now = cubStore.get(cubId)?.bribes ?? {};
            if (!Object.keys(now).length) return;
            await patchCubRow(cubId, { bribes: null });
            const cub = game.actors.get(cubId);
            for (const offer of Object.values(now)) {
                lapsed += 1;
                const payer = game.actors.get(offer?.from);
                if (payer) {
                    await whisperToOwner(payer, `<p>${foundry.utils.escapeHTML(game.i18n.format("DRPG.Monocub.bribeLapsed", { name: cub?.name ?? "?" }))}</p>`, { veiled: true });
                }
            }
        });
    }
    if (lapsed) log(`${lapsed} Bribe(s) lapsed unanswered at the turn of the time of day.`);
    return lapsed;
}

/*
 * A BOUNTY (E72 C16, 12.11.2026; the owner's DC27 = 2, DC40: "every Call is public, Bounty the one exception: secret, for
 * Monocubs and GMs, 1 Despair through the debt buffer, 1 Hope to the purse"). A GM's Despair Call (config.mjs
 * DESPAIR_CALLS.bounty) puts a Bounty on a living student: the GM's pool owes its price from now, paid at the next time of
 * day (despair.mjs `oweDespair`), and nothing public is posted. The open Bounties are the GMs' (gm-stores.mjs
 * `bountyStore`, one a student), every Monocub's owner's copy carries them (`cubsFor`), and each Monocub's player and the
 * GMs are told on a veiled card. The first Monocub whose Confusion hinders that student and lands claims it
 * (`claimBounty`, from `scoreMeddle`): its reward into that Monocub's purse (`addToPurse`, held to the limit). What is not
 * claimed lapses at the next time of day (`lapseBounties`, clock.mjs). Defaults, owner may revise: the claim by a landing
 * Hinder, the lapse at the next time of day.
 */

/** The open Bounties as a Monocub's owner is sent them: the student's name and the reward. GM-side. */
function openBounties() {
    return Object.values(bountyStore.entries() ?? {}).map(b => ({ targetName: String(b?.targetName ?? ""), reward: Math.max(0, Math.trunc(Number(b?.reward) || 0)) }));
}

/** GM: every Monocub's owners sent their copy again (a Bounty posted, claimed or lapsed). */
function tellEveryCub() {
    for (const actor of monocubActors()) tellCubOwners(actor.id);
}

/** GM: every Monocub's player told, on a veiled card, and the GMs. */
async function tellBounty(key, data) {
    const esc = foundry.utils.escapeHTML;
    const text = `<p>${esc(game.i18n.format(`DRPG.Monocub.${key}`, data))}</p>`;
    for (const actor of monocubActors()) await whisperToOwner(actor, text, { veiled: true });
    const { whisperToGms } = await import("./utils.mjs");
    await whisperToGms(text);
}

/** GM: a Bounty on `target`, owed from `userId`'s pool (the Despair Call). Answers the Bounty, or null when refused. */
export async function postBounty(userId, target) {
    if (!game.user?.isGM || !target) return null;
    /* One lock a student (the 1.2.110 review, E72 reader #6): the check, the debt and the write are one step, so two posts
       in step on one student leave one Bounty and owe its Despair once. A GM's locks are this browser's: two GMs posting
       on two browsers at once are not held by it. */
    return serialWrite(`drpg-bounty:${target.id}`, () => postBountyNow(userId, target));
}

async function postBountyNow(userId, target) {
    const call = DESPAIR_CALLS.bounty;
    const cost = Math.max(1, Math.trunc(Number(call?.cost) || 1));
    const reward = Math.max(1, Math.trunc(Number(call?.reward) || 1));
    const D = await import("./despair.mjs");
    const why = target.type !== "character" || isMonokuma(target) || isMonocub(target) || isDeadForGm(target) ? "a Bounty is put on a living student"
        : bountyStore.has(target.id) ? "that student has a Bounty already"
            : D.spendableDespair(userId) < cost ? "the pool has not the Despair for it" : null;
    if (why) {
        warn(`Refused a Bounty on ${target.name}: ${why}.`);
        if (why === "the pool has not the Despair for it") ui.notifications.warn(game.i18n.localize("DRPG.Monocub.bountyNoDespair"));
        return null;
    }
    if (!await D.oweDespair(userId, cost)) return null;
    const bounty = { by: userId, reward, at: serverNow(), targetName: target.name };
    await bountyStore.patch(target.id, bounty);
    tellEveryCub();
    await tellBounty("bountyPosted", { name: target.name, reward });
    log(`A Bounty of ${reward} Hope on ${target.name}, owed ${cost} Despair.`);
    return bounty;
}

/** GM: `cub`'s Confusion hindered `target` and landed (`scoreMeddle`): an open Bounty on it is claimed. Answers the Hope paid. */
export async function claimBounty(cub, target) {
    if (!game.user?.isGM || !cub || !target || !bountyStore.has(target.id)) return 0;
    const bounty = bountyStore.get(target.id);
    await bountyStore.drop(target.id);
    const paid = await addToPurse(cub, Math.max(0, Math.trunc(Number(bounty?.reward) || 0)));
    tellEveryCub();
    await tellBounty("bountyClaimed", { name: target.name });
    await whisperToOwner(cub, `<p>${foundry.utils.escapeHTML(game.i18n.format("DRPG.Monocub.bountyPaid", { name: target.name, n: paid }))}</p>`, { veiled: true });
    log(`${cub.name} (a Monocub) claimed the Bounty on ${target.name}: ${paid} Hope into its purse.`);
    return paid;
}

/** GM: every open Bounty lapses, unclaimed (each time of day, clock.mjs). Answers how many lapsed. */
export async function lapseBounties() {
    if (!game.user?.isGM) return 0;
    const ids = Object.keys(bountyStore.entries() ?? {});
    if (!ids.length) return 0;
    await bountyStore.dropMany(ids);
    tellEveryCub();
    log(`${ids.length} Bounty(-ies) lapsed unclaimed at the turn of the time of day.`);
    return ids.length;
}

/*
 * GHOST BET (E72 C18, 12.11.2026; the owner's DC12, DC31: "bet +3 from the body's announcement to the trial, +2 to the
 * vote's opening, +1 to its close; one bet, right conviction only", and the 06.11 amendment: +4 before the public
 * announcement, always open so the tile reveals nothing). A Monocub names a student; the bet is the GMs' (`cubStore`'s
 * `bet`, `{ targetId, value, at }`), its value the window it was placed in, and it is settled by the verdict's step
 * "bets" (verdict.mjs): a right verdict that sentences the student pays the value into the purse (`addToPurse`), anything
 * else pays nothing; either way the bet goes, and the card names nobody but the Monocub's own choice. Defaults, owner
 * may revise: free to place; one bet until the next verdict; the value fixed when placed.
 */

/** The Hope a bet placed now would pay: 4, 3, 2, 1, or 0 once the vote has closed. */
export function betWindowNow({ clock = getClock(), progress = getSetting(SETTINGS.trialProgress) ?? {}, announced } = {}) {
    if (clock?.phase === "classTrial") {
        const mine = progress?.chapter === clock.chapter;
        if (mine && progress.verdictApplied) return 0;
        const vote = mine ? progress.vote : null;
        if (vote?.open) return 1;
        if (vote?.closedAt) return 0;
        return 2;
    }
    const found = announced ?? Boolean(bodyFoundSinceTrial(clock));
    return found ? 3 : 4;
}

/** GM: a Ghost Bet placed on `target`, at the window's value (the row's resolver). */
async function placeBet(actor, target) {
    const value = betWindowNow();
    await patchCubRow(actor.id, { bet: { targetId: target.id, value, at: serverNow() } });
    await whisperToOwner(actor, `<p>${foundry.utils.escapeHTML(game.i18n.format("DRPG.Monocub.betStands", { name: target.name, n: value }))}</p>`, { veiled: true });
    log(`${actor.name} (a Monocub) placed a Ghost Bet for ${value} Hope.`);
    return { success: true };
}

/** GM: the verdict's step "bets" - every Ghost Bet settled and gone. Answers how many paid. */
export async function settleBets(context) {
    if (!game.user?.isGM) return 0;
    const record = context?.record ?? {};
    const sentenced = new Set(Array.isArray(record.executedIds) ? record.executedIds : []);
    let paid = 0;
    for (const [actorId, row] of Object.entries(cubStore.entries() ?? {})) {
        const bet = row?.bet;
        if (!bet) continue;
        const actor = game.actors.get(actorId);
        // No actor, or one that is a Monocub no more (revived since it bet): the bet goes unpaid (the 1.2.110 review's #5).
        if (!actor || !isMonocub(actor)) {
            await patchCubRow(actorId, { bet: null });
            continue;
        }
        const wins = Boolean(record.correct) && sentenced.has(bet.targetId);
        // The bet cleared in the patch that pays it, under the purse's lock (E72 fix round, review #6): cleared first, a
        // throw before the payment lost the bet with nothing paid, and the step run again found nothing to pay.
        const got = await purseWrite(actorId, () => addToPurseNow(actor, wins ? Math.max(0, Math.trunc(Number(bet.value) || 0)) : 0, { bet: null }));
        if (wins) paid += 1;
        await whisperToOwner(actor, `<p>${foundry.utils.escapeHTML(wins ? game.i18n.format("DRPG.Monocub.betPaid", { n: got })
            : game.i18n.localize("DRPG.Monocub.betLost"))}</p>`, { veiled: true });
    }
    if (paid) log(`${paid} Ghost Bet(s) paid at the verdict.`);
    return paid;
}

/**
 * THE MONOCUBS' LOG (E72 C5): every move the GM carried out, `{ at, key, choice, targetId }`, the newest last, kept in the
 * Monocub's row (`log`) for the GMs - no player's copy holds it. The last fifty are kept.
 */
async function logCubMove(actor, key, choice, target) {
    const held = Array.isArray(cubRowOf(actor)?.log) ? cubRowOf(actor).log : [];
    const entry = { at: serverNow(), ...gameDayNow(), timeOfDay: getClock()?.timeOfDay ?? null, key, choice: choice ?? null, targetId: target?.id ?? null };
    await cubStore.patch(actor.id, { log: [...held, entry].slice(-50) });
}

/** "Wastes an action" - unconditional, unlike `spendAction`, which can refuse. */
/** A critical Hinder's write. Answers whether an action was there to waste. */
async function wasteAction(actor) {
    const left = actionsLeft(actor);
    if (left <= 0) return false;
    await trustedWrite(actor, { [`system.resources.${ACTIONS_RESOURCE}.value`]: left - 1 }, { reason: "meddle" });
    return true;
}

/** A critical Help's refund. Answers whether the actions went up: at the maximum they do not. */
async function refundedAction(actor) {
    const before = actionsLeft(actor);
    await refundAction(actor, 1);
    return actionsLeft(actor) > before;
}

/* ==========================================================================
 * THE OLD MONOCUBS WINDOW, RETIRED (E72 C6, 12.11.2026; audit S18-61, DC17)
 * --------------------------------------------------------------------------
 * `openMonocubDialog` ticked a student into a Monocub with `setMonocub`, beside the Students window's Invite button and
 * State list: a third road around the invitation, with no word from the player. It is gone; `game.drpg.monocubDialog`
 * opens the Students window (gm-students.mjs `openWhoIsAliveDialog`), which holds the same rows - the Monocub's Hope,
 * a Monokuma's donation, the crime witness's box - and sends an invitation where the window ticked a flag.
 * ========================================================================== */
