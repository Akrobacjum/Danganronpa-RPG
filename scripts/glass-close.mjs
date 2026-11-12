/**
 * THE CURTAIN CLOSING BY NEW PANES (E61 C3, round 3, 12.11.2026, on the owner's review of round 2: "Animacja kurtyny
 * dalej wygląda brzydko; nowo pojawiające się kawałki szkła nie są spójne rozmiarem, wyglądem ani kształtem z tymi,
 * które już istnieją").
 * ---------------------------------------------------------------------------
 * Round 2 gave every point of the hole to its nearest standing pane, which made regions of another kind: curved
 * fronts, seams instead of lead, sizes unlike the rest. Round 3 closes the hole with panes of the curtain's own kind:
 *
 * - `fillHole` tiles the hole the standing panes leave with convex panes of three to five corners, cut by straight
 *   lines as the curtain's cut is (glass.mjs `split`, the same half-plane clip): the hole is cut into convex pieces
 *   along the standing panes' own edges, pieces are joined where the join is still a convex pane of at most five
 *   corners, and a piece larger than the standing panes' median area is split by a straight cut across its length.
 *   The standing panes keep their exact place and shape; the new ones fill what is left, and nothing else.
 * - `slidePlan` and `slideAt` (round 4, below): a new pane keeps its size and slides out from behind an edge it shares
 *   with glass already there, drawn only inside its own place (`visibleAt`), so no two panes overlap at any frame.
 * - `tilingReading` is what the tests read: every point of the screen in exactly one pane, and the new panes' areas,
 *   corners and angles against the standing panes'.
 *
 * Pure, no imports, no DOM.
 */

const EPS = 0.004;
/** The screen the new panes' size is read at (E61 round 5): at it and below, the standing panes' middle area; above it, that grown with the screen's area. */
export const REFERENCE_SCREEN = [1366, 768];
/* above it, a grid cell's area over the target, and the target over the standing panes' middle grown with the screen:
   read on the harness's cuts at 1440x900, 1600x900, 1920x1080 and 2560x1440, eight seeds each (12.11.2026), as the pair
   that keeps the new panes' median share of the screen within a tenth of 1366x768's (R3719) */
const GRID_CELL = 1.2, LIFT = 1.6;
const area = poly => Math.abs(poly.reduce((s, q, i) => { const r = poly[(i + 1) % poly.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
const centroid = poly => { const n = poly.length; return [poly.reduce((s, q) => s + q[0], 0) / n, poly.reduce((s, q) => s + q[1], 0) / n]; };
/* two corners closer than a hundredth of a pixel are one (at half a pixel, a join dropped a real corner and opened a sliver, round 5) */
const dedupe = poly => poly.filter((q, i) => { const p = poly[(i + poly.length - 1) % poly.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.01; });

/** A convex polygon split by the line through (px, py) with normal (nx, ny): [side >= 0, side < 0] (glass.mjs `split`). */
export function splitPoly(poly, px, py, nx, ny) {
  const A = [], B = [];
  const side = ([x, y]) => (x - px) * nx + (y - py) * ny;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    if (Math.abs(sp) < EPS) { A.push(p); B.push(p); continue; }
    (sp > 0 ? A : B).push(p);
    if (Math.abs(sq) >= EPS && (sp > 0) !== (sq > 0)) {
      const t = Math.min(1, Math.max(0, sp / (sp - sq)));
      const m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      A.push(m); B.push(m);
    }
  }
  return [A, B].map(p => { p = dedupe(p); return p.length >= 3 && area(p) > 0.25 ? p : null; });
}


/** Separating axes on convex polygons; a shared edge is not an overlap (glass.mjs `overlaps`). */
export function convexOverlap(A, B) {
  const axes = P => P.map((p, i) => { const q = P[(i + 1) % P.length]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l]; });
  const ext = (P, ax) => { let a0 = 1e9, a1 = -1e9; for (const p of P) { const d = p[0] * ax[0] + p[1] * ax[1]; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } return [a0, a1]; };
  for (const ax of [...axes(A), ...axes(B)]) { const [a0, a1] = ext(A, ax), [b0, b1] = ext(B, ax); if (a1 <= b0 + 0.5 || b1 <= a0 + 0.5) return false; }
  return true;
}

/** The convex hull of points, counter-clockwise in screen terms, with no three corners on a line. */
export function hull(points) {
  const P = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-6 * Math.max(1, Math.hypot(p[0], p[1]))) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-6 * Math.max(1, Math.hypot(p[0], p[1]))) up.pop(); up.push(p); }
  return simplify(dedupe([...lo.slice(0, -1), ...up.slice(0, -1)]));
}

