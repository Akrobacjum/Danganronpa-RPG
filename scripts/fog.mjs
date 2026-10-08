/**
 * Danganronpa RPG - fog of war, by room.
 * ---------------------------------------------------------------------------
 * Three states, one layer, over the whole scene:
 *
 *   the room you are in        full colour   - a hole cut clean through
 *   a room you have visited     a veil        - ~50% fog, so what is on the
 *                                               map there still reads as
 *                                               "somewhere I have been"
 *   everywhere else              full fog     - including any patch of the
 *                                               map that belongs to no Region
 *                                               at all, which is a map-drawing
 *                                               mistake and is meant to look
 *                                               like one
 *
 * Discovery is per CHARACTER, not per player and not per client: two of one
 * player's characters standing in different rooms both uncover their own.
 * The ledger reads `{ [sceneId]: { [actorId]: [roomName, ...] } }`, and a walk
 * into a room is written by the primary GM - see `onUpdateToken` below. Since D2
 * (Dawid, 13.09) it is a SECRET the way the incident's cast is: the GMs'
 * browsers hold every character's (a GM store since E04, `discoveryStore`: a
 * cell per room, true or unticked, merged by stamp between the GMs), each
 * player's browser only their own characters' (`fogCopy`), and the rows travel
 * over the addressed socket (`shareLedger`). "Which rooms has X been in" is
 * alibi evidence, and it no longer sits in a world setting any console can read.
 *
 * The Mastermind is the one exception, and it falls out of this model for
 * free: every room counts as "visited" for them (see `myDiscoveredRooms`),
 * because they built the building. It does not touch which room counts as
 * CURRENT - that still comes from where their own token actually stands - so
 * they still only see full colour in the room they are in, same as everyone
 * else. `visibility.mjs`, which hides other characters' TOKENS, is completely
 * untouched by any of this: the fog only ever answers "is this floor tile
 * lit", never "who is standing on it".
 *
 * THE FACADE (E34, 1.2.70). The pure shape math moved to fog-geometry.mjs, the
 * doorways - the wall test, the openings, the glow, the gapped outline, the seam
 * colour and `MAX_FOG_TEXTURE` - to fog-doorways.mjs, the reveal and the room's
 * outline, with `clearTransient` and the layer's finder it needs, to
 * fog-reveal.mjs, and the map's checks, `whatIsHere` and `sceneUncoveredPercent`
 * to fog-diagnostics.mjs, by pure moves that `node tools/moved-only.mjs` proves.
 * Of their names this file exported five, and it re-exports them: `seamWidth` and
 * `rezoomRoomOutline` from fog-reveal.mjs, `whatIsHere`, `checkRegions` and
 * `sceneUncoveredPercent` from fog-diagnostics.mjs; its other exports are its own
 * as they were, every importer still imports fog.mjs, and no new file imports it.
 * What stays here: registration, Foundry's vision standing down, the ledger and
 * its socket, the layer, the dissolve, the raster and the drift, when a reveal
 * plays (`playDiscoveryAnimation`), the moment of discovery, and the reports on
 * the live layer (`diagnoseFog`, `whyBlack`, `fogPeek`, `doorwayReport`), which
 * read its state. New code of those goes here, pure shape math into
 * fog-geometry.mjs, doorway detection or glow into fog-doorways.mjs, the reveal's
 * or the outline's drawing into fog-reveal.mjs, and a check of the map into
 * fog-diagnostics.mjs.
 */

import { MODULE_ID, FLAGS } from "./config.mjs";
import { SETTINGS, iAmTheMastermind, isEclipse, discoveryLedger } from "./settings.mjs";
import { roomOfToken, boundsOf } from "./movement.mjs";
import { isMastermind } from "./mastermind.mjs";
import { isMonokuma } from "./monokuma.mjs";
import { isPrimaryGm, primaryGmId, debug, log, warn, error, plural } from "./utils.mjs";
import { ENTER, reducedMotion, glassOn } from "./motion.mjs";
import { playSfx } from "./sfx.mjs";
import { discoveryStore, fogCopy, fogSectionFor } from "./gm-stores.mjs";
import { newestIn, gmStoresQuiet, whenGmStoresAudible } from "./gm-store.mjs";
import { traceRegionPathsAt, regionShapes, clamp01, distanceToSegment, inPolygons } from "./fog-geometry.mjs";
import {
    MAX_FOG_TEXTURE, colourOf, lastGlow, DOORWAY_PROBE_IN, DOORWAY_PROBE_OUT, DOORWAY_OVERLAP_INSET,
    DOORWAY_WALL_NEAR, wallAlongEdge, nothingInTheWay, neighbourBeyond, doorwayEdges, outlineColour
} from "./fog-doorways.mjs";
import {
    LAYER_NAME, VEIL_ALPHA, REVEAL_SLASH_MS, REVEAL_HOLD_MS, DISCOVERY_MS, freeOwned, clearTransient, watchdog,
    findLayer, FX_GROUP, OUTLINE_NAME, roomOutline, buildRevealLayers, revealBandPlan, destroyRevealLayers,
    revealLinePositions, drawRevealFrame, flashOutline, ensurePixelFont, fadeRoomOutline, seamWidth,
    rezoomRoomOutline, recolourRoomOutline
} from "./fog-reveal.mjs";
import { sceneUncoveredPercent } from "./fog-diagnostics.mjs";
export { seamWidth, rezoomRoomOutline } from "./fog-reveal.mjs";
export { whatIsHere, checkRegions, sceneUncoveredPercent } from "./fog-diagnostics.mjs";

const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;

/**
 * Which build of this file a browser loaded, for `diagnoseFog`. Derived from
 * the manifest rather than typed by hand (MAP-14): the hand-typed stamp was
 * not bumped for three drawing changes, which is the one job it had.
 */
const fogBuild = () => `${game?.modules?.get?.(MODULE_ID)?.version ?? "?"} · glow-field`;

const FOG_SPRITE = "drpgFogSprite";
const RASTER_GROUP = "drpgFogRaster";
const RASTER_MASK = "drpgFogRasterMask";
const BACKDROP_LAYER = "drpgFogBackdrop";

/* --------------------------------------------------------------------------
 * THE RASTER - what stops full fog from reading as flat black.
 *
 * `--drpg-ink` is #1a1620, and at full opacity over a map that is exactly what
 * "black" looks like: the hue is there and nothing lets you see it. The fix is
 * not a lighter colour - an unvisited room has to stay unreadable - it is
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
 * nothing moved relative to anything - and no independent motion either.
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
 * Forge rotates the whole canvas - see fog-reveal.mjs's `bandQuad`.
 * ------------------------------------------------------------------------ */

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
 * cannot alias, it cannot moiré, and the drift is the only motion in it -
 * which is the effect that was wanted in the first place. The fog it decorates
 * is still a place: the silhouette masking this is drawn in scene coordinates
 * and moves with the map, so the texture appears exactly over the fogged
 * ground and nowhere else. The glass is what does not move; what shows through
 * it does.
 */

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
 * fog's own silhouette mask still softens it over veiled rooms - which is the
 * one variation that was ever wanted.
 */
const RASTER_ALPHA = 1;
/**
 * One hairline per tile, halved from two.
 *
 * Fewer lines is also less to alias: the finer a repeating pattern is, the
 * closer its frequency gets to the screen's own, and everything that has gone
 * wrong with this raster has gone wrong at that boundary. Must divide the tile
 * exactly or the repeat becomes visible - 64 and 32 are the options here, and
 * 128 with a doubled tile if this still wants thinning.
 */
const RASTER_LINE_STEP = 64;
/**
 * ONE DOT WIDE - Dawid's call, and it is the right one for a reason worth
 * keeping.
 *
 * A column one pixel wide never covers a whole screen pixel once the tile has
 * drifted by a fraction of one: it splits across two neighbouring columns in
 * shifting proportions, and linear filtering turns those proportions into a
 * continuous pulse of brightness. That is the flicker that survived the mipmap
 * work, the tile-scale pinning and the density cut. A column two pixels wide
 * always has at least one fully covered pixel in the middle; only its edges
 * soften. It is also exactly why the 2x2 specks never flickered while the
 * hairlines always did - the answer was sitting in the same tile the whole
 * time.
 */
const RASTER_LINE_WIDTH = RASTER_DOT_SIZE;

/**
 * Pixels per second across the SCREEN - see `startDrift`, which divides these
 * by the tile scale so the speed does not change with the zoom.
 *
 * One axis each, and that is the whole trick: perpendicular motion is what lets
 * them move independently without ever crossing. Slow on purpose - you should
 * notice it only after resting your eyes on the dark for a moment.
 */
const RASTER_DOT_DRIFT = { x: 0, y: -6 };
const RASTER_LINE_DRIFT = { x: 8, y: 0 };

