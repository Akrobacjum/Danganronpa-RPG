# E40 - status (the work line of E39 and E40)

Updated 14.11.2026 (the line claude/e39-43-113; before it 13.11.2026). The plan is `docs/dev/plans/E40.md` on the planner's branch `plan-130` (read whole). Same branch as
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

- After the merges of slice B and origin/main (a2b233d2, 1.2.112), at 604715e6: `npm run quick` green (lint 357 files
  0 problems, check 20 parts, verify-gate 37/37); item 4's 29 tier-2 tests by name 0 failed; tiers 0-1 whole 1518 ran,
  1503 passed, 0 failed, 16 skipped, 0 red.
- Before the push of the hook group's sweep (13.11.2026): the overflow test by name, 0 failed; `node tools/check.mjs`
  19/19; lint 0 problems; tiers 0-1 whole 1419 ran, 1404 passed, 0 failed, 16 skipped, 0 red.
- Before the push of item 4's plan and pilot (13.11.2026): the new tier-2 test and R99 by name, 0 failed; the mutants
  m1-m3 and the clean tree, old R55 against the new test (ITEM4.md); `node tools/check.mjs` 19/19; lint 0 problems;
  tiers 0-1 whole 1419 ran, 1404 passed, 0 failed, 16 skipped, 0 red (R55 gone).
- Before the push of item 5 batch 8 (13.11.2026): its 4 tests by name, 0 failed; `node tools/check.mjs` 19/19; lint 0
  problems; tiers 0-1 whole 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red.
- Before the push of item 5 batch 7 (13.11.2026): its 5 tests by name, 0 failed; `node tools/check.mjs` 19/19; lint 0
  problems; tiers 0-1 whole 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red.
- Before the push of item 5 batch 6 (13.11.2026): its 7 tests by name, 0 failed; `node tools/check.mjs` 19/19; lint 0
  problems; tiers 0-1 whole 1420 ran, 1405 passed, 0 failed, 16 skipped, 0 red.
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
- **The phase x action matrix** (item 3): built as a test (C4): the two readers held to each other. The shared "allowed
  now" predicate: built on the line claude/e39-40-116 (its C4 below, scripts/allowed-now.mjs). Not built: the trial floor's modes as a dimension (R1023 holds `modeAllows` to its three readers already),
  and `passage.*` and `action.frisk*` as columns (the A10/A11 amendments; their gates are the bridge's, not the tile's).
