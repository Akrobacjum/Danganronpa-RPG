/**
 * Danganronpa RPG - the verdict.
 * ---------------------------------------------------------------------------
 * The ordinary verdict, as E70 left it: its window (`openVerdictDialog`, its
 * form read back by `read`, the rule a wrong verdict's Blackened picks:
 * `askBlackenedRule`), its one lock on this browser (`verdictRunning`), its
 * apply (`applyVerdict`, `keepVerdictBlackened`), its steps (`VERDICT_STEPS`,
 * `VERDICT_NEEDS`, `VERDICT_STEP`) and their runner (`runVerdict`, with
 * `verdictReading`, `verdictHeld` and `readSentence`), its public card
 * (`postVerdictCard`, `verdictCard`, `verdictCardPosted`), what a verdict hands
 * out (`verdictLevelUps`, `verdictOffers`, `verdictDespair`, `verdictRule`,
 * `verdictOverflow`, `promptAdvancements`), and a verdict stopped half way and
 * finished (`verdictStopped`, `verdictRunner`, `finishVerdict`). The sentence
 * it writes down is carried out at the trial's end by trial-progress.mjs
 * (`executeAtExit`).
 *
 * ON THE ONE RUNNER (E42 C1c, 1.2.97; audit S17-30). Both verdicts are tables
 * of steps run by steps.mjs `runSteps` - the ordinary verdict's
 * (`VERDICT_STEPS`, as E70 left them) and the Final Trial's
 * (`FINAL_VERDICT_STEPS`) - over the world's record, and one Finish
 * (`finishVerdict`) finishes either; the GMs' summary is `stepsReport`'s.
 *
 * WHERE IT SITS. Moved out of vote.mjs by E41 C10a (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. It reads the trial's record
 * from trial-progress.mjs, and reaches the Final Trial's window in
 * mastermind.mjs by `import()`, as it did in vote.mjs. vote.mjs re-exports the
 * six names here it exported before, so every importer still imports vote.mjs,
 * and nothing here imports it (the facade rule, .claude/rules/code.md).
 */

import { MODULE_ID, TRIAL } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { studentActors } from "./monokuma.mjs";
import { monokumas, fillAllDespair, poolLabel } from "./despair.mjs";
import { isDeceased, isDeadForGm, livingStudentsForGm } from "./chapter.mjs";
import { trialBlackenedIds, trialBlackenedActors, whenTrialReadable } from "./murder.mjs";
import { deferredOfferStore, verdictStore } from "./gm-stores.mjs";
import { RECORD } from "./gm-store.mjs";
import { judgedFor, flagsHeldNow } from "./sheet-audit.mjs";
import { announce, dialogContent, whisperToGms, primaryGmId, log, warn, error, plural, listOf } from "./utils.mjs";
import { trialProgress, setTrialProgress, executionLines, executeAtExit } from "./trial-progress.mjs";
import { runSteps, stepsReport } from "./steps.mjs";
// The kit's frame for the Final Trial's verdict (E22 C3b): the Mastermind's case's one irreversible window. The trial's
// own windows above are C4's.
import { drpgWindow } from "./ui-kit.mjs";

const DialogV2 = foundry.applications.api.DialogV2;

/* ==========================================================================
 * CONSEQUENCES
 * ========================================================================== */

/**
 * Apply what the verdict costs.
 *
 * The module knows who killed now - every incident that left a body wrote its
 * killer into the chapter's register - so this no longer asks a GM to name the
 * Blackened from memory an hour after the fact. It asks the one thing only a
 * human can answer: did the table get it right.
 *
 * A tie counts as getting it wrong (guide p. 31), which is why the verdict is
 * still a button rather than something read off the tally.
 *
 * The register CAN be empty: a chapter whose killing was never run through the
 * incident engine, or a world upgraded mid-chapter. Then this falls back to the
 * pair of dropdowns it always had, and nothing is lost.
 */
