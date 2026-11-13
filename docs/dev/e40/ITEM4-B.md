# E40 item 4, slice B - status

Written 13.11.2026 on `claude/e40-item4-b`, started from d7566926 (claude/e39-40). The plan and its rules are
`docs/dev/e40/ITEM4.md`; this file is its rule 8 for slice B (the investigation): per test, the pick and its reason, the
mutant tables, the gates run. R range R5130-R5149: none taken (no test was split into a new tier-0 or tier-1 row).

## The picks

(a) in place, (b) tier 2, (c) text guard (ITEM4.md rule 1). "(b), not built" is a test read as behaviour whose driving
was not reached on this line: it stands unchanged in tier 0, unmarked, for a later pass.

| R | Pick | Reason | Done |
| --- | --- | --- | --- |
| R32 | (b), not built | the dashboard's Save driven on a filtered list and a renamed trace: a window, a fixture |  |
| R34 | (b), not built | a Search that finds nothing must leave the plant: a Search driven with a planted item; the `lateMs` and one-caller lines are a census |  |
| R36 | (b), not built | `plantOnPerson` (palm.mjs, exported) judged against the plant's thresholds, and Tamper's incident exemption: fixtures with a plant and an incident |  |
| R37 | (b), not built | `releaseTamper` (not exported) reached by closing Tamper's window after a landed concealment roll |  |
| R39 | (c) | which readers the fee, the charge and the finders call; the fee's counts are tier 2's (four named tests); `keyPlanStatus`'s off-plan count and the case's bar are read as text only | batch 2 |
| R40 | (c) | a census over the action family and cleanup.mjs, and a branch of `concealSabotage`, not exported | batch 2 |
| R46 | (b), not built | `performAnalyze`'s order (price before dice, the GM check before the price) with its windows answered; the call-site census of `gmRulingActions` is (c) |  |
| R47 | (b), not built | Tamper's one price through `attemptCleanup`/`attemptStageSix` with windows; the GM-side charge census is (c) |  |
| R49 | (b), not built | `createFind` (not exported), the give dialog's two guards, `publishReading` and `mintLootBullet` (not exported): several fixtures |  |
| R53 | (b), not built | `paintTamper` (not exported) on a sheet whose ledger answers late |  |
| R57 | (b), not built | a live window rebuilt with a picked portrait and the override ticked |  |
| R87 | (b) | `analyzeDc` and `resolveAnalyze` driven: a Neutral priced as Prep, its card's sentence | batch 1 |
| R88 | (b), trimmed | the cards' buttons pressed as a GM presses them; four assertions stay as text (below) | batch 1 |
| R89 | (b), trimmed | the store's scope read off Foundry's registry; a resolve with no record driven; the write-through stays as text | batch 2 |
| R91 | (b), not built | `openNewTrace` (exported) answered as a GM; the door and the i18n keys can follow it |  |
| R92 | (b), not built | the reshape's ruling roads; the one-writer census is (c) |  |
| R96 | (b), not built | the project card read as a player; the CSS line is (c) |  |
| R143 | (b), not built | ownership raised and a bullet edited by a player, each put back |  |
| R145 | (b), trimmed | the Analyze half driven; the Stage 6 order and the undo's receipt stay as text | batch 2 |
| R172 | (c) | a census of 30 derived store writers and 2 migrations; the difference shows only with a second GM's copy | batch 1 |
| R305 | (c) | a census of ten readers and writers of the tie; its behaviour is tier 2's | batch 1 |
| R306 | (c) | an order with no outcome a call sees; `claimRuling` not exported; the race is tier 2's | batch 1 |
| R376 | (c) | a census of five readers and three writers; the reset's reading is tier 2's and scenario 65's K | batch 2 |
| R430 | (c) | a census of two readers that must not name the canvas | batch 1 |
| R1103 | (c), not marked yet | `askWhatToAnalyze` not exported; the shown box is a stylesheet's `:has` rule |  |
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

## Gates

- Batch 1 (R87, R88, R172, R305, R306, R430, R1120): `node --check` on both test files; `node tools/check.mjs` 19 parts,
  all green; lint 346 files, 0 problems; by name: R87's and R88's new tests 2 ran, 0 failed (10.7 s); R88, R172, R305,
  R306, R430, R1120 by `--only` 6 ran, 0 failed; tiers 0-1 whole 1418 ran, 1403 passed, 0 failed, 16 skipped, 0 red (440 s; one fewer ran than the pilot's 1419: R87 gone).
