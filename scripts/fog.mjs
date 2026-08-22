/**
 * Danganronpa RPG — fog of war, by room.
 * ---------------------------------------------------------------------------
 * Three states, one layer, over the whole scene:
 *
 *   the room you are in        full colour   — a hole cut clean through
 *   a room you have visited     a veil        — ~50% fog, so what is on the
 *                                               map there still reads as
 *                                               "somewhere I have been"
 *   everywhere else              full fog     — including any patch of the
 *                                               map that belongs to no Region
 *                                               at all, which is a map-drawing
 *                                               mistake and is meant to look
 *                                               like one
 *
 * Discovery is per CHARACTER, not per player and not per client: two of one
 * player's characters standing in different rooms both uncover their own.
 * `SETTINGS.discoveredRooms` carries it, shaped
 * `{ [sceneId]: { [actorId]: [roomName, ...] } }`, written only by the
 * primary GM — see `onUpdateToken` below — and read by everyone else off the
 * ordinary world-setting sync `sync.mjs` already provides. It is NOT a
 * secret the way the Mastermind's identity is: it is a record of where the
 * party has already been, and travels the world the same way `sealedRooms`
 * does.
 *
 * The Mastermind is the one exception, and it falls out of this model for
 * free: every room counts as "visited" for them (see `myDiscoveredRooms`),
 * because they built the building. It does not touch which room counts as
 * CURRENT — that still comes from where their own token actually stands — so
 * they still only see full colour in the room they are in, same as everyone
 * else. `visibility.mjs`, which hides other characters' TOKENS, is completely
 * untouched by any of this: the fog only ever answers "is this floor tile
 * lit", never "who is standing on it".
 */

import { MODULE_ID } from "./config.mjs";
import { SETTINGS } from "./settings.mjs";
import { roomOfToken } from "./movement.mjs";
import { iAmTheMastermind } from "./mastermind.mjs";
import { isPrimaryGm, debug, log, error } from "./utils.mjs";

const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;

const LAYER_NAME = "drpgFog";
const VEIL_ALPHA = 0.5;
const DISCOVERY_MS = 450;
const OUTLINE_MS = 1000;

/* ==========================================================================
 * REGISTRATION
 * ========================================================================== */

export function registerFog() {
    Hooks.on("canvasReady", () => {
        applySceneVisionMode();
        mountLayer();
        armRendererFailsafe();
        repaintFog();
    });
    Hooks.on("updateToken", onUpdateToken);
    // A GM redrawing a room's shape, or adding/removing one, changes what the
    // mask itself looks like — not just who has seen what.
    Hooks.on("createRegion", () => repaintFog());
    Hooks.on("updateRegion", () => repaintFog());
    Hooks.on("deleteRegion", () => repaintFog());
    // The Eclipse hides everyone from everyone (see eclipse.mjs / visibility.mjs)
    // but says nothing about rooms — fog only needs to catch up once it ends,
    // when ordinary room logic starts mattering again.
    Hooks.on("drpgEclipseChanged", active => { if (!active) repaintFog(); });
}

/** Is the room-based fog switched on for this world? */
export function fogEnabled() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.regionFog) === true;
    } catch {
        return false;
    }
}

/**
 * ROOMS DECIDE WHAT IS VISIBLE, SO FOUNDRY'S OWN VISION HAS TO STAND DOWN.
 * --------------------------------------------------------------------------
 * This is the correction to the first version of this stage, and it is worth
 * spelling out because the symptom did not look like the cause.
 *
 * That version added the region fog as an EXTRA layer over the canvas and
 * changed nothing else. But Foundry's per-token vision was still running
 * underneath it, and Foundry's vision is a line-of-sight system: it lights a
 * cone from the token, through every gap in the walls, and permanently marks
 * whatever that cone touched as explored. So the map revealed itself in
 * cone-shaped wedges that stopped in the middle of rooms and spilled through
 * doorways — per sight line, exactly what the room model exists to replace —
 * and no amount of drawing on top could take those wedges away, because they
 * are not fog, they are the lighting of the scene itself.
 *
 * The fix is not another layer. It is to make the region fog the only thing
 * hiding anything:
 *
 *   tokenVision      off   no cones, no per-token sight polygons at all
 *   fog.exploration  off   Foundry stops recording its own "explored" mask,
 *                          which is what left the ragged half-lit rooms
 *   globalLight      on    the map is lit everywhere, so what a player can
 *                          see is decided by our fog and nothing else
 *
 * Walls stop mattering for VISION here, which is the point — a room is the
 * unit, and `movement.mjs` already governs who may walk between them.
 * `visibility.mjs` still hides other characters' TOKENS to their own room, so
 * a lit corridor never means "you can see who is standing in it".
 *
 * GM-side and idempotent: it only writes when a value actually differs, so it
 * does not fight a GM editing scene config, and it never touches a scene when
 * the setting is off.
 */
