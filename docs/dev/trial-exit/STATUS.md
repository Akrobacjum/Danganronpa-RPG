# The Class Trial's hand-over and exit - STATUS

The owner's decisions of 12.11.2026 ("Akcept wszystko" on the exit's defaults; "calosc blyska, bug pulsu" on the
entry). Base: 421f2395 (1.2.109).

## 1. The entry's hand-over (the blink)

What blinked (the seam report, measured on the glass harness in headless Chromium, 1366x768, deviceScaleFactor 1, a
frame about every 100 ms): the entry laid its copies of the curtain over the live one and left the live one standing,
so the glass was drawn twice from the first frame; a 10 % Bone wash stood over the whole screen at 900 ms; the copies'
pulse stood at the start while the live pulse ran, and the host went in one frame with the glow and the interface.

What changed:
- `.drpg-seq-pulse` is gone (sequence.mjs, danganronpa.css): no wash over the closed curtain. A seams-only pulse inside
  the closed canvas was not built: the closed look carries the curtain's own pulse of its moment.
- glass.mjs: `holdPulse` / `pulseNow` stop the pulse's clock from the moment the pieces are taken to the sequence's end;
  `holdCurtain` takes the live curtain and its glow to 0 under the copies and brings them back; `snapshotLook` bakes the
  glow into the sequence's looks; `rebuildAll` paints a recut without turning while the curtain is held.