export async function openVerdictDialog() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return null;
    }

    /* A FINAL TRIAL'S VERDICT IS THE MASTERMIND'S WINDOW, ON EVERY ROAD (E10 fix r2-G5, 1.2.71; round
       2's cor m2). C10 sent the console's button to `openFinalVerdictDialog`, and this function - which is
       also `game.drpg.verdictDialog` - still opened the ordinary verdict in a Final Trial: executions,
       Level Ups, Despair and a rule the guide does not give it, with the Final Trial's flag left up
       (tier 2 "the verdict's API in a Final Trial opens the Final Trial's window", red at c494855). The
       console keeps its own line, which R321 reads; R340 reads this one. Imported when asked, as the
       console imports it. The Final Trial's window is this file's since E41 C10b; the Mastermind's state is read from
       mastermind.mjs by `import()`, which re-exports the window (the facade rule's named exception). */
    const { inFinalTrial } = await import("./mastermind.mjs");
    if (inFinalTrial()) return openFinalVerdictDialog();

    // ONE VERDICT PER TRIAL (17.09, F2). The trial console kept this button live after
    // the verdict, and nothing here or in `applyVerdict` asked - a second press executed
    // whoever the dropdown held, refilled every Despair pool and opened a second round of
    // Level Ups. The console now disables it too; this is the boundary for every other
    // way in. Since E41 C10b the one lock of both verdicts, which also refuses while a
    // verdict is being given on this browser (`verdictRefusal`).
    const refused = verdictRefusal();
    if (refused) {
        ui.notifications.warn(game.i18n.localize(refused));
        return null;
    }

    // The trial's Blackened, not the register whole (E05 fix r2-G1): a killer whose every
    // victim is still a death nobody has found is neither executed nor rewarded here. Read once
    // the stores hold the other GMs' rows (fix r2-G2).
    await whenTrialReadable();
    const known = trialBlackenedActors();
    const students = studentActors();
    const progress = trialProgress();
    // Recorded by the count (`closeRound`, on the primary GM), because by the time
    // this window opens the tally has scrolled away and the GM is being asked to
    // remember it. A close with no ballot records a tie too (E10 C1).
    const tiedVote = Boolean(progress.tied);
    const esc = foundry.utils.escapeHTML;

    /* WHO IS DEAD, AS THE GMS HOLD IT, READ ONCE (E10 C4, 1.2.71; Q-E10-1). The window marks the
       dead " - dead" and they stay on its lists (the amend of 27.09: the class may vote for the
       dead), but the owner's answer (c) of 08.10.2026 is that the GM may pick a LIVING student to
       execute - so here a dead one is a disabled option, a display and not a choice, and `read`
       refuses one that is submitted anyway. The disabled options and the refusal are one set,
       read after every write queued on a student is judged (`judgedFor`) in one synchronous pass
       off the primary's mark (`flagsHeldNow`, the GMs' copy); a student who dies or comes back
       while the window is open is `applyVerdict`'s to judge.
       DEAD AS THE TABLE KNOWS IT (E10 fix r1-G4, 1.2.71; round 1's cor F1 = sec F2; the owner's
       Q-E10-2 (a), 10.10.2026). The set read the GMs' deaths store beside the flag, so a body nobody
       had found counted as dead here while the public card counts the flag alone: the window opened on
       "Nobody is executed" after the class had accused that student, said "Already dead" of them, and
       a wrong verdict then told every console nobody was executed (measured by the review's scenario 91,
       X2-X3). Such a death is not the table's yet, so it is not dead to the verdict: the student is a
       choice like any other, and this GM alone is told whose death is held (`unfoundLine`) and that
       executing them makes it the execution (`executeAtExit`, since E70 C4 at the trial's end). */
    await judgedFor(...students.map(a => a.id));
    const held = new Map(students.map(a => [a.id, flagsHeldNow(a)]));
    const dead = new Set(students.filter(a => isDeceased(held.get(a.id))).map(a => a.id));
    const unfound = students.filter(a => !dead.has(a.id) && isDeadForGm(held.get(a.id)));
    const knownIds = new Set(known.map(a => a.id));

    /* THE ACCUSED, SELECTED; NOBODY BY DEFAULT (E10 C4, 1.2.71; audit S06-04). The executed
       select listed every student with the first one selected and no "nobody": the accused was
       never stored, and a GM who pressed a verdict without touching it executed whoever sorted
       first. It opens on the name the count accused now (`accusedIds`, written by `closeRound`)
       and its first option is "Nobody is executed" (value ""), which is what it opens on after a
       tie, with no majority, with nobody accused, or with an accused who is dead (Q-E10-1 (c)) -
       the window says which. Measured on the harness (tier 2, "the verdict window opens on the
       accused"); at E10 C3's tree it opened on the first student.
       NOBODY LEFT OUT (E41 C10b, 1.2.97; the owner's Q-E41-2 of 01.11.2026, "Nikt nie jest
       pominięty"). The register's Blackened were left out of "executed if wrong" - a table that
       named one of them got it right - so the GM's list was not every student. They are listed,
       and a living one can be picked; the select still opens on nobody when the accused is one of
       them, since it names who dies if the table was wrong. The list is `verdictCandidates`', the
       Final Trial's too (tier 1 R1237, tier 2 E41-T4). */
    const accusedIds = (progress.accusedIds ?? []).filter(Boolean);
    const named = id => id === "monokuma"
        ? game.i18n.localize("DRPG.Vote.monokuma") : (game.actors.get(id)?.name ?? "?");
    const votesFor = id => (progress.accused ?? []).find(r => r?.id === id)?.n ?? 0;
    const namedLine = accusedIds.length
        ? `<p>${game.i18n.format("DRPG.Vote.namedByTable", {
            names: accusedIds.map(id => esc(named(id))).join(", "),
            n: Math.min(...accusedIds.map(votesFor)), total: progress.total ?? 0 })}</p>`
        : "";
    const deadAccused = accusedIds.filter(id => dead.has(id));
    const deadLine = deadAccused.length
        ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.accusedDead", {
            names: deadAccused.map(id => esc(named(id))).join(", ") })}</p>`
        : "";
    const unfoundLine = unfound.length
        ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.unfoundDead", {
            names: unfound.map(a => esc(a.name)).join(", ") })}</p>`
        : "";
    const executedOptions = `<option value="">${game.i18n.localize("DRPG.Vote.nobodyExecuted")}</option>${
        candidateOptions(verdictCandidates(students, { accusedIds, known: knownIds, dead }))}`;
    // Without a register the right verdict executes the Blackened named here (`read`), so this
    // select may not open on a student either: on the accused, whom a right verdict names, or on
    // nobody. The dead stay choosable - the Blackened may be one of them; `applyVerdict` kills
    // nobody twice. The Final Trial's rule, then: everyone choosable, the accused whoever they are.
    const blackenedOptions = `<option value="">${game.i18n.localize("DRPG.Vote.nobodyNamed")}</option>${
        candidateOptions(verdictCandidates(students, { accusedIds, dead, final: true }))}`;

    // What the register says, stated rather than asked. Two names here is an
    // ordinary evening now: one incident, then the betrayal.
    const roster = known.length
        ? `<p><strong>${plural("DRPG.Vote.blackenedKnown", { n: known.length })}</strong>
             ${known.map(a => esc(a.name)).join(", ")}</p>`
        : "";

    const result = await DialogV2.wait({
        window: { title: game.i18n.localize("DRPG.Vote.verdictTitle") },
        classes: ["drpg-panel"],
        content: dialogContent(`<form>
            <p>${game.i18n.localize(known.length
                ? "DRPG.Vote.verdictIntroKnown" : "DRPG.Vote.verdictIntro")}</p>
            ${roster}
            ${namedLine}
            ${deadLine}
            ${unfoundLine}
            <label class="drpg-verdict-field">${game.i18n.localize(known.length
                ? "DRPG.Vote.executedIfWrong" : "DRPG.Vote.executed")}
                <select name="executed">${executedOptions}</select></label>
            ${known.length ? "" : `<label class="drpg-verdict-field">${game.i18n.localize("DRPG.Vote.blackened")}
                <select name="blackened">${blackenedOptions}</select></label>`}
            <p class="notes">${game.i18n.localize(known.length
                ? "DRPG.Vote.verdictNoteKnown" : "DRPG.Vote.verdictNote")}</p>
            ${tiedVote ? `<p class="drpg-warning">${
                game.i18n.localize("DRPG.Vote.tiedVerdictNote")}</p>` : ""}
        </form>`),
        /*
         * CANCEL FIRST, AND THE ONLY DEFAULT (E10 C4, 1.2.71; audit S06-04). Enter in a DialogV2
         * presses the FIRST submit button in DOM order whatever carries `default` - the finding
         * behind the per-tab footers in E3, and why G-31 reordered this footer rather than only
         * re-flagging it. G-31 put the verdict a tie stands for first ("Got it wrong"), and
         * "Got it right" first otherwise, so Enter in this window executed somebody: the Blackened
         * with a register, the executed select's first student without one. A verdict is the one
         * press in the game that cannot be taken back, so Enter closes the window now, and the two
         * verdicts follow in one order whatever the count said - the tie is said in the window
         * (`tiedVerdictNote`), not by which button sits under the hand. Measured on the harness
         * (tier 2, "Enter in the verdict window executes nobody": the first submit button pressed,
         * as a browser's Enter presses it); the key itself in Foundry's window is LIVE-E10-02.
         *
         * Still a button rather than a reading off the tally: the count is a fact the module knows,
         * but whether the table got it right is the one thing only a human at that table can answer.
         */
        buttons: [
            { action: "cancel", label: game.i18n.localize("DRPG.Advance.cancel"), default: true },
            {
                action: "correct", label: game.i18n.localize("DRPG.Vote.gotItRight"),
                callback: (e, b, d) => read(d, true, known, dead)
            },
            {
                action: "wrong", label: game.i18n.localize("DRPG.Vote.gotItWrong"),
                callback: (e, b, d) => read(d, false, known, dead)
            }
        ],
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return applyVerdict(result);
}

/**
 * WHO A VERDICT LISTS (E41 C10b, 1.2.97; S17-28; the owner's Q-E41-2 of 01.11.2026, "Nikt nie jest pominięty", and
 * Q-E10-1 (c) of 08.10.2026). One list for both verdicts, pure: "Nobody" first (`id` ""), then every student of
 * `students` in their order, the known Blackened among them; `dead` (ids) are marked. In the ordinary verdict a dead
 * student is disabled - the GM may execute only a living one, and `read` refuses one submitted anyway - and the list
 * opens on the first accused when they are living and not a known Blackened, else on "Nobody" (it names who dies if
 * the table was wrong). With `final` - the Final Trial's window, and the ordinary verdict's select of the Blackened
 * when there is no register - everyone listed can be picked and the first accused is selected whoever they are.
 * `accusedIds` is the count's (`trialProgress().accusedIds`); an accused who is no student (Monokuma) selects nobody.
 * Answers `[{ id, name, dead, disabled, selected }]`.
 */
export function verdictCandidates(students, { accusedIds = [], known = [], dead = [], final = false } = {}) {
    const isDead = new Set(dead), isKnown = new Set(known);
    const first = students.find(a => a.id === (accusedIds ?? []).filter(Boolean)[0]) ?? null;
    const chosen = first && (final || (!isDead.has(first.id) && !isKnown.has(first.id))) ? first.id : "";
    return [{ id: "", name: null, dead: false, disabled: false, selected: chosen === "" },
        ...students.map(a => ({ id: a.id, name: a.name, dead: isDead.has(a.id), disabled: !final && isDead.has(a.id), selected: a.id === chosen }))];
}

/** The students' `<option>`s of a `verdictCandidates` list, its "Nobody" row left to the window, which words it. */
function candidateOptions(rows) {
    const esc = foundry.utils.escapeHTML, deadShort = game.i18n.localize("DRPG.Chapter.deadShort");
    return rows.filter(row => row.id).map(row => `<option value="${row.id}"${row.selected ? " selected" : ""}${
        row.disabled ? " disabled" : ""}>${esc(row.name)}${row.dead ? ` - ${deadShort}` : ""}</option>`).join("");
}

/**
 * Turn the form into a verdict.
 *
 * With a register, a correct verdict executes THE BLACKENED - all of them, and
 * the dropdown is ignored, because a table that named them right is not also
 * executing somebody else. A wrong one executes whoever the dropdown says and
 * leaves every killer standing.
 *
 * Without a register the right verdict executes the Blackened the GM names in
 * the second select (E10 C4, 1.2.71; audit S06-04): it executed the first
 * select's, which is "who is executed if they got it wrong" - so a table that
 * named the killer could see somebody else die for it. And a student `dead`
 * held when the window opened is refused as the executed one - the option is
 * disabled, so only a form edited around it submits one (Q-E10-1 (c)): nobody
 * is executed, and the GM is told.
 */
function read(dialog, correct, known, dead = new Set()) {
    const f = dialog.element.querySelector("form");
    const blackenedIdList = known.length ? known.map(a => a.id) : [f.blackened?.value].filter(Boolean);
    if (correct) return { correct, executedIds: blackenedIdList, blackenedIds: blackenedIdList };
    const executed = String(f.executed?.value ?? "");
    if (executed && dead.has(executed)) {
        const name = game.actors.get(executed)?.name ?? executed;
        warn(`The verdict window named ${name}, who is dead, to execute - nobody is executed.`);
        ui.notifications.warn(game.i18n.format("DRPG.Vote.accusedDead", { names: name }));
        return { correct, executedIds: [], blackenedIds: blackenedIdList };
    }
    return { correct, executedIds: [executed].filter(Boolean), blackenedIds: blackenedIdList };
}

/**
 * The rule a surviving Blackened introduces, taken down and announced anonymously.
 *
 * Shaped after the `newRule` Despair Call in call-effects.mjs, and different
 * from it in exactly one way that matters: nothing in the card says who asked
 * for it. The GM types what the killer told them; the table reads a rule.
 *
 * A Blackened whose body nobody has found is asked for like a living one (`verdictHeld`), and this
 * GM's window alone names them (`unfound`), so the GM decides knowing whose death it is (E10 fix r2-G3).
 *
 * @param {Actor[]} [unfound] the Blackened dead as the GMs hold it and not yet as the table does.
 * @returns {Promise<boolean>} whether a rule was actually recorded.
 */
async function askBlackenedRule(unfound = []) {
    const DialogV2 = foundry.applications.api.DialogV2;
    let text = "";
    const unfoundLine = unfound.length
        ? `<p class="drpg-warning">${game.i18n.format("DRPG.Vote.blackenedRuleUnfound", {
            names: unfound.map(actor => foundry.utils.escapeHTML(actor.name)).join(", ") })}</p>`
        : "";

    try {
        const answer = await DialogV2.wait({
            window: { title: game.i18n.localize("DRPG.Vote.blackenedRuleTitle") },
            classes: ["drpg-panel"],
            content: dialogContent(`<form>
                <p>${game.i18n.localize("DRPG.Vote.blackenedRuleIntro")}</p>
                ${unfoundLine}
                <textarea name="rule" rows="3"
                    placeholder="${game.i18n.localize("DRPG.Calls.newRulePlaceholder")}"></textarea>
                <p class="notes">${game.i18n.localize("DRPG.Vote.blackenedRuleNote")}</p>
            </form>`),
            buttons: [
                { action: "ok", label: game.i18n.localize("DRPG.Rules.addNew"), default: true,
                  callback: (e, b, d) => d.element.querySelector("form")?.elements?.rule?.value ?? "" },
                { action: "skip", label: game.i18n.localize("DRPG.Advance.cancel") }
            ],
            rejectClose: false
        });
        text = typeof answer === "string" ? answer.trim() : "";
    } catch (err) {
        error("Could not ask for the Blackened's rule", err);
        return false;
    }

    if (!text) return false;

    try {
        const { addRule } = await import("./rules.mjs");
        const recorded = await addRule(text);
        if (!recorded) return false;
    } catch (err) {
        error("Could not record the Blackened's rule", err);
        return false;
    }

    // Public, unattributed, and carrying the same sound the Call's own card
    // carries - because to the table this IS one of Monokuma's rules.
    await announce({
        flags: { [MODULE_ID]: { sfx: "newRule" } },
        content: `<div class="drpg-new-rule">
            <h3>${game.i18n.localize("DRPG.Calls.newRuleTitle")}</h3>
            <p>${foundry.utils.escapeHTML(text)}</p>
        </div>`
    });
    return true;
}

/*
 * A verdict being given on this browser (`applyVerdict`, `finishVerdict`, and since E41 C10b
 * `applyFinalVerdict`). The record's stage alone cannot tell a GM still in the verdict's windows from one
 * whose browser was reloaded under it
 * (`verdictStopped`), and it closes the door to a second verdict here while the first write is on its way.
 */
let verdictRunning = false;

/**
 * ONE LOCK FOR BOTH VERDICTS (E41 C10b, 1.2.97; S17-28). What refuses a verdict, as the key of what the GM is told:
 * not a GM (`DRPG.Panel.gmOnly`), or a verdict being given on this browser (`verdictRunning`) or applied to this trial
 * (`trialProgress().verdictApplied`: `DRPG.Vote.verdictAlreadyApplied`); null when nothing does. Both opens and both
 * applies ask it - the Final Trial's asked for a GM alone until E41 C10b. It refuses more than either did, never less.
 * Another GM's browser sees only the second half, so both verdicts write `verdictApplied` before anything else they
 * write or post (the Final one since E41 fix FG1).
 */
export function verdictRefusal() {
    if (!game.user.isGM) return "DRPG.Panel.gmOnly";
    if (verdictRunning || trialProgress().verdictApplied) return "DRPG.Vote.verdictAlreadyApplied";
    return null;
}

/**
 * Execute somebody, and hand out what the guide says the table has earned.
 *
 * ONE RECORD, WRITTEN FIRST AND ONCE (E10 C5, 1.2.71; audit S06-39). The lock was written twice,
 * first and again after the last consequence, and nothing between the two said how far the verdict
 * had got: a throw in the pools or in the GMs' summary, or a GM closing the tab in a Level Up window,
 * left the lock standing, the rest undone and the console with no way on - its Verdict button is
 * closed by the lock. The world's record holds the verdict beside the lock now (`verdict`: its stage,
 * right or wrong, who is executed, who gave it and when, the steps done), each consequence is a step
 * of `runVerdict` in its own try/catch, and the stage reads "done" once every step is. A step that
 * failed, or a GM who left, is the console's "The verdict stopped at" line and its Finish the verdict
 * (`finishVerdict`). The record never holds a Blackened: a wrong verdict's killers are handed to the
 * steps, and kept for a Finish in a GM store (`keepVerdictBlackened`).
 */
export async function applyVerdict({
    correct, executedIds, blackenedIds: named, executedId, blackenedId
} = {}) {
    if (!game.user.isGM) return null;

    /* NOR BY THE API (E10 fix r2-G6, 1.2.71). r2-G5 sent `openVerdictDialog` to the Final Trial's window,
       and `game.drpg.applyVerdict` - this function, which a macro calls with the verdict already decided -
       still gave the ordinary verdict in a Final Trial: its lock written and the class's Level Up window
       opened, with the Final Trial's flag left up (tier 2 "the verdict's own API in a Final Trial opens the
       Final Trial's window", red at 616d1e2). It opens the Final Trial's window instead, Cancel the default, and the
       arguments are not read: that verdict asks its own questions. R340 reads that this comes first. */
    const { inFinalTrial } = await import("./mastermind.mjs");
    if (inFinalTrial()) return openFinalVerdictDialog();

    // MARKED BEFORE ANYTHING IS ASKED (17.09, review of F2). The record used to be written
    // at the very end, after every Level Up window and the Blackened's rule had closed -
    // minutes in which the console, another GM or the API could start a second verdict.
    // Written first, the lock holds for the whole of it; the same check stands here for
    // every caller that does not come through `openVerdictDialog`. The one lock of both
    // verdicts since E41 C10b (`verdictRefusal`).
    const refused = verdictRefusal();
    if (refused) {
        ui.notifications.warn(game.i18n.localize(refused));
        return null;
    }
    verdictRunning = true;
    try {
        // Both shapes accepted: the dialog sends lists, and anything older - a
        // macro, the console - sends the single ids this used to take.
        const record = {
            stage: "applying", correct: Boolean(correct),
            executedIds: (executedIds ?? [executedId]).filter(id => id && game.actors.get(id)),
            by: game.user.id, at: Date.now(), done: [], failed: []
        };
        const blackenedIds = (named ?? [blackenedId]).filter(id => id && game.actors.get(id));
        await setTrialProgress({ verdictApplied: true, verdict: record });
        await keepVerdictBlackened(record.at, blackenedIds);
        return await runVerdict(record, blackenedIds);
    } finally {
        verdictRunning = false;
    }
}

/*
 * THE BLACKENED THE GM NAMED, KEPT FOR A FINISH (E10 fix r1-G1, 1.2.71; the round-1 security review's
 * F3). A Finish read the Blackened from the register alone, which names nobody when the GM named them
 * by hand in the verdict's window: a wrong verdict that stopped before its Level Up or its rule
 * finished keeping nobody's Level Up and asking no rule. They are kept beside the verdict's `at` in a
 * GM store (gm-stores.mjs `verdictStore`), never in the world's record, which every console reads.
 * Written after the lock, so the lock is still the first write; a GM gone between the two leaves the
 * register to the Finish, as before. A write that fails is logged and stops nothing.
 */
async function keepVerdictBlackened(at, blackenedIds) {
    try {
        await verdictStore.whenHydrated();
        await verdictStore.patch(RECORD, { at, blackenedIds: [...blackenedIds] });
    } catch (err) {
        error("Could not keep the verdict's Blackened for a Finish", err);
    }
}

/*
 * A VERDICT'S STEPS, IN THE ORDER THE TABLE MEETS THEM (E10 C5). Who is executed, read and written
 * down; the card that tells the table, so the class reads the verdict while the GM is still in the
 * Level Up windows; what the guide gives a right verdict or a wrong one; and the overflow, on both. A
 * step that needs another is not run until that one is done (`VERDICT_NEEDS`).
 *
 * NO EXECUTION AMONG THEM (E70 C4, 28.10.2026; S18-87, the owner's DC36: "token osoby na którą zagłosowano
 * umiera po class trialu, gdy class trial się kończy, a nie w trakcie. Niech werdykt nie kończy automatycznie
 * triala"). The step "executions" killed the sentenced in the verdict; the sentence is written down now
 * (`readSentence`: `verdict.sentenced`) and carried out once, when the trial ends (`executeAtExit`). The card
 * needs the sentence, no longer the executions: left on "executions" it would never run, and the verdict would
 * stand "applying" with Finish on the console. A record written before 1.2.90 that has not done "executions"
 * reaches "done" without it, and its sentenced die at the exit like anybody's.
 */
const VERDICT_STEPS = {
    correct: ["sentence", "card", "levelUps", "overflow"],
    wrong: ["sentence", "card", "offers", "despair", "rule", "overflow"]
};
/*
 * THE FINAL TRIAL'S EXECUTION AND PICK WAIT ON ITS SENTENCE (E42 fix FG1, 03.11.2026; the end review's C-m1). A Final
 * verdict's sentence that failed was followed by its execution, which found no sentence, and by the clearing of the
 * pick, so a Finish knew the Mastermind nowhere and failed at the sentence every time. Both wait on it now: the pick
 * stands for the Finish, which writes the sentence first (tier 2 E42-T11).
 */
const VERDICT_NEEDS = {
    card: "sentence", levelUps: "sentence", offers: "sentence", rule: "sentence",
    finalExecution: "finalSentence", mastermind: "finalSentence"
};

/*
 * THE FINAL TRIAL'S VERDICT, STEP BY STEP (E42 C1c, 1.2.97; E42-06, audit S17-30). It was one function: its record
 * written first (E41 fix FG1) and "done" after its card and whisper, then the Final Trial's flag, the execution, the
 * Level Ups that waited and the Mastermind's pick, each in a try/catch of its own that logged and went on - so a
 * throw or a closed tab in the Level Ups left them never given, under a record that said done and offered no Finish
 * (measured, tier 2 E42-T2: red at 85e8b0e2). Its steps are a table now, run like the ordinary verdict's and
 * finished by the same Finish. Their keys are the Final Trial's own, never "card" or "sentence": events.mjs
 * `afterVerdictCard` reads "card" in `done` as a chapter's verdict told, and trial-progress.mjs `sentenceOf` reads
 * "sentence" as an ordinary sentence (R1252). The record holds the keys and nothing else of the Final Trial: no
 * name, no id (the Mastermind's identity is the GMs'; mastermind.mjs's header).
 */
const FINAL_VERDICT_STEPS = Object.freeze(["finalSentence", "finalCard", "finalClose", "finalExecution", "finalLevelUps", "mastermind"]);

// "executions" stays named for a record from before 1.2.90 whose stopped steps still list it (`verdictStopped`).
const VERDICT_STEP_LABELS = {
    sentence: "DRPG.Vote.verdictSteps.sentence", executions: "DRPG.Vote.verdictSteps.executions",
    card: "DRPG.Vote.verdictSteps.card", levelUps: "DRPG.Vote.verdictSteps.levelUps",
    offers: "DRPG.Vote.verdictSteps.offers", despair: "DRPG.Vote.verdictSteps.despair",
    rule: "DRPG.Vote.verdictSteps.rule", overflow: "DRPG.Vote.verdictSteps.overflow",
    finalSentence: "DRPG.Vote.verdictSteps.finalSentence", finalCard: "DRPG.Vote.verdictSteps.finalCard",
    finalClose: "DRPG.Vote.verdictSteps.finalClose", finalExecution: "DRPG.Vote.verdictSteps.finalExecution",
    finalLevelUps: "DRPG.Vote.verdictSteps.finalLevelUps", mastermind: "DRPG.Vote.verdictSteps.mastermind"
};

/** The steps of a verdict record (`trialProgress().verdict`), in order: the Final Trial's for a `final` record. */
function verdictSteps(verdict) {
    if (verdict?.final) return FINAL_VERDICT_STEPS;
    return VERDICT_STEPS[verdict?.correct ? "correct" : "wrong"];
}

/** The console's name for one step. */
function stepLabel(step) {
    return game.i18n.localize(VERDICT_STEP_LABELS[step] ?? step);
}

/** The console's names for `steps`, in one list (`listOf`, E66; "a, b, c" until E42 C1c). */
function stepLabels(steps) {
    return listOf(steps.map(stepLabel));
}

/**
 * The steps of `record` not yet done, on the one runner (steps.mjs `runSteps`, E42 C1c): each in its own
 * try/catch, a step whose `VERDICT_NEEDS` is not done not run, and the record written after each step done;
 * then the stage - "done" once every step is, "applying" with the steps that failed - and the GMs' summary
 * (`stepsReport`). Answers the summary's lines. `blackenedIds` are a wrong verdict's killers, which the
 * world's record never holds; `final` is the Final Trial's verdict's context (`giveFinalVerdict`,
 * `finalContext`) for a `final` record.
 *
 * THE WRITES AS THEY WERE (E10 C5). The record is written after each step done, never after one that failed:
 * a failed step is in the record's `failed` only at the end, so while the verdict runs another GM's console does
 * not read it as stopped (`verdictStopped`) and offer a Finish beside the GM still giving it. The steps change the
 * record themselves (`readSentence`'s sentence, the Level Ups' `given`); the runner's `done` is merged into it.
 */
async function runVerdict(record, blackenedIds, final = null) {
    const context = { record, blackenedIds, final, lines: [], reading: null };
    let written = record.done.length;
    const result = await runSteps({
        label: final ? "Final Trial's verdict" : "verdict", context, record,
        steps: verdictSteps(record).map(key => ({
            key, needs: VERDICT_NEEDS[key],
            // A step that answers false did not do its work (`verdictDespair`'s fill nobody wrote, E42 fix FG1): failed.
            run: async () => ((await VERDICT_STEP[key](context)) === false ? false : undefined),
            after: key === "card" ? () => verdictExecutedNow(context) : null
        })),
        save: async (run, { end = false } = {}) => {
            context.record = { ...context.record, done: [...run.done] };
            if (end) {
                const left = verdictSteps(record).filter(step => !run.done.includes(step));
                // Cleared before the last write, so the console that write redraws reads a verdict that stopped as stopped.
                verdictRunning = false;
                await setTrialProgress({ verdict: { ...context.record, stage: left.length ? "applying" : "done", failed: [...run.failed] } });
            } else if (run.done.length > written) {
                written = run.done.length;
                await setTrialProgress({ verdict: context.record });
            }
        }
    });
    // HEAD's one warning: the steps that failed, or, when none did, the ones left.
    const report = stepsReport(result, { lines: context.lines, label: stepLabel,
        groups: { [result.failed.length ? "failed" : "notRun"]: "DRPG.Vote.verdictStopped" } });
    const stopped = result.failed.length > 0 || result.notRun.length > 0;
    try {
        await whisperToGms(verdictSummaryContent(final ? finalSummary(final, report) : {
            title: "DRPG.Vote.verdictTitle",
            summary: game.i18n.localize(record.correct ? "DRPG.Vote.correctSummary" : "DRPG.Vote.wrongSummary"),
            lines: report.lines,
            warning: report.warnings.join(" ")
        }));
    } catch (err) {
        error("Could not tell the GMs what the verdict did", err);
    }
    log(final ? `Final Trial verdict ${stopped ? "stopped" : "applied"}: ${final.executed ? "executed" : "revealed, not executed"}.`
        : `Verdict ${stopped ? "stopped" : "applied"}: ${record.correct ? "correct" : "wrong"}.`);
    return context.lines;
}

/*
 * A VERDICT GIVEN AFTER THE TRIAL ENDED IS CARRIED OUT AT ONCE (E70 C4; the plan's point (g), road 3). The
 * console offers the verdict after End the trial (trial-floor-ui.mjs `trialNextStep`, E11 fix r1-G1), and
 * the exit that would execute it has already gone by: the sentence is carried out straight after the card
 * that tells it - once the card's step is written done - before the Level Ups, which can keep their windows
 * open for minutes (`runVerdict`, the card step's `after`).
 */
async function verdictExecutedNow(context) {
    if (getClock().phase !== "classTrial") context.lines.push(...await executionLines());
}

/** The verdict's reading of who is alive (`verdictHeld`), once per run, after the audit of everybody it reads. */
async function verdictReading(context) {
    if (!context.reading) {
        await judgedFor(...context.record.executedIds, ...context.blackenedIds, ...studentActors().map(actor => actor.id));
        context.reading = verdictHeld(context.record, context.blackenedIds);
    }
    return context.reading;
}

/*
 * ONE SYNCHRONOUS PASS (E10 C5; plan 1b.2, H3): every death the verdict decides by, read as the GMs
 * hold it (`flagsHeldNow`) with nothing awaited between two reads, so no write is judged half-way
 * through it. Until C5 the verdict read the documents (`isDeadForGm`, `livingStudents`).
 *
 * The executed: whoever the verdict named that the table does not know dead - one it does is nobody
 * to execute, and the card would say they were.
 *
 * The survivors of a right verdict, ALIVE AS THE TABLE KNOWS IT (E05 fix r2-G1, 27.09.2026; review
 * S2-m6, the plan's rule A). The list was the GMs' (`livingStudentsForGm`), so a student whose body
 * nobody had found was passed over - no Level Up window for them, measured on the harness - and every
 * console saw the class advance and one student not. A Level Up is a write every console reads: the
 * table's list, less whoever this verdict named for execution - one whose body nobody has found is
 * executed by making that death the table's (`executeAtExit`, fix r1-G4), and does not advance either.
 *
 * The killers of a wrong verdict: EVERY one who is still breathing, not just the first one named, and
 * not one this verdict executes. ALIVE AS THE TABLE KNOWS IT TOO (E10 fix r2-G3, 1.2.71; the round-2
 * security review's S2-2, the owner's Q-E10-2 (a)). They were read as the GMs hold them
 * (`isDeadForGm`), the two lists above as the table does: a wrong verdict whose Blackened had died
 * where nobody has found the body asked no rule, kept no Reinforced and wrote no rule line, so whether
 * the table got the rule's card hung on a death nobody had found. They are read as the table knows
 * them now, and `unfound` names those among them whose death the GMs hold, for the rule's window to
 * tell this GM alone (`askBlackenedRule`). Their Reinforced waits in the GMs' store as a living
 * Blackened's does (`verdictOffers`). Measured on the harness (tier 2, "a wrong verdict on a Blackened
 * whose body nobody has found asks their rule ..."): at 474fa87 no rule window, no waiting Level Up.
 */
function verdictHeld(record, blackenedIds) {
    const named = new Set(record.executedIds);
    const actors = ids => ids.map(id => game.actors.get(id)).filter(Boolean);
    const killers = actors(blackenedIds).filter(actor => !named.has(actor.id) && !isDeceased(flagsHeldNow(actor)));
    return {
        sentenced: actors(record.executedIds).filter(actor => !isDeceased(flagsHeldNow(actor))).map(actor => actor.id),
        survivors: studentActors().filter(actor => !named.has(actor.id) && !isDeceased(flagsHeldNow(actor))),
        killers,
        unfound: killers.filter(actor => isDeadForGm(flagsHeldNow(actor)))
    };
}

/*
 * WHO IS EXECUTED, WRITTEN DOWN BEFORE ANYBODY DIES (E10 C5; plan 1b.2). The executions read the
 * document's `isDeadForGm`: a `deceased` a player's console had written, and the sheet audit had not
 * yet put back (GM_FLAGS), read as a death - the accused was passed over, and alive once the flag went
 * back. 63 G holds that window open. The list read held is the record's from here on, so a Finish
 * executes and names the same students, and does not take one this verdict killed before it stopped
 * for one the table knew dead before it.
 *
 * THE SENTENCE, AND THE CHAPTER'S STAMP (E70 C4; DC36, amend 4 (c)). The list is the sentence too
 * (`verdict.sentenced`), carried out at the trial's end (`executeAtExit`), and the verdict's `at` is
 * the chapter's newest (`lastVerdictAt`, which a second trial in the chapter keeps). Both public by
 * design: the card says who, and the stamp is a time.
 */
async function readSentence(context) {
    const { sentenced } = await verdictReading(context);
    context.record = { ...context.record, executedIds: sentenced, sentenced: [...sentenced] };
    await setTrialProgress({ lastVerdictAt: context.record.at ?? null });
}

/**
 * THE VERDICT, TOLD TO THE TABLE (E10 C5, 1.2.71; audit S06-06). The verdict was a whisper to the GMs,
 * and the executed's death card went to them alone too, so the one step of the trial with no public
 * card was its last; the executed's player was told nothing, and the Event panel went on saying
 * "Everyone has the floor". One public card now: who is sentenced and whether the class got it right -
 * and of the Blackened nothing, no name and no id, in its words or its flags, so a wrong verdict gives
 * nobody away. Since E70 C4 the execution has its own card, its sound and the owner's note, at the
 * trial's end (`postExecutionCard`). The card
 * carries the verdict's `at` (`verdictAt`), by which a Finish knows it was posted (`verdictCard`).
 * The Event panel reads the record (events.mjs `afterVerdictCard`).
 */
export async function postVerdictCard(record) {
    const executed = (record?.sentenced ?? record?.executedIds ?? []).map(id => game.actors.get(id)).filter(Boolean);
    const esc = foundry.utils.escapeHTML;
    /* WHO WILL BE EXECUTED, AND WHEN (E70 C4; DC36). The card said "{name} has been executed." with the death's
       sound; nobody dies at the verdict now. In the trial it says the sentence waits for the trial's end; a verdict
       given after End the trial is carried out straight after this card (`runVerdict`), whose own card says so. The
       death's sound and the owner's note went to that card (`postExecutionCard`). */
    const names = executed.map(actor => esc(actor.name)).join(", ");
    const lines = executed.length
        ? [game.i18n.format(getClock().phase === "classTrial" ? "DRPG.Vote.executionPending" : "DRPG.Vote.executionNow", { names })]
        : [game.i18n.localize("DRPG.Vote.nobodyExecuted")];
    await announce(verdictCardContent({
        banner: "DRPG.Vote.verdictCardTitle",
        lines: [...lines, game.i18n.localize(record.correct ? "DRPG.Vote.verdictRight" : "DRPG.Vote.verdictWrong")],
        flags: { [MODULE_ID]: { verdictCard: getClock().chapter ?? null, verdictAt: record?.at ?? null } }
    }));
}

/**
 * A VERDICT'S PUBLIC CARD (E41 C10b, 1.2.97; S17-28): the ordinary verdict's (`postVerdictCard`) and the Final
 * Trial's (`applyFinalVerdict`), one shape - the banner `banner` (a key), each of `lines` (HTML, already in the
 * table's words) a paragraph, `tone` "objection" for the Final Trial's red card - and `flags` when the card carries
 * any. The words are each verdict's own, as they were. Answers `announce`'s data.
 */
export function verdictCardContent({ banner, lines = [], flags = null, tone = "" }) {
    const content = `<div class="drpg-evidence-card${tone ? ` ${tone}` : ""}">
            <div class="drpg-objection-banner">${game.i18n.localize(banner)}</div>
            ${lines.map(line => `<p>${line}</p>`).join("")}
        </div>`;
    return flags ? { flags, content } : { content };
}

/**
 * A VERDICT'S SUMMARY TO THE GMS (E41 C10b, 1.2.97; S17-28): the ordinary verdict's (`runVerdict`) and the Final
 * Trial's (`applyFinalVerdict`), one shape - the title `title` (a key), the sentence `summary` (HTML), the steps'
 * `lines` when the verdict has any (the Final Trial's has none), and a `warning` paragraph (where the verdict
 * stopped). Answers the whisper's HTML.
 */
export function verdictSummaryContent({ title, summary, lines = null, warning = "" }) {
    return `
            <h3>${game.i18n.localize(title)}</h3>
            <p>${summary}</p>
            ${lines ? `<ul>${lines.map(line => `<li>${line}</li>`).join("")}</ul>` : ""}
            ${warning ? `<p class="drpg-warning">${warning}</p>` : ""}`;
}

/*
 * THE CARD, ONCE PER VERDICT (E10 fix r1-G1, 1.2.71; the round-1 goal verifier's (c)). The step is
 * recorded done in the world after the card is posted, and a GM gone between the two left a verdict
 * whose Finish posted the card a second time. The card carries the verdict's `at` (`verdictAt`), and
 * the step posts none when a GM's card of this verdict is in the chat already. A GM's: anybody can
 * post a message with any flags, and one a player made must not keep the table from its verdict.
 */
async function verdictCard(context) {
    if (verdictCardPosted(context.record)) return;
    await postVerdictCard(context.record);
}

/** Whether a GM posted the card of the verdict `record` (`postVerdictCard`'s `verdictAt`). */
function verdictCardPosted(record) {
    return game.messages.some(message => message.author?.isGM && message.getFlag(MODULE_ID, "verdictAt") === record.at);
}

/*
 * A right verdict: everyone still alive advances - unchanged, and deliberately: a right answer levels
 * the table up. The Blackened are sentenced (and die when the trial ends, E70 C4), so they are not in this list (`verdictHeld`),
 * which is what keeps that honest even when there were two of them. A Reinforced Level Up a wrong
 * verdict left waiting (E05 C11) is picked here, with its owner's Standard, in the same row - see
 * `runAdvancementBatch`. The window not opening fails the step; a window the GM closes does not.
 *
 * ONE LEVEL UP EACH, WHOEVER FINISHES (E10 fix r1-G1, 1.2.71; the round-1 goal verifier's S06-39).
 * A Finish after a GM left inside the class's window ran the whole batch again, and each survivor
 * already given a Level Up - written, or offered to the player - was given a second. The record
 * says whom the batch has given one (`given`, written after each row), and a Finish hands the
 * window only the rest. Character ids alone, in the world's record: the row of a surviving
 * Blackened carries what waited for the class, and that stays on the GMs' side. A student whose row
 * gave nothing - nobody plays them and the GM closed their picker - is not given, and is asked
 * again. A GM gone between a row's Level Up and the write that records it leaves that one row to be
 * given again: the one write between them is not closed (read in the code, not measured).
 *
 * SAID AFTER THE FACT (E10 C7; audit S06-25, S06-32). The line was written before the windows opened,
 * "N survivors take a standard Level Up", the kind the config's raw word: a picker closed on the way
 * left the GMs told of a Level Up nobody took. It counts what the batch did now - taken here, waiting
 * for the players, and by name what is not yet given - with the kind's own words.
 */
async function verdictLevelUps(context) {
    const { survivors } = await verdictReading(context);
    const at = context.record.at;
    await verdictStore.whenHydrated();
    const done = await promptAdvancements(survivors, TRIAL.correct.levelUp, {
        given: context.record.given ?? [],
        giving: givingOf(at),
        onGiving: (actor, counts) => keepGiving(at, actor, counts),
        onGiven: async actor => {
            context.record = { ...context.record, given: [...(context.record.given ?? []), actor.id] };
            await setTrialProgress({ verdict: context.record });
            await keepGiving(at, null);
        }
    });
    if (done === null) throw new Error("the Level Ups did not open");
    const { advanceKindName } = await import("./level-up.mjs");
    const kind = advanceKindName(TRIAL.correct.levelUp);
    context.lines.push(plural("DRPG.Vote.levelUpGranted", { n: done.applied, kind }));
    if (done.offered) context.lines.push(plural("DRPG.Vote.levelUpWaiting", { n: done.offered, kind }));
    for (const name of done.notGiven) {
        context.lines.push(game.i18n.format("DRPG.Advance.notYetGiven", { name: foundry.utils.escapeHTML(name) }));
    }
}

/*
 * THE ROW IN FLIGHT (E42 C1c, 1.2.97; E42-05). "A GM gone between a row's Level Up and the write that records it
 * leaves that one row to be given again" (the comment above, since E10 fix r1-G1): the batch's `given` is written
 * after the row's offer or advance, so a tab closed between the two left a row given and not recorded, and a Finish
 * gave it a second Level Up (measured, tier 2 E42-T1: red at 85e8b0e2). The row being given is written first, to the
 * GMs' store and never to the world's record - `verdictStore.giving`: the verdict's `at`, the student, and the offers
 * standing on them and their `advances` before the row's write - and cleared once its `given` is written. A Finish
 * hands it to the batch, which reads the row as given when either count grew (level-up.mjs `runAdvancementBatch`).
 * One verdict's row at a time; a row of another verdict (`at`) is nobody's. A write of it that fails is logged and
 * the Level Up is given all the same, as before E42.
 */
function givingOf(at) {
    const giving = verdictStore.record()?.giving;
    return giving && typeof giving === "object" && giving.at === at ? giving : null;
}

/** `verdictStore.giving` written before a row's Level Up (the batch's `onGiving`), or cleared after its `given` (null). */
async function keepGiving(at, actor, { offers = 0, advances = 0 } = {}) {
    try {
        await verdictStore.patch(RECORD, { giving: actor ? { at, actorId: actor.id, offers, advances } : null });
    } catch (err) {
        error("Could not keep the Level Up being given for a Finish", err);
    }
}

/*
 * THEIR LEVEL UP WAITS FOR THE CLASS (E05 C11, 27.09.2026; D4; audit S03-01, S06-01). Applied here it
 * wrote new maxima and `advances` on the Blackened and a card spoken by them, which every console
 * receives - the student the class had just failed to name. It is a row of the GMs' store now, picked
 * with the class's next Standard or at the Final Trial's verdict (level-up.mjs `deferAdvancement`).
 * `deferAdvancement` counts up and stamps its row with the time, so a row this verdict wrote before it
 * stopped is not written again by a Finish (E10 C5).
 */
async function verdictOffers(context) {
    const { killers } = await verdictReading(context);
    if (!killers.length) return;
    const { deferAdvancement, advanceKindName } = await import("./level-up.mjs");
    await deferredOfferStore.whenHydrated();
    let waiting = 0;
    for (const actor of killers) {
        if ((deferredOfferStore.get(actor.id)?.at ?? 0) >= context.record.at) waiting++;
        else if (await deferAdvancement(actor, TRIAL.wrong.blackenedLevelUp, getClock().chapter ?? null)) waiting++;
    }
    context.lines.push(plural("DRPG.Vote.blackenedRewarded", {
        n: waiting,
        kind: advanceKindName(TRIAL.wrong.blackenedLevelUp)
    }));
}

/*
 * A wrong verdict: every Monokuma fills their Despair to maximum.
 *
 * A FILL NOBODY WROTE IS A STEP THAT FAILED (E42 fix FG1, 03.11.2026; the end review's C-M1 = G-F1, STATUS Open 2).
 * `fillAllDespair` answers null when this GM is not the primary and the primary's answer is refused or does not come
 * (despair.mjs `askAll`), and the step read done whatever it answered: the GMs were told the pools were filled, and no
 * console offered a Finish over pools as they were. It fails on null now, and the line is said only after a fill that
 * was written; Finish the verdict runs it again, and a second fill writes the same maxima (tier 2 E42-T10).
 */
async function verdictDespair(context) {
    if (!TRIAL.wrong.fillDespair) return;
    if ((await fillAllDespair()) == null) return false;
    context.lines.push(game.i18n.format("DRPG.Vote.despairFilled", {
        who: monokumas().map(poolLabel).join(", ")
    }));
}

/*
 * THE ONE LINE OF THE VERDICT TABLE THAT HAD NO PATH.
 *
 * This used to push a sentence into the GM's whisper and stop, so the
 * rule the Blackened had just earned existed only if somebody
 * remembered it. It is written down now, announced to the table, and
 * announced WITHOUT A NAME: to everyone else it is simply another of
 * Monokuma's rules, which is the whole point of surviving a wrong vote.
 */
async function verdictRule(context) {
    const { killers, unfound } = await verdictReading(context);
    if (!TRIAL.wrong.newRule || !killers.length) return;
    const wrote = await askBlackenedRule(unfound);
    context.lines.push(game.i18n.localize(wrote
        ? "DRPG.Vote.newRuleWritten"
        : "DRPG.Vote.newRule"));
}

/*
 * THE OVERFLOW EMPTIES WITH THE VERDICT (Z10), on BOTH verdicts and not
 * only the one that refills the pools.
 *
 * The counter measures pressure built up over a chapter, and a verdict ends
 * the chapter however it goes. Clearing it only when the class guessed
 * wrong would mean a class that guessed RIGHT carries the previous
 * chapter's weather into the next one - punished for winning, by a rule
 * whose whole subject is how much Despair went spare.
 */
async function verdictOverflow() {
    const { resetOverflow } = await import("./overflow.mjs");
    await resetOverflow();
}

/** What each step of a verdict does; `runVerdict` runs them in `VERDICT_STEPS`'s order. */
const VERDICT_STEP = {
    sentence: readSentence, card: verdictCard,
    levelUps: verdictLevelUps, offers: verdictOffers, despair: verdictDespair, rule: verdictRule, overflow: verdictOverflow,
    finalSentence: finalVerdictSentence, finalCard: finalVerdictCard, finalClose: finalVerdictClose,
    finalExecution: finalVerdictExecution, finalLevelUps: finalVerdictLevelUps, mastermind: finalVerdictMastermind
};

/**
 * A VERDICT THAT STOPPED (E10 C5, 1.2.71; audit S06-39): its record still reads "applying" and nobody
 * is giving it - a step failed, or the GM who gave it is gone (their tab closed, or this browser was
 * reloaded under it). A verdict another GM is still giving is not one: they are in its windows.
 * Answers the steps it stopped at, as the console names them, or null.
 */
export function verdictStopped(progress = trialProgress()) {
    const verdict = progress?.verdict;
    // A Final verdict's too since E42 C1c: its steps are a table `runVerdict` runs (`verdictSteps` answers the Final
    // Trial's for a `final` record), so a Finish runs them; until then (E41 fix FG1) it was passed over, and a Final
    // verdict that stopped could not be finished.
    if (verdict?.stage !== "applying" || verdictRunning) return null;
    const failed = Array.isArray(verdict.failed) ? verdict.failed : [];
    const by = game.users.get(verdict.by);
    if (!failed.length && by?.active && by.id !== game.user.id) return null;
    const done = Array.isArray(verdict.done) ? verdict.done : [];
    return stepLabels(failed.length ? failed : verdictSteps(verdict).filter(step => !done.includes(step)));
}

/**
 * WHO RUNS A VERDICT NOT YET DONE (E10 fix r2-G2, 1.2.71; round 2's cor M1, cor m1 and sec S2-3): the GM
 * who gave it while they are connected, otherwise the primary GM - the id, or null when no verdict is
 * being given. Read by `finishVerdict` and by the trial console's lead (trial-floor-ui.mjs
 * `trialNextStep`), so the GM the console sends to Finish is the GM Finish runs on.
 *
 * Fix r1-G1 made Finish the primary's alone, and `verdictStopped` offers it on the verdict's own GM
 * while that GM is connected: a verdict given by a GM who is not the primary, whose page reloaded inside
 * it, was offered Finish where Finish refused and refused where it would have run, and nobody could finish
 * it until that GM left the game (round 2's scenario 92 at 302ae45: stage "applying" after both presses).
 * On every other GM the console then led to End the chapter, which drops the steps not done.
 *
 * The other reading on the table (round 2's goal S06-39) cleared `by` on the reloaded GM's load, so the
 * primary is offered Finish. Not that: it is a world write racing a Finish already pressed on another
 * GM after a failed step (both write the record, and the older `done` would run a step twice - read
 * in the code), and it
 * leaves the primary's console leading to End the chapter while a GM who is not the primary is still in
 * the verdict's windows. This writes nothing: each GM reads the same two facts, `by` and who is
 * connected, and one browser at a time is the runner, whose latch (`verdictRunning`) holds two presses
 * apart - as r1-G1's primary did. Left as it was before r1-G1: the moment a runner disconnects, the GM
 * who becomes it may press before the first one's last write lands (read in the code, not measured).
 */
export function verdictRunner(progress = trialProgress()) {
    const verdict = progress?.verdict;
    if (verdict?.stage !== "applying") return null;
    const by = game.users.get(verdict.by);
    return by?.active ? by.id : primaryGmId();
}

/**
 * FINISH THE VERDICT (E10 C5, 1.2.71; audit S06-39): the steps a verdict that stopped had not done,
 * given by this GM - what it had done is not done again (`runVerdict`). The Blackened are the ones
 * its GM named (`keepVerdictBlackened`), and the register's, as the verdict's window reads them
 * (`whenTrialReadable`, `trialBlackenedIds`), only when the GMs' store holds none for this verdict -
 * never the world's record, which holds none.
 *
 * ON ONE GM ALONE (E10 fix r1-G1, 1.2.71; the round-1 goal verifier's S06-39, its doubt 2).
 * Every GM is offered Finish once a step failed or the verdict's GM left, and this browser's latch
 * (`verdictRunning`) is the only one: two GMs pressing it within one round trip both ran the steps
 * left - two cards, two class windows. One browser runs it now, whose latch holds two presses apart;
 * another GM is told whom to ask. Since fix r2-G2 that browser is the verdict's runner (`verdictRunner`):
 * its own GM while connected, otherwise the primary.
 */
export async function finishVerdict() {
    if (!game.user.isGM) return null;
    const progress = trialProgress();
    const runner = verdictRunner(progress);
    if (runner && runner !== game.user.id) {
        ui.notifications.warn(game.i18n.format("DRPG.Vote.finishOtherGm", { name: game.users.get(runner)?.name ?? "?" }));
        return null;
    }
    if (!verdictStopped(progress)) {
        ui.notifications.warn(game.i18n.localize("DRPG.Vote.verdictAlreadyApplied"));
        return null;
    }
    verdictRunning = true;
    try {
        // The Final Trial's verdict finishes its own steps (E42 C1c): its context is read off the GMs' side.
        if (progress.verdict.final) {
            const record = { ...progress.verdict, done: [...(progress.verdict.done ?? [])], by: game.user.id, failed: [] };
            const final = await finalContext(record);
            await setTrialProgress({ verdict: record });
            return await runVerdict(record, [], final);
        }
        await whenTrialReadable();
        await verdictStore.whenHydrated();
        const kept = verdictStore.record();
        const named = kept.at === progress.verdict.at && Array.isArray(kept.blackenedIds) ? kept.blackenedIds : trialBlackenedIds();
        const record = { ...progress.verdict, done: [...(progress.verdict.done ?? [])], by: game.user.id, failed: [] };
        await setTrialProgress({ verdict: record });
        return await runVerdict(record, named.filter(id => game.actors.get(id)));
    } finally {
        verdictRunning = false;
    }
}

/**
 * The Level Ups of everybody who earned one, in one window on the GM's client
 * (level-up.mjs `runAdvancementBatch`; E10 C7): row by row the GM hands each to
 * its player, whose sheet's button lights up, or picks it here, one picker after
 * another. A survivor holding a Reinforced that waited for the class takes both
 * in one row (E05 C11). Answers the batch's counts, or null when it threw.
 */
async function promptAdvancements(actors, kind, options) {
    try {
        const { runAdvancementBatch } = await import("./level-up.mjs");
        return await runAdvancementBatch(actors, kind, options);
    } catch (err) {
        error("Could not open the verdict's Level Ups", err);
        return null;
    }
}

/* ==========================================================================
 * THE FINAL TRIAL'S VERDICT (E41 C10b, 1.2.97; S17-28)
 * --------------------------------------------------------------------------
 * Moved here from mastermind.mjs, which re-exports both, onto the ordinary
 * verdict's lock, list, card and summary. The Mastermind's pick, its clearing
 * and the Final Trial's flag stay mastermind.mjs's, read by `import()` - its
 * split is not E41's - so the static graph holds mastermind.mjs -> verdict.mjs
 * and no edge back (R161).
 * ========================================================================== */

/**
 * The Final Trial's verdict.
 *
 * Deliberately not `applyVerdict`: the guide's consequences here
 * are a different shape entirely. A normal wrong guess executes an innocent
 * and pays the Monokumas; a wrong Final Trial guess does neither - it reveals
 * that the game was never what it looked like, and nobody new dies for it.
 *
 * "Correct" branches on the Mastermind being alive to answer for it - if they
 * already died earlier in the season, the guide's own text is the reveal
 * branch regardless of who the table names: "W wypadku gdy ten nie żyje -
 * zdemaskować, że gra w którą grają właściwie już się nie toczy."
 */
export async function openFinalVerdictDialog() {
    // ONE LOCK (E41 C10b, 1.2.97; S17-28): a GM, no verdict running here, none applied to this trial (`verdictRefusal`).
    const refused = verdictRefusal();
    if (refused) {
        ui.notifications.warn(game.i18n.localize(refused));
        return null;
    }

    const { mastermindActor } = await import("./mastermind.mjs");
    const mastermind = mastermindActor();
    if (!mastermind) {
        ui.notifications.warn(game.i18n.localize("DRPG.Mastermind.noneSet"));
        return null;
    }

    const alreadyDead = isDeadForGm(mastermind);
    /* EVERY STUDENT, "NOBODY" FIRST, ON THE ACCUSED (E41 C10b, 1.2.97; S17-28; the owner's Q-E41-2 of 01.11.2026,
       "Nikt nie jest pominięty"). The select listed every student with the first one selected and no "Nobody", so a GM
       who pressed a verdict without reading it recorded whoever sorted first as the accused. It is the ordinary
       verdict's list now (`verdictCandidates`): "Nobody named" first, then every student, the known Blackened among
       them, each one choosable - the window is the GM's alone, and the guide's Final Trial asks only whether the vote
       named the Mastermind - the dead marked as the table knows them (as the ordinary verdict reads them, after the
       audit of every student), and the count's first accused selected, dead or alive. */
    const students = studentActors();
    await judgedFor(...students.map(a => a.id));
    const dead = new Set(students.filter(a => isDeceased(flagsHeldNow(a))).map(a => a.id));
    const accusedIds = (trialProgress().accusedIds ?? []).filter(Boolean);
    const options = `<option value="">${game.i18n.localize("DRPG.Vote.nobodyNamed")}</option>${
        candidateOptions(verdictCandidates(students, { accusedIds, dead, final: true }))}`;

    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Mastermind.verdictTitle"),
        classes: ["drpg-panel"],
        body: `<form>
            <p>${game.i18n.localize("DRPG.Mastermind.verdictIntro")}</p>
            ${alreadyDead
                ? `<p class="drpg-warning">${game.i18n.localize("DRPG.Mastermind.alreadyDeadNote")}</p>`
                : ""}
            <label>${game.i18n.localize("DRPG.Mastermind.whoWasAccused")}
                <select name="accused">${options}</select></label>
            <p class="notes">${game.i18n.localize("DRPG.Mastermind.verdictNote")}</p>
        </form>`,
        /*
         * CANCEL FIRST, AND CANCEL THE DEFAULT (MM-01, Dawid 17.09).
         *
         * Both verdicts are irreversible and public - the Mastermind dies, the
         * banner goes up, the pick is cleared - and the one that answered Enter
         * or Space the moment the window opened was "They named the Mastermind".
         * Enter presses the first submit button in DOM order and `default` only
         * decides the focus, so Cancel has to be both. The two verdicts stay one
         * click each; the ordinary trial verdict (G-31) kept defaulting to the
         * likely outcome until E10 C4, which gave it Cancel first and default too.
         *
         * ON THE KIT'S ROLES (E22 C3b, 06.11.2026; audit S13-04): both verdicts are the destructive role (Blood with the
         * raster), which may never be the default, and with no primary the closing word is the first submit button in the
         * tree - Cancel first and the default, as MM-01 asked, now by the footer contract.
         */
        footer: {
            destructive: [
                {
                    action: "correct", label: game.i18n.localize("DRPG.Mastermind.correctlyNamed"),
                    disabled: alreadyDead,
                    callback: (e, b, d) => ({
                        correct: true, accusedId: d.element.querySelector("[name=accused]").value
                    })
                },
                {
                    action: "wrong", label: game.i18n.localize("DRPG.Mastermind.notCorrectlyNamed"),
                    callback: (e, b, d) => ({
                        correct: false, accusedId: d.element.querySelector("[name=accused]").value
                    })
                }
            ],
            close: "cancel",
            default: "cancel"
        },
        rejectClose: false
    });

    if (!result || result === "cancel") return null;
    return applyFinalVerdict({ ...result, alreadyDead });
}

