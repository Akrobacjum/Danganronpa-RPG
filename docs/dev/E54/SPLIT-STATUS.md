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

Main itself, 421f2395 in a worktree of its own, later the same day: 1320 tests ran, 404 s: 1305 passed, 0 failed,
16 skipped, 0 red, the 16 the same tests by name. So the split with its repoint reads as main does, test for test.

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

## The other cuts (the coordinator's (2), 13.11.2026)

The E54 plan's other cuts, each a manifest for the same two scripts. A cut that moves part of a big file keeps the rest
in the facade (`"keep": "*"`), so a line that adds a declaration outside the moved sections is no refusal; one it adds
between two declarations moved to the same file is ("decide its file"), and a declaration that stays there by decision
is named (`stay`). A bare statement moves when a target names it by the text it starts with (`statements`): the
season registry's rows, which R1254 holds to the file of the functions they name.

| Manifest | What moves | Into | On 421f2395, throwaway worktree, the scripts as committed (84816bc0) |
| --- | --- | --- | --- |
| tools/e54/windows.json (the plan's W1) | `windowWidthFor`, `eachPane` | windows.mjs (97 lines; utils.mjs 1421 -> 1335) | moved-only 8/8 green (moved 85, cuts 56 of 56 identical); repoint 15 rewrites; quick green (lint, check 17 parts, gate 37/37); tiers 0-1 1305 passed, 0 failed, 16 skipped (skip-baseline's rows), 0 red |
| tools/e54/key-remnants.json (K1, F4) | "THE PLAN" through `same`, `randomPointIn`, `createKeyRemnant` .. `placeKeyRow`, and the season registry's `keyPlan` row; `openNewTrace` stays (`stay`) | key-remnants.mjs (1248; investigation.mjs 3239 -> 2011) | moved-only 8/8 green (moved 1150, promoted 7, cuts 86 of 86 identical); repoint 31 rewrites; quick green (lint, check 17 parts, gate 37/37); tiers 0-1 1305 passed, 0 failed, 16 skipped (skip-baseline's rows), 0 red |
| tools/e54/cleanup-reshape.json (P1, F5) | the veiled `whisperToOwner`, the receipt store (`RECEIPT_FIELDS` .. `recreationDataFor`), `findRemnantToken`, the reshape road (`askTransform` .. `askTransformChange`), in that order | cleanup-reshape.mjs (804; cleanup.mjs 3665 -> 2877) | moved-only 8/8 green (moved 733, promoted 7, cuts 81 of 82 identical, the 82nd listed); repoint 24 rewrites; quick green (lint, check 17 parts, gate 37/37); tiers 0-1 1305 passed, 0 failed, 16 skipped (skip-baseline's rows), 0 red |
| tools/e54/chapter.json (D1, D2) | "THE BODY IS FOUND" (`faintPrepCandidates` .. `openBodyDiscoveryDialog`); "DEATH" (`livingStudents` .. `chooseFirst`) with the registry's `deaths` and `bodyFound` rows; body.mjs first (`targetsOrder` says why) | body.mjs (952), death.mjs (758); chapter.mjs 2717 -> 1044 | moved-only 8/8 green (moved 1560, promoted 3, cuts 70 of 70 identical); repoint 72 rewrites; quick green (lint, check 17 parts, gate 37/37); tiers 0-1 1305 passed, 0 failed, 16 skipped (skip-baseline's rows), 0 red |
| tools/e54/windows-settings.json (W3, F2) | the settings half of the window size | - | refused, as F2 says: `scaleMemo` reads `layoutHeight`, `scaleWindow` reads `settingsRegistered`, `layoutHeight` and `sliderScale`, which settings.mjs keeps. Not a pure move until W2 hands `scaleWindow` its readers; after W1 windows.mjs exists, and appending to a file is not written in split.mjs |
| tools/e54/remnants-migrate.json (F3) | `migrateRemnants` .. `seedPublicIfMissing` | - | refused, as F3 says: 25 reads of the ten names the plan lists (`REMNANT_FLAGS` 6, `isNeutralName` 4, `keyOf` 4, `setRemnantSecret` 4, `traceLabel` 2, `TINTS`, `defaultPublic`, `neutralTraceNames`, `oldTokenTie`, `traceTokensOn`), which remnants.mjs keeps. Into migrate.mjs itself it would refuse sooner: the file exists. The owner's default of Q-E54-3 (leave them) stands on this |

The sheet, made again by the scripts as committed (they grew for the cuts below): moved-only 8/8 green, repoint 46
rewrites; its tree differs from the one proven above in two lists of files, which now read the whole family
(R1038, R1110); quick green; tiers 0-1 1305 passed, 0 failed, 16 skipped, 0 red.

