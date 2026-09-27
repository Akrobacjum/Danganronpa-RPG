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
 * left behind.
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

import { getClock, timeOfDayLabel } from "./clock.mjs";
import { secretSummaries } from "./secret.mjs";
import { error, esc} from "./utils.mjs";
import { showPopup } from "./popup.mjs";

export function registerDaySummary() {
    // The Eclipse is the seam between two times of day, and the only moment in
    // the cycle when nobody is mid-action.
    Hooks.on("drpgEclipseChanged", running => {
        if (running) showDaySummary().catch(err => error("Could not show the day summary", err));
    });
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
 * Exported for the suite.
 */
export function entriesSince(startedAt) {
    return secretSummaries(startedAt);
}

export async function showDaySummary() {
    const clock = getClock();
    const started = clock?.timeOfDayStartedAt ?? 0;
    const entries = entriesSince(started);

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
            <p class="drpg-sum-lede">${game.i18n.format("DRPG.Summary.lede", {
                phase: esc(timeOfDayLabel(clock?.timeOfDay)), n: mine.length })}</p>
            <ul class="drpg-sum-list">${rows.join("")}</ul>
            <p class="drpg-sum-totals">${game.i18n.format("DRPG.Summary.totals", {
                actions: mine.length, found, traces })}</p>
        </div>`;

    /*
     * A CARD, NOT A MODAL (audit E4). This was a `DialogV2.prompt`, and it
     * opened on every player at the one moment an Eclipse asks them to drag a
     * token - a window in the way of the only thing there is to do. The popup
     * stack is the module's surface for "read this now" (E1): it sits beside
     * the map, takes no focus, and sticky means it waits to be closed rather
     * than fading under somebody still reading. The per-action cards it sums
     * up are already in the chat log, so the record needs no second message.
     */
    showPopup(content, { title: game.i18n.localize("DRPG.Summary.title"), sticky: true });
}
