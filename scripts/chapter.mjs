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
 *
 * E54 (the plan's D1, D2): a death lives in death.mjs and a body found in body.mjs, both re-exported here; this
 * file keeps the chapter's end: the reveal, the sweep, its steps and its record.
 */

import { MODULE_ID, CHAPTERS_PER_SEASON } from "./config.mjs";
import { cardWarn } from "./chat-card.mjs";
import { getClock, phaseLabel } from "./clock.mjs";
import { clearBodyDiscovery, isDeceased, isDeadForGm, deathRecord, deathRecordFor, pendingDeath, sameSeason, SETTINGS } from "./settings.mjs";
import { TRUTH_BULLET_FLAGS, bulletsOf, secretOf, dropSecret, faintOf, bulletAsHeld, publishReading } from "./truth-bullets.mjs";
import { remnantsOn, remnantData } from "./remnants.mjs";

import { whisperToGms, log, error, plural, esc, isPrimaryGm, primaryGmId, serverNow, listOf } from "./utils.mjs";
// The kit's frame (E21 C3a): every window of the case's chapter is a `drpgWindow` or a `drpgConfirm`, answering as before.
import { drpgWindow, box } from "./ui-kit.mjs";
import { columnsHtml } from "./ui-columns.mjs";
// A leaf (utils.mjs alone): the one runner of the procedures that cannot be taken back, and its report (E42 C2).
import { runSteps, stepsReport } from "./steps.mjs";
// A leaf (season-exceptions.mjs alone): the registry of season state the reset walks (E42 C3).

import { caseMark } from "./gm-stores.mjs";
// The engine (config.mjs alone): the moment this browser's GM stores open, for the prompt of a discovery waiting (1.2.113).

// A leaf (config.mjs alone): the scenes of the discovery window and a discovery handed no scene (E12 C5).

import { tipAttr, tipText } from "./ui-kit.mjs";
import { bulletsHeldBy, keepBulletDeletions } from "./death.mjs";
export { faintPrepCandidates, promoteFaintPrep, discoverBody, deathAnnounced, announceBody, BODY_ANNOUNCED_HOOK, announceArrivedBodies, registerBodyAnnounced, announcedIn, bodiesToDiscover, witnessesOf, maybeBodyFound, pendingBodyDiscoveries, answersBodyPrompt, askPendingBodies, registerPendingBodies, bodiesLyingIn, openBodyDiscoveryDialog } from "./body.mjs";
export { livingStudents, livingStudentsForGm, markDeceased, killCharacter, incidentVictimDied, publishDeath, tellUnfoundDeaths, reviveCharacter, clearSeasonDeaths, clearSeasonBodies, openDeathDialog } from "./death.mjs";

/* ==========================================================================
 * DEATH
 * ========================================================================== */

// The predicates live in settings.mjs (E05 C9), with the rules A-C that say which
// one a caller asks, and are re-exported here for api.mjs and every caller that
// already imports them from this file.
export { isDeceased, isDeadForGm, deathRecord, deathRecordFor, pendingDeath };

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
 * copy, for `publishReading`), `typeless`, the bullets still not analysed whose answer key names no kind, which the
 * panel warns of, and `typelessHolders`, the names of the characters holding them, which the warning gives (E11 C13,
 * audit S13-06: "2 Truth Bullets have no real type recorded" sent the GM looking through every sheet for them).
 */
