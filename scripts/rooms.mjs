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
 * `setRoomFlag` writes it to every region of the name that can be a room (`writablePieces`;
 * E12 fix r1-G1, 11.10.2026: until then a Teleport of the name took the mark too, which
 * `canBeRoom` refused to read and nobody had decided). E12 C1 adds the predicate and its
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

/** `SETTINGS.sceneRoles` (settings.mjs), by its key, for the same reason. */
const SCENE_ROLES = "sceneRoles";

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

/*
 * THE SCENE ROLES (E13 C1, 12.10.2026; plan-E13 3.1, audit S07-47, decision D7). A GM links two
 * scenes once: the school, where the season is played, and the trial hall, a fixed scene the
 * Class Trial is held in, where the students keep tokens all season that the module only shows
 * and hides. Until 1.2.74 the hall was one more scene with regions on it: a room a GM had drawn
 * and marked there was a room like any other, so a student's hall token was a place
 * `locateActor` could answer, a walk across the hall was judged as a crossing between rooms
 * (scenario 41 b read the courtroom rule refusing one, 12.10.2026), and the voice put the
 * students shown in the hall into the hall's rooms (41 h).
 *
 * THE HALL IS A PLACE FOR NOBODY. `roomPieces(hall)` is empty whatever its regions say, so every
 * reader that asks this file what a room is - the veto, the charge, fog, traps, trails, the
 * body's discovery, voice, Search, the floor switcher - finds none there, and `isPlaceScene` (a
 * scene that holds a room) is false of it. The test is made once, in `roomPieces`; the two
 * readers that walk every scene's tokens without asking about rooms first (movement.mjs
 * `placesOf`, voice.mjs `sceneRoomWarnings`) ask `isPlaceScene` and `isTrialScene`, and so does
 * the arrival judge (movement.mjs `arrivalVerdict`), whose last room may predate the link. Regions the
 * hall holds for later modes (two side zones, amend 28.09) are read by nothing in this version.
 *
 * THE SCHOOL WINS. `homeScene()` answers the linked school first, whatever is active or on
 * screen, and E12's guess only when no school is linked or its scene is gone.
 *
 * Read by its key, as `playerRegions` is, and held here until the setting's `onChange`
 * (settings.mjs) calls `forgetSceneRoles` on each client: `roomPieces` asks it of every scene
 * `locateActor` walks. With nothing linked no scene is the hall and every reader answers as E12's.
 */
let rolesHeld = null;

/**
 * The scene roles as stored: `{ school, trial }` (scene ids), and any later field beside them -
 * an object with named fields, never a list (plan page 11.10), so a reader takes its own field
 * by name and a writer merges into what is stored. `{}` before the setting is registered.
 */
export function sceneRoles() {
    if (rolesHeld) return rolesHeld;
    if (!game.settings?.settings?.has?.(`${MODULE_ID}.${SCENE_ROLES}`)) return Object.freeze({});
    const stored = game.settings.get(MODULE_ID, SCENE_ROLES);
    rolesHeld = Object.freeze({ ...(stored && typeof stored === "object" ? stored : {}) });
    return rolesHeld;
}

/** Lets go of what `sceneRoles` holds - the setting's `onChange`, on every client. */
export function forgetSceneRoles() {
    rolesHeld = null;
}

/** The scene id a role names, or null: a field read by its name, and only a non-empty string is an id. */
function roleId(roles, role) {
    const id = roles?.[role];
    return typeof id === "string" && id ? id : null;
}

/**
 * This scene's role: "trial", "school" or null. Handed `roles`, it reads nothing else (R114 asks
 * it of plain objects). A scene linked as both is the hall, where nobody stands.
 */
export function sceneRole(scene, roles = sceneRoles()) {
    const id = scene?.id;
    if (!id) return null;
    if (roleId(roles, "trial") === id) return "trial";
    if (roleId(roles, "school") === id) return "school";
    return null;
}

/** Whether this scene is the linked trial hall. */
export function isTrialScene(scene) {
    return sceneRole(scene) === "trial";
}

/** The linked trial hall, or null when none is linked or its scene is gone. */
export function trialScene(roles = sceneRoles()) {
    const id = roleId(roles, "trial");
    return id ? game.scenes?.get?.(id) ?? null : null;
}

