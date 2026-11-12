/**
 * THE CURTAIN CLOSING BY ITS EDGES (E61 C3, rebuilt 12.11.2026 on the owner's review of the round-1 page:
 * "zasłonięcie ekranu kurtyną ... poprzez przesuwanie się krawędzi kafelków w kierunku prostopadłym do krawędzi. Kafle
 * kurtyny nigdy nie powinny na siebie nachodzić, ale mają prawo podbierać sobie nawzajem miejsce").
 * ---------------------------------------------------------------------------
 * The panes of the cut stand around a hole - the map shows through it. The curtain closes by moving every edge of a pane
 * that faces the hole along its own normal, into the hole, all at one speed, until the hole is gone. Each pane takes the
 * part of the hole nearest its edges, so no two panes ever cover one point, and a pane takes the room a neighbour's
 * front does not reach first. Edges between panes never move: where two panes' fronts meet, the seam between them
 * grows along the line of points equally far from both.
 *
 * Pure, no imports: `holeOf` reads the hole off the panes (the part of the screen no pane covers, as one loop of the
 * panes' own edge pieces), `holeField` measures each point of the hole once, `paintClosing` paints a frame. What it
 * does not do: a rim the panes leave as more than one loop closes the largest one (none in any cut read here: the
 * glass harness at 1600x900, 1366x768, 1280x800, 1920x1080); the sequence lays the glass's ink under the panes, so
 * such a gap would show the map through it (round 2 draws no ink under the panes).
 */

const EPS = 1e-9;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const len = a => Math.hypot(a[0], a[1]);

/** Twice the signed area of a polygon (positive for the screen's clockwise order, y down). */
export function signedArea2(poly) {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return s;
}

/** Whether (x, y) is inside the polygon (even-odd). */
export function insidePoly(poly, x, y) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

/**
 * The hole the panes leave on a W x H screen, as one loop of edge pieces `{ a, b, owner }` in order, each piece running
 * against its pane's own order, so the hole is on its right as seen on the screen (y down): every pane edge is cut at the other panes'
 * corners that stand on it, and a piece borders the hole when the point just outside its middle is on the screen and
 * in no pane. Null when no hole is left (a stacked layout, or a cut with none).
 */
