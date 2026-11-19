# E39 - status (the work line of E39 and E40)

Updated 14.11.2026 (the line claude/e39-43-113, base 1463f22b; before it, 13.11.2026). The plan is `docs/dev/plans/E39.md` on the planner's branch `plan-130` (read whole, with its
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

### The line claude/e39-43-113 (14.11.2026, base 1463f22b, R block R6200-R6299)

| Commit | What | Where |
| --- | --- | --- |
| 30a10b5b | **68 M**, a move between the trial hall's zones: a Straw Poll open, the movement cost on, p1 drags Aiko from Zone A into Zone B - no warning and the token where p1 put it on every browser (veto, send-back), her actions, free Move and grants unchanged (fee), no GM store of the primary changed, compared whole (fog `discovery`, `crossings`, `eclipseMoves`, `remnants`, `passageLog`, `passageAccess` among them), no token or card made, no auditMove row, no crossing packet on the wire (move.sentBack, passage.cross, eclipse.move, remnant.place, token.refundCrossing), and the one document write p1's token update. An Eclipse cannot run in a trial, so the Eclipse step is read as its store and its packet, not as a live Eclipse | audit/harness/scenarios/68-trial-zones.mjs |
| d2aa9d17 | trial-zones.mjs's header named a tier-2 test "E73 C2: a move between the zones" that the suite never held (`git grep`, 14.11); it names 68 M now | scripts/trial-zones.mjs (a comment) |
| c5840f11 | **99 flat**: Find Stash and Find Passage at 15, 16 and a critical under 16, with a target to find (Daichi's stash concealed in Dorm A, a tunnel with an end on Aiko's spot), read where the primary writes the find, each at Analyze's cost. **99 frisk**: Botan beside Aiko with a marked comb; Unseen at Shadow 14/15 x Hand 9/10 and both critical, Openly allowed, and refused then forced at Body 11 and 12, read on the GM's cards on p1 and p2 | audit/harness/scenarios/99-actions.mjs |

Mutants of this line (each on a copy of the tree, `DRPG_REPO`, the scenario run whole on it):

| Mutant | Check | Verdict |
| --- | --- | --- |
| rooms.mjs `roomPieces` counts the hall's regions as rooms | 68 M | KILLED by M2 (the trial's veto refused the move) and M6 |
| the same, and crossingVerdict's trial lock removed | 68 M | KILLED by M3 (free Move used), M4 (`crossings`, `sheetMarks`, `discovery` changed), M6; M5 not failed by it (a lawful crossing sends no audit row or crossing packet), so M5 is seen to read, not to fail |
| stash-reach.mjs `resolveStashSearch`: `>=` the stash number to `>` | 99 flat | KILLED (stash at 16 not found) |
| passages-gm.mjs `resolvePassageSearch`: `>=` to `>` | 99 flat | KILLED (passage at 16 not found) |
| frisk.mjs `friskPerson`: the hand's `>=` to `>` | 99 frisk | KILLED (cover-1/hand, cover/hand); p1's own outcome said success while the GM's card said the miss, so the check reads the GM |
| `friskPerson`: the cover's `>=` to `>` | 99 frisk | KILLED (cover/hand-1, cover/hand) |
| frisk.mjs the force's `>=` (`ACTIONS.palm.frisk.threshold`) to `>` | 99 frisk | KILLED (openly, forced at 12) |

### The line claude/shim-118 (17.11.2026, base a1d294ef merged with claude/e58-local 9c917495, R block R7740-R7779)

The shim brought to what Foundry 14.370 did, as E58 L1 read it on the owner's sandbox (`CALIBRATION.md`), one D a
commit, each red first in 00-boot; AUDIT 9.2 rows 640-657 (LIVE-E39-02 to -19).

