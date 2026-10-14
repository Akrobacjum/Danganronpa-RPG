/**
 * Danganronpa RPG - the secret passages, as this browser may know them (E79, 1.2.78).
 * ---------------------------------------------------------------------------
 * A secret passage is a stretch of a wall that a character who knows it may pass. Where it
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

import { MODULE_ID } from "./config.mjs";
import { primaryGmId, error } from "./utils.mjs";
import { passageCopy, passageMapStore, passageAccessStore } from "./gm-stores.mjs";

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

/** Whether a row is on this floor: no floor asked, a row on no floor in particular, or the floor's own id (rooms.mjs `onLevel`'s rule). */
function onLevelOf(row, level) {
    if (level === null || level === undefined || row?.level === null || row?.level === undefined) return true;
    return (level?.id ?? level) === row.level;
}

/**
 * The open passages of the GMs' records, `{ passageId: { sceneId, shape, level, passageWallId,
 * passageSeg, actorIds } }`, each with every character that knows it: what a GM's browser reads
 * where a player's reads its copy, and what passages-gm.mjs cuts each copy from. `stores` is the
 * suite's (R554, R555): two handles of an engine of its own.
 */
export function secretRowsFrom({ map = passageMapStore, access = passageAccessStore } = {}) {
    const rows = {};
    for (const [id, row] of Object.entries(map.entries())) {
        if (row?.state !== "secret" || !segmentOf(id, row)) continue;
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

/** The known passages on one scene, `[{ id, ...row }]`, on one floor when one is named (a row on no floor in particular is on each). */
export function secretRowsOn(sceneId, level = null) {
    return Object.entries(knownPassages())
        .filter(([, row]) => row?.sceneId === sceneId && onLevelOf(row, level))
        .map(([id, row]) => ({ id, ...row }));
}

/**
 * The segments this character may pass on this scene and floor, `[{ id, wallId, x1, y1, x2, y2 }]`:
 * the rows it knows. The Mastermind knows every one (the owner's Q7): a player's copy already says
 * so, and a GM's browser, which reads the GMs' records, passes `mastermind` (passages-gm.mjs
 * `isMastermindActor`).
 */
export function openSegmentsFor(actor, sceneId, level = null, { mastermind = false } = {}) {
    const actorId = typeof actor === "string" ? actor : actor?.id;
    if (!actorId) return [];
    return secretRowsOn(sceneId, level)
        .filter(row => mastermind || (Array.isArray(row.actorIds) && row.actorIds.includes(actorId)))
        .map(row => segmentOf(row.id, row)).filter(Boolean);
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

/**
 * A packet's copy, kept to what a copy may hold: rows of this world's scenes with a whole segment,
 * the shape "wall" (a tunnel is E80's), and only characters the packet's stamps name - each of
 * this world - so a row naming nobody of this user is left out.
 */
function cleanCopy(passages, stamps) {
    const value = {}, own = {};
    for (const [actorId, s] of Object.entries(isPlain(stamps) ? stamps : {})) {
        if (game.actors?.has(actorId)) own[actorId] = Number(s) || 0;
    }
    for (const [id, row] of Object.entries(isPlain(passages) ? passages : {})) {
        const seg = segmentOf(id, row);
        if (!seg || row.shape !== "wall" || typeof row.sceneId !== "string" || !game.scenes?.has(row.sceneId)) continue;
        const actorIds = Array.isArray(row.actorIds) ? [...new Set(row.actorIds.filter(a => typeof a === "string" && Object.hasOwn(own, a)))] : [];
        if (!actorIds.length) continue;
        value[id] = { sceneId: row.sceneId, shape: "wall", level: typeof row.level === "string" ? row.level : null,
            passageWallId: seg.wallId, passageSeg: { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 }, actorIds };
    }
    return { value, stamps: own };
}

/* The GM whose world this browser was last told has loaded (gm-bridge.mjs `drpgPrimaryReady`): counted as
   connected when the primary is worked out, since its answer can come before this browser sees it connect. */
let arriving = null;

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
        if (game.user.isGM) return;
        game.socket.on(SOCKET_EVENT, (payload, senderId) => {
            onPassageRows(payload, senderId).catch(err => error("Could not keep this browser's secret passages", err));
        });
        requestPassages();
        Hooks.on("drpgPrimaryReady", primary => {
            arriving = primary ?? null;
            requestPassages(primaryGmId({ arriving }));
        });
    });
}
