# E40 item 4, slice A - status

Slice A of `docs/dev/e40/ITEM4.md`: the incident, the Eclipse, rolls, Calls, Despair, the bridge. 28 tests, R range
R5110-R5129 (none used: no test was split into a new tier-0 or tier-1 row), tier-2 tests directly under the
`// E40 item 4, slice A` line of `scripts/tests-tier2.mjs`. Base d7566926, branch `claude/e40-item4-a`. Written
13.11.2026.

## The picks

(a) in place, (b) tier 2, (c) text guard (ITEM4.md rule 1). "b + c" is a test whose driven half moved to tier 2 and
whose rest stays in tier 0, trimmed and marked as (c).

| R | Pick | Reason | Tier-2 test (name begins) |
| --- | --- | --- | --- |
| R6 | c | a census of every request's call sites over every file; the one wait's noGm before it sends is driven by tier 1 R165 | - |
| R11 | c | a census: no promise of its own outside the one wait; the wait's two clocks are driven by R165 | - |
| R18 | c | a census of every `useItem(` call; sheet.mjs `inCrisis` is not exported (would need an export of inCrisis) | - |
| R25 | b | an Eclipse opened and ended with the clock moved; deleted from tier 0 | "the action budget comes back as the Eclipse opens ..." |
| R26 | c | which files may pay a critical's Hope: a census of payers; a call shows a total, not its payer | - |
| R35 | b + c | the seals lifted as the Eclipse opens: driven; Edit campaign never running `setTimeOfDay`: a census of the panel family, kept | "the Eclipse lifts the seals and the restrictions ..." |
| R38 | c | forced-roll.mjs `onConfigured` and roll-dialog.mjs `grantsFor` not exported (would need an export of both) | - |
| R48 | c | sheet.mjs `costOf`, `costLabelFor`, `tamperBlock`, `repaintInPlace`, `refreshPricedTiles` not exported (would need an export of them) | - |
| R59 | b + c | the Eclipse refused before the window draws: driven; the running-incident order (no outcome: no incident runs in an Eclipse), the trap box's killer, `isComplete`, the tail's order, the class: kept | "the murder window in an Eclipse is refused ..." |
| R69 | b | Edit campaign's Apply in an Eclipse, three times; deleted from tier 0 | "Edit campaign's Apply in an Eclipse warns ..." |
| R75 | c | gm-team-dialog.mjs `confirmRemovePool`, `readTeamDraft` not exported (would need an export of both) | - |
| R76 | a | murder-ui.mjs `incidentTrackerHtml` is exported and pure on the incident it is handed: called on six made-up incidents | - |
| R80 | c | calls.mjs `wireNoteGate` not exported; an order of listeners in a window's event path (would need an export of wireNoteGate) | - |
| R81 | b + c | one card with its price after an effect that landed: driven; the three orders (charge, effect, refund against the card): kept | "one Despair Call bought from the sheet posts one card ..." |
| R82 | b + c | `callBarred` on each side's rules: driven; sheet.mjs `runCall` asking it first: not exported (would need an export of runCall), kept | "what shuts the whole Calls menu is answered by one reader ..." |
| R85 | c | roll-dialog.mjs `forceConfig` not exported, and the chips are Daggerheart's roll window (would need an export of forceConfig) | - |
| R86 | b + c | the list and the refusal of every key but Move, above the Eclipse: driven; the gate's order against the betrayal, the fight and the dead test: kept | "a Monocub is refused every action but Move ..." |
| R97 | c | an assistant GM's road; tier 2 runs on the primary alone; the loop is a call nothing may make | - |
| R101 | c | gm-team-dialog.mjs `readTeamDraft`, `paintTeamDraft` not exported (would need an export of both) | - |
| R144 | b + c | a Despair Call bought or paid on a player's client, a seal said there, the one gate's handover refusal in an Eclipse: driven; `free`, the pool that did not move, `verify` (not exported), the stashed key: kept | "four doors a console used are shut ..." |
| R194 | c | one rule every reader asks (the pilot's reading) | - |
| R205 | c | a census of the incident's writes against its queue | - |
| R302 | c | a census of every file for the roll-mode names; the tries' shape matters only where the constant throws (would need an export of writeWhisper, writeMode) | - |
| R800 | c | a crawl of what the render hook reaches | - |
| R948 | c | what the early start does not send or write: a census over its functions | - |
| R949 | c | what the GM's throw does not send or write, and its place: a census over the road's functions | - |
| R1101 | c | a census of every `rollTrait(` call | - |
| R1194 | c | both roads are driven by E37-T2; that neither calls start or end itself is a call nothing may make | - |

Counts: (a) 1, (b) 2, (b + c) 6, (c) 19. Deleted from tier 0: R25, R69. Trimmed and marked: R35, R59, R81, R82, R86,
R144. Marked, unchanged otherwise: the 19 (c).

## Mutants (rule 3)

Each a one-place edit of production code on a detached worktree copy (`git worktree add --detach`, `DRPG_REPO`), the old
test run at base d7566926 (tier 1 `--only R<n>`) and the new one on the slice's tree (tier 2 by name, or tier 1 for R76),
then put back; the runner and its definitions are outside the repository. Expected (the pilot's): a mutant that removes
the rule FAIL/FAIL, one that keeps the old test's text ok/FAIL, the clean copy ok/ok. Measured 13.11.2026; the clean copy
read ok/ok for each of the eight tests.

| Mutant (file: the edit) | Old | New |
| --- | --- | --- |
| R25 m1 eclipse.mjs: `refilled = await resetAllActions()` -> `refilled = []` | FAIL | FAIL |
| R25 m2 clock.mjs: `advanceTimeOfDay`'s `resetActions = false` -> `true` | ok | ok - see below |
| R25 m3 eclipse.mjs: `endEclipse` calls `resetAllActions()` after its advance | ok - missed | FAIL |
| R35 m1 eclipse.mjs: `await clearSeals();` removed | FAIL | FAIL |
| R35 m2 eclipse.mjs: `if (false) await clearSeals();` | ok - missed | FAIL |
| R59 m1 murder-ui.mjs: the Eclipse guard of `openMurderDialog` removed | FAIL | FAIL |
| R59 m2 murder-ui.mjs: `if (isEclipse() && false)` | ok - missed | FAIL |
| R69 m1 gm-campaign.mjs: the `eclipseStillOn` warning removed | FAIL | FAIL |
| R69 m2 gm-campaign.mjs: GMP-04 back (`result.timeOfDay !== undefined`) | FAIL | FAIL |
| R69 m3 gm-campaign.mjs: `before.eclipse && !moved` | ok - missed | FAIL |
| R76 m1 murder-ui.mjs: `!now.selfInflicted` dropped from the killer's line | FAIL | FAIL |
| R76 m2 murder-ui.mjs: the warning worked out, never put in the markup (`${false ? box(`) | ok - missed | FAIL |
| R81 m1 calls.mjs: `spendDespairCall(user.id, key)` (the purchase announces itself too) | FAIL | FAIL |
| R81 m2 calls.mjs: the price's format kept, `false &&` before it | ok - missed | FAIL |
| R81 m3 calls.mjs: the card built, `if (false) await announce(` | ok - missed | FAIL |
| R82 m1 calls.mjs: `callBarred`'s Eclipse line removed | ok - missed | FAIL |
| R82 m2 calls.mjs: `phase !== "classTrial"` | ok - missed | FAIL |
| R82 m3 calls.mjs: `isDeadForGm(actor) && false` | ok - missed | FAIL |
| R86 m1 action-rolls.mjs: the Monocub gate `if (false)` | FAIL | FAIL |
| R86 m2 action-rolls.mjs: `cubCheck(null)` | ok - missed | FAIL |
| R86 m3 config.mjs: `dispatchable: ["move", "listen"]` | FAIL | FAIL |
| R144 m1 calls.mjs: `spendDespairCallFor`'s GM gate removed | FAIL | FAIL |
| R144 m2 calls.mjs: that gate warns and goes on (`return null` dropped) | ok - missed | FAIL |
| R144 m3 despair.mjs: `spendDespairCall`'s gate warns and goes on | ok - missed | FAIL |
| R144 m4 call-world.mjs: `writeWorld`'s GM check removed | ok - missed | FAIL |
| R144 m5 frisk.mjs: `personActionRefusal`'s Eclipse line `if (false)` | ok - missed | FAIL |

No new test passed a mutant written for it. R25 m2 changed neither verdict: on this road `endEclipse` advances a
boundary the opening refilled already, and the E17 take-back's memory (`refilledFor`; the tier-2 test "the boundary
taken back twice ..." says `advanceTimeOfDay({ resetActions: true })` "refills nobody for a boundary refilled already")
reads as why - a reading, not measured further. R82 m1 kept the old test green because its cut of `callBarred` ran on to
`hopeCallBarred` and so took in `hopeCallRefusal`'s own `isEclipse()`. R144 m5: the old test read
`if (isEclipse()) return` in inventory.mjs `transferRefusal`, a line a give no longer reaches (since E64 a give asks
frisk.mjs `personActionRefusal`), so it held a refusal off the give road.

## Gates

Two batches, each gated by ITEM4.md rule 10 before its commit (13.11.2026, this machine, 4 cores, one harness at a time).

| Batch | Tests | Checks | Tiers 0-1 whole |
| --- | --- | --- | --- |
| 1 (c6d7a36) | R25, R35, R59, R69, R76, R82, R86 | `node --check` both files; `node tools/check.mjs` 19 parts green; `npm run lint` green; the six new tier-2 tests by name 6/6 ok; R35, R59, R76, R82, R86 by name ok | 1417 ran, 1402 passed, 0 failed, 16 skipped, 0 red (437 s): the pilot's 1419/1404 less R25 and R69 |
| 2 | R81, R144 and the 19 (c) | the same; R81's and R144's new tests by name 2/2 ok; the 21 changed tier-0 tests by name 21/21 ok | first run 1401 passed, 1 failed (R3727, E62's clock-timing test, outside the slice), 16 skipped; R3727 alone 2 runs of 2 ok; the whole run again 1417 ran, 1402 passed, 0 failed, 16 skipped, 0 red (392 s) |

R3727 was measured, not blamed: batch 2 changes no tier-0 or tier-1 test's code in its file's neighbourhood (comments and
trims of slice A's tests), it passed alone twice and the whole run passed on the second try, so the one failure is read
as a timing reading under the whole run's load (its check is 120 ms apart), as STATUS.md records of R3712 - a reading,
not proved.

## For the owner

- Exports that would turn a (c) into a call (rule 2 kept: none made): sheet.mjs `inCrisis` (R18), `runCall` (R82),
  `costOf` / `costLabelFor` / `tamperBlock` / `repaintInPlace` / `refreshPricedTiles` (R48); forced-roll.mjs
  `onConfigured` and roll-dialog.mjs `grantsFor` (R38), `forceConfig` (R85); gm-team-dialog.mjs `confirmRemovePool`,
  `readTeamDraft`, `paintTeamDraft` (R75, R101); calls.mjs `wireNoteGate` (R80); private-rolls.mjs `writeWhisper`,
  `writeMode` (R302); handover.mjs `verify` (R144).
- Default taken: R6 and R11 kept whole as (c), though their one-wait halves are driven by tier 1 R165 - ITEM4.md's
  rule 1 has no pick for "already held by another test", so nothing was removed on that ground.
