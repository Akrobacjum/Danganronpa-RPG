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

These six sat among the scenarios as 02-07 until E30 and were counted like
them: seven of their checks, in 02, 04, 05 and 07, passed on a constant `true`,
and all six wrote results files beside the real ones. The numbers 02-07 are
retired, not reused - a scenario number is found by grep a year later, the way
an R number is.

A probe cannot pass or fail; delete it when what it probes is gone.
