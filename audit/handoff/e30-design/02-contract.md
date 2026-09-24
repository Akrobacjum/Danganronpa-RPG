# E30 design, area: the test author contract and world purity (S17-03, S17-04, S17-06, S14-24)

Read-only design over the repository copy at 411d4da. Every line number below refers to that commit (`scripts/tests.mjs` there is 15,002 lines, not the brief's 13,769). The split into `tests-kit.mjs` / `tests-tier0.mjs` / `tests-tier1.mjs` / `tests-tier2.mjs` is another area's work. This design says which file each piece belongs in, not at which line it will sit afterwards.

## 0. What was measured here, and how

The harness was not started, as instructed. Everything below that says "measured" came from reading the source or from read-only static scripts, which I left in `scratchpad/e30-contract/` so they can be run again:
- `ast.cjs` is an AST census. It uses Node 22's bundled acorn, run as `node --expose-internals ast.cjs <file> [--needs|--weak]`.
- `cuts2.mjs` counts source cuts, scoped per test, and takes `--list`.
- `needs-order.cjs` reports where each `needs()` sits relative to the assertions in its test.

**Test census (AST).** `REGRESSIONS` has 117 tests (tier 0), `INVARIANTS` 93 (tier 1) and `SCENARIOS` 97 (tier 2), 307 in all. Add the one pseudo-test "tier 0/1 changed nothing" and that makes 308 results, which is exactly the 292 passed + 16 skipped of the last headless run (`scratchpad/new-01.log:4041`).
- No test lacks an `ok`/`equal` call.
- 19 tests assert only inside loops or callbacks: 18 in tier 1 (lines 5280, 5416, 5439, 5462, 5471, 5489, 5981, 6786, 6826, 6839, 6855, 7510, 7591, 7614, 7645, 7668, 7678, 7735) and 1 in tier 2 (14228).
- No test contains `throw new Failure`; the only one in the file is inside `cast()` (8597).
- The only top-level helper that asserts is `bodyOf`.
- Test-local helpers that call `ok()` for a marker or a fetch: `between` (5725), `caseOf` (5768), `read` (7381, `ok(r.ok)`).
- R numbers go up to R150. R21 is used twice (1718 and 2000).

**`needs()`: 35 calls.**
- 23 use E01's own probes: `layoutAvailable()` ×8 (1289, 6925, 7113, 7419, 7430, 7451, 7501, 13817), `glassTheme()` ×6 (7112, 7418, 7429, 7450, 7471, 7500), `cascadeAvailable()` ×3 (13866, 14240, 14348), `dialogsDrawn()` ×3 (9355, 10461, 10557), `systemSheetsAvailable()` ×2 (8836, 11389), `canvasAvailable()` ×1 (10784).
- 4 are inline environment conditions: `!narrowScreen()` (7114), `globalThis.showdown?.Converter` (6944), the font-face test (7482), and Web Animations (7825).
- 8 are world facts: `viewer` (4605), `proposer` (4607), `student` (8150), `pools.length > 0` (8167), `owner` (8631), `room` (10019), `game.modules.get(..)?.active` (14513), `entry` (14515).
  - Two of these are read through the code under test. 8167 uses `D.monokumas()`, so a broken `monokumas()` would skip instead of fail. 8150 uses `isCleaner`.
- None is an action result today (E01 fixed those).
- 16 of the 35 calls come after at least one assertion in their test, across 11 tests: R12, R105, R111, R112, the transition test (7825), R148, the direct murder (8631), the case dashboard (9355), the Projects tray (10019), topping up Hope (11389), and held settings (14513).

**Source cutting** (`cuts2.mjs`). This counts `.slice`/`.substring` calls with a bound taken from `indexOf`/`lastIndexOf`/`search`, either directly or through a local assigned from one in the same test. Excluding the kit's own `bodyOf` (347), there are 61:
- tier 0: 47 (31 with an argument no `ok(x > 0)`-style check covers anywhere in the test, 13 fully guarded, 3 safe idioms: line extraction at 5066 and 5081, and `+ 1 || undefined` at 2583);
- tier 1: 13 (5 unguarded, 8 guarded);
- tier 2: 1 (guarded).
- There is also one `split(marker)[1]` cut (6766: `sync.split("const SETTING_KINDS")[1]?.split("};")[0] ?? ""`), which gives `""` when the marker has gone.
- Most of the unguarded ones are a guarded start with a bare `indexOf` END. When the end marker moves, the body silently runs to the end of the file, so a positive assertion can match code in another function.
- Pre-E01 (`scratchpad/e30split/tests-bd16716.mjs`) had 186 cuts, 163 unguarded. The audit's "about 177" falls between the two.

**Vacuous assertions.**
- In the suite: 0 of `ok(true`, `ok(1,`, `|| true`, `?? true` in an `ok`, `equal(x, x`, and no `ok`/`equal` inside an `until()` callback or a non-rethrowing `catch`.
- In harness scenarios: 9 `check(name, true, ...)`. Seven are in the probe scenarios (02-probe ×4, 04:26, 05:9, 07:7) and two are in real scenarios: `00-boot.mjs:25` (a log line posing as a check) and `12-social.mjs:9` (the setting's registered default is `true`, settings.mjs:535, so this can become a real check).
- `cluster.mjs` counts a scenario with zero checks as 0/0, a pass.

**Callers of `runTests`.**
- `scripts/api.mjs:1048` (lazy import);
- `README.md:287-291`;
- `docs/handbooks/gm-handbook.en.md:817-828` and `gm-handbook.pl.md:817-828`;
- `CLAUDE.md:33`;
- `CONTRIBUTING.md:37-40,52`;
- `audit/harness/scenarios/01-runtests.mjs:20,24`;
- `06-runtests-music.mjs:4`;
- the file's own header (`tests.mjs:4-6`) and two stacked JSDoc blocks (14815-14827).
- **There is no GM-panel button.** `gm-panel.mjs` never mentions the suite, and `api.mjs:1048` is the only importer of `tests.mjs`. So nothing in the panel changes. Any future button calls `game.drpg.runTests()` and never passes `confirmed`.

**The harness world** (`cluster.mjs:63-102`):
- users: GM (role 4) and three players;
- actors: Aiko (p1), Botan (p2), Chie (p3), Daichi (no owner), and a Monokuma;
- one scene with 6 named regions and 5 tokens (Dorm A, Cafeteria, Dorm B, Gym and Hall occupied);
- no items, stashes, tables or playlists; `game.world` is `{ id: "drpg-audit-world", title: "DRPG Audit World" }` (`client-entry.mjs:460`).

**Foundry-side facts, read in the source:**
- client settings live in `localStorage` (the module's own measured notes at `remnants.mjs:855` and `murder.mjs:4243`);
- `utils.mjs` and `settings.mjs` throw `Hooks is not defined` when imported in bare Node (tried with `node -e import()`), while `config.mjs` imports cleanly;
- `tools/` and `audit/` are `export-ignore` (`.gitattributes`), so an installed zip cannot fetch `tools/stages.json`; the harness serves every repo path (`client-entry.mjs:154-172`).
- The test that registers its own setting (14542-14554) removes both the registry entry and the `localStorage` value; it is not a leftover.

## 1. Files

- **`scripts/tests-kit.mjs`** (the split creates it; this area adds to it):
  - `Failure`, `Precondition extends Failure`, and `Skipped` (now carrying `.probe`);
  - `ok`, `equal`, and `must` (new);
  - the running-test context and assertion counter;
  - the `env` and `world` probe tables, `needs()`, and `cast(n)`;
  - `expectedRed()`, `stageLedger()`, `runOne()` and `judge()`;
  - `worldDump()`, `dumpDiff()`, `describeDiff()` and `DUMP_RULES`;
  - `KIT_SELF_TESTS`;
  - `lineAround(text, i)` (new cutter);
  - `bodyOf` with its three `ok()` calls changed to `must()`.
- **`scripts/tests-lint.mjs`** (new, a fifth flat file, with no imports at all). It holds pure text detectors: `bareCuts(text)`, `vacuousAsserts(text)`, `needsArgs(text)`, `redMarkers(text)`, `testsIn(text)`. The suite's tier-0 meta-tests and the Node checker both use it.
  - Why it is its own file: the kit imports `settings.mjs`/`utils.mjs`, which throw in bare Node (measured), so the Node check cannot import the kit.
  - It is flat and starts with `tests`, so `otherSources()` excludes it and the `moduleSources()`/`loadedFiles()` crawls reach it through the kit's import.
  - If the plan must stay at exactly four files, the fallback is to put the detectors in the kit and drop the Node-side scan of scenario files. The cost: `check(name, true)` in scenarios is then gated by nothing.
- **Tier files** hold the new R tests (section 4).
- **The runner** (`runTests`/`runSuite`) goes wherever the split places it; `api.mjs:1048` imports that file.
- **New repository files:**
  - `tools/stages.json`, `tools/stages.mjs`, `tools/contract-check.mjs`;
  - `audit/harness/skip-baseline.json`, `audit/harness/mutants.mjs`, `audit/harness/mutants/*.json`.

## 2. Assertion counter: "measured nothing" (S17-03)

```js
// tests-kit.mjs
export class Failure extends Error {}
/** A kit precondition that did not hold: the code under test was not where the test looked. Never an expected red. */
export class Precondition extends Failure {}
export class Skipped extends Error { constructor(message, probe) { super(message); this.probe = probe; } }

/* The test now running. The runner awaits each test before the next, so one slot is enough; null between
   tests, so a callback that outlives its test counts for nobody. */
let current = null;

export function ok(condition, message) {
    if (current) current.assertions++;
    if (!condition) { if (current) current.failures.push(String(message)); throw new Failure(message); }
}
export function equal(actual, expected, message) {
    if (current) current.assertions++;
    if (actual !== expected) {
        const text = `${message} - expected ${JSON.stringify(expected)}, measured ${JSON.stringify(actual)}`;
        if (current) current.failures.push(text);
        throw new Failure(text);
    }
}
/** For the kit's cutters and fixtures: what a test needs in order to measure at all. Not a measurement. */
export function must(condition, message) {
    if (!condition) { if (current) current.failures.push(String(message)); throw new Precondition(message); }
}
```

Rules enforced by `judge()` (section 5 gives the full order):
- A test that returns normally with `assertions === 0` fails with "measured nothing: no ok() or equal() ran". This catches the stackShapes shape: a loop over an empty list reports nothing.
- A test that returns normally with `failures.length > 0` fails with "an assertion failed and the test caught it: <first message>". Nothing does this today; the check is cheap insurance for the hundreds of tests E04-E29 will add.
- `bodyOf` (336-351) switches to `must()`, so a test that only cuts source is not a measurement.
- Test-local marker guards also switch to the kit:
  - `between` (5725) becomes `bodyOf(rolls, from, { until: to })`. Note that `between` searched `to` from the top of the file; `bodyOf` searches after the marker. Re-measure the two tests that use it.
  - `caseOf` (5768) becomes `bodyOf(sync, "case SYNC.x:", { until: "case SYNC.y:" })`.
  - `read`'s `ok(r.ok)` (7381) becomes `must(r.ok, ...)`.
- The counter reads only `ok`/`equal`. A test whose only `ok()` calls are marker checks in a local helper is not caught; the conversion above removes the three known ones.

**Predicted first findings** (by reading; not measured, since the harness was not run). In the harness world, which has no stashes:
- "no stashed thing points at a stash that is not there" (5439) and "every stash belongs to somebody who exists" (5462) count 0 assertions, so they FAIL "measured nothing" when the counter lands.
- "one account is only ever sent to one voice room" (7591) may count 0 too, depending on the voice mode in the shim.

The fix for each is honest rather than cosmetic:
- start with `needs(world.atLeast("stashes", 1), ...)`, so a world with no stashes skips and says so;
- seed one stash with one stashed item in `cluster.mjs`'s world (lines 63-102), so the harness answers the question and no `world.*` skip appears there (section 9).

## 3. `needs()` only from probes (S17-03, S14-24)

**Decision.** "Environment" means two suite-owned families. `env.*` covers this browser and this Foundry: E01's six probes, wrapped. `world.*` covers the world as found: its composition, which is S14-24's "world requirements always through `needs()` with a uniform message". Anything else handed to `needs()` FAILs, whatever its truthiness. The brand check fires on every run, not only on the day the condition is false.

```js
const PROBE = Symbol("drpg.suite.probe");
const probe = (name, holds, fact) => Object.freeze({ [PROBE]: true, name, holds: Boolean(holds), fact });

export const env = Object.freeze({            // E01's probes (tests.mjs:114-168), wrapped, plus the four inline ones
    layout:        () => probe("env.layout", layoutAvailable(), "no layout here"),
    cascade:       () => probe("env.cascade", cascadeAvailable(), "no CSS cascade here: var() does not resolve"),
    glass:         () => probe("env.glass", glassTheme(), "the theme on this client is Monokuma Legacy"),
    desk:          () => probe("env.desk", !narrowScreen(), "a stacked screen, narrower than BREAKPOINTS.narrow"),
    canvas:        () => probe("env.canvas", canvasAvailable(), "no canvas renderer here"),
    systemSheets:  () => probe("env.systemSheets", systemSheetsAvailable(), "Daggerheart's sheets are not registered here"),
    dialogs:       () => probe("env.dialogs", dialogsDrawn(), "DialogV2 draws no window here"),
    markdown:      () => probe("env.markdown", Boolean(globalThis.showdown?.Converter), "no Markdown converter here"),
    fonts:         () => { const f = getComputedStyle(document.body).fontFamily;
                           return probe("env.fonts", f && !/depends on user agent/i.test(f), "no font family resolves here"); },
    webAnimations: () => probe("env.webAnimations", typeof HTMLElement.prototype.getAnimations === "function"
                           && typeof globalThis.CSSTransition === "function", "no Web Animations API here")
});

/* What a world can be short of, counted one way for every test (S14-24). CLOSED: a test cannot pass its own
   predicate (that would let an action result back in); a new row is a change to the kit. */
const viewed = () => canvas?.scene ?? null;
const living = () => studentActors().filter(a => !a.getFlag(MODULE_ID, FLAGS.deceased));
const WORLD = {
    scenes:               ["scenes", () => game.scenes.size],
    sceneOnScreen:        ["scenes on screen", () => viewed() ? 1 : 0],
    namedRooms:           ["named rooms on the scene on screen", () => viewed()?.regions.filter(r => r.name?.trim()).length ?? 0],
    occupiedRooms:        ["rooms on the scene on screen with a token in them",   // Foundry's own token.regions, not roomOfToken
                           () => new Set((viewed()?.tokens ?? []).flatMap(t => [...(t.regions ?? [])].map(r => r?.id ?? r))).size],
    studentsInRooms:      ["students standing in a named room on the scene on screen", () => /* living() with a token whose token.regions has a named region */ 0],
    studentTokensOnScreen:["students with a token on the scene on screen", () => living().filter(a => viewed()?.tokens.some(t => t.actorId === a.id)).length],
    livingStudents:       ["living students", () => living().length],
    playerAccounts:       ["player accounts", () => game.users.filter(u => !u.isGM).length],
    playersWithCharacter: ["player accounts that own a character", () => game.users.filter(u => !u.isGM
                               && game.actors.some(a => a.type === "character" && a.testUserPermission(u, "OWNER"))).length],
    fullGms:              ["full Gamemaster accounts", () => game.users.filter(u => u.role === CONST.USER_ROLES.GAMEMASTER).length],
    stashes:              ["stashes", () => allVaults().length]
};
export const world = Object.freeze({
    atLeast(what, n = 1) {
        const row = WORLD[what];
        must(row, `world.atLeast("${what}"): the kit counts no such thing`);
        askedOfWorld(`world.${what}`);
        const have = row[1]();
        return probe(`world.${what}`, have >= n, `this world has ${have} ${row[0]}; this needs ${n}`);
    },
    ownedByPlayer(actor) { askedOfWorld("world.ownedByPlayer");
        return probe("world.ownedByPlayer", game.users.some(u => !u.isGM && actor?.testUserPermission(u, "OWNER")),
            `no player owns ${actor?.name ?? "that character"} in this world`); },
    moduleActive(id) { askedOfWorld("world.moduleActive");
        return probe("world.moduleActive", game.modules.get(id)?.active, `${id} is not enabled in this world`); },
    settingRegistered(full) { askedOfWorld("world.settingRegistered");
        return probe("world.settingRegistered", game.settings.settings.has(full), `${full} is not registered by what is installed here`); }
});
/* A skip describes the world AS FOUND. The runner's write watcher sets current.wrote in tier 2 as well. */
function askedOfWorld(name) {
    if (current?.wrote) throw new Failure(`${name} was asked after this test wrote to the world (${current.wrote}) - ask the world before acting`);
}
export function needs(p, why = "") {
    if (!p || p[PROBE] !== true) throw new Failure(`needs() was handed ${describe(p)}, not an env.* or world.* probe - `
        + "a skip may only be a fact the suite asked of the environment itself (Test author contract)");
    if (current) current.probes.push(p.name);
    if (!p.holds) throw new Skipped(`[${p.name}] ${p.fact}${why ? ` - ${why}` : ""}`, p.name);
}
```

Notes on the probes:
- `world.*` rows may use module read functions (`studentActors`, `allVaults`) to *choose* fixtures. The safety net is the harness: its world satisfies every row, and a `world.*` skip in the harness is refused (section 9). A broken roster therefore turns red in CI instead of skipping quietly.
- 8167 (R149) becomes `needs(world.atLeast("fullGms", 1))` followed by `ok(D.monokumas().length > 0, "a full GM exists and monokumas() finds no pool")`. That removes the one case where the module's own answer decided a skip.

**Ordering.** `needs()` after an assertion stays allowed. In R111 and R112 the source part is measured everywhere and only the browser part skips; a strict ordering rule would reshape 11 tests and lose headless measurement. The hazard ordering was meant to prevent (a skip decided by the module's action) is closed instead by three things:
- the brand check;
- the closed `WORLD` table;
- the world-after-write rule.

**Output format.** The skip line becomes `[env.layout] no layout here - a label's height needs a browser`. The runner adds one summary line grouping skips by probe, for example `skipped by probe: env.layout 8, env.cascade 3, env.systemSheets 2, env.canvas 1, env.fonts 1, env.webAnimations 1`, and returns each skip's probe (section 7).

**Conversion map at 411d4da.**
- 1289, 6925, 7113, 7419, 7430, 7451, 7501, 13817 → `env.layout()`
- 7112, 7418, 7429, 7450, 7471, 7500 → `env.glass()`
- 13866, 14240, 14348 → `env.cascade()`
- 9355, 10461, 10557 → `env.dialogs()`
- 8836, 11389 → `env.systemSheets()`
- 10784 → `env.canvas()`
- 7114 → `env.desk()`
- 6944 → `env.markdown()`
- 7482 → `env.fonts()`
- 7825 → `env.webAnimations()`
- 4605 → `world.atLeast("playersWithCharacter")`
- 4607 → `cast(2)`
- 8150 → `world.atLeast("studentTokensOnScreen")`, then `ok()` that a non-Stage-6 student is among them
- 8167 → `fullGms`
- 8631 → `world.ownedByPlayer(victim)`
- 10019 → `namedRooms`
- 14513 → `world.moduleActive("isometric-perspective")`
- 14515 → `world.settingRegistered(full)`

## 4. Meta-tests: six new R tests (tier 0) and one Node check

**R numbers.** Take the next six free numbers from the registry at implementation time. R151 looks claimed by the `-=` scan prototype in `scratchpad/e30-design/r151.mjs`, so R152-R157 if nothing else claims them first. The static ones read `suiteSources()`, which is `moduleSources()` filtered to `tests-tier*.mjs`. The kit is excluded because it is where the cutters and self-tests live.

The detectors run on `stripComments` plus `stripStrings` plus a regex-literal blanker, using the `literals()` walk from `scratchpad/e30-design/r151.mjs`. Every detector test runs its detector over a fixture string with known violations first and asserts it finds exactly those. This is R21's lesson (tests.mjs:529-533: "R21 saw nothing at all - including the fault written into its own fixture").

- **R152, no test cuts the source it reads with a bare indexOf.** It flags, inside any test body:
  - a `.slice`/`.substring`/`.substr` call whose argument contains `indexOf(`, `lastIndexOf(` or `.search(`;
  - an argument that is a local of the same test assigned from one of those;
  - any `.split(<literal>)[n>=1]`.

  There are no guard exemptions: cut with `bodyOf(src, marker, { until | length })`, `fnSource(src, name)` (from the split area) or `lineAround(text, i)`.
  - Positive control: `ok(slicesRead > 100)`. The suite has 129 `.slice(` calls today.
  - Before: 61 cuts + 1 split. After the E30 conversion: 0.
  - Conversion idioms:
    - `src.slice(at, src.indexOf(END, at))` → `bodyOf(src, M, { until: END })`
    - `src.slice(at, at + N)` → `{ length: N }`
    - the "rest of the function" pattern at 639, 1533, 1987, 2267, 11922 and `handlerBody` (636) → `fnSource`
    - 5066/5081 → `lineAround`
    - 2645/2856 (text before a marker) → a `{ back: N }` option on `bodyOf`
    - 6766 → `bodyOf(sync, "const SETTING_KINDS", { until: "};" })`
- **R153, no assertion is true by construction.** It flags `ok(`/`equal(`/`needs(` whose first argument is a literal (`true`, a number, a string, `!0`, `[]`, `{}`) or contains a top-level `|| true`, `|| 1` or `?? true`, plus `equal(A, A, ...)` with textually identical arguments. Today it finds 0 in the suite.
- **R154, needs() is asked only of a probe.** The static half: the first argument of every `needs(` in the tier files must match `^\s*(env|world)\.[A-Za-z]+\(`. The runtime brand check is the guarantee; this is the early signal. It also catches an aliased `needs`, which the runtime check stops anyway.
- **R155, every expectedRed and every DUMP_RULES `until` names a stage that has not shipped.** It imports all three tier arrays statically, so a tier-2 marker is checked in a tier-0 run. It FAILs when a marker is not a literal `"E\d\d"` stage, is unknown to the ledger, has an empty `why`, or its stage has shipped. When the ledger is not served (an installed zip), it checks only the syntax and the run's text carries one line: "stage ledger not served by this install: whether a marked stage has shipped was checked at release, not here".
- **R156, the runner keeps the test author contract.** These are the kit self-tests (`KIT_SELF_TESTS`, in `tests-kit.mjs`, so the static scans skip their deliberate violations). They drive `runOne()` in isolation: it saves and restores `current`, and the ledger is injected. Expected outcomes:

  | Case | Outcome |
  | --- | --- |
  | empty body | fail, "measured nothing" |
  | `try { ok(1 === 2) } catch {}; ok(1 === 1)` | fail, "caught" |
  | `needs(document.body)` | fail, "not an env.* or world.* probe" |
  | `needs(world.moduleActive("drpg-suite-never-installed"))` | skip, `[world.moduleActive]` |
  | red, failing on `ok` | red |
  | red, passing | fail, "unexpectedly passed" |
  | red, stage shipped | fail |
  | red, stage unknown | fail |
  | red, failing on `must` | fail, "red for the wrong reason" |
  | red, throwing a TypeError | fail, "threw" |
  | world probe after a synthetic `current.wrote` | fail |

  This is how the verify line "expectedRed passes while failing, FAILs when it passes, FAILs when its stage has shipped" is measured on every run, in every environment.
- **R157, worldDump reads every kind of write the module makes.**
  - It scans `otherSources()` for document writes: `createEmbeddedDocuments|updateEmbeddedDocuments|deleteEmbeddedDocuments("X"` and `X.create|createDocuments|updateDocuments|deleteDocuments(`. Today that finds Item, TableResult, Token, ActiveEffect, Actor, ChatMessage, Folder, Playlist and RollTable. It asserts each type is read in full by the dump. A type read as ids only must never be written: for walls, lights, sounds, drawings and templates this holds today.
  - It scans literal `game.settings.set("<ns>", "<key>"` calls plus the `ENFORCED` rows. Today those are `core.globalPlaylistVolume` (music.mjs:1813, sfx.mjs:426), `core.permissions` (season-setup.mjs:122) and `isometric-perspective.showWelcome` (enforced.mjs:55). It asserts each is in `DUMP_FOREIGN_SETTINGS`.
  - It scans for `localStorage.setItem` / `indexedDB.open` / `sessionStorage` writes; there are 0 today, only comments. It FAILs unless every file doing so registers a dump source. This is the GmStore tripwire (section 6).
  - It includes pure unit checks of `dumpDiff` on synthetic dumps: added, removed, changed leaf, and a stripped path that is not reported.
  - Positive control: the scan must find Actor, ChatMessage, Token and Item.
- **`tools/contract-check.mjs`** (Node, for the CI layer's `npm run check`). It imports `scripts/tests-lint.mjs` and runs the R152-R154 detectors over `scripts/tests-tier*.mjs`, which gives fast CI feedback with no Foundry. It also runs the vacuous-check detector over `audit/harness/scenarios/*.mjs`: `check(<x>, true|1|!0, ...)` and `|| true` inside `check(`. It exits non-zero with `file:line`.
  - Before: 9 hits (7 in probe scenarios 02/04/05/07, which S14-23 moves to `audit/harness/probes/` out of the scanned folder, plus 2 in real scenarios).
  - Fixes for the two real ones: `00-boot.mjs:25` becomes `note(...)`, a new informational line in `cluster.mjs` that is not a check. `12-social.mjs:9` becomes `check("forcePrivateRolls is on until a GM turns it off", forced === true, ...)`.
- **`cluster.mjs`**: after `scenario.run`, add `if (!results.length) check("the scenario measured something", false, "no check() ran")`.

## 5. expectedRed(stage, why) and tools/stages.json

**Marker.** It is a third tuple element, which keeps the brief's two-argument signature. The runner can therefore read every marker without running the test, R155 can check tier-2 markers in a tier-1 run, and `only` is unaffected.

```js
const RED = Symbol("drpg.suite.expectedRed");
/** ["R160 - ...", async () => {...}, expectedRed("E07", "the fresh incident state lands in E07")] */
export function expectedRed(stage, why, { failing = null } = {}) {
    // never throws at load (a throw would take the whole tier file down); a malformed marker FAILs its test
    return Object.freeze({ [RED]: true, stage: String(stage ?? ""), why: String(why ?? "").trim(), failing });
}
```

The optional `failing` is a substring the failure message must contain. It is recommended for E32's generated grid, so that a case which starts failing for a different reason does not hide under the marker until E07. A generator (E32's roughly 50 combinations) must emit one tuple per case, so each case has its own marker, counter and line.

**Stage ledger in the suite.** `stageLedger()` fetches `/modules/danganronpa-rpg/tools/stages.json` once per run. It returns `Map<id, row>`, or `null` on a 404 (an installed zip). The harness serves the file.

**runOne / judge**, where order matters:

```js
export async function runOne([name, fn, red = null], { tier, ledger }) {
    const ctx = { name, tier, assertions: 0, failures: [], probes: [], wrote: null };
    const outer = current; current = ctx;
    let err = null;
    try { await fn(); } catch (e) { err = e; } finally { current = outer; }
    return { tier, name, assertions: ctx.assertions, ...judge(ctx, err, red, ledger) };
}
function judge(ctx, err, red, ledger) {
    if (red) {                                                  // 1. a stale or malformed marker fails whatever the test did
        if (red[RED] !== true || !/^E\d{2}$/.test(red.stage) || !red.why) return fail(`expectedRed is malformed: ${describe(red)}`);
        const row = ledger?.get(red.stage);
        if (ledger && !row) return fail(`expectedRed names "${red.stage}", which tools/stages.json does not know`);
        if (row?.shipped) return fail(`expected red until ${red.stage}, which shipped in ${row.version} on ${row.shipped} - `
            + `the marker is still here: ${red.why}`);
    }
    if (err instanceof Skipped) return { outcome: "skip", message: err.message, probe: err.probe };                  // 2.
    if (!err && ctx.failures.length) return fail(`an assertion failed and the test caught it: ${ctx.failures[0]}`); // 3.
    if (red) {                                                                                                     // 4.
        if (err instanceof Failure && !(err instanceof Precondition)
            && (!red.failing || err.message.includes(red.failing)))
            return { outcome: "red", message: `until ${red.stage}: ${red.why}`, failedAt: err.message };
        if (err instanceof Precondition) return fail(`red for the wrong reason - the test could not reach what it measures: ${err.message}`);
        if (err) return fail(err instanceof Failure ? `red, but not where expectedRed says: ${err.message}` : `threw: ${err?.message ?? err}`);
        if (!ctx.assertions) return fail("measured nothing: expected red, and no ok() or equal() ran");
        return fail(`unexpectedly passed (${ctx.assertions} assertions held) - expectedRed("${red.stage}") can come off: ${red.why}`);
    }
    if (err) return fail(err instanceof Failure ? err.message : `threw: ${err?.message ?? err}`);                    // 5.
    if (!ctx.assertions) return fail("measured nothing: no ok() or equal() ran");
    return { outcome: "pass" };
}
```

A red must be a *measured* red: an assertion that failed. A crash or a missing marker is a FAIL, so E35's skeletons must assert (`ok(typeof fn === "function", ...)`) rather than crash.

**Counting.** The result gets a fourth number, `red`. `passed` excludes red tests, and the gate stays `failed === 0`, so a red test "counts as green" in the gate sense while staying visible. Output line: `  red   <name>`, followed by `until E07 (planned 1.2.67): <why> - fails at: <message>`. Summary: `N passed, 0 failed, M skipped` plus `, K red until a later stage` when K > 0. This changes CLAUDE.md's "three numbers" to four.

**`tools/stages.json`**, the exact shape. It holds all 60 stages in STATE.md order; that order covers the plan's 60 ids exactly (checked against `data-v2.json`). `planned` follows D20: E01 = 1.2.57 through E59 = 1.2.115, and E26 = 1.3.0.

```json
{
  "$comment": "Stage ledger (E30). `planned` is the D20 plan; `version` and `shipped` (UTC date) are written only by `node tools/stages.mjs ship <id>` in the release commit. Read by the suite (expectedRed, DUMP_RULES until), by tools/stages.mjs check in ci.yml, and by release.yml.",
  "plan": "D20",
  "stages": [
    { "id": "E01", "planned": "1.2.57", "version": "1.2.57", "shipped": "2026-09-24" },
    { "id": "E27", "planned": "1.2.58", "version": "1.2.58", "shipped": "2026-09-24" },
    { "id": "E02", "planned": "1.2.59", "version": "1.2.59", "shipped": "2026-09-24" },
    { "id": "E03", "planned": "1.2.60", "version": null, "shipped": null },
    { "id": "E30", "planned": "1.2.61", "version": null, "shipped": null },
    { "id": "E31", "planned": "1.2.62", "version": null, "shipped": null },
    { "id": "E04", "planned": "1.2.63", "version": null, "shipped": null },
    "... one row per stage in release order ...",
    { "id": "E32", "planned": "1.2.66", "version": null, "shipped": null },
    { "id": "E07", "planned": "1.2.67", "version": null, "shipped": null },
    { "id": "E35", "planned": "1.2.78", "version": null, "shipped": null },
    { "id": "E14", "planned": "1.2.79", "version": null, "shipped": null },
    { "id": "E26", "planned": "1.3.0", "version": null, "shipped": null }
  ]
}
```

- The v1.2.57-59 tags are dated 2026-09-24 (`git tag --format=%(creatordate)`).
- E03 is not tagged at 411d4da. Its row is filled with the real v1.2.60 tag date when E30's first commit is written.

**`tools/stages.mjs`** (Node, no dependencies):
- `check` validates the shape (unique ids and versions; `shipped` implies `version`). It greps `expectedRed("Exx"` in `scripts/tests-tier*.mjs` and `until: "Exx"` in `scripts/tests-kit.mjs`, and each must name a known, unshipped stage.
- `check --release vX.Y.Z` additionally requires that:
  - a stage whose `version` equals X.Y.Z exists and is shipped;
  - nothing shipped is newer than X.Y.Z;
  - every other shipped stage's tag `v<version>` exists (`git tag -l`). This means a hand-edited `shipped` without a release fails.
- `ship Exx` writes `version` = `module.json` version and `shipped` = today (UTC). It refuses when the stage is already shipped or another stage holds that version.

**Who updates it.** Whoever cuts the release, in the release commit, alongside the version bump. The agent's `bump.py` should call `ship`. The steps:
1. A new CLAUDE.md "Releasing" step: "mark the stage shipped: `node tools/stages.mjs ship EXX`".
2. `ci.yml` runs `check` on every push and PR.
3. `release.yml` runs `check --release ${{ inputs.tag }}` before the build, next to the stamp checks (release.yml:58-110).
4. The CI suite run then turns every leftover `expectedRed("EXX")` red on that same commit. This is exactly E32's verify line: "after E07 ships, every remaining expectedRed('E07') FAILs".

## 6. worldDump(): what it reads, the rules, and how it replaces the fingerprint (S17-04)

**Representation.** A `Map<unitKey, string>` with one stable-JSON string per unit. A unit is one setting, or one (possibly embedded) document with its embedded arrays split off. `dumpDiff(a, b)` compares unit strings first, and only for units that differ parses both and walks them to leaf paths. Per-dump cost is roughly one `stableJson` per unit. It is async, because future dump sources may be async.

What it reads (on this client):

| Part | Read how | Path examples |
| --- | --- | --- |
| This module's settings, both scopes | every registry key starting `danganronpa-rpg.` → `game.settings.get` (no list, so E03-E29 keys such as rollId, ENFORCED toggles, Levels and sceneRoles are in the day they register) | `world:danganronpa-rpg.murderState.stage`, `client:danganronpa-rpg.incidentCast.killerId` |
| Daggerheart's settings | every registry key starting `${game.system.id}.` | `world:daggerheart.ResourcesFear`, `world:daggerheart.Countdowns.countdowns.<id>` |
| Foreign settings the module writes | `DUMP_FOREIGN_SETTINGS`, held equal to the source by R157 | `client:core.globalPlaylistVolume`, `world:core.permissions`, `client:isometric-perspective.showWelcome` |
| Orphaned client storage | keys of `game.settings.storage.get("client")` (localStorage in Foundry) starting `danganronpa-rpg.` that no registry entry claims | `client-orphan:danganronpa-rpg.<key>` (none known today; the test at 14542-14554 cleans up after itself) |
| Every world document | each collection in `game.collections` except `Setting`; `doc.toObject()` minus stripped fields; embedded arrays split off by `doc.constructor.metadata?.embedded` (the shim lacks it, so fall back to array-of-`_id` fields). Flags of every namespace, `ownership`, `system`, name, img and fog fields are all in without naming them | `Actor.<id>.system.resources.hope.value`, `Actor.<id>.flags.danganronpa-rpg.deceased`, `Actor.<id>.ownership.<userId>` |
| Every embedded document | items, effects, tokens (with `delta`), regions, tiles, notes, results, sounds, pages, combatants | `Scene.<sid>.tokens.<tid>.y`, `Actor.<aid>.items.<iid>.flags.danganronpa-rpg.equipped` |
| State outside documents | `game.paused` (safeword.mjs and events.mjs toggle it; scenarios at 11804-11849, 11961-12018 and 12465-12525 pause and unpause), `game.scenes.active?.id`, `canvas.scene?.id` | `state:paused` |
| Client-scoped GM ledgers | yes: they are this browser's copy of GM-only world facts (remnantSecrets, truthBulletSecrets, incidentCast, blackenedLedger, mastermind, trapLedger, trapPlants, advanceOffers, discoveryLedger, observePending, secretCards), and tier 2 writes them. Read through the settings row above. Only THIS client's copy: other GMs' and players' browsers are not read by a GM-run dump (a harness could add that later) | `client:danganronpa-rpg.remnantSecrets.<uuid>.realType` |
| GmStore (E04) | if E04 persists through registered client settings or `danganronpa-rpg.`-prefixed localStorage keys, the rows above read it unchanged. Anything else (IndexedDB, other prefixes) must export `dumpForSuite()` registered in `DUMP_SOURCES`, and R157's storage clause FAILs until it does | `gmstore:<store>.<entry>.<field>` |

**`DUMP_RULES`**, the explicit ignore and narrow-read list. Every row has a `why` and an `until`: a stage id, `"1.3.x (D27)"` or `"never"`. R155 holds each `until` to the ledger, so a row whose stage has shipped FAILs.

```js
export const DUMP_RULES = [
  { match: "*", strip: ["_stats"], until: "never",
    why: "Foundry's write stamp moves on every write, a restore that writes the old value back included; the values under it are compared, the stamp is not" },
  { match: "Playlist.*.sounds.*", strip: ["pausedTime"], until: "never",
    why: "advances by itself while a track plays; `playing` and `path` are compared" },
  { match: "Setting", skip: true, until: "never",
    why: "world settings are read by key in the settings part, for the namespaces this module writes; other modules' settings move with their own UI" },
  { match: "User", keep: ["role", "character", "flags", "permissions"], until: "never",
    why: "the rest of a User is the person's own (avatar, colour, hotbar), and a password field must never reach a report" },
  { match: "ChatMessage", keep: ["flags", "whisper", "blind", "speaker", "author"], hash: ["content"], until: "never",
    why: "a card is kilobytes of HTML a report cannot print; restore deletes the new ones, and an old card the suite edited shows as a changed hash" },
  { match: "Scene.*.walls|lights|sounds|drawings|templates", idsOnly: true, until: "never",
    why: "the module never writes these (R157 census); they are most of a scene's size" }
];
```

No speculative rows. A row is added only with a measurement quoted in its `why`: the run, the date, and what moved. Candidates to measure on real v14 and not to add blind:
- token movement history fields, if v14 keeps them in the token source;
- client UI positions saved when R12 opens and closes windows (for example `messengerWindowPositions`).

**Replacing the fingerprint.**
- Delete `worldFingerprint` (8498-8536), `fingerprintDiff` (8568-8572), and `restore()`'s own read-back loop (8458-8464), because the dump checks the same thing and more.
- Keep `snapshot`/`restore` as the WRITING side, since they know how to put things back (`setClock` first, `setDespair`, `reviveCharacter`, deleting stray Remnants and messages). Keep `moduleSettingValues`, `stableJson` and `watchWrites`.
- Keep `restore`'s `stuck` list only for writes that threw.
- `watchWrites` gains create/update/delete hooks for every document name in `game.collections`, plus Token, Item, ActiveEffect, Region, TableResult, PlaylistSound and JournalEntryPage. It stays on through tier 2 and sets `current.wrote` for the world-after-write rule.

Purity in `runSuite`:

```js
const untouched = await worldDump();           // before tier 0, as today (14878)
/* tiers 0 and 1 via runOne ... await settle(); */
const moved = dumpDiff(untouched, await worldDump());
record(moved.length
  ? { name: "tier 0/1 changed nothing in the world", outcome: "fail",
      message: `moved: ${moved.slice(0, 12).map(describeDiff).join("; ")}${more(moved, 12)}` }   // + the "written:" line from watchWrites, unchanged
  : { name: "tier 0/1 changed nothing in the world", outcome: "pass" });
```

`describeDiff` prints `Actor "Aiko Hoshino" (ACTORAIKO0000000) system.resources.hope.value 2 -> 3`. Values are truncated to 60 characters, and strings are shown as a hash when they are longer than 200 characters or come from a `client:` ledger, so a trace's `realType` does not land in `results/*.json`.

**Restore verification in tier 2.**

```js
const asFound = await worldDump();             // after snapshot(), before the first scenario
const reported = new Set();
for (const entry of pick(SCENARIOS)) {
    record(await runOne(entry, { tier: 2, ledger }));
    let broke = null;
    try { await game.drpg.endMurder({ reason: "test", followUp: false }); await restore(snap); } catch (err) { broke = err; }
    await settle();
    const left = dumpDiff(asFound, await worldDump()).filter(d => !reported.has(d.path));
    if (broke || left.length) {
        failed++;
        lines.push(`  FAIL  could not restore the world after "${entry[0]}"`);
        if (broke) lines.push(`        ${broke.message ?? broke}`);
        if (left.length) lines.push(`        restore left: ${left.slice(0, 12).map(describeDiff).join("; ")}${more(left, 12)}`);
        left.forEach(d => reported.add(d.path));        // one leftover is reported once, by the scenario that left it
    }
}
// and one pseudo-test at the end: "tier 2 put the world back as it found it" (catches writes that land after the last restore)
```

A generic "restore from the dump" is deliberately NOT part of E30. Deleting flags means `ForcedDeletion` in v14, while the shim still honours `-=` until the harness-fidelity work lands. E30 reports; the fixes go into `restore()` or the scenario's `finally`.

## 7. runTests(): tier 1 by default, tier 2 only after a window naming the world (D25, S17-06)

```js
/**
 * @param {object} [options]
 * @param {0|1|2} [options.tier=1]  0 reads the module's source; 1 adds the read-only invariants (the default:
 *     safe during play, and checked to be); 2 adds the scenarios, which WRITE, and asks first.
 * @param {string} [options.only]   ...(unchanged)
 * @param {string} [options.confirmed] Tier 2 only: THIS world's id (game.world.id), for a caller that cannot answer a
 *     window (the headless harness). Anything else - `true` included - opens the window, so a line copied from a
 *     handbook into a campaign world still asks.
 */
export async function runTests({ tier = 1, only = null, confirmed = null } = {}) {
    if (!game.user.isGM) { ui.notifications.warn(game.i18n.localize("DRPG.Panel.gmOnly")); return null; }
    if (inFlight) { /* unchanged, but returns { passed:0, failed:0, skipped:0, red:0, results:[], text, refused: "running" } */ }
    tier = [0, 1, 2].includes(Number(tier)) ? Number(tier) : 1;
    inFlight = true;
    try {
        if (tier === 2 && !game.drpg?.murderState?.()) {      // an open incident keeps today's path: tiers 0-1 run, tier 2 is REFUSED and counted
            if (await confirmTier2(confirmed) !== "run") {
                const text = game.i18n.localize("DRPG.Tests.tier2Cancelled");
                ui.notifications.info(text);
                return { passed: 0, failed: 0, skipped: 0, red: 0, results: [], text, refused: "cancelled" };
            }
        }
        if (game.drpg) game.drpg.suiteRolling = true;
        return await runSuite(tier, only);
    } finally { if (game.drpg) game.drpg.suiteRolling = false; inFlight = false; }
}

async function confirmTier2(confirmed) {
    const { id, title } = game.world;
    if (confirmed === id) return "run";
    if (confirmed !== null) warn(game.i18n.format("DRPG.Tests.confirmedNotThisWorld", { given: String(confirmed), id }));
    const others = game.users.filter(u => u.active && u.id !== game.user.id).length;
    return foundry.applications.api.DialogV2.wait({
        classes: ["drpg-panel", "drpg-window-suite-tier2"],
        window: { title: game.i18n.format("DRPG.Tests.tier2Title", { title }) },
        content: dialogContent(`<p class="drpg-warning">${esc(game.i18n.localize("DRPG.Tests.tier2What"))}</p>
            <p><strong>${esc(game.i18n.format("DRPG.Tests.tier2Where", { title, id }))}</strong></p>
            ${others ? `<p class="drpg-warning">${esc(plural("DRPG.Tests.tier2Online", { n: others }))}</p>` : ""}
            <p class="notes">${esc(game.i18n.localize("DRPG.Tests.tier2Advice"))}</p>`),
        /* CANCEL FIRST AND DEFAULT. HTML's implicit submission (Enter in a form) takes the FIRST submit button in tree
           order, and `default` is the button Foundry marks; Cancel is both, and the window has no input to hold focus,
           so Enter can only cancel. (The season reset puts Cancel last with a typed word - there the word is the
           confirmation; here there is none.) */
        buttons: [
            { action: "cancel", label: game.i18n.localize("DRPG.Tests.cancel"), default: true },
            { action: "run", label: game.i18n.format("DRPG.Tests.tier2Run", { title }), class: "drpg-gm-route" }
        ],
        rejectClose: false
    });
}
```

**Return shape** (all paths): `{ passed, failed, skipped, red, text, results }`. `results` is a list of `{ tier, name, outcome: "pass"|"fail"|"skip"|"red", message?, probe?, assertions }`.

**New i18n keys** (en + pl, per CLAUDE.md; `tier2Online` needs `.one`/`.other`, and in pl also `.few`/`.many`):

| Key | en | pl |
| --- | --- | --- |
| `DRPG.Tests.tier2Title` | "Tier 2 writes to {title}" | "Tier 2 zapisuje do świata {title}" |
| `DRPG.Tests.tier2What` | "The scenarios build their own fixtures in this world and put them back: they open and close incidents, kill and revive students, write world settings and delete the chat they produce. After each scenario the whole world is read again, and anything left behind is reported as a failure." | "Scenariusze budują w tym świecie własne fixture'y i sprzątają po sobie: otwierają i zamykają incydenty, zabijają i wskrzeszają uczniów, zapisują ustawienia świata i usuwają czat, który wytworzą. Po każdym scenariuszu cały świat jest czytany od nowa, a wszystko, co zostało, liczy się jako błąd." |
| `DRPG.Tests.tier2Where` | "World: {title} ({id})" | "Świat: {title} ({id})" |
| `DRPG.Tests.tier2Online` | ".one "{n} other person is connected to this world right now." .other "{n} other people are connected to this world right now."" | ".one "{n} inna osoba jest teraz połączona z tym światem." .few "{n} inne osoby są teraz połączone z tym światem." .many/.other "{n} innych osób jest teraz połączonych z tym światem."" |
| `DRPG.Tests.tier2Advice` | "Run it on a copy of a world, never on a campaign somebody is playing. Without arguments, runTests() runs the read-only tiers." | "Uruchamiaj go na kopii świata, nigdy na kampanii, w którą ktoś gra. Bez argumentów runTests() uruchamia tylko tiery do odczytu." |
| `DRPG.Tests.tier2Run` | "Run tier 2 on {title}" | "Uruchom tier 2 na {title}" |
| `DRPG.Tests.cancel` | "Cancel" | "Anuluj" |
| `DRPG.Tests.tier2Cancelled` | "Nothing ran: tier 2 was not confirmed." | "Nic nie zostało uruchomione: tier 2 nie został potwierdzony." |
| `DRPG.Tests.confirmedNotThisWorld` | "runTests({ confirmed }) names {given}, but this world is {id}: asking instead." | "runTests({ confirmed }) podaje {given}, a ten świat to {id}: pytam w oknie." |

**Callers and texts that must change in the same commit:**
- **The runner file.** The header (`tests.mjs:4-6`) becomes: `game.drpg.runTests()` runs tiers 0 and 1, read-only; `runTests({ tier: 2 })` also writes, and asks first. The two JSDoc blocks at 14815-14827 become one (S14-25). The signature is as above.
- **`scripts/api.mjs:1048`.** The call shape is unchanged (`...args` passes the new option through). Only the import path moves with the split. The D25 surface freeze sees no new entry.
- **GM panel.** Nothing, because no button exists (see section 0).
- **`README.md:287-291`** becomes: "A GM can run the regression suite from the console with `game.drpg.runTests()`: the read-only tiers, safe during play, and it checks at the end that nothing in the world moved. `game.drpg.runTests({ tier: 2 })` adds the scenarios, which write to the world; it asks first, in a window that names the world, and Cancel is the default. Run it on a copy of a world, never on a campaign."
- **`gm-handbook.en.md:817-828`, and the PL twin:**
  - table rows: `runTests()` becomes "runs the source regressions and the read-only invariants; safe during play - it checks at the end that nothing moved, and says what did if something did"; `runTests({ tier: 2 })` becomes "adds the scenarios, which write; asks first in a window that names the world (Enter cancels); only on a copy of a world"; `{ tier: 0 }` is unchanged.
  - The CAUTION box: "never run tier 2 in a world somebody is playing in; scenarios that need more people or rooms than the world has are skipped and say what the world lacks".
  - The result line gains the fourth count, "red until a later stage".
  - The handbook version stamp is unaffected.
- **`CLAUDE.md`:** line 33 becomes `game.drpg.runTests()` (tiers 0-1) and `runTests({ tier: 2 })` (asks in a window). The "three numbers" section becomes four. Add the "Test author contract" section (section 12). "Releasing" gains the `stages.mjs ship` step.
- **`CONTRIBUTING.md:37-40`**: the skip paragraph points at `audit/harness/skip-baseline.json`. **`CONTRIBUTING.md:52`** names the tier files.
- **`audit/harness/scenarios/01-runtests.mjs`**: rewritten; see section 9.
- **`06-runtests-music.mjs:4`**: pass `confirmed: game.world.id`, or retire it with S14-23's move of the probe scenarios. Without `confirmed`, the shim's default auto-answer presses the default button, which is Cancel. That is safe, but it would silently run nothing.
- **`.github/release-notes/v1.2.61.md`**: must say that the default changed.

## 8. Tier-2 fixtures (S14-24)

```js
/** `n` living students to play with, or a skip that says the world has fewer (it used to FAIL, 8597). */
export function cast(n = 3) {
    needs(world.atLeast("livingStudents", n), `this scenario casts ${n}`);
    return living().slice(0, n);
}
```

**The seven local shadows**, which bypass `cast()` and can pick a corpse or a Monokuma character:

| Line | Before | After |
| --- | --- | --- |
| 9313 | `.slice(0, 2)` | `const [one, two] = cast(2)` |
| 9439 | `.slice(0, 3)` | `const [killer, victim] = cast(3)` |
| 9516 | `.slice(0, 2)` | `const [one, two] = cast(2)` |
| 9630 | `.slice(0, 2)` | `const [reader, holder] = cast(2)` |
| 11091 | no slice | `const [killer, other] = cast(2)` |
| 11800 | `.slice(0, 3)` | `const [a, b, c] = cast(3)` |
| 12451 | `.slice(0, 3)` | `const [a, b, c] = cast(3)` |

Each also drops its `ok(cast.length >= n)` line. Which actors these seven pick may change, because the living, non-Monokuma filter is new to them. Compare harness results before and after.

**World-composition FAILs that become `needs(world.*)`.** There are 40 `ok()` calls, plus `cast()`'s throw.

| Probe | Lines |
| --- | --- |
| `sceneOnScreen` | 9308, 9512, 9626, 9784, 10631, 10850, 11539, 13375, 13510 |
| `scenes` | 9919, 10017, 11485 |
| `occupiedRooms` (n=1 unless noted) | 9238, 9312 (n=2), 9514, 9628, 9786, 10633, 11541, 12537 |
| `studentsInRooms` 2 | 10656 |
| `namedRooms` | 11098, 11172 (room part), 12671 (3), 12703 |
| `livingStudents` / `cast` | 9314, 9440, 9517, 9631, 11094, 11172 (actor part), 11236, 11285, 11331, 11385, 11801, 12452, 12671 (student part) |
| `playerAccounts` 2 | 9922, 12640 |
| `playersWithCharacter` | 10026, 12638 |

Where the module's own reading follows, keep it as an `ok()` checked against the probe. For example, 9312 becomes `needs(world.atLeast("occupiedRooms", 2))` followed by `ok(rooms.length >= 2, \`Foundry has tokens in ${n} rooms, roomOfToken finds ${rooms.length}\`)`.

**No global pre-flight refusal.** One missing player account would block all 97 scenarios. Instead, tier 2 opens with one census line, for example `world: 4 living students, 3 player accounts (3 own a character), 1 full GM, scene on screen "Academy - Floor 1" with 6 named rooms (5 occupied)`, and the summary groups skips by probe.

## 9. Harness side

- **`audit/harness/skip-baseline.json`** (new):
  ```json
  { "$comment": "Every test the headless harness cannot answer, with the probe that says why. 01-runtests fails on a skip not listed (something stopped being answerable) and on a listed one that now answers (keep it exact). env.* only: the harness builds its own world, so a world.* skip there is a fixture defect.",
    "measured": "<run, date, version>",
    "skips": [ { "test": "R12 · every standing window fits the screen Foundry calls a minimum", "probe": "env.layout" } ] }
  ```
  The 16 entries today, from `new-01.log`, give env.layout ×8, env.cascade ×3, env.systemSheets ×2, env.canvas ×1, env.fonts ×1 and env.webAnimations ×1:
  - env.layout: R12, R111, R112, the curtain cuts a clean partition, no chrome label is cut off, nothing in the chrome is set under the floor, the notice tile is always cut, no module window is wider than the cap;
  - env.fonts: the theme speaks two faces;
  - env.webAnimations: a window closes without waiting for a transition;
  - env.systemSheets: the roll window opens locked, topping up Hope;
  - env.canvas: no piece of a room's outline is shorter;
  - env.cascade: high contrast, the slider under Legacy, a prose window's box.
  It replaces the `<= 16` count at `01-runtests.mjs:44`.
- **`client-entry.mjs`**:
  - `globalThis.__harnessWorldState = () => ({ world: Object.fromEntries(worldValues), client: Object.fromEntries(clientValues), docs: Object.fromEntries([...worldColls].map(([n, c]) => [n, c.contents.map(d => d.toObject())])) })`. This is the harness's own reading, independent of the suite's `worldDump`.
  - `game.settings.storage` with a `"client"` Storage view over `clientValues`, so the orphan scan works headless. Coordinate with the harness-fidelity area.
- **`cluster.mjs`**:
  - seed one stash with one stashed item, for the two stash invariants;
  - add a `note(name, details)` API;
  - add the "scenario measured something" check.
- **`01-runtests.mjs`**, new phases:
  - **A1.** Open an incident (`openMurder` + `resolveKillerOpening`, as 10-murder does). Take the harness state, run `runTests()` with no argument, take it again. Checks: every result has tier <= 1 and there is no `TIER 2` in the text; the harness state is unchanged; the suite printed "ok tier 0/1 changed nothing". Then `endMurder`.
  - **A2.** The same inside a Class Trial (`setClock({ phase: "classTrial" })` as tests.mjs:9044/11811 do, with the debate open), then leave the trial.
  - **A3.** In a world with no incident, `runTests()`, then `murderState()` is still null. This is the verify line "runTests() without arguments does not open an incident".
  - **B.** `__dialogAnswers.push(cfg => { seen = { title, content, buttons: cfg.buttons.map(b => ({ action: b.action, default: !!b.default })) }; return "cancel"; })`, then `runTests({ tier: 2 })`. Checks: the window's title and content name `game.world.title` and `game.world.id`; `buttons[0]` is `cancel` and the only default; `refused === "cancelled"`, `passed === 0`.
  - **C.** `runTests({ tier: 2, confirmed: game.world.id })`. Checks: `failed === 0`; skips equal the baseline exactly; no `world.*` probe skips; `red` is reported.
  - The p1 refusal check (01-runtests.mjs:20) stays.
- **`audit/harness/mutants.mjs`** plus **`audit/harness/mutants/<name>.json`**. Each mutant file is `{ why, edits: [{ file, find, replace }], scenario, expect: [substrings] }`.
  - The runner copies the checkout without `node_modules`, `.git` and `results`. Each `find` must match exactly once, otherwise the mutant is reported as stale. It runs `node cluster.mjs <scenario>` with `DRPG_REPO=<copy>` and asserts every `expect` string appears. It records to `results/mutants.json`.
  - A small `scenarios/09-contract.mjs` runs `runTests({ tier: 1, only: "contract probe" })`, and `{ tier: 2, confirmed, only: "<name>" }` for restore, so each mutant takes seconds and can sit in the CI layer.
  - Mutants for this area:
    - an empty test, expecting "measured nothing";
    - `needs(document.body, ...)`, expecting the brand FAIL and the R154 FAIL;
    - an inserted `src.slice(src.indexOf("x"))`, expecting R152 naming its file and line;
    - `ok(true, ...)`, expecting R153;
    - a marked test that passes, expecting "unexpectedly passed";
    - a marked failing test, expecting a `red` line with 0 failed;
    - the same after editing `tools/stages.json` to ship its stage, expecting "shipped";
    - `restore()` without its stray-Remnant deletion, run with only "a direct murder opens on the killer", expecting `restore left:` plus `tokens.` (the opening roll leaves a Remnant, per the comment at 8360-8367);
    - a tier-1 test that writes a setting, expecting "tier 0/1 changed the world" with the setting path.

## 10. What each verify line maps to, and what the scripts must record

| Verify line | Where it is measured | Layer |
| --- | --- | --- |
| no assertion → "measured nothing" | R156 case; empty-test mutant | ci |
| `needs()` with an action result → FAIL | R154, runtime brand check; `needs(document.body)` mutant | ci |
| bare `indexOf` → FAIL | R152 (before 61 + 1, after 0); bare-cut mutant | ci |
| expectedRed: green / FAIL on pass / FAIL when shipped | R156 cases; red mutants; `tools/stages.mjs check` | ci |
| tier 0/1 in a world with an incident and a Class Trial: dump diff 0 | 01-runtests A1/A2, with the harness's own state as the oracle | ci |
| broken `restore()` → "restore left: <paths>" | restore mutant | ci |
| `runTests()` does not open an incident | 01-runtests A3 | ci |
| tier-2 window: Enter cancels on a real v14 DialogV2 | local-gate step `tier2-window-enter` | local-gate |
| dump on the real QA world, both themes: 0 `restore left`, 0 orphan client keys, the dump's cost | local-gate step `dump-qa-world` | local-gate |
| real browser: env skips about 0, the tier 0/1 diff empty with windows really drawn | local-gate step `purity-real-browser` | local-gate |

For every local-gate step, the gate script records `{ id, ran: false, why: "no Foundry v14 / licence in this environment" }` when it cannot run. It never records `ran: true` for anything the container cannot do. The E30 release notes say which steps did not run.

## 11. Commit order (each commit records the before/after suite numbers)

1. The split: content-neutral, the other area's job.
2. Counter, `must`, `runOne`/`judge`, R156, `bodyOf`→`must`. The harness stash seed and the two stash invariants' `needs` go in the same commit, as does anything else the counter turns red in the harness.
3. Probes, `needs`, `cast(n)`, the seven shadows, the world-fact conversions, the census line, R154, `skip-baseline.json`.
4. Cutters: `lineAround`, `bodyOf { back }`, `fnSource` use. Convert the 62 cuts; add R152 and R153, and `tools/contract-check.mjs`, `note()` and the fixes at 00-boot:25 and 12-social:9.
5. `expectedRed`, `tools/stages.json`, `tools/stages.mjs`, R155, and the release.yml and ci.yml steps.
6. `worldDump`/`dumpDiff`/`DUMP_RULES`, replacing the fingerprint; per-scenario restore verification; R157; the harness oracle; 01-runtests A1-A3; mutants. Expect new reds here, and fix each leftover in `restore()` or the scenario.
7. The tier-1 default, the window, the i18n keys, 01-runtests B/C, `06`, README, the handbooks, CLAUDE.md and CONTRIBUTING.

## 12. CLAUDE.md, new section (draft, house style, `-` dashes)

"## Test author contract

Every test in `scripts/tests-tier*.mjs` keeps these, and the suite checks each one itself (R152-R157, tier 0; `tools/contract-check.mjs` in CI for the harness scenarios).

1. **It measures something.** A test that ends without one `ok()` or `equal()` having run FAILs as "measured nothing". A loop over the world counts only if the world had something in it - declare what it needs with `needs(world.atLeast(...))`. An assertion caught inside the test FAILs it.
2. **A skip is a probe, never a result.** `needs()` takes only `env.*` (this browser, this Foundry) or `world.*` (the world as found) from `tests-kit.mjs`; anything else FAILs, and a `world.*` asked after the test wrote to the world FAILs. What the module does is `ok()`. A new probe is a row in the kit, not a condition in a test.
3. **Source is cut with the kit** - `bodyOf`, `fnSource`, `lineAround`. A `slice` bounded by `indexOf`, or `split(marker)[1]`, answers -1 or nothing when the code moves, and every negative assertion after it passes.
4. **Nothing is true by construction** - no `ok(true)`, no `|| true`, no `check(name, true)`.
5. **Red on purpose says until when.** `[name, fn, expectedRed("E07", why)]` is green while it fails on an assertion, FAILs as "unexpectedly passed" when it passes, and FAILs once `tools/stages.json` says E07 shipped. One tuple per generated case.
6. **Tier 0 and 1 change nothing; tier 2 puts everything back.** `worldDump()` is compared before and after tiers 0-1 and after every scenario's `restore()`. Leaving a path out of the dump takes a `DUMP_RULES` row with a reason and an `until`.
7. **World requirements skip, they do not fail.** Fixtures come from `cast(n)` and `world.*`. The harness world satisfies every `world.*`, so `audit/harness/skip-baseline.json` holds `env.*` probes only, and must match the run exactly."

"What the suite's four numbers mean" adds: "**red** - tests marked `expectedRed(stage, why)` that failed on an assertion as expected; they do not fail the gate, and they turn into failures the day their stage ships."