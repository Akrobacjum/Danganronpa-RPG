/**
 * Danganronpa RPG - the campaign clock.
 * ---------------------------------------------------------------------------
 * Season → Chapter → Session → Time of day.
 *
 * One session is one in-fiction day, which is five times of day: Morning, Noon,
 * Afternoon, Evening, Night. Advancing the clock restocks every room's search
 * tokens.
 *
 * It does NOT refill the action economy. Actions and the free Move come back
 * when the Eclipse - the placement window that sits between two times of day -
 * BEGINS; see `startEclipse` in eclipse.mjs, which is where that finally became
 * true rather than merely written down (Z2). Doing it here as well would hand
 * the table two budgets for one boundary.
 *
 * Chapters are not advanced automatically - how many sessions a chapter runs is
 * the GM's call, and the guide explicitly allows stretching one when no murder
 * has happened yet.
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES } from "./config.mjs";
import { SETTINGS, getClock, clearBodyDiscovery, incomingTimeOfDay } from "./settings.mjs";
import { resetAllActions, budgetsOf, putBackBudgets, clearGrants } from "./actions.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { announce, log, warn, error, debug, plural, serverNow, serialWrite } from "./utils.mjs";
// E88 C0: the counters `fps()` and scenario 86 read (perf-counters.mjs); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";

/**
 * Current clock, always with every field present. Defined in settings.mjs -
 * the leaf both ends of this file's import cycles can reach (audit C3) - and
 * re-exported here under the name every caller already uses.
 */
export { getClock };

/** Human-readable time of day, e.g. "Afternoon". */
export function timeOfDayLabel(key = getClock().timeOfDay) {
    return TIME_OF_DAY_LABELS[key] ?? key;
}

/** Human-readable phase, e.g. "Investigation". */
export function phaseLabel(key = getClock().phase) {
    return PHASES[key]?.label ?? key;
}

/** The campaign's name, falling back to the world title. */
export function campaignName(clock = getClock()) {
    return clock.campaignName?.trim() || game.world?.title || "";
}

/**
 * Set the phase: dailyLife | investigation | classTrial.
 *
 * INTO A TRIAL AFTER A VERDICT ONLY WHEN THE CALLER ASKED (E10 C11, 1.2.71; audit S06-33; D17).
 * Entering the trial blanks the chapter's trial record (`reconcilePhase`), its `verdictApplied`
 * included, so a second trial in a chapter with a verdict is a second execution waiting to happen.
 * This is `game.drpg.setPhase` and the road `startFloor` takes - calls from a macro or from another
 * function, not a GM at a button - so without `confirmNewTrial` it refuses with a warning and writes
 * nothing; the asking is trial-floor-ui.mjs `confirmNewTrial`, behind Start the Class Trial and Edit
 * campaign. `setClock` itself stays the bare writer every door uses, and is not asked (a GM's own
 * `game.drpg.setClock({ phase })` still opens a trial unasked: E10 C11's note names that road) - but it
 * refuses a trial opened in an Eclipse, for every door (E10 fix r2-G5).
 *
 * @param {string} key
 * @param {{confirmNewTrial?: boolean}} [options]  true: the GM was asked and said yes.
 */
export async function setPhase(key, { confirmNewTrial = false } = {}) {
    if (!PHASES[key]) {
        ui.notifications.error(game.i18n.format("DRPG.Clock.unknownPhase", { key }));
        return null;
    }
    if (key === "classTrial" && getClock().phase !== "classTrial" && !confirmNewTrial) {
        const { trialProgress } = await import("./vote.mjs");
        if (trialProgress().verdictApplied) {
            ui.notifications.warn(game.i18n.localize("DRPG.Floor.newTrialRefused"));
            return null;
        }
    }
    return setClock({ phase: key });
}

/**
 * "Chapter 2 · Day 3 · Session 3 · Afternoon", and it says when the lights are out.
 *
 * THE ECLIPSE HAS TO BE IN HERE, and E17 is where that stopped being a nicety.
 * Measured: start an Eclipse, then move the clock from the editor - which is a
 * thing a GM does to correct a mistake - and the world lands on `timeOfDay:
 * "morning"` with `eclipse` still true. `eclipseLabel()` then reads "Noon
 * Eclipse", an Eclipse named for a time of day that has already gone, and this
 * line, which is the one the GM actually reads, said plain "Morning".
 *
 * That state silently refuses every murder for the rest of the session, and the
 * clock editor has no Eclipse field to turn it off with. One extra word here is
 * worth more than a guard anywhere else: it reaches the HUD, the panel and every
 * card that prints the clock, so whatever route left the flag on, the GM sees it.
 */
export function clockSummary(clock = getClock(), { time = true } = {}) {
    // `time: false` under a heading that already names the time of day (`announceTimeOfDay`, E18 fix e1-G3).
    const summary = game.i18n.format(time ? "DRPG.Clock.summary" : "DRPG.Clock.summaryUnder", {
        chapter: clock.chapter,
        day: clock.day ?? 1,
        session: clock.session,
        time: timeOfDayLabel(clock.timeOfDay)
    });
    return clock.eclipse
        ? game.i18n.format("DRPG.Clock.summaryEclipse", { summary })
        : summary;
}

/**
 * THE ONE QUEUE'S KEY FOR THE CLOCK (E17 C0, 26.10.2026; session 0's list): `setClock`, the clock's one writer, reads
 * and writes inside a step of utils.mjs `serialWrite` under it (tier 0 R991).
 */
export const CLOCK_KEY = "clock";

