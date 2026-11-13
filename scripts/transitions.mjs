/**
 * THE PHASE TRANSITIONS (E62 C1, C2, C4, C8; 12.11.2026; the owner's 26.09 and 10.10, the storyboard SB-R1 and the
 * approved mockups MK-R1, MK-R2 and MK-R3 of 05.11).
 * ---------------------------------------------------------------------------
 * A change of the time of day, of the phase or of the Eclipse turns the curtain in a direction of its own instead of
 * always from the centre: evening to night batch by batch from the top down (E62-1), night to morning from the bottom up
 * (E62-2), into the Eclipse from the centre outward (E62-4), into the Investigation random groups of panes, each lit
 * with a flash and its own sound, at uneven gaps (E62-3, MK-R3). The entry into the Class Trial is E61's sequence
 * (sequence.mjs) and plays nothing here; the exit out of it is E61's too, started here (`playTrialExit`), with the
 * day's boards after it when the same Finish opens the next morning. What every transition holds:
 *
 *   FROM THE CLOCK'S ONE EVENT. The hooks the clock's row of the sync bus fires on every browser (`drpgTimeOfDayChanged`,
 *     `drpgPhaseChanged`, `drpgEclipseChanged`), read against the clock this page last saw. Nothing waits for it: the
 *     state is the world's at the write, and the transition is the curtain's turn of that state (glass.mjs `hintTurn`).
 *   DOM ONLY. No setting, document or flag is written here (R3712 reads the write log).
 *   STILL UNDER REDUCED MOTION. The curtain turns nothing there (glass.mjs `turnPlan`), and no flash plays, nor its sound.
 *   THE TABLE'S SWITCH (E61's `sequences`): off, the curtain turns as it did before E62, from the centre, and the flashes
 *     and their sounds are not played.
 *   ESC. While a transition runs, Escape ends it on this browser at its end state (sequence.mjs `holdEscape`).
 *   CUT, NOT QUEUED. A second change cancels the running turn (glass.mjs `glassTurn`, R1412) and its flashes' timers.
 *   A LATE CLIENT sees the end state: the bus's `heard` is read at ready, so a page that loads mid-hour is told nothing.
 *
 * And the body's discovery (C4, the owner's 10.10 and its 14:10 answer): the curtain's seams and pulse flicker on every
 * browser from the announcement of the body (`drpgBodyAnnounced`) - at most three times a second, never the whole
 * screen - and stand as they were after it.
 *
 * No new sound for a phase change (the owner's sound rule A of 11.10: the music changes with the phase); one Sound row,
 * "Pane flash", for the Investigation's flashes (MK-R1 #11).
 */

import { getClock } from "./settings.mjs";
import { reducedMotion } from "./motion.mjs";
import { count } from "./perf-counters.mjs";
import { sequencesOn, holdEscape, playDayStart, playDayEnd, playTrialExit, whenTrialExitEnds } from "./sequence.mjs";

const HOURS = ["morning", "noon", "afternoon", "evening", "night"];

/*
 * E62-3's onsets (MK-R3, the owner's 05.11 amend): six groups, gaps 360, 540, 420, 610 and 470 ms - about 2.8 s, accepted
 * as an exception to the 1.5 s limit - never more than three in any second. `flashRate` holds a table to that.
 */
export const INVESTIGATION_ONSETS = Object.freeze([0, 360, 900, 1320, 1930, 2400]);
/* The discovery's flicker: four onsets 450 ms apart, the plan's Q7 default of 1.6 s (MK-R3's frame 1 to 3) for the
   length of the sound the module cannot read; three in a second at most. */
export const DISCOVERY_ONSETS = Object.freeze([0, 450, 900, 1350]);
const FLICKER_MS = 220;

