/**
 * Danganronpa RPG — movement between rooms.
 * ---------------------------------------------------------------------------
 * Guide: "The player gets one free move per time of day. Each further one
 * spends an action. A move takes the player to a room directly connected to
 * the one they are in."
 *
 * Moving *within* a room is not a move at all — repositioning next to someone
 * to talk costs nothing. What costs is crossing from one room into another, so
 * the charge is applied when a token's Scene Region changes, not when it is
 * dragged. Players simply drag their token; the economy follows.
 *
 * Rooms are Scene Regions. A scene with no regions charges nothing, which keeps
 * a half-built map from eating everyone's actions.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { hasFreeMove, takeMove, actionsLeft } from "./actions.mjs";
// `neighbouringRooms` and `boundsOf` are defined further down this file.
import { whisperToOwner, isPrimaryGm, debug, error } from "./utils.mjs";

/** Last known room per token, so we only react to actual crossings. */
const lastRoom = new Map();
/** Last position inside that room, so a refused crossing can be undone. */
const lastPosition = new Map();

export function registerMovement() {
    // Refuse the move BEFORE it is written, rather than teleporting the token
    // back afterwards. The old approach was unreliable for two reasons: the
    // "where were you" cache is per-client, so whoever was not doing the
    // dragging had a stale idea of the previous room, and the revert had to
    // race the update that triggered it. Returning false here simply stops the
    // move — nothing to undo, nothing to get out of step.
    Hooks.on("preUpdateToken", onPreUpdateToken);
    Hooks.on("updateToken", onUpdateToken);
    Hooks.on("canvasReady", primeRoomCache);
    Hooks.on("preCreateToken", onPreCreateToken);
}

/**
 * Veto a room crossing the character cannot pay for.
 *
 * Runs on the client making the change, before anything is saved, so the answer
 * does not depend on any cached position.
 */
function onPreUpdateToken(tokenDoc, changes, options) {
    try {
        if (options?.[REVERT]) return;
        if (changes.x === undefined && changes.y === undefined) return;
        if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) return;

        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") return;
        if (game.user.isGM) return;                    // GMs move anything anywhere

        const from = roomOfToken(tokenDoc);
        const to = roomAt(
            changes.x ?? tokenDoc.x,
            changes.y ?? tokenDoc.y,
            tokenDoc
        );

        if (from === to) return;                       // same room: always free
        if (!from && !to) return;                      // no regions here

        const allowed = canCross(actor, from, to);
        if (allowed === true) return;

        ui.notifications.warn(allowed);
        return false;                                  // the move does not happen
    } catch {
        // Never block a move because our own check failed.
    }
}

/**
 * May this character cross right now?
 * @returns {true|string} true, or the reason it is refused.
 */
function canCross(actor, from, to) {
    // Monokumas are not bound by any of this.
    if (actor.getFlag(MODULE_ID, "monokuma")) return true;

    const eclipse = game.settings.get(MODULE_ID, SETTINGS.clock)?.eclipse === true;

    if (eclipse) {
        const used = game.settings.get(MODULE_ID, SETTINGS.eclipseMoves)?.[actor.id] ?? 0;
        if (used >= 2) return game.i18n.localize("DRPG.Eclipse.noMovesLeft");

        if (from && to) {
            const connected = neighbouringRooms(from);
            if (connected.length && !connected.includes(to)) {
                return game.i18n.format("DRPG.Eclipse.notConnected", {
                    from, to, rooms: connected.join(", ")
                });
            }
        }
        return true;
    }

    if (hasFreeMove(actor)) return true;
    if (actionsLeft(actor) >= 1) return true;
    return game.i18n.localize("DRPG.Move.noBudget");
}

/** Which room a point falls inside, using the same regions as roomOfToken. */
function roomAt(x, y, tokenDoc) {
    const scene = tokenDoc?.parent ?? canvas?.scene;
    if (!scene?.regions?.size) return null;

    // Test the token's centre, not its corner.
    const size = canvas?.grid?.size ?? 100;
    const cx = x + ((tokenDoc?.width ?? 1) * size) / 2;
    const cy = y + ((tokenDoc?.height ?? 1) * size) / 2;

    const names = [];
    for (const region of scene.regions) {
        if (!region.name) continue;
        const inside = region.object?.testPoint?.({ x: cx, y: cy })
            ?? region.testPoint?.({ x: cx, y: cy })
            ?? containedBy(region, cx, cy);
        if (inside) names.push(region.name);
    }
    return names.sort()[0] ?? null;
}

