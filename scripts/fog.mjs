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

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS, iAmTheMastermind } from "./settings.mjs";
import { roomOfToken } from "./movement.mjs";
import { isMastermind } from "./mastermind.mjs";
import { isPrimaryGm, debug, log, warn, error, plural } from "./utils.mjs";
import { ENTER, BEAT } from "./motion.mjs";
import { playSfx } from "./sfx.mjs";

const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;

/**
 * Which build of this file the browser actually loaded.
 *
 * Not decoration. Foundry serves module scripts as ordinary static files and
 * the browser is free to answer a plain F5 out of its own cache, so "I reloaded
 * and nothing changed" and "the fix does not work" produce the same sentence
 * from the person testing. `diagnoseFog()` prints this, which turns that into a
 * fact. Bump it whenever the drawing behaviour changes.
 */
const FOG_BUILD = "2026-08-26 · glow-field-trend";

const LAYER_NAME = "drpgFog";
const FOG_SPRITE = "drpgFogSprite";
const RASTER_GROUP = "drpgFogRaster";
const RASTER_MASK = "drpgFogRasterMask";
const BACKDROP_LAYER = "drpgFogBackdrop";

/* --------------------------------------------------------------------------
 * THE RASTER — what stops full fog from reading as flat black.
 *
 * `--drpg-ink` is #1a1620, and at full opacity over a map that is exactly what
 * "black" looks like: the hue is there and nothing lets you see it. The fix is
 * not a lighter colour — an unvisited room has to stay unreadable — it is
 * texture. A fine bone raster with upright hairlines drifting across it gives
 * the dark a surface, and the ink starts reading as ink.
 *
 * TWO LAYERS THAT MOVE INDEPENDENTLY WITHOUT EVER INTERFERING, which took
 * three tries to get right and is worth writing down properly.
 *
 * The first version drifted the dots and the lines along the same axis at
 * different speeds. That is a moiré generator: the points where a line crosses
 * a dot travel across the screen, the two alphas compound there, and the fog
 * fills with bright specks crawling over it. Literally opposite directions on
 * one axis is the worst case of all, because the relative speed doubles.
 *
 * The second version composited both into one tile. No interference, because
 * nothing moved relative to anything — and no independent motion either.
 *
 * This one gets both by making the two layers geometrically incapable of
 * meeting:
 *
 *   the lines drift ONLY sideways      and sit in columns  x ≡ 0 (mod 32)
 *   the dots  drift ONLY vertically    and sit in columns  x ≡ 3,4,11,12,…
 *
 * Their horizontal phase never changes, so those column sets stay disjoint
 * forever: a line can never land on a dot, whatever either of them is doing.
 * The dots slide up behind the lines, the lines slide sideways past the dots,
 * and no pixel is ever painted by both.
 *
 * Both frequencies divide the tile exactly, which is what makes the repeat
 * invisible. Upright rather than diagonal because the isometric module on The
 * Forge rotates the whole canvas — see `bandQuad`.
 * ------------------------------------------------------------------------ */
const RASTER_TILE = 64;           // power of two: WebGL needs it to repeat
const RASTER_DOT_STEP = 8;
const RASTER_DOT_SIZE = 2;
/** Shifts every dot clear of the line columns. See the note above. */
const RASTER_DOT_INSET = 3;
/**
 * OPAQUE, AND DARKENED IN THE COLOUR RATHER THAN BY ALPHA.
 *
 * Transparency made the raster a different mark in every part of the scene:
 * over the veil the map tinted it, over full fog it did not, and tuning one
 * always spoiled the other. A solid colour is the same everywhere, and the
 * fog's own silhouette mask still softens it over veiled rooms — which is the
 * one variation that was ever wanted.
 */
const RASTER_ALPHA = 1;
/**
 * One hairline per tile, halved from two.
 *
 * Fewer lines is also less to alias: the finer a repeating pattern is, the
 * closer its frequency gets to the screen's own, and everything that has gone
 * wrong with this raster has gone wrong at that boundary. Must divide the tile
 * exactly or the repeat becomes visible — 64 and 32 are the options here, and
 * 128 with a doubled tile if this still wants thinning.
 */
const RASTER_LINE_STEP = 64;
/**
 * ONE DOT WIDE — Dawid's call, and it is the right one for a reason worth
 * keeping.
 *
 * A column one pixel wide never covers a whole screen pixel once the tile has
 * drifted by a fraction of one: it splits across two neighbouring columns in
 * shifting proportions, and linear filtering turns those proportions into a
 * continuous pulse of brightness. That is the flicker that survived the mipmap
 * work, the tile-scale pinning and the density cut. A column two pixels wide
 * always has at least one fully covered pixel in the middle; only its edges
 * soften. It is also exactly why the 2x2 specks never flickered while the
 * hairlines always did — the answer was sitting in the same tile the whole
 * time.
 */
const RASTER_LINE_WIDTH = RASTER_DOT_SIZE;

/**
 * Pixels per second across the SCREEN — see `startDrift`, which divides these
 * by the tile scale so the speed does not change with the zoom.
 *
 * One axis each, and that is the whole trick: perpendicular motion is what lets
 * them move independently without ever crossing. Slow on purpose — you should
 * notice it only after resting your eyes on the dark for a moment.
 */
const RASTER_DOT_DRIFT = { x: 0, y: -6 };
const RASTER_LINE_DRIFT = { x: 8, y: 0 };

/*
 * THE RASTER IS GLASS IN FRONT OF THE MAP, NOT PAINT ON IT.
 *
 * It began anchored to the scene, on the reasoning that fog is a place rather
 * than an effect on the lens. Every artefact this layer has produced came out
 * of that one decision: a pattern fixed in scene units has a screen frequency
 * that changes with the zoom, so at some distance it always crosses the
 * resolution of the display, and past that point no sampler, mipmap or tile
 * scale saves it. Four rounds of work went into pushing that distance further
 * out without ever removing it.
 *
 * Held still against the SCREEN, the pattern has one frequency for ever. It
 * cannot alias, it cannot moiré, and the drift is the only motion in it —
 * which is the effect that was wanted in the first place. The fog it decorates
 * is still a place: the silhouette masking this is drawn in scene coordinates
 * and moves with the map, so the texture appears exactly over the fogged
 * ground and nowhere else. The glass is what does not move; what shows through
 * it does.
 */


/**
 * How much fog stays over a room you have been to but are not standing in.
 *
 * Judged on a live map rather than picked: 0.5 read as "a room with the lights
 * off", which is not the same claim as "somewhere I have been and am not now".
 * 0.6 keeps the layout and the furniture legible while putting the room you ARE
 * in clearly ahead of it. One constant — the raster of stage 4 inherits it,
 * because that layer is masked by this one's own alpha.
 */
const VEIL_ALPHA = 0.6;
/**
 * Longest side of the fog's render texture, in pixels.
 *
 * The fog is drawn once into a texture the size of the padded scene rect and
 * shown as a single Sprite, so this caps what that costs on a very large map:
 * a 6000px scene is rendered at a third of its size and scaled back up, which
 * softens the edge of the fog by a couple of pixels and nothing else. Small
 * scenes — the usual case — are never scaled at all.
 */
const MAX_FOG_TEXTURE = 2048;
/**
 * How far the fog is drawn BEYOND the scene's own rectangle, in pixels.
 *
 * Its edge used to sit exactly on the edge of the map, and that is where a
 * thin dark line appeared whenever the camera moved. Not a gap in the fog —
 * the ink reached, and the backdrop under it is the same ink anyway — but a gap
 * in the RASTER. The raster is pinned to the screen while the silhouette that
 * masks it lives in the scene, and one frame of disagreement between the two is
 * enough to leave a hairline of untextured ink right where they meet. Standing
 * still they agree to the pixel, which is why it only ever showed in motion.
 *
 * Chasing that synchronisation frame by frame would be fragile. Moving the seam
 * a couple of hundred pixels off the map costs a slightly larger texture and
 * puts the disagreement somewhere nobody is looking — and, as a second gain,
 * covers the map's own edge, which The Forge's isometric view draws as a pale
 * line of its own.
 */
const FOG_MARGIN = 256;
/**
 * How long the fog takes to cross-fade from one state to the next.
 *
 * The layer is rebuilt whole on every repaint, so without this a room changing
 * from dark to veil SNAPS — one frame black, the next frame half. That reads as
 * a glitch rather than as memory settling in, which is the opposite of what the
 * three states are for. Short enough not to lag behind a token that is already
 * standing somewhere new.
 *
 * Reads the interface's own enter time rather than carrying one, which moves it
 * from 220 to 180 — below anything an eye can separate, and the point is not
 * the forty milliseconds. It is that the switch in motion.css now reaches the
 * canvas: a reader who asks their system for stillness gets a fog layer that
 * settles instantly instead of one that kept crossfading because its duration
 * was written into a script the media query could not touch.
 *
 * A function, not a constant, for exactly that reason — captured once at load
 * it would have been the same unreachable number in a different shape. The 1ms
 * floor is for `CanvasAnimation`, which divides by the duration.
 */
const fadeMs = () => Math.max(ENTER(), 1);
/**
 * The reveal, slowed down on Dawid's call after watching it on a live map.
 * 450ms was quick enough to register as a flicker rather than as a gesture; the
 * outline and the name run alongside it rather than after it, so the whole
 * thing has to breathe for about as long as it takes to look at the room.
 */
/*
 * Slowed two and a half times after watching it land, on Dawid's call. A reveal
 * is the one moment the fog is allowed to be the centre of attention — it says
 * "you have never been here before", and at two seconds flat that read as a
 * transition rather than as an announcement.
 */
const REVEAL_SLASH_MS = 650;      // the lines cut in
const REVEAL_HOLD_MS = 2500;      // and stand there
const REVEAL_PART_MS = 2250;      // before opening like a curtain
const DISCOVERY_MS = REVEAL_SLASH_MS + REVEAL_HOLD_MS + REVEAL_PART_MS;
const OUTLINE_MS = DISCOVERY_MS;

/* ==========================================================================
 * REGISTRATION
 * ========================================================================== */

export function registerFog() {
    /*
     * EACH STEP GUARDED SEPARATELY, because they used to share one handler and
     * that is how this feature spent two releases not existing at all: the
     * layer-mounting step threw (see `mountLayer`), Foundry logged it and
     * moved on, and `repaintFog()` — the line after it — was simply never
     * reached. A canvas hook that half-runs is indistinguishable on screen
     * from a canvas hook that never fired, so no step is allowed to take the
     * next one down with it.
     */
    // Started here so it is settled long before any room needs naming.
    ensurePixelFont();

    Hooks.on("canvasReady", () => {
        step("scene vision mode", () => applySceneVisionMode());
        step("renderer failsafe", () => armRendererFailsafe());
        // Before the first paint, so a character who has been standing in a
        // room since before this client connected is not shown their own floor
        // under full fog for one frame.
        step("local discovery mirror", () => rememberMine());
        step("first paint", () => repaintFog());
        // A character who is STANDING in a room nobody here has seen deserves
        // the reveal too. It used to need a step of movement to fire, so the
        // first room of a session — the one you wake up in — was the one room
        // that never got named.
        step("reveal on arrival", () => revealStartingRooms());
        // WITHOUT THIS THE FIRST STEP REPLAYS THE ARRIVAL. `lastMineSignature`
        // starts empty, so the first move a character makes — even across two
        // feet of the room it woke up in — read as "the set of rooms I occupy
        // has changed" and announced the room a second time.
        step("remember where we started", () => { lastMineSignature = signatureOf(myCurrentRooms()); });
        // After it: this writes a world setting, and the paint must not wait
        // on a round trip to the database to put something on screen.
        step("seed discovery", () => seedDiscovery());
    });

    // A player's own token appearing or moving changes which room is theirs.
    Hooks.on("updateToken", onUpdateToken);
    Hooks.on("createToken", () => {
        step("local discovery mirror", () => rememberMine());
        step("repaint", () => repaintFog());
        step("seed discovery", () => seedDiscovery());
    });
    Hooks.on("deleteToken", () => repaintFog());


    // The Eclipse hides everyone from everyone (see eclipse.mjs /
    // visibility.mjs) but says nothing about rooms — the fog only needs to
    // catch up once it ends, when ordinary room logic starts mattering again.
    /*
     * BOTH ENDS OF AN ECLIPSE, not just the far one.
     *
     * This used to repaint only when an Eclipse ENDED, which was right while
     * the fog stood aside for the duration and only had to come back afterwards.
     * Since it started veiling instead, the beginning changes the picture too —
     * every room drops to the veil, the one you are standing in included — and
     * nothing was redrawing it. The room a player was in stayed cleared until
     * they happened to walk somewhere.
     */
    Hooks.on("drpgEclipseChanged", () => repaintFog());

    // Every scene with rooms, once a session, on the one GM entitled to write.
    // `canvasReady` still covers the scene in front of the GM; this covers the
    // ones nobody has opened yet, which is where the trap was.
    Hooks.once("ready", () => step("prepare scenes", () => prepareScenes()));

    // Leaving a scene does not tear this layer down — `RenderedCanvasGroup`
    // sets `tearDownChildren = false` — so the texture would otherwise sit on
    // the GPU for a scene nobody is looking at until the next repaint.
    Hooks.on("canvasTearDown", () => {
        try {
            hideLayer();
            dropBackdrop();
            // Outlines and glows belong to the scene being left, and the glow
            // owns a render texture of its own — see `freeOwned`.
            clearTransient();
            // The tiles are bound to the renderer that is going away, and the
            // palette may have changed by the time we come back.
            dropRasterTiles();
        } catch { /* leaving anyway */ }
    });
}

/** Run one registration step without letting it stop the ones after it. */
function step(label, fn) {
    try {
        const result = fn();
        // ASYNC STEPS COUNT TOO. `applySceneVisionMode` writes to the scene and
        // `seedDiscovery` writes a world setting; both return promises, and a
        // rejected promise walks straight past a try/catch. A world write that
        // fails without saying so is the exact failure shape this file keeps
        // paying for — see the note on `fogOffPatch` for the last one.
        if (typeof result?.catch === "function") {
            result.catch(err => error(`Fog: "${label}" failed after returning`, err));
        }
    } catch (err) {
        error(`Fog: "${label}" failed; the remaining steps still run`, err);
    }
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
 *   tokenVision   off   no cones, no per-token sight polygons at all
 *   fog           off   Foundry stops drawing and recording its own
 *                       "explored" mask — `fog.mode` on v14, the deprecated
 *                       `fog.exploration` before it; see `fogOffPatch`, and
 *                       note that getting this field wrong is what made three
 *                       rounds of fixes appear to change nothing
 *   globalLight   on    the map is lit everywhere, so what a player can see
 *                       is decided by our fog and nothing else
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

    const update = { ...fogOffPatch(scene) };
    if (scene.tokenVision !== false) update.tokenVision = false;
    if (scene.environment?.globalLight?.enabled !== true) {
        update["environment.globalLight.enabled"] = true;
    }
    if (!Object.keys(update).length) return false;

    // WHAT THE SCENE LOOKED LIKE BEFORE THE MODULE TOOK IT OVER.
    //
    // Switching this setting off used to leave every scene with Foundry's own
    // vision permanently disabled: the module took the configuration and never
    // gave it back, so "let us see how it plays without the region fog" was a
    // one-way door. Recorded once, on the first write only, so re-running this
    // never overwrites the original with the module's own values.
    if (scene.getFlag(MODULE_ID, VISION_BEFORE) === undefined) {
        update[`flags.${MODULE_ID}.${VISION_BEFORE}`] = {
            tokenVision: scene.tokenVision,
            fogMode: scene.fog?.mode ?? null,
            fogExploration: scene.fog?.mode === undefined ? (scene.fog?.exploration ?? null) : null,
            globalLight: scene.environment?.globalLight?.enabled ?? null
        };
    }

    try {
        await scene.update(update);
        log(`Room fog: took Foundry's own vision off "${scene.name}" so rooms decide visibility.`);
        return true;
    } catch (err) {
        error("Could not switch the scene to room-based visibility", err);
        return false;
    }
}

/** Flag holding a scene's vision settings from before the module changed them. */
const VISION_BEFORE = "visionBefore";

/**
 * Put EVERY scene that has rooms into room-based visibility.
 *
 * `applySceneVisionMode` only ever converted the scene the GM happened to be
 * looking at, because that is where `canvasReady` fires. A scene pushed to the
 * players without the GM opening it first therefore stayed on Foundry's own
 * vision — and on v14 that is not a cosmetic difference: `Scene#availableLevels`
 * gives a player only the levels they have OBSERVER of a token on, so the map
 * can fail to render for them at all. Nothing about that failure points at this
 * module, which is why it is worth closing rather than documenting.
 *
 * Primary GM only, and idempotent: scenes already converted cost one comparison.
 */
export async function prepareScenes() {
    if (!isPrimaryGm() || !fogEnabled()) return { changed: 0, failed: [] };

    let changed = 0;
    const failed = [];
    for (const scene of game.scenes ?? []) {
        if (!Array.from(scene.regions ?? []).some(r => r.name)) continue;
        try {
            if (await applySceneVisionMode(scene)) changed++;
        } catch (err) {
            failed.push(scene.name);
            error(`Could not prepare "${scene.name}" for room-based visibility`, err);
        }
    }

    // SAID OUT LOUD, both ways. A write to a world document that fails quietly
    // is the shape of failure this file has paid for more than once.
    if (changed) {
        ui.notifications.info(plural("DRPG.Fog.scenesPrepared", { count: changed }));
    }
    if (failed.length) {
        ui.notifications.warn(game.i18n.format("DRPG.Fog.scenesFailed", { scenes: failed.join(", ") }));
    }
    return { changed, failed };
}

/** Give a scene back the vision settings it had before the module changed them. */
export async function restoreSceneVisionMode(scene) {
    if (!game.user.isGM || !scene) return false;

    const before = scene.getFlag(MODULE_ID, VISION_BEFORE);
    if (!before) return false;

    const update = {};
    if (typeof before.tokenVision === "boolean") update.tokenVision = before.tokenVision;
    if (Number.isFinite(before.fogMode)) update["fog.mode"] = before.fogMode;
    else if (typeof before.fogExploration === "boolean") update["fog.exploration"] = before.fogExploration;
    if (typeof before.globalLight === "boolean") {
        update["environment.globalLight.enabled"] = before.globalLight;
    }

    try {
        if (Object.keys(update).length) await scene.update(update);
        // `unsetFlag`, not a `-=` key in the same update: key deletion by that
        // spelling silently does nothing here, which would leave the scene
        // carrying a record of a state it is no longer in.
        await scene.unsetFlag(MODULE_ID, VISION_BEFORE);
        log(`Room fog: gave "${scene.name}" its original vision settings back.`);
        return true;
    } catch (err) {
        error(`Could not restore vision settings on "${scene.name}"`, err);
        return false;
    }
}

async function restoreScenes() {
    if (!game.user.isGM) return 0;
    let restored = 0;
    for (const scene of game.scenes ?? []) {
        if (await restoreSceneVisionMode(scene)) restored++;
    }
    return restored;
}

/**
 * One line per scene with rooms: is it ready for players, and how much of it
 * belongs to no room. Text, for the GM's pre-session checks.
 */
export function diagnoseScenes() {
    const rows = [];
    for (const scene of game.scenes ?? []) {
        const rooms = Array.from(scene.regions ?? []).filter(r => r.name).length;
        if (!rooms) continue;

        const off = fogDisabledValue();
        const ready = scene.tokenVision === false
            && scene.environment?.globalLight?.enabled === true
            && (scene.fog?.mode === undefined || scene.fog.mode === off);

        rows.push(`${ready ? "ok  " : "!!  "}${scene.name} — ${rooms} rooms, `
            + `${sceneUncoveredPercent(scene)}% of the map belongs to no room`);
    }

    if (!rows.length) return game.i18n.localize("DRPG.Fog.noRoomScenes");
    return rows.join("\n");
}

/**
 * Switch Foundry's OWN fog exploration off, whatever this build calls it.
 *
 * THIS IS THE FIELD THAT WAS SILENTLY DOING NOTHING. The first version wrote
 * `fog.exploration: false`, which is correct up to v13 and DEPRECATED in v14
 * in favour of `fog.mode` — so on a v14 world the write landed on a field
 * nothing reads, Foundry's own exploration fog stayed on, and it was
 * Foundry's fog the players were looking at the whole time. The module's own
 * layer was mounted and drawing underneath something that had never been
 * turned off, which is why three rounds of fixing the layer changed nothing
 * on screen: the layer was never the thing being seen.
 *
 * The value is DISCOVERED rather than hard-coded. v14 replaced a boolean with
 * a three-way mode (disabled / individual / shared), and guessing the literal
 * spelling of "disabled" is how this class of bug repeats — so the constant
 * table is searched for the member that means "off", and only if there is no
 * table at all does it fall back to a plain string.
 */
function fogOffPatch(scene) {
    const fog = scene.fog ?? {};

    // v14+: `fog.mode`. Read `mode` FIRST — touching `fog.exploration` on v14
    // logs a deprecation warning, so the modern field is probed first and the
    // old one is only read on a build that has no `mode` at all.
    if (fog.mode !== undefined) {
        const off = fogDisabledValue();
        return off === undefined || fog.mode === off ? {} : { "fog.mode": off };
    }

    // v13 and earlier: a boolean.
    return fog.exploration === false ? {} : { "fog.exploration": false };
}

/** Whichever member of Foundry's fog-mode enum means "do not explore". */
function fogDisabledValue() {
    const table = CONST?.FOG_MODES ?? CONST?.FOG_EXPLORATION_MODES ?? null;
    if (!table) return "disabled";

    for (const [key, value] of Object.entries(table)) {
        if (/^(disabled|none|off)$/i.test(key)) return value;
    }

    // A table we do not recognise: prefer the numerically lowest member, which
    // is how Foundry orders "least" first in every other enum of this shape,
    // rather than inventing a string it may not accept.
    const values = Object.values(table);
    const numeric = values.filter(v => typeof v === "number");
    if (numeric.length) return Math.min(...numeric);

    warn("Fog: could not tell which fog mode means 'disabled'; leaving Foundry's own fog alone.", table);
    return undefined;
}

