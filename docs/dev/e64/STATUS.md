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
| S02-58 Tamper attempts per time of day (C1d, Q-E64-3) | no limit | at most 2 attempts through the Tamper tile per character each time of day (`CLEANUP.tamperPerTimeOfDay`); a third refused on the GM and its price given back; the killer's own Stage 6 not counted; a GM store `tamperAttemptStore` | 4f3882f | tier 2 E64-T1 | default taken, owner to confirm |
| DA6/DA23 crisis defence (C5) | `crisisThreshold` reads `def.threshold` only | not built: the eight rows and their statistics are not in this checkout (Q-E64-8) | - | - | blocked, owner to answer |
| DA39 Level Up (C6) | options +1 Health, +1 Sanity, +1 statistic, +1 experience, new experience | +1 statistic, +1 experience, new experience; a point in Head +1 Sanity maximum, in Body or Leg +1 Health maximum (`LEVEL_UP_TRAIT_RESOURCES`); past picks kept (Q-E64-4) | 2031ebd | R3956; 15 tier-2 tests and scenarios 61, 63, 72, 83 moved to Body/Head picks | default taken, owner to confirm |
| moveBody two rooms (C4) | `rooms.critical: 2` read by nothing; only connected rooms offered | the rooms two away are offered under their own heading; a critical carries the body there, any other hit to the room between; never through a bedroom (`bodyReach`, `bodyLanding`) | 4535acc | R3957, LIVE-E64-01 | default taken, owner to confirm |
| S02-75 sabotage lever, trap, Palm (Q-E64-5) | unchanged | unchanged before 1.3.0; logged for sessions 0 | - | - | default taken, owner to confirm |
| S02-57 Hope's armour on Role reversal (Q-E64-7) | unchanged | unchanged: the rebuilt incident model is outside the repository (Q-E64-6) | - | - | default taken, owner to confirm |
| DA11 trait ceiling | - | closed with no code (the owner's DA11) | - | - | owner's decision |
| D193 (orphan) | movement-audit.mjs and the moveAudit setting promised the default to E82, not a stage | comments say no stage holds it; "log" stays | 88b26ab | none (comments) | closed |

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

Stage state: **done as far as this checkout allows** (12.11.2026). Ten commits on `claude/e64`, each rule its own
commit so one can be reverted alone:

| Commit | Item | Tests |
| --- | --- | --- |
| 629f52e | C1a fresh scene only with a killing (S05-60) | R3950 |
| 383cf11 | C1b clean-up threshold never below 8 (DA12) | R3951 |
| ce58136 | C5a Confusion first tier 11 (DC5) | R3952 |
| 3c6383a | C3 Fisher-Yates in the draw (S17-29) | R3953; R1234 updated |
| 91ff70f | C1c Wounded only in Daily Life (S03-49) | R3954; R1160 updated |
| 7469197 | C2 Observe's critical hint for the finder (S05-59) | R3955 |
| 2031ebd | C6 Level Up by DA39 | R3956; tier-2 Level Up tests and 4 scenarios moved to Body/Head |
| 88b26ab | C8 D193 (comments) | none |
| 4535acc | C4 the body two rooms (U06-config-rules-07) | R3957; the D14 test reads `bodyReach`; LIVE-E64-01 |
| 4f3882f | C1d two Tamper attempts per time of day (S02-58) | tier 2 E64-T1; two older tests run past the limit |

Every red-first reading is quoted in its commit. Every rule is in the GM's and the player's handbooks, EN and PL
(the shuffle in the GM's alone: no number changed).

## Not done, and why

- **C5 crisis defence (DA6/DA23)**: blocked on the table of eight rows (Q-E64-8 below).
- **C5 S02-57 armour** (Q-E64-7) and **S02-75 lever/trap/Palm** (Q-E64-5): no change, by the defaults.
- **C8 orphans D008, D052, D059, D001, D003, D034, D039, D057**: their texts are in AUDIT-DEFERRED-31.10.md, outside
  this checkout (Q-E64-9 below). The plan's one-liners for D008, D052 and D059 leave the rule's details open (which
  choices the GM gets for key copies; what "did not work" means for a Loaded Die; what stamps a free Move's refund).
- **C7**: the review table above; nothing read against session 0's data, which is not in the checkout.
- **Tier-2 test for the body move on a real map**: R3957 reads the landing on a stand-in reach and the code by name;
  a moved body on a seeded map is not driven headless (scenario 13 stays green but does not move a body two rooms).
  LIVE-E64-01 is the table's check.

## Open questions (added by this stage)

| Id | Question | Default taken |
| --- | --- | --- |
| Q-E64-8 | DA6/DA23: which eight CRISIS_ACTIONS rows get `defense`, which side's statistic defends each, and is `DEFENSE.cap: 1` a cap of +1 on the threshold? | none: not built until answered |
| Q-E64-9 | The orphans D001, D003, D008, D034, D039, D052, D057, D059: their texts (AUDIT-DEFERRED-31.10.md) are not in this checkout | none: not built until the file is here |
| Q-E64-10 | C4: a non-critical hit aimed two rooms away carries the body to the room between - or should it fail, or stay? | the room between, default taken, owner to confirm |
| Q-E64-11 | Observe's critical window on a described trace is long: the new hint box is below the fold (the review page's first shot). Move the box up, or keep it last? | kept last, owner to confirm |

## In progress

Nothing. Blockers: Q-E64-8 and Q-E64-9 above.

## Test results

At 4f3882f (the last four commits, tested in a worktree at the same end state before they were cherry-picked; the
tree after the last pick was compared with it and differed only in this file):

- tiers 0-1 whole: 1212 passed, 0 failed, 16 skipped, 1 red (R3339, E48's existing marker)
- tier 2 by name, 69 name pieces (the changed symbols' tests and the 15 Level Up tests, E64-T1, the Tamper and
  body-move tests): 78 passed, 0 failed, 0 skipped. E36-T4 is not among them.
- scenarios: 10-murder 38/38, 13-murder-signals 86/86, 30-security 273/274 (1 expected red), 33-bridge-paths 73/73,
  50-lang 44/44, 61-gmstore-case 113/113, 62-investigation 51/51, 63-class-trial 71/71, 65-season 57/59 (2 expected
  red), 71-sheet 41/41, 72-canary 124/128 (4 expected red), 83-roll-integrity 110/110, 88-flow-length 26/26 - all
  green. 84-viewports not run (it hangs headless).
- lint 295 files 0 problems; `node tools/check.mjs` 17 parts green.

At 7469197, before the push (12.11.2026, this container, 4 cores):

- tiers 0-1 whole (`node run-tests.mjs --tier 1`): 1226 ran, 1210 passed, 0 failed, 16 skipped, 1 red (R3339, an
  existing marker of E48), 323.7 s
- tier 2 by name, the 53 tests naming a changed symbol (cleanupDc, meddle, actionBudget, createFind, drawItem and the
  rest): 57 passed, 0 failed, 0 skipped. E36-T4 (red on the base, the coordinator's) is not among them.
- scenarios found by `git grep` of the changed rules in audit/harness/scenarios: 10-murder 38/38, 30-security
  273/274 (1 expected red), 40-flow 88/88, 61-gmstore-case 113/113, 62-investigation 51/51, 71-sheet 41/41,
  72-canary 124/128 (4 expected red), 83-roll-integrity 110/110, 88-flow-length 26/26 - all green.
- lint 295 files 0 problems; `node tools/check.mjs` 17 parts green.

CI (GitHub Actions, run 43171433174 at 7469197): lint/check/gate, all 8 scenario buckets and 7 of 8 suite shards
green; shard 3 red on one test only, E36-T4 (the project manager's portrait), the test known red on the base
3ccfde3e and left to the coordinator; `verdict` red because of it. Run 43177945125 at 4f3882f was still running when
this file was written.

## Screenshots

Round 1, one private review page: https://claude.ai/artifact/NjBANZCciMx8kvotSAni7R - the critical Observe window
(the new box) and the Level Up picker (the note on Head, Body and Leg), Stained Glass and Monokuma Legacy, EN and PL,
deviceScaleFactor 2; Polish captions; the page says what the shots are not (no real Foundry, its CSS or its window
header; the harness's seeded world; the Observe window opened through a scratch export never committed). Seen: in
Monokuma Legacy, Polish, the Head note wraps to two lines inside the select; the box sits below the fold of a long
window (Q-E64-11). Files: /tmp/claude-0/e64/shots (outside the repository).

## Tokens so far

Not measured by this session (no counter is available to it).
