# The harness against Foundry v14: calibration readings (E58 L1, step 3)

Read on 16.11.2026 on the owner's sandbox: Foundry 14.370 (Node build) at http://localhost:30099, world `drpg-qa-gate`
seeded with the harness's world (audit/live/seed-world.mjs), Daggerheart 2.12.9, Dice So Nice 6.4.5, Isometric
Perspective 14.0.6, LiveKit AVClient 0.6.8, this module 1.2.116 (the checkout, symlinked). Each reading came from a
probe: Playwright 1.56.1's Chromium 141, headless, one page per account (GM, PlayerOne, PlayerTwo, a scratch Assistant),
logged in through audit/live/foundry.mjs `seededLogin`, a script evaluated in the page. The probes are kept outside the
repository, as METHOD.md keeps its mutant runners; each row says what it did, so it can be done again by hand in a
console. Every scratch document a probe made (an actor, a token, a scene, a user) was deleted by it, and each change a
probe made to a seeded document was put back and read back.

For the cloud line C1, through the coordinator. Where v14 and the shim differ, "fixed" names the commit on
`claude/e58-local` that made the shim answer as v14 did (a red check first); "proposed" is a difference this line did
not build, because it changes what every scenario's hooks see (section 3).

## 1. The LIVE-E30 ids, E76-03 and H81-03

