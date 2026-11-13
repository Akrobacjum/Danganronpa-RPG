# E54's first cut as a script - STATUS

Work line e54-prep, 13.11.2026, from origin/main 421f2395 (1.2.109). The coordinator's brief: E54 cannot land while
feature lines still change scripts/sheet.mjs, so its first cut is built as a reproducible script instead of a hand
edit, proven on main, and tried on other lines' tips. The split's result is not pushed: only the script, its manifest
and this file.

## What is here

| File | What |
| --- | --- |
| tools/e54/split.mjs | The script: `node tools/e54/split.mjs [--manifest <json>] [--repo <dir>] [--dry]`. Moves whole top-level declarations into new files as the manifest lists them, writes each file's imports, promotes to `export` what another file reads, leaves the old file as the facade (its kept declarations, its imports pruned to what they read, the family's imports, and `export { ... } from` for every name it exported that moved), and points the two references `check text` reads at the family. Refuses (exit 1, nothing written) when the tree is not the manifest's: a listed declaration missing or of another kind, a top-level declaration listed nowhere, a statement that declares nothing, a moved declaration reading a name the facade keeps, a write across files, an import cycle between the new files, or a target that already exists. Which names a declaration reads is eslint-scope's answer, not a text search. Its header says how it works. |
| tools/e54/repoint.mjs | The second stage: `node tools/e54/repoint.mjs [--manifest <json>] [--repo <dir>] [--dry]`, run on the tree split.mjs wrote, as a commit of its own. Points the suite's readers of the split file at the file that now holds what they read: the family in tests-kit.mjs (`SHEET_FAMILY`, `sheetText`, `sheetFetch`, `sheetBy`, as E41 left `hudText`), a whole-text read by name to the family's text, a reference by name (`"sheet.mjs", "NAME"`, `sheet.mjs#NAME`, a row of names, the contract register's `file` beside its `symbol`) to the holder, a count row to one row per file the expression matches now. Which file holds a name is read off the split files and held to the manifest. Then the manifest's `repoint.sites` (a reading measured on the split tree) and `repoint.patches` (a reader the split exposed, each with its why). Refuses on what it did not foresee; lists every reference to the file it leaves. Its header says how. |
| tools/e54/sheet.json | The manifest for scripts/sheet.mjs: the facade keeps `SHEET_STEPS`, `runSheetSteps`, `onRenderCharacterSheet`, `registerSheetTweaks`; 171 declarations go to eight files, each with its kind at 421f2395, in the order written there; one named entry point for the text map (`textMapNamed`, and why). |

The eight files are the E54 plan's (docs/dev/E54/PLAN.md on the prep-54 line, section 3.1) with sheet-mode.mjs as
its F1 says. Three placements differ from that table, each to keep a cut the suite reads (moved-only part `cuts`):
`CREATE_ACTIONS` and `removeSystemCreators` go to sheet-fit.mjs, after `keepTabScroll`, as at the base; `guardRow`,
`GEAR_GROUP`, `INVENTORY_GROUPS` and `itemTags` go to sheet-sidebar.mjs (guardRow before `injectEquippedTools`, the
other three after `tidyBiography`, as at the base - the sidebar's gear row reads `itemTags` and `guardRow`, so the
inventory reads them from the sidebar and not the other way); `BULLET_FOLDS` opens sheet-inventory.mjs, so no
function's cut takes it in.

## Proven on main (421f2395), in a throwaway worktree

| Step | Result |
| --- | --- |
| The split | facade sheet.mjs 232 lines (5927 before); sheet-mode 151, sheet-item 446, sheet-repaint 344, sheet-fit 457, sheet-header 811, sheet-sidebar 1197, sheet-inventory 1001, sheet-actions 1407 - each under E41's 1500; 58 declarations promoted to export; tools/text-map.mjs and docs/dev/text-batch-B01a.json pointed at the family |
| `node tools/moved-only.mjs HEAD~1` | 8 parts, all green: lines (moved 5124, promoted 47, header +46, import +102 -52, export-from +7, left over 0), statements 175 = 175, bindings 803 names resolved, api 28 exports followed, cuts 136 of 143 identical and 7 listed, jsdoc, imports |
| `npm run quick` (lint, check, gate) | green: lint 329 files 0 problems; check 17 parts all green (text included); gate 37/37 |
| tiers 0-1 | 1320 tests ran, 409 s: 1271 passed, 34 failed, 16 skipped, 0 red - every failure a test that reads sheet.mjs by name (the next section) |
| The text map | the same unassigned keys as main (a diff of the two lists: none), the same readers per surface |

What it took to get there, so the next run does not repeat it: the first run was red on moved-only's `cuts` for five
functions (the three placements above fixed all five) and red on `check text` for three references to sheet.mjs
(the script now rewrites them); then two language keys lost their screen (DRPG.Trial.presentNobody, presentOnly:
the text map follows one hop into another file, and `sheetMode` had moved one hop further), which the sheet's row
naming `sheet-mode.mjs:sheetMode` restores.

## On other lines (13.11.2026)

| Tree | Result |
| --- | --- |
| e97-98's tip (cebe4c69) | applies; the split made and `moved-only HEAD~1`: 8 parts, all green |
| e100's tip (794fbca4) | refused, as written to: `monocubMoveNote` and `stillMoveTile` are new top-level functions the manifest places nowhere. With them listed in sheet-actions.mjs (after `injectMonocubPanel` and after `actionButton`, where the line wrote them) in a scratch copy of the manifest: applies, and `moved-only HEAD~1` 8 parts, all green |
| each active line merged into main (`git merge-tree`), sheet.mjs of the merge, `--dry` | applies: fervent-sagan-gme4vt, e93, e64, e101, e97-98, gaps-108, texts-e71, dh-212, perf-open, e59-prep, audit-130, plan-130. Refused for two new functions each: e72 (`lairLocked`, `lairBlock`), e100 (as above). No merge conflicted in sheet.mjs |

So at the time E54 runs, the manifest needs a row for each top-level declaration the lines that landed added - the
script names each - and nothing else, unless a line removed or renamed one (it names those too).

## Tiers 0-1 on the split: 34 failures, each read

Not repointed here, by the brief: the tests that read sheet.mjs's source or name it in a register (the E54 plan's
C0). Each of the 34 failure messages was read (13.11.2026); none passed on an empty reading, which is what C0 had to
rule out (the plan's R1, corrected 12.11):

| Kind | Tests | What the message says |
| --- | --- | --- |
| refuses loudly: the function it cuts is no longer in sheet.mjs | R18, R48, R53, R79, R82, R98, R121, R591, R603, R607, R614, R909, R986, R1162, R1319, R1440, R1455, R1470, R1475, R1549, R3488 (21) | "the source no longer declares a top-level function X() - this test reads nothing until it is pointed at the code again", or "... would read nothing" |
| a census or register keyed by file | R22 (its own name reading: `run` in the facade's loop is now declared by a destructuring only), R300 (sheet.mjs takes each silence reader from its module), R304 (the investigation roads' census), R1441 (the reserve census), R1541 (the contract register names `sheet.mjs:installRenderPlan`), R3858 (docs/dev/e92/CENSUS.md counts `type === "character"` per file) (6) | the row names sheet.mjs, or a count per file moved |
| composite, the failing part not isolated here | R108, R1038, R1101, R1110, R1158, R1159, R1458 (7) | each message lists source readings among its parts (e.g. R1038 `row: false`, sheetMode's `isMutedDead`; R1101 `useItem: false`, the item row's button); that the failing part is a reading and not a behaviour is read from the message, not proven part by part |

So the E54 commit that applies this split also repoints these 34: the plan's C0a and C0b. Since 13.11.2026 that is
the second stage, tools/e54/repoint.mjs (the next section).

## The repoint stage, proven on main (421f2395), 13.11.2026

In a throwaway worktree: `split.mjs` as one commit, `repoint.mjs` as the next, from the same manifest.

| Step | Result |
| --- | --- |
| `node tools/moved-only.mjs HEAD~1` on the split commit | 8 parts, all green, the numbers above (the repoint is a commit of its own, so the split commit stays the pure move) |
| `repoint.mjs` | 46 rewrites in scripts/tests-tier0.mjs, tests-tier1.mjs, tests-tier2.mjs, patches.mjs and docs/dev/e92/CENSUS.md, and the family in tests-kit.mjs; 81 references to sheet.mjs left, each read (below) |
| the 34 failing tests, R311 and R1153 by `--only`, on the script's first version | 37 passed (the 36 and the world check), 0 failed |
| `npm run quick` on the repoint commit | green: lint 328 files 0 problems; check 17 parts all green; gate 37/37 |
| tiers 0-1 on the repoint commit, the script as committed (its output on this tree byte for byte the same as the run's) | 1320 tests ran, 399 s: 1305 passed, 0 failed, 16 skipped, 0 red; the 16 skipped are skip-baseline.json's rows of tiers 0-1, name by name (its other 11 are tier-2 tests) |

Main itself was not run again here: the split alone ran the same 1320 tests (1271 + 34 failed + 16 skipped), so 1305
passed is every test that is not skipped. A run of 421f2395 is the next line of this file once it is made.

What the 46 rewrites are, by rule (the script's own report, `--dry` prints it):

| Rule | Sites | Tests |
| --- | --- | --- |
| a whole-text read to the family's text (`sheetText` 16, `sheetFetch` 4, `sheetBy` over a test's own helper 8) | 28 | R18, R48, R53, R79, R82, R98, R108, R121, R300, R591, R603, R607, R614, R909, R986, R1101, R1153, R1162, R1440, R1455, R1458, R1475, R1549, R3488, and tier 2's "each silence answers ..." |
| a reference by name to the holder (a pair 3, a reader's names 1, a key 2, a count row 1, a list of files read 2, the contract register 1) | 10 | R304, R1038, R1110, R1159, R1319, R1441, R1541 (patches.mjs `installRenderPlan` to sheet-repaint.mjs) |
| a row regrouped by holder | 2 | R311 (names), R1470 (allowances, every file of the family in it) |
| a file test to the family | 1 | R1476 |
| sites measured on the split tree | 3 | R1158 (the nominative's reader is sheet-header.mjs), R3858 (the count of `type === "character"`: sheet-mode 1, sheet-repaint 1, sheet-sidebar 2) and its census row in docs/dev/e92/CENSUS.md |
| patches, each with its why in the manifest | 2 | R22 (its binding reader takes a for-of destructuring: the facade's `runSheetSteps` binds `run` only there), R1470 (its guard against an empty read, 20000 characters, is above the family's smallest file) |

### Two tests that passed on an empty or narrowed reading

The brief asked whether every repointed test still measures something. Two did not need repointing to stay green,
and that is the case the project's first rule warns of (a test can pass by measuring nothing):

- **R311** ("a trial road has a census row", its NAMED): it keyed `"sheet.mjs": ["addPresentButton", "injectAdvanceButton"]`
  and read only those two names in sheet.mjs. After the split neither stands there, so the census read no declaration
  of the sheet and stayed green. The repoint keys them `sheet-header.mjs` and `sheet-inventory.mjs`.
- **R1476** (the flicker's apparatus): it looked for an `updateActor` hook in `sheet.mjs` only, by `name === "sheet.mjs"`;
  after the split that is the facade alone. The repoint asks every file of the family.

Neither was among the 34. Both were found by reading what the repoint rewrote, not by a run: a test that keys a
file by name and reads a subset of its names can lose its reading without failing, and the split's failure list does
not show it.

### What the repoint leaves (81 references, each read)

Prose in test names and messages ("sheet.mjs exports no sheetMode ..."), `import("./sheet.mjs")` (the facade exports
every name it did), the census keys of hooks `registerSheetTweaks` registers (`HOOK sheet.mjs#registerSheetTweaks#...`,
R379, R432, R553: the function stays in the facade), R1476's guard that the `sheet*.mjs` glob read the facade and
sheet-audit.mjs, and R1470's `"sheet.mjs": {}` (the facade, read for predicates, none allowed). No test reads the
file's text by name after the repoint.

### On other lines (13.11.2026)

Each line committed to since 12.11 merged into main (`git merge-tree`), the split applied, then `repoint.mjs --dry`:
it applies on every line where the split applies (46 rewrites; 47 on e64, which adds one reader), and does not run
where the split refuses (e72, e100, as above). On e101, e101b, e64 and gaps-108 the merge conflicts in a tier file, so
there the dry run read a file with conflict markers; it applied, which says only that the rules found their sites.

## Not done here

The code.md rows for the new files are the coordinator's (Q-E54-8).
