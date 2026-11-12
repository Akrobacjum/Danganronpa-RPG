# perf-open: a window's first open

The line's notes (12.11.2026), not release notes. This line's branch, from `origin/main` at 1.2.108 (4dfac3a9).

## The report

The owner, at a table on 1.2.108 (Foundry 14.365 on a hosted server, Daggerheart 2.12.8): the module's windows have a big
delay the first time each is opened; later opens are fine.

## What was measured, and how

Three readings, none of them at a table. Each says what it can and cannot see.

| Reading | How | What it sees | What it cannot see |
| --- | --- | --- | --- |
| H: the module's work | `node cluster.mjs probes/09-open-cost.mjs` (new, audit/harness): each window of probe 08's list that needs no seed opened three times on its client (GM or p1), closed unanswered between, timed from the opener's call to the first `renderApplicationV2` of the new application (`performance.now()` on that client, polled every 1 ms) | the module's JavaScript: building the window, its render hooks, an `import()` of a file not loaded yet (from disk), awaits | layout, paint, fonts, images, a real server's round trip; jsdom's DOM is far slower than a browser's, so its absolute times are large |
| C: the stylesheets | Chromium (Playwright's, headless), `audit/style-harness.html` with the module's seven stylesheets at 1920x1080, Stained Glass; each captured window of `audit/windows/` (probe 08's HTML) inserted three times, the time to a forced layout (`getBoundingClientRect`) after the insert | style matching and layout of a window's markup the first time the page meets it, against later times | the module's code, Foundry's own stylesheet, the glass canvas, fonts not yet used |
| G: the glass band | Chromium, `audit/glass-harness.html?gmp=1`; the page's `.drpg-panel` cloned at 420, 640 and 900 px, `dressWindow` and `dressChrome` run on it, the time between a frame callback queued before and one queued after (the band's paint and flash in between) | what Stained Glass paints on a window's title band when it opens | a GPU's first use of a shader on another machine |

Scratch scripts for C and G are not committed (they were one-off readings, 12.11.2026, 4 cores, this container).

### The windows: first open against later ones

H: three opens, ms, the first one first. C: three inserts, ms to a forced layout. Read 12.11.2026 on 1.2.108 with
nothing of this line in it (H) and on the committed captures of `audit/windows/` (C).

| Window | Client | H: opener to render (1st / 2nd / 3rd) | C: style and layout (1st / 2nd / 3rd) | First-open premium found |
| --- | --- | --- | --- | --- |
| GM panel | GM | 61 / 76 / 90 | 11.7 / 3.7 / 3.8 | none in H; 8 ms in C |
| DRPG Settings (the gear) | GM | 78 / 80 / 116 (its file already imported by Look, which opened before it) | 26.6 / 14.3 / 14.3 | 12 ms in C; at a table also three files fetched in a row (below) |
| DRPG Settings | p1 | 93 / 86 / 83 | 12.8 / 10.4 / 6.9 | as above |
| Look (opens the Settings window) | GM | 119 / 137 / 84, its file imported in 1.0 / 0.1 / 0.1 | 5.7 / 5.7 / 3.7 | the file's import |
| Sound | GM | 701 / 716 / 606 | 5.6 / 3.1 / 3.1 | none: 600-700 ms every open, headless (jsdom's DOM; not a first-open cost) |
| Sound (a player's) | p1 | 84 / 58 / 55 | 2.1 / 2.1 / 2.0 | about 30 ms in H |
| Students | GM | 95 / 73 / 72 | 18.6 / 14.0 / 14.0 | about 20 ms in H, 5 ms in C |
| Projects | GM | 87 / 91 / 80 | 4.8 / 4.4 / 4.6 | none |
| Season setup | GM | 77 / 70 / 102 | 19.5 / 8.7 / 10.4 | 10 ms in C |
| Season checklist | GM | 114 / 74 / 79 | (pre-season checks) 10.0 / 6.4 / 5.4 | about 40 ms in H |
| Room setup (each tab) | GM | 632-827 first, 612-779 later | 1.0-22.5 first, 2.9-23.9 later | about 130 ms on Bedrooms, the first tab opened, in H; none on the others |
| Investigation | GM | 167 / 149 / 158 | 17.1 / 9.3 / 9.9 | 8 ms in C |
| Class Trial console | GM | 87 / 47 / 42, its file imported in 6.1 / 0.1 / 0.1 | 1.8 / 1.6 / 1.4 | 40 ms in H, 6 of them the import from disk; at a table three or four files fetched in a row |
| Edit campaign | GM | 44 / 71 / 51 | 6.2 / 4.5 / 4.8 | none |
| Murder / incident tracker | GM | 51 / 47 / 43; 71 / 45 / 47 | 3.1 / 3.2 / 3.3; 1.9 / 1.8 / 1.7 | about 25 ms in H on the tracker |
| Level Up | GM | 37 / 54 / 56 | 5.2 / 2.0 / 2.2 | none |
| Item manager / Item tables | GM | 58 / 48 / 42; 112 / 134 / 128 | 3.5 / 2.5 / 2.5; 4.7 / 4.0 / 3.2 | none |
| Notices | GM, p1 | 39 / 56 / 47; 51 / 44 / 40, the file imported in 1.5-1.6 / 0.1 | 2.7 / 1.9 / 1.9; 2.8 / 2.8 / 2.6 | the file's import |
| Give, Give a Truth Bullet | GM | not in the first run (see "After") | 3.2 / 2.7 / 2.8; 3.9 / 3.7 / 3.8 | none in C |
| Action windows (Observe, Search, Analyze, Tamper, Rest, Projects, Dynamic) | p1 | Observe 110 / 62 / 63; the others 52-75 first, 49-80 later | 4.1-14.1 first, 2.4-6.9 later | about 50 ms in H on Observe, the first opened; 3-10 ms in C |
| Palm | p1 | its opener answers before a window (as in probe 08) | not captured | - |
| The room's window | p1 | 42 / 42 / 42 | 1.0 / 1.1 / 0.9 | none |
| The character sheet | any | not measurable here: the harness's sheet is a stand-in, not Daggerheart's | the style harness's sheet is the module's parts on a model of it | - |

G, the glass band: 1.2-3.9 ms a paint at every width, the first of a width no dearer than the second (10 readings).

### What the readings say

- The module's own code has a first-open premium, and it is small: up to about 130 ms headless (Room setup's first tab,
  on jsdom), more often 20-50 ms. That is the code compiled on its first call; no warming can do it without running the
  window, and nothing here tries.
- The stylesheets add 5-15 ms to a first open in Chromium. The glass adds nothing first-only.
- None of that is "a big delay". What a first open does at a table and does not do a second time, and that neither the
  harness nor a local Chromium can time, is ask the server for files:
  - **files reached only by `import()`**, fetched the first time a window needs them. At 1.2.108, 192 of the 206 files
    the module serves outside the suite load at boot; 13 do not. The Settings window (the gear, and Look) is three
    fetches in a row: `settings-window.mjs`, then its static import `look.mjs`, then `voice-panel.mjs`, which its open
    imports. The Class Trial console is three or four (`trial-floor-ui.mjs`, then `trial-modes.mjs` and
    `trial-zones-ui.mjs`, then `case-trial.mjs` and `case-summary.mjs`, then `case-hints.mjs`). The notice history,
    Room setup's Passages tab and a Frisk one each. Counted off the import graph, not timed: what a round trip costs is
    the server's.
  - **Daggerheart's templates**: Foundry's ApplicationV2 fetches and compiles a class's part templates on its first
    render (the character sheet, the roll window an action opens, the countdowns). Whether Daggerheart 2.12.8 already
    loads them at init is not known here (its source is not in this repository).
  - **a font's subset**: each face is two files, Latin and Latin Extended (the Polish letters), fetched the first time
    text in them is drawn (`font-display: swap`: the text shows in a fallback face first, then reflows).
- The static windows the owner names (GM panel, Students, Sound, Projects, Give, Season setup) fetch no module file on
  their first open. If they are slow the first time at the table, the cause is one this line could not see; the
  recorder below is how to find it.

## What changed

1. `scripts/open-cost.mjs` (new), registered at ready on every client (`module.mjs`, after the API):
   - **warming at idle**: 4 s after ready, one step an idle callback (`requestIdleCallback` with no deadline since R4203: a busy page waits; a 50 ms timer where the browser has none): the
     files reached only by `import()` (`WARM_IMPORTS`: everyone's eight, the GMs' three more; `NOT_WARMED` names
     `patches.mjs`, which ready imports anyway), then Daggerheart's part templates of the character and party sheets and
     of the classes under `game.system.api.applications` (`templatePaths`, six at a time, through Foundry's
     `getTemplate`, so they land in Foundry's own cache), then the three faces' Latin and Latin Extended subsets
     (`document.fonts.load`). Nothing rendered, nothing written, no packet. Never throws: what failed is in `warmState()`.
   - **the reading at the table**: `game.drpg.openTimes()` - every module window and actor sheet opened on the page,
     its first open against the middle of its later ones, in ms from the click (or key) before it to the render hook and
     to two frames later, and what the warming did. Console only.
2. Tests: R4200 (tier 0, red on 1.2.108: the warm list holds every file `import()` reaches outside the static graph,
   nothing loaded at boot, a reason for each left cold; the reader shown a planted graph first), R4201 (tier 0: the
   summary and the template reader on fixtures), R4202 (tier 1: every file of this browser's plan imported without an
   error). A misspelt file in the plan turns R4200 and R4202 red (a mutant, run 12.11.2026, put back).
3. `audit/harness/probes/09-open-cost.mjs` (new): reading H, rerunnable.

## After

Probe 09 again, 12.11.2026, on the 1.2.108 checkout (before) and this branch (after), one run each, 12 s after the boot
(the warming starts 4 s after ready). Headless, so the only first-open cost this line removes that the harness can see
is the `import()` of a lazy file from disk; at a table each of those is a round trip to the server instead.

| Window | Client | the opener's file imported, 1st open (before -> after) | opener to render, 1st / 2nd / 3rd (before -> after) |
| --- | --- | --- | --- |
| Class Trial console | GM | 4.9 -> 0.2 ms | 57 / 46 / 47 -> 51 / 56 / 41 |
| Notices | GM | 2.2 -> 0.2 ms | 47 / 32 / 34 -> 40 / 42 / 33 |
| Notices | p1 | 1.8 -> 0.3 ms | 47 / 41 / 40 -> 53 / 50 / 39 |
| Look (and the Settings window it opens) | GM | 0.8 -> 0.2 ms | 89 / 84 / 72 -> 105 / 75 / 77 |
| Look | p1 | 0.7 -> 0.2 ms | 120 / 100 / 99 -> 115 / 98 / 90 |
| Give, Give a Truth Bullet | GM | (static) | 55 / 56 / 84 and 52 / 54 / 54 -> 70 / 56 / 56 and 52 / 54 / 54 |
| every other window | both | 0.1-0.3 ms both runs (in the boot's graph) | within the run-to-run spread of the before table above |

The roll road (the dh-212 line's a5, b5 and b10; probe 09's `rollImports`): its 30 files reached by `import()` from the roll
files (action-pipeline.mjs, roll-draw.mjs, private-rolls.mjs, forced-roll.mjs, the dice files, bridge-guards.mjs) answered
in 0.28 ms at most on p1 and 0.21 ms on the GM before, 0.21 and 0.21 after. All but one are in the boot's static graph, so
the first roll fetches nothing for them at a table either; the one that is not, frisk.mjs, is warmed. No change in the roll
files.

What this line cannot show here: the fetch's time at a table, Daggerheart's templates (the harness has none:
`templates.skipped`), and the fonts (jsdom has no `document.fonts`: `fonts.skipped`). LIVE-PERF-OPEN-01 below.

## What is open

- **LIVE-PERF-OPEN-01**: at the table, `game.drpg.openTimes()` after opening each window twice, on 1.2.108 and on this
  build. Only that says whether the fetches were the delay. If the static windows are still slow the first time, the
  rows say which, and from click to render (the module or an await) or from render to shown (the browser's drawing).
- Whether Daggerheart 2.12.8 preloads its sheet templates (then the template step costs nothing and gains nothing).
- What the warming costs a player's connection: about 330 KB of module files (380 KB on a GM), 156 KB of fonts at most, the templates'
  size unknown here; once a session, at idle.

## Runs before the push (12.11.2026, this container, 4 cores)

- `npm run quick`: green (lint, the 17 checks, the gate's self-test).
- `node run-tests.mjs --tier 1`: 1270 tests, 1254 passed, 1 failed, 16 skipped, 409.7 s wall. The failure was R1560
  (`openTimes` not yet in tools/api-surface.json); with its row added, R1560 and R4200-R4202 run again by name: 5 passed,
  0 failed. The whole of tiers 0-1 was not run again after that one row.
- `node cluster.mjs scenarios/00-boot.mjs`: 33/33. `node cluster.mjs scenarios/86-frame-work.mjs`: 104/104, 173 s.

## The idle wait without a deadline (12.11.2026, the coordinator's ask)

1.2.109's boards and curtain play at load and at a change of day, and no event marks their end. `whenIdle` now asks
`requestIdleCallback` with no `timeout` (it was 3000 ms): a busy page waits. R4203 (tier 0, red on the 3000 ms
deadline before the fix) reads it on stand-ins. What a step starts (a file's parse, a template's compile) still runs
when the server's answer lands, outside the idle period; each step stays one file, six templates or one face. Open:
once 1.2.109 is on main, read its transition code for a "playing" state and skip a step while one plays.

Runs: `npm run quick` green; tiers 0-1 in full 1271 tests, 1256 passed, 0 failed, 16 skipped, 0 red, 392.7 s.

## A step waits while something plays (12.11.2026, on 1.2.109; branch from 9c088110 with this line merged)

1.2.109 has no event for "the boards have played", and the boards play at load and at a change of day. What it does
have, read in its tree:

| What plays | Where | The mark open-cost.mjs reads |
| --- | --- | --- |
| a board or cut-in (the trial's entry, the verdict, the start and end of a day: up to 6450 ms, the day's end) | sequence.mjs `playSequence` / `endSequence` | `data-drpg-sequence` on the body, set at the start and taken off at the end |
| the curtain's turn | glass.mjs `turning()` | `data-drpg-turning` on the body, for `TURN() + 120` ms |
| a transition's flicker | transitions.mjs `flicker()` | `drpg-flicker` on the body |
| a transition's span (its Escape window, `t.dur + 200` ms, about 3 s at most) | transitions.mjs `onClockHeard` from the clock's hooks | no mark: QUIET_AFTER_CLOCK_MS (3500 ms) after `drpgTimeOfDayChanged`, `drpgPhaseChanged` or `drpgEclipseChanged`; the body's announcement only by its flicker's `drpg-flicker` (its hook's name is chapter.mjs's alone, R3145) |

`whenIdle` reads them (`playingNow`) when the browser calls back; while one stands it waits RECHECK_MS (400 ms) and asks
for the next idle period again, and counts the step as held by what held it (`warmState().held`, printed by
`openTimes()`). Read off the body, not imported: sequence.mjs reaches api.mjs's graph, which imports this file.
R4204 (tier 0) was red on the behaviour first ("the step went on while a board played"), with the reader in and the wait
unchanged; green after. Not covered: the few ms between the end of the day's board and the start of the next day's
(`then:` starts the second as the first ends), where neither mark stands, and the 450 ms gaps between the body's announcement's four flickers.

Runs (this branch, 12.11.2026): `npm run quick` green; tiers 0-1 in full 1325 tests, 1310 passed, 0 failed, 16 skipped,
0 red, 413.8 s (a first full run had R3145 red: the body announcement's hook name spelt here a second time - taken out);
00-boot 33/33.
