/**
 * Danganronpa RPG - the body on the map (E95, 1.2.104; DC6, E72 amend[16]).
 * ---------------------------------------------------------------------------
 * DC6, the owner's pick: "Ciało zostaje na miejscu śmierci jako kafel 'Ciało: {imię}' (tylko ofiary morderstwa)".
 * A murdered student who becomes a Monocub walks away on their own token, and until E95 their body walked with them:
 * every reader of "the room the body lies in" read the token's room (frisk.mjs `personActionRefusal` through
 * movement.mjs `gmPlaceOf`). From E95 the body is a tile laid where the token stood, flagged `FLAGS.bodyOf`, and every
 * such reader asks this file: `bodyPlaceOf` (where the body lies) and `bodyRoomOf` (its room) - the tile's, and the
 * token's again when a GM deletes the tile or none was laid.
 *
 * THE OWNER'S RULES OF 11.11.2026 (E63; E95 Q2, Q3, Q8), which replace DC6's "only the murdered" and E95's Monocub
 * edge: the tile is laid when the death is the table's, every death, an execution's too (`leaveBody`, from chapter.mjs
 * `markDeceased`; a death the GMs keep lays none until it is made known, QUESTIONS E63 Q1); it follows its corpse's token
 * until the student gets up as a Monocub (`followBody`, Q3); every body tile goes at the Class Trial's end (clock.mjs
 * `reconcilePhase`, `removeBodyTiles`), and a student's at a revive or the season's reset. The readers ask any browser,
 * the player's included (anonymity.mjs's greying asks the loot gate there); the writers are the GMs' alone, and the
 * tile's flag says nothing the `deceased` flag does not say at the same moment.
 *
 * WHICH TILE IS THE BODY. The current death's (`deathId` the `deceased` record's, so a student who died, came back and
 * died again is not read on the first death's tile a GM forgot), and of two the earliest laid (`at`): two GMs making
 * one Monocub at once can lay two (the stage's risk 4), and both readers then read one. A record with no `deathId`
 * matches a tile with none - the deaths written before deathId existed. The record is read through `held` (E95 fix
 * RV-6): the GMs' roads hand sheet-audit.mjs `flagsHeldNow`, so on the primary the death is the GMs' mark and not the
 * value a player wrote on their own actor before its put-back (frisk.mjs `personActionRefusal`, `leaveBody`); a
 * caller that hands nothing reads the document, which is what a player's browser holds.
 *
 * THE TILE'S ROOM. By its centre on the floor its flag stores, through movement.mjs `roomAt`, the one hit test. A
 * tile's width and height are pixels and a token's are squares (Foundry's model as remembered, not read on v14:
 * LIVE-E95-02), and `roomAt` measures a centre as `width * grid`; so it is handed a stand-in of the tile's size in
 * squares on the tile's scene. The floor is the flag's, not the tile's own field, so the rule does not wait on what
 * v14 calls that field.
 *
 * THE TILE IS DATA, NOT A PICTURE (the owner's report of 13.11.2026 at a table on 1.2.112: "Killing a character makes 3
 * tokens appear: the body, the Spectator and... a third, inactive token"; scenario 77 measured it on every road: the
 * corpse's own token, the Spectator's token, and this tile drawn with the token's picture, its dead sign and caption).
 * The coordinator's default for the owner: a death shows the body and the Spectator and nothing else. So the tile is laid
 * at alpha 0 (`bodyTileSpec`) and draws nothing of its own (`drawBodyMark`), and its caption "{name}'s body" is drawn over
 * the corpse's token instead (`drawCorpseCaption`), which already wears Foundry's dead overlay. Alpha and not `hidden`:
 * `hidden` is the rule's - a hidden tile refuses the loot (frisk.mjs `personActionRefusal` through `bodyPlaceOf`) and
 * follows the token's own `hidden` (`followedTile`) - and Foundry draws a hidden tile to a GM at half alpha. A tile at
 * alpha 0 keeps every reader (`bodyPlaceOf`, `bodyRoomOf`, `followBody`, `removeBodyTiles`) and stays a document a GM
 * selects and deletes on the Tiles layer. Tiles laid at 1.2.112 or before are set to alpha 0 once (migrate.mjs
 * `bodyTilesUnseen`). Whether v14 draws a Tile at alpha 0 to nobody, a GM included, was not read: LIVE-E95-01.
 *
 * Imports config.mjs, settings.mjs and movement.mjs only (tier 1 R3142), so frisk.mjs reads it with no cycle (R161).
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { deathRecord } from "./settings.mjs";
import { gmPlaceOf, roomAt, isCorpseToken } from "./movement.mjs";

/** A floor as an id: a Level document's, an id as it is, null for none. */
const floorId = level => level?.id ?? level ?? null;

