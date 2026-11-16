# Owner's asks of 15.11.2026 for 1.2.116 - status

Branch `claude/owner-116` from `e9f4a791` (1.2.115). One section an item: the reading, the red test, the fix, the numbers.

R numbers: this line's block is R7520-R7539 (the coordinator, 15.11.2026, correcting an earlier R7420-R7439, which sat
in owner-115's old block). The numbers first taken by `--next` on this tree alone collided with other lines (R7405 with
four other lines, R7406 with three, R7407-R7408 with E112) and were renumbered in one forward commit after 1cc78724:
R7405 -> R7520 (the planner's fields), R7406 -> R7521 (`holdSize`), R7409 -> R7420 -> R7522 (the Spectators' room),
R7421 -> R7523 (the ruler). Their old rows are taken out of this branch's registry rather than kept "(removed ...)", since
those numbers are other lines' tests; the registry is regenerated at the assembly. Below, each test is named by its
current number.

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
the fields at 100%. The owner's screenshot did not reach this session; the coordinator read it (Stained Glass): the
text boxes fill the node and the selects do not, each as wide as its words - the select defect below. So the selects
are the owner's "narrower"; the floating field is a second defect found on the way, the owner's or not.
Fix: float-text.mjs `holdSize` - the placeholder at the field's layout size (untransformed, the screen box to the fraction,
as before: a first version with the rounded `offsetWidth` moved reveal-confirm's window by half a pixel under glass, which
the full float sweep read). Tests: R7521 (pure, tier 0), float-sweep I7 (Chromium).

**The selects under Stained Glass.** Every select of an open node stood in the theme's content-wide `.drpg-select`
(39-207 px of 220), and a slot's visibility and author in a content-wide column under Legacy (121, 173). Fix: two rules in
components.css's planner block. Tests: R7520 (tier 0, the rules), audit/case-map-sweep.mjs `field` (Chromium, with a
planted control): 46 narrow fields before, 0 after, 48 pages (en and pl, nine captures, both themes, both sizes).

Also: float-sweep I4 was red on every capture with a node open (the field stood under the graph's clipped bottom, the
style harness running no camera, so the click landed on the page's body); I4 now moves the canvas as the camera's reveal
would, and reads green in both themes.

Mutants (a copy of the tree, `DRPG_REPO`): `holdSize` never scaled, its padding and border dropped, the rounded offset
size untransformed; the wrapper's `width: 100%` dropped; the column's stretch turned to flex-start - 5 of 5 killed by
R7520/R7521.

Not measured: Foundry's own stylesheet (neither sweep loads it); the top layer and a transform on v14's real window (LIVE).

A margin seen and not changed: float-sweep I6 under Legacy allows 35 frames for 30 keys, and reads at its edge on both
trees - this commit 33, 34, 35, 34 and once 36 (a full run, red), 1.2.115's float-text.mjs 35 and 35. The untransformed
road `holdSize` takes is the old one (the screen box), so the count is not this change's; the limit is the test's, left
as it is for the coordinator.

## Item 2 - hide a Monokuma's token: dropped (the owner, 15.11.2026)

Built and not committed when the owner dropped it; thrown away, nothing of it pushed. R7407 and R7408 were taken for it and are released (never
written to docs/dev/R-REGISTRY.md; the E112 line uses both); scenario number 77 is free again. What its reading found stays true of the tree: every
Monokuma, hidden or not, is already nobody in a room (movement.mjs `countsAsPresent`).

## Item 3 - the Spectators' voice global (the coordinator's option A)

### Reading

At 25e2d34e a Spectator's account listened where its token stood, its microphone held, unless its own User flag
`spectatorTalk` was true, which took it to `SPECTATOR_ROOM` (voice.mjs `placeVoices`, `spectatorTalks`;
`settleTrialVoices` held the microphone while the flag was off). Players' voices are per room and stay so.

### Change

- The Spectators' room is the default, from anywhere on the map, outside an Eclipse (unchanged: nobody is in voice then).
- The switch is a new User flag, `spectatorListenHere` (scripts/spectator.mjs `SPECTATOR_LISTEN_FLAG`,
  `talksWithSpectators`): set, the account listens where its token stands, its microphone held by the trial's row as
  before; taken off, back to the Spectators' room. The tile's button: "Listen in your room" / "Słuchaj w swoim pokoju"
  (`DRPG.Spectator.talkBack`, the old "Go back to your room") while it is in the Spectators' room, "Talk with the
  Spectators" while it listens; `aria-pressed` true in the Spectators' room, as before.
- Old flags: `spectatorTalk` is read by nothing now. Its stored true meant the Spectators' room, the default now; its
  absence meant the token's room, which the owner's change makes the Spectators' room. So neither value is read, and a
  world that holds either keeps its Spectators in the Spectators' room. Reusing the old flag the other way round would
  have taken the Spectators who chose the room out of it. `setSpectator` clears both flags off an account that stops
  being a Spectator's (R7168's rule, now for the listen flag), so one marked again starts in the default.
