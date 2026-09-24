# E30 implementation plan: one branch, ordered commits

This plan was written read-only against e03v at 411d4da. Nothing was edited and the harness was not started. Every "expected" number below is either the 411d4da baseline from the val-e03f log or a prediction marked as one. The implementer measures each one and records it in the commit message.

## 0. Ground rules for every commit

### Base
- Branch `e30-test-foundation` starts from `main` at the v1.2.60 (E03) release commit. Nothing else that edits `scripts/tests.mjs` may be in flight.
- At 411d4da E03 is not tagged: `module.json` says 1.2.59 and there is no `v1.2.6*` tag.
  - If v1.2.60 is still missing when work starts, see decision Q1.

### The verification protocol "V", run before and after each commit
Set `S=<scratch>/e30run`.

- **Suite:** `cd audit/harness && node cluster.mjs scenarios/01-runtests.mjs > $S/cNN-01a.log`, run twice (a and b), because tier 2 depends on timing.
- **Scenarios:** `for n in 00 10 11 12 13 14 15 20 30 40 50 60; do node cluster.mjs scenarios/$n-*.mjs > $S/cNN-$n.log; done`
  - From C7 on, add 17. From C20 on, add 72.
- **Compare suites:** `node audit/harness/suite-diff.mjs <before> <after> [--rename map.json]`. The tool is added in C0.
  - Exit 0 means the same tests, order, statuses and reasons.
  - Exit 2 means not comparable (the 30,000-character cut).
- **Read scenario results from the `[cluster] X/Y checks passed` line, not the exit code, until C3a.**
  - cluster.mjs:428-429 exits 0 even with red checks: the gate reader's probe exited 0 in 5 of 5 runs.
  - The registries reader believed 11 and 40 exit 1 today. The gate reader's measurement wins, and C3a proves it either way.
- **Results files:** until C3b, `git checkout -- audit/harness/results` before every commit, because runs rewrite tracked files (S14-23).
- **Commit message:** paste the before and after numbers. Explain every difference, or revert it.

### Baseline at 411d4da (val-e03f)
- **Suite:** 292 passed, 0 failed, 16 skipped; 308 result lines; 179.6 s.
  - Tier 0: 117 entries (116 ok, 1 skip).
  - Tier 1: 93 entries (86 ok including the purity line, 8 skip).
  - Tier 2: 97 entries (90 ok, 7 skip).
- **Scenarios:**

  | Scenario | Result | Note |
  | --- | --- | --- |
  | 00 | red | LIVEKITAVCLIENT keys; not in the val run |
  | 10 | 19/19 | |
  | 11 | 5/6 | S04-02, E06 |
  | 12 | 10/10 | |
  | 13 | 20/20 | |
  | 14 | 7/7 | |
  | 15 | 9/9 | |
  | 20 | 3/3 | |
  | 30 | 66/66 | |
  | 40 | 37/38 | S02-11/S10-05, E05 |
  | 50 | 43/43 | |
  | 60 | 14/14 | |

## 1. Where the five specs disagreed, and what this plan fixes

### R1. R numbers
Commit order decides. The next free number is R151, and R113-R124 stay reserved. Tier-2 scenarios are named, never numbered, so the harness reader's two tier-2 "R152/R153" tests become named tests.

| R | Commit | Tier | Test |
| --- | --- | --- | --- |
| R151 | C2 | 0 | The second R21 (tests.mjs:2000, "the chapter ends by closing the trial..."), renumbered |
| R152 | C5 | 0 | No update deletes or replaces a key with the old '-=' / '==' spelling, which v14 ignores |
| R153 | C7 | 1 | An Assistant's relay packet is judged like a player's |
| R154 | C12 | 0 | The runner keeps the test author contract (KIT_SELF_TESTS) |
| R155 | C12 | 0 | Every expectedRed names a stage that has not shipped; the DUMP_RULES `until` clause is added in C15 |
| R156 | C14 | 0 | No test cuts the source it reads with a bare indexOf |
| R157 | C14 | 0 | No assertion is true by construction |
| R158 | C14 | 0 | needs() is asked only of a probe |
| R159 | C15 | 0 | worldDump reads every kind of write the module makes |
| R160 | C18 | 0 | Every way a player reaches the GM belongs to a flow |

If a commit is reordered, renumber at that time. `tools/registry.mjs --write` and the `registry` check are the arbiters.

### R2. `tools/stages.json`, one schema for three readers

```json
{ "$comment": "...", "plan": "v2 (D20)", "stages": [
  { "id": "E01", "planned": "1.2.57", "version": "1.2.57", "shipped": "2026-09-24", "touches": null, "drills": [] }, ... ] }
```

- It has 60 rows in STATE.md / plan-v2 order: E01 E27 E02 E03 E30 E31 E04 ... E59 E26.
- `planned` follows D20: E01 = 1.2.57 through E59 = 1.2.115, and E26 = 1.3.0.
- **The one "shipped" rule, used by the suite kit, cluster.mjs and verify-gate:**
  - A stage has shipped when `version` is non-null and module.json's version is at or past it.
  - The comparison is numeric, because 1.2.100 arrives with E45.
  - `node tools/stages.mjs ship EXX` is the only writer. It runs in the release commit and sets `version` from module.json and `shipped` to the UTC date.
  - `planned` is information only.
- `touches` is a list or null (gate). `drills` is a list (gate).

### R3. Harness check() and verdicts
- **Signature:** `check(name, ok, details = "", opts = {})`, with these options:
  - `flow`;
  - `knownLeak: "<id>"`;
  - `expectedRed: { stage, why }`;
  - `measured: boolean`, required with either of the two above.
- **Statuses:** `pass`, `fail` or `expectedRed`.
  - An unexpected pass, a shipped stage ("overdue"), an unknown id or `measured !== true` is a `fail`, and `result.reason` names which.
- **Results JSON counts:** `{passed, expectedRed, failed, total}`.
- **Exit code:** 1 if and only if `failed > 0`; 2 for a refused layer; 3 for fatal.

### R4. Scenario layers
- Every scenario has `export const layers = [...]`, a subset of `["ci", "local-gate"]`.
- Probes live in `audit/harness/probes/` with `export const layers = ["probe"]`.
- Read by regex: `/export const layers = (\[[^\]]*\])/`.

