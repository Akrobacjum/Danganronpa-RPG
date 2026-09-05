/**
 * Danganronpa RPG - the stained-glass curtain (theme "Stained Glass").
 * ---------------------------------------------------------------------------
 * One sheet of broken black glass along the screen edges, cut for the module's
 * own layout: the clock and GM bar in the left column, the Despair rail in the
 * top centre, the status strip and Projects tray in the right column, the
 * launchers in the bottom-right, a notice pane in the bottom-left. Every block
 * sits on its own pane and is rotated with it; the filler between panes is a
 * pencil of rays from a single slope field; the side strips cover Foundry's
 * scene controls and sidebar tabs. The geometry is a partition of convex
 * polygons (checked after every cut), painted once to a bitmap, with a glow
 * bitmap over it and a pulse bitmap that darkens every pane towards black and
 * back on its own slow rhythm. The recipe, with every number, is
 * docs/design/identity-audit-v13.html; this file is that recipe, running.
 *
 * Nothing here touches the fog, the canvas or another module's window. When
 * the theme is "Monokuma Legacy" this file mounts nothing.
 */

import { SETTINGS, getSetting } from "./settings.mjs";
import { log } from "./utils.mjs";

/** Self-check results of the last geometry pass, for diagnostics. */
export const CHECKS = [];
/** What the last pass measured: the frame and every block. `drpgGlassDebug()` in the console prints it. */
export const LAST = { frame: null, blocks: [] };

