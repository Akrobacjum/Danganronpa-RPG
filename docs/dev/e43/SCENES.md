# A project in a room whose name several scenes hold: design note for option (c)

Written 16.11.2026 by the line claude/e43-117 on ff3e12e5 (1.2.116); the first version (a48e822e) set out options (b)
and (c) side by side. The owner chose **(c)** on 16.11.2026 (through the coordinator): the GM picks the scene in the
project's editor, the picker shown only when more than one scene holds a room of that name; everything else as today.
This version is (c) alone, the design the build follows. Every reader below was read on ff3e12e5. **Built** on this line
(the commit after a56ffb13; [STATUS.md](STATUS.md) has its readings); where the build differs from the design below, the
design was changed to say what was built.

## Where it stands

- The owner's world has no second scene with a room of the same name today, "but it will surely happen one day".
- The lead of 01:31 (a second scene with a room of the same name hides the project's action) does **not** explain the
  owner's P1 symptom (docs/dev/e53/STATUS.md: a public, completed project with a room, the character in that room, the
  action shown neither to the player nor to the GM). That symptom stays unexplained, and (c) does not claim to fix it.

## How one scene is chosen today (read on ff3e12e5)

A project names a room by its name alone (projectMeta `room`; the GMs' row while the project is secret, projects.mjs
`roomOf`). The scene comes from one function:

- projects.mjs `projectScene(id)`: the scene of the project's map token (`tokenRefOf`: projectMeta `tokenId`,
  `tokenScene`), else rooms.mjs `sceneOfRoom(room)`.
- rooms.mjs `sceneOfRoom(name)`: the first of `placeScenes()` holding a room of that name, where `placeScenes()` is the home
  scene first, then the other place scenes in the world's order. Never the scene on screen.
- projects.mjs `standsAtProject(place, id)`: the room's name matches `place.room` and `place.scene` is `projectScene(id)`.
  This was E12 fix r1-G3 (11.10.2026, review SEC-1): before it, a character in the Annex's Kitchen was offered, and could
  work on and sabotage, the project standing in Floor 1's Kitchen (the tier-2 test "a project is reached only on its own
  scene and not through a room of its name on another").
- projects-map.mjs `placeProjectToken(id, { scene })`: on `scene`, else on `sceneOfRoom(room)`; it writes `tokenScene`.
  Its callers name no scene (`syncOneProjectToken`, `moveProjectToken`, `showProjectOnMap`), so the token stands on
  `sceneOfRoom`'s scene and `projectScene` then answers that scene through the token.
- Where a character stands: movement.mjs `locateActor(actor, { sceneId })` picks among the character's tokens on place
  scenes: the hinted scene among their own, else the one token a GM has not hidden, else the home scene's, else the
  active scene's, else the first. The primary GM reads `gmPlaceOf(actor)`: `locateActor`'s token, with the room and floor
  of the spot the GMs read (`gmSpotOf`).
- The project's editor (projects-ui.mjs `openProjectDialog`) and the manager's row both offer `placeRoomNames()`: every
  room name of every place scene, once each. A GM cannot say which scene's Kitchen today.

So with two scenes holding a Kitchen, a project in the Kitchen stands on the home scene if it has one, else on the first
in the world's order, whatever the GM meant; a character in the other scene's Kitchen is offered nothing of it, on their
browser (`facilityRows`) and on the GM's (`offerAt`), which agree.

Every reader of `standsAtProject` or `projectScene`, all of which follow whatever `projectScene` answers:

