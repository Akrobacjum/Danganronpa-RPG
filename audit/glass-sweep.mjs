/*
 * The glass harness at the 23 sizes, in Chromium: the curtain's self-check and the corner's
 * launchers, one line a size, and a non-zero exit when any size is not right.
 *
 *   cd audit/harness && npm ci        (once: Playwright comes from there; it downloads no browser)
 *   node audit/glass-sweep.mjs        (from the repository root)
 *
 * It serves the root itself the way "The curtain, without Foundry" in CLAUDE.md does
 * (`python3 -m http.server`, on a free port), or reads a server already running with
 * `--base http://127.0.0.1:8765`. Playwright finds its Chromium through
 * PLAYWRIGHT_BROWSERS_PATH; `--chromium <executable>` names one instead (written and run in a
 * container whose Chromium is /opt/pw-browsers/chromium, 13.10.2026).
 *
 * WHY THIS FILE EXISTS (E81 fix r2-H3, 13.10.2026). E81 C14 measured the corner at these sizes
 * with a sweep that lived in a scratch folder, so its numbers could not be run again by anybody
 * (review round 2, P26). This is that sweep, committed beside the page it drives. Each size is a
 * fresh load, as the E81 mockup's notes measured, in both themes by default.
 *
 * A size FAILS when it draws glass and any of overlaps, nonconvex, blockFails or edgeGaps is not
 * 0 (a `--known` reading excepted, at exactly that value), when `drpgLaunchOutside` is not ok
 * (its `why` is printed), when the launchers' gaps are not equal or fewer than two pairs are
 * neighbours, when the notice tile's button is missing, or when a size that is not the stack that
 * scrolls draws no glass at all - C14's m2 (no messenger.css) drew none on all 15 desk sizes and a
 * sweep that skipped those would have passed them.
 *
 * THE CONTROLS. A count that cannot see a fault measures nothing: the stackShapes lesson in
 * CLAUDE.md, and P26 itself, where the count returned the shape of a pass for an empty list. So
 * at the first size that draws glass the sweep plants each fault the count exists to see, reads
 * it at once, and puts the page back:
 *   moved     the handbooks button 300 px up        - stale, corners outside, not ok
 *   removed   the handbooks button out of the DOM   - found one fewer than expected, not ok
 *   hidden    every expected launcher display: none - all of them hidden, not ok
 *   gm moved  on a GM's page, the GM's button 8 px off its cell towards the wall (E77 C6) - its gaps
 *             to the chat and to Foundry tools no longer the gap, which this file fails as unequal
 *   straddle  the launch pane cut in two through the handbooks button's centre (LAST.panes
 *             only, the page untouched) - the button lies on both halves and on neither alone:
 *             corners outside, the cut still live, not ok
 *   frame     LAST.frame copied with a viewport 100 px wider than this one - stale, not ok
 * A control that reads as a pass fails the sweep.
 *
 * THE NOTICE STACK AND THE CORNER (E81 fix r2-H2, 13.10.2026). After the launchers, at every size, the page's
 * `drpgNoticeCheck` draws the module's own cards with popup.mjs on the tile and fails the size on any of: the stack's
 * ceiling under 96 px on a stacked screen, as it is or with a camera dock (P25); a shown card a sliver of its content
 * beside another, or the shown cards not fitting (P24, P9); a card of 400 words outside the tile or not scrolling where
 * the stack has a ceiling (P24's other road); a line of the bottom card's words, scrolled to its end, under the
 * history's button or its unread badge (P8, P7). Its `why` is printed. R299 reads the same inside Foundry only.
 * `--no-notices` leaves it out.
 * THE CARD ON ITS PANE (E79 C13, 16.10.2026; the owner's N16). The same check's `fill`: on a Stained Glass desk the
 * card's plate is `#drpg-note-frame` on the note pane's polygon within 1 px, the card's words inside the pane, the card
 * bare, the plate drawn with one and two cards and not with none, and with two short cards each card's left edge back
 * where both stand, the one shown bare where the second parks (E79 fix r3-G4, review round 3's cor F); elsewhere no
 * frame. The line prints `fill` with the outline's distance and the words outside. At the first Stained Glass desk
 * `plantFill` plants four faults - the frame upright, the card's own plate back, the card pushed 60 px past the wall,
 * two cards with no edge - and each must read as not ok.
 *
 * THE ROOM TILE (E77 C4, 13.10.2026). Last at every size, in every role (`--roles`, the GM's page and `?role=player`),
 * the page's `drpgRoomCheck` reads where the curtain put the room tile and fails the size on any of: placed where
 * nothing is cut for it, or unplaced on a desk with glass; a place F does not choose; the tile laid out off the box
 * it was placed at; under the clock, not the clock's width, edge or turn; beside the notices, the box's foot not
 * `roomNotesLift` over the screen's edge, the pane short of the foot or a plain pane under it, the gap not 32 + h x tan 8 deg, a corner of the history's button on the room's pane; the picture not on the
 * room's pane over the curtain; a new description or the description opened firing `drpgGlassCut` - and a taller clock
 * firing none, which is that count's own control. At the first placed size two more controls: the place stamp
 * swapped without a pass, and the tile taken out - each must read as not ok. `--no-room` leaves it out.
 * THE NARROW ROW (E77 C8, 13.10.2026). At a stacked size the page's `drpgRoomCheck` expects `row`: the tile in the
 * stack's `#drpg-tile-row`, the row 44 px, the thumbnail 78x44, the words' button 44x44, a measured `tiles-row` block
 * on a pane where glass is drawn, and on the GM's page a Foundry window opened over the stack (`over`, with its own
 * control: the frame put under the stack). A stacked size that reads anything else fails. At the first stacked size
 * two more readings: the row set 60 px high must read as not ok (`plantRow`), and the page resized to 1920x1080 must
 * take the stack down with the tile back under the clock, or beside the notices where the curtain puts it there, and
 * the clock first in its column (narrow.mjs `restoreDesk`); the page is then put back at its own size.
 *
 * MONOKUMA LEGACY AND THE PINS (E77 fix r1-M1, 13.10.2026; review round 1's F6, G8 and O9). Under Legacy no curtain is
 * cut, and the tile's place and height come from glass.mjs `flatPlacement`: the same F, from the clock's foot to the
 * player list, and the same two places. A Legacy desk expects `flat` and fails on any of: no placement, or one that is
 * not flat; a place F does not choose; a second `roomPlacement` that answers otherwise; the tile laid off its box;
 * under the clock, not under it, not its width or edge, not min(F, max, cap) high, or less than 16 px above the player
 * list; beside the notices, not in the body 16 px right of the stack, level with its top, or off the screen; a new
 * description or the description opened moving the placement, while a taller clock moves it (that reading's
 * control); under the clock, `#players` made 60 px wider widening the column and the tile taking the column's width,
 * not the clock's (`wide tile/clock/column`; a column that did not widen fails as a control). Every line is
 * then compared with PINS below, in both themes and roles: a size whose place is not its pin fails, and so does a
 * size of the default list with no pin. The pin's control runs once a theme, at the first size pinned 'clock' that
 * reads it: the clock made F - need + 40 px taller, with no pass called (the module's own observers must move the
 * tile), must read another place, and the room check must hold there. A control that reads as the pin, or a theme
 * whose control never ran, fails the sweep.
 *
 * FOUNDRY'S WINDOWS (E77 C5, 13.10.2026). After the room, at every size, the page's `drpgFoundryCut` fails the size on
 * the GM's page when either window is missing, open at load or not holding its rail, and - where glass is drawn -
 * when opening and closing both fires `drpgGlassCut` or changes the clip-path, or a taller clock fires none (the
 * count's own control); on a player's page when a frame exists or either rail has a box; on either, a desk with glass
 * whose notice tile was not fitted (no rail in the column leaves the fit to `moduleLayout`'s no-rail branch alone), or
 * fitted to NOTE_MIN under a room tile that stands under the clock (the column's drop at the wall not reserved).
 * Then the page's `drpgWindowsCheck` (E77 C7) on the GM's page: Foundry tools dragged by its title lands where
 * `clampPlace` puts the point and the setting holds it; the places P11 saved at 1920x1080 open wholly on the screen
 * and off the corner cluster, every cluster button reachable, the setting unwritten by the clamp; a focused field in
 * Foundry tools keeps its focus, text and caret through a pass of the glass. `raw` is its control: the same places
 * unclamped would stand off the screen or on the cluster, and the sweep fails if no GM size reads that. The line shows
 * `places`, the drag's end, both windows' boxes, `raw off|on` and `focus kept|LOST/<cuts>`.
 * `--no-windows` leaves both out.
 *
 * E77 FIX r2-H3 (13.10.2026; review round 2's cor F2, cor F7, goal Rb, Q6, Q9 and fix r1-M1's open lines). 1366x657,
 * a 768 px screen less a browser's bars, is the one size with a height from 600 to 719; PINS has its place. A Foundry
 * window over the stack prints `over got/control/first`: `first` is the same point with the open frames moved before
 * #interface, where only their index keeps them on top - with narrow.css's index rule taken out, `got` still read
 * `frame` (the frames come after #interface in the body and won the tie by the tree alone), `first` reads the stack;
 * and each open frame's centre must hit a Foundry window. The row's "more" button is among the desk's parts the row
 * reading wants undrawn. A GM's Legacy line prints `face text/icon`: the stub sidebar's text in Foundry tools wears
 * the pixel face over the page's stand-in for Foundry's own, its icon Font Awesome. Legacy's notes place, reached by
 * the pin control, prints `right` and fails under 16 px before Foundry's right column: at 1920x1080 the control read
 * the tile 430 wide and 165 px into `#ui-right-column-1` before the fix, 249x389 and right 16 after it. The launchers'
 * controls answer "not applicable" when every line is Legacy's with no curtain (below, at the end).
 * Read on the same page by hand on 13.10.2026 and not lines of this sweep: Q6 - the GM's roster on the stack's foot
 * covered drawn pixels of the GM's button and Foundry tools (danganronpa.css `--drpg-roster-foot` has the numbers;
 * R474 reads its foot), and the messenger's unread badge ("3" and "99+") covers none of the other buttons' in either
 * theme at 1920x1080, 1366x768 and 1024x768; Q9 - at 1024x768 under Stained Glass the clock's column ends at 407 and
 * scrolls (425 over 399), the last project's header at 398-422, past its end, and, scrolled to the end, at 372-396
 * inside it and answering `elementFromPoint`; under Monokuma Legacy the column ends at 377, the header at 335-348,
 * with nothing to scroll; a GM and a player alike.
 *
 * KNOWN: none since E77 C5. 1280x720 edgeGaps 16 was the reading glass.mjs explains ("WHAT THE
 * SKIP LEAVES BARE", E81 C14) - the strip's 160 px skip left the wall bare there. The sweep before
 * C5 (C4's, 13.10.2026) already read 0 at that size for both roles, and since C5 no rail stands at
 * that wall, so the strip is cut however short; C5's sweep reads 0. `--known 1280x720:eg=16` (or
 * any `<size>:<key>=<n>`) still exempts exactly that reading.
 *
 * THE VOICE TILE (E78 C6, 14.10.2026). The page's `drpgVoiceCheck` fails a size on any of: on a desk with glass, the
 * tile not at the box the cut settled, its pane missing or painted empty, the portrait not on the body at the pane's box
 * and outline, a pane over `voice-left`, a strip shard at a right wall with no rail, a long name, the face or the fade
 * firing a drpgGlassCut (the control: the tile taken away and back fires one each way); stacked, the tile and the room
 * tile not both in the row, the portrait not inside the tile, the tile off the screen. Once per run (`--no-voice` drops
 * it all) the page is loaded without Foundry's sidebar tabs, and again with glass.mjs's spare band put back (S12-95).
 * Since E78 fix r2-H1 (14.10.2026; review round 2's cor F1) it also fails a tile drawn in another form than the cut
 * settled (`data-fit`) and a tile whose buttons or name plate leave it, whose plate lies under the buttons, whose name
 * shows less than 64 px of itself, or whose buttons have no glyph (the page's `drpgVoiceParts`). `plantVoice` is the
 * control, once per run: the tile forced 15 px tall, the speaker's glyph stripped of its mask, and (H81-10) the state
 * word stood on the name plate at the tile's foot, and (H84-03) the word on the wall's full form 6 px under the tile's
 * own top, 47 px under the microphone it stands beside, where d99adf4b stood it (`low`). 1366x600 and
 * 1366x560 are two short desks: at af5eb69 the GM's tile was 181x55 and 181x15 there and every reading said "ok".
 * Since E78 fix r2-H2 (14.10.2026; the verify ledger's E78-8, E78-13, doneWhen E78-3 and E78-9) every size also opens
 * the list 'Who you hear' (the page's `drpgVoiceList`: voice-tile.mjs's own list, eight rows) and fails it outside the
 * screen or firing a drpgGlassCut, reads the caption's brush against the game state's colour under Stained Glass
 * ("none" under Monokuma Legacy, which draws no brush), and where no curtain is cut - every Legacy desk - reads the
 * tile's box and what it holds, which until then read "voice ok none" and measured nothing. Their controls, once per
 * run: the list 40 px past the right edge, the tile taken away and back while the list is open, the brush another
 * colour (with `plantVoice`), and the Legacy tile 150 px under the screen's foot (`plantVoiceNone`).
 * Since H81 fix r1 (20.10.2026; the review's H81C2-02 and H81C2-03) the page also fails a still word whose band holds
 * less than its widest word (the six of lang/en.json and lang/pl.json, set still in its font): a Legacy desk with the
 * ticker off, and a stacked row while a speaker of three letters ("Mai") speaks. Their controls, once per run: the
 * still word stood where dc35104 stood it, in the 69 px left of the buttons (`plantVoiceNone`'s `cramped`), and the
 * face let shrink round the short name (`plantVoiceRow`).
 *
 * STANDING STILL (E78 fix h76-HF2, 14.10.2026). The owner saw the status strip jump about once a second on 1.2.76, and
 * this sweep came out GREEN on 1.2.76 at four sizes: every reading here is of a moment, and the fault was a loop. Each
 * Stained Glass desk with glass, in both roles, is now watched with nothing done for `--idle` seconds (5; 0 leaves it
 * out) once the load is 6 s old (past the 1500 ms rebuild and the first cut's 840 ms slide), before any other reading
 * touches the page: the passes of the glass (`data-drpg-measuring` set) and the transform transitions started, anywhere
 * on the page, must both be 0. The line prints `idle <passes>/<transitions>` and the shifts the rotation sheet gives
 * the rotated blocks other than the two rails. Its control runs once a run on a page of its own (1920x1080, the GM's):
 * the right-hand column moved 24 px towards the wall, which the module answers with a pass and a slide, must read
 * passes and transitions above 0; a control that reads 0 fails the sweep.
 *
 * OBJECTION! ON THE TRIAL ROW (E79 fix r4-G3, 17.10.2026; review round 4's goal C16-11 = Q2). Every size, both roles,
 * runs the page's `drpgObjectionCheck`: the clock's row drawn as a player's trial row draws it, and a size fails where
 * OBJECTION! leaves the row or the clock, is not the chevron's box within 1 px or is under 24 px, lies on the trial's
 * label or is covered at its centre (the row's own height is the label's, and is not judged). Read 17.10.2026: 22x22
 * on a stacked screen under Stained Glass before fix r4-G3 floored the plates at 24 px; since, 24 on every stacked
 * size and 27 or 29 on a desk under Stained Glass, 26 everywhere under Monokuma Legacy. Its control, once a run at the first size that reads
 * ok: the button 20 px square and the button 400 px towards the wall, each of which must read not ok. With `--shots`
 * a player's page also keeps the clock in the trial row idle, held and hovered for the preview
 * (`<theme>-player-<size>-objection-<state>.png`). The line prints `objection ok <button> chevron <chevron>`.
 * `--no-objection` leaves it out.
 *
 * THE CAMERA DOCK SHOWN AND HIDDEN (E19 C7, 19.10.2026; the owner's 14.10: R299 and the screenshots with the dock
 * hidden, the voice tile on, and shown, the voice tile off, `--drpg-av-lift` only with it shown). Every size, both
 * roles, runs `dockCheck` below: the buttons of the corner (and the GM's upper row) and the notice tile read with the
 * lift written 0px and no dock; then a dock laid on the page as Foundry's `#camera-views`, fixed at the bottom across
 * the screen, min(200 px, half the screen) tall, measured by camera-view.mjs `measureCameraDock` itself. A size fails
 * where, with the dock shown, the lift is not the dock's height or a button's or the tile's box reaches past the dock's
 * top; and where, with the voice tile's class on (`drpg-dock-hidden`), the dock does not compute `display: none`, the
 * lift is not 0px, 300 px written inline is not read 0px, or a box is not where it stood with no dock. Its control, once
 * a run: the dock shown with the lift held at 0px, as a measure that forgot it would leave it, must read not ok. With
 * `--shots` both states are kept (`<theme>-<role>-<size>-dock-shown.png`, `-dock-hidden.png`). The line prints
 * `dock <lift shown>/<lift hidden>`. `--no-dock` leaves it out.
 *
 * usage: node audit/glass-sweep.mjs [--root <tree>] [--base <url>] [--page <path?query>]
 *          [--themes stained,legacy] [--sizes 1920x1080,...] [--known <size>:<ov|nc|bf|eg>=<n>,...]
 *          [--sel <launcher selector>] [--wait <ms after the glass, 2500>] [--shots <dir>] [--corner]
 *          [--chromium <executable>] [--no-control] [--no-notices] [--roles gm,player] [--no-room]
 *          [--no-windows] [--no-voice] [--no-objection] [--no-dock] [--idle <s>, 5]
 *        node audit/glass-sweep.mjs --frame-cost [--frames <n>, 30] [--themes ...] [--sizes ...] [--glow <n>]   (E88 C0: below)
 *        node audit/glass-sweep.mjs --edges [--edge-frames <n>, 30] [--edge-sel <part>|<part>] [--edge-plant <css>] [--themes ...] [--sizes ...] [--no-control]   (E89 C5: below)
 * `--corner` loads at twice the pixel density and `--shots` then keeps the bottom-right
 * 200x230 only; without it a shot is the full screen.
 */
