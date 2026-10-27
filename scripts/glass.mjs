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

import { SETTINGS, getSetting, shortScreen, BREAKPOINTS } from "./settings.mjs";
import { narrowLayout, COLUMN_SEL } from "./narrow.mjs";
import { log, AV_LIFT_EVENT } from "./utils.mjs";
import { inFoundryWindow } from "./foundry-windows.mjs";
// E88 C0: the counters `fps()` and scenario 86 read (perf-counters.mjs); an increment each, nothing timed.
import { count } from "./perf-counters.mjs";

/** Self-check results of the last geometry pass, for diagnostics. */
export const CHECKS = [];
/** What the last pass measured: the frame and every block. `drpgGlassDebug()` in the console prints it. */
export const LAST = { frame: null, blocks: [] };

/* THE CORNER'S BUTTONS, ONE LIST FOR THE PANE AND FOR THE RAIL'S CLEARANCE (E81 C12). The
   module's three, and anything that marks itself `data-drpg-cluster`: the owner's AM-17 of
   11.10 puts the GM's and Foundry tools' buttons on the same piece of glass (E77), and a
   button that is in the pane but not moved off the tab rail - or the other way round - is
   the fault `clearLaunchers` exists to prevent. An attribute rather than a `drpg-` class,
   because pixel-icons.css repaints the Font Awesome glyph of any `[class*="drpg-"] i.fa-*`,
   and Foundry's own tools button would match those rules (read in the sheet, not tried).
   Exported for audit/glass-harness.html's `drpgLaunchOutside` (E81 C14), which counts the corners
   of exactly these buttons and, since E81 fix r2-H3, compares their box with the `launch` block
   the cut was made for, to say when the cut is stale. */
export const LAUNCHERS = "#drpg-messenger-launcher, #drpg-sound-launcher, #drpg-book-launcher, [data-drpg-cluster]";