/** Bounding-box fallback when a region cannot test a point itself. */
function containedBy(region, x, y) {
    const b = boundsOf(region);
    if (!b) return false;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/**
 * Every token this module places or that a GM drops behaves the same way:
 * no rotation on movement, and free positioning rather than grid snapping.
 * Applied at creation so it also covers tokens dragged from the actor list.
 */
function onPreCreateToken(token, data) {
    const update = {};
    if (data.lockRotation === undefined) update.lockRotation = true;
    if (Object.keys(update).length) token.updateSource(update);
}

/** Remember where every token starts, so the first drag is judged correctly. */
function primeRoomCache() {
    lastRoom.clear();
    lastPosition.clear();
    for (const token of canvas?.tokens?.placeables ?? []) {
        lastRoom.set(token.document.id, roomOfToken(token.document));
        lastPosition.set(token.document.id, { x: token.document.x, y: token.document.y });
    }
}

async function onUpdateToken(tokenDoc, changes, options, userId) {
    try {
        // Our own revert: record where it landed, charge nothing.
        if (options?.[REVERT]) {
            lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // A GM moved it: always free, never reverted.
        //
        // Without this, a token whose owner is offline falls through to
        // "the primary GM pays" below — so a GM tidying the map was charged for
        // it and had the token teleported back. It only showed on absent
        // players' tokens, which is why one character misbehaved and another
        // did not.
        if (game.users.get(userId)?.isGM) {
            lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        if (!game.settings.get(MODULE_ID, SETTINGS.chargeMovement)) return;
        // Only position changes can cross a boundary.
        if (changes.x === undefined && changes.y === undefined && changes.elevation === undefined) return;

        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") return;

        // Monokumas walk where they like. The guide has them moving around the
        // map freely between interventions; they have no action economy to
        // spend and no walls to respect.
        const { isMonokuma } = await import("./monokuma.mjs");
        if (isMonokuma(actor)) {
            lastRoom.set(tokenDoc.id, roomOfToken(tokenDoc));
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // "Never seen this token" and "was outside every room" are different
        // states. Without that distinction the first drag after a token appears
        // looks like a crossing and wrongly costs a Move.
        const known = lastRoom.has(tokenDoc.id);
        const before = lastRoom.get(tokenDoc.id) ?? null;
        const previous = lastPosition.get(tokenDoc.id) ?? null;
        const after = roomOfToken(tokenDoc);

        if (!known) {
            lastRoom.set(tokenDoc.id, after);
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        // Same room, or a scene with no regions at all: free. Remember the new
        // spot so a later refused crossing snaps back to somewhere sensible.
        if (before === after || (!after && !before)) {
            lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            lastRoom.set(tokenDoc.id, after);
            return;
        }

        lastRoom.set(tokenDoc.id, after);

        // Exactly one client charges, or two GMs would both spend the action.
        // Exactly one client applies the cost. Prefer the player who owns the
        // token — including when they are offline, so nobody else inherits the
        // bill — and only fall back to the primary GM for an ownerless token.
        const owner = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
        const shouldCharge = owner
            ? owner.id === game.user.id
            : isPrimaryGm();
        if (!shouldCharge) return;

        // During an Eclipse the action economy is suspended: two free crossings
        // instead, judged by eclipse.mjs.
        const { isEclipse, judgeEclipseCrossing } = await import("./eclipse.mjs");
        if (isEclipse()) {
            const allowed = await judgeEclipseCrossing(actor, before, after);
            if (!allowed) await sendBack(tokenDoc, previous, before);
            else if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
            return;
        }

        await chargeForCrossing(actor, before, after, tokenDoc, previous);
    } catch (err) {
        error("Movement charge failed", err);
    }
}

async function chargeForCrossing(actor, from, to, tokenDoc = null, previous = null) {
    const free = hasFreeMove(actor);

    // Out of budget: the crossing does not happen. Put the token back where it
    // was rather than leaving it in a room it could not afford to enter.
    if (!free && actionsLeft(actor) < 1) {
        ui.notifications.warn(game.i18n.localize("DRPG.Move.noBudget"));
        await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Move.title")}</strong> — ${
            game.i18n.localize("DRPG.Move.noBudgetLong")
        }</p>`);

        await sendBack(tokenDoc, previous, from);
        return;
    }

    const cost = await takeMove(actor);
    if (!cost) return;

    const where = to
        ? game.i18n.format("DRPG.Move.entered", { room: foundry.utils.escapeHTML(to) })
        : game.i18n.localize("DRPG.Move.leftRooms");

    const price = cost === "free"
        ? game.i18n.localize("DRPG.Move.wasFree")
        : game.i18n.format("DRPG.Move.costAction", { left: actionsLeft(actor) });

    if (tokenDoc) lastPosition.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });

    await whisperToOwner(actor, `<p><strong>${game.i18n.localize("DRPG.Move.title")}</strong> — ${where}<br>${price}</p>`);
    debug(`${actor.name}: ${from ?? "—"} -> ${to ?? "—"} (${cost})`);
}

/**
 * Put a token back where it came from.
 *
 * Called from inside the `updateToken` hook, so the write is deferred a tick —
 * updating a document while its own update hook is still running is what made
 * the earlier attempt silently do nothing. The move is also marked so our own
 * hook ignores it and does not charge for the way back.
 */
async function sendBack(tokenDoc, previous, room) {
    if (!tokenDoc || !previous) return;

    const apply = async () => {
        try {
            await tokenDoc.update(
                { x: previous.x, y: previous.y },
                { animate: false, [REVERT]: true }
            );
        } catch {
            // A player may not own the token; ask the GM to do it.
            const { requestSendBack } = await import("./gm-bridge.mjs");
            requestSendBack(tokenDoc.parent?.id, tokenDoc.id, previous);
        }
        lastRoom.set(tokenDoc.id, room);
        lastPosition.set(tokenDoc.id, previous);
    };

    setTimeout(apply, 0);
}

/** Marks an update as our own revert, so it is not charged for. */
export const REVERT = "drpgRevert";

/* ==========================================================================
 * ROOMS
 * ========================================================================== */

/** Name of the Scene Region a token document is inside, if any. */
export function roomOfToken(tokenDoc) {
    const regions = tokenDoc?.regions;
    if (!regions?.size) return null;

    const names = Array.from(regions)
        .map(r => (typeof r === "string" ? tokenDoc.parent?.regions?.get(r) : r))
        .filter(Boolean)
        .map(r => r.name)
        .filter(Boolean)
        .sort();

    return names[0] ?? null;
}

/** Room a character is currently standing in. */
export function roomOfActor(actor) {
    const token = actor?.getActiveTokens?.()?.[0];
    return token ? roomOfToken(token.document) : null;
}

/** Every character token sharing a room with this one. */
export function othersInRoom(actor) {
    const room = roomOfActor(actor);
    if (!room) return [];

    return (canvas?.tokens?.placeables ?? [])
        .filter(t => t.actor && t.actor.id !== actor.id && t.actor.type === "character")
        .filter(t => roomOfToken(t.document) === room)
        .map(t => t.actor);
}

/** Every room region on the current scene. */
export function allRooms() {
    return Array.from(canvas?.scene?.regions ?? [])
        .map(r => r.name)
        .filter(Boolean)
        .sort();
}

/**
 * Rooms adjacent to this one.
 *
 * Foundry has no notion of rooms being connected, so adjacency is measured
 * geometrically: regions whose bounding boxes are within one grid square of
 * each other count as neighbours. That matches how a map is usually drawn — a
 * shared wall — without asking the GM to maintain a separate connection list.
 *
 * The GM can override it per region with a `drpgNeighbours` flag holding a
 * comma-separated list of room names, for rooms that touch but have no door,
 * or doors between rooms that do not touch.
 */
export function neighbouringRooms(room) {
    const scene = canvas?.scene;
    if (!room || !scene) return [];

    const regions = Array.from(scene.regions).filter(r => r.name);
    const self = regions.find(r => r.name === room);
    if (!self) return [];

    // Explicit list wins, when the GM has set one.
    const declared = self.getFlag?.(MODULE_ID, "drpgNeighbours");
    if (typeof declared === "string" && declared.trim()) {
        const names = declared.split(",").map(s => s.trim()).filter(Boolean);
        return names.filter(n => regions.some(r => r.name === n)).sort();
    }

    // Tolerance for the thickness of a shared wall, and no more. A larger
    // margin bridges rooms that merely lie near each other — at 1.5 squares it
    // treated a room two doors away as adjacent.
    const others = regions.filter(r => r.name !== room);
    const pad = (canvas?.grid?.size ?? 100) * 0.35;
    const mine = boundsOf(self);

    // No usable geometry — an unrendered scene, an exotic shape, a region drawn
    // in a way we cannot measure. Treat every other room as reachable rather
    // than telling the player there is nowhere to go: being too permissive is a
    // GM ruling away, being too strict is a dead end.
    if (!mine) {
        debug(`No bounds for "${room}"; treating all rooms as neighbours.`);
        return others.map(r => r.name).sort();
    }

    const near = others.filter(r => {
        const other = boundsOf(r);
        return other && overlaps(mine, other, pad);
    });

    // Everything measurable, yet nothing adjacent? Same reasoning.
    if (!near.length && others.some(r => !boundsOf(r))) {
        return others.map(r => r.name).sort();
    }

    return near.map(r => r.name).sort();
}

/**
 * Bounding box of a region, from whichever source has one.
 *
 * Region geometry lives in different places depending on whether the scene is
 * rendered, so each is tried in turn before giving up.
 */
function boundsOf(region) {
    // The rendered placeable knows best.
    const b = region?.object?.bounds ?? region?.bounds;
    if (b && Number.isFinite(b.x) && Number.isFinite(b.width)) {
        return { x: b.x, y: b.y, w: b.width, h: b.height };
    }

    // Foundry also exposes a computed polygon set on the document.
    const polys = region?.polygons ?? region?.object?.polygons;
    if (polys?.length) {
        const box = fromPoints(polys.flatMap(p => p.points ?? p ?? []));
        if (box) return box;
    }

    // Finally the raw shape data.
    const shapes = region?.shapes ?? [];
    if (!shapes.length) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };

    for (const shape of shapes) {
        const pts = shape.points ?? [];
        for (let i = 0; i < pts.length; i += 2) grow(pts[i], pts[i + 1]);

        // Rectangle.
        if (Number.isFinite(shape.x) && Number.isFinite(shape.width)) {
            grow(shape.x, shape.y);
            grow(shape.x + shape.width, shape.y + shape.height);
        }
        // Ellipse / circle.
        if (Number.isFinite(shape.radiusX)) {
            grow(shape.x - shape.radiusX, shape.y - shape.radiusY);
            grow(shape.x + shape.radiusX, shape.y + shape.radiusY);
        } else if (Number.isFinite(shape.radius)) {
            grow(shape.x - shape.radius, shape.y - shape.radius);
            grow(shape.x + shape.radius, shape.y + shape.radius);
        }
    }

    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function fromPoints(flat) {
    if (!flat?.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < flat.length; i += 2) {
        const x = flat[i], y = flat[i + 1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

function overlaps(a, b, pad) {
    return !(a.x - pad > b.x + b.w || b.x - pad > a.x + a.w ||
             a.y - pad > b.y + b.h || b.y - pad > a.y + a.h);
}

/** Characters standing in a named room, excluding one actor. */
export function occupantsOf(room, exclude = null) {
    if (!room) return [];
    return (canvas?.tokens?.placeables ?? [])
        .filter(t => t.actor?.type === "character")
        .filter(t => !exclude || t.actor.id !== exclude.id)
        .filter(t => roomOfToken(t.document) === room)
        .map(t => t.actor);
}
