# audit/live - the runner for a real Foundry v14

**None of this has ever run against a real Foundry.** It was written on
24.09.2026 in a container with no Foundry binary, no licence and nothing on
`localhost:30099`. The first real run is its test. What it assumes about
Foundry and has not measured is marked `UNMEASURED` in the code: the field
names of `/api/status`, the join form's selectors on v14, the keys of
`game.collections`. When it breaks, a part is recorded as `error` - the runner
broke - and never as `failed`, which means the module failed.

The local gate (`audit/gate/local-gate.mjs`) calls it only when something
answered at the sandbox URL. On a machine where nothing does, every part is
recorded as `not-run` with reason `no-server` and the real connection error;
nothing here is loaded.

| File | What it does |
| --- | --- |
| `foundry.mjs` | reads the server's status (no world, not 14.x, not an allowed copy), hashes every module file the server serves against this commit (`stale-module`), launches Chromium, logs in on `/join` without ever touching the password field (`password-required` when an account needs one), and runs the parts below |
| `suite.mjs` | `live-stained-glass`, `live-monokuma-legacy`: the GM's theme set, a reload, `runTests({ tier: 2, confirmed: game.world.id })`, its text kept verbatim as evidence under the header `verify-gate.mjs` reads; the three players logged in and idle. `live-world-diff`: `worldDump()` around each run and around the whole visit (the theme put back), one file per dumped path under `audit/gate/.work/`, and only the paths that differ in the evidence |
| `sandbox-cluster.mjs` | a harness scenario (layers include `local-gate`) on four real pages, with the `run()` arguments `cluster.mjs` gives - `gm`, `p1`-`p3` with `eval`, `check`, `note`, `phase`, `settle`, `repoUrl`. A scenario that asks for anything else (the world object, the canary, verdict options, a page hook not below) is `adapter-missing`, not run |
| `page-hooks.js` | `__notifications`, `__errors`, `__missingI18n`, `__dialogAuto`, `__dialogLog` on every page. No `__forceRoll` |
| `perf-baseline.mjs` | the 1.2.56 performance baseline (`audit/perf-baseline.json`): `--probe` records what each thing a run needs answered; `--run` refuses unless all of them did, then measures `game.drpg.perf()` in both themes on a scratch copy of the recorded world |
| `world-manifest.mjs` | hashes a world copy's files and reads its `world.json`; `--write` records it as the baseline's `worldCopy`. It reads files only |
| `seed-world.mjs` | the harness's world (`audit/harness/lib/seed.mjs`) created with its ids kept, in an EMPTY world whose id matches `/(gate|copy|qa)/i`; it refuses anything else |

What it never does, by construction and checked by `node tools/check.mjs gatecode`:
type a password, an admin key or a licence key; log into the setup screen;
write to a world that is not an allowed copy (`DRPG_SANDBOX_WORLD`, which must
also match `/(gate|copy|qa)/i`, because tier 2 writes).

Drills (a scenario with `export const fixture = "<name>"` on a copy of a
private world from `DRPG_FIXTURES`) need the sandbox restarted on that copy
between parts. There is no restart step yet: with fixtures present a drill is
recorded as `error` with that reason, without them as `not-run` / `no-fixtures`.
