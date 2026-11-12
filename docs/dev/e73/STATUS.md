# E73 - status of the work line, branch claude/e73

Trial hall zones: picking zones, Straw Poll, Logic Dive, Scrum Debate. Started 12.11.2026 on claude/e97-98 at 4077664
(E97, E98, E99 in). Plan: docs/dev/plans/E73.md on origin/claude/plan-130. Reserved R numbers: R3900-R3949.

## C0 - the spec this line builds to (12.11.2026)

The plan's D.md 14 is not in this tree; the texts below are written to docs/text-style.md and docs/glossary.json
(`straw-poll`, `logic-dive`, `scrum-debate`, `findings`, `zone-a`, `zone-b`; mode names English in the Polish UI, TR18).

### The zones (C1, C2)

- Stored in `sceneRoles` as `zones: { a, b }` (region ids of the linked hall), merged beside `school` and `trial`, no
  migration. Picked in Room Setup's Scenes tab: "Zone A" / "Strefa A", "Zone B" / "Strefa B", listing the hall's regions
  that are not rooms.
- The tab, the Scenes report and the Pre-season check's hall row warn: no zones; both name one region; a zone's region
  gone; the zones overlap; the zones leave part of the hall uncovered; coverage not checked (a gridless hall past its
  budget: a 50 px lattice, 200 ms; Q-E73-4).
- A zone region is not a room and not an undecided region (rooms.mjs `isZoneRegion`): the hall is a place for nobody.
- `sidesNow()` - counted on every client from the world alone: each trial participant (vote.mjs `trialParticipants`: one
  student per connected player, no Monocub, no muted dead) is on the side whose zone holds their hall token's centre:
  the region's own `tokens` first when exactly one zone names the token, else `testPoint` at the centre with the token's
  elevation, else the region's polygon tree or box when `testPoint` cannot be asked. A centre both zones claim is on
  neither (`onLine`). A participant with no token in the hall stands on the side they picked in the side-pick window
  (bridge "trial.side", kept on the floor as `zone.picks`); none picked, no side.

### The modes (C3-C5), rows of the floor's one engine

Three modes of floor-machine.mjs `MODES`, family "zones", their rows in scripts/zone-machine.mjs (pure):