- sequence.mjs: the copies rise over `handIn` (500 ms) as the live curtain falls, and fall over `hand` (400 ms) at the
  end as it rises; `coverBlocks` fades the clock, Despair, the event panel, the status, the tray and the launchers out
  with the tiles over `handIn` and back in over `handIn` from the opening, each by its own animation (a CSS transition
  lost the cascade to stained-glass.css's `transition` on the same blocks and went in one frame).

The probe (the seam report's probe.mjs, unchanged but for its port), whole-frame mean luma, the largest step between
consecutive frames (about 100-160 ms apart; "a frame" below) in each window, and that step per 100 ms; base one run, after
two runs (1366x768, deviceScaleFactor 1, GM):

| | start (host in to +700 ms) | at 900 ms | title in / out | end (from +3200 ms to the host gone +400) |
| --- | --- | --- | --- | --- |
| base 421f2395 | -11.3 in one frame | +13.5 then -7.9, -7.1 (the wash) | +7.7 / -8.0 | +6.1 / +7.1 |
| after | -3.8 / -4.6 a frame, 3.4 per 100 ms (the curtain closing and the blocks fading over 500 ms) | +0.9 | +7.2 / -3.2..-3.8 | +1.8 a frame, 1.5 per 100 ms |

The plain glass (x30-250, y470-640): base -8.7 in the first frame and +9.3 in the last; after, at most 1.4 at the start
and 1.9 at the end. The hand-back took 300 ms first (the seam report's 200-300): the exit's last frames read +3.1 and
+4.4 apart; at 400 ms at most +2.9 in six runs. What stays over 3 is the sequence's own content: the title arriving
(+7) and leaving (-3 to -4). Curve: scratchpad trialexit/shots/0-curve-after-entry-exit-harness.png (not in the
repository). Not measured: a real Foundry table (LIVE-E61-01), deviceScaleFactor 2, a player's browser.

## 2. The trial's exit, and Edit campaign's silence

The owner's decision of 12.11.2026, every default accepted:

- **The exit** (sequence.mjs `playTrialExit`, `trialExitKey`; glass.mjs `exitPieces`): the entry's frames on the cut the
  trial leaves - the panes close in Daily Life's colour at this hour, TRIAL ADJOURNED / KONIEC ROZPRAWY and "Chapter N ·
  Back to school" / "Rozdział N · Powrót do szkoły" on the closed curtain, and they open onto the cut the screen has at
  the exit's start (its one fixed time; a recut under the held curtain paints without turning and the copies hand over
  to it). 3.4 s, the still frame 1.5 s; the lids under Monokuma Legacy and on a stacked screen; Escape skips it; no sound
  of its own (End the trial's card carries `trialClose`). The key is the trial's end stamp (`trialEndedAt`), so a
  chapter's end whose next morning lands in the same run of the clock's row still names its exit once. A title longer
  than CLASS TRIAL's stands at four fifths (`is-long`): at full size TRIAL ADJOURNED ran about 160 px out of its band
  under Legacy at 1366x768.
- **transitions.mjs**: `transitionFor` gives the exit `{ kind: "trialExit", owner: "E61" }` (no direction for the
  curtain), with `newDay` when the same write opened a later day; `onClockHeard` starts the exit, and the day's boards
  wait for its end (`whenTrialExitEnds`). With the switch off the exit plays nothing and the curtain turns
  from the centre, as before.
- **The silence (the marker)**: `clock.trialCut`, written by `setClock` on every crossing of the trial's edge - true only
  when the write says `trialCut: true`, which Start the Class Trial, End the trial (the chapter's end through it) and
  `setPhase` do; false for every other crossing: Edit campaign and Season setup's Save (`applyCampaignForm`), the
  season's reset, a console's `setClock`. A write that is no crossing leaves it as it was; a clock put back whole (a patch
  naming its own `writtenAt`, as the suite's restores) carries its own mark or none. sequence.mjs `edgeShown(clock)` is
  `clock.trialCut !== false`: the entry (`playTrialEntry`) and the exit (`playTrialExit`) play nothing for a crossing
  Edit campaign wrote; the curtain still recolours by its ordinary turn, and the clock and the GM panel's top update. A
  clock without the mark (older worlds, hand-built test clocks) plays as before. It is a positive mark only the playing
  roads write, as the day boards' `dayBoard` stamp of the 1.2.110 line; it says nothing about the boards, whose own
  mark that line adds.

Tests: R4421-R4424 (tier 1), red at 421f2395 (R4421: the exit was `how: "centre"` and named no day; R4422: no
`playTrialExit`; R4423: no `trialCutOf`, no road marked, Edit campaign's entry played; R4424: in one run the boards
never played, in two the board cut the exit). R3709 and R3704 read the new exit and the widened gate. Tier 2 "the
trial's entry and exit play from Start and End the trial, and Edit campaign's Apply plays neither": red at 421f2395
(Edit campaign's entry played once, End the trial's exit none), green here, and the restore leaves the world as found.

Frames for the owner's review: the glass harness in headless Chromium, NOT Foundry, on a held clock (Playwright's fake
clock drives the timers, the frames and `performance.now`; every Web Animation paused and set to the clock), 1366x768,
deviceScaleFactor 1, Stained Glass and Monokuma Legacy, PL and EN, start 100 ms, closing 600, closed with the title 1800,
opening 2900, end 3300, and the reduced-motion still: scratchpad trialexit/shots/exit-*.png (not in the repository).

Probe of the exit (as section 1, two runs): start at most -4.4 a frame, 3.4 per 100 ms; 900 ms +1.7 (the plain glass
+2.6/+2.7 once, the closing copies giving way to the closed curtain's paint, whose tiling of the trial's cut differs);
the end +1.9 a frame, 1.7 per 100 ms.

Not measured: a real Foundry table (the trial's scene loading under the closed curtain, the hall's tokens; LIVE-E61-01's
kind), two GMs, a player's browser in Chromium, deviceScaleFactor 2.

## 3. The Polish capitals in the pixel face (the owner's review of the shots, 13.11.2026)

The Legacy subtitle read "POWROT". Cause, measured: the Ó was there, neither absent nor clipped - pixel.woff2's Oacute
set its acute as one font pixel (y 1000-1125) straight on the O's top row (125-1000, ascent 1000), with no empty row
between; at the line's 23.9 px a font pixel is 3 px, so the mark was a 3x3 bump on the O's edge. pixel-ext.woff2's
Ć Ń Ś Ź Ż were drawn the same way; Ą Ę Ł were fine. Stained Glass (Special Elite, VT323) was fine.

Fix: the mark's contour of those six glyphs moved up 125 units (y 1125-1250), one empty font pixel between mark and
letter; no other glyph, table, advance or cmap changed (compared with fontTools). The `@font-face` queries go to
pixel.woff2?v=3 and pixel-ext.woff2?v=4.

Check: `node audit/glass-sweep.mjs --accents` lays the sequences' title and line in each theme and draws each of the
nine capitals beside its base letter in the face and size the element computes; a mark above needs at least one empty
row, a tail below ink below the base, and each at least (size/16)^2 differing pixels; the control (O for Ó) must fail.
Red before: Legacy band (75.1 px) and line (23.9 px) Ć Ń Ó Ś Ź Ż gap 0. Green after: Legacy gap 7 (band) and 3 (line);
Stained Glass 2-4, unchanged.

Not measured: every other place the pixel face sets a Polish capital (the HUD, tabs, dialogs). The mark now rises
0.25 em above the ascent instead of 0.125 em, so a box that clips at one line of the face's height could cut it; not
checked beyond the sequences' title and line.

## 4. The chapter's line on the closed Stained Glass curtain (the owner's review of the shots, 13.11.2026)

The line under the title stood over the glass harness's open window: its words and a lead line read through the closed
curtain's panes, across the line. Measured with `node audit/glass-sweep.mjs --title-contrast` (both themes, the
entry and the exit played on a held clock to the closed title at 1800 ms, 1366x768; the line's glyph pixels from a shot
with and without it, what stands under and within 5 px of them from a shot with its ink transparent, WCAG contrast with
the line's computed colour; fails under 4.5 at the glyphs' 5th percentile or their surround's 1st; control: the line in
#6a6a6a must fail, and does).

Before: Stained Glass entry surround min 2.50, 1st percentile 3.94; exit min 2.08, 1st percentile 4.24 (the glyphs
themselves 10.5 and 15.6 at the 5th, the shadow's glow under them). Legacy 12.75 (its lids are opaque).

Fix, the smaller of the two: the line stands on its own dark shard (inline-block, 90 % of the
sequence's ink, a slanted cut like the title's band); the windows under the closed curtain are left as they are.
After: Stained Glass entry 17.12 / 16.02 min / 16.43 1st; exit 17.29 / 15.43 / 16.24. Legacy unchanged. The entry and
the exit share the line, so both have it.

Not measured: a real table's windows (the harness's dialog stands for one), deviceScaleFactor 2.

## 5. The line at a phone's width (393x852, 13.11.2026)

Asked for frames at a phone's width too, the line read "POWROT" again there, for two reasons in turn, each read red
by `--accents` before its fix:
- the line had no floor: 28 units are 6.9 px at 393 wide, under one of the pixel face's pixels, and the canvas test read
  Ć Ń Ó Ś Ź Ż (and under VT323 all nine) as their base letters. The line is floored at 11 px (`clamp(11px, ..., 999px)`,
  R60's count 7 -> 8); it wraps to two lines there, so its line height is 1.4 (at the face's own 1 the second line's
  marks touched the first).
- then the shard: 6 units of padding are 1.5 px there, and its cut's slant took the acute off Ó in POWRÓT. The canvas
  test could not see that - it reads the face, not the element - so `--accents` now also sets each capital in the real
  title and line, at the start, in Ó's place and at the end, and compares the element's shot with the base letter's:
  red there (Ć Ń Ó Ś Ź Ż in the middle, 0 px differ), green with the padding floored at 5 px.

And the shard went to both themes: at 393 wide Legacy's lid seam ran along the line's first line (surround 3.63 at the
1st percentile); on the lid the shard is the lid's own colour, so it shows only where it covers the seam.
`--title-contrast` at 393x852 after: Stained Glass 17.38 glyphs / 17.14-17.17 surround; Legacy 12.74 / 12.85-12.87;
1366x768 as in section 4.