### R5. Suite files
There are seven flat `scripts/tests*.mjs` files, all excluded by `otherSources()` through `!/^tests(-[\w-]+)?\.mjs$/`:

| File | Holds |
| --- | --- |
| `tests.mjs` | The runner and the only export, `runTests` |
| `tests-kit.mjs` | Shared tools |
| `tests-tier0.mjs`, `tests-tier1.mjs`, `tests-tier2.mjs` | The three test lists |
| `tests-lint.mjs` | Pure detectors, no imports; Node imports it |
| `tests-flows.mjs` | FLOWS, no imports |

See Q4.

### R6. Node checks
- One entry point: `tools/check.mjs [part ...] [--release vX.Y.Z]`.
- The `contract` part imports `scripts/tests-lint.mjs`.
- The `registry` part imports `tools/registry.mjs`, which also has a `--write` CLI.
- There is no separate contract-check.mjs or registry-check.mjs.

### R7. Tier 2 confirmation
- `runTests({ tier: 2, confirmed: game.world.id })`. The string must equal this world's id; anything else, `true` included, opens the window.
- The gate reader's `confirmed: true` is dropped.

### R8. Tier 2 in CI
CI runs tier 2 on the disposable harness world. The brief's "tier 0-1" is the floor (Q3).

## 2. The commits, in order

### Phase A - tools and the pure move

**C0 `audit/harness: suite-diff compares two suite runs test by test`**
- **Files:** new `audit/harness/suite-diff.mjs`, copied from scratchpad `e30split/suite-diff.mjs`.
  - It parses the SUITE OUTPUT block into ordered `(tier, status, name, reason)` records.
  - Exit 2 when passed + failed + skipped does not equal the printed lines.
  - `--rename map.json`.
  - A `--json` mode is added in C12.
- **Verify:**
  - `node suite-diff.mjs A A` exits 0.
  - val-e03a against val-e03f reports the 5 status changes.
  - A cut log exits 2.
  - V is unchanged: 292/0/16.

**C1 `Split the suite into tests-kit and three tier files (pure move)`**
- **Files:** `scripts/tests.mjs`, reduced to about 262 lines, plus new `scripts/tests-kit.mjs` (about 484), `tests-tier0.mjs` (about 4,888), `tests-tier1.mjs` (about 3,015) and `tests-tier2.mjs` (about 6,386).
- **Change:** exactly the split spec's section 1 line map. Each declaration stays byte-identical.
  - The only body that changes is `otherSources()` (tests.mjs:274-278). Its filter becomes `!/^tests(-[\w-]+)?\.mjs$/.test(file)` and its one-line doc changes with it.
  - `STANDING` and `cast()` move to the kit.
  - The runner stays in tests.mjs, which exports only `runTests`, so `api.mjs:1048` is unchanged.
  - All specifiers are flat, double-quoted `"./tests-kit.mjs"`, with no query string. This matters for `instanceof Skipped`.
  - Import order as in the prototype, so the crawl order of `otherSources()` does not change.
  - One short header per new file. The tier-2 header restates "fixtures built and put back ... never run it in a world somebody is playing in".
- **Verify:**
  - `node $SCRATCH/e30split/verify-split.cjs <parent checkout> scripts`. All checks green:
    - free names are a subset of the 39 old globals, and no import is unused;
    - 44 of 45 declarations are identical;
    - 117/93/97 entries are identical and in order;
    - the crawl reaches 112/112;
    - `otherSources()` returns the same 107 files in the same order.
  - V: suite-diff gives 0 differences, 292/0/16 twice. Scenarios are not affected (no scenario imports the suite), but run 00 and 10 as a smoke test.
  - Record in the commit: "headless proves the 16 skipped bodies only statically".

**C2 `Suite hygiene after the split: R21 twice, one separator, stale counts (S14-25)`**
- **Files:** the tier files, the kit, tests.mjs, `api.mjs:1040`, `action-rolls.mjs:70`, `diagnostics.mjs:694,931-934`, `gm-bridge.mjs:1755`, `CONTRIBUTING.md:52`, `01-runtests.mjs:36`, `docs/design/typography.md:6`, `13-murder-signals.mjs` (drop the repeated comment at 168-175).
- **Change:**
  - The second R21 becomes R151.
  - All 27 " · " names become "R<n> - ...".
  - Delete the first `runTests` JSDoc block.
  - Stale numbers, from the split spec's section 6 table (measure each again): 108/112 files, 117 tier-0 tests, 16 socket files. Also "once per run" becomes "once per page load".
  - Fix the moved references: header 22, 1510, 3865, 324, and the stray "," at 6729.
  - LITERAL_KEYS keeps its 7 runtime-assembled keys and drops `Murder.betrayTileLabel/Hint`, with its comment corrected.
  - Suggest `only` exact matching in C12, not here.
- **Verify:**
  - V with `suite-diff --rename e30-c2-renames.json`: exactly 28 name changes, and 0 status or order changes. 292/0/16.
  - `grep -c '"R21 ' scripts/tests-tier0.mjs` returns 1.

### Phase B - harness plumbing (no result change except the ones named)

**C3a `harness: exit non-zero on a red check, and reap every client`**
- **Files:** `audit/harness/cluster.mjs`, `client-entry.mjs`.
- **Change:**
  - `process.exitCode = results.some(r => !r.ok) ? 1 : 0` before the shutdown loop. The 400 ms timer stays as a hard stop.
  - Clients: `process.on("disconnect", () => process.exit(0))`.
  - Cluster: `process.on("exit", ...)` kills every live child; this also covers the fatal path at 432.
  - Clients send `bye` with `process.resourceUsage().maxRSS`. The cluster waits at most 300 ms, and the results JSON gains `resources`, `startedAt` and `finishedAt`.
- **Verify:**
  - A scratch copy with one inverted check in 14-quiet exits 1.
  - 11 and 40 now exit 1; this is intended, they are the known leaks.
  - The others exit 0.
  - After a forced fatal, `pgrep -f client-entry.mjs | wc -l` returns 0.
  - V numbers are identical.

