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
 * - `insetPoly` is a pane drawn smaller by moving every edge inward along its normal by one distance; a new pane grows
 *   from its inset to its full shape, so it is a pane of the same corners from its first frame, and since an inset
 *   lies inside its pane no two panes overlap at any frame.
 * - `tilingReading` is what the tests read: every point of the screen in exactly one pane, and the new panes' areas,
 *   corners and angles against the standing panes'.
 *
 * Pure, no imports, no DOM.
 */

const EPS = 0.004;
const area = poly => Math.abs(poly.reduce((s, q, i) => { const r = poly[(i + 1) % poly.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
const centroid = poly => { const n = poly.length; return [poly.reduce((s, q) => s + q[0], 0) / n, poly.reduce((s, q) => s + q[1], 0) / n]; };
const dedupe = poly => poly.filter((q, i) => { const p = poly[(i + poly.length - 1) % poly.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.5; });

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

/** The pane with every edge moved inward along its normal by `d`; null once nothing is left. */
export function insetPoly(P, d) {
  if (d <= 0) return P.map(q => [q[0], q[1]]);
  let Q = P;
  for (const { a, nx, ny } of edgesOut(P)) {
    // keep the side away from the normal, past the line moved in by d
    Q = splitPoly(Q, a[0] - nx * d, a[1] - ny * d, -nx, -ny)[0];
    if (!Q) return null;
  }
  return Q;
}

/** The largest inset a pane takes before it is gone (its inradius), to a tenth of a pixel. */
export function inradius(P) {
  let lo = 0, hi = Math.sqrt(area(P));
  while (hi - lo > 0.1) { const m = (lo + hi) / 2; if (insetPoly(P, m)) lo = m; else hi = m; }
  return lo;
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
  const target = range.area[1], most = Math.min(target * 1.5, range.area[2]), minCorners = range.corners[0], maxCorners = range.corners[1];
  const fits = P => P.length >= minCorners && P.length <= maxCorners;
  let pieces = holePieces(panes, W, H).map(simplify);
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
  join(target * 2);
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
    if (one && fits(one) && !bad(one) && area(one) <= target * 2.2) { best = [one]; bq = minAngle(one); }
    for (const v of [...S, ...N]) for (let k = 0; k < 24; k++) {
      const ang = k * Math.PI / 24, nx = Math.cos(ang), ny = Math.sin(ang);
      const [s1, s2] = splitPoly(S, v[0], v[1], nx, ny), [n1, n2] = splitPoly(N, v[0], v[1], nx, ny);
      const A = glue(s1, n1), B = glue(s2, n2);
      if (!A || !B || (s1 && n1 && !joined(s1, n1)) || (s2 && n2 && !joined(s2, n2))) continue;
      const a = simplify(A), b = simplify(B);
      if (bad(a) || bad(b)) continue;
      const q = Math.min(minAngle(a), minAngle(b));
      if (q > bq) { bq = q; best = [a, b]; }
    }
    return best;
  };
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

/** Pairs of panes that overlap among `polys` (convex), for a frame's check. */
export function overlapsIn(polys) {
  let n = 0;
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) if (polys[i] && polys[j] && convexOverlap(polys[i], polys[j])) n++;
  return n;
}

/* ---- the growth: when each new pane comes in, and how large it stands at a moment ---- */
const ease = s => (s <= 0 ? 0 : s >= 1 ? 1 : 1 - Math.pow(1 - s, 3));
/** Of its inradius, how much a new pane is inset at its first frame: it comes in as a smaller pane of the same corners (0.8 made a long pane a line at first; 0.65 read on the 50 % frame, 12.11). */
export const GROW_FROM = 0.65;

/**
 * The order and times of the new panes: the outermost first (from the screen's middle, as the curtain's own batches
 * run), each `dur` ms long, their starts spread over `spread` ms. Answers the panes with `delay`, `dur` and `r` (the
 * inradius) added.
 */
export function growPlan(fresh, W, H, { spread = 440, dur = 420 } = {}) {
  const far = fresh.map((p, i) => { const [x, y] = centroid(p.poly); return [Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)), i]; }).sort((a, b) => b[0] - a[0]);
  const rank = []; far.forEach(([, i], k) => { rank[i] = k; });
  const n = Math.max(1, fresh.length - 1);
  return fresh.map((p, i) => ({ ...p, delay: Math.round(spread * rank[i] / n), dur, r: inradius(p.poly) }));
}

/**
 * Each new pane's polygon at `ms` into the closing (`open` false) or into the opening (`open` true, the reverse: the
 * last to come in goes first); null where a pane is not on screen. A pane is its own inset, from `GROW_FROM` of its
 * inradius to none, on the arrival's curve.
 */
export function growPolys(plan, ms, { open = false } = {}) {
  const last = Math.max(0, ...plan.map(p => p.delay));
  return plan.map(p => {
    const start = open ? last - p.delay : p.delay;
    const s = (ms - start) / p.dur;
    if (open ? s >= 1 : s <= 0) return null;
    const k = open ? 1 - ease(Math.max(0, s)) : ease(Math.min(1, s));
    return k >= 1 ? p.poly : insetPoly(p.poly, p.r * GROW_FROM * (1 - k));
  });
}
