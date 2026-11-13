/**
 * The curtain cut, pure (E54, the plan G1 and G5): what the glass is cut into for a screen and the blocks on it,
 * from arguments alone - the convex-polygon helpers, the slope field, the column and band cutters, the partitions
 * (`windowShapes`, `stackShapes`, `deskShapes`, `curtainShapes`, `meetBands`) and the affine math of the turn; the
 * voice tile's settle and a block's turn it reads from glass-blocks.mjs. Moved out of glass.mjs, which exported none
 * of these names, measures the page for the cut (`stackPage`, `deskPage`, `curtainPage`) and writes what the cut
 * gives back (`writeCut`). It reads no page and no state of glass.mjs: R4805.
 */

import { settleVoice, blockTurns } from "./glass-blocks.mjs";

export const bboxOf = poly => ({ x0: Math.min(...poly.map(q => q[0])), y0: Math.min(...poly.map(q => q[1])), x1: Math.max(...poly.map(q => q[0])), y1: Math.max(...poly.map(q => q[1])) });
/* KEEP THE SEAM'S ANGLE, MOVE THE RAIL INSTEAD - AND MEASURE, DO NOT PREDICT.
   Three goes at this. Clamping the angle left a rail standing straight beside tilted glass,
   which is half the complaint. Computing the inset from the rotated bounding box was still
   wrong, because these rails turn about A POINT THE GLASS CHOOSES (`origin` below), not about
   their own centre, so no centre-based formula says where they land - the left rail sat six
   pixels off the screen while the arithmetic said it was fine. So: apply the glass's angle,
   read the box the browser actually produced, and slide the rail in by whatever it is over
   the edge. One extra reflow per rebuild, on two elements. */
/* The most the partition ever leans a column, and the angle the rails reserve room for.
   Kept here because two passes have to agree on it: the measuring pass inflates a rail's
   box by the swing this angle costs, and `railRule` writes the rotation that spends it. */
export const MAX_TILT = 9 * Math.PI / 180;
/* WHAT A LEAN COSTS IN WIDTH. A rail is the tallest thing on the screen and rotation is paid
   for in width: a 468 px rail leaning 9 deg needs 73 px more glass than it occupies. The shard
   reserves that up front, at MAX_TILT, so whatever lean the strip's edge turns out to want is
   always one the tiles have room for, and they never cross their own glass. */
/* The swing a rail's lean costs it, at the lean it is actually given (RAIL_LEAN below), not
   at the partition's maximum: reserving for 9 degrees when the rail leans 5 made the band
   half again as wide as it needed to be, which is the "witraz na lewe kafelki jest za duzy"
   of 07.09. The lean is clamped to the same number, so the reservation is exact. */
export const railSwing = h => Math.round(Math.max(0, h) * Math.sin(RAIL_LEAN) / 2);
/* how much wider than the tiles' box the strip carrying them runs: the lean of its outer
   edge (STRIP_LEAN, 26) plus the clearance that edge keeps off the tiles (14) */
/* THE ANGLE THE AUDIT PAGE GIVES THE EDGE UNDER THE TILES: "szkło jest ścięte do jednej
   prostej (22 px pochylenia na ~370 px)", which is 3.4 degrees, "a same kafelki są obrócone o
   kąt tej krawędzi ... więc stoją do niej równolegle". So the edge is cut to that angle over
   whatever run it has, and the tiles take the angle the edge came out with - parallel by
   construction rather than by two constants that happen to agree. */
export const STRIP_ANGLE = Math.atan(22 / 370);
const STRIP_LEAN = 26;
/* How far a rail leans - exactly, not at least. It used to be a floor with MAX_TILT as the
   ceiling, and the band then had to reserve the swing of the ceiling. One number for both. */
const RAIL_LEAN = 5 * Math.PI / 180;

  /* ---- the glass ------------------------------------------------------------
     Black glass. Colour lives in the seams and in a few stained cells; a panel's
     pane is always plain black so text reads the same everywhere. */
export   const STAIN = ["#5c1238", "#142a66"];
  /* A PANEL'S PANE IS GLASS, NOT A PLATE.
     Every tone here went up a step after the audit: at #050409 under 68 % alpha, with a
     further 30 % of black over it and `brightness(0.88)` under it, a pane over a dark map
     is not dark glass - it is a black rectangle with writing on it, which is what the
     tablet screenshot shows behind the clock and the tray. The lift is small (a panel's
     pane must still read as the calmest thing on the screen) and it is paid for by the
     black layer in `paintGlass`, which is thinner over content than over filler. */
export   const TONE = { hud: "#0d0b16", rail: "#3a1230", event: "#33102a", three: "#12204d", tray: "#281448", "note-block": "#33102a", "room-block": "#0d0b16", "voice-block": "#0d0b16", "tiles-row": "#0d0b16", launch: "#0d0b16" };
  const SHEAR = -13 * Math.PI / 180;
