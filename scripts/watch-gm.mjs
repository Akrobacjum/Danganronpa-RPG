/**
 * Danganronpa RPG - Keep Watch, the GMs' half.
 * ---------------------------------------------------------------------------
 * E74 C6 (12.11.2026; the owner's audit entry E74, DA34; the plan's C6, read on origin/claude/plan-130
 * docs/dev/plans/E74.md). A watch is declared before an Eclipse by the bridge road `watch.declare` (bridge-runs-acts.mjs
 * `handleWatchDeclare`, the Body roll read off the GMs' record of it) and kept in the GMs' store `watches` (gm-stores.mjs
 * `watchStore`, a row per watcher). On the primary GM:
 *
 *   - at the Eclipse's start (`drpgEclipseChanged` true) the post is the room the watcher stands in as the GMs read it, and
 *     the watcher's owners are told who is in it, by name;
 *   - while the Eclipse runs, every settled crossing into or out of the post (crossing-settle.mjs `CROSSING_SETTLED`) is a
 *     card - who entered, who left, never which way (A10);
 *   - at the Eclipse's end (`drpgEclipseChanged` false) a summary - how many entered and left - and the watch is over.
 *
 * WHEN ONE MAY BE KEPT. Not during an Eclipse (it is declared before one), not before the Night Eclipse (Q-E74-2's default:
 * struck through in Night, as the audit says), not by a character the GMs hold dead, one a watcher. A roll below
 * `INFILTRATE.keepWatch.dc` keeps no watch (a default taken; docs/dev/e74/STATUS.md).
 *
 * NOT BUILT IN THIS ROUND (docs/dev/e74/STATUS.md): the watcher held to the post during the Eclipse (`judgeEclipseCrossing`),
 * a Sanity mark for a miss with Despair, the hindrance die an 18+ watch adds to an opening roll (DA44: `LEGAL_ROLL_MODIFIERS`,
 * `expectedFor`, `rollOpening`).
 */

import { MODULE_ID, FLAGS, INFILTRATE } from "./config.mjs";
import { getClock, incomingTimeOfDay, isEclipse, isDeadForGm } from "./settings.mjs";
import { isPrimaryGm, whisperToOwnerOnly, log, error, esc } from "./utils.mjs";
import { watchStore } from "./gm-stores.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";

/** Why `actor` may not keep watch now, as the GMs read it, or null. English: the bridge maps it to a code. */
export async function watchRefusal(actor) {
    const { gmPlaceOf } = await import("./movement.mjs");
    if (!gmPlaceOf(actor)?.room) return "the character is not standing in any room";
    if (isDeadForGm(actor)) return "that cannot be done now";
    if (isEclipse()) return "an Eclipse is running";
    if (incomingTimeOfDay(getClock()) === "night") return "that cannot be done now";
    return null;
}

/** Declare a watch on the primary GM (the run of `watch.declare`). Answers `{ refused }` or `{ kept }`. */
export async function declareWatch({ actor, total = 0, isCritical = false, userId = null }) {
    const why = await watchRefusal(actor);
    if (why) return { refused: why };
    await watchStore.whenHydrated();
    const kept = Boolean(isCritical) || (Number(total) || 0) >= INFILTRATE.keepWatch.dc;
    if (kept) {
        await watchStore.patch(actor.id, { actorId: actor.id, total: Number(total) || 0, critical: Boolean(isCritical), post: null,
            entered: 0, left: 0, at: Date.now(), userId });
    }
    log(`${actor.name} ${kept ? "will keep watch" : "keeps no watch"} (${Number(total) || 0}).`);
    return { kept };
}

/** Every watch, `[actorId, row]`. */
const watches = () => Object.entries(watchStore.entries() ?? {}).filter(([, row]) => row?.actorId);

/** The living students standing in `room` of `scene` as the GMs read them, by name, but `skip`'s. */
async function namesIn(scene, room, skip) {
    const { roomOfToken } = await import("./movement.mjs");
    const names = [];
    for (const token of scene?.tokens ?? []) {
        const student = token.actor;
        if (!student || student.type !== "character" || token.hidden || skip.has(student.id)) continue;
        if (student.getFlag(MODULE_ID, FLAGS.monokuma) || isDeadForGm(student) || roomOfToken(token) !== room) continue;
        if (!names.includes(student.name)) names.push(student.name);
    }
    return names;
}

/** The Eclipse begins: each watch takes its post and its watcher is told who is there. Answers how many posts were taken. */
export async function startWatches() {
    if (!isPrimaryGm()) return 0;
    const { gmPlaceOf } = await import("./movement.mjs");
    let n = 0;
    for (const [actorId] of watches()) {
        const watcher = game.actors.get(actorId);
        const place = watcher ? gmPlaceOf(watcher) : null;
        if (!watcher || isDeadForGm(watcher) || !place?.room) { await watchStore.drop(actorId); continue; }
        await watchStore.patch(actorId, { post: place.room, sceneId: place.scene.id });
        const who = await namesIn(place.scene, place.room, new Set([actorId]));
        await whisperToOwnerOnly(watcher, `<p>${esc(who.length
            ? game.i18n.format("DRPG.Infiltrate.watch.start", { room: place.room, who: who.join(", ") })
            : game.i18n.format("DRPG.Infiltrate.watch.startEmpty", { room: place.room }))}</p>`);
        n++;
    }
    return n;
}

/**
 * A settled crossing during the Eclipse: a card to every watcher whose post it entered or left. Answers how many cards.
 * `running` is whether an Eclipse runs (the clock's, unless the suite hands it in: tier 2's E74-T4 starts no real Eclipse).
 */
export async function onWatchCrossing(event = {}, { running = isEclipse() } = {}) {
    if (!isPrimaryGm() || !event.actorId || !running) return 0;
    const mover = game.actors.get(event.actorId);
    if (!mover) return 0;
    let sent = 0;
    for (const [actorId, row] of watches()) {
        if (!row.post || actorId === event.actorId) continue;
        const key = event.to === row.post ? "entered" : event.from === row.post ? "left" : null;
        if (!key) continue;
        const watcher = game.actors.get(actorId);
        if (!watcher || isDeadForGm(watcher)) continue;
        await watchStore.patch(actorId, { [key]: (Number(row[key]) || 0) + 1 });
        await whisperToOwnerOnly(watcher, `<p>${esc(game.i18n.format(`DRPG.Infiltrate.watch.${key}`, { name: mover.name, room: row.post }))}</p>`);
        sent++;
    }
    return sent;
}

/** The Eclipse ends: a summary to each watcher whose post was taken, and every watch is over. Answers how many summaries. */
export async function endWatches() {
    if (!isPrimaryGm()) return 0;
    let n = 0;
    for (const [actorId, row] of watches()) {
        const watcher = game.actors.get(actorId);
        if (row.post && watcher && !isDeadForGm(watcher)) {
            await whisperToOwnerOnly(watcher, `<p>${esc(game.i18n.format("DRPG.Infiltrate.watch.summary",
                { room: row.post, entered: Number(row.entered) || 0, left: Number(row.left) || 0 }))}</p>`);
            n++;
        }
        await watchStore.drop(actorId);
    }
    return n;
}

/** The listeners, on every browser, acting on the primary GM alone. */
export function registerWatches() {
    Hooks.on(CROSSING_SETTLED, event => { onWatchCrossing(event).catch(err => error("A watch's card could not be sent", err)); });
    Hooks.on("drpgEclipseChanged", active => {
        (active === true ? startWatches() : endWatches()).catch(err => error("The watches could not be started or ended", err));
    });
}
