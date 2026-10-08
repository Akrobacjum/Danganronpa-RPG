/**
 * Danganronpa RPG - the fog's checks of the map, and what drew a pixel.
 * ---------------------------------------------------------------------------
 * The console's two questions about a scene, which read the map and the drawn
 * layer and change neither: `checkRegions`, every room checked against the rules
 * the fog layer depends on (`namedRegions`, `overlapCheck`, `adriftCheck`,
 * `noWayOutCheck`, `latticeCheck`, with `pointOf`, `commonestOffset`,
 * `gridOffset` and `overlapArea`), and `whatIsHere`, which of the outline, the
 * glow and the raster drew a point (`findNamed`, `nearestOutline`,
 * `glowAlphaAt`, `nearestBorderTo`, `nearestWallTo`, `printWhatIsHere`); and
 * `sceneUncoveredPercent`, how much of a scene belongs to no room, for the GM's
 * warning line. It holds no state: `whatIsHere` finds the outline and its glow
 * on the canvas by name and reads fog-reveal.mjs's `roomOutline` for the room.
 * What it does not hold: the reports on the live layer (`diagnoseFog`,
 * `whyBlack`, `fogPeek`, `doorwayReport`), which read the layer's own state and
 * stay with it in fog.mjs, the wall test and the openings the checks ask
 * (fog-doorways.mjs), nor the shape math (fog-geometry.mjs).
 *
 * WHERE IT SITS. Moved out of fog.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. The file above it is fog.mjs,
 * which re-exports the three names here it exported before: `whatIsHere` and
 * `checkRegions` (api.mjs puts both on `game.drpg`; season-setup.mjs and the
 * tier-2 tests import `checkRegions` from fog.mjs) and `sceneUncoveredPercent`
 * (vault.mjs imports it from fog.mjs, and fog.mjs's `diagnoseScenes` calls it).
 * No other name here is read outside it, so none was exported for the move and
 * the module's API is the one it was. Nothing here imports fog.mjs back (R161
 * would see the cycle). Below it are config.mjs (`MODULE_ID`), movement.mjs
 * (`boundsOf`), fog-geometry.mjs, fog-doorways.mjs (the wall test, the openings,
 * the `DOORWAY_*` numbers the checks measure with and `ADRIFT_WARN_RUN`) and
 * fog-reveal.mjs (`roomOutline`).
 */

import { MODULE_ID } from "./config.mjs";
import { boundsOf } from "./movement.mjs";
import { regionShapes, inPolygons, polygonArea } from "./fog-geometry.mjs";
import {
    DOORWAY_PROBE_OUT, DOORWAY_OVERLAP_INSET, DOORWAY_WALL_NEAR, ADRIFT_WARN_RUN, wallAlongEdge, neighbourBeyond,
    doorwayEdges
} from "./fog-doorways.mjs";
import { roomOutline } from "./fog-reveal.mjs";

/** Depth-first, by display-object name. */
function findNamed(node, name) {
    if (!node) return null;
    if (node.name === name) return node;
    for (const child of node.children ?? []) {
        const hit = findNamed(child, name);
        if (hit) return hit;
    }
    return null;
}

/** The stroked outline nearest the point, and whether the stroke covers it. */
function nearestOutline(group, at, report) {
    const graphics = group?.children?.find(c => !c.texture && c.geometry);
    if (graphics) {
        let nearest = null;
        for (const piece of graphics.geometry?.graphicsData ?? []) {
            const points = piece.shape?.points;
            if (!points || points.length < 4) continue;
            const width = piece.lineStyle?.width ?? 0;
            let run = 0;
            let best = Infinity;
            for (let i = 2; i < points.length; i += 2) {
                const ax = points[i - 2] + group.x, ay = points[i - 1] + group.y;
                const bx = points[i] + group.x, by = points[i + 1] + group.y;
                const dx = bx - ax, dy = by - ay;
                run += Math.hypot(dx, dy);
                const l2 = dx * dx + dy * dy || 1;
                let t = ((at.x - ax) * dx + (at.y - ay) * dy) / l2;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                best = Math.min(best, Math.hypot(at.x - (ax + dx * t), at.y - (ay + dy * t)));
            }
            if (!nearest || best < nearest.distance) {
                nearest = { distance: best, width, chainLength: run, points: points.length / 2 };
            }
        }
        if (nearest) {
            report.outline = {
                nearestChain: Math.round(nearest.distance * 10) / 10,
                strokeWidth: nearest.width,
                chainLength: Math.round(nearest.chainLength),
                chainPoints: nearest.points,
                // Half a stroke either side is what the line covers.
                covers: nearest.distance <= nearest.width / 2
            };
            if (report.outline.covers) report.found.push("room outline (a stroked line)");
        }
    }
}