| Reader | File | What it decides |
| --- | --- | --- |
| `projectActionsWith`, `projectActionsAt` | facilities.mjs | the completed project's room action in a character's Facilities |
| `facilityRows` | action-facilities.mjs | the Facilities tile and window, on the player's browser |
| `offerAt`, then `handleFacilityUse` | facilities-gm.mjs, bridge-runs-acts.mjs | the GM's judgement of a use, at `gmPlaceOf` |
| `secretsUnknownIn`, `projectsListedIn`, `projectsAvailableIn`, `sabotageTargetsIn` | projects.mjs | the Work and Sabotage lists where a character stands |
| the project picker | action-project.mjs (`standsAtProject` by `import()`) | Work's and Sabotage's picker |
| the Work and Sabotage guards | bridge-guards.mjs (two guards, `standsAtProject(locateActor(...))`) | the GM's refusal "the character is not in that room" |
| the Monocub's project ability | monocub.mjs | which public project a Monocub may act on, and its guard |
| `trapsIn`, a trap's scene | traps.mjs (`standsAtProject`, `projectScene`) | the traps armed in a room, the scene a trap fires on |
| what a player saw last | projects-seen.mjs (`projectScene`) | the seen snapshot's scene |
| `where` of a change | projects.mjs (`projectScene`, the change entry's `{ room, sceneId }`) | the scene a change is told for |

And the readers that ask `sceneOfRoom` directly about a project's room, which `projectScene` does not reach:

| Reader | File | What it decides |
| --- | --- | --- |
| `placeProjectToken` | projects-map.mjs | the scene the token is put on |
| `moveProjectToken` | projects-map.mjs | whether a token whose scene lost the room is taken off and put back |
| the sync's "has a place" test | projects-map.mjs (`if (!sceneOfRoom(room)) return false`) | whether a project has anywhere to stand |
| `onProjectTokenDeleted` | projects-map.mjs | which other copy of the token stands for the project (any scene's) |
| `carryRoomInWorld` | fog.mjs | whether a room's rename on a scene carries a project's room (its token's scene, else "the first place scene holding the old name is this one") |
| a trap's plant | traps.mjs (`tokenRefOf(...).sceneId ?? sceneOfRoom(room)`) | the scene a planted trap is keyed on |
| `createProject` (console) | api.mjs | refuses a room no place scene holds |

## The design

**The rule.** A project with a room may name the scene of that room. Named, it stands there; not named, the rule of today
(`sceneOfRoom`, the home scene first). The editor shows the picker only when more than one place scene holds a room of the
chosen name; with one, nothing is shown and nothing is stored.

**Where the pick is stored.** A new project field, `roomScene` (a scene id, or null), beside `room`, written by
projects-secrecy.mjs `setProjectMeta` and changed through projects.mjs `applyProjectChange`, the one queue of a project's
changes (E36 C2):

- a public project: in projectMeta, as `room` is;
- a secret project: in the GMs' row while it is secret, as `room` has been since leak-pm (14.11.2026). It joins
  `PROJECT_SECRET_WHILE_SECRET` (projects-secrecy.mjs), so a reveal moves it into projectMeta and a reseal moves it back
  with the room, and world-secrets.mjs's rule for a secret project's projectMeta row holds it out (tier 0 holds the two
  lists equal; R190 asks the rule a fixture). Its token, when it has one, already says the scene to any console: a
  world document carrying the countdown's id in its own flag, named by projectMeta's `tokenScene` (world-secrets.mjs, the
  note on `tokenId`). The field matters for a project with no token (`mapHidden`, or none placed yet), whose scene would
  otherwise be news to a console.

`null` is "today's rule", so every project in every world reads as it does now until a GM picks.

**`projectScene`, the one rule.** The picked scene when it exists, is a place scene and holds a room of the project's
name; else the token's scene; else `sceneOfRoom(room)`. The pick goes first so the project has one answer: the sync then
puts the token on that scene (below), and `tokenScene` agrees with the pick once it has run.

**Every reader that changes.**

| Reader | Change |
| --- | --- |
| projects.mjs `projectScene` | the rule above. `standsAtProject` and every reader of the first table follow with no change of their own |
| projects-map.mjs `placeProjectToken` | with no `scene` handed in, on the pick when it stands, else on `sceneOfRoom` as today |
| projects-map.mjs `syncOneProjectToken`, `moveProjectToken` | a token standing on another scene than the picked one is taken off and put back (a token does not change scenes; the same road as a token whose scene lost the room) |
| fog.mjs `carryRoomInWorld` | a picked project's room is carried when the pick is the renamed scene; an unpicked one's as today ("its token's scene, else the first holding the old name") |
| traps.mjs `openPlantDialog`, the scene preselected | `projectScene(id)`: the stood pick, else the token's scene, else `sceneOfRoom` (before: the token's scene id, else `sceneOfRoom`) |
| projects-ui.mjs `openProjectDialog` | the picker: shown when `placeScenes().filter(s => roomRegions(s, room).length)` holds two or more, redrawn when the room changes; its options those scenes by name, the home scene first; preselected with the stored pick when it stands, else with the scene `projectScene` answers now; a line under it when the stored pick fails (gone, or no longer holding the room) naming where the project stands now. Save writes the shown scene, or null when the picker is not shown |
| the manager's room column (projects-ui.mjs `projectManagerRows`) | no picker of its own (the editor is the one place): a room changed there clears the pick, so it reads today's rule until a GM picks in the editor |
| projects.mjs `sightFor` / `sightExtras`, `receiveSight` | the secret project's `roomScene` rides the insider's sight copy beside `room` |
| projects.mjs `createProject` | takes `roomScene`, kept only when it is one of the room's choices (`roomSceneChoices`); the console's `game.drpg` road was not given one (api.mjs unchanged) |
| projects.mjs `projectEditChange` | carries `roomScene` beside `room`; the editor's Save writes it only when there is a pick or one to clear, so a world with no duplicate keeps its rows as they were |
| text | the picker's label, its tooltip and the stale line (`DRPG.Project.roomScene`, `DRPG.Tips.Actions.roomSceneTooltip`, `DRPG.Project.roomSceneStale`), en and pl; the GM handbook's Projects section names the control, en and pl |

Unchanged: `locateActor` and `gmPlaceOf`. They say where the character stands; the pick says where the project stands, and
`standsAtProject` compares the two.

**A stale pick.** The coordinator's default, put to the owner: **fall back to today's rule, and say so in the editor**;
the other road would be to hide the project until a GM picks again. Nothing clears the field by itself, so a pick that
comes good again (a room put back) stands again.

- The picked scene is deleted: `projectScene` no longer finds it and reads today's rule, so the project stands where an
  unpicked one would, on every browser alike. Its token went with the scene; the sync puts one on the scene today's rule
  names. The editor, opened on it, says the picked scene is gone and names where the project stands now; Save writes
  the scene then chosen.
- The room is renamed on the picked scene: `carryRoomInWorld` carries the project's room to the new name, and the pick
  stays (it is the same scene).
- The room is renamed on another scene: nothing changes for the project.
- The picked scene no longer holds a room of the name (its region deleted, or renamed and not carried): the pick fails
  the "holds a room of the project's name" test, so today's rule; the editor says so as above.
- The name is held by one scene again (the other's room renamed or deleted): the picker is not shown; a pick naming the
  scene that still holds it reads as no pick does; a pick naming the other fails the test above.

**A player's copy.** A public project: `roomScene` in projectMeta, which every browser holds. A secret project: the
insider's sight copy (`sightFor`, `receiveSight`, read through `toldSight`), as `room` and since P1 the room action. A
player's `projectScene` reads the copy where projectMeta holds nothing; an insider whose copy has not come yet reads today's
rule, which may name the other scene until it comes. The GM's run judges a use, a Work and a Sabotage on its own half
either way.

**Tests.**

- Tier 1 (R7641): `projectScene`'s rule over its readers handed in - a pick that holds the room, a deleted pick, a pick
  that lost the room, no pick with a token, no pick and no token - each answer. Red at ff3e12e5 (no pick is read).
- Tier 1 (R7642): the editor's choice of scenes as a pure function - two place scenes holding the name give both, the
  home scene first; one gives none (no picker); a stale stored pick is named as stale.
- Tier 0 and R190: `roomScene` in `PROJECT_SECRET_WHILE_SECRET` and in world-secrets.mjs's rule (the existing tier-0
  reading holds the two lists equal); R190 (tier 1) given its fixture, as it asks of every rule.
- Tier 2, **no duplicate behaves as today, held by a test**: on the suite's world (no two place scenes share a room
  name), a project made with a room through the editor's save stores no pick, and `projectScene`, its token's scene and
  the facility rows read what they read with the field absent.
- Tier 2, **the duplicate, on the GM and on the player**: a second place scene holding a room of the same name as one of
  the home scene's; a completed public project with a room action, picked onto the second scene - its token there, the
  action offered by `facilityRows` and served by `handleFacilityUse` to a character standing in the second scene's room,
  and not offered in the home scene's room of that name. Then the picked scene deleted: the project falls back to the
  home scene's room. The old test "a project is reached only on its own scene and not through a room of its name on
  another" stays green as it is. Tier 2 runs on the GM's page.
- Scenario 99 (facilities), **the player's side**: the road "a copy of the scene holding the same room names" with a scene
  of its own holding a room of the same name (until now its scene clone answered the original's id,
  docs/dev/e53/STATUS.md): p1's Facilities rows read on p1's own page, in the picked scene's room and in the other's.
- Scenario 72 (the canary): a secret project's `roomScene` on no bystander's browser, and on the insider's sight copy.
  **Not built**: the coordinator's list named the no-duplicate test and the two-scene test on the GM and the player, and
  72's world scan already holds every secret project's projectMeta row to the rule that now names `roomScene`; what no
  run reads yet is a secret project with a pick - that it stays off a bystander's world data, and that the insider's
  copy carries it (R7641 reads `sightExtras`' source only).

What the build measured, and what it did not, is in STATUS.md.

## Questions for the owner (through the coordinator)

| Id | Question | Default |
| --- | --- | --- |
| Q-SC-2 | A stale pick (its scene deleted, or no longer holding the room): fall back to today's rule, or hide the project until a GM picks again? | fall back, and the editor says so |
| Q-SC-3 | Is the picker the editor's alone, or also a column of the Projects manager? | the editor's alone |
