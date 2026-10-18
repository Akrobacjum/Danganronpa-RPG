---
paths:
  - "scripts/tests*.mjs"
  - "audit/harness/**/*"
  - "tools/registry.mjs"
  - "tools/check.mjs"
  - "docs/dev/R-REGISTRY.md"
---

# Tests: the contract and the numbering (moved from CLAUDE.md)

## Test author contract

Every test in `scripts/tests-tier*.mjs` keeps these. The runner holds rules 1, 2
and 5 on every run, and R154 runs it on cases of its own; R155-R158 read rules 2
to 5 off the tier files; rule 6 is the runner's world dump, with R159; rule 7 is
01-runtests' in the harness. Whether a scan of the world read anything is the
author's to keep: nothing reads it. `node tools/check.mjs contract` runs the same
detectors (`scripts/tests-lint.mjs`) in CI, and holds the harness scenarios to
rule 4.

1. **It measures something.** A test that ends without one `ok()` or `equal()`
   having run FAILs as "measured nothing". A scan of the world measures only what
   the world holds, and an assertion after the loop runs whether the loop read
   anything or not - so a test that reads the world asks
   `needs(world.atLeast(...))` for what it reads, and the harness world holds one
   of each (`audit/harness/lib/seed.mjs`: a trace, an item with a role, a stash).
   An assertion the test catches itself FAILs it.
2. **A skip is a probe, never a result.** `needs()` takes only `env.*` (this
   browser, this Foundry) or `world.*` (the world as found) from
   `tests-kit.mjs`; anything else FAILs (R158), and a `world.*` asked after the
   test wrote to the world FAILs. What the module does is `ok()`. A new probe is
   a row in the kit, not a condition in a test.
3. **Source is cut with the kit** - `bodyOf`, `fnSource`, `lineAround` (R156). A
   `slice` bounded by `indexOf`, or `split(marker)[1]`, answers -1 or nothing
   when the code moves, and every negative assertion after it passes. A `bodyOf`
   with neither `until` nor `length` reads to the end of the file; R156 does not
   flag that yet (40 such reads are left for E40).
4. **Nothing is true by construction** - no `ok(true)`, no `|| true`, no
   `check(name, true)` (R157).
5. **Red on purpose says until when.** `[name, fn, expectedRed("E07", why)]` is
   green while it fails on an assertion, FAILs as "unexpectedly passed" when it
   passes, and FAILs once `tools/stages.json` says E07 shipped (R155). One tuple
   per generated case. A harness check says the same with its `knownLeak` or
   `expectedRed` option.
6. **Tier 0 and 1 change nothing; tier 2 puts everything back.** `worldDump()`
   is compared before and after tiers 0-1 and after every scenario's `restore()`
   ("restore left: ..."). Leaving a path out of the dump takes a `DUMP_RULES`
   row with a reason and an `until`; R159 holds the dump to every document type
   and setting a write in the module names (a write through a document in hand
   is not read yet: E40).
7. **World requirements skip, they do not fail.** Fixtures come from `cast(n)`
   and `world.*`. The harness world satisfies every `world.*`, so
   `audit/harness/skip-baseline.json` holds `env.*` probes only, and must match
   the run exactly.

R154 runs the runner's judgement on 22 small tests with known verdicts - 18 break
rules 1, 2 and 5 on purpose, 4 are controls that break none - and holds each to
its verdict.

## Numbering new tests

Every tier-0 test carries an R number, and so does every tier-1 test written
since 1.2.61: `R<n> - <what it promises>`. The number is how a comment, a commit
and an audit find the same test a year later, so it is never reused - a deleted
test keeps its row, marked with the stage that removed it. Tier-2 scenarios are
named, not numbered.

- `R113`-`R124` are reserved by number: `R113`-`R117` and `R120` for A5 (E13),
  `R118` and `R119` for A5 but written in E12, `R121` for A4 (E22), `R122` for A1
  (E23), `R123` and `R124` for A6 (E24). A design document that calls its first
  test "R113" means its row here. `R160` is the FLOWS test. `R292`-`R299` are
  reserved for A7 (E81).
- `R21` was two tests until 1.2.61; the second, "the chapter ends by closing the
  trial", is `R151`.
- 70 tier-1 invariants older than 1.2.61 have no number and keep their names;
  the registry, `docs/dev/R-REGISTRY.md`, lists them. A tier-0 or tier-1 test with
  no number that is not on that list fails `node tools/check.mjs registry`, and
  so does a number used twice.
- Take the next free number (`node tools/registry.mjs --next`, the registry's
  first line) in the commit that adds the test; `node tools/registry.mjs --write`
  adds its row to `docs/dev/R-REGISTRY.md`.

## Registry: R numbers

In `docs/dev/R-REGISTRY.md` since INFRA I4, generated there by `node tools/registry.mjs --write`;
`node tools/registry.mjs --next` prints the next free number and the reserved ones.
