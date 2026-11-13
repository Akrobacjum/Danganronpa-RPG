# E40 - status (the work line of E39 and E40)

Updated 13.11.2026. The plan is `docs/dev/plans/E40.md` on the planner's branch `plan-130` (read whole). Same branch as
E39 (this branch), same R range R5100-R5199, same rules. E39's commits are below this file in the branch; E40 starts
at C1 here. Scenario 18-trial (the README's planned row) is this stage's, as is any new tier-2 test (named, not
R-numbered).

## The plan's own status, and the default taken

As with E39, the owner moved E40 out of the plan on 25.10 (its Q-E40-1). The coordinator assigned it to this line, so
the line builds behaviour tests the verification chat can keep; **default taken, owner to confirm**. The plan's six work
items (its section 3) are large; they are built as commits as far as this line reaches, and what is not reached is named
below under "Waits for / not built".

## Done

| Commit | What | Where |
| --- | --- | --- |
| C1 (3752cc66) | tier 2 **E40-T1**, DC36: a wrong verdict in the Class Trial sentences the accused (`verdict.sentenced`) but kills nobody, its card saying the execution waits (`executionPending`); `executeAtExit` at the trial's close executes once and stamps `executedAt`. Two states of the one actor, alive then dead | scripts/tests-tier2.mjs |
| C2 (0919d66f) | **`game.drpg.checkState()`** (scripts/state-check.mjs, new): a pure `stateProblems(snapshot, clock)` and a GM-only reader of this world, each problem said on the console in English, `{ ok, problems }`, null on a player's browser; it only reads. Three invariants the module already states: world-secrets.mjs's rules, no `passage*`/`frisk*` module flag on an actor, user, token (and delta), message, item, scene, region or wall (A10/A11), and the clock's phase and counters. Tier 1 R5100 on fixtures and the suite's world; api-surface.json's row (R1560) | scripts/state-check.mjs, api.mjs, tools/api-surface.json, tests-tier1.mjs, R-REGISTRY.md |
| C3 (b9a36767) | its two callers: once at the primary GM's ready (warnings on that GM's console only), and after every scenario in the harness (cluster.mjs: a check of its own, read on a GM still connected; noted, not failed, with no GM left or a tree without it). Its first run found 30-security's leftover (below), fixed in the scenario | scripts/module.mjs, audit/harness/cluster.mjs, scenarios/30-security.mjs |
| C4 (9a764940) | tier 2 **E40-T3**, the phase x action matrix: the sheet's tile (`actionButton`) and the press (`performAction`) held to each other in daily life, an Eclipse, the Class Trial and a fight, for every key of ACTIONS - they agree in every cell. A fight in an Eclipse is measured unreachable both ways (no Eclipse started in a fight, no fight opened in an Eclipse); written raw, ten keys' tile and press disagreed on the sentence, which only a console reaches | scripts/tests-tier2.mjs |
| C5 (3f72611c) | **18-trial**, the planned row: the trial step by step on the browsers that do each step - opened, real ballots from p1, p2 and p3 (Chie's player too) through the bridge, the count, a wrong verdict (DC36: nobody dead yet), the close executing once - with p1's and p2's world data and new cards scanned for the Blackened after every step (`canary.worldScan`, `canary.chatScan`); 26 checks | audit/harness/scenarios/18-trial.mjs, README row 18, tests-flows.mjs (class-trial names 18) |

## Mutants (the plan's item 6, so far)

| Mutant | Check | Verdict |
| --- | --- | --- |
| trial-progress.mjs `sentenceOf` returns null | E40-T1 | KILLED (the close kills nobody; the accused stays alive) |
| verdict.mjs's card drops its classTrial branch (always `executionNow`) | E40-T1 | KILLED (the verdict's card reads as if the execution happened now) |
| vote.mjs `ballotRefusal`: a name twice allowed | the older vote tests (48 run by "ballot"/"vote") | KILLED by "a ballot naming one student twice or too many or of a round gone is refused and told" |
| `ballotRefusal`: another round's ballot allowed | the same | KILLED by the same test |
| `ballotRefusal`: the wrong number of names allowed | the same | KILLED by the same test |
| `ballotRefusal`: a name off the ballot allowed | the same | KILLED by the same test |
| state-check.mjs absent (removed on a copy, api.mjs's import and row taken out) | R5100 | KILLED (the red before C2, measured) |
| `stateProblems`: the passage/Frisk key filter off; the world-secrets loop off; the phase check off; a token's delta not read | R5100 | KILLED, each |
| `checkState`: the GM gate dropped; `quiet` ignored | R5100 | KILLED, each |
| the press's trial gate letting Search through; its Eclipse gate locking Move; the tile's trial lock letting Listen through | E40-T3 | KILLED, each |
| eclipse.mjs `startRefusal`'s incidentFirst dropped; murder-rules.mjs `openMurder`'s Eclipse refusal dropped | E40-T3 | KILLED, each |
| the verdict's public card carrying the register's Blackened (`trialBlackenedIds`) in its flags | 18-trial | KILLED: the verdict step's world and chat scans and the close's world scan fail |
| the same card carrying the verdict record's `blackenedIds` | 18-trial | SURVIVED - that record holds none at the card, so the mutant leaked nothing (read on the run) |

A test written for the four ballot rules (E40-T2, 13.11.2026) was dropped before it was pushed: the mutants above
showed the older test already fails on each of them, so it measured nothing new but that a player's second legal
ballot replaces the first. The comment it carried at first said the four lines were measured by nothing; that was a
guess from a `git grep` on the refusals' words, and the mutants showed it wrong.

## The mutation run (the plan's item 6): twelve rules of the trial and the reset, each broken once

Each a one-place edit on a copy of the tree (`DRPG_REPO`), the named check run on it; the runner and its definitions are
kept outside the repository (METHOD.md section 4), so each edit is written out here to be made again. 12 of 12 FAIL.

| # | Rule | The edit | Fails |
| --- | --- | --- | --- |
| 1 | a ballot names nobody twice | vote.mjs `ballotRefusal`: the `new Set(names).size !== names.length` line removed | tier 2 "a ballot naming one student twice or too many or of a round gone is refused and told" |
| 2 | a ballot of another round is refused | `ballotRefusal`: `Number(round) !== progress.vote.round` taken out of the first line | the same |
| 3 | a ballot names as many as the vote asks | `ballotRefusal`: the `names.length !== progress.vote.picks` line removed | the same |
| 4 | a ballot names only who is on it | `ballotRefusal`: `names.every(id => listed.has(id))` read as true | the same |
| 5 | the verdict kills nobody (DC36) | verdict.mjs `readSentence`: `killCharacter` called on each sentenced | E40-T1; 18-trial verdict and close |
| 6 | the verdict does not close the trial (E70's amendment) | `readSentence`: the clock written to Daily Life | E40-T1; 18-trial verdict and close |
| 7 | the trial's close carries the sentence out | trial-progress.mjs `sentenceOf` answering null | E40-T1 |
| 8 | the verdict's card says the execution waits for the trial's end | verdict.mjs `postVerdictCard`: always `executionNow` | E40-T1 |
| 9 | the verdict's public card names no Blackened | `postVerdictCard`'s flags carrying `trialBlackenedIds()` | 18-trial verdict (world and chat) and close (world) |
| 10 | no Eclipse starts in a fight | eclipse.mjs `startRefusal`: the incidentFirst line removed | E40-T3 |
| 11 | no fight opens in an Eclipse | murder-rules.mjs `openMurder`: its Eclipse refusal removed | E40-T3 |
| 12 | a season reset clears the trial's record | season-wipe.mjs `RESET_STEPS` without "trialProgress" | 65-season R1; tier 2 R50 and E42-T6 |

On a copy of the tree the expected-red checks of a scenario count as plain failures (cluster.mjs: no verdicts on another
tree), so 65's X2 and X2b, red by a Foundry limit in its own tree, failed beside R1 under #12; R1 is the reading.
Into the release gate: the gate's wiring is tools/stages.json's and .github's, which this line does not touch - the
coordinator's to register, from this table.

## Bugs found

None in the module's code by a failing test. Two readings:

- **30-security left a world secret behind** (found by C3's after-scenario check on its first run, 13.11.2026): Botan's
  Truth Bullet ended the scenario holding `remnantRef: null`, a key world-secrets.mjs says no Item may carry. The writer
  was the scenario's own GM put-right, which writes the bullet guard's whole copy back; the copy keeps every guarded
  field, one the bullet never had as null (truth-bullets.mjs `guardedValues`, `?? null`). Fixed in the scenario (C3):
  the key taken off with the GM's `unsetFlag` once the phase's checks have run (they need it in the copy - taken out of
  the put-right, three whole-list checks read "no record to restore", measured).
- **The same pattern in the module's own put-back, read in the code and not run**: `revertPlayerBulletEdit` writes the
  guard's value back for each path a player touched, and the guard's value of a field the bullet never had is null. So a
  player's console write of `remnantRef` (or any guarded flag the bullet lacked) would be put back as the key holding
  null, not as no key - world data holding the key, empty. No secret is in it; the world-secrets rule and this state
  check would name it. **Question for the owner**: should a put-back of a field that was absent delete it
  (`forcedDeletion()`/`unsetFlag`) rather than write null? Not changed on this line (it is E29's road; a tier-2 test of
  it is the first step).

## Test results

- Before the push of item 5 batch 5 (13.11.2026): its 6 tests by name, 0 failed; `node tools/check.mjs` 19/19; lint 0
  problems; tiers 0-1 whole 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red.
- Before the push of item 5 batch 4 (13.11.2026): its 8 tests by name, 0 failed; `node tools/check.mjs` 19/19; lint 0
  problems; tiers 0-1 whole 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red.
- Before the push of item 5 batch 3 (13.11.2026): its 11 tests by name, 0 failed; `node tools/check.mjs` 19/19; lint 0
  problems; tiers 0-1 whole 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red.
- Before the push of item 5 batch 2 (13.11.2026): its 6 tests by name, 0 failed (25 s); `node tools/check.mjs` 19/19;
  lint 0 problems; tiers 0-1 whole 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red.
- Before the push of item 5 batch 1 and the R3712 fix (13.11.2026): the 27 tests holding batch 1's sites by name, 31
  passed, 0 failed (80 s); `node tools/check.mjs` 19/19; lint 346 files, 0 problems; tiers 0-1 whole 1420 ran, 1405
  passed, 0 failed, 16 skipped, 0 red (433 s). No scenario reads tests-tier1.mjs or tests-tier2.mjs by name (`git grep`).
- **R3712 and the primary's beat** (a reading, and a test-only fix): with batch 1 applied, tiers 0-1 whole failed on
  R3712 (E62, from main) in two runs out of two; it had passed in the merge gate. The write it saw was
  `gmClockBeat`, the primary GM's beat, a `setInterval` of 60 s armed at ready (hud.mjs). R3712 counts every setting
  write in its window of about 2 s, so it fails whenever a multiple of 60 s after ready falls inside it, and that
  depends on how long the tests before it take. Measured: at b7455b97 in a worktree, whole, passed; the same tree with
  batch 1's twelve lines as comments alone (nothing executable), whole, failed; R3712 alone with batch 1, passed 3 of
  3. The fix leaves out the beat's key, read from the store (`clockBeatStore.spec.key`; R171 forbids the raw key
  outside the engine), and nothing else: a planted `onClockHeard` that writes the beat and `sequences` fails R3712
  naming the `sequences` writes alone. Every batch changes the file's length again, so without this the test would
  flip back and forth on later batches and on other lines' changes.
- Baseline tiers 0-1 at 421f2395 (E39's): 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red.
- Before the push of C5, at 3f72611c: tiers 0-1 whole 1321 ran, 1306 passed, 0 failed, 16 skipped, 0 red (414 s);
  88-flow-length (reads tests-flows.mjs) and 18-trial, each `run-all.mjs scenarios --only NN`, green.
- Before the push of C4, at 9a764940: tiers 0-1 whole 1321 ran, 1306 passed, 0 failed, 16 skipped, 0 red (429 s);
  tier 2 by name E40-T3, E40-T1 and "in a fight the tile says Crisis actions" 3 ran, 0 failed. No scenario reads
  tests-tier2.mjs (`git grep`).
- Before the push of C2-C3, at b9a36767: `node tools/check.mjs` 17/17; lint 323 files, 0 problems; tiers 0-1 whole 1321
  ran, 1306 passed, 0 failed, 16 skipped, 0 red (418 s); R5100 and R1560 by name 0 failed; every ci scenario but 01
  (40) run once with the state check, in two lanes at 047f9423+b7533ade (before the rebuild of the two commits; the only
  change since is api-surface.json's row and 30's fix): 36 green with the check, 30 red on its leftover and green after
  the fix at the rebuilt tree (276/277, 1 expected red), 33, 63 and 73 noted (no GM left connected at their end - the
  check reads nothing there).
- CI from C2 on: pushed with "[skip ci]" (the coordinator's word, 13.11.2026: tested commits with [skip ci]); the next
  push without it, or the release's run, runs them.
- Before the push, at 3752cc66: tiers 0-1 whole 1320 ran, 1305 passed, 0 failed, 16 skipped, 0 red (386 s); E40-T1 by
  name 1 ran, 0 failed (9 s); 63-class-trial (the trial driven end to end) green, 114 s. No scenario reads
  tests-tier2.mjs by name (`git grep`); 01-runtests runs it whole in CI's shards.

## CI

- Run 523 (9b6f8c98, E40 C1): red on suite shard 2/8 alone - tier 2 "E60-T14 - the dice look read by each browser of
  itself", a test this line did not touch; every other job green. E40-T1 shifts which shard each later tier-2 test is
  dealt to. Not reproduced: E60-T14 alone green (12.6 s), and shard 2/8 of that same commit run here
  (`DRPG_REPO` at 9b6f8c98, `DRPG_SUITE_SHARD=2/8`) green, 196 passed, 0 failed, 1 skipped (619 s). One local run of
  the shard, under other harness load: not proof that it is a flake, only that it did not fail again. Its message was
  in the run's artifact, which this container could not download (the storage host refused). Watched on the next push.

## Waits for / not built on this line yet

The plan's items 2-6, in its order, with what each would take:

- **checkState() in `game.drpg`** (item 2): built (C2, C3) with three invariants. The plan's list was cut in the text
  this line read ("the invariants (...)"); more rules join with the stage that states each. The handbooks do not name it
  yet (a console diagnostic; E57's last pass of the handbooks, or the owner's word).
- **The phase x action matrix** (item 3): built as a test (C4): the two readers held to each other. Not built: one
  shared "allowed now" predicate replacing the tile's and the press's chains (new production code; the matrix is what
  it would be held to), the trial floor's modes as a dimension (R1023 holds `modeAllows` to its three readers already),
  and `passage.*` and `action.frisk*` as columns (the A10/A11 amendments; their gates are the bridge's, not the tile's).
- **18-trial** (item 1): built (C5) on the trial's five steps. Not in it from the plan's list: two Blackened, duplicates
  on the card, a GM reload during the vote, a late player with ack, preselection and "Nobody", D4's offer applied once,
  a deceased before and after discovery, the Final Trial, a second trial (D17), a reset during a suicide incident, and
  season-wipe on a world copy; most are 63-class-trial's, 61's and 65's (63: a late player, a reload, the verdict's
  window with "Nobody", a second trial, the Level Ups), and the rest is open.
- **The regex tests** (item 4): **counted, not started.** The coordinator's word, 13.11.2026: the count below puts the
  work at 25-50 hours (each of up to 140 tests read, and each one converted broken once before and after), which the
  coordinator is putting to the owner; it does not start on this line until the owner answers. The plan's Q-E40-3
  default: re-counted when the work starts.
  The count, 13.11.2026 at 4f1ceb1d, by a script over scripts/tests-tier0.mjs that splits it at each entry's start
  (`^    \["`) and reads each body for three things: it reads source (`bodyOf(`, `fnSource(`, `lineAround(`, `src(`), it
  imports a module (`await import(`), it uses a regex (`.test(`, `.match(`, `matchAll(`). Of 404 entries: 189 read
  source; 149 read source and import nothing; 140 of those also hold a regex - the pool the plan's "about 50 tier 0 tests
  with a regex on behaviour" is in (the rest are text guards, which stay, and censuses of the code's shape). Which of the
  140 hold behaviour is a reading test by test, not done; names such as R18 ("using an item mid-incident costs a turn"),
  R25, R26, R29 and R30 read as behaviour, and most of those touch writes, so their call is a tier-2 test with a fixture,
  not a pure call in tier 0. Each is to be broken once before and after its replacement (the plan's risk).
- **settle() -> until()** (item 5): **under way**, the coordinator's word of 13.11.2026: the chat-card sites, about
  25 reviewed per batch, each batch gated (check, lint, the tests it touches by name, tiers 0-1 whole) and committed
  alone. The count, 13.11.2026: scripts/tests-tier2.mjs holds `await settle(` on 2509 lines; 185 of them are followed
  within three lines by a read of the chat (a card, its words, a whisper), 194 by a read of a hook or a notice. The
  estimate was about 5 h for the 185 and about 10 h for both groups. The pattern: the settle stays as the floor (it is
  the window in which a card that must not come would arrive) and an `await until(() => <the card the test reads>)`
  follows it, only where the test's assertion expects that card present. A site that expects no card, a clean-up, or a
  read inside a hook's own window keeps the settle alone. So no test gets shorter, and none can pass sooner on a card
  that has not arrived yet.
  - Batch 1: 12 sites (11 tests and the reshape helper `F.reshape`, which 15 tests call).
  - Batch 2: the next 25 sites in file order, read one by one: 6 expect a card and got the wait (5 tests that read a
    card or a refusal's words, and one that waits for the hook's ruling); 19 are clean-ups, hook windows or absences and
    were left alone.
  - Batch 3: the next 25: 11 expect a card and got the wait; 14 are a stage's `must`, absences (a refusal that posts
    nothing, an allowance that sends nothing), settles inside a window already awaited, or a read through an async
    helper (`until()` takes a synchronous check, so a promise would read as true at once). The timeout check caught
    three wrong first drafts: inside `withVerdictCarriedOut` the execution card is not posted yet (DC36: the sentence is
    carried out at the trial's exit), so a wait for it timed out every time; those three wait for the verdict card alone.
  - Batch 4: the next 25: 9 expect a card and got the wait (a misleading trail's line, the straw poll's Finding, the
    Eclipse's end sound, a reshape card, two statistic cards, a question's card, a thread card and its note); 16 are
    absences (a trap that must not speak), a card settled in place, a mixed loop where some rounds expect no card, a
    count whose expected value is not a card, or reads through a getter or a sent-words window.
  - Batch 5: the next 25: 6 expect a card and got the wait (a conversion's veiled card, a free Present's card, a
    refused Objection's whisper, the Overrule's card, a Final Trial's execution card, an item ruling's card); 19 keep the
    settle: setup before a call, reads after an `until` already there, a second whisper read where the first still counts
    as new (a wait would be true at once), a card whose words were there before the step, and audits' rows, not cards.
    The site finder was corrected in this batch: it had counted an inserted `await until(` line as a chat read, which
    added two settles above earlier sites to the list; the reviewed list was checked against the file after each batch.
  - Each new wait found its card: `until()` returns false at its deadline and fails nothing, so a wrong predicate would
    only make a test slower. Measured on a copy where every wait right after a settle throws on a timeout (47 such
    pairs in the file, batches 1 and 2 among them): the 33 tests holding batch 1's and 2's sites, 0 failed; batch 3's 11
    tests, 0 failed once the three verdict waits were corrected; batch 4's 8 tests, 0 failed; batch 5's 6 tests, 0 failed.
  - Left: the rest of the chat-card group (found again after each batch by a script over the file, not by stale line
    numbers), and the 194 hook and notice sites, not started.
- **The 12-rule mutation run** (item 6): run, 12 of 12 FAIL (the table above). Into the release gate: not done, its
  wiring is not this line's to touch.

## Questions for the owner

- Q-E40-1, Q-E40-2, Q-E40-3: defaults taken, owner to confirm.

## Tokens so far

Not measured by this session.
