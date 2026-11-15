# Owner's asks of 15.11.2026 for 1.2.116 - status

Branch `claude/owner-116` from `e9f4a791` (1.2.115). One section an item: the reading, the red test, the fix, the numbers.

## Item 1 - the planner's nodes: always the edit view, wider, every field the node's width

### Reading (15.11.2026, before any change)

Measured in Chromium (the module's sheets, probe 08's captures of the Map with each node kind open, `relayoutCaseMap` run
as the Map runs it; a scratch page built on `audit/case-map-sweep.mjs`'s framing, not committed), every text box and select
of an open node: its layout width (`offsetWidth`), the width of the cell that holds it and of the open node's box. Nine
captures (`investigation--map`, `-node`, `-trace`, `-slot`, `-planned`, `-autopsy`, `-zone`, `-final`, `-bullet`), Stained
Glass and Monokuma Legacy, 1366x768 and 1920x1080, the canvas at zoom 0.5, 1 and 2: 708 rows, 118 (node, theme, field)
groups, none of whose layout width changes with the screen or the zoom (the zoom scales the canvas by a transform).

| Field | Glass | Legacy | Holder (both) | Node box |
| --- | --- | --- | --- | --- |
| every text input and textarea (name, words, analysis, note, zone fields) | 220 | 220 | 220 | 240 |
| a deduction's trial mode (select) | 173 | 220 | 220 | 240 |
| a Remnant's type / visibility / tied to the crime (selects) | 123 / 89 / 56 | 220 | 220 | 240 |
| a slot's Remnant / room (selects, status cell) | 148 / 156 | 220 | 220 | 240 |
| a slot's visibility / left by (selects, status cell) | 89 / 131 | 121 / 173 | 220 | 240 |
| a planned Remnant's room, type, author, visibility, tie | 156, 165, 131, 89, 156 | 220 | 220 | 240 |
| the autopsy's count / at the body | 39 / 131 | 220 | 220 | 240 |
| the final Remnant's room / visibility / author | 220 / 89 / 131 | 220 | 220 | 240 |
| a bullet's real type / shown / visibility / recipient | 207 / 220 / 89 / 148 | 220 | 220 | 240 |

The 20 px between 220 and 240 are the box's own padding (0.5 rem a side) and border (2 px a side).

What it says: the text boxes fill the node in both themes (as fix-113d left them); the selects under Stained Glass do not
- the theme wraps each select in `.drpg-select` (`display: inline-flex`, stained-glass.css), whose width is its content's,
so components.css's `width: 100%` on the select is 100% of that wrapper; under Legacy the slot's two status-cell selects sit
in `label.drpg-key-plan-field`, also content-wide. Not measured: Foundry's own stylesheet (the page loads the module's sheets
only, as the sweep says of itself), which could narrow a text box at a real table.

### 1c - what every node open costs (15.11.2026, measured before building)

Chromium on the module's sheets (scratch page, not committed): every node's fields shown and every face hidden, as 1a would
draw them, the node and its fields at the width named, the selects under glass made to fill; then `relayoutCaseMap` with
that `nodeW` and `fitCamera` as Fit to view runs it. Two cases: probe 08's (13 nodes: 9 Remnants and slots, two deductions,
a counter, the solution) and a large one built in a scratch copy of probe 08 (39 nodes: the same plus 6 planned Remnants, 3
Truth Bullets, the Autopsy, a Final Truth, 12 deductions in three steps, 3 counters, a solution).

| Case, theme | Drawn | Canvas (px) | Median / tallest node (px) | Fit at 1920x1080 | Smallest text at fit | Whole nodes in view at 100% (1920x1080) |
| --- | --- | --- | --- | --- | --- | --- |
| 13, glass | today (none open) | 1144 x 1298 | 95 / 365 | 0.463 | 9.7 px | 5 of 13 |
| 13, glass | all open, 240 | 1144 x 8151 | 890 / 1170 | 0.25 (the camera's least) | 3.3 px | 0 of 13 |
| 13, glass | all open, 300 | 1324 x 7906 | 858 / 1029 | 0.25 | 3.3 px | 0 of 13 |
| 13, legacy | today | 1144 x 992 | 58 / 285 | 0.628 | 6.9 px | 10 of 13 |
| 13, legacy | all open, 300 | 1324 x 5581 | 609 / 855 | 0.25 | 2.8 px | 0 of 13 |
| 39, glass | today | 2024 x 4090 | 201 / 365 | 0.25 | 5.3 px | 5 of 39 |
| 39, glass | all open, 240 | 2024 x 31247 | 1756 / 2868 | 0.25 | 3.3 px | 0 of 39 |
| 39, glass | all open, 300 | 2324 x 27404 | 1374 / 2399 | 0.25 | 3.3 px | 0 of 39 |
| 39, legacy | all open, 300 | 2324 x 23384 | 1354 / 2260 | 0.25 | 2.8 px | 0 of 39 |

At 1366x768 the graph's viewport is 297 px tall under glass (319 legacy): every all-open node is taller than the viewport.

Where the height is: a deduction or the solution open is about 2250 px at 300, of which its "Rests on" list is about 1900
(it names every node of the case, one per line); a counter's "Refutes" about 1000 of 1400. Without those two lists (a
scratch rule hiding them) the 39-node case is still 2324 x 18193 under glass (median node 498, tallest 1107: a Truth
Bullet), and the 13-node case 1324 x 7906 - the Remnants' column alone stacks nine nodes of about 800 px.

