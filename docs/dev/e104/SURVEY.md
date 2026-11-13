# E104 survey: what the case planner can plan, against what the real roads take

The owner, 13.11.2026: "Planer zagadki - niech pozwala przypisac od razu lokalizacje, trudnosc i wszystkie parametry
kazdemu zaplanowanemu remnantowi/bulletowi. Upewnijmy sie ze gm moze zaplanowac kazdy rodzaj i kazdy szczegol. Od
1.2.112."

Read at 1f82ba35 (claude/e97-98 with 1.2.110 merged), in the code, not run. "Plan holds" is what a planned row keeps
before anything is placed; "placing passes" is what the road from the plan to the real thing hands over without the GM
typing it again. Each road is cited as file `function`.

## What "location" and "difficulty" are in this module

- **Location is a scene and a room, never a spot.** Every GM road places a Remnant at a random point inside the room's
  region: New Remnant (investigation.mjs `openNewTrace` -> `randomPointIn`), a Key slot's Place
  (`createKeyRemnant` -> `randomPointIn`), the Final Truth (mastermind.mjs `placeFinalRemnant` -> `randomPointIn`). Only a
  Remnant left by a student's action has a spot of its own (the token's place), and no GM road asks for one. So a plan
  holds a scene and a room. A spot cannot be planned honestly, because no real road takes one.
- **Difficulty is the band.** A Remnant's Observe DC is read from the table by its band (visibility: obvious, evident,
  subtle, hidden) and its type's column (config.mjs `observeDc`, `OBSERVE_DC`). Planning the band and the type plans the
  DC. A Key slot's `scale` (trivial ... desperate, `KEY_REMNANTS.scale`) is a label for the GM and is not used as a DC
  anywhere; a Key Remnant's DC is its band's "key" column, like any Remnant's.
- **Scene.** New Remnant and a Key slot's Place use the scene the dashboard was built from (investigation.mjs
  `workingScene`, or `sceneId` handed to `openNewTrace`). The Final Truth uses the room's scene (rooms.mjs
  `sceneOfRoom`, or the room option's `data-scene`). The planner's room pickers already list rooms across the place
  scenes with each option's scene (utils.mjs `placeRoomOptions`), but a planned row keeps the room's name only.

## The kinds a GM makes for a case

| # | Kind | Real road (GM) | Planned today |
| --- | --- | --- | --- |
| 1 | Planned Remnant: Incident, Prep, Neutral, Faint, Tamper | investigation.mjs `openNewTrace` -> remnants.mjs `placeRemnant`; from the plan, `placeIncident` | yes, partly (case row kind "incident") |
| 2 | Key Remnant (a Key plan slot) | investigation.mjs `placeKeyRow` -> `placeInSlot` -> `createKeyRemnant`; case-realize.mjs `runRealization` | yes, partly (Key plan store) |
| 3 | Final Truth Remnant | the Final Truth form in the Map's overview and the Table (`caseFinalPanel`), placed at Save (`placeFinalFromDashboard` -> mastermind.mjs `placeFinalRemnant`) | no: the form places, nothing is kept unplaced |
| 4 | Autopsy Truth Bullet | gm-items.mjs `issueAutopsyDialog` -> truth-bullets.mjs `issueAutopsy`; from the plan, case-realize.mjs `sendPlannedAutopsy` | yes (case rows `autopsy`, `autopsy-<n>`) |
| 5 | Truth Bullet made by hand | gm-items.mjs `giveTruthBulletDialog`, Create tab (`bulletCreatePane`, `readBulletForm`) -> `giveBullet` -> truth-bullets.mjs `createTruthBullet` | no |
| 6 | Truth Bullet copied from a Remnant | gm-items.mjs `giveTruthBulletDialog`, Existing tab (`bulletExistingPane`) -> `createTruthBullet` | no (see "cannot be planned") |
| 7 | Key Truth Bullet by Monokuma's Reveal | trial-modes.mjs (the Reveal) -> `createTruthBullet`, from the Key slot's words | through the Key slot (row 2) |

Not a GM's kind, so not in the planner: an Autopsy Remnant (New Remnant leaves it out, `findableKind`: Observe has no
DC for it); a Remnant left by a student's action (remnants.mjs `dropRemnant`, at play); a Truth Bullet found by Observe
(observe.mjs `createFind`), analysed (analyze.mjs), handed over or taken from a body (handover.mjs). Their content comes
from the Remnants the GM planned, so planning a Remnant's words and analysis is how a GM plans those.

## 1. Planned Remnant (Incident, Prep, Neutral, Faint, Tamper)

| Field | Real road takes it (`openNewTrace`, `placeRemnant`) | Plan holds | Placing passes (`placeIncident`) | Gap |
| --- | --- | --- | --- | --- |
| Scene | `workingScene()` or `sceneId` | no (room name only) | no: New Remnant opens on the working scene | **plan the scene** |
| Room | `room` | yes (`room`) | yes (said when the scene lacks it) | - |
| Type | `type` | yes (`type`, 13.11) | yes | - |
| Who left it (author) | `author` -> `sourceActor`, `sourceName` | no | no | **plan it** |
| Band (difficulty with the type) | `vis` -> `visibility` | no | no (window default "evident") | **plan it** |
| Tied to the crime | `tied` (open, tied, not tied) | no: read from the type (Incident tied, the rest open) | yes, as read | **plan it** (the type's reading stays the default) |
| Reinforced | `reinforced` | no | no | **plan it** |
| Name | `tname` -> public name | yes (`label`) | yes | - |
| Words for the players | `ttext` -> `playerText` | yes (`text`) | yes | - |
| Analysis | `tanalysis` -> `analyzedText` | no | no | **plan it** |
| GM's note | `note` | no (`note` is kept on Autopsy rows only) | no | **plan it** |
| Image | not in New Remnant; the Table's `img` after placing | no | no | **plan it** (the Table's field, written after placing) |
| Spot | random in the room | - | - | cannot be planned: no road takes one |
| Chapter, day, time | the clock at placing | - | - | play time |
| Placing | the GM presses Place (New Remnant filled in) | - | - | default: unchanged, the GM still confirms in New Remnant |