/** Write clock fields. GM only. */
export async function setClock(patch = {}) {
    if (!game.user.isGM) {
        warn("Only a GM can move the campaign clock.");
        return null;
    }
    /* ONE STEP OF `CLOCK_KEY` FROM THE READ TO THE WRITE (E17 C0, 26.10.2026; audit S10-23). Two writes begun within a
       server round trip each spread their patch over the clock they read, and the second wrote over the first's field
       (tier 2 E17-T1 at 9f727e07: of two fields written together one was left). What follows the write - the
       discovery's end, the phase's and the Eclipse's reconciling - runs after the step, so a write of the clock they
       make waits for no step of its own key. */
    const written = await serialWrite(CLOCK_KEY, async () => {
        const before = getClock();
        const next = { ...before, ...patch };

        // Stamp when this time of day began, so the HUD can say how long it has run.
        // Written here rather than in `advanceTimeOfDay` because the GM also moves
        // the clock by hand from the panel and by rewinding, and a timer that only
        // reset on one of those three routes would quietly lie on the other two.
        // `patch` wins if a caller sets the stamp itself - that is how a correction
        // can move the clock without pretending the pause never happened.
        //
        // AND WHEN THE PHASE CROSSES THE TRIAL'S EDGE (E10 C12, 1.2.71; audit S06-36). Start the
        // Class Trial and End the trial stamped it themselves; the other roads in and out - the
        // trial ended from Edit campaign, a debate opened outside a trial (`startFloor` ->
        // `setPhase`), `game.drpg.setPhase` - did not, and the HUD went on counting the time of
        // day from before the trial, in red. Only a move into or out of the Class Trial: a body
        // found turns Daily Life into the Investigation in the middle of a time of day, and the
        // day's summary (day-summary.mjs) is bounded by this stamp. Measured in tier 2 "the trial's
        // exits say what happened". The stamp is the server's clock (utils.mjs `serverNow`, E10 C13), as
        // is every reader's count from it: the HUD's elapsed line on a player's machine counts from a GM's.
        const trialEdge = patch.phase !== undefined && patch.phase !== before.phase
            && (patch.phase === "classTrial" || before.phase === "classTrial");
        if (((patch.timeOfDay !== undefined && patch.timeOfDay !== before.timeOfDay) || trialEdge)
            && patch.timeOfDayStartedAt === undefined) {
            next.timeOfDayStartedAt = serverNow();
            /* AND ITS PAUSES START AT NONE (E17 C6, 26.10.2026; audit S10-16): the stopwatch is the time since the stamp
               less `pausedTotalMs`, so the last time of day's pauses go with it. A pause running across the change
               belongs from now on to the new time of day: its stamp moves to the new start, and the unpause adds only
               what came after (hud.mjs `unpausePatch` reads from the later of the two as well). */
            if (patch.pausedTotalMs === undefined) next.pausedTotalMs = 0;
            if (next.pausedAt && patch.pausedAt === undefined) next.pausedAt = next.timeOfDayStartedAt;
        }
        /* WHEN THE CLOCK WAS LAST WRITTEN (E17 fix p2-G1, 26.10.2026): a moment a GM was at the table, which every GM's
           `ready` can read (settings.mjs `DEFAULT_CLOCK.writtenAt`, hud.mjs `readyPatch`); `patch` wins, so a restored
           clock keeps its own. */
        if (patch.writtenAt === undefined) next.writtenAt = serverNow();
        // The trial's end, for the discovery stamps read after it (settings.mjs `bodyFoundSinceTrial`,
        // E11 fix r1-G3). `patch` wins here too, so a restored clock keeps its own.
        if (trialEdge && before.phase === "classTrial" && patch.trialEndedAt === undefined) {
            next.trialEndedAt = serverNow();
        }
        /* NO TRIAL OPENS IN AN ECLIPSE, BY ANY DOOR (E10 fix r2-G5, 1.2.71; goal S06-18). C12 refused it at
           Start the Class Trial and the vote's open; Edit campaign, `setPhase`, a debate opened outside a
           trial (`startFloor` -> `setPhase`) and this function itself still opened one, with Analyze and the
           Objection refused in the dark. Every one of them writes through here, so the check is here once:
           the whole write is refused, nothing written, and the GM told. Read on the clock as it would be
           after the write, so a write that ends the Eclipse may open the trial, and tier 2's restore of a
           clock from before an Eclipse is not refused. Measured in tier 2 "no road opens the trial in an
           Eclipse" (red at c494855 on every road it drives). */
        if (trialEdge && next.phase === "classTrial" && next.eclipse === true) {
            ui.notifications.warn(game.i18n.localize("DRPG.Floor.eclipseFirst"));
            return null;
        }
        /* AND NO ECLIPSE BEGINS IN A TRIAL, BY THIS DOOR EITHER (E13 fix r1-G1, 12.10.2026; the orchestrator's
           default of the same day). r1-F3 refused it in eclipse.mjs `startEclipse`, the module's one writer of
           `eclipse: true`; a clock written here with it - the API's `setClock` from a console, a macro - still
           began one inside a running trial, and the trial's one voice room (D8) split into a room each. Refused
           with `startEclipse`'s words, only when the Eclipse would begin: a write that keeps one already on (from
           before this check) or ends it goes through, and a write that also opens the trial is the edge's refusal
           above. Tier 2 "the clock refuses an Eclipse in the Class Trial" (red at 5b2b2ed). */
        if (!trialEdge && next.phase === "classTrial" && next.eclipse === true && before.eclipse !== true) {
            ui.notifications.warn(game.i18n.localize("DRPG.Eclipse.trialFirst"));
            return null;
        }
        // An Eclipse's name ends with it (E05, `eclipseId`), whichever route ends it: a
        // flag set again later by hand must not inherit the last Eclipse's name.
        if (before.eclipse && next.eclipse !== true) next.eclipseStartedAt = null;
        /* A BOUNDARY'S MEMORY GOES WITH A CALENDAR OR AN ECLIPSE'S END WRITTEN BY HAND (E17 C7, 26.10.2026; audit
           S10-42). `refilledFor` and `lastAdvance` are the chevrons' and the panel's: `startEclipse`, `endEclipse`,
           `advanceTimeOfDay` and `rewindTimeOfDay` name both in their writes. Any other write that moves the season,
           the chapter, the session, the day or the time of day, or ends an Eclipse - Edit campaign, the season's
           reset, a console's `setClock`, the suite putting a clock back - forgets them, so the next boundary refills
           and nothing older is taken back over it. */
        const calendarMoved = ["season", "chapter", "session", "day", "timeOfDay"]
            .some(k => patch[k] !== undefined && patch[k] !== before[k]);
        const forget = calendarMoved || (before.eclipse && next.eclipse !== true);
        if (forget && patch.refilledFor === undefined) next.refilledFor = null;
        /* AND THE MEMORY IS THE GMS', NOT THE CLOCK'S (E17 fix ci-2, 26.10.2026; CI run 40402423765 on f7ac1e9d). Written
           on the clock, `lastAdvance.snapshot.actions` named every character by actor id in a world setting every
           player's browser holds, the killer among them: 72-canary's world scan found the killer's id at
           `clock.lastAdvance.snapshot.actions.<id>` on p1 and p2 after every phase of its chapter, against the
           world-secrets rule (world-secrets.mjs, `clock.lastAdvance` since this commit). It is a GM store's now
           (gm-stores.mjs `takeBackStore`), written here in the same step as the clock: a patch's `lastAdvance` goes
           there, a write that forgets the boundary empties it, and the clock carries none - one stored by f7ac1e9d
           goes with the next write. */
        const memory = patch.lastAdvance !== undefined ? (patch.lastAdvance ?? null) : (forget ? null : undefined);
        delete next.lastAdvance;

        await game.settings.set(MODULE_ID, SETTINGS.clock, next);
        if (memory !== undefined) await keepTakeBack(memory);
        return { before, next };
    });
    if (!written) return null;
    const { before, next } = written;

    /*
     * STAGE 7 STARTING IS WHAT ENDS THE DISCOVERY (D5).
     *
     * `setPhase` and "Edit campaign" both come through here, and they are the
     * only two answers that end the record. A time-of-day change deliberately
     * does NOT: the record is also what stops `maybeBodyFound` announcing the
     * same corpse a second time and what holds `freshSceneBonus` at zero, and
     * clearing it on the hour would hand both of those back - a re-announcement
     * and a re-gathering on the next token move, and the killer's -3 restored.
     * The hour ends the SILENCE, and it does that by the stamp in the record
     * going stale (`bodyDiscoveryFresh`), not by a write here.
     */
    if (patch.phase !== undefined && patch.phase !== before.phase) {
        await clearBodyDiscovery();
        await reconcilePhase(before.phase, next.phase);
    }

    /*
     * AND THE ECLIPSE, for the same reason and by the same rule.
     *
     * `endEclipse` tells the other clients. The flag is also one field of the
     * season reset's clock write, which did not - so a season wiped during an
     * Eclipse left every other browser still dimmed. (It also left last season's
     * crossings in the ledger; since E05 each crossing is named for its Eclipse,
     * and counts nothing in another.)
     */
    if (patch.eclipse !== undefined && before.eclipse && !next.eclipse) {
        await reconcileEclipseEnded();
    }

    /*
     * A NEW SESSION USED TO BE A REMINDER HERE, and is nothing at all now (Z7).
     *
     * The guide clears the players' evidence "na początku następnej sesji", so
     * this told the GM to go and do it every time the session counter moved.
     * The sweep stopped being part of the calendar - it is a button on the
     * Investigation dashboard, pressed when a GM means it - so the reminder was
     * a note about a job nobody has. What was left behind was an empty `if`
     * holding only that explanation; the explanation is worth keeping and the
     * branch is not (audit A15, Dawid Q17).
     */

    return next;
}

