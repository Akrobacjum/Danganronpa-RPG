# Working in this repository

This file is for whoever is next in here, human or otherwise. It is not a tour
of the code - the code explains itself at length, and that is deliberate. It is
the short list of things that are easy to get wrong here and expensive to get
wrong twice.

## The one rule the rest follow from

**Measure, then say.** Nearly every long comment in this module ends in a
number, a date and often somebody's name, because nearly every one of them
replaced a plausible guess that turned out to be wrong. A claim in a commit
message, a code comment or a report is a claim somebody will rely on a year
later without re-checking it.

Two ways this has actually failed, both recently, both worth not repeating:

- A test can pass by measuring nothing. `stackShapes` was written, the
  self-check reported zero failures, and the reason was that the block list it
  checked was empty - a property was read under the wrong name. The screenshot
  found it; the numbers said everything was fine.
- A reason written on a bucket of known failures is not the same as a reason
  that was checked. Twelve tests failed on every headless run under the label
  "these need a real canvas". Four of them did not need one, and one of those
  had been telling the truth about a real geometry question for a year.

If a claim cannot be measured, say that instead of rounding it up.

## Running things

| What | How |
| --- | --- |
| The suite, in Foundry | `game.drpg.runTests()` in the console, as GM: tiers 0-1, read-only; `runTests({ tier: 2 })` also writes, and asks first in a window |
| The harness, first time | `cd audit/harness && npm ci` - installs jsdom, ESLint, espree and Playwright (no browser); boots the checkout it sits in, or `DRPG_REPO` |
| Everything CI runs | `npm test` in `audit/harness`: lint, `tools/check.mjs`, the gate's self-test, the suite and every scenario whose layers include `ci`. 38m13s here (05.10, 4 cores, 17 scenarios); exit 1 on anything red |
| The quick part | `npm run quick` - lint, the checks and the gate's self-test, 9-13 s here; `npm run lint` and `npm run check` alone |
| The suite, headless | `npm run suite`, or `node cluster.mjs scenarios/01-runtests.mjs` |
| Tiers 0-1, or a few tests by name, headless | `node run-tests.mjs --tier 1` in `audit/harness`: 200-212 s here (18.10, 4 cores, 449 tests); `--tier 2 --only R553 --only "<piece of a name>"` runs only those, `--only` as often as wanted; the runner's text, then `run-tests: P passed, F failed, S skipped, R red`; exit 1 on a failure, on nothing run and on an `--only` that names nothing in the tiers asked for |
| The suite in shards, and the shards together | `DRPG_SUITE_SHARD=i/n node run-all.mjs suite` in `audit/harness` runs shard i of n: tier 2's tests at positions k with k % n = i - 1, and tiers 0-1 with 01-runtests' parts A and B in shard 1 alone (CI runs 8); `node suite-merge.mjs <dir>` holds every `01-runtests.json` under `<dir>` to the whole suite once - the list's hash, each tier-2 test in its shard, tiers 0-1 in shard 1, the skips exactly `skip-baseline.json`'s, failed 0 - and exit 1 names what is missing or doubled. Here (18.10, 4 cores): shard 1/8 1087 s wall, 449 tests of tiers 0-1 and 119 of tier 2's 950, with parts A and B, shard 2/8 325 s wall, 119 of tier 2's 950 |
| One scenario | `node cluster.mjs scenarios/40-flow.mjs` (add `--verbose` for per-test lines); `node run-all.mjs scenarios --only 40-flow` also holds it to a fresh results file |
| Every scenario | `npm run scenarios`: the rows with layers `ci` in `audit/harness/README.md` |
| One check | `node tools/check.mjs <part>`: stamps, notes, dashes, parity, prose, names, moves, contract, registry, stages, tree, gatecode |
| Whether a commit only moved code | `node tools/moved-only.mjs HEAD~1` - every line moved, promoted, an import or a header; every top-level statement of the files it touches the same tokens at both ends, comments aside; every name read means what it meant (an alias by what it reads, not by its name), and none written became an import; a facade's exports unchanged, each the same declaration, and no name a file stops exporting still imported by a file of scripts/ or audit/harness (statically, or through the import() forms its header names); no import of a module the family did not load, and none for side effects alone; a cut a tier file reads by name, as a table's key, through the bridge crawls or through R290's crawl unchanged, and every function those crawls cut still cut by them. It reads text and scope, not what the code does when it runs. Its planted pairs alone: `node tools/check.mjs moves` |
| The Polish file | `node tools/check.mjs prose` - must read N/N, 497/497 on 24.09 |
| The local gate | on a machine with a Foundry v14 sandbox at :30099, `npm run gate:local` (`audit/gate/README.md`) |
| What a player's roll may do, and what a console's forgery may not | `node cluster.mjs scenarios/83-roll-integrity.mjs` - every legal road clean, each forgery traced; in `npm test` and the local gate since E33 |
| An investigation, end to end, with a second GM | `node cluster.mjs scenarios/62-investigation.mjs` - traces, Observe, Analyze, a reshape, the dashboard's Save, the Key fee and the chapter's end on the clients that do each part, and the handbooks' labels; in `npm test` since E09 (not the local gate: it needs `gm2` and page hooks the sandbox adapter lacks) |
| The curtain, without Foundry | `python3 -m http.server 8765` then `/audit/glass-harness.html` |
| The curtain at 23 sizes, in Chromium | `node audit/glass-sweep.mjs` - both themes at each size: the self-check where glass is drawn and the corner's three launchers, after planting each fault the count must see, then the notice stack against the corner (`drpgNoticeCheck`; `--no-notices` leaves it out); exits 1 when a size is not right. Playwright from `audit/harness` (`npm ci`), Chromium through `PLAYWRIGHT_BROWSERS_PATH` or `--chromium <executable>`; 194 s here with the notice check at 22 sizes (13.10) |
| The evidence pack, without Foundry | the same server, then `/audit/pack-harness.html` |
| What the theme costs, and a drawn roll's round trip | `game.drpg.perf()` at the table - the only place either number is real (the round trip since E33: the last fifty draws this browser took part in) |
| What a screen reader cannot read | `game.drpg.a11y()` |