export async function applyFinalVerdict({ correct, accusedId, alreadyDead = null } = {}) {
    /* ONE LOCK, AND HELD WHILE IT GIVES (E41 C10b, 1.2.97; S17-28). This asked for a GM and nothing else: a second Final
       verdict from the API, once a GM had picked the Mastermind again, wrote the record and the sentence a second time
       and posted a second banner, and one asked while the first was still being given ran beside it. It asks the
       ordinary verdict's lock (`verdictRefusal`) and holds `verdictRunning` until it is done, its Level Up window
       included. */
    const refused = verdictRefusal();
    if (refused) {
        ui.notifications.warn(game.i18n.localize(refused));
        return null;
    }
    verdictRunning = true;
    try {
        return await giveFinalVerdict({ correct, accusedId, alreadyDead });
    } finally {
        verdictRunning = false;
    }
}

/** `applyFinalVerdict`'s writes, inside its lock. */
async function giveFinalVerdict({ correct, accusedId, alreadyDead }) {
    const { mastermindActor } = await import("./mastermind.mjs");
    const mastermind = mastermindActor();
    if (!mastermind) return null;
    const dead = alreadyDead ?? isDeadForGm(mastermind);
    const accused = accusedId ? game.actors.get(accusedId) : null;

    const executed = correct && !dead;
    const at = Date.now();

    /* THE LOCK EVERY GM'S BROWSER CAN SEE, WRITTEN FIRST (E41 fix FG1, 02.11.2026; the end review's C-m1 = S-m1).
       `verdictRunning` is this browser's: the lock another GM's browser reads is the world's record, and this wrote
       it after the sentence, the public card and the GMs' whisper - three awaited round trips in which a second GM's
       `verdictRefusal` read no verdict, and a second Final verdict posted a second banner. Written now before any of
       them, as the ordinary verdict writes its record first (`applyVerdict`): marked final, in progress, by whom and
       when, and naming nobody. A throw in this write gives nothing.

       AND THE RECORD A FINISH READS (E42 C1c, 1.2.97; E42-06). The steps follow on the one runner (`runVerdict`,
       `FINAL_VERDICT_STEPS`), the record written after each, its stage "done" once every step is; one that stops
       leaves it "applying" with the steps not done, and Finish the verdict runs them (`finishVerdict`). The record
       holds the step keys, and never `correct`, an id or a name (the Mastermind's identity is the GMs';
       mastermind.mjs's header).

       NOR THE OUTCOME BEFORE THE CARD (E42 fix FG1, 03.11.2026; the end review's S-M1). C1c wrote whether the sentence
       waits (`sentencePending`) with this lock, so a Finish knew it without a name - and every console reads this
       record, and `sentencePending` true says the Mastermind was named and lives, before the card tells the table
       (at c0b2118c it came with the record's "done", after the card). This write is c0b2118c's shape again; the
       outcome waits in the GMs' store (`keepFinalOutcome`), and the card's step writes `sentencePending` into the
       record once the card is posted (`finalVerdictCard`). Tier 2 E41-T2 reads the record in the card's seam, E42-T11
       a Finish of a verdict stopped before its card. */
    const record = { stage: "applying", final: true, by: game.user.id, at, done: [], failed: [] };
    await setTrialProgress({ verdictApplied: true, verdict: record });
    await keepFinalOutcome(at, executed);
    await runVerdict(record, [], { executed, dead, mastermind: { id: mastermind.id, name: mastermind.name }, accused: accused?.name ?? null });
    return { executed, dead };
}

