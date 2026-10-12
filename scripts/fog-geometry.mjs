/**
 * Danganronpa RPG - the fog's shape math.
 * ---------------------------------------------------------------------------
 * Pure geometry over a region's outline and over flat point lists: a region's
 * real shape in the layer's space (`regionShapes`, traced by
 * `traceRegionPathsAt`), a polyline's length, resampling, smoothing and trimming,
 * a point's distance to a segment, whether a point lies inside polygons, a
 * polygon's area, and `clamp01`. Each takes what it reads as arguments and
 * returns numbers or points; the one that draws, `traceRegionPathsAt`, draws
 * only onto the Graphics it is handed. What it does not hold: anything that
 * knows about doorways, the fog's layer, the ledger, a room's reveal or the map's
 * checks (fog-doorways.mjs, fog.mjs, fog-reveal.mjs and fog-diagnostics.mjs).
 *
 * WHERE IT SITS. Moved out of fog.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. It is the bottom of the fog's
 * family: it imports nothing and holds no state. Above it are fog-doorways.mjs,
 * whose openings and glow resample, smooth and trim the border here, and fog.mjs,
 * fog-reveal.mjs and fog-diagnostics.mjs, whose layer, reveal and map checks
 * trace and measure regions with it. Ten names are exported that were not,
 * because those files read them; fog.mjs exported
 * none of them before and re-exports none, so the module's API is the one it was.
 * `flattenPoints` and `ellipsePoints` are read only by `regionShapes` and stay
 * private. `piecesAsOne` (E12 C2b) hands the drawing code a room of several
 * regions as one shape; it is handed the pieces, and still imports nothing.
 */

/**
 * Trace a region's real shape onto a Graphics - `RegionDocument#polygons`
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
export function traceRegionPathsAt(graphics, region, rect) {
    const shapes = regionShapes(region, rect);
    for (const points of shapes) graphics.drawPolygon(points);
    return shapes.length > 0;
}

/**
 * Every one of a region's shapes, as flat `[x, y, x, y, …]` arrays already
 * shifted into the layer's coordinate space.
 *
 * ONE READER FOR BOTH CALLERS - the fills and the holes - so the fog and the
 * gaps cut out of it can never be computed from different geometry.
 *
 * The point format is the part worth being careful about. `RegionDocument
 * #polygons` is documented as `PIXI.Polygon[]`, whose `points` is flat
 * numbers, but the same field has been seen carrying a bare flat array, and
 * an array of `{x, y}` objects. Subtracting a number from an object gives
 * `NaN`, and a polygon full of NaN does not throw - PIXI draws nonsense, which
 * is indistinguishable on screen from "the wrong rooms were chosen". So the
 * shape of the input is checked rather than assumed, and anything that cannot
 * be read as coordinates is dropped instead of drawn.
 */
