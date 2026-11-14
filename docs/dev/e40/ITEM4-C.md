# E40 item 4, slice C - status

Slice C of `docs/dev/e40/ITEM4.md`: the trial, the verdict, the chapter, Level Up, the season, the clock. 28 tests (R55
the pilot's). Started 13.11.2026 from d7566926 on `claude/e40-item4-c`. R numbers R5150-R5169; tier-2 tests under the
"// E40 item 4, slice C" line only.

## Picks

(a) in place, (b) tier 2, (c) text guard. A (b) whose tier-0 test keeps an assertion the new test does not hold is
"(b) + (c)": the tier-0 test trimmed to it and opened with a TEXT GUARD comment (rule 1 (b)).

| R | Pick | Reason | Where it went |
| --- | --- | --- | --- |
| R29 | (b) + (c) | The gather leaving the dead is driven: `gatherEveryone` on a body, a Monocub and a living student. What stays is one rule every reader asks (checkBodyFound asks `bodiesToDiscover`, its exclusions named; R347 drives its cases on fakes) and the one queue both announcements wait in, whose outcome is a race | tier 2 "the body's gather leaves the dead where they lie and walks the living and a Monocub (E40 item 4: R29's rule, driven; was R29)"; R29 trimmed |
| R30 | (c) | An order in `applyVerdict` (the refusal, then the lock, before anything else) whose outcome is a race of two verdicts; the refusal itself is driven by tier 2's E41-T2 | marked |
| R42 | (c) | An order of refusals in `performAction` and `crossingVerdict`, and a branch `hopeCallBarred` deliberately lacks; `hopeCallBarred` is not exported (would need an export of hopeCallBarred). E40-T3 drives the tile and the press per phase | marked |
| R43 | (c) | "Only there": one caller of `openTrialBudget`, a census of callers. Driving the entry's refill drives the whole entry (the record blanked, the hall, the Key fee); not converted in this slice | marked |
| R44 | (c) | One rule every reader asks (`floorRefusal`, `targetRefusal`) and a call nothing may make (`hasGm(`) | marked |
| R45 | (c) | `seizeFloor` is not exported (would need an export of seizeFloor) and runs from a card hook on the primary; its shape is what is read | marked |
| R55 | (b) | The pilot's (ITEM4.md) | tier 2, R55 removed |
| R56 | (b) + (c) | The window's refusal in an Eclipse is driven, on the GM and from a console. What stays is the case dashboard's footer, the greyed button's reason and `keepFresh`: a drawn window's shape | tier 2 "in an Eclipse the body's window is refused before its form, and only to a GM: ... (E40 item 4: R56's rule, driven; was R56)"; R56 trimmed |
| R58 | (b) + (c) | The vote's four events, each after the record holds what it reports, are driven on the primary GM (a vote opened, `recordBallot`, a reminder, the close, a close nobody answered). What stays is the console's tick, its hooks and watch, the overrun's words and the +30 s's road (tier 1's R1024 drives the arithmetic) | tier 2 "the trial console hears every change of the vote after the record holds it: ... (E40 item 4: R58's rule, driven; was R58)"; R58 trimmed |
| R67 | (b) + (c) | `markDeceased`, the Students window's "dead" and `setMonocub` are driven. What stays is the order inside `killCharacter` and `incidentVictimDied` and the repair calling the helper, which only a running incident's Stage 6 shows | tier 2 "a repair moves the flags and says nothing: ... (E40 item 4: R67's rule, driven; was R67)"; R67 trimmed |
| R68 | (a) | `campaignRows` and `campaignFieldsHtml` take the clock as an argument: both windows' chapter fields drawn from clocks handed in, no world read or written | R68 rewritten in place |
| R70 | (a) + split | `guardTextFields` driven on a window built in the page and taken away after. The markers' places (`mastermindHopeBox`, not exported; the cue picker inside `soundPlayPane`) and the two rules' order stay text, split out under a new number (rule 4) | R70 rewritten in place; R5150 (c), new |
| R74 | (c) | `wireSetupSteps` and `wireSeasonTiles` are not exported (would need an export of wireSetupSteps); a row's hand-off and the opener's round trip are an order of a window chain | marked |
| R178 | (c) | A census of the lifts' callers over every module file | marked |
| R221 | (c) | A census of character.mjs's writers and their GM gate | marked |
| R315 | (c) | The verdict window's footer, select and `read` as built; tier 2's three named verdict-window tests drive what they do | marked |
| R316 | (c) | A census of the lock's writes, an order inside `carryOutSentence`, words the card must not name; tier 2 drives the card and a verdict stopped | marked |
| R317 | (c) | Orders inside `runAdvancementBatch` and `verdictLevelUps`; tier 2's two named Level Up tests drive both | marked |
| R318 | (c) | Readers' shape: one write in the queue, numbers read held, each refusal before the latch or the send; tier 2's three named Level Up tests drive what they refuse and stamp | marked |
| R355 | (c) | The same shape for a Level Up's experience and the reset's restore; a reset is not the suite's to run (M10), tier 2's two named tests drive its halves | marked |
| R377 | (c) | `resetSeason` is a reset (M10); an order and a compare's shape inside it. Scenario 65's U drives it | marked |
| R436 | (c) | A census of `gatherEveryone`'s callers and arguments, who names `returnTheLiving` and `setTrialExit`, and orders whose outcome is a stop half way | marked |
| R583 | (c) | One writer and one reader of the hall's flag, counted over every module file | marked |
| R591 | (c) | Censuses of the Objection's roads (listeners, declarations, branches, callers, data readers, static imports) | marked |
| R1035 | (c) | A census of the writers of `permissions.BROADCAST_AUDIO`, a deletion's spelling, orders in `reconcilePhase`, a bridge row's and a store's shape | marked |
| R1192 | (c) | A census of the one roster and of every function walking the students by death and the Monocub flag | marked |
| R1259 | (c) | A census of two settings' writes, each on its one road | marked |
| R2054 | (c) | Where the bar is drawn and which kit boxes eight window sites use: markup and its builders | marked |

## Mutants (rule 3)

Run on a detached worktree of d7566926 (`DRPG_REPO`), each break applied once, the old test (d7566926's tier files)
and the new one run on it, then both on the clean copy. Never committed.

| Test | Mutant | Old | New |
| --- | --- | --- | --- |
| R68 | m1: gm-campaign.mjs `campaignRows`, the chapter's `max: Math.max(CHAPTERS_PER_SEASON, now)` -> `max: CHAPTERS_PER_SEASON` | FAIL | FAIL |
| R68 | m2: the coercion `Number.isFinite(stated) && stated >= 1 ?` gains `&& stated <= CHAPTERS_PER_SEASON` (every word the old test read kept) | ok - missed | FAIL |
| R70 | m1: utils.mjs `guardTextFields`, the third listener's `button.click()` removed | FAIL | FAIL |
| R70 | m2: the button looked up across the window (`const near = root;`), not the field's own fieldset | ok - missed | FAIL |
| R67 | m1: monocub.mjs `setMonocub`, `if (was === Boolean(value))` -> `if (false)` | FAIL | FAIL |
| R67 | m2: `const was = isMonocub(actor) && false;` (the text kept) | ok - missed | FAIL |
| R67 | m3: chapter.mjs `markDeceased` posts a card (`ChatMessage.create`) after the flag | ok - missed | FAIL |
| R67 | m4: `markDeceased` ties the chapter's traces (`tieChapterTraces`) after the flag | FAIL | FAIL |
| R29 | m1: call-world.mjs `gatherEveryone`'s filter keeps only `!isMonokuma(actor)` | FAIL | FAIL |
| R29 | m2: the Monocub's exception turned round, `!(isDeadForGm(actor) && isMonocub(actor))` | ok - missed | FAIL |
| R56 | m1: chapter.mjs `openBodyDiscoveryDialog`, `if (isEclipse())` -> `if (false)` | FAIL | FAIL |
| R56 | m2: `if (isEclipse() === "never")` (the text kept) | ok - missed | FAIL |
| R58 | m1: vote.mjs `recordBallot`'s `Hooks.callAll("drpgBallotsChanged")` removed | FAIL | FAIL |
| R58 | m2: the ballot's `ballotStore.patch(` deferred a tick (`Promise.resolve().then(...)`), the text and its place kept | ok - missed | FAIL |
| R58 | m3: `closeRound` writes the vote closed after its event, not before (the first "open: false" still above it) | ok - missed | FAIL |
| all | the clean copy | ok | ok |

Limits, measured or read: R56's new test sees the Eclipse refusal before any form and before the GM gate, not its
place against `placeScenes(` (a world with rooms answers the same either way). R67's m4 was killed on the harness
world, which of its readings failed not recorded; remnants.mjs `tieChapterTraces` whispers a card only when it ties a
trace, so on a world with no untied trace of this chapter the tie would show nowhere this test reads.

## Gates

| Batch | Tests | node --check | check.mjs | lint | by name | tiers 0-1 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | R29, R30, R42, R43, R44, R45, R56, R67, R68, R70, R5150 | ok | 19 parts green | 0 problems | tier 0: 7 passed; tier 2: 3 ok (with R55) | 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red (406.2 s): R5150 the one more |
| 2 | R58, R74, R178, R221, R315, R316, R317 | ok | 19 parts green | 0 problems | tier 0: 8 passed; tier 2: R58's ok | 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red (416.9 s) |
| 3 | R318, R355, R377, R436, R583, R591, R1035, R1192, R1259, R2054 | ok | 19 parts green | 0 problems | tier 0: 11 passed; tier 2: the five driven tests of slice C (R55's with them) ok together | 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red (414.5 s) |

Baseline at d7566926, read here before any change: 1419 ran, 1404 passed, 0 failed, 16 skipped, 0 red (433.9 s).

## Summary

27 tests read (R55 the pilot's): (a) 2 - R68, R70; (b) + (c) 4 - R29, R56, R58, R67, each driven in tier 2 with its
tier-0 test trimmed to what it still reads as text; (c) 21 - the rest; and R5150, split out of R70, a new text guard and the one new number. No
tier-0 test was deleted: each converted one kept an order or a shape the new test does not hold (rule 1 (b)). New
tier-2 tests: four, under slice C's line beside R55's. No new test passed a mutant it was written for.

For the owner (defaults taken, not decided here): exports that would let a text guard be driven - calls.mjs
`hopeCallBarred` (R42), trial.mjs `seizeFloor` (R45), season-setup.mjs `wireSetupSteps` (R74), mastermind.mjs
`mastermindHopeBox` (R5150). R43's entry refill is driveable without an export but drives the whole entry into a trial;
left as a text guard. R30, R315-R318 and R355 read shapes whose behaviour named tier-2 tests already drive; kept, not
deleted, as rule 1 asks a new test for a deletion.

