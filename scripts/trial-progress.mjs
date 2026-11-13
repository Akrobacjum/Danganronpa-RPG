/**
 * Danganronpa RPG - the trial's record, and the sentence.
 * ---------------------------------------------------------------------------
 * How far the chapter's trial has got (`trialProgress`, `trialProgressChapter`)
 * and its one write, a step of `TRIAL_PROGRESS_KEY` (`setTrialProgress`,
 * `writeTrialProgressInStep`); another GM's writes asked of the primary
 * (`askRecord`, `recordOnPrimary`), held to the record's own fields
 * (`RECORD_FIELDS`, `recordPatchOf`); the blank at a trial's entry
 * (`resetTrialProgress`, `resetInStep`) with the trial's size (`trialSizeNow`);
 * and the sentence a verdict writes down, carried out once at the trial's end
 * (`executeAtExit`, `carryOutSentence`, `postExecutionCard`), asked again when
 * it could not be (`retrySentence`), named on End the trial's question
 * (`pendingSentence`) and taken back by a season's reset (`clearSentence`).
 *
 * WHERE IT SITS. Moved out of vote.mjs by E41 C10a (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The record and the sentence
 * are one file because the primary's run of another GM's write
 * (`recordOnPrimary`) carries the sentence out and takes it back
 * (`startExecution`, `clearSentenceHere`). vote.mjs re-exports the fourteen
 * names here it exported before, so every importer still imports vote.mjs, and
 * nothing here imports it (the facade rule, .claude/rules/code.md); the vote
 * (vote.mjs) and the verdict (verdict.mjs) read and write the record here.
 *
 * THE ORDER. The sentence stands above the record and `trialSizeNow` at the
 * end. In vote.mjs `let executing` stood inside the cut of `readSentence`
 * (verdict.mjs's now), and a cut a test reads by name (tests-kit
 * `topLevelFunction`) runs on to the next function: here no function stands
 * in front of it, and each function's cut is the one it was.
 */

import { MODULE_ID, TRIAL, FLAGS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock } from "./clock.mjs";
import { actingStudents } from "./monokuma.mjs";
import { isDeceased, isDeadForGm, killCharacter, publishDeath } from "./chapter.mjs";
import { verdictStore } from "./gm-stores.mjs";
import { RECORD } from "./gm-store.mjs";
import { bridgeRequest } from "./bridge-guards.mjs";
import { judgedFor, flagsHeldNow } from "./sheet-audit.mjs";
import { runSteps } from "./steps.mjs";
// A leaf (season-exceptions.mjs alone): the registry of season state the reset walks (E42 C3).
import { registerSeasonState } from "./season-reset.mjs";
import {
    announce, whisperToGms, whisperToOwner, isPrimaryGm, log, warn, error, serialWrite, serverNow
} from "./utils.mjs";

/** A vote nobody has opened in this trial: the blank of `trialProgress().vote`. */
const blankVote = () => ({ open: false, round: 0, picks: 1, issued: [], openedAt: null, closedAt: null });

/*
 * THE SENTENCE IS CARRIED OUT WHEN THE TRIAL ENDS, ONCE (E70 C4, 28.10.2026; S18-87, the owner's DC36;
 * the plan's point (g)). The verdict killed the sentenced in its own steps ("executions", E10 C5) while
 * the trial went on around them; it writes the sentence down now (`readSentence`), and this carries it
 * out. Called on every road out of the trial - End the trial and the chapter end's "trial" step
 * (trial-floor-ui.mjs `closeTrial`, before the phase moves and the living gather at school), and
 * clock.mjs `reconcilePhase` leaving classTrial on any other road (Edit campaign, `setClock`), after
 * the floor and before the hall's move - and straight after the card of a verdict given once the trial
 * was over (`runVerdict`, a Final Trial's `applyFinalVerdict`).
 *
 * THE RECORD OF ITS OWN CHAPTER. The record is read by the chapter it is stored for
 * (`trialProgressChapter()` and the stored setting), never `trialProgress()`, which answers a blank for
 * any chapter but the clock's: the chapter end moves the clock before it closes the trial, and Edit
 * campaign moves the chapter and the phase in one write. The death, its record's chapter and the
 * execution's stamp are that chapter's.
 *
 * ONCE. `executedAt` (the server's clock) says the sentence is carried out, and every road reads it
 * first; this browser's latch holds two roads of one exit (closeTrial, then its phase write) apart.
 * Each sentenced student is read held after the audit of them (`judgedFor`, `flagsHeldNow`), as the
 * verdict's step did: one the table knows dead - killed by an exit that stopped half way, or dead
 * since - is passed over, not killed twice; the execution's own `{ done, failed }` is written after
 * each, and the stamp only when nobody failed, so the next road finishes it.
 *
 * AN EXECUTION IS PUBLIC, AND NO BODY TO FIND (E10 fix r1-G4, fix r2-G3; E11 C1, fix r1-G1, all kept).
 * A death the GMs hold is made the table's (`publishDeath`), any other killed with the death made
 * public at once (`secret: false`), each in the Class Trial's phase - so no walk past the body
 * discovers it (body.mjs `bodiesToDiscover`) - and with the cause "executed" (amend 4 (b)).
 *
 * A FINAL TRIAL'S SENTENCE IS THE GMS' (the owner's Q2 answer, 27.10.2026). The world's record says only
 * that a Final verdict's sentence waits (`sentencePending`); who is in the GMs' store (gm-stores.mjs
 * `verdictStore`, `finalSentenced` under the verdict's `finalAt`), as the Mastermind's identity is kept
 * off the world (mastermind.mjs's header).
 *
 * ON THE ONE RUNNER (E42 C1c, 1.2.97; E42-07). The loop is steps.mjs `runSteps`: a step a sentenced student, the
 * record's `{ done, failed }` written after each student it executed or failed - not after one passed over, as
 * before - then the stamp, a step the runner keeps unwritten while anybody failed (`ask`), then the card for this
 * run's executed. What the record holds, the stamp, the card, `retrySentence` and the chapter's reading of the
 * record are as they were (1:1, tier 2 E42-T3, green before and after); every student is read again on each run,
 * as before, and the runner's own record of the run is not the world's.
 *
 * Answers `{ executed, failed }` (the students' ids), or null when there is no sentence to carry out.
 */
