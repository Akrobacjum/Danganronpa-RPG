# E64 - Balance and rules before 1.3.0: STATUS

Branch `claude/e64`, from `claude/fervent-sagan-gme4vt` at 3ccfde3e (the 1.2.105 line). Plan:
`docs/dev/plans/E64.md` on `claude/plan-130`. Reserved R numbers: R3950-R3999.

Every rule change below is a gameplay change the owner has not confirmed. Each takes the plan's proposed default
(section 5 of the plan), is marked "default taken, owner to confirm", and is its own commit, so one can be reverted
alone.

## The questions (C0) - defaults taken

| Id | Question | Default taken | State |
| --- | --- | --- | --- |
| Q-E64-1 | E53's balance log does not exist yet; where are before and after written? | Here: the "Before and after" table below; E53 imports it | default taken, owner to confirm |
| Q-E64-2 | E72's numbers ship on another line; review them here? | Review E68's and topic A/C numbers now; E72 reviews its own | default taken, owner to confirm |
| Q-E64-3 | S02-58: a Tamper attempt limit per time of day? | Yes, 2 attempts per character per time of day | default taken, owner to confirm |
| Q-E64-4 | DA39 on a world with past +1 Health / +1 Sanity picks | Keep what was taken; the new rule from the next Level Up | default taken, owner to confirm |
| Q-E64-5 | S02-75: the sabotage lever | No change before 1.3.0; logged for sessions 0 | default taken, owner to confirm |
| Q-E64-6 | The incident model (S18-05) is outside the repository; who reruns it? | The auditor's session, with the result quoted in the ledger | default taken, owner to confirm |
| Q-E64-7 | S02-57 Hope's armour on Role reversal | No change unless the rebuilt model moves lethality by more than 5 points | default taken, owner to confirm |

## Before and after (the balance log's entries, Q-E64-1)

One row per rule. "State" is "default taken, owner to confirm" for every row that changes a number.

