/**
 * Danganronpa RPG - how a chapter ends, and how a character stops.
 * ---------------------------------------------------------------------------
 * Guide, p. 29: "Typ Truth Bullets zostaje ujawniony na finał rozdziału. Na
 * początku następnej sesji wszystkie zostają usunięte z ekwipunku gracza
 * z wyjątkiem Faint Truth Bullets."
 *
 * Three moments, and none of them fire on their own:
 *
 *   the body is found   traces that were doubtful become permanent, everyone is
 *                       called to the scene, and the phase turns to Investigation
 *   the chapter ends    every Truth Bullet gives up what it really was
 *   the GM sweeps       the evidence is cleared out, Faint excepted
 *
 * All three are GM buttons rather than clock triggers, and deliberately so. Two
 * of them delete things that cannot be brought back, and the moment a chapter
 * "ends" is a judgement about the fiction - after the verdict, after the
 * execution, when the table is ready - not a number ticking over. A sweep that
 * fired by itself because somebody nudged the session counter would be the
 * worst bug this module could have.
 *
 * That is the one place this file departs from the page above it. The guide
 * puts the sweep at the start of the next session; here it is a button in the
 * Investigation Dashboard and the session counter does not touch it. The
 * reasoning, and the season run behind it, is written out over
 * `sweepTruthBullets` at the bottom of this file.
 *
 * Everything here runs on a GM client: the answer key lives there (see D6 and
 * truth-bullets.mjs), and only a GM may write to another player's sheet.
 */

import { MODULE_ID, FLAGS, REMNANT_TYPES, CHAPTERS_PER_SEASON } from "./config.mjs";
import { getClock } from "./clock.mjs";
import {
    bodyDiscovery, setBodyDiscovery, clearBodyDiscovery, isDeceased, isDeadForGm, deathRecord, deathRecordFor, pendingDeath,
    deadIn, seasonEpoch, bodiesFoundIn, recordBodyFound
} from "./settings.mjs";
import {
    TRUTH_BULLET_FLAGS, bulletsOf, isTruthBullet, secretOf, dropSecret, faintOf, bulletAsHeld, publishReading
} from "./truth-bullets.mjs";
import { remnantsOn, remnantData, setRemnantFlagsMany, publishTiesFor, handTiesOn, fightKey } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { announce, dialogContent, whisperToGms, gmIds, ownerOf, log, warn, error, plural, esc }
    from "./utils.mjs";
import { caseMark, deathStore, deferredOfferStore, lootTraceStore } from "./gm-stores.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * DEATH
 * ========================================================================== */

// The predicates live in settings.mjs (E05 C9), with the rules A-C that say which
// one a caller asks, and are re-exported here for api.mjs and every caller that
// already imports them from this file.
export { isDeceased, isDeadForGm, deathRecord, deathRecordFor, pendingDeath };

/** Every student still alive, as the table knows it (rule A). */
export function livingStudents() {
    return studentActors().filter(a => !isDeceased(a));
}

/** Every student still alive as this browser may know it - the GMs' lists (rule B). */
export function livingStudentsForGm() {
    return studentActors().filter(a => !isDeadForGm(a));
}

/**
 * Kill a character.
 *
 * What perishes is the Truth Bullets - carried and stashed alike - and the
 * answer-key entries go with them, so the ledger does not fill up with rows
 * nothing can ever reach again: here, or for a death the GMs keep, at its
 * publication (`publishDeath`). Everything else they owned stays on the sheet
 * to be found on the body; decision D1 used to take that too, and no longer
 * does (see the long note inside).
 *
 * Quiet on purpose. A murder is a secret until somebody finds the body - the
 * announcement belongs to `discoverBody`, not here. The card goes to the GMs
 * and, inside a running incident, to its participants' owners (WHO IS TOLD, below).
 * This comment said "only the GMs are told" after the card was widened (28.08) and
 * until the E05 comment sweep (C16, 27.09.2026). Since E05 C10 the running
 * incident's victim is not even the table's fact yet: no flag, no status, no
 * bullets deleted until the discovery or a GM's hand (TWO PHASES, below).
 *
 * The token stays where it is. A body is usually the thing the cast will be
 * standing around looking at; what changes is that the rules stop counting them
 * as a person in the room - on the GMs' side and for those who know from the
 * kill, for everybody else from the publication (`isDeadForGm`, `isDeceased`,
 * movement.mjs `countsAsPresent`).
 *
 * @param {Actor} actor
 * @param {object} [options]
 * @param {boolean} [options.keepBullets]  Leave the Truth Bullets alone. For a
 *   death that is not a killing-game murder - a retcon, a test - where taking
 *   somebody's conclusions away would just be destructive. The belongings stay
 *   either way.
 */
/**
 * Mark somebody dead and say nothing (F16, 20.09).
 *
 * The counterpart to `reviveCharacter`, and the reason it exists: the Players
 * window's dropdown is a REPAIR tool - its own header says it "moves the two
 * flags and nothing else" - and it was calling `killCharacter`, which is the
 * whole death procedure. A GM straightening out a row that had got out of step
 * whispered "A student is dead" to the GMs and to the owners of everyone in a
 * running incident, stamped the death chapter, tied this chapter's traces off and
 * offered Stage 6. None of that is a repair.
 *
 * What is left here is the record and the token marker, which IS the state both
 * halves have to write. `killCharacter` keeps its order and calls this in the
 * middle of it, so there is one place that knows what "deceased" means.
 *
 * Returns the record it wrote, or null if the flag would not take - which is what
 * `killCharacter` reads to decide whether the rest of the procedure should run.
 */
export async function markDeceased(actor, { record: when = null } = {}) {
    if (!game.user.isGM || !actor) return null;

    // A death published after the kill carries the kill's chapter, day and time of day
    // (`publishDeath`), not the moment somebody found the body. And its phase and season
    // (E11 C1, 1.2.73): a death in the Class Trial is an execution, which no walk past the
    // body discovers, and a chapter 1 is only this season's when its epoch says so
    // (`bodiesToDiscover`).
    const clock = getClock();
    const record = when ?? { chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay, phase: clock.phase, epoch: seasonEpoch() };

    try {
        await actor.setFlag(MODULE_ID, FLAGS.deceased, record);
    } catch (err) {
        error(`Could not mark ${actor.name} as deceased`, err);
        return null;
    }

    // Foundry's own dead marker, so the token reads as a body on any client
    // without this module having to draw anything. Wrapped: it is a convenience,
    // not the record - `FLAGS.deceased` is what the rules read.
    try {
        await actor.toggleStatusEffect("dead", { active: true, overlay: true });
    } catch (err) {
        log(`Could not apply the "dead" status to ${actor.name}; the flag is set regardless.`);
    }

    return record;
}

export async function killCharacter(actor, { keepBullets = false, secret = null } = {}) {
    if (!game.user.isGM || !actor) return null;
    if (isDeadForGm(actor)) {
        ui.notifications.warn(game.i18n.format("DRPG.Chapter.alreadyDead", { name: actor.name }));
        return null;
    }

    /*
     * TWO PHASES (E05 C10, 26.09.2026; audit S06-11). A killing in an incident was
     * published at the kill: the flag, the "dead" status and the Truth Bullets' deletion
     * reached every console at once, so a bystander's browser knew who had died and when
     * long before anybody walked in on the body. The running incident's victim is kept by
     * the GMs now - a row of the `deaths` store and a copy for those who may know - and the
     * table learns of it when the body is found or a GM says so (`publishDeath`; the
     * owner's Q3, 26.09.2026: no trial and no chapter's end makes it public on its own).
     * Any other death - an execution, a ruling, the GM's dialog with the box unticked - is
     * the table's at once, as before.
     */
    let secretly = secret ?? await isIncidentVictim(actor);

    /*
     * WHAT DIES WITH THEM, AND WHAT DOES NOT (Dawid, 27.08).
     *
     * This used to take the whole inventory - decision D1's "it all vanishes" -
     * which made a body a thing to look at and nothing to search. The belongings
     * stay now: they are on the sheet, other students can take them, and taking
     * one is evidence (see `lootBody`).
     *
     * TRUTH BULLETS STILL PERISH, and that half is unchanged - at the publication
     * for a death kept secret, since an item deleted from a sheet is a death told to
     * every console. What somebody worked out is not an object in their pocket; it
     * died with them, and a murder that handed the killer their victim's conclusions
     * would be a murder that pays.
     */
    let removed = 0;
    let record;
    if (secretly) {
        record = await recordSecretDeath(actor, { keepBullets });
        if (!record) {
            warn(`${actor.name}'s death could not be kept by the GMs, so it is the table's at once.`);
            secretly = false;
        }
    }
    if (!secretly) {
        if (!keepBullets) removed = await destroyBullets(actor);
        // The record and the token marker, which the Players window's repair
        // dropdown writes on its own (F16) - one place decides what deceased means.
        record = await markDeceased(actor);
    }
    if (!record) return null;

    /*
     * A REINFORCED LEVEL UP WAITING FOR THE CLASS LAPSES AT THE KILL (E05 C11, 27.09.2026;
     * the design's 2.3 step 5, the owner's Q7). At the kill and not at the publication: the
     * row is the GMs' alone, so dropping it tells nobody anything. A verdict's batch drops
     * a dead student's row too (level-up.mjs `advancementPlan` keeps the living), but left
     * to it the row would outlive the death until the next verdict, in the store and in
     * every backup taken meanwhile.
     */
    if (deferredOfferStore.has(actor.id)) {
        try {
            await deferredOfferStore.drop(actor.id);
        } catch (err) {
            error(`Could not drop ${actor.name}'s deferred Level Up at the death`, err);
        }
    }

    /*
     * WHO IS TOLD A STUDENT DIED (Dawid, 28.08 - widen it).
     *
     * The card used to reach the GMs alone. It now also reaches the owners of
     * everyone inside a running incident, which is the audience the sound is
     * for and therefore the audience the card has to have. Nobody learns anything
     * they did not already know - they were in the room.
     *
     * Outside an incident there are no participants and this is exactly what
     * it always was, a whisper to the GMs.
     *
     * "Inside" is `incidentAudienceIds` (incident-store.mjs) at the stage the kill leaves,
     * the one table every card of the incident reads (E06 C4, 27.09.2026; audit
     * S04-01). It was every participant's owner, and a trap's builder is a
     * participant who is in no room: a death while the trap runs told them it had
     * worked. The engine's own kill sites run once the stage has moved to Stage 6,
     * where the builder is let back in; a GM's kill in the middle of the fight is
     * told to the room. `announceTimeOfDay` in clock.mjs reads the same function.
     *
     * A SECRET DEATH'S SOUND IS ADDRESSED (E05 C10). On the card it is a flag of the
     * message, which every console receives whoever the card is whispered to - a death
     * sound at that moment would say that somebody died. It goes to the same audience by
     * `playSfxForUsers` instead, and the card carries none.
     */
    const deathAudience = await (async () => {
        try {
            const { murderState, incidentAudienceIds } = await import("./murder.mjs");
            const state = murderState();
            if (!state) return null;
            return Array.from(new Set([...gmIds(), ...incidentAudienceIds(state)]));
        } catch (err) {
            // A death that cannot work out its audience is still a death the
            // GMs must be told about.
            error("Could not widen the death card to the incident", err);
            return null;
        }
    })();

    await whisperToGms(`
        <h3>${game.i18n.localize("DRPG.Chapter.deathTitle")}</h3>
        <p>${game.i18n.format("DRPG.Chapter.died", {
            name: foundry.utils.escapeHTML(actor.name),
            chapter: record.chapter
        })}</p>
        ${secretly
            ? `<p>${game.i18n.localize("DRPG.Chapter.keptUntilFound")}</p>`
            : keepBullets ? "" : `<p>${plural("DRPG.Chapter.bulletsGone", { n: removed })}</p>`}
        <p><small>${game.i18n.localize("DRPG.Chapter.vaultPending")}</small></p>`, {
        whisper: deathAudience ?? gmIds(),
        // The audience of a death card mid-incident is the incident's cast.
        veiled: true,
        ...(secretly ? {} : { flags: { [MODULE_ID]: { sfx: { key: "death", gm: true } } } })
    });
    if (secretly) {
        await import("./sfx.mjs").then(m => m.playSfxForUsers(deathAudience ?? gmIds(), "death"))
            .catch(err => error("Could not play the death's sound to the incident", err));
    }

    log(secretly
        ? `${actor.name} is dead (chapter ${record.chapter}), kept by the GMs until the body is found.`
        : `${actor.name} is dead (chapter ${record.chapter}); ${removed} Truth Bullet(s) destroyed.`);

    await incidentVictimDied(actor, record.chapter);

    return record;
}