export   const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export   const rgba = (h, a) => "rgba(" + hex(h).join(",") + "," + a + ")";
export   const DEG = Math.PI / 180;

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
export   const bbox = poly => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
  const area = poly => Math.abs(poly.reduce((s, q, i) => { const r = poly[(i + 1) % poly.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const axesOf = P => P.map((p, i) => { const q = P[(i + 1) % P.length]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l]; });
  const extent = (P, ax) => { let a0 = 1e9, a1 = -1e9; for (const p of P) { const d = p[0] * ax[0] + p[1] * ax[1]; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } return [a0, a1]; };
  const thickness = P => Math.min(...axesOf(P).map(ax => { const [a, b] = extent(P, ax); return b - a; }));
export   const convex = P => { let sgn = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-6) continue; if (sgn && Math.sign(cr) !== sgn) return false; sgn = Math.sign(cr); } return true; };
export   const overlaps = (A, B) => {           // separating axes on convex polygons; a shared edge is not an overlap
    for (const ax of [...axesOf(A), ...axesOf(B)]) { const [a0, a1] = extent(A, ax), [b0, b1] = extent(B, ax); if (a1 <= b0 + 0.5 || b1 <= a0 + 0.5) return false; }
    return true;
  };
export   const inside = (P, x, y) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (Math.abs(cr) < 0.5) continue; if (s && Math.sign(cr) !== s) return false; s = Math.sign(cr); } return true; };
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
export   const PAD_SIDE = 12, PAD_FAR = 10, HUG = 120;
  /* The narrowest gap between two panes the filler will cut a sector into (`cutSectors`).
     Two columns closer than two pads and this apart meet exactly instead - see `padSide`. */
  const FILL_MIN = 8;

  /* `W` is where the glass ENDS (an expanded sidebar is a wall); `FW` is the screen. The slope
     field and the upright zone in the middle belong to the screen: read off the wall instead,
     the Despair rail - centred on the window - fell 158 px off the middle of a 1685 px wall and
     took a full 8 degrees of tilt, which is the leaning rail on the tablet screenshot. */
  /* THE RAILS' BANDS BELONG TO THE STRIPS, AND NOTHING ELSE IS CUT INTO THEM.
     The side strip is the part of the curtain that runs along a wall, and it is where a
     rail's shard is cut. Everything else - the columns' panes and the filler sectors
     between them - used to be free to run into the wall too, and it is the FILLER that
     finally cost the tab rail its glass: three sectors reached 60 px into the band at the
     top of the screen, so the strip had to begin 249 px down and the rail's first five
     tiles sat on them, with a seam across each (measured 07.09, 42 of 64 corners home).
     Every pane except a strip is clipped out of the bands here, in one place, so the band
     is the strip's from the top of the screen to the bottom and the shard can be cut
     wherever the tiles actually are. `clipHP` keeps a convex polygon convex. */
  const pushPane = (ctx, poly, tone, kind, rank) => {
    const { panes, railBands, W, H } = ctx;
    if (!poly || poly.length < 3) return null;
    /* THE THREE-WAY CUT, AND WHY IT IS NO LONGER NEEDED HERE (16.09).
       The first version of this clipped every pane out of the band for the WHOLE height of
       the screen, which took the clock's own glass, the GM button's and - worst - the
       notice tile's, all three of which live at that wall above or below the rail and had
       nothing to do with it (Dawid, 07.09: "kawalek szkla przeznaczony na powiadomienia
       zniknal"). A pane was cut into three across the band's own run instead - what is
       above it, what is beside it, what is below - and only the middle piece lost the band.

       All three of those panes are SECTIONS, and the rule below exempts sections outright,
       so the run limit was protecting nothing at the top and costing a sliver: a filler
       sector may enter the band above the tiles, and the strip then starts below that
       sector's BOX while the sector itself only covers the wall as far as its leaning
       edge. Measured 16.09 at 1920x800 with the column pinned clear of the band: the
       sector reached y = 30 in its bounding box and y = 25 at the wall, the strip began at
       30, and the five pixels between them were bare map at the top-right corner - one
       edge gap at every desk width. Filler is cut out of the band from the top of the
       screen now, and down to the end of the rail's run rather than only across it. */
    let parts = [poly];

    /* FILLER ONLY. Clipping the SECTIONS - the panes cut for the clock, the GM button and
       the notice tile - is what took their glass away, and the partition's own check said
       so as plainly as Dawid did: two blocks off their pane and seven gaps at the screen
       edge. Those panes belong to blocks standing at the same wall above and below the
       rail, with nothing to do with it. What crowded the rail was the FILLER between the
       columns, and filler is exactly what the strip replaces there. */
    if (kind !== "strip" && kind !== "section") {
      for (const [b, dir] of [[railBands.left, 1], [railBands.right, -1]]) {
        if (!b || b.real === false || !b.coreY) continue;
        /* FROM THE TOP OF THE SCREEN, AND DOWN TO WHOEVER HOLDS THE WALL BELOW.
           Where a SECTION stands in the band under the rail - the launchers' pane, at the
           bottom-right corner of a tall screen - the strip has to stop above it, and the
           wall below that is the filler's to cover: clipping it there left a wedge of bare
           map along the bottom edge between the last sector and the leaning corner of the
           launchers' own pane, 25 px of it at 1920x1080. Where no section is in the band
           below (a short screen, where `clearLaunchers` has already stepped those buttons
           inboard of it), the wall is the strip's all the way down, and stopping the clip
           at the tiles left the mirror image of the same wedge: 28 px at 1366x768, between
           the strip's own bottom and where the sector below it reaches the wall.
           `bandEnd` is set once per band, after the columns are cut and before any filler
           is, which is the only moment both answers are known. */
        const end = b.bandEnd ?? b.coreY[1];
        parts = parts.flatMap(q => {
          const bx = bbox(q);
          if (dir > 0 ? bx.x0 >= b.band : bx.x1 <= b.band) return [q];
          if (bx.y0 >= end) return [q];
          if (bx.y1 <= end) { const kept = clipHP(q, b.band, 0, dir, 0); return kept ? [kept] : []; }
          const [above, below] = split(q, 0, end, 0, -1);
          const kept = above ? clipHP(above, b.band, 0, dir, 0) : null;
          return [kept, below].filter(Boolean);
        });
      }
    }
    let first = null;
    for (const q of parts) {
      if (!q || q.length < 3) continue;
      const edge = touchesEdge(q, W, H);
      if (!edge && (area(q) < 40 || thickness(q) < 6)) continue;
      const p = { poly: q, content: !!tone, tone, kind, rank: rank == null ? 9 : rank };
      panes.push(p); first = first || p;
    }
    return first;
  };

  /*
   * A COLUMN IS A STACK, NOT A NEIGHBOURHOOD (16.09).
   *
   * Blocks that share a strip of screen share a column, and a column is cut into one
   * section per block by horizontal seams between them. That only works if the blocks
   * are ABOVE AND BELOW each other, which is what "column" is supposed to mean.
   *
   * The rule used to be a single number: anything whose box came within
   * `2 * PAD_SIDE + 10` = 34 px of the column joined it. The distance is the right
   * concern - two panes each claiming PAD_SIDE out of a 12 px gap would overlap, and an
   * overlap is the one thing the partition may not produce - but it is not the whole
   * question, and the half it left out cost a band of desk widths.
   *
   * MEASURED, 16.09, Chromium, fresh load at each width (audit/glass-harness.html):
   *
   *   1152 - 1184   stacked layout          19 panes, 0 block failures
   *   1200 - 1312   desk                    15 panes, **16 block failures**
   *   1328 - 1456   desk                    18-19 panes, 0 block failures
   *
   * Every width in that band, and only that band. At 1280 the top row is the Despair
   * rail at 449..831 and the status strip and tray at 843..1149 - a 12 px gap, because
   * the rail is centred and the right column is anchored to the wall, so the two close
   * on each other as the screen narrows and meet at 34 px somewhere around 1328. Under
   * the old rule the rail joined the tray's column, and then the section loop below
   * refused to cut it: `three` (y 0..63), `rail` (44..135) and `tray` (67..158) overlap
   * vertically, and blocks that overlap vertically share one pane by design. One pane,
   * toned for the last item, so the rail and the status strip had no pane of their own -
   * eight corners, each failing both halves of the check, sixteen.
   *
   * So the distance test keeps its job and gains a second question: are these two blocks
   * ABOVE one another, or BESIDE one another? Two blocks at the same height are
   * neighbours whatever the gap, and a column of neighbours cannot be sectioned. Twelve
   * pixels of vertical overlap is the same tolerance the section loop uses for "a touch
   * is not an overlap", and it is deliberately the same number: they are two halves of
   * one decision and they must not drift.
   *
   * Blocks whose boxes genuinely overlap horizontally still share a column however they
   * sit vertically - that is a true stack and the old behaviour is right for it. What
   * changes is only the case the rule was inferring: a GAP.
   *
   * The pane's padding pays for this - see `padSide` in `buildColumn`.
   */
  /* A REAL STACK IS ASKED FOR FIRST (22.09).
     The search took the first column that would have the block, in the order the columns
     were made - and the Despair rail's is made before the status strip's. At 1264 to 1400
     wide the rail stands 3 to 20 px left of the strip, so the Projects tray, which sits
     exactly under the strip, was offered the rail's column first, passed its "near but not
     beside" test, and joined it: one pane cut from the rail across to the wall, the strip's
     own pane inside it, an overlap 226 px deep and five corners on the wrong glass at
     1366 x 768 (ov1 bf5 on every width from 1264 to 1400). A column the block overlaps
     horizontally is where it belongs; the gap rule is only for when there is none. */
  const columnsOf = list => {
    const cols = [];
    const beside = (c, b) => c.items.some(i =>
      Math.min(i.y + i.h, b.y + b.h) - Math.max(i.y, b.y) > 12);
    const overOf = (c, b) => Math.min(c.x1, b.x + b.w) - Math.max(c.x0, b.x);
    for (const b of list) {
      const c = cols.find(c => overOf(c, b) > 0)          // a real stack, whatever the heights
        ?? cols.find(c => {
          const over = overOf(c, b);
          if (over <= -(2 * PAD_SIDE + 10)) return false;  // far enough apart to pad both panes
          return !beside(c, b);
        });
      if (c) { c.items.push(b); c.x0 = Math.min(c.x0, b.x); c.x1 = Math.max(c.x1, b.x + b.w); c.y0 = Math.min(c.y0, b.y); c.y1 = Math.max(c.y1, b.y + b.h); }
      else cols.push({ x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h, items: [b] });
    }
    cols.forEach(c => c.items.sort((p, q) => p.y - q.y));
    return cols.sort((p, q) => p.x0 - q.x0);
  };

  /* a column's pane: the padded block rectangle rotated with the field, its near
     side run off the screen edge, clipped to the screen; the block is rotated by
     the same angle around the same pivot, so glass and panel agree exactly */
  const buildColumn = (ctx, c, cols, band) => {
    const { W, H, FW, push } = ctx;
    const cx = (c.x0 + c.x1) / 2, h = c.y1 - c.y0;
    const s0 = field(cx, FW, band);
    /* THE ROOM TILE BESIDE THE NOTICES (E78 fix h76-HF4, 14.10.2026): the only block a bottom column holds alone
       besides the notice tile. HF4 ended its pane PAD_FAR under the box and cut a plain pane under it; E78 fix r2-H3
       (14.10.2026, the owner: the picture runs past the screen's edge) gives the column its foot back, so its pane
       runs to the screen's foot like any other column of the band, and the box is what makes it short
       (`roomNotesH`). IT KEEPS ITS TILT (E78 fix r1-G3, the owner, 14.10.2026: "Zostaw kafel przekrzywiony" -
       leave the tile tilted, said of C0's shot, where it leaned 6 degrees at 1366x768): the column tilts by the
       field's rule like any other. Where that tilts it: C0's shorter box moved it 16 px left (the gap off the
       notice tile is 32 + h0 x tan 8, `roomPlacement`, 84.8 px at 1.2.76's 376 and 68.4 at C0's 259), and its
       midpoint, 535.5 at 1366x768, left the upright zone below (from 546.4 there); HF4 kept that left edge, so it
       leans 6 degrees at 1366x768 and 1366x657, as at C0, and at no other 'notes' size (Chromium, the glass
       harness, 14.10.2026; the sweep pins the angle, PIN_TILT). Under the clock it is a member of the clock's
       column, in the top band, and none of this touches it. */
    let theta = Math.abs(cx - FW / 2) < 0.1 * FW ? 0 : Math.min(8 * DEG, Math.max(6 * DEG, Math.atan(Math.abs(s0))));
    // a neighbour too close forbids the tilt that would swing the pane into it
    for (const o of cols) if (o !== c) { const gap = o.x0 > c.x1 ? o.x0 - c.x1 : c.x0 - o.x1; if (gap >= 0) theta = Math.min(theta, Math.atan(Math.max(0, gap - 2 * PAD_SIDE - FILL_MIN) / Math.max(h, 1))); }
    const s = Math.sign(s0) * Math.tan(theta);
    const phi = -Math.atan(s);
    const px = cx < W / 2 ? c.x1 : c.x0;
    const py = band === "top" ? c.y0 : c.y1;
    const cs = Math.cos(phi), sn = Math.sin(phi);
    const rot = (X, Y) => [px + X * cs - Y * sn, py + X * sn + Y * cs];
    // the rotation goes into a stylesheet rule keyed by the block's selector (applyRotations), so a
    // block the module re-renders from scratch wears it the moment it appears; a union of several
    // elements, each with its own origin, gets a rule a member keyed by its id (`blockTurns`, E23 C1d)
    const turn = Math.abs(phi) < 0.004 ? "none" : "rotate(" + phi + "rad)";
    /* THE VOICE TILE IS THE TRAY COLUMN'S TAIL (E78 C6). It takes no part in the column's tilt or
       width - those are the tray's and the status strip's, as they were before it - and is settled
       against them here: its x against the turn, its height against the corner's pane under it
       (`settleVoice`). It turns with the column like every fixed block. */
    /* `lift`: how far over the tile's top its pane's top edge runs, in the tile's own turned frame - half the gap
       from the tray's box to the tile's place under the tray (`y0`, the seam's rule below), 12 px with the tray at
       its five rows and more with fewer. The buttons stand on the pane by it (E78 fix r2-H3, stained-glass.css).
       Since E96 C4 the tile stands lower than `y0` (`settleVoice`) and its pane's top edge comes down with it, by
       the same lift, so the buttons stand where they stood on the tile and the pane. */
    const trayB = c.items[c.items.length - 1];
    let tail = null, railHug = false, railNear = null, lift = 0;
    if (c.tail) {
      const turn0 = { px, py, cs, sn }, fl = c.floor ?? H;
      tail = settleVoice(c.tail, W, turn0, fl, H, ctx.wall);
      lift = Math.max(0, (tail.y0 - (trayB.y + trayB.h)) / 2);
      /* AT THE WALL UNDER THE TAB RAIL'S RUN (E96 C4; the owner: "miedzy nim a po prawej jest dziura w kurtynie,
         ktorej nie powinno byc"). With Foundry's tab rail at the wall the column stands at the pin, off it, and the
         tile with it; under the pin's column the band between the tile's pane and the rail's strip was bare map
         (C3's Open 6: about 90 px at 2000x1072, Chromium, the glass harness, `?windows=off`). Where the tile's
         pane, centred on the side, starts below the tiles' run (`coreY[1]`, the band's foot) where it enters the
         band, the tile stands at the screen's own wall as it does without the rail, and its pane and the pane over
         it run into the wall (`tailHug` below); the strip is cut around them (`cutStrips`). A rail whose run
         reaches the tile's rows keeps the tile at the pin, as C3 left it. */
      const rb = ctx.railBands?.right, hugsR = c.x1 + PAD_SIDE > W - HUG;
      if (!hugsR && rb && rb.real !== false && rb.coreY && Number.isFinite(rb.band)) {
        const at = settleVoice(c.tail, W, turn0, fl, H, W);
        const Yv = at.y - lift - py, Xb = (rb.band - px + Yv * sn) / cs;
        if (py + Xb * sn + Yv * cs >= rb.coreY[1]) { tail = at; railHug = true; }
        else { tail = settleVoice(c.tail, W, turn0, fl, H, rb.band); railNear = rb.band; }
      }
      c.tail = tail;
    }
    if (tail) {
      ctx.voice = { x: tail.x, y: tail.y, w: tail.w, h: tail.h, fit: tail.fit, lift };
      ctx.turns.push({ sel: tail.sel, el: null, origin: (px - tail.x) + "px " + (py - tail.y) + "px", transform: turn });
    }
    for (const b of c.items) {
      /* A FIXED BLOCK IS STILL A BLOCK ON THE GLASS. Its box is a constant - the notice tile is
         cut once and never recut, whatever arrives in it - but its element must still turn with
         its pane, or the cards stand upright inside a tilted piece of glass (1.2.38). The rule
         is keyed to the SELECTOR and computed from the fixed box, so it holds even though the
         element is not measured and may not exist yet. Since E81 C8 popup.mjs builds the tile at
         `ready`, with the history's button in its corner and before the glass is cut, but the rule
         does not lean on that: a tile removed and rebuilt by `container()` turns all the same. */
      ctx.turns.push(...blockTurns(b, px, py, turn, ctx.rectOf));
    }
    /* TWO COLUMNS SHARE THE GAP BETWEEN THEM, THEY DO NOT EACH CLAIM IT.
       -----------------------------------------------------------------------
       A pane is the block's box plus PAD_SIDE on each flank, and that is what the
       34 px merge rule in `columnsOf` was protecting: with a 12 px gap between
       two columns, two 12 px pads overlap by 12 and an overlap is the one thing
       this partition may not produce.

       Now that neighbours are allowed to stay separate columns, the pad has to
       pay for it: each side takes at most half the gap, so the seam lands in the
       middle of it and the two panes meet rather than cross. (It used to be one
       pixel short of half, which left a sliver the filler never filled; the
       note inside the function says what replaced it.)

       The nearest neighbour decides, so a column with nothing beside it keeps
       the full 12 and nothing at any other width moves. The tilt was already
       taking the same gap into account two dozen lines up, and comes out at zero
       for every gap where the pads are cut to meet. */
    const padSide = side => {
      let free = Infinity;
      for (const o of cols) {
        if (o === c) continue;
        const gap = side < 0 ? c.x0 - o.x1 : o.x0 - c.x1;
        if (gap >= 0) free = Math.min(free, gap);
      }
      /* AND WHERE WHAT IS LEFT IS TOO NARROW TO FILL, THE TWO MEET (22.09). One pixel short
         of half left a 2 px sliver between the Despair rail's pane and the status strip's,
         and the filler cuts nothing under FILL_MIN: bare map at the screen's top edge,
         the one edge gap left at 1366 x 768. Under that width both panes take exactly half,
         so they share one seam. Exact is safe here because it only happens where the tilt
         rule above has already stood both columns upright (the same FILL_MIN there), and
         a shared edge between two upright rectangles is the one thing the self-check
         counts as clean. */
      if (free === Infinity) return PAD_SIDE;
      return free - 2 * PAD_SIDE < FILL_MIN ? Math.max(0, free / 2) : PAD_SIDE;
    };
    let X0 = c.x0 - px - padSide(-1), X1 = c.x1 - px + padSide(1);
    const Yn = (band === "top" ? c.y0 - py : c.y1 - py) + (band === "top" ? -3000 : 3000);
    const Yf = band === "top" ? (tail ? tail.y + tail.h : c.y1) - py + PAD_FAR : c.y0 - py - PAD_FAR;
    /* the seam between the tray's pane and the voice tile's, halfway down the 24 px under the tray's
       capacity; Xc is the voice pane's left edge, PAD_SIDE left of the tile */
    const tray = trayB;
    const Yseam = tail ? ((tray.y + tray.h) + tail.y0) / 2 - py : null, Xc = tail ? tail.x - px - PAD_SIDE : null;
    /* the voice pane's own top edge: `lift` over the tile, at the seam itself while the tile stands at `y0` */
    const Yv = tail ? Math.max(Yseam, tail.y - lift - py) : null;
    // a column near a wall (under Foundry's sidebar too) runs its pane into the wall: the far corner is
    // pushed past the screen edge by the gap and by the swing of the rotation, so no bare wedge is left
    /* A COLUMN AT A WALL ALWAYS HUGS IT. This used to stand down on a side where a rail
       has its band, on the argument that the band is the strip's - and that is what left
       the notice tile's pane 31 px short of the left wall, with a 208 px wedge of bare map
       down the edge (07.09). It was a second line of defence for something `push` already
       does: every non-strip pane is clipped out of the band across the tiles' own run, and
       only across it. Above and below the tiles the column keeps the wall, as it should. */
    c.hugL = c.x0 - PAD_SIDE < HUG; c.hugR = c.x1 + PAD_SIDE > W - HUG;
    /* AND A COLUMN WITH A TAIL IS AS WIDE AS ITS TAIL (E96 C3, 09.11.2026; the owner on the 1.2.101 hotfix's review,
       "Przyciski maja nie wychodzic poza panel livekit. Panel ma byc polaczony z reszta kurtyny"). The tile is settled
       against the pin (`settleVoice`), and the column turns about its top left corner, so 200 px down it the tile's
       right side stands about 28 px further right in the column's frame than the tray's, and the column's right edge
       is the tray's. At a wall the column hugs it and the pane runs past the tile; with Foundry's tab rail the column
       stands off the wall, and the voice pane ended short of the tile: in Chromium on the glass harness with
       `?windows=off`, a GM at 2000x1072, the pane's right edge 1788 at its top, the buttons' 1811 and 1806, both with two
       corners off it, and the seam with the tray 176 px long under a tile 191 wide (1.2.99 to 1.2.101 alike). So the
       right edge takes the tile's side and its pad, as the left one does (`Xc`), and the tray's pane above it with it,
       so the two still meet along one straight seam and one straight right edge. A column that hugs the wall is left
       as it was: its pane runs into the wall below. R3121. */
    if (tail && !c.hugR && !railHug && railNear == null) X1 = Math.max(X1, tail.x + tail.w - px + PAD_SIDE);
    /* BOTH CORNERS, NOT JUST THE FAR ONE.
       A column at a wall runs its pane into the wall so no bare wedge is left there, and
       that was measured on the FAR corner alone. A pane is rotated, so its two corners sit
       at different distances from the wall: correcting one leaves the other inside, and
       what is left is exactly a wedge - 208 px of it down the left wall under the notice
       tile at 1440p, which is the hole in the glass Dawid photographed on 07.09. The
       filler between the columns used to cover it; once the rails' bands were reserved,
       there was no filler there to do it. Whichever corner is further in decides. */
    if (c.hugL) { const over = Math.max(rot(X0, Yf)[0], rot(X0, Yn)[0]) + 2; if (over > 0) X0 -= over / cs; }
    if (c.hugR) { const over = W + 2 - Math.min(rot(X1, Yf)[0], rot(X1, Yn)[0]); if (over > 0) X1 += over / cs; }
    const rect = band === "top" ? [rot(X0, Yn), rot(X1, Yn), rot(X1, Yf), rot(X0, Yf)] : [rot(X0, Yf), rot(X1, Yf), rot(X1, Yn), rot(X0, Yn)];
    /* AND THE TWO CORNERS ON THE WALL GO ON THE FAR SIDE OF IT.
       A hugging column is pushed into the wall by measuring ONE of its corners, and a
       rotated pane's corners are at different distances from it: correct one and the other
       can still finish a few pixels inside, leaving a long thin wedge of bare map down the
       edge (208 px of it under the notice tile at 1440p - the hole in the glass, 07.09).
       Here the pane's own wall-side corners are moved past the edge, which is exact rather
       than computed, and moving two corners of a quad the same way leaves it convex. A
       blanket version of this - every vertex near any wall - does NOT: it notches the
       sectors, whose vertices already sit exactly on the edge. */
    if (c.hugL || c.hugR) {
      const xs = rect.map(q => q[0]).sort((a, b) => a - b);
      const near = c.hugL ? xs[1] : xs[2];
      for (const q of rect) {
        if (c.hugL && q[0] <= near && q[0] > -2) q[0] = -2;
        if (c.hugR && q[0] >= near && q[0] < W + 2) q[0] = W + 2;
      }
    }
    const edgeY = band === "top" ? 0 : H;
    const at = (X) => { const q = rot(X, 0); return { x0: q[0] + s * (edgeY - q[1]), s, edgeY }; };
    c.rayL = at(X0); c.rayR = at(X1);
    /* WITH A TAIL, TWO FAR EDGES. The fillers beside the column and the rings under it read the
       tray's pane, which ends at the seam, so they are cut as they were before the voice tile had
       a pane; the strip down the wall starts under the voice pane, so `far` is that pane's foot. */
    const Yd = tail ? Yseam : Yf;
    c.farL = rot(X0, Yd); c.farR = rot(X1, Yd);
    c.far = { p: tail ? rot(Xc, Yf) : c.farL, d: [cs, sn] };
    c.depthL = Math.abs(c.farL[1] - edgeY); c.depthR = Math.abs(c.farR[1] - edgeY);
    c.s = s; c.phi = phi; c.rot = rot; c.px = px; c.py = py; c.cs = cs; c.sn = sn;
    c.corners = [rot(c.x0 - px, c.y0 - py), rot(c.x1 - px, c.y0 - py), rot(c.x1 - px, c.y1 - py), rot(c.x0 - px, c.y1 - py)].filter(q => q[0] > 1 && q[0] < W - 1 && q[1] > 1 && q[1] < H - 1);
    let piece = clipRect(rect, W, H);
    /* AND THE PINNED COLUMN'S OWN PANES RUN TO THE BAND (E96 C4). Beside the pin the column's panes ended at its own
       right side and the fillers between it and the rail's strip end in a ledge, so above the tile's pane there was
       bare map too: at 1366x768 (Chromium, the glass harness, `?windows=off`) about 65 x 75 px between the tray's
       pane, the strip and the tile's pane. With the tile at the band or the wall the column's panes are cut to the
       band's edge (a vertical half-plane, so each stays convex) and, kept cut out to the wall as `wide`, reach the
       strip's inner edge in `cutStrips`; a filler they now cover is dropped by the partition as any filler on a
       section is. The rays and far edges the fillers and the strip read stay the column's own (`X1`). */
    const rbC = railHug || railNear != null ? ctx.railBands.right : null;
    let pieceW = null;
    if (rbC && band === "top" && piece) {
      const Xw = Math.max(...[Yn, Yf].map(Y => (W + 2 - px + Y * sn) / cs)) + 1;
      pieceW = clipRect([rot(X0, Yn), rot(Xw, Yn), rot(Xw, Yf), rot(X0, Yf)], W, H);
      piece = pieceW && clipHP(pieceW, rbC.band, 0, -1, 0);
    }
    const colOut = ctx.voiceOut || (ctx.voiceOut = []);
    const keepWide = (sec, w) => { if (sec && w) { sec.wide = w; colOut.push(sec); } };
    for (let m = 0; m + 1 < c.items.length && piece; m++) {
      const up = c.items[m], dn = c.items[m + 1];
      if (dn.y < up.y + up.h - 12) continue;                 // blocks that truly overlap share one pane; a touch does not
      const Ydiv = ((up.y + up.h) + dn.y) / 2 - py;
      const pt = rot(0, Ydiv);
      const [below, above] = split(piece, pt[0], pt[1], -sn, cs);
      const sec = push(above, up.cls, "section", 0); if (sec) sec.empty = !up.r && !up.solid; piece = below;
      if (pieceW) { const [bw, aw] = split(pieceW, pt[0], pt[1], -sn, cs); keepWide(sec, aw); pieceW = bw; }
    }
    let below = null;
    if (tail && piece) { const pt = rot(0, Yseam); [below, piece] = split(piece, pt[0], pt[1], -sn, cs); if (pieceW) pieceW = split(pieceW, pt[0], pt[1], -sn, cs)[1]; }
    c.pane = push(piece, c.items[c.items.length - 1].cls, "section", 0);
    keepWide(c.pane, pieceW);
    if (c.pane) c.pane.empty = !c.items[c.items.length - 1].r && !c.items[c.items.length - 1].solid;
    /* Under the seam the voice tile's pane runs from PAD_SIDE left of the tile to the wall, and what
       is left of it is cut away and not pushed: bare map, the area `voice-left`, which the
       self-check keeps empty of every pane (Q16). */
    if (below) {
      const q = rot(Xc, Yseam);
      let [right, left] = split(below, q[0], q[1], cs, sn);
      if (left) ctx.open.push({ name: "voice-left", poly: left });
      /* E96 C4: under the rail's run the tile's panes are cut to the wall from their own rectangle, the tray's pane
         keeping the pin's edge; and a tile come down the side leaves a pane between the seam and its own, as wide as
         its own (`mid`), so nothing between the tray and the tile is bare. Both are `ctx.voiceOut`, which the strip
         down the wall is cut around. */
      /* the band's edge for a tile at it (`railNear`); the pane is also kept as cut out to the wall (`wide`), which
         `cutStrips` trims to the strip's own inner edge, so neither the band's edge nor the strip's lean leaves a
         sliver of map between them */
      const rb = railHug || railNear != null ? ctx.railBands.right : null;
      let wide = null;
      if (rb) {
        const X1v = Math.max(...[Yseam, Yf].map(Y => (W + 2 - px + Y * sn) / cs)) + 1;
        wide = clipRect([rot(Xc, Yseam), rot(X1v, Yseam), rot(X1v, Yf), rot(Xc, Yf)], W, H);
        right = wide;
      }
      let mid = null;
      if (right && Yv - Yseam > 1) { const m = rot(0, Yv); [right, mid] = split(right, m[0], m[1], -sn, cs); }
      const out = ctx.voiceOut || (ctx.voiceOut = []), end = rb ? (rb.bandEnd ?? rb.coreY[1]) : -Infinity;
      const vp = push(railNear != null ? clipHP(right, rb.band, 0, -1, 0) : right, tail.cls, "section", 0);
      if (vp) { if (railNear != null) vp.wide = right; out.push(vp); }
      if (mid) {
        /* over the rail's run the band is the strip's: the pane over the tile stops at the band's edge there */
        const parts = rb && railHug ? (() => { const [up, dn] = split(mid, 0, end, 0, -1); return [[up, true], [dn, false]]; })() : [[mid, railNear != null]];
        for (const [pp, clip] of parts) if (pp) {
          const mp = push(clip ? clipHP(pp, rb.band, 0, -1, 0) : pp, null, "section", 0);
          if (mp) { mp.voiceGap = true; if (clip) mp.wide = pp; out.push(mp); }
        }
      }
    }
  };

  /* filler between two rays of one band: a pencil of rays interpolated between the
     bounding pair, a far edge that continues the pane's own depth for one cell,
     falls to a thin ledge over the next two, and stays a ledge in the open */
  const rayX = (r, y) => r.x0 + r.s * (y - r.edgeY);
  const cutSectors = (ctx, band, rA, rB, dA, dB, ledgeDepth) => {
    const { W, H, rnd, push, needles } = ctx;
    const edgeY = band === "top" ? 0 : H, sgn = band === "top" ? 1 : -1;
    rA = { ...rA, edgeY }; rB = { ...rB, edgeY };
    const gap = rB.x0 - rA.x0;
    if (gap < FILL_MIN) return;
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

  /* the filler of both bands: between the wall and the first column, between
     neighbouring columns, and between the last column and the wall */
  const fillBands = (ctx, top, bot) => {
    const { W, rnd } = ctx;
    const sectors = (...args) => cutSectors(ctx, ...args);
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
  };

  /* rings: two long transverse cracks per half of the top band, starting at the
     corner and descending towards the centre; they cut filler only, and a few of
     the inner pieces are gone, never one beside a panel or on the wall */
  const cutRings = (ctx, top) => {
    const { W, H, rnd, panes, push } = ctx;
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
    return ringLines;
  };

  /* side strips: two convex quads per side between the wall and a straight inner line,
     wide under the top panel, thin at mid-height, wide again above the bottom panel.
     The quads share the mid seam exactly (one vertex on the wall, one on the inner
     line), the top one begins on the far edge of the corner pane and the bottom one
     ends on the far edge of the bottom corner pane, so the wall is covered without a
     gap; then one family of parallel cuts per half: a partition by construction */
  const cutStrips = (ctx, top, bot, railBands) => {
    const { W, H, rnd, panes } = ctx;
    const tiles = {};
    /* THE STRIP GOES AROUND THE TILE'S PANES (E96 C4). Under the tab rail's run the voice tile's pane and the pane over
       it run into the wall (`buildColumn`, `railHug`), so each strip piece is cut around them, as convex pieces: the
       part of the piece outside each of a pane's edges in turn, the rest dropped. Off the rail's side, or with no such
       panes, nothing is cut. They are not read as the panes the strip yields to either (`yTop`, `yBot`): the strip still
       runs the wall's whole height, around them. */
    const outs = (ctx.voiceOut || []).filter(o => o.poly);
    const minus = (P, Q) => {
      if (!overlaps(P, Q)) return [P];
      const n = Q.length, mx = Q.reduce((t, q) => t + q[0], 0) / n, my = Q.reduce((t, q) => t + q[1], 0) / n, keep = [];
      let rest = P;
      for (let i = 0; i < n && rest; i++) {
        const a = Q[i], e = Q[(i + 1) % n];
        let nx = -(e[1] - a[1]), ny = e[0] - a[0];
        if ((mx - a[0]) * nx + (my - a[1]) * ny > 0) { nx = -nx; ny = -ny; }
        const [o, r] = split(rest, a[0], a[1], nx, ny);
        if (o) keep.push(o);
        rest = r;
      }
      return keep;
    };
    const push = (poly, tone, kind, rank) => {
      let parts = poly ? [poly] : [];
      for (const o of outs) parts = parts.flatMap(q => minus(q, o.poly));
      let first = null;
      for (const q of parts) { const p = ctx.push(q, tone, kind, rank); first = first || p; }
      return first;
    };
    // Foundry's tiles, measured with their rotation off and in the curtain's own pixels (the page may be scaled)
    const lineY = (c, x) => { const [fx, fy] = c.far.p, [dx, dy] = c.far.d; return fy + (x - fx) * dy / dx; };
    for (const side of [0, 1]) {
      const wall = side ? W : 0, dir = side ? -1 : 1;
      const wTop = 136 + rnd() * 34; let wMid = 62 + rnd() * 10, wBot = 116 + rnd() * 34;
      const tb = (side ? railBands.right : railBands.left)?.real
        ? (side ? railBands.right : railBands.left)
        : { ...(side ? { x0: W - 68, y0: 290, x1: W - 20, y1: 620 } : { x0: 20, y0: 320, x1: 92, y1: 608 }), real: false };
      // one straight edge under the tiles: 22 px of lean over its run, and never inside them - the edge
      // runs at least 14 px clear of the tiles' far side and past their bottom, however tall the rail is
      const tileFar = side ? W - tb.x0 : tb.x1;
      // the wall zone reserved for this rail, or null on a side that has none
      const bandW = tb.real !== false ? (side ? W - tb.band : tb.band) : null;
      /* where the strip's run begins, near enough to size the lean before `yTop` is known:
         the tiles cannot start above their own band, and the band's top is already measured */
      const yTop0 = tb.real !== false && tb.coreY ? tb.coreY[0] : 0;
      /* AND THE STRIP NEVER NARROWS INSIDE IT. The strip's shape is wide at the top, pinched
         to about 62 px at its middle and wide again at the bottom. That pinch is narrower
         than the band, so where the filler had been cut away to make room for the rail there
         was nothing left to cover the wall - 27 gaps at the screen edge, which the partition's
         own check found before it was ever visible. With a rail on this side the strip stays
         at least as wide as the tiles plus their clearance all the way down.
         MONOTONICALLY, though. Holding the full BAND width at the middle put a dent in the
         quad - wide at the top, in at the control point, out again at the middle - and a
         dented polygon is not convex, which is an invariant the whole partition rests on
         (and which made the self-check call 47 covered samples "gaps"). Wide at the top,
         narrowing once, and never widening again. */
      if (bandW) { wMid = Math.max(wMid, tileFar + 14); }
      /* With a rail on this side the strip IS the reserved band - exactly, or it overlaps
         the panes that were clipped out of it and the partition throws its pieces away. */
      const wTopFit = bandW ?? Math.max(wTop, tileFar + 14 + STRIP_LEAN);
      const yCtl = Math.max(640, tb.y1 + 24);
      /* the lean the angle asks for over THIS run, never so deep that it reaches the tiles */
      const lean = bandW ? Math.round((yCtl - Math.max(0, yTop0)) * Math.tan(STRIP_ANGLE)) : STRIP_LEAN;
      const wCtl = Math.max(wTopFit - lean, tileFar + 14);
      const cT = top.length ? top[side ? top.length - 1 : 0] : null, cB = bot.length ? bot[side ? bot.length - 1 : 0] : null;
      const hugT = cT && (side ? cT.hugR : cT.hugL), hugB = cB && (side ? cB.hugR : cB.hugL);
      /* WHAT ACTUALLY STANDS IN THE STRIP'S WAY, AND NOTHING ELSE.
         These two used to take any pane whose box came within 40 px of the strip's width, and
         that slack is what cost the tab rail its glass: the Projects tray ends 26 px clear of
         the rail's band and was still counted, so the strip began 338 px down the screen while
         the rail itself starts at 160 - 34 of its 64 tile corners ended up on four other panes
         and off the curtain entirely (measured 07.09). A pane is in the way if it OVERLAPS the
         band, and the band is the strip's own width or the tiles', whichever reaches further. */
      /* ONE EDGE, USED BY BOTH. `push` clips every non-strip pane out of the rail's band,
         so the only honest question here is whether a pane crosses THAT edge - and it has to
         be the same number, or the strip yields to panes that stop exactly where they were
         told to (which left the tab rail's shard starting 249 px down). Without a rail on
         this side there is no band, and the old width-plus-slack test stands. */
      const bandT = bandW ?? (wTopFit + 40);
      const bandB = bandW ?? (wBot + 40);
      let yTop = 0, yBot = H;
      if (hugT) yTop = Math.max(lineY(cT, wall), lineY(cT, wall + dir * wTopFit));
      else for (const p of panes) { if (outs.includes(p)) continue; const bb = bbox(p.poly); if ((side ? bb.x1 > W - bandT + 0.5 : bb.x0 < bandT - 0.5) && bb.y1 < H / 2) yTop = Math.max(yTop, bb.y1); }
      if (hugB) yBot = Math.min(lineY(cB, wall), lineY(cB, wall + dir * wBot));
      else for (const p of panes) { if (outs.includes(p)) continue; const bb = bbox(p.poly); if ((side ? bb.x1 > W - bandB + 0.5 : bb.x0 < bandB - 0.5) && bb.y0 >= H / 2) yBot = Math.min(yBot, bb.y0); }
      /* WITH NO RAIL ON THE WALL, NO STRETCH OF IT IS TOO SHORT (E77 C5, 13.10.2026). The 160
         below is what the tiles need to stand in; once Foundry's rails moved into the GM's
         windows and off a player's screen, nothing stands there, and the skip only left the
         wall bare between the clock's pane and the notice tile's: Chromium,
         audit/glass-harness.html, stained, edgeGaps 12 at 1920x1080 (y 644-732, the GM button's
         stretch) and 17 at 1366x768 (y 260-388), the GM's and the player's alike. Such a strip is
         cut as a short one - one quad from the clock's pane to the notice tile's - however short
         it is; under a pixel there is no wall left between the two. */
      const railed = tb.real !== false;
      if (yBot - yTop < (railed ? 160 : 1)) continue;
      /* A SHORT STRIP IS THE TILES' ALONE. Between a tall clock column (a long campaign name,
         a large interface scale) and the notice pane there can be too little of the edge for
         a mid seam with the tiles' shard above it: the seam was forced under the tiles, and
         the family cut across them. Under 420 px the strip has no mid seam and no lower
         family - it is one upper quad, and the tiles' shard is cut from that. The same
         applies to the skip above: a strip is dropped only when even the tiles cannot stand
         in it (and at 240 the left rail lost its shard at 140 % on a 900 px screen).

         WHAT THE SKIP LEAVES BARE (E81 C14, Chromium, audit/glass-harness.html, 12.10.2026).
         Nothing else is cut over that stretch of wall, and the self-check counts it. At 1280x720
         the clock's pane meets the left wall at 311 and the notice tile's at 440 - 129 px, under
         the 160 - so the left strip is not cut and `edgeGaps` reads 16 (the wall's samples from
         316 to 436, every 8 px). It read 16 on the harness before C14 as well, and the E81
         mockup's notes give 16 on 1.2.74's harness and on every layout they tried. The tile's
         pane met the wall at 440, 488 and 520 at 720, 768 and 800 px of height - the height less
         280 - so with this harness's clock the strip should be cut again from about 751 px (worked
         out from those three, not measured there). Covering that stretch is a change to the
         partition, and it is not made here. It holds for a wall with a rail only: since E77 C5
         a wall without one is cut however short (above), and the sweep reads 0 there.

         WHY THE RAIL USED TO STRADDLE, AND THE THREE CUTS THAT STOPPED IT (10.09).

         Three faults, each measured with the solver printing its own numbers:

         1 THE SEAM LANDED INSIDE THE RAIL. `yMid` reads `min(yBot - 120, max(..., yCtl + 60))`
           - the inner `max` keeps the seam below the tiles and the outer `min` overrules it.
           At 1920x1080 the tiles ran y 534 to 847, the seam landed at 700, and the shard - cut
           from the upper quad alone - stopped at 717. Answered by `seamFloor` just below.

         2 THE BAND WAS SIZED TO THE BOX, NOT THE TILES. `rail.offsetHeight` is whatever
           `max-height` left it, and at 2560x1440 that was 525 px around 314 px of tiles - so
           the band reserved 211 px of empty wall and asked for a skirt below THAT. Answered by
           `tilesBottom` in `railBox`.

         3 THE RAIL WAS BOUNDED TO THE NOTICE TILE'S BOX, NOT ITS PANE. That pane is leaned, so
           its top stands 46 to 60 px above its box; with the tools open at 2560x1440 the tiles
           ran to 1121 and the pane began at 1120. Answered by `notePaneLean` in `moduleLayout`.

         Dropping the mid seam also drops the LOWER QUAD, and that quad covers wall: doing
         without it left two gaps at the screen edge. A strip with no mid seam now reaches
         `yB0` - where the lower quad would have ended - so one quad or two, the same wall is
         covered.

         WHAT IS LEFT. 2560x1440 is whole, both rails, tools open and shut. 1920x1080 is 46 of
         48 corners with the tools shut and 76 of 80 with them open; 1600x900 is 38 and 61. The
         stragglers sit on the notice tile's `section` pane, and they are the one collision
         these three cuts cannot resolve: Foundry's control column is 314 px and cannot wrap
         (`flex-wrap: nowrap`), so between the GM button and that pane a 1080p screen is about
         50 px short and a 900 px screen about 130. Nothing is drawn wrong - the tiles stand on
         the notice tile's glass rather than on a hole - and the way to close it is to move the
         notice tile down, which is where the module's own cards live and so Dawid's call.

         FOUR OTHER SHAPES OF THIS WERE BUILT AND REVERTED, all on 10.09: clipping `section`
         panes out of the band with no shield (the wrong pane becomes NO pane, 10 of 48 corners
         in a hole), with the strip made to cover the whole band (48/48 and 80/80 - and the
         notice tile loses a corner of its own glass, two block failures, the suite fails on
         it), shielding by the block's upright box (no change, the panes are leaned), and by
         the leaned box (the strip overlaps a kept section and is thrown away whole: 48 of 48
         corners on nothing, 72 edge gaps). Sections stay exempt. */
      /* AND "SHORT" IS RELATIVE TO WHAT HAS TO STAND IN IT, WHICH 420 DOES NOT ASK.
         `yMid` reads `min(yBot - 120, max(..., yCtl + 60))`: the inner `max` keeps the seam
         below the tiles and the outer `min` can overrule it. Where the seam cannot go below
         the tiles with its own clearance, the strip has no mid seam at all - the same answer
         420 gives, reached by measuring the thing that decides it. `coreY[1]` already carries
         the 34 px skirt; the 60 is the gap the seam keeps below that. */
      const seamFloor = (tb.real !== false && tb.coreY) ? tb.coreY[1] + 60 : -Infinity;
      const short = yBot - yTop < 420 || yBot - 120 < seamFloor;
      // the mid seam sits below the tiles' shard, so the shard is cut from the upper quad alone
      /* WHERE THE STRIP'S OWN BOTTOM IS, AND A STRIP WITH NO MID SEAM REACHES IT.
         `yB0` is where the lower quad would have ENDED, and where `hugB` is true that is below
         `yBot`. Ending the single quad at `yBot` instead left the difference bare: two gaps at
         the screen edge at 2560x1440, which the partition's own check found and the suite
         refused. One quad or two, the strip covers the same wall. */
      const yB0 = hugB ? Math.max(lineY(cB, wall), lineY(cB, wall + dir * wBot)) + 1 : yBot;
      const yMid = short ? yB0 : Math.min(yBot - 120, Math.max(yTop + (yBot - yTop) * (0.5 + (rnd() - 0.5) * 0.16), yCtl + 60));
      const tilt = (5 + rnd() * 5) * DEG * (rnd() < 0.5 ? 1 : -1);
      /* A STRIP THAT ENDS ON THE FLOOR ENDS PAST IT.
         The seam across the strip's foot is tilted, so its two ends sit at different
         heights - which is the point where the strip meets another pane, and a hole where
         it meets the bottom of the screen. With nothing below it in the band (a short desk,
         where `clearLaunchers` has stepped the module's buttons inboard) the seam landed on
         y = H at one end and 13 px above it at the other, and the wedge between was bare
         map: four samples of the edge check at 1366x768 and at 1280x800. Run both ends past
         the edge instead - `clipRect` takes them back to it - so the strip finishes square
         on the floor the way it finishes square on the wall. */
      const onFloor = short && yB0 >= H - 1;
      const foot = H + 40;
      /* AND IT DOES NOT NARROW ON THE WAY THERE. The strip is wide at the top and pinched
         at its middle because below the pinch there is another pane holding the wall. With
         nothing under it there is nothing to make room for, and the pinch was the hole: the
         foot came out 87 px wide inside a band of 121 at 1366x768, and the 34 px between
         them was bare map along the bottom edge. Widening the foot to the band makes the
         quad a rectangle, which is convex; the control point is dropped with it, because
         the vertex it adds would notch a shape that no longer narrows. */
      const footW = onFloor && bandW ? Math.max(wMid, wTopFit) : wMid;
      const M = [wall + dir * footW, onFloor ? foot : yMid],
            Wm = [wall, onFloor ? foot : yMid - wMid * Math.tan(tilt)];
      const yT0 = hugT ? Math.min(lineY(cT, wall), lineY(cT, wall + dir * wTopFit)) - 1 : yTop;
      /* THE CONTROL POINT ONLY EXISTS IF IT IS A CORNER. Once the strip was made to hold the
         tiles' width at its middle, `wCtl` and `wMid` came out equal, and the control vertex
         landed two pixels from `M` - a degenerate edge, which makes the quad non-convex and
         breaks the point-in-pane test the whole coverage check rests on (it then reported 47
         covered samples as holes). It is a corner or it is not there.
         AND ONLY WHERE THERE ARE TILES TO KEEP CLEAR OF (E77 C5). With no rail `yCtl` is the
         fallback box's 640, and on the short strip from 630 to 749 under the GM's room tile at
         1920x1080 that put the vertex 10 px under the top and 26 px in: a dent, one non-convex
         pane in the self-check. A wall with no rail has no tiles, so its strip has no such corner. */
      let upperQ = clipRect([[wall, yT0], [wall + dir * wTopFit, yT0], ...(railed && !onFloor && yCtl < yMid - 40 && wCtl > wMid + 4 ? [[wall + dir * wCtl, yCtl]] : []), M, Wm], W, H);
      /* the angle of that edge, for the tiles that sit on it (clockwise on the left, the mirror on the right).
         None with no rail on the wall (E77 C5): the GM button rode the left one until E77 C6, and
         turned to the fallback box's edge it stood at -8,631 34x74 at 1920x1080, off the screen. */
      if (railed) tiles[side ? "right" : "left"] = { angle: Math.atan((wTopFit - wCtl) / Math.max(1, yCtl - yTop)) * (side ? -1 : 1), yTop, wTop: wTopFit, wCtl, yCtl, origin: tb.origin || null, box: tb.core || [tb.x0, tb.x1], centre: tb.centre || null };
      let lowerQ = short ? null : clipRect([Wm, M, [wall + dir * wBot, yB0], [wall, yB0]], W, H);
      if (hugT && upperQ) { const [fx, fy] = cT.far.p; upperQ = clipHP(upperQ, fx, fy, -cT.sn, cT.cs); }
      // a short strip reaches the bottom column's pane, and is clipped by its far edge as the lower quad would be
      if (short && hugB && upperQ) { const [fx, fy] = cB.far.p; upperQ = clipHP(upperQ, fx, fy, cB.sn, -cB.cs); }
      if (hugB && lowerQ) { const [fx, fy] = cB.far.p; lowerQ = clipHP(lowerQ, fx, fy, cB.sn, -cB.cs); }
      /* the tile's panes stopped at the band's edge reach the strip's own inner edge, which leans off the band's
         as it runs down: each is its pane cut out to the wall and clipped by the upper quad's inner edge (an edge
         facing the open side, more across than along), a half-plane, so it stays convex. Under the quads' meeting
         the lower quad leans back in over the band (at 1366x768, 26 px in at the tile's foot), and following it there
         took the tile's corner off its pane (the self-check's bf 2); there the pane keeps the line and the strip is
         cut around it (`push` above). Kept where it overlaps no part of the upper quad, stays clear of the rail's
         tiles (`x0`, their swing included) and is no smaller than the pane. */
      if (side && railed) for (const o of outs) if (o.wide) {
        let q = o.wide;
        for (const Q of [upperQ]) if (Q && q) for (let i = 0; i < Q.length && q; i++) {
          const a = Q[i], e = Q[(i + 1) % Q.length], nx = e[1] - a[1], ny = -(e[0] - a[0]);
          if (Math.max(a[0], e[0]) >= W - 1) continue;
          const L = Math.hypot(nx, ny) || 1, n = (Q.reduce((t, r) => t + r[0], 0) / Q.length - a[0]) * nx + (Q.reduce((t, r) => t + r[1], 0) / Q.length - a[1]) * ny > 0 ? -1 : 1;
          if (n * nx / L > -0.7) continue;
          q = clipHP(q, a[0], a[1], n * nx, n * ny);
        }
        if (q && (!upperQ || !overlaps(q, upperQ)) && bbox(q).x1 < tb.x0 && area(q) >= area(o.poly) - 1) o.poly = q;
      }
      const cutFamily = (poly, slope, y0, y1, box) => {
        if (!poly) return;
        let pieces = [poly];
        if (box) {   // two shallow cuts just above and below the tiles; the piece between them is theirs alone
          for (const [yy, tilt] of [[box.y0 - 14, -0.10], [box.y1 + 14, 0.10]]) pieces = pieces.flatMap(pp => split(pp, wall, yy, -tilt, dir).filter(Boolean));
          const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
          const k = pieces.findIndex(pp => inside(pp, cx, cy));
          if (k >= 0) { const shard = push(pieces.splice(k, 1)[0], null, "strip", 9); if (shard) { shard.plain = box.real !== false; shard.shard = true; } }
        }
        let y = y0 + (y0 === yTop ? 320 + rnd() * 160 : 120 + rnd() * 200);
        while (y < y1 - 60) {
          const nx = 1, ny = -slope;                 // line x = wall + slope*(yy - y): normal (1, -slope)
          pieces = pieces.flatMap(pp => split(pp, wall, y, nx, ny).filter(Boolean));
          y += 180 + rnd() * 240;
        }
        for (const pp of pieces) push(pp, null, "strip", 9);
      };
      /* NO SPARE SHARD AT A RIGHT WALL WITH NO RAIL (E78 C6, S12-95). With no tab rail the band
         `tb` is the default box above, and the shard cut for it was painted as a rail's that is
         not there - the dotted spare strip at the right wall, under a player's tray and a GM's
         since E77 C5 put the sidebar in a window. Where the voice tile stands it would be the
         glass under its pane. The strip itself stays: it is what covers the wall. */
      cutFamily(upperQ, dir * (0.28 + rnd() * 0.12), yTop, yMid, railed || !side ? tb : null);
      cutFamily(lowerQ, -dir * (0.28 + rnd() * 0.12), yMid, yBot);
    }
    return tiles;
  };

  /*
   * THE STACK'S OWN CUT, BECAUSE THE PARTITION BELOW IS CUT FOR A DESK.
   *
   * `curtainShapes` reads the screen as two bands with a pencil of filler between
   * the columns of blocks in each. On a stacked layout (narrow.mjs) there are no
   * columns: every block is one full-width row at the top, the whole lower half of
   * the screen is board, and the desk partition answers that shape with one pane
   * over the entire stack and two enormous shards under it. Measured with it forced
   * on at 820 x 1180: 16 blocks off their own pane and 206 gaps at the screen edge.
   *
   * So the stacked screen gets its own cut, and it is built the other way round.
   * The desk partition ASSEMBLES panes and then checks that they tile the screen;
   * this one starts from the screen and CUTS it, and every cut is a straight line
   * through a convex piece. A line through a convex polygon gives two convex
   * polygons and nothing else, so the result is a partition of the whole screen
   * with no overlap and no gap by construction, whatever the blocks turn out to be.
   * That is what makes it safe on a shape nobody has measured yet.
   *
   * WHAT IT CANNOT DO, AND WHY THAT IS THE SHAPE RATHER THAN THE CODE. A seam
   * between two full-width rows has to run the full width, and it may not reach
   * into either row: with 14 px between them it can lean about a degree and no
   * more. The character has to come from where there is room for it - the seam
   * under the stack, which leans, and the strips down the two rails. Horizontal
   * slabs at the top and the board open below them is what a tall screen looks
   * like (E23 C4a: until then the field below was broken glass too, and it hid the
   * board; step 4 says what it measured), and pretending otherwise means cutting
   * through the clock.
   *
   * Nothing here leans a block: `ROT` is left empty, so `applyRotations` writes an
   * empty sheet and every block stands upright. A full-width pane has nowhere to
   * lean to.
   */
export   function stackShapes(W, H, rnd, boxes, page) {
    const open = [];   // the areas the cut leaves open on purpose (`board`): the callers write them to OPEN_AREAS (E54 G3)
    let pieces = [[[0, 0], [W, 0], [W, H], [0, H]]];
    /* one cut: a line through (px, py) at `ang`, applied to the pieces `only` admits.
       Restricting it to some of the pieces is still a partition - each piece is either
       left alone or replaced by its own two halves. */
    /* A PIECE CUT FOR A BLOCK IS FINISHED AND NOTHING CUTS IT AGAIN. Without this the
       strip down the left wall ran through the notice tile's own piece and the launcher's,
       and a block standing across two panes is exactly what the self-check calls a
       blockFail - eight of them, measured, before the claim was added. */
    const claimed = new Set();
    const cut = (px, py, ang, only) => {
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const next = [];
      for (const p of pieces) {
        if (claimed.has(p) || (only && !only(p))) { next.push(p); continue; }
        const [a, b] = split(p, px, py, nx, ny);
        if (a && b) next.push(a, b); else next.push(p);
      }
      pieces = next;
    };
    /* a box cut out of the field: four lines, each applied only to the pieces the box
       actually reaches, so the rest of the screen keeps whatever it already was */
    const cutBox = (x0, y0, x1, y1) => {
      const near = p => { const b = bbox(p); return b.x1 > x0 + 0.5 && b.x0 < x1 - 0.5 && b.y1 > y0 + 0.5 && b.y0 < y1 - 0.5; };
      cut(x0, y0, Math.PI / 2, near);
      cut(x1, y0, Math.PI / 2, near);
      cut(x0, y0, 0, near);
      cut(x0, y1, 0, near);
    };

    /* the stack is the full-width rows; whatever else is measured - the launchers -
       gets a pane of its own in the field below.

       A RESERVED BOX GETS NO PANE HERE, and that is the one thing this cut does not do
       that the desk one does. The notice tile is `fixed` in BLOCKS: its box is a constant
       standing in for a stack of cards that may not exist yet, and that constant is where
       the cards are ON A DESK. Stacked, styles/narrow.css sends them to the foot of the
       screen across its whole width, so the constant describes an empty corner - and a
       pane cut there is a pane cut for nothing. The cards keep their own card look, which
       `drpg-curtain-on` never took off them. */
    /* `b.r` is the MEASURED rectangle and the only honest test of "this block is
       really there": `moduleLayout` gives every box an `x/y/w/h`, a reserved one from
       its fallback and a measured one from the element. Reading a `measured` flag off
       these - the name `LAST.blocks` uses - found `undefined` on every box, so the
       stack came out empty, one pane covered the lot, and the self-check passed
       because it had nothing left to check. */
    /* WHAT MAKES A ROW IS THE STACK, NOT THE WIDTH (22.09). The Projects tray keeps its own
       width when stacked - 331 px at 1152 x 768, right-aligned under the status strip with
       5 px between them - so "wider than half the screen" called it loose and cut a box for
       it. The box's top edge, padded, ran 12 px up into the strip's row, and the strip's right
       end stood on the tray's glass: twelve block failures, at the one stacked width the
       sweep reported any. A block inside narrow.mjs's column is a row whatever its width. */
    const { inStack } = page;   // `stackPage`: whether a block's elements stand in narrow.mjs's column
    let rows = boxes.filter(b => b.r && (b.w > W * 0.5 || inStack(b))).sort((p, q) => p.y - q.y);
    const loose = boxes.filter(b => !rows.includes(b) && b.r);

    /* AND A ROW SCROLLED OUT OF THE STACK HAS NO GLASS.
       The stack has a ceiling and scrolls past it, and a block scrolled under that
       ceiling still reports the position it is LAID OUT at - `getBoundingClientRect`
       knows nothing about the clip above it. A pane cut there is a pane cut over the
       board, with the block it was cut for nowhere near it: four blockFails at 620 px
       of height, twenty at 640 x 360, measured. Every row is cut down to the part of
       it the stack actually shows, and a row with nothing left is not a row. */
    const seen = page.seen;   // `stackPage`: the column's box on the page, and the curtain's top it is read from
    if (seen) {
      const lo = seen.top - page.frameTop, hi = seen.bottom - page.frameTop;
      rows = rows.map(b => {
        const y0 = Math.max(b.y, lo), y1 = Math.min(b.y + b.h, hi);
        if (y1 - y0 <= 20) return null;
        // `clipped` tells the self-check not to count the part under the ceiling as the
        // block overflowing its box: the box is deliberately the smaller of the two
        return y0 === b.y && y1 === b.y + b.h ? b : { ...b, y: y0, h: y1 - y0, clipped: true };
      }).filter(Boolean);
    }

    /* Rows whose heights overlap stand side by side and share a tier: a seam across the
       screen between them would run through both. The tier is split by an upright seam in
       the middle of the gap between them instead (step 2b). Twelve pixels, the tolerance the
       desk's columns use for "a touch is not an overlap". */
    const tiers = [];
    for (const b of rows) {
      const g = tiers[tiers.length - 1];
      if (g && Math.min(g.y1, b.y + b.h) - Math.max(g.y0, b.y) > 12) {
        g.items.push(b); g.y0 = Math.min(g.y0, b.y); g.y1 = Math.max(g.y1, b.y + b.h);
      } else tiers.push({ y0: b.y, y1: b.y + b.h, items: [b] });
    }

    // 1. a seam down the middle of every gap between two tiers, leaning as far as the gap allows
    for (let i = 0; i + 1 < tiers.length; i++) {
      const a = tiers[i], b = tiers[i + 1];
      const gap = Math.max(0, b.y0 - a.y1);
      const rise = Math.max(0, gap / 2 - 3);
      const ang = (rnd() < 0.5 ? -1 : 1) * Math.min(4 * DEG, Math.atan(rise / (W / 2)));
      cut(W / 2, (a.y1 + b.y0) / 2, ang);
    }

    /* 2. the seam under the stack, which is the one that can lean: there is nothing
       below it but board, so it only has to clear the last row - and it is pushed down
       by its own rise so that the high end of it does. */
    const last = tiers[tiers.length - 1];
    const endAng = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 3) * DEG;
    const rise = Math.abs(Math.tan(endAng)) * (W / 2);
    const yBase = last ? last.y1 + PAD_FAR + rise : Math.min(H * 0.3, 160);
    cut(W / 2, yBase, endAng);

    // 2b. an upright seam between rows that share a tier, only through that tier's pieces
    for (const g of tiers) {
      const side = [...g.items].sort((p, q) => p.x - q.x);
      for (let i = 0; i + 1 < side.length; i++) {
        const x = (side[i].x + side[i].w + side[i + 1].x) / 2;
        cut(x, (g.y0 + g.y1) / 2, Math.PI / 2, p => { const bb = bbox(p); const cy = (bb.y0 + bb.y1) / 2; return cy > g.y0 && cy < g.y1; });
      }
    }

    /* 3. the blocks that are not rows: one box each, claimed so that nothing cut in the
       field afterwards runs through them. */
    for (const b of loose) {
      const x0 = Math.max(0, b.x - PAD_SIDE), y0 = Math.max(0, b.y - PAD_SIDE);
      const x1 = Math.min(W, b.x + b.w + PAD_SIDE), y1 = Math.min(H, b.y + b.h + PAD_SIDE);
      cutBox(x0, y0, x1, y1);
      const own = pieces.find(q => inside(q, b.x + b.w / 2, b.y + b.h / 2));
      if (own) claimed.add(own);
    }

    /* 4. the field below the stack: the rails' wall strips, and the board.
       THE BOARD IS NOT GLASS (E23 C4a, 07.11.2026; S12-04, E23-20). Until 1.2.100 the field was broken
       into a few long diagonals and a band along the foot, and every piece of it was a pane - painted
       about 70 % black, so on a stacked screen the board went dark under the stack: read in Chromium on
       the glass harness (6c9bd3c3), field panes covered 38 % of the screen at 1024x768, 54-55 % at
       820x1180, 38-40 % at 393x852 and 38 % at 1200x800, all of it below the stack, with the self-check
       0/0/0 throughout. On a desk the middle of the curtain is a hole and the board is seen; here it is
       one too. The rails' bands are cut first - the strip down each wall is the piece between the wall
       and the band's inner edge, glass the rail stands on as on a desk - and a block below the stack
       (the corner's launchers) keeps the piece step 3 claimed for it. Every other piece of the field is
       taken out of the partition and named `board` in OPEN_AREAS: the self-check holds it clear of every
       pane (`openFails`) and does not count its points on the screen's edge as gaps (`cutCheck`). */
    /* THE FIELD BEGINS AT THE HIGH END OF THAT SEAM, NOT AT ITS MIDDLE.
       The seam leans, so the piece under it starts `rise` px above the y the cut was
       made at. Tested against the middle, every piece of the field failed the test and
       not one of the cuts below was made: the field came out as two enormous panes and
       the rails got no strip (measured 13.09 - 13 panes, one of them a fifth of the
       screen and painted as a stained one). */
    const fieldTop = yBase - rise - 1;
    const inField = p => bbox(p).y0 >= fieldTop;
    const bands = page.bands;   // `stackPage`: the scene rail's and the tab rail's, or a test's two inner edges
    const strips = [];
    bands.forEach((band, side) => {
      if (!band || band.real === false || !Number.isFinite(band.band)) return;
      cut(band.band, yBase, Math.PI / 2, inField);
      strips.push(side ? p => bbox(p).x0 >= band.band - 0.5 : p => bbox(p).x1 <= band.band + 0.5);
    });
    pieces = pieces.filter(p => {
      if (!p || claimed.has(p) || !inField(p) || strips.some(own => own(p))) return true;
      if (p.length >= 3 && area(p) > 12) open.push({ name: "board", poly: p });
      return false;
    });

    /* 5. the panes. A piece carrying a block's centre is that block's - its tone, and
       `empty` when the block is a reserved box with nothing in it today. Every other
       piece is filler. */
    /* A BIG PANE IS NEVER A STAINED ONE. One filler pane in five is painted in a colour
       (`stained` in paintGlass), which reads as a shard of the window on a desk, where the
       panes are small and there are thirty of them. On a tall screen the field below the
       stack can be a fifth of the whole display, and one pane that size in cobalt is not a
       shard, it is a wall. `plain` is what the painter already reads to refuse that. */
    const BIG = W * H * 0.06;
    const panes = pieces.filter(p => p && p.length >= 3 && area(p) > 12)
      .map(poly => ({ poly, content: false, tone: null, kind: "field", rank: 9, plain: area(poly) > BIG }));
    for (const b of [...rows, ...loose]) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const home = panes.find(p => !p.content && inside(p.poly, cx, cy));
      if (!home) continue;
      home.content = true; home.tone = b.cls; home.kind = "section"; home.rank = 0; home.empty = !b.r;
    }

    /* the shape the rest of the pass reads. One pseudo-column per block, so the
       self-check tests every corner of every block against its own pane exactly as it
       does on a desk; no tiles, because no rail is turned here; no rings. */
    const kept = panes;
    kept.meta = {
      top: [...rows, ...loose].map(b => ({
        x0: b.x, x1: b.x + b.w, y0: b.y, y1: b.y + b.h, items: [b],
        rot: (x, y) => [x, y], px: 0, py: 0, s: 0,
        depthL: 0, depthR: 0, farL: [b.x, b.y + b.h], farR: [b.x + b.w, b.y + b.h]
      })),
      bot: [], rings: [], tiles: {}, open
    };
    return kept;
  }

  /* The top of whatever bottom column stands under the voice tile, over the tile's width out to the
     wall: its pane's far edge, which leans, read at both ends. Nothing under it: the screen's foot. */
  const voiceFloor = (bot, v, W, H) => {
    let y = H;
    for (const c of bot) {
      if (c.x1 < v.x - PAD_SIDE) continue;
      const [fx, fy] = c.far.p, [dx, dy] = c.far.d;
      for (const x of [v.x - PAD_SIDE, W]) y = Math.min(y, fy + (x - fx) * dy / dx);
    }
    return y;
  };
