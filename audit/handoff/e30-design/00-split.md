E30 / S17-02 + S14-25: SPLITTING scripts/tests.mjs INTO FLAT FILES
Measured read-only on the e03v copy at 411d4da. The repo copy was not edited. Prototype and tools live in <scratch>/e30split/.

## 0. What was measured at 411d4da
- **Size.** tests.mjs is 15,002 lines and 852,882 bytes. The brief's 13,769 is bd16716 from 22.09.
- **Top level.** 58 statements: 13 imports and 45 declarations. No top-level side effects. The only module bindings ever assigned are `sourceCache` (inside `moduleSources`) and `inFlight` (inside the runner). No shared container is mutated.
- **The three lists:**
  - REGRESSIONS: 117 entries, lines 553-5251.
  - INVARIANTS: 93 entries, lines 5279-8212.
  - SCENARIOS: 97 entries, lines 8602-14783.
  - Every entry is a `[Literal, arrow]` pair. No name repeats; R21 is the only reused number.
- **Headless baseline.** Taken from the val-e03f log, which booted e03v three minutes after 411d4da was committed: 292 passed, 0 failed, 16 skipped, 308 result lines.
  - Tier 0: 116 ok, 1 skip.
  - Tier 1: 86 ok (including the "tier 0/1 changed nothing" line), 8 skip.
  - Tier 2: 90 ok, 7 skip.
  - The suite text is 22,930 characters; 01-runtests.mjs keeps only the first 30,000.
- **Reference map.** Exact, from espree and eslint-scope out of the container's global eslint 10.1.0 (/opt/node22/lib/node_modules/eslint). Script: e30split/scope.cjs.

## 1. Target layout
All five files sit flat in scripts/. Old line ranges move verbatim, and the old import block (38-54) is replaced by the per-file imports below. Each file ends with one `export { ... }` line, so every declaration stays byte-identical.

**tests.mjs - the runner, and the only file anything outside the suite imports**
- Lines 1-36: the header, verbatim, plus one new paragraph ("FIVE FILES (E30, audit S17-02)...") naming the four files and why they are flat.
- Imports:
  - `{ log, warn }` from `"./utils.mjs"`
  - `{ studentActors }` from `"./monokuma.mjs"`
  - `{ Failure, Skipped, layoutAvailable, settle, worldFingerprint, watchWrites, fingerprintDiff }` from `"./tests-kit.mjs"`
  - `{ REGRESSIONS }` from `"./tests-tier0.mjs"`
  - `{ INVARIANTS }` from `"./tests-tier1.mjs"`
  - `{ SCENARIOS, snapshot, restore }` from `"./tests-tier2.mjs"`
- Lines 14785-15002, verbatim: the RUNNER header, `inFlight` (14813), `runTests` (14815-14851, both JSDoc blocks) and `runSuite` (14853-15002).
- Exports only `runTests({ tier = 2, only = null })`.

**tests-kit.mjs - the shared tools; writes nothing to the world and imports no test file**
- Imports: `{ MODULE_ID, FLAGS }` from `"./config.mjs"`, `{ studentActors }` from `"./monokuma.mjs"`.
- Lines 56-206, the HARNESS block:
  - `Failure` 60, the "A THIRD ANSWER" comment 62-85, `Skipped` 86, `ok` 88-90, `needs` 92-101
  - the environment comment 103-112, `layoutAvailable` 114-120, `cascadeAvailable` 122-136, `LIVE_PROBE` 138-148, `glassTheme` 150-151, `canvasAvailable` 153-154, `systemSheetsAvailable` 156-161, `dialogsDrawn` 163-168
  - `equal` 170-174, `wait` 176, `settle` 178-179, `until` 181-205
- Lines 242-407, the source readers:
  - `sourceCache` 242-243 (stays private), `moduleSources` 245-272, `otherSources` 274-278 (the one body that changes)
  - `stripComments` 280-304, `moduleStyles` 306-314, `bodyOf` 316-351, `lineAt` 353-354, `stripStrings` 356-407
