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
  /* THE GM BUTTON IS NOT A BLOCK ANY MORE. It stands directly over the scene rail, so a pane
     of its own put a seam between it and the tiles it sits on top of. It joins the rail's
     shard instead - same piece of glass, same angle - which is what `railBox` reserves room
     for below and what the rotation loop turns with the rail. */
  /* The fallback is the box to cut when the rail cannot be measured at all. 412x90 was smaller
     than the rail has ever been - measured 454x102 at 100% and 540x109 at 140% - and it did not
     scale, so on a large interface it cut a pane the rail stood outside of. Sized from the
     measurement and scaled like the note block, since that is the only honest guess available. */
  { cls: "rail", sel: "#drpg-despair", fallback: (W, H) => { const s = uiScale(); return { x: Math.round(W / 2 - 240 * s), y: 22, w: 480 * s, h: 104 * s }; } },
  { cls: "event", sel: "#drpg-events", fallback: null },
  { cls: "three", sel: "#drpg-player-status", fallback: (W, H) => ({ x: W - 64 - 360, y: 22, w: 360, h: 78 }) },
  { cls: "tray", sel: "#ui-right-column-1 > #countdowns, #countdowns", fallback: (W, H, r) => ({ x: W - 64 - 360, y: (r.three ? r.three.y + r.three.h : 100) + 10, w: 360, h: 62 }) },
  /* The notice pane was cut for `#drpg-notice`, which no script has ever built: the module's
     notices are `#drpg-popups` (popup.mjs), and they were floating over the map with no glass
     under them while an empty 330x80 pane sat in the corner on every screen. The pane belongs
     to the real container, and it has NO fallback on purpose - an empty popup stack has no
     height, so it is not measured, and a screen with nothing to say cuts no pane. */
  /* THE NOTICE TILE IS A CONSTANT. Not measured: two short cards or one long one fit it, the
     stack is clipped to it (stained-glass.css, popup.mjs), and a card arriving or leaving never
     recuts the glass. 330 x 160 at 100 %, at the audit page's place, scaled with the screen. */
  { cls: "note-block", sel: "#drpg-popups", fixed: true, fallback: (W, H) => { const s = uiScale(); return { x: 16, y: H - (100 + 160) * s, w: 330 * s, h: 160 * s }; } },
  { cls: "launch", sel: "#drpg-messenger-launcher, #drpg-sound-launcher, #drpg-settings-launcher", union: true, fallback: (W, H) => ({ x: W - 22 - 66, y: H - 22 - 134, w: 66, h: 134 }) },
  /* FOUNDRY'S TWO RAILS ARE NOT BLOCKS, AND THE THREE DAYS SPENT MAKING THEM BLOCKS SAY WHY.
     A block is MEASURED, and every measurement of a rail is a statement about something the
     user is about to change: click a scene control and Foundry opens its tools beside it (the
     rail went 72 px wide to 112 and 12 tiles to 20), click a sidebar tab and the whole sidebar
     expands and carries the tab rail 300 px to the left. Measured, each of those recut the
     curtain - "po kliknieciu sie glitchuje", "klikniecie prawego kafelka ... teraz kurtyna sie
     zmienia" (07.09). The rails get their piece of glass from the side strip instead, cut to
     the room they could EVER need rather than the room they take at this instant (`railBox`),
     so the glass is cut once and the sidebar simply slides over it. */
];
/* THE NOTICE TILE IS ALWAYS CUT. 1.2.30 cut it only while a card was on screen ("a screen
   with nothing to say cuts no pane"), which meant every notice recut the curtain and took it
   away again - the corner tile came and went with the news. It is a fixed tile of the glass
   now, at the audit page's place and size (scaled with the screen), and the cards land on it;
   a taller stack of cards is measured and the tile grows to hold it. */
/* THE GEOMETRY SCALE, NOT THE TYPE SCALE - and this file read the wrong one for two days.
   `--drpg-sg-scale` is the TYPE factor (settings.mjs: `--drpg-type-scale`); `--drpg-ui-scale`
   is the one the theme sizes boxes with. Every number this function feeds is a box: the notice
   tile's 330 x 160, the Despair rail's fallback, the room the scene rail is bounded to. While
   the two factors happened to be equal below 1440p nothing showed. On 09.09 type took back a
   screen term of 0.85 and the notice tile moved 26 px UP on a 1080p screen, taking the scene
   rail's bound with it - which is how a rail that had been fixed on 08.09 came back over its
   own glass. The fallback chain keeps a client mid-switch on its feet. */
const uiScale = () => {
  const cs = getComputedStyle(document.body);
  for (const k of ["--drpg-ui-scale", "--drpg-sg-scale"]) {
    const v = parseFloat(cs.getPropertyValue(k));
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 1;
};
/* ---- the rotations: one stylesheet, rewritten after every geometry pass ----------------------
   A block is rotated with its pane. Written as a rule on the block's selector (not an inline
   style), the rotation survives the module rebuilding that block from scratch - the status strip
   and the Event panel do - and a new element wears it the moment it is in the tree. The sheet is
   switched off while the blocks are measured, so a pane is cut for the block as laid out. */
const ROT = [];
let rotSheet = null;
function rotationSheet() {
  if (!rotSheet || !rotSheet.isConnected) { rotSheet = document.createElement("style"); rotSheet.id = "drpg-glass-rotation"; document.head.append(rotSheet); }
  return rotSheet;
}
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
const MAX_TILT = 9 * Math.PI / 180;
/* WHAT A LEAN COSTS IN WIDTH. A rail is the tallest thing on the screen and rotation is paid
   for in width: a 468 px rail leaning 9 deg needs 73 px more glass than it occupies. The shard
   reserves that up front, at MAX_TILT, so whatever lean the strip's edge turns out to want is
   always one the tiles have room for, and they never cross their own glass. */
/* The swing a rail's lean costs it, at the lean it is actually given (RAIL_LEAN below), not
   at the partition's maximum: reserving for 9 degrees when the rail leans 5 made the band
   half again as wide as it needed to be, which is the "witraz na lewe kafelki jest za duzy"
   of 07.09. The lean is clamped to the same number, so the reservation is exact. */
const railSwing = h => Math.round(Math.max(0, h) * Math.sin(RAIL_LEAN) / 2);
/* how much wider than the tiles' box the strip carrying them runs: the lean of its outer
   edge (22) plus the clearance that edge keeps off the tiles (14) */
/* THE ANGLE THE AUDIT PAGE GIVES THE EDGE UNDER THE TILES: "szkło jest ścięte do jednej
   prostej (22 px pochylenia na ~370 px)", which is 3.4 degrees, "a same kafelki są obrócone o
   kąt tej krawędzi ... więc stoją do niej równolegle". So the edge is cut to that angle over
   whatever run it has, and the tiles take the angle the edge came out with - parallel by
   construction rather than by two constants that happen to agree. */
const STRIP_ANGLE = Math.atan(22 / 370);
const STRIP_LEAN = 26;
/* How far a rail leans - exactly, not at least. It used to be a floor with MAX_TILT as the
   ceiling, and the band then had to reserve the swing of the ceiling. One number for both. */
const RAIL_LEAN = 5 * Math.PI / 180;
const STRIP_SLACK = 14 + STRIP_LEAN;
/* THE ONE STATE THE TAB RAIL'S RULE HAS TO KNOW ABOUT.
   The tab rail stands flush against the right wall, so leaning it swings its ends past the
   edge of the screen and it has to come inboard by that swing to stay on it. That is right
   while the sidebar is shut. It is wrong the moment the sidebar opens: Foundry lays the panel
   out immediately inboard of the tabs, so a rail pulled 38 px further in goes UNDER the panel
   - and with it every way of changing tab or closing the thing again (Dawid, 07.09). Foundry
   marks the open sidebar with nothing at all - no class, no attribute, only a width - so the
   module marks it, and the rail's rule is written to apply only while it is shut. */
let sidebarWatched = false;
function watchSidebar() {
  const bar = document.querySelector("#sidebar"), tabs = document.querySelector("#sidebar-tabs");
  if (!bar || !tabs) return;
  const read = () => document.body.classList.toggle("drpg-sidebar-open", bar.offsetWidth > tabs.offsetWidth + 40);
  read();
  if (sidebarWatched) return;
  sidebarWatched = true;
  new ResizeObserver(read).observe(bar);
}
const RAIL_MARGIN = 16;
/* HOW FAR THE GM BUTTON DROPS TO CLEAR THE CLOCK'S GLASS.
   A column's pane reaches further down the wall than the column's own block does - padding,
   plus the swing of its rotation - and the button is laid out in that overhang, so its top
   two corners sat on the clock's pane and its lower two on the rail's. It cannot be fixed by
   trimming the clock's pane: this partition's overlap and point-in-pane tests both assume
   convex panes, and a pane with a notch is not convex. So the button moves, and it moves
   BEFORE anything is measured - the rail's own padding is computed from the dropped position,
   so the tiles follow it down and the shard is cut around both where they end up. */
const GM_DROP = 26;
function railOverhang(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 1) return 0;
  if (r.left < RAIL_MARGIN) return Math.ceil(RAIL_MARGIN - r.left);
  if (r.right > window.innerWidth - RAIL_MARGIN) return -Math.ceil(r.right - (window.innerWidth - RAIL_MARGIN));
  return 0;
}

/* WHERE A RAIL STANDS ON ITS OWN PANE.
   A rail is measured unrotated and drawn rotated, and rotation is expensive for something
   tall: a 670 px column tilted 8 deg is 92 px wider than it was measured. Three things
   follow, and all three were on the screen Dawid sent on 07.09. The hull is computed, never
   read back - `offsetLeft` / `offsetWidth` / `offsetHeight` are layout values and carry no
   transform, which is exactly the box the rotation is about to be applied to, and the rotated
   hull of a rectangle is four corners and a cosine. Reading the box back does not work: a
   `<style>` write does not refresh a rect already read in the same synchronous run, so four
   passes gave four identical readings and stacked four shifts into a 120 px jump.
   Then the rail is CENTRED in its pane rather than pushed off the wall, which is the whole
   difference between "the tiles have a piece of glass" and "the tiles are stuck to the edge
   of one": the pane is as wide as its column - the notice tile sets that on the left - and a
   72 px rail left at the wall stood in a third of it. The wall margin still wins if centring
   would take the rail off the screen. */
/* Where each rail's own tiles came to rest, so anything sharing its shard can be centred on
   them. The hull a rail is measured by IS its tiles (see `tileLocal`), so this is their middle. */
const RAIL_AT = new Map();
function railRule(r) {
  const phi = parseFloat(/rotate\(([-\d.e]+)rad\)/.exec(r.transform)?.[1] ?? "0");
  const [ox, oy] = r.origin.split(" ").map(parseFloat);
  const w = r.el.offsetWidth, h = r.el.offsetHeight;
  /* THE TILES, READ NOW, FROM LAYOUT VALUES.
     `offsetLeft` / `offsetTop` carry no transform, so unlike `getBoundingClientRect` they can
     be read while the rotation is applied - which means this rule can be recomputed whenever
     the rail's contents change, not only when the curtain is recut. That is what keeps the GM
     button over the tiles after a scene control opens its tools and the tile block gets wider:
     the curtain deliberately does not recut on a click, so a box captured at cut time was a
     box from before the click ("dalej nie jest wycentrowany", 08.09). */
  const railAt = el => { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y]; };
  const live = (() => {
    const kids = tileButtons(r.el);
    if (!kids.length) return null;
    const own = railAt(r.el);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const boxes = [];
    for (const k of kids) {
      const [kx, ky] = railAt(k);
      const b = [kx - own[0], ky - own[1], kx - own[0] + k.offsetWidth, ky - own[1] + k.offsetHeight];
      boxes.push(b);
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    /* THE TOP ROW, KEPT SEPARATELY. Anything standing above the rail is judged against the
       tiles it is ACTUALLY above, which is the first row - not the column's average. A rail
       leans, so those are not the same place: measured 08.09 at 1440p, the column's middle
       was 76 and its first row 88, and the GM button centred on 76 read as 12 px too far left
       every time, however exactly the arithmetic agreed with itself. */
    const rowH = boxes[0][3] - boxes[0][1];
    const first = boxes.filter(b => b[1] < y0 + rowH * 0.8);
    const box = [x0, y0, x1, y1];
    box.rowMid = (Math.min(...first.map(b => b[0])) + Math.max(...first.map(b => b[2]))) / 2;
    // and the row's OWN height: a rotation moves a point sideways by its distance from the
    // pivot in y, so the row has to be turned about its own middle, not the column's
    box.rowY = (Math.min(...first.map(b => b[1])) + Math.max(...first.map(b => b[3]))) / 2;
    return box;
  })();
  /* THE HULL IS THE TILES', NOT THE CONTAINER'S.
     `#scene-controls` is 151 px wide with its buttons in the right 99 of it - Foundry leaves
     the other 52 empty - so a hull taken from the element's box is half padding, and the wall
     clamp then holds that PADDING off the wall and pushes the visible tiles 50 px inboard
     ("mialy byc pod gm panel", 08.09). Measured on the tiles, the clamp keeps the tiles off
     the wall, which is the thing anyone can see. */
  const box = live || r.tileLocal;
  const bx0 = box ? box[0] : 0, by0 = box ? box[1] : 0;
  const bx1 = box ? box[2] : w, by1 = box ? box[3] : h;
  /* only the wall-flush tab rail needs the guard; the scene rail has room either side */
  const at = r.sel === "#sidebar-tabs" ? "body.drpg-theme-stained-glass:not(.drpg-sidebar-open)" : "body.drpg-theme-stained-glass";
  const plain = `${at} :is(${r.sel}) { transform-origin: ${r.origin}; transform: ${r.dy ? `translateY(${Math.round(r.dy)}px) ` : ""}${r.transform}; }`;
  if (!(w > 0) || !Number.isFinite(phi) || !phi) return plain;
  /* The element's own untransformed left, measured during the layout pass when the
     rotations were off. The `offsetParent` chain is the fallback, and only that: it is not
     the same chain for `#drpg-gm-launcher` as for the rail, and a hull built from it put the
     button 57 px out and then the wall clamp held it there. */
  const L = live ? railAt(r.el)[0] : (Number.isFinite(r.pageLeft) ? r.pageLeft : railAt(r.el)[0]);
  const cs = Math.cos(phi), sn = Math.sin(phi);
  const xs = [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].map(([x, y]) => ox + (x - ox) * cs - (y - oy) * sn);
  const left = L + Math.min(...xs), right = L + Math.max(...xs);
  const W = window.innerWidth;
  let shift = 0;
  /* CENTRED ON THE THING IT SHARES THE GLASS WITH, NOT ON THE GLASS.
     The GM button sits on the scene rail's shard, and centring it in that shard on its own
     put it 57 px left of the tiles: it is a different width, it starts at a different place,
     and its `offsetParent` chain is not the rail's. Lining it up on where the RAIL ended up
     is the only measure that means "over the tiles" (Dawid, 07.09). */
  if (r.alignTo && RAIL_AT.has(r.alignTo)) {
    /* Centred on where the rail's TILES came to rest - both hulls are computed the same way
       from the same kind of measurement now, so "over the tiles" is one subtraction and not
       an offset carried across two coordinate systems. */
    shift = Math.round(RAIL_AT.get(r.alignTo) - (left + right) / 2);
  } else if (r.pane) {
    const cx = document.getElementById("drpg-curtain")?.getBoundingClientRect().left ?? 0;
    shift = Math.round((cx + (r.pane[0] + r.pane[1]) / 2) - (left + right) / 2);
  }
  if (left + shift < RAIL_MARGIN) shift = Math.ceil(RAIL_MARGIN - left);
  else if (right + shift > W - RAIL_MARGIN) shift = -Math.ceil(right - (W - RAIL_MARGIN));
  /* What is recorded is where the TILES end up, not where the element's box does: the rail's
     box carries padding that puts its middle 25 px left of the tiles inside it, and "over the
     tiles" is the thing being asked for. */
  /* Where the first row of tiles came to rest, in page pixels, after this rule's own turn
     and shift - that is what anything sharing the shard lines up on. */
  const rowMid = live && Number.isFinite(live.rowMid)
    ? L + (ox + (live.rowMid - ox) * cs - (live.rowY - oy) * sn) + shift
    : (left + right) / 2 + shift;
  RAIL_AT.set(r.sel, rowMid);
  const drop = r.dy ? ` translateY(${Math.round(r.dy)}px)` : "";
  if (!shift && !drop) return plain;
  return `${at} :is(${r.sel}) { transform-origin: ${r.origin}; transform: translateX(${shift}px)${drop} ${r.transform}; }`;
}

