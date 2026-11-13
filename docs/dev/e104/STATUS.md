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
