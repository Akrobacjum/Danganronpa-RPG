/**
 * Danganronpa RPG - the doors of the Infiltrate tile, the GMs' half: Shut the Door's barricade.
 * ---------------------------------------------------------------------------
 * E74 C2 (12.11.2026; the owner's audit entry E74, DA25, DA47; the plan's C1 and C2, read on origin/claude/plan-130
 * docs/dev/plans/E74.md). On the primary GM: a barricade is begun by the bridge road `door.shut` (bridge-runs-acts.mjs
 * `handleDoorShut`, the Body roll read off the GMs' record of it), kept in the GMs' store `barricades` (gm-stores.mjs
 * `barricadeStore`: its strength, the total, and its author) and shown to the table by one public flag with neither
 * (movement.mjs `setRoomBarricaded`, DA47). The move veto and the GMs' audit refuse a walk in through a door while it
 * stands (movement.mjs `barricadedFrom`); a passage, a breach or a tunnel goes through (A10).
 *
 * WHERE ONE MAY BE PUT UP (DA25 = 1). In the room the character stands in as the GMs read it, a room with at most
 * `INFILTRATE.shut.maxExits` doors that open (the neighbours a GM's lock does not shut), the character's own bedroom but
 * not another's, never a room with a body the character's player knows of and nobody has found (a neutral refusal), one
 * barricade a room.
 *
 * WHEN IT COMES DOWN. Its author's settled crossing out of the room (crossing-settle.mjs `CROSSING_SETTLED`), the time of
 * day's end and an Eclipse's start (`drpgTimeOfDayChanged`, `drpgEclipseChanged`): the row dropped and the flag taken off.
 *
 * FORCE THE DOOR (E74 C3; DA9, DA29, DA31 = 2, DA43 = 1, DA52). From the room the character stands in, at a door to a
 * neighbouring room: one Body roll against everything that holds that door at once - a barricade by its strength (the
 * roll must pass it; a tie holds), a GM's lock or a bedroom shut to the character and a seal at `INFILTRATE.force.lockDc`
 * (18; a critical passes all). Passed: the barricade comes down, a lock is broken until repaired (movement.mjs
 * `setRoomBroken`, the flag a breach writes), a seal is lifted for the rest of its time of day (call-world.mjs
 * `liftSeal`, no Despair back). Never in a Class Trial, never into the trial hall, never by a Chained character. On a
 * pass and on a miss with Despair (DA30), the students in the rooms next to either room hear "A banging from: {room}", no name
 * (DA43 = 1), and those in the two rooms are told who forced which door; a bedroom's owner is told their door was
 * forced, wherever they are.
 *
 * NOT BUILT IN THIS ROUND (docs/dev/e74/STATUS.md): the "Someone tries to get in" card to a barricade's author, the
 * Remnants (a barricade's neutral one, Force's Evident one), Pick the Lock, Repair the Lock, Keep Watch.
 */

import { MODULE_ID, FLAGS, INFILTRATE, ROOM_OWNER_FLAG } from "./config.mjs";
import { isDeceased, isDeadForGm } from "./settings.mjs";
import { isPrimaryGm, log, error } from "./utils.mjs";
import { barricadeStore } from "./gm-stores.mjs";
import { CROSSING_SETTLED } from "./crossing-settle.mjs";
import { roomFlag } from "./rooms.mjs";

/** A barricade's key in the GMs' store: the scene and the room. */
export const barricadeKey = (sceneId, room) => `${sceneId}:${room}`;

/** The doors out of `room` that open: its neighbours a GM's lock does not shut (A10: "count only open exits"). */
export async function openExits(scene, room) {
    const M = await import("./movement.mjs");
    return M.neighbouringRooms(scene, room).filter(other => !M.isLocked(scene, other));
}

/** Whether a body lies in `room` of `scene` that `user` knows of and the table has not found (a death not published). */
async function knownUnfoundBodyIn(scene, room, user) {
    const { knownDeath } = await import("./frisk.mjs");
    const { bodyPlaceOf } = await import("./body-tile.mjs");
    return (game.actors?.contents ?? [...(game.actors ?? [])]).some(actor => {
        if (actor.type !== "character" || isDeceased(actor) || !isDeadForGm(actor) || !knownDeath(user, actor)) return false;
        const place = bodyPlaceOf(actor);
        return place?.scene?.id === scene.id && place.room === room;
    });
}