/* ---- the glow: one texture pixel, read ------------------------------- */
function glowAlphaAt(group, at, report) {
    const sprite = group?.children?.find(c => c.texture);
    if (sprite) {
        const px = Math.round(at.x - sprite.x);
        const py = Math.round(at.y - sprite.y);
        const inside = px >= 0 && py >= 0 && px < sprite.texture.width && py < sprite.texture.height;
        report.glow = { inSprite: inside };
        if (inside) {
            try {
                const pixels = canvas.app.renderer.extract.pixels(sprite.texture);
                const i = (py * sprite.texture.width + px) * 4;
                report.glow.alpha = Math.round(pixels[i + 3] / 2.55) / 100;
                if (report.glow.alpha > 0.02) report.found.push(`doorway glow (alpha ${report.glow.alpha})`);
            } catch (err) {
                report.glow.alpha = `unreadable: ${err.message}`;
            }
        }
    }
}

/** The nearest room border to the point, in pixels and squares. */
function nearestBorderTo(scene, at, grid, report) {
    let nearestBorder = null;
    for (const region of scene.regions ?? []) {
        if (!region.name) continue;
        for (const flat of regionShapes(region, { x: 0, y: 0 })) {
            for (let i = 0; i < flat.length; i += 2) {
                const j = (i + 2) % flat.length;
                const ax = flat[i], ay = flat[i + 1], bx = flat[j], by = flat[j + 1];
                const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
                let t = ((at.x - ax) * dx + (at.y - ay) * dy) / l2;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const d = Math.hypot(at.x - (ax + dx * t), at.y - (ay + dy * t));
                if (!nearestBorder || d < nearestBorder.distance) {
                    nearestBorder = { room: region.name, distance: d };
                }
            }
        }
    }
    if (nearestBorder) {
        report.border = { room: nearestBorder.room,
            distance: Math.round(nearestBorder.distance * 10) / 10,
            inSquares: Math.round(nearestBorder.distance / grid * 100) / 100 };
    }
}