export async function applySceneVisionMode(scene = canvas?.scene) {
    if (!game.user.isGM || !scene) return false;
    if (!fogEnabled()) return false;
    if (!scene.regions?.size) return false;

    const update = {};
    if (scene.tokenVision !== false) update.tokenVision = false;
    if (scene.fog?.exploration !== false) update["fog.exploration"] = false;
    if (scene.environment?.globalLight?.enabled !== true) {
        update["environment.globalLight.enabled"] = true;
    }
    if (!Object.keys(update).length) return false;

    try {
        await scene.update(update);
        log(`Room fog: took Foundry's own vision off "${scene.name}" so rooms decide visibility.`);
        return true;
    } catch (err) {
        error("Could not switch the scene to room-based visibility", err);
        return false;
    }
}

/** The setting was toggled: re-apply (or stand down) without a reload. */
export async function onFogSettingChanged() {
    if (fogEnabled()) await applySceneVisionMode();
    repaintFog();
}

/* ==========================================================================
 * DATA — who has seen what
 * ========================================================================== */

function allDiscovered() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.discoveredRooms) ?? {};
    } catch {
        return {};
    }
}

/** Rooms this scene's ledger has recorded for one actor. */
export function discoveredFor(sceneId, actorId) {
    return allDiscovered()[sceneId]?.[actorId] ?? [];
}

/**
 * Overwrite one scene's whole discovery matrix in one write — the Fog tab's
 * Apply button, which edits every character's row at once rather than one
 * room at a time the way `recordDiscovery` does during play.
 *
 * @param {object} matrix  `{ [actorId]: [roomName, ...] }`
 */
export async function saveDiscoveryMatrix(scene, matrix) {
    if (!game.user.isGM || !scene) return;
    const all = allDiscovered();
    await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, { ...all, [scene.id]: matrix });
}

/**
 * Record that a character has now seen a room, if they had not already.
 *
 * GM-only, and only the PRIMARY one writes — `updateToken` fires on every
 * client, so there is no need for a player-to-GM bridge the way Search
 * tokens or the answer key need one; whichever GM's client Foundry has
 * elected primary just reacts to the same hook everybody else's does.
 */
async function recordDiscovery(scene, actor, room) {
    if (!isPrimaryGm() || !scene || !actor || !room) return false;

    const all = allDiscovered();
    const forScene = all[scene.id] ?? {};
    const forActor = forScene[actor.id] ?? [];
    if (forActor.includes(room)) return false;

    const next = {
        ...all,
        [scene.id]: { ...forScene, [actor.id]: [...forActor, room] }
    };
    await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, next);
    debug(`${actor.name} discovered "${room}" on ${scene.name}.`);
    return true;
}

/**
 * Mark every room on a scene discovered, or forget them all, for one actor —
 * or for everyone at once when `actorId` is omitted. The Fog tab's two
 * buttons in Room Setup.
 */
export async function setDiscovery(scene, { actorId = null, rooms = [], value } = {}) {
    if (!game.user.isGM || !scene) return;

    const all = allDiscovered();
    const forScene = { ...(all[scene.id] ?? {}) };
    const actorIds = actorId ? [actorId] : Object.keys(forScene).length
        ? Array.from(new Set([...Object.keys(forScene), ...(await studentActorIds())]))
        : await studentActorIds();

    for (const id of actorIds) {
        forScene[id] = value ? Array.from(new Set(rooms)) : [];
    }

    await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, { ...all, [scene.id]: forScene });
}