/**
 * How far the fog is drawn BEYOND the scene's own rectangle, in pixels.
 *
 * Its edge used to sit exactly on the edge of the map, and that is where a
 * thin dark line appeared whenever the camera moved. Not a gap in the fog -
 * the ink reached, and the backdrop under it is the same ink anyway - but a gap
 * in the RASTER. The raster is pinned to the screen while the silhouette that
 * masks it lives in the scene, and one frame of disagreement between the two is
 * enough to leave a hairline of untextured ink right where they meet. Standing
 * still they agree to the pixel, which is why it only ever showed in motion.
 *
 * Chasing that synchronisation frame by frame would be fragile. Moving the seam
 * a couple of hundred pixels off the map costs a slightly larger texture and
 * puts the disagreement somewhere nobody is looking - and, as a second gain,
 * covers the map's own edge, which The Forge's isometric view draws as a pale
 * line of its own.
 */
const FOG_MARGIN = 256;
/**
 * How long the fog takes to cross-fade from one state to the next.
 *
 * The layer is rebuilt whole on every repaint, so without this a room changing
 * from dark to veil SNAPS - one frame black, the next frame half. That reads as
 * a glitch rather than as memory settling in, which is the opposite of what the
 * three states are for. Short enough not to lag behind a token that is already
 * standing somewhere new.
 *
 * Reads the interface's own enter time rather than carrying one, which moves it
 * from 220 to 180 - below anything an eye can separate, and the point is not
 * the forty milliseconds. It is that the switch in motion.css now reaches the
 * canvas: a reader who asks their system for stillness gets a fog layer that
 * settles instantly instead of one that kept crossfading because its duration
 * was written into a script the media query could not touch.
 *
 * A function, not a constant, for exactly that reason - captured once at load
 * it would have been the same unreachable number in a different shape. The 1ms
 * floor is for `CanvasAnimation`, which divides by the duration.
 */
const fadeMs = () => Math.max(ENTER(), 1);

/* ==========================================================================
 * REGISTRATION
 * ========================================================================== */

