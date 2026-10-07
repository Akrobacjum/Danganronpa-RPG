/**
 * Danganronpa RPG - the reveal and the room's outline: what the fog draws for
 * the moment a room is found, and for as long as you stand in it.
 * ---------------------------------------------------------------------------
 * The reveal's timing (`REVEAL_SLASH_MS`, `REVEAL_HOLD_MS`, `REVEAL_PART_MS`,
 * `DISCOVERY_MS`, `OUTLINE_MS`, `BOUNCE_MS`, `outlineFadeMs`) and its drawing -
 * the lines cutting in, holding and opening like a curtain (`revealBandPlan`,
 * `buildRevealLayers`, `revealLinePositions`, `drawRevealFrame`,
 * `destroyRevealLayers`, `bandQuad`, `VEIL_ALPHA`); the room's outline and its
 * name (`flashOutline`, with `outlineWidths`, `roomLabel`, `seamHalo`,
 * `landOutline`, `fadeLabel` and the pixel font `ensurePixelFont` loads), and
 * what keeps a standing outline right: `fadeRoomOutline`, `seamWidth`,
 * `rezoomRoomOutline`, `recolourRoomOutline`. Three pieces of state, each written
 * only here: `roomOutline`, the outline standing now (set by `flashOutline`,
 * cleared by `fadeRoomOutline` and `clearTransient`, read by fog.mjs's
 * `repaintFog` and `whatIsHere`), `outlineZoom` and `pixelFontReady`. What it
 * does not hold: when a reveal plays (fog.mjs's `playDiscoveryAnimation`, which
 * reads the animations switch) or for which room (`announceRoom`), the layer, the
 * dissolve, the raster, the ledger, the map's checks and the reports (fog.mjs),
 * the doorways and their glow (fog-doorways.mjs), nor the shape math
 * (fog-geometry.mjs).
 *
 * WHERE IT SITS. Moved out of fog.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. `clearTransient` writes
 * `roomOutline`, and no module can assign another module's `let`, so it moved
 * with the outline and brought down what it calls: `findLayer` with `LAYER_NAME`,
 * `FX_GROUP`, `freeOwned` and `watchdog` - which is why fog.mjs's layer finds its
 * own container through this file. The file above it is fog.mjs, which reads
 * twenty-one of its names - exported now for it - and re-exports the two it
 * exported before: `seamWidth` (own-ring.mjs and remnant-ring.mjs import it from
 * fog.mjs) and `rezoomRoomOutline`; the module's API is the one it was. Nothing
 * here imports fog.mjs back (R161 would see the cycle). Below it are movement.mjs
 * (`boundsOf`), utils.mjs, motion.mjs, fog-geometry.mjs and fog-doorways.mjs (the
 * glow and the seam colour the outline is drawn with).
 */

import { boundsOf } from "./movement.mjs";
import { debug, error } from "./utils.mjs";
import { BEAT, glassOn, SEAM_GLOW } from "./motion.mjs";
import { traceRegionPathsAt, regionShapes, clamp01 } from "./fog-geometry.mjs";
import {
    colourOf, GLOW_NAME, doorwayEdges, addDoorwayGlow, traceOutlineGapped, outlineColour
} from "./fog-doorways.mjs";

const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;

export const LAYER_NAME = "drpgFog";

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


/**
 * How much fog stays over a room you have been to but are not standing in.
 *
 * Judged on a live map rather than picked: 0.5 read as "a room with the lights
 * off", which is not the same claim as "somewhere I have been and am not now".
 * 0.6 keeps the layout and the furniture legible while putting the room you ARE
 * in clearly ahead of it. One constant - the raster of stage 4 inherits it,
 * because that layer is masked by this one's own alpha.
 */
export const VEIL_ALPHA = 0.6;

/**
 * The reveal, slowed down on Dawid's call after watching it on a live map.
 * 450ms was quick enough to register as a flicker rather than as a gesture; the
 * outline and the name run alongside it rather than after it, so the whole
 * thing has to breathe for about as long as it takes to look at the room.
 */
/*
 * Slowed two and a half times after watching it land, on Dawid's call. A reveal
 * is the one moment the fog is allowed to be the centre of attention - it says
 * "you have never been here before", and at two seconds flat that read as a
 * transition rather than as an announcement.
 */
export const REVEAL_SLASH_MS = 650;      // the lines cut in
export const REVEAL_HOLD_MS = 2500;      // and stand there
const REVEAL_PART_MS = 2250;      // before opening like a curtain
export const DISCOVERY_MS = REVEAL_SLASH_MS + REVEAL_HOLD_MS + REVEAL_PART_MS;
const OUTLINE_MS = DISCOVERY_MS;

/**
 * Free the render textures a transient overlay built for itself.
 *
 * `destroy({children: true})` takes down display objects and leaves their
 * textures on the GPU, which is right for the shared ones and a leak for the
 * ones an overlay drew for its own use - the doorway glow renders a fresh
 * field every time a room is entered, and walking a corridor is a lot of
 * rooms. Anything that owns a texture says so on itself.
 */