/** The grid of `scene` as movement.mjs `regionsAt` reads it: the scene's, else the canvas's, else 100. */
const gridOf = scene => scene?.grid?.size ?? globalThis.canvas?.grid?.size ?? 100;

/**
 * Whether a death leaves a body on the map: any record (E63 C0, 11.11.2026; the owner on E95 Q2 "Trial tez, ale kafel
 * smierci po trialu znika" and Q3 "gdy postac umiera"). Until E63 an execution and a death in the Class Trial left none
 * (E95 Q2 (a)); now the executed's tile is laid by the sentence and taken with every other at the trial's end (clock.mjs
 * `reconcilePhase`). The discovery keeps its own rule (chapter.mjs `bodiesToDiscover`: an execution is no body to find).
 */
export function isBodyDeath(record) {
    return Boolean(record);
}

/**
 * Whether a body with nowhere to lie is said to the GM (`DRPG.Body.noToken`; E63 C0, QUESTIONS E63 Q5): for every death
 * but one in the Class Trial, where every body goes at the trial's end anyway and the hall holds no rooms.
 */
export function noTokenWarns(record) {
    return record?.phase !== "classTrial";
}

/**
 * The data of the tile `tokenDoc` leaves as `actorId`'s body for `record` (pure; E95 C2 creates it): the token's corner,
 * its squares in pixels on its scene's grid, its height and its picture, hidden as the token is, and the flag `{ actorId,
 * deathId, level, at }` - the floor as an id (`level` handed as an id or a Level), `at` epoch ms. The caption and the
 * death sign were drawn over it (E95 C3) until the report of 13.11.2026; at alpha 0 (the header's THE TILE IS DATA): the
 * picture is kept, so a GM who raises the alpha on the Tiles layer sees whose body it is. HIDDEN AS THE TOKEN (E95 fix RV-3, 10.11.2026):
 * before E95 a hidden body token refused the loot; a tile laid unhidden turned a body the GM had hidden into a visible,
 * captioned one searchable from its room. A hidden tile refuses the loot as the hidden token did (frisk.mjs
 * `personActionRefusal` reads the tile's `hidden`), and the GM shows it as any tile.
 */
export function bodyTileSpec({ tokenDoc, actorId, record = null, level = null, at = Date.now() } = {}) {
    const size = gridOf(tokenDoc?.parent);
    return {
        x: Number(tokenDoc?.x) || 0,
        y: Number(tokenDoc?.y) || 0,
        width: (Number(tokenDoc?.width) || 1) * size,
        height: (Number(tokenDoc?.height) || 1) * size,
        elevation: Number.isFinite(tokenDoc?.elevation) ? tokenDoc.elevation : 0,
        texture: { src: tokenDoc?.texture?.src ?? null },
        alpha: 0,
        hidden: Boolean(tokenDoc?.hidden),
        flags: { [MODULE_ID]: { [FLAGS.bodyOf]: { actorId: actorId ?? null, deathId: record?.deathId ?? null, level: floorId(level), at } } }
    };
}

/** A tile's centre in pixels: its corner and half its pixel size. */
export function tileCentre(tile) {
    return { x: Number(tile?.x) + Number(tile?.width) / 2, y: Number(tile?.y) + Number(tile?.height) / 2 };
}

/** The body flag of a tile, or null. */
function markOf(tile) {
    const mark = tile?.getFlag?.(MODULE_ID, FLAGS.bodyOf);
    return mark && typeof mark === "object" ? mark : null;
}

/**
 * Every body tile of `actorId` on `scenes` (every scene by default), each as `{ doc, scene, mark }`: the tile document,
 * its scene and its flag. Whatever death it was laid for; `bodyTileOf` picks the current death's.
 */
export function bodyTilesOf(actorId, scenes = game.scenes ?? []) {
    if (!actorId) return [];
    const found = [];
    for (const scene of scenes ?? []) {
        for (const doc of scene?.tiles ?? []) {
            const mark = markOf(doc);
            if (mark?.actorId === actorId) found.push({ doc, scene, mark });
        }
    }
    return found;
}

