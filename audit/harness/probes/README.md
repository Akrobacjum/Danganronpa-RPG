# Tools, not tests

A probe is shaped like a scenario - the cluster boots the same four clients and
hands it the same api - but it looks at something and writes down what it saw.
It asserts nothing. Every file here declares `export const layers = ["probe"]`,
and for such a file the cluster:

- prints a banner saying so;
- writes its record to `results/probes/<name>.json` (written per run, ignored by
  git), never next to the scenarios' results, with whatever the probe returns
  kept as `evidence`;
- exits 0 whatever its `check()` lines say, and 1 only when the probe threw.

Run one from `audit/harness`:

    node cluster.mjs probes/07-apimap.mjs

| Probe | What it looks at |
| --- | --- |
| `02-probe.mjs` | the rooms of the harness scene, `grantItem` on one tool, the music map, and the source around secret.mjs's `dispatchEvent` |
| `03-standalone.mjs` | the equipment loop over every EQUIPPABLE category and the objection music, replayed step by step outside the suite; tier 2 drives both today ("everything that can be held ready can also be broken", "every objection takes a different track from the objection playlist") |
| `04-music-debug.mjs` | the music state, track by track, once an objection opens |
| `05-playsound.mjs` | `Playlist.playSound` on the harness's shim |
| `06-runtests-music.mjs` | the whole suite, tier 2, with music switched on; prints the suite's FAIL lines |
| `07-apimap.mjs` | the sorted list of `game.drpg` keys, returned into its results file |
| `08-capture-windows.mjs` | the module's windows as the harness draws them (E44 C1d): each window of its list opened on its client, its HTML into `audit/windows/<id>.html`, its title, classes and buttons into `audit/windows/manifest.json`, and the GM's world dump before and after; since E21 C1c each tab of a kit tab bar pressed and kept as `<id>--<key>`, the player's action windows on p1 (`action-<key>`, Palm not captured: its opener answers before a window), the notice history with 250 notices and the room's description window, for `node audit/style-sweep.mjs --fit`; since E46 C0 the Give window (`give`, `give--existing`), Give a Truth Bullet (`bullet`), the Students window (`students`) and the project manager (`projects`), and three environment options: `DRPG_CAPTURE_ONLY=id,id` (only those windows, the manifest's other rows kept), `DRPG_CAPTURE_LANG=pl` (the module's language set to Polish on the capturing clients first, as 50-lang does) and `DRPG_CAPTURE_OUT=<dir>` (the files and manifest written there instead of `audit/windows`; required with a language other than English) |
| `09-open-cost.mjs` | what a window costs the first time it opens and the second (perf-open line): each window of 08's list that needs no seed opened three times on its client and timed from the opener's call to its first `renderApplicationV2`, with the `import()` of its opener's file timed apart; `DRPG_OPEN_ONLY=id,id` and `DRPG_OPEN_ROUNDS=n`. jsdom's time, not a frame's: no layout, paint, font, image or server fetch |
| `80-open-profile.mjs` | where a window's first open spends what its second does not (perf-open line): each window named (`DRPG_OPEN_ONLY`, else the ones 09 read the largest premium on) opened twice under V8's sampling profiler (`node:inspector`, 100 us) in its client's process; the functions whose self time the first exceeds most, V8's `(program)` and `(garbage collector)` apart, and every sample charged to the nearest function of scripts/ above it |

These six sat among the scenarios as 02-07 until E30 and were counted like
them: seven of their checks, in 02, 04, 05 and 07, passed on a constant `true`,
and all six wrote results files beside the real ones. The numbers 02-07 are
retired, not reused - a scenario number is found by grep a year later, the way
an R number is.

A probe cannot pass or fail; delete it when what it probes is gone.
