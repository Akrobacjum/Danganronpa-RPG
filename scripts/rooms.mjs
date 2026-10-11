/**
 * Danganronpa RPG - what a room is (E12 C1, 11.10.2026; plan-E12 section 3.1, audit S07-06).
 * ---------------------------------------------------------------------------
 * Until 1.2.74 every named region on a scene was a room: movement, Search, fog, voice and the
 * rest each read `scene.regions` and kept what had a name. A region drawn for something else -
 * a Teleport to the roof, a level change on a staircase, a player's Daggerheart area - was a
 * room as soon as somebody typed a name into it, and a player who could name one after
 * another's room had made a second door into it.
 *
 * A ROOM IS WHAT A GM MARKED. `isRoom(region)`: the region has a name, carries
 * `flags.danganronpa-rpg.room === true`, has no behaviour of a type that moves a token
 * somewhere else (`NOT_ROOM_BEHAVIOURS`), and is not one the primary GM saw a player create
 * (`SETTINGS.playerRegions`, movement.mjs `registerMovement`). The flag is written by Room
 * Setup's "This is a room" column and, once per world, by the migration clause `markRooms`
 * (migrate.mjs), which marks every named region without behaviours that no player drew.
 *
 * A ROOM IS A NAME ON A SCENE. Two regions of one name are two pieces of one room:
 * `roomRegions(scene, name)` returns every piece, `roomFlag` reads a flag as OR over them,
 * `setRoomFlag` writes it to every region of the name. E12 C1 adds the predicate and its
 * writers; the readers that still take `filter(r => r.name)` move onto it in C2a and C2b, so
 * in this commit the flag changes what Room Setup and Season setup show and nothing a rule
 * decides.
 *
 * A LEAF. This file imports `config.mjs` and nothing else, so every module may read rooms
 * through it without a cycle (R161 counts static imports). It does not import settings.mjs,
 * which is why `playerRegionIds` reads the setting by its key and answers an empty set when
 * the key is not registered: the leaf cannot know where in the load it is asked.
 */

import { MODULE_ID } from "./config.mjs";

/** The room flag on a Region: `true` a room, `false` a GM said it is not, absent never decided. */
export const ROOM_FLAG = "room";

/** On a Scene: the module version whose `markRooms` pass marked this scene's rooms. */
export const ROOMS_MARKED_FLAG = "roomsMarkedAt";

/** `SETTINGS.playerRegions` (settings.mjs), by its key - see the leaf note above. */
const PLAYER_REGIONS = "playerRegions";

/*
 * BEHAVIOURS THAT MAKE A REGION A PASSAGE, NOT A ROOM. A Teleport sends a token to another
 * place and a level change to another floor: a region carrying either is where a token leaves
 * from, and a room there would be a room nobody can stand in. The two type names are Foundry's
 * as recalled, not read off a v14 table (LIVE-E12-02, LIVE-E12-04); a region with any other
 * behaviour may be a room, and the migration leaves every region with behaviours for the GM to
 * decide (`markRooms`).
 */
export const NOT_ROOM_BEHAVIOURS = new Set(["teleportToken", "changeLevel"]);

/** A region's behaviours as a list, whatever collection holds them. */
function behavioursOf(region) {
    return Array.from(region?.behaviors ?? []);
}

/** The type of the first behaviour of this region that makes it a passage, or null. */
export function passageBehaviour(region) {
    return behavioursOf(region).find(b => NOT_ROOM_BEHAVIOURS.has(b?.type))?.type ?? null;
}

/** Whether the region carries any behaviour at all - the migration leaves those to the GM. */
export function hasBehaviours(region) {
    return behavioursOf(region).length > 0;
}

/** The ids of the regions the primary GM saw a player create (`SETTINGS.playerRegions`). */
export function playerRegionIds() {
    if (!game.settings?.settings?.has?.(`${MODULE_ID}.${PLAYER_REGIONS}`)) return new Set();
    return new Set(game.settings.get(MODULE_ID, PLAYER_REGIONS) ?? []);
}

/**
 * Whether a GM may make this region a room: it has a name, no passage behaviour, and no player
 * drew it. `players` is `playerRegionIds()`, read once by a caller that asks of many regions.
 */