- Lines 5257-5277: `STANDING`. It is read by all three tiers (1278 in R12, 6520, 10571).
- Lines 8467-8572, the world readers: `stableJson` 8467-8475, `moduleSettingValues` 8477-8496, `worldFingerprint` 8498-8536, `watchWrites` 8538-8566, `fingerprintDiff` 8568-8572.
- Lines 8574-8600: `cast()`. It only reads; it is called by R105 in tier 0 (line 4606) and by 28 scenarios.
- One export line with 29 names, each imported somewhere: `Failure, Skipped, ok, needs, equal, wait, settle, until, layoutAvailable, cascadeAvailable, LIVE_PROBE, glassTheme, canvasAvailable, systemSheetsAvailable, dialogsDrawn, moduleSources, otherSources, stripComments, moduleStyles, bodyOf, lineAt, stripStrings, STANDING, stableJson, moduleSettingValues, worldFingerprint, watchWrites, fingerprintDiff, cast`.

**tests-tier0.mjs**
- Imports:
  - config.mjs: `MODULE_ID, moduleVersion, CRISIS_ACTIONS, ACTIONS, SFX_EVENTS, CRITICAL`
  - settings.mjs: `SETTINGS`
  - monokuma.mjs: `studentActors`
  - utils.mjs: `log`
  - kit: `ok, needs, equal, wait, layoutAvailable, otherSources, stripComments, moduleStyles, bodyOf, lineAt, stripStrings, STANDING, cast`
- Lines 207-240: the TIER 0 header and the "WHY A THIRD TIER" block.
- Lines 409-551: the name analysis that only R21 and R22 use, kept private: `boundNames` 409-465, `AMBIENT` 467-493, `CALLED` 495-496, `JS_KEYWORDS` 498-502, `functionsOnly` 504-538, `truthyReads` 540-551.
- Lines 553-5251: REGRESSIONS.
- `export { REGRESSIONS };`

**tests-tier1.mjs**
- Imports:
  - config.mjs: `OVERFLOW, MODULE_ID, moduleVersion, CRISIS_ACTIONS, ACTIONS, TRAITS, ITEM_CATEGORIES, LIMIT_GROUPS, EQUIPPABLE, SFX_EVENTS, SFX_CATEGORIES, HOPE_CALLS, DESPAIR_CALLS, OBSERVE_DC, ANALYZE_DC, CLEANUP, CRITICAL, KEY_REMNANTS, PHASES, PRICE_CHAINS, RESOLUTION_STRESS_COST`
  - inventory.mjs: `rolesOf`
  - vault.mjs: `vaultContents, stashRoomOfItem, stashIn, allVaults`
  - settings.mjs: `SETTINGS, DEFAULT_SAFEWORD, getSetting, BREAKPOINTS, narrowScreen`
  - safeword.mjs: `safeword`
  - clock.mjs: `getClock`
  - monokuma.mjs: `studentActors`
  - diagnostics.mjs: `detectPageTinting, stylesheetVersion`
  - voice.mjs: `voiceTargets, liveKitRoomFor`
  - music.mjs: `MUSIC_STATES, musicMap`
  - kit: `ok, needs, equal, wait, settle, until, layoutAvailable, cascadeAvailable, LIVE_PROBE, glassTheme, otherSources, stripComments, bodyOf, STANDING`
- Lines 5253-5255: the TIER 1 header.
- Lines 5279-8212: INVARIANTS.
- Lines 8214-8273: `LITERAL_KEYS`, private (read only at 7368).
- `export { INVARIANTS };`

**tests-tier2.mjs**
- Imports:
  - config.mjs: `MODULE_ID, EQUIPPABLE, SFX_EVENTS, FLAGS, PRICE_CHAINS`
  - settings.mjs: `SETTINGS, getSetting, BREAKPOINTS, narrowScreen, shortScreen`
  - narrow.mjs: `applyNarrowLayout, narrowLayout`
  - clock.mjs: `getClock, setClock`
  - monokuma.mjs: `studentActors`
  - voice.mjs: `voiceTargets`
  - kit: `ok, needs, equal, wait, settle, until, layoutAvailable, cascadeAvailable, canvasAvailable, systemSheetsAvailable, dialogsDrawn, moduleSources, otherSources, stripComments, bodyOf, STANDING, stableJson, moduleSettingValues, cast`
- Lines 8275-8277: the TIER 2 header.
- Lines 8279-8381: `snapshot`. Lines 8383-8465: `restore`.
- Lines 8602-14783: SCENARIOS.
- `export { SCENARIOS, snapshot, restore };`

