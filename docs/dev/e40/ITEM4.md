# E40 item 4 - tier-0 tests that read behaviour as text

Written 13.11.2026 on the E39/E40 line (branch of this file). The plan's item 4 (`docs/dev/plans/E40.md` on `plan-130`):
"about 50 tier 0 tests with a regex on behaviour become function calls; the text guards stay an explicit group", each
replaced test "broken once before and after" (its risk). The owner's word, through the coordinator, 13.11.2026: do it
now, for 1.2.113, on four parallel lines - one per slice below - started from the commit that carries this file.

## The list, and what it is not

The 111 tests below are a count, not a verdict. A script over `scripts/tests-tier0.mjs` (at 4f1ceb1d, re-read at
994ff440) split it at each entry and kept the ones that read source (`bodyOf(`, `fnSource(`, `lineAround(`, `src(`),
import no module, use a regex (`.test(`, `.match(`, `matchAll(`) and whose name reads as behaviour. Which of them can
become a call is a reading, test by test, and that reading is each slice's first step (rule 1). Expect many to stay:
of the five read for the pilot, R55 converted, and R99, R1120, R194 and R35's second half are censuses of the code's
shape (one rule asked by every reader, a function nothing may call, an unexported function) - the plan's text guards.

"Files it reads" is what the test names: most take the map of every module file (`otherSources()` or
`moduleSources()`) and pick files out of it; a test that names none reads every file. "Functions it cuts" is what its
`bodyOf`/`fnSource` markers name. Both were extracted by a script and can miss a file reached another way.

## The slices

Four slices by domain, about equal in tests and in tier-0 lines. They cannot be disjoint in production files - 85 of
the 111 share at least one file with another through utils.mjs, settings.mjs and the like - and they do not need to
be: a slice changes test files only (rule 6), so what must be disjoint is where in the test files each one writes,
which rules 5 and 7 fix.

