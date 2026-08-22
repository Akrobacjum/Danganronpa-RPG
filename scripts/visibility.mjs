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
 * The GM always sees everything. A player always sees their own token.
 *
 * A revealed Remnant token gets the same treatment, on a different rule: once
 * somebody's first Observe reveals it (see `revealRemnantToFinder` in
 * remnants.mjs), Foundry's `hidden` flag is off for the whole table — but the
 * guide's Truth Bullet is a PERSONAL copy, not a public unveiling, so anyone
 * who has not found this exact trace themselves still needs it invisible.
 * `applyToRemnantToken` below is that second rule, running on the same hook.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { roomOfToken, regionsAt } from "./movement.mjs";
import { REMNANT_FLAGS, keyOf as remnantKeyOf } from "./remnants.mjs";
import { TRUTH_BULLET_FLAGS, bulletsOf } from "./truth-bullets.mjs";
import { debug, error } from "./utils.mjs";

export function registerVisibility() {
    registerVisionBoundary();
    // `refreshToken` is the one that matters: Foundry recomputes `visible` from
    // its own vision logic on every refresh, so setting it from `sightRefresh`
    // alone was immediately overwritten — which is why standing at a gap in a
    // wall still showed the room beyond.
    Hooks.on("refreshToken", token => {
        // One of ours moved: where WE are may have changed, so the memo of our
        // own rooms is no longer good. Somebody else's refresh cannot change it.
        if (token?.isOwner) forgetMyRooms();
        applyToToken(token);
    });

    Hooks.on("sightRefresh", () => applyAll());
    Hooks.on("canvasReady", () => applyAll());
    Hooks.on("updateToken", (doc, changes) => {
        // `hidden` as well as a move: that is the write `revealRemnantToFinder`
        // makes, and it is the one moment a Remnant's visibility actually needs
        // recomputing for everyone who is not the finder.
        if (changes.x !== undefined || changes.y !== undefined || changes.hidden !== undefined) applyAll();
    });
    Hooks.on("createToken", () => applyAll());
    Hooks.on("deleteToken", () => applyAll());
    Hooks.on("drpgTimeOfDayChanged", () => applyAll());
    Hooks.on("drpgEclipseChanged", () => applyAll());

    // A new Truth Bullet is the other half of `myRemnantRefs()` going stale —
    // it can land on this user's actor from a socket reply with no token on
    // this scene moving at all, so nothing above would otherwise catch it.
    Hooks.on("createItem", item => { if (isMyTruthBullet(item)) applyAll(); });
    Hooks.on("deleteItem", item => { if (isMyTruthBullet(item)) applyAll(); });
}

/**
 * A token's vision stops at the room it is standing in, even where the map
 * draws no wall — a gap, an open archway, a scene built without walls at all
 * are exactly the cases the room-visibility rule above exists to cover for
 * TOKEN VISIBILITY, and this is its counterpart for VISION ITSELF: without
 * it, a player could still see the far side of a doorless opening even
 * though everyone standing over there is correctly hidden from them.
 *
 * SPIKE NEEDED, NOT YET CONFIRMED LIVE — the one place in this module that
 * reaches into a private API. `Token#_getVisionSourceData` is the method
 * Foundry calls to build the data object a `PointVisionSource` is
 * (re)initialised from; `boundaryShapes` on that data is documented for
 * `PointSourcePolygonConfig` as extra clip shapes intersected into the
 * source's own polygon. Wrapping the method rather than the hook the plan
 * also considered (`initializeVisionSources`) because a public GitHub issue
 * on foundryvtt/foundryvtt describes exactly that hook as running AFTER
 * Foundry's own activation pass, which silently drops anything added there.
 *
 * Before relying on this: open a v14 world with two rooms sharing a doorless
 * gap, stand a player token in one, and confirm in the console that (a)
 * `boundaryShapes` is still read by whatever polygon backend that build
 * ships, and (b) the clip survives a full vision recompute (moving the
 * token, reloading the scene) rather than only the first paint. If either
 * fails, `visibility.mjs`'s ordinary token-hiding rule above and the fog
 * layer in fog.mjs still cover the leak — less literally (through a
 * doorless gap you would see an empty, fogged room rather than a wall) but
 * completely, so nothing here is a single point of failure for the rule the
 * guide actually asks for: "Players see other players only in the same room."
 */
