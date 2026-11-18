# E58 local line (L1) - reports to the coordinator

The sandbox line on the owner's PC (WSL2 Ubuntu), branch `claude/e58-local`, made from origin/main at ff3e12e5
(1.2.116, "Merge 1.2.116 (#66)"). Newest report on top. Nothing here is a release step.

The owner, 16.11.2026, while step 1 ran: "nie czekaj na mnie albo na moje odpowiedzi. zrealizuj cale polecenie na
domyslnych ... pracuj do samego konca". From here every question takes its default, written beside it, and the line
goes on; what only the owner can give (a password, eyes on a screen) is written as not run with its reason.

## Tier 2 on the sandbox (items 75, 153, 475; 16-17.11.2026, in progress)

**Run 1** (16.11, 22:10 local): `runTests({ tier: 2, confirmed: game.world.id })` on the GM, the three players logged in,
as audit/live/suite.mjs runs it. It wrote to the world until 22:42 and then nothing for three hours (the world's database
files' times); stopped at 01:45. The restore put back what the test left half-done: Fear, Aiko's system, four actors'
flags, one extra token, four tokens' places; its second pass `[]`.

**Run 2** (17.11, 01:47 local), with the GM's console recorded and a watcher: it went quiet at 02:19:14 (the last lines
"Aiko Hoshino has meddle armed (bonus)" twice, then "Murder closed (test)") and the watcher fired at 02:26:05, 6.8 min
quiet. The console names no test (the runner prints its text at the end, tests.mjs:608). Open on each page (the watcher
read the GM's windows; the players' from their screenshots): **GM** - Daggerheart's roll window "Eye Roll: Aiko Hoshino"
waiting on Roll, "Daggerheart is newer than the verified version" (Understood), "The case on this browser" ("1 pre-session
note is marked written, and this browser does not hold it" - PlayerOne's leftover flag, group 3 item 62; Continue, Restore
from a file), toasts "1 death is still known only to the GMs ..." three times and "Parts of the character sheet failed to
draw: tidyBiography. A newer Daggerheart may be why"; **PlayerOne** - "Stay hidden?" (Stay hidden, Reveal yourself) and the
notice "A private card. Its words did not reach this browser."; **PlayerTwo** - none; **PlayerThree** - "Stay hidden?". The
world "On hold" (paused) on all four. Which page was in front: none - each a headless page in its own browser context,
no page in front, `visibilityState` not recorded. The restore after it: Fear, Aiko's system, four actors' flags, one extra
token, four tokens; its second pass `[]`.

**The hypotheses**: (a) fits so far - the GM's own roll window waits on a press; (b) does not - nothing open on the
players waits on a reply the GM needs (their "Stay hidden?" windows belong to a mask that had already opened), so the
background-throttling flags were not used.

