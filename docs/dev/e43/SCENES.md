# A project in a room whose name several scenes hold: design note

Written 16.11.2026 by the line claude/e43-117 on ff3e12e5 (1.2.116), for the owner's choice between (b) and (c). Nothing
here is built. Every reader below was read on ff3e12e5; nothing was run for this note.

## Where it stands

The owner (16.11.2026, through the coordinator): their world has no second scene with a room of the same name today, "but
it will surely happen one day". So:

- the lead of 01:31 (a second scene with a room of the same name hides the project's action) does not explain the owner's
  P1 symptom (docs/dev/e53/STATUS.md: a public, completed project with a room, the character in that room, the action
  shown neither to the player nor to the GM). That symptom stays unexplained;
- the case of several scenes has to work one day, and how is the owner's choice:
  - **(b)** a project works in every room of its name, on every scene;
  - **(c)** the GM picks the scene in the project's editor, the picker shown only when more than one scene holds a room of
    that name; everything else as today. The coordinator's default for the owner.

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

## Option (b): every room of the name, on every scene

**The rule.** A completed project's room action is offered wherever a character stands in a room of the project's name,
on any place scene. No stored field, no picker.

**Scope, a question inside the option.** "A project works" can mean its room action alone, or everything a project does
where it stands. Read alone, the owner's words are about the action (P1's symptom). If (b) reaches Work, Sabotage, the
Monocub and the traps too, it undoes E12 fix r1-G3, which the review called a defect: the project could be worked on and
sabotaged from a room that is not where it stands, and its trap would fire in every room of the name. This note's default
inside (b): **the room action alone**; Work, Sabotage, the Monocub and the traps stay on one scene as today.

**What changes (the room action alone).**

- facilities.mjs `projectActionsWith`: `here` reads the room's name only (`place.room === project.room`) on a place scene,
  where it asks `standsAtProject`. It is the one reader of the action on both sides: `facilityRows` on the player's
  browser, and `offerAt` (so `handleFacilityUse`) on the GM's.
- Nothing else: `standsAtProject` and `projectScene` stay as they are for every other reader, and the token stays one,
  on `sceneOfRoom`'s scene.

**What follows from it, to tell the owner.**

- The map shows the project's token on one scene while its action works on others.
- A use's limit counts per character, not per scene (`projectActionKey(projectId, actorId)`): a character who used it in
  Floor 1's Kitchen this time of day has used it in the Annex's too. A GM's own room actions stay per scene
  (`gmActionKey(sceneId, room, id)`).
- A use's effects fall where it was used (`targetsOf(..., place)`, `occupantsOf(place.room, actor, place.scene)`), and its
  trace is left there.
- Two rooms of one name that are different places in the fiction (a school's Kitchen, a hotel's Kitchen) both give the
  action.

**A stale state.** None stored, so none to go stale. A room renamed on one scene stops giving the action there, as a
renamed room does today; a scene deleted takes its rooms with it.