/* ==========================================================================
 * ADVANCING
 * ========================================================================== */

/**
 * Move to the next time of day, rolling into the next session after Night.
 *
 * @param {object} [options]
 * @param {boolean} [options.resetActions]      Refill everyone's actions. Off by
 *   default - that is the START of the Eclipse's job, not the clock's, and
 *   nothing in the ordinary flow turns it on any more. The GM panel's "also
 *   refill" checkbox passes it explicitly when a correction needs it, which is
 *   the one remaining caller and deliberately a manual one.
 * @param {boolean} [options.resetSearchTokens] Restock every room.
 * @param {boolean} [options.announce]          Post the new time of day to chat.
 */
export async function advanceTimeOfDay({
    resetActions = false,
    resetSearchTokens = true,
    announce = true,
    /**
     * A sound to hang on the card this posts, in the `{ key, gm }` shape
     * sfx.mjs reads off a chat message.
     *
     * It exists for the Eclipse. An Eclipse ends BY advancing the clock, so the
     * card the table actually sees at that moment is the new time of day -
     * there is no second card to carry the sound, and adding one would say the
     * same thing twice. Riding this one also means the sound inherits the
     * card's audience, which matters: while a murder runs the clock moves in
     * private (see `announceTimeOfDay`), and a public chime announcing it would
     * undo exactly what that rule protects.
     */
    sfx = null,
    // Extra fields to fold into the SAME write. `endEclipse` uses it to clear
    // the Eclipse flag as the clock moves, rather than in a write of its own -
    // see the note on the flicker below.
    also = {}
} = {}) {
    if (!game.user.isGM) return null;

    const before = await withTakeBack(getClock());
    const { timeOfDay, session, day, rolledOver } = clockAfter(before);
    /* ONCE A BOUNDARY (E17 C7, 26.10.2026; audit S10-42). The panel's "Next time of day" asks for a refill; an
       Eclipse opened for this boundary has given it already (`refilledFor`), and one ended without advancing after
       `TAKE_BACK_MS` kept it - a second refill for the same boundary is not given. What the boundary changes is kept
       to take back (`lastAdvance`): the snapshot an Eclipse for it took as it opened, before its refill, or one taken
       now. */
    const stamp = boundaryStamp(before);
    /* AND THE GRANTS STILL END (E17 fix p2-G2, 26.10.2026; the end review's E17p2-R7): the refill is the one place
       the Sprint and Burst grants are zeroed, so a boundary refilled already let a grant bought since it outlive the
       time of day it was bought for. No second refill; the grants end here all the same (actions.mjs `clearGrants`). */
    let endGrants = false;
    if (resetActions && before.refilledFor === stamp) {
        resetActions = false;
        endGrants = true;
        log("The actions were refilled for this time of day already; not again.");
    }
    const snapshot = before.lastAdvance?.for === stamp && before.lastAdvance.snapshot
        ? before.lastAdvance.snapshot : await boundarySnapshot();

    // ONE write, not two.
    //
    // Every setting write redraws the HUD on every client, so a clock moved in
    // two steps is a clock that is briefly readable in a state it was never
    // meant to be in. Ending an Eclipse did exactly that: the flag was cleared
    // first, which left the previous time of day showing as an ordinary label
    // for a frame, and then the time advanced. On screen that is the old time
    // of day flashing up between the Eclipse and the new one.
    //
    // Where it goes is `clockAfter`'s, below.
    const next = await setClock({ ...also, timeOfDay, session, day,
        refilledFor: resetActions ? stamp : (before.refilledFor ?? null),
        lastAdvance: boundaryMemory(before, stamp, snapshot) });
    if (next && endGrants) await clearGrants();

    await applyTimeOfDayChange(next, { resetActions, resetSearchTokens, announce, rolledOver, sfx });
    return next;
}

