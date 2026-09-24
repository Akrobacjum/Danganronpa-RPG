# E30: one test command, CI and the two-layer gate (S17-05, D47)

This is a read-only design, written against the copy at 411d4da. That copy has module.json at 1.2.59 and already carries the notes for 1.2.60; E30 ships as 1.2.61. Everything called "measured" was run on 24.09 on that copy or on a scratch copy of it (Node 22.22.2, 4 cores, 16 GB). Nothing in the copy was edited: `git status` shows only the untracked items that were already there. The harness was not started. The probes are in scratchpad/e30-ci/.

## 0. Measured facts the design rests on

1. **The harness exit code never reports a failure.** cluster.mjs:428-429 sends "shutdown" and then calls `setTimeout(() => process.exit(red ? 1 : 0), 400).unref()`. Each client runs `process.exit(0)` on "shutdown" (client-entry.mjs:972). The IPC handles then close, and Node exits on its own with code 0 before the unref'd timer fires.
   - A probe with four forked children and exactly those lines, with one failed check, exited 0 in 5 of 5 runs. With `process.exitCode = red ? 1 : 0` set before the shutdown it exited 1 in 3 of 3.
   - Earlier summaries in the scratchpad agree: "11-killer-secrecy exit=0 ... 5/6 checks passed" and "40-flow exit=0 ... 37/38".
   - So today a CI step that runs `node cluster.mjs ...` is green whatever its checks say. That includes the 24.09 handler mutations, which the suite itself did catch: mutA read "289 passed, 3 failed" (R1b, R134, R138) and mutB failed R1b and R134.
