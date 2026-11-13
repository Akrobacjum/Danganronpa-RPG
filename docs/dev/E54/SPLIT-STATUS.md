# E54's first cut as a script - STATUS

Work line e54-prep, 13.11.2026, from origin/main 421f2395 (1.2.109). The coordinator's brief: E54 cannot land while
feature lines still change scripts/sheet.mjs, so its first cut is built as a reproducible script instead of a hand
edit, proven on main, and tried on other lines' tips. The split's result is not pushed: only the script, its manifest
and this file.

## What is here

| File | What |
| --- | --- |
| tools/e54/split.mjs | The script: `node tools/e54/split.mjs [--manifest <json>] [--repo <dir>] [--dry]`. Moves whole top-level declarations into new files as the manifest lists them, writes each file's imports, promotes to `export` what another file reads, leaves the old file as the facade (its kept declarations, its imports pruned to what they read, the family's imports, and `export { ... } from` for every name it exported that moved), and points the two references `check text` reads at the family. Refuses (exit 1, nothing written) when the tree is not the manifest's: a listed declaration missing or of another kind, a top-level declaration listed nowhere, a statement that declares nothing, a moved declaration reading a name the facade keeps, a write across files, an import cycle between the new files, or a target that already exists. Which names a declaration reads is eslint-scope's answer, not a text search. Its header says how it works. |
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

So the E54 commit that applies this split also repoints these 34: a family text in tests-kit.mjs (as E41 left
`actionText`, `panelText`, `hudText`) for the source readers, the two registers' rows (R1541's contract row, R3858's
census file) and R22's reading. That is the plan's C0a and C0b, in scripts/ and docs/, outside this line.

## Not done here

The code.md rows for the new files are the coordinator's (Q-E54-8).
