/**
 * Danganronpa RPG - the HUD's stopwatch and the clock it shows.
 * ---------------------------------------------------------------------------
 * The line under the clock that says how long this time of day has run, and
 * the stamps it is read from. A pause and the primary's ready settle them
 * (`settleElapsedPause`, `unpausePatch`, `readyPatch`, `settleClockAtReady`,
 * with `restartedAt` for a start stamped on the uptime clock), and the primary's
 * beat says when a GM was last here (`beatClock`, `CLOCK_BEAT_MS`). The clock
 * this browser may show while an incident hides it from a bystander
 * (`shownClock`, `lastPublicClock`, `clockForDisplay`). The line itself: its
 * two marks, its timer, its build and stop, its reading and its paint
 * (`MARK_FIRST_ACTION`, `MARK_SECOND_ACTION`, `elapsedTimer`, `buildElapsed`,
 * `stopElapsed`, `setText`, `elapsedOf`, `showsStopwatch`, `paintElapsed`).
 *
 * WHERE IT SITS. Moved out of hud.mjs by E41 C7b (1.2.97), a pure move that
 * `node tools/moved-only.mjs` proves line by line. `paintElapsed` reads
 * `clockForDisplay`, so the clock shown came with the stopwatch. hud.mjs
 * re-exports the names here it exported before, so every importer still
 * imports hud.mjs, and nothing here imports it back (the facade rule,
 * .claude/rules/code.md).
 */

import { TIMING, staleStamp } from "./config.mjs";
import { getClock, setClock } from "./clock.mjs";
import { isPrimaryGm, error, serverNow, plural } from "./utils.mjs";
import { murderState, clockHiddenHere } from "./murder.mjs";

/**
 * Keep the elapsed timer honest across a pause.
 *
 * On pause: stamp when it happened, and `paintElapsed` freezes there.
 * On unpause: add however long the break ran to `pausedTotalMs` (`unpausePatch`),
 * so the timer carries on from the same number instead of having counted the
 * break. The stamp is cleared in the same write.
 *
 * THE START OF THE TIME OF DAY STAYS WHERE IT IS (E17 C6, 26.10.2026; audit S10-16).
 * This pushed `timeOfDayStartedAt` forward by the break until then, and that stamp
 * is also the day's summary's window: a Search made at 18:05 was gone from "What you
 * did" after a pause from 18:10 to 18:25. Tier 2 E17-T9 at 3efafbd0: the start had
 * moved after a pause.
 *
 * GM-only, and primary-GM-only, because it writes the clock - two GMs both
 * adding the pause duration would double it. A second GM's pause fires
 * `pauseGame` on the primary's browser as well, which writes it.
 */
export async function settleElapsedPause(paused) {
    try {
        if (!game.user.isGM || !isPrimaryGm()) return;
        const clock = getClock();
        if (!clock.timeOfDayStartedAt) return;

        if (paused) {
            if (clock.pausedAt) return;              // already stamped
            await setClock({ pausedAt: serverNow() });
            return;
        }

        const patch = unpausePatch(clock, serverNow());
        if (patch) await setClock(patch);
    } catch (err) {
        // A drifting timer is a cosmetic problem; never let it throw into the
        // pause handler, which everything else on screen also listens to.
        error("Could not settle the paused time-of-day timer", err);
    }
}

/**
 * A TIME OF DAY STARTED ON THE UPTIME CLOCK STARTS NOW (E90, 31.10.2026). Until 1.2.93 the start was stamped with
 * `game.time.serverTime`, which on The Forge is the server's uptime (2811317 at the owner's table, beside
 * `Date.now()` 1793415993407; config.mjs `epochClock`). Read against the epoch clock, `now - start` is 56 years and the
 * stopwatch printed some 29 million minutes. How long that time of day had run is not known on any clock, so the
 * primary writes it as begun at `now` with no pauses (`readyPatch` at its ready, `unpausePatch` at an unpause) - the
 * stopwatch undercounts what came before, never by decades - and until that write `elapsedOf` prints no number. The
 * day's summary reads the same stamp: from the write on it holds what was done since, where the uptime start had
 * held every card this browser kept (the cards are stamped `Date.now()`, secret.mjs `remember`). Tier 1 R1565.
 */
