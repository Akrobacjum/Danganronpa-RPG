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
 * (DA43 = 1), and those in the two rooms are told who forced which door; on a miss with Hope only the character's own room
 * is told who tried (the owner's rule #8, 13.11.2026). A bedroom's owner who did not see it is told their door was forced on
 * walking back into it, or at once in it (the owner's rule #1, 13.11.2026; `noteBedroom`, below).
 *
 * PICK THE LOCK (E74 C4; DA9, DA29, DA30, DA31 = 2). At a door to a neighbouring room held by a lock (a GM's or a bedroom's)
 * or a seal, never a barricade: Hand at `INFILTRATE.pick.dc` (15) opens it, a critical too, and the picker holds a pass to
 * that room until they leave it (lockpick-gm.mjs; DA9 as the plan has it, the owner's "Wole zgodnie z planem" of
 * 12.11.2026, which replaced the walk-through at once this file did before). The lock stays locked for everyone else. The owner of a bedroom is warned on an open below `clean` (18) and on a miss with Despair
 * (DA30), on walking back into it, at once in it, and not where they saw who it was (`noteBedroom`). The character's own room always sees who it was (the owner's rule #8, 13.11.2026); the Shadow cover below its
 * threshold (16) lets the room beyond see it too.
 *
 * WHO SEES A DOOR WORKED (the owner's rules #8 and #9, 13.11.2026: a player learns what their character could know in the
 * fiction, when they could know it). The students standing in the character's own room get a card naming the character for
 * every door action done there - a barricade put up, a force, a pick; the cover and the noise rules decide only the room
 * beyond and the neighbours. A knock at a barricade is heard, with no name, by everyone in the room behind it.
 *
 * BUILT SINCE (E74, 12.11.2026): the "Someone tries to get in" card (`knockDoor`; to the barricade's author alone until the
 * owner's rule #9, to everyone in the room behind it since), the doors'
 * Remnants (`leaveDoorTrace`, `pickTrace`), Repair the Lock (below), Keep Watch (watch-gm.mjs).
 */

import { MODULE_ID, FLAGS, INFILTRATE, ROOM_OWNER_FLAG } from "./config.mjs";
import { isDeceased, isDeadForGm } from "./settings.mjs";
import { isPrimaryGm, log, error } from "./utils.mjs";
import { barricadeStore, bedroomNoteStore } from "./gm-stores.mjs";
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
    // The room the character stands in sees who barricades it (the owner's rule #8, 13.11.2026); nobody outside is told.
    await tellRooms(place.scene, [place.room], game.i18n.format("DRPG.Infiltrate.shut.seenBy", { name: actor.name, room: place.room }), new Set([actor.id]));
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

/**
 * Whisper `text` to the owners of every living student standing in one of `rooms` on `scene` but `skip`'s, and to `also`'s
 * when it was not among them. Answers how many students were told; their ids are added to `into` when given.
 */
async function tellRooms(scene, rooms, text, skip = new Set(), { also = null, into = null } = {}) {
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
    if (also && !told.has(also.id) && !skip.has(also.id)) {
        told.add(also.id);
        await whisperToOwnerOnly(also, `<p>${esc(text)}</p>`);
    }
    for (const id of told) into?.add(id);
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
    // Who sees it (the owner's rule #8, 13.11.2026): the character's own room always, by name; the room beyond, by name, and
    // the rooms next to either, as a banging with no name, only when it was loud - a pass, or a miss with Despair (DA30).
    let heard = 0;
    const saw = new Set();
    const loud = forced || !withHope;
    if (loud) {
        const near = [...new Set([...M.neighbouringRooms(place.scene, place.room), ...M.neighbouringRooms(place.scene, room)])]
            .filter(r => r !== place.room && r !== room);
        heard = await tellRooms(place.scene, near, game.i18n.format("DRPG.Infiltrate.force.banging", { room }), new Set([actor.id]));
    }
    await tellRooms(place.scene, loud ? [place.room, room] : [place.room], game.i18n.format(forced ? "DRPG.Infiltrate.force.forcedBy" : "DRPG.Infiltrate.force.triedBy",
        { name: actor.name, room }), new Set([actor.id]), { into: saw });
    // Every attempt leaves a Remnant: evident where it was heard (a pass, a miss with Despair), subtle otherwise.
    if (held.length) await leaveDoorTrace(actor, forced || !withHope ? "evident" : "subtle", "force", room);
    // A bedroom's owner: told on walking back in, or at once where they stand in it; nothing more where they saw it forced.
    if (forced && holds.lock) await noteBedroom({ scene: place.scene, room, kind: "forced", told: saw, by: actor });
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
    // The character's own room sees who it is whatever the cover (the owner's rule #8, 13.11.2026); the cover hides the
    // picker from the room beyond alone.
    const saw = new Set();
    if (tell && lockish) {
        await tellRooms(place.scene, seen ? [place.room, room] : [place.room], game.i18n.format("DRPG.Infiltrate.pick.seenBy", { name: actor.name, room }), new Set([actor.id]), { into: saw });
    }
    // Every attempt at a lock leaves a Remnant by its band (DA30); a Reroll's replay leaves none of its own.
    if (tell && lockish) await leaveDoorTrace(actor, pickTrace({ opened, total: sum, isCritical, withHope }), "pick", room);
    const careless = lockish && ((opened && !isCritical && sum < rule.clean) || (!opened && !withHope));
    if (careless) {
        // A Reroll's replay told nobody: where the owner stood when the first throw named the picker is read again here.
        if (!tell) {
            const ownerId = roomFlag(place.scene, room, ROOM_OWNER_FLAG);
            const at = ownerId ? M.gmPlaceOf(game.actors.get(ownerId)) : null;
            if (at?.scene?.id === place.scene.id && (at.room === place.room || (seen && at.room === room))) saw.add(ownerId);
        }
        // A bedroom's owner: told on walking back in, or at once where they stand in it; nothing more where they saw who.
        await noteBedroom({ scene: place.scene, room, kind: "picked", told: saw, by: actor });
    }
    log(`${actor.name} ${opened ? "picked" : "failed to pick"} the lock of ${room} (${sum}; held by ${held.join(", ") || "nothing"}).`);
    return { opened, held };
}

/* ----------------------------------------------------------------------------------------------------------------- *
 * REPAIR THE LOCK (E74 C5; DA28, Q-E74-1's default: a row of passages-gm.mjs `PASSAGE_PRESETS`, its completion projects.mjs
 * `COMPLETION_EFFECTS`' "repairsLock"). A project at Trivial on a lock Force the Door or a breach broke, offered in Start New
 * only where a door of the builder's room has one (the room itself or a neighbour), once a door: a lock a project repairs
 * already is refused. Judged at the approval and again at the completion, as the owner's three of 15.10 are. Finished, the
 * lock holds again for everyone and the room's owner is told (on walking back in, `noteBedroom`); taken back (a Reroll), it is broken again. A GM's repair by hand
 * in Room Setup's Broken column removes the project with a note to the GMs (`dropLockRepairs`).
 * ----------------------------------------------------------------------------------------------------------------- */

/** The projects that repair the lock of `room` on the scene `sceneId`, as the GMs hold them (their secret half's `target`). */
export async function lockRepairsOf(sceneId, room) {
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

/** A finished Repair the Lock (the row "repairsLock"): the lock holds again, its owner told on walking back in (`noteBedroom`). Answers `{ refused }` or `{ mended }`. */
export async function repairLockDone(projectId, { sceneId = null, lockRoom = null } = {}) {
    const M = await import("./movement.mjs");
    const scene = game.scenes.get(sceneId ?? "");
    if (!scene || !lockRoom || !M.roomBroken(scene, lockRoom)) return { refused: "that lock is not broken." };
    await M.setRoomBroken(scene, lockRoom, false);
    // Its owner: told on walking back in, or at once where they stand in the bedroom (the owner's rule #1, 13.11.2026).
    await noteBedroom({ scene, room: lockRoom, kind: "mended" });
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

/* ----------------------------------------------------------------------------------------------------------------- *
 * THE BEDROOM'S OWNER IS TOLD ON WALKING BACK IN (privacy line 1, 13.11.2026; the owner's rule #1: a player learns what
 * their character could know in the fiction, when they could know it). Until then the owner of a bedroom was whispered at
 * once, wherever they stood, when its door was forced, its lock picked carelessly, a wall breached into it or its lock
 * repaired. Now: an owner who saw it done - who was sent the card naming the one who did it, in the room of the deed or
 * the bedroom - is told nothing more; an owner standing in the bedroom is told at once (they are where they would find
 * it); any other owner's note is held on the GMs' side (gm-stores.mjs `bedroomNoteStore`, a row per bedroom) and told
 * when they next cross into that bedroom, on the primary (traps.mjs `onCrossed`, the road the stash notice of 1.2.112
 * takes). Several things before the owner's return are one card, each sentence once, in the order they last happened.
 * Dropped unsaid when the owner is dead by then or the room is no longer theirs.
 * ----------------------------------------------------------------------------------------------------------------- */

/** A bedroom note's key in the GMs' store: the owner, the scene and the room. */
export const bedroomNoteKey = (ownerId, sceneId, room) => `${ownerId}:${sceneId}:${room}`;

/** What a note can say, in the order two that happened at once are told. */
const NOTE_KINDS = Object.freeze(["picked", "forced", "breached", "mended"]);

/** The card of `kinds` about `room`: each sentence a paragraph, a breach's lifted seal said while that seal's time lasts. */
async function bedroomCard(room, kinds, { unsealed = null } = {}) {
    const { esc } = await import("./utils.mjs");
    const { sealPeriod } = await import("./call-world.mjs");
    const line = {
        picked: () => esc(game.i18n.format("DRPG.Infiltrate.pick.warned", { room })),
        forced: () => esc(game.i18n.format("DRPG.Infiltrate.force.yourDoor", { room })),
        breached: () => `${game.i18n.format("DRPG.Passage.card.breachBedroom", { room: esc(room) })}${
            unsealed && unsealed === sealPeriod() ? ` ${game.i18n.localize("DRPG.Passage.card.breachUnsealed")}` : ""}`,
        mended: () => esc(game.i18n.format("DRPG.Infiltrate.repair.mended", { room }))
    };
    return kinds.map(kind => `<p>${line[kind]()}</p>`).join("");
}

/**
 * Something `kind` happened to the door or a wall of `room` on `scene`: its bedroom's owner, if it has one who is alive and
 * is not `by`, is told now when they stand in it, nothing when `told` holds them (they were sent the named card), and
 * otherwise on walking back in. `unsealed` a breach's lifted seal's period. Answers "told", "held", "seen" or null.
 */
export async function noteBedroom({ scene, room, kind, told = new Set(), by = null, unsealed = null }) {
    if (!scene || !room || !NOTE_KINDS.includes(kind)) return null;
    const owner = game.actors.get(roomFlag(scene, room, ROOM_OWNER_FLAG) ?? "");
    if (!owner || owner.id === by?.id || isDeadForGm(owner)) return null;
    if (told.has(owner.id)) return "seen";
    const { gmPlaceOf } = await import("./movement.mjs");
    const at = gmPlaceOf(owner);
    if (at?.scene?.id === scene.id && at.room === room) {
        const { whisperToOwnerOnly } = await import("./utils.mjs");
        await whisperToOwnerOnly(owner, await bedroomCard(room, [kind], { unsealed }));
        return "told";
    }
    await bedroomNoteStore.whenHydrated();
    await bedroomNoteStore.patch(bedroomNoteKey(owner.id, scene.id, room), { ownerId: owner.id, sceneId: scene.id, room,
        [kind]: Date.now(), ...(unsealed ? { unsealed } : {}) });
    log(`A note for ${owner.name} waits until they walk back into ${room} (${kind}).`);
    return "held";
}

/** Whether the GMs hold a bedroom note waiting for `actor` (`tellBedroomNotes`). */
export async function hasPendingBedroomNote(actor) {
    if (!actor) return false;
    await bedroomNoteStore.whenHydrated();
    return Object.values(bedroomNoteStore.entries() ?? {}).some(row => row?.ownerId === actor.id);
}

/**
 * `owner` has just crossed into `room` on `scene` (traps.mjs `onCrossed`, on the primary), or come to stand in it by
 * another road (arrival-notices.mjs: a settled crossing - crossing rooms free, an Eclipse - or a GM's placement; the
 * E74 plan's DA30 "also in an Eclipse, from crossingSettled", joined since the audit of 1.2.113, A113-C4-3): the note
 * waiting for that bedroom is dropped and told, one card. Dropped unsaid when the owner is dead or the room is no longer
 * theirs. Answers whether a card went.
 *
 * ONE OWNER AT A TIME. A paid crossing reaches here twice, at once by its hook and `SETTLE_MS` later by its settled
 * crossing; chained per owner, the second reads the row the first dropped and tells nothing.
 */
export function tellBedroomNotes(owner, room, scene) {
    if (!owner || !room || !scene || !game.user?.isGM) return Promise.resolve(false);
    const run = (noting.get(owner.id) ?? Promise.resolve()).then(() => tellBedroomNotesNow(owner, room, scene));
    const tail = run.catch(() => false);
    noting.set(owner.id, tail);
    tail.then(() => { if (noting.get(owner.id) === tail) noting.delete(owner.id); });
    return run;
}

/** ownerId -> the bedroom note being told to that owner (`tellBedroomNotes`): the next waits for it. */
const noting = new Map();

async function tellBedroomNotesNow(owner, room, scene) {
    await bedroomNoteStore.whenHydrated();
    const key = bedroomNoteKey(owner.id, scene.id, room);
    const row = bedroomNoteStore.get(key);
    if (!row) return false;
    await bedroomNoteStore.drop(key);
    if (isDeadForGm(owner) || roomFlag(scene, room, ROOM_OWNER_FLAG) !== owner.id) return false;
    const kinds = NOTE_KINDS.filter(kind => Number(row[kind]) > 0)
        .sort((a, b) => (Number(row[a]) - Number(row[b])) || NOTE_KINDS.indexOf(a) - NOTE_KINDS.indexOf(b));
    if (!kinds.length) return false;
    const { whisperToOwnerOnly } = await import("./utils.mjs");
    await whisperToOwnerOnly(owner, await bedroomCard(room, kinds, { unsealed: row.unsealed ?? null }));
    log(`${owner.name} was told what happened to ${room} while they were away (${kinds.join(", ")}).`);
    return true;
}

/** When the room behind each barricade was last told of somebody at the door, by key: one card a quarter minute. */
const knocked = new Map();
const KNOCK_MS = 15000;

/**
 * SOMEONE TRIES TO GET IN (E74; the plan's C2 card). A walk in through a door refused at a barricade, on the walker's own
 * browser by the veto, which asks this of the primary (bridge `door.knock`): everyone in the room behind the barricade is
 * told that somebody tries the door - no name (the owner's rule #9, 13.11.2026; its author alone until then). Judged here: the room barricaded as the GMs hold it, next to the room the GMs read the
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
    // Heard by everyone in the room behind the barricade (the owner's rule #9, 13.11.2026), its author among them; the
    // author is told even where the GMs read their token as not standing there (a hidden one), as before. No name.
    const text = game.i18n.localize("DRPG.Infiltrate.shut.knock");
    const heard = await tellRooms(place.scene, [room], text, new Set([actor.id]), { also: author });
    return { told: heard > 0 };
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