export   function curtainShapes(W, H, rnd, boxes, FW, page) {
    // a stacked layout is a different shape and gets a different cut; see stackShapes (`curtainPage`: `narrow`)
    return page.narrow ? stackShapes(W, H, rnd, boxes, page) : deskShapes(W, H, rnd, boxes, FW, page);
  }
  /* THE TWO BANDS' SECTIONS MEET, THEY DO NOT CROSS (E23 fix G2, 08.11.2026; STATUS E23 Open 30 and 90, the end review's
     goal M3 and screens m3; R1421). A column of the top band leans about its top corner and one of the bottom band about
     its bottom corner, so on a short desk their far edges run towards each other at the wall. With C2a's taller clock
     (7b4f286c) the clock's box ends at 236 at 1366x560 and the notice tile's starts at 336: the clock's pane reached the
     left wall at y 288 and the notice tile's started there at 280, an 8 px wedge both held - ov 1 in both roles, seen as
     two seams in an X. The bottom band's pane keeps its shape (the room tile beside it, its frame and the sweep's
     PIN_PANE are read off it), and the top section that crosses it is cut along the one edge of it that leaves the most
     glass: a half-plane keeps a convex pane convex, and the wedge it gives up is the other pane's, so no gap opens. A cut
     that would take a corner of the top block off its pane is not made (a fault the self-check then reports, as before).
     At every size where the two did not cross, nothing changes. */
  function meetBands(topPanes, botPanes, top, W, H) {
    for (const t of topPanes) {
      if (t.kind !== "section") continue;
      const col = top.find(c => c.items.some(b => b.cls === t.tone) || c.tail?.cls === t.tone);
      const b = col && (col.items.find(i => i.cls === t.tone) ?? col.tail);
      const corners = b ? [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => col.rot(x - col.px, y - col.py))
        .filter(q => q[0] > 1 && q[0] < W - 1 && q[1] > 1 && q[1] < H - 1) : [];
      for (const o of botPanes) {
        if (o.kind !== "section" || !overlaps(t.poly, o.poly)) continue;
        const P = o.poly, n = P.length, mx = P.reduce((s, q) => s + q[0], 0) / n, my = P.reduce((s, q) => s + q[1], 0) / n;
        let best = null, kept = -1;
        for (let i = 0; i < n; i++) {
          const a = P[i], e = P[(i + 1) % n];
          let nx = -(e[1] - a[1]), ny = e[0] - a[0];
          if ((mx - a[0]) * nx + (my - a[1]) * ny > 0) { nx = -nx; ny = -ny; }   // the normal away from the bottom pane
          const q = clipHP(t.poly, a[0], a[1], nx, ny);
          if (!q || overlaps(q, P) || !corners.every(([x, y]) => inside(q, x, y))) continue;
          const A = area(q);
          if (A > kept) { kept = A; best = q; }
        }
        if (best) t.poly = best;
      }
    }
  }
  /* the desk's cut, on its own since E78 C6 so `cutBoxes` can ask for it on a screen the
     harness lays out 1024 px wide, which is a stacked one */