let executing = null;

export function executeAtExit({ chapter = trialProgressChapter() } = {}) {
    if (!game.user.isGM || chapter === null || chapter === undefined) return Promise.resolve(null);
    /* ON THE PRIMARY, ONCE (E70 fix p1-G2; the review's SEC-3, E70-16). The sentence ran on whichever GM ended the
       trial, and "once" was that browser's latch: two GMs pressing End the trial within a round trip each read no
       `executedAt` and killed the convict twice, or the second wrote `failed` over the first's record. The primary
       carries it out, under its latch, whoever asks. */
    if (!isPrimaryGm()) return askRecord("execute", { chapter }, () => startExecution(chapter));
    return startExecution(chapter);
}

/** The execution under this primary's latch. */
function startExecution(chapter) {
    if (chapter === null || chapter === undefined) return Promise.resolve(null);
    if (executing) return executing;
    executing = carryOutSentence(chapter).finally(() => { executing = null; });
    return executing;
}

/*
 * A SENTENCE THAT COULD NOT BE CARRIED OUT IS TRIED AGAIN (E70 fix p1-G2; the review's BEH-2). A kill that threw left
 * `execution.failed` and no `executedAt`, and nothing asked again once the phase had moved: the convict walked into
 * Daily Life alive unless the GM remembered, and a death marked by hand carried neither the cause nor the trial's
 * phase. The primary asks again when it is ready and at every later change of phase, while the record's sentence
 * waits outside a trial (`pendingSentence`'s reading).
 */
export async function retrySentence() {
    if (!game.user?.isGM || !isPrimaryGm() || getClock().phase === "classTrial") return null;
    const chapter = trialProgressChapter();
    if (chapter === null) return null;
    const record = trialProgress(chapter);
    if (record.executedAt || !record.execution?.failed?.length) return null;
    return startExecution(chapter);
}

/** The Final verdicts (`at`) whose missing sentence this browser has told the GMs of, once each. */
const missingSaid = new Set();

/** The ids a verdict of `record` sentenced, or null when it has not sentenced anybody yet. */
async function sentenceOf(record) {
    const verdict = record?.verdict;
    if (!verdict) return null;
    if (verdict.final) {
        if (!verdict.sentencePending) return null;
        await verdictStore.whenHydrated();
        const kept = verdictStore.record();
        if (kept.finalAt === verdict.at && Array.isArray(kept.finalSentenced)) return [...kept.finalSentenced];
        /* THE GMS' SENTENCE NOT HERE (E70 fix p1-G2; the review's E70P1-R10 = E70P1-R06 goal). The record says a Final
           sentence waits and this GM's store holds none for it - another browser, cleared site data. Said to the GMs,
           not passed over in silence: the store is backed up since the fix (gm-stores.mjs `verdictStore`). */
        if (!missingSaid.has(verdict.at)) {
            missingSaid.add(verdict.at);
            whisperToGms(`<p>${game.i18n.localize("DRPG.Vote.finalSentenceMissing")}</p>`);
        }
        return null;
    }
    if (!Array.isArray(verdict.done) || !verdict.done.includes("sentence")) return null;
    return [...(verdict.sentenced ?? verdict.executedIds ?? [])];
}

