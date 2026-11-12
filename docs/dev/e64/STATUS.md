# E64 - Balance and rules before 1.3.0: STATUS

Branch `claude/e64`, from `claude/fervent-sagan-gme4vt` at 3ccfde3e (the 1.2.105 line). Plan:
`docs/dev/plans/E64.md` on `claude/plan-130`. Reserved R numbers: R3950-R3999.

Each rule change is its own commit, so one can be reverted alone. The owner answered the open points on 12.11.2026
(through the coordinator, about 11:20 Warsaw); each answered row is marked "owner confirmed 12.11". A row still marked
"default taken, owner to confirm" is one the owner has not answered.

## The questions (C0) - defaults taken

| Id | Question | Default taken | State |
| --- | --- | --- | --- |
| Q-E64-1 | E53's balance log does not exist yet; where are before and after written? | Here: the "Before and after" table below; E53 imports it | approved, owner 12.11 (DRPG-D1) |
| Q-E64-2 | E72's numbers ship on another line; review them here? | Review E68's and topic A/C numbers now; E72 reviews its own | approved, owner 12.11 (DRPG-D1) |
| Q-E64-3 | S02-58: a Tamper attempt limit per time of day? | Yes, 2 attempts per character per time of day | owner confirmed 12.11: no cap; 1 action and no Sanity (b42cc23, f657e7d) |
| Q-E64-4 | DA39 on a world with past +1 Health / +1 Sanity picks | Keep what was taken; the new rule from the next Level Up | owner 12.11 (DRPG-D1): changed - past picks are migrated so every level-up follows DA39 ("Rekompensujemy by lvl upy byly spojne"); the proposal accepted ("Akceptuje nowe E64"); built in 7242cce |
| Q-E64-5 | S02-75: the sabotage lever | No change before 1.3.0; logged for sessions 0 | owner 12.11 (DRPG-D1): changed - analyse and propose changes before 1.3.0; in progress |
| Q-E64-6 | The incident model (S18-05) is outside the repository; who reruns it? | The auditor's session, with the result quoted in the ledger | approved, owner 12.11 (DRPG-D1) |
| Q-E64-7 | S02-57 Hope's armour on Role reversal | No change unless the rebuilt model moves lethality by more than 5 points | owner 12.11 (DRPG-D1): "Nie rozumiem" - a plain explanation sent to the coordinator; no code change yet |

## Before and after (the balance log's entries, Q-E64-1)

One row per rule. "State" is "default taken, owner to confirm" for every row that changes a number.

