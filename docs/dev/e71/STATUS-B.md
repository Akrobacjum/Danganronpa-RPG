# E71 group B: status (batches B06, B07, B08, B09, with E25's content part)

Branch `claude/e71-b`, from `claude/fervent-sagan-gme4vt` at 1463f22b (14.11.2026).

| Commit | What |
| --- | --- |
| 5c0521f6 | C0's first census (this file's first form) |
| d97bf964 | the batch tooling the coordinator gave this line: every `docs/dev/text-batch-*.json` a batch, Appendix C read for B01a alone, the control on files with a pilot copy, BATCH_LATER held against every batch's approved texts (its QUICK line names base 45d5f0e6, a slip for 5c0521f6) |
| 2db3cb1c | B06 |
| 8f3e3546 | B07 |
| 34c76fe2 | B08 (its message counts 211 texts; the file holds 207: four texts went back to their befores before the commit, below) |
| 8f3d53ae | B09 (its message names "Look's neighbors" among B09's namespaces: Look is B06's) |
| d0669dc1 | this file and the batch table |
| 3edf9359 | Observe's two labels back for the handbooks (scenario 62), „Truth Bullet” inflected in three Polish texts |
| 4c82415c | X16 allow rows for ten Sequence keys (its message says T5 allowed 72 -> 82; measured, 62 -> 82: the ten rows count in both languages) |

## C0, group B's part: the census (measured on 1463f22b)