/* corners on a straight run (within a fiftieth of a pixel of the line through their neighbours, so no gap opens beside them) taken out */
function simplify(poly) {
  let P = poly;
  for (let changed = true; changed && P.length > 3;) {
    changed = false;
    for (let i = 0; i < P.length; i++) {
      const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      if (Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / L < 0.02) { P = P.filter((_, k) => k !== i); changed = true; break; }
    }
  }
  return P;
}

/** The smallest inner angle of a convex polygon, in degrees. */
export function minAngle(P) {
  return Math.min(...P.map((q, i) => {
    const a = P[(i + P.length - 1) % P.length], c = P[(i + 1) % P.length], u = [a[0] - q[0], a[1] - q[1]], v = [c[0] - q[0], c[1] - q[1]];
    return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1)))) * 180 / Math.PI;
  }));
}

/** The narrowest width of a convex polygon: its extent across each edge's normal, the least of them. */
export function thickness(P) {
  let least = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-9) continue;
    const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
    let lo = Infinity, hi = -Infinity;
    for (const q of P) { const d = q[0] * nx + q[1] * ny; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    least = Math.min(least, hi - lo);
  }
  return least;
}

/** How long a polygon is for its width: its longest span between corners over its narrowest width. */
export function slender(P) {
  let far = 0;
  for (const a of P) for (const b of P) far = Math.max(far, Math.hypot(b[0] - a[0], b[1] - a[1]));
  return far / Math.max(1e-9, thickness(P));
}

/* the outward normal of each edge of a convex polygon, with a point on it */
function edgesOut(P) {
  const [cx, cy] = centroid(P);
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if ((cx - a[0]) * nx + (cy - a[1]) * ny > 0) { nx = -nx; ny = -ny; }
    return { a, nx, ny };
  });
}

/* the screen less the standing panes, as convex pieces cut along the panes' own edges */
function holePieces(panes, W, H) {
  let pieces = [[[0, 0], [W, 0], [W, H], [0, H]]];
  for (const s of panes) {
    const S = s.poly, out = [];
    for (const C of pieces) {
      if (!convexOverlap(C, S)) { out.push(C); continue; }
      let rest = C;
      for (const { a, nx, ny } of edgesOut(S)) {
        const [outside, inner] = splitPoly(rest, a[0], a[1], nx, ny);
        if (outside) out.push(outside);
        rest = inner;
        if (!rest) break;
      }
    }
    pieces = out;
  }
  return pieces.filter(p => area(p) > 0.5);
}

/* two pieces joined when their join is one convex polygon (its hull holds no more than the two) */
function joined(A, B) {
  const H = hull([...A, ...B]);
  return Math.abs(area(H) - area(A) - area(B)) <= 1 ? H : null;
}

/** What the new panes are measured against: the standing panes' areas, corners and smallest angles. */
export function paneRange(panes) {
  const areas = panes.map(p => area(p.poly)).sort((a, b) => a - b);
  return {
    area: [areas[0], areas[Math.floor(areas.length / 2)], areas[areas.length - 1]],
    corners: [Math.min(...panes.map(p => simplify(p.poly).length)), Math.max(...panes.map(p => simplify(p.poly).length))],
    angle: Math.min(...panes.map(p => minAngle(simplify(p.poly)))),
    width: Math.min(...panes.map(p => thickness(p.poly))),
    slender: Math.max(...panes.map(p => slender(p.poly)))
  };
}

