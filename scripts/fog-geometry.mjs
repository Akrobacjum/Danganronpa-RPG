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
 * knows about doorways, the fog's layer, the ledger or a room's reveal
 * (fog-doorways.mjs and fog.mjs).
 *
 * WHERE IT SITS. Moved out of fog.mjs by E34 (1.2.70), a pure move that
 * `node tools/moved-only.mjs` proves line by line. It is the bottom of the fog's
 * family: it imports nothing and holds no state. Above it are fog-doorways.mjs,
 * whose openings and glow resample, smooth and trim the border here, and fog.mjs,
 * whose layer, reveal and map checks trace and measure regions with it. Ten names
 * are exported that were not, because those two files read them; fog.mjs exported
 * none of them before and re-exports none, so the module's API is the one it was.
 * `flattenPoints` and `ellipsePoints` are read only by `regionShapes` and stay
 * private.
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

/** The run of a polyline, point to point. Four copies of this loop lived in this file. */
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
