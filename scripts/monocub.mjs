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
 * action panel on the sheet: Move and Meddle instead of the full grid, and
 * a Hope total that only a GM can top up, by converting their own Despair.
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

import { MODULE_ID, FLAGS, MONOCUB, ACTIONS_RESOURCE } from "./config.mjs";
import { resourceValue, resourceMax } from "./character.mjs";
import { isDeceased, isDeadForGm } from "./chapter.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { trustedWrite } from "./resource-guard.mjs";
import { actionsLeft, spendAction, refundAction } from "./actions.mjs";
import { getClock } from "./clock.mjs";
import { seasonEpoch, sameSeason, deathRecord, getSetting, SETTINGS } from "./settings.mjs";
import { resolveThreshold, whisperToOwner, log, warn, error, plural, isPrimaryGm, primaryGmId, wholeNumber, serialWrite, ownerOf, serverNow } from "./utils.mjs";
import { cubStore, cubCopy, cubTargetStore } from "./gm-stores.mjs";
import { gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { senderOf, replyForMe } from "./bridge-guards.mjs";
import { stepper, drpgWindow } from "./ui-kit.mjs";
import { alreadyOpen, keepLive, RAISED } from "./live.mjs";
// Confusion's window is a Call window (E51 C2): call-pickers.mjs reaches this file only through a lazy import().
import { callWindow, callHeader } from "./call-pickers.mjs";

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
    }
    await actor.setFlag(MODULE_ID, FLAGS.monocub, Boolean(value));

    /* THE BODY (E63 C0, 11.11.2026; the owner on E95 Q3: "Nie gdy zostaje Monocubem"): becoming a Monocub lays nothing.
       The death laid it (chapter.mjs `markDeceased`), and the Monocub walks away from it on the token; ticked, unticked
       or ticked again, the tile stays, and it goes at the trial's end, a revive or the reset. */
    // Unconditional on purpose: clearing the mark is also the repair for a
    // silence left behind by a cub who is no longer one (the GMs' row since E72 C2).
    if (!value && cubRowOf(actor)?.witness) await patchCubRow(actor.id, { witness: null });

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
        stamps[actor.id] = cubStore.newest(actor.id);
        const row = cubStore.get(actor.id);
        if (row) cubs[actor.id] = { witness: row.witness ?? null, redeemDay: row.redeemDay ?? null, askOpen: Boolean(row.askOpen) };
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
        const row = cubs?.[actorId];
        if (row && typeof row === "object") {
            const day = row.redeemDay && typeof row.redeemDay === "object" && Number.isInteger(row.redeemDay.day)
                ? { chapter: row.redeemDay.chapter ?? null, epoch: row.redeemDay.epoch ?? null, day: row.redeemDay.day } : null;
            mine[actorId] = { witness: witnessShape(row.witness), redeemDay: day, askOpen: row.askOpen === true };
        }
    }
    return cubCopy.receive(mine, own);
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
    // The chapter and its season (E11 fix r2-H2), as a death's record names them: `isCrimeSilenced`.
    await patchCubRow(actor.id, { witness: silenced ? { chapter: getClock().chapter, epoch: seasonEpoch() } : null });

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
        if (!actor || token.hidden || !isMonocub(actor) || lawfulRoomOf(token) !== place.room) continue;
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
    classTrial: { shut: async () => getClock().phase === "classTrial", say: "DRPG.Trial.callsLocked" }
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