/**
 * The hole the standing `panes` leave on a W x H screen, tiled with new convex panes. `rnd` is the seed's stream (the
 * curtain's own, so a screen's fill is the same every time). Answers [{ poly }].
 */
export function fillHole(panes, W, H, rnd = Math.random) {
  const range = paneRange(panes);
  // the standing cut is built of fixed pixel sizes, so its middle area is about the same at every size; the new panes'
  // is the standing middle at 1366x768 and grows with the screen above it, so they keep 1366x768's share of the screen
  // (the owner accepted round 4 at 1366x768 and found its panes small and narrow at 1920x1080; R3719)
  const grow = Math.max(1, (W * H) / (REFERENCE_SCREEN[0] * REFERENCE_SCREEN[1]));
  const target = range.area[1] * grow * (grow > 1 ? LIFT : 1), most = Math.min(grow > 1 ? Math.max(target * GRID_CELL * 1.3, target * 1.5) : target * 1.5, range.area[2]), minCorners = range.corners[0], maxCorners = range.corners[1];
  const fits = P => P.length >= minCorners && P.length <= maxCorners;
  // a crack: a run narrower than any standing pane between two of them, and long for it (a notch's chip is not one)
  const crack = P => thickness(P) < Math.max(range.width, 24) && slender(P) > 3;
  // above 1366x768 a recut of two pieces is kept only when its two parts hold the two pieces' area to half a pixel - a
  // split drops a side under a quarter of a pixel, and what it drops is a gap; at and below 1366x768 round 4's rule,
  // kept as the owner accepted it (R3719 holds 1366x768's fill)
  const cut2 = splitPoly;
  const kept = (parts, S, N) => grow <= 1 || Math.abs(parts.reduce((t, P) => t + area(P), 0) - area(S) - area(N)) <= 0.5;
  let pieces = holePieces(panes, W, H).map(simplify);
  // ABOVE 1366x768, A GRID FIRST (round 5). The pieces cut along the standing panes' edges are about the standing
  // panes' size, and a join must stay a convex pane of at most their corners, so they cannot be joined up to a larger
  // target: the fill stayed at 1.2 % of a 1920x1080 screen (R3719). There the hole is cut by two families of straight
  // lines at the curtain's slants, `step` apart (a square of the target's area), each line moved a little by the seed;
  // the bits of one cell are joined back where they make one convex pane. At 1366x768 and below nothing of this runs.
  if (grow > 1) {
    const step = Math.sqrt(target * GRID_CELL);
    const fams = [-13 * Math.PI / 180, (90 - 8) * Math.PI / 180].map(ang => {
      const nx = -Math.sin(ang), ny = Math.cos(ang), span = Math.abs(W * nx) + Math.abs(H * ny), lo = Math.min(0, W * nx) + Math.min(0, H * ny);
      const at = []; for (let d = lo + step * (0.5 + rnd() * 0.3); d < lo + span; d += step * (0.85 + rnd() * 0.3)) at.push(d);
      return { nx, ny, at };
    });
    for (const f of fams) for (const d of f.at) {
      pieces = pieces.flatMap(P => { if (crack(P)) return [P]; const [A, B] = splitPoly(P, f.nx * d, f.ny * d, f.nx, f.ny); return A && B ? [A, B] : [P]; });
    }
    const cellOf = P => { const [x, y] = centroid(P); return fams.map(f => f.at.filter(d => x * f.nx + y * f.ny > d).length).join(","); };
    const cells = new Map();
    for (const P of pieces) { const k = cellOf(P); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(P); }
    pieces = [];
    for (const bits of cells.values()) {
      let left = bits.slice();
      for (let again = true; again && left.length > 1;) {
        again = false;
        for (let i = 0; i < left.length && !again; i++) for (let j = i + 1; j < left.length && !again; j++) {
          const u = joined(left[i], left[j]);
          if (u && area(u) <= most) { left = left.filter((_, k) => k !== i && k !== j); left.push(u); again = true; }
        }
      }
      pieces.push(...left.map(simplify));
    }
  }
  // join: the smallest piece first, with the neighbour that leaves the squarest pane
  const join = limit => {
    for (let again = true; again;) {
      again = false;
      pieces.sort((a, b) => area(a) - area(b));
      for (let i = 0; i < pieces.length && !again; i++) {
        let best = null, bj = -1, bq = -1;
        for (let j = 0; j < pieces.length; j++) {
          if (j === i || area(pieces[i]) + area(pieces[j]) > limit) continue;
          const u = joined(pieces[i], pieces[j]);
          if (!u || !fits(u) || slender(u) > range.slender) continue;
          const q = minAngle(u);
          if (q > bq) { bq = q; best = u; bj = j; }
        }
        if (best) { pieces = pieces.filter((_, k) => k !== i && k !== bj); pieces.push(best); again = true; }
      }
    }
  };
  join(most);
  // a straight cut of P through near its middle, at a shear of up to 16 degrees off square to its length: of sixteen
  // tries, the one whose two halves keep within the corners and have the widest smallest angle
  const bestCut = P => {
    let far = [P[0], P[1]], fl = -1;
    for (const a of P) for (const b of P) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > fl) { fl = l; far = [a, b]; } }
    const [cx, cy] = centroid(P), len = Math.atan2(far[1][1] - far[0][1], far[1][0] - far[0][0]);
    let best = null, bq = -1;
    for (let tries = 0; tries < 16; tries++) {
      const ang = len + (rnd() - 0.5) * 0.56, off = (rnd() - 0.5) * 0.24 * fl;
      const [A, B] = splitPoly(P, cx + Math.cos(ang) * off, cy + Math.sin(ang) * off, Math.cos(ang), Math.sin(ang));
      if (!A || !B) continue;
      const a = simplify(A), b = simplify(B);
      if (!fits(a) || !fits(b)) continue;
      const q = Math.min(minAngle(a), minAngle(b)) * Math.min(1, Math.min(area(a), area(b)) / (0.35 * area(P)));
      if (q > bq) { bq = q; best = [a, b]; }
    }
    return best;
  };
  // split what is larger than the standing panes' middle and a half, or longer for its width than any of them
  const cut = P => {
    if (area(P) <= most && fits(P) && slender(P) <= range.slender) return [P];
    // a crack narrower than any standing pane between two of them stays one pane: cut along, it falls into chips
    if (thickness(P) < Math.max(range.width, 24) && area(P) <= most) return [P];
    const two = bestCut(P);
    return two ? [...cut(two[0]), ...cut(two[1])] : [P];
  };
  pieces = pieces.flatMap(cut);
  // a sliver left by a cut is joined once more, now up to twice the middle
  join(Math.min(target * 2, Math.max(range.area[2], target * 2 / grow)));
  // what is still a sliver - smaller than the smallest standing pane, sharper than its sharpest corner, narrower than
  // its narrowest (and never under 24 px, the curtain's needles' least width), or of another
  // number of corners - is cut again with a neighbour: one straight line through a corner of either, each side of it
  // the two pieces' parts joined, kept when both sides are convex panes in the range
  const thin = Math.max(range.width, 24);
  const bad = P => area(P) < range.area[0] || minAngle(P) < range.angle || thickness(P) < thin || slender(P) > range.slender || !fits(P);
  const near = (A, B) => { for (const a of A) for (const b of B) if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 2) return true; return false; };
  const glue = (a, b) => (a && b ? joined(a, b) : a ?? b ?? null);
  const regroup = (S, N) => {
    let best = null, bq = -1;
    const one = joined(S, N);
    if (one && fits(one) && !bad(one) && area(one) <= Math.min(target * 2.2, Math.max(range.area[2], target * 2.2 / grow))) { best = [one]; bq = minAngle(one); }
    // through a corner of either; above 1366x768 also through points a third, a half and two thirds along their edges
    const along = P => P.flatMap((a, i) => { const b = P[(i + 1) % P.length]; return [1 / 3, 1 / 2, 2 / 3].map(t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); });
    for (const v of grow > 1 ? [...S, ...N, ...along(S), ...along(N)] : [...S, ...N]) for (let k = 0; k < 24; k++) {
      const ang = k * Math.PI / 24, nx = Math.cos(ang), ny = Math.sin(ang);
      const sS = cut2(S, v[0], v[1], nx, ny), sN = cut2(N, v[0], v[1], nx, ny);
            if (!sS || !sN) continue;
            const [s1, s2] = sS, [n1, n2] = sN;
      const A = glue(s1, n1), B = glue(s2, n2);
      if (!A || !B || (s1 && n1 && !joined(s1, n1)) || (s2 && n2 && !joined(s2, n2))) continue;
      const a = simplify(A), b = simplify(B);
      if (bad(a) || bad(b) || !kept([a, b], S, N)) continue;
      const q = Math.min(minAngle(a), minAngle(b));
      if (q > bq) { bq = q; best = [a, b]; }
    }
    return best;
  };
  const regroupAll = () => {
  for (let round = 0; round < 4; round++) {
    let changed = false;
    for (let i = 0; i < pieces.length; i++) {
      if (!bad(pieces[i])) continue;
      // first alone: a straight cut through one of its corners that leaves two panes in the range
      const P = pieces[i];
      let own = null, oq = -1;
      for (const v of P) for (let k = 0; k < 24; k++) {
        const ang = k * Math.PI / 24, [A, B] = splitPoly(P, v[0], v[1], Math.cos(ang), Math.sin(ang));
        if (!A || !B) continue;
        const a = simplify(A), b = simplify(B);
        if (bad(a) || bad(b)) continue;
        const q = Math.min(minAngle(a), minAngle(b));
        if (q > oq) { oq = q; own = [a, b]; }
      }
      if (own) { pieces = pieces.filter((_, k) => k !== i).concat(own); changed = true; i = -1; continue; }
      for (let j = 0; j < pieces.length; j++) {
        if (j === i || !near(pieces[i], pieces[j])) continue;
        const parts = regroup(pieces[i], pieces[j]);
        if (parts) { pieces = pieces.filter((_, k) => k !== i && k !== j).concat(parts); changed = true; i = -1; break; }
      }
    }
    if (!changed) break;
  }
  };
  regroupAll();
  // ABOVE 1366x768, NO SMALL PANE WHERE A NEIGHBOUR CAN SHARE (round 5): a piece under 0.55 of the target that is not a
  // crack is joined with a neighbour into one pane, or the two are cut again through a corner of either so that each
  // half holds at least 0.55 of the target - what the rim of the hole leaves small, the grid's whole cells lend to
  if (grow > 1) {
    const floor = target * 0.55;
    const small = P => area(P) < floor && !crack(P);
    for (let round = 0; round < 6; round++) {
      let changed = false;
      pieces.sort((a, b) => area(a) - area(b));
      for (let i = 0; i < pieces.length && !changed; i++) {
        if (!small(pieces[i])) continue;
        let pick = null, pq = -1;
        for (let j = 0; j < pieces.length; j++) {
          if (j === i || !near(pieces[i], pieces[j])) continue;
          const S = pieces[i], N = pieces[j], one = joined(S, N);
          if (one && fits(one) && !bad(one) && area(one) <= most) { const q = minAngle(one) + 90; if (q > pq) { pq = q; pick = { j, parts: [one] }; } continue; }
          for (const v of [...S, ...N]) for (let k = 0; k < 24; k++) {
            const ang = k * Math.PI / 24, nx = Math.cos(ang), ny = Math.sin(ang);
            const sS = cut2(S, v[0], v[1], nx, ny), sN = cut2(N, v[0], v[1], nx, ny);
            if (!sS || !sN) continue;
            const [s1, s2] = sS, [n1, n2] = sN;
            const A = glue(s1, n1), B = glue(s2, n2);
            if (!A || !B || (s1 && n1 && !joined(s1, n1)) || (s2 && n2 && !joined(s2, n2))) continue;
            const a = simplify(A), b = simplify(B);
            if (bad(a) || bad(b) || area(a) < floor || area(b) < floor || !kept([a, b], S, N)) continue;
            const q = Math.min(minAngle(a), minAngle(b));
            if (q > pq) { pq = q; pick = { j, parts: [a, b] }; }
          }
        }
        if (pick) { pieces = pieces.filter((_, k) => k !== i && k !== pick.j).concat(pick.parts); changed = true; }
      }
      if (!changed) break;
    }
  }
  // the lift moved neighbours: a sliver it left beside one is put with it again (round 5)
  if (grow > 1) regroupAll();
  return pieces.map(poly => ({ poly }));
}