/**
 * WHAT THE RUNNING INCIDENT'S VICTIM'S DEATH DOES TO IT (E32+E07 C13, 03.10.2026; audit S10-77,
 * the owner's D13): the chapter's traces tied to the crime, and Stage 6 offered. Both were
 * `killCharacter`'s tail and nobody else's, so a victim the GM marked dead from the Students
 * list in the middle of the fight (gm-panel.mjs `applyAliveStates`) left the incident at stage
 * "incident" around a body - no clean-up for the killer, and the chapter's traces left for the
 * Faint sweep. D13: that death offers Stage 6 too. The list stays the quiet repair otherwise
 * (F16): no card, no inventory, nothing for a death outside an incident. GM-side.
 */
export async function incidentVictimDied(actor, chapter) {
    if (!game.user.isGM || !actor) return;

    // The VICTIM of the running incident died - and only then (Dawid, 26.08):
    // the chapter's traces are the case now, so they arrive in the
    // Investigation Dashboard as "Tied" where nobody had said otherwise. Gated
    // on the incident's victim so an execution after the trial, the
    // mastermind's end or a GM's story ruling ties nothing. Checked BEFORE
    // `offerStageSix` below, which can close the incident and take the answer
    // with it.
    //
    // THE VICTIM, NOT THE VICTIM'S SIDE, AND THE LEDGER ONLY (E09 C4, 08.10.2026; audit
    // S05-37). The gate was `sideOf(actor) === "victim"`, and a student who takes their
    // own life holds both seats, where `sideOf` answers "killer": a suicide tied nothing
    // (tier 2 "a suicide ties the chapter's traces"). And the tie went on to every copy
    // already identified, which climbed to the top of its holder's pack at the death -
    // before anybody had found the body (tier 2 "a death reaches the copies' tie only at
    // the body's discovery", scenario 10's two "the death's tie" checks).
    //
    // WHEN THIS DEATH IS THE TABLE'S, WITH THE FIGHT'S (E09 fix r1-G1, 08.10.2026; the
    // round-1 reviews' cor F3, sec F8). C4 left the sending to the body's discovery, for
    // the whole chapter: a death made known any other way - the Students list, a kill made
    // public at once - never reached the copies, and a discovery sent a second death's
    // kept ties with its own. A death the GMs keep ties with its victim's id and takes
    // over what the fight held back (a weapon's tie, remnants.mjs `tieWaitNow`), and its
    // publication sends both (`publishDeath`); a death already public sends them now
    // (tier 2 "a death the GMs make known from the Students list sends its ties to the
    // copies", "a death made known at once sends its ties and the fight's to the copies").
    try {
        if (await isIncidentVictim(actor)) {
            const { tieChapterTraces } = await import("./remnants.mjs");
            const { murderState } = await import("./murder.mjs");
            const fight = fightKey(murderState());
            if (isDeceased(actor)) {
                await tieChapterTraces(chapter);
                await publishTiesFor(fight);
            } else {
                await tieChapterTraces(chapter, { waitFor: actor.id });
                await handTiesOn(fight, actor.id);
            }
        }
    } catch (err) {
        error("Could not mark the chapter's traces as tied to the murder", err);
    }

    // A death that ends an incident should end the incident.
    try {
        await offerStageSix(actor);
    } catch (err) {
        error("Could not offer the clean-up stage after the death", err);
    }
}

/** Whether this actor is the running incident's victim: a death kept secret by default (E05 C10). */
async function isIncidentVictim(actor) {
    try {
        const { murderState } = await import("./murder.mjs");
        const state = murderState();
        return Boolean(state?.active) && state.victimId === actor.id;
    } catch (err) {
        error("Could not tell whether a death is the running incident's", err);
        return false;
    }
}

/*
 * A STUDENT'S TRUTH BULLETS AS THE GMS HOLD THEM, FOR A DEATH AND A SWEEP (E29 fix r2-H22, 06.10.2026; fix r2-H21's
 * seam (c)). `destroyBullets` and `sweepTruthBullets` chose by the category on the document (truth-bullets.mjs
 * `bulletsOf`), where a player's write the audit puts back stands until its put-back lands, or for good where it fails:
 * a bullet whose category a write took off was passed over, and was a bullet again once put back. They choose off the
 * items as the GMs hold them now (sheet-audit.mjs `itemsAsHeld`) and delete the documents; an item a player's write
 * made that no GM has decided on is no bullet as they hold it (read without its category, sheet-audit.mjs
 * `ITEM_UNHELD`) and stays for a GM to decide, by reading. The wait holds up nothing that holds it up, by reading: a
 * judgement waits only for its own player's consumption of an item and roll card (sheet-audit.mjs `consumedBy`,
 * `callsCover`), which neither road writes, and neither runs inside a judgement (a kill, a publication, the chapter's
 * end, the dashboard's button). Measured with tier 2's "a death and a sweep take the Truth Bullets the GMs hold, ..."
 * (e29run/r2h22red, 06.10.2026): until this fix a bullet whose category a write took off where the mark does not see it
 * was left on the sheet by both; with either reading the documents again (e29run/r2h22m, m3, m4) it is left again.
 * The reveal takes its set from the documents (`allBullets`, each player's own bullets) and decides each one on the
 * bullet as the GMs hold it (`revealPlan`, E09 C8); the two counts a GM is shown before a sweep read what the sweep
 * reads (`sweepPlan`, E09 C1).
 */
async function bulletsHeldBy(actor) {
    const { itemsAsHeld } = await import("./sheet-audit.mjs");
    return (await itemsAsHeld(actor)).filter(isTruthBullet).map(item => actor.items.get(item.id)).filter(Boolean);
}

/*
 * AND A BULLET A PLAYER'S WRITE TOOK OFF, WHICH A GM'S UNDO WOULD MAKE AGAIN (E29 fix r2-H22, 06.10.2026). A player's
 * deletion of a bullet the GMs hold is not put back by the audit: it is flagged, the mark lets the bullet go, and the
 * row keeps the GMs' copy (sheet-audit.mjs `itemFindings`), which the card's Undo makes again under its id
 * (`decideNow`) - after a death or a sweep that took the rest, a bullet of theirs back on the sheet with its answer
 * key. So both keep such a deletion, as a GM's Keep does (`askToDecideWrite`: decided once, on the primary GM), and
 * forget its answer key with the rest; a sweep leaves the ones it leaves on a sheet (`spares`: Faint, Final), whose
 * Undo stays the GMs'. Measured with the same test: until this fix each deletion stood undecided after both, its answer
 * key kept, and the Undo made the bullet again; with either road leaving its deletions (m5, m6) they stand so again,
 * and with the sweep keeping a Faint one's deletion too (m7) that one's Undo makes nothing (a Final one's is spared by
 * the same rule, read, not measured). The Undo is the one road that makes a deleted item again; a put-back pending on a
 * bullet either road deletes makes nothing again - it writes to the item still on the sheet, and to nothing once it is
 * gone (sheet-audit.mjs `itemFindings`), by reading. Answers how many it kept.
 */
async function keepBulletDeletions(actor, spares = () => false) {
    const { deletedHeldBy, askToDecideWrite } = await import("./sheet-audit.mjs");
    let kept = 0;
    for (const { rowId, item } of deletedHeldBy(actor)) {
        if (!isTruthBullet(item) || spares(item) || !(await askToDecideWrite(rowId, true))) continue;
        await dropSecret(item.uuid);
        kept++;
    }
    return kept;
}

/** Every Truth Bullet of theirs deleted, its answer-key entry first; answers how many went. */
async function destroyBullets(actor) {
    // As the GMs hold them (`bulletsHeldBy`); the ledger entries first, while the items still exist to be read.
    const bullets = await bulletsHeldBy(actor);
    for (const bullet of bullets) await dropSecret(bullet.uuid);
    await keepBulletDeletions(actor);
    const doomed = bullets.map(i => i.id).filter(id => actor.items.has(id));
    if (!doomed.length) return 0;
    try {
        await actor.deleteEmbeddedDocuments("Item", doomed);
        return doomed.length;
    } catch (err) {
        error(`Could not clear ${actor.name}'s inventory on death`, err);
        return 0;
    }
}

/**
 * Phase one of a death kept secret (E05 C10): the GMs' row and the copies of those who may
 * know, and nothing written on the actor. `known` is the players of the incident's seats as
 * they are now - every kill site runs after the stage has moved, so a trap's killer is back
 * in (incident-store.mjs `incidentKnowers`); the victim's own player knows by ownership. Answers the
 * record, or null when the row did not take - and the caller then publishes the death as
 * before, since a death lost is worse than one told early.
 */
async function recordSecretDeath(actor, { keepBullets = false } = {}) {
    const clock = getClock();
    const record = { chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay, phase: clock.phase, epoch: seasonEpoch() };
    let known = [];
    try {
        const { incidentKnowers } = await import("./murder.mjs");
        known = incidentKnowers(actor);
    } catch (err) {
        error("Could not work out who was in the incident of a death kept secret", err);
    }
    try {
        await deathStore.patch(actor.id, { ...record, at: Date.now(), keepBullets: Boolean(keepBullets), known });
    } catch (err) {
        error(`Could not record ${actor.name}'s death for the GMs`, err);
        return null;
    }
    /* WHAT WAS STORED, NOT WHAT IS HELD (E05 fix r2-G3, 27.09.2026; review S2-m8). This read
       `has`, and the engine keeps a write it could not save in memory (a full origin: its
       notice asks for a backup), so the check passed whenever the save failed and the death
       lived in this tab alone - a reload without the backup lost it, no flag and no row. The
       patch has awaited its save, so the row is read back from storage (`persisted`), as the
       lifts read theirs; measured in tier 2 with the store's save swallowed. The row held in
       memory is dropped with it, here and on the GMs its write reached, or the death would be
       both the table's and a row nobody has found. */
    if (!deathStore.persisted(actor.id)) {
        if (deathStore.has(actor.id)) await deathStore.drop(actor.id);
        return null;
    }
    await tellDeathKnowers(actor, known);
    return record;
}