/** The nearest wall to the point, and the angle it runs at. */
function nearestWallTo(scene, at, report) {
    let nearestWall = null;
    for (const wall of scene.walls ?? []) {
        const c = wall.c;
        if (!c || c.length < 4) continue;
        const dx = c[2] - c[0], dy = c[3] - c[1], l2 = dx * dx + dy * dy || 1;
        let t = ((at.x - c[0]) * dx + (at.y - c[1]) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(at.x - (c[0] + dx * t), at.y - (c[1] + dy * t));
        if (!nearestWall || d < nearestWall.distance) {
            nearestWall = { distance: d, angle: Math.round(Math.atan2(dy, dx) * 180 / Math.PI) };
        }
    }
    if (nearestWall) {
        report.wall = { distance: Math.round(nearestWall.distance * 10) / 10, angle: nearestWall.angle };
    }
}

/*
 * PRINTED FLAT AS WELL AS FOLDED. A console prints an object collapsed, and
 * the answer this exists to give is then one click away from the person who
 * needs it - which has now cost two round trips on the same question. The
 * lines below are the whole finding; the object is still returned for
 * anything that wants to read it.
 */
function printWhatIsHere(report, grid) {
    const lines = [
        `${MODULE_ID} | whatIsHere (${report.at.x}, ${report.at.y}) grid ${grid}`,
        `  drew it: ${report.found.join(", ")}`,
        `  room being outlined: ${report.room ?? "none"}`
    ];
    if (report.outline) {
        lines.push(`  outline: nearest chain ${report.outline.nearestChain}px away, `
            + `stroked ${report.outline.strokeWidth}px, that chain is `
            + `${report.outline.chainLength}px long over ${report.outline.chainPoints} points`
            + `${report.outline.covers ? " - THE POINT IS ON IT" : ""}`);
    }
    if (report.glow) {
        lines.push(`  glow: ${report.glow.inSprite
            ? `alpha ${report.glow.alpha}` : "outside the glow sprite"}`);
    }
    if (report.border) {
        lines.push(`  nearest border: ${report.border.room}, ${report.border.distance}px `
            + `(${report.border.inSquares} squares)`);
    }
    if (report.wall) lines.push(`  nearest wall: ${report.wall.distance}px, at ${report.wall.angle}°`);
    console.log(lines.join("\n"));
}

/**
 * WHAT DREW THIS PIXEL?
 *
 *     game.drpg.whatIsHere()          // wherever the cursor is
 *     game.drpg.whatIsHere(x, y)      // a scene coordinate
 *
 * Written after two wrong diagnoses of the same white strip on Dawid's map
 * (28.08). Both were reasoned from screenshots: first the doorway glow's flat
 * core, then a stub of room outline. Both were wrong, and both COULD have been
 * settled in a second by asking the canvas instead of asking me.
 *
 * The fog layer draws exactly three things over a floor, and they are told
 * apart by what they are made of rather than by how they look:
 *
 *   · the OUTLINE  - a stroked path, ink under bone, hard-edged
 *   · the GLOW     - a tinted sprite, soft, alpha well under 1
 *   · the RASTER   - the fog itself
 *
 * So it reads the drawn geometry for the outline (distance to every chain and
 * the width it was stroked with) and the actual texture pixel for the glow, and
 * reports both with the border and the walls nearby. Nothing is inferred: every
 * number below came off the thing that is on screen.
 *
 * @param {number} [x] Scene x. Defaults to the cursor.
 * @param {number} [y] Scene y.
 */
export function whatIsHere(x = null, y = null) {
    const at = (x === null || y === null) ? canvas?.mousePosition : { x, y };
    if (!at) {
        console.log(`${MODULE_ID} | whatIsHere: no point to look at.`);
        return null;
    }

    const grid = canvas?.grid?.size ?? 100;
    const report = { at: { x: Math.round(at.x), y: Math.round(at.y) }, grid, found: [] };

    /* ---- the outline: stroked chains, measured in scene units ------------- */
    const group = findNamed(canvas?.stage, "drpgRoomOutline");
    report.room = roomOutline?.room ?? null;
    nearestOutline(group, at, report);

    glowAlphaAt(group, at, report);

    /* ---- the map underneath, so the answer can be acted on ---------------- */
    const scene = canvas?.scene;
    if (scene) {
        nearestBorderTo(scene, at, grid, report);
        nearestWallTo(scene, at, report);
    }

    if (!report.found.length) report.found.push("nothing this module drew");

    printWhatIsHere(report, grid);


    return report;
}

/** The regions that are rooms, with their polygons; the nameless and the shapeless are reported and skipped. */
function namedRegions(scene, add) {
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
                "The region exists but its shape came back empty - nothing about this room "
                + "will be drawn.", pointOf(region));
            continue;
        }
        named.push({ region, polys: shapes.map(f => new PIXI.Polygon(f)) });
    }
    return named;
}

/* ---- 1. overlapping rooms - the first cause on the list --------------- */
/*
 * WITH A MARGIN, IN BOTH DIRECTIONS - and the margins are the engine's own,
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
function overlapCheck(named, grid, add) {
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
}

/*
 * 2. BORDER DRAWN AWAY FROM ITS WALLS.
 *
 * Asked with the SAME predicate the doorway test uses, and that is the
 * point: a validator measuring something slightly different can pass a
 * scene whose glow still misbehaves.
 *
 * Measured as the longest CONTIGUOUS stretch, never as a total. Every
 * room has border with no wall on it - that is what a doorway is - so a
 * total flags every room on every map and says nothing. See
 * ADRIFT_WARN_RUN for where the threshold comes from.
 */
function adriftCheck(region, edges, walls, grid, add) {
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
            if (wallAlongEdge(mx, my, ex, ey, walls, grid * DOORWAY_WALL_NEAR, edge.trend)) {
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
            + "way a whole side of a room turns into a doorway - the wall is never found, so "
            + "nothing closes it.", adriftAt);
    }
}

