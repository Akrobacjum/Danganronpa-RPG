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
 * PICK THE LOCK (E74 C4; DA9, DA29, DA30, DA31 = 2). At a door to a neighbouring room held by a lock (a GM's or a bedroom's)
 * or a seal, never a barricade: Hand at `INFILTRATE.pick.dc` (15) opens it, a critical too, and the picker holds a pass to
 * that room until they leave it (lockpick-gm.mjs; DA9 as the plan has it, the owner's "Wole zgodnie z planem" of
 * 12.11.2026, which replaced the walk-through at once this file did before). The lock stays locked for everyone else. The owner of a bedroom is warned on an open below `clean` (18) and on a miss with Despair
 * (DA30); the Shadow cover below its threshold (16) lets the two rooms see who it was.
 *
 * BUILT SINCE (E74, 12.11.2026): the "Someone tries to get in" card to a barricade's author (`knockDoor`), the doors'
 * Remnants (`leaveDoorTrace`, `pickTrace`), Repair the Lock (below), Keep Watch (watch-gm.mjs).
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
    await leaveDoorTrace(actor, "subtle", "shut", place.room);
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
    // Every attempt leaves a Remnant: evident where it was heard (a pass, a miss with Despair), subtle otherwise.
    if (held.length) await leaveDoorTrace(actor, forced || !withHope ? "evident" : "subtle", "force", room);
    const owner = roomFlag(place.scene, room, ROOM_OWNER_FLAG);
    if (forced && holds.lock && owner && owner !== actor.id && game.actors.get(owner)) {
        const { whisperToOwnerOnly, esc } = await import("./utils.mjs");
        await whisperToOwnerOnly(game.actors.get(owner), `<p>${esc(game.i18n.format("DRPG.Infiltrate.force.yourDoor", { room }))}</p>`);
    }
    log(`${actor.name} ${forced ? "forced" : "failed to force"} the door to ${room} (${sum}; held by ${held.join(", ") || "nothing"}).`);
    return { forced, held, heard };
}

/**
 * Pick a lock on the primary GM (the run of `door.pick`): `room` the room beyond; `total`, `isCritical`, `withHope` the Hand
 * roll's and `coverTotal`, `coverCritical` the Shadow's, each the GMs' record. Answers `{ refused }` or `{ opened, held }`.
 */
export async function pickLock({ actor, room, total = 0, isCritical = false, withHope = true, coverTotal = 0, coverCritical = false, tell = true }) {
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
    const rule = INFILTRATE.pick;
    const sum = Number(total) || 0;
    const lockish = held.length > 0 && !held.includes("barricade");
    const opened = lockish && (isCritical || sum >= rule.dc);
    // An open is a pass for the picker alone, kept until they leave the room (DA9 as the plan has it; lockpick-gm.mjs).
    if (opened) {
        const { grantPass } = await import("./lockpick-gm.mjs");
        await grantPass(actor, place.scene, room);
    }
    const seen = !(coverCritical || (Number(coverTotal) || 0) >= rule.cover.threshold);
    // `tell` false: a Reroll's replay (infiltrate-reroll.mjs), whose cover the two rooms were told of by the first throw.
    if (tell && seen && lockish) {
        await tellRooms(place.scene, [place.room, room], game.i18n.format("DRPG.Infiltrate.pick.seenBy", { name: actor.name, room }), new Set([actor.id]));
    }
    // Every attempt at a lock leaves a Remnant by its band (DA30); a Reroll's replay leaves none of its own.
    if (tell && lockish) await leaveDoorTrace(actor, pickTrace({ opened, total: sum, isCritical, withHope }), "pick", room);
    const owner = roomFlag(place.scene, room, ROOM_OWNER_FLAG);
    const careless = lockish && ((opened && !isCritical && sum < rule.clean) || (!opened && !withHope));
    if (careless && owner && owner !== actor.id && game.actors.get(owner)) {
        const { whisperToOwnerOnly, esc } = await import("./utils.mjs");
        await whisperToOwnerOnly(game.actors.get(owner), `<p>${esc(game.i18n.format("DRPG.Infiltrate.pick.warned", { room }))}</p>`);
    }
    log(`${actor.name} ${opened ? "picked" : "failed to pick"} the lock of ${room} (${sum}; held by ${held.join(", ") || "nothing"}).`);
    return { opened, held };
}

/* ----------------------------------------------------------------------------------------------------------------- *
 * REPAIR THE LOCK (E74 C5; DA28, Q-E74-1's default: a row of passages-gm.mjs `PASSAGE_PRESETS`, its completion projects.mjs
 * `COMPLETION_EFFECTS`' "repairsLock"). A project at Trivial on a lock Force the Door or a breach broke, offered in Start New
 * only where a door of the builder's room has one (the room itself or a neighbour), once a door: a lock a project repairs
 * already is refused. Judged at the approval and again at the completion, as the owner's three of 15.10 are. Finished, the
 * lock holds again for everyone and the room's owner is told; taken back (a Reroll), it is broken again. A GM's repair by hand
 * in Room Setup's Broken column removes the project with a note to the GMs (`dropLockRepairs`).
 * ----------------------------------------------------------------------------------------------------------------- */

/** The projects that repair the lock of `room` on the scene `sceneId`, as the GMs hold them (their secret half's `target`). */
async function lockRepairsOf(sceneId, room) {
    const { allProjects } = await import("./projects.mjs");
    const { secretsOf } = await import("./projects-secrecy.mjs");
    return allProjects().filter(p => {
        const target = secretsOf(p.id)?.target ?? null;
        // A finished one kept for its Reroll (the row's `keep`) repairs nothing more.
        return target?.preset === "repairLock" && target.sceneId === sceneId && target.lockRoom === room && p.current < p.start;
    });
}

