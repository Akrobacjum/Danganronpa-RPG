/**
 * Danganronpa RPG - Edit campaign.
 * ---------------------------------------------------------------------------
 * The GM's window for correcting the clock and the campaign (`openClockDialog`), with End the chapter apart at its
 * foot (`endChapterPart`, `endTheChapter`; E49 A2), its fields (`campaignRows`) and what its Apply writes
 * (`applyCampaignForm`) - which Season setup draws at its top and runs on its Save since E49 A1e (season-setup.mjs
 * `openSeasonSetup`),
 * the question it asks before a field that does more than correct
 * (`confirmCorrection`), what its Apply reads (`readClockForm`), and whether a change of the time of day or the session
 * is a correction rather than the hour passing, so that an assembly called for
 * the hour is called off first (`correctsTheHour`).
 *
 * WHERE IT SITS. Moved out of gm-panel.mjs by E41 C7a (1.2.97), a pure move
 * that `node tools/moved-only.mjs` proves line by line. gm-panel.mjs re-exports
 * the two names here it exported before (`correctsTheHour`, `openClockDialog`),
 * so every importer still imports gm-panel.mjs, and the panel's tile reaches the
 * window through it; nothing here imports it back (the facade rule,
 * .claude/rules/code.md).
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES, CHAPTERS_PER_SEASON } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { getClock, setClock } from "./clock.mjs";
import { resetAllActions } from "./actions.mjs";
import { isEclipse } from "./eclipse.mjs";
import { error, esc, wholeNumber } from "./utils.mjs";
import { stepper, stepperId, drpgWindow, drpgConfirm, formGrid, helpText, box, roleButton, tipAttr, tipText } from "./ui-kit.mjs";
import { alreadyOpen, RAISED } from "./live.mjs";
import { trialScene } from "./rooms.mjs";


/**
 * WHETHER AN EDIT CAMPAIGN WRITE IS A CORRECTION OF THE HOUR, NOT THE HOUR PASSING (E11 C6, 1.2.73; audit
 * S01-12, S10-22). A called assembly is held by `runPendingGather` (call-world.mjs) on the next clock write
 * whose time of day or session differs from the one it was called in, whatever moved them: it cannot tell
 * the hour turning from a GM putting it back. Edit campaign moving the afternoon back to the morning, or
 * fixing only the session number, held an assembly called for the evening - the cast teleported and a public
 * card, from a window meant for typos. So the window calls it off first, as `rewindTimeOfDay` does (clock.mjs,
 * "THE ASSEMBLY GOES FIRST"), whenever the time of day or the session changes and the day and the time of day
 * do not move on (or the session goes back). A move on - Day 2's evening to Day 3's morning - is the hour
 * passing, and the assembly is held as it would be at the panel's next time of day. Measured in tier 2 "Edit
 * campaign moving the time back calls nobody" and scenario 65's C2.
 *
 * A NEW DAY AT THE SAME HOUR IS NOT THE HOUR PASSING (E11 fix r1-G5, 1.2.73; round 1's EARLY-C6-1). C6 counted
 * any later day as a move on, so Day 3's morning in session 5 corrected to Day 4's morning in session 6 held the
 * assembly - the session differs, which is all `runPendingGather` compares - and the cast was moved by a typo
 * fix: the tier-2 test's "day and session" road read the assembly held with the code before this (11.10.2026).
 * The hour passing changes the time of day, so a move on now needs one; its "onward" road (Night to the next
 * day's morning, the session on) is the hour passing and still holds the order.
 */
export function correctsTheHour(from, to) {
    const at = clock => [Number(clock.day ?? 1), TIMES_OF_DAY.indexOf(clock.timeOfDay), Number(clock.session)];
    const [dayWas, hourWas, sessionWas] = at(from), [day, hour, session] = at(to);
    if (hour === hourWas && session === sessionWas) return false;
    const onward = hour !== hourWas && (day > dayWas || (day === dayWas && hour > hourWas));
    return !onward || session < sessionWas;
}