Main itself, the same tiers 0-1, the same day: 1305 passed, 0 failed, 16 skipped, 0 red (the repoint stage's section).

### What the cuts asked of the two scripts

Each found by a red check, fixed in the script (or the manifest) and run again; none by hand in the tree.

- cleanup-reshape: moved-only `cuts` red twice - `RECEIPT_FIELDS` (an array) ended neither `askTransformChange`'s cut
  nor `findRemnantToken`'s; the manifest's order puts the store first (its `order` says why).
- key-remnants: `openNewTrace` stands between the plan and the placing road; the new between-check refused it until
  the manifest named it in `stay`.
- key-remnants, chapter: R1254 red - the season registry's rows stayed in the facade while their functions moved;
  split.mjs moves a named statement now, and repoint follows the owner in R1254's table and in its planted check's
  expected text.
- key-remnants: R382 red - rooms.mjs CAMERA_READERS keys `investigation.mjs#openKeyRemnantHere`; repoint finds the
  registers outside the suite by that spelling. R376 red - a list of files read through a helper (`[...].map(src)`).
  R2035 red - the file-list rule had rewritten a pair's file in a mixed list; it touches only lists of file names now.
- chapter: R192 keys rows "chapter.mjs markDeceased flag" (a key followed by more words); R56 cuts
  `openBodyDiscoveryDialog` until `allBullets`, which stays in the facade (the cut now ends at the family's line,
  which follows a file only when it is not the family's last: the manifest puts body.mjs first); R436 and R3404 compare
  readings sorted by file, which the rename reordered (a keyed list sorted before is sorted after); R346 reads
  chapter.mjs whole in a list of files beside a planted fixture `["chapter.mjs", "<code>"]`.
- every cut: a list of files a test reads names every file of the family where it named the split file, the planted
  fixtures left. Before this rule several scans stayed green on the facade alone - cleanup's `FILES` scans beside the
  action family, R346, R1101, R1254 and R161's lists - the same kind of narrowed reading as R311 and R1476 above.
- key-remnants, cleanup-reshape, chapter: R3510 red - its census of card sites per file comes from its own classifier,
  which a rule cannot recompute; each manifest carries the rows measured on its split tree (`rows`), which the script
  holds to the old row's sums and puts at their sorted place.

After the fixes the sheet's and the window's trees were made again and compared with the ones proven: the same, byte
for byte, so those proofs stand.

### On other lines (13.11.2026)

With the scripts as committed (84816bc0), on each of the 36 lines committed to since 12.11, merged into main, each cut
on a fresh copy of the merge: windows, key-remnants, cleanup-reshape and chapter split, and repoint (`--dry`) applies,
on every one - 15, 31, 24 and 72 rewrites on 32 lines; windows 16 and chapter 74 on e72, cleanup 28 on e64, chapter
73 on e64 and e64-inv (a line's own readers more). The sheet splits and repoints (46; 47 on e64) on all but e72 and
e100, refused as above. windows-settings and remnants-migrate refuse on every line.

### The sheet cut on 1.2.110's and r112's shape (13.11.2026)

e72 ships in 1.2.110 and adds `lairLocked` and `lairBlock` to sheet.mjs; r112 adds `monocubMoveNote`, `moveDragSaid` and
`stillMoveTile`. sheet.json places them where their lines wrote them, after the declaration before each there:
`lairLocked`, `lairBlock` after `knownPassageItem` in sheet-sidebar.mjs; `monocubMoveNote`, `moveDragSaid` after
`injectMonocubPanel` and `stillMoveTile` after `actionButton` in sheet-actions.mjs. Their kind ends in "?": placed where
the tree holds them, asked of no tree that does not (split.mjs, repoint.mjs) - on 421f2395 the five cuts' trees come
out as before, byte for byte.

main + e72: a merge of origin/claude/e72 into 421f2395 conflicts in seven files outside the cut (lang, voice.mjs,
bridge-guards.mjs, the handbooks, the registry); origin/claude/v110-fix (32f5093f) holds main and e72 with those
resolved by their line, and its sheet.mjs differs from main's in e72's two functions alone, so the proof is on it.

| Tree | split | moved-only on the split | repoint | sweep (main's tables) | quick | tiers 0-1 | the same tree uncut |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v110-fix 32f5093f (main + e72, 1.2.110's review) | applies | 8/8 green | 53 rewrites | 111 rows, 1 found by its whole line; R-REGISTRY.md 31 lines (the renamed rows) | green | 1369 passed, 0 failed, 16 skipped, 0 red | 1369 passed, 0 failed, 16 skipped, the same skips by name; quick green |
| r112 d449e0bd | applies | 8/8 green | 50 rewrites | 111 rows; R-REGISTRY.md 31 lines | green | 1343 passed, 0 failed, 16 skipped, 0 red | 1343 passed, 0 failed, 16 skipped, the same skips; quick green |

The sweep's tables are main's: on v110 one fragment stands three times in calls.mjs (the line adds two more), and the
row is applied in the one line that is still its base line; on r112 R3488's name was rewritten ahead of its fragment,
which still stands once. Built on each tree itself (`sweep-build.mjs --base`), the tables hold more rows - the lines'
own new comments that name sheet.mjs: v110 861 comment lines, 213 false, 40 test names, 253 rows; r112 840, 209 false, 43 test names,
252 rows - so on E54's day they are built again on the commit it runs on.

## The behaviour commits and the glass cut, rehearsed on main 984d1fb1 (13.11.2026)

The behaviour commits are on claude/e54-behaviour, built on v110-fix 32f5093f, each message naming the lines it reads:
W2 f0fc53dd, W4 40426030, W5 86e8ba27, W6 5db9cb43, Q-E54-7 516395d3, the cut's golden reading and R4805 38727af0,
G3 df41f149, G4 c4ceea05, G4b 699d5bab, G4c 87eda1af, and the sweep's S12-95 control bf036b2a. E54's day cherry-picks
them in that order onto main, then runs the cuts.

E54's day, rehearsed in a throwaway worktree: the first ten picked onto origin/main 984d1fb1 (1.2.111) in order.
Six picked clean. The conflicts, and how each was resolved:

| Commit | File | Resolution |
| --- | --- | --- |
| W2, W4, W6, Q-E54-7, 38727af0 | docs/dev/R-REGISTRY.md | `node tools/registry.mjs --write` (the generator's file) |
| W2 | scripts/tests-tier0.mjs, the end of REGRESSIONS | both appended tests (main R4200-R4204, the branch R4800 on): main's block, its closing `    }],`, then the branch's |
| Q-E54-7 | scripts/tests-tier0.mjs, line 8 | the config.mjs import takes main's `INFILTRATE` and the branch's `SHEET_SIZE`; the settings.mjs import the branch's |

Then tools/e54/glass.json (the plan's G1 and G5 in one cut: split.mjs refuses a target that exists) on that tree:

| Step | Read |
| --- | --- |
| behaviour on main | quick green; tiers 0-1 1410 passed, 0 failed, 16 skipped, 0 red |
| split | 262 declarations; glass-geometry.mjs 54 (1307 lines), glass-blocks.mjs 4 statements (88 lines), glass.mjs keeps 204 (3720 lines); main's seven new declarations stay |
| moved-only HEAD~1 on the split | 8/8 green |
| repoint | 30 rewrites, the manifest's four patches (R509's stand-in sources, R4805's reading), 78 references left |
| quick, tiers 0-1 on the repoint | green; 1410 passed, 0 failed, 16 skipped, 0 red |
| audit/glass-golden.mjs, the cut against the tree before it | 276 cuts over 23 sizes: SAME, byte for byte |
| `node audit/glass-sweep.mjs` | red on one line of 46 sizes with glass: S12-95's control (NOT PATCHED; it rewrote glass.mjs's response, and the branch moved). Fixed by bf036b2a; that check at 1920x1080 then read green before and after the cut, and the whole sweep again with the fix: green, 2 themes x 2 roles x 25 sizes, 46 with glass, 0 failing |
| scenarios 74-room-tile, 75-voice-tile | 44/44 and 41/41 checks |

What the glass manifest decides, and why: railBox, resolveAcc and accProbe read the page and stay; centreOrder stands
among the turn helpers and is not on F6's list; lerp and resample are on it but no cut reads them, and moving lerp
shortened glassLifecycle's cut by its line. glass-blocks.mjs is a file of its own because in glass-geometry.mjs
settleVoice's and blockTurns's cuts grew (739 -> 953, 480 -> 31991 characters). split.mjs now writes `export ` before a
promoted declaration's line when only blanks precede it there (glass.mjs indents the cut two spaces); every top-level
statement of the other cuts' sources starts at column 0, so their output is as before.

### W3's file (a coordinator decision, 13.11.2026)

W3 (tools/e54/windows-settings.json) writes scripts/window-scale.mjs, not windows.mjs: W1 writes windows.mjs from
utils.mjs and split.mjs refuses a target that exists, so one windows.mjs would need split.mjs to append. The
coordinator took window-scale.mjs as an internal name, not put to the owner. Rehearsed on claude/e54-behaviour
648bc56f (W1 split and repoint, then W3 split, repoint and comment sweep): moved-only 8/8 green on both splits;
quick green; tiers 0-1 1375 passed, 0 failed, 16 skipped, 0 red.

### Not to land on E54's day

- prep-54's C1 (0271bfb2: tools/comments-lint.mjs, comment-budget.json, `check comments`): the E56 line
  (claude/e56-c0) carried it onto main a31e7a3b with a reworded header and a rewritten budget; E54 takes E56's
  version and does not land C1 again (the coordinator, 13.11.2026).

### Not done here

- The splits' results, as the brief says: only the scripts, the manifests and this file.
- The comment sweep's tables of the five earlier cuts are main 421f2395's; built again on E54's day (sweep-glass.json
  and sweep-windows-settings.json are main 984d1fb1's with the behaviour commits).
- A comment that names where its code stands moves with the code and says what it said: utils.mjs `windowWidthFor`'s
  header ("Here and not in the kit because R168 reads it here") is now in windows.mjs. moved-only holds every moved line
  to its text, so such sentences are for the stage's comment sweep, not for these scripts.
- The code.md rows for the new files: written on the 1.2.112 landing line (below), with the owner's consent to that one
  file (13.11.2026).

## E54 rebuilt on 1.2.112 (main a2b233d2), 13.11.2026

The landing line for 1.2.113: claude/e54-land-112, pushed at c6e4e5ed, 36 commits on a2b233d2 - the 12 behaviour
commits cherry-picked, the tooltip census's gate (da276909), the seven cuts (split, repoint, comment sweep: 21
commits), six headers corrected (91bb2443) and code.md's rows (c6e4e5ed, E1). The earlier landing line (on a31e7a3b,
8cf9ca43) stays as it is.

| Proof | Read |
| --- | --- |
| moved-only, each split | 8 part(s), all green, all seven |
| quick, after each cut and at the end | green |
| tiers 0-1, after each cut and at the end | 1510 passed, 0 failed, 16 skipped, 0 red |
| the cut's golden (`audit/glass-golden.mjs`, 23 sizes, 276 cuts) | byte for byte the same as a2b233d2's, 924348 bytes |
| `audit/glass-sweep.mjs` | SWEEP GREEN: 2 themes x 2 roles x 25 sizes, 46 with glass, 0 failing (46 min here, 13.11; the a31e7a3b line's run was not timed, so no comparison) |

What 1.2.112 asked of the tools, each fixed on this line before the run that went green:

- key-remnants: `keyPlanExtras` is gone from 1.2.112's investigation.mjs; the manifest's stay is optional (`function?`).
- The sheet cut: R4754 reads a `[file, name]` pair written without a blank, which repoint's pair rule did not match
  (now blank-tolerant), and `check tooltips` read the census rows of moved functions as new rows. repoint carries a
  census row's `file` with its function (3f847c23), and the census's check against main's copy counts a row by its
  unit, kind and key (da276909, on the landing line: tools/tooltip-census.mjs). That second change is a gate's, and
  is a default for the coordinator to review, not a settled one. Its message's reading ("with the eight rows
  moved") was taken with the rows moved by a scratch script; the landing run then moved them with repoint's rule and
  read `check tooltips` green in quick on every cut.
- The comment sweep's tables: built again on the landing line's base (sweep-build: 1352 comment lines read, 244 false;
  315 test texts, 61 false).

Six headers the split wrote were wrong against the landed files (found writing code.md's rows): sheet-inventory.mjs
(`guardRow`, the create buttons), sheet-fit.mjs (did not name `removeSystemCreators`), glass-geometry.mjs (the voice
settle and the turns are glass-blocks.mjs's; glass.mjs exported none of its names), glass.mjs's note, windows.mjs
(W3's half) and chapter.mjs ("the next session"). Fixed in the manifests (1b77763c) and on the landing line (91bb2443).

Messages: the landing line's 36 carry [skip ci], end on the two trailers (a cherry-pick's "(cherry picked from ...)"
line now stands above them; on the a31e7a3b line it stood after), and name no branch by its ref.

main moved after the base: ceb9e9c8 (1.2.112's death fade fix, scripts/death-fade.mjs, the gate's record and the
release notes). merge-tree against it: clean. death-fade.mjs imports nothing the cuts moved (settings.mjs keeps
`SETTINGS`, `getSetting`, `isDeadForGm`). Not run on the merged tree.
