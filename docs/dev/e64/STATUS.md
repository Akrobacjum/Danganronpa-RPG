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
| Q-E64-3 | S02-58: a Tamper attempt limit per time of day? | Yes, 2 attempts per character per time of day | answered by the owner 12.11.2026: no cap, a plain price (b42cc23) |
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
| S03-49 Wounded (C1c, then the owner's review) | -1 action in every phase (the trial's refill too: 1 of 2) | -1 action in Daily Life and in the Investigation; the Class Trial keeps 2 of 2 (`STATES.wounded.actionsLostIn: ["dailyLife", "investigation"]`); the state and its badge stay. 91ff70f had Daily Life alone; the owner's review of 12.11.2026 added the Investigation | 91ff70f, bb78af3 | R3954, R1160 | the owner's decision (12.11.2026) |
| S05-59 Observe critical hint (C2) | the hint was typed in the trace's description box, which is public: every later finder's copy read it | a box of its own on a critical; written on that finder's Truth Bullet alone | 7469197 | R3955 | default taken, owner to confirm |
| S02-58 Tamper attempts per time of day (C1d, Q-E64-3) | no limit; price 1 action, or 1 Sanity once no action is left (T-1) | **no change in the end**: 4f3882f added a cap of 2 a time of day; the owner's review of 12.11.2026 took it out (b42cc23). The price is T-1's, unchanged | 4f3882f, b42cc23 | R3958 | the owner's decision (12.11.2026) |
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

## For the coordinator (the owner's review of 12.11.2026, ~10:17 Warsaw)

**1. Wounded.** Done: bb78af3. Wounded takes 1 action in Daily Life and in the Investigation; the Class Trial keeps its
full count. Red first (R3954 at the merge 34ded63: the Investigation read 2 of 2), then green; Explain's sentence,
R1160's quotes and both handbooks EN and PL say "Daily Life and the Investigation".

**2a. Where the Tamper cap came from.** Not from a rule anyone wrote down with a reason that this checkout holds.
The chain, as far as the repository and the planner's branch show it:

- The owner's audit entry for E64, as the plan (`docs/dev/plans/E64.md` on `claude/plan-130`, section 1) translates
  it: "S02-58 a limit of Tamper attempts per time of day". That is the whole of S02-58's text available here.
- The plan's C1: "S02-58 Tamper attempts per time of day (if the owner says yes)".
- The plan's Q-E64-3: "S02-58: a Tamper attempt limit per time of day?", proposed default "Yes, 2 attempts per
  character per time of day". The number 2 is the planner's proposal, not a measurement or a rule of the guide.
- S02-58's own text and its reason are in the audit file "DRPG Audyt 1.3.0", which is not in this checkout (searched:
  `git grep S02-58` on this branch and on `claude/plan-130` finds only the three lines above). So I cannot quote its
  reason; there may be one there that I have not seen.

**Did the cap apply to the murderer?** Read in 4f3882f's code (cleanup.mjs `tamperOverLimit`): it was asked only for an
attempt through the Tamper tile (`viaAction`), so not for the killer's clean-up in their own Stage 6 (the tile in
Stage 6 passes `viaAction: false`: action-tamper.mjs `performTamper`, `viaAction = !stageSix`). A killer - or anyone -
using the tile on any other time of day was counted like everyone else.

**2b/2c. What I chose: (c), the price alone.** With no reason in the checkout, nothing supports an extra Sanity cost,
so b42cc23 takes the cap out whole (its store, setting, check, texts and tests) and leaves Tamper's price as it was
before E64: 1 action, or 1 Sanity once the character has no action left - the price chain T-1 (17.09) set, which
E64 did not add and did not change. No cap, no refusal, no refund logic. Red first: R3958 at bb78af3 (the cap there),
green after. Handbooks EN and PL say nothing caps the attempts.

One point I did not decide for the owner: the owner's words "niech kosztuje po prostu akcje" could also be read as
"drop T-1's Sanity step once actions are gone". I kept T-1's step because it is an older decision of the owner's and
the review named the cap, not the chain (Q-E64-12 below).

**3.** Q-E64-10 and Q-E64-11 are marked "default, owner may revise".

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
| 4f3882f | C1d two Tamper attempts per time of day (S02-58) | tier 2 E64-T1 - taken out again by b42cc23 |
| 34ded63 | merge of the release line fa73b601 (E36-T4's fix, 0a49e5c1, with it) | lint, check, gate |
| bb78af3 | the owner's review: Wounded in the Investigation too | R3954, R1160 |
| b42cc23 | the owner's review: Tamper's cap taken out, the price alone | R3958 |

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
| Q-E64-10 | C4: a non-critical hit aimed two rooms away carries the body to the room between - or should it fail, or stay? | the room between, default, owner may revise |
| Q-E64-11 | Observe's critical window on a described trace is long: the new hint box is below the fold (the review page's first shot). Move the box up, or keep it last? | kept last, default, owner may revise |
| Q-E64-12 | Tamper with no action left: keep T-1's 1 Sanity (today), or refuse the attempt until the next time of day? | kept T-1's 1 Sanity, default, owner may revise |

## In progress

Nothing. Blockers: Q-E64-8 and Q-E64-9 above.

## Test results

At b42cc23 (after the merge and the owner's two changes; 12.11.2026, this container):

- tiers 0-1 whole: 1236 passed, 0 failed, 16 skipped, 0 red
- tier 2 by name (12 pieces: E36-T4, the Tamper and clean-up tests, the trial's refills, the Monocub's budget): 17
  passed, 0 failed - E36-T4 green since the merge
- scenarios: 10-murder 38/38, 30-security 273/274 (1 expected red), 40-flow 88/88, 62-investigation 51/51,
  72-canary 124/128 (4 expected red), 83-roll-integrity 110/110, 88-flow-length 26/26 - all green
- lint, check (17 parts), gate 37/37 green


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