async function carryOutSentence(chapter) {
    if (trialProgressChapter() !== chapter) return null;
    const record = trialProgress(chapter);
    if (record.executedAt) return null;
    const ids = await sentenceOf(record);
    if (!ids) return null;
    const done = [...(record.execution?.done ?? [])], failed = [], executed = [], passed = new Set();
    const STAMP = "executedAt";
    await runSteps({
        label: "execution",
        steps: [...ids.map(id => game.actors.get(id)).filter(Boolean).map(actor => ({ key: actor.id, run: async () => {
            await judgedFor(actor.id);
            const held = flagsHeldNow(actor);
            if (isDeceased(held)) {
                passed.add(actor.id);
                return null;
            }
            let died = null;
            try {
                died = isDeadForGm(held)
                    ? await publishDeath(actor, { phase: "classTrial", cause: "executed" })
                    : await killCharacter(actor, { secret: false, phase: "classTrial", cause: "executed", chapter });
            } catch (err) {
                error(`${actor.name} could not be executed`, err);
            }
            if (died) {
                executed.push(actor);
                if (!done.includes(actor.id)) done.push(actor.id);
                return null;
            }
            failed.push(actor.id);
            return false;
        } })), {
            // The stamp only when nobody failed: the next road finishes it (`retrySentence`).
            key: STAMP, ask: () => !failed.length,
            run: () => writeExecution(chapter, now => (now.executedAt ? null : { executedAt: serverNow() })).then(() => null)
        }],
        save: (run, { key, end = false } = {}) => (end || key === STAMP || passed.has(key) ? null
            : writeExecution(chapter, { execution: { done: [...done], failed: [...failed] } }))
    });
    if (executed.length) await postExecutionCard(executed);
    if (failed.length) {
        const names = failed.map(id => foundry.utils.escapeHTML(game.actors.get(id)?.name ?? "?")).join(", ");
        ui.notifications.error(game.i18n.format("DRPG.Vote.executionFailed", { names }));
    }
    log(`The sentence of chapter ${chapter}'s trial: ${executed.length} executed, ${failed.length} not.`);
    return { executed: executed.map(actor => actor.id), failed };
}

/** A write of the record of `chapter`'s trial, in a step of its key (E70 C0), stamped with that chapter. */
function writeExecution(chapter, patch) {
    return serialWrite(TRIAL_PROGRESS_KEY, () => writeTrialProgressInStep(patch, { chapter }));
}

/** The sentence carried out, as lines for the verdict's summary to the GMs (`runVerdict`). */
export async function executionLines() {
    const done = await executeAtExit();
    return (done?.executed ?? []).map(id => game.i18n.format("DRPG.Vote.wasExecuted", {
        name: foundry.utils.escapeHTML(game.actors.get(id)?.name ?? "?")
    }));
}

/*
 * THE EXECUTION, TOLD TO THE TABLE (E70 C4; amend 0's sound rule). The verdict's card said who was
 * executed, with the death's sound, and its owner was told in the second person (E10 C5); both come
 * here, to the moment it happens, with the execution's own sound (`SFX_EVENTS.execution`).
 *
 * THE FINAL TRIAL'S TOO (E72 C11, 12.11.2026; the owner's D102 of 31.10). Until C11 a Final Trial's
 * execution posted no card, only the sound: its banner was the Mastermind's defeat, already told, and a
 * card naming who died was held to name the Mastermind to every console. The owner's D102 reads the other
 * way - the execution is the table's to see, in the Final Trial as in any - so the same card is posted,
 * naming the executed. The defeat's banner names nobody ("THE MASTERMIND IS DEFEATED"), so this card is
 * where the table reads the name of the student the Final verdict sentenced. Whether the owner wants the
 * card without the name is asked in STATUS (default: the name, as an ordinary trial's card).
 */
async function postExecutionCard(executed) {
    const esc = foundry.utils.escapeHTML;
    try {
        await announce({
            flags: { [MODULE_ID]: { executionCard: true, sfx: { key: "execution", gm: true } } },
            content: `<div class="drpg-evidence-card">
                <div class="drpg-objection-banner">${game.i18n.localize("DRPG.Vote.executionCardTitle")}</div>
                ${executed.map(actor => `<p>${game.i18n.format("DRPG.Vote.wasExecuted", { name: esc(actor.name) })}</p>`).join("")}
            </div>`
        });
    } catch (err) {
        error("Could not tell the table of the execution", err);
    }
    for (const actor of executed) {
        try {
            await whisperToOwner(actor, `<p>${game.i18n.format("DRPG.Vote.executedNote", { name: esc(actor.name) })}</p>`);
        } catch (err) {
            error(`Could not tell ${actor.name}'s player of the execution`, err);
        }
    }
}

/**
 * The students a verdict of this trial has sentenced and the trial's end has not yet executed, as the
 * GM's End the trial question names them (trial-floor-ui.mjs `endClassTrial`). GM-side: a Final
 * Trial's sentence is read off the GMs' store.
 */
export async function pendingSentence() {
    if (!game.user.isGM) return [];
    const chapter = trialProgressChapter();
    if (chapter === null) return [];
    const record = trialProgress(chapter);
    if (record.executedAt) return [];
    const ids = await sentenceOf(record) ?? [];
    return ids.map(id => game.actors.get(id)).filter(actor => actor && !isDeceased(actor));
}