async function studentActorIds() {
    const { studentActors } = await import("./monokuma.mjs");
    return studentActors().map(a => a.id);
}

/** Wipe the whole ledger. Called from season reset. */
export async function clearAllDiscovery() {
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, {});
}

/**
 * Every room this VIEWER's own characters currently know about on this
 * scene — the "visited" half of the three states.
 *
 * The Mastermind's exception lives here and nowhere else: every named room
 * on the scene counts, because they drew the building. This never changes
 * which room is CURRENT — see `myCurrentRooms` — so it never lets them see
 * who is standing where, only that the room exists and roughly what is in it.
 */
function myDiscoveredRooms(scene) {
    if (!scene) return new Set();

    if (iAmTheMastermind()) {
        return new Set(Array.from(scene.regions ?? []).map(r => r.name).filter(Boolean));
    }

    const rooms = new Set();
    for (const actor of game.actors) {
        if (actor.type !== "character" || !actor.isOwner) continue;
        for (const room of discoveredFor(scene.id, actor.id)) rooms.add(room);
    }
    return rooms;
}

/**
 * Every room one of the VIEWER's own tokens is standing in RIGHT NOW.
 *
 * Deliberately not the ledger: the current room is true the instant a token
 * lands there, before the primary GM's write and the setting sync that
 * follows it ever arrive, and a player should not watch their own floor stay
 * fogged for a network round-trip after they have already walked onto it.
 */
function myCurrentRooms() {
    const rooms = new Set();
    for (const token of canvas?.tokens?.placeables ?? []) {
        if (!token.isOwner || token.actor?.type !== "character") continue;
        const room = roomOfToken(token.document);
        if (room) rooms.add(room);
    }
    return rooms;
}

/* ==========================================================================
 * THE LAYER
 * ========================================================================== */

/**
 * Find or create the fog container: above everything that draws the WORLD
 * (the map, tiles, tokens, lighting), below everything that draws the
 * INTERFACE (the HUD, rulers, the controls).
 *
 * The index matters and is easy to get wrong. Sitting under the lighting
 * group means the fog is lit — a "dark" room comes out grey and half
 * readable — and sitting above the interface means the fog paints over the
 * token HUD and the ruler. So the position is resolved against the interface
 * group when there is one, and only falls back to "on top of everything" when
 * the canvas is shaped in a way this does not recognise.
 *
 * Re-resolved on every mount rather than cached: `canvas.stage` is rebuilt
 * from scratch on every scene change, so a cached container is a reference to
 * a destroyed display object.
 */
function mountLayer() {
    if (!canvas?.stage) return null;

    const existing = canvas.stage.children.find(c => c.name === LAYER_NAME);
    if (existing && !existing.destroyed) return existing;

    const container = new PIXI.Container();
    container.name = LAYER_NAME;
    container.eventMode = "none";
    container.interactiveChildren = false;

    let index = canvas.stage.children.length;
    const above = canvas.interface ?? canvas.controls ?? null;
    if (above && !above.destroyed) {
        const found = canvas.stage.getChildIndex(above);
        if (found >= 0) index = found;
    }
    canvas.stage.addChildAt(container, Math.min(Math.max(0, index), canvas.stage.children.length));
    return container;
}

/**
 * Second failsafe against the raw engine background flashing through: the
 * scene's own padding margin, and anywhere the camera can be pulled past the
 * edge of `canvas.dimensions.rect`, are painted by the renderer's OWN clear
 * colour whenever nothing else has drawn there yet. Setting it to the
 * palette's darkest ink means that gap reads as "more of our fog", not as
 * bare Foundry, even for the one frame before the fog sprite itself has
 * painted.
 */
function armRendererFailsafe() {
    try {
        const renderer = canvas?.app?.renderer;
        if (!renderer?.background) return;
        renderer.background.color = colourOf("--drpg-ink", 0x0d0b12);
    } catch (err) {
        debug("Could not set the renderer's failsafe background", err);
    }
}

/** Resolve a CSS custom property to the integer PIXI wants. Same trick as remnant-ring.mjs. */
function colourOf(name, fallback) {
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (!raw) return fallback;
        return foundry.utils.Color.from(raw).valueOf();
    } catch {
        return fallback;
    }
}