/**
 * Where the clock goes when the time of day moves on: the next time of day and, past the day's last one, a new day and a
 * new session. Five times of day make one in-fiction day, so the day ticks over on the same wrap that starts a new
 * session. `advanceTimeOfDay` writes it, and the notice history's window names a running Eclipse's group by it (E77
 * fix r2-H7, 13.10.2026, the owner's choice of the same day: "Noon Eclipse" stood under "Morning · ECLIPSE"). The time
 * of day is `incomingTimeOfDay`'s, the word the Eclipse's own name is made of (eclipse.mjs `eclipseLabel`), so the
 * group and the card cannot name two times; the wrap is here once, where the advance used to hold it inline.
 */
export function clockAfter(clock = getClock()) {
    const timeOfDay = incomingTimeOfDay(clock);
    const rolledOver = timeOfDay === TIMES_OF_DAY[0];
    const day = clock.day ?? 1;
    return { timeOfDay, rolledOver, session: rolledOver ? clock.session + 1 : clock.session, day: rolledOver ? day + 1 : day };
}

/* ==========================================================================
 * A BOUNDARY REFILLS ONCE, AND IS TAKEN BACK WITHIN FIVE MINUTES
 * --------------------------------------------------------------------------
 * E17 C7, 26.10.2026; audit S10-42. The chevron opened an Eclipse with no
 * question - the refill, the Sprint and Burst grants and the seals gone - and
 * "End without advancing" gave none of it back, so the next press refilled the
 * same boundary a second time; a rewind, which refills nothing on purpose, left
 * what the advance had given. Now the boundary is named (`boundaryStamp`), its
 * refill is given once (`refilledFor`), and what it changed is kept
 * (`lastAdvance`) for "End without advancing" and the rewind to put back within
 * `TAKE_BACK_MS`. Tier 2 "the boundary taken back (E17-T10)".
 * ========================================================================== */

/**
 * How long a boundary can be taken back: 5 minutes, a design number - the issue's "w ciągu kilku minut" (S10-42). A
 * misclick is noticed at once; after five minutes the table has played on what the boundary gave, and putting the
 * snapshot back would take that play away too. Not measured at a table.
 */
export const TAKE_BACK_MS = 5 * 60_000;

/**
 * The boundary into `to` of `clock`'s season and chapter, as a string: the season, the chapter, the session, the day
 * and the time of day it leads into. `to` defaults to where the clock goes next (`clockAfter`), what an Eclipse opens
 * and an advance moves to; the rewind passes the clock itself, the boundary that led into the time of day it leaves.
 * Pure.
 */
export function boundaryStamp(clock = getClock(), to = clockAfter(clock)) {
    return JSON.stringify([clock?.season ?? null, clock?.chapter ?? null, to?.session ?? null, to?.day ?? null, to?.timeOfDay ?? null]);
}

/** What a boundary changes, as it stands: every character's budget (actions.mjs `budgetsOf`), the search tokens' store and the seals. */
export async function boundarySnapshot() {
    const { sealedRooms, restrictions } = await import("./call-world.mjs");
    return {
        actions: budgetsOf(),
        tokens: foundry.utils.deepClone(SearchTokens.store ?? {}),
        sealed: [...sealedRooms()],
        restrictions: foundry.utils.deepClone(restrictions() ?? {})
    };
}

/**
 * How many boundaries in a row can be taken back: 4, a design number - one short of a whole day's five times of day,
 * and each level a snapshot of every character's budget on the world's clock. Only levels younger than `TAKE_BACK_MS`
 * are kept, so in play it is how many times the GM pressed Next within five minutes (E17 fix p2-G2).
 */
export const TAKE_BACK_DEPTH = 4;

/**
 * THE TAKE-BACK'S MEMORY, FROM THE GMS' STORE (E17 fix ci-2, 26.10.2026): `boundaryMemory`'s record, the GMs' store
 * "takeBack" (gm-stores.mjs `takeBackStore`), or null - none read before the stores open, as none kept. GM only:
 * a player holds no copy.
 */
export async function takeBackMemory() {
    if (!game.user?.isGM) return null;
    try {
        const { takeBackStore } = await import("./gm-stores.mjs");
        return takeBackStore.record()?.lastAdvance ?? null;
    } catch (err) {
        warn("Could not read what the last boundary would take back", err);
        return null;
    }
}

/** `clock` with `takeBackMemory()` as its `lastAdvance`, the shape the boundary's pure helpers below read. */
export async function withTakeBack(clock = getClock()) {
    return { ...clock, lastAdvance: await takeBackMemory() };
}

/* `memory` kept in the GMs' store for `setClock`, inside its step: nothing written when it holds that already (a
   calendar moved with nothing to forget). A store that cannot be written loses the take-back, never the clock write. */