The headless harness (`audit/harness`) runs four jsdom clients - one GM and
three players; five in 17-assistant and 33-bridge-paths, which add an Assistant
GM, and in 61-gmstore-case and 62-investigation, which add a second Gamemaster - against a shim of Foundry. It is good enough to drive the rules, the
sockets and the DOM, and it is **not** a browser. A test that needs what it
lacks asks an `env.*` probe with `needs()` and is counted as skipped, not
failed. A scenario exits 1 on a red check since E30; before, it exited 0
whatever its checks said.

**What the harness cannot do** is listed in `audit/harness/README.md`; in short:
no layout, canvas, fonts or audio; CSS only as far as jsdom's cascade goes; a
permission gate that models ownership and roles and little else; v14's
operators, pre-update steps and user roles modelled from notes, not from v14's
source; no real server. Each assumption not confirmed on v14 has a LIVE-E30 id,
and every results file lists them under `environment.unconfirmed`. What E31
could not measure headless - a real Reroll through the table, a request's
timing on a real server, a GM leaving mid-request, a late
planted item, a window closing under reduced motion, a Polish player's refusal -
is LIVE-E31-01..06 (audit/AUDIT-1.2.42.md 9.2).

## What the suite's four numbers mean

`937 passed, 0 failed, 17 skipped` (headless, 07.10.2026, 1.2.69), and a fourth,
`red`, printed only when it is not zero.

- **passed** counts a test that ran at least one `ok()` or `equal()`; one that
  ends with none fails as "measured nothing" (the contract, below). The counter
  sees that an assertion ran, not what it read: a scan that gathers across the
  world and asserts once reads only what the world holds, so such a scan asks
  `needs(world.atLeast(...))` first (rule 1).
- **failed** must be zero. It was not zero for a year, and a thirteenth failure
  arrived unnoticed because twelve was a number people had learnt. It was not
  zero again by 1.2.56 (eleven headless failures, all of them windows the
  harness could not draw), which is why the harness's DialogV2 now draws real
  windows on the GM (`__dialogWindows`).
- **skipped** may only be a fact about the environment that the test checked
  itself. Never a result that came out wrong. The harness asserts this number
  does not grow: something that used to be answerable and stopped being so is a
  regression wearing the one colour nobody looks at. Headless, the skips are
  exactly `audit/harness/skip-baseline.json`'s, test by test.
- **red** is a test marked `expectedRed(stage, why)` that failed on an
  assertion, as it said it would. It stays green only while that holds: it
  fails when it passes and when `tools/stages.json` says its stage shipped. 0
  on 24.09.

## Things that will bite, in every file

Two of the traps hold whatever file is open; the rest of the section is in `.claude/rules/code.md`.

**Every English key needs a Polish twin.** `lang/en.json` and `lang/pl.json` are
checked against each other by the suite and by `node tools/check.mjs parity`,
and the prose in `config.mjs` by `node tools/check.mjs prose`. A key used with
`plural()` needs `.one`/`.other` and, in Polish, `.few`/`.many`.