/**
 * Repaint the whole layer for the CURRENT user, from scratch.
 *
 * Not incremental on purpose: this only runs on the short list of triggers in
 * `registerFog`, none of them per-frame, so rebuilding the mask texture is a
 * handful of times per minute at most, never a handful of times per second —
 * see the header note on why this is not hooked to `refreshToken`.
 */
export function repaintFog() {
    try {
        if (!canvas?.ready || game.user.isGM || !fogEnabled()) {
            hideLayer();
            return;
        }

        const scene = canvas.scene;
        const container = mountLayer();
        if (!container || !scene) return;

        if (isEclipse()) {
            // Nobody sees anybody during an Eclipse (visibility.mjs); the fog
            // does not need its own opinion, so it simply steps aside rather
            // than fighting that screen for attention.
            hideLayer();
            return;
        }

        const regions = Array.from(scene.regions ?? []).filter(r => r.name);
        if (!regions.length) {
            // No rooms drawn at all: nothing to gate visibility on. Leave the
            // canvas exactly as Foundry would show it rather than fogging a
            // scene the GM has not built rooms into yet.
            hideLayer();
            return;
        }

        container.visible = true;
        clearLayer(container);

        const dims = canvas.dimensions;
        const rect = dims?.rect ?? { x: 0, y: 0, width: dims?.width ?? 0, height: dims?.height ?? 0 };
        container.position.set(rect.x, rect.y);

        const current = myCurrentRooms();
        const discovered = myDiscoveredRooms(scene);

        /*
         * TWO sprites, each with a plain Graphics mask — not one sprite with
         * a graduated mask.
         *
         * The first version baked a single mask to a RenderTexture, erasing
         * the current room at alpha 1 and visited rooms at alpha 0.5 with
         * `BLEND_MODES.ERASE`, so that one fog sprite could show two
         * different strengths. That is the fragile path: it depends on ERASE
         * behaving inside an offscreen render pass, on the render texture's
         * premultiplied alpha, and on the sprite-mask filter sampling that
         * alpha rather than treating the mask as a silhouette. Any one of
         * those going the other way gives no fog at all, which is what
         * happened.
         *
         * A Graphics mask is a SILHOUETTE — reliable everywhere, but binary,
         * so one mask cannot express "half". Two sprites can: full-strength
         * fog masked to everything undiscovered, and a half-alpha veil masked
         * to the visited rooms. Same three states, nothing exotic under it.
         */
        const undiscovered = buildFogSprite(rect, 1);
        undiscovered.mask = roomMask(rect, regions, region =>
            !current.has(region.name) && !discovered.has(region.name), { invert: true });
        container.addChild(undiscovered, undiscovered.mask);

        const visited = regions.filter(r => !current.has(r.name) && discovered.has(r.name));
        if (visited.length) {
            const veil = buildFogSprite(rect, VEIL_ALPHA);
            veil.mask = roomMask(rect, visited, () => true);
            container.addChild(veil, veil.mask);
        }
    } catch (err) {
        error("Could not repaint the fog of war", err);
    }
}

/**
 * Empty the layer, masks included.
 *
 * A mask assigned to `sprite.mask` is ALSO added to the container as a child
 * here (PIXI requires a Graphics mask to be in the scene graph to be
 * transformed with it), so `removeChildren()` does reach them — but the
 * `.mask` reference has to be dropped first, or destroying the sprite leaves
 * the filter pointing at a destroyed Graphics for one frame.
 */
function clearLayer(container) {
    for (const child of container.removeChildren()) {
        child.mask = null;
        child.destroy({ children: true });
    }
}

function hideLayer() {
    const container = canvas?.stage?.children?.find(c => c.name === LAYER_NAME);
    if (container) container.visible = false;
}

function isEclipse() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.clock)?.eclipse === true;
    } catch {
        return false;
    }
}

/* ---- the fog texture itself -------------------------------------------- */

let fogTexture = null;

