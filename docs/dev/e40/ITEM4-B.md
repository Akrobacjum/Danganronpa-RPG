# E40 item 4, slice B - status

Written 13.11.2026 on `claude/e40-item4-b`, started from d7566926 (claude/e39-40). The plan and its rules are
`docs/dev/e40/ITEM4.md`; this file is its rule 8 for slice B (the investigation): per test, the pick and its reason, the
mutant tables, the gates run. R range R5130-R5149: none taken (no test was split into a new tier-0 or tier-1 row).

## Where the slice stands (13.11.2026, after batch 4)

- Of 29: **(a) 0**; **(b) 7 built** - R87 (deleted from tier 0), R36, R88, R89, R91, R92, R145 (each trimmed to what its new
  test does not hold, the rest marked); **(c) 12** - R39, R40, R172, R305, R306, R376, R430, R1103, R1120, R1135, R1199,
  R3143; **(b), not built: 10** - R32, R34, R37, R46, R47, R49, R53, R57, R96, R143, unchanged in tier 0.
- Seven new tier-2 tests under slice B's line. Every one fails every mutant written for it; the old test missed at least one
  (ii) mutant in each case, and in R89's also an (i): the scope set to world. Two first drafts were wrong and were caught
  (R91's missed m91i-c; R92's failed on the clean tree), and R171 caught a raw store key in R89's first draft.
- For the owner: no export was asked for. Defaults taken, as ITEM4.md's: a moved test carries its old number in its name;
  a trimmed tier-0 remainder that is behaviour not yet driven (R36's Tamper half, R145's Stage 6 order) is marked TEXT
  GUARD as rule 1 says, with "not driven on this line" in its note. Exports that would let a (c) be driven, if wanted:
  `searchedBy`/`pruneSpends` (R1199), `concealSabotage` (R40), `askWhatToAnalyze` (R1103), observe.mjs `pending` (R89's
  remainder), `paintTamper` and `releaseTamper` (R53, R37).

## The picks

(a) in place, (b) tier 2, (c) text guard (ITEM4.md rule 1). "(b), not built" is a test read as behaviour whose driving
was not reached on this line: it stands unchanged in tier 0, unmarked, for a later pass.