/** The most onsets of `onsets` (ms) inside any window of `windowMs` (1000 by default): the flash rule's count. Pure. */
export function flashRate(onsets, windowMs = 1000) {
    const t = [...onsets].sort((a, b) => a - b);
    let most = 0;
    for (let i = 0; i < t.length; i++) {
        let n = 0;
        for (let k = i; k < t.length && t[k] - t[i] < windowMs; k++) n++;
        most = Math.max(most, n);
    }
    return most;
}

const hourIndex = h => HOURS.indexOf(h);

/**
 * What the curtain plays for the clock moving from `before` to `after` (E62 C1), pure: `{ kind, how, groups?, delays?,
 * dur?, flashes? }`, `{ kind: "trialEntry" | "trialExit", owner: "E61" }` for E61's own edges - the exit naming
 * `newDay` when the same write opened a later day (a chapter's end whose next morning is heard in one run) -, or null
 * for no change of any of the
 * three. The Eclipse wins over the hour and the phase in one write (its start moves the hour with it); the phase over
 * the hour. An hour forward runs from the top (E62-1's gesture, the plan's Q5 default), an hour back - the GM's rewind -
 * and a new day from the bottom (E62-2).
 */
export function transitionFor(before, after) {
    if (!before || !after) return null;
    const ecl = b => b?.eclipse === true;
    const day = c => Number(c?.day) || 0;
    if (!ecl(before) && ecl(after)) return { kind: "eclipseIn", how: "centre", dur: 1400 };
    /* THE MORNING ECLIPSE'S END IS A NEW DAY TOO (12.11.2026; the owner's report at a real table on 1.2.109). The curtain
       clock's right chevron and the panel's Eclipse button end it with the advance (eclipse.mjs `endEclipse`): one write
       of the Eclipse's end, the morning and the day + 1. Answered here before the day was read, it never named the new
       day, and the boards never played on that road (R4400). The turn stays the Eclipse's; `newDay` says the day moved. */
    if (ecl(before) && !ecl(after)) return { kind: "eclipseOut", how: "inward", dur: 1400, newDay: day(after) > day(before) };
    if (before.phase !== after.phase) {
        if (after.phase === "classTrial") return { kind: "trialEntry", owner: "E61" };
        if (after.phase === "investigation") return { kind: "investigation", how: "random", groups: INVESTIGATION_ONSETS.length, delays: [...INVESTIGATION_ONSETS], dur: 2800, flashes: [...INVESTIGATION_ONSETS] };
        /* THE EXIT IS E61'S (the owner's decision of 12.11.2026): no direction for the curtain here - the sequence closes
           and opens it, and with the table's switch off the curtain turns from the centre as it always did. */
        if (before.phase === "classTrial") return { kind: "trialExit", owner: "E61", ...((Number(after.day) || 0) > (Number(before.day) || 0) ? { newDay: true } : {}) };
        return { kind: "phase", how: "centre" };
    }
    if (before.timeOfDay !== after.timeOfDay || day(before) !== day(after)) {
        const back = day(after) < day(before) || (day(after) === day(before) && hourIndex(after.timeOfDay) < hourIndex(before.timeOfDay));
        const newDay = day(after) > day(before);
        return { kind: back ? "hourBack" : newDay ? "newDay" : "hour", how: back || newDay ? "bottom" : "top", dur: 1150 };
    }
    return null;
}

let seen = null;
let flashTimers = [];
let seed = 1;

function clearFlashes() {
    for (const t of flashTimers) clearTimeout(t);
    flashTimers = [];
}

/** Light the curtain's seams and pulse, or under Monokuma Legacy the clock's, the status', Despair's and the notice tile's
    frames, for `ms` (DOM only; a class the stylesheets animate, under reduced motion never set). */
function flicker(ms = FLICKER_MS) {
    const body = document.body;
    body.classList.add("drpg-flicker");
    flashTimers.push(setTimeout(() => body.classList.remove("drpg-flicker"), ms));
}

function playFlashSound() {
    import("./sfx-play.mjs").then(m => m.playSfx("paneFlash")).catch(() => null);
}