/**
 * The tile that is `actor`'s body now, as `bodyTilesOf` hands it, or null: a tile of the death the `deceased` flag
 * records (its `deathId`), the earliest laid of two. Null for a student the table does not know dead. The flag is read
 * off `held(actor)`: the document by default, the GMs' mark where a GM's road hands sheet-audit.mjs `flagsHeldNow`
 * (E95 fix RV-6; the header's WHICH TILE).
 */
export function bodyTileOf(actor, { scenes = game.scenes ?? [], held = null } = {}) {
    const record = deathRecord(held ? held(actor) : actor);
    if (!record) return null;
    const deathId = record.deathId ?? null;
    const mine = bodyTilesOf(actor?.id, scenes).filter(({ mark }) => (mark.deathId ?? null) === deathId);
    mine.sort((a, b) => (Number(a.mark.at) || 0) - (Number(b.mark.at) || 0));
    return mine[0] ?? null;
}

/**
 * Where `actor`'s body lies: `{ scene, level, room, hidden, via, doc }`, or null. Its tile (`bodyTileOf`, `via:
 * "tile"`): the tile's scene, the floor its flag stores, the room its centre falls in on that floor (movement.mjs
 * `roomAt` on a stand-in of the tile's size in squares), whether the tile is hidden. Else its token where the GMs read
 * it (`tokenPlace`, movement.mjs `gmPlaceOf`; `via: "token"`): that token's scene, floor and room, and whether the
 * token is hidden - the place every body was read at before E95. `scenes` and `tokenPlace` are handed in by tier 1
 * R3141 only; `held`, the reader of the death (`bodyTileOf`), by frisk.mjs `personActionRefusal` (E95 fix RV-6).
 *
 * A HIDDEN TILE ON A PLAYER'S BROWSER (E95 C2; LIVE-E95-04). The loot window's greying asks this on the player's
 * browser (anonymity.mjs `greyRefused` -> inventory.mjs `transferRefusal` -> frisk.mjs `personActionRefusal`), and the
 * primary's gate asks it again on the press. Whether v14 sends a hidden tile to a player's browser was not read: if it
 * does, the greying reads the tile and its `hidden` and greys as the gate refuses; if it does not, `bodyTileOf` finds
 * no tile there and the greying reads the token's room instead, so a Take beside the token shows open and the gate
 * refuses it on the press. Headless, the harness sends every tile to every client.
 */
export function bodyPlaceOf(actor, { scenes = game.scenes ?? [], tokenPlace = a => gmPlaceOf(a, { body: true }), held = null } = {}) {
    const body = bodyTileOf(actor, { scenes, held });
    if (body) {
        const { doc, scene, mark } = body;
        const size = gridOf(scene);
        const level = mark.level ?? null;
        const standIn = { parent: scene, width: Number(doc.width) / size, height: Number(doc.height) / size,
            elevation: Number.isFinite(doc.elevation) ? doc.elevation : 0, level };
        return { scene, level, room: roomAt(Number(doc.x), Number(doc.y), standIn, level), hidden: Boolean(doc.hidden), via: "tile", doc };
    }
    const place = tokenPlace(actor);
    if (!place) return null;
    return { scene: place.scene ?? null, level: place.level ?? null, room: place.room ?? null, hidden: Boolean(place.tokenDoc?.hidden),
        via: "token", doc: place.tokenDoc ?? null };
}

/** The room `actor`'s body lies in (`bodyPlaceOf`'s), or null. The one reader of "the body's room" (E72 amend[16]). */
export function bodyRoomOf(actor, options = {}) {
    return bodyPlaceOf(actor, options)?.room ?? null;
}

/**
 * The tile's own floor field, where this Foundry's Tile has one (`level`, else `levels`), else none (E95 C2): written
 * beside the flag so Foundry shows the tile on the token's floor only. Not read on v14 (LIVE-E95-02): the field is
 * asked of the Tile's schema here, not assumed, and the rules read the flag's floor whatever this writes.
 */
function floorFieldsOf(level) {
    const id = floorId(level);
    const fields = globalThis.CONFIG?.Tile?.documentClass?.schema?.fields ?? {};
    if (!id) return {};
    if ("level" in fields) return { level: id };
    if ("levels" in fields) return { levels: [id] };
    return {};
}

