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
 * death sign are drawn over it (E95 C3), not baked into the picture. HIDDEN AS THE TOKEN (E95 fix RV-3, 10.11.2026):
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
export function bodyPlaceOf(actor, { scenes = game.scenes ?? [], tokenPlace = gmPlaceOf, held = null } = {}) {
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
    const place = gmPlaceOf(actor);
    if (!place?.tokenDoc || !place.scene) {
        if (noTokenWarns(record)) ui.notifications?.warn(game.i18n.format("DRPG.Body.noToken", { name: actor.name }));
        return null;
    }
    const data = { ...bodyTileSpec({ tokenDoc: place.tokenDoc, actorId: actor.id, record, level: place.level, at }), ...floorFieldsOf(place.level) };
    const [tile] = await place.scene.createEmbeddedDocuments("Tile", [data]);
    return tile ?? null;
}

/**
 * Remove the body tiles of `actorId` from every scene, or every body tile when it is null, and answer how many (E95
 * C2; QUESTIONS Q7, Q8). GM only. `only`, a set of tile ids, narrows it to those (E95 fix RV-1: tier 2 runs the reset's
 * deaths entry on its own tiles alone, so a GM's suite at a table deletes no body the table holds). A revive takes the student's (chapter.mjs `reviveCharacter`: a student back alive
 * has no body), the season reset's deaths group every one (chapter.mjs `clearSeasonDeaths`), a body whose student is
 * gone from the world included. Stopping being a Monocub keeps the tile: the student is still dead. A tile with no
 * body flag is never touched.
 */
export async function removeBodyTiles(actorId = null, { only = null } = {}) {
    if (!game.user?.isGM) return 0;
    let removed = 0;
    for (const scene of game.scenes ?? []) {
        const ids = [...(scene?.tiles ?? [])].filter(doc => {
            const mark = markOf(doc);
            return mark && (actorId === null || mark.actorId === actorId) && (!only || only.has(doc.id));
        }).map(doc => doc.id);
        if (!ids.length) continue;
        await scene.deleteEmbeddedDocuments("Tile", ids);
        removed += ids.length;
    }
    return removed;
}

/** The name the body's mark carries on its tile (E95 C3): a redraw finds its own by it, and touches nothing else. */
export const BODY_MARK_NAME = "drpg-body-mark";

/** The dead status's picture as this browser has it (states.mjs `ownDeadIcon` may have put the module's on it). */
function deadIconOf() {
    const dead = (globalThis.CONFIG?.statusEffects ?? []).find(entry => entry?.id === "dead");
    return dead?.img ?? dead?.icon ?? globalThis.CONFIG?.controlIcons?.defeated ?? "icons/svg/skull.svg";
}

/**
 * THE BODY'S CAPTION AND DEATH SIGN (E95 C3, 10.11.2026; QUESTIONS Q4, the default: in E95). Until E72 the Monocub's
 * token keeps Foundry's `dead` overlay, so a tile with only the victim's picture beside it read as a second copy of the
 * same student; the caption says which one is the body. Drawn over a flagged tile placeable (`tile`, its document
 * `tile.document`) on every browser that draws it, from Foundry's `drawTile` and `refreshTile` (`registerBodyMarks`):
 * a display only - nothing is written, and a player's browser draws what its own copy of the tile and the actors hold
 * (a tile is laid only for a death already public, its name on the discovery's card).
 *   - the sign: the `dead` status's picture (`deadIconOf`), over the tile's centre at six tenths of its shorter side,
 *     at 0.85 alpha - the overlay a dead token wears, smaller, so the picture under it still reads;
 *   - the caption `DRPG.Body.tile` ("{name}'s body" / "Ciało: {name}") with the student's name as this browser's
 *     actors hold it, in this browser's language, under the tile's bottom edge at the size of the tunnel marks' words
 *     (H81-06, fog-doorways.mjs `addTunnelMarks`: `max(20, grid * 0.36)` over a keyline of `max(4, grid * 0.07)`):
 *     white over the ink keyline in both themes, as the map is not themed. No name (a student gone from the world):
 *     the sign alone;
 *   - a hidden tile: on a GM's browser the mark at half alpha; on any other browser no mark, and one drawn before it was
 *     hidden is taken off (E95 fix RV-5, 10.11.2026: the caption names the body, and whether Foundry v14 hides a hidden
 *     Tile placeable's children from a player was not read - LIVE-E95-01 item (4) - so it is not left to it). `gm` is
 *     handed in by tier 1 R3144 only.
 * ONCE PER REDRAW. Refresh runs often (a hover, a move), so the mark is one container named `BODY_MARK_NAME` with the
 * inputs it was drawn from as its key: the same inputs keep it (its alpha set again), changed ones replace it, and a
 * tile that lost its flag loses its mark. Answers the mark, or null where none is drawn. The sizes are chosen, not
 * measured; the local coordinates (0, 0)-(width, height) are Foundry's Tile placeable's as remembered from v12, and
 * whether a child of the placeable shows while the Tiles layer is not the one in use was not read: LIVE-E95-01. Tier 1
 * R3144 draws on a stub; Foundry's draw and refresh hooks are not in the harness.
 */