/** Every player who may know of this body - its row's `known` and its owners - sent their deaths; `dropped` names it gone. */
async function tellDeathKnowers(actor, known = [], { dropped = false } = {}) {
    try {
        const { tellDeaths } = await import("./murder.mjs");
        const owners = (game.users ?? []).filter(u => !u.isGM && actor.testUserPermission?.(u, "OWNER")).map(u => u.id);
        tellDeaths([...(Array.isArray(known) ? known : []), ...owners], dropped ? [actor.id] : []);
    } catch (err) {
        error("Could not tell the players who know of a death", err);
    }
}

/**
 * PHASE TWO: THE TABLE LEARNS OF IT (E05 C10; audit S06-11). The Truth Bullets go unless
 * the kill kept them, the flag is written with the kill's own record (its chapter, day and
 * time of day, not the finding's) and the "dead" status with it, the row is dropped - its
 * tombstone is what a copy weighs its loss against - and whoever held a copy is told.
 * Idempotent: its head reads the GMs' row (`deathStore`), so a death already public answers
 * its record and a body nobody killed null. Run by the body's discovery (`runDiscovery`, through
 * `publishFoundBodies`), by a GM's hand - the Players window's "dead" (gm-panel.mjs
 * `applyAliveStates`) and the console's `game.drpg.publishDeath` (api.mjs) - and by a verdict
 * that executes a student whose death the GMs hold (vote.mjs `executeSentenced`, E10 fix r1-G4:
 * the GM named them in the verdict's window, which told that GM whose death it is). Nothing
 * else: no trial and no chapter's end publishes a death on its own (the owner's Q3, 26.09.2026;
 * callers read with `git grep` on 10.10.2026, E10 fix r2-G3). Last, each loot of the body before this
 * is given its Truth Bullet, which names the body and so waited in the row (handover.mjs
 * `payOwedLoot`; E05 fix r2-F0b), and each identified copy of the body's loot trace found
 * before this the source it held back (truth-bullets.mjs `publishLootSource`; E05 fix r2-G4);
 * and the ties to the crime that waited for this death (remnants.mjs `publishTiesFor`; E09 fix
 * r1-G1), whichever road made it known - the discovery, or a GM's hand here.
 */
export async function publishDeath(actor, { phase = null } = {}) {
    if (!game.user.isGM || !actor) return null;
    const row = deathStore.get(actor.id);
    if (!row) return isDeceased(actor) ? deathRecord(actor) : null;
    const removed = row.keepBullets ? 0 : await destroyBullets(actor);
    /* THE KILL'S RECORD, AND THE EXECUTION'S PHASE (E11 C1, 1.2.73). A verdict that executes a
       death the GMs held passes `phase: "classTrial"` (vote.mjs `executeSentenced`): the record
       keeps the kill's chapter, day and time, and says the death is the execution, so after End
       the trial two students walking past it do not discover it (`bodiesToDiscover`). Reading this
       chapter's verdict instead was weighed and refused: a second trial blanks the record (D17). */
    const record = await markDeceased(actor, {
        record: { chapter: row.chapter ?? getClock().chapter, day: row.day ?? null, timeOfDay: row.timeOfDay ?? null,
            phase: phase ?? row.phase ?? null, epoch: row.epoch ?? null }
    });
    if (!record) return null;
    // Read again after the awaits above: a loot served meanwhile joined the row (handover.mjs `oweLootBullet`).
    const { owedLoot, payOwedLoot } = await import("./handover.mjs");
    const owed = owedLoot(deathStore.get(actor.id) ?? row);
    await deathStore.drop(actor.id);
    await tellDeathKnowers(actor, row.known, { dropped: true });
    const paid = owed.length ? await payOwedLoot(actor, owed) : 0;
    const { publishLootSource } = await import("./truth-bullets.mjs");
    await publishLootSource(lootTraceStore.get(actor.id));
    // And the ties to the crime that waited for this death, the fight's among them, to the
    // copies (remnants.mjs `publishTiesFor`; E09 fix r1-G1).
    await publishTiesFor(actor.id);
    log(`${actor.name}'s death is the table's now (chapter ${record.chapter}); ${removed} Truth Bullet(s) destroyed, ${paid} owed for a loot given.`);
    return record;
}

/**
 * THE DEATHS NOBODY HAS FOUND, AT THE TRIAL'S START (E05 C10; the owner's Q3, 26.09.2026).
 * The design published them here; the owner's answer is that only the discovery and a GM's
 * hand do, and that until then such a death is counted nowhere - so the GM who opened the
 * trial is told how many there are, on their screen and in no document, and the Players
 * window is where one is made known. Answers how many.
 * What "nowhere" means at the trial (E05 fix r2-G1, 27.09.2026; review F1, S2-m6): the
 * student is living to the table (rule A) - a ballot, a Level Up with the class - and the
 * trial asks for no killer of theirs (incident-store.mjs `trialBlackenedIds`). The notice said
 * "no ballot, no count" while the victim's player was sent a ballot and the killer was
 * counted (review F1): the ballot stays, the count goes, and the notice says so.
 */
export function tellUnfoundDeaths() {
    if (!game.user?.isGM) return 0;
    const n = Object.keys(deathStore.entries()).filter(id => game.actors?.has(id)).length;
    if (n) ui.notifications.warn(plural("DRPG.Chapter.deathsStillSecret", { n }), { permanent: true });
    return n;
}

/**
 * The victim of a running incident just died - offer Stage 6.
 *
 * The murder engine only reaches Stage 6 through a Finishing Blow, and a GM
 * who kills the victim any other way (this screen, a ruling, a Despair Call)
 * left the incident frozen at stage "incident" around a corpse: `isCleaner`
 * false, no clean-up screen for the killer, and the whole Stage 6 branch
 * unreachable. Measured before this existed - the stage stayed "incident" and
 * `attemptStageSix` refused with "you are not the one cleaning up this scene",
 * which was not the reason.
 *
 * Asked rather than done: the GM may be killing somebody mid-incident for a
 * reason that is not the incident ending - Monokuma's punishment, a Call, a
 * mistake being corrected.
 */
async function offerStageSix(victim) {
    const { murderState, beginResolution } = await import("./murder.mjs");
    const state = murderState();
    if (!state?.active || state.stage !== "incident") return;
    if (state.victimId !== victim.id) return;

    const killer = game.actors.get(state.killerId);

    const sure = await DialogV2.confirm({
        classes: ["drpg-panel"],
        window: { title: game.i18n.localize("DRPG.Chapter.stageSixTitle") },
        content: dialogContent(`<div>
            <p>${game.i18n.format("DRPG.Chapter.stageSixIntro", {
                victim: foundry.utils.escapeHTML(victim.name),
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>
            <p>${game.i18n.format("DRPG.Chapter.stageSixWhat", {
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>
        </div>`),
        yes: { label: game.i18n.localize("DRPG.Chapter.stageSixYes") },
        no: { label: game.i18n.localize("DRPG.Chapter.stageSixNo") },
        rejectClose: false
    });

    if (sure) await beginResolution("victimKilled");
}

/**
 * Undo the marking. The inventory does NOT come back - those documents are
 * gone - so this is for a mis-click, not for a resurrection.
 */
export async function reviveCharacter(actor, { quiet = false } = {}) {
    if (!game.user.isGM || !actor) return false;

    // A death nobody has found is a row of the GMs' store and nothing on the actor (E05
    // C10): dropped, and its copies told, with no write to the actor - an unset flag on
    // a living student would tell every console that something about a death moved.
    const row = deathStore.get(actor.id);
    if (row) {
        await deathStore.drop(actor.id);
        await tellDeathKnowers(actor, row.known, { dropped: true });
        // The ties that waited for this death (E09 fix r1-G1): back to the fight still running
        // over this student, sent otherwise - nothing will make the death known now.
        try {
            const { murderState } = await import("./murder.mjs");
            const state = murderState();
            if (state?.active && state.victimId === actor.id) await handTiesOn(actor.id, fightKey(state));
            else await publishTiesFor(actor.id);
        } catch (err) {
            error(`Could not settle the ties that waited for ${actor.name}'s death`, err);
        }
    }
    if (!row || isDeceased(actor)) {
        try {
            await actor.unsetFlag(MODULE_ID, FLAGS.deceased);
            await actor.toggleStatusEffect("dead", { active: false });
        } catch (err) {
            error(`Could not un-mark ${actor.name}`, err);
            return false;
        }
    }

    // `quiet`: the season reset revives every corpse in a row and deletes every
    // Truth Bullet anyway, so a toast per body said nothing (CORE-18).
    if (!quiet) ui.notifications.info(game.i18n.format("DRPG.Chapter.revived", { name: actor.name }));
    return true;
}

/** Mark somebody dead, from the GM panel. */
export async function openDeathDialog({ actor = null } = {}) {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return false;
    }

    const alive = livingStudentsForGm();
    if (!actor && !alive.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Chapter.nobodyLeft"));
        return false;
    }

    // The picker is skipped when the caller already knows who.
    //
    // "Who is alive" in the GM panel is a table with one row per character and
    // a Kill button on each of them, so by the time this opens the question the
    // select asks has been answered by pressing a button next to a name.
    // Everything else about the procedure - the warning, the choice about the
    // inventory, `killCharacter` itself - has to stay exactly the same, which
    // is why that button opens this rather than reimplementing it.
    // Kept by the GMs until the body is found (E05 C10): ticked for the running incident's
    // victim, the kill's own default - named here, or first in the picker when it is there.
    const { murderState } = await import("./murder.mjs");
    const state = murderState();
    const victimId = state?.active ? state.victimId ?? null : null;
    const secretByDefault = actor ? actor.id === victimId : alive.some(a => a.id === victimId);
    const listed = victimId ? [...alive.filter(a => a.id === victimId), ...alive.filter(a => a.id !== victimId)] : alive;
    const picker = actor
        ? `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong></p>`
        : `<label>${game.i18n.localize("DRPG.Chapter.whoDied")}
                <select name="actor">${listed
                    .map(a => `<option value="${a.id}">${
                        foundry.utils.escapeHTML(a.name)}</option>`).join("")}</select></label>`;

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.deathTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            ${picker}
            <label class="drpg-checkbox">
                <input type="checkbox" name="keepBullets" />
                ${game.i18n.localize("DRPG.Chapter.keepBullets")}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="secret"${secretByDefault ? " checked" : ""} />
                ${game.i18n.localize("DRPG.Chapter.keepSecretUntilFound")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.deathNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.confirmDeath"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { id: actor?.id ?? f.actor.value, keepBullets: f.keepBullets.checked, secret: f.secret.checked };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const dying = game.actors.get(result.id);
    if (!dying) return false;
    return Boolean(await killCharacter(dying, { keepBullets: result.keepBullets, secret: Boolean(result.secret) }));
}

/* ==========================================================================
 * THE BODY IS FOUND
 * ========================================================================== */

/**
 * The Faint Prep traces a discovery in `chapter` asks about: Faint, Prep, not tied to the crime
 * already, and left in this chapter (E11 C4, 1.2.73; audit S06-44: the list offered the Faint
 * Prep of every earlier chapter as well). A trace with no chapter - placed by hand, or from before
 * traces carried one - is taken as this chapter's, as every trace was before. A trace carries no
 * season: the reset's Remnants group (season-setup.mjs `wipeSeason`) removes them when ticked, and
 * a season stamp on chapter-stamped records is E11 C12's.
 */