/* ---- the blocks: the module's own elements, measured untransformed ------- */
const BLOCKS = [
  { cls: "hud", sel: "#drpg-hud", fallback: (W, H) => ({ x: 16, y: 22, w: 312, h: 150 }) },
  { cls: "gmbar", sel: "#drpg-gm-launcher", fallback: (W, H, r) => ({ x: 16, y: (r.hud ? r.hud.y + r.hud.h : 172) + 6, w: 74, h: 34 }) },
  { cls: "rail", sel: "#drpg-despair", fallback: (W, H) => ({ x: Math.round(W / 2 - 206), y: 22, w: 412, h: 90 }) },
  { cls: "event", sel: "#drpg-events", fallback: null },
  { cls: "three", sel: "#drpg-player-status", fallback: (W, H) => ({ x: W - 64 - 300, y: 22, w: 300, h: 78 }) },
  { cls: "tray", sel: "#ui-right-column-1 > #countdowns, #countdowns", fallback: (W, H, r) => ({ x: W - 64 - 300, y: (r.three ? r.three.y + r.three.h : 100) + 10, w: 300, h: 62 }) },
  { cls: "note-block", sel: "#drpg-notice", fallback: (W, H) => ({ x: 16, y: H - 100 - 80, w: 330, h: 80 }) },
  { cls: "launch", sel: "#drpg-messenger-launcher, #drpg-sound-launcher, #drpg-settings-launcher", union: true, fallback: (W, H) => ({ x: W - 22 - 66, y: H - 22 - 134, w: 66, h: 134 }) },
];
function moduleLayout(W, H) {
  const els = BLOCKS.map(b => [...document.querySelectorAll(b.sel)].filter(e => e.offsetWidth > 0 && e.offsetHeight > 0));
  // measure with the rotation off, so a pane is cut for the block as laid out, and against the
  // curtain's own box, so a curtain that does not start at the viewport's corner still fits
  els.flat().forEach(e => { e.style.transform = ""; });
  const cur = document.getElementById("drpg-curtain")?.getBoundingClientRect();
  const ox = cur?.left ?? 0, oy = cur?.top ?? 0;
  const rects = {}, out = [];
  BLOCKS.forEach((b, i) => {
    const list = els[i];
    let r = null;
    if (list.length) {
      const rs = list.map(e => e.getBoundingClientRect());
      const x0 = Math.min(...rs.map(q => q.left)) - ox, y0 = Math.min(...rs.map(q => q.top)) - oy;
      const x1 = Math.max(...rs.map(q => q.right)) - ox, y1 = Math.max(...rs.map(q => q.bottom)) - oy;
      r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    if (!r && !b.fallback) return;                 // an event panel that is not there cuts no pane
    const box = r ? { ...r } : b.fallback(W, H, rects);
    rects[b.cls] = box;
    out.push({ cls: b.cls, x: box.x, y: box.y, w: box.w, h: box.h, el: list[0] ?? null, els: list, r });
  });
  LAST.blocks = out.map(b => ({ cls: b.cls, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), measured: Boolean(b.r), n: b.els.length }));
  return out;
}
/** Console helper: `drpgGlassDebug()` prints the frame, the blocks and the self-check of the last pass. */
export function debugGlass() {
  const out = { frame: LAST.frame, blocks: LAST.blocks, checks: CHECKS.slice(), theme: document.body.className, viewport: [innerWidth, innerHeight], curtain: document.getElementById("drpg-curtain")?.getBoundingClientRect?.() };
  console.log("[DRPG] curtain", JSON.stringify(out, null, 1));
  return out;
}
globalThis.drpgGlassDebug = debugGlass;

  /* ---- the glass ------------------------------------------------------------
     Black glass. Colour lives in the seams and in a few stained cells; a panel's
     pane is always plain black so text reads the same everywhere. */
  const STAIN = ["#5c1238", "#142a66"];
  const TONE = { hud: "#050409", gmbar: "#050409", rail: "#2a0a1e", event: "#24061a", three: "#08103a", tray: "#1a0838", "note-block": "#24061a", launch: "#050409" };
  const SHEAR = -13 * Math.PI / 180;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => "rgba(" + hex(h).join(",") + "," + a + ")";
  const DEG = Math.PI / 180;

  const probe = document.createElement("span");
  probe.style.position = "absolute"; probe.style.visibility = "hidden";
  document.body.append(probe);
  const resolveAcc = w => {
    probe.style.color = getComputedStyle(w).getPropertyValue("--acc") || "#7fe4ff";
    const m = getComputedStyle(probe).color.match(/[0-9]+/g);
    return m ? "#" + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, "0")).join("") : "#7fe4ff";
  };

  /* ---- geometry: convex polygons, half-planes, and nothing stitched ---------- */
  const EPS = 0.004;
  const dedupe = poly => poly.filter((q, i) => { const p = poly[(i + poly.length - 1) % poly.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.5; });
  // Split a convex polygon by the line through (px,py) with normal (nx,ny): [side >= 0, side < 0].
  const split = (poly, px, py, nx, ny) => {
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
    return [A, B].map(p => { p = dedupe(p); return p.length >= 3 ? p : null; });
  };
  const clipHP = (poly, px, py, nx, ny) => poly ? split(poly, px, py, nx, ny)[0] : null;
  const clipRect = (poly, W, H) => {
    let p = poly;
    for (const [px, py, nx, ny] of [[0, 0, 1, 0], [W, 0, -1, 0], [0, 0, 0, 1], [0, H, 0, -1]]) { if (!p) return null; p = clipHP(p, px, py, nx, ny); }
    return p;
  };
  const bbox = poly => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
  const area = poly => Math.abs(poly.reduce((s, q, i) => { const r = poly[(i + 1) % poly.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const axesOf = P => P.map((p, i) => { const q = P[(i + 1) % P.length]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l]; });
  const extent = (P, ax) => { let a0 = 1e9, a1 = -1e9; for (const p of P) { const d = p[0] * ax[0] + p[1] * ax[1]; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } return [a0, a1]; };
  const thickness = P => Math.min(...axesOf(P).map(ax => { const [a, b] = extent(P, ax); return b - a; }));
  const convex = P => { let sgn = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-6) continue; if (sgn && Math.sign(cr) !== sgn) return false; sgn = Math.sign(cr); } return true; };
  const overlaps = (A, B) => {           // separating axes on convex polygons; a shared edge is not an overlap
    for (const ax of [...axesOf(A), ...axesOf(B)]) { const [a0, a1] = extent(A, ax), [b0, b1] = extent(B, ax); if (a1 <= b0 + 0.5 || b1 <= a0 + 0.5) return false; }
    return true;
  };
  const inside = (P, x, y) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (Math.abs(cr) < 0.5) continue; if (s && Math.sign(cr) !== s) return false; s = Math.sign(cr); } return true; };
  const touchesEdge = (P, W, H) => P.some(q => q[0] < 2 || q[0] > W - 2 || q[1] < 2 || q[1] > H - 2);

  /* ---- the field -------------------------------------------------------------
     dx/dy of a seam as a function of where it meets the screen edge: "\" on the
     left, "/" on the right, upright in the middle, mirrored for the bottom band. */
  const K = 0.30, P = 1.4;
  const field = (x, W, band) => {
    const u = (x - W / 2) / (W / 2);
    const s = -K * Math.sign(u) * Math.pow(Math.min(1, Math.abs(u)), P);
    return band === "top" ? s : -s;
  };
  const PAD_SIDE = 12, PAD_FAR = 10, HUG = 120;

  function curtainShapes(host, W, H, rnd) {
    const boxes = moduleLayout(W, H);
    const panes = [];
    const push = (poly, tone, kind, rank) => {
      if (!poly || poly.length < 3) return null;
      const edge = touchesEdge(poly, W, H);
      if (!edge && (area(poly) < 40 || thickness(poly) < 6)) return null;
      const p = { poly, content: !!tone, tone, kind, rank: rank == null ? 9 : rank }; panes.push(p); return p;
    };

    const columnsOf = list => {
      const cols = [];
      for (const b of list) {
        const c = cols.find(c => Math.min(c.x1, b.x + b.w) - Math.max(c.x0, b.x) > -(2 * PAD_SIDE + 10));
        if (c) { c.items.push(b); c.x0 = Math.min(c.x0, b.x); c.x1 = Math.max(c.x1, b.x + b.w); c.y0 = Math.min(c.y0, b.y); c.y1 = Math.max(c.y1, b.y + b.h); }
        else cols.push({ x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h, items: [b] });
      }
      cols.forEach(c => c.items.sort((p, q) => p.y - q.y));
      return cols.sort((p, q) => p.x0 - q.x0);
    };
    const top = columnsOf(boxes.filter(b => b.y + b.h / 2 < H / 2));
    const bot = columnsOf(boxes.filter(b => b.y + b.h / 2 >= H / 2));

    /* a column's pane: the padded block rectangle rotated with the field, its near
       side run off the screen edge, clipped to the screen; the block is rotated by
       the same angle around the same pivot, so glass and panel agree exactly */
    const buildColumn = (c, cols, band) => {
      const cx = (c.x0 + c.x1) / 2, h = c.y1 - c.y0;
      const s0 = field(cx, W, band);
      let theta = Math.abs(cx - W / 2) < 0.1 * W ? 0 : Math.min(12 * DEG, Math.max(6 * DEG, Math.atan(Math.abs(s0))));
      // a neighbour too close forbids the tilt that would swing the pane into it
      for (const o of cols) if (o !== c) { const gap = o.x0 > c.x1 ? o.x0 - c.x1 : c.x0 - o.x1; if (gap >= 0) theta = Math.min(theta, Math.atan(Math.max(0, gap - 2 * PAD_SIDE - 2) / Math.max(h, 1))); }
      const s = Math.sign(s0) * Math.tan(theta);
      const phi = -Math.atan(s);
      const px = cx < W / 2 ? c.x1 : c.x0;
      const py = band === "top" ? c.y0 : c.y1;
      const cs = Math.cos(phi), sn = Math.sin(phi);
      const rot = (X, Y) => [px + X * cs - Y * sn, py + X * sn + Y * cs];
      for (const b of c.items) if (b.el && b.r) for (const e of b.els) {
        const er = e.getBoundingClientRect();
        e.style.transformOrigin = (px - er.left) + "px " + (py - er.top) + "px";
        e.style.transform = Math.abs(phi) < 0.004 ? "" : "rotate(" + phi + "rad)";
      }
      let X0 = c.x0 - px - PAD_SIDE, X1 = c.x1 - px + PAD_SIDE;
      const Yn = (band === "top" ? c.y0 - py : c.y1 - py) + (band === "top" ? -3000 : 3000);
      const Yf = band === "top" ? c.y1 - py + PAD_FAR : c.y0 - py - PAD_FAR;
      // a column near a wall (under Foundry's sidebar too) runs its pane into the wall: the far corner is
      // pushed past the screen edge by the gap and by the swing of the rotation, so no bare wedge is left
      c.hugL = c.x0 - PAD_SIDE < HUG; c.hugR = c.x1 + PAD_SIDE > W - HUG;
      if (c.hugL) { const over = rot(X0, Yf)[0] + 2; if (over > 0) X0 -= over / cs; }
      if (c.hugR) { const over = W + 2 - rot(X1, Yf)[0]; if (over > 0) X1 += over / cs; }
      const rect = band === "top" ? [rot(X0, Yn), rot(X1, Yn), rot(X1, Yf), rot(X0, Yf)] : [rot(X0, Yf), rot(X1, Yf), rot(X1, Yn), rot(X0, Yn)];
      const edgeY = band === "top" ? 0 : H;
      const at = (X) => { const q = rot(X, 0); return { x0: q[0] + s * (edgeY - q[1]), s, edgeY }; };
      c.rayL = at(X0); c.rayR = at(X1);
      c.farL = rot(X0, Yf); c.farR = rot(X1, Yf);
      c.far = { p: c.farL, d: [cs, sn] };
      c.depthL = Math.abs(c.farL[1] - edgeY); c.depthR = Math.abs(c.farR[1] - edgeY);
      c.s = s; c.phi = phi; c.rot = rot; c.px = px; c.py = py; c.cs = cs; c.sn = sn;
      c.corners = [rot(c.x0 - px, c.y0 - py), rot(c.x1 - px, c.y0 - py), rot(c.x1 - px, c.y1 - py), rot(c.x0 - px, c.y1 - py)].filter(q => q[0] > 1 && q[0] < W - 1 && q[1] > 1 && q[1] < H - 1);
      let piece = clipRect(rect, W, H);
      for (let m = 0; m + 1 < c.items.length && piece; m++) {
        const up = c.items[m], dn = c.items[m + 1];
        if (dn.y < up.y + up.h - 1) continue;                  // overlapping blocks share one pane
        const Ydiv = ((up.y + up.h) + dn.y) / 2 - py;
        const pt = rot(0, Ydiv);
        const [below, above] = split(piece, pt[0], pt[1], -sn, cs);
        push(above, up.cls, "section", 0); piece = below;
      }
      c.pane = push(piece, c.items[c.items.length - 1].cls, "section", 0);
    };
    top.forEach(c => buildColumn(c, top, "top"));
    bot.forEach(c => buildColumn(c, bot, "bottom"));

    /* filler between two rays of one band: a pencil of rays interpolated between the
       bounding pair, a far edge that continues the pane's own depth for one cell,
       falls to a thin ledge over the next two, and stays a ledge in the open */
    const rayX = (r, y) => r.x0 + r.s * (y - r.edgeY);
    const needles = [];
    const sectors = (band, rA, rB, dA, dB, ledgeDepth) => {
      const edgeY = band === "top" ? 0 : H, sgn = band === "top" ? 1 : -1;
      rA = { ...rA, edgeY }; rB = { ...rB, edgeY };
      const gap = rB.x0 - rA.x0;
      if (gap < 8) return;
      // beside each pane ONE long straight diagonal runs from the pane's far corner down to the
      // ledge; one or two rays cross it. The open stretch is cut rarely. Few lines, all long.
      const LA = dA > 0 ? Math.min(gap * 0.45, 520 + rnd() * 240) : 0;
      const LB = dB > 0 ? Math.min(gap * 0.45, 520 + rnd() * 240) : 0;
      const xs = [];
      const step = 230 + rnd() * 60;
      for (let x = rA.x0 + step; LA > 0 && x < rA.x0 + LA - 60; x += step) xs.push(x + (rnd() - 0.5) * 50);
      for (let x = rB.x0 - step; LB > 0 && x > rB.x0 - LB + 60; x -= step) xs.push(x + (rnd() - 0.5) * 50);
      const openL = rA.x0 + LA, openR = rB.x0 - LB, open = openR - openL;
      if (open > 300) { const m = Math.max(1, Math.round(open / 460)); for (let i = 1; i < m; i++) xs.push(openL + open * (i / m) + (rnd() - 0.5) * 80); }
      if (LA > 0 && open > 40) xs.push(openL + (rnd() - 0.5) * 20);   // the kink where the diagonal meets the ledge
      if (LB > 0 && open > 40) xs.push(openR + (rnd() - 0.5) * 20);
      xs.sort((p, q) => p - q);
      const rays = [rA];
      for (const x of xs) { if (x - rays[rays.length - 1].x0 < 40 || rB.x0 - x < 40) continue; const u = (x - rA.x0) / gap; rays.push({ x0: x, s: rA.s + u * (rB.s - rA.s) + (rnd() - 0.5) * 0.12, edgeY }); }
      rays.push(rB);
      const spacing = step;
      // one crossing depth for the whole pencil (or none)
      let ystar = 1e9;
      for (let i = 0; i + 1 < rays.length; i++) { const a = rays[i], b = rays[i + 1]; if (a.s - b.s > 1e-6) ystar = Math.min(ystar, (b.x0 - a.x0) / (a.s - b.s)); }
      const cap = ystar * 0.8;
      // depth where a ray meets the straight diagonal (solved exactly, so the far edge of every
      // cell beside a pane lies on ONE line from the pane's corner to the ledge)
      const ledge = ledgeDepth;
      const onLine = (r, xf, df, L, dir) => {           // line from (xf, df) falling to (xf + dir*L, ledge)
        if (L <= 0) return 0;
        const m = (ledge - df) / (dir * L);
        const y = (df + (r.x0 - xf) * m) / (1 - r.s * m * sgn);
        return Math.max(ledge, Math.min(df, y));
      };
      const D = r => Math.max(ledge, onLine(r, rA.x0, dA, LA, 1), onLine(r, rB.x0, dB, LB, -1));
      const depths = rays.map(r => { const d = D(r); return Math.min(cap, Math.max(6, d + (rnd() - 0.5) * (d > ledge + 4 ? 10 : 14))); });
      const wall = rA.x0 <= 0 || rB.x0 >= W;
      for (let i = 0; i + 1 < rays.length; i++) {
        const a = rays[i], b = rays[i + 1];
        const ya = edgeY + sgn * depths[i], yb = edgeY + sgn * depths[i + 1];
        if (depths[i] < 4 && depths[i + 1] < 4) continue;
        const rank = Math.min(i, rays.length - 2 - i);
        // a needle: a thin sliver split off one ray of the cell, two or three per screen
        const nearPane = (dA > 0 && i === 0) || (dB > 0 && i === rays.length - 2);
        if (!nearPane && !wall && needles.every(nx => Math.abs(nx - a.x0) > 400) && rnd() < 0.22) {
          const w = 24 + rnd() * 12, side = rnd() < 0.5;
          const xs = side ? a.x0 + w : b.x0 - w;
          const r2 = { x0: xs, s: (a.s + b.s) / 2, edgeY };
          const deep = Math.min(cap, 110 + rnd() * 60);
          const yd = edgeY + sgn * deep;
          const nd = side ? [[a.x0, edgeY], [xs, edgeY], [rayX(r2, yd), yd], [rayX(a, ya), ya]] : [[xs, edgeY], [b.x0, edgeY], [rayX(b, yb), yb], [rayX(r2, yd), yd]];
          const rest = side ? [[xs, edgeY], [b.x0, edgeY], [rayX(b, yb), yb], [rayX(r2, ya), ya]] : [[a.x0, edgeY], [xs, edgeY], [rayX(r2, yb), yb], [rayX(a, ya), ya]];
          push(clipRect(nd, W, H), null, "needle", rank); push(clipRect(rest, W, H), null, "sector", rank);
          needles.push(a.x0);
          continue;
        }
        push(clipRect([[a.x0, edgeY], [b.x0, edgeY], [rayX(b, yb), yb], [rayX(a, ya), ya]], W, H), null, "sector", rank);
      }
    };
    const ledgeFor = () => 22 + rnd() * 18, REACH = 360;
    if (top.length) {
      const first = top[0], last = top[top.length - 1];
      const L = ledgeFor();
      sectors("top", { x0: 0, s: 0 }, first.rayL, 0, first.rayL.x0 < REACH ? first.depthL : 0, L);
      for (let k = 0; k + 1 < top.length; k++) sectors("top", top[k].rayR, top[k + 1].rayL, top[k].depthR, top[k + 1].depthL, L);
      sectors("top", last.rayR, { x0: W, s: 0 }, last.rayR.x0 > W - REACH ? last.depthR : 0, 0, L);
    } else {
      sectors("top", { x0: 0, s: 0 }, { x0: W, s: 0 }, 0, 0, ledgeFor());
    }
    if (bot.length) {
      const first = bot[0], last = bot[bot.length - 1], L = 20 + rnd() * 14;
      sectors("bottom", { x0: 0, s: 0 }, first.rayL, 0, first.rayL.x0 < REACH ? first.depthL : 0, L);
      for (let k = 0; k + 1 < bot.length; k++) sectors("bottom", bot[k].rayR, bot[k + 1].rayL, bot[k].depthR, bot[k + 1].depthL, L);
      sectors("bottom", last.rayR, { x0: W, s: 0 }, last.rayR.x0 > W - REACH ? last.depthR : 0, 0, L);
    } else {
      sectors("bottom", { x0: 0, s: 0 }, { x0: W, s: 0 }, 0, 0, 20 + rnd() * 14);
    }

    /* rings: two long transverse cracks per half of the top band, starting at the
       corner and descending towards the centre; they cut filler only, and a few of
       the inner pieces are gone, never one beside a panel or on the wall */
    const corner = side => { const cs = top.filter(c => side ? (c.x0 + c.x1) / 2 >= W / 2 : (c.x0 + c.x1) / 2 < W / 2); return cs.length ? Math.max(...cs.map(c => Math.max(c.depthL, c.depthR))) : 60; };
    const ringLines = [];
    for (const half of [0, 1]) {
      const D0 = corner(half);
      for (const g of [0.26 + rnd() * 0.08, 0.58 + rnd() * 0.12]) {
        const ang = (5 + rnd() * 7) * DEG;
        const x0 = half ? W : 0, y0 = D0 * g, dir = half ? -1 : 1;
        const d = [dir * Math.cos(ang), Math.sin(ang)];
        ringLines.push({ p: [x0, y0], d });
        for (let i = panes.length - 1; i >= 0; i--) {
          const p = panes[i];
          if (p.content || p.kind === "needle") continue;
          const bb = bbox(p.poly);
          if (bb.y0 > D0 * 1.5 || (half ? bb.x1 <= W / 2 : bb.x0 >= W / 2)) continue;
          const [below, above] = split(p.poly, x0, y0, -d[1], d[0]);
          if (!below || !above) continue;
          panes.splice(i, 1);
          const outer = above.some(q => q[1] < 1) ? above : below, inner = outer === above ? below : above;
          push(outer, null, p.kind, p.rank);
          if (p.rank <= 0 || touchesEdge(inner, W, H) || rnd() > 0.25) push(inner, null, p.kind, p.rank);
        }
      }
    }

    /* side strips: two convex quads per side between the wall and a straight inner line,
       wide under the top panel, thin at mid-height, wide again above the bottom panel.
       The quads share the mid seam exactly (one vertex on the wall, one on the inner
       line), the top one begins on the far edge of the corner pane and the bottom one
       ends on the far edge of the bottom corner pane, so the wall is covered without a
       gap; then one family of parallel cuts per half: a partition by construction */
    const tiles = {};
    // Foundry's tiles, measured with their rotation off and in the curtain's own pixels (the page may be scaled)
    const cv = host.querySelector(".curtain > canvas.sg, #drpg-curtain > canvas.sg");
    const tileBox = (sel, fallback) => {
      const t = host.querySelector(sel); if (!t || !t.offsetWidth || !cv) return fallback;   // the shard is cut even when the tiles are not shown: one shape everywhere
      const keep = t.style.transform; t.style.transform = "";
      const r = t.getBoundingClientRect(), o = cv.getBoundingClientRect(), s = o.width / W || 1;
      t.style.transform = keep;
      return { x0: (r.left - o.left) / s, y0: (r.top - o.top) / s, x1: (r.right - o.left) / s, y1: (r.bottom - o.top) / s };
    };
    const lineY = (c, x) => { const [fx, fy] = c.far.p, [dx, dy] = c.far.d; return fy + (x - fx) * dy / dx; };
    for (const side of [0, 1]) {
      const wall = side ? W : 0, dir = side ? -1 : 1;
      const wTop = 136 + rnd() * 34, wMid = 62 + rnd() * 10, wBot = 116 + rnd() * 34;
      const wCtl = wTop - 22, yCtl = 640;                     // one straight edge under the tiles: 22 px of lean over its run
      const tb = tileBox(side ? ".f-side" : ".f-ctl", side ? { x0: W - 68, y0: 290, x1: W - 20, y1: 620 } : { x0: 20, y0: 320, x1: 92, y1: 608 });
      const cT = top.length ? top[side ? top.length - 1 : 0] : null, cB = bot.length ? bot[side ? bot.length - 1 : 0] : null;
      const hugT = cT && (side ? cT.hugR : cT.hugL), hugB = cB && (side ? cB.hugR : cB.hugL);
      let yTop = 0, yBot = H;
      if (hugT) yTop = Math.max(lineY(cT, wall), lineY(cT, wall + dir * wTop));
      else for (const p of panes) { const bb = bbox(p.poly); if ((side ? bb.x1 > W - wTop - 40 : bb.x0 < wTop + 40) && bb.y1 < H / 2) yTop = Math.max(yTop, bb.y1); }
      if (hugB) yBot = Math.min(lineY(cB, wall), lineY(cB, wall + dir * wBot));
      else for (const p of panes) { const bb = bbox(p.poly); if ((side ? bb.x1 > W - wBot - 40 : bb.x0 < wBot + 40) && bb.y0 >= H / 2) yBot = Math.min(yBot, bb.y0); }
      if (yBot - yTop < 240) continue;
      const yMid = yTop + (yBot - yTop) * (0.5 + (rnd() - 0.5) * 0.16);
      const tilt = (5 + rnd() * 5) * DEG * (rnd() < 0.5 ? 1 : -1);
      const M = [wall + dir * wMid, yMid], Wm = [wall, yMid - wMid * Math.tan(tilt)];
      const yT0 = hugT ? Math.min(lineY(cT, wall), lineY(cT, wall + dir * wTop)) - 1 : yTop;
      const yB0 = hugB ? Math.max(lineY(cB, wall), lineY(cB, wall + dir * wBot)) + 1 : yBot;
      let upperQ = clipRect([[wall, yT0], [wall + dir * wTop, yT0], ...(yCtl < yMid - 40 ? [[wall + dir * wCtl, yCtl]] : []), M, Wm], W, H);
      // the angle of that edge, for the tiles that sit on it (clockwise on the left, the mirror on the right)
      tiles[side ? "right" : "left"] = { angle: Math.atan((wTop - wCtl) / Math.max(1, yCtl - yTop)) * (side ? -1 : 1), yTop, wTop, wCtl, yCtl };
      let lowerQ = clipRect([Wm, M, [wall + dir * wBot, yB0], [wall, yB0]], W, H);
      if (hugT && upperQ) { const [fx, fy] = cT.far.p; upperQ = clipHP(upperQ, fx, fy, -cT.sn, cT.cs); }
      if (hugB && lowerQ) { const [fx, fy] = cB.far.p; lowerQ = clipHP(lowerQ, fx, fy, cB.sn, -cB.cs); }
      const cutFamily = (poly, slope, y0, y1, box) => {
        if (!poly) return;
        let pieces = [poly];
        if (box) {   // two shallow cuts just above and below the tiles; the piece between them is theirs alone
          for (const [yy, tilt] of [[box.y0 - 14, -0.10], [box.y1 + 14, 0.10]]) pieces = pieces.flatMap(pp => split(pp, wall, yy, -tilt, dir).filter(Boolean));
          const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
          const k = pieces.findIndex(pp => inside(pp, cx, cy));
          if (k >= 0) { const shard = push(pieces.splice(k, 1)[0], null, "strip", 9); if (shard) shard.plain = true; }
        }
        let y = y0 + (y0 === yTop ? 320 + rnd() * 160 : 120 + rnd() * 200);
        while (y < y1 - 60) {
          const nx = 1, ny = -slope;                 // line x = wall + slope*(yy - y): normal (1, -slope)
          pieces = pieces.flatMap(pp => split(pp, wall, y, nx, ny).filter(Boolean));
          y += 180 + rnd() * 240;
        }
        for (const pp of pieces) push(pp, null, "strip", 9);
      };
      cutFamily(upperQ, dir * (0.28 + rnd() * 0.12), yTop, yMid, tb);
      cutFamily(lowerQ, -dir * (0.28 + rnd() * 0.12), yMid, yBot);
    }

    /* the partition, enforced twice: sections first, then only filler that lands on nothing */
    const kept = [];
    for (const p of panes) if (p.content) kept.push(p);
    for (const p of panes) if (!p.content && kept.every(k => !overlaps(k.poly, p.poly))) kept.push(p);
    kept.meta = { top, bot, rings: ringLines, tiles };
    return kept;
  }

  /* ---- a window: three or four long shallow shards -------------------------- */
  function windowShapes(W, H, rnd) {
    let panes = [[[0, 0], [W, 0], [W, H], [0, H]]];
    const cutAt = (px, py, ang) => { const nx = -Math.sin(ang), ny = Math.cos(ang); panes = panes.flatMap(p => split(p, px, py, nx, ny).filter(Boolean)); };
    if (H > 90) cutAt(W * 0.5, H * (0.28 + rnd() * 0.12), SHEAR + (rnd() - 0.5) * 0.12);
    if (H > 150) cutAt(W * 0.5, H * (0.68 + rnd() * 0.12), SHEAR + (rnd() - 0.5) * 0.12);
    cutAt(W * (0.62 + rnd() * 0.22), H * 0.5, Math.PI / 2 + SHEAR * 1.6);
    if (W > 520) cutAt(W * (0.16 + rnd() * 0.14), H * 0.5, Math.PI / 2 - SHEAR * 1.2);
    if (W > 300) cutAt(W * (0.38 + rnd() * 0.16), H * 0.5, Math.PI / 2 + SHEAR * (rnd() < 0.5 ? 1.1 : -1.3));
    return panes.map(poly => ({ poly, content: false, kind: "window" }));
  }

  /* ---- painting --------------------------------------------------------------- */
  const path = (g, poly) => { g.beginPath(); poly.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
  const onEdge = (W, H) => (p, q) => (p[0] < 1 && q[0] < 1) || (p[0] > W - 1 && q[0] > W - 1) || (p[1] < 1 && q[1] < 1) || (p[1] > H - 1 && q[1] > H - 1);
  const seams = (g, panes, W, H, wdt, k = 1) => {
    const edge = onEdge(W, H);
    g.beginPath();
    for (const p of panes) for (let i = 0, j = p.poly.length - 1; i < p.poly.length; j = i++) {
      if (edge(p.poly[j], p.poly[i]) || Math.hypot(p.poly[i][0] - p.poly[j][0], p.poly[i][1] - p.poly[j][1]) < 1) continue;
      g.moveTo(p.poly[j][0] * k, p.poly[j][1] * k); g.lineTo(p.poly[i][0] * k, p.poly[i][1] * k);
    }
    g.lineWidth = wdt; g.lineCap = "round"; g.stroke();
  };
  /* junctions: vertices where three or more seam directions meet; the seam is drawn a little
     heavier there, along each arm, so a crack reads as glass that broke rather than a drawing */
  const junctions = (panes, W, H) => {
    const edge = onEdge(W, H), map = new Map();
    for (const p of panes) for (let i = 0, j = p.poly.length - 1; i < p.poly.length; j = i++) {
      const a = p.poly[j], b = p.poly[i];
      if (edge(a, b)) continue;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
      for (const [s, t] of [[a, b], [b, a]]) {
        const key = Math.round(s[0]) + "," + Math.round(s[1]);
        let n = map.get(key); if (!n) { n = { x: s[0], y: s[1], dirs: [] }; map.set(key, n); }
        const ang = Math.atan2(t[1] - s[1], t[0] - s[0]);
        if (!n.dirs.some(d => Math.abs(Math.atan2(Math.sin(d - ang), Math.cos(d - ang))) < 0.06)) n.dirs.push(ang);
      }
    }
    return [...map.values()].filter(n => n.dirs.length >= 3 && n.x > 1 && n.x < W - 1 && n.y > 1 && n.y < H - 1);
  };
  const nodeArms = (g, nodes, len, wdt, k = 1) => {
    g.beginPath();
    for (const n of nodes) for (const d of n.dirs) { g.moveTo(n.x * k, n.y * k); g.lineTo((n.x + Math.cos(d) * len) * k, (n.y + Math.sin(d) * len) * k); }
    g.lineWidth = wdt; g.lineCap = "round"; g.stroke();
  };
  const hash = (x, y) => { const v = Math.sin(x * 0.0137 + y * 0.0221) * 43758.5453; return v - Math.floor(v); };

  function paintGlass(ctx, W, H, panes, acc, { glowInside = false, inset = 0, seamCtx = null } = {}) {
    const sx = seamCtx || ctx;   // the seams may live on a canvas above the pulse layer
    ctx.clearRect(0, 0, W, H);
    panes.forEach((p, i) => {
      const k = p.tone && TONE[p.tone] ? p.tone : null;
      const bb = bbox(p.poly);
      const hsh = hash((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2);
      const stained = !p.content && !p.plain && hsh > (p.kind === "window" ? 0.62 : 0.72);
      ctx.save(); path(ctx, p.poly); ctx.clip();
      // black glass first, then a little colour: a panel keeps its tone, most filler a faint tint, one in five stained
      const lum = hash((bb.x0 + bb.x1) / 2 + 17, (bb.y0 + bb.y1) / 2 - 31);
      ctx.globalAlpha = (p.content ? 0.68 : stained ? 0.30 : 0.58) + (lum - 0.5) * 0.08;
      ctx.fillStyle = p.content ? (k ? TONE[k] : "#050409") : (lum > 0.5 ? "#0c0a14" : "#0a0810");
      ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      if (!p.content) {
        ctx.globalAlpha = stained ? 0.60 : 0.05 + lum * 0.07;
        ctx.fillStyle = STAIN[Math.floor(hsh * 1000) % STAIN.length];
        ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      }
      ctx.globalAlpha = 1; ctx.fillStyle = stained ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.30)"; ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      const down = (bb.y0 + bb.y1) / 2 < H / 2;
      const g = ctx.createLinearGradient(0, down ? bb.y0 : bb.y1, 0, down ? bb.y1 : bb.y0);
      g.addColorStop(0, "rgba(255,255,255,0.08)"); g.addColorStop(0.55, "rgba(255,255,255,0.01)"); g.addColorStop(1, "rgba(0,0,0,0.20)");
      ctx.fillStyle = g; ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      ctx.restore();
      p.stained = stained; p.hsh = hsh; p.bb = bb; p.tex = null;
      if (stained && bb.x1 - bb.x0 > 2 && bb.y1 - bb.y0 > 2) {
        // the texture of coloured glass, and only of coloured glass: fine translucent streaks along the
        // shear, three brighter ones in the state colour, a faint grain. Pre-rendered here, shown by the
        // pulse layer only while the pane is lit.
        const tw = Math.ceil(bb.x1 - bb.x0), th = Math.ceil(bb.y1 - bb.y0);
        const t = document.createElement("canvas"); t.width = tw; t.height = th;
        const g2 = t.getContext("2d"); g2.translate(-bb.x0, -bb.y0); path(g2, p.poly); g2.clip();
        const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2, span = Math.hypot(tw, th);
        g2.save(); g2.translate(cx, cy); g2.rotate(SHEAR + Math.PI / 2 + (hsh - 0.5) * 0.3);
        for (let i = -span; i < span; i += 7) { g2.fillStyle = "rgba(255,255,255," + (0.09 + (Math.round(i / 7) % 3 === 0 ? 0.08 : 0)) + ")"; g2.fillRect(i, -span, 1.2, 2 * span); }
        for (let j = 0; j < 3; j++) { const x = (hash(cx + j * 31, cy - j * 17) - 0.5) * span * 0.9; g2.fillStyle = rgba(acc, 0.22); g2.fillRect(x, -span, 2.2 + j, 2 * span); g2.fillStyle = "rgba(255,255,255,0.26)"; g2.fillRect(x + 3 + j, -span, 0.8, 2 * span); }
        g2.restore();
        g2.fillStyle = rgba(acc, 0.16);
        for (let y = bb.y0 + 3; y < bb.y1; y += 6) for (let x = bb.x0 + 3 + (Math.floor(y / 6) % 2) * 3; x < bb.x1; x += 6) g2.fillRect(x, y, 1.2, 1.2);
        p.tex = t;
      }
    });
    if (seamCtx) seamCtx.clearRect(0, 0, W, H);
    if (inset > 0) {   // the seams (not the glass) are kept out of the content box
      sx.save(); sx.beginPath(); sx.rect(0, 0, W, H); sx.rect(inset, inset * 2.6, W - 2 * inset, H - inset * 3.4); sx.clip("evenodd");
    }
    if (glowInside) {
      sx.save(); sx.globalCompositeOperation = "lighter"; sx.strokeStyle = acc;
      const nds = junctions(panes, W, H);
      for (const [blur, a, wdt] of [[10, 0.20, 2.2], [4, 0.24, 1.4]]) { sx.filter = "blur(" + blur + "px)"; sx.globalAlpha = a; seams(sx, panes, W, H, wdt); nodeArms(sx, nds, 12, wdt * 1.6); }
      sx.restore();
    }
    // lead, the bevel, the neon core: thin lines, a little heavier along the arms of every junction
    const nodes = junctions(panes, W, H);
    sx.globalAlpha = 0.95; sx.strokeStyle = "#08050d"; seams(sx, panes, W, H, 1.2); nodeArms(sx, nodes, 16, 1.7); nodeArms(sx, nodes, 7, 2.2);
    sx.save(); sx.translate(0, 1); sx.globalAlpha = 0.22; sx.strokeStyle = "#ffffff"; seams(sx, panes, W, H, 0.5); sx.restore();
    sx.globalAlpha = glowInside ? 0.78 : 0.92; sx.strokeStyle = acc; seams(sx, panes, W, H, 0.7); nodeArms(sx, nodes, 14, 1.0); nodeArms(sx, nodes, 6, 1.35);
    sx.globalAlpha = 1;
    panes.nodes = nodes;
    if (inset > 0) sx.restore();
  }

  const layerAfter = (after, cls, W, H) => { let c = after.parentElement.querySelector(":scope > canvas." + cls); if (!c) { c = document.createElement("canvas"); c.className = cls; after.after(c); } c.width = W; c.height = H; return c; };
  /* ---- the curtain: geometry now, paint when it is looked at -------------------- */
  const rng = seed => { let sd = seed; return () => { sd = (sd * 1664525 + 1013904223) % 4294967296; return sd / 4294967296; }; };
  function curtainGeometry(job) {
    const el = job.el, host = document, c = el.querySelector("canvas.sg");
    if (!c || c.clientWidth < 10) return false;
    // the curtain's own box, not the canvas's client size: a fixed element inside a transformed
    // or zoomed ancestor is sized by that ancestor, and the blocks are measured against the same box
    const rc = el.getBoundingClientRect();
    const W = Math.round(rc.width || c.clientWidth || innerWidth), H = Math.round(rc.height || c.clientHeight || innerHeight);
    LAST.frame = { W, H, left: rc.left, top: rc.top, inner: [innerWidth, innerHeight] };
    const sig = W + "x" + H;
    if (job.sig === sig) return true;
    job.sig = sig; job.W = W; job.H = H;
    const panes = curtainShapes(host, W, H, rng(job.seed));
    job.panes = panes;
    // the silhouette: one clip path of every pane, crisp at any scale, no bitmap
    const d = panes.map(p => "M" + p.poly.map(q => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + "Z").join("");
    el.style.clipPath = "path('" + d + "')";
    el.style.visibility = "";
    const t = panes.meta.tiles || {};
    for (const [sel, side] of [["#scene-controls", "left"], ["#sidebar-tabs", "right"]]) {
      const tile = host.querySelector(sel); if (!tile) continue;
      tile.style.transformOrigin = "50% 50%";
      tile.style.transform = t[side] ? "rotate(" + t[side].angle + "rad)" : "";
    }
    // self-check: C1 no overlaps, convexity, C2 every block inside its own pane and no other, C3 the top edge covered
    let ov = 0, nonconvex = 0, blockFails = 0, edgeGaps = 0, fitFails = 0; const ncv = [];
    for (let i = 0; i < panes.length; i++) { if (!convex(panes[i].poly)) { nonconvex++; ncv.push(panes[i].kind + ':' + panes[i].poly.map(q => q.map(v => Math.round(v)).join(',')).join(' ')); } for (let j = i + 1; j < panes.length; j++) if (overlaps(panes[i].poly, panes[j].poly)) ov++; }
    for (const col of [...panes.meta.top, ...panes.meta.bot]) for (const b of col.items) {
      const own = panes.filter(p => p.content && col.items.some(i => i.cls === p.tone));
      if (b.r && (b.r.x < b.x - 0.5 || b.r.y < b.y - 0.5 || b.r.x + b.r.w > b.x + b.w + 0.5 || b.r.y + b.r.h > b.y + b.h + 0.5)) fitFails++;
      const qs = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => col.rot(x - col.px, y - col.py)).filter(q => q[0] > 1 && q[0] < W - 1 && q[1] > 1 && q[1] < H - 1);
      for (const q of qs) {
        if (!own.some(p => inside(p.poly, q[0], q[1]))) blockFails++;
        if (panes.some(p => !own.includes(p) && inside(p.poly, q[0], q[1]))) blockFails++;
      }
    }
    const cover = (x, y) => panes.some(p => inside(p.poly, x, y));
    for (let x = 4; x < W; x += 8) { if (!cover(x, 0.5)) edgeGaps++; if (!cover(x, H - 0.5)) edgeGaps++; }
    for (let y = 4; y < H; y += 8) { if (!cover(0.5, y)) edgeGaps++; if (!cover(W - 0.5, y)) edgeGaps++; }
    CHECKS.push({ seed: job.seed, count: panes.length, overlaps: ov, nonconvex, ncv, blockFails, edgeGaps, fitFails, sig: panes.map(p => p.poly.map(q => q.map(v => Math.round(v)).join(',')).join(' ')).join('|').length });
    job.painted = false;
    return true;
  }
  function curtainPaint(job) {
    const el = job.el, c = el.querySelector("canvas.sg"), panes = job.panes;
    if (!panes) return false;
    const W = c.width = job.W, H = c.height = job.H;
    const acc = resolveAcc(el);
    const seamCanvas = layerAfter(c, "seamline", W, H);
    paintGlass(c.getContext("2d"), W, H, panes, acc, { seamCtx: seamCanvas.getContext("2d") });
    // the glow and the cracks live outside the clip, at half resolution: a bloom is soft anyway
    let gl = el.parentElement.querySelector('[data-glow="' + job.seed + '"]');
    if (!gl) { gl = document.createElement("canvas"); gl.className = "curtain-glow"; gl.dataset.glow = job.seed; el.after(gl); }
    const k = 0.5; gl.width = Math.round(W * k); gl.height = Math.round(H * k);
    const gx = gl.getContext("2d");
    gx.clearRect(0, 0, gl.width, gl.height);
    gx.globalCompositeOperation = "lighter"; gx.strokeStyle = acc;
    for (const [blur, a, wdt] of [[9, 0.46, 1.3], [3.5, 0.5, 0.9], [1, 0.58, 0.6]]) { gx.filter = "blur(" + blur + "px)"; gx.globalAlpha = a; seams(gx, panes, W, H, wdt, k); nodeArms(gx, panes.nodes || [], 14, wdt * 1.7, k); }
    gx.filter = "none";
    // hairline cracks: the fan's own lines carried across the screen, never over a panel
    gx.save();
    gx.beginPath(); gx.rect(0, 0, gl.width, gl.height);
    for (const p of panes) if (p.content) { p.poly.forEach((q, i) => (i ? gx.lineTo(q[0] * k, q[1] * k) : gx.moveTo(q[0] * k, q[1] * k))); gx.closePath(); }
    gx.clip("evenodd");
    // a handful of long cracks: per top corner the corner pane's outer ray carried on, one steep
    // and one shallow line from the impact; per bottom corner one; each fades as it travels
    const lines = [];
    const rnd = rng(job.seed + 991);
    for (const side of [0, 1]) {
      const x0 = side ? W : 0, dir = side ? -1 : 1;
      const cols = panes.meta.top.filter(c => side ? (c.x0 + c.x1) / 2 >= W / 2 : (c.x0 + c.x1) / 2 < W / 2);
      if (cols.length) { const c = side ? cols[cols.length - 1] : cols[0]; const f = side ? c.farL : c.farR; const n = Math.hypot(c.s, 1), L = 480 + rnd() * 160; lines.push([f[0], f[1], f[0] + c.s / n * L, f[1] + L / n]); }
      for (const [ang, L] of [[22, 720], [64, 840]]) { const a = (ang + (rnd() - 0.5) * 10) * DEG; const y0 = rnd() * 50; lines.push([x0 + dir * rnd() * 30, y0, x0 + dir * Math.sin(a) * L, y0 + Math.cos(a) * L]); }
      { const a = (40 + (rnd() - 0.5) * 16) * DEG, L = 600; lines.push([x0 + dir * rnd() * 30, H - rnd() * 50, x0 + dir * Math.sin(a) * L, H - Math.cos(a) * L]); }
    }
    const accRGB = hex(acc).join(",");
    for (const [a, wdt, blur] of [[0.24, 0.8, 0], [0.11, 1.6, 2]]) {
      gx.filter = blur ? "blur(" + blur + "px)" : "none"; gx.globalAlpha = 1; gx.lineWidth = wdt;
      for (const l of lines) {
        const g = gx.createLinearGradient(l[0] * k, l[1] * k, l[2] * k, l[3] * k);
        g.addColorStop(0, "rgba(" + accRGB + "," + a + ")"); g.addColorStop(0.5, "rgba(" + accRGB + "," + (a * 0.4) + ")"); g.addColorStop(1, "rgba(" + accRGB + ",0)");
        gx.strokeStyle = g; gx.beginPath(); gx.moveTo(l[0] * k, l[1] * k); gx.lineTo(l[2] * k, l[3] * k); gx.stroke();
      }
    }
    gx.restore(); gx.filter = "none"; gx.globalAlpha = 1;
    // the pulse layer: phases from the angle round the screen centre plus the distance, so the
    // darkening travels round the frame as a slow spiral; periods 9-16 s per pane
    const pc = layerAfter(c, "pulse", Math.round(W * 0.5), Math.round(H * 0.5)); job.pulseK = 0.5;
    for (const p of panes) {
      const bb = bbox(p.poly), cx = (bb.x0 + bb.x1) / 2 - W / 2, cy = (bb.y0 + bb.y1) / 2 - H / 2;
      const h = p.hsh == null ? hash(cx, cy) : p.hsh;
      p.phase = Math.atan2(cy, cx) * 1.6 + Math.hypot(cx, cy) / 420 + h * 1.2;
      p.omega = 2 * Math.PI / (9 + h * 7);
    }
    job.pulse = pc; job.acc = acc;
    job.painted = true;
    return true;
  }

  function pulseFrame(t) {
    for (const j of [...curtains, ...windows]) {
      if (!j.pulse || !j.panes || !j.el.isConnected) continue;
      const g = j.pulse.getContext("2d"), k = j.pulseK;
      g.clearRect(0, 0, j.pulse.width, j.pulse.height);
      const accRGB = hex(j.acc).join(",");
      for (const p of j.panes) {
        const v = 0.5 - 0.5 * Math.cos(t / 1000 * p.omega + p.phase);      // 0 bright ... 1 dark
        const dark = (p.content ? 0.42 : p.stained ? 0.62 : 0.72) * Math.pow(v, p.stained ? 2.2 : 1.6);
        if (dark > 0.01) { g.globalCompositeOperation = "source-over"; g.fillStyle = "rgba(2,1,4," + dark.toFixed(3) + ")"; path(g, p.poly.map(q => [q[0] * k, q[1] * k])); g.fill(); }
        const lit = Math.pow(1 - v, 3);
        const light = (p.stained ? 0.16 : 0.05) * lit;
        if (light > 0.005) { g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(" + accRGB + "," + light.toFixed(3) + ")"; path(g, p.poly.map(q => [q[0] * k, q[1] * k])); g.fill(); }
        // the texture of coloured glass shows only while the pane is lit
        if (p.tex && lit > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(1, lit * 1.1); g.drawImage(p.tex, p.bb.x0 * k, p.bb.y0 * k, p.tex.width * k, p.tex.height * k); g.globalAlpha = 1; }
      }
      g.globalCompositeOperation = "source-over";
    }
  }

/* ---- lifecycle -------------------------------------------------------------- */
const curtains = [], windows = [];
let raf = 0, last = 0, observers = [], timer = 0;
const REDUCED = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function themeOn() { try { return getSetting(SETTINGS.theme) === "stainedGlass"; } catch { return false; } }
function effectsOn() { try { return getSetting(SETTINGS.glassEffects) !== false; } catch { return true; } }

function mount() {
  const iface = document.getElementById("interface") ?? document.body;
  let el = document.getElementById("drpg-curtain");
  if (!el) { el = document.createElement("div"); el.id = "drpg-curtain"; el.innerHTML = '<canvas class="sg"></canvas>'; iface.prepend(el); }
  if (!curtains.length) curtains.push({ el, seed: 44 });
  rebuild();
}
function unmount() {
  for (const j of curtains) { j.el.remove(); document.querySelectorAll("#interface > .curtain-glow").forEach(g => g.remove()); }
  curtains.length = 0;
  for (const j of windows) j.el.querySelectorAll(":scope > canvas").forEach(c => c.remove());
  windows.length = 0;
  document.querySelectorAll("#scene-controls, #sidebar").forEach(e => { e.style.marginTop = ""; });
  BLOCKS.forEach(b => document.querySelectorAll(b.sel).forEach(e => { e.style.transform = ""; e.style.transformOrigin = ""; }));
  document.body.classList.remove("drpg-curtain-on");
}
function rebuild() {
  for (const j of curtains) {
    j.sig = null; CHECKS.length = 0;
    if (curtainGeometry(j)) {
      // Foundry's tiles must start below the corner panes to own a shard of the strip;
      // when they do not, push them down once and cut the glass again
      if (!j.placed && placeTiles(j.panes.meta)) { j.placed = true; j.sig = null; curtainGeometry(j); }
      curtainPaint(j); document.body.classList.add("drpg-curtain-on");
    }
  }
  const c = CHECKS[0];
  if (c && (c.overlaps || c.nonconvex || c.blockFails || c.edgeGaps)) log("curtain self-check", c);
}
/* the scene controls and the sidebar tabs start below the corner panes, 24 px under the strip's top */
function placeTiles(meta) {
  const t = meta?.tiles || {};
  let moved = false;
  for (const [target, probe, side] of [["#scene-controls", "#scene-controls", "left"], ["#sidebar", "#sidebar-tabs", "right"]]) {
    const el = document.querySelector(target), pr = document.querySelector(probe), info = t[side];
    if (!el || !pr || !info) continue;
    const keep = pr.style.transform; pr.style.transform = "";
    const top = pr.getBoundingClientRect().top; pr.style.transform = keep;
    const need = Math.round(info.yTop + 24 - top);
    if (need > 2) { el.style.marginTop = ((parseFloat(el.style.marginTop) || 0) + need) + "px"; moved = true; }
  }
  return moved;
}

/* ---- module windows: the stained glass on the title band only --------------- */
function paintBand(job) {
  const w = job.el, c = w.querySelector(":scope > canvas.sg");
  if (!c || w.clientWidth < 10) return;
  const W = c.width = Math.max(60, Math.round(w.clientWidth)), H = c.height = Math.max(24, Math.round(w.clientHeight));
  const panes = windowShapes(W, H, rng(job.seed)), acc = resolveAcc(w);
  const seamCanvas = layerAfter(c, "seamline", W, H);
  paintGlass(c.getContext("2d"), W, H, panes, acc, { glowInside: true, inset: 0, seamCtx: seamCanvas.getContext("2d") });
  const pc = layerAfter(c, "pulse", W, H); job.pulseK = 1;
  for (const p of panes) { const cx = (p.bb.x0 + p.bb.x1) / 2 - W / 2; p.phase = cx / 140 + p.hsh * 1.4; p.omega = 2 * Math.PI / (9 + p.hsh * 7); }
  job.panes = panes; job.pulse = pc; job.acc = acc; job.W = W; job.H = H;
}
/* a flash of every seam in Bone (or the accent) that fades over `ms`: the glass has just set */
function flashSeams(job, color, ms) {
  if (REDUCED() || !effectsOn() || !job.panes) return;
  const host = job.el, ref = host.querySelector(":scope > canvas.seamline") ?? host.querySelector(":scope > canvas.sg");
  if (!ref) return;
  const W = ref.width, H = ref.height, k = W / Math.max(1, job.W || host.clientWidth || W);
  const fc = layerAfter(ref, "flash", W, H), g = fc.getContext("2d");
  const t0 = performance.now();
  const step = t => {
    const u = (t - t0) / ms;
    g.clearRect(0, 0, W, H);
    if (u >= 1 || !fc.isConnected) { fc.remove(); return; }
    g.globalAlpha = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8;
    g.strokeStyle = color; seams(g, job.panes, W / k, H / k, 1.6, k);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/** Glass on a band: a window's title bar or the character sheet's header. */
function dressBand(band, seedBase) {
  let job = windows.find(j => j.el === band);
  if (!job) {
    const c = document.createElement("canvas"); c.className = "sg"; band.prepend(c);
    job = { el: band, seed: seedBase + windows.length * 37 };
    windows.push(job);
  }
  requestAnimationFrame(() => { paintBand(job); flashSeams(job, job.acc || "#f2eee6", 420); });
  return job;
}
/** Every module window (`.drpg-panel`) gets glass on its header band, the character sheet on its
    header; called from renderApplicationV2. */
export function dressWindow(app) {
  if (!themeOn()) return;
  const el = app?.element;
  if (!el?.querySelector) return;
  if (el.classList?.contains("drpg-panel")) { const h = el.querySelector(".window-header"); if (h) dressBand(h, 155); }
  const sheetHead = el.querySelector(".character-header-sheet");
  if (sheetHead) { sheetHead.classList.add("drpg-glass-band"); dressBand(sheetHead, 999); }
}
/* the state changed (hour, phase, Eclipse): every seam flashes Bone and the glass takes the new colour */
let stateTimer = 0;
function onStateChange() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    for (const j of curtains) { if (!j.panes) continue; const acc = resolveAcc(j.el); if (acc === j.acc) continue; flashSeams(j, "#f2eee6", 420); curtainPaint(j); }
    for (const j of windows) { if (!j.el.isConnected) continue; const acc = resolveAcc(j.el); if (acc === j.acc) continue; flashSeams(j, "#f2eee6", 420); paintBand(j); }
  }, 60);
}
function pruneWindows() { for (let i = windows.length - 1; i >= 0; i--) if (!windows[i].el.isConnected) windows.splice(i, 1); }

const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { if (themeOn()) rebuild(); }, 150); };
function observe() {
  observers.forEach(o => o.disconnect()); observers = [];
  addEventListener("resize", schedule);
  const mo = new MutationObserver(schedule);
  for (const sel of ["#ui-left-column-1", "#ui-top", "#ui-right-column-1", "#ui-bottom", "#interface"]) {
    const h = document.querySelector(sel); if (h) mo.observe(h, { childList: true });
  }
  observers.push(mo);
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(schedule);
    BLOCKS.forEach(b => document.querySelectorAll(b.sel).forEach(e => ro.observe(e)));
    observers.push(ro);
  }
}
function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!curtains.length || document.hidden || REDUCED() || !effectsOn()) return;
  if (t - last < 66) return;
  last = t; pulseFrame(t);
}