/** The setting was toggled: re-apply (or stand down) without a reload. */
export async function onFogSettingChanged() {
    if (fogEnabled()) await prepareScenes();
    else await restoreScenes();
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

/**
 * Every room ANY character has recorded on this scene.
 *
 * The Monokuma's view is built on this rather than on the list of rooms that
 * exist: the mastermind knows the building, but what the class has actually
 * walked into is a different fact, and it is the one the GM is running the game
 * against. A room nobody has found yet stays under the veil for them too.
 */
function ledgerRooms(scene) {
    const rooms = new Set();
    if (!scene) return rooms;
    for (const list of Object.values(allDiscovered()[scene.id] ?? {})) {
        for (const room of list ?? []) rooms.add(room);
    }
    return rooms;
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

    /* THE MASTERMIND LEAVES NO TRACK IN THE LEDGER (Dawid, 26.08).
       -----------------------------------------------------------------------
       The GM's own veil is `ledgerRooms` — the union of every actor's row —
       so recording the Mastermind's walks would lift the veil on rooms only
       they have been to, and the GM's map would quietly narrate the season's
       secret moving around the building. They lose nothing by the skip: their
       own fog already counts every room as known (`myDiscoveredRooms`),
       because they built the place. `isMastermind` answers on GM clients and
       this only ever runs on the primary GM's. */
    if (isMastermind(actor)) return false;

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

/** One deferred seed at a time — see the readiness guard in `seedDiscovery`. */
let seedWaitingForReady = false;

/**
 * Record the room every character on a scene is ALREADY STANDING IN.
 *
 * THE LEDGER USED TO HAVE NO WAY OF LEARNING THIS. `recordDiscovery` hangs off
 * `updateToken` and begins by refusing anything that is not a position change,
 * which is correct for a move and useless for a start: a character who has
 * been in the Dinner Hall since before the session began never moved, so the
 * ledger never heard of the Dinner Hall, and the player's own floor came up
 * under full fog. On a fresh world every single room was in that state, which
 * is why `discoveredRooms` was an empty object and nothing was ever veiled.
 *
 * Written as ONE settings update for the whole scene rather than one per
 * token: sixteen students on a map would otherwise be sixteen world writes and
 * sixteen rounds of sync, all inside `canvasReady`.
 *
 * Reads `scene.tokens` rather than the canvas, so it does not depend on what
 * has finished drawing.
 */
export async function seedDiscovery(scene = canvas?.scene) {
    // `canvasReady` outruns `ready` at boot, and a world setting may not be
    // written before the game is ready — so the write threw, `step()` dutifully
    // logged it, and on a fresh world the seed simply never happened: a
    // character who never moved stayed under full fog, which is the exact bug
    // this seed exists to fix. Deferred rather than dropped, and once, however
    // many callers pile up before ready; the deferred run re-reads the canvas
    // scene, which at boot is the same scene this call was asked about.
    if (!game.ready) {
        if (!seedWaitingForReady) {
            seedWaitingForReady = true;
            Hooks.once("ready", () => {
                seedWaitingForReady = false;
                step("seed discovery (deferred to ready)", () => seedDiscovery());
            });
        }
        return false;
    }
    if (!isPrimaryGm() || !scene) return false;

    const all = allDiscovered();
    const forScene = { ...(all[scene.id] ?? {}) };
    let changed = false;

    for (const tokenDoc of scene.tokens ?? []) {
        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") continue;
        // Same skip as `recordDiscovery`, for the same reason: the seed is
        // just discovery for people who were already standing somewhere.
        if (isMastermind(actor)) continue;

        const room = roomOfToken(tokenDoc);
        if (!room) continue;

        const known = forScene[actor.id] ?? [];
        if (known.includes(room)) continue;

        forScene[actor.id] = [...known, room];
        changed = true;
    }

    if (!changed) return false;

    await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, { ...all, [scene.id]: forScene });
    debug(`Seeded the fog ledger with the rooms characters were already standing in on ${scene.name}.`);
    return true;
}

/**
 * THE VIEWER'S OWN COPY OF WHAT THEY HAVE SEEN — latency smoothing, not a
 * second source of truth.
 *
 * The ledger is the GM's and stays the GM's: that is the decision, and nothing
 * here writes to it. But the GM's write has to reach this client through
 * `settings.set` → `onChange` → `applyFor` → `SYNC.fog`, and `sync.mjs` adds a
 * 120ms coalescing window on top of the network. The player, meanwhile,
 * repaints the instant their own token lands. So for a fraction of a second the
 * room they have just walked OUT of is neither current nor yet in the ledger,
 * and it flashes full black before settling into the veil — a room going dark
 * behind you looks like the fog malfunctioning, not like memory.
 *
 * This set closes that window and nothing else. It lives in the page, dies on
 * reload, and every room in it will be in the ledger by then anyway. If a GM
 * never connects, it means a player sees their own history for this session
 * only — which is the accepted cost of "discovery requires a GM".
 *
 * Keys are JSON triples rather than a joined string. Room names are free text,
 * so any separator character is one a GM is allowed to type into a room name —
 * "Lab. Storage" splits a dotted key in the wrong place, and picking a stranger
 * character only moves the problem somewhere less obvious.
 */
const mirroredRooms = new Set();

const mirrorKey = (sceneId, actorId, room) => JSON.stringify([sceneId, actorId, room]);

/** Remember, on this client alone, where my own characters are standing now. */
function rememberMine(scene = canvas?.scene) {
    if (!scene) return;
    for (const tokenDoc of scene.tokens ?? []) {
        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character" || !actor.isOwner) continue;
        const room = roomOfToken(tokenDoc);
        if (room) mirroredRooms.add(mirrorKey(scene.id, actor.id, room));
    }
}

/** The mirror's rooms for one scene, filtered to actors this viewer still owns. */
function mirroredFor(scene) {
    const out = [];
    for (const key of mirroredRooms) {
        const [sceneId, actorId, room] = JSON.parse(key);
        if (sceneId !== scene.id) continue;
        // Ownership is re-checked rather than trusted from when it was written:
        // a GM can hand a character to somebody else mid-session.
        if (!game.actors.get(actorId)?.isOwner) continue;
        out.push(room);
    }
    return out;
}

/**
 * Bring the mirror back in line with a ledger that changed under it.
 *
 * The mirror only ever ADDS rooms, which is right for the one job it was built
 * for — smoothing the round-trip on a discovery this client made itself. But
 * the ledger can also SHRINK: the season reset wipes it, and the Fog tab's
 * "hide all" empties it per scene. Measured on two clients (2026-08-26): after
 * such a shrink the data was gone everywhere, yet every room this client had
 * walked through in the session stayed revealed until a reload, because
 * `myDiscoveredRooms` kept unioning the stale mirror in. A reset that only
 * takes effect after everyone relogs looks like a reset that did not work.
 *
 * So when the ledger arrives changed, mirror entries it no longer vouches for
 * are dropped, and what my tokens stand in right now is put straight back —
 * the floor under your feet never veils, reset or no reset. The one trade-off:
 * a discovery still in flight (my move made, the GM's write not yet landed)
 * can be pruned if somebody else's write lands in that same window; its own
 * write follows within the sync's coalescing window and repaints it back.
 */
export function reconcileMirror() {
    for (const key of Array.from(mirroredRooms)) {
        const [sceneId, actorId, room] = JSON.parse(key);
        if (!discoveredFor(sceneId, actorId).includes(room)) mirroredRooms.delete(key);
    }
    rememberMine();
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

    // The Mastermind drew the building: every room on the map counts as known
    // to them. This never says who is standing in one — that is
    // `myCurrentRooms`' business and not this function's.
    if (iAmTheMastermind()) {
        return new Set(Array.from(scene.regions ?? []).map(r => r.name).filter(Boolean));
    }

    // The GM sees what the class has found. See `ledgerRooms`.
    if (game.user.isGM) return ledgerRooms(scene);

    const rooms = new Set();
    for (const actor of game.actors) {
        if (actor.type !== "character" || !actor.isOwner) continue;
        for (const room of discoveredFor(scene.id, actor.id)) rooms.add(room);
    }
    // The GM's ledger is the record; this only covers the moments before it
    // has caught up. See `mirroredRooms`.
    for (const room of mirroredFor(scene)) rooms.add(room);
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
        if (!isMine(token)) continue;
        const room = roomOfToken(token.document);
        if (room) rooms.add(room);
    }
    return rooms;
}

/**
 * Whose position decides what THIS viewer sees cleared.
 *
 * A player owns their characters and that is the whole answer. A GM owns every
 * token on the map, so the same rule would make every room current and clear
 * the entire scene — the fog would exist and show nothing. For them it is the
 * Monokuma they are playing: the piece the GM actually moves around the board.
 *
 * Read off the flag rather than through `monokuma.mjs`, because this runs on
 * every token of every repaint and the module that owns that flag imports half
 * the system to answer the same question.
 */
function isMine(token) {
    const actor = token?.actor;
    if (!actor) return false;

    if (game.user.isGM) return Boolean(actor.getFlag?.(MODULE_ID, FLAGS.monokuma));
    return Boolean(token.isOwner) && actor.type === "character";
}

/* ==========================================================================
 * THE LAYER — fog everything, then erase what you are allowed to see.
 * --------------------------------------------------------------------------
 * THE SHAPE OF THIS CODE IS THE ANSWER TO A BUG THAT BLACKED OUT WHOLE MAPS.
 *
 * The version before this one filled the fogged rooms shape by shape, and then
 * expressed the remaining state — the parts of the map belonging to no Region,
 * which the design wants under permanent fog — as one full-scene rectangle with
 * a `beginHole()` cut for every room. PIXI triangulates a hole block with
 * earcut, and earcut BREAKS ON HOLES THAT TOUCH EACH OTHER. A floor plan whose
 * rooms share walls — eighteen of them on the scene where this was found — cuts
 * no holes at all, throws nothing, and leaves a solid black rectangle over the
 * map, the tokens and the player's own character. Confirmed on a live world on
 * 2026-08-22: hiding that single Graphics brought the whole map straight back,
 * while the same regions drawn as plain fills painted seventeen out of
 * seventeen correctly. It was never the geometry. It was the subtraction.
 *
 * So the model is inverted, and subtraction is done the way Foundry does its
 * own — `PIXI.BLEND_MODES.ERASE` into a render texture, exactly as
 * `CanvasVisibility` builds its vision mask:
 *
 *   1. the whole padded scene rect goes under full fog, margin included;
 *   2. rooms this player has VISITED erase half of it, leaving the veil;
 *   3. rooms this player is STANDING IN erase all of it.
 *
 * Everything the design wants falls out of that without a single subtraction
 * primitive: unvisited rooms are simply never erased, and neither is the space
 * between rooms. Rooms may touch, overlap or nest and none of it matters —
 * erasing is per pixel, not per triangle.
 *
 * The result is one texture and one Sprite. That is also what makes the raster
 * of stage 4 cheap: a Sprite of the same texture is an alpha mask, so a drifting
 * TilingSprite masked by it inherits the fog's own strength per area for free,
 * half over the veil and full over the dark, with no second geometry to keep
 * in step.
 *
 * WHAT IS ALLOWED TO FAIL, AND HOW. Every failure here must end with LESS fog,
 * never more: a fog that cannot work has to stand down and show the map, not
 * paint over it. `repaintFog` therefore builds the whole texture off-screen and
 * only swaps it in once it has checked that the rooms it was supposed to clear
 * were actually cleared — see the guards there, each of which names itself in
 * `diagnoseFog()`.
 * ========================================================================== */

/**
 * The newest fog texture, for `diagnoseFog` to measure.
 *
 * OWNERSHIP LIVES ON THE SPRITE, not here: during a cross-fade there are two
 * fog sprites on the layer at once, each with its own texture, and the outgoing
 * one has to survive until its fade finishes. So each sprite carries the
 * texture it is showing and `dropSprite` frees both together. This variable is
 * only ever a reference to the most recent one.
 */
let fogTexture = null;

/**
 * What the fog was showing at the last successful paint.
 *
 * A repaint that produces the same picture is not free: it rebuilds two
 * textures and runs a 220ms dissolve between two identical states, and that is
 * a window in which nothing can change but anything can flicker. It also
 * happens constantly — a GM clears every room, so moving their Monokuma from
 * one to another changes where they ARE without changing one pixel of what is
 * covered.
 */
let lastPaintSignature = "";

/** The ledger as this GM last saw it, so growth in it can be noticed. */
let lastLedgerSeen = null;

/** Bumped by every dissolve; anything from an older one stands down. */
let dissolveGeneration = 0;

/*
 * REPAINTS DO NOT INTERRUPT A DISSOLVE; THEY QUEUE BEHIND IT.
 *
 * They arrive in pairs on purpose — the move settles, and the GM's write comes
 * back through `SYNC.fog` about 120ms later — so a second repaint always landed
 * inside the first dissolve's 220ms window. Chaining them meant the second read
 * the first's half-finished mix as its starting point, while the first was
 * still free to destroy that mix underneath it. Generations stopped them
 * corrupting each other; this stops them overlapping at all, which is the only
 * version with nothing left to reason about.
 *
 * The queue holds one entry, because a repaint rebuilds from current state:
 * two pending repaints would draw the same picture. The watchdog on the
 * dissolve guarantees this flag cannot stick.
 */
let dissolveBusy = false;
let repaintQueued = false;

function releaseDissolve() {
    dissolveBusy = false;
    if (!repaintQueued) return;
    repaintQueued = false;
    repaintFog();
}

/**
 * Remove a fog sprite and free both textures it was carrying — unless the
 * raster is still wearing one of them.
 *
 * THIS IS THE OTHER HALF OF THE WHITE FLASH. The silhouette a fog sprite
 * carries is what masks the raster, and destroying a texture a live Sprite
 * still points at does not leave a hole: PIXI quietly substitutes
 * `Texture.WHITE`. A mask that is white everywhere masks nothing, so the raster
 * came out at full strength across the entire screen for as long as it took the
 * next frame to re-point it. On a dark map that reads as the fog flashing.
 */
function dropSprite(sprite) {
    if (!sprite || sprite.destroyed) return;

    const texture = sprite.drpgTexture ?? null;
    const mask = sprite.drpgMaskTexture ?? null;
    const inUse = findLayer()?.children?.find(c => c?.name === RASTER_MASK)?.texture ?? null;

    sprite.destroy();
    for (const t of [texture, mask]) {
        if (t && !t.destroyed && t !== inUse) t.destroy(true);
    }
    if (texture === fogTexture) fogTexture = null;
}

/** Does this viewer want animation kept to a minimum? */
function reducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/**
 * A switch for every animated thing this layer does, and a way out of a bad
 * frame without reloading.
 *
 * `game.drpg.fogAnimations(false)` drops the reveal and the dissolve on the
 * spot and paints the fog straight. It exists because a table mid-session
 * cannot debug a canvas, and "the screen went black" has to have an answer that
 * takes four seconds and does not end the evening.
 */
let animationsOn = true;

export function fogAnimations(on = true) {
    animationsOn = Boolean(on);
    if (!animationsOn) clearTransient();
    repaintFog();
    return animationsOn;
}

function motionOff() {
    return !animationsOn || reducedMotion();
}

/**
 * Free the render textures a transient overlay built for itself.
 *
 * `destroy({children: true})` takes down display objects and leaves their
 * textures on the GPU, which is right for the shared ones and a leak for the
 * ones an overlay drew for its own use — the doorway glow renders a fresh
 * field every time a room is entered, and walking a corridor is a lot of
 * rooms. Anything that owns a texture says so on itself.
 */
function freeOwned(display) {
    const stack = [display];
    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        const owned = node.drpgOwnedTexture;
        if (owned) {
            node.drpgOwnedTexture = null;
            if (!owned.destroyed) owned.destroy(true);
        }
        for (const child of node.children ?? []) stack.push(child);
    }
}

/** Remove every transient overlay this layer can put on screen, right now. */
function clearTransient() {
    roomOutline = null;
    const fx = findLayer()?.children?.find(c => c?.name === FX_GROUP);
    if (!fx || fx.destroyed) return;
    for (const child of fx.removeChildren()) {
        freeOwned(child);
        if (!child.destroyed) child.destroy({ children: true });
    }
}

/**
 * Take down reveals in progress and LEAVE THE OUTLINES ALONE.
 *
 * A reveal starting has to clear any reveal still running — walking briskly
 * through three new rooms used to stack three room-sized overlays — but an
 * outline is not a reveal. The one for the room being left has to fade the way
 * it always does, so this steps around anything wearing that name.
 */
function clearReveals() {
    const fx = findLayer()?.children?.find(c => c?.name === FX_GROUP);
    if (!fx || fx.destroyed) return;
    for (const child of [...fx.children]) {
        if (child.name === OUTLINE_NAME) continue;
        fx.removeChild(child);
        freeOwned(child);
        if (!child.destroyed) child.destroy({ children: true });
    }
}

/**
 * RUN THE CLEAN-UP EXACTLY ONCE, WHATEVER HAPPENS TO THE ANIMATION.
 *
 * This is the guarantee that matters more than any of the drawing below: an
 * overlay that covers part of the map must come off, even if the animation
 * driving it never resolves, never ticks, throws on its first frame, or is
 * terminated by something else entirely. Three rounds of this feature have now
 * produced a black screen by different routes, and the one thing every route
 * had in common was an object that stayed. A timer means the worst case is a
 * second of wrong picture instead of an evening of it.
 *
 * @param {Promise} animation  What normally ends the effect.
 * @param {number} ms          How long to wait before ending it anyway.
 * @param {Function} cleanUp   Idempotent; called once.
 */
function watchdog(animation, ms, cleanUp) {
    let done = false;
    const once = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
            cleanUp();
        } catch (err) {
            error("Fog: an effect failed to clean itself up", err);
        }
    };
    const timer = setTimeout(once, ms);
    Promise.resolve(animation).then(once, once);
    return once;
}

/**
 * Put a freshly built fog texture on the layer, fading out whatever was there.
 *
 * Both sprites are drawn at once mid-fade, so the picture in between is not a
 * mathematical interpolation of the two states — it is one fog over another.
 * That is fine and in places better: a room going from dark to veil passes
 * through slightly darker than the halfway point, which reads as the fog
 * settling rather than as a dissolve. What matters is that nothing jumps.
 */
function swapInFog(container, texture, maskTexture, rect) {
    const outgoing = container.children.filter(c => c.name === FOG_SPRITE);

    const sprite = new PIXI.Sprite(texture);
    sprite.name = FOG_SPRITE;
    sprite.drpgTexture = texture;
    sprite.drpgMaskTexture = maskTexture;
    sprite.zIndex = 0;
    // The texture starts a margin above and to the left of the scene rect.
    sprite.position.set(-FOG_MARGIN, -FOG_MARGIN);
    container.addChild(sprite);
    container.position.set(rect.x, rect.y);
    container.visible = true;
    fogTexture = texture;

    // The raster rides on the white silhouette, re-pointed here rather than
    // rebuilt — that is what keeps its drift from snapping back to zero every
    // time somebody walks through a door.
    ensureRaster(container, maskTexture);

    const finish = () => {
        if (!sprite.destroyed) sprite.alpha = 1;
        for (const old of outgoing) dropSprite(old);
    };

    // Nothing to fade from, or a viewer who has asked for no motion: swap
    // outright. A first paint must never arrive as a fade-in from a clear map,
    // which would show the whole scene for a fifth of a second.
    if (!outgoing.length || motionOff()) return finish();

    const previous = outgoing[outgoing.length - 1];
    const previousTexture = previous?.drpgTexture ?? null;
    const renderer = canvas?.app?.renderer;
    if (!previousTexture || previousTexture.destroyed || !renderer) return finish();

    /*
     * A TRUE PER-PIXEL DISSOLVE, NOT TWO SPRITES AT PARTIAL ALPHA.
     *
     * The obvious cross-fade — old to zero, new from zero — DIPS. Two layers
     * that each cover the same floor at half strength leave a quarter of it
     * showing through, so every repaint flashed the map for a fifth of a
     * second. Walking across a scene made the fog strobe.
     *
     * So the two states are mixed per pixel instead: erase `t` of the old, then
     * ADD the new at `t`, which is exactly `old·(1−t) + new·t` and never lets
     * the total drop below either end of the transition. Two blend modes, both
     * already load-bearing in this file.
     */
    /*
     * ONE DISSOLVE AT A TIME.
     *
     * Repaints arrive in bursts — the move settles, then the GM's write comes
     * back through `SYNC.fog` a moment later — so two dissolves could overlap.
     * Each held its own idea of which sprites were "the old ones", and whichever
     * finished first destroyed the other's textures out from under it, leaving a
     * full-screen sprite pointing at freed GPU memory. That is a black
     * rectangle over the map with no error attached to it.
     *
     * A generation counter settles it: starting a dissolve invalidates every
     * one before it, and a stale tick or clean-up does nothing at all.
     */
    const generation = ++dissolveGeneration;
    dissolveBusy = true;
    let mixTexture = null;
    const scratch = new PIXI.Container();
    try {
        // Same padded size as the two it is mixing between.
        const width = Math.max(1, Math.round(rect.width) + FOG_MARGIN * 2);
        const height = Math.max(1, Math.round(rect.height) + FOG_MARGIN * 2);
        const resolution = Math.min(1, MAX_FOG_TEXTURE / Math.max(width, height));
        mixTexture = PIXI.RenderTexture.create({ width, height, resolution });

        const base = new PIXI.Sprite(previousTexture);
        const eraser = new PIXI.Graphics();
        eraser.blendMode = PIXI.BLEND_MODES.ERASE;
        const incoming = new PIXI.Sprite(texture);
        incoming.blendMode = PIXI.BLEND_MODES.ADD;
        scratch.addChild(base, eraser, incoming);

        // RENDERED ONCE BEFORE IT IS SHOWN. A fresh RenderTexture holds
        // whatever was in that GPU memory — commonly opaque black — and the
        // first `ontick` does not necessarily run before the next frame is
        // drawn. Showing it unrendered is a full-screen black flash, or worse
        // a permanent one if the animation never starts.
        eraser.beginFill(0xffffff, 0);
        eraser.drawRect(0, 0, width, height);
        eraser.endFill();
        incoming.alpha = 0;
        renderer.render(scratch, { renderTexture: mixTexture, clear: true });

        const mix = new PIXI.Sprite(mixTexture);
        mix.name = FOG_SPRITE;
        mix.drpgTexture = mixTexture;
        mix.zIndex = 0;
        mix.position.set(-FOG_MARGIN, -FOG_MARGIN);
        container.addChild(mix);

        // Only the mix is shown while it runs; both ends stay resident, one as
        // the source it is reading from and one as the sprite it replaces.
        sprite.renderable = false;
        previous.renderable = false;
        fogTexture = mixTexture;
        // The silhouette does not need dissolving: it is a faint texture's
        // mask, and 220ms of the incoming shape is invisible on it.
        ensureRaster(container, maskTexture);

        const state = { t: 0 };
        const done = () => {
            scratch.destroy({ children: true });
            releaseDissolve();
            if (generation !== dissolveGeneration) {
                // A newer dissolve owns the layer now. Take away only what this
                // one put there and leave everything else alone.
                dropSprite(mix);
                return;
            }
            if (!sprite.destroyed) {
                sprite.renderable = true;
                sprite.alpha = 1;
            }
            fogTexture = texture;
            ensureRaster(container, maskTexture);
            for (const old of container.children.filter(c => c.name === FOG_SPRITE && c !== sprite)) {
                dropSprite(old);
            }
        };

        const animation = CanvasAnimation.animate([{ parent: state, attribute: "t", to: 1 }], {
            duration: fadeMs(),
            ontick: () => {
                if (generation !== dissolveGeneration) return;
                if (mix.destroyed || !mixTexture || mixTexture.destroyed) return;
                eraser.clear();
                eraser.beginFill(0xffffff, state.t);
                eraser.drawRect(0, 0, width, height);
                eraser.endFill();
                incoming.alpha = state.t;
                renderer.render(scratch, { renderTexture: mixTexture, clear: true });
            }
        });
        watchdog(animation, fadeMs() + 750, done);
    } catch (err) {
        debug("Fog: could not dissolve between two states; swapping outright", err);
        scratch.destroy({ children: true });
        releaseDissolve();
        if (mixTexture && !mixTexture.destroyed) mixTexture.destroy(true);
        if (!sprite.destroyed) sprite.renderable = true;
        finish();
    }
}

/**
 * The fog container, wherever it currently lives.
 *
 * Both parents are searched because `canvas.rendered` is where this mounts now
 * and `canvas.stage` is where earlier builds put it — a container left over
 * from before an update must still be findable, or `hideLayer()` would leave an
 * orphan drawing over the map with nothing able to reach it.
 */
function findLayer() {
    for (const parent of [canvas?.rendered, canvas?.stage]) {
        const found = parent?.children?.find(c => c?.name === LAYER_NAME);
        if (found && !found.destroyed) return found;
    }
    return null;
}