import { createRequire } from "module";
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import url from "url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const root = path.resolve(opt("--root") ?? path.join(HERE, ".."));
const page0 = opt("--page") ?? "audit/glass-harness.html";
const themes = (opt("--themes") ?? "stained,legacy").split(",").filter(Boolean);
const sel = opt("--sel");
const waitMs = Number(opt("--wait") ?? 2500);
const shots = opt("--shots"), corner = args.includes("--corner"), control = !args.includes("--no-control"), notices = !args.includes("--no-notices");
const roles = (opt("--roles") ?? "gm,player").split(",").filter(Boolean), rooms = !args.includes("--no-room");
const windows = !args.includes("--no-windows"), voices = !args.includes("--no-voice"), objections = !args.includes("--no-objection"), docks = !args.includes("--no-dock");
const idleS = Number(opt("--idle") ?? 5);
const known = Object.fromEntries((opt("--known") ?? "").split(",").filter(Boolean).map(k => {
    const [size, kv] = k.split(":"); const [key, v] = kv.split("=");
    return [size + "/" + key, Number(v)];
}));
const SIZES = (opt("--sizes") ?? "1920x1080,1366x768,2560x1440,1440x900,1536x864,1600x900,1680x1050,1280x800,1224x768,"
    + "1264x800,1300x768,1400x900,3840x2160,1920x1200,1024x768,1180x820,820x1180,768x1024,393x852,1280x720,1366x657,1366x600,1366x560,844x390,640x360").split(",");
/* THE PINS (E77 fix r1-M1, 13.10.2026; review round 1's O9): the place each size reads, as this file read it on
   e77-wip after E77 C9 and the side fix line (ceb70a4) with fix r1-M1 on it, in Chromium, GM and player alike -
   'row' on a stacked screen (E77 C8), 'notes' where Stained Glass's F leaves less than the smallest box (F 194 at
   1366x768, 1224x768 and 1300x768, 226 at 1280x800 and 1264x800 against need 233, 146 at 1280x720), 'clock'
   everywhere else; under Monokuma Legacy every desk size reads 'clock' (F 489 to 1899 against need 310). A
   reading that moves is a design change: say why in the commit that moves the pin. 1366x657 (fix r2-H3, review
   round 2's goal Rb), read on fix r2-H3's tree: 'notes' under Stained Glass (F 83, box 301x321) and 'clock' under
   Monokuma Legacy (F 426, box 430x426), a GM and a player alike. 1366x600 and 1366x560 (E78 fix r2-H1, review round
   2's cor F1: two short desks, the voice tile's), read on af5eb69: 'notes' under Stained Glass (F 26 and -14) and
   'clock' under Monokuma Legacy (F 369 and 329), a GM and a player alike. */
const PIN_ROW = ["1024x768", "1180x820", "820x1180", "768x1024", "393x852", "844x390", "640x360"];
const PIN_NOTES = { stained: ["1366x768", "1280x800", "1224x768", "1264x800", "1300x768", "1280x720", "1366x657", "1366x600", "1366x560"], legacy: [] };
const PINS = Object.fromEntries(["stained", "legacy"].flatMap(theme => ["gm", "player"].flatMap(role =>
    ("1920x1080,1366x768,2560x1440,1440x900,1536x864,1600x900,1680x1050,1280x800,1224x768,1264x800,1300x768,1400x900,3840x2160,"
        + "1920x1200,1024x768,1180x820,820x1180,768x1024,393x852,1280x720,1366x657,1366x600,1366x560,844x390,640x360").split(",").map(size =>
        [`${theme} ${role} ${size}`, PIN_ROW.includes(size) ? "row" : PIN_NOTES[theme].includes(size) ? "notes" : "clock"]))));
/* THE BOX PINS (E78 C0, 13.10.2026; the owner's decision of 13.10: the room tile is too large beside the notices
   and under Monokuma Legacy, and under Stained Glass's clock it stays exactly as it is): each desk size's room box,
   width x height, a GM and a player alike. The 'clock' rows of Stained Glass are 1.2.76's own (this file on dcfc31b,
   in Chromium, 13.10.2026: SWEEP GREEN, 711 s), and C0 must not move them; the 'notes' rows of Stained Glass and
   every Legacy row are C0's, read the same day on C0's tree with the cap of glass.mjs `roomCapH` - beside the notices
   301x376 became 301x259 at 1366x768, 1224x768 and 1300x768, 301x384 became 301x270 at 1280x800 and 1264x800,
   301x352 and 301x321 became 301x245 (the floor at `need`) at 1280x720 and 1366x657; under Legacy 430x491 became
   430x364 at 1920x1080, 430x310 (the floor) at ten sizes, 430x485, 430x354 and 430x404 at 2560x1440, 1680x1050 and
   1920x1200, and 3840x2160 kept 430x491 (its maxH is below the cap). Every self-check (ov, nc, bf, eg, ff) and
   every place read the same before and after. The harness's own room check reads the height against
   min(F, maxH, cap) with glass.mjs's function, so these numbers are the one reading that does not go through the
   code it checks. A box that moves is a design change: say why in the commit that moves the pin.
   E78 fix h76-HF4 (14.10.2026; the owner on C0's shot, 13.10: beside the notices "ok 2x za duzy", half the height)
   moved the seven 'notes' rows of Stained Glass, and only those: 301x259 became 301x150 at 1366x768, 1224x768 and
   1300x768, 301x270 became 301x155 at 1280x800 and 1264x800, 301x245 became 301x143 at 1280x720 and 1366x657
   (glass.mjs `roomNotesH`: half the run C0's pane had, less its two pads). The 'clock' rows and Legacy's did not
   move, and the sweep read them so on that tree. 1366x600 and 1366x560 (fix r2-H1) read on af5eb69: 301x143 beside
   the notices, 430x310 under Legacy, as at 1366x657. E78 fix r2-H3 (14.10.2026; the owner on HF4's shot: "zdjecie mialo
   byc przeciagniete za krawedz ekranu", the picture was to run past the screen's edge) moved the same rows of Stained
   Glass and only those: the box stands 31 px over the screen's edge (`roomNotesLift`) with its pane run past it, 301x150
   became 301x129, 301x155 became 301x134 and 301x143 became 301x122 (`low`, the content's floor), read the same day. */
const BOX = {
    "stained 1920x1080": "265x364", "stained 1366x768": "301x129", "stained 2560x1440": "312x425", "stained 1440x900": "265x302",
    "stained 1536x864": "265x266", "stained 1600x900": "265x302", "stained 1680x1050": "265x364", "stained 1280x800": "301x134",
    "stained 1224x768": "301x129", "stained 1264x800": "301x134", "stained 1300x768": "301x129", "stained 1400x900": "265x302",
    "stained 3840x2160": "312x425", "stained 1920x1200": "265x364", "stained 1280x720": "301x122", "stained 1366x657": "301x122",
    "stained 1366x600": "301x122", "stained 1366x560": "301x122",
    "legacy 1920x1080": "430x364", "legacy 1366x768": "430x310", "legacy 2560x1440": "430x485", "legacy 1440x900": "430x310",
    "legacy 1536x864": "430x310", "legacy 1600x900": "430x310", "legacy 1680x1050": "430x354", "legacy 1280x800": "430x310",
    "legacy 1224x768": "430x310", "legacy 1264x800": "430x310", "legacy 1300x768": "430x310", "legacy 1400x900": "430x310",
    "legacy 3840x2160": "430x491", "legacy 1920x1200": "430x404", "legacy 1280x720": "430x310", "legacy 1366x657": "430x310",
    "legacy 1366x600": "430x310", "legacy 1366x560": "430x310"
};
const PIN_BOX = Object.fromEntries(Object.entries(BOX).flatMap(([key, box]) => {
    const [theme, size] = key.split(" ");
    return ["gm", "player"].map(role => [`${theme} ${role} ${size}`, box]);
}));
/* THE PANE PINS (E78 fix h76-HF4, 14.10.2026). C0 pinned the box, and the box was not what the owner saw: beside the
   notices the curtain cut the room's pane from 10 px over the box down to the screen's foot, and that pane - 362x370
   at 1366x768, leaning 6 degrees - is the tile the owner measured off C0's shot ("about 330 x 370"). So the 'notes'
   sizes pin the pane too, its bounds' width x height as the page's LAST.panes has them: C0's read 362x370 at 1366x768
   and 1366x657 (370 and 356 high, leaning), 325x339 at 1224x768 and 1300x768, 325x350 at 1280x800 and 1264x800 and
   325x325 at 1280x720 (upright); after HF4 each is the box and 10 px over and under it, upright, and as wide as at
   C0 where it stood upright.
   THE TILT PINS (E78 fix r1-G3, 14.10.2026; the owner on C0's lean: "Zostaw kafel przekrzywiony" - leave the tile
   tilted). HF4 had stood the pane upright; it leans again where C0 leaned it, 6.0 degrees at 1366x768 and 1366x657,
   and stands upright at the five other 'notes' sizes, as at C0 (the page's `notes.tilt`, the tile's turn, which the
   room check holds to its pane's own angle; Chromium, read the same day on C0's tree, HF4's and this one). The
   leaning panes' bounds grow with the lean: 325x170 became 341x203 at 1366x768 and 325x163 became 340x196 at
   1366x657, still ending 10 px under the box. `plantPane`'s `turned` control turns the tile off its pane's angle.
   1366x600 and 1366x560 (fix r2-H1) read on af5eb69 as 1366x657 reads: 340x196, leaning 6 degrees.
   THE PANE RUNS PAST THE SCREEN'S EDGE (E78 fix r2-H3, 14.10.2026; the owner on HF4's shot at 1366x768: "zdjecie mialo
   byc przeciagniete za krawedz ekranu"). The pane runs to the foot as every column of the bottom band does, with no
   plain pane under it, and the box stands `roomNotesLift` over the edge, so what shows above the edge is still half of
   C0's run: the upright panes read as at HF4 (325x170, 325x175, 325x163: the box, 31 px under it and 10 over it, is
   HF4's box and its two pads), the leaning ones 344x202 at 1366x768 (its top edge from y 566 to 600, 583 at its middle: 185 px above the edge there; HF4's ran from 523 to 692 at its middle)
   and 344x195 at 1366x657, 1366x600 and 1366x560. `plantPane`'s `foot` control is HF4's cut: the pane ended 10 px
   under the box and a plain pane under it, which must fail the room check. */