export function faintPrepCandidates(chapter = getClock().chapter) {
    const candidates = [];
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const data = remnantData(token);
            if (!data?.faint) continue;
            if (data.type !== "prep") continue;
            if (data.tiedToCrime) continue;
            if ((data.chapter ?? chapter) !== chapter) continue;
            candidates.push({ token, data, scene });
        }
    }
    return candidates;
}

/**
 * Faint Prep traces that belong to this murder stop being doubtful.
 *
 * Which ones those are is a judgement only the GM can make - a Prep Remnant is
 * left by anyone gathering tools, and most of them mean nothing. So this offers
 * the list and the GM ticks. Ticking sets `tiedToCrime` as well as clearing
 * `faint`, which is what actually exempts a trace from the chapter-end sweep.
 *
 * NOT ONE ALREADY TIED TO THE CRIME (E05 C14, 27.09.2026; audit S05-06). A Faint
 * Prep trace a GM had tied by hand, or that delivered the weapon (remnants.mjs
 * `tieTraceForItem`), was offered at every discovery as though it were still a
 * question - and it survives the sweep already. Exported for the suite, which
 * answers the window itself.
 *
 * ASKED AFTER THE ANNOUNCEMENT, HEADED BY ITS ROOM (E11 C4, 1.2.73; audit S06-44). The
 * discovery awaited this before its card and its gather, so two students walking in on a body
 * gave the GM a window about Prep traces with no word of a body, and the table waited on the
 * answer. `runDiscovery` asks it last now, not awaited, under "Body found in {room}", and only
 * about this chapter's traces (`faintPrepCandidates`).
 */
export async function promoteFaintPrep({ room = null, chapter = getClock().chapter } = {}) {
    const candidates = faintPrepCandidates(chapter);
    if (!candidates.length) return 0;

    const rows = candidates.map((c, i) => `
        <label class="drpg-checkbox">
            <input type="checkbox" name="promote" value="${i}" />
            ${foundry.utils.escapeHTML(
                `${c.data.visibilityLabel} ${REMNANT_TYPES[c.data.type]?.label ?? c.data.type}`
                + `${c.data.room ? ` · ${c.data.room}` : ""}`
                + `${c.data.sourceName ? ` · ${c.data.sourceName}` : ""}`
                + `${c.data.subject ? ` · ${c.data.subject}` : ""}`
            )}</label>`).join("");

    const picked = await DialogV2.wait({
        window: { title: room ? game.i18n.format("DRPG.Chapter.promoteTitle", { room }) : game.i18n.localize("DRPG.Chapter.bodyBanner") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize("DRPG.Chapter.promoteIntro")}</p>
            <fieldset>${rows}</fieldset>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.promoteNote")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.promoteConfirm"), default: true,
                callback: (e, b, d) => Array.from(
                    d.element.querySelectorAll("[name=promote]:checked")).map(i => Number(i.value))
            },
            { action: "skip", label: game.i18n.localize("DRPG.Chapter.promoteSkip") }
        ],
        rejectClose: false
    });

    if (!Array.isArray(picked) || !picked.length) return 0;

    /* INTO THE LEDGER (E04, 1.2.63; the owner's Q2, S06-02's writer half). The ticks
       were written onto the token as `faint: false` and `tiedToCrime: true`, flags
       every player's client receives and nothing read: the ledger row - what the
       dashboard, Observe and the chapter-end sweep read - kept `faint: true`. They
       are the dashboard's own write now, one store write for every trace ticked, and
       they reach the copied bullets as a hand-ticked box does. */
    const tokens = picked.map(index => candidates[index]?.token).filter(Boolean);
    let promoted = 0;
    try {
        promoted = await setRemnantFlagsMany(tokens, { faint: false, tiedToCrime: true });
    } catch (err) {
        error("Could not promote the Faint Prep Remnants", err);
    }

    log(`Promoted ${promoted} Faint Prep Remnant(s) to permanent evidence.`);
    return promoted;
}

/*
 * ONE DISCOVERY AT A TIME, IN ORDER (17.09).
 *
 * A teleport moves every token at once, so an assembly or a discovery fires one
 * `updateToken` per student within the same moment. The guard used to be a flag set just
 * before `discoverBody` - after three awaited imports - so every one of those checks got
 * past it before the first had set it, and each announced the same body and gathered the
 * cast again. Measured on 16.09: five "A BODY HAS BEEN DISCOVERED" cards from one assembly.
 *
 * Queued rather than dropped: a check that arrives while another runs may be the one that
 * completes the count of two witnesses, so it waits its turn, and by then the first has
 * written the discovery record that makes it a no-op if it was not.
 *
 * The GM's own announcement goes through the same queue (BODY-1). It used to call the
 * discovery directly, so its gather set off automatic checks that ran before its record
 * was written and announced the body a second time.
 */
let bodyWorkQueue = Promise.resolve(null);

function enqueueBodyWork(work) {
    const next = bodyWorkQueue.catch(() => null).then(work);
    bodyWorkQueue = next;
    return next;
}

/**
 * The body discovery announcement: call everyone to the scene, hold the game there
 * until the GM answers, then ask which Prep traces belong to the murder.
 *
 * @param {object} options
 * @param {string} options.room     Where the body is.
 * @param {Actor} [options.victim]  Named in the announcement when given.
 * @param {Scene} [options.scene]   The scene the room is on; this client's own when not given.
 */
export function discoverBody(options = {}) {
    if (!game.user.isGM || !options?.room) return Promise.resolve(null);
    return enqueueBodyWork(() => runDiscovery(options));
}

async function runDiscovery({ room, victim = null, scene = null, by = "gm" } = {}) {
    if (!game.user.isGM || !room) return null;
    // The chapter and season the discovery happens in, read before anything is awaited: the
    // stamp is filed under these, whatever the clock reads by the time it is written (E11 C1).
    const clock = getClock(), epoch = seasonEpoch();

    /* THE BODY'S SCENE, NOT THE ONE IN VIEW (E05 fix r2-G3, 27.09.2026; review F6). The
       watcher runs on the primary GM, whatever scene that GM is looking at, and this read the
       one in view: the bodies to publish and the gather both went to a same-named room there
       (or nowhere), and a second body in the real room stayed unpublished with the discovery
       marked done - measured on the harness (10-murder): with the GM looking at another scene,
       two witnesses walked in on two kept bodies and the one the watcher did not name stayed
       a death nobody had found. `checkBodyFound` passes the scene the walk happened on and the
       GM's form the one it chose its room from. */
    const where = scene ?? canvas?.scene ?? game.scenes?.active ?? null;

    // The Eclipse is a placement window nobody has finished crossing yet - see
    // the note on `maybeBodyFound`. Two things refuse before this now:
    // `openBodyDiscoveryDialog` asks before it opens its form, and the case
    // dashboard greys the footer button that reaches it (F12 - it used to be a GM
    // panel tile, and the greying stayed behind with the tile). This is the
    // backstop for anyone who gets here anyway, `game.drpg` console access
    // included.
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.bodyLocked"));
        return null;
    }

    /* THE TABLE LEARNS OF THE DEATH HERE (E05 C10; audit S06-11): the named victim and every
       body kept by the GMs lying in this room are published before anything else - before the
       gather moves the cast in, before the card names them - so every screen reads them dead
       by the time it is told a body was found. */
    const { found, victims } = await publishFoundBodies(room, victim, where, { clock, epoch });

    /* AND THE DISCOVERY IS STAMPED, ONCE, UNDER ITS CHAPTER AND SEASON (E11 C1, 1.2.73; audit
       S06-03, decision D8). The hold below is cleared at the next phase change, and it was the
       only memory of the discovery: after End the trial a walk into the room announced a body
       found before the trial again (65-season B4: a second card at 4aad1fd). The stamp outlives the
       hold; the watcher passes over a body it names (`bodiesToDiscover`). Written as soon as the
       deaths are the table's, before the gather and the card, so a failure in either leaves the
       bodies known as found. */
    await announceBody({ chapter: clock.chapter, epoch, at: Date.now(), room, sceneId: where?.id ?? null,
        victimIds: victims, by, day: clock.day ?? 1, timeOfDay: clock.timeOfDay });

    /* AND OF WHAT EACH OF THOSE DEATHS TIED, AND NOTHING ELSE (E09 fix r1-G1, 08.10.2026; the
       round-1 reviews' sec F8). C4 sent every tie of the chapter here, so a discovery sent the
       ties a second death, still kept, had made (tier 2 "a body's discovery sends only the ties
       its own death made"). Each body published above sends its own (`publishDeath`). */

    // Stage 7 takes the gloves. The guide puts the cleaning tool's destruction
    // here rather than at the end of Stage 6 - see CLEANUP.destroysToolsOnDiscovery.
    // The gloves of the bodies found, and no others (fix r2-G3: `destroyCleaningTools`).
    await import("./cleanup.mjs")
        .then(m => m.destroyCleaningTools(found))
        .catch(err => error("Could not destroy the cleaning tools at body discovery", err));

    const { gatherEveryone } = await import("./call-effects.mjs");
    const moved = await gatherEveryone(room, where);

    // The moment the chapter changes genre, on every screen at once. The card
    // is already public, so the flag needs nothing else from anybody.
    await announce({
        flags: { [MODULE_ID]: { sfx: { key: "bodyFound", gm: true } } },
        content: `<div class="drpg-evidence-card">
            <div class="drpg-objection-banner">${
                game.i18n.localize("DRPG.Chapter.bodyBanner")}</div>
            <p>${victim
                ? game.i18n.format("DRPG.Chapter.bodyFoundNamed", {
                    name: foundry.utils.escapeHTML(victim.name),
                    room: foundry.utils.escapeHTML(room)
                })
                : game.i18n.format("DRPG.Chapter.bodyFound", {
                    room: foundry.utils.escapeHTML(room)
                })}</p>
            <p>${game.i18n.localize("DRPG.Chapter.bodyCalled")}</p>
        </div>`
    });

    /*
     * THE DISCOVERY IS NOT THE INVESTIGATION (D5).
     *
     * This used to move the phase, which meant finding a body ended Daily
     * Life on the spot. It is a held state now: the card stands, the music
     * stops, and the phase waits for the GM to start the Investigation.
     * Written on every route, including one that reaches here with the phase
     * already at `investigation` - the card has nothing else to read, since
     * `endMurder` wipes `murderState` before the GM presses anything.
     */
    await setBodyDiscovery({ room, victimId: victim?.id ?? null });

    ui.notifications.info(game.i18n.format("DRPG.Chapter.bodyDone", { room }));
    log(`Body discovered in ${room}: ${moved} token(s) gathered.`);

    /* ANNOUNCE FIRST, ASK AFTER (E11 C4, 1.2.73; audit S06-44). The Prep question was awaited
       before the card and the gather: the GM was asked about traces with no word of a body while
       the table waited on the answer, and the toast that followed counted tokens and "traces made
       permanent" (confirmed at a table). The question is asked last, headed by the room, and not
       awaited, so the queue above lets the next discovery through while it is open; questions
       wait for each other (`promotionQueue`), so a second one lists only what the first left
       Faint (read in the code; no test drives two at once). Its own toast comes only when a trace was ticked. Tier 2 "the discovery card comes
       before the Prep question"; 65-season B1c on the witnesses' road. */
    const promotion = askPromotion({ room, chapter: clock.chapter });
    return { moved, promotion };
}