async function keepTakeBack(memory) {
    try {
        const [{ takeBackStore }, { RECORD }] = await Promise.all([import("./gm-stores.mjs"), import("./gm-store.mjs")]);
        if (memory === null && (takeBackStore.record()?.lastAdvance ?? null) === null) return;
        await takeBackStore.patch(RECORD, { lastAdvance: memory });
    } catch (err) {
        error("Could not keep what the boundary would take back", err);
    }
}

/** `entry` and the entries under it that are younger than `TAKE_BACK_MS` at `now`, at most `depth` of them. Pure. */
export function liveMemory(entry, now = serverNow(), depth = TAKE_BACK_DEPTH) {
    if (!entry?.snapshot || depth <= 0) return null;
    const age = now - Number(entry.at);
    if (!Number.isFinite(age) || age < 0 || age > TAKE_BACK_MS) return null;
    return { ...entry, previous: liveMemory(entry.previous ?? null, now, depth - 1) };
}

/**
 * THE MEMORY OF A BOUNDARY CROSSED NOW (E17 fix p2-G2, 26.10.2026; the end review's E17p2-R2, R4): `lastAdvance` for the
 * boundary `stamp` of the clock `before`, with `snapshot`. `refilledBefore` is the `refilledFor` it found, which a
 * take-back writes back - the take-back wrote null, and a boundary an Eclipse had refilled and kept past five minutes
 * refilled a second time after a rewind of the advance that had not refilled it. `previous` is the boundary before it,
 * still takeable (`liveMemory`), so a rewind after two advances in a row takes the second back and the next rewind the
 * first. The advance that ends an Eclipse crosses the same boundary its opening named: it keeps the opening's
 * `refilledBefore` and `previous`, as it keeps its snapshot. Pure but for the clock's time.
 */
export function boundaryMemory(before, stamp, snapshot, now = serverNow()) {
    const prior = before?.lastAdvance ?? null;
    const same = prior?.for === stamp;
    return {
        for: stamp, at: now, snapshot,
        refilledBefore: same ? (prior.refilledBefore ?? null) : (before?.refilledFor ?? null),
        previous: liveMemory(same ? (prior.previous ?? null) : prior, now, TAKE_BACK_DEPTH - 1)
    };
}

/** What a take-back leaves on the clock: the `refilledFor` the boundary found, and the boundary before it. Pure. */
export function afterTakeBack(clock, last, now = serverNow()) {
    return last
        ? { refilledFor: last.refilledBefore ?? null, lastAdvance: liveMemory(last.previous ?? null, now) }
        : { refilledFor: clock?.refilledFor ?? null, lastAdvance: null };
}

/** `clock.lastAdvance` when it is the boundary `stamp` and younger than `TAKE_BACK_MS` at `now`, else null. Pure. */
export function takeBackFor(clock, stamp, now = serverNow()) {
    const last = clock?.lastAdvance;
    if (!last?.snapshot || last.for !== stamp) return null;
    const age = now - Number(last.at);
    return Number.isFinite(age) && age >= 0 && age <= TAKE_BACK_MS ? last : null;
}

/**
 * `takeBackFor`'s snapshot put back: the budgets, the search tokens and the seals as the boundary found them, and the
 * GM who asked told so. GM only. The callers clear `refilledFor` and `lastAdvance` in their own clock write.
 */
export async function takeBackBoundary(last) {
    if (!game.user.isGM || !last?.snapshot) return false;
    const { snapshot } = last;
    try {
        await putBackBudgets(snapshot.actions);
        await SearchTokens.putBack(snapshot.tokens);
        const { putBackSeals } = await import("./call-world.mjs");
        await putBackSeals({ sealed: snapshot.sealed, restrictions: snapshot.restrictions });
    } catch (err) {
        error("Could not take back what the time of day's start gave", err);
        return false;
    }
    ui.notifications.info(game.i18n.localize("DRPG.Clock.takenBack"));
    return true;
}

/**
 * The clock as a bystander's HUD keeps it while an incident runs (E17 C7, 26.10.2026; audit S10-07): the calendar and
 * the stopwatch's fields, for `openMurder` to write as `clockAtOpen`, and nothing else of the clock - no boundary's
 * memory and no phase, which moves in the open. Pure.
 */
export function frozenClockOf(clock = getClock()) {
    const out = {};
    for (const key of ["season", "chapter", "session", "day", "timeOfDay", "eclipse", "eclipseStartedAt", "timeOfDayStartedAt", "pausedTotalMs"]) {
        out[key] = clock?.[key] ?? null;
    }
    return out;
}

/**
 * Step the time of day backwards. This is a correction for a misclick, not a
 * game move, so it deliberately refills nothing - rewinding must never hand
 * the table a second set of actions.
 */
