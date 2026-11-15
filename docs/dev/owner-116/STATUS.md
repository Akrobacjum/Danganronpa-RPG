# Owner's asks of 15.11.2026 for 1.2.116 - status

Branch `claude/owner-116` from `e9f4a791` (1.2.115). One section an item: the reading, the red test, the fix, the numbers.

R numbers: this line's block is R7420-R7439 (the coordinator, 15.11.2026: the E112 line holds R7407 and R7408, which a
`--next` on this tree alone does not see). Item 3's test, R7409 in e389c2ca, is R7420 since the commit after it; R7409
keeps its registry row, marked "(removed in E39)" by `tools/registry.mjs --write` (a number is never reused; the stage
name is the tool's own reading). If the E112 line needs R7409, that row is the one to settle at the assembly.

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

- R7420 (tier 1) red at 25e2d34e ("spectator.mjs has no SPECTATOR_LISTEN_FLAG or talksWithSpectators"; the same file's
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
- The coordinator's defaults, and one difference: "the token's owner keeps seeing their own" and "one rule, the token's"
  differ for a hidden token, which Foundry draws for the GMs alone (its documented behaviour, not read at a table). The
  rule follows the token: a hidden token's ruler is the GMs' alone, its owner's too. LIVE-E116-03 reads it at a table; if
  Foundry shows an owner its hidden token, the rule must change to match.
- No text in lang changes. GM handbook EN/PL: the players' rulers paragraph says that a hidden token's ruler is hidden,
  and a token the module hides likewise.

### Tests and numbers

- R7421 (tier 0) red at c44db5a3 ("visibility.mjs has no rulerShownTo, or fog-doorways.mjs no setRulerShown or
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