export function revealPlan({ actors = null } = {}) {
    if (!game.user.isGM) return { reveal: [], typeless: 0, typelessHolders: [] };
    const reveal = [];
    let typeless = 0;
    const holders = new Set();
    for (const { actor, item } of allBullets(actors)) {
        const held = bulletAsHeld(item), secret = secretOf(item.uuid);
        if (!secret.realType) {
            if (!held.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.analyzed)) {
                typeless++;
                holders.add(actor.name);
            }
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
    return { reveal, typeless, typelessHolders: [...holders] };
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
 * see and not read (the same pairing `removeRemnant` makes). And to this season's chapter (E11
 * C12, 1.2.73; audit S06-42): after a reset that kept the traces, the new chapter 1's end took
 * last season's chapter-1 clues as well. Those stay for the Remnants group or a GM's hand, and the
 * window's count (`openChapterEndDialog`) asks the same question, so it counts what this takes.
 */
export async function clearChapterKeyRemnants(chapter) {
    if (!game.user.isGM) return 0;
    const { dropRemnantSecret } = await import("./remnants.mjs");
    let cleared = 0;
    for (const scene of game.scenes) {
        const doomed = remnantsOn(scene).filter(t => {
            const info = remnantData(t);
            return info?.type === "key" && info.chapter === chapter && sameSeason(info);
        });
        if (!doomed.length) continue;
        for (const token of doomed) await dropRemnantSecret(token);
        // The refs' tokens (E60 C1b; every ref holds one, D38 = 1, fix FG1): a token gone meanwhile leaves the row, gone with its tombstone above.
        const ids = doomed.filter(t => t.document).map(t => t.id);
        if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
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

/**
 * THE END OF CHAPTER WINDOW'S FORM, FROM ITS COUNTS (E11 C13, 1.2.73; audit S13-06; tier 1 R357, scenario 65 W1).
 *
 * The audit's screenshot showed one window and three numbers for the same bullets: "Reveal ... (0 still
 * unidentified)", ticked, over a box saying "2 Truth Bullets have no real type recorded", while the
 * Investigation dashboard's column read "NOT ANALYSED 2" - and the GM could not tell whether the reveal would do
 * anything. Since E09 C8 the option has counted what the reveal does (`revealPlan`); what was left is that it stayed
 * ticked and live at 0, and that the box said how many and not whose. Now every box here follows one rule: a box
 * whose count is 0 is unticked and disabled, the reveal's as the three clean-ups' always were; and the warning
 * names the characters holding the bullets it counts, in the dashboard's own term ("not analysed"). Pure: the
 * counts come in, so R357 reads it on numbers it chooses and `openChapterEndDialog` on the world's.
 */
export function chapterEndForm({ chapter, session, day, hidden = 0, typeless = 0, holders = [], sweepable = 0,
    faintable = 0, keyable = 0, trialSitting = false, lastChapter = false, finalTruthPlaced = false, backup = "", mastermind = false } = {}) {
    /* A BOX SAYS WHY IT IS SHUT, AND WHAT CANNOT BE UNDONE SAYS SO (E22 C3b, 06.11.2026; audit S12-19, the owner's Q-E21-1
       (c)). A box at 0 was disabled with its label at full contrast and no reason, so it read as live; its words are the
       fine print now (`.notes`, the palette's dim) with the reason after them (`DRPG.Chapter.optNothing`, the trial's own).
       The four that cannot be undone - the reveal, the sweep, the Faint clean-up, the Key Remnants taken off - stay ticked
       with their counts, as the owner's default keeps them, and carry the destructive mark: `drpg-destructive` on the
       label and "cannot be undone" in its words (the mark's face is the role table's, E22 C6). The checkbox's helper is
       `tick`, named `box` until E46-C6 brought the kit's `box` into this file: the window's three warnings (the untyped
       bullets, the last chapter, no Final Truth Remnant) are the kit's warning box since then, as E21 homed them (R2035),
       and the Final Truth line stays a plain note while the Remnant is placed. */
    const tick = (name, n) => `<input type="checkbox" name="${name}"${n ? " checked" : " disabled"} />`;
    const option = (name, n, words, { permanent = false, why = "DRPG.Chapter.optNothing" } = {}) => n
        ? `<label class="drpg-checkbox${permanent ? " drpg-destructive" : ""}"${permanent ? " data-drpg-permanent" : ""}>
                ${tick(name, n)}
                ${words}${permanent ? ` <span class="notes">${game.i18n.localize("DRPG.Chapter.optPermanent")}</span>` : ""}</label>`
        : `<label class="drpg-checkbox" data-drpg-off>
                ${tick(name, n)}
                <span class="notes">${words} - ${game.i18n.localize(why)}</span></label>`;
    /* TWO COLUMNS, ONE SCREEN (E64-inv, 12.11.2026; the owner's pick of the Investigation review: the window fits at
       1366x768). In one column of the kit's default width the clock's options and the backup were under the fold at
       1366x768 in both themes (audit/style-sweep.mjs `--fit`, STILL). The evidence on the left - the reveal and the three
       clean-ups - the clock and the case's backup on the right, as the action windows stand their columns
       (ui-columns.mjs `columnsHtml`); they stack where the window is narrower than both. */
    const evidence = `
            ${option("reveal", hidden, game.i18n.format("DRPG.Chapter.optReveal", { n: hidden }), { permanent: true })}
            <p class="notes">${game.i18n.localize("DRPG.Chapter.revealKeeps")}</p>
            ${typeless ? box("warning", `<p data-drpg-typeless>${
                plural("DRPG.Chapter.typeless", { n: typeless, who: esc(holders.join(", ")) })}</p>`) : ""}
            <hr />
            ${option("sweep", sweepable, game.i18n.format("DRPG.Chapter.optSweep", { n: sweepable }), { permanent: true })}
            ${option("faint", faintable, game.i18n.format("DRPG.Chapter.optFaint", { n: faintable }), { permanent: true })}
            ${option("keys", keyable, game.i18n.format("DRPG.Chapter.optKeys", { n: keyable }), { permanent: true })}`;
    const clock = `
            ${option("endTrial", trialSitting, game.i18n.localize("DRPG.Chapter.optEndTrial"), { why: "DRPG.Chapter.optNoTrial" })}
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextChapter"${lastChapter ? "" : " checked"}${tipAttr("DRPG.Tips.Trial.moveToChapterToTooltip")} />
                ${game.i18n.format("DRPG.Chapter.optNextChapter", { from: chapter, to: chapter + 1 })}</label>
            ${lastChapter ? box("warning", `<p>${game.i18n.format("DRPG.Chapter.lastChapter", {
                    n: chapter, next: chapter + 1 })}</p>`) : ""}
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextSession" checked${tipAttr("DRPG.Tips.Trial.countThisAsSessionTooltip")} />
                ${game.i18n.format("DRPG.Chapter.optNextSession", { from: session, to: session + 1 })}</label>
            <label class="drpg-checkbox">
                <input type="checkbox" name="nextMorning" checked />
                ${game.i18n.format("DRPG.Chapter.optNextMorning", { day: day + 1 })}</label>
            ${/* The Final Truth Remnant points at the Mastermind (E22 C3b; audit S06-47): a season with none set is told
                 nothing about it, and the warning was red at every chapter's end of such a season. */ ""}
            ${!mastermind ? "" : finalTruthPlaced
                ? `<p class="notes" data-drpg-final-truth>${game.i18n.localize("DRPG.Mastermind.finalTruthPlaced")}</p>`
                : box("warning", `<p data-drpg-final-truth>${game.i18n.localize("DRPG.Chapter.finalTruthMissing")}</p>`)}
            <p class="notes">${esc(backup)}
                <button type="button" data-drpg-backup>${esc(game.i18n.localize("DRPG.Case.backupNow"))}</button></p>`;
    return `<form>
            <p>${game.i18n.format("DRPG.Chapter.endIntro", { chapter })}</p>
            ${columnsHtml([evidence, clock])}
        </form>`;
}

/**
 * The GM's end-of-chapter panel.
 *
 * One screen with counts, because two of these three cannot be undone and a GM
 * deserves to see the number before it happens rather than after.
 */
export async function openChapterEndDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }
    // Before anything is asked or counted: the end is the primary GM's (`applyChapterEnd`, ONE BROWSER).
    if (!chapterEndHere()) return null;

    /* A STOPPED END IS ANSWERED FIRST (E42 C2, 1.2.97; E42-10). While an end that stopped part way stands, this window
       asks what to do with it - Finish the chapter's end, Drop the rest, or Cancel, the default - instead of drawing
       the form of a new end, which `applyChapterEnd` would refuse (`endStands`). */
    const stopped = chapterEndStopped();
    if (stopped) return askStoppedEnd(stopped);

    /* AN INCIDENT STILL OPEN ASKS FIRST (E10 C12, 1.2.71; audit S06-18): the register takes its
       killers when it is closed. Since E09 fix r2-G4 the row goes under the chapter the incident
       opened in, so a late close no longer lands on the next chapter's verdict - but this window ends
       the chapter, and its trial will not read the register again. trial-floor-ui.mjs
       `incidentClosedFirst` offers the close, or going on with it open; Cancel ends nothing. */
    const { incidentClosedFirst } = await import("./trial-floor-ui.mjs");
    if (!(await incidentClosedFirst())) return null;

    /* THE CLOCK THIS WINDOW WAS OPENED ON, read once, after the incident's question (E11 C5, 1.2.73;
       audit S06-40). The window used to send the chapter it found when Do it was pressed, and
       `applyChapterEnd` refused only a chapter that had moved: with "next chapter" unticked nothing it
       compared ever moved, so a second window - another GM's, or one left open - counted the session
       and the morning again (65-season C1, measured on 10.10.2026 with the code before this: two
       sessions and two days on). The chapter, the
       session and the day as they stood when the GM was shown this window are what the GM chose
       against; `applyChapterEnd` refuses the end when any of them has moved since. And the phase
       (E11 fix r2-H3; round 2's sec S3): "Close the trial" is drawn disabled when no trial sits, so a
       Class Trial another GM opened while this window stood could not be closed from it, and whatever
       else was ticked - the next morning, the next session, the next chapter - went on over that trial. */
    const opened = endMark(getClock());

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
    const { reveal: revealable, typeless, typelessHolders } = revealPlan();
    const hidden = revealable.length;

    const { finalTruthPlacedThisChapter, mastermindActor } = await import("./mastermind.mjs");
    const finalTruthPlaced = finalTruthPlacedThisChapter();
    const mastermind = Boolean(mastermindActor());

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
            if (info.type === "key" && info.chapter === endingChapter && sameSeason(info)) keyable++;
        }
    }

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Chapter.endTitle"),
        classes: ["drpg-panel", "drpg-window-chapter-end"],
        // Two columns (`chapterEndForm`, E64-inv): a stated width, held under the screen by the kit (`kitWidth`).
        width: CHAPTER_END_WIDTH,
        body: chapterEndForm({
            chapter: getClock().chapter, session: getClock().session, day: getClock().day ?? 1,
            hidden, typeless, holders: typelessHolders, sweepable, faintable, keyable, trialSitting, lastChapter,
            finalTruthPlaced, backup: backupReminder(), mastermind
        }),
        // The case's backup, from the window a chapter closes in (E04): the answer
        // keys it is about to reveal and sweep live in GM browsers, not the world.
        render: (event, dialog) => {
            dialog.element?.querySelector("[data-drpg-backup]")?.addEventListener("click", ev => {
                ev.preventDefault();
                import("./gm-stores.mjs").then(m => m.backupCase({ ask: true }))
                    .catch(err => error("Could not back up the case", err));
            });
        },
        // The chapter's end is named by its effect (E22-05; S13-04: it said "Do it") and cannot be undone: destructive,
        // Cancel the default and first under Enter.
        footer: {
            destructive: [{
                action: "ok", label: game.i18n.format("DRPG.Chapter.endButton", { n: getClock().chapter }),
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
                        nextMorning: f.nextMorning.checked
                    };
                }
            }],
            close: "cancel",
            default: "cancel"
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;

    return applyChapterEnd({ ...result, opened });
}