function registerVisionBoundary() {
    const proto = foundry?.canvas?.placeables?.Token?.prototype ?? globalThis.Token?.prototype;
    const original = proto?._getVisionSourceData;
    if (typeof original !== "function") {
        debug("Token#_getVisionSourceData not found; the room vision clip is disabled.");
        return;
    }

    proto._getVisionSourceData = function (...args) {
        const data = original.apply(this, args);
        try {
            return clipVisionToRoom(this, data);
        } catch (err) {
            error("Could not clip vision to the room boundary; leaving it unclipped", err);
            return data;
        }
    };
}

/**
 * Add the current room's own polygon(s) to a vision source's clip shapes.
 *
 * GMs and Monokumas see the whole map, same exemption `applyToToken` above
 * makes for token HIDING — a Monokuma walks the story around a scene the
 * players cannot see all of, and a GM directing that has to see it too.
 * A token outside every region is left unclipped rather than blinded: the
 * module cannot draw a boundary it was never told exists, and refusing to
 * guess is the same call `movement.mjs`'s adjacency check makes for a room
 * it cannot measure.
 */
function clipVisionToRoom(token, data) {
    const actor = token?.actor;
    if (!actor || actor.type !== "character") return data;
    if (game.user.isGM || actor.getFlag(MODULE_ID, FLAGS.monokuma)) return data;

    const tokenDoc = token.document ?? token;
    const scene = tokenDoc?.parent ?? canvas?.scene;
    if (!scene?.regions?.size) return data;

    const regions = regionsAt(scene, tokenDoc.x, tokenDoc.y, tokenDoc);
    if (!regions.length) return data;

    const shapes = [];
    for (const region of regions) {
        const polys = region.polygons ?? region.object?.polygons;
        if (polys?.length) shapes.push(...polys);
    }
    if (!shapes.length) return data;

    return { ...data, boundaryShapes: [...(data.boundaryShapes ?? []), ...shapes] };
}

function isMyTruthBullet(item) {
    const actor = item?.parent;
    return actor?.type === "character" && actor.isOwner
        && Boolean(item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.isBullet));
}

/**
 * Decide one token's visibility. Called from `refreshToken`, so it runs after
 * Foundry has had its say and its result is the one that sticks.
 */
