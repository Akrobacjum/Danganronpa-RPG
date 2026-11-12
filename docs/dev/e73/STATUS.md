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

- **Q-E73-2, the console rebuild: answered by the owner, mockup B (12.11 ~10:17).** Built in 5fc377d: three sections
  `data-drpg-trial-region` "status" (the lead, the time, the table, the register and one mode picker with every mode,
  greyed with its reason while another holds the floor), "mode" (the mode's name, line, bar, log, Findings) and
  "manage" (the Reveal, the vote); the footer no longer holds the mode starts.
- **The case schema's slot (E99's hook, the coordinator 12.11; claude/e97-98 afeeb68):** one empty
  `<div class="drpg-trial-schema" data-drpg-trial-schema>`, built by trial-floor-ui.mjs `trialBodyHtml` right after
  `.drpg-trial-console` and outside it, so the console's `keepLive` redraw (every second) never draws over it. No import
  of case-trial.mjs: the `mountTrialSchema` call comes with 1.2.109's merge.
- **The running console's layout (the coordinator's decision, 12.11 ~10:38; the owner: "Schemat ma byc widoczny w class
  trial na konsoli triala, tam gdzie zarzadzamy trybami/overrule/objection itd"):** while a trial runs the window is
  1280 px wide (`consoleWidth`, held to the screen less 8 px a side) and the screen's height (the body asks
  `flex-basis: 100dvh`, the kit frame's ceiling stops it; no rule on the window's own frame, R1357), opened 8 px from the
  top. Inside: the status at the top (the lead; the time, the table and the register on one row; the mode picker); the
  read-out (`[data-drpg-trial-read]`: the mode and the management, Key Remnants and the vote) on the left with its own
  scroll, kept across the redraw by keepLive; the schema's slot on the right, filling the height; the bar
  (`data-drpg-trial-region="bar"`) pinned under both; the footer's buttons under it. The window's body has nothing to
  scroll (`overflow: hidden`; its `scrollHeight` is 1 px over under Stained Glass, a rounding). Under 44rem of body the
  columns stack and the frame scrolls.
- **With no trial, the schema too (the owner, 12.11 ~12:00, via the coordinator: "W oknie otwierajacym class trial
  (pierwsze po kliknieciu przycisku class trial w gm panel) nie chcemy zaznaczania wnioskow, tylko sam schemat"):** the
  same 1280 px, full-height window (`consoleWidth` answers 1280 in both states; the console's 44rem until then); the
  console's lines at the top, the slot - the read-only schema E99 draws there, without ticks - filling the rest, the
  footer's Close, Start the Final Trial and Start the Class Trial under it. Measured as below: the console's lines, the
  footer and the slot inside the window in all 8 cases; the slot 424 px tall at 1366x768 under the glass, 521 under
  Legacy, 736 and 833 at 1920x1080. R2053 changed on purpose: the console states 1280 px (`data-drpg-width`), not the
  `console` width; its 74ch checks unchanged.
- **Measured in Chromium** (style harness: the module's sheets, no Foundry CSS and no Foundry header; the harness places
  the window 24 px down, not 8, so its last 8 px pass a 768 px screen there), 12.11, fc05a9d + this round: at 1366x768
  and 1920x1080, Stained Glass and Monokuma Legacy, EN and PL, a Nonstop Debate, an Objection and a Straw Poll (24
  cases): the status, the bar, the footer's buttons and the slot's whole box inside the window and the screen in all 24.
  The slot: 290-322 px tall at 1366x768 under the glass, 406-423 under Legacy; 602-634 and 718-735 at 1920x1080. The
  read-out scrolls by itself under the glass at 1366x768 (307-338 px more than it shows), not at all under Legacy. Not
  measured: a real Foundry window (LIVE-E73-05), and E99's schema mounted in the slot.
- Seen on round 4's shots and fixed: under Stained Glass a greyed mode start stood at full opacity (the glass's panel
  button rule, 0-5-2, over the picker's); it reads 0.45 now in both themes.
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

| 38654b1 | The console's lead in a zone mode says the zone mode's line, not "An objection or a rebuttal holds the floor" (seen on the screenshots) | R1364, R1124, R2050, R2051, "E73" by name |

| e94630a | Merge of origin/claude/fervent-sagan-gme4vt (fa73b601); E99's census renumbered R3659 -> R3910 (the release line's R3659 took the number); R3510 pins trial-zones.mjs and case-summary.mjs; AUDIT 9 items renumbered 488-495 | tiers 0-1 |
| 5fc377d | Mockup B console (above) | R3911; R1020, R1025, R1036, R1046, R1257 follow the regions |
| 781b4b9 | The tier-2 "Back up the case, then Restore" test gains its `diveSets` fixture: CI on ec0775f (run 43164287414) and 38654b1 (run 43164772167) failed there, shard 7, the one failure of each | that test by name, red in CI, green here |
| fc05a9d | The case schema's slot moved out of the redrawn console: `data-drpg-trial-schema` after `.drpg-trial-console` (`trialBodyHtml`), placed in the middle by the frame's CSS, its height reserved while a trial runs | R3911 red before (no `trialBodyHtml`, the slot inside the console), green after; tiers 0-1 1246 passed, 0 failed, 16 skipped, 0 red; scenarios 41, 63, 68, 86, 88 green |

| c6e723d | The running console on the coordinator's layout: 1280 px and the screen's height, status at the top, the read-out scrolling beside the schema's slot, the bar pinned at the bottom; probe 08 rows `class-trial--debate`, `class-trial--objection`; the greyed picker under the glass | R3911 red before (regions without "bar", no read-out column, no `consoleWidth`), green after; R1357 red on the first try (a rule on the window's own frame), green after; tiers 0-1 1246 passed, 0 failed, 16 skipped, 0 red; tier 2 by name (E73, E70-T, E99, Testimony, Closing Argument, Objection) 86 green; scenarios 41, 63, 68, 72, 86, 88 green on this round's markup (CSS changed after them, not run again) |
| (this) | With no trial the window is the same 1280 px, full height, the case schema's slot its main region (the owner's 12:00 answer) | R3911 red before (a rule hid the slot; the no-trial width "console"), green after; R2053 changed on purpose; tiers 0-1 1245 passed, 1 failed (R2053, before its change), 16 skipped, then R2053 and R3911 green by name; tier 2 by name 86 green; scenarios 41, 63, 68, 86, 88 green |