let promotionQueue = Promise.resolve(0);

/** The discovery's Prep question, after any still open; answers how many traces were ticked. */
function askPromotion(where) {
    promotionQueue = promotionQueue.catch(() => 0).then(() => promoteFaintPrep(where)).then(promoted => {
        if (promoted > 0) ui.notifications.info(plural("DRPG.Chapter.promoted", { n: promoted }));
        return promoted;
    }).catch(err => {
        error("Could not ask which Prep traces belong to the murder", err);
        return 0;
    });
    return promotionQueue;
}

/**
 * The named victim, and every body kept by the GMs standing in `room` on `scene`, published
 * (`publishDeath`). Answers `found`, every body the discovery found - the named victim and every
 * body dead for the GMs in the room, a death the table already knew included - whose killers'
 * cleaning tools it breaks (E32+E07 fix r2-G3; cleanup.mjs `destroyCleaningTools`), and
 * `victims`, the ones this discovery announces: the named victim and the room's bodies still to
 * discover (`bodiesToDiscover`), which the stamp names (E11 C1).
 */
async function publishFoundBodies(room, victim, scene, { clock = getClock(), epoch = seasonEpoch() } = {}) {
    const ids = new Set(victim && deathStore.has(victim.id) ? [victim.id] : []);
    const found = new Set(victim ? [victim.id] : []);
    const victims = new Set(victim ? [victim.id] : []);
    try {
        const { roomOfToken } = await import("./movement.mjs");
        const { flagsHeldNow } = await import("./sheet-audit.mjs");
        /* AS THE GMS HOLD THEM, IN ONE STEP (E11 C1; plan 1b.2, H3). Every death below is read
           off the primary's mark (`flagsHeldNow`), with nothing awaited between two reads, and
           before any of them is published: a player's own `deceased` write the audit has not put
           back yet makes nobody a body. */
        const students = new Set(studentActors().map(a => a.id));
        const here = [...(scene?.tokens ?? [])].filter(t => t.actor?.id && roomOfToken(t) === room);
        const fresh = new Set(bodiesToDiscover({ actors: here.map(t => t.actor).filter(a => students.has(a.id)), clock, epoch,
            announced: announcedIn(clock.chapter, epoch), held: flagsHeldNow }));
        for (const t of here) {
            const id = t.actor.id;
            if (deathStore.has(id)) ids.add(id);
            if (deathStore.has(id) || isDeadForGm(flagsHeldNow(t.actor))) found.add(id);
            if (fresh.has(id)) victims.add(id);
        }
    } catch (err) {
        error("Could not read which bodies lie in the room of the discovery", err);
    }
    for (const id of ids) {
        const body = game.actors.get(id);
        if (body) await publishDeath(body);
    }
    return { found: [...found], victims: [...victims] };
}

/**
 * THE ONE WRITER OF THE DISCOVERY'S STAMP (E11 C1, 1.2.73; decision D8): `row` is
 * `{ chapter, epoch, at, room, sceneId, victimIds, by, day, timeOfDay }`, filed under its own
 * chapter and season (settings.mjs `recordBodyFound`; tier 0 R349 holds that nothing else calls
 * it). Who walked in is not in it - the GMs' log has it (`checkBodyFound`). E19's channel, E13's
 * trial room and E70 read the stamp through `bodiesFoundIn`, `bodyAnnounced` and
 * `chapterBodyFound`; E67's hook goes here. Answers the stamp, or null when it could not be
 * written - logged, and the discovery goes on: its deaths are already the table's.
 */
export async function announceBody(row) {
    if (!game.user.isGM || !row) return null;
    try {
        const stamp = await recordBodyFound(row);
        if (stamp) log(`The discovery in ${row.room} is stamped for chapter ${row.chapter}: ${stamp.victimIds.length} bod(ies), by ${row.by}.`);
        return stamp;
    } catch (err) {
        error("Could not stamp the body's discovery", err);
        return null;
    }
}

/** The ids of the bodies this chapter's discoveries announced, in the season `epoch` (a test on an id; the GM panel's next line reads it too). */
export function announcedIn(chapter, epoch) {
    const ids = new Set(bodiesFoundIn(chapter, epoch).flatMap(row => row?.victimIds ?? []));
    return id => ids.has(id);
}

/*
 * THE BODIES TO DISCOVER (E11 C1, 1.2.73; audit S06-03, amend 26.09; tier 0 R347). Of `actors`
 * (students), the ids of those a walk-in would discover: dead for the GMs, not a Monocub, died in
 * this chapter (a record with no chapter is taken as this chapter's, as before) of this season (a
 * record with no `epoch` is taken as this season's), not in the Class Trial - an execution is the
 * trial's own ending, public at once, and no body to find - and not announced by a discovery of
 * this chapter (`announced`, a test on an id). A record from before 1.2.73 says no phase, so it
 * cannot tell an execution from a murder: it counts only while the GMs still hold it, which an
 * execution never is. Measured at 4aad1fd: after End the trial a walk-in discovered Daichi,
 * found before the trial, again (65-season B4), and a verdict executing a death the GMs held
 * left a body the next walk found (tier 2 "a body the verdict executed is not found again").
 * Pure but for its readers: `held` hands each actor's flags as the GMs hold them (the caller's
 * `flagsHeldNow`, read in one step) and `pending` an id's death the GMs hold (`pendingDeath`);
 * tier 0 hands it fakes. "Announced" is this chapter's stamps, not the season's (`bodyAnnounced`):
 * the record has to be this chapter's anyway, and a student revived and killed again in a later
 * chapter is a body again there.
 */
export function bodiesToDiscover({ actors = [], clock = getClock(), epoch = seasonEpoch(), announced = () => false,
    held = actor => actor, pending = id => pendingDeath({ id }) } = {}) {
    return [...new Set([...actors].filter(actor => {
        if (!actor?.id || announced(actor.id)) return false;
        const view = held(actor);
        if (!view || !deadIn(view, pending) || view.getFlag(MODULE_ID, FLAGS.monocub)) return false;
        const row = pending(actor.id);
        const record = view.getFlag(MODULE_ID, FLAGS.deceased) || row;
        if ((record?.chapter ?? clock.chapter) !== clock.chapter) return false;
        if ((record?.epoch ?? epoch) !== epoch) return false;
        if (!record?.phase) return Boolean(row);
        return record.phase !== "classTrial";
    }).map(actor => actor.id))];
}

/*
 * THE WITNESSES OF A WALK-IN (E11 C1, 1.2.73; audit S06-14, S13-02; DC7/DX1; tier 0 R348). The
 * tokens of `tokens` standing in `room` that count toward the two: a student's character
 * (`students`, which leaves a Monokuma out), not hidden, not one of the `bodies`, and alive for
 * the GMs - the dead are not witnesses, only a Monocub is. Until 1.2.73 a dead student's token
 * standing in the room counted, so one living student walking in on a body beside an earlier
 * victim's was "two witnesses". `held` and `pending` as `bodiesToDiscover` reads them; `roomOf` is
 * movement.mjs `roomOfToken`.
 */
export function witnessesOf({ tokens = [], room = null, bodies = new Set(), students = new Set(), held = actor => actor,
    pending = id => pendingDeath({ id }), roomOf = () => null } = {}) {
    return [...tokens].filter(t => {
        const actor = t.actor;
        if (!actor || actor.type !== "character") return false;
        if (t.hidden) return false;
        if (bodies.has(actor.id)) return false;
        if (!students.has(actor.id)) return false;            // excludes Monokumas
        const view = held(actor);
        if (deadIn(view, pending) && !view.getFlag(MODULE_ID, FLAGS.monocub)) return false;
        return roomOf(t) === room;
    });
}

/**
 * Two or more people walk in on a corpse, at least one of them with nothing to
 * do with the death. That is the discovery.
 *
 * The guide's trigger is people finding the body, not a GM remembering to press
 * a button - and the button was the only thing that could fire Stage 7, so an
 * investigation began when somebody noticed the screen rather than when the
 * cast noticed the body. Watched on token movement, the same way a third party
 * walking into a running incident is watched.
 *
 * The killer standing alone over their own victim has not discovered anything -
 * that is the classic frame-up, and the guide leaves it to the table. But a
 * killer or an accomplice (`blackenedIds` carries both across the end of the
 * incident, which is why this can run after the state is gone) DOES count
 * toward the two once somebody unconnected to the incident is standing there
 * too: walking back to your own crime scene alongside a witness is still being
 * found there. A Monokuma is not a witness either - see `maybeThirdParty`,
 * same rule - and nor is a hidden token, a second body or, since E11 C1, the
 * dead who are not Monocubs (`witnessesOf`).
 *
 * Two is the count, and at least one of the two has to be unconnected to the
 * incident - a room full of nothing but killers and accomplices is not a
 * discovery.
 */
// Queued with the GM's own announcement - see `enqueueBodyWork`.
export function maybeBodyFound(tokenDoc) {
    if (!game.user.isGM) return Promise.resolve(null);
    return enqueueBodyWork(() => checkBodyFound(tokenDoc));
}