**A player's copy.** Nothing new: the room's name is already in projectMeta (a public project) or in the insider's sight
copy (`sightExtras`' `room`).

**Tests.**

- Tier 1 (R7640): `projectActionsWith` with fakes - a completed project in "Kitchen", a place on scene A's Kitchen and one
  on scene B's: both rows; a place on B's Pantry: none. Red at ff3e12e5 (B's Kitchen reads none).
- Tier 2: on a world with a second place scene holding a Kitchen, a character on it is offered the action by
  `facilityRows` and served by the GM's `handleFacilityUse` (its effects on that scene's occupants), and still not offered
  the project by Work's list, and refused by Work's guard - the old test "a project is reached only on its own scene ..."
  stays green as it is.
- Scenario 99 (facilities): its road "a copy of the scene holding the same room names" reads "not measured" because the
  harness's scene clone answered the original's id (docs/dev/e53/STATUS.md); the harness needs a second scene of its own
  with a room of the same name, a seed beside the Annex, before the road can be read.

## Option (c): the GM picks the scene (the coordinator's default)

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
| projects-map.mjs `placeProjectToken` | with no `scene` handed in, on `projectScene`'s answer where it named none and on `sceneOfRoom` where it did |
| projects-map.mjs `syncOneProjectToken`, `moveProjectToken` | a token standing on another scene than the picked one is taken off and put back (a token does not change scenes; the same road as a token whose scene lost the room) |
| projects-map.mjs the sync's "has a place" test | the picked scene, else `sceneOfRoom` |
| projects-map.mjs `onProjectTokenDeleted` | a copy on the picked scene stands for the project before a copy on another; a copy on another scene leaves the token to the sync |
| fog.mjs `carryRoomInWorld` | carries a project's room when `projectScene(id)` is the renamed scene, in place of "its token's scene, else the first holding the old name" |
| traps.mjs, a trap's plant | `projectScene(id)?.id` in place of `tokenRefOf(...).sceneId ?? sceneOfRoom(room)` |
| projects-ui.mjs `openProjectDialog` | the picker: shown when `placeScenes().filter(s => roomRegions(s, room).length)` holds two or more, redrawn when the room changes; its options those scenes by name, the home scene first; preselected with the stored pick, else with what `sceneOfRoom` answers |
| the manager's room column (projects-ui.mjs `projectManagerRows`) | no picker of its own (the editor is the one place): a room changed there keeps the pick when the new room's scenes include it, else clears it |
| projects.mjs `sightFor` / `sightExtras`, `receiveSight` | the secret project's `roomScene` rides the insider's sight copy beside `room` |
| api.mjs `createProject` | takes an optional scene, held to the same test as the picker's |
| text | the picker's label and tooltip, `DRPG.Project.roomScene` and `DRPG.Tips.Actions.roomSceneTooltip`, en and pl; a GM handbook line en/pl |

Unchanged: `locateActor` and `gmPlaceOf`. They say where the character stands; the pick says where the project stands, and
`standsAtProject` compares the two.

**A stale pick.**

- The picked scene is deleted: `projectScene` no longer finds it and reads today's rule, so the project stands where an
  unpicked one would, on both browsers alike. The primary GM also clears the field (on `deleteScene`, and in a sweep at its
  ready for a scene deleted while it was away), through `applyProjectChange`, and whispers the GMs which project lost its
  scene and where it stands now. The token went with its scene; the sync puts one on the new scene.
- The room is renamed on the picked scene: `carryRoomInWorld` carries the project's room to the new name, and the pick
  stays (it is the same scene).
- The room is renamed on another scene: nothing changes for the project.
- The picked scene no longer holds a room of the name (its region deleted, or a rename not carried): the pick fails the
  "holds a room of the project's name" test, so today's rule; the field stays until a GM picks again or changes the room,
  so a region put back restores it. The editor shows the picker with the stored scene marked as no longer holding the
  room.
- The room's name is held by one scene again (the other's room renamed or deleted): the picker is no longer shown; a
  stored pick naming the scene that still holds it reads the same as no pick; one naming the other scene fails the test
  above.

**A player's copy.** A public project: `roomScene` in projectMeta, which every browser holds. A secret project: the
insider's sight copy (`sightFor`, `receiveSight`, read through `toldSight`), as `room` and since P1 the room action. A
player's `projectScene` reads the copy where projectMeta holds nothing; an insider whose copy has not come yet reads today's
rule, which may name the other scene until it comes. The GM's run judges a use, a Work and a Sabotage on its own half
either way.

**Tests.**

- Tier 1 (R7640): `projectScene`'s rule over fakes, each row of it - a pick that holds the room, a deleted pick, a pick that
  lost the room, no pick with a token, no pick and no token. Red at ff3e12e5 (no pick is read).
- Tier 1 (R7641): the editor's picker shown for a name two place scenes hold and not for one, read off the dialog's
  builder (its choice of scenes as a pure function).
- Tier 0 (R7642): `roomScene` in `PROJECT_SECRET_WHILE_SECRET` and in world-secrets.mjs's rule for a secret project's row,
  the two lists equal (the existing tier-0 reading, extended), with R190's fixture.
- Tier 2: on a world with a second place scene holding a Kitchen, a project picked onto it - its token placed there, its
  action offered to a character there and served by the GM, not offered in the home scene's Kitchen, Work and Sabotage
  listed and guarded there alone; the picked scene deleted (falls back, field cleared, GMs told); the room renamed on the
  picked scene (carried, pick kept). The old test "a project is reached only on its own scene ..." stays green.
- Scenario 99 (facilities): the duplicate road, once the harness seeds a second scene of its own (above).
- Scenario 72 (the canary): a secret project's `roomScene` reaches no bystander's browser, and reaches the insider's sight
  copy.

## What the two cost, side by side

| | (b) the room action alone | (c) the GM's pick |
| --- | --- | --- |
| Stored state | none | `roomScene`, public or the GMs' while secret |
| Readers changed | 1 (`projectActionsWith`) | about 12 (the second table above) |
| New text | none | a label, a tooltip, a handbook line, en/pl |
| Stale cases | none | four, each with a rule above |
| Secrecy | nothing new | one field in the secret rules and the sight copy |
| What the map says | the token on one scene, the action on all | one scene for the token, the action and the rest |
| Undoes a review fix | no, if kept to the action; yes, if it reaches Work and Sabotage | no |

## Questions for the owner (through the coordinator)

| Id | Question | Default |
| --- | --- | --- |
| Q-SC-1 | (b) or (c) | (c), the coordinator's default |
| Q-SC-2 (if b) | Does (b) reach Work, Sabotage, the Monocub and the traps, or the room action alone? | the room action alone |
| Q-SC-3 (if c) | Is the picker the editor's alone, or also a column of the Projects manager? | the editor's alone |
| Q-SC-4 (if c) | When the picked scene is deleted, are the GMs whispered which project moved? | yes, one whisper per project |