## Test results

- 5fc377d (pre-push): tiers 0-1 1246 passed, 0 failed, 16 skipped, 0 red; tier 2 by name (E73, E70-T, E99, Testimony,
  Closing Argument, Scenes tab) 56 green; scenarios 41 (51/51), 63 (74/74), 67 (45/46, 1 expected red), 68 (20/20),
  72 (132/136, 4 expected red), 81 (32/32), 88 (26/26). CI's only red on the two pushes before was the backup fixture
  (above), which the local by-name runs had not selected.

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
- Round 2 (12.11.2026): https://claude.ai/artifact/MZ5j81TzpNU59Pgp6cH8Bh - the mockup B console at 5fc377d in a Straw
  Poll and with no trial, both themes, EN and PL. Not Foundry: the style harness; the schema slot is empty (E99).
- Round 3 (12.11.2026): https://claude.ai/artifact/Pdw1e1ZQAQoJfBwDagYymb - fc05a9d: the schema's slot
  (`data-drpg-trial-schema`) outside the redrawn console, between the mode and the management, its height reserved;
  a Straw Poll at the window's top and scrolled to the end, and no trial, both themes, EN and PL. Not Foundry: the
  style harness at 1366 x 1500; the slot is empty (E99 mounts into it).
- Round 4 (12.11.2026): https://claude.ai/artifact/Gdp7aJnmjstqbSGfdk9TCz - the running console on the coordinator's
  layout and the window with no trial (the schema's slot its main region) at 1366x768 and 1920x1080, a Nonstop Debate
  and an Objection (and a Straw Poll at 1366x768), both themes, EN and PL, with the measurements' table; republished
  for the no-trial change. Not Foundry: the style harness, a stand-in window
  header, the window 24 px down where Foundry puts it 8; the slot empty.

## Open questions for the owner

- Q-E73-2: answered, mockup B; built in this line (5fc377d), not after E61 as the default had it.
- Q-E73-1, -3, -4, -5: defaults taken (above), owner to confirm.
- A wrong Logic Dive majority shows no truth, as a tie does (the set stays replayable): default taken, owner to confirm.
- The Pre-season check's hall row now counts "no zones" as not done (optional row): owner to confirm it should.

Tokens so far: not measured by this line.

- Q-E99-1 (the coordinator's addition, 12.11): the case schema (`trialSchemaHtml`) belongs in the console's middle
  once the console is rebuilt, with the frame's button opening it larger, redrawn only on its own watches (the
  86-frame-work risk of an SVG redrawn every second). The owner's words in E97/E99: "schemat na środku ekranu
  rozprawy, status na górze, zarządzanie na dole". Mockup B holds the slot for it (`data-drpg-trial-schema`, above);
  E99 (1.2.109) mounts into it. E73 does not draw the schema there.

## Waits for other lines

- **E72** (Monocub, inactive Confusions, bribes, rewards): in a zone mode they are not wired; the zone modes count no
  Monocub (vote.mjs `trialParticipants` leaves them out already).
- **E61** (trial entry, cut-in): no cut-in in a zone mode yet.
- **E74**: nothing of E74 is read here.
- **The case schema in the console's middle**: E99 (1.2.109) fills the slot. E73 ships as 1.2.116.

## Not done (named for the next round)

- Scenario 68 does not drive: a latecomer mid-question, a GM reload mid-question (LIVE-E73-04 instead), the export
  and import of a case with a set.
- The side-pick window is not on the screenshots (it opens on a player's browser only, with a floor the probe does not seed there).
- The zones' drawing and the entry's animation are not measured headless (no canvas; LIVE-E73-03).