function restartedAt(now) {
    return { timeOfDayStartedAt: now, pausedTotalMs: 0 };
}

/**
 * The clock's patch for the end of a pause at `now`, or null when nothing was paused:
 * the break added to `pausedTotalMs`, the stamp cleared. A break counts from the later
 * of its stamp and the time of day's start - a time of day begun in the middle of a
 * pause owes it only what came after it began. Pure (R996).
 */
export function unpausePatch(clock, now) {
    if (!clock?.timeOfDayStartedAt || !clock.pausedAt) return null;
    if (staleStamp(clock.timeOfDayStartedAt, now)) return { ...restartedAt(now), pausedAt: null };
    const from = Math.max(Number(clock.pausedAt), Number(clock.timeOfDayStartedAt));
    return { pausedTotalMs: (Number(clock.pausedTotalMs) || 0) + Math.max(0, now - from), pausedAt: null };
}

/**
 * HOW OFTEN THE PRIMARY BEATS, in ms (E17 C6): a design number, not a measured one - the
 * stopwatch's error bound across two sessions (the minute at most between the last beat
 * and the browser going away is counted as play), against one GM store write a minute.
 */
export const CLOCK_BEAT_MS = 60_000;

/**
 * The clock's patch for the primary's `ready`, or null (E17 C6, 26.10.2026; audit S10-16).
 * The last moment a GM is known to have been here is the later of the GMs' last beat
 * (`beat`, `clockBeatStore`, or null) and the clock's own last write (`writtenAt`, clock.mjs
 * `setClock`), each read only at or after the time of day's start. A world that loads paused
 * with no stamp is stamped at that moment, so the unpause takes the gap off with the pause;
 * with neither known, at `now` (as before E17: nothing says when the last session ended). A
 * world running at ready whose last known moment is older than two beats was left by its
 * primary: the gap is added to the pauses. A stamp standing while the world runs is a pause
 * whose end nobody settled: settled now, the whole of it a pause. Pure (R996).
 *
 * THE CLOCK'S WRITE BESIDE THE BEAT (E17 fix p2-G1, 26.10.2026; the end review's E17p2-R1,
 * R5). The beat is a client setting, in the browser of the GM who wrote it, and reaches only
 * the GMs online then. (1) A reload within the minute after an unpause read the beat from
 * before the pause, and the pause already in `pausedTotalMs` was added again (the HUD went
 * from 20 to about 10 minutes). (2) A GM opening the world on another computer had no beat,
 * and the week between sessions was counted; one with a beat from before this time of day
 * read the start, and took the pauses already counted off again. Every unpause and every
 * stamp of this function writes the clock, so `writtenAt` is at or after the end of every
 * counted pause, and every GM's browser reads it. What it leaves: on a browser with no beat,
 * the minutes played after the clock's last write are not counted (an undercount, at most
 * that stretch of the last session's play), never the days between sessions (LIVE-E17-01 (4)).
 * A beat from before the start is none: the start alone says nothing of the pauses after it.
 */
export function readyPatch(clock, { paused, beat, now }) {
    if (!clock?.timeOfDayStartedAt) return null;
    const start = Number(clock.timeOfDayStartedAt);
    if (staleStamp(start, now)) return { ...restartedAt(now), pausedAt: paused ? now : null };
    const seen = [beat, clock.writtenAt]
        .filter(at => at !== null && at !== undefined && Number.isFinite(Number(at)) && Number(at) >= start)
        .map(Number);
    const last = seen.length ? Math.min(now, Math.max(...seen)) : null;
    if (paused) return clock.pausedAt ? null : { pausedAt: last ?? now };
    if (clock.pausedAt) return unpausePatch(clock, now);
    if (last === null || now - last <= 2 * CLOCK_BEAT_MS) return null;
    return { pausedTotalMs: (Number(clock.pausedTotalMs) || 0) + (now - last) };
}

/**
 * The primary's stamp at `ready` (`readyPatch`), from the GMs' beat once their copies
 * are here. Exported for the suite (tier 2 E17-T9), which runs it as a reload would.
 */