/* A question Edit campaign asks before a field that does more than correct (E11 C6). Cancel is the first button
   and the only default, as `confirmNewTrial`'s (trial-floor-ui.mjs): Enter presses the first submit button (E10
   C4's finding), so Enter keeps what the clock holds; the rest of the window is applied either way. `more` is
   a second paragraph, already localized (E13 C6: where the trial takes the table). On the kit (E21 C2b): the yes is
   secondary, so the right group is empty and Cancel is the first submit button and the default, as before. */
async function confirmCorrection(titleKey, textKey, more = "") {
    const answer = await drpgWindow({
        title: game.i18n.localize(titleKey),
        classes: ["drpg-panel", "drpg-narrow", "drpg-window-correction"],
        body: `<p>${game.i18n.localize(textKey)}</p>${more ? `<p>${more}</p>` : ""}`,
        footer: { secondary: [{ action: "ok", label: game.i18n.localize(titleKey) }], close: { role: "cancel", action: "cancel" } },
        rejectClose: false
    });
    return answer === "ok";
}

/**
 * What Edit campaign's Apply hands back (E47-C2; exported for R2058): the name trimmed, the chapter, day and session
 * whole numbers from 1, the chapter no higher than its stepper's `max` (the season's chapters, or the clock's chapter past
 * them) - read as season-setup.mjs `readSeasonForm` reads its own chapter - and the phase, the time of day and the box.
 */
export function readClockForm(dialog) {
    const form = dialog.element.querySelector("form");
    const top = Math.max(CHAPTERS_PER_SEASON, Math.round(Number(form.chapter.max)) || 0);
    return {
        campaignName: form.campaignName.value.trim(),
        chapter: wholeNumber(form.chapter.value, { min: 1, max: top, fallback: 1 }),
        day: wholeNumber(form.day.value, { min: 1, fallback: 1 }),
        phase: form.phase.value,
        session: wholeNumber(form.session.value, { min: 1, fallback: 1 }),
        timeOfDay: form.timeOfDay.value,
        reset: form.reset.checked
    };
}

/*
 * END THE CHAPTER, APART (E49 A2, 10.11.2026; the owner's [12] "End the chapter wrzucmy do edit campaign" and [16] "tak"
 * to its confirm and warning frame). The panel's tile went; its door is the last part of this window, under the form, in
 * the kit's warning box, with a destructive button of its own: what it starts reveals, sweeps and names the Blackened,
 * which is everything the chapter field above says it does not do. The button closes this window WITHOUT its Apply - an
 * end and a correction in one press would write the clock twice, and the end reads the clock as it stands - then asks
 * once more (`endTheChapter`, Cancel the default), and only a yes opens chapter.mjs `openChapterEndDialog`, which asks
 * its own questions and runs the end once. Cancel at either step writes nothing. The part is drawn in every state of
 * the clock (the owner's rule: a state changes look, never layout); `openChapterEndDialog` refuses what it refuses.
 */
export function endChapterPart() {
    const L = key => game.i18n.localize(key);
    return box("warning", `<p>${esc(L("DRPG.Clock.endChapterNote"))}</p>`, {
        action: roleButton({ role: "destructive", label: L("DRPG.Chapter.endTitle"), attrs: { "data-drpg-end-chapter": "1" } })
    });
}

/* The question between the button and the chapter's end (see above): the yes destructive, Cancel the default. `run` is
   chapter.mjs `openChapterEndDialog`, or the suite's stand-in (`roads.endChapter`). The part and the question exported
   since E49 A1e: Season setup draws the same part under the same fields and asks the same question. */
export async function endTheChapter(run) {
    const yes = await drpgConfirm({
        title: game.i18n.localize("DRPG.Chapter.endTitle"),
        classes: ["drpg-panel", "drpg-narrow", "drpg-window-chapter-end-ask"],
        body: `<p>${esc(game.i18n.localize("DRPG.Clock.endChapterAsk"))}</p>`,
        yes: { role: "destructive", label: game.i18n.localize("DRPG.Chapter.endTitle") },
        rejectClose: false
    });
    if (yes !== true) return null;
    return run();
}