/** The linked school, or null when none is linked, its scene is gone, or it is linked as the hall too. */
export function schoolScene(roles = sceneRoles()) {
    const id = roleId(roles, "school");
    if (!id || id === roleId(roles, "trial")) return null;
    return game.scenes?.get?.(id) ?? null;
}

/** Every room region of this scene, each piece of a room on its own; none on the trial hall (the note above). */
export function roomPieces(scene) {
    if (isTrialScene(scene)) return [];
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
    return flagOver(roomRegions(scene, name), key);
}

/*
 * ONE ROOM OF MANY PIECES, READ AS ONE (E12 fix r1-G1, 11.10.2026; review round 1 CR1-1,
 * EARLY-C2a-1, goal-r1 N2). E12 C2a wrote a room's flags to every piece of its name, but the rule
 * readers in vault.mjs and rest.mjs kept reading the LAST room piece (`regionsByName`). A Kitchen
 * set up in one piece therefore lost its stash, its bedroom, its rest and its table the moment a GM
 * drew a second piece and ticked it a room - measured by the review on b5baaf5: `stashesIn` 1 -> 0,
 * `roomAllows(long)` true -> false, `sharedRooms` [] -> [Kitchen] - and the next stash edit wrote
 * the empty piece's list over the old one. Every reader now answers from all the pieces: a value
 * from the first piece that carries one (`flagOver`, what `roomFlag` always did for the owner, the
 * lock and the seal), a list as the union of every piece's (`listOver`), a walker over a scene's
 * rooms from `piecesByName`, which groups them in one pass.
 */

/** `roomFlag` over pieces in hand: the first value that is not false, empty or absent answers; else null. */
export function flagOver(pieces, key) {
    for (const piece of pieces) {
        const value = piece.getFlag(MODULE_ID, key);
        if (value !== undefined && value !== null && value !== false && value !== "") return value;
    }
    return null;
}

/** A list flag over pieces in hand, as one list: every piece's entries, each once, in the pieces' order. */
export function listOver(pieces, key) {
    return [...new Set(pieces.flatMap(piece => {
        const list = piece.getFlag(MODULE_ID, key);
        return Array.isArray(list) ? list : [];
    }))];
}

/** The room pieces of this scene by name, in one pass: each name where its first piece is, with every piece of it. */
export function piecesByName(scene) {
    const map = new Map();
    for (const piece of roomPieces(scene)) {
        if (!map.has(piece.name)) map.set(piece.name, []);
        map.get(piece.name).push(piece);
    }
    return map;
}

/*
 * A RENAME ONTO A ROOM THAT STANDS THERE (E12 fix r2-H4, 11.10.2026; early review EARLY-C8-1, widened
 * by the correctness review r2). E12 C8 carried a room's keys, stashes and discovery to its new name
 * when its last piece was renamed, and asked only that a room of the new name stood afterwards - which
 * a room already there passed: measured by the review at e331c55, Aiko's "Dorm A" renamed "Dorm B"
 * (Ben's bedroom) made every Dorm A key a Dorm B key, and the renamed piece kept Aiko's owner and
 * stash, which the union readers (`flagOver`, `stashesOver`) read as Dorm B's. A piece of the new name
 * is the renamed room's own only when a GM renamed it from the same old name - the first pieces of a
 * room renamed piece by piece; any other is another room, and the rename joins it. Which piece came
 * from which name is remembered on every GM (fog.mjs `noteRegionName` writes it), because the client
 * that writes the rename judges it before the update (vault.mjs `clearSplitPiece`) and the primary
 * judges the carry after it, and they need not be the same GM (scenario 66 Q).
 */
const renamedFrom = new Map();

/** A GM's rename of a region, seen on this GM: the name it had before. */
export function noteRenamedFrom(regionId, was) {
    if (regionId && was) renamedFrom.set(regionId, was);
}

/** Whether renaming `region` from `was` to `now` on `scene` makes it a piece of another room standing there (the note above). */
export function joinsAnotherRoom(scene, region, was, now) {
    if (!scene || !now || now === was) return false;
    return roomRegions(scene, now).some(piece => piece.id !== region?.id && renamedFrom.get(piece.id) !== was);
}