/** Generated once and cached: an animated raster in the module's own ink. */
function fogBaseTexture() {
    if (fogTexture && !fogTexture.destroyed) return fogTexture;

    const size = 128;
    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d");

    const ink = cssColour("--drpg-ink", "#1a1620");
    const bone = cssColour("--drpg-bone", "#e8e3ec");

    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, size, size);

    // Diagonal stripes and scattered points, in the monochrome-Monokuma spirit
    // the plan asks for — subtle enough that it reads as texture, not pattern,
    // at the zoom level a token actually plays at.
    ctx.strokeStyle = bone;
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 2;
    for (let x = -size; x < size * 2; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + size, size);
        ctx.stroke();
    }

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = bone;
    const dots = 24;
    // Deterministic, not random: a fresh texture on every reload should not
    // shift the pattern under a GM's feet for no reason.
    let seed = 17;
    const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    for (let i = 0; i < dots; i++) {
        ctx.beginPath();
        ctx.arc(rand() * size, rand() * size, 1 + rand() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    fogTexture = PIXI.Texture.from(canvasEl);
    return fogTexture;
}

function cssColour(name, fallback) {
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return raw || fallback;
    } catch {
        return fallback;
    }
}

/**
 * The drift tickers, one per live sprite.
 *
 * A single module-level `driftTicker` was wrong the moment there were two fog
 * sprites: the second call replaced the first's ticker, so the undiscovered
 * fog stopped moving as soon as a veil appeared. Each sprite now owns its own,
 * and each removes itself when its sprite is destroyed on the next repaint.
 */
function driftFor(sprite, speed) {
    const tick = () => {
        if (sprite.destroyed) {
            canvas.app?.ticker?.remove(tick);
            return;
        }
        sprite.tilePosition.x += 0.05 * speed;
        sprite.tilePosition.y += 0.03 * speed;
    };
    canvas.app?.ticker?.add(tick);
}

function buildFogSprite(rect, alpha) {
    const sprite = new PIXI.TilingSprite(fogBaseTexture(), rect.width, rect.height);
    sprite.tileScale.set(4, 4);
    sprite.alpha = alpha;
    // The veil drifts slower than the full fog, so the two read as depth
    // rather than as one sheet cut into pieces.
    driftFor(sprite, alpha < 1 ? 0.6 : 1);
    return sprite;
}

/* ---- the masks: plain silhouettes, one per fog strength ------------------ */

/**
 * A Graphics silhouette covering the regions `keep` accepts — or, with
 * `invert`, the whole scene MINUS those regions, cut out with `beginHole`.
 *
 * Binary by nature: a Graphics mask is a shape, not a gradient. That is
 * exactly why it is reliable, and why the caller uses two of them at
 * different sprite alphas rather than one graduated mask (see `repaintFog`).
 *
 * Positioned at `-rect.x/-rect.y` because region polygons are in scene
 * coordinates while the layer itself is translated to the padded rect's
 * origin.
 */
function roomMask(rect, regions, keep, { invert = false } = {}) {
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff, 1);

    if (invert) {
        mask.drawRect(0, 0, rect.width, rect.height);
        mask.beginHole();
        for (const region of regions) {
            if (keep(region)) continue;          // stays fogged: not a hole
            traceRegionPathsAt(mask, region, rect);
        }
        mask.endHole();
    } else {
        for (const region of regions) {
            if (!keep(region)) continue;
            traceRegionPathsAt(mask, region, rect);
        }
    }

    mask.endFill();
    return mask;
}

/**
 * Trace a region's real shape onto a Graphics — `RegionDocument#polygons`
 * first, the raw `shapes` array as the fallback, the same ordering
 * `movement.mjs`'s `boundsOf` uses and for the same reason: not every scene
 * state exposes the rendered placeable's computed geometry. Path only, no
 * fill, so the caller decides whether it is a fill, a hole or a stroke.
 *
 * Coordinates are shifted from SCENE space into the layer's own space, since
 * the fog container is translated to the padded rect's origin.
 */