- The dead: unchanged (the death rules place them in the Spectators' room before this rule; a dead student's watcher
  that sets the listen flag keeps the death rule's room).
- What a GM may want to know: a Spectator's microphone is now open by default (in the Spectators' room), where it was
  held by default; muting it is the player's own, as in any room. Question for the owner, default kept: yes, open.
- Texts: one value changed in EN and PL (`DRPG.Spectator.talkBack`); the GM handbook's Spectator paragraph and the
  player handbook's, EN and PL. Not changed: "their talk switch decides" in the modes' microphones paragraph (still
  true of the switch).

### Tests and numbers

- R7522 (tier 1) red at 25e2d34e ("spectator.mjs has no SPECTATOR_LISTEN_FLAG or talksWithSpectators"; the same file's
  R3860 read the Spectator with no flag in its token's room), green after: a Spectator with no flag, with the old flag
  true and with it false in the Spectators' room; listening, in its token's room; a student in its room with any flag;
  in an Eclipse not moved; the tile's reading.
- Changed on purpose, each red on the old code and green on the new: R3860 and R7168 (the flag they read), R3853 (the
  GMs' view of a Spectator with no flag: "spectatorTalk" now, "spectator" with the listen flag), the tier-2
  "a Spectator's microphone is open in the Spectators' room by default, blocked ... while it listens" (was "... blocked
  ..., lifted while its Spectator talk switch is on"), scenario 93's `voice` and `talk` checks (16/18 on the old code).
- Green: tier 2 by name (18 tests, 22 passed); scenarios 93 (18/18), 94 (19/19), 75 (42/42).
- Mutants (a copy of the tree): the reading's sense turned, the switch ignored, the trial block's sense turned, the
  toggle written the wrong way, the role's tidy without the listen flag - killed; the immediate reconcile on the flag's
  key (voice.mjs `updateUser`) - SURVIVED: scenario 93 reconciles within its 2 s settle by the other passes, so no check
  here measures that the move is immediate; as it was for the old flag.
- LIVE: one LiveKit connection in one room at a time (LIVE-E92-01, never measured) - unchanged.

## Item 2 (new, the owner, 15.11.2026) - Foundry's hide also hides the token's ruler

The owner: "zamiast tego - przycisk hide w foundry bazowym (prawy na token - hide) niech ukrywa tez linie dystansu
pokonywanego przez token".

### Reading

- The module already takes Foundry's ruler class over (fog-doorways.mjs `hourRulerFor`, `registerTokenRuler`; patches.mjs
  row `token-ruler`; R1115): it colours the styles and nothing else.
- visibility.mjs `hide` wrote a token's ruler off once (`hideMovementTrail`) when the module hid a token; Foundry writes
  `visible` again on its next refresh, and Foundry's own hide (`TokenDocument.hidden`) never reached that code at all.

### Change

- fog-doorways.mjs: `HourTokenRuler` keeps `visible` and asks one predicate on every write of it (`setRulerShown`);
  `visible` as an accessor on the class's chain or as a plain field (moved into a slot); `reRuler(token)` asks again.
- visibility.mjs: `rulerShownTo(doc, viewer)` - a GM always; anyone else not for a hidden token (its owner's too) and not
  where `tokenShownTo` hides the token; `rulerHere(token)` adds the tokens this file hid by its other rules (a Remnant, a
  project). Set at registration; `passForTokenUpdate` asks the token's ruler again when `hidden` flips.
- The owner of a hidden token (the owner's answer, 15.11.2026: at their table a player does see their own hidden token):
  1cc78724 hid a hidden token's ruler from its owner too, following Foundry's documented drawing of a hidden token; the
  commit after 3a4dfafa shows the owner the ruler, hidden or not. Checked first that this opens nothing the module hides
  from an owner on purpose: `tokenShownTo` shows a viewer their own token in every branch (or leaves it to Foundry), the
  murder's mask hides a killer from the others, and a token this file hid by its other rules (`hiddenByUs`) is asked
  before the owner. R7523's owner row red at 3a4dfafa ([true, false]), green after; a mutant without the owner's line
  killed. LIVE-E116-03 now reads that the owner sees both the hidden token and its ruler on v14.
- No text in lang changes. GM handbook EN/PL: the players' rulers paragraph says that a hidden token's ruler is hidden,
  and a token the module hides likewise.

### Tests and numbers

- R7523 (tier 0) red at c44db5a3 ("visibility.mjs has no rulerShownTo, or fog-doorways.mjs no setRulerShown or
  reRuler"), green after: the rule's matrix (player, owner, GM, Eclipse, Spectator; hidden and not), two ruler classes
  (accessor and field) as built, written, hidden while standing, unhidden before and after a write, the flip heard through
  `passForTokenUpdate`, and the module's predicate the registered one. R1115 and R1203 green.
- Mutants (a copy of the tree): the gate dropped, hidden ignored, the GM's line dropped, the registration dropped, the
  field shape not moved, the room rule ignored, the flip not heard - 7 of 7 killed.
- LIVE-E116-01 (the class's `visible` shape and whether path, waypoints and label all follow it), LIVE-E116-02 (a hidden
  token's move, history and planned movement on a player's browser; the flip mid-move), LIVE-E116-03 (the owner of a
  hidden token): AUDIT 9.2 items 553-555. The harness has no ruler and no canvas: nothing of what is drawn is measured.
- Cost: the predicate runs on every write of a ruler's `visible` (Foundry's ruler refresh, often during a drag); for a
  player it reads `tokenShownTo`, whose rooms are memoised per pass. Not measured at a table (scenario 86 has no ruler).

## The full tier 2 on 3a4dfafa (16.11.2026)

Eight shards (`DRPG_SUITE_SHARD=i/8 node run-all.mjs suite`, one at a time) held together by `suite-merge.mjs`: "8
shard(s) of 8 file(s), 1553 tier-2 tests in the list; 3297 passed, 0 failed, 27 skipped, 0 red: green". Shard 1 (tiers
0-1, 01's parts A and B) 2011 s, 1734 passed, 0 failed, 16 skipped; shards 2-8 558-737 s, 0 failed. About 2.3 times the
times CLAUDE.md gives (880 and 336 s), on this machine.

## Item 1a/1b - option A, built (the owner's answer, 15.11.2026)

The owner chose A: every node open by default, its long lists folded to one line, nodes 300 px, and a toolbar switch.

### Change

- case-map.mjs: `caseGraphHtml({ allOpen })` - on the Map, every face hidden (`is-editing`), every node's fields shown,
  the face's head (`nodeHeadHtml`: kind, trial mode, state, warning, reach) on top of the fields, no Close; the canvas
  carries `data-drpg-all-open`. Without it one node opens at a time with Close, as before (the Class Trial console draws
  no editors and is untouched). `caseToolsHtml({ allOpen })` draws the "All open" / "Wszystkie otwarte" switch
  (`aria-pressed`); `wireCaseMap` asks `onView` for the other drawing, and with every node open lets Escape go on to the
  window, shuts nothing on a click outside and reveals nothing on a redraw.
- case-view.mjs: `MAP_GEOMETRY.nodeW` 300; with every node open `relayoutCaseMap` measures no face (each face's classes
  were taken off and put back, a forced layout a node).
- investigation.mjs: the switch's state on the GM's own User (`caseMapFaces` true while off; `caseMapAllOpen`), All open
  by default; `openInvestigationDashboard({ allOpen })` for a caller that asks one drawing; a deduction's and the
  solution's "Rests on" and a counter's "Refutes" folded under a line "Ticked: n of m" / "Zaznaczone: n z m" that follows
  each tick; with every node open, every node's changed fields are written when the GM leaves the Map or switches.
- components.css: the node and its fields 300 px; the head's line and the folded list's line.
- Texts EN/PL: `DRPG.CaseMap.allOpen`, `DRPG.CaseMap.chosenOf`, `DRPG.Tips.Case.allOpenTooltip`. GM handbook EN/PL: a
  paragraph after the Map's node paragraph.

### Measured (Chromium, probe 08's captures drawn by this tree, and the 39-node scratch case)

| Case, theme | Canvas (px) | Median / tallest node | Fit (1920x1080) | Smallest text at fit | Whole nodes at 100% | One relayout |
| --- | --- | --- | --- | --- | --- | --- |
| 13, glass | 1324 x 7870 | 785 / 1021 | 0.25 | 3.3 px | 0 of 13 | 0.8-1.1 ms |
| 13, legacy | 1324 x 5624 | 549 / 695 | 0.25 | 2.8 px | 0 of 13 | 0.6 ms |
| 39, glass | 2324 x 18113 | 512 / 1104 | 0.25 | 3.3 px | 0 of 39 | 2.1-2.2 ms |
| 39, legacy | 2324 x 12815 | 359 / 810 | 0.25 | 2.8 px | 0 of 39 | 1.8-2.4 ms |

Against 1c (every node open, 300 px, lists unfolded): the 39-node case 27404 -> 18113 px tall under glass (the lists'
fold, as 1c's estimate of 18193 said), 23384 -> 12815 under Legacy; the 13-node case 7906 -> 7870 (its deductions rest on
few nodes); one relayout 45-53 ms -> about 2 ms for 39 nodes (no face measured). What 1c said stands: at fit the camera
stops at its least zoom, 0.25, and a case does not fit - a column of open nodes is what shows (shots/). "Faces only"
draws the map as before, at 300 px.
audit/case-map-sweep.mjs on every capture (en and pl, nine Map states and the 39-node case, both themes, both sizes):
76 pages, 0 cut, 0 overlap, every field at the node's width. Its controls read faces only and so read nothing on an
all-open page (the box planted on the faces: 0 cuts; the bar planted over a hidden face: 0): the sweep now plants on and
reads the open fields too (the bar, the fold, the fit's text), and its controls read 13 cuts, 39 overlaps and 2 bars.
Screenshots: docs/dev/owner-116/shots/ (the 13-node Map at 100% and at fit, glass and Legacy, Polish at 1366x768, the
39-node case at fit).

Not measured: the first draw's cost of a window holding every node open (the captures arrive drawn); a real table's
machine; keyboard navigation between open nodes (the arrows walk the hidden faces - not changed).

### Tests (option A)

- R7524, R7525, R7526 (tier 0) red at cc87ea3b, green after: the drawing with every node open and with one, the switch;
  300 px in the geometry and both rules, no face measured; Escape and a click outside shut nothing, the switch asks the
  other drawing. The tier-2 "owner-116: the planner draws every node open by default" red at cc87ea3b, green after:
  the window as a GM opens it, the folded list's line before and after a tick, a field written at the window's close
  and at the switch, the switch kept on the User and read again when the window reopens.
- Changed on purpose: R5821's stylesheet widths (240 -> 300); R4755's list of `DRPG.Tips.Case` keys (two rows: the
  switch, the folded list); R1157's allow table (the folded list's line is a ratio, "Ticked: 2 of 38", reason R); eight
  tier-2 tests whose subject is a node's Close ask the one-node drawing (`drawnCaseWindow({ allOpen: false })`).
- Mutants (a copy of the tree): the drawing ignoring `allOpen`, the faces measured again, Escape held again, the switch
  asking nothing, Close kept, the node 240 px, the list unfolded, the User's choice not read, the fields not written at
  the switch - 9 of 9 killed (two after the tier-2 test was widened to read them).