export async function rewindTimeOfDay() {
    if (!game.user.isGM) return null;

    /*
     * AND NOT WHILE AN ECLIPSE RUNS (HUD-02, 19.09).
     *
     * The Eclipse has not moved the clock yet - it sits BEFORE the next time of
     * day - so `clock.timeOfDay` still holds the one that just finished while the
     * HUD names the one being placed for. Stepping the clock back therefore undid
     * nothing: it RENAMED the running Eclipse. On the Night Eclipse, the one
     * free-placement window there is, that turns `eclipseAllowance()` from null
     * into two - so the crossing judge starts enforcing a budget and adjacency on
     * a table that was just told to pick any room on the map, with every crossing
     * already recorded counting against it, and anybody who had placed twice
     * refused outright. From the Noon Eclipse the same press also takes the
     * session and the day back a whole day.
     *
     * BEFORE `cancelGather()` BELOW, and that order is the rule: a refusal placed
     * after it would destroy a pending assembly and then decline to do the thing
     * it destroyed it for.
     *
     * A REFUSAL, not a warning and a write. "Edit campaign" warns and writes on
     * purpose - it is a deliberate correction with every field in front of the GM
     * - and this is one click on the main screen, the only control on that row
     * that could do this by accident. Ending an Eclipse without advancing is the
     * GM panel's job and it has a button for it.
     */
    if (getClock().eclipse === true) {
        ui.notifications.warn(game.i18n.localize("DRPG.Clock.rewindDuringEclipse"));
        return null;
    }

    /*
     * THE ASSEMBLY GOES FIRST, BEFORE THE CLOCK MOVES.
     *
     * A called assembly fires when the time of day is no longer the one it was
     * called in - and a rewind changes the time of day, so it would read as
     * ripe. Worse, the clock write's own `onChange` reaches every client before
     * the next line of this function runs, so clearing it afterwards would be a
     * race the teleport wins about as often as not.
     */
    await import("./call-effects.mjs").then(m => m.cancelGather()).catch(() => {});

    const clock = await withTakeBack(getClock());
    const index = TIMES_OF_DAY.indexOf(clock.timeOfDay);
    const prevIndex = (index - 1 + TIMES_OF_DAY.length) % TIMES_OF_DAY.length;
    const rolledBack = prevIndex === TIMES_OF_DAY.length - 1;

    /* AND WITHIN FIVE MINUTES, WHAT THE ADVANCE GAVE IS TAKEN BACK (E17 C7, 26.10.2026; audit S10-42): the boundary
       that led into this time of day, if it is `lastAdvance`'s and younger than `TAKE_BACK_MS` - the budgets, the
       search tokens and the seals as they stood before it, and the boundary refills again when it is crossed again.
       Later, nothing is put back and the boundary is kept as refilled (`refilledFor`), so crossing it again refills
       nobody twice. The memory of what it changed goes either way: the table has played on it. Taken back, the
       boundary is as refilled as it was before it was crossed, and the one before it can be taken back next
       (`afterTakeBack`, E17 fix p2-G2). */
    const last = takeBackFor(clock, boundaryStamp(clock, clock));
    const next = await setClock({
        timeOfDay: TIMES_OF_DAY[prevIndex],
        session: rolledBack ? Math.max(1, clock.session - 1) : clock.session,
        day: rolledBack ? Math.max(1, (clock.day ?? 1) - 1) : (clock.day ?? 1),
        ...afterTakeBack(clock, last)
    });

    // A Despair Call lasts one time of day. Stepping the clock back left every
    // one of them standing: a sealed room stayed sealed and a chained player
    // stayed chained into a time of day that had already been undone, with
    // nothing left to clear them. Taken back, the seals of the time of day the
    // clock is back in stand again instead (`takeBackBoundary`).
    if (last) await takeBackBoundary(last);
    else await import("./call-effects.mjs").then(m => m.clearSeals()).catch(() => {});

    // The motive's deadline is a Despair Call's timer and gets the same
    // treatment: a misclick must not cost the cast a time of day off it.
    await import("./rules.mjs").then(m => m.untickMotive()).catch(() => {});

    return next;
}

/** Jump straight to a specific time of day without rolling the session over. */
export async function setTimeOfDay(key, { also = {}, ...options } = {}) {
    if (!game.user.isGM) return null;
    if (!TIMES_OF_DAY.includes(key)) {
        ui.notifications.error(game.i18n.format("DRPG.Clock.unknownTime", { key }));
        return null;
    }

    // `also`: extra clock fields folded into the SAME write, the way
    // `advanceTimeOfDay` takes them. The end of a chapter moves the day and
    // the time of day together, and two writes were two full redraws of
    // every HUD and sheet on every client (CORE-12).
    const next = await setClock({ ...also, timeOfDay: key });
    await applyTimeOfDayChange(next, options);
    return next;
}

/** Everything that has to happen when the time of day changes. */
async function applyTimeOfDayChange(clock, {
    resetActions = false,
    resetSearchTokens = true,
    announce = true,
    rolledOver = false,
    sfx = null
} = {}) {
    const summary = { clock, rolledOver, actions: [], searchTokensReset: false };

    /*
     * THE OVERFLOW BOUNDARY (Z10), before the restock it can shrink.
     *
     * Runs on every time-of-day change, Eclipse or no Eclipse. When an Eclipse
     * was used it has already fired at the Eclipse's opening and this call
     * finds the same stamp armed and does nothing - one payment, one card. When
     * no Eclipse was used, this is the only boundary there is.
     *
     * Ahead of the restock for the same reason `startEclipse` puts it ahead of
     * the refill: `SearchTokens.reset` fills every room to `max`, and `max` is
     * what a darkening reduces. Checked afterwards, the rooms would be stocked
     * at the old number and the reduction would not be felt until the following
     * time of day.
     */
    try {
        const { checkOverflow } = await import("./overflow.mjs");
        await checkOverflow();
    } catch (err) {
        warn("Could not check the Despair overflow on the time-of-day boundary", err);
    }

    if (resetActions) summary.actions = await resetAllActions();
    if (resetSearchTokens) summary.searchTokensReset = await SearchTokens.reset({ notify: false });

    // "Behind Closed Doors" seals a room for one time of day.
    await import("./call-effects.mjs").then(m => m.clearSeals()).catch(() => {});

    /*
     * ONE TIME OF DAY OFF MONOKUMA'S DEADLINE.
     *
     * Here rather than in the sync case below, and that is the whole reason
     * this is two lines in two files: a decrement has to happen EXACTLY once,
     * and this function runs on exactly one client - the GM who moved the
     * clock. The sync case runs on all of them.
     *
     * Eclipses are skipped for free: `endEclipse()` finishes with a single
     * `advanceTimeOfDay()`, so an Eclipse is a window before a time of day
     * rather than a tick of its own, and a counter hung here never sees it.
     */
    await import("./rules.mjs").then(m => m.tickMotive()).catch(() => {});

    log(`Clock -> ${clockSummary(clock)}`);

    if (announce) await announceTimeOfDay(clock, summary, { sfx });

    // Everyone, not just whoever clicked.
    //
    // This used to be a bare `Hooks.callAll`, which runs on the calling client
    // and nowhere else. The world setting itself synchronises, so a player's
    // stored clock was correct - but nothing on their screen redrew, and the
    // Eclipse and visibility passes that hang off this hook never ran for them.
    // On one machine the settings `onChange` hid it; on a hosted server the
    // time of day advanced for the GM alone.
    const { broadcast, SYNC } = await import("./sync.mjs");
    broadcast(SYNC.clock, {
        clock,
        summary: { rolledOver: summary.rolledOver, searchTokensReset: summary.searchTokensReset }
    });

    return summary;
}