/* ONE WRITE, OR THE RAILS ANIMATE EVERY TIME THE GLASS IS RECUT.
   The blocks carry an 840 ms transition on `transform`. This used to write the sheet once
   with the plain rotation and again with the corrections, and the browser did what it was
   asked: it animated from the first to the second, every geometry pass - the tiles that
   "teleport and slide every half second" (07.09). Everything a rule needs is known before
   the first write now, so the text is assigned once and an unchanged value transitions
   nothing. The non-rail pass below can still add a rule, but only for a block that overhangs
   and never for one already written. */
function applyRotations() {
  const rules = [];
  RAIL_AT.clear();
  for (const r of ROT) {
    if (r.rail && r.el && r.sel) rules.push(railRule(r));
    else if (r.sel) rules.push(`body.drpg-theme-stained-glass :is(${r.sel}) { transform-origin: ${r.origin}; transform: ${r.transform}; }`);
    else if (r.el) { r.el.style.transformOrigin = r.origin; r.el.style.transform = r.transform === "none" ? "" : r.transform; }
  }
  const sheet = rotationSheet();
  sheet.textContent = rules.join("\n");
  sheet.disabled = false;
  watchSidebar();
  if (document.body.classList.contains("drpg-measuring")) { void document.body.offsetWidth; measuring(false); }
  /* the glass proposed the angle; this is the screen's answer to it */
  const fixes = [];
  for (const r of ROT) {
    if (!r.sel || !r.el || !r.transform || r.transform === "none" || r.rail) continue;
    const shift = railOverhang(r.el);
    if (shift) fixes.push(`body.drpg-theme-stained-glass :is(${r.sel}) { transform-origin: ${r.origin}; transform: translateX(${shift}px) ${r.transform}; }`);
  }
  if (fixes.length) sheet.textContent = rules.concat(fixes).join(" ");
  tightenGmGap();
}

/**
 * The tiles sit under the GM button by the same gap they keep between themselves.
 *
 * MEASURED AFTER THE ROTATIONS, BECAUSE THAT IS THE ONLY PLACE THE ANSWER IS. The margin
 * in `moduleLayout` is computed with the rotations off, deliberately - a position fed back
 * into the thing being measured is what used to make the tiles creep every recut. But the
 * rail and the GM button are then both turned, and the button is aligned TO the rail
 * (`alignTo`), so what the margin asks for and what the screen shows are two different
 * numbers. Measured on 11.09: the tiles keep 6 px between themselves and stood 37 px under
 * the button at 1920x1080, 16 at 1600x900 and 73 at 2560x1440 - three different holes from
 * one constant, which is the signature of a number being read in the wrong frame.
 *
 * So the correction is the same shape as `railOverhang` above it: propose, look, answer.
 * Iterated because moving the rail moves the button with it - the coupling measured about
 * two thirds, so it converges - and capped, because a correction that has not settled in
 * three goes is one that never will.
 *
 * SAFE FOR THE GLASS, and that is not an accident: the band's top is `min(first tile, the
 * GM button + GM_DROP)`, and the button is the higher of the two, so the band is already
 * cut from above the button. Tiles moving UP move further inside their own shard, never
 * out of it. Verified by the corner tally either side of this landing.
 */
function tightenGmGap() {
  const rail = document.querySelector("#scene-controls");
  const gm = document.querySelector("#drpg-gm-launcher");
  if (!rail || !gm || !gm.offsetWidth || !themeOn()) return;
  const menu = rail.querySelector(":scope > menu");
  if (!menu) return;

  for (let pass = 0; pass < 3; pass++) {
    const tiles = [...menu.querySelectorAll("button.ui-control")]
      .filter(e => e.offsetWidth > 0).map(e => e.getBoundingClientRect());
    if (tiles.length < 2) return;
    /* THE TILES' OWN GAP, not a constant: it is Foundry's menu gap at this interface
       scale, and matching it is the whole request ("z rownym marginesem do przerw miedzy
       kafelkami", Dawid 11.09). Read from the first pair and sanity-checked, because a
       wrapped column would put the second tile beside the first rather than under it. */
    const own = Math.round(tiles[1].top - tiles[0].bottom);
    if (!(own >= 0 && own < 40)) return;
    const have = Math.round(tiles[0].top - gm.getBoundingClientRect().bottom);
    const delta = have - own;
    if (Math.abs(delta) < 2) return;
    const base = parseFloat(rail.style.marginTop) || 0;
    rail.style.marginTop = Math.round(base - delta) + "px";
    void rail.offsetHeight;
  }
}
/* THE RIGHT-HAND COLUMN STANDS STILL.
   Foundry lays `#ui-right-column-1` out beside the sidebar, so opening the sidebar pushes the
   status strip and the Projects tray 300 px to the left - and a curtain cut around them would
   have to be recut, which is the whole story of the last two releases. Pinned, the column
   stays where it stands with the sidebar closed: `right` is the tab rail's own distance from
   the screen's edge (measured, so Foundry's paddings need not be known), `top: 0` under the
   `margin-top` hud.mjs already keeps level with the Despair rail, and a z-index below the
   sidebar so an open sidebar slides over the column instead of under it. Legacy is untouched. */
const PIN = { rail: null };
function pinRightColumn() {
  const col = document.getElementById("ui-right-column-1");
  if (!col) return;
  if (!themeOn()) { unpinRightColumn(); return; }
  const rail = document.getElementById("sidebar-tabs");
  const r = rail && rail.offsetWidth ? rail.getBoundingClientRect() : null;
  /* AND CLEAR OF THE RAIL'S BAND, NOT JUST OF THE RAIL.
     The tab rail leans, so the glass cut for it is the tiles plus the swing that lean costs
     - about 52 px on a 1440p screen. Pinned only to the rail's own left edge, the status
     strip and the Projects tray reached 46 px into that band, the strip had to start below
     them, and the rail's top eight tiles ended up on somebody else's pane. */
  const right = r ? Math.max(0, Math.round(innerWidth - r.left) + railSwing(r.height) + 8) : 0;
  if (col.dataset.drpgPinned === "1" && PIN.rail === right) return;
  PIN.rail = right;
  col.dataset.drpgPinned = "1";
  col.style.position = "fixed";
  col.style.top = "0";
  col.style.right = right + "px";
  col.style.left = "auto";
  col.style.bottom = "auto";
  col.style.height = "auto";
  col.style.width = "auto";
  col.style.zIndex = "-1";
  // the column itself takes no clicks; the strip and the tray opt back in (stained-glass.css)
  col.style.pointerEvents = "none";
}
function unpinRightColumn() {
  const col = document.getElementById("ui-right-column-1");
  if (!col || col.dataset.drpgPinned !== "1") return;
  delete col.dataset.drpgPinned; PIN.rail = null;
  for (const k of ["position", "top", "right", "left", "bottom", "height", "width", "zIndex", "pointerEvents"]) col.style[k] = "";
}
/* Measuring turns the rotation off for one style pass, and the blocks carry an 840 ms
   transition on `transform` - so without this every measurement animated every block from
   0 degrees back to its tilt: the "wobble" of 1.2.30. The class holds transitions still for
   exactly the passes in which the rotation is toggled. */
function measuring(on) {
  document.body.classList.toggle("drpg-measuring", on);
  if (!on) void document.body.offsetWidth;   // settle the style pass with the transition still off
}
function moduleLayout(W, H) {
  measuring(true);
  const els = BLOCKS.map(b => b.fixed ? [] : [...document.querySelectorAll(b.sel)].filter(e => e.offsetWidth > 0 && e.offsetHeight > 0));
  // measure with the rotation off, so a pane is cut for the block as laid out, and against the
  // curtain's own box, so a curtain that does not start at the viewport's corner still fits
  rotationSheet().disabled = true;
  els.flat().forEach(e => { e.style.transform = ""; });
  document.querySelectorAll("#scene-controls, #sidebar-tabs").forEach(e => { e.style.transform = ""; });
  /* THE LEFT RAIL STARTS UNDER THE MODULE'S OWN LEFT COLUMN, AND THAT IS A ONE-WAY READ.
     `#drpg-gm-launcher` is laid out over the top of `#scene-controls`, so with nothing done
     the first two tiles sit under the GM badge. The old `placeTiles` pushed the rail down
     until it stood clear of the SHARD CUT FOR IT - a measured position fed back into the
     thing being measured, which is why the tiles crept and jumped every recut. The push is
     computed here instead, from the bottom of the two blocks that stand above the rail and
     whose position does not depend on it, and it is computed while the rotations are off, so
     it is the same number every pass. The rail is then measured where it will actually be. */
  const railTop = document.querySelector("#scene-controls");
  if (railTop) {
    railTop.style.paddingTop = "";
    railTop.style.marginTop = "";
    void railTop.offsetWidth;
    const tops = tileButtons(railTop).map(e => e.getBoundingClientRect().top);
    const above = ["#drpg-hud", "#drpg-gm-launcher"].map(s => document.querySelector(s))
      .filter(e => e && e.offsetWidth > 0 && e.offsetHeight > 0)
      .map(e => e.getBoundingClientRect().bottom);
    if (tops.length && above.length) {
      /* 40, not 18: the GM launcher is a block, and a block is rotated about its pane's
         corner after this runs, which walks it up to 30 px down the screen from the box read
         here. The clearance has to cover where it ENDS UP, not where it is measured. */
      /* 12, not 52. The GM button rides on the rail's shard and turns with it, so it needs
         only a gap, not clearance for a swing it no longer has: 52 left a 50 px hole between
         the button and the first tile ("troche za wysoko", 08.09). */
      /* MARGIN, NOT PADDING, AND IT MAY BE NEGATIVE.
         The rail is placed so its first tile sits 12 px under the GM button, wherever Foundry
         happens to put it. `padding-top` can only ever push it DOWN, so the moment Foundry's
         own layout left a bigger gap than we want - which is what a trip up and back down the
         interface scale does - there was no way to close it again: measured 9 px at 100 %,
         16 at 140 %, and 46 px on the way back to 100 %, growing every round trip.
         A margin moves the box either way, so the gap is stated rather than accumulated. */
      // the button drops by GM_DROP and the tiles keep a gap under it
      const need = Math.round(Math.max(...above) + GM_DROP + 12 - Math.min(...tops));
      railTop.style.boxSizing = "border-box";
      if (Math.abs(need) > 1) railTop.style.marginTop = need + "px";
      /* AND IT STOPS WHERE THE NOTICE TILE STARTS.
         Foundry gives the rail the whole height of the screen and wraps its tools into a
         second column only when they run out of it. Left alone, a control with thirteen tools
         put its last tiles 120 px inside the notice pane - outside the glass cut for the rail,
         which is what "za niska na nasze kafelki" was. The rail is BOUNDED here instead, to
         the room between the GM launcher and the notice tile (whose box is a constant of the
         same scale, see the note-block fallback), so the tools wrap into the third column the
         shard already reserves and the run always ends inside its own glass. */
      const s = uiScale();
      /* THE BOUND IS ON THE RAIL'S BOX, SO IT IS MEASURED FROM THE RAIL'S BOX.
         `max-height` caps `#scene-controls`, and the first TILE sits 33 px inside it - Foundry
         keeps a header there. Computing the room from the tile's top and applying it to the box
         gave the rail those 33 px twice: the run ended 19 px inside the notice tile's pane, and
         the last two tiles stood on glass cut for something else (measured 09.09, five corners).
         The margin is already written above, so one reflow gives the box where it will be. */
      void railTop.offsetHeight;
      const boxTop = railTop.getBoundingClientRect().top;
      /* 14 of clearance off the notice tile. Widening this does NOT move the seam away from the
         tiles - measured 09.09, and the reason is worth keeping: the notice tile's section is cut
         to wherever the strip beside it ENDS, so a shorter rail pulls the section up with it and
         the last row of tiles lands on the same boundary. The gap that matters is the one the
         band keeps under the tiles, which is `coreY` in `railBox`. */
      /* AND THE CLEARANCE IS OFF THE NOTICE TILE'S GLASS, NOT ITS BOX.

         The tile stands in a column the partition LEANS, so the top of its PANE is well above
         the top of its box - measured 10.09: 46 px at 1600x900, 48 at 1920x1080, 60 at
         2560x1440, which is 0.18 to 0.20 of the tile's own width. A rail bounded to the box
         therefore ends inside the pane. At 2560x1440 with the tools open the tiles ran to
         1121 and that pane began at 1120.

         The band under the tiles needs its skirt below that again, so the clearance is the
         lean plus the skirt plus a hair - all three measured rather than guessed, and 0.22
         over the tile's width covers the worst of the three readings. */
      const noteW = 330 * s;
      const notePaneLean = Math.round(noteW * 0.22);
      const room = Math.round(H - (100 + 160) * s - notePaneLean - 34 - 8 - boxTop);
      /* The bound may never be shorter than the controls themselves. Foundry's control menu
         is `flex-wrap: nowrap` - it cannot wrap, so a bound under its own height only hides
         tiles behind the rail's `overflow: hidden` (four of twenty survived the first attempt).
         The TOOLS menu does wrap, and that is the one the bound is for: it folds into the
         third column the shard reserves instead of running down into the notice tile.

         AND THE FLOOR IS THE MENU'S CONTENT, NOT ITS BOX. `scrollHeight` on a flex item that
         has been stretched by its row returns the STRETCHED height - both menus measured 635
         on a screen where the controls themselves need 240 - so the floor came out taller than
         the room every time and the bound never applied at all. Measured off the buttons the
         menu actually holds, which is the only reading that cannot be stretched. */
      const menu = railTop.querySelector(":scope > menu");
      const own = menu ? [...menu.querySelectorAll("button.ui-control")].filter(e => e.offsetWidth > 0) : [];
      const natural = own.length
        ? Math.ceil(Math.max(...own.map(e => e.getBoundingClientRect().bottom))
                  - Math.min(...own.map(e => e.getBoundingClientRect().top)))
        : 0;
      railTop.style.overflow = "visible";
      railTop.style.maxHeight = Math.max(natural, room) + "px";
    }
  }
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
    out.push({ cls: b.cls, sel: b.sel, fixed: Boolean(b.fixed), x: box.x, y: box.y, w: box.w, h: box.h, el: list[0] ?? null, els: list, r });
  });
  LAST.blocks = out.map(b => ({ cls: b.cls, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), measured: Boolean(b.r), n: b.els.length }));
  return out;
}
/* THE INTERFACE LAYER IS A LID, AND SOMETIMES IT TAKES THE MAP'S CLICKS.
   Foundry paints `#interface` over the board and relies on it not being hit-testable; on the
   reporter's client it computed to `pointer-events: auto`, so every click meant for the map -
   panning, selecting a token - landed on the lid and did nothing. Nothing in this module sets
   it (checked rule by rule), so rather than guess at the cause this repairs the symptom, and
   only when it is really there: if the middle of the map hits `#interface` itself, the lid is
   made transparent to the pointer and every child that was hit-testable is pinned to `auto`,
   so not one control changes behaviour and the board gets its clicks back. Undone on unmount. */
