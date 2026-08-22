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
import { roomOfToken } from "./movement.mjs";
import { REMNANT_FLAGS, keyOf as remnantKeyOf } from "./remnants.mjs";
import { TRUTH_BULLET_FLAGS, bulletsOf } from "./truth-bullets.mjs";
import { debug, error } from "./utils.mjs";

export function registerVisibility() {
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

/* THE VISION CLIP THAT USED TO LIVE HERE IS GONE, ON PURPOSE.
   --------------------------------------------------------------------------
   It wrapped `Token#_getVisionSourceData` to intersect a token's sight
   polygon with its room's polygon, so that a doorless gap would not let you
   see into the next room. It was the module's only reach into a private
   Foundry API, it was never confirmed to work on a live world, and — the
   part that actually settled it — the whole problem it was solving stopped
   existing once `fog.mjs` started switching Foundry's per-token vision OFF.

   With `tokenVision: false` on the scene there are no sight polygons at all
   to clip: the map is globally lit and the module's region fog is the only
   thing hiding any of it, which is what "per room, not per sight line"
   means. Wrapping a private method to constrain a system that is no longer
   running would have been pure risk with nothing on the other side of it.

   What still enforces the guide's rule is unchanged and above this line:
   `applyToToken` hides other characters' TOKENS to the viewer's own room, so
   a globally lit corridor never tells you who is standing in it. */

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
