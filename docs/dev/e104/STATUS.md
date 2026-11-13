# E104 status: the case planner plans every kind and every field

The owner, 13.11.2026: "Planer zagadki - niech pozwala przypisac od razu lokalizacje, trudnosc i wszystkie parametry
kazdemu zaplanowanemu remnantowi/bulletowi. Upewnijmy sie ze gm moze zaplanowac kazdy rodzaj i kazdy szczegol. Od
1.2.112." Target 1.2.112, R5330-R5379. The survey: docs/dev/e104/SURVEY.md.

## C1. A planned Remnant (Incident, Prep, Neutral, Faint, Tamper) holds every field New Remnant asks

- The Map's editor of a planned Remnant shows New Remnant's fields, in its order and its words: room (on its scene),
  type, who left it, visibility, the tie, reinforced, name, words, analysis, the GM's note; then the Table's picture.
  case-schema.mjs `caseNodeOf` (`incidentFields`): scene, author, vis, tie, reinforced, analysis, note, img.
- The room select carries its scene: the reader takes the picked option's `data-scene` (investigation.mjs
  `readSchemaForm`), so a plan names where its room is.
- **Difficulty** is the visibility with the type (the Observe DC, config.mjs `observeDc`). No separate field.
- **Place** (`placeIncident`) hands every field to New Remnant (`openNewTrace` takes them all now), and the picture is
  written after placing, as the Table writes it.
- **Incomplete:** a planned Remnant with no room `needs` a room (`graphOf`). The consistency check says so on the node
  and in the overview (`checkCase` "incomplete", one problem a field). Its Place starts New Remnant on
  "- pick a room -", which Create refuses, instead of the scene's first room.
- **Tie:** an Incident's tie reads "tied" where none is written, the other types' "open", as before.
- Tests: R5330 (tier 1: the fields, defaults, the graph's node and `needs`, the problem and its words); tier 2
  "planned Remnant holds every field: ..." (the editor's order, every field kept at the node's close, Place's New
  Remnant filled in, a roomless plan named on the Map and asked for its room). Both red at 246635d8.
- GM handbook EN/PL: one paragraph.

### Defaults taken, owner to confirm

- **D1. The editor is the planner's own rows, in New Remnant's order and words, not New Remnant's window itself.** The
  window places as it closes; the planner keeps a plan. Same fields, same labels, same order.
- **D2. The picture** is planned too (the Table's field), though New Remnant does not ask it; it is written after
  placing.
- **D3. Place still opens New Remnant** filled in from the plan, so the GM confirms before a token goes on the map.

## C2. A Key slot not yet placed plans its scene, visibility, author and picture

- The slot's status cell (on the Table, and in the slot's node on the Map) holds, beside its planned room, the
  visibility (the Place window's own field: how hard it is to find, with the Key column the Observe DC), who left it
  (New Remnant's field) and the picture (the Table's). The room select carries its scene. investigation.mjs
  `PLAN_FIELDS` scene, vis, author, img; `keyPlanExtras`; `readCaseFields`' Key rows (`roomScene`).
- **Place** (`placeKeyRow`) opens on the planned scene where it still holds the room (else the working scene, as
  before), starts its visibility on the planned one, and passes the author and the picture.
- **The realization** (case-realize.mjs `runRealization`) places each slot with its planned visibility, author and
  picture; until now every Key went "evident" and named nobody. The preview starts each room on its planned scene.
- **Incomplete:** a slot with no room `needs` a room (`graphOf`); the consistency check says so, and Place and the
  realization's preview ask for the room as before.
- Tests: R5331 (tier 1: the slot node's fields and `needs`, the problem); tier 2 "planned Key slot holds every field:
  ..." (the Table's fields kept at the window's close, Place's window, the realized Remnant's visibility, author, room,
  picture and scene; the slot and the case's marks put back). Both red at 01cdf687. R2067 reads the new field names.
- GM handbook EN/PL: two sentences in the realization paragraph.

### Defaults taken, owner to confirm

- **D4. A slot's planned visibility starts at Evident**, the Place window's own default.
- **D5. Every Key slot not placed and with no room is named "incomplete"**, five on a fresh chapter: the real roads
  cannot place a slot without a room.

## C3. A planned Final Truth

- A case row of its own, kind `final` (case-schema.mjs CASE_KINDS), added from the Map's tools (**Add planned Final
  Truth**). It holds the Final Truth form's fields in its order and words (`caseFinalPanel`: room on its scene,
  visibility, who left it, name, words, analysis, the GM's note) and the Table's picture. It is tied and reinforced by
  its kind, so neither is planned.
- On the Map a planned evidence node with the Final Truth's face; once placed, its Remnant's node, marked with the plan
  (`finalPlan`). The GM panel's waiting list names it beside the planned Remnants.
- **Place** (`placeIncident` -> `placePlannedFinal`) puts it on the map by the form's own road (mastermind.mjs
  `placeFinalRemnant`) with every field, then its picture; the row then points at the Remnant.
- **Incomplete:** with no room it `needs` one; Place asks in a window ("- pick a room -" first, Cancel places nothing).
- Tests: R5332 (tier 1: the kind, its id, the row read, the planned node and its face, `needs`, the placed alias); tier
  2 "planned Final Truth holds every field: ..." (the editor's order, the row after the close, the placed Remnant's
  fields, the link, the roomless question). Both red at 06d6393d. R3373 reads the new kind; R3661 the Map's five add
  buttons. Fixed on the way: a8c5ee1's Table test read the Final Truths through `remnantsOn`, whose refs have no
  `delete`; its clean-up would have thrown had it ever had one to remove.
- GM handbook EN/PL: one sentence.

### Defaults taken, owner to confirm

- **D6. Place puts a planned Final Truth on the map at once**, as the form's Save does, with no window of its own; a
  planned Remnant's Place opens New Remnant because that is its real road.
- **D7. Several planned Final Truths may stand in one chapter**, as the form may place more than one; the reminder
  "a Final Truth placed this chapter" is unchanged.