The coordinator's map of 14.11.2026 is binding: group B holds the plan's B06-B09 namespaces and Sequence, Movement, Room,
FoundryTools, Facility, Look, Kit, Character, States, Sheet, SheetNotes, Summary, Passage and Ready. Despair, Overflow,
Motive, Unit, Rest, Rules, Infiltrate (group A), Zones, Rooms, Panel (group D), TrialScene (group C) and Tips (E102's)
are not this line's, though the first cut (before the map) gave some of them to B; their keys were dropped from the work
and are not in the batch files.

| Batch | Namespaces | Keys read | Changed texts | Facts |
| --- | --- | --- | --- | --- |
| B06 | Calls, RollDialog, Rolls, Roll, Look | 200 | 80 (en 69, pl 72) | 146, all read in a function |
| B07 | Observe, Analyze, TruthBullet, Remnant; Passage on passages-gm, find-passage | 249 | 78 (en 62, pl 73) | 171, 166 in a function |
| B08 | Items, Inventory, Handover, Steal, Loot, Frisk, Vault, Facility, Sheet, SheetNotes, States, Character; Passage on Room setup, the sheet, projects, messenger | 653 | 207 (en 149, pl 193) | 430, 403 in a function |
| B09 | Explain, Hud, Listen, Events, Move, Clock, Eclipse, Sequence, Summary, Kit, FoundryTools, Movement, Room, Ready | 327 | 101 (en 74, pl 95) | 199, 196 in a function |

"Keys read" counts a plural family once. Every key's row - screen, surface, readers, mode and what was done - is in
`docs/dev/e71/BATCH-TABLE-B.md`. A fact with no function is a note: a decision, the guide or a file with no function
(the schema allows it with a note).

Mode, read off `git blame -w` of lang/en.json on the full history: `full` - last written before 01.11.2026 (pre-guide),
edited in full; `check` - written after 01.11.2026 by a stage writing to the guide, or only checked (A8/A9: Room,
FoundryTools, Move.entered, Vault.image*), or frozen for gaps-a: lint and glossary only, changed for a named fault
(O12). The keys FROZEN.md froze for branches now in the base were first read as `check`; once the coordinator released
the freeze (14.11.2026), the 67 of them that the first round had left were edited in full (sub-batch R): 13 changed, and
their batch rows carry "mode: frozen ... edited in full".

## How each batch was made

Per sub-batch (eleven, then three for the map's additions and one for the released freeze), in fresh context: an English
writer read each key's code and wrote its facts, then the English; a Polish writer wrote the Polish from the facts, the
code and the old Polish, without the new English (DB26). Assembled into the B01a schema, the guards: an owner-approved
text is held (the B01a captions and BATCH_LATER keys, the pilot's twelve, gaps-a's frozen keys, two handbook-quoted
notes); a Polish that would drop an owner-approved naturalness pair is held; placeholders, digits and long dashes. Then
per batch the reviews - EN, a cold EN read (the afters alone), PL in three steps, and the mechanics review for B06 - and
one revision that took or rejected each point with a reason (`removed` "review: ..."); what stays open is the text's
`reviews`. Held by `node tools/check.mjs text` (batchSchema: 0 problems in each file).

| Batch | Review rows (en / coldEn / pl / mechanics) | Points taken / rejected in the revision | Open after it |
| --- | --- | --- | --- |
| B06 | 13 / 19 / 10 / 7 | about 55 / 9 | mechanics 1 (progressRefused, below) |
| B07 | 13 / 19 / 16 / - | about 55 / 3 | none |
| B08 | 21 / 30 / 15 / - | about 79 / 1 | en 1 (Vault.stashesNote's "16+") |
| B09 | 21 / 19 / 11 / - | 66 / 9 | en 1, coldEn 2, pl 1 (below) |
| R | 6 / 5 / 7 / 1 | 23 / 1 | none |

Texts that went back to their befores after tier 1 read them (edits after the revision): Vault.imageBroken (only
checked, A9; the GM handbook names it, R2036), Passage.tab.startHint and the Polish of Passage.tab.wayHint (the early
pass's approved review texts, R902), the Polish of Frisk.rowLabel (R620, below), Observe.anything (both languages) and
Observe.general's Polish (both handbooks name these labels: scenario 62's L2). Analyze.findPassageHint was cut to
108 characters (R3201: the owner's caption rule); Items.useTitle's Polish took „Użycie przedmiotu „{item}”” (R1161:
„Użyj przedmiotu” is a retired Polish name); eleven "can't" of the drafts written in full (DB8, T19).

## Lint for group B's namespaces

`node tools/check.mjs text --all`, the findings that name a key of group B's namespaces, on 1463f22b and on 8f3d53ae
(B06 / B07 / B08 / B09; the same on 3edf9359). No mode was turned (T4, T11, T12 and the rest stay as they are until the four lines land).

| Check | 1463f22b | 8f3d53ae |
| --- | --- | --- |
| T4 lengthOver | 8 / 16 / 13 / 14 | 7 / 28 / 25 / 11 |
| T5 patterns | 49 / 68 / 154 / 116 | 1 / 12 / 22 / 23 |
| T7 ruleNumberWords | 19 / 0 / 4 / 4 | 7 / 0 / 0 / 1 |
| T15 renderChecks | 0 / 0 / 16 / 14 | 0 / 0 / 16 / 14 |
| T17 oxfordComma | 0 / 1 / 2 / 1 | 1 / 3 / 1 / 5 |
| T18 telegraph | 0 / 0 / 3 / 0 | 0 / 0 / 1 / 0 |
| T22 mirror | 9 / 15 / 79 / 31 | 22 / 35 / 79 / 52 |
| T23 itemQuotes | 1 / 2 / 6 / 1 | 0 / 0 / 0 / 0 |
| T24 colonChains | 0 / 0 / 2 / 0 | 0 / 0 / 0 / 0 |
| T25 bareLeft | 0 / 0 / 0 / 1 | 0 / 0 / 0 / 0 |
| T27 naturalnessBefore | 0 / 1 / 1 / 0 | 0 / 0 / 0 / 0 |
| T8, T11, T12, T16, T19, T21 | 0 | 0 |

Read: T4's rise is all "over a target", none over a limit - GM cards and toasts that got back facts the reviews asked
for (M4), and a plural family counts once per form. T17's finds are candidates read one by one, none a list ("Sprint
and Burst", "living or dead"). T15's are placeholders the render has no fixture for ({alive}, {until}, {life}, ...),
not the texts. T22 is the mirror, a report: the Polish no longer follows the English's punctuation, which DB26 expects.
T13 (literals): see "Literals" below; the counts in these batches' files did not change (no code changed).

## Literals in the batches' files (DB12)

T13's finds in the files B06-B09 render (roll-dialog.mjs 17, call-effects.mjs 15, private-rolls.mjs 10, inventory.mjs 6,
frisk.mjs 5, movement-audit.mjs 18; remnants.mjs 19, an E54 file, read only) were read one by one: the labels a failure
is logged with (roll-dialog.mjs `failed(...)`), the reasons a run refuses with, which the bridge maps to a REASONS code
and the player's client says in their language (call-effects.mjs `playerArmRefusal`, inventory.mjs `repairRefusal`,
`transferItem`, frisk.mjs), the bridge table's `claims` notes (private-rolls.mjs), the console's migration and audit
lines (remnants.mjs, movement-audit.mjs; diagnostics stay English, DB12, N4), CSS values, and an old item description
kept to be matched (inventory.mjs `OLD_TIER_THREE`). None is a text a screen shows, so none was moved. The one word that
reaches a card, "Health"/"Sanity" in `Calls.damaged`'s {what} (call-effects.mjs `damageEffect`), is the resources'
name, English in Polish too. When E54 lands, remnants.mjs's finds are console lines as well: nothing waits on it here.

## Tests and scenarios

Tests changed (each red first on the old wording at the run named in its commit, then given the new text): R1158 (B06),
R904 and R970 (B08), R320, R1156 and R1160 (B09). The full tier 1 on the tip and the scenarios: see "Done" below.

## Questions, with the default taken

| Id | Question | Default taken |
| --- | --- | --- |
| Q-B-1 | A card whispered to the GMs: may it tell the GM what to do in the imperative ("Rule it in Investigation.")? | Yes in both languages (V3), and "you" for a GM something happened to stays out (P2): the role or the name. Movement.droppedFromNowhere carries the alternative if the owner rules the other way. |
| Q-B-2 | (the coordinator, 14.11: to the code-fix list) Calls.progressRefused: a progress Call that moves nothing (Game Integrity on a project at 0; Patronage racing a freeze or a finish) is paid and not refunded, against calls.mjs's refusal comment and the GM handbook 6.2 ("refused before it is paid"). Refuse it before the price, or refund it? | The text says what the code does now (progress unchanged, the price stays); the code question is the owner's (mechanics review, B06's batch row). |
| Q-B-3 | Owner-approved naturalness pairs the writers would widen with facts the code runs: N42 (noneReadied: also a project and a sabotage), N43 (wouldRestoreNothing: not true when an Overflow blocks Hope), N6 (Vault.notHere: {room} can be a list), N46 (Analyze.askHintHint: the row is offered with or without a Truth Bullet), N32, N60. | Each pair kept word for word; N42's text adds a sentence after it; the rest wait for the owner. |
| Q-B-4 | Labels the handbooks name: Observe.anything ("Examine a point of interest", „Zbadaj coś, co przykuło twoją uwagę”) and Observe.general's Polish („Rozejrzyj się po pokoju”) were the batch's; scenario 62 holds the handbooks to the labels. And Frisk.rowLabel's Polish: the glossary's `see-what-they-carry` (E71) says „Zobacz, co ktoś nosi”; both handbooks say „Zobacz, co nosi”, and R620 holds the row to them. | Kept as they stand; each label and its handbooks change together, with the handbook line (the batch's wording is in its texts' history, docs/dev/e71/STATUS-B.md and the B07 commit 8f3e3546). |
| Q-B-5 | Vault.neighboursNote and Vault.descriptionNote: the GM handbook quotes them (R431, R518); the batch's US spelling ("Neighbors", "grayed") and "Remnants" wait. | Kept as they stand; they move with the handbook line. The neighbors' column, hint and line did change. |
| Q-B-6 | Movement.outsideRooms in Polish: its hosts write „do pokoju {room}”, „z pokoju {from}”, „w pokoju {room}”, so the fallback renders „do pokoju poza pokojami”. | Kept; a host change (separate keys, or hosts without „pokoju” and fragments with their preposition, section 14) is code's. |
| Q-B-7 | The Sequence's capitals (14 keys) are display type on the full-screen sequences; X16 reads them as emphasis. | The coordinator's answer (14.11): allow rows. Ten keys T5 named (exitTitle, moodLabel, morningLine, publicEvents, stampGuilty, stampInnocent, tableDay, trialTitle, votesCounted, yourDay) have an X16 row in docs/text-budgets.json, appended after the last row. |
| Q-B-8 | A batch text no budget rule places needs a surface in the schema. | A stand-in named in the text's `removed` ("surface: ..."): its sender read at its code site, else tile-hint for a player's window line (as B01a did), gm-diagnostics for a GM's, player-card for the explainer. |

## For the coordinator: texts outside group B's namespaces

Found by group B's writers and reviewers; not changed here.

- `DRPG.Overflow.hopeBlocked` (A): says it blocks Hope Calls and the reader keeps their Hope; the code (`overflowBlocksHope`) is the Despair darkening, which blocks gaining Hope, read by the GM. Pair N30's Polish has the same error. `DRPG.Overflow.silenced` reads better as "Nobody can spend Hope Calls this time of day."
- `DRPG.Infiltrate.pick.held` (A): says the lock holds where only a barricade holds the door; a pick never tries a barricade. `Overflow.what.rot`: the code wears only what living characters carry. The first round's English for Infiltrate and Overflow sits in group B's scratch, not in a batch: ask for it if useful.
- `DRPG.Murder.yourTurn`, `theirTurn` (A): the dash beside `Events.waitingFor`, which became a colon here.
- `DRPG.Tips.Actions.nothingMatchesRefuseTooltip` (E102): says a refusal keeps the action; a refused Observe stays spent (action-observe.mjs `observeSpecific`). `DRPG.Tips.Setup.aStudentSNameTooltip`: "their player is told", but a grant sends no message.
- `DRPG.Panel.checksImagesBytes` (D): `{mb}` through `toFixed(1)`, not `localeFormat` (a point on a Polish page). `DRPG.Panel.refundCrossingNote` (D): „do {from}” takes a room in the nominative.
- `DRPG.Settings.chargeMovement.hint` Polish (D, lang/pl.json line 331): „Sprintem”; PL-a has only Reroll and Burst decline, „Callem Sprint”.
- Handbooks (the handbook line): the facility editor's button is now "Edit room action" / „Edytuj akcję w pokoju” (the GM handbook says "Room action"); `Vault.neighboursNote`, `descriptionNote` and the Frisk row (Q-B-4, Q-B-5).
- docs/text-style.md section 7, PL-g: its example quotes `DRPG.Items.singleUseSpent`'s old Polish.

## What needs code (from the batches' needsCode, shortest first)

- Lists joined with ", " instead of `listOf` (EN2): Vault notHere, rifleIntro, stashEmpty, gmTold, keyCopiesTakenGm,
  neighboursUnknown; Loot took, tookUnfound, traceNote, seenTaking (and quotes per item, DB31); passages-tab.mjs
  `rowHtml`; Move.notConnected (`notConnectedText`); roll-dialog.mjs `explainAdvantage` (also writes U+2212);
  vault-store.mjs `clearSplitPiece`. R976 and R970 read the current joins.
- A placeholder the code does not pass: Calls.refunded's {cost} has no unit; Vault.stashesNote's "16+" (config.mjs
  `stashThreshold`); Facility.applied.searchToken wants the count added and a plural family; Remnant.searchNote's
  "a {category}" wants an {a}; remnants.mjs `dropRemnant` passes the raw action id to noTokenGm's {action}.
- Dead keys: Vault.fogNote, Passage.tab.intro, Facility.editor.tabNote, Look.uiScaleAuto, uiScaleSlider, Passage.pick.cancel.
- use-items.mjs `grantItemEffect` joins "Used „X”." and its summary with " - "; call-effects.mjs `pickItem`'s row for a
  living student's item is a literal with no key.
- Facility.editor.tabLine is filed as a tab by the budgets' name rule; it is a note line.
- docs/text-budgets.json: X16 allow rows for the Sequence's capitals; scripts/tests-text.mjs: fixtures for {alive},
  {until}, {life}.

## Needs a local Foundry

- The screenshots of every window batch (EN and PL, Stained Glass and Legacy, 1366x768, 1024x768, 820x1180; nothing cut,
  buttons on one line, a toast at most three lines, a HUD row one line): no layout headless. Longest new texts to look
  at first: Explain.phase.eclipse, Observe.cardHint, Remnant.deathTied, TruthBullet.migrated, Frisk.gmKeptNow, the
  Room setup notes (Vault.stashesNote, applyLine), the roll window's locked toasts.
- LIVE-E71-02 and -03 as the plan proposes; for group B also: a Polish player reads the Calls' cards, the roll window's
  locked toasts and the Frisk and Palm cards at a real table.

## The coordinator's items of 14.11 (from group D's report)

1. `Vault.neighboursColumn` reads "Neighbors" since B08 (34c76fe2), with `neighboursHint` and `neighboursLine` (and
   "grayed"). `Vault.neighboursNote` keeps "Neighbours" because the GM handbook quotes its last two sentences and R431
   holds the quote (Q-B-5); `DRPG.Rooms.renamed` ("other rooms' Neighbours lists") is group D's. The handbook line
   changes the handbook's Neighbours (GM handbook section 9.1, lines 486, 494, 506 and 508 on 1463f22b) with the note.
2. `Items.iconsPinned` keeps "icon": the module's own UI tells a category's icon from a picture the GM picks
   (`Items.categoryTooltip` "The icon changes with it unless you pick a picture"; `pinItemIcons` leaves "a chosen
   picture" alone), and the glossary has no entry for either word.
3. „Truth Bullet” in Polish: of group B's six uninflected „Truth Bullets” on 8f3d53ae, three are now inflected
   (Items.takeNote, TruthBullet.faintTooltip, migratedTitle). Kept: Vault.noBullets (the owner's pair N34 writes „Truth
   Bullets to twoja wiedza”), Sheet.groupTruthBullets (the inventory group's label, the same word as
   ITEM_CATEGORIES.truthBullet.plural, a table-name label N5 holds) and TruthBullet.whereToFind (it names that label).
   Outside group B's namespaces, 36 keys still hold „Truth Bullets”: Settings.bulletSort.name, .hint; Chapter.keepBullets,
   deathNote, bulletsGone (few, many, other), revived, keepSecretUntilFound, keptUntilFound, optReveal, revealKeeps,
   typeless (few, many, other), optSweep, doneSweep (few, many, other), step.reveal, step.sweep; Panel.sweepBullets,
   sweepConfirm (few, many, other), sweptBullets (few, many, other), whoIsAliveNote; Anonymity.aboveLimited;
   Season.resetBullets (few, many, other), group.bullets; Config.PHASES.investigation.hint;
   Config.ITEM_CATEGORIES.truthBullet.plural (the table-name label).

## Done

On the tip 3edf9359 (the commit after it is this file):

- **Tier 1** (`node run-tests.mjs --tier 1`, after `npm ci`): 1605 tests, 1589 passed, 1 failed, 16 skipped, 0 red,
  491 s. The one failure is R2001 (the planned versions quoted for a stage), the coordinator's known base failure.
- **Scenarios** whose files name a changed key or hold a piece of a changed text (21, by a grep of
  audit/harness/scenarios for each changed key and each before's fragments of 18 characters or more), run on 8f3d53ae
  by `node cluster.mjs`: 10, 12, 13, 15, 17, 30, 33, 40, 65, 66, 67, 70, 71, 72, 74, 76, 83, 87, 97 green (their
  expected reds only, each a named Foundry limit); 62 red on two labels the handbooks name, fixed in 3edf9359 and
  green after (52/52); 63 red on E5 and I7 (the vote window's privacy note, `DRPG.Vote.privacyNote`, group C's key,
  untouched here) and red the same way on 1463f22b (77/79, run with DRPG_REPO on a worktree of the base): not this
  line's.
- **Lint**: `node tools/check.mjs text`, `parity` and `prose` green on every commit; `npm run quick` green before
  every push.