**C3b `harness: results out of git, probes out of the numbers, dead code gone (S14-23, S14-30)`**
- **Files:**
  - `.gitignore`: add `audit/harness/results/` and `audit/gate/.work/`.
  - `git rm -r --cached audit/harness/results`, which removes 19 files.
  - `git mv` scenarios 02-07 to `audit/harness/probes/`, keeping their names. They get `layers = ["probe"]`, and 07 writes to `results/probes/` instead of /tmp.
  - New `audit/harness/probes/README.md`, "Tools, not tests".
  - `layers = ["ci"]` on 00, 01, 10-15, 20, 30, 40, 50 and 60.
  - cluster.mjs:
    - read `layers` after the import;
    - missing layers FAIL with "no layers export";
    - "local-gate" only exits 2;
    - a probe prints a banner, writes to `results/probes/` and exits 0 unless it threw;
    - an `if (!results.length)` "measured nothing" check;
    - a `note(name, details)` API;
    - delete GM_ONLY_COLLS (106-107, 147) and add one comment line at 148.
  - `tools/pixel-icons.py:105`: delete.
  - 00-boot:
    - check only `DRPG.` keys, with foreign keys going into details;
    - line 25 becomes `note()`;
    - 23-26 becomes "no error-level notification during boot";
    - 19-20 checks the shape of getClock.
  - `12-social.mjs:9` becomes `forced === true`.
  - New `audit/harness/lib/seed.mjs`: cluster.mjs:34-102 moved verbatim.
  - `audit/README.md:20`.
- **Verify:**
  - Run `python3 tools/pixel-icons.py` on a scratch copy with and without line 105: `pixel-sprite.svg`, `pixel-icons.css` and `identity-audit-v13.html` are byte-identical, and equal to HEAD.
  - V:
    - 00 turns green; record its new check count.
    - 12 stays 10/10 (the check is now real).
    - The others are identical.
    - Suite 292/0/16.
  - `git ls-files audit/harness/results` is empty.

### Phase C - harness fidelity (S14-28, S17-01). The harness spec's order, one area per commit
Each commit adds its own "host is the Foundry it says it is" checks to 00-boot, its line in the new `audit/harness/README.md` section "What the harness cannot do" (created in C4), and its LIVE-E30-nn ids in `audit/AUDIT-1.2.42.md` section 9.2.

**C4 `harness: v14 operators; '-=' removes nothing and is reported`**
- **Files:**
  - New `audit/harness/lib/operators.mjs`: `WIRE`, `DataFieldOperator`, `ForcedDeletion`, `ForcedReplacement`, `isWire`, `isOperator`, `kindOf`, `replacementOf`, `revive`, `LEGACY`.
  - `lib/futil.mjs`:
    - deepClone, expandObject and flattenObject treat operators as leaves;
    - new `applyUpdate(target, changes, {onLegacyKey})`;
    - applyDocChanges (222-239) is built on it.
  - Every harness deletion site: cluster.mjs:183 and :210; client-entry.mjs:851, :885, :886; shim.mjs:258 and :265.
  - `shim.mjs:251-255`: unsetFlag becomes a `ForcedDeletion.create()` write.
  - Hooks receive `revive(...)` changes (shim.mjs:312-332, client-entry.mjs:839-898).
  - client-entry.mjs:772:
    - `foundry.data.operators`;
    - `globalThis._del`;
    - `globalThis._replace`.
  - cluster.mjs: `legacyKeys`, the `[harness] v14 ignores '-='` line, and `legacyKeysIgnored` in the results JSON.
  - 00-boot:
    - a `-=` write removes nothing and appears in legacyKeys;
    - `_del` and ForcedReplacement work on gm and on p1;
    - unsetFlag removes.
  - LIVE-E30-01, -02 and -03.
- **This must be ONE commit.**
  - Making `-=` a no-op without moving unsetFlag silently breaks 10 module sites and restore()'s revive.
  - Operators without futil support corrupt replaceFlag's bookmark, `{a:0,b:2,replacement:{a:1}}`.
- **Verify:**
  - V identical: 292/0/16, and scenarios as after C3b except 00's new checks.
  - `legacyKeysIgnored` is empty in every result, because the only module `-=` is migrateRemnants, which nothing runs.

**C5 `migrateRemnants deletes with ForcedDeletion and reads back; R152 forbids '-=' (S17-01)`**
- **Files:**
  - `scripts/utils.mjs`: new `export function forcedDeletion()` next to replaceFlag.
  - `scripts/remnants.mjs:1839-1899` becomes exported `migrateRemnantToken(token)` plus the loop:
    - no stale overwrite of a live ledger entry (S05-43);
    - separate `moved` and `filled` counts;
    - one write through forcedDeletion(), with unsetFlag per key as the fallback;
    - read back into `failed`;
    - the summary adds `filled` and `failed`.
  - Kit: `stringLiterals(code)`.
  - Tier 0: R152.
    - It scans `moduleSources()` including the tests* files.
    - The needle is assembled at run time.
    - It runs a positive-sample self-check.
    - A membership read `... in` is exempt (truth-bullets.mjs:1186).
  - Tier 2, named tests:
    - "a legacy trace loses its answer key when migrated, and a second run keeps the GM's corrections";
    - "a replaced flag keeps nothing of the old value, and an unset flag is gone".
  - LIVE-E30-07.