**The Meddle tests are not the hang.** "a Meddle's +1 taken back while its window is open ..." and "a Meddle's -1 is on the
roll window's config ..." (positions about 981-982 of 1565) run alone on the sandbox **fail** in 2 s, "threw: Cannot read
properties of undefined (reading 'length')": Daggerheart's `D20RollDialog` reads `this.config.costs.length` as it draws
(build :7213 in 2.12.9), Daggerheart's own roads pass `costs` (MoveContext's `data.costs ?? []`), and the kit's
`rollWindow` config had none. Headless both passed: the harness's glue window read `this.config.costs ?? []`. A test
defect; the fix (`costs: []` in the kit's config) is measured green headless in a scratch worktree and waits for the
sandbox to be free (it serves this tree); then its own commit and both tests by name on the sandbox.

**The hang is test 130**, "a statistic clicked on a student's sheet goes through its window as a reaction", and test 131,
"a Call a sheet roll's window applied is on its roll and spent by its close", holds the same way. Found by slices in
`SCENARIOS`' order, each its own `runTests({ only })` watched for quiet: 0-150 hung (02:08 UTC), 75-150 hung, 75-112 ran
through, 113-149 hung, 130 alone and 131 alone each hung (90 s quiet, the GM's "Eye Roll: Aiko Hoshino" open). Reached
25-30 min into a run on this sandbox, as both full runs went quiet 32 min in. **The road** (a probe's stack at
`configure` and at the window's first render, 02:38:30 UTC): the test's `who.rollTrait("instinct", {})` -> the module's
action-pipeline.mjs `rollTrait` (:168) -> `throwDice` (:214) -> private-rolls.mjs `supersedingRoll` (:634) -> Daggerheart's
`DhActor.rollTrait` -> `diceRoll` -> `DualityRoll.build`, which is the module's roll-draw.mjs `drawnBuild` (:211) ->
`drawOrThrow` (:335) -> Daggerheart's `buildConfigure` -> `D20RollDialog.configure`. **What it waits on**: Daggerheart's
`configure` (build :7359-7365) opens the window and resolves only when it closes - on a press of Roll. The harness's glue
`configure` (lib/dh-dice/applications/dialogs/d20RollDialog.mjs :298-306) plays a player: it presses Roll itself once the
window is drawn. Both tests' comments say so ("until C2b the harness's window was pressed at once"); neither presses Roll.
On a real page nobody does, so each waits for ever. A test defect (the coordinator's rule 3): red is the hang itself, 2 of 2
on the sandbox; the fix waits for the scope below.

**The scope, being measured**: tier 2 again in slices of 150 with a probe on the GM's page that presses Roll on any of
Daggerheart's roll windows left open for 30 s, each press logged with the window's title and a stack of 60 frames, so the
test's line in tests-tier2.mjs is named. A press is a person's act and is reported as the probe's, never as a test passing
by itself. The same run gives tier 2's failures on v14.

**Failures already read** (tests 75-112, 17.11.2026 02:27-02:36 UTC; 33 passed, 11 failed - the runner's own checks
included): "a second killer in the same Eclipse is told only that the attempt is refused" and "a killer allowed in the dark
who stands alone is told so at the lights ..." threw "Cannot redefine property: TOKBOTAN00000000", and the first left
Aiko's token in the Hall (restore failed); "a roll with a bonus the GMs do not hold is flagged ..."; "a drawn roll's copy on
its roller's browser is the GM's roll ..." (15 measured where 13 expected); "a drawn statistic's card carries the GM's
modifiers ..." (`[[],7]` against `[[0],13]`); "the GMs' card of a roll thrown with no GM says what it claimed ..." ("did not
come to its dice and Agility"); "the trait the GM picked: another one is flagged" left Fear 0 -> 1; "a drawn roll is thrown
on the GM's dice ..." (no Fear on a packet's critical); "a drawn roll is the kind its action makes it ..." (the GM's Fear 0
where 1); "a drawn roll's options are the GM's own ...". Not triaged yet: some may follow from the unpressed windows'
neighbours or from Daggerheart 2.12.9; each will be read alone once the scope run ends.

**One test per call** (from 03:40 UTC, 17.11.2026): tier 2 again, one `runTests({ only: [name] })` per test in
`SCENARIOS`' order, in chunks of 150, the world restored twice after each chunk (the second pass `[]` after chunks 0 and
150), with the probe pressing Roll on the GM after 30 s. Each row: the test's time, its outcome and the probe's presses.
Tests 0-299 at the first reading: 215 passed, 85 failed. (Corrected 17.11.2026: test 113 was named here as "a roll built
from what the GMs hold raises no flag", which is test 112.) The whole run is below.

**The whole run, read** (17.11.2026 03:40-07:10 UTC, at 3bfb45a8; 1565 tests, each its own call): **1183 passed, 361
failed, 19 skipped**; test 701 hung and test 1267 took the GM's page away (below), 1564 rows. Tests 702-749 and 1268-1349
were run after the loop, the chunks they belonged to having stopped at 701 and 1267. After every chunk the world was put back
and the second pass read `[]`; no account's role or flags was ever among what it put back.

**The probe's presses** (a person's act at a table, reported as the probe's, never as a pass) - twelve tests, each waiting on
Daggerheart's roll window on the GM until a press: 113 "every legal modifier the GM lists is scored without an alarm" 14
presses (failed), 114 "a Meddle's +1 the window writes is in the roll it sends ..." 2 (passed), 127 "a Support's advantage
die is in the roll the harness throws ..." 1 (passed), 128 "an Experience a Call bought is in the formula the harness
throws ..." 1 (failed), 130 "a statistic clicked on a student's sheet goes through its window as a reaction" 1 (passed), 131
"a Call a sheet roll's window applied is on its roll and spent by its close" 1 (failed), 229 "E112 - an armed Loaded Die
loads the murder's opening roll ..." 1 (failed), 343 "a statistic from the sheet thrown while a Work on Project ..." 1
(passed), 799 "the configuration hook gets the unevaluated roll ..." 1 (passed), 980 "an advantage die at faces not the GM's
on a drawn roll ..." 2 (passed), 1133 "a Find Passage or a Frisk thrown through the roll window ..." 3 (passed), 1134 "an
opening or crisis throw holds its Reaction chip at action ..." 3 (passed). The stack of 2 of the presses named the test's
line (130 and 131); the others' stacks end in the module's action-pipeline.mjs `rollTrait`, so they were named by running
one test per call. This sizes the kit helper the coordinator decided (each of these twelve calls it).

**Times** (for the limit on a test; the sandbox's Chromium draws in software, so a table's GPU is faster): the median test
3.7 s, the 95th percentile 17.1 s; the slowest without a press or a hang 166 "a Frisk's rolls ride a Palm's one payment
(A11-4) ..." 157.4 s, then 1530 104.0 s, 189 99.0 s, 1230 83.2 s, 167 62.2 s. Each press adds the probe's 30 s.

**The failures by cause** (the message; what owns it):
- 152 "Cannot redefine property: <token id>" - the tests' shared move options (below); **fixed** in a6b25c51.
- 23 "Cannot read properties of undefined (reading 'length')" - the kit's roll window without `costs`; **fixed** in e50d3c47.
- 10 "You may only push instances of User to the Users collection" - tests that put a made-up GM object into `game.users`;
  v14's collection takes only a User (the tests'). Test 1267, "a pip's change never spills, and a step queued on a GM that
  stopped being the primary goes to the new one (E17-T8) ...", does so too, and the GM's page then navigated away: read on its
  own next.
- 4 "Cannot set properties of undefined (setting 'length')", 2 "Cannot assign to read only property 'saveDataToFile'", 2
  "Cannot assign to read only property 'format' of object '#<Localization>'" - tests writing over what v14 has made read-only
  (the tests'); not read one by one yet.
- At least 21 failures are tests that script their dice with `globalThis.__forceRoll`, which only the harness reads
  (client-entry.mjs:596-640): at a table Daggerheart throws real dice and the test measures them. 10 of those fail for no
  cause above (the fixture swings of tests 15, 17, 18, 20, 21 "was not a hit with Despair/Hope", 131, 229, 800, 1240, and
  357, which threw "reading 'push'"); whether each is the dice is not read yet.
  Counted from the tests' own bodies; a helper that scripts dice for a test (`drawnForPlayer` and the like) is not counted,
  so this is a floor. A design question, proposed below.
- Test 96, "the trait the GM picked: another one is flagged", **passed** and left Daggerheart's Fear 0 -> 2: its draws are
  real dice at a table, and tier 2's `snapshot`/`restore` keep the module's settings and Despair pools but not
  `daggerheart.ResourcesFear`, which the runner's dump watches. The runner's (tier 2's restore), not the test's: a fix with a
  red of its own (snapshot, raise Fear, restore, read) is next.
- Test 701, "no module window is wider than the cap, and they open on the centre", **hung**: it takes the first open window
  matching `.application.dialog[class*="drpg-"]` as its own, and on this sandbox that is "Daggerheart is newer than the
  verified version" (2.12.9 against 2.12.8), drawn at every GM load and first in `foundry.applications.instances`; it measures
  and closes that one, and `await opening` waits for the settings window it opened, which nobody closes. Measured: both
  windows match, the warning first; closing the settings window resolves its opener (null). My first reading - "The case on
  this browser" - was wrong: the test hung with that window closed too. The test's (it should find the window its opener drew).
- The rest, about 150, one or a few each: to be read again after the fixes, many being the leftovers of a test that threw
  before its put-back.

**Proposed, for the coordinator** (not built): scripted dice at a table. (a) a kit probe `env.scriptedDice()`, true only
where `__forceRoll` is read, which those tests `needs()` - skipped at a table, so they lose the table, which is the point of
the gate; or (b) the kit scripts the dice at a table as well, through the randomiser Foundry's dice draw from, for the length
of one test - the table keeps them, at the price of a seam in Foundry's dice the module never touches. Default (b) if the
seam can be read to hold on v14; not started.

**45 of the 85 failures have one cause: Foundry v14 writes into the options object a token move is given.**
client/documents/token.mjs:1742 `options._movement ??= {}` and :2009 `Object.defineProperty(options._movement, this.id,
{ value: move, enumerable: true })` - not configurable - so one options object passed to two moves of the same token
throws "Cannot redefine property: <token id>" on the second. tests-tier2.mjs keeps 61 shared move options (`const PLACE =
{ teleport: true, movementAction: "displace", animate: false }` and the like) and passes one to a test's move out and to
its `back()`; the throw skips the rest of the test and its own put-back, so the token stays where the test put it and
every following test's restore reports it ("restore left: ... tokens.TOKAIKO000000000.x ..."): tests 166-189 in an
unbroken row. The module's own token moves each pass a fresh object literal; none shares one. The harness's shim models a
move's `movement` option alone (client-entry.mjs:1937), not `_movement`, so headless it never throws. A test defect
(rule 3): red on the sandbox measured (45 failures, "Cannot redefine property: TOKAIKO000000000" 34, TOKCHIE 8, TOKBOTAN
3); the headless red will be the shim writing `_movement` as v14 does, the fix a fresh options object per move, in its own
commit once `npm test` and the chunks no longer read the files. Of the other failures so far: 8 the kit's missing `costs`
(the Meddle fix), 4 "Cannot set properties of undefined (setting 'length')", the rest one each, read after the run.

**The `npm test` that was to judge the stand-in did not.** It booted the module from a scratch worktree through
`DRPG_REPO`, and against another tree the harness counts every expected-red and known-leak check as a plain one
(cluster.mjs:52-57): 21-masked-killer red there, green in this tree with the strict stand-in (its Foundry-limit check
expected red). So that run's 7 red scenarios are not a reading of the change until each is checked in this tree, and its 4
suite failures are plain failures that rule does not explain ("a Reroll of a successful erase removes the trace again", "a
changed old store is reported, and taking it never overwrites what changed since the upgrade", E42-T9, E60-T20; the
sandbox's browser was running beside it). `npm test` in this tree, the stand-in strict and the kit unfixed, is running: a
result other than the two Meddle tests failing is the stand-in's or the load's, and will be said which.

**The fixes, committed on this branch and read headless** (17.11.2026, the sandbox idle): a6b25c51 every token move its own
options object, the shim writing the move into it as v14 does (red: "a second killer in the same Eclipse ..." and "a
Frisk's rolls ride a Palm's one payment (A11-4) ..." throw "Cannot redefine property" headless as on the sandbox; green with
`{ ...PLACE }`); e50d3c47 the kit's roll window `costs: []`; df3fe865 the harness's roll window reads `costs.length` (with the
owner's words); 8881e72b `ms` on every result (R7561; red: `ms` undefined; mutants: 0, unrounded, 6000 ms over - each fails).
Then `npm run quick` green, the suite in two shards (`DRPG_SUITE_SHARD=1/2` tiers 0-1 1161.8 s: 1748 passed, 0 failed, 16
skipped; `2/2` tier 2 4231 s: 1555 passed, 2 failed, 11 skipped), `node suite-merge.mjs` over the pair (the list's hash agreed,
each tier-2 test in its shard, the skips the baseline's: "3303 passed, 2 failed, 27 skipped, 0 red: RED" - the new `ms` read by
it without a complaint; RED for the failures below), and the scenarios (51 of 52 green). What was red, and what it was:
- E17-T2 "the GM puts back what the rules refuse ..." and E17-T4 "the Eclipse counts what the primary carried out itself
  ...": "Cannot redefine property" - two `asPlayer` passed bare after a ternary's `:`, which a6b25c51's rewrite (`, asPlayer)`)
  missed. Fixed in the next commit; both green by name.
- 01-runtests' own A3 ("runTests() runs tiers 0 and 1 only ..."): one failure in tiers 0-1, which was R7561 - a 40 ms timer
  read 39 ms. Its bound is 30 ms in the next commit; three runs pass, each mutant fails three of three.
- 41-trial-scene m2 ("a fence token another module refuses stops each of the four carry tests ..."): the fourth carry test's
  run also names "could not restore the world after "End the trial never leaves a living student w..."". **Not this branch's**:
  the tree at 3bfb45a8 with the strict window - the control's exact code, run from its own harness - is red the same way now
  (six runs of six since 10:00 UTC), and was green at 05:32 and 08:11 UTC, both runs beside the sandbox's browser at work. A
  check that depends on timing, older than this work; what the restore left is not read (the scenario keeps the runner line's
  name, not its message).
- The three failures of the withdrawn worktree run ("a Reroll of a successful erase removes the trace again", E42-T9,
  E60-T20) passed here, on a quiet machine: the load, not the change.

**More fixes, each red first** (17.11.2026, pushed to ea8013e0):
- 100c4018: E17-T2 and E17-T4 pass their `asPlayer` fresh too (red in shard 2/2: "Cannot redefine property"; green by name).
- ecdad650: R7561's bound 30 ms, not 40 (a 40 ms timer read 39 ms once; three runs pass, each mutant fails three of three).
- de8156d8: tier 2's `snapshot`/`restore` keep Daggerheart's Fear (red: a new test at the end of the list, "tier 2's restore puts
  Daggerheart's Fear back as it found it", [0,1,1]; green [0,1,0]; the inverted-condition mutant fails it; "the trait the GM
  picked: another one is flagged" green by name).
- db8273fb: the window-width test measures the window its opener drew (red: the hang on the sandbox, twice; green on the sandbox
  alone, 4.8 s, the version warning and "The case on this browser" open; headless the `env.layout` skip the baseline lists).
- e6ffd08a: `pressingRoll`, the kit's press of Roll, around `drawnForPlayer`'s throw and the six tests' sheet rolls (red: 130 and
  131 hanging on the sandbox; green on the sandbox with no probe press: the twelve ran through, none waited, 8 passed and 113,
  128, 131 and 229 failed as they had with the probe's press - "Aiko Hoshino's system.rules.dualityRoll.defaultHopeDice could
  not be set", the Call's experience not on the roll, the Support's die not put on, the Loaded Die not loaded - and one of
  them left Botan's mask, which the restore put back; headless the twelve pass by name as before). The glue window still
  presses Roll itself headless: making it stop is dh-dice, and waits for the owner's consent to that change.
- ea8013e0: the limit on a test, fifteen minutes (headless the slowest 84.1 s; the sandbox 157.4 s without a press, 246.3 s for
  test 113 with the kit pressing; 3.7 times). A test past it fails "timed out", `runSuite` writes the windows open on its own
  browser and runs no later test or tier (R7562 red: no result within its 5 s guard; R7563 red on the runner before; six
  mutants each fail). Not measured: the window list itself, written only when a real test runs out.
- On the sandbox at the fixed tree, the two Meddle tests by name: **both pass** (6.5 s and 5.4 s), the world clean after.

**Now**: tier 2 on the sandbox again at ea8013e0, one test per call, with no probe press (17.11.2026, from 10:58 UTC).

**The rerun at ea8013e0** (17.11.2026 10:58-14:47 UTC, one test per call, no probe press; the gap 1268-1349 at the end):
**1286 passed, 259 failed, 20 skipped** of 1565 (the first run: 1183, 361, 19). Tests that left the world changed: 16 (179,
180, 181, 184, 357, 604, 610, 689, 1052, 1071, 1212, 1213, 1288, 1453, 1486, 1495), the first run's about 200 rows. After every
chunk the restore's second pass read `[]`. 123 tests pass that did not; 20 fail that passed - 707-731, the ownership below,
and 97, 99, 1005, 1054, 1067, 1089, 1235, 1514, 1525, most of them with real dice at a table, not read one by one.
- **The limit fired once, on a real page**: test 357 "a use in a fight is carded veiled whoever makes it, and names nobody",
  "timed out: still running after 900 s ...", and the runner wrote "windows open on this browser when it stopped: Daggerheart
  is newer than the verified version [Understood]; The case on this browser [Continue, Restore from a file]; Use "Suite kit
  used in the fight" [Yes, Cancel, Cancel]" - the window list ea8013e0 had left unmeasured, measured. A confirm the harness
  answers from `__dialogAnswers` (below).
- **An owner is not removed by a deletion on v14** (measured, Aiko, 17.11.2026): `update({ "ownership.<user>":
  ForcedDeletion })`, nested, and `ownership.-=<user>` each left the entry; a ForcedReplacement of the whole ownership removed
  it; a module flag deleted the same way, dotted and nested, went. Tests 604 and 610 passed and left an owner; every test
  after them in the session counted the players wrong (707-731). The module never deletes an owner. **Fixed in 867653ee**
  (red: the shim's `keepOwners`; the eight put-backs write the ownership whole). For the coordinator: CLAUDE.md's "Delete a
  key with `forcedDeletion()` or `unsetFlag`" holds for flags and not for an ownership entry on v14.
- **The dice, d5907e1b** (the owner's decision quoted in the commit): red on the sandbox five runs of six ([4,1], [3,11],
  [10,3], [4,3], [5,11]; once [7,3], one time in 144 for real dice, not explained), green three of three with "the dice are
  real again after tier 2". The fourth safeguard (a roll thrown on a player's browser skipped by `needs()`) waits for the next
  run, which will read which tests throw one.
- **Scripted dialog answers** (`__dialogAnswers`, the harness's queue; lib/shim.mjs:1566-1720): 9 tests' own bodies and one
  helper; at a table `__dialogAnswers.length = 0` throws "Cannot set properties of undefined" (the four open-Frisk tests that
  left tokens, 179-184) and test 357 waits on its confirm. **For the coordinator**: (a) a probe and a `needs()` skip, or (b) a
  kit seam like the dice's - for one test, DialogV2's waits on the GM answered from `__dialogAnswers`, memory only, taken off
  in a finally. Default (b); not started.
- **Test 1267 does not take the GM's page away - corrected.** I wrote so twice. Measured (17.11.2026): run alone, Playwright's
  `evaluate` of `runTests` loses its context about 2 s in, but no navigation, crash or close is recorded, all four pages stay
  at /game, and the GM page's `performance.timeOrigin` is the same before and after, `game.ready` true. Run detached (the
  result read back from a page global), it had not finished after 600 s. So it waits or runs long, after something early in
  its setup (it puts a made-up GM object into `game.users`, which v14 refuses, and replaces `game.socket.emit`); not read.
- New groups not read yet: passages the fixtures cannot make on v14 (13, "the tunnel was not made"), a test helper setting a
  named property on a form element, which a browser refuses ("Failed to set a named property 'traceOrder' on
  'HTMLFormElement'", 3), the five Reroll tests whose message update Daggerheart 2.12.9 cannot read ("Failed data migration for
  DhpChatMessage ... reading '0'").

**The glue no longer pressing Roll** (the owner's consent, 17.11.2026 about 12:00: "zgoda na dh-dice: okno przestaje samo klikać
Roll"): built and read, not committed. Headless tier 2 with the glue not pressing and `pressingRoll` pressing it too (a scratch
worktree, 120 s limit, no stop): **3305 passed, 0 failed, none timed out** - in tier 2 only the twelve tests went through the
window. The scenarios: **14 red** (10, 11, 12, 13, 15, 20, 21, 30, 33, 40, 61, 62, 72, 76), each a player's page rolling
through the window ("eval timeout on p3" in 10-murder's clean-up; p1's Observe in 62). **For the coordinator**: a "player at
each browser" for scenarios in the harness (client-entry.mjs, not dh-dice) - it presses Roll after the scripted chips on a
scenario's client, off on the GM while `runTests` runs so the suite presses its own, and a scenario may switch it off; or an
explicit press at every place a scenario's player rolls. The two changes are kept as a patch until then; the tree is at HEAD.

**18.11.2026, afternoon: the Reroll tests and 1297, read on the sandbox.**
- **The five Reroll tests (35, 40-43) - the tests', not the module's.** A stack taken inside the runner (test 35's entry in
  `SCENARIOS` wrapped in the page, its throw logged, then rethrown): "Cannot read properties of undefined (reading 'length')"
  at Foundry's `ChatMessage#isRoll` (`this.rolls.length`) in `visible`, walked by the chat log's `_getVisibleTreeContents` as a
  new message is created (Daggerheart's `DualityRoll.toMessage`, build :9814, on the module's `throwDice` -> `supersedingRoll`
  road). One message in the log had no `rolls`: an earlier one, which the Reroll had rewritten -
  `message.update({ rolls: [rerolledSource(rerolled, message)] })` (reroll.mjs:637) wrote a roll of only `class`, `formula`,
  `total` and `evaluated`, no `terms`, and Daggerheart 2.12.9's `DualityRoll.fromData` reads `data.terms[0]` ("Failed data
  migration for DhpChatMessage ... reading '0'"), so that message was left with no rolls. The roll without terms is the
  test's own stand-in: `rerollableRoll` (tests-tier2.mjs) puts in a `SuiteRoll` whose `toJSON()` is exactly `{ class:
  "DualityRoll", formula, total, evaluated: true }`, written for the harness, where a roll message holds plain JSON. On a real
  roll the module writes a whole one (Daggerheart's `reroll` answers `DualityRoll.fromData(...)`; the roll `toMessage` gets
  is a `DualityRoll` of 5 terms, read). I said for a moment in the chat that it was the module's; it is not. **Proposed**: at
  a table the tests reroll a real roll with the faces they name (the dice seam is there now), or `SuiteRoll.toJSON` writes a
  roll v14 and Daggerheart read back. Run directly, outside the runner, test 35 waited instead: its first roll is thrown with
  `remember: true` through the roll window, which nobody pressed there.
- **1297 (E101-T10), the scene on view left empty - timing, not settled.** Through my per-test runner it left
  "state:viewedScene SCENEACADEMY0000 -> null" 3 runs of 4 without a change and 4 of 4 with one I tried (viewing the scene
  again before the halls are deleted) - so that change does nothing and is not kept; through a plain `runTests` call it
  passed and left nothing. My runner adds a press timer and the players' roll recorders to the pages; whether that is why is
  not read. The 17 skips after it in the fourth run come from it.
- **Module defects found: none.**

**18.11.2026: C1's probe for test 404 (the put-back), read on the sandbox.** On Aiko's token, the GM's copy set out of step
(server and PlayerOne at (300,400), the GM's copy at (300,300)), a put-back to (400,300) by each of five roads - `update`
with `diff: false`, with `recursive: false`, with both, `updateEmbeddedDocuments` with `diff: false`, and `move`: in every
run `preUpdateToken` ran on the GM with `x`, `y` and the movement fields (`diff` false), and nothing was written - the GM's
call answered undefined (an empty array, a Boolean for `move`), PlayerOne got no `updateToken` and still saw (300,400), the
GM's copy stayed (300,300). Not sent without `y`: not sent at all. Whether v14's movement steps drop it or a module hook
refuses it is not separated. The table is in docs/dev/e39/CALIBRATION.md section 6; the token was put back after.

**18.11.2026: the fourth run, on the merged tree** (origin/claude/shim-118 at 179c2644 merged into this branch - a
fast-forward, my tip being in it; tiers 0-1 headless 1764 passed, 0 failed, as C1's gate; pushed). Tier 2 on the sandbox one
test per call, no probe press, 11:03-14:34 UTC; compared with the third run **by name** (C1's line added tests, so a
position is not the same test across the two runs; my first comparison this morning went by position and was wrong).
- **The whole run: 1372 passed, 187 failed, 18 skipped** of 1577 (the third: 1326, 214, 26 of 1566). After every chunk the
  restore's second pass read `[]`; every account stayed connected after every test (the runner's record). No test ran to the
  limit. Thirteen tests left the world changed (72, 73, 730, 731, 1056, 1075, 1133, 1219, 1220, 1297, 1462, 1504, 1524).
- **Passages: 3 failures left of about 20** - 1037 ("the pass over a scene of four named regions, a Teleport, a nameless region
  and a player's ..."), 1096 (Room Setup over a Hall, a Teleport Lift, a Gate and a Porch; 1089 in the old numbering) and 1108
  (End the trial's copies on the chosen place). Every tunnel, stairs and Secret Passage test passes on C1's floorNamed.
- **Now passing** since the third run: the passage tests, 357 (its windows answered), the "Present on the primary" trial test
  and 744-749 (the `active` fix), 888, 994, 1038, 1058 (1054 before: the world's two stray stashes, removed - below), 1071 (1067
  before), 1467 and others.
- **Three tests that passed in the third run failed here** - 524 "a project token sweep removes the orphans it is given ...",
  1103 "entering the trial makes the cast's missing tokens ...", 1461 "E62 C3b the Monocub's token ...". Each run alone twice:
  524 passed both times, 1461 passed then failed, 1103 failed then passed. Not a steady regression of the merge; they go either
  way at a table on the same code, which reads as timing. Not read further.
- **New in C1's line and failing at a table**: 404 "a put-back writes every coordinate it names, whatever the writer's copy of
  the token holds": "a put-back to 300,300, written by a copy that held y 300 already, did not send y" - on v14 the client
  still drops a coordinate its copy already holds. **For C1.**
- **The coordinator's list**: 179 and 184 fail on their readings - the open Frisk's ask row never reaches "asking" at a table
  (`asking: false`, `asked: null`; the test answers for the target itself, on the GM, so it is not a player's window); not read
  further. 180 and 181 throw "You may only push instances of User" - the 28 places that put a plain object in `game.users`; on
  the sandbox an unsaved `new CONFIG.User.documentClass({ _id, name, role })` with a valid 16-character id is accepted, its
  `isGM` follows the role, `active` can be set, it is taken out again and nothing is saved; the tests' own ids
  (`!E17T8primaryGM`) are refused ("must be a valid 16-character alphanumeric ID"). **Proposed**: a kit helper building such a
  stand-in and the shim's Users refusing a non-User. 1054 and 1067 pass. 1089 (1096) fails as above. 1267 ("a pip's change never
  spills ...", 1276 here) loses the runner's `evaluate` four runs of four; not a navigation (measured 17.11). The five Reroll
  tests (35, 40-43) all still throw "Cannot read properties of undefined (reading 'length')"; test 35 run outside the runner,
  directly in the page, waited all night without throwing (the probe stopped at 10:40; it had left the setting
  `despairFromRolls` changed, which the restore put back) - not read.
- **The 17 new skips are a test's leftover, not the environment**: 1297, "E101-T10 - one Season setup Save that links a new
  trial hall and sets the phase to Class Trial ...", passed and left "state:viewedScene SCENEACADEMY0000 -> null": the GM's
  canvas has no scene after it, and the 17 tests of the gap that need one skip ("this world has 0 scenes on screen"). Whose -
  the test's put-back or the runner's restore of the scene on view, as for Fear - not read yet.
- **1054 was the sandbox world's** (17.11, evening): Botan's and Chie's stashes in Dorm A, which the seed does not make, left by
  my own earlier probes and outside what my restore watched (a stash is a room region's flag). Taken out with the module's
  `setStash(room, actorId, { present: false })` (Dorm A's flags kept beside the probes), and my restore's baseline now holds
  every region's module flags. Then 1054 passed.
- **Module defects found: none.**

**17.11.2026, evening: the coordinator's decisions built, and the third run** (pushed to 2adc9fef):
- **The glue no longer presses Roll** (f7effd79, 65554625; the owner's words quoted) and **a player at each harness browser**
  (175d580d): every client presses Roll after the scripted chips, stands aside while `runTests` runs there, and its presses
  are in each scenario's results (`harnessPlayer`). Headless before the push: the 14 scenarios that were red green one by one
  (e.g. 30-security p1 32 presses, p2 19), tiers 0-2 3308 passed and 1 failed - R7563, a test of the runner my dice commit
  d5907e1b had broken and which I pushed without running it by name; fixed in eceb1b25 - and every CI scenario green.
- **The dialog answers at a table** (7881daee; the owner's decision (b), relayed by the coordinator, quoted): red on the
  sandbox twice ("this page holds no __dialogAnswers"), green three of three with "the dialogs are real again after tier 2";
  R7566, R7567, six mutants. With it, the four open-Frisk tests no longer throw nor leave tokens (180 and 181 then throw "You
  may only push instances of User", 179 and 184 fail on their readings); 357 still runs to the limit: it queues no answer and
  leans on the harness pressing an unanswered window's default button, which the seam does not model.
- **`active` put back, not deleted** (76a582d4): v14 keeps a User's `active` as its own data property (read on the sandbox);
  "Monokuma's Reveal ..." and "Present on the primary by "trial.present" ..." deleted it, and PlayerTwo then PlayerThree read
  as not connected for the rest of the session (the runner now records the connected accounts after each test: they dropped
  after these two, in the rerun and the third run). Green on the sandbox 731-749: all four connected throughout, both tests
  pass, 742-749 pass where they were skipped. The harness's User reads `active` through a prototype getter, so it was green
  headless; making the shim hold it as v14 does is proposed, not built.
- **The form answers** (2adc9fef): a browser's form refuses a property named as one of its controls; six tests threw
  "Failed to set a named property ... on 'HTMLFormElement'" (185, 1070, 1071, 1074, 1183, 1311). Red at the tree before, on the
  sandbox; with the fix none throws it, four pass, 185 and 1183 fail on their readings.
- **The fourth dice safeguard, measured**: a recorder on each player's page logged every duality roll evaluated there through
  the whole third run: none. Checked that it works: with no GM online a player's own roll was caught (`1d12h + 1d12f + 0`).
  With a GM connected the module draws a player's roll on the GM, so no tier-2 test's scripted roll is thrown on a player's
  browser and no `needs()` skip is called for.
- **The third run** (15:27-19:23 UTC, at d5907e1b with the ownership fix, before the dialog, `active` and form fixes): **1326
  passed, 214 failed, 26 skipped** of 1566. Of the nine the coordinator named, 97, 99, 1005, 1235, 1514, 1525 now pass (real
  dice before); 1054, 1067, 1089 fail (below). Test 1267 lost the runner's `evaluate` again (3 of 3); 357 ran to the limit.
- **Passages (about 20 failures; the tests' and the harness's)**: the module refuses an end that names no floor whenever the
  scene has floors (passages-gm.mjs `tunnelEndAt`: `floors.length ? !floors.some(f => f.id === floor) : floor !== null`), and on
  v14 every scene has at least one (a new scene: `defaultLevel0000`, "Level", read on the sandbox). The fixtures make their own
  scene and ask for ends with `level: null`, as a harness scene with no levels allows; at a table: "Secret passages: name one of
  the scene's floors for each end (none on a scene with no floors)". The module's own tool sends the floor on screen, so a GM
  drawing at a table is not refused. **Proposed**: the shim gives a new scene v14's default level (the red headless) and the
  fixtures name a floor. For C1 only the message's "none on a scene with no floors", a case v14 does not have.
- **Module defects found so far: none.** Everything read today was the tests', the harness's, or Foundry's own (the chat
  notification's "Cannot set properties of null (setting 'hidden')" on players' pages, a card removed while it animates in).
- Still to read: 1054 ("Botan Kage already keeps a stash in "Dorm A" - the scene of the suite's own could not add one"),
  1067 and 1089 (rooms with a Teleport or a Gate), the made-up User objects (180, 181, 1267 and others), the five Reroll tests
  ("Failed data migration for DhpChatMessage"), 357's default button, 735, 762, 185, 1183, 179, 184.

**The stand-in.** The owner wrote "zgoda na dh-dice" in this session on 17.11.2026, about 02:40 local time (between this
line's readings at 02:36 and 02:44). Under it the glue window reads `this.config.costs.length` as Daggerheart does
(d20RollDialog.mjs :127-132); with it both Meddle tests fail headless as on the sandbox ("the window did not write the
Meddle's +1 ..."; "the window draws no bonus input" - the shim's render keeps the throw to itself, so the message differs)
and pass with the kit's fix (both by name, through the suite's runner). Neither is committed yet.

## Questions for the coordinator and the owner (16.11.2026; each with the default this line takes)

1. **E40's season wipe needs a copy world.** The owner makes one with Foundry's Duplicate World (an id with "copy" in it,
   e.g. `drpg-qa-copy`) and launches it; this line then wipes it and reads the result. Default: not run until then.
2. **CLAUDE.md and the code rules file it points to (its "Things that will bite") say a `-=key` "removes nothing in this Foundry"** and point at LIVE-E30-01 for
   the check. On 14.370 it deletes (with v14's deprecation warning). This line does not edit those files; the
   coordinator's. R152 (no `-=` in the module) stands either way. Default: the files unchanged by this line.
3. **audit/harness/versions.json** holds the table's companion versions (6.2.9, 14.0.2, 0.6.8); the sandbox runs Dice So
   Nice 6.4.5, Isometric 14.0.6, LiveKit 0.6.8, Daggerheart 2.12.9. Default: unchanged (LIVE-E30-08 asks for the table's).
4. **The shim proposals D3-D10** (CALIBRATION.md section 4): the update diff, movement's `_movement` and routes, Levels,
   a role change logging out, a region's owner, the writer's copy of another User, `noHook`, `userConnected` before ready.
   Default: none built; each changes what many scenarios read.
5. **E112-01's vision** (step 7): road (a) or (b), or another. Default: open, not built.
6. **Markup in a name in a toast** (group 1, item 23): v14 sanitises it (no handler runs) but draws it, an `<img>` fetching
   its address on the GM's browser. Escape the names the module puts in toasts? Default: left as it is.
7. **Foundry's "GM privately rolled some dice" stub** on the victim's chat at the opening (group 3, item 67). Default:
   accepted as Foundry's own private-roll design (the module writes `blind: false`).
8. **A GM back from a dropped socket without a reload holds stale documents** (group 2, item 44). Default: no module
   change; a note for the GM handbook is the coordinator's call.
9. **PlayerOne's note flag comes back at a GM's load** after a GM's deletion (above). Default: left; the coordinator to say
   whether it is a design (the GM stores writing the flag) or a fault.
10. **The gate's browser**: Playwright 1.56.1's Chromium 141 is older than the 146 Foundry 14.370 wants, and every page
    shows Foundry's error notice (in `__notifications` as an error, which a gate part counting errors would read).
    Default: unchanged (tool config is the owner's).
11. **The voice module's default**: voice.mjs says the first GM to connect gives the world `serverType: "custom"`; this
    world kept `{}` after several GM logins (A/V off). Default: the comment unchanged until read with A/V on.

## Where step 4 stands (16.11.2026, late evening; pass 2 under way)

Counted over the 565 rows of docs/dev/e58/TRIAGE-9.2.md (section 7's 14 and 9.2's 551 numbered items):

| Result | Rows | Which |
| --- | --- | --- |
| measured | 46 | step 3's ten (25, 26, 27, 29, 30, 33, 34, 274 LIVE-H81-03, 477 LIVE-E76-03, 512 LIVE-E39-01) and 22; then S7-4, S7-5, S7-7, 15, 17, 18, 19, 20, 23, 44, 51, 52, 61, 62, 63, 64, 67, 68, 534, 535, 536, 556 (556 its v14 half; the Forge half not checkable); pass 2: S7-1, S7-2, S7-3, S7-8, S7-9, 31, 37, 39, 40, 48, 65, 70, 71 |
| a defect found, open | 1 | 553 (LIVE-E112-01: the veiled killer has no vision of their own on v14) |
| not checkable at this sandbox | 113 | the 98 the readers marked T less 553 and 556, which were read here (96), and 47 (Setup > Duplicate World) - each needs real people, a real LiveKit, The Forge, a second machine, a real GPU at a table, a phone or the owner's own install; and the 16 marked F, each a fixture world (DRPG_FIXTURES unset on purpose; 537 among them, a world played through a chapter). The T and F reasons are the readers' (TRIAGE-9.2.md), not re-read item by item here |
| closed by its own text | 8 | S7-14, 21, 41, 213, 448, 449, 450, 451 |
| left | 397 | everything else: K and S rows not yet driven or shot |

Defects found outside 9.2's rows, each red first and fixed: the tier-2 reader of `game.collections` (step 3, defect 1),
the four registrations at init (step 3, defect 3), scenario 83's L9 race (step 3, item 4). Found and not fixed: the
fuzz's put-back race in lib/fuzz.mjs (group 3, item 62), E112-01's vision (above), the dead ruling buttons in a GM's
chat log (group 1, S7-2), the Eclipse's limit passed by a multi-room move (group 3, 65; for the D4 line).

## Step 5 - E53's measurements (16.11.2026)

| What | Ran | Reading |
| --- | --- | --- |
| The probe | `node audit/live/perf-baseline.mjs --probe --stage E53` | attempt 3 appended to audit/perf-baseline.json, status stays not-measured: `perfReport`'s body is the one recorded for E53 at 1.2.116, the server serves 1.2.116; could not run - "the world copy: DRPG_FIXTURES is not set" and "a browser drawing on a GPU at 1366x768: ... SwiftShader" (its own headless Chromium). So `--run` stays refused, rightly: no fixture world, and the probe's browser draws in software |
| Is there a GPU browser here | `chrome://gpu` and the WebGL renderer in a page, headless and headed | headless: `chrome://gpu` hung (no reading). Headed on WSLg with flags: `chrome://gpu` reads "WebGL: Hardware accelerated*" while the page's renderer is "ANGLE (Mesa, llvmpipe ...)" - **software**; the label the prompt names is not enough here, the renderer string is the check. With Mesa's d3d12 driver (`GALLIUM_DRIVER=d3d12`): "D3D12 (AMD Radeon(TM) Graphics)", the CPU's integrated GPU; with `MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`: "D3D12 (NVIDIA GeForce RTX 4080 SUPER)" - the GPU, through WSLg's D3D12 translation |
| perf() and fps(), run 1 | the four accounts in four headed windows; `perf()` then `fps({ toChat: false })` on the GM and on PlayerOne, Stained Glass then Monokuma Legacy (each a fresh load, the theme in the page's storage) | Stained Glass: about 43 ms a frame (23 fps) on both, fps()'s median 50 ms, p95 50.1 ms, every frame over 33 ms; Legacy about 34 ms (29 fps), median 33.4 ms - frame times on multiples of 16.7 ms, and with the canvas's ticker stopped still 30 ms. Each effect held alone moved the frame by -2.2 to +3.4 ms, either way. These are the browser's: four windows, one in front |
| fps(), run 2 | the GM alone in one focused window, both themes | 300 frames in 5 s, 60 fps, median 16.7 ms, p95 16.8 ms, none over 33 ms, in both themes; the blur, the pulse and the canvas each held changed the frame by at most 0.15 ms |
| The rest of perf() | run 1 | a window reaches the screen in 86.7 ms (Stained Glass) and 69.9 ms (Legacy), median of six; one recut of the glass 6.1-7.2 ms; `roomOfActor` 0.1 ms, `othersInRoom` 0.13-0.19 ms; the fog repainted p95 33-51 ms (2-3 repaints); a chat card painted p95 0.1-0.4 ms; a student's ring p95 0.1-1.9 ms; no roll drawn and no canvas drawn since load in that window, so those lines read "none" |

Machine, date, commit: AMD Ryzen 9 9900X, 31.6 GB RAM in WSL2, NVIDIA GeForce RTX 4080 SUPER through WSLg's D3D12,
Playwright 1.56.1's Chromium 141.0.7390.37 headed, 16.11.2026, 80dfaf06. The full output: docs/dev/e58/PERF-READINGS.md.

What this is not: D27 (b)'s budget is a 1366x768 laptop with the largest isometric map; this is a high-end desktop
through WSLg on the seed's small flat scene, so none of it becomes a budget (the prompt's rule: numbers to the
coordinator for C2, nothing fixed by guess). The owner's own Chrome on Windows, the largest isometric map and the
weakest player's machine (LIVE-E53-01, LIVE-E33-05, LIVE-E88-01) are still not measured.

## Step 7 - E112 at the table (16.11.2026; in progress)

The world launches paused (Foundry's own start); each run here lifted the pause and put it back. On the drawn road with
real dice: the GM opened a murder (Chie, PlayerThree's, on Aiko, PlayerOne's, in Dorm A; Chie's Body raised to 10 for
the run, as scenario 21 does, and put back), PlayerThree's browser got Daggerheart's roll window "Opening the murder ·
beat 8: Chie Mori", the probe pressed Roll, the GM drew it: first try Hope 8 / Fear 5, total 23, `incident`, the mask
standing.

| Row | Result | Reading |
| --- | --- | --- |
| LIVE-E112-01 (553), the veil | **a defect found; open** | while the opening waited: on the victim's browser Chie's token `hidden` and `veiled`, not drawn on its canvas; the killer's own browser draws it; PlayerThree's `BROADCAST_AUDIO` false (the microphone blocked). **The killer's vision**, read with the academy's token vision switched on and sight on Chie's and Aiko's tokens for the run (put back after): before the opening Chie's token is PlayerThree's one vision source (`_isVisionSource()` true, vision active); while veiled it is drawn but **no vision source** (`_isVisionSource()` false, vision inactive), and PlayerThree's canvas sees from **Aiko's** token instead - every player observes every character (the module's ownership default 2), and Foundry takes an observed token's sight when the player's own gives none. So the owner's "the killer still sees their own token and has its vision" holds for the token, not the vision: on v14 the veiled killer sees from the victim's eyes. Not fixed here - design-level (proposal below). Shot e112-01-killer-vision-while-veiled.png (the roll window over the map). Hearing (LiveKit): not checkable here |
| LIVE-E112-04 (556), the "?" | measured on v14 | after the Hope opening, on the victim's browser Chie's token reads name `?`, `texture.src` and `ring.subject.texture` `modules/danganronpa-rpg/icons/mask-unknown.svg`, the drawn mesh's texture that file, its nameplate `?`, drawn; the portrait the same file. The bystander's browser holds the same (not drawn: another room); the killer's too. Shots: e112-01-victim-before-opening.png ("the victim's map: no Chie in Dorm A"), e112-01-killer-before-opening.png ("the killer's own map: Chie drawn"), e112-04-victim-after-hope-opening.png ("Chie's token in Dorm A drawn as the module's ? disc"), e112-04-bystander-after-hope-opening.png, e112-04-killer-after-hope-opening.png. The Forge half: not checkable here |
| LIVE-E112-05 (557), Isometric's silhouettes | left, not settled | client setting `enableOcclusionTokenSilhouette` "gpu", a scratch tile flagged `OccludingTile` over the Gym (Daichi, hidden from PlayerOne): the silhouette layer (`OcclusionTokens`) existed and held no sprite; the control - the tile over Aiko, whom PlayerOne sees - held none either. So on this sandbox (Isometric 14.0.6, the academy not flagged isometric) nothing was built for the module to hide, and its hiding was not exercised. Next: an isometric scene, the tile flagged through Isometric's own tile settings |
| After each run | put back | the incident closed, the mask ended, Chie where she stood with her own picture and Body, the run's cards deleted, the pause restored |

**Proposal (E112-01's vision; not built).** Foundry 14.370 drops a hidden token as its owner's vision source, and the veil
is Foundry's `hidden`. Two roads: (a) keep `hidden` and make a token the module veils a vision source for its owner and
the killers' side (a wrapper on the Token class's vision-source test, beside visibility.mjs `show()`); (b) veil without
`hidden` - visibility.mjs's own per-browser hiding, as rooms already do - which keeps Foundry's vision rules and also
takes away the console's one-hidden-character reading (known leak `foundry-veiled-token-actor`), but changes what a
player's console reads of the token. And either way, the fallback onto an observed token: with every player an
observer of every character, a player whose own token gives no sight sees from someone else's. Red first: a tier 2
or scenario check that reads `_isVisionSource()` on the killer's browser while veiled needs a canvas (LIVE); headless,
the predicate can be held on the token documents. For the coordinator and the owner.

Withdrawn on the way: a first reading that the module's "Daggerheart is newer than the verified version" window, left
open on the GM's browser, kept the opening's invitation from the killer. A control with the window left open and longer
waits brought the roll window: the first runs ended the murder 4 s after opening it, before the invitation arrived.
How long the invitation takes after a GM's login is not measured.

**What the runs here left in the world, and what was put back** (a sweep against audit/harness/lib/seed.mjs, 16.11.2026
evening): the GM's Despair pool `{GM: 3}` and Daggerheart's `ResourcesFear` 3 (the openings' rolls; the probes' clean-ups
had not covered them) - both put back to empty; Aiko's Stress 6 (the incidents' turns) - 0; the shared "DRPG Project"
actor the module makes at a first project - deleted (it makes it again on need); 19 cards the probes left - deleted
(kept: Foundry's tour, Dice So Nice's first-use cards, the module's first-login notes); every token where the seed puts it,
every actor's resources and traits the seed's. Not put back: PlayerOne's `preSessionNote` flag (`{written: true}`, from
step 6's fuzz) - a GM's ForcedDeletion of it applied (both hooks, the GM's copy `{}`), and a fresh GM's load read it back
about 22 s later with a newer `modifiedTime`, the same value: something writes it again at a GM's load; where the module
keeps that note was not found. A question below.

## Step 6 - E43 and E40 at the table (16.11.2026; in progress)

| Row | Result | Reading |
| --- | --- | --- |
| LIVE-E43-01 (534), the fuzz on v14 | measured | audit/harness/lib/fuzz.mjs `fuzz`, unchanged, driven against the sandbox by a runner outside the repository (~/drpg/l1-probes/fuzz-sandbox.mjs: four seeded pages, the cluster's write logs stood in for by the GM page's create/update/delete and setting hooks, polled every 200 ms; the pause lifted for the run): scenario 30's four checks, all pass, 59 s. 108 table actions in their shapes (756 packets), 54 other packet names in three (162); 673 refused, each code of the closed list (notYours 397, gmOnly 189, undoIsTheGms 37, missing 14, badRequest 8, notSecret, cannotNow, notHolding, movedOn 7 each), 737 lines in the GM's log; every request awaiting an answer answered - so v14's server dropped none before the GM's module; no exception on any of the four browsers; nothing polluted; the only writes the GM's six of PlayerOne's own note, put back. Limit: the write log is the GM page's hooks, not the server's |
| LIVE-E43-02 (535), Countdowns | measured | a secret project (PlayerOne in on it, PlayerTwo not): Daggerheart's world setting `Countdowns` names it `???` on every browser, the GM's too; no world setting holds the name or the description; the bystander's Countdowns window reads "No projects yet." and its DOM holds neither; the member's names it, progress "? / 4" (not in its room). Seen: Daggerheart's tooltip on the GM's and the member's window, "This countdown is hidden to players except PlayerOne, PlayerThree, PlayerTwo" - every player, from the module's one-level map; names no secret, but tells the member the bystanders are in. Shots: e43-02-countdowns-member.png, e43-02-countdowns-bystander.png |
| LIVE-E43-03 (536), the open card | measured | a public project in the Gym, which Aiko had not found; PlayerOne opens its token's card ("A project / You do not know what this is.") and walks Aiko in with it open: the card redraws as the project's (its name, description, Progress 0 / 4, Room Gym) without reopening - in all four of Stained Glass and Monokuma Legacy, English and Polish ("Nie wiesz, czym to jest." before, "Postęp", "Pokój" after). Shots: e43-03-card-before-entry-*.png and e43-03-card-after-entry-*.png, one pair each |
| LIVE-E40-01 (537), checkState | measured on this world; the item open | the primary GM's start: nothing on the console; `game.drpg.checkState()` `{ ok: true, problems: [] }` on a world that had seen several murders opened and ended and projects made and removed, but no chapter played; `null` on a player's browser. The item asks for a world played through a chapter: not this one |
| E40's season wipe on a copy world | not run | the sandbox holds one world, `drpg-qa-gate`. A copy is made with Foundry's Duplicate World on the setup screen, which this line does not open, and running it means the owner's server launching it. The owner's step (question below) |

## Step 4 - AUDIT 9.2, in groups (16.11.2026; in progress)

The worklist is docs/dev/e58/TRIAGE-9.2.md: four readers put each of section 7's 14 items and 9.2's 551 numbered items
(565 rows; 537 LIVE ids, `check live`'s count) in a class for this sandbox - K 331 (a script can settle it here), S 102
(a shot can show it), T 98 (needs what the sandbox lacks), F 16 (needs a fixture world), C 8 (closed by its own text),
M 10 (step 3). A class is how an item can be settled here, not a result; each result below.

### Group 1: section 7 (S7-1..14) and items 15-24

| Item | Result | Reading |
| --- | --- | --- |
| S7-4 (CASE-03) | measured | v14 delivers every message to every browser: PlayerOne's console held all 13 the GM held, GM-only whispers among them. Of the module's secret cards a player reads the alias (null) and the whisper list; the content is the placeholder `-`, the words stay on the GM's browser (a card made by hand with plain words would be read: the module never makes one) |
| S7-5 (COMM-03) | measured | a real thread message (messenger.mjs `sendMessage`) to PlayerTwo: its document holds `<p class="notes" data-drpg-secret>-</p>`; the words reached PlayerTwo alone, by `secret.card` (PlayerOne's socket heard nothing), drawn in its chat and messenger window and kept in its `secretCards` store; PlayerOne holds them nowhere (document, drawn card, socket) |
| 15, S7-7 (MAP-02) | measured | PlayerTwo's canvas sampled each frame while Aiko walked from Dorm A into the Cafeteria: hidden in the corridor (last hidden at x 588), first drawn at x 1155 where her right half crosses the Cafeteria's edge (1200), never drawn further left. Limit: headless drew 33 frames in 9 s, so a flash shorter than about 0.27 s between samples is not excluded |
| 17 (COMM-11) | measured | the action is registered ("Safeword: stop the scene"), no default key; bound to F9 and pressed with no sheet open on PlayerOne's page, it opened the Safeword window (Stop the scene, the default, then Cancel); Cancel posted nothing. Seen on the way: the probe sent the key twice and two windows opened - a fast double press opens two |
| 18 | measured | a `system.daggerheart` listener on the GM got PlayerOne's packet with the sender's id as its second argument (`USERP10000000000`); `relayGuard().refused` stayed empty (no `unknownSender`), state `ok`. The packet was an action Daggerheart's switch ignores; a Hope roll's own packet not read |
| 19 | measured | `game.socket.listeners`, `off`, `on`, `prependAny`: functions; `relayGuard().state` `ok` |
| 20 | measured | with two GMs, the non-primary one saving Configure Ownership on Aiko ("All Players: Owner"): `updateActor` reached the primary with `options.noHook === true`; `closeDocumentOwnershipConfig` fired on the window's GM; `ownership.default` back to 2. The harness's reading of `noHook` differs (CALIBRATION.md, D9) |
| 22 | measured (M) | LIVE-E39-01's move (CALIBRATION.md section 3) |
| 23 | measured | v14's toasts are not escaped but sanitised: `<b>`, `<img>`, `<a>` kept as elements; `onerror`, `javascript:` and `<script>` removed (a failing image's handler did not run). A name PlayerOne gave its own character with markup in it was stored as typed and drawn as markup in a GM toast (`DRPG.Anonymity.blocked`), its handler stripped. Not a defect by this reading; an `<img>` in a name makes a GM's browser fetch its address - a question for the coordinator |
| S7-14, 21 | closed by their own text | "To nie błąd, ale warto wiedzieć"; "Nieaktualne od 1.2.67" |
| S7-1 (Search, no GM answer) | measured (pass 2, 16.11 evening) | today's road: a Search proposing Hand (Eye is approved by itself in Daily Life, E32) posts the GM a ruling card, "Open until" five minutes on; the action is not spent while it waits; left unanswered past that time, PlayerOne was told "'The GM's pick of a statistic' was not carried out. The GM did not answer in time. You keep your act[ion]", actions 3, the room's tokens untouched, the search ended. Seen: 3.6 min past its time PlayerOne's notice copy of the card still read "Awaiting a ruling. Open until 09:27 PM." Two earlier runs pressed the window's default (Eye), which approves itself and left the roll window waiting - they measured nothing of an unanswered GM, and are not counted |
| S7-2 (ROLL-06) | measured; **a defect found** | proposing Hand, approved on the GM: PlayerOne's Daggerheart window "Search · beat 8 / 12 / 18: Aiko Hoshino" holds the statistic locked (`trait` finesse, Daggerheart's Hand, disabled); the private result card "Search · Dorm A · 25 · needed 8 / 12 / 18 · Tier 3 · 25 critical 12+12+Hand +1". **The defect**: the ruling card of a player's thread reaches the GM's chat log ("Foundry tools") with enabled "Approve: Hand (+1)", "Change to: ...", "Refuse" buttons that do nothing - a real mouse click on the GM's visible copy changed nothing in 20 s (no error); gm-bridge.mjs wires the log's copy only for a card carrying `callCard`, which only a card with no thread has; a thread's card is answered in the messenger (`messenger-app.mjs` wires every bubble), which the GM's icon badges "1". The ruling itself worked through `pressCard` with the button's own data. Proposal, not built: on a GM's browser wire every card holding `[data-drpg-call]` in the log as the messenger does (`claimCard` already refuses a second ruling), or take the log copy's buttons off |
| S7-3 (ROLL-14) | measured | v14's chat-bar mode is `core.messageMode` (not `core.rollMode`); set to "self" on PlayerOne, the roll window takes "self" and locks it; a Search with Fear (Hope 5, Fear 8), drawn by the GM and whispered to the GM: the GM's Despair pool `{}` to `{GM: 1}` and Daggerheart's Fear with it. Three earlier rolls had no Fear (3/3, 12/1, 12/5) |
| S7-8 (CORE-13) | measured | PlayerOne pressed the safeword twice (`game.drpg.safeword()`, "Stop the scene" each time): one public card "THE SCENE IS STOPPED / Somebody used the safeword. Play stops here. A GM will pick this up, and the scene resumes from a point everyone agrees on."; the second press a "+1" on PlayerOne's notice, no second card; the game paused. The 1.2.43 "already had a safeword" text is gone. Not read: how the GMs are told who (no GM-only card appeared) |
| S7-9 (CORE-06) | measured | an incident open (a drawn opening), PlayerTwo a bystander: its stopwatch "not started"; the GM moved the hour (`advanceTimeOfDay`, morning to noon, the setting noon on PlayerTwo too): the stopwatch stayed as it was 4 s and 16 s after - the display clock frozen on the last public hour for an outsider (hud-elapsed.mjs `paintElapsed`, clock `clockForDisplay`), as the CORE-06 fix intends |
| S7-6, S7-10, S7-11, 16 | left | not yet driven: a trap that fires (an indirect murder's trigger), the overflow hat with a Monocub, two GMs' Despair writes in a race, a trial's sticky cards |
| S7-12, S7-13, 24 | left | shots not yet taken (S rows, after the K rows) |

Group 1 (24 rows): 15 measured, 0 not checkable, 2 closed, 1 defect found (S7-2's dead buttons; S7-2 itself measured), 7 left.

The world after each run (pass 2): ~/drpg/l1-probes/restore.mjs puts back, against a baseline captured from the world as
seeded and cleaned: all 64 world settings of the module (but the seven that write themselves at a load), Daggerheart's Fear
and Countdowns, the messages, the actors (system, flags, picture, ownership, items), the tokens (place, hidden, picture,
name, module flags), the scenes' extra tokens, tiles, walls, notes and drawings, the users' roles and module flags, the
pause. A slip of its first run, mended: it took the module flags off the seed's trace token (`{isRemnant: true}`), the
baseline then holding no token flags - put back by hand, the baseline now holds them and the restore compares them.

### Group 2: items 25-50

| Item | Result | Reading |
| --- | --- | --- |
| 25-27, 29, 30, 33, 34 | measured (M) | step 3 (CALIBRATION.md section 1) |
| 28 (LIVE-E30-07), 46 (E04-06), 50 (E04-10) | not checkable here | each needs a fixture world (an old world copy, a saved browser store, a v1.1.0 world); DRPG_FIXTURES unset on purpose |
| 32 (LIVE-E30-08) | not checkable here | the table's own Data folder (The Forge); the sandbox's versions are in CALIBRATION.md |
| 36 (E31-02), 42 (E04-02), 43 (E04-03), 45 (E04-05) | not checkable here | a real server's network latency (The Forge); two GMs with campaign data on The Forge or a LAN; the table's own browser store; Firefox and Foundry's desktop app |
| 41 (E04-01) | closed by its own text | "Odpowiedziane 31.10.2026 przy stole właściciela" |
| 44 (LIVE-E04-04) | measured, one road | Playwright's offline mode did not close the GM page's WebSocket (connected throughout; nothing measured); `game.socket.disconnect()` then `connect()` from the GM's console did: `disconnect` ("io client disconnect"), `connect` again 10 s later, no reload - and the write PlayerOne made meanwhile (a user flag, on the server) never reached the GM's copy (null 12 s after the reconnect). So v14 sends no missed documents on a reconnect: a GM back that way holds stale data until a reload. A real network loss (not a client-side close) and the GM stores' exchange (two GMs) not read. A question for the coordinator, not a module defect |
| 47 (E04-07) | not checkable here | a second world and Setup > Duplicate World: the setup screen, which this line does not open |
| 49 (E04-09) | left | the reset's refusal on an Assistant and a second Gamemaster: a refused reset is safe, an accepted one wipes the sandbox's only world; left for a copy world |
| 51 (E04-11) | see group 3 | |
| 31 (LIVE-E30-06) | measured (pass 2) | scenario 17's B1, C2 and C3 replayed with a scratch Assistant account (role 3, deleted after; the world's GM stayed the primary): B1 - PlayerOne's Hope through Daggerheart's relay (`DhGMUpdate`, Aiko 2 to 1) written once, by the GM, and read 1 on both GMs; C2 - the Assistant's relay request for role 4 left it at 3, the GM's log alone "Refused a Daggerheart "DhGMUpdateDocument" from CALIB Assistant: a change to a User."; C3 - its relay request for a new User made none (5 before and after), the GM's alone "... "DhGMCreate" from CALIB Assistant: a new User." |
| 37 (LIVE-E31-03) | measured, its first half (pass 2) | PlayerOne's statistic ask (Search, Hand) reached the GM (the card made, acknowledged) and the GM's page closed 2 s later: one notice at 183 s - `TIMING.rulingMs` (180 s) after the ask - "'The GM's pick of a statistic' was not carried out. The GM did not answer in time. You keep your action and your Hope."; the search settled, the action kept. Not read: a GM back before that clock and the ask sent again once with the same id |
| 39 (LIVE-E31-05) | measured (pass 2) | live.mjs `handOff` on a DialogV2, three times each way: the work ran 14-19 ms after the hand-off with motion on and 16-20 ms with the module's `reducedMotion` on, the window gone each time; the same window closed plainly took 624 ms with motion on and 18 ms with it reduced. The hand-off does not wait for the closing transition |
| 40 (LIVE-E31-06) | measured (pass 2) | PlayerOne's module language Polish (the GM's English): its `requestGiveItem` of Botan's comb answered `{refused, reason: notYours}`; PlayerOne's toast "Prośba „Przekazanie przedmiotu" nie została wykonana. Dotyczy postaci, którą nie grasz."; the GM's log in English "Refused a "handover.item" request over the socket from PlayerOne: sender does not own the character giving it away." |
| 48 (LIVE-E04-08) | measured, in part (pass 2) | an incident open (a drawn opening), the GM's browser closed and a fresh one logged in without any of the seed's storage: no "The case on this browser" window - `gmStoreHealth()` missing 0, a row `caseCopy` "11/16/2026, 9:54:43 PM, GM, 1": E111's copy of the case on the server filled the new browser's 67 module stores by itself; the stage `incident` carried. Since E111 the road the item describes (a warning, Restore) is not reached on a browser change. Seen: the new browser's cast differed in one field from the old one's (`deniedToVictim` [] against ["roleReversal"]), consistent with the copy being older than the incident's last writes. Not driven: finishing the incident there. (This morning's warning on a fresh GM was before any copy existed.) |
| 35 (E31-01), 38 (E31-04) | left | a GM-side Reroll of each listed action; a plant whose answer comes late |
| 49 (E04-09) | left, waits for the copy world | a refused reset is safe, an accepted one wipes the only world |

Group 2 (26 rows): 7 measured (M) + 6 measured, 9 not checkable, 1 closed, 0 defects, 3 left.

### Group 3: items 51-75 (in progress)

| Item | Result | Reading |
| --- | --- | --- |
| 51 (LIVE-E04-11) | measured | two tabs of one browser as the GM (v14 disables a connected user in /join's list, in that browser and any other; a second tab with the session opens /game and is ready): a trace placed from each - both rows in the shared store (`gmRemnants`, `gmTraceDigest`) on both tabs, both tokens on the map; nothing lost |
| 52 (LIVE-E04-12) | measured | on PlayerOne's page as the GM's page loaded: `userConnected(GM, true)` (active already) at +4.8 s, `bridge.gmReady` at +10.5 s - the hook comes about 5.7 s before the GM's module is ready - then the answers to the player's asks (fog rows, passages, offers, the mastermind door, the cast, notes, cubs); `primaryGmId` the GM. The harness calls the hook once the client is ready (CALIBRATION.md, D10) |
| 61 (LIVE-E05-09) | measured | utils.mjs `replaceFlag` on PlayerTwo: `{keep, gone, nested}` replaced whole by `{only: 3}`, the same on a player's browser; `forcedDeletion()` on a message's module flags removed one key and kept the other. Put back |
| 62 (LIVE-E05-10) | measured | with no GM online PlayerOne's `saveNote` answered "kept"; a GM logged in from a fresh browser held the note (`gmNotes`, `noteFor`) within 15 s and the user's flag was written. Found on the way: the fuzz of step 6 had left PlayerOne's note flag behind - one of its six `note.save` writes landed after lib/fuzz.mjs's put-back had read the flag clear (a race the harness's model does not show); this line took the flag off (the seed has none) |
| 63 (LIVE-E05-11) | measured | avclient-livekit 0.6.8 registers `liveKitConnectionSettings` at world scope (a player's browser reads it), `config: false`, default `{}`; its server types `custom` and `tavern`; voice.mjs `liveKitSecretWarning` warns for custom with a secret and not for Tavern with one. The module's note that the first GM to connect gives the world `serverType: "custom"` was not seen: the value stays `{}` here after several GM logins (A/V off in this world). Nothing written |
| 64 (LIVE-E05-12) | measured | a scratch unlinked token of Aiko on the Annex: `lastAction` written through its synthetic actor landed in the token's delta, the base actor untouched; `dropRollBookmarks()` `{ dropped: 1 }`, the delta's module flags `{}` after, the synthetic actor without it. A deletion on the delta's path works on 14.370 |
| 68 (LIVE-E06-02) | measured, in part | the GM's drawn roll of the killer's opening (a Hope opening, Daggerheart 2.12.9) as PlayerTwo's (a bystander's) console holds it: no id, name or uuid of the killer's actor anywhere in its JSON; speaker `{ actor: null, alias: "Monokuma" }`; title "Duality Roll"; no `trait` in the roll's options, no effects, bonus effects or experiences, no modifier labels. Not read: the Reroll half (Hope and Sanity settled again, the same trait and experiences), whether `options.data` is empty, Daggerheart 2.6.5 |
| 65 (LIVE-E05-13) | measured; **a defect found, open** (pass 2) | an Eclipse started (`startEclipse`, Noon, 2 crossings each) and PlayerOne moving Aiko through `TokenDocument#move` with waypoints: Dorm A to the Hall by a waypoint in the Cafeteria - one `updateToken` on the GM; the primary's route record (`roomsVisited`) `["Hall", "Dorm A"]`, start and end; Aiko's card "Noon Eclipse · Hall / You are now in Hall, with 1 crossing left during this Eclipse." - the room named is the scene's (as the item asks), and the drag through two rooms cost one crossing. Then Dorm A to the Storage by waypoints in the Cafeteria and the Hall: the token ended in the Storage (on the GM), a third room on an allowance of two; the cards "Noon Eclipse · Hall / ... with 0 crossings left" and "Noon Eclipse · Storage / ..." - the Cafeteria never counted; the route record `["Storage", "Dorm A"]`. **The Eclipse's limit is passed by one room** when a single move's first leg crosses a room. Consistent with CALIBRATION.md D4 (a route is one update, its passed waypoints under `options._movement`), which the coordinator has on claude/shim-118: for that line, with this reading, not fixed here. A mouse drag not driven (the API's move). In Daily Life the same two-room route cost two (step 3: the free Move and an action) |
| 70 (LIVE-E06-04) | measured, in part (pass 2) | on PlayerTwo, a bystander, while PlayerOne's Search ran: the veiled ruling card (placed for everybody, visible) and Foundry's stub of the GM's drawn roll each reached `ui.chat.notify`; the private result card (not visible to PlayerTwo) did not. No `AudioHelper.play` on PlayerTwo, and no dot element found by the probe's selector in v14's sidebar: the dot and the sound themselves not read. The roller without Dice So Nice not driven |
| 71 (LIVE-E06-05) | measured (pass 2) | the card drawn (`renderHTML`, the module's render hook run) under Daggerheart's template: with a GM listening the GM's card reached PlayerOne in 53-61 ms, one card, its header the GM's ("GM 5s ago", the GM's avatar - by the module's design, which names the GM, never the caller); with no GM online PlayerOne's browser made its own card in 54-59 ms, class `drpg-safeword-unsigned`, its header hidden (no name, no avatar showing). Not driven: a GM's F5 mid-press |
| 67 (LIVE-E06-01) | measured, with a question | the victim's browser (PlayerOne) through the opening: while the killer throws, no `drpg-incident-here`, no event panel, no sound; after a failed opening (Chie's Body -20), the same - but its chat shows three veiled cards placed for everybody ("To: GM, PlayerOne, PlayerThree, PlayerTwo", the placeholder `-`, no words reached it) and Foundry's stub of the GM's draw of the opening, "Duality Roll · GM privately rolled some dice", at that moment (private-rolls.mjs writes `blind: false`). After a Hope opening: `drpg-incident-here`, one event card "Face to face / Aiko Hoshino / your turn", the words "Someone is moving on you ..."; no "Chie" anywhere on the page or in its store. One earlier run's card read "Face to face Chie Mori against ..." on the victim: events.mjs names the pair only when that browser's cast holds the killer, which a success with Fear leaves (the mask opens on Hope or a critical); that run's dice were not recorded, and two runs since did not repeat it. Sounds: none captured - the seed has no murder playlist. Shots e06-01-victim-after-*.png |


## Step 3 - the harness against v14 (16.11.2026)

**The PC switched off during this step** (the owner, 16.11.2026; up again 14:40). Read after the restart, before going
on: the tree held every edit of the step, each file parsing (`node --check`) and each change found by its own marker,
the record and the shot whole; but the whole tree had been staged by something other than this line, the self-pointing
`Danganronpa-RPG` symlink and `audit/harness/harness.lock` (flock's file, untracked) among it - those two unstaged
again, the rest left staged, nothing committed. Lost with /tmp: the probe scripts (rebuilt under ~/drpg/l1-probes,
outside the repository) and the first validation run, which had not finished (run again, below). The sandbox: the
owner had started it and launched `drpg-qa-gate` before this line looked (uptime 232 s at 14:44); this line's own
start with `--world` failed on Foundry's data lock and left nothing running. The world: the seed as left - four users
at their roles, six actors (Aiko 3 actions, no flags), every token where the seed puts it, the seed's
`daggerheart.Automation`, no incident, no scratch actor, user or scene - and two Dice So Nice first-use cards whose
author (the scratch Assistant, deleted) no longer exists, which this line deleted (9 messages left, none authorless).
The four readers' triage of AUDIT 9.2 had reached this line before the shutdown and is kept in
docs/dev/e58/TRIAGE-9.2.md.

The readings, item by item, are docs/dev/e39/CALIBRATION.md (for C1, through the coordinator). In short:

| Id | v14 14.370 against the shim | Done here |
| --- | --- | --- |
| LIVE-E30-01, LIVE-E76-03 | `-=` deletes and `==` replaces (actor and token flags), with v14's deprecation warning; the shim's default ignored them | default reading "honoured" (lib/operators.mjs); 00-boot's check rewritten red first |
| LIVE-E30-02 | `ForcedDeletion.create()` a new instance each call (shim: one shared); `_del` an instance, `_replace` a function (same); a ForcedReplacement keeps its value under `OPERATOR_VALUE` with its keys copied onto it, no `.replacement` | both fixed, red first (00-boot); the replacement's one reader in tier 2 then red headless as on v14, fixed, green |
| LIVE-E30-03 | order, instances, emptied and refused updates as the shim; but v14 diffs an update on the client (hooks get the changed keys, a no-op is not sent), the shim does not | proposed (D3), not built |
| LIVE-E30-04 | an Assistant cannot raise itself (refused, error toast), writes a world setting, changes another user's role up to 3: as the shim. The writer's own copy of another User lagged behind its resolved update (3 times) | the lag proposed as a question (D8) |
| LIVE-E30-05 | `userConnected(user, false)` with `active` already false: as the shim. A role change logs the user out (page to /join): the shim logs nobody out | proposed (D6) |
| LIVE-E30-06, -07 | not checkable here: the adapter's four accounts and page hooks (06), no fixtures (07) | - |
| LIVE-E30-08 | the sandbox: DH 2.12.9, DSN 6.4.5, Isometric 14.0.6, LiveKit 0.6.8; versions.json is the table's (6.2.9, 14.0.2, 0.6.8) | not changed (a question) |
| LIVE-E30-09 | the seven sheets, module.json's order, each `@import` in layer `modules`; `--drpg-window-max` 1400px: as the shim | - |
| LIVE-E30-10 | the drawn window: world named, Cancel first and focused, Enter cancels, the world unchanged (shot e30-10-tier2-dialog.png): as the shim's configuration check | - |
| LIVE-E39-01 | one update per route with every grid step in `options._movement[id].passed.waypoints` (shim: `options.movement`), `_regions` in the changes, `preMoveToken`/`moveToken`; Levels an embedded `Level` collection with `{bottom, top, base}`; `Region.levels`, `includedInLevel`: as the shim; a level change leaves elevation; Regions have `ownership` (shim: none) | proposed (D4, D5, D7) |
| LIVE-H81-03 | the module's own placing options reach every client's hooks; v14's own displacement carries `teleport: true` in `updateToken` only, `movementAction` never | read; the module's guard holds where it runs |

**Defects found by the readings** (each red first, then fixed):

1. `game.drpg.runTests({ tier: 2 })` would have errored on v14 before its first test: scripts/tests-kit.mjs `worldDump`
   destructured `game.collections` as `[name, collection]` pairs ("collection is not iterable" read on 14.370), and
   tests-tier2.mjs's restore snapshot did the same. The shim's `game.collections` was a plain Map, so headless never saw
   it. 00-boot's new check red on the Map (`values: false`), the shim's a Collection, the same TypeError then headless,
   both readers on `entries()`, green (tier 2 "E39-T1" ran).
2. The live runner's guesses: the join form (step 1), the seeder's empty world (step 1), and two more found here - the
   seeder wrote the seed's documents but not its world settings (`daggerheart.Automation`; now written and read back,
   `--settings-only` for a world seeded already), and the parts' browsers lacked the storage the harness's browsers hold
   (`storage.gm`, the trace's answer key), so every GM login opened "The case on this browser". foundry.mjs
   `seededLogin` gives each account its role's storage before the module loads.

3. **A player's browser asked for nothing at its start, on every real v14** (found while driving a Search, AUDIT 9.2
   S7-2): `sessionFailures()` on a fresh GM and a fresh player held, every load, "Could not register the pick's passes",
   "... the room actions' uses", "... the eavesdrops", "... the timed effects" - "Cannot read properties of null
   (reading 'isGM')" at lockpick-gm.mjs:216, facility-uses.mjs:122, eavesdrop-gm.mjs:326, timed-effects.mjs:405. The four
   register at `init` (module.mjs), and on 14.370 `game.user` is null at `init` and `i18nInit` (read hook by hook: null,
   then the User from `setup`; `game.userId` set throughout; `game.users` empty at the first two). Each function's hooks
   and socket listener stood; its last line, a player's first ask (`askForPasses`, `askForUses`, `askForRows`,
   `askForTimedEffects`), threw, so after any load a player's browser held no copy of its lock-pick passes, used room
   actions, eavesdrops or timed effects until the next change sent one. The shim held the User from the start. Red:
   the shim's `game.user` null through `init` and `i18nInit` (client-entry.mjs), then 00-boot's new check "startup: no
   registration of the module failed ..." red with exactly those four (36/37). Fix: each ask at `ready` (the comment over
   `registerFacilityUses` already said "At ready"). Green: 00-boot 37/37; mutants 4/4 killed (each file's ask put back
   at init on a copy, 00-boot red). On the sandbox after the fix: no registration failure on the GM or a player, and the
   GM hears the player's `lockpick.passesAsk`, `facility.usesAsk`, `eavesdrop.rowsAsk`, `timed.effectsAsk` at its start.
4. **Scenario 83's L9 raced the turn** (found by the validation run): with the shim's world collections as v14 keeps
   them, L9 failed 109/111 on every run (5 of 5) and passed on the base tree (2 of 2) and on the base with the new
   operators file alone (1 of 1); the collections change alone on the base failed it (2 of 2). Read inside (a page
   variable, not the console, which changed the timing and let it pass): PlayerThree's own copy of the murder state still
   read the victim's turn when it pressed Finishing Blow - refused as `DRPG.Murder.notYourTurn` - while the GM's read the
   killer's. The scenario pressed at once after the GM passed the turn. Fixed in the scenario: p3 waits for its copy to
   read the killer's turn (at most 10 s), as a player sees it before pressing. 83: 111/111. Why the collections change
   moved the timing: not explained.

Also read: Playwright 1.56.1's Chromium 141 draws Foundry's error notification "unsupported on Chromium version less
than 146" on every page (in `__notifications` as an error); Daggerheart 2.12.9 still calls `_del()`, which throws on
v14 (the system's line 9154), and its `DhpChatMessage.renderHTML` throws on a message whose author was deleted
(build line 42439: `author.avatar` of null).

**The validation run** (one harness at a time, flock; ~/drpg/l1-probes/val3.log, the first run lost with the
shutdown): quick - lint red with 2 problems, mine (`localStorage` not defined in foundry.mjs's init script, which runs in
the page; written `globalThis.localStorage`), check 25/25, gate 37/37; tiers 0-1 1759 ran, 1744 passed, 0 failed, 16
skipped, 0 red (300 s); 00-boot 36/36; 91-old-keys-ignored 10/10; 92-old-keys-honoured 10/10; 30-security 302/304, the
2 expected red (Foundry limits); 83-roll-integrity 109/111 (L9, item 4 above); tiers 0-2 whole 3324 ran, 3301 passed, 0
failed, 27 skipped, 0 red (4592 s). After items 3 and 4: 83 111/111, 00-boot 37/37, and a second run (~/drpg/l1-probes/val4.log): quick green (lint 0
problems, check 25/25, gate 37/37); tiers 0-1 1759 ran, 1744 passed, 0 failed, 16 skipped, 0 red (296 s); tier 2 by the
four features' names (Pick the Lock, lockpick, pass, Facilit, room action, eavesdrop, timed effect) 209 ran, 213 passed,
0 failed; 33-bridge-paths 89/90 (1 expected red, a Foundry limit); 99-actions 14/14; 30-security 302/304 (2 expected
red); 40-flow 89/89. Not run locally: the other ci scenarios (CI runs them on a push without [skip ci]; this line
pushes with it, so they wait for the coordinator's run).

## Step 2 - dry run: every part dry-run (16.11.2026)

| What | Ran | Reading |
| --- | --- | --- |
| The dry run | `DRPG_SANDBOX_WORLD=drpg-qa-gate npm run gate:local -- --dry-run` in audit/harness, at 1c76e88f | 0.27 s. `live-stained-glass`, `live-monokuma-legacy`, `live-world-diff`, `sandbox-14-quiet`, `sandbox-60-ledger`, `sandbox-81-render-budget`, `sandbox-83-roll-integrity`, `sandbox-84-viewports`: each `not-run`, reason `dry-run` ("http://localhost:30099 answered (HTTP 200); no part was run"). No drill listed (every stage row's `drills` is empty). Verdict incomplete, unsigned (DRPG_GATE_KEY not set, as the owner chose); nothing written |
| What the dry run does not read | the runner's own first checks, run by hand from a scratch script (foundry.mjs `serverReason`'s rule, `servedDiff`'s loop copied, `login` for each account) | `/api/status` active, 14.370, world `drpg-qa-gate`: none of no-world, wrong-foundry, not-a-copy. 281 module files served (module.json, scripts, styles, lang), 0 differ from the checkout: not stale-module. GM, PlayerOne, PlayerTwo, PlayerThree each logged in on /join without a password (roles 4, 1, 1, 1; module 1.2.116, Daggerheart 2.12.9): not password-required |

Nothing for the owner to change. Left: steps 3-8.

## Step 1 - seed: done (16.11.2026)

The owner answered question 3 with the default (a), and questions 1 and 2 with theirs.

| What | Ran | Reading |
| --- | --- | --- |
| Red first | `node tools/check.mjs gatecode` with its new part (the seeder's self-check) and no rule yet | red: "audit/live/world-empty.mjs is missing - the seeder has no rule for a fresh v14 world" |
| The rule | audit/live/world-empty.mjs: `readInventory` (run in the page), `leftovers` (judged in node), `FIRST_LOGIN_14_370` (the inventory read on 16.11), `selfCheck`; seed-world.mjs reads the inventory before it writes and refuses on any leftover | accepted, each recognised by what was read: Folders of type Compendium; the scene `NUEDEFAULTSCENE0` on a `nue/` background with no tokens, notes, walls, regions, drawings, sounds or templates; a message by a GM, whispered to GMs only, spoken by no actor, with flags of `core` and the module alone, that is the tour's (`core.nue`, "Foundry Virtual Tabletop", an `<h3 class="nue">` head), Dice So Nice's (its alias, a `div.dice-so-nice` head) or the module's first note (`drpgMessage` and `secret` only, content exactly `<p class="notes" data-drpg-secret>-</p>`); any setting. Anything else, and any other collection not empty, refuses |
| Green | the same | `seeder 22/22 planted world(s) refused, the 14.370 world accepted; 0 problem(s)`. Each planted world must be refused with its own line (a player added as a user does not count as the message rule held) |
| Mutants | 7, each on an rsync copy of the tree, `check gatecode` there | 7 KILLED: Folder type ignored; whisper readers not read; the tour scene's tokens not read; unknown collections accepted (3 cases); the module note's content not read; extra flag scopes accepted; the author not read |
| The seed | `DRPG_SANDBOX_WORLD=drpg-qa-gate node audit/live/seed-world.mjs` | `seed-world: created 3 User, 6 Actor, 2 Scene in drpg-qa-gate`, exit 0 |
| Read back | a read-only page as GM against audit/harness/lib/seed.mjs | users PlayerOne, PlayerTwo, PlayerThree (role 1) with the seed's ids; the 6 actors (Aiko, Botan, Chie, Daichi, Monokuma, Remnant) with theirs; "Academy - Floor 1" active, 5 tokens, 6 regions; "Academy - Annex" 1 token. The tour's scene was made inactive by v14 itself when the active academy was created. The world's GM (`NlTKlEFf2ZXi2dtz`) stands in for the seed's `USERGM0000000000`, which the seed names only on its own User document. `__errors` on the GM's page: none |

A deviation from question 3's wording: the rule is held by `check gatecode`'s self-check (as audit/gate/ci-record.mjs's
is), not a tier 0 test - tier 0 runs in Foundry's page, and the seeder runs in node.

Left: steps 2-8.

## Step 1 - seed: stopped, the world is not empty (16.11.2026)

The owner launched `drpg-qa-gate` (16.11.2026). What ran and what it read:

| What | Ran | Reading |
| --- | --- | --- |
| The server | `curl -s /api/status` | `{"active":true,"version":"14.370","world":"drpg-qa-gate","system":"daggerheart","systemVersion":"2.12.9","users":0,"uptime":34442}`. Daggerheart is **2.12.9**, not the 2.12.8 the prompt names. The runner's UNMEASURED guess at the field names (`active`, `version`, `world`, foundry.mjs `serverReason`) holds |
| The seeder, first run | `DRPG_SANDBOX_WORLD=drpg-qa-gate node audit/live/seed-world.mjs` | `error`, the runner's: `page.selectOption: Timeout 30000ms exceeded ... waiting for locator('select[name="userid"]')` (foundry.mjs `login`) |
| What /join is on v14 | a read-only Playwright page dumping the forms' fields; nothing typed or pressed | two forms. `form#join-game-form`: `select[name="userId"]` (id `join-username`; options "" and "GM"), `input[type=password][name="password"]`, `button[name="join"]` "Join Game Session". `form#join-game-setup`: a hidden `action`, `input[name="adminPassword"]`, "Return to Setup" |
| The fix | foundry.mjs `login`: `form#join-game-form select[name="userId"]` and `form#join-game-form button[name="join"]`, the reading written in its header instead of "UNMEASURED: the join form's selectors on v14" | `node tools/check.mjs gatecode live dashes` 0 problems; eslint clean. No harness test drives `login` (it needs a real server), so the first run below is its test: it logged in |
| The seeder, second run | the same command | `seed-world: refused - the world is not empty: 3 Folder, 1 Scene, 5 ChatMessage, 17 Setting`, exit 2. Nothing written |
| What the world holds | a read-only page as GM listing each document and its `_stats.createdTime` | every one written on 15.11.2026 between 20:42:42 and 20:43:33 UTC, at the world's creation and its first GM login: 3 Compendium folders (Daggerheart's "Character Options", "Daggerheart SRD", "Items"); Foundry's new-world scene "Foundry Virtual Tabletop" (`NUEDEFAULTSCENE0`, active, no tokens; flags of isometric-perspective and danganronpa-rpg); 5 messages - Foundry's "Getting Started" and "Inviting Your Players", Dice So Nice's first-use card, and two of this module's, each whispered to the GM (`drpgMessage`, `secret`, 39 characters); 17 world settings (core: time, permissions, moduleConfiguration, compendiumConfiguration, nue.shownTips; daggerheart: Automation, LastMigrationVersion; dice-so-nice: formatVersion, rolesMigrated; isometric-perspective: depthSortActiveFlag; danganronpa-rpg: caseMark, levelUpsMigrated, diceLookSource, diceLookWorld, migratedVersion "1.2.116", foundryBefore, documentLanguage) |

What it means: on v14 a world is never empty by the time a GM can log in to it. Foundry writes its tour, Daggerheart
its folders and every module its first-run settings at the first ready, so seed-world.mjs's rule ("refuses a world that
holds anything but its GM") refuses every fresh v14 world. That is the runner's guess, not the owner's data; still, the
rule is a guard on the owner's worlds, so this line does not loosen it or clear the world without the owner's word.

Correction to step 0: `node tools/check.mjs live` counts **537 items in AUDIT 9.2** (1007 citations in 452 files). My
grep's 551 numbered lines ran past 9.2's end; 537 is the number the steps below count against.

Left: step 1 (waits for question 3), steps 2-8.

Questions:

3. How should the seed get an empty enough world? **Default proposed: (a)**.
   (a) seed-world.mjs counts as empty a world whose only documents are what a fresh v14 world writes at its first
   login, each recognised narrowly: Folders of type Compendium; the scene `NUEDEFAULTSCENE0` with no tokens; chat
   messages flagged `core` (the tour) or this module's GM-only `drpgMessage`, or Dice So Nice's first-use card; and
   any world setting (settings are not documents a table makes). Anything else still refuses. A tier 0 test holds the
   rule on fixtures (red first: the 15.11 world refused today). The academy scene the seed makes is then activated and
   the tour's scene left as it is.
   (b) The owner deletes the tour's scene, the 3 folders and the 5 messages by hand, then this line seeds. The 17
   settings would still refuse, so (b) also needs (a)'s setting rule.
   (c) Something else the owner names.

## Step 0 - preflight (16.11.2026)

| What | Ran | Reading |
| --- | --- | --- |
| The branch | `git fetch origin`; no `claude/e58-local` on origin, so `git switch -c claude/e58-local origin/main`, then `--unset-upstream` (it tracked main) | at ff3e12e5; module.json 1.2.116 |
| The tree | `git status --short` | tracked tree clean; one untracked entry, `Danganronpa-RPG`, a symlink at the root pointing at the checkout itself (made 15.11 21:39, a minute after the sandbox's module link). Left as it is (question 1) |
| Node | `node -v` | v24.22.3 |
| The harness | `cd audit/harness && npm ci` | installed (npm audit lists advisories in dev dependencies; not touched) |
| The quick gate | `npm run quick` | green: lint 414 files 0 problems (15.9 s), check 25 parts all green (54 s), gate self-test 37/37 (2.3 s); 72.6 s wall. CLAUDE.md says 9-13 s "here": on this machine it is about six times that, nearly all of it `check` |
| The sandbox | `curl -sI http://localhost:30099` | `HTTP/1.1 302 Found`, `Location: /setup`: the server answers and no world is launched |
| The environment | `source ~/drpg/qa-env.sh`, then each name tested for being set | set: DRPG_SANDBOX_URL, DRPG_SANDBOX_WORLD. Unset: DRPG_GATE_KEY (the owner's choice), DRPG_API_KEY, DRPG_FIXTURES (on purpose), DRPG_REPO, PLAYWRIGHT_BROWSERS_PATH |
| The pre-push hook | `ls .git/hooks`, `git config core.hooksPath` | none installed in this checkout (only the samples); nothing to get round, and nothing guarding the push but the rules |
| The sandbox's modules | `ls ~/foundry/qa-data/Data/modules` | avclient-livekit, dice-so-nice, isometric-perspective, and danganronpa-rpg as a symlink to this checkout |

Read before step 1: CLAUDE.md, docs/dev/METHOD.md, audit/gate/README.md, audit/live/README.md, audit/harness/README.md
("What the harness cannot do"), audit/AUDIT-1.2.42.md 9.2 (its head; 551 numbered items, 556 distinct LIVE ids from
line 699 on, counted by grep), the plans E39, E40, E43, E53, E58 on origin/claude/plan-130, docs/dev/e39, e40, e43 and
e112 STATUS.md, tools/stages.json's rows (E39, E40, E43, E53, E58 all planned 1.2.117, version null; E112 shipped
1.2.116 on 16.11.2026, touches sockets, rolls, scenes).

Left: steps 1-8.

Questions (each with the default this line runs on):

1. The self-pointing symlink `~/drpg/Danganronpa-RPG/Danganronpa-RPG` is untracked and makes `git status` not empty.
   Default: left alone; the owner removes it if it was a slip (`rm ~/drpg/Danganronpa-RPG/Danganronpa-RPG` removes the
   link only, not the checkout). Lint and the 25 checks did not follow it.
2. The sandbox is at `/setup`. Step 1 (seed) and step 2 (dry run) need the world `drpg-qa-gate` launched; this line
   never logs into setup. Default: the owner launches the world, then this line seeds it.
