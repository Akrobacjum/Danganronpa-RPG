# E39 - status (the work line of E39 and E40)

Updated 13.11.2026. The plan is `docs/dev/plans/E39.md` on the planner's branch `plan-130` (read whole, with its
README); base origin/main at 421f2395 (1.2.109). Reserved R numbers R5100-R5199; scenario 70 (the README's planned E39
row) and 99 (the coordinator's) are this stage's.

## The plan's own status, and the default taken

The plan says the owner moved E39 out of the plan on 25.10 ("tests, measurements and verification are done at the end by
a separate chat"), and its Q-E39-1 proposes that it does not stay on the release line. The coordinator assigned it to
this line, so the line builds it; **default taken, owner to confirm**: what this stage writes is material the
verification chat can keep, extend or drop. Q-E39-2 (the twelve partial FLOWS rows keep `stage: "E39"`): **default taken,
owner to confirm** - kept; the rows this stage drives name its scenarios and stay partial (a row turns `covered` with the
release it arrives in, which the coordinator assigns). Q-E39-3 (where the world writes run): every write here is on the
harness's seeded world, put back in each scenario's `finally`; no real world is written.

The plan lays out no commits C1..Cn, only five work items (its section 3). They are built as C1-C5 below.

## Done

| Commit | What | Where |
| --- | --- | --- |
| C1 (0ec727b6) | **70-movement**, the planned row: a refusal that names no undiscovered room; a route's last leg vetoed past the budget, the room paid for kept; ten crossings at once over three pages, each paid exactly once; the GM's Refund at the exact price, a second refused; an Afternoon Eclipse's allowance, the crossing past it refused on the mover and, from a console past its own veto, put back. LIVE-E39-01 added to AUDIT 9.2 | audit/harness/scenarios/70-movement.mjs, README row 70, tests-flows.mjs (two rows name 70), AUDIT-1.2.42.md item 512 (507 at first; 508 after the merge of main at 984d1fb1, whose LIVE-E64-01 took 507; 512 after the merge of a2b233d2, whose E102-E106 items came before it) |
| C2 (6a243316) | **99-actions**, the plan's driveAction: every row of `ACTIONS` driven from p1's page; a census that fails on a row without a driver; each row's price; every row with thresholds (Search, Projects, Listen, Sabotage) at one below each band, at each band and on a critical, against config.mjs | audit/harness/scenarios/99-actions.mjs, README row 99, tests-flows.mjs (action-roll names 99) |
| C3 (8b1f3445) | tier 2 **E35-T10** holds every mode of `TRANSFER_POLICY` to a road it drives (a census, then each mode into full hands with a stash read against the policy itself); at HEAD a sixth mode `lend` passed it unread | scripts/tests-tier2.mjs |
| C4 (fbb29935) | tier 2 **E39-T1**, the one project entry's cases on fresh projects: null for no project, an empty change and a removed one; +1; a fill crossing once; a full bar renamed not crossing again; alreadyFull and alreadyEmpty; uncrossing; the clamp at both ends; a lowered target crossing; a name and a room; a frozen bar refused; a target of 0 written as 1 | scripts/tests-tier2.mjs |

## In progress

- Nothing open in code. C5 (the mutants, the plan's item 5) is the table below; the stage's ledger is this file.

## Coverage of the plan's list (where each item is answered)

The plan's list, item by item, with the test that answers it. Most items were already answered by earlier stages' tests;
this stage did not write them again.

| Plan item | Answered by | New here |
| --- | --- | --- |
| a vetoed last leg | 70 leg; 66 W (c) (one action, two crossings, pending waypoints) | 70 |
| the Eclipse limit | 70 eclipse; tier 2 E17-T4 (the GMs' count, a console's crossings) | 70 |
| 10 parallel moves with exact sums | 70 parallel | 70 |
| a room of two regions with a lock | 66 D (V4, C2a) | - |
| Teleport and a player's region are not rooms | 66 C (Teleport), 66 J (p1's region) | - |
| Levels and stairs | 66 G (the shim's model; LIVE-E12-02/03), now LIVE-E39-01 for the calibration | - |
| falsified x and y with sendBack | 66 I, 76 D (the GMs' audit, `sendBack`) | - |
| trial-room tokens without veto or fees | 41 b1 (the hall holds no room) | - |
| Refund at the exact cost | 70 refund; 88 Refund; tier 2 E17-T6 | 70 |
| a refusal that does not name an undiscovered room | 70 unknown; 60-ledger (`notConnectedText`) | 70 |
| passages in walls, `passage.cross`, stairs with fee and Eclipse (A10) | 76 C, D, U; tier 2 E17-T4's tunnel rows | - |
| Zones regions not rooms; a Zones move runs nothing (E70, E73) | 41 b1, 68 C | gap: no check reads every one of veto, fees, fog, Eclipse, Remnants, auditMove, sentBack, passage.cross on a zone move |
| Frisk in both modes (A11) | 40-flow (frisk-openly), tier 2 A11-7, A11-8 | gap: 99 drives Palm alone (refused, no one in the room), not its Frisk modes |
| every transferItem mode | R951; tier 2 E35-T2..T5, T8, T10 | C3: E35-T10's census and policy reading |
| drawItem on the tables, PL and EN | tier 2 at "is put over config.mjs the way `localizeConfig` puts it" (one browser, both halves), E14-T14 | - |
| driveAction over ACTIONS | 99 | 99 |
| a roll under the threshold, at every boundary, a critical | 99 bands (Search, Projects, Listen, Sabotage) | 99; gap: Analyze's Find Stash and Find Passage (16) are priced, not banded |
| 14 project cases from the S09 list on applyProjectChange | tier 2 E36-T2..T11 (the one entry, its queue, its roads), E39-T1 (15 cases of the entry's answers) | C4. The S09 list is not in this checkout (the plan's "Not read"); **default taken, owner to confirm**: E39-T1's cases are the ones changeStep's header states |
| shim calibration against one real v14 move | - | LIVE-E39-01 (waits for a v14 sandbox) |

## Mutants (the plan's item 5)

Each on a copy of the tree (`DRPG_REPO`), the check named run on it; a definitions file and runner outside the
repository. KILLED = the check failed the way it was written to.

| Mutant | Check | Verdict |
| --- | --- | --- |
| veto: crossingVerdict's noBudget refusal turned into a pass | 70 leg | KILLED |
| Eclipse limit: the mover's veto, eclipse.mjs's count and movement.mjs `eclipseSighting`, all three turned | 70 eclipse | KILLED |
| Eclipse limit: each guard alone, or the GM's two together | 70 eclipse | SURVIVED - the limit is held four times (the mover's veto, the mover's charge `judgeEclipseCrossing`, the GMs' count, the arrival judge); the console check fails with the last three turned together. Tier 2 E17-T4 reads the GMs' count alone |
| refund: "given back already" removed | 70 refund | KILLED |
| an undiscovered room named in the refusal | 70 unknown | KILLED |
| a config threshold's comparison (`resolveThreshold` >= to >) | 99 bands, four rows | KILLED |
| Search's critical tier bonus dropped | 99 bands: search | KILLED |
| Listen's named band moved off the table | 99 bands: listen | KILLED |
| a critical Work's refund dropped | 99 bands: project | KILLED |
| the rifle limit (once a time of day per stash) removed | tier 2 E14-T5 | KILLED |
| a trap's "one alert, then quiet" removed | tier 2 "a trap watches, fires once" | KILLED |
| a sixth mode `lend` added to TRANSFER_POLICY | tier 2 E35-T10 (C3) | KILLED; SURVIVED at HEAD before C3 |
| a project's clamp `Math.max(0, ...)` dropped | tier 2 E39-T1 | KILLED |
| the crossing's `!wasDone` dropped | tier 2 E39-T1 | KILLED (SURVIVED the first draft; the full bar renamed added for it) |
| the frozen bar's check turned false | tier 2 E39-T1 | KILLED |

## Bugs found

None: every behaviour driven here held. One reading recorded instead: a project's target of 0 cannot be asked for -
`cleanProjectChange` writes 1 (`Math.max(1, ...)`), so changeStep's header "a target of 0 is never reached" describes no
project the entry makes or changes (E39-T1). Not changed: it reads as intended; the header's sentence is the owner's to
keep or drop.

## Test results

- Baseline at 421f2395: tiers 0-1 whole 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red (436 s).
- 70-movement 7/7 (21 s); 99-actions 9/9 (124 s), alone.
- Before the first push, at 6a243316: tiers 0-1 whole 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red (408 s); the
  scenarios that read the changed files, each `run-all.mjs scenarios --only NN`: 88 (imports tests-flows.mjs) green
  73 s, 70 green 26 s, 99 green 126 s. `node tools/check.mjs` 17/17, lint 0 problems, prose missing 0 extra 0. No tier-2
  test changed in C1-C2.

- Before the second push, at fbb29935: tiers 0-1 whole 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red (441 s); own
  tier 2 by name - E35-T10, E39-T1, and E36-T2, E36-T3 beside them - 5 ran, 0 failed (28 s). No scenario reads
  tests-tier2.mjs by name (`git grep`); 01-runtests runs it whole in CI's shards. The first push (C1, C2 and the STATUS)
  went with "[skip ci]" on its head commit, so this push is CI's first run of C1-C4.
- CI run 522 (a00b3967, C1-C4 and STATUS): green, every job - lint, check and gate, the suite's eight shards and
  their merge, the scenario buckets with 70-movement and 99-actions in them.

## Gaps left (named, not built)

- A move between the trial hall's zones read for every step it must not run (veto, fees, fog, Eclipse, Remnants,
  auditMove, sentBack, passage.cross): 41 b1 and 68 C read the hall as no room and no crossing, not each of these.
- Palm's Frisk modes driven from 99 (99 drives Palm alone, refused with nobody in the room).
- Analyze's Find Stash and Find Passage at their flat 16: 99 prices Analyze, it does not band them.

## Waits for

- LIVE-E39-01 (a v14 sandbox): the shim's `movement.pending.waypoints` and `Region.levels` calibrated against one real move.

## Shots

None: nothing visible changed (tests and documents only).

## Questions for the owner

- Q-E39-1, Q-E39-2, Q-E39-3: defaults taken above, owner to confirm.
- The S09 list for the 14 project cases: not in this checkout; E36-T2..T11 stand for it until it is handed over.

## Status

E39 is done on this line: C1-C4 pushed, CI green (run 522). What is open is named under "Gaps left" and "Waits for".

## Tokens so far

Not measured by this session (no counter is available to it).
