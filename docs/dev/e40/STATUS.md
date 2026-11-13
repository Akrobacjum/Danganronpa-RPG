# E40 - status (the work line of E39 and E40)

Updated 13.11.2026. The plan is `docs/dev/plans/E40.md` on the planner's branch `plan-130` (read whole). Same branch as
E39 (this branch), same R range R5100-R5199, same rules. E39's commits are below this file in the branch; E40 starts
at C1 here. Scenario 18-trial (the README's planned row) is this stage's, as is any new tier-2 test (named, not
R-numbered).

## The plan's own status, and the default taken

As with E39, the owner moved E40 out of the plan on 25.10 (its Q-E40-1). The coordinator assigned it to this line, so
the line builds behaviour tests the verification chat can keep; **default taken, owner to confirm**. The plan's six work
items (its section 3) are large; they are built as commits as far as this line reaches, and what is not reached is named
below under "Waits for / not built".

## Done

| Commit | What | Where |
| --- | --- | --- |
| C1 (3752cc66) | tier 2 **E40-T1**, DC36: a wrong verdict in the Class Trial sentences the accused (`verdict.sentenced`) but kills nobody, its card saying the execution waits (`executionPending`); `executeAtExit` at the trial's close executes once and stamps `executedAt`. Two states of the one actor, alive then dead | scripts/tests-tier2.mjs |

## Mutants (the plan's item 6, so far)

| Mutant | Check | Verdict |
| --- | --- | --- |
| trial-progress.mjs `sentenceOf` returns null | E40-T1 | KILLED (the close kills nobody; the accused stays alive) |
| verdict.mjs's card drops its classTrial branch (always `executionNow`) | E40-T1 | KILLED (the verdict's card reads as if the execution happened now) |
| vote.mjs `ballotRefusal`: a name twice allowed | the older vote tests (48 run by "ballot"/"vote") | KILLED by "a ballot naming one student twice or too many or of a round gone is refused and told" |
| `ballotRefusal`: another round's ballot allowed | the same | KILLED by the same test |
| `ballotRefusal`: the wrong number of names allowed | the same | KILLED by the same test |
| `ballotRefusal`: a name off the ballot allowed | the same | KILLED by the same test |

A test written for the four ballot rules (E40-T2, 13.11.2026) was dropped before it was pushed: the mutants above
showed the older test already fails on each of them, so it measured nothing new but that a player's second legal
ballot replaces the first. The comment it carried at first said the four lines were measured by nothing; that was a
guess from a `git grep` on the refusals' words, and the mutants showed it wrong.

## Bugs found

None.

## Test results

- Baseline tiers 0-1 at 421f2395 (E39's): 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red.
- Before the push, at 3752cc66: tiers 0-1 whole 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red (386 s); E40-T1 by
  name 1 ran, 0 failed (9 s); 63-class-trial (the trial driven end to end) green, 114 s. No scenario reads
  tests-tier2.mjs by name (`git grep`); 01-runtests runs it whole in CI's shards.

## CI

- Run 523 (9b6f8c98, E40 C1): red on suite shard 2/8 alone - tier 2 "E60-T14 - the dice look read by each browser of
  itself", a test this line did not touch; every other job green. E40-T1 shifts which shard each later tier-2 test is
  dealt to. Not reproduced: E60-T14 alone green (12.6 s), and shard 2/8 of that same commit run here
  (`DRPG_REPO` at 9b6f8c98, `DRPG_SUITE_SHARD=2/8`) green, 196 passed, 0 failed, 1 skipped (619 s). One local run of
  the shard, under other harness load: not proof that it is a flake, only that it did not fail again. Its message was
  in the run's artifact, which this container could not download (the storage host refused). Watched on the next push.

## Waits for / not built on this line yet

The plan's items 2-6, in its order, with what each would take:

- **checkState() in `game.drpg`** (item 2): new GM-only production code, warning-only at start, English console text. A
  state invariant guard; red-first per the owner's policy. Not started - it is the stage's largest new surface and is
  best built with its own commit and mutants.
- **The phase x action matrix** (item 3): a shared "allowed now" predicate built around `MODE_RULES` and `modeAllows`
  (trial-floor.mjs) without changing their answers, plus `passage.*` and `action.frisk*` (the A10/A11 amendments). The
  predicate is new production code; R1023 already holds `modeAllows` to the three functions on the trial modes.
- **18-trial** (item 1): the trial scenario on a FLOWS list with `playerLeakScan` after every step; the plan's amendment
  calls it 18-trial with flows from 63, 66, 67. 63-class-trial already drives most of the trial end to end; 18-trial adds
  the shared leak scan as an invariant and the DC36 steps (C1 covers DC36 headless in tier 2).
- **The regex tests** (item 4): the ~50 tier-0 tests that match behaviour by regex become function calls, each broken
  once before and after. A mechanical, low-risk group once counted (the plan's Q-E40-3: the tree's counts, re-counted
  when the work starts).
- **settle() -> until()** (item 5): where a read crosses a client, a hook or a chat card.
- **The 12-rule mutation run** (item 6): built as a file outside the repository, 12 of 12 FAIL, then into the gate (the
  gate wiring is `tools/stages.json`'s, which this line may not touch - the coordinator registers it; this line hands
  the run's definitions and results).

## Questions for the owner

- Q-E40-1, Q-E40-2, Q-E40-3: defaults taken, owner to confirm.

## Tokens so far

Not measured by this session.
