/**
 * Danganronpa RPG - the GMs' audit of a player's move through a wall (E79 C4, 1.2.78).
 * ---------------------------------------------------------------------------
 * A player's browser stops its own token at a wall: Foundry's move backend, cut where the
 * character knows a secret passage (passages.mjs, C2). A console steps past that browser, so the
 * primary GM reads every move of a student's token by a player as it lands, against the walls of
 * the token's own scene (`auditMove`): the same rule for an ordinary wall and for a passage's wall,
 * the passages the character knows read from the GMs' records, never from a player's copy. What
 * it finds is a row in the Debug log (`moveAudit` "log", the default - the plan's AM-1) or the token
 * put back where the GM last saw it, its player told and the GMs warned ("sendBack").
 *
 * ONE CALL SITE (R560): movement.mjs `noteGmPosition`, on the primary GM, before `gmSeen` moves -
 * so the start of the route is where the GM last saw the token, never a field of the update. The
 * readers it needs from movement.mjs are handed in (`ctx`): this file is imported by movement.mjs
 * and does not import it back (R161).
 *
 * Its own geometry repeats Foundry's rule for a wall as far as the plan names it (risk K1-K3):
 * a wall that does not restrict movement, an open door, a one-way wall seen from its open side,
 * and the floors; Foundry's own source was not read for it, and the audit in "log" mode at a table,
 * with a GM on another scene and with floors, is LIVE-E79-02. E17
 * extends `auditMove` (and decides the default) rather than writing a second audit.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { warn, error, esc, whisperToGms, primaryGmId } from "./utils.mjs";
import { isMoveChange, levelOf, onLevel, isPlaceScene } from "./rooms.mjs";
import { openSegmentsFor, cutSegment, stepCrosses } from "./passages.mjs";
import { isMastermindActor } from "./passages-gm.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { playSfx } from "./sfx.mjs";

const SOCKET_EVENT = `module.${MODULE_ID}`;

/** The codes a `move.sentBack` may carry: a wall, the one thing the audit sends a token back for. */
const SENT_BACK_CODES = new Set(["wall"]);

/**
 * Where this browser's audit put a token back from, by token id: `{ x, y, level, at }`, a minute's worth.
 * The GMs' record of the token (`recentPositions`) holds that spot too - the GM saw the token there,
 * through the wall - so without this a REVERT the player writes back to it within the minute would be
 * a send-back `sendBackRefusal` accepts (found while writing scenario 76 D, 14.10.2026; R559 and 76 D
 * read that REVERT put back, headless; not read at a table).
 */
const putBackFrom = new Map();
const PUT_BACK_MS = 60_000;

/** Foundry's `orient2dFast`: > 0 one side of a -> b, < 0 the other, 0 on its line. */
const orient = (a, b, c) => (a.y - c.y) * (b.x - c.x) - (a.x - c.x) * (b.y - c.y);

/**
 * Whether a one-way wall lets a step from `origin` through: Foundry's rule as the plan reads it - a
 * wall with a direction (`dir` 1 LEFT, 2 RIGHT) is no wall to a step that starts on the side it
 * names (`orient2dFast` < 0 is LEFT, > 0 RIGHT). Not read in v14's source.
 */
function oneWayOpen(wall, origin) {
    const dir = Number(wall.dir ?? 0);
    if (!dir) return false;
    const side = orient({ x: wall.c[0], y: wall.c[1] }, { x: wall.c[2], y: wall.c[3] }, origin);
    return side !== 0 && (side < 0 ? 1 : 2) === dir;
}

/** Whether the step a -> b crosses the piece p: its ends strictly on both sides of the piece's line, the piece's ends not both on one side of the step. */
function crosses(a, b, p) {
    const p1 = { x: p.x1, y: p.y1 }, p2 = { x: p.x2, y: p.y2 };
    return orient(p1, p2, a) * orient(p1, p2, b) < 0 && orient(a, b, p1) * orient(a, b, p2) <= 0;
}

/** A spot's centre for this token, `{ x, y }` its top-left corner, measured with its own scene's grid (movement.mjs `centresOf`'s rule). */
function centreOf(tokenDoc, spot) {
    const size = tokenDoc?.parent?.grid?.size ?? 100;
    return { x: Number(spot?.x) + ((tokenDoc?.width ?? 1) * size) / 2, y: Number(spot?.y) + ((tokenDoc?.height ?? 1) * size) / 2 };
}

/**
 * The route the GM judges, top-left corners: where the GM last saw the token (`was`), the waypoints
 * this move passed, and where it stands now. The waypoints are the mover's (`tokenDoc.movement`, a
 * field of v14's move not modelled by the harness, where the route is the straight step): a route
 * through them that crosses no wall ends where a lawful walk ends, so a claimed one can only make a
 * move refused, never let a wall through. Only those after the last that stands where `was` stands.
 */