export async function settleClockAtReady() {
    if (!game.user.isGM || !isPrimaryGm()) return null;
    if (!getClock().timeOfDayStartedAt) return null;
    const { clockBeatStore } = await import("./gm-stores.mjs");
    await clockBeatStore.whenHydrated();
    const patch = readyPatch(getClock(), { paused: game.paused, beat: clockBeatStore.record()?.at ?? null, now: serverNow() });
    if (patch) await setClock(patch);
    return patch;
}

/** The primary's beat: `serverNow()` in the GMs' store while the world runs (`CLOCK_BEAT_MS`). */
export async function beatClock() {
    if (!game.user?.isGM || !isPrimaryGm() || game.paused) return;
    const [{ clockBeatStore }, { RECORD }] = await Promise.all([import("./gm-stores.mjs"), import("./gm-store.mjs")]);
    await clockBeatStore.patch(RECORD, { at: serverNow() });
}

/**
 * WHAT A BYSTANDER'S HUD SHOWS (E17 C7, 26.10.2026; audit S10-07): the clock itself unless `hide`; hidden, this page's
 * copy from before the incident (`last`), or - after a reload, with no copy - the clock as the incident opened on it
 * (`clockAtOpen`, written by murder-rules.mjs `openMurder`) over the live one; with neither, the live clock, as
 * before. Exported for the suite (tier 2 E17-T10), which has no bystander's page to reload. Pure.
 */
export function shownClock(clock, { hide = false, last = null } = {}) {
    if (!hide) return clock;
    if (last) return last;
    return clock?.clockAtOpen ? { ...clock, ...clock.clockAtOpen } : clock;
}

/**
 * The last clock this client was ALLOWED to display. See `clockForDisplay`.
 */
let lastPublicClock = null;

/**
 * The clock as this client may show it.
 *
 * While a murder runs, the clock moves in private (Dawid, 26.08): the change
 * of time is part of the incident, and the HUD flipping to "Morning" on every
 * screen would tell each outsider that the GM is doing something at this hour.
 * So an outsider's HUD keeps showing the clock as it stood when the incident
 * began, and catches up the moment it ends - `murderState` clearing travels
 * the sync bus, which re-renders the HUD on every client (SYNC.incident since E37 C5).
 *
 * The GM and the participants' owners see the truth throughout; they are the
 * people the incident is happening TO. Note the world SETTING still reaches
 * every client - nothing world-scoped can be hidden from a console (see the
 * settings notes) - this hides the answer from the SCREEN, which is where the
 * table actually reads it.
 *
 * EVERY SCREEN THAT SHOWS THE CLOCK ASKS THIS (E05 C15, 27.09.2026; audit S01-11).
 * The explainer a click on the HUD opens ("Where things stand", explain.mjs
 * `openStateExplainer`) read `getClock()` itself, so a bystander one click away
 * from a frozen HUD was shown the hour the incident had moved to. Exported for it;
 * the frozen copy is this client's, kept by whichever of the two asked last.
 */
export function clockForDisplay(clock) {
    try {
        /* WHO IS AN OUTSIDER IS THE INCIDENT'S TABLE (E06 C2, 27.09.2026; D6): the seats of
           `incidentSeats` (settings.mjs) at the stage running, of this browser's own cast -
           so a direct murder's victim keeps the frozen clock through the opening, as they
           are told nothing else of it until the killer's roll succeeds. Not `incidentWitness`,
           which reads the opening and the fight alone: at Stage 6 a trap's builder is seated
           again, and sees the live clock as every other participant does. */
        const hide = clockHiddenHere(murderState());

        if (!hide) {
            lastPublicClock = foundry.utils.duplicate(clock);
            return clock;
        }
        return shownClock(clock, { hide: true, last: lastPublicClock });
    } catch {
        // A HUD that cannot decide shows the truth - a wrong clock for one
        // render beats no clock at all.
        return clock;
    }
}

const MARK_FIRST_ACTION = TIMING.elapsedMarksMinutes[0] * 60 * 1000;
const MARK_SECOND_ACTION = TIMING.elapsedMarksMinutes[1] * 60 * 1000;

let elapsedTimer = null;

