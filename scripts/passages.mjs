/**
 * Danganronpa RPG - the secret passages, as this browser may know them (E79, 1.2.79).
 * ---------------------------------------------------------------------------
 * A secret passage is a stretch of a wall that a character who knows it may pass - or, since E80
 * C1 (18.10.2026), a tunnel or stairs: two ends in two rooms of one scene, on one floor or two,
 * which no wall is cut for (a knower goes through by the GM's hand, E80 C2). Where it
 * is and who knows it are the GMs' (gm-stores.mjs `passageMapStore`, `passageAccessStore`);
 * a player's browser holds only its copy (`passageCopy`): the open passages this user's own
 * characters know, sent by the primary GM to this user alone (passages-gm.mjs
 * `pushPassageCopies`), and asked for at load and when a primary GM's world has loaded. A
 * GM's browser reads the GMs' records instead. Nothing here writes a document, a flag or a
 * setting but the copy's own key, and nothing of a passage is put in the page.
 *
 * A LEAF (the E79 plan's R560): it imports rooms.mjs, the GM stores, settings.mjs, utils.mjs
 * and config.mjs and nothing else - never movement.mjs, which reads it (C3), and not the
 * bridge, whose `replyForMe` rule the receiver below spells out with the primary GM's own.
 *
 * What a console on a player's browser can do with it: write its own copy, which changes only
 * what that browser cuts, draws and lists. The GMs' audit of every landed move, which C4 adds,
 * judges the walls from the GMs' records, not from any copy.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { primaryGmId, warn, error } from "./utils.mjs";
import { passageCopy, passageMapStore, passageAccessStore } from "./gm-stores.mjs";
import { levelOf } from "./rooms.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;
const isPlain = o => o !== null && typeof o === "object" && !Array.isArray(o);

/** How far, in pixels, a route may miss a passage's segment and still go through it (the plan's 1 px). */
export const PASSAGE_TOLERANCE = 1;

/** A row's segment, `{ id, wallId, x1, y1, x2, y2 }`, or null when its four numbers are not all finite. */
function segmentOf(id, row) {
    const seg = row?.passageSeg;
    const xy = ["x1", "y1", "x2", "y2"].map(k => Number(seg?.[k]));
    if (!xy.every(Number.isFinite)) return null;
    const [x1, y1, x2, y2] = xy;
    return { id, wallId: typeof row.passageWallId === "string" ? row.passageWallId : null, x1, y1, x2, y2 };
}

/**
 * A tunnel's two ends, `[{ x, y, level }, { x, y, level }]` - each a point of the scene and the floor it is on
 * (null on a scene with none) - or null when the row is no tunnel or an end is not two finite numbers (E80 C1).
 */
export function endsOf(row) {
    if (row?.shape !== "tunnel" || !Array.isArray(row.ends) || row.ends.length !== 2) return null;
    const ends = row.ends.map(end => ({ x: Number(end?.x), y: Number(end?.y), level: typeof end?.level === "string" && end.level ? end.level : null }));
    return ends.every(end => Number.isFinite(end.x) && Number.isFinite(end.y)) ? ends : null;
}

/** Whether a row is on this floor: no floor asked, a row on no floor in particular, or the floor's own id (rooms.mjs `onLevel`'s rule). */
function onLevelOf(row, level) {
    if (level === null || level === undefined || row?.level === null || row?.level === undefined) return true;
    return (level?.id ?? level) === row.level;
}

/**
 * Whether a row's scene is gone: looked up in `scenes` when one is handed (the suite's, R555), else in
 * this world's for the module's own records; an engine of the suite's own is of no world, and reads none.
 */
export function sceneGone(row, { map = passageMapStore, scenes } = {}) {
    const where = scenes ?? (map === passageMapStore ? game.scenes : null);
    return Boolean(where) && !where.has(row?.sceneId);
}

