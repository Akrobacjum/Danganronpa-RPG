# E56 inventory - code hygiene (read at 4dfac3a9 on the prep-54 work line, 12.11.2026)

Read-only. Nothing in the repository was edited; `git status --short` is empty after the run.
The finder scripts and their raw output are in `finders/` beside this file (the scripts as `.mjs.txt`, so lint does not
read them; run as `node <script> <repo> <out.json>` after renaming; they load acorn from `/opt/node-tools/node_modules`, not
from the repository). `out.json`, `keys.json` and `cm.json` are not committed: re-run to get them.

| Script | What it reads | Raw output |
| --- | --- | --- |
| `exports.mjs` | every `export` of `scripts/*.mjs` (not `tests*`), its readers, unused and doubled imports | `out.json`, `zero.txt`, `testonly.txt` |
| `keys.mjs` | every leaf key of `lang/en.json` against the strings of the code | `keys.json` |
| `comments.mjs` | backticked names in comments of `scripts/*.mjs`, line-number citations, doubled and orphan JSDoc | `cm.json`, `cm.txt`, `jsdoc.txt` |
| `counts.mjs` | own and re-exported names of the facades | (printed; section 5.4) |
| `dupes.mjs` | functions with identical bodies across files | (printed; section 2.4) |

The scripts parse with acorn (from `/opt/node-tools/node_modules`, not the repository). A "reader" in sections 1 and 3
is a token of code, never a comment: an identifier or property name, or a word inside a string or template literal
(so a name a harness scenario sends to a client as code text, or a tier-0 test reads by string, counts). Files
searched: `scripts/**/*.mjs` (tests included, reported apart), `tools/**/*.{mjs,json}`, `audit/**/*.{mjs,js,html,json}`
(`audit/harness/results`, `node_modules` and the gate's evidence left out), `macros/*.js`, `module.json`,
`eslint.config.mjs`. There is **no `templates/` directory** in this tree (`ls templates`: no such file), so no
`{{localize}}` reader exists; every window is built in JS.

What the method cannot see, and why each "dead" below was also grepped by hand: a name built at run time from pieces
(`M[name]`, `` `request${x}` ``), and a same-named identifier elsewhere (that one only makes a name look *alive*, so it
errs towards under-reporting dead code, never over).

Checks run: `node tools/check.mjs prose` green (527/527; the root working notes' "503/503 on 02.11" is a dated reading, not a
contradiction), `parity` green (en 5103 keys, pl 6114, missing 0, stray 0), `text` red here for an environment
reason only (`espree is not installed`, and `secondPersonToMany read nothing`), `names` not runnable (espree).
`node tools/registry.mjs --next`: R3917.

---

## 1. Dead exports and constants

### 1.1 The five the owner named

| Item | Where (4dfac3a9) | Readers found | Verdict |
| --- | --- | --- | --- |
| `consumeCall` | call-effects.mjs:516 (`export async function consumeCall(actor)`, a one-line wrapper of `consumeCalls`) | `grep -rnw consumeCall scripts tools audit module.json macros lang` -> 2 hits: its declaration and audit/findings-1.2.42/rolls.md:380 (a 1.2.42 audit note, prose). No caller, no re-export, not in `tools/api-surface.json`, not in api.mjs | **Dead.** Its JSDoc says it is "kept so a caller written before CALL-02 still spends every armed Call"; no such caller exists |
| `readiedItem` | use-items.mjs:168 | `grep -rnw readiedItem ...` -> 3 hits: the declaration, tests-tier2.mjs:70840 (`U.readiedItem(killer)`), audit/findings-1.2.42/items.md:369. Not used inside use-items.mjs (0 other identifier tokens) | **Test-only.** Removing it means rewriting that tier-2 assertion |
| `vaultRoomOwnedBy` | vault-store.mjs:853; re-exported by vault.mjs:30 | `grep -rnw vaultRoomOwnedBy ...` -> declaration, a comment at vault-store.mjs:837, the facade line, tests-tier2.mjs:60367 (`V.vaultRoomOwnedBy(owner, scene)`), audit findings prose | **Test-only, through the facade.** Not used inside vault-store.mjs |
| `MAX_EXTRA_ROLES` | tables-pools.mjs:648 (`export const MAX_EXTRA_ROLES = 1`); re-exported by tables.mjs:23 | `grep -rnw MAX_EXTRA_ROLES ...` -> 3 hits: the declaration, the facade line, a comment at tables-editor.mjs:1169 ("see MAX_EXTRA_ROLES"). No code reads it, tests included | **Dead** (facade re-export only). The rule it names is enforced in tables-editor.mjs by its own code, not by this constant - so the comment there points at a number nothing reads |
| `openMonocubDialog` | monocub.mjs:728 | api.mjs:158 imports it and api.mjs:1009 publishes it as `game.drpg.monocubDialog` (listed in tools/api-surface.json:288); tests: tests-kit.mjs:2068 (`STANDING` list, by string), tests-tier0.mjs:1776 (`MUST_BE_LIVE`, by string, R-test reading monocub.mjs's source), tests-tier0.mjs:19457 (R1192's `ANOTHER` row), tests-tier2.mjs:74282 (`M.openMonocubDialog()`) | **Not dead: a console API.** No button of the module opens it (grep for `drpg-window-monocubs`, `monocubDialog`, `openMonocub` outside api.mjs/monocub.mjs/tests: 0). The GM handbook still names "the Monocubs window" (docs/handbooks/gm-handbook.en.md:449). Removing it removes `game.drpg.monocubDialog` (api-surface.json change) and four test reads; it is the owner's call, not a hygiene fact |

### 1.2 The systematic pass - counts

4054 exported names in 191 non-test files of `scripts/` (declarations and `export { }` lists; re-exports counted
separately). Each was looked up in every other file:

| Class | Count | Meaning |
| --- | --- | --- |
| no reader anywhere, no re-export, not used in its own file | **7** | dead code (1.3) |
| re-exported by a facade, read nowhere else, not used in its own file | **2** | dead code kept only by a facade (1.3) |
| no reader outside its file, used inside it | **201** | the `export` keyword is dead, the code is not (1.5) |
| re-exported by a facade, read nowhere else, used inside its own file | **18** | as above, behind a facade (1.4) |
| read only inside string literals (scenarios' client code, tier-0 source reads, census rows) | **107** | 6 of them not used in their own file (1.3) |
| read only by `scripts/tests-*.mjs` (identifier reads) | **920** | 78 of them not used in their own file (1.6); 842 used in their file too |
| whose one non-test reader is api.mjs (`game.drpg.*`) | **125** | console API; 63 have no other use (1.7) |

### 1.3 Dead code (no runtime reader, not used in its own file)

Each grepped by hand with `grep -rnw <name> scripts tools audit module.json macros lang` (hits listed are all hits):

| Name | File:line | Hits besides the declaration | Note |
| --- | --- | --- | --- |
| `consumeCall` | call-effects.mjs:516 | none in code | 1.1 |
| `CASE_PROBLEMS` | case-schema.mjs:307 | its own JSDoc at :312 ("in CASE_PROBLEMS' order") | the codes are not read from it; `checkCase` names them inline |
| `unrecordMove` | eclipse.mjs:1173 | comments at eclipse.mjs:1101, :1179 and movement.mjs:3172 | the live road is `uncountCrossingInStep` (called from `crossTunnel`'s step); the three comments name the dead wrapper as the road |
| `gmStoreLegacyChanged` | gm-stores.mjs:1512 | none | wrapper of `handle.legacyChanged()` |
| `confirmLanguageReload` | i18n.mjs:155 | comments at settings-window.mjs:41 and settings.mjs:3686 | the reload is asked by settings-window.mjs's own `askReload` (:327), an identical body; both comments present the dead one as the asker (5.1) |
| `noteUpdatedAt` | pre-session-note.mjs:119 | none | |
| `zoneLog` | trial-zones.mjs:395 | none | |
| `atOwnVault` | stash-reach.mjs:59, re-exported vault.mjs:37 | its own JSDoc says "nothing in the module calls it (E52 C6)" | kept by the facade rule only |
| `MAX_EXTRA_ROLES` | tables-pools.mjs:648, re-exported tables.mjs:23 | comment tables-editor.mjs:1169 | 1.1 |

Read only inside strings, not used in their own file - **a test or scenario is the only caller**:

| Name | File:line | The string reader |
| --- | --- | --- |
| `requestTrialKeyword` | bridge-asks.mjs:260, re-exported gm-bridge.mjs:54 | scenario 68-trial-zones.mjs:186 (`B.requestTrialKeyword(...)` in client code) and a tier-0 census row (tests-tier0.mjs:9841). **No runtime asker found**: the bridge row for the Scrum thesis exists (bridge-table.mjs:1224) but no window calls this ask. Unproven whether E73's UI was meant to - flag, do not delete blind |
| `setDiscovery` | fog.mjs:1719 | scenarios 17, 60, 61, 66, 86 (client code `F.setDiscovery(...)`) |
| `bulletsWithoutAnswer` | gm-stores.mjs:2068 | only a tier-0 census row string (tests-tier0.mjs:8413, "out of scope: a GM's diagnostic") and comments (investigation.mjs:613, tests-tier2.mjs:25835). Nothing calls it, harness included |
| `lastMessage` | messenger.mjs:120 | tier-1 R1064's title and comments only; nothing calls it |
| `unreadCount` | messenger.mjs:219 | scenarios 13 (:882) and 87 (:114, :176, :199, :206) call it; no runtime caller (the badge reads `threadStats()` since E50 C2) |
| `fillObjection` | trial-floor.mjs:1108 | a tier-0 string only. The live road is `fillObjectionInStep`, reached through `floorStep`'s `fill` row (trial-floor.mjs:370) and trial.mjs's `evidenceOnPrimary` (import of `fillObjectionInStep`). Comments at config.mjs:3894, trial-floor.mjs:1027, trial.mjs:1174 and bridge-table.mjs:1144 still name `fillObjection` as where the minute starts (5.1) |

### 1.4 Facades: what a re-export means here

The facades (murder.mjs, vault.mjs, tables.mjs with no code; action-rolls, gm-bridge, gm-panel, hud, music, sfx,
vote, fog, projects, projects-ui, call-effects, season-setup, mastermind) re-export by `export { ... } from`. By
code.md's rule a facade "keeps its name and every name it exported ... and exports nothing new", and
`tools/moved-only.mjs` checks "a facade's exports unchanged" and "no name a file stops exporting still imported by a
file of scripts/ or audit/harness". So:

- moved-only is a check for **move commits**; E56 is not one, so moved-only's facade clause does not bind it, but
  code.md's facade rule ("keeps every name it exported") does, as written. Dropping `atOwnVault` or `MAX_EXTRA_ROLES`
  from vault.mjs / tables.mjs is a change to that rule's contract, and needs the owner's word (or a line in
  code.md saying a dead name may leave a facade).
- A facade re-export is counted here as **not a reader**: it reads nothing. The 20 names whose only reader is a
  facade line:
  - not used in their own file (dead): `atOwnVault`, `MAX_EXTRA_ROLES`;
  - used in their own file (export dead): action-briefing.mjs `moveLine`; action-pipeline.mjs `rollOfSender`;
    action-search.mjs `situationLine`; gm-campaign.mjs `correctsTheHour`; incident-store.mjs `deathsFor`,
    `receiveDeaths`; palm.mjs `PALM_PARTS`; projects-secrecy.mjs `revealChange`, `withoutLeak`; season-wipe.mjs
    `seasonResetRecord`, `unfinishedGroups`; sfx-play.mjs `SFX_FLAG`, `pickSound`; tables-pools.mjs `isTierPool`,
    `tierPoolOf`, `tierPoolForms`; vault-store.mjs `bedroomKeyKey`, `takeOldOwnersKeys`.
  (code.md names `PALM_PARTS`, `SFX_FLAG`, `pickSound`, `correctsTheHour`, `seasonResetRecord`, `unfinishedGroups`,
  `isTierPool`, `tierPoolOf` in its rows as part of each file's role - the rows would change with them.)

### 1.5 Export keyword only (201 names, used only inside their own file)

Full list: `zero.txt`. By file: settings-window 8, trial-zones-ui 8, call-gm 6, frisk 6, trial-floor 6, chapter 5,
passages-gm 5, projects 5, settings 5, voice-tile 5, case-map 4, enforced 4, fog-reveal 4, glass 4, gm-store 4,
investigation 4, trial-scene 4, zone-geometry 4, and 1-3 in 76 more files. Typical: the eleven `clearSeason*` /
`tallySeason*` functions (registered in a table in their own file), constants such as `BODY_ANNOUNCED_WAIT_MS`,
`TAKE_BACK_MS`, `JUDGE_WAIT_MS`. Dropping `export` changes nothing at run time; risk: a test that matches
`/export function X/` by regex would have shown X as a string reader, so none of these 201 is read that way
(they would not be in this class) - but the R290 crawls and moved-only's cut table read functions, not exports, so
they are untouched either way.

### 1.6 Reached only by tests (78 names: test reads, no runtime reader, not used in their own file)

Full list with readers: `testonly.txt`. These are mostly deliberate test seams (`forgetFriskAsks`, `syncIdle`,
`sheetAuditIdle`, `gmStoreHold`, `withGmStoreWorld`, `holdBodyTiles`, `standInSeam`, `standInLevelFailure`, ...) and
must stay. Candidates that look like leftovers rather than seams (a judgement, not measured): use-items.mjs
`readiedItem`, vault-store.mjs `vaultRoomOwnedBy` and `sharedRooms` (both behind vault.mjs), projects.mjs
`setProjectImage`, investigation.mjs `archiveKeyPlan`, settings.mjs `bodyAnnounced`, `chapterBodyFound`,
trial-modes.mjs `testimonyRefusal`, `panicRefusal`, vote.mjs `ballotInRound`.

### 1.7 Console API only (63 names whose one reader is api.mjs and nothing else uses)

e.g. `openMonocubDialog`, `openCleanupDialog`, `openStashHere`, `revealProject`, `presentBullet`, `openObjection`,
`openRebuttal`, `extendFloor`, `updateRule`, `removeRule`, the diagnostics (`diagnose`, `whyBlack`, `fogPeek`, ...).
Full list in the script output (`out.json`, filter "API-ONLY" as in section 1 of this file's method). These are
`game.drpg` surface (tools/api-surface.json is checked by the suite); not hygiene targets without the owner.

---

## 2. Duplicate helpers

### 2.1 `glassOn` (Stained Glass on?)

| Copy | File:line | Body | Readers |
| --- | --- | --- | --- |
| the shared one | motion.mjs:38 `export function glassOn()` | setting `theme === "stainedGlass"`, else body class | fog.mjs:70 (import), fog-reveal.mjs:45, diagnostics.mjs:15, chrome.mjs:35, remnant-ring.mjs:43 |
| a private copy | own-ring.mjs:110 `function glassOn()` | **identical** to motion.mjs's (dupes.mjs: same tokens, comments aside) | own-ring.mjs:133, 227, 237, 322, 421 |
| an alias | remnant-ring.mjs:68 `const glassOn = motionGlassOn;` (import renamed at :43) | - | remnant-ring.mjs:103, 644 |
| an alias | chrome.mjs:41 `const themeOn = glassOn;` | - | chrome.mjs:146 |
| a second reading | glass.mjs:3456 `function themeOn()` | setting only, **no body-class fallback** | glass.mjs 963, 1085, 1210, 1468, 3484, 4387, 4418 |
| a third | look.mjs:20 `export function isStainedGlass()` | setting only; identical body to glass.mjs's `themeOn` | look.mjs:38 (export has no reader outside look.mjs) |
| inline | body-class reads at diagnostics.mjs:1682, 1916; fog-doorways.mjs:1817; glass.mjs:330, 425, 671; hud.mjs:565; motion.mjs:350 | class only | - |

The AUDIT-1.2.42 row (`glassOn` x4) was merged once (`94fc972`, "Higiena A"); own-ring.mjs's copy and the two
setting-only readings remain. Note the readings differ on purpose in places (own-ring's comment: "the class lands at
ready and tokens are drawn before that"); glass.mjs's setting-only `themeOn` is the curtain's reading - merging it
into `glassOn` changes its answer mid-switch. Test reads: tier-0 R95 cuts motion.mjs at `"if (glassOn())"`;
tests-tier1.mjs:37006 cuts chrome.mjs at `"themeOn()"` - renaming chrome.mjs's alias breaks that test.

### 2.2 `cssColour` and `colourOf` (a stylesheet colour as a number)

| Helper | File:line | Reads | Parses | Memo / counters |
| --- | --- | --- | --- | --- |
| `cssColour(name, fallback)` | utils.mjs:1086 (exported) | `body` first, then `documentElement` | `parseCssColour` (hex 3/6, `rgb()/rgba()`), null-safe | memo, `forgetCssColours`, counters `utils.cssColour`, `.read` |
| `colourOf(name, fallback)` | fog-doorways.mjs:96 (exported; re-exported through fog-reveal.mjs:48 import and fog.mjs:76 import) | `documentElement` only | `foundry.utils.Color.from(raw).valueOf()`, **no NaN check** | none |
| `overlayColour(name, fallback)` | gm-overlay.mjs:70 (exported) | `documentElement` only | `Color.from(...).valueOf()`, no NaN check; its JSDoc says "fog-doorways.mjs `colourOf`'s reading" | none |
| `accentColour(fallback)` | fog-doorways.mjs:80 (private) | `body`, one token | its own `rgb()` parse, then `Color.from`, NaN-checked | none |
| `cssColour(name, fallback)` | fog.mjs:3518 (private, **same name as utils'**) | `documentElement` | returns the **string** (for a 2D context) | none |
| `lineColour()` | trial-zones-ui.mjs:458 (private) | `body`, `--drpg-bone` | hex only; an `rgb()` value falls to the fallback | none |
| `colourOf(type)` | remnant-ring.mjs:493 (private) | a type -> token, then utils `cssColour` | - | (a wrapper; fine) |
| `colourOf(user)` | dice-sync.mjs:581 (private) | a user's Dice So Nice colour | - | unrelated, same name |

The defect worth recording (read, not run): remnant-ring.mjs:496-502 and fog-doorways.mjs's own note above
`accentColour` both say `Color.from` returns NaN for an `rgb(...)` value; fog-doorways `colourOf` and gm-overlay
`overlayColour` call it without a NaN check. They read `--drpg-ink`, `--drpg-bone`, `--drpg-passage-*` - plain hex in
the stylesheet today, so no wrong colour is known; it holds only while those tokens stay hex. Readers of `colourOf`:
fog.mjs:2355, 3000, 3712, 4600; fog-reveal.mjs:774, 1370, 1441; fog-doorways.mjs:790, 1816. Of `overlayColour`:
gm-overlay.mjs and tests-tier1.mjs:22176. Merge risk: `cssColour` reads `body` first (the phase colour), the others
`documentElement` (the `:root` default) - utils.mjs:1060-1075 records that this order changed a measured colour
once. `utils.cssColour` calls are counted (perf-counters, scenario 86 holds those counts), so routing the fog
through it changes scenario 86's numbers.

### 2.3 Double imports

Same module imported in two statements of one file (6, all in `scripts/`):

| File | Lines | Module |
| --- | --- | --- |
| cleanup.mjs | 61 and 62-67 (multi-line) | ./config.mjs |
| i18n.mjs | 43 (`{ MODULE_ID }`) and 44 (`* as CONFIG_TABLES_SOURCE`) | ./config.mjs - a named and a namespace import; legitimate, could be one |
| module.mjs | 16 and 97 | ./settings.mjs |
| room-setup.mjs | 32 and 33 | ./search-tokens.mjs |
| season-setup.mjs | 57 and 69 | ./enforced.mjs |
| sheet.mjs | 47-51 (multi-line) and 56 | ./inventory.mjs |

(tests-kit.mjs imports `FIXTURES`, `DETECTORS`, `selfCheck` under aliases from three different modules - not
doubles.)

Static import **and** `import()` of the same module in one file: 151 file/module pairs, 129 outside tests (list in
the run output; e.g. sheet.mjs reaches 15 modules both ways, gm-panel.mjs 7, murder-rules.mjs 6, trial-floor-ui.mjs
5). A dynamic import of an already statically imported module loads nothing new; several are kept on purpose
(the code.md rows record `import()` used against static cycles, e.g. palm.mjs -> frisk.mjs, verdict.mjs ->
mastermind.mjs - those are not in this list, since they are not also static). Each pair needs reading; not judged
here.

Imported and never read (25; would be `no-unused-vars` findings - not measured with ESLint):
assignments.mjs `isMonokuma`; case-map.mjs `placeTileControls`; eclipse.mjs `FLAGS`; gm-stores.mjs `FLAGS`,
`whisperToGms`; patches.mjs `MODULE_ID`; popup.mjs `contentOf`; price.mjs `HOPE_REFUND`; roll-dialog.mjs `TRAITS`,
`TRAIT_BY_DH`; sheet.mjs `wearOf`; voice.mjs `allRooms`, `primaryGmId`, `plural`, `alreadyOpen`;
tests-tier0.mjs `PANEL_FAMILY`, `TABLES_FAMILY`; tests-tier1.mjs `expectedRed`, `VAULT_FAMILY`, `PANEL_FAMILY`,
`HUD_FAMILY`, `TABLES_FAMILY`; tests-tier2.mjs `expectedRed`; audit/forced-sweep.mjs `fs`; audit/harness/lib/livekit.mjs
`getProperty`. (`export { x }` of an import counted as a use: action-rolls.mjs `roomOfActor` is re-exported as
`currentRoom` and is not in this list.) Caveat: R161 and other tier-0 tests read import lines of some files; none of
these 25 names appears as a string in a test (`exports.mjs` words check), but import *lines* are read by regex in
places - run tier 0 after removing them.

### 2.4 Other near-duplicate small helpers (identical bodies, comments and whitespace aside)

From `dupes.mjs` (functions >= 25 normalised characters, same body in two or more files):

- `esc` re-declared locally 9 times (action-project.mjs:232 `esc1`, fog-diagnostics.mjs:691, passages-gm.mjs:2173,
  :2451, :2705 `escp`, passages-tab.mjs:53, projects-ui.mjs:1395, :1403, season-setup.mjs:1386) - one shape; and
  cleanup.mjs:788 and trial-progress.mjs:419 identical to utils.mjs:27 `esc` itself.
- `L = key => game.i18n.localize(key)` (and `t`, `localize`, `word`): 33 identical local copies (case-map,
  case-realize, case-trial, investigation x6, gm-campaign x2, projects-ui x4, trial-zones-ui x2, ...).
- `isPlain`: case-schema.mjs:52, gm-store.mjs:120, gm-stores.mjs:35, passages.mjs:29.
- `whisperToOwner` and `announce`: cleanup.mjs:93/95 identical to murder-rules.mjs:106/108 (utils.mjs:667 and :617
  have their own, different bodies).
- `liveKitClient`: trial-speakers.mjs:195, voice-client.mjs:349, voice-tile.mjs:1569.
- `mayModifySettings` gm-panel.mjs:386 = `mayModifyWorld` settings-window.mjs:119.
- `themeOn` glass.mjs:3456 = `isStainedGlass` look.mjs:20; `glassOn` own-ring.mjs:110 = motion.mjs:38 (2.1).
- `repaintAll` own-ring.mjs:181 = remnant-ring.mjs:506; `textNode` room-tile.mjs:456 = voice-tile.mjs:414;
  `setText` hud-elapsed.mjs:270 = `putText` voice-tile.mjs:1349; `bubbleTime` messenger-app.mjs:638 = `noticeTime`
  notice-history.mjs:1280; `named` verdict.mjs:146 = vote.mjs:1044; `refuseTheDead` stash-reach.mjs:147 =
  `deadHands` use-items.mjs:296; `timeOfDayMark` movement.mjs:1252 = `rifleMark` stash-reach.mjs:368;
  `remaining` character.mjs:271 = `roomLeft` price.mjs:81; `cellKey` fog.mjs:1116 = `fogKey` gm-stores.mjs:1430;
  floor keys (body-tile.mjs:41 `floorId`, frisk.mjs:109, passages-gm.mjs:2034 `floorKey`, movement.mjs:3445
  `levelKey`, stash-reach.mjs:680 `floor`).
- `confirmLanguageReload` i18n.mjs:155 and `askReload` settings-window.mjs:327: the same reload question twice; the
  first is dead (1.3).

Identical text is not always the same meaning (a key's format is part of a store's on-disk shape, e.g. `fogKey`);
each merge is a read, and a moved helper can be a cut R290 or moved-only's table reads by name.

---

## 3. Dead i18n keys

### 3.1 Method and counts

`keys.mjs`: every leaf key of lang/en.json (5103) against every `DRPG.*` / `DAGGERHEART.*` / `GAME.*` run inside a
string or template literal of the code (comments excluded). A plural key's `.one/.other/.few/.many` counts as read
when its base is (`plural()` appends the form, utils.mjs:492). A key is "prefix-built" when a string of the runtime
code is a proper prefix of it at a segment boundary (`` `DRPG.Bridge.why.${code}` `` covers `DRPG.Bridge.why.*`).
The bare fragment `"DRPG."` (events.mjs:695, a test of a word, not a key) is not counted as a prefix.

| Class | Keys |
| --- | --- |
| `GAME.*`, `DAGGERHEART.*` (overrides read by Foundry or the system, not by this module) | 95 |
| read literally by runtime code (`scripts/`, not `tests-*`) | 4206 |
| prefix-built only (unproven either way; 83 prefixes, largest: `Bridge.why.` 72, `Contract.instead.` 66, `Case.store.` 48, `Passage.why.` 31, `Season.group.` 30, `Fog.check.` 29) | 781 |
| read only by a test | 1 |
| read by tools/audit only | 0 |
| read by nothing | 20 |

`DRPG.Config.*`: en.json holds none (English is config.mjs itself); pl.json holds 527, and `check.mjs prose`
reports extra 0 - every Polish config string has its English field. pl-only keys besides Config: 484, all
`.few`/`.many` forms (parity: 0 missing, 0 stray, 242 plural families complete).

### 3.2 Proven dead at run time (27)

Each confirmed with `grep -rnaE "DRPG\.<key>([^A-Za-z0-9_]|$)" scripts tools audit macros module.json` (result:
0 hits, or only the hits named):

- read by nothing (20): `DRPG.Hud.bodyFound`, `DRPG.Hud.bodyFoundTooltip` (1 hit: audit/findings-1.2.42/text.md:173,
  prose), `DRPG.Action.analyzeGm`, `DRPG.Floor.startPanic`, `DRPG.Floor.startClosing`, `DRPG.Look.language`,
  `.title`, `.legend`, `.theme`, `.uiScale`, `.pixelFont`, `.pulse`, `.reducedMotion`, `.contrast`, `.ticker`,
  `.blur`, `.redraw` (1 hit: the 1.2.42 audit, which already listed it dead), `DRPG.Vault.concealed`,
  `DRPG.CaseMap.panelKind`, `DRPG.CaseMap.cycle`.
  - `Floor.start*`: trial-floor-ui.mjs (about line 1408, the comment above the `zones` button) says the rounds' starts left the footer at mockup B (E73) for the
    mode picker; the actions `startPanic`/`startClosing` still exist, their labels come from elsewhere.
  - `Look.*` (12 of the 20): the keys of a "Look" window; settings-window.mjs:42-43 refers to "as the Look window had
    them" in the past. The remaining `DRPG.Look.*` keys are read (look.mjs:39, 45; despair.mjs:1231, 1233). Whether the
    window was retired in E49 was not checked in history.
- read only by a test (1): `DRPG.Floor.startTestimony` - tests-tier0.mjs:19328 (a wording table reading en.json).
  Deleting it means editing that row.
- prefix-covered but closed (5): `DRPG.Murder.addThird`, `.whoWalkedIn`, `.nobodyElse`, `.noStressLeft`,
  `.betrayalConfirm`. The only builder of `DRPG.Murder.${key}` is murder-rules.mjs:600, whose `key` is one of two
  literals (`victimTrapSprung` and one other, murder-rules.mjs:598); each tail word has 0 hits in `scripts tools
  audit/harness`. All five were already listed dead in audit/findings-1.2.42/text.md:352-356 (1.2.42).
- (Also the other 1.2.42 dead keys: `DRPG.Sound.launcherTooltip` and `DRPG.Investigation.clue` - no longer in
  en.json; already gone.)

Each dead key has a Polish twin; delete both (parity holds the pair).

### 3.3 Unproven: prefix-built

781 keys are reached only through a prefix. A heuristic ran on them: the tail segment after the prefix appearing
anywhere in runtime code as an identifier or string word. 17 failed it; read by hand:

- live (built from a suffix or a transformed id, the heuristic's blind spot): `Price.nothingLeft.analyzeOneStep`,
  `.tamperSkippedAction` (price.mjs:164-167 `${key}OneStep`, `${key}SkippedAction`); `Monocub.critHelpNothingTarget`,
  `critHinderNothingTarget` (monocub.mjs:645 `${key}Target`); `Project.sealPassageSummary`, `closeBreachSummary`,
  `repairItemSummary` (action-project.mjs:358 `${presetKey}Summary`); `Frisk.gmKeptNow`, `gmIncidentNow`
  (frisk.mjs:1023); `Handbooks.callout.caution` (handbooks.mjs:151, `kind.toLowerCase()`);
  `Contract.instead.held-automation`, `held-dice-look` (patches.mjs:161 `held-${kebab(row.id)}` over ENFORCED rows
  `automation`, `diceLook`, enforced.mjs:670, 682).
- dead: the five `Murder.*` above.

The other 764 have a tail word present in the code; that makes them plausible, not proven. Proving each family needs
the builder's value set read by hand (e.g. `Bridge.why.<code>` against `REASONS`; R164 already holds that one).

### 3.4 LIMIT_GROUPS hints

`LIMIT_GROUPS` (config.mjs:933) has one group, `gear`, with `label`, `limit`, `maxStowed` - **no `hint` field**.
Its prose reaches pl.json through `CONFIG_TABLES` (i18n-config.mjs:26, added E14 part 2 C8). pl.json holds
`DRPG.Config.LIMIT_GROUPS.gear.label` only. The dead hints the stage names were removed already: tier-1 R975
(tests-tier1.mjs:27891-27896) asserts `DRPG.Config.LIMIT_GROUPS.gear.hint` and `DRPG.Config.CLEANUP.actions.eraseTrace.hint`
are empty ("a hint nothing reads is still carried"), and `check.mjs prose` finds 0 extra Polish config strings.
**Nothing left to do for LIMIT_GROUPS hints at 4dfac3a9**, unless the owner means something else by them.

---

## 4. `LONGEST_TILE_WORD`

- Where: sheet.mjs:1348, a module-level `const` computed by an IIFE when sheet.mjs is first imported: the longest
  space-separated word of the `label` of every row of `ACTIONS`, `HOPE_CALLS`, `DESPAIR_CALLS` and
  `MONOCUB.abilities` (config.mjs). Today it is "Contribution" (R1162 asserts it).
- Readers: one in code, `fitTileText` (sheet.mjs:1384, `probe.textContent = LONGEST_TILE_WORD`), which measures that
  word in the real tile and scales `--drpg-tile-text`. Tests: tier-0 R1162 (tests-tier0.mjs:19394-19433) cuts the
  source at `"const LONGEST_TILE_WORD = (() => {"` until `"})();"` and checks the four table names and the split;
  the registry row docs/dev/R-REGISTRY.md:660 quotes the name.
- Why eager is wrong in principle: the labels are read at import, before `localizeConfig()` (i18n.mjs:116, run from
  `applyModuleLanguage` at load) swaps config prose for the language file's in place. So the word measured is always
  the English one, whatever language the tiles show. Measured now: pl.json's labels for those four tables have the
  same longest word ("Contribution"; then "Announcement", "Experience") - Call and action names are kept English in
  Polish - so there is **no visible effect today**; it becomes one the day a Polish label outgrows its English one.
- Lazy means: compute the word on the first `fitTileText` call (after localisation) and keep it, or compute it per
  call from the labels as they stand; config tables are mutated once per page, so a once-per-page memo is enough,
  dropped if a language is applied later on the same page (scenario 50 applies a file on a live page).
- What breaks: R1162's cut anchors (`"const LONGEST_TILE_WORD = (() => {"`, `"})();"`) - the test must move with the
  code in the same commit; its English-and-Polish table check stays valid.

---

## 5. Comments that contradict the code

### 5.1 Names cited in comments that no code holds

`comments.mjs` extracted every backticked identifier of 4+ characters (`` `foo` `` or `` `foo()` ``) from comments
of the 191 non-test files and looked for it among every identifier, property and string word of all code, the
lang keys, the CSS, the audit HTML and module.json. **175 citations of 142 names** hold no such name; 43 of them sit
on a line worded as history ("until", "was", "used to", "removed", ...).

Classified by reading (the 132 not history-worded, plus the history-worded where the tense is present):

**A. Contradictions - the comment names, in the present, a function or field that is gone or renamed, or a dead one as the live road (22 sites in the rows below):**

| Site | Comment says | Code now |
| --- | --- | --- |
| action-pipeline.mjs:223 | "See `autoRollForSuite`." | no such function; the switch is `suiteRolling()` (:81) |
| config.mjs:101 | "The keys stay so `migrateIncidentSecrets` can lift a live offer" | the lift is `liftIncidentSecrets` (incident-store.mjs:24, :1156) |
| config.mjs:873 (EQUIPPABLE) | "it is what `bestWeaponTier` reads first" | `bestWeaponTier` is gone; murder-rules.mjs:1323 says "the old `bestWeaponTier`" |
| despair.mjs:1130 | "see `renderOverflowCaption`" | the function is `buildOverflowCaption` (despair.mjs:1069) |
| events.mjs:12 | "the same rule `buildIncident` in hud.mjs applied ... (see the note there)" | hud.mjs:385 says `buildIncident` "went with this function"; there is no note there |
| events.mjs:48 | "`motiveCard` here and `buildMotive` in hud.mjs" | `buildMotive` gone (hud.mjs:385) |
| events.mjs:136 | "see hud.mjs `buildIncident` for why not `game.user.character`" | gone |
| messenger-app.mjs:1060 | "The same split `ruleApproveMurder` draws." | the function is `ruleApproveMurderOrRefuseMurder` (:953) |
| music-play.mjs:476 | "shared with the GM-cue path (`startInterruption`, `adoptRunningInterruption`)" | no `startInterruption` anywhere; `adoptRunningInterruption` exists (:264) |
| states.mjs:28 | "Breakdown `stateAdvantage()` below, folded into the roll dialog's own advantage sum" | no `stateAdvantage` anywhere |
| glass.mjs:1985 | "run into the wall (`tailHug` below)" | no `tailHug`; the nearby flag is `railHug` (:1974) - unverified that it is the same thing |
| fog.mjs:4016 (`holdStill` JSDoc) | "(`heldBusy` on the node)" | the node's flag is `drpgHeldDrawing` (fog.mjs:4019-4024) |
| analyze.mjs:300 | "`typeHint` is the module's own line ... and it stays where it was" | no `typeHint` key, field or name anywhere |
| settings.mjs:3686 | "until the reload `confirmLanguageReload` offers" | that function has no caller (1.3); the reload is settings-window.mjs `askReload` |
| settings-window.mjs:41 | "as i18n.mjs `confirmLanguageReload` asks it" | same |
| eclipse.mjs:1101, movement.mjs:3172 | name `unrecordMove` as the road a failed crossing takes back | `unrecordMove` has no caller; `uncountCrossingInStep` is called |
| config.mjs:3894, trial-floor.mjs:1027, trial.mjs:1174, bridge-table.mjs:1144 | the minute starts at `fillObjection` | `fillObjection` has no caller; `fillObjectionInStep` does it (1.3) |
| tables-editor.mjs:1169 | "see MAX_EXTRA_ROLES" | a constant nothing reads (1.1) |

(The last four rows cite names that exist but are dead: the comment is not wrong about a name, it is wrong about the
road.)

**B. Probable stale names, need a reading (no hit anywhere, wording ambiguous):** gm-students.mjs:454 `anyCub` ("the
row above it made exactly this mistake with `anyCub` and says so" - no `anyCub` above); investigation.mjs:3141
`shownTraces`/`shownKeyPlan` ("snapshots of S1-m7 and E05 C5"); passages-gm.mjs:443 `PROJECT_KINDS` ("E68's
`PROJECT_KINDS`, which this table goes into" - not in the code); glass.mjs:3746 `byCentre` (an MK-R1 design name;
the function is `centreOrder`); secret.mjs:1017, :1030 `incidentVeil` (the call-site veil named by fix r1-G3; no
such name now); remnants.mjs:155, :188 `difficultyTag` (header says "IS GONE" - history, fine); cleanup.mjs:531
`attemptTransform`, cleanup.mjs:1631 and config.mjs:4136 `raisesVisibility` (both worded as removed - fine).

**C. Not contradictions (the large majority, ~110 sites):** names of Foundry, Daggerheart, Dice So Nice, LiveKit,
Isometric and browser internals, each cited with a version and file (`prepareBaseData` x7, `breakout()` x4,
`LiveKitClient` x3, `handleCustomSocket` x2, `_drawEffects`, `_preClose`, `sanitizeAppearance`, `orient2dFast`,
`AudioBufferSourceNode`, `name$1`, ...); lowercased spellings shown on purpose (`sceneid`, `killerid`,
`tierwanted`: "would come back as `tierwanted`"); and plain history ("lived here", "until 1.2.66", commit-pinned
readings like "a14db4e bridge-guards.mjs `guardRemnantEditReceipt`"). Full list: `cm.txt` (not history-worded) and
`cm.json` (all 175).

### 5.2 Line numbers in comments

Regex over comments of `scripts/` (`line N`, `LN`, `<file>.<ext>:N`): 64 citations. **None cites a line of this
module's own files**: 55 cite external sources with a version (Daggerheart `dualityRoll.mjs:146`, `actor.mjs:930`,
Foundry `dialog.mjs:273`, DSN `main.js:573`, avclient-livekit `client.mjs:121`, ...), 6 are audit ids (`L16`, `L17`,
`L18`, `L10`), 3 are not line numbers ("line 13px wide", "line 30px above", "review line 112"). Two need a word:
calls.mjs:597 "line 276 closes the window" refers to Foundry's dialog.mjs:273 block above it (external, fine);
roll-draw.mjs:32 `helpers/utils.mjs:805` is Daggerheart's.

**In the tests, stale line numbers of this module's files - 78 occurrences**, inside tier-0's census rows (the
reason strings of the PACKET/SOCKET/CHAT rows, tests-tier0.mjs ~8390-9280) and two in tests-lint.mjs/tests-text.mjs.
Sampled 9, **all 9 point at the wrong line now**:

| Cited | What the row is about | What that line holds at 4dfac3a9 |
| --- | --- | --- |
| vote.mjs:214-215 (rows 8625-8627) | `onBallotOpened` returns on a GM | line 214 is blank; `onBallotOpened` is at vote.mjs:153 |
| level-up.mjs:199 (8628-8629) | `receiveOffers` keeps the receiver's characters | a JSDoc line; `receiveOffers` is at :319 |
| gm-bridge.mjs:25 (9243-9247) | `guardSabotageRoom` | facade header prose; the guard lives in bridge-guards.mjs |
| eclipse.mjs:1089 (9264) | `onMovesSocket` | a JSDoc line about `to` |
| fog.mjs:886 (9266-9269) | `registerLedgerRoad` | a comment about named regions |
| mastermind.mjs:315 (9271-9273) | `registerMastermind` | a closing brace |
| sync.mjs:137 (8955, 9275) | `registerSync` | `discoveredRooms: SYNC.fog,` |
| movement.mjs:1084 (8948-8950) | `token.sendBack` | a closing brace |
| trial.mjs:778 (8683) | `presentedThisChapter` | a JSDoc line |

These rows are strings the census test reads as data (reasons), not assertions on the line; nothing fails, and
they mislead whoever follows them. tests-lint.mjs:40 (`movement.mjs:629`) is a historical example in a comment, fine.
Also the 1.2.42 audit files cite line numbers heavily; they are dated records, not code.

### 5.3 Doubled and orphan JSDoc

- **Two `/** */` blocks back to back before one declaration: 69**, of which 6 are a file header followed by the
  first declaration's doc (case-summary.mjs, case-view.mjs, fog-geometry.mjs, gm-overlay.mjs, i18n-config.mjs,
  style-snapshot.mjs - house style, not a defect). **63 are real candidates**: the first block documents something that
  is not the next declaration - mostly a function moved to another file by E34/E41 leaving its doc behind, or a
  one-line doc left above a newer full one. Clear cases (first block -> what follows):
  - despair.mjs:930 "Build or rebuild the Despair rows" -> `fitNameColumn`
  - gm-items.mjs:1409 "Remove one item the module knows about." -> `takeItemDialog`'s own doc
  - handbooks.mjs:89 "One handbook as HTML: fetched and converted once ..." -> `markdownToHtml`
  - investigation.mjs:2097 "The Key Remnants tab: the planner and its warnings." -> `tooThinLine`
  - monocub.mjs:707 "'Wastes an action' - unconditional ..." -> `wasteAction`'s own doc (two docs, one function)
  - overflow.mjs:1077 "The pane's HTML, for the Despair Flow window's Overflow tab" -> `overflowNowLine`
  - remnants.mjs:2130 "Set the sweep-related flags on one Remnant token." -> `tieTraceForItem`
  - chapter.mjs:76 "Kill a character." -> a second block "Mark somebody dead and say nothing" (where the first block's function now lives was not checked)
  - chapter.mjs:1924 "The GM's end-of-chapter panel." -> `clearChapterKeyRemnants`
  - gm-panel.mjs:686 "Announce (or end) the Final Trial" -> "Alive / dead / Monocub" -> `openFailureLog`
    (three blocks; the first two document functions now in mastermind.mjs and gm-students.mjs)
  - mastermind.mjs:404, :410 (three blocks before `toggleFinalTrialFlag`); handover.mjs:364 "Move an item from one
    character to another." -> `lootBody`; inventory.mjs:681 "Create a found item on the character." -> `OLD_TIER_THREE`;
    room-setup.mjs:56 "One screen for everything a room IS." -> a search-token helper; reroll.mjs:1150 "Take back a
    Search and run it again." -> `stashDieOf`; investigation.mjs:1544 "The Investigation at a glance" ->
    `confirmSweepBullets`; remnants.mjs:2456 "Table of every Remnant on the scene" -> `confirmClearFaint`;
    action-tamper.mjs:35, action-project.mjs:806, cleanup.mjs:349, :1877, :3572, events.mjs:134, gm-items.mjs:945,
    inventory.mjs:113, :877, season-setup.mjs:173, sheet.mjs:441, :946, :2601, :3941, :4918, use-items.mjs:83, :425,
    :796, utils.mjs:448, visibility.mjs:586, vote.mjs:288, sfx.mjs:664, settings.mjs:3010, :4218, player-status.mjs:284,
    overflow.mjs:284, truth-bullets.mjs:303, :577.
  - Some pairs are deliberate (a section essay above a function's own doc: season-wipe.mjs:577 "THE RESET'S OWN
    ENTRIES"; config.mjs's table notes at :61, :759, :877, :4159, :4252, :4513; enforced.mjs:71 a `@typedef` then
    `@type`; action-pipeline.mjs:89 and player-status.mjs:284 a description then a `@param` block for the same
    function). Full list with both first lines: `jsdoc.txt`. Each needs a reading, not a rule.
- **JSDoc followed by no declaration: 201**, of which 191 are file headers before the imports (house style) and 10
  stand before an `export { }` line, an assignment or a `Hooks.on` (action-rolls.mjs:77, clock.mjs:29, eclipse.mjs:40,
  ui-kit.mjs:455, critical.mjs:107, gm-store.mjs:1070, voice.mjs:274, and the three no-code facades' headers) - all
  read as intentional.

### 5.4 Counts in comments and in code.md, checked now

The module's own facade files carry no counts in their headers (grep for "N names" in each facade: none). The counts
live in code.md's table (the path-scoped code rules). Measured with `counts.mjs` (own exports / re-exports):

| code.md row | code.md says | 4dfac3a9 |
| --- | --- | --- |
| murder.mjs | 67 names at 1.2.69 (33 store, 31 rules, 3 window) | 69 (34, 32, 3) - dated "at 1.2.69", but the facade grew |
| fog.mjs | 53 of its own, 5 re-exported | 55, 5 |
| projects.mjs | 49, 16 | 54, 16 |
| projects-ui.mjs | 8, 2 | 18, 2 |
| call-effects.mjs | 33, 12 | 34, 12 |
| action-rolls.mjs | 2, 62 (24/13/9/4/3/2/2/2/1/1/1) | **matches** |
| gm-bridge.mjs | 3, 86 (72 asks, 10 call-gm, 1+1+1+1) | 3, 88 (74 asks) |
| vault.mjs | 73 (51, 13, 5, 4) | **matches** |
| gm-panel.mjs | 8, 4 | 13, 4 |
| hud.mjs | 11, 9; "1639 lines since E23" | 11, 9 match; 1648 lines |
| tables.mjs | 32 (28 pools, 4 editor) | 34 (29, 5) |
| tables-editor.mjs | "about 1670 lines" / "(1668)" | 1780 lines |
| vault-store.mjs | 53 exported, 51 re-exported; 1552 lines | 54, 51; 1573 lines |
| music.mjs / music-states / music-play / murder-music / sfx-play / hud-elapsed / call-gm / palm / season-wipe | as written | **match** |
| sfx.mjs | 7, 14 | 9, 14 |
| vote.mjs | 20, 20 (14, 6) | 21, 20 |
| action-pipeline.mjs | 31 exported, 24 re-exported | 32, 24 |
| action-search.mjs | 14, 13 | 15, 13 |
| action-project.mjs | 11, 9 | 12, 9 |
| tables-pools.mjs | 36, 28 | 37, 29 |
| trial-progress.mjs | 15, 14 | 20, 14 |
| verdict.mjs | 12 (6 vote, 2 mastermind) | 13 |

16 of 31 rows checked differ. code.md is a rules file, not a comment, but it is what the owner's "numbers in
comments" reaches in practice. Each wrong count is a number later stages added exports without updating; the house
fix is to either update with a date or drop the count. Facades exporting more names than at their split also means
"exports nothing new" was broken by later stages for murder.mjs (+2), gm-bridge.mjs (+2 asks) and tables.mjs (+2) -
read the commits before calling it a violation (a name added to a family file and re-exported may have been intended).

---

## 6. Lint

**Not run.** `audit/harness/node_modules` does not exist in this checkout (`ls audit/harness/node_modules`: absent),
and the instruction was to run ESLint only through it. (A global `/opt/node22/bin/eslint` exists; not used.)

What can be said without running it, from `eslint.config.mjs`: the configured rules are `no-undef` (error),
`no-import-assign` (error), `drpg/bridge-result` (error, scripts/ only) and `reportUnusedDisableDirectives: "error"`.
**No rule is at warning level**, so "lint without warnings" is already true by construction for this config, and
`run-all.mjs lint` counts every message as a problem. If E56 means "no unused variables or imports", that is a new
rule (`no-unused-vars`), and its first findings would include at least the 25 unused imports of section 2.3; its
full count is unmeasured.

---

## 7. Risks

1. **Tests read names by string.** Of the dead and test-only items, several are cut or named by tier-0 tests
   (`openMonocubDialog` x3, `LONGEST_TILE_WORD` in R1162, `fillObjection` and `bulletsWithoutAnswer` in census rows,
   `requestTrialKeyword` in a NOTDONE row, `"if (glassOn())"` cut in R95 and `"themeOn()"` at
   tests-tier1.mjs:37006). Removing or renaming any of them without the test in the same commit turns tier 0 red -
   or worse, a census row that names a gone function keeps passing while saying something false.
2. **Facades.** Removing a re-export (`atOwnVault`, `MAX_EXTRA_ROLES`, `vaultRoomOwnedBy`) contradicts code.md's
   "keeps every name it exported"; moved-only's facade clause would fail if E56 were ever run through it. Needs the
   owner's word or a code.md line.
3. **API surface.** `openMonocubDialog` and the 63 api-only names are `game.drpg` (tools/api-surface.json is checked).
   Out of hygiene scope without the owner.
4. **Bridge.** `requestTrialKeyword` has a bridge row and a scenario caller but no UI caller. Deleting the ask
   leaves a row R1b/R162-R166 and 33-bridge-paths still check; deleting the row is a trust-model change. Read E73's
   intent first.
5. **Colour helpers.** Routing fog-doorways `colourOf` / gm-overlay `overlayColour` through utils `cssColour`
   changes the element read first (`documentElement` -> `body`, i.e. the default -> the phase colour) and adds counted
   calls that scenario 86 holds; a visible change, not a pure merge. The NaN gap of `Color.from` is latent (all tokens
   read are hex now).
6. **glassOn merge.** glass.mjs `themeOn` and look.mjs `isStainedGlass` deliberately skip the body-class fallback;
   own-ring's copy is identical to motion.mjs's and is the safe one to merge (a static import of motion.mjs into
   own-ring.mjs must not close a cycle: R161).
7. **i18n deletions.** Prefix families (781 keys) cannot be cleaned by grep; only the 27 in 3.2 are proven. A key
   deleted from en.json must leave pl.json in the same commit (parity) and its `.few/.many` forms with it.
8. **Static-plus-dynamic imports (129 pairs).** Some `import()` calls exist to defer evaluation inside a cycle or a
   hook order; converting them to the static import can change load order (the code.md rows record one boot failure
   from a static cycle, E41 C9b). Read each; R161 catches static cycles only.
9. **Comment fixes are text but are read.** Several comments are cut by tests or read by `tools/check.mjs` parts
   (`notes`, `stamps`, `dashes`); a rewritten comment keeps `-` not em dashes and any stamp the checks hold.
10. **Measured here, not run there.** Nothing in this inventory was run in Foundry or the harness; lint was not run;
    `check.mjs names` and the `text` part's screen map need espree and were not run.