async function checkBodyFound(tokenDoc) {
    if (!game.user.isGM) return null;
    /* EVERYTHING THIS DECIDES BY IS READ IN ONE STEP (E11 C1, 1.2.73; plan 1b.2, H3 and H17). The
       modules are fetched first; from the phase below to the witnesses nothing is awaited, so no
       write is judged between two reads, and the deaths and Monocubs are read off the primary's
       mark (`flagsHeldNow`) without waiting for the audit - a walk waits on nothing a judgement
       waits on. */
    const { isEclipse } = await import("./eclipse.mjs");
    const { roomOfToken } = await import("./movement.mjs");
    const { blackenedIds, killerIds, murderState } = await import("./murder.mjs");
    const { flagsHeldNow } = await import("./sheet-audit.mjs");

    // Already in Stage 7, or a body found and waiting on the GM. Both are
    // "this has already been discovered"; the second is the whole of D5.
    // And the Class Trial (E11 C1; audit S06-03): the bodies were found before it began.
    const clock = getClock();
    if (["investigation", "classTrial"].includes(clock.phase) || bodyDiscovery()) return null;

    // The Eclipse is everyone crossing the map with their eyes shut - the guide
    // gives that window to placement, not to the cast stumbling over a body
    // while half of them have not finished moving yet. Without this, two
    // students placing through the same room mid-Eclipse would "discover" a
    // body in the middle of a window nobody has confirmed.
    if (isEclipse()) return null;

    // Everything here compares actor IDs, never actor objects.
    //
    // An unlinked token does not carry the world actor - Foundry hands it a
    // synthetic copy with the token's own overrides applied - so `includes(actor)`
    // is false for every unlinked token on the scene, however plainly the person
    // is standing there. Measured: a student in the room with the body was not
    // counted as a witness for exactly this reason.
    const cast = studentActors();
    const students = new Set(cast.map(a => a.id));
    // A BODY IS THIS CHAPTER'S DEAD, AND NOT A MONOCUB (17.09, BODY-2, BODY-3). A Monocub keeps
    // the deceased flag and walks the board, so standing beside two students announced their
    // own corpse; and a body from an earlier chapter, found and tried long ago, set off a
    // second discovery the first time two people passed it. Since E11 C1 also not an execution,
    // not one this chapter's discoveries already announced, and not last season's
    // (`bodiesToDiscover`).
    const epoch = seasonEpoch();
    const bodies = new Set(bodiesToDiscover({ actors: cast, clock, epoch, announced: announcedIn(clock.chapter, epoch), held: flagsHeldNow }));
    if (!bodies.size) return null;

    const room = roomOfToken(tokenDoc);
    if (!room) return null;

    // The body has to be in the room somebody just walked into.
    const scene = tokenDoc.parent;
    const bodyHere = scene?.tokens?.find(t =>
        t.actor && bodies.has(t.actor.id) && !t.hidden && roomOfToken(t) === room);
    if (!bodyHere) return null;

    /* AND THE KILLERS STILL CLEANING UP (22.09). The Blackened register is written when the
       murder is closed, so during the clean-up it was empty: a killer and a partner in crime
       standing by the body were two "witnesses", and the body was discovered in the middle of
       their own Stage 6. The running incident's killers count as involved too. */
    const involved = new Set([...blackenedIds(), ...killerIds(murderState())]);

    // And the dead are not witnesses, only a Monocub is (E11 C1; `witnessesOf`).
    const witnesses = witnessesOf({ tokens: scene.tokens, room, bodies, students, held: flagsHeldNow, roomOf: roomOfToken });

    /* ONE, ALONE, AND NOT IN IT (E05 C10; the owner's Q1, 26.09.2026). A student who walks in
       on a body nobody has found with nobody else there sees it - told privately by the GMs,
       their copy naming it, the dead marker drawn on their screen alone - and nothing is
       announced: the rule of two witnesses stays.
       NOT IN THAT DEATH, WHATEVER ELSE THEY DID (E05 fix r2-G1, 27.09.2026; review F10). This
       branch was closed to `involved` - every Blackened of the chapter, all of its incidents -
       so a killer of the chapter's first incident who walked alone onto the second's body was
       told nothing (measured on the harness: the row's `known` did not gain their player).
       Who already knows of that death is `tellLoneFinder`'s to pass over (the
       row's `known`, the body's owners); `involved` stays the rule of two witnesses'. */
    if (witnesses.length === 1) {
        await tellLoneFinder(witnesses[0].actor, scene, room);
        return null;
    }

    // Two in the room, and at least one of them did not do this. A killer is
    // part of the pool, never the whole of it.
    if (witnesses.length < 2) return null;
    if (!witnesses.some(w => !involved.has(w.actor.id))) return null;

    log(`Body found in ${room}: ${witnesses.map(t => t.actor.name).join(", ")} walked in.`);
    // Already inside the queue: straight to the work, not back through `discoverBody`,
    // which would wait behind this very call.
    return await runDiscovery({ room, victim: bodyHere.actor, scene, by: "witnesses" });
}

/**
 * THE LONE FINDER (E05 C10; the owner's Q1, 26.09.2026). The finder's player is added to the
 * `known` of every body nobody has found lying in `room`, sent their copy, and told by an
 * addressed packet - no chat message, which every console would receive. Once per body: a
 * player who already knows is told nothing again. Answers how many bodies they learnt of.
 */
async function tellLoneFinder(finder, scene, room) {
    const user = ownerOf(finder);
    if (!user || user.isGM) return 0;
    const { roomOfToken } = await import("./movement.mjs");
    const { knowsOfDeath, tellDeaths, tellFinder } = await import("./murder.mjs");
    const found = [];
    for (const t of scene?.tokens ?? []) {
        const id = t.actor?.id;
        const row = id ? deathStore.get(id) : null;
        if (!row || t.hidden || roomOfToken(t) !== room || knowsOfDeath(user, id, row)) continue;
        await deathStore.patch(id, { known: [...(Array.isArray(row.known) ? row.known : []), user.id] });
        found.push(t);
    }
    if (!found.length) return 0;
    tellDeaths([user.id]);
    for (const t of found) tellFinder(user.id, t, room);
    log(`${finder.name} found ${found.map(t => t.name).join(", ")} alone in ${room}; their player was told privately.`);
    return found.length;
}

/** The body-discovery announcement, from the case dashboard's footer. */
export async function openBodyDiscoveryDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /*
     * REFUSED BEFORE THE FORM, NOT AFTER IT (F12).
     *
     * `runDiscovery` has always refused an Eclipse and is still the backstop for
     * anything that reaches the work directly - but it refuses AFTER the GM has
     * chosen a room and a victim and pressed Announce, so the answer arrived as a
     * warning over work that was then thrown away. Asked here, the window never
     * opens, on every route at once: the case dashboard's footer, the
     * post-incident window's first button, and the console.
     *
     * SECOND IN THE ORDER, deliberately. Who may press this comes before when it
     * may be pressed, and both come before what the map happens to have: a GM told
     * "this scene has no room regions" mid-Eclipse would go and draw some for a
     * window that was going to refuse anyway.
     */
    const { isEclipse } = await import("./eclipse.mjs");
    if (isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.bodyLocked"));
        return null;
    }

    const { allRooms } = await import("./movement.mjs");
    const rooms = allRooms();
    if (!rooms.length) {
        ui.notifications.warn(game.i18n.localize("DRPG.Chapter.noRooms"));
        return null;
    }

    // The dead are the candidates here - the victim is normally already marked
    // by the time anybody trips over them.
    const dead = studentActors().filter(isDeadForGm);
    const victims = dead
        .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`).join("");
    /* THE NOTE SAYS WHAT THIS PRESS DOES NOW (E11 C4, 1.2.73; audit S13-27). One note said "the
       phase stays Daily Life ... until you start the Investigation" in every phase - from the
       Investigation's own footer too - and promised the doubtful Prep traces, which a world with
       none never showed. The hold's sentence is Daily Life's; elsewhere the phase is left as it is
       (`runDiscovery` writes no phase). The traces' sentence only when this chapter has some. */
    const notes = [game.i18n.localize(getClock().phase === "dailyLife" ? "DRPG.Chapter.bodyNote" : "DRPG.Chapter.bodyNoteLater")];
    if (faintPrepCandidates().length) notes.push(game.i18n.localize("DRPG.Chapter.bodyNoteTraces"));

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.bodyTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <label>${game.i18n.localize("DRPG.Chapter.whereBody")}
                <select name="room">${rooms
                    .map(r => `<option value="${foundry.utils.escapeHTML(r)}">${
                        foundry.utils.escapeHTML(r)}</option>`).join("")}</select></label>
            <label>${game.i18n.localize("DRPG.Chapter.whoseBody")}
                <select name="victim">
                    <option value="">${game.i18n.localize("DRPG.Chapter.unnamedVictim")}</option>
                    ${victims}
                </select></label>
            <p class="notes">${notes.join(" ")}</p>
        </form>`),
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.announce"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return { room: f.room.value, victimId: f.victim.value };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    return discoverBody({
        room: result.room,
        victim: result.victimId ? game.actors.get(result.victimId) : null,
        scene: canvas?.scene ?? null
    });
}

/* ==========================================================================
 * CHAPTER END AND THE NEXT SESSION
 * ========================================================================== */

/** Every Truth Bullet in the world, with the actor holding it; `actors`: only theirs. */
function allBullets(actors = null) {
    const out = [];
    for (const actor of actors ?? game.actors) {
        if (actor.type !== "character") continue;
        for (const item of bulletsOf(actor)) out.push({ actor, item });
    }
    return out;
}

/*
 * WHAT THE CHAPTER'S REVEAL WOULD WRITE, AND THE NUMBER THE END OF CHAPTER PANEL SHOWS FOR IT (E09 C8, S05-18; the
 * owner's Q1, answer (c), 08.10.2026, since E09 fix r1-G5). Until C8 the reveal wrote the kind, `analyzed` and Faint on
 * every bullet not already showing its kind as analysed, and the sweep after it keeps Faint and Final
 * (`sparedBySweep`): so a Faint bullet the chapter carried over came out analysed, and `isAnalysable` refuses an
 * analysed bullet - the guide's second life of a Faint trace ("można je przeanalizować ponownie") never came; a Final
 * carried over the same way was spent; and a Key or a Final revealed showed its kind without its reading, which only
 * Analyze wrote. Measured with tier 2's "a Faint the sweep keeps stays analysable", "the chapter's reveal leaves a
 * Final unread and analysable" (C8's name for the test fix r1-G5 rewrote) and "a revealed Key carries its reading" on
 * the code before C8 (scratchpad/c8run/red.log, 08.10.2026): the Faint and the Final analysed and not analysable, the
 * Key's reading "". Now the reveal leaves a Faint as it is, to be analysed in the next chapter; shows a Final its kind
 * and not its reading (`kindOnly`), so it too stays to be analysed; and gives every other bullet the whole of what an
 * Analyze gives (truth-bullets.mjs `publishReading`). C8 spared a Final like a Faint (Q1 (a), the default taken while
 * the question was open); the owner answered (c). A Final is born showing its kind unless the GM handed it over as
 * Neutral (gm-items.mjs), so that withheld Final is the one this shows: tier 2 "the chapter's reveal shows a Final's
 * type without its reading and leaves it analysable", red on C8's code (08.10.2026) with the withheld Final still
 * Neutral. Each decision reads the bullet as the GMs hold it (`bulletAsHeld`; `sparedBySweep` reads Faint so), every
 * one in this one synchronous pass before the first write. The set is every character's bullets on this browser
 * (`allBullets`), by design: a bullet whose answer key names no kind is passed over, so an item a player made, which
 * has no answer key, is never revealed (read in the code). Answers `reveal` (the item, its answer key and the held
 * copy, for `publishReading`) and `typeless`, the bullets still unanalysed whose answer key names no kind, which the
 * panel warns of.
 */
export function revealPlan({ actors = null } = {}) {
    if (!game.user.isGM) return { reveal: [], typeless: 0 };
    const reveal = [];
    let typeless = 0;
    for (const { item } of allBullets(actors)) {
        const held = bulletAsHeld(item), secret = secretOf(item.uuid);
        if (!secret.realType) {
            if (!held.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed)) typeless++;
            continue;
        }
        if (secret.realType === "final") {
            if (held.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType) !== "final") reveal.push({ item, secret, held, kindOnly: true });
            continue;
        }
        if (sparedBySweep(item)) continue;
        if (held.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.shownType) === secret.realType
            && held.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed)) continue;
        reveal.push({ item, secret, held });
    }
    return { reveal, typeless };
}

/**
 * The chapter is over: every Truth Bullet the sweep would take gives up what it really was (`revealPlan`).
 *
 * Reads the answer key and writes it onto the items, so the reveal survives on the players' sheets rather than being a
 * message they have to remember. `actors`: the students to reveal, every one where unsaid - the suite's, which must not
 * reveal a table's world. Answers how many it wrote.
 */
export async function revealAllBulletTypes({ actors = null } = {}) {
    if (!game.user.isGM) return 0;

    let revealed = 0;
    for (const { item, secret, held, kindOnly = false } of revealPlan({ actors }).reveal) {
        try {
            await publishReading(item, secret, { held, kindOnly });
            revealed++;
        } catch (err) {
            error(`Could not reveal the type of "${item.name}"`, err);
        }
    }

    log(`Revealed the real type of ${revealed} Truth Bullet(s).`);
    return revealed;
}

