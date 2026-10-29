# E20 - status

Base: 60ef9a97 (claude/fervent-sagan-gme4vt-b). Spec: STAGE.md (answered 29.10.2026).

## Commits
| C | sha | QUICK |
| --- | --- | --- |
| C1 | 5ede9103 | QUICK GREEN at 60ef9a97+edits: lint/check/gate ok; prose ok; t01 ok; own(13) ok; scen 66 ok (logs /c/Users/chrob/quick-runs/60ef9a97-1811) |

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
- C1 gap: Pre-season's new English literals (no-cast line, "falls back to") wait for the report's keys - C2
- C1 gap: registry's "Next free" now reads R1506 (line B's R1500-R1505 are the highest numbers); line A takes its own R1049+ by hand - the orchestrator
- C1 gap: quick.sh on Git Bash: the flock shim shifts 2 for "flock -w N LOCK" (runs the lock path, exit 127) and ps -eo is cygwin-unsupported (reap does nothing); run with a PATH flock stand-in at /c/Users/chrob/qbin - the orchestrator (tools)