const PANE = { "1366x768": "344x202", "1224x768": "325x170", "1300x768": "325x170", "1280x800": "325x175", "1264x800": "325x175", "1280x720": "325x163", "1366x657": "344x195",
    "1366x600": "344x195", "1366x560": "344x195" };
const PIN_PANE = Object.fromEntries(Object.entries(PANE).flatMap(([size, pane]) => ["gm", "player"].map(role => [`stained ${role} ${size}`, pane])));
/* THE CORNER PINS (E78 fix r2-H3, 14.10.2026; the owner on HF4's shot: "przyciski na panelu livekit sa za daleko
   krawedzi"). On the wall in the full form the voice tile's buttons stand one over the other at its pane's top right
   corner, as P11 draws them: per button, its centre's distance from the screen's right edge and under the pane's top
   edge straight above it (the page's `drpgVoiceParts`, `corner`). At 60741cf they stood side by side, 66 and 31 px
   from the wall and 69 px under that edge at 1366x768. Read in Chromium on this tree the same day: 20,22 25,57 at
   every full tile, 19,22 24,57 at 2560x1440 and 3840x2160 (the tile 258 wide there). "-" is a compact tile, whose
   buttons keep H1's row (a GM's at 1366x657, 181x113 under VOICE_FULL's 114, and both roles' at 1366x600 and 1366x560).
   `plantVoice`'s `inward` control stands them where 60741cf did and must fail the voice check. */
const CORNER = "20,22 25,57", WIDE = "19,22 24,57", COMPACT = ["gm 1366x657", "gm 1366x600", "gm 1366x560", "player 1366x600", "player 1366x560"];
const PIN_CORNER = Object.fromEntries(["1920x1080", "1366x768", "2560x1440", "1440x900", "1536x864", "1600x900", "1680x1050", "1280x800", "1224x768", "1264x800",
    "1300x768", "1400x900", "3840x2160", "1920x1200", "1280x720", "1366x657", "1366x600", "1366x560"]
    .flatMap(size => ["gm", "player"].map(role => [`stained ${role} ${size}`, COMPACT.includes(`${role} ${size}`) ? "-" : /^(2560|3840)x/.test(size) ? WIDE : CORNER])));
const TILT = { "1366x768": 6, "1224x768": 0, "1300x768": 0, "1280x800": 0, "1264x800": 0, "1280x720": 0, "1366x657": 6, "1366x600": 6, "1366x560": 6 };
const PIN_TILT = Object.fromEntries(Object.entries(TILT).flatMap(([size, deg]) => ["gm", "player"].map(role => [`stained ${role} ${size}`, deg])));
if (shots) mkdirSync(shots, { recursive: true });

let chromium;
try { ({ chromium } = createRequire(path.join(root, "audit", "harness", "package.json"))("playwright")); }
catch (err) { console.log(`glass-sweep: no Playwright under ${root}/audit/harness (npm ci there): ${err.message.split("\n")[0]}`); process.exit(2); }
let base = opt("--base"), srv = null;
if (!base) {
    const port = 20000 + Math.floor(Math.random() * 20000);
    srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    base = `http://127.0.0.1:${port}`;
    await new Promise(r => setTimeout(r, 800));
}
let browser;
try { browser = await chromium.launch(opt("--chromium") ? { executablePath: opt("--chromium") } : {}); }
catch (err) { srv?.kill(); console.log(`glass-sweep: Chromium did not launch (--chromium <executable> names one): ${err.message.split("\n")[0]}`); process.exit(2); }

/* THE CURTAIN'S PRICE (E88 C0, 27.10.2026; E88-04): `--frame-cost` runs this instead of the sweep. At each size (by
   default 1920x1080 and 1366x768) in each theme, the page is loaded once and the mean ms per frame over `--frames`
   frames (30) is read as the page stands and with each of the theme's per-frame costs held alone: the blur
   (`drpg-no-blur`, the Look window's switch), the pulse (`drpg-no-pulse`), the ticker (`drpg-no-ticker`), the seam glows
   (every `drpg-sg-seam-glow` animation paused through the Web Animations API), every endless animation paused, and
   all of them at once; then the same again with the page's `#board` redrawn on every frame, as Foundry's ticker
   redraws its canvas (a filled rectangle that moves a pixel a frame). Every hold is put back before the next, and the
   body's classes and the paused animations are read after each to say so. Headless Chromium rasterises in software
   (perf-baseline.json `headless`): the numbers are a SHAPE - which hold moves the frame and by how much against the
   others - never a table's frame time. A table's is `game.drpg.fps()`. Exit 1 when a hold did not come back.
   `--glow <n>` (E88 C5) first plants n waiting Calls (`.drpg-pending-call`, the sheet's badge of a Call armed on its
   character) in the page's module window, so the seam glows (`drpg-sg-seam-glow`, a box-shadow animated on every frame
   while something waits) run and their hold reads something: as loaded the page has none of them waiting. */