/*
 * THE FINAL VERDICT'S OUTCOME, KEPT FOR A FINISH (E42 fix FG1, 03.11.2026; the end review's S-M1): whether it sentenced
 * the Mastermind, `finalOutcome: { at, executed }` in the GMs' store (gm-stores.mjs `verdictStore`), never in the
 * world's record before the card. Written after the lock, so the lock is still the first write, as the ordinary
 * verdict keeps its Blackened (`keepVerdictBlackened`); a write that fails is logged, and a Finish before the card
 * then finds no outcome and says so at the step that needs it.
 */
async function keepFinalOutcome(at, executed) {
    try {
        await verdictStore.whenHydrated();
        await verdictStore.patch(RECORD, { finalOutcome: { at, executed: Boolean(executed) } });
    } catch (err) {
        error("Could not keep the Final Trial's verdict for a Finish", err);
    }
}

/*
 * THE FINAL VERDICT'S CONTEXT FOR A FINISH (E42 C1c; E42-06). The record names nobody, so a Finish reads the rest
 * off the GMs' side: whether the sentence waits off the record (`sentencePending`, written once the card is posted)
 * or, before the card, off the GMs' store (`finalOutcome` under the verdict's `at`, E42 fix FG1), the Mastermind off
 * the pick while it stands (`mastermindActor`), and once its step cleared it off this browser's `verdictStore`
 * (`finalSentenced` under the verdict's `finalAt`, held only when the verdict sentenced them). No Mastermind: the
 * steps that need no name run, the sentence's step fails (`finalVerdictSentence`), and the summary names nobody. No
 * outcome (`executed` null): the sentence's and the card's steps fail. The accused is not kept.
 */