| Id | What was done on v14 | What v14 did | What the shim assumed | Verdict |
| --- | --- | --- | --- | --- |
| LIVE-E30-01 | a scratch actor and its token on the Annex, each with module flags; `update({"flags.danganronpa-rpg.-=calibA": null})` on each, then `{"flags.danganronpa-rpg.==calibD": {z: 9}}` on the actor | deleted on both; no `-=` key stored; `==` replaced the object whole (`{x, y}` became `{z: 9}`); each wrote v14's deprecation warning: "The {-=calibA: null} syntax for forced deletion of a data field value is no longer supported in favor of {calibA: new foundry.data.operators.ForcedDeletion()} / Deprecated since Version 14" (and the same for `==` with ForcedReplacement) | "ignored": nothing deleted, each key reported (the default since E30) | differs, **fixed**: the default reading is "honoured" (lib/operators.mjs); every key still reported; 91-old-keys-ignored keeps the other reading by name. Fields other than flags not read |
| LIVE-E76-03 | the same | honoured on flags of an actor and a token, 14.370 | the question, open | answered by the row above |
| E58 L1, 867653ee (ownership) | on an actor: `update({"ownership.<user>": ForcedDeletion})`, the same nested (`{ownership: {<user>: ForcedDeletion}}`), `ownership.-=<user>`; a ForcedReplacement of the whole `ownership`; a module flag deleted by the same ForcedDeletion, dotted and nested | the three deletions left the owner's entry as it was; the ForcedReplacement removed it; the flag went, both ways. Which paths each client's `updateActor` was handed was not written down | the entry deleted, every client's hook handed the deletion | differs, **fixed**: L1's `keepOwners` (lib/futil.mjs) takes a deletion under `ownership` out of the write; since the merge of d5907e1b on claude/shim-118 also the `-=<user>` spelling, and before the server's diff (cluster.mjs), so no hook is handed an `ownership` it did not change (00-boot, red first). Other documents' `ownership` not read; the hooks' changes for such a write not read. No module road deletes an owner (grep, 17.11.2026): they write `ownership.default` (anonymity.mjs, migrate.mjs, projects-map.mjs, remnants.mjs), one user's level (user-match.mjs `matchAccounts`) or a whole map on create (projects-map.mjs, remnants.mjs); projects.mjs's map is a countdown's, inside a world setting; the seeder (lib/seed.mjs) writes whole maps on create, the investigation dashboard none |
| LIVE-E30-02 | `foundry.data.operators` read in the page | its keys: DataFieldOperator, ForcedDeletion, ForcedReplacement, OPERATOR_IDENTIFIER (`"__$OPERATOR$__"`), OPERATOR_VALUE (`Symbol(DataFieldOperatorValue)`), reconstructOperator. Both classes have a constructor and a static `create`. `ForcedDeletion.create() !== ForcedDeletion.create()`. `_del` is a global instance of ForcedDeletion (not a function), `_replace` a global function of one argument. A ForcedReplacement has no `.replacement` and no `.value`: the value's own keys are copied onto the instance (`create({a: 1}).a === 1`) and the whole value is `instance[OPERATOR_VALUE]`. JSON: `{"__$OPERATOR$__":"ForcedDeletion"}`, `{"__$OPERATOR$__":"ForcedReplacement","value":{...}}` | `create()` one shared instance; `_del` a value; `_replace` a function; a replacement under `.replacement`; the wire form the harness's own (`__harnessOperator`) | `_del`, `_replace`: same. Shared instance: differs, **fixed** (a new instance each call). `.replacement`: differs, **fixed** (section 2): the shim's ForcedReplacement holds its value at `[OPERATOR_VALUE]` with its keys copied on, and `foundry.data.operators` names `OPERATOR_IDENTIFIER` and `OPERATOR_VALUE`. The wire form: differs, left - the module never sees it (lib/operators.mjs header) |
| LIVE-E30-03 | on the scratch actor, with `preUpdateActor` and `updateActor` hooks and the class's `_preUpdate` wrapped: `unsetFlag`, a `_del` write, a `_replace` write, a write of a value already there, a write a `preUpdateActor` hook emptied, one it refused (`false`) | `_preUpdate` ran before the `preUpdateActor` hook, every time. Both hooks got the operator instance (ForcedDeletion after `unsetFlag` and `_del`, ForcedReplacement after `_replace`), never a plain value or a missing key. The emptied and the refused update: not sent, no `updateActor`, `modifiedTime` unchanged. The write of a value already there: `preUpdateActor` ran, then nothing - not sent, no `updateActor` on any client, `update()` answered `undefined` | the order, the instances, the emptied and refused updates: as v14. "The server does not diff: an update that changes nothing is still broadcast and fires the update hooks" | order, instances, empty and refused: same. The no-op: differs, **proposed** (section 3, D3) |
| LIVE-E30-03 (more) | the same actor and a token, read on the GM and on p1 | an update with one key unchanged and one new: `updateActor` got only the new key, with `_stats.modifiedTime` and `_id`, on both clients. With `{diff: false}` a no-op was sent and the hook got `{_id}` alone. A token: a no-op on its name or a flag not sent (`undefined`); a mixed update's hook got only the changed key; an update naming a movement field (`x: 100` where it stood) was sent and its hook got `{_id}`. A world setting set to its own value: no write, no `updateSetting` | the whole update in every hook; settings diffed | settings: same. The rest: differs, **proposed** (D3) |
| LIVE-E30-04 | a scratch user "CALIB Assistant" (role 3, no password) made by the GM, logged in, then deleted | `isGM` true, `can("SETTINGS_MODIFY")` true. `game.user.update({role: 4})` from its console: refused by the server, "User CALIB Assistant lacks permission to update User [id]" as an error toast; its role stayed 3. A world setting of the module written and put back: passed. Its updates of PlayerThree to role 2, then 3, then a flag: each applied on the server (the GM's `updateUser` hooks read role 2, role 3, the flag, `lastModifiedBy` the Assistant) - while the Assistant's own copy of PlayerThree still read role 1 and no flag after each `update()` resolved. The GM's own role write read the same lag once (its copy read 3 after `update({role: 1})` resolved; a fresh GM read 1) | role 3 is a GM; no role above the writer's own; an Assistant may update any user; world settings from role 3 | the rules: same. The writer's copy of another User lagging behind its own resolved update (seen 3 times, on two accounts; an actor's never lagged): not modelled, not explained - **proposed** as a question (D8) |
| LIVE-E30-05 | a GM page listening on `userConnected`; PlayerOne's page closed; then the GM changed PlayerTwo's role 1 to 2 while PlayerTwo's page was open, and back | the hook came once, `(user, false)` - two arguments - with `user.active` already false inside it. The role change: PlayerTwo's page went from `/game` to `/join` within 5 s (logged out) | the same order and arguments; a role change logs nobody out | the hook: same. The log-out: differs, **proposed** (D6) |
| LIVE-E30-06 | - | not run here: 17-assistant needs a fifth account and page hooks the sandbox adapter lacks (sandbox-cluster.mjs gives gm, p1-p3) | - | not checkable at this sandbox through the adapter; the Assistant's two rules are read above |
| LIVE-E30-07 | - | not run: needs a copy of a world from before the traces' ledger (DRPG_FIXTURES), unset on purpose | - | not checkable here (no fixtures) |
| LIVE-E30-08 | the Data folder's manifests (`system.json`, each `module.json`) | the sandbox: Daggerheart 2.12.9, Dice So Nice 6.4.5, Isometric Perspective 14.0.6, LiveKit 0.6.8 | audit/harness/versions.json: 6.2.9, 14.0.2, 0.6.8 (audit S14-28) | the item asks for the table's installation (The Forge), which is not this; the sandbox's numbers recorded, versions.json not changed (a question for the coordinator) |
| LIVE-E30-09 | the console line of AUDIT 9.2 item 33, on the GM at 1366x768 | all seven sheets, in module.json's order (base, motion, danganronpa, stained-glass, pixel-icons, components, narrow), each an `@import` in layer `modules`, inside a `<style>`; the page's layer order `reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions`; `--drpg-window-max` 1400px | one inline sheet of `@import ... layer(modules)` in module.json's order; 1400px | same |
| LIVE-E30-10 | `game.drpg.runTests({ tier: 2 })` as GM, the window read, Enter pressed at once, the world's documents and settings compared before and after | a DialogV2: title "Tier 2 writes to DRPG QA Gate", its text naming "DRPG QA Gate (drpg-qa-gate)"; buttons Cancel (autofocus) then "Run tier 2 on DRPG QA Gate"; focus on Cancel; Enter answered `{refused: "cancelled", passed: 0, results: 0}`; nothing changed. Shot: docs/dev/e58/shots/e30-10-tier2-dialog.png | the window's configuration only (01-runtests B): world named, Cancel first and the only default, a cancel refuses | same, and now read on a drawn window |
| LIVE-H81-03 | a scratch token on the Annex moved by the GM four ways, the options read in `preUpdateToken` (GM) and `updateToken` (GM, p1) | the module's own placing write, `update(to, {teleport: true, movementAction: "displace", animate: false, <module key>})`: every option arrived in both hooks on both clients, the module's key with them, the waypoint's action `displace`. v14's own `move({x, y, action: "displace"})`: in `preUpdateToken` `teleport` and `movementAction` null; in `updateToken` on both clients `teleport: true`, `movementAction` null; the waypoint's action `displace`. A walk: `teleport: false` | the module's options pass through as plain options; `movementAction` read as v13's | the module's writes: as assumed. sheet-sidebar.mjs `onTunnelStep` reads `tunnelStepTarget` in `updateToken`, where v14's own displacement carries `teleport: true`, so its guard holds for a GM's API displacement. A GM's mouse drag and a region's teleport behaviour: not read |

