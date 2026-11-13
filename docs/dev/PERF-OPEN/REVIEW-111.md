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

## 2. The e97-98 line (the planner)

Waiting: the line is still at cebe4c69 (read 13.11.2026 01:40 UTC); the review starts when it moves past it.
