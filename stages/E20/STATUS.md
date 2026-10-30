# E20 - status

Base: 60ef9a97 (line B's branch). Spec: STAGE.md (answered 29.10.2026).

## Commits
| C | sha | QUICK |
| --- | --- | --- |
| C1 | 5ede9103 | QUICK GREEN at 60ef9a97+edits: lint/check/gate ok; prose ok; t01 ok; own(13) ok; scen 66 ok (logs /c/Users/chrob/quick-runs/60ef9a97-1811) |
| C2 | 08b92cef | QUICK GREEN at 5ede9103+edits: lint/check/gate ok; prose ok; t01 ok earlier (5ede9103-474); own(3) ok; scen 12 ok earlier (5ede9103-474); scen 66 ok earlier (5ede9103-474) (logs /c/Users/chrob/quick-runs/5ede9103-1431); R387, R1502, R1503, R1506-R1509 by name after the lint fix: 8 passed, 0 failed |
| C3 | 6ad88c5a | QUICK GREEN at 08b92cef+edits: lint/check/gate ok; prose ok; t01 ok; own(3) ok; scen 66 ok; scen 74 ok (logs /c/Users/chrob/quick-runs/08b92cef-425); R1510, R1511, R387, R503, R505, R542: 7 passed, 0 failed; E20-T1, E20-T2: 6 passed, 0 failed |
| C4 | e52a60ef | QUICK GREEN at 6ad88c5a+edits: lint/check/gate ok; prose ok; t01 ok; own(11) ok; scen 65 ok earlier (6ad88c5a-1778) (logs /c/Users/chrob/quick-runs/6ad88c5a-616); R1512-R1515 red first 1 passed 4 failed, after 5 passed 0 failed; R74's two patterns widened (the opener takes a second argument) |
| C4 fix | fd6620aa | CI on e52a60ef red: R1512 failed in 01-runtests with an incident open (`nextStep` put the incident line first); `nextStep` takes optional `incident`/`eclipse`, R1512 passes both false; fd6620aa CI green (01-runtests not run locally: it hit the agent's 40-min bound) |
| C5 | 984033fa | QUICK GREEN at fd6620aa+edits: lint/check/gate ok; prose ok; t01 ok; own(5) ok; scen 00 ok (logs /c/Users/chrob/quick-runs/fd6620aa-220); R1516, R1517 red first; 00-boot 31/33 before, 33/33 after (E20-T3 a real boot without Dice So Nice) |
| C6 | de321dad | QUICK GREEN at 984033fa+edits: lint/check/gate ok; prose ok; t01 ok; own(7) ok; scen 15 ok; scen 65 ok earlier (984033fa-825, before the last two fixes - not rerun) (logs /c/Users/chrob/quick-runs/984033fa-1746); R1518-R1521 red first 1 passed 4 failed, after 5/0; E20-T4/T5 4 passed 2 failed, after 6/0 |
| C7 | 689040ee | QUICK GREEN at de321dad+edits: lint/check/gate ok; prose ok; own(14) ok (logs /c/Users/chrob/quick-runs/de321dad-603); --no-t01 (only handbooks, the audit file, stages.json changed); first run red on R431 alone (Check rooms sentences inside the guide box), moved after it |
| fix A | c72c43ff | QUICK GREEN at 689040ee+edits: lint/check/gate ok; prose ok; t01 ok; own(12) ok; scen 65 ok earlier (689040ee-1584); scen 66 ok earlier (689040ee-1584) (logs /c/Users/chrob/quick-runs/689040ee-735); Q-8 amended R1522, C-1/C-7 R1523, C-2 R1524, C-4 R1525, G-1 R1526, G-5 R1527, C-10 R1528, C-8=G-10 R1529, G-8 R1530 - each red at 689040ee on an assertion; R1512, R1514, R198 and a tier-2 report test adjusted |
| fix B | 04417f8f | QUICK GREEN at c72c43ff+edits: lint/check/gate ok; prose ok; t01 ok; own(6) ok; scen 15 ok earlier (c72c43ff-1665); scen 12 ok earlier (c72c43ff-1665) (logs /c/Users/chrob/quick-runs/c72c43ff-228); owner's automations line + G-7 R1531 (R1518 widened), C-6 R1531 + E20-T6, C-9 E20-T6, G-2 R1532, G-6 R1533, G-3 R1534, G-4 R1508, C-5=G-9 R1535, C-3 R1536 - tier 1 8 failed and E20-T6 failed at c72c43ff, all pass after |
| gaps | bc158f09 | QUICK GREEN at 04417f8f+edits: lint/check/gate ok; prose ok; own(2) ok (logs C:/Users/chrob/quick-runs/04417f8f-62), --no-t01 (tests only, tier 2); E20-T7 (E20-19's whisper), E20-T8 (C-7 by a call); each red under a break-check; CI green run 41008175457 |

## Predicates for E51's "First session" (line A, 29.10)
All exported; R1500 reads the exports.
- `roomCensus(scene)` - scripts/vault.mjs: the scene's rooms by its flags, `{ rooms, locked, bedrooms, noPrivacy, count }`
  (names; a room counts when marked, not owned, not "No privacy"; locked counted and also listed in `locked`).
- `roomCensusOf(rows)` - scripts/vault.mjs: the same rule over rows `{ name, room, owner, notShared, locked }` (the
  Doors tab applies it to its form); same answer shape.
- `roomRatioLine(census, living)` - scripts/vault.mjs: the one rooms-per-student sentence (Doors tab and checklist),
  with the locked count after it.
- `roomsWantedFor(people)` - scripts/vault.mjs (unchanged): `ceil(people * ROOMS_PER_PLAYER)`.
- `studentCensus(actors = studentActors())` - scripts/monokuma.mjs: `{ all, living, count }`, living by `isDeadForGm`,
  `count` = living.
- `explicitPool(actor, map = assignments())` - scripts/assignments.mjs: the pool user assigned by hand, or null (never
  the fallback); `feedsNobody(actor, map)` takes the same map now.
- `steps({ roster, scenes, roomScene, assigned, lastChecks })` - scripts/season-setup.mjs: the checklist rows, each
  `{ key, done, waiting?, optional?, missing(), extra?() }`; every argument defaults to the world. `setupRows(list)`
  draws them; `cursorRoles(stored, inForce)` the SHOW_CURSOR roles in force.
- `sceneUncoveredPercent(scene)` - scripts/fog.mjs (from fog-diagnostics.mjs): percent of the scene's own rect in no
  room; the limit is `UNCOVERED_LIMIT_PCT` (config.mjs, 10).
- `diagnoseScenes({ lastChecks, scenes })` - scripts/fog.mjs: Pre-season's scene lines; `checkRegions(scene)` -
  fog.mjs: the map check, with "No scene on the canvas" / "No rooms on this scene" rows.

## CI and the close (30.10.2026)
- CI on 04417f8f: green, run 40999636058 (https://github.com/Akrobacjum/Danganronpa-RPG/actions/runs/40999636058): 19 jobs success, "crlf" skipped. This covers the scenario-65 rerun C6 left to CI.
- LEDGER.md: ANSWERED 24, OPEN 0 (E20-19 since bc158f09, E20-T7), LIVE 0 rows (B-E20-1..7 not measured at a table). The 18 end-review findings are all fixed (LEDGER.md, second section).
- Registry: next free R1537 (`node tools/registry.mjs --next` at 04417f8f); line B used R1500-R1536.

## Open
Closed by the fixes and dropped from this list: C4's question on the Next line (answered by the owner, Q-8 amended, c72c43ff R1522); C5's language question (the owner: it stands); C3's Q-7 readings (8 MiB, 8 s, same floors: the owner: they stand); C3's "new Pre-season rows still need C7's text" and C5's "GM handbook's requirements table" (C7 689040ee, gm-handbook.en.md :32, :138-:139); C6's "scenario 65 not rerun" (CI above); C6's "worlds changed by an earlier version" for the automations and held player settings (04417f8f R1531, E20-T6); C7's "next free R1522" (now R1537); the C6 for C7 line (done in C7).
- C1 gap: UNCOVERED_LIMIT_PCT = 10 is a choice, not measured on a real map - B-E20-7 / the owner
- C1 gap: the Doors tab's "too many rooms" warning counts locked rooms (Q-3 stands), so closing a wing no longer clears it - the owner
- C1 gap: the last Check rooms is kept per scene in the GM's browser only until a reload; console game.drpg.checkRegions() records none - the review
- C1 gap: line A takes its own R1049+ by hand while line B holds R1500-R1536 - the orchestrator
- C1 gap: quick.sh on Git Bash: the flock shim shifts 2 for "flock -w N LOCK" (runs the lock path, exit 127) and ps -eo is cygwin-unsupported (reap does nothing); run with a PATH flock stand-in at /c/Users/chrob/qbin - the orchestrator (tools)
- C2 gap: Show on map (the local mark, the floor switch) not measured on a real canvas - B-E20-5
- C2 gap: the Pre-season window's scroll at 1366x768 not measured - B-E20-1
- C2 gap: `diagnoseDespair` (console report, scripts/diagnostics.mjs :155) still English - the review
- C2 gap: the anonymity audit still counts Monokuma like any character (unchanged behaviour) - the review
- C2 note: Pre-season's scene marks are check/cross signs instead of "ok"/"!!"; the room-check findings' English titles kept (scenario 66 reads them)
- C3 gap: a real browser's image decode and the HEAD request's size on a real Foundry server / The Forge not measured; 3 probes at a time on a real server not measured - B-E20-4
- C3 gap: the trial hall's picture is not checked (not a room)
- C4 gap: opening at the top and the scroll at 1366x768 / 1920x1080, and "bring to front" against Foundry's real window stacking, not measured - B-E20-1
- C4 gap: the checklist's cost per redraw of the GM panel's Next line not measured - the review
- C4 lesson: quick's t01 was green on e52a60ef and CI's 01-runtests red - a test that reads world state (an open incident) passes alone and fails in the whole run
- C5 gap: a real v14 client without Dice So Nice not measured (00-boot E20-T3 is a headless boot) - B-E20-2
- C5 gap: a comment in gm-panel.mjs explains the GM's chrome stamp by a stylesheet left on the page (the stamp stays, R470) - the review
- C5 note: no recommendations window at HEAD (removed 1.2.73); for S13-43 only the requirements window's counted intro was fixed
- C6 note: the overflow line is worked out in gm-team-dialog.mjs (in overflow.mjs it made an import cycle, R161); R808 restores the player-side settings record its hold writes; the module saves the old value after its own write (scenario 15)
- C6 gap: "Give back Foundry's settings" in a real v14 settings window not measured (the harness's menu registration does nothing) - B-E20-6
- C6 gap: automations go back to Daggerheart 2.6.5's defaults (2.10.x not read); file permissions stay for a world an earlier version changed (the window says so) - the review
- C6 gap: scenes get their vision back from turning off "Rooms decide what players can see", not from the button (the handbook's box says so) - the review
- C7 note: AUDIT 9.2 B-E20-1..7 (LIVE-E20-01..07) at AUDIT-1.2.42.md :1090-:1102, none measured at a table; stages.json E20 `touches: []`, planned 1.2.104, not shipped
- C7 gap: README's requirements table keeps the old Isometric / Dice So Nice wording - README is line A's file; the owner (30.10): README stays
- fix A reading: "the season started" = the clock past chapter 1, day 1, session 1, the first time of day (the fixer's reading of the owner's Q-8 words; not confirmed by the owner)
- fix A gap: the restored scroll and focus of a round trip not measured on a real Foundry (no layout in the harness) - B-E20-1
- fix A gap: Room Setup's fog tab shows the worst floor's percentage without naming the floor
- fix A gap: R1523 reads the Next line's school default (`firstOutstandingStep`) by a source pattern, not by a call with a side map on screen - the review
- fix B note: C-9 also covers worlds an earlier version wrote to - a player setting already at the held value is kept as the player's own, Give back leaves it
- fix B gap: the local mark and the floor switch on a real v14 canvas, and 3-at-a-time probes on a real server - B-E20-4, -5, -6