### Read after the restart: `noHook` (AUDIT 9.2 item 20, LIVE-E16-04's part)

| What was done on v14 | What v14 did | What the shim assumes | Verdict |
| --- | --- | --- | --- |
| a scratch Gamemaster made beside the world's GM; it became the primary (`game.users.activeGM`), so the world's GM, not primary, opened Configure Ownership on Aiko through the real window, set "All Players" to Owner and saved | (a) `updateActor` reached the primary GM, with `options.noHook === true`, the change a ForcedReplacement of the whole ownership map; (b) `closeDocumentOwnershipConfig` fired on the window's GM; (c) `ownership.default` went back from 3 to 2 (OBSERVER) | `noHook` silences the `pre` hook and the `update` hooks (client-entry.mjs, lib/shim.mjs); one GM, the primary | (b), (c): as the module expects. (a): differs |
| a scratch actor updated by the GM with `{noHook: true}`; PlayerOne's own User flag updated by PlayerOne with `{noHook: true}`; hooks watched on the writer and the other browser | no `preUpdateActor` / `preUpdateUser` for either write; `updateActor` / `updateUser` on the writer and on the other browser, each with `options.noHook === true` | both hooks skipped | differs: on 14.370 `noHook` skips the `pre` hook only. Proposed (D9) |

### Read after the restart: startup

| What was done on v14 | What v14 did | What the shim assumed | Verdict |
| --- | --- | --- | --- |
| an init script on a fresh page recording, at `init`, `i18nInit`, `setup` and `ready`, `game.user`, `game.userId`, `game.users.size` and the socket - as PlayerOne and as the GM | `game.user` null at `init` and `i18nInit`, the User from `setup` on; `game.userId` set at all four; `game.users` empty at the first two, filled from `setup`; the socket connected at all four | the User from the snapshot before `init` | differs, **fixed**: `game.user` null through `init` and `i18nInit` (client-entry.mjs boot). `game.users` empty at those two: not modelled |
| `sessionFailures()` on a fresh GM and player | four registrations at `init` threw on `game.user.isGM` (LOCAL-REPORT step 3, defect 3) | - | a module defect the shim hid; fixed |

## 2. Found on the way: what the shim's plain Map hid