/*
 * THE SEASON'S RESET TAKES THE SENTENCE BACK FIRST (E70 C4). Its clock step puts the phase back to Daily
 * Life, and a trial left with a verdict would be ended by it - the sentence carried out on a student its
 * "deaths" step had just brought back, in a season that is over. Called before that write
 * (season-wipe.mjs `wipeSeason`), whatever groups were ticked: the record of the trial's chapter loses
 * its sentence, and a Final Trial's waits no longer.
 */
export async function clearSentence() {
    if (!game.user.isGM) return null;
    if (!isPrimaryGm()) return askRecord("clearSentence", {}, () => clearSentenceHere());
    return clearSentenceHere();
}

/** `clearSentence`'s writes, on the primary. */
async function clearSentenceHere() {
    const chapter = trialProgressChapter();
    if (chapter !== null) {
        await writeExecution(chapter, now => (now.verdict
            ? { verdict: { ...now.verdict, sentenced: [], executedIds: [], sentencePending: false } } : null));
    }
    try {
        await verdictStore.whenHydrated();
        if (verdictStore.record().finalSentenced?.length) await verdictStore.patch(RECORD, { finalSentenced: [] });
    } catch (err) {
        error("Could not take back the Final Trial's sentence", err);
    }
    return true;
}

/**
 * The season reset's trialProgress group (E42 C3; a run of season-setup.mjs `wipeSeason` until then): the trial's
 * record written empty in a step of its key (E70 C0; tier 0 R991, R1020), so a vote's step on its way is not written
 * over with last season's record after the reset. Raw, as before. The sentence waiting at a running trial's way out
 * is taken back by the clock's step (season-wipe.mjs `clearSeasonClock`, `clearSentence`), whichever groups were
 * ticked.
 */
export async function clearSeasonTrialRecord() {
    await serialWrite(TRIAL_PROGRESS_KEY, () => game.settings.set(MODULE_ID, SETTINGS.trialProgress, {}));
}

registerSeasonState({ group: "trialProgress", clear: clearSeasonTrialRecord, settings: [SETTINGS.trialProgress] });

/* ==========================================================================
 * HOW FAR THROUGH THE TRIAL THE TABLE HAS GOT
 * --------------------------------------------------------------------------
 * Three of the trial's steps only make sense in order - you cannot deliver a
 * verdict on a vote nobody has counted, and the chapter does not end before the
 * verdict is applied - and until now nothing anywhere knew which of them had
 * happened. The GM's console offered all three at once, and the destructive one
 * (a verdict executes people and hands out level-ups) was as pressable on an
 * empty trial as on a finished one.
 *
 * The two writers are both in this file, which is why the record lives here
 * rather than with the floor: `runVoteOp`, on the primary GM, is the only thing
 * that opens a vote or produces a count, and `applyVerdict` the only thing that
 * acts on one. The Final Trial's verdict (verdict.mjs `applyFinalVerdict`)
 * closes the record too since E10 C10, without acting on the vote: a record of
 * `{ stage: "done", final: true }` that names nobody.
 * ========================================================================== */

/*
 * THE RECORD'S FIELDS, ONE TABLE (E42 C4, 1.2.97; E42-17; the plan's amend of 11.10 (E70): "the registry covers E70's
 * fields ... with a lifetime tag, instead of hand entries in `resetTrialProgress`"). Each field of the record: how long
 * it lives - `lives` "chapter" (a second trial in the chapter, D17, keeps it) or "trial" (a trial's entry writes it) -
 * who writes it (`by`), its value in the blank (`blank`, made fresh each time; a field with none is in no blank) and
 * what a trial's entry writes (`atEntry(now, { seconds })`, a trial's field's, over the record as the entry's step finds
 * it). Until C4 the blank below, the entry's patch (`resetInStep`, twenty fields by hand) and the whitelist of another
 * GM's patch (`RECORD_FIELDS`, the blank's keys less `RECORD_KEPT`) were three lists kept in step by reading; they derive
 * from this now, each as 1.2.96 held it (tier 0 R1257 quotes all three). A field E73 adds is a row here.
 */
