/**
 * Danganronpa RPG — the campaign clock.
 * ---------------------------------------------------------------------------
 * Season → Chapter → Session → Time of day.
 *
 * One session is one in-fiction day, which is five times of day: Morning, Noon,
 * Afternoon, Evening, Night. Advancing the clock is the heartbeat of the game:
 * it refills everyone's actions, returns their free Move, and restocks every
 * room's search tokens.
 *
 * Chapters are not advanced automatically — how many sessions a chapter runs is
 * the GM's call, and the guide explicitly allows stretching one when no murder
 * has happened yet.
 */

import { MODULE_ID, TIMES_OF_DAY, TIME_OF_DAY_LABELS, PHASES } from "./config.mjs";
import { SETTINGS, DEFAULT_CLOCK } from "./settings.mjs";
import { resetAllActions } from "./actions.mjs";
import { SearchTokens } from "./search-tokens.mjs";
import { log, warn } from "./utils.mjs";

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
    const next = { ...getClock(), ...patch };
    await game.settings.set(MODULE_ID, SETTINGS.clock, next);
    return next;
}

/* ==========================================================================
 * ADVANCING
 * ========================================================================== */

/**
 * Move to the next time of day, rolling into the next session after Night.
 *
 * @param {object} [options]
 * @param {boolean} [options.resetActions]      Refill everyone's actions.
 * @param {boolean} [options.resetSearchTokens] Restock every room.
 * @param {boolean} [options.announce]          Post the new time of day to chat.
 */
export async function advanceTimeOfDay({
    resetActions = true,
    resetSearchTokens = true,
    announce = true
} = {}) {
    if (!game.user.isGM) return null;

    const clock = getClock();
    const index = TIMES_OF_DAY.indexOf(clock.timeOfDay);
    const nextIndex = (index + 1) % TIMES_OF_DAY.length;
    const rolledOver = nextIndex === 0;

    // Five times of day make one in-fiction day, so the day ticks over on the
    // same wrap that starts a new session.
    const next = await setClock({
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

    return setClock({
        timeOfDay: TIMES_OF_DAY[prevIndex],
        session: rolledBack ? Math.max(1, clock.session - 1) : clock.session,
        day: rolledBack ? Math.max(1, (clock.day ?? 1) - 1) : (clock.day ?? 1)
    });
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
    resetActions = true,
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

    // Later stages hang off this: room reveals, Monokuma motives, night rules.
    Hooks.callAll("drpgTimeOfDayChanged", clock, summary);
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
        notes.push(game.i18n.format("DRPG.Clock.actionsRefilled", { count: summary.actions.length }));
    }
    if (summary.searchTokensReset) {
        notes.push(game.i18n.localize("DRPG.Clock.searchTokensRestocked"));
    }

    const body = notes.length ? `<p><em>${notes.join(" · ")}</em></p>` : "";

    await ChatMessage.create({
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