/**
 * Whether the sweep leaves this bullet: a Faint one, or a Final Truth (the two reasons are on `sweepTruthBullets`
 * below). Faint as the GMs hold it - the answer key's, and where a row holds none (a bullet made before 1.2.47 that
 * the migration has not moved) this browser's copy of the GMs' flag (`bulletAsHeld`), not the document's, which a
 * player's write waiting for its put-back can hold. GM-side: both halves are a GM's to read.
 */
export function sparedBySweep(item) {
    return faintOf(bulletAsHeld(item)) || secretOf(item.uuid).realType === "final";
}

/*
 * WHAT A SWEEP WOULD TAKE, AND WHAT IT WOULD LEAVE (E09 C1, S05-21). Three places chose the bullets a sweep takes, each
 * its own way: the sweep (the bullets the GMs hold, `bulletsHeldBy`, kept by `faintOf`), the Investigation Dashboard's
 * confirm (investigation.mjs `confirmSweepBullets`: the documents, kept by the Faint flag on the item - false on every
 * Faint bullet nobody has analysed, which is where Faint is published) and the chapter-end panel (the documents, kept by
 * `faintOf`). So for a student holding an unanalysed Faint, a Neutral and a Final the confirm said 2 and the sweep took
 * 1. All three read this now: the bullets as the GMs hold them, one wait per student, and then every decision in one
 * synchronous pass (`sparedBySweep`), so nothing a write lands between two decisions changes one of them and not the
 * other. Answers the items, `remove` and `keep`; the sweep deletes `remove`, and both counts are `remove.length`. The
 * wait is `itemsAsHeld`'s (sheet-audit.mjs): a judgement of a write queued on a student first, which a GM's click and a
 * chapter's end start and nothing it waits for does. Measured with tier 2's "the confirm count is the sweep's count"
 * and "a forged faint flag in the window spares nothing" before this change (e09run/scratch/c1/mt, 08.10.2026): the
 * confirm counted 2 of the three above and the sweep took 1; and of three Neutral bullets a player's write had left a
 * Faint flag or a lost category on, the confirm counted none, the panel 1, and the sweep took 2, sparing the one whose
 * answer key holds no Faint (`faintOf` read the document's flag there).
 */
export async function sweepPlan({ actors = null } = {}) {
    if (!game.user.isGM) return { remove: [], keep: [] };
    const held = [];
    for (const actor of actors ?? game.actors) {
        if (actor.type !== "character") continue;
        held.push([actor, (await bulletsHeldBy(actor)).map(item => item.id)]);
    }
    const remove = [], keep = [];
    for (const [actor, ids] of held) {
        for (const id of ids) {
            const item = actor.items.get(id);
            if (item) (sparedBySweep(item) ? keep : remove).push(item);
        }
    }
    return { remove, keep };
}

/**
 * Clear the evidence out, Faint and Final excepted.
 *
 * Guide, p. 29. Faint bullets are what survive, and Stage 3's lock is written
 * per chapter, so a Faint bullet carried across becomes analysable again all by
 * itself - nothing here has to unlock anything.
 *
 * NOTHING CALLS THIS ON A SCHEDULE ANY MORE (Z7). It used to be a tick in the
 * end-of-chapter window, and the season run measured what that tick was worth:
 * thirty to sixty bullets a chapter deleted, while the FOG the investigation was
 * actually drowning in - the four hundred Prep traces left by ordinary searches
 * - survived every time, because a death ties every trace of its chapter to the
 * crime and tied traces are exempt. The sweep took the evidence and left the
 * noise. Precisely backwards.
 *
 * So it stops happening because a date passed, and stays available because a GM
 * asks: the button is in the Investigation Dashboard, next to the one that
 * clears Faint Remnants, and both say how many before they do anything.
 */
export async function sweepTruthBullets({ actors = null } = {}) {
    if (!game.user.isGM) return { removed: 0, kept: 0 };

    let removed = 0;

    /* `faintOf`, NOT THE ITEM'S FLAG (`sparedBySweep`). Since 1.2.47 Faint is published onto
       a player's item only once they have analysed the bullet, so the flag reads false for
       every doubtful trace nobody has spent a Head roll on - and this sweep would have taken
       exactly the evidence Faint exists to carry across. The ledger is the truth and this runs
       GM-side, where the ledger is readable. And guide, p. 32: a Final Truth Bullet is
       "wyłączony ze sweepu" - it points at the Mastermind across the whole season, not one
       chapter's case, so the same reveal-and-clear cadence that resets everything else must
       leave it alone. Which bullets is `sweepPlan`'s, the same answer both counts show. */
    // `actors`: the students to sweep, every one where unsaid - the suite's, which must not sweep a table's world.
    const { remove, keep } = await sweepPlan({ actors });
    const kept = keep.length;
    for (const actor of actors ?? game.actors) {
        if (actor.type !== "character") continue;

        const doomed = remove.filter(item => item.parent?.id === actor.id);
        await keepBulletDeletions(actor, sparedBySweep);

        if (!doomed.length) continue;

        for (const item of doomed) await dropSecret(item.uuid);
        try {
            await actor.deleteEmbeddedDocuments("Item", doomed.map(i => i.id));
            removed += doomed.length;
        } catch (err) {
            error(`Could not sweep ${actor.name}'s Truth Bullets`, err);
        }
    }

    log(`Swept ${removed} Truth Bullet(s); ${kept} Faint one(s) carried over.`);
    return { removed, kept };
}

/**
 * The GM's end-of-chapter panel.
 *
 * One screen with counts, because two of these three cannot be undone and a GM
 * deserves to see the number before it happens rather than after.
 */
/**
 * Take this chapter's planted Key Remnants off the map.
 *
 * NOTHING DID THIS, AND NOTHING COULD. A Key Remnant is placed `reinforced` and
 * `tiedToCrime` on purpose - it has to survive the killer's clean-up and the Faint sweep,
 * or the trial it exists to make solvable can be erased by the person it accuses. The cost
 * of that armour is that no existing sweep can ever remove one: measured on 10.09, chapter
 * two began with chapter one's five clues still lying about, and the planner - which resets
 * with the chapter - could no longer see them to say so.
 *
 * Scoped to the chapter that is ending, so a clue planted early for a later chapter stays,
 * and the ledger row goes with the token rather than being left behind as a trace a GM can
 * see and not read (the same pairing `removeRemnant` makes).
 */
export async function clearChapterKeyRemnants(chapter) {
    if (!game.user.isGM) return 0;
    const { dropRemnantSecret } = await import("./remnants.mjs");
    let cleared = 0;
    for (const scene of game.scenes) {
        const doomed = remnantsOn(scene).filter(t => {
            const info = remnantData(t);
            return info?.type === "key" && info.chapter === chapter;
        });
        if (!doomed.length) continue;
        for (const token of doomed) await dropRemnantSecret(token);
        await scene.deleteEmbeddedDocuments("Token", doomed.map(t => t.id));
        cleared += doomed.length;
    }
    log(`Took ${cleared} Key Remnant(s) off the map at the end of chapter ${chapter}.`);
    return cleared;
}

/** The chapter window's line about the case's last backup (E04), from the world's case mark. */
function backupReminder() {
    const at = caseMark().lastBackupAt;
    const days = at ? Math.floor((Date.now() - at) / 86400000) : null;
    return game.i18n.format("DRPG.Case.chapterReminder", {
        when: days === null ? game.i18n.localize("DRPG.Case.backupNever")
            : days < 1 ? game.i18n.localize("DRPG.Case.backupToday") : plural("DRPG.Case.backupAgo", { n: days })
    });
}