const LID = { el: null, prev: "", pinned: [] };
function freeTheBoard() {
  const iface = document.getElementById("interface");
  if (!iface || !themeOn()) return;
  const active = LID.el === iface;
  if (!active) {
    /* Purely a repair now, and a repair only happens when the fault is really there - probed at
       FOUR points, since the middle of the screen is where a window sits and one probe there
       would report the dialog and miss the lid entirely. The module no longer creates the lid
       itself (see `layerIndex`), but a third party that gives `#interface` a z-index of its own
       recreates it exactly, and this is what catches that. */
    let lid = false;
    const W = innerWidth, H = innerHeight;
    try {
      for (const [x, y] of [[W * 0.5, H * 0.5], [W * 0.3, H * 0.72], [W * 0.7, H * 0.28], [W * 0.5, H * 0.85]]) {
        if (document.elementFromPoint(Math.round(x), Math.round(y)) === iface) { lid = true; break; }
      }
    } catch { return; }
    if (!lid) return;                                // the map is reachable: nothing to repair
    LID.el = iface; LID.prev = iface.style.pointerEvents;
  }
  /* Read the children with the lid transparent, because that is what each child ASKS for -
     reading them after the lid is off would report the `none` they merely inherit from it, and
     pinning nothing is the same as making every child that relies on inheritance click-dead.
     What was missing was the other half: a child that COVERS THE BOARD is not a control, it is
     the next lid down, and pinning it just moves the fault one level deeper. That is the bug
     1.2.39 shipped - it wrote an explicit `pointer-events: auto` onto anything full-screen that
     had no rule of its own, Foundry's own main menu included. */
  iface.style.pointerEvents = "";
  const wants = [...iface.children].map(c => [c, getComputedStyle(c).pointerEvents]);
  iface.style.pointerEvents = "none";
  const bb = document.getElementById("board")?.getBoundingClientRect();
  const coversBoard = c => {
    const r = c.getBoundingClientRect();
    return Boolean(bb) && r.width >= bb.width * 0.9 && r.height >= bb.height * 0.9;
  };
  for (const [c, pe] of wants) {
    if (pe === "none" || c.style.pointerEvents) continue;
    if (coversBoard(c)) { log("not pinning a child that covers the board: " + (c.id || c.tagName)); continue; }
    LID.pinned.push(c); c.style.pointerEvents = "auto";
  }
  if (!active) log("the interface layer was taking the map's clicks; the board has them back");
}
function restoreLid() {
  if (!LID.el) return;
  LID.el.style.pointerEvents = LID.prev;
  for (const c of LID.pinned) c.style.pointerEvents = "";
  LID.el = null; LID.prev = ""; LID.pinned.length = 0;
}
/* What the pointer finds over the map, top to bottom: the answer to "the map takes no clicks".
   `elementsFromPoint` SKIPS anything at `pointer-events: none`, so the curtain itself never
   appears here - its absence is not evidence of anything.
   `targetId` against `needsId` is the whole question in one line: Foundry refuses to hover a
   placeable in, and refuses to zoom, unless the element under the pointer IS the board canvas,
   so `targetId !== needsId` means no token can be picked up no matter what else is true. */