export   function deskShapes(W, H, rnd, boxes, FW, page) {
    const panes = [];
    /* what every cutter reads and writes: the panes so far, the frame, the seed's
       stream, the rails' bands once they are measured, and the needles placed */
    const ctx = { panes, W, H, FW, rnd, railBands: null, needles: [],
      // `deskPage`: the wall the voice tile is settled against; what the cut gives back for the callers to write (E54 G4)
      wall: page.wall, rectOf: page.rectOf, voice: null, turns: [], open: [] };
    ctx.push = (poly, tone, kind, rank) => pushPane(ctx, poly, tone, kind, rank);

    /* the voice tile is not a column's member by its midpoint: it is the tray's column's tail */
    const voice = boxes.find(b => b.cls === "voice-block") ?? null, banded = boxes.filter(b => b !== voice);
    /* THE BANDS SPLIT WHAT STANDS OVER THE CAMERA DOCK (E19 fix r1-G2, 19.10.2026). A shown dock lifts
       the corner's buttons by its height (`--drpg-av-lift`, `avLift`), and on a short screen that put a
       GM's corner over the screen's middle: at 1366x560 under a 200 px dock it joined the tray's column
       in the top band, turned 8 degrees about that column's top corner, and the turn carried the gear
       and the book 29 and 36 px back down into the dock (Chromium, the glass harness; the sweep's dock
       check). The middle is the middle of the screen over the dock; with no dock it is H / 2, as before. */
    const mid = (H - Math.min(page.lift, H / 2)) / 2;   // `deskPage`: the dock's lift (`avLift`)
    const top = columnsOf(banded.filter(b => b.y + b.h / 2 < mid));
    const bot = columnsOf(banded.filter(b => b.y + b.h / 2 >= mid));

    /* THE RAILS' BANDS ARE KNOWN BEFORE THE COLUMNS ARE CUT, AND THE COLUMNS RESPECT THEM.
       A column near a wall runs its pane INTO the wall so no bare wedge is left there
       (`hugL` / `hugR` below). On a side where a rail stands that is exactly wrong: the
       Projects tray's pane ran under the tab rail all the way to the edge, so the rail's
       upper tiles sat on the tray's glass and the seam between it and the strip crossed them
       - 37 of 64 tile corners on panes that were not theirs (measured 07.09). The strip
       covers that band instead, for its whole height, and a column whose own run overlaps
       the band stops at its own edge. Nothing is left bare: the band IS the strip. */
    const railBands = page.bands;   // `deskPage`: the scene rail's and the tab rail's, a band of their own each cut
    ctx.railBands = railBands;
    /* THE BOTTOM BAND IS CUT FIRST AND FILED SECOND (E78 C6). The voice tile's foot is settled
       against the corner's pane, which only exists once the bottom columns are cut; the panes are
       put back in the order they were always in, top first, so nothing painted per pane moves. */
    bot.forEach(c => buildColumn(ctx, c, bot, "bottom"));
    const cutFirst = panes.splice(0);
    const trayCol = voice ? top.find(c => c.items.some(b => b.cls === "tray")) : null;
    if (trayCol) { trayCol.tail = voice; trayCol.floor = voiceFloor(bot, voice, W, H); }
    top.forEach(c => buildColumn(ctx, c, top, "top"));
    meetBands(panes, cutFirst, top, W, H);
    panes.push(...cutFirst);

    /* How far down each band is the strip's alone - see the note in `pushPane`. Read after
       the sections exist and before the first filler is cut, because it is a fact about the
       sections and every filler pane is clipped against it. */
    for (const [b, dir] of [[railBands.left, 1], [railBands.right, -1]]) {
      if (!b || b.real === false || !b.coreY) continue;
      const held = panes.some(p => {
        if (p.kind !== "section") return false;
        const bb = bbox(p.poly);
        return bb.y1 > b.coreY[1] && (dir > 0 ? bb.x0 < b.band : bb.x1 > b.band);
      });
      b.bandEnd = held ? b.coreY[1] : Infinity;
    }

    fillBands(ctx, top, bot);
    const ringLines = cutRings(ctx, top);
    const tiles = cutStrips(ctx, top, bot, railBands);

    /* the partition, enforced twice: sections first, then only filler that lands on nothing */
    const kept = [];
    for (const p of panes) if (p.content) kept.push(p);
    for (const p of panes) if (!p.content && kept.every(k => !overlaps(k.poly, p.poly))) kept.push(p);

    kept.meta = { top, bot, rings: ringLines, tiles, railRight: railBands.right, voice: ctx.voice, turns: ctx.turns, open: ctx.open };
    return kept;
  }

  /* ---- a window: three or four long shallow shards -------------------------- */