function applyToToken(token) {
    try {
        if (token?.document?.getFlag?.(MODULE_ID, REMNANT_FLAGS.isRemnant)) {
            applyToRemnantToken(token);
            return;
        }

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

/**
 * A revealed Remnant is visible to the table by Foundry's own `hidden` flag,
 * but stays a secret from everyone except the finder — see the header note.
 * Unlike the room rule above, this does not depend on the `roomVisibility`
 * setting: it is not about rooms, it is about who has actually copied this
 * specific trace, and it holds regardless of whether the GM has room
 * enforcement switched on.
 */
function applyToRemnantToken(token) {
    if (game.user.isGM) return;
    // Still hidden: Foundry's own flag already keeps it off every screen but
    // the GM's, and there is nothing this function needs to add.
    if (token.document.hidden) return;

    const key = remnantKeyOf(token.document);
    if (!key || myRemnantRefs().has(key)) return;
    hide(token);
}

function hide(token) {
    token.visible = false;
    if (token.mesh) token.mesh.visible = false;
    // Nameplates, bars and the target marker are separate display objects.
    for (const part of [token.nameplate, token.bars, token.tooltip, token.effects, token.border]) {
        if (part) part.visible = false;
    }
    hideMovementTrail(token);
}

/**
 * The line and distance label Foundry draws while a token is being dragged is
 * not one of the display objects above — it belongs to the ruler Foundry
 * attaches to the token being moved, not to the token's own mesh — so hiding
 * everything above still left a killer's path lit up across a room nobody
 * could see them stand in: the token itself never appeared during an Eclipse,
 * but the line leading to where it stopped gave the room away anyway.
 *
 * SPIKE NEEDED, NOT YET CONFIRMED LIVE: the property this trail lives on is
 * not public API and is not the same name across Foundry builds — `ruler` in
 * some v13+ builds, `dragRuler` in others, possibly namespaced differently
 * again in v14. Every plausible name is tried and hidden defensively so this
 * fails safe (nothing to hide, nothing happens) rather than throwing; before
 * relying on this, open a v14 world with an Eclipse running, drag a token as
 * one player while watching as another, and confirm in the console which of
 * these actually holds the trail — then delete the branches that do not.
 */
function hideMovementTrail(token) {
    for (const key of ["ruler", "dragRuler", "_ruler", "movementRuler"]) {
        const trail = token[key];
        if (trail && typeof trail === "object" && "visible" in trail) trail.visible = false;
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
    forgetMyRooms();

    for (const token of canvas.tokens?.placeables ?? []) {
        // Ask Foundry to refresh, which runs applyToToken through the hook.
        token.renderFlags?.set?.({ refreshVisibility: true });
        applyToToken(token);
    }

    if (!game.user.isGM && enforcing()) {
        debug(`Room visibility applied; you are in: ${Array.from(myRooms()).join(", ") || "nowhere"}`);
    }
}

/**
 * Every room this user's characters are standing in.
 *
 * Memoised, because the cost was quadratic and the canvas felt it. `applyAll`
 * walks every token on the scene and each one asked this question again, and
 * each answer walked every token on the scene a second time doing geometric
 * region tests — so a sixteen-student map with Remnants on it ran hundreds of
 * `roomOfToken` calls per refresh, and `refreshToken` fires on every frame of a
 * drag. The answer cannot change between two tokens of the same pass.
 *
 * Dropped whenever anything that could move US happens: see `forgetMyRooms`.
 */
let myRoomsCache = null;
/**
 * Which Remnants this user has already copied, as `remnantRef` keys — see
 * `applyToRemnantToken`. Memoised for the same reason `myRoomsCache` is:
 * every revealed Remnant on the scene would otherwise re-scan every character
 * this user owns and every Truth Bullet on each of them, per token, per
 * `refreshToken`. Bullet ownership does not actually change on every token
 * move, but invalidating it on the same triggers as the room cache is cheap
 * and never wrong — only occasionally recomputed one hook earlier than it had
 * to be.
 */
let myRemnantRefsCache = null;

function forgetMyRooms() {
    myRoomsCache = null;
    myRemnantRefsCache = null;
}

function myRooms() {
    if (myRoomsCache) return myRoomsCache;

    const rooms = new Set();
    for (const token of canvas.tokens?.placeables ?? []) {
        if (!token.isOwner || token.actor?.type !== "character") continue;
        const room = roomOfToken(token.document);
        if (room) rooms.add(room);
    }

    myRoomsCache = rooms;
    return rooms;
}

function myRemnantRefs() {
    if (myRemnantRefsCache) return myRemnantRefsCache;

    const refs = new Set();
    for (const actor of game.actors) {
        if (actor.type !== "character" || !actor.isOwner) continue;
        for (const item of bulletsOf(actor)) {
            const ref = item.getFlag(MODULE_ID, TRUTH_BULLET_FLAGS.remnantRef);
            if (ref) refs.add(ref);
        }
    }

    myRemnantRefsCache = refs;
    return refs;
}

/** Who this user can currently see, for diagnostics. */
export function visibleCharacters() {
    return (canvas?.tokens?.placeables ?? [])
        .filter(t => t.actor?.type === "character" && t.visible)
        .map(t => t.actor.name);
}
