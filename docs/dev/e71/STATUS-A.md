# E25/E71 line A: status

Line A of the four text lines (group A of E71's batches, with E25's content part for the same namespaces): B01b, B02,
B03, B04, B05. Branch `claude/e71-a`, from `claude/fervent-sagan-gme4vt` at 1463f22b (14.11.2026). R block R6400-R6449.
The early pass (`STATUS.md`, `CHANGES.md`) is the base this line builds on; `FROZEN.md`'s keys are not rewritten here
(question A-Q1 below).

## C0: census of group A's namespaces (re-measured on 1463f22b, 14.11.2026)

Leaves and words as `tools/text-render.mjs loadTexts` reads them (lang files, and config.mjs's English prose through
`walkConfigProse`); words split on white space. "Keys" counts a plural family once. Frozen: a key `FROZEN.md` lists;
B01a: a text of `docs/dev/text-batch-B01a.json` the owner approved (O12, never rewritten); early pass: a key
`CHANGES.md` records a change of.

| Batch | Namespace | EN leaves | EN words | PL leaves | PL words |
| --- | --- | --- | --- | --- | --- |
| B01b | `DRPG.Config.DESPAIR_CALLS` | 32 | 192 | 32 | 152 |
| B01b | `DRPG.Config.REST` | 9 | 21 | 9 | 21 |
| B01b | `DRPG.Config.CLEANUP` | 8 | 58 | 8 | 49 |
| B01b | `DRPG.Config.INCIDENT` | 0 | 0 | 0 | 0 |
| B01b | `DRPG.Config.MURDER_OPENING` | 15 | 218 | 15 | 186 |
| B01b | `DRPG.Config.INDIRECT_MURDER` | 9 | 71 | 9 | 57 |
| B01b | `DRPG.Config.SABOTAGE_CONCEAL` | 5 | 64 | 5 | 52 |
| B01b | `DRPG.Config.ITEM_CATEGORIES` | 18 | 75 | 18 | 71 |
| B02 | `DRPG.Config.SFX_EVENTS` | 132 | 1430 | 132 | 1136 |
| B03 | `DRPG.Murder` | 197 | 2213 | 209 | 2031 |
| B04 | `DRPG.Action` | 140 | 1237 | 150 | 1125 |
| B04 | `DRPG.Price` | 40 | 256 | 68 | 386 |
| B04 | `DRPG.Actions` | 23 | 176 | 35 | 226 |
| B05 | `DRPG.Cleanup` | 113 | 1281 | 119 | 1197 |
| B05 | `DRPG.Tamper` | 16 | 163 | 20 | 198 |

`INCIDENT` (config.mjs:3767) holds numbers only: no `PROSE_KEYS` field, so B01b has nothing of it to edit.

Keys by batch (a family once), and what of them is not rewritten:

| Batch | Keys | Frozen | B01a | Early pass changed | No screen reaches |
| --- | --- | --- | --- | --- | --- |
| B01b | 96 | 2 (`DESPAIR_CALLS.newRule.label`, `.effect`) | 0 | 0 | 0 |
| B02 | 132 | 0 | 0 | 0 | 0 |
| B03 | 191 | 17 | 0 | 20 | 0 |
| B04 | 219 (with TraitRuling, Kit, Character) | 13 | 2 (`Action.dynamicHint`, `dynamicDescription`) | 28 | 3 |
| B05 | 124 | 6 | 3 (`Cleanup.transformActionHint`, `Tamper.coverHint`, `frameHint`) | 33 | 2 |

### Q-E71-1: the namespaces no batch names

The coordinator's map of 14.11.2026 (binding for the four lines, measured by where each namespace's keys are used in
scripts/) gives group A, beside its named batches: `DRPG.Despair`, `Overflow` and `Motive` (with B01b, the Despair
Calls), `Mastermind`, `Mask` and `Body` (with B03), `Rest`, `Reserve`, `Unit`, `Infiltrate` and `TraitRuling` (with
B04). This line's own reading (`node tools/text-map.mjs` on 1463f22b: 159 screens, keys 6855, 6448 assigned, 407
unassigned) had put `Kit` and `Character` on B04's screens too; by the map they are group B's, and this line does not
edit them.