2. **Durations** (this container's logs, 411d4da family):
   - 01-runtests: 179.6-182.3 s of scenario time, 3m01-3m04 wall.
   - 30-security: 60.4-60.5 s, 1m02-1m04 wall.
   - The other ten scenarios: 34.3 s together, 0.3-9.9 s each.
   - Boot and exit: about 1.7 s per invocation. The whole ci layer run in sequence is about 5 minutes.
   - The suite at 411d4da reads 292 passed, 0 failed, 16 skipped. That is 117 tier-0, 93 tier-1 and 97 tier-2 entries, plus the tier 0/1 purity check.
   - Peak memory is recorded nowhere and was not measured.
3. **ESLint 10.11.0** (installed into the scratchpad, not the repo):
   - With browser globals only, scripts/ has 6102 no-undef reports on 16 names, and every one is a Foundry global: game 4375, foundry 692, ui 429, Hooks 253, canvas 162, PIXI 105, CONST 31, CONFIG 26, ChatMessage 16, fromUuidSync 4, Playlist 2, Actor 2, RollTable 2, fromUuid 1, Roll 1, Folder 1.
   - No Daggerheart name and no module name is read bare anywhere in scripts/.
   - With no browser globals at all, the code reads 34 browser names bare.
   - With the config in section 4: 135 files (108 scripts, 4 tools, 23 audit/harness), 0 problems, 3.2 s. The same through the Node API with `cwd` set: 0 problems, 3.2 s. The option `typeof: true` adds 0.
   - Without the per-file blocks, audit/harness has 49 reports in two files: lib/dh-relay.mjs (Hooks, game, CONFIG, fromUuid, getDocumentClass - this is Daggerheart's code) and client-entry.mjs (window, document).
   - macros/*.js: all 5 files fail to parse, because Foundry macro bodies use top-level return and await.
   - Planted faults in a scratch copy:
     - Removing `import { rankForObserve }` from observe.mjs is reported.
     - A leftover `status + name` read is reported with the listed globals and missed with `globals.browser`, because both are window properties.
4. **Imported names** (espree 11.2.0, scratch probe): 108 files, 2118 statically imported names, 1068 names taken from dynamic imports, 2 dynamic imports with a computed path, 0 unresolved, 0.9 s. Both planted faults were reported: a static import of a non-export in observe.mjs, and a renamed destructure of `await import("./murder.mjs")` in gm-bridge.mjs:240.
5. **Languages:**
   - en has 2638 keys and pl has 3309, 497 of them DRPG.Config.*.
   - Missing 0, stray 0, placeholder holes 0.
   - 87 plural families, all with pl `.few` and `.many`.
   - `config-prose --check lang/pl.json` reads 497/497, exit 0, 57 ms.
6. **Stamps:** 1.2.59 in module.json, in danganronpa.css:35, on line 3 of all six handbooks, and in README "describe version 1.2.59.". The notes v1.2.59.md and v1.2.60.md are present.
7. **Dashes:**
   - U+2014 appears in tracked text only at:
     - scripts/chrome.mjs:130, inside a regex character class that lists hyphen, U+2013 and U+2014 literally;
     - CLAUDE.md:155 and CONTRIBUTING.md:66, both inside backticks, quoting the rule.
   - lang/*.json, docs/, README and all release notes have 0 U+2014 and 0 U+2013, and no `U+2013` or `U+2014` escapes either.
   - U+2013 elsewhere: 14 in scripts (page ranges in comments, plus three strings a user can see: action-rolls.mjs:4668, season-setup.mjs:461, gm-bridge.mjs:1430), 2 in danganronpa.css comments, 4 in audit reports.
   - The chrome.mjs regex rewritten with `U+2013U+2014` escapes matched the literal one on 11 of 11 samples.
8. **R numbers:** 139 distinct. R21 is used twice (tests.mjs:1718 and :2000). R113-R124 are unused (reserved). The highest is R150.
9. **Scenarios:**
   - Checks asserting a literal `true`: 00-boot.mjs:25 and 12-social.mjs:9, plus six in the probes 02, 04, 05 and 07.
   - Known-leak checks that fail today:
     - 11-killer-secrecy.mjs:47 (S04-02, fixed in E06);
     - 40-flow.mjs:120 (S02-11/S10-05, fixed in E05).
   - 19 result files are tracked under audit/harness/results.
   - 15-held.mjs has taken number 15 since E27 (6f270d8), but the plan's registry names "15-trial".
10. **This environment:**
    - Nothing answers on localhost:30099 (curl exit 7). There are no Foundry files and no DRPG_* variables.
    - Installed: Playwright 1.56.1 with Chromium 1194 (/opt/pw-browsers), and ESLint 10.1.0 globally.
    - Node constraints: jsdom 30.0.1 needs `^22.22.2 || ^24.15.0 || >=26`; ESLint 10.11.0 needs `^20.19 || ^22.13 || >=24`.
    - Playwright 1.56.1 and playwright-core have no install scripts: 13 MB, no browser download.
11. **Dawid's tools:** tools/*-icons.mjs are run as `ELECTRON_RUN_AS_NODE=1 "<foundry>.exe"`. Electron has no npm, so whatever machine runs the local gate needs a real Node 22 and npm.

## 1. Where things live

The plan's option is kept: ESLint and jsdom become devDependencies of the harness. Everything test-related stays under audit/ and tools/, which .gitattributes already export-ignores, so module.zip does not change.

- **audit/harness/package.json** - scripts, devDependencies and engines, with the lockfile regenerated (`npm install --save-dev --save-exact` in that folder).
  - The one command is `cd audit/harness && npm ci && npm test`.
  - From the repository root it is `npm --prefix audit/harness ci`, then `npm --prefix audit/harness test`.
- **audit/harness/run-all.mjs** (new) - the orchestrator.
- **audit/harness/lib/seed.mjs** (new) - the world seed moved out of cluster.mjs:34-102, so the sandbox world and the harness world are built from one list.
- **eslint.config.mjs** (new, repository root, imports nothing) - add `eslint.config.mjs export-ignore` next to `CLAUDE.md export-ignore` in .gitattributes (line 14).
- **tools/check.mjs** and **tools/stages.json** (new). tools/config-prose.mjs is refactored to export `proseCoverage(file)` and keeps its command-line output.
- **audit/gate/**
  - gate-lib.mjs, local-gate.mjs, verify-gate.mjs, README.md;
  - local-gate.json and evidence/ - written only by the script;
  - waivers/ - written only by a person.
- **audit/live/** - README.md, foundry.mjs, suite.mjs, sandbox-cluster.mjs, page-hooks.js, seed-world.mjs.
- **.github/workflows/ci.yml** (new) and **release.yml** (changed).
- **.gitignore** - add `audit/harness/results/` (S14-23) and `audit/gate/.work/`.

A root package.json was considered and rejected. It would need export-ignore entries for package.json, package-lock.json and node_modules, and a second place to explain. Its one advantage, `npm test` at the root, is had anyway through `--prefix`.

audit/harness/package.json:

```json
{
  "name": "drpg-harness",
  "private": true,
  "description": "Tests of the Danganronpa RPG module: headless harness, lint, checks, local gate. Nothing here ships (audit/ is export-ignored).",
  "engines": { "node": "^22.22.2 || ^24.15.0 || >=26.0.0" },
  "scripts": {
    "test": "node run-all.mjs",
    "quick": "node run-all.mjs lint check gate",
    "lint": "node run-all.mjs lint",
    "check": "node run-all.mjs check",
    "suite": "node run-all.mjs suite",
    "scenarios": "node run-all.mjs scenarios",
    "gate:local": "node ../gate/local-gate.mjs",
    "gate:verify": "node ../gate/verify-gate.mjs"
  },
  "devDependencies": { "eslint": "10.11.0", "espree": "11.2.0", "jsdom": "30.0.1", "playwright": "1.56.1" }
}
```

## 2. npm test: audit/harness/run-all.mjs

**Usage:** `node run-all.mjs [lint] [check] [gate] [suite] [scenarios] [--only NN-name] [--verbose]`. With no part named, all five run in that order. `REPO` is taken from `DRPG_REPO`, or two folders up, the same rule as cluster.mjs:25.

| Part | What it runs | Red when |
| --- | --- | --- |
| lint | `const { ESLint } = await import("eslint"); await new ESLint({ cwd: REPO }).lintFiles(["."])`, using the root config | Any error or fatal parse error. Also when the results do not include every `scripts/*.mjs` from `readdirSync` - a config pattern that stops matching must not read as "0 problems". Prints `lint: 135 files, 0 problems`. |
| check | `node tools/check.mjs`, with cwd REPO | Exit is not 0. |
| gate | `node ../gate/verify-gate.mjs --self-test` | Exit is not 0. |
| suite | Scenario 01-runtests | See the per-scenario rules below. |
| scenarios | Every scenarios/*.mjs whose `export const layers` includes "ci", except 01, in number order: 00, 10, 11, 12, 13, 14, 15, 17, 20, 30, 40, 50, 60 | See the per-scenario rules below. 00-boot joins once S14-23 filters out the LIVEKITAVCLIENT keys. |

`layers` is read with the regex `/export const layers = (\[[^\]]*\])/` and JSON-parsed, so the scenario module is never imported.

Per scenario:

1. Delete results/NAME.json and results/NAME.log.
2. Spawn `node cluster.mjs scenarios/NAME.mjs` with `detached: true`, so it has its own process group. Send stdout and stderr to results/NAME.log, and also to the console with `--verbose`.
3. Timeout: the scenario's `export const timeoutMs`, else 5 minutes; 12 minutes for 01-runtests.
4. After exit or timeout, kill the whole group: `process.kill(-pid, "SIGKILL")` in a try/catch, or `taskkill /pid P /T /F` on win32. This reaps the orphaned client-entry.mjs processes that STATE.md warns about.
5. Read results/NAME.json. It must exist, its `startedAt` must be at or after this run's start, and `total` must be above 0. The part is red when:
   - any verdict is fail, unexpected-pass or overdue;
   - the file is missing or stale;
   - the run timed out;
   - the exit code disagrees with the verdicts. This is a tripwire for the bug in 0.1, reported as "cluster said green while its checks were red".

Output:

- A table per part: status, ms, counts, and each expected-red item with its stage.
- results/run-all.json, which is gitignored.
- A Markdown copy appended to `$GITHUB_STEP_SUMMARY` when that is set.
- Exit 0 when everything is green, 1 when anything is red, 2 on a usage error.

## 3. Harness changes the gate depends on

- **cluster.mjs:428-429.** Set `process.exitCode = anyRed ? 1 : 0` before the shutdown loop. Keep the timer as a hard stop.
- **cluster.mjs:373-376.** The signature becomes `check(name, ok, details = "", { expectedRed } = {})`, where `expectedRed` is `{ stage: "E06", why: "known leak S04-02" }`. Each result gains a `verdict`:

  | ok | Marked expectedRed? | Stage shipped? | Verdict |
  | --- | --- | --- | --- |
  | true | no | - | pass |
  | false | no | - | fail |
  | false | yes | no | expected-red |
  | true | yes | - | unexpected-pass |
  | false | yes | yes | overdue |
  | - | yes, stage not in stages.json | - | fail |

  "Shipped" means module.json's version is at or above the stage's version in tools/stages.json. The comparison must be numeric: 1.2.100 arrives at E45, and a string compare would get it wrong.
- **cluster.mjs:416-425.** The results JSON gains:
  - `startedAt` and `finishedAt`;
  - `module: { version }` and `layers`;
  - a count of each verdict;
  - `resources: { gm, p1, p2, p3, cluster }` with maxRSS in KB. Each client sends a `bye` message carrying `process.resourceUsage().maxRSS` in reply to "shutdown" (client-entry.mjs:972), and the cluster waits at most 300 ms for them. This is how CI measures memory, which nobody has measured so far.
- **11-killer-secrecy.mjs:47 and 40-flow.mjs:120.** Move "[known leak ..., fixed in EXX]" out of the check name and into `expectedRed` (stages E06 and E05). CI is then green on day one and turns red if E05 or E06 ships without the fix.
- **01-runtests.mjs:24-26.** Call tier 2 the way S17-06 defines it (for example `runTests({ tier: 2, confirmed: true })`). The GM's real windows (`__dialogWindows`) would otherwise wait for a click. Raise the timeout from 240000 to 600000: 240 s leaves only 33% headroom over the measured 180 s, a GitHub runner's speed is unknown, and this number is a hang detector, not a benchmark.
- **Tier 2 stays in CI.** The plan says "suite tier 0-1 through 01-runtests", but on the harness's disposable world tier 2 is safe. Dropping it would take 97 of the 308 suite results out of CI, which is a weakening. The plan's "0-1" is read here as the floor.

## 4. npm run lint: eslint.config.mjs (repository root)

The globals are listed, not imported from the `globals` package. `globals.browser` declares every window property - `name`, `status`, `event`, `top`, `length` among them - so a leftover read of one of those resolves to the window property and passes. This was measured above.

The lists are exactly what the code read on 24.09. The Daggerheart and module sets are empty by measurement. A new bare name is added here with the place that needs it.

```js
/** What `npm run lint` holds the code to (E30, audit S17-05): no-undef, measured 24.09 - 135 files, 0 problems. */
const names = list => Object.fromEntries(list.trim().split(/\s+/).map(n => [n, "readonly"]));
// Foundry v14 names the module reads bare: 16 names, 6102 reads on 24.09. No Daggerheart or module global is read bare.
const FOUNDRY = names(`game ui canvas CONFIG CONST Hooks foundry PIXI
    ChatMessage Actor Playlist RollTable Folder Roll fromUuid fromUuidSync`);
// Browser names the module reads bare (34). Not globals.browser: it would let a leftover `name` or `status` through.
const BROWSER = names(`window document console fetch performance PerformanceObserver
    setTimeout clearTimeout setInterval clearInterval requestAnimationFrame queueMicrotask
    getComputedStyle matchMedia innerWidth innerHeight devicePixelRatio location addEventListener
    CSS CSSTransition HTMLElement Element Node Event CustomEvent KeyboardEvent MouseEvent FocusEvent
    MutationObserver ResizeObserver Blob FormData URL`);
const NODE = names(`process console setTimeout clearTimeout setInterval clearInterval performance URL Buffer`);
const RULES = { "no-undef": ["error", { typeof: true }] };
const LANG = { ecmaVersion: "latest", sourceType: "module" };
export default [
    { ignores: ["**/node_modules/**", "audit/harness/results/**", "audit/gate/evidence/**", "audit/gate/.work/**",
        "docs/**",                         // design papers (docs/design/glass-recipe.js), not code that runs
        "macros/**",                       // Foundry macro bodies: top-level return and await; removed from main in E59 (D47)
        "audit/harness/lib/dh-relay.mjs"]  // Daggerheart's relay, copied verbatim and never edited (CLAUDE.md)
    },
    { files: ["scripts/**/*.mjs"], languageOptions: { ...LANG, globals: { ...BROWSER, ...FOUNDRY } },
      linterOptions: { reportUnusedDisableDirectives: "error" }, rules: RULES },
    { files: ["tools/**/*.mjs", "audit/**/*.mjs", "eslint.config.mjs"], languageOptions: { ...LANG, globals: NODE },
      linterOptions: { reportUnusedDisableDirectives: "error" }, rules: RULES },
    // client-entry.mjs:30-31 makes jsdom's window and document globals.
    { files: ["audit/harness/client-entry.mjs"], languageOptions: { globals: { window: "readonly", document: "readonly" } } },
    // The live runner's page.evaluate functions run inside Foundry's page.
    { files: ["audit/live/**/*.mjs"], languageOptions: { globals: { ...NODE, ...BROWSER, ...FOUNDRY } } },
    { files: ["audit/live/page-hooks.js"], languageOptions: { ecmaVersion: "latest", sourceType: "script", globals: { ...BROWSER, ...FOUNDRY } }, rules: RULES }
];
```

- **What it does not replace:** R22 (tests.mjs:1762). R22 runs at a table, where lint cannot, and its AMBIENT list (tests.mjs:479) is wider than this one.
- **An option, not in the brief:** 60 of the 64 rules in `@eslint/js` recommended have 0 hits in scripts/ today. The four with hits are no-unused-vars 46, no-useless-assignment 20, no-control-regex 4 and no-useless-escape 1. Switching on the 60 zero-hit rules costs one devDependency (`@eslint/js` 10.0.1) and nothing to fix.

## 5. npm run check: tools/check.mjs

**Usage:** `node tools/check.mjs [part ...] [--release vX.Y.Z]`. Each part prints its own numbers, so a part that measured nothing shows it. Exit 1 when any part is red. Only the names part loads espree, through `createRequire(REPO/audit/harness/package.json)`. The other parts need no `npm ci`, so release.yml can run them bare.

| Part | Rule | Today at 411d4da |
| --- | --- | --- |
| stamps | Four places agree: module.json version, the `--drpg-css-version` stamp in danganronpa.css, the first 5 lines of each of the six handbooks, and README's `/describe version (\d+\.\d+\.\d+)\./`. With `--release`, the tag must also equal "v" + the version. These are release.yml:60-109 and R125, moved into one file. | ok (1.2.59 in all 8) |
| notes | `.github/release-notes/v<version>.md` exists and is not empty. | ok |
| dashes | See the list below the table. | red at chrome.mjs:130 until it uses `U+2013U+2014` escapes |
| parity | The tier-1 invariant at tests.mjs:7372-7406, run in Node: missing 0; stray 0 apart from DRPG.Config.* and .few/.many; placeholders 0 except `{a}`. Plus CLAUDE.md's plural rule: every en `.one`/`.other` family has pl `.few` and `.many`. | ok (2638 / 3309 / 87 families) |
| prose | `proseCoverage("lang/pl.json")`: wanted > 0, missing 0, extra 0. Prints N/N. | ok (497/497) |
| names | Every name taken from `./x.mjs` in scripts/ is exported by x.mjs, following `export *`. That covers static imports and re-exports, `const { a } = await import(...)`, `(await import(...)).a`, `import(...).then(({ a }) => ...)` and `.then(m => m.a)`. Computed-path dynamic imports are counted and printed, not checked. | ok (2118 + 1068 names, 0 unresolved, 2 computed) |
| registry | See the list below the table. | red until E30 writes the registry |
| rnumbers | R numbers in scripts/tests*.mjs are unique. Prints the next free number. | red: R21 twice (S14-25); next free R151 |
| stages | tools/stages.json parses, ids are unique, versions strictly increase (numeric compare), and every `expectedRed("EXX"` in tests*.mjs or the scenarios names a known stage. | new |
| tree | `git ls-files audit/harness/results` is empty. | red: 19 files, until S14-23 |
| gatecode | audit/live and audit/gate never fill a password, admin key or licence: no `type=password` selector, and no `.fill(` aimed at a field named like password, adminKey or licence. | new |

The dashes part:

- No U+2013 or U+2014 in the decoded keys and values of lang/*.json.
- No U+2013 or U+2014 in docs/**/*.md, README.md or .github/release-notes/*.md.
- In CLAUDE.md and CONTRIBUTING.md, no U+2014 outside inline code.
- No U+2014 in scripts/, styles/, tools/, audit/harness, audit/gate, audit/live (code only), .github/workflows or eslint.config.mjs.
- U+2013 is not ruled in code. The house rule names only the em dash, and code holds 16 page ranges and similar.

The registry part:

- Every scenarios/*.mjs has `export const layers`, a subset of `["ci","local"]`.
- Scenario numbers are unique.
- audit/harness/README.md has a table with columns `| No. | File | Layers | Added in | Measures |`. It has exactly one row per file, with the same layers. Rows for reserved numbers may have no file.
- A scenario whose layers include "local" does not destructure any of world, permissionDenials, socketTraffic, bootInfo, logSink or broadcastRaw.
- No `check(<name>, true`. Today that is 00-boot.mjs:25 and 12-social.mjs:9; the probes move to audit/harness/probes/ under S14-23.
- The plan's "15-trial" needs another number, because 15 is 15-held.

tools/stages.json holds one row per stage, in the plan order of D20:

```json
{
  "schema": 1,
  "stages": [
    { "id": "E03", "version": "1.2.60", "touches": ["sockets", "rolls"] },
    { "id": "E30", "version": "1.2.61", "touches": ["scenes"], "drills": ["<migrateRemnants drill>"] },
    { "id": "E26", "version": "1.3.0", "touches": ["sockets", "rolls", "scenes"] }
  ]
}
```

- The full mapping, E01 = 1.2.57 through E59 = 1.2.115 and E26 = 1.3.0, follows the order in STATE.md.
- `touches: null` means "not declared". The detector described in section 9 then decides alone, so an undeclared stage cannot skip the gate.

## 6. .github/workflows/ci.yml

```yaml
# The 'ci' layer of the release gate (E30, decision D47): `npm test` in
# audit/harness, split into three jobs that run side by side. release.yml calls
# this file before it builds, so a release and a pull request meet the same steps.
# Measured 24.09 in a 4-core container: suite 180 s, 30-security 60 s, the other
# scenarios 34 s plus about 1.7 s of boot each, lint 3.2 s, check under 2 s.
# GitHub's runner is not that container: the first runs are the measurement, and
# every results JSON records its time and each client's peak memory.
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
  workflow_call:
permissions:
  contents: read
jobs:
  test:
    name: ${{ matrix.name }}
    runs-on: ubuntu-24.04
    timeout-minutes: ${{ matrix.minutes }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - { name: "lint, check, gate", parts: "lint check gate", minutes: 10 }
          - { name: "suite", parts: "suite", minutes: 25 }
          - { name: "scenarios", parts: "scenarios", minutes: 25 }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.22.2
          cache: npm
          cache-dependency-path: audit/harness/package-lock.json
      - name: Install the harness
        working-directory: audit/harness
        run: npm ci
      - name: npm test (${{ matrix.parts }})
        working-directory: audit/harness
        run: node run-all.mjs ${{ matrix.parts }}
      - name: Keep the results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: results-${{ strategy.job-index }}
          path: audit/harness/results/
          if-no-files-found: ignore
          retention-days: 14
```

Expected wall time is about 4-5 minutes, set by the suite job: setup plus 180 s. The scenarios job is about 3 minutes and lint/check/gate about 1 minute. None of this is measured on Actions yet.

Memory is not measured. GitHub documents 4 vCPU and 16 GB for public-repository Linux runners.

`workflow_dispatch` lets anyone run CI on any branch, including the mutation branches in section 12.

Making these checks required for merges is a branch-protection setting that Dawid makes on GitHub.

## 7. .github/workflows/release.yml

**Top level:**

- Inputs `tag` and `title` stay as they are.
- New input `local_gate_waiver`: "Leave empty. Only with a waiver Dawid wrote: the tag again. Never for 1.3.0."
- Permissions become `contents: read`.

**Job `main-only`:** release.yml:48-56, unchanged.

**Job `ci`:** `needs: main-only` and `uses: ./.github/workflows/ci.yml`. This is the same three jobs on the same SHA.

**Job `local-gate`:** `needs: main-only`. Steps:

- Checkout with `fetch-depth: 0`, because the verifier reads tags and the gated commit.
- setup-node 22.22.2.
- Step id `verify`, with env `TAG`, `WAIVER` and `DRPG_GATE_KEY: ${{ secrets.DRPG_GATE_KEY }}`, running `node audit/gate/verify-gate.mjs --tag "$TAG" --waiver "$WAIVER"`.
- Output `waived` is `steps.verify.outputs.waived`.

**Job `waiver-approval`:**

- `needs: local-gate` and `if: needs.local-gate.outputs.waived == 'true'`.
- `environment: local-gate-waiver`. Dawid configures this environment with himself as the required reviewer, so the run waits for his click.

**Job `release`:**

- `needs: [ci, local-gate, waiver-approval]`.
- `if: ${{ !cancelled() && needs.ci.result == 'success' && needs.local-gate.result == 'success' && (needs.waiver-approval.result == 'success' || needs.waiver-approval.result == 'skipped') }}`. The explicit `if` is required: without it, a skipped `waiver-approval` would skip the release too.
- `permissions: contents: write`.
- Steps:
  1. checkout;
  2. "Check the tag, the stamps and the notes": `node tools/check.mjs stamps notes --release "$TAG"`, with TAG from env. This replaces lines 60-109.
  3. Lines 111-158 unchanged: build, point the manifest, create the release, show latest.

**Hardening:** new steps take `inputs.*` through `env:` rather than `${{ }}` inside `run:`. The old steps interpolate `inputs.tag` at lines 63, 80-81, 119 and 136-157; moving those too is optional.

## 8. The local gate: audit/gate/local-gate.mjs

**Usage:** `node audit/gate/local-gate.mjs [--parts live,sandbox,drills] [--merge] [--dry-run]`

**Environment variables:**

- `DRPG_SANDBOX_URL` - default http://localhost:30099. Loopback hosts only.
- `DRPG_SANDBOX_WORLD` - the only world id the runner may write to. It must also match `/(gate|copy|qa)/i`, because tier 2 writes. This is D26/E58's "never on Dawid's server" enforced as far as a script can.
- `DRPG_SANDBOX_USERS` - default `{gm:"GM", p1:"PlayerOne", p2:"PlayerTwo", p3:"PlayerThree"}`.
- `DRPG_FIXTURES`, `DRPG_GATE_KEY` and `PLAYWRIGHT_BROWSERS_PATH`.

Playwright is loaded through `createRequire(REPO/audit/harness/package.json)`.

It refuses to write anything (exit 2) when:

- this is not a git checkout;
- `git status --porcelain` is not empty for the bound paths;
- module.json cannot be read.

It writes the file (exit 0) whatever the verdict, and prints a table.

**Parts:**

- **Live** - three fixed parts, on a copy of a world:
  - live-stained-glass and live-monokuma-legacy: set the client setting `danganronpa-rpg.theme`, reload, run tier 2 with the D25 confirmation, and collect `{ passed, failed, skipped, text }`.
  - live-world-diff: `worldDump()` (S17-04) before the first run and after each run, written as one JSON file per document into audit/gate/.work/before and .work/after, then `diff -rq` over those folders. Only the paths that differ go into the evidence, so no world content does.
  - A raw `diff -rq` of the world's LevelDB folders (Foundry's world store since v11) would differ after any write, even a perfect restore, because LevelDB appends to its log and compacts. So the brief's "empty diff -rq" is implemented over per-document dumps.
  - GM plus three players are logged in; the players stay idle.
  - The previous theme of each client is restored afterwards.
- **Sandbox** - one part per scenario whose layers include "local". They run through audit/live/sandbox-cluster.mjs, which has the same API as cluster.mjs (gm/p1/p2/p3 eval, check, settle, repoUrl = "/modules/danganronpa-rpg"). audit/live/page-hooks.js is added through addInitScript and provides the `__*` hooks the scenarios use: `__notifications`, `__errors`, `__missingI18n`, `__dialogAuto`, `__dialogLog`, `__forceRoll`.
  - The world must be harness-shaped: audit/live/seed-world.mjs creates the lib/seed.mjs documents with `keepId`, and refuses a world that already has any documents.
  - In E30 the only honest candidates are 11-killer-secrecy, 14-quiet and 60-ledger, which use no harness-only hook. Other scenarios join when the adapter provides their hooks.
- **Drills** - scenarios with `export const fixture = "<name>"`, using `DRPG_FIXTURES/<name>/fixture.json` plus the world directory.
  - They run after the sandbox has been restarted on a copy of that fixture, with `--parts drills --merge`.
  - For private fixtures only check names and verdicts are kept (E38: "results without quoting content").

**Reason codes for not-run** (`REASONS` in gate-lib.mjs):

| Code | Meaning | Waivable |
| --- | --- | --- |
| no-server | Nothing answered at the URL | yes |
| no-world | The server answered but is at setup; the runner never logs into setup | yes |
| wrong-foundry | The server is not 14.x | yes |
| no-fixtures | `DRPG_FIXTURES` is unset, or does not contain the named fixture | yes |
| not-a-copy | The world is not an allowed copy | no |
| password-required | An account needs a password; the runner never types one | no |
| stale-module | The files the sandbox serves differ from this commit. Every scripts/, styles/ and lang/ file and module.json is fetched from /modules/danganronpa-rpg/... and hashed. | no |
| no-playwright, no-browser | The runner's own dependencies are missing | no |
| adapter-missing | The scenario needs a hook the sandbox adapter lacks | no |

**Statuses:**

- passed;
- failed - the module's checks failed;
- error - the runner broke: an exception, a timeout or a page crash;
- not-run - with a reason code.

**Probe:** GET `<url>/api/status` with a 3 s timeout. The raw body (at most 2 KB) and any error go into evidence/probe.json. The field names are recorded on the first real run, not assumed.

**audit/gate/local-gate.json** - written only by the script. This is what it would write in this container:

```json
{
  "schema": "drpg-local-gate/1",
  "writtenBy": "audit/gate/local-gate.mjs",
  "module": { "id": "danganronpa-rpg", "version": "1.2.61" },
  "commit": "<40-hex HEAD at run time>",
  "bound": { "scripts": "<tree id>", "styles": "<tree>", "lang": "<tree>", "fonts": "<tree>", "icons": "<tree>",
             "module.json": "<blob>", "audit/gate/local-gate.mjs": "<blob>", "audit/gate/gate-lib.mjs": "<blob>",
             "audit/live": "<tree>", "audit/harness/lib/seed.mjs": "<blob>",
             "audit/harness/scenarios/11-killer-secrecy.mjs": "<blob>" },
  "startedAt": "2026-09-25T08:00:00.000Z", "finishedAt": "2026-09-25T08:00:03.412Z",
  "host": { "node": "v22.22.2", "platform": "linux-x64", "playwright": "1.56.1" },
  "sandbox": { "url": "http://localhost:30099", "reachable": false, "error": "connect ECONNREFUSED 127.0.0.1:30099",
               "foundry": null, "world": null, "system": null, "systemVersion": null, "served": null },
  "fixtures": { "dir": null, "why": "DRPG_FIXTURES is not set" },
  "parts": [
    { "id": "live-stained-glass", "layer": "live", "status": "not-run", "reason": "no-server",
      "why": "nothing answered at http://localhost:30099 (connect ECONNREFUSED 127.0.0.1:30099)", "evidence": [] },
    { "id": "live-monokuma-legacy", "layer": "live", "status": "not-run", "reason": "no-server", "why": "...", "evidence": [] },
    { "id": "live-world-diff", "layer": "live", "status": "not-run", "reason": "no-server", "why": "...", "evidence": [] },
    { "id": "sandbox-11-killer-secrecy", "layer": "sandbox", "status": "not-run", "reason": "no-server", "why": "...", "evidence": [] },
    { "id": "drill-<name>", "layer": "drill", "fixture": "<name>", "status": "not-run", "reason": "no-fixtures",
      "why": "DRPG_FIXTURES is not set", "evidence": [] }
  ],
  "counts": { "passed": 0, "failed": 0, "error": 0, "notRun": 5 },
  "verdict": "incomplete",
  "digest": "sha256:<hex of canonical JSON without digest and hmac>",
  "hmac": null
}
```

A part that ran carries more fields:

```json
{ "status": "passed", "theme": "stainedGlass", "ranAt": "...", "ms": 241000,
  "summary": { "passed": 305, "failed": 0, "skipped": 3 },
  "env": { "foundry": "14.365", "systemVersion": "2.10.5", "module": "1.2.61", "world": "drpg-qa-f1-gate", "renderer": "<WebGL renderer string>" },
  "evidence": [ { "path": "audit/gate/evidence/live-stained-glass.txt", "sha256": "<hex>", "bytes": 41234 } ] }
```

**verdict:**

- passed - every part passed;
- failed - any part failed or errored;
- incomplete - otherwise.

**Evidence:** audit/gate/evidence/ holds only the current version's files. The script clears it unless `--merge` is given, and git keeps the history.

- Text evidence begins with a header, then `---`, then the verbatim `runTests().text`:
  - line 1: `drpg-evidence/1 <part-id>`
  - line 2: `module <v> | commit <sha> | foundry <x> | daggerheart <y> | world <id> | theme <t> | renderer <r>`
  - line 3: `started <iso> | finished <iso>`
- JSON evidence has the shape `{ evidence: "drpg-evidence/1", part, env, body }`, where `body` is the results JSON or the diff.
- With `--merge`, the script requires the same schema, version, commit and bound ids. It replaces only the parts it ran and rewrites counts, verdict, digest and hmac.

**Signing:** `hmac = "hmac-sha256:" + HMAC(DRPG_GATE_KEY, canonical)` when that variable is set; otherwise `null`. The key is never printed or written.

**gate-lib.mjs**, shared by the writer and the verifier so the two cannot disagree, exports:

- `SCHEMA`, `BOUND`, `REASONS` and `NO_WAIVER = ["1.3.0"]`;
- `canonical(obj)` - sorted keys, no whitespace;
- `digestOf` and `hmacOf`;
- `boundIds(rev)` - via `git rev-parse <rev>:<path>`;
- `compareVersions` - numeric;
- `shipped` and `requiredBecause`;
- `parseEvidenceHeader`;
- `SUMMARY_RE = /^(\d+) passed, (\d+) failed, (\d+) skipped$/m` - runSuite's line at tests.mjs:14982;
- `verdictOf`.

## 9. verify-gate.mjs (release.yml; `--self-test` in CI)

The verifier applies these rules in order. Each refusal says what to do next.

1. The tag equals "v" + module.json's version.
2. audit/gate/local-gate.json exists and its schema matches. Otherwise: "run node audit/gate/local-gate.mjs on the release commit".
3. `module.version` equals the version.
4. The digest matches. Otherwise: "edited after the script wrote it".
5. If `DRPG_GATE_KEY` is non-empty, the hmac must be present and valid. If it is empty, the job summary warns that the file is unsigned.
6. `git merge-base --is-ancestor <commit> HEAD` holds.
7. Every bound id equals `git rev-parse HEAD:<path>`. Otherwise the refusal lists `git diff --name-only <commit> HEAD -- <paths>`, and the gate must run again. Release notes and docs are not bound.
8. The dates are consistent:
   - `startedAt <= finishedAt <= now + 5 min`;
   - `finishedAt` is at or after the committer date of `commit`.
9. Each part that passed, failed or errored:
   - has its evidence files, with matching sha256;
   - has numbers, re-derived from its evidence, that equal the JSON's;
   - for live parts, has a header module version equal to the version, a foundry version equal to module.json `compatibility.verified`, and a daggerheart version equal to the system's `verified`. This makes CLAUDE.md Releasing step 4 a check. Today's manifest says 2.6.5, while the plan's sandbox runs 2.10.5.
10. Any part failed or errored: refuse, always.
11. **Required** is true when any of these holds:
    - the version is 1.3.0;
    - the stage's `touches` in stages.json intersects {sockets, rolls, scenes};
    - a runtime file under scripts/ (other than tests*.mjs) changed since the previous `v*` tag and matches the detector:
      - sockets: `/game\.socket|"module\.danganronpa/`
      - rolls: `/new Roll|DualityRoll|\.evaluate\(|Roll\.create|rollMode|dice3d/`
      - scenes: `/canvas\.scene|game\.scenes|TokenDocument|updateToken|createToken|\.regions|Region/`

    The detector flags 50 of the 107 runtime scripts at 411d4da.

    Required parts are all live parts, all sandbox parts, and the drills stages.json names for the stage.
12. **Required and a required part not-run:** refuse, unless every one of these holds:
    - the version is not in `NO_WAIVER`;
    - every not-run reason is waivable;
    - `--waiver` equals the tag;
    - audit/gate/waivers/vX.Y.Z.md exists, and its "Parts not run:" line lists exactly the not-run parts. It is added by a commit whose author is in the repository variable `DRPG_WAIVER_AUTHORS`, when that is set;
    - the notes' "## Checked" section has a line starting "- Not checked in a real Foundry" (the phrasing 1.2.59's notes already use);
    - the environment `local-gate-waiver` exists with at least one required reviewer. An environment used before it is configured is created without protection, so the verifier must see the reviewer. Whether GITHUB_TOKEN may read that is to be confirmed on the first waiver; if it cannot, the waiver is refused.

    When all of these hold, write `waived=true` to `$GITHUB_OUTPUT`.
13. **Not required:** not-run parts pass but are listed. Failed parts still refuse.
14. **Summary:** a table of the parts, the reasons local-gate was required, and the open waivers - files in waivers/ newer than the last passed gate, found through `git log` on local-gate.json.

**Self-test** (the `gate` part of CI) builds a throwaway repository with `git init` and uses the real writer. These cases must hold:

- good file: pass;
- status flipped: refused by the digest;
- digest recomputed but no evidence: refused;
- evidence edited: refused;
- runtime file changed afterwards: refused;
- version bumped afterwards: refused;
- `finishedAt` in the future, or before the commit: refused;
- required with a part not-run and no waiver: refused;
- the same with a complete waiver: waived;
- a waiver for another tag: refused;
- a waiver at 1.3.0: refused;
- a failed part with a waiver: refused;
- a non-waivable reason: refused;
- key set but file unsigned, or wrong hmac: refused;
- 1.2.100 compared with 1.2.99: numeric.

Waiver file format (written by Dawid, never by an agent):

```
# Local gate waiver - v1.2.61
Decided by: Dawid, <date>
Parts not run: live-stained-glass, live-monokuma-legacy, live-world-diff, sandbox-11-killer-secrecy, drill-<name>
Why: no Foundry v14 sandbox or licence where the gate ran (audit/gate/local-gate.json)
Owed by: the first release after a sandbox exists, and before 1.3.0 in any case
```

## 10. What the gate can and cannot prove here, and the honest policy

**What can be proven here**, with no v14:

- The whole ci layer: lint, check, the gate self-test, the suite and the ci scenarios - locally in about 5 minutes and on Actions.
- That the verifier refuses every form of missing, stale, edited, unsigned or wrongly waived file.
- That local-gate.mjs records, on this machine, every live and sandbox part as not-run (no-server, ECONNREFUSED on :30099) and the drill as not-run (no-fixtures), with the verdict incomplete, bound to the commit.

**What cannot be proven here:**

- Anything the local gate exists for.
- That the live runner, the sandbox adapter, the page hooks and seed-world work at all. They ship having never run against v14. The first real run will find their bugs, and the status `error` keeps "the runner broke" apart from "the module failed".

**The honest policy:**

- The plan's rule (D47) stands. Any release that touches sockets, rolls or scenes, and 1.3.0 always, is refused when a required part did not run.
- The only way through is an explicit decision by Dawid. E59 already allows for one ("albo z jawną decyzją Dawida"). A script cannot make that decision by itself, because it takes all of these:
  - a waiver file under his identity;
  - the tag typed again in the dispatch;
  - an approval click in the protected environment;
  - a "Not checked in a real Foundry" line in the notes, so players are told too.
- A waiver never covers a failed or errored part, never a fault of the gate itself (password-required, stale-module, not-a-copy, no-playwright, no-browser, adapter-missing), and never 1.3.0.
- Waived parts show as debt in every later release summary. 1.3.0 needs verdict passed on the candidate.
- CLAUDE.md must say that an agent never writes a waiver file or fills the waiver input; it asks Dawid.

**Consequences Dawid must be told:**

- 1.2.61, E30's own release, is required: scripts/remnants.mjs changes for the migrateRemnants fix (sockets and scenes), and the brief also wants that fix drilled on an old-world copy first. It is therefore refused here unless he waives it.
- E31 and E04 will be in the same position.
- Without a sandbox, every such stage needs a waiver.
- The v1.2.56 perf baseline also needs that sandbox before E04 migrates the world, or a pre-E04 world copy kept aside as a fixture.
- His choice: provide Foundry v14 and a licence for a sandbox at :30099, or waive each release knowing that 1.3.0 cannot ship without a full pass.

## 11. Documentation and configuration edits

- **CLAUDE.md "Running things"** (lines 29-48):
  - Rows: `npm test` (the one command, about 5 min), `npm run quick` (lint, check and gate, about 10 s), `npm run lint`, `npm run check`, and "The local gate, on a machine with a v14 sandbox at :30099: `npm run gate:local`".
  - "The harness, first time" now reads: installs jsdom, ESLint, espree and Playwright (no browsers).
  - "The Polish file" reads "N/N, 497 on 24.09".
  - Mention that a scenario exits non-zero on a red check since E30.
- **CLAUDE.md "Releasing"** (lines 157-178):
  - Steps 1-3 point to `node tools/check.mjs stamps notes --release vX.Y.Z`.
  - New steps: bump; run the local gate on the bumped commit; commit local-gate.json and the evidence; merge only on green CI; dispatch.
  - The waiver rule.
  - A new section "The gate, both layers", listing the steps of each layer (doneWhen).
- **CONTRIBUTING.md:**
  - Lines 3-6: the module still installs nothing, but the tests do (`npm ci` in audit/harness).
  - Lines 15-32 become `cd audit/harness && npm ci && npm test`, "about five minutes (suite 3, scenarios 2, lint and check 10 s; measured 24.09)".
- **audit/README.md:** describe gate/, live/ and results/ as they now are.
- **scripts/chrome.mjs:130:** write the class with `U+2013U+2014` escapes.

## 12. How the implementer proves it

1. Run `npm test` locally, before and after the change. Record each part's time and the maxRSS readings.
2. Make one scenario check fail on purpose. `cluster.mjs` must exit 1, and run-all must be red.
3. Create throwaway branches and run ci.yml on each through workflow_dispatch:
   - e30-mut-handler: drop the ownsActor guard in one GM_HANDLERS entry. Expect suite red (R1b, R134, R138, as mutA on 24.09) and 30-security red.
   - e30-mut-dash: put U+2013 into one pl.json value. Expect check red.
   - e30-mut-name: delete observe.mjs's rankForObserve import. Expect lint red.
   - e30-mut-exit: invert one check in 14-quiet. Expect the scenarios job red.

   Record the run URLs in the "Checked" section of the 1.2.61 notes, then delete the branches.
4. Run `npm run gate:local` here. Every part should be not-run and the verdict incomplete. Then `node audit/gate/verify-gate.mjs --tag v1.2.61` should refuse and name remnants.mjs as the reason.
5. Dispatch ci.yml three times on one commit before relying on it, and record the durations, memory and any flakes.