function traceRegionPathsAt(graphics, region, rect) {
    const polys = region?.polygons ?? region?.object?.polygons;
    if (polys?.length) {
        for (const poly of polys) {
            const pts = poly.points ?? poly;
            if (!pts?.length) continue;
            graphics.drawPolygon(shift(pts, rect));
        }
        return true;
    }

    let drew = false;
    for (const shape of region?.shapes ?? []) {
        if (shape.points?.length) {
            graphics.drawPolygon(shift(shape.points, rect));
            drew = true;
        } else if (Number.isFinite(shape.x) && Number.isFinite(shape.width)) {
            graphics.drawRect(shape.x - rect.x, shape.y - rect.y, shape.width, shape.height);
            drew = true;
        } else if (Number.isFinite(shape.radiusX)) {
            graphics.drawEllipse(shape.x - rect.x, shape.y - rect.y, shape.radiusX, shape.radiusY);
            drew = true;
        } else if (Number.isFinite(shape.radius)) {
            graphics.drawCircle(shape.x - rect.x, shape.y - rect.y, shape.radius);
            drew = true;
        }
    }
    return drew;
}

function shift(points, rect) {
    const out = new Array(points.length);
    for (let i = 0; i < points.length; i += 2) {
        out[i] = points[i] - rect.x;
        out[i + 1] = points[i + 1] - rect.y;
    }
    return out;
}

/* ==========================================================================
 * DISCOVERY: THE MOMENT, NOT JUST THE STATE
 * ========================================================================== */

async function onUpdateToken(tokenDoc, changes) {
    if (changes.x === undefined && changes.y === undefined) return;

    // Local half: MY view depends on where MY characters are standing right
    // now, whoever moved. Repainting here is what makes a player's own
    // crossing light their new room up instantly, rather than waiting on the
    // primary GM's write and the setting sync that follows it.
    try {
        if (tokenDoc.actor?.isOwner) {
            const before = lastMineSignature;
            const after = signatureOf(myCurrentRooms());
            if (before !== after) {
                lastMineSignature = after;
                const newlyEntered = wasJustDiscoveredByMe(tokenDoc);
                repaintFog();
                if (newlyEntered) playDiscoveryAnimation(newlyEntered, tokenDoc);
            }
        }
    } catch (err) {
        debug("Fog: could not react to an owned token's move", err);
    }

    // The write side: primary GM only, straight off the hook every client
    // gets — see the header note on `recordDiscovery`.
    if (!isPrimaryGm()) return;
    try {
        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") return;
        const scene = tokenDoc.parent;
        const room = roomOfToken(tokenDoc);
        if (!room) return;
        await recordDiscovery(scene, actor, room);
    } catch (err) {
        error("Could not record a room discovery", err);
    }
}

/** Signature of a room set, cheap enough to compare on every owned move. */
let lastMineSignature = "";
function signatureOf(rooms) {
    return Array.from(rooms).sort().join("|");
}

/**
 * Is the room this token just entered new to ME — not yet in my own ledger
 * entry, on either the setting OR this session's local memory of what has
 * already played its reveal? Returns the room name, or `null`.
 *
 * Read from the setting rather than trusting `myCurrentRooms()` alone: a
 * token can re-enter a room it left ten minutes ago, and that must not
 * replay the animation — the guide's own "ponowne wejście... nie odpala
 * animacji" from the plan's verification list.
 */
const animatedAlready = new Set();
function wasJustDiscoveredByMe(tokenDoc) {
    const actor = tokenDoc.actor;
    const scene = tokenDoc.parent;
    if (!actor || !scene) return null;

    const room = roomOfToken(tokenDoc);
    if (!room) return null;

    const key = `${scene.id}.${actor.id}.${room}`;
    if (animatedAlready.has(key)) return null;

    const known = discoveredFor(scene.id, actor.id).includes(room);
    if (known) {
        animatedAlready.add(key);
        return null;
    }

    animatedAlready.add(key);
    return room;
}

/**
 * The iris-open reveal, the gold outline flash, and the room name — all
 * purely visual, layered over whatever `repaintFog` has already drawn
 * correctly underneath. `prefers-reduced-motion` skips straight to the
 * instant reveal `repaintFog` already produced and only plays the (static)
 * outline and name.
 */