/** A value made fresh at every read: an array or an object is never shared between two records. */
const fresh = value => () => (value !== null && typeof value === "object" ? foundry.utils.deepClone(value) : value);
const row = fields => Object.freeze(fields);
export const TRIAL_RECORD = Object.freeze({
    chapter: row({ lives: "chapter", by: "every write: the step stamps the chapter it is about (`writeTrialProgressInStep`)",
        blank: ({ chapter }) => chapter }),
    seconds: row({ lives: "trial", by: "the entry; trial-floor-ui.mjs `openDebate` (the debate's budget)",
        blank: () => TRIAL.speakSeconds, atEntry: (now, { seconds }) => seconds }),
    voteClosed: row({ lives: "trial", by: "vote.mjs `openRound`, `closeRound`", blank: fresh(false), atEntry: fresh(false) }),
    verdictApplied: row({ lives: "trial", by: "verdict.mjs `applyVerdict`, `giveFinalVerdict`", blank: fresh(false), atEntry: fresh(false) }),
    // The Key fee is the chapter's (E09 C7): a second trial in the chapter does not charge it again.
    keysCharged: row({ lives: "chapter", by: "investigation.mjs `chargeForUnfoundKeys`", blank: fresh(false) }),
    tied: row({ lives: "trial", by: "vote.mjs `openRound`, `closeRound`", blank: fresh(false), atEntry: fresh(false) }),
    majority: row({ lives: "trial", by: "vote.mjs `openRound`, `closeRound`", blank: fresh(0), atEntry: fresh(0) }),
    noMajority: row({ lives: "trial", by: "vote.mjs `openRound`, `closeRound`", blank: fresh(false), atEntry: fresh(false) }),
    // The vote's round is kept across a chapter's trials (E10 C1): a ballot of the first trial is of an older round.
    vote: row({ lives: "trial", by: "vote.mjs (the round's steps: open, ballots, close)", blank: () => blankVote(),
        atEntry: now => ({ ...blankVote(), round: now.vote.round }) }),
    accused: row({ lives: "trial", by: "vote.mjs `openRound`, `closeRound`", blank: fresh([]), atEntry: fresh([]) }),
    total: row({ lives: "trial", by: "vote.mjs `openRound`, `closeRound`", blank: fresh(0), atEntry: fresh(0) }),
    accusedIds: row({ lives: "trial", by: "vote.mjs `openRound`, `closeRound`", blank: fresh([]), atEntry: fresh([]) }),
    verdict: row({ lives: "trial", by: "verdict.mjs (the verdict's runner and the Final verdict's)", blank: fresh(null), atEntry: fresh(null) }),
    // E70 C2: the Objections' receipts, by card, kept for the chapter (D17).
    objections: row({ lives: "chapter", by: "trial.mjs `keepReceipt`, `dropReceipt`; trial-floor.mjs `overruleInStep`", blank: fresh({}) }),
    // The trial's own stamp on the server's clock, which tells this trial's receipts from an earlier one's (E70 C2).
    trialStartedAt: row({ lives: "trial", by: "the entry", blank: fresh(null), atEntry: () => serverNow() }),
    againAfterOverrule: row({ lives: "trial", by: "trial-floor.mjs `overruleInStep`, `startFloorInStep`", blank: fresh(null), atEntry: fresh(null) }),
    // E70 C3: the debate's question, the debate again, the vote's first opening and the trial's size (N of 270 x N/16).
    topic: row({ lives: "trial", by: "trial-floor-ui.mjs `openDebate`", blank: fresh(null), atEntry: fresh(null) }),
    debateAgain: row({ lives: "trial", by: "trial-floor.mjs `commitFloor`, `startFloorInStep`", blank: fresh(false), atEntry: fresh(false) }),
    voteOpenedAt: row({ lives: "trial", by: "vote.mjs `openRound`", blank: fresh(null), atEntry: fresh(null) }),
    trialSize: row({ lives: "trial", by: "the entry; voice.mjs `settleTrialVoices`", blank: fresh(0), atEntry: () => trialSizeNow() }),
    // E70 C4 (DC36): the chapter's newest verdict's stamp, which a Monocub's case reads for the chapter.
    lastVerdictAt: row({ lives: "chapter", by: "verdict.mjs `readSentence`", blank: fresh(null) }),
    executedAt: row({ lives: "trial", by: "`carryOutSentence` (the execution at the trial's end)", blank: fresh(null), atEntry: fresh(null) }),
    execution: row({ lives: "trial", by: "`carryOutSentence` (the execution at the trial's end)", blank: fresh(null), atEntry: fresh(null) }),
    // E70 C8: the trial's Closing Argument, one per trial.
    closing: row({ lives: "trial", by: "trial-floor.mjs `commitFloor`", blank: fresh(null), atEntry: fresh(null) }),
    // E73: the zone modes' Findings, the trial's own list (C6), and the last Straw Poll's count, whose split makes Scrum
    // Debate the next step (C3).
    findings: row({ lives: "trial", by: "trial-zones.mjs `afterZoneStep`, `editFinding`", blank: fresh([]), atEntry: fresh([]) }),
    strawPoll: row({ lives: "trial", by: "trial-zones.mjs `afterZoneStep`", blank: fresh(null), atEntry: fresh(null) }),
    // E99 C7 (Q-E99-9: once per trial): when this trial's case summary went out, a time and nothing of its content; a
    // second trial in the chapter starts with none, so it has a summary of its own.
    summaryShown: row({ lives: "trial", by: "case-summary.mjs `showCaseSummary`", blank: fresh(null), atEntry: fresh(null) }),
    // E70 C5: the trial's list of the dead, written by the settle alone and taken out at the exit - in no blank, and
    // left by the entry (the settle that follows it writes it).
    mutedDead: row({ lives: "trial", by: "voice.mjs `settleTrialVoices`" })
});