/**
 * The open passages of the GMs' records, `{ passageId: { sceneId, shape, level, passageWallId,
 * passageSeg, actorIds } }` - a tunnel's `{ sceneId, shape: "tunnel", level: null, ends, actorIds }`
 * (E80 C1: its row is on no floor in particular, each end on its own) -, each with every character that knows it: what a GM's browser reads
 * where a player's reads its copy, and what passages-gm.mjs cuts each copy from. `stores` is the
 * suite's (R554, R555): two handles of an engine of its own, and `scenes` beside them when it asks.
 *
 * A row whose scene was deleted is left out (`sceneGone`; the round-1 review's cor F6, 15.10.2026):
 * nothing watches a scene's deletion, so its rows stayed secret, were sent to their knowers for ever
 * and came back live with a Restore. Read here, on the reading side, a restored row needs nothing
 * more; the GMs still list it (passages-gm.mjs `listPassages`, marked `sceneGone`) and may delete it.
 */
export function secretRowsFrom({ map = passageMapStore, access = passageAccessStore, scenes } = {}) {
    const rows = {};
    for (const [id, row] of Object.entries(map.entries())) {
        if (row?.state !== "secret" || sceneGone(row, { map, scenes })) continue;
        const ends = endsOf(row);
        if (ends) {
            rows[id] = { sceneId: row.sceneId, shape: "tunnel", level: null, ends, actorIds: [] };
            continue;
        }
        if (row.shape === "tunnel" || !segmentOf(id, row)) continue;
        rows[id] = { sceneId: row.sceneId, shape: row.shape, level: row.level ?? null, passageWallId: row.passageWallId ?? null,
            passageSeg: { ...row.passageSeg }, actorIds: [] };
    }
    for (const key of Object.keys(access.entries())) {
        const [passageId, actorId] = key.split("/");
        if (actorId && Object.hasOwn(rows, passageId)) rows[passageId].actorIds.push(actorId);
    }
    return rows;
}

/** The secret passages this browser may know: on a GM's the GMs' open rows, on a player's its copy. */
export function knownPassages() {
    if (game.user?.isGM) return secretRowsFrom();
    const copy = passageCopy.read();
    return isPlain(copy) ? copy : {};
}

/**
 * The known passages on one scene, `[{ id, ...row }]`, on one floor when one is named (a row on no floor in
 * particular is on each). `known` is the suite's (R556): rows of its own in the copy's shape.
 */
export function secretRowsOn(sceneId, level = null, { known = knownPassages() } = {}) {
    return Object.entries(isPlain(known) ? known : {})
        .filter(([, row]) => row?.sceneId === sceneId && onLevelOf(row, level))
        .map(([id, row]) => ({ id, ...row }));
}

/**
 * The segments this character may pass on this scene and floor, `[{ id, wallId, x1, y1, x2, y2 }]`:
 * the rows it knows. The Mastermind knows every one (the owner's Q7): a player's copy already says
 * so, and a GM's browser, which reads the GMs' records, passes `mastermind` (passages-gm.mjs
 * `isMastermindActor`).
 */
export function openSegmentsFor(actor, sceneId, level = null, { mastermind = false, known = knownPassages() } = {}) {
    const actorId = typeof actor === "string" ? actor : actor?.id;
    if (!actorId) return [];
    return secretRowsOn(sceneId, level, { known })
        .filter(row => mastermind || (Array.isArray(row.actorIds) && row.actorIds.includes(actorId)))
        .map(row => segmentOf(row.id, row)).filter(Boolean);
}

/**
 * Every secret passage this character knows, on every scene, `[{ id, sceneId, level, x1, y1, x2, y2 }]`: the
 * sheet's 'Known passages' (E79 C7, sheet.mjs `knownPassageRows`). The rows that name it, or every row for the
 * Mastermind (`mastermind`, as `openSegmentsFor` takes it). The stretch is handed out so the list can ask which
 * rooms a passage joins, whether it is open and where to pan; the wall's id is not, and neither is anything
 * else of the row (R560: only the records' files name a passage's geometry). A tunnel (E80 C1) is
 * `{ id, sceneId, level: null, shape: "tunnel", ends }`: its two ends, which the list names by their rooms
 * and the mark of an end is drawn at. `known` is the suite's (R562).
 */
