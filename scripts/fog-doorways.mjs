/**
 * Danganronpa RPG - the doorways: where a room's outline says "you can get out
 * this way".
 * ---------------------------------------------------------------------------
 * Finding the stretches of a room's border with no wall on them and another room
 * beyond (the wall test - `wallAlongEdge`, `nothingInTheWay`, `neighbourBeyond` -
 * and the openings, `doorwayEdges` down to `doorwayBox`), and drawing the glow
 * thrown outward from them (`addDoorwayGlow`, with its falloff, its cuts and
 * `eraseRoomFromGlow`), with the numbers both are tuned by (the `DOORWAY_*`
 * constants) and the outline drawn with the gaps left open
 * (`traceOutlineGapped`). Two things sit here because the glow is their lowest
 * reader: the seam colour (`colourOf`, `accentColour`, `outlineColour`) and
 * `MAX_FOG_TEXTURE`. One piece of state, `lastGlow`: what the last glow measured
 * for itself, set by `addDoorwayGlow`, filled in by `cutDoorwayEnds` and read by
 * fog.mjs's `diagnoseFog`. What it does not hold: the fog's layer and raster and
 * the reports (fog.mjs), the reveal and the room's outline (fog-reveal.mjs), the
 * map's checks (fog-diagnostics.mjs), nor the shape math (fog-geometry.mjs).
 *
 * WHERE IT SITS. Moved out of fog.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. Above it are fog.mjs (the
 * raster, the layer and `doorwayReport`), fog-reveal.mjs (the outline and the
 * reveal) and fog-diagnostics.mjs (the map's checks), which read sixteen of its
 * names between them - which is why they are exported now; fog.mjs exported none
 * of them before and re-exports none, so the module's API is the one it was.
 * Nothing here imports any of the three back (R161 would see the cycle). Below it
 * are utils.mjs (`debug`) and fog-geometry.mjs. `ADRIFT_WARN_RUN` is read only by
 * fog-diagnostics.mjs's `adriftCheck`; it stays among the doorway constants it
 * was written beside.
 */

import { debug } from "./utils.mjs";
import {
    regionShapes, polylineLength, inPolygons, resamplePolyline, smoothPolyline, trimPolyline
} from "./fog-geometry.mjs";

/**
 * Longest side of the fog's render texture, in pixels.
 *
 * The fog is drawn once into a texture the size of the padded scene rect and
 * shown as a single Sprite, so this caps what that costs on a very large map:
 * a 6000px scene is rendered at a third of its size and scaled back up, which
 * softens the edge of the fog by a couple of pixels and nothing else. Small
 * scenes - the usual case - are never scaled at all.
 */
export const MAX_FOG_TEXTURE = 2048;

/**
 * The seam colour of the Stained Glass theme, read off the body where the theme
 * sets it.
 *
 * NOT `Color.from` ALONE, AND THAT IS THE WHOLE OF WHY THIS PAINTED NOTHING.
 * `--drpg-glass-accent` is a REGISTERED custom property - `@property` with
 * `syntax: "<color>"` - which is what lets the interface interpolate it through a
 * colour change. A registered `<color>` computes to its RESOLVED form, so this
 * reads back `rgb(255, 211, 143)`, never the `#ffd38f` the token was written in.
 * `Color.fromString` is `parseInt(string, 16)`. Every hour of the day parsed to
 * NaN, and NaN went straight to `lineStyle` and to the room label's `fill`.
 * The rgb() form is read here directly; `Color.from` stays as the second chance
 * in case the token is ever a plain hex again, and is now checked for the NaN it
 * used to hand back in silence.
 *
 * Note the fallback below is close to dead: because the property is registered
 * WITH an initial value, the computed value is never the empty string - it
 * answers even with the theme switched off. The theme class is the real gate, and
 * it lives in `outlineColour`. Read this through that, never directly.
 */