/**
 * The regions of the name `name` on this scene that a GM's room write lands on: every one that can
 * be a room (`canBeRoom`), marked or not - Room Setup is where a named region becomes a room, so a
 * piece not yet marked is written with the rest and carries the room when it is. Never a Teleport's
 * or a region a player drew (E12 fix r1-G1).
 */
export function writablePieces(scene, name) {
    const players = playerRegionIds();
    return namedRegions(scene, name).filter(r => canBeRoom(r, players));
}

/**
 * Write a flag on every region of the name `name` on this scene that can be a room, marked or
 * not (`writablePieces`) - the room flag itself is written this way, to regions that are not
 * rooms yet. A GM's write; one update of the scene's regions.
 */
export async function setRoomFlag(scene, name, key, value) {
    if (!game.user?.isGM || !scene) return 0;
    const pieces = writablePieces(scene, name).filter(r => r.getFlag(MODULE_ID, key) !== value);
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
 * Whether a character's token on this scene stands somewhere (plan-E12 6.1, decision D7): a
 * scene that holds rooms. The trial hall holds none (`roomPieces`, E13 C1), so it is no place;
 * the plan wrote the role test here as well, and a second test of it here could be taken out
 * with nothing anywhere answering differently, so there is one.
 */
export function isPlaceScene(scene) {
    return sceneHoldsRooms(scene);
}

/**
 * The school: the scene linked as the school (`schoolScene`, E13 C1), whatever is active or on
 * screen. When none is linked or its scene is gone, E12's guess (plan-E12 3.1, 6.1): the only
 * scene with rooms; else the active scene if it holds rooms; else the scene with the most room
 * pieces, ties to the first in sort order - never the hall, which holds none. Null when no
 * school is linked and no scene holds a room.
 */
export function homeScene() {
    const school = schoolScene();
    if (school) return school;
    const scenes = scenesWithRooms();
    if (scenes.length <= 1) return scenes[0] ?? null;
    const active = game.scenes?.active;
    if (active && scenes.includes(active)) return active;
    const pieces = new Map(scenes.map(s => [s, roomPieces(s).length]));
    return [...scenes].sort((a, b) => (pieces.get(b) - pieces.get(a)) || ((a.sort ?? 0) - (b.sort ?? 0)))[0];
}

/** Every place scene, the school (`homeScene`) first and the rest in the world's order. */
export function placeScenes() {
    const scenes = scenesWithRooms().filter(isPlaceScene);
    const home = homeScene();
    return home && scenes.includes(home) ? [home, ...scenes.filter(s => s !== home)] : scenes;
}

/**
 * The scene a room of this name is on, for a reader that holds a name and no scene (a project's
 * room, a gather order written before it carried one, the console's `discoverBody`): the school
 * when it has the room, else the first other place scene that does (plan-E12 C5). Null when no
 * place scene has it - never the scene on screen.
 */
export function sceneOfRoom(name) {
    if (!name) return null;
    return placeScenes().find(scene => roomRegions(scene, name).length > 0) ?? null;
}

/** The room names of every place scene, sorted and once each: a GM's list of where a thing may be. */
export function placeRoomNames() {
    return [...new Set(placeScenes().flatMap(roomNames))].sort((a, b) => a.localeCompare(b));
}

/*
 * FLOORS (E12 C9, 11.10.2026; plan-E12 3.2, audit S07-45, S07-22). Foundry v14 puts a token on a
 * level (`tokenDoc.level`) and a region on some (`region.levels`, none meaning every one), and
 * asks `region.includedInLevel(level)`. Until 1.2.74 nothing here knew: a room was told apart by
 * its footprint, so a token on the ground floor under the attic stood in the attic, and every
 * listener that waits for a move asked whether x or y had changed - a token that only changed
 * floor had not moved at all, into a locked room or anywhere else. These names are the plan's
 * reading of v14 and the harness's model of it (audit/harness/lib/shim.mjs `LevelList`); what
 * v14 holds there is LIVE-E12-02/03, not read off a table.
 */

/**
 * The fields of a token whose change is a move: Foundry's own list (`BaseToken.MOVEMENT_FIELDS`)
 * and, whatever that list says, x, y, elevation and level - whether v14's list names `level`
 * was not read (LIVE-E12-03), and a floor change missed here is a move nothing judges.
 */
export const MOVE_FIELDS = Object.freeze([...new Set([
    ...(globalThis.foundry?.documents?.BaseToken?.MOVEMENT_FIELDS ?? ["width", "height", "depth", "shape"]),
    "x", "y", "elevation", "level"
])]);

/** Whether a token's update moves it - a change of any of `MOVE_FIELDS`, a floor's alone included. */
export function isMoveChange(changes) {
    return MOVE_FIELDS.some(field => changes?.[field] !== undefined);
}

/** The floor a token stands on, or null on a scene of one floor (or before v14). */
export function levelOf(tokenDoc) {
    return tokenDoc?.level ?? null;
}

/**
 * The regions a scene's own update changed, each with its patch, as `[region, patch]` (E12 fix r2-S2,
 * 11.10.2026; review O6): `changes.regions` as the update hook hands it - a list of patches by `_id`
 * in the harness (client-entry.mjs), not read on v14 (LIVE-E12-03). A patch naming no region the
 * scene holds is left out. Read by fog.mjs `regionsReplaced` and movement.mjs's `updateScene` hook.
 */
export function regionPatches(scene, changes) {
    const patches = Array.isArray(changes?.regions) ? changes.regions : [];
    return patches.map(patch => [scene?.regions?.get?.(patch?._id) ?? null, patch]).filter(([region]) => region);
}

/**
 * Whether a region is on this floor: no floor asked, a region on no floor in particular (every
 * floor), or one Foundry says it is on. A region that cannot be asked is on every floor - the
 * module's rule wherever it cannot read a map (movement.mjs `neighbouringRooms`).
 *
 * ASKED BY THE FLOOR'S ID, WHATEVER THE CALLER HOLDS (E12 fix r2-H1, 11.10.2026; early review
 * EARLY-C10-1). The rules hand in a token's level (an id), the fog `canvas.level` (a level), and
 * this passed either on unchanged - so one side was wrong on v14 whichever form
 * `includedInLevel` takes, and the harness's model takes both. The community typings for v14
 * (fvtt-types 14.366.0-beta, read 11.10.2026) type it `string | Level`; Foundry's own source was
 * not read. One form for every caller, so one reading at a table (LIVE-E12-02) settles them all.
 */
export function onLevel(region, level) {
    if (level === null || level === undefined || !region?.levels?.size) return true;
    const id = level?.id ?? level;
    if (typeof region.includedInLevel === "function") return region.includedInLevel(id);
    return region.levels.has(id);
}

/**
 * A scene's floors, lowest first - by `elevation`, the order the owner's item 5 of 09.10 gives
 * them - or none on a scene that names no floor (every scene before v14). `elevation` as a
 * number is the harness's model of a level (lib/shim.mjs `LevelList`); the v14 typings
 * (`onLevel`'s note) give a level `elevation: {bottom, top}`, and an object subtracted gave NaN
 * and left the floors in the scene's own order (E12 fix r2-H1; early review EARLY-C10-4). So the
 * bottom when there is one, else the number; what v14 holds at a table is LIVE-E12-02.
 */
export function floorsOf(scene) {
    const height = level => Number(level?.elevation?.bottom ?? level?.elevation) || 0;
    return [...(scene?.levels ?? [])].sort((a, b) => height(a) - height(b));
}

/*
 * THE CAMERA (E12 C6, 11.10.2026; plan-E12 3.3, audit S08-15). The scene a browser has on
 * screen is a fact about that browser, and a rule judged on it answers differently on two
 * browsers looking at two maps. Before this commit 64 top-level declarations read the camera,
 * by R382's own reading; 37 of them read it as a default or a fallback - the stashes, the
 * favours, the room tables, the rest rooms, the Search tokens, where a trace was dropped and
 * where a Remnant edit looked - so a GM looking at another scene judged a player's Search on a
 * room of the same name there. Those 37 take the scene of what they judge now: an actor's
 * (`locateActor`, movement.mjs `sceneOfActor`), a trace's (remnants.mjs `sceneOfRemnant`), a
 * room name's (`sceneOfRoom`), or the one the caller names.
 *
 * The camera is read through `viewedScene()` and `viewedLevel()` (the level since E12 C10: the
 * floor the fog, the outline and the reveal draw; what v14 holds there is LIVE-E12-02/03), and
 * only from a function `CAMERA_READERS` lists - keyed
 * "file#top-level declaration", the whole of a class being one - with what it is:
 *   definition  the two readers themselves;
 *   draw        paints, pans or animates this browser's canvas;
 *   window      a GM's window about "this scene", through utils.mjs `workingScene()`;
 *   diagnose    a console readout of what this browser shows;
 *   own         a player's view of their own map (the rooms they have found there) - none
 *               since E12 fix r1-G4: `roomsKnownToMe` takes the scene the character stands on.
 * None is a rule: nothing listed decides what a roll, a stash, a token or a trace does, and no
 * window listed writes on a scene its list did not show. Three did, until E12 fix r1-G2 (review
 * round 1 CR1-2, CR1-5, EARLY-C5-1): the Trap plant listed the camera's rooms and keyed the plant
 * on them while a Search takes it on the searcher's scene, the Mastermind window's lair list
 * cleared a lair it did not show, and the Case dashboard's Final Truth listed the camera's rooms
 * and placed on the school's. They list every place scene now and write on the room picked, and
 * are not rows here. A row says only that a reader is allowed; R118 and tier 2 read what one does.
 * R382 reads every module file and fails on a reader not listed, a row whose function no
 * longer reads the camera, and a kind not one of the five. It reads `canvas.scene`,
 * `canvas.level`, `game.scenes.current`/`.viewed` and calls of the three functions; it does
 * not read `canvas.tokens`, `getActiveTokens()` or a user's `viewedScene` property, which
 * are the camera by other roads. Two of those, movement.mjs `occupantsOf` and
 * `roomsKnownToMe`, read a named scene's documents since E12 fix r1-G4; tier 2 moves the
 * camera under the first ("who stands in a room is counted on the scene ..."), scenario 66 N1
 * under the second (K1 on the fix line, renamed at the merge; this line named K1 until E12 fix r2-S2).
 */

/** The scene this browser has on screen, or null. Only for a function `CAMERA_READERS` lists. */
export function viewedScene() {
    return canvas?.scene ?? null;
}

/** The level this browser has on screen (Foundry v14), or null. Only for a function `CAMERA_READERS` lists. */
export function viewedLevel() {
    return canvas?.level ?? null;
}

/** Every function that may read the camera, and why - the note above, and R382. */
export const CAMERA_READERS = Object.freeze({
    "rooms.mjs#viewedScene": "definition",
    "rooms.mjs#viewedLevel": "definition",

    "call-world.mjs#panToGathered": "draw",
    "fog-doorways.mjs#doorwayEdges": "draw",
    "fog.mjs#visionForDrawnScene": "draw",
    "fog.mjs#rememberMine": "draw",
    "fog.mjs#repaintFog": "draw",
    "fog.mjs#repaintRoomScene": "draw",
    "fog.mjs#revealStartingRooms": "draw",
    "fog.mjs#announceRoom": "draw",
    "fog.mjs#playDiscoveryAnimation": "draw",
    "fog.mjs#floorSwitcher": "draw",
    /* A player's own view switched once after a load (E13 C3, Q-E13-1 c): it moves this browser's
       canvas and decides nothing - the plan named it a window row, but no GM window reads it. */
    "trial-scene.mjs#selfRepair": "draw",

    "utils.mjs#workingScene": "window",
    "gm-panel.mjs#nextStep": "window",
    "investigation.mjs#openNewTrace": "window",
    "investigation.mjs#openKeyRemnantHere": "window",
    "investigation.mjs#placeKeyRow": "window",
    "season-setup.mjs#steps": "window",
    "vault.mjs#openRoomSetupDialog": "window",

    "diagnostics.mjs#diagnoseVoice": "diagnose",
    "fog-diagnostics.mjs#whatIsHere": "diagnose",
    "fog-diagnostics.mjs#checkRegions": "diagnose",
    "fog-diagnostics.mjs#sceneUncoveredPercent": "diagnose",
    "fog.mjs#diagnoseFog": "diagnose",
    "fog.mjs#doorwayReport": "diagnose",
    "fog.mjs#whyBlack": "diagnose",
    "search-tokens.mjs#showSearchTokens": "diagnose",
    "visibility.mjs#diagnoseVisibility": "diagnose",
    "voice.mjs#competingModuleWarnings": "diagnose"
});