| Added to | Namespace | EN leaves | Keys (a family once) |
| --- | --- | --- | --- |
| B01b | `DRPG.Despair` | 34 | |
| B01b | `DRPG.Overflow` | 83 | |
| B01b | `DRPG.Motive` | 22 | 124 in all |
| B03 | `DRPG.Mastermind` | 49 | |
| B03 | `DRPG.Mask` | 6 | |
| B03 | `DRPG.Body` | 2 | 57 in all |
| B04 | `DRPG.Rest` | 19 | |
| B04 | `DRPG.Reserve` | 7 | |
| B04 | `DRPG.Unit` | 8 | |
| B04 | `DRPG.Infiltrate` | 69 | |
| B04 | `DRPG.TraitRuling` | 23 | 96 and 18 |

### Group A's screens

The screens whose literal keys are mostly group A's (text-map.mjs, reader in brackets): murder-window (gm),
incident-tracker (gm), murder-cards (both), after-incident (gm), tier-zero (gm), betrayal (both), action-tiles (both;
136 of its 284 literal keys), cleanup (both), transform (player), move-body (player); and the config tables' windows
(calls, room-setup, the Sound window) for B01b and B02.

## Lint counts for group A's namespaces (before: 1463f22b)

`node tools/check.mjs text --all`, findings whose key is in a namespace of the batch:

| Batch | T4 | T5 | T7 | T11 | T15 | T16 | T17 | T18 | T19 | T21 | T22 | T23 | T24 | T27 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B01b | 1 | 14 | 2 | 2 | 0 | 0 | 0 | 1 | 0 | 0 | 2 | 0 | 0 | 0 |
| B02 | 11 | 28 | 0 | 1 | 0 | 0 | 2 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| B03 | 7 | 81 | 2 | 0 | 4 | 2 | 1 | 1 | 0 | 0 | 12 | 2 | 0 | 0 |
| B04 | 0 | 41 | 2 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 16 | 2 | 4 | 0 |
| B05 | 4 | 43 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 1 | 14 | 0 | 0 | 1 |

T12 and T25 find nothing in these namespaces. T13 (literals in code) in the files of group A's screens: incident-store.mjs
4, rest.mjs 2, despair.mjs 2, cleanup.mjs 1, action-project.mjs 1.

## Batches