async function frameCostProbe([frames, glow]) {
    const body = document.body;
    const host = document.querySelector(".drpg-panel .window-content") ?? body;
    for (let i = 0; i < glow; i++) { const b = document.createElement("span"); b.className = "drpg-pending-call drpg-pending-hope"; b.textContent = "Call"; host.append(b); }
    if (glow) await new Promise(res => setTimeout(res, 1500));
    const frame = () => new Promise(res => requestAnimationFrame(res));
    const mean = async () => { await frame(); const t0 = performance.now(); for (let i = 0; i < frames; i++) await frame(); return (performance.now() - t0) / frames; };
    const endless = () => document.getAnimations().filter(a => a.effect?.getComputedTiming?.().iterations === Infinity && a.playState === "running");
    const pause = list => { list.forEach(a => a.pause()); return () => list.forEach(a => a.play()); };
    const cls = name => { if (body.classList.contains(name)) return null; body.classList.add(name); return () => body.classList.remove(name); };
    const holds = [
        ["blur", () => cls("drpg-no-blur")],
        ["pulse", () => cls("drpg-no-pulse")],
        ["ticker", () => cls("drpg-no-ticker")],
        ["seam glows", () => { const l = endless().filter(a => a.animationName === "drpg-sg-seam-glow"); return l.length ? pause(l) : null; }],
        ["endless animations", () => { const l = endless(); return l.length ? pause(l) : null; }],
        ["all of them", () => { const u = ["drpg-no-blur", "drpg-no-pulse", "drpg-no-ticker"].map(cls).filter(Boolean); const l = endless(); u.push(pause(l));
            return () => u.forEach(f => f()); }]
    ];
    const board = document.getElementById("board"), g = board?.getContext?.("2d");
    let ticking = false, x = 0;
    const tick = () => { if (!ticking || !g) return; g.clearRect(0, 0, board.width, board.height); g.fillStyle = "rgba(120,90,160,0.6)"; g.fillRect(x++ % board.width, 40, 60, 60); requestAnimationFrame(tick); };
    const out = { rows: [], restored: true, endless: endless().map(a => a.animationName) };
    const print = () => [...body.classList].sort().join(" ") + "|" + endless().length;
    for (const boardOn of [false, true]) {
        ticking = boardOn; if (boardOn) requestAnimationFrame(tick);
        const asIs = await mean();
        out.rows.push({ board: boardOn, hold: "as it stands", ms: asIs });
        for (const [name, start] of holds) {
            const was = print();
            const undo = start();
            if (!undo) { out.rows.push({ board: boardOn, hold: name, ms: null }); continue; }
            let ms = null;
            try { ms = await mean(); } finally { undo(); }
            await frame();
            if (print() !== was) out.restored = false;
            out.rows.push({ board: boardOn, hold: name, ms });
        }
        ticking = false;
    }
    return out;
}
if (args.includes("--frame-cost")) {
    const frames = Number(opt("--frames") ?? 30);
    let bad = 0;
    try {
        for (const theme of themes) for (const size of (opt("--sizes") ?? "1920x1080,1366x768").split(",")) {
            const [W, H] = size.split("x").map(Number);
            const page = await browser.newPage({ viewport: { width: W, height: H } });
            await page.goto(`${base}/${page0}${theme === "legacy" ? (page0.includes("?") ? "&" : "?") + "theme=legacy" : ""}`);
            await page.waitForFunction(() => window.__glass, null, { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(waitMs);
            const r = await page.evaluate(frameCostProbe, [frames, Number(opt("--glow") ?? 0)]);
            const asIs = b => r.rows.find(row => row.board === b && row.hold === "as it stands").ms;
            for (const row of r.rows) {
                const ms = row.ms == null ? "    -" : row.ms.toFixed(1).padStart(6);
                const less = row.ms == null || row.hold === "as it stands" ? "" : `  ${(asIs(row.board) - row.ms).toFixed(1).padStart(6)} ms less`;
                console.log(`${theme.padEnd(7)} ${size.padEnd(9)} board ${row.board ? "redrawn" : "still  "} ${row.hold.padEnd(18)} ${ms} ms/frame${less}${row.ms == null ? "  (nothing of it here)" : ""}`);
            }
            console.log(`${theme.padEnd(7)} ${size.padEnd(9)} endless animations at load: ${r.endless.join(", ") || "none"}${r.restored ? "" : "  - FAIL: a hold did not come back"}`);
            if (!r.restored) bad++;
            await page.close();
        }
    } finally { await browser.close(); srv?.kill(); }
    console.log(`FRAME COST ${bad ? "RED" : "read"}: ${themes.length} theme(s), ${frames} frames a reading, headless Chromium (software): a shape, not a table's number`);
    process.exit(bad ? 1 : 0);
}

/* THE EDGES (E89 C5, 30.10.2026; E89-10, the owner's Q-E89-2: "Stained glass. Wiele miejsc. Przyklad - GM Panel", the
   edges of controls dropping or flickering). `--edges` runs this instead of the sweep. At each size in each theme the
   harness is loaded with the GM Panel's copy (`?gmp=1`) on a GM's page, the board is redrawn on every frame under every
   layer (`__mover`), and `--edge-frames` (30) screenshots of the whole screen are taken one after another - and as
   many before it with the board still, so that a count that comes only with the board moving (an edge lost against
   what passes behind a translucent layer) is told from one that comes with nothing moving (the layer's own drawing
   changing from frame to frame), which is the shape the owner described. For each
   selector of EDGE_SELECTORS - the candidates of the stage's item 2 that the page draws, the GM Panel's first - the
   first visible match's box is read, and along each of its four sides (6 px left out at each end, for the chamfers and
   radii) the edge's contrast at each pixel: the larger channel difference of the side's two inside pixels against the
   first pixel outside it. M is the median of every such value of that control over every frame; a control under 16
   has no edge to lose and is said so. A pixel whose contrast falls under M/2 is counted: `steady` where it is under in
   every frame, `flicker` where only in some. Printed per side (L, T, R, B), only where not 0, `still` and `moving`
   apart, and at the end, per selector, the sizes and themes where each count is not 0.
   THE CONTROL: at the first Stained Glass size that draws a GM Panel tile, once both phases are read and the mover is
   stopped, the tile whose box was read (the first visible match, `__edgeEls`) is read `--edge-frames` times as drawn
   and as many again with `clip-path: inset(0 0.5px 0 0)` written on it - its right edge cut 0.5 px in - and both are
   counted by the M of the frames as drawn: the R count with the plant must be greater than the R count without it;
   the style is then taken off. A control that does not add counts exits 1, as does a page that never loaded the glass.
   Until E89 fix FG1 (COR-2) the control counted R with the plant alone, while the mover still ran, on
   document.querySelector's first match: at 1366x768 the tile unplanted read flicker R63 in the moving phase, so a
   plant that drew nothing could pass whenever the board's motion fell in the control's frames. `--edge-plant <css>`
   writes another clip-path for the control, to check the control itself: `inset(0 0 0 0)` changes no pixel and must
   read FAIL.
   Headless Chromium rasterises in software (perf-baseline.json `headless`), not as a table's GPU does: a count here is
   the shape of what this Chromium draws, and a zero says the probe did not reproduce a table's picture, not that the
   table's edges hold. `--edge-sel` keeps only the selectors that contain one of its `|`-separated parts (to read
   again where a count was not 0, E89 C6); a list without the first tile runs no control and says so. A part naming
   the messenger (not its launcher) also draws the conversation window (`?msgr=1`, E89 fix FG1): its header band and
   send button are read then, and only then, so the default list reads the page C5 read. A side drawn without a border (the HUD's, a rail's on the screen's edge) reads `steady` by
   design; the pixels outside the screen are not read. */
const EDGE_SELECTORS = [
    ".drpg-gm-panel .drpg-gmp-button", ".drpg-gm-panel .drpg-gmp-grid > :nth-child(2)", ".drpg-gm-panel .drpg-gmp-button.drpg-gm-route",
    ".drpg-gm-panel .drpg-gmp-button.drpg-destructive", ".drpg-gm-panel .drpg-gmp-section > summary", ".drpg-gm-panel-window .window-header",
    ".drpg-gm-panel-window .window-content", ".drpg-gm-panel-window footer.form-footer button",
    ".application.drpg-panel:not(.drpg-gm-panel-window) .window-content", ".application.drpg-panel:not(.drpg-gm-panel-window) footer.form-footer button",
    ".application.drpg-messenger .window-header", ".drpg-messenger .drpg-messenger-input button", ".character-header-sheet.drpg-glass-band", "#pause.paused figcaption",
    "#drpg-hud", "#drpg-despair", ".drpg-despair-pip", ".drpg-action-pip", "#players", "#drpg-room-art", "#drpg-tile-row",
    "#scene-controls", "#sidebar-tabs", "#drpg-messenger-launcher", "#drpg-gm-launcher"
];
/* Runs in the page: the first visible match of each selector, its box, and the element kept in `__edgeEls` (by the
   selector's position) so that the control plants on the element whose box was read (E89 fix FG1, COR-2). */
function edgeBoxes(list) {
    window.__edgeEls = [];
    return list.map((sel, k) => {
        const all = [...document.querySelectorAll(sel)];
        const el = all.find(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
            return r.width >= 16 && r.height >= 16 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && cs.visibility !== "hidden" && cs.display !== "none"; });
        if (!el) return null;
        window.__edgeEls[k] = el;
        const r = el.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
}
/* Runs in a blank page: one screenshot decoded, and for each box the contrast at each position of its four sides (null
   where the outside pixel is off the screen), in the order L, T, R, B. */
/* global createImageBitmap, OffscreenCanvas */
async function edgeRead([b64, boxes]) {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const W = bmp.width, H = bmp.height, c = new OffscreenCanvas(W, H).getContext("2d");
    c.drawImage(bmp, 0, 0);
    const d = c.getImageData(0, 0, W, H).data;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : (y * W + x) * 4;
    const diff = (a, b) => Math.max(Math.abs(d[a] - d[b]), Math.abs(d[a + 1] - d[b + 1]), Math.abs(d[a + 2] - d[b + 2]));
    const pair = (ins, out) => { if (out < 0 || ins.some(i => i < 0)) return null; return Math.max(...ins.map(i => diff(i, out))); };
    return boxes.map(bx => {
        if (!bx) return null;
        const y0 = Math.ceil(bx.t) + 6, y1 = Math.floor(bx.b) - 7, x0 = Math.ceil(bx.l) + 6, x1 = Math.floor(bx.r) - 7;
        const L = Math.floor(bx.l), R = Math.ceil(bx.r), T = Math.floor(bx.t), B = Math.ceil(bx.b);
        const side = [[], [], [], []];
        for (let y = y0; y <= y1; y++) { side[0].push(pair([at(L, y), at(L + 1, y)], at(L - 1, y))); side[2].push(pair([at(R - 1, y), at(R - 2, y)], at(R, y))); }
        for (let x = x0; x <= x1; x++) { side[1].push(pair([at(x, T), at(x, T + 1)], at(x, T - 1))); side[3].push(pair([at(x, B - 1), at(x, B - 2)], at(x, B))); }
        return side;
    });
}
/* frames: per frame, per box, the four sides' values. Returns null for an absent box, else { M, steady, flicker, n }
   with steady and flicker per side. `fixedM`, when given, is the M to judge by instead of these frames' own median:
   the control counts its planted frames by the M of the same box as drawn, so both counts use one threshold. */
function edgeCount(frames, k, fixedM = null) {
    if (!frames[0][k]) return null;
    const vals = frames.flatMap(f => f[k].flat()).filter(v => v != null).sort((a, b) => a - b);
    if (!vals.length) return { M: 0, steady: [0, 0, 0, 0], flicker: [0, 0, 0, 0], n: 0 };
    const M = fixedM ?? vals[Math.floor(vals.length / 2)], out = { M, steady: [0, 0, 0, 0], flicker: [0, 0, 0, 0], n: 0 };
    if (M < 16) return out;
    for (let s = 0; s < 4; s++) for (let i = 0; i < frames[0][k][s].length; i++) {
        const seq = frames.map(f => f[k][s][i]).filter(v => v != null);
        if (!seq.length) continue;
        out.n++;
        const under = seq.filter(v => v < M / 2).length;
        if (under === seq.length) out.steady[s]++; else if (under) out.flicker[s]++;
    }
    return out;
}
if (args.includes("--edges")) {
    const N = Number(opt("--edge-frames") ?? 30), PLANT = opt("--edge-plant") ?? "inset(0 0.5px 0 0)", SIDES = "LTRB", want = (opt("--edge-sel") ?? "").split("|").filter(Boolean);
    const LIST = want.length ? EDGE_SELECTORS.filter(sel => want.some(w => sel.includes(w))) : EDGE_SELECTORS, withControl = control && LIST[0] === EDGE_SELECTORS[0];
    const msgr = want.some(w => w.includes("messenger") && !w.includes("launcher"));   // the conversation window only when asked (glass-harness `?msgr=1`)
    if (control && !withControl) console.log("control: not run - --edge-sel leaves out the tile it is planted on");
    const calc = await browser.newPage();
    const tally = new Map(LIST.flatMap(sel => ["still", "moving"].map(ph => [`${ph} ${sel}`, { steady: [], flicker: [], seen: 0, flat: 0 }])));
    let bad = 0, planted = null;
    const shoot = async page => { const fr = []; for (let i = 0; i < N; i++) fr.push((await page.screenshot({ type: "png" })).toString("base64")); return fr; };
    const read = async (shots, boxes) => { const out = []; for (const b64 of shots) out.push(await calc.evaluate(edgeRead, [b64, boxes])); return out; };
    try {
        for (const theme of themes) for (const size of (opt("--sizes") ?? SIZES.join(",")).split(",")) {
            const [W, H] = size.split("x").map(Number);
            const page = await browser.newPage({ viewport: { width: W, height: H } });
            await page.goto(`${base}/${page0}${page0.includes("?") ? "&" : "?"}gmp=1${msgr ? "&msgr=1" : ""}${theme === "legacy" ? "&theme=legacy" : ""}`);
            const loaded = await page.waitForFunction(() => window.__glass && window.__mover, null, { timeout: 15000 }).then(() => true, () => false);
            if (!loaded) { console.log(`${theme.padEnd(7)} ${size.padEnd(9)} FAIL: the page did not load the glass`); bad++; await page.close(); continue; }
            await page.waitForTimeout(waitMs);
            const boxes = await page.evaluate(edgeBoxes, LIST);
            const parts = [];
            let frames;
            for (const ph of ["still", "moving"]) {
            if (ph === "moving") { await page.evaluate(() => window.__mover.start()); await page.waitForTimeout(200); }
            frames = await read(await shoot(page), boxes);
            LIST.forEach((sel, k) => {
                const r = edgeCount(frames, k), t = tally.get(`${ph} ${sel}`);
                if (!r) return;
                t.seen++;
                if (r.M < 16) { t.flat++; return; }
                const fmt = a => a.map((v, s) => v ? `${SIDES[s]}${v}` : "").filter(Boolean).join(" ");
                if (r.steady.some(Boolean)) t.steady.push(`${theme} ${size} ${fmt(r.steady)}`);
                if (r.flicker.some(Boolean)) t.flicker.push(`${theme} ${size} ${fmt(r.flicker)}`);
                if (r.steady.some(Boolean) || r.flicker.some(Boolean)) parts.push(`${ph} ${sel} M${r.M} steady[${fmt(r.steady) || 0}] flicker[${fmt(r.flicker) || 0}]`);
            });
            }
            await page.evaluate(() => window.__mover.stop());
            if (withControl && !planted && theme === "stained" && boxes[0]) {
                await page.waitForTimeout(300);
                const was = edgeCount(await read(await shoot(page), [boxes[0]]), 0);
                await page.evaluate(css => { window.__edgeEls[0].style.clipPath = css; }, PLANT);
                await page.waitForTimeout(100);
                const pf = await read(await shoot(page), [boxes[0]]);
                await page.evaluate(() => { window.__edgeEls[0].style.removeProperty("clip-path"); });
                const r = was && was.M >= 16 ? edgeCount(pf, 0, was.M) : null;
                const Rw = was ? was.steady[2] + was.flicker[2] : 0, Rp = r ? r.steady[2] + r.flicker[2] : 0, ok = !!r && Rp > Rw;
                planted = { size, r, was };
                console.log(`${theme.padEnd(7)} ${size.padEnd(9)} control: ${EDGE_SELECTORS[0]} with clip-path ${PLANT}, the board still - R ${Rp} with the plant against ${Rw} as drawn, the same box and M ${was?.M ?? "-"}${ok ? "" : "  - FAIL: the plant added nothing the count sees"}`);
                if (!ok) bad++;
            }
            console.log(`${theme.padEnd(7)} ${size.padEnd(9)} edges: ${boxes.filter(Boolean).length} selectors drawn, ${N} frames - ${parts.length ? parts.join("; ") : "none counted"}`);
            await page.close();
        }
    } finally { await browser.close(); srv?.kill(); }
    if (withControl && !planted) { console.log("control: no Stained Glass size drew a GM Panel tile - FAIL"); bad++; }
    console.log("per selector (sizes and themes where the count is not 0):");
    for (const [sel, t] of tally) console.log(`  ${sel}: ${!t.seen ? "not drawn" : t.flat === t.seen ? `no edge to read (M < 16 at all ${t.seen})`
        : `steady ${t.steady.length ? t.steady.join(", ") : "0 everywhere"} | flicker ${t.flicker.length ? t.flicker.join(", ") : "0 everywhere"}`}${t.flat && t.flat < t.seen ? ` (no edge at ${t.flat})` : ""}`);
    console.log(`EDGES ${bad ? "RED" : "read"}: ${themes.length} theme(s), ${N} frames a size, headless Chromium (software): a shape, not a table's picture`);
    process.exit(bad ? 1 : 0);
}

/* Runs in the page: `ms` of nothing done, once the load is 6 s old - the passes of the glass begun (the measuring
   attribute set where it was absent), the transform transitions started and on what, and the shifts the rotation
   sheet gives the blocks other than the two rails. */
async function idle(ms) {
    const wait = 6000 - performance.now();
    if (wait > 0) await new Promise(res => setTimeout(res, wait));
    let passes = 0;
    const moved = {};
    const mo = new MutationObserver(recs => { for (const r of recs) if (r.oldValue === null) passes++; });
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-drpg-measuring"], attributeOldValue: true });
    const on = e => { if (e.propertyName !== "transform") return; const k = e.target.id || e.target.tagName.toLowerCase(); moved[k] = (moved[k] || 0) + 1; };
    document.addEventListener("transitionstart", on, true);
    await new Promise(res => setTimeout(res, ms));
    mo.disconnect();
    document.removeEventListener("transitionstart", on, true);
    const sheet = document.getElementById("drpg-glass-rotation")?.textContent ?? "";
    const shifts = sheet.split("}").filter(r => !/#scene-controls|#sidebar-tabs/.test(r))
        .map(r => /translateX\((-?[\d.]+)px\)/.exec(r)?.[1]).filter(v => v != null).map(Number);
    return { passes, starts: Object.values(moved).reduce((a, b) => a + b, 0), moved, shifts };
}
/* Runs in the page: the planted faults, each read at once and put back. Returns one entry a
   control: what it read and whether that is what the fault must read as. */
function plant(sel) {
    const read = () => window.drpgLaunchOutside(sel ?? undefined);
    const book = document.getElementById("drpg-book-launcher");
    /* The page's own count: three on a player's page, five on a GM's since E77 C6. */
    const before = read(), expected = before.expected;
    const all = ["drpg-messenger-launcher", "drpg-sound-launcher", "drpg-book-launcher", "drpg-gm-launcher", "drpg-foundry-tools"]
        .map(id => document.getElementById(id)).filter(Boolean).slice(0, expected);
    const res = {};
    const show = r => ({ ok: r.ok, found: r.found, expected: r.expected, hidden: r.hidden.length, outside: r.outside, stale: r.stale, why: r.why });
    {   // moved
        const was = book.style.getPropertyValue("bottom"), pr = book.style.getPropertyPriority("bottom");
        book.style.setProperty("bottom", (parseFloat(getComputedStyle(book).bottom) + 300) + "px", "important");
        const r = read();
        book.style.removeProperty("bottom"); if (was) book.style.setProperty("bottom", was, pr);
        res.moved = { ...show(r), pass: !r.ok && r.stale && r.outside > 0 && /stale/.test(r.why) };
    }
    {   // removed
        const parent = book.parentNode, next = book.nextSibling;
        book.remove();
        const r = read();
        parent.insertBefore(book, next);
        res.removed = { ...show(r), pass: !r.ok && r.found === expected - 1 && new RegExp(`found ${expected - 1} of`).test(r.why) };
    }
    {   // hidden
        const was = all.map(e => [e.style.getPropertyValue("display"), e.style.getPropertyPriority("display")]);
        all.forEach(e => e.style.setProperty("display", "none", "important"));
        const r = read();
        all.forEach((e, i) => { e.style.removeProperty("display"); if (was[i][0]) e.style.setProperty("display", was[i][0], was[i][1]); });
        res.hidden = { ...show(r), pass: !r.ok && all.length === expected && r.hidden.length === expected && /hidden/.test(r.why) };
    }
    const gm = document.getElementById("drpg-gm-launcher");
    if (gm && expected === 5) {   // gm moved: off its cell towards the wall, over the gap to Foundry tools
        const was = gm.style.getPropertyValue("right"), pr = gm.style.getPropertyPriority("right");
        gm.style.setProperty("right", (parseFloat(getComputedStyle(gm).right) - 8) + "px", "important");
        const r = read();
        gm.style.removeProperty("right"); if (was) gm.style.setProperty("right", was, pr);
        const gaps = r.gaps.filter(g => /drpg-gm-launcher/.test(g.pair)).map(g => g.pair + " " + g.gap);
        // the GM's pairs as read before the plant: each must read otherwise now, or be gone
        const off = before.gaps.filter(g => /drpg-gm-launcher/.test(g.pair)).length > 0
            && before.gaps.filter(g => /drpg-gm-launcher/.test(g.pair))
                .every(g => !r.gaps.some(h => h.pair === g.pair && Math.abs(h.gap - g.gap) <= 0.5));
        /* FAILED BY THE SWEEP'S OWN GAP RULE, NOT BY THE PAGE'S `ok`. The page's check reads which
           buttons stand on the launch pane, and 8 px stays on it: measured 13.10.2026 at 1920x1080
           under Stained Glass, `ok` true, not stale, chat-GM 1.16 and GM-tools 0.03. So the control
           asks what a size line asks (below): not ok, fewer than two pairs, or gaps unequal. */
        const gs = r.gaps.map(g => g.gap);
        const failed = !r.ok || gs.length < 2 || Math.max(...gs) - Math.min(...gs) > 0.1;
        res["gm moved"] = { ...show(r), why: r.why + " | " + gaps.join(", "), pass: failed && off };
    }
    {   // straddle
        const LAST = window.__glass.LAST, panes = LAST.panes;
        const at = document.getElementById("drpg-curtain").getBoundingClientRect(), b = book.getBoundingClientRect();
        const c = b.left + b.width / 2 - at.left, y = b.top + b.height / 2 - at.top;
        const inside = (poly, x, yy) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > yy) !== (yj > yy) && x < (xj - xi) * (yy - yi) / (yj - yi) + xi) k = !k; } return k; };
        const cut = (poly, keep) => {
            const out = [];
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i], z = poly[(i + 1) % poly.length];
                if (keep(a[0])) out.push(a);
                if (keep(a[0]) !== keep(z[0])) out.push([c, a[1] + (c - a[0]) / (z[0] - a[0]) * (z[1] - a[1])]);
            }
            return out;
        };
        const home = panes.findIndex(p => p.tone === "launch" && inside(p.poly, c, y));
        if (home < 0) res.straddle = { pass: false, why: "no launch pane under the handbooks button's centre" };
        else {
            LAST.panes = panes.flatMap((p, i) => i === home ? [{ ...p, poly: cut(p.poly, x => x <= c) }, { ...p, poly: cut(p.poly, x => x >= c) }] : [p]);
            const r = read();
            LAST.panes = panes;
            res.straddle = { ...show(r), pass: !r.ok && !r.stale && r.outside > 0 && /own launch pane/.test(r.why) };
        }
    }
    {   // frame
        const LAST = window.__glass.LAST, frame = LAST.frame;
        LAST.frame = { ...frame, inner: [innerWidth + 100, innerHeight] };
        const r = read();
        LAST.frame = frame;
        res.frame = { ...show(r), pass: !r.ok && r.stale && /viewport/.test(r.why) };
    }
    return res;
}