/**
 * What a table of the record's fields gets wrong (`TRIAL_RECORD`'s shape), a sentence per fault, [] for none: a field
 * with no lifetime, one with nobody named as its writer, a chapter's field a trial's entry writes, a trial's field in
 * the blank the entry leaves, and a field the entry writes that is in no blank. Pure; tier 0 R1257.
 */
export function trialRecordProblems(table = TRIAL_RECORD) {
    const out = [];
    for (const [key, field] of Object.entries(table ?? {})) {
        if (!["chapter", "trial"].includes(field?.lives)) {
            out.push(`${key}: no lifetime`);
            continue;
        }
        if (typeof field.by !== "string" || !field.by) out.push(`${key}: nobody is named as its writer`);
        const inBlank = typeof field.blank === "function", atEntry = typeof field.atEntry === "function";
        if (field.lives === "chapter" && atEntry) out.push(`${key}: the chapter's, and a trial's entry writes it`);
        if (field.lives === "trial" && inBlank && !atEntry) out.push(`${key}: the trial's, and a trial's entry leaves it`);
        if (atEntry && !inBlank) out.push(`${key}: written at a trial's entry, and in no blank`);
    }
    return out;
}

/** What a trial's entry writes over `now`, the record as its step finds it: every trial's field of `TRIAL_RECORD`. */
export function entryPatch(now, { seconds = TRIAL.speakSeconds } = {}) {
    return Object.fromEntries(Object.entries(TRIAL_RECORD).filter(([, field]) => typeof field.atEntry === "function")
        .map(([key, field]) => [key, field.atEntry(now, { seconds })]));
}

/**
 * THE TRIAL'S FINDINGS ON A CARD (E73 C6; the plan's "Findings are on the vote's opening card"): the record's list
 * (`findings`, `TRIAL_RECORD`), one line each - its text, the mode that made it, "Monokuma confirms" when a GM confirmed
 * it - as markup for a public card, every word escaped; "" with none. Read by vote.mjs `openRound` and the GM's window.
 */
export function findingsHtml(findings = []) {
    const list = (Array.isArray(findings) ? findings : []).filter(f => f && typeof f.text === "string" && f.text);
    if (!list.length) return "";
    const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
    const line = f => `<li data-drpg-finding="${esc(f.id ?? "")}">${esc(f.text)}${f.mode ? ` <small>(${esc(game.i18n.localize(`DRPG.Floor.mode.${f.mode}`))})</small>` : ""}${
        f.confirmed ? ` <strong>${esc(game.i18n.localize("DRPG.Zones.findings.confirmedMark"))}</strong>` : ""}</li>`;
    return `<div class="drpg-findings"><p><strong>${esc(game.i18n.localize("DRPG.Zones.findings.title"))}</strong></p><ul>${list.map(line).join("")}</ul></div>`;
}

/**
 * What has happened in THIS chapter's trial. Never throws; never null.
 *
 * `chapter` names another chapter's (E10 fix r2-G5, 1.2.71; round 2's cor m3): Edit campaign moving
 * the clock back to a chapter and into its trial in one write blanks THAT chapter's record, so its
 * question has to read the record of the chapter it is moving to, not the one on the clock.
 *
 * @param {number} [chapter]  the clock's when not given.
 */
export function trialProgress(chapter = getClock().chapter) {
    /* `keysCharged` IS IN THE BLANK because it is in the record. It was not, so a
       chapter that had charged for its unfound Key Remnants held five fields and a
       fresh one held four - the same record in two shapes, differing in a field whose
       whole job is to be read by somebody deciding whether to move Despair. Reading
       `undefined` happened to be falsy and therefore happened to be right, which is
       the kind of correctness that stops being correct the first time anyone writes
       `!== false`. The vote's fields are in it for the same reason (E10 C1), and
       `vote` is merged one level down, so a record written before 1.2.71 reads a
       closed vote of round 0 rather than a `vote` that is not there. Every field
       with a blank in `TRIAL_RECORD` is here, in its order (E42 C4). */
    const blank = Object.fromEntries(Object.entries(TRIAL_RECORD).filter(([, field]) => typeof field.blank === "function")
        .map(([key, field]) => [key, field.blank({ chapter })]));
    try {
        const stored = game.settings.get(MODULE_ID, SETTINGS.trialProgress) ?? {};
        // A record from another chapter describes another trial. Read as blank
        // rather than migrated: the alternative is a fresh trial that thinks
        // its vote is already in.
        if (stored.chapter !== chapter) return blank;
        return { ...blank, ...stored, vote: { ...blank.vote, ...(stored.vote ?? {}) } };
    } catch {
        return blank;
    }
}

