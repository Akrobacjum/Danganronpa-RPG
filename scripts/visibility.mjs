/**
 * Danganronpa RPG — players only see who is in the room with them.
 * ---------------------------------------------------------------------------
 * Guide: "Players see other players only in the same room."
 *
 * Walls and vision get most of the way there, but not all: a player standing in
 * a doorway, a room with an open archway, or a scene built without walls will
 * all leak. This enforces the rule directly on token visibility, so it holds
 * regardless of how carefully the map was drawn.
 *
 * The GM always sees everything. A player always sees their own token, and
 * Remnants keep their own hidden/revealed state — this only governs who can see
 * whom.
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { roomOfToken } from "./movement.mjs";
import { debug } from "./utils.mjs";

export { isEclipse };

export function registerVisibility() {
    // `refreshToken` is the one that matters: Foundry recomputes `visible` from
    // its own vision logic on every refresh, so setting it from `sightRefresh`
    // alone was immediately overwritten — which is why standing at a gap in a
    // wall still showed the room beyond.
    Hooks.on("refreshToken", token => applyToToken(token));

    Hooks.on("sightRefresh", () => applyAll());
    Hooks.on("canvasReady", () => applyAll());
    Hooks.on("updateToken", (doc, changes) => {
        if (changes.x !== undefined || changes.y !== undefined) applyAll();
    });
    Hooks.on("drpgTimeOfDayChanged", () => applyAll());
    Hooks.on("drpgEclipseChanged", () => applyAll());
}

/**
 * Decide one token's visibility. Called from `refreshToken`, so it runs after
 * Foundry has had its say and its result is the one that sticks.
 */
function applyToToken(token) {
    try {
        if (!token?.actor || token.actor.type !== "character") return;
        if (game.user.isGM || !enforcing()) return;
        if (token.isOwner) return;

        // During an Eclipse nobody sees anybody — see eclipse.mjs.
        if (isEclipse()) {
            hide(token);
            return;
        }

        const mine = myRooms();
        const room = roomOfToken(token.document);

        // A scene with no regions at all: leave Foundry's own logic alone
        // rather than hiding the entire cast.
        if (!mine.size && !room) return;

        if (room && mine.has(room)) return;
        hide(token);
    } catch {
        // Never break the canvas over this.
    }
}

function hide(token) {
    token.visible = false;
    if (token.mesh) token.mesh.visible = false;
    // Nameplates, bars and the target marker are separate display objects.
    for (const part of [token.nameplate, token.bars, token.tooltip, token.effects, token.border]) {
        if (part) part.visible = false;
    }
}

function isEclipse() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.clock)?.eclipse === true;
    } catch {
        return false;
    }
}

function enforcing() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.roomVisibility);
    } catch {
        return false;
    }
}

/**
 * Recompute who is visible. Applied as a render-time override rather than a
 * document change, so nothing is written to the scene and the GM's view is
 * never altered.
 */
export function applyAll() {
    if (!canvas?.ready) return;

    for (const token of canvas.tokens?.placeables ?? []) {
        // Ask Foundry to refresh, which runs applyToToken through the hook.
        token.renderFlags?.set?.({ refreshVisibility: true });
        applyToToken(token);
    }

    if (!game.user.isGM && enforcing()) {
        debug(`Room visibility applied; you are in: ${Array.from(myRooms()).join(", ") || "nowhere"}`);
    }
}

/** Every room this user's characters are standing in. */
function myRooms() {
    const rooms = new Set();
    for (const token of canvas.tokens?.placeables ?? []) {
        if (!token.isOwner || token.actor?.type !== "character") continue;
        const room = roomOfToken(token.document);
        if (room) rooms.add(room);
    }
    return rooms;
}

/** Who this user can currently see, for diagnostics. */
export function visibleCharacters() {
    return (canvas?.tokens?.placeables ?? [])
        .filter(t => t.actor?.type === "character" && t.visible)
        .map(t => t.actor.name);
}