**Delete a key with `forcedDeletion()` or `unsetFlag`.** A `-=key` in an update
removes nothing in this Foundry (the module's own notes; LIVE-E30-01 is the check
that confirms it on v14), and R152 fails any update in the module spelt that way;
the harness reports one as `legacyKeys`. `forcedDeletion()` in `utils.mjs` is
v14's `ForcedDeletion` where it exists (else Daggerheart's `_del`), and null in a
Foundry with neither, where the caller unsets one flag at a time.

## The house style

Comments here are long, and they are long in one particular way: they say what
was tried, what it measured, and why the code is the shape it is. A comment that
restates the line under it is noise; a comment that records the reading that
chose a number is the only place that reading exists. When a comment stops
matching the code, it is worse than nothing - the two comment sweeps in the
audit found several of those and they had each survived a release.

Dashes are `-`, not `—`, throughout, including in prose files.

## The gate, both layers

A release meets two layers (decision D47, E30), and `release.yml` checks both
before it builds anything.

1. **ci** - `npm test`, above. `.github/workflows/ci.yml` runs it on every push
   to `main` or a `claude/**` branch and on a dispatch, spread over parallel jobs -
   lint, check and gate; the scenarios in buckets; the suite in eight shards; then
   `verdict`, which merges the shards with `suite-merge.mjs` (INFRA I3) - and
   `release.yml` calls the same file on the release commit.
2. **local-gate** - what no headless run can do: the suite's tier 2 in both
   themes on a real Foundry v14, the whole-world diff around it, the scenarios
   whose layers include `local-gate`, and the drills a stage names in
   `tools/stages.json`. `npm run gate:local`, on a machine with a v14 sandbox,
   writes `audit/gate/local-gate.json`, bound to its commit;
   `audit/gate/verify-gate.mjs` checks it in the release (its rules are in its
   header and `audit/gate/README.md`). A part that could not run is written as
   not run, with the reason and the real error - never as run.

When the gate is required, what `record` and `enforce` pass and what both refuse:
`.claude/rules/release.md`.

## Releasing, step 5

The other steps are in `.claude/rules/release.md`; this one holds everywhere:

5. **An agent never writes a waiver file and never fills the waiver input.**
   They are the owner's decision and the only way through enforce mode; an
   agent asks.

## Where the rest is

The rest of this file's sections are path-scoped rules under `.claude/rules/` (INFRA I5): each loads when a
session opens a file its `paths:` names. Moved byte for byte; a file that lost a paragraph to this core says so
where it stood.

| Rule file | Holds | Loads when a session opens |
| --- | --- | --- |
| `.claude/rules/code.md` | Where the code lives; Things that will bite (part) | `scripts/**/*.mjs`, `styles/**/*.css`, `lang/*.json`, `tools/moved-only.mjs`, `audit/glass-harness.html`, `audit/glass-sweep.mjs` |
| `.claude/rules/trust-model.md` | The trust model (D2); How to add a bridge action | `scripts/**/*.mjs`, `audit/harness/scenarios/30-security.mjs`, `audit/harness/scenarios/33-bridge-paths.mjs`, `audit/harness/scenarios/83-roll-integrity.mjs`, `audit/harness/lib/dh-relay.mjs`, `audit/harness/lib/dh-dice/**/*` |
| `.claude/rules/tests.md` | Test author contract; Numbering new tests; Registry: R numbers | `scripts/tests*.mjs`, `audit/harness/**/*`, `tools/registry.mjs`, `tools/check.mjs`, `docs/dev/R-REGISTRY.md` |
| `.claude/rules/release.md` | The gate, both layers (part); Releasing (part) | `.github/**/*`, `audit/gate/**/*`, `audit/live/**/*`, `module.json`, `docs/handbooks/*.md`, `README.md`, `styles/danganronpa.css`, `tools/stages.mjs`, `tools/stages.json` |
| `docs/dev/R-REGISTRY.md` | the R-number registry, generated (INFRA I4) | never by itself: read it for a number's row |

The next free R number: `node tools/registry.mjs --next`.

## What is not done

`audit/AUDIT-1.2.42.md` section 9 carries the live checks - the things no
harness can settle and that have to be tried at a real table. That list is the
honest statement of what this module has not yet proved about itself, with two
records beside it: the local gate's parts not run (`audit/gate/local-gate.json`)
and the performance baseline, not yet measured (`audit/perf-baseline.json`: the
1.2.56 method and, since E33 C13, a revision for 1.2.69's `perf()`; the run is
LIVE-E33-05).