/* End the chapter's width (E64-inv): wide enough for its two columns at 1366x768, measured in Chromium (the commit's fit
   pass); narrower than the action windows' 1120 px, whose columns hold more. */
const CHAPTER_END_WIDTH = 900;

/** The part of the clock an End of chapter is chosen against: `openChapterEndDialog` reads it, `applyChapterEnd` compares. */
function endMark(clock) {
    return { chapter: clock.chapter, session: clock.session, day: clock.day ?? 1, phase: clock.phase };
}

/** The boxes an end is asked with, as its record keeps them (E42 C2): booleans alone. */
const END_CHOICES = Object.freeze(["reveal", "sweep", "faint", "keys", "endTrial", "nextChapter", "nextSession", "nextMorning"]);

/** Whether an end runs on this browser now (`runChapterEnd`): its record says "applying" while it runs, and is not stopped. */
let endRunning = false;

/**
 * THE END'S RECORD (E42 C2, 1.2.97; E42-08; audit S17-30). The world setting `chapterEnd`, written by the primary GM
 * alone, inside `applyChapterEnd`'s queue: `{ stage, by, at, opened, choices, ending: { chapter, session, day, phase,
 * stands }, done, failed, notRun }`, and once dropped `droppedBy` and `droppedAt` (`finishChapterEnd`) - step keys, the
 * clock's numbers and phases, the boxes as booleans, GM ids and times, no text and no secret (world-secrets.mjs names it). Written "applying" once the guards have passed and before the
 * first step, again after every step that changed it, and at the end "done" when every step the GM asked for ran, or
 * left "applying": an end that stopped, which `finishChapterEnd` finishes or drops ("dropped"). `{}` before the first.
 * Until 1.2.97 an end kept no record: a step that failed was named and the GMs told to finish by hand, and ending the
 * chapter again - the one road back - redid every step (E42-T4, measured at cef11276: the session and the day moved twice).
 */
function chapterEndRecord() {
    return game.settings.get(MODULE_ID, SETTINGS.chapterEnd) ?? {};
}

/**
 * The end that stopped part way and waits to be finished, or null: its record "applying", no end running on this
 * browser, and none running on another.
 *
 * ANOTHER GM'S END THAT STILL RUNS IS NOT ONE (E42 fix FG2, 03.11.2026; the end review's C-m2 = S-M2, STATUS Open 16).
 * `endRunning` is this browser's, so another GM's panel read the primary's end "applying" for the seconds it ran as
 * stopped, and a GM who became the primary meanwhile was offered Finish over an end still running on the old one. An
 * end runs on the primary alone and stops once its browser is no longer the primary (`runChapterEnd`'s `stop`), so a
 * record whose `by` is a connected GM that is the primary now, and that names no step failed, is running there - as
 * the verdict reads its `by` (verdict.mjs `verdictStopped`); one whose `by` left, reloaded or is no longer the primary
 * is stopped. Tier 2 E42-T12.
 */