/* ---- the blocks: the module's own elements, measured untransformed ------- */
const BLOCKS = [
  { cls: "hud", sel: "#drpg-hud", fallback: (W, H) => ({ x: 16, y: 22, w: 312, h: 150 }) },
  /* THE TILES' ROW IS MEASURED (E77 C8, 13.10.2026). It exists only on a stacked screen (narrow.mjs
     `tileRow`), as a row of the stack at a height the stylesheet states, 44 px, so what the room says
     cannot move it and measuring it costs no recut the fixed room block was made to avoid. No row - a
     desk, or a trial's or a GM's empty tile, which hides it - no pane. */
  { cls: "tiles-row", sel: "#drpg-tile-row", fallback: null },
  /* THE GM BUTTON IS IN THE CORNER (E77 C6, 13.10.2026). From 07.09 it rode the scene rail's
     shard at the top of the left column; it is a member of `launch` now, through
     `data-drpg-cluster`, over the settings button in the AM-21 grid, and turns with the cluster. */
  /* The fallback is the box to cut when the rail cannot be measured at all. 412x90 was smaller
     than the rail has ever been - measured 454x102 at 100% and 540x109 at 140% - and it did not
     scale, so on a large interface it cut a pane the rail stood outside of. Sized from the
     measurement and scaled like the note block, since that is the only honest guess available. */
  { cls: "rail", sel: "#drpg-despair", fallback: (W, H) => { const s = uiScale(); return { x: Math.round(W / 2 - 240 * s), y: 22, w: 480 * s, h: 104 * s }; } },
  { cls: "event", sel: "#drpg-events", fallback: null },
  { cls: "three", sel: "#drpg-player-status", fallback: (W, H) => ({ x: W - 64 - 360, y: 22, w: 360, h: 78 }) },
  { cls: "tray", sel: "#ui-right-column-1 > #countdowns, #countdowns", fallback: (W, H, r) => ({ x: W - 64 - 360, y: (r.three ? r.three.y + r.three.h : 100) + 10, w: 360, h: 62 }) },
  /* THE NOTICE TILE IS NOT MEASURED. Its cards are not what sizes it: two short cards or one
     long one fit it, the stack is clipped to it (stained-glass.css, popup.mjs), and a card
     arriving or leaving never recuts the glass. Its HEIGHT and its FOOT are fitted once a pass
     to the room the scene rail leaves above Foundry's gauge (`fitNoteTile`, 21.09); the width is
     `--drpg-note-w`, scaled with the screen. */
  { cls: "note-block", sel: "#drpg-popups", fixed: true, fallback: (W, H) => { const s = uiScale(), t = noteTile(); return { x: 16, y: H - noteFoot(s) - t.h * s, w: t.w * s, h: t.h * s }; } },
  /* THE ROOM TILE IS NOT MEASURED EITHER (E77 C4, 13.10.2026; the A8 design's step 6). Its box is
     `placeRoomTile`'s, chosen once a pass from the room the clock's column leaves and from no word
     or picture of the room, so a new description, a new picture, a new room or the description
     opened never recut the glass. It takes its band by its midpoint as every block does: at the
     sweep's 15 desk sizes (audit/glass-sweep.mjs, 13.10.2026, both roles) that is the top band
     under the clock and the bottom one beside the notices, every time, and the sweep's
     `drpgRoomCheck` fails a size where it is not. It is `solid`: a fixed
     block with something on it is painted as glass, not as the empty tile's stripes. No place
     (no tile, or a stacked screen, where the tile is in `tiles-row` above), no box, no pane. */
  { cls: "room-block", sel: "#drpg-room-tile", fixed: true, solid: true, fallback: () => ROOM.box },
  /* THE VOICE TILE IS NOT MEASURED EITHER (E78 C6, 14.10.2026; the A9 design's step 4). Its box is
     `voicePlacement`'s, from the tray's capacity and the notice tile's width, and `buildColumn`
     settles it against the tray's column, whose tail it is whatever band its midpoint falls in.
     No tile, a stacked screen or Monokuma Legacy: no box, no pane. */
  { cls: "voice-block", sel: "#drpg-voice-tile", fixed: true, solid: true, fallback: (W, H, r) => voicePlacement(W, H, r.tray) },
  { cls: "launch", sel: LAUNCHERS, union: true, fallback: (W, H) => ({ x: W - 22 - 114, y: H - 22 - 134, w: 114, h: 134 }) },
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

/* THE NOTICE TILE'S SIZE, FROM THE STYLESHEET RATHER THAN FROM HERE.
   ---------------------------------------------------------------------------
   The same constant is needed twice in this file - the pane the tile gets, and
   the clearance the scene rail is bounded to, which is a fraction of the tile's
   WIDTH - and twice more in stained-glass.css, where the stack's own box and
   the per-card height cap are written. Four copies of one number is the shape
   BREAKPOINTS was moved out of settings.mjs to avoid, and it has the same
   failure: the tile grows, one copy is missed, and cards are drawn off their
   own glass with every self-check still reporting clean.

   So the stylesheet owns it (`--drpg-note-w` / `--drpg-note-h`) and this reads
   it, the same way `uiScale` reads the scale. The fallback is the older
   size: a client whose stylesheet has not loaded yet gets the geometry the
   module shipped with rather than a tile of NaN. */
const noteTile = () => {
  const cs = getComputedStyle(document.body);
  const read = (k, whenMissing) => {
    const v = parseFloat(cs.getPropertyValue(k));
    return Number.isFinite(v) && v > 0 ? v : whenMissing;
  };
  /* The fitted height first (`fitNoteTile` writes it on the body), the stylesheet's own second:
     a pass that could not measure the rail - the glass harness, a player with no scene
     controls on screen - keeps the tile the sheet states. */
  return { w: read("--drpg-note-w", 330), h: read("--drpg-note-fit", 0) || read("--drpg-note-h", 160) };
};
/* WHERE THE TILE'S FOOT STANDS, in screen pixels. The same body-level variable the stylesheet
   places `#drpg-popups` with, so the pane and the stack cannot stand at two heights; 100 px on
   the geometry scale over the camera dock's lift when nothing has been fitted, which is where it
   stood until 21.09. */
const noteFoot = s => {
  const v = parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-note-foot"));
  return Number.isFinite(v) && v > 0 ? v : avLift() + 100 * s;
};
/* THE CAMERA DOCK RAISES THE FLOOR (E19 fix r1-G2, 19.10.2026; the review's E19-COR-7). camera-view.mjs
   measures the dock under the corner and writes `--drpg-av-lift` on the body (0 while the voice tile hides
   the dock: danganronpa.css computes it 0 under `drpg-dock-hidden`). The corner's buttons and the stacked
   screen add it; the notice tile's foot did not, so on a Stained Glass desk with Foundry's dock shown the
   tile and its pane stood 100 to 130 px inside a 200 px dock, over the cameras, against the handbook's
   promise. Read as the stylesheet computes it, so a hidden dock lifts nothing here either. */
const avLift = () => {
  const v = parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-av-lift"));
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/* THE NOTICE TILE TAKES WHAT THE SCENE RAIL LEAVES (Dawid, 21.09: "karta powiadomienia moze
   byc jeszcze wieksza (w dol). Witraz i powiadomienie nachodza na czerwone foundry").
   ---------------------------------------------------------------------------------------
   The tile was a constant, 220 on the geometry scale, standing 100 above the floor - and
   "220 is the ceiling" was measured against a rail that ENDED LOW. Measured in Foundry on
   21.09 at 1920x1080: eight scene layers ran to y 848, the tile's box began at 840 and its
   pane - leaned, so its top is a fifth of the tile's width above the box - at 781. The last
   two layers stood on the notice glass, and the card was drawn over them. Below the card
   there was glass with nothing on it but Foundry's gauge.

   Two causes, both fixed here or beside it. The left column is `space-between`, so the
   height the bound took off the rail went into the gap ABOVE the GM button and pushed the
   whole rail 150 px down onto the tile (stained-glass.css now packs the column from the top).
   And the tile could not move: a constant cannot be both tall on a tall screen and clear of
   the rail on a short one. So it is fitted: its foot sits on Foundry's gauge (`#players`,
   latency and FPS, the only thing below it), and its top is as high as the rail's run, the
   band's skirt under it and the pane's own lean allow. Between NOTE_MIN and NOTE_MAX on the
   geometry scale. The floor is the constant it replaces, and on purpose: a first cut with a
   floor of 160 handed 1600x900 a card SMALLER than before, 112 px with its sentence cut off,
   which is the complaint itself. So no screen gets less than it had; a screen too short for
   the rail and 220 of tile keeps the overlap it had, and less of it (1600x900: the notice
   pane over the last 58 px of the rail, from 137). Above the ceiling the tile would stop
   being a corner. */
export const NOTE_MIN = 220;
const NOTE_MAX = 360;
/* THE TOOLS TAKE THEIR RUN FIRST, IN AS FEW COLUMNS AS THE TILE CAN SPARE (22.09).
   `railEnds` is where the rail would end with its longest tools menu in one column, in two,
   and so on, and last where its layers end. The first of them that still leaves the notice
   tile its floor is the one taken. Fitting the tile under the layers alone gave a player's
   three layers a 131 px box at 1600x950, Drawings' eight tools wrapped into three columns
   in it, and the strip reserved four columns of glass beside two tiles ("za szeroka",
   Dawid). The tile gives up what a narrower strip is worth only while it keeps its floor;
   past that, the tools wrap as they did. */
function gaugeFoot(H, s) {
  const gauge = document.querySelector("#players");
  const g = gauge && gauge.offsetWidth > 0 && gauge.offsetHeight > 0 ? gauge.getBoundingClientRect() : null;
  /* The gauge only counts where it stands on the floor. In the glass harness it follows the
     rail down the column instead, and a foot read off that would put the tile mid-screen.
     The floor is the dock's top while a dock is shown (`avLift`): a gauge the dock lifted
     still counts, and the foot never stands lower than 8 px over the dock. */
  const lift = avLift();
  return g && g.bottom > H - lift - 80 ? Math.round(Math.max(H - g.top + 8, lift + 8)) : Math.round(lift + 100 * s);
}
function fitNoteTile(H, railEnds, s) {
  const body = document.body;
  const foot = gaugeFoot(H, s);
  const tile = noteTile();
  const lean = Math.round(tile.w * s * 0.22);
  const roomUnder = end => (H - foot) - (end + 34 + 8 + lean);
  const ends = [].concat(railEnds);
  const railEnd = ends.find(end => roomUnder(end) / s >= NOTE_MIN) ?? ends.at(-1);
  const room = roomUnder(railEnd);
  const h = Math.round(Math.min(NOTE_MAX, Math.max(NOTE_MIN, room / s)));
  body.style.setProperty("--drpg-note-foot", foot + "px");
  body.style.setProperty("--drpg-note-fit", h + "px");
  return { foot, h, lean, railEnd };
}
/* ---- the room tile's place (E77 C4, 13.10.2026; the A8 design's step 6, the owner's Q0, Q3, Q13) ----
   Two places, chosen once a pass by the measured free height F and never by what the room says:
   'clock' - a section of the clock's column, the clock's width and left edge, turning about the
   same corner - when F leaves the smallest box; 'notes' - a column of its own in the bottom row,
   right of the notice tile, its foot level with the tile's - when it does not. Every input is
   read off something the tile does not move (the clock, Foundry's gauge, the notice tile's
   width, the scene rail's own run), so the place a pass chooses is the place the next one
   chooses, and the box comes from F, the width and the type scale - never from the content.

   F IS THE DESIGN'S, LESS THE SCENE RAIL. The design measured F with the rail gone from the
   column (E77 C5 takes it out): F = the lowest the column may end over the notice tile's floor
   (`NOTE_MIN`, the lean of its pane and the rail's skirt, `fitNoteTile`'s `roomUnder`) less the
   clock's bottom. Where a rail still stands in the column under the clock (a GM whose windows
   were not built), its run and the slot over it (`RAIL_SLOT`) come off F as well: a tile that
   took that room would push the rail onto the notice tile's glass. With none (E77 C5) only the
   column's drop at the wall comes off it, on a GM's screen as on a player's since the GM button
   left the column (E77 C6). The design's readings were P8: F 491 at 1920x1080, 733 at 2560x1440,
   195 at 1366x768; this file's, in Chromium on audit/glass-harness.html on 13.10.2026, were a
   player's 485, 708 and 194 and, while the button still stood in the column (C5), a GM's 427,
   657 and 136. audit/glass-sweep.mjs prints them at every size.

   The smallest box and the tallest are the design's formula in the type scale's units (the
   theme's floor of 21 px, a line of 1.3 of it, a heading of the name's 1.9 of it plus the tile's
   own 18 px of padding): `need` = width / 3 + heading + 4 lines (the description's three and the
   toggle's), `maxH` = width x 9 / 16 + heading + 7 lines. This is the one copy of it: the sheets
   read `--drpg-room-h` and state no height of their own (R509). */
const ROOM = { place: null, box: null };
const ROOM_TAN = Math.tan(8 * Math.PI / 180);
const ROOM_VARS = ["--drpg-room-h", "--drpg-room-w", "--drpg-room-x", "--drpg-room-y", "--drpg-room-min-h", "--drpg-room-max-h"];
function roomSizes(w) {
  const t = parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-sg-scale")) || 1;
  const line = 21 * t * 1.3, head = 21 * t * 1.9 + 18;
  return { need: Math.round(w / 3 + head + 4 * line), maxH: Math.round(w * 9 / 16 + head + 7 * line), low: Math.round(head + 3 * line) };
}
/* THE CAP BESIDE THE NOTICES AND UNDER MONOKUMA LEGACY (E78 C0, 13.10.2026; the owner's decision of
   13.10: the tile is too large under Legacy, "430x491 at 1920x1080 and at 1366x768", and under
   Stained Glass where it stands beside the notice tile, "about 325x456" at 1366x768 - the sweep read
   301x376 there; under Stained Glass's clock it stays as it is, "pod zegarem jest super"). Those two
   places take a height of at most 364/1080 of the screen's, never less than the box's own `need`.
   364/1080 is the accepted tile itself: its box under Stained Glass's clock at 1920x1080 was 265x364
   in Chromium (audit/glass-sweep.mjs on 1.2.76's tree, 13.10.2026). The 'clock' place under Stained
   Glass never calls this, and the sweep's PIN_BOX holds its boxes at 1.2.76's readings. Read on C0's
   tree the same day: Legacy 430x491 became 430x364 at 1920x1080 and 430x310 (the floor) at 1366x768,
   3840x2160 kept 430x491 (maxH is below the cap); beside the notices 301x376 became 301x259 at
   1366x768 and 301x352 became 301x245 (the floor) at 1280x720. The width is unchanged. Beside the notices
   that was not what the eye read, and E78 fix h76-HF4 halves it: `roomNotesH` below. */
const ROOM_CAP = 364 / 1080;
export function roomCapH(H, need) {
  return Math.max(need, Math.round(H * ROOM_CAP));
}
/* BESIDE THE NOTICES, HALF OF WHAT C0 LEFT THE EYE (E78 fix h76-HF4, 14.10.2026; the owner on C0's shot
   at 1366x768, 13.10: "ok 2x za duzy", read as "polowa wysokosci" - the same width, half the height).
   C0 shrank the box (301x376 to 301x259) and not what the eye reads: the curtain ran the tile's pane
   from PAD_FAR over the box down to the screen's edge, so the pane stood h + the gauge's foot +
   PAD_FAR tall - 339 at 1224x768 and 1300x768, 350 at 1280x800, 325 at 1280x720 (upright), 370
   at 1366x768 and 356 at 1366x657 (where it leaned 6 degrees; its bounds, Chromium, the glass
   harness, 14.10.2026). HF4 ended the pane PAD_FAR under a box half that run tall and put a plain
   pane under it.
   THE PICTURE RUNS PAST THE SCREEN'S EDGE AGAIN (E78 fix r2-H3, 14.10.2026; the owner on HF4's shot at
   1366x768, in Polish: "zdjecie mialo byc przeciagniete za krawedz ekranu" - the picture was to run past
   the screen's edge). The pane runs to the foot as every column of the bottom band does, and what stays
   half of C0's run is the pane above the screen's edge: the box stands `lift` over the edge, PAD_FAR and
   half its width x tan 8 - so its lower corner keeps PAD_FAR clear of the edge at the steepest lean a
   column takes - and its top is half C0's upright run under the screen's edge, less the pad over it. So
   the box leaves the notice tile's foot (`gaugeFoot`, the line Foundry's gauge stands on, in the left
   column): the room tile stands right of that column. Never under `low`, the laid-out content's own
   floor (`roomSizes`): the name's row with the pips beside it, the project line and two lines of the open
   description. Read in Chromium on the glass harness the same day: audit/glass-sweep.mjs PIN_BOX and
   PIN_PANE. Where Foundry's gauge stands at a table is read in the code (stained-glass.css, the left
   column), not measured there. */
export function roomNotesH(h0, foot, low, lift) {
  return Math.round(Math.max(low, (h0 + foot + PAD_FAR) / 2 - PAD_FAR - lift));
}
/** How far the box beside the notices stands over the screen's edge (`roomNotesH`). */
export function roomNotesLift(w) {
  return PAD_FAR + Math.round(w / 2 * ROOM_TAN);
}
/* What the scene rail takes out of the clock's column under the tile: the slot over its first
   tile and its layers' run, read off the layer buttons themselves (their run does not depend on
   where the rail stands, so this is the same number whichever place the last pass chose). */
function railRun() {
  const menu = columnRail("#scene-controls")?.querySelector(":scope > menu");
  const own = menu ? [...menu.querySelectorAll("button.ui-control")].filter(e => e.offsetWidth > 0 && e.offsetHeight > 0) : [];
  /* NO RAIL IN THE COLUMN (E77 C5): a player's is hidden and a GM's stands in the Map tools window,
     and since E77 C6 the GM button stands in the corner, so the column under the clock holds nothing. */
  if (!own.length) return 0;
  const rs = own.map(e => e.getBoundingClientRect());
  const run = Math.max(...rs.map(r => r.bottom)) - Math.min(...rs.map(r => r.top));
  return Math.ceil(RAIL_SLOT + run);
}
/* A RAIL OF FOUNDRY'S IS READ ONLY WHILE IT STANDS IN FOUNDRY'S COLUMNS (E77 C5, 13.10.2026).
   On a GM's screen `#scene-controls` and `#sidebar` stand in the module's two windows
   (foundry-windows.mjs), which float over the curtain and are cut for by nothing: a rail read
   there would be measured, pushed, bounded and turned where it no longer is, and an opened window
   would recut the glass. On a player's screen both are hidden, and an element with no box was
   already no rail to every reader here. Null for both, so every reader takes its no-rail road. */
function columnRail(sel, root = document) {
  const el = root.querySelector(sel);
  return el && !inFoundryWindow(el) ? el : null;
}
/** The room tile's place and box for a W x H screen, from the measured F and the role (a GM's rail and button). */
export function roomPlacement(W, H) {
  if (!document.body.classList.contains("drpg-theme-stained-glass")) return flatPlacement(W, H);
  const s = uiScale(), foot = gaugeFoot(H, s), noteW = noteTile().w * s;
  const clock = ["#drpg-hud", "#drpg-hud + #drpg-floors"].map(q => document.querySelector(q))
    .filter(e => e && e.offsetWidth > 0 && e.offsetHeight > 0).map(e => e.getBoundingClientRect());
  const hud = clock[0] ?? null;
  const maxEnd = H - foot - NOTE_MIN * s - 42 - Math.round(noteW * 0.22);
  /* AND WITH NO RAIL, THE COLUMN'S OWN DROP AT THE WALL (E77 C5, 13.10.2026; the design's "z
     pochyleniem kolumny przy scianie"). The clock's column turns about its top right corner by up
     to 8 degrees (`buildColumn`), so its pane meets the wall lower than its box ends - by up to the
     column's right edge x tan 8. A rail's run and slot used to stand in that stretch; with none,
     the tile took it. Chromium, audit/glass-harness.html, a player at 1600x900 without this: F 366,
     the tile's box ended at 564 and its pane met the wall at 619, the notice tile's pane began at
     620 and the tile was pressed to its floor (`--drpg-note-fit` 220, which `fitNoteTile` reaches
     only by clamping). With it: F 326, the panes at 579 and 616, the fit 226. The larger of the
     two is reserved; `drpgFoundryCut` fails a tile under the clock that leaves the floor alone. */
  const drop = hud ? Math.ceil(Math.max(...clock.map(r => r.right)) * ROOM_TAN) : 0;
  const F = hud ? Math.round(maxEnd - Math.max(...clock.map(r => r.bottom)) - Math.max(railRun(), drop)) : null;
  if (hud) {
    const { need, maxH } = roomSizes(hud.width);
    if (F - 24 >= need) return { place: "clock", F, need, maxH, x: Math.round(hud.left), w: Math.round(hud.width), h: Math.round(Math.min(F - 24, maxH)) };
  }
  const w = Math.round(noteW), { need, maxH, low } = roomSizes(w);
  const h0 = Math.round(Math.min(maxH, H / 2 - 8, H - foot - 22, roomCapH(H, need))), lift = roomNotesLift(w), h = roomNotesH(h0, foot, low, lift);
  return { place: "notes", F, need: hud ? roomSizes(hud.width).need : need, maxH, h0, x: Math.round(16 + noteW + 32 + h0 * ROOM_TAN), y: Math.round(H - lift - h), w, h };
}
/* UNDER MONOKUMA LEGACY THE SAME TWO PLACES, WITH NO CURTAIN (E77 fix r1-M1, 13.10.2026; review round
   1's cor F6 and goal row G8; the A8 design's P16-0). Until this the tile stood under the clock at the
   base sheet's 250 px under this theme, because `--drpg-room-h` was written only by a pass of the
   curtain, and no curtain is mounted here. The design's rule for this theme: under the clock, the
   clock's width, as tall as under Stained Glass (`maxH`) and no lower than `#players` less 16 px; when
   the smallest box does not fit there, right of the notice stack, which this theme stands at the top
   in the middle (danganronpa.css `#drpg-popups`, popup.mjs `positionBelowWidgets`).
   F is the height from where the tile's top stands - the last of the clock's column (the clock, or
   the floor switcher after it), its bottom margin and the column's gap, none of them the tile's - to
   `#players`' top less 16, read through `gaugeFoot` (whose foot is `#players`' top less 8, or 100 px
   on the geometry scale where the gauge does not stand on the floor, as in the glass harness).
   Beside the notices: 16 px right of the stack, level with its top, the clock's width or what is left
   to the screen's edge, and down to the same floor; the design names the place and not its width or
   gap, so the width is the panel's own and the gap the 16 px this theme keeps at the screen's sides.
   With no stack drawn yet (popup.mjs draws it at `ready`, on every desk) the tile keeps the clock's
   place at the smallest box. Readings in Chromium, audit/glass-harness.html `?theme=legacy`,
   13.10.2026, before this: the tile 430x250 at y 153 at 1920x1080, 1366x768 and 1280x720 alike;
   audit/glass-sweep.mjs prints the place and box at every size since. Since E78 C0 both places stop at
   `roomCapH` (above): the owner found the tile too large under this theme. */
function flatPlacement(W, H) {
  /* `#players` IS READ WITH THE TILE OUT OF THE FLOW. Where the gauge does not stand on the floor it
     follows the column - the tile in it - and a gauge read with the tile laid out made F the tile's
     own: in the glass harness at 1366x768 the tile 491 high pushed `#players` onto the floor, the
     foot read off it gave F 495, and F stayed 495 at 1280x720 and with the clock 574 px taller
     (13.10.2026, audit/glass-sweep.mjs, the pin's control). Hidden for the one reading, in the same
     task, so nothing is painted without it. */
  const s = uiScale(), tile = document.getElementById("drpg-room-tile"), display = tile?.style.getPropertyValue("display") ?? "";
  tile?.style.setProperty("display", "none", "important");
  const foot = gaugeFoot(H, s);
  if (tile) { tile.style.removeProperty("display"); if (display) tile.style.setProperty("display", display); }
  const els = ["#drpg-hud", "#drpg-hud + #drpg-floors"].map(q => document.querySelector(q)).filter(e => e && e.offsetWidth > 0 && e.offsetHeight > 0);
  if (!els.length) return null;
  const hud = els[0].getBoundingClientRect(), last = els.at(-1), px = (e, k) => parseFloat(getComputedStyle(e)[k]) || 0;
  const top = Math.max(...els.map(e => e.getBoundingClientRect().bottom)) + px(last, "marginBottom") + (last.parentElement ? px(last.parentElement, "rowGap") : 0);
  const F = Math.round(H - foot - 8 - top);
  const { need, maxH } = roomSizes(hud.width);
  const stack = document.getElementById("drpg-popups"), sb = stack?.offsetWidth > 0 ? stack.getBoundingClientRect() : null;
  /* BESIDE THE NOTICES, NOT OVER FOUNDRY'S RIGHT COLUMN (E77 fix r2-H3, 13.10.2026). The width was the
     clock's or what was left to the screen's edge, and the status strip and the Projects tray stand
     between the two: in the glass harness with the clock made taller until F fell short (Chromium,
     13.10.2026, a GM and a player alike) the tile stood 1192 to 1622 over `#ui-right-column-1` from
     1457 at 1920x1080, and 915 to 1345 over it from 903 at 1366x768; at 2560x1440 it ended 155 px
     short of it. So the free width ends 16 px before the left of what Foundry's right column draws
     (its status column, and the sidebar where a GM's switch leaves it there), as it ends 16 px
     before the screen's edge. Where nothing is left there (1366x768 above), the tile keeps the
     clock's place at the smallest box, as it does with no stack drawn. */
  const right = ["#ui-right-column-1", "#sidebar"].map(q => document.querySelector(q))
    .filter(e => e && e.offsetWidth > 0 && e.offsetHeight > 0 && !inFoundryWindow(e)).map(e => e.getBoundingClientRect().left);
  const x = sb ? Math.round(sb.right + 16) : 0, free = Math.round(Math.min(W, ...right) - 16 - x);
  if (F >= need || !sb || free < 1) return { place: "clock", flat: true, F, need, maxH, free: sb ? free : null, x: Math.round(hud.left), w: Math.round(hud.width), h: Math.round(F >= need ? Math.min(F, maxH, roomCapH(H, need)) : need) };
  const y = Math.round(sb.top), w = Math.round(Math.min(hud.width, free));
  return { place: "notes", flat: true, F, need, maxH: roomSizes(w).maxH, free, x, y, w, h: Math.round(Math.min(roomSizes(w).maxH, H - foot - 8 - y, roomCapH(H, roomSizes(w).need))) };
}
/* WHO PLACES IT THERE. No curtain watches the page under this theme, so this does, and only this: a
   resize, the clock drawn again (`drpgHudRendered`), the theme applied (`refreshGlass`), and a change
   of size of the clock, the floor switcher, `#players`, the notice stack or Foundry's right column (a
   ResizeObserver, bound again when one of them is a new node; the column since fix r2-H3 bounds the
   width beside the notices). Nothing the room says is among them, and the tile itself is
   not watched: its content cannot move it. Under Stained Glass each returns at once - the curtain's
   pass places the tile there (`moduleLayout`). */
let flatWatch = null, flatTimer = 0;
const flatSoon = () => { clearTimeout(flatTimer); flatTimer = setTimeout(placeFlatRoomTile, 150); };
export function placeFlatRoomTile() {
  if (document.body.classList.contains("drpg-theme-stained-glass")) return;
  placeRoomTile(innerWidth, innerHeight);
  const nodes = ["#drpg-hud", "#drpg-floors", "#players", "#drpg-popups", "#ui-right-column-1"].map(q => document.querySelector(q)).filter(Boolean);
  if (typeof ResizeObserver !== "function" || (flatWatch && nodes.length === flatWatch.nodes.length && nodes.every((n, i) => n === flatWatch.nodes[i]))) return;
  flatWatch?.ro.disconnect();
  flatWatch = { nodes, ro: new ResizeObserver(flatSoon) };
  nodes.forEach(n => flatWatch.ro.observe(n));
}
/* ONCE A PASS, BEFORE THE RAIL IS PLACED: the rail is pushed down under whatever ends the clock's
   column, and in the 'clock' place that is the tile. In 'notes' the tile goes to the body, as the
   notice stack is (a scaled interface would put a fixed box inside it in the wrong pixels), and
   stands over the curtain at the curtain's own index, later in the tree; back in 'clock' it is
   put where room-tile.mjs `ensureRoomTile` puts it, which leaves a tile in the body alone. */
function placeRoomTile(W, H) {
  ROOM.place = ROOM.box = null;
  const tile = document.getElementById("drpg-room-tile");
  const p = tile && !narrowLayout() ? roomPlacement(W, H) : null;
  seatRoomTile(tile, p);
  LAST.room = p && { ...p };
  if (!p) return;
  ROOM.place = p.place;
  /* Under the clock the tile's TOP is where the column lays it, read with the rotations off; its
     width and height are the placement's, so nothing the room says reaches the box. */
  const top = p.place === "clock" ? Math.round(tile.getBoundingClientRect().top) : p.y;
  ROOM.box = { x: p.x, y: top, w: p.w, h: p.h };
  LAST.room.box = { ...ROOM.box };
}
function seatRoomTile(tile, p) {
  const body = document.body;
  if (!p) {
    ROOM_VARS.forEach(k => body.style.removeProperty(k));
    if (tile) { if (tile.dataset.place) delete tile.dataset.place; tile.style.zIndex = ""; homeRoomTile(tile); }
    return;
  }
  const vars = { "--drpg-room-h": p.h, "--drpg-room-w": p.w, "--drpg-room-x": p.x, "--drpg-room-y": p.y ?? 0, "--drpg-room-min-h": p.need, "--drpg-room-max-h": p.maxH };
  for (const [k, v] of Object.entries(vars)) body.style.setProperty(k, v + "px");
  if (tile.dataset.place !== p.place) tile.dataset.place = p.place;
  if (p.place === "notes") {
    if (tile.parentElement !== body) body.append(tile);
    tile.style.zIndex = document.getElementById("drpg-curtain")?.style.zIndex ?? "";
  } else { tile.style.zIndex = ""; homeRoomTile(tile); }
}
function homeRoomTile(tile) {
  if (tile.parentElement !== document.body) return;
  const hud = document.getElementById("drpg-hud");
  if (!hud?.parentElement) return;
  const floors = hud.nextElementSibling?.id === "drpg-floors" ? hud.nextElementSibling : null;
  (floors ?? hud).after(tile);
}
/* THE PICTURE LIES ON THE TILE'S WHOLE PANE (the owner's Q13), not in the tile's box: the pane runs
   past the box to the wall and leans with its column. room-tile.mjs draws the art layer inside the
   tile; while the curtain stands with a pane cut for the tile, it is moved to the body, over the
   curtain and under its glow at their own index (the seams' bloom runs over the picture's edges as
   it does over every pane's; laid over the glow, the picture hid its own leading - 13.10.2026,
   1920x1080) and under the interface, sized to the pane's bounds and clipped to its polygon.
   Called after every new cut and after every paint of the tile (a paint builds a new layer, and
   the old one in the body goes). With no pane it goes back into the tile. */
export function seatRoomArt() {
  const tile = document.getElementById("drpg-room-tile");
  const fresh = tile?.querySelector(":scope > .drpg-room-tile-art") ?? null;
  const loose = document.getElementById("drpg-room-art");
  const cur = document.getElementById("drpg-curtain");
  const pane = curtains.length && cur && LAST.room ? (LAST.panes || []).find(p => p.tone === "room-block") : null;
  if (fresh && loose && fresh !== loose) loose.remove();
  const art = fresh ?? loose;
  if (!art) return;
  if (!pane || !tile) {
    if (!tile || !tile.contains(art)) {
      art.removeAttribute("id");
      for (const k of ["position", "left", "top", "width", "height", "clip-path", "z-index", "inset", "transform", "transform-origin"]) art.style.removeProperty(k);
      if (tile) tile.prepend(art); else art.remove();
    }
    return;
  }
  art.id = "drpg-room-art";
  art.classList.toggle("is-open", tile.classList.contains("is-open"));
  layOnPane(art, paneLayer(pane.poly, tileTurn("#drpg-room-tile")), cur);
  if (cur.nextElementSibling !== art) cur.after(art);
}
/* THE PICTURES LEAN WITH THEIR PANE (H83, the owner's 26.10.2026 note: "Tak jak grafika postaci jest obrocona z
   kafelkiem, tak grafika pokoju tez powinna", and of the voice tile's portrait, "Tak, tez pochylic"). A block is
   turned with its pane (`buildColumn`), so a portrait drawn in a block leans with the tile; these two layers stood
   upright, the pane's box clipped to its outline. Now each is the smallest box that covers its pane in the pane's
   own turned frame, turned by the very rotation its tile wears (the rule `applyRotations` writes for the tile's
   selector) about the middle of the pane's upright box, and clipped to the pane's outline in that frame: the clip
   turns with the box, so on the screen it is the pane's outline again, and the box covers every corner of it - no
   bare glass. The gradient and the open shade are the layer's own ::before and ::after and lean with it. With no
   turn (under 0.004 rad, the column's own "none") it is the pane's upright box as before. Measured in Chromium on
   the glass harness on 26.10.2026, GM and player: at 1920x1080 the room's picture under the clock turned -8 deg with
   its tile and the portrait 8, at 1366x768 the picture beside the notices 6 and the portrait 8, each outline within
   0.05 px of its pane's corners and every corner inside the layer's box (drpgRoomCheck / drpgVoiceCheck `layerFit`);
   the same pages with the layers held upright read 21-40 px off. Monokuma Legacy and the stacked 393x852 cut no pane,
   and the pictures stay in their tiles. */
export function paneLayer(poly, phi = 0) {
  const b = bboxOf(poly), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const turned = Math.abs(phi) >= 0.004, c = Math.cos(turned ? phi : 0), s = Math.sin(turned ? phi : 0);
  // each corner in the turned frame, about the middle: R(-phi)(q - centre)
  const local = poly.map(([x, y]) => [(x - cx) * c + (y - cy) * s, -(x - cx) * s + (y - cy) * c]);
  const l = bboxOf(local);
  return { left: cx + l.x0, top: cy + l.y0, width: l.x1 - l.x0, height: l.y1 - l.y0, origin: (-l.x0).toFixed(2) + "px " + (-l.y0).toFixed(2) + "px",
    transform: turned ? "rotate(" + phi + "rad)" : "none", clip: "polygon(" + local.map(q => (q[0] - l.x0).toFixed(1) + "px " + (q[1] - l.y0).toFixed(1) + "px").join(", ") + ")" };
}
/* The turn a fixed block wears now, read off the rule written for its selector (ROT), so the picture takes the
   tile's own number and not a second computation of it. */
function tileTurn(sel) {
  const r = ROT.find(t => t.sel === sel && !t.rail);
  return parseFloat(/rotate\(([-\d.e]+)rad\)/.exec(r?.transform ?? "")?.[1] ?? "0") || 0;
}
function layOnPane(el, L, cur) {
  const at = cur.getBoundingClientRect();
  const set = { position: "fixed", inset: "auto", left: (at.left + L.left) + "px", top: (at.top + L.top) + "px", width: L.width + "px", height: L.height + "px",
    "transform-origin": L.origin, transform: L.transform, "clip-path": L.clip, "z-index": cur.style.zIndex || "1" };
  for (const [k, v] of Object.entries(set)) el.style.setProperty(k, v);
}
const bboxOf = poly => ({ x0: Math.min(...poly.map(q => q[0])), y0: Math.min(...poly.map(q => q[1])), x1: Math.max(...poly.map(q => q[0])), y1: Math.max(...poly.map(q => q[1])) });
/* ---- the voice tile: a fixed block at the right wall under the Projects tray (E78 C6) ---------
   The A9 design's step 4 and the owner's Q5 of 11.10.2026: a portrait upright at the right wall
   under the tray and not joined to it, 0.6 of the notice tile's width and 1.45 times as tall as
   it is wide, its rotated top corner 6 px from the wall, its top 24 px under the tray's CAPACITY
   - five rows, danganronpa.css's own cap - so a project added or folded away never moves it, and
   its foot at least 52 px above the corner's buttons. Like the room tile it is not measured: no
   name, no portrait and no speaker can recut the glass (the A9 design's verify line, scenario 75
   phase D). It is cut a pane of its own in the tray's column (`buildColumn`'s tail), and the
   column's glass to the left of that pane is not cut at all: Q16, "Na lewo od voice chatu nie
   powinno byc zadnego szkla", the area `voice-left` the self-check keeps empty (`OPEN_AREAS`). */
const VOICE = { box: null };
const VOICE_VARS = ["--drpg-voice-x", "--drpg-voice-y", "--drpg-voice-w", "--drpg-voice-h", "--drpg-voice-lift"];
const VOICE_WIDE = 0.6, VOICE_TALL = 1.45, VOICE_SEAM = 24, VOICE_WALL = 6, VOICE_FOOT = 52;
/* THE TILE'S TWO FLOORS (E78 fix r2-H1, 14.10.2026; review round 2's cor F1). C6 cut the height down to
   the corner's pane and set no floor of its own, and a wide, short screen keeps the desk: at af5eb69 the
   GM's tile was 181x55 at 1366x600, the buttons over the end of the name plate, and 181x15 at 1366x560,
   the plate cut off and both buttons hanging under the tile on bare map - the dock is hidden, so those
   are the only microphone and speaker on the screen. Read in Chromium on the glass harness that day, at
   the harness's scale of 1: the buttons stand 6..36 px down the tile, and the plate ends 12 px over its
   foot, 28 px tall with a name on one line and 41 px with a name on two (a name of more than about 22
   letters wraps). VOICE_FULL is the height whose plate, on two lines, starts 2 px under the buttons
   (91: 36 + 2 + 41 + 12). Under it the tile takes its COMPACT form (stained-glass.css, `data-fit`): the
   narrow row's choice, the name with '+N' on one line beside the two buttons, 'Speaking' and the
   microphone's line not drawn - the buttons' labels say them. VOICE_MIN is that form's own floor, the
   buttons and 6 px over and under them (42); under it the 52 px foot gives way - at 1366x560 the floor
   left the GM's tile 15 px, so its foot comes 25 px over the corner's pane. Read the same way: the GM's
   tile is 181x55 compact at 1366x600 and 181x42 at 1366x560, a player's 181x93 full and 181x53 compact,
   the self-check clean, and the GM's holds down to 1366x546; at 1366x544 its pane meets the corner's
   (overlaps 1), a desk this does not keep. A name of three lines (over about 44 letters) still runs up
   under the buttons at a height just over VOICE_FULL.
   E78 fix r2-H3 (14.10.2026) stood the full form's buttons one over the other at the pane's corner,
   from 7 px under the seam with the tray's pane (stained-glass.css): with the tray at its five rows
   the seam is VOICE_SEAM / 2 over the tile, so the column ends 7 - 12 + 30 + 4 + 30 = 59 px down the
   tile, and VOICE_FULL rose from 91 to 114 (59 + 2 + 41 + 12). Read in Chromium on the glass harness
   the same day with the tray's list held at its five rows and a name on two lines: at 91 the GM's
   tile at 1366x657 (110 high) had the plate under the speaker; at 114 a player's tile at 1366x600 (93)
   is compact, as the GM's is. */
const VOICE_FULL = 114, VOICE_MIN = 42;
/** Named areas of the last cut that no pane may cover, `{ name, poly }`: read by the self-check (`openFails`). */
export const OPEN_AREAS = [];
/* The tray at five rows, wherever it stands now: its own top to the header's foot, and the list's
   `max-height` (border-box, so its paddings are in it). A tray with no list - folded, or the
   fallback box - is its box. */
function trayCapacity(tray) {
  const el = document.getElementById("countdowns"), list = el?.querySelector(".countdowns-container");
  const head = el?.querySelector(".countdowns-header");
  if (!el || !list || !head) return tray.h;
  const cs = getComputedStyle(list), max = parseFloat(cs.maxHeight);
  if (!Number.isFinite(max)) return tray.h;
  const pad = cs.boxSizing === "border-box" ? 0 : parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  return Math.max(tray.h, Math.ceil(head.getBoundingClientRect().bottom - el.getBoundingClientRect().top + max + pad));
}
const voiceWall = W => W - (PIN.rail ?? 0);
/**
 * The voice tile's box for a W x H screen, or null where it has no place on the curtain (no tile, a
 * stacked screen, which puts it in the tiles' row, or Monokuma Legacy). Upright here; `buildColumn`
 * settles it against its column's turn (`settleVoice`).
 */
export function voicePlacement(W, H, tray) {
  if (!tray || !document.getElementById("drpg-voice-tile") || narrowLayout()) return null;
  if (!document.body.classList.contains("drpg-theme-stained-glass")) return null;
  const w = Math.round(VOICE_WIDE * noteTile().w * uiScale()), y = Math.round(tray.y + trayCapacity(tray) + VOICE_SEAM);
  return { x: voiceWall(W) - VOICE_WALL - w, y, w, h: Math.round(VOICE_TALL * w) };
}
/* THE TILE TURNS WITH ITS COLUMN, so its place is settled once the turn is known: the right column
   turns clockwise about its top left corner (sn >= 0, `buildColumn`), its top right corner is the
   one nearest the wall and its bottom right the lowest. x puts that top corner VOICE_WALL from the
   wall; the height is cut where the foot would come within VOICE_FOOT of `floor`, the top of the
   corner buttons' pane under it, but never under VOICE_MIN, and under VOICE_FULL the tile is compact. */
function settleVoice(b, W, { px, py, cs, sn }, floor) {
  const x1 = px + (voiceWall(W) - VOICE_WALL - px + (b.y - py) * sn) / cs;
  const x = Math.floor(x1 - b.w);
  const h = Math.max(VOICE_MIN, Math.min(Math.round(VOICE_TALL * b.w), Math.floor((floor - VOICE_FOOT - py - (x + b.w - px) * sn) / cs - (b.y - py))));
  return { ...b, x, h, fit: h < VOICE_FULL ? "compact" : "full" };
}
/* The tile is in the body (voice-tile.mjs) and stands at the settled box over the curtain, at the
   curtain's own index and later in the tree, as the room tile beside the notices does. */
function seatVoiceTile(box) {
  const body = document.body, tile = document.getElementById("drpg-voice-tile");
  if (!box || !tile) {
    VOICE_VARS.forEach(k => body.style.removeProperty(k));
    if (tile) { if (tile.dataset.place) delete tile.dataset.place; if (tile.dataset.fit) delete tile.dataset.fit; tile.style.zIndex = ""; }
    return;
  }
  const vars = { "--drpg-voice-x": box.x, "--drpg-voice-y": box.y, "--drpg-voice-w": box.w, "--drpg-voice-h": box.h, "--drpg-voice-lift": box.lift ?? 0 };
  for (const [k, v] of Object.entries(vars)) body.style.setProperty(k, v + "px");
  if (tile.dataset.place !== "wall") tile.dataset.place = "wall";
  if (box.fit === "compact") { if (tile.dataset.fit !== "compact") tile.dataset.fit = "compact"; } else if (tile.dataset.fit) delete tile.dataset.fit;
  tile.style.zIndex = document.getElementById("drpg-curtain")?.style.zIndex ?? "";
}
/* THE PORTRAIT LIES ON THE TILE'S WHOLE PANE (the owner's Q17, "niech wypelnia caly kawalek
   szkla"), as the room tile's picture does (`seatRoomArt`): the tile's art layer moved to the body
   after the curtain, sized to the pane's bounds and clipped to its polygon. Unlike the room's, the
   layer is built once with the tile and repainted in place (voice-tile.mjs keeps it by the tile), so
   a new speaker moves nothing here. With no pane it goes back into the tile's face. */
export function seatVoiceArt() {
  const tile = document.getElementById("drpg-voice-tile");
  const art = tile?.querySelector(".drpg-voice-tile-art") ?? document.getElementById("drpg-voice-art");
  if (!art) return;
  const cur = document.getElementById("drpg-curtain");
  const pane = curtains.length && cur && VOICE.box ? (LAST.panes || []).find(p => p.tone === "voice-block") : null;
  const face = tile?.querySelector(".drpg-voice-tile-face");
  if (!pane || !face) {
    if (!face) { art.remove(); return; }
    if (art.parentElement !== face) {
      art.removeAttribute("id");
      for (const k of ["position", "left", "top", "width", "height", "clip-path", "z-index", "inset", "transform", "transform-origin"]) art.style.removeProperty(k);
      face.prepend(art);
    }
    return;
  }
  art.id = "drpg-voice-art";
  layOnPane(art, paneLayer(pane.poly, tileTurn("#drpg-voice-tile")), cur);
  const room = document.getElementById("drpg-room-art");
  const after = room && room.previousElementSibling === cur ? room : cur;
  if (after.nextElementSibling !== art) after.after(art);
}
/* THE NOTICE CARD FILLS ITS PANE (E79 C13, the owner's N16 of 15.10.2026, "as the room tile and the
   voice tile do"). The cards stand in `#drpg-popups`, an upright box turned 8 degrees with the
   notice tile, and they drew their plates themselves, so a card was a smaller box inside a pane
   that leans, runs to the wall and to the screen's foot. Measured in Chromium on the glass harness
   on 15.10.2026: at 1920x1080 the pane [[0,678],[389,733],[340,1080],[0,1080]] and the card's
   corners TL(58,707) TR(377,752) BR(340,1015) BL(21,970) - about 21 px of bare glass over the card,
   9 px to its right, 21-58 px at the wall and 65-110 px under it. The harness did not reproduce the
   owner's cut edges (images/14.png): the card was inside the pane there (LIVE-E79-18).
   So the plate is not the card's any more: this layer, the note pane's polygon in the screen's
   coordinates and its only writer, is moved to the body after the curtain's glow (the two tiles'
   pictures stand between the curtain and the glow, and the glass harness holds them there; the
   card's own plate covered the glow on this pane before as well), sized to the pane's
   bounds and clipped to its polygon, as those pictures are, and `data-drpg-note-frame` on the body
   says it stands. Stained Glass paints it while a card is on the tile (stained-glass.css, N16;
   popup.mjs `setFloor` says when) and takes the plate and the edge off the card; the words
   keep their place in the turned stack. Desks only: the stacked layout keeps its own notice stack
   (narrow.css), and with no pane - Monokuma Legacy, no cut - there is no layer. Called after every
   new cut and at the unmount, as the pictures are; a card shown or closed needs no call. */
export function seatNoteFrame() {
  const cur = document.getElementById("drpg-curtain");
  const pane = curtains.length && cur && !narrowLayout() ? (LAST.panes || []).find(p => p.tone === "note-block" && p.poly?.length) : null;
  let frame = document.getElementById("drpg-note-frame");
  document.body.toggleAttribute("data-drpg-note-frame", Boolean(pane));
  if (!pane) { frame?.remove(); return; }
  if (!frame) { frame = document.createElement("div"); frame.id = "drpg-note-frame"; frame.setAttribute("aria-hidden", "true"); }
  const { x0, y0, x1, y1 } = bboxOf(pane.poly), at = cur.getBoundingClientRect();
  const set = { position: "fixed", left: (at.left + x0) + "px", top: (at.top + y0) + "px", width: (x1 - x0) + "px", height: (y1 - y0) + "px",
    "clip-path": "polygon(" + pane.poly.map(q => (q[0] - x0).toFixed(1) + "px " + (q[1] - y0).toFixed(1) + "px").join(", ") + ")", "z-index": cur.style.zIndex || "1" };
  for (const [k, v] of Object.entries(set)) frame.style.setProperty(k, v);
  let after = cur.parentElement.querySelector(":scope > .curtain-glow[data-glow]:not(.drpg-glow-ghost)");
  if (!after) { after = cur; while (after.nextElementSibling && after.nextElementSibling !== frame && ["drpg-room-art", "drpg-voice-art"].includes(after.nextElementSibling.id)) after = after.nextElementSibling; }
  if (after.nextElementSibling !== frame) after.after(frame);
}
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
   edge (STRIP_LEAN, 26) plus the clearance that edge keeps off the tiles (14) */
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
  // a sidebar opened in the Foundry tools window (E77 C5) widens the window, not the right wall
  const read = () => document.body.classList.toggle("drpg-sidebar-open", !inFoundryWindow(bar) && bar.offsetWidth > tabs.offsetWidth + 40);
  read();
  if (sidebarWatched) return;
  sidebarWatched = true;
  new ResizeObserver(read).observe(bar);
}
const RAIL_MARGIN = 16;
/* WHERE A RAIL STILL IN THE COLUMN STARTS UNDER THE CLOCK. Until E77 C6 the GM button stood
   between the clock and the scene rail, and a player's rail kept its room (22.09): the clock's
   bottom margin 4, the column's gap 16, the button's top margin 20 and height 32, the 26 px it
   dropped to clear the clock's glass and the 12 px gap over the first tile. The button is in the
   corner now; a rail left in the column (a GM whose windows were not built) starts where it did,
   so its shard is cut as it was. One sum of the old constants, not re-measured since C6. */
const RAIL_SLOT = 4 + 16 + 20 + 32 + 26 + 12;
/* THE SHIFT A ROTATED BLOCK ALREADY WEARS, BY SELECTOR, AND WHY IT IS KEPT (E78 fix h76-HF2, 14.10.2026).
   `railOverhang` used to be asked about a block drawn without its shift, so every pass wrote the
   rules once without it - the block snapped back over the edge - and once with it, and the 840 ms
   transition slid it in again. Since E77 put Foundry's rails in windows the pinned column stands
   at `right: 0` and the status strip, leaning, ends 7 px past the margin, so that was every pass;
   and the drift watch, its reference taken mid-slide, asked for the next one. Measured in Chromium
   on the glass harness on 13.10.2026, idle 10 s after a 6 s settle under Stained Glass: 7-8
   transform transitions at 1920x1080 and 10 at 1366x768 on the GM's page, 8 on a player's; 0 on
   1.2.75, 0 with the windows off, 0 under Legacy. So the shift is written with the rule from the
   first write on, the box is measured less the shift it wears, and the sheet is written again only
   when a shift changed. audit/glass-sweep.mjs's idle reading, 5 s once the load is 6 s old, passes
   and transitions: 4/3 and 5/5 at 1920x1080 and 1366x768 on the GM's page before, 4/4 and 5/5 on a
   player's; 0/0 at all four after, the strip's shift still -7. A selector that leaves ROT takes its
   shift with it (`applyRotations`). Neither of the two other changes the report weighed was made:
   the pinned column is not given room for the lean when there is no rail - the shift already holds
   the strip off the wall, and moving the column moves the tray's and the voice tile's panes, which
   the sweep pins - and the drift watch's reference is still taken in the frame after a pass (see
   the sweep's idle control for what a pass with a slide costs now). */
const OVERHANG = new Map();
function railOverhang(el, was = 0) {
  const r = el.getBoundingClientRect();
  if (r.width < 1) return 0;
  const left = r.left - was, right = r.right - was;
  if (left < RAIL_MARGIN) return Math.ceil(RAIL_MARGIN - left);
  if (right > window.innerWidth - RAIL_MARGIN) return -Math.ceil(right - (window.innerWidth - RAIL_MARGIN));
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
function railRule(r) {
  const phi = parseFloat(/rotate\(([-\d.e]+)rad\)/.exec(r.transform)?.[1] ?? "0");
  const [ox, oy] = r.origin.split(" ").map(parseFloat);
  const w = r.el.offsetWidth, h = r.el.offsetHeight;
  /* THE TILES, READ NOW, FROM LAYOUT VALUES.
     `offsetLeft` / `offsetTop` carry no transform, so unlike `getBoundingClientRect` they can
     be read while the rotation is applied - which means this rule can be recomputed whenever
     the rail's contents change, not only when the curtain is recut, which the curtain
     deliberately does not do on a click: a box captured at cut time was a box from before the
     click ("dalej nie jest wycentrowany", 08.09). */
  const railAt = el => { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y]; };
  const live = (() => {
    const kids = tileButtons(r.el);
    if (!kids.length) return null;
    const own = railAt(r.el);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of kids) {
      const [kx, ky] = railAt(k);
      const b = [kx - own[0], ky - own[1], kx - own[0] + k.offsetWidth, ky - own[1] + k.offsetHeight];
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
    }
    return [x0, y0, x1, y1];
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
  const plain = `${at} :is(${r.sel}) { transform-origin: ${r.origin}; transform: ${r.transform}; }`;
  if (!(w > 0) || !Number.isFinite(phi) || !phi) return plain;
  /* The element's own untransformed left, measured during the layout pass when the
     rotations were off. The `offsetParent` chain is the fallback, and only that: built from
     it, the hull of the GM button that rode this shard until E77 C6 came out 57 px out. */
  const L = live ? railAt(r.el)[0] : (Number.isFinite(r.pageLeft) ? r.pageLeft : railAt(r.el)[0]);
  const cs = Math.cos(phi), sn = Math.sin(phi);
  const xs = [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].map(([x, y]) => ox + (x - ox) * cs - (y - oy) * sn);
  const left = L + Math.min(...xs), right = L + Math.max(...xs);
  const W = window.innerWidth;
  let shift = 0;
  if (r.pane) {
    const cx = document.getElementById("drpg-curtain")?.getBoundingClientRect().left ?? 0;
    shift = Math.round((cx + (r.pane[0] + r.pane[1]) / 2) - (left + right) / 2);
  }
  if (left + shift < RAIL_MARGIN) shift = Math.ceil(RAIL_MARGIN - left);
  else if (right + shift > W - RAIL_MARGIN) shift = -Math.ceil(right - (W - RAIL_MARGIN));
  if (!shift) return plain;
  return `${at} :is(${r.sel}) { transform-origin: ${r.origin}; transform: translateX(${shift}px) ${r.transform}; }`;
}

/* ONE WRITE, OR THE RAILS ANIMATE EVERY TIME THE GLASS IS RECUT.
   The blocks carry an 840 ms transition on `transform`. This used to write the sheet once
   with the plain rotation and again with the corrections, and the browser did what it was
   asked: it animated from the first to the second, every geometry pass - the tiles that
   "teleport and slide every half second" (07.09). Everything a rail's rule needs is known before
   the first write. A block that overhangs the wall is only known after it, so its shift is kept
   (OVERHANG) and written with its rule from then on: the sheet is written a second time only
   when the screen's answer below changes a shift, and an unchanged pass writes nothing - which
   until E78 fix h76-HF2 this comment said and the code did not do (the shift was dropped from the
   first write of every pass, and the two writes were joined differently, so both happened). */
function applyRotations() {
  const turned = new Set(ROT.filter(r => r.sel && !r.rail && r.transform && r.transform !== "none").map(r => r.sel));
  for (const sel of OVERHANG.keys()) if (!turned.has(sel)) OVERHANG.delete(sel);
  const blockRule = r => {
    const shift = OVERHANG.get(r.sel);
    return `body.drpg-theme-stained-glass :is(${r.sel}) { transform-origin: ${r.origin}; transform: ${shift ? `translateX(${shift}px) ` : ""}${r.transform}; }`;
  };
  const rules = ROT.map(r => r.rail && r.el && r.sel ? railRule(r) : r.sel ? blockRule(r) : null);
  for (const r of ROT) {
    if (!r.sel && r.el) { r.el.style.transformOrigin = r.origin; r.el.style.transform = r.transform === "none" ? "" : r.transform; }
  }
  const sheet = rotationSheet();
  /* WRITTEN ONLY WHEN THE RULES CHANGE - and the comment above overstated this until now.
     Assigning `textContent` replaces the element's text node whether or not the string
     differs, and a `<style>` whose text is replaced is re-parsed and invalidates style for
     the whole document. `applyRotations` runs on EVERY pass through `curtainGeometry`,
     including the fast path that exists precisely so an unchanged layout costs nothing, so
     this was a document-wide restyle on a pass that had just established that nothing moved.
     The audit's own fix line for UI-16 had two halves - "run `applyRotations` in
     `requestAnimationFrame` AND skip when the sheet text would be unchanged" - and only the
     first was implemented (8d24e21). This is the second. */
  const text = rules.filter(Boolean).join("\n");
  if (sheet.textContent !== text) sheet.textContent = text;
  if (sheet.disabled) sheet.disabled = false;
  watchSidebar();
  if (document.body.hasAttribute("data-drpg-measuring")) { void document.body.offsetWidth; measuring(false); }
  /* the glass proposed the angle; this is the screen's answer to it */
  let moved = false;
  for (const r of ROT) {
    if (!r.sel || !r.el || !r.transform || r.transform === "none" || r.rail) continue;
    const was = OVERHANG.get(r.sel) || 0, shift = railOverhang(r.el, was);
    if (shift === was) continue;
    moved = true;
    if (shift) OVERHANG.set(r.sel, shift); else OVERHANG.delete(r.sel);
  }
  /* The second write cannot be folded into the first: `railOverhang` above measures the
     blocks AFTER the rules have been applied - that is what "the screen's answer" means -
     so the first assignment has to have landed before this one can be computed. A rail's
     rule is the one already written: it reads layout values, which no rule changes. */
  if (moved) {
    const again = ROT.map((r, i) => r.rail && r.el && r.sel ? rules[i] : r.sel ? blockRule(r) : null).filter(Boolean).join("\n");
    if (sheet.textContent !== again) sheet.textContent = again;
  }
}

/* THE ROTATION PASSES, FOR A TEST THAT HAS NO LAYOUT (E78 fix h76-HF2, 14.10.2026; R547).
   jsdom cuts no curtain, so ROT is empty headless and `applyRotations` never runs there. This
   runs it once per table given, in order, as consecutive passes do, and counts the writes of the
   sheet each pass made: an unchanged pass must make none, because in a browser every write
   that moves a rule is a snap and an 840 ms slide. It writes a sheet of its own
   (`drpg-glass-rotation-test`, which a test's stub reads) and keeps the screen's sheet, ROT
   and the shifts as they were, so at a table the curtain's blocks do not move. */
export function rotationWrites(tables) {
  const rot = ROT.splice(0), shifts = new Map(OVERHANG), screen = rotSheet;
  const sheet = rotSheet = document.createElement("style");
  sheet.id = "drpg-glass-rotation-test";
  document.head.append(sheet);
  const mo = new MutationObserver(() => {});
  mo.observe(sheet, { childList: true, characterData: true, subtree: true });
  OVERHANG.clear();
  try {
    return tables.map(t => { ROT.length = 0; ROT.push(...t); applyRotations(); return { writes: mo.takeRecords().length, text: sheet.textContent }; });
  } finally {
    mo.disconnect(); sheet.remove(); rotSheet = screen;
    ROT.length = 0; ROT.push(...rot); OVERHANG.clear(); for (const [k, v] of shifts) OVERHANG.set(k, v);
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
/* `PAD_SIDE` from the partition, which lives inside `curtainShapes`. One number, stated
   twice because the two are in different scopes; if it ever moves, both move. */
const COLUMN_PAD = 12;
/* The status strip and the Projects tray, at 100 % type: the width they keep, and the width
   they take where the desk has room (see `pinRightColumn`). */
const COLUMN_W = [360, 400];
function pinRightColumn() {
  const col = document.getElementById("ui-right-column-1");
  if (!col) return;
  /* AND NOT WHEN THE COLUMN IS A ROW OF THE STACK. Pinned, it leaves the flow and
     stands against the right wall at the top of the screen - which on a stacked
     layout is where the clock is: the strip and the tray came down on top of it
     (measured, three overlapping pairs). Stacked, the column is in narrow.mjs's
     column and belongs to it. */
  if (!themeOn() || narrowLayout()) { unpinRightColumn(); return; }
  const rail = columnRail("#sidebar-tabs");
  const r = rail && rail.offsetWidth ? rail.getBoundingClientRect() : null;
  /* AND CLEAR OF THE RAIL'S BAND, NOT JUST OF THE RAIL.
     The tab rail leans, so the glass cut for it is the tiles plus the swing that lean costs
     - about 52 px on a 1440p screen. Pinned only to the rail's own left edge, the status
     strip and the Projects tray reached 46 px into that band, the strip had to start below
     them, and the rail's top eight tiles ended up on somebody else's pane.

     AND THE SWING IS NOT THE WHOLE BAND: THE STRIP'S OWN LEAN IS THE REST (16.09).
     `railBox` reserves `swing + slack`, where the slack is what the strip's inner edge
     costs over the rail's run - `14 + run * tan(STRIP_ANGLE)`, about 51 px on a rail of
     620. Only the swing was reserved here, so the column stood some 43 px inside the
     band, and everything downstream followed from that one number: the column counted as
     hugging the wall (`hugR`, which is true within 120 px of it), its section pane ran
     into the wall under the rail, a strip piece that overlaps a content pane is thrown
     away - so the rail's upper tiles stood on the tray's glass again, which is the fault
     this comment says was fixed. Measured 16.09 on the glass harness with a fifteen-tab
     rail - the length a real client's sidebar runs to, where the harness's own six leave
     the collision invisible - counting corners of the rail's tiles that stand on their
     own strip rather than on somebody else's pane:

                      swing only     swing + slack
       2560 x 1440      60 / 60          60 / 60
       1920 x 1080      60 / 60          60 / 60
       1600 x 900       42 / 60          60 / 60
       1440 x 900       42 / 60          60 / 60
       1366 x 768       36 / 60          54 / 60
       1280 x 800       45 / 60          57 / 60

     The last two rows are the room running out, not the rule failing: see below.

     The other way round was tried first and reverted: clipping the SECTION panes out of
     the band instead (`pushPane` exempts them) puts the rail on a hole rather than on
     somebody else's glass - 18 corners on nothing and 28 gaps at the screen edge at
     1600x900 - because the strip starts below the column's pane and nothing then covers
     what the column gave up. Four earlier shapes of that idea are written up in
     `cutStrips`. The collision is not in the partition: it is that two things were told
     to stand in the same 43 px, and one of them is the module's own column.

     AND THE SLACK IS TAKEN ONLY WHERE THERE IS ROOM FOR IT.
     The column moves left, and on a narrow desk what is to its left is the Despair rail,
     which is centred on the screen and cannot move: below about 1250 px the two already
     overlap, which is the band written up in the 1.2.47 notes. Taking the whole slack
     unconditionally carried that band up with it - swept at 800 px tall, block failures
     16 from 1248 to 1344 where 1.2.47 has none (and 1200-1247 keeps the 16 it already
     had). So the pin asks for the band and settles for the room: never less than the old
     swing-only distance, never so far left that the column crosses the Despair rail with
     its pad. Where the screen cannot pay, the tiles stand on the tray's glass exactly as
     they did - which is the same collision, written down in the same place as the rest of
     that band rather than fixed by moving one of the two things off the screen.

     At 1366 and 1280 that is what the residue in the table above is: the column takes as
     much of the slack as the Despair rail leaves it, six and three tile corners still
     stand on the tray's glass, and nothing stands on a hole. Both readings are with a
     fifteen-tab rail, which is a long one. */
  const slack = r ? 14 + Math.round(r.height * Math.tan(STRIP_ANGLE)) : 0;
  const base = r ? Math.max(0, Math.round(innerWidth - r.left) + railSwing(r.height) + 8) : 0;
  /* NEITHER READING IS OF THIS FUNCTION'S OWN OUTPUT, and that is worth checking rather
     than asserting - three of the faults in 1.2.47 were measurements taken through a
     distortion the same code had applied. `width: auto` on a fixed box is shrink-to-fit,
     which in principle narrows as `right` grows; in fact the strip and the tray state
     their own width off the interface scale, so the column is 306 px wide whatever is
     left of it. Measured 16.09, five consecutive passes at 1280, 1366, 1440 and 1920:
     the width and the pin both settle on the first one and do not move again. The
     Despair rail is centred on the screen and does not read the column at all. */
  const dsp = document.getElementById("drpg-despair");
  const dspR = dsp && dsp.offsetWidth ? dsp.getBoundingClientRect().right : null;
  /* WIDER, AND TOWARD THE TILES (Dawid, 22.09: "poszerzmy troche panel projects i sasiadujacy
     nad nim panel ... raczej w prawo w strone kafelkow foundry"). To the right, the column's
     own margin was the only room left: stained-glass.css takes it from 22 px to 6, which puts
     the strip's pane 6 px short of the rail's glass instead of 23 (measured 22.09 at 1920 x 1080:
     the pane ends at 1793.6, the rail's strip begins at 1800). The rest of
     the width comes from the left, and only where the Despair rail leaves it: the strip and
     the tray ask for 400 px on the type scale and settle for no less than the 360 they had,
     so a narrow desk - where the two already touch - keeps exactly the column it had. */
  const scale = Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--drpg-sg-scale")) || 1;
  const gap = Number.parseFloat(getComputedStyle(col).marginRight) || 0;
  const [narrowW, wideW] = COLUMN_W.map(w => Math.round(w * scale));
  const fitW = dspR != null ? Math.floor(innerWidth - dspR - 2 * 12 - (base + slack) - gap) : wideW;
  col.style.setProperty("--drpg-column-w", Math.max(narrowW, Math.min(wideW, fitW)) + "px");
  const own = col.getBoundingClientRect().width;
  const room = dspR != null && own ? Math.round(innerWidth - dspR - 2 * 12 - own - gap) : Infinity;
  const right = Math.max(base, Math.min(base + slack, room));
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
/* THE MODULE'S OWN BUTTONS DO NOT STAND IN FOUNDRY'S TAB RAIL.
   ---------------------------------------------------------------------------
   The messenger circle and the sound button when this was measured - the book beside
   them since 22.09, the three on one grid since E81 C12 - are pinned to the bottom-right
   corner, and so is Foundry's tab rail - which grows downward with the number of tabs.
   On a short screen with a full sidebar the two meet: measured 16.09 on the glass harness at
   1366x768 with a fifteen-tab rail, the launchers sat at x 1278..1344, y 620..746 and
   the rail's last two tiles at x 1280..1331, y 626..668. The module's buttons were drawn
   over Foundry's, which is the collision the 1.2.47 audit recorded and did not fix.

   It shows up twice: as two controls on top of each other, and as a hole in the glass -
   the launchers are a BLOCK, their section pane runs into the wall (`hugR`), and a strip
   piece that overlaps a content pane is thrown away, so the rail's bottom tiles lost
   their own glass and stood on the launchers' instead. The same fault as the Projects
   tray's, one corner further down.

   The buttons move inboard, and only when they would otherwise stand in the rail's run:
   on a tall screen the rail ends hundreds of pixels above them and nothing moves. How far
   is the rail's own band - the same terms `railBox` reserves, so the launchers' pane
   stops where the strip begins - plus one pad. That also takes their pane out of the
   `hugR` zone (120 px of the wall), so it no longer runs into the wall behind the strip.

   The condition is their TOP against the rail's bottom, which is a vertical reading, and
   this moves them horizontally: the measurement is not of its own output. */
const LAUNCH_CLEAR = "--drpg-launch-clear";
function clearLaunchers() {
  const drop = () => document.body.style.removeProperty(LAUNCH_CLEAR);
  if (!themeOn() || narrowLayout()) { drop(); return; }
  const rail = columnRail("#sidebar-tabs");
  const box = rail && rail.offsetWidth ? tileButtons(rail).map(e => e.getBoundingClientRect()) : [];
  const buttons = [...document.querySelectorAll(LAUNCHERS)]
    .filter(e => e.offsetWidth);
  if (!box.length || !buttons.length) { drop(); return; }
  const top = Math.min(...box.map(q => q.top)), bottom = Math.max(...box.map(q => q.bottom));
  // clear of the rail's run with the strip's own collar to spare: stay at the wall
  if (Math.min(...buttons.map(e => e.getBoundingClientRect().top)) > bottom + 14) { drop(); return; }
  const run = bottom - top;
  const band = Math.round(8 + (Math.max(...box.map(q => q.right)) - Math.min(...box.map(q => q.left)))
    + railSwing(run) + 14 + run * Math.tan(STRIP_ANGLE));
  /* CORRECTED AGAINST WHERE THEY ACTUALLY LANDED, not computed from the stylesheet's own
     number. `right` is an inset from the containing block, and under this theme that is
     not the viewport - an ancestor carries a filter - so the two differ by 9 px here and
     22 px on the right-hand column. Rather than model that, this asks for the distance it
     wants and moves by the error: once the buttons are where they should be the error is
     zero and the value stops changing, which the five-pass check confirms. */
  let cur = Number.parseFloat(getComputedStyle(document.body).getPropertyValue(LAUNCH_CLEAR)) || 0;
  /* TWO PADS, NOT ONE: the pane is the block's box plus PAD_SIDE, and one pad put its edge
     exactly on the band's - which the strip's "is this pane in my way" test reads with half
     a pixel of tolerance. The second pad is what makes the answer unambiguous. */
  const want = band + 2 * COLUMN_PAD;
  /* AND IT SETTLES HERE, NOT OVER PASSES. Moving these buttons is the last thing that would
     make the curtain recut, so there is no second pass to correct in: the signature is taken
     after this and already matches. Three tries is one more than the two it takes. */
  for (let i = 0; i < 3; i++) {
    const err = want - (innerWidth - Math.max(...buttons.map(e => e.getBoundingClientRect().right)));
    if (Math.abs(err) < 1) break;
    cur = Math.max(0, Math.round(cur + err));
    document.body.style.setProperty(LAUNCH_CLEAR, cur + "px");
  }
}
function unpinRightColumn() {
  const col = document.getElementById("ui-right-column-1");
  if (!col || col.dataset.drpgPinned !== "1") return;
  delete col.dataset.drpgPinned; PIN.rail = null;
  for (const k of ["position", "top", "right", "left", "bottom", "height", "width", "zIndex", "pointerEvents"]) col.style[k] = "";
  col.style.removeProperty("--drpg-column-w");
}
/* Measuring turns the rotation off for one style pass, and the blocks carry an 840 ms
   transition on `transform` - so without this every measurement animated every block from
   0 degrees back to its tilt: the "wobble" of 1.2.30. The class holds transitions still for
   exactly the passes in which the rotation is toggled. */
/* AN ATTRIBUTE, NOT A CLASS, AND THAT IS THE WHOLE OF THE CHANGE.
   Three MutationObservers in this module watch the body with the filter
   `["data-drpg-phase", "data-drpg-time", "class"]`: this file's own state change, the fog's
   room outline (fog.mjs) and the Remnant rings (remnant-ring.mjs), the last of which walks
   every token on the canvas. While this flag rode on `class`, every cut of the curtain woke
   all three - measured in Chromium: one recut queued three class records and one wake-up, for
   a flag that means "hold the transitions still for two style passes" and is nobody's business
   but this file's. The name the observers filter on is `class`, so the flag simply leaves it. */
function measuring(on) {
  document.body.toggleAttribute("data-drpg-measuring", on);
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
  /* THE PIN IS READ OFF AN UPRIGHT RAIL, AND THAT IS WHY IT IS HERE (16.09).
     -------------------------------------------------------------------------
     `pinRightColumn` stands the status strip and the tray a measured distance
     from the wall, and it measures that distance off `#sidebar-tabs` - which is
     a block, so it wears a rotation, and a rotation is written as a transform
     with an ORIGIN IN PIXELS computed from the layout of the pass that wrote it.
     The two lines above are what makes the rail upright again, and the call used
     to sit before them, in `rebuild`.

     On a fresh load that is invisible: the curtain is cut several times while
     Foundry settles, and whichever pass happens to read a rail whose origin is
     still yesterday's is followed by one that does not. A RESIZE gets one
     debounced pass. Measured in Chromium (audit/glass-harness.html), 1280 ->
     1440 at 800: the rail's rotated box read x = 1227 when the upright rail
     stands at 1376, so `right` came out 256 px instead of 107, the strip and
     the tray were moved 150 px inboard of where they belong, and the glass was
     cut around them there - 12 block failures and an edge gap at a width that
     is clean on a fresh load. Calling `refreshGlass()` by hand put it right,
     which is what named the cause: a stale reading, not a stale layout.

     Here, it reads the rail as laid out, and the blocks measured below - two of
     which live inside the column it just moved - are measured where they will
     actually stand. */
  pinRightColumn();
  clearLaunchers();
  placeRoomTile(W, H);
  /* THE LEFT RAIL STARTS UNDER THE MODULE'S OWN LEFT COLUMN, AND THAT IS A ONE-WAY READ.
     Left alone, Foundry lays the first tiles at the top of the column, under what stands there.
     The old `placeTiles` pushed the rail down until it stood clear of the SHARD CUT FOR IT - a
     measured position fed back into the thing being measured, which is why the tiles crept and
     jumped every recut. The push is computed here instead, from the bottom of what ends the
     clock's column, whose position does not depend on the rail, and it is computed while the
     rotations are off, so it is the same number every pass. The rail is then measured where it
     will actually be. */
  const railTop = columnRail("#scene-controls");
  let noteFitted = false;
  if (railTop) {
    railTop.style.paddingTop = "";
    railTop.style.marginTop = "";
    void railTop.offsetWidth;
    const tops = tileButtons(railTop).map(e => e.getBoundingClientRect().top);
    /* A PLAYER'S RAIL STARTED WHERE THE GM'S DID (22.09), AND SINCE E77 C6 THERE IS NO
       DIFFERENCE LEFT TO MAKE. These are read with the rotations off, and the clock is drawn
       tilted: its pane runs some 50 px below its upright box at the wall. A player had no GM
       button, and once the column was packed from the top (1.2.49) the first tiles sat 38 px
       under the clock's upright box - on its glass, across its seam ("rozjechane przyciski
       foundry u gracza", Dawid, 22.09). So the rail keeps `RAIL_SLOT` under whatever ends the
       clock's column - the room tile when it stands there (E77 C4), which `roomPlacement`
       counted F against. */
    const hudEl = document.querySelector(ROOM.place === "clock" ? "#drpg-room-tile" : "#drpg-hud");
    if (tops.length && hudEl && hudEl.offsetHeight > 0) {
      /* MARGIN, NOT PADDING, AND IT MAY BE NEGATIVE.
         The rail is placed so its first tile sits `RAIL_SLOT` under the clock's column, wherever
         Foundry happens to put it. `padding-top` can only ever push it DOWN, so the moment Foundry's
         own layout left a bigger gap than we want - which is what a trip up and back down the
         interface scale does - there was no way to close it again: measured 9 px at 100 %,
         16 at 140 %, and 46 px on the way back to 100 %, growing every round trip.
         A margin moves the box either way, so the gap is stated rather than accumulated. */
      const need = Math.round(hudEl.getBoundingClientRect().bottom + RAIL_SLOT - Math.min(...tops));
      railTop.style.boxSizing = "border-box";
      if (Math.abs(need) > 1) railTop.style.marginTop = need + "px";
      /* AND IT STOPS WHERE THE NOTICE TILE STARTS.
         Foundry gives the rail the whole height of the screen and wraps its tools into a
         second column only when they run out of it. Left alone, a control with thirteen tools
         put its last tiles 120 px inside the notice pane - outside the glass cut for the rail,
         which is what "za niska na nasze kafelki" was. The rail is BOUNDED here instead, to
         the room between the top of its own run and the notice tile (whose box is a constant of the
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
      const menuFirst = railTop.querySelector(":scope > menu");
      const ownFirst = menuFirst ? [...menuFirst.querySelectorAll("button.ui-control")].filter(e => e.offsetWidth > 0) : [];
      /* The rail's run is its LAYERS - that menu cannot wrap (see below) - so the tile is
         fitted under the last of them, and the tools are then bounded to the same room. */
      const layersEnd = ownFirst.length
        ? Math.ceil(Math.max(...ownFirst.map(e => e.getBoundingClientRect().bottom)))
        : Math.round(boxTop);
      /* Where the longest tools menu would end in one column, two, three - read off the
         layers' own pitch, since the tools are the same tiles - then the layers themselves. */
      const most = Math.max(0, ...Object.values(globalThis.ui?.controls?.controls ?? {})
        .map(c => Object.keys(c.tools ?? {}).length));
      const layerTops = ownFirst.map(e => e.getBoundingClientRect().top).sort((a, b) => a - b);
      const firstTop = layerTops.length ? layerTops[0] : boxTop;
      const tileH = ownFirst.length ? ownFirst[0].getBoundingClientRect().height : 34;
      const pitch = layerTops.length > 1 ? Math.max(tileH, layerTops[1] - layerTops[0]) : tileH + 8;
      const railEnds = [1, 2, 3]
        .map(cols => Math.max(layersEnd, Math.ceil(firstTop + Math.ceil(most / cols) * pitch - (pitch - tileH))))
        .concat(layersEnd);
      const fitted = fitNoteTile(H, railEnds, s);
      noteFitted = true;
      /* THE BOX IS THE CAPACITY CHOSEN ABOVE, AND NOT ONE PIXEL OF THE TILE'S ROOM MORE (22.09).
         It used to be all the room above the notice tile, and once the tile reached its
         ceiling that was far more than any menu needs: a 13-tool menu then wrapped ten deep in
         a 429 px box and ran 110 px below the glass, which was cut to the tiles on screen when
         the tokens were open ("zapas z prawej jest, ale na dole brak miejsca", Dawid, on
         1.2.49). Bounded to where the chosen run ends, the menu wraps sideways into the
         columns `railBox` reserves, and the strip is cut to the whole box. */
      const room = Math.round(fitted.railEnd - boxTop);
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
  /* NO RAIL ON THE WALL (E77 C5, 13.10.2026). A player's scene controls are hidden and a GM's
     stand in the Map tools window, so nothing above calls `fitNoteTile` and the notice tile would
     keep whatever height was written last, or the stylesheet's own. It is fitted under what does
     end the clock's column instead: the room tile when it stands there (its placed box), else the
     clock - each with the column's drop at the wall that `roomPlacement` reserves, because the
     tile is fitted under that column's PANE, not its box (fitted under the box, a player's notice
     tile at 1600x900 grew to 281 px and its pane began at 577, two pixels into the room tile's).
     With nothing in the column at all it is fitted under the screen's top, which is NOTE_MAX. */
  if (!noteFitted) {
    const clock = ["#drpg-hud", "#drpg-hud + #drpg-floors"].map(q => document.querySelector(q))
      .filter(e => e && e.offsetWidth > 0 && e.offsetHeight > 0).map(e => e.getBoundingClientRect());
    const ends = [];
    if (clock.length) {
      const end = ROOM.place === "clock" && ROOM.box ? ROOM.box.y + ROOM.box.h : Math.max(...clock.map(r => r.bottom));
      ends.push(Math.ceil(end + Math.max(...clock.map(r => r.right)) * ROOM_TAN));
    }
    fitNoteTile(H, [ends.length ? Math.max(...ends) : 0], uiScale());
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
    if (!box) return;                              // a fixed block with no place this pass (the room tile)
    rects[b.cls] = box;
    out.push({ cls: b.cls, sel: b.sel, fixed: Boolean(b.fixed), solid: Boolean(b.solid),
      x: box.x, y: box.y, w: box.w, h: box.h, el: list[0] ?? null, els: list, r });
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
  for (const sel of ["#drpg-despair", "#drpg-events", "#drpg-hud", "#drpg-room-tile", "#drpg-player-status", "#countdowns", "#drpg-voice-tile"]) {
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
  const TONE = { hud: "#0d0b16", rail: "#3a1230", event: "#33102a", three: "#12204d", tray: "#281448", "note-block": "#33102a", "room-block": "#0d0b16", "voice-block": "#0d0b16", "tiles-row": "#0d0b16", launch: "#0d0b16" };
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
  const railBox = (host, cv, W, sel, side, fallback) => {
    const rail = columnRail(sel, host);
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
    /* The GM button rode this shard over the tiles from 07.09 until E77 C6 moved it into the
       corner; the band starts at the first tile again. */
    const top = btns.length ? Math.min(...btns.map(e => e.getBoundingClientRect().top)) : r.top;
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

       The band exists to hold the tiles, which are measured; the padding under the last tile
       is not part of them. `top` is the first tile's, so this is the other end of the same
       reading. */
    const tilesBottom = btns.length
      ? Math.max(...btns.map(e => e.getBoundingClientRect().bottom))
      : (r.top + rail.offsetHeight);
    /* AND TO THE FOOT OF THE BOX, which `moduleLayout` now bounds to exactly the run the
       longest tools menu can take (22.09). The tiles on screen are one control's; the glass
       is cut once, so it has to cover where ANY control's tools can reach - measured on
       1.2.49, Regions' thirteen ran 110 px past a strip cut while the tokens were open. */
    const wantH = Math.max(Math.max(tilesBottom, side ? 0 : r.bottom) - top, btns.length * 1);
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
      /* THE HEIGHT THE TOOLS WRAP IN, NOT THE HEIGHT THE TILES SHOWN RIGHT NOW TAKE (22.09).
         A tools menu wraps when it runs out of its box, and the box is the bound
         `moduleLayout` gave it - from the first tile to the box's foot. Read off the tiles
         instead, a player's three layers (114 px at 1920x1080) sized the reserve for
         Drawings' eight tools at four columns beside them, and the strip ran 142 px past
         the last tile ("za szeroka", Dawid) while the menu, given its 270 px, wraps them
         into two. The longer of the two readings, so a box shorter than its own tiles
         cannot shrink the reserve below what is already on screen. */
      const run = Math.max(wantH, r.bottom - top);
      const fit = Math.max(1, Math.floor((run + gap) / Math.max(1, pitch)));
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
                clear of the row; above it stays 14, where the GM button needed it tight until E77 C6. */
             coreY: [(top - o.top) / s - 14, (top - o.top) / s + wantH / s + 34],
             origin: [(c0 + c1) / 2 * s + o.left - r.left, (y0 + y1) / 2 * s + o.top - r.top] };
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
    // elements gets inline styles, because each has its own origin
    const turn = Math.abs(phi) < 0.004 ? "none" : "rotate(" + phi + "rad)";
    /* THE VOICE TILE IS THE TRAY COLUMN'S TAIL (E78 C6). It takes no part in the column's tilt or
       width - those are the tray's and the status strip's, as they were before it - and is settled
       against them here: its x against the turn, its height against the corner's pane under it
       (`settleVoice`). It turns with the column like every fixed block. */
    const tail = c.tail ? (c.tail = settleVoice(c.tail, W, { px, py, cs, sn }, c.floor ?? H)) : null;
    if (tail) {
      /* `lift`: how far over the tile's top the seam with the tray's pane runs, in the tile's own turned frame -
         half the gap from the tray's box to the tile (the seam's rule below), 12 px with the tray at its five
         rows and more with fewer. The buttons stand on the pane by it (E78 fix r2-H3, stained-glass.css). */
      const tray = c.items[c.items.length - 1];
      VOICE.box = { x: tail.x, y: tail.y, w: tail.w, h: tail.h, fit: tail.fit, lift: Math.max(0, (tail.y - (tray.y + tray.h)) / 2) };
      ROT.push({ sel: tail.sel, el: null, origin: (px - tail.x) + "px " + (py - tail.y) + "px", transform: turn });
    }
    for (const b of c.items) {
      /* A FIXED BLOCK IS STILL A BLOCK ON THE GLASS. Its box is a constant - the notice tile is
         cut once and never recut, whatever arrives in it - but its element must still turn with
         its pane, or the cards stand upright inside a tilted piece of glass (1.2.38). The rule
         is keyed to the SELECTOR and computed from the fixed box, so it holds even though the
         element is not measured and may not exist yet. Since E81 C8 popup.mjs builds the tile at
         `ready`, with the history's button in its corner and before the glass is cut, but the rule
         does not lean on that: a tile removed and rebuilt by `container()` turns all the same. */
      if (b.fixed) { ROT.push({ sel: b.sel, el: null, origin: (px - b.x) + "px " + (py - b.y) + "px", transform: turn }); continue; }
      if (!b.el) continue;
      for (const e of b.els) {
        const er = e.getBoundingClientRect();
        ROT.push({ sel: b.els.length === 1 ? b.sel : null, el: e, origin: (px - er.left) + "px " + (py - er.top) + "px", transform: turn });
      }
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
    const tray = c.items[c.items.length - 1];
    const Yseam = tail ? ((tray.y + tray.h) + tail.y) / 2 - py : null, Xc = tail ? tail.x - px - PAD_SIDE : null;
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
    for (let m = 0; m + 1 < c.items.length && piece; m++) {
      const up = c.items[m], dn = c.items[m + 1];
      if (dn.y < up.y + up.h - 12) continue;                 // blocks that truly overlap share one pane; a touch does not
      const Ydiv = ((up.y + up.h) + dn.y) / 2 - py;
      const pt = rot(0, Ydiv);
      const [below, above] = split(piece, pt[0], pt[1], -sn, cs);
      const sec = push(above, up.cls, "section", 0); if (sec) sec.empty = !up.r && !up.solid; piece = below;
    }
    let below = null;
    if (tail && piece) { const pt = rot(0, Yseam); [below, piece] = split(piece, pt[0], pt[1], -sn, cs); }
    c.pane = push(piece, c.items[c.items.length - 1].cls, "section", 0);
    if (c.pane) c.pane.empty = !c.items[c.items.length - 1].r && !c.items[c.items.length - 1].solid;
    /* Under the seam the voice tile's pane runs from PAD_SIDE left of the tile to the wall, and what
       is left of it is cut away and not pushed: bare map, the area `voice-left`, which the
       self-check keeps empty of every pane (Q16). */
    if (below) {
      const q = rot(Xc, Yseam);
      const [right, left] = split(below, q[0], q[1], cs, sn);
      push(right, tail.cls, "section", 0);
      if (left) OPEN_AREAS.push({ name: "voice-left", poly: left });
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
    const { W, H, rnd, panes, push } = ctx;
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
   * more. The character has to come from where there is room for it - the field
   * below the stack, which on a phone in portrait is most of the screen, and the
   * strips down the two rails. Horizontal slabs at the top and broken glass below
   * is what a tall screen looks like, and pretending otherwise means cutting
   * through the clock.
   *
   * Nothing here leans a block: `ROT` is left empty, so `applyRotations` writes an
   * empty sheet and every block stands upright. A full-width pane has nowhere to
   * lean to.
   */
  function stackShapes(host, W, H, rnd, boxes) {
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
    const column = host.querySelector(COLUMN_SEL);
    const inStack = b => Boolean(column) && (b.els ?? []).some(e => column.contains(e));
    let rows = boxes.filter(b => b.r && (b.w > W * 0.5 || inStack(b))).sort((p, q) => p.y - q.y);
    const loose = boxes.filter(b => !rows.includes(b) && b.r);

    /* AND A ROW SCROLLED OUT OF THE STACK HAS NO GLASS.
       The stack has a ceiling and scrolls past it, and a block scrolled under that
       ceiling still reports the position it is LAID OUT at - `getBoundingClientRect`
       knows nothing about the clip above it. A pane cut there is a pane cut over the
       board, with the block it was cut for nowhere near it: four blockFails at 620 px
       of height, twenty at 640 x 360, measured. Every row is cut down to the part of
       it the stack actually shows, and a row with nothing left is not a row. */
    const frame = document.getElementById("drpg-curtain")?.getBoundingClientRect();
    const seen = host.querySelector(COLUMN_SEL)?.getBoundingClientRect();
    if (seen) {
      const lo = seen.top - (frame?.top ?? 0), hi = seen.bottom - (frame?.top ?? 0);
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

    /* 4. the field below the stack, where there is room to break the glass. The rails'
       bands first - the strip down each wall is the piece between the wall and the
       band's inner edge, and the tiles stand on it the way they do on a desk - then a
       few long diagonals across what is left, and a band along the bottom edge. */
    /* THE FIELD BEGINS AT THE HIGH END OF THAT SEAM, NOT AT ITS MIDDLE.
       The seam leans, so the piece under it starts `rise` px above the y the cut was
       made at. Tested against the middle, every piece of the field failed the test and
       not one of the cuts below was made: the field came out as two enormous panes and
       the rails got no strip (measured 13.09 - 13 panes, one of them a fifth of the
       screen and painted as a stained one). */
    const fieldTop = yBase - rise - 1;
    const inField = p => bbox(p).y0 >= fieldTop;
    const cv = host.querySelector(".curtain > canvas.sg, #drpg-curtain > canvas.sg");
    const bands = [
      railBox(host, cv, W, "#scene-controls", 0, null),
      railBox(host, cv, W, "#sidebar-tabs", 1, null)
    ];
    for (const band of bands) {
      if (!band || band.real === false || !Number.isFinite(band.band)) continue;
      cut(band.band, yBase, Math.PI / 2, inField);
    }
    const fieldH = H - yBase;
    if (fieldH > 120) {
      for (const at of [0.34 + rnd() * 0.1, 0.66 + rnd() * 0.1]) {
        const ang = (rnd() < 0.5 ? -1 : 1) * (16 + rnd() * 16) * DEG;
        cut(W / 2, yBase + fieldH * at, ang, inField);
      }
    }
    if (fieldH > 260) {
      const ang = Math.PI / 2 + (rnd() - 0.5) * 0.5;
      cut(W * (0.3 + rnd() * 0.4), yBase + fieldH / 2, ang, p => bbox(p).y0 >= fieldTop + fieldH * 0.15);
    }

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
      bot: [], rings: [], tiles: {}
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
  function curtainShapes(host, W, H, rnd, boxes, FW) {
    VOICE.box = null; OPEN_AREAS.length = 0;
    // a stacked layout is a different shape and gets a different cut; see stackShapes
    if (narrowLayout()) return stackShapes(host, W, H, rnd, boxes);
    return deskShapes(host, W, H, rnd, boxes, FW);
  }
  /* the desk's cut, on its own since E78 C6 so `cutBoxes` can ask for it on a screen the
     harness lays out 1024 px wide, which is a stacked one */
  function deskShapes(host, W, H, rnd, boxes, FW) {
    const panes = [];
    /* what every cutter reads and writes: the panes so far, the frame, the seed's
       stream, the rails' bands once they are measured, and the needles placed */
    const ctx = { panes, W, H, FW, rnd, railBands: null, needles: [] };
    ctx.push = (poly, tone, kind, rank) => pushPane(ctx, poly, tone, kind, rank);

    /* the voice tile is not a column's member by its midpoint: it is the tray's column's tail */
    const voice = boxes.find(b => b.cls === "voice-block") ?? null, banded = boxes.filter(b => b !== voice);
    /* THE BANDS SPLIT WHAT STANDS OVER THE CAMERA DOCK (E19 fix r1-G2, 19.10.2026). A shown dock lifts
       the corner's buttons by its height (`--drpg-av-lift`, `avLift`), and on a short screen that put a
       GM's corner over the screen's middle: at 1366x560 under a 200 px dock it joined the tray's column
       in the top band, turned 8 degrees about that column's top corner, and the turn carried the gear
       and the book 29 and 36 px back down into the dock (Chromium, the glass harness; the sweep's dock
       check). The middle is the middle of the screen over the dock; with no dock it is H / 2, as before. */
    const mid = (H - Math.min(avLift(), H / 2)) / 2;
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
    const cv = host.querySelector(".curtain > canvas.sg, #drpg-curtain > canvas.sg");
    const railBands = {
      left: railBox(host, cv, W, "#scene-controls", 0, null),
      right: railBox(host, cv, W, "#sidebar-tabs", 1, null),
    };
    ctx.railBands = railBands;
    /* THE BOTTOM BAND IS CUT FIRST AND FILED SECOND (E78 C6). The voice tile's foot is settled
       against the corner's pane, which only exists once the bottom columns are cut; the panes are
       put back in the order they were always in, top first, so nothing painted per pane moves. */
    bot.forEach(c => buildColumn(ctx, c, bot, "bottom"));
    const cutFirst = panes.splice(0);
    const trayCol = voice ? top.find(c => c.items.some(b => b.cls === "tray")) : null;
    if (trayCol) { trayCol.tail = voice; trayCol.floor = voiceFloor(bot, voice, W, H); }
    top.forEach(c => buildColumn(ctx, c, top, "top"));
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
  /* THE CUT, FOR A TEST THAT HAS NO CANVAS (E78 C6, 14.10.2026; R545).
     jsdom lays nothing out, so the curtain never cuts headless - `curtainGeometry` stops at a
     canvas 0 px wide - and "the voice tile is always cut" would be a test skipped everywhere it
     runs but a browser. This hands the desk's cut (`deskShapes`, whatever the screen is) the boxes a test names (the shape of
     `LAST.blocks`, each given its BLOCKS entry's selector), on a host with no rails, and gives
     back the panes, the voice tile's settled box and the areas left open. What it changes on the
     way - the rotations, the voice box, the open areas - is put back, so a cut on the screen
     keeps its own. */
  export function cutBoxes(W, H, boxes, seed = 1) {
    const rot = ROT.splice(0), voice = VOICE.box, open = OPEN_AREAS.splice(0);
    try {
      const given = boxes.map(b => ({ sel: BLOCKS.find(k => k.cls === b.cls)?.sel ?? null, ...b }));
      VOICE.box = null; OPEN_AREAS.length = 0;
      const panes = deskShapes(document.createElement("div"), W, H, rng(seed), given, W);
      return { panes, voice: VOICE.box && { ...VOICE.box }, open: OPEN_AREAS.map(a => ({ ...a })), rotations: ROT.map(r => ({ sel: r.sel, origin: r.origin, transform: r.transform })) };
    } finally {
      ROT.length = 0; ROT.push(...rot); VOICE.box = voice; OPEN_AREAS.length = 0; OPEN_AREAS.push(...open);
    }
  }
  function curtainGeometry(job) {
    const el = job.el, host = document, c = el.querySelector("canvas.sg");
    if (!c || c.clientWidth < 10) return false;
    /* THE WIDTH IS PUT BACK BEFORE IT IS READ, OR THE FRAME IS LAST PASS'S (16.09).
       -----------------------------------------------------------------------
       The curtain's own box in viewport pixels - it is a fixed child of the body
       with `inset: 0; width: 100vw`, so that is the viewport - and never the
       canvas's client size, which a zoomed ancestor would inflate.

       But the line at the end of this paragraph writes `width` back in pixels,
       so on every pass AFTER the first, the element is wearing a number this
       function put there, and reading it asks the last cut how wide the screen
       is. Resizing the window then changed nothing: measured in Chromium
       (audit/glass-harness.html), 1280 -> 1440 left the frame at W = 1280, the
       curtain 160 px short of the right wall and the self-check counting the
       bare strip (edgeGaps 2 at +160, 4 at +320). It corrected itself only when
       something else happened to resize the element.

       Putting the stylesheet's own value back first costs one assignment. It is
       `100vw` rather than "" because the inline STYLE is what states this box at
       all - the sheet only gives the curtain its material. */
    el.style.width = "100vw";
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
    /* THE BLOCKS ARE PART OF THE SIGNATURE, NOT ONLY THE FRAME.
       A block that MOVES without changing size - the right-hand column sliding over when the
       sidebar collapses, the tray folding, the Event panel arriving - left the signature at
       the same "W x H" and the glass was never recut. Measuring the layout first costs eight
       rectangles and settles it. */
    const boxes = moduleLayout(W, H);
    const sig = W + "x" + H + "|" + boxes.map(b => b.cls + Math.round(b.x) + "," + Math.round(b.y) + "," + Math.round(b.w) + "," + Math.round(b.h)).join(";");
    /* THE SAME LAYOUT COSTS THE MEASUREMENT AND NOTHING ELSE - and for a year it cost
       everything, because `rebuildAll` wrote `j.sig = null` one line before calling this and
       no signature ever matched. Four comments in this file said the fast path was taken; it
       was unreachable. Measured in Chromium at 1920x1080, 33 panes: a rebuild that changed
       nothing was 21 ms of blocking JS, and `refreshGlass` is called on every DOM change in
       Foundry's columns, every resize of a block, every `canvasReady` and every return to the
       tab - so during play those 21 ms landed several times a minute for no drawn pixel.
       The check is republished rather than left behind: `rebuildAll` reads `check.same` to
       decide whether to paint, and an empty CHECKS reads as "changed" and repaints the lot.
       Everything in it but `same` is the last real pass's reading, which is still the truth
       about the cut now on the screen - the geometry is what has just been found identical. */
    if (job.sig === sig) {
      applyRotations();   // `moduleLayout` switched the rotations off to measure
      if (job.check) CHECKS.push({ ...job.check, same: true });
      return true;
    }
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
    for (const [sel, side] of [["#scene-controls", "left"], ["#sidebar-tabs", "right"]]) {
      // a rail in one of the GM's Foundry windows (E77 C5) is not turned: it stands on no shard
      const tile = columnRail(sel, host); if (!tile || !tile.offsetWidth) continue;
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
         middle of the band, a good 50 px right of the wall they belong against ("mialy byc pod
         gm panel", 07.09). It keeps Foundry's own place at the wall and only the wall clamp
         applies; the band is anchored to the same wall, so the tiles sit at its edge. */
      const kids = tileButtons(tile).map(e => e.getBoundingClientRect());
      const own = tile.getBoundingClientRect();
      const tileLocal = kids.length ? [
        Math.min(...kids.map(q => q.left)) - own.left, Math.min(...kids.map(q => q.top)) - own.top,
        Math.max(...kids.map(q => q.right)) - own.left, Math.max(...kids.map(q => q.bottom)) - own.top] : null;
      ROT.push({ sel, el: tile, rail: true, pane: sel === "#scene-controls" ? null : (t[side]?.box ?? null), tileLocal,
                 pageLeft: own.left, pageTop: own.top,
                 origin: o ? Math.round(o[0]) + "px " + Math.round(o[1]) + "px" : "50% 50%",
                 transform: ang ? "rotate(" + ang + "rad)" : "none" });
    }
    applyRotations();
    // self-check: C1 no overlaps, convexity, C2 every block inside its own pane and no other, C3 the top edge covered
    let ov = 0, nonconvex = 0, blockFails = 0, edgeGaps = 0, fitFails = 0, openFails = 0; const ncv = [];
    for (let i = 0; i < panes.length; i++) { if (!convex(panes[i].poly)) { nonconvex++; ncv.push(panes[i].kind + ':' + panes[i].poly.map(q => q.map(v => Math.round(v)).join(',')).join(' ')); } for (let j = i + 1; j < panes.length; j++) if (overlaps(panes[i].poly, panes[j].poly)) ov++; }
    for (const col of [...panes.meta.top, ...panes.meta.bot]) for (const b of col.tail ? [...col.items, col.tail] : col.items) {
      /* THE BLOCK'S OWN PANE, NOT ITS COLUMN-MATE'S.
         This used to accept a pane toned for ANY member of the merged column, so a block that
         had been absorbed into a neighbour's pane and lost its own passed the check by standing
         inside the neighbour's glass. That is exactly the failure this check exists to catch,
         and it is why the Despair rail could lose its pane on a narrow screen and report clean. */
      const own = panes.filter(p => p.content && p.tone === b.cls);
      if (b.r && !b.clipped && (b.r.x < b.x - 0.5 || b.r.y < b.y - 0.5 || b.r.x + b.r.w > b.x + b.w + 0.5 || b.r.y + b.r.h > b.y + b.h + 0.5)) fitFails++;
      const qs = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => col.rot(x - col.px, y - col.py)).filter(q => q[0] > 1 && q[0] < W - 1 && q[1] > 1 && q[1] < H - 1);
      for (const q of qs) {
        if (!own.some(p => inside(p.poly, q[0], q[1]))) blockFails++;
        if (panes.some(p => !own.includes(p) && inside(p.poly, q[0], q[1]))) blockFails++;
      }
    }
    const cover = (x, y) => panes.some(p => inside(p.poly, x, y));
    for (let x = 4; x < W; x += 8) { if (!cover(x, 0.5)) edgeGaps++; if (!cover(x, H - 0.5)) edgeGaps++; }
    for (let y = 4; y < H; y += 8) { if (!cover(0.5, y)) edgeGaps++; if (!cover(W - 0.5, y)) edgeGaps++; }
    /* C4 (E78 C6): an area the cut leaves open on purpose holds no glass - `voice-left`, Q16. Every
       8 px inside it, 3 px clear of its edges, where a seam is shared with the panes around it. */
    const clear = (P, x, y) => P.every((a, i) => { const b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return Math.abs((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / L > 3; });
    for (const o of OPEN_AREAS) {
      const bb = bbox(o.poly);
      for (let x = Math.ceil(bb.x0); x < bb.x1; x += 8) for (let y = Math.ceil(bb.y0); y < bb.y1; y += 8)
        if (inside(o.poly, x, y) && clear(o.poly, x, y) && panes.some(p => inside(p.poly, x, y))) openFails++;
    }
    CHECKS.push({ seed: job.seed, count: panes.length, overlaps: ov, nonconvex, ncv, blockFails, edgeGaps, fitFails, openFails, sig: d.length, same });
    // kept on the job so a pass that finds the same signature can republish it rather than
    // cut the whole partition again only to say what this one already says (see above)
    job.check = CHECKS[CHECKS.length - 1];
    // every pane, for `drpgGlassDebug()`: what was cut, and where
    /* `poly` as well as the bounding box: the rails are not blocks, so the self-check below
       says nothing about whether the scene tiles sit inside one pane - only a point-in-polygon
       test against the real shapes does, and that is what the tile-containment probe runs.
       A bounding box cannot answer it: the panes lean, so their boxes overlap even when the
       panes do not. Nothing is printed from here - `debugGlass` maps these to tone strings. */
    LAST.panes = panes.map(p => { const bb = bbox(p.poly); return { kind: p.kind, tone: p.tone || null, plain: !!p.plain, shard: !!p.shard, empty: !!p.empty, poly: p.poly, x0: Math.round(bb.x0), y0: Math.round(bb.y0), x1: Math.round(bb.x1), y1: Math.round(bb.y1) }; });
    LAST.voice = VOICE.box && { ...VOICE.box };
    LAST.open = OPEN_AREAS.map(o => ({ name: o.name, poly: o.poly }));
    seatVoiceTile(VOICE.box);
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
    count("glass.pulseFrame");
    for (const j of [...curtains, ...windows]) {
      if (!j.pulse || !j.panes || !j.el.isConnected) continue;
      count("glass.pulseFrame.panes", j.panes.length);
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
/*
 * A SCREEN CAN BE TOO SMALL FOR GLASS, AND THIS IS WHERE THE CURTAIN ADMITS IT.
 *
 * There are two partitions now - the desk's (`curtainShapes`) and the stack's
 * (`stackShapes`) - and between them they cover every width measured, down to
 * 280 px, with no overlap, no gap at the screen edge and every block on its own
 * pane. What neither can answer is a screen with no HEIGHT.
 *
 * The stack has a ceiling and scrolls past it, and a block scrolled under that
 * ceiling still reports the position it is laid out at. `stackShapes` cuts its
 * rows down to what the stack actually shows, which holds while there is something
 * left to show; under about 620 px of height there is not, and the launchers
 * standing in the bottom corner come up into the stack besides (measured at
 * 980 x 386 and 640 x 360: blocks off their pane and the tray off the screen).
 *
 * HEIGHT ONLY MATTERS TO THE STACK, so this is the two conditions together and not
 * the height on its own. A wide short window - 1600 x 600 - keeps Foundry's three
 * columns, has no stack to scroll and no collisions to fix, and the desk partition
 * cuts it exactly as it cuts 1600 x 900.
 *
 * So on a stacked layout under that height the curtain does not draw at all. The theme keeps its palette, its
 * type and its blocks - which get their own plates back, because those are only
 * turned off by `drpg-curtain-on` - and the body carries `drpg-glass-flat` for the
 * flat backdrop in stained-glass.css. Nothing is left running: with no curtain and
 * no dressed windows the pulse repaints nothing, which was the other half of the
 * complaint (14 frames a second in portrait).
 */
function glassRoom() { return themeOn() && !(narrowLayout() && shortScreen()); }
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
  document.body.style.removeProperty(LAUNCH_CLEAR);
  restoreLid();
  document.querySelectorAll("#scene-controls, #sidebar-tabs").forEach(e => { e.style.transform = ""; e.style.transformOrigin = ""; });
  BLOCKS.forEach(b => document.querySelectorAll(b.sel).forEach(e => { e.style.transform = ""; e.style.transformOrigin = ""; }));
  document.body.classList.remove("drpg-curtain-on");
  document.body.removeAttribute("data-drpg-turning");
  // the room tile back under the clock at the sheet's height, its picture back in it (E77 C4)
  ROOM.place = ROOM.box = null; LAST.room = null;
  seatRoomTile(document.getElementById("drpg-room-tile"), null);
  seatRoomArt();
  // and the voice tile back to its sheet's place, its portrait back in its face (E78 C6)
  VOICE.box = null; LAST.voice = null; OPEN_AREAS.length = 0;
  seatVoiceTile(null);
  seatVoiceArt();
  seatNoteFrame();
  globalThis.Hooks?.callAll?.("drpgGlassCut", { room: null });
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
/* `painted` is asked for rather than read off the job: the one caller takes this AFTER the new
   cut has been made, and a new cut has already set `j.painted` false (see `rebuildAll`). */
function snapshotLook(j, painted = j.painted) {
  if (!j.panes || !painted) return null;
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
  try { rebuildAll(); } finally { if (document.body.hasAttribute("data-drpg-measuring")) measuring(false); }
}
function rebuildAll() {
  for (const j of curtains) {
    const wasPainted = j.painted, oldAcc = j.acc;
    const oldPanes = wasPainted ? snapshotPanes(j) : null;
    CHECKS.length = 0;
    if (curtainGeometry(j)) {
      // Foundry's tiles must start below the corner panes to own a shard of the strip;
      // when they do not, push them down once and cut the glass again
      if (!j.placed && placeTiles()) { j.placed = true; j.sig = null; curtainGeometry(j); }
      const acc = resolveAcc(j.el);
      const check = CHECKS[CHECKS.length - 1];
      const changed = !wasPainted || !check?.same || acc !== oldAcc;
      if (changed) {
        /* THE GHOST THE MORPH CROSSFADES FROM, TAKEN HERE RATHER THAN AT THE TOP OF THE PASS.
           Two full-screen canvases - 1920x1080 plus the glow's half-size copy, about 10 MB of
           backing store - were allocated, blitted into and dropped again on every rebuild, and
           most rebuilds change nothing. Measured in Chromium: 6.5 ms of the 21 ms a no-change
           pass cost, and the garbage they made on top of that.
           SAFE TO TAKE LATE, because nothing between the top of this loop and this line paints
           the curtain: `curtainGeometry` measures the blocks, cuts the partition and writes the
           rotation sheet, and `placeTiles` writes padding onto Foundry's rails. The pixels
           caught here are the pixels that were on the screen when the pass began.
           The gate is `oldPanes` and not `j.painted`: an identical cut leaves `painted` alone,
           but a new one has already set it false by the time we are here, and the ghost is
           exactly what the new cut is supposed to fade in over. */
        const oldLook = oldPanes && !REDUCED() ? snapshotLook(j, oldPanes) : null;
        const oldGlow = oldLook ? snapshotCanvas(document.querySelector('[data-glow="' + j.seed + '"]')) : null;
        /* `toggle(name, true)`, NOT `add(name)`, AND THE DIFFERENCE IS NOT STYLE.
           Measured in Chromium: `classList.add` of a token that is already there queues a
           MutationRecord anyway, and so does `remove` of one that is not - they run the
           update steps unconditionally - while `toggle` with a force argument short-circuits
           and queues nothing. This line runs on every rebuild and the class is already on by
           the second one, so it was waking all three of the module's body observers (this
           file's state change, fog.mjs's room outline, remnant-ring.mjs's repaint of every
           token on the canvas) for an attribute that did not move. Same at the sibling line
           below, and in `repaintFog` (fog.mjs), which is the other one in a hot path. */
        curtainPaint(j); document.body.classList.toggle("drpg-curtain-on", true);
        const gl = document.querySelector('[data-glow="' + j.seed + '"]');
        if (gl) gl.style.cssText = STYLE + "z-index:" + j.el.style.zIndex + ";mix-blend-mode:screen;width:" + j.W + "px;";
        morph(j, oldPanes, oldAcc, oldLook, oldGlow);
        /* A NEW CUT, AND ONLY A NEW CUT, IS ANNOUNCED (E77 C4). The room tile's picture follows
           its pane here, and `drpgGlassCut` is what a test counts to say that a new description,
           a new picture or the description opened recut nothing: a recolour of the same cut and
           the fast path of an identical one fire nothing. */
        if (!wasPainted || !check?.same) {
          seatRoomArt();
          seatVoiceArt();
          seatNoteFrame();
          globalThis.Hooks?.callAll?.("drpgGlassCut", { room: LAST.room ? { ...LAST.room } : null });
        }
      } else { j.painted = true; document.body.classList.toggle("drpg-curtain-on", true); }
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
/** The tiles shown in a rail: Foundry's `button.ui-control`s (v13+), any earlier markup's `.control`s. */
function tileButtons(rail) {
  return [...rail.querySelectorAll("button.ui-control, .ui-control, .control")].filter(e => e.offsetWidth > 0 && e.offsetHeight > 0);
}
/* NOTHING TO PLACE ONCE THE RAILS ARE BLOCKS.
   An older version pushed a rail down with `padding-top` until it stood under the shard cut
   for it, which fed a measured position back into the thing being measured (see the note
   inside `moduleLayout` on where the push is computed now). All that is left to do is clear
   the padding that version may have left on the element, once. */
function placeTiles() {
  let moved = false;
  const side = document.querySelector("#sidebar");
  if (side && side.style.paddingTop) { side.style.paddingTop = ""; moved = true; }
  const left = document.querySelector("#scene-controls");
  if (left && left.style.paddingTop) { left.style.paddingTop = ""; moved = true; }
  return moved;

}

/** A one-line account of the curtain for the Look dialog: frame, panes, the self-check, the tiles. */
export function glassReport() {
  const j = curtains[0], c = CHECKS[0];
  // and it says WHY there is no curtain, because "no curtain mounted" on a phone is the
  // gate doing its job and reads in the Look dialog like a fault
  if (!j) {
    if (!themeOn()) return "theme off";
    if (narrowLayout() && shortScreen()) return "flat: the stack scrolls at " + innerHeight
      + " px of height, under the curtain's " + BREAKPOINTS.short;
    return "no curtain mounted";
  }
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
  count("glass.paintBand");
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
  /* THE FLASH MEANS "THE GLASS HAS JUST SET", SO IT HAPPENS ONCE.
     `dressWindow` is on `renderApplicationV2`, which fires on every REDRAW of a window as
     well as on its first render - a module panel redraws on every clock write, every Despair
     change, every message; the character sheet on every Hope spent and every item added. The
     repaint and the flash sat outside the block that makes the canvas, so each of those recut the band
     with `windowShapes`, ran `paintGlass` over it again (the ink texture is drawn into a
     fresh offscreen canvas per stained pane), and started another 420 ms animation that
     strokes every seam of the band on every frame. With several windows open those flashes
     overlap, which is why a busy screen shone rather than sat still.
     A REDRAW STILL REPAINTS WHEN IT HAS TO, and only then: the band's box changing (a window
     dragged wider) and the state's colour changing are the two things the painted glass
     depends on, and both are asked rather than assumed. The colour has a second road in
     through `onStateChange`, which repaints bands after the token has finished fading; this
     one catches a window that is redrawn in the middle of that.
     AND "FRESH" IS ABOUT THE GLASS, NOT ABOUT THE JOB: a band whose canvas has gone - a window
     that redrew its own header in place, a third party tidying the DOM - has a job with
     nothing under it, and the repaint below would find no canvas and stand down forever.
     Asking for the canvas rather than for the job costs one selector and closes that. */
  const fresh = !job || !band.querySelector(":scope > canvas.sg");
  if (fresh) {
    if (job) job.panes = null;
    else { job = { el: band, seed: seedBase + windows.length * 37 }; windows.push(job); }
    if (!band.querySelector(":scope > canvas.sg")) {
      const c = document.createElement("canvas"); c.className = "sg"; band.prepend(c);
    }
  }
  requestAnimationFrame(() => {
    if (fresh) { paintBand(job); flashSeams(job, job.acc || "#f2eee6", 420); return; }
    // the same two numbers `paintBand` would give the canvas, so this compares like with like
    const W = Math.max(60, Math.round(job.el.clientWidth));
    const H = Math.max(24, Math.round(job.el.clientHeight));
    // E88 C4: a redraw that finds the band's box and colour as painted, counted (`fps()`, scenario 86).
    if (job.W === W && job.H === H && resolveAcc(job.el) === job.acc) { count("glass.paintBand.kept"); return; }
    paintBand(job);
  });
  return job;
}
/** Every module window (`.drpg-panel`) gets glass on its header band, the character sheet on its
    header; called from renderApplicationV2. */
export function dressWindow(app) {
  if (!glassRoom()) return;
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
  /* AN ATTRIBUTE, FOR THE REASON `measuring` IS ONE: this rides on the body for the length of
     the turn and the three body observers were filtering on `class`, so the turn woke each of
     them twice more than the state change that caused it. Measured: one change of the hour was
     three wake-ups - the real one, the one from adding this, the one from taking it away - and
     each of the three walks every token on the canvas (remnant-ring.mjs). One now. */
  document.body.toggleAttribute("data-drpg-turning", true);
  clearTimeout(turningTimer); turningTimer = setTimeout(() => document.body.removeAttribute("data-drpg-turning"), TURN() + 120);
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

/* `refreshGlass` rather than `rebuild`: a resize can cross the curtain's gate, and then
   there is nothing to rebuild - the curtain has to go, or come back. With one mounted it
   still ends in `rebuild`, and an unchanged signature costs one measurement of the blocks -
   not the partition, not the self-check and no paint (see the fast path in `curtainGeometry`). */
const schedule = () => { clearTimeout(timer); timer = setTimeout(() => refreshGlass(), 150); };
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
       to capacity - but it does move the tiles inside their band. Re-applying the rotation rules
       is a few string writes and no geometry at all. */
    /* ...and once per frame (UI-16): a tool palette opening resizes the rail several times in
       one tick, and each notification was a synchronous `applyRotations` with its forced layouts. */
    let railFrame = 0;
    const rr = new ResizeObserver(() => {
      if (railFrame) return;
      railFrame = requestAnimationFrame(() => {
        railFrame = 0;
        try { applyRotations(); } catch { /* between rebuilds */ }
      });
    });
    for (const sel of ["#scene-controls", "#sidebar-tabs"]) {
      const e = columnRail(sel); if (e) rr.observe(e);
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

/** Whether anything of the curtain is currently on the page. */
function anythingMounted() {
  return curtains.length > 0 || windows.length > 0 || document.body.classList.contains("drpg-curtain-on");
}

/** Mount or unmount the curtain according to the theme setting and the screen's room. */
export function refreshGlass() {
  document.body.classList.toggle("drpg-glass-flat", themeOn() && !glassRoom());
  // `unmount` only when there is something to take down: this runs on every DOM
  // mutation through `schedule`, and it walks the document clearing styles
  placeFlatRoomTile();
  if (!glassRoom()) { if (anythingMounted()) { unmount(); placeFlatRoomTile(); } return; }
  if (curtains.length) { rebuild(); return; }
  const go = () => { mount(); observe(); };
  (document.fonts?.ready ?? Promise.resolve()).then(go, go);
}

/** Called once at ready. */
export function registerGlass() {
  refreshGlass();
  if (!raf) raf = requestAnimationFrame(loop);
  /*
   * A BLOCK THAT LEAVES WHILE NOBODY IS LOOKING TAKES ITS PANE WITH IT, and
   * until this line the pane stayed behind (Dawid, 14.09).
   *
   * Measured: the Event panel is up, the tab is switched away or the window
   * minimised, the incident ends and `renderEvents` removes the panel. The DOM
   * observer does fire and does schedule a recut - but a hidden tab has a
   * canvas of zero width, so `curtainGeometry` stands down and paints nothing.
   * And the baseline the drift watch compares against is resampled by the frame
   * queued at the end of that pass, which runs the instant the tab comes back:
   * by the time anything looks, the new layout IS the baseline, no drift is
   * ever seen, and a pane of glass with its blur stands over nothing until
   * something else happens to recut the curtain.
   *
   * One line, and it covers every block rather than that one panel. `schedule`
   * is debounced and `rebuild` answers an unchanged signature with one
   * measurement of the blocks and nothing else,
   * so a tab switched to and fro costs nothing.
   */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && themeOn()) schedule();
  });
  // late blocks: the launchers and the tray arrive after ready on some clients; and a watchdog,
  // because a curtain that measured nothing (a hidden canvas, a frame of 0) must try again
  setTimeout(() => { if (glassRoom()) rebuild(); }, 1500);
  for (const ms of [4000, 9000]) setTimeout(() => {
    const j = curtains[0];
    if (!glassRoom()) return;
    if (!j || !j.painted || Math.abs(j.el.getBoundingClientRect().width - innerWidth) > 2) { log("curtain watchdog: rebuilding", glassReport()); if (j) j.placed = false; mount(); }
  }, ms);
  Hooks.on("canvasReady", schedule);
  /* The camera dock's lift changed (camera-view.mjs `measureCameraDock`, E19 fix r1-G2): the
     notice tile's foot stands on it (`gaugeFoot`), so the curtain is cut again; under Monokuma
     Legacy the room tile's floor is read through the same foot (`flatPlacement`), so in both themes. */
  addEventListener(AV_LIFT_EVENT, schedule);
  // the sidebar is deliberately NOT a signal: opening it moves nothing and recuts nothing
  // Debounced like everything else on resize: `rebuild` already pins the right column and
  // frees the board, and the raw handler did both on every event of a window drag.
  addEventListener("resize", () => { if (themeOn()) schedule(); flatSoon(); });
  Hooks.on("drpgHudRendered", flatSoon);
  Hooks.on("renderApplicationV2", dressWindow);
  Hooks.on("closeApplicationV2", pruneWindows);
  // the pause band is a pane of the curtain while the game is paused, breathing with the slow pulse
  Hooks.on("pauseGame", paused => {
    const band = document.getElementById("pause");
    if (!band || !glassRoom()) return;
    if (paused) { band.classList.add("drpg-glass-band"); dressBand(band, 777); }
    else { band.querySelectorAll(":scope > canvas").forEach(c => c.remove()); band.classList.remove("drpg-glass-band"); pruneWindows(); }
  });
  new MutationObserver(onStateChange).observe(document.body, { attributes: true, attributeFilter: ["data-drpg-phase", "data-drpg-time", "class"] });
}