Render: showing every node's fields and the first layout, 140-175 ms under glass and 62-68 ms under Legacy for 39 nodes
(40-52 / 18-28 ms for 13); one `relayoutCaseMap` 45-53 ms (glass) and 35-42 ms (Legacy) for 39 open nodes, 2 ms today. The
Map runs it again on the fonts' load and on every node's resize. Software-drawn Chromium, not a table's machine: a shape,
not a table's number. Scenario 86 counts no planner work (it does not open the Map).

Widths 280 / 300 / 320 change little of this: each 20 px of width takes 3-8% off a tall node's height.

### The defect: two causes, both fixed at today's 240 px node (commit 1)

**A field being typed in, under the map's zoom.** A textarea floats while it is edited (float-text.mjs, the top layer).
Its placeholder took the field's box on the screen as its own layout size, and the case map's canvas is scaled by the
camera's CSS transform, so the placeholder was scaled a second time and the floating field, placed on it, was the field's
width times the zoom again. Measured in Chromium at e9f4a791 (audit/float-sweep.mjs I7, probe 08's `investigation--map-node`,
both themes):

| Zoom | The field on the screen | Floating, before | Floating, after | Other elements of the node moved, before / after |
| --- | --- | --- | --- | --- |
| 0.5 | 110 px | 55 px | 110 px | 39 / 0 |
| 1 | 220 px | 220 px | 220 px | - |
| 2 | 440 px | 880 px | 440 px | 39 / 0 |

Fit to view puts the Map at 0.25-0.63 on the cases measured above, so a GM typing at fit typed in a field a quarter to
two fifths of its node's width: the likeliest reading of "still narrower than it should be" after fix-113d, which measured
the fields at 100%. The owner's screenshot has not reached this session, so that is a reading, not a match.
Fix: float-text.mjs `holdSize` - the placeholder at the field's layout size (untransformed, the screen box to the fraction,
as before: a first version with the rounded `offsetWidth` moved reveal-confirm's window by half a pixel under glass, which
the full float sweep read). Tests: R7406 (pure, tier 0), float-sweep I7 (Chromium).

**The selects under Stained Glass.** Every select of an open node stood in the theme's content-wide `.drpg-select`
(39-207 px of 220), and a slot's visibility and author in a content-wide column under Legacy (121, 173). Fix: two rules in
components.css's planner block. Tests: R7405 (tier 0, the rules), audit/case-map-sweep.mjs `field` (Chromium, with a
planted control): 46 narrow fields before, 0 after, 48 pages (en and pl, nine captures, both themes, both sizes).

Also: float-sweep I4 was red on every capture with a node open (the field stood under the graph's clipped bottom, the
style harness running no camera, so the click landed on the page's body); I4 now moves the canvas as the camera's reveal
would, and reads green in both themes.

Mutants (a copy of the tree, `DRPG_REPO`): `holdSize` never scaled, its padding and border dropped, the rounded offset
size untransformed; the wrapper's `width: 100%` dropped; the column's stretch turned to flex-start - 5 of 5 killed by
R7405/R7406.

Not measured: Foundry's own stylesheet (neither sweep loads it); the top layer and a transform on v14's real window (LIVE).

A margin seen and not changed: float-sweep I6 under Legacy allows 35 frames for 30 keys, and reads at its edge on both
trees - this commit 33, 34, 35, 34 and once 36 (a full run, red), 1.2.115's float-text.mjs 35 and 35. The untransformed
road `holdSize` takes is the old one (the screen box), so the count is not this change's; the limit is the test's, left
as it is for the coordinator.
