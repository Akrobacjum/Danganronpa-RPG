/**
 * Danganronpa RPG - what that time of day actually amounted to.
 * ---------------------------------------------------------------------------
 * A time of day is five players acting in parallel across a dozen rooms, and by
 * the time the Eclipse arrives nobody can reconstruct their own half of it: the
 * cards that announced each result auto-dismissed twelve seconds after they
 * appeared, and the chat log holds them interleaved with everybody else's.
 *
 * So the Eclipse - which is otherwise dead air, a placement phase with nothing
 * to read - opens a summary instead. What you did, what you found, what you
 * left behind. Since E37 C4 (D44c) every end of a time of day does: an Eclipse's
 * start, and a move of the clock no Eclipse opened - "Next time of day",
 * `setTimeOfDay`, the API (`summaryWindow`, below).
 *
 * It invents nothing. Every line comes from the facts `report()` sends with the
 * card it posts - kept beside the card's words in this browser's private-card
 * store (secret.mjs `secretSummaries`), not on the card since E05 C7 - and the
 * window is bounded by `timeOfDayStartedAt` on the clock. Two things the module
 * was producing and throwing away.
 *
 * Per client, and per that client's own actor: a player's summary is their
 * own, and a GM gets the table's.
 */

import { getClock, timeOfDayLabel, boundaryStamp } from "./clock.mjs";
import { MODULE_ID, TIMES_OF_DAY } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { secretSummaries } from "./secret.mjs";
import { error, esc, plural } from "./utils.mjs";
import { showPopup } from "./popup.mjs";

/*
 * WHAT THIS PAGE LAST SAW OF THE CLOCK, AND THE LAST BOUNDARY IT SUMMED UP (E37 C4, 01.11.2026; E37-16, D44c, audit
 * S10-79). The summary showed on `drpgEclipseChanged(true)` alone, so a time of day the GM closed with "Next time of
 * day" - or `setTimeOfDay`, or the API - closed with none. `drpgTimeOfDayChanged` hands the NEW clock, whose
 * `timeOfDayStartedAt` is the new time of day's, so the ended one's window is read off the clock this page saw before
 * it (`seen`): read at `ready`, so a page loaded mid-time-of-day sums up from what it found, and kept at every hook of
 * the clock and at every write of it that moves no boundary (a pause, a phase's restamp at the trial's edge, a
 * correction of the stamp). `shownFor` is the `boundaryStamp` of the last time of day this page summed up, so a
 * boundary is summed up once on each browser: an Eclipse ended without advancing and opened again, or a rewind and
 * Next again within it, show nothing new. Both are this page's own, in memory; nothing is written.
 */
let seen = null;
let shownFor = null;

export function registerDaySummary() {
    // Every hook of the clock reads it the same way, so whichever of them a run of the bus calls first (the calendar's,
    // the phase's, the Eclipse's) does the reading and the rest find nothing new. The Eclipse's hook is handed the flag:
    // its packet can land before the clock's setting does here, so the flag it names is the one read.
    Hooks.on("drpgTimeOfDayChanged", clock => sumUp(clock ?? getClock()));
    Hooks.on("drpgPhaseChanged", () => sumUp(getClock()));
    Hooks.on("drpgEclipseChanged", running => sumUp({ ...getClock(), eclipse: running === true }));
    Hooks.on("updateSetting", setting => {
        if (setting?.key !== `${MODULE_ID}.${SETTINGS.clock}` || !seen) return;
        const clock = getClock();
        if (calendarOf(clock) === calendarOf(seen) && (clock?.eclipse === true) === (seen.eclipse === true)) seen = clock;
    });
    Hooks.once("ready", () => { seen ??= getClock(); });
}

/* The clock this page is told of, read against the one it saw: the summary of the time of day that ended, if one did. */
function sumUp(clock) {
    const window = seen ? summaryWindow(seen, clock, shownFor) : null;
    seen = clock;
    if (!window) return;
    shownFor = window.stamp;
    showDaySummary(window).catch(err => error("Could not show the day summary", err));
}

const calendarOf = clock => JSON.stringify([clock?.season ?? null, clock?.chapter ?? null, clock?.session ?? null,
    clock?.day ?? null, clock?.timeOfDay ?? null]);