export function passagesKnownBy(actor, { mastermind = false, known = knownPassages() } = {}) {
    const actorId = typeof actor === "string" ? actor : actor?.id;
    if (!actorId) return [];
    const out = [];
    for (const [id, row] of Object.entries(isPlain(known) ? known : {})) {
        if (typeof row?.sceneId !== "string") continue;
        if (!mastermind && !(Array.isArray(row.actorIds) && row.actorIds.includes(actorId))) continue;
        const ends = endsOf(row);
        if (ends) {
            out.push({ id, sceneId: row.sceneId, level: null, shape: "tunnel", ends });
            continue;
        }
        const seg = row.shape === "tunnel" ? null : segmentOf(id, row);
        if (seg) out.push({ id, sceneId: row.sceneId, level: row.level ?? null, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 });
    }
    return out;
}

/**
 * Each end of a tunnel this character knows on this scene that is on `level` (an end on no floor in particular
 * is on each, and no floor asked is every floor), `[{ id, x, y, level, far: { x, y, level } }]` with the end
 * at the other side: where the mark of an end is drawn for its knowers (fog-doorways.mjs `tunnelMarks`, E80
 * C1) and where 'Go through' stands (C2). The rows that name it, or every tunnel for the Mastermind
 * (`mastermind`, as `openSegmentsFor` takes it). `known` is the suite's (R595).
 */
export function tunnelEndsFor(actor, sceneId, level = null, { mastermind = false, known = knownPassages() } = {}) {
    const actorId = typeof actor === "string" ? actor : actor?.id;
    if (!actorId || typeof sceneId !== "string") return [];
    const out = [];
    for (const row of secretRowsOn(sceneId, null, { known })) {
        if (!mastermind && !(Array.isArray(row.actorIds) && row.actorIds.includes(actorId))) continue;
        const ends = endsOf(row);
        if (!ends) continue;
        ends.forEach((end, i) => {
            if (onLevelOf(end, level)) out.push({ id: row.id, ...end, far: { ...ends[1 - i] } });
        });
    }
    return out;
}

/**
 * Whether one step of a route, from `a` to `b`, goes through a segment: the two lines cross with
 * the crossing on the step and on the segment, each stretched by `tolerance` pixels at both ends.
 * A step along the segment's own line never crosses it. Pure.
 */
export function stepCrosses(a, b, seg, tolerance = PASSAGE_TOLERANCE) {
    const rx = b.x - a.x, ry = b.y - a.y, sx = seg.x2 - seg.x1, sy = seg.y2 - seg.y1;
    const den = rx * sy - ry * sx;
    if (!den) return false;
    const qx = seg.x1 - a.x, qy = seg.y1 - a.y;
    const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
    const onStep = tolerance / (Math.hypot(rx, ry) || 1), onSeg = tolerance / (Math.hypot(sx, sy) || 1);
    return t >= -onStep && t <= 1 + onStep && u >= -onSeg && u <= 1 + onSeg;
}

/**
 * "passage" when a route - the token's centre, point after point - goes through a passage this
 * character may pass on this scene and floor, else null: the `via` the veto (C3) and the GMs'
 * audit (C4) hand the crossing's verdict.
 */
