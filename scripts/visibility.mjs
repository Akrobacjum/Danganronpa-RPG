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
// Static, like movement.mjs's own import of the same file: `applyToToken`
// runs on every token of every refresh, so its readers cannot be dynamic.
// mastermind.mjs does not reach back into this file at load time — its one
// call to `applyAll` is a dynamic import — so there is no cycle.
import { myLairRoom } from "./mastermind.mjs";
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
        // …and again after this frame's refresh has finished. See below.
        reassertNextFrame();
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

/**
 * SAY IT AGAIN, ONE FRAME LATER.
 * ---------------------------------------------------------------------------
 * The whole mechanism rests on an assumption stated at the top of this file:
 * that by the time `refreshToken` runs, Foundry has already computed its own
 * `visible` and ours is the last word. That assumption is not written down
 * anywhere in Foundry's API — it is an observed ordering — and an ordering is
 * exactly the kind of thing a Foundry or system update moves. When it moves,
 * nothing here throws and nothing logs: the engine simply recomputes
 * `visible` after us and every token on the map is on screen again. That is
 * the shape of the regression reported from the table on 2026-08-23, and it
 * is indistinguishable from "the module was never loaded".
 *
 * So the rule is asserted twice: once in the hook, where it has always been,
 * and once on the next animation frame, by which point every recomputation
 * belonging to this frame — ours, the engine's, the system's — has run. If the
 * ordering is fine, the second pass finds everything already correct and costs
 * one walk of the placeables. If the ordering has moved, the second pass is
 * what holds the line, at the price of a token being briefly visible for a
 * single frame before it is hidden again.
 *
 * It deliberately does NOT touch `renderFlags`: setting those would ask for
 * another refresh, which would schedule another frame, which is a loop with a
 * canvas in it. `applyToToken` only writes to display objects, so re-running
 * it changes nothing that can re-enter this.
 *
 * One frame is scheduled at a time no matter how many tokens refresh in it —
 * a drag fires this hook for every frame of the drag, and one pass per frame
 * is the whole budget.
 */
let pendingFrame = 0;

function reassertNextFrame() {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        try {
            if (!canvas?.ready) return;
            for (const token of canvas.tokens?.placeables ?? []) applyToToken(token);
        } catch {
            // Same contract as `applyToToken`: never break the canvas over this.
        }
    });
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
        // The GM sees the whole cast, always. Not a judgement call and never a
        // setting: they are running the game, not standing in a room.
        if (game.user.isGM) return;

        /* THE ECLIPSE SITS ABOVE `roomVisibility`, NOT BEHIND IT.
           -------------------------------------------------------------------
           This branch used to live below the `enforcing()` gate, so a table
           with room visibility switched off got an Eclipse in which everybody
           could watch everybody cross the map — confirmed live, and reported
           as B-F2-3. Dawid settled the design question on 2026-08-26: an
           Eclipse always hides players' tokens from other players, and the GM
           always sees them all.

           So the darkness is answered here, before the setting is consulted:
           `roomVisibility` governs the ROOM rule below, which is about where
           you are standing. An Eclipse is not about rooms — it is the lights
           going out, and there is no configuration under which the lights are
           out for one player and on for another. Your own token still shows,
           for the same reason it does below: you have to be able to move it. */
        if (isEclipse()) {
            if (token.isOwner) show(token);
            else hide(token);
            return;
        }

        // Everything below is the room rule, which is what the setting governs.
        if (!enforcing()) return;

        // YOUR OWN TOKEN IS ALWAYS VISIBLE TO YOU, unconditionally.
        //
        // This used to `return` — leaving the token to whatever Foundry had
        // decided — which is fine only while Foundry's own vision agrees. It
        // does not always: with the scene switched to room-based visibility,
        // an owned token standing in an unexplored corner of a stale
        // exploration mask was hidden by Foundry itself, and the player was
        // left looking at a map with their own character missing from it.
        // There is no rule in this game under which you cannot see yourself,
        // so this states it rather than assuming it.
        if (token.isOwner) {
            show(token);
            return;
        }

        /* THE MASTERMIND'S ROOM IS A WATCHTOWER (Dawid, 26.08).
           -------------------------------------------------------------------
           A Mastermind whose own token stands in their lair sees the whole
           cast, the way the GM's branch above does — they built the cameras.
           Standing anywhere else they are exactly as blind as anyone, which
           is why this reads their CURRENT rooms rather than remembering
           anything: walk out, and the next refresh takes it away.

           Deliberately below the Eclipse branch — the lights going out spare
           nobody — and deliberately only in this function: Remnant tokens go
           through `applyToRemnantToken`, so the watchtower never shows a
           trace they have not personally observed. */
        const lair = myLairRoom();
        if (lair && myRooms().has(lair)) return;

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
 * The opposite of `hide`, for the one case that is not a judgement call: your
 * own token.
 *
 * Only the token itself and its mesh are forced. The nameplate, bars and
 * border are left to Foundry, because those have their own display settings a
 * GM may legitimately have turned off per token — forcing them back on would
 * be this module overruling a deliberate choice, which is not what "you can
 * see yourself" means.
 *
 * `document.hidden` is still respected: a token the GM has hidden outright is
 * hidden from its owner too, which is what that control is for.
 */
function show(token) {
    if (token.document?.hidden) return;
    token.visible = true;
    if (token.mesh) token.mesh.visible = true;
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

/**
 * Why is somebody visible who should not be?
 *
 * The two ways this mechanism fails look identical from the table — everybody
 * sees everybody — and they need opposite repairs, so this asks the map both
 * questions at once and prints the answers side by side:
 *
 *   room === null everywhere   the hit test is rejecting the whole scene, and
 *                              the repair belongs in `regionsAt` (movement.mjs)
 *   rooms correct, visible     Foundry recomputed visibility after this module
 *   for someone elsewhere      did, and the repair belongs in the hook order
 *                              above — see `reassertNextFrame`
 *
 * Run it on a PLAYER's client with at least two characters standing in two
 * different rooms; on a GM's client every token is visible by design and the
 * table says nothing.
 */
export function diagnoseVisibility() {
    const lines = [];
    const setting = (() => {
        try {
            return game.settings.get(MODULE_ID, SETTINGS.roomVisibility) ? "on" : "OFF";
        } catch {
            return "unreadable";
        }
    })();

    lines.push(`Room visibility setting: ${setting}`);
    lines.push(`This client is a GM: ${game.user.isGM ? "yes — every token is visible by design" : "no"}`);
    lines.push(`Scene: ${canvas?.scene?.name ?? "none"} · regions: ${canvas?.scene?.regions?.size ?? 0}`);
    lines.push(`My rooms: ${Array.from(myRooms()).join(", ") || "none"}`);
    lines.push("");

    for (const token of canvas?.tokens?.placeables ?? []) {
        if (token.actor?.type !== "character") continue;
        const room = roomOfToken(token.document);
        lines.push([
            token.name.padEnd(16),
            `regions ${String(token.document.regions?.size ?? 0).padStart(2)}`,
            `room ${(room ?? "—").padEnd(14)}`,
            token.isOwner ? "mine " : "     ",
            token.visible ? "VISIBLE" : "hidden"
        ].join("  "));
    }

    const report = lines.join("\n");
    console.log(report);
    return report;
}

/** Who this user can currently see, for diagnostics. */
export function visibleCharacters() {
    return (canvas?.tokens?.placeables ?? [])
        .filter(t => t.actor?.type === "character" && t.visible)
        .map(t => t.actor.name);
}
