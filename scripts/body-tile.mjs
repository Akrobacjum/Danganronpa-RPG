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
 * C0 is the readers and the tile's shape (`bodyTileSpec`), and no writer: E95 C2 lays the tile (`leaveBody`, from
 * monocub.mjs `setMonocub`) and removes it. Nothing here writes, so any browser may ask it, the player's included
 * (anonymity.mjs's greying asks the loot gate there): a tile is laid only for a death already public, and its flag says
 * nothing the `deceased` flag does not.
 *
 * WHICH TILE IS THE BODY. The current death's (`deathId` the `deceased` record's, so a student who died, came back and
 * died again is not read on the first death's tile a GM forgot), and of two the earliest laid (`at`): two GMs making
 * one Monocub at once can lay two (the stage's risk 4), and both readers then read one. A record with no `deathId`
 * matches a tile with none - the deaths written before deathId existed.
 *
 * THE TILE'S ROOM. By its centre on the floor its flag stores, through movement.mjs `roomAt`, the one hit test. A
 * tile's width and height are pixels and a token's are squares (Foundry's model as remembered, not read on v14:
 * LIVE-E95-02), and `roomAt` measures a centre as `width * grid`; so it is handed a stand-in of the tile's size in
 * squares on the tile's scene. The floor is the flag's, not the tile's own field, so the rule does not wait on what
 * v14 calls that field.
 *
 * Imports config.mjs, settings.mjs and movement.mjs only (tier 1 R3142), so frisk.mjs reads it with no cycle (R161).
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { deathRecord } from "./settings.mjs";
import { gmPlaceOf, roomAt } from "./movement.mjs";

/** A floor as an id: a Level document's, an id as it is, null for none. */
const floorId = level => level?.id ?? level ?? null;

/** The grid of `scene` as movement.mjs `regionsAt` reads it: the scene's, else the canvas's, else 100. */
const gridOf = scene => scene?.grid?.size ?? globalThis.canvas?.grid?.size ?? 100;

/**
 * Whether a death leaves a body on the map (QUESTIONS Q2, the default (a)): a record, whose `cause` is not "executed"
 * (trial-progress.mjs `carryOutSentence`, E70 C4) and whose phase is not the Class Trial - the rule chapter.mjs
 * `bodiesToDiscover` reads a body to find by. A record with no phase is a death that is no execution (the executed carry
 * both). DC6's "only the murdered" without a `cause: "murder"`: a GM who records a murder by hand records one the
 * module cannot tell from a ruling.
 */
export function isBodyDeath(record) {
    if (!record) return false;
    return record.cause !== "executed" && record.phase !== "classTrial";
}

/**
 * The data of the tile `tokenDoc` leaves as `actorId`'s body for `record` (pure; E95 C2 creates it): the token's corner,
 * its squares in pixels on its scene's grid, its height and its picture, unhidden, and the flag `{ actorId, deathId,
 * level, at }` - the floor as an id (`level` handed as an id or a Level), `at` epoch ms. The caption and the death sign
 * are drawn over it (E95 C3), not baked into the picture.
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
        hidden: false,
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
 * records (its `deathId`), the earliest laid of two. Null for a student the table does not know dead.
 */
export function bodyTileOf(actor, { scenes = game.scenes ?? [] } = {}) {
    const record = deathRecord(actor);
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
 * R3141 only.
 */
export function bodyPlaceOf(actor, { scenes = game.scenes ?? [], tokenPlace = gmPlaceOf } = {}) {
    const body = bodyTileOf(actor, { scenes });
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