export function drawBodyMark(tile, { actors = game.actors, gm = Boolean(game.user?.isGM) } = {}) {
    if (!tile || tile.destroyed || typeof tile.addChild !== "function" || !globalThis.PIXI) return null;
    const doc = tile.document ?? null;
    const mark = doc?.hidden && !gm ? null : markOf(doc);
    const grid = gridOf(doc?.parent);
    const width = Number(doc?.width) || grid, height = Number(doc?.height) || grid;
    const name = mark ? (actors?.get?.(mark.actorId)?.name ?? "") : "";
    const icon = deadIconOf();
    const key = mark ? JSON.stringify([name, width, height, grid, game.i18n?.lang ?? null, icon]) : null;
    const drawn = (tile.children ?? []).filter(child => child?.name === BODY_MARK_NAME);
    const kept = drawn.find(child => !child.destroyed && child.drpgKey === key) ?? null;
    for (const child of drawn) {
        if (child === kept) continue;
        tile.removeChild(child);
        child.destroy?.({ children: true });
    }
    if (!mark) return null;
    const group = kept ?? new PIXI.Container();
    group.alpha = doc?.hidden ? 0.5 : 1;
    if (kept) return kept;
    group.name = BODY_MARK_NAME;
    group.drpgKey = key;
    const sign = PIXI.Sprite.from(icon);
    const side = Math.round(Math.min(width, height) * 0.6);
    sign.width = side;
    sign.height = side;
    sign.anchor.set(0.5, 0.5);
    sign.position.set(width / 2, height / 2);
    sign.alpha = 0.85;
    group.addChild(sign);
    if (name) {
        const text = new PIXI.Text(game.i18n.format("DRPG.Body.tile", { name }), {
            fontFamily: '"Special Elite", "Courier New", monospace',
            fontSize: Math.max(20, Math.round(grid * 0.36)),
            fill: 0xffffff,
            stroke: 0x1a1620,
            strokeThickness: Math.max(4, Math.round(grid * 0.07)),
            align: "center"
        });
        text.resolution = 2;
        text.anchor.set(0.5, 0);
        text.position.set(width / 2, height + Math.round(grid * 0.05));
        group.addChild(text);
    }
    tile.addChild(group);
    return group;
}

/**
 * The body's mark on every browser (E95 C3; module.mjs `init`): Foundry's `drawTile` and `refreshTile` hand the Tile
 * placeable, as v12 and v13 name them (not read on v14: LIVE-E95-01). Draws only (`drawBodyMark`).
 */
export function registerBodyMarks() {
    Hooks.on("drawTile", tile => { drawBodyMark(tile); });
    Hooks.on("refreshTile", tile => { drawBodyMark(tile); });
}
