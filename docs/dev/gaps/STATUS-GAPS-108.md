# STATUS-GAPS-108 - the owner's items on 1.2.108 (claude/gaps-108)

Base: origin/main 4dfac3a9 (v1.2.108). Written 12.11.2026. The fixes ride 1.2.110 (R3983-R3985, Since 1.2.110).
Review page for the owner (shots before and after, both themes, Polish first, then English, 1366x768, harness):
https://claude.ai/artifact/WQ3kVJyT6f8x2bWx9y27L2 (private until shared).

## for the coordinator

| # | Item | State | Commit |
| --- | --- | --- | --- |
| 1 | a thin light line at the screen's top and bottom while paused | fixed, red first | b25838ac |
| 2 | a line under the eye on the GM button | approved by the owner, integrated (launcher only) | 76d25c47 |
| 3 | the Projects action a hammer | approved by the owner, integrated (both themes) | 76d25c47 |
| 3 | Hold this ready / Hand this over too alike | the owner's pick of round 2 (C's Hold, A's Give), integrated (both themes) | see 3 |
| 4 | one project in the tray darker and fading | fixed, red first | 1adba33b |
| 5 | folding the tray takes the notice tile's blur away for a moment | fixed, red first | 31d1949f |

- The brief's house rules file (`S/briefs-ui/rules.txt`) is not reachable from this session; the rules held were the
  ones in the earlier briefs and CLAUDE.md.
- Quick gate green (lint 312 files 0 problems, check 17/17, gate self-test 37/37). Tiers 0-1 at 31d1949f: 1255 passed,
  0 failed, 16 skipped (the 16 tier 0-1 rows of skip-baseline.json), 360 s.