export   function windowShapes(W, H, rnd) {
    let panes = [[[0, 0], [W, 0], [W, H], [0, H]]];
    const cutAt = (px, py, ang) => { const nx = -Math.sin(ang), ny = Math.cos(ang); panes = panes.flatMap(p => split(p, px, py, nx, ny).filter(Boolean)); };
    if (H > 90) cutAt(W * 0.5, H * (0.28 + rnd() * 0.12), SHEAR + (rnd() - 0.5) * 0.12);
    if (H > 150) cutAt(W * 0.5, H * (0.68 + rnd() * 0.12), SHEAR + (rnd() - 0.5) * 0.12);
    cutAt(W * (0.62 + rnd() * 0.22), H * 0.5, Math.PI / 2 + SHEAR * 1.6);
    if (W > 520) cutAt(W * (0.16 + rnd() * 0.14), H * 0.5, Math.PI / 2 - SHEAR * 1.2);
    if (W > 300) cutAt(W * (0.38 + rnd() * 0.16), H * 0.5, Math.PI / 2 + SHEAR * (rnd() < 0.5 ? 1.1 : -1.3));
    return panes.map(poly => ({ poly, content: false, kind: "window" }));
  }
export const centroid = poly => { const bb = bboxOf(poly); return [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2]; };
export const meanOf = poly => [poly.reduce((s, q) => s + q[0], 0) / poly.length, poly.reduce((s, q) => s + q[1], 0) / poly.length];
export const onBorder = (W, H) => (p, q) => (p[0] < 1 && q[0] < 1) || (p[0] > W - 1 && q[0] > W - 1) || (p[1] < 1 && q[1] < 1) || (p[1] > H - 1 && q[1] > H - 1);
/* The affine map that carries the points F onto T, least squares ([a11, a12, tx, a21, a22, ty]); with three points of a
   triangle it is exact. A degenerate set (every point on one line) is carried by its mean alone. */