/**
 * What the tests read of a tiling: every point of a grid of `step` px in exactly one pane of `standing` and `fresh`
 * together (`gaps` none, `doubles` none), the new panes' ranges beside the standing panes', and how many new panes
 * fall outside the standing panes' area range, corner range or smallest angle.
 */
export function tilingReading(standing, fresh, W, H, step = 6) {
  const all = [...standing.map(p => p.poly), ...fresh.map(p => p.poly)];
  const inside = (P, x, y) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (Math.abs(cr) < 1e-6) continue; if (s && Math.sign(cr) !== s) return false; s = Math.sign(cr); } return true; };
  let gaps = 0, doubles = 0, read = 0;
  for (let y = step / 2 + 0.37; y < H; y += step) for (let x = step / 2 + 0.29; x < W; x += step) {
    let n = 0;
    for (const P of all) if (inside(P, x, y)) n++;
    read++;
    if (n === 0) gaps++; else if (n > 1) doubles++;
  }
  const range = paneRange(standing), fr = fresh.length ? paneRange(fresh) : null;
  const outOfRange = fresh.filter(p => { const s = simplify(p.poly), a = area(p.poly); return a < range.area[0] || a > range.area[2] || s.length < range.corners[0] || s.length > range.corners[1] || minAngle(s) < range.angle || thickness(s) < range.width || slender(s) > range.slender; }).length;
  return { read, gaps, doubles, standing: range, fresh: fr, count: fresh.length, outOfRange };
}