- merge-tree at 31d1949f: clean against main, e72, e93 and texts-e71. e64, e100, e101 and e97-98 conflict only in
  docs/dev/R-REGISTRY.md (the generated file's tail and its "Next free" line; no number shared): `node
  tools/registry.mjs --write` at the merge settles it. fervent-sagan-gme4vt (the 1.2.109 line) conflicts in
  scripts/glass.mjs `turnPlan`, two lines: its `none` object and its return's `frost:` line, each of which takes my
  `stay` (`stay: []`, `stay,`) on top of E62 C2's new fields. Resolved so on a scratch copy of b30f9444 with
  31d1949f picked: R3985, R1377-R1379, R1411, R1413 and R3120 green there (8 passed); tiers 0-1 there 1306 passed,
  0 failed, 16 skipped, 372 s.

## 1. No seam at the screen's edges while paused (b25838ac)

- Cause: stained-glass.css's `#pause.paused` kept a 1 px accent `border-top` and `border-bottom` from Foundry's 180 px
  band. danganronpa.css has made `#pause` the whole viewport (`top: 0; height: 100vh`), so the seams lay on the screen's
  first and last rows. The owner: only while paused (the coordinator's answer, 12.11). Both borders removed; the word's
  plate keeps its seam. Legacy never drew one.
- R3984 (tier 1, the sheets' cascade, both themes): red at 4dfac3a9 with stained-glass top and bottom "1px solid
  color-mix(... 40%, transparent)"; green after.
- Glass harness, a full-screen `#pause.paused` stand-in, mean brightness of row 0: 80 before, 20 after (row 1: 20).
  The bottom seam fell at y=769, off the harness page.
- Only the table confirms: that the flash is gone, and what made the seam pulse rather than stand (core's own pause
  animation, the veil). Not measured: no fps() output came.

## 2. The line under the GM button's eye (76d25c47)

- The harness draws no separate element under the eye in either theme: no border, underline or pseudo-element beyond
  the eye's own `::before` mask. The one stroke below the eye is in the drawing: tools/glyphs.json `chrome:monokuma-eye`
  (rows 16-18: a thin tail down-left, and one pixel at x=8, y=17 hanging under it). The same drawing is
  `legacy:monokuma-eye` and `glass:gm` (`same`), and the Remnant card's glyph for a GM-placed trace.
- The row's note says those parts were drawn on purpose to the owner's reference, so the cut went to the review page
  first. The owner (12.11): the cut is right, on the GM button only; the Remnant card keeps its tail.
- Integrated: chrome:monokuma-eye loses rows 17-18 and the pixel at 8,17 and no longer says `same` as
  legacy:monokuma-eye (noted in its row); legacy:monokuma-eye and glass:gm are unchanged. Regenerated with
  tools/chrome-icons.mjs and tools/glyph-map.mjs (--check: 0 problems). R3986: red at 02d20f9a `[true,18,true,18,true]`,
  green `[false,16,true,18,true]`. R1333's six gm-launcher prints move (the eye's mask alone; noted in the test).

## 3. The three glyphs (the hammer 76d25c47; the pair held)

- Today: Stained Glass wears `--drpg-pix-fist` and `--drpg-pix-palm` on the two row buttons, Legacy `--drpg-pix-fist`
  and `--drpg-pix-give` (danganronpa.css "THE ROW BUTTONS GO PIXEL"; measured as the computed mask in Chromium). The
  Projects action wears `--drpg-pix-hourglass` under Stained Glass and `--drpg-pix-project` (a plain T) under Legacy.
- Proposed, on the 24 grid, one drawing for both themes each: a fist gripping a knife's handle (hold), a box with an
  arrow leaving an open hand (give), a claw hammer (Projects). On the review page on mock rows and tiles built from the
  module's own sheets.
- The owner (12.11): the hammer approved, in both themes; the hold and give pair still unreadable at glyph size.
- The hammer, integrated: glass:hammer and legacy:hammer (`same`), ELEMENTS `ACTIONS.project` -> hammer (was hourglass),
  Legacy's action rule reads `--drpg-pix-hammer` (was the plain T). The Remnant card's project glyph unchanged in both
  themes. R3987: red at 02d20f9a (hourglass and project, no hammer token), green after.
- Round 2 on the review page: three pairs, every Hold one tall upright object and every Give a wide shape with a motion
  (A: a bookmark ribbon / an arrow from one figure to another; B: a push pin / a box with an arrow leaving it; C: a hand
  raising a star / a box carried over by an arc), on a real row beside Use, Stow and Discard, at real size and 2x, both
  themes. Not integrated. The row buttons' classes are shared with crisis actions (fa-hand-fist: Strike, Resolve;
  fa-hand-holding: Secure a Trace, Plant), so the chosen pair goes in through the row buttons' own rules, not the Font
  Awesome map.

## 4. One project never fades as if more stood below it (1adba33b)

- projects-tray.mjs `markTrayMore` marked any overflow; now only a hidden part of at least half a row. R3983: red at
  4dfac3a9, green after. Glass harness with a planted 6 px overflow: before, one project marked in both themes (glass
  29/26, legacy 41/38); after, not marked; seven projects still marked.
- Not measured: what overflows at a table under Daggerheart 2.12.8.

## 5. The panes that stand keep their frost through a turn (31d1949f)

- Cause: the blur under Stained Glass is one element, `#drpg-curtain-frost`. E23 C1b's turn faded all of it out
  (120 ms) when a recut moved glass and back in (180 ms) after the 700 ms moves, so every pane stood unfrosted.
- Now: the frost stays at full opacity, clipped for the moves to the panes that stand (`plan.stay`) and to the part each
  moving pane's old and new places share (`convexOverlap`), then to the new cut. Only a turn with no such part left still
  fades it whole.
- R3985 (tier 1, `turnRig`): red at 4dfac3a9 `[true,false,false,false,false,true]`, green `[false,true,true,true,false,true]`.
- Glass harness, 1366x768, every frame for 1.6 s after the tray's class changes, GM and player, fold and unfold:
  before, the frost's opacity min 0.00 (0.00 from about 400 to 960 ms) and the centres of the notice tile
  (`#drpg-popups`), the voice tile, the status strip, Despair and the clock unfrosted in some frame; after, min 1.00 and
  all five frosted in every frame. `drpgTrayFold` still recuts in frame 2 and turns.
- That the owner's "notice tile" is `#drpg-popups` is a reading of glass.mjs's name for it; the fix holds for every pane.
- The owner's pick (12.11): C's Hold (a hand raising a star) and A's Give (a bold arrow from one figure to another), both
  themes. Integrated: glass:hold-ready and glass:hand-over, legacy rows `same` as them; under Stained Glass two FACE_RULES
  keyed on the row button (`.drpg-row-equip > i.fa-hand-fist`, `.drpg-row-handover > i.fa-hand-holding`), so Strike,
  Resolve and Determination keep the fist and Secure a Trace and Plant the palm; under Legacy the row rules in
  danganronpa.css read the new tokens. A copying handover (fa-share-nodes) is unchanged. R3988: red at e4fa790f (glass
  fist and palm, legacy fist and give, no token), green after.