export function fitAffine(F, T) {
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0;
  const n = F.length, r = [[0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const [x, y] = F[i];
    sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y;
    for (let k = 0; k < 2; k++) { r[k][0] += x * T[i][k]; r[k][1] += y * T[i][k]; r[k][2] += T[i][k]; }
  }
  const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(M);
  if (Math.abs(D) < 1e-6 * Math.max(1, sxx * syy)) {
    const f = meanOf(F), t = meanOf(T);
    return [1, 0, t[0] - f[0], 0, 1, t[1] - f[1]];
  }
  const solve = b => [0, 1, 2].map(c => det3(M.map((row, i) => row.map((v, j) => (j === c ? b[i] : v)))) / D);
  const [a11, a12, tx] = solve(r[0]), [a21, a22, ty] = solve(r[1]);
  return [a11, a12, tx, a21, a22, ty];
}
export const num = (v, d) => String(+v.toFixed(d));
/* `A` (screen to screen) as the CSS transform of an element standing at `o` with its origin at its top left */
export function matrixAt(A, o) {
  const [a11, a12, tx, a21, a22, ty] = A;
  return "matrix(" + [num(a11, 5), num(a21, 5), num(a12, 5), num(a22, 5), num(a11 * o[0] + a12 * o[1] + tx - o[0], 2), num(a21 * o[0] + a22 * o[1] + ty - o[1], 2)].join(",") + ")";
}
/* the affine maps' algebra the hand-over needs: `A` undone (null when it folds the plane flat), `A` then `B`, and how
   far `A` bends a picture from its own size - the larger of its linear part's singular values' logs, either way: a
   picture squeezed to a quarter loses its seams as surely as one stretched loses its grain (the layout turn's pane
   handed over at once, squeezed to 0.25, read 36 % of rest) */
export function invAffine(A) {
  const [a, b, tx, c, d, ty] = A, D = a * d - b * c;
  if (Math.abs(D) < 1e-9) return null;
  return [d / D, -b / D, (b * ty - d * tx) / D, -c / D, a / D, (c * tx - a * ty) / D];
}
export const thenAffine = (A, B) => [B[0] * A[0] + B[1] * A[3], B[0] * A[1] + B[1] * A[4], B[0] * A[2] + B[1] * A[5] + B[2], B[3] * A[0] + B[4] * A[3], B[3] * A[1] + B[4] * A[4], B[3] * A[2] + B[4] * A[5] + B[5]];
export function stretchOf(A) {
  const [a, b, , c, d] = A, s = a * a + b * b + c * c + d * d, D = a * d - b * c, r = Math.sqrt(Math.max(0, s * s - 4 * D * D));
  const hi = Math.sqrt((s + r) / 2), lo = Math.sqrt(Math.max(0, (s - r) / 2));
  return lo > 1e-6 ? Math.max(Math.log(hi), -Math.log(lo)) : Infinity;
}
export const boxOf = (polys, pad) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0: Math.floor(x0 - pad), y0: Math.floor(y0 - pad), x1: Math.ceil(x1 + pad), y1: Math.ceil(y1 + pad) };
};