/** What is seen of a pane moved by `o`: its moved copy cut to its own place (both convex); null when nothing is. */
export function visibleAt(poly, o) {
  let V = poly.map(([x, y]) => [x + o[0], y + o[1]]);
  for (const { a, nx, ny } of edgesOut(poly)) { V = splitPoly(V, a[0], a[1], -nx, -ny)[0]; if (!V) return null; }
  return V;
}

/** Pairs of panes that overlap among `polys` (convex), for a frame's check. */
export function overlapsIn(polys) {
  let n = 0;
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) if (polys[i] && polys[j] && convexOverlap(polys[i], polys[j])) n++;
  return n;
}

const ease = s => (s <= 0 ? 0 : s >= 1 ? 1 : 1 - Math.pow(1 - s, 3));

/* ---- round 4: a new pane slides out from behind the curtain's edge (the owner's note on round 3, 12.11.2026) ----
   "poszczególne kafelki wyskakują poprzez powiększenie, a powinny się wysuwać ... ruchem zza krawędzi kurtyny, a nie
   przez skalowanie w górę". A new pane keeps its size and shape from its first frame to its last: it starts wholly
   behind one of its own edges - one it shares with glass already there, a standing pane's or a new pane's that came
   before it - and moves to its place along that edge's normal; it is drawn only inside its own place, so what is still
   behind the edge is never seen and no two panes ever cover one point. */

