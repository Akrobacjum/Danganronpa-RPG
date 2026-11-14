# E56 part 1 - status (line claude/e56-p1-113)

Base: claude/fervent-sagan-gme4vt at 123f8242. Updated as the line goes, so a restart loses nothing.

## Measured on 123f8242 (14.11.2026)

- `no-unused-vars` with `args: "none"`, `varsIgnorePattern: "^_"` (ESLint 10.11.0, the harness's, over the whole
  repository as `npm run lint` reads it, 394 files): **96**. With `ignoreRestSiblings: true` as well: **74** (22 are the
  omit-by-rest idiom, `const { a, ...rest } = x`). `caughtErrors: "none"` would take 2 more off; not used: the two
  `catch (err)` with no read become `catch {`.
- Other lint problems: 0 (no-undef 0).
- Finders (tools/e56, self-checks green), on 123f8242: keys 5794, 0 dead, 834 unsure (under 160 builder prefixes read
  off the code), 186 read only by tests, 95 foreign; exports 13 dead, 229 own-file only, 5 unsure. On 1463f22b (before
  E54's cuts): the same key counts; exports 13 dead (the same 13), 227 own. New after E54: own-only `HUG`, `PAD_SIDE`
  (glass-geometry.mjs:112) and `VOICE_FOOT` (glass-blocks.mjs:10), each in one `export const` of several names whose
  other names are read elsewhere: left (splitting a statement is not the smallest change), listed for part 2.

## Items

| Item | State |
| --- | --- |
| 1. no-unused-vars to 0, an error | done: 5462e800 (module, 20), 0d3d1a0b (tests, 37), e08350d8 (audit and tools, 17), 7074b15d (the rule on; run-all's lint part plants an unread name in its six folders, red without the rule) |
| 2. the keys guard | done: 30df2afb, `node tools/check.mjs keys` (tools/keys-lint.mjs), red with a planted unread key in lang/en.json, green on the tree (0 dead of 5794) |
| 3. what E54 left dead | measured, nothing removable (above) |
| 4. NOTES-113.md | written; a comment policy draft beside it (COMMENT-POLICY-DRAFT.md) |

## Tier 1 after each area (`node run-tests.mjs --tier 1`, audit/harness, this machine, 4 cores)

| Tree | Passed | Failed | Skipped | Red | Wall |
| --- | --- | --- | --- | --- | --- |
| 123f8242 (base, DRPG_REPO) | 1595 | 1 (R2001) | 16 | 0 | 535 s |
| area 1 | 1595 | 1 (R2001) | 16 | 0 | 550 s |
| area 2 | 1594 | 2 (R2001, R4420) | 16 | 0 | 550 s |
| area 3 | 1595 | 1 (R2001) | 16 | 0 | 563 s |

| 7074b15d (the rule on), DRPG_REPO worktree | 1595 | 1 (R2001) | 16 | 0 | 555 s |
| 642d249b (the tip), DRPG_REPO worktree | 1595 | 1 (R2001) | 16 | 0 | 501 s |

The tip in the main checkout timed out twice (566 s and 567 s wall; "eval timeout on gm" at run-tests.mjs's 560 s
bound for tiers 0-1, so 0 tests counted), both after six scenarios had written their results there. From a clean
worktree of the same commit it ran in 501 s, and e08350d8 from a worktree in 538 s. Which part of the main checkout
costs the time was not measured; the suite runs near its bound on this 4-core machine either way (501-563 s passing).

Scenarios touched by area 3, on the tip (`node cluster.mjs scenarios/<n>.mjs`): 14-quiet 8/8, 40-flow 89/89, 71-sheet
42/42, 76-passages 118 passed and 1 expected red, 87-messenger-sound 36/36, 98-chaos 9/9; each exited 0.

R4420 after area 2: `release` read false once, while an ESLint run over the base worktree loaded the machine; alone
(`--only R4420`) it passed, and it passed in area 3's full run. Read as timing under load, not as this line's change.

Tier 2, the 22 tests area 2 touched and the reshape tests (`--tier 2 --only ...`): 56 passed, 1 failed - "could not
restore the world after 'a Reroll of a critical Strike keeps the striker's pick'" (Aiko's token left masked, PlayerOne's
BROADCAST_AUDIO false). The same on 123f8242 alone: pre-existing; the coordinator gave it to claude/t2-restore-113.

## Questions, each with the default taken

- Q-P1-1: `ignoreRestSiblings: true` beside Q-E56-1's two options? Default yes (accepted by the coordinator, 14.11).
- Q-P1-2: does a key read only by a test count as read, for the keys guard? Default yes for now (186 such keys); part 2
  reads them.
- Q-P1-3: a key under a builder's prefix passes unread (834 under 160 prefixes): resolve each builder in part 2, or
  ratchet the count? Default: part 2 reads the builders; no ratchet now, since four lines merge into lang/ at once.

## Part 2

- The 834 builder-covered keys and the 186 test-only keys (`node tools/keys-lint.mjs --list`).
- The 13 dead exports the finder lists on 123f8242 (also dead before E54; each to be proved per name, as C6-C8 did:
  MEASURE.md shows the finder missed roads before), and the three own-file names HUG, PAD_SIDE, VOICE_FOOT.
- The comment sweep C2-C9, as planned.

## Needs a local Foundry

Nothing in part 1 needs one.