export function canBeRoom(region, players = playerRegionIds()) {
    return Boolean(region?.name) && !passageBehaviour(region) && !players.has(region.id);
}

/** `isRoom` with the player regions read by the caller. */
export function isRoomWith(region, players) {
    return canBeRoom(region, players) && region.getFlag?.(MODULE_ID, ROOM_FLAG) === true;
}

/** Whether this region is a room (see the file's note). */
export function isRoom(region) {
    return isRoomWith(region, playerRegionIds());
}

/** Whether a GM has decided this region, either way: the room flag is set at all. */
export function roomDecided(region) {
    const flag = region?.getFlag?.(MODULE_ID, ROOM_FLAG);
    return flag === true || flag === false;
}

/** Every region of this scene that carries a name, or only those of `name`. Not every one is a room. */
export function namedRegions(scene, name = null) {
    return Array.from(scene?.regions ?? []).filter(r => r.name && (name === null || r.name === name));
}

/**
 * The regions of this scene the migration would mark and Season setup asks about: named, no
 * behaviour of any kind, no player's, and never decided by a GM.
 */
export function unmarkedRegions(scene) {
    const players = playerRegionIds();
    return namedRegions(scene).filter(r => !hasBehaviours(r) && !players.has(r.id) && !roomDecided(r));
}

/** Every room region of this scene, each piece of a room on its own. */
export function roomPieces(scene) {
    const players = playerRegionIds();
    return Array.from(scene?.regions ?? []).filter(r => isRoomWith(r, players));
}

/** The pieces of the room `name` on this scene; empty when it is no room there. */
export function roomRegions(scene, name) {
    return roomPieces(scene).filter(r => r.name === name);
}

/** The room names of this scene, sorted and once each. */
export function roomNames(scene) {
    return [...new Set(roomPieces(scene).map(r => r.name))].sort((a, b) => a.localeCompare(b));
}

/** A flag of the room `name`, read as OR over its pieces: the first piece that carries one answers. */
export function roomFlag(scene, name, key) {
    for (const piece of roomRegions(scene, name)) {
        const value = piece.getFlag(MODULE_ID, key);
        if (value !== undefined && value !== null && value !== false) return value;
    }
    return null;
}

/**
 * Write a flag on every region of the name `name` on this scene, rooms or not - the room flag
 * itself is written this way, to regions that are not rooms yet. A GM's write; one update of
 * the scene's regions.
 */
export async function setRoomFlag(scene, name, key, value) {
    if (!game.user?.isGM || !scene) return 0;
    const pieces = namedRegions(scene, name).filter(r => r.getFlag(MODULE_ID, key) !== value);
    if (!pieces.length) return 0;
    await scene.updateEmbeddedDocuments("Region", pieces.map(r => ({ _id: r.id, [`flags.${MODULE_ID}.${key}`]: value })));
    return pieces.length;
}

/** Whether this scene holds at least one room. */
export function sceneHoldsRooms(scene) {
    return roomPieces(scene).length > 0;
}

/** Every scene that holds a room, in the world's order. */
export function scenesWithRooms() {
    return Array.from(game.scenes ?? []).filter(sceneHoldsRooms);
}

/**
 * Whether a character's token on this scene stands somewhere (plan-E12 6.1, decision D7): in
 * E12 a scene that holds rooms. The seam E13 narrows - its trial scene holds no place.
 */
export function isPlaceScene(scene) {
    return sceneHoldsRooms(scene);
}

/**
 * The school (plan-E12 3.1, 6.1): the only scene with rooms; else the active scene if it holds
 * rooms; else the scene with the most room pieces, ties to the first in sort order. Null when
 * no scene holds a room. E13 replaces the body with its school role and keeps this fallback.
 */
export function homeScene() {
    const scenes = scenesWithRooms();
    if (scenes.length <= 1) return scenes[0] ?? null;
    const active = game.scenes?.active;
    if (active && scenes.includes(active)) return active;
    const pieces = new Map(scenes.map(s => [s, roomPieces(s).length]));
    return [...scenes].sort((a, b) => (pieces.get(b) - pieces.get(a)) || ((a.sort ?? 0) - (b.sort ?? 0)))[0];
}