function hitStack() {
  const W = innerWidth, H = innerHeight;
  const name = e => e ? e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.classList?.length ? "." + [...e.classList].slice(0, 2).join(".") : "") + " [" + getComputedStyle(e).pointerEvents + "]" : "nothing";
  const at = (x, y) => { try { return [...(document.elementsFromPoint(x, y) || [])].slice(0, 6).map(name); } catch { return ["?"]; } };
  const iface = document.getElementById("interface"), board = document.getElementById("board");
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  let target = null;
  try { target = document.elementFromPoint(cx, cy); } catch { /* detached */ }
  return {
    centre: at(cx, cy),
    lower: at(Math.round(W * 0.35), Math.round(H * 0.75)),
    targetId: target?.id || target?.tagName?.toLowerCase() || null,
    needsId: globalThis.canvas?.app?.view?.id ?? "board",
    boardInsideInterface: Boolean(iface && board && iface !== board && iface.contains(board)),
    interfaceZ: iface ? getComputedStyle(iface).zIndex : null,
    interfaceInline: iface?.getAttribute("style") || null,
    children: iface ? [...iface.children].map(c => (c.id || c.tagName.toLowerCase()) + " computed=" + getComputedStyle(c).pointerEvents + " inline=" + (c.style.pointerEvents || "-")) : [],
    pinned: LID.pinned.map(c => (c.id || c.tagName.toLowerCase()) + "=" + (c.style.pointerEvents || "-")),
    lid: LID.el ? "freed by the module" : "not needed"
  };
}
/** Console helper: `drpgGlassDebug()` prints the frame, the blocks and the self-check of the last pass. */
export function debugGlass() {
  /* `panes` and `live` are here for one question: does the pane cut for a block actually
     straddle the block? A tone missing from `panes` means that block lost its pane to a
     neighbour's column; a pane whose x0/x1 do not sit either side of the block's live box
     means it was cut for something else, or the block moved after it was cut. */
  const live = {};
  for (const sel of ["#drpg-despair", "#drpg-events", "#drpg-hud", "#drpg-player-status", "#countdowns"]) {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    if (r) live[sel] = [Math.round(r.left), Math.round(r.right), Math.round(r.width), Math.round(r.height), getComputedStyle(document.querySelector(sel)).transform === "none" ? "upright" : "tilted"];
  }
  const out = { pointer: hitStack(), frame: LAST.frame, rightColumn: { pinned: document.getElementById("ui-right-column-1")?.dataset.drpgPinned === "1", right: PIN.rail }, blocks: LAST.blocks, panes: (LAST.panes || []).filter(p => p.tone).map(p => p.tone + " " + p.x0 + ".." + p.x1), panesFull: LAST.panes || [], live, checks: CHECKS.slice(), theme: document.body.className, viewport: [innerWidth, innerHeight], curtain: document.getElementById("drpg-curtain")?.getBoundingClientRect?.() };
  console.log("[DRPG] curtain", JSON.stringify(out, null, 1));
  return out;
}
globalThis.drpgGlassDebug = debugGlass;
globalThis.drpgGlassRebuild = () => import("./glass.mjs").then(m => m.refreshGlass());

  /* ---- the glass ------------------------------------------------------------
     Black glass. Colour lives in the seams and in a few stained cells; a panel's
     pane is always plain black so text reads the same everywhere. */
  const STAIN = ["#5c1238", "#142a66"];
  /* A PANEL'S PANE IS GLASS, NOT A PLATE.
     Every tone here went up a step after the audit: at #050409 under 68 % alpha, with a
     further 30 % of black over it and `brightness(0.88)` under it, a pane over a dark map
     is not dark glass - it is a black rectangle with writing on it, which is what the
     tablet screenshot shows behind the clock and the tray. The lift is small (a panel's
     pane must still read as the calmest thing on the screen) and it is paid for by the
     black layer in `paintGlass`, which is thinner over content than over filler. */
  const TONE = { hud: "#0d0b16", rail: "#3a1230", event: "#33102a", three: "#12204d", tray: "#281448", "note-block": "#33102a", launch: "#0d0b16" };
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

  /* `W` is where the glass ENDS (an expanded sidebar is a wall); `FW` is the screen. The slope
     field and the upright zone in the middle belong to the screen: read off the wall instead,
     the Despair rail - centred on the window - fell 158 px off the middle of a 1685 px wall and
     took a full 8 degrees of tilt, which is the leaning rail on the tablet screenshot. */
  function curtainShapes(host, W, H, rnd, boxes, FW) {
    const panes = [];
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
    const push = (poly, tone, kind, rank) => {
      if (!poly || poly.length < 3) return null;
      /* AND ONLY ACROSS THE RUN OF THE TILES.
         The first version of this clipped every pane out of the band for the WHOLE height of
         the screen, which took the clock's own glass, the GM button's and - worst - the
         notice tile's, all three of which live at that wall above or below the rail and had
         nothing to do with it (Dawid, 07.09: "kawalek szkla przeznaczony na powiadomienia
         zniknal"). A pane is cut into three across the band's own run instead: what is above
         it, what is beside it, and what is below. Only the middle piece loses the band. */
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
          const [by0, by1] = b.coreY;
          parts = parts.flatMap(q => {
            const bx = bbox(q);
            if (dir > 0 ? bx.x0 >= b.band : bx.x1 <= b.band) return [q];
            if (bx.y1 <= by0 || bx.y0 >= by1) return [q];
            const out = [];
            let rest = q;
            if (bx.y0 < by0) { const cut = split(q, 0, by0, 0, -1); if (cut[0]) out.push(cut[0]); rest = cut[1]; }
            if (rest) {
              const bx2 = bbox(rest);
              let mid = rest;
              if (bx2.y1 > by1) { const cut = split(rest, 0, by1, 0, -1); mid = cut[0]; if (cut[1]) out.push(cut[1]); }
              const kept = mid ? clipHP(mid, b.band, 0, dir, 0) : null;
              if (kept) out.push(kept);
            }
            return out.filter(Boolean);
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

    /* THE ROOM THE TILES COULD EVER NEED, DECIDED ONCE.
       This used to be the union of the tiles that happen to be shown, and that box is a
       moving target: opening a scene control's tools takes the left rail from 72 px wide and
       12 tiles to 112 and 20 (they wrap into a second column when the run is taller than the
       screen), and expanding the sidebar carries the right rail 300 px inboard. Cut to that,
       the glass was recut on every click - the glitch and the sidebar regression Dawid
       reported on 07.09, and the reason three rounds of "make the glass fit the tiles" kept
       producing a fit that lasted until the next click.
       The shard is cut to CAPACITY instead. Width: the widest the rail can get, which is one
       column for the tab rail and three for the scene rail (its controls, plus the two the
       tools wrap into at their longest). Height: the rail's own run, which is what bounds the
       wrap in the first place. Anchor: the WALL, not the measured left edge, so a sidebar
       sliding out over the curtain changes nothing about it. Nothing here is read from a
       state the user can change with a click. */
    const railBox = (sel, side, fallback) => {
      const rail = host.querySelector(sel);
      const o = cv?.getBoundingClientRect();
      if (!rail || !rail.offsetWidth || !o) return fallback ? { ...fallback, real: false } : { real: false };
      const keep = rail.style.transform; rail.style.transform = "";
      const btns = tileButtons(rail);
      const r = rail.getBoundingClientRect();
      const s = o.width / W || 1;
      const first = btns.length ? btns[0].getBoundingClientRect() : null;
      const unit = first ? first.width : 32;
      // the gap between two columns of tiles, read off the rail's own menus (8 px in v13/v14)
      const menus = [...rail.querySelectorAll(":scope > menu")].filter(m => m.offsetWidth > 0);
      const gap = menus.length > 1
        ? Math.max(0, Math.round(menus[1].getBoundingClientRect().left - menus[0].getBoundingClientRect().right))
        : 8;
      let top = btns.length ? Math.min(...btns.map(e => e.getBoundingClientRect().top)) : r.top;
      /* THE GM BUTTON RIDES WITH THE LEFT RAIL. It is laid out directly above the tiles, in
         the same 72 px of wall, so the shard is measured to hold both and they turn together
         (Dawid, 07.09: "przerzucmy gm button do tego samego kawalka kurtyny"). */
      if (!side) {
        const gm = host.querySelector("#drpg-gm-launcher");
        if (gm && gm.offsetWidth) {
          const g = gm.getBoundingClientRect();
          top = Math.min(top, g.top + GM_DROP);
        }
      }
      /* From wherever the shard now STARTS to the bottom of the rail's own run. Adding the
         GM button's height on top of a height already measured from its top counted it twice
         and ran the band down into the notice tile's column, which then stopped hugging the
         wall and left a wedge of bare map there. */
      /* THREE CORNERS OF EIGHTY ARE STILL ON THE NOTICE TILE'S PANE AT 1080p, AND WIDENING
         THIS IS NOT WHAT FIXES THEM. Reserving the whole wall the rail may use was tried on
         09.09 and changed the tally by exactly nothing, which is the measurement that says
         where the fault really is: `push()` exempts `section` panes from the rail's band
         entirely, so however much band is asked for, a section already covering it keeps it.
         The exemption is right in general - it is what stopped the clock, the GM button and the
         notice tile losing their glass on 07.09 - and too broad here. What it wants is a rule
         it does not have: a section may lose the band ABOVE AND BELOW the block it was cut for,
         never where that block stands. `push` would have to be given the block's own box, which
         both call sites already hold as `up.r`. A solver change, not a patch; see the note
         beside BLOCKS about what teaching this partition costs. */
      /* TO THE LAST TILE, NOT TO THE BOTTOM OF THE BOX.

         `rail.offsetHeight` is the box, and the box is whatever `max-height` left it -
         the bound in `moduleLayout` sets that to the room available at this wall, not to
         what the tiles use. Measured on 10.09 at 2560x1440: the box was 525 px tall and
         held 314 px of tiles, so the band reserved 211 px of empty wall and then asked for
         a 34 px skirt below THAT. It ran into the notice tile's pane, which is what the
         seam through the bottom row of tiles was really about.

         The band exists to hold the tiles and the GM button above them. Both are measured;
         the padding under the last tile is not part of either. `top` is already the higher
         of the first tile and the GM button, so this is the other end of the same reading. */
      const tilesBottom = btns.length
        ? Math.max(...btns.map(e => e.getBoundingClientRect().bottom))
        : (r.top + rail.offsetHeight);
      const wantH = Math.max(tilesBottom - top, btns.length * 1);
      /* HOW MANY COLUMNS THE TILES CAN ACTUALLY REACH, not the worst case on any screen.
         Foundry wraps a control's tools into another column only when they run out of the
         height available, so on a tall screen thirteen tools sit in ONE column and reserving
         three was reserving a column of glass that can never be used. */
      let cols = 1;
      if (!side) {
        const tools = Object.values(globalThis.ui?.controls?.controls ?? {})
          .map(c => Object.keys(c.tools ?? {}).length);
        const most = tools.length ? Math.max(...tools) : 0;
        const pitch = unit + gap;
        const fit = Math.max(1, Math.floor(wantH / Math.max(1, pitch)));
        cols = 1 + Math.max(1, Math.ceil(most / fit));
      }
      /* The container is not the content: `#scene-controls` is 151 px wide with its buttons
         in the right 99 of it, and reserving glass for that padding is 52 px of empty band. */
      const seen = btns.map(e => e.getBoundingClientRect());
      const shown = seen.length ? Math.max(...seen.map(q => q.right)) - Math.min(...seen.map(q => q.left)) : rail.offsetWidth;
      const coreW = Math.max(shown, cols * unit + (cols - 1) * gap);
      rail.style.transform = keep;
      /* IN THE CURTAIN'S OWN PIXELS, AND AROUND THE TILES RATHER THAN THE CONTAINER.
         The width came from the tiles once the container's 52 px of padding was dropped, but
         the left edge was still the CONTAINER's - so the band was the right size in the wrong
         place, sitting half a column left of what it was cut for. Anything centred on the
         tiles then stood over its edge (Dawid, 08.09: "wychodzi poza swoj panel"). Both from
         the same measurement now. The right-hand rail stays anchored to its wall, which is
         what keeps it still while the sidebar slides out over it. */
      const pad = 8;
      const tilesLeft = seen.length ? (Math.min(...seen.map(q => q.left)) - o.left) / s : (r.left - o.left) / s;
      const c1 = side ? (W - pad) : tilesLeft + coreW;
      const c0 = side ? (W - pad - coreW) : tilesLeft;
      /* The shard is the core box plus the swing, on BOTH sides: the rail turns about the
         core's centre, so it leans out over each edge by the same amount, and a shard grown
         on one side only left the tiles hanging over the other. */
      const sw = railSwing(wantH), lift = Math.round(coreW * Math.sin(MAX_TILT) / 2);
      const slack = 14 + Math.round(wantH * Math.tan(STRIP_ANGLE));
      const x0 = c0 - sw, x1 = c1 + sw;
      const y0 = (top - o.top) / s - lift, y1 = y0 + (wantH + 2 * lift) / s;
      /* `band` is the reserved wall zone, and it is the STRIP's width, not the tiles'. The
         strip's outer edge leans in over its run and keeps a clearance off the tiles, so a
         band cut to the tiles alone left the strip's own quad hanging over the panes beside
         it - and a strip piece that overlaps a content pane is thrown away by the partition,
         which is how the tab rail came to stand on no glass at all. Reserve what it takes. */
      return { x0, y0, x1, y1, real: true, core: [c0, c1],
               centre: [(c0 + c1) / 2 * s + o.left, (y0 + y1) / 2 * s + o.top],
               /* THE BAND BUYS THE ANGLE. A constant slack meant the edge could only lean
                  as far as whatever was left over, so on a tall rail it came out at 1.5 deg
                  instead of the 3.4 the audit page draws, and "parallel" was true but
                  invisible. The slack is what the angle costs on THIS rail - its own run
                  times the tangent - plus the 14 px the edge keeps off the tiles. */
               band: side ? x0 - slack : x1 + slack,
               /* A FEW PIXELS PROUD AT EACH END. The cut used to start exactly at the top of
                  the GM button, so the button's top edge fell on the far side of it and its
                  two upper corners stayed on the clock's glass while its lower two were on
                  the rail's - straddling the seam. What stands in the band has to be inside
                  the band, edges included. */
               /* THE SKIRT UNDER THE LAST TILE IS DEEPER THAN THE COLLAR OVER THE FIRST.
                  14 above and 14 below left the strip's lower edge exactly where the tiles end,
                  so the seam between the strip and the notice tile's section ran through the
                  bottom row - three corners of twenty tiles on the wrong pane at 1080p, and none
                  at 1440p, because there the run ends far above the tile. 34 below puts the seam
                  clear of the row; above it stays 14, where the GM button needs it tight. */
               coreY: [(top - o.top) / s - 14, (top - o.top) / s + wantH / s + 34],
               origin: [(c0 + c1) / 2 * s + o.left - r.left, (y0 + y1) / 2 * s + o.top - r.top] };
    };
    /* THE RAILS' BANDS ARE KNOWN BEFORE THE COLUMNS ARE CUT, AND THE COLUMNS RESPECT THEM.
       A column near a wall runs its pane INTO the wall so no bare wedge is left there
       (`hugL` / `hugR` below). On a side where a rail stands that is exactly wrong: the
       Projects tray's pane ran under the tab rail all the way to the edge, so the rail's
       upper tiles sat on the tray's glass and the seam between it and the strip crossed them
       - 37 of 64 tile corners on panes that were not theirs (measured 07.09). The strip
       covers that band instead, for its whole height, and a column whose own run overlaps
       the band stops at its own edge. Nothing is left bare: the band IS the strip. */
    const cv = host.querySelector(".curtain > canvas.sg, #drpg-curtain > canvas.sg");

    const railBands = {
      left: railBox("#scene-controls", 0, null),
      right: railBox("#sidebar-tabs", 1, null),
    };
    const bandOwns = (c, side) => {
      const b = side ? railBands.right : railBands.left;
      if (!b || b.real === false) return false;
      return c.y0 < b.y1 && c.y1 > b.y0;
    };
    /* a column's pane: the padded block rectangle rotated with the field, its near
       side run off the screen edge, clipped to the screen; the block is rotated by
       the same angle around the same pivot, so glass and panel agree exactly */
    const buildColumn = (c, cols, band) => {
      const cx = (c.x0 + c.x1) / 2, h = c.y1 - c.y0;
      const s0 = field(cx, FW, band);
      let theta = Math.abs(cx - FW / 2) < 0.1 * FW ? 0 : Math.min(8 * DEG, Math.max(6 * DEG, Math.atan(Math.abs(s0))));
      // a neighbour too close forbids the tilt that would swing the pane into it
      for (const o of cols) if (o !== c) { const gap = o.x0 > c.x1 ? o.x0 - c.x1 : c.x0 - o.x1; if (gap >= 0) theta = Math.min(theta, Math.atan(Math.max(0, gap - 2 * PAD_SIDE - 2) / Math.max(h, 1))); }
      const s = Math.sign(s0) * Math.tan(theta);
      const phi = -Math.atan(s);
      const px = cx < W / 2 ? c.x1 : c.x0;
      const py = band === "top" ? c.y0 : c.y1;
      const cs = Math.cos(phi), sn = Math.sin(phi);
      const rot = (X, Y) => [px + X * cs - Y * sn, py + X * sn + Y * cs];
      // the rotation goes into a stylesheet rule keyed by the block's selector (applyRotations), so a
      // block the module re-renders from scratch wears it the moment it appears; a union of several
      // elements gets inline styles, because each has its own origin
      const turn = Math.abs(phi) < 0.004 ? "none" : "rotate(" + phi + "rad)";
      for (const b of c.items) {
        /* A FIXED BLOCK IS STILL A BLOCK ON THE GLASS. Its box is a constant - the notice tile is
           cut once and never recut, whatever arrives in it - but its element must still turn with
           its pane, or the cards stand upright inside a tilted piece of glass (1.2.38). The rule
           is keyed to the SELECTOR and computed from the fixed box, so it holds even though the
           element is not measured and may not exist yet: popup.mjs builds the stack on the first
           card of the session, long after the glass was cut. */
        if (b.fixed) { ROT.push({ sel: b.sel, el: null, origin: (px - b.x) + "px " + (py - b.y) + "px", transform: turn }); continue; }
        if (!b.el) continue;
        for (const e of b.els) {
          const er = e.getBoundingClientRect();
          ROT.push({ sel: b.els.length === 1 ? b.sel : null, el: e, origin: (px - er.left) + "px " + (py - er.top) + "px", transform: turn });
        }
      }
      let X0 = c.x0 - px - PAD_SIDE, X1 = c.x1 - px + PAD_SIDE;
      const Yn = (band === "top" ? c.y0 - py : c.y1 - py) + (band === "top" ? -3000 : 3000);
      const Yf = band === "top" ? c.y1 - py + PAD_FAR : c.y0 - py - PAD_FAR;
      // a column near a wall (under Foundry's sidebar too) runs its pane into the wall: the far corner is
      // pushed past the screen edge by the gap and by the swing of the rotation, so no bare wedge is left
      /* A COLUMN AT A WALL ALWAYS HUGS IT. This used to stand down on a side where a rail
         has its band, on the argument that the band is the strip's - and that is what left
         the notice tile's pane 31 px short of the left wall, with a 208 px wedge of bare map
         down the edge (07.09). It was a second line of defence for something `push` already
         does: every non-strip pane is clipped out of the band across the tiles' own run, and
         only across it. Above and below the tiles the column keeps the wall, as it should. */
      c.hugL = c.x0 - PAD_SIDE < HUG; c.hugR = c.x1 + PAD_SIDE > W - HUG;
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
      c.farL = rot(X0, Yf); c.farR = rot(X1, Yf);
      c.far = { p: c.farL, d: [cs, sn] };
      c.depthL = Math.abs(c.farL[1] - edgeY); c.depthR = Math.abs(c.farR[1] - edgeY);
      c.s = s; c.phi = phi; c.rot = rot; c.px = px; c.py = py; c.cs = cs; c.sn = sn;
      c.corners = [rot(c.x0 - px, c.y0 - py), rot(c.x1 - px, c.y0 - py), rot(c.x1 - px, c.y1 - py), rot(c.x0 - px, c.y1 - py)].filter(q => q[0] > 1 && q[0] < W - 1 && q[1] > 1 && q[1] < H - 1);
      let piece = clipRect(rect, W, H);
      for (let m = 0; m + 1 < c.items.length && piece; m++) {
        const up = c.items[m], dn = c.items[m + 1];
        if (dn.y < up.y + up.h - 12) continue;                 // blocks that truly overlap share one pane; a touch does not
        const Ydiv = ((up.y + up.h) + dn.y) / 2 - py;
        const pt = rot(0, Ydiv);
        const [below, above] = split(piece, pt[0], pt[1], -sn, cs);
        const sec = push(above, up.cls, "section", 0); if (sec) sec.empty = !up.r; piece = below;
      }
      c.pane = push(piece, c.items[c.items.length - 1].cls, "section", 0);
      if (c.pane) c.pane.empty = !c.items[c.items.length - 1].r;
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
      else for (const p of panes) { const bb = bbox(p.poly); if ((side ? bb.x1 > W - bandT + 0.5 : bb.x0 < bandT - 0.5) && bb.y1 < H / 2) yTop = Math.max(yTop, bb.y1); }
      if (hugB) yBot = Math.min(lineY(cB, wall), lineY(cB, wall + dir * wBot));
      else for (const p of panes) { const bb = bbox(p.poly); if ((side ? bb.x1 > W - bandB + 0.5 : bb.x0 < bandB - 0.5) && bb.y0 >= H / 2) yBot = Math.min(yBot, bb.y0); }
      if (yBot - yTop < 160) continue;
      /* A SHORT STRIP IS THE TILES' ALONE. Between a tall clock column (a long campaign name,
         a large interface scale) and the notice pane there can be too little of the edge for
         a mid seam with the tiles' shard above it: the seam was forced under the tiles, and
         the family cut across them. Under 420 px the strip has no mid seam and no lower
         family - it is one upper quad, and the tiles' shard is cut from that. The same
         applies to the skip above: a strip is dropped only when even the tiles cannot stand
         in it (and at 240 the left rail lost its shard at 140 % on a 900 px screen).

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
      const M = [wall + dir * wMid, yMid], Wm = [wall, yMid - wMid * Math.tan(tilt)];
      const yT0 = hugT ? Math.min(lineY(cT, wall), lineY(cT, wall + dir * wTopFit)) - 1 : yTop;
      /* THE CONTROL POINT ONLY EXISTS IF IT IS A CORNER. Once the strip was made to hold the
         tiles' width at its middle, `wCtl` and `wMid` came out equal, and the control vertex
         landed two pixels from `M` - a degenerate edge, which makes the quad non-convex and
         breaks the point-in-pane test the whole coverage check rests on (it then reported 47
         covered samples as holes). It is a corner or it is not there. */
      let upperQ = clipRect([[wall, yT0], [wall + dir * wTopFit, yT0], ...(yCtl < yMid - 40 && wCtl > wMid + 4 ? [[wall + dir * wCtl, yCtl]] : []), M, Wm], W, H);
      // the angle of that edge, for the tiles that sit on it (clockwise on the left, the mirror on the right)
      tiles[side ? "right" : "left"] = { angle: Math.atan((wTopFit - wCtl) / Math.max(1, yCtl - yTop)) * (side ? -1 : 1), yTop, wTop: wTopFit, wCtl, yCtl, origin: tb.origin || null, box: tb.core || [tb.x0, tb.x1], centre: tb.centre || null };
      let lowerQ = short ? null : clipRect([Wm, M, [wall + dir * wBot, yB0], [wall, yB0]], W, H);
      if (hugT && upperQ) { const [fx, fy] = cT.far.p; upperQ = clipHP(upperQ, fx, fy, -cT.sn, cT.cs); }
      // a short strip reaches the bottom column's pane, and is clipped by its far edge as the lower quad would be
      if (short && hugB && upperQ) { const [fx, fy] = cB.far.p; upperQ = clipHP(upperQ, fx, fy, cB.sn, -cB.cs); }
      if (hugB && lowerQ) { const [fx, fy] = cB.far.p; lowerQ = clipHP(lowerQ, fx, fy, cB.sn, -cB.cs); }
      const cutFamily = (poly, slope, y0, y1, box) => {
        if (!poly) return;
        let pieces = [poly];
        if (box) {   // two shallow cuts just above and below the tiles; the piece between them is theirs alone
          for (const [yy, tilt] of [[box.y0 - 14, -0.10], [box.y1 + 14, 0.10]]) pieces = pieces.flatMap(pp => split(pp, wall, yy, -tilt, dir).filter(Boolean));
          const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
          const k = pieces.findIndex(pp => inside(pp, cx, cy));
          if (k >= 0) { const shard = push(pieces.splice(k, 1)[0], null, "strip", 9); if (shard) shard.plain = box.real !== false; }
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

  /* the direction of a pane's longest edge that does not lie on the screen's edge; the longest
     edge of all when every edge is on the screen (a band's full-width pane) */
  function grainAngle(poly, W, H) {
    const edge = onEdge(W, H);
    let best = null, bl = -1, any = null, al = -1;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j], b = poly[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > al) { al = L; any = [a, b]; }
      if (!edge(a, b) && L > bl) { bl = L; best = [a, b]; }
    }
    const [a, b] = best || any || [[0, 0], [1, 0]];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  function paintGlass(ctx, W, H, panes, acc, { glowInside = false, inset = 0, seamCtx = null } = {}) {
    const sx = seamCtx || ctx;   // the seams may live on a canvas above the pulse layer
    ctx.clearRect(0, 0, W, H);
    panes.forEach((p, i) => {
      const k = p.tone && TONE[p.tone] ? p.tone : null;
      const bb = bbox(p.poly);
      const hsh = hash((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2);
      /* AN EMPTY TILE IS GLASS. A pane cut for a block that is not there (the notice tile
         between notices, the GM bar on a player's screen) keeps its place in the partition
         but is painted like the filler around it - never a dark plate with nothing on it. */
      const content = p.content && !p.empty;
      const stained = !content && !p.plain && hsh > 0.72;   // the same share of coloured panes on a window band as on the curtain
      ctx.save(); path(ctx, p.poly); ctx.clip();
      // black glass first, then a little colour: a panel keeps its tone, most filler a faint tint, one in five stained
      const lum = hash((bb.x0 + bb.x1) / 2 + 17, (bb.y0 + bb.y1) / 2 - 31);
      ctx.globalAlpha = (content ? 0.55 : stained ? 0.30 : 0.58) + (lum - 0.5) * 0.08;
      ctx.fillStyle = content ? (k ? TONE[k] : "#0d0b16") : (lum > 0.5 ? "#0c0a14" : "#0a0810");
      ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      if (!content) {
        ctx.globalAlpha = stained ? 0.60 : 0.05 + lum * 0.07;
        ctx.fillStyle = STAIN[Math.floor(hsh * 1000) % STAIN.length];
        ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      }
      // the black over the colour: full weight on filler, half of it over content, where the
      // pane already carries the darkest tone and the text carries its own shadow
      ctx.globalAlpha = 1; ctx.fillStyle = content ? "rgba(0,0,0,0.12)" : stained ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.30)"; ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
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
        /* THE STREAKS RUN WITH THE PANE. They ran along one shear for every pane, which on a
           shard cut at another angle reads as a texture pasted over the glass. Each pane's
           streaks and veins lie parallel to its longest edge that is not the screen's, so the
           grain follows the cut - as the audit page asks, "lines parallel to the edge". */
        g2.save(); g2.translate(cx, cy); g2.rotate(grainAngle(p.poly, W, H) - Math.PI / 2);
        for (let i = -span; i < span; i += 7) { g2.fillStyle = "rgba(255,255,255," + (0.12 + (Math.round(i / 7) % 3 === 0 ? 0.09 : 0)) + ")"; g2.fillRect(i, -span, 1.2, 2 * span); }
        for (let j = 0; j < 3; j++) { const x = (hash(cx + j * 31, cy - j * 17) - 0.5) * span * 0.9; g2.fillStyle = rgba(acc, 0.26); g2.fillRect(x, -span, 2.2 + j, 2 * span); g2.fillStyle = "rgba(255,255,255,0.3)"; g2.fillRect(x + 3 + j, -span, 0.8, 2 * span); }
        // INK: the glass was coloured with ink, not dye. Along the shear, five or six dark veins that
        // wander and thicken, and a few pools where the ink settled; a grain of darker specks over it.
        g2.lineCap = "round";
        for (let v = 0; v < 6; v++) {
          const h1 = hash(cx * 1.7 + v * 53, cy + v * 29), h2 = hash(cy * 1.3 - v * 41, cx + v * 67);
          const x = (h1 - 0.5) * span * 0.95, wob = 6 + h2 * 14;
          g2.strokeStyle = "rgba(4,2,8," + (0.28 + h2 * 0.22) + ")"; g2.lineWidth = 0.8 + h1 * 3.2;
          g2.beginPath(); g2.moveTo(x, -span);
          for (let y = -span; y <= span; y += span / 3) g2.quadraticCurveTo(x + (hash(x + y, v) - 0.5) * wob * 2, y - span / 6, x + (hash(y, x + v) - 0.5) * wob, y);
          g2.stroke();
        }
        g2.restore();
        for (let k = 0; k < 3; k++) {
          const px = bb.x0 + hash(cx + k * 97, cy) * tw, py = bb.y0 + hash(cy - k * 71, cx) * th, r = 12 + hash(k, cx + cy) * Math.min(tw, th) * 0.35;
          const pool = g2.createRadialGradient(px, py, 0, px, py, r);
          pool.addColorStop(0, "rgba(4,2,8,0.34)"); pool.addColorStop(0.6, "rgba(4,2,8,0.12)"); pool.addColorStop(1, "rgba(4,2,8,0)");
          g2.fillStyle = pool; g2.fillRect(px - r, py - r, 2 * r, 2 * r);
        }
        for (let y = bb.y0 + 3; y < bb.y1; y += 6) for (let x = bb.x0 + 3 + (Math.floor(y / 6) % 2) * 3; x < bb.x1; x += 6) { g2.fillStyle = hash(x, y) > 0.5 ? rgba(acc, 0.18) : "rgba(4,2,8,0.3)"; g2.fillRect(x, y, 1.2, 1.2); }
        p.tex = t;
        // the ink is in the glass at all times, half strength; the pulse layer adds the rest while the pane is lit
        ctx.save(); path(ctx, p.poly); ctx.clip(); ctx.globalAlpha = 0.5; ctx.drawImage(t, bb.x0, bb.y0); ctx.restore(); ctx.globalAlpha = 1;
      }
    });
    if (seamCtx) seamCtx.clearRect(0, 0, W, H);
    if (inset > 0) {   // the seams (not the glass) are kept out of the content box
      sx.save(); sx.beginPath(); sx.rect(0, 0, W, H); sx.rect(inset, inset * 2.6, W - 2 * inset, H - inset * 3.4); sx.clip("evenodd");
    }
    if (glowInside) {
      sx.save(); sx.globalCompositeOperation = "lighter"; sx.strokeStyle = acc;
      const nds = junctions(panes, W, H);
      for (const [blur, a, wdt] of [[10, 0.10, 2.0], [4, 0.12, 1.2]]) { sx.filter = "blur(" + blur + "px)"; sx.globalAlpha = a; seams(sx, panes, W, H, wdt); nodeArms(sx, nds, 12, wdt * 1.6); }
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

  /* A LAYER IS POSITIONED THE MOMENT IT EXISTS.
     The pulse and the seams are created here, after `mount()` has already written its inline
     positioning onto the canvases it found - so they had none, and the sheet gave them only a
     z-index. An unpositioned canvas is an inline box in flow: the seam layer happened to land
     at 0,0 at the curtain's own size and looked right, and the half-size pulse wrapped onto
     the next line, under the bottom edge, invisible. In 1.2.27 the watchdog re-mounted the
     curtain on a GM's screen (the wall made its width differ from the viewport) and stamped
     the positioning onto every canvas by then - which is the only reason the pulse was ever
     seen. It is stamped here, on creation, and the sheet says the same. */
  const LAYER = "position:absolute;inset:0;width:100%;height:100%;";
  const layerAfter = (after, cls, W, H) => { let c = after.parentElement.querySelector(":scope > canvas." + cls); if (!c) { c = document.createElement("canvas"); c.className = cls; c.style.cssText = LAYER; after.after(c); } c.width = W; c.height = H; return c; };
  /* ---- the curtain: geometry now, paint when it is looked at -------------------- */
  const rng = seed => { let sd = seed; return () => { sd = (sd * 1664525 + 1013904223) % 4294967296; return sd / 4294967296; }; };
  function curtainGeometry(job) {
    const el = job.el, host = document, c = el.querySelector("canvas.sg");
    if (!c || c.clientWidth < 10) return false;
    // the curtain's own box in viewport pixels (it is a fixed child of the body, so this is the viewport);
    // never the canvas's client size, which a zoomed ancestor would inflate
    const rc = el.getBoundingClientRect();
    /* AN EXPANDED SIDEBAR IS A WALL, AND FOUNDRY IS ASKED WHETHER IT IS EXPANDED.
       The glass is cut up to the sidebar's left edge so the blocks beside it hug it as they
       would hug the screen. Measuring its WIDTH to decide that was the bug behind "the glass
       does not come back": Foundry collapses the sidebar with a transition, so for a few
       hundred milliseconds after the click it is still 300 px wide, the one rebuild the
       collapse hook scheduled measured it mid-animation, and nothing measured again - the
       wall stayed at 1685 px with the right-hand column beyond it. `ui.sidebar.expanded` is
       true or false the moment the click lands; the width is only the fallback. */
    /* THE SIDEBAR DOES NOT EXIST FOR THE CURTAIN.
       Two releases tried to treat an expanded sidebar as a wall the glass is cut up to, and
       neither could tell reliably when it was open. The rule is simpler now and it is the
       table's: the glass is the screen, always; the right-hand column is pinned where it
       stands with the sidebar closed (`pinRightColumn`); and an expanded sidebar slides over
       both without moving anything or recutting anything. */
    const fullW = Math.round(rc.width || innerWidth);
    const W = fullW, H = Math.round(rc.height || innerHeight);
    LAST.frame = { W, H, left: rc.left, top: rc.top, inner: [innerWidth, innerHeight], canvas: [c.clientWidth, c.clientHeight] };
    el.style.width = W + "px";   // the canvases are 100% of the curtain: the curtain is as wide as the glass
    pinRightColumn();
    /* THE BLOCKS ARE PART OF THE SIGNATURE, NOT ONLY THE FRAME.
       A block that MOVES without changing size - the right-hand column sliding over when the
       sidebar collapses, the tray folding, the Event panel arriving - left the signature at
       the same "W x H" and the glass was never recut. Measuring the layout first costs eight
       rectangles and settles it. */
    const boxes = moduleLayout(W, H);
    const sig = W + "x" + H + "|" + boxes.map(b => b.cls + Math.round(b.x) + "," + Math.round(b.y) + "," + Math.round(b.w) + "," + Math.round(b.h)).join(";");
    if (job.sig === sig) { applyRotations(); return true; }   // `moduleLayout` switched the rotations off to measure
    job.sig = sig; job.W = W; job.H = H;
    ROT.length = 0;
    const panes = curtainShapes(host, W, H, rng(job.seed), boxes, fullW);
    // the silhouette: one clip path of every pane, crisp at any scale, no bitmap
    const d = panes.map(p => "M" + p.poly.map(q => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + "Z").join("");
    /* AN IDENTICAL CUT KEEPS ITS PAINTED PANES.
       The pane objects carry more than their polygon once `curtainPaint` has been over them:
       the phase and period of their pulse, whether they are stained, their texture. A rebuild
       that recut the same geometry used to replace them with fresh objects and then, because
       nothing had changed, not repaint - so the pulse read `undefined` phases, computed NaN,
       and drew nothing from that moment on. In 1.2.27 that took the first rebuild after the
       layout settled; in 1.2.30, which recuts on every drift, it was immediate. The path string
       is the whole geometry, so equal strings mean the old panes are exactly right. */
    const same = job.pathD === d && Array.isArray(job.panes);
    job.pathD = d;
    if (!same) { job.panes = panes; el.style.clipPath = "path('" + d + "')"; }
    el.style.visibility = "";
    const t = panes.meta.tiles || {};
    for (const [sel, side] of [["#scene-controls", "left"], ["#drpg-gm-launcher", "left"], ["#sidebar-tabs", "right"]]) {
      const tile = host.querySelector(sel); if (!tile || !tile.offsetWidth) continue;
      /* Every element on a rail's shard turns about the SHARD's centre, so the origin is
         computed from that centre against each element's own box - one number for the piece
         of glass, one origin per thing standing on it. */
      const c = t[side]?.centre, tr = tile.getBoundingClientRect();
      const o = c ? [c[0] - tr.left, c[1] - tr.top] : t[side]?.origin;
      /* `rail: true` sends this through `railRule`: the rail turns about the centre of its own
         shard and is then kept inside it, and inside the wall, by one computed translate. */
      /* THE EDGE'S ANGLE, BUT NEVER SO LITTLE THAT THE RAIL READS AS UPRIGHT.
         The lean a strip's outer edge can afford is its lean over its RUN, and a rail is
         nearly as tall as the screen: 48 px of lean over 924 is 3 degrees, and at the bottom
         of that range the tiles simply look vertical (Dawid, 07.09). The direction is the
         edge's - the rail must lean the way its own glass does - and the size is at least
         RAIL_LEAN. The shard already reserves the swing of MAX_TILT, which is larger than
         this, so a rail leaning a little harder than its edge still stands inside its glass. */
      /* THE EDGE'S OWN ANGLE, NOT A CONSTANT NEXT TO IT. `RAIL_LEAN` was a floor on the
         rotation, which is the wrong end of the problem: if a strip cannot lean, that is a
         strip too narrow, not a rail too upright. The edge is now cut to `STRIP_ANGLE`, so
         taking it verbatim is what "równolegle" means. */
      const ang = t[side]?.angle ?? 0;
      /* THE SCENE RAIL IS NOT CENTRED IN ITS GLASS. Centring it moved the tiles to the
         middle of the band and the GM button came with them, which put both a good 50 px
         right of the wall they belong against ("mialy byc pod gm panel", 07.09). It keeps
         Foundry's own place at the wall and only the wall clamp applies; the band is anchored
         to the same wall, so the tiles sit at its edge and the button sits over them. */
      const kids = tileButtons(tile).map(e => e.getBoundingClientRect());
      const own = tile.getBoundingClientRect();
      /* THE GM BUTTON DROPS UNTIL IT IS ON ONE PIECE OF GLASS.
         It rides on the rail's shard, but it is laid out 10 px too high for it: the clock's
         pane reaches a little further down the wall than the clock's own block does, so the
         button's top two corners sat on the clock's glass and its lower two on the rail's,
         with the seam between them running across it (measured 08.09 - two corners on
         `section#0`, two on `strip/plain#31`).
         Trimming the clock's pane instead is not an option: this partition's overlap and
         point-in-pane tests both assume convex panes, and a pane with a notch cut out of it
         is not convex - it makes the strip beside it look overlapping and gets it discarded.
         So the button moves, by the smallest amount that puts it clear. */
      /* A CONSTANT DROP, AFTER TWO ATTEMPTS AT A MEASURED ONE MADE IT WORSE.
         The gap wants to be 12 px, and deriving it from the two boxes should give exactly
         that. It does not: the button's own box is not dependable at layout time - on the
         first pass it may not have rendered, which gave a 0 px gap once and 18 px on every
         pass after - and a drop derived from it lands the button 17 px INSIDE the tiles,
         consistently, at every scale and with the shard's rotation accounted for. I could not
         find the missing 17 px, so this stays a constant with the room for it reserved above
         the tiles. What that buys, and what the complaint was about, is that the gap no longer
         GROWS: measured across a trip to 140 % and back, and down to 80 % and back, it holds
         its value instead of adding 28 px each way. */
      const dy = sel === "#drpg-gm-launcher" ? GM_DROP : 0;
      const tileLocal = kids.length ? [
        Math.min(...kids.map(q => q.left)) - own.left, Math.min(...kids.map(q => q.top)) - own.top,
        Math.max(...kids.map(q => q.right)) - own.left, Math.max(...kids.map(q => q.bottom)) - own.top] : null;
      ROT.push({ sel, el: tile, rail: true, pane: sel === "#scene-controls" ? null : (t[side]?.box ?? null), tileLocal, dy,
                 pageLeft: own.left, pageTop: own.top,
                 alignTo: sel === "#drpg-gm-launcher" ? "#scene-controls" : null,
                 origin: o ? Math.round(o[0]) + "px " + Math.round(o[1]) + "px" : "50% 50%",
                 transform: ang ? "rotate(" + ang + "rad)" : "none" });
    }
    applyRotations();
    // self-check: C1 no overlaps, convexity, C2 every block inside its own pane and no other, C3 the top edge covered
    let ov = 0, nonconvex = 0, blockFails = 0, edgeGaps = 0, fitFails = 0; const ncv = [];
    for (let i = 0; i < panes.length; i++) { if (!convex(panes[i].poly)) { nonconvex++; ncv.push(panes[i].kind + ':' + panes[i].poly.map(q => q.map(v => Math.round(v)).join(',')).join(' ')); } for (let j = i + 1; j < panes.length; j++) if (overlaps(panes[i].poly, panes[j].poly)) ov++; }
    for (const col of [...panes.meta.top, ...panes.meta.bot]) for (const b of col.items) {
      /* THE BLOCK'S OWN PANE, NOT ITS COLUMN-MATE'S.
         This used to accept a pane toned for ANY member of the merged column, so a block that
         had been absorbed into a neighbour's pane and lost its own passed the check by standing
         inside the neighbour's glass. That is exactly the failure this check exists to catch,
         and it is why the Despair rail could lose its pane on a narrow screen and report clean. */
      const own = panes.filter(p => p.content && p.tone === b.cls);
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
    CHECKS.push({ seed: job.seed, count: panes.length, overlaps: ov, nonconvex, ncv, blockFails, edgeGaps, fitFails, sig: d.length, same });
    // every pane, for `drpgGlassDebug()`: what was cut, and where
    /* `poly` as well as the bounding box: the rails are not blocks, so the self-check below
       says nothing about whether the scene tiles sit inside one pane - only a point-in-polygon
       test against the real shapes does, and that is what the tile-containment probe runs.
       A bounding box cannot answer it: the panes lean, so their boxes overlap even when the
       panes do not. Nothing is printed from here - `debugGlass` maps these to tone strings. */
    LAST.panes = panes.map(p => { const bb = bbox(p.poly); return { kind: p.kind, tone: p.tone || null, plain: !!p.plain, empty: !!p.empty, poly: p.poly, x0: Math.round(bb.x0), y0: Math.round(bb.y0), x1: Math.round(bb.x1), y1: Math.round(bb.y1) }; });
    LAST.tiles = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v && { yTop: Math.round(v.yTop), yCtl: Math.round(v.yCtl), wTop: Math.round(v.wTop), angle: +v.angle.toFixed(3) }]));
    if (!same) job.painted = false;
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
        let v = 0.5 - 0.5 * Math.cos(t / 1000 * p.omega + p.phase);        // 0 bright ... 1 dark
        /* THE PANE UNDER SOMETHING WAITING BEATS FASTER. `scanUrgent` and `beatAt` have written
           `urgentUntil` since 1.2.27 and nothing ever read it, so the audit page's "the element
           stands still and its glass answers" drew exactly nothing. The fast rhythm is blended
           in and out over a third of a second, so the pane changes tempo instead of jumping. */
        if (p.urgentUntil) {
          const k = Math.max(0, Math.min(1, (p.urgentUntil - t) / 300));
          if (k > 0) v = v + (0.5 - 0.5 * Math.cos(t / 1000 * (2 * Math.PI / 1.6) + p.phase) - v) * k;
          else p.urgentUntil = 0;
        }
        const dark = (p.content && !p.empty ? 0.42 : p.stained ? 0.62 : 0.72) * Math.pow(v, p.stained ? 2.2 : 1.6);
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
// One MediaQueryList, read live: `loop` asked this every frame and `matchMedia` allocates one per call.
const REDUCED_MQ = matchMedia("(prefers-reduced-motion: reduce)");
const REDUCED = () => document.body.classList.contains("drpg-reduced-motion") || REDUCED_MQ.matches;
/** The pulse is switchable on its own: the glass can stay and stop breathing. */
const pulseOn = () => !document.body.classList.contains("drpg-no-pulse");

function themeOn() { try { return getSetting(SETTINGS.theme) === "stainedGlass"; } catch { return false; } }
/* `effectsOn()` is gone with the setting it read. It gated the pulse, the seam flashes, the
   pane beat and (until 08.09) the state crossfade - which meant one switch could stop the
   theme moving at all, and with it off the curtain was a still picture that nobody could
   explain. Reduced motion still stops everything: that is a preference about motion, not a
   preference about ornament, and it is the system's to make. */

/* the curtain lives in the BODY, never inside #interface: a fixed element inside a zoomed or
   transformed ancestor is sized and clipped in that ancestor's pixels, and on a client that scales
   its interface the glass came out as one jagged column (v1.2.15/16). In the body its box is the
   viewport, the blocks are measured in the same pixels, and its stacking is settled here in code
   rather than left to whichever stylesheet loads last: just under #interface, above the board. */
const STYLE = "position:fixed;inset:0;width:100vw;height:100vh;margin:0;padding:0;border:0;pointer-events:none;overflow:hidden;isolation:isolate;box-sizing:border-box;";
function layerIndex() {
  const iface = document.getElementById("interface");
  const board = document.getElementById("board");
  /* THE ONE ARRANGEMENT A BODY-LEVEL CURTAIN CANNOT BE LAYERED INTO.
     If the board is INSIDE `#interface`, nothing mounted in the body can sit between it and the
     interface's own columns: everything in that subtree shares `#interface`'s index, and an
     earlier sibling at the same index always loses. Foundry does not do this today - the board
     is a LATER SIBLING of `#interface`, put there by `board.replaceWith(canvas)` on the
     `<template id="board">` - but the module is verified against a major whose markup was not
     readable from here, so this says so out loud rather than mis-stacking in silence. */
  if (iface && board && iface !== board && iface.contains(board)) {
    const bz = parseInt(getComputedStyle(board).zIndex, 10);
    log("the board is inside #interface: the curtain cannot be layered from the body");
    return Number.isFinite(bz) ? bz + 1 : 1;
  }
  if (!iface) return 1;
  const cs = getComputedStyle(iface);
  const z = parseInt(cs.zIndex, 10);
  if (cs.position !== "static" && Number.isFinite(z)) return Math.max(0, z);   // same index, earlier in the tree: under it
  /* NOTHING IS PROMOTED HERE, AND THAT IS THE FIX OF 1.2.40.
     Until now this wrote `z-index: 1` onto `#interface`, on the stated grounds that without a
     stacking context of its own the whole UI would go under the glass. THAT WAS WRONG, and it
     was wrong because the harness it was checked against modelled Foundry's DOM incorrectly -
     the board on the wrong side of `#interface`, and none of the interface's columns carrying
     the `z-index: var(--z-index-app)` = 30 that Foundry actually gives them. With the real
     numbers the curtain at 1 is already above the board at 0 and already below the columns at
     30, and removing the promotion changes the rendered page by zero pixels.
     What the promotion DID do was make a full-screen box into a POSITIONED full-screen box
     over the board - a lid, which is what took the map's clicks - and, worse, it is the only
     arrangement in which a board that ever moved inside `#interface` would paint ABOVE the
     glass and make the theme vanish over the map. So it goes. `freeTheBoard()` stays, as a
     repair for a lid somebody ELSE puts there. */
  return 1;
}
function place(el) {
  const iface = document.getElementById("interface");
  const parent = iface?.parentElement ?? document.body;
  if (el.parentElement !== parent) { if (iface) iface.before(el); else parent.append(el); }
}
function mount() {
  let el = document.getElementById("drpg-curtain");
  if (!el) { el = document.createElement("div"); el.id = "drpg-curtain"; el.innerHTML = '<canvas class="sg"></canvas>'; }
  place(el);
  const z = layerIndex();
  el.style.cssText = STYLE + "z-index:" + z + ";" + (el.style.clipPath ? "clip-path:" + el.style.clipPath + ";" : "");
  el.querySelectorAll(":scope > canvas").forEach(c => { c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;"; });
  if (!curtains.length) curtains.push({ el, seed: 44 });
  rebuild();
}
function unmount() {
  for (const j of curtains) { j.el.remove(); document.querySelectorAll(".curtain-glow").forEach(g => g.remove()); }
  curtains.length = 0;
  for (const j of windows) j.el.querySelectorAll(":scope > canvas").forEach(c => c.remove());
  windows.length = 0;
  document.querySelectorAll("#scene-controls, #sidebar").forEach(e => { e.style.marginTop = ""; e.style.paddingTop = ""; e.style.boxSizing = ""; e.style.maxHeight = ""; e.style.overflow = ""; });
  unpinRightColumn();
  restoreLid();
  document.querySelectorAll("#scene-controls, #sidebar-tabs").forEach(e => { e.style.transform = ""; e.style.transformOrigin = ""; });
  BLOCKS.forEach(b => document.querySelectorAll(b.sel).forEach(e => { e.style.transform = ""; e.style.transformOrigin = ""; }));
  document.body.classList.remove("drpg-curtain-on", "drpg-turning");
  document.querySelectorAll(".drpg-curtain-ghost, #drpg-curtain > canvas.morph, #drpg-curtain > canvas.ghost").forEach(g => g.remove());
  if (rotSheet) { rotSheet.remove(); rotSheet = null; }
}
/* ---- nothing on the glass ever jumps ---------------------------------------------------------
   Before the curtain is recut or recoloured, what it looks like now is copied onto one canvas (the
   ghost), placed under the new glass with the old silhouette, and faded out over the turn while the
   new glass fades in. A rebuild that changes nothing (the same panes, the same colour) repaints
   nothing, so the observers' constant rebuilds cost a geometry pass and no paint. */
/* THE TURN, AND IT IS THE ONE THE SHEET STATES. The default is the fallback for a client
   that has no theme sheet loaded yet; `--drpg-t-turn` in stained-glass.css is what actually
   sets it, and it was raised to 1600 ms on 08.09 - a state change is the curtain crossfading
   a whole screen of glass, and at 840 ms it was over before the eye had followed it. */
/* HOW LONG THE CURTAIN TAKES TO TURN, AND IT IS ITS OWN NUMBER.
   `--drpg-t-turn` is the interface's beat, shared with Monokuma Legacy and with the transform
   transition the rails ride on, so slowing the curtain by raising it would slow those too. The
   curtain crossfades a whole screen of glass and wants longer than a button does: it reads
   `--drpg-t-curtain` when the theme states one and falls back to the beat otherwise, which is
   also how reduced motion still stops it dead (motion.css sets the beat to 0). */
const TURN = () => {
    const cs = getComputedStyle(document.body);
    for (const name of ["--drpg-t-curtain", "--drpg-t-turn"]) {
        const v = parseFloat(cs.getPropertyValue(name));
        if (Number.isFinite(v)) return Math.max(0, v);
    }
    return 840;
};
const ECLIPSE = () => { const v = parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-t-eclipse")); return Number.isFinite(v) && v > 0 ? v : 1400; };
const EASE = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpHex = (h1, h2, t) => { const a = hex(h1), b = hex(h2); return "rgb(" + a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",") + ")"; };
/* A polygon as N points along its perimeter, starting at its topmost-leftmost vertex, so two
   polygons of different vertex counts can be interpolated point by point without twisting.
   EVERY VERTEX IS KEPT. The first version dropped N evenly spaced points along the perimeter
   and let the corners fall between them, so a pane on its way was a rounded sixteen-gon - the
   "circles floating over the screen" of 1.2.34. The corners are the points now; the rest are
   spread along the edges by length, so a pane stays a pane at every frame. */
function resample(poly, N) {
  let start = 0;
  for (let i = 1; i < poly.length; i++) if (poly[i][1] < poly[start][1] - 0.5 || (Math.abs(poly[i][1] - poly[start][1]) <= 0.5 && poly[i][0] < poly[start][0])) start = i;
  const pts = poly.map((_, i) => poly[(start + i) % poly.length]);
  const segs = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  const extra = Math.max(0, N - pts.length);
  const want = segs.map(L => extra * L / total);
  const alloc = want.map(Math.floor);
  let rem = extra - alloc.reduce((a, b) => a + b, 0);
  const order = want.map((w, i) => [w - alloc[i], i]).sort((u, v) => v[0] - u[0]);
  for (let k = 0; rem > 0 && k < order.length; k++, rem--) alloc[order[k][1]]++;
  const out = [];
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; out.push(p); for (let k = 1; k <= alloc[i]; k++) out.push([lerp(p[0], q[0], k / (alloc[i] + 1)), lerp(p[1], q[1], k / (alloc[i] + 1))]); });
  return out;
}
const centroid = poly => { const bb = bbox(poly); return [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2]; };
function snapshotPanes(j) {
  if (!j.panes) return null;
  return j.panes.map(p => ({ poly: p.poly, content: p.content, empty: p.empty, tone: p.tone, stained: p.stained, plain: p.plain, kind: p.kind }));
}
/* what the glass looks like right now - fills, texture, the pulse's frame, the seams - on one canvas */
/** A copy of a canvas as it stands, for a layer that is about to be repainted. */
function snapshotCanvas(src) {
  if (!src || !src.width || !src.height) return null;
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  return c;
}
function snapshotLook(j) {
  if (!j.panes || !j.painted) return null;
  const el = j.el, sg = el.querySelector(":scope > canvas.sg");
  if (!sg || !sg.width) return null;
  const c = document.createElement("canvas"); c.width = sg.width; c.height = sg.height;
  const g = c.getContext("2d");
  for (const cls of ["sg", "pulse", "seamline"]) { const l = el.querySelector(":scope > canvas." + cls); if (l && l.width) g.drawImage(l, 0, 0, c.width, c.height); }
  return c;
}
/* THE MORPH: THE GLASS STAYS, THE EDGES TRAVEL.
   The first morph swapped the whole curtain for flat fills for the length of the turn: no
   texture, no pulse, every pane a plain colour, and the panes themselves rounded off on the
   way (see `resample`). It is the other way round now. The new glass is painted at once and
   stays visible - its texture, its pulse - with a copy of the old glass laid over it that
   fades out over the turn, so the fills cross from one look to the other without a plain
   frame in between; and over both, the seams alone are redrawn each frame on their way from
   the old cut to the new one, in lead and in the colour on its way from the old state's to
   the new. The silhouette follows the seams. The static seam layer and the glow are held
   back until the seams have arrived, then shown in their place. */
function morph(j, oldPanes, oldAcc, ghost, glowGhost) {
  /* A STATE CHANGE IS NOT AN "EFFECT", IT IS THE TRANSITION BETWEEN TWO STATES.
     `Glass effects` turns off the blur and the pane pulse - ambient things, running all the
     time, which somebody may reasonably not want. This is neither: it happens once, when the
     world changes, and it is how you SEE that it changed. Gated with the pulse it simply made
     the curtain jump between colours (Dawid, 08.09, with the switch off and no idea that was
     what he had turned off). Reduced motion still stops it: that is an accessibility
     preference about motion itself, not a preference about ornament. */
  if (!oldPanes || !j.panes || REDUCED()) return;
  const el = j.el, W = j.W, H = j.H;
  const newAcc = j.acc || oldAcc || "#ffd38f";
  const recoloured = Boolean(oldAcc && j.acc && oldAcc !== j.acc);
  const pairs = j.panes.map(p => {
    const c = centroid(p.poly);
    let best = null, bd = Infinity;
    for (const o of oldPanes) { if (o.content !== p.content) continue; const oc = centroid(o.poly); const d = Math.hypot(oc[0] - c[0], oc[1] - c[1]) + (o.tone === p.tone ? 0 : 200); if (d < bd) { bd = d; best = o; } }
    if (!best) for (const o of oldPanes) { const oc = centroid(o.poly); const d = Math.hypot(oc[0] - c[0], oc[1] - c[1]); if (d < bd) { bd = d; best = o; } }
    const N = Math.max(24, p.poly.length, best ? best.poly.length : 0);
    const to = resample(p.poly, N);
    let from = resample(best ? best.poly : p.poly.map(() => c), N);
    // align the two rings: start `from` where it lies closest to `to`, so no pane twists on the way
    let bestK = 0, bestD = Infinity;
    for (let k = 0; k < N; k++) { let d = 0; for (let i = 0; i < N; i++) { const f = from[(i + k) % N]; d += (f[0] - to[i][0]) ** 2 + (f[1] - to[i][1]) ** 2; } if (d < bestD) { bestD = d; bestK = k; } }
    from = from.map((_, i) => from[(i + bestK) % N]);
    return { from, to, p };
  });
  /* HOW MUCH ACTUALLY MOVED. Folding the Projects tray recuts a corner of the glass; a corner
     is not worth a turn. The morph runs when the screen changes state (everything recolours)
     or when the shape really did change. */
  const MOVED = 2;
  const moved = pairs.filter(q => q.from.some((pt, i) => Math.hypot(pt[0] - q.to[i][0], pt[1] - q.to[i][1]) > MOVED)).length;
  if (!recoloured && moved < pairs.length * 0.3) return;
  const finalClip = el.style.clipPath;
  const seamLayer = el.querySelector(":scope > canvas.seamline");
  const glow = document.querySelector('[data-glow="' + j.seed + '"]');
  // a morph already running is over: its cleanup must not undo this one's (a second state change
  // inside the turn, a rebuild while the light is still travelling)
  const my = (j.morphId = (j.morphId || 0) + 1);
  el.querySelectorAll(":scope > canvas.morph, :scope > canvas.ghost").forEach(c => c.remove());
  // and any ghost left standing OUTSIDE it by a morph this one is interrupting
  document.querySelectorAll(".drpg-curtain-ghost").forEach(c => c.remove());
  document.querySelectorAll(".drpg-glow-ghost").forEach(c => c.remove());
  const mc = document.createElement("canvas"); mc.className = "morph"; mc.width = W; mc.height = H;
  mc.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:4;";
  let gc = null;
  /* THE OLD CURTAIN FADES AS THE OLD CURTAIN, NOT AS A CUT-OUT OF THE NEW ONE.
     The ghost is a snapshot of the glass as it was, and it used to be appended INSIDE the
     curtain - which carries the clip path this morph is busy animating. So the old picture
     was being re-cut to the new shape while it faded: wherever the two shapes differ, and
     that is mostly at the screen edges, the old glass did not fade at all, it was clipped
     away on the first frame. That is the "przejscie skokowe na krawedziach" (Dawid, 07.09).
     As a SIBLING it keeps its own shape - the shape it was painted with, which is the morph's
     `from` polygons - and simply fades out under the new one. */
  if (ghost) {
    gc = ghost; gc.className = "ghost drpg-curtain-ghost";
    const oldD = pairs.map(q => "M" + q.from.map(v => v[0].toFixed(1) + " " + v[1].toFixed(1)).join("L") + "Z").join("");
    gc.style.cssText = el.style.cssText;
    gc.style.zIndex = String((parseInt(el.style.zIndex, 10) || 1) - 1);
    gc.style.clipPath = "path('" + oldD + "')";
    gc.style.pointerEvents = "none";
    el.after(gc);
  }
  el.append(mc);
  if (seamLayer) seamLayer.style.visibility = "hidden";
  /* THE BLOOM NEVER GOES OUT. The glow was hidden for the length of the turn, so the light along
     every seam vanished and came back - the one thing on screen that says "glass". The new glow
     is painted by `curtainPaint` before this runs, so the OLD one is a snapshot taken beside the
     ghost: they cross over, and the light changes colour without ever leaving. */
  let gg = null;
  if (glow && glowGhost) {
    gg = glowGhost; gg.className = "curtain-glow drpg-glow-ghost";
    gg.style.cssText = glow.style.cssText;
    glow.after(gg);
    glow.style.opacity = "0";
  }
  const g = mc.getContext("2d"), t0 = performance.now(), dur = TURN();
  /* THE SCREEN'S OWN EDGE IS NOT A SEAM.
     `strokeAll` walks every side of every pane, and the panes standing against the screen
     have sides that ARE the screen's edge - so the morph drew a rim of light right around
     the display on every turn of the clock. `seams()` has always skipped those segments;
     this did not, which is the whole of the difference (Dawid, 2026-09-07: "szwy maja
     blyskac, ale nie krawedz ekranu"). Same test, written here because the morph paints on
     its own canvas: a segment with both ends against one border is the outline, not a seam. */
  const border = (p, q) => (p[0] < 1 && q[0] < 1) || (p[0] > W - 1 && q[0] > W - 1)
    || (p[1] < 1 && q[1] < 1) || (p[1] > H - 1 && q[1] > H - 1);
  const strokeAll = (polys, alpha, style, width) => {
    g.globalAlpha = alpha; g.strokeStyle = style; g.lineWidth = width; g.lineCap = "round";
    g.beginPath();
    for (const pl of polys) for (let i = 0; i < pl.length; i++) {
      const a = pl[i], b = pl[(i + 1) % pl.length];
      if (border(a, b)) continue;
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
    }
    g.stroke();
  };
  const step = now => {
    const u = Math.min(1, (now - t0) / dur), e = EASE(u);
    if (!el.isConnected || j.morphId !== my) { done(); return; }
    const polys = pairs.map(q => q.from.map((pt, i) => [lerp(pt[0], q.to[i][0], e), lerp(pt[1], q.to[i][1], e)]));
    el.style.clipPath = "path('" + polys.map(pl => "M" + pl.map(q => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") + "Z").join("") + "')";
    if (gc) gc.style.opacity = String(1 - e);
    if (gg) { gg.style.opacity = String(1 - e); if (glow) glow.style.opacity = String(e); }
    g.clearRect(0, 0, W, H);
    const acc = lerpHex(oldAcc || newAcc, newAcc, e);
    // the seams on their way: a soft light under them (the glow's part), the lead, the bevel, the colour
    g.save(); g.filter = "blur(4px)"; g.globalCompositeOperation = "lighter"; strokeAll(polys, 0.35, acc, 2.2); g.restore();
    strokeAll(polys, 0.95, "#08050d", 1.2);
    g.save(); g.translate(0, 1); strokeAll(polys, 0.22, "#ffffff", 0.5); g.restore();
    strokeAll(polys, 0.92, acc, 0.7);
    g.globalAlpha = 1;
    if (u < 1) { requestAnimationFrame(step); return; }
    el.style.clipPath = finalClip;
    done();
  };
  const done = () => {
    mc.remove(); if (gc) gc.remove(); if (gg) gg.remove();
    if (seamLayer) seamLayer.style.visibility = "";
    if (glow) { glow.style.visibility = ""; glow.style.opacity = ""; }
  };
  requestAnimationFrame(step);
}
function rebuild() {
  try { rebuildAll(); } finally { if (document.body.classList.contains("drpg-measuring")) measuring(false); }
}
function rebuildAll() {
  for (const j of curtains) {
    const wasPainted = j.painted, oldAcc = j.acc;
    const oldPanes = wasPainted ? snapshotPanes(j) : null;
    // the ghost the morph crossfades from; same gate as the morph, or it fades from nothing
    const oldLook = wasPainted && !REDUCED() ? snapshotLook(j) : null;
    const oldGlow = oldLook ? snapshotCanvas(document.querySelector('[data-glow="' + j.seed + '"]')) : null;
    j.sig = null; CHECKS.length = 0;
    if (curtainGeometry(j)) {
      // Foundry's tiles must start below the corner panes to own a shard of the strip;
      // when they do not, push them down once and cut the glass again
      if (!j.placed && placeTiles(j.panes.meta)) { j.placed = true; j.sig = null; curtainGeometry(j); }
      const acc = resolveAcc(j.el);
      const check = CHECKS[CHECKS.length - 1];
      const changed = !wasPainted || !check?.same || acc !== oldAcc;
      if (changed) {
        curtainPaint(j); document.body.classList.add("drpg-curtain-on");
        const gl = document.querySelector('[data-glow="' + j.seed + '"]');
        if (gl) gl.style.cssText = STYLE + "z-index:" + j.el.style.zIndex + ";mix-blend-mode:screen;width:" + j.W + "px;";
        morph(j, oldPanes, oldAcc, oldLook, oldGlow);
      } else { j.painted = true; document.body.classList.add("drpg-curtain-on"); }
    }
  }
  freeTheBoard();
  const c = CHECKS[0];
  if (c && (c.overlaps || c.nonconvex || c.blockFails || c.edgeGaps)) log("curtain self-check", c);
  // what the interface looks like now that the blocks are rotated: the baseline the drift
  // watch compares against, taken after the rotations have been written, never before
  requestAnimationFrame(() => { for (const j of curtains) { j.live = liveSignature(); j.pending = null; } });
}
/* the scene controls and the sidebar tabs start below the corner panes, 24 px under the strip's top.
   The shift is capped: the GM's sidebar is a column of real work, and 160 px is as much of it as the
   glass may take. Padding (with border-box), not margin, so a column sized to the screen shrinks
   instead of running off its bottom. */
const MAX_SHIFT = 160;
/** The tiles shown in a rail: Foundry's `button.ui-control`s (v13+), any earlier markup's `.control`s. */
function tileButtons(rail) {
  return [...rail.querySelectorAll("button.ui-control, .ui-control, .control")].filter(e => e.offsetWidth > 0 && e.offsetHeight > 0);
}
/* NOTHING TO PLACE ONCE THE RAILS ARE BLOCKS.
   This pushed a rail down with `padding-top` until it stood under the shard the side strip
   had cut for it, which is what you have to do when the shard's position is decided without
   reference to the rail. It is decided WITH reference to it now - the rail is a block, the
   partition cuts its pane where the rail is - so the push has nothing left to correct, and
   feeding a measured position back into the thing being measured is how a layout oscillates.
   The padding an older version left on the element is cleared, once. */
function placeTiles(meta) {
  const t = meta?.tiles || {};
  let moved = false;
  const side = document.querySelector("#sidebar");
  if (side && side.style.paddingTop) { side.style.paddingTop = ""; moved = true; }
  const left = document.querySelector("#scene-controls");
  if (left && left.style.paddingTop) { left.style.paddingTop = ""; moved = true; }
  return moved;
  for (const [target, probe, side] of [["#scene-controls", "#scene-controls", "left"], ["#sidebar", "#sidebar-tabs", "right"]]) {
    const el = document.querySelector(target), pr = document.querySelector(probe), info = t[side];
    if (!el || !pr || !info) continue;
    const keep = pr.style.transform; pr.style.transform = "";
    // the first tile's top, not the rail's: the rail already carries whatever padding an earlier pass gave it
    const tops = tileButtons(pr).map(e => e.getBoundingClientRect().top);
    const top = tops.length ? Math.min(...tops) : pr.getBoundingClientRect().top; pr.style.transform = keep;
    const have = parseFloat(el.style.paddingTop) || 0;
    const need = Math.min(MAX_SHIFT - have, Math.round(info.yTop + 24 - top));
    if (need > 2) { el.style.boxSizing = "border-box"; el.style.paddingTop = (have + need) + "px"; moved = true; }
  }
  return moved;
}

/** A one-line account of the curtain for the Look dialog: frame, panes, the self-check, the tiles. */
export function glassReport() {
  const j = curtains[0], c = CHECKS[0];
  if (!j) return themeOn() ? "no curtain mounted" : "theme off";
  const el = j.el, r = el.getBoundingClientRect();
  const parts = [
    "frame " + (LAST.frame ? LAST.frame.W + "x" + LAST.frame.H : "-") + " / viewport " + innerWidth + "x" + innerHeight,
    "box " + Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "x" + Math.round(r.height),
    "z " + el.style.zIndex + " in " + (el.parentElement?.tagName || "-").toLowerCase(),
    "panes " + (j.panes ? j.panes.length : 0) + (j.painted ? " painted" : " unpainted"),
    c ? "check ov" + c.overlaps + " nc" + c.nonconvex + " bf" + c.blockFails + " eg" + c.edgeGaps + " ff" + c.fitFails : "no check",
    "blocks " + LAST.blocks.filter(b => b.measured).map(b => b.cls).join(","),
    "over the map: " + hitStack().centre[0]
  ];
  return parts.join(" · ");
}

/* ---- the glass answers the interface -------------------------------------------
   `beatAt(el)`: the pane under an element runs one fast cycle (a pip just spent). The urgent
   scan marks the panes under anything waiting (a pending call, a due motive, a card that is
   "mine") for as long as it waits; the objection opens with one white snap of every seam. */
function paneAt(x, y) {
  const j = curtains[0]; if (!j?.panes) return null;
  const r = j.el.getBoundingClientRect();
  const px = x - r.left, py = y - r.top;
  // The box first: the polygon walk is the cost, and it runs on every pane every half second.
  return j.panes.find(p => (!p.bb || (px >= p.bb.x0 && px <= p.bb.x1 && py >= p.bb.y0 && py <= p.bb.y1)) && inside(p.poly, px, py)) ?? null;
}
/** One fast beat of the pane under `el` (or under a point), in the state colour. */
export function beatAt(el, ms = 1600) {
  if (!themeOn() || REDUCED()) return;
  const r = el?.getBoundingClientRect?.(); if (!r || (!r.width && !r.height)) return;
  const p = paneAt(r.left + r.width / 2, r.top + r.height / 2);
  if (p) p.urgentUntil = Math.max(p.urgentUntil || 0, performance.now() + ms);
}
const URGENT = ".drpg-event.mine, .drpg-event.due, .drpg-pending-call, .drpg-call-button.drpg-call-pending, #drpg-hud .drpg-hud-time.is-objection";
let urgentAt = 0;
function scanUrgent(t) {
  if (t - urgentAt < 500) return;
  urgentAt = t;
  const now = performance.now();
  for (const el of document.querySelectorAll(URGENT)) {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
    const p = paneAt(r.left + r.width / 2, r.top + r.height / 2);
    if (p) p.urgentUntil = Math.max(p.urgentUntil || 0, now + 700);
  }
}
/* THE CUT IS NOT THE PULSE'S BUSINESS. The objection was found inside `scanUrgent`, and `loop()`
   gates that whole scan behind `pulseOn()` - so on a client that had turned the glass pulse off,
   the loudest moment of a trial did nothing at all, which is one of the ways "it looks broken".
   It is watched here instead, before the gate, and levelled rather than latched so the second
   objection of a trial cuts exactly like the first. */
let objectionOn = false, objectionAt = 0;
function objectionEdge(t) {
  if (t - objectionAt < 250) return;
  objectionAt = t;
  const obj = Boolean(document.querySelector("#drpg-hud .drpg-hud-time.is-objection"));
  if (obj && !objectionOn && !REDUCED()) {
    const ms = ECLIPSE();
    for (const j of curtains) flashSeams(j, "#ffffff", ms, { bloom: true });
    // the open windows answer it a little quicker, so the cut is the screen and not one layer
    for (const j of windows) if (j.el.isConnected) flashSeams(j, "#ffffff", Math.round(ms * 0.72), { bloom: true });
  }
  objectionOn = obj;
}
globalThis.drpgGlassBeat = beatAt;

/* ---- module windows: the stained glass on the title band only --------------- */
function paintBand(job) {
  const w = job.el, c = w.querySelector(":scope > canvas.sg");
  if (!c || w.clientWidth < 10) return;
  const W = c.width = Math.max(60, Math.round(w.clientWidth)), H = c.height = Math.max(24, Math.round(w.clientHeight));
  const panes = windowShapes(W, H, rng(job.seed)), acc = resolveAcc(w);
  const seamCanvas = layerAfter(c, "seamline", W, H);
  /* THE SAME GLASS AS THE CURTAIN. `glowInside` laid a blurred, additive glow along every seam
     of a band, which is a third of what made a window's title read brighter than the curtain
     beside it (the other two are in the sheet: the base sheet's Bone header under the canvas,
     and the window's own ground). One paint, one material. */
  paintGlass(c.getContext("2d"), W, H, panes, acc, { glowInside: false, inset: 0, seamCtx: seamCanvas.getContext("2d") });
  const pc = layerAfter(c, "pulse", W, H); job.pulseK = 1;
  for (const p of panes) { const cx = (p.bb.x0 + p.bb.x1) / 2 - W / 2; p.phase = cx / 140 + p.hsh * 1.4; p.omega = 2 * Math.PI / (9 + p.hsh * 7); }
  job.panes = panes; job.pulse = pc; job.acc = acc; job.W = W; job.H = H;
}
/* a flash of every seam in Bone (or the accent) that fades over `ms`: the glass has just set */
/* The light rises, is held, and goes out slowly. The first version snapped to full white and
   fell away linearly in 90 ms, which reads as a rendering fault rather than as a cut; lengthening
   it alone did not help, because what looked wrong was the shape of it. A gesture has three parts:
   it arrives (a twelfth of the time), it stands (a quarter), and it leaves - the last on a cubic
   ease, so the end approaches nothing instead of arriving at it. `bloom` adds a wide blurred pass
   under the line, which is what makes the glass look lit rather than outlined. */
function flashSeams(job, color, ms, { bloom = false } = {}) {
  if (REDUCED() || !job.panes) return;
  const host = job.el, ref = host.querySelector(":scope > canvas.seamline") ?? host.querySelector(":scope > canvas.sg");
  if (!ref) return;
  const W = ref.width, H = ref.height, k = W / Math.max(1, job.W || host.clientWidth || W);
  /* ITS OWN CANVAS, NOT THE SHARED ONE. `layerAfter` hands back the layer that is already
     there, so two flashes on one job shared a canvas and a single `remove()`: whichever ended
     first took the other's light away with it - a 1400 ms cut ending after 420. */
  const fc = document.createElement("canvas"); fc.className = "flash"; fc.width = W; fc.height = H;
  fc.style.cssText = LAYER; ref.after(fc);
  const g = fc.getContext("2d");
  const t0 = performance.now();
  const RISE = 0.08, HOLD = 0.32;
  const step = t => {
    const u = (t - t0) / ms;
    g.clearRect(0, 0, W, H);
    if (u >= 1 || !fc.isConnected) { fc.remove(); return; }
    const a = u < RISE ? u / RISE : u < HOLD ? 1 : Math.pow(1 - (u - HOLD) / (1 - HOLD), 3);
    g.strokeStyle = color;
    if (bloom) {
      g.save(); g.globalCompositeOperation = "lighter";
      for (const [blur, mul, wdt] of [[12, 0.30, 3.0], [5, 0.42, 1.6]]) { g.filter = "blur(" + blur + "px)"; g.globalAlpha = a * mul; seams(g, job.panes, W / k, H / k, wdt, k); }
      g.restore();
    }
    g.globalAlpha = a; seams(g, job.panes, W / k, H / k, 1.6, k);
    g.globalAlpha = 1;
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
  // module windows (`.drpg-panel`) and the messenger carry the glass on their title band
  if (el.classList?.contains("drpg-panel") || el.classList?.contains("drpg-messenger")) { const h = el.querySelector(".window-header"); if (h) dressBand(h, 155); }
  const sheetHead = el.querySelector(".character-header-sheet");
  if (sheetHead) { sheetHead.classList.add("drpg-glass-band"); dressBand(sheetHead, 999); }
}
/* the state changed (hour, phase, Eclipse): every seam flashes Bone and the glass takes the new colour */
let stateTimer = 0;
let turningTimer = 0;
function turning() {
  // every colour the interface takes from the state slides over the turn (stained-glass.css)
  document.body.classList.add("drpg-turning");
  clearTimeout(turningTimer); turningTimer = setTimeout(() => document.body.classList.remove("drpg-turning"), TURN() + 120);
}
function onStateChange() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    let moved = false;
    for (const j of curtains) { if (!j.panes) continue; const acc = resolveAcc(j.el); if (acc === j.acc) continue; moved = true; flashSeams(j, "#f2eee6", 420); }
    if (moved) { turning(); rebuild(); }
    for (const j of windows) { if (!j.el.isConnected) continue; const acc = resolveAcc(j.el); if (acc === j.acc) continue; turning(); flashSeams(j, "#f2eee6", 420); }
    // a band's colour is inherited through the fading token (stained-glass.css @property), so it is
    // read and painted once the fade has ended; the flash above covers the seams in between
    setTimeout(() => { for (const j of windows) { if (!j.el.isConnected) continue; const acc = resolveAcc(j.el); if (acc !== j.acc) paintBand(j); } }, TURN() + 80);
  }, 60);
}
function pruneWindows() { for (let i = windows.length - 1; i >= 0; i--) if (!windows[i].el.isConnected) windows.splice(i, 1); }

const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { if (themeOn()) rebuild(); }, 150); };
let resizeWatched = false;
function observe() {
  observers.forEach(o => o.disconnect()); observers = [];
  // Once. `observe()` runs on every mount, and a listener added per mount outlived the
  // observers it came with - every Legacy -> Glass switch left one more behind.
  if (!resizeWatched) { resizeWatched = true; addEventListener("resize", schedule); }
  const mo = new MutationObserver(schedule);
  for (const sel of ["#ui-left-column-1", "#ui-top", "#ui-right-column-1", "#ui-bottom", "#interface"]) {
    const h = document.querySelector(sel); if (h) mo.observe(h, { childList: true });
  }
  observers.push(mo);
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(schedule);
    BLOCKS.forEach(b => document.querySelectorAll(b.sel).forEach(e => ro.observe(e)));
    observers.push(ro);
    /* A RAIL CHANGING SIZE DOES NOT RECUT THE GLASS - that is the whole point of cutting it
       to capacity - but it does move the tiles inside their band, and the GM button rides on
       them. Re-applying the rotation rules is a few string writes and no geometry at all. */
    const rr = new ResizeObserver(() => { try { applyRotations(); } catch { /* between rebuilds */ } });
    for (const sel of ["#scene-controls", "#sidebar-tabs"]) {
      const e = document.querySelector(sel); if (e) rr.observe(e);
    }
    observers.push(rr);
  }
}
/* WHAT THE GLASS IS CUT FOR, AS IT STANDS NOW.
   The rectangles of every block and the wall, rounded, in the pixels they are drawn in (so
   with the rotation on - this is compared against itself, never against the cut). Sampled
   twice a second: an interface that has moved without telling anybody is the one case the
   observers above cannot catch, and it costs a handful of rectangles. */
/* THE GLASS IS CUT FOR A LAYOUT, NOT FOR A PIXEL. The watch used to compare rounded rectangles
   as strings, so a counter ticking from "9 min in" to "10 min in", a roll card widening the
   status strip by a pixel, a card sliding into the notice stack - each was a recut and a morph
   in the middle of play. A block has to move or grow by more than DRIFT px, twice in a row,
   before the curtain is cut again; the fixed tiles are not measured at all. */
const DRIFT = 4;
function liveSignature() {
  const out = [];
  for (const b of BLOCKS) { if (b.fixed) continue; for (const e of document.querySelectorAll(b.sel)) {
    const r = e.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    out.push(b.cls, r.left, r.top, r.width, r.height);
  } }
  out.push("vp", innerWidth, innerHeight);
  return out;
}
const drifted = (a, b) => {
  if (!a || !b || a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) { if (typeof a[i] === "string" ? a[i] !== b[i] : Math.abs(a[i] - b[i]) > DRIFT) return true; }
  return false;
};
let driftAt = 0;
function watchDrift(t) {
  if (t - driftAt < 500) return;
  driftAt = t;
  const j = curtains[0];
  if (!j || !j.painted) return;
  const now = liveSignature();
  if (j.live === undefined) { j.live = now; return; }
  if (!drifted(now, j.live)) { j.pending = null; return; }
  /* Twice in a row before a recut: a sidebar in the middle of its transition changes on
     every sample, and cutting the glass for a half-collapsed panel is the fault this watch
     exists to fix. A settled new layout reads the same twice, half a second apart. */
  if (!j.pending || drifted(now, j.pending)) { j.pending = now; return; }
  j.live = now; j.pending = null; schedule();
}
function loop(t) {
  raf = requestAnimationFrame(loop);
  if (!curtains.length || document.hidden) return;
  watchDrift(t);
  objectionEdge(t);
  if (REDUCED() || !pulseOn()) return;
  if (t - last < 66) return;
  last = t; scanUrgent(t); pulseFrame(t);
}

/** Mount or unmount the curtain according to the theme setting. */
export function refreshGlass() {
  if (!themeOn()) { unmount(); return; }
  if (curtains.length) { rebuild(); return; }
  const go = () => { mount(); observe(); };
  (document.fonts?.ready ?? Promise.resolve()).then(go, go);
}

/** Called once at ready. */
export function registerGlass() {
  refreshGlass();
  if (!raf) raf = requestAnimationFrame(loop);
  // late blocks: the launchers and the tray arrive after ready on some clients; and a watchdog,
  // because a curtain that measured nothing (a hidden canvas, a frame of 0) must try again
  setTimeout(() => { if (themeOn()) rebuild(); }, 1500);
  for (const ms of [4000, 9000]) setTimeout(() => {
    const j = curtains[0];
    if (!themeOn()) return;
    if (!j || !j.painted || Math.abs(j.el.getBoundingClientRect().width - innerWidth) > 2) { log("curtain watchdog: rebuilding", glassReport()); if (j) j.placed = false; mount(); }
  }, ms);
  Hooks.on("canvasReady", schedule);
  // the sidebar is deliberately NOT a signal: opening it moves nothing and recuts nothing
  // Debounced like everything else on resize: `rebuild` already pins the right column and
  // frees the board, and the raw handler did both on every event of a window drag.
  addEventListener("resize", () => { if (themeOn()) schedule(); });
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