export function chapterEndStopped(record = chapterEndRecord()) {
    if (record?.stage !== "applying" || endRunning) return null;
    const by = game.users.get(record.by);
    const failed = Array.isArray(record.failed) ? record.failed : [];
    if (!failed.length && by?.active && by.isGM && by.id !== game.user.id && by.id === primaryGmId()) return null;
    return record;
}

/**
 * WHERE THE END MOVES THE CLOCK, FROM ITS RECORD (E42 C2, 1.2.97; E42-09; R1253). Pure. The next chapter and the next
 * session are the ending's own plus one, out of the Investigation into Daily Life with them (E11 C5), and the next
 * morning is the ending's day plus one - each only while the clock still reads the ending's value. The `clock` and
 * `morning` steps read the clock as it stood and added one (`clock.session + 1`, `getClock().day + 1`), so a step run
 * again after its work had landed - a Finish after a tab closed between the work and its record - moved it again.
 * Now such a step finds nothing to move, and a counter somebody else moved meanwhile is left as they left it.
 * Answers `{ clock: the patch or null, morning: { day } or null }`.
 */
export function endMoves(ending = {}, choices = {}, clock = {}) {
    const move = {};
    if (choices.nextChapter && clock.chapter === ending.chapter) move.chapter = ending.chapter + 1;
    if (choices.nextSession && clock.session === ending.session) move.session = ending.session + 1;
    if (Object.keys(move).length && ending.phase === "investigation") move.phase = "dailyLife";
    const morning = choices.nextMorning && (clock.day ?? 1) === ending.day ? { day: ending.day + 1 } : null;
    return { clock: Object.keys(move).length ? move : null, morning };
}

/**
 * THE PHASE A FINISH HOLDS THE END TO (E42 C2, 1.2.97; R1253). Pure. An end stops when the phase moves off the one it
 * stands on (`ending.stands`: the phase it began in, or the one its own clock or trial step left). A tab closed between
 * that step's move and its record leaves Daily Life with the record still on the Investigation or the trial - the
 * end's own move, read so when that step is not done, was asked for, and its work reads landed: the counters off the
 * ending's (`endMoves` has nothing left to move), or the trial no longer sitting. Any other phase has moved: null.
 */
export function endHeldPhase(record = {}, clock = {}) {
    const { ending = {}, choices = {}, done = [] } = record ?? {};
    if (clock.phase === ending.stands) return clock.phase;
    if (clock.phase !== "dailyLife") return null;
    if (ending.stands === "investigation" && !done.includes("clock") && (choices.nextChapter || choices.nextSession)
        && !endMoves(ending, choices, clock).clock) return "dailyLife";
    if (ending.stands === "classTrial" && !done.includes("trial") && choices.endTrial) return "dailyLife";
    return null;
}

/** A step of the end in the GM's words (`DRPG.Chapter.step.*`). */
function stepWords(key) {
    return game.i18n.localize(`DRPG.Chapter.step.${key}`);
}

/** The steps a record's choices asked for (`asked`), done or not as `done` says, in order: the tools and the hold are never named. */
function askedSteps(record, done) {
    const context = { choices: record?.choices ?? {}, ending: record?.ending ?? {}, failed: record?.failed ?? [] };
    const held = record?.done ?? [];
    return CHAPTER_END_STEPS.filter(step => step.asked?.(context) && held.includes(step.key) === done).map(step => step.key);
}

/**
 * THE CHAPTER'S END, ONE ORDERED LIST (E11 C5, 1.2.73; audit S06-13, S06-40; the plan's p10change).
 *
 * Each step is `{ key, asked, run }`; `run({ choices, ending, failed })` answers the line the GMs' card reports, null
 * when it had nothing to do, or false when it failed without throwing (`closeTrial` answers false
 * when its clock write threw, E10 C12); `failed` holds the keys of the steps before it that failed.
 * `asked` (E11 fix r2-J1) says, from the same argument, whether the GM's choices ask the step for any work:
 * an end that stops part-way names the steps it did not run, and only those the GM asked for. A step
 * that moves the phase itself writes the phase it leaves on `ending.stands` (the clock's move out of
 * the Investigation, the trial's close), which the next step's check compares against.
 * `runChapterEnd` runs them in this order on steps.mjs `runSteps` (E42 C2), each in its own try/catch: a step that fails is logged and named,
 * and the steps after it still run - the morning aside, which does not open over a trial that did not close. Until 1.2.73 the same
 * work was one function of nine steps, three of them in a try/catch and six not, so a clock move
 * that threw stopped the end there with the rest undone and the GM told nothing, and a trial that would not
 * close left no line on the GMs' card and no word to the GM (tier 2 "a chapter end step that fails
 * is named ..." measured both with the code before this, 10.10.2026).
 *
 * THE THREE CLEAN-UPS, IN THE ORDER THEY HAVE TO HAPPEN.
 * Reveal first - it publishes the bullets the sweep is about to take, shows a Final its kind, and
 * leaves a Faint (`revealPlan`, E09 C8 and fix r1-G5). Then the sweep, then the Remnants, and only
 * then the clock, because everything here is scoped to the chapter that is ENDING and the moment the
 * clock moves, "this chapter" means the next one. Measured on 10.09: crossing a chapter with none of
 * this wired left the map holding the previous case's five clues and the players holding its Truth
 * Bullets, while the plan that described them was silently discarded - the module dropped the GM's
 * knowledge and kept everybody else's.
 *
 * THE PLAN STAYS WITH ITS CHAPTER, AND NOTHING IS FILED HERE (E05 C5, 1.2.64). Until then `keyPlan()`
 * read one chapter's plan off a world setting and gave any other chapter blanks, so the ending
 * chapter's plan was filed under `archive` here, before the clock moved - the only way what a GM wrote
 * about a case outlived it. The plan is a GM store since, a row per chapter and slot (gm-stores.mjs
 * `keyPlanStore`): the ending chapter's rows stay where they are, and the next chapter's are its own.
 *
 * The register of who killed belongs to the chapter that is ending, and is no longer emptied here
 * (E04): `blackenedIds` reads the rows of the clock's chapter, so the next chapter starts with
 * nobody's blood on anybody - and a GM's copy that missed an emptying cannot bring last chapter's
 * killers back.
 *
 * A DEATH THE GMS STILL HOLD IS NOT THE CHAPTER'S TO TELL (the amendment of 26.09.2026): no step
 * publishes, revives or counts one - 65-season Q reads it kept, and the living count the table
 * reads unchanged, across an end.
 */