/**
 * Find or create the fog container, above the world and below the interface.
 *
 * WHERE THIS MOUNTS WAS WRONG IN TWO DIFFERENT WAYS, and both are worth keeping
 * written down because both were silent.
 *
 * It first resolved its position with `canvas.stage.getChildIndex(canvas.interface)`.
 * PIXI's `getChildIndex` THROWS when the object is not a child of the caller —
 * it does not return -1 — so the call threw inside the `canvasReady` handler
 * before `repaintFog()` was ever reached, and the layer was never mounted at all.
 *
 * The fix for that swapped in `canvas.stage.children.indexOf(canvas.controls)`,
 * which answers "not here" instead of throwing — and then always answers "not
 * here". In v14 `canvas.stage` has exactly two children, `root` and `transition`
 * (`client/canvas/board.mjs`); every group, `interface` and `controls` included,
 * lives under `canvas.rendered`, which is under `root` (`client/config.mjs`).
 * So the fog silently fell back to `addChild` on the stage and sat above
 * everything: the movement ruler, notes, door controls and the drag preview all
 * disappeared under it.
 *
 * `canvas.rendered` is therefore the parent, inserted directly before
 * `canvas.interface`: above the map, the tokens and Foundry's own visibility
 * group, below everything a player needs to interact with. Its `zIndex` is left
 * at 0 to match its siblings — the group sets `sortableChildren`, and PIXI's
 * sort is stable on equal `zIndex`, so insertion order is what holds.
 *
 * Re-resolved on every mount rather than cached: a cached container survives a
 * scene change as a reference to a display object that may have been destroyed.
 */
function mountLayer() {
    const parent = canvas?.rendered ?? canvas?.stage;
    if (!parent) return null;

    const existing = findLayer();
    if (existing) {
        // An older build may have left it on the stage. Move it rather than
        // making a second one, or two fog layers would stack.
        if (existing.parent !== parent) placeLayer(parent, existing);
        return existing;
    }

    const container = new PIXI.Container();
    container.name = LAYER_NAME;
    // Never intercepts a click: the fog is something you look through, not
    // something you interact with, and a full-screen interactive rectangle
    // over the map would swallow every token drag on the scene.
    container.eventMode = "none";
    container.interactiveChildren = false;
    // The fog sits at 0 and the raster at 2, so a freshly swapped-in fog
    // sprite cannot land on top of the texture that is supposed to lie over it.
    container.sortableChildren = true;

    placeLayer(parent, container);
    return container;
}

/** Put the container directly beneath `canvas.interface`, or last if it is gone. */
function placeLayer(parent, container) {
    const anchor = canvas?.interface;
    const at = anchor && !anchor.destroyed ? parent.children.indexOf(anchor) : -1;
    if (at >= 0) parent.addChildAt(container, at);
    else parent.addChild(container);
}

/**
 * Second failsafe against the raw engine background showing through: the
 * scene's own padding margin, and anywhere the camera can be pulled past the
 * edge of `canvas.dimensions.rect`, are painted by the renderer's OWN clear
 * colour whenever nothing else has drawn there yet. Setting it to the
 * palette's darkest ink means that gap reads as "more of our fog", not as
 * bare Foundry, even for the one frame before the fog itself has painted.
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

/** Resolve a CSS custom property to the integer PIXI wants. */
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
 * Why the fog is not painting, in the order the checks actually run.
 *
 * Every early return in `repaintFog` writes its reason here, so "the fog does
 * not work" can be answered with a fact instead of a guess. Read it from the
 * console with `game.drpg.diagnoseFog()`.
 */
let lastFogReason = "not run yet";

/**
 * A plain-language report of what the fog layer is doing right now.
 *
 * This exists because two rounds of this feature failed silently, and a
 * silent failure in a rendering layer is close to undebuggable from a
 * screenshot: "I see the whole map" is the same picture whether the setting
 * is off, the scene has no regions, the layer never mounted, or every room is
 * already discovered. Each of those now says so by name.
 */
export function diagnoseFog() {
    const scene = canvas?.scene ?? null;
    const container = findLayer();
    const regions = Array.from(scene?.regions ?? []).filter(r => r.name);

    const report = {
        build: FOG_BUILD,
        settingOn: fogEnabled(),
        isGM: Boolean(game.user.isGM),
        canvasReady: Boolean(canvas?.ready),
        scene: scene?.name ?? null,
        sceneTokenVision: scene?.tokenVision ?? null,
        // `mode` first: reading `fog.exploration` on v14 logs a deprecation
        // warning, and a diagnostic must never be the thing that pollutes the
        // console it is asking you to read.
        sceneFog: scene?.fog?.mode !== undefined
            ? { mode: scene.fog.mode, shouldBe: fogDisabledValue() }
            : { exploration: scene?.fog?.exploration ?? null, shouldBe: false },
        sceneGlobalLight: scene?.environment?.globalLight?.enabled ?? null,
        namedRegions: regions.length,
        // Counted through the SAME reader the fog draws with, so this cannot
        // report geometry that the drawing code then fails to read. A region
        // whose points are in a format `flattenPoints` rejects shows up here
        // as missing, which is the fact worth knowing.
        regionsWithGeometry: regions.filter(r => regionShapes(r, { x: 0, y: 0 }).length).length,
        layerMounted: Boolean(container && !container.destroyed),
        layerParent: container?.parent === canvas?.rendered ? "canvas.rendered"
            : container?.parent === canvas?.stage ? "canvas.stage (stale)"
            : container?.parent ? "somewhere else" : null,
        layerVisible: Boolean(container?.visible),
        layerChildren: container?.children?.length ?? 0,
        // What the last doorway glow was actually built from — the numbers
        // that decide how deep it reaches and how straight it comes out. A
        // glow that looks wrong on a map is answered from here rather than
        // from a screenshot.
        lastGlow,
        // MEASURED, NOT COUNTED. `lastReason` below says what the fog meant to
        // draw; this says what percentage of the scene it is actually covering,
        // read back off the texture. When those two disagree, believe this one.
        coveragePercent: container?.visible ? measureCoverage(fogTexture) : 0,
        myCharacters: game.actors.filter(a => a.type === "character" && a.isOwner).map(a => a.name),
        currentRooms: Array.from(myCurrentRooms()),
        discoveredRooms: Array.from(myDiscoveredRooms(scene)),
        iAmTheMastermind: iAmTheMastermind(),
        // Holes cut at the last build, against where the tokens stand now.
        clearancesCutAt: lastClearances,
        rasterDrifting: Boolean(driftTick),
        rasterOffset: (() => {
            const group = findLayer()?.children.find(c => c?.name === RASTER_GROUP);
            const sprite = group?.children?.[0];
            return sprite ? `${Math.round(sprite.tilePosition.x)},${Math.round(sprite.tilePosition.y)}` : null;
        })(),
        tokensNow: (canvas?.tokens?.placeables ?? [])
            .filter(t => t.isOwner && t.actor?.type === "character")
            .map(t => ({
                token: t.name,
                at: `${Math.round(t.document.x + (t.w ?? 0) / 2)},${Math.round(t.document.y + (t.h ?? 0) / 2)}`
            })),
        lastReason: lastFogReason
    };

    console.log(`${MODULE_ID} | fog diagnosis`, report);
    return report;
}

/**
 * Why each stretch of the current room's border is open or closed.
 *
 * The two tests behind a doorway — is there a room over there, and is there
 * anything in the way — fail in opposite-looking ways, and from the map you
 * cannot tell which one did. This prints them separately, with the wall count
 * near each sample, so "it says open and I can see a wall" turns into a fact.
 */
export function doorwayReport() {
    const scene = canvas?.scene;
    const room = Array.from(myCurrentRooms())[0];
    const region = room && Array.from(scene?.regions ?? []).find(r => r.name === room);

    if (!region) {
        console.log(`${MODULE_ID} | doorwayReport: you are not standing in a named room.`);
        return null;
    }

    const grid = canvas?.grid?.size ?? 100;
    const back = grid * DOORWAY_PROBE_IN;
    const reach = grid * DOORWAY_PROBE_OUT;

    const others = [];
    for (const other of scene.regions ?? []) {
        if (!other.name || other === region) continue;
        others.push({ name: other.name, polys: regionShapes(other, { x: 0, y: 0 }).map(f => new PIXI.Polygon(f)) });
    }

    const rows = [];
    for (const edge of doorwayEdges(region)) {
        const mid = 0.5;
        const mx = edge.ax + edge.dx * mid;
        const my = edge.ay + edge.dy * mid;

        const found = others.find(o => [0.35, 0.6, 0.85, 1].some(f =>
            inPolygons(o.polys, mx + edge.nx * reach * f, my + edge.ny * reach * f)));
        const target = neighbourBeyond(mx, my, edge.nx, edge.ny, others.map(o => o.polys), reach);

        // The three gates, each shown separately — the whole point of this
        // report is that "open" and "closed" fail in opposite-looking ways and
        // the map cannot tell you which test decided.
        const inX = mx - edge.nx * grid * DOORWAY_OVERLAP_INSET;
        const inY = my - edge.ny * grid * DOORWAY_OVERLAP_INSET;
        const overlapping = others.find(o => inPolygons(o.polys, inX, inY));

        rows.push({
            edge: `${Math.round(edge.ax)},${Math.round(edge.ay)} → ${Math.round(edge.ax + edge.dx)},${Math.round(edge.ay + edge.dy)}`,
            length: Math.round(edge.length),
            neighbour: found?.name ?? "—",
            insideOf: overlapping?.name ?? "—",
            wallAlong: wallAlongEdge(mx, my, edge.dx / edge.length, edge.dy / edge.length,
                Array.from(scene.walls ?? []), grid * DOORWAY_WALL_NEAR),
            clear: target
                ? nothingInTheWay({ x: mx - edge.nx * back, y: my - edge.ny * back },
                                  { x: mx + edge.nx * reach, y: my + edge.ny * reach })
                : "n/a",
            neighbourAt: target ? Math.round(Math.hypot(target.x - mx, target.y - my)) : "—",
            openRuns: edge.open.length,
            // HOW MUCH of this edge reads as a way out, in grid squares — the
            // number the count alone never gave. "Two openings" says nothing
            // about whether they are two doors or two thirds of a wall, and
            // that difference is the whole subject of this report.
            openSquares: Math.round(
                edge.open.reduce((a, [from, to]) => a + (to - from) * edge.length, 0)
                / grid * 100) / 100,
            // MEASURED ACROSS THE WALL, NOT TO ITS MIDDLE. This used to count
            // walls whose CENTRE fell within a square of the sample, which is
            // the measure that fails on exactly the maps this report is for: a
            // corridor wall drawn as one long segment has its middle far from
            // most of the border it runs alongside, so the count read zero
            // where the wall was plainly there. Now it is the distance to the
            // nearest wall that actually stops movement, in grid squares.
            nearestWall: (() => {
                const NONE = CONST?.WALL_MOVEMENT_TYPES?.NONE ?? 0;
                let best = Infinity;
                for (const w of scene.walls ?? []) {
                    const c = w.c;
                    if (!c || c.length < 4 || w.move === NONE) continue;
                    best = Math.min(best, distanceToSegment(mx, my, c[0], c[1], c[2], c[3]));
                }
                return Number.isFinite(best) ? Math.round(best / grid * 100) / 100 : "—";
            })()
        });
    }

    console.log(`${MODULE_ID} | doorways in "${room}" — ${scene.walls?.size ?? 0} walls on this scene`);
    console.table(rows);
    return rows;
}

/**
 * Check every room on this scene against the rules the fog layer depends on.
 *
 *     game.drpg.checkRegions()
 *
 * THE MAP IS DATA, AND DATA GETS VALIDATED. Every symptom this stage was built
 * to fix — a corridor glowing along its whole length, a white bar across open
 * floor, a doorway with no door — traces back to region geometry rather than to
 * the code that draws it. Those faults are invisible in the region editor and
 * obvious the moment they are measured, which is the definition of something
 * that should be a check.
 *
 * IT REPORTS AND DOES NOT REPAIR. An automatic "snap the region to the wall"
 * would rewrite a GM's map without asking, and the map is theirs. Every row
 * carries the room's name and a coordinate, and the fixing happens in the
 * region editor by somebody who can see what the room is meant to be.
 *
 * @returns {Array<object>} one row per problem, worst first.
 */
export function checkRegions() {
    const scene = canvas?.scene;
    if (!scene) {
        console.log(`${MODULE_ID} | checkRegions: no scene is on the canvas.`);
        return [];
    }

    const grid = canvas?.grid?.size ?? 100;
    const walls = Array.from(scene.walls ?? []);
    const findings = [];
    const add = (level, room, problem, detail, at = null) =>
        findings.push({ level, room, problem, detail, at });

    const named = [];
    for (const region of scene.regions ?? []) {
        if (!region.name) {
            add("info", "(unnamed)", "Region with no name",
                "Rooms are matched by name, so this one is not a room: it never counts as a "
                + "neighbour, which is one quiet way to get a doorway that leads nowhere.",
                pointOf(region));
            continue;
        }
        const shapes = regionShapes(region, { x: 0, y: 0 });
        if (!shapes.length) {
            add("error", region.name, "No geometry the fog can read",
                "The region exists but its shape came back empty — nothing about this room "
                + "will be drawn.", pointOf(region));
            continue;
        }
        named.push({ region, polys: shapes.map(f => new PIXI.Polygon(f)) });
    }

    /*
     * WHERE THE LATTICE ACTUALLY IS, read off the map rather than assumed.
     *
     * `canvas.dimensions.sceneX` is NOT it: on this project's own scene it is
     * 641 against a grid of 20, so measuring from there puts every corner four
     * pixels out and the check fires on all eighteen rooms — a check that has
     * learnt to cry wolf is worse than no check. `getSnappedPoint` is no help
     * either; asked about a dirty coordinate it hands the same one back.
     *
     * The honest question is not "where does Foundry think the grid starts" but
     * "do these corners agree with one another", and that can be measured: the
     * commonest offset among every corner on the scene IS the lattice. A room
     * drawn to the same lattice as the rest of the map reads clean; one drawn to
     * its own reads dirty, which is the fault worth naming.
     */
    const lattice = grid / 2;
    const latticeOrigin = commonestOffset(named, lattice);

    /* ---- 1. overlapping rooms — the first cause on the list --------------- */
    /*
     * WITH A MARGIN, IN BOTH DIRECTIONS — and the margins are the engine's own,
     * not a second set invented here.
     *
     * Asking a GM for pixel-perfect regions would be asking for something the
     * code does not need. `doorwayEdges` samples a quarter of a square inside
     * the border, so an overlap shallower than that is invisible to it; and it
     * steps outward to nearly a full square looking for the neighbour, so two
     * rooms may stand that far apart and still find each other. Anything inside
     * those two figures is not a fault and is not reported.
     *
     * Depth, not area, is what decides. A hair-thin slice along a shared wall is
     * a rounding artefact however long it runs; a shallow-but-wide overlap is
     * the one that moves a border onto the neighbour's floor.
     */
    const tolerance = grid * DOORWAY_OVERLAP_INSET;
    for (let i = 0; i < named.length; i++) {
        for (let j = i + 1; j < named.length; j++) {
            const hit = overlapArea(named[i].polys, named[j].polys, grid);
            if (hit.area <= 0) continue;
            if (hit.depth !== null && hit.depth < tolerance) continue;
            const squares = hit.area / (grid * grid);
            add("error", named[i].region.name, `Overlaps "${named[j].region.name}"`,
                `About ${squares.toFixed(1)} grid square(s) of floor belong to both rooms`
                + (hit.depth !== null ? `, reaching ${(hit.depth / grid).toFixed(1)} square(s) in` : "")
                + ". Where they overlap, one room's border runs across the other's floor with no "
                + "wall anywhere near it, and the whole shared border reads as one doorway. "
                + "Rooms should touch; a sliver thinner than a quarter square is ignored.",
                pointOf(named[i].region));
        }
    }

    /* ---- 2..4 — per room, measured off the same edges the fog uses -------- */
    for (const { region, polys } of named) {
        const edges = doorwayEdges(region);

        /*
         * 2. BORDER DRAWN AWAY FROM ITS WALLS.
         *
         * Asked with the SAME predicate the doorway test uses, and that is the
         * point: a validator measuring something slightly different can pass a
         * scene whose glow still misbehaves.
         *
         * Measured as the longest CONTIGUOUS stretch, never as a total. Every
         * room has border with no wall on it — that is what a doorway is — so a
         * total flags every room on every map and says nothing. See
         * ADRIFT_WARN_RUN for where the threshold comes from.
         */
        let adrift = 0;
        let adriftAt = null;
        let run = 0;
        for (const edge of edges) {
            if (!edge.length) continue;
            const ex = edge.dx / edge.length;
            const ey = edge.dy / edge.length;
            const steps = Math.max(1, Math.round(edge.length / (grid * 0.25)));
            for (let k = 0; k < steps; k++) {
                const t = (k + 0.5) / steps;
                const mx = edge.ax + edge.dx * t;
                const my = edge.ay + edge.dy * t;
                if (wallAlongEdge(mx, my, ex, ey, walls, grid * DOORWAY_WALL_NEAR)) {
                    run = 0;
                    continue;
                }
                run += edge.length / steps;
                if (run > adrift) {
                    adrift = run;
                    adriftAt = { x: Math.round(mx), y: Math.round(my) };
                }
            }
        }
        if (adrift > grid * ADRIFT_WARN_RUN) {
            add("warning", region.name, "Border runs away from the walls",
                `${(adrift / grid).toFixed(1)} squares of border in one stretch have no wall `
                + "alongside them. A border drawn away from the wall it describes is the second "
                + "way a whole side of a room turns into a doorway — the wall is never found, so "
                + "nothing closes it.", adriftAt);
        }

        /*
         * 3. A ROOM WITH NO WAY OUT AT ALL.
         *
         * Found by walking every room on the QA scene rather than by reading
         * the code: one of them reported not a single open stretch, and the
         * reason was neither a wall nor an overlap — its region simply sits a
         * full square from its neighbour's, and the neighbour probe reaches
         * 0.95. Nothing was wrong with the walls; the two rooms had never been
         * introduced.
         *
         * A player standing in a room the module says has no exit sees a closed
         * box with no glow anywhere, which is indistinguishable from the fog
         * being broken. Naming it is the difference between "this map has a
         * gap" and "this feature does not work".
         *
         * Warning, not error: a genuinely sealed room is a thing a killing game
         * may well want.
         */
        const openTotal = edges.reduce((a, e) =>
            a + (e.open ?? []).reduce((b, [from, to]) => b + (to - from) * e.length, 0), 0);
        if (edges.length && openTotal <= 0) {
            const others = [];
            for (const other of scene.regions ?? []) {
                if (!other.name || other === region) continue;
                others.push(regionShapes(other, { x: 0, y: 0 }).map(f => new PIXI.Polygon(f)));
            }
            const reach = grid * DOORWAY_PROBE_OUT;
            const anyNeighbour = edges.some(e => {
                const mx = e.ax + e.dx * 0.5;
                const my = e.ay + e.dy * 0.5;
                return Boolean(neighbourBeyond(mx, my, e.nx, e.ny, others, reach));
            });
            add("warning", region.name, "No way out",
                anyNeighbour
                    ? "Every stretch of this room's border is walled, so nothing will glow as a "
                      + "doorway. If that is deliberate, ignore it; if not, the door is missing."
                    : "No neighbouring room lies within reach of any part of this border — the "
                      + "next region is more than a square away, so the two rooms never see each "
                      + "other. Rooms should touch along the edge they share.",
                pointOf(region));
        }

        // 3. (there is no check on how LONG an opening is. A doorway has no
        //     upper size — see ADRIFT_WARN_RUN. A border that has wandered off
        //     its wall is caught above, which is the fault that check was
        //     standing in for.)

        /*
         * 4. CORNERS OFF THE LATTICE — and the lattice is HALF a square.
         *
         * Foundry's region tools snap to half-grid, so a room drawn correctly
         * has most of its corners on a half-square line and almost none on a
         * whole one. Measured against whole squares this check fired on every
         * room on the scene, which is a check that has learnt to cry wolf.
         */
        const tolerance = Math.max(1, lattice * 0.1);
        let off = 0;
        let worst = 0;
        for (const poly of polys) {
            const pts = poly.points ?? [];
            for (let i = 0; i < pts.length; i += 2) {
                const dx = gridOffset(pts[i], lattice, latticeOrigin);
                const dy = gridOffset(pts[i + 1], lattice, latticeOrigin);
                const d = Math.max(dx, dy);
                if (d > tolerance) {
                    off++;
                    worst = Math.max(worst, d);
                }
            }
        }
        if (off) {
            add("info", region.name, "Corners off the map's own lattice",
                `${off} corner(s) sit up to ${Math.round(worst)}px off the half-square lattice `
                + "the rest of this scene is drawn to. Draw with snapping on: a corner a "
                + "fraction of a square out is invisible by eye and is enough to make two "
                + "rooms overlap or miss.", pointOf(region));
        }
    }

    const order = { error: 0, warning: 1, info: 2 };
    findings.sort((a, b) => order[a.level] - order[b.level]);

    const counts = findings.reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] ?? 0) + 1 }), {});
    console.log(`${MODULE_ID} | region check on "${scene.name}" — ${named.length} named room(s), `
        + `${walls.length} wall(s): ${counts.error ?? 0} error(s), ${counts.warning ?? 0} warning(s), `
        + `${counts.info ?? 0} note(s).`);
    if (findings.length) console.table(findings);
    else console.log(`${MODULE_ID} | region check: nothing to report — the rooms on this scene are clean.`);
    return findings;
}

/** A point to steer somebody at: the middle of the region's own box. */
function pointOf(region) {
    const b = regionBounds(region);
    return b ? { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) } : null;
}

/**
 * The offset every corner on this scene shares, to the nearest pixel.
 *
 * A one-pixel histogram of `coordinate mod lattice` over every corner of every
 * named room, both axes together. The tallest bucket is where the map's own
 * lattice sits; corners that miss it are the ones drawn without snapping.
 * Falls back to zero when there is nothing to measure, which reads as "assume
 * the lattice starts at the origin" and is the old behaviour.
 */
function commonestOffset(named, lattice) {
    if (!(lattice > 0)) return 0;
    const buckets = new Map();
    for (const { polys } of named) {
        for (const poly of polys) {
            const pts = poly.points ?? [];
            for (const v of pts) {
                const key = Math.round((((v % lattice) + lattice) % lattice));
                buckets.set(key, (buckets.get(key) ?? 0) + 1);
            }
        }
    }
    let best = 0;
    let most = -1;
    for (const [offset, count] of buckets) {
        if (count > most) {
            most = count;
            best = offset;
        }
    }
    return best;
}

/** How far this coordinate sits from the nearest grid line. */
function gridOffset(v, grid, origin) {
    const off = (((v - origin) % grid) + grid) % grid;
    return Math.min(off, grid - off);
}

/**
 * How much floor two rooms share.
 *
 * Clipped exactly where Foundry's polygon clipper is available, and sampled on
 * a quarter-square lattice where it is not. The fallback is deliberately coarse
 * and deliberately present: this check is the one that finds the worst fault on
 * the list, and it must not be the check that quietly does not run.
 */