/**
 * Which chapter the STORED trial record is about, or null if there is none.
 *
 * `trialProgress()` deliberately answers blank for a record from another chapter -
 * a fresh trial must not think its vote is already in. That is right for every
 * reader but one: the GM panel needs to spot a trial still sitting for a chapter
 * that has already been ended, and the blank is exactly what hides it.
 */
export function trialProgressChapter() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.trialProgress)?.chapter ?? null;
    } catch {
        return null;
    }
}

/**
 * The record's key in this browser's queue (utils.mjs `serialWrite`; E70 C0, 27.10.2026, amend 5 (d)). Every write of
 * the record is a step of it, read and written in the same step: two writes begun within a server round trip each
 * spread their patch over the record they read, and the second dropped the first's field (tier 2 E70-T1 at e2085d7b:
 * of two fields written together one was left).
 */
export const TRIAL_PROGRESS_KEY = "trial.progress";

/**
 * Amend the record. GM only, and always stamped with the chapter it is about.
 *
 * `patch` is the fields to write, or a function handed the record as its step finds it that answers them (null:
 * nothing is written). A caller that builds its patch from a record it read earlier - a list it adds to, a vote it
 * closes - passes the function, or a write that landed between its read and its step is written over.
 *
 * A step never calls this (it would wait for its own key): the step's work is `writeTrialProgressInStep`, which a step of
 * this key in another file calls (voice.mjs `settleTrialVoices`, E70 C5).
 */
export function setTrialProgress(patch = {}) {
    if (!game.user.isGM) return Promise.resolve(null);
    if (typeof patch !== "function" && !isPrimaryGm()) return askRecord("patch", { patch }, () => recordOnPrimary("patch", { patch }));
    return serialWrite(TRIAL_PROGRESS_KEY, () => writeTrialProgressInStep(patch));
}

/*
 * THE RECORD'S WRITES OF ANOTHER GM, ON THE PRIMARY (E70 fix p1-G2, 28.10.2026; the review's SEC-4 = E70P1-R05 =
 * E70P1-R03, E70-01). The record's key is one queue per browser: a GM that is not the primary wrote the verdict, the
 * debate's question, the reset at the entry or the execution in its own queue, from its own copy of the record, while
 * the primary wrote the trial's list or a receipt in its queue - and whichever write landed second dropped the other's
 * field (a world setting is one value). Every such write is the primary's now: an object patch, the reset, the
 * execution and the season's taking back of the sentence are asked of it by the GMs' row "trial.record", and run there
 * in its one queue, each patch spread over the record as the primary's step finds it. A patch's fields are held to
 * the record's own (`RECORD_FIELDS`): the list of the dead and the receipts are the primary's own steps', never a
 * patch's. A function patch is a step's own (the vote's, the floor's, a receipt's), which run on the primary already.
 * An answer that does not come (the primary left mid-request) writes the patch here, as before the fix, and says so in
 * the log; the reset and the execution are not done twice that way.
 */
// E70 C8: the Closing's record is the floor's step's alone, never another GM's patch.
const RECORD_KEPT = new Set(["chapter", "mutedDead", "objections", "closing"]);
export const RECORD_FIELDS = Object.freeze(Object.keys(trialProgress(0)).filter(key => !RECORD_KEPT.has(key)));

/** A record patch of another GM, held to the record's own fields; null when it names none. */
export function recordPatchOf(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
    const out = Object.fromEntries(Object.entries(patch).filter(([key]) => RECORD_FIELDS.includes(key)));
    return Object.keys(out).length ? out : null;
}

/** Ask the primary GM for one of the record's writes (the GMs' row "trial.record"), or run it here on the primary. */
async function askRecord(op, fields, local) {
    const res = await bridgeRequest("trial.record", { op, ...fields }, { settle: "reply", onPrimary: true, local });
    if (res.ok) return res.value ?? null;
    if (op === "patch" && !res.refused) {
        warn(`The primary GM did not answer a write of the trial's record; written here: ${Object.keys(fields.patch ?? {}).join(", ")}`);
        return serialWrite(TRIAL_PROGRESS_KEY, () => writeTrialProgressInStep(fields.patch));
    }
    return null;
}

/**
 * The run of "trial.record" on the primary (bridge-runs-records.mjs `handleTrialRecord`), and this primary's own road: `patch`
 * (held to `RECORD_FIELDS`), `reset` (`resetTrialProgress`'s fields), `execute` (`executeAtExit` of `chapter`) and
 * `clearSentence`. Answers what the write answers, or null.
 */
