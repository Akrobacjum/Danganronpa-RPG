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
 * HELD TO THE POST, AND A SANITY (E74, 12.11.2026). The primary's Eclipse sighting puts a walk out of the post back
 * (movement.mjs `watchHolds`, code `onWatch`); a watch missed with Despair marks a Sanity (`declareWatch`).
 *
 * THE HINDRANCE DIE (DA44 option A, the owner 12.11.2026 through the coordinator). A watch kept at
 * `INFILTRATE.keepWatch.hindranceAt` (18) or more, or on a critical, and running (its post taken at the Eclipse's start),
 * puts one hindrance die on the opening roll of the one who opens a murder on the watcher (`openingHindrance`). The primary reads it
 * twice: when it asks the killer's browser to throw (murder-rules.mjs `rollOpening`, whose invitation carries
 * `hindrance: 1` and nothing else of it) and when it draws that roll (roll-draw.mjs `situationReading`, the `situation`
 * row of the GMs' list), so the killer's window throws the die the GM expects and calls it "a hindrance die", never why.
 * The watch, its post and its total stay the GMs'. For a murder declared in the dark the die is read while the watch
 * stands and kept with the incident (`holdForTheLights`, STG-01, 1.2.120).
 */

import { MODULE_ID, FLAGS, INFILTRATE } from "./config.mjs";
import { getClock, incomingTimeOfDay, isEclipse, isDeadForGm } from "./settings.mjs";
import { isPrimaryGm, whisperToOwnerOnly, log, error, esc, listOf } from "./utils.mjs";
import { watchStore } from "./gm-stores.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";

/**
 * The hindrance dice an opening roll of `side` takes from the victim's watch, as this GM holds the watches: 1 on the
 * killer's side when the victim keeps a running watch of `hindranceAt` or more (or a critical), else 0. Pure but for the
 * store's read; asked by `rollOpening` and by the GM's draw.
 */
export function openingHindrance(side, state) {
    if (side !== "killer" || !state?.victimId) return 0;
    // Fixed at the lights for a murder declared in the dark (`heldAtTheLights`, STG-01): the watch is gone by then.
    if (Number.isInteger(state.watchDie)) return state.watchDie;
    const row = watchStore.get(state.victimId);
    if (!row?.post) return 0;
    return row.critical || (Number(row.total) || 0) >= INFILTRATE.keepWatch.hindranceAt ? 1 : 0;
}

/**
 * THE DIE KEPT FOR THE LIGHTS (1.2.120 line K, 21.11.2026; the audit's STG-01). A watch has its post from the Eclipse's
 * start and is dropped at its end (`endWatches`, on the hook the clock's write fires), and a murder declared in that
 * Eclipse opens only after the clock has moved (eclipse.mjs `endEclipse`, `judgePendingMurders`), its killer's roll
 * drawn later still, at the press - so `openingHindrance` read a watch already gone, and the die the notes promise was
 * never thrown. Red at e515907d (tier 2 "1.2.120 STG-01"): the invitation's die 0, the GM's draw 0. Now `endEclipse`
 * reads every watcher's die while the posts still stand, before the clock moves (`holdForTheLights`, as it takes the
 * betrayals' offers there for the same reason), `openMurder` writes the die of the victim it opens on into the incident
 * (`watchDie`, the GMs' alone: in no player's copy), and `openingHindrance` reads that. Lifted when the lights have
 * judged (`releaseTheLights`). An incident opened at no lights holds `watchDie` null and reads the running watch, as
 * before. Held on this browser only, for the one `endEclipse` that judges on it.
 */
let lightsDice = null;

/** Each watcher's die while the watches stand, `{ [actorId]: 0 | 1 }`, kept until `releaseTheLights`. Answers it. */
export async function holdForTheLights() {
    await watchStore.whenHydrated();
    lightsDice = Object.fromEntries(watches().map(([actorId]) => [actorId, openingHindrance("killer", { victimId: actorId })]));
    return lightsDice;
}

/** The die kept at the lights for a murder opened on `victimId`: 0 or 1 while the lights judge, null at any other time. */
export function heldAtTheLights(victimId) {
    return lightsDice ? (lightsDice[victimId] ?? 0) : null;
}

/** The lights have judged: nothing is kept any more. */
export function releaseTheLights() {
    lightsDice = null;
}

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
export async function declareWatch({ actor, total = 0, isCritical = false, withHope = true, userId = null }) {
    const why = await watchRefusal(actor);
    if (why) return { refused: why };
    await watchStore.whenHydrated();
    const kept = Boolean(isCritical) || (Number(total) || 0) >= INFILTRATE.keepWatch.dc;
    if (kept) {
        await watchStore.patch(actor.id, { actorId: actor.id, total: Number(total) || 0, critical: Boolean(isCritical), post: null,
            entered: 0, left: 0, at: Date.now(), userId });
    }
    // A miss with Despair costs a Sanity mark (the plan's C6): written by this GM, its reason the GM's alone.
    if (!kept && !withHope) {
        const { trustedWrite } = await import("./resource-guard.mjs");
        const stress = actor.system?.resources?.stress ?? {};
        const next = Math.min(Number(stress.max) || 0, (Number(stress.value) || 0) + 1);
        if (next !== Number(stress.value)) await trustedWrite(actor, { "system.resources.stress.value": next }, { reason: "infiltrate" });
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
            ? game.i18n.format("DRPG.Infiltrate.watch.start", { room: place.room, who: listOf(who) })
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
            // The watch's result at the Eclipse's end: E49's card (the coordinator's rule of 12.11.2026); the start and the
            // live sightings stay lines, running reports.
            await whisperToOwnerOnly(watcher, { glyph: "ACTIONS.listen", body: `<p>${esc(game.i18n.format("DRPG.Infiltrate.watch.summary",
                { room: row.post, entered: Number(row.entered) || 0, left: Number(row.left) || 0 }))}</p>` });
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
