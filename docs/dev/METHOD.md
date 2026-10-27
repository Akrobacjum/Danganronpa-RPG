# The method: how a stage is built and shipped

Written 27.10.2026 at 1.2.89 (1a1bf1ff), as the method has been practised since INFRA (18.10) and its revision of
25.10 with two amendments of 26.10. Until this file it lived only in working notes outside the repository; those notes
(the stage specs, the quick runs' logs, the mutants' definitions, the ledgers, the orchestrator's log) still live there,
and every number below names the run or the commit it came from. The roles are the implementer (one commit of a spec
at a time), the reviewer (one lens of the end review, or the skeptic of the release notes), the fixer (one group of a
fix round) and the orchestrator (opens a stage, launches the others, pushes, reads CI, releases).

Not repeated here: the commands and the suite's four numbers (`CLAUDE.md`), the test author contract and the R numbers
(`.claude/rules/tests.md`, `docs/dev/R-REGISTRY.md`), the scenarios and what the harness cannot do
(`audit/harness/README.md`), the local gate (`audit/gate/README.md`), the release steps (`.claude/rules/release.md`).

## 1. The stage spec

A stage starts as a spec against a named base commit: the goal, the owner's words, the stage's rules, an acceptance
table (`id | promise | how it is checked | commit`, one row a promise, E88's has fourteen), the commits C0..Cn each with
the rows it closes and the tests and scenarios it runs, what only a table can measure, what is out of scope, and the
owner's open questions, each with a default the stage runs on. Files and symbols, never line numbers. The stage's row in
`tools/stages.json` names its planned version and what it `touches` (sockets, rolls, scenes); that decides whether the
local gate is required and whether the end review has a security lens. A commit on a road a player's packet reaches (the
trust model, `.claude/rules/trust-model.md`: a packet field is a claim) is marked in the spec with its mutants.

## 2. Red first

Each promise's test (an R number from `node tools/registry.mjs --next`) is written before the code and run on the tree
without the change. It must fail, and for the reason the promise names; the commit message quotes that reading and the
green one after. Over eight stages read on 25.10 (84 commits), 74 recorded a red-first test, and the red reading
exposed a spec in the wrong order, a change already at HEAD, a "by design" that was not, and three review claims that
were wrong. A commit with nothing to be red (a book, a comment) says so.

## 3. The quick gate, on every commit

Before each commit the implementer or fixer runs, from `audit/harness`, every step below even after a red one, and
pastes the summary line, `QUICK GREEN|RED at <sha>[+edits]: lint/check/gate ok; prose ok; t01 ok; own(N) ok; ...`,
into the message. One harness at a time on a machine (tier-2 timing reads flake under load on 4 cores).

| Step | Command | When |
| --- | --- | --- |
| lint, check, gate | `node run-all.mjs lint check gate` (every check part) | always |
| prose | `node tools/config-prose.mjs --check lang/pl.json` at the root, "missing 0, extra 0" | always |
| tiers 0-1 | `node run-tests.mjs --tier 1` (230-244 s on 18.10) | always, but a fix group's that is not the last |
| own tier 2 | `node run-tests.mjs --tier 2 --only <name> ...` | the commit's own tests, and the related ones below |
| scenarios | `node run-all.mjs scenarios --only NN` | a scenario the commit edits, and the older ones below; at most two, the rest left to CI |
| the curtain | `node audit/glass-sweep.mjs` | a change to `audit/glass-harness.html`, `audit/glass-sweep.mjs`, `scripts/glass.mjs` or `styles/narrow.css` |

Related tier-2 tests: those whose source names a function, store, setting or bridge row the commit changed (`git grep`
of the changed symbols in `scripts/tests-tier2.mjs`, about fifteen at most, named in the message). Older scenarios: those
`git grep` finds naming a rule, a message or a bridge code the commit changed. A second run at the same HEAD keeps the
steps the first had green and runs the rest. Every implementer and fixer ends with `git status --porcelain` empty.

What it cost and found (25.10, eight stages): about 20% of the work's tokens and 17.2 h; 22 red runs: 10 real defects
in new code (all through lint, check or tiers 0-1), 7 bookkeeping, 4 older tests changed on purpose, 1 wrong new test,
none flaky. With every scenario a commit named it took 17-19 min a run (18.10, E80 C1-C3), hence the cap of two.

## 4. Mutants

A mutant is one deliberate small break of the code a commit wrote - a guard dropped, a comparison turned, a check
skipped - applied to a copy of the tree, never the tree. The check named for it then runs on the copy: KILLED when it
fails the way it was written to (its runner's failure line), SURVIVED when it passes (the check does not measure that
line: a gap to close with a test, or to name in the ledger), ERRORED when the run crashes or the break does not apply
exactly once. The form, a script kept outside the repository: a definitions file `M = { name: (path, old, new) }`,
each `old` text found exactly once, and a kind - `own` (tier-2 tests by name), `t01`, `scen NN` or a command - with
the line a kill must print. Run for marked commits and for fix-round code on the same roads, the spec's list and no
more. Over eight stages: about 152 distinct mutants, 14 survived, 10 of them real gaps, about 5 found by nothing else.

## 5. The end review, through lenses

When the stage's commits are in, reviewers read the whole diff against the spec, one lens each: correctness and goal
always; security when the stage `touches` sockets or the spec has a write-roads table (otherwise the trust checklist
folds into correctness). A finding needs a concrete failing case - the input, the road, what the code does and what
the promise says - and a severity; a reading without one is a question, not a finding. Over eight stages, 117 findings
were 74 distinct issues; correctness found the most alone (20), goal the most per cost (19 alone, a third of them tests
and books), security 5 alone with one major race.

## 6. The fix round

The findings go to fixers in few, large groups (G1, G2, ...), each one commit with a red-first test where code changes
and its own quick (tiers 0-1 left to the last group). A finding can be rejected with evidence or closed as a measured
wontfix; both are written in the ledger, never dropped.

## 7. The ledger

At the close every acceptance row gets a status, the commit and test that answer it, and its limits:

- **ANSWERED** - a named test or check answers the promise as written; the limits are in the row.
- **OPEN** - not met as written, or waiting on the owner (E88-13, these two rows of `CLAUDE.md`, was one until this
  commit).
- **LIVE** - only a real table answers it: it becomes an item of `audit/AUDIT-1.2.42.md` section 9.2 with a
  `LIVE-E<stage>-<n>` id, which `node tools/check.mjs live` holds to every citation.

## 8. CI on every push

`.github/workflows/ci.yml` runs on every push to `main` or a `claude/**` branch: `plan` deals the ci scenarios into
buckets by weight; `quick` runs `run-all.mjs lint check gate`; `scenarios` one job a bucket; `suite` eight shards
(`DRPG_SUITE_SHARD=i/8`, tiers 0-1 and 01-runtests' parts A and B in shard 1); `verdict` merges the shards with
`audit/harness/suite-merge.mjs` (the whole suite once, the skips exactly the baseline's) and wants every job green.
671-974 s from the push to the last job's end on its first four runs (18.10). It is where the scenarios run; on 26.10
its scenario 72 found a real leak no local step ran (`e0bc676c`: the take-back snapshot, keyed by actor id, sat in the
public clock setting every player's browser holds).

## 9. Per release (a train of stages)

1. **The CRLF dispatch** - the CI workflow dispatched with `crlf` ticked: `npm test` whole, in one job, on a checkout
   with Windows line ends, as a Windows GM's copy reads. It is the only run of tier 2 after 01-runtests' parts A and B,
   in one order, in one process; the shards never run that way. Since 25.10 it is owed by a train that changes a test
   reading source text (the tier 0-1 readers, `tools/check.mjs`, `tools/`) and before 1.3.0, and otherwise the notes
   say why it did not run; every train from 1.2.84 to 1.2.89 owed it and ran it, 5572-6147 s from 1.2.86 on. Its first
   run (20.10) failed ten tests that read source text through markers a CRLF breaks; on 26.10 it alone found E16-T24's
   order dependence; on 27.10 it failed on the clock-bus race the push run had found (Lessons, below).
2. **Release notes** (`.github/release-notes/vX.Y.Z.md`): every sentence has a source (a commit, a test, a ledger row,
   a file at a line), listed beside the draft. A fresh reviewer, the skeptic, reads each claim against its source and
   marks it HOLDS or CORRECTED, and the notes ship only on "SKEPTIC OK". It corrected 7 of 59 claims at 1.2.84, 3 at
   1.2.86, 7 at 1.2.87 and 8 at 1.2.89 (one: the notes said `fps()` writes nothing; by default it whispers its report).
3. **The bump and the release checks**: `.claude/rules/release.md` steps 1-3, then `node tools/check.mjs stamps notes
   --release vX.Y.Z` and `node tools/stages.mjs check --release vX.Y.Z` (they need the earlier `v*` tags), with lint,
   check and gate again, on the release commit.
4. **The local gate** (`npm run gate:local`, `audit/gate/README.md`), its record committed alone on top. This is the
   method's debt: no Foundry v14 sandbox exists here, so every record of `audit/gate/local-gate.json` read on 27.10 -
   the 23 commits of it on this line and the tags v1.2.61 to v1.2.88 - holds every part not-run; 1.2.89's says
   "connect ECONNREFUSED 127.0.0.1:30099". Record mode lets that through with the notes' "- Not checked in a real
   Foundry" line, as debt; 1.3.0 is refused without a passed gate.
5. **The PR and release.yml**: push, CI green on the release commit and the gate record, a PR to `main` merged on green,
   then Actions ▸ Release dispatched on `main` with the tag (`release.md` steps 7-8), which calls `ci.yml` on the same
   commit and verifies the gate record before it builds.

## 10. What no harness can see

`audit/AUDIT-1.2.42.md` section 9.2 is the list of checks only a real table settles (items up to 330 at 1.2.89, LIVE-E88-08
the last). A stage adds its LIVE rows there before its train ships; the release notes name the ones the train adds.

## Lessons that changed the method

| When | What went wrong | The measured cause | What changed |
| --- | --- | --- | --- |
| 20.10 | The first CRLF run, red | ten tier-0/1 tests cut source by markers (`bodyOf` with `' } '`, the handbook and CSS readers) that Windows line ends break | those readers fixed; the CRLF dispatch made a step of a train |
| 25.10 | 7 of the 12 majors and blockers of eight end reviews | one cause: a commit group left uncommitted by an agent that ran out | every implementer and fixer ends with `git status --porcelain` empty; the next one commits what it finds, and says so |
| 25.10 | Local scenario steps | 0 regressions caught over eight stages, at 17-19 min a gate | scenarios left to CI, then the two rows below brought back the ones that matter |
| 25-26.10 | CI red on older tier-2 tests two trains running | intended changes: 1.2.85 a store the backup test had no fixture for; 1.2.86 the cleanup-DC test against the owner's Q7 (each row gets its `dc`, `81f59e48`), E14-T10 against E16 fix G2 (two answers) - quick ran the commit's own tier-2 tests only | related tier-2 tests in `--own`. It came back once, at 1.2.88 (`d5e233b1`: a Projects tray test leaning on H84-04's new rule): a grep by names finds the tests that name what changed, not every test that leans on it |
| 26.10 | CI red on scenario 66 I1-I4, P2 at 204a5d72 | E12's checks read "stands unlawfully where it jumped"; E17 C1 puts the jump back (`3efafbd0`) | older scenarios that name a changed rule, message or bridge code run in quick, two at most |
| 26.10 | E16-T24 red in the CRLF run, green in every shard | 01's parts A and B refill the students to the rules' 2/2; T24 wrote the seed's 3 actions, and a refund stops at the maximum, so it read 0 given back (`0b8dd4aa`) | a fixture sets what it reads (T24 fills the student's own maximum); only the CRLF run puts tier 2 after parts A and B |
| 26-27.10 | A restore leaving a chat card, alone 3 runs of 3 | since E17 C6 the clock's bus is a trailing debounce (120 ms, at most 360): the hook a test's last clock write asks for came inside the runner's restore; a per-test wait (`823174bc`) fixed one test | tier 2's restore waits for the bus (`syncIdle` for the clock and the Eclipse, then `traceDigestIdle`, at most 3.6 s; `c9df4dd4`): over a whole probe run 1146 restores waited 222 s in all, 296 found a clock run pending |

## What the method does not catch

- Layout, fonts, the canvas and the GPU, audio, a real LiveKit, a real v14 server: the harness has none of them
  (`audit/harness/README.md`), and its v14 assumptions are LIVE-E30 ids. `glass-sweep.mjs` is real Chromium but
  software-drawn, so its frame costs are a shape, not a table's; scenario 86 counts work, not frames. Found late for
  this reason (25.10): the owner's one-way tunnels between floors on v14, and a roll title laid out vertically.
- Anything the local gate would see: it has not run (section 9, step 4).
- What a skipped check would have let through: no step's counterfactual is measured; the defect classes and the
  overlaps above are judged, and the races were reasoned or reproduced headless, not seen at a table.
- What the stages' own reviews missed: the owner's plan puts a final audit pass before 1.3.0 (E83, not yet a row of
  `tools/stages.json`) - every stage from E01 re-reviewed by the audit's method in a separate run, its findings fixed
  in one pass, then E26 ships 1.3.0. Until it has run, a stage verified only by this method is verified only by it.
