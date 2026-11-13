/**
 * A death (E54, the plan's D1): who is alive (`livingStudents`, `livingStudentsForGm`), a death marked, kept secret,
 * published and taken back (`markDeceased`, `killCharacter`, `recordSecretDeath`, `publishDeath`, `reviveCharacter`),
 * the victim's Truth Bullets (`bulletsHeldBy`, `keepBulletDeletions`, `destroyBullets`), the season's deaths and bodies
 * cleared and counted, and the death window (`openDeathDialog`, `chooseFirst`). Moved out of chapter.mjs, which
 * re-exports every name it exported; the predicates stay settings.mjs's (code.md, "Death is two predicates").
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { isDeceased, isDeadForGm, SETTINGS, seasonEpoch, deathRecord } from "./settings.mjs";
import { isTruthBullet, dropSecret } from "./truth-bullets.mjs";
import { publishTiesFor, handTiesOn, fightKey } from "./remnants.mjs";
import { studentActors } from "./monokuma.mjs";
import { log, error, whisperToGms, gmIds, warn, plural, isPrimaryGm } from "./utils.mjs";
import { drpgConfirm, drpgWindow, emptyOption } from "./ui-kit.mjs";
import { everyPart, registerSeasonState } from "./season-reset.mjs";
import { deferredOfferStore, deathStore, lootTraceStore } from "./gm-stores.mjs";
import { leaveBody, removeBodyTiles } from "./body-tile.mjs";
import { ensureDeadSpectator, removeDeadSpectator, removeAllDeadSpectators } from "./spectator-dead.mjs";

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
/*
 * THE CHAPTER'S NEWEST VERDICT AS A DEATH HAPPENS (E70 fix p1-G3; the review's E70P1-R14 = E70P1-R11 goal; DC29, DC41,
 * D17). A Monocub whose own trial runs listens ("You listen: this trial is about your death", monocub.mjs `ownCaseOpen`),
 * and that read the chapter's `lastVerdictAt` alone: a second murder after the chapter's first verdict read as closed.
 * The death keeps the stamp of the newest verdict before it (the trial record's `lastVerdictAt`, public on the verdict's
 * card), so its case is open while no verdict came after it. Not the death's time: a death the GMs keep would tell every
 * console when it happened once published (the `deathId` note below).
 */
function verdictBefore(chapter) {
    try {
        const record = game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {};
        return record.chapter === chapter ? (record.lastVerdictAt ?? null) : null;
    } catch {
        return null;
    }
}

export async function markDeceased(actor, { record: when = null, phase = null, cause = null, chapter = null, silent = true } = {}) {
    if (!game.user.isGM || !actor) return null;

    // A death published after the kill carries the kill's chapter, day and time of day
    // (`publishDeath`), not the moment somebody found the body. And its phase and season
    // (E11 C1, 1.2.73): a death in the Class Trial is an execution, which no walk past the
    // body discovers, and a chapter 1 is only this season's when its epoch says so
    // (`bodiesToDiscover`). `phase` is the caller's when the clock's is not the death's: a
    // verdict given after End the trial is still the trial's execution (E11 fix r1-G1).
    // `deathId` names this death and no other, so a discovery's stamp counts for the death it
    // announced and not for the next one of the same student (`announcedIn`); a random key and
    // not the time, which would tell every console when a death the GMs kept happened.
    // WHY, AND WHOSE CHAPTER (E70 C4; amend 4 (b)). An execution at the trial's end says so (`cause: "executed"`), and
    // is the trial's chapter's even when the chapter's end has moved the clock on before closing the trial
    // (trial-progress.mjs `executeAtExit`). A death with no cause writes none, as before.
    const clock = getClock();
    const record = when ?? { chapter: chapter ?? clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay, phase: phase ?? clock.phase, epoch: seasonEpoch(),
        deathId: foundry.utils.randomID(), sinceVerdict: verdictBefore(chapter ?? clock.chapter), ...(cause ? { cause } : {}) };

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

    /* THE BODY, WHERE THE TOKEN LIES (E63 C0, 11.11.2026; the owner on E95 Q3: "gdy postac umiera ... Nie gdy zostaje
       Monocubem"). Here, the one function every public death passes - a death public at once, a kept death made the
       table's (`publishDeath`), the Players window's "dead" - so no road lays a second. Handed the record just written,
       not the GMs' mark, which may not hold it yet (body-tile.mjs `leaveBody`). Tried on its own: a tile that cannot be
       laid does not undo the death. */
    try {
        await leaveBody(actor, { record });
    } catch (err) {
        error(`Could not leave ${actor.name}'s body on the map`, err);
    }

    /* THE DEAD WATCH (E62 C3b, 13.11.2026; spectator-dead.mjs): the student's Spectator where the body lies, made here
       for a death public at once and the Players window's "dead", and found here for a kept death made the table's
       (`publishDeath`), whose link then leaves the GMs' row for the watcher's flag. `silent` by default: every caller
       but `killCharacter` is a GM's correction or a publication, and only a death in play fades (SB-C3 #17). */
    try {
        await ensureDeadSpectator(actor, { silent });
    } catch (err) {
        error(`Could not make ${actor.name}'s Spectator`, err);
    }

    return record;
}