export function crossingVia(route, actor, sceneId, level = null, { mastermind = false } = {}) {
    const points = (Array.isArray(route) ? route : []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    if (points.length < 2) return null;
    const segments = openSegmentsFor(actor, sceneId, level, { mastermind });
    for (let i = 1; i < points.length; i++) {
        if (segments.some(seg => stepCrosses(points[i - 1], points[i], seg))) return "passage";
    }
    return null;
}

/* ------------------------------------------------------------------------------------------------------------
 * THE WAY THROUGH (E79 C2): this browser's move backend, cut where its own token may pass.
 *
 * Foundry asks one class whether a token's move meets a wall: `CONFIG.Canvas.polygonBackends.move`, a
 * ClockwiseSweepPolygon whose `_identifyEdges()` gathers the walls a move or a collision test reads - the
 * drag, the ruler, the keyboard and `testCollision` alike, as the design read Foundry 14.365 on 11.10.2026
 * (clockwise-sweep.mjs:228-288, edges/edge.mjs:23; not readable here; at a table: LIVE-E79-01). At `setup` this module
 * puts a subclass in its place, `PassageMovePolygon`, whose `_identifyEdges()` asks Foundry's first and then
 * replaces the edge of a passage's wall with the pieces of it on either side of the passage - for a move
 * polygon only, and only where the moving token's own character knows the passage. Sight, light and sound
 * are other polygons: none of them is cut, so a passage is a wall to every eye and every lamp.
 *
 * FAILS CLOSED, both ways. If the class cannot be extended at `setup` - another Foundry, another module's
 * class in the way - nothing is cut, the Debug log says so and a GM is told at every load
 * (`DRPG.Passage.engineOff`); and a cut that throws for one move leaves that move's walls whole. A passage
 * that does not open costs a player a moment at a wall the GM can walk them through; a wall that opened
 * for the wrong token is the secret gone.
 *
 * What it reads: this browser's own copy (`knownPassages`) - so a token passes only where this browser was
 * told its character may, and a console that writes its own copy changes only its own walls, which the
 * GMs' audit of every landed move judges from the GMs' records (C4). PATCHES (patches.mjs) has its row.
 * ------------------------------------------------------------------------------------------------------------ */

const PASSAGE_MARK = Symbol.for("drpgPassages");

/** A piece of a cut wall shorter than this, in pixels, is left out (the design's 0.5 px): no sliver of wall stands in a passage's mouth. */
const SLIVER = 0.5;

/**
 * What is left of a wall, `{ x1, y1, x2, y2 }`, once the stretches `open` are taken out of it:
 * `[{ x1, y1, x2, y2 }]` in the wall's own direction, none when the passages cover all of it - or
 * null when no stretch lies on this wall, so the caller keeps the wall as it is. A stretch counts
 * only where both its ends are within `tolerance` pixels of the wall's line (a wall moved since the
 * passage was made is not cut: C5 marks that passage broken); the part of it past the wall's ends
 * is ignored. Pieces under half a pixel are dropped. Pure.
 */
export function cutSegment(wall, open, tolerance = PASSAGE_TOLERANCE) {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy);
    if (!(len > 0)) return null;
    const along = (x, y) => ((x - wall.x1) * dx + (y - wall.y1) * dy) / (len * len);
    const away = (x, y) => Math.abs((x - wall.x1) * dy - (y - wall.y1) * dx) / len;
    const gaps = [];
    for (const seg of Array.isArray(open) ? open : []) {
        const xy = [seg?.x1, seg?.y1, seg?.x2, seg?.y2].map(Number);
        if (!xy.every(Number.isFinite)) continue;
        if (away(xy[0], xy[1]) > tolerance || away(xy[2], xy[3]) > tolerance) continue;
        const [t1, t2] = [along(xy[0], xy[1]), along(xy[2], xy[3])].sort((a, b) => a - b);
        const from = Math.max(0, t1), to = Math.min(1, t2);
        if (to > from) gaps.push([from, to]);
    }
    if (!gaps.length) return null;
    gaps.sort((a, b) => a[0] - b[0]);
    const pieces = [];
    let at = 0;
    for (const [from, to] of gaps) {
        if (from > at) pieces.push([at, from]);
        at = Math.max(at, to);
    }
    if (at < 1) pieces.push([at, 1]);
    return pieces.filter(([a, b]) => (b - a) * len >= SLIVER).map(([a, b]) => ({
        x1: wall.x1 + a * dx, y1: wall.y1 + a * dy, x2: wall.x1 + b * dx, y2: wall.y1 + b * dy
    }));
}