/* Runs in the page: the room check's two planted faults, each read at once and put back. */
async function plantRoom() {
    const tile = document.getElementById("drpg-room-tile"), res = {};
    {   // swapped: the stamp names the other place and no pass has run
        const was = tile.dataset.place;
        tile.dataset.place = was === "clock" ? "notes" : "clock";
        const r = await window.drpgRoomCheck({ cuts: false });
        tile.dataset.place = was;
        res.swapped = { ok: r.ok, why: r.why, pass: !r.ok && /place/.test(r.why) };
    }
    {   // removed
        const parent = tile.parentNode, next = tile.nextSibling;
        tile.remove();
        const r = await window.drpgRoomCheck({ cuts: false });
        parent.insertBefore(tile, next);
        res.removed = { ok: r.ok, why: r.why, pass: !r.ok && /no room tile/.test(r.why) };
    }
    return res;
}

/* Runs in the page: the room pane's controls beside the notices (E78 fix h76-HF4), each read at once and put back. */
async function plantPane() {
    const g = window.__glass, tile = document.getElementById("drpg-room-tile"), res = {};
    const pane = (g.LAST.panes || []).find(p => p.tone === "room-block"), H = document.getElementById("drpg-curtain").getBoundingClientRect().height;
    {   // short of the foot: the room's pane ended PAD_FAR under the box and a plain pane cut from there to the screen's edge - HF4's cut
        const was = [pane.poly, pane.y1], n = g.LAST.panes.length, b = g.LAST.room.box, end = b.y + b.h + 10;
        pane.poly = pane.poly.map(([x, y]) => [x, Math.min(y, end)]); pane.y1 = end;
        g.LAST.panes.push({ tone: "sector", kind: "sector", poly: [[pane.x0, end], [pane.x1, end], [pane.x1, H], [pane.x0, H]], x0: pane.x0, y0: end, x1: pane.x1, y1: H });
        const r = await window.drpgRoomCheck({ cuts: false });
        g.LAST.panes.length = n; [pane.poly, pane.y1] = was;
        res.foot = { ok: r.ok, why: r.why, pass: !r.ok && /above the screen's foot/.test(r.why) && /plain pane/.test(r.why) };
    }
    {   // turned: the tile off its pane's angle - upright where the pane leans, leaning 6 degrees where it stands upright
        const leans = !/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(tile).transform);
        tile.style.setProperty("transition", "none", "important"); tile.style.setProperty("transform", leans ? "none" : "rotate(0.1047rad)", "important");
        const r = await window.drpgRoomCheck({ cuts: false });
        tile.style.removeProperty("transform"); void getComputedStyle(tile).transform; tile.style.removeProperty("transition");
        res.turned = { ok: r.ok, why: r.why, pass: !r.ok && /turns/.test(r.why) };
    }
    {   // crowded: the pips laid on the name's cell
        const pips = tile.querySelector(".drpg-hud-room-tokens");
        pips.style.setProperty("grid-area", "2 / 2", "important");
        const r = await window.drpgRoomCheck({ cuts: false });
        pips.style.removeProperty("grid-area");
        res.crowded = { ok: r.ok, why: r.why, pass: !r.ok && /the name on the pips|the pips on the name/.test(r.why) };
    }
    return res;
}

/* Runs in the page: the voice check's planted faults (E78 fix r2-H1, review round 2's cor F1), each read at once and
   put back - the tile 15 px tall in its full form, as af5eb69 left the GM's at 1366x560, must fail on what it holds;
   the speaker's glyph with no mask must fail on the glyph. */