| Slice | Domain | Tests | Tier-0 lines | R numbers it may take | Its line in scripts/tests-tier2.mjs |
| --- | --- | --- | --- | --- | --- |
| A | the incident, the Eclipse, rolls, Calls, Despair, the bridge | 28 | 1172 | R5110-R5129 | `// E40 item 4, slice A: ...` |
| B | the investigation: Search, clean-up and Tamper, Observe, Analyze, Remnants, Truth Bullets, handovers | 29 | 1188 | R5130-R5149 | `// E40 item 4, slice B: ...` |
| C | the trial, the verdict, the chapter, Level Up, the season, the clock | 28 | 1442 | R5150-R5169 | `// E40 item 4, slice C: ...` (the pilot's R55 test stands under it) |
| D | windows, the fog, rooms, glass, settings, the sync and the rest | 26 | 1115 | R5170-R5189 | `// E40 item 4, slice D: ...` |

R5101-R5109 are the pilot's (none used: the pilot made no new number) and R5190-R5199 stay with this line.
`node tools/registry.mjs --next` read R5101 on 13.11.2026, so every range above is free; each is this line's
(R5100-R5199, reserved for it by the coordinator).

## The rewrite rule

1. **Read the test, then pick one of three.** Write the pick and its reason in the slice's status file (rule 8).
   - **(a) In place.** What it guards can be observed by calling an exported function or reading the live world, with
     no write. The body is rewritten in `tests-tier0.mjs`; the name, the R number and the first and last lines stay.
   - **(b) Tier 2.** Observing it needs a write or a fixture (an Eclipse opened, an assembly called, a card posted). A
     named tier-2 test goes under the slice's line in `tests-tier2.mjs`, its name ending
     `(E40 item 4: Rnn's rule, driven; was Rnn)`; its first comment says what the old test read and which mutant it
     missed. The tier-0 test is deleted when the new test holds every assertion it made, and only then (the registry
     keeps its row as "(removed in E40)", rule 9); an assertion the new test does not hold stays in tier 0, the test
     trimmed to it and marked as in (c). Default taken, owner to confirm: a moved test carries its old number in its
     name, not as its R number - tier 2 is named, not numbered (the repository's rules for tests, "Numbering new tests"), and the plan's "the replaced
     tests keep theirs" is read as: the number stays findable.
   - **(c) Text guard.** Its subject is the code's shape: a census over every file, one rule every reader must ask, a
     call nothing may make, an order with no outcome a call can see, or an unexported function. It stays, and its body
     opens with `/* TEXT GUARD (E40 item 4, <date>): <why the source is what is measured> */`. Nothing else changes.
2. **No production code changes.** A test that could be driven only by exporting a function is (c), with "would need
   an export of X" in its reason. The owner decides those later; a slice does not.
3. **Red first, by mutants, before and after.** For each (a) or (b): on a copy of the tree (`git worktree add --detach`,
   then `DRPG_REPO=<copy>`), plant (i) a mutant that removes the rule and (ii) where one can be written, a mutant that
   keeps the text the old test reads but breaks the behaviour. Run the old test and the new one on each, and both on
   the clean copy. The expected table is the pilot's: (i) both FAIL; (ii) old ok, new FAIL; clean both ok. A new test
   that passes a mutant it was written to catch is not finished. Mutants are never committed; the table goes in the
   status file.
4. **New R numbers only for new tier-0 or tier-1 tests** (a test split in two, an (a) whose half becomes its own row),
   taken in order from the slice's range; `node tools/registry.mjs --write --stage E40` after each.
5. **Where a slice writes in `tests-tier2.mjs`:** only directly under its own line (the two comment lines), never
   elsewhere in the file. The four lines are thousands of lines apart, so the four branches' hunks cannot touch.
6. **What a slice may change:** `scripts/tests-tier0.mjs` (its own tests' entries only), `scripts/tests-tier2.mjs`
   (rule 5), `docs/dev/R-REGISTRY.md` (generated, rule 9) and its status file. Nothing in `scripts/` but the two test
   files, nothing in `audit/harness/lib/`, never `audit/harness/lib/dh-dice/` or `dh-relay.mjs`.
7. **Neighbours in `tests-tier0.mjs`:** 36 pairs of the 111 stand next to each other in different slices (R30/R31,
   R31/R32, R34/R35, ...). So: an in-place rewrite never changes a test's first line (its name) or its closing `    }],`;
   a deletion removes a test from its name line through its closing `    }],` and the one blank line after it, if
   there is one. Then an unchanged line always stands between two slices' hunks, and git merges them.
8. **The slice's status file** is `docs/dev/e40/ITEM4-<slice>.md` (not STATUS.md, which all four would edit): per
   test, the pick (a, b or c) and its reason, the mutant table for (a) and (b), and the gates run.
9. **The registry** (`docs/dev/R-REGISTRY.md`) is generated; its first line ("Next free") and a removed test's row
   will conflict when the four branches meet. Resolve by taking either side and running
   `node tools/registry.mjs --write --stage E40` on the merged tier files.
10. **The gate per batch** (about seven tests, one commit): `node --check` on each changed file;
    `node tools/check.mjs`; `npm run lint` in `audit/harness`; every test the batch changed, by name -
    `node run-tests.mjs --tier 1 --only <R>` for tier 0 and 1, `--tier 2 --only "<name>"` for tier 2; tiers 0-1 whole,
    `node run-tests.mjs --tier 1` (after the pilot: 1419 ran, 1404 passed, 0 failed, 16 skipped - one fewer
    than at 994ff440, R55 gone); the registry written. Push with
    `[skip ci]` in the title (the coordinator's word: no CI today). A tier-0/1 failure outside the batch is measured
    before it is blamed (R3712's beat, `docs/dev/e40/STATUS.md`, failed only once the file's length moved).

## The pilot

Commit: named in `docs/dev/e40/STATUS.md` and in the coordinator's message (the commit that adds this file).

- **R55 -> tier 2 (b).** "a rewind during an Eclipse is refused before it calls off an assembly or moves the clock (E40
  item 4: R55's rule, driven; was R55)", under slice C's line: an assembly called, an Eclipse opened, the rewind
  pressed; read: its answer, the clock unchanged, the assembly standing, the refusal warned. R55 deleted from tier 0;
  its registry row "(removed in E40)".

  | Mutant of clock.mjs `rewindTimeOfDay` | Old R55 | New test |
  | --- | --- | --- |
  | m1: the Eclipse check removed | FAIL | FAIL |
  | m2: the Eclipse check moved after `cancelGather()` | FAIL | FAIL |
  | m3: the check kept, its condition `=== "never"` (the text R55 read unchanged) | ok - missed | FAIL |
  | the clean tree | ok | ok |

- **R99 -> text guard (c).** call-world.mjs `fallbackGather` is not exported, and its road needs an assembly firing on a
  scene not on the GM's screen; driving it would need an export (rule 2). Marked, otherwise unchanged.
- Read and left for their slices: R1120 and R194 (B, A) read as (c), censuses of one rule; R35 (A) reads as half (b)
  (`startEclipse` clears the seals: driveable) and half (c) (Edit campaign never calls `setTimeOfDay`).

## The tests

### Slice A

| R | Tier-0 line at 994ff440 | What it promises (shortened) | Files it reads | Functions it cuts | Done |
| --- | --- | --- | --- | --- | --- |
| R6 | 1231 | no bridge request can be made by the one person it is addressed to | bridge-guards.mjs (from the map of every module file) | createWaiter |  |
| R11 | 1513 | no bridge request can wait forever | bridge-guards.mjs, traps.mjs, search-tokens.mjs (from the map of every module file) | registerTraps, createWaiter |  |
| R18 | 1777 | using an item mid-incident costs a turn like everything else | sheet.mjs, use-items.mjs (from the map of every module file) | inCrisis |  |
| R25 | 2249 | the action budget comes back when the Eclipse opens, and only there | eclipse.mjs (from the map of every module file) | startEclipse |  |
| R26 | 2290 | a critical's Hope is paid once, by one payer | despair-award.mjs, critical.mjs, reroll.mjs (from the map of every module file) | onChatMessage |  |
| R35 | 2573 | the Eclipse ends what was bought for the time of day, and the refill box only refills | eclipse.mjs (from the map of every module file) | startEclipse |  |
| R38 | 2718 | the Loaded Die rides the roll it was bought for | forced-roll.mjs, roll-dialog.mjs (from the map of every module file) | grantsFor |  |
| R48 | 3060 | a tile shows the price it is about to charge | sheet.mjs (from the map of every module file) | costOf, costLabelFor, actionButton, tamperBlock, repaintInPlace, refreshPricedTiles |  |
| R59 | 3636 | the murder window asks the Eclipse before it asks the GM anything | murder-ui.mjs (from the map of every module file) | openMurderDialog, await openMurder |  |
| R69 | 4095 | the Eclipse warning fires on a clock that moved | -every module file | applyCampaignForm |  |
| R75 | 4325 | revoking a Despair pool is asked first, and the form survives it | gm-team-dialog.mjs (from the map of every module file) | confirmRemovePool, result?.op === "remove" |  |
| R76 | 4362 | an incident whose cast is gone says so | murder-ui.mjs (from the map of every module file) | incidentTrackerHtml |  |
| R80 | 4571 | an empty request is refused before the window starts closing | calls.mjs (from the map of every module file) | wireNoteGate, confirmCall |  |
| R81 | 4606 | one purchase posts one card, after the effect | despair.mjs, calls.mjs (from the map of every module file) | spendDespairCall, spendDespairCallFor |  |
| R82 | 4644 | what shuts the whole Calls menu is asked at the door | calls.mjs, sheet.mjs (from the map of every module file) | callBarred, runCall |  |
| R85 | 4772 | a Call still applies when the roll window is unlocked | roll-dialog.mjs (from the map of every module file) | onRenderApplication, forceConfig |  |
| R86 | 4809 | a Monocub may cross a room, and that is the list | config.mjs (from the map of every module file) | performAction |  |
| R97 | 5455 | an assistant GM's Despair goes to the primary, and cannot loop | despair.mjs (from the map of every module file) | adjustDespair, sendDespairToPrimary |  |
| R101 | 5286 | the Despair Flow window comes back after a refusal, with its pools | gm-team-dialog.mjs (from the map of every module file) | result?.op === "add", result?.op === "remove", readTeamDraft, paintTeamDraft |  |
| R144 | 5754 | five doors a console used, each shut on the side that writes | action-rolls.mjs, calls.mjs, despair.mjs, call-world.mjs, handover.mjs, inventory.mjs (from the map of every module file) | performAction, spendDespairCallFor, spendDespairCall, verify, transferRefusal, giveItem, sealRoom |  |
| R194 | 7283 | whether an incident is a trap is asked of one rule, the cast's and the world half's where the cast has none | incident-store.mjs, settings.mjs, events.mjs (from the map of every module file) | - |  |
| R205 | 7458 | every write of an incident in murder.mjs runs in its queue, and nothing in the queue queues again | planted.mjs, incident-store.mjs, murder-rules.mjs, murder-ui.mjs, murder.mjs (from the map of every module file) | - |  |
| R302 | 8322 | a private roll's whisper is written first and in its own try, its mode after and apart, and CONST.DICE_ROLL... | private-rolls.mjs (from the map of every module file) | writeWhisper, writeMode, whisperRoll |  |
| R800 | 15635 | the roll window's render hook writes nothing under the roll's config: what a Call or the lock forces is wri... | roll-dialog.mjs (from the map of every module file) | onRenderApplication, wrapPrepareContext |  |
| R948 | 16046 | a drawn roll's dice start at the GM's message on the roller's own screen, sending and writing nothing (H82-... | roll-draw.mjs (from the map of every module file) | startWaitOf, startOnMessage, drawAndPlay, playBack |  |
| R949 | 16084 | the GM's own screen throws a drawn roll's dice at its throw, once, sending and writing nothing (H82-07): ro... | roll-draw.mjs, private-rolls.mjs (from the map of every module file) | throwDrawn, writeDrawnMessage, relayDrawnDice, reportRollSubject, reportClaimedRoll |  |
| R1101 | 18144 | every action roll with a threshold in the rules hands it to the roll window: each rollTrait( in the actio... | action-rolls.mjs, sheet.mjs, frisk.mjs, murder-rules.mjs, cleanup.mjs, use-items.mjs, observe.mjs | "useItem", performAction |  |
| R1194 | 20107 | one road for the Eclipse (E37 C2, E37-10; D44b, S10-54): the HUD's chevron and the GM panel's \"Do it\" bot... | boundary.mjs (from the map of every module file) | buildTimeRow, const EXTRA_ACTIONS = { |  |

### Slice B

| R | Tier-0 line at 994ff440 | What it promises (shortened) | Files it reads | Functions it cuts | Done |
| --- | --- | --- | --- | --- | --- |
| R32 | 2507 | the case dashboard saves the rows on screen, and a plan row only when it was edited | investigation.mjs (from the map of every module file) | saveKeyPlan |  |
| R34 | 2542 | a planted item is taken only by a Search that found something | search-tokens.mjs (from the map of every module file) | searchDraw, performSearch, runSpend, runTakePlant, requestPlantCheck |  |
| R36 | 2588 | the GM side judges a plant and a Tamper by the rules the player's menu used | cleanup.mjs (from the map of every module file) | plantOnPerson |  |
| R37 | 2608 | a closed Tamper window after a landed concealment roll refunds nothing | cleanup.mjs (from the map of every module file) | concealFromWitnesses, if (rolled), releaseTamper |  |
| R39 | 2670 | the unfound-Key charge counts every Key Remnant that was found | investigation.mjs, handover.mjs (from the map of every module file) | keyPlanStatus, keyFeeOf |  |
| R40 | 2642 | no action can be withdrawn from after the roll for who can see you | cleanup.mjs (from the map of every module file) | concealSabotage, performSabotage |  |
| R46 | 2944 | Analyze pays the chain before the dice, and every road gives it back | messenger-app.mjs (from the map of every module file) | performAnalyze, refundOnCard |  |
| R47 | 3000 | Tamper pays one price, on the client, after the concealment | cleanup.mjs, reroll.mjs (from the map of every module file) | ${fn}, concealFromWitnesses, settleCleanup |  |
| R49 | 3120 | a bullet whose badge says Neutral is not treated as identified | observe.mjs, gm-items.mjs, truth-bullets.mjs, handover.mjs (from the map of every module file) | publishReading, mintLootBullet |  |
| R53 | 3379 | the Tamper tile's late answer does not eat the reason it is locked | sheet.mjs (from the map of every module file) | paintTamper, actionButton |  |
| R57 | 3518 | the case dashboard keeps what the GM did to it across a redraw | utils.mjs, investigation.mjs, live.mjs (from the map of every module file) | wirePortraitPickers, callback:, wireKeyLimitOverride, wireCase, const rebuild = (force = false) |  |
| R87 | 4848 | a trace of unstated origin is not a free Analyze | config.mjs, analyze.mjs (from the map of every module file) | analyzeDc |  |
| R88 | 4876 | a refusal hands back what was paid, and an Observe miss is not a refusal | observe.mjs, messenger-app.mjs (from the map of every module file) | declineAction, ruleObserveMiss |  |
| R89 | 4933 | an Observe declaration outlives the browser that made it | settings.mjs, observe.mjs (from the map of every module file) | SETTINGS.observePending, resolveObserve |  |
| R91 | 5009 | the GM can state that a trace exists | investigation.mjs, api.mjs (from the map of every module file) | openNewTrace, findableKind, openInvestigationDashboard, runDashboardButton |  |
| R92 | 5077 | a reshaped trace waits for a ruling | cleanup.mjs, messenger-app.mjs (from the map of every module file) | applyReshapeRuling, resolveTransformRoad, if (rewrite) {, declineReshapeRuling |  |
| R96 | 5408 | a project token opens a card that names only what its reader knows | projects-map.mjs, remnant-ring.mjs (from the map of every module file) | showProjectCard, projectCard, if (game.user.isGM) |  |
| R143 | 5713 | ownership raised past the window's back, and a bullet a player edits, are put back | anonymity.mjs, truth-bullets.mjs, resource-guard.mjs (from the map of every module file) | lowerOwnership, watchBulletEdits, onBulletWrite, guardedPathsIn, const BULLET_GUARDED |  |
| R145 | 5787 | Analyze, Stage 6 and a clean-up's undo, judged by the rules on the GM | analyze.mjs, cleanup.mjs (from the map of every module file) | resolveAnalyze, resolveStageSix |  |
| R172 | 6831 | no answer-key writer derives a value from absence | truth-bullets.mjs, analyze.mjs, remnants.mjs, gm-stores.mjs, incident-store.mjs, fog.mjs, projects-secrecy.mjs, eclipse.mjs, investigation.mjs, pre-session-note.mjs, dice-sync.mjs (from the map of every module file) | - |  |
| R305 | 13208 | a trace's tie keeps its three states through every writer and reader of the ledger | remnants.mjs, cleanup.mjs, observe.mjs, gm-items.mjs (from the map of every module file) | - |  |
| R306 | 13252 | a reshape's ruling is claimed before anything waits: claimRuling marks ruled with no await, and the store... | cleanup.mjs (from the map of every module file) | claimRuling |  |
| R376 | 13677 | the Key Remnants still to place, the off-plan finds, the Key fee, the autopsy and the crime-witness mark ar... | investigation.mjs, gm-panel.mjs, truth-bullets.mjs, monocub.mjs, handover.mjs (from the map of every module file) | keysToPlace, keyPlanStatus, keyFeeOf, autopsyIssued, isCrimeSilenced, createTruthBullet, mintCopy, setSilenced |  |
| R430 | 14155 | the room cache and a Remnant's card read the world's tokens, not the ones this browser draws | movement.mjs, remnant-ring.mjs (from the map of every module file) | - |  |
| R1103 | 18226 | Analyze's request field shows with Hint alone: askWhatToAnalyze's request block carries data-drpg-when=\... | -every module file | requestFieldHtml, askWhatToAnalyze |  |
| R1120 | 18555 | an undescribed trace's name is empty and worded at read time: the key DRPG.Remnant.tokenName is localized... | remnants.mjs, observe.mjs (from the map of every module file) | createFind |  |
| R1135 | 18639 | a discard's ticket is written only for a trace placed, and a discard stands only on one: bridge-runs-record... | sheet-audit.mjs (from the map of every module file) | - |  |
| R1199 | 20226 | the search ledger keeps no dead code and no stale spend (E37 C6, E37-26; audit S07-44): search-tokens.mjs d... | search-tokens.mjs (from the map of every module file) | runSpend |  |
| R3143 | 23140 | a body's loot is judged where its body lies, by the one gate and no second (E95 C1; E72 amend[16]): frisk.m... | frisk.mjs, body-tile.mjs, handover.mjs, inventory.mjs, anonymity.mjs (from the map of every module file) | personActionRefusal, lootBody, transferRefusal, greyRefused |  |

### Slice C

| R | Tier-0 line at 994ff440 | What it promises (shortened) | Files it reads | Functions it cuts | Done |
| --- | --- | --- | --- | --- | --- |
| R29 | 2425 | a body is this chapter's dead, discovered once, and never gathered | chapter.mjs, call-world.mjs (from the map of every module file) | checkBodyFound, bodiesToDiscover, gatherEveryone |  |
| R30 | 2453 | a verdict is locked before it does anything | verdict.mjs, trial-progress.mjs (from the map of every module file) | applyVerdict, verdictRefusal |  |
| R42 | 2742 | the trial gate sits below the guards that outrank it | action-rolls.mjs, movement.mjs, calls.mjs | performAction, const def =, crossingVerdict, hopeCallBarred, spendDespairCallFor |  |
| R43 | 2801 | the trial's budget follows the phase, not the window | clock.mjs, trial-floor-ui.mjs, trial-floor.mjs | reconcilePhase, if (to === "classTrial") |  |
| R44 | 2835 | one admission rule, two questions, and every reader asks it | trial-floor.mjs, trial.mjs | openObjection, objectOnPrimary, objectionButtonState, presentDialog |  |
| R45 | 2899 | the floor is seized once, paid for, and never by a card with nothing behind it | trial.mjs, trial-floor.mjs | seizeFloor |  |
| R55 | 3447 | a rewind is refused before it cancels anything | clock.mjs (from the map of every module file) | rewindTimeOfDay | pilot: tier 2 (removed from tier 0) |
| R56 | 3474 | the body discovery refuses the dark before it asks anything, and the button says so | chapter.mjs, investigation.mjs (from the map of every module file) | openBodyDiscoveryDialog, wireCase |  |
| R58 | 3564 | the trial console counts the seconds, a ballot is an event, and +30 s means thirty | trial-floor-ui.mjs, trial-floor.mjs, floor-machine.mjs (from the map of every module file) | manageClassTrial, setInterval, trialConsoleHtml, extendFloor, case "adjust": {, recordBallot, closeRound |  |
| R67 | 3984 | a repair moves the flags and says nothing | chapter.mjs, monocub.mjs (from the map of every module file) | markDeceased, killCharacter, incidentVictimDied, setMonocub, applyAliveStates |  |
| R68 | 4055 | Edit campaign offers the chapter the clock is actually on | season-setup.mjs (from the map of every module file) | campaignRows, const stated, stepper({ name: "chapter", campaignFieldsHtml |  |
| R70 | 4123 | Enter in a field that names a button presses that button | utils.mjs, mastermind.mjs (from the map of every module file) | guardTextFields, mastermindHopeBox |  |
| R74 | 4274 | a Season setup row hands over instead of answering | season-setup.mjs (from the map of every module file) | wireSetupSteps, wireSeasonTiles, setupRows, ${name}, rejectClose: false |  |
| R178 | 6999 | no migration runs from a ready hook | migrate.mjs, gm-stores.mjs, remnants.mjs, diagnostics.mjs, planted.mjs (from the map of every module file) | key: "${key}" |  |
| R221 | 13078 | the starting sheet is written only on a GM's browser | character.mjs (from the map of every module file) | - |  |
| R315 | 12795 | Enter in the verdict window presses Cancel, its executed select opens on nobody, and a right verdict execut... | -every module file | footer:, openVerdictDialog, read |  |
| R316 | 12828 | a verdict writes its lock once, executes on the GMs' held reading, and its public card reads no Blackened | -every module file | applyVerdict, giveFinalVerdict, carryOutSentence, postVerdictCard |  |
| R317 | 12858 | a verdict's Level Ups are one window with the players' choice, and its line is said after it | level-up.mjs (from the map of every module file) | runAdvancementBatch, askWhoPicks, verdictLevelUps |  |
| R318 | 12890 | a Level Up reads the sheet the GMs hold, writes it once, and refuses a pick the sheet cannot take | level-up.mjs, character.mjs (from the map of every module file) | applyAdvancement, openAdvancement, buildContent, handleAdvancement, stampStartingSheet |  |
| R355 | 12630 | a Level Up's experience is written down in the write that adds it, as a GM's flag, and the reset reads it a... | level-up.mjs, character.mjs, sheet-audit.mjs (from the map of every module file) | applyAdvancement, restoreStartingSheet, seasonExperiences, stampStartingSheet |  |
| R377 | 13718 | the reset is the primary GM's when its window closes, takes its word exactly, names a cast it could not pla... | season-wipe.mjs (from the map of every module file) | resetSeason, placeCastStep, placeCast |  |
| R436 | 12212 | the gather after the trial has one door: End the trial asks for a room and cannot skip it, closeTrial holds... | call-world.mjs, trial-scene.mjs, trial-floor-ui.mjs, chapter.mjs, api.mjs (from the map of every module file) | leaveTrialScene, stageHall, closeTrial, askTrialExit, endClassTrial |  |
| R583 | 14845 | the trial hall's facts for the room tile have one writer and one reader: setHallRoom, a GM's, writes the ha... | trial-scene.mjs, room-tile.mjs (from the map of every module file) | setHallRoom, hallRoom, applyScenesTab, tileView, registerRoomTile |  |
| R591 | 15122 | the Objection's target and evidence are the primary GM's: LiveKit's speaker list is read in voice-tile.mjs ... | trial-speakers.mjs, voice-tile.mjs, trial.mjs, gm-bridge.mjs, hud.mjs, sheet.mjs, sync.mjs (from the map of every module file) | if (speakers.speakerRoomOpen()) {, } else if (!targetId) {, objectOnPrimary, if (!target) return { refused:, raiseObjection, evidenceOnPrimary, presentBullet, addPresentButton |  |
| R1035 | 17574 | the dead's microphones are the trial's alone (E70 C5, S18-78, S18-87; amend 6, answer 3 (b)): permissions.... | voice-tile.mjs, voice.mjs, hud.mjs, vote.mjs, clock.mjs, gm-stores.mjs, trial-floor.mjs, trial.mjs, monocub.mjs, chapter.mjs, movement.mjs, season-setup.mjs, api.mjs, settings.mjs | [ACTION_TRIAL_ENTER]: {, export const trialMuteStore = defineGmStore({ |  |
| R1192 | 20039 | one cast (E37 C2, E37-08; S10-45): monokuma.mjs actingStudents({ dead }) is the roster of the students wh... | monokuma.mjs, player-status.mjs, eclipse.mjs, vote.mjs, gm-panel.mjs, trial-progress.mjs (from the map of every module file) | actingStudents, buildTableView, nextStep, placementStatus, startEclipse, trialParticipants, trialSizeNow |  |
| R1259 | 20878 | E42's two records are the primary's to write (E42 fix FG4; the end review's S-M4): every write of the world... | chapter.mjs, season-wipe.mjs (from the map of every module file) | const writeRecord = async |  |
| R2054 | 22467 | the slots E70 and E73 fill (E47 C1; E47-04, S18-89): trial-floor-ui.mjs trialSignature reads no mode and ... | trial-floor-ui.mjs, verdict.mjs, vote.mjs | trialConsoleHtml, trialSignature, manageClassTrial |  |

### Slice D

| R | Tier-0 line at 994ff440 | What it promises (shortened) | Files it reads | Functions it cuts | Done |
| --- | --- | --- | --- | --- | --- |
| R31 | 2472 | Room Setup's Apply writes only what the GM changed, and refuses before writing | -every module file | openRoomSetupDialog, readRoomSetupForm, roomSetupContent |  |
| R54 | 3405 | the clock's chevrons hold one press at a time, and report a failure | hud.mjs (from the map of every module file) | control, await handler(), releaseControls |  |
| R61 | 3738 | Monokuma Legacy states the whole ladder, and no rung is floored above its own size | - | body.drpg-theme-monokuma-legacy {, --drpg-text-xs: |  |
| R62 | 3790 | the scale factor is published once, on both roots, and the glass is pinned at 1 | settings.mjs (from the map of every module file) | applyTheme |  |
| R65 | 3899 | a window that closes to come back does not answer its opener first | live.mjs (from the map of every module file) | handOff, wireAliveRow, const chosen = await drpgWindow |  |
| R66 | 3939 | the Players window writes what it was told, and offers the Despair that is left | -every module file | openWhoIsAliveDialog, applyAliveStates |  |
| R71 | 4167 | the cue pane is built on every redraw, not baked when the window opened | -every module file | soundPlayPane, keepLive(dialog, {, data-drpg-make-cue |  |
| R73 | 4247 | a window reopened from its own answer closes the old copy first | live.mjs (from the map of every module file) | reopen, typeof action.newPool === \ |  |
| R77 | 4391 | every student stands on a frame, and yours is bone | own-ring.mjs, module.mjs (from the map of every module file) | frameOf, isMine, hourColour |  |
| R78 | 4450 | the clock names what THIS client is hearing | music.mjs (from the map of every module file) | nowPlayingHere, registerHud, paintTrackLine, renderHud |  |
| R83 | 4681 | a deferred assembly remembers its scene, and is not cleared until it can be held | call-world.mjs (from the map of every module file) | scheduleGather, runPendingGather, gatherEveryone, fallbackGather |  |
| R84 | 4727 | a request that never went is not reported as sent, and a tile states the rule | -every module file | DRPG.Project.proposalTitle, promptAndCallGm |  |
| R90 | 4983 | a region that redraws itself comes back dressed | live.mjs, chrome.mjs (from the map of every module file) | const rebuild = (force = false) |  |
| R95 | 5384 | a window under glass arrives frosted, not sharp and then frosted | motion.mjs (from the map of every module file) | animateWindowIn, if (glassOn()), play(el, |  |
| R99 | 5318 | an assembly's fallback writes to the assembly's scene | call-world.mjs (from the map of every module file) | fallbackGather | pilot: text guard |
| R118 | 13844 | a project's room, a gather, a body and a Final Truth are placed on their own scene, never the one on screen | projects.mjs, projects-map.mjs, projects-ui.mjs, call-world.mjs, call-effects.mjs, call-pickers.mjs, chapter.mjs, mastermind.mjs, stash-reach.mjs, gm-items.mjs, investigation.mjs, traps.mjs, utils.mjs, season-setup.mjs (from the map of every module file) | f |  |
| R119 | 13781 | Room Setup writes to the scene it was opened on: every read and write it makes is handed that scene, Apply'... | rest.mjs, fog.mjs, fog-diagnostics.mjs, rooms.mjs, search-tokens.mjs (from the map of every module file) | openRoomSetupDialog |  |
| R291 | 13133 | every row of the GMs' roll list has a fixture in tier 2 and every fixture a row | config.mjs, roll-draw.mjs (from the map of every module file) | situationReading |  |
| R300 | 13162 | each silence has one name: isCrimeSilenced in monocub.mjs, isCallSilenced in call-effects.mjs, isSilenced o... | api.mjs, sheet.mjs (from the map of every module file) | - |  |
| R383 | 13987 | the renderer's background is the fog's ink only while the fog is on screen: set after a paint, given back w... | fog.mjs (from the map of every module file) | repaintFog |  |
| R806 | 15792 | the hint of the switch for one dice look says only what holds whoever opened the world first: the look is f... | - | - |  |
| R846 | 16316 | a private card to a student's owners goes to every player who owns it: whisperToOwner and whisperToOwnerOnl... | utils.mjs (from the map of every module file) | - |  |
| R945 | 15996 | a GM's frame is cut on a GM's own board from the GMs' own rows (H82-05): fog-doorways.mjs gmPassageGaps t... | fog-doorways.mjs, fog-reveal.mjs, fog.mjs, passages.mjs (from the map of every module file) | gmPassageGaps, doorwayEdges, traceOutlineGapped, flashOutline, registerFog, redrawFrameSoon |  |
| R1127 | 18665 | every GM number field is a kit stepper read through utils.mjs wholeNumber: each stepper({ name of the m... | call-pickers.mjs, facility-editor.mjs, gm-campaign.mjs, gm-students.mjs, mastermind.mjs, messenger-app.mjs, overflow.mjs, settings-window.mjs, trial-floor-ui.mjs, ui-kit.mjs, utils.mjs, despair.mjs (from the map of every module file) | readStepper |  |
| R1330 | 1024 | the notice history is on the kit (E44 C5; E44-19, the 11.10 amend A7): its window is a DrpgApp whose one sc... | notice-history-app.mjs, notice-history.mjs | async _renderHTML,     expand(details) {,     buildList() {, noticeSnapshot, openNotices |  |
| R1483 | 22074 | the harness's render after a write is named unconfirmed (E45 C3a, E45-15; STAGE E45 \"71-sheet\"): versions... | - | export const UNCONFIRMED |  |
