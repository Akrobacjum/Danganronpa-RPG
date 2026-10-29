# E20 - First run: Season setup, Pre-season checks and the requirements (line B; train: line A's next after READY)

Base: 60ef9a97 on claude/fervent-sagan-gme4vt-b (= main 12ff1b62, release 1.2.90, plus B-C0). Files and symbols, never
line numbers (the hints in "What HEAD already does" were read on 29.10 and may move). Tier-0/1 tests take R1500 and up
(line B's range; none used at Base: the highest R in the tier files is R1048); tier-2 tests are E20-T1.. . No row a
player's browser sends is added or changed: no write-roads table, no MARKED commit, no security lens (METHOD-A-lite 5).
`tools/stages.json` E20: planned "1.2.104" (D20's old numbering; line A sets the version at the train), touches `[]`.

## Goal
A GM new to the module knows where to start; the checklist, Pre-season checks, the Doors tab and the scene report count
rooms and students by the same predicates the game uses; the reports are in the table's language and name no console
command; a module that did not start leaves Foundry as it was. (plan.json E20 "goal", "doneWhen": the checklist,
Pre-season checks and Doors give the same numbers of rooms and players, and a new GM on an empty world is pointed at the
first step.)

## The owner's words and binding decisions
- plan.json E20 "why" (the owner's session findings, Polish): the checklist ticks rows that checked nothing; Pre-season
  checks mark every character at OBSERVER "fix these", are English only and tell the GM to type a console command;
  "area outside rooms" is about 57% on a perfectly covered map; Set the season up opens scrolled to the bottom with hints
  below the legibility threshold; Next on an empty world says to start the Eclipse; without Dice So Nice the module throws
  errors and its CSS still changes Foundry; the overflow threshold's default 20 was chosen for 16 players.
- D19 option 1: Dice So Nice stays required; the requirements window's reason fits private rolls and the dice look the
  GM imposes (S01-45); a module that did not start does not change Foundry, no variant with live CSS (S01-41).
- D21: the overflow threshold gets only a hint computed from the number of players in Season setup; the default number
  stays until the rebalance after sessions 0 (S02-59).
- "risk": the module changes system settings at load - describe them and give them back when it is switched off.
- Amend 05.10: the Pre-season checks' and Check rooms' reports go to i18n (S01-23, S07-36); S01-63 (Polish by default
  under a Polish Foundry) needs E66's language setting - out of this stage (line A's answers, 29.10).
- Amend 11.10 (A8): Pre-season checks keep the rows of E77 and E78 - room images that do not load (`Image.decode()` of
  every path on the GM), "A/V is off in this world, there is no voice tile", "the world is in Video mode: nobody sends
  audio", "this world sends video nobody watches".
- Amend 11.10 (A10): the SECRET doors row with "Convert to passages" and "Hide players' movement rulers" (SHOW_RULER),
  counted by the map validator's predicate.
- Amend 11.10 (session 0): S06-30, S11-19, S07-13, S02-59 are on E82's known-issues list; before any code E20 reads the
  session-0 findings file and how the owner went through Set the season up and Pre-season checks on the real world.
- Amend 13.10 (E77 D5): three small warnings come here: the room image's size (pixels and bytes, by a HEAD request), the
  image decode row in Pre-season checks, and a `checkRegions` warning when the pieces of one room differ.
- Amend 27.10 (variant B): no zones yet - the zone row is E73's. "E51's 'First session' screen is already in the
  checklist and E20 keeps it": it is NOT at Base (0 hits for first session / pierwsza sesja / firstSession in scripts and
  lang); line A's answer (29.10): E51 builds it later on E20's predicates, which E20 exports and names in its STATUS.

## What HEAD already does (at 60ef9a97, read by symbol; hints are line numbers of 29.10)
- Checklist: season-setup.mjs `steps()` (~228) drawn by `setupRows`, opened by `openSeasonSetup`; roster =
  `studentActors()` (monokuma.mjs: `type === "character" && !isMonokuma`). Rows that tick having checked nothing: with no
  students `resources`, `ultimate`, `experiences`, `items`, `assignments` (`.every` on an empty list) and `roomCount`
  (`roomsWantedFor(0)` = 0); `roomsMarked` with no named region; `despairSplit` with fewer than 2 pools; `cursor` reads
  the stored `core.permissions.SHOW_CURSOR ?? []` and not `permissionsInForce()` as `rulers` does; `assignments` accepts
  `monokumaFor`, which falls back to the first GM (assignments.mjs).
- The window: no scrollTop/scrollIntoView/focus in season-setup.mjs for it; Save is `default: true`, which DialogV2
  autofocuses in the footer - the only candidate for the scroll to the bottom (not measured). Hints `.drpg-setup-body
  .notes` at `--drpg-text-sm` (13 px at 100%) in both themes, Stained Glass inside a 17 px x scale window; the names list
  `.drpg-setup-missing` at `--drpg-text-xs` (11 px).
- Empty world: gm-panel.mjs `nextStep()` falls to its last line: `DRPG.Panel.nextAllDone` "Everyone has spent their
  actions. Start the Eclipse: ..." (action "eclipse").
- Pre-season checks `runPreSessionChecks` (season-setup.mjs): headings are keys; `diagnoseCharacters` (diagnostics.mjs)
  is English literals, including "or run  game.drpg.initCharacter(actor)  for each."; it reports a student set to
  nobody (`feedsNobody`) as unassigned while the checklist accepts it. `diagnoseScenes` (fog.mjs): "`${rooms} rooms,
  ${pct}% of the map belongs to no room`" is a literal. Anonymity's "default is", " (GM)", " (Assistant GM)" literals.
  season-setup.mjs's own on-screen text is already keyed (its 11 literals are console lines) - amend 05.10's "~line 1118"
  part is done at Base.
- `auditAnonymity` (anonymity.mjs): `if (info.defaultLevel > NONE) exposed.push(info)` -> "Visible to all players - fix
  these:" for OBSERVER, while `lowerOwnership` in the same file sets characters back to OBSERVER as the allowed ceiling.
- `sceneUncoveredPercent` (fog-diagnostics.mjs): `total = dims.width * dims.height` from `scene.dimensions` - the whole
  canvas with its padding, not the scene rect (`sceneWidth`/`sceneHeight`).
- Counting (three predicates for one question): checklist `roomCount` and `roomCountLine` - `sharedRooms` (vault.mjs:
  marked, not owned, not `notShared`, locked counted) against all students, dead included, on `workingScene()` else
  `homeScene()`; the Doors tab `wireRoomRatio` - `namedByName` (named regions marked or not, locked NOT counted) against
  living students; `diagnoseScenes` - `roomNames` (every marked room, bedrooms included), every scene, no students.
  `roomsWantedFor` (vault.mjs) is shared. No count reads `game.users`.
- Requirements (module.mjs): before `requirementsMet()`'s early return run `registerRelayGuard` and `registerGmChrome`
  only; `registerSettings` and `registerLanguage` never run. Import-time hooks in settings.mjs (`renderApplicationV2`/
  `renderApplication` -> `scaleWindow` -> `game.settings.get(... uiScale)`; `renderSettingsConfig` -> theme) then throw
  on every window render, the requirements window's included. module.json loads all six stylesheets with no gate;
  ungated rules hide `#hotbar`, `#scene-navigation` and the `#players` lists. The window's title and how-to are keys;
  the reason is `entry.reason` from module.json, English, and with `registerLanguage` skipped the whole window is English.
- Settings written at load: states.mjs `suppressSystemAutomation` (Daggerheart Automation, primary GM, never given
  back); enforced.mjs `applyEnforced` (Isometric `showWelcome`, avclient-livekit `useExternalAV`, Daggerheart's
  welcome-message user flag), `holdPermissions` (FILES_BROWSE, FILES_UPLOAD off Player and Trusted; never given back),
  `holdRtcDock` (given back when its toggle goes off; its comment: "Disabling the module runs nothing").
- Overflow: `OVERFLOW.threshold: 20` (config.mjs) as `overflowRules()`'s fallback; the only hint is the static
  `DRPG.Overflow.thresholdHint` ("Suggested: 12 + half your player count. ...").
- Amendment rows: present - "sends video nobody watches" (`videoUnwatched`, `DRPG.Panel.checksAvVideo`), the
  `secretDoors` step with Convert to passages, the `rulers` step. NOT present - the image decode row (only room-tile.mjs
  `openRoomImage` decodes, as a notice), "A/V is off" as a row (`DRPG.Voice.avDisabled` exists as a voice message),
  "Video mode: nobody sends audio", the image size warning, the pieces-differ warning (`piecesAsOne` merges unchecked).
- Tests reading these by name: tier 0 R151, R147, R346; tier 1 R442, R470, R542; tier 2 "a GM report's document holds no
  words", "this season's chapter reads none of last season's Key Remnants..."; scenarios 12-social (ANONYMITY), 65-season
  K1. None for `sceneUncoveredPercent` or `roomCountLine`.

## Acceptance
| id | promise | how it is checked | commit |
| --- | --- | --- | --- |
| E20-01 | one census for rooms and students: `roomCensus(scene)` and `studentCensus()` exported from one file of their role, read by the checklist (`roomCount`, `roomCountLine`), the Doors tab ratio and Pre-season checks' scene line; one map gives one number in all three | R-next t1 (one fixture world, three readers, one number; red first: the Doors tab and the checklist differ on a locked room and a dead student) | C1 |
| E20-02 | a checklist row that checked nothing never ticks: with no students the rows over students read "No students yet" and are not done; `roomCount` not done with no rooms; `roomsMarked` not done with no named region; `cursor` reads the permissions in force as `rulers` does | R-next t1 (empty world: no tick but the optional rows that hold; red first: five ticks) | C1 |
| E20-03 | Pre-season checks' cast lines read the checklist's predicates: a student set to "- nobody -" (`feedsNobody`) gives the same verdict in both | R-next t1 (red first: diagnostics says unassigned) | C1 |
| E20-04 | "area outside rooms" is measured over the scene rect without its padding: a map whose rooms cover the scene reads 0%, not ~57% | R-next t1 (a 4000x3000 scene, padding 0.25, rooms covering it; red first: about 56% - the padded canvas is about 6000x4500, the owner's "about 57%") | C1 |
| E20-05 | the anonymity audit lists under "fix these" only characters seen beyond OBSERVER (Q-6); OBSERVER is reported as the allowed level | R-next t1 (red first: an OBSERVER character under exposed); scenario 12 ANONYMITY unchanged | C2 |
| E20-06 | the Pre-season checks report, `diagnoseCharacters`, `diagnoseScenes`' line, the anonymity literals and Check rooms' report are lang keys EN/PL; no user-facing text names a `game.drpg.` command (the initCharacter line becomes a button or a step) | R-next t1 (renders the report in PL: no English literal from a fixed list, no "game.drpg."); parity, prose | C2 |
| E20-07 | the rows amend 11.10 says to keep, built where absent: "A/V is off in this world: no voice tile", "Video mode: nobody sends audio", "Room images that do not load" (`Image.decode()` of every room image path on the GM) | R-next t1 (each row from a fixture setting; the decode row with a stand-in image that fails); E20-T1 (t2: the report on the suite's world) | C3 |
| E20-08 | E77 D5's warnings: a room image over the size limit (pixels; bytes by a HEAD request, unknown when the server gives no length) and `checkRegions` when the pieces of one room differ (Q-7 says which difference) | R-next t1 (stand-ins for the image and the HEAD answer; two pieces of one room that differ) | C3 |
| E20-09 | an empty world's Next names the first step: "Open Season setup: {first row not done}" with a button that opens it, never "Start the Eclipse" while the checklist's required rows are not done | R-next t1 (empty world; red first: nextAllDone); tier 0 R151 and 65 K1 still green | C4 |
| E20-10 | Set the season up opens at its top; its hints and the names list are at least `--drpg-text-base` in both themes (Q-4) | R-next t1 (no autofocus below the fold: the opening focus target is the first row; the CSS reader for both themes); LIVE-E20-01 (the look) | C4 |
| E20-11 | a module that did not start changes nothing of Foundry's: its rules aimed at Foundry's own elements apply only under `body.drpg-started`, stamped after `requirementsMet()`; the import-time render hooks do not throw without registered settings | R-next t1 (a static reader: every selector of the six sheets that names a non-drpg id or class is under the gate; red first: #hotbar, #scene-navigation, #players); E20-T2 (t2 or harness: init with Dice So Nice missing - no error logged by the module, no body class) | C5 |
| E20-12 | the requirements window is in the table's language: each required module's reason is a lang key (Dice So Nice's per D19: private rolls and the GM's dice look), the window's keys load without `registerLanguage` having run | R-next t1 (PL client, DSN missing: the reason in Polish); R442, R470 still green | C5 |
| E20-13 | the settings the module writes at load are listed (GM handbook) and can be given back: the value before the first write kept per setting, "Give back Foundry's settings" for a GM (Q-5) | R-next t1 (each write in the list; red first: no original kept); E20-T3 (t2: write, give back, read Foundry's value) | C6 |
| E20-14 | Season setup shows the overflow hint for this table: "Suggested for {n} students: {x}" from `studentCensus()`, 12 + n/2 as the static hint says; the default 20 unchanged (D21) | R-next t1 (4, 8, 16 students: 14, 16, 20); the default read unchanged | C6 |
| E20-15 | the books EN/PL: the GM handbook's first run (install to the first Eclipse with the windows alone), the settings given back, the requirements; `stages.json` touches; LIVE rows in audit 9.2 as items B-E20-n | parity, prose, 50, `check live` | C7 |
| E20-16 | E20's predicates are exported and named in STATUS for E51's "First session" (line A, 29.10) | STATUS.md; R-next t1 reads the exports | C1, close |

## Rules of this stage
- No new world setting a player can read holds a secret; the originals kept by C6 are Foundry's own values (no secret):
  a world setting, GM-only `config: false`, checked against `WORLD_SECRET_RULES` anyway (R9).
- New text EN and PL in pairs; `node tools/check.mjs parity` and `prose` green; no long dash.
- `roomCensus`/`studentCensus` live with the rooms (vault.mjs or rooms.mjs, whichever owns `sharedRooms` at Base) and
  the students (monokuma.mjs `studentActors`); no new file unless a family table says so (`.claude/rules/code.md`).
- The CSS gate does not touch `styles/narrow.css`'s order (it loads last on purpose) and adds no breakpoint number.

## Commits
### C1 - one census; no tick without a check; "outside rooms" without padding (doneWhen; S07-13)
- Files: vault.mjs (`roomCensus` from `sharedRooms`/`namedByName`, `wireRoomRatio` reads it), monokuma.mjs
  (`studentCensus`: all, living), season-setup.mjs (`steps()` empty-roster rows, `roomCountLine`, `cursor` via
  `permissionsInForce`), diagnostics.mjs (`diagnoseCharacters` on the checklist's predicates), fog.mjs (`diagnoseScenes`'
  count from `roomCensus`), fog-diagnostics.mjs (`sceneUncoveredPercent` over the scene rect), lang EN/PL.
- Tests: R-next t1 x4 (E20-01..04, E20-16). Own tier 2 by grep of the changed symbols (cap ~15). Scenarios: 65 (K1 reads
  the checklist's world) if git grep finds the changed rows' messages.
- Edge cases: a scene with no rooms; the trial hall as `canvas.scene`; a Bedroom (owned) and a `notShared` room; a dead
  student; a Monokuma; an actor with no owner.

### C2 - Pre-season checks in the table's language, no console command; OBSERVER is not "fix these" (S11-19, S01-23, S07-36)
- Files: diagnostics.mjs, fog.mjs (`diagnoseScenes`), anonymity.mjs (`auditAnonymity` threshold and literals),
  fog-diagnostics.mjs (Check rooms' report), season-setup.mjs (the initCharacter line as a button on the cast row), lang.
- Tests: R-next t1 x2 (E20-05, E20-06). Scenarios: 12 (ANONYMITY reads the audit).

### C3 - the rows amend 11.10 keeps and E77 D5's warnings
- Files: season-setup.mjs (`runPreSessionChecks` rows), voice-tile.mjs or voice.mjs (A/V off, Video mode predicates
  beside `videoUnwatched`), room-tile.mjs (`openRoomImage`'s decode as a shared probe), fog-diagnostics.mjs
  (`checkRegions`: pieces that differ), config.mjs (the image limits), lang.
- Tests: R-next t1 x2 (E20-07, E20-08); E20-T1 (t2).

### C4 - the first step on an empty world; the window opens at its top, readable (S06-30)
- Files: gm-panel.mjs (`nextStep()`: a branch before the Eclipse's when a required checklist row is not done; reads
  `steps()`), season-setup.mjs (`openSeasonSetup`: the opening focus), styles/danganronpa.css, styles/stained-glass.css
  (`.drpg-setup-body .notes`, `.drpg-setup-missing`), lang.
- Tests: R-next t1 x2 (E20-09, E20-10); tier 0 R151, R346 and 65 K1 named in --own/--scen.

### C5 - a module that did not start changes nothing; the requirements in the table's language (D19; S01-41, S01-45)
- Files: module.mjs (stamp `drpg-started` after `requirementsMet()`; load the lang keys the window needs before the early
  return), settings.mjs (the import-time render hooks return when the settings are not registered), requirements.mjs
  (reasons by key), styles/*.css (the rules aimed at Foundry's elements under the gate), lang.
- Tests: R-next t1 x2 (E20-11, E20-12); E20-T2; R147, R442, R470 in --own.
- Edge cases: Dice So Nice installed but off; two requirements missing; a Player's client (no `registerGmChrome` change).

### C6 - Foundry's settings given back; the overflow hint for this table (risk; D21; S02-59)
- Files: enforced.mjs, states.mjs (record the value before the first write), settings.mjs (the record's setting, the
  "Give back" menu), overflow.mjs or season-setup.mjs (the hint), lang.
- Tests: R-next t1 x2 (E20-13, E20-14); E20-T3 (t2); the backup/restore tier-2 test if the record is a GM store (it is
  not, by default).

### C7 - books, stages.json, LIVE rows
- docs/handbooks (GM EN/PL: first run; the settings and how to give them back; the requirements), `tools/stages.json`
  (E20 touches `[]`), audit 9.2 rows B-E20-1.. , R-REGISTRY.

### Mutants
None required (no MARKED commit, METHOD-A-lite 4).

## What only a table can show
- LIVE-E20-01 (B-E20-1): Set the season up opens at its top and its hints read at 1366x768 and 1920x1080, both themes.
- LIVE-E20-02 (B-E20-2): a fresh v14 world without Dice So Nice: no console error from the module, Foundry's hotbar,
  scene navigation and players list as Foundry draws them.
- LIVE-E20-03 (B-E20-3): install to the first Eclipse with the windows and the handbook alone, EN and PL (plan "verify").
- LIVE-E20-04 (B-E20-4): the HEAD request's length on a real Foundry server (and on The Forge, if the owner uses it).

## Out of scope
- S01-63 (Polish by default) -> after E66. The zone row -> E73. The "First session" screen -> E51 (on E20's predicates).
- A change to the overflow default (D21; E64 after sessions 0). The Season setup window's rebuild -> E46.

## Open owner questions (each with a default; the stage runs on the default)
- Q-1 The 24 issue ids (S01-18 ... S02-59) have no text anywhere the line can read (plan.json names them; the repo and the
  kit hold none). Default: E20 works from "why" and the amendments; the ids those name are mapped (S06-30, S11-19,
  S07-13, S02-59, S01-23, S07-36, S01-45, S01-41, S01-63), the other 15 are listed in the ledger as "not mapped".
- Q-2 The session-0 findings file amend 11.10 asks E20 to read first is not in the repo or the kit. Default: go without
  it; the owner says if Set the season up or Pre-season checks misled at session 0 in a way "why" does not name.
- Q-3 The census when the two readings differ today: count locked rooms? count the dead? Default: rooms = marked, not
  owned, not `notShared`, locked COUNTED (a lock is a state of play, not of the map); students = living (the Doors tab's
  reading: rooms are for those still playing).
- Q-4 "Hints below the legibility threshold": default: hints at `--drpg-text-base` (the body size) and the names list at
  `--drpg-text-sm` in both themes.
- Q-5 Giving Foundry's settings back: Foundry runs no module code when a module is switched off. Default: keep each
  setting's value before the module's first write, and a GM's "Give back Foundry's settings" (module settings) that
  writes them back and stops the module writing them; the GM handbook says to press it before switching the module off.
- Q-6 The anonymity audit's line: default: "fix these" lists characters whose default ownership is above OBSERVER (or a
  player's above OBSERVER on another's character); OBSERVER and below is fine, as `lowerOwnership` sets it.
- Q-7 E77 D5's limits: default: a room image over 4096 px on a side or over 8 MB warns; "pieces differ" means a room's
  regions with different `notShared`/owner/elevation (the flags the room reads), not different shapes.
- Q-8 The empty world's Next: default: "Open Season setup: {first row not done}" until the required rows hold, then
  today's lines.
