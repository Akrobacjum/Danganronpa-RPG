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
  (`playBoards`) wait for its end (`whenTrialExitEnds`). With the switch off the exit plays nothing and the curtain turns
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