## 2. Key Remnant (a Key plan slot)

| Field | Real road takes it (`placeKeyRow`, `placeInSlot`, `createKeyRemnant`) | Plan holds | Placing passes | Gap |
| --- | --- | --- | --- | --- |
| Scene | `workingScene()` | no (`sceneId` only once placed) | no | **plan the scene** |
| Room | the Place window's `room` | yes (`room`, 13.11) | Place: first choice; realization: the preview's first choice | - |
| Band (difficulty) | the Place window's `vis` | no | Place: asked, default "evident"; realization: **hard-coded "evident"** (`runRealization`) | **plan it** |
| Who left it | `row.author` -> `sourceActor` | no | no: Place never asks, realization never passes it | **plan it** |
| Scale (a label, not a DC) | `scale` | yes | yes | - |
| Name, words, analysis, GM's note | `name`, `text`, `analysis`, `note` | yes | yes | - |
| Type, tied, reinforced, Faint | fixed: key, tied, reinforced, not Faint | - | - | fixed by the kind |
| Image | the Table's `img` after placing | no | no | **plan it** |
| Spot, chapter, day, time | random in the room; the clock | - | - | as row 1 |

## 3. Final Truth Remnant

| Field | Real road takes it (`caseFinalPanel` -> `placeFinalRemnant`) | Plan holds | Placing passes | Gap |
| --- | --- | --- | --- | --- |
| Room and its scene | `finalRoom`, `data-scene` -> `scene` | no | - | **the whole kind**: a planned Final Truth row that keeps every field until it is placed |
| Band | `finalVis` | no | - | as above |
| Who left it | `finalAuthor` | no | - | as above |
| Name, words, analysis, GM's note | `finalName`, `finalText`, `finalAnalysis`, `finalNote` | no | - | as above |
| Type, tied, reinforced | fixed by the kind | - | - | - |

Today the form places at Save (and, since a8c5ee1, asks at a close with its room picked). Nothing can be written and
kept for later.

## 4. Autopsy Truth Bullet

| Field | Real road takes it (`issueAutopsyDialog`, `issueAutopsy`) | Plan holds | Sending passes (`sendPlannedAutopsy`) | Gap |
| --- | --- | --- | --- | --- |
| Name | `name` | yes (`label`) | yes | - |
| Words for the players | `playerText` | yes (`text`) | yes | - |
| GM's note | `gmNote` | yes (`note`) | yes | - |
| Who receives it | the ticked students, every living one by default | no: every living one | every living one | cannot be planned honestly in full: who is alive at the body is known only then. **Default: every living student, as now.** |
| When | the GM's press | yes (`atBody`, 13.11) | yes | - |
| Type, shown type, band, tied | fixed: autopsy, shows itself, obvious, tied | - | - | fixed by the kind |

## 5. Truth Bullet made by hand

| Field | Real road takes it (`bulletCreatePane`, `readBulletForm`, `bulletFromForm`) | Plan holds | Gap |
| --- | --- | --- | --- |
| Recipient | `recipient` | no | **the whole kind**: a planned Truth Bullet row with every field |
| Tell the player | `tell` | no | as above |
| Name | `name` | no | as above |
| Real type | `realType` | no | as above |
| Shown as | `shown` (auto, neutral, real) | no | as above |
| Band | `visibility` | no | as above |
| Faint | `faint` | no | as above |
| Tied to the crime | `tied` | no | as above |
| Words for the players | `playerText` | no | as above |
| Analysis | `analyzedText` | no | as above |
| GM's note | `gmNote` | no | as above |
| When it is given | the GM's press | - | **needs a default**: given by the GM from its node (the real window, filled in), as a planned Remnant is placed |

## 6, 7. Copies

- **6, a copy of a Remnant (the Existing tab):** it names a Remnant on the map. A planned Remnant has no token until it
  is placed, so a copy of it cannot be planned honestly before then; once placed, the Existing tab is the road, and its
  name and words come from the Remnant the GM planned (row 1).
- **7, Monokuma's Reveal:** it copies the Key slot's name, words and analysis and the placed Remnant's band and image.
  Planning the Key slot (row 2) plans it; nothing of its own.

## What cannot be planned, and why

- **A spot inside the room.** No GM road takes one: each scatters the token in the room's region.
- **The chapter, day and time a Remnant carries.** They are the clock's at placing.
- **Who receives a planned Autopsy, beyond "every living student".** Who is alive is known at the body.
- **A copy of a Remnant not yet placed.** It has no token to copy.
- **Anything a student's action, Observe, analysis or a hand-over makes.** Those are play, not plan; what they show is
  the planned Remnant's words, analysis and band.

## The gaps, in one list (step 2 builds each)

1. Planned Remnant (1): scene, author, band, tie (explicit), reinforced, analysis, GM's note, image; Place passes all.
2. Key slot (2): scene, band, author, image; Place and the realization pass them (no more hard-coded "evident").
3. Final Truth (3): a planned row of its own with room and scene, band, author, name, words, analysis, GM's note; placed
   from its node by the real road.
4. Truth Bullet by hand (5): a planned row of its own with every field of the Create tab; given from its node by the
   real window, filled in.
5. Everywhere: a planned item missing a field its real road requires is shown as incomplete on the Map, and placing asks
   for it instead of guessing. Plan rows stay in the GMs' stores (case schema, Key plan), never on a player's browser.