export function freeOwned(display) {
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
export function clearTransient() {
    roomOutline = null;
    const fx = findLayer()?.children?.find(c => c?.name === FX_GROUP);
    if (!fx || fx.destroyed) return;
    for (const child of fx.removeChildren()) {
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
export function watchdog(animation, ms, cleanUp) {
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
 * The fog container, wherever it currently lives.
 *
 * Both parents are searched because `canvas.rendered` is where this mounts now
 * and `canvas.stage` is where earlier builds put it - a container left over
 * from before an update must still be findable, or `hideLayer()` would leave an
 * orphan drawing over the map with nothing able to reach it.
 */
export function findLayer() {
    for (const parent of [canvas?.rendered, canvas?.stage]) {
        const found = parent?.children?.find(c => c?.name === LAYER_NAME);
        if (found && !found.destroyed) return found;
    }
    return null;
}

/* ==========================================================================
 * THE REVEAL - the room opens in diagonal bands.
 * --------------------------------------------------------------------------
 * The iris that used to live here was the wrong gesture: a circle, in a game
 * whose whole graphic language is diagonal cuts. This is made of the same
 * material as the fog it removes - bands at 45 degrees, on the same axis as
 * the raster, sweeping away from the token so the room reads as opening in
 * front of you rather than dissolving around you.
 *
 * TWO THINGS ABOUT THE IMPLEMENTATION ARE DELIBERATE AND BOTH ARE SCARS.
 *
 * It lives in its own container. The old one added its overlay straight to the
 * fog layer, which `repaintFog` empties and DESTROYS - and the write that
 * triggers this animation is also the write that triggers a repaint, roughly
 * 120ms later. So the reveal was killed about a fifth of the way in, every
 * time, and `CanvasAnimation` went on ticking against a destroyed Graphics:
 * "Cannot read properties of null (reading 'clear')" out of `SmoothGraphics`,
 * once a frame, for the rest of the run. `FX_GROUP` is exempt from that
 * clearing, and every `ontick` checks `destroyed` before touching anything.
 *
 * It subtracts with ERASE into a render texture rather than with a mask. A
 * Graphics mask that is also a child of the display list renders twice - once
 * into the stencil, once as white shapes over the map - and a mask that is not
 * a child has no transform to be positioned by. That is the class of choice
 * this file has already lost to twice, so the reveal uses the one subtraction
 * technique the module has proven on a live world: the one the fog runs on.
 * ========================================================================== */

export const FX_GROUP = "drpgFogFx";
export const OUTLINE_NAME = "drpgRoomOutline";
const SEAM_GLOW_NAME = "drpgRoomOutlineGlow";

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
 * divide by, not for the eye - at 1ms the outline is simply gone.
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
export let roomOutline = null;

/**
 * One band of the sweep, as an upright strip.
 *
 * UPRIGHT RATHER THAN DIAGONAL, and the reason is not aesthetic. Dawid runs an
 * isometric module on The Forge, which rotates the whole canvas - so lines
 * drawn at 45 degrees here arrive on his screen axis-aligned, and lines drawn
 * upright here arrive diagonal. The look the design asks for is the one the
 * player sees, so the geometry is expressed in the frame the map is drawn in
 * and left to the projection to turn.
 *
 * A band is now simply the strip between two values of `x`. Four points,
 * convex, no holes - the geometry PIXI is least able to get wrong.
 */
function bandQuad(cA, cB, tMin, tMax) {
    return [cA, tMin, cB, tMin, cB, tMax, cA, tMax];
}

/**
 * Everything the reveal draws with: the fog and its cut, the lines (a texture under
 * Legacy, geometry under a mask under Stained Glass) and one sheet per stain colour,
 * built, placed and added to the layer. Answers null when any of it could not be
 * made, with everything it did make already destroyed.
 */
export function buildRevealLayers(fx, { region, bounds, rect, glass, ink, bone, lineWidth, width, height, resolution, stains }) {
    /*
     * TWO TEXTURES, BOTH THE SIZE OF THE ROOM'S BOUNDING BOX.
     *
     * One carries the fog still covering the room; the other carries the white
     * lines. They are separate because both have to be CLIPPED TO THE ROOM and
     * there is only one reliable way to clip in this file - start from the
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
    /*
     * UNDER STAINED GLASS THE LINES ARE GEOMETRY, NOT A TEXTURE.
     *
     * Legacy keeps the render texture: its line is a 7 px bar and a bar bakes perfectly.
     * A seam does not - see the note on `lineWidth` - so this theme strokes the lines
     * straight into the scene graph and clips them with a MASK of the room's own shape.
     *
     * A mask, in a file whose rule is "start from the room's shape and erase". The rule
     * was written about textures, where erasing is the only clip available; a display
     * object has a real one. And the reason to want it is not tidiness: a stroked line is
     * the only kind that can be one display pixel wide whatever the zoom and whatever the
     * size of the room, which is the whole of what quoting the curtain means here.
     *
     * The light is three strokes under a blur - `flashOutline`'s recipe, unchanged. A
     * single blurred copy of the core stood here first and was invisible: blurring spreads
     * a hairline's own brightness over twelve pixels and leaves nothing to see. The three
     * passes exist to give the bloom something to be made of.
     */
    let lineLayer = null, lineMask = null, lineCore = null, lineHalo = null;

    try {
        const shapes = regionShapes(region, { x: bounds.x, y: bounds.y });

        // VEIL STRENGTH, NOT FULL INK.
        //
        // The reveal re-covers the room it is about to open, and at full ink a
        // large room - Main Hall on the test map runs most of the width of the
        // scene - went completely black for the three seconds of the cut and
        // the pause. With everything around it already fogged, that reads as
        // the whole map going out rather than as a room being opened. At the
        // veil it reads as "there is something here", which is the sentence the
        // gesture is trying to say anyway, and the curtain still delivers the
        // room at full colour.
        /* THE VEIL IS THE CURTAIN'S OWN GLASS UNDER STAINED GLASS, not the sheet's ink.
           `paintGlass` fills a filler pane with #0c0a14 / #0a0810 before anything else goes
           on it; ink is a page colour and reads as paint over a map. Legacy keeps ink to the
           byte. VEIL_ALPHA is unchanged either way - the argument for it (a large room going
           black reads as the map going out, not as a room opening) has nothing to do with
           which theme is on. */
        fogFill.beginFill(glass ? 0x0a0810 : ink, VEIL_ALPHA);
        for (const points of shapes) fogFill.drawPolygon(points);
        fogFill.endFill();
        fogCut.blendMode = PIXI.BLEND_MODES.ERASE;
        fogScratch.addChild(fogFill, fogCut);

        if (!glass) {
            lineFill.beginFill(bone, 1);
            for (const points of shapes) lineFill.drawPolygon(points);
            lineFill.endFill();
            lineCut.blendMode = PIXI.BLEND_MODES.ERASE;
            lineScratch.addChild(lineFill, lineCut);
        }

        for (const stain of stains) {
            /* 0.60 is the curtain's own alpha for a stained pane (`paintGlass`). The band is
               laid over the veil exactly as the curtain lays its stain over black glass. */
            stain.fill.beginFill(stain.colour, 0.6);
            for (const points of shapes) stain.fill.drawPolygon(points);
            stain.fill.endFill();
            stain.cut.blendMode = PIXI.BLEND_MODES.ERASE;
            stain.scratch.addChild(stain.fill, stain.cut);
        }

        fogTex = PIXI.RenderTexture.create({ width, height, resolution });
        if (!glass) lineTex = PIXI.RenderTexture.create({ width, height, resolution });
        for (const stain of stains) stain.tex = PIXI.RenderTexture.create({ width, height, resolution });

        fogSprite = new PIXI.Sprite(fogTex);
        if (lineTex) lineSprite = new PIXI.Sprite(lineTex);
        for (const stain of stains) stain.sprite = new PIXI.Sprite(stain.tex);
        if (glass) {
            lineLayer = new PIXI.Container();
            lineMask = new PIXI.Graphics();
            lineMask.beginFill(0xffffff, 1);
            for (const points of shapes) lineMask.drawPolygon(points);
            lineMask.endFill();
            lineHalo = new PIXI.Graphics();
            lineHalo.blendMode = PIXI.BLEND_MODES?.ADD ?? 1;
            /* The room border's own bloom, to the number: a blur six times the core, in
               screen pixels, so the light weighs the same at any zoom. */
            const Blur = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
            if (Blur) {
                const filter = new Blur(Math.max(6, lineWidth * 6), 3);
                filter.padding = Math.max(14, lineWidth * 14);
                lineHalo.filters = [filter];
            }
            lineCore = new PIXI.Graphics();
            /* The mask is a CHILD of what it masks: PIXI only honours a mask that is in the
               scene graph, and this way it moves and dies with the layer. */
            lineLayer.addChild(lineMask, lineHalo, lineCore);
            lineLayer.mask = lineMask;
        }
        for (const node of [fogSprite, lineSprite, lineLayer, ...stains.map(s => s.sprite)]) {
            if (node) node.position.set(bounds.x - rect.x, bounds.y - rect.y);
        }
        /* Order is the curtain's: glass, then the colour in it, then the seam and its light
           on top - the one thing that must stay a hard edge. */
        fx.addChild(fogSprite, ...stains.map(s => s.sprite));
        fx.addChild(lineLayer ?? lineSprite);
        return { fogScratch, fogFill, fogCut, lineScratch, lineFill, lineCut, fogTex, lineTex,
                 fogSprite, lineSprite, lineLayer, lineMask, lineCore, lineHalo };
    } catch (err) {
        debug("Fog: could not set up the reveal", err);
        fogScratch.destroy({ children: true });
        lineScratch.destroy({ children: true });
        for (const stain of stains) stain.scratch.destroy({ children: true });
        for (const texture of [fogTex, lineTex, ...stains.map(s => s.tex)]) if (texture && !texture.destroyed) texture.destroy(true);
        for (const sprite of [fogSprite, lineSprite, ...stains.map(s => s.sprite)]) if (sprite && !sprite.destroyed) sprite.destroy();
        if (lineLayer && !lineLayer.destroyed) lineLayer.destroy({ children: true });
        return null;
    }
}

/** Where the lines stand at rest, in pairs about the middle, and which band between them carries which stain. */
export function revealBandPlan(room, { width, height, grid, lineWidth }) {
    // Everything below is in the textures' own space. Every point on a
    // 45-degree line shares `x + y`, so one number places a line.
    // `c` is simply x now: a band is a vertical strip. See `bandQuad`.
    const cMax = width;
    const cMid = cMax / 2;
    const cLow = -cMax;
    const cHigh = cMax * 2;
    /*
     * THE LINES ARE PAIRED ABOUT THE MIDDLE, AND THAT IS THE WHOLE TRICK.
     *
     * Spread evenly from one end, the innermost line landed anywhere up to half
     * a spacing off centre - so the instant the curtain began, the fog between
     * the middle and that line was erased in ONE FRAME. A black strip a whole
     * line-spacing wide simply vanished, and it was the most visible thing in
     * the animation: you did not see a curtain open, you saw a bar disappear
     * and a curtain start afterwards.
     *
     * Placed in pairs at cMid ± (lineWidth/2 + k·pitch), the two innermost
     * lines meet edge to edge exactly on the seam. The opening starts as the
     * hairline between them - geometrically it is `lineWidth` wide at q = 0,
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

    /*
     * WHICH BANDS ARE STAINED, AND IN WHICH COLOUR - settled before anything moves.
     *
     * A band keeps its colour for the whole reveal. The lines slide apart and never cross,
     * so band `i` is always the gap between line `i-1` and line `i`; deciding the colour per
     * frame would make the room flicker through the palette instead of opening.
     *
     * ONE BAND IN THREE, where the curtain stains about one filler pane in five
     * (`hsh > 0.72` in `paintGlass`). There are seven to twenty-seven bands here against a
     * hundred-odd panes there, and at one in five a small room drew none at all - a rule
     * that silently does nothing on half the rooms is not the rule the curtain follows.
     * Seeded from the room's name, so a room breathes the same colours every time.
     */
    const seed = [...room].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 100000, 7);
    const bandStain = new Array(lines + 1);
    for (let i = 0; i <= lines; i++) {
        const x = Math.sin((i + 1) * 12.9898 + seed) * 43758.5453;
        const h = x - Math.floor(x);
        bandStain[i] = h > 0.66 ? (h > 0.83 ? 1 : 0) : -1;
    }
    return { cMax, cMid, cLow, cHigh, perSide, pitch, rest, lines, tMin, tMax, seed, bandStain };
}

/** Take the reveal down: scratch containers, the line layer, then sprites, then textures. */
export function destroyRevealLayers(L, stains) {
    const { fogScratch, lineScratch, lineLayer, fogSprite, lineSprite, fogTex, lineTex } = L;
    fogScratch.destroy({ children: true });
    lineScratch.destroy({ children: true });
    for (const stain of stains) stain.scratch.destroy({ children: true });
    if (lineLayer && !lineLayer.destroyed) lineLayer.destroy({ children: true });
    /* Sprites first, textures after: a texture freed while a sprite still holds it is a
       sprite drawing from nothing. */
    for (const sprite of [fogSprite, lineSprite, ...stains.map(s => s.sprite)]) {
        if (sprite && !sprite.destroyed) sprite.destroy();
    }
    for (const texture of [fogTex, lineTex, ...stains.map(s => s.tex)]) {
        if (texture && !texture.destroyed) texture.destroy(true);
    }
}

/** Where every line is on this frame, how much of it is drawn, and how far the curtain has opened. */
export function revealLinePositions(t, plan, { slashEnd, holdEnd, height }) {
    const { rest, lines, tMin, tMax, cMid, pitch } = plan;
    let opening = 0;                    // half-width of the opened band
    const at = new Array(lines);
    // The stretch of each line that is currently drawn. `tMin` is the
    // top of the drawn area and `tMax` the bottom, so a line running
    // from one to the other is at full height.
    const top = new Array(lines).fill(tMin);
    const bottom = new Array(lines).fill(tMax);

    if (t < slashEnd) {
        /*
         * THE CUT - UP FROM THE FLOOR, not in from the side.
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
            // end hidden and only its tip to show for itself - and a
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
         * they all arrive there together - so a line that starts near
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
         * the instant the pause ended - no gathering, no release. This
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
    return { at, top, bottom, opening };
}

/** Draw one frame: the fog minus the opening, the lines, and the stained bands between them. */
export function drawRevealFrame(L, plan, { at, top, bottom, opening }, { glass, bone, lineWidth, stains }) {
    const { fogCut, lineCore, lineHalo, lineCut } = L;
    const { lines, tMin, tMax, cMid, cLow, cHigh, bandStain } = plan;
    /* The curtain's three glow passes, quoted from `flashOutline`: widths as multiples of
       the core, and the alphas that go with them. */
    const GLOW = SEAM_GLOW;
    // The fog, minus whatever the curtain has opened.
    fogCut.clear();
    if (opening > 0) {
        fogCut.beginFill(0xffffff, 1);
        fogCut.drawPolygon(bandQuad(cMid - opening, cMid + opening, tMin, tMax));
        fogCut.endFill();
    }

    const sorted = at.slice().sort((a, b) => a - b);

    if (glass) {
        /*
         * STROKED, AND AT THE SEAM'S OWN WIDTH READ FRESH EACH FRAME.
         *
         * `seamWidth()` is one display pixel expressed in scene units, so it moves
         * with the zoom - and a viewer who scrolls the map mid-reveal should see the
         * same hairline they saw before, exactly as the room border does through
         * `rezoomRoomOutline`. The light is the border's three passes under the
         * blur set up above, on the same paths as the core.
         */
        const w = seamWidth();
        lineCore.clear();
        lineHalo.clear();
        for (let i = 0; i < lines; i++) {
            if (bottom[i] <= top[i]) continue;
            for (const [k, alpha] of GLOW) {
                lineHalo.lineStyle({ width: w * k, color: bone, alpha, cap: "round" });
                lineHalo.moveTo(at[i], top[i]);
                lineHalo.lineTo(at[i], bottom[i]);
            }
            lineCore.lineStyle({ width: w, color: bone, alpha: 1, cap: "square" });
            lineCore.moveTo(at[i], top[i]);
            lineCore.lineTo(at[i], bottom[i]);
        }
    } else {
        // The lines: a room-shaped sheet of white with the gaps taken out.
        lineCut.clear();
        lineCut.beginFill(0xffffff, 1);

        // Everything between the lines goes.
        let edge = cLow;
        for (const c of sorted) {
            const from = c - lineWidth / 2;
            if (from > edge) lineCut.drawPolygon(bandQuad(edge, from, tMin, tMax));
            edge = c + lineWidth / 2;
        }
        lineCut.drawPolygon(bandQuad(edge, cHigh, tMin, tMax));

        // And whatever falls outside each line's own stretch - above its
        // leading end, and below the end still trailing it.
        for (let i = 0; i < lines; i++) {
            const x = at[i] - lineWidth;
            const w = lineWidth * 3;
            if (top[i] > tMin) lineCut.drawRect(x, tMin, w, top[i] - tMin);
            if (bottom[i] < tMax) lineCut.drawRect(x, bottom[i], w, tMax - bottom[i]);
        }
        lineCut.endFill();
    }

    /*
     * THE STAINED BANDS: each texture is a room-shaped sheet in its own colour, and
     * everything that is not one of ITS bands is erased. Same fill-and-cut the fog
     * and the lines use, and for the same reason - it is the one way in this file to
     * keep a shape inside the walls.
     *
     * The opening goes with it. A band the curtain has already drawn back is not
     * glass any more, and leaving the colour there would paint a lid over the room
     * the reveal has just opened.
     */
    for (let s = 0; s < stains.length; s++) {
        const cut = stains[s].cut;
        cut.clear();
        cut.beginFill(0xffffff, 1);
        let kept = cLow;
        for (let i = 0; i <= lines; i++) {
            if (bandStain[i] !== s) continue;
            const from = i === 0 ? cLow : sorted[i - 1] + lineWidth / 2;
            const to = i === lines ? cHigh : sorted[i] - lineWidth / 2;
            if (to <= from) continue;
            if (from > kept) cut.drawPolygon(bandQuad(kept, from, tMin, tMax));
            kept = Math.max(kept, to);
        }
        if (kept < cHigh) cut.drawPolygon(bandQuad(kept, cHigh, tMin, tMax));
        if (opening > 0) cut.drawPolygon(bandQuad(cMid - opening, cMid + opening, tMin, tMax));
        cut.endFill();
    }
}

/**
 * The outline and the room's name, fading out together.
 *
 * BONE, NOT GOLD. The plan for this stage said "a short gold flash", but the
 * visual identity work reserved gold for Hope and nothing else - a third
 * meaning on that colour would undo the ordering that stage put in place.
 * White also ties the outline to the raster and to the edge of the sweep, so
 * the whole reveal speaks in one colour instead of three.
 */
/** The four widths an outline is drawn with: the line, its keyline, the stub floor and the doorway margin. */
function outlineWidths(glass, grid) {
    // Chunky and angular, in the pixel-art register the reveal raster set
    // (Dawid, 2026-08-26 - the old 4px stroke read thin and soft at play
    // zoom). Square caps are what close the corners: the gapped tracing draws
    // every edge as its own stroke, and two butt-capped strokes meeting at a
    // vertex each stop half a line-width short, leaving a notch in the corner.
    // A square cap extends each end by half the width, so the two ends
    // overlap into a full, sharp corner. Miter joins keep the drawPolygon
    // path's corners pointed instead of rounding them off.
    //
    // TWO PASSES, INK UNDER BONE. The white line is narrower than it was and
    // an ink keyline is drawn beneath it, wider by a pixel or two each side -
    // the sprite outline every pixel-art tile has, and what makes the border
    // hold against a bright floor instead of dissolving into it.
    //
    // Both passes walk the SAME gapped path, which is the whole reason the ink
    // is drawn here rather than as a filled backing shape: where the wall opens
    // there is no white line and there must be no black one either, or the
    // keyline would draw a lid across the doorway the glow is marking as a way
    // out. One trace, one set of gaps, and the two can never disagree.
    /*
     * THINNER UNDER STAINED GLASS, AND ONLY UNDER IT.
     *
     * The chunky line above is Dawid's decision of 26.08 against a 4px stroke that
     * read thin and soft at play zoom, and Monokuma Legacy keeps it to the pixel.
     * The Stained Glass theme asks the opposite of the same border: there the line
     * is not a pixel-art sprite outline, it is a SEAM - the same thing the curtain
     * draws, in the same colour - and a seam is thin. Roughly half, and deliberately
     * NOT back to the flat 4px that was rejected: at grid 100 the bright line goes
     * 11px to 6px and the whole ribbon 16px to 10px, which at a play zoom of 0.4 is
     * still four screen pixels of colour with a keyline under them.
     *
     * THE KEYLINE THINS WITH IT rather than being left behind. Held at the Legacy
     * margin it would out-weigh the line it exists to key - 8px of ink around 8px of
     * colour at grid 150 - and the border would read as ink with a coloured core,
     * which is the opposite of a seam. The ratio is what carries the look, and it
     * stays near 1.6 against Legacy's 1.45.
     */
    /* A SEAM IS THIN, AND 1.2.41 FIRST MADE IT THICKER BY ACCIDENT.
       Adding the glow without touching the line gave the border more total weight, not less,
       which is the opposite of the curtain it is supposed to quote: there the seam is a
       hairline core carrying a wide, faint light. So the coloured line halves again (grid 100:
       6 px to 3 px) and the keyline with it, and the light below does the work of being seen. */
    /* THE CURTAIN'S OWN NUMBERS, TAKEN OFF THE CURTAIN.
       Two rounds of "thinner" still did not look like a seam, so this stopped guessing and
       read `curtainPaint`: the seam there is a 1.2 px core in screen pixels carrying three
       BLURRED additive passes at 2.6 / 1.8 / 1.2 px and alpha 0.46 / 0.50 / 0.58. Two things
       follow that the outline was getting wrong. The core is far thinner than anything tried
       here - at a play zoom of 0.4 a 3 px scene line is already 1.2 px on screen, and the
       glass line was double that. And there is NO dark keyline anywhere in a seam: the
       curtain's light sits straight on the glass, so an ink line under it is what made the
       border read as a drawn edge rather than a join between two pieces of glass.
       Legacy is not touched by any of this: its own branch is the 26.08 pixel-art stroke,
       `max(7, grid * 0.11)` of bone over `+ max(4, grid * 0.05)` of ink, to the pixel. */
    /* AND IT IS MEASURED IN SCREEN PIXELS, WHICH IS WHY THE GRID CANNOT SET IT.
       The curtain's seam is 1.2 px on the display and stays 1.2 px however far the map is
       zoomed - it is drawn on a screen-space canvas. This is drawn in SCENE units, so the
       same seam has to be divided by the zoom, and the grid has nothing to do with it: at
       grid 20 a grid-relative hairline came out at 0.7 px on screen and vanished, at grid
       150 the same rule drew 2 px of line and Dawid called it thick. Both were the same
       formula asking the wrong question. Re-struck on zoom (see `rezoomRoomOutline`). */
    const boneWidth = glass ? seamWidth() : Math.max(7, Math.round(grid * 0.11));
    const inkWidth = glass ? 0 : boneWidth + Math.max(4, Math.round(grid * 0.05));
    /*
     * THE STUB FLOOR IS NOT A LINE WIDTH, SO IT DOES NOT FOLLOW ONE.
     *
     * `traceOutlineGapped`'s last argument discards a walled stretch shorter than
     * itself - the fix for the wedges Dawid photographed on 28.08. That threshold is
     * a statement about stray samples on a map, not about how heavy the pen is, and
     * letting it shrink with the theme's thinner line would start drawing the specks
     * the wide one was hiding. So it stays at Legacy's ink width at every grid, which
     * under Legacy is `inkWidth` itself, to the pixel.
     */
    const stubFloor = Math.max(7, Math.round(grid * 0.11)) + Math.max(4, Math.round(grid * 0.05));
    // Measured off the WIDER pass, and used by both: the gaps have to clear
    // the ink, and a bone line cut back to a different margin would poke out
    // past the keyline at every opening.
    const gapPad = grid * 0.05 + (inkWidth || Math.max(7, Math.round(grid * 0.11))) / 2;
    return { boneWidth, inkWidth, stubFloor, gapPad };
}

// Sized from the grid rather than fixed. A flat 28px in scene units is
// eleven pixels on screen at a zoom of 0.4, which is where this label spent
// its life being unreadable.
/* THE THEME'S OWN FACE, AND NOT THE ONE MONOKUMA LEGACY USES.
   The room's name is drawn on the canvas by PIXI, not by the sheet, so it never saw the
   theme's typography and both themes showed the same five-pixel DRPG Pixel. Under Stained
   Glass a room's name is exactly what the audit page reserves the title face for - "tam,
   gdzie jest nazwa rzeczy" - so it takes Special Elite, with the same fallbacks the CSS
   has. Legacy keeps the pixel face to the letter. */
function roomLabel(region, { glass, grid, bone, bounds, rect }) {
    const label = new PIXI.Text(region.name, {
        fontFamily: glass ? '"Special Elite", "Courier New", monospace' : "DRPG Pixel, monospace",
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
    return label;
}

/*
 * THE SEAM'S LIGHT, AND ONLY UNDER STAINED GLASS.
 *
 * The curtain draws every seam as a thin core sitting inside an additive airbrush at
 * two radii, which is why its crossings glow brighter than the runs between them. The
 * room border already wore the seam's colour and the seam's thickness and was the one
 * place that had the core without the light (Dawid, 2026-09-07).
 *
 * ITS OWN CONTAINER, because a blend mode belongs to a display object and the ink
 * keyline underneath must stay opaque - additive ink is no ink at all, and the border
 * would dissolve over a bright floor, which is exactly what the keyline exists to stop.
 * Round caps and joins here rather than the line's square/miter: this pass is light,
 * not a sprite edge, and a mitred spike in an additive layer reads as a flare.
 *
 * Drawn on the SAME gapped path, so a doorway stays dark in the glow too. Anything
 * else would paint a lid of light across the opening.
 */
function seamHalo({ bone, boneWidth, edges, rect, gapPad, stubFloor, region }) {
    const halo = new PIXI.Graphics();
    /* NAMED, because it has to be told apart from the outline itself. The glow strokes the
       same path four to seven times wider, so anything that measures "the outline" by
       picking the group's first Graphics would measure the light instead - which is what
       the stub test did the moment this was added. */
    halo.name = SEAM_GLOW_NAME;
    halo.blendMode = PIXI.BLEND_MODES?.ADD ?? 1;
    halo.eventMode = "none";
    const pass = (width, alpha) => {
        halo.lineStyle({ width, color: bone, alpha, cap: "round", join: "round" });
        if (edges.length) traceOutlineGapped(halo, edges, rect, gapPad, stubFloor);
        else traceRegionPathsAt(halo, region, rect);
    };
    /* THE CURTAIN'S THREE PASSES, AND THE BLUR THAT MAKES THEM A BLOOM.
       These were hard-edged strokes seven and three times the line's width, which is a
       pair of wide flat bands, not light - "glow jest o wiele sztuczniejszy" (07.09).
       The curtain blurs each pass by 18 / 7 / 2 screen px; a `BlurFilter` here is in
       screen pixels too, so the light stays the same weight at any zoom, as it does on
       the curtain. Alphas are the curtain's, halved: it is compositing over its own dark
       glass and this sits over a lit floor - but the alphas are the curtain's own now,
       unchanged, because the point is that it reads as the same material and it was the
       hard edge, not the brightness, that made it read as paint. */
    /* THE CURTAIN'S PROPORTIONS, READ OFF IT PROPERLY THIS TIME.
       Its glow is drawn at HALF resolution and blurred by 9 / 3.5 / 1 of those pixels -
       18 / 7 / 2 on screen - over strokes of 2.6 / 1.8 / 1.2. So the light is two or three
       pixels of line under twenty of bloom. This was five times the core wide and blurred
       by two: a wide flat band, which is why the border still read as thick next to the
       seams it is quoting. Narrow strokes, a blur six times the core. */
    pass(boneWidth * 2.6, 0.46);
    pass(boneWidth * 1.8, 0.50);
    pass(boneWidth * 1.2, 0.58);
    const Blur = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
    if (Blur) { const f = new Blur(Math.max(6, boneWidth * 6), 3); f.padding = boneWidth * 14; halo.filters = [f]; }
    return halo;
}

/*
 * THE LANDING. Two decreasing hops rather than one, because a single arc
 * reads as a slide and the point is that the room arrives - it drops in,
 * catches, and settles. `Math.abs(sin)` gives the hops, the `(1 - t)`
 * factor takes the height out of each one in turn.
 */
// Big enough to read as a landing rather than a nudge. The motion was
// right at a third of a square and simply too small to see.
// UP AND TO THE RIGHT, on the same reasoning as `bandQuad`: the isometric
// module on The Forge rotates the canvas, so a hop expressed on the
// diagonal here arrives as a clean vertical one there.
function landOutline(group, grid) {
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
}

/*
 * THE NAME GOES, THE OUTLINE STAYS. Naming a room is an announcement and
 * announcements end; the outline is a statement of where you are, and that
 * is true until you walk out. `fadeRoomOutline` is what ends it.
 */
function fadeLabel(label) {
    const labelState = { t: 0 };
    const dropLabel = () => { if (!label.destroyed) label.destroy(); };
    const fading = CanvasAnimation.animate([{ parent: labelState, attribute: "t", to: 1 }], {
        duration: OUTLINE_MS,
        ontick: () => {
            if (label.destroyed) return;
            // Full through the cut and the pause, fading only as the curtain
            // opens - the name should be readable while the room is still shut.
            label.alpha = clamp01((1 - labelState.t) / 0.35);
        }
    });
    watchdog(fading, OUTLINE_MS + 1500, dropLabel);
}

export function flashOutline(fx, region, rect) {
    if (!fx || fx.destroyed) return;

    // Whatever was outlined before, take it down - see `fadeRoomOutline`.
    fadeRoomOutline();

    // Under the Stained Glass theme the line is a seam: the state colour, the one the curtain's
    // seams wear right now. Bone otherwise, as it always was. See `outlineColour`.
    /* THE SETTING, NOT THE CLASS ON THE BODY.
       `applyTheme()` puts `drpg-theme-stained-glass` on `<body>` at ready, and the first room
       outline of a session is drawn while the scene is still coming up - before that class
       lands. Reading the class meant the outline took the Legacy branch (the thick pixel-art
       stroke, no seam glow) and then stood there unchanged for the rest of the session,
       because nothing redraws an outline that is already correct for the room you are in.
       That is why the border looked untouched after two rounds of changing it (Dawid, 07.09).
       The client setting is readable the moment settings are registered, which is earlier
       than any of this; the class stays as the fallback for a client mid-switch. */
    const glass = glassOn();
    const bone = outlineColour();
    const grid = canvas?.grid?.size ?? 100;
    const bounds = boundsOf(region);

    const group = new PIXI.Container();
    group.name = OUTLINE_NAME;
    group.eventMode = "none";

    // Measured once; the outline skips these and the glow marks them.
    const edges = doorwayEdges(region);

    const { boneWidth, inkWidth, stubFloor, gapPad } = outlineWidths(glass, grid);

    const outline = new PIXI.Graphics();
    /*
     * SQUARE CAPS ONLY AT THE ENDS OF A CHAIN, AND A MITER THAT CANNOT SPIKE.
     *
     * `traceOutlineGapped` walks contiguous stretches as single paths now, so
     * the caps that used to close every segment's corners have no corners left
     * to close - and on a grid staircase, where a step is about as long as the
     * line is wide, those caps were what turned the border into a thick blocky
     * ribbon. Measured on a purpose-built staircase fixture: the corners came
     * out filled solid, and the steps stopped reading as steps.
     *
     * Miter, not bevel. A bevel is safe but cuts every corner at 45°, which on
     * a square grid throws away the one thing this outline is meant to look
     * like. A miter keeps the corner square; the limit of 2 is what stops a
     * sharp V growing the spike that a limit of 8 allowed - past that ratio
     * PIXI falls back to a bevel by itself, which is exactly the right
     * behaviour for the rare acute corner.
     */
    const stroke = (width, color) => outline.lineStyle({
        width, color, alpha: 1, cap: "square", join: "miter", miterLimit: 2
    });

    // MEASURED OFF THE WIDER PASS, like `gapPad`, and for the same reason:
    // if the ink dropped a stretch the bone kept, the bone line would stand
    // there with no keyline under it.
    const trace = () => {
        if (edges.length) traceOutlineGapped(outline, edges, rect, gapPad, stubFloor);
        else traceRegionPathsAt(outline, region, rect);
    };

    if (inkWidth) { stroke(inkWidth, colourOf("--drpg-ink", 0x1a1620)); trace(); }
    stroke(boneWidth, bone);
    trace();

    const label = roomLabel(region, { glass, grid, bone, bounds, rect });


    if (glass) group.addChild(seamHalo({ bone, boneWidth, edges, rect, gapPad, stubFloor, region }));

    group.addChild(outline, label);
    // Under the outline and the name, so neither is softened by it.
    addDoorwayGlow(group, region, edges, rect);
    group.setChildIndex(outline, group.children.length - 1);
    group.setChildIndex(label, group.children.length - 1);
    fx.addChild(group);

    roomOutline = {
        group, outline, room: region.name, colour: bone,
        /* WHICH THEME DREW IT, AND WHAT FROM.
           Switching theme recoloured the standing outline and nothing else, so the line kept
           the WIDTH of the theme it was drawn under until the player walked into another
           room: leave Stained Glass and the hairline seam stayed, arrive in it and the thick
           pixel-art stroke stayed. Two different borders, each in the wrong theme, which is
           exactly what Dawid described on 07.09. The three arguments are kept so the outline
           can simply be drawn again. */
        glass, fx, region, rect,
        /*
         * RE-STROKE IN A NEW SEAM COLOUR WITHOUT MEASURING THE ROOM AGAIN.
         *
         * `edges` cost a movement-polygon test per border edge to find, and the two
         * widths and the gap margin were all settled against them. Capturing them
         * here means a turn of the day costs two traces of one border rather than a
         * fresh `flashOutline` with its doorway measurement, its render texture, its
         * bounce and its name. It closes over `outline`, never `group`, so it can
         * never reach the label - which is destroyed long before this is called.
         */
        recolour: colour => {
            if (outline.destroyed) return;
            outline.clear();
            if (inkWidth) { stroke(inkWidth, colourOf("--drpg-ink", 0x1a1620)); trace(); }
            stroke(glass ? seamWidth() : boneWidth, colour);
            trace();
        },
        /* Only the theme's seam has a width that depends on the zoom; Legacy's pixel-art
           stroke is a statement about the grid and holds still, so it has no `rewidth`. */
        rewidth: glass ? () => {
            if (outline.destroyed) return;
            const w = seamWidth();
            outline.clear();
            stroke(w, roomOutline?.colour ?? bone);
            trace();
            const halo = group.children.find(c => c?.name === SEAM_GLOW_NAME);
            if (halo && !halo.destroyed) {
                halo.clear();
                for (const [k, a] of SEAM_GLOW) {
                    halo.lineStyle({ width: w * k, color: roomOutline?.colour ?? bone, alpha: a, cap: "round", join: "round" });
                    if (edges.length) traceOutlineGapped(halo, edges, rect, gapPad, stubFloor);
                    else traceRegionPathsAt(halo, region, rect);
                }
            }
        } : null
    };

    landOutline(group, grid);
    fadeLabel(label);
}

/**
 * The pixel font, actually loaded, before anything tries to draw with it.
 *
 * `PIXI.Text` rasterises ONCE, when it is created, by measuring the string
 * through Canvas 2D - and it never looks again. A face that has not finished
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

export function ensurePixelFont() {
    if (pixelFontReady) return pixelFontReady;

    try {
        // Both faces: the module declares latin and latin-ext separately, and
        // `load` resolves for the characters asked about, not for the family.
        // Special Elite as well as the pixel face: PIXI measures a glyph at draw time and a
        // face that is not loaded yet is silently swapped for the fallback, once, forever.
        pixelFontReady = Promise.all([
            document.fonts.load('32px "DRPG Pixel"'),
            document.fonts.load('32px "DRPG Pixel"', "ĄĆĘŁŃÓŚŹŻ"),
            document.fonts.load('32px "Special Elite"'),
            document.fonts.load('32px "Special Elite"', "ĄĆĘŁŃÓŚŹŻ")
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
 * outlined room stops being one this viewer stands in - walking into a corridor
 * has to end it just as surely as walking into another room does.
 */
export function fadeRoomOutline() {
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

/** The curtain's seam core, 1.3 px on the display, in the scene units this layer draws in.
    EXPORTED because the Remnant rings are seams too under this theme and must be the same
    hairline as the room border they stand inside - one number, one home. */
export function seamWidth() {
    const zoom = canvas?.stage?.scale?.x;
    return 1.0 / (Number.isFinite(zoom) && zoom > 0.05 ? zoom : 1);
}

/* A SEAM HELD AT ONE WEIGHT WHILE THE MAP IS ZOOMED.
   The line is drawn in scene units, so zooming in would fatten it and zooming out would lose
   it - and the whole point of quoting the curtain is that its seams are the same hairline at
   every scale. Foundry fires `canvasPan` for every zoom step, so the outline is re-struck
   when the zoom has moved enough to be worth a redraw (a fifth), and never on a pan. */
let outlineZoom = 0;
export function rezoomRoomOutline() {
    const standing = roomOutline;
    if (!standing || standing.group?.destroyed || !standing.rewidth) return;
    const zoom = canvas?.stage?.scale?.x;
    if (!Number.isFinite(zoom) || zoom <= 0.05) return;
    if (outlineZoom && Math.abs(Math.log(zoom / outlineZoom)) < 0.18) return;
    outlineZoom = zoom;
    standing.rewidth();
}

/**
 * THE OUTLINE CARRIES THE HOUR, AND THE HOUR MOVES WITHOUT ANYBODY WALKING.
 *
 * `flashOutline` reads the seam colour once, when the room is entered, and the
 * outline then stands until you walk out - which, without this, meant it stood in
 * the colour of whatever hour it was drawn in. Nothing else was going to correct
 * it: `repaintFog` only ever takes an outline DOWN, and its signature carries no
 * colour term at all, so a repaint on a clock change returns at the first guard.
 *
 * THE COLOUR IS RE-APPLIED, THE ROOM IS NOT RE-DRAWN, and the two halves are not
 * equally cheap. The glow is a Sprite over a render texture, so its `tint` is a
 * uniform and costs one assignment. The outline is stroked geometry with the
 * colour baked into the batch, so it has to be walked again - which is why
 * `flashOutline` leaves behind a closure that can walk it WITHOUT measuring the
 * doorways a second time. Calling `flashOutline` again would re-run a
 * movement-polygon test per border edge, rebuild the glow's texture and replay the
 * bounce and the room's name, none of which a change of colour should do.
 *
 * IT SNAPS RATHER THAN FADING, deliberately. The interface fades because the
 * accent interpolates on elements; the curtain is held out of that fade on purpose
 * because it paints a canvas and needs the target colour at once. This layer is a
 * canvas too, and it turns with the curtain rather than behind it.
 */
export function recolourRoomOutline() {
    const standing = roomOutline;
    if (!standing || standing.group?.destroyed) return;

    /* A THEME CHANGE IS NOT A COLOUR CHANGE. The two themes draw different borders - Legacy
       the 26.08 pixel-art stroke, Stained Glass the curtain's hairline seam - so when the
       setting has moved the outline is drawn again from the room it was drawn from, rather
       than re-tinted. Everything else on this path is still one computed-style read. */
    const glassNow = glassOn();
    if (standing.glass !== glassNow && standing.region && standing.fx && !standing.fx.destroyed) {
        flashOutline(standing.fx, standing.region, standing.rect);
        return;
    }

    const colour = outlineColour();
    // By far the commonest case: the body's class list changed for some other reason
    // entirely. One computed-style read, one integer compare, and out.
    if (colour === standing.colour) return;
    standing.colour = colour;

    standing.recolour?.(colour);
    const glow = standing.group.children.find(c => c?.name === GLOW_NAME);
    if (glow && !glow.destroyed) glow.tint = colour;
}
