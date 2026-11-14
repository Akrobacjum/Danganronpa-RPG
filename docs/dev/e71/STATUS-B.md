# E71 group B: status (batches B06, B07, B08, B09, with E25's content part)

Branch `claude/e71-b`, from `claude/fervent-sagan-gme4vt` at 1463f22b (14.11.2026). Kept current as the work goes.

## C0, group B's part: the census (re-measured on 1463f22b)

| Batch | Namespaces | en keys | en words | Leaves added by the map (Q-E71-1) |
| --- | --- | --- | --- | --- |
| B06 | Calls 124, RollDialog 33, Rolls 38, Roll 8 | 203 | 1610 | 47: Despair 13, Overflow 12, Motive 7, Unit 6, Tips 5, Look 2, Rest 1, Rules 1 (despair.mjs, the calls and roll-window screens) |
| B07 | Observe 50, Analyze 28, TruthBullet 61, Remnant 73 | 212 | 1948 | 44: Passage 43 (passages-gm, find-passage), Tips 1 |
| B08 | Items 116, Handover 35, Steal 32, Loot 27, Inventory 3, Vault 128, Frisk 58 | 399 | 3937 | 129: Passage 98 (Room setup's passages tab), Tips 18, Facility 3, Rest 3, Rooms 3, Panel 2, Sheet 1, Overflow 1 |
| B09 | Explain 44, Hud 48, Events 60, Move 28, Listen 15, Clock 26, Eclipse 29 | 250 | 2336 | 81: Ready 22, Infiltrate 17, Overflow 17, Room 6, Movement 6, Motive 5, Zones 4, Rooms 2, Tips 1, TrialScene 1 |
| all | 22 | 1064 | 9831 | 301 |

How read: python leaf count of lang/en.json under `DRPG.<namespace>.`; words split on white space. The leaves: every
key of a namespace no batch names, placed by the screen map (`tools/text-map.mjs` `buildScreenMap`, as `node
tools/check.mjs text` builds it) on its screens, each screen given to the batch whose named keys it holds most of; a key
goes to the batch most of its screens belong to (Q-E71-1's default). 268 keys of unnamed namespaces reach no screen at
all (Zones 34, CaseMap 51, Facility 28, Overflow 24, TrialScene 20, Panel 20 ...): not taken here, for B17/B18 by
audience.

Mode of each key (git blame of lang/en.json on the full history): `check` (O12: last written after 01.11.2026 by a
stage writing to the guide, a key FROZEN.md lists, A8/A9's only-checked keys Room, Move.entered, Vault.image*) or
`full` (pre-guide: edited in full).

| Batch | keys | full | check |
| --- | --- | --- | --- |
| B06 | 250 | 178 | 72 |
| B07 | 256 | 198 | 58 |
| B08 | 528 | 380 | 148 |
| B09 | 331 | 208 | 123 |

The owner-approved B01a texts in these namespaces (`Observe.generalHint`, `nonObviousHint`, `specificHint`,
`Analyze.analyseBulletHint`, `findStashHint`, `Steal.takeHint`, `plantHint`; `BATCH_LATER` in tools/text-render.mjs) are
`check` and are not changed.

## Lint counts for group B's namespaces (node tools/check.mjs text --all, findings naming a key of B06-B09)

| Check | Before (1463f22b) B06 / B07 / B08 / B09 | After |
| --- | --- | --- |
| T4 lengthOver | 8 / 16 / 6 / 9 | (pending) |
| T5 patterns | 49 / 68 / 125 / 94 | (pending) |
| T7 ruleNumberWords | 19 / 0 / 0 / 4 | (pending) |
| T15 renderChecks | 0 / 0 / 10 / 10 | (pending) |
| T17 oxfordComma | 0 / 1 / 1 / 1 | (pending) |
| T18 telegraph | 0 / 0 / 3 / 0 | (pending) |
| T22 mirror | 9 / 15 / 69 / 22 | (pending) |
| T23 itemQuotes | 1 / 2 / 0 / 0 | (pending) |
| T25 bareLeft | 0 / 0 / 0 / 1 | (pending) |
| T27 naturalnessBefore | 0 / 1 / 0 / 0 | (pending) |
| T8, T11, T12, T16, T21, T24 | 0 in all four | (pending) |

## Method

Per sub-batch (B06a Calls; B06b RollDialog, Rolls, Roll and the leaves; B07a Observe, Analyze, Passage leaves; B07b
TruthBullet, Remnant; B08a Items, Inventory; B08b Handover, Steal, Loot, Frisk; B08c Vault; B08d leaves; B09a
Explain, Hud, Listen; B09b Events, Move, Clock, Eclipse; B09c leaves): an English writer (fresh context) reads each
key's code and writes its facts, then the English; a Polish writer (fresh context) writes the Polish from the facts,
the code and the old Polish without the new English (DB26); then per batch the reviews (EN, a cold EN read, PL in three
steps, and the mechanics review for B06).

## Needs a local Foundry

(pending)

## Questions, with the default taken

(pending)