async function plantVoice() {
    const body = document.body, tile = document.getElementById("drpg-voice-tile"), res = {};
    {   // short
        const was = body.style.getPropertyValue("--drpg-voice-h"), fit = tile.dataset.fit;
        body.style.setProperty("--drpg-voice-h", "15px");
        delete tile.dataset.fit;
        const r = await window.drpgVoiceCheck({ cuts: false });
        body.style.setProperty("--drpg-voice-h", was);
        if (fit) tile.dataset.fit = fit;
        res.short = { ok: r.ok, why: r.why, pass: !r.ok && /outside the tile/.test(r.why) };
    }
    {   // bare
        const i = tile.querySelector(".drpg-voice-speaker > .drpg-pxi"), was = i?.style.getPropertyValue("--drpg-px-mask") ?? "";
        i?.style.removeProperty("--drpg-px-mask");
        const r = await window.drpgVoiceCheck({ cuts: false });
        if (was) i.style.setProperty("--drpg-px-mask", was);
        res.bare = { ok: r.ok, why: r.why, pass: !r.ok && /no glyph/.test(r.why) };
    }
    {   // inward (E78 fix r2-H3): the buttons side by side where 60741cf stood them, 69 px under the pane's top
        const c = tile.querySelector(".drpg-voice-tile-controls"), put = { top: "62px", right: "26px", "flex-direction": "row", gap: "6px" };
        if (tile.dataset.fit !== "compact") for (const [k, v] of Object.entries(put)) c.style.setProperty(k, v, "important");
        const r = await window.drpgVoiceCheck({ cuts: false });
        for (const k of Object.keys(put)) c.style.removeProperty(k);
        res.inward = { ok: r.ok, why: r.why, pass: !r.ok && /not at its corner/.test(r.why) };
    }
    {   // onPlate (H81-10): the state word stood on the name plate at the tile's foot, where 9dcf331 put it under
        // Monokuma Legacy and the compact form, while a face shows (the word is kept with one since H81-10)
        const word = tile.querySelector(".drpg-voice-tile-state"), put = { top: "calc(100% - 30px)", bottom: "auto" };
        for (const [k, v] of Object.entries(put)) word?.style.setProperty(k, v, "important");
        const r = await window.drpgVoiceCheck({ cuts: false });
        for (const k of Object.keys(put)) word?.style.removeProperty(k);
        res.onPlate = { ok: r.ok, why: r.why, pass: !r.ok && /over the name plate/.test(r.why) };
    }
    if (tile.dataset.fit !== "compact") {   // low (H84-03): the state word 6 px under the tile's own top, where d99adf4b stood it
        const word = tile.querySelector(".drpg-voice-tile-state");
        word?.style.setProperty("top", "6px", "important");
        const r = await window.drpgVoiceCheck({ cuts: false });
        word?.style.removeProperty("top");
        res.low = { ok: r.ok, why: r.why, pass: !r.ok && /not beside it/.test(r.why) };
    }
    {   // brush (E78 fix r2-H2): the caption's brush another colour than the game state's
        const plate = tile.querySelector(".drpg-voice-tile-plate");
        plate.style.setProperty("--brush", "rgb(1, 2, 3)");
        const r = await window.drpgVoiceCheck({ cuts: false });
        plate.style.removeProperty("--brush");
        res.brush = { ok: r.ok, why: r.why, pass: !r.ok && /caption's brush/.test(r.why) };
    }
    for (const k of ["push", "recut"]) {   // the list past the edge; a cut while it is open (E78 fix r2-H2)
        const r = await window.drpgVoiceList({ [k]: true });
        const why = r.why.join("; ");
        res[k] = { ok: !r.why.length, why, pass: k === "push" ? /on a screen/.test(why) : /fired [1-9]/.test(why) };
    }
    return res;
}

/* Runs in the page: where no curtain is cut (Monokuma Legacy), the tile 150 px under the screen's foot must fail
   (E78 fix r2-H2); and (H81 fix r1, the review's H81C2-02) the still word stood where dc35104 stood it, in the 69 px
   left of the buttons, must fail on its band. */
async function plantVoiceNone() {
    const tile = document.getElementById("drpg-voice-tile"), was = tile.style.getPropertyValue("bottom"), res = {};
    tile.style.setProperty("bottom", "-150px");
    const r = await window.drpgVoiceCheck({ cuts: false });
    if (was) tile.style.setProperty("bottom", was); else tile.style.removeProperty("bottom");
    res.off = { ok: r.ok, why: r.why, pass: !r.ok && /on a screen/.test(r.why) };
    const style = document.createElement("style");
    style.textContent = "body.drpg-no-ticker #drpg-voice-tile .drpg-voice-tile-state { top: 6px !important; right: 76px !important; }";
    document.head.append(style);
    const c = await window.drpgVoiceCheck({ cuts: false });
    style.remove();
    res.cramped = { ok: c.ok, why: c.why, pass: !c.ok && /standing still the state word's band holds/.test(c.why) };
    return res;
}

/* Runs in the page: on a stacked screen, the face let shrink round a short name as dc35104 let it (H81 fix r1, the
   review's H81C2-03) must fail on the word's band. */
async function plantVoiceRow() {
    const style = document.createElement("style");
    style.textContent = "body.drpg-stacked #drpg-tile-row .drpg-voice-tile-face { min-width: 0 !important; }";
    document.head.append(style);
    const r = await window.drpgVoiceCheck({ cuts: false });
    style.remove();
    return { shortName: { ok: r.ok, why: r.why, pass: !r.ok && /with a three-letter name the state word's band holds/.test(r.why) } };
}

/* Runs in the page: the pin's control (E77 fix r1-M1) - the clock made `px` taller (its own min-height, which wins
   over a max-height), so F falls 40 px short of the smallest box; the place read and the room check run at that
   other place (under Legacy the only reading of its place beside the notices: no size of the sweep reaches it), and
   the page put back. Nothing here calls a pass: the clock changing size is what must move the tile, through the
   module's own observers (Stained Glass's on its blocks, `schedule`; Legacy's on the clock and its neighbours,
   `placeFlatRoomTile`), as at a table where nobody calls one either. The wait covers the turn as well: the move
   recuts the curtain, and for the turn's length the old curtain's ghost stands between the picture and its glow -
   read at 1500 ms the room check failed on exactly that, and from 2000 ms on the order was back (Stained,
   1920x1080, 13.10.2026). */
async function plantPin(px) {
    const hud = document.getElementById("drpg-hud"), g = window.__glass, tile = document.getElementById("drpg-room-tile");
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const pass = async () => { await wait(1500); for (let i = 0; i < 50 && document.querySelector(".drpg-curtain-ghost"); i++) await wait(100); };
    hud.style.setProperty("max-height", "none", "important"); hud.style.setProperty("min-height", (hud.offsetHeight + px) + "px", "important");
    await pass();
    const res = { px, got: tile?.dataset.place ?? "-", F: g.LAST.room?.F ?? null, check: await window.drpgRoomCheck({ cuts: false }) };
    hud.style.removeProperty("min-height"); hud.style.removeProperty("max-height");
    await pass();
    return res;
}

/* Runs in the page: the notice check's `fill` controls (E79 C13), each planted as a rule of its own, read and taken out. */
async function plantFill() {
    const res = {}, FAULTS = {
        upright: ["#drpg-note-frame { clip-path: none !important; }", /the frame's outline is/],
        plate: ["body #drpg-popups .drpg-popup-body { background-color: rgba(7, 6, 11, 0.42) !important; }", /keeps a plate or an edge/],
        wall: ["body #drpg-popups .drpg-popup { margin-left: -60px !important; }", /line boxes of the card's words outside/],
        edgeless: ["body #drpg-popups .drpg-popup { border-left-width: 0 !important; }", /with two short cards the left edges read/]
    };
    for (const [k, [rule, re]] of Object.entries(FAULTS)) {
        const style = document.createElement("style");
        style.textContent = rule;
        document.head.append(style);
        const n = await window.drpgNoticeCheck();
        style.remove();
        res[k] = { ok: n.ok, why: n.why, pass: !n.ok && re.test(n.why) };
    }
    return res;
}

/* Runs in the page: the row reading's planted fault, read at once and put back (E77 C8). */
async function plantRow() {
    const row = document.getElementById("drpg-tile-row"), was = row?.style.height ?? "";
    if (row) row.style.height = "60px";
    const r = await window.drpgRoomCheck({ cuts: false });
    if (row) row.style.height = was;
    return { tall: { ok: r.ok, why: r.why, pass: !r.ok && /the row is 60 px/.test(r.why) } };
}

/* Runs in the page: the corner with a camera dock shown and hidden (E19 C7; THE CAMERA DOCK SHOWN AND HIDDEN, above).
   `plant` holds the lift at 0px with the dock shown (the control); `keep` leaves the page in "shown" or "hidden" for a
   screenshot, `restore` puts it back. camera-view.mjs is imported with the stand-ins drpgVoiceList lends voice-tile.mjs
   (its imports reach Foundry's globals), each lent only where missing and taken back after.
   THE NOTICE TILE IS JUDGED TOO (E19 fix r1-G2, 19.10.2026; the review's E19-COR-7). Until the fix a Stained Glass desk's
   tile stood where glass.mjs cut its pane, which read no dock, and its crossing was printed, not judged: 100, 125 and
   130 px into a 200 px dock at the sweep's sizes, against the handbook's promise. glass.mjs now stands the pane's foot on
   the lift and cuts the curtain again on camera-view.mjs's `drpg-av-lift` event (150 ms debounced), so each reading
   after a change of the lift waits for that cut (`settle`), and the put-back sends the event too. */
async function dockCheck({ plant = false, keep = null, restore = false } = {}) {
    const body = document.body, HIDDEN = "drpg-dock-hidden";
    const st = window.__dockState ??= { liftWas: body.style.getPropertyValue("--drpg-av-lift"), hiddenWas: body.classList.contains(HIDDEN) };
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const settle = async () => { await new Promise(r => setTimeout(r, 600)); await frame(); };
    const putBack = () => {
        document.getElementById("camera-views")?.remove();
        body.classList.toggle(HIDDEN, st.hiddenWas);
        if (st.liftWas) body.style.setProperty("--drpg-av-lift", st.liftWas); else body.style.removeProperty("--drpg-av-lift");
        window.dispatchEvent(new Event("drpg-av-lift"));
        delete window.__dockState;
    };
    if (restore) { putBack(); await settle(); return { ok: true }; }
    const added = [], lend = (owner, key, value) => { if (owner[key] === undefined) { owner[key] = value; added.push([owner, key]); } };
    const any = () => new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : any()), construct: () => ({}), apply: () => undefined });
    const Base = class {};
    lend(globalThis, "foundry", {});
    const F = globalThis.foundry;
    lend(F, "applications", { api: { DialogV2: Base, ApplicationV2: Base, HandlebarsApplicationMixin: c => c, DocumentSheetV2: Base }, ux: any(), handlebars: any(), sheets: any(), apps: any(), elements: any(), instances: new Map() });
    for (const k of ["appv1", "documents", "canvas", "helpers", "dice", "data"]) lend(F, k, any());
    for (const k of ["CONST", "Actor", "Item", "ChatMessage", "Roll", "Scene", "User", "JournalEntry", "Macro", "Playlist", "Folder", "TextEditor", "Dialog",
      "Application", "FormApplication", "FilePicker", "canvas", "socket", "Handlebars", "loadTemplates", "renderTemplate", "fromUuid", "fromUuidSync",
      "AudioHelper", "Token", "TokenDocument", "Combat"]) lend(globalThis, k, any());
    let CV = null, loadError = null;
    try { CV = await import("/scripts/camera-view.mjs"); } catch (err) { loadError = String(err); }
    for (const [owner, key] of added.reverse()) delete owner[key];
    if (!CV) { putBack(); return { ok: false, why: `camera-view.mjs did not load here: ${loadError}` }; }
    const ids = ["drpg-messenger-launcher", "drpg-sound-launcher", "drpg-book-launcher", "drpg-gm-launcher", "drpg-foundry-tools", "drpg-popups"];
    const parts = ids.map(id => document.getElementById(id)).filter(el => el && el.offsetWidth > 0 && el.offsetHeight > 0);
    const boxes = () => parts.map(el => { const b = el.getBoundingClientRect(); return { id: el.id, top: b.top, bottom: b.bottom, left: b.left }; });
    const lift = () => getComputedStyle(body).getPropertyValue("--drpg-av-lift").trim();
    const height = Math.min(200, Math.floor(innerHeight / 2)), why = [];
    body.classList.remove(HIDDEN);
    body.style.setProperty("--drpg-av-lift", "0px");
    await frame();
    const bare = boxes();
    const dock = document.createElement("section");
    dock.id = "camera-views";
    dock.style.cssText = `position: fixed; left: 0; right: 0; bottom: 0; height: ${height}px; background: rgba(40, 160, 220, 0.55); z-index: 1`;
    body.prepend(dock);
    if (plant) body.style.setProperty("--drpg-av-lift", "0px"); else CV.measureCameraDock();
    await settle();
    const top = dock.getBoundingClientRect().top, shown = { lift: lift(), boxes: boxes() };
    const crossing = shown.boxes.filter(b => b.bottom > top + 0.5).map(b => `${b.id} ${Math.round(b.bottom)}`);
    if (shown.lift !== `${height}px`) why.push(`shown: the lift ${shown.lift}, not the dock's ${height}px`);
    if (crossing.length) why.push(`shown: past the dock's top at ${Math.round(top)}: ${crossing.join(", ")}`);
    if (keep === "shown") return { ok: !why.length, why: why.join("; ") };
    body.classList.add(HIDDEN);
    CV.measureCameraDock();
    await settle();
    const hidden = { lift: lift(), display: getComputedStyle(dock).display, boxes: boxes() };
    const moved = hidden.boxes.filter((b, i) => Math.abs(b.top - bare[i].top) > 0.5 || Math.abs(b.left - bare[i].left) > 0.5).map(b => b.id);
    if (hidden.display !== "none") why.push(`hidden: the dock computes display ${hidden.display}`);
    if (hidden.lift !== "0px") why.push(`hidden: the lift ${hidden.lift}`);
    if (moved.length) why.push(`hidden: not where they stand with no dock: ${moved.join(", ")}`);
    body.style.setProperty("--drpg-av-lift", "300px");
    const written = lift();
    if (written !== "0px") why.push(`hidden: 300px written inline reads ${written}`);
    if (keep === "hidden") { CV.measureCameraDock(); await settle(); return { ok: !why.length, why: why.join("; ") }; }
    putBack();
    await settle();
    return { ok: !why.length, why: why.join("; "), height, shown: shown.lift, hidden: hidden.lift, written, parts: parts.length };
}

/* Runs in the page after a resize to a desk: the stack taken down and the tile and the clock back (E77 C8). */
function deskAgain() {
    const tile = document.getElementById("drpg-room-tile"), hud = document.getElementById("drpg-hud"), left = document.getElementById("ui-left-column-1");
    const prev = tile?.previousElementSibling;
    const under = prev === hud || (prev?.id === "drpg-floors" && prev.previousElementSibling === hud);
    const got = { column: Boolean(document.getElementById("drpg-column")), row: Boolean(document.getElementById("drpg-tile-row")),
        place: tile?.dataset.place ?? null, tile: tile?.parentElement === document.body ? "body" : under ? "under the clock" : (prev?.id || tile?.parentElement?.id || "gone"),
        clockFirst: hud?.parentElement === left && left.firstElementChild === hud };
    const ok = !got.column && !got.row && got.clockFirst && (got.place === "notes" ? got.tile === "body" : got.tile === "under the clock");
    return { ok, why: JSON.stringify(got), pass: ok };
}

const trayControlled = new Set();
let lines = 0, themeOff = 0, bad = 0, glassSizes = 0, controlled = false, roomControlled = new Set(), pinControlled = new Set(), unpinned = 0, unboxed = 0, rowControlled = false, paneControlled = false, stackedRead = false, placesControlled = false, placesRead = false, voiceRead = false, voiceControlled = false, voiceNoneControlled = false, voiceRowControlled = false, idleRead = false, fillControlled = false, objectionControlled = false, dockControlled = false;
try {
    for (const theme of themes) for (const role of roles) {
        const qs = [theme === "legacy" ? "theme=legacy" : "", role === "player" ? "role=player" : ""].filter(Boolean);
        const query = qs.length ? (page0.includes("?") ? "&" : "?") + qs.join("&") : "";
        for (const size of SIZES) {
            const [W, H] = size.split("x").map(Number);
            const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: corner ? 2 : 1 });
            const errs = [];
            page.on("pageerror", e => errs.push(e.message));
            await page.goto(`${base}/${page0}${query}`);
            await page.waitForFunction(() => window.__glass, null, { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(waitMs);
            const r = await page.evaluate(sel => {
                const g = window.__glass, c = g?.CHECKS?.at(-1) ?? null;
                return { c: c && { ov: c.overlaps, nc: c.nonconvex, bf: c.blockFails, eg: c.edgeGaps, ff: c.fitFails, n: c.count },
                         has: typeof window.drpgLaunchOutside === "function", lo: window.drpgLaunchOutside?.(sel ?? undefined) ?? null,
                         tile: !!document.getElementById("drpg-notices-corner"), stacked: document.body.classList.contains("drpg-stacked"),
                         report: g?.glassReport?.() ?? "" };
            }, sel);
            let line = `${theme.padEnd(7)} ${role.padEnd(6)} ${size.padEnd(10)}` + (r.stacked ? " stacked" : " desk   ");
            lines++;
            const fails = [];
            if (idleS > 0 && theme === "stained" && r.c && !r.stacked) {
                const v = await page.evaluate(idle, idleS * 1000);
                line += ` | idle ${v.passes}/${v.starts} shift ${v.shifts.join(",") || "-"}`;
                if (v.passes || v.starts) fails.push(`idle: ${v.passes} pass(es) and ${v.starts} transform transition(s) in ${idleS} s with nothing done (${JSON.stringify(v.moved)})`);
                idleRead = true;
            }
            if (!r.has) fails.push("the page defines no drpgLaunchOutside");
            else if (!r.c) {
                line += " no glass (" + (r.report || "-").slice(0, 60) + ")";
                /* Only the stack that scrolls (844x390, 640x360) and the Legacy theme draw no glass by design -
                   `?theme=legacy` swaps the body's class, and until E77 fix r1-M1 the curtain stayed mounted at
                   0x0 and was cut for nothing (13.10.2026, every size); since then the page's theme setting is
                   Legacy as well and no curtain is mounted ("theme off") - and there the count says it is no
                   answer, and why, rather than a number (P28: it returned null for three reasons). Under Legacy
                   the three launchers are still drawn, so they are still counted: found and none hidden. */
                const legacy = theme === "legacy";
                if (legacy && /theme off/.test(r.report)) themeOff++;
                if (!legacy && !/^flat:/.test(r.report)) fails.push("no glass");
                if (!r.lo || r.lo.ok || !/no curtain|no pane toned launch/.test(r.lo.why)) fails.push("drpgLaunchOutside does not say why it is no answer: " + JSON.stringify(r.lo)?.slice(0, 80));
                else {
                    line += ` | found ${r.lo.found}/${r.lo.expected} hidden ${r.lo.hidden.length}`;
                    if (legacy && (r.lo.found !== r.lo.expected || r.lo.hidden.length)) fails.push(r.lo.why);
                }
            } else {
                glassSizes++;
                const c = r.c, lo = r.lo;
                line += ` panes ${c.n} ov ${c.ov} nc ${c.nc} bf ${c.bf} eg ${c.eg} ff ${c.ff}`
                    + ` | ${lo.ok ? "ok" : "NOT ok"} found ${lo.found}/${lo.expected} hidden ${lo.hidden.length} outside ${lo.outside}`
                    + ` (${lo.buttons} buttons, ${lo.corners} corners)${lo.stale ? " stale" : ""}`;
                const off = ["ov", "nc", "bf", "eg"].filter(k => c[k] && known[size + "/" + k] !== c[k]);
                if (off.length) fails.push("self-check " + off.join(","));
                else if (["ov", "nc", "bf", "eg"].some(k => c[k])) line += " (known)";
                if (!lo.ok) fails.push(lo.why);
                const gs = lo.gaps.map(g => g.gap);
                line += gs.length ? ` | gaps ${Math.min(...gs).toFixed(2)}-${Math.max(...gs).toFixed(2)} (${gs.length} pairs)` : " | gaps -";
                if (gs.length < 2) fails.push("fewer than 2 neighbour pairs");
                else if (Math.max(...gs) - Math.min(...gs) > 0.1) fails.push("gaps unequal " + lo.gaps.map(g => g.pair + " " + g.gap).join(", "));
                if (control && !controlled) {
                    controlled = true;
                    const ctl = await page.evaluate(plant, sel);
                    for (const [k, v] of Object.entries(ctl)) {
                        console.log(`  control ${k.padEnd(8)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} found ${v.found}/${v.expected} hidden ${v.hidden} outside ${v.outside} stale ${v.stale} - ${String(v.why).slice(0, 110)}`);
                        if (!v.pass) fails.push("control " + k + " reads as a pass");
                    }
                }
            }
            if (notices) {
                const n = await page.evaluate(() => window.drpgNoticeCheck?.() ?? null);
                if (!n) fails.push("the page defines no drpgNoticeCheck");
                else {
                    line += ` | notices ${n.ok ? "ok" : "NOT ok"}` + (n.ceiling ? ` ceiling ${n.ceiling.asIs.toFixed(0)}/${n.ceiling.docked.toFixed(0)}` : "")
                        + (n.stack ? ` shown ${n.stack.shown}+${n.stack.parked}` : "") + (n.long ? ` long ${n.long.judged ? (n.long.inTile && n.long.scrolls ? "in" : "OUT") : "unjudged"}` : "")
                        + (n.fill?.pane ? ` fill off ${n.fill.off} out ${n.fill.out}/${n.fill.lines}` : n.fill ? ` fill frame ${n.fill.frame}` : "");
                    if (!n.ok) fails.push("notices: " + n.why);
                    if (control && !fillControlled && n.fill?.pane) {
                        fillControlled = true;
                        const ctl = await page.evaluate(plantFill);
                        for (const [k, v] of Object.entries(ctl)) if (!v.pass) fails.push(`fill control ${k} reads as a pass (${v.why || "ok"})`);
                    }
                }
            }
            if (rooms) {
                const rc = await page.evaluate(() => window.drpgRoomCheck?.() ?? null);
                if (!rc) fails.push("the page defines no drpgRoomCheck");
                else {
                    const rw = rc.row;
                    line += ` | room ${rc.ok ? "ok" : "NOT ok"} ` + (rc.expect === "placed" || rc.expect === "flat"
                        ? `${rc.expect === "flat" ? "flat " : ""}${rc.place} F ${rc.F} need ${rc.need} max ${rc.maxH} box ${rc.box ? rc.box.w + "x" + rc.box.h : "-"}`
                        : rc.expect === "row" ? `row ${rw.h} thumb ${rw.thumb?.join("x") ?? "-"} words ${rw.words?.join("x") ?? "-"} block ${rw.block?.h ?? "-"}`
                            + (rw.over ? ` over ${rw.over.got}/${rw.over.control}/${rw.over.first}` : "") : "unplaced")
                        + (rc.clock ? ` dx ${rc.clock.dx} rail +${rc.clock.rail}` : "") + (rc.notes ? ` gap ${rc.notes.gap}/${rc.notes.want} corner ${rc.notes.corner}`
                            + ` pane ${rc.notes.pane?.join("x") ?? "-"} over ${rc.notes.over ?? "-"} plain ${rc.notes.plain ?? "-"} open ${rc.notes.open?.box?.join("x") ?? "-"} ${rc.notes.open?.lines ?? "-"} lines` : "")
                        + (rc.flat ? (rc.place === "clock" ? ` players +${rc.flat.players ?? "-"}${rc.flat.wide ? " wide " + rc.flat.wide.join("/") : ""}` : ` gap ${rc.flat.gap}/16 top ${rc.flat.top} right ${rc.flat.right ?? "-"}`) : "")
                        + (rc.cuts ? ` cuts ${rc.cuts.content}/${rc.cuts.control}/${rc.cuts.recolour}` : "");
                    if (!rc.ok) fails.push("room: " + rc.why);
                    if (theme !== "legacy" && r.c && !r.stacked && rc.expect !== "placed") fails.push("room: a desk with glass reads unplaced");
                    if (theme === "legacy" && !r.stacked && rc.expect !== "flat") fails.push(`room: a Legacy desk reads ${rc.expect}, not placed without a curtain`);
                    /* THE PIN (E77 fix r1-M1, review round 1's O9). The place F chooses at this size, theme and role,
                       as PINS records it: a change of F that moves a size to the other place is a red line here,
                       not a silent one - drpgRoomCheck checks the place against F, and F against nothing. */
                    const got = rc.expect === "row" ? "row" : rc.place ?? "-", pin = PINS[`${theme} ${role} ${size}`];
                    line += pin ? (pin === got ? " | pin ok" : ` | pin ${got}/${pin}`) : " | unpinned";
                    if (pin && pin !== got) fails.push(`room: ${got} where PINS has ${pin}`);
                    if (!pin) unpinned++;
                    /* THE BOX PIN (E78 C0): a placed tile's width and height, as PIN_BOX records them. */
                    const boxPin = PIN_BOX[`${theme} ${role} ${size}`], box = rc.box ? `${rc.box.w}x${rc.box.h}` : "-";
                    if (rc.expect === "placed" || rc.expect === "flat") {
                        line += boxPin ? (boxPin === box ? " | box pin ok" : ` | box ${box}/${boxPin}`) : " | box unpinned";
                        if (boxPin && boxPin !== box) fails.push(`room: box ${box} where PIN_BOX has ${boxPin}`);
                        if (!boxPin) unboxed++;
                    }
                    /* THE PANE PIN (E78 fix h76-HF4): beside the notices, the room pane's bounds as PIN_PANE records them. */
                    const panePin = PIN_PANE[`${theme} ${role} ${size}`], paneGot = rc.notes?.pane ? rc.notes.pane.join("x") : "-";
                    if (panePin || rc.notes) {
                        line += panePin ? (panePin === paneGot ? " | pane pin ok" : ` | pane ${paneGot}/${panePin}`) : " | pane unpinned";
                        if (panePin !== paneGot) fails.push(`room: pane ${paneGot} where PIN_PANE has ${panePin ?? "none"}`);
                    }
                    /* THE TILT PIN (E78 fix r1-G3): beside the notices, the tile's turn in degrees as PIN_TILT records it. */
                    const tiltPin = PIN_TILT[`${theme} ${role} ${size}`], tiltGot = rc.notes ? rc.notes.tilt : undefined;
                    if (tiltPin !== undefined || rc.notes) {
                        line += tiltPin !== undefined ? (tiltPin === tiltGot ? " | tilt pin ok" : ` | tilt ${tiltGot}/${tiltPin}`) : " | tilt unpinned";
                        if (tiltPin !== tiltGot) fails.push(`room: tilt ${tiltGot} where PIN_TILT has ${tiltPin ?? "none"}`);
                    }
                    if (control && !paneControlled && rc.notes) {
                        paneControlled = true;
                        const ctl = await page.evaluate(plantPane);
                        for (const [k, v] of Object.entries(ctl)) {
                            console.log(`  pane control ${k.padEnd(8)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push("pane control " + k + " reads as a pass");
                        }
                    }
                    if (control && !pinControlled.has(theme) && pin === "clock" && got === "clock") {
                        pinControlled.add(theme);
                        const v = await page.evaluate(plantPin, rc.F - rc.need + 40);
                        console.log(`  pin control ${theme.padEnd(8)} ${v.got !== pin ? "sees it" : "MISSES IT"}: a clock ${v.px} px taller reads ${v.got} (F ${v.F}) where PINS has ${pin}`
                            + ` - and there: room ${v.check.ok ? "ok" : "NOT ok"} ${v.check.box ? v.check.box.w + "x" + v.check.box.h : "-"}${v.check.flat ? ` gap ${v.check.flat.gap}/16 top ${v.check.flat.top} right ${v.check.flat.right ?? "-"}` : ""} ${String(v.check.why).slice(0, 110)}`);
                        if (v.got === pin) fails.push("pin control reads as a pass");
                        /* and the box (E78 C0): at the other place the tile's box must not read as this size's pin */
                        const other = v.check.box ? `${v.check.box.w}x${v.check.box.h}` : "-";
                        console.log(`  box control ${theme.padEnd(8)} ${other !== boxPin ? "sees it" : "MISSES IT"}: there the box reads ${other} where PIN_BOX has ${boxPin ?? "none"}`);
                        if (!boxPin || other === boxPin) fails.push("box pin control reads as a pass");
                        if (!v.check.ok) fails.push("room, at the pin control's other place: " + v.check.why);
                    }
                    if (r.stacked) stackedRead = true;
                    if (r.stacked && rc.expect !== "row") fails.push("room: a stacked screen reads no row");
                    if (control && !rowControlled && rc.expect === "row") {
                        rowControlled = true;
                        const ctl = await page.evaluate(plantRow);
                        await page.setViewportSize({ width: 1920, height: 1080 });
                        await page.waitForTimeout(waitMs);
                        ctl.desk = await page.evaluate(deskAgain);
                        await page.setViewportSize({ width: W, height: H });
                        await page.waitForTimeout(waitMs);
                        for (const [k, v] of Object.entries(ctl)) {
                            const said = k === "desk" ? (v.pass ? "holds" : "BROKEN") : v.pass ? "sees it" : "MISSES IT";
                            console.log(`  row control ${k.padEnd(8)} ${said}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push(k === "desk" ? "the desk after the stack: " + v.why : "row control " + k + " reads as a pass");
                        }
                    }
                    if (control && !roomControlled.has(rc.expect) && (rc.expect === "placed" || rc.expect === "flat")) {
                        roomControlled.add(rc.expect);
                        const ctl = await page.evaluate(plantRoom);
                        for (const [k, v] of Object.entries(ctl)) {
                            console.log(`  room control ${k.padEnd(8)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push("room control " + k + " reads as a pass");
                        }
                    }
                }
            }
            if (voices) {
                const vc = await page.evaluate(() => window.drpgVoiceCheck?.() ?? null);
                if (!vc) fails.push("the page defines no drpgVoiceCheck");
                else {
                    const pr = vc.parts;
                    line += ` | voice ${vc.ok ? "ok" : "NOT ok"} ${vc.expect}` + (vc.box && vc.expect === "wall" ? ` ${vc.box} ${vc.fit} open ${vc.open} shards ${vc.shards}` : "")
                        + (pr ? ` plate ${pr.plate?.join(",") ?? "-"} name ${pr.name?.join("/") ?? "-"} buttons ${pr.buttons.map(b => b?.join(",") ?? "-").join(" ")}` : "")
                        + (vc.cuts ? ` cuts ${vc.cuts.speech}/${vc.cuts.control.join("+")}` : "") + (vc.row ? ` row ${vc.row.box.join(",")}` : "")
                        + (vc.row?.still ? ` short-name band ${vc.row.still.join("/")}` : "") + (vc.still ? ` still band ${vc.still.join("/")}` : "")
                        + (vc.expect === "none" && vc.box ? ` box ${vc.box}` : "")
                        + ` brush ${vc.brush && typeof vc.brush === "object" ? (vc.brush.got === vc.brush.want ? "state" : vc.brush.got) : vc.brush ?? "-"}`
                        + (vc.list ? ` list ${vc.list.box?.join(",") ?? "-"} rows ${vc.list.rows} cuts ${vc.list.cuts}` : "");
                    if (!vc.ok) fails.push("voice: " + vc.why);
                    /* THE CORNER PIN (E78 fix r2-H3): on the wall, each button's centre from the screen's right edge and under
                       the pane's top, as PIN_CORNER records them ("-" where the tile is compact and the buttons keep H1's row). */
                    if (vc.expect === "wall") {
                        const cornerPin = PIN_CORNER[`${theme} ${role} ${size}`], cornerGot = pr?.corner?.length ? pr.corner.map(c => c.join(",")).join(" ") : "-";
                        line += cornerPin ? (cornerPin === cornerGot ? " | corner pin ok" : ` | corner ${cornerGot}/${cornerPin}`) : ` | corner ${cornerGot} unpinned`;
                        if (cornerPin !== cornerGot) fails.push(`voice: buttons at ${cornerGot} where PIN_CORNER has ${cornerPin ?? "none"}`);
                    }
                    if (theme !== "legacy" && r.c && !r.stacked && vc.expect !== "wall") fails.push(`voice: a desk with glass reads ${vc.expect}`);
                    if (vc.expect === "wall") voiceRead = true;
                    if (control && !voiceNoneControlled && vc.expect === "none" && theme === "legacy" && !r.stacked) {
                        voiceNoneControlled = true;
                        const ctl = await page.evaluate(plantVoiceNone);
                        for (const [k, v] of Object.entries(ctl)) {
                            console.log(`  voice control ${k.padEnd(6)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push("voice control " + k + " reads as a pass");
                        }
                    }
                    if (control && !voiceRowControlled && vc.expect === "row" && vc.row?.still) {
                        voiceRowControlled = true;
                        const ctl = await page.evaluate(plantVoiceRow);
                        for (const [k, v] of Object.entries(ctl)) {
                            console.log(`  voice control ${k.padEnd(6)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push("voice control " + k + " reads as a pass");
                        }
                    }
                    if (control && !voiceControlled && vc.expect === "wall") {
                        voiceControlled = true;
                        const ctl = await page.evaluate(plantVoice);
                        for (const [k, v] of Object.entries(ctl)) {
                            console.log(`  voice control ${k.padEnd(6)} ${v.pass ? "sees it" : "MISSES IT"}: ok ${v.ok} - ${String(v.why).slice(0, 110)}`);
                            if (!v.pass) fails.push("voice control " + k + " reads as a pass");
                        }
                    }
                }
            }
            /* THE PROJECTS TRAY'S ICONS (H84-05, 27.10.2026): every size, both roles, the page's `drpgTrayIcons` - each
               Font Awesome icon of Daggerheart's tray rows must compute a Font Awesome face over the page's stand-in
               for Font Awesome's own rule. Its control, once, under Stained Glass: the tray rule as d99adf4b had it put
               back for the reading, which must read not ok (under Legacy that rule matches nothing: the page's note).
               The line prints `tray ok <icons read>`. */
            {
                const ti = await page.evaluate(() => window.drpgTrayIcons?.() ?? null);
                if (!ti) fails.push("the page defines no drpgTrayIcons");
                else {
                    line += ` | tray ${ti.why.length ? "NOT ok" : "ok"} ${ti.read.length}`;
                    if (ti.why.length) fails.push("tray: " + ti.why.join("; "));
                    if (control && theme === "stained" && !trayControlled.has(theme)) {
                        trayControlled.add(theme);
                        const ctl = await page.evaluate(() => window.drpgTrayIcons({ plant: true }));
                        const pass = ctl.why.some(w => /not Font Awesome/.test(w));
                        console.log(`  tray control chrome ${pass ? "sees it" : "MISSES IT"}: ${ctl.why.join("; ").slice(0, 110)}`);
                        if (!pass) fails.push("tray control chrome reads as a pass");
                    }
                }
            }
            if (windows) {
                const fc = await page.evaluate(() => window.drpgFoundryCut?.() ?? null);
                if (!fc) fails.push("the page defines no drpgFoundryCut");
                else {
                    line += ` | windows ${fc.ok ? "ok" : "NOT ok"} ${fc.expect}` + (fc.cuts ? ` cuts ${fc.cuts.open}/${fc.cuts.control}` : "") + (fc.fit ? ` fit ${fc.fit}` : "")
                        + (fc.face ? ` face ${fc.face.text}/${fc.face.icon}` : "");
                    if (!fc.ok) fails.push("windows: " + fc.why);
                }
                const wc = await page.evaluate(() => window.drpgWindowsCheck?.() ?? null);
                if (!wc) fails.push("the page defines no drpgWindowsCheck");
                else {
                    const at = r => r ? `${r.x},${r.y} ${r.w}x${r.h}` : "-";
                    if (wc.expect === "windows") line += ` | places ${wc.ok ? "ok" : "NOT ok"} drag ${wc.drag?.to?.join(",") ?? "-"} ft ${at(wc.clamp?.ftools)} mt ${at(wc.clamp?.maptools)}`
                        + ` raw ${wc.raw ? "off" : "on"} focus ${wc.focus?.kept ? "kept" : "LOST"}/${wc.focus?.cuts ?? "-"}`
                        // E79 C12: Foundry tools' width expanded / collapsed by Foundry's caret (drpgWindowsCheck `collapse`)
                        + ` collapse ${wc.collapse ? `${wc.collapse.wide}/${wc.collapse.narrow} head ${wc.collapse.head}` : "-"}`;
                    if (!wc.ok) fails.push("places: " + wc.why);
                    if (wc.raw) placesControlled = true;
                    if (wc.expect === "windows") placesRead = true;
                }
            }
            if (objections) {
                const oc = await page.evaluate(() => window.drpgObjectionCheck?.() ?? null);
                if (!oc) fails.push("the page defines no drpgObjectionCheck");
                else {
                    line += ` | objection ${oc.ok ? "ok" : "NOT ok"} ${oc.button ? `${oc.button[2]}x${oc.button[3]} chevron ${oc.chevron[2]}x${oc.chevron[3]}` : "-"}`;
                    if (!oc.ok) fails.push("objection: " + oc.why);
                    if (control && !objectionControlled && oc.ok) {
                        objectionControlled = true;
                        for (const plant of ["small", "out"]) {
                            const v = await page.evaluate(p => window.drpgObjectionCheck({ plant: p }), plant);
                            console.log(`  objection control ${plant.padEnd(5)} ${v.ok ? "MISSES IT" : "sees it"}: ${String(v.why).slice(0, 110)}`);
                            if (v.ok) fails.push("objection control " + plant + " reads as a pass");
                        }
                    }
                }
            }
            if (docks) {
                const dc = await page.evaluate(dockCheck, {});
                line += ` | dock ${dc.ok ? `${dc.shown}/${dc.hidden}` : "NOT ok"}`;
                if (!dc.ok) fails.push("dock: " + dc.why);
                if (control && !dockControlled && dc.ok) {
                    dockControlled = true;
                    const v = await page.evaluate(dockCheck, { plant: true });
                    await page.evaluate(dockCheck, { restore: true });
                    console.log(`  dock control  ${v.ok ? "MISSES IT" : "sees it"}: ${String(v.why).slice(0, 140)}`);
                    if (v.ok) fails.push("dock control reads as a pass");
                }
            }
            if (!r.tile) fails.push("no #drpg-notices-corner");
            if (errs.length) line += " | pageerror " + errs[0].slice(0, 80);
            if (fails.length) { bad++; line += "  FAIL: " + fails.join("; "); }
            console.log(line);
            if (shots) {
                const file = `${shots}/${theme}-${role}-${size}${corner ? "-corner" : ""}.png`;
                await page.screenshot(corner ? { path: file, clip: { x: W - 200, y: H - 230, width: 200, height: 230 } } : { path: file });
                if (docks) for (const state of ["shown", "hidden"]) {
                    await page.evaluate(dockCheck, { keep: state });
                    await page.screenshot({ path: `${shots}/${theme}-${role}-${size}-dock-${state}.png` });
                    await page.evaluate(dockCheck, { restore: true });
                }
                /* a player's trial row, idle, held and hovered for its preview: the clock and 12 px round it */
                if (objections && role === "player") for (const state of ["idle", "held", "preview"]) {
                    await page.evaluate(s => window.drpgObjectionCheck?.({ keep: s }), state);
                    if (state === "preview") await page.hover("#drpg-hud .drpg-hud-objection").catch(() => {});
                    const hb = await page.evaluate(() => { const r = document.getElementById("drpg-hud")?.getBoundingClientRect(); return r && { x: r.left, y: r.top, w: r.width, h: r.height }; });
                    if (hb) { const x = Math.max(0, Math.floor(hb.x - 12)), y = Math.max(0, Math.floor(hb.y - 12));
                        await page.screenshot({ path: `${shots}/${theme}-${role}-${size}-objection-${state}.png`, clip: { x, y, width: Math.min(W - x, Math.ceil(hb.w + 24)), height: Math.min(H - y, Math.ceil(hb.h + 24)) } }); }
                    await page.mouse.move(0, 0);
                    await page.evaluate(() => window.drpgObjectionCheck?.restore?.());
                }
            }
            await page.close();
        }
    }
    /* THE IDLE READING'S CONTROL (E78 fix h76-HF2): a fault it must see, on a page of its own. */
    if (idleS > 0 && control && idleRead) {
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        await page.goto(`${base}/${page0}`);
        await page.waitForFunction(() => window.__glass, null, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(waitMs);
        const still = await page.evaluate(idle, idleS * 1000);
        const col = await page.evaluate(() => { const c = document.getElementById("ui-right-column-1"); if (c) c.style.translate = "24px 0"; return Boolean(c); });
        const ctl = col ? await page.evaluate(idle, idleS * 1000) : null;
        await page.close();
        console.log(`  idle control: as loaded ${still.passes}/${still.starts} | the column 24 px towards the wall ${ctl ? `${ctl.passes}/${ctl.starts} ${JSON.stringify(ctl.moved)} - ${ctl.passes && ctl.starts ? "sees it" : "MISSES IT"}` : "NO COLUMN"}`);
        if (!ctl || !ctl.passes || !ctl.starts) { bad++; console.log("FAIL: the idle reading's control - a column moved towards the wall read no pass or no transition, so the reading cannot see one"); }
    }
    /* NO SPARE STRIP AT A RIGHT WALL WITH NO RAIL (E78 C6, S12-95). The harness's page always has Foundry's
       sidebar tabs, and the curtain is not recut for a rail taken away from a page already loaded (.claude/rules/code.md), so
       the page is loaded without them - the response rewritten - once as it is and once with glass.mjs's
       no-rail branch put back to the spare band (the control). Without the voice tile too: the shard stood under
       the tray, where the voice tile's pane now drops it (14.10.2026, the desk's cut on 1920x1080 blocks: the shard
       1791..1920 x 263..642 without the tile, none with it), so a page with the tile could not see the shard
       come back. Read at 1920x1080 for a player, Stained Glass. */
    if (voices && control && themes.includes("stained")) {
        const railless = async patch => {
            const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
            const fix = { page: false, glass: !patch };
            await page.route(/glass-harness\.html/, async route => { const res = await route.fetch(), t = await res.text();
                const body = t.replace(/<nav id="sidebar-tabs">[\s\S]*?<\/nav>/, "").replace(/<section id="drpg-voice-tile"[\s\S]*?<\/section>/, "");
                fix.page = !body.includes('id="sidebar-tabs"') && !body.includes('id="drpg-voice-tile"'); await route.fulfill({ response: res, body }); });
            if (patch) await page.route(/scripts\/glass\.mjs/, async route => { const res = await route.fetch(), t = await res.text();
                const body = t.replace("railed || !side ? tb : null", "tb"); fix.glass = body !== t; await route.fulfill({ response: res, body }); });
            await page.goto(`${base}/${page0}${page0.includes("?") ? "&" : "?"}role=player`);
            await page.waitForFunction(() => window.__glass, null, { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(waitMs);
            const got = await page.evaluate(() => ({ rail: Boolean(document.getElementById("sidebar-tabs")), cut: Boolean(window.__glass?.LAST?.panes?.length),
                shards: (window.__glass?.LAST?.panes ?? []).filter(p => p.shard && p.x1 > innerWidth / 2).length }));
            await page.close();
            return { ...got, ...fix };
        };
        const [as, back] = [await railless(false), await railless(true)];
        const said = v => `rail and voice tile ${v.rail ? "STILL THERE" : "gone"}, ${v.cut ? "cut" : "NOT CUT"}, ${v.shards} shard(s) at the right`;
        console.log(`  S12-95 no rail: ${said(as)} | control, the spare band back${back.glass ? "" : " (NOT PATCHED)"}: ${said(back)}`);
        if (!as.page || as.rail || !as.cut || as.shards) { bad++; console.log("FAIL: S12-95 - a right wall with no rail has a spare strip shard, or the page was not read without its rail"); }
        if (!back.glass || !back.cut || back.shards < 1) { bad++; console.log("FAIL: S12-95's control - the spare band put back shows no shard, so the reading cannot see one"); }
    }
} finally { await browser.close(); srv?.kill(); }
if (voices && !opt("--sizes") && !voiceRead) { bad++; console.log("FAIL: the voice check never read a tile at the wall (no desk drew glass)"); }
if (control && voices && stackedRead && !voiceRowControlled) { bad++; console.log("FAIL: the voice row's control never ran (no stacked size read the word over a face)"); }
/* THE LAUNCHERS' CONTROLS UNDER MONOKUMA LEGACY (E77 fix r2-H3, 13.10.2026; fix r1-M1's open line). They plant faults
   on the launch pane, and under Legacy no curtain is mounted, so there is no pane to plant them on: a Legacy-only sweep
   ended red here on every run since r1-M1 for a reason nobody was going to fix. Not applicable is now an answer read off
   the page - every line drew no glass and its page said "theme off" - and anything else that drew no glass still fails. */
if (control && !controlled) {
    if (lines && themeOff === lines) console.log(`  launchers' controls: not applicable - ${lines} line(s), every one Monokuma Legacy's with no curtain mounted ("theme off"); each counted its launchers found and none hidden`);
    else { bad++; console.log("FAIL: the controls never ran (no size drew glass)"); }
}
if (control && rooms && !roomControlled.size) { bad++; console.log("FAIL: the room controls never ran (no size placed the tile)"); }
if (control && rooms && themes.includes("legacy") && !roomControlled.has("flat")) { bad++; console.log("FAIL: the Legacy room controls never ran (no Legacy desk placed the tile)"); }
if (rooms && !opt("--sizes") && unpinned) { bad++; console.log(`FAIL: ${unpinned} line(s) of the default sizes have no pin in PINS`); }
if (rooms && !opt("--sizes") && unboxed) { bad++; console.log(`FAIL: ${unboxed} placed line(s) of the default sizes have no box in PIN_BOX`); }
if (control && rooms && !opt("--sizes") && themes.some(t => !pinControlled.has(t))) { bad++; console.log("FAIL: a theme's pin control never ran (no size of it pinned 'clock' read 'clock')"); }
if (control && rooms && !opt("--sizes") && themes.includes("stained") && !paneControlled) { bad++; console.log("FAIL: the pane controls never ran (no Stained Glass size placed the tile beside the notices)"); }
if (control && notices && themes.includes("stained") && !fillControlled) { bad++; console.log("FAIL: the fill controls never ran (no Stained Glass desk read the card on its pane)"); }
if (control && rooms && stackedRead && !rowControlled) { bad++; console.log("FAIL: the row controls never ran (no stacked size read a row)"); }
if (control && docks && lines && !dockControlled) { bad++; console.log("FAIL: the dock's control never ran (no size read the dock ok)"); }
if (control && objections && lines && !objectionControlled) { bad++; console.log("FAIL: the objection controls never ran (no size read the trial row ok)"); }
if (control && themes.includes("stained") && !trayControlled.has("stained")) { bad++; console.log("FAIL: the tray's control never ran (no Stained Glass page was read)"); }
if (windows && placesRead && !placesControlled) { bad++; console.log("FAIL: the places' control never read an unclamped place off the screen or on the cluster"); }
console.log(`SWEEP ${bad ? "RED" : "GREEN"}: ${themes.length} theme(s) x ${roles.length} role(s) x ${SIZES.length} sizes, ${glassSizes} with glass, ${bad} failing`);
process.exit(bad ? 1 : 0);