/**
 * Which of the day's boards the move `t` (`transitionFor`'s) from `before` to `clock` plays: "end", "start", "both" or
 * null. Pure. THE OWNER'S RULE OF 13.11.2026, at a table on 1.2.112: "The start-of-day animation should show at the
 * start of the Morning Eclipse, and the end-of-day one after the Night Eclipse (that is, at the start of Night)." Until
 * then both boards played back to back at the roll-over (Next from Night, or the Morning Eclipse's end). Now:
 *
 *   END    Night begins: the Night Eclipse's end with the advance (Evening and the Eclipse to Night), or Evening to Night
 *          with no Night Eclipse held - on the same day, the clock stamped for it (`nightBoard` on that day: clock.mjs
 *          `advanceTimeOfDay` through sequence.mjs `dayStartPatch`, `nightFalls`). It reads the day that is ending.
 *   START  The Morning Eclipse begins (Night to Night and the Eclipse), the clock stamped with the day it leads into
 *          (`dayBoard` on the day + 1: eclipse.mjs `startEclipse`), or Night to Morning with no Morning Eclipse held, the
 *          new day stamped by the real roll-over (`dayBoard` on that day). The Morning Eclipse's end plays none: its
 *          board played at its start, under the same key (sequence.mjs `dayStartClock`, `dayStartKey`).
 *   BOTH   The next morning at a chapter's end (chapter.mjs: `dayBoard` on that day and `nightBoard` on the day it
 *          closes), heard with the trial's exit in one run or after it in a run of its own: the trial held the Night, so
 *          the day's end is shown before the next day's start, after the exit (`boards`). A browser that played the day's
 *          end at Night plays it no second time (one start per key), and hands on at once.
 *
 * Edit campaign writes neither stamp (and `setClock` takes `dayBoard` away from a day moved without it and `nightBoard`
 * from a time of day or a day moved without it), so a correction plays nothing; a stamp left from an older day matches
 * nothing.
 */
export function boardsOf(t, before, clock) {
    if (!t || !clock) return null;
    const NIGHT = HOURS[HOURS.length - 1], EVENING = HOURS[HOURS.length - 2];
    const day = c => Number(c?.day) || 0;
    const startStamped = c => c.dayBoard != null && Number(c.dayBoard) === day(c);
    if (t.kind === "trialExit") return t.newDay === true && startStamped(clock) ? "both" : null;
    if (t.kind === "eclipseIn") {
        return clock.timeOfDay === NIGHT && clock.dayBoard != null && Number(clock.dayBoard) === day(clock) + 1 ? "start" : null;
    }
    // the chapter end's morning, heard after the trial's close: the day it closes is stamped for its end board too
    if (t.kind === "newDay") return !startStamped(clock) ? null : clock.nightBoard != null && Number(clock.nightBoard) === day(clock) - 1 ? "both" : "start";
    const nightFalls = (t.kind === "hour" || t.kind === "eclipseOut") && before?.timeOfDay === EVENING && clock.timeOfDay === NIGHT
        && clock.eclipse !== true && day(before) === day(clock);
    return nightFalls && clock.nightBoard != null && Number(clock.nightBoard) === day(clock) ? "end" : null;
}

/**
 * The clock this page sees moved from `seen` to `clock` (E62 C1): hand the curtain its direction, schedule the flashes
 * and their sounds, hold Escape for the length. Answers the transition or null. `on` is the table's switch as read now.
 */