/*
 * 3. A ROOM WITH NO WAY OUT AT ALL.
 *
 * Found by walking every room on the QA scene rather than by reading
 * the code: one of them reported not a single open stretch, and the
 * reason was neither a wall nor an overlap - its region simply sits a
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
function noWayOutCheck(scene, region, edges, grid, add) {
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
                : "No neighbouring room lies within reach of any part of this border - the "
                  + "next region is more than a square away, so the two rooms never see each "
                  + "other. Rooms should touch along the edge they share.",
            pointOf(region));
    }
}

/*
 * 4. CORNERS OFF THE LATTICE - and the lattice is HALF a square.
 *
 * Foundry's region tools snap to half-grid, so a room drawn correctly
 * has most of its corners on a half-square line and almost none on a
 * whole one. Measured against whole squares this check fired on every
 * room on the scene, which is a check that has learnt to cry wolf.
 */
function latticeCheck(region, polys, lattice, latticeOrigin, add) {
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

/**
 * Check every room on this scene against the rules the fog layer depends on.
 *
 *     game.drpg.checkRegions()
 *
 * THE MAP IS DATA, AND DATA GETS VALIDATED. Every symptom this stage was built
 * to fix - a corridor glowing along its whole length, a white bar across open
 * floor, a doorway with no door - traces back to region geometry rather than to
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

    const named = namedRegions(scene, add);

    /*
     * WHERE THE LATTICE ACTUALLY IS, read off the map rather than assumed.
     *
     * `canvas.dimensions.sceneX` is NOT it: on this project's own scene it is
     * 641 against a grid of 20, so measuring from there puts every corner four
     * pixels out and the check fires on all eighteen rooms - a check that has
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

    overlapCheck(named, grid, add);

    /* ---- 2..4 - per room, measured off the same edges the fog uses -------- */
    for (const { region, polys } of named) {
        const edges = doorwayEdges(region);

        adriftCheck(region, edges, walls, grid, add);
        noWayOutCheck(scene, region, edges, grid, add);

        // 3. (there is no check on how LONG an opening is. A doorway has no
        //     upper size - see ADRIFT_WARN_RUN. A border that has wandered off
        //     its wall is caught above, which is the fault that check was
        //     standing in for.)

        latticeCheck(region, polys, lattice, latticeOrigin, add);
    }

    const order = { error: 0, warning: 1, info: 2 };
    findings.sort((a, b) => order[a.level] - order[b.level]);

    const counts = findings.reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] ?? 0) + 1 }), {});
    console.log(`${MODULE_ID} | region check on "${scene.name}" - ${named.length} named room(s), `
        + `${walls.length} wall(s): ${counts.error ?? 0} error(s), ${counts.warning ?? 0} warning(s), `
        + `${counts.info ?? 0} note(s).`);
    if (findings.length) console.table(findings);
    else console.log(`${MODULE_ID} | region check: nothing to report - the rooms on this scene are clean.`);
    return findings;
}

/** A point to steer somebody at: the middle of the region's own box. */
function pointOf(region) {
    const b = boundsOf(region);
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
        // The narrow side of what the two rooms share - see the note at the
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
    // No clipper, so no honest depth - `null` reads as "cannot tell", and the
    // caller reports rather than swallowing it. Better a question than a miss.
    return { area: cells * step * step, depth: null };
}

/* ==========================================================================
 * THE GM'S OWN WARNING - how much of the scene belongs to no room at all
 * ========================================================================== */

/**
 * Percentage of the scene's own rect NOT covered by any Region's polygons.
 * A simple sum of areas, not a true union - two overlapping rooms would be
 * counted twice - which only ever makes the number an over-estimate of the
 * covered fraction, i.e. an UNDER-estimate of how much is missing. Good
 * enough for a warning line computed once when a GM opens a management
 * window; not something to spend a polygon-boolean library on.
 */
export function sceneUncoveredPercent(scene = canvas?.scene) {
    if (!scene) return 0;
    // THE SCENE'S OWN dimensions, not the canvas's. This used to measure
    // whichever scene was on screen, so asking about any other one compared its
    // regions against a rectangle belonging to somewhere else - which is
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