function routeOf(tokenDoc, was) {
    const passed = Array.isArray(tokenDoc.movement?.passed?.waypoints) ? tokenDoc.movement.passed.waypoints : [];
    const points = passed.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    const from = points.findLastIndex(p => p.x === was.x && p.y === was.y);
    return [was, ...points.slice(from + 1), { x: tokenDoc.x, y: tokenDoc.y }];
}

/**
 * The first wall the route crosses, `{ wall, passage }`, or null: each step's centres against every
 * wall of the token's scene on the floor it set out from that restricts movement and is not an open
 * door or a one-way wall seen from its open side, a passage's wall cut where this character may pass
 * (`open`). `passage` names a secret passage on that wall whose stretch the step crosses, for the log
 * row alone: the result is the same either way.
 */
function firstWallCrossed(tokenDoc, route, level, open, secret) {
    const walls = Array.from(tokenDoc.parent?.walls ?? []).filter(wall => onLevel(wall, level));
    const centres = route.map(spot => centreOf(tokenDoc, spot));
    for (let i = 1; i < centres.length; i++) {
        const a = centres[i - 1], b = centres[i];
        for (const wall of walls) {
            const c = Array.isArray(wall?.c) ? wall.c.map(Number) : [];
            if (c.length < 4 || !c.every(Number.isFinite)) continue;
            if (Number(wall.move ?? 20) === 0) continue;
            if (Number(wall.door ?? 0) > 0 && Number(wall.ds) === 1) continue;
            if (oneWayOpen(wall, a)) continue;
            const whole = { x1: c[0], y1: c[1], x2: c[2], y2: c[3] };
            const pieces = cutSegment(whole, open.filter(seg => seg.wallId === wall.id)) ?? [whole];
            if (!pieces.some(piece => crosses(a, b, piece))) continue;
            const passage = secret.find(seg => seg.wallId === wall.id && stepCrosses(a, b, seg))?.id ?? null;
            return { wall: wall.id ?? null, passage };
        }
    }
    return null;
}

/**
 * Judge one landed move of a token on the primary GM, and act on a wall it went through: `ctx` holds
 * movement.mjs's readers (`REVERT`, `SENT_BACK`, `history`, `sendBackRefusal`, `stairLinks`,
 * `roomAt`, `held`, `sendBack`) and, for the suite (R559), `mode`, `users`, `known`, `mastermind`,
 * `socket`, `whisper`, `warn`, `putBackFrom` and `now`. Answers `{ verdict, why?, wall?, passage?, mode? }`: "skip" for a
 * move it does not judge, "exempt", "clear" or "crossed". Every exemption is the GM's own reading -
 * the hook's user, the GMs' record of the token, the stairs on the map, the flags as the GMs hold
 * them - and none is an option of the update: a REVERT is exempt only where `sendBackRefusal`
 * accepts it, at a spot this audit did not put the token back from, and Foundry's teleport and displace are moves like any other. Fails open: a throw is
 * an error row and nothing else.
 */
