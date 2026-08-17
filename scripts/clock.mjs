/**
 * Danganronpa RPG — the campaign clock.
 * ---------------------------------------------------------------------------
 * Season → Chapter → Session → Time of day.
 *
 * One session is one in-fiction day, which is five times of day: Morning, Noon,
 * Afternoon, Evening, Night. Advancing the clock restocks every room's search
 * tokens.
 *
 * It does NOT refill the action economy. Actions and the free Move come back
 * when the Eclipse — the placement window that sits between two times of day —
 * begins; see eclipse.mjs. Doing it here as well handed the table two budgets
 * whenever an Eclipse was used, and one at the wrong moment whenever it was not.
 *
 * Chapters are not advanced automatically — how many sessions a chapter runs is
 * the GM's call, and the guide explicitly allows stretching one when no murder
 * has happened yet.
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES } from "./config.mjs";
import { SETTINGS, DEFAULT_CLOCK } from "./settings.mjs";
import { resetAllActions } from "./actions.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { announce, log, warn, plural } from "./utils.mjs";

/** Current clock, always with every field present. */
export function getClock() {
    const stored = game.settings.get(MODULE_ID, SETTINGS.clock) ?? {};
    return { ...DEFAULT_CLOCK, ...stored };
}

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

/** Set the phase: dailyLife | investigation | classTrial. */
export async function setPhase(key) {
    if (!PHASES[key]) {
        ui.notifications.error(game.i18n.format("DRPG.Clock.unknownPhase", { key }));
        return null;
    }
    return setClock({ phase: key });
}

/** "Chapter 2 · Day 3 · Session 3 · Afternoon" */
export function clockSummary(clock = getClock()) {
    return game.i18n.format("DRPG.Clock.summary", {
        chapter: clock.chapter,
        day: clock.day ?? 1,
        session: clock.session,
        time: timeOfDayLabel(clock.timeOfDay)
    });
}