**The import graph.**
- tests.mjs imports the kit and the three tiers. Each tier imports only the kit. The kit imports config.mjs and monokuma.mjs.
- There is no cycle. The boundary "tier 0/1 do not write" becomes visible in the imports: tiers 0 and 1 take only the read-only kit, and the only suite file exporting world writers is tier 2.

**Headers.** The only new prose in the split commit is one short header per new file.
- The tier-2 header must restate the old contract: "fixtures built and put back ... never run it in a world somebody is playing in". Lines 8338 and 8364 ("the contract this file opens with", "this file's own header warns") then stay true.
- Prototype line counts with one-line placeholder headers: tests.mjs 262, tests-kit.mjs 484, tests-tier0.mjs 4,888, tests-tier1.mjs 3,015, tests-tier2.mjs 6,386.

## 2. Who imports tests.mjs, and what stays exported where
- **The only importer is api.mjs:1048:** `runTests: (...args) => import("./tests.mjs").then(m => m.runTests(...args))`. It is a lazy import (C2); the comment above it is at 1037-1047.
- **module.mjs does not import it.** The static import closure of module.mjs is 102 files and tests.mjs is not among them; it is reached only through that `import()`.
- **diagnostics.mjs does not import it either.** `loadedFiles()` (line 951) crawls to it with the same regex (line 967), so `fileSizes()` lists it.
- **The harness** (01-runtests.mjs, 06-runtests-music.mjs) calls `game.drpg.runTests`. No scenario, and neither glass-harness.html nor pack-harness.html, imports the suite.
- **Keep the runner in tests.mjs rather than a pure re-export facade.** Then api.mjs, the README, the handbooks and 01-runtests stay unchanged, and tests.mjs keeps exactly one export, `runTests`.
- **Why not a facade:** `export { runTests } from "./tests-kit.mjs"` would put the runner in the kit, so the kit would import the tiers while the tiers import the kit. That cycle loads today, because the lists hold only closures. It would throw a TDZ ReferenceError the first time a tier file reads a kit binding at top level.
- If "four files" is read strictly, the runner goes to a fifth file, never into the kit.

## 3. How tier 0 reads sources, and what the split does to each road
**a) `moduleSources()` (242-272).**
- It crawls from module.mjs with `fetch(`/modules/${MODULE_ID}/scripts/${file}`)`, following `/(?:from|import\()\s*"\.\/([\w-]+\.mjs)"/g`.
- It caches in `sourceCache` for the life of the page, and nothing ever resets it. The comment "Fetched once per run" is wrong.
- The crawl reaches 108 of the 108 scripts on disk today, and 112 of 112 after the split (measured on the prototype).
- Only one test calls it directly: tier 2, line 12257, which reads remnant-ring.mjs.

**b) `otherSources()` (274-278).**
- It returns `moduleSources()` minus `"tests.mjs"`, and has 115 call sites: 103 in tier 0, 11 in tier 1, 1 in tier 2.
- The split commit must change the filter to `!/^tests(-[\w-]+)?\.mjs$/.test(file)` and update its one-line doc.
- If it does not, every source scan reads the suite's own ~15,000 lines, which quote what they hunt for. The suite text contains 4 `ChatMessage.create(` calls and 109 literal `"DRPG.x"` keys.
  - The result is loud false FAILs, and quiet false passes. R4 (876), "registered and never read", would count a setting that only the suite reads as read.
- With the new filter, the prototype returns the same 107 files in the same order.

**c) `loadedFiles()` in diagnostics.mjs.**
- It uses the same regex with a relative URL, and feeds `fileSizes()` and R126 (4987).
- R126 only asks that the manifest's styles and languages, module.json and scripts/module.mjs are among the loaded files. Four more scripts cannot fail it, and diagnostics.mjs needs no code change.

**d) Direct fetches by name** are untouched: 38 scripts, 17 stylesheets and 8 other files (module.json, lang, docs, README, icons).

**e) Flat files and double quotes are both mandatory.**
- The crawl regex has no `/`, so a subdirectory would be invisible to `moduleSources`, `loadedFiles` and `fileSizes`.
- The suite's 254 `import("./x.mjs")` calls (64 distinct files) resolve against the importing file, so a subdirectory would mean 254 edits of test content.
- The regex reads only double-quoted `"./x.mjs"`. A formatter that switches to single quotes silently drops the file from the crawl.

