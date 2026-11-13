/**
 * Danganronpa RPG - Tail Someone, the GMs' half: a tail started, its cards, its ends.
 * ---------------------------------------------------------------------------
 * E69 C3 and C4 (12.11.2026; the owner's audit entry E69, DA8, DA19-DA21, DA26, DA33, DA42; the plan's C3 and C4, read on
 * origin/claude/plan-130 docs/dev/plans/E69.md). Everything here runs on the primary GM: a tail is begun by the bridge
 * road `tail.start` (bridge-runs-acts.mjs `handleTailStart`, the two rolls read off the GMs' record of each), kept in the
 * GMs' store `tails` (gm-stores.mjs `tailStore`, a row per tailer), and its cards are sent from the one event of a settled
 * crossing (crossing-settle.mjs `CROSSING_SETTLED`, E69 C2), so nothing on the target's browser announces their move.
 *
 * WHO MAY BE TAILED. The one gate of a person's action (frisk.mjs `personActionRefusal`, as a Palm and a Frisk ask it): a
 * student in the tailer's room as the GMs read both, not the tailer, no Monocub, Monokuma or hidden token, outside an
 * Eclipse, a Class Trial and the tailer's own incident; and here, a target the GMs hold alive, outside an investigation.
 * A tail begun keeps sending cards through an Eclipse (DA20, DA33: every Eclipse alike); none may be begun in one - the
 * gate's rule, the default taken where the plan's C3 lists the Eclipse among the refusals (docs/dev/e69/STATUS.md).
 *
 * WHAT THE TARGET LEARNS (DA21). The Shadow roll against `INFILTRATE.tail.unseen.threshold` (15, as Palm), or a
 * critical: below it the target's owners are told the tailer's name at once, and the tail goes on all the same.
 *
 * THE CARDS (DA20). On each settled crossing of a target, the tailer's owners get "{name} moves to {room}" - only rooms.
 * A critical effect roll adds who stands in that room as the GMs read it (no Monocub, no Monokuma, no hidden token, no
 * body the GMs hold dead), except in an Eclipse, where the card is the plain one (the plan's "Eclipse card"). A target
 * the Mastermind or a GM's lock let through a seal is one more crossing: the card never says how they passed (DA42).
 *
 * THE ENDS. With a card: the tailer neither in the room the target left nor in the one it reached (lost, the range), a
 * new day, a body announced (body.mjs `BODY_ANNOUNCED_HOOK`, before the gather), a Dash of the target above the
 * tail's total - a critical tail only to a critical Dash. Silent: the tailer or the target dead, an incident running -
 * nothing is sent later for a tail ended so. A new tail of the same tailer replaces the old one.
 */

import { MODULE_ID, FLAGS, INFILTRATE } from "./config.mjs";
import { getClock, isDeadForGm } from "./settings.mjs";
import { isPrimaryGm, whisperToOwnerOnly, log, error, esc } from "./utils.mjs";
import { tailStore } from "./gm-stores.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";
import { BODY_ANNOUNCED_HOOK } from "./chapter.mjs";

/** The day a tail is counted in: the chapter's and the clock's day, as one mark. */
export function tailDay(clock = getClock()) {
    return `${clock?.chapter ?? 0}:${clock?.day ?? 1}`;
}

/** Every tail under way, `[tailerId, row]`. */
export function tailsUnderWay() {
    return Object.entries(tailStore.entries() ?? {}).filter(([, row]) => row?.targetId);
}

/** Why `tailer` may not begin to tail `target` now, as the GMs read it, or null. English: the bridge maps it to a code. */
export async function tailRefusal(tailer, target) {
    const { personActionRefusal } = await import("./frisk.mjs");
    const why = personActionRefusal(tailer, target);
    if (why) return why;
    if (isDeadForGm(target)) return "that cannot be done now";
    if (getClock()?.phase === "investigation") return "that cannot be done now";
    return null;
}

/**
 * Begin a tail on the primary GM (the run of `tail.start`): `total` and `isCritical` the effect roll's, `unseenTotal` and
 * `unseenCritical` the Shadow roll's, each the GMs' record of it. Answers `{ refused }` or `{ seen }`.
 */
export async function startTail({ tailer, target, total = 0, isCritical = false, unseenTotal = 0, unseenCritical = false, userId = null }) {
    const why = await tailRefusal(tailer, target);
    if (why) return { refused: why };
    await tailStore.whenHydrated();
    const seen = !(unseenCritical || (Number(unseenTotal) || 0) >= INFILTRATE.tail.unseen.threshold);
    await tailStore.patch(tailer.id, { tailerId: tailer.id, targetId: target.id, total: Number(total) || 0,
        critical: Boolean(isCritical), day: tailDay(), at: Date.now(), userId });
    if (seen) await whisperToOwnerOnly(target, `<p>${esc(game.i18n.format("DRPG.Infiltrate.tail.noticed", { name: tailer.name }))}</p>`);
    log(`${tailer.name} tails ${target.name} (effect ${Number(total) || 0}${isCritical ? ", critical" : ""}; ${seen ? "noticed" : "unseen"}).`);
    return { seen };
}

