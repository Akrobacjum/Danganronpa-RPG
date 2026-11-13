# Review for 1.2.111: the planner line (e97-98) at 4bab7361

Read only, 13.11.2026; the line not changed. Read against its merge base with origin/main, 4dfac3a9 (1.2.108): 19
commits, 27 files, +1439/-194, of which the code is scripts/investigation.mjs, case-schema.mjs, case-realize.mjs,
case-map.mjs, case-view.mjs, case-trial.mjs, gm-items.mjs, gm-panel.mjs, live.mjs, rooms.mjs, trial-floor-ui.mjs,
trial-floor.mjs, trial-zones-ui.mjs, utils.mjs and styles/components.css. `git merge-tree --write-tree` of the line with
origin/main (421f2395): no conflict. Severity: **blocking** (a GM-only fact on a player's browser, a lost save), **medium**
(a close path that does what it says only in the harness, a test that passes on a fault at a table), **minor** (a
narrower check, a stale comment, a world changed on upgrade), **note**. Each medium traced twice, from two places.

## Run here

| What | Result |
| --- | --- |
| tier 2 by name: the planner's seven (autosave twice, planned Remnants of every type, planned location, planned Autopsy, the case's ticks, planned minigames), R4451-R4454, R3917-R3919, R3661, R2052 and "every control in the module's own chrome" | 17 tests ran, 21 passed, 0 failed, 0 skipped, 0 red (18.5 s) |
| scenario 62-investigation (`node cluster.mjs`) | 51/51 checks, 0 failed, 29 s, exit 0 |
| scenario 30-security | 273/274 checks, 1 expected red (foundry-secret-door-type, a Foundry limit), 0 failed, 421 s, exit 0 |
| `node tools/check.mjs parity text dashes` | all green |

## 1. D2: what a player's browser receives

**Checked, nothing found.** Every plan the line adds is kept where only the GMs read it, and reaches a player only by
a road that already existed and that a GM starts:

