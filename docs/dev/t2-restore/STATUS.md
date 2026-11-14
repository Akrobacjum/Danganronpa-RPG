# t2-restore - a tier 2 test leaves the world dirty (for 1.2.113)

Branch `claude/t2-restore-113`, from `claude/fervent-sagan-gme4vt` at 6dd02975. 14.11.2026. Headless (audit/harness), 4 cores.
No R number taken: the fix is the suite's own restore, and its check ("could not restore the world") is the red.

## What started it

- `node run-tests.mjs --tier 2 --only "a Reroll of a critical Strike"`: red on 6dd02975 (PlayerOne's
  BROADCAST_AUDIO (none) -> false; Aiko's token `masked`, name "?", ring, name and bars off), green on origin/main ceb9e9c8.
- `git bisect --first-parent` over the 83 commits between them: the first red is **ad89e657**, the merge of
  claude/fix-113o (E69 C6-C8) into the 1.2.113 assembly - E69 C8's mask (scripts/mask-gm.mjs, its commit 04b62b02).
  The fixo branch's own commits were not bisected one by one.

## The cause

`swingFixture` opens its incident with a 24 on Hope, which since E69 C8 masks the killer. The mask outlives the incident
by design (docs/dev/e69/STATUS.md), so the runner's `endMurder` leaves it, and `restore()` then writes the GM stores' keys
back raw, which drops the `masks` row that held the tokens' look: nothing is left that could give the look or the
microphone back. Not a module fault: the test's restore missed what the module does by design. Every run's first test
through `swingFixture` (38 tests) reported it, and the later ones masked a token already masked, so their diff was reported
once.

## The fix (scripts/tests-tier2.mjs)

1. 8f8aed2b: `snapshot` records the masks standing (`masks`), and `restore` ends each mask not among them by the
   module's own `endMask`, before the stores go back.
2. b6c61ced: that end moved before `setClock`. Placed after it, a test that moved the time of day had the mask ended by
   the hook as well (`masksAtNewTimeOfDay`, not awaited), and that end's `gmTrialMute` drop landed after the stores' write
   ("the case's Key count outlives the incident's close": `gmTrialMute...d.USERP10000000000 (none) -> #e0978d3c`, 1 run).
   And `unmaskedAfter`: two tests open their incident inside `withGmStoreWorld`, whose mask row `restore` cannot reach
   ("a GM that never saw the incident closes it clean", "the cast comes back by hand when this browser lost it"); each
   now ends that world's masks before it leaves it.

The restore check itself is unchanged.

## Readings

| Run | Commit | Result |
| --- | --- | --- |
| `--tier 2` (full: tiers 0-2, 3157 tests) | 8f8aed2b | 3086 passed, 52 failed, 27 skipped, 0 red; 5021 s wall. 4 "could not restore" (the 3 fixed in b6c61ced, and "a season reset clears the case's Key count", clean in both runs on b6c61ced; why it leaked on 8f8aed2b was not read) |
| the 52 names that failed, `--tier 2 --only` each | 6dd02975 | 8 passed, 51 failed (3 of them "could not restore") |
| the same 52 | 8f8aed2b | 8 passed, 52 failed (4 "could not restore") |
| the same 52 | b6c61ced | 10 passed, 46 failed, **0 "could not restore"**; E69-T5 and E69-T7 pass in this order (they failed on 6dd02975 after the masks leaked before them) |
| `--tier 1` x3 | 8f8aed2b | 491.9, 502.1, 499.4 s wall; 1617 ran, 1602 passed, 0 failed, 16 skipped, 0 red each |
| `--tier 1` | b6c61ced | 1617 ran, 1602 passed, 0 failed, 16 skipped, 0 red; 507.5 s wall |
| `npm run quick` | b6c61ced | green |

Not run: a full tier 2 on b6c61ced (84 min, past the line's deadline). What b6c61ced changes over 8f8aed2b is measured on
the 52 names alone.

## Found, not fixed: 46 tier 2 failures that were already on 6dd02975

Each fails the same way on 6dd02975 (the subset run above). They look like older tests that E69 C6/C8 contradicts; not
read further here:

- 42 `grid` cases (DM02-DM22, TP01-TP15, XI01-XI09 as listed in the run): `[I2] - I2 at step N (opening hope): PlayerTwo's
  copy names the killer null, the model's Aiko Hoshino`. The grid's model does not know that a masked killer's cast copy
  holds no killer (incident-store.mjs `castCopyFor`).
- "a direct murder's victim is told who is moving on them, a trap's victim is not": the victim is told "Someone is moving
  on you" (E69 C8's whisper).
- "Back up the case, then Restore, brings every store back": "these stores are backed up and this test has no fixture for
  them: eavesdrops, masks" (E69 C6, C8's new stores).
- "a phone is told apart from a desk, and the curtain stands down on it" (16 blocks off their pane, 206 edge gaps at
  820 x 1180) and "every action's tile and its press agree ... (E40-T3)": cause not read.

These make a full tier 2 red, so the 1.2.113 release stays red until they are dealt with.

## Found, read but not measured

The season reset's `actions` group cuts the `masks` store, and its `trialProgress` group cuts `gmTrialMute` (gm-stores.mjs).
A reset while a mask stands may therefore leave the killer's tokens a "?" and their player's BROADCAST_AUDIO blocked, with
no row left to give either back. Read off the code only; no run of a reset with a standing mask.

## Second item: tiers 0-1's bound (b8a3eae8)

`READ_ONLY_MS` (scenarios/01-runtests.mjs) and `EVAL_MS[0/1]` (run-tests.mjs) 560 s -> 850 s, kept equal: 1.5 times the
slowest reading, the 566 s bound T13a hit counted as a reading (849, rounded). Nothing else assumes 560 s: run-all's
`SUITE_TIMEOUT_MS` 108 min, run-all reads only scenarios/, run-tests.mjs's process timer is EVAL_MS + 5 min, ci.yml's suite
jobs 115 min. The repository guide's tier 1 row (200-212 s) is stale; that file is not this line's to edit.