export function regionShapes(region, rect) {
    const out = [];

    // `polygonTree` FIRST, and holes skipped.
    //
    // `RegionDocument#polygons` is an alias for `polygonTree.polygons`, and
    // that iterator walks the WHOLE tree - hole nodes included, flattened in
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

    // No computed polygons on this scene state - fall back to the raw shape
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

/**
 * A room of several pieces as one shape for the code that draws it (E12 C2b, 11.10.2026;
 * plan-E12 3.1, audit S07-05). A room is a name on a scene and may be drawn as any number of
 * regions (rooms.mjs `roomRegions`); the outline, the reveal, the doorway glow and the map's
 * checks each read ONE region - its `polygons` through `regionShapes`, its box through
 * movement.mjs `boundsOf`, its `name`, its scene through `parent` - and until 1.2.74 they were
 * handed the first region of the name, so a room in two pieces was outlined and revealed round
 * one of them. The pieces' shapes are read here once, holes left out as `regionShapes` leaves
 * them, and handed on as a `polygons` list in scene space, the shape both of those readers take
 * before the raw `shapes`; one piece is handed back as the region it is, so a room of one
 * piece is drawn exactly as before. The pieces are not merged into one polygon here: where two
 * of them touch or overlap, each keeps its own border, and the stretches of it that run with the
 * room on both sides - the line two pieces share, a piece's edge across the other's floor - are
 * found by `innerStretches` and left undrawn by the outline, its halo and the doorway glow
 * (fog-doorways.mjs `doorwayEdges`). Until E12 fix r1-G5 (review EARLY-C2b-1) they were drawn,
 * across the floor, once per piece.
 */
export function piecesAsOne(pieces) {
    if (!pieces?.length) return null;
    if (pieces.length === 1) return pieces[0];
    const polygons = pieces.flatMap(piece => regionShapes(piece, { x: 0, y: 0 }));
    return { name: pieces[0].name, id: pieces[0].id, parent: pieces[0].parent, pieces, polygons };
}

/**
 * The piece of a room handed as one (`piecesAsOne`) with the largest area, or the region itself
 * when it is one piece. The room's name is drawn there (fog-reveal.mjs `labelPoint`): the centre
 * of every piece's box together can lie in none of them (review EARLY-C2b-2).
 */
export function largestPiece(region) {
    if (!region?.pieces?.length) return region ?? null;
    const area = piece => regionShapes(piece, { x: 0, y: 0 }).reduce((sum, flat) => sum + polygonArea(flat), 0);
    return region.pieces.reduce((best, piece) => (area(piece) > area(best) ? piece : best));
}

/** Whether a point lies inside a flat ring `[x,y,…]`, by the crossings of a ray (even-odd, as PIXI's own test). */
function inRing(flat, x, y) {
    let inside = false;
    for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
        const xi = flat[i], yi = flat[i + 1], xj = flat[j], yj = flat[j + 1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/**
 * The stretches of the edge from (ax, ay) along (dx, dy) that run with the room on both sides, as
 * `[from, to]` fractions of the edge, given the room's rings (flat, scene space; `regionShapes`).
 * The edge is cut wherever any ring's border crosses it or runs along it, and each cut piece is
 * inner when the points two pixels either side of its middle both lie in some ring. A ring
 * alone has no such stretch, so a room of one shape is answered `[]` without a look (E12 fix
 * r1-G5, 11.10.2026; review EARLY-C2b-1). Written without PIXI so it gives the same answer on the
 * harness, whose `PIXI.Polygon` contains no point.
 */
export function innerStretches(rings, ax, ay, dx, dy) {
    if (!(rings?.length > 1)) return [];
    const length = Math.hypot(dx, dy);
    if (length < 1) return [];
    const nx = -dy / length, ny = dx / length, sq = length * length;
    const cuts = [0, 1];
    for (const flat of rings) {
        for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
            const px = flat[j], py = flat[j + 1], ex = flat[i] - px, ey = flat[i + 1] - py;
            const denom = dx * ey - dy * ex;
            if (Math.abs(denom) < 1e-9) {
                // Parallel: along this edge's own line, its ends cut it.
                if (Math.abs((px - ax) * nx + (py - ay) * ny) > 0.5) continue;
                cuts.push(((px - ax) * dx + (py - ay) * dy) / sq, ((px + ex - ax) * dx + (py + ey - ay) * dy) / sq);
                continue;
            }
            const t = ((px - ax) * ey - (py - ay) * ex) / denom;
            const u = ((px - ax) * dy - (py - ay) * dx) / denom;
            if (u >= 0 && u <= 1) cuts.push(t);
        }
    }
    const ts = [...new Set(cuts.filter(t => t >= 0 && t <= 1))].sort((a, b) => a - b);
    const inside = (x, y) => rings.some(flat => inRing(flat, x, y));
    const out = [];
    for (let k = 1; k < ts.length; k++) {
        const a = ts[k - 1], b = ts[k];
        if ((b - a) * length < 1) continue;
        const mx = ax + dx * (a + b) / 2, my = ay + dy * (a + b) / 2;
        if (!inside(mx + nx * 2, my + ny * 2) || !inside(mx - nx * 2, my - ny * 2)) continue;
        if (out.length && Math.abs(out.at(-1)[1] - a) * length < 1) out.at(-1)[1] = b;
        else out.push([a, b]);
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

export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The run of a polyline, point to point. Four copies of this loop lived in fog.mjs. */
export function polylineLength(points) {
    let run = 0;
    for (let i = 1; i < points.length; i++) {
        run += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return run;
}

/** Distance from a point to a line SEGMENT, not to the infinite line. */
export function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/** Is this point inside that region? Polygons are passed in already built. */
export function inPolygons(polygons, x, y) {
    for (const poly of polygons) if (poly.contains(x, y)) return true;
    return false;
}

/**
 * The same question of the flat `[x0, y0, x1, y1, ...]` lists `regionShapes` hands back, by the
 * even-odd rule, so it is asked without PIXI (E12 C13, 11.10.2026: a door control's sides, fog.mjs
 * `doorShownTo`). The harness's `PIXI.Polygon#contains` answers false for every point, so
 * `inPolygons` cannot be read there; this can.
 */
export function inFlatPolygons(polygons, x, y) {
    for (const flat of polygons ?? []) {
        let inside = false;
        for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
            const xi = flat[i], yi = flat[i + 1], xj = flat[j], yj = flat[j + 1];
            if ((yi > y) !== (yj > y) && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
        }
        if (inside) return true;
    }
    return false;
}

/**
 * A polyline resampled at a fixed step, so the smoothing that follows sees
 * evenly spaced points rather than whatever spacing the map was drawn with.
 */
export function resamplePolyline(points, step) {
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
 * A polyline with the grid out of it - a moving average over `half` samples
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
 * chosen corners sit badly the line cuts visibly across the real geometry -
 * which is exactly what it did. A moving average moves every point by at most
 * the local wobble, so a staircase flattens onto its own mean while a genuine
 * corner merely softens by a fraction of a square.
 *
 * THE ENDS FOLLOW THE LOCAL TREND. A window that simply closes up as it runs
 * out of samples is anchored on the last one - and the last one is a corner of
 * the tiled border, up to an amplitude off the line it belongs to. The line
 * then bends out to meet it and the band bends with it: measured on a
 * staircase, the glow reached 34.6px from the mean at that end against 31.1px
 * everywhere else, which is the soft kick in an otherwise straight edge. So
 * the first and last few points are taken from a straight fit through the
 * stretch around them, faded into the ordinary average over the same distance
 * so the two meet without a step.
 */
export function smoothPolyline(points, half) {
    const n = points.length;
    if (n < 3 || half < 1) return points;

    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        const w = Math.min(half, i, n - 1 - i);
        let sx = 0, sy = 0;
        for (let k = i - w; k <= i + w; k++) { sx += points[k].x; sy += points[k].y; }
        out[i] = { x: sx / (2 * w + 1), y: sy / (2 * w + 1) };
    }

    // Least squares against distance from the end, over twice the window -
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
 * pixel of remaining length - a one-square doorway trimmed to nothing would
 * light nothing at all.
 */
export function trimPolyline(points, cut) {
    const total = polylineLength(points);
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

export function polygonArea(flat) {
    let area = 0;
    for (let i = 0; i < flat.length; i += 2) {
        const x1 = flat[i], y1 = flat[i + 1];
        const j = (i + 2) % flat.length;
        const x2 = flat[j], y2 = flat[j + 1];
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
}
