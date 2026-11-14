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

| Batch | State |
| --- | --- |
| B01b | writing |
| B02 | writing |
| B03 | writing |
| B04 | writing |
| B05 | writing |

## Questions (each with the default this line runs on)

| Id | Question | Answer |
| --- | --- | --- |
| A-Q1 | `FROZEN.md` froze keys of group A's namespaces for branches that have since shipped or are in the base. Released? | The coordinator, 14.11: released for every branch in the base or not to merge; gaps-a's keys stay frozen. None of group A's frozen keys is gaps-a's, so all are rewritten in their batch (listed per batch below). |
| A-Q2 | The batch files and `tools/text-render.mjs` `BATCH_FILES` | The coordinator, 14.11: line B makes the list a glob of `docs/dev/text-batch-*.json` and scopes `isOut` to B01a; until that lands this line checks its files with `batchSchema` from a script. |
| A-Q3 | Q-E71-1 by the map | The coordinator's map (above). |

## Needs a local Foundry

(none yet)