/**
 * The stretches a move polygon may pass, `[{ id, wallId, x1, y1, x2, y2 }]`: those its caller hands
 * in as `config.drpgPassages` (the frame's question, C3), else those the moving token's own character
 * knows on the token's own scene and floor - `config.source.object` is the token whose move Foundry is
 * testing. No token, no character: nothing (a doorway's test in fog-doorways.mjs names none). The
 * Mastermind's token passes every passage on its player's browser because the copy names the
 * Mastermind as each one's knower (passages-gm.mjs `passageCopyFor`). On a GM's browser the GMs'
 * records name each knower, and the Mastermind passes only what it was granted: the Mastermind is
 * passages-gm.mjs's to tell (`isMastermindActor`), which this leaf does not import.
 *
 * A Monokuma's token passes every open passage on a GM's browser (`gm`, the suite's to hand; R556):
 * the goal lets Monokuma use every one and the GMs' audit lets its moves stand (movement-audit.mjs),
 * but until the round-1 review's G5 (15.10.2026) no browser cut one for it. A Monokuma is the GMs'
 * (despair.mjs `monokumas`), so no player's copy names it and a player's browser opens nothing for
 * it. The flag is read as monokuma.mjs `isMonokuma` reads it, from this leaf's own config.mjs: the
 * leaf imports no more (R560). Whether Foundry 14 holds a GM's own drag to the walls at all is not
 * measured here (foundryvtt.com cannot be read from this machine): LIVE-E79-08.
 */
export function passageSegmentsFor(config, { known, gm = game.user?.isGM } = {}) {
    if (Array.isArray(config?.drpgPassages)) {
        return config.drpgPassages.map(seg => segmentOf(seg?.id ?? null, { passageWallId: seg?.wallId, passageSeg: seg }))
            .filter(seg => seg?.wallId);
    }
    const tokenDoc = config?.source?.object?.document ?? null;
    const actor = tokenDoc?.actor ?? null, sceneId = tokenDoc?.parent?.id ?? null;
    if (!actor || !sceneId) return [];
    const level = config.level ?? levelOf(tokenDoc);
    const monokuma = Boolean(gm) && Boolean(actor.getFlag?.(MODULE_ID, FLAGS.monokuma));
    return openSegmentsFor(actor, sceneId, level, { mastermind: monokuma, ...(known === undefined ? {} : { known }) });
}

/* The first cut that threw is logged, once a load: the next moves fail closed in silence. */
let cutFailed = false;

/**
 * Cut a move polygon's walls where its token may pass: each edge of a passage's wall (the edge whose
 * id is the wall's) is replaced by what `cutSegment` leaves of it, each a new edge of the same class
 * with the same fields, `<wallId>#p1`, `#p2`, ..., and none of the old edge's intersections. Every
 * other polygon - sight, light, sound - and every other wall is left as Foundry built it. The new
 * edges are all made before any old one is taken out, so a throw leaves the polygon whole. Answers
 * how many walls were cut. `known` and `gm` are the suite's (R556).
 */
export function clipPassages(polygon, { known, gm } = {}) {
    const config = polygon?.config, edges = polygon?.edges;
    if (config?.type !== "move" || typeof edges?.delete !== "function" || typeof edges?.add !== "function") return 0;
    try {
        const byWall = new Map();
        for (const seg of passageSegmentsFor(config, { known, ...(gm === undefined ? {} : { gm }) })) byWall.set(seg.wallId, [...(byWall.get(seg.wallId) ?? []), seg]);
        if (!byWall.size) return 0;
        const swaps = [];
        for (const edge of edges) {
            const open = byWall.get(edge?.id);
            if (!open || !edge.a || !edge.b) continue;
            const pieces = cutSegment({ x1: edge.a.x, y1: edge.a.y, x2: edge.b.x, y2: edge.b.y }, open);
            if (!pieces) continue;
            const { object, type, direction, light, move, sight, sound, threshold } = edge;
            swaps.push([edge, pieces.map((p, i) => new edge.constructor({ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 },
                { id: `${edge.id}#p${i + 1}`, object, type, direction, light, move, sight, sound, threshold }))]);
        }
        for (const [edge, fresh] of swaps) {
            edges.delete(edge);
            for (const piece of fresh) edges.add(piece);
        }
        return swaps.length;
    } catch (err) {
        if (!cutFailed) warn("Secret passages: a wall could not be cut for a move, so it stays whole", err);
        cutFailed = true;
        return 0;
    }
}

