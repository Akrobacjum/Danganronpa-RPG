# Review for 1.2.111: two lines read adversarially

Read only; nothing pushed to either line. 13.11.2026. Each finding: where, a concrete failing path, a proposed patch.
Severity: **blocking** (wrong behaviour or a secret reaching a player), **minor** (a test or a check that could pass on
a fault, a cost), **note** (worth knowing, no change asked).

## 1. The project-token-icon line (1de23ada, 5f074c16 on 421f2395)

What it does: a project's token wears the picture of its chosen glyph (`projects-map.mjs` `projectTokenIcon`), written
by `tools/token-icons.mjs` from the tray's sprites; the sync moves a token wearing one of the module's own pictures to
its project's, and leaves a picture a GM put on it; a new `icons` part of `tools/check.mjs` holds the files to the tool.

Read: the diff of `scripts/projects-map.mjs`, `scripts/config.mjs`, `tools/token-icons.mjs`, `tools/check.mjs`, the
three tests (R4700 in tier 1, two in tier 2), and the roads to a token's picture (`placeProjectToken`,
`refreshProjectToken` through `syncOneProjectToken`, called by `applyProjectChange` and the scene draw's
`syncProjectTokens`; the glyph's writers `projectEditChange` and `createProject`).

### D2

No new road. The glyph is `projectMeta.<id>.glyph`, a world setting every browser holds (`projects-secrecy.mjs`
`metaFor`; E05 moved the killer's four fields and the saboteur out of it and kept the glyph), so the token's texture
tells a console what the setting already told it; a player who does not know a secret project still does not see its
token (`knowsProject` through visibility.mjs, unchanged). The branch states the trade-off where it is made
(`projects-map.mjs` header and `projectTokenIcon`'s comment) and in its STATUS, as the owner's choice B. What a player's
screen shows is unchanged; what a player's console can read is unchanged.

One road the comment does not name, **note**: every browser that draws the scene loads the token's texture, so the
glyph also reaches the network log (`icons/project-<key>.svg` requested). It is the same fact as the setting's, so no
change is asked; worth one clause in the comment beside "tells any console".

### Correctness

No blocking finding. A glyph change reaches the token: `projectEditChange` -> `applyProjectChange` -> `syncProjectToken`
-> `refreshProjectToken` (the tier-2 test drives `updateProject` and reads the picture after each change). A token
wearing a GM's own picture is left (`isModuleProjectIcon` is false for it). A project with no glyph keeps the hammer.
`isProjectGlyph` guards the key, so `projectTokenIcon` never builds a path from an unchecked string; the sabotage
repair's `glyph: "tamper"` (projects.mjs:1720) is a picture only if `tamper` is a key of PROJECT_GLYPHS, the hammer
otherwise.

**minor - a GM's own picture that happens to be one of the module's glyph files is taken back.**
`projects-map.mjs:253` `isModuleProjectIcon`. Path: a GM sets a project's token to `modules/danganronpa-rpg/icons/
project-lock.svg` by hand (the lock picture, wanted on a project whose glyph is the key); the next sync reads it as the
module's own picture and moves it to the key's. Unlikely and harmless (the GM's picture is the module's own drawing);
patch only if wanted: remember the picture the module last wrote on the token (a flag, `projectIconWritten`) and move
only a token whose picture equals it, the hammer or the hazard sign.

### Tests

R4700 (tier 1) measures: the planted stale picture first, then every glyph's file against its sprite, then the hammer
for a project with no glyph. The two tier-2 tests read the picture, the tint and the opacity after each step and assert
once on the whole reading; each `must` names what would make it measure nothing.

**minor - the tier-2 test puts a picture path that does not exist on a token.**
`scripts/tests-tier2.mjs:29450` `OWN = "worlds/stand-in/a-gm-s-own-barricade.png"`. Path: run on a real Foundry (the
local gate's tier 2), the token draws, Foundry asks the server for the file and logs a 404 and a texture warning on
every browser on the scene for as long as the test's token stands. The harness serves nothing and sees nothing. Patch:
use a picture Foundry ships, `icons/svg/mystery-man.svg`, which no glyph or hazard rule matches either.

**minor - the `icons` check has no control.** `tools/token-icons.mjs:139` `iconProblems` answers no problem when it
reads no file to compare (`files.size` 0: `SOURCES` emptied and `PROJECT_GLYPHS` read as empty, for instance from a
config.mjs that failed to import into a stub). A missing sprite throws, so the likely faults are seen; the empty set is
not. Patch: `if (!files.size) problems.push("no token picture to compare - the generator read no source");` before the
return.

## 2. The e97-98 line (the planner): c598d3cb, nine commits since cebe4c69

What it adds: a node's fields saved when its editing closes (91ec4059); no OBJECTION or Rebuttal in a node's modes; the
case map's columns 80 px apart; planned Remnants of the types Prep, Neutral, Faint and Tamper (resolution); a planned
room for a Key slot; a planned Autopsy sent at the body's discovery with no GM click; a node's planned minigame (a Straw
Poll's or Scrum Debate's question and answers, a Logic Dive's set); three captures and the Hall zones' field names.

Read: the diff of case-schema.mjs, case-realize.mjs, investigation.mjs (the autosave), gm-items.mjs, rooms.mjs,
utils.mjs, live.mjs, lang/en.json and lang/pl.json, the tests of tiers 0, 1 and 2; and, for every plan, the road by which
it could reach a player's browser. Read, not run: no harness run of this line here.

### D2: no road found by which a plan reaches a player early

| Plan | Where it is kept | How it reaches a player | Read at |
| --- | --- | --- | --- |
| a planned Remnant of any type, its room, words and name | a row of the GMs' case store (`caseRows`; `caseGraph` answers an empty graph on a player's browser) | only when a GM places it, as any Remnant (`placeIncident`, the trace's own secrecy from there) | case-schema.mjs `caseGraph`, investigation.mjs `placeIncident` |
| a Key slot's planned room | the GMs' `keyPlanStore` (`chapterRows`, GM only) | only when a GM places the slot (`placeInSlot`) | investigation.mjs:107, :198 |
| a planned minigame's question, answers, thesis, set | the same case rows; a dive set's truths in the GMs' `diveSetStore` | only when a GM starts the mode from the console (`startFromNode` fills the zones' window, nothing starts until Start) | case-schema.mjs `caseNodeOf` ZONE_FIELDS, the tier-2 test |
| the planned Autopsy's name, words and GM note | the case row `autopsy` | at the body's discovery, by `issueAutopsy` (the answer key and the GM's note stay the GMs'), on the primary GM | case-realize.mjs:227 |

The Autopsy's sender was checked against the discovery's writer: `sendPlannedAutopsy` runs only where the hook's
`writer` is true and only on the primary GM. Every discovery stamps on the primary: `discoverBody` refuses on another GM
(`discoveryHere`, chapter.mjs:957), and the witnesses' discovery runs from `updateToken` gated on `isPrimaryGm`
(murder-rules.mjs:3085). So the two gates agree and the Autopsy goes out once, from one browser. **note**: if a later
change lets a second GM stamp a discovery, the Autopsy would then go out from nobody (the primary hears `writer: false`,
the writer is not the primary); the gate could read `primaryGmId()` alone and drop `writer`, with the `sending` set and
`autopsyIssued` keeping it to once.

### Autosave

**minor - the open node's fields are read through a stand-in element that answers every selector with the node.**
investigation.mjs:2801 `readDashboardForm({ element: { querySelector: () => open } })`. `readDashboardForm` asks it for
`"form"` and then reads every field by name inside what it got: the Final Truth's fields, absent from a node, read as `""`
and `"evident"`, which `applyDashboardSave` ignores today only because it places a Final Truth when `finalRoom` is set
(investigation.mjs:3278). A field read later with no such guard - a new dashboard field whose empty value means "clear"
- would be written as empty by every node's close. Patch: give the reader the node and say so -
`readDashboardForm({ element: { querySelector: sel => (sel === "form" ? open : null) } }, { only: "node" })` - or split
the node's part out of `readDashboardForm` (`readSchemaForm`, `changed` on the trace and key fields) and call that here.

**minor, a question for the owner - Cancel keeps the node's text and drops the rest.** investigation.mjs:3272: a close by
a footer button that answers a string (Cancel) writes the open node's fields, as the X and Escape do, while the Table's
changed fields are dropped as before. A GM who presses Cancel to throw away what they typed gets the node's half kept.
The owner's words ("zapisywac sie po zamknieciu edycji") support saving on close; whether Cancel is a close or a
discard is the owner's to say. If a discard: `if (!action) await saveOpenNode(drawnRoot);`.

**note - a write that fails, and the node then closes.** `onClose` and `onPick` go on to `refresh()` after a failed
write (`.then` after the `catch` that answers null), and the toast says "Your text is still in the fields". That holds if
`keepLive` carries a field that is dirty again (`keepDrawn(field, was)`) across the redraw into the hidden editor of the
closed node; read in the code as likely, not run. A tier-2 case with the store's save made to throw would settle it.

**Two GMs editing one node**: each field is written only where the store still holds the value it was drawn from
(`applyDashboardSave` with `{ value, drawn }`), and a refused one is told; with the close's write `quiet`, a refusal is
still told (`parts.length && !quiet` covers the info line only; the refusals' own warnings stand). No loss found.

**Closing while a field floats** (with the float-text line merged): the node's text is read off the field, which floats
in place in the page, so the value is the same element's; Escape in a floating node field now reaches the case map's
own listener (float-text a63fe324, F1), so the node shuts and saves, as audit/float-sweep.mjs I4 reads on a model of
the graph's listener.

### Texts

The new keys have their Polish twins with `few` and `many` where counted. The curly quotes are the guide's own
(text-style.md: English in "...", Polish in „..."). **note**: `DRPG.CaseMap.autopsySent` (lang/en.json:5920) says "Sent to
the players." / "Wysłany graczom." beside `autopsyWhen` and `autopsyWentOut`, which say students; the glossary (DB24) makes
a student the character in effects, so "Sent to the students." / "Wysłany uczniom." would match the two beside it.

### Tests

No test that passes by measuring nothing. R4451, R4452 and R4453 (tier 1) compare explicit expected readings, each named
red at the commit before it. The five tier-2 tests each assert once on a whole reading after their waits
(`until(...).catch(() => {})` is followed by the assertion on what was read), with a `must` naming what would make it
measure nothing. **note**: the planned Autopsy's test asks `must(game.user.id === primaryGmId())`, a FAIL on a second
GM's run rather than a skip; the contract's rule 7 would make it a probe (`needs(env...)`) if a kit probe for "this
browser is the primary GM" exists or is added.