| R | Pick | Reason | Done |
| --- | --- | --- | --- |
| R32 | (b), trimmed | the plan row's half driven through `applyDashboardSave`; the form reader (`readCaseFields`, not exported) stays as text | batch 6 |
| R34 | (b), trimmed | a miss and a hit driven with a planted item; the spend's and the plant run's shape, the late answer and the one-caller census stay | batch 5 |
| R36 | (b), trimmed | `plantOnPerson` driven at the plant's bars; Tamper's two resolver lines stay as text, not driven | batch 3 |
| R37 | (b), trimmed | `attemptCleanup` driven watched and alone with the main window closed; the release's `isCleaner` read stays | batch 7 |
| R39 | (c) | which readers the fee, the charge and the finders call; the fee's counts are tier 2's (four named tests); `keyPlanStatus`'s off-plan count and the case's bar are read as text only | batch 2 |
| R40 | (c) | a census over the action family and cleanup.mjs, and a branch of `concealSabotage`, not exported | batch 2 |
| R46 | (b), trimmed | the price at the dice, the closed window's refund, the free road from a console and as the GM, a forged refusal card pressed; the GM-check order, the three roads' refunds and the receipts census stay | batch 7 |
| R47 | (b), not built | Tamper's one price through `attemptCleanup`/`attemptStageSix` with windows; the GM-side charge census is (c) |  |
| R49 | (b), not built | `createFind` (not exported), the give dialog's two guards, `publishReading` and `mintLootBullet` (not exported): several fixtures |  |
| R53 | (c) | the tile is painted only on an open Daggerheart sheet, which the headless harness has none of (`env.systemSheets`); `paintTamper` not exported | batch 5 |
| R57 | (a) | `wirePortraitPickers` and `wireKeyLimitOverride` (exported) called on a detached element; `wireCase` (not exported) and `keepLive`'s order stay as text in the same test | batch 6 |
| R87 | (b) | `analyzeDc` and `resolveAnalyze` driven: a Neutral priced as Prep, its card's sentence | batch 1 |
| R88 | (b), trimmed | the cards' buttons pressed as a GM presses them; four assertions stay as text (below) | batch 1 |
| R89 | (b), trimmed | the store's scope read off Foundry's registry; a resolve with no record driven; the write-through stays as text | batch 2 |
| R91 | (b), trimmed | `openNewTrace` answered as a GM, refused off the form and from a console; the markup, the dashboard's door and the keys stay | batch 3 |
| R92 | (b), trimmed | the ruling driven (a console, a reinforced trace, long words, a decline, no trace); the writers' census, the two roads, the card's wiring and its keys stay | batch 4 |
| R96 | (a) | `projectCard` (exported, synchronous) called as the GM and with `isGM` false; `showProjectCard` (not exported), the CSS and the sizing stay as text in the same test | batch 5 |
| R143 | (c) | a player's write judged on the primary: tier 2's writes are the GM's; scenario 30's phase 7i drives both roads from a player's browser | batch 5 |
| R145 | (b), trimmed | the Analyze half driven; the Stage 6 order and the undo's receipt stay as text | batch 2 |
| R172 | (c) | a census of 30 derived store writers and 2 migrations; the difference shows only with a second GM's copy | batch 1 |
| R305 | (c) | a census of ten readers and writers of the tie; its behaviour is tier 2's | batch 1 |
| R306 | (c) | an order with no outcome a call sees; `claimRuling` not exported; the race is tier 2's | batch 1 |
| R376 | (c) | a census of five readers and three writers; the reset's reading is tier 2's and scenario 65's K | batch 2 |
| R430 | (c) | a census of two readers that must not name the canvas | batch 1 |
| R1103 | (c) | `askWhatToAnalyze` not exported; the shown box is a stylesheet's `:has` rule | batch 2 |
| R1120 | (c) | a census over every module file; `createFind` and `describeFind` not exported (the pilot's reading) | batch 1 |
| R1135 | (c) | an order in one bridge run and one audit line; scenario 30's "a console's discard" drives the roads | batch 2 |
| R1199 | (c) | dead code (a census) and a module-private Map (`searchedBy`): would need an export of it or of `pruneSpends` | batch 2 |
| R3143 | (c) | where the one gate is asked; its answers are tier 2's | batch 2 |

## Mutant tables (ITEM4.md rule 3)

Each on a detached worktree copy at d7566926 with this line's tests-tier2.mjs, `DRPG_REPO` pointed at it; the old test by
`--tier 1 --only R<n>`, the new by `--tier 2 --only "<n>'s rule"`. Never committed.

### R87 -> "a Truth Bullet whose real kind is Neutral is analysed against the number ... (was R87)"

| Mutant | Old R87 | New test |
| --- | --- | --- |
| m87i: config.mjs `analyzeDc` reads `realType` with no alias | FAIL | FAIL |
| m87ii-a: `ANALYZE_TYPE_ALIAS` without its `neutral` row (`{ final: "key", autopsy: "key" }`; the lookup's text unchanged) | ok - missed | FAIL |
| m87ii-b: analyze.mjs's card reads `hint` before `analysedHint` (the name still there) | ok - missed | FAIL |
| the clean copy | ok | ok |

### R88 -> "an Observe's Nothing was there marks the Sanity and gives nothing back ... (was R88)"

| Mutant | Old R88 | New test |
| --- | --- | --- |
| m88i-a: `declineAction` writes `paid: ""` for no receipt | FAIL | FAIL |
| m88i-b: `CARD_ACTIONS.observeMiss` is `ruleDecline` | FAIL | FAIL |
| m88ii-a: `declineAction`'s data spreads `paid: ""` after its `paid` line for no receipt | ok - missed | FAIL |
| m88ii-b: `CARD_ACTIONS.observeMiss = ruleDecline;` after the table | ok - missed | FAIL |
| m88iii: messenger-app.mjs `refundOnCard`'s `if (data.paid === "none") return null;` removed | FAIL | ok |
| the clean copy | ok | ok |

m88iii is a reading, not a gap: with that line gone a "none" reaches `if (data.paid) return null` a few lines below and
answers the same, so no outcome changes. The assertion stays in the trimmed R88 with that said beside it.

R88's assertions not held by the new test, kept in tier 0 and marked: no card of the action family writes its own
refusal button (a census); the GM-road Observe card builds its miss with `missAction`; the miss's bookmark carries the
marks made, not the constant (two assertions; a Reroll's undo reads it); `data.paid === "none"` (m88iii).

### R89 -> "an Observe with no record on the GM tells the GMs and the player ... (was R89)"

| Mutant | Old R89 | New test |
| --- | --- | --- |
| m89i-a: settings.mjs registers `SETTINGS.observePending` with `scope: "world"` | ok - missed | FAIL |
| m89ii-a: the same registration keeps `scope: "client"` and adds `scope: "world"` after `default` | ok - missed | FAIL |
| m89i-b: observe.mjs's lost road tells the owner `resolveLost` instead of `resolveLostOwner` | FAIL | FAIL |
| m89ii-b: the owner's whisper behind `if (stranded && false)` (the key still named) | ok - missed | FAIL |
| the clean copy | ok | ok |

m89i-a is a gap in the old test, measured: its `bodyOf(settings, "SETTINGS.observePending", { length: 400 })` reaches the
next registration, `SETTINGS.legacyObservePending`'s, whose `scope: "client"` it matched.

R89's assertions not held by the new test, kept in tier 0 and marked: `readPending` and `writePending` declared, five or
more `await writePending()` (the write-through), `readPending()` before `sweepPending()` in `resolveObserve`, and the
bridge run handing `actorId` on. The pending Map is module-private (observe.mjs `pending`): driving a reload would need
an export of it.

### R145 -> "Analyze on the GM refuses a bullet it may not read now ... (R145's Analyze half, driven; was R145)"

| Mutant of analyze.mjs `resolveAnalyze` | Old R145 | New test |
| --- | --- | --- |
| m145i-a: the fresh throw's `isAnalysable` refusal removed | FAIL | FAIL |
| m145i-b: the undo's `analysedChapter !== chapter` refusal removed | FAIL | FAIL |
| m145ii-a: the fresh refusal's condition joined by `&& false` (its text unchanged) | ok - missed | FAIL |
| m145ii-b: the undo refusal's condition joined by `&& false` | ok - missed | FAIL |
| the clean copy | ok | ok |

R145's Stage 6 half and the clean-up undo's receipt stay in tier 0 as text (its comment says which tier-2 test drives
Stage 6's refusals and what is not built).

### R36 -> "the GM judges a plant by the plant's own bars, not a theft's (R36's plant half, driven; was R36)"

| Mutant of palm.mjs `plantOnPerson` | Old R36 | New test |
| --- | --- | --- |
| m36i: both bars the theft's (`def.threshold`, `def.unseen.threshold`) | FAIL | FAIL |
| m36ii: `def.plant?.threshold ? def.threshold : def.threshold`, and the unseen bar likewise (the names still there) | ok - missed | FAIL |
| the clean copy | ok | ok |

R36's Tamper half (cleanup.mjs: no refusal of another student's trace via the action, the incident exemption's shape)
stays in tier 0 as text, not driven on this line.

### R91 -> "the GM's New trace places the trace the window was told ... (was R91)"

| Mutant of investigation.mjs `openNewTrace` | Old R91 | New test |
| --- | --- | --- |
| m91i-a: `reinforced: false` | FAIL | FAIL |
| m91ii-a: `reinforced: result.reinforced && false` (the matched text a prefix of it) | ok - missed | FAIL |
| m91i-b: the description's `playerText` line removed | FAIL | FAIL |
| m91ii-b: `playerText: ""` written after the description's line | ok - missed | FAIL |
| m91i-c: the kind's own check (`if (!REMNANT_TYPES[result.type])`) never true | FAIL | FAIL (first draft: ok) |
| m91i-d: `tiedToCrime: null` | FAIL | FAIL |
| the clean copy | ok | ok |

m91i-c passed the first draft of the new test: an unknown kind is refused by the Observe-number check below the kind's
own, with other words. The test now also reads that the off-list kind was warned with `newTraceBadType`, and fails it.

R91's assertions not held by the new test, kept in tier 0 and marked: the kind list read from `REMNANT_TYPES` through
`findableKind`, the window's two flag fields, the dashboard's `newTrace` button and its handler (`runDashboardButton`
not exported), and the nine keys localized.

### R92 -> "a reshape's ruling is the GM's, reads the trace as it stands ... (R92's ruling half, driven; was R92)"

| Mutant of cleanup.mjs `applyReshapeRuling` | Old R92 | New test |
| --- | --- | --- |
| m92i-a: its GM gate removed | FAIL | FAIL |
| m92i-b: `safeName` the proposal's name unbounded | FAIL | FAIL |
| m92ii-b: `reshapeTrace` handed `String(name)` where `safeName` stood (`plainText(name,` still there) | ok - missed | FAIL |
| m92i-c: the reinforced refusal never asked (`if (false)`) | FAIL | FAIL (it throws: no claim is made on a reinforced trace) |
| the clean copy | ok | ok |

The first draft of the new test failed on the clean tree, measured: its console case awaited the proposal's write before
the ruling, so `asConsole`'s player seat (the call's synchronous start alone) had closed and the ruling ran as the GM.
The proposal is written first now.

### R96 (a), in place

| Mutant of projects-map.mjs `projectCard` | Old R96 | R96 rewritten |
| --- | --- | --- |
| m96i: the secrecy row pushed before the GM's branch | FAIL | FAIL |
| m96ii: `if (!game.user.isGM) rows.push([t("DRPG.Project.cardSecrecy"), "x"]);` after the GM's branch | ok - missed | FAIL |
| the clean copy | ok | ok |

### R34 -> "a planted item goes to the first Search that finds something, never to one that misses (was R34)"

| Mutant of action-search.mjs | Old R34 | New test |
| --- | --- | --- |
| m34i: `performSearch` calls `searchDraw` before `searchNothing` on a miss | FAIL | FAIL |
| m34ii: `searchNothing` calls `searchDraw` first and drops its answer (`performSearch`'s order and the one `takePlant` caller unchanged) | ok - missed | FAIL |
| the clean copy | ok | ok |

R34's assertions not held by the new test, kept in tier 0 and marked: no `takePlant` in `runSpend`, `searchedBy` asked in
`runTakePlant`, the plant check's `lateMs`, and one `SearchTokens.takePlant(` in the action family.

From batch 5 on, mutants run on two detached copies: d7566926's test files for the old test and this branch's for the new
one, each mutant applied to both (an in-place (a) and its old self share a name).

### R57 (a), in place

| Mutant | Old R57 | R57 rewritten |
| --- | --- | --- |
| m57i-a: investigation.mjs `wireKeyLimitOverride` without its `apply();` | FAIL | FAIL |
| m57ii-a: `apply();` kept, every limited row disabled after it | ok - missed | FAIL |
| m57i-b: utils.mjs `wirePortraitPickers`'s callback writes no hidden field (`const live = null`) | ok - missed | FAIL |
| m57ii-b: the in-step guard joined by `&& false` (`getAttribute("src")` still before the callback) | ok - missed | FAIL |
| the clean copy | ok | ok |

### R32 -> "a Key row's Save pushes the plan's words onto its trace only when the row was pointed at it ... (was R32)"

| Mutant of investigation.mjs `saveKeyPlan` | Old R32 | New test |
| --- | --- | --- |
| m32i: `name: take.name ?? stored.name` (F6 itself: the plan's name on every Save) | ok - missed | FAIL |
| m32ii: `const repointed = "token" in take || true;` | ok - missed | FAIL |
| m32i-b: `name: take.name ?? ""` (a repoint carries no name) | FAIL | FAIL |
| the clean copy | ok | ok |

R32's F1 half (a row the filter hides is not read as blanks) stays in tier 0 as text: the reader is investigation.mjs
`readCaseFields`, not exported, and the hidden row exists only in the open dashboard.

### R37 -> "a Tamper window closed after a landed concealment roll keeps its price ... (was R37)"

| Mutant of cleanup.mjs | Old R37 | New test |
| --- | --- | --- |
| m37i: `releaseTamper`'s `if (rolled)` never true | FAIL | FAIL |
| m37ii: `attemptCleanup` asks `releaseTamper` with `rolled: cover === "roll"` (never true; `releaseTamper` unchanged) | ok - missed | FAIL |
| the clean copy | ok | ok |

The first draft of the new test failed on the clean tree, measured: `aloneTogether` asked `world.*` after the fixture had
placed its trace (rule 2 of the test contract); it is told the test asked first (`{ asked: true }`).

### R46 -> "Analyze takes its price before the dice ... (was R46)"

| Mutant | Old R46 | New test |
| --- | --- | --- |
| m46i-a: action-analyze.mjs `const free = Boolean(options.free);` | FAIL | FAIL |
| m46ii-a: `... && game.user.isGM \|\| Boolean(options.free) && !game.user.isGM` (the matched spelling still there) | ok - missed | FAIL |
| m46i-b: the closed window's `refundPrice` removed | FAIL | FAIL |
| m46ii-c: messenger-app.mjs `refundOnCard` taking `const amount = Number(data.amount) \|\| step.amount` | ok - missed | FAIL |
| the clean copy | ok | ok |

A draft of the new test's comment named a different (ii) mutant for the free road (`|| Boolean(options.freeAll)`) that a
call with `free: true` would not reach; corrected before the run, and the table above is the one run.

## Gates

- Batch 1 (R87, R88, R172, R305, R306, R430, R1120): `node --check` on both test files; `node tools/check.mjs` 19 parts,
  all green; lint 346 files, 0 problems; by name: R87's and R88's new tests 2 ran, 0 failed (10.7 s); R88, R172, R305,
  R306, R430, R1120 by `--only` 6 ran, 0 failed; tiers 0-1 whole 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (440 s; one fewer ran than the pilot's 1419: R87 gone).
- Batch 2 (R89, R145, R39, R40, R376, R1103, R1135, R1199, R3143): `node --check` on both test files; check 19 parts, all
  green; lint 346 files, 0 problems; by name: R89's and R145's new tests 2 ran, 0 failed (9.9 s); the nine tier-0 tests
  by `--only` 9 ran, 0 failed. Tiers 0-1 whole, first run: 1418 ran, 1402 passed, **1 failed** (R171), 16 skipped, 0 red
  (438 s). R171 was right: R89's new test read the Observe store's key as `SETTINGS.observePending`, a GM store's key raw
  outside the engine. It reads `observeStore.spec.key` now (the R3712 fix's road); R171 and the test by name 0 failed,
  and m89i-a, m89ii-a and m89ii-b, run again on the copy with the corrected test, still fail it. Lint again 0 problems. Second run: 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (429 s).
- Batch 3 (R36, R91): `node --check`; check 19 parts, all green; lint 346 files, 0 problems; the new tests by name 2 ran,
  0 failed; R36 and R91 by name 0 failed; tiers 0-1 whole 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (422 s).
- Batch 4 (R92): `node --check`; check 19 parts, all green; lint 0 problems; the new test by name 1 ran, 0 failed; R92 by
  name 0 failed; tiers 0-1 whole 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (441 s).
- Batch 5 (R34, R53, R96, R143): `node --check`; check 19 parts, all green; lint 0 problems; R34's new test by name 1 ran,
  0 failed; R34, R53, R96, R143 by name 0 failed; tiers 0-1 whole 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (453 s).
- Batch 6 (R32, R57): `node --check`; check 19 parts, all green; lint 0 problems; R32's new test by name 1 ran, 0 failed;
  R32 and R57 by name 0 failed; tiers 0-1 whole 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (446 s). That run
  read a tree that briefly held the next batch's first test (written in before the run ended, then taken out); run again on
  the committed tree alone: 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (452 s).
- Batch 7 (R37, R46): `node --check`; check 19 parts, all green; lint 0 problems; the new tests by name 2 ran, 0 failed;
  R37 and R46 by name 0 failed; tiers 0-1 whole 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (446 s).