- **`game.collections` is a Collection on v14**: iterated it yields each world collection, and `entries()` the
  `[name, collection]` pairs (read on the GM and on p1: User, Folder, Actor, Item, Scene, Combat, JournalEntry, Macro,
  Playlist, RollTable, Cards, ChatMessage, Setting, FogExploration). The shim's was a plain `Map`, iterated as pairs. Two
  readers in the module's test kit destructured pairs: scripts/tests-kit.mjs `worldDump` threw "collection is not
  iterable" on 14.370 - and `runSuite` calls it before tier 2's first test (tests.mjs), so the local gate's tier 2 parts
  would have errored at once - and scripts/tests-tier2.mjs's restore snapshot (`documents`). **Fixed**: 00-boot's new
  check red on the Map ("values": false), the shim's `game.collections` a Collection, the same `TypeError` then read
  headless at tests-kit.mjs:2653, both readers on `entries()`, green.
- **A ForcedReplacement's value** (row E30-02): tests-tier2.mjs read `value.replacement` in one test ("a player's own
  dice look on an unlinked token of their character goes back to the character's ..."), which is `undefined` on v14.
  **Fixed**: 00-boot's check red on the shim (`["undefined", null, false, null, "null"]`: no OPERATOR_VALUE, no
  OPERATOR_IDENTIFIER, a `.replacement`, no keys on the instance), the shim as v14, the test then red headless as it
  would be on v14 (`written: [null, "ice"]` where `["ice", "ice"]` was expected), the test reading
  `value[OPERATOR_VALUE]`, green with its neighbour ("a dice look written with no hook ..."), 3 ran, 0 failed.
- **`Scene.create` with an invalid embedded id** (a Level `_id` of 15 characters) answered `undefined` and logged a
  `DataModelValidationError`; it did not throw.
- **A player's browser holds no scene it cannot observe**: a scene made with `ownership.default` 0 was absent from
  PlayerOne's `game.scenes`.
- **Daggerheart 2.12.9 still calls `_del()`** (build/daggerheart.js:9154, `#onUpdateEvolutionStateSelect`); `_del` is an
  object on v14, so that line throws. The system's, not this module's.
- **The module's own startup windows on a fresh GM browser**: "Daggerheart is newer than the verified version"
  (2.12.9 over 2.12.8; it says the module "found every place in the system that it changes or relies on"), and, before
  the runner gave the GM the seed's storage, "The case on this browser" ("1 Remnant on the map (of 1) has no answer key
  on this browser").
- **Chromium 141**: every page shows Foundry's error notification "Foundry Virtual Tabletop uses modern JavaScript
  features which are unsupported on Chromium version less than 146. You are using Chromium version 141." (Playwright
  1.56.1's build). It lands in `__notifications` as an error on every page the runner drives.

## 3. LIVE-E39-01: one real move, waypoints and Levels

### A move across three rooms with a waypoint

PlayerOne's page moved Aiko (Dorm A, 300,300) through v14's own `TokenDocument#move([{x: 1500, y: 400}, {x: 2300, y:
500}])`: Dorm A, the Cafeteria, the Hall. Read on the mover, the primary GM and a bystander (p2). Then the GM put her
back (`move({x: 300, y: 300, action: "displace"})`), and the move's spending (her free Move, one action) and its two
whispered cards were undone and read back.

| What | v14 did | The shim |
| --- | --- | --- |
| updates per route | **one**: `preMoveToken` and `preUpdateToken` once on the mover, `updateToken` and `moveToken` once on every client | one drag is one update: same |
| the options key | **`_movement`** (`options._movement[tokenId]`) in both hooks on every client; `options.movement` only in the mover's `preUpdateToken` (the request) | `options.movement[userId]`, set on the receiving client (client-entry.mjs) |
| the waypoints | `passed.waypoints`: all 20 grid steps of the route, each `{x, y, action: "walk", checkpoint, intermediate, level}` - grid steps `intermediate: true`, the asked waypoint (1500,400) `intermediate: false`, the end `checkpoint: true`; `pending.waypoints` empty; `method: "api"`; `state` completed by `updateToken` | `pending.waypoints` only where a test puts it (66 W); `passed`, `state`, `method` not modelled |
| `preUpdateToken`'s changes | every movement field filled in: `x, y, elevation, width, height, depth, shape, level` | as written |
| `updateToken`'s changes | `{x, y, _regions: ["REGHALL000000000"], _id}`; options also carry `_priorRegions` | as written; no `_regions` |
| `TokenDocument#movement` | 22 keys: id, subpathId, chain, origin, destination, passed, pending, history, split, constrained, recorded, method, constrainOptions, terrainOptions, measureOptions, autoRotate, showRuler, user, state, updateOptions, finished, animation | `_drpgMovement` from the options, or null |
| `MOVEMENT_FIELDS` | `x, y, elevation, width, height, depth, shape, level` | the same |

### Levels: a stair on a scratch scene