/**
 * EDIT CAMPAIGN'S FIELDS (E49 A1e, 11.11.2026; the owner: "Season setup becomes the one place for setting up the season",
 * with Edit campaign's content at its top and each field once). The kit form grid's rows as `openClockDialog` drew them
 * inline until this commit, moved here unchanged: the six fields in their order, then the refill box and its fine print.
 * Season setup draws the same rows (season-setup.mjs `campaignFieldsHtml`) with its own after the six (`extra`: the
 * safeword, which only it has) and the name field's `autofocus` (S01-19); Edit campaign passes neither, so its markup is
 * what it was. What both windows read back is `readClockForm`, and what both write is `applyCampaignForm`.
 */
export function campaignRows(clock, { extra = [], autofocus = false } = {}) {
    const times = TIMES_OF_DAY
        .map(t => `<option value="${t}"${t === clock.timeOfDay ? " selected" : ""}>${TIME_OF_DAY_LABELS[t]}</option>`)
        .join("");

    const phases = Object.entries(PHASES)
        .map(([key, p]) => `<option value="${key}"${key === clock.phase ? " selected" : ""}>${p.label}</option>`)
        .join("");

    // Never shorter than the clock (the stepper's `max` since E47-C2, the select's list
    // before it): a clock past the season's last chapter found no matching option, the
    // browser selected "1", and Apply wrote it.
    //
    // COERCED ONCE AND USED TWICE (GMP-03). `n === clock.chapter` is a strict
    // compare, so a world holding the string "7" would have matched nothing and
    // put the browser back on "1". Anything below 1 or unreadable falls back to 1
    // rather than building a list of length NaN out of a world setting.
    const stated = Number(clock.chapter);
    const now = Number.isFinite(stated) && stated >= 1 ? Math.round(stated) : 1;

    /*
     * ON THE KIT'S FORM GRID, THE CHAPTER A STEPPER (E47-C2, 09.11.2026; the owner's M7 card, Approve, and Q-E47-1; Q-E44-3
     * kept it "a select until E47"). The six fields in their order beside the label column, each label pointing at its
     * field by `for` (the 21.09 fault: never at a stepper's minus), then the refill box and its fine print across both
     * columns. Until E47 four rules of danganronpa.css (E32+E07 C14) laid out `<label>Name <field></label>` rows as a
     * grid. The chapter's stepper runs from 1 to the season's chapters, or to the clock's chapter past them - the range
     * the select listed - and Apply reads it as Set the season up reads its own (`readClockForm`).
     */
    const ids = { name: stepperId(), chapter: stepperId(), phase: stepperId(), day: stepperId(), session: stepperId(), time: stepperId() };
    const L = key => game.i18n.localize(key);
    return [
        { label: L("DRPG.Clock.campaignName"), id: ids.name,
          field: `<input type="text" name="campaignName" id="${ids.name}"${autofocus ? " autofocus" : ""}
                       value="${foundry.utils.escapeHTML(clock.campaignName ?? "")}"
                       placeholder="${foundry.utils.escapeHTML(game.world?.title ?? "")}"${tipAttr("DRPG.Tips.Gm.campaignNameTooltip")} />` },
        { label: L("DRPG.Clock.chapter"), id: ids.chapter,
          field: stepper({ name: "chapter", value: now, min: 1, max: Math.max(CHAPTERS_PER_SEASON, now), step: 1, id: ids.chapter,
                         attrs: { "data-tooltip": tipText("DRPG.Tips.Gm.chapterTooltip") } }) },
        { label: L("DRPG.Clock.phase"), id: ids.phase, field: `<select name="phase" id="${ids.phase}"${tipAttr("DRPG.Tips.Gm.phaseTooltip")}>${phases}</select>` },
        { label: L("DRPG.Clock.day"), id: ids.day, field: stepper({ name: "day", value: clock.day ?? 1, min: 1, step: 1, id: ids.day }) },
        { label: L("DRPG.Clock.session"), id: ids.session, field: stepper({ name: "session", value: clock.session, min: 1, step: 1, id: ids.session }) },
        { label: L("DRPG.Clock.timeOfDay"), id: ids.time, field: `<select name="timeOfDay" id="${ids.time}">${times}</select>` },
        ...extra,
        { full: "<hr />" },
        { full: `<label class="drpg-checkbox">
                    <input type="checkbox" name="reset" />
                    ${L("DRPG.Panel.alsoReset")}
                </label>` },
        { full: helpText("DRPG.Panel.resetHint") }
    ];
}