/* the length two convex panes share along one edge each, and the edge of A it lies on (its index) */
function sharedEdge(A, B) {
  let best = 0, at = -1;
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    for (let j = 0; j < B.length; j++) {
      const c = B[j], d = B[(j + 1) % B.length];
      const off = q => Math.abs((q[0] - a[0]) * uy - (q[1] - a[1]) * ux);
      if (off(c) > 0.75 || off(d) > 0.75) continue;
      const s = q => (q[0] - a[0]) * ux + (q[1] - a[1]) * uy;
      const lo = Math.max(0, Math.min(s(c), s(d))), hi = Math.min(L, Math.max(s(c), s(d)));
      if (hi - lo > best) { best = hi - lo; at = i; }
    }
  }
  return { length: best, edge: at };
}

/**
 * The slide of each new pane: its source edge (one it shares with a standing pane, or with a new pane that slides
 * before it - the longest such edge), the edge's normal into the pane (`nx`, `ny`), how far the pane lies past the
 * edge (`depth`: the whole pane starts that far back, behind the edge), its generation (`rank`: 0 beside a standing
 * pane), and its start and length. A generation starts when the one before it is `lead` of the way through, so a pane
 * comes out from under glass that is already there; the whole closing takes `total` ms. A pane that touches no glass
 * at all (none in any cut read) slides from its edge nearest the screen's middle.
 */