/**
 * Why `actor` may not barricade the room they stand in, as the GMs read it, or null; with the place. English: the bridge
 * maps it to a code.
 */
export async function shutRefusal(actor, user) {
    const { gmPlaceOf } = await import("./movement.mjs");
    const { isEclipse } = await import("./settings.mjs");
    const place = gmPlaceOf(actor);
    if (!place?.room) return { why: "the character is not standing in any room" };
    if (isDeadForGm(actor)) return { why: "that cannot be done now" };
    if (isEclipse()) return { why: "an Eclipse is running" };
    const owner = roomFlag(place.scene, place.room, ROOM_OWNER_FLAG);
    if (owner && owner !== actor.id) return { why: "that cannot be done now" };
    if ((await openExits(place.scene, place.room)).length > INFILTRATE.shut.maxExits) return { why: "that room has too many doors to hold" };
    if (await knownUnfoundBodyIn(place.scene, place.room, user)) return { why: "that cannot be done now" };
    const row = barricadeStore.get(barricadeKey(place.scene.id, place.room));
    if (row && row.authorId !== actor.id) return { why: "that cannot be done now" };
    return { why: null, place };
}

/**
 * Put a barricade up on the primary GM (the run of `door.shut`): `total` the Body roll's off the GMs' record of it, its
 * strength. Answers `{ refused }` or `{ room, strength }`.
 */
export async function shutDoor({ actor, total = 0, user = null }) {
    await barricadeStore.whenHydrated();
    const { why, place } = await shutRefusal(actor, user);
    if (why) return { refused: why };
    const { setRoomBarricaded } = await import("./movement.mjs");
    const strength = Number(total) || 0;
    await barricadeStore.patch(barricadeKey(place.scene.id, place.room), { sceneId: place.scene.id, room: place.room,
        authorId: actor.id, strength, at: Date.now(), userId: user?.id ?? null });
    await setRoomBarricaded(place.scene, place.room, true);
    log(`${actor.name} barricaded ${place.room} (strength ${strength}).`);
    return { room: place.room, strength };
}

/** What holds the door from the character's room into `room` on `scene`, as the GMs read it: `{ barricade, lock, seal }`. */
async function whatHolds(actor, scene, room) {
    const M = await import("./movement.mjs");
    const { isSealed } = await import("./call-world.mjs");
    const row = barricadeStore.get(barricadeKey(scene.id, room));
    return { barricade: row ? Number(row.strength) || 0 : null, lock: M.isLocked(scene, room) || M.bedroomShut(actor, scene, room),
        seal: isSealed(room) };
}

/** Whisper `text` to the owners of every living student standing in one of `rooms` on `scene` but `skip`'s. */
async function tellRooms(scene, rooms, text, skip = new Set()) {
    const { roomOfToken } = await import("./movement.mjs");
    const { whisperToOwnerOnly, esc } = await import("./utils.mjs");
    const told = new Set();
    for (const token of scene?.tokens ?? []) {
        const student = token.actor;
        if (!student || student.type !== "character" || token.hidden || skip.has(student.id) || told.has(student.id)) continue;
        if (student.getFlag(MODULE_ID, FLAGS.monokuma) || isDeadForGm(student) || !rooms.includes(roomOfToken(token))) continue;
        told.add(student.id);
        await whisperToOwnerOnly(student, `<p>${esc(text)}</p>`);
    }
    return told.size;
}

/**
 * Force a door on the primary GM (the run of `door.force`): `room` the room beyond, `total`, `isCritical` and `withHope`
 * the Body roll's off the GMs' record. Answers `{ refused }` or `{ forced, held: [what held it], heard }`.
 */