export function auditMove(tokenDoc, changes, options, userId, was, ctx = {}) {
    try {
        const { REVERT, SENT_BACK } = ctx;
        const actor = tokenDoc?.actor ?? null;
        const scene = tokenDoc?.parent ?? null;
        if (!isMoveChange(changes) || !actor || actor.type !== "character" || !scene) return { verdict: "skip", why: "not a student's move" };
        if ((ctx.users ?? game.users)?.get(userId)?.isGM) return { verdict: "exempt", why: "a GM's move" };
        if (isMonokuma((ctx.held ?? (a => a))(actor))) return { verdict: "exempt", why: "Monokuma" };
        if (!isPlaceScene(scene)) return { verdict: "skip", why: "no rooms" };
        if (!was) return { verdict: "skip", why: "never seen" };
        const marks = ctx.putBackFrom ?? putBackFrom, now = ctx.now ?? Date.now();
        if (options?.[REVERT] || options?.[SENT_BACK]) {
            const spot = { x: tokenDoc.x, y: tokenDoc.y, elevation: tokenDoc.elevation ?? 0, level: tokenDoc.level ?? undefined };
            // A spot this audit put the token back from is no place it stood lawfully a moment ago.
            const sentFrom = (marks.get(tokenDoc.id) ?? []).filter(m => now - m.at <= PUT_BACK_MS);
            const history = (ctx.history ?? []).filter(h => !sentFrom.some(m => m.x === h.x && m.y === h.y && (m.level ?? undefined) === (h.level ?? undefined)));
            if (!ctx.sendBackRefusal(spot, { scene, history })) return { verdict: "exempt", why: "a send-back the GM accepts" };
        }
        const from = was.level ?? null, to = levelOf(tokenDoc);
        if (from !== to) {
            const pair = [ctx.roomAt(was.x, was.y, tokenDoc, from), ctx.roomAt(tokenDoc.x, tokenDoc.y, tokenDoc, to)].sort();
            if (pair.every(Boolean) && (ctx.stairLinks(scene) ?? []).some(link => link[0] === pair[0] && link[1] === pair[1])) {
                return { verdict: "exempt", why: "the stairs" };
            }
        }
        const known = ctx.known ? { known: ctx.known } : {};
        const mastermind = Boolean((ctx.mastermind ?? isMastermindActor)(actor));
        const open = openSegmentsFor(actor, scene.id, from, { mastermind, ...known });
        const secret = openSegmentsFor(actor, scene.id, from, { mastermind: true, ...known });
        const found = firstWallCrossed(tokenDoc, routeOf(tokenDoc, was), from, open, secret);
        if (!found) return { verdict: "clear" };

        const mode = ctx.mode ?? game.settings.get(MODULE_ID, SETTINGS.moveAudit);
        const sending = mode === "sendBack";
        (ctx.warn ?? warn)(`A player's move took a token through a wall (${sending ? "sent back" : "noted"})`,
            { token: tokenDoc.id, actor: actor.id, user: userId ?? null, scene: scene.id, wall: found.wall, passage: found.passage, mode: sending ? "sendBack" : "log" });
        if (!sending) return { verdict: "crossed", ...found, mode: "log" };

        const socket = ctx.socket ?? game.socket;
        marks.set(tokenDoc.id, [...(marks.get(tokenDoc.id) ?? []).filter(m => now - m.at <= PUT_BACK_MS),
            { x: tokenDoc.x, y: tokenDoc.y, level: tokenDoc.level ?? undefined, at: now }]);
        ctx.sendBack(tokenDoc, was, {
            sound: false,
            // The mover is told once the token stands back where it was, so its line names that room.
            landed: wrote => {
                if (!wrote || !userId) return;
                socket.emit(SOCKET_EVENT, { action: "move.sentBack", userId, sceneId: scene.id, tokenId: tokenDoc.id, code: "wall" }, { recipients: [userId] });
            }
        });
        const name = actor.name ?? tokenDoc.name ?? "";
        (ctx.whisper ?? whisperToGms)(`<p class="drpg-warning" data-drpg-wall="${esc(tokenDoc.id)}">${esc(game.i18n.format("DRPG.Movement.wallCrossed", { name, scene: scene.name ?? "" }))}</p>`)
            ?.catch?.(err => error("Could not tell the GMs of a token sent back through a wall", err));
        return { verdict: "crossed", ...found, mode: "sendBack" };
    } catch (err) {
        error(`Could not audit the move of "${tokenDoc?.name}"`, err);
        return { verdict: "skip", why: "failed" };
    }
}

/**
 * Why a `move.sentBack` is not this browser's to take, or null: addressed to this user, sent by the
 * primary GM (passages.mjs `passageRowsRefusal`'s rule), and naming a code it knows. `me`, `users`
 * and `primary` are the suite's to hand.
 */
export function sentBackRefusal(payload, senderId, { me = game.user, users = game.users, primary = primaryGmId() } = {}) {
    if (me?.isGM) return "a GM's browser is not told";
    if (payload?.userId !== me?.id) return "addressed to somebody else";
    if (!users?.get(senderId)?.isGM) return "not sent by a GM";
    if (senderId !== primary) return "not sent by the primary GM";
    if (!SENT_BACK_CODES.has(payload?.code)) return "an unknown code";
    return null;
}

/**
 * Player: the primary GM put this user's token back from a wall - the refusal's sound and the veto's
 * line, naming the room it stands in. Answers whether it was taken; a refusal is a Debug log row.
 */
export async function onSentBack(payload, senderId) {
    if (payload?.action !== "move.sentBack") return false;
    const refused = sentBackRefusal(payload, senderId);
    if (refused) {
        warn(`A token's send-back was not taken: ${refused}`);
        return false;
    }
    const token = game.scenes?.get(payload.sceneId)?.tokens?.get(payload.tokenId) ?? null;
    const { roomOfToken } = await import("./movement.mjs");
    const from = (token && roomOfToken(token)) || game.i18n.localize("DRPG.Movement.outsideRooms");
    playSfx("refused");
    ui.notifications.warn(game.i18n.format("DRPG.Move.cannotReach", { from }));
    return true;
}

/** At ready, on a player's browser: the listener for the primary GM's send-back. */
export function registerMoveAudit() {
    Hooks.once("ready", () => {
        if (game.user.isGM) return;
        game.socket.on(SOCKET_EVENT, (payload, senderId) => {
            onSentBack(payload, senderId).catch(err => error("Could not take the GM's send-back", err));
        });
    });
}