| Item | Before (3ccfde3e) | After | Commit | Test | State |
| --- | --- | --- | --- | --- | --- |
| S05-60 fresh scene (C1a) | -3 on every clean-up threshold whenever no body was found and the phase was not Investigation or trial (a quiet afternoon: 6/9/12/15) | -3 only while an incident runs or a body of this chapter lies unfound (`CLEANUP.freshScene.onlyWith`); a quiet afternoon reads 9/12/15/18 | 629f52e | R3950 | default taken, owner to confirm |
| DA12 Tamper minimum (C1b) | reliefs stopped at 0 (Hidden, Tier 3 tool, fresh scene, reshape: 9 - 3 - 3 - 3 = 0) | never below 8 after every relief (`CLEANUP.minDc: 8`), on the GM's score and on the card | 383cf11 | R3951 | default taken, owner to confirm |
| DC5 Confusion (C5a) | first tier 12 (+1/-1): a hit, a double counted as critical, 94/144 = 65.3% | first tier 11: 104/144 = 72.2% (counted over the 144 throws of 2d12); 16 for advantage unchanged | ce58136 | R3952 | default taken, owner to confirm |
| Fisher-Yates in drawItem (C3, S17-29) | `sort(() => rng() - 0.5)`: chi-square over 24 orders of four, 24,000 shuffles, one fixed sequence: 27967.36 | utils.mjs `shuffle`, Fisher-Yates: 28.10 on the same sequence (23 df; 49.7 at p = 0.001) | 3c6383a | R3953, R1234 updated | default taken (D21), owner to confirm |
| S03-49 Wounded (C1c) | -1 action in every phase (Investigation and trial refills too: 1 of 2) | -1 action in Daily Life only (`STATES.wounded.actionsLostIn`); 2 of 2 in the Investigation and the Class Trial; the state and its badge stay | 91ff70f | R3954, R1160 updated | default taken, owner to confirm |
| S05-59 Observe critical hint (C2) | the hint was typed in the trace's description box, which is public: every later finder's copy read it | a box of its own on a critical; written on that finder's Truth Bullet alone | 7469197 | R3955 | default taken, owner to confirm |
| S02-58 Tamper attempts per time of day (Q-E64-3) | no limit | planned: 2 per character per time of day | - | - | not built yet |
| DA6/DA23 crisis defence (C5) | `crisisThreshold` reads `def.threshold` only | planned: `defense { side, trait }` on eight rows, `DEFENSE = { cap: 1 }` | - | - | not built yet |
| DA39 Level Up (C6) | options +1 Health, +1 Sanity, +1 statistic, +1 experience, new experience | planned: no +1 Health / +1 Sanity; a point in Head +1 max Sanity, Body or Leg +1 max Health; past picks kept (Q-E64-4) | - | - | not built yet |
| moveBody two rooms (C4) | `rooms.critical: 2` not read; destinations are the neighbouring rooms | planned: a critical reaches two rooms | - | - | not built yet |
| S02-75 sabotage lever, trap, Palm (Q-E64-5) | unchanged | unchanged before 1.3.0; logged for sessions 0 | - | - | default taken, owner to confirm |
| S02-57 Hope's armour on Role reversal (Q-E64-7) | unchanged | unchanged: the rebuilt incident model is outside the repository (Q-E64-6) | - | - | default taken, owner to confirm |
| DA11 trait ceiling | - | closed with no code (the owner's DA11) | - | - | owner's decision |

## The review (C7) - no number changed

The plan's C7 reads A10, A11, E68's Resolve and the topic C numbers against session 0's data of 26.10. That data
(the protocol) is not in this checkout (the plan's section 2 says so too), so nothing was read against it: the table
below records each number as the code holds it at 3ccfde3e, where it is, and that it is unchanged. No code changes
unless the owner answers (the plan's rule for C7). Q-E64-2's default: E72's own numbers are E72's to review.

| Number | Where (read 12.11.2026) | Value | Reviewed against data | Change |
| --- | --- | --- | --- | --- |
| Find Passage threshold (A10) | config.mjs `passageThreshold` | 16 | no - session 0's data not in the checkout | none |
| Secret Passage, Breach the Wall (A10) | the project presets, complexity Complex (`progress: 6`) | 6 | no | none |
| Frisk (A11) | config.mjs `frisk` / `rummage` | Body 12, Hand 10, unseen 15 (`rummage.unseen`; the plan calls it Shadow 15) | no | none |
| Resolve (E68, DA37) | config.mjs Hope Call `resolve` | 2 Hope | no | none |
| Confusion (topic C, DC5) | `MONOCUB.abilities.meddle` | 11 / 16 | the owner's own decision | changed in ce58136 (12 -> 11) |

## Done

Pushed to `claude/e64` (12.11.2026), each its own commit so one can be reverted alone:

- 629f52e C1a fresh scene (S05-60), R3950
- 383cf11 C1b clean-up minimum 8 (DA12), R3951
- ce58136 C5a Confusion 11 (DC5), R3952
- 3c6383a C3 Fisher-Yates in the draw (S17-29), R3953, R1234 updated
- 91ff70f C1c Wounded only in Daily Life (S03-49), R3954, R1160 updated
- 7469197 C2 Observe's critical hint for the finder (S05-59), R3955

## In progress

Built in a local worktree, being tested before they join the branch: C6 Level Up (DA39, R3956; 15 tier-2 tests and
scenarios 61, 63, 72, 83 pick a point in Body or Head where they picked +1 Health / +1 Sanity), C8 D193 (comments),
C4 the body two rooms (R3957, LIVE-E64-01), C1d Tamper attempts per time of day (E64-T1, a GM store
`tamperAttemptStore`).

## Next

- C5 crisis defence (DA6/DA23): not built - see Blockers.
- C8 orphans D008, D052, D059, D001, D003, D034, D039, D057: not built - see Blockers.
- Screenshots of the changed windows, one review page.

## Blockers

- **C5 defence (DA6/DA23, S18-04).** The plan names "`defense { side, trait }` on eight CRISIS_ACTIONS rows,
  `DEFENSE = { cap: 1 }`", but not which eight rows, which side's statistic, or how the cap applies; the audit's
  S18-04 and the incident model (S18-05) are not in this checkout. Building it would mean inventing the table.
  Question for the owner (Q-E64-8, added here): which eight rows, which statistic defends each, and is the cap +1 on
  the threshold? Until answered, `crisisThreshold` is unchanged.
- **C8 orphans.** The plan gives one line for D008, D052, D059 and nothing for D001, D003, D034, D039, D057;
  their texts are in AUDIT-DEFERRED-31.10.md, which is not in this checkout. D193 is closed (two comments named
  E82, which is not a stage). The rest wait for that file (Q-E64-9, added here).

## Test results

At 7469197, before the push (12.11.2026, this container, 4 cores):

- tiers 0-1 whole (`node run-tests.mjs --tier 1`): 1226 ran, 1210 passed, 0 failed, 16 skipped, 1 red (R3339, an
  existing marker of E48), 323.7 s
- tier 2 by name, the 53 tests naming a changed symbol (cleanupDc, meddle, actionBudget, createFind, drawItem and the
  rest): 57 passed, 0 failed, 0 skipped. E36-T4 (red on the base, the coordinator's) is not among them.
- scenarios found by `git grep` of the changed rules in audit/harness/scenarios: 10-murder 38/38, 30-security
  273/274 (1 expected red), 40-flow 88/88, 61-gmstore-case 113/113, 62-investigation 51/51, 71-sheet 41/41,
  72-canary 124/128 (4 expected red), 83-roll-integrity 110/110, 88-flow-length 26/26 - all green.
- lint 295 files 0 problems; `node tools/check.mjs` 17 parts green.

## Screenshots

Not taken yet.

## Tokens so far

Not measured by this session (no counter is available to it).