/** End the tail of `tailerId`: with a card of `why` ("lost", "day", "body", "dash") to the tailer's owners, or silently. */
export async function endTail(tailerId, why = null) {
    const row = tailStore.get(tailerId);
    if (!row) return false;
    await tailStore.drop(tailerId);
    const tailer = game.actors.get(tailerId);
    const target = game.actors.get(row.targetId ?? "");
    if (why && tailer && target) {
        await whisperToOwnerOnly(tailer, `<p>${esc(game.i18n.format(`DRPG.Infiltrate.tail.end.${why}`, { name: target.name }))}</p>`);
    }
    log(`A tail of ${tailer?.name ?? tailerId} ended${why ? ` (${why})` : " silently"}.`);
    return true;
}

/** Whether a tail must end with no card: either side dead as the GMs hold them, or an incident running. */
async function endsSilently(tailer, target) {
    if (!tailer || !target || isDeadForGm(tailer) || isDeadForGm(target)) return true;
    const { murderState } = await import("./murder.mjs");
    return Boolean(murderState()?.active);
}

/**
 * Who stands in `room` of `scene` as the GMs read it, for a critical tail's card: characters on tokens the GMs have not
 * hidden, in that room, no Monocub or Monokuma, none the GMs hold dead, not `skip`'s.
 */
async function standingIn(scene, room, skip) {
    const { roomOfToken } = await import("./movement.mjs");
    const names = [];
    for (const token of scene?.tokens ?? []) {
        const actor = token.actor;
        if (!actor || actor.type !== "character" || token.hidden || skip.has(actor.id)) continue;
        if (actor.getFlag(MODULE_ID, FLAGS.monocub) || actor.getFlag(MODULE_ID, FLAGS.monokuma) || isDeadForGm(actor)) continue;
        if (roomOfToken(token) !== room || names.includes(actor.name)) continue;
        names.push(actor.name);
    }
    return names;
}

/**
 * A settled crossing (crossing-settle.mjs `CROSSING_SETTLED`), on the primary GM: a card to every tailer of the character
 * who crossed, or the tail's end. Answers how many cards were sent, for the suite.
 */
export async function onTailCrossing(event = {}) {
    if (!isPrimaryGm() || !event.actorId || !event.to) return 0;
    const tails = tailsUnderWay().filter(([, row]) => row.targetId === event.actorId);
    if (!tails.length) return 0;
    const { gmPlaceOf } = await import("./movement.mjs");
    const target = game.actors.get(event.actorId);
    let sent = 0;
    for (const [tailerId, row] of tails) {
        const tailer = game.actors.get(tailerId);
        if (await endsSilently(tailer, target)) { await endTail(tailerId, null); continue; }
        if (row.day !== tailDay()) { await endTail(tailerId, "day"); continue; }
        const here = gmPlaceOf(tailer);
        const there = gmPlaceOf(target);
        if (!here?.room || here.scene?.id !== there?.scene?.id || (here.room !== event.from && here.room !== event.to)) {
            await endTail(tailerId, "lost");
            continue;
        }
        const who = row.critical && !event.eclipse ? await standingIn(there?.scene, event.to, new Set([tailerId, target.id])) : [];
        const text = who.length
            ? game.i18n.format("DRPG.Infiltrate.tail.movedWith", { name: target.name, room: event.to, who: who.join(", ") })
            : game.i18n.format("DRPG.Infiltrate.tail.moved", { name: target.name, room: event.to });
        await whisperToOwnerOnly(tailer, `<p>${esc(text)}</p>`);
        sent++;
    }
    return sent;
}

/** A Dash of `actor` (bridge-runs-acts.mjs `handleDash`): every tail on them below its total is lost, a critical one only to a critical. */
export async function tailsAfterDash(actor, total = 0, isCritical = false) {
    let lost = 0;
    for (const [tailerId, row] of tailsUnderWay()) {
        if (row.targetId !== actor?.id) continue;
        const shaken = row.critical ? Boolean(isCritical) : Boolean(isCritical) || (Number(total) || 0) > (Number(row.total) || 0);
        if (shaken && (await endTail(tailerId, "dash"))) lost++;
    }
    return lost;
}

/** End every tail under way with the card `why` (a body announced, a new day), or silently. Answers how many ended. */
export async function endAllTails(why = null, { onlyBefore = null } = {}) {
    let n = 0;
    for (const [tailerId, row] of tailsUnderWay()) {
        if (onlyBefore && row.day === onlyBefore) continue;
        if (await endTail(tailerId, why)) n++;
    }
    return n;
}

/**
 * The listeners, on every browser, acting on the primary GM alone: a settled crossing, a body announced (before the
 * gather, through `waitUntil`; the suite's rehearsal ignored), and a time of day begun on a new day.
 */
export function registerTails() {
    Hooks.on(CROSSING_SETTLED, event => { onTailCrossing(event).catch(err => error("A tail's card could not be sent", err)); });
    Hooks.on(BODY_ANNOUNCED_HOOK, data => {
        if (!isPrimaryGm() || data?.rehearsal) return;
        const done = endAllTails("body").catch(err => error("The tails could not be ended at a body", err));
        data?.waitUntil?.(done);
    });
    Hooks.on("drpgTimeOfDayChanged", clock => {
        if (!isPrimaryGm()) return;
        endAllTails("day", { onlyBefore: tailDay(clock ?? getClock()) }).catch(err => error("The tails could not be ended with the day", err));
    });
}