| Mode | Phases | Ends |
| --- | --- | --- |
| `straw` Straw Poll | `vote` 45 s | the clock or Count now: the larger side with at least two thirds of the counted (`3 * larger >= 2 * counted`) is a Finding "The class thinks: {answer}"; otherwise "The class is split: A {a}, B {b}" with the Scrum hint, and the next step is Scrum Debate |
| `dive` Logic Dive | `vote` 60 s, `pause` 5 s, per question of a set of 1-5 | everybody counted on one side, Count now or the clock -> `pause`; then simple majority: right -> the next question (the last one right is the set's Finding); wrong or a tie (0:0 too) -> the set ends, the truth not shown; Skip question writes no answer; End mode keeps where it stopped |
| `scrum` Scrum Debate | `setup` 45 s, then `speak` turns | 2 x the larger camp's turns, the smaller camp first, alternating, each camp's speakers in rotation, `scrumTurnSeconds = clamp(300 / turns, 20, 40)`; crossing free; an empty camp ends it with the other camp's answer as a Finding |

`MODE_RULES`: straw and dive - all speak, all present (TR2 = 1), no Objection; scrum - the speaker speaks and presents,
no Objection. The truth of a Logic Dive question lives in the GM store `diveSets` only; the floor carries the question
and its two answers.

### Findings (C6)

`trialProgress().findings`: `[{ id, text, mode, at, confirmed }]`, a `TRIAL_RECORD` row; a card per entry; the whole list
on the vote's opening card; the GM edits, deletes and marks "Monokuma confirms" (public card each time).

## Deviations, defaults taken (owner to confirm)

- **Q-E73-2, the console rebuild: not in this line.** The coordinator's rule for this line is to keep the console's
  changes to what E73 needs (E61 rebuilds parts of it on another line). The three modes join the console as it is: one
  footer button for the zone modes' picker window, their panel in the console's middle drawn from one contract
  (`ZONE_PANELS`, trial-zones-ui.mjs), so the rebuild reads it. C0b's mock-ups are drawn for the owner's pick; the
  rebuild waits for that pick and E61's merge.
- Q-E73-1: the scenario is 68-trial-zones. Q-E73-3: the set editor a kit window, the run in the console. Q-E73-4 as
  above. Q-E73-5: the modes are in floor-machine.mjs `MODES`, so E99's `caseModes` and the census have them.
- A wrong majority in Logic Dive ends the set as a tie does, and shows no truth either (the set stays replayable).
- A Logic Dive set's Finding is its own `conclusion` text, or the last question's right answer when the set has none.

## Progress

| Commit | What | Tests |
| --- | --- | --- |
| 6002ca8 | C0 (this file's spec), C1: zone-geometry.mjs; the Scenes tab's Zone A / Zone B; the zone warnings in the tab, the Scenes report and the Pre-season hall row; rooms.mjs `isZoneRegion`; LIVE-E73-01..04 | R3900-R3902, tier 2 "E73 C1"; R2018 follows the filled row |
| 5101742 | C2-C5: trial-zones.mjs (sides, stands, starts, "trial.side", "trial.keyword"), zone-machine.mjs (Straw Poll, Logic Dive, Scrum Debate rows), trial-zones-ui.mjs (panel contract `ZONE_PANELS`, picker, set editor, side-pick window, drawing), `diveSetStore`, world-secrets `truth`, record rows, the bar's Count now / Skip question, music, four SFX rows, game.drpg rows | R3903-R3908, tier 2 "E73 C3, C4"; older tests changed on purpose listed in the commit |
| 2faedcb | C6: Findings - add, edit, delete, "Monokuma confirms", each a public card; the console's Findings button; the vote's opening card | R3909, tier 2 "E73 C6" |
| ec0775f | C7: R311's HELD pattern tightened (red on the mutant, green on the tree); scenario 68-trial-zones; handbooks GM 15.2, player 12 (EN, PL); probe 08 rows for the zone windows; the E13 C5 tier-2 test follows the zones on the tab | 68 |

Red first: each commit's new tests were run on a worktree at 4077664 with the new test files copied in, and failed
for the reason named in the commit; green on the commit.

| (this) | The console's lead in a zone mode says the zone mode's line, not "An objection or a rebuttal holds the floor" (seen on the screenshots) | R1364, R1124, R2050, R2051, "E73" by name |

## Test results

- 5101742: tiers 0-1 1191 passed, 0 failed, 16 skipped, 1 red (R3339, E48's).
- ec0775f (pre-push): tiers 0-1 1192 passed, 0 failed, 16 skipped, 1 red; lint, check (17 parts), gate green; prose
  525/525; tier 2 by name (E73, E70-T, E99, trial hall, Scenes tab, Testimony, Closing Argument) 65 green after the
  E13 C5 test's fix; scenarios 10, 30, 33, 41, 62, 63, 65, 67, 68, 72, 81, 88 green. 30 read red once on a worktree
  (cluster.mjs gives no known-leak verdicts outside its own tree): its one red is the known leak foundry-secret-door-type.
  65, 67, 72 on the own tree: green with their expected reds (2, 1, 4).
- Scenarios found by `git grep` on the changed names (sceneRoles, trialProgress, trial-floor, trialParticipants,
  trialQueue, BAR_OPS, MODE_STARTS, floorStep, trial-floor-ui, scenesTab, vote.mjs): 10, 30, 33, 41, 62, 63, 65, 67,
  72, 81, 88 (all run above); 68 is new.
- Mutants: R311's tightened pattern red on the givenCounts mutant (above). The plan's planted faults of C7 (truth in
  trialQueue, a tie revealing, a double count, a Monocub or dead token counted, a gap unwarned) are held by R3904,
  R3907, R3903, R3900 and the world-secrets fixture; they were not each planted and run as mutants on a copy.

## Screenshot pages

- Round 1 (12.11.2026): https://claude.ai/artifact/Sxp7TS8iJJ8VbscmfnjWfb - the console in a Straw Poll, the zone
  picker, the Logic Dive editor, Findings, the Scenes tab's zones, both themes, EN and PL (GM windows); and C0b's two
  console mock-ups at 1366x768 and 1920x1080. Not Foundry: the style harness. Not on the page: the side-pick window
  (a player's), the zones on the canvas. Seen and fixed: the console's lead in a zone mode.

## Open questions for the owner

- Q-E73-2: which console frame (mock-up A or B), and the rebuild in its own stage after E61? Default taken: not in E73.
- Q-E73-1, -3, -4, -5: defaults taken (above), owner to confirm.
- A wrong Logic Dive majority shows no truth, as a tie does (the set stays replayable): default taken, owner to confirm.
- The Pre-season check's hall row now counts "no zones" as not done (optional row): owner to confirm it should.

Tokens so far: not measured by this line.

- Q-E99-1 (the coordinator's addition, 12.11): the case schema (`trialSchemaHtml`) belongs in the console's middle
  once the console is rebuilt, with the frame's button opening it larger, redrawn only on its own watches (the
  86-frame-work risk of an SVG redrawn every second). The rebuild is not in E73 (Q-E73-2 above), so the schema stays
  E99's window of its own from the footer for now; the move goes with the rebuild. Default as the coordinator worded it
  ("schema in the console's middle") recorded for that stage, owner to confirm.

## Waits for other lines

- **E72** (Monocub, inactive Confusions, bribes, rewards): in a zone mode they are not wired; the zone modes count no
  Monocub (vote.mjs `trialParticipants` leaves them out already).
- **E61** (trial entry, cut-in): no cut-in in a zone mode yet.
- **E74**: nothing of E74 is read here.
- **The console rebuild** (Q-E73-2): waits for the owner's pick of the mock-ups (C0b, the review page) and E61's merge.

## Not done (named for the next round)

- Scenario 68 does not drive: a latecomer mid-question, a GM reload mid-question (LIVE-E73-04 instead), the export
  and import of a case with a set.
- The side-pick window is not on the screenshots (it opens on a player's browser only, with a floor the probe does not seed there).
- The zones' drawing and the entry's animation are not measured headless (no canvas; LIVE-E73-03).

