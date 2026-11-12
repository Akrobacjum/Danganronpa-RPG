# E54 - File split, wave 3: the plan

Preparation only (the prep-54 work line, 12.11.2026). Nothing here changes code. Read at
`origin/main` = `4dfac3a93ef22144db14121d1fbbde82e4ef0988` (1.2.108, 12.11.2026). E54 is planned as
1.2.118 (`tools/stages.json`), after E61/E62, E92, E64, E93, E69, E74, E73 and E72, so every number here
has to be read again at the stage's base. Targets are named by file and function (or banner); line
numbers are 4dfac3a9's and only help to find the place. The recipe to re-measure everything is in the
appendix: two small scripts and the group tables they read.

## 1. The owner's words (translated) and what they ask for

"Clean moves with a facade - sheet.mjs (about 4500 lines) into a thin sheet.mjs (registration, sheetMode,
the step table) plus sheet-item, sheet-repaint, sheet-fit, sheet-header, sheet-sidebar, sheet-inventory,
sheet-actions; window geometry, tabs and footers from utils.mjs and settings.mjs into windows.mjs with
registerWindows() under safely(), a scale memo keyed 'scale|theme', windowWidthFor counting the frame once;
the Key rule into key-remnants.mjs, the reshape road into cleanup-reshape.mjs, remnants migrations into
migrate.mjs; chapter.mjs into death.mjs and body.mjs only above about 1300 lines; the curtain's pure
geometry into glass-geometry.mjs with explicit arguments. Done when: sheet, window geometry, the Key rule,
the reshape road and the curtain geometry have their own files, and one place decides a module window's
size."

The rules a move commit meets are the code rules' "Where the code lives" (`rules/code.md` in the agent rules directory; "code.md" below) and
`tools/moved-only.mjs`'s header: the old file stays a facade that re-exports every name it exported and
exports nothing new; a new file never imports its facade; the facade keeps only the code no new file
calls; `node tools/moved-only.mjs HEAD~1` green on every part (lines, statements, bindings, api, cuts,
jsdoc, imports); R161 holds the static import graph free of cycles.

## 2. What reading the code found, before any commit

Seven findings change the shape of the stage. Each was measured by the appendix's `split.mjs` (which
top-level names one group of lines reads from another) or by reading; none was run in a browser.