- **Verify, recording red before green:**
  - Apply the tests without the remnants.mjs/utils.mjs hunks.
  - Expect R152 to FAIL naming `remnants.mjs:1881` (the brief's ":1795" is the older line number; say so) and the migrate scenario to FAIL.
  - Apply the fix: 295 passed, 0 failed, 16 skipped, 311 lines.
  - Scenarios identical.
  - Paste both runs into the message.

**C6 `harness: an Assistant is a GM; accounts, opLog and disconnect`**
- **Files:**
  - `shim.mjs:617-630`: `isGM` is `hasRole("ASSISTANT")`, and hasRole resolves role names. An unknown name returns false.
  - cluster.mjs:
    - `roleOf`, and `isGM` at role 3 or more (110, 315);
    - a canWrite User clause before the GM shortcut (no escalation above one's own role; create/delete below role 4 refused);
    - the scenario module imported before spawnClient;
    - `accounts` export, with IDS.ag;
    - `opLog`, `settingLog`, `disconnect(who)`, and `userActivity` broadcast;
    - `entry.gone` skipped by broadcast and the relay;
    - socketTraffic records `action` and `to`.
  - client-entry.mjs: a `userActivity` case that fires `userConnected`.
  - 00-boot: isGM for roles 1-4 is `[false, false, true, true]`.
  - LIVE-E30-04 and -05.
- **Verify:**
  - V identical. The seed roles are 4 and 1; the only role writes are at 30-security:765/768/834.
  - 30 stays 66/66.

**C7 `relay-guard: only a full GM forwards unjudged; 17-assistant (D22 second pass)`**
- **Files:**
  - New `audit/harness/scenarios/17-assistant.mjs` with sections A1-A6, B1-B4, C4/C1/C2/C3 (in that order, with a finally block restoring role 3), D1-D4 and E, as in the harness spec's section 5. `layers = ["ci"]`.
  - `scripts/relay-guard.mjs:250` (neutralise) and `:297` (onRelay): forward unjudged only when `sender.role === CONST.USER_ROLES.GAMEMASTER`. An Assistant goes through `judgeRelay`.
  - Tier 1: R153.
  - LIVE-E30-06.
- **Verify, recording red before green:**
  - Run 17 without the relay-guard hunk: C2 and C3 red (predicted), and the rest green by reading.
  - With the fix: 17 all green. Suite 296/0/16; 30 at 66/66; 12, 13 and 40 identical.
  - If Q2 is answered "not in E30": C2 and C3 carry `expectedRed: {stage: "E31", ...}` once C19 exists. Until then this commit states the red.

**C8 `harness: versions read from module.json and the installed Data folder`**
- **Files:**
  - New `lib/versions.mjs` (`readVersions(repo, env)`).
  - New `audit/harness/versions.json` (the shape in the harness spec's section 1.4).
  - client-entry.mjs:359-368 and 444-462 read from them.
  - Results JSON: `environment{foundry, system, modules[{id, version, from}], unconfirmed}`.
  - 00-boot: every version has `from`.
  - LIVE-E30-08.
- **Verify:** V identical. No test hard-codes these numbers (grep).

**C9a `harness: Daggerheart roll pipeline as 2.6.5 runs it (G1-G8, G10, G11)`**
- **Files:** client-entry.mjs:
  - the rollTrait mock (519-577);
  - ResourceUpdateMap (376-398);
  - the automation default shape at 254 and 458, which is the same object;
  - `CONFIG.DH.RESOURCE` at 678;
  - `createScrollingText`.
- **Seed:** `lib/seed.mjs` states `hopeFear: {players: true, gm: true}`, with a comment that Daggerheart's own default is false.
- **Predicted:**
  - The reroll.mjs:127 TypeError disappears.
  - The "resource tables are not built" warning disappears.
  - 20 stays 3/3 only with G1 and the stated automation.
  - Suite unchanged.
- **Verify:** V. Explain any difference in 10, 12, 13, 20 or 40.

**C9b `harness: a player's Daggerheart writes go through the GM relay (G9)`**
- **Files:** client-entry.mjs, a modelled `modifyResource` that emits `DhGMUpdate`/`DhGMUpdateFear` for a non-GM.
- **Predicted to move:** relay traffic in 12, 13, 40 and 10; Fear notes (FEAR_STEPS_NOTED) change notification and whisper counts in 13 and 40.
- **Fix in the same commit:** add `settle()` where a read follows a player roll. A count that changes because a real relay hop now happens is updated in the check, with the reason quoted.
- **Verify:** V, and re-run 30-security (D22). Every moved count is explained line by line.

**C10 `harness: the six stylesheets attached as v14 attaches them`**
- **Files:**
  - client-entry.mjs:25-29 uses a jsdom `requestInterceptor` serving `/modules/danganronpa-rpg/*` from REPO, and 404 for everything else.
  - Delete client-entry.mjs:115-150.
  - Boot awaits `attachModuleStyles`, and an incomplete attach is a boot failure.
  - New `lib/css.mjs` (`moduleStyleImports`, `attachModuleStyles`, `substituteVars`, `wrapGetComputedStyle`).
  - 00-boot: 6/6 sheets in manifest order, layerName "modules", and body `--drpg-window-max` is "1400px".
  - LIVE-E30-09.
- **Predicted:**
  - `--drpg-window-max` 1700 becomes 1400, and `--drpg-scale-in` 1 becomes 0.96.
  - Glass tokens resolve.
  - Standard properties come back with `var()` unresolved at the 49 module sites and 22 suite sites.
  - The 16 skips hold, because cascadeAvailable and layoutAvailable stay false.
  - 01 wall time grows by roughly 1 s per client plus 1 ms per getComputedStyle.
- **Verify:** V. Every suite or scenario difference is explained.
  - If one cannot be explained, switch to fallback C: keep today's standard properties and resolve only `--x` over the CSSOM.
  - Record the 01 wall time.

### Phase D - the author contract (S17-03, S17-04, S17-06, S14-24)

**C11 `tools/stages.json and tools/stages.mjs: the stage ledger`**
- **Files:**
  - New `tools/stages.json`, as in R2. E01, E27 and E02 carry the tag dates, 2026-09-24. E03 carries the v1.2.60 tag date, or null if it has not shipped.
  - New `tools/stages.mjs` with `loadStages`, `moduleVersion`, `compareVersions`, `stageStatus`, `redVerdict`, and the CLI `check`, `check --release vX.Y.Z` and `ship EXX`.
- **Verify:**
  - `node tools/stages.mjs check` exits 0.
  - `node -e` shows compareVersions("1.2.100", "1.2.99") > 0.
  - `ship` refuses an already-shipped stage.
  - V is not needed; no runtime file changes.

**C12 `Suite runner: an assertion counter, must(), expectedRed and the red count`**
- **Files:**
  - The kit:
    - `Precondition` and `Skipped(message, probe)`;
    - `ok` and `equal` count into `current`, and `must()` is new;
    - `bodyOf` uses must();
    - `runOne` and `judge` (the contract spec's section 5, verbatim);
    - `expectedRed(stage, why, {failing})` as the third tuple element;
    - `stageLedger()`, which fetches `tools/stages.json`; null means "checked at release, not here";
    - `KIT_SELF_TESTS`.
  - Local helpers `between` (5725) and `caseOf` (5768) become `bodyOf(..., {until})`, and `read`'s `ok(r.ok)` becomes must().
  - tests.mjs:
    - runSuite uses runOne;
    - return `{passed, failed, skipped, red, text, results[]}`;
    - `only` matching an R number exactly (`/^R\d+[a-z]?$/`), so that "R15" no longer matches R150-R159.
  - Tier 0: R154 and R155.
  - `01-runtests.mjs`: store `results` in its JSON. `suite-diff --json` reads that, so the 30,000-character cut no longer matters.
  - `lib/seed.mjs`: one stash with one stashed item.
- **Predicted:** without the seed, the invariants at 5439 and 5462 FAIL "measured nothing". 7591 (voice rooms) may too.
- **Fix in the same commit:** the stash seed. For 7591, find out why it counts 0 and seed the world so it measures. Never add a vacuous `ok`.
- **Verify:**
  - V: 298/0/16 and `red` 0.
  - The two re-measured `between` tests are still green.
  - Mutant by hand: an empty test FAILs "measured nothing". Revert it.

**C13 `Suite: needs() takes only env.* and world.* probes; cast(n) skips (S14-24)`**
- **Files:**
  - The kit: `PROBE`, `env` (10 probes), `WORLD` (a closed table of 11 rows), `world.atLeast/ownedByPlayer/moduleActive/settingRegistered`, the world-after-write rule, `needs()` with the brand check, and `cast(n)` using `needs(world.atLeast("livingStudents", n))`.
  - The 35 `needs()` calls, converted per the contract spec's section 3 map.
    - 8167 becomes `world.atLeast("fullGms")` plus an `ok` on monokumas().
  - The seven shadows (9313, 9439, 9516, 9630, 11091, 11800, 12451) become `cast(n)`.
  - The 40 world-composition `ok()` calls become `needs(world.*)`, keeping the module's own reading as an `ok` checked against the probe.
  - A tier-2 census line, and the summary line "skipped by probe: ...".
  - New `audit/harness/skip-baseline.json`: 16 env.* rows (layout 8, cascade 3, systemSheets 2, canvas 1, fonts 1, webAnimations 1).
  - `01-runtests.mjs:44`: the `<= 16` count becomes an exact match against the baseline, and a `world.*` skip is refused.
- **Verify:**
  - V: 298/0/16, and the skips equal the baseline exactly.
  - Compare which actors the seven scenarios pick, and quote any change.

**C14 `Suite: source is cut with the kit; R156-R158 and the contract check`**
- **Files:**
  - The kit: `lineAround(text, i)`, `bodyOf` options `{until, length, back}`, and `fnSource(src, name)`.
  - Convert the 61 cuts plus one split (the lists come from `cuts2.mjs --list`; idioms as in the contract spec's section 4).
  - New `scripts/tests-lint.mjs`, with no imports: `bareCuts`, `vacuousAsserts`, `needsArgs`, `redMarkers`, `testsIn`. Each detector runs on a fixture with known violations first.
  - The kit gains `suiteSources()`, which shares an `isSuiteFile` predicate with `otherSources`. The meta-tests assert they read every tier file and at least 307 entries.
  - Tier 0: R156, R157, R158.
  - New `tools/check.mjs` with the `contract` part only. It scans `scripts/tests-tier*.mjs` and `audit/harness/scenarios/*.mjs` (probes excluded) for `check(x, true|1|!0)` and `|| true` inside `check(`.
- **Predicted:** some formerly unguarded cuts (31 in tier 0, 5 in tier 1) now fail as a Precondition, because their end marker has moved. Each is a test that was reading the wrong span. Fix the marker in this commit, and name each one in the message.
- **Verify:**
  - V: 301/0/16.
  - `node tools/check.mjs contract` exits 0.
  - Planting `src.slice(src.indexOf("x"))` in a tier file turns R156 red, naming the file and line. Revert it.

**C15a `restore(): put back what the whole-world dump found left behind`**
- Found by running C15b's dump locally first. Each fix goes into `restore()` or the scenario's `finally`, with a quoted `describeDiff` line.
- Expected: unknown until measured, because the dump reads token positions, pause state, playlists and every flag namespace.
- If nothing is left behind, drop this commit.
- **Verify:** V unchanged.

**C15b `Suite: worldDump() judges tier 0/1 purity and every restore (S17-04)`**
- **Files:**
  - The kit: `worldDump`, `dumpDiff`, `describeDiff`, and `DUMP_RULES` with the six rows from the contract spec's section 6. Values from the `client:` ledgers are hashed.
  - Delete `worldFingerprint`, `fingerprintDiff` and restore()'s read-back loop.
  - `watchWrites` covers every collection and stays on through tier 2, setting `current.wrote`.
  - runSuite: the tier 0/1 dump diff; after each scenario, "could not restore ... restore left: <paths>"; a final pseudo-test "tier 2 put the world back as it found it".
  - Tier 0: R159, and R155 gains the DUMP_RULES `until` clause.
  - client-entry.mjs: `__harnessWorldState()`, and a `game.settings.storage.get("client")` view over clientValues.
  - `01-runtests.mjs` phases A1 and A2:
    - `runTests({tier: 1})` with an incident open, and inside a Class Trial;
    - the harness's own state is unchanged;
    - no `TIER 2` appears in the text.
- **Verify:**
  - V: 303/0/16. The tier-2 end pseudo-test is +1, R159 is +1.
  - A1 and A2 green.
  - By hand, remove restore()'s stray-Remnant deletion and run `only: "a direct murder opens on the killer"`: "restore left: ...tokens...". Revert it.

**C16 `runTests() reads by default; tier 2 asks in a window naming the world (D25, S17-06)`**
- **Files:**
  - tests.mjs:
    - `runTests({tier = 1, only, confirmed})`;
    - `confirmTier2`, with Cancel first and default;
    - `refused: "cancelled"`;
    - the header at 4-6.
  - `lang/en.json` and `lang/pl.json`: 9 `DRPG.Tests.*` keys. `tier2Online` needs `.one`/`.other`, and in Polish also `.few`/`.many`.
  - `01-runtests.mjs`:
    - A3: `runTests()` leaves `murderState()` null;
    - B: `__dialogAnswers` captures the window, whose title and content name the world title and id, `buttons[0]` is cancel and the only default, and the call returns refused;
    - C: `runTests({tier: 2, confirmed: game.world.id})`, with the timeout 240000 raised to 600000.
  - `probes/06-runtests-music.mjs`: `confirmed: game.world.id`.
  - `README.md:287-291`, `gm-handbook.en/pl.md:817-828`, `CLAUDE.md:33` and the four-numbers section, `CONTRIBUTING.md:37-40`.
- **Verify:**
  - V: 303/0/16 through C.
  - A3, B and C green.
  - `node tools/config-prose.mjs --check lang/pl.json` still reads 497/497.
  - R1 is green in the suite.

### Phase E - registries and the canary (S17-03 registry parts, S17-07)

**C17 `Registries: scenario numbers with layers, R numbers in CLAUDE.md`**
- **Files:**
  - `audit/harness/README.md`: the sections from the registries spec's section 1.4, and the table between `<!-- scenarios:start/end -->` with 00-85.
    - 15 stays 15-held.
    - 18-trial is added ("plan v2 calls it 15-trial").
    - 41-trial-scene is added.
    - 02-07 and 90 are retired.
  - The CLAUDE.md "Numbering new tests" rewrite, and a generated block at the end, `<!-- r-registry:start/end -->`, with the 70 grandfathered tier-1 names.
  - New `tools/registry.mjs` (`--write`; the rules for scenarios and R numbers), wired into `tools/check.mjs registry`.
  - A STATE.md alias line.
- **Verify:**
  - `node tools/registry.mjs --write`, then `node tools/check.mjs registry contract` exits 0.
  - One scratch mutation per rule shows its own line.
  - V is not needed.

**C18 `FLOWS: every way a player reaches the GM belongs to a flow; R160`**
- **Files:**
  - New `scripts/tests-flows.mjs`: FLOWS with the seed list of 28 ids from the registries spec's section 3.3, and FLOW_EXEMPT for gm-bridge.mjs and sync.mjs.
  - Tier 0: R160, reading GM_HANDLERS via `bodyOf`.
    - Floor: at least 30 actions and at least 10 listener files.
  - cluster.mjs: `phase(name, {flow})` tags checks, and the results JSON gets `flows`/`phases`.
  - The registry part validates FLOWS.
- **Verify:**
  - V: 304/0/16.
  - A fake `ACTION_X` in GM_HANDLERS on a scratch copy turns R160 red.

**C19 `harness: known leaks and expected reds are check options, not brackets`**
- **Files:**
  - cluster.mjs: the check options and verdicts from R3, and the summary `[cluster] 5/6 checks passed, 1 expected red (S04-02 until E06), 0 failed`.
  - New `audit/harness/known-leaks.json` (schema 1) with the two measured entries, S04-02 (closes E06) and S02-11 (closes E05).
  - 11-killer-secrecy.mjs:47-49 and 40-flow.mjs:120-121: preconditions split out, with `knownLeak` and `measured`.
  - Registry part: validate known-leaks and forbid "[known leak" in names.
- **Expected change:**
  - 11: 6/7 checks (one new precondition), 1 expected red, 0 failed, exit 0.
  - 40: 38/39, 1 expected red, exit 0.
- **Verify:**
  - Scratch copies:
    - `measured: false` FAILs;
    - `closes: "E02"` FAILs as overdue;
    - a deleted entry FAILs as unknown.
  - Run 11 and 40 three times each for flakiness (11 records a 1-in-4 timing miss under load).

**C20 `The secrets canary: what a player's browser holds, 72-canary, first triage`**
- **Files:**
  - client-entry.mjs: the WIRE recorder after line 16 (cap 50,000), a `dump` case, and `dumpForCanary()`.
  - cluster.mjs: console capture, `api.dump`, the eval marker guard, `canary.finish()`.
  - New `lib/canary.mjs` (`MARKER_RE`, `SEEDS`, `scanDump`, `matchLeak`, `validateKnownLeaks`, `createCanary`).
  - New `scenarios/72-canary.mjs` (ci): self-test, plant, rest.
  - 10-murder: the placeRemnant `note`/`subject` markers replace the dead `label`/`truth` (the check at 102-108 could not fail).
  - 11: a p3 pre-session note marker.
  - Phases in 13, 40 and 60.
  - known-leaks.json gets every reproduced hit, each with a finding and a closing stage.
  - README.md Privacy paragraph gets `<!-- leak:<id> -->` markers.
- **Expected:** new hits. The registries reader predicts keyRemnantPlan, projectMeta, daggerheart.Countdowns, the preSessionNote flag, pendingMurders, hidden tokens and unfound traces. Each needs an entry before this commit is green.
  - A leak of the killer's identity, the answer key, a plan or GM notes with no plan finding goes to Dawid (Q7).
- **Verify:**
  - 72: every surface seen, the deliberate self-test leak reported with phase and path, every seed found on the GM, 0 unmatched hits.
  - 10, 11, 13, 40 and 60 keep their check names apart from the listed ones.
  - Quote the hit table in the commit message, because results/ is not committed.

### Phase F - one command, CI, the two-layer gate (S17-05, D47)

**C21 `lint: no-undef over scripts, tools and the harness`**
- **Files:**
  - `audit/harness/package.json` from the gate spec's section 1: engines and devDependencies eslint 10.11.0, espree 11.2.0, jsdom 30.0.1, playwright 1.56.1 (no browser download). Regenerate the lockfile.
  - New root `eslint.config.mjs`, as in the gate spec's section 4, with listed globals and no `globals.browser`.
  - `.gitattributes`: `eslint.config.mjs export-ignore`.
- **Verify:**
  - `cd audit/harness && npm ci && npx eslint -c ../../eslint.config.mjs ../..` reports 0 problems. The file count should be about 135 plus the new files; record it.
  - Deleting observe.mjs's `rankForObserve` import is reported.

**C22 `tools/check.mjs: stamps, notes, dashes, parity, prose, names, stages, tree, gatecode`**
- **Files:**
  - `tools/check.mjs` gets every part from the gate spec's section 5. `rnumbers` is folded into `registry`.
  - `tools/config-prose.mjs` exports `proseCoverage`.
  - `scripts/chrome.mjs:130` uses `\u2013\u2014` escapes. Its regex was checked on 11 of 11 samples.
- **Verify:**
  - `node tools/check.mjs` exits 0 with each part's numbers: stamps 8/8, prose 497/497, names 0 unresolved with 2 computed, and so on.
  - An en dash put into a pl.json value in a scratch copy turns `dashes` red.

**C23 `npm test: one command runs lint, check, the gate self-test, the suite and the ci scenarios`**
- **Files:** new `audit/harness/run-all.mjs`, as in the gate spec's section 2:
  - each run spawned detached, with its process group killed afterwards;
  - fresh results JSON required;
  - the exit code must agree with the verdicts;
  - a `$GITHUB_STEP_SUMMARY` table.
- **Verify:**
  - `npm test` locally: all green. Record per-part times (predicted about 5 minutes plus C10's CSS cost) and maxRSS.
  - One inverted scenario check turns run-all red.

**C24 `CI: npm test on every push and pull request to main`**
- **Files:** new `.github/workflows/ci.yml`, as in the gate spec's section 6: three matrix jobs, Node 22.22.2, results uploaded as artifacts.
- **Verify:**
  - Push the branch and dispatch CI 3 times on one commit. Record durations, memory and flakes.
  - Mutation branches, dispatched and then deleted:
    - `e30-mut-handler` drops `ownsActor` in one GM_HANDLERS entry. Expect suite red on R1b, R134 and R138, and 30 red.
    - `e30-mut-dash` puts an en dash into lang/pl.json. Expect check red.
    - `e30-mut-name` deletes the `rankForObserve` import. Expect lint red.
    - `e30-mut-exit` inverts one check in 14. Expect scenarios red.
  - Keep the run URLs for the notes.

**C25 `The local gate: audit/gate and audit/live, and release.yml checks both layers`**
- **Files:**
  - New `audit/gate/gate-lib.mjs`, `local-gate.mjs`, `verify-gate.mjs` (the 15-case `--self-test` from the gate spec's section 9), `README.md`, and `waivers/.gitkeep`.
  - New `audit/live/README.md`, `foundry.mjs`, `suite.mjs`, `sandbox-cluster.mjs`, `page-hooks.js`, `seed-world.mjs`.
    - They never fill a password.
    - `seed-world` refuses a non-empty world.
    - `live-world-diff` uses per-document dumps, not LevelDB `diff -rq`.
  - `.github/workflows/release.yml`:
    - a `ci` job (`uses: ./.github/workflows/ci.yml`);
    - a `local-gate` job (verify-gate);
    - a `waiver-approval` job (environment `local-gate-waiver`);
    - the `release` job with the explicit `if`;
    - stamps via `tools/check.mjs stamps notes --release "$TAG"`, replacing 60-109;
    - new steps take inputs through `env:`.
  - `tools/check.mjs gatecode`.
- **Verify:**
  - `node audit/gate/verify-gate.mjs --self-test`: all cases pass.
  - `npm run gate:local` here: every part not-run (live and sandbox: `no-server`, ECONNREFUSED 127.0.0.1:30099; drill: `no-fixtures`), verdict `incomplete`.

**C26 `audit/perf-baseline.json: the 1.2.56 baseline, not yet measured`**
- **Files:**
  - New `audit/perf-baseline.json`, as in the registries spec's section 7.4: `status: "not-measured"`, and `worldCopy.status: "not-taken"`.
  - `perfFunction.bodySha256` f8f57391..., the same at v1.2.56 and HEAD.
  - New `audit/live/perf-baseline.mjs` (`--probe`, `--run`) and `audit/live/world-manifest.mjs`.
  - The registry part validates the schema. From E04 on, `not-taken` fails.
- **Verify:** `node audit/live/perf-baseline.mjs --probe` appends one attempt made of the actual probe errors, and exits 0.

**C27 `CLAUDE.md: the test author contract, what the harness cannot do, both gate layers`**
- **Files:**
  - `CLAUDE.md`:
    - the "Test author contract" section (the contract spec's section 12 text, with R numbers updated to R154-R158);
    - "What the suite's four numbers mean", with the measured numbers;
    - "Running things" (`npm test`, `npm run quick`/`lint`/`check`, `gate:local`, "the rows with layers ci in audit/harness/README.md" instead of the list of eleven);
    - a 6-line summary of "What the harness cannot do";
    - "The gate, both layers";
    - "Releasing": `node tools/stages.mjs ship EXX`, local-gate on the bumped commit, and "an agent never writes a waiver file or fills the waiver input";
    - "delete a key with forcedDeletion() or unsetFlag; '-=' removes nothing (R152)";
    - five clients in 17-assistant.
  - `CONTRIBUTING.md` lines 3-6 and 15-32 (npm ci in audit/harness).
  - `audit/README.md`.
- **Verify:**
  - `node tools/check.mjs dashes registry` exits 0.
  - `npm run quick` is green.

**C28 `1.2.61`**
- **Files:**
  - Bump `module.json`, `danganronpa.css:35`, the six handbooks' line 3, and README.
  - `.github/release-notes/v1.2.61.md`.
  - `node tools/stages.mjs ship E30`.
  - `node audit/gate/local-gate.mjs` on this commit, then commit `audit/gate/local-gate.json` and the empty evidence.
- **Verify:**
  - `npm test` is green.
  - CI on the commit is green. Any `expectedRed("E30")` left behind now FAILs, which is intended.
  - `node audit/gate/verify-gate.mjs --tag v1.2.61` refuses. It names the required reason (remnants.mjs and relay-guard.mjs changed since v1.2.60: sockets and scenes) and the parts not run.
  - The release is dispatched only after Dawid's waiver or a sandbox run (Q6).

## 3. What E30 cannot prove here, and how that is recorded

### Not provable without real v14, a licence, :30099 or DRPG_FIXTURES
- LIVE-E30-01 to -09:
  - what v14 does with `-=`;
  - the operator API and `_del`;
  - the shape of hook `changes`;
  - Assistant role escalation and the SETTINGS_MODIFY role;
  - the disconnect flow;
  - 17-assistant C2/C3 at a real table;
  - migrateRemnants on a pre-ledger world copy (the brief's "first on an old world");
  - the installed dependency versions;
  - CSS attached as `@import layer(modules)`.
- Tier 2 in both themes on a real world; `live-world-diff`; the sandbox scenarios; the drills.
- Which button Enter presses on v14's DialogV2.
- Skips in a real browser.
- The load cost of seven suite files.
- The 1.2.56 perf baseline.
- Whether the live runner, sandbox adapter and page hooks work at all. They ship without ever having run.
- The canary's verdicts describe the shim, not v14.
- The 16 headless-skipped test bodies are proven only statically across the split.

### How the release records it
- **`audit/gate/local-gate.json`** is written only by the script on the 1.2.61 commit:
  - `verdict: "incomplete"`;
  - each part `{status: "not-run", reason: "no-server" | "no-fixtures", why}` with the real error;
  - `sandbox.reachable: false`;
  - `hmac: null` unless `DRPG_GATE_KEY` is set.
  - Nothing is ever recorded as `ran: true` if it did not run.
- **Every harness results JSON** carries `environment.unconfirmed: [LIVE-E30-nn ...]` and versions with `from`.
- **`audit/perf-baseline.json`** says `status: "not-measured"` and `worldCopy.status: "not-taken"`, with the attempt's actual probe output.
- **`v1.2.61.md`, "## Checked":**
  - measured numbers for the suite and each scenario, and the CI run URLs, the mutation runs included;
  - one line "- Not checked in a real Foundry: ..." per LIVE id and per local-gate part;
  - "the brief's remnants.mjs:1795 is line 1881 at 411d4da";
  - "migrateRemnants was not tried on a copy of an old world";
  - "perf baseline not measured: needs Dawid's world copy before E04 (1.2.63)".
- **The notes must also say:**
  - `runTests()` now defaults to tiers 0-1;
  - a fourth number, `red`, appears in the result;
  - the relay-guard change for Assistants.
- **`verify-gate --tag v1.2.61` refuses.** Only Dawid can let it through:
  - he writes `audit/gate/waivers/v1.2.61.md` with a "Parts not run:" list;
  - he types the tag again in the dispatch;
  - he approves the `local-gate-waiver` environment;
  - the notes carry the "Not checked in a real Foundry" line.
- The waiver shows as debt in every later summary. 1.3.0 can never be waived.

## 4. Decisions for the user (the implementer proceeds on each default)

- **Q1. Base.** Default: start on `main` at the v1.2.60 tag. If E03 is not tagged, do C0 and C3a-C3b first, which do not touch the suite, and hold C1 until it is tagged. In stages.json, E03's `version` stays null until then.
- **Q2. The Assistant escalation found by 17-assistant.** Predicted: relay-guard.mjs:250/297 lets any `sender.isGM` through. Default: fix it in E30 (C7) as D22's second pass. The alternative is `expectedRed` until E31.
- **Q3. Tier 2 in CI.** Default: yes, on the disposable harness world. Dropping it removes 97 of the 308 results. The brief's "tier 0-1" is read as the floor.
- **Q4. Seven flat `tests*.mjs` files instead of four.** The runner stays in tests.mjs to avoid a kit-tier import cycle. `tests-lint.mjs` is needed because utils.mjs and settings.mjs throw "Hooks is not defined" in bare Node. `tests-flows.mjs` holds FLOWS. Default: seven.
- **Q5. 15-trial clashes with the shipped 15-held.** Default: the trial becomes 18-trial, with an alias row and a line in STATE.md.
- **Q6. The gate applies to its own release.** Default: yes. 1.2.61 (then E31 and E04) waits for Dawid's waiver or a v14 sandbox at :30099. Dawid also sets up the `DRPG_GATE_KEY` secret, the `local-gate-waiver` environment with himself as required reviewer, `DRPG_WAIVER_AUTHORS`, and branch protection.
- **Q7. Canary hits with no plan finding.** Default: a known-leaks entry closing at E43, flagged to Dawid in the notes. D27 forbids deferring an identity, answer-key, plan or GM-notes leak. Private roll values (no marker possible) get no entry until measured.
- **Q8. `verified` in the manifest.** Default: Daggerheart `verified` stays 2.6.5 until a live run passes. The gate's cross-check will then demand either 2.6.5 on the sandbox or an update of `verified`.
- **Q9. Stylesheets.** Default: option B, real sheets. Fall back to C only if a difference cannot be explained.
- **Q10. migrateRemnants.** Default: it stays a manual `game.drpg` call with no new migration clause. The world copy for the perf baseline and drills then only has to predate E04 (1.2.63), not 1.2.61. Dawid should still take it now.
- **Q11. The 70 unnumbered tier-1 invariants.** Default: grandfathered by name in the registry. New tier-1 tests get R numbers.
- **Q12. ESLint's 60 zero-hit recommended rules.** Default: not in E30, which lints no-undef only.

## 5. Files referenced
- Brief: `<scratch>/stage-E30.md`
- Repository copy: `<scratch>/e03v` (411d4da). Spot-checked for this plan:
  - `scripts/remnants.mjs:1881`, the `-=` drop;
  - `audit/harness/cluster.mjs:428-429`, the unref'd exit timer;
  - `scripts/api.mjs:1048`, the lazy import;
  - `audit/harness/scenarios/01-runtests.mjs:25`, the 30,000-character cut;
  - `module.json` at 1.2.59, with no v1.2.6x tag.
- Prototypes the implementer reuses, all under the same scratchpad:
  - `e30split/verify-split.cjs`, `e30split/suite-diff.mjs`, `e30split/scope.cjs`;
  - `e30-design/r151.mjs`, the '-=' scan, to be committed as R152;
  - `e30-design/proto/`, operators.mjs;
  - `e30-contract/ast.cjs`, `cuts2.mjs`, `needs-order.cjs`;
  - `e30-registries/r-registry.mjs`;
  - `e30-ci/`, the exit-code probe.