export async function recordOnPrimary(op, { patch = null, seconds = TRIAL.speakSeconds, chapter = null } = {}) {
    if (!game.user.isGM || !isPrimaryGm()) return null;
    if (op === "patch") {
        const held = recordPatchOf(patch);
        return held ? serialWrite(TRIAL_PROGRESS_KEY, () => writeTrialProgressInStep(held)) : null;
    }
    if (op === "reset") return resetInStep(Number(seconds) || TRIAL.speakSeconds);
    if (op === "execute") return startExecution(Number.isFinite(Number(chapter)) && chapter !== null ? Number(chapter) : trialProgressChapter());
    if (op === "clearSentence") return clearSentenceHere();
    return null;
}

export async function writeTrialProgressInStep(patch, { chapter = null } = {}) {
    /* THE RECORD OF ITS OWN CHAPTER (E70 C4): the execution at the trial's end writes the record of the trial it ends,
       which the chapter's end has already moved the clock past (chapter.mjs `CHAPTER_END_STEPS`: "clock" before
       "trial") and Edit campaign moves in the same write as the phase. With `chapter`, the step writes only a record
       stored for that chapter, and stamps it with that chapter, never the clock's. */
    if (chapter !== null && trialProgressChapter() !== chapter) return null;
    const before = trialProgress(chapter ?? getClock().chapter);
    const change = typeof patch === "function" ? patch(before) : patch;
    if (!change) return null;
    const next = { ...before, ...change, chapter: chapter ?? getClock().chapter };
    // A field patched to `undefined` leaves the record (E70 C5: the trial's list of the dead at the exit, which world data
    // may hold only in a Class Trial - world-secrets.mjs).
    for (const [key, value] of Object.entries(change)) if (value === undefined) delete next[key];
    try {
        await game.settings.set(MODULE_ID, SETTINGS.trialProgress, next);
    } catch (err) {
        error("Could not record how far the trial has got", err);
    }
    return next;
}

/** A trial is starting: nothing has happened in it yet. */
export async function resetTrialProgress({ seconds = TRIAL.speakSeconds } = {}) {
    if (!game.user.isGM) return null;
    // The primary's write, asked of it from any other GM (fix p1-G2, above `RECORD_FIELDS`).
    if (!isPrimaryGm()) return askRecord("reset", { seconds }, () => resetInStep(seconds));
    return resetInStep(seconds);
}

/** `resetTrialProgress`'s write, on the primary. */
function resetInStep(seconds) {
    // `tied` goes with them: a trial re-opened in the same chapter must not
    // inherit the previous vote's tie and quietly default its verdict to wrong.
    //
    // AND THE VOTE, BUT NOT ITS ROUND (E10 C1). A second trial in the chapter
    // (D17) starts with no vote open, nobody handed a ballot and nobody accused,
    // and numbers its first vote after the last one: a ballot of the first trial
    // is of an older round, so no count of the second can read it. `keysCharged`
    // is not named, so the merge keeps it - the Key fee is the chapter's (E09 C7).
    // The round as the record's step finds it (E70 C0).
    // THE TRIAL'S STAMP (E70 C2): on the server's clock, at the trial's entry - the only road here (clock.mjs
    // `reconcilePhase`). The Objections' receipts are the chapter's and stay; an Overrule reads only this trial's.
    // THE TRIAL'S OWN FIELDS (E70 C3; amend (i)): the question, the debate again, the vote's opening, and the size
    // the guide's budget scales by - the players with a living student at the table as the trial starts (the
    // ballot's count, `trialParticipants`), read in the step. A second trial in the chapter (D17) starts without the
    // first one's; tier 0 R1032 holds the list.
    // THE PATCH IS THE TABLE'S (E42 C4): every trial's field of `TRIAL_RECORD`, as its `atEntry` writes it over the
    // record the step finds - the twenty fields this wrote by hand until then (tier 0 R1257 quotes them).
    return setTrialProgress(now => entryPatch(now, { seconds }));
}

/**
 * THE TRIAL'S SIZE, N OF THE GUIDE'S 270 x N/16 (E70 fix p1-G2; the review's E70P1-R08 goal). It was the ballot's
 * count at the entry (`trialParticipants`), which seats only CONNECTED players: a trial opened before the players had
 * reconnected read "5 of 34 min" all trial. Every player account that holds a student who takes part, whatever its
 * connection - no Monocub, nobody dead as the GMs hold the flag, nobody on the trial's list (`listed`, which the
 * primary writes after the reset; its settle counts again then, voice.mjs `settleTrialVoices`). A number, and the list
 * is public in the trial anyway (TR30).
 */
export function trialSizeNow(listed = []) {
    const seated = new Set();
    // The one cast (monokuma.mjs `actingStudents`, E37 C2), by this count's rule; filtered again below as before.
    const out = actor => isDeceased(flagsHeldNow(actor)) || listed.includes(actor.id);
    for (const actor of actingStudents({ dead: out })) {
        const held = flagsHeldNow(actor);
        if (held.getFlag(MODULE_ID, FLAGS.monocub) || isDeceased(held) || listed.includes(actor.id)) continue;
        const user = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
        if (user) seated.add(user.id);
    }
    return seated.size;
}