export async function killCharacter(actor, { keepBullets = false, secret = null, phase = null, cause = null, chapter = null, silent = false } = {}) {
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
        record = await recordSecretDeath(actor, { keepBullets, phase });
        if (!record) {
            warn(`${actor.name}'s death could not be kept by the GMs, so it is the table's at once.`);
            secretly = false;
        } else {
            // The kept death's Spectator (E62 C3b): its link in the GMs' row, no flag (spectator-dead.mjs).
            try {
                await ensureDeadSpectator(actor, { silent, kept: true });
            } catch (err) {
                error(`Could not make ${actor.name}'s Spectator`, err);
            }
        }
    }
    if (!secretly) {
        if (!keepBullets) removed = await destroyBullets(actor);
        // The record and the token marker, which the Players window's repair
        // dropdown writes on its own (F16) - one place decides what deceased means.
        record = await markDeceased(actor, { phase, cause, chapter, silent });
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
export async function bulletsHeldBy(actor) {
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
export async function keepBulletDeletions(actor, spares = () => false) {
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
async function recordSecretDeath(actor, { keepBullets = false, phase = null } = {}) {
    const clock = getClock();
    const record = { chapter: clock.chapter, day: clock.day, timeOfDay: clock.timeOfDay, phase: phase ?? clock.phase, epoch: seasonEpoch(),
        deathId: foundry.utils.randomID(), sinceVerdict: verdictBefore(clock.chapter) };
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
 * `publishFoundBodies`), by a GM's hand - the Players window's "dead" (gm-students.mjs
 * `applyAliveStates`) and the console's `game.drpg.publishDeath` (api.mjs) - and by a verdict
 * that executes a student whose death the GMs hold (trial-progress.mjs `executeAtExit`, E10 fix r1-G4:
 * the GM named them in the verdict's window, which told that GM whose death it is). Nothing
 * else: no trial and no chapter's end publishes a death on its own (the owner's Q3, 26.09.2026;
 * callers read with `git grep` on 10.10.2026, E10 fix r2-G3). Last, each loot of the body before this
 * is given its Truth Bullet, which names the body and so waited in the row (handover.mjs
 * `payOwedLoot`; E05 fix r2-F0b), and each identified copy of the body's loot trace found
 * before this the source it held back (truth-bullets.mjs `publishLootSource`; E05 fix r2-G4);
 * and the ties to the crime that waited for this death (remnants.mjs `publishTiesFor`; E09 fix
 * r1-G1), whichever road made it known - the discovery, or a GM's hand here.
 */
export async function publishDeath(actor, { phase = null, cause = null } = {}) {
    if (!game.user.isGM || !actor) return null;
    const row = deathStore.get(actor.id);
    if (!row) return isDeceased(actor) ? deathRecord(actor) : null;
    const removed = row.keepBullets ? 0 : await destroyBullets(actor);
    /* THE KILL'S RECORD, AND THE EXECUTION'S PHASE (E11 C1, 1.2.73). A verdict that executes a
       death the GMs held passes `phase: "classTrial"` (trial-progress.mjs `executeAtExit`): the record
       keeps the kill's chapter, day and time, and says the death is the execution, so after End
       the trial two students walking past it do not discover it (`bodiesToDiscover`). Reading this
       chapter's verdict instead was weighed and refused: a second trial blanks the record (D17). */
    const record = await markDeceased(actor, {
        record: { chapter: row.chapter ?? getClock().chapter, day: row.day ?? null, timeOfDay: row.timeOfDay ?? null,
            phase: phase ?? row.phase ?? null, epoch: row.epoch ?? null, deathId: row.deathId ?? null, sinceVerdict: row.sinceVerdict ?? null,
            ...(cause ? { cause } : {}) }
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

    const sure = await drpgConfirm({
        classes: ["drpg-panel"],
        title: game.i18n.localize("DRPG.Chapter.stageSixTitle"),
        body: `<div>
            <p>${game.i18n.format("DRPG.Chapter.stageSixIntro", {
                victim: foundry.utils.escapeHTML(victim.name),
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>
            <p>${game.i18n.format("DRPG.Chapter.stageSixWhat", {
                killer: foundry.utils.escapeHTML(killer?.name ?? "?")
            })}</p>
        </div>`,
        yes: { label: game.i18n.localize("DRPG.Chapter.stageSixYes") },
        // The role's word (E21 rule 3): the question is withdrawn, so Cancel - not the caller's "Not now".
        no: "cancel",
        rejectClose: false
    });

    if (sure) await beginResolution("victimKilled");
}

/**
 * Undo the marking. The inventory does NOT come back - those documents are
 * gone - so this is for a mis-click, not for a resurrection.
 */
export async function reviveCharacter(actor, { quiet = false, silent = false } = {}) {
    if (!game.user.isGM || !actor) return false;

    // The dead's Spectator goes first, while a kept death's row still names it (E62 C3b, Q-C3b-4): its token with the
    // curtain's return, none for a correction (`silent`). Tried on its own: the revive stands either way.
    try {
        await removeDeadSpectator(actor, { silent });
    } catch (err) {
        error(`Could not take ${actor.name}'s Spectator away`, err);
    }

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

    // A student back alive has no body (E95 C2; QUESTIONS Q8): the body tiles they left as a Monocub go, of whichever
    // death (body-tile.mjs `removeBodyTiles`). Tried on its own: the revive is done whether or not a tile could go.
    try {
        await removeBodyTiles(actor.id);
    } catch (err) {
        error(`Could not take ${actor.name}'s body off the map`, err);
    }

    // `quiet`: the season reset revives every corpse in a row and deletes every
    // Truth Bullet anyway, so a toast per body said nothing (CORE-18).
    if (!quiet) ui.notifications.info(game.i18n.format("DRPG.Chapter.revived", { name: actor.name }));
    return true;
}

/**
 * The season reset's deaths group (E42 C3; a run of season-setup.mjs `wipeSeason` until then): every student comes
 * back whole (season-wipe.mjs `wipeStudent`'s `deaths` part), and the deaths nobody found (E05 C10) - the group's
 * cut, written before every step, takes the GMs' rows on every GM and every player's copy; this drops what this
 * browser holds. And every body left on the map (E95 C2; QUESTIONS Q7, the group "deaths"): a revive takes its
 * student's, and this takes every one besides - a body whose student is gone from the world, or one a revive could not
 * remove (body-tile.mjs `removeBodyTiles`). Each tried (`everyPart`): a tile that cannot go keeps no student dead.
 * `ctx.removeBodyTiles`, where the caller hands one, runs in its place - tier 2 alone, so that a GM's suite at a table
 * takes off only its own tiles and no body the table holds (E95 fix RV-1); the reset's own context carries none.
 */
export async function clearSeasonDeaths(ctx) {
    await everyPart(async () => {
        /* The Spectators of the dead (E62 C3b, the storyboard's F: a Spectator "to the season's end"): a revive below
           takes a public death's; the kept deaths' go here, while their rows still name them, and any watcher left
           besides. Not when the caller hands its own `removeBodyTiles` - tier 2's fence (E95 fix RV-1), which must not
           take a table's own Spectators: the suite's revives take its own. */
        if (typeof ctx?.removeBodyTiles !== "function") await removeAllDeadSpectators();
        await ctx.everyStudent("deaths");
        if (isPrimaryGm()) await deathStore.clear();
        else await deathStore.dropMany(Object.keys(deathStore.entries()));
    }, () => (typeof ctx?.removeBodyTiles === "function" ? ctx.removeBodyTiles() : removeBodyTiles(null, { held: false })));
}

/** What the reset window counts of the deaths: the students dead for the GMs (season-setup.mjs `resetTally` until E42 C3). */
export function tallySeasonDeaths() {
    return [plural("DRPG.Season.resetDead", { n: studentActors().filter(isDeadForGm).length })];
}

/**
 * The season reset's bodyFound group (E42 C3): the body found, and the season's stamps of the bodies found (E11 C1)
 * under the same tick - both say what this season found, and its chapter 1 is not the next season's. Each tried
 * (`everyPart`), written whole.
 */
export async function clearSeasonBodies() {
    await everyPart(() => game.settings.set(MODULE_ID, SETTINGS.bodyFound, {}),
        () => game.settings.set(MODULE_ID, SETTINGS.bodiesFound, {}));
}

registerSeasonState({ group: "deaths", clear: clearSeasonDeaths, tally: tallySeasonDeaths });
registerSeasonState({ group: "bodyFound", clear: clearSeasonBodies, settings: [SETTINGS.bodyFound, SETTINGS.bodiesFound] });

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
    /* "- CHOOSE -" FIRST, THE BUTTON SHUT UNTIL A CHOICE (E22 C3b, 06.11.2026; audit S06-08). The select opened on the
       first living student, and one Enter killed them and destroyed their Truth Bullets. It opens on "- choose -" now, and
       the destructive button stays disabled until a name is chosen; during an incident the incident's victim, the one
       fact the module has about who died, is chosen already (the kill's own default above). The answer keeps its shape. */
    const chosen = actor ? actor.id : alive.some(a => a.id === victimId) ? victimId : "";
    const picker = actor
        ? `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong></p>`
        : `<label>${game.i18n.localize("DRPG.Chapter.whoDied")}
                <select name="actor">${emptyOption("DRPG.Chapter.chooseOne", { selected: !chosen })}${listed
                    .map(a => `<option value="${a.id}"${a.id === chosen ? " selected" : ""}>${
                        foundry.utils.escapeHTML(a.name)}</option>`).join("")}</select></label>`;

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Chapter.deathTitle"),
        classes: ["drpg-panel"],
        body: `<form>
            ${picker}
            <label class="drpg-checkbox">
                <input type="checkbox" name="keepBullets" />
                ${game.i18n.localize("DRPG.Chapter.keepBullets")}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="secret"${secretByDefault ? " checked" : ""} />
                ${game.i18n.localize("DRPG.Chapter.keepSecretUntilFound")}</label>
            <p class="notes">${game.i18n.localize("DRPG.Chapter.deathNote")}</p>
        </form>`,
        // What cannot be undone (E22 rule 4): the destructive role, Cancel the default and first under Enter.
        footer: {
            destructive: [{
                action: "ok", label: game.i18n.localize("DRPG.Chapter.confirmDeath"), disabled: !chosen,
                callback: (e, b, d) => {
                    const f = d.element.querySelector("form");
                    const id = actor?.id ?? f.actor.value;
                    return id ? { id, keepBullets: f.keepBullets.checked, secret: f.secret.checked } : false;
                }
            }],
            close: "cancel",
            default: "cancel"
        },
        render: (event, dialog) => chooseFirst(dialog, "actor"),
        rejectClose: false
    });

    if (!result || result === "cancel") return false;

    const dying = game.actors.get(result.id);
    if (!dying) return false;
    return Boolean(await killCharacter(dying, { keepBullets: result.keepBullets, secret: Boolean(result.secret) }));
}

/**
 * The consequence button of a window whose select opens on "- choose -" (E22 C3b): disabled while the select named
 * `field` holds nothing, enabled once it holds a choice. A window with no such select (the Students list's Kill names
 * its student) is left as drawn.
 */
export function chooseFirst(dialog, field) {
    const root = dialog?.element;
    const select = root?.querySelector(`select[name="${field}"]`);
    const button = root?.querySelector('footer button[data-action="ok"]');
    if (!select || !button) return;
    const sync = () => { button.disabled = !select.value; };
    select.addEventListener("change", sync);
    sync();
}