/** `Base` with the passages cut out of what its `_identifyEdges()` gathers: the class `installPassageMovement` puts in Foundry's place. */
export function passageMovePolygon(Base) {
    class PassageMovePolygon extends Base {
        _identifyEdges(...args) {
            const found = super._identifyEdges(...args);
            clipPassages(this);
            return found;
        }
    }
    PassageMovePolygon[PASSAGE_MARK] = true;
    PassageMovePolygon.prototype._identifyEdges[PASSAGE_MARK] = true;
    return PassageMovePolygon;
}

/**
 * Put `PassageMovePolygon` in `backends.move`'s place, over whatever class stands there (another
 * module's included). Answers whether the move backend cuts the passages now: false, changing nothing,
 * when there is no class or it has no `_identifyEdges()` to extend, or the place cannot be written. A
 * class that is already ours, or a subclass of it, is left alone. `backends` is the suite's (R556);
 * the module's is Foundry's, at `setup`.
 */
export function installPassageMovement(backends) {
    const Base = backends?.move;
    if (typeof Base !== "function" || typeof Base.prototype?._identifyEdges !== "function") return false;
    if (Base[PASSAGE_MARK]) return true;
    try {
        const Passage = passageMovePolygon(Base);
        backends.move = Passage;
        return backends.move === Passage;
    } catch {
        return false;
    }
}

/* Whether this browser's move backend cuts the passages: null until `setup`, then the install's answer. */
let movementCut = null;

/** At `setup`: the move backend's install, logged when it could not be made. */
export function registerPassageMovement() {
    movementCut = installPassageMovement(CONFIG?.Canvas?.polygonBackends);
    if (!movementCut) warn("Secret passages: Foundry's move backend could not be extended, so no token passes through one on this browser");
}

/** The key a GM is told at load when the move backend could not be extended, or null: nobody else, and nothing when it was. */
export function engineOffNotice({ cut = movementCut, user = game.user } = {}) {
    return cut === false && user?.isGM ? "DRPG.Passage.engineOff" : null;
}

/**
 * The part of a copy's stamps that stamps the Mastermind's every open passage, on the copy of the owner the
 * door names and of an owner it named before (passages-gm.mjs `passageCopyFor`, since E79 fix r2-G2): no
 * actor's id is four letters long (Foundry's are sixteen), so no row can name it.
 */
export const DOOR_PART = "door";

/**
 * A packet's copy, kept to what a copy may hold: rows of this world's scenes with a whole segment
 * and the shape "wall", or the shape "tunnel" and two whole ends (E80 C1; until then a tunnel was
 * dropped here), and only characters the packet's stamps name - each of
 * this world - so a row naming nobody of this user is left out. Two parts that are no character
 * are kept, and no row can name either: "", the stamp of a copy for a user who owns no student, and
 * `DOOR_PART` (passages-gm.mjs `passageCopyFor`). Until review round 3 (17.10.2026, cor A, run by
 * the reviewer in scenario 76 G) the second was dropped here, so the door owner's copy was weighed
 * on the parts that had not moved - the student's own, stamped 0 when nobody had given it a passage -
 * and refused: p2, whom the door named, listed and passed none of the passages the GMs' audit let
 * the Mastermind through. `actors` and `scenes` are the suite's to hand (R555); this world's otherwise.
 */