/**
 * Why the lock of `room` on `scene` may not be repaired by a project of a builder standing in `from`, or null. English, said
 * through passages-gm.mjs `whyText`. `ignore` a project id not counted (the completion's own).
 */
export async function repairLockRefusal({ scene, room, from, ignore = null }) {
    const M = await import("./movement.mjs");
    if (!scene || !room || !M.roomBroken(scene, room)) return "that lock is not broken.";
    if (from !== room && !M.neighbouringRooms(scene, from).includes(room)) return "that lock is on no door of the builder's room.";
    if ((await lockRepairsOf(scene.id, room)).some(p => p.id !== ignore)) return "a project repairs that lock already.";
    return null;
}

/** A finished Repair the Lock (the row "repairsLock"): the lock holds again, its owner told. Answers `{ refused }` or `{ mended }`. */
export async function repairLockDone(projectId, { sceneId = null, lockRoom = null } = {}) {
    const M = await import("./movement.mjs");
    const scene = game.scenes.get(sceneId ?? "");
    if (!scene || !lockRoom || !M.roomBroken(scene, lockRoom)) return { refused: "that lock is not broken." };
    await M.setRoomBroken(scene, lockRoom, false);
    const owner = game.actors.get(roomFlag(scene, lockRoom, ROOM_OWNER_FLAG) ?? "");
    if (owner) {
        const { whisperToOwnerOnly, esc } = await import("./utils.mjs");
        await whisperToOwnerOnly(owner, `<p>${esc(game.i18n.format("DRPG.Infiltrate.repair.mended", { room: lockRoom }))}</p>`);
    }
    log(`The lock of ${lockRoom} is repaired (project ${projectId}).`);
    return { mended: true };
}

/** A Repair the Lock's completion taken back: the lock broken again. */
export async function unrepairLock({ sceneId = null, lockRoom = null } = {}) {
    const M = await import("./movement.mjs");
    const scene = game.scenes.get(sceneId ?? "");
    if (!scene || !lockRoom) return false;
    await M.setRoomBroken(scene, lockRoom, true);
    return true;
}

/** A GM mended the lock by hand (Room Setup's Broken column): every project repairing it removed, the GMs told. Answers how many. */
export async function dropLockRepairs(scene, room) {
    if (!game.user?.isGM || !scene || !room) return 0;
    const { deleteProject } = await import("./projects.mjs");
    const { whisperToGms, esc } = await import("./utils.mjs");
    let n = 0;
    for (const project of await lockRepairsOf(scene.id, room)) {
        if (await deleteProject(project.id)) {
            n++;
            await whisperToGms(`<p>${esc(game.i18n.format("DRPG.Infiltrate.repair.dropped", { name: project.name, room }))}</p>`);
        }
    }
    return n;
}

/** When each barricade's author was last told of somebody at the door, by key: one card a quarter minute. */
const knocked = new Map();
const KNOCK_MS = 15000;

/**
 * SOMEONE TRIES TO GET IN (E74; the plan's C2 card). A walk in through a door refused at a barricade, on the walker's own
 * browser by the veto, which asks this of the primary (bridge `door.knock`): the barricade's author's owners are told that
 * somebody tries the door - no name. Judged here: the room barricaded as the GMs hold it, next to the room the GMs read the
 * walker in; one card a barricade a quarter minute. Answers `{ refused }` or `{ told }`.
 */
export async function knockDoor({ actor, room }) {
    const M = await import("./movement.mjs");
    const place = M.gmPlaceOf(actor);
    if (!place?.room) return { refused: "the character is not standing in any room" };
    const key = barricadeKey(place.scene.id, room ?? "");
    const row = barricadeStore.get(key);
    if (!row || room === place.room || !M.neighbouringRooms(place.scene, place.room).includes(room)) return { refused: "the character is not in that room" };
    const now = Date.now();
    if (now - (knocked.get(key) ?? 0) < KNOCK_MS) return { told: false };
    knocked.set(key, now);
    const author = game.actors.get(row.authorId ?? "");
    if (!author || author.id === actor.id) return { told: false };
    const { whisperToOwnerOnly, esc } = await import("./utils.mjs");
    await whisperToOwnerOnly(author, `<p>${esc(game.i18n.localize("DRPG.Infiltrate.shut.knock"))}</p>`);
    return { told: true };
}

/**
 * A door's Remnant (E74; DA30): left where the character stands, of the module's neutral kind, at `visibility` - a
 * barricade's faint and subtle, a force's evident, a pick's by its band (`pickTrace`). Never stops the action: a Remnant that
 * could not be placed is logged.
 */
async function leaveDoorTrace(actor, visibility, key, room) {
    try {
        const { dropRemnant } = await import("./remnants.mjs");
        await dropRemnant(actor, { type: "neutral", visibility, faint: visibility === "subtle" && key === "shut",
            note: game.i18n.format(`DRPG.Infiltrate.trace.${key}`, { room }), action: "infiltrate" });
    } catch (err) {
        log(`A door's Remnant could not be placed: ${err?.message ?? err}`);
    }
}

/** A pick's Remnant by its band (DA30): a miss with Despair evident, a miss with Hope or an open below `clean` subtle, `clean` and up hidden. */
export function pickTrace({ opened, total, isCritical, withHope }) {
    if (!opened) return withHope ? "subtle" : "evident";
    return isCritical || total >= INFILTRATE.pick.clean ? "hidden" : "subtle";
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

