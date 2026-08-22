/**
 * Danganronpa RPG — what that time of day actually amounted to.
 * ---------------------------------------------------------------------------
 * A time of day is five players acting in parallel across a dozen rooms, and by
 * the time the Eclipse arrives nobody can reconstruct their own half of it: the
 * cards that announced each result auto-dismissed twelve seconds after they
 * appeared, and the chat log holds them interleaved with everybody else's.
 *
 * So the Eclipse — which is otherwise dead air, a placement phase with nothing
 * to read — opens a summary instead. What you did, what you found, what you
 * left behind.
 *
 * It invents nothing. Every line comes from a `summary` flag that `report()`
 * already stamps on the card it posts, and the window is bounded by
 * `timeOfDayStartedAt` on the clock. Two things the module was producing and
 * throwing away.
 *
 * Per client, and per that client's own actor: a player's summary is their
 * own, and a GM gets the table's.
 */

import { MODULE_ID } from "./config.mjs";
import { getClock } from "./clock.mjs";
import { error } from "./utils.mjs";

const { DialogV2 } = foundry.applications.api;

export function registerDaySummary() {
    // The Eclipse is the seam between two times of day, and the only moment in
    // the cycle when nobody is mid-action.
    Hooks.on("drpgEclipseChanged", running => {
        if (running) showDaySummary().catch(err => error("Could not show the day summary", err));
    });
}

/**
 * Everything this client is entitled to see from the time of day just ended.
 *
 * `game.messages` is already filtered by Foundry to what this user may read, so
 * a player cannot learn what anybody else did by opening their own summary —
 * the whispers that carried those results never reached them in the first
 * place.
 */
function entriesSince(startedAt) {
    const out = [];
    for (const message of game.messages) {
        const s = message.getFlag(MODULE_ID, "summary");
        if (!s) continue;
        if (startedAt && (s.at ?? message.timestamp) < startedAt) continue;
        out.push(s);
    }
    return out.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

export async function showDaySummary() {
    const clock = getClock();
    const started = clock?.timeOfDayStartedAt ?? 0;
    const entries = entriesSince(started);

    // Nothing happened — a time of day spent entirely in conversation is a
    // legitimate one, and a window saying "you did nothing" is a scolding.
    if (!entries.length) return;

    const mine = game.user.isGM
        ? entries
        : entries.filter(e => !e.actorId || game.actors.get(e.actorId)?.isOwner);
    if (!mine.length) return;

    const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
    const rows = mine.map(e => {
        const bits = [
            `<span class="drpg-sum-action">${esc(e.action)}</span>`,
            e.room ? `<span class="drpg-sum-room">${esc(e.room)}</span>` : null,
            e.total != null ? `<span class="drpg-sum-total">${esc(e.total)}</span>` : null
        ].filter(Boolean).join('<span class="drpg-sum-sep">—</span>');

        const tail = [];
        if (e.item) {
            tail.push(`<span class="drpg-sum-found">${
                game.i18n.format("DRPG.Summary.found", { tier: e.tier ?? "?", item: esc(e.item) })}</span>`);
        }
        // Never the visibility band a trace was left at — see `traceFeedback`
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
                phase: esc(clock?.timeOfDay ?? ""), n: mine.length })}</p>
            <ul class="drpg-sum-list">${rows.join("")}</ul>
            <p class="drpg-sum-totals">${game.i18n.format("DRPG.Summary.totals", {
                actions: mine.length, found, traces })}</p>
        </div>`;

    await DialogV2.prompt({
        window: { title: game.i18n.localize("DRPG.Summary.title") },
        content,
        ok: { label: game.i18n.localize("DRPG.Summary.close") },
        classes: ["drpg-summary-dialog"],
        rejectClose: false
    });
}