/**
 * The next morning's line, Edit campaign's last field (E94 C1; the plan's default: "a GM field in Edit campaign"): what
 * the start-of-day board says under MORNING ANNOUNCEMENT. It is kept on this browser (`morningLineDraft`), in no world
 * data, until the Night's advance puts it on the clock at the day's start; empty, the board shows no line.
 */
export function morningLineRow() {
    const id = stepperId();
    let draft = "";
    try { draft = String(game.settings.get(MODULE_ID, SETTINGS.morningLineDraft) ?? ""); } catch { draft = ""; }
    return { label: game.i18n.localize("DRPG.Clock.morningLine"), id,
        field: `<textarea name="morningLine" id="${id}" rows="2" maxlength="200">${foundry.utils.escapeHTML(draft)}</textarea>${helpText("DRPG.Clock.morningLineHint")}` };
}

/** Edit campaign. `roads.endChapter` stands in for chapter.mjs `openChapterEndDialog` (the suite's; E49 A2). */
export async function openClockDialog({ roads = {} } = {}) {
    // ONE OF THESE, NOT FOUR - see `alreadyOpen` in live.mjs. Two copies of a
    // window each read the world when they opened and neither knows about the
    // other, so the older one goes on looking authoritative while showing
    // something that stopped being true. Raised rather than refused: pressing
    // twice usually means the window is behind something.
    if (alreadyOpen("drpg-window-clock")) return RAISED;

    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly"));
        return;
    }

    const clock = getClock();
    let endAsked = false;
    const result = await drpgWindow({
        title: game.i18n.localize("DRPG.Panel.jump"),
        classes: ["drpg-panel", "drpg-window-clock"],
        body: `<form>${formGrid(campaignRows(clock, { extra: [morningLineRow()] }))}</form>${endChapterPart()}`,
        render: (event, dialog) => {
            dialog.element.querySelector("[data-drpg-end-chapter]")?.addEventListener("click", ev => {
                ev.preventDefault();
                endAsked = true;
                dialog.close();
            });
        },
        // Apply still to answer: Cancel (E21 rule 3), the answer "cancel" as before.
        footer: {
            primary: {
                action: "ok",
                label: game.i18n.localize("DRPG.Panel.apply"),
                callback: (event, button, dialog) => ({ ...readClockForm(dialog), morningLine: dialog.element.querySelector("[name=morningLine]")?.value ?? "" })
            },
            close: { role: "cancel", action: "cancel" }
        },
        rejectClose: false
    });

    if (endAsked) return endTheChapter(roads.endChapter ?? (() => import("./chapter.mjs").then(m => m.openChapterEndDialog())));
    if (!result || result === "cancel") return;
    // the next morning's line stays on this browser until the day starts (E94 C1; clock.mjs `advanceTimeOfDay`)
    await game.settings.set(MODULE_ID, SETTINGS.morningLineDraft, String(result.morningLine ?? "").slice(0, 400)).catch(() => null);
    return applyCampaignForm(result);
}

/**
 * WHAT EDIT CAMPAIGN'S APPLY WRITES, AND THE QUESTIONS BEFORE IT (E49 A1e: moved here from `openClockDialog`'s tail
 * unchanged, so Season setup's Save runs the same writes with the same questions; season-setup.mjs `openSeasonSetup`).
 * `result` is `readClockForm`'s. Answers nothing; every write is `setClock`'s, `resetAllActions`' and the search tokens'
 * reset, as Edit campaign's were.
 */