function overlapArea(a, b, grid) {
    let area = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let clipped = true;

    for (const pa of a) {
        for (const pb of b) {
            if (typeof pa.intersectPolygon !== "function") { clipped = false; break; }
            try {
                const hit = pa.intersectPolygon(pb);
                const pts = hit?.points ?? [];
                if (pts.length < 6) continue;
                area += polygonArea(pts);
                for (let i = 0; i < pts.length; i += 2) {
                    minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
                    minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
                }
            } catch {
                clipped = false;
                break;
            }
        }
        if (!clipped) break;
    }
    if (clipped) {
        // The narrow side of what the two rooms share — see the note at the
        // call site on why depth and not area decides.
        const depth = Number.isFinite(minX)
            ? Math.min(maxX - minX, maxY - minY)
            : 0;
        return { area, depth };
    }

    const step = grid / 4;
    let cells = 0;
    for (const pa of a) {
        const pts = pa.points ?? [];
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
            bx0 = Math.min(bx0, pts[i]); bx1 = Math.max(bx1, pts[i]);
            by0 = Math.min(by0, pts[i + 1]); by1 = Math.max(by1, pts[i + 1]);
        }
        if (!Number.isFinite(bx0)) continue;
        for (let x = bx0 + step / 2; x < bx1; x += step) {
            for (let y = by0 + step / 2; y < by1; y += step) {
                if (pa.contains(x, y) && inPolygons(b, x, y)) cells++;
            }
        }
    }
    // No clipper, so no honest depth — `null` reads as "cannot tell", and the
    // caller reports rather than swallowing it. Better a question than a miss.
    return { area: cells * step * step, depth: null };
}


/**
 * Take BOTH of this module's fog layers off the screen for a moment.
 *
 * The question it answers is "is that thing on screen even ours" — and it
 * exists as one call because a chain of lookups pasted into a console is a
 * test that can fail for reasons having nothing to do with the answer.
 * Everything comes back by itself, so there is no state to restore by hand.
 *
 * @param {number} seconds  How long to look. Default four.
 */
export function fogPeek(seconds = 4) {
    const parent = canvas?.rendered ?? canvas?.stage;
    const layers = (parent?.children ?? []).filter(
        c => c?.name === LAYER_NAME || c?.name === BACKDROP_LAYER
    );

    if (!layers.length) {
        console.log(`${MODULE_ID} | fogPeek: this module has nothing on the canvas right now.`);
        return false;
    }

    for (const layer of layers) layer.visible = false;
    console.log(`${MODULE_ID} | fogPeek: ${layers.length} layer(s) hidden for ${seconds}s — `
        + "anything still on screen is not ours.");

    setTimeout(() => {
        for (const layer of layers) if (!layer.destroyed) layer.visible = true;
        console.log(`${MODULE_ID} | fogPeek: back.`);
    }, seconds * 1000);

    return true;
}

/**
 * Everything this layer currently has on screen, object by object.
 *
 * `diagnoseFog` answers "what does the fog think it is doing"; this answers
 * "what is actually in front of the map right now" — every sprite, its size,
 * its alpha, whether its texture is still valid, and what is masking it. Run it
 * WHILE the screen is wrong: a full-screen object that should not be there, or
 * a sprite whose texture has been destroyed, shows up here by name.
 */
export function whyBlack() {
    const container = findLayer();
    const size = obj => `${Math.round(obj?.width ?? 0)}x${Math.round(obj?.height ?? 0)}`;
    const describe = obj => obj && ({
        name: obj.name ?? obj.constructor?.name ?? "?",
        kind: obj.constructor?.name,
        at: `${Math.round(obj.x ?? 0)},${Math.round(obj.y ?? 0)}`,
        size: size(obj),
        alpha: Number((obj.alpha ?? 1).toFixed(2)),
        renderable: obj.renderable !== false,
        visible: obj.visible !== false,
        zIndex: obj.zIndex ?? 0,
        blend: obj.blendMode ?? null,
        mask: obj.mask ? (obj.mask.name ?? obj.mask.constructor?.name ?? "yes") : null,
        texture: obj.texture
            ? { valid: Boolean(obj.texture.valid), destroyed: Boolean(obj.texture.destroyed),
                size: `${Math.round(obj.texture.width)}x${Math.round(obj.texture.height)}` }
            : null,
        children: obj.children?.length ?? 0
    });

    const named = name => container?.children?.find(c => c?.name === name) ?? null;
    const dims = canvas?.dimensions;

    const report = {
        build: FOG_BUILD,
        animationsOn,
        scene: `${canvas?.scene?.name} ${Math.round(dims?.rect?.width ?? 0)}x${Math.round(dims?.rect?.height ?? 0)}`,
        layer: describe(container),
        onTheLayer: (container?.children ?? []).map(describe),
        insideFx: (named(FX_GROUP)?.children ?? []).map(describe),
        insideRaster: (named(RASTER_GROUP)?.children ?? []).map(describe),
        dissolveGeneration,
        coveragePercent: measureCoverage(fogTexture),
        lastReason: lastFogReason
    };

    console.log(`${MODULE_ID} | why black`, report);
    return report;
}

/**
 * Repaint the whole layer for the CURRENT user, from scratch.
 *
 * Not incremental on purpose: this only runs on the short list of triggers in
 * `registerFog`, none of them per-frame, so rebuilding is a handful of times
 * per minute at most, never a handful of times per second — see the header
 * note on why this is not hooked to `refreshToken`.
 */
export function repaintFog() {
    try {
        if (dissolveBusy) {
            // Redrawn the moment the transition finishes — see `dissolveBusy`.
            repaintQueued = true;
            return false;
        }
        if (!canvas?.ready) return stand(  "the canvas is not ready yet");
        if (!fogEnabled())  return stand(  "the 'Rooms decide what players can see' setting is off");

        const scene = canvas.scene;
        if (!scene) return stand("there is no scene on the canvas");

        const regions = Array.from(scene.regions ?? []).filter(r => r.name);
        if (!regions.length) {
            // No rooms drawn at all: nothing to gate visibility on. Leave the
            // canvas as Foundry would show it rather than fogging a scene the
            // GM has not built rooms into yet.
            return stand("this scene has no named Region, so there are no rooms to fog");
        }

        const dims = canvas.dimensions;
        const rect = dims?.rect ?? { x: 0, y: 0, width: dims?.width ?? 0, height: dims?.height ?? 0 };
        if (!(rect.width > 0) || !(rect.height > 0)) {
            return stand("this scene reports no measurable dimensions to draw into");
        }

        // FIRST GUARD: geometry at all.
        //
        // If not one Region on the scene can be read as a polygon, the room
        // model cannot be honoured, and fogging the map anyway would hide it
        // behind a state nothing is able to lift. Standing down shows the map
        // as Foundry would — wrong, but visibly wrong, and with a reason
        // `diagnoseFog()` can read out.
        const readable = regions.filter(r => regionShapes(r, rect).length).length;
        if (!readable) {
            warn("Fog: no room geometry could be read on this scene, so nothing was fogged. "
                + "The Regions may be drawn in a shape the module cannot measure.");
            return stand("regions exist but none exposed usable polygons");
        }

        /*
         * THE ECLIPSE DIMS EVERYTHING AND CLEARS NOTHING.
         *
         * This used to make the fog step aside entirely, on the reasoning that
         * `visibility.mjs` already hides every token — which left the whole map
         * uncovered and merely darkened, handing every player the layout of
         * rooms they had never been in. An Eclipse is the least, not the most,
         * a player should be able to see.
         *
         * So no room counts as CURRENT while one is running: rooms you know
         * drop to the veil, the room you are standing in included, and rooms
         * you have never entered stay under full fog. It costs one line,
         * because "current" was always the only thing that cleared anything.
         */
        /*
         * TWO DIFFERENT QUESTIONS, AND FOR A GM THEY HAVE DIFFERENT ANSWERS.
         *
         * `mine` is WHERE I AM — it drives the outline and the room name, and
         * for a GM that is wherever their Monokuma stands. `current` is WHAT IS
         * CLEARED, and a GM clears every room on the map: they are running the
         * scene and need to see all of it, tokens included. The fog is there
         * for them only so that the space belonging to no room reads the same
         * on their screen as on everybody else's, which is the whole of what
         * this was ever meant to give them.
         */
        const mine = myCurrentRooms();
        const discovered = myDiscoveredRooms(scene);

        let current;
        if (game.user.isGM) current = ledgerRooms(scene);
        else if (isEclipse()) current = new Set();
        else current = mine;

        /*
         * A ROOM THE CLASS HAS JUST FOUND OPENS FOR THE GM TOO.
         *
         * They do not walk into it, so nothing about their own tokens can
         * announce it — the signal is the ledger growing, which reaches this
         * client through `SYNC.fog` like any other world change. The first
         * paint of a session seeds the comparison silently, or logging in would
         * replay every discovery the season has ever made.
         */
        let opened = [];
        if (game.user.isGM) {
            if (lastLedgerSeen) {
                opened = Array.from(current).filter(room => !lastLedgerSeen.has(room));
            }
            lastLedgerSeen = new Set(current);
        }
        // The room you are standing in is VEILED during an Eclipse, not left
        // under full fog: nothing is cleared, but you can still see the floor
        // you are on. Adding it to the known set is all that takes, since a
        // known room that is not current is exactly what the veil is for.
        if (isEclipse() && !game.user.isGM) for (const room of mine) discovered.add(room);
        const ink = colourOf("--drpg-ink", 0x1a1620);

        // Nothing to do if the picture would come out the same. The layer has
        // to be up already, or the first paint after standing down would be
        // skipped on the strength of a signature describing a hidden layer.
        const signature = [
            scene.id,
            isEclipse() ? "eclipse" : "-",
            regions.length,
            Array.from(current).sort().join(","),
            Array.from(discovered).sort().join(",")
        ].join("|");

        if (signature === lastPaintSignature && findLayer()?.visible) {
            lastFogReason = `unchanged: ${lastFogReason}`;
            return true;
        }

        const built = buildFogTexture({ regions, current, discovered, rect, ink });
        if (!built) return stand("the fog texture could not be rendered");

        // SECOND GUARD: the room you are standing in really did get cleared.
        //
        // This is the one that makes the old catastrophe unreachable. Nothing
        // above can tell the difference between "correctly all dark" and "the
        // clearing failed", because both produce a full texture — so it is
        // asked directly, and a failure throws the texture away instead of
        // putting it on screen.
        if (current.size && !built.cleared) {
            for (const t of [built.texture, built.maskTexture]) if (t && !t.destroyed) t.destroy(true);
            return stand(`you are standing in "${Array.from(current)[0]}", but the fog could not `
                + "clear it, so it stood down rather than black the map out");
        }

        const container = mountLayer();
        if (!container) {
            for (const t of [built.texture, built.maskTexture]) if (t && !t.destroyed) t.destroy(true);
            return stand("the fog layer could not be mounted on the canvas");
        }

        // Everything that is NOT a fog sprite goes now — leftovers from a
        // discovery animation, say. The fog sprites themselves are handed to
        // `swapInFog`, which fades the old one out rather than cutting it.
        for (const child of [...container.children]) {
            if (child.name === FOG_SPRITE) continue;
            if (child.name === RASTER_GROUP || child.name === RASTER_MASK) continue;
            if (child.name === FX_GROUP) continue;
            container.removeChild(child);
            child.destroy({ children: true });
        }
        swapInFog(container, built.texture, built.maskTexture, rect);
        // The Eclipse's own dimming stands down while this is on — see the
        // ECLIPSE section of danganronpa.css.
        document.body.classList.add("drpg-fog-active");

        // The outline belongs to the room you are IN. Leaving it — for another
        // room, for a corridor, for nowhere at all — ends it. Measured against
        // where the tokens ACTUALLY are, not against the Eclipse-adjusted set:
        // an Eclipse dims the room, it does not move you out of it.
        if (roomOutline && !mine.has(roomOutline.room)) fadeRoomOutline();

        // One at a time: two rooms found in the same instant is a tie nobody
        // needs broken, and the second reveal would only clear the first.
        if (opened.length) playDiscoveryAnimation(opened[0], null);

        lastPaintSignature = signature;
        lastFogReason = `painted: ${built.fogged} fogged, ${built.veiled} veiled, `
            + `${current.size} clear`;
        return true;
    } catch (err) {
        error("Could not repaint the fog of war", err);
        lastFogReason = `threw: ${err?.message ?? err}`;
        return false;
    }
}

/** Hide the layer and record why, in one line, for `diagnoseFog`. */
function stand(reason) {
    lastFogReason = reason;
    lastPaintSignature = "";
    hideLayer();
    return false;
}

/**
 * Draw the whole fog for this viewer into one render texture.
 *
 * Three passes, and only the first one paints: the other two take paint away.
 * See the section header for why subtraction is done by erasing pixels rather
 * than by cutting holes in a polygon.
 *
 * Returns `null` rather than throwing — the caller has to be able to decide to
 * show nothing, and an exception on the way up would land in `repaintFog`'s
 * outer catch with a container that may already be half rebuilt.
 *
 * @returns {{texture: PIXI.RenderTexture, fogged: number, veiled: number, cleared: number}|null}
 */
function buildFogTexture({ regions, current, discovered, rect, ink }) {
    const renderer = canvas?.app?.renderer;
    if (!renderer) return null;

    // The padded rect: the scene, plus a margin on every side. `origin` is its
    // top-left in SCENE coordinates, and everything traced below is shifted
    // into it rather than into the scene rect.
    const width = Math.max(1, Math.round(rect.width) + FOG_MARGIN * 2);
    const height = Math.max(1, Math.round(rect.height) + FOG_MARGIN * 2);
    const origin = { x: rect.x - FOG_MARGIN, y: rect.y - FOG_MARGIN };
    const resolution = Math.min(1, MAX_FOG_TEXTURE / Math.max(width, height));

    const scratch = new PIXI.Container();
    let texture = null;
    let maskTexture = null;

    try {
        // 1. EVERYTHING under full fog — the padded rect, not the background
        //    image, so the margin around the map wears the same colour as the
        //    rooms and the edge of "our" world never shows.
        //
        //    Filled WHITE and tinted afterwards. The same three passes have to
        //    produce two textures: the fog itself, and a white silhouette of it
        //    for the raster to be masked by — see the note above `maskTexture`
        //    below. Tinting a white fill is how one set of geometry serves both.
        /*
         * A GM GETS THE VEIL OUT HERE, NOT THE FULL FOG.
         *
         * Space belonging to no room is a map-drawing mistake and is meant to
         * look like one — that is the rule, and for players it stands. For the
         * GM it worked against itself: they are the one who has to draw those
         * Regions, and on a scene with three of them the fog covered nearly
         * everything and hid the map they were supposed to be marking up. The
         * texture, the colour and the raster are the same as everyone else's,
         * so the two screens still speak the same language; the GM can simply
         * read the floor through it.
         */
        const base = new PIXI.Graphics();
        base.beginFill(0xffffff, game.user.isGM ? VEIL_ALPHA : 1);
        base.drawRect(0, 0, width, height);
        base.endFill();
        scratch.addChild(base);

        // 2. Rooms this player HAS been to but is not standing in: erase half
        //    the fog, which leaves the veil. Erasing at partial alpha
        //    multiplies what is underneath rather than replacing it, so this
        //    is genuinely "ink at VEIL_ALPHA" and not an approximation of it.
        const visited = regions.filter(r => !current.has(r.name) && discovered.has(r.name));
        let veiled = 0;
        if (visited.length) {
            const veil = new PIXI.Graphics();
            veil.blendMode = PIXI.BLEND_MODES.ERASE;
            veil.beginFill(0xffffff, 1 - VEIL_ALPHA);
            for (const region of visited) {
                if (traceRegionPathsAt(veil, region, origin)) veiled++;
            }
            veil.endFill();
            scratch.addChild(veil);
        }

        // 3. Rooms this player is standing in: erase all of it. Drawn after
        //    the veil so that a room which is somehow both wins as "current" —
        //    overlapping Regions make that reachable, and the room you are in
        //    must never be dimmer than a room you merely remember.
        const clear = new PIXI.Graphics();
        clear.blendMode = PIXI.BLEND_MODES.ERASE;
        clear.beginFill(0xffffff, 1);
        let cleared = 0;
        for (const region of regions) {
            if (!current.has(region.name)) continue;
            if (traceRegionPathsAt(clear, region, origin)) cleared++;
        }

        /*
         * THE CLEARANCE DISC UNDER YOUR OWN TOKEN IS GONE, DELIBERATELY.
         *
         * It was a safety net while the fog could still black out a whole map:
         * a hole punched under each owned token meant "I cannot see my own
         * character" was unreachable whatever else went wrong. The fog works
         * now, and the net turned out to have a cost of its own — a token
         * crossing the gap between two rooms is briefly inside no room at all,
         * so the disc surfaced as a pale circle sliding across the dark every
         * time anybody walked anywhere. Dawid called it, and he is right: a
         * room you are not in should be dark, and there is no version of that
         * hole which is invisible while it is doing its job.
         *
         * `ownTokenClearances` is kept, unused by the drawing code, purely so
         * `diagnoseFog` can still report where the tokens are against where the
         * fog was last built. That comparison is what found the stale-position
         * bug, and it costs nothing to keep.
         */
        ownTokenClearances(origin);
        clear.endFill();
        scratch.addChild(clear);

        texture = PIXI.RenderTexture.create({ width, height, resolution });
        base.tint = ink;
        renderer.render(scratch, { renderTexture: texture, clear: true });

        /*
         * THE SECOND TEXTURE IS WHY THE RASTER WAS ALWAYS TOO FAINT.
         *
         * PIXI masks with a Sprite through a COLOUR channel, not through alpha
         * alone — `original *= alphaMul * masky.r` in its sprite-mask shader. The
         * fog was serving as its own mask, and the fog is filled with `--drpg-ink`,
         * whose red channel is 0.10. So the raster was being multiplied by a
         * tenth before it ever reached the screen, and three rounds of raising
         * its opacity moved it almost not at all: the ceiling was never in the
         * tile.
         *
         * The same geometry, tinted white, gives a silhouette whose red channel
         * is 1 where the fog is solid and VEIL_ALPHA where it is a veil — so the
         * raster comes through at full strength over the dark and softer over
         * the veil, which is what it was supposed to do all along.
         */
        maskTexture = PIXI.RenderTexture.create({ width, height, resolution });
        base.tint = 0xffffff;
        renderer.render(scratch, { renderTexture: maskTexture, clear: true });

        const fogged = regions.filter(r => !current.has(r.name) && !discovered.has(r.name)).length;
        return { texture, maskTexture, fogged, veiled, cleared };
    } catch (err) {
        error("Could not build the fog texture", err);
        for (const t of [texture, maskTexture]) if (t && !t.destroyed) t.destroy(true);
        return null;
    } finally {
        scratch.destroy({ children: true });
    }
}

/* ==========================================================================
 * THE RASTER
 * ========================================================================== */

let rasterTiles = null;

/** Build both tiles, once per canvas. `null` if 2D canvas is unavailable. */
function rasterTextures() {
    if (rasterTiles) return rasterTiles;

    // One colour for both, so the specks and the hairlines read as the same
    // material rather than as two strengths of the same idea.
    const bone = cssColour("--drpg-fog-raster", "#58545d");

    const dots = drawTile(RASTER_TILE, ctx => {
        ctx.fillStyle = bone;
        ctx.globalAlpha = RASTER_ALPHA;
        // Inset so no speck ever shares a column with a hairline.
        for (let y = 0; y < RASTER_TILE; y += RASTER_DOT_STEP) {
            for (let x = 0; x < RASTER_TILE; x += RASTER_DOT_STEP) {
                ctx.fillRect(x + RASTER_DOT_INSET, y, RASTER_DOT_SIZE, RASTER_DOT_SIZE);
            }
        }
    });

    const lines = drawTile(RASTER_TILE, ctx => {
        ctx.fillStyle = bone;
        ctx.globalAlpha = RASTER_ALPHA;
        // FILLED, NOT STROKED: a stroke centred on a pixel boundary spreads
        // across three columns with the outer two at partial coverage, so a
        // line that should be solid arrives as a grey suggestion of one.
        for (let x = 0; x < RASTER_TILE; x += RASTER_LINE_STEP) {
            ctx.fillRect(x, 0, RASTER_LINE_WIDTH, RASTER_TILE);
        }
    });

    if (!dots || !lines) return null;
    rasterTiles = { dots, lines };
    return rasterTiles;
}

function drawTile(size, paint) {
    try {
        const el = document.createElement("canvas");
        el.width = el.height = size;
        const ctx = el.getContext("2d");
        if (!ctx) return null;
        paint(ctx);
        const texture = PIXI.Texture.from(el, {
            // Passed at creation rather than set afterwards: PIXI decides how a
            // texture is sampled when it first uploads it, and flags written
            // after that upload are not read again. That is why an earlier
            // attempt to switch these appeared to change nothing at all.
            wrapMode: PIXI.WRAP_MODES.REPEAT,
            scaleMode: PIXI.SCALE_MODES.LINEAR,

            /*
             * MIPMAPS OFF, AND THIS IS THE SECOND TIME THEY HAVE BEEN THE
             * ANSWER TO THE WRONG QUESTION.
             *
             * They were added to fix minification, and once they genuinely
             * switched on they produced a far worse artefact: a hard strobe
             * across the whole fog whenever the map was pulled back. PIXI's
             * TilingSprite has two paths, and the fallback one wraps its
             * coordinates with `fract()`. The derivative of that jumps at every
             * tile seam, so the GPU picks the smallest mip — a flat averaged
             * blur — for whole bands of the screen, and the drift then sweeps
             * those bands across it.
             *
             * They are also no longer needed. `startDrift` pins the tile to a
             * 1:1 scale with the screen at any zoom, so the texture is never
             * minified and the only correct level is zero. Keeping them on
             * bought nothing and cost a strobe.
             */
            mipmap: PIXI.MIPMAP_MODES.OFF
        });
        const base = texture.baseTexture;
        base.wrapMode = PIXI.WRAP_MODES.REPEAT;

        /*
         * LINEAR WITH MIPMAPS, NOT NEAREST — and this is a correctness choice,
         * not a taste one.
         *
         * NEAREST was picked to match the module's pixel-art voice, and at 1:1
         * it does. Minified it falls apart: every screen pixel samples exactly
         * ONE texel, so a one-pixel line either lands on a sample or misses it
         * entirely. Zoom out and the lines come and go and appear to have
         * different weights, none of which is in the tile. Worse, as the tile
         * drifts by a fraction of a pixel per frame the same line hops between
         * sample columns, and the eye reads that as movement in the OPPOSITE
         * direction — the wagon-wheel effect, exactly as in film.
         *
         * Mipmaps are the answer to minification: the texture is pre-averaged
         * at each halving, so a zoomed-out line becomes a fainter continuous
         * band instead of a stroboscopic one. Both tiles are powers of two, so
         * POW2 generates them and REPEAT keeps working. At full zoom the scale
         * is 1:1 and linear filtering on an axis-aligned column is still crisp,
         * so nothing is lost where the crispness was the point.
         */
        base.scaleMode = PIXI.SCALE_MODES.LINEAR;
        base.mipmap = PIXI.MIPMAP_MODES.OFF;
        return texture;
    } catch (err) {
        debug("Fog: could not build a raster tile", err);
        return null;
    }
}

/** Read a CSS custom property as a colour string, for the 2D context. */
function cssColour(name, fallback) {
    try {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    } catch {
        return fallback;
    }
}

function dropRasterTiles() {
    for (const texture of Object.values(rasterTiles ?? {})) {
        if (texture && !texture.destroyed) texture.destroy(true);
    }
    rasterTiles = null;
}

/**
 * Put the drifting raster over the fog, masked by the fog's own texture.
 *
 * Rebuilt only when it does not exist yet: the sprites keep their drift phase
 * across repaints, so walking between rooms does not make the whole texture
 * jump back to its starting offset. Only the MASK is re-pointed at the newest
 * fog texture on every swap.
 *
 * Failure here costs the texture and nothing else — the fog underneath has
 * already been swapped in by the time this runs.
 */