/**
 * LEAVE THE BODY (E95 C2, 10.11.2026; E63 C0, 11.11.2026: the owner's "gdy postac umiera ... Nie gdy zostaje
 * Monocubem"). Lays `actor`'s body on the map as a tile where their token stands, and answers the tile document, or null.
 * GM only, on the GM's browser that made the death the table's: chapter.mjs `markDeceased`, the one function every public
 * death passes (`killCharacter` in public, `publishDeath` of a kept death, the Players window's "dead"), handing the
 * record it has just written - and migrate.mjs's clause for a 1.2.104 world (E63 C3), which hands none. A death the GMs
 * keep lays nothing until it is made known (QUESTIONS E63 Q1); becoming a Monocub lays nothing. No bridge action and no
 * socket, and core Foundry lets no player create a tile. None is laid:
 *   - for no record (`isBodyDeath`);
 *   - when a tile of this death is there already (its `deathId`) - a second `markDeceased` of one death;
 *   - when the GMs read the student's token nowhere on a scene with rooms (movement.mjs `gmPlaceOf`, which looks on place
 *     scenes only and answers null too while a put-back of the token is on its way or the judge holds it where the
 *     rules refuse, `gmSpotWhy`): the GM is told (`DRPG.Body.noToken`), except for a death in the Class Trial
 *     (`noTokenWarns`: the hall holds no rooms, and every body goes at the trial's end), as a body with nowhere to lie is a
 *     body the loot gate then reads at its token. Nothing here tries again (E95 fix RV-8).
 * The tile is the token's corner, size, picture and `hidden` (`bodyTileSpec`), with the floor in the flag and in the
 * tile's own floor field where it has one (`floorFieldsOf`). Two GMs publishing one death at once can lay two; the
 * readers take the earliest (`bodyTileOf`) and every removal takes both (`removeBodyTiles`).
 *
 * THE DEATH AS THE GMS HOLD IT (E95 fix RV-6, 10.11.2026). The record handed in is the one `markDeceased` wrote, so a
 * player's forged `deathId` cannot reach it, and right after the write the GMs' mark may not hold it yet (E63 C0). With
 * none handed, the record is read off sheet-audit.mjs `flagsHeldNow` (imported when called: the file's static imports
 * stay R3142's three), so a player's write of their own `deathId` before its put-back neither stamps the tile with it
 * nor hides the tile there.
 *
 * A TILE THE GM DELETED (the review's RV-2, closed by E63 C0): no road lays a tile again for a death that has one laid
 * once, so a tile the GM deletes stays deleted and the body is searched from its token's room (the migration aside: E63
 * C3, a 1.2.104 world's one pass).
 */
export async function leaveBody(actor, { record: handed = null, at = Date.now() } = {}) {
    if (!game.user?.isGM || !actor) return null;
    let record = handed;
    if (!record) {
        const { flagsHeldNow } = await import("./sheet-audit.mjs");
        record = deathRecord(flagsHeldNow(actor));
    }
    if (!isBodyDeath(record)) return null;
    const deathId = record.deathId ?? null;
    if (bodyTilesOf(actor.id).some(({ mark }) => (mark.deathId ?? null) === deathId)) return null;
    // Where the body lies (E62 C3b fix): a Monocub's corpse, never the token it walks.
    const place = gmPlaceOf(actor, { body: true });
    if (!place?.tokenDoc || !place.scene) {
        if (noTokenWarns(record)) ui.notifications?.warn(game.i18n.format("DRPG.Body.noToken", { name: actor.name }));
        return null;
    }
    const data = { ...bodyTileSpec({ tokenDoc: place.tokenDoc, actorId: actor.id, record, level: place.level, at }), ...floorFieldsOf(place.level) };
    const [tile] = await place.scene.createEmbeddedDocuments("Tile", [data]);
    return tile ?? null;
}

/** The body tiles a removal of every body leaves on this browser (`holdBodyTiles`), or null for none held. */
let heldTiles = null;

/**
 * THE SUITE'S FENCE (E63 C2, 11.11.2026; the lesson of E95 fix RV-1). Tier 2 ends trials in about a hundred places and
 * runs at real tables, and from E63 every trial's end takes every body tile (clock.mjs `reconcilePhase`). tests.mjs
 * hands the ids of every body tile the world holds before tier 2 (`ids`), and null after it: in between, a removal of
 * every body on this browser (`removeBodyTiles` with no actor) leaves those, unless it is asked with `held: false` (the
 * season reset's own deaths group, chapter.mjs `clearSeasonDeaths`, which at a table does take every body). A removal
 * of one student's tiles (a revive) is not fenced. Answers the set held, or null.
 */