export async function openChapterEndDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /* AN INCIDENT STILL OPEN ASKS FIRST (E10 C12, 1.2.71; audit S06-18): the register takes its
       killers when it is closed. Since E09 fix r2-G4 the row goes under the chapter the incident
       opened in, so a late close no longer lands on the next chapter's verdict - but this window ends
       the chapter, and its trial will not read the register again. trial-floor-ui.mjs
       `incidentClosedFirst` offers the close, or going on with it open; Cancel ends nothing. */
    const { incidentClosedFirst } = await import("./trial-floor-ui.mjs");
    if (!(await incidentClosedFirst())) return null;

    // The SAME test the reveal itself applies, or the preview promises work the
    // action will not do - `revealPlan`, since E09 C8 the reveal's own answer.
    //
    // It used to count every unanalysed bullet, while `revealAllBulletTypes`
    // skips any bullet with no real type in the answer key. So a table with two
    // unanalysed bullets that nobody had ever assigned a type to was offered
    // "reveal 2" and got back "Revealed 0" - and no way to tell whether the
    // tool had worked. And the difference is worth saying out loud rather than
    // swallowing: a bullet nobody assigned a type to is a loose end, not a
    // rounding error (`typeless`).
    const { reveal: revealable, typeless } = revealPlan();
    const hidden = revealable.length;

    const { finalTruthPlacedThisChapter } = await import("./mastermind.mjs");
    const finalTruthPlaced = finalTruthPlacedThisChapter();

    /* WHAT THE THREE CLEAN-UPS WOULD TAKE, COUNTED BEFORE THEY ARE OFFERED.
       Each count applies the same rule its action does, for the reason the reveal count
       above already gives: a checkbox that promises work the action will not do is worse
       than no checkbox. `sweepTruthBullets` keeps Faint and Final; `clearFaintRemnants`
       keeps anything reinforced or tied to the crime; the Key sweep takes this chapter's
       own planted clues and nothing older. The sweep's count is the sweep's own answer
       (`sweepPlan`, E09 C1), not the same rule over the documents: the documents and the
       bullets the GMs hold part where a player's write waits for its put-back - a category
       taken off, a Faint flag written - and an item a player's write made that no GM has
       decided on, which the sweep leaves for a GM (sheet-audit.mjs `ITEM_UNHELD`). */
    const endingChapter = getClock().chapter;
    const sweepable = (await sweepPlan()).remove.length;
    /* AND WHETHER THE TRIAL IS STILL SITTING. The clock is the authority, not the
       floor: a trial in session with nobody holding the floor has no floor record at
       all, and it is still a trial - see the note on the HUD's four states. */
    const trialSitting = getClock().phase === "classTrial";
    // The season's last chapter (CORE-10): moving on to a seventh is never what
    // the GM means; the reset lives under Between sessions.
    const lastChapter = (Number(getClock().chapter) || 1) >= CHAPTERS_PER_SEASON;

    let faintable = 0, keyable = 0;
    for (const scene of game.scenes) {
        for (const token of remnantsOn(scene)) {
            const info = remnantData(token);
            if (!info) continue;
            if (info.faint && !info.reinforced && !info.tiedToCrime) faintable++;
            if (info.type === "key" && info.chapter === endingChapter) keyable++;
        }
    }

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Chapter.endTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.format("DRPG.Chapter.endIntro", { chapter: getClock().chapter })}</p>
            <label class="drpg-checkbox">
                <input type="checkbox" name="reveal" checked />
                ${game.i18n.format("DRPG.Chapter.optReveal", { n: hidden })}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.revealKeeps")}</p>
            ${typeless ? `<p class="notes drpg-warning">${
                plural("DRPG.Chapter.typeless", { n: typeless })}</p>` : ""}
            <hr />
            <label class="drpg-checkbox">
                <input type="checkbox" name="sweep"${sweepable ? " checked" : " disabled"} />
                ${game.i18n.format("DRPG.Chapter.optSweep", { n: sweepable })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="faint"${faintable ? " checked" : " disabled"} />
                ${game.i18n.format("DRPG.Chapter.optFaint", { n: faintable })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="keys"${keyable ? " checked" : " disabled"} />
                ${game.i18n.format("DRPG.Chapter.optKeys", { n: keyable })}</label>
            <hr />
            <label class="drpg-checkbox">
                <input type="checkbox" name="endTrial"${trialSitting ? " checked" : " disabled"} />
                ${game.i18n.localize("DRPG.Chapter.optEndTrial")}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextChapter"${lastChapter ? "" : " checked"} />
                ${game.i18n.format("DRPG.Chapter.optNextChapter", {
                    from: getClock().chapter, to: getClock().chapter + 1 })}</label>
            ${lastChapter ? `<p class="notes drpg-warning">${game.i18n.format("DRPG.Chapter.lastChapter", {
                    n: getClock().chapter, next: getClock().chapter + 1 })}</p>` : ""}
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextSession" checked />
                ${game.i18n.format("DRPG.Chapter.optNextSession", {
                    from: getClock().session, to: getClock().session + 1 })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextMorning" checked />
                ${game.i18n.format("DRPG.Chapter.optNextMorning", {
                    day: (getClock().day ?? 1) + 1 })}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.endNote")}</p>
            <p class="notes${finalTruthPlaced ? "" : " drpg-warning"}">${game.i18n.localize(
                finalTruthPlaced
                    ? "DRPG.Mastermind.finalTruthPlaced"
                    : "DRPG.Mastermind.finalTruthReminder")}</p>
            <p class="notes">${esc(backupReminder())}
                <button type="button" data-drpg-backup>${esc(game.i18n.localize("DRPG.Case.backupTile"))}</button></p>
        </form>`),
        // The case's backup, from the window a chapter closes in (E04): the answer
        // keys it is about to reveal and sweep live in GM browsers, not the world.
        render: (event, dialog) => {
            dialog.element?.querySelector("[data-drpg-backup]")?.addEventListener("click", ev => {
                ev.preventDefault();
                import("./gm-stores.mjs").then(m => m.backupCase({ ask: true }))
                    .catch(err => error("Could not back up the case", err));
            });
        },
        buttons: [
            {
                action: "ok", label: game.i18n.localize("DRPG.Chapter.endConfirm"), default: true,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    return {
                        reveal: f.reveal.checked,
                        sweep: f.sweep.checked,
                        faint: f.faint.checked,
                        keys: f.keys.checked,
                        endTrial: f.endTrial.checked,
                        nextChapter: f.nextChapter.checked,
                        nextSession: f.nextSession.checked,
                        nextMorning: f.nextMorning.checked,
                        // The chapter this window was opened for, so a second
                        // GM's End of chapter cannot end the next one (CORE-17).
                        endingChapter: getClock().chapter
                    };
                }
            },
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel") }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    return applyChapterEnd(result);
}

/**
 * Everything the End of chapter screen does, once the GM has said which parts.
 *
 * SEPARATE FROM THE ASKING, and the reason is a test that could not be written.
 * The wiring here has been wrong twice - the archive that never fired, the trial
 * left sitting - and both times what caught it was driving a whole chapter through
 * a browser, which is a fifteen-minute answer to a question the suite should give
 * in a second. A dialog cannot be called from a test; this can.
 *
 * It also gives the console and a macro the same door the screen has:
 * `game.drpg.applyChapterEnd({ endTrial: true, nextChapter: true })`.
 *
 * The world is read HERE rather than passed in from the dialog. Everything below
 * is scoped to "the chapter that is ending" and "is the trial sitting", and both
 * are facts about the moment the work runs, not about the moment the GM was asked.
 *
 * @param {object} choices Which parts to do. Anything absent is not done, so a
 *   caller can ask for one step without knowing about the others.
 */
export async function applyChapterEnd(choices = {}) {
    if (!game.user.isGM) return null;

    const result = choices;
    const endingChapter = getClock().chapter;
    const trialSitting = getClock().phase === "classTrial";

    // Two GMs with the console open pressing End of chapter a few seconds
    // apart moved the clock two chapters and swept twice (CORE-17). Optional,
    // so the API and the suite can still call this without naming a chapter.
    if (choices.endingChapter != null && choices.endingChapter !== endingChapter) {
        await whisperToGms(`<p class="drpg-warning">${game.i18n.format("DRPG.Chapter.alreadyEnded", {
            n: choices.endingChapter
        })}</p>`);
        return null;
    }

    const done = [];
    if (result.reveal) {
        done.push(plural("DRPG.Chapter.doneReveal", { n: await revealAllBulletTypes() }));
    }

    /* THE THREE CLEAN-UPS, IN THE ORDER THEY HAVE TO HAPPEN.
       Reveal first (above) - it publishes the bullets the sweep is about to take, shows a Final
       its kind, and leaves a Faint (`revealPlan`, E09 C8 and fix r1-G5). Then the sweep, then
       the Remnants, and only then the clock, because everything here is scoped to the chapter that is
       ENDING and the moment the clock moves, "this chapter" means the next one. Measured
       on 10.09: crossing a chapter with none of this wired left the map holding the
       previous case's five clues and the players holding its Truth Bullets, while the plan
       that described them was silently discarded - the module dropped the GM's knowledge
       and kept everybody else's. */
    if (result.sweep) {
        const { removed } = await sweepTruthBullets();
        done.push(plural("DRPG.Chapter.doneSweep", { n: removed }));
    }
    if (result.faint) {
        const { clearFaintRemnants } = await import("./remnants.mjs");
        done.push(plural("DRPG.Chapter.doneFaint", { n: await clearFaintRemnants() }));
    }
    if (result.keys) {
        done.push(plural("DRPG.Chapter.doneKeys",
            { n: await clearChapterKeyRemnants(endingChapter) }));
    }

    /* THE PLAN STAYS WITH ITS CHAPTER, AND NOTHING IS FILED HERE (E05 C5, 1.2.64). Until then
       `keyPlan()` read one chapter's plan off a world setting and gave any other chapter blanks,
       so the ending chapter's plan was filed under `archive` here, before the clock moved - the
       only way what a GM wrote about a case outlived it. The plan is a GM store since, a row per
       chapter and slot (gm-stores.mjs `keyPlanStore`): the ending chapter's rows stay where they
       are, and the next chapter's are its own. */

    // The register of who killed belongs to the chapter that is ending, and is
    // no longer emptied here (E04): `blackenedIds` reads the rows of the clock's
    // chapter, so the next chapter starts with nobody's blood on anybody - and a
    // GM's copy that missed an emptying cannot bring last chapter's killers back.

    // The Cleaning Tools the chapter's clean-ups used (E32+E07 C12; cleanup.mjs
    // `noteCleaningTool`) are for its own discovery: a row the next chapter reads
    // counts nothing, and the move to it takes them all.
    if (result.nextChapter) {
        try {
            const { clearUsedTools } = await import("./cleanup.mjs");
            await clearUsedTools();
        } catch (err) {
            error("Could not empty the used Cleaning Tools at the end of the chapter", err);
        }
    }

    // And the chapter actually ends.
    //
    // The window is called "End of chapter / new session" and did three
    // clean-ups without touching either counter - measured, the clock read
    // Chapter 1 · Session 5 before and after, and the GM had to go and nudge
    // both by hand in "Edit campaign…". Tidying up and moving on are one event
    // at the table, so they are one screen here.
    const clock = getClock();
    const move = {};
    if (result.nextChapter) move.chapter = clock.chapter + 1;
    if (result.nextSession) move.session = clock.session + 1;
    if (Object.keys(move).length) {
        const { setClock } = await import("./clock.mjs");
        await setClock(move);
        done.push(game.i18n.format("DRPG.Chapter.moved", {
            chapter: move.chapter ?? clock.chapter,
            session: move.session ?? clock.session
        }));
    }

    /* AND THE ROOM EMPTIES. LAST, AND THAT ORDER IS THE POINT.

       Everything above is scoped to the chapter that is ending, so it has to run
       while the clock still says so. This one is scoped to what comes AFTER: the
       phase the next chapter opens in, and the elapsed clock that the first Daily
       Life of it is measured against. Closing the trial before the move would start
       that clock against a chapter that had not begun yet.

       Measured on 10.09, with the whole chapter driven end to end: this screen moved
       the clock to chapter 2 and left `phase: "classTrial"` with the debate floor
       open. The GM was told "The debate is open - Nonstop Debate." and pointed back
       at the trial they had just finished; every player's HUD read "Chapter 2 - Day 2
       - Class Trial". The way out existed - one button, listed BELOW this screen's
       own on the trial console - and nothing anywhere said to press it. */
    if (result.endTrial && trialSitting) {
        try {
            const { closeTrial } = await import("./trial-floor-ui.mjs");
            if (await closeTrial()) done.push(game.i18n.localize("DRPG.Chapter.doneEndTrial"));
        } catch (err) {
            error("Could not close the trial at the end of the chapter", err);
        }
    }

    /* AND THE NEXT CHAPTER OPENS THE FOLLOWING MORNING.

       This screen moved the chapter and the session and nothing else, which left the
       clock reading whatever the trial ended on. Measured across two chapters run end
       to end on 11.09: chapter 1 finished at Day 1 - Night and chapter 2 opened at Day
       1 - Night, with everybody's actions still spent from the time of day before the
       murder. The panel duly reported "1 student still has actions to spend", which was
       true and was a leftover.

       Murders happen at night, so this is not an edge case - it is where every chapter
       ends. And the fix is not "reset the clock": it is the next MORNING, one day on,
       which is the beat the table is actually resuming from. Actions and search tokens
       come back because that is what a new time of day does, through the same call
       every other advance uses rather than a second copy of the rule.

       LAST, AFTER THE TRIAL IS CLOSED. `closeTrial` puts the phase back to Daily Life
       and starts the elapsed clock; announcing a new morning before that would post the
       card into a Class Trial that has not finished. */
    if (result.nextMorning) {
        try {
            const { setTimeOfDay } = await import("./clock.mjs");
            // One write for the day and the hour: each write is a full redraw
            // on every client (CORE-12).
            await setTimeOfDay("morning", {
                resetActions: true, resetSearchTokens: true, announce: true,
                also: { day: (getClock().day ?? 1) + 1 }
            });
            done.push(game.i18n.format("DRPG.Chapter.doneNextMorning",
                { day: getClock().day }));
        } catch (err) {
            error("Could not open the next chapter on a fresh morning", err);
        }
    }

    // Nothing outlives its chapter. Ordinarily the trial's phase change cleared
    // this long ago; a GM who ended a chapter straight out of Daily Life would
    // otherwise carry a body card into the next one.
    await clearBodyDiscovery();

    if (!done.length) return null;

    await whisperToGms(`<h3>${game.i18n.localize("DRPG.Chapter.endTitle")}</h3>
        <ul>${done.map(d => `<li>${d}</li>`).join("")}</ul>`);
    return done;
}