A scratch scene (ownership default 2) with two `Level` documents - Ground (elevation 0-10), Upper (10-20) - a region on
each floor over the same square, one region with no levels, and a token PlayerOne owns; PlayerOne moved it up in place
(`move({x: 300, y: 300, level: Upper})`), then along two waypoints down again. Everything deleted after.

| What | v14 did | The shim |
| --- | --- | --- |
| `Scene#levels` | an EmbeddedCollection of the `Level` document (Scene's embedded: AmbientLight, AmbientSound, Drawing, Note, Region, Level, Tile, Token, Wall); a level is `{_id, name, elevation: {bottom, top, base}, background, foreground, fog, textures, visibility, sort, flags}`; every scene, the seeded ones too, has `defaultLevel0000` (0-20) unless given levels; `initialLevel` | a LevelList of `{id, name, elevation}` |
| a token's level | the field `level`, a level's id (`"defaultLevel0000"` on a scene without levels drawn) | `level`, an id: same |
| `Region#levels` | a Set of level ids, empty on the seed's regions | a Set: same |
| `includedInLevel` | by id or by the Level document; an empty Set is every floor (Ground true/Upper false for the low room, the reverse for the high one, true/true for the one with none) | `!levels.size \|\| levels.has(l?.id ?? l)`: same |
| a region's own elevation | `{bottom: null, top: null, topInclusive: false}` | not read |
| the move up in place | `preUpdateToken` with every movement field and `level: Upper`; `updateToken` `{level, _regions: [the high room], _id}`; **elevation stayed 0** | not read |
| down along waypoints | one update; `passed` carried each step's `level` (Upper until the last waypoint, Ground at it) | not read |
| a region's owner | `Region` documents have `ownership` (`{default: 0}` on the seed's), `isOwner`, `testUserPermission`, `hasPlayerOwner` | no owner: any player may create, change or delete a region (cluster.mjs) |

## 4. Proposals (not built here: each changes what every scenario's hooks see)

- **D3, the update diff.** Model v14's client diff in client-entry.mjs / lib/shim.mjs: after the pre steps, diff what is
  left against the document's source; an empty diff is not sent and `update()` answers `undefined`, except a token
  update naming a movement field (sent, its hook `{_id}`); a sent update's hooks get the diff, with
  `_stats.modifiedTime` on a world document; `{diff: false}` sends as given. Red first in 00-boot; then every scenario
  run, since any test that writes a value already there and waits for its hook leans on the old model.
- **D4, movement.** `options._movement[tokenId]` (not `options.movement`) on every client; one update per route with
  `passed.waypoints` of every grid step; `_regions` in `updateToken`'s changes and `_priorRegions` in its options;
  `preMoveToken` / `moveToken`; every movement field in `preUpdateToken`'s changes. What the module reads -
  `TokenDocument#movement` (`pending`, `passed`, `state`) - exists on v14; what 66 W stands in with is `pending`, which
  an API route leaves empty. A drag by mouse (`method: "dragging"`, where `pending` may hold the rest of a route) was not
  read: a canvas drag through Playwright on this sandbox is the next reading.
- **D5, Levels.** `Scene#levels` as an embedded `Level` collection with `{bottom, top, base}` elevations and a
  `defaultLevel0000` on every scene; level changes leave elevation alone.
- **D6, a role change logs the user out** (their page to `/join`).
- **D7, a region's owner**: v14 Regions carry `ownership`; the shim's permission gate lets any player write any region.
  Whether a player's region write is refused on v14 was not tried here.
- **D8, the writer's copy of another User after its own update** (row E30-04): to be read again before anything is
  modelled.
- **D10, `userConnected` before ready.** On 14.370 a player's browser gets `userConnected(gm, true)` when the GM's
  socket connects, about 5.7 s before that GM's module sends `bridge.gmReady` (AUDIT 9.2 item 52); the harness fires the
  hook once the client is ready. The module's asks were answered either way here.
- **D9, `noHook`.** On 14.370 it skips the `pre` hook alone; the `update` hooks fire on every browser with
  `options.noHook` true. The shim skips both (client-entry.mjs, three sites, and `updateSetting`). 44 tier-2 tests and
  17-assistant name `noHook`, many of them staging a write no listener hears (dice-sync.mjs's "A WRITE NO HOOK HEARS",
  anonymity.mjs's "the harness takes the pessimistic reading"); on v14 such a write is heard. Changing the shim changes
  what those tests measure, so each would be read again: design-level, not built. Create and delete with `noHook`, and a
  setting's, not read.

## 5. What is not read

A mouse drag on the canvas, a region's teleport and change-level behaviours, walls and doors on a route, the senderId on
`system.daggerheart` and the relay guard's state (AUDIT 9.2 items 18-20) - left to step 4's groups.