/** Write clock fields. GM only. */
export async function setClock(patch = {}) {
    if (!game.user.isGM) {
        warn("Only a GM can move the campaign clock.");
        return null;
    }
    const before = getClock();
    const next = { ...before, ...patch };

    // Stamp when this time of day began, so the HUD can say how long it has run.
    // Written here rather than in `advanceTimeOfDay` because the GM also moves
    // the clock by hand from the panel and by rewinding, and a timer that only
    // reset on one of those three routes would quietly lie on the other two.
    // `patch` wins if a caller sets the stamp itself — that is how a correction
    // can move the clock without pretending the pause never happened.
    if (patch.timeOfDay !== undefined && patch.timeOfDay !== before.timeOfDay
        && patch.timeOfDayStartedAt === undefined) {
        next.timeOfDayStartedAt = Date.now();
    }

    await game.settings.set(MODULE_ID, SETTINGS.clock, next);

    // The guide clears the players' evidence "na początku następnej sesji", and
    // that is the one moment nobody is looking at a button. A reminder, never an
    // automatic sweep: the deletion is permanent, and a session counter nudged
    // by accident must not take a chapter's worth of Truth Bullets with it.
    if (next.session > before.session) {
        ui.notifications.info(game.i18n.localize("DRPG.Chapter.sweepReminder"));
    }

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
 *   default — that is the Eclipse's job, not the clock's. The GM panel's "also
 *   refill" checkbox passes it explicitly when a correction needs it.
 * @param {boolean} [options.resetSearchTokens] Restock every room.
 * @param {boolean} [options.announce]          Post the new time of day to chat.
 */
export async function advanceTimeOfDay({
    resetActions = false,
    resetSearchTokens = true,
    announce = true,
    // Extra fields to fold into the SAME write. `endEclipse` uses it to clear
    // the Eclipse flag as the clock moves, rather than in a write of its own —
    // see the note on the flicker below.
    also = {}
} = {}) {
    if (!game.user.isGM) return null;

    const clock = getClock();
    const index = TIMES_OF_DAY.indexOf(clock.timeOfDay);
    const nextIndex = (index + 1) % TIMES_OF_DAY.length;
    const rolledOver = nextIndex === 0;

    // ONE write, not two.
    //
    // Every setting write redraws the HUD on every client, so a clock moved in
    // two steps is a clock that is briefly readable in a state it was never
    // meant to be in. Ending an Eclipse did exactly that: the flag was cleared
    // first, which left the previous time of day showing as an ordinary label
    // for a frame, and then the time advanced. On screen that is the old time
    // of day flashing up between the Eclipse and the new one.
    //
    // Five times of day make one in-fiction day, so the day ticks over on the
    // same wrap that starts a new session.
    const next = await setClock({
        ...also,
        timeOfDay: TIMES_OF_DAY[nextIndex],
        session: rolledOver ? clock.session + 1 : clock.session,
        day: rolledOver ? (clock.day ?? 1) + 1 : (clock.day ?? 1)
    });

    await applyTimeOfDayChange(next, { resetActions, resetSearchTokens, announce, rolledOver });
    return next;
}

/**
 * Step the time of day backwards. This is a correction for a misclick, not a
 * game move, so it deliberately refills nothing — rewinding must never hand
 * the table a second set of actions.
 */
export async function rewindTimeOfDay() {
    if (!game.user.isGM) return null;

    const clock = getClock();
    const index = TIMES_OF_DAY.indexOf(clock.timeOfDay);
    const prevIndex = (index - 1 + TIMES_OF_DAY.length) % TIMES_OF_DAY.length;
    const rolledBack = prevIndex === TIMES_OF_DAY.length - 1;

    const next = await setClock({
        timeOfDay: TIMES_OF_DAY[prevIndex],
        session: rolledBack ? Math.max(1, clock.session - 1) : clock.session,
        day: rolledBack ? Math.max(1, (clock.day ?? 1) - 1) : (clock.day ?? 1)
    });

    // A Despair Call lasts one time of day. Stepping the clock back left every
    // one of them standing: a sealed room stayed sealed and a chained player
    // stayed chained into a time of day that had already been undone, with
    // nothing left to clear them.
    await import("./call-effects.mjs").then(m => m.clearSeals()).catch(() => {});

    return next;
}

/** Jump straight to a specific time of day without rolling the session over. */
export async function setTimeOfDay(key, options = {}) {
    if (!game.user.isGM) return null;
    if (!TIMES_OF_DAY.includes(key)) {
        ui.notifications.error(game.i18n.format("DRPG.Clock.unknownTime", { key }));
        return null;
    }

    const next = await setClock({ timeOfDay: key });
    await applyTimeOfDayChange(next, options);
    return next;
}

/** Everything that has to happen when the time of day changes. */
async function applyTimeOfDayChange(clock, {
    resetActions = false,
    resetSearchTokens = true,
    announce = true,
    rolledOver = false
} = {}) {
    const summary = { clock, rolledOver, actions: [], searchTokensReset: false };

    if (resetActions) summary.actions = await resetAllActions();
    if (resetSearchTokens) summary.searchTokensReset = await SearchTokens.reset({ notify: false });

    // "Behind Closed Doors" seals a room for one time of day.
    await import("./call-effects.mjs").then(m => m.clearSeals()).catch(() => {});

    log(`Clock -> ${clockSummary(clock)}`);

    if (announce) await announceTimeOfDay(clock, summary);

    // Everyone, not just whoever clicked.
    //
    // This used to be a bare `Hooks.callAll`, which runs on the calling client
    // and nowhere else. The world setting itself synchronises, so a player's
    // stored clock was correct — but nothing on their screen redrew, and the
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
 * Tell the table. The time of day is public knowledge — unlike almost
 * everything else in this game.
 */
async function announceTimeOfDay(clock, summary) {
    const wounded = summary.actions.filter(r => r.wounded);

    const notes = [];
    if (summary.actions.length) {
        notes.push(plural("DRPG.Clock.actionsRefilled", { count: summary.actions.length }, "count"));
    }
    if (summary.searchTokensReset) {
        notes.push(game.i18n.localize("DRPG.Clock.searchTokensRestocked"));
    }

    const body = notes.length ? `<p><em>${notes.join(" · ")}</em></p>` : "";

    await announce({
        content: `<h3>${timeOfDayLabel(clock.timeOfDay)}</h3>
                  <p>${clockSummary(clock)}</p>${body}`
    });

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
 */
export function refreshSheets() {
    import("./hud.mjs").then(m => m.renderHud()).catch(() => {});

    for (const app of Object.values(ui.windows ?? {})) {
        if (app?.document?.type === "character") app.render(false);
    }
    for (const app of foundry.applications?.instances?.values() ?? []) {
        if (app?.document?.type === "character") app.render(false);
    }
}