function playDiscoveryAnimation(room, tokenDoc) {
    const container = mountLayer();
    const scene = canvas?.scene;
    if (!container || !scene) return;

    const region = Array.from(scene.regions ?? []).find(r => r.name === room);
    if (!region) return;

    const reduced = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    if (reduced) {
        flashOutline(container, region);
        return;
    }

    const dims = canvas.dimensions;
    const rect = dims?.rect ?? { x: 0, y: 0 };
    const origin = { x: (tokenDoc?.x ?? 0) - rect.x, y: (tokenDoc?.y ?? 0) - rect.y };
    const bounds = regionBounds(region);
    const maxRadius = bounds
        ? Math.hypot(bounds.w, bounds.h)
        : Math.hypot(canvas.dimensions?.width ?? 1000, canvas.dimensions?.height ?? 1000) * 0.25;

    const overlay = new PIXI.Graphics();
    overlay.position.set(rect.x, rect.y);
    container.addChild(overlay);

    const state = { radius: 0 };
    const ink = colourOf("--drpg-ink", 0x1a1620);

    CanvasAnimation.animate([{ parent: state, attribute: "radius", to: maxRadius }], {
        duration: DISCOVERY_MS,
        ontick: () => {
            overlay.clear();
            overlay.beginFill(ink, 1);
            traceRegionPathsAt(overlay, region, rect);
            overlay.beginHole();
            overlay.drawCircle(origin.x, origin.y, state.radius);
            overlay.endHole();
            overlay.endFill();
        }
    }).then(() => {
        overlay.destroy();
        flashOutline(container, region);
    }).catch(() => overlay.destroy());
}

function regionBounds(region) {
    const polys = region?.polygons;
    if (!polys?.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of polys) {
        const pts = poly.points ?? [];
        for (let i = 0; i < pts.length; i += 2) {
            minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
            minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
        }
    }
    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function flashOutline(container, region) {
    const dims = canvas.dimensions;
    const rect = dims?.rect ?? { x: 0, y: 0 };

    const gold = colourOf("--drpg-gold", 0xffd23f);
    const outline = new PIXI.Graphics();
    outline.position.set(rect.x, rect.y);
    outline.lineStyle(3, gold, 1);
    traceRegionPathsAt(outline, region, rect);
    container.addChild(outline);

    const label = new PIXI.Text(region.name, {
        fontFamily: "DRPG Pixel, monospace",
        fontSize: 28,
        fill: gold,
        stroke: 0x000000,
        strokeThickness: 4
    });
    label.anchor.set(0.5, 1);
    const bounds = regionBounds(region);
    if (bounds) {
        label.position.set(bounds.x - rect.x + bounds.w / 2, bounds.y - rect.y + bounds.h / 2);
    }
    container.addChild(label);

    const state = { alpha: 1 };
    CanvasAnimation.animate([{ parent: state, attribute: "alpha", to: 0 }], {
        duration: OUTLINE_MS,
        ontick: () => { outline.alpha = state.alpha; label.alpha = state.alpha; }
    }).then(() => {
        outline.destroy();
        label.destroy();
    }).catch(() => {
        outline.destroy();
        label.destroy();
    });
}


/* ==========================================================================
 * THE GM'S OWN WARNING — how much of the scene belongs to no room at all
 * ========================================================================== */

/**
 * Percentage of the scene's own rect NOT covered by any Region's polygons.
 * A simple sum of areas, not a true union — two overlapping rooms would be
 * counted twice — which only ever makes the number an over-estimate of the
 * covered fraction, i.e. an UNDER-estimate of how much is missing. Good
 * enough for a warning line computed once when a GM opens a management
 * window; not something to spend a polygon-boolean library on.
 */
export function sceneUncoveredPercent(scene = canvas?.scene) {
    if (!scene) return 0;
    const dims = canvas?.dimensions;
    const total = (dims?.width ?? scene.width ?? 0) * (dims?.height ?? scene.height ?? 0);
    if (!total) return 0;

    let covered = 0;
    for (const region of scene.regions ?? []) {
        if (!region.name) continue;
        for (const poly of region.polygons ?? []) {
            covered += polygonArea(poly.points ?? []);
        }
    }
    const uncovered = Math.max(0, total - covered);
    return Math.round((uncovered / total) * 100);
}

function polygonArea(flat) {
    let area = 0;
    for (let i = 0; i < flat.length; i += 2) {
        const x1 = flat[i], y1 = flat[i + 1];
        const j = (i + 2) % flat.length;
        const x2 = flat[j], y2 = flat[j + 1];
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
}