export function holdBodyTiles(ids = null) {
    heldTiles = ids ? new Set(ids) : null;
    return heldTiles;
}

/** The ids `holdBodyTiles` holds on this browser, or null (E63 C2; tier 2 reads it). */
export function heldBodyTiles() {
    return heldTiles ? [...heldTiles] : null;
}

/**
 * Remove the body tiles of `actorId` from every scene, or every body tile when it is null, and answer how many (E95
 * C2; QUESTIONS Q7, Q8; E63 C2: and at every Class Trial's end, clock.mjs `reconcilePhase`). GM only. With no actor, a
 * tile `holdBodyTiles` holds stays unless `held` is false (the suite's fence, above). `only`, a set of tile ids, narrows it to those (E95 fix RV-1: tier 2 runs the reset's
 * deaths entry on its own tiles alone, so a GM's suite at a table deletes no body the table holds). A revive takes the student's (chapter.mjs `reviveCharacter`: a student back alive
 * has no body), the season reset's deaths group every one (chapter.mjs `clearSeasonDeaths`), a body whose student is
 * gone from the world included. Stopping being a Monocub keeps the tile: the student is still dead. A tile with no
 * body flag is never touched.
 */
export async function removeBodyTiles(actorId = null, { only = null, held = true } = {}) {
    if (!game.user?.isGM) return 0;
    const fenced = actorId === null && held && heldTiles ? heldTiles : null;
    let removed = 0;
    for (const scene of game.scenes ?? []) {
        const ids = [...(scene?.tiles ?? [])].filter(doc => {
            const mark = markOf(doc);
            return mark && (actorId === null || mark.actorId === actorId) && (!only || only.has(doc.id)) && !fenced?.has(doc.id);
        }).map(doc => doc.id);
        if (!ids.length) continue;
        await scene.deleteEmbeddedDocuments("Tile", ids);
        removed += ids.length;
    }
    return removed;
}

/**
 * The fields of a token's update the body follows: its corner, its height, its floor (rooms.mjs `levelOf` reads `level`),
 * and whether it is hidden (a GM hiding the corpse hides the body, as E95 fix RV-3 laid it hidden as the token).
 */
const MOVED = ["x", "y", "elevation", "level", "hidden"];

/**
 * The update that takes `tileDoc`, a body's tile, to where `tokenDoc` lies now, or null (pure; E63 C1, tier 1 R3403):
 * the token's corner, height and `hidden`, the tile's own size kept (a tile's width and height are pixels, and a corpse's token
 * keeps its squares), and the flag's `level` the token's floor (`level`, an id or a Level), with the tile's own floor
 * field where it has one (`floorFieldsOf`). Null when `changes` names none of the fields that move a token (`MOVED`), or
 * when the tile lies there already.
 */
export function followedTile(tileDoc, tokenDoc, changes, level = null) {
    if (!tileDoc || !tokenDoc || !MOVED.some(key => key in (changes ?? {}))) return null;
    const mark = markOf(tileDoc);
    if (!mark) return null;
    const x = Number(tokenDoc.x) || 0, y = Number(tokenDoc.y) || 0;
    const elevation = Number.isFinite(tokenDoc.elevation) ? tokenDoc.elevation : 0;
    const floor = floorId(level), hidden = Boolean(tokenDoc.hidden);
    if (Number(tileDoc.x) === x && Number(tileDoc.y) === y && (Number(tileDoc.elevation) || 0) === elevation && (mark.level ?? null) === floor
        && Boolean(tileDoc.hidden) === hidden) return null;
    return { _id: tileDoc.id, x, y, elevation, hidden, [`flags.${MODULE_ID}.${FLAGS.bodyOf}.level`]: floor, ...floorFieldsOf(floor) };
}