export function buildElapsed() {
    const el = document.createElement("div");
    el.className = "drpg-hud-elapsed";
    el.dataset.tooltip = plural("DRPG.Hud.elapsedTooltip", { first: MARK_FIRST_ACTION / 60000, second: MARK_SECOND_ACTION / 60000 }, "first");
    paintElapsed(el);

    clearInterval(elapsedTimer);
    // Ten seconds: the readout is in whole minutes, so a per-second tick would
    // repaint sixty times for each visible change. The debate's per-second clock
    // lives on the Event panel now (`paintTrialClock` in events.mjs).
    const period = 10_000;
    elapsedTimer = setInterval(() => {
        // The HUD is rebuilt often; when this node is gone, so is the interval.
        if (!el.isConnected) {
            clearInterval(elapsedTimer);
            elapsedTimer = null;
            return;
        }
        paintElapsed(el);
    }, period);

    return el;
}

/** A trial has no elapsed line, so nothing may go on ticking for one. */
export function stopElapsed() {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
}

/*
 * WRITTEN ONLY WHEN THE WORDS CHANGE, BECAUSE SOMEBODY IS WATCHING THE DOM.
 *
 * `el.textContent = x` replaces the element's children even when `x` is what is
 * already there, and that is a childList mutation. `#drpg-hud` lives in
 * `#ui-left-column-1`, which a11y.mjs observes with `subtree: true`, so every
 * such write runs the accessibility sweep. The elapsed line is the most regular
 * writer in the module - a ten-second interval at rest and a one-second one for
 * the whole length of a Class Trial - and it prints WHOLE MINUTES, so at rest
 * five of every six writes said exactly what the line already said. The comment
 * on the interval below already explains that a per-second tick "would repaint
 * sixty times for each visible change"; this is the other half of that argument,
 * for the ticks that survived it.
 */
function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
}

/**
 * The minutes line's reading, in ms, or null where there is no line to print (E17 C6, 26.10.2026; audit S10-16): the
 * time since `timeOfDayStartedAt` less `pausedTotalMs`, frozen while paused at the later of `pausedAt` and the start.
 * Null with no stamp (a clock never moved) and in an Eclipse, whose clock still names the time of day it closes. Paused
 * with no stamp yet (the primary's write on its way, or a world loaded paused before the primary's ready) it counts on.
 * Pure (R996).
 */
export function elapsedOf(clock, { now, paused }) {
    const start = Number(clock?.timeOfDayStartedAt);
    if (!clock?.timeOfDayStartedAt || !Number.isFinite(start) || clock.eclipse === true) return null;
    // A start on the uptime clock (E90; `restartedAt`): no number until the primary writes it again.
    if (staleStamp(start, now)) return null;
    const end = paused && clock.pausedAt ? Math.max(Number(clock.pausedAt), start) : now;
    return Math.max(0, end - start - (Number(clock.pausedTotalMs) || 0));
}

/** Whether the HUD prints the minutes line for this clock: not in a Class Trial, not in an Eclipse (R996). */
export function showsStopwatch(clock) {
    return clock?.phase !== "classTrial" && clock?.eclipse !== true;
}

function paintElapsed(el) {

    // The DISPLAY clock (CORE-06): during an incident an outsider's label
    // freezes on the last public hour, and a counter that read the true clock
    // snapped to "0 min in" the moment the GM moved it - the very tell the
    // freeze exists to hide.
    const clock = clockForDisplay(getClock());
    el.classList.remove("past-first", "past-second", "paused");

    // A paused game is a stopped clock. The whole point of this readout is "how
    // much of the time of day have you used", and a break, a rules argument or a
    // safeword is not time anybody used. While paused it freezes at the moment
    // the pause began; `settleElapsedPause` then adds the break to the pauses
    // (`pausedTotalMs`), so it resumes where it stopped rather than jumping.
    const ms = elapsedOf(clock, { now: serverNow(), paused: game.paused });
    if (ms === null) {
        setText(el, game.i18n.localize("DRPG.Hud.elapsedUnknown"));
        el.classList.add("empty");
        return;
    }

    el.classList.remove("empty");
    el.classList.toggle("paused", Boolean(game.paused && clock.pausedAt));
    setText(el, game.i18n.format("DRPG.Hud.elapsed", {
        minutes: Math.floor(ms / 60000)
    }));

    if (ms >= MARK_SECOND_ACTION) el.classList.add("past-second");
    else if (ms >= MARK_FIRST_ACTION) el.classList.add("past-first");
}