async function finalContext(record) {
    const { mastermindActor } = await import("./mastermind.mjs");
    await verdictStore.whenHydrated();
    const kept = verdictStore.record();
    const id = mastermindActor()?.id ?? (kept.finalAt === record.at ? kept.finalSentenced?.[0] : null) ?? null;
    const actor = id ? game.actors.get(id) : null;
    const outcome = typeof record.sentencePending === "boolean" ? record.sentencePending
        : kept.finalOutcome?.at === record.at ? kept.finalOutcome.executed : null;
    const executed = typeof outcome === "boolean" ? outcome : null;
    return { executed, dead: Boolean(actor && !executed && isDeadForGm(actor)), mastermind: actor ? { id: actor.id, name: actor.name } : null,
        accused: null };
}

/** The Final Trial's summary to the GMs (`verdictSummaryContent`'s fields), with where it stopped (`stepsReport`'s warnings). */
function finalSummary(final, report) {
    const esc = foundry.utils.escapeHTML;
    return {
        title: "DRPG.Mastermind.verdictTitle",
        summary: game.i18n.format("DRPG.Mastermind.verdictSummary", {
            mastermind: esc(final.mastermind?.name ?? "-"),
            accused: esc(final.accused ?? "-"),
            outcome: game.i18n.localize(final.executed ? "DRPG.Mastermind.outcomeExecuted"
                : final.dead ? "DRPG.Mastermind.outcomeAlreadyDead" : "DRPG.Mastermind.outcomeEscaped")
        }),
        warning: report.warnings.join(" ")
    };
}