| Plan | Kept in | Reaches a player | Read at |
| --- | --- | --- | --- |
| a planned Remnant's type and room | a case row, `caseSchemaStore` (a GM store, no player copy: gm-stores.mjs:1326, no `from`) | when a GM presses Place on the map, through New Remnant (`placeIncident`, investigation.mjs:2889) | case-schema.mjs `caseNodeOf`, `graphOf` |
| a Key slot's planned room (`room`, PLAN_FIELDS) | `keyPlanStore` (gm-stores.mjs:1313, GM store) | when a GM runs the realization or Place (`placeKeyRow`, `openRealization`) | investigation.mjs:67, :813, :1448 |
| the planned Autopsy's name, words and GM note | the case row `autopsy` | at the body's discovery, by `issueAutopsy` on the primary; the GM note in the answer key (truth-bullets.mjs `createTruthBullet`'s `gmNote`), the whisper carries the name and the words only | case-realize.mjs:229-245 |
| a node's planned minigame (question, answers, thesis, Logic Dive set) | the case row; a set's truths in `diveSetStore` (gm-stores.mjs:1354, GM store) | when a GM presses Start in the zones' window, filled in on the GM's browser (`startFromNode`, case-trial.mjs:151; `pickerHtml`'s `plan`); the floor carries no truth, as before | trial-zones-ui.mjs:235 |
| the ticks' trial stamp | `caseTickStore` (gm-stores.mjs:1339, GM store) | never | case-schema.mjs:418, :427 |

Every new reader of those stores sits behind `game.user.isGM` (`caseGraph`, `caseTicks`, `openRealization`,
`issueAutopsyDialog`, `openZonePicker`, `startTrialMode`, `sendPlannedAutopsy`). No new world setting, flag or socket
packet; world-secrets.mjs, migrate.mjs, gm-stores.mjs and bridge-table.mjs are not in the diff.

**note - the Autopsy can reach the players before the discovery's gather.** case-realize.mjs:183-186 starts
`sendPlannedAutopsy` from the hook without `waitUntil`, so on the primary it runs beside `runDiscovery`'s gather
(chapter.mjs:1265, `announceBody` answers before the gather). The whisper says nothing the stamp has not made public
(the victims are the table's once stamped, chapter.mjs:1236-1238), so no D2 change; the order on a player's screen
(Autopsy card, then the gather's) was not measured. If the owner wants it after the gather, the listener can hand its
promise to `waitUntil` - which would hold the gather for up to 1500 ms - or wait for the gather's card.

## 2. Writes past the primary or the bridge

**Checked, nothing found.** The line's writes: `setCaseNode`, `setCaseMeta` and `caseTickStore.patch` (GM stores, any
GM, an Assistant too, as Q8 and Q-E99-8 have it); `issueAutopsy` on the primary GM alone (the hook's gate at
case-realize.mjs:184 and the function's own at :230); `openNewTrace` and `placeInSlot`, a GM's own windows as before. No
player road is added and no bridge action changed.

The planned Autopsy's gate, read twice: `registerCaseAsk`'s new listener (case-realize.mjs:183) runs on the primary
alone and ignores `writer`; `announceBody` marks its row seen before it writes (chapter.mjs:1253), so the primary's own
stamp calls the hook once, and another GM's stamp reaches the primary once, from the setting's arrival
(`registerBodyAnnounced`, chapter.mjs:1377). `sending` (case-realize.mjs:228) and `autopsyIssued` keep it to once.

## 3. Autosave on close, and Cancel

**medium - Cancel is a discard in the harness only; at a table it saves the open node.** investigation.mjs:3288
`if (!action || (typeof action === "string" && action !== "close")) await saveOpenNode(drawnRoot);`, with the footer's
Cancel declared `close: { role: "cancel", action: "close" }` (investigation.mjs:3202).

- Trace 1: ui-kit.mjs:113-119 - "ApplicationV2 dispatches `data-action="close"` to its own close before DialogV2 sees the
  press ... Foundry closes the window, the callback never runs and the wait answers null. The harness's DialogV2 does
  not model that dispatch".
- Trace 2: trial-floor-ui.mjs:1845-1856, the measurement behind it (11.09, at a table): "A footer button carrying that
  action never reaches DialogV2's submit at all, so `DialogV2.wait` resolved as a dismissal" - and E21 C4 renamed the
  murder's end from "close" for the same reason (trial-floor-ui.mjs:262-265). LIVE-E21-06 (AUDIT 9.2, item 398) is the
  open live check of the same fact; the module assumes null everywhere else.

So on a table, Cancel answers null, `!action` is true and the open node is written - what 4bab7361 meant to remove. The
tier-2 test that holds the discard ("planner autosave: a node's write that fails ...; Cancel writes nothing",
scripts/tests-tier2.mjs:27162, its third step at :27210) clicks `button[data-action="close"]` on the harness's DialogV2, which answers
"close", so it is green on a behaviour no table has. The Table's changed fields are not written either way (Save is the
only road for them), so nothing is lost; the GM who presses Cancel to throw a node's text away has it kept.

Patch: give Cancel an action Foundry does not keep for itself - `close: { role: "cancel", action: "discard" }` - and
read it: `if (!action || (typeof action === "string" && action !== "discard")) await saveOpenNode(drawnRoot);` and
`if (!action || action === "discard") return null;`. The kit allows a cancel-role word with its own action
(ui-kit.mjs:118-119). The test then presses `[data-action="discard"]`, which a table and the harness answer alike.

**Checked, nothing found** on the other close paths, each read:
- the node's Close, Escape on it and a click on empty space: `onClose` writes, then shuts (investigation.mjs:2854);
- a pick of another node: `onPick` writes the open one first (:2849);
- a switch to the Table: `onMode` writes (:3162), not awaited, but `saveOpenNode` reads the fields synchronously before
  the redraw (`readCaseFields(open)` and `keepDrawn` at the call), so the redraw cannot change what is written;
- the X and Escape on the window, and every footer button but Save and Cancel: written off the closed element
  (`drawnRoot`, :3207, a closed window's element keeps its fields);
- Save: the action is the form's reading, not a string, so no second write; `keepDrawn` makes the fields written by a
  node's close read as drawn, so Save hands nothing on twice;
- a write that throws: the drawn values put back (`keepDrawn(field, was)`, :2817), measured by the tier-2 test (the
  field still holds the text, and the next close writes it);
- the node's read is scoped to its fieldset (`readCaseFields(open)`), and no Final Key Remnant field is read there
  (e3f98091; R4454): the earlier review's stand-in element is gone.

**note - a refused field reads as written.** `saveOpenNode` marks every dirty field drawn before the write
(investigation.mjs:2815), so a field `applyDashboardSave` refuses (another GM moved it under) is no longer dirty: the
refusal is told with its value, as Save tells it, but a later Save will not offer it again. Mark drawn only the fields
not in the answer's `refused` list, if the owner wants a refused value to stay the GM's change.

## 4. Migrations and defaults that change an existing world

**minor - a trial running when the module is updated loses its ticks from view.** case-schema.mjs:418 reads a tick only
where `(row.trial ?? null) === trialStamp(chapter)`. Read twice: on 1.2.108 and 1.2.109 (4dfac3a9 and origin/main),
`setCaseTick` writes `{ ticked, by, at }` with no `trial` (case-schema.mjs:363 on both), and `trialStartedAt` is
written at every trial's entry since 1.2.108 (trial-progress.mjs:359 on both). So a Class Trial entered on 1.2.109 and
continued on 1.2.111 has a stamp, its ticks have none, and every tick reads unticked; they stay stored. A world updated
between trials sees nothing. Patch: read a row with no `trial` as the current trial's when its `at` is at or after
`trialStartedAt` - `(row.trial ?? (Number(row.at) >= Number(trial) ? trial : null)) === trial` - which keeps a second
trial's start empty, since the first trial's ticks come before its stamp. (The stamp is the server's clock, `at` the
GM's; the two can differ by the clock skew, so a tick written in the first seconds of a trial could read either way.)

**note - a node planned with OBJECTION or Rebuttal reads as no mode.** case-schema.mjs:87; the row keeps the stored
value until its next Save writes the select's. Its Start button on the console goes with it. Deliberate (the owner's
"usuwamy objection i rebuttal") and stated in the code; worth one line in the release's text.

**note - End of chapter on the console waits for the case summary.** trial-floor.mjs:187 puts `caseSummary` before
`chapterEnd` while `summaryShown` is null, and the footer draws End of chapter only at its step (trial-floor-ui.mjs:1452).
A GM who does not want to show the players a summary has no End of chapter on the console in an ordinary trial; Edit
campaign's part at the bottom still ends it (the comment says so). The owner's to confirm; a trial entered before the
update has no `summaryShown` in its record and reads as before.

**Checked, nothing found**: `room` on a Key slot defaults to "" (`keyPlan`, investigation.mjs:162); a planned Remnant
with no `type` reads Incident (case-schema.mjs:94), so every row before this line keeps its meaning; MAP_GEOMETRY's
column gap moves only drawn positions (no coordinate is stored: `manual` is an order).

## 5. Tests

No test of the line ends with no assertion; each tier-2 test asserts once on a whole reading after its waits, with a
`must` naming what would make it measure nothing. Three narrower than their names:

**medium - the Cancel step measures the harness's DialogV2, not a table's** (section 3, the same fault): green at 4bab7361
on a path no table takes.

**minor - "every living student" is measured on a world with no dead student.** scripts/tests-tier2.mjs:27424:
`living` is computed with the same `isDeadForGm` the code uses, and the probe asks only `world.atLeast("livingStudents")`.
On the harness's world (4 living students) `living` is every student, so a send that ignored death would pass. Patch:
mark one fixture student dead for the GMs for the test (the deaths store, put back after) and expect it absent, or
`needs(...)` a world with a dead student.

**note - a FAIL where a skip would be the fact.** The planned Autopsy test fails, rather than skips, when a student
of the world already holds this chapter's Autopsy: `autopsyIssued` answers true, nothing goes out and `seen.to` is
`[]` (scripts/tests-tier2.mjs:27410). A `needs(!autopsyIssued(chapter), ...)` before the fixture would make it a fact
about the world. (The planned minigames test's `must(isPrimaryGm(), ...)` at :27646 and :27726 is the suite's common
form, used in many tier-2 tests, so not asked here.)

**minor - the store's header no longer says what a tick row holds.** gm-stores.mjs:1334 still reads `{ ticked, by, at }`;
since 1f0ebebf a row carries `trial` too (case-schema.mjs:427).

## 6. Texts

The new keys have their Polish twins, with `few` and `many` where counted (`autopsyWentOut`, `caseWaiting`); the earlier
review's note on `autopsySent` is answered ("Sent to the students." / „Wysłany uczniom.”). `node tools/check.mjs parity
text dashes`: all green.

## Not done here

- No run of the line at a table or on a v14 sandbox; the Cancel finding rests on the module's own measurement of
  11.09 and the kit's note, and LIVE-E21-06 is the check that would settle it.
- Not run: tiers 0-1 in full on the line, npm test, scenario 63 (changed by the line) and the other scenarios.