export async function applyCampaignForm(result) {
    /*
     * MOVING THE CLOCK DOES NOT END AN ECLIPSE, and until E17 nothing said so.
     *
     * Measured: an Eclipse running, the GM sets the time here to correct
     * something, and the world lands on Morning with `eclipse` still true. The
     * Eclipse owns token placement and refuses every murder while it is on, and
     * this window has no field to turn it off with - it is ended from the panel.
     *
     * A REFUSAL WOULD BE WRONG. A GM correcting a botched clock in the middle of
     * an Eclipse is doing something legitimate, and taking the tool away to
     * protect them from a state they may well want is the kind of help nobody
     * asked for. So: the write goes through, and they are told. The summary line
     * now carries the Eclipse too, so this is a nudge rather than the only sign.
     *
     * ONLY WHEN THE WRITE ACTUALLY MOVED THE CLOCK (GMP-04, 20.09).
     *
     * The condition below was `result.timeOfDay !== undefined`, and `timeOfDay` is
     * a select this form always submits - SO IT WAS TRUE ON EVERY APPLY. A GM who
     * opened this window during an Eclipse to fix the campaign name was told the
     * clock had moved and the Eclipse was still running; it had not moved. This
     * sentence is the module's only sign of an Eclipse that is silently refusing
     * every murder and handing out free placement, and a warning that fires when
     * nothing happened is a warning a GM stops reading.
     *
     * Compared against the clock as it stands at the moment of the write, not the
     * one this window was built from: it is not a live window, and a GM may leave
     * it open while somebody starts an Eclipse or the time of day turns. The
     * session counter and the phase are deliberately not in the comparison - they
     * are bookkeeping, not time.
     */
    const before = getClock();

    /* THE PHASE SELECT IS A DOOR INTO A TRIAL TOO (E10 C11, 1.2.71; audit S06-33; D17). Moving it to
       Class Trial in a chapter whose trial has a verdict blanks that verdict (`reconcilePhase`), so it
       asks as Start the Class Trial does, Cancel the default; Cancel keeps the phase and applies the
       rest of the window. The clock is read again here, not through `before`: R69 keeps the phase out of
       that comparison.
       THE CHAPTER IT MOVES TO, AND NOT IN AN ECLIPSE (E10 fix r2-G5, 1.2.71; round 2's cor m3 and goal
       S06-18). This asked only when the chapter stayed, but the write blanks the record of the chapter it
       lands on, so moving back to a chapter whose trial has a verdict and into its trial blanked that
       verdict unasked: the question reads the record of `result.chapter`. And `setClock` refuses a trial
       opened in an Eclipse, which would drop the whole window; here only the phase is kept and the GM
       told, as Cancel keeps it. Measured in tier 2 "Edit campaign moving back to a chapter with a verdict
       asks first" and "no road opens the trial in an Eclipse", both red at c494855. */
    /* THE CHAPTER NUMBER HERE IS A CORRECTION, AND IT SAYS SO (E11 C6, 1.2.73; audit S10-21). Moving it was
       a plain write: no reveal, no sweep of the Remnants, no Blackened named, no session or morning - none of
       what End the chapter does - and nothing told the GM that the chapter had not ended. It asks first,
       Cancel the default; Cancel keeps the chapter on the clock and applies the rest of the window, as the
       phase's Cancel below does (the orchestrator's decision of 10.10.2026 on the prep's proposal). Asked
       before the trial's question, so that question reads the chapter actually written. Measured in tier 2
       "Edit campaign asks before it changes the chapter or opens the trial and Cancel applies the rest". */
    let chapter = result.chapter;
    if (chapter !== Number(getClock().chapter)
        && !(await confirmCorrection("DRPG.Clock.chapterCorrectTitle", "DRPG.Clock.chapterCorrect"))) {
        chapter = getClock().chapter;
    }

    /* AND ENTERING THE TRIAL FROM HERE IS NOT A CORRECTION (E11 C6; audit S10-22). The phase moved into the
       Class Trial runs `reconcilePhase`'s entry (clock.mjs): the trial's budget handed out, the chapter's trial
       record blanked and Monokuma's charge for the Key Remnants nobody found - Despair that no Edit campaign
       takes back. So it asks first, Cancel the default, and only then E10 C11's question about a verdict.
       And it says that the trial takes the table to the linked hall (E13 C6; plan-E13 C6): since E13 C3 this
       write activates the hall as Start the Class Trial's does, and the question named only the budget and the
       charge. One sentence, only when a hall is linked - with none the table stays. Scenario 41 d1 reads it. */
    let phase = result.phase;
    if (phase === "classTrial" && getClock().phase !== "classTrial") {
        const hall = trialScene();
        const moves = hall ? game.i18n.format("DRPG.TrialScene.phaseSwitchesScene", { hall: esc(hall.name) }) : "";
        if (isEclipse()) {
            ui.notifications.warn(game.i18n.localize("DRPG.Floor.eclipseFirst"));
            phase = getClock().phase;
        } else if (!(await confirmCorrection("DRPG.Clock.trialFromEditTitle", "DRPG.Clock.trialFromEdit", moves))) {
            phase = getClock().phase;
        } else {
            const { confirmNewTrial } = await import("./trial-floor-ui.mjs");
            if (!(await confirmNewTrial(Number(chapter)))) phase = getClock().phase;
        }
    }

    /* AND AGAIN JUST BEFORE THE WRITE (E11 fix r1-G5; round 1's EARLY-C6-3). The Eclipse above was read before
       the two questions, which wait for the GM; an Eclipse started meanwhile made `setClock` refuse the whole
       write after the assembly had been called off - the order gone, the rest of the window dropped (tier 2 "an
       Eclipse begun during Edit campaign's trial question keeps the rest of the window" read the time of day
       and the name unwritten with the code before this, 11.10.2026). Read again here, with nothing awaited
       between it and the write: the phase is kept and the GM told, as above. */
    if (phase === "classTrial" && getClock().phase !== "classTrial" && isEclipse()) {
        ui.notifications.warn(game.i18n.localize("DRPG.Floor.eclipseFirst"));
        phase = getClock().phase;
    }

    const patch = {
        campaignName: result.campaignName,
        chapter,
        day: result.day,
        phase,
        session: result.session,
        timeOfDay: result.timeOfDay
    };
    // Before the write, as the rewind's: the write's own `onChange` reaches the primary GM's `runPendingGather`
    // before a line after it would run. See `correctsTheHour`.
    if (correctsTheHour(getClock(), patch)) {
        await import("./call-effects.mjs").then(m => m.cancelGather()).catch(err => error("Could not call off the assembly", err));
    }

    await setClock(patch);

    const moved = result.timeOfDay !== before.timeOfDay
        || result.day !== (before.day ?? 1)
        || chapter !== before.chapter;
    if (before.eclipse && moved) {
        ui.notifications.warn(game.i18n.localize("DRPG.Clock.eclipseStillOn"));
    }

    // Editing the clock is bookkeeping. Only refill when explicitly asked,
    // otherwise a typo correction would hand everyone fresh actions.
    //
    // AND ONLY REFILL (GMP-02, 17.09). This used to run the whole time-of-day
    // boundary, changed time or not: one time of day off Monokuma's motive
    // deadline, every seal and chain cleared mid-hour, an overflow check and a
    // public time-of-day card - for a box that says "also refill actions and
    // search tokens", in a window whose purpose is correcting mistakes.
    // Moving the clock on is the panel's Eclipse and next-time-of-day buttons.
    if (result.reset) {
        await resetAllActions();
        const { SearchTokens } = await import("./search-tokens.mjs");
        await SearchTokens.reset({ notify: false });
        ui.notifications.info(game.i18n.localize("DRPG.Panel.refilled"));
    }
}