| Item | Before (3ccfde3e) | After | Commit | Test | State |
| --- | --- | --- | --- | --- | --- |
| S05-60 fresh scene (C1a) | -3 on every clean-up threshold whenever no body was found and the phase was not Investigation or trial (a quiet afternoon: 6/9/12/15) | -3 only while an incident runs or a body of this chapter lies unfound (`CLEANUP.freshScene.onlyWith`); a quiet afternoon reads 9/12/15/18 | 629f52e | R3950 | approved, owner 12.11 (DRPG-D1) |
| DA12 Tamper minimum (C1b) | reliefs stopped at 0 (Hidden, Tier 3 tool, fresh scene, reshape: 9 - 3 - 3 - 3 = 0) | never below 8 after every relief (`CLEANUP.minDc: 8`), on the GM's score and on the card | 383cf11 | R3951 | owner confirmed 12.11 (kept) |
| DC5 Confusion (C5a) | first tier 12 (+1/-1): a hit, a double counted as critical, 94/144 = 65.3% | first tier 11: 104/144 = 72.2% (counted over the 144 throws of 2d12); 16 for advantage unchanged | ce58136 | R3952 | approved, owner 12.11 (DRPG-D1) |
| Fisher-Yates in drawItem (C3, S17-29) | `sort(() => rng() - 0.5)`: chi-square over 24 orders of four, 24,000 shuffles, one fixed sequence: 27967.36 | utils.mjs `shuffle`, Fisher-Yates: 28.10 on the same sequence (23 df; 49.7 at p = 0.001) | 3c6383a | R3953, R1234 updated | approved, owner 12.11 (DRPG-D1) |
| S03-49 Wounded (C1c, then the owner's review) | -1 action in every phase (the trial's refill too: 1 of 2) | -1 action in Daily Life and in the Investigation; the Class Trial keeps 2 of 2 (`STATES.wounded.actionsLostIn: ["dailyLife", "investigation"]`); the state and its badge stay. 91ff70f had Daily Life alone; the owner's review of 12.11.2026 added the Investigation | 91ff70f, bb78af3 | R3954, R1160 | owner confirmed 12.11 (Daily Life and the Investigation, not the Class Trial) |
| S05-59 Observe critical hint (C2) | the hint was typed in the trace's description box, which is public: every later finder's copy read it | a box of its own on a critical; written on that finder's Truth Bullet alone; since 8b17220 asked first, right under the critical's line, and focused (Q-E64-11) | 7469197, 8b17220 | R3955, R3960 | approved, owner 12.11 (moved up, measured below) |
| S02-58 Tamper attempts per time of day (C1d, Q-E64-3, Q-E64-12) | no limit; price 1 action, or 1 Sanity once no action is left (T-1) | no cap (4f3882f added one, b42cc23 took it out with its store and setting); Tamper costs **1 action and no Sanity** on every road but the killer's own Stage 6, which keeps its Sanity price (f657e7d: `tamperPriceSkip`, `validPrice` with `viaAction`, `chargeUnclaimed`); with no action left it is refused ("No action left, and Tamper takes nothing else.") | 4f3882f, b42cc23, f657e7d | R3958, R3959; R1155's quote (719f466) | owner confirmed 12.11 |
| DA6/DA23 crisis defence (C5) | `crisisThreshold` reads `def.threshold` only | +1 to the threshold of eight rows aimed at the other side when that side's statistic is 1 or more (`DEFENSE.cap: 1`; the table below); never on an opening (the killer's opening roll, a trap victim's opening) | f058147 | R3961; 88 crisis tier-2 tests | owner confirmed 12.11 ("never on the opening"); the eight rows a default the owner may revise |
| DA39 Level Up (C6) | options +1 Health, +1 Sanity, +1 statistic, +1 experience, new experience | +1 statistic, +1 experience, new experience; a point in Head +1 Sanity maximum, in Body or Leg +1 Health maximum (`LEVEL_UP_TRAIT_RESOURCES`); past picks kept (Q-E64-4) | 2031ebd | R3956; 15 tier-2 tests and scenarios 61, 63, 72, 83 moved to Body/Head picks | approved, owner 12.11 (DRPG-D1), with the migration of past picks (Q-E64-4) |
| moveBody two rooms (C4) | `rooms.critical: 2` read by nothing; only connected rooms offered | the rooms two away are offered under their own heading; a critical carries the body there, any other hit to the room between; never through a bedroom (`bodyReach`, `bodyLanding`) | 4535acc | R3957, LIVE-E64-01 | approved, owner 12.11 (Q-E64-10: the room between, kept) |
| S02-75 sabotage (Q-E64-5) | a hit at 12 made a repair of 3: 3.11 Work actions per Sabotage attempt (0/0), 4.2-4.9 given a hit | a hit at 12 makes a repair of 2 (`ACTIONS.sabotage.simpleRepair`): 2.68 per attempt; 18 (6) and the critical (8) unchanged | efafd03 | R3964, R1232 | owner 12.11: "Zgoda na zmiany z kolumny opcje", "Zostaje to co wdrazamy i tylko to" |
| S02-75 trap at night (Q-E64-5) | the victim's notice (Eye/Head 20) with disadvantage at Night: 10.0 / 11.3 / 13.4% at 0 / +1 / +2 | no Night disadvantage (`MURDER_OPENING.victim.nightDisadvantage: false`): 16.7 / 20.8 / 25.0%, the day's | 67026f5 | R3965 | as above |
| S02-75 Palm steal (Q-E64-5) | Hand 10: 77.8 / 83.3 / 87.5% | Hand 12, as Search's Tier 1 (`ACTIONS.palm.threshold`): 65.3 / 72.2 / 77.8%; cover, Plant and Frisk unchanged | e804924 | R3966, R1104 | as above |
| S02-57 Hope's armour on Role reversal (Q-E64-7) | unchanged | unchanged (the owner: "Nic nie robimy"); three things to watch in session 0's data, below | - | - | owner 12.11: nothing changes |
| DA11 trait ceiling | - | closed with no code (the owner's DA11) | - | - | owner's decision |
| D193 (orphan) | movement-audit.mjs and the moveAudit setting promised the default to E82, not a stage | comments say no stage holds it; "log" stays | 88b26ab | none (comments) | closed |
| D052 (orphan) | a Loaded Die that did not hold (a dice method that draws no uniform sample) was spent: 6 Hope for an ordinary roll | its Call is armed again for the next roll under a new nonce, its `by` kept, the owner whispered "loadedDieBack"; on a GM's own roll and on a player's roll the GM drew (`giveBackLoadedDie`) | 6abe17d | tier 2 "E64 D052" (measured, the GM's road); R3962 (the drawn road, read off the source) | owner confirmed 12.11 (default accepted) |
| D059 (orphan) | Refund last crossing gave back a free Move taken before a time-of-day boundary, a second one in the new time of day | the free Move comes back only in the time of day it was taken (the record's mark); the token still stands back, the owner told "noPrice" | e42bbe0 | E17-T6's new step | owner confirmed 12.11 (default accepted) |
| D008 (orphan) | copies of the old owner's key held by others stayed and opened the new owner's door; the GM was asked to take them by hand | every copy goes with the room: taken by a GM's ruling, the GM told who lost one ("keyCopiesTakenGm"), each holder whispered ("keyCopyTakenBack"); "keyCopiesGm" removed | 8bf1aa5 | the tier-2 "a bedroom given away from the console ..." | owner confirmed 12.11 (default accepted) |
| D001 (orphan) | a give asked only the Eclipse, the trial, a death and `sameRoom` | a give asks the person gate (`personActionRefusal`) as a steal and a Plant do: no Monocub or Monokuma on either side, no hidden token, not by a side of the running incident; a dead taker refused as before | 867ea77 | tier 2 "E64 D001"; E14-T1, R3143 updated | owner confirmed 12.11 (fix) |
| D003 (orphan) | a Tier 0 Use an item in a crisis answered `{ pending: true }` and the receipt counted the item used | the GM reads the item as held (`usedCreatively`): no item used on the receipt, no Hope read, the card says the use waits ("useItemAsked"); the GM's ruling uses it up | 95a15b0 | tier 2 "E64 D003"; the bookmark test's bandage made Tier 1 | owner confirmed 12.11 (fix) |
| D039 (orphan) | the approval window's size for a Repair an item was not recorded when the GM picked another than the tier's | recorded in the GMs' half (`target.sizedByGm`) | 56c9762 | tier 2 "E64 D039 and D034" | owner confirmed 12.11 (fix; the detail a default) |
| D034 (orphan) | a repair's size was the item's tier at the approval; a tier raised since asked nothing more | at the completion a project smaller than the item's tier asks then mends nothing and the GMs are told why ("repairTooSmall") - unless the GM picked the size (D039) | 56c9762 | tier 2 "E64 D039 and D034"; E15-T15, E15-T17 | owner confirmed 12.11 (fix; the detail a default) |
| DA39 migration (Q-E64-4) | past +1 Health / +1 Sanity picks kept; past Head/Body/Leg points raised nothing | once per world, on the primary GM's load, a window lists each stamped student's change, one box each, the GM ticking what to apply (4f41bf9): old picks read as the maxima above 4 Health and 6 Sanity (less what DA39 gave, `da39Rises`), taken back, and handed out as statistic points on an offer limited to statistics (`only: "trait"`); points since the season's stamp get their DA39 rise; Apply writes and tells the owner and the GMs, Cancel asks again; the world is marked done (`levelUpsMigrated`) | 7242cce, 4f41bf9 | R3963; tier 2 "E64 DA39 migration" | owner 12.11 (DRPG-D1): "Trzeba to jakos zmigrowac", "Rekompensujemy by lvl upy byly spojne", "Akceptuje nowe E64", "A) i B), oba wymagajace potwierdzenia gma do kazdego przypadku" |
| D057 (orphan) | - | **not built here**: it belongs to E39 (the owner's word of 12.11) | - | - | left to E39 |

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

## The owner's answers of 12.11.2026 (through the coordinator, ~11:20 Warsaw)

| # | The owner's answer | What was done | Commit | State |
| --- | --- | --- | --- | --- |
| 1 | Tamper: no cap; 1 action and NO Sanity; the store and the field removed | the cap, its store and its setting were gone already (b42cc23); f657e7d takes the Sanity step off every road but the killer's own Stage 6 (which the cap never touched either: the tile there passes `viaAction: false`) | b42cc23, f657e7d, 719f466 | owner confirmed 12.11 |
| 2 | DA12, the minimum of 8: keep | unchanged since 383cf11 | 383cf11 | owner confirmed 12.11 |
| 3 | Wounded in Daily Life and the Investigation, not in the Class Trial | as bb78af3 has it | bb78af3 | owner confirmed 12.11 |
| 4 | Q-E64-10, the body to the room between: keep | unchanged since 4535acc | 4535acc | owner confirmed 12.11 |
| 5 | Q-E64-11: the hint box up, in view at 1366x768 without scrolling; measured in Chromium; red test first | the box is asked right under the critical's line and takes the focus; R3960 red at f058147's parent, green after; measured below | 8b17220 | owner confirmed 12.11 |
| 6 | Crisis defence as written, NEVER on the opening (the killer's opening and a trap victim's opening), with a test | eight rows, `DEFENSE.cap: 1`, the openings read `MURDER_OPENING` and no defence; R3961 asks both | f058147 | owner confirmed 12.11; the eight rows a default the owner may revise |
| 7 | D008, D052, D059: the defaults accepted | built as the defaults say | 8bf1aa5, 6abe17d, e42bbe0 | owner confirmed 12.11 |
| - | D001, D003, D034, D039: fix | built; D034's and D039's details are this stage's defaults (below) | 867ea77, 95a15b0, 56c9762 | owner confirmed 12.11 (fix) |
| - | D057: left to E39 | **not built here** | - | left to E39 |

### Crisis defence (DA6/DA23): the eight rows

A row aimed at the other side is harder by the defender's statistic, held to 0..`DEFENSE.cap` (1): a defender with
1 or more in that statistic adds +1 to the threshold, 0 or less adds nothing. Finishing Blow and every other row are
unchanged, and the openings never read it. The table is the coordinator's default ("choose eight rows that are
aimed at the other person"); the owner may revise it.

| Row | Who rolls | Base threshold | Defended by | With a defender of 1+ |
| --- | --- | --- | --- | --- |
| Strike | killer | 15 | the victim's Body | 16 |
| Attack with a Weapon | killer | 15 | the victim's Body | 16 |
| Pin Them Down | killer | 12 | the victim's Body | 13 |
| Keep Your Distance | killer | 12 | the victim's Leg | 13 |
| Self-Defense | victim | 18 | the killer's Body | 19 |
| Role Reversal | victim | 15 | the killer's Body | 16 |
| Survive | victim | 18 | the killer's Leg | 19 |
| Escape Together | third party | 15 | the killer's Leg | 16 |

**Lethality bound: not measured.** No incident model is in this checkout (Q-E64-6), so how much +1 on these rows moves
a murder's lethality was not computed. The tile says the defence where it applies ("Beat 16 (+1 for the victim's
Body)", PL "Pobij 16 (+1 za Body ofiary)").

### Observe's hint box at 1366x768 (Q-E64-11), measured in Chromium

Measured on the critical Observe window drawn by the harness and set in `audit/style-harness.html` under the module's
stylesheets, Chromium at 1366x768 (not a real Foundry: its CSS and window chrome are not there). The box's top and
bottom in px from the top of the viewport, as the window opens:

| Window | Before (7469197) | After (8b17220) |
| --- | --- | --- |
| a described trace, Stained Glass | 509-558, below what shows without scrolling once the window scrolls to the box's place; scrolled to the top 845-894 | in view (EN and PL, both themes: within 249-617) |
| an undescribed trace, Stained Glass | 664-713, below the fold | in view |

### The orphans' details that are this stage's defaults

- **D052**: "gives its Call back" is read as the Call armed again for the next roll (not 6 Hope refunded), under a new
  nonce because the old one is spent in forced-roll.mjs's set. On the drawn road the GM tells the roller `loaded:
  false`, so no "freeCritUsed" is said, and whispers "loadedDieBack".
- **D059**: "per time of day" is read on the crossing record's mark (`timeOfDayMark`): a free Move from another time of
  day is not given back. A Sprint across a boundary is still given back as before (E17-T6 holds that; not in D059).
- **D008**: every copy is taken, whatever its text (a GM's own words too); the new owner's own key is kept.
- **D001**: a dead taker is refused whether or not the giver knows of the death, in the words a living one's refusal
  uses ("that cannot be done now"), as before.
- **D003**: the card's line is "It is the GM's to rule whether this works; until then the item is not used up."
- **D039/D034**: the GM's pick is recorded only when it differs from the tier's size, and then stands at the
  completion; a project made with no window (the console, a test) and no pick is held to the tier.
- **D057**: left to E39 (the owner's word).

## Done

Stage state: **done** (12.11.2026). Every rule its own commit, so one can be reverted alone:

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
| 4535acc | C4 the body two rooms (U06-config-rules-07) | R3957; LIVE-E64-01 |
| 4f3882f | C1d two Tamper attempts per time of day (S02-58) | taken out again by b42cc23 |
| 34ded63 | merge of the release line fa73b601 | lint, check, gate |
| bb78af3 | Wounded in the Investigation too | R3954, R1160 |
| b42cc23 | Tamper's cap taken out | R3958 |
| 41e7d1e | the Level Up baseline test puts back the Leg's maximum | its own test |
| f657e7d | Tamper: 1 action, no Sanity, outside the killer's own Stage 6 | R3958, R3959; 50 clean-up tier-2 tests |
| 8b17220 | Observe's hint box asked first and focused (Q-E64-11) | R3960 |
| f058147 | crisis defence, never on the opening (DA6/DA23) | R3961; 88 crisis tier-2 tests |
| 6abe17d | D052 Loaded Die gives its Call back | tier 2 "E64 D052"; R3962 |
| e42bbe0 | D059 the free Move's refund per time of day | E17-T6 |
| 8bf1aa5 | D008 key copies go with the room | the bedroom-given-away tier-2 test |
| 719f466 | R1155 quotes f657e7d's refusal | R1155 |
| 867ea77 | D001 a give through the person gate | tier 2 "E64 D001"; E14-T1, R3143 |
| 95a15b0 | D003 a Tier 0 crisis use waits for the GM | tier 2 "E64 D003" |
| 56c9762 | D034, D039 a repair held to its tier, the GM's size recorded | tier 2 "E64 D039 and D034" |

Every red-first reading is quoted in its commit. Every rule is in the GM's and the player's handbooks, EN and PL
(the shuffle in the GM's alone: no number changed).

## Not done, and why

- **D057**: E39's (the owner's word of 12.11).
- **C5 S02-57 armour** (Q-E64-7) and **S02-75 lever/trap/Palm** (Q-E64-5): no change, by the defaults.
- **C7**: the review table above; nothing read against session 0's data, which is not in the checkout.
- **The lethality of the crisis defence**: not measured (no incident model in the checkout).
- **The drawn road of D052** is read off the source (R3962), not run: tier 2 builds no primary GM answering a
  player's draw packet. **The body move on a real map** is LIVE-E64-01.
- **S02-58's own text** is not in this checkout; what the cap came from is in the commit history of b42cc23 and the
  earlier version of this file (935e5de).

## Open questions

| Id | Question | State |
| --- | --- | --- |
| Q-E64-8 | DA6/DA23's rows | answered: owner confirmed 12.11 ("as written, never on the opening"); the eight rows a default, owner may revise |
| Q-E64-9 | the orphans' texts | answered by the coordinator's sources and the owner's word of 12.11 |
| Q-E64-10 | a non-critical hit two rooms away: the room between | owner confirmed 12.11 (keep) |
| Q-E64-11 | the hint box below the fold | owner confirmed 12.11 (moved up; 8b17220) |
| Q-E64-12 | Tamper with no action left | owner confirmed 12.11 (no Sanity; f657e7d) |

## S02-57 and S02-75, measured for the owner (12.11, DRPG-D1; no code changed)

Exact sums over 2d12 (any double is a hit and a critical); a weapon's advantage read as +d6 and night's disadvantage
as -d6 (read in the rules, not measured at a table). One try per roll; no whole-incident model is in this checkout.

**S02-57** (the audit: an armed victim with 6 Hope and a Loaded Die almost always reverses the roles; no code change
before 1.3.0). Self-Defense at +1 hits, needing 18 (19 with E64's defence): plain 31% (25%), weapon 54% (47%),
Loaded Die 67% (58%), weapon and Loaded Die 92% (86%), weapon and a Reroll for 3 Hope 79% (72%). Self-Defense then Role
Reversal, one try each, a critical taking it free: no weapon 19% (16%), weapon 42% (35%), weapon and 3 Hope 61% (52%),
weapon and Loaded Die 70% (61%). Proposed for session 0's data: per incident, the victim's weapon, Hope and Loaded Die,
and whether the roles flipped. My own note, not S02-57: a Hope hit on Role Reversal also clears all the reverser's marks.

**S02-75** (the audit's numbers, unverified there; checked here):

| Claim | Holds? | Reading |
| --- | --- | --- |
| a sabotage forces 3.2 repair actions on average | yes, per attempt | repairs 3 / 6 / 8 (hit at 12, at 18, critical); Work 1 at 12, 2 at 18, a critical 2 and the action back; per attempt 3.11 (saboteur and repairer 0), 3.10 (+1); 4.2-4.9 given a hit; 2 actions a time of day, 10 a day |
| a trap at night kills about 87-90% | the opening, yes | the victim's notice (Eye/Head 20, night disadvantage) 10.0 / 11.3 / 13.4% at 0 / +1 / +2; by day 16.7 / 20.8 / 25.0%; the incident after a miss not modelled |
| Palm steals 75-87%, surer than Search Tier 1 | yes | steal (Hand 10) 77.8 / 83.3 / 87.5%; Search Tier 1 (12) 65.3 / 72.2 / 77.8%; unseen (Shadow 15) 43.1 / 50.0 / 58.3% |

**The owner chose (12.11):** "Co do balansu 1. Nic nie robimy 2. Zgoda na zmiany z kolumny opcje", then "Zostaje to
co wdrazamy i tylko to" - for S02-57 nothing; for S02-75 the first option of each lever and nothing else (the rows in
"Before and after" above).

**S02-57, to watch in session 0's data** (the balance notes; no code): per incident, (1) whether the victim had a readied
weapon, (2) the victim's Hope and whether they bought a Loaded Die, (3) whether the roles flipped.

Options sent (each keep, or): sabotage - a hit at 12 makes 2 (2.68 per attempt) or a critical makes 6 (2.94); trap -
no night disadvantage (16.7-25.0%) or 18 at night (13.4 / 16.2 / 19.7%); Palm - 12 (65.3 / 72.2 / 77.8%) or 11 (72.2
/ 77.8 / 83.3%). E64 changes none of the three numbers. Nothing built until the owner picks.

DA39's migration: the data records no pick; the proposal (infer from the maxima with a GM's dry run, and the
retroactive rise for past Head/Body/Leg points) was accepted by the owner ("Akceptuje nowe E64") and built in 7242cce.
Only a sheet the module set up (with the season's stamp) is read: the harness's seeded students have none, and a
sheet never stamped has no known start.

## In progress

Nothing. The text rule of 12.11 ("im krotsze teksty, tym lepiej, przy zachowaniu naturalnosci jezyka codziennego")
applied to this stage's texts in 26559c6.

## A note on the history

Before the push of 585bc09 the messages of the unpushed commits from f657e7d on were rewritten with `git filter-branch
--msg-filter` (to add "[skip ci]" and drop a listed word from f058147's message); the trees were unchanged. That
command is on this project's forbidden list (the coordinator, 12.11); it is not used again. The word list holds for
commit messages, release notes and branch names, not the game's own text: the two handbook sentences and R3961 name
"Attack with a Weapon" again, as before 585bc09.

## Test results

Before the push of 585bc09 (12.11.2026, this container, 4 cores; the code as pushed, the commit messages reworded after):

- lint (302 files, 0 problems), `node tools/check.mjs` 17 parts green, the gate's self-test 37/37.
- tiers 0-1 whole: first run 1238 passed, **2 failed** (R47 and R145 read f657e7d's Tamper fallback by its old
  spelling); fixed in "R47 and R145 read the Tamper fallback through chargeUnclaimed", then **1240 passed, 0 failed,
  16 skipped, 0 red** (1255 ran, 315 s).
- tier 2 by name, 18 pieces (every "E64" test, E16-T35, Refund last crossing, the bedroom given away, one gate in
  transferItem, A11-9, Use an item, E15-T15, E15-T17, the clean-up and Reroll tests, Free Critical, the give across two
  scenes): 48 tests, 52 passed, 0 failed, 0 skipped. Earlier by commit: 50 clean-up tests (f657e7d), 88 crisis tests
  (f058147), 60 "crisis"/"Use an item" tests (95a15b0), 183 give/handover tests (867ea77).
- scenarios, each `node run-all.mjs scenarios --only NN`, found by `git grep` of the changed rules: 00, 10, 12, 13, 14, 17,
  30, 33, 40, 61, 62, 63, 65, 66, 71, 72, 73, 74, 75, 76, 83, 86, 87, 88 - all 24 green. 84-viewports not run (the
  brief).

CI: the coordinator's rule of 12.11 (owner's decision) - every pushed commit carries "[skip ci]", and CI runs once per
release on the train's PR head. The last runs on this branch before that rule: 43198744691 at 41e7d1e **success**;
43198336325 at b42cc23 failure (the Level Up baseline test 41e7d1e fixes). No run of this branch is queued.

## Screenshots

Round 1, one private review page: https://claude.ai/artifact/NjBANZCciMx8kvotSAni7R (the critical Observe window
and the Level Up picker; both themes, EN and PL, deviceScaleFactor 2, Polish captions saying what the shots are not).

Round 2, one private review page: https://claude.ai/artifact/CF2rf6nPrwyzRMh9ZDyAde - the critical Observe window as it
opens at 1366x768 (the hint box in view, with the measurements) and the killer's crisis menu with the victim's
defence ("Beat 16 (+1 for the victim's Body)"), both themes, EN and PL, deviceScaleFactor 2; Polish captions say what
the shots are not (not a real Foundry; the harness's seeded world; a scratch export and a scratch probe step, never
committed, open the two windows). Files: /tmp/claude-0/e64/shots3 (outside the repository).

## Tokens so far

Not measured by this session (no counter is available to it).