/**
 * The window of the time of day that `after` closes, read against `before` (the clock this page saw) and `shownFor`
 * (the boundary it summed up last): `{ since, until, timeOfDay, stamp }`, or null with none to sum up. Pure (R1197).
 *
 * - A move of the clock forward in the same season and chapter, with no Eclipse open before it - Next time of day,
 *   `setTimeOfDay` to a later time, the night's wrap into the next day: `before`'s time of day ends, over [its
 *   `timeOfDayStartedAt`, the new one's), named `before`'s, and its stamp the boundary out of it (`boundaryStamp`).
 * - An Eclipse's start (the flag set, the calendar where it was): the clock's own time of day ends, over [its stamp,
 *   the Eclipse's start), the stamp the boundary the Eclipse opens - the same window as Next's for the same cards.
 * - Nothing else: a move out of an Eclipse (its start summed it up; a page loaded in the dark saw no time of day of its
 *   own to close), a rewind (an earlier day, or an earlier time of the same day), a new season or chapter (the season's
 *   reset, the chapter's step), a write that moves neither (a pause), a clock with no stamp (R996's rule: no stamp, no
 *   summary), a window that closes before it opens (a clock put back with an older stamp), or a boundary `shownFor`
 *   names already.
 */
export function summaryWindow(before, after, shown = null) {
    if (!before || !after) return null;
    if ((before.season ?? null) !== (after.season ?? null) || (before.chapter ?? null) !== (after.chapter ?? null)) return null;
    const at = clock => [Number(clock.day ?? 1), TIMES_OF_DAY.indexOf(clock.timeOfDay)];
    const [dayBefore, timeBefore] = at(before), [dayAfter, timeAfter] = at(after);
    const finite = value => (value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null);
    let window = null;
    if (before.eclipse !== true && (dayAfter > dayBefore || (dayAfter === dayBefore && timeAfter > timeBefore))) {
        window = { since: summarySinceOf(before), until: finite(after.timeOfDayStartedAt), timeOfDay: before.timeOfDay ?? null,
            stamp: boundaryStamp(before) };
    } else if (after.eclipse === true && before.eclipse !== true && dayAfter === dayBefore && timeAfter === timeBefore) {
        window = { since: summarySinceOf(after), until: finite(after.eclipseStartedAt), timeOfDay: after.timeOfDay ?? null,
            stamp: boundaryStamp(after) };
    }
    if (!window || window.since === null) return null;
    if (window.until !== null && window.until <= window.since) return null;
    return window.stamp === shown ? null : window;
}

/**
 * Everything this client holds from the time of day just ended.
 *
 * WHAT THIS SAID WAS NOT TRUE (E05 C7, 26.09.2026; audit S10-05). It read the
 * facts off `game.messages`, "already filtered by Foundry to what this user may
 * read" - but Foundry sends every chat message to every browser and only hides
 * the whispers in the interface, and the facts were a flag on the document: p2's
 * copy of p1's Search card said what p1 found (40-flow, S02-11). The facts come
 * with the card's words now, to the card's readers alone, and are read from this
 * browser's store: a player's summary can hold only what was sent to them.
 * Exported for the suite. `until` (E37 C4) closes the window at the boundary: a card of the time of day that began
 * there is not the ended one's.
 */
export function entriesSince(startedAt, until = null) {
    const entries = secretSummaries(startedAt);
    return until === null ? entries : entries.filter(entry => entry.at < until);
}

/**
 * Where the summary's window opens: the time of day's start, or null with none (E17 C6, 26.10.2026; audit S10-16). A
 * clock never moved, an older world's included, has no stamp, and `?? 0` read that as the start of time: every card the
 * browser held went into the window. No stamp, no summary. Since C6 the stamp never moves within a time of day (the
 * pauses are `pausedTotalMs`), so what was done before a pause stays in "What you did". Pure (R996).
 */
export function summarySince(clock) {
    return summarySinceOf(clock);
}

/**
 * The card's lede and its totals (E66 C3, 01.11.2026; S13-29, S10-69, E66-14). A GM's summary lists every student's
 * rows under who did them, and its lede said "What you did" over the table's: a GM reads `Summary.ledeGm`. The totals
 * are three plural families joined, each counted on its own number; `Summary.lede` was handed an `n` it never wrote.
 * Pure, so R1156 reads both as a player and as a GM.
 */