export function onClockHeard(clock, { on = sequencesOn(), still = reducedMotion(), keep = true } = {}) {
    const before = seen;
    seen = clock ? { ...clock } : seen;
    const t = transitionFor(before, clock);
    /* The day's boards (E94; when each plays, `boardsOf`), over the curtain's turn, still under reduced motion (C2, C3).
       AFTER THE TRIAL'S EXIT (the owner's decision of 12.11.2026: a chapter's end that closes the trial and opens the
       next morning in one Finish plays the exit first, then the boards): a board started while the exit plays would cut
       it, so the boards wait for its end (sequence.mjs `whenTrialExitEnds`), at once when none was asked for. */
    const which = boardsOf(t, before, clock);
    const boards = () => whenTrialExitEnds().then(() => {
        if (which === "start") return playDayStart(clock, { on });
        if (which === "end") return playDayEnd(before, clock, { on, keep });
        // "both": the day that ends, then the day that begins (`playDayEnd` hands on to it however it ends)
        return before
            ? playDayEnd(before, clock, { on, keep, then: () => playDayStart(clock, { on }).catch(() => null) })
            : playDayStart(clock, { on });
    }).catch(() => null);
    /* THE TRIAL'S EXIT (the owner's decision of 12.11.2026): E61's sequence, started here because this is where the
       clock's move out of the trial is read against the clock before it; nothing for an exit Edit campaign wrote
       (sequence.mjs `edgeShown`) or with the switch off. A new day heard in the same run - a chapter's end with the next
       morning - has its boards after it. */
    if (t?.kind === "trialExit" && on) playTrialExit(clock, { on }).catch(() => null);
    if (t?.kind === "trialExit" && which && on) boards();
    if (!t || t.owner) return t;
    clearFlashes();
    count("transition.heard");
    if (which && on) boards();
    if (!on || still) return t;
    seed = (seed * 1103515245 + 12345) >>> 0;
    import("./glass.mjs").then(g => g.hintTurn?.({ how: t.how, seed, groups: t.groups, delays: t.delays, dur: t.dur })).catch(() => null);
    for (const at of t.flashes ?? []) flashTimers.push(setTimeout(() => { flicker(); playFlashSound(); }, at));
    holdEscape((t.dur ?? 1200) + 200, () => {
        clearFlashes();
        document.body.classList.remove("drpg-flicker");
        import("./glass.mjs").then(g => g.skipTurn?.()).catch(() => null);
    });
    return t;
}

/**
 * The body's announcement on this browser (C4): the flicker at `DISCOVERY_ONSETS`, everyone connected, the dead and the
 * GM included (the owner's 10.10 g). A rehearsal of the suite's (E95 fix RV-12) plays nothing. Answers the onsets
 * played, or null.
 */
export function onBodyAnnounced(payload, { on = sequencesOn(), still = reducedMotion() } = {}) {
    if (!payload || payload.rehearsal === true || !on || still) return null;
    count("transition.discovery");
    /* CUT, NOT QUEUED, HERE TOO (gaps, R4652; 1.2.109's known gap "Two flash sequences on one screen"). The announcement
       added its four onsets beside whatever a transition still had pending, so a body announced in the first seconds of
       the Investigation's entry put both tables on one screen: ten onsets, six in the first second, against the three
       both are held to (`flashRate`). It cuts them as a new change of the clock does; the Investigation's turn of the
       glass runs on, only its flashes and their sound go. */
    clearFlashes();
    document.body.classList.remove("drpg-flicker");
    for (const at of DISCOVERY_ONSETS) flashTimers.push(setTimeout(() => flicker(), at));
    return [...DISCOVERY_ONSETS];
}

/** Once at ready: the clock as this page found it is the first `seen`, so a late client is told nothing it missed. */
export async function registerTransitions() {
    seen = { ...getClock() };
    const read = clock => onClockHeard(clock ?? getClock());
    Hooks.on("drpgTimeOfDayChanged", clock => read(clock));
    Hooks.on("drpgPhaseChanged", () => read(getClock()));
    Hooks.on("drpgEclipseChanged", running => read({ ...getClock(), eclipse: running === true }));
    const { BODY_ANNOUNCED_HOOK } = await import("./chapter.mjs");
    Hooks.on(BODY_ANNOUNCED_HOOK, payload => onBodyAnnounced(payload));
}