- **18-trial** (item 1): built (C5) on the trial's five steps. Not in it from the plan's list: two Blackened, duplicates
  on the card, a GM reload during the vote, a late player with ack, preselection and "Nobody", D4's offer applied once,
  a deceased before and after discovery, the Final Trial, a second trial (D17), a reset during a suicide incident, and
  season-wipe on a world copy; most are 63-class-trial's, 61's and 65's (63: a late player, a reload, the verdict's
  window with "Nobody", a second trial, the Level Ups), and the rest is open. Since built in 18-trial, with the scans
  after each step: two Blackened (the line claude/e39-43-113), and on the line claude/e39-40-116 a second trial with
  "Nobody", the Final Trial, a late player with the ack and a GM's reload in the vote (its C1-C3 and C5). Still not in
  18-trial, and not built (the coordinator's word of 15.11.2026): duplicates on the card, preselection, D4's offer
  applied once, a deceased before and after discovery, season-wipe on a world copy. A reset during a suicide incident
  came in C6.
- **The regex tests** (item 4): **done, 13.11.2026, for 1.2.113.** The owner's word through the coordinator ("robimy
  teraz"). `docs/dev/e40/ITEM4.md` holds the list, the slices and the rule; the four slices ran on parallel lines and were
  merged here (A c6ba81e1, C 698c7dd9, D 119384e0, B 3d0a9856), each with its own file `docs/dev/e40/ITEM4-<slice>.md`
  (picks, mutant tables, gates). Of the 111, by the slices' own tables: (a) driven in place 8; (b) driven in tier 2,
  whole or with a remainder kept as a text guard, 29 (A 8, B 13, C 5 with the pilot's R55, D 3); (c) kept and marked as
  text guards 74 (A 19, B 14, C 21, D 20 with the pilot's R99). Deleted from tier 0 (registry rows "removed in E40"):
  R25, R55, R69, R87, R95; every other driven test was trimmed, its remainder marked. The tier-2 tests item 4 added, 29 by
  name, 0 failed after the merge of main. Exports that would turn a (c) into a call are listed in the slice files, for
  the owner (rule 2: none made). Slice A saw R3727 (E62's clock-timing test, like R3712) fail once in a whole tiers 0-1
  run and pass alone and in the next whole run; not seen on this line.
  The count, 13.11.2026 at 4f1ceb1d, by a script over scripts/tests-tier0.mjs that splits it at each entry's start
  (`^    \["`) and reads each body for three things: it reads source (`bodyOf(`, `fnSource(`, `lineAround(`, `src(`), it
  imports a module (`await import(`), it uses a regex (`.test(`, `.match(`, `matchAll(`). Of 404 entries: 189 read
  source; 149 read source and import nothing; 140 of those also hold a regex - the pool the plan's "about 50 tier 0 tests
  with a regex on behaviour" is in (the rest are text guards, which stay, and censuses of the code's shape). Which of the
  140 hold behaviour was read test by test in the slices (above); this count was the starting list, kept as it was.
- **settle() -> until()** (item 5): **done on this line, 13.11.2026** (the coordinator's word: stop after the hook group's
  sweep), begun on the coordinator's word of 13.11.2026: the chat-card sites, about
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
  - Batch 6: the next 25: 7 expect a card and got the wait (the "nobody" cancellation card, the trial exit's whisper, a
    verdict's card, Find Passage's two cards from a hook's list, a usable's receipt, a change's card to the GMs, a
    trap's receipt); 18 keep the settle: absences, counts whose expected value is 0, loops where some rounds expect no
    card, setup before a call, and reads after an `until` already there.
  - Batch 7: the next 25: 5 expect a card and got the wait (a Dynamic action's Reroll bookmark message, its item card,
    a Work's card, the motive withdrawn, the Survive card); 20 keep the settle: clean-ups, reads after an `until`
    already there, token moves, async helpers, and a helper that expects no card on one call and a card on another.
  - Batch 8, the last 17: 4 expect a card and got the wait (a Dynamic Reroll's bookmark message, a crisis action's
    card read in both languages, a stopped chapter end's "dropped" card, a room action's whisper); 13 keep the settle:
    cards expected at 0 after a window cancelled or closed, a receipt expected absent, clean-ups and token moves.
  - **The chat-card group is done** (13.11.2026): batch 1's 12 sites, then 167 reviewed one by one in batches 2-8;
    60 sites in all now wait for their card after the kept settle, and 119 keep the settle alone. After batch 8 the
    finder lists 118 sites, every one of them reviewed and left alone (the 119th dropped out of its three-line look-ahead
    once a wait was inserted below it, as recorded at batch 5).
  - Each new wait found its card: `until()` returns false at its deadline and fails nothing, so a wrong predicate would
    only make a test slower. Measured on a copy where every wait right after a settle throws on a timeout (47 such
    pairs in the file, batches 1 and 2 among them): the 33 tests holding batch 1's and 2's sites, 0 failed; batch 3's 11
    tests, 0 failed once the three verdict waits were corrected; batch 4's 8 tests, 0 failed; batch 5's 6 tests, 0 failed; batch 6's 7 tests, 0 failed; batch 7's 5 tests, 0 failed; batch 8's 4 tests, 0 failed.
  - **The hook and notice group: measured whole, one site converted** (13.11.2026). The finder for it (a settle whose
    next three lines read `warned`, `told`, `notices`, `heard`, `fired`, `packets`, `replies` and the like, no chat
    read, none within 8 lines of an item-4 slice line) lists 178 sites. Their values mostly come from a `send` callback
    inside an awaited `judge`, a `ui.notifications.warn` override or a socket emit caught in the same call, filled
    before the awaited call returns. Measured on a copy with the settle removed at every site, in four sets, one run
    each: 25 sites (23 tests), 25 (19), 64 (47) and 64 (38); two tests failed, each passing on the clean tree:
    - "a GM clears the overflow from Despair Flow's Overflow tab ..." at the settle after `clearOverflowAsGm()`: the
      packet to the other GM is queued after the call returns, and the test drains `queued` next. Converted: the settle
      kept and `await until(() => queued.length > 0)` after it; with only that settle removed the test fails, with
      the until in its place it passes, and its other two sites removed with the until in place it passes.
    - "a veiled card lights the Chat tab only where its words are" at the settle before the notifier's recorder goes in:
      it lets the chat log's own notifier calls for the two cards just posted finish, so the recorder does not count
      them (without it the card is counted twice). A drain before a measurement, nothing an until() can wait for: kept.
    So 176 of the 178 settles are not what their read waits on here, and none of them is converted (an until() would
    be true at once). Not measured: a slower machine (CI's), and each site alone (the sets were removed together).
- **The 12-rule mutation run** (item 6): run, 12 of 12 FAIL (the table above). Into the release gate: not done, its
  wiring is not this line's to touch.

## The line claude/e39-43-113 (14.11.2026, base 1463f22b, R block R6200-R6299)

| Commit | What | Where |
| --- | --- | --- |
| dce86743 | **18-trial with two Blackened**: a second public death, Daichi's, in the register beside Chie's; the vote asks each ballot for two names (`picks` 2; a ballot of one is refused `wrongCount`, measured), each player casts Botan and Aiko, both accused, sentenced by the wrong verdict naming both Blackened and executed at the close; the world and chat scans after every step look for both Blackened's ids and names | audit/harness/scenarios/18-trial.mjs |
| c94e3d6e | **checkState after a season's reset**: 72's season end (E43's season walk on this line) asks `game.drpg.checkState({ quiet: true })` on the GM at once after `resetSeason` with every group ticked: ok, no problem. This is the plan's "season-wipe on a copy" as far as the harness's world goes - its seeded world, not a played one | audit/harness/scenarios/72-canary.mjs |

| Mutant | Check | Verdict |
| --- | --- | --- |
| verdict.mjs `postVerdictCard`: the public card's flags carrying the register's Blackened past the first (`trialBlackenedIds().slice(1)`) | 18-trial | KILLED: world and chat [verdict], world [close] read ACTORDAICHI00000 on p1 and p2 |

checkState's invariants: none added on this line. The three it holds are the ones a stage states (world-secrets.mjs's
rules, the A10/A11 key filter, the clock's phase and counters); no other rule read on this line is both stated and
readable off world data alone (the Mask's, the register's and the trial's are GM stores, which `stateProblems` does not
read by design).

## The line claude/e39-40-116 (15.11.2026, base e9f4a791, 1.2.115)

Baseline at e9f4a791: `npm run quick` green; tiers 0-1 whole 1742 ran, 1727 passed, 0 failed, 16 skipped, 0 red
(486 s); 18-trial alone 26/26 checks, about 10 s inside the cluster.

| Commit | What | Where |
| --- | --- | --- |
| C1 (36090364) | **18-trial, a second trial with "Nobody"**: after the first trial's close, in the same chapter, Botan and Aiko put back by the GM (a fixture step), the trial ended and started again (Daily Life between; the first verdict's lock and its execution's stamp cleared), a new vote of a later round with none of the first trial's ballots counted at its open, cast and counted on Botan and Aiko, and the verdict the window sends for "Nobody is executed" (verdict.mjs `read`: `executedIds: []`), wrong, naming both Blackened: nobody sentenced, the public card says "Nobody is executed" and its cut-in names nobody, and the trial's close executes nobody. The scans after each of the five new steps. 26 checks to 51; 18-trial alone about 10 s to about 19 s inside the cluster, 23.9 s by `run-all.mjs scenarios --only 18-trial` | audit/harness/scenarios/18-trial.mjs |
| C2 | **18-trial, the Final Trial**: after the second trial, a student nobody plays made the Mastermind (mastermind.mjs `setMastermind`), the Final Trial's flag up, the trial ended and started again: the GM's pick read on the GM and none on p1; the wrong Final verdict on Botan: the record final and done, no sentence waiting, one public card, the flag down (`finalVerdictClose`), Botan and the Mastermind alive; the close executes nobody. The scans after each step look for the Mastermind's id and name too. 51 checks to 66, about 24 s inside the cluster | audit/harness/scenarios/18-trial.mjs |
| C3 | **18-trial, a late player with the ack**: a student "S18 Late" owned by p4 (an account declared `late: true`, as 63 declares it), made before the second trial; the second vote opens with three ballots, p1 casts, then p4 connects, heard before its world has loaded, asks the primary at load and is handed a fourth (the record's `issued` four; the harness's default press dismisses the window, warned once), asks again (`askForBallot`), casts Botan and Aiko in the window and is told once that its vote is in; p2 and p3 cast after: four in. Scans after each step. 66 checks to 76, about 27 s inside the cluster. The GM's reload in the vote was held back here, and came in C5 | audit/harness/scenarios/18-trial.mjs |
| C4 | **The shared "allowed now" predicate** (item 3; scope the coordinator's of 15.11.2026: the ACTIONS keys, the A11 person roads and the A10 passage roads): scripts/allowed-now.mjs `allowedNow(actor, key, { road, facts }) -> { ok, why, road }`, one rule table a road a row (`action`, `person`, `transfer`, `passageShare`, `passageFind`), each in the order its road asked before, each fact read live unless handed in. Moved onto it: the tile (sheet-actions.mjs `actionButton`), the press (action-rolls.mjs `performAction`, every gate in its place, the fight read once at the top as before), frisk.mjs `personActionRefusal` (a Frisk, a steal, a Plant, a give, a tail, a loot), inventory.mjs `transferRefusal`'s last lines (the rifle), passages-gm.mjs `liveShareWorld` and `liveFindWorld`. Every caller says each `why` in the words it said before. Tests: E40-T3 extended (each cell the rule's reading too, and each state's row held to the answers of d2c6e0e5, measured there with the rule stubbed; Move's press alone); new tier 2 **E40-T4** (the rifle, a passage's show and its search on the live world in daily life, an Eclipse and the trial - the suite's other passage tests hand in a world of their own, so the live readers were read by nothing). Red on d2c6e0e5 with the new tests: both threw at the import of allowed-now.mjs. Three tier-0 text guards changed with the move: R42 reads the trial gate as `now.why === WHY.trial` and the rule's order in allowed-now.mjs, R164 is kept by the person road returning its sentences as literals, R553 by naming the passage roads in camelCase | scripts/allowed-now.mjs (new), action-rolls.mjs, sheet-actions.mjs, frisk.mjs, inventory.mjs, passages-gm.mjs, tests-tier0.mjs (R42), tests-tier2.mjs (E40-T3, E40-T4) |
| C5 | **18-trial, the GM's reload in the vote, and the world-secrets rule's exemption**: world-secrets.mjs `WORLD_SECRET_RULES.uniformActorRows` (diceLookWorld: maps `e` and `t`, `e` alike, `t` stamps) and `findWorldSecrets` reading it (the finding above); tier 1 **R7560** on both directions (rows for every actor read clean, the watched one's own stamp too; a row for the watched actor alone, one actor without a row, a watched row unlike the others, a stamp that is not a number, the watched id in a value, the same rows in a setting the rule does not name, all found; every setting of the rule has a case). Red on dd195457: the uniform rows found, 2 hits where 0 are wanted. Then the reload case in 18-trial's second vote: after p1's ballot the GM's browser reloads (the cluster's `reload("gm")`, the seeded GM off the table and back with its storage, as F5 - used instead of a late `gm2`, the coordinator's word of 15.11.2026) and counts p1's ballot from the GMs' store; scans after it. The fixtures' ids are kept on the scenario's side (the reload clears the GM's page), and the Mastermind's actor made with them. 76 checks to 81, about 30-36 s inside the cluster | scripts/world-secrets.mjs, tests-tier1.mjs (R7560), audit/harness/scenarios/18-trial.mjs, docs/dev/R-REGISTRY.md |
| C6 | **18-trial, a reset during a suicide incident** (the brief's last case; the coordinator's word of 15.11.2026): after the Final Trial's close, the trial ended and Chie's murder of herself opened as 65 D opens it - her opening succeeds and the incident stands at Stage 6, nobody dead - with the players' sockets open (65 holds them); then a season reset of the incident group alone (`resetSeason`, answered as 65 answers it): the incident gone, Chie alive for the GMs and the table, nothing failed. The scans after both steps look for Chie (who took her own life is the incident's: the world's record holds `active` and `stage` alone). 81 checks to 91, about 38 s inside the cluster | audit/harness/scenarios/18-trial.mjs |
| C7 | **A card that is gone ends nothing** (the coordinator's Q5 (b) of 16.11.2026). An ORDER-AND-TIMING DEPENDENCE THAT EXISTED ON MAIN: an ask card's expiry (call-gm.mjs `endAtExpiry`, about five minutes) outlived the tier-2 test that made it, whose restore deleted the card, and when it fired `endExpired` asked `underClaim`, which read the GMs' `ruledCards`, inside whatever test ran then - E60-T14's window in this line's dealing (shard 5 red at df2e7312, 2 runs of 2; the probe above), and the likely reading of CI run 523's unexplained E60-T14. call-gm.mjs `cardGone`: `endExpired` returns before `underClaim`, and `endSentOn` after `forgetCallYes` (a yes not used is still taken back - bridge-guards.mjs's memory, no store) and before `rolledOnRuling` (the GMs' `rolls`). Every road into the end: the expiry timer (`expireAskCard`), the end after a claim (`expiryAfterClaim`), the asker's expiry (`expiredOnPrimary`), the receipt that never came (`unreceivedOnPrimary` through `endSentOn`); the Observe and statistic cards end by the same `endExpired` (read on the probe: their expiries took `underClaim` too), so no other guard is needed. New tier 2 **E40-T5**: a held Call's ask, a Call's yes sent on and a Dynamic ruling sent on, each card deleted, then its asker's expiry: no GM store read or written, no card made or changed, no packet. Red at 1489b46c: held and yes `ruledCards.get`, the Dynamic one `rolls.entries` and `ruledCards.get`; green after. E60-T14's assertions unchanged; no runner machinery | scripts/call-gm.mjs, tests-tier2.mjs (E40-T5) |

| Mutant | Check | Verdict |
| --- | --- | --- |
| trial-progress.mjs `TRIAL_RECORD.executedAt`: a trial's entry keeps the stamp (`atEntry: now => now.executedAt`) | 18-trial [second trial] | KILLED |
| `TRIAL_RECORD.verdictApplied`: a trial's entry keeps the lock | 18-trial [second trial], [nobody] (the verdict refused) | KILLED |
| `TRIAL_RECORD.vote`: a trial's entry starts the round at 0 | 18-trial [second ballots]: the first trial's three ballots counted at the open | KILLED |
| `sentenceOf`: an empty sentence falls back to the record's `accusedIds` | 18-trial [second close]: Botan and Aiko executed | KILLED |
| verdict.mjs `postVerdictCard`: the "Nobody is executed" line dropped | 18-trial [nobody] | KILLED |
| verdict.mjs `finalVerdictCard`: the card's flags carrying the Mastermind's id | 18-trial world and chat [final verdict], world [final close] | KILLED |
| `giveFinalVerdict`: the world's record carrying `mastermindId` | 18-trial world [final verdict], [final close] | KILLED |
| `giveFinalVerdict`: `executed` read as `!dead`, whatever the verdict | 18-trial [final verdict], [final close] (the Mastermind executed), and their scans | KILLED |
| `finalVerdictClose`: the Final Trial's flag left up | 18-trial [final verdict] | KILLED |
| vote.mjs, the primary's answer to a ballot asked for: a late ask not added to the record's `issued` | 18-trial [late player] (issued 3); p4's ballot was still counted, as `ballotBase` counts the union of `issued`, the participants and those who answered | KILLED |
| vote.mjs `sendBallot`: the "your vote is in" notice dropped | 18-trial [late player] (ack 0) | KILLED |

C4's mutants (each on a copy of the tree, the named tests by name on it), 18 of 18 KILLED:

| Mutant | Check | Verdict |
| --- | --- | --- |
| allowed-now.mjs `action`: Analyze shut in the trial | E40-T3 | KILLED |
| `action`: Move shut in an Eclipse | E40-T3 (Move's press) | KILLED |
| `action`: the fight not asked | E40-T3 | KILLED |
| `action`: Direct Murder open outside an Eclipse | E40-T3 | KILLED |
| `action`: the trial asked before the fight | R42 | KILLED |
| `action`: the trial's exemption named for another key than Analyze | R42 | KILLED |
| `person`: the trial not asked | A11-9 | KILLED |
| `person`: the incident not asked | A11-9 | KILLED |
| `transfer`: the Eclipse not asked | E40-T4 | KILLED |
| `passageShare`: the trial not asked | E40-T4 | KILLED |
| `passageFind`: always open | E40-T4 | KILLED |
| the tile's sentences of the trial and the Eclipse swapped | E40-T3 | KILLED |
| the press's trial gate off | E40-T3 | KILLED |
| the tile's lock not read from the rule | E40-T3 | KILLED |
| frisk.mjs: the incident's return dropped | A11-9 | KILLED |
| passages-gm.mjs `liveShareWorld`'s lock always open | E40-T4 | KILLED |
| `liveFindWorld`'s trial always false | E40-T4 | KILLED |
| inventory.mjs: the rifle's phase lines dropped | E40-T4 | KILLED |

A first run of the same set, before R164's literals, had one SURVIVED: the person road's Eclipse sentence turned to
"that cannot be done now". Both sentences are told to the player as the one code `cannotNow` (bridge-guards.mjs
`REASON_PATTERNS`), so only the GM's log line differs; A11-9 reads the code, as the player is told it. Not changed.

What can differ, read in the code and not run: the tile now says the press's lock in the press's order. The two
orders differ only where an Eclipse stands with a fight or the trial, which the module does not reach (an Eclipse is
refused in a fight and in a trial, `startRefusalOf`; a fight in an Eclipse, `openMurder`, E40-T3; a trial in an
Eclipse, `startClassTrial`): there a console's raw write would see the tile say the press's sentence. For Direct
Murder the press reads the Eclipse once, before the betrayal's awaited import, where it read it twice.

Not moved (the coordinator's scope; each a phase gate of its own road, named here so the next reader sees the edge):
calls.mjs:67, :104, :420 (the Calls); sheet-actions.mjs:546, :632-633 (the Calls panel and its lock note),
moveDragSaid at :437, the betrayal tile at :1521; monocub.mjs:705 (the Monocub's abilities); handover.mjs:48;
sheet-inventory.mjs:891 (the handover button in a trial); bridge-guards.mjs:704 (a statistic proposal's gate). A count
for scale, `git grep` of `isEclipse()`, `inClassTrial()` and `phase === "classTrial"` in scripts/ outside the tests and
allowed-now.mjs: 159 reads, most of them not a lock of an action.

Gates of C4: `npm run quick` green (24 check parts); tiers 0-1 whole 1742 ran, 1727 passed, 0 failed, 16 skipped, 0
red (472 s); the 38 tier-2 tests that name a changed symbol or one of the four lock sentences, by name, 38 ran, 42
passed, 0 failed (182 s); E40-T3, E40-T4 and A11-9 green alone. No scenario edited.

C5's mutants:

| Mutant | Check | Verdict |
| --- | --- | --- |
| gm-store.mjs, the engine's storage read answering nothing for `gmBallots` | 18-trial [gm reload] (0 in), [late player], [second ballots in] | KILLED |
| the same, `worldOf`'s read alone | 18-trial | SURVIVED - the store's flush reads the storage too and merges it before its first write, so one road alone loses nothing; the mutant above cuts both |
| world-secrets.mjs `uniformKeys`: no condition, every key of the maps let stand | R7560 | KILLED |
| `uniformKeys`: the `alike` check off | R7560 | KILLED |
| `uniformKeys`: the stamps' number check off | R7560 | KILLED |
| `uniformKeys`: never applies | 18-trial, run in the copy's own harness: nine scans from [gm reload] on | KILLED |
| `uniformKeys`: the check that every actor has a key off | R7560 | SURVIVED - equivalent: a missing row reads as undefined, which the `alike` and stamp checks refuse, for each map the rule names is one or the other; kept as the rule's own statement |
| a control: a comment changed in world-secrets.mjs, the copy's own harness | 18-trial | SURVIVED, as it must: the own-harness run passes on an inert change |

Gates of C5: `npm run quick` green but for the registry part, which read the tree before R7560's row was written
(`registry.mjs --write`, then `node tools/check.mjs` whole: 24 parts green); tiers 0-1 whole 1743 ran, 1728 passed, 0
failed, 16 skipped, 0 red (464 s); R7560, R190, R9 and R5100 by name green; 18-trial (33.7 s) and 72-canary (53.5 s,
the other heavy reader of the world scan) by `run-all.mjs scenarios --only` green.

Renumbered (15.11.2026, the coordinator's word): the test was R7405 when it was written, the number
`registry.mjs --next` gave; three other lines took R7405 too, and this line's block is R7560-R7579, so it is R7560. The
registry's "R7405 (removed in E39)" row the tool kept was taken out by hand: the number never reached main from this
line, and it is the other lines'.

C6's mutants: incident-store.mjs, the world half of the incident's record carrying the cast's `killerId` - KILLED by
18-trial world [suicide] (`murderState.killerId`, a field the rule's `only` refuses); the season's incident group
clearing nothing - KILLED by 18-trial [reset in the suicide] (the incident still active).
Gates of C6: `npm run quick` green (24 parts); tiers 0-1 whole 1743 ran, 1728 passed, 0 failed, 16 skipped, 0 red
(488 s); 18-trial by `run-all.mjs scenarios --only 18-trial` green (39.7 s). No module code changed.

The full tier 2 in shards, at df2e7312 (16.11.2026): 8 shards here, `suite-merge.mjs` RED - 1554 tier-2 tests,
3294 passed, 1 failed, 27 skipped, 0 red. The one: E60-T14 in shard 5 (2 runs of 2), `playerReads` ["ruledCards.get"]
where [] is wanted. On origin/main's tree shard 5 is green (225 passed) and E60-T14 is dealt elsewhere. Measured with a
probe in a copy: an ask card a test before it made (the test "an ask its player stopped waiting for ends its card
once"), deleted by tier 2's restore, keeps its expiry timer (call-gm.mjs `endExpired`), which fires about 308 s later
inside E60-T14's window and reads the GMs' `ruledCards` there; E60-T14 counts every GM store read on the browser. An
order dependence between tier-2 tests that main has too; this line's E40-T4 moved E60-T14 into its reach. Asked of the
coordinator (three fixes named, none built): until it is decided, CI's shard 5 would be red on this branch.

C7's mutants: `endExpired`'s guard off - KILLED by E40-T5 (held, yes); `endSentOn`'s guard off - KILLED by E40-T5 (the
Dynamic ruling's `rolls.entries`).
Gates of C7: `npm run quick` green (24 parts); tiers 0-1 whole 1743 ran, 1728 passed, 0 failed, 16 skipped, 0 red
(469 s); the 17 tier-2 tests that drive an ask's expiry, receipt or ruling, by name, 21 passed, 0 failed; E60-T14 alone
green.

The full tier 2 in shards at dc159200 (16.11.2026): `suite-merge.mjs` RED - 1555 tier-2 tests, 3295 passed, 1 failed,
27 skipped, 0 red. E60-T14 green in its shard now. The one failure: A113-C5-7-T1 ("Take from the Body opens an action
window") in shard 4, the window's two rows in the other order. Not this line's: the test sorts the rows it reads by item
id with `localeCompare` and the order it expects with `Object.keys(...).sort()` (code units); the ids are random, and the
two sorts disagree on about 17.8% of random pairs (200 000 pairs of 16-character ids, measured here). Alone: 1 failure in
4 runs on dc159200, 0 in 4 on e9f4a791 (by chance at that rate, about 32%). Reported to the coordinator; not changed.

A HARNESS TRAP, for whoever runs mutants next: lib/canary.mjs imports scripts/world-secrets.mjs from the checkout the harness sits in, not from
`DRPG_REPO`, so a mutant of world-secrets.mjs read through a scenario's scans has to run in the copy's own harness; the
first run of "never applies" through `DRPG_REPO` read the unchanged rule and passed (void, not a survival).

A reading of C2, the harness's: the Final verdict's Level Up window, drawn on the GM and pressed by the harness's default
answer, threw in its callback (level-up.mjs `readFormData`: the shim has no `FormDataExtended`, and Node's own `FormData`
cannot read a jsdom form). Foundry has `FormDataExtended`, so this is not the module's road at a table; not changed in
the shim (the brief: no shim change that guesses v14). The step answers every window null, as the ordinary verdict's
step does.

Gates of C1: `npm run quick` green; tiers 0-1 whole 1742 ran, 1727 passed, 0 failed, 16 skipped, 0 red (483 s); 18-trial
by `run-all.mjs scenarios --only 18-trial` green. No tier-2 test changed, so none was run by name. No case was red on
main.

Gates of C2: `npm run quick` green; tiers 0-1 whole 1742 ran, 1727 passed, 0 failed, 16 skipped, 0 red (479 s);
18-trial by `run-all.mjs scenarios --only 18-trial` green (27.6 s). No tier-2 test changed. No case was red on main.

Gates of C3: `npm run quick` green; tiers 0-1 whole 1742 ran, 1727 passed, 0 failed, 16 skipped, 0 red (466 s);
18-trial by `run-all.mjs scenarios --only 18-trial` green (31 s). No tier-2 test changed.

**Finding: red on main e9f4a791, not a leak, harness rule widened** (15.11.2026; the coordinator's decision (a) of that
day). Once the primary GM has loaded again in a trial, the world setting `diceLookWorld` - dice-sync.mjs's world copy
of the Dice So Nice overlays (its header, "THE WORLD'S COPY") - holds a row for every actor of the world under `e` and
its stamp under `t`. Read on p1 after `reload("gm")`: every actor alike, `{ look: null, roles: null }`, Chie's and
Daichi's stamps those of every seeded actor (0.5); in three more runs 10 rows in each map for the 10 actors, at once
after the reload. On the seed world alone the copy is `{}` before and after a reload. world-secrets.mjs
`findWorldSecrets` flagged any module world setting holding a watched actor id as a key, so 18-trial's scans after the
reload failed on main. Read as no leak: it names every actor alike. The rule (C5 below): a declared exemption,
`uniformActorRows.diceLookWorld`, that lets the ids stand as keys of `e` and `t` only while, on every scan, each actor
of the snapshot has a key in both, every `e` row is the same and every `t` stamp is a number; a watched id in a value
or anywhere else in the setting is still found. Only the harness's id scans ask it (state-check.mjs reads the rule
without ids). A stamp's value is not held, only its shape: an actor made since the seed has a stamp of its own (its
time), measured when 18-trial first made its Mastermind after the reload - the copy then had no row for it, the
exemption stopped and the scans failed, as the rule says; the Mastermind's actor is made with the other fixtures now.

## Needs a local Foundry

- **LIVE-E40-01** (audit/AUDIT-1.2.42.md 9.2 item 537, written on this line; 532 on its branch, renumbered in the 1.2.113 assembly): `checkState()` at a real primary GM's
  start, on a copy of a v14 world played through at least a chapter - warnings only, each true.
- **Season-wipe on a real world copy**: `resetSeason` with every group on a copy of a played v14 world (scenes with walls
  and Levels, real chat history in the hundreds, Daggerheart's own Countdowns), then `checkState()` and the whole-world
  diff (the local gate's) around it. The harness runs it on its seeded world only (65 D, 72 season end).
- **18-trial's local layer**: the same five steps with the ballot windows drawn and pressed on real browsers, and the
  verdict's cut-in seen on each screen.

## Questions for the owner

- Q-E40-1, Q-E40-2, Q-E40-3: defaults taken, owner to confirm.

## Tokens so far

Not measured by this session.