export function summaryLede(phase, gm = false) {
    return game.i18n.format(gm ? "DRPG.Summary.ledeGm" : "DRPG.Summary.lede", { phase });
}

export function summaryTotals({ actions = 0, found = 0, traces = 0 } = {}) {
    return [plural("DRPG.Summary.totals", { actions }, "actions"), plural("DRPG.Summary.totalsFound", { found }, "found"),
        plural("DRPG.Summary.totalsTraces", { traces }, "traces")].join(" · ");
}

function summarySinceOf(clock) {
    const started = Number(clock?.timeOfDayStartedAt);
    return clock?.timeOfDayStartedAt && Number.isFinite(started) ? started : null;
}

/**
 * The summary of a time of day, as a popup. Handed the window `summaryWindow` read (E37 C4): its start, its end and
 * the time of day it names, which at Next is no longer the clock's. With none, the clock's own time of day so far.
 */
export async function showDaySummary(window = null) {
    const clock = getClock();
    const started = window ? window.since : summarySince(clock);
    if (started === null || started === undefined) return;
    const entries = entriesSince(started, window?.until ?? null);
    const timeOfDay = window?.timeOfDay ?? clock?.timeOfDay;

    // Nothing happened - a time of day spent entirely in conversation is a
    // legitimate one, and a window saying "you did nothing" is a scolding.
    if (!entries.length) return;

    const mine = game.user.isGM
        ? entries
        : entries.filter(e => !e.actorId || game.actors.get(e.actorId)?.isOwner);
    if (!mine.length) return;

    const rows = mine.map(e => {
        const bits = [
            `<span class="drpg-sum-action">${esc(e.action)}</span>`,
            e.room ? `<span class="drpg-sum-room">${esc(e.room)}</span>` : null,
            e.total != null ? `<span class="drpg-sum-total">${esc(e.total)}</span>` : null
        ].filter(Boolean).join('<span class="drpg-sum-sep">-</span>');

        const tail = [];
        if (e.item) {
            tail.push(`<span class="drpg-sum-found">${
                game.i18n.format("DRPG.Summary.found", { tier: e.tier ?? "?", item: esc(e.item) })}</span>`);
        }
        // Never the visibility band a trace was left at - see `traceFeedback`
        // in remnants.mjs. `e.leftTrace` is already the gated answer to
        // "does this player get told anything at all", so there is nothing
        // left to redact here beyond the word itself.
        if (e.leftTrace) {
            tail.push(`<span class="drpg-sum-left">${
                game.i18n.localize("DRPG.Summary.left")}</span>`);
        }
        if (e.critical) tail.push(`<span class="drpg-sum-crit">${game.i18n.localize("DRPG.Action.critical")}</span>`);

        const who = game.user.isGM && e.actorId
            ? `<span class="drpg-sum-who">${esc(game.actors.get(e.actorId)?.name ?? "")}</span>`
            : "";

        return `<li class="drpg-sum-row">${who}<span class="drpg-sum-head">${bits}</span>${
            tail.length ? `<span class="drpg-sum-tail">${tail.join("")}</span>` : ""}</li>`;
    });

    const found = mine.filter(e => e.item).length;
    const traces = mine.filter(e => e.leftTrace).length;

    const content = `
        <div class="drpg-day-summary">
            <p class="drpg-sum-lede">${summaryLede(esc(timeOfDayLabel(timeOfDay)), game.user.isGM)}</p>
            <ul class="drpg-sum-list">${rows.join("")}</ul>
            <p class="drpg-sum-totals">${summaryTotals({ actions: mine.length, found, traces })}</p>
        </div>`;

    /*
     * A CARD, NOT A MODAL (audit E4). This was a `DialogV2.prompt`, and it
     * opened on every player at the one moment an Eclipse asks them to drag a
     * token - a window in the way of the only thing there is to do. The popup
     * stack is the module's surface for "read this now" (E1): it sits beside
     * the map, takes no focus, and sticky means it waits to be closed rather
     * than fading under somebody still reading. The per-action cards it sums
     * up are already in the chat log, so the record needs no second message.
     * The summary itself was gone once closed; since E81 C4 it is kept in this
     * browser's notice history as a summary (the A7 design's P4-0): the four
     * newest whole, the older ones by their words alone (notice-history.mjs, R292).
     */
    showPopup(content, { title: game.i18n.localize("DRPG.Summary.title"), sticky: true, source: "summary" });
}