function accentColour(fallback) {
    try {
        const raw = getComputedStyle(document.body).getPropertyValue("--drpg-glass-accent").trim();
        if (!raw) return fallback;
        // `rgb(r, g, b)` and `rgba(r, g, b, a)` alike: the first three numbers are the colour.
        const parts = raw.startsWith("rgb") ? raw.match(/[\d.]+/g) : null;
        if (parts && parts.length >= 3) {
            const [r, g, b] = parts.slice(0, 3).map(n => Math.min(255, Math.max(0, Math.round(Number(n)))));
            if ([r, g, b].every(Number.isFinite)) return (r << 16) | (g << 8) | b;
        }
        const parsed = foundry.utils.Color.from(raw).valueOf();
        return Number.isFinite(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

export function colourOf(name, fallback) {
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (!raw) return fallback;
        return foundry.utils.Color.from(raw).valueOf();
    } catch {
        return fallback;
    }
}

/**
 * The doorway glow, named so it can be found again.
 *
 * It is a Sprite over a render texture and its colour is a `tint` - a uniform,
 * free to reassign - so when the hour turns it does not have to be rebuilt, only
 * found. See `recolourRoomOutline`.
 */
export const GLOW_NAME = "drpgDoorwayGlow";

/** What the last doorway glow measured for itself - read by `diagnoseFog`. */
export let lastGlow = null;

/* ==========================================================================
 * DOORWAYS - where the outline says "you can get out this way".
 * --------------------------------------------------------------------------
 * A room's outline tells a player where they are. Along most of it there is a
 * wall; along some of it there is a way into the next room, and that is the
 * only part of the border they can actually do anything with. So the stretches
 * with no wall on them get a soft Bone glow, thrown OUTWARD from the edge.
 *
 * Two conditions, and both matter. There has to be another named Region on the
 * far side - otherwise the outer perimeter of the map, which has no walls
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
 * a half-square smudge does not - at the zoom people actually play at, that is
 * a few pixels. Deep enough to be a direction rather than a mark.
 */
const DOORWAY_DEPTH = 1.3;
/**
 * How many nested outlines the falloff is built from - see `addDoorwayGlow`.
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
 * side - see `smoothPolyline`.
 *
 * A grid staircase repeats every two squares of border walked (one across,
 * one along), and a moving average whose whole window covers a full period
 * cancels that period almost exactly: one square each side leaves under a
 * tenth of the wobble. Wide enough to take the tiles out, narrow enough that
 * a real corner is only softened by a fraction of a square - and the glow is
 * the only thing that reads this. The outline still traces the true border.
 */
const DOORWAY_SMOOTH = 1;
/**
 * How much of the averaging's amplitude is paid back as full-strength core -
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
 * `PointSourcePolygon.testCollision` ROUNDS its endpoints to whole pixels - so a
 * ray beginning two pixels from a wall can be rounded onto it, and a ray that
 * starts on an edge is not counted as crossing it. Starting a fifth of a square
 * back puts the origin unambiguously on the inside.
 */
export const DOORWAY_PROBE_IN = 0.18;
/**
 * How far OUTSIDE the room to look, in grid squares - both for the neighbouring
 * room and for anything in the way of reaching it.
 *
 * The first version looked 0.4 of a square out, which is inside the wall on
 * plenty of maps: the neighbour was found, the wall was never reached, and the
 * border came back "open" along its whole length.
 */
export const DOORWAY_PROBE_OUT = 0.95;
/**
 * How far INSIDE our own border to stand when asking "am I already in another
 * room" - in grid squares.
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
 * not caught here - they are sub-square misalignments, and the wall test below
 * is what answers those.
 */
export const DOORWAY_OVERLAP_INSET = 0.25;
/**
 * How close a wall has to pass to a border sample to close it, in grid squares.
 *
 * Measured to the wall SEGMENT, not to its midpoint. A corridor wall drawn as
 * one ten-square segment has its midpoint five squares from most of the border
 * it runs alongside; asked about midpoints, every sample but the middle one
 * would report no wall nearby and the whole corridor would glow.
 */
export const DOORWAY_WALL_NEAR = 0.6;
/**
 * How nearly parallel a wall must be to the border to count as closing it,
 * in degrees.
 *
 * A wall crossing the border at a right angle is a door jamb or the end of a
 * partition - it is beside the opening, not across it, and closing the doorway
 * because of one is how a real door stops being marked.
 */
const DOORWAY_WALL_ANGLE = 20;
/**
 * How long a stretch of border has to be, with no wall alongside it, before
 * `checkRegions` says so - in grid squares.
 *
 * NOT A LIMIT ON DOORWAYS. There is deliberately no upper bound on how wide a
 * way out may be: a hall open along one whole side is a real thing to build, and
 * a module that quietly trimmed it to three squares would be lying about the map
 * (Dawid, 27.08). This number only decides when the validator speaks up.
 *
 * Six squares, and the figure is measured rather than chosen. Every room has
 * border with no wall on it - that is what a doorway is - so the healthy rooms
 * on this project's own scene run up to 4.3 squares in one stretch, and the ones
 * whose border was drawn away from its wall start at 7.3. The line goes in the
 * gap between them.
 */
export const ADRIFT_WARN_RUN = 6;
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
 * strength held through the first half, then a tail - which is what makes a
 * deep glow read as reaching rather than as merely being large and faint.
 */
function doorwayFalloff(t) {
    if (t <= 0) return 1;
    if (t >= 1) return 0;
    return t <= 0.5 ? 1 - 0.56 * t : 1.44 * (1 - t);
}

/**
 * The distance at which the glow has fallen to `y` - `doorwayFalloff` read
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
 * survives is the glow times the same curve that shapes it outward - the end
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

/**
 * Which way the border RUNS here, taken over a square either side.
 *
 * THE ISOMETRIC CASE, AND IT IS THIS MODULE'S ONLY CASE. The art draws a wall
 * as a diagonal; a region is drawn on the square grid, so the border that
 * describes that wall comes out as a staircase. Every step of a staircase is
 * axis-aligned and the wall it stands for is at 45 degrees - which is more
 * than twice the tolerance `wallAlongEdge` allows, so the wall lying exactly
 * along the border closed nothing, and the whole side of the room read as one
 * doorway.
 *
 * Measured on a purpose-built fixture before this existed: a staircase against
 * a 45-degree wall came back FULLY OPEN at every step size from half a square
 * to three - the distance never mattered, only the angle - and the same
 * staircase walled step by step came back closed. Nine of the eighteen rooms
 * on this project's own scene were being reported adrift for the same reason.
 *
 * The trend is the chord between the point a square back and the point a
 * square on, which is the diagonal the steps are drawn to. It is offered as a
 * SECOND chance rather than a replacement: a straight border still answers for
 * itself, so nothing changes on a map drawn square.
 */
function borderTrend(flat, corners, i, span) {
    if (corners < 3) return null;
    const at = k => {
        const m = ((k % corners) + corners) % corners;
        return { x: flat[m * 2], y: flat[m * 2 + 1] };
    };

    const walk = (from, direction) => {
        let point = at(from);
        let gone = 0;
        for (let k = 0; k < corners && gone < span; k++) {
            const next = at(from + direction * (k + 1));
            gone += Math.hypot(next.x - point.x, next.y - point.y);
            point = next;
        }
        return point;
    };

    const back = walk(i, -1);
    const forward = walk(i + 1, 1);
    const dx = forward.x - back.x, dy = forward.y - back.y;
    const length = Math.hypot(dx, dy);
    return length < 1e-6 ? null : { x: dx / length, y: dy / length };
}

/**
 * Does a wall run alongside this stretch of border, close enough and straight
 * enough to be the wall this border describes?
 *
 * THIS IS THE QUESTION THE OLD TEST NEVER ASKED. It used to ask whether a ray
 * of a fixed length hit anything, which makes the answer depend on how far from
 * the wall the GM happened to draw the region - a border set back more than the
 * ray is long reports no wall and glows along its entire length, on a map where
 * the player can plainly see one.
 *
 * Only walls that actually stop movement count. A wall with no movement
 * restriction is scenery, and an OPEN door is a way out - closing an opening
 * because a door exists in it is precisely backwards.
 */
export function wallAlongEdge(mx, my, ex, ey, walls, near, trend = null) {
    try {
        return wallAlongEdgeUnguarded(mx, my, ex, ey, walls, near, trend);
    } catch (err) {
        // FAILS CLOSED, the same way `nothingInTheWay` does and for the same
        // reason: a doorway that is really a wall is a lie the player walks
        // into, and a wall that is really a doorway costs them a moment's doubt
        // and a second try. When this cannot tell, it says there is a wall.
        debug("Fog: could not test a border sample for a wall alongside it", err);
        return true;
    }
}

function wallAlongEdgeUnguarded(mx, my, ex, ey, walls, near, trend = null) {
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
         * Distance to the segment - which counts its endpoints - eats the
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

        // Parallel either way round - a wall does not care which end you call
        // its start, so the sign of the dot product carries no information.
        //
        // ASKED OF THE STEP AND OF THE RUN. On a staircase the step is
        // axis-aligned and the wall is the diagonal it approximates; see
        // `borderTrend` for what that cost.
        const wl = Math.sqrt(len2);
        const ux = wx / wl, uy = wy / wl;
        if (Math.abs(ux * ex + uy * ey) >= DOORWAY_WALL_COS) return true;
        if (trend && Math.abs(ux * trend.x + uy * trend.y) >= DOORWAY_WALL_COS) return true;
    }
    return false;
}

/**
 * Can something move from just inside the edge to just outside it?
 *
 * Asked of the movement backend, so whatever Foundry counts as passable here -
 * an open door, a window a token may not cross, a wall with no movement
 * restriction - is counted the same way the game counts it everywhere else.
 *
 * Fails CLOSED. A doorway that is really a wall is a lie the player would walk
 * into; a wall that is really a doorway costs them nothing but a moment's
 * doubt, and they can simply try it.
 */
export function nothingInTheWay(from, to) {
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
export function neighbourBeyond(mx, my, nx, ny, others, reach) {
    for (const fraction of [0.35, 0.6, 0.85, 1]) {
        const x = mx + nx * reach * fraction;
        const y = my + ny * reach * fraction;
        if (others.some(p => inPolygons(p, x, y))) return { x, y };
    }
    return null;
}

/**
 * Every edge of a room's border, and the stretches along each one that have no
 * wall on them.
 *
 * COMPUTED ONCE AND USED TWICE. The glow marks these stretches and the outline
 * has to skip exactly the same ones - two passes measuring the same thing
 * independently would eventually disagree by a pixel somewhere, and the seam
 * between a line that stops and a glow that starts is precisely where that
 * would show.
 *
 * The TRUE border, never a smoothed one. Flattening the ring before measuring
 * was tried, to stop a grid staircase coming out as a ladder of little glow
 * patches, and it was the wrong cut: it moved the line the glow sits on away
 * from the wall it describes, which shows up as the glow slicing across
 * corners - and it left the real defects, which were in how the patches were
 * composited, exactly where they were. `addDoorwayGlow` handles the staircase
 * now, on this same honest geometry.
 */
export function doorwayEdges(region) {
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

                // Worked out once per edge, not once per sample: it is a fact
                // about the border, and every sample on this edge shares it.
                const trend = borderTrend(flat, corners, i, grid);

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
                             * time - and those are not the same ray.
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
                             * edge runs somewhere inside its neighbour's floor -
                             * a square or more from any wall - so a neighbour is
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
                                && !wallAlongEdge(mx, my, dx / length, dy / length, walls, near, trend)
                                // And is it passable in the way Foundry counts
                                // passable - which is what reads door state.
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

                edges.push({ ax, ay, dx, dy, length, nx, ny, ring, open, trend });
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
 * gradient - which is what a reader sees when they look at it.
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

/*
 * The glow along every open stretch of a room's border.
 *
 * ONE FIELD, NOT ONE PATCH PER SEGMENT - and that is the whole of this
 * rewrite. The old version put a rectangular gradient sprite on each open
 * segment, thrown outward along that segment's own normal, which broke in
 * three ways the moment a border was not a straight line:
 *
 *   they ADDED UP     two sprites overlap and PIXI blends them additively, so
 *                     a staircase came out at nearly twice the intended alpha
 *                     - measured at 1.16 against a design value of 0.6
 *   they SPILLED      a rectangle thrown perpendicular to one little tooth of
 *                     a staircase crosses the floor of the room it came from
 *   they were BOXY    two dozen axis-aligned patches where the reader sees one
 *                     diagonal wall
 *
 * None of that is fixable by tidying the geometry the patches sit on - the
 * first two are compositing, not shape. So the glow is now a DISTANCE FIELD:
 * strength is a function of how far a pixel is from the nearest open border,
 * and a function has one value, so nothing can stack with anything.
 *
 * Built without a shader, out of nested outlines. Each of `DOORWAY_STEPS`
 * levels strokes every opening at a decreasing width into a scratch texture -
 * flat white at full alpha, so overlapping strokes UNION rather than sum - and
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
/** The doorway chains, resampled and averaged, and how far the averaging strayed from the wall. */
function doorwayOpenings(edges, rect, { step, smoothHalf }) {
    let amplitude = 0;
    const openings = [];
    for (const chain of doorwayChains(edges, rect)) {
        const dense = resamplePolyline(chain, step);
        const averaged = smoothPolyline(dense, smoothHalf);
        // How far the averaged line strays from the border it stands for -
        // the staircase's own amplitude, measured rather than assumed.
        for (let i = 0; i < dense.length; i++) {
            amplitude = Math.max(amplitude,
                Math.hypot(dense[i].x - averaged[i].x, dense[i].y - averaged[i].y));
        }
        if (averaged.length >= 2) openings.push(averaged);
    }
    return { openings, amplitude };
}

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
     * every level closes itself with a cap square to its own last segment -
     * axis-aligned, on a staircase - and that cap, not the gradient, is what
     * decides where the band stops across part of its depth. Running the
     * strokes off the end and cutting them afterwards leaves the cut as the
     * only thing shaping it.
     */
function doorwayRuns(openings, { spanFor, depth, stub }) {
    return openings.map(chain => {
        const ownSpan = spanFor(chain);
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
        return { heads, line, ownSpan };
    });
}

/** The texture's box: every run, plus the glow's reach on all sides. */
function doorwayBox(runs, reach) {
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
    return box;
}

    /*
     * THE ENDS ARE CUT ONCE, ACROSS THE WHOLE BAND.
     *
     * Shortening each level by a different amount fades the glow out along
     * the border, and on a straight wall it looks right - every level ends
     * on a cap perpendicular to the same wall, so the sixteen caps stack
     * into one clean edge. On a staircase they do not: a cap is
     * perpendicular to the little axis-aligned segment it happens to land
     * on, the segments alternate, and the sixteen ends come out as a
     * ragged step instead of a cut.
     *
     * So the band is built full length - run past its ends, even, so no
     * level's own cap can shape it - and cut afterwards, by one gradient
     * laid across it, square to the direction the opening actually runs
     * in. That is the same straight, single-gradient edge a flat wall
     * gets, because now it is literally the same operation. Anything past
     * the end goes entirely, so no light reaches around the doorframe.
     */
    // Both cuts have to clear the band comfortably in every direction: the
    // band reaches `reach` outward from the line and an amplitude inward
    // of it, and a cut that merely meets those edges leaves an
    // antialiased sliver standing.
function cutDoorwayEnds(ends, runs, { halfBand, depth, stub, box, fadeTexture }) {
    for (const run of runs) {
        for (const { at: end, near, dir } of run.heads) {
            const ux = dir.x, uy = dir.y;
            lastGlow.endAngles.push(Math.round(Math.atan2(uy, ux) * 180 / Math.PI));

            /*
             * CENTRED ON THE LINE, NOT ON THE END POINT.
             *
             * Both cuts reach a half-band either side of wherever they are
             * anchored, and the end point is a corner of the TRUE border -
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
            // room to spare - matching it exactly left a line of pixels.
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
}

    /*
     * THE INWARD SIDE GOES, ALL THE WAY ALONG.
     *
     * The band is built symmetrically about its line and the inward half
     * is taken away by erasing the room - which holds for exactly as long
     * as the room is what lies inward. At the end of an opening the border
     * turns and stops being that, and what is left is a lobe of glow on
     * the far side of the wall: measured on a staircase whose far end
     * meets the room's own bottom edge, 35px past the line there against
     * 3.5px anywhere else. That lobe is the bulge on an end that is
     * otherwise cut square.
     *
     * Past the lip, the inward side is inside the room at every point
     * ALONG an opening, so erasing it there costs nothing - and doing it
     * along the whole run, corners and stubs included, is what closes the
     * ends without a special case for each way a border can turn. The lip
     * keeps the sliver that is legitimately lit where the true wall dips
     * inside the averaged line.
     *
     * Which way is inward is asked of the room itself rather than read off
     * the winding, which no map is obliged to keep consistent.
     */
function cutDoorwayInside(ends, runs, { amplitude, out, halfBand, stub, box, insideRoom }) {
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
}

    // The room is not lit by its own doorways. Its shape comes out of the
    // field entirely, and a ring of `out` around the border with it, which
    // is what keeps the outline sitting on ink rather than on light.
function eraseRoomFromGlow(renderer, field, region, rect, box, out) {
    const eraser = new PIXI.Graphics();
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
    try {
        renderer.render(eraser, { renderTexture: field, clear: false });
    } finally {
        eraser.destroy();
    }
}

/**
 * Add the glow along every open stretch of a room's border.
 *
 * Runs once when a room is entered, walking its outline in short samples. A
 * room with a two-thousand-pixel perimeter is eighty tests, which is nothing
 * for something that happens when somebody walks through a door.
 */
export function addDoorwayGlow(group, region, edges, rect) {
    if (!group || group.destroyed) return;
    const renderer = canvas?.app?.renderer;
    if (!renderer) return;

    const grid = canvas?.grid?.size ?? 100;
    const depth = grid * DOORWAY_DEPTH;
    const out = grid * DOORWAY_OFFSET;
    const step = Math.max(1, grid / 5);
    const smoothHalf = Math.max(1, Math.round(grid * DOORWAY_SMOOTH / step));

    const { openings, amplitude: strayed } = doorwayOpenings(edges, rect, { step, smoothHalf });
    let amplitude = strayed;
    if (!openings.length) return;

    /*
     * THE CORE IS WIDENED BY WHATEVER THE AVERAGING MOVED.
     *
     * The averaged line runs down the middle of the staircase, so the real
     * wall sits up to an amplitude either side of it. Left alone, the falloff
     * would already have started by the time it reached the wall on the teeth
     * that stick out and not on the ones that do not - a faint beading along
     * the border, at the pitch of the tiles, which is the artefact this whole
     * thing exists to remove. A flat full-strength core that wide puts every
     * part of the wall at full strength instead.
     *
     * The core is added to the depth rather than taken out of it. Taking it
     * out kept the outer edge the same distance from the averaged line and
     * made the GRADIENT ITSELF shorter on a jagged border than on a flat one -
     * a quarter shorter on a staircase of single squares, which reads as a
     * thin, hurried glow next to a straight wall's. The gradient is the thing
     * that has to match, so it is `depth` everywhere and the core is extra -
     * and only `DOORWAY_AVERAGE_BIAS` of the amplitude at that, which is where
     * the depth this adds is traded against the ripple it removes.
     */
    amplitude = Math.min(amplitude, grid);
    const core = out + amplitude * DOORWAY_AVERAGE_BIAS;
    const span = depth;

    /*
     * A DOORWAY'S GLOW IS NEVER DEEPER THAN THE DOORWAY IS WIDE.
     *
     * `depth` is 1.3 squares, and it is the right depth for a way through that
     * a person walks along. An opening only has to be 0.35 of a square to be
     * kept at all (`shortest` in `doorwayEdges`) - so a short one was painted
     * as a patch WIDER THAN IT IS LONG, standing proud of the wall and cut
     * square at both ends by the end cuts. Dawid photographed one three times
     * on 28.08 and confirmed which of the two things it was on the fourth: the
     * glow. On his map the numbers make it unmissable - `reach` 137px against a
     * grid of 85, so a half-square opening was drawn a square and a half deep.
     *
     * Reading it as light rather than as a band is what settles the shape: a
     * narrow gap throws a small pool, a wide one throws a long one. So the
     * depth of the falloff is what the opening's own length can afford after
     * the flat core is paid for, and a long opening - every real doorway on a
     * sane map - is not touched, because `min` keeps the full depth the moment
     * the opening is longer than one.
     */
    const lengthOf = polylineLength;
    // A floor, so a genuinely narrow way through still says it is there rather
    // than vanishing into the outline that stops on either side of it.
    const spanFloor = grid * 0.25;
    const spanFor = chain => Math.max(spanFloor, Math.min(span, lengthOf(chain) - core));

    const reach = core + span + 2;
    lastGlow = {
        openings: openings.length,
        points: openings.reduce((n, c) => n + c.length, 0),
        // Per opening, because the aggregate cannot say which one looks wrong:
        // how long it is, and how deep its glow was allowed to be.
        each: openings.map(chain => ({
            length: Math.round(lengthOf(chain)),
            inSquares: Math.round(lengthOf(chain) / grid * 100) / 100,
            span: Math.round(spanFor(chain)),
            at: { x: Math.round(chain[0].x), y: Math.round(chain[0].y) }
        })),
        amplitude: Math.round(amplitude * 10) / 10,
        core: Math.round(core * 10) / 10,
        span: Math.round(span * 10) / 10,
        reachFromAveragedLine: Math.round((core + span) * 10) / 10,
        endAngles: []
    };
    const stub = reach + 4;
    const runs = doorwayRuns(openings, { spanFor, depth, stub });

    const box = doorwayBox(runs, reach);
    if (!(box.w > 0) || !(box.h > 0)) return;

    let field = null, level = null, strokes = null, blit = null;
    try {
        const resolution = Math.min(1, MAX_FOG_TEXTURE / Math.max(box.w, box.h));
        field = PIXI.RenderTexture.create({ width: box.w, height: box.h, resolution });
        level = PIXI.RenderTexture.create({ width: box.w, height: box.h, resolution });

        strokes = new PIXI.Graphics();
        blit = new PIXI.Sprite(level);
        blit.blendMode = PIXI.BLEND_MODES.ADD;
        blit.alpha = DOORWAY_ALPHA / DOORWAY_STEPS;

        for (let k = 1; k <= DOORWAY_STEPS; k++) {
            const falloff = doorwayFalloffAt((k - 0.5) / DOORWAY_STEPS);
            strokes.clear();
            // PER RUN, because each opening now has its own depth. The levels
            // still stack into one field, so a wide doorway and a narrow one
            // beside it are the same drawing at two sizes rather than two
            // drawings.
            for (const { line, ownSpan } of runs) {
                strokes.lineStyle({
                    width: (core + ownSpan * falloff) * 2,
                    color: 0xffffff, alpha: 1, cap: "butt", join: "round"
                });
                strokes.moveTo(line[0].x - box.x, line[0].y - box.y);
                for (let i = 1; i < line.length; i++) {
                    strokes.lineTo(line[i].x - box.x, line[i].y - box.y);
                }
            }
            renderer.render(strokes, { renderTexture: level, clear: true });
            renderer.render(blit, { renderTexture: field, clear: k === 1 });
        }

        const halfBand = reach + amplitude + 6;
        const fadeTexture = doorwayFadeTexture();
        const ends = new PIXI.Container();
        const ownPolygons = regionShapes(region, rect).map(f => new PIXI.Polygon(f));
        const insideRoom = (x, y) => ownPolygons.some(p => p.contains(x, y));
        cutDoorwayEnds(ends, runs, { halfBand, depth, stub, box, fadeTexture });

        cutDoorwayInside(ends, runs, { amplitude, out, halfBand, stub, box, insideRoom });
        if (ends.children.length) renderer.render(ends, { renderTexture: field, clear: false });
        ends.destroy({ children: true });
        if (fadeTexture) fadeTexture.destroy(true);

        eraseRoomFromGlow(renderer, field, region, rect, box, out);

        const glow = new PIXI.Sprite(field);
        glow.name = GLOW_NAME;
        /* The gradient thrown out of a doorway is the same seam colour as the outline that
           stops either side of it - Bone under Legacy, the state colour under Stained Glass,
           and it would read as a different object in any other colour. A Sprite's tint is a
           shader uniform, which also makes this the one thing on the layer that can follow the
           hour for nothing at all. See `recolourRoomOutline`. */
        glow.tint = outlineColour();
        glow.position.set(box.x, box.y);
        // `destroy({children: true})` does not free a texture - see `freeOwned`.
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
    }
}

/**
 * Draw the room's outline, leaving the doorways out of it.
 *
 * A white line straight across an opening says the opposite of what the glow
 * beside it is saying. Where the wall stops, the outline stops.
 */
export function traceOutlineGapped(graphics, edges, rect, pad = null, minRun = null) {
    const grid = canvas?.grid?.size ?? 100;
    // The gaps are widened by half a line width, because a square cap sticks
    // out that far past the end of a chain - without it the fattened line pokes
    // into the opening it was told to leave clear. Handed in when one path is
    // walked twice at two widths, so both passes cut back to the wider one's
    // margin and stay aligned.
    pad ??= grid * 0.05 + (graphics.line?.width ?? 0) / 2;
    /*
     * A WALL TOO SHORT TO DRAW AS A LINE IS NOT DRAWN AS A BLOB.
     *
     * An OPENING shorter than a third of a square is discarded - `shortest` in
     * `doorwayEdges`. A walled stretch had no such rule, and the two are not
     * symmetric in what they cost. A stray sample reading "wall" in the middle
     * of a long doorway leaves a visible stretch a few pixels long, and this
     * outline is stroked with SQUARE caps: each end runs half a line-width past
     * the stretch, so anything shorter than one width comes out as a solid
     * wedge rather than a line - standing on its own in the middle of an
     * opening, with the ink keyline around it, far from any other outline.
     *
     * That is what Dawid photographed on 28.08. The map behind it is exactly
     * the shape that makes stray samples likely: `lastGlow` on his scene reads
     * FIVE openings on one border, so that border is cut by four walled
     * stretches, and the grid there is 85px against an ink line 13px wide.
     */
    minRun ??= (graphics.line?.width ?? 0) || grid * 0.1;

    const at = (edge, t) => ({
        x: edge.ax + edge.dx * t - rect.x,
        y: edge.ay + edge.dy * t - rect.y
    });

    /*
     * DRAWN AS CHAINS, NOT AS LOOSE SEGMENTS - and that is the whole of the
     * fix for the thick, lumpy staircase borders.
     *
     * Every edge used to be its own stroke with a square cap on each end, which
     * is what closed the corners: two butt-capped strokes meeting at a vertex
     * each stop half a line-width short and leave a notch. The cost only shows
     * on a grid staircase, where the steps are about as long as the line is
     * wide - there the caps of neighbouring segments overlap along their whole
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
            // Length along the chain, not end to end: a staircase doubles back
            // and its span would read shorter than the line it draws.
            let run = 0;
            for (let i = 1; i < points.length; i++) {
                run += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            }
            if (run < minRun) continue;
            graphics.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) graphics.lineTo(points[i].x, points[i].y);
        }
    }
}

/**
 * The seam colour the room outline and the doorway glow should be wearing now.
 *
 * One function, because three copies of this test is how they drift apart. Bone
 * under Monokuma Legacy, exactly as it always was; the state colour the curtain's
 * seams are wearing under Stained Glass.
 *
 * THE THEME CLASS IS THE GATE AND HAS TO STAY THE GATE. `--drpg-glass-accent` is
 * registered with an initial value, so it answers with the afternoon gold even
 * when the theme is off - `accentColour`'s own fallback can never fire on its own.
 */
export function outlineColour() {
    const bone = colourOf("--drpg-bone", 0xe8e3ec);
    return document.body.classList.contains("drpg-theme-stained-glass")
        ? accentColour(bone)
        : bone;
}