/** Is `mark` (a row's `{ chapter, epoch, day }`) this game day? */
function isToday(mark, today = gameDayNow()) {
    return Boolean(mark) && mark.chapter === today.chapter && mark.epoch === today.epoch && mark.day === today.day;
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
        refuses: actor => (resourceValue(actor, "hope") >= resourceMax(actor, "hope") ? "the Monocub's Hope is full" : null),
        say: "DRPG.Monocub.hopeFull"
    },
    darkened: {
        refuses: async () => ((await import("./overflow.mjs")).overflowBlocksHope() ? "the darkened hour blocks Hope" : null),
        say: "DRPG.Monocub.darkened"
    },
    askOpen: {
        refuses: actor => (cubRowOf(actor)?.askOpen ? "an Ask for Hope is still open" : null),
        say: "DRPG.Monocub.askStillOpen"
    }
});

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
    }
});

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
    advantage: { both: "DRPG.Monocub.grantAdvantage", help: "DRPG.Monocub.helpAdvantage", hinder: "DRPG.Monocub.hinderAdvantage" }
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
    if (resourceValue(actor, "hope") < row.hopeCost) {
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
    if (await CUB_TARGETS[row.target].refuses(actor, game.actors.get(targetId))) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyHere"));
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
    if (actionsLeft(actor) < row.cost) return "the Monocub has no action left for it";
    if (resourceValue(actor, "hope") < row.hopeCost) return "the Monocub has not the Hope for it";
    return CUB_TARGETS[row.target].refuses(actor, target);
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
        const actor = game.actors.get(actorId);
        const row = abilityRow(key);
        const target = game.actors.get(targetId);
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
        // The student's share (E72 C4): told to the asker with its code, and nothing paid.
        const capped = cubCapRefusal(row, target);
        if (capped) {
            warn(`Refused a Monocub's "${key}" by ${actor.name}: ${target.name} has had its share this ${capped === "time" ? "time of day" : "day"}.`);
            return { capped };
        }
        // The price, after every condition: quiet (the toast and the pip sound would be the GM's), as an Objection's is.
        if (row.cost > 0 && !await spendAction(actor, row.cost, { quiet: true })) return null;
        await noteCubMove(row, target);
        if (row.hopeCost > 0) {
            await trustedWrite(actor, { "system.resources.hope.value": resourceValue(actor, "hope") - row.hopeCost }, { reason: "price" });
        }
        const { roll, total, isCritical } = await CUB_ROLLS[row.roll]();
        await CUB_RESOLVERS[row.resolve](actor, target, choice, total, isCritical, row);
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
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyHere"));
        return null;
    }

    const options = targets
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    /*
     * A CALL WINDOW (E51 C2, 30.10.2026; audit S17-48): `callWindow`, on the Hope side - the Monocub
     * pays Hope - under the header every Call window has: the ability's name, what it is for, its
     * price; then the tiers it is thrown against (`cubTiersHtml`, the owner's amendment of 14.10).
     * Not the GM's road: the GM throws the dice, but nobody decides anything before it lands.
     */
    /* ONE OF EACH ON THIS BROWSER (E44 C2c, 04.11.2026; D176). The ability's window carried no `once`, so a second
       press while one stood opened a second; now it raises the first and answers null, and nothing is thrown. */
    const result = await callWindow({
        kind: "hope", title: row.label, once: `drpg-cub-ability-${key}`,
        header: callHeader({ label: row.label, cost: row.hopeCost }, "hope", {
            effect: game.i18n.localize("DRPG.Monocub.meddleIntro"),
            price: plural("DRPG.Monocub.meddleCostShort", { hope: row.hopeCost, actions: row.cost }, "actions")
        }),
        body: `<form>
            <p class="notes">${game.i18n.localize("DRPG.Monocub.tiersIntro")}</p>
            ${cubTiersHtml(row)}
            <label>${game.i18n.localize("DRPG.Monocub.target")}
                <select name="target">${options}</select></label>
        </form>`,
        // One button per choice of the row, the first the primary and the default, the others secondaries (the kit's
        // slots, E21 C5a); their labels are `DRPG.Monocub.<choice>` (R1's LITERAL_KEYS names the two the table has).
        footer: (() => {
            const buttons = row.choices.map(choice => ({
                action: choice, label: game.i18n.localize(`DRPG.Monocub.${choice}`),
                callback: (e, b, d) => ({
                    targetId: d.element.querySelector("[name=target]").value, choice
                })
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
export const CUB_RESOLVERS = Object.freeze({ meddle: scoreMeddle, redeem: redeemHope, askHope: postHopeAsk });

/**
 * REDEEM (E72 C5; audit S18-60, the owner's DC22): +1 Hope from nothing, on the GM, after its blocks held (once a game
 * day, the Hope not full, no darkened hour) and its action was taken. The day is written in the Monocub's row
 * (`redeemDay`), its owner told on a veiled card.
 */
async function redeemHope(actor) {
    await trustedWrite(actor, { "system.resources.hope.value": Math.min(resourceMax(actor, "hope"), resourceValue(actor, "hope") + 1) },
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
    if (posted) await patchCubRow(actor.id, { askOpen: true });
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
    const amount = wholeNumber(n, { min: 0, fallback: 0 });
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
 * GM DIALOGS
 * ========================================================================== */

/** Opt students in or out, hand out Despair-as-Hope, and mark the crime silence. */
export async function openMonocubDialog() {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-monocubs")) return RAISED;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    const rosterOfDead = () =>
        game.actors.filter(a => a.type === "character" && !isMonokuma(a) && isDeceased(a));
    const dead = rosterOfDead();
    if (!dead.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Monocub.nobodyDead"));
        return null;
    }

    const { monokumas, donorLabel } = await import("./despair.mjs");
    const gms = monokumas();

    /*
     * A FUNCTION, NOT A STRING (E6).
     *
     * This table used to be built once and then thrown away and rebuilt by
     * closing and reopening the window after every donation - which took the
     * GM's scroll position and every checkbox they had ticked but not yet
     * applied with it. `keepLive` redraws the rows in place instead, so the
     * roster has to be re-read on each pass: a student who died while this was
     * open belongs in it.
     */
    const buildRows = () => rosterOfDead().map(a => {
        const cub = isMonocub(a);
        const hope = cub ? resourceValue(a, "hope") : null;
        const silenced = cub && isCrimeSilenced(a);
        // What each pool can spend, and what it owes (E05 C12; despair.mjs `donorLabel`).
        const donors = gms.map(u =>
            `<option value="${u.id}">${foundry.utils.escapeHTML(donorLabel(u))}</option>`
        ).join("");

        return `<tr>
            <td>${foundry.utils.escapeHTML(a.name)}</td>
            <td style="text-align:center">
                <input type="checkbox" name="cub:${a.id}" ${cub ? "checked" : ""}
                       aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Monocub.isOne")}: ${a.name}`)}" /></td>
            <td>${cub ? `${hope} / ${resourceMax(a, "hope")}` : "-"}</td>
            <td>${cub ? `
                <select name="donor:${a.id}">${donors}</select>
                ${stepper({ name: `amount:${a.id}`, value: 1, min: 1, attrs: { style: "width:3.5em" } })}
                <button type="button" class="drpg-mini-button" data-drpg-give="${a.id}">
                    ${game.i18n.localize("DRPG.Monocub.give")}</button>` : "-"}</td>
            <td style="text-align:center">${cub ? `
                <input type="checkbox" name="silenced:${a.id}" ${silenced ? "checked" : ""}
                       aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Monocub.silenced")}: ${a.name}`)}" />` : `
                <input type="checkbox" name="silenced:${a.id}" disabled data-drpg-tick-first
                       data-tooltip="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Monocub.tickFirst"))}"
                       aria-label="${foundry.utils.escapeHTML(`${game.i18n.localize("DRPG.Monocub.silenced")}: ${a.name} - ${game.i18n.localize("DRPG.Monocub.tickFirst")}`)}" />`}</td>
        </tr>`;
    }).join("");

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Monocub.manageTitle"),
        classes: ["drpg-panel", "drpg-window-monocubs"],
        // On the kit's frame, as wide as its widest table (ui-kit.mjs `fitKitWidth`; utils.mjs `tableDialog` until E21 C2a).
        fit: true,
        body: `<div>
            <p class="notes">${game.i18n.localize("DRPG.Monocub.dialogIntro")}</p>
            <table class="drpg-vault-table"><thead><tr>
                <th>${game.i18n.localize("DRPG.Monocub.student")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.isOne")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.hope")}</th>
                <th>${game.i18n.localize("DRPG.Monocub.giveHopeColumn")}</th>
                <th data-tooltip="${foundry.utils.escapeHTML(game.i18n.localize("DRPG.Monocub.silencedNote"))}">${
                    game.i18n.localize("DRPG.Monocub.silenced")}</th>
            </tr></thead><tbody class="drpg-cub-live">${buildRows()}</tbody></table>
        </div>`,
        footer: {
            primary: {
                action: "save", label: game.i18n.localize("DRPG.Panel.apply"),
                callback: (event, button, dialog) => rosterOfDead().map(actor => ({
                    id: actor.id,
                    cub: Boolean(dialog.element.querySelector(`[name="cub:${actor.id}"]`)?.checked),
                    silenced: Boolean(
                        dialog.element.querySelector(`[name="silenced:${actor.id}"]`)?.checked)
                }))
            },
            close: { role: "cancel", action: "cancel" }
        },
        // The per-row "give hope" buttons act immediately rather than waiting
        // for Apply: they spend a real Despair pool, and a GM who then cancels
        // the rest of the form should not find that donation undone with it.
        render: (event, dialog) => {
            /*
             * WIRED IN A FUNCTION, because `keepLive` replaces the tbody and
             * every listener on it goes with the nodes. A live table whose
             * buttons stopped working would be worse than a stale one.
             */
            /* SHORT HEADERS AND A LOCKED BOX (E15 C6, 25.10.2026; audit S13-10). The headers were
               sentences ("Who died?", "Turn a Monokuma's Despair into Hope") and the note under the
               table pointed at a box that was a "-" until the student was a Monocub. Now the Silenced
               box is drawn locked with "Tick Monocub first" on it, unlocked while the row's Monocub box
               is ticked (Apply makes the Monocub, then the silence), and the note is the column's tooltip. */
            const wireTickFirst = () => {
                for (const box of dialog.element.querySelectorAll("[data-drpg-tick-first]")) {
                    const id = box.name.slice("silenced:".length);
                    const cub = dialog.element.querySelector(`[name="cub:${CSS.escape(id)}"]`);
                    cub?.addEventListener("change", () => {
                        box.disabled = !cub.checked;
                        if (!cub.checked) box.checked = false;
                    });
                }
            };
            const wireGive = () => {
                for (const btn of dialog.element.querySelectorAll("[data-drpg-give]")) {
                    btn.addEventListener("click", async () => {
                        const id = btn.dataset.drpgGive;
                        const actor = game.actors.get(id);
                        const donorId = dialog.element.querySelector(`[name="donor:${id}"]`)?.value;
                        const amount = wholeNumber(dialog.element.querySelector(`[name="amount:${id}"]`)?.value, { min: 0, fallback: 0 });
                        if (!actor || !donorId || amount <= 0) return;

                        const { convertDespairToHope } = await import("./despair.mjs");
                        await convertDespairToHope(donorId, actor, amount);
                        // No close and reopen: the donation writes two actors,
                        // `watch.actors` catches it, and the row redraws with
                        // the new numbers under the GM's cursor (E6).
                    });
                }
            };
            wireGive();
            wireTickFirst();

            keepLive(dialog, {
                region: ".drpg-cub-live",
                build: buildRows,
                // A pool's debt changes with no actor's write (E05 C12): its store's hook.
                watch: { actors: true, hooks: ["drpgDespairOwedChanged"] },
                after: () => { wireGive(); wireTickFirst(); }
            });
        },
        rejectClose: false
    });

    if (!Array.isArray(result)) return null;

    for (const row of result) {
        const actor = game.actors.get(row.id);
        if (!actor) continue;
        if (row.cub !== isMonocub(actor)) await setMonocub(actor, row.cub);
        if (row.cub && row.silenced !== isCrimeSilenced(actor)) await setSilenced(actor, row.silenced);
    }

    return result;
}
