# The gates of E59's point (1), one by one (E59 C1, headless part)

Read on 14.11.2026 at the 1.2.113 assembly base 123f8242 plus this line's commits (`claude/e59-113`). The release gate
itself was not run here: the coordinator runs it on the release candidate. "Runs in ci" means a job of
`.github/workflows/ci.yml` runs it on a push to a `claude/**` branch (quick: `run-all.mjs lint check gate`; scenarios:
every scenario whose layers in audit/harness/README.md hold `ci`, dealt into buckets by the `plan` job; suite: eight
shards, merged by `suite-merge.mjs` in `verdict`). Every "exists" below was read in the tree at the file named; nothing
here was run unless it says so.

The plan's point (1), as the E59 plan translates the owner's audit: "the full gate of both layers on one release
candidate (suite tiers 0-2 after a page reload, the Node harness and audit/live, canary, fuzzing, matrix, mutants,
performance budget, click counter, 84-viewports, runContract on 2.10.5, api-surface, stale-pl, rules-parity,
handbook-pairs, lint and checkState after a whole chapter), with not a single expectedRed left in the suite".

## expectedRed: 0

| What | Read | Count |
| --- | --- | ---: |
| `expectedRed(` markers in the tier files and the grid | `node tools/stages.mjs check` at 123f8242: "0 expectedRed marker(s) in the tier files and the grid, 0 `until` stage(s) in the kit" | 0 |
| a scenario check's `expectedRed` option | `grep -rn 'expectedRed: *{' audit/harness/scenarios` | 0 |
| a scenario check's `knownLeak` option | 4 checks name an entry of audit/harness/known-leaks.json (72-canary S17-64, 65-season two, 33-bridge-paths one) | 10 entries, all `foundryLimit`, none with `closes` |

So nothing was left to close or re-home (Q-E59-5's default: no marker may remain; none remains). The ten known leaks
are Foundry's limits, not stage markers: none names a stage, and D27 lets a `foundryLimit` entry stand after 1.3.0
(known-leaks.json's `about`). They print as "expected red" in a scenario's summary line (run-all.mjs), which a reader
can take for a marker; Q-E59-15 asks whether that line should say "Foundry limit" instead.

## Each gate

| Gate (the plan's word) | Exists? Its command | Runs in ci? | If not run: why, and whose |
| --- | --- | --- | --- |
| suite tiers 0-2 | `game.drpg.runTests({ tier: 2 })` at the table; headless `npm run suite` (scenarios/01-runtests.mjs) | yes: the suite's eight shards and `verdict` | - |
| ... after a page reload | the local gate's suite part in both themes (audit/gate/README.md, `npm run gate:local`) | no | not run: no Foundry v14 server here (local-gate.json: every part `not-run`, `no-server`); E83's local gate |
| the Node harness | `npm test` in audit/harness (lint, check, the gate's self-test, the suite, every `ci` scenario) | yes, spread over the jobs above | - |
| audit/live | audit/live/ against a real Foundry (its README) | no | not run: needs a real Foundry v14 server and accounts; E83's local gate |
| canary | scenarios/72-canary.mjs (and 65-season's chapter) | yes (README rows 72, 65: layers `ci`) | - |
| fuzzing | lib/fuzz.mjs, run as scenario 30-security's last part (E43 C4; the plan's "31-fuzz", Q-E43-4: no scenario of its own) | yes (scenario 30: `ci`) | the local layer not run: LIVE-E43-01, the fuzz on the 30099 sandbox, needs a Foundry v14 server. README row 31 still says `planned`, though the fuzz is in 30 (a stale row: GAPS.md) |
| matrix (the hostile-client matrix) | scenario 33-bridge-paths part H (E43 C5; the plan's "32-case-security") | yes (scenario 33: `ci`) | the local layer not run (needs a v14 server); README row 32 still says `planned` (stale: GAPS.md) |
| mutants | the method's mutants (METHOD.md section 4, definitions kept outside the repository); E40's 12-rule mutation run, recorded 12 of 12 killed in docs/dev/e40/STATUS.md | no | not run in any gate: no mutation runner is in the repository (`git ls-files tools audit` holds none) and the gate does not call one; E40's "done when" puts it in the release gate (GAPS.md, fix window) |
| performance budget | `game.drpg.perf()` and `fps()` at the table; audit/perf-baseline.json | no | not run: the baseline is `not-measured` (`node tools/registry.mjs --next`: "perf baseline not-measured, world copy lost, 0 run(s), 2 attempt(s)"); needs a real v14 table; E53 |
| click counter | scenarios/88-flow-length.mjs | yes (README row 88: `ci`) | - |
| 84-viewports | scenarios/84-viewports.mjs | no (README row 84: layers `local-gate`) | not run: local-gate only, and this line may not run scenario 84 (the coordinator's rule); E83's local gate |
| runContract on 2.10.5 | patches.mjs `runContract`; tier 0 R1203, tier 1 R1540 run it on the harness's stand-ins | the stand-in runs: yes (tiers 0-1 in shard 1) | on a real Daggerheart not run: needs Foundry v14 with Daggerheart installed. module.json now names Daggerheart `verified` 2.12.8 and `minimum` 2.6.5, not 2.10.5 (Q-E59-16: which version the contract run is owed on); E83's local gate |
| api-surface | tools/api-surface.json, tier 0 R1560 (kit `apiSurfaceProblems`) | yes (tier 0) | - |
| stale-pl | `tools/stale-pl.mjs` (T9) | no | not run: not in this base (no tools/stale-pl.mjs, no T9 in tests-text.mjs MODES); E25 C1 / E57 build it, on the text lines |
| rules-parity | tests-text.mjs T7 (`ruleNumberWords`, mode `report`, turns FAIL at E25) | yes, as a report (`node tools/check.mjs text`, in quick) | the FAIL half is not built: E25's and E57's (tests-text.mjs:1311: "the rest of the rules-parity test is E25's") |
| handbook-pairs | `node tools/check.mjs text` part 4 (tools/handbook-facts.mjs: each handbook split twice, the Polish ids, kinds and lines against the English) | yes, in quick | at paragraph level against the code: not built; E57 |
| lint | `npm run lint` | yes (quick) | - |
| checkState after a whole chapter | state-check.mjs `checkState` (E40 C2), run by cluster.mjs after every scenario (E40 C3), tier 1 R5100 | yes: after every ci scenario, 65-season's chapter and 72-canary's among them | on a real world after a real chapter: not run; needs a v14 table; E83 |
| the text check's final modes (the 05.10 decision: T26, T14, T9 after `--stamp`) | `node tools/check.mjs text` | yes (quick) | T14 is FAIL (MODES, E65). T9 and T26 are not in MODES, and no `--stamp` mode exists in tools/ (grep): not built; E25 C1 and E57 |

## The ci record (C0)

`node audit/gate/ci-record.mjs` writes one row per part with the commit and the files it depends on (GATE_FILES), only
after a real run on a clean tree. No record is committed on this line: it is written on the release candidate, after
the run the coordinator makes there.

## Needs a local Foundry

- The suite's tier 2 in both themes after a page reload, the whole-world diff around it, audit/live, 84-viewports, the
  drills `tools/stages.json` names: `npm run gate:local` on a machine with a Foundry v14 sandbox at :30099, a world, the
  `DRPG_FIXTURES` copies (audit/gate/README.md).
- runContract on a real Daggerheart: Foundry v14 with Daggerheart at the version Q-E59-16 settles, as GM, at ready.
- The performance budget (E53): `game.drpg.perf()` and `fps()` at a real table, the world copy E53 names.
- checkState after a whole chapter on a real world: as GM, after playing a chapter to its end.
