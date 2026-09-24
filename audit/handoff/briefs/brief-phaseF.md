# Phase F brief: C21-C27 (lint, checks, one command, CI, the local gate, the perf baseline, docs)

Read scratchpad/brief-common.md first. The worktree has C0-C20 committed. Re-measure your baseline first.

Design to read in full before you start:
- 05-plan.md: Phase F (C21-C27), section 3 (what E30 cannot prove here) and section 4 (decisions).
- 03-gate.md: all of it.
- 04-registries.md: 7 (the perf baseline) and 6 (the perf-baseline registry rule).
- 02-contract.md: 12 (the CLAUDE.md "Test author contract" text) and 10.

## Installing (C21)
The worktree's audit/harness/node_modules is a symlink into another checkout. Before C21, remove the
symlink (`rm audit/harness/node_modules`, not -r: it is a link) and install a real one in the worktree:
`npm install --save-dev --save-exact eslint@10.11.0 espree@11.2.0 jsdom@30.0.1 playwright@1.56.1` in
audit/harness (Playwright must not download browsers - PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 is set; check
that nothing was downloaded). package.json gets the engines, scripts and devDependencies of 03-gate.md 1
(jsdom moves from dependencies to devDependencies); commit the regenerated lockfile. Never commit
node_modules.

## C21-C23 as 05-plan.md says
eslint.config.mjs at the root (listed globals, never globals.browser) and `eslint.config.mjs export-ignore`
in .gitattributes; tools/check.mjs gains every part of 03-gate.md 5 (stamps, notes, dashes, parity,
prose, names, stages, tree, gatecode; rnumbers folds into registry); tools/config-prose.mjs exports
proseCoverage and keeps its CLI output; scripts/chrome.mjs writes its dash class with U+2013U+2014 escapes;
audit/harness/run-all.mjs (03-gate.md 2). Verify each as the plan says, including the planted faults
(a deleted import is reported by lint; an en dash in a pl.json value turns `dashes` red; one inverted
scenario check turns run-all red) - on scratch copies, reverted.

## C24 - ci.yml
Write .github/workflows/ci.yml as 03-gate.md 6 (three matrix jobs, Node 22.22.2, results uploaded). You
cannot push or dispatch: the orchestrator does the GitHub runs. Instead, run `npm test` locally in full and
record each part's time and the maxRSS readings; and run the four mutations of 03-gate.md 12 point 3
LOCALLY on scratch copies with `node run-all.mjs <part>` (dropped ownsActor in one GM_HANDLERS entry ->
suite and 30 red; en dash in pl.json -> check red; deleted rankForObserve import -> lint red; inverted
check in 14 -> scenarios red). Put the numbers in the commit message.

## C25 - the local gate, and release.yml checks both layers
audit/gate (gate-lib.mjs, local-gate.mjs, verify-gate.mjs with the --self-test of 03-gate.md 9, README.md,
waivers/.gitkeep) and audit/live (README.md, foundry.mjs, suite.mjs, sandbox-cluster.mjs, page-hooks.js,
seed-world.mjs). They never fill a password or licence field; seed-world refuses a non-empty world;
live-world-diff compares per-document dumps. Keep audit/live as small as the design allows: none of it can
run here, so its README must say plainly that it has never run against a real Foundry, and every part it
cannot run is recorded as not-run with the real error, never as ran.

THE GATE POLICY IS NOT QUITE THE DESIGN'S. The orchestrator decided (the owner is told in the release
report and can flip it): verify-gate's rule 12 has two modes chosen by the repository variable
DRPG_LOCAL_GATE (passed to the job as env from `vars.DRPG_LOCAL_GATE`):
- unset or "record" (the default): a release whose required parts did not run because of a WAIVABLE
  reason (no-server, no-world, wrong-foundry, no-fixtures) passes, provided the release notes' "## Checked"
  section has a line starting "- Not checked in a real Foundry"; the job summary lists the parts not run and
  the releases since the last complete local gate (the debt, read from git history of local-gate.json).
  Failed or errored parts, non-waivable reasons, a stale/edited/missing/unbound local-gate.json, and any
  version in NO_WAIVER (1.3.0) are refused exactly as the design says.
- "enforce": the design's rule 12 as written (waiver file, the tag typed again as the waiver input, the
  protected environment local-gate-waiver).
So release.yml keeps the design's jobs (main-only, ci via workflow_call, local-gate, waiver-approval that
runs only when verify-gate outputs waived=true, release with the explicit if), and verify-gate reads the mode.
The self-test covers both modes (in record mode: a required not-run part with the notes line passes, without
it refuses; 1.3.0 refuses in both modes). Stamps and notes in release.yml go through
`node tools/check.mjs stamps notes --release "$TAG"`; new steps take inputs through env:.
Verify: `node audit/gate/verify-gate.mjs --self-test` passes every case; `npm run gate:local` here records every
part not-run (live and sandbox: no-server with the real ECONNREFUSED on 127.0.0.1:30099; drills: no-fixtures)
with verdict incomplete - do NOT commit that local-gate.json (the release commit writes the real one).

## C26 - audit/perf-baseline.json: the 1.2.56 baseline, not yet measured
As 04-registries.md 7.4-7.5 and 05-plan.md C26: status "not-measured", worldCopy.status "not-taken",
perfFunction.bodySha256 recomputed by you at v1.2.56 and HEAD (the design says f8f57391...; check it);
audit/live/perf-baseline.mjs (--probe appends an attempt made of the probes' real output; --run as specified,
never run here) and audit/live/world-manifest.mjs; the registry part validates the schema (from E04's
release on, not-taken fails). Verify: `node audit/live/perf-baseline.mjs --probe` appends one attempt with
the actual probe errors and exits 0.

## C27 - CLAUDE.md, CONTRIBUTING.md, audit/README.md
As 05-plan.md C27 and 03-gate.md 11: the Test author contract (02-contract.md 12, with the real R numbers
R154-R158), "What the suite's four numbers mean" with the numbers you measure, "Running things" (npm test,
quick, lint, check, gate:local; "the rows with layers ci in audit/harness/README.md" instead of the list of
eleven), a short "What the harness cannot do" summary pointing at audit/harness/README.md, "The gate, both
layers" (each layer's steps, and the two modes of the local gate above), "Releasing" (`node tools/stages.mjs
ship EXX` in the release commit, the local gate on the bumped commit, and: an agent never writes a waiver file
or fills the waiver input), "delete a key with forcedDeletion() or unsetFlag; '-=' removes nothing (R152)",
five clients in 17-assistant. Keep CLAUDE.md's existing voice and structure; update, do not bloat.
audit/README.md also says the harness has "3 klienci"; it has four (five in 17-assistant) - fix it here.
probes/07-apimap.mjs was rewritten in C3b, so git shows a delete plus an add: nothing to do, but do not
claim `git log --follow` follows it.
Verify: `node tools/check.mjs dashes registry` exits 0; `npm run quick` is green.

Do not bump the version, do not write release notes, do not run `stages.mjs ship` - the orchestrator does
the release commit (C28). Report as the common brief says.
