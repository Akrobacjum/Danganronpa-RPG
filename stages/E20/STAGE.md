# E20 - First run: Season setup, Pre-season checks and the requirements (line B; train: line A's next after READY)

Base: 60ef9a97 on claude/fervent-sagan-gme4vt-b (= main 12ff1b62, release 1.2.90, plus B-C0). Files and symbols, never
line numbers (the hints in "What HEAD already does" were read on 29.10 and may move). Tier-0/1 tests take R1500 and up
(line B's range; none used at Base: the highest R in the tier files is R1048); tier-2 tests are E20-T1.. . No row a
player's browser sends is added or changed: no write-roads table, no MARKED commit, no security lens (METHOD-A-lite 5).
`tools/stages.json` E20: planned "1.2.104" (D20's old numbering; line A sets the version at the train), touches `[]`.
The issues' full text: lines-board `issues.json` (exported 29.10, a49a070b).

## Goal
A GM new to the module knows where to start; the checklist, Pre-season checks, the Doors tab and the scene report count
rooms and students by the same predicates the game uses and tick only what they checked; the reports are in the table's
language and name no console command; a module that did not start leaves Foundry as it was; what the module changes in
Foundry is told and can be given back. (plan.json E20 "goal"; "doneWhen": the checklist, Pre-season checks and Doors
give the same numbers of rooms and players, and a new GM on an empty world is pointed at the first step.)

## The owner's words and binding decisions
- D19 option 1: Dice So Nice stays required; the reason in the requirements window fits private rolls and the dice look
  the GM imposes (S01-45); a module that did not start does not change Foundry, no variant with live CSS (S01-41).
- D21: the overflow threshold gets only a hint computed from the number of players in Season setup; the default stays
  until the rebalance after sessions 0 (S02-59).
- plan "risk": the module changes system settings at load - describe them and give them back when it is switched off.
- Amend 05.10: the Pre-season checks' and Check rooms' reports go to i18n (S01-23, S07-36). S01-63 waits for E66.
- Amend 11.10 (A8): Pre-season checks keep the rows of E77 and E78 - room images that do not load (`Image.decode()` of
  every path on the GM), "A/V is off in this world, there is no voice tile", "the world is in Video mode: nobody sends
  audio", "this world sends video nobody watches". (A10): the SECRET doors row with Convert to passages and Hide players'
  movement rulers, by the map validator's predicate. (Session 0): S06-30, S11-19, S07-13, S02-59.
- Amend 13.10 (E77 D5): the room image's size warning (pixels, and bytes by a HEAD request), the image decode row, and a
  `checkRegions` warning when the pieces of one room differ.
- Amend 27.10: no zones (E73's row). E51's "First session" screen is NOT at Base (0 hits); line A, 29.10: E51 builds it
  later on E20's predicates, which E20 exports and names in its STATUS.
- **Owner answers, 29.10.2026** (binding): "Tak dla wszystkich domyślnych 3-8" (Q-3..Q-8 below as defaults). Q-1:
  "przypisz wszystkie 24 zgłoszenia E20" from issues.json (the table below). Q-2: no session-0 file; what it gave E20 is
  amend 11.10's S06-30, S11-19, S07-13, S02-59; "'Nie naprawiać' przy S11-19 dotyczyło mnie na sesji, nie kodu - napraw
  audyt."

## The 24 issues, each to its rows (issues.json; the "fix" there is the reviewer's proposal, the rows below bind)
| issue | sev | in short | rows | commit |
| --- | --- | --- | --- | --- |
| S01-18 | med | diagnoses use their own predicates and contradict the checklist ("- nobody -"; resources; Assistant GM "no pool by design") | E20-03 | C1 |
| S06-28 | med | ticks on rows that checked nothing (empty roster; Monokuma row a tautology by the fallback; "ok" at 67% uncovered; rooms ticked after the room test found errors) | E20-02, E20-04 | C1 |
| S07-13 | med | "outside rooms" counts the padding (~57% on a covered map); holes count as covered | E20-05 | C1 |
| S07-33 | low | Check rooms with no scene says "clean"; the rooms row looks only at the viewed scene | E20-06 | C1 |
| S07-38 | low | rooms and players counted differently in Doors, Season, Pre-season; "That is 5 rooms." and "the guide" unclear | E20-01 | C1 |
| S11-19 | med | the audit marks every OBSERVER character "fix these", raw API levels, no fix | E20-07 | C2 |
| S01-23 | med | Pre-season and the room test hard-coded English, a console command in the text | E20-08 | C2 |
| S07-36 | low | Check rooms and Pre-season reports English only | E20-08 | C2 |
| S07-14 | med | the room test repeats a two-sentence explanation and raw coordinates per room | E20-09 | C2 |
| S01-20 | med | the CAST frame cuts text mid-line (fixed height, inner scroll) | E20-10 | C2 |
| (amend 11.10, 13.10) | - | E77/E78 rows; E77 D5 warnings | E20-11, E20-12 | C3 |
| S10-57 | low | Next on an empty world says to start the Eclipse | E20-13 | C4 |
| S01-61 | info | nothing tells a new GM where to start | E20-14 | C4 |
| S01-19 | med | Set the season up opens scrolled to the bottom | E20-15 | C4 |
| S06-30 | med | text below the threshold, top out of frame, Save saves unseen fields, "Open" with no visible reaction | E20-15, E20-16 | C4 |
| S01-21 | med | hints small, centred, dimmed, low contrast | E20-16 | C4 |
| S12-20 | med | centred hints, red 11 px missing line, done rows faded whole | E20-16 | C4 |
| S01-41 | low | not started: settings.mjs hooks throw, CSS still changes Foundry, "Nothing else has started" untrue | E20-17 | C5 |
| S01-45 | low | requirements reasons promise a demo scene, contradict private rolls, "two things", untranslated | E20-18 | C5 |
| S13-43 | low | the recommendations window always says "two things" and promises a demo scene | E20-18 | C5 |
| S03-37 | low | the module changes system and scene settings at every load and never gives them back | E20-19 | C6 |
| S02-59 | low | overflow default 20 tuned for 16 players | E20-20 | C6 |
| S10-55 | low | a Motive cannot be withdrawn from any UI | E20-21 | C6 |
| S01-48 | low | the stepper "One more / One fewer" moves by 10 | E20-22 | C6 |
| S01-63 | info | the module's language defaults to English under a Polish Foundry | - (after E66; line A, 29.10) | - |

## What HEAD already does (at 60ef9a97, read by symbol; hints are line numbers of 29.10)
- Checklist: season-setup.mjs `steps()` drawn by `setupRows`, opened by `openSeasonSetup`; roster = `studentActors()`
  (monokuma.mjs: `type === "character" && !isMonokuma`). Rows that tick having checked nothing: with no students
  `resources`, `ultimate`, `experiences`, `items`, `assignments` (`.every` on an empty list) and `roomCount`
  (`roomsWantedFor(0)` = 0); `roomsMarked` with no named region; `despairSplit` with fewer than 2 pools; `cursor` reads
  the stored `core.permissions.SHOW_CURSOR ?? []`, not `permissionsInForce()` as `rulers` does; `assignments` accepts
  `monokumaFor`, which falls back to the first GM (assignments.mjs).
- The window: no scrollTop/scrollIntoView/focus for it in season-setup.mjs; Save is `default: true`, which DialogV2
  autofocuses in the footer (utils.mjs `pinFooterAcrossScroll` pins it) - the likely scroll (S01-19; not measured).
  Hints `.drpg-setup-body .notes` at `--drpg-text-sm` (13 px) in both themes; `.drpg-setup-missing` at `--drpg-text-xs`
  (11 px); done rows at opacity 0.55; the "Left, not centred" rule leaves the season window out (S12-20).
- Empty world: gm-panel.mjs `nextStep()` ends in `DRPG.Panel.nextAllDone` ("... Start the Eclipse ...", action
  "eclipse").
- Pre-season checks `runPreSessionChecks`: headings keyed; `diagnoseCharacters` (diagnostics.mjs) English literals with
  "or run  game.drpg.initCharacter(actor)  for each."; it reports a `feedsNobody` student unassigned; `diagnoseDespair`
  names an Assistant GM with a pool "no pool by design"; `diagnoseScenes` (fog.mjs) "`${rooms} rooms, ${pct}% of the map
  belongs to no room`" literal; anonymity's "default is", " (GM)", " (Assistant GM)" literals. season-setup.mjs's own
  on-screen text is keyed already (amend 05.10's "~line 1118" part: done at Base).
- `auditAnonymity` (anonymity.mjs): `if (info.defaultLevel > NONE) exposed.push(info)`; `lowerOwnership` and
  `onPreCreateActor` set OBSERVER as right.
- `sceneUncoveredPercent` (fog-diagnostics.mjs): `total` from `scene.dimensions` width x height - the padded canvas.
- Counting: checklist `roomCount`/`roomCountLine` - `sharedRooms` (vault.mjs; locked counted) against all students, dead
  included; the Doors tab `wireRoomRatio` - `namedByName` (locked NOT counted) against living students; `diagnoseScenes`
  - `roomNames` (every marked room, bedrooms included). `roomsWantedFor` shared. `checkRegions` reads `canvas.scene` only.
- Requirements (module.mjs): before `requirementsMet()`'s return only `registerRelayGuard` and `registerGmChrome` run;
  `registerSettings`/`registerLanguage` never do; settings.mjs's import-time `renderApplicationV2`/`renderApplication`
  (`scaleWindow`) and `renderSettingsConfig` handlers throw on every render. module.json loads six stylesheets ungated
  (rules hide `#hotbar`, `#scene-navigation`, `#players`). The reason is module.json's `reason`, English.
- Settings written at load: states.mjs `suppressSystemAutomation` (never given back); enforced.mjs `applyEnforced`,
  `holdPermissions` (never given back), `holdRtcDock` (given back on its toggle); fog.mjs `prepareScenes` (tokenVision,
  fog, globalLight on scenes with rooms; given back on the module's toggle only).
- Overflow: `OVERFLOW.threshold: 20` (config.mjs); the static `DRPG.Overflow.thresholdHint` ("12 + half your player
  count ...").
- Amendment rows present: "sends video nobody watches" (`videoUnwatched`), the `secretDoors` step, the `rulers` step.
  Absent: the decode row (room-tile.mjs `openRoomImage` decodes as a notice only), "A/V is off" as a row
  (`DRPG.Voice.avDisabled` exists as a voice message), "Video mode: nobody sends audio", the size warning, the
  pieces-differ warning (`piecesAsOne` merges unchecked).
- Motive: rules.mjs `setMotive(null)` withdraws (API); `openRulesManager` has no Motive section. Stepper: chrome.mjs
  `pixButton`.
- Tests reading these by name: tier 0 R151, R147, R346; tier 1 R442, R470, R542; tier 2 "a GM report's document holds no
  words", "this season's chapter reads none of last season's Key Remnants..."; scenarios 12-social (ANONYMITY), 65-season
  K1. None for `sceneUncoveredPercent` or `roomCountLine`.

## Acceptance
| id | promise | how it is checked | commit |
| --- | --- | --- | --- |
| E20-01 | one census: `roomCensus(scene)` and `studentCensus()` exported, read by the checklist (`roomCount`, `roomCountLine`), the Doors tab and Pre-season's scene line; rooms = marked, not owned, not `notShared`, locked counted; students = living (Q-3); one wording that says bedrooms are left out, no "the guide" (S07-38) | R-next t1 (one fixture world, three readers, one number; red first: Doors and the checklist differ on a locked room and a dead student) | C1 |
| E20-02 | a row that checked nothing never ticks: an empty roster shows "waiting for the cast" on the rows over students, not done; `roomCount` not done with no rooms; `roomsMarked` not done with no named region; `cursor` reads the permissions in force; the Monokuma row checks an explicit assignment and shows "falls back to {pool}" (S06-28) | R-next t1 (empty world; red first: the five ticks) | C1 |
| E20-03 | Pre-season's cast and Despair lines use the checklist's predicates: `feedsNobody`, `needsStartingResources`, `poolCandidates()` - a student on "- nobody -" and an Assistant GM with a pool read the same in both (S01-18) | R-next t1 (red first: unassigned; "no pool by design") | C1 |
| E20-04 | Pre-season's "ok" on a scene and the checklist's rooms tick also need the uncovered share under its limit and the last room test without errors (S06-28) | R-next t1 | C1 |
| E20-05 | "outside rooms" over the scene rect (`sceneWidth` x `sceneHeight`), polygons clipped to it, holes not counted as covered: a covered 4000x3000 scene at padding 0.25 reads 0% (S07-13) | R-next t1 (red first: about 56% - the padded canvas is about 6000x4500, the owner's "about 57%") | C1 |
| E20-06 | Check rooms with no scene says "No scene on the canvas", with no rooms "No rooms on this scene" (not "clean"); the rooms row names the scene it judged and counts every scene with rooms (S07-33) | R-next t1 | C1 |
| E20-07 | the audit: "fix these" only above OBSERVER, the key reworded (owned by every player - the redaction never runs), levels in words ("every player can open the sheet"), a Fix that sets OBSERVER, the NONE characters as an info line ("cannot be looted when dead"); OBSERVER reads green (S11-19; owner 29.10: fix it) | R-next t1 (red first: an OBSERVER character under exposed); E20-T1 (t2: Fix sets OBSERVER on the suite's world and restores); scenario 12 ANONYMITY | C2 |
| E20-08 | Pre-season's report, `diagnoseCharacters`, `diagnoseScenes`' line, the anonymity literals and Check rooms' `problem`/`detail` are lang keys EN/PL with `plural()`; no user-facing text names `game.drpg.` - initCharacter's line reads "open the sheet and press the wand beside the name"; console logs stay English (S01-23, S07-36) | R-next t1 (the report rendered in PL: none of a fixed list of English literals, no "game.drpg."); parity, prose | C2 |
| E20-09 | Check rooms: the explanation once as a legend above the list; per row a short fact ("{squares} squares of border with no wall") and "Show on map" (pans to the point and marks it); "the second way" gone (S07-14) | R-next t1 (three rooms, one legend; the button's handler pans by the row's point); LIVE-E20-05 (the mark on a real canvas) | C2 |
| E20-10 | the CAST section is not a fixed-height frame: the window scrolls, the "Fix:" sentence sits at the top of the section (S01-20) | R-next t1 (the CSS reader: no max-height/overflow on the report block, both themes); LIVE-E20-01 | C2 |
| E20-11 | the rows amend 11.10 keeps, built where absent: "A/V is off in this world: no voice tile", "Video mode: nobody sends audio", "Room images that do not load" (`Image.decode()` of every room image path, on the GM) | R-next t1 (each from a fixture setting; decode with a stand-in that fails); E20-T2 (t2: the report on the suite's world) | C3 |
| E20-12 | E77 D5: a room image over 4096 px on a side or over 8 MB warns (bytes by HEAD, "size unknown" when no length) (Q-7); `checkRegions` warns when one room's regions differ in `notShared`, owner or elevation | R-next t1 (stand-ins for the image and the HEAD answer; two pieces that differ) | C3 |
| E20-13 | an empty world's Next: "Open Season setup: {first row not done}" with a button that opens it, until the required rows hold; never "Start the Eclipse" before (S10-57; Q-8) | R-next t1 (red first: nextAllDone); R151, R346, 65 K1 still green | C4 |
| E20-14 | a GM's first ready with no campaign name and no students: a one-time notice "Start here: GM panel > Set the season up" with a button; once per GM (client setting) (S01-61) | R-next t1 (shown once; not with a cast) | C4 |
| E20-15 | Set the season up opens at its top (no autofocus on the pinned Save; the first field focused), a visible scrollbar; the campaign fields save with the window's Save as today but sit in a block at the top; a window "Open" brings to front (S01-19, S06-30) | R-next t1 (the opening focus target; `bringToFront` on each "Open"); LIVE-E20-01 | C4 |
| E20-16 | the hints left-aligned at `--drpg-text-base`, the names line at `--drpg-text-sm` in the state's colour, a done row dimmed by its title and mark, not by row opacity; the season window in the "Left, not centred" rule, both themes (S01-21, S06-30, S12-20; Q-4) | R-next t1 (CSS reader, both themes; red first: 0.55 row opacity, text-xs); LIVE-E20-01 | C4 |
| E20-17 | a module that did not start leaves Foundry as it was: its stylesheets removed (every `CSSImportRule`/sheet whose href holds `modules/danganronpa-rpg/`), no enforcement (dice look, LiveKit, camera dock) starts, the import-time hooks return without registered settings, and "Nothing else in the module has started" is true (S01-41; D19) | R-next t1 (static: the render hooks guard; the remover finds the module's sheets in a fixture document); E20-T3 or harness (DSN missing: no module error, no module sheet left) | C5 |
| E20-18 | the requirements and recommendations windows: reasons from `DRPG.Requirements.reason.<id>` (EN/PL; the manifest's only as a fallback), Dice So Nice's per D19 ("Every roll is thrown as 3D dice, seen only by the people allowed to see that roll, in the one dice style the GM sets for the table."), Isometric's without academy maps or a demo scene ("Maps drawn for isometric play will look wrong on a flat grid."), the title by `plural()` or without a number; the keys load without `registerLanguage`; module.json's reasons rewritten the same (S01-45, S13-43) | R-next t1 (PL client, DSN missing: the reason in Polish; one missing: no "two"); R442, R470 green | C5 |
| E20-19 | what the module writes in Foundry at load is listed in the GM handbook; each setting's value before the module's first write is kept; "Give back Foundry's settings" (GM, module settings) writes them back and stops the module writing them; a one-time GM notice instead of the log alone; the handbook: before switching the module off press it, and turn "Rooms decide what players can see" off (S03-37; Q-5). README's sentence is line A's (line B may change only README's version line) | R-next t1 (each write in the list; red first: no original kept); E20-T4 (t2: write, give back, read Foundry's value, restore) | C6 |
| E20-20 | Season setup's overflow row: "Suggested for {n} students and {p} pools: {x}" by the module's formula (12 + n/2), the GM decides; the default 20 unchanged (S02-59; D21) | R-next t1 (4, 8, 16 students: 14, 16, 20; the default unchanged) | C6 |
| E20-21 | the rules manager has a Motive section: the text, the time left and Withdraw (`setMotive(null)`, announced); the handbook's "until you withdraw it" points at it (S10-55) | R-next t1; E20-T5 (t2: Withdraw clears and announces) | C6 |
| E20-22 | `pixButton`'s labels read the input's step ("+10" / "-10"; "One more / One fewer" only at step 1) (S01-48) | R-next t1 (the debate length's stepper) | C6 |
| E20-23 | the books EN/PL: first run (install to the first Eclipse with the windows alone), the settings and giving them back, the requirements; `stages.json` touches; LIVE rows as B-E20-n | parity, prose, 50, `check live` | C7 |
| E20-24 | E20's predicates exported and named in STATUS for E51's "First session" (line A, 29.10) | STATUS.md; R-next t1 reads the exports | C1, close |

## Rules of this stage
- The originals C6 keeps are Foundry's own values (no secret): a world setting, `config: false`, against
  `WORLD_SECRET_RULES` anyway (R9).
- New text EN and PL in pairs; `parity` and `prose` green; no long dash. module.json's `reason`s are text, not version.
- `roomCensus` lives beside `sharedRooms` (vault.mjs), `studentCensus` beside `studentActors` (monokuma.mjs); no new
  file unless a family table says so (`.claude/rules/code.md`).
- `styles/narrow.css` keeps loading last; no breakpoint number outside `settings.mjs`.
- README.md: only its version line (line B; the hook refuses more). S03-37's README sentence is asked of line A.
- rules.mjs (C6, S10-55) is also E51's: the Motive section is one block in `openRulesManager`, said in STATUS.

## Commits
### C1 - one census; no tick without a check; "outside rooms" without padding (S01-18, S06-28, S07-13, S07-33, S07-38)
- Files: vault.mjs (`roomCensus`; `wireRoomRatio`), monokuma.mjs (`studentCensus`), season-setup.mjs (`steps()`,
  `roomCountLine`), diagnostics.mjs (`diagnoseCharacters`, `diagnoseDespair`), fog.mjs (`diagnoseScenes`),
  fog-diagnostics.mjs (`sceneUncoveredPercent`, `checkRegions`' empty cases), assignments.mjs (explicit assignment read),
  lang EN/PL.
- Tests: R-next t1 for E20-01..06, E20-24. --own: tier-2 tests naming the changed symbols (cap ~15). --scen: 65 if its
  K rows name a changed message.

### C2 - the reports in the table's language; the audit fixed; Check rooms readable (S11-19, S01-23, S07-36, S07-14, S01-20)
- Files: diagnostics.mjs, fog.mjs, fog-diagnostics.mjs (`checkRegions` keyed, the legend, "Show on map"), anonymity.mjs
  (`auditAnonymity`, Fix), season-setup.mjs (the report's rendering), styles (both themes), lang.
- Tests: R-next t1 for E20-07..10; E20-T1. --scen: 12.

### C3 - the rows amend 11.10 keeps and E77 D5's warnings
- Files: season-setup.mjs (`runPreSessionChecks`), voice-tile.mjs/voice.mjs (A/V off, Video mode beside
  `videoUnwatched`), room-tile.mjs (the decode probe shared), fog-diagnostics.mjs (pieces differ), config.mjs (limits),
  lang.
- Tests: R-next t1 for E20-11, E20-12; E20-T2.

### C4 - the first step; the season window opens at its top, readable (S10-57, S01-61, S01-19, S06-30, S01-21, S12-20)
- Files: gm-panel.mjs (`nextStep()`), module.mjs or season-setup.mjs (the one-time notice; a client setting in
  settings.mjs), season-setup.mjs (`openSeasonSetup`), styles/danganronpa.css, styles/stained-glass.css, lang.
- Tests: R-next t1 for E20-13..16; --own R151, R346; --scen 65.

### C5 - a module that did not start changes nothing; the requirements' words (S01-41, S01-45, S13-43; D19)
- Files: module.mjs, settings.mjs (render hooks guarded), requirements.mjs, module.json (`reason`s), lang.
- Tests: R-next t1 for E20-17, E20-18; E20-T3 if the harness can boot without DSN, else a tier-1 reader and LIVE-E20-02;
  --own R147, R442, R470.

### C6 - Foundry's settings given back; the overflow hint; the Motive withdrawn; the stepper (S03-37, S02-59, S10-55, S01-48)
- Files: enforced.mjs, states.mjs, fog.mjs (`prepareScenes`: originals kept), settings.mjs (the record, the menu),
  season-setup.mjs or overflow.mjs (the hint), rules.mjs (`openRulesManager`), chrome.mjs (`pixButton`), lang.
- Tests: R-next t1 for E20-19..22; E20-T4, E20-T5.

### C7 - books, stages.json, LIVE rows
- docs/handbooks (GM EN/PL), `tools/stages.json` (E20 touches `[]`), audit 9.2 rows B-E20-n, R-REGISTRY.

### Mutants
None required (no MARKED commit; METHOD-A-lite 4).

## What only a table can show
- LIVE-E20-01 (B-E20-1): Set the season up and Pre-season checks at 1366x768 and 1920x1080, both themes: opens at the
  top, hints readable, CAST not cut.
- LIVE-E20-02 (B-E20-2): a fresh v14 world without Dice So Nice: no console error from the module; hotbar, scene
  navigation and players list as Foundry draws them.
- LIVE-E20-03 (B-E20-3): install to the first Eclipse with the windows and the handbook alone, EN and PL (plan "verify").
- LIVE-E20-04 (B-E20-4): the HEAD request's length on a real Foundry server (and The Forge, if used).
- LIVE-E20-05 (B-E20-5): Check rooms' "Show on map" pans and marks the border on a real canvas.

## Out of scope
- S01-63 -> after E66. The zone row -> E73. "First session" -> E51 (on E20's predicates). The overflow default -> E64.
  The Season setup window's rebuild -> E46. README's S03-37 sentence -> line A.

## Owner questions (answered 29.10.2026; the defaults stand)
- Q-1 answered: all 24 issues mapped from issues.json (table above).
- Q-2 answered: no session-0 file; S11-19 is fixed in code.
- Q-3 rooms = marked, not owned, not `notShared`, locked counted; students = living. Q-4 hints `--drpg-text-base`, the
  names line `--drpg-text-sm`. Q-5 originals kept, "Give back Foundry's settings", the handbook says to press it first.
  Q-6 "fix these" only above OBSERVER. Q-7 4096 px or 8 MB; "pieces differ" = `notShared`, owner or elevation. Q-8
  "Open Season setup: {first row not done}" until the required rows hold.