/**
 * Tell the table. The time of day is public knowledge - unlike almost
 * everything else in this game.
 */
async function announceTimeOfDay(clock, summary, { sfx = null } = {}) {
    const wounded = summary.actions.filter(r => r.wounded);

    const notes = [];
    if (summary.actions.length) {
        notes.push(plural("DRPG.Clock.actionsRefilled", { count: summary.actions.length }, "count"));
    }
    if (summary.searchTokensReset) {
        notes.push(game.i18n.localize("DRPG.Clock.searchTokensRestocked"));
    }

    const body = notes.length ? `<p><em>${notes.join(" · ")}</em></p>` : "";
    /* The time of day once (E18 fix e1-G3; the end review's F7, STATUS's C6 gap): the heading names it, and the notice
       lifts the heading into its bar (popup.mjs `showPopup`), so the clock line under it leaves it out. */
    const content = `<h3>${timeOfDayLabel(clock.timeOfDay)}</h3>
                  <p>${clockSummary(clock, { time: false })}</p>${body}`;

    /* WHILE A MURDER RUNS, THE CLOCK MOVES IN PRIVATE (Dawid, 26.08).
     *
     * An incident is a secret between its participants and the GM, and a
     * public "Morning" card mid-incident tells every outsider that the GM is
     * doing SOMETHING at this hour - which is most of the secret. So the
     * announcement narrows to the people already inside it: the GMs and the
     * participants' owners. The HUD's copy of the time freezes for everyone
     * else (see `clockForDisplay` in hud.mjs) and catches up the moment the
     * incident ends. Everything else the change did - refills, restocks -
     * happened either way; only who is TOLD changes.
     *
     * VEILED, AND TOLD BY THE ONE TABLE (E06 C4, 27.09.2026; audit S10-04). The
     * card was a plain whisper, and a whisper list is a field every console reads:
     * the GMs and the participants' owners, which is the cast spelled out to
     * anybody who looks, a trap's builder among them. It is posted veiled now - the
     * document names everybody - and its words go to the GMs and the incident's
     * audience (`incidentAudienceIds`, incident-store.mjs, re-exported by
     * murder.mjs), the same people every card of the incident reaches. The sound
     * goes with the words: since E06 C7a a private card's module flags but its own
     * are meta, sent with its words (secret.mjs `splitFlags`), and sfx.mjs plays a
     * veiled card's sound only where they arrived.
     */
    // Whatever the caller hung on this change - today only the Eclipse's
    // ending. Built once so both branches below carry it, because the sound
    // belongs to the event and not to how many people were told about it.
    const flags = sfx ? { flags: { [MODULE_ID]: { sfx } } } : {};

    const { murderState, incidentAudienceIds } = await import("./murder.mjs");
    const state = murderState();
    if (state) {
        const { whisperToGms, gmIds } = await import("./utils.mjs");
        await whisperToGms(content, {
            whisper: Array.from(new Set([...gmIds(), ...incidentAudienceIds(state)])), veiled: true, ...flags
        });
    } else {
        await announce({ content, ...flags });
    }

    // Who is down an action is the GM's business, not the table's.
    if (wounded.length) {
        const { whisperToGms } = await import("./utils.mjs");
        const names = wounded.map(r => foundry.utils.escapeHTML(r.actor.name)).join(", ");
        await whisperToGms(`<p>${game.i18n.format("DRPG.Clock.woundedNote", { names })}</p>`);
    }
}

/* ==========================================================================
 * REACTIVITY
 * ========================================================================== */

/**
 * Redraw everything that shows the clock. Runs on every client, because the
 * setting change fires locally after the world value syncs.
 *
 * `only`, a test on the sheet's actor, narrows the pass to the sheets that read
 * what was written (E88 C4: a Despair pool is read by a Monokuma's sheet alone,
 * sync.mjs SYNC.despair). A minimised sheet is not rendered: nobody can see its
 * body, and it is rendered once when it is restored (`renderOnRestore`).
 */
export function refreshSheets({ only = null } = {}) {
    // Sheets only. This used to render the HUD too, and every sync kind that
    // also ran `renderHud` itself paid for the HUD twice (CORE-12); the kinds
    // that relied on the side effect now ask for the HUD by name in sync.mjs.
    count("clock.refreshSheets");
    const pass = app => {
        if (app?.document?.type !== "character") return;
        if (only && !only(app.document)) return;
        if (app.minimized === true || app._minimized === true) { count("clock.refreshSheets.minimized"); renderOnRestore(app); return; }
        count("clock.refreshSheets.rendered");
        app.render(false);
    };
    for (const app of Object.values(ui.windows ?? {})) pass(app);
    for (const app of foundry.applications?.instances?.values() ?? []) pass(app);
}

/*
 * A MINIMISED SHEET IS RENDERED WHEN IT IS RESTORED, ONCE (E88 C4, 27.10.2026; E88-09). Every sheet pass rendered
 * every open character sheet, a minimised one too - its whole body built behind a title bar. The pass passes it by
 * and wraps this one window's `maximize` (ApplicationV2's and V1's restore, the title bar's double click included)
 * so that the restore renders it with what the world holds then, after which its own `maximize` is put back. A
 * sheet passed by twice is wrapped once. Its pixels on the restore are the table's to see (no layout headless):
 * R1013 holds the order on a stand-in.
 */