export function holeOf(panes, W, H) {
  const polys = panes.map(p => (signedArea2(p.poly) < 0 ? [...p.poly].reverse() : p.poly));
  const corners = polys.flat();
  const inScreen = (x, y) => x > 0.5 && y > 0.5 && x < W - 0.5 && y < H - 0.5;
  const pieces = [];
  polys.forEach((poly, owner) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], d = sub(b, a), L = len(d);
      if (L < 0.5) continue;
      const u = mul(d, 1 / L);
      // the other panes' corners on this edge cut it into pieces
      const ts = [0, 1];
      for (const c of corners) {
        const t = dot(sub(c, a), u) / L;
        if (t > 0.001 && t < 0.999 && Math.abs(cross(u, sub(c, a))) < 0.75) ts.push(t);
      }
      ts.sort((x, y) => x - y);
      for (let k = 0; k + 1 < ts.length; k++) {
        if ((ts[k + 1] - ts[k]) * L < 0.5) continue;
        const p = add(a, mul(d, ts[k])), q = add(a, mul(d, ts[k + 1])), m = mul(add(p, q), 0.5);
        // clockwise on screen (y down) puts the pane's inside on the right of a -> b; the hole side is the left
        const left = [u[1], -u[0]];
        const out = add(m, mul(left, 1.5));
        if (!inScreen(out[0], out[1]) || polys.some(pl => insidePoly(pl, out[0], out[1]))) continue;
        pieces.push({ a: q, b: p, owner });
      }
    }
  });
  if (!pieces.length) return null;
  // chain the pieces end to start; a piece's start is matched to the nearest end within a pixel
  const loops = [], used = new Set();
  for (let s = 0; s < pieces.length; s++) {
    if (used.has(s)) continue;
    const loop = [];
    let cur = s;
    while (cur !== -1 && !used.has(cur)) {
      used.add(cur); loop.push(pieces[cur]);
      const end = pieces[cur].b;
      let next = -1, best = 1.01;
      pieces.forEach((pc, k) => { if (used.has(k) && k !== s) return; const dd = len(sub(pc.a, end)); if (dd < best) { best = dd; next = k; } });
      cur = next === s ? -1 : next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  if (!loops.length) return null;
  const area = loop => Math.abs(signedArea2(loop.map(e => e.a))) / 2;
  loops.sort((x, y) => area(y) - area(x));
  return { edges: loops[0], loops: loops.length, area: area(loops[0]) };
}

/*
 * THE FRONTS AS A DISTANCE (rebuilt the same day). The first build ran the hole's straight skeleton as events, and on
 * the glass harness's real cuts the hole has reflex corners - where a pane juts into it - whose split events it did not
 * handle: at 1600x900 a grid of 2304 points read 651 points under two panes at once at the close, at 1366x768 the run
 * stopped after two events with 784 points open. So the fronts are read as what they are: a point of the hole is the
 * pane edge's nearest to it, and it is covered once that edge's front, moving at one speed along its normal, reaches it
 * - at the offset equal to its distance. Each point has one nearest edge, so no point is ever two panes'; every point
 * of the hole is covered at the largest distance; a front is the edge's own line moved along its normal, rounded only
 * where it wraps a pane's jutting corner. `holeField` measures it once on a grid (`scale` px a cell), `paintClosing`
 * colours a frame from it in one pass.
 */

/**
 * The closing's field on a W x H screen at `scale` px a cell, from `hole` (`holeOf`): per cell the nearest edge's
 * pane (`owner`, -1 outside the hole), its distance (`dist`), how far the next pane's edge stands beyond it (`apart`,
 * the seam between two panes), the point the cell mirrors into its pane across that edge (`mx`, `my`, the glass a
 * pane carries into the hole), and the largest distance (`reach`): the offset at which the hole is closed.
 */
export function holeField(hole, W, H, scale = 2) {
  const segs = hole.edges, S = segs.length;
  const w = Math.ceil(W / scale), h = Math.ceil(H / scale), N = w * h;
  const owner = new Int16Array(N).fill(-1), dist = new Float32Array(N), apart = new Float32Array(N), mx = new Float32Array(N), my = new Float32Array(N);
  // the segments flat, and each one's pane as a small index, for one pass a cell (squared distances, one root each)
  const ax = new Float64Array(S), ay = new Float64Array(S), dx = new Float64Array(S), dy = new Float64Array(S), il = new Float64Array(S), own = new Int32Array(S);
  const owners = [...new Set(segs.map(e => e.owner))], slot = new Map(owners.map((o, i) => [o, i]));
  segs.forEach((e, q) => { ax[q] = e.a[0]; ay[q] = e.a[1]; dx[q] = e.b[0] - e.a[0]; dy[q] = e.b[1] - e.a[1]; const L2 = dx[q] * dx[q] + dy[q] * dy[q]; il[q] = L2 ? 1 / L2 : 0; own[q] = slot.get(e.owner); });
  const per = new Float64Array(owners.length);
  const loop = segs.map(e => e.a);
  let reach = 0;
  const xs = [];
  for (let j = 0; j < h; j++) {
    const y = (j + 0.5) * scale;
    // the row's crossings of the hole's rim, once a row: a cell is in the hole between an odd and an even crossing
    xs.length = 0;
    for (let q = 0, r = loop.length - 1; q < loop.length; r = q++) {
      const [x1, y1] = loop[r], [x2, y2] = loop[q];
      if ((y1 > y) !== (y2 > y)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    xs.sort((p1, p2) => p1 - p2);
    for (let i = 0, c = 0; i < w; i++) {
      const x = (i + 0.5) * scale, k = j * w + i;
      while (c < xs.length && xs[c] <= x) c++;
      if (!(c & 1)) continue;
      per.fill(Infinity);
      let best = Infinity, bi = 0, fx = 0, fy = 0;
      for (let q = 0; q < S; q++) {
        let t = ((x - ax[q]) * dx[q] + (y - ay[q]) * dy[q]) * il[q];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax[q] + dx[q] * t, py = ay[q] + dy[q] * t, ex = x - px, ey = y - py, d2 = ex * ex + ey * ey;
        if (d2 < per[own[q]]) per[own[q]] = d2;
        if (d2 < best) { best = d2; bi = q; fx = px; fy = py; }
      }
      let other = Infinity;
      for (let o = 0; o < per.length; o++) if (o !== own[bi] && per[o] < other) other = per[o];
      const d = Math.sqrt(best);
      owner[k] = owners[own[bi]]; dist[k] = d; apart[k] = Math.sqrt(other) - d; mx[k] = 2 * fx - x; my[k] = 2 * fy - y;
      if (dist[k] > reach) reach = dist[k];
    }
  }
  return { w, h, scale, owner, dist, apart, mx, my, reach };
}

/**
 * One frame of the closing into `rgba` (the field's w x h, 4 bytes a cell): every cell whose distance is within `t`
 * takes its colour - `tex(k)`, the glass it carries, an [r, g, b] - with the ink of a seam where two panes' fronts meet
 * or along the moving front, and every other cell is clear. Answers how many cells it covered.
 */
export function paintClosing(field, rgba, t, tex, { ink = [7, 7, 10], seam = 1.4 } = {}) {
  const { owner, dist, apart } = field, sw = seam / field.scale * field.scale;
  let covered = 0;
  for (let k = 0, o = 0; k < owner.length; k++, o += 4) {
    if (owner[k] < 0 || dist[k] > t) { rgba[o + 3] = 0; continue; }
    covered++;
    const edge = apart[k] < sw || t - dist[k] < sw;
    const c = edge ? ink : tex(k);
    rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
  }
  return covered;
}

/**
 * The closing's measures (R3703, R3716), read off a field at the offsets `ts` (fractions of its reach): per offset the
 * hole's cells covered and still open; the cells of any pane's own polygon the field covers (a front never enters a
 * pane: 0); and the most a covered cell's offset differs from its distance to its own edge's line where its nearest
 * point is inside that edge - a front that moves along its normal covers a point at exactly that distance.
 */
function nearPolyEdge(poly, x, y, m) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], d = sub(poly[i], a), L2 = dot(d, d), t = L2 ? Math.max(0, Math.min(1, dot(sub([x, y], a), d) / L2)) : 0;
    if (len(sub([x, y], add(a, mul(d, t)))) < m) return true;
  }
  return false;
}