export function registerFog() {
    // The ledger's socket road and its pull-on-join (D2).
    step("the ledger's road", () => registerLedgerRoad());

    /*
     * EACH STEP GUARDED SEPARATELY, because they used to share one handler and
     * that is how this feature spent two releases not existing at all: the
     * layer-mounting step threw (see `mountLayer`), Foundry logged it and
     * moved on, and `repaintFog()` - the line after it - was simply never
     * reached. A canvas hook that half-runs is indistinguishable on screen
     * from a canvas hook that never fired, so no step is allowed to take the
     * next one down with it.
     */
    // Started here so it is settled long before any room needs naming.
    ensurePixelFont();

    /* The theme's room outline is a seam, and a seam keeps its weight on the display however
       far the map is zoomed - so the one thing that has to follow the zoom is re-struck here.
       `rezoomRoomOutline` is its own guard: it does nothing on a pan, nothing under Legacy,
       and nothing until the zoom has moved by a fifth. */
    Hooks.on("canvasPan", () => { try { rezoomRoomOutline(); } catch (err) { debug("Fog: could not restrike the outline", err); } });

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
        // first room of a session - the one you wake up in - was the one room
        // that never got named.
        step("reveal on arrival", () => revealStartingRooms());
        // WITHOUT THIS THE FIRST STEP REPLAYS THE ARRIVAL. `lastMineSignature`
        // starts empty, so the first move a character makes - even across two
        // feet of the room it woke up in - read as "the set of rooms I occupy
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
    // visibility.mjs) but says nothing about rooms - the fog only needs to
    // catch up once it ends, when ordinary room logic starts mattering again.
    /*
     * BOTH ENDS OF AN ECLIPSE, not just the far one.
     *
     * This used to repaint only when an Eclipse ENDED, which was right while
     * the fog stood aside for the duration and only had to come back afterwards.
     * Since it started veiling instead, the beginning changes the picture too -
     * every room drops to the veil, the one you are standing in included - and
     * nothing was redrawing it. The room a player was in stayed cleared until
     * they happened to walk somewhere.
     */
    Hooks.on("drpgEclipseChanged", () => repaintFog());

    /*
     * THE SEAM COLOUR IS A DOM FACT, SO IT IS WATCHED IN THE DOM.
     *
     * Under Stained Glass the room outline and the doorway glow wear
     * `--drpg-glass-accent`, which the stylesheet derives from `data-drpg-time`,
     * `data-drpg-phase` and the `drpg-eclipse` class on `<body>`. A standing outline
     * has to follow the hour, and nothing else here would make it.
     *
     * NOT `drpgTimeOfDayChanged`, AND THE REASON IS A RACE. That hook is fired from
     * `sync.mjs` in the same fire-and-forget batch as the `renderHud()` that WRITES
     * the attribute the colour is derived from, and `run()` there awaits nothing - so
     * a listener that reads the computed accent off the hook can be handed the hour
     * on its way out. There is no phase hook at all. The ATTRIBUTE CHANGING IS THE
     * COLOUR CHANGING, with nothing in between to get the order wrong. Same filter
     * and the same 60 ms settle as the curtain's own observer; the `class` entry is
     * what catches the Eclipse and the theme itself, so an outline left standing when
     * someone leaves Stained Glass goes back to Bone on its own.
     */
    let accentTimer = 0;
    new MutationObserver(() => {
        clearTimeout(accentTimer);
        accentTimer = setTimeout(() => {
            try { recolourRoomOutline(); }
            catch (err) { debug("Fog: could not recolour the room outline", err); }
        }, 60);
    }).observe(document.body, {
        attributes: true,
        attributeFilter: ["data-drpg-phase", "data-drpg-time", "class"]
    });

    // Every scene with rooms, once a session, on the one GM entitled to write.
    // `canvasReady` still covers the scene in front of the GM; this covers the
    // ones nobody has opened yet, which is where the trap was.
    Hooks.once("ready", () => step("prepare scenes", () => prepareScenes()));

    // Leaving a scene does not tear this layer down - `RenderedCanvasGroup`
    // sets `tearDownChildren = false` - so the texture would otherwise sit on
    // the GPU for a scene nobody is looking at until the next repaint.
    Hooks.on("canvasTearDown", () => {
        try {
            hideLayer();
            dropBackdrop();
            // Outlines and glows belong to the scene being left, and the glow
            // owns a render texture of its own - see `freeOwned`.
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
        // paying for - see the note on `fogOffPatch` for the last one.
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
 * doorways - per sight line, exactly what the room model exists to replace -
 * and no amount of drawing on top could take those wedges away, because they
 * are not fog, they are the lighting of the scene itself.
 *
 * The fix is not another layer. It is to make the region fog the only thing
 * hiding anything:
 *
 *   tokenVision   off   no cones, no per-token sight polygons at all
 *   fog           off   Foundry stops drawing and recording its own
 *                       "explored" mask - `fog.mode` on v14, the deprecated
 *                       `fog.exploration` before it; see `fogOffPatch`, and
 *                       note that getting this field wrong is what made three
 *                       rounds of fixes appear to change nothing
 *   globalLight   on    the map is lit everywhere, so what a player can see
 *                       is decided by our fog and nothing else
 *
 * Walls stop mattering for VISION here, which is the point - a room is the
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
 * vision - and on v14 that is not a cosmetic difference: `Scene#availableLevels`
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

        rows.push(`${ready ? "ok  " : "!!  "}${scene.name} - ${rooms} rooms, `
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
 * in favour of `fog.mode` - so on a v14 world the write landed on a field
 * nothing reads, Foundry's own exploration fog stayed on, and it was
 * Foundry's fog the players were looking at the whole time. The module's own
 * layer was mounted and drawing underneath something that had never been
 * turned off, which is why three rounds of fixing the layer changed nothing
 * on screen: the layer was never the thing being seen.
 *
 * The value is DISCOVERED rather than hard-coded. v14 replaced a boolean with
 * a three-way mode (disabled / individual / shared), and guessing the literal
 * spelling of "disabled" is how this class of bug repeats - so the constant
 * table is searched for the member that means "off", and only if there is no
 * table at all does it fall back to a plain string.
 */
function fogOffPatch(scene) {
    const fog = scene.fog ?? {};

    // v14+: `fog.mode`. Read `mode` FIRST - touching `fog.exploration` on v14
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
 * DATA - who has seen what
 * ========================================================================== */

function allDiscovered() {
    return discoveryLedger();
}

/* ==========================================================================
 * THE LEDGER'S ROAD (D2) - the GM's store, and the rows each player is sent
 * --------------------------------------------------------------------------
 * A GM STORE SINCE E04 (1.2.63; audit S07-01): `discoveryStore` (gm-stores.mjs),
 * a cell per character and room, true or false, each stamped and merged by the
 * newest stamp between the GMs - the union written whole, which only ever grew,
 * is gone, and with it the GM-to-GM message that set another GM's copy whole.
 * A player holds a section of the same cells for their own characters
 * (`fogCopy`), sent by the GM that wrote them and merged cell by cell.
 * ========================================================================== */

const SOCKET_EVENT = `module.${MODULE_ID}`;
const FOG_ROWS = "fog.rows";          // a GM -> one player: the cells of your own characters
const FOG_REQUEST = "fog.request";    // a player -> primary GM: send me mine
const FOG_SHARE_ASK = "fog.shareAsk"; // primary GM -> everyone: what do you hold?
const FOG_SHARED = "fog.shared";      // a player -> primary GM: this is what I hold

const cellKey = (sceneId, actorId) => `${sceneId}/${actorId}`;

/** The rows of `ledger` that belong to characters `user` owns. */
function rowsFor(ledger, user) {
    const out = {};
    for (const [sceneId, forScene] of Object.entries(ledger ?? {})) {
        const kept = {};
        for (const [actorId, rooms] of Object.entries(forScene ?? {})) {
            const actor = game.actors.get(actorId);
            if (actor?.testUserPermission(user, "OWNER")) kept[actorId] = [...(rooms ?? [])];
        }
        if (Object.keys(kept).length) out[sceneId] = kept;
    }
    return out;
}

/**
 * Send a player the cells of their own characters: a section of the GMs' store,
 * with its stamps and its watermark, which their copy merges (`fogCopy`). Addressed
 * twice: by the socket's recipients, and by `userId` inside the packet, so a relay
 * that ignores the first still cannot put one player's rows on another's browser.
 * A GM is sent nothing: the store reaches the GMs itself.
 */
function sendStoreTo(user) {
    if (!user || user.isGM || user.id === game.user.id) return;
    // While tier 2 holds the stores or stands in another world, the cells are a fixture's (R2-M1, M3).
    if (gmStoresQuiet()) return;
    try {
        const section = fogSectionFor(user);
        game.socket.emit(SOCKET_EVENT, { action: FOG_ROWS, userId: user.id, section, stamps: { "": newestIn(section) } },
            { recipients: [user.id] });
    } catch (err) {
        error(`Could not send the fog ledger to ${user.name}`, err);
    }
}

/** Every connected player gets their cells. */
function shareLedger() {
    for (const user of game.users.filter(u => u.active && !u.isGM && u.id !== game.user.id)) sendStoreTo(user);
}

/**
 * AFTER A RESTORE (gm-stores.mjs `restoreCase`; the design's 6.2): every connected
 * player is sent the cells of their own characters again (`sendStoreTo`), which their
 * copy merges cell by cell. Nothing while the suite holds the stores or stands in
 * another world (`gmStoresQuiet`). Answers how many players were sent their cells.
 */
export function retellFog() {
    if (!game.user?.isGM || gmStoresQuiet()) return 0;
    shareLedger();
    return game.users.filter(u => u.active && !u.isGM && u.id !== game.user.id).length;
}

/**
 * THE ONE WRITE, GM-only: cells into the store - `{ "sceneId/actorId": { room: bool } }`
 * - then every connected player their share. The store's own options say how (a
 * seed is weak and fill-only; a GM's tick or untick, and a student walking in, are
 * decisions at a real stamp). Answers whether anything was written.
 */
async function writeCells(cells, opts = {}) {
    if (!game.user.isGM || !Object.keys(cells ?? {}).length) return false;
    await discoveryStore.patchMany(cells, opts);
    shareLedger();
    return true;
}

/**
 * The cells that make one scene's rows read `matrix` (`{ [actorId]: [room, ...] }`):
 * every room in it true, and every room its actor held that is not in it false - an
 * untick, stamped, so a copy that still holds the room cannot bring it back.
 */
function cellsFor(sceneId, matrix, actorIds = Object.keys(matrix ?? {})) {
    const held = allDiscovered()[sceneId] ?? {};
    const cells = {};
    for (const actorId of actorIds) {
        const want = new Set(matrix?.[actorId] ?? []);
        const row = {};
        for (const room of want) if (!(held[actorId] ?? []).includes(room)) row[room] = true;
        for (const room of held[actorId] ?? []) if (!want.has(room)) row[room] = false;
        if (Object.keys(row).length) cells[cellKey(sceneId, actorId)] = row;
    }
    return cells;
}

/**
 * The season reset: every cell gone, everywhere. The primary's clear raises the
 * store's watermark, which reaches every GM and, in the rows sent here, every
 * connected player; the reset's cut in the clock reaches the rest when they load.
 * Another GM (a console - the reset is the primary's since E04 C10) drops the rows
 * it holds.
 */
export async function resetLedger() {
    if (!game.user.isGM) return false;
    if (isPrimaryGm()) await discoveryStore.clear();
    else await discoveryStore.dropMany(Object.keys(discoveryStore.entries()));
    shareLedger();
    return true;
}

/**
 * A world that updated mid-season may still hold its ledger in the world setting,
 * which any console reads (D2 lifted it on every load of the primary until E04). The
 * clause `liftDiscoveryLedger` (migrate.mjs, since 1.2.63) runs this once, on the
 * primary, after the store holds the other GMs' copies - and after
 * `forgetMonokumaWalks`, whose rows are not taken here either (S01-31).
 *
 * NOTHING LEAVES WORLD DATA BEFORE THE STORE HOLDS IT. The rows go in weak and
 * fill-only - a cell any GM decided wins, an untick above all - and the world
 * setting is emptied only once every one of them reads back from storage; then it
 * is read back too. A row that does not read back, or a world copy that does not read
 * back empty, throws with the count, so the world is not stamped and the next load
 * tries again (E05 fix r1-G1; migrate.mjs, above the lifts - since 1.2.64, so that a
 * world 1.2.63 stamped over a ledger it kept runs this once more). Idempotent: a world
 * already through this has nothing in it.
 *
 * @returns {Promise<null|{notPrimary: true}|{lifted: number, monokuma: number, emptied: boolean}>}  `emptied`
 *   true: anything else throws.
 */
export async function liftDiscoveryLedger() {
    if (!isPrimaryGm()) return { notPrimary: true };
    if (await discoveryStore.whenHydrated() === "timedOut") {
        throw new Error("the other GMs' copies of the fog ledger did not arrive; the next load tries again");
    }
    const old = game.settings.get(MODULE_ID, SETTINGS.discoveredRooms) ?? {};
    const cells = {};
    let monokuma = 0;
    for (const [sceneId, forScene] of Object.entries(old)) {
        for (const [actorId, rooms] of Object.entries(forScene ?? {})) {
            const actor = game.actors.get(actorId);
            if (actor && isMonokuma(actor)) { monokuma++; continue; }
            const row = Object.fromEntries((rooms ?? []).filter(r => typeof r === "string" && r).map(room => [room, true]));
            if (Object.keys(row).length) cells[cellKey(sceneId, actorId)] = row;
        }
    }
    if (!Object.keys(cells).length && !Object.keys(old).length) return null;
    if (Object.keys(cells).length) {
        await discoveryStore.patchMany(cells, { weak: true, fillOnly: true });
        await discoveryStore.idle();
        const unheld = Object.entries(cells).filter(([key, row]) => {
            const held = discoveryStore.persisted(key) ?? {};
            return Object.keys(row).some(room => !Object.hasOwn(held, room));
        });
        if (unheld.length) {
            throw new Error(`the fog ledger kept its world copy: ${unheld.length} row(s) did not read back from the GM store; the next load tries again`);
        }
    }
    await game.settings.set(MODULE_ID, SETTINGS.discoveredRooms, {});
    const emptied = !Object.keys(game.settings.get(MODULE_ID, SETTINGS.discoveredRooms) ?? {}).length;
    if (emptied) log(`Lifted the discovery ledger out of world data (D2): ${Object.keys(cells).length} row(s).`);
    shareLedger();
    if (!emptied) throw new Error("the fog ledger's world copy did not read back empty; the next load tries again");
    return { lifted: Object.keys(cells).length, monokuma, emptied };
}

/** What this client holds, for a primary GM rebuilding a lost union. */
function myStore() {
    return allDiscovered();
}

/*
 * AN ANSWER IS TAKEN ONLY WHEN IT WAS ASKED FOR (E03, 24.09.2026; audit S07-17).
 * `fog.shared` is a client's reply to the primary's "what do you hold?", and the
 * primary merged it whenever it came: a player could send one from the console
 * listing every room on the map for their own character, and the fog lifted for
 * them for good - and the GM's record of where the class has been, which is an
 * alibi, said they had been there. A player's reply now counts only in the ten
 * seconds after the primary asked, once per player.
 */
let shareAskedAt = 0;
const shareAnswered = new Set();
const SHARE_WINDOW_MS = 10_000;

/** Why a player's `fog.shared` is not taken, or null. Pure, for the suite. */
export function fogShareRefusal({ sender, askedAt, answered, now = Date.now(), windowMs = SHARE_WINDOW_MS }) {
    if (!sender) return "unknown sender";
    if (sender.isGM) return null;
    if (!askedAt || now - askedAt > windowMs) return "nobody asked";
    if (answered?.has(sender.id)) return "already answered";
    return null;
}

/**
 * The same question with the bridge's one guard signature (see `firstRefusal` in
 * bridge-guards.mjs, E03), asked of the primary's own record of when it asked and who
 * has answered. It only reads them: marking the answer taken is the handler's.
 */
function guardFogShare(sender, payload, ctx) {
    return fogShareRefusal({ sender, askedAt: shareAskedAt, answered: shareAnswered });
}

/**
 * The primary's "what do you hold?" - asked only when its store, with the other GMs'
 * copies in, holds nothing: the rebuild of a lost ledger (E04). Exported for the ledger
 * scenario, which cannot reload a browser to reach the `ready` that asks it.
 */
export function askForShares() {
    shareAskedAt = Date.now();
    shareAnswered.clear();
    game.socket.emit(SOCKET_EVENT, { action: FOG_SHARE_ASK });
}

function registerLedgerRoad() {
    game.socket.on(SOCKET_EVENT, async (payload, senderId) => {
        if (!payload?.action?.startsWith?.("fog.")) return;
        if (senderId === game.user.id) return;
        const sender = game.users.get(senderId);
        if (!sender) return;
        try {
            switch (payload.action) {
                case FOG_ROWS:
                    // My characters' cells, from a GM, addressed to me - merged into my
                    // copy cell by cell (`fogCopy`), which keeps only my own characters'.
                    if (!sender.isGM || game.user.isGM || payload.userId !== game.user.id) return;
                    await fogCopy.receive(ownSection(payload.section), payload.stamps);
                    return;
                case FOG_REQUEST:
                    if (!isPrimaryGm()) return;
                    // Asked while tier 2 holds the stores: answered once it lets them go, from this world's cells.
                    await whenGmStoresAudible();
                    await discoveryStore.whenHydrated();
                    sendStoreTo(sender);
                    return;
                case FOG_SHARE_ASK:
                    if (sender.id !== primaryGmId() || game.user.isGM) return;
                    game.socket.emit(SOCKET_EVENT, { action: FOG_SHARED, store: myStore() }, { recipients: [senderId] });
                    return;
                case FOG_SHARED: {
                    if (!isPrimaryGm() || sender.isGM) return;
                    const why = guardFogShare(sender, payload, { asker: senderId, requestId: payload.requestId ?? null });
                    if (why) {
                        debug(`Ignored a fog ledger reply from ${sender.name}: ${why}.`);
                        return;
                    }
                    shareAnswered.add(sender.id);
                    // A player's rows are taken only for the characters they own, so nobody
                    // can write another character's history into the GMs' record - and weak
                    // and fill-only (E04): what a GM decided, an untick above all, stands.
                    const cells = {};
                    for (const [sceneId, forScene] of Object.entries(rowsFor(payload.store ?? {}, sender))) {
                        for (const [actorId, rooms] of Object.entries(forScene)) {
                            cells[cellKey(sceneId, actorId)] = Object.fromEntries(rooms.map(room => [room, true]));
                        }
                    }
                    await writeCells(cells, { weak: true, fillOnly: true });
                    return;
                }
                default:
                    return;
            }
        } catch (err) {
            error("Could not handle a fog ledger message", err);
        }
    });

    /* THE PULL, AND THE PUSH BEHIND IT. A player asks the primary for its cells when
       it loads, having first taken in the rows its browser held before E04 (weak: they
       add what no GM said, never over what one did), and again when a primary GM's
       world has loaded (the bridge's "a GM is listening" signal, `drpgPrimaryReady`).
       The primary, once its store holds the other GMs' copies, rebuilds the ledger
       from the players only when it holds nothing at all, and otherwise sends every
       player their cells. Until E04's fix round a push on `userConnected` was called
       the backstop for a request that was lost; it reached a player's browser before
       its listener existed (the measurement gm-bridge.mjs records), so it is gone,
       and the ask on the primary's arrival is that backstop (the round-2 review's
       m4). The lift of the old world setting is a migration clause
       (`liftDiscoveryLedger`, migrate.mjs), no longer this hook's. */
    const askForCells = (primary = primaryGmId()) => {
        if (!primary) return;
        try { game.socket.emit(SOCKET_EVENT, { action: FOG_REQUEST }, { recipients: [primary] }); }
        catch (err) { error("Could not ask for the fog ledger", err); }
    };
    Hooks.once("ready", () => {
        if (!game.user.isGM) {
            step("take in this browser's old fog rows", () => fogCopy.claim());
            askForCells();
            Hooks.on("drpgPrimaryReady", askForCells);
            return;
        }
        step("share or rebuild the ledger", () => discoveryStore.whenHydrated().then(() => {
            if (!isPrimaryGm()) return;
            if (!Object.keys(discoveryStore.entries()).length) askForShares();
            else shareLedger();
        }));
    });
}

/** The rows of a section a GM sent that are this user's own characters' (and the watermark). */
function ownSection(section) {
    if (!section || typeof section !== "object") return section;
    const mine = key => Boolean(game.actors.get(String(key).split("/")[1] ?? "")?.isOwner);
    const pickOwn = part => Object.fromEntries(Object.entries(section[part] ?? {}).filter(([key]) => mine(key)));
    return { e: pickOwn("e"), t: pickOwn("t"), d: pickOwn("d"), cleared: section.cleared ?? 0 };
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
 * Apply the Fog tab's edits to one scene's ledger - only the cells the GM
 * changed, laid onto the ledger as it stands when Apply is pressed.
 *
 * IT USED TO WRITE THE WHOLE MATRIX BACK (ROOM-01, 17.09). The checkboxes are
 * drawn when Room Setup opens and never refreshed, while `recordDiscovery`
 * goes on adding every room a student walks into - and the window is open
 * during Daily Life because a GM is watching that happen. Every Apply, from
 * any tab and with the Fog tab untouched, put the open-time snapshot back:
 * rooms found in the meantime fogged over again on every client.
 *
 * @param {{actorId: string, room: string, value: boolean}[]} changes
 * @returns {Promise<boolean>}  Whether anything was written.
 */
export async function applyDiscoveryChanges(scene, changes = []) {
    if (!game.user.isGM || !scene || !changes.length) return false;
    const forScene = allDiscovered()[scene.id] ?? {};
    const cells = {};
    for (const { actorId, room, value } of changes) {
        if ((forScene[actorId] ?? []).includes(room) === Boolean(value)) continue;
        // A cell each, stamped: an untick is `false`, which a copy still holding the room cannot undo (E04).
        (cells[cellKey(scene.id, actorId)] ??= {})[room] = Boolean(value);
    }
    // Nothing moved is nothing written: a write here sends every client its
    // share of the ledger again and repaints the fog, and Apply is pressed far
    // more often for a lock than for the fog.
    return writeCells(cells);
}

/**
 * Overwrite one scene's whole discovery matrix in one write.
 *
 * Room Setup no longer calls this - its Apply lays only the changed cells onto
 * the ledger through `applyDiscoveryChanges` (ROOM-01). It stays for the
 * suite's fixtures, which blank a scene's rows for a test and then put back
 * exactly the rows they read before it.
 *
 * @param {object} matrix  `{ [actorId]: [roomName, ...] }`
 */
export async function saveDiscoveryMatrix(scene, matrix) {
    if (!game.user.isGM || !scene) return;
    const actorIds = new Set([...Object.keys(allDiscovered()[scene.id] ?? {}), ...Object.keys(matrix ?? {})]);
    await writeCells(cellsFor(scene.id, matrix, [...actorIds]));
}

/**
 * Record that a character has now seen a room, if they had not already.
 *
 * GM-only, and only the PRIMARY one writes - `updateToken` fires on every
 * client, so there is no need for a player-to-GM bridge the way Search
 * tokens or the answer key need one; whichever GM's client Foundry has
 * elected primary just reacts to the same hook everybody else's does.
 */
async function recordDiscovery(scene, actor, room) {
    if (!isPrimaryGm() || !scene || !actor || !room) return false;

    /* THE MASTERMIND LEAVES NO TRACK IN THE LEDGER (Dawid, 26.08).
       -----------------------------------------------------------------------
       The GM's own veil is `ledgerRooms` - the union of every actor's row -
       so recording the Mastermind's walks would lift the veil on rooms only
       they have been to, and the GM's map would quietly narrate the season's
       secret moving around the building. They lose nothing by the skip: their
       own fog already counts every room as known (`myDiscoveredRooms`),
       because they built the place. `isMastermind` answers on GM clients and
       this only ever runs on the primary GM's. */
    if (isMastermind(actor)) return false;

    /* AND NEITHER DOES A MONOKUMA (Dawid, 28.08).
       -----------------------------------------------------------------------
       A Monokuma is the GM at the table wearing a token. They go everywhere,
       because going everywhere is the job - and every room they crossed was
       being written into the ledger as DISCOVERED, which is the union the GM's
       own veil is built from. So a GM moving their own token across the map
       was uncovering the building for themselves one corridor at a time, and
       the fog stopped meaning "where the cast has been".

       The same argument as the Mastermind's above, and it lands harder: a
       Mastermind at least walks somewhere for a reason of their own. A
       Monokuma's token is furniture that follows the scene.

       They lose nothing by the skip. `myDiscoveredRooms` already counts every
       room as known for a GM, so their map is unchanged; what changes is that
       it stops being changed BY them. */
    if (isMonokuma(actor)) return false;

    if (discoveredFor(scene.id, actor.id).includes(room)) return false;

    // A decision at a real stamp (E04): walking in again finds a room a GM unticked.
    await writeCells({ [cellKey(scene.id, actor.id)]: { [room]: true } });
    debug(`${actor.name} discovered "${room}" on ${scene.name}.`);
    return true;
}

/** One deferred seed at a time - see the readiness guard in `seedDiscovery`. */
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
    // written before the game is ready - so the write threw, `step()` dutifully
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

    const forScene = allDiscovered()[scene.id] ?? {};
    const cells = {};

    for (const tokenDoc of scene.tokens ?? []) {
        const actor = tokenDoc.actor;
        if (!actor || actor.type !== "character") continue;
        // Same skips as `recordDiscovery`, for the same reasons: the seed is
        // just discovery for somebody who was already standing there, so a
        // token that must not record a walk must not record a stand either.
        // Without the second of these, a Monokuma parked in a room since
        // before the session would be seeded into the ledger on the next
        // `canvasReady` and the skip above would never get to matter.
        if (isMastermind(actor)) continue;
        if (isMonokuma(actor)) continue;

        const room = roomOfToken(tokenDoc);
        if (!room) continue;

        if ((forScene[actor.id] ?? []).includes(room)) continue;
        (cells[cellKey(scene.id, actor.id)] ??= {})[room] = true;
    }

    if (!Object.keys(cells).length) return false;

    /* Weak and fill-only (E04): standing in a room is not a decision. A cell a GM
       unticked stays unticked, here and when this seed meets that GM's copy - at a
       real stamp it would have won over the untick in the merge. */
    await writeCells(cells, { weak: true, fillOnly: true });
    debug(`Seeded the fog ledger with the rooms characters were already standing in on ${scene.name}.`);
    return true;
}

/**
 * THE VIEWER'S OWN COPY OF WHAT THEY HAVE SEEN - latency smoothing, not a
 * second source of truth.
 *
 * The ledger is the GM's and stays the GM's: that is the decision, and nothing
 * here writes to it. But the GM's write has to reach this client through
 * `settings.set` → `onChange` → `applyFor` → `SYNC.fog`, and `sync.mjs` adds a
 * 120ms coalescing window on top of the network. The player, meanwhile,
 * repaints the instant their own token lands. So for a fraction of a second the
 * room they have just walked OUT of is neither current nor yet in the ledger,
 * and it flashes full black before settling into the veil - a room going dark
 * behind you looks like the fog malfunctioning, not like memory.
 *
 * This set closes that window and nothing else. It lives in the page, dies on
 * reload, and every room in it will be in the ledger by then anyway. If a GM
 * never connects, it means a player sees their own history for this session
 * only - which is the accepted cost of "discovery requires a GM".
 *
 * Keys are JSON triples rather than a joined string. Room names are free text,
 * so any separator character is one a GM is allowed to type into a room name -
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
 * for - smoothing the round-trip on a discovery this client made itself. But
 * the ledger can also SHRINK: the season reset wipes it, and the Fog tab's
 * "hide all" empties it per scene. Measured on two clients (2026-08-26): after
 * such a shrink the data was gone everywhere, yet every room this client had
 * walked through in the session stayed revealed until a reload, because
 * `myDiscoveredRooms` kept unioning the stale mirror in. A reset that only
 * takes effect after everyone relogs looks like a reset that did not work.
 *
 * So when the ledger arrives changed, mirror entries it no longer vouches for
 * are dropped, and what my tokens stand in right now is put straight back -
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
 * Mark every room on a scene discovered, or forget them all, for one actor -
 * or for everyone at once when `actorId` is omitted. Written at once; Room
 * Setup's Discover all / Hide all no longer call it, they tick the Fog tab's
 * boxes and wait for Apply like everything else in that window (ROOM-03).
 */
export async function setDiscovery(scene, { actorId = null, rooms = [], value } = {}) {
    if (!game.user.isGM || !scene) return;

    const forScene = allDiscovered()[scene.id] ?? {};
    const actorIds = actorId ? [actorId] : Object.keys(forScene).length
        ? Array.from(new Set([...Object.keys(forScene), ...(await studentActorIds())]))
        : await studentActorIds();

    const matrix = Object.fromEntries(actorIds.map(id => [id, value ? Array.from(new Set(rooms)) : []]));
    await writeCells(cellsFor(scene.id, matrix, actorIds));
}

async function studentActorIds() {
    const { studentActors } = await import("./monokuma.mjs");
    return studentActors().map(a => a.id);
}

/**
 * Every room this VIEWER's own characters currently know about on this
 * scene - the "visited" half of the three states.
 *
 * The Mastermind's exception lives here and nowhere else: every named room
 * on the scene counts, because they drew the building. This never changes
 * which room is CURRENT - see `myCurrentRooms` - so it never lets them see
 * who is standing where, only that the room exists and roughly what is in it.
 */
function myDiscoveredRooms(scene) {
    if (!scene) return new Set();

    // The Mastermind drew the building: every room on the map counts as known
    // to them. This never says who is standing in one - that is
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
 * the entire scene - the fog would exist and show nothing. For them it is the
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
 * THE LAYER - fog everything, then erase what you are allowed to see.
 * --------------------------------------------------------------------------
 * THE SHAPE OF THIS CODE IS THE ANSWER TO A BUG THAT BLACKED OUT WHOLE MAPS.
 *
 * The version before this one filled the fogged rooms shape by shape, and then
 * expressed the remaining state - the parts of the map belonging to no Region,
 * which the design wants under permanent fog - as one full-scene rectangle with
 * a `beginHole()` cut for every room. PIXI triangulates a hole block with
 * earcut, and earcut BREAKS ON HOLES THAT TOUCH EACH OTHER. A floor plan whose
 * rooms share walls - eighteen of them on the scene where this was found - cuts
 * no holes at all, throws nothing, and leaves a solid black rectangle over the
 * map, the tokens and the player's own character. Confirmed on a live world on
 * 2026-08-22: hiding that single Graphics brought the whole map straight back,
 * while the same regions drawn as plain fills painted seventeen out of
 * seventeen correctly. It was never the geometry. It was the subtraction.
 *
 * So the model is inverted, and subtraction is done the way Foundry does its
 * own - `PIXI.BLEND_MODES.ERASE` into a render texture, exactly as
 * `CanvasVisibility` builds its vision mask:
 *
 *   1. the whole padded scene rect goes under full fog, margin included;
 *   2. rooms this player has VISITED erase half of it, leaving the veil;
 *   3. rooms this player is STANDING IN erase all of it.
 *
 * Everything the design wants falls out of that without a single subtraction
 * primitive: unvisited rooms are simply never erased, and neither is the space
 * between rooms. Rooms may touch, overlap or nest and none of it matters -
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
 * were actually cleared - see the guards there, each of which names itself in
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
 * textures and runs an `ENTER()`-long dissolve between two identical states, and that is
 * a window in which nothing can change but anything can flicker. It also
 * happens constantly - a GM clears every room, so moving their Monokuma from
 * one to another changes where they ARE without changing one pixel of what is
 * covered.
 */
let lastPaintSignature = "";
/** The "can any region be read as a polygon" answer, per scene and region count (MAP-13). */
let readableCache = { sceneId: null, count: -1, readable: 0 };

/**
 * The ledger as this GM last saw it, so growth in it can be noticed - keyed by
 * scene, because the rooms of one scene compared against the rooms of another
 * are all "new", and the first paint after a scene switch played the
 * five-second discovery curtain for a room found weeks ago.
 */
let lastLedgerSeen = null;

/** Bumped by every dissolve; anything from an older one stands down. */
let dissolveGeneration = 0;

/*
 * REPAINTS DO NOT INTERRUPT A DISSOLVE; THEY QUEUE BEHIND IT.
 *
 * They arrive in pairs on purpose - the move settles, and the GM's write comes
 * back through `SYNC.fog` about 120ms later - so a second repaint always landed
 * inside the first dissolve's window (the interface's own enter time, 180ms).
 * Chaining them meant the second read
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
 * Remove a fog sprite and free both textures it was carrying - unless the
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

/*
 * `reducedMotion` comes from motion.mjs: it reads the module's own "Reduced
 * motion" switch as well as the OS setting. A local copy here read only the
 * OS, so the discovery curtain, the drift and the dissolve kept playing for a
 * player who had asked the Look window for stillness.
 */

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
 * Take down reveals in progress and LEAVE THE OUTLINES ALONE.
 *
 * A reveal starting has to clear any reveal still running - walking briskly
 * through three new rooms used to stack three room-sized overlays - but an
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
 * Put a freshly built fog texture on the layer, fading out whatever was there.
 *
 * Both sprites are drawn at once mid-fade, so the picture in between is not a
 * mathematical interpolation of the two states - it is one fog over another.
 * That is fine and in places better: a room going from dark to veil passes
 * through slightly darker than the halfway point, which reads as the fog
 * settling rather than as a dissolve. What matters is that nothing jumps.
 */
/*
 * A TRUE PER-PIXEL DISSOLVE, NOT TWO SPRITES AT PARTIAL ALPHA.
 *
 * The obvious cross-fade - old to zero, new from zero - DIPS. Two layers
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
 * Repaints arrive in bursts - the move settles, then the GM's write comes
 * back through `SYNC.fog` a moment later - so two dissolves could overlap.
 * Each held its own idea of which sprites were "the old ones", and whichever
 * finished first destroyed the other's textures out from under it, leaving a
 * full-screen sprite pointing at freed GPU memory. That is a black
 * rectangle over the map with no error attached to it.
 *
 * A generation counter settles it: starting a dissolve invalidates every
 * one before it, and a stale tick or clean-up does nothing at all.
 */
function startDissolve(container, { sprite, previous, previousTexture, texture, maskTexture, rect, renderer, finish }) {
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
        // whatever was in that GPU memory - commonly opaque black - and the
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
        // mask, and a fifth of a second of the incoming shape is invisible on it.
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
    // rebuilt - that is what keeps its drift from snapping back to zero every
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

    startDissolve(container, { sprite, previous, previousTexture, texture, maskTexture, rect, renderer, finish });
}

/**
 * Find or create the fog container, above the world and below the interface.
 *
 * WHERE THIS MOUNTS WAS WRONG IN TWO DIFFERENT WAYS, and both are worth keeping
 * written down because both were silent.
 *
 * It first resolved its position with `canvas.stage.getChildIndex(canvas.interface)`.
 * PIXI's `getChildIndex` THROWS when the object is not a child of the caller -
 * it does not return -1 - so the call threw inside the `canvasReady` handler
 * before `repaintFog()` was ever reached, and the layer was never mounted at all.
 *
 * The fix for that swapped in `canvas.stage.children.indexOf(canvas.controls)`,
 * which answers "not here" instead of throwing - and then always answers "not
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
 * at 0 to match its siblings - the group sets `sortableChildren`, and PIXI's
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
        build: fogBuild(),
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
        // What the last doorway glow was actually built from - the numbers
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

    /*
     * PRINTED FLAT AS WELL AS FOLDED, and this is the third time it has cost a
     * round trip: a console shows an object collapsed, so `lastGlow.each` - the
     * one array that says WHICH opening looks wrong - arrives as
     * `Array(5) [ {…}, {…} ]` and the answer is still a click away from
     * whoever needed it. The lines below carry the numbers themselves.
     */
    const lines = [`${MODULE_ID} | fog diagnosis - ${report.scene}, grid ${canvas?.grid?.size}`];
    if (report.lastGlow) {
        const g = report.lastGlow;
        lines.push(`  glow: ${g.openings} opening(s), core ${g.core}px, `
            + `full depth ${g.span}px, reach ${g.reachFromAveragedLine}px, amplitude ${g.amplitude}px`);
        for (const [i, one] of (g.each ?? []).entries()) {
            lines.push(`    #${i + 1}  ${one.length}px long (${one.inSquares} squares), `
                + `glow ${one.span}px deep, starts at ${one.at.x},${one.at.y}`
                + `${one.span < g.span ? "  <- shortened to fit its own doorway" : ""}`);
        }
    }
    lines.push(`  rooms I am in: ${(report.currentRooms ?? []).join(", ") || "none"}`);
    console.log(lines.join("\n"));

    console.log(`${MODULE_ID} | fog diagnosis`, report);
    return report;
}

/**
 * Why each stretch of the current room's border is open or closed.
 *
 * The two tests behind a doorway - is there a room over there, and is there
 * anything in the way - fail in opposite-looking ways, and from the map you
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

        // The three gates, each shown separately - the whole point of this
        // report is that "open" and "closed" fail in opposite-looking ways and
        // the map cannot tell you which test decided.
        const inX = mx - edge.nx * grid * DOORWAY_OVERLAP_INSET;
        const inY = my - edge.ny * grid * DOORWAY_OVERLAP_INSET;
        const overlapping = others.find(o => inPolygons(o.polys, inX, inY));

        rows.push({
            edge: `${Math.round(edge.ax)},${Math.round(edge.ay)} → ${Math.round(edge.ax + edge.dx)},${Math.round(edge.ay + edge.dy)}`,
            length: Math.round(edge.length),
            neighbour: found?.name ?? "-",
            insideOf: overlapping?.name ?? "-",
            wallAlong: wallAlongEdge(mx, my, edge.dx / edge.length, edge.dy / edge.length,
                Array.from(scene.walls ?? []), grid * DOORWAY_WALL_NEAR, edge.trend),
            clear: target
                ? nothingInTheWay({ x: mx - edge.nx * back, y: my - edge.ny * back },
                                  { x: mx + edge.nx * reach, y: my + edge.ny * reach })
                : "n/a",
            neighbourAt: target ? Math.round(Math.hypot(target.x - mx, target.y - my)) : "-",
            openRuns: edge.open.length,
            // HOW MUCH of this edge reads as a way out, in grid squares - the
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
                return Number.isFinite(best) ? Math.round(best / grid * 100) / 100 : "-";
            })()
        });
    }

    console.log(`${MODULE_ID} | doorways in "${room}" - ${scene.walls?.size ?? 0} walls on this scene`);
    console.table(rows);
    return rows;
}

/**
 * Take BOTH of this module's fog layers off the screen for a moment.
 *
 * The question it answers is "is that thing on screen even ours" - and it
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
    console.log(`${MODULE_ID} | fogPeek: ${layers.length} layer(s) hidden for ${seconds}s - `
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
 * "what is actually in front of the map right now" - every sprite, its size,
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
        build: fogBuild(),
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
 * per minute at most, never a handful of times per second. That is why it
 * hangs off `updateToken`, `createToken` and `deleteToken` rather than the
 * per-frame `refreshToken`: a rebuild per frame would be a rebuild per
 * animation step of every token on the scene.
 */
/*
 * THE ECLIPSE DIMS EVERYTHING AND CLEARS NOTHING.
 *
 * This used to make the fog step aside entirely, on the reasoning that
 * `visibility.mjs` already hides every token - which left the whole map
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
 * `mine` is WHERE I AM - it drives the outline and the room name, and
 * for a GM that is wherever their Monokuma stands. `current` is WHAT IS
 * CLEARED, and a GM clears every room on the map: they are running the
 * scene and need to see all of it, tokens included. The fog is there
 * for them only so that the space belonging to no room reads the same
 * on their screen as on everybody else's, which is the whole of what
 * this was ever meant to give them.
 */
function fogSets(scene) {
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
     * announce it - the signal is the ledger growing, which reaches this
     * client through `SYNC.fog` like any other world change. The first
     * paint of a session seeds the comparison silently, or logging in would
     * replay every discovery the season has ever made.
     */
    let opened = [];
    if (game.user.isGM) {
        if (lastLedgerSeen?.sceneId === scene.id) {
            opened = Array.from(current).filter(room => !lastLedgerSeen.rooms.has(room));
        }
        lastLedgerSeen = { sceneId: scene.id, rooms: new Set(current) };
    }
    // The room you are standing in is VEILED during an Eclipse, not left
    // under full fog: nothing is cleared, but you can still see the floor
    // you are on. Adding it to the known set is all that takes, since a
    // known room that is not current is exactly what the veil is for.
    if (isEclipse() && !game.user.isGM) for (const room of mine) discovered.add(room);
    return { mine, discovered, current, opened };
}

// Everything that is NOT a fog sprite goes now - leftovers from a
// discovery animation, say. The fog sprites themselves are handed to
// `swapInFog`, which fades the old one out rather than cutting it.
function clearLayerLeftovers(container) {
    for (const child of [...container.children]) {
        if (child.name === FOG_SPRITE) continue;
        if (child.name === RASTER_GROUP || child.name === RASTER_MASK) continue;
        if (child.name === FX_GROUP) continue;
        container.removeChild(child);
        child.destroy({ children: true });
    }
}

export function repaintFog() {
    try {
        if (dissolveBusy) {
            // Redrawn the moment the transition finishes - see `dissolveBusy`.
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
        // as Foundry would - wrong, but visibly wrong, and with a reason
        // `diagnoseFog()` can read out.
        // Not repeated on every `createToken`/`deleteToken` of anything on the
        // map (MAP-13): the pass walks every polygon of every region, and the
        // answer only changes when the scene or its region count does.
        let readable;
        if (readableCache.sceneId === scene.id && readableCache.count === regions.length) {
            readable = readableCache.readable;
        } else {
            readable = regions.filter(r => regionShapes(r, rect).length).length;
            readableCache = { sceneId: scene.id, count: regions.length, readable };
        }
        if (!readable) {
            warn("Fog: no room geometry could be read on this scene, so nothing was fogged. "
                + "The Regions may be drawn in a shape the module cannot measure.");
            return stand("regions exist but none exposed usable polygons");
        }

        const { mine, discovered, current, opened } = fogSets(scene);
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

        // Before the "unchanged" shortcut: a GM's signature does not depend on
        // where their Monokuma stands, so a walk from a room into a corridor
        // left that room's outline, name and glow standing until the next paint.
        if (roomOutline && !mine.has(roomOutline.room)) fadeRoomOutline();

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
        // clearing failed", because both produce a full texture - so it is
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

        clearLayerLeftovers(container);
        swapInFog(container, built.texture, built.maskTexture, rect);
        // The Eclipse's own dimming stands down while this is on - see the
        // ECLIPSE section of danganronpa.css.
        /* `toggle(name, true)`, not `add(name)`: in Chromium `add` queues a MutationRecord
           even when the token is already there, and this runs on every repaint of the fog -
           every step a token takes. Three observers in this module watch the body's `class`,
           one of which repaints every Remnant ring on the canvas, so the fog was waking the
           rings for a class it had already set. Measured and written up at the matching line
           in glass.mjs (`drpg-curtain-on`). */
        document.body.classList.toggle("drpg-fog-active", true);

        // The outline belongs to the room you are IN. Leaving it - for another
        // room, for a corridor, for nowhere at all - ends it. Measured against
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
    lastLedgerSeen = null;
    readableCache = { sceneId: null, count: -1, readable: 0 };
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
 * Returns `null` rather than throwing - the caller has to be able to decide to
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
        // 1. EVERYTHING under full fog - the padded rect, not the background
        //    image, so the margin around the map wears the same colour as the
        //    rooms and the edge of "our" world never shows.
        //
        //    Filled WHITE and tinted afterwards. The same three passes have to
        //    produce two textures: the fog itself, and a white silhouette of it
        //    for the raster to be masked by - see the note above `maskTexture`
        //    below. Tinting a white fill is how one set of geometry serves both.
        /*
         * A GM GETS THE VEIL OUT HERE, NOT THE FULL FOG.
         *
         * Space belonging to no room is a map-drawing mistake and is meant to
         * look like one - that is the rule, and for players it stands. For the
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
        //    the veil so that a room which is somehow both wins as "current" -
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
         * now, and the net turned out to have a cost of its own - a token
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
         * alone - `original *= alphaMul * masky.r` in its sprite-mask shader. The
         * fog was serving as its own mask, and the fog is filled with `--drpg-ink`,
         * whose red channel is 0.10. So the raster was being multiplied by a
         * tenth before it ever reached the screen, and three rounds of raising
         * its opacity moved it almost not at all: the ceiling was never in the
         * tile.
         *
         * The same geometry, tinted white, gives a silhouette whose red channel
         * is 1 where the fog is solid and VEIL_ALPHA where it is a veil - so the
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
             * tile seam, so the GPU picks the smallest mip - a flat averaged
             * blur - for whole bands of the screen, and the drift then sweeps
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
         * LINEAR, NOT NEAREST - and this is a correctness choice, not a taste
         * one. Mipmaps stay off; the block above says why.
         *
         * NEAREST was picked to match the module's pixel-art voice, and at 1:1
         * it does. It falls apart the moment a texel stops lining up with a
         * screen pixel: sampling takes exactly ONE texel, so a one-pixel line
         * either lands on a sample or misses it entirely. That used to show up
         * under minification, as lines that came and went and appeared to have
         * weights none of them has in the tile - and worse, as the tile drifts
         * by a fraction of a pixel per frame the same line hops between sample
         * columns and the eye reads it as movement in the OPPOSITE direction,
         * the wagon-wheel effect exactly as in film.
         *
         * Minification is `startDrift`'s problem now, and it solved it: the
         * tile is pinned to a 1:1 scale with the screen at any zoom, which is
         * why mipmaps could go. What is left for the sampler to do is the drift
         * itself, and that is still sub-pixel. NEAREST would snap each frame's
         * offset to whole texels and the motion would judder; LINEAR carries it
         * smoothly, and on an axis-aligned column at 1:1 it is still crisp, so
         * nothing is lost where the crispness was the point.
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
 * Failure here costs the texture and nothing else - the fog underneath has
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
 * The fog covers `canvas.dimensions.rect` - the scene plus its padding - and
 * stops there, because that is the whole of the world the scene knows about.
 * Pull the camera back far enough and you see past it: the renderer's own clear
 * colour, which `armRendererFailsafe` at least sets to Ink so it is the right
 * shade. The right shade is not enough. A flat field of Ink next to a rastered
 * field of Ink shows exactly where one ends, and that edge is the edge of the
 * map - the one thing the fog exists to stop being obvious.
 *
 * So the texture continues underneath everything. This layer sits at the bottom
 * of `canvas.rendered`, below the scene's own background, so it is covered
 * wherever the map exists and shows wherever it does not. Its raster shares its
 * drift with the fog's - see `startDrift`, which drives both from one offset -
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
 * THE FIRST VERSION UNDID THE CAMERA BY HAND - a scale of `1/zoom` and a
 * position derived from the stage's pivot - and that is correct only while the
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
                this.transform.setFromMatrix((scratchMatrix ??= new PIXI.Matrix()).copyFrom(parent.worldTransform).invert());
            } catch {
                // A degenerate matrix - a zero scale mid-transition, say. Leave
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

/**
 * The ink colour, re-read from the stylesheet at most twice a second rather
 * than on every frame (MAP-07): `getComputedStyle` is a synchronous style
 * read, and the ticker was paying for one per frame for a value that changes
 * with the theme and the time of day - a few times a session.
 */
let inkCache = { at: 0, value: 0x1a1620 };
function inkColour() {
    const now = Date.now();
    if (now - inkCache.at > 500) inkCache = { at: now, value: colourOf("--drpg-ink", 0x1a1620) };
    return inkCache.value;
}

/** One scratch matrix for `pinToScreen`, instead of a clone per frame per group. Made on first use, after PIXI is up. */
let scratchMatrix = null;

/*
 * THE TICKER RUNS EVEN WHEN NOTHING IS DRIFTING.
 *
 * It does two jobs, and only one of them is animation: it advances the pattern,
 * and it holds both rasters still against the screen while the camera moves.
 * Bailing out on `prefers-reduced-motion` used to take the second job with it,
 * which left the raster unpinned and unsized - a viewer who had asked for less
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
        // be identical - accumulated once here rather than per sprite, which
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
         * - and which also took it out of the canvas transform, so on The
         * Forge's isometric view its upright hairlines stayed upright while
         * everything else leaned. The lines are meant to run with the map.
         *
         * Not hard-coded to 45°, because the isometric module applies rotation
         * AND skew: its matrix is [0.392, −0.261, 0.392, 0.261], and a line that
         * is vertical in the scene arrives on screen at about 34°, not 45. So
         * the angle is read off the matrix instead. A vertical line maps to the
         * direction (c, d), and the tile rotation that produces it is
         * `atan2(−c, d)` - which comes out as exactly zero on a canvas nobody
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
                    // renderer's clear colour being what we left it. Redrawn
                    // only when its size or colour changed (MAP-07): a
                    // `clear`/`drawRect` per frame rebuilt and re-uploaded the
                    // geometry sixty times a second for a rectangle that
                    // changes a few times a session.
                    const ink = inkColour();
                    const drawn = sprite.drpgDrawn;
                    if (!drawn || drawn.w !== width || drawn.h !== height || drawn.ink !== ink) {
                        sprite.clear();
                        sprite.beginFill(ink, 1);
                        sprite.drawRect(0, 0, width, height);
                        sprite.endFill();
                        sprite.drpgDrawn = { w: width, h: height, ink };
                    }
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
 * layer's coordinate space. Recorded for `diagnoseFog` alone: the drawing no
 * longer cuts holes for them (the reveal texture covers the viewer's rooms).
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
 * The Sprite is destroyed WITHOUT its texture - `destroy({children: true})`
 * leaves textures alone by design - and the render texture is then released
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
        else {
            // The FX group's doorway glow owns a render texture that only
            // `freeOwned` releases; `destroy` alone leaked one per scene change.
            freeOwned(child);
            child.destroy({ children: true });
        }
    }
    fogTexture = null;
}

function hideLayer() {
    /* `toggle(name, false)`, not `remove(name)`, for the reason `repaintFog` gives at its
       `toggle(name, true)`: `remove` of a class the body does not carry still rewrites
       `class` (DOMTokenList runs its update steps whatever it found - jsdom's code, and the
       spec's). This runs on every repaint the fog stands down from, which is every repaint
       on a scene it cannot draw, so each one woke the three body observers for nothing.
       Found by scenario 14 (27.09.2026): "five identical clock redraws write nothing to the
       body" read one record in 13 of 28 runs across 51e10c7 and c4cedda - a SYNC.fog
       arriving inside its window, `repaintFog` -> `stand` -> here, writing `class` with the
       value it already had. */
    document.body.classList.toggle("drpg-fog-active", false);
    dropBackdrop();
    const container = findLayer();
    if (container) {
        clearLayer(container);
        container.visible = false;
    }
    fogTexture = null;
}

/* ==========================================================================
 * DISCOVERY: THE MOMENT, NOT JUST THE STATE
 * ========================================================================== */

async function onUpdateToken(tokenDoc, changes) {
    if (changes.x === undefined && changes.y === undefined) return;

    // Wait for the token to actually stop. v14 delivers a move as a series of
    // updates along the path, and repainting on each one rebuilt the fog three
    // or four times per step - each rebuild starting its own cross-fade, and
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
            // with it - and that disc is gone, so nothing about the picture
            // depends on where inside a room anybody stands. Repainting anyway
            // was a texture rebuild and a dissolve per step, which is a
            // flickering opportunity bought for nothing.
            //
            // SCOPED, NOT AN EARLY RETURN. It used to `return` out of the whole
            // handler, and on the primary GM's client `isOwner` is true for
            // EVERY token - so a player's move, which never changes which rooms
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
    // gets - see the header note on `recordDiscovery`.
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
        // still gets its outline - that is not an announcement, it is the mark
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
 * Both halves matter now. A room nobody here has seen gets the full reveal -
 * the cut, the pause, the curtain. A room they already know gets the outline
 * and the name and nothing else: enough to say "this is the Dinner Hall"
 * without pretending anything is being discovered.
 *
 * "Already know" is read from the LEDGER first, which is a world setting and
 * therefore survives the session - walk into a room today and next week it is
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
    // Nothing is ever new to a GM - they know every room on the map, so a
    // Monokuma walking into one gets the outline and the name and none of the
    // five seconds of curtain that discovering a room is worth.
    // The Mastermind's rows are never written to the ledger (their walks are
    // nobody's business), so for them "discovered" would read empty in every
    // room and the curtain would play in rooms their own fog already shows.
    const seen = game.user.isGM
        || iAmTheMastermind()
        || discoveredFor(scene.id, actor.id).includes(room)
        || animatedAlready.has(key);
    if (!seen) animatedAlready.add(key);

    return { room, isNew: !seen };
}

/**
 * The outline and the name, without the reveal - what walking back into a room
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

/** The container transient effects live in - never emptied by a repaint. */
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
    const bounds = boundsOf(region);
    const renderer = canvas?.app?.renderer;

    // No measurable shape, no renderer, or a viewer who has asked for no
    // motion: the room is already clear underneath, so just name it.
    if (!bounds || !renderer || motionOff()) {
        flashOutline(fx, region, rect);
        return;
    }

    // Never two reveals over one another: walking briskly through three new
    // rooms used to stack three room-sized overlays, each with its own timing.
    // Outlines are spared - the one being left still has to fade.
    clearReveals();

    const ink = colourOf("--drpg-ink", 0x1a1620);
    /* THE SAME READING `flashOutline` MAKES, AND FOR THE SAME REASON: the setting first,
       the class as the fallback. A reveal can be the first thing a session draws. */
    const glass = glassOn();
    /* The reveal's own lines take the seam colour too, because `flashOutline` runs INSIDE the
       reveal rather than after it - the file's rule for itself here is one gesture in one
       colour rather than three things taking turns. Left at bone these would be white lines
       with an accent-coloured border drawn straight across them for five seconds, which is
       exactly what that rule forbids. Unlike the standing outline this is baked into a render
       texture and destroyed when the reveal ends, so it is deliberately NOT wired into
       `recolourRoomOutline`: it has no handle to recolour and never lives long enough to go
       stale by more than its own run. */
    const bone = outlineColour();
    const grid = canvas.grid?.size ?? 100;

    const width = Math.max(1, Math.ceil(bounds.w));
    const height = Math.max(1, Math.ceil(bounds.h));
    const resolution = Math.min(1, 1024 / Math.max(width, height));

    /*
     * A SEAM UNDER STAINED GLASS, THE 26.08 PIXEL LINE UNDER LEGACY.
     *
     * `grid * 0.07` is a 7 px bar at grid 100 - the pixel-art register the reveal was drawn
     * in, and Legacy keeps it. Under this theme the lines are the same thing the room border
     * and the curtain draw, and they are it exactly: `seamWidth()`, one display pixel, the
     * same call `flashOutline` makes.
     *
     * A TWO-TEXEL FLOOR STOOD HERE AND IT WAS THE BUG (Dawid, 08.09: "wydaja sie za grube").
     * The lines were baked into a render texture, and a texture whose `resolution` drops to
     * 0.25 on a wide room cannot carry a line thinner than four scene units - so the floor
     * was raised to two texels and the line came out at up to five times the border it was
     * quoting, thickest exactly where the room was biggest. The floor is gone because the
     * texture is gone: under this theme the lines are STROKED INTO THE SCENE GRAPH under a
     * mask, like the border, where a hairline is a hairline at any zoom and any room size.
     */
    const lineWidth = glass ? seamWidth() : Math.max(2, grid * 0.07);

    /*
     * THE SPACES BETWEEN THE LINES ARE PANES, AND A PANE ON THE CURTAIN CARRIES A STAIN.
     *
     * One texture per stain colour, because a texture is filled ONCE with one colour and
     * then cut - the file's one reliable way to keep a shape inside the room (see the note
     * on the two textures above). Two of them, because the curtain's palette is two:
     * `STAIN` in glass.mjs, quoted here rather than exported because it lives inside the
     * curtain's own closure. Each is cut to the bands drawn in its colour, so between them
     * they paint every stained band and nothing else.
     */
    const STAIN = [0x5c1238, 0x142a66];
    const stains = glass ? STAIN.map(colour => ({
        colour, scratch: new PIXI.Container(), fill: new PIXI.Graphics(),
        cut: new PIXI.Graphics(), tex: null, sprite: null
    })) : [];

    const L = buildRevealLayers(fx, { region, bounds, rect, glass, ink, bone, lineWidth, width, height, resolution, stains });
    if (!L) {
        flashOutline(fx, region, rect);
        return;
    }
    const { fogScratch, lineScratch, fogTex, lineTex, fogSprite, lineSprite, lineLayer } = L;

    const plan = revealBandPlan(room, { width, height, grid, lineWidth });
    const { lines, seed } = plan;

    /*
     * THE CURTAIN'S PULSE, SHAPE FOR SHAPE.
     *
     * `pulseFrame` in glass.mjs runs every pane on `0.5 - 0.5 * cos(t * omega + phase)` at a
     * period of nine to sixteen seconds - `v` is 0 with the pane lit and 1 with it dark. The
     * three layers here take three periods out of that range and three phases off the room's
     * seed, so the glass breathes against itself instead of blinking as one sheet.
     *
     * SHALLOWER THAN THE CURTAIN'S, deliberately. It darkens black glass towards black; this
     * is a veil over a lit map, and its 0.72 would put the room out for the length of the
     * reveal - the same objection VEIL_ALPHA is already there to answer.
     *
     * IT FOLLOWS THE PULSE SWITCH. A browser that asked the glass to stop breathing did not
     * ask this one thing to carry on; `drpg-no-pulse` is the class settings.mjs writes for it.
     */
    const breathing = glass && !document.body.classList.contains("drpg-no-pulse");
    const phase = (seed % 628) / 100;
    const wave = (ms, period, offset) =>
        0.5 - 0.5 * Math.cos(ms / 1000 * (2 * Math.PI / period) + phase + offset);

    // Phase boundaries as fractions of the whole run.
    const slashEnd = REVEAL_SLASH_MS / DISCOVERY_MS;
    const holdEnd = (REVEAL_SLASH_MS + REVEAL_HOLD_MS) / DISCOVERY_MS;

    // The outline and the name run WITH the lines, not after them: one gesture
    // in one colour rather than three things taking turns.
    flashOutline(fx, region, rect);

    const state = { t: 0 };
    const done = () => destroyRevealLayers(L, stains);

    const animation = CanvasAnimation.animate([{ parent: state, attribute: "t", to: 1 }], {
        duration: DISCOVERY_MS,
        ontick: () => {
            if (!fogSprite || fogSprite.destroyed || !fogTex || fogTex.destroyed) return;
            if (glass) { if (!lineLayer || lineLayer.destroyed) return; }
            else if (!lineSprite || lineSprite.destroyed || !lineTex || lineTex.destroyed) return;

            const t = state.t;
            const frame = revealLinePositions(t, plan, { slashEnd, holdEnd, height });

            drawRevealFrame(L, plan, frame, { glass, bone, lineWidth, stains });

            // The lines bow out over the last third rather than snapping off.
            const fade = clamp01((1 - t) / 0.3);
            if (glass) lineLayer.alpha = fade;
            else lineSprite.alpha = fade;
            if (breathing) {
                const ms = t * DISCOVERY_MS;
                // 13 s for the glass, 9 and 16 for the two stains: the curtain's own range.
                fogSprite.alpha = 0.82 + 0.18 * wave(ms, 13, 0);
                for (let s = 0; s < stains.length; s++) {
                    const sprite = stains[s].sprite;
                    if (!sprite || sprite.destroyed) continue;
                    sprite.alpha = 0.55 + 0.45 * (1 - wave(ms, s ? 16 : 9, s * 2.1));
                }
            }

            renderer.render(fogScratch, { renderTexture: fogTex, clear: true });
            for (const stain of stains) {
                if (stain.tex && !stain.tex.destroyed) {
                    renderer.render(stain.scratch, { renderTexture: stain.tex, clear: true });
                }
            }
            // Under Stained Glass the lines are in the scene graph and need no render pass.
            if (lineTex && !lineTex.destroyed) renderer.render(lineScratch, { renderTexture: lineTex, clear: true });
        }
    });

    // THE BACKSTOP. `done` also runs on a timer, so this overlay cannot survive
    // its own animation going wrong - see `watchdog`.
    watchdog(animation, DISCOVERY_MS + 1500, done);
}