const waitingRestore = new WeakSet();
function renderOnRestore(app) {
    if (waitingRestore.has(app) || typeof app.maximize !== "function") return;
    waitingRestore.add(app);
    const own = Object.hasOwn(app, "maximize"), original = app.maximize;
    app.maximize = async function (...args) {
        if (own) app.maximize = original;
        else delete app.maximize;
        waitingRestore.delete(app);
        const result = await original.apply(this, args);
        try { count("clock.refreshSheets.rendered"); this.render(false); } catch (err) { debug("A restored sheet could not be rendered", err); }
        return result;
    };
}

/**
 * THE PHASE OWNS STATE, AND MORE THAN ONE ROUTE WRITES THE PHASE.
 *
 * `startClassTrial` and `closeTrial` are the deliberate doors, and they used to
 * be the only places that set the trial's own state up and took it down. The
 * phase is also a select in "Edit campaign", it is `setPhase` behind the GM
 * panel's Investigation tile and behind `game.drpg.setPhase`, and it is one
 * field of the season reset - and none of those three ran any of it. Measured:
 * ending a trial from the clock editor left the debate floor open with a
 * speaker still holding it and the console still offering to close the debate;
 * starting one from there left the previous trial's vote standing and never
 * charged for the Key Remnants nobody found.
 *
 * So the reconciliation lives where the phase is actually written, and the two
 * doors keep only what is theirs: the confirmation, and the card the table
 * reads. Every step here is idempotent - `endFloor` writes an empty queue,
 * `resetTrialProgress` writes the same fields each time, `chargeForUnfoundKeys`
 * stamps `keysCharged` and refuses to run twice in one chapter - so a door that
 * comes through here is not doing its own work a second time.
 */
async function reconcilePhase(from, to) {
    if (from === "classTrial") {
        try {
            const { endFloor } = await import("./trial-floor.mjs");
            await endFloor();
        } catch (err) {
            error("Could not close the debate floor after the phase changed", err);
        }
        /* THE SENTENCE, ON EVERY ROAD OUT (E70 C4; DC36). After the floor and before the hall's move below, so the
           executed die in the hall and do not gather at school. End the trial carried it out before its write
           (trial-floor-ui.mjs `closeTrial`), and this finds it stamped; Edit campaign, `setClock` and any other
           road out reach it here - in the trial's own chapter, which Edit campaign may move in this same write
           (vote.mjs `executeAtExit` reads the record by its own chapter). */
        try {
            const { executeAtExit } = await import("./vote.mjs");
            await executeAtExit();
        } catch (err) {
            error("Could not carry out the trial's sentence after the phase changed", err);
        }
    }

    if (to === "classTrial") {
        /*
         * THE TRIAL'S BUDGET (T-1), first: from the moment the phase moves the sheet
         * offers Analyze and the row offers an Objection, and both are paid for.
         *
         * It lives here and nowhere else, which is 1.2.47's rule for everything that
         * happens because the phase ENTERS a trial (d6b069e): every road runs through
         * `setClock` - the Start button, `setPhase` and so `startFloor`, the clock
         * editor - and this branch runs only when the phase really moved, so a
         * trial's second debate refills nothing. The merge with 1.2.47 took the call
         * out of `startClassTrial` to put it here and did not put it here: from
         * a1c041c until this line, starting a trial refilled nobody, while the card
         * the Start button posts announced that it had.
         */
        try {
            const { openTrialBudget } = await import("./actions.mjs");
            await openTrialBudget();
        } catch (err) {
            error("Could not hand out the trial's budget after the phase changed", err);
        }
        try {
            const { resetTrialProgress } = await import("./vote.mjs");
            await resetTrialProgress();
        } catch (err) {
            error("Could not reset the trial's progress after the phase changed", err);
        }
        try {
            /* AFTER the reset, never before: the reset blanks this chapter's trial
               record and the "already charged" stamp lives in it, so charging first
               would have the stamp wiped a line later and the next trial opened in
               this chapter would pay Monokuma twice. It whispers the GMs whatever it
               charged - see `chargeForUnfoundKeys` - and is made on the primary GM
               whichever GM moved the phase (E09 fix r1-G3, `askToChargeForUnfoundKeys`):
               the GMs' marks it counts by are the primary's. */
            const { askToChargeForUnfoundKeys } = await import("./investigation.mjs");
            await askToChargeForUnfoundKeys();
        } catch (err) {
            error("Could not charge for the Key Remnants nobody found", err);
        }
        try {
            /* A death nobody has found stays the GMs' through the trial (E05 C10; the owner's
               Q3, 26.09.2026): the GM opening it is told how many, and publishes by hand. */
            const { tellUnfoundDeaths } = await import("./chapter.mjs");
            tellUnfoundDeaths();
        } catch (err) {
            error("Could not count the deaths nobody has found at the trial's start", err);
        }
    }

    /* THE TABLE AND THE HALL'S CAST (E13 C2, C3): into the trial the hall's cast the GMs chose is
       shown and the hall activated, so every browser is taken there; out of it the school is
       activated and the cast hidden - trial-scene.mjs `followPhase`, on this GM's client. Every road
       into and out of the trial reaches it here and only here (R113): it is why no door activates a
       scene itself. Last, after every rule step above: it is a draw, and a hall that cannot be
       updated or activated must not hold up the budget or the reset. No hall linked, it does
       nothing. */
    if (from === "classTrial" || to === "classTrial") {
        try {
            const { followPhase } = await import("./trial-scene.mjs");
            await followPhase(from, to);
        } catch (err) {
            error("Could not move the table to or from the trial hall after the phase changed", err);
        }
    }
}

/**
 * The mechanical half of ending an Eclipse, for the routes that only write the flag.
 *
 * Judging the murders declared under the Eclipse stays in `endEclipse`: the one
 * route that comes through here without it is the season reset, and a season
 * being wiped has no murders left to rule on. The crossings are not cleared here
 * any more (E05): each is named for its Eclipse (`eclipseId`), and counts nothing
 * once another runs.
 */
async function reconcileEclipseEnded() {
    try {
        const { broadcast, SYNC } = await import("./sync.mjs");
        broadcast(SYNC.eclipse, { active: false });
    } catch (err) {
        error("Could not tell the other clients the Eclipse had ended", err);
    }
}
