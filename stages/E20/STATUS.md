# E20 - status

Base: 60ef9a97 (claude/fervent-sagan-gme4vt-b). Spec: STAGE.md (answered 29.10.2026).

## Commits
| C | sha | QUICK |
| --- | --- | --- |
| C1 | 5ede9103 | QUICK GREEN at 60ef9a97+edits: lint/check/gate ok; prose ok; t01 ok; own(13) ok; scen 66 ok (logs /c/Users/chrob/quick-runs/60ef9a97-1811) |
| C2 | 08b92cef | QUICK GREEN at 5ede9103+edits: lint/check/gate ok; prose ok; t01 ok earlier (5ede9103-474); own(3) ok; scen 12 ok earlier (5ede9103-474); scen 66 ok earlier (5ede9103-474) (logs /c/Users/chrob/quick-runs/5ede9103-1431); R387, R1502, R1503, R1506-R1509 by name after the lint fix: 8 passed, 0 failed |
| C3 | 6ad88c5a | QUICK GREEN at 08b92cef+edits: lint/check/gate ok; prose ok; t01 ok; own(3) ok; scen 66 ok; scen 74 ok (logs /c/Users/chrob/quick-runs/08b92cef-425); R1510, R1511, R387, R503, R505, R542: 7 passed, 0 failed; E20-T1, E20-T2: 6 passed, 0 failed |
| C4 | e52a60ef | QUICK GREEN at 6ad88c5a+edits: lint/check/gate ok; prose ok; t01 ok; own(11) ok; scen 65 ok earlier (6ad88c5a-1778) (logs /c/Users/chrob/quick-runs/6ad88c5a-616); R1512-R1515 red first 1 passed 4 failed, after 5 passed 0 failed; R74's two patterns widened (the opener takes a second argument) |
| C4 fix | fd6620aa | CI on e52a60ef red: R1512 failed in 01-runtests with an incident open (`nextStep` put the incident line first); `nextStep` takes optional `incident`/`eclipse`, R1512 passes both false; fd6620aa CI green (01-runtests not run locally: it hit the agent's 40-min bound) |
| C5 | 984033fa | QUICK GREEN at fd6620aa+edits: lint/check/gate ok; prose ok; t01 ok; own(5) ok; scen 00 ok (logs /c/Users/chrob/quick-runs/fd6620aa-220); R1516, R1517 red first; 00-boot 31/33 before, 33/33 after (E20-T3 a real boot without Dice So Nice) |

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

## Open
- C1 gap: UNCOVERED_LIMIT_PCT = 10 is a choice, not measured on a real map (a LIVE row for the owner's school map) - C7 (LIVE rows) / the owner
- C1 gap: the Doors tab's "too many rooms" warning counts locked rooms (Q-3), so closing a wing no longer clears it - the review / the owner
- C1 gap: the last Check rooms is kept per scene in the GM's browser only until a reload; console game.drpg.checkRegions() records none - the review
- C1 gap: registry's "Next free" read R1506 (R1510 after C2) (line B's R1500-R1505 are the highest numbers); line A takes its own R1049+ by hand - the orchestrator
- C1 gap: quick.sh on Git Bash: the flock shim shifts 2 for "flock -w N LOCK" (runs the lock path, exit 127) and ps -eo is cygwin-unsupported (reap does nothing); run with a PATH flock stand-in at /c/Users/chrob/qbin - the orchestrator (tools)
- C2 gap: "Show on map" (pan and mark) not measured on a real canvas - C7 writes it to AUDIT 9.2 as B-E20-5
- C2 gap: the Pre-season window's scroll at 1366x768 not measured - C7 (B-E20-1)
- C2 gap: `diagnoseDespair` (console report) still English - the review
- C2 gap: the anonymity audit still counts Monokuma like any character (unchanged behaviour) - the review
- C2 note: Pre-season's scene marks are now check/cross signs instead of "ok"/"!!"; the room-check findings' English titles kept (scenario 66 reads them)
- C3 gap: a real browser's image decode not measured (harness: a stand-in in R1510, the server's 404 in E20-T2) - C7 LIVE
- C3 gap: the HEAD request's size on a real Foundry server / The Forge not measured (LIVE-E20-04); 8 s per picture is the implementer's choice; "8 MB" read as 8 MiB - C7 / the review
- C3 gap (Q-7 reading, for the review): height compared only between pieces on the same floors; the trial hall's picture not checked (not a room)
- C3 note: the GM handbooks' `checkRegions()` row (EN/PL) already names the new finding (R387 reads it); the new Pre-season rows still need C7's text
- C4 question for the owner (default: as Q-8 says): a running world with a required Season setup row not done shows the setup line in Daily Life instead of "N students still have actions"
- C4 gap: opening at the top and the scroll at 1366x768 / 1920x1080 not measured (LIVE-E20-01) - C7
- C4 gap: "bring to front" after a row's Open not measured against Foundry's real window stacking (the harness has none) - C7 / the review
- C4 gap: the checklist's cost per redraw of the GM panel's Next line not measured - the review
- C4 lesson: quick's t01 was green on e52a60ef and CI's 01-runtests red - a test that reads world state (an open incident) passes alone and fails in the whole run
- C5 gap: a real v14 client without Dice So Nice not measured (LIVE-E20-02) - C7
- C5 gap: the GM handbook's requirements table keeps the old Isometric/LiveKit wording - C7
- C5 gap: a comment in gm-panel.mjs explains the GM's chrome stamp by a stylesheet left on the page (the stamp stays, R470) - the review
- C5 note: no recommendations window at HEAD (removed 1.2.73); for S13-43 only the requirements window's counted intro was fixed
- C5 question for the owner (default: as built): with no module language stored, the requirements window follows Foundry's language (the module's setting cannot change while the module is stopped); S01-63's English default waits for E66