Each batch's method (E71 plan C1-C19, B01a's schema): the facts of each key read in the function that runs its rule
and its sender (O6, M1, P3); the English written by one agent, the Polish by another from the facts, the code and the
old Polish without the new English (DB26); four reviewers with fresh context - EN, cold EN (the English after alone),
PL in the three steps of the guide's section 12, and mechanics for B01b, B03 and B05 (for B02 and B04 the EN reviewer
also read every fact against the code); one revision by an executor that settled every point, recording in each text's
`reviews` what stays open. The English reader for the player texts is agents (Q-E71-5: the owner named none). Every
batch file is held by `node tools/check.mjs text` (line B's glob, merged at d97bf964): 0 problems each.

| Batch | File | Texts | Namespaces | Left out of the batch, keeping their text | State |
| --- | --- | --- | --- | --- | --- |
| B01b | `docs/dev/text-batch-B01b.json` | 86 | the eight config tables (labels and plurals of `ITEM_CATEGORIES` untouched, N5), `Despair`, `Overflow`, `Motive` | `Overflow.hopeBlocked` (pair N30, wrong on the facts: Q-A1), `Config.MURDER_OPENING.killer.selfInflicted.despair` (narration no code runs: Q-A2) | landed c4d7073d |
| B02 | `docs/dev/text-batch-B02.json` | 54 | `Config.SFX_EVENTS` (and `sheetButton.label`, PL-d) | `SFX_EVENTS.passageFound.hint` (R599 pins it word for word) | landed c4d7073d |
| B03 | `docs/dev/text-batch-B03.json` | 97 | `Murder`, `Mastermind`, `Mask`, `Body` | none | landed c4d7073d |
| B04 | `docs/dev/text-batch-B04.json` | 97 | `Action`, `Actions`, `Price`, `TraitRuling`, `Rest`, `Reserve`, `Unit`, `Infiltrate` | `TraitRuling.propose` (E68's, O12) | landed c4d7073d, a0073b19 (2004efb6 took three back) |
| B05 | `docs/dev/text-batch-B05.json` | 66 | `Cleanup`, `Tamper` | `Cleanup.reshapeRulingWas` (R307 reads ": {now}.") | landed addb36d3, f1e08a2a |

Keys checked and left as they stand (already true and short, labels, fragments with a case contract, O12 texts):
B01b 134, B02 78, B03 151, B04 137, B05 57 (the writers' `checked` lists, each with a reason; not in the batch files).

Formerly frozen keys rewritten (A-Q1, released 14.11): B01b `Config.DESPAIR_CALLS.newRule.effect`, `Despair.poolGone`,
`Despair.removePoolAsk`, `Overflow.rulesChanged` (now pair N52's approved after), `Overflow.what.earthquake`, `.fog`,
`.rot`; B03 `Mastermind.alreadyDeadNote`, `finalTruthReminder`, `verdictIntro`, `Murder.actionBlocked`,
`actionHindered`, `drainStopped`, `useItemFumbled`, `useItemGone`, `useItemWorked`; B04 `Action.willCost`,
`Price.nothingLeft.analyze`; B05 `Cleanup.bodyNowhere`, `moveAlwaysTrace` ("Evident Remnant"), `moveConfirm`,
`moveIntro` (pair N17's approved after), `toolsBroken`. The other formerly frozen keys were read and kept as they stand.

### Code (literals moved, tests)

- R6400 (4e239997, `scripts/tests-tier1.mjs`): rest.mjs `applyRest` wrote the Rest report's three lines as English
  literals ("... Sanity cleared"): now `DRPG.Rest.applied.health/sanity/hope`, "+{n}" for each (D5, M7). Red first.
- T13 in group A's files read one by one: incident-store.mjs's four are the world-secrets descriptions and the lifts'
  log names (diagnostics, English by DB12), action-project.mjs's is an HTML attribute, cleanup.mjs's a selector: no
  UI literal left to move. cleanup.mjs is one of E54's eight files and was not edited.
- Tests given the new wording, each red first in a tier 1 run: R1160, R1155, R1157 (five U rows: `Rest.applied.*`,
  `Overflow.explainBody`, `Mastermind.hopeReadout`), R1163, R307, R121 (two Reshape notes keep a refusal that gives
  nothing back), tier 2's E66-T1.
- docs/text-style.md section 14: one row added at the table's end, `Action.reliefTool` and `reliefFresh` in
  `Action.dcTamperRelief` (B04's Polish fragments now open with „o {n}”).

### Lint counts after (a0073b19; before: 1463f22b), group A's namespaces with the map's additions

`node tools/check.mjs text --all`, findings whose key is in a namespace of the batch (the before row re-measured with
the added namespaces, so it differs from C0's table above):

| Batch | T4 | T5 | T7 | T11 | T15 | T16 | T17 | T18 | T19 | T21 | T22 | T23 | T24 | T25 | T27 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B01b before | 1 | 23 | 2 | 3 | 0 | 0 | 1 | 2 | 0 | 0 | 6 | 0 | 0 | 0 | 1 |
| B01b after | 10 | 9 | 1 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 34 | 0 | 0 | 0 | 0 |
| B02 before | 11 | 28 | 0 | 1 | 0 | 0 | 2 | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 0 |
| B02 after | 10 | 1 | 0 | 1 | 0 | 0 | 0 | 2 | 0 | 1 | 27 | 0 | 0 | 0 | 0 |
| B03 before | 9 | 96 | 2 | 0 | 4 | 3 | 1 | 3 | 0 | 0 | 15 | 2 | 2 | 0 | 0 |
| B03 after | 7 | 15 | 2 | 0 | 4 | 2 | 1 | 2 | 0 | 0 | 48 | 0 | 2 | 0 | 0 |
| B04 before | 2 | 72 | 2 | 1 | 6 | 6 | 3 | 3 | 1 | 0 | 50 | 2 | 5 | 1 | 0 |
| B04 after | 6 | 18 | 2 | 0 | 6 | 6 | 0 | 5 | 2 | 0 | 67 | 1 | 2 | 0 | 0 |
| B05 before | 4 | 43 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 1 | 14 | 0 | 0 | 0 | 1 |
| B05 after | 3 | 8 | 0 | 0 | 2 | 0 | 1 | 0 | 0 | 0 | 26 | 0 | 0 | 0 | 0 |

- T4 here is over the target only: no text of the five batches is over its surface's limit (the batch check makes that
  red). The rise in B01b is config descriptions that now state the rule whole (Bounty 41 words, the limit 45).
- T22 (the mirror, a report for good) counts where the Polish differs in shape from the English: its rise is the
  Polish written from the facts, not from the English (DB26).
- B04's T16 finds: a0073b19 put the three `TraitRuling.opening*` lines in the third person on T16's reading, and
  2004efb6 put them back: at the `openingRoll` stage murder-rules.mjs `tellOpeningRoller`'s audience is the roller's
  seat alone (tier 2's "the roller was not told while the GM picked ..." holds it), so the second person speaks to its
  one reader. B03's two are `Murder.closedVictimYou`, which `tellIncidentClosed` whispers to the victim's owners alone
  when nobody else is in the audience. All five are the detector's: it reads a helper's whole audience, not the stage or
  the branch the sender passes (for C21's T16 with no allowlist).
- Whole tree, on a0073b19 against 1463f22b: T5 found 1253 -> 1042, T4 304 -> 313 (over a target; over a limit
  unchanged in these namespaces), `check text`'s report found 3177 -> 3070 (c4d7073d). No lint was switched to FAIL
  (the coordinator's rule).

### Rebuilt rules exercised (B01b's writer, on its 45 config texts; the batches' reviews applied the rest)

Holds: O5, O9, O16, O18, B2, X2, X4, X6, X9, X11, X19, M5, N3, V1, P3, and the surface rows tile label, GM chat card,
tooltip. An exception: B3 (its key rules place only `hint`, `description` and `effect` of `DRPG.Config.*`; the
`success`, `failure`, `hope`, `despair`, `long` and `short` fields fall to no rule). Not exercised by B01b: O8, O11, O12,
X3, X5, X7, X8, X14-X18, X20, X21, N4, N6-N8, V3, and the button, window-title, tab and handbook rows.

## Questions (each with the default this line runs on)

| Id | Question | Answer |
| --- | --- | --- |
| A-Q1 | `FROZEN.md` froze keys of group A's namespaces for branches that have since shipped or are in the base. Released? | The coordinator, 14.11: released for every branch in the base or not to merge; gaps-a's keys stay frozen. None of group A's frozen keys is gaps-a's, so all are rewritten in their batch (listed per batch below). |
| A-Q2 | The batch files and `tools/text-render.mjs` `BATCH_FILES` | The coordinator, 14.11: line B makes the list a glob of `docs/dev/text-batch-*.json` and scopes `isOut` to B01a; until that lands this line checks its files with `batchSchema` from a script. |
| A-Q3 | Q-E71-1 by the map | The coordinator's map (above). |

## Test runs on the tip (876878f5)

| Run | Result |
| --- | --- |
| `node run-tests.mjs --tier 1` | 1606 tests ran, 1590 passed, 1 failed (R2001: the known base failure, the coordinator's), 16 skipped, 0 red; 502.5 s |
| scenario 10-murder | 45/45 checks |
| scenario 50-lang | 41/45: one check, "plural picks one/few/many", red on all four clients - it expects "Key Remnants" in `DRPG.Chapter.doneKeys`'s Polish, unchanged since 1463f22b ("Key Remnanty", the early pass's DB4 form), so red on the base too; `Chapter` is group C's and the scenario was not edited here |
| `npm run quick` | green (lint, check 21 parts, gate) |

## For the owner (each with the default this line ran on)

| Id | Key | Question | Default (what stands now) |
| --- | --- | --- | --- |
| Q-A1 | `DRPG.Overflow.hopeBlocked` | Pair N30 („Zaciemnienie blokuje Hope Calls ... Hope zostaje przy tobie”) and the English are wrong on the facts: every sender reads overflow.mjs `overflowBlocksHope`, the darkening that stops every gain of Hope (Hope Calls are Silence's, `overflowBlocksCalls`), and the reader is a GM, whose pool keeps its Despair. Proposed: "Despair: nobody gains Hope this time of day. The pool keeps its Despair." / „Despair: nikt nie zdobywa Hope o tej porze dnia. Pula zachowuje swój Despair.” | Both texts as they stand (the check forces N30 on any batch text of the key). |
| Q-A2 | `DRPG.Config.MURDER_OPENING.killer.selfInflicted.*` | "will read as somebody else's work" is narration no code runs (the Despair band only sets the Key Remnant count, murder-rules.mjs `resolveKillerOpening`). Facts instead: "It is done. The incident goes straight to the clean-up." / „Stało się. Incydent przechodzi od razu do sprzątania.”? | The narration stays. |
| Q-A3 | `DRPG.Murder.freeResolution` (pl) | Pair N27 says „weź” on a card several people read (P1, P2) and „Role reversal” (DB16). Third person: „W tej turze ofiara może wziąć Survive albo Role Reversal, które z nich jest dostępne, bez rzutu, i to działa.” | N27 as approved. |
| Q-A4 | `DRPG.Actions.allSpent` (pl) | Pair N56 „Wrócą na początku kolejnego Eclipse” narrows when actions come back (also at a time of day without an Eclipse and at a Class Trial's start, actions.mjs `resetAllActions`); the English after says "with the next time of day". | N56 as approved. |
| Q-A5 | `DRPG.Action.goalToolHint` | Pair N40's approved Polish (112 characters, „bronią”) cannot stand beside R3201 (E68 C13, the owner's Q5: „broń” within 116 characters). Which wins? | Both texts as they stand (out of the batch). |
| Q-A6 | `DRPG.Murder.stage.resolution` | The cards now call the stage after the fight "the clean-up" / „sprzątanie” (the player handbook's word, O14); the tracker's stage label still says "Resolution" / „Rozstrzygnięcie” (`Remnant.action.resolution` says "Clean-up"). Rename the label? | Kept. |
| Q-A7 | `DRPG.Config.SFX_EVENTS.stolen.label` | "A student's things were gone through" / „Ktoś ruszał cudze rzeczy” (a caught Frisk takes nothing, so not "theft"). Another noun? | As written. |
| Q-A8 | `DRPG.Config.SFX_EVENTS.projectDone` | No GM hears it (a private card's plain sound flag): meant? The hint says so now. | The hint tells what the code does. |
| Q-A9 | `DRPG.Config.DESPAIR_CALLS.behindClosedDoors.effect` | The Mastermind passes a seal (movement.mjs `restrictedFrom`); may the public card say so? | Unnamed (M9); Pick the Lock named. |
| Q-A10 | `DRPG.Tamper.watched` | Departs from pilot pair 40 (the key now carries `{dc}`; a hit with Despair and either miss cost Sanity; a miss gives the student away). | The batch's text. |
| Q-A11 | `DRPG.TraitRuling.propose` | E100's button rule would say „Wyślij do GM-a” / "Send to the GM"; E68 wrote "Propose" after E66 (O12). | "Propose" kept. |

## Code faults found, and what became of them (the coordinator's list of 14.11, each red first, its own commit)

| # | Fault | Commit, test | Outcome |
| --- | --- | --- | --- |
| 1 | `Action.murderCancelled`'s {reason} on the GMs' card was the killer's own line ("try again") | 155556fa, R6401 | Fixed: `Action.murderNobodyGm`, `murderWitnessGm` (en, pl); tier 2's three tests and 66-rooms read them (77/77) |
| 2 | `nightNoteKey` sent `nightNoteIndirect` (night disadvantage) though E64 turned it off | 5ce68aec, R6402 | Fixed: the note reads the rolling side's `MURDER_OPENING` flags; `Murder.nightNoteNone` for a night that changes nothing |
| 3 | `tellOpeningRoller` sends both seats' lines to one audience | 2004efb6 (no test) | Not a defect: at the `openingRoll` stage the audience is the roller alone (tier 2 holds it); the third-person rewrite of a0073b19 was taken back |
| 4 | Lists joined with ", " instead of `listOf` | 4acd3f5b, R6403 | Fixed in murder-rules.mjs `applyUnlocks`, tail-gm.mjs `onTailCrossing`, watch-gm.mjs `startWatches`, action-briefing.mjs `tamperThresholdFacts`; `Cleanup.toolsBroken` (cleanup.mjs) waits for E54 |
| 5 | Dead keys `Murder.addThird`, `whoWalkedIn`, `nobodyElse`, `noStressLeft`, `betrayalConfirm` | 1f142e5e, R6404 | Deleted in both files (no reader in scripts, tests, scenarios, tools or docs but the 1.2.42 findings list) |
| 6 | cleanup.mjs `report` prints `Cleanup.stressSpent` on the free attempt | - | Waits for E54 (cleanup.mjs is split there), with `Cleanup.toolsBroken`'s `listOf` |

Also found, not on the list: secret.mjs `dropOldGmLines` matches `DRPG.Action.observeGm`'s current sentence to hide it
on old cards, so that text cannot change until the matcher does (kept word for word); tier 2 E66-T1 run alone leaves the
mask on Aiko's token in its restore, at 1463f22b as here.

Keys outside group A's namespaces that look wrong: none found that a group A batch needed changed.

## Needs a local Foundry

- The window batches' screenshots (the plan's C1-C19: EN and PL, both themes, 1366x768, 1024x768, 820x1180; nothing
  cut, buttons not wrapping, a toast at most 3 lines): the harness draws no layout, so none was taken. The longest new
  texts to look at first: `Config.DESPAIR_CALLS.bounty.effect` (41 words), the Sound window's two-line hints (B02's
  longest about 29 words), the crisis cards of B03, `Cleanup.moveHint` (111 characters, R3201's limit 116).
- LIVE-E71-01 (the plan's): the crisis cards read on the victim's and the killer's browsers in the third person.
- `node tools/text-render.mjs --batch docs/dev/text-batch-B0x.json` renders each batch's sheet for a reader; generated,
  not committed.