/** Mount or unmount the curtain according to the theme setting. */
export function refreshGlass() {
  if (!themeOn()) { unmount(); return; }
  const go = () => { mount(); observe(); };
  (document.fonts?.ready ?? Promise.resolve()).then(go, go);
}

/** Called once at ready. */
export function registerGlass() {
  refreshGlass();
  if (!raf) raf = requestAnimationFrame(loop);
  // late blocks: the launchers and the tray arrive after ready on some clients
  setTimeout(() => { if (themeOn()) rebuild(); }, 1500);
  Hooks.on("canvasReady", schedule);
  Hooks.on("collapseSidebar", schedule);
  Hooks.on("renderApplicationV2", dressWindow);
  Hooks.on("closeApplicationV2", pruneWindows);
  // the pause band is a pane of the curtain while the game is paused, breathing with the slow pulse
  Hooks.on("pauseGame", paused => {
    const band = document.getElementById("pause");
    if (!band || !themeOn()) return;
    if (paused) { band.classList.add("drpg-glass-band"); dressBand(band, 777); }
    else { band.querySelectorAll(":scope > canvas").forEach(c => c.remove()); band.classList.remove("drpg-glass-band"); pruneWindows(); }
  });
  new MutationObserver(onStateChange).observe(document.body, { attributes: true, attributeFilter: ["data-drpg-phase", "data-drpg-time", "class"] });
}