/*
 * THE MASTERMIND DIES WHEN THE TRIAL ENDS, AS ANY CONVICT (E70 C4, 28.10.2026; DC36, the plan's point (g)).
 * This killed the Mastermind in the verdict (E11 fix r2-H1 gave the death the trial's phase, so no walk past
 * the body found it). The sentence waits now for the trial's end (trial-progress.mjs `executeAtExit`, which keeps that
 * phase), and lives in the GMs' store, never in the world's record, which every console reads and which
 * names nobody (the owner's Q2 answer, 27.10.2026; mastermind.mjs's header): `finalSentenced` under the verdict's
 * `at` (`finalAt`). A verdict given after End the trial is carried out at once (`finalVerdictExecution`).
 * A write that fails fails the step since E42 C1c (it was logged and passed over, and the trial's end then told the
 * GMs the sentence was missing): the verdict stops here - its execution and the clearing of the pick wait on it since
 * E42 fix FG1 (`VERDICT_NEEDS`) - and Finish the verdict writes it.
 */
async function finalVerdictSentence(context) {
    const { executed, mastermind } = context.final;
    if (executed === null) throw new Error("the Final verdict's outcome is not known on this browser");
    if (!executed) return;
    if (!mastermind?.id) throw new Error("the Mastermind sentenced is not known on this browser");
    await verdictStore.whenHydrated();
    await verdictStore.patch(RECORD, { finalAt: context.record.at, finalSentenced: [mastermind.id] });
}