/**
 * What the tests read of a field (R3703, R3716): the cells of the hole, how many each offset of `ts` (shares of the
 * reach) leaves open, the cells inside a standing pane (`inPane`, which must be 0: a front never covers a pane), and the
 * cells covered at a distance other than their own pane's (`offNormal`, 0: every front moves along its normals).
 */
export function fieldReading(field, hole, panes, ts = [0, 0.25, 0.5, 0.75, 1]) {
  const { w, h, scale, owner, dist } = field;
  const cells = owner.reduce((n, o) => n + (o >= 0 ? 1 : 0), 0);
  const per = ts.map(f => { let c = 0; for (let k = 0; k < owner.length; k++) if (owner[k] >= 0 && dist[k] <= f * field.reach + 1e-6) c++; return { f, covered: c, open: cells - c }; });
  let inPane = 0, offNormal = 0, checked = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    if (owner[k] < 0) continue;
    const x = (i + 0.5) * scale, y = (j + 0.5) * scale;
    if (panes.some(p => insidePoly(p.poly, x, y) && !nearPolyEdge(p.poly, x, y, scale))) inPane++;
    // the cell's distance from its own pane's edge pieces, measured here apart from the field's own reading: the
    // front reaches it at that distance or it is off its normal. `checked` counts the cells whose nearest foot falls
    // inside an edge, not at a corner, where the front is the edge itself moved along its normal
    let near = Infinity, inside = false;
    for (const e of hole.edges) {
      if (e.owner !== owner[k]) continue;
      const d = sub(e.b, e.a), L2 = dot(d, d), u = L2 ? dot(sub([x, y], e.a), d) / L2 : 0, t = Math.max(0, Math.min(1, u));
      const gap = len(sub([x, y], add(e.a, mul(d, t))));
      if (gap < near - 1e-9) { near = gap; inside = u > 0.02 && u < 0.98; }
    }
    if (inside) checked++;
    if (!(Math.abs(near - dist[k]) <= 0.5)) offNormal++;
  }
  return { cells, per, inPane, checked, offNormal, reach: +field.reach.toFixed(1) };
}