function ensureRaster(container, texture) {
    try {
        const tiles = rasterTextures();
        if (!tiles) return;

        // Screen-sized, not scene-sized: see the note on the drift constants.
        const screen = canvas?.app?.renderer?.screen;
        const width = Math.max(1, Math.round(screen?.width ?? window.innerWidth));
        const height = Math.max(1, Math.round(screen?.height ?? window.innerHeight));

        let mask = container.children.find(c => c?.name === RASTER_MASK);
        if (!mask || mask.destroyed) {
            mask = new PIXI.Sprite(texture);
            mask.name = RASTER_MASK;
            // Exactly where the fog sprite is, or the raster would be masked
            // by a silhouette a margin out of step with the fog it decorates.
            mask.position.set(-FOG_MARGIN, -FOG_MARGIN);
            // In the tree so it has a world transform, never drawn on its own.
            mask.renderable = false;
            mask.zIndex = 1;
            container.addChild(mask);
        } else {
            // The old texture belongs to a sprite that is about to be dropped.
            mask.texture = texture;
        }

        let group = container.children.find(c => c?.name === RASTER_GROUP);
        if (!group || group.destroyed) {
            group = new PIXI.Container();
            group.name = RASTER_GROUP;
            group.zIndex = 2;
            group.eventMode = "none";
            group.interactiveChildren = false;

            const dots = new PIXI.TilingSprite(tiles.dots, width, height);
            const lines = new PIXI.TilingSprite(tiles.lines, width, height);
            dots.drpgKind = "dots";
            lines.drpgKind = "lines";
            group.addChild(dots, lines);
            container.addChild(group);
        } else {
            for (const sprite of group.children) {
                sprite.width = width;
                sprite.height = height;
            }
        }

        group.mask = mask;
        ensureBackdrop();
        startDrift();
    } catch (err) {
        debug("Fog: the raster could not be applied; the fog itself is unaffected", err);
    }
}

/**
 * The same ink and the same raster, BEHIND the map.
 *
 * The fog covers `canvas.dimensions.rect` — the scene plus its padding — and
 * stops there, because that is the whole of the world the scene knows about.
 * Pull the camera back far enough and you see past it: the renderer's own clear
 * colour, which `armRendererFailsafe` at least sets to Ink so it is the right
 * shade. The right shade is not enough. A flat field of Ink next to a rastered
 * field of Ink shows exactly where one ends, and that edge is the edge of the
 * map — the one thing the fog exists to stop being obvious.
 *
 * So the texture continues underneath everything. This layer sits at the bottom
 * of `canvas.rendered`, below the scene's own background, so it is covered
 * wherever the map exists and shows wherever it does not. Its raster shares its
 * drift with the fog's — see `startDrift`, which drives both from one offset —
 * so the two are the same continuous surface with the map floating in it.
 */
function ensureBackdrop() {
    try {
        const parent = canvas?.rendered ?? canvas?.stage;
        const tiles = rasterTextures();
        if (!parent || !tiles) return null;

        let layer = parent.children.find(c => c?.name === BACKDROP_LAYER);
        if (layer && !layer.destroyed) return layer;

        layer = new PIXI.Container();
        layer.name = BACKDROP_LAYER;
        layer.eventMode = "none";
        layer.interactiveChildren = false;
        // Below every canvas group, all of which sit at zero.
        layer.zIndex = -1;

        const ink = new PIXI.Graphics();
        ink.name = "drpgFogBackdropInk";
        const dots = new PIXI.TilingSprite(tiles.dots, 1, 1);
        const lines = new PIXI.TilingSprite(tiles.lines, 1, 1);
        dots.drpgKind = "dots";
        lines.drpgKind = "lines";
        layer.addChild(ink, dots, lines);

        parent.addChildAt(layer, 0);
        return layer;
    } catch (err) {
        debug("Fog: could not put the raster behind the map", err);
        return null;
    }
}

function dropBackdrop() {
    const parent = canvas?.rendered ?? canvas?.stage;
    const layer = parent?.children?.find(c => c?.name === BACKDROP_LAYER);
    if (layer && !layer.destroyed) layer.destroy({ children: true });
}

/**
 * Hold a container still against the screen, whatever the camera is doing.
 *
 * THE FIRST VERSION UNDID THE CAMERA BY HAND — a scale of `1/zoom` and a
 * position derived from the stage's pivot — and that is correct only while the
 * transform between this container and the screen is a uniform scale plus a
 * translation. On The Forge it is not: the isometric module rotates and skews
 * the canvas, and against a matrix like that a scalar inverse lands the layer
 * somewhere else entirely. The fog came out cut off, with a visible edge that
 * no amount of zooming closed.
 *
 * So the inverse is taken from the actual matrix. `parent.worldTransform`
 * carries whatever the whole chain above is doing, rotation and skew included,
 * and its inverse is by definition the transform that puts this container back
 * in screen space.
 *
 * Applied from `updateTransform` rather than from the ticker, and that timing
 * is the point: inside the render pass the parent's world transform is the
 * CURRENT frame's. Read from a ticker callback it is one frame stale, which on
 * a moving camera is a layer that visibly lags behind the map it is pinned in
 * front of.
 */
function pinToScreen(group) {
    if (!group || group.drpgPinned) return;
    group.drpgPinned = true;

    const base = PIXI.Container.prototype.updateTransform;
    group.updateTransform = function () {
        const parent = this.parent;
        if (parent) {
            try {
                this.transform.setFromMatrix(parent.worldTransform.clone().invert());
            } catch {
                // A degenerate matrix — a zero scale mid-transition, say. Leave
                // the last good transform rather than throwing inside a render.
            }
        }
        base.call(this);
    };
}

/* --- the drift ----------------------------------------------------------- */

let driftTick = null;
/** Shared by the fog's raster and the backdrop's, so they never drift apart. */
const driftOffset = { dots: { x: 0, y: 0 }, lines: { x: 0, y: 0 } };

/*
 * THE TICKER RUNS EVEN WHEN NOTHING IS DRIFTING.
 *
 * It does two jobs, and only one of them is animation: it advances the pattern,
 * and it holds both rasters still against the screen while the camera moves.
 * Bailing out on `prefers-reduced-motion` used to take the second job with it,
 * which left the raster unpinned and unsized — a viewer who had asked for less
 * movement got a texture that slid around with the map instead of none at all.
 * The motion check now gates the offset and nothing else.
 */
function startDrift() {
    if (driftTick) return;
    const ticker = canvas?.app?.ticker;
    if (!ticker) return;

    driftTick = () => {
        const seconds = motionOff() ? 0 : (ticker.deltaMS ?? 16) / 1000;

        // ONE OFFSET FOR EVERY RASTER ON SCREEN. The fog's raster and the
        // backdrop's are two sprites showing one surface, so their phase has to
        // be identical — accumulated once here rather than per sprite, which
        // would let floating-point drift pull them apart over a long session
        // and put a visible seam exactly at the edge of the map.
        driftOffset.dots.x += RASTER_DOT_DRIFT.x * seconds;
        driftOffset.dots.y += RASTER_DOT_DRIFT.y * seconds;
        driftOffset.lines.x += RASTER_LINE_DRIFT.x * seconds;
        driftOffset.lines.y += RASTER_LINE_DRIFT.y * seconds;

        const screen = canvas?.app?.renderer?.screen;
        const width = Math.max(1, Math.round(screen?.width ?? window.innerWidth));
        const height = Math.max(1, Math.round(screen?.height ?? window.innerHeight));

        /*
         * THE PATTERN TAKES THE MAP'S ANGLE BACK, DERIVED RATHER THAN GUESSED.
         *
         * The raster is pinned to the screen, which is what stopped it aliasing
         * — and which also took it out of the canvas transform, so on The
         * Forge's isometric view its upright hairlines stayed upright while
         * everything else leaned. The lines are meant to run with the map.
         *
         * Not hard-coded to 45°, because the isometric module applies rotation
         * AND skew: its matrix is [0.392, −0.261, 0.392, 0.261], and a line that
         * is vertical in the scene arrives on screen at about 34°, not 45. So
         * the angle is read off the matrix instead. A vertical line maps to the
         * direction (c, d), and the tile rotation that produces it is
         * `atan2(−c, d)` — which comes out as exactly zero on a canvas nobody
         * has rotated, so this costs nothing when the module is not installed.
         */
        const wt = canvas?.stage?.worldTransform;
        const tileAngle = wt ? Math.atan2(-wt.c, wt.d) : 0;

        const fogRaster = findLayer()?.children.find(c => c?.name === RASTER_GROUP);
        const backdrop = (canvas?.rendered ?? canvas?.stage)?.children
            ?.find(c => c?.name === BACKDROP_LAYER);

        for (const group of [fogRaster, backdrop]) {
            if (!group || group.destroyed) continue;
            pinToScreen(group);

            for (const sprite of group.children) {
                if (sprite.destroyed) continue;

                if (sprite instanceof PIXI.Graphics) {
                    // The backdrop's own ground, so this never depends on the
                    // renderer's clear colour being what we left it.
                    sprite.clear();
                    sprite.beginFill(colourOf("--drpg-ink", 0x1a1620), 1);
                    sprite.drawRect(0, 0, width, height);
                    sprite.endFill();
                    continue;
                }

                const offset = driftOffset[sprite.drpgKind];
                if (!offset) continue;
                if (sprite.width !== width) sprite.width = width;
                if (sprite.height !== height) sprite.height = height;
                if (sprite.tileTransform.rotation !== tileAngle) {
                    sprite.tileTransform.rotation = tileAngle;
                }
                sprite.tilePosition.set(offset.x, offset.y);
            }
        }
    };

    ticker.add(driftTick);
}

function stopDrift() {
    if (!driftTick) return;
    try {
        canvas?.app?.ticker?.remove(driftTick);
    } catch { /* the ticker is going away anyway */ }
    driftTick = null;
}

/**
 * A small clear disc under each of this viewer's own character tokens, in the
 * layer's coordinate space. See pass 4 above for why.
 *
 * A token the GM has hidden outright is skipped: that control means "this is
 * not on the map", and cutting a hole around it would announce where it stands.
 */
function ownTokenClearances(rect) {
    const out = [];
    lastClearances = [];
    for (const token of canvas?.tokens?.placeables ?? []) {
        if (!token.isOwner || token.actor?.type !== "character") continue;
        if (token.document?.hidden) continue;

        const size = canvas.grid?.size ?? 100;
        const w = token.w ?? (token.document.width * size);
        const h = token.h ?? (token.document.height * size);
        const spot = {
            x: token.document.x - rect.x + w / 2,
            y: token.document.y - rect.y + h / 2,
            r: Math.max(w, h) * 0.65
        };
        out.push(spot);
        // Recorded so `diagnoseFog` can compare where the holes were CUT with
        // where the tokens are NOW. A mismatch means the layer was not rebuilt
        // after the move; a match beside a hole you can still see somewhere
        // else means that hole is not one of ours.
        lastClearances.push({ token: token.name, at: `${Math.round(spot.x)},${Math.round(spot.y)}` });
    }
    return out;
}

/** Where the last build cut a clearance, and for whom. See `diagnoseFog`. */
let lastClearances = [];

/**
 * How much of the scene the fog is ACTUALLY covering, as a percentage.
 *
 * This exists because the old diagnostic reported intent: it said
 * "painted: 17 fogged, 1 clear" while the screen was uniformly black, and the
 * two statements were both true and completely unrelated. A counter of what a
 * layer meant to draw is not a report of what is on the screen. This reads the
 * texture back instead.
 *
 * Deliberately measured on a 64×64 downscale: it is a diagnostic run by hand
 * from the console, and pulling nine million pixels off the GPU to answer a
 * question about roughly-how-much is not a trade worth making.
 */
function measureCoverage(texture) {
    const renderer = canvas?.app?.renderer;
    if (!renderer || !texture || texture.destroyed) return null;

    const small = PIXI.RenderTexture.create({ width: 64, height: 64 });
    const sprite = new PIXI.Sprite(texture);
    try {
        sprite.width = 64;
        sprite.height = 64;
        renderer.render(sprite, { renderTexture: small, clear: true });

        const pixels = renderer.extract.pixels(small);
        let sum = 0;
        for (let i = 3; i < pixels.length; i += 4) sum += pixels[i];
        return Math.round((sum / (64 * 64 * 255)) * 100);
    } catch (err) {
        debug("Fog: could not measure how much of the scene is covered", err);
        return null;
    } finally {
        sprite.destroy();
        small.destroy(true);
    }
}

/**
 * Empty the layer and free what it was holding.
 *
 * The Sprite is destroyed WITHOUT its texture — `destroy({children: true})`
 * leaves textures alone by design — and the render texture is then released
 * separately by name. Doing it the other way round would let a Sprite the
 * discovery animation is still holding point at freed GPU memory.
 */
function clearLayer(container) {
    lastPaintSignature = "";
    stopDrift();
    for (const child of container.removeChildren()) {
        // The mask must lose its reference before the sprite that owns the
        // texture is destroyed, or PIXI keeps a filter pointing at freed GPU
        // memory for a frame.
        if (child.name === RASTER_GROUP) child.mask = null;
        if (child.name === FOG_SPRITE) dropSprite(child);
        else child.destroy({ children: true });
    }
    fogTexture = null;
}

function hideLayer() {
    document.body.classList.remove("drpg-fog-active");
    dropBackdrop();
    const container = findLayer();
    if (container) {
        clearLayer(container);
        container.visible = false;
    }
    fogTexture = null;
}

function isEclipse() {
    try {
        return game.settings.get(MODULE_ID, SETTINGS.clock)?.eclipse === true;
    } catch {
        return false;
    }
}

/**
 * Trace a region's real shape onto a Graphics — `RegionDocument#polygons`
 * first, the raw `shapes` array as the fallback, the same ordering
 * `movement.mjs`'s `boundsOf` uses and for the same reason: not every scene
 * state exposes the rendered placeable's computed geometry. Path only, no
 * fill, so the caller decides whether it is a fill or a hole.
 *
 * Coordinates are shifted from SCENE space into the layer's own space, since
 * the fog container is translated to the padded rect's origin.
 *
 * @returns {boolean} whether anything was actually traced.
 */
function traceRegionPathsAt(graphics, region, rect) {
    const shapes = regionShapes(region, rect);
    for (const points of shapes) graphics.drawPolygon(points);
    return shapes.length > 0;
}

/**
 * Every one of a region's shapes, as flat `[x, y, x, y, …]` arrays already
 * shifted into the layer's coordinate space.
 *
 * ONE READER FOR BOTH CALLERS — the fills and the holes — so the fog and the
 * gaps cut out of it can never be computed from different geometry.
 *
 * The point format is the part worth being careful about. `RegionDocument
 * #polygons` is documented as `PIXI.Polygon[]`, whose `points` is flat
 * numbers, but the same field has been seen carrying a bare flat array, and
 * an array of `{x, y}` objects. Subtracting a number from an object gives
 * `NaN`, and a polygon full of NaN does not throw — PIXI draws nonsense, which
 * is indistinguishable on screen from "the wrong rooms were chosen". So the
 * shape of the input is checked rather than assumed, and anything that cannot
 * be read as coordinates is dropped instead of drawn.
 */
function regionShapes(region, rect) {
    const out = [];

    // `polygonTree` FIRST, and holes skipped.
    //
    // `RegionDocument#polygons` is an alias for `polygonTree.polygons`, and
    // that iterator walks the WHOLE tree — hole nodes included, flattened in
    // beside the outlines that contain them. A room drawn with an opening in
    // the middle therefore hands back its outline and its hole as two equal
    // polygons, and filling both fills the hole solid. No room on the scene
    // this was found on has one, which is exactly why it is worth catching
    // now: nothing would report it until somebody drew a courtyard.
    const tree = region?.polygonTree ?? region?.object?.polygonTree;
    if (tree?.[Symbol.iterator]) {
        for (const node of tree) {
            if (node?.isHole) continue;
            const flat = flattenPoints(node?.points ?? node?.polygon?.points, rect);
            if (flat) out.push(flat);
        }
        if (out.length) return out;
    }

    const polys = region?.polygons ?? region?.object?.polygons;
    for (const poly of polys ?? []) {
        const flat = flattenPoints(poly?.points ?? poly, rect);
        if (flat) out.push(flat);
    }
    if (out.length) return out;

    // No computed polygons on this scene state — fall back to the raw shape
    // data, the same ordering `movement.mjs`'s `boundsOf` uses.
    for (const shape of region?.shapes ?? []) {
        if (shape?.points?.length) {
            const flat = flattenPoints(shape.points, rect);
            if (flat) out.push(flat);
        } else if (Number.isFinite(shape?.x) && Number.isFinite(shape?.width)) {
            const x = shape.x - rect.x, y = shape.y - rect.y;
            out.push([x, y, x + shape.width, y, x + shape.width, y + shape.height, x, y + shape.height]);
        } else if (Number.isFinite(shape?.x) && Number.isFinite(shape?.radius)) {
            out.push(ellipsePoints(shape.x - rect.x, shape.y - rect.y, shape.radius, shape.radius));
        } else if (Number.isFinite(shape?.x) && Number.isFinite(shape?.radiusX)) {
            out.push(ellipsePoints(shape.x - rect.x, shape.y - rect.y, shape.radiusX, shape.radiusY));
        }
    }
    return out;
}

/** `[x,y,…]` or `[{x,y},…]` → a flat, shifted array. `null` if unreadable. */
function flattenPoints(points, rect) {
    if (!Array.isArray(points) && !ArrayBuffer.isView(points)) return null;
    if (!points.length) return null;

    const first = points[0];

    if (typeof first === "number") {
        if (points.length < 6) return null;                 // fewer than 3 points
        const out = new Array(points.length);
        for (let i = 0; i < points.length; i += 2) {
            const x = points[i], y = points[i + 1];
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            out[i] = x - rect.x;
            out[i + 1] = y - rect.y;
        }
        return out;
    }

    if (first && typeof first === "object" && Number.isFinite(first.x)) {
        if (points.length < 3) return null;
        const out = [];
        for (const p of points) {
            if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
            out.push(p.x - rect.x, p.y - rect.y);
        }
        return out;
    }

    return null;
}

/** An ellipse as a polygon, so holes and fills share one primitive. */
function ellipsePoints(cx, cy, rx, ry, segments = 32) {
    const out = [];
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    return out;
}

/* ==========================================================================
 * DISCOVERY: THE MOMENT, NOT JUST THE STATE
 * ========================================================================== */