/*
 * ONE CARD (E41 C10b; S17-28): the ordinary verdict's builder, with the Mastermind's words. It carries the verdict's
 * `at` (`verdictAt`, a time) since E42 C1c, so a Finish after a GM left between the card and its record posts no
 * second banner (`verdictCardPosted`, as the ordinary card's step reads it). Once the card is posted the record takes
 * whether the sentence waits (`sentencePending`, saved with the step's done; E42 fix FG1): the table has just read it.
 */
async function finalVerdictCard(context) {
    const { executed } = context.final;
    if (executed === null) throw new Error("the Final verdict's outcome is not known on this browser");
    if (!verdictCardPosted(context.record)) {
        await announce(verdictCardContent({
            banner: executed ? "DRPG.Mastermind.defeatedBanner" : "DRPG.Mastermind.revealedBanner",
            lines: [game.i18n.localize(executed ? "DRPG.Mastermind.defeatedText" : "DRPG.Mastermind.revealedText")],
            flags: { [MODULE_ID]: { verdictAt: context.record.at ?? null } },
            tone: "objection"
        }));
    }
    context.record = { ...context.record, sentencePending: executed };
}

/*
 * THE FLAG COMES DOWN WITH THE VERDICT (E10 C10, 1.2.71; audit S06-16). After the Mastermind's verdict the console
 * still offered the ordinary one as the next step, and "This trial is the Final Trial." stayed on it - into the next
 * season's first trial as well, since a reset's clock step merged over the flag (season-setup.mjs `wipeSeason`).
 */