export function cleanCopy(passages, stamps, { actors = game.actors, scenes = game.scenes } = {}) {
    const value = {}, own = {};
    for (const [actorId, s] of Object.entries(isPlain(stamps) ? stamps : {})) {
        if (actorId === "" || actorId === DOOR_PART || actors?.has(actorId)) own[actorId] = Number(s) || 0;
    }
    for (const [id, row] of Object.entries(isPlain(passages) ? passages : {})) {
        const ends = endsOf(row);
        const seg = ends || row?.shape !== "wall" ? null : segmentOf(id, row);
        if ((!ends && !seg) || typeof row.sceneId !== "string" || !scenes?.has(row.sceneId)) continue;
        const actorIds = Array.isArray(row.actorIds) ? [...new Set(row.actorIds.filter(a => typeof a === "string" && a && a !== DOOR_PART && Object.hasOwn(own, a)))] : [];
        if (!actorIds.length) continue;
        if (ends) {
            value[id] = { sceneId: row.sceneId, shape: "tunnel", level: null, ends, actorIds };
            continue;
        }
        value[id] = { sceneId: row.sceneId, shape: "wall", level: typeof row.level === "string" ? row.level : null,
            passageWallId: seg.wallId, passageSeg: { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 }, actorIds };
    }
    return { value, stamps: own };
}

/* The GM whose world this browser was last told has loaded (gm-bridge.mjs `drpgPrimaryReady`): counted as
   connected when the primary is worked out, since its answer can come before this browser sees it connect, and
   forgotten when it leaves (since E79 C8, 1.2.79). Kept after it left, it named a GM that was gone: 65 X (15.10.2026)
   measured every player refusing the primary's copy as "not sent by the primary GM" once a GM that sorts first had
   loaded and left in phase U, until the player reloaded. */
let arriving = null;

/** That GM, for the other word only the primary GM sends this browser (movement-audit.mjs `sentBackRefusal`, since E79 fix r1-G1). */
export function arrivingPrimary() {
    return arriving;
}

/**
 * Why a packet of passages is not this browser's to take, or null when it is: it must be addressed
 * to this user and sent by a GM (`replyForMe`'s rule, bridge-guards.mjs) that is the primary GM - so
 * another player cannot hand this browser a passage, and neither can a GM whose browser is not the
 * one that keeps the copies. `me`, `users` and `primary` are the suite's to hand (R555).
 */
export function passageRowsRefusal(payload, senderId, { me = game.user, users = game.users, primary = primaryGmId({ arriving }) } = {}) {
    if (me?.isGM) return "a GM's browser keeps no copy";
    if (payload?.userId !== me?.id) return "addressed to somebody else";
    if (!users?.get(senderId)?.isGM) return "not sent by a GM";
    if (senderId !== primary) return "not sent by the primary GM";
    return null;
}

/** Player: take the primary GM's copy of this user's passages, where `passageRowsRefusal` has nothing against it. Answers whether it was taken. */
export async function onPassageRows(payload, senderId) {
    if (payload?.action !== "passage.rows" || passageRowsRefusal(payload, senderId)) return false;
    const { value, stamps } = cleanCopy(payload.passages, payload.stamps);
    return passageCopy.receive(value, stamps);
}

/** Player: ask the primary GM for this user's copy. The ask names nothing: the GM answers about Foundry's sender. */
export function requestPassages(primary = primaryGmId({ arriving })) {
    if (!primary || game.user?.isGM) return false;
    try {
        game.socket.emit(SOCKET_EVENT, { action: "passage.request" }, { recipients: [primary] });
        return true;
    } catch (err) {
        error("Could not ask the GM for this browser's secret passages", err);
        return false;
    }
}

/** At ready, on a player's browser: the copy's listener, and its ask - now and whenever a primary GM's world has loaded. */
export function registerPassages() {
    Hooks.once("ready", () => {
        const off = engineOffNotice();
        if (off) ui.notifications.warn(game.i18n.localize(off));
        if (game.user.isGM) return;
        game.socket.on(SOCKET_EVENT, (payload, senderId) => {
            onPassageRows(payload, senderId).catch(err => error("Could not keep this browser's secret passages", err));
        });
        requestPassages();
        Hooks.on("drpgPrimaryReady", primary => {
            arriving = primary ?? null;
            requestPassages(primaryGmId({ arriving }));
        });
        Hooks.on("userConnected", (user, connected) => {
            if (!connected && user?.id === arriving) arriving = null;
        });
    });
}