export const CHAPTER_END_STEPS = [
    { key: "reveal", asked: ({ choices }) => Boolean(choices.reveal), run: async ({ choices }) => choices.reveal
        ? plural("DRPG.Chapter.doneReveal", { n: await revealAllBulletTypes() }) : null },
    { key: "sweep", asked: ({ choices }) => Boolean(choices.sweep), run: async ({ choices }) => choices.sweep
        ? plural("DRPG.Chapter.doneSweep", { n: (await sweepTruthBullets()).removed }) : null },
    { key: "faint", asked: ({ choices }) => Boolean(choices.faint), run: async ({ choices }) => {
        if (!choices.faint) return null;
        const { clearFaintRemnants } = await import("./remnants.mjs");
        return plural("DRPG.Chapter.doneFaint", { n: await clearFaintRemnants() });
    } },
    { key: "keys", asked: ({ choices }) => Boolean(choices.keys), run: async ({ choices, ending }) => choices.keys
        ? plural("DRPG.Chapter.doneKeys", { n: await clearChapterKeyRemnants(ending.chapter) }) : null },
    // The Cleaning Tools the chapter's clean-ups used (E32+E07 C12; cleanup.mjs
    // `noteCleaningTool`) are for its own discovery: a row the next chapter reads
    // counts nothing, and the move to it takes them all.
    { key: "tools", run: async ({ choices }) => {
        if (!choices.nextChapter) return null;
        const { clearUsedTools } = await import("./cleanup.mjs");
        await clearUsedTools();
        return null;
    } },
    /* And the chapter actually ends.

       The window is called "End of chapter / new session" and did three clean-ups without touching
       either counter - measured, the clock read Chapter 1 · Session 5 before and after, and the GM had
       to go and nudge both by hand in "Edit campaign…". Tidying up and moving on are one event at the
       table, so they are one screen here.

       OUT OF THE INVESTIGATION WITH IT (E11 C5; audit S06-13). The move wrote the counters and nothing
       else, so a chapter ended from the Investigation - a body found, the trial skipped or held
       elsewhere - opened the next session still investigating: 65-season C1 read `investigation`
       after two ends with the code before this (10.10.2026). The phase goes back to Daily Life in the same write as the counters.
       A Class Trial is not left here: `closeTrial` below does that, after the move, and only when
       the GM ticked it. */
    { key: "clock", asked: ({ choices }) => Boolean(choices.nextChapter || choices.nextSession), run: async ({ choices, ending }) => {
        /* To the ending's own targets (E42 C2, 1.2.97; E42-09): a Finish after the move landed and before the record
           said so finds nothing to move (`endMoves`), where the move read off the clock moved it a second time. */
        const clock = getClock();
        const move = endMoves(ending, choices, clock).clock;
        if (!move) return null;
        const { setClock } = await import("./clock.mjs");
        if (!(await setClock(move))) return false;
        if (move.phase) ending.stands = move.phase;
        const moved = game.i18n.format("DRPG.Chapter.moved", {
            chapter: move.chapter ?? clock.chapter,
            session: move.session ?? clock.session
        });
        return move.phase ? `${moved} ${game.i18n.localize("DRPG.Chapter.doneInvestigationOver")}` : moved;
    } },
    /* AND THE ROOM EMPTIES. AFTER THE MOVE, AND THAT ORDER IS THE POINT.

       Everything above is scoped to the chapter that is ending, so it has to run while the clock
       still says so. This one is scoped to what comes AFTER: the phase the next chapter opens in, and
       the elapsed clock that the first Daily Life of it is measured against. Closing the trial before
       the move would start that clock against a chapter that had not begun yet.

       Measured on 10.09, with the whole chapter driven end to end: this screen moved the clock to
       chapter 2 and left `phase: "classTrial"` with the debate floor open. The GM was told "The debate
       is open - Nonstop Debate." and pointed back at the trial they had just finished; every player's
       HUD read "Chapter 2 - Day 2 - Class Trial". The way out existed - one button, listed BELOW this
       screen's own on the trial console - and nothing anywhere said to press it.

       `closeTrial` answers false when its clock write threw (E10 C12): the floor is shut and nothing
       announced. That is this step failing, and the GMs are told so (tier 2 "a chapter end step that
       fails is named and no morning opens over a trial that did not close"). */
    { key: "trial", asked: ({ choices, ending }) => Boolean(choices.endTrial) && ending.phase === "classTrial", run: async ({ choices, ending }) => {
        if (!choices.endTrial || ending.phase !== "classTrial") return null;
        // A Finish after the trial closed and before the record said so (E42 C2): nothing is left to close.
        if (getClock().phase !== "classTrial") return null;
        const { closeTrial } = await import("./trial-floor-ui.mjs");
        if (!(await closeTrial())) return false;
        ending.stands = "dailyLife";
        return game.i18n.localize("DRPG.Chapter.doneEndTrial");
    } },
    /* AND THE NEXT CHAPTER OPENS THE FOLLOWING MORNING.

       This screen moved the chapter and the session and nothing else, which left the clock reading
       whatever the trial ended on. Measured across two chapters run end to end on 11.09: chapter 1
       finished at Day 1 - Night and chapter 2 opened at Day 1 - Night, with everybody's actions still
       spent from the time of day before the murder. The panel duly reported "1 student still has
       actions to spend", which was true and was a leftover.

       Murders happen at night, so this is not an edge case - it is where every chapter ends. And the
       fix is not "reset the clock": it is the next MORNING, one day on, which is the beat the table is
       actually resuming from. Actions and search tokens come back because that is what a new time of
       day does, through the same call every other advance uses rather than a second copy of the rule.

       LAST, AFTER THE TRIAL IS CLOSED. `closeTrial` puts the phase back to Daily Life and starts the
       elapsed clock; announcing a new morning before that would post the card into a Class Trial that
       has not finished.

       AND NOT AT ALL WHEN THE TRIAL DID NOT CLOSE (E11 fix r1-G5, 1.2.73; round 1's EARLY-C5-1). C5 ran
       this step after a `trial` step that had failed, so the morning was announced into the Class Trial
       still sitting, against the paragraph above: tier 2 "a chapter end step that fails is named and no
       morning opens over a trial that did not close" read the day moved on in a trial with the code
       before this (11.10.2026). It is left undone and named with the failed steps, for the GM to open by
       hand once the trial is closed. */
    { key: "morning", asked: ({ choices }) => Boolean(choices.nextMorning), run: async ({ choices, ending, failed }) => {
        if (!choices.nextMorning) return null;
        if (failed.includes("trial")) return false;
        /* The ending's day plus one, once (E42 C2, 1.2.97; E42-09): a Finish after the morning landed and before the record
           said so finds the clock on it (`endMoves`) and opens no second morning, card or day's summary. */
        const { morning } = endMoves(ending, choices, getClock());
        if (!morning) return null;
        const { setTimeOfDay } = await import("./clock.mjs");
        // One write for the day and the hour: each write is a full redraw on every client (CORE-12). Stamped for the
        // day's boards (`dayBoard`; the owner's answer of 12.11.2026: the boards play after the trial's exit here) - both
        // of them since 13.11.2026, when the end-of-day board moved to Night's start: the trial held the Night, so the day
        // it closes is stamped for its end board too (`nightBoard` on the day before the morning; transitions.mjs
        // `boardsOf`). Usually heard after the trial's close as a write of its own, so the stamp rides this one.
        await setTimeOfDay("morning", {
            resetActions: true, resetSearchTokens: true, announce: true,
            also: { day: morning.day, dayBoard: morning.day, nightBoard: morning.day - 1 }
        });
        return game.i18n.format("DRPG.Chapter.doneNextMorning", { day: getClock().day });
    } },
    // Nothing outlives its chapter. Ordinarily the trial's phase change cleared
    // this long ago; a GM who ended a chapter straight out of Daily Life would
    // otherwise carry a body card into the next one.
    { key: "hold", run: async () => {
        await clearBodyDiscovery();
        return null;
    } }
];

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
 * ONCE (E11 C5, 1.2.73; audit S06-40). Three guards, for three ways of pressing twice:
 * - `opened`, the clock the window was shown on (`endMark`): an end whose chapter,
 *   session or day has moved since - by another end, by Edit campaign, or by the
 *   time of day turning into a new day - is refused whole and the GMs are told
 *   (`endTwice`). Until 1.2.73 the window sent the chapter read when Do it was
 *   pressed and only a moved chapter was refused (CORE-17), which saw nothing when
 *   "next chapter" was unticked: 65-season C1 read two sessions on with the code
 *   before this (10.10.2026). An end whose phase alone has moved is refused too, with
 *   its own words (`endPhaseMoved`; E11 fix r2-H3, round 2's sec S3): the window offers
 *   to close a trial only when one sits, so a trial opened after it was drawn sat on
 *   under the morning - tier 2 "an End of chapter window drawn before a trial opened
 *   ends nothing" and 65-season T1 read the day moved on in the trial with the code
 *   before this (11.10.2026).
 * - one end at a time on this browser: a second call waits for the first to finish
 *   before it compares, so two in flight at once cannot both read the clock before
 *   either moves it (tier 2 "the chapter's end leaves the Investigation and counts
 *   once" starts two together).
 * - ONE BROWSER: the primary GM's (E11 fix r1-G5; round 1's COR-2). Two GMs' browsers
 *   share no queue, and the guard above compares once, before the steps: another GM's
 *   end that passed it while the primary's was running read the chapter, the session
 *   and the day again in its own steps, after the primary's move had landed, and
 *   counted them again - 65-season H1 read session 1 to 3 with the code before this
 *   (11.10.2026), the second GM's end held in its first step until the primary's move
 *   arrived (the day moved once there: both mornings read day 1 before either landed;
 *   a day counted twice would need only other timing - read in the code, not measured). So the end runs on the primary only, as the season reset
 *   does (season-wipe.mjs `resetSeason`), and another GM is told whose it is, both
 *   here and at the window (`openChapterEndDialog`, which the panel and the trial
 *   console's End the chapter open).
 *
 * @param {object} choices Which parts to do. Anything absent is not done, so a
 *   caller can ask for one step without knowing about the others. `opened` is
 *   the window's `endMark`; a call without it (the console, the suite) is not
 *   compared.
 *
 * AND NONE WHILE ONE STANDS STOPPED (E42 C2, 1.2.97; E42-10): an end that stopped part way is finished or dropped
 * first (`finishChapterEnd`); a new one is refused and the GM told which steps wait (`endStands`).
 */
export async function applyChapterEnd(choices = {}) {
    if (!game.user.isGM || !chapterEndHere()) return null;
    const run = chapterEnds.then(() => endChapterNow(choices));
    chapterEnds = run.catch(() => null);
    return run;
}

let chapterEnds = Promise.resolve();

/**
 * THE END'S RECORD GOES WITH THE SEASON (E42 C4, 1.2.97; E42-16): the season reset's clock group (season-wipe.mjs
 * `clearSeasonClock`) writes `chapterEnd` empty, in this queue like every write of it, so an end that stopped last season
 * is offered to nobody in the next one and its targets - last season's chapter, session and day - are never moved to. A
 * record already empty is not written. The reset is the primary GM's; on any other browser this throws, and the reset's
 * step says it failed.
 */
export async function clearChapterEndRecord() {
    if (!game.user.isGM || !isPrimaryGm()) throw new Error("only the primary GM's browser writes the chapter's end record");
    const run = chapterEnds.then(async () => {
        if (Object.keys(chapterEndRecord()).length) await game.settings.set(MODULE_ID, SETTINGS.chapterEnd, {});
    });
    chapterEnds = run.catch(() => null);
    return run;
}

/** Whether this browser ends the chapter: the primary GM's does; another GM is told whose (`applyChapterEnd`, ONE BROWSER). */
function chapterEndHere() {
    if (isPrimaryGm()) return true;
    const name = game.users.get(primaryGmId())?.name ?? "?";
    ui.notifications.warn(game.i18n.format("DRPG.Chapter.endPrimaryOnly", { name }));
    return false;
}

async function endChapterNow(choices) {
    /* ONE END AT A TIME, A STOPPED ONE INCLUDED (E42 C2, 1.2.97; E42-10). An end that stopped part way - a step that
       failed, the phase moved, a tab closed - stands until it is finished or dropped: a new end over it would read a
       clock the stopped one has half moved, and leave nobody able to tell what the first one did. Refused, and the GM
       told which steps wait; the window asks Finish the chapter's end or Drop the rest instead (`askStoppedEnd`). */
    const standing = chapterEndStopped();
    if (standing) {
        ui.notifications.warn(game.i18n.format("DRPG.Chapter.endStands", { steps: listOf(askedSteps(standing, false).map(stepWords)) }));
        return null;
    }

    const now = getClock();
    const { opened } = choices;
    const mark = endMark(now);
    const moved = opened ? Object.keys(mark).filter(key => opened[key] != null && opened[key] !== mark[key]) : [];
    if (moved.length) {
        const words = moved.some(key => key !== "phase")
            ? game.i18n.format("DRPG.Chapter.endTwice", opened)
            : game.i18n.format("DRPG.Chapter.endPhaseMoved", { opened: phaseLabel(opened.phase), now: phaseLabel(now.phase) });
        await whisperToGms({ tone: "warning", body: `<p>${words}</p>` });
        return null;
    }

    /* The record first, once the guards have passed (E42 C2): a tab closed at any step after this leaves an end to finish.
       NOTHING WITHOUT IT (E42 fix FG2, 03.11.2026; the end review's C-m4, STATUS Open 17): a first write that failed was
       logged and the end went on, so a step's work could land under no record, and the report then sent the GM to a
       Finish that found none. The end stops here and the GM is told nothing was done, as the season reset stops when its
       cut cannot be written (season-wipe.mjs `wipeSeason`). Tier 2 E42-T12. */
    const record = {
        stage: "applying", by: game.user.id, at: serverNow(), opened: opened ? endMark(opened) : null,
        choices: Object.fromEntries(END_CHOICES.map(key => [key, Boolean(choices[key])])),
        ending: { chapter: now.chapter, session: now.session, day: now.day ?? 1, phase: now.phase, stands: now.phase },
        done: [], failed: [], notRun: []
    };
    try {
        await game.settings.set(MODULE_ID, SETTINGS.chapterEnd, record);
    } catch (err) {
        error("Could not write the record of the chapter's end before its first step, so nothing was done", err);
        ui.notifications.error(game.i18n.format("DRPG.Chapter.endNotRecorded", { error: String(err?.message ?? err) }));
        return null;
    }
    return runChapterEnd(record);
}

/**
 * THE END'S STEPS ON THE ONE RUNNER (E42 C2, 1.2.97; E42-08, E42-09; audit S17-30). An end (`endChapterNow`) and its
 * Finish (`finishChapterEnd`) hand this the record, and CHAPTER_END_STEPS run on steps.mjs `runSteps`: a step the
 * record calls done is not run again, one the GM's choices do not ask for is kept (`asked`), and the record is written
 * after every step that changed it and once at the end - "done" when every step asked for ran, else "applying". Each
 * step reads its target from the record (`ending`), so one whose work landed and whose record did not runs as nothing
 * the second time (`endMoves`; the trial step finds no trial to close). Answers the lines the GMs' card lists, or null.
 */
async function runChapterEnd(record) {
    const context = { choices: { ...(record.choices ?? {}) }, ending: { ...record.ending }, failed: [], stopped: null };
    let written = record;
    /* THE PRIMARY'S RECORD, AND ITS END (E42 fix FG2, 03.11.2026; the end review's C-m2 = S-M2, STATUS Open 16). The end
       held the phase before every step and not primacy, and wrote its record wherever it ran: a GM with a lower id
       connecting mid-end left the old primary running every step and writing `chapterEnd` while the new primary was
       offered Finish over it, two browsers on the same steps. A write off the primary is not made now, as the season
       reset's record is not (season-wipe.mjs `writeRecord`): the new primary reads what this one wrote; and the end stops
       before its next step once this browser is no longer the primary, the steps it left named with whose browser
       finishes them. Tier 2 E42-T12. */
    const write = async next => {
        if (!isPrimaryGm() || JSON.stringify(next) === JSON.stringify(written)) return;
        await game.settings.set(MODULE_ID, SETTINGS.chapterEnd, next);
        written = next;
    };
    endRunning = true;
    let result = null, notRun = [];
    try {
        /* THE PHASE HOLDS FOR THE WHOLE LIST, NOT ONLY AT ITS FIRST STEP (E11 fix r2-J1; r2-H3's open
           road, the orchestrator's ruling of 11.10.2026). The comparison in `endChapterNow` runs once, and the reveal,
           the sweep, the Remnants and the tools await documents after it: a Class Trial another GM opened
           meanwhile got the morning over it, and an end begun in the Investigation had its clock step write
           `phase: "dailyLife"` over that trial with nothing closing it - 65-season J1 read the session
           counted, the day moved on and the phase back in Daily Life over the trial the second GM had just
           opened, and no word to the GMs, with the code before this (11.10.2026, e11run/r2j1red: session
           and day 1 to 2). So the phase is read again before every step (`stop`), against the one this end
           began on or the one its own clock and trial steps left (`ending.stands`); moved, the end stops
           there. What ran stays done and nothing is rolled back; the steps the GM asked for that did not
           run are named. The tools and the hold are never named: the tools go with the chapter's move,
           which did not run either, and any phase change takes the hold (C2). */
        result = await runSteps({
            label: "chapter's end", record, context,
            steps: CHAPTER_END_STEPS.map(step => ({
                key: step.key,
                ask: step.asked ? () => step.asked(context) : null,
                run: () => step.run(context)
            })),
            stop: () => {
                if (!isPrimaryGm()) {
                    context.stopped = { primary: primaryGmId() };
                    return true;
                }
                const phase = getClock().phase;
                if (phase === context.ending.stands) return false;
                context.stopped = { from: context.ending.stands, to: phase };
                return true;
            },
            save: async (run, { end = false } = {}) => {
                // `failed` holds the steps of this run that failed, for the morning's (it waits on a trial that did not close).
                context.failed = [...run.failed];
                if (!end) await write({ ...written, stage: "applying", ending: { ...context.ending }, done: [...run.done], failed: [...run.failed] });
            }
        });
        const asked = new Set(CHAPTER_END_STEPS.filter(step => step.asked?.(context)).map(step => step.key));
        notRun = result.notRun.filter(key => asked.has(key));
        try {
            await write({ ...written, stage: result.record.failed.length || notRun.length ? "applying" : "done", ending: { ...context.ending },
                done: [...result.record.done], failed: [...result.record.failed], notRun });
        } catch (err) {
            error("Could not write the record of the chapter's end at its end", err);
        }
    } finally {
        endRunning = false;
    }

    /* A FAILED STEP IS TOLD, the way the season reset tells one (the plan's section 3.4), in the one report of the
       three procedures (steps.mjs `stepsReport`): the GM who pressed Do it is shown which, and the GMs' card lists it
       after what was done. Since E42 C2 the words say Finish the chapter's end does the rest. The steps a phase move
       left are named with the phase; those a record that could not be written left are the failed step's, named with it. */
    const stoppedBy = !context.stopped ? null : "primary" in context.stopped
        ? { key: "DRPG.Chapter.endStoppedPrimary", data: { name: game.users.get(context.stopped.primary)?.name ?? "?" } }
        : { key: "DRPG.Chapter.endStopped", data: { opened: phaseLabel(context.stopped.from), now: phaseLabel(context.stopped.to) } };
    const report = stepsReport({ ...result, notRun: context.stopped ? notRun : [] }, {
        label: stepWords,
        groups: { failed: "DRPG.Chapter.endFailed", notRun: stoppedBy }
    });
    if (report.toast.level === "error" && report.toast.text) ui.notifications.error(report.toast.text);
    if (!result.lines.length && !report.notes.length) return null;

    await whisperToGms({
        title: game.i18n.localize("DRPG.Chapter.endTitle"), tone: report.notes.length ? "warning" : "info",
        body: `<ul>${result.lines.map(line => `<li>${line}</li>`).join("")}</ul>${report.notes.map(note => cardWarn(esc(note))).join("")}`
    });
    return result.lines.length ? result.lines : null;
}

/**
 * FINISH THE CHAPTER'S END, OR DROP THE REST (E42 C2, 1.2.97; E42-09, E42-10). On the primary GM alone (`chapterEndHere`)
 * and in `applyChapterEnd`'s queue, so one end runs at a time on the one browser that writes the record. A stopped end
 * (`chapterEndStopped`) runs on from its record: what it did is not done again, the clock's and the morning's targets
 * are its own (`endMoves`), and its `keys` step takes the Key Remnants of the chapter that was ending - a record a
 * primary left when it reloaded mid-end is finished the same way. The phase must be the one the end stands on
 * (`endHeldPhase`), or the Finish is refused and the GM told in which phase it runs (`finishPhaseMoved`).
 * `{ drop: true }` runs nothing: the record stands "dropped" and the GMs' card names what stays undone. Answers the
 * Finish's lines (null when it said nothing), the dropped steps' keys, or null. `game.drpg.finishChapterEnd()`.
 */
export async function finishChapterEnd({ drop = false } = {}) {
    if (!game.user.isGM || !chapterEndHere()) return null;
    const run = chapterEnds.then(() => finishEndNow({ drop }));
    chapterEnds = run.catch(() => null);
    return run;
}

async function finishEndNow({ drop }) {
    const record = chapterEndStopped();
    if (!record) {
        ui.notifications.warn(game.i18n.localize("DRPG.Chapter.notStopped"));
        return null;
    }
    if (drop) {
        const undone = askedSteps(record, false);
        const text = game.i18n.format("DRPG.Chapter.dropped", { steps: listOf(undone.map(stepWords)) });
        try {
            await game.settings.set(MODULE_ID, SETTINGS.chapterEnd, { ...record, stage: "dropped", notRun: undone, droppedBy: game.user.id, droppedAt: serverNow() });
        } catch (err) {
            error("Could not write the chapter's end as dropped", err);
            return null;
        }
        ui.notifications.warn(text);
        await whisperToGms({ tone: "warning", title: game.i18n.localize("DRPG.Chapter.endTitle"), body: `<p>${esc(text)}</p>` });
        return undone;
    }
    const clock = getClock();
    const stands = endHeldPhase(record, clock);
    // Its own words since E42 fix FG2 (the end review's G-F8): `endPhaseMoved` is a window's drawn on another phase, and
    // sent the GM to open End of chapter again, whose Finish was refused again.
    if (!stands) {
        ui.notifications.warn(game.i18n.format("DRPG.Chapter.finishPhaseMoved", { opened: phaseLabel(record.ending?.stands), now: phaseLabel(clock.phase) }));
        return null;
    }
    return runChapterEnd({ ...record, ending: { ...record.ending, stands } });
}

/** The End of chapter window while a stopped end stands (E42 C2; E42-10): Finish the chapter's end, Drop the rest, or Cancel, the default. */
async function askStoppedEnd(record) {
    const undone = askedSteps(record, false), earlier = askedSteps(record, true);
    const answer = await drpgWindow({
        title: game.i18n.localize("DRPG.Chapter.endTitle"),
        classes: ["drpg-panel"],
        body: `${box("warning", `<p>${esc(game.i18n.format("DRPG.Chapter.endStands", { steps: listOf(undone.map(stepWords)) }))}</p>`)}${
            earlier.length ? `<p>${esc(game.i18n.format("DRPG.Chapter.doneEarlier", { steps: listOf(earlier.map(stepWords)) }))}</p>` : ""}`,
        // Cancel the default, as before (E42 C2). Finish runs the rest of an end and Drop gives it up for good: both cannot
        // be undone (E22 rule 4), destructive, Cancel first under Enter.
        footer: {
            destructive: [{ action: "finish", label: game.i18n.localize("DRPG.Chapter.finishEnd"), tooltip: tipText("DRPG.Tips.Trial.finishTheChapterSTooltip") },
                { action: "drop", label: game.i18n.localize("DRPG.Chapter.dropRest"), tooltip: tipText("DRPG.Tips.Trial.dropTheRestTooltip") }],
            close: "cancel",
            default: "cancel"
        },
        rejectClose: false
    });
    if (answer === "finish") return finishChapterEnd();
    if (answer === "drop") return finishChapterEnd({ drop: true });
    return null;
}