export function slidePlan(standing, fresh, W, H, { total = 860, lead = 0.7 } = {}) {
  const S = standing.map(p => p.poly), F = fresh.map(p => p.poly), rank = F.map(() => -1), src = F.map(() => null);
  const pick = (i, others, r) => {
    let best = null;
    for (const Q of others) { const s = sharedEdge(F[i], Q); if (s.length > 2 && (!best || s.length > best.length)) best = s; }
    if (best) { rank[i] = r; src[i] = best.edge; }
  };
  F.forEach((_, i) => pick(i, S, 0));
  for (let r = 1; rank.includes(-1) && r < F.length; r++) {
    const prev = F.filter((_, k) => rank[k] === r - 1 || (rank[k] >= 0 && rank[k] < r));
    F.forEach((_, i) => { if (rank[i] === -1) pick(i, prev, r); });
    if (!rank.some(x => x === r)) break;
  }
  const R = Math.max(0, ...rank);
  F.forEach((P, i) => {
    if (rank[i] >= 0) return;
    rank[i] = R + 1;
    let near = 0, nd = Infinity;
    P.forEach((a, k) => { const b = P[(k + 1) % P.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(m[0] - W / 2, m[1] - H / 2); if (d < nd) { nd = d; near = k; } });
    src[i] = near;
  });
  // inside a generation the starts are spread over `spread` of a slide, outermost first, so it reads as glass coming
  // out pane by pane rather than one move
  const gens = Math.max(0, ...rank) + 1, spread = 0.45, dur = Math.round(total / (1 + lead * (gens - 1) + spread));
  const within = F.map(() => 0);
  for (let r = 0; r < gens; r++) {
    const ids = F.map((P, i) => i).filter(i => rank[i] === r);
    const far = i => { const [x, y] = centroid(F[i]); return Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)); };
    ids.sort((x, y) => far(y) - far(x)).forEach((i, k) => { within[i] = ids.length > 1 ? k / (ids.length - 1) : 0; });
  }
  return F.map((P, i) => {
    const a = P[src[i]], b = P[(src[i] + 1) % P.length], [cx, cy] = centroid(P);
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
    const depth = Math.max(...P.map(q => (q[0] - a[0]) * nx + (q[1] - a[1]) * ny));
    return { ...fresh[i], edge: [a, b], nx, ny, depth, rank: rank[i], delay: Math.round((rank[i] * lead + within[i] * spread) * dur), dur };
  });
}

/**
 * Where each new pane stands at `ms` into the closing (`open` false) or the opening (`open` true: the last
 * generation goes back first, each pane back behind its edge): its offset from its place, [dx, dy] along its edge's
 * normal, at scale 1; null where the pane is wholly behind its edge. Drawn inside its own place only.
 */
export function slideAt(plan, ms, { open = false } = {}) {
  const last = Math.max(0, ...plan.map(p => p.delay));
  return plan.map(p => {
    const start = open ? last - p.delay : p.delay;
    const s = (ms - start) / p.dur;
    const k = open ? 1 - ease(Math.max(0, Math.min(1, s))) : ease(Math.max(0, Math.min(1, s)));
    if (k <= 0) return null;
    const back = (1 - k) * p.depth;
    return [-p.nx * back, -p.ny * back];
  });
}