/**
 * THE BODY FOLLOWS ITS CORPSE (E63 C1, 11.11.2026; QUESTIONS E63 Q3, the owner's "yes"). Foundry's `updateToken`, after
 * the write: on the GM's browser that moved the token alone (`userId === game.user.id`, `game.user.isGM`), when the
 * token's actor is a corpse (movement.mjs `isCorpse`: dead for the GMs, not a Monocub) and the move changed its corner,
 * height, floor or `hidden`, the current death's tile (`bodyTileOf`, the death read as the GMs hold it) on the token's own scene
 * goes to the token (`followedTile`). So a GM's drag and Stage 6's Move the body (cleanup.mjs `applyMoveBody`, a GM's
 * teleport) move the body with one hook; a Monocub's token walks away from its tile; a player's move of a corpse is vetoed
 * before it writes (movement.mjs `preUpdateToken`). A token on another scene than its tile (the hall's, in the trial)
 * moves nothing, and a body taken to another scene leaves its tile where it was (not handled: the GM handbook says so).
 * Two tiles of one death (two GMs publishing it at once) - the one `bodyTileOf` reads moves, the other stays. Answers the
 * tile's update, or null. Writes once per move; a GM moving several corpses at once writes one each (not measured:
 * LIVE-E63-04).
 */
export async function followBody(tokenDoc, changes, options, userId) {
    if (!game.user?.isGM || userId !== game.user.id) return null;
    if (!MOVED.some(key => key in (changes ?? {}))) return null;
    const actor = tokenDoc?.actor ?? null;
    // A Monocub's corpse beside the token it walks is a body too (E62 C3b fix; the e93 review's F3): a GM's move skips the
    // owner's veto (movement.mjs `onPreUpdateToken` returns for a GM first), so its tile follows it as any corpse's.
    if (!actor || !isCorpseToken(tokenDoc)) return null;
    const { flagsHeldNow } = await import("./sheet-audit.mjs");
    const body = bodyTileOf(actor, { held: flagsHeldNow });
    if (!body || body.scene?.id !== tokenDoc.parent?.id) return null;
    const patch = followedTile(body.doc, tokenDoc, changes, tokenDoc.level ?? null);
    if (!patch) return null;
    await body.scene.updateEmbeddedDocuments("Tile", [patch]);
    return patch;
}

/** The body's walk with its corpse (E63 C1; module.mjs `init`): `followBody` after every token update, never before. */
export function registerBodyFollow() {
    Hooks.on("updateToken", (tokenDoc, changes, options, userId) => {
        followBody(tokenDoc, changes, options, userId).catch(async err => (await import("./utils.mjs")).error("The body could not follow its token", err));
    });
}

/** The name the body's caption carries on its corpse's token (E95 C3's mark, on its tile until 13.11.2026): a redraw finds its own by it, and touches nothing else. */
export const BODY_MARK_NAME = "drpg-body-mark";

/** Every mark this file drew on `placeable`, taken off and destroyed but `keep`. */
function takeOffMarks(placeable, keep = null) {
    for (const child of (placeable?.children ?? []).filter(c => c?.name === BODY_MARK_NAME)) {
        if (child === keep) continue;
        placeable.removeChild(child);
        child.destroy?.({ children: true });
    }
}

/**
 * A BODY TILE DRAWS NOTHING (the owner's report of 13.11.2026; the header's THE TILE IS DATA). From E95 C3 until then a
 * flagged tile wore the dead status's picture over its centre and the caption "{name}'s body" under it, and beside the
 * corpse's own token and the Spectator's that made the third thing on the map. Now Foundry's `drawTile` and `refreshTile`
 * only take off a mark drawn before - a browser that loaded 1.2.112 and stayed open, or a tile redrawn - and answer null.
 * The caption is the corpse's token's (`drawCorpseCaption`). Tier 1 R5871.
 */
export function drawBodyMark(tile) {
    if (!tile || tile.destroyed || typeof tile.removeChild !== "function") return null;
    takeOffMarks(tile);
    return null;
}

/**
 * Whether `tokenDoc` is a body this browser captions: its actor's death is the table's (settings.mjs `deathRecord`, the
 * flag every browser holds - a death the GMs keep is captioned nowhere, as no tile was laid for one) and the token is
 * that death's corpse (movement.mjs `isCorpseToken`: the dead student's own token, or a Monocub's corpse beside the token
 * it walks - never the Monocub's walking token, `FLAGS.cubToken`, nor a Spectator's, whose actor is not the student).
 */
export function isCaptionedCorpse(tokenDoc) {
    const actor = tokenDoc?.actor ?? globalThis.game?.actors?.get?.(tokenDoc?.actorId) ?? null;
    if (!actor || !deathRecord(actor)) return false;
    return isCorpseToken(tokenDoc);
}

