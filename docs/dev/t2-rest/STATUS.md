# t2-rest - the last tier-2 reds of 1.2.113 (four tests and a season reset)

Branch `claude/t2-rest-113` (merged with claude/t2-restore-113 at c358be83, a24a21d9), from `claude/t2-restore-113` at 4a0e8fe3 (the 1.2.113 assembly 6dd02975 plus the tier-2
restore fix). 14.11.2026. Headless (audit/harness), 4 cores. No R number taken: no new tier-0/1 test; the one new test
is tier 2, which is named, not numbered.

## The items (four tests; the fifth item of the brief is the reset)

| # | Test | Module or test | The line | The fix | Commit |
| --- | --- | --- | --- | --- | --- |
| 1 | "Back up the case, then Restore, brings every store back" | test | gm-stores.mjs `eavesdropStore` and `maskStore`: `backup: true` on both; the test's own check read "these stores are backed up and this test has no fixture for them: eavesdrops, masks" | a fixture for each: an ended eavesdrop row with no user (blocks no microphone, places nobody, its mark the time of day now), a mask row with no token and no owner (tier 2's `restore` ends it by `endMask`) | 7623c77e |
| 2 | "a phone is told apart from a desk, and the curtain stands down on it" | test | it read `if (narrowLayout()) return stackShapes(` in the glass family; E54 G3/G5 (cc519fd0 onward) split it into glass.mjs `curtainPage` (`narrowLayout() ? { narrow: true, ...stackPage(`) and glass-geometry.mjs `curtainShapes` (`return page.narrow ? stackShapes(`) | the rule read as both lines | 7623c77e |
| 3 | E40-T3 "every action's tile and its press agree ..." | test | the one disagreement: "eclipse/move: tile eclipse, press null". E103 (ea33c4fe, the owner's decision of 13.11.2026) removed the Move tile and `actionButton`'s Move branch; the press passes an Eclipse on purpose (action-rolls.mjs: the crossing is `judgeEclipseCrossing`'s) | Move left out of the matrix while `ACTION_GRID` has no Move; an `ok` fails if a Move tile comes back | 7623c77e |
| 4 | new: "a season reset while a mask stands gives the killer's tokens their look and their player's microphone back, and leaves no mask" | module | season-wipe.mjs `wipeSeason`: the cut (`setClock(resetCutPatch(...))`) took the `masks` row (group `actions`) with the tokens' look in it | before the trial's microphones are released and before the cut, with `actions` ticked, every standing mask is ended by mask-gm.mjs `endMask` | red 7623c77e, fix 2b43ffde |

Item 4, measured (not only read): with `actions` alone ticked, the reset left `{"masked":1,"muted":false,"row":false}` -
the killer's token still "?" with the mask's flag and no row to give it back. The microphone came back: the reset's
release step (`settleTrialVoices({ release: true })`) gives every block back before the cut. So of the two outcomes read
off the code by t2-restore, the token one is real and the microphone one did not happen in this run.

## Readings

All `node run-tests.mjs` in audit/harness, 14.11.2026. "6dd02975" means 6dd02975 with 7623c77e's test file applied
(a worktree, `DRPG_REPO`), module code as it was.

| Run | Tree | Result |
| --- | --- | --- |
| `--tier 2 --only` items 1-3 | 4a0e8fe3 (before the change) | 3 failed (the three reasons above); 13.6 s wall |
| `--tier 2 --only` items 1-3 | 4a0e8fe3 + test edits | 3 passed; 12.2 s |
| `--tier 2 --only` item 4 | 7623c77e (red) | 1 failed: `{"masked":1,"muted":false,"mutedBefore":true,"row":false}`; restore check green |
| `--tier 2 --only` item 4 | 2b43ffde | passed; restore check green; 10.5 s |
| `--tier 2 --only` items 1-4 together | 2b43ffde | 4 passed, 0 failed |
| `--tier 2 --only` items 1-4 together | 6dd02975 | items 1, 2, 3 passed; then "could not restore the world after E40-T3" (the mask leak t2-restore fixed: PlayerOne's BROADCAST_AUDIO, Aiko's token "?"), and item 4 failed with `muted: true` after that leak |
| `--tier 2 --only` item 4 alone | 6dd02975 | failed: `{"masked":1,"muted":false,"mutedBefore":true,"row":false}` (the module bug) |
| related: `--only "reset" --only "E42-T" --only "mask"` | 2b43ffde | 112 ran: 114 passed, 1 failed, 1 skipped (env.cascade); the failure is "grid XI06" `[I2] ... names the killer null`, the t2-restore line's, red on 6dd02975 too; 215.8 s |
| `--tier 2 --only` items 1-4 together | a24a21d9 (merged with t2-restore c358be83) | 4 passed, 0 failed |
| `--tier 1` | a24a21d9 | 1617 ran, 1602 passed, 0 failed, 16 skipped, 0 red; 543.2 s wall |
| `npm run quick` | a24a21d9 | green (lint 19.8 s, check 22 parts 73.5 s, gate 37/37) |

Not run: a full tier 2 (84 min).

## Questions, each with the default taken

1. **A restore that brings a mask's row back does not settle the microphone** (the `masks` row has no `afterRestore`,
   eavesdrops' has one). Read off the code, not measured. Default: left as it is; the next voice settle reads the row.
2. **A reset that keeps `actions` but cuts `trialProgress`** gives the mask's block back (the release step) and nothing
   writes it again until the next settle. Read off the code, not measured. Default: left as it is.
3. E40-T3's name still says "for every key of ACTIONS"; the comment says why Move is out. Default: name kept, so the
   suite's list and its shards' hash do not move.

## Needs a local Foundry

Nothing new. Item 4's reset at a real table is the same road as LIVE-E69-05's mask; not built here.