| Commit | What |
| --- | --- |
| 9a8e4f0c | D4, a token's move: one update per route, its grid steps in `options._movement[id]`, `_regions` and `_priorRegions` |
| 67d525f6, 224f99a2 | movement.mjs: a route judged leg by leg and charged room by room; every put-back through `putBackWrite` with `diff: false` |
| c803e68a, 909dc019 | D5, Levels as an embedded collection with `defaultLevel0000`; passages-gm.mjs `floorNamed` |
| 5b9269ba | D3, the update diff: on the writer against its copy, on the server for the hooks |
| b17b9867 | D6, a role change logs the user out |
| a90a0dc4, 1c3a7b3a, 8a6fcd33, 20746544 | the mark fix (choice A): a GM's own write the diff drops moves the GMs' mark (`noteOwnWrite`, `noteOwnDropped`), R7744's census of the bare roads |
| 4c407e78 | D10, a GM announced as its socket connects |
| d84481ee | the merge of L1's 0e70bfe3: the move defined on the caller's options (D11), one implementation with D4 |
| d57f754a | the merge of L1's d5907e1b: an owner kept against a deletion (`keepOwners`) before the server's diff, one implementation with D3; scripted dice |

**Proposed, not built: a D for a chat message's rolls** (18.11.2026; the coordinator's word on the Reroll tests: "write (A)
up as a proposed D in STATUS, not built"). Headless a message's `rolls` is plain JSON with no `terms` (lib/shim.mjs
`ChatMessage#rolls` parses `_source.rolls`), and the module's own throw hands the harness the same; on v14 it is Daggerheart's
`DualityRoll`, rebuilt by its class (L1 read a roll of 5 terms). So a test can reroll a real roll only at a table, and tier 2's
`rerollableRoll` keeps two roads: the message's real roll at a table, the suite's `SuiteRoll` headless. **The D**: the
harness stores the roll Daggerheart's own `toJSON` gives, and `ChatMessage#rolls` answers Roll instances by their class
(`CONFIG.Dice.rolls`, `fromData`), as v14 does; then `rerollableRoll` keeps one road, and `SuiteRoll` goes. **Its reach**:
every module road that reads a roll headless meets a real Roll where it read JSON - reroll.mjs `rollAsThrown` and its JSON
road, private-rolls.mjs, roll-draw.mjs, the despair award - so it is its own D, red first in 00-boot, with every scenario and
the eight shards, as D3-D6 were.

**Before every push that touches `scripts/`, tier 1 runs whole** (`node run-tests.mjs --tier 1` in audit/harness), not
only the tests by name - the coordinator's rule of 17.11.2026. Why: a90a0dc4's `noteOwnDropped` read a mode predicate
R1470 keeps out of sheet-audit.mjs, and tier 1 stood red from a90a0dc4 to d84481ee, pushed, because that fix's runs were
the tests by name, `npm run quick` and scenarios 30, 61 and 83; the final gate's tier 1 found it (1759 passed, 1 failed),
fixed in 20746544.

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

- The three gaps this file named on 13.11 are closed on the line claude/e39-43-113: 68 M, 99 flat, 99 frisk (above).

## Needs a local Foundry

- LIVE-E39-01 (a Foundry v14 sandbox, one player's browser and a GM): one real drag of a student's token across two
  rooms with a waypoint, and one up a stair between two Levels, with the `preUpdateToken` options and the Region's
  `levels`/`includedInLevel` read off v14 and compared to what audit/harness/lib/shim.mjs models; then 70-movement and
  66 G run again on the shim as corrected.
- The trial hall's zones on a real v14 scene (68's local layer): a drag between two zones drawn on the canvas, with
  regions that have holes and Levels (LIVE-E73-01..04 name the same).

## Shots

None: nothing visible changed (tests and documents only).

## Questions for the owner

- Q-E39-1, Q-E39-2, Q-E39-3: defaults taken above, owner to confirm.
- The S09 list for the 14 project cases: not in this checkout; E36-T2..T11 stand for it until it is handed over.

## Status

E39 is done on this line: C1-C4 pushed, CI green (run 522). On claude/e39-43-113 (14.11): 68 M, 99 flat and 99 frisk, the
three headless gaps; what is left needs a v14 sandbox ("Needs a local Foundry").

## Tokens so far

Not measured by this session (no counter is available to it).