/**
 * THE BODY'S CAPTION, ON ITS TOKEN (the owner's report of 13.11.2026; DC6's label "Ciało: {imię}", E95 C3's caption moved
 * off the tile). Drawn over a token placeable (`token`, its document `token.document`) on every browser that draws it,
 * from Foundry's `drawToken` and `refreshToken` (`registerBodyMarks`): a display only, nothing written. The token wears
 * Foundry's dead overlay already (chapter.mjs `markDeceased` toggles it), so the caption alone is drawn: `DRPG.Body.tile`
 * ("{name}'s body" / "Ciało: {name}") with the student's name as this browser's actors hold it, in this browser's
 * language, over the token's top edge (the nameplate Foundry draws stands under it), at the size of the tunnel marks'
 * words (H81-06: `max(20, grid * 0.36)` over a keyline of `max(4, grid * 0.07)`), white over the ink keyline in both
 * themes. Which tokens: `isCaptionedCorpse`. A hidden token: on a GM's browser the caption at half alpha, on any other
 * none, and one drawn before it was hidden is taken off (E95 fix RV-5's rule, kept). No name: none.
 * ONCE PER REDRAW, AND NO CLICK. One container named `BODY_MARK_NAME`, keyed by its inputs: the same inputs keep it,
 * changed ones replace it, a token that is no captioned corpse any more (a revive, a Monocub's walking token) loses it.
 * `eventMode` "none" (E106's rule for every drawing the module lays on the map: the caption stands over the token, whose
 * double-click opens its sheet). The local coordinates (0, 0)-(w, h) are a Token placeable's as remembered from v12
 * (`token.w`, `token.h`, else the document's squares on the grid); how it sits over a real token is LIVE-E95-01's. `gm`
 * is handed in by tier 1 only. Answers the caption, or null where none is drawn. Tier 1 R3144, R5402, R5872.
 */
export function drawCorpseCaption(token, { actors = game.actors, gm = Boolean(game.user?.isGM) } = {}) {
    if (!token || token.destroyed || typeof token.addChild !== "function" || !globalThis.PIXI) return null;
    const doc = token.document ?? null;
    const shown = Boolean(doc) && !(doc.hidden && !gm) && isCaptionedCorpse(doc);
    const name = shown ? (actors?.get?.(doc.actorId)?.name ?? doc.actor?.name ?? "") : "";
    const grid = gridOf(doc?.parent);
    const width = Number(token.w) || (Number(doc?.width) || 1) * grid;
    const key = name ? JSON.stringify([name, width, grid, game.i18n?.lang ?? null]) : null;
    const kept = key ? ((token.children ?? []).find(c => c?.name === BODY_MARK_NAME && !c.destroyed && c.drpgKey === key) ?? null) : null;
    takeOffMarks(token, kept);
    if (!key) return null;
    const group = kept ?? new PIXI.Container();
    group.alpha = doc.hidden ? 0.5 : 1;
    if (kept) return kept;
    group.name = BODY_MARK_NAME;
    group.drpgKey = key;
    group.eventMode = "none";
    group.interactiveChildren = false;
    const text = new PIXI.Text(game.i18n.format("DRPG.Body.tile", { name }), {
        fontFamily: '"Special Elite", "Courier New", monospace',
        fontSize: Math.max(20, Math.round(grid * 0.36)),
        fill: 0xffffff,
        stroke: 0x1a1620,
        strokeThickness: Math.max(4, Math.round(grid * 0.07)),
        align: "center"
    });
    text.resolution = 2;
    text.anchor.set(0.5, 1);
    text.position.set(width / 2, -Math.round(grid * 0.05));
    group.addChild(text);
    token.addChild(group);
    return group;
}

/**
 * The body's caption on every browser (E95 C3; module.mjs `init`; moved onto the corpse's token on 13.11.2026): Foundry's
 * `drawToken` and `refreshToken` hand the Token placeable, `drawTile` and `refreshTile` the Tile placeable, as v12 and
 * v13 name them (not read on v14: LIVE-E95-01). Draws only: the caption on a corpse's token (`drawCorpseCaption`), and a
 * body tile's old mark taken off (`drawBodyMark`).
 */
export function registerBodyMarks() {
    Hooks.on("drawTile", tile => { drawBodyMark(tile); });
    Hooks.on("refreshTile", tile => { drawBodyMark(tile); });
    Hooks.on("drawToken", token => { drawCorpseCaption(token); });
    Hooks.on("refreshToken", token => { drawCorpseCaption(token); });
}