async function finalVerdictClose() {
    const { setFinalTrial } = await import("./mastermind.mjs");
    await setFinalTrial(false);
}

// Given after End the trial: no exit is left to carry the sentence out, so it is carried out now (E70 C4).
async function finalVerdictExecution(context) {
    if (!context.final.executed || getClock().phase === "classTrial") return;
    await executeAtExit();
}

/*
 * THE LEVEL UPS THAT WAITED FOR THE CLASS ARE PICKED NOW (E05 C11, 27.09.2026; the
 * owner's Q7, option b). A Reinforced Level Up left by a wrong verdict waits for the
 * class's next correct one, and a season can end on the Final Trial before there is one:
 * the season's secrets are out here anyway, and a table that keeps advancement across
 * seasons would otherwise lose it. Only what waited - the Final Trial hands out nothing
 * of its own - and never to a Mastermind sentenced to die (E70 C4: alive until the trial ends, whose
 * kill drops their row).
 *
 * ONCE, WHOEVER FINISHES (E42 C1c; E42-06). The batch's throw was logged and passed over, under a record that
 * said done: what waited was never given. A throw or a window that does not open fails the step now, and a
 * Finish runs it again over what this batch already gave - kept in the GMs' store, never the world's record,
 * which names nobody (`verdictStore.finalGiven`: the verdict's `at` and the students given) - and the row it was
 * giving (`verdictStore.giving`, as the ordinary verdict's batch).
 */
async function finalVerdictLevelUps(context) {
    const { executed, mastermind } = context.final;
    const at = context.record.at;
    await verdictStore.whenHydrated();
    const givenOf = () => {
        const kept = verdictStore.record()?.finalGiven;
        return kept?.at === at && Array.isArray(kept.ids) ? kept.ids : [];
    };
    const done = await promptAdvancements(livingStudentsForGm().filter(actor => !(executed && actor.id === mastermind?.id)), null, {
        given: givenOf(),
        giving: givingOf(at),
        onGiving: (actor, counts) => keepGiving(at, actor, counts),
        onGiven: async actor => {
            await verdictStore.patch(RECORD, { finalGiven: { at, ids: [...givenOf(), actor.id] } });
            await keepGiving(at, null);
        }
    });
    if (done === null) throw new Error("the Level Ups that waited did not open");
}

// The season is over either way - a Final Trial is the guide's ending, not
// a chapter like the others. Clearing the pick here rather than leaving it
// set is what makes `mastermindActor()` honestly answer "nobody" afterwards.
async function finalVerdictMastermind() {
    const { clearMastermind } = await import("./mastermind.mjs");
    await clearMastermind();
}