export async function forceDoor({ actor, room, total = 0, isCritical = false, withHope = true }) {
    const M = await import("./movement.mjs");
    const { getClock } = await import("./settings.mjs");
    const { isChained } = await import("./call-world.mjs");
    const place = M.gmPlaceOf(actor);
    if (!place?.room) return { refused: "the character is not standing in any room" };
    if (isDeadForGm(actor)) return { refused: "that cannot be done now" };
    if (getClock()?.phase === "classTrial") return { refused: "that waits until the Class Trial is over" };
    if (isChained(actor)) return { refused: "that cannot be done now" };
    if (!room || room === place.room || !M.neighbouringRooms(place.scene, place.room).includes(room)) return { refused: "the character is not in that room" };
    await barricadeStore.whenHydrated();
    const holds = await whatHolds(actor, place.scene, room);
    const held = Object.entries(holds).filter(([, v]) => v !== null && v !== false).map(([k]) => k);
    const sum = Number(total) || 0;
    const passes = what => isCritical || (what === "barricade" ? sum > holds.barricade : sum >= INFILTRATE.force.lockDc);
    const forced = held.length > 0 && held.every(passes);
    if (forced) {
        if (holds.barricade !== null) await endBarricade(barricadeKey(place.scene.id, room));
        if (holds.lock) await M.setRoomBroken(place.scene, room, true);
        if (holds.seal) await (await import("./call-world.mjs")).liftSeal(room);
    }
    let heard = 0;
    if (forced || !withHope) {
        const near = [...new Set([...M.neighbouringRooms(place.scene, place.room), ...M.neighbouringRooms(place.scene, room)])]
            .filter(r => r !== place.room && r !== room);
        heard = await tellRooms(place.scene, near, game.i18n.format("DRPG.Infiltrate.force.banging", { room }), new Set([actor.id]));
        await tellRooms(place.scene, [place.room, room], game.i18n.format(forced ? "DRPG.Infiltrate.force.forcedBy" : "DRPG.Infiltrate.force.triedBy",
            { name: actor.name, room }), new Set([actor.id]));
    }
    const owner = roomFlag(place.scene, room, ROOM_OWNER_FLAG);
    if (forced && holds.lock && owner && owner !== actor.id && game.actors.get(owner)) {
        const { whisperToOwnerOnly, esc } = await import("./utils.mjs");
        await whisperToOwnerOnly(game.actors.get(owner), `<p>${esc(game.i18n.format("DRPG.Infiltrate.force.yourDoor", { room }))}</p>`);
    }
    log(`${actor.name} ${forced ? "forced" : "failed to force"} the door to ${room} (${sum}; held by ${held.join(", ") || "nothing"}).`);
    return { forced, held, heard };
}

/** Take a barricade down: the row dropped and the public flag taken off. Answers whether there was one. */
export async function endBarricade(key) {
    const row = barricadeStore.get(key);
    if (!row) return false;
    await barricadeStore.drop(key);
    const scene = game.scenes.get(row.sceneId ?? "");
    if (scene) {
        const { setRoomBarricaded } = await import("./movement.mjs");
        await setRoomBarricaded(scene, row.room, false);
    }
    log(`The barricade of ${row.room} came down.`);
    return true;
}

/** Every barricade down (the time of day's end, an Eclipse's start). Answers how many. */
export async function endAllBarricades() {
    let n = 0;
    for (const key of Object.keys(barricadeStore.entries() ?? {})) if (await endBarricade(key)) n++;
    return n;
}

/** A settled crossing (crossing-settle.mjs): a barricade whose author left its room comes down. Answers how many. */
export async function onDoorCrossing(event = {}) {
    if (!isPrimaryGm() || !event.actorId) return 0;
    let n = 0;
    for (const [key, row] of Object.entries(barricadeStore.entries() ?? {})) {
        if (row?.authorId === event.actorId && row.room === event.from && event.to !== row.room && (await endBarricade(key))) n++;
    }
    return n;
}

/** The listeners, on every browser, acting on the primary GM alone. */
export function registerDoors() {
    Hooks.on(CROSSING_SETTLED, event => { onDoorCrossing(event).catch(err => error("A barricade could not be taken down", err)); });
    const down = () => { if (isPrimaryGm()) endAllBarricades().catch(err => error("The barricades could not be taken down", err)); };
    Hooks.on("drpgTimeOfDayChanged", down);
    Hooks.on("drpgEclipseChanged", active => { if (active === true) down(); });
}