**Nothing in the suite reads the suite.**
- The only `"tests.mjs"` string in the file is the filter at 277. No test fetches tests.mjs, and no test inspects REGRESSIONS, INVARIANTS or SCENARIOS.
- No test asserts a file count. R1 asks for more than 1000 keys read and R12 for at least 15 standing openers, both over `otherSources`, both unchanged.

## 4. Every place the split can change a test's result, and what closes each one
1. **The `otherSources()` filter.** Required change; see 3b.
2. **A forgotten import.** It throws a ReferenceError only on the line that runs, and a harness run cannot show that every import is there.
   - 16 tests stop at `needs()` headless.
   - Failure-only branches (for example `lineAt` inside a failure message) never run on a green suite.
   - Closed statically: each new file's free names must be a subset of the 39 page globals the old file already used (Array ... window). The prototype has 0 extra names and 0 unused imports.
   - No harness global shadows a suite helper's name (checked against every `globalThis.*` in client-entry.mjs and lib/shim.mjs).
3. **`cast()` and `STANDING` cross tiers.** R105 in tier 0 calls the scenario fixture, and `STANDING` is read by all three tiers. Both go to the kit, so tier 0 never imports tier 2.
4. **One kit instance.** The runner's `err instanceof Skipped` and `instanceof Failure` need a single copy of the kit. A second copy would turn every skip into a FAIL ("threw: ..."). Every file must import `"./tests-kit.mjs"` by that exact specifier: no query string, no absolute URL.
5. **Crawl order.** The order of the new import lines decides the order of `otherSources()`: 162 of 300 shuffled import orders changed it.
   - No outcome depends on that order, per an AST scan:
     - 18 loops walk the sources; each collects across every file and asserts afterwards. The breaks at 1440 and 1836 belong to inner paren-balancing loops, and no loop writes an outer variable.
     - The two `.find()` calls (5108 gm-bridge.mjs, 5246 module.mjs) use suffixes only one file has.
     - The single join (1047) cannot match across a file boundary.
   - Only the order of offenders inside a failure message could move. The prototype's import order keeps the crawl order identical anyway.
6. **Module evaluation order.** Nothing moves: all 12 modules the suite imports are already in module.mjs's startup closure.
7. **The tests themselves.** All 307 entries must stay byte-identical and in order.
8. **The runner.** It moves verbatim, so the summary, the tier headers and the line format stay the same.
9. **Nothing else can move a result:** no `import.meta`, no stack reading, no source reading of the suite's own functions, no top-level side effects. The only bindings assigned are each written inside its own file.

## 5. Verification to run and record
**a) Static proof.** Scratch only, not committed. Shape: `node <scratch>/e30split/verify-split.cjs <parent checkout> <new scripts dir>`. It checks:
- all five files parse;
- free names are a subset of the old file's globals, and no import goes unused;
- every import from a tests file names an existing export, and every specifier is flat and double-quoted;
- the kit imports no test file, the tiers import only the kit, and tests.mjs exports only `runTests`;
- 44 of 45 declarations are byte-identical (only `otherSources` differs);
- the 117/93/97 entries are identical and in order, and every old non-blank line is present somewhere;
- the crawl reaches 112 of 112;
- `otherSources()`, executed over both trees, returns the same 107 files in the same order.

On the prototype (e30split/split.mjs → e30split/proto/scripts/) every check passes. Six planted mistakes each turn a check red: a missing `settle` import, an unused import, an edited test, a single-quoted import, the old filter, and a moved test.

**b) Harness before and after.**
- Run `node cluster.mjs scenarios/01-runtests.mjs > before.log` at the split's parent, then the same command after the split, twice (tier 2 has timing-bound tests).
- Compare with the shape of e30split/suite-diff.mjs:
  - It parses the SUITE OUTPUT block into ordered records of (tier, status, name, reason).
  - It exits 2, "NOT COMPARABLE", when passed + failed + skipped does not equal the printed lines, which is the 30,000-character cut.
  - It exits 0 only when every test, its order, its status and its reason match. It takes `--rename` for later commits.
  - Tested: the same log twice gives 0. val-e03a against val-e03f reports the 5 status changes and the tests added since. A cut log gives 2.
- Expected: 292/0/16, or the parent's numbers, with zero differences. Paste both outputs into the commit message.

