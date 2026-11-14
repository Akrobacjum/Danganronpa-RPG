/**
 * Where a block stands on the curtain cut (E54, the plan G5): the voice tile settled at its wall and under its
 * floor (`settleVoice`, with the VOICE_* measures) and the turn a block takes with its column (`blockTurns`). Moved
 * out of glass.mjs with the cut (glass-geometry.mjs, which reads both); a file of its own so that each function
 * still ends where it ended in glass.mjs - a test that cuts a function reads to the next one (tests-kit.mjs
 * `topLevelFunction`). A leaf: it imports nothing.
 */


export const VOICE_WIDE = 0.6, VOICE_TALL = 1.45, VOICE_SEAM = 24, VOICE_WALL = 6, VOICE_FOOT = 52;
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
/* THE TILE TURNS WITH ITS COLUMN, so its place is settled once the turn is known: the right column
   turns clockwise about its top left corner (sn >= 0, `buildColumn`), its top right corner is the
   one nearest the wall and its bottom right the lowest. x puts that top corner VOICE_WALL from the
   wall; the height is cut where the foot would come within VOICE_FOOT of `floor`, the top of the
   corner buttons' pane under it, but never under VOICE_MIN, and under VOICE_FULL the tile is compact. */
/* THE MIDDLE OF THE RIGHT SIDE (E96 C4, 09.11.2026; the owner on C3's picture: "Sam panel jest lepszy, ale jest za
   wysoko ... Ma byc jak na screenie, tylko nizej", and asked how much lower, "Srodek prawej strony"). The tile came
   down from under the tray's five rows (`voicePlacement`'s y, kept as `y0`) to where its turned box is centred on
   H / 2, never higher than `y0` (the tray's rows keep their room) and no lower than its foot allows (`floor`). x
   and the centre read each other through the turn, so the two are settled together; three passes move nothing
   after the second. `wall` is the x its top right corner stands VOICE_WALL from: the pin's (`voiceWall`, which
   `deskPage` reads for the cut), or the screen's own edge where `buildColumn` stands the tile under the tab rail's
   run. Every caller hands it (E54: it read `voiceWall(W)` itself when none was given, which put PIN in the cut). */
export function settleVoice(b, W, { px, py, cs, sn }, floor, H = Infinity, wall) {
  const y0 = b.y0 ?? b.y, full = Math.round(VOICE_TALL * b.w);
  const xAt = y => Math.floor(px + (wall - VOICE_WALL - px + (y - py) * sn) / cs - b.w);
  const hAt = (x, y) => Math.floor((floor - VOICE_FOOT - py - (x + b.w - px) * sn) / cs - (y - py));
  let y = y0;
  if (Number.isFinite(H)) for (let i = 0; i < 3; i++) {
    const x = xAt(y), X = x + b.w / 2 - px, Y = (H / 2 - py - X * sn) / cs;
    y = Math.max(y0, Math.round(py + Y - full / 2));
    const room = hAt(x, y);
    if (room < full) y = Math.max(y0, y - (full - room));
  }
  const x = xAt(y);
  const h = Math.max(VOICE_MIN, Math.min(full, hAt(x, y)));
  return { ...b, y0, y, x, h, fit: h < VOICE_FULL ? "compact" : "full" };
}

/* A BLOCK'S ENTRIES IN THE ROTATION TABLE, read off its box and its pane's pivot (`px`, `py`) by the column's tilt.
   THE CORNER'S BUTTONS TURN BY A RULE ON THEIR IDS (E23 C1d, 08.11.2026; the owner's 14.10: "the buttons in the
   bottom-right corner sometimes refresh and straighten for no reason, and then tilt again"). A union's members each turn
   about an origin of their own, so they were written an inline transform each (`sel: null`) - onto the element the last
   real recut measured. Read in Chromium on the glass harness (1366x768, a GM; each launcher's transform sampled every
   frame): turned through the load's rebuild, the watchdog's `mount`, a `refreshGlass`, a resize and back, a renderHud's
   refill and the notice tile rebuilt; straight in every frame once the buttons were re-created as their render
   functions re-create them (messenger-app.mjs `renderLauncher` on every message; the sound and handbooks buttons on
   `canvasReady`), and through a `refreshGlass` after that, until a real recut. The pass that straightens them is every
   pass over an unchanged cut: `moduleLayout` clears the inline transform of the element it finds - the new one - and the
   fast path's `applyRotations` writes the table back onto the old one, out of the page. So a member with an id takes a
   rule on its id, as every other block takes one on its selector, and a button made again wears it the moment it is in
   the tree; `part` keeps it out of the wall's shift (`railOverhang`), which these never took. A member with no id keeps
   the inline write. R1382. `rectOf` measures a member's box on the page (E54 G4c: `deskPage`'s, handed through the cut,
   so the cut reads no page itself; R4805). */
export function blockTurns(b, px, py, turn, rectOf) {
  if (b.fixed) return [{ sel: b.sel, el: null, origin: (px - b.x) + "px " + (py - b.y) + "px", transform: turn }];
  if (!b.el) return [];
  const one = b.els.length === 1;
  return b.els.map(e => {
    const er = rectOf(e), id = !one && e.id ? "#" + (globalThis.CSS?.escape?.(e.id) ?? e.id) : null;
    return { sel: one ? b.sel : id, el: e, part: Boolean(id), origin: (px - er.left) + "px " + (py - er.top) + "px", transform: turn };
  });
}