async function onUpdateToken(tokenDoc, changes) {
    if (changes.x === undefined && changes.y === undefined) return;

    // Wait for the token to actually stop. v14 delivers a move as a series of
    // updates along the path, and repainting on each one rebuilt the fog three
    // or four times per step — each rebuild starting its own cross-fade, and
    // fades that overlap are what made the map flicker while walking.
    if (tokenDoc.movement?.pending?.waypoints?.length) return;

    // Local half: MY view depends on where MY characters are standing right
    // now, whoever moved. Repainting here is what makes a player's own
    // crossing light their new room up instantly, rather than waiting on the
    // primary GM's write and the setting sync that follows it.
    try {
        if (tokenDoc.actor?.isOwner) {
            const before = lastMineSignature;
            const after = signatureOf(myCurrentRooms());
            const changedRoom = before !== after;
            lastMineSignature = after;
            const entered = changedRoom ? roomEnteredByMe(tokenDoc) : null;

            // BEFORE the repaint, not after: the whole point is that the room
            // being left is already remembered by the time the layer is
            // rebuilt, so it goes straight to the veil instead of flashing
            // black while the GM's write is in flight.
            rememberMine(tokenDoc.parent);

            // ONLY WHEN THE SET OF OCCUPIED ROOMS CHANGES. This used to fire on
            // every owned move, to keep the clear disc under a token in step
            // with it — and that disc is gone, so nothing about the picture
            // depends on where inside a room anybody stands. Repainting anyway
            // was a texture rebuild and a dissolve per step, which is a
            // flickering opportunity bought for nothing.
            //
            // SCOPED, NOT AN EARLY RETURN. It used to `return` out of the whole
            // handler, and on the primary GM's client `isOwner` is true for
            // EVERY token — so a player's move, which never changes which rooms
            // the GM's own Monokuma occupies, walked out right here and the
            // write half below was unreachable: `recordDiscovery` could only
            // ever fire for the GM's own character. The session mirror masked
            // it until the player's first reload, when their rooms vanished.
            if (changedRoom) {
                repaintFog();
                if (entered?.isNew) playDiscoveryAnimation(entered.room, tokenDoc);
                else if (entered) announceRoom(entered.room);
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

/**
 * Play the reveal for any room one of this viewer's characters is standing in
 * and has never seen. Called once the canvas is up, so a session that begins
 * inside a new room opens with the same gesture as walking into one.
 */
function revealStartingRooms() {
    if (!fogEnabled()) return;
    const scene = canvas?.scene;
    if (!scene) return;

    for (const token of canvas?.tokens?.placeables ?? []) {
        if (!isMine(token)) continue;
        const entered = roomEnteredByMe(token.document);
        if (!entered) continue;
        // A room nobody here has seen gets the whole gesture. One already known
        // still gets its outline — that is not an announcement, it is the mark
        // saying "you are in this one", and it has to be there from the moment
        // the scene appears rather than waiting for a step.
        if (entered.isNew) playDiscoveryAnimation(entered.room, token.document);
        else announceRoom(entered.room);
    }
}

/** Signature of a room set, cheap enough to compare on every owned move. */
let lastMineSignature = "";
function signatureOf(rooms) {
    return Array.from(rooms).sort().join("|");
}

/**
 * Which room this token has just walked into, from THIS viewer's side, and
 * whether it is one they have never been in.
 *
 * Both halves matter now. A room nobody here has seen gets the full reveal —
 * the cut, the pause, the curtain. A room they already know gets the outline
 * and the name and nothing else: enough to say "this is the Dinner Hall"
 * without pretending anything is being discovered.
 *
 * "Already know" is read from the LEDGER first, which is a world setting and
 * therefore survives the session — walk into a room today and next week it is
 * still a room you know. `animatedAlready` only covers the gap before the GM's
 * write comes back, so a room entered twice in quick succession does not play
 * its reveal twice while the ledger is still in flight.
 */
const animatedAlready = new Set();
function roomEnteredByMe(tokenDoc) {
    const actor = tokenDoc.actor;
    const scene = tokenDoc.parent;
    if (!actor || !scene) return null;

    const room = roomOfToken(tokenDoc);
    if (!room) return null;

    const key = `${scene.id}.${actor.id}.${room}`;
    // Nothing is ever new to a GM — they know every room on the map, so a
    // Monokuma walking into one gets the outline and the name and none of the
    // five seconds of curtain that discovering a room is worth.
    const seen = game.user.isGM
        || discoveredFor(scene.id, actor.id).includes(room)
        || animatedAlready.has(key);
    if (!seen) animatedAlready.add(key);

    return { room, isNew: !seen };
}

/**
 * The outline and the name, without the reveal — what walking back into a room
 * you already know looks like.
 */
function announceRoom(room) {
    // BEFORE THE EARLY RETURNS. Crossing into a room you already know is the
    // event; whether this client can draw the outline for it is a separate
    // question, and a scene without a usable region should not also go silent.
    playSfx("roomEntered");

    const fx = fxLayer();
    const scene = canvas?.scene;
    if (!fx || !scene) return;

    const region = Array.from(scene.regions ?? []).find(r => r.name === room);
    if (!region) return;

    const dims = canvas.dimensions;
    flashOutline(fx, region, dims?.rect ?? { x: 0, y: 0 });
}

/* ==========================================================================
 * THE REVEAL — the room opens in diagonal bands.
 * --------------------------------------------------------------------------
 * The iris that used to live here was the wrong gesture: a circle, in a game
 * whose whole graphic language is diagonal cuts. This is made of the same
 * material as the fog it removes — bands at 45 degrees, on the same axis as
 * the raster, sweeping away from the token so the room reads as opening in
 * front of you rather than dissolving around you.
 *
 * TWO THINGS ABOUT THE IMPLEMENTATION ARE DELIBERATE AND BOTH ARE SCARS.
 *
 * It lives in its own container. The old one added its overlay straight to the
 * fog layer, which `repaintFog` empties and DESTROYS — and the write that
 * triggers this animation is also the write that triggers a repaint, roughly
 * 120ms later. So the reveal was killed about a fifth of the way in, every
 * time, and `CanvasAnimation` went on ticking against a destroyed Graphics:
 * "Cannot read properties of null (reading 'clear')" out of `SmoothGraphics`,
 * once a frame, for the rest of the run. `FX_GROUP` is exempt from that
 * clearing, and every `ontick` checks `destroyed` before touching anything.
 *
 * It subtracts with ERASE into a render texture rather than with a mask. A
 * Graphics mask that is also a child of the display list renders twice — once
 * into the stencil, once as white shapes over the map — and a mask that is not
 * a child has no transform to be positioned by. That is the class of choice
 * this file has already lost to twice, so the reveal uses the one subtraction
 * technique the module has proven on a live world: the one the fog runs on.
 * ========================================================================== */

const FX_GROUP = "drpgFogFx";
const OUTLINE_NAME = "drpgRoomOutline";
/** How long the outline and name take to land after a room is entered. */
const BOUNCE_MS = 520;
/**
 * How long the outline of a room you have left takes to go.
 *
 * This was 450, written here, while the motion layer called the same gesture
 * 420 and called it a beat. Two numbers for one thing is exactly the drift the
 * token layer exists to end, so this one is gone and the canvas reads what the
 * interface reads. A function rather than a constant because the value is not
 * fixed for the session: `prefers-reduced-motion` rewrites it, and a constant
 * captured at load would have kept the canvas moving for a reader who asked it
 * not to. The floor of 1ms is for `CanvasAnimation`, which needs a duration to
 * divide by, not for the eye — at 1ms the outline is simply gone.
 */
const outlineFadeMs = () => Math.max(BEAT(), 1);

/**
 * The outline of the room this viewer is currently standing in.
 *
 * It OUTLIVES its own animation, which is the difference between this and every
 * other effect on the layer: the name says "this is the Dinner Hall" once, and
 * the outline goes on saying "and you are still in it" until you leave. Held
 * here so the next room can take it down.
 */
let roomOutline = null;

/** What the last doorway glow measured for itself — read by `diagnoseFog`. */
let lastGlow = null;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The container transient effects live in — never emptied by a repaint. */
function fxLayer() {
    const container = mountLayer();
    if (!container) return null;

    let fx = container.children.find(c => c?.name === FX_GROUP);
    if (fx && !fx.destroyed) return fx;

    fx = new PIXI.Container();
    fx.name = FX_GROUP;
    fx.zIndex = 3;                    // above the fog and above the raster
    fx.eventMode = "none";
    fx.interactiveChildren = false;
    container.addChild(fx);
    return fx;
}

/**
 * One band of the sweep, as an upright strip.
 *
 * UPRIGHT RATHER THAN DIAGONAL, and the reason is not aesthetic. Dawid runs an
 * isometric module on The Forge, which rotates the whole canvas — so lines
 * drawn at 45 degrees here arrive on his screen axis-aligned, and lines drawn
 * upright here arrive diagonal. The look the design asks for is the one the
 * player sees, so the geometry is expressed in the frame the map is drawn in
 * and left to the projection to turn.
 *
 * A band is now simply the strip between two values of `x`. Four points,
 * convex, no holes — the geometry PIXI is least able to get wrong.
 */
function bandQuad(cA, cB, tMin, tMax) {
    return [cA, tMin, cB, tMin, cB, tMax, cA, tMax];
}

function playDiscoveryAnimation(room, tokenDoc) {
    // Same rule as `announceRoom`: the sound belongs to the discovery, not to
    // this client's ability to animate it.
    playSfx("roomDiscovered");

    const fx = fxLayer();
    const scene = canvas?.scene;
    if (!fx || !scene) return;

    const region = Array.from(scene.regions ?? []).find(r => r.name === room);
    if (!region) return;

    const dims = canvas.dimensions;
    const rect = dims?.rect ?? { x: 0, y: 0 };
    const bounds = regionBounds(region);
    const renderer = canvas?.app?.renderer;

    // No measurable shape, no renderer, or a viewer who has asked for no
    // motion: the room is already clear underneath, so just name it.
    if (!bounds || !renderer || motionOff()) {
        flashOutline(fx, region, rect);
        return;
    }

    // Never two reveals over one another: walking briskly through three new
    // rooms used to stack three room-sized overlays, each with its own timing.
    // Outlines are spared — the one being left still has to fade.
    clearReveals();

    const ink = colourOf("--drpg-ink", 0x1a1620);
    const bone = colourOf("--drpg-bone", 0xe8e3ec);
    const grid = canvas.grid?.size ?? 100;

    const width = Math.max(1, Math.ceil(bounds.w));
    const height = Math.max(1, Math.ceil(bounds.h));
    const resolution = Math.min(1, 1024 / Math.max(width, height));

    /*
     * TWO TEXTURES, BOTH THE SIZE OF THE ROOM'S BOUNDING BOX.
     *
     * One carries the fog still covering the room; the other carries the white
     * lines. They are separate because both have to be CLIPPED TO THE ROOM and
     * there is only one reliable way to clip in this file — start from the
     * room's own shape and erase. The fog texture erases what the curtain has
     * opened; the line texture starts as a room-shaped sheet of white and
     * erases everything that is not a line. Drawing the lines straight onto the
     * fog would have needed a blend mode to keep them inside the walls, and a
     * blend mode that behaves differently than expected here shows up as white
     * streaks across the map rather than as nothing.
     */
    const fogScratch = new PIXI.Container();
    const fogFill = new PIXI.Graphics();
    const fogCut = new PIXI.Graphics();
    const lineScratch = new PIXI.Container();
    const lineFill = new PIXI.Graphics();
    const lineCut = new PIXI.Graphics();
    let fogTex = null;
    let lineTex = null;
    let fogSprite = null;
    let lineSprite = null;

    try {
        const shapes = regionShapes(region, { x: bounds.x, y: bounds.y });

        // VEIL STRENGTH, NOT FULL INK.
        //
        // The reveal re-covers the room it is about to open, and at full ink a
        // large room — Main Hall on the test map runs most of the width of the
        // scene — went completely black for the three seconds of the cut and
        // the pause. With everything around it already fogged, that reads as
        // the whole map going out rather than as a room being opened. At the
        // veil it reads as "there is something here", which is the sentence the
        // gesture is trying to say anyway, and the curtain still delivers the
        // room at full colour.
        fogFill.beginFill(ink, VEIL_ALPHA);
        for (const points of shapes) fogFill.drawPolygon(points);
        fogFill.endFill();
        fogCut.blendMode = PIXI.BLEND_MODES.ERASE;
        fogScratch.addChild(fogFill, fogCut);

        lineFill.beginFill(bone, 1);
        for (const points of shapes) lineFill.drawPolygon(points);
        lineFill.endFill();
        lineCut.blendMode = PIXI.BLEND_MODES.ERASE;
        lineScratch.addChild(lineFill, lineCut);

        fogTex = PIXI.RenderTexture.create({ width, height, resolution });
        lineTex = PIXI.RenderTexture.create({ width, height, resolution });

        fogSprite = new PIXI.Sprite(fogTex);
        lineSprite = new PIXI.Sprite(lineTex);
        for (const sprite of [fogSprite, lineSprite]) {
            sprite.position.set(bounds.x - rect.x, bounds.y - rect.y);
        }
        fx.addChild(fogSprite, lineSprite);
    } catch (err) {
        debug("Fog: could not set up the reveal", err);
        fogScratch.destroy({ children: true });
        lineScratch.destroy({ children: true });
        for (const texture of [fogTex, lineTex]) if (texture && !texture.destroyed) texture.destroy(true);
        for (const sprite of [fogSprite, lineSprite]) if (sprite && !sprite.destroyed) sprite.destroy();
        flashOutline(fx, region, rect);
        return;
    }

    // Everything below is in the textures' own space. Every point on a
    // 45-degree line shares `x + y`, so one number places a line.
    // `c` is simply x now: a band is a vertical strip. See `bandQuad`.
    const cMax = width;
    const cMid = cMax / 2;
    const cLow = -cMax;
    const cHigh = cMax * 2;
    const lineWidth = Math.max(2, grid * 0.07);

    /*
     * THE LINES ARE PAIRED ABOUT THE MIDDLE, AND THAT IS THE WHOLE TRICK.
     *
     * Spread evenly from one end, the innermost line landed anywhere up to half
     * a spacing off centre — so the instant the curtain began, the fog between
     * the middle and that line was erased in ONE FRAME. A black strip a whole
     * line-spacing wide simply vanished, and it was the most visible thing in
     * the animation: you did not see a curtain open, you saw a bar disappear
     * and a curtain start afterwards.
     *
     * Placed in pairs at cMid ± (lineWidth/2 + k·pitch), the two innermost
     * lines meet edge to edge exactly on the seam. The opening starts as the
     * hairline between them — geometrically it is `lineWidth` wide at q = 0,
     * and those two lines cover it completely, so nothing pops. From there the
     * white and the black part together, which is what a curtain is.
     */
    const perSide = Math.max(3, Math.min(13, Math.round(cMax / (grid * 1.4))));
    const pitch = cMid / perSide;
    const rest = [];
    for (let k = 0; k < perSide; k++) {
        const d = lineWidth / 2 + k * pitch;
        rest.push(cMid - d, cMid + d);
    }
    const lines = rest.length;
    const tMin = -height;
    const tMax = height * 2;

    // Phase boundaries as fractions of the whole run.
    const slashEnd = REVEAL_SLASH_MS / DISCOVERY_MS;
    const holdEnd = (REVEAL_SLASH_MS + REVEAL_HOLD_MS) / DISCOVERY_MS;

    // The outline and the name run WITH the lines, not after them: one gesture
    // in one colour rather than three things taking turns.
    flashOutline(fx, region, rect);

    const state = { t: 0 };
    const done = () => {
        fogScratch.destroy({ children: true });
        lineScratch.destroy({ children: true });
        for (const sprite of [fogSprite, lineSprite]) if (sprite && !sprite.destroyed) sprite.destroy();
        for (const texture of [fogTex, lineTex]) if (texture && !texture.destroyed) texture.destroy(true);
    };

    const animation = CanvasAnimation.animate([{ parent: state, attribute: "t", to: 1 }], {
        duration: DISCOVERY_MS,
        ontick: () => {
            if (!fogSprite || fogSprite.destroyed || !lineSprite || lineSprite.destroyed) return;
            if (!fogTex || fogTex.destroyed || !lineTex || lineTex.destroyed) return;

            const t = state.t;
            let opening = 0;                    // half-width of the opened band
            const at = new Array(lines);
            // The stretch of each line that is currently drawn. `tMin` is the
            // top of the drawn area and `tMax` the bottom, so a line running
            // from one to the other is at full height.
            const top = new Array(lines).fill(tMin);
            const bottom = new Array(lines).fill(tMax);

            if (t < slashEnd) {
                /*
                 * THE CUT — UP FROM THE FLOOR, not in from the side.
                 *
                 * The lines stand where they will end up and grow upward out of
                 * the bottom edge of the room. Sliding them in sideways was the
                 * first version and it fought the geometry: these are vertical
                 * lines, so travelling along their own axis is the one
                 * direction in which they cannot be seen to move at all, and
                 * every other direction reads as drift rather than as a cut.
                 *
                 * Sharper than a quartic: almost the whole distance is covered
                 * in the first third of the phase, then it glides in. The
                 * contrast between those two speeds IS the cut. Staggered by
                 * index, so the room is struck rather than curtained.
                 */
                for (let i = 0; i < lines; i++) {
                    at[i] = rest[i];
                    const local = clamp01((t / slashEnd - (i / lines) * 0.45) / 0.55);
                    const travel = 1 - Math.pow(1 - local, 2);

                    // SHORT BARS, so the arrival is visible at all.
                    //
                    // Everything here is clipped to the room's own shape, which
                    // means a bar reaching past the bottom wall has its lower
                    // end hidden and only its tip to show for itself — and a
                    // tip climbing a wall looks exactly like a line growing out
                    // of the floor, whatever it is really doing. A bar shorter
                    // than the room keeps both ends inside it, and then you can
                    // see the thing travel.
                    const bar = (tMax - tMin) * 0.30;
                    top[i] = Math.max(tMin, height - (height - tMin) * travel);

                    // The trailing end catches up over the second half, so the
                    // bars are at full height by the time the pause begins.
                    const settle = clamp01((travel - 0.5) / 0.5);
                    bottom[i] = top[i] + bar + (tMax - top[i] - bar) * settle;
                }
            } else if (t < holdEnd) {
                // THE PAUSE. Nothing moves; the room is still shut.
                for (let i = 0; i < lines; i++) at[i] = rest[i];
            } else {
                /*
                 * THE CURTAIN. Every line leaves through the same edge, and
                 * they all arrive there together — so a line that starts near
                 * the middle has further to travel and therefore MOVES FASTER
                 * than one already near the wall. That is what makes it read as
                 * a curtain being drawn rather than a block sliding apart.
                 *
                 * The opening is the position of the INNERMOST line, which is
                 * why no line is ever crossed by the reveal: for any two lines,
                 * the gap between them closes only as `q` runs out.
                 */
                /*
                 * EASE IN AND OUT, QUINTIC. A pure ease-out started at full
                 * speed, which meant the curtain was already moving fastest at
                 * the instant the pause ended — no gathering, no release. This
                 * holds still for a beat, throws the lines apart through the
                 * middle, and settles them at the wall. Same duration, far more
                 * difference between the slowest and fastest moment, which is
                 * what "more dynamic" actually means here.
                 */
                const x = clamp01((t - holdEnd) / (1 - holdEnd));
                const q = x < 0.5
                    ? 16 * x * x * x * x * x
                    : 1 - Math.pow(-2 * x + 2, 5) / 2;
                const exit = cMid + pitch;
                let innermost = exit;
                for (let i = 0; i < lines; i++) {
                    const from = Math.abs(rest[i] - cMid);
                    const to = from + (exit - from) * q;
                    at[i] = cMid + (rest[i] >= cMid ? to : -to);
                    innermost = Math.min(innermost, to);
                }
                opening = innermost;
            }

            // The fog, minus whatever the curtain has opened.
            fogCut.clear();
            if (opening > 0) {
                fogCut.beginFill(0xffffff, 1);
                fogCut.drawPolygon(bandQuad(cMid - opening, cMid + opening, tMin, tMax));
                fogCut.endFill();
            }

            // The lines: a room-shaped sheet of white with the gaps taken out.
            lineCut.clear();
            lineCut.beginFill(0xffffff, 1);

            // Everything between the lines goes.
            const sorted = at.slice().sort((a, b) => a - b);
            let edge = cLow;
            for (const c of sorted) {
                const from = c - lineWidth / 2;
                if (from > edge) lineCut.drawPolygon(bandQuad(edge, from, tMin, tMax));
                edge = c + lineWidth / 2;
            }
            lineCut.drawPolygon(bandQuad(edge, cHigh, tMin, tMax));

            // And whatever falls outside each line's own stretch — above its
            // leading end, and below the end still trailing it.
            for (let i = 0; i < lines; i++) {
                const x = at[i] - lineWidth;
                const w = lineWidth * 3;
                if (top[i] > tMin) lineCut.drawRect(x, tMin, w, top[i] - tMin);
                if (bottom[i] < tMax) lineCut.drawRect(x, bottom[i], w, tMax - bottom[i]);
            }
            lineCut.endFill();

            // The lines bow out over the last third rather than snapping off.
            lineSprite.alpha = clamp01((1 - t) / 0.3);

            renderer.render(fogScratch, { renderTexture: fogTex, clear: true });
            renderer.render(lineScratch, { renderTexture: lineTex, clear: true });
        }
    });

    // THE BACKSTOP. `done` also runs on a timer, so this overlay cannot survive
    // its own animation going wrong — see `watchdog`.
    watchdog(animation, DISCOVERY_MS + 1500, done);
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

/**
 * The outline and the room's name, fading out together.
 *
 * BONE, NOT GOLD. The plan for this stage said "a short gold flash", but the
 * visual identity work reserved gold for Hope and nothing else — a third
 * meaning on that colour would undo the ordering that stage put in place.
 * White also ties the outline to the raster and to the edge of the sweep, so
 * the whole reveal speaks in one colour instead of three.
 */
function flashOutline(fx, region, rect) {
    if (!fx || fx.destroyed) return;

    // Whatever was outlined before, take it down — see `fadeRoomOutline`.
    fadeRoomOutline();

    const bone = colourOf("--drpg-bone", 0xe8e3ec);
    const grid = canvas?.grid?.size ?? 100;
    const bounds = regionBounds(region);

    const group = new PIXI.Container();
    group.name = OUTLINE_NAME;
    group.eventMode = "none";

    // Measured once; the outline skips these and the glow marks them.
    const edges = doorwayEdges(region);

    // Chunky and angular, in the pixel-art register the reveal raster set
    // (Dawid, 2026-08-26 — the old 4px stroke read thin and soft at play
    // zoom). Square caps are what close the corners: the gapped tracing draws
    // every edge as its own stroke, and two butt-capped strokes meeting at a
    // vertex each stop half a line-width short, leaving a notch in the corner.
    // A square cap extends each end by half the width, so the two ends
    // overlap into a full, sharp corner. Miter joins keep the drawPolygon
    // path's corners pointed instead of rounding them off.
    //
    // TWO PASSES, INK UNDER BONE. The white line is narrower than it was and
    // an ink keyline is drawn beneath it, wider by a pixel or two each side —
    // the sprite outline every pixel-art tile has, and what makes the border
    // hold against a bright floor instead of dissolving into it.
    //
    // Both passes walk the SAME gapped path, which is the whole reason the ink
    // is drawn here rather than as a filled backing shape: where the wall opens
    // there is no white line and there must be no black one either, or the
    // keyline would draw a lid across the doorway the glow is marking as a way
    // out. One trace, one set of gaps, and the two can never disagree.
    const boneWidth = Math.max(7, Math.round(grid * 0.11));
    const inkWidth = boneWidth + Math.max(4, Math.round(grid * 0.05));
    // Measured off the WIDER pass, and used by both: the gaps have to clear
    // the ink, and a bone line cut back to a different margin would poke out
    // past the keyline at every opening.
    const gapPad = grid * 0.05 + inkWidth / 2;

    const outline = new PIXI.Graphics();
    /*
     * SQUARE CAPS ONLY AT THE ENDS OF A CHAIN, AND A MITER THAT CANNOT SPIKE.
     *
     * `traceOutlineGapped` walks contiguous stretches as single paths now, so
     * the caps that used to close every segment's corners have no corners left
     * to close — and on a grid staircase, where a step is about as long as the
     * line is wide, those caps were what turned the border into a thick blocky
     * ribbon. Measured on a purpose-built staircase fixture: the corners came
     * out filled solid, and the steps stopped reading as steps.
     *
     * Miter, not bevel. A bevel is safe but cuts every corner at 45°, which on
     * a square grid throws away the one thing this outline is meant to look
     * like. A miter keeps the corner square; the limit of 2 is what stops a
     * sharp V growing the spike that a limit of 8 allowed — past that ratio
     * PIXI falls back to a bevel by itself, which is exactly the right
     * behaviour for the rare acute corner.
     */
    const stroke = (width, color) => outline.lineStyle({
        width, color, alpha: 1, cap: "square", join: "miter", miterLimit: 2
    });

    const trace = () => {
        if (edges.length) traceOutlineGapped(outline, edges, rect, gapPad);
        else traceRegionPathsAt(outline, region, rect);
    };

    stroke(inkWidth, colourOf("--drpg-ink", 0x1a1620));
    trace();
    stroke(boneWidth, bone);
    trace();

    // Sized from the grid rather than fixed. A flat 28px in scene units is
    // eleven pixels on screen at a zoom of 0.4, which is where this label spent
    // its life being unreadable.
    const label = new PIXI.Text(region.name, {
        fontFamily: "DRPG Pixel, monospace",
        fontSize: Math.max(28, Math.round(grid * 1.1)),
        fill: bone,
        stroke: colourOf("--drpg-ink", 0x1a1620),
        strokeThickness: Math.max(4, Math.round(grid * 0.11)),
        align: "center"
    });
    label.resolution = 2;
    label.anchor.set(0.5, 0.5);

    // If the face was still loading when this was measured, the label is
    // wearing a fallback. Marking it dirty is what makes PIXI measure and
    // rasterise a second time, once there is something better to measure.
    ensurePixelFont().then(() => {
        if (!label.destroyed) label.dirty = true;
    }).catch(() => { /* the fallback stands */ });
    if (bounds) {
        label.position.set(bounds.x - rect.x + bounds.w / 2, bounds.y - rect.y + bounds.h / 2);
    }

    group.addChild(outline, label);
    // Under the outline and the name, so neither is softened by it.
    addDoorwayGlow(group, region, edges, rect);
    group.setChildIndex(outline, group.children.length - 1);
    group.setChildIndex(label, group.children.length - 1);
    fx.addChild(group);

    roomOutline = { group, outline, room: region.name };

    /*
     * THE LANDING. Two decreasing hops rather than one, because a single arc
     * reads as a slide and the point is that the room arrives — it drops in,
     * catches, and settles. `Math.abs(sin)` gives the hops, the `(1 - t)`
     * factor takes the height out of each one in turn.
     */
    // Big enough to read as a landing rather than a nudge. The motion was
    // right at a third of a square and simply too small to see.
    // UP AND TO THE RIGHT, on the same reasoning as `bandQuad`: the isometric
    // module on The Forge rotates the canvas, so a hop expressed on the
    // diagonal here arrives as a clean vertical one there.
    const jump = grid * 0.9;
    const bounceState = { t: 0 };
    const bounce = CanvasAnimation.animate([{ parent: bounceState, attribute: "t", to: 1 }], {
        duration: BOUNCE_MS,
        ontick: () => {
            if (group.destroyed) return;
            const t = clamp01(bounceState.t);
            const hop = jump * Math.abs(Math.sin(Math.PI * t * 1.7)) * (1 - t);
            group.x = hop;
            group.y = -hop;
        }
    });
    watchdog(bounce, BOUNCE_MS + 750, () => {
        if (group.destroyed) return;
        group.x = 0;
        group.y = 0;
    });

    /*
     * THE NAME GOES, THE OUTLINE STAYS. Naming a room is an announcement and
     * announcements end; the outline is a statement of where you are, and that
     * is true until you walk out. `fadeRoomOutline` is what ends it.
     */
    const labelState = { t: 0 };
    const dropLabel = () => { if (!label.destroyed) label.destroy(); };
    const fading = CanvasAnimation.animate([{ parent: labelState, attribute: "t", to: 1 }], {
        duration: OUTLINE_MS,
        ontick: () => {
            if (label.destroyed) return;
            // Full through the cut and the pause, fading only as the curtain
            // opens — the name should be readable while the room is still shut.
            label.alpha = clamp01((1 - labelState.t) / 0.35);
        }
    });
    watchdog(fading, OUTLINE_MS + 1500, dropLabel);
}

/* ==========================================================================
 * DOORWAYS — where the outline says "you can get out this way".
 * --------------------------------------------------------------------------
 * A room's outline tells a player where they are. Along most of it there is a
 * wall; along some of it there is a way into the next room, and that is the
 * only part of the border they can actually do anything with. So the stretches
 * with no wall on them get a soft Bone glow, thrown OUTWARD from the edge.
 *
 * Two conditions, and both matter. There has to be another named Region on the
 * far side — otherwise the outer perimeter of the map, which has no walls
 * because there is nothing out there, would light up all the way round. And
 * there has to be no wall in the way, tested with Foundry's own movement
 * polygon backend rather than by looking at wall geometry ourselves, so a door,
 * a window and a secret passage are all judged exactly as the movement rules
 * judge them.
 * ========================================================================== */

const DOORWAY_ALPHA = 0.6;
/**
 * How far the glow reaches past the border, in grid squares.
 *
 * It has to read from across the table as "there is a way through here", which
 * a half-square smudge does not — at the zoom people actually play at, that is
 * a few pixels. Deep enough to be a direction rather than a mark.
 */
const DOORWAY_DEPTH = 1.3;
/**
 * How many nested outlines the falloff is built from — see `addDoorwayGlow`.
 *
 * Each step contributes an equal slice of `DOORWAY_ALPHA`, so this is the
 * number of levels the gradient is quantised into. Sixteen over a depth of a
 * grid square and a bit puts a step every couple of pixels, which is below
 * anything an eye can pick out as banding, and costs sixteen draws of one
 * small texture once per room entry.
 */
const DOORWAY_STEPS = 16;
/**
 * How far along the border the glow's line is averaged, in grid squares each
 * side — see `smoothPolyline`.
 *
 * A grid staircase repeats every two squares of border walked (one across,
 * one along), and a moving average whose whole window covers a full period
 * cancels that period almost exactly: one square each side leaves under a
 * tenth of the wobble. Wide enough to take the tiles out, narrow enough that
 * a real corner is only softened by a fraction of a square — and the glow is
 * the only thing that reads this. The outline still traces the true border.
 */
const DOORWAY_SMOOTH = 1;
/**
 * How much of the averaging's amplitude is paid back as full-strength core —
 * the one honest trade-off in this glow, and the knob for it.
 *
 * A straight outer edge over a jagged wall cannot also hold the wall at a
 * constant depth: the wall wanders, the edge does not. Widening the core by
 * the whole amplitude puts every part of the wall at full brightness and
 * makes the glow reach about a quarter deeper than a flat wall's. Not
 * widening it at all matches the depth exactly and lets the brightness ripple
 * at the pitch of the tiles instead.
 *
 * Half splits it: about eight per cent deep and eight per cent of ripple,
 * both under what anybody picks out on a map. Raise it toward 1 for even
 * brightness, drop it toward 0 for even depth.
 */
const DOORWAY_AVERAGE_BIAS = 0.5;
/**
 * How far INSIDE the room the wall test starts, in grid squares.
 *
 * It used to start two pixels in, and that is not enough for two reasons that
 * compound. A wall placed with the wall tool sits ON the region border, and
 * `PointSourcePolygon.testCollision` ROUNDS its endpoints to whole pixels — so a
 * ray beginning two pixels from a wall can be rounded onto it, and a ray that
 * starts on an edge is not counted as crossing it. Starting a fifth of a square
 * back puts the origin unambiguously on the inside.
 */
const DOORWAY_PROBE_IN = 0.18;
/**
 * How far OUTSIDE the room to look, in grid squares — both for the neighbouring
 * room and for anything in the way of reaching it.
 *
 * The first version looked 0.4 of a square out, which is inside the wall on
 * plenty of maps: the neighbour was found, the wall was never reached, and the
 * border came back "open" along its whole length.
 */
const DOORWAY_PROBE_OUT = 0.95;
/**
 * How far INSIDE our own border to stand when asking "am I already in another
 * room" — in grid squares.
 *
 * Asking at the border point itself does not work, and the reason is the whole
 * subtlety of this test. Two rooms that merely TOUCH share that point: it lies
 * on both polygons' boundary, and a ray-crossing containment test answers
 * boundary points arbitrarily. Asked there, every legitimate shared doorway
 * would come back "overlapping" and the fix would delete the feature it is
 * meant to repair.
 *
 * A quarter of a square inside our own room is outside a neighbour we merely
 * touch, and inside one we genuinely overlap. Overlaps shallower than this are
 * not caught here — they are sub-square misalignments, and the wall test below
 * is what answers those.
 */
const DOORWAY_OVERLAP_INSET = 0.25;
/**
 * How close a wall has to pass to a border sample to close it, in grid squares.
 *
 * Measured to the wall SEGMENT, not to its midpoint. A corridor wall drawn as
 * one ten-square segment has its midpoint five squares from most of the border
 * it runs alongside; asked about midpoints, every sample but the middle one
 * would report no wall nearby and the whole corridor would glow.
 */
const DOORWAY_WALL_NEAR = 0.6;
/**
 * How nearly parallel a wall must be to the border to count as closing it,
 * in degrees.
 *
 * A wall crossing the border at a right angle is a door jamb or the end of a
 * partition — it is beside the opening, not across it, and closing the doorway
 * because of one is how a real door stops being marked.
 */
const DOORWAY_WALL_ANGLE = 20;
/**
 * How long a stretch of border has to be, with no wall alongside it, before
 * `checkRegions` says so — in grid squares.
 *
 * NOT A LIMIT ON DOORWAYS. There is deliberately no upper bound on how wide a
 * way out may be: a hall open along one whole side is a real thing to build, and
 * a module that quietly trimmed it to three squares would be lying about the map
 * (Dawid, 27.08). This number only decides when the validator speaks up.
 *
 * Six squares, and the figure is measured rather than chosen. Every room has
 * border with no wall on it — that is what a doorway is — so the healthy rooms
 * on this project's own scene run up to 4.3 squares in one stretch, and the ones
 * whose border was drawn away from its wall start at 7.3. The line goes in the
 * gap between them.
 */
const ADRIFT_WARN_RUN = 6;
/** cos of DOORWAY_WALL_ANGLE, worked out once. */
const DOORWAY_WALL_COS = Math.cos(DOORWAY_WALL_ANGLE * Math.PI / 180);
/**
 * How far past the border the glow begins, as a fraction of a grid square.
 *
 * It used to start ON the line, which put its brightest part exactly where the
 * outline already is: the two stacked, and the gap read as a panel glued over
 * the opening rather than as light coming out of it. Beginning just beyond the
 * wall leaves the outline crisp and lets the glow belong to the space on the
 * far side, which is the space it is telling you about.
 */
const DOORWAY_OFFSET = 0.12;
/**
 * How strong the glow is at distance `t` (0 on the border, 1 at full depth).
 *
 * The shape the old gradient texture baked into its colour stops: most of the
 * strength held through the first half, then a tail — which is what makes a
 * deep glow read as reaching rather than as merely being large and faint.
 */
function doorwayFalloff(t) {
    if (t <= 0) return 1;
    if (t >= 1) return 0;
    return t <= 0.5 ? 1 - 0.56 * t : 1.44 * (1 - t);
}

/**
 * The distance at which the glow has fallen to `y` — `doorwayFalloff` read
 * backwards, which is what turns a strength into an outline width.
 */
function doorwayFalloffAt(y) {
    return y >= 0.72 ? (1 - y) / 0.56 : 1 - y / 1.44;
}

/**
 * The ramp that cuts an opening off at its ends: transparent where the
 * opening is still itself, opaque past the end of it.
 *
 * Drawn with `ERASE`, so what it takes away is `1 - falloff` and what
 * survives is the glow times the same curve that shapes it outward — the end
 * of a doorway's light fades on the same terms as its far edge does.
 */
function doorwayFadeTexture() {
    const width = 64;
    const el = document.createElement("canvas");
    el.width = width;
    el.height = 4;
    const ctx = el.getContext("2d");
    if (!ctx) return null;

    const ramp = ctx.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        ramp.addColorStop(t, `rgba(255, 255, 255, ${(1 - doorwayFalloff(t)).toFixed(3)})`);
    }
    ctx.fillStyle = ramp;
    ctx.fillRect(0, 0, width, el.height);
    return PIXI.Texture.from(el);
}

/** Distance from a point to a line SEGMENT, not to the infinite line. */
function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/**
 * Does a wall run alongside this stretch of border, close enough and straight
 * enough to be the wall this border describes?
 *
 * THIS IS THE QUESTION THE OLD TEST NEVER ASKED. It used to ask whether a ray
 * of a fixed length hit anything, which makes the answer depend on how far from
 * the wall the GM happened to draw the region — a border set back more than the
 * ray is long reports no wall and glows along its entire length, on a map where
 * the player can plainly see one.
 *
 * Only walls that actually stop movement count. A wall with no movement
 * restriction is scenery, and an OPEN door is a way out — closing an opening
 * because a door exists in it is precisely backwards.
 */
function wallAlongEdge(mx, my, ex, ey, walls, near) {
    try {
        return wallAlongEdgeUnguarded(mx, my, ex, ey, walls, near);
    } catch (err) {
        // FAILS CLOSED, the same way `nothingInTheWay` does and for the same
        // reason: a doorway that is really a wall is a lie the player walks
        // into, and a wall that is really a doorway costs them a moment's doubt
        // and a second try. When this cannot tell, it says there is a wall.
        debug("Fog: could not test a border sample for a wall alongside it", err);
        return true;
    }
}

function wallAlongEdgeUnguarded(mx, my, ex, ey, walls, near) {
    const NONE = CONST?.WALL_MOVEMENT_TYPES?.NONE ?? 0;
    const OPEN = CONST?.WALL_DOOR_STATES?.OPEN ?? 1;

    for (const wall of walls) {
        const c = wall.c;
        if (!c || c.length < 4) continue;
        if (wall.move === NONE) continue;
        if (wall.door && wall.ds === OPEN) continue;

        const wx = c[2] - c[0];
        const wy = c[3] - c[1];
        const len2 = wx * wx + wy * wy;
        if (!len2) continue;

        /*
         * MEASURED ACROSS THE WALL, AND ONLY WHERE THE WALL ACTUALLY RUNS.
         *
         * Distance to the segment — which counts its endpoints — eats the
         * doorway from both sides: a sample standing IN a two-square opening is
         * within the radius of the wall that stops at its edge, so it reads as
         * closed, and the opening comes out shorter than it is by the radius at
         * each end. Measured on a two-square fixture door: it rendered one
         * square wide.
         *
         * So the sample has to lie alongside the wall's own span before its
         * distance is worth taking. Past the end of a wall there is no wall to
         * be near, however close its last point happens to be.
         */
        const t = ((mx - c[0]) * wx + (my - c[1]) * wy) / len2;
        if (t < 0 || t > 1) continue;
        if (Math.hypot(mx - (c[0] + wx * t), my - (c[1] + wy * t)) > near) continue;

        // Parallel either way round — a wall does not care which end you call
        // its start, so the sign of the dot product carries no information.
        const wl = Math.sqrt(len2);
        if (Math.abs((wx / wl) * ex + (wy / wl) * ey) >= DOORWAY_WALL_COS) return true;
    }
    return false;
}

/** Is this point inside that region? Polygons are passed in already built. */
function inPolygons(polygons, x, y) {
    for (const poly of polygons) if (poly.contains(x, y)) return true;
    return false;
}

/**
 * Can something move from just inside the edge to just outside it?
 *
 * Asked of the movement backend, so whatever Foundry counts as passable here —
 * an open door, a window a token may not cross, a wall with no movement
 * restriction — is counted the same way the game counts it everywhere else.
 *
 * Fails CLOSED. A doorway that is really a wall is a lie the player would walk
 * into; a wall that is really a doorway costs them nothing but a moment's
 * doubt, and they can simply try it.
 */
function nothingInTheWay(from, to) {
    const backend = CONFIG?.Canvas?.polygonBackends?.move;
    if (!backend?.testCollision) return true;
    try {
        return !backend.testCollision(from, to, { type: "move", mode: "any" });
    } catch (err) {
        debug("Fog: could not test a doorway for walls", err);
        return false;
    }
}

/**
 * Where the next room begins on the far side of this point, if it does.
 *
 * Stepped outward rather than sampled at one distance: rooms are not laid out
 * to a fixed gap, and a single probe length is either too short to clear the
 * wall on one map or long enough to find a room two doors away on another.
 *
 * @returns {{x: number, y: number}|null}
 */
function neighbourBeyond(mx, my, nx, ny, others, reach) {
    for (const fraction of [0.35, 0.6, 0.85, 1]) {
        const x = mx + nx * reach * fraction;
        const y = my + ny * reach * fraction;
        if (others.some(p => inPolygons(p, x, y))) return { x, y };
    }
    return null;
}

/**
 * Add the glow along every open stretch of a room's border.
 *
 * Runs once when a room is entered, walking its outline in short samples. A
 * room with a two-thousand-pixel perimeter is eighty tests, which is nothing
 * for something that happens when somebody walks through a door.
 */
/**
 * Every edge of a room's border, and the stretches along each one that have no
 * wall on them.
 *
 * COMPUTED ONCE AND USED TWICE. The glow marks these stretches and the outline
 * has to skip exactly the same ones — two passes measuring the same thing
 * independently would eventually disagree by a pixel somewhere, and the seam
 * between a line that stops and a glow that starts is precisely where that
 * would show.
 *
 * The TRUE border, never a smoothed one. Flattening the ring before measuring
 * was tried, to stop a grid staircase coming out as a ladder of little glow
 * patches, and it was the wrong cut: it moved the line the glow sits on away
 * from the wall it describes, which shows up as the glow slicing across
 * corners — and it left the real defects, which were in how the patches were
 * composited, exactly where they were. `addDoorwayGlow` handles the staircase
 * now, on this same honest geometry.
 */
function doorwayEdges(region) {
    try {
        const scene = canvas?.scene;
        if (!scene) return [];

        const grid = canvas?.grid?.size ?? 100;
        const step = Math.max(8, grid * 0.25);
        const back = grid * DOORWAY_PROBE_IN;
        const reach = grid * DOORWAY_PROBE_OUT;
        const shortest = grid * 0.35;

        const inset = grid * DOORWAY_OVERLAP_INSET;
        const near = grid * DOORWAY_WALL_NEAR;

        const own = regionShapes(region, { x: 0, y: 0 }).map(f => new PIXI.Polygon(f));
        if (!own.length) return [];

        const others = [];
        for (const other of scene.regions ?? []) {
            if (!other.name || other === region) continue;
            others.push(regionShapes(other, { x: 0, y: 0 }).map(f => new PIXI.Polygon(f)));
        }

        // Read once. A scene with several hundred walls is asked about at every
        // sample of every edge, and `scene.walls` is a collection, not an array.
        const walls = Array.from(scene.walls ?? []);

        const edges = [];
        for (let ring = 0; ring < own.length; ring++) {
            const poly = own[ring];
            const flat = poly.points;
            const corners = flat.length / 2;

            for (let i = 0; i < corners; i++) {
                const ax = flat[i * 2];
                const ay = flat[i * 2 + 1];
                const j = (i + 1) % corners;
                const dx = flat[j * 2] - ax;
                const dy = flat[j * 2 + 1] - ay;
                const length = Math.hypot(dx, dy);
                if (length < 1) continue;

                // The normal pointing OUT of the room, chosen by trying one and
                // seeing whether it lands back inside.
                let nx = -dy / length;
                let ny = dx / length;
                if (inPolygons(own, ax + dx / 2 + nx * 2, ay + dy / 2 + ny * 2)) {
                    nx = -nx;
                    ny = -ny;
                }

                const open = [];
                if (others.length && length >= shortest) {
                    const samples = Math.max(1, Math.round(length / step));
                    let from = null;

                    for (let k = 0; k <= samples; k++) {
                        const t = k / samples;
                        let isOpen = false;

                        if (k < samples) {
                            const mid = (k + 0.5) / samples;
                            const mx = ax + dx * mid;
                            const my = ay + dy * mid;

                            /*
                             * TWO QUESTIONS, TWO DIFFERENT DISTANCES.
                             *
                             * Whether a room lies beyond is answered by stepping
                             * outward until one is found. Whether anything is in
                             * the way is answered along the FULL reach, every
                             * time — and those are not the same ray.
                             *
                             * They used to be, and it showed: where a neighbour
                             * abutted this room the search stopped at its first
                             * step, a third of a square out, and the ray ended
                             * before it got to the wall. Rooms that touched came
                             * back open along their whole shared border while a
                             * room further off, needing a longer search, had its
                             * wall found correctly. Same map, same walls,
                             * opposite answers, purely because of how close the
                             * next room happened to be.
                             */
                            /*
                             * A SAMPLE THAT IS ALREADY IN ANOTHER ROOM IS NOT A
                             * BORDER. Where two regions overlap, this room's
                             * edge runs somewhere inside its neighbour's floor —
                             * a square or more from any wall — so a neighbour is
                             * found instantly and no ray ever reaches a wall.
                             * The whole shared border then reads as one enormous
                             * doorway, which is symptom one on every screenshot.
                             *
                             * Asked a quarter square INSIDE our own room, not on
                             * the line: rooms that merely touch share the line
                             * itself, and containment on a boundary point is
                             * arbitrary. See DOORWAY_OVERLAP_INSET.
                             */
                            const inX = mx - nx * inset;
                            const inY = my - ny * inset;
                            const overlapping = others.some(p => inPolygons(p, inX, inY));

                            const beyond = overlapping
                                ? null
                                : neighbourBeyond(mx, my, nx, ny, others, reach);

                            isOpen = Boolean(beyond)
                                // Is there a wall running along this stretch?
                                // Asked of the walls themselves, so the answer
                                // no longer depends on how far from the wall the
                                // region was drawn.
                                && !wallAlongEdge(mx, my, dx / length, dy / length, walls, near)
                                // And is it passable in the way Foundry counts
                                // passable — which is what reads door state.
                                && nothingInTheWay(
                                    { x: mx - nx * back, y: my - ny * back },
                                    { x: mx + nx * reach, y: my + ny * reach }
                                );
                        }

                        if (isOpen && from === null) from = t;
                        if (!isOpen && from !== null) {
                            // However long it is. A doorway has no upper size:
                            // a room open along one whole side is something a GM
                            // is allowed to build, and trimming it would draw a
                            // wall that is not on the map.
                            if ((t - from) * length >= shortest) open.push([from, t]);
                            from = null;
                        }
                    }
                }

                edges.push({ ax, ay, dx, dy, length, nx, ny, ring, open });
            }
        }

        return edges;
    } catch (err) {
        debug("Fog: could not work out where the doorways are", err);
        return [];
    }
}

/**
 * The open stretches, chained into the OPENINGS they actually form.
 *
 * An opening is a continuous run of unwalled border, and it does not care
 * where one polygon edge ends and the next begins. A diagonal wall drawn on
 * square tiles is a staircase of two-dozen little edges, and treating each as
 * its own opening is the whole reason the glow used to come out as a ladder of
 * separate patches. Chained here, that staircase is one opening with one
 * gradient — which is what a reader sees when they look at it.
 *
 * Joined on shared endpoints, in ring order, with the last chain allowed to
 * continue into the first so a border that is open all the way round closes up
 * rather than showing a seam at vertex zero.
 */
function doorwayChains(edges, rect) {
    const chains = [];
    for (const edge of edges) {
        for (const [from, to] of edge.open) {
            const a = { x: edge.ax + edge.dx * from - rect.x, y: edge.ay + edge.dy * from - rect.y };
            const b = { x: edge.ax + edge.dx * to - rect.x, y: edge.ay + edge.dy * to - rect.y };
            const last = chains[chains.length - 1];
            const tail = last?.[last.length - 1];
            if (tail && Math.hypot(tail.x - a.x, tail.y - a.y) < 0.5) last.push(b);
            else chains.push([a, b]);
        }
    }

    if (chains.length > 1) {
        const first = chains[0];
        const last = chains[chains.length - 1];
        const tail = last[last.length - 1];
        if (Math.hypot(tail.x - first[0].x, tail.y - first[0].y) < 0.5) {
            first.unshift(...last.slice(0, -1));
            chains.pop();
        }
    }
    return chains;
}

/**
 * A polyline resampled at a fixed step, so the smoothing that follows sees
 * evenly spaced points rather than whatever spacing the map was drawn with.
 */
function resamplePolyline(points, step) {
    const out = [{ x: points[0].x, y: points[0].y }];
    let carry = 0;
    for (let i = 1; i < points.length; i++) {
        const ax = points[i - 1].x, ay = points[i - 1].y;
        const dx = points[i].x - ax, dy = points[i].y - ay;
        const length = Math.hypot(dx, dy);
        if (length < 1e-9) continue;
        let at = step - carry;
        while (at <= length) {
            out.push({ x: ax + dx * (at / length), y: ay + dy * (at / length) });
            at += step;
        }
        carry = length - (at - step);
    }
    const end = points[points.length - 1];
    const tail = out[out.length - 1];
    if (Math.hypot(tail.x - end.x, tail.y - end.y) > 1e-6) out.push({ x: end.x, y: end.y });
    return out;
}

/**
 * A polyline with the grid out of it — a moving average over `half` samples
 * each side.
 *
 * THE STAIRCASE IS AN ARTEFACT OF THE TILES, NOT A FACT ABOUT THE WALL. A
 * diagonal drawn on square grid squares zig-zags by about a third of a square
 * either side of the line it means, and a glow thrown from that zig-zag keeps
 * the zig-zag: the field bulges into an arc around every outer corner and
 * scallops back in between them, which is a wavy edge where the reader is
 * looking at a straight wall.
 *
 * Averaging rather than simplifying, and this is the part worth being careful
 * about. Dropping vertices (Ramer–Douglas–Peucker) replaces a run of border
 * with the straight chord between two surviving corners, so wherever the
 * chosen corners sit badly the line cuts visibly across the real geometry —
 * which is exactly what it did. A moving average moves every point by at most
 * the local wobble, so a staircase flattens onto its own mean while a genuine
 * corner merely softens by a fraction of a square.
 *
 * THE ENDS FOLLOW THE LOCAL TREND. A window that simply closes up as it runs
 * out of samples is anchored on the last one — and the last one is a corner of
 * the tiled border, up to an amplitude off the line it belongs to. The line
 * then bends out to meet it and the band bends with it: measured on a
 * staircase, the glow reached 34.6px from the mean at that end against 31.1px
 * everywhere else, which is the soft kick in an otherwise straight edge. So
 * the first and last few points are taken from a straight fit through the
 * stretch around them, faded into the ordinary average over the same distance
 * so the two meet without a step.
 */
function smoothPolyline(points, half) {
    const n = points.length;
    if (n < 3 || half < 1) return points;

    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        const w = Math.min(half, i, n - 1 - i);
        let sx = 0, sy = 0;
        for (let k = i - w; k <= i + w; k++) { sx += points[k].x; sy += points[k].y; }
        out[i] = { x: sx / (2 * w + 1), y: sy / (2 * w + 1) };
    }

    // Least squares against distance from the end, over twice the window —
    // long enough to span a full tile period, which is what makes the fit the
    // staircase's own mean rather than one of its corners.
    const span = Math.min(n - 1, half * 2);
    const trend = step => {
        const from = step > 0 ? 0 : n - 1;
        let sk = 0, sx = 0, sy = 0, skk = 0, skx = 0, sky = 0;
        for (let k = 0; k <= span; k++) {
            const p = points[from + k * step];
            sk += k; sx += p.x; sy += p.y; skk += k * k; skx += k * p.x; sky += k * p.y;
        }
        const count = span + 1;
        const den = count * skk - sk * sk;
        if (!den) return null;
        return {
            ax: (sx * skk - sk * skx) / den, bx: (count * skx - sk * sx) / den,
            ay: (sy * skk - sk * sky) / den, by: (count * sky - sk * sy) / den
        };
    };

    const blend = (fit, index, k) => {
        if (!fit) return;
        const t = k / half;
        const fx = fit.ax + fit.bx * k, fy = fit.ay + fit.by * k;
        out[index] = {
            x: fx * (1 - t) + out[index].x * t,
            y: fy * (1 - t) + out[index].y * t
        };
    };

    const head = trend(1);
    const tail = trend(-1);
    for (let k = 0; k < Math.min(half, n); k++) {
        blend(head, k, k);
        blend(tail, n - 1 - k, k);
    }
    return out;
}

/**
 * A polyline shortened by `cut` of arc length at each end, never below a
 * pixel of remaining length — a one-square doorway trimmed to nothing would
 * light nothing at all.
 */
function trimPolyline(points, cut) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const take = Math.min(cut, Math.max(0, (total - 1) / 2));
    if (take <= 0) return points;

    const at = distance => {
        let walked = 0;
        for (let i = 1; i < points.length; i++) {
            const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            if (walked + length >= distance) {
                const t = length ? (distance - walked) / length : 0;
                return {
                    x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
                    y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
                    seg: i
                };
            }
            walked += length;
        }
        const end = points[points.length - 1];
        return { x: end.x, y: end.y, seg: points.length - 1 };
    };

    const head = at(take);
    const foot = at(total - take);
    const out = [{ x: head.x, y: head.y }];
    for (let i = head.seg; i < foot.seg; i++) out.push(points[i]);
    out.push({ x: foot.x, y: foot.y });
    return out;
}

/**
 * The glow along every open stretch of a room's border.
 *
 * ONE FIELD, NOT ONE PATCH PER SEGMENT — and that is the whole of this
 * rewrite. The old version put a rectangular gradient sprite on each open
 * segment, thrown outward along that segment's own normal, which broke in
 * three ways the moment a border was not a straight line:
 *
 *   they ADDED UP     two sprites overlap and PIXI blends them additively, so
 *                     a staircase came out at nearly twice the intended alpha
 *                     — measured at 1.16 against a design value of 0.6
 *   they SPILLED      a rectangle thrown perpendicular to one little tooth of
 *                     a staircase crosses the floor of the room it came from
 *   they were BOXY    two dozen axis-aligned patches where the reader sees one
 *                     diagonal wall
 *
 * None of that is fixable by tidying the geometry the patches sit on — the
 * first two are compositing, not shape. So the glow is now a DISTANCE FIELD:
 * strength is a function of how far a pixel is from the nearest open border,
 * and a function has one value, so nothing can stack with anything.
 *
 * Built without a shader, out of nested outlines. Each of `DOORWAY_STEPS`
 * levels strokes every opening at a decreasing width into a scratch texture —
 * flat white at full alpha, so overlapping strokes UNION rather than sum — and
 * that binary silhouette is then added to the accumulator at an equal slice of
 * the total alpha. A pixel `d` away is inside every level wider than `d`, so it
 * ends up at `alpha × falloff(d)`: the gradient, by construction, and identical
 * whether one opening reaches it or five.
 *
 * Round caps and joins are what make a staircase read as one straight run:
 * the isolines of a distance field around a jagged line are smooth a few
 * pixels out, so the glow leaves the border as a clean diagonal without
 * anybody having to fake the geometry it came from.
 *
 * Finally the room's own shape is ERASED from the field, so a doorway can
 * never light the floor it belongs to, and the border itself is erased a
 * little wider so the white outline stays crisp on top of it.
 */
function addDoorwayGlow(group, region, edges, rect) {
    if (!group || group.destroyed) return;
    const renderer = canvas?.app?.renderer;
    if (!renderer) return;

    const grid = canvas?.grid?.size ?? 100;
    const depth = grid * DOORWAY_DEPTH;
    const out = grid * DOORWAY_OFFSET;
    const step = Math.max(1, grid / 5);
    const smoothHalf = Math.max(1, Math.round(grid * DOORWAY_SMOOTH / step));

    let amplitude = 0;
    const openings = [];
    for (const chain of doorwayChains(edges, rect)) {
        const dense = resamplePolyline(chain, step);
        const averaged = smoothPolyline(dense, smoothHalf);
        // How far the averaged line strays from the border it stands for —
        // the staircase's own amplitude, measured rather than assumed.
        for (let i = 0; i < dense.length; i++) {
            amplitude = Math.max(amplitude,
                Math.hypot(dense[i].x - averaged[i].x, dense[i].y - averaged[i].y));
        }
        if (averaged.length >= 2) openings.push(averaged);
    }
    if (!openings.length) return;

    /*
     * THE CORE IS WIDENED BY WHATEVER THE AVERAGING MOVED.
     *
     * The averaged line runs down the middle of the staircase, so the real
     * wall sits up to an amplitude either side of it. Left alone, the falloff
     * would already have started by the time it reached the wall on the teeth
     * that stick out and not on the ones that do not — a faint beading along
     * the border, at the pitch of the tiles, which is the artefact this whole
     * thing exists to remove. A flat full-strength core that wide puts every
     * part of the wall at full strength instead.
     *
     * The core is added to the depth rather than taken out of it. Taking it
     * out kept the outer edge the same distance from the averaged line and
     * made the GRADIENT ITSELF shorter on a jagged border than on a flat one —
     * a quarter shorter on a staircase of single squares, which reads as a
     * thin, hurried glow next to a straight wall's. The gradient is the thing
     * that has to match, so it is `depth` everywhere and the core is extra —
     * and only `DOORWAY_AVERAGE_BIAS` of the amplitude at that, which is where
     * the depth this adds is traded against the ripple it removes.
     */
    amplitude = Math.min(amplitude, grid);
    const core = out + amplitude * DOORWAY_AVERAGE_BIAS;
    const span = depth;

    const reach = core + span + 2;
    lastGlow = {
        openings: openings.length,
        points: openings.reduce((n, c) => n + c.length, 0),
        amplitude: Math.round(amplitude * 10) / 10,
        core: Math.round(core * 10) / 10,
        span: Math.round(span * 10) / 10,
        reachFromAveragedLine: Math.round((core + span) * 10) / 10,
        endAngles: []
    };
    /*
     * WHICH WAY EACH END RUNS, AND A STUB PAST IT.
     *
     * Two things are read off an opening's ends, and both have to be settled
     * before a single stroke is drawn.
     *
     * The direction is taken between two points that are both well inside the
     * opening. A chain's last point is pinned to the true border, so a
     * direction measured to it still carries whichever tile it landed on: on
     * a staircase that leans the cut about thirty degrees off the run.
     *
     * And the line is EXTENDED past the end before it is stroked. Otherwise
     * every level closes itself with a cap square to its own last segment —
     * axis-aligned, on a staircase — and that cap, not the gradient, is what
     * decides where the band stops across part of its depth. Running the
     * strokes off the end and cutting them afterwards leaves the cut as the
     * only thing shaping it.
     */
    const stub = reach + 4;
    const runs = openings.map(chain => {
        const tail = chain[chain.length - 1];
        const closed = Math.hypot(chain[0].x - tail.x, chain[0].y - tail.y) < 0.5;
        const inner = trimPolyline(chain, depth);
        const deeper = trimPolyline(chain, depth * 2);
        const far = deeper.length >= 2 ? deeper : null;

        const direction = (end, near, back) => {
            let dx = end.x - near.x, dy = end.y - near.y;
            if (back && Math.hypot(near.x - back.x, near.y - back.y) > 1) {
                dx = near.x - back.x;
                dy = near.y - back.y;
            }
            const length = Math.hypot(dx, dy);
            return length < 1e-6 ? null : { x: dx / length, y: dy / length };
        };

        const heads = closed || inner.length < 2 ? [] : [
            { at: chain[0], near: inner[0], head: true, dir: direction(chain[0], inner[0], far?.[0] ?? null) },
            { at: tail, near: inner[inner.length - 1], head: false, dir: direction(tail, inner[inner.length - 1], far?.[far.length - 1] ?? null) }
        ].filter(h => h.dir);

        const line = [...chain];
        for (const h of heads) {
            const past = { x: h.at.x + h.dir.x * stub, y: h.at.y + h.dir.y * stub };
            if (h.head) line.unshift(past);
            else line.push(past);
        }
        return { heads, line };
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const run of runs) {
        for (const p of run.line) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
    }
    const box = {
        x: Math.floor(minX - reach), y: Math.floor(minY - reach),
        w: Math.ceil(maxX - minX + reach * 2), h: Math.ceil(maxY - minY + reach * 2)
    };
    if (!(box.w > 0) || !(box.h > 0)) return;

    let field = null, level = null, strokes = null, blit = null, eraser = null;
    try {
        const resolution = Math.min(1, MAX_FOG_TEXTURE / Math.max(box.w, box.h));
        field = PIXI.RenderTexture.create({ width: box.w, height: box.h, resolution });
        level = PIXI.RenderTexture.create({ width: box.w, height: box.h, resolution });

        strokes = new PIXI.Graphics();
        blit = new PIXI.Sprite(level);
        blit.blendMode = PIXI.BLEND_MODES.ADD;
        blit.alpha = DOORWAY_ALPHA / DOORWAY_STEPS;

        for (let k = 1; k <= DOORWAY_STEPS; k++) {
            const half = core + span * doorwayFalloffAt((k - 0.5) / DOORWAY_STEPS);
            strokes.clear();
            strokes.lineStyle({ width: half * 2, color: 0xffffff, alpha: 1, cap: "butt", join: "round" });
            for (const { line } of runs) {
                strokes.moveTo(line[0].x - box.x, line[0].y - box.y);
                for (let i = 1; i < line.length; i++) {
                    strokes.lineTo(line[i].x - box.x, line[i].y - box.y);
                }
            }
            renderer.render(strokes, { renderTexture: level, clear: true });
            renderer.render(blit, { renderTexture: field, clear: k === 1 });
        }

        /*
         * THE ENDS ARE CUT ONCE, ACROSS THE WHOLE BAND.
         *
         * Shortening each level by a different amount fades the glow out along
         * the border, and on a straight wall it looks right — every level ends
         * on a cap perpendicular to the same wall, so the sixteen caps stack
         * into one clean edge. On a staircase they do not: a cap is
         * perpendicular to the little axis-aligned segment it happens to land
         * on, the segments alternate, and the sixteen ends come out as a
         * ragged step instead of a cut.
         *
         * So the band is built full length — run past its ends, even, so no
         * level's own cap can shape it — and cut afterwards, by one gradient
         * laid across it, square to the direction the opening actually runs
         * in. That is the same straight, single-gradient edge a flat wall
         * gets, because now it is literally the same operation. Anything past
         * the end goes entirely, so no light reaches around the doorframe.
         */
        // Both cuts have to clear the band comfortably in every direction: the
        // band reaches `reach` outward from the line and an amplitude inward
        // of it, and a cut that merely meets those edges leaves an
        // antialiased sliver standing.
        const halfBand = reach + amplitude + 6;
        const fadeTexture = doorwayFadeTexture();
        const ends = new PIXI.Container();
        const ownPolygons = regionShapes(region, rect).map(f => new PIXI.Polygon(f));
        const insideRoom = (x, y) => ownPolygons.some(p => p.contains(x, y));
        for (const run of runs) {
            for (const { at: end, near, dir } of run.heads) {
                const ux = dir.x, uy = dir.y;
                lastGlow.endAngles.push(Math.round(Math.atan2(uy, ux) * 180 / Math.PI));

                /*
                 * CENTRED ON THE LINE, NOT ON THE END POINT.
                 *
                 * Both cuts reach a half-band either side of wherever they are
                 * anchored, and the end point is a corner of the TRUE border —
                 * up to an amplitude off the line the band is built around. So
                 * anchoring there hung the cuts off centre and left the
                 * outermost few pixels of the band with nothing to stop them:
                 * measured on a staircase, everything from the wall out to 27px
                 * was cut square and the last three ran on past it. The end
                 * point still decides WHERE along the run the cut falls; only
                 * the centring comes off the line.
                 */
                const along = (end.x - near.x) * ux + (end.y - near.y) * uy;
                const ox = near.x + ux * along - box.x;
                const oy = near.y + uy * along - box.y;

                if (fadeTexture) {
                    const ramp = new PIXI.Sprite(fadeTexture);
                    ramp.blendMode = PIXI.BLEND_MODES.ERASE;
                    ramp.anchor.set(0, 0.5);
                    ramp.width = depth;
                    ramp.height = halfBand * 2;
                    ramp.position.set(ox - ux * depth, oy - uy * depth);
                    ramp.rotation = Math.atan2(uy, ux);
                    ends.addChild(ramp);
                }

                const nx = -uy, ny = ux;
                // Past the end of the stub the strokes were run out to, with
                // room to spare — matching it exactly left a line of pixels.
                const past = stub + 8;
                const beyond = new PIXI.Graphics();
                beyond.blendMode = PIXI.BLEND_MODES.ERASE;
                beyond.beginFill(0xffffff, 1);
                beyond.drawPolygon([
                    ox + nx * halfBand, oy + ny * halfBand,
                    ox - nx * halfBand, oy - ny * halfBand,
                    ox - nx * halfBand + ux * past, oy - ny * halfBand + uy * past,
                    ox + nx * halfBand + ux * past, oy + ny * halfBand + uy * past
                ]);
                beyond.endFill();
                ends.addChild(beyond);

            }
        }

        /*
         * THE INWARD SIDE GOES, ALL THE WAY ALONG.
         *
         * The band is built symmetrically about its line and the inward half
         * is taken away by erasing the room — which holds for exactly as long
         * as the room is what lies inward. At the end of an opening the border
         * turns and stops being that, and what is left is a lobe of glow on
         * the far side of the wall: measured on a staircase whose far end
         * meets the room's own bottom edge, 35px past the line there against
         * 3.5px anywhere else. That lobe is the bulge on an end that is
         * otherwise cut square.
         *
         * Past the lip, the inward side is inside the room at every point
         * ALONG an opening, so erasing it there costs nothing — and doing it
         * along the whole run, corners and stubs included, is what closes the
         * ends without a special case for each way a border can turn. The lip
         * keeps the sliver that is legitimately lit where the true wall dips
         * inside the averaged line.
         *
         * Which way is inward is asked of the room itself rather than read off
         * the winding, which no map is obliged to keep consistent.
         */
        const lip = Math.max(2, amplitude - out + 2);
        const deepIn = halfBand + stub + 10;
        for (const { line } of runs) {
            if (line.length < 2) continue;

            const normals = line.map((_, i) => {
                const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
                const dx = b.x - a.x, dy = b.y - a.y;
                const length = Math.hypot(dx, dy) || 1;
                return { x: -dy / length, y: dx / length };
            });

            const mid = Math.floor(line.length / 2);
            const probe = amplitude + 4;
            const sign = insideRoom(line[mid].x + normals[mid].x * probe,
                line[mid].y + normals[mid].y * probe) ? 1 : -1;

            const ribbon = [];
            for (let i = 0; i < line.length; i++) {
                ribbon.push(line[i].x + normals[i].x * sign * lip - box.x,
                    line[i].y + normals[i].y * sign * lip - box.y);
            }
            for (let i = line.length - 1; i >= 0; i--) {
                ribbon.push(line[i].x + normals[i].x * sign * deepIn - box.x,
                    line[i].y + normals[i].y * sign * deepIn - box.y);
            }

            const inwardCut = new PIXI.Graphics();
            inwardCut.blendMode = PIXI.BLEND_MODES.ERASE;
            inwardCut.beginFill(0xffffff, 1);
            inwardCut.drawPolygon(ribbon);
            inwardCut.endFill();
            ends.addChild(inwardCut);
        }
        if (ends.children.length) renderer.render(ends, { renderTexture: field, clear: false });
        ends.destroy({ children: true });
        if (fadeTexture) fadeTexture.destroy(true);

        // The room is not lit by its own doorways. Its shape comes out of the
        // field entirely, and a ring of `out` around the border with it, which
        // is what keeps the outline sitting on ink rather than on light.
        eraser = new PIXI.Graphics();
        eraser.blendMode = PIXI.BLEND_MODES.ERASE;
        const shapes = regionShapes(region, rect).map(points => {
            const shifted = new Array(points.length);
            for (let i = 0; i < points.length; i += 2) {
                shifted[i] = points[i] - box.x;
                shifted[i + 1] = points[i + 1] - box.y;
            }
            return shifted;
        });
        eraser.beginFill(0xffffff, 1);
        for (const points of shapes) eraser.drawPolygon(points);
        eraser.endFill();
        if (out > 0) {
            eraser.lineStyle({ width: out * 2, color: 0xffffff, alpha: 1, join: "round" });
            for (const points of shapes) eraser.drawPolygon(points);
        }
        renderer.render(eraser, { renderTexture: field, clear: false });

        const glow = new PIXI.Sprite(field);
        glow.tint = colourOf("--drpg-bone", 0xe8e3ec);
        glow.position.set(box.x, box.y);
        // `destroy({children: true})` does not free a texture — see `freeOwned`.
        glow.drpgOwnedTexture = field;
        group.addChild(glow);
        field = null;
    } catch (err) {
        debug("Fog: could not build the doorway glow", err);
        if (field && !field.destroyed) field.destroy(true);
    } finally {
        blit?.destroy();
        if (level && !level.destroyed) level.destroy(true);
        strokes?.destroy();
        eraser?.destroy();
    }
}

/**
 * Draw the room's outline, leaving the doorways out of it.
 *
 * A white line straight across an opening says the opposite of what the glow
 * beside it is saying. Where the wall stops, the outline stops.
 */
function traceOutlineGapped(graphics, edges, rect, pad = null) {
    const grid = canvas?.grid?.size ?? 100;
    // The gaps are widened by half a line width, because a square cap sticks
    // out that far past the end of a chain — without it the fattened line pokes
    // into the opening it was told to leave clear. Handed in when one path is
    // walked twice at two widths, so both passes cut back to the wider one's
    // margin and stay aligned.
    pad ??= grid * 0.05 + (graphics.line?.width ?? 0) / 2;

    const at = (edge, t) => ({
        x: edge.ax + edge.dx * t - rect.x,
        y: edge.ay + edge.dy * t - rect.y
    });

    /*
     * DRAWN AS CHAINS, NOT AS LOOSE SEGMENTS — and that is the whole of the
     * fix for the thick, lumpy staircase borders.
     *
     * Every edge used to be its own stroke with a square cap on each end, which
     * is what closed the corners: two butt-capped strokes meeting at a vertex
     * each stop half a line-width short and leave a notch. The cost only shows
     * on a grid staircase, where the steps are about as long as the line is
     * wide — there the caps of neighbouring segments overlap along their whole
     * length, and the border comes out as a wide angular ribbon rather than a
     * line. A sharp V made it worse: a miter limit of 8 lets the spike run out
     * to eight half-widths.
     *
     * Consecutive visible stretches are joined into one path here instead. PIXI
     * then caps only the two ends of a chain and JOINS everything between, so
     * corners are corners at any step size and nothing is drawn twice. A ring
     * with no openings at all closes on itself, so even its seam is a join.
     */
    const rings = new Map();
    for (const edge of edges) {
        const key = edge.ring ?? 0;
        if (!rings.has(key)) rings.set(key, []);
        rings.get(key).push(edge);
    }

    for (const ring of rings.values()) {
        const pieces = [];
        for (let index = 0; index < ring.length; index++) {
            const edge = ring[index];
            const margin = edge.length ? pad / edge.length : 0;
            const gaps = (edge.open ?? [])
                .map(([a, b]) => [Math.max(0, a - margin), Math.min(1, b + margin)])
                .sort((p, q) => p[0] - q[0]);

            let cursor = 0;
            for (const [a, b] of gaps) {
                if (a > cursor) pieces.push({ edge, index, from: cursor, to: a });
                cursor = Math.max(cursor, b);
            }
            if (cursor < 1) pieces.push({ edge, index, from: cursor, to: 1 });
        }
        if (!pieces.length) continue;

        const chains = [];
        let chain = null;
        let prev = null;
        for (const piece of pieces) {
            const joined = prev
                && piece.index === prev.index + 1
                && prev.to >= 1 - 1e-6
                && piece.from <= 1e-6;
            if (!joined) {
                chain = [at(piece.edge, piece.from)];
                chains.push(chain);
            }
            chain.push(at(piece.edge, piece.to));
            prev = piece;
        }

        // The ring's own seam: if the first stretch starts at the first edge's
        // start and the last ends at the last edge's end, those two are
        // neighbours on the map even though they sit at opposite ends of the
        // list.
        const first = pieces[0];
        const last = pieces[pieces.length - 1];
        const wraps = first.index === 0 && first.from <= 1e-6
            && last.index === ring.length - 1 && last.to >= 1 - 1e-6;
        if (wraps && chains.length === 1) chains[0].push(chains[0][0]);
        else if (wraps && chains.length > 1) {
            const tail = chains.pop();
            chains[0] = tail.concat(chains[0].slice(1));
        }

        for (const points of chains) {
            if (points.length < 2) continue;
            graphics.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) graphics.lineTo(points[i].x, points[i].y);
        }
    }
}

/**
 * The pixel font, actually loaded, before anything tries to draw with it.
 *
 * `PIXI.Text` rasterises ONCE, when it is created, by measuring the string
 * through Canvas 2D — and it never looks again. A face that has not finished
 * loading yet means the browser hands back a fallback, PIXI bakes that fallback
 * into a texture, and the label wears it for the rest of its life. The room
 * announced at `canvasReady` lands squarely in that window; every later one
 * finds the font ready, which is why only ever the FIRST room came out wrong.
 *
 * `font-display: swap` makes this worse rather than better: it guarantees the
 * fallback gets drawn rather than leaving the text blank until the face
 * arrives, which is right for HTML and exactly wrong for something that is
 * rasterised once and kept.
 *
 * Started at registration so it is almost always settled by the time it
 * matters, and awaited anyway by anything that draws with it.
 */
let pixelFontReady = null;

function ensurePixelFont() {
    if (pixelFontReady) return pixelFontReady;

    try {
        // Both faces: the module declares latin and latin-ext separately, and
        // `load` resolves for the characters asked about, not for the family.
        pixelFontReady = Promise.all([
            document.fonts.load('32px "DRPG Pixel"'),
            document.fonts.load('32px "DRPG Pixel"', "ĄĆĘŁŃÓŚŹŻ")
        ]).then(() => document.fonts.ready);
    } catch (err) {
        debug("Fog: could not wait for the pixel font", err);
        pixelFontReady = Promise.resolve();
    }

    return pixelFontReady;
}

/**
 * Take down the outline of a room that is no longer the viewer's.
 *
 * Called when another room is announced, and from `repaintFog` when the
 * outlined room stops being one this viewer stands in — walking into a corridor
 * has to end it just as surely as walking into another room does.
 */
function fadeRoomOutline() {
    const going = roomOutline;
    roomOutline = null;
    if (!going || going.group.destroyed) return;

    const group = going.group;
    const state = { t: 0 };
    const drop = () => {
        if (group.destroyed) return;
        freeOwned(group);
        group.destroy({ children: true });
    };
    const animation = CanvasAnimation.animate([{ parent: state, attribute: "t", to: 1 }], {
        duration: outlineFadeMs(),
        ontick: () => {
            if (group.destroyed) return;
            group.alpha = 1 - clamp01(state.t);
        }
    });
    watchdog(animation, outlineFadeMs() + 750, drop);
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
    // THE SCENE'S OWN dimensions, not the canvas's. This used to measure
    // whichever scene was on screen, so asking about any other one compared its
    // regions against a rectangle belonging to somewhere else — which is
    // exactly the question `diagnoseScenes` asks, about every scene at once.
    const dims = scene.dimensions ?? canvas?.dimensions;
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