**c) Results files.** Running the harness rewrites tracked files in audit/harness/results/ (S14-23). Keep them out of the split commit.

## 6. S14-25 and related hygiene: in the split commit, or after it
**In the split commit:** only the `otherSources` filter and its doc line. Moving `STANDING` into the kit resolves "STANDING under the tier-1 header" by itself. No renames, and no edits to moved comments.

**In a second commit, same release,** with its own before/after run and a rename map:
- **Stale numbers.** The audit's line numbers refer to bd16716 (13,769 lines).

  | Audit line | Now | Text | Measured now |
  | --- | --- | --- | --- |
  | :161 | 230 | "Eighty-odd fetches" | 108 scripts before the split, 112 after |
  | :173 | 242 | "eighty-eight files" | 108 before, 112 after |
  | (same block) | 252 | "88 on disk, 88 reached" | 108/108, then 112/112 |
  | :181 | 250 | "all thirteen criteria" | 117 tier-0 tests |
  | :554 | 702 | "Twenty files call `game.socket.on`" | 16 (comments stripped, tests* excluded) |
  | :504 | 611-613 | "thirteen of the thirty-one" | already removed in E01 |

  Also fix 242 "once per run" (the cache lasts per page load) and 324 "in this file" (now "in the suite").
- **The duplicate R21.** Keep the one at 1718, which lines 74 and 532 and docs/changelog-1.2.0.md:103 refer to. Renumber the one at 2000, "R21 - the chapter ends by closing the trial...", to the next free number: R151 at 411d4da (R113-R124 are reserved, R125-R150 are used). Record it in the CLAUDE.md register of R numbers.
- **The separator.** 27 names use "·" (R21 at 1718 spells it `·`) and 113 use "-". Unify them in the same rename map.
- **The double JSDoc on `runTests`** (14815-14819 and 14820-14827): delete the first block.
- **LITERAL_KEYS** (8214-8273) and "every string the code asks for exists in the language file" (7363).
  - Of the 78 keys, 69 are already read by R1.
  - Keep the 7 assembled at runtime: `Murder.victimUnderAttack` and `victimTrapSprung` (murder.mjs:791), `Season.step.resources` and `Season.hint.resources` (season-setup.mjs:467-468), and the three `Bridge.what.*` keys (gm-bridge.mjs:324).
  - Drop `Murder.betrayTileLabel` and `betrayTileHint`, which no module file uses.
  - Rewrite the comment: R1 does read the source in the browser.
- **References made wrong by the move:**
  - header line 22, "See the block above REGRESSIONS"
  - 1510, "`STANDING` above it", which was already wrong (STANDING sits 3,759 lines below it)
  - 3865, "this file's own runner"
  - the stray "," at 6729
- **References outside the suite:** api.mjs:1040 ("`tests.mjs` is 5400 lines"), action-rolls.mjs:70, diagnostics.mjs:694 and 931-934, gm-bridge.mjs:1755 ("R1b in tests.mjs"), CONTRIBUTING.md:52, audit/harness/scenarios/01-runtests.mjs:36, docs/design/typography.md:6.
- **13-murder-signals.mjs:** the comment at 134-141 is repeated at 168-175.

**Later E30 work, which lands in the new files:**
- `fnSource`, `expectedRed`, the assertion counter and `worldDump` do not exist yet (0 hits). They go into tests-kit.mjs; `worldDump` replaces `worldFingerprint` in one place.
- The `-=` test and the meta-tests go into tests-tier0.mjs. The meta-tests need a `suiteSources()` that shares one `isSuiteFile` predicate with `otherSources`, and they must assert that they read all five files and at least 307 entries.
- S14-24 now covers 7 scenarios that shadow `cast` with `game.actors.filter(...)` (lines 9313, 9439, 9516, 9630, 11091, 11800, 12451), one more than the audit counted. `cast()` still FAILs rather than skips, including in R105. Fixing that changes behaviour, so it comes after the split.

## 7. Order within E30
1. The split: the first E30 commit, on the released E03, with nothing else in flight editing tests.mjs.
2. The hygiene commit.
3. The harness fidelity work (S14-28), which is expected to change results and so must not share a before/after comparison with the split.
4. The kit features and S17-06.

Anyone following a moved line: `git blame -C -C -C`.