| # | Finding | Effect on the plan |
| --- | --- | --- |
| F1 | sheet.mjs is 5925 lines, not about 4500. `modeOf` (the render's mode, read back by a row builder) is called 26 times in sheet.mjs, as the default parameter of almost every step (`mode = modeOf(app)`), and `sheetMode`, `rowGate`, `headerGate` and `RENDER_MODES` are read by the code that moves. If they stay in sheet.mjs, every new file imports its facade - which moved-only's `api` part refuses. | The mode and its gates go into a leaf, **`sheet-mode.mjs`**, which sheet.mjs re-exports (`sheetMode` stays importable from sheet.mjs, as anonymity.mjs, explain.mjs, gm-students.mjs, hud.mjs, player-status.mjs, room-tile.mjs and use-items.mjs do today). This is one file more than the owner's list: Q-E54-1. |
| F2 | windows.mjs cannot import settings.mjs or utils.mjs once they are its facades. `scaleWindow` reads `sliderScale`, `layoutHeight` and `settingsRegistered` (settings.mjs); `guardTextFields`/`registerTextGuard` read `log` and `error` (utils.mjs). `windowWidthFor` and `eachPane` read nothing of either. Also utils.mjs imports settings.mjs, and settings.mjs's `applyTheme` and `rescaleSheets` call `scaleWindow`. | `windowWidthFor` and `eachPane` move as they are. The settings half moves only after a behaviour commit that hands `scaleWindow` its readers through **`registerWindows(readers)`**, called from module.mjs under `safely()` - which is also the owner's "registerWindows() under safely()". The text guard (a candidate for "footers") stays in utils.mjs unless the owner says otherwise: Q-E54-2. |
| F3 | The remnants migrations (remnants.mjs `migrateRemnants` .. `seedPublicIfMissing`, about 500 lines from the comment over `migrateRemnants`) read ten names of the remnants core: `REMNANT_FLAGS`, `setRemnantSecret`, `keyOf`, `traceLabel`, `isNeutralName`, `neutralTraceNames`, `traceTokensOn`, `oldTokenTie`, `defaultPublic`, `TINTS`. Moved into migrate.mjs, migrate.mjs would import remnants.mjs (its facade: refused by moved-only) while remnants.mjs re-exports from migrate.mjs (a static cycle: R161). migrate.mjs today reaches every domain by `import()`, never statically. | Not a pure move at this base. Default: leave the migrations in remnants.mjs and say so in the stage's end; the alternatives are in Q-E54-3. |
| F4 | "The Key rule" has two readers in the code: bedroom-keys.mjs (header "THE KEY RULE, ONCE", already its own file) and the Key Remnants of investigation.mjs (the plan, the fee, placing). key-remnants.mjs only fits the second. | Default: investigation.mjs's banner "THE PLAN" (`PLAN_FIELDS` .. `same`), `randomPointIn`, and the placing road (`createKeyRemnant`, `openKeyRemnantHere`, `placeInSlot`, `placeKeyRow`) into **key-remnants.mjs**, about 1230 lines; investigation.mjs keeps `openNewTrace` and the dashboard. Q-E54-4. |
| F5 | The reshape road in cleanup.mjs (`askTransform` .. `askTransformChange`, about 650 lines) reads four names of the rest of cleanup.mjs: `findRemnantToken`, the veiled `whisperToOwner` wrapper, and the clean-up receipt store (`RECEIPT_FIELDS`, `keepAttempt`, ... `recreationDataFor`), which the Reroll's undo also reads. | cleanup-reshape.mjs takes the road, `findRemnantToken`, the `whisperToOwner` wrapper (exported; cleanup.mjs imports it back) and the receipt store (the section "TAKING A CLEAN-UP BACK" from its head to `recreationDataFor`): about 780 lines, no import of the facade, no cycle. The receipt store's place is Q-E54-5. |
| F6 | The curtain's partitions (glass.mjs `stackShapes`, `curtainShapes`, `deskShapes`, `meetBands`, `windowShapes` and their helpers, about 1350 lines) are not pure: they write module state (`VOICE.box`, `ROT`, `OPEN_AREAS`, `CHECKS`, `LAST`) and read `PIN`, the rails' DOM (`columnRail`, `tileButtons`, `railBox` on `host`), `avLift()` and `narrowLayout()`. Only a small part is pure today: the convex-polygon helpers (`EPS` .. `touchesEdge`, `field`, the `PAD_*` constants, about 50 lines) and the affine and polygon math of the turn (`lerp`, `resample`, `centroid`, `meanOf`, `onBorder`, `fitAffine`, `matrixAt`, `invAffine`, `thenAffine`, `stretchOf`, `boxOf`, `bboxOf`). | Three steps: move the pure part; then behaviour-preserving commits that give the partitions explicit arguments and return values (proven by a byte-for-byte comparison of `cutBoxes` before and after, section 4); then move them. |
| F7 | Two of the owner's window items may already hold. (a) The memo: `scaleMemo` keys `${scale}@${height}`, not the theme, but the theme setting's `onChange` runs `applyTheme`, which deletes `drpgScaled` on every open window before calling `scaleWindow` - so a theme switch re-sizes today. (b) `windowWidthFor`: E31 removed the double-counted content border (R168); reading `fitKitWidth` (ui-kit.mjs) and `windowWidthFor` I could not find where a frame is counted twice. | Each gets a red-first test. If it is green at the base, the commit says so and the owner decides whether the change is still wanted (Q-E54-6). The height in the memo (E21 C5a) stays either way: the key would be `scale@height|theme`, not `scale|theme`. |

## 3. The groups, measured

`split.mjs` (appendix) on the group tables below, at 4dfac3a9. "Facade" is what the old file keeps.
"Reads" lists the names a group takes from another group; none takes anything from its facade, and there
is no cycle between the new files in any of these tables (the first sheet table had three - item <->
inventory, inventory <-> sidebar, repaint <-> actions - and was rearranged until it had none; the moves
that broke them are marked *).

### 3.1 sheet.mjs (5925 lines) - 8 new files

| File | Takes (banner or functions) | Lines | Reads from |
| --- | --- | --- | --- |
| sheet.mjs (facade) | header, imports, `SHEET_STEPS`, `runSheetSteps`, `onRenderCharacterSheet`, `registerSheetTweaks` | ~170 of code | every new file |
| sheet-mode.mjs (new, F1) | `sheetMode`, `RENDER_MODES`, `modeOf`, `rowGate`, `headerGate`, `sheetsFor`* | ~130 | - |
| sheet-item.mjs | "ITEM SHEETS" (`ITEM_TABS_CUT` .. `lockItemDescription`, `wearMarkup` among them), `dropTab`*, `classSafe`* and `bulletBadges`* | ~400 | - |
| sheet-repaint.mjs | "THE FLICKER" (`RESOURCE_PREFIX` .. `settle`: `renderPlan`, `RENDER_PLAN`, `installRenderPlan`, `repaintInPlace`, `refreshPricedTiles`, `refreshCallsPanels`, `refreshMonocubTiles`) | ~330 | mode, actions, header, sidebar |
| sheet-fit.mjs | `leaveLoadoutTab`, `tabScrolls`, `keepTabScroll`; "TILE FIT" (`SHY` .. `watchTileFit`, `LONGEST_TILE_WORD` among them); `grown`, `SHEET_MIN_HEIGHT`, `holdActionsTab`, `growForCalls` | ~390 | - |
| sheet-header.mjs | "TRAIT FRAMES", "ACTION BAR + TIME OF DAY", "STARTING RESOURCES", "ADVANCEMENT BUTTON", "WHO THIS IS", "GIVE / TAKE ITEMS", "ULTIMATE", "PUBLIC HELPERS" (`getUltimate`, `setUltimate`, `findDuplicateUltimates`) | ~810 | mode |
| sheet-sidebar.mjs | `hideSidebarSection`, `dropBiographyTab`, "SIDEBAR", "THE RESERVE ON THE SHEET" through `tidyBiography` (equipped tools, experience, known passages and the tunnel step, safeword, biography), but not `guardRow`* | ~1070 | mode, item, inventory |
| sheet-inventory.mjs | `tidyInventoryTab`, `CREATE_ACTIONS`, `removeSystemCreators`, `guardRow`*, "INVENTORY GROUPS" and "THE PACK" (to `addHandoverButton`), but not `classSafe`/`bulletBadges` | ~1150 | mode, item |
| sheet-actions.mjs | "THE KILLING GAME'S RULES", "ACTION PANEL", "WHETHER TAMPER HAS ANYTHING TO WORK ON" (to `costLabelFor`) | ~1380 | mode, fit (`softWrap`) |

Every new file is under E41's 1500 lines. Where the known passages and the biography go (sidebar) and
where the rules panel goes (actions) is a reading of the banners, not a measurement: the owner may place
them otherwise without changing anything else, as long as `split.mjs` still prints no cycle.

### 3.2 The other files

| Old file (lines) | New file | Takes | Lines | Facade keeps | Finding |
| --- | --- | --- | --- | --- | --- |
| utils.mjs (1421) | windows.mjs | `windowWidthFor`, `eachPane` | ~120 | the rest | F2 |
| settings.mjs (4332) | windows.mjs | `scaledBox`, `DAGGERHEART_SHEET`, `scaleMemo`, `sheetBox`, `SHEET_BELOW_BAND`, `sheetBandFoot`, `scaleWindow`, `rescaleSheets`, and the two `Hooks.on(..., scaleWindow)` lines (as `registerWindows`) | ~170 | `applyTheme`, `BREAKPOINTS` and the screen readers (code.md: the breakpoints live in settings.mjs and nowhere else) | F2, F7 |
| investigation.mjs (3239) | key-remnants.mjs | "THE PLAN" through `same`, `randomPointIn`, `createKeyRemnant` .. `placeKeyRow` | ~1230 | `openNewTrace`, "THE DASHBOARD" | F4 |
| cleanup.mjs (3665) | cleanup-reshape.mjs | `findRemnantToken`, the veiled `whisperToOwner`, `askTransform` .. `askTransformChange`, `RECEIPT_FIELDS` .. `recreationDataFor` | ~780 | the rest | F5 |
| chapter.mjs (2717) | death.mjs | "DEATH" (`livingStudents` .. `chooseFirst`), not the `export { isDeceased, ... }` line (a re-export of settings.mjs's predicates; it stays in chapter.mjs) | ~740 | "CHAPTER END AND THE NEXT SESSION" | 2717 > 1300: the split applies |
| chapter.mjs | body.mjs | "THE BODY IS FOUND" (`faintPrepCandidates` .. `openBodyDiscoveryDialog`) | ~930 | | body.mjs reads `publishDeath`, `chooseFirst` from death.mjs; the facade reads `bulletsHeldBy`, `keepBulletDeletions` from death.mjs |
| glass.mjs (4813) | glass-geometry.mjs | step 1: the pure helpers of F6 (~180 lines); step 3: the partitions once explicit (~1350 more) | ~1530 | the curtain's life, paint, turn and watchers | F6 |
| remnants.mjs (3372) | (migrate.mjs) | not moved by default | | | F3 |

body.mjs is a different file from the existing body-tile.mjs (E63's tile); the names do not collide.

## 4. The commits

Each commit is small, one kind (a test move, a behaviour change, or a pure move), and says how it is
proven. "QUICK" is METHOD.md section 3's quick gate. Every pure move runs
`node tools/moved-only.mjs HEAD~1` and pastes its last line; a red `cuts` is fixed by moving a different
range, never by editing the test it names.

### Step 0 - make the tests survive a move (no code moves)

| Id | What | Proof |
| --- | --- | --- |
| C0a | A family reader in tests-kit.mjs, as E41 C2b did for the bridge (`bridgeRead`/`bridgeFn`, R1238): `familySource(file)` and `familyFn(file, name)` read a facade and the files of its family (a table in tests-kit.mjs, one row per facade of this stage, empty lists to start), refuse when a name is declared in none or in two of them, and refuse when a file of the family is not served. | Red first: a planted fixture where a function moved to a family file and the old `fnSource(src("sheet.mjs"), ...)` silently returns "" - see risk R1. The reader is shown its planted faults (the stackShapes lesson). Next free R at the base (R3917 at 4dfac3a9). QUICK. |
| C0b | Point every test that reads the source of a file this stage splits at the family reader, one commit per old file (sheet, utils, settings, investigation, cleanup, chapter, glass). The tests that name each file at 4dfac3a9 are listed in section 6; at the base, `git grep -n '"sheet.mjs"' scripts/tests*.mjs` lists them again. | Tiers 0-1 green with the same counts before and after (a reader pointed wrong reads less, not nothing: compare the logged counts each test prints). |
| C0c | tools/text-map.mjs's SCREENS rows that name a unit of a file this stage splits (`scripts/sheet.mjs:buildOtherSection`, `scripts/cleanup.mjs:askTransform`, `askTransformChange`, `openMoveBodyDialog`, `scripts/chapter.mjs:openDeathDialog`, `openBodyDiscoveryDialog`, `promoteFaintPrep`, `scripts/investigation.mjs:placeKeyRow`, `confirmSweepBullets`, and the `:*` rows): `node tools/check.mjs text` fails when a row names no top-level unit of its file, so each row is updated in the move commit that moves its unit, not before. | Listed here so the move commits expect it. |

### Step 1 - sheet.mjs (8 commits)

Order: leaves first, so no commit leaves a new file that imports one not yet written.

| Id | Moves | Proof |
| --- | --- | --- |
| S1 | sheet-mode.mjs (F1) | moved-only; QUICK; R1455 (the gate matrix) and R1471 named in the message |
| S2 | sheet-item.mjs | moved-only; QUICK; the item-sheet tests (R591, R1440 at the base) |
| S3 | sheet-fit.mjs | moved-only; QUICK; R108 (`holdActionsTab`) |
| S4 | sheet-header.mjs | moved-only; QUICK; R3488 (the name row) |
| S5 | sheet-inventory.mjs | moved-only; QUICK |
| S6 | sheet-sidebar.mjs | moved-only; QUICK; R603, R607 (the passages) |
| S7 | sheet-actions.mjs | moved-only; QUICK; R1110, R1319 (`runCall`) |
| S8 | sheet-repaint.mjs, last because it reads actions, header and sidebar | moved-only; QUICK; R1475, R1476 (the render plan); scenario 86 (frame work) once, since the repaint is what it counts |

### Step 2 - windows.mjs (5 commits)

| Id | What | Kind | Proof |
| --- | --- | --- | --- |
| W1 | `windowWidthFor`, `eachPane` from utils.mjs | pure move | moved-only; QUICK; R168 (tier 1, the bordered box) |
| W2 | `registerWindows(readers)`: the two `Hooks.on("renderApplicationV2"/"renderApplication", scaleWindow)` lines at the end of settings.mjs become a function module.mjs calls under `safely("the windows' size", ...)`, before `registerSettings`; `scaleWindow` reads the slider, the layout height and "registered" through the readers it was handed (null before: it returns, as `settingsRegistered()` false does today). | behaviour | Red first: a test that the hook is registered once, by `registerWindows`, and that a throw inside it does not stop init. Scenario 01 and the fit sweep (`node audit/style-sweep.mjs --fit`) once, since the time the hook is registered moves from import to init. |
| W3 | The settings half (`scaledBox` .. `rescaleSheets`, `registerWindows`) into windows.mjs | pure move | moved-only; QUICK; R1356 (it imports `sheetBox` from settings.mjs: the facade keeps it); audit/style-harness.html imports `sheetBox` from settings.mjs - the re-export keeps it |
| W4 | The memo (F7a) | behaviour, if red | Red first: a theme switch that does not go through `applyTheme`'s loop - if none can be built, the test is the record that the memo is right, and the commit is dropped with the owner's word (Q-E54-6) |
| W5 | The frame counted once (F7b) | behaviour, if red | Red first, in Chromium: `node audit/style-sweep.mjs --fit` on a kit window whose widest table is known; headless jsdom lays nothing out, so R168's stand-in decides nothing about Foundry's own frame |
| W6 | "One place decides a module window's size" (the done line) | test | A tier-0 source test: outside windows.mjs, no `setPosition` with a `width` or `height` that windows.mjs did not compute. At 4dfac3a9 the callers are settings.mjs `scaleWindow`, sheet.mjs `holdActionsTab` and `growForCalls`, ui-kit.mjs `fitKitWidth` and the tab press (`height: "auto"` only), roll-dialog.mjs (`top` only). The sheet's two decide a height; whether they become windows.mjs functions (sheet-fit.mjs calling them) is Q-E54-7. |

### Step 3 - key-remnants.mjs, cleanup-reshape.mjs, death.mjs, body.mjs (4 commits)

| Id | Moves | Proof |
| --- | --- | --- |
| K1 | key-remnants.mjs (F4) | moved-only; QUICK; R172 (the GM stores' writes), R1324, R1329; scenario 62 (investigation, with the Key fee) once |
| P1 | cleanup-reshape.mjs (F5); `whisperToOwner` promoted and imported back by cleanup.mjs | moved-only (one promotion); QUICK; the bridge's crawl (R1b, R1238) reaches `ruleReshape` only through `import("./cleanup.mjs")`, which the facade keeps; scenario 83 is not needed (no roll road changes), say so; `node tools/check.mjs text` (the wrapper's id changes) |
| D1 | death.mjs | moved-only; QUICK; R151, R1252, R1259 |
| D2 | body.mjs | moved-only; QUICK; R110, R848; scenario 10 (murder) once |

### Step 4 - glass-geometry.mjs (3 to 6 commits)

| Id | What | Kind | Proof |
| --- | --- | --- | --- |
| G1 | The pure helpers of F6 | pure move | moved-only; QUICK; `node audit/glass-sweep.mjs` (METHOD: any change to glass.mjs) |
| G2..G4 | One partition at a time (`windowShapes`, then `stackShapes`, then `deskShapes`/`curtainShapes`/`meetBands` and the column and band cutters they call): its reads of `PIN`, `narrowLayout()`, the rails and `avLift()` become arguments, its writes to `VOICE.box`, `ROT`, `OPEN_AREAS` and `CHECKS` become its return value, and glass.mjs's two callers (`curtainGeometry`, `cutBoxes`) measure and write them as before | behaviour-preserving | A golden file made at the commit's parent and compared at the commit: `cutBoxes` over the glass sweep's 23 sizes x {desk, stacked} x 3 seeds x {no rail, the R3121/R3122 rail and band}, JSON byte for byte (`cutBoxes` runs headless - R545 and R1398 use it - so this needs no browser); then `node audit/glass-sweep.mjs` for the drawn self-check and a look at screenshots at three sizes, because "the numbers can be clean and the picture wrong" (code.md) |
| G5 | The partitions, now explicit, into glass-geometry.mjs | pure move | moved-only; QUICK; glass-sweep |

### Step 5 - close

| Id | What |
| --- | --- |
| E1 | code.md's table gets a row per new file (see Q-E54-8: work lines may not edit the agent rules directory). |
| E2 | The end review; `node tools/stages.mjs` row untouched (the release sets `version`). |

About 26 commits: 3 + 8 + 6 + 4 + 5 to 6 + 1.

## 5. Risks

| Id | Risk | What holds it |
| --- | --- | --- |
| R1 | A test that reads a function's source from the old file reads "" after the move and passes on nothing: e.g. tier 0 R591 asserts `!/objection/i.test(fnSource(src("sheet.mjs"), "addPresentButton"))`, which is true of an empty string. This is the root working notes' first failure ("a test can pass by measuring nothing"). | C0a's reader refuses a name it cannot find; C0b points every reader at it before anything moves. |
| R2 | moved-only `cuts`: a cut runs to the next function or `const X = {`; a range that ends where the next statement stays behind makes a cut a tier file reads by name grow or shrink. | Ranges end at a banner or a function boundary; the tool says which, and the range is changed, not the test. |
| R3 | A static cycle through an outside file (R161). The tables in section 3 hold none between new files; a new file imports only what its lines read, and moved-only's `imports` part refuses a module the family did not import at the base. | R161 in QUICK. |
| R4 | The registration of `scaleWindow` moves from import time to init (W2). A window rendered before init would no longer be scaled. None is known; the fit sweep reads every captured window. | W2's own test and the fit sweep. |
| R5 | F6's refactor changes how state is written. A cut that reads identically in `cutBoxes` could still differ on screen if `curtainGeometry` writes the returned state in another order. | The golden file covers `cutBoxes`; glass-sweep and screenshots cover the drawn page. |
| R6 | The stage's base is about ten stages later. Branches open today change these files (section 7); a group table read at 4dfac3a9 can be a few functions off. | Re-run the appendix at the base before C0b; the plan names functions, not lines. |
| R7 | jsdoc: settings.mjs `sheetBox` has its JSDoc above `scaleMemo` (two blocks over `scaleMemo`, none over `sheetBox`). moved-only lists a mismatch the base already had and goes red only on a new one. | Move them as they are; the fix is E56's (its inventory lists it). |
| R8 | The sheet's family is large (8 files): the harness boots more modules. | Boot time of `node run-tests.mjs --tier 1` compared before and after (200-212 s on 18.10 per the root working notes). |

## 6. Tests that name a file this stage splits (4dfac3a9)

A test listed here mentions the file's name as a string; most read its source, some only list it. Each is
read in C0b. "tierN/Rnnn" is the test's file and its R number (or the first words of an unnumbered row).

- sheet.mjs (39 mentions): tier0 R18, R48, R53, R79, R82, R98, R300, R591, R603, R909, R1038, R1101, R1110, R1162, R1319, R1440, R1470, R1476, R1549, the STORE settings.mjs#trialQueue row, the CRISIS_ACTIONS.label and INDIRECT_MURDER rows; tier1 R108, R121, R607, R614, R986, R1153, R1455, R1458, R1475, R3488; one in tier 2 (`standingEffects`).
- utils.mjs (27): tier0 R16, R51, R57, R70, R118, R161, R220, R319, R560, R846, R1127, R1254, R3510 (R51 reads `bodyOf(utils, "function windowWidthFor")` and R57 cuts `wirePortraitPickers` until `export function eachPane`: both change at W1); tier1 R121, R546, R1250, Palm; tests-text.mjs.
- settings.mjs (50): tier0 R52, R62, R63, R89, R102, R146, R194, R349, R356, R431, R479, R560, R1035, R1254, R3420, HOOK, STORE, WORLD rows; tier1 R107, R1150, R1198, R1355, R1367, R1516, R1552, R2074, R3142, R3508, R3530, R3915, Analyze.
- investigation.mjs: tier0 R32, R39, R56, R57, R91, R104, R118, R172, R309, R356, R376, R1254, R1324, R1329, R2035, R3510; tier1 R219, R307, R1337, R1358, R1360, R1404, R2087, R3372; tier2 E51-T15.
- cleanup.mjs (26): tier0 R36, R37, R40, R47, R92, R145, R220, R305, R306, R356, R431, R909, R1100, R1101, R1160, R2035, R3510; tier1 R121, R439, Analyze.
- chapter.mjs (43): tier0 R29, R56, R67, R113, R118, R151, R220, R356, R431, R436, R1035, R1252, R1254, R1259, R2035, R3145, R3400, R3404, R3510, STORE; tier1 R110, R307, R848, R1360.
- glass.mjs (27): tier0 R475, R509, R533, WORLD; tier1 R107, R112, R549, R988, R1355, R1377, R1378, R1379, R1400, R1412, R1441, R1601, R3482, R3506; two in tier 2. Also audit/glass-harness.html and audit/glass-sweep.mjs load glass.mjs (a new imported file is served from the same directory).
- remnants.mjs and migrate.mjs: not split by default (F3).

Outside the suite: tools/text-map.mjs (C0c); tools/check.mjs reads `scripts/settings.mjs` for R171's GM store keys (`gmStoreSettingsFromSource`, which reads `registerSettings`, not moved) and tools/text-audience.mjs resolves the message wrappers by file and name (`file:name`), so cleanup.mjs's veiled `whisperToOwner` becomes `cleanup-reshape.mjs:whisperToOwner` at P1: `node tools/check.mjs text` in P1's QUICK. (tools/check.mjs's other `scripts/utils.mjs` is a planted fixture.)

## 7. Open lines touching the same files (12.11.2026)

`git diff --numstat $(git merge-base origin/main B) B` for every remote work branch ahead of main (branch names below without their prefix).
All of these stages ship before E54 in `tools/stages.json`'s order, so they are not conflicts with E54's
commits but changes E54's tables must be re-read against.

| File | Branches (+added -removed) | Functions they change |
| --- | --- | --- |
| sheet.mjs | e72 +149 -22, e100 +38 -1, e93 +16 -1, e92 +13 -11, fervent-sagan-gme4vt +13 -11, e64 +2 -1 | e72: `runCall`, `abilityButton`, `callButton`, `injectMonocubPanel`, `injectKnownPassages`, `knownPassageRows`, `knownPassageItem`, `sheetMode`; e92: `sheetMode`; e100: `actionButton`, `injectMonocubPanel`; e93: `freeMovePip`, `pendingStack`; e64: `injectActionBar` |
| settings.mjs | e93 +109, e72 +58, e61-62 +26, fervent-sagan-gme4vt +26, e64 +14 -2, e92 +14 -1 | `SETTINGS`, `registerSettings`, the settings lists; none in the window code |
| utils.mjs | e64 +15, e72 +8 | `resolveThreshold`, `ownerOf`; not moved |
| investigation.mjs | e64 | `randomPointIn` (moves with K1), `openNewTrace`, the dashboard |
| cleanup.mjs | e64 +135 -31 | `attemptCleanup`, `cleanupVerdict`, `resolveCleanup`, `resolveStageSix`, `applyMoveBody`, `bodyDestinations`, `openMoveBodyDialog`, `undoLastCleanup`, `cleanupDc`, `freshSceneBonus`, `tamperPriceSkip` - none in the reshape road's range |
| chapter.mjs | e72 +29 -19, e64 / e64-inv +20 -7, e61-62 +2, gaps-a +1 -1 | e72: `checkBodyFound`, `tellLoneFinder`, `bodiesToDiscover`, `witnessesOf` (body.mjs); e64: `openChapterEndDialog`, `chapterEndForm` (facade) |
| glass.mjs | e92 +181 -10, e61-62 +124 -10, fervent-sagan-gme4vt +124 -10 | `turnPlan`, `glassTurn`, `boxOf`, `cutLook`, `layerBox`, `rebuildAll`: the turn, not the partitions; `boxOf` is in G1's range |
| remnants.mjs | e64, e64-inv +3 -2 | `handTiesOn` |
| migrate.mjs | e72 +30, e64 +8 -1 | new clauses |

## 8. Effort

About 26 commits. Measured costs to scale it by: tiers 0-1 take 200-244 s a run (the root working notes, METHOD.md),
moved-only 1-2 s, glass-sweep 194 s, one scenario a few minutes. A pure move commit with its QUICK is
about one tier-1 run plus reading moved-only's output; the C0 commits and G2-G4 are the expensive ones
(the readers have to be checked one by one; the golden comparison has to be written once). My estimate,
not a measurement: two to three working sessions for steps 0-3 and one to two for step 4, plus the end
review.

## 9. Open questions for the owner (each with the default the stage runs on)

| Id | Question | Default |
| --- | --- | --- |
| Q-E54-1 | sheetMode cannot stay in the thin sheet.mjs (F1). A ninth file, sheet-mode.mjs, re-exported by sheet.mjs? | Yes. |
| Q-E54-2 | Which "footers" move? utils.mjs's text guard (`guardTextFields`, `registerTextGuard`: Enter in a text field and the footer's submit) reads `log`/`error` and cannot move without them; the kit's footer is ui-kit.mjs `dressFooter`, outside both files. | Nothing of the footers moves; `eachPane` is the tabs' part. |
| Q-E54-3 | The remnants migrations cannot move into migrate.mjs as a pure move (F3). (a) Leave them; (b) a remnants family file `remnants-migrate.mjs` - still impossible without first moving the ten core names into a leaf of their own; (c) a behaviour commit that makes the migrations reach the core by `import()` and then move them. | (a). |
| Q-E54-4 | The Key rule is investigation.mjs's Key Remnants (plan, fee, placing)? | Yes (F4). |
| Q-E54-5 | The clean-up receipt store goes with the reshape road into cleanup-reshape.mjs (it is the only arrangement without an import of the facade), or into a file of its own? | With the reshape road. |
| Q-E54-6 | If W4 or W5's red-first test is green at the base, drop the commit? | Drop, and record the reading. |
| Q-E54-7 | The sheet's own height (`holdActionsTab`, `growForCalls`): computed in windows.mjs too, so the done line's "one place" holds for the sheet? | Yes: the height arithmetic as a windows.mjs function, the DOM wiring stays in sheet-fit.mjs (a behaviour commit after S3, with W6's test). |
| Q-E54-8 | code.md's table needs a row per new file, and the agent rules directory is closed to the work lines. Who writes the rows? | The coordinator or the owner, from the stage's end report. |

## Appendix A - re-measuring at the base

`split.mjs <file> <groups.json>`: groups are `[name, firstLine, lastLine]`, 1-based, everything else is the
facade. It strips comments, finds the top-level declarations, and prints the lines per group, which names
each group reads from each other group, any read of the facade by a new file, and any cycle between new
files. It is a reading of names, not of scope (a local variable named like a top-level one is counted),
so a reported edge is read by hand before it is believed; moved-only is the proof.

```js
import fs from "node:fs";
const [file, gfile] = process.argv.slice(2);
const src = fs.readFileSync(file, "utf8").split("\n");
const groups = JSON.parse(fs.readFileSync(gfile, "utf8"));
const groupOf = n => (groups.find(([, a, b]) => n >= a && n <= b)?.[0]) ?? "FACADE";
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const text = strip(src.join("\n")).split("\n");
const decl = new Map();
const declRe = /^(?:export )?(?:async )?(?:function\*?\s+(\w+)|(?:const|let|class)\s+(\w+))/;
const firstDecl = text.findIndex(l => declRe.test(l));
text.forEach((l, i) => {
  const m = l.match(declRe); if (m) decl.set(m[1] ?? m[2], groupOf(i + 1));
  const mm = l.match(/^(?:export )?let\s+(.*)$/);
  if (mm) for (const p of mm[1].split(",")) { const n = p.trim().match(/^(\w+)/); if (n) decl.set(n[1], groupOf(i + 1)); }
});
const edges = new Map(), lines = new Map();
text.forEach((l, i) => {
  if (i < firstDecl) return;
  const g = groupOf(i + 1); lines.set(g, (lines.get(g) ?? 0) + 1);
  for (const m of l.matchAll(/(?<![\w.$])([A-Za-z_]\w*)\b/g)) {
    const t = decl.get(m[1]); if (!t || t === g) continue;
    const k = g + " -> " + t; if (!edges.has(k)) edges.set(k, new Set()); edges.get(k).add(m[1]);
  }
});
console.log("lines per group:", Object.fromEntries(lines));
for (const [k, v] of [...edges].sort()) console.log(k, ":", [...v].join(", "));
const g2 = {}; for (const k of edges.keys()) { const [a, b] = k.split(" -> "); (g2[a] ??= new Set()).add(b); }
const bad = [...edges.keys()].filter(k => k.split(" -> ")[1] === "FACADE");
console.log("TARGET -> FACADE:", bad.length ? bad.map(k => k + " [" + [...edges.get(k)].join(",") + "]").join("; ") : "none");
const cyc = [];
const dfs = (n, path) => { for (const m of g2[n] ?? []) { if (m === "FACADE") continue;
  if (path.includes(m)) { cyc.push([...path.slice(path.indexOf(m)), m].join(" -> ")); continue; }
  if (path.length < 8) dfs(m, [...path, m]); } };
for (const n of Object.keys(g2).filter(n => n !== "FACADE")) dfs(n, [n]);
console.log("cycles between targets:", cyc.length ? [...new Set(cyc)].join("; ") : "none");
```

The group tables at 4dfac3a9 (line ranges; re-find each by its first and last function at the base):

```text
sheet.mjs:         [["sheet-mode",109,219],["sheet-sidebar",220,238],["sheet-inventory",239,244],["sheet-item",245,262],
                    ["sheet-item",337,646],["sheet-repaint",647,782],["sheet-mode",783,798],["sheet-repaint",799,992],
                    ["sheet-fit",1085,1155],["sheet-inventory",1156,1185],["sheet-fit",1186,1434],["sheet-header",1435,2193],
                    ["sheet-sidebar",2194,2636],["sheet-inventory",2637,2652],["sheet-sidebar",2653,3257],
                    ["sheet-inventory",3258,3973],["sheet-item",3974,4048],["sheet-inventory",4049,4425],
                    ["sheet-actions",4426,5803],["sheet-header",5804,5854],["sheet-fit",5855,5925]]
investigation.mjs: [["key-remnants",55,1009],["key-remnants",1203,1478]]
cleanup.mjs:       [["cleanup-reshape",480,485],["cleanup-reshape",699,1354],["cleanup-reshape",2650,2767]]  (+ the wrapper at 92-93)
chapter.mjs:       [["death",57,804],["body",805,1736]]   (the export { isDeceased, ... } line at 63 stays)
remnants.mjs:      [["remnants-migrate",2660,3163]]       -> reads 10 names of the facade (F3)
settings.mjs:      [["windows",4195,4319],["windows",4004,4019]]  -> reads layoutHeight, settingsRegistered, sliderScale (F2)
utils.mjs:         [["windows",1143,1222],["windows",1380,1414]]  -> reads nothing; with the text guard (942-1140) -> log, error
glass.mjs:         [["glass-geometry",1588,1638],["glass-geometry",3629,3653],["glass-geometry",3715,3809],["glass-geometry",592,602]]
                   (3715-3809 also holds the turn's timing constants and FLASH: keep those in glass.mjs)
```

`readers.mjs <file.mjs>` (run from the repository's root) lists each line of scripts/tests*.mjs that
names the file, with the test it sits in:

```js
import fs from "node:fs";
const target = process.argv[2];
for (const f of fs.readdirSync("scripts").filter(f => /^tests.*\.mjs$/.test(f))) {
  const lines = fs.readFileSync("scripts/" + f, "utf8").split("\n");
  lines.forEach((l, i) => {
    if (!(l.includes(`"${target}"`) || l.includes(`'${target}'`) || l.includes(`scripts/${target}`))) return;
    let name = "?";
    for (let j = i; j >= 0 && j > i - 400; j--) { const m = lines[j].match(/^\s*\[\s*"((?:R\d+[a-z]?|[A-Z][^"]{0,60}))/); if (m) { name = m[1].slice(0, 70); break; } }
    console.log(`${f}:${i + 1}\t${name}`);
  });
}